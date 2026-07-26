// Seesaw signal analysis for headless playtest runs.
//
// Scores a campaign against the three north-star signals in docs/SEESAW.md —
// Oscillation, Balance, Scarcity — using the same rubric the `seesaw-eval`
// skill applies by hand, so an automated sweep and a hand-read log agree.
//
// HONESTY RULE (from the skill's guardrails): the enemy's economy is not
// instrumented yet, so every claim about *why* the enemy did something is
// inferred from the player-side loss mix. Anything inferred is labelled as
// such in the output, and the analyzer additionally reports how many enemy
// branches actually exist in the sim — because with only missiles and mines
// implemented, the oscillation signal is capped by CONTENT, not by a broken
// allocator, and reading it as a balance failure would be wrong.

import { LOSS_CAUSE_TO_ENEMY_BRANCH, type EnemyBranchKey } from '../../src/data/counters';
import type { RoundTelemetry } from '../../src/sim/types';

export type Verdict =
  | 'oscillating'
  | 'stuck-hot'
  | 'stuck-cold'
  | 'not-adapting'
  | 'insufficient-data';

export type SignalScore = 'pass' | 'warn' | 'fail';

export interface SignalResult {
  score: SignalScore;
  evidence: string;
}

export interface RoundRow {
  round: number;
  deliveredPct: number;
  losses: number;
  topBranch: string;
  topBranchShare: number;
  interceptPct: number | null;
  mineDetectPct: number | null;
  confidenceDelta: number;
  netCash: number;
  netIntel: number;
  cashOnHand: number;
  intelOnHand: number;
}

/** Why a campaign stopped. Distinguishing these matters: a run that ended
 *  because the fleet was wiped out is a LOSS, not a survival, and conflating
 *  them makes a failing build look healthy. */
export type EndReason = 'confidence-collapse' | 'fleet-wiped' | 'round-cap';

export interface CampaignAnalysis {
  persona: string;
  seed: string;
  roundsPlayed: number;
  endReason: EndReason;
  /** True only when the campaign reached the round cap intact. */
  survived: boolean;
  campaignOver: boolean;
  finalScore: number;
  meanDeliveredPct: number;
  minDeliveredPct: number;
  maxDeliveredPct: number;
  totalLosses: number;
  lossesByBranch: Record<string, number>;
  /** Distinct branches that were ever the round's #1 loss cause. */
  topBranchesSeen: string[];
  /** Longest run of consecutive rounds with the same #1 loss branch. */
  longestSameTopRun: number;
  verdict: Verdict;
  signals: {
    oscillation: SignalResult;
    balance: SignalResult;
    scarcity: SignalResult;
  };
  rows: RoundRow[];
  /** Research the bot actually completed (reveals what the tree pushes toward). */
  completedResearch: string[];
  /** True when resources piled up unspent — a "nothing worth buying" tell. */
  hoarding: boolean;
}

/** Rounds delivered inside this band count as "in the healthy band". */
const BAND_LO = 60;
const BAND_HI = 90;
/** Same #1 loss branch for this many consecutive rounds reads as stuck. */
const STUCK_RUN = 4;

function branchOf(cause: string): string {
  // Escort/base asset losses carry an asset prefix; strip it so causes map
  // cleanly onto enemy branches (the same normalization telemetry.ts uses).
  const bare = cause.replace(/^(escort|base):/, '');
  return LOSS_CAUSE_TO_ENEMY_BRANCH[bare] ?? 'unknown';
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Count direction reversals in a series — a proxy for "wobbles" vs
 *  "trends monotonically", which is how SEESAW.md frames confidence health. */
function reversals(values: number[]): number {
  let count = 0;
  let lastDir = 0;
  for (let i = 1; i < values.length; i++) {
    const d = Math.sign(values[i] - values[i - 1]);
    if (d === 0) continue;
    if (lastDir !== 0 && d !== lastDir) count++;
    lastDir = d;
  }
  return count;
}

export function analyzeCampaign(
  persona: string,
  seed: string,
  telemetry: RoundTelemetry[],
  final: {
    campaignOver: boolean;
    score: number;
    cash: number;
    intel: number;
    endReason: EndReason;
  },
  /** Resources held after each round (not part of RoundTelemetry), so the
   *  report can show whether the player is actually spending. */
  onHand: { cash: number; intel: number }[] = [],
): CampaignAnalysis {
  const rows: RoundRow[] = [];
  const lossesByBranch: Record<string, number> = {};

  for (const r of telemetry) {
    const perBranch: Record<string, number> = {};
    for (const loss of r.losses) {
      const b = branchOf(loss.cause);
      perBranch[b] = (perBranch[b] ?? 0) + 1;
      lossesByBranch[b] = (lossesByBranch[b] ?? 0) + 1;
    }
    const ranked = Object.entries(perBranch).sort((a, b) => b[1] - a[1]);
    const top = ranked[0];
    rows.push({
      round: r.round,
      deliveredPct: r.deliveredPct,
      losses: r.lost,
      topBranch: top ? top[0] : 'none',
      topBranchShare: top && r.lost > 0 ? top[1] / r.lost : 0,
      interceptPct:
        r.missilesSpawned > 0
          ? Math.round((r.missilesIntercepted / r.missilesSpawned) * 100)
          : null,
      mineDetectPct: r.minesTotal > 0 ? Math.round((r.minesRevealed / r.minesTotal) * 100) : null,
      confidenceDelta: r.confidenceAfter - r.confidenceBefore,
      netCash: r.cashEarned,
      netIntel: r.intelEarned,
      cashOnHand: onHand[rows.length]?.cash ?? 0,
      intelOnHand: onHand[rows.length]?.intel ?? 0,
    });
  }

  const delivered = rows.map((r) => r.deliveredPct);
  const meanDelivered = mean(delivered);
  const totalLosses = rows.reduce((sum, r) => sum + r.losses, 0);

  // --- Oscillation ---------------------------------------------------------
  // Only rounds that actually produced losses carry a #1 branch signal.
  const topSeries = rows.filter((r) => r.losses > 0).map((r) => r.topBranch);
  const topBranchesSeen = [...new Set(topSeries)];
  let longestRun = 0;
  let run = 0;
  for (let i = 0; i < topSeries.length; i++) {
    run = i > 0 && topSeries[i] === topSeries[i - 1] ? run + 1 : 1;
    longestRun = Math.max(longestRun, run);
  }

  let oscillation: SignalResult;
  if (topSeries.length < 3) {
    oscillation = {
      score: 'warn',
      evidence: `only ${topSeries.length} round(s) produced losses — too few to read a mix shift`,
    };
  } else if (topBranchesSeen.length >= 2 && longestRun < STUCK_RUN) {
    oscillation = {
      score: 'pass',
      evidence: `#1 loss branch rotated across ${topBranchesSeen.join(' / ')} (longest same-branch run ${longestRun})`,
    };
  } else if (topBranchesSeen.length >= 2) {
    oscillation = {
      score: 'warn',
      evidence: `mix shifts but ${topSeries[topSeries.length - 1]} held #1 for ${longestRun} straight rounds`,
    };
  } else {
    oscillation = {
      score: 'fail',
      evidence: `${topBranchesSeen[0] ?? 'none'} was the #1 loss branch in every scoring round (${longestRun} straight)`,
    };
  }

  // --- Balance -------------------------------------------------------------
  const inBand = delivered.filter((d) => d >= BAND_LO && d <= BAND_HI).length;
  const bandShare = delivered.length > 0 ? inBand / delivered.length : 0;
  const confSeries = telemetry.map((r) => r.confidenceAfter);
  const confReversals = reversals(confSeries);
  const pinnedHigh = meanDelivered >= 95 && totalLosses <= rows.length;
  // A wiped-out fleet is a loss just as surely as lost confidence — both mean
  // the run did not survive, and only 'round-cap' counts as coming through.
  const lost = final.campaignOver || final.endReason !== 'round-cap';
  // "Stuck-cold" is a statement about the SEESAW, not about whether the player
  // eventually lost. A campaign that traded blows for ten rounds and then went
  // under was a hard fight, not a jammed seesaw — so a loss only reads as cold
  // when delivery was actually failing near the end (see the skill's guardrail
  // about not confusing a hard round with a broken game).
  const lateDelivered = delivered.length >= 3 ? mean(delivered.slice(-3)) : meanDelivered;
  const collapsed = meanDelivered < 50 || (lost && lateDelivered < 50);

  let balance: SignalResult;
  if (pinnedHigh) {
    balance = {
      score: 'fail',
      evidence: `delivery pinned at ${meanDelivered.toFixed(0)}% with ${totalLosses} total losses — no pressure`,
    };
  } else if (collapsed) {
    balance = {
      score: 'fail',
      evidence: `delivery averaged ${meanDelivered.toFixed(0)}% (last 3 rounds ${lateDelivered.toFixed(0)}%)${lost ? `, ended by ${final.endReason}` : ''} — unrecoverable`,
    };
  } else if (lost) {
    balance = {
      score: 'warn',
      evidence: `fought to ${meanDelivered.toFixed(0)}% mean delivery but still ended by ${final.endReason} — losing on economy, not on the fight`,
    };
  } else if (bandShare >= 0.5 && confReversals >= 1) {
    balance = {
      score: 'pass',
      evidence: `${Math.round(bandShare * 100)}% of rounds inside the ${BAND_LO}-${BAND_HI}% band, confidence reversed direction ${confReversals}×`,
    };
  } else {
    balance = {
      score: 'warn',
      evidence: `mean delivery ${meanDelivered.toFixed(0)}%, ${Math.round(bandShare * 100)}% of rounds in band, ${confReversals} confidence reversal(s)`,
    };
  }

  // --- Scarcity ------------------------------------------------------------
  // "The player is never fully covered": in a healthy log most rounds still
  // cost the player something. All-clean rounds mean the enemy has no answer.
  const scoringRounds = rows.filter((r) => r.losses > 0).length;
  const scarcityShare = rows.length > 0 ? scoringRounds / rows.length : 0;
  let scarcity: SignalResult;
  if (scarcityShare >= 0.5 && scarcityShare < 1) {
    scarcity = {
      score: 'pass',
      evidence: `${scoringRounds}/${rows.length} rounds cost the player ships — pressure present but not total`,
    };
  } else if (scarcityShare === 1 && meanDelivered < 60) {
    scarcity = {
      score: 'fail',
      evidence: 'every round drew blood and delivery stayed low — player never gets a foothold',
    };
  } else if (scarcityShare < 0.5) {
    scarcity = {
      score: 'warn',
      evidence: `only ${scoringRounds}/${rows.length} rounds cost the player anything — close to fully covered`,
    };
  } else {
    scarcity = {
      score: 'pass',
      evidence: `${scoringRounds}/${rows.length} rounds cost the player ships`,
    };
  }

  // --- Hoarding ------------------------------------------------------------
  // Piling up unspent resources = nothing worth buying, or enemy already solved.
  const hoarding = final.cash > 1500 || final.intel > 200;

  // --- Verdict -------------------------------------------------------------
  let verdict: Verdict;
  if (rows.length < 3) verdict = 'insufficient-data';
  else if (collapsed) verdict = 'stuck-cold';
  else if (pinnedHigh) verdict = 'stuck-hot';
  else if (oscillation.score === 'fail') verdict = 'not-adapting';
  else verdict = 'oscillating';

  return {
    persona,
    seed,
    roundsPlayed: rows.length,
    endReason: final.endReason,
    survived: final.endReason === 'round-cap' && !final.campaignOver,
    campaignOver: final.campaignOver,
    finalScore: final.score,
    meanDeliveredPct: Math.round(meanDelivered * 10) / 10,
    minDeliveredPct: delivered.length ? Math.min(...delivered) : 0,
    maxDeliveredPct: delivered.length ? Math.max(...delivered) : 0,
    totalLosses,
    lossesByBranch,
    topBranchesSeen,
    longestSameTopRun: longestRun,
    verdict,
    signals: { oscillation, balance, scarcity },
    rows,
    completedResearch: telemetry.length
      ? [...telemetry[telemetry.length - 1].completedResearch]
      : [],
    hoarding,
  };
}

// ---------------------------------------------------------------------------
// Aggregate across a whole sweep
// ---------------------------------------------------------------------------

export interface PersonaSummary {
  persona: string;
  campaigns: number;
  meanRoundsSurvived: number;
  /** Fraction that reached the round cap intact (NOT merely "didn't set the
   *  campaignOver flag" — a wiped fleet counts as a loss). */
  survivalRate: number;
  endReasons: Record<string, number>;
  meanDeliveredPct: number;
  meanScore: number;
  meanLosses: number;
  lossesByBranch: Record<string, number>;
  verdicts: Record<string, number>;
  hoardRate: number;
  /** Research entries completed in >=50% of this persona's campaigns. */
  commonResearch: string[];
}

export interface SweepSummary {
  generatedAt: string;
  campaigns: number;
  personas: PersonaSummary[];
  overall: {
    verdicts: Record<string, number>;
    signalPassRates: { oscillation: number; balance: number; scarcity: number };
    lossesByBranch: Record<string, number>;
    /** How many distinct enemy branches ever caused a loss anywhere in the
     *  sweep. Below 3 the oscillation signal is content-limited: the enemy
     *  cannot rotate through branches it does not yet field. */
    branchesObserved: string[];
  };
  /** Plain-language findings, ordered most-important first. */
  findings: string[];
  /** Everything the sweep could NOT measure, per the skill's honesty rule. */
  instrumentationNotes: string[];
}

function tally(target: Record<string, number>, source: Record<string, number>): void {
  for (const [k, v] of Object.entries(source)) target[k] = (target[k] ?? 0) + v;
}

export function summarize(analyses: CampaignAnalysis[], generatedAt: string): SweepSummary {
  const byPersona = new Map<string, CampaignAnalysis[]>();
  for (const a of analyses) {
    const list = byPersona.get(a.persona) ?? [];
    list.push(a);
    byPersona.set(a.persona, list);
  }

  const personas: PersonaSummary[] = [];
  for (const [persona, list] of byPersona) {
    const verdicts: Record<string, number> = {};
    const endReasons: Record<string, number> = {};
    const lossesByBranch: Record<string, number> = {};
    const researchCounts: Record<string, number> = {};
    for (const a of list) {
      verdicts[a.verdict] = (verdicts[a.verdict] ?? 0) + 1;
      endReasons[a.endReason] = (endReasons[a.endReason] ?? 0) + 1;
      tally(lossesByBranch, a.lossesByBranch);
      for (const id of a.completedResearch) {
        researchCounts[id] = (researchCounts[id] ?? 0) + 1;
      }
    }
    personas.push({
      persona,
      campaigns: list.length,
      meanRoundsSurvived: Math.round(mean(list.map((a) => a.roundsPlayed)) * 10) / 10,
      survivalRate: list.filter((a) => a.survived).length / list.length,
      endReasons,
      meanDeliveredPct: Math.round(mean(list.map((a) => a.meanDeliveredPct)) * 10) / 10,
      meanScore: Math.round(mean(list.map((a) => a.finalScore))),
      meanLosses: Math.round(mean(list.map((a) => a.totalLosses)) * 10) / 10,
      lossesByBranch,
      verdicts,
      hoardRate: list.filter((a) => a.hoarding).length / list.length,
      commonResearch: Object.entries(researchCounts)
        .filter(([, n]) => n >= list.length * 0.5)
        .map(([id]) => id)
        .sort(),
    });
  }
  personas.sort((a, b) => b.meanScore - a.meanScore);

  const verdicts: Record<string, number> = {};
  const lossesByBranch: Record<string, number> = {};
  for (const a of analyses) {
    verdicts[a.verdict] = (verdicts[a.verdict] ?? 0) + 1;
    tally(lossesByBranch, a.lossesByBranch);
  }
  const passRate = (pick: (a: CampaignAnalysis) => SignalResult): number =>
    analyses.length === 0
      ? 0
      : analyses.filter((a) => pick(a).score === 'pass').length / analyses.length;

  const branchesObserved = Object.keys(lossesByBranch).filter(
    (b) => b !== 'collateral' && b !== 'attrition' && b !== 'unknown',
  );

  // --- Findings ------------------------------------------------------------
  const findings: string[] = [];
  const fighting = personas.filter((p) => p.persona !== 'afk');
  const best = fighting[0];
  const worst = fighting[fighting.length - 1];
  if (best && worst && best !== worst) {
    findings.push(
      `Build spread: "${best.persona}" scores highest (${best.meanScore}, ${best.meanDeliveredPct}% delivered) and "${worst.persona}" lowest (${worst.meanScore}, ${worst.meanDeliveredPct}%) — a ${Math.round((best.meanScore / Math.max(1, worst.meanScore)) * 10) / 10}× spread across playstyles.`,
    );
  }
  const afk = personas.find((p) => p.persona === 'afk');
  if (afk && best) {
    const margin = best.meanScore - afk.meanScore;
    findings.push(
      margin > 0
        ? `Playing beats not playing by ${margin} score / ${Math.round((best.meanDeliveredPct - afk.meanDeliveredPct) * 10) / 10}pp delivery — defense is doing measurable work.`
        : `⚠ The AFK control matches or beats active builds (${afk.meanScore} vs ${best.meanScore}) — player agency is not paying off.`,
    );
  }
  if (branchesObserved.length < 3) {
    findings.push(
      `Oscillation is CONTENT-LIMITED, not necessarily broken: only ${branchesObserved.length} enemy branch(es) (${branchesObserved.join(', ')}) ever caused a loss, because the rest of ENEMY_ATTACKS.md is not implemented yet. The seesaw cannot rotate through branches the enemy cannot field.`,
    );
  }
  const collapsing = personas.filter((p) => p.survivalRate < 0.5 && p.persona !== 'afk');
  for (const p of collapsing) {
    const why = Object.entries(p.endReasons)
      .filter(([reason]) => reason !== 'round-cap')
      .sort((a, b) => b[1] - a[1])
      .map(([reason, n]) => `${reason} ×${n}`)
      .join(', ');
    findings.push(
      `"${p.persona}" fails to reach the round cap in ${Math.round((1 - p.survivalRate) * 100)}% of campaigns (mean ${p.meanRoundsSurvived} rounds; ${why}) — that build is not viable as written.`,
    );
  }
  const hoarders = personas.filter((p) => p.hoardRate >= 0.5 && p.persona !== 'afk');
  for (const p of hoarders) {
    findings.push(
      `"${p.persona}" ends ${Math.round(p.hoardRate * 100)}% of campaigns holding unspent resources — either its shopping list is exhausted or the economy over-supplies it.`,
    );
  }
  const dominant = Object.entries(lossesByBranch)
    .filter(([b]) => branchesObserved.includes(b))
    .sort((a, b) => b[1] - a[1])[0];
  if (dominant && branchesObserved.length >= 2) {
    const total = branchesObserved.reduce((sum, b) => sum + (lossesByBranch[b] ?? 0), 0);
    const share = Math.round((dominant[1] / Math.max(1, total)) * 100);
    if (share >= 75) {
      findings.push(
        `"${dominant[0]}" causes ${share}% of all branch-attributable losses across the sweep — the other implemented branch is not pulling its weight.`,
      );
    }
  }

  return {
    generatedAt,
    campaigns: analyses.length,
    personas,
    overall: {
      verdicts,
      signalPassRates: {
        oscillation: passRate((a) => a.signals.oscillation),
        balance: passRate((a) => a.signals.balance),
        scarcity: passRate((a) => a.signals.scarcity),
      },
      lossesByBranch,
      branchesObserved,
    },
    findings,
    instrumentationNotes: [
      'Enemy economy is NOT instrumented (no budget, per-branch spend, ROI or scrap in the log), so every statement about why the enemy shifted is INFERRED from the player-side loss mix — see the end of docs/SEESAW.md.',
      'Enemy branches beyond missiles and mines (torpedoes, boats, artillery, smoke, electronic attack) are not implemented, so their player counters are never exercised by this sweep.',
      'Bots are heuristics, not humans: they cannot judge readability, feel, or UI clarity. Use this sweep for balance/economy questions, not UX ones.',
    ],
  };
}
