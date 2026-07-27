// Enemy evolution: a procurement economy that mirrors the player's.
//
// This is the engine behind docs/SEESAW.md. Each round the enemy receives war
// funds, must COMMIT them at the start of the round, and SCRAPS whatever it
// cannot spend — it can never bank for a super-round. What it buys is decided
// by return on investment per branch:
//
//     ROI up   → buy more of that branch, and escalate within it
//     ROI down → cut its share and move the money to a branch the player is
//                not countering
//
// That single loop is the whole arms race. The player's counters are what push
// a branch's ROI down; the enemy's pivot is what creates the next threat. An
// exploration slice always probes the branch it has leaned on least, so it
// keeps hunting for the current blind spot instead of converging on one line.
//
// Anti-snowball works in BOTH directions (SEESAW.md): a dominating player arms
// the enemy faster, a struggling player faces damped growth — so neither end
// of the seesaw sticks.
//
// The enemy only ever spends on branches the simulation can actually field
// (see `implemented` in data/enemyBranches.ts). Budget is never burned on a
// threat that would not appear, which would quietly make the enemy weaker than
// its budget claims.

import { COMBAT, ENEMY_ECONOMY, EVOLUTION, ROUND1, SIM, SPAWN, WORLD } from '../data/tuning';
import {
  ENEMY_BRANCHES,
  ENEMY_BRANCH_ORDER,
  implementedNodes,
  tacticForRounds,
  TARGETING_DOCTRINE,
  type EnemyBranchKey,
  type EnemyNodeDef,
} from '../data/enemyBranches';
import type { RNG } from './rng';
import type {
  ArtilleryVariant,
  BranchLedger,
  CampaignState,
  EnemyEconomyState,
  EvolutionState,
  EvolutionTracks,
  ElectronicPlan,
  InstallationPlacement,
  IntelWarning,
  MinePlacement,
  RoundMetrics,
  RoundPlan,
  SmokePlacement,
  SpawnEvent,
  TechKey,
} from './types';

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

function newLedger(share: number): BranchLedger {
  return {
    spend: 0,
    units: {},
    scrap: 0,
    result: 0,
    roi: 0,
    kills: 0,
    roundsInvested: 0,
    share,
    lifetimeSpend: 0,
    lifetimeResult: 0,
  };
}

function newEconomy(): EnemyEconomyState {
  const ledgers: Record<string, BranchLedger> = {};
  for (const key of ENEMY_BRANCH_ORDER) {
    // Missiles start open and fully funded — it is the round-1 probe.
    ledgers[key] = newLedger(key === 'missiles' ? 1 : 0);
  }
  return {
    budget: 0,
    committed: 0,
    scrapped: 0,
    ledgers,
    openBranches: ['missiles'],
    targetingTier: 0,
    targetingDebut: null,
    nodesFielded: [],
    nodeDebuts: [],
    plannedForRound: 0,
  };
}

export function newEvolution(): EvolutionState {
  return {
    tracks: { saturation: 20, guidance: 0, mines: 0, lowSig: 0 },
    economy: newEconomy(),
    firstSeen: {},
    metrics: [],
    pendingWarnings: [],
    formationTell: null,
  };
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

/** War funds for `round`. Growth is the primary difficulty dial; the
 *  anti-snowball modifiers are the restoring force that keeps the seesaw from
 *  sticking at either end. */
function grantBudget(
  round: number,
  metrics: RoundMetrics | undefined,
  /** Consecutive rounds the player has just walked through untouched. */
  dominantStreak = 0,
): number {
  let budget = ENEMY_ECONOMY.budgetBase + ENEMY_ECONOMY.budgetPerRound * round;
  if (metrics) {
    let mult = 1;
    // Player dominating → arm the enemy faster.
    if (metrics.deliveredFraction >= 0.85) mult += ENEMY_ECONOMY.bonusStrongDelivery;
    if (metrics.interceptRate > 0.7) mult += ENEMY_ECONOMY.bonusHighIntercept;
    // A bigger, richer convoy is a bigger target and draws proportionally more
    // ordnance. Continuous, not a threshold: measured, the enemy used to fire
    // roughly the same number of missiles whatever sailed, so growing the
    // convoy from 6 hulls to 40 diluted incoming fire from 4.13 missiles per
    // hull to 0.85 and lifted delivery from 63% to 91%. Convoy size was quietly
    // the best defensive stat in the game — and it is also the SCORING stat, so
    // "buy more hulls" beat "buy defense" on both axes at once. That is why the
    // greed build outscored every build that actually fights, and why the
    // specialists, which sail small convoys into undiluted fire, could not get
    // out of the bottom of the table.
    const richness = metrics.valueSent / ENEMY_ECONOMY.convoyValueBaseline;
    mult += Math.max(
      ENEMY_ECONOMY.convoyScaleMin,
      Math.min(ENEMY_ECONOMY.convoyScaleMax, (richness - 1) * ENEMY_ECONOMY.convoyScalePerRatio),
    );
    // ...and faster the LONGER they have been walking through untouched. The
    // flat bonuses fire readily enough — strong delivery hit in 71% of rounds
    // across a sweep — but a fixed +12% never moved a build sitting at 94%
    // delivery, and 56% of all rounds finished above 90%. A pressure that only
    // grows while the player is dominating does: it keeps building until they
    // are back in the band, then stops on its own the round they drop into it.
    //
    // This is the mirror of ECONOMY.lossInsurance on the other end. One scales
    // with how badly the player is losing, the other with how long they have
    // been winning, and both release the moment the seesaw comes back to
    // centre — which is the whole restoring force SEESAW.md asks for.
    mult += Math.min(
      ENEMY_ECONOMY.dominanceStreakMax,
      ENEMY_ECONOMY.dominanceStreakStep * dominantStreak,
    );
    // Player struggling → damp growth so they can recover and re-counter.
    if (metrics.deliveredFraction < 0.55) mult -= ENEMY_ECONOMY.dampStruggling;
    budget *= Math.max(0.5, mult);
  }
  return Math.min(ENEMY_ECONOMY.budgetCap, Math.round(budget));
}

// ---------------------------------------------------------------------------
// ROI settlement
// ---------------------------------------------------------------------------

/** Score what each branch achieved with last round's money. This is the
 *  measurement that makes the allocator adaptive rather than scripted. */
function settleRoi(economy: EnemyEconomyState, metrics: RoundMetrics): void {
  const results = metrics.branchResults ?? {};
  for (const key of ENEMY_BRANCH_ORDER) {
    const ledger = economy.ledgers[key];
    const outcome = results[key];
    ledger.result = outcome?.result ?? 0;
    ledger.kills = outcome?.kills ?? 0;
    if (ledger.spend > 0) {
      // Score against the branch's WHOLE record, not just the round that just
      // ended. A branch buying thousands of cheap missiles has a smooth ROI; a
      // branch buying one 180-cost shore gun has a violently lumpy one, and a
      // single unlucky round reads as failure. Judged per-round the allocator
      // systematically defunds anything expensive — measured, artillery earned
      // the best cost-per-result of all seven branches and still had its
      // allowance cut to ~44 in the round its second gun unlocked at 285, so it
      // never fielded one. Accumulating both sides of the ratio lets a lumpy
      // branch be judged on its average rather than on its variance.
      ledger.lifetimeSpend += ledger.spend;
      ledger.lifetimeResult += ledger.result;
      ledger.roi = ledger.lifetimeResult / ledger.lifetimeSpend;
    } else if (!economy.openBranches.includes(key)) {
      // Genuinely untried: the neutral prior keeps a first attempt worthwhile.
      ledger.roi = ENEMY_ECONOMY.priorRoi;
    }
    // An OPEN branch that spent nothing this round keeps the ROI it earned.
    // Resetting it to the prior here let a failing branch launder its record:
    // one round too poor to afford a single unit and it came back looking as
    // promising as something never tried, so the allocator kept refunding the
    // thing the player had already beaten.
  }
}

// ---------------------------------------------------------------------------
// Allocation
// ---------------------------------------------------------------------------

/** Branches the enemy may fund this round: already open, or openable now. */
function candidateBranches(economy: EnemyEconomyState, round: number): EnemyBranchKey[] {
  return ENEMY_BRANCH_ORDER.filter((key) => {
    const def = ENEMY_BRANCHES[key];
    if (!def.implemented) return false; // never fund what cannot be fielded
    if (economy.openBranches.includes(key)) return true;
    if (round < def.openRound) return false;
    // Must have at least one node past its gate to be worth opening.
    return implementedNodes(key).some((n) => round >= n.gateRound);
  });
}

/** Blend each branch's share toward what ROI says it deserves. The lag is
 *  deliberate: a pivot should be visible over 1-2 rounds, not instant. */
function allocate(economy: EnemyEconomyState, round: number, rng: RNG): void {
  const candidates = candidateBranches(economy, round);
  if (candidates.length === 0) return;

  // Target shares proportional to ROI.
  const roiOf = (key: EnemyBranchKey): number => {
    const ledger = economy.ledgers[key];
    // An unopened branch has no history; use the prior so it can be probed.
    if (!economy.openBranches.includes(key)) return ENEMY_ECONOMY.priorRoi;
    return Math.max(0.01, ledger.roi);
  };
  const totalRoi = candidates.reduce((sum, key) => sum + roiOf(key), 0);

  for (const key of ENEMY_BRANCH_ORDER) {
    const ledger = economy.ledgers[key];
    if (!candidates.includes(key)) {
      ledger.share = 0;
      continue;
    }
    const target = roiOf(key) / totalRoi;
    const lag = ENEMY_ECONOMY.allocationLag;
    ledger.share = ledger.share * (1 - lag) + target * lag;
    // Nothing is ever permanently abandoned — a cut branch stays alive at a
    // floor so it can become attractive again once the player moves on.
    ledger.share = Math.max(ENEMY_ECONOMY.minBranchShare, ledger.share);
  }

  // Exploration: push a slice toward whichever candidate has been funded least
  // recently, so the enemy keeps probing for the player's blind spot.
  if (candidates.length > 1) {
    const leastInvested = candidates.reduce((best, key) =>
      economy.ledgers[key].roundsInvested < economy.ledgers[best].roundsInvested ? key : best,
    );
    economy.ledgers[leastInvested].share += ENEMY_ECONOMY.explorationShare;
    // A touch of noise so repeated identical states don't lock into a rut.
    economy.ledgers[rng.pick(candidates)].share += rng.range(0, 0.05);
  }

  // Normalize across candidates.
  const total = candidates.reduce((sum, key) => sum + economy.ledgers[key].share, 0) || 1;
  for (const key of candidates) economy.ledgers[key].share /= total;
}

// ---------------------------------------------------------------------------
// Purchasing
// ---------------------------------------------------------------------------

/** Which nodes of a branch may be fielded this round. */
function availableNodes(key: EnemyBranchKey, round: number): EnemyNodeDef[] {
  return implementedNodes(key).filter((n) => round >= n.gateRound);
}

/** How much of a branch's money goes to its NEWEST available node. Rises with
 *  sustained investment (a branch the player ignores deepens) and rises again
 *  when the player is hard-countering the current node — that is the node
 *  ladder answering the counter. */
function escalationShare(
  economy: EnemyEconomyState,
  key: EnemyBranchKey,
  metrics: RoundMetrics | undefined,
): number {
  const ledger = economy.ledgers[key];
  // Tenure alone deepens a branch, up to the ordinary ceiling.
  const share = Math.min(
    ENEMY_ECONOMY.escalationShareMax,
    ENEMY_ECONOMY.escalationShareBase +
      ENEMY_ECONOMY.escalationSharePerRound * ledger.roundsInvested,
  );
  if (!metrics || !isHardCountered(key, metrics)) return share;
  // Being hard-countered pushes PAST the tenure ceiling. The bonus has to be
  // applied after that clamp, not before it: any branch the enemy has invested
  // in for ~6 rounds is already pinned at escalationShareMax, so folding the
  // bonus in first made the player's counter produce no answer at all.
  return Math.min(
    ENEMY_ECONOMY.escalationShareCounteredMax,
    share + ENEMY_ECONOMY.counteredEscalationBonus,
  );
}

/** Is the player reliably beating this branch's current node? That is the cue
 *  to climb the node ladder rather than simply buy more of what is failing. */
function isHardCountered(key: EnemyBranchKey, metrics: RoundMetrics): boolean {
  switch (key) {
    // Missiles being shot down reliably → guided/harder variants.
    case 'missiles':
      return metrics.interceptRate > 0.6;
    // Mines being charted reliably → low-signature casings.
    case 'mines':
      return metrics.mineDetectRate >= 0 && metrics.mineDetectRate > 0.5;
    // Torpedoes being heard and killed → wakeless, quieter runs.
    case 'torpedoes':
      return metrics.torpedoDetectRate >= 0 && metrics.torpedoDetectRate > 0.5;
    default:
      return false;
  }
}

interface Purchase {
  branch: EnemyBranchKey;
  node: EnemyNodeDef;
  units: number;
}

/** Convert this round's budget into concrete attacks. Spend-or-scrap: what
 *  cannot be turned into whole units is wasted, so over-buying a countered
 *  branch is a real loss for the enemy — which is exactly what should push it
 *  to pivot. */
function purchase(
  economy: EnemyEconomyState,
  round: number,
  metrics: RoundMetrics | undefined,
  rng: RNG,
): Purchase[] {
  const purchases: Purchase[] = [];
  const budget = economy.budget;
  let scrapped = 0;
  let committed = 0;

  // Reset per-round ledger fields (shares and roundsInvested persist).
  for (const key of ENEMY_BRANCH_ORDER) {
    const ledger = economy.ledgers[key];
    ledger.spend = 0;
    ledger.units = {};
    ledger.scrap = 0;
  }
  economy.nodeDebuts = [];

  const candidates = candidateBranches(economy, round);
  // Two passes: the first spends each branch's share, the second re-offers
  // whatever came back (unaffordable opens, unit ceilings) to branches that
  // can still use it — the enemy is thrifty before it is wasteful.
  let pool = 0;

  const spendOn = (key: EnemyBranchKey, allowance: number): number => {
    const def = ENEMY_BRANCHES[key];
    const ledger = economy.ledgers[key];
    let remaining = allowance;

    // Opening a new front costs a one-off fee.
    if (!economy.openBranches.includes(key)) {
      if (remaining < def.openCost) return remaining; // can't afford: hand it back
      remaining -= def.openCost;
      committed += def.openCost;
      ledger.spend += def.openCost;
      economy.openBranches.push(key);
    }

    const nodes = availableNodes(key, round);
    if (nodes.length === 0) return remaining;

    // Volume rung: sustained investment buys more of whatever it fields.
    const tactic = tacticForRounds(key, ledger.roundsInvested);
    const unitCeiling = Math.max(1, Math.round(def.maxUnitsPerRound * Math.min(1, tactic.volumeMult / 1.95)));
    let unitsBought = Object.values(ledger.units).reduce((a, b) => a + b, 0);

    const newest = nodes[nodes.length - 1];
    const buy = (node: EnemyNodeDef, allowanceForNode: number): number => {
      if (unitsBought >= unitCeiling) return allowanceForNode;
      let units = Math.floor(allowanceForNode / node.cost);
      if (units <= 0) return allowanceForNode;
      // First appearance is capped so a debut is a beat, not an ambush.
      if (!economy.nodesFielded.includes(node.id)) {
        units = Math.min(units, node.firstAppearanceCap);
      }
      units = Math.min(units, unitCeiling - unitsBought);
      if (units <= 0) return allowanceForNode;

      const cost = units * node.cost;
      ledger.units[node.id] = (ledger.units[node.id] ?? 0) + units;
      ledger.spend += cost;
      committed += cost;
      unitsBought += units;
      purchases.push({ branch: key, node, units });

      if (!economy.nodesFielded.includes(node.id)) {
        economy.nodesFielded.push(node.id);
        economy.nodeDebuts.push(node.id);
        // Fielding a node can unlock the next rung of the shared targeting
        // ladder — a broader arsenal aims smarter, not just louder.
        if (node.grantsTargeting !== undefined && node.grantsTargeting > economy.targetingTier) {
          economy.targetingTier = node.grantsTargeting;
          economy.targetingDebut = node.grantsTargeting;
        }
      }
      return allowanceForNode - cost;
    };

    // Escalate into the best variant the earmark can reach, then pour the rest
    // into volume.
    if (nodes.length > 1) {
      const escShare = escalationShare(economy, key, metrics);
      let earmark = Math.floor(remaining * escShare);
      // The escalation budget is a statement of INTENT, not a hard ceiling. A
      // fraction of an allowance that cannot cover one unit of the next node
      // buys nothing and rounds to zero — and because that is a property of the
      // node's PRICE rather than of the round, the branch could never escalate
      // at all. Seven implemented nodes went unbought across a whole sweep for
      // exactly this reason. Two separate rules lift the earmark to a whole
      // unit, and they exist for genuinely different purposes.
      //
      // ONE — the player's counter. A branch being reliably beaten leans into
      // its newest variant every round it can afford to, which is the whole
      // point of the node ladder: answer the counter, don't buy more of what is
      // already failing. This is the rule the escalation tests measure.
      if (
        metrics &&
        isHardCountered(key, metrics) &&
        earmark < newest.cost &&
        remaining >= newest.cost
      ) {
        earmark = newest.cost;
      }
      // TWO — reachability. A rung the enemy has NEVER fielded gets one debut
      // once it has gone begging for escalationPatienceRounds, whatever the
      // player is doing, so no implemented node is dead content at any budget.
      // Both restrictions on it are load-bearing: buying a debut rather than
      // volume, and waiting rather than firing the round the node gates. Drop
      // either and the countered and ignored arms buy identical ladders — the
      // signal from rule one disappears underneath it.
      //
      // The rung aimed at is the CHEAPEST never-fielded one, not the newest.
      // Reaching straight for the top leaves the middle of every ladder dead:
      // by the time a branch can afford anything above its base, the top rung
      // has gated in and takes the money every time.
      const step = nodes
        .slice(1)
        .filter(
          (n) =>
            !economy.nodesFielded.includes(n.id) &&
            round - n.gateRound >= ENEMY_ECONOMY.escalationPatienceRounds,
        )
        .sort((a, b) => a.cost - b.cost)[0];
      if (step && earmark < step.cost && remaining >= step.cost) earmark = step.cost;
      const before = earmark;
      // Walk DOWN the ladder with the escalation money. Without this the middle
      // rungs are dead the moment the top one gates in: the newest node takes
      // the earmark, and everything the earmark could not afford falls through
      // to the cheapest node, which soaks the allowance on volume before any
      // mid-tier variant is ever offered.
      for (let i = nodes.length - 1; i >= 1 && earmark > 0; i--) {
        earmark = buy(nodes[i], earmark);
      }
      remaining = earmark + (remaining - before);
    }
    return buy(nodes[0], remaining);
  };

  for (const key of candidates) {
    pool += spendOn(key, Math.floor(budget * economy.ledgers[key].share));
  }
  // Second pass: re-offer the leftovers to already-open branches.
  for (const key of candidates) {
    if (pool <= 0) break;
    if (!economy.openBranches.includes(key)) continue;
    pool = spendOn(key, pool);
  }
  scrapped = Math.max(0, pool);

  // Scripted debuts guarantee the designed early beats regardless of what ROI
  // would otherwise prefer (guided by R2, mines by R3).
  for (const scripted of ENEMY_ECONOMY.scriptedDebuts) {
    if (scripted.round !== round) continue;
    const key = scripted.branch as EnemyBranchKey;
    const def = ENEMY_BRANCHES[key];
    if (!def.implemented) continue;
    const node = def.nodes.find((n) => n.id === scripted.node);
    if (!node || !node.implemented) continue;
    const ledger = economy.ledgers[key];
    const have = ledger.units[node.id] ?? 0;
    if (have >= scripted.minUnits) continue;
    const extra = scripted.minUnits - have;
    if (!economy.openBranches.includes(key)) economy.openBranches.push(key);
    ledger.units[node.id] = have + extra;
    ledger.spend += extra * node.cost;
    committed += extra * node.cost;
    const existing = purchases.find((p) => p.branch === key && p.node.id === node.id);
    if (existing) existing.units += extra;
    else purchases.push({ branch: key, node, units: extra });
    if (!economy.nodesFielded.includes(node.id)) {
      economy.nodesFielded.push(node.id);
      economy.nodeDebuts.push(node.id);
      if (node.grantsTargeting !== undefined && node.grantsTargeting > economy.targetingTier) {
        economy.targetingTier = node.grantsTargeting;
        economy.targetingDebut = node.grantsTargeting;
      }
    }
  }

  // Track sustained investment (drives tactic rungs and escalation).
  for (const key of ENEMY_BRANCH_ORDER) {
    const ledger = economy.ledgers[key];
    if (ledger.spend > 0) ledger.roundsInvested++;
    else ledger.roundsInvested = 0;
    ledger.scrap = 0;
  }
  // Attribute the unspendable remainder to the branch that had the largest
  // share — it is that branch's over-buy that could not be converted.
  const biggest = candidates.reduce(
    (best, key) => (economy.ledgers[key].share > economy.ledgers[best]?.share ? key : best),
    candidates[0],
  );
  if (biggest) economy.ledgers[biggest].scrap = scrapped;

  economy.committed = committed;
  economy.scrapped = scrapped;
  economy.plannedForRound = round;
  void rng;
  return purchases;
}

// ---------------------------------------------------------------------------
// Legacy doctrine tracks (derived read-out)
// ---------------------------------------------------------------------------

/** The old four-track model, recomputed from cumulative spend. Nothing reads
 *  these to make decisions any more — they exist so saved games, the AAR and
 *  existing telemetry consumers keep working. */
function deriveTracks(economy: EnemyEconomyState, prev: EvolutionTracks): EvolutionTracks {
  const missiles = economy.ledgers.missiles;
  const mines = economy.ledgers.mines;
  const unitsOf = (ledger: BranchLedger, node: string): number => ledger.units[node] ?? 0;
  return {
    saturation: prev.saturation + missiles.spend * 0.08,
    guidance: prev.guidance + unitsOf(missiles, 'guided') * 6,
    mines: prev.mines + mines.spend * 0.3,
    lowSig: prev.lowSig + unitsOf(mines, 'lowSig') * 8,
  };
}

// ---------------------------------------------------------------------------
// Learning: called once per resolved round, before planning the next one.
// ---------------------------------------------------------------------------

export function evolveEnemy(evo: EvolutionState, metrics: RoundMetrics, rng: RNG): void {
  evo.metrics.push(metrics);
  const economy = evo.economy;
  const nextRound = metrics.round + 1;

  // 1. Score what last round's money achieved.
  settleRoi(economy, metrics);

  // 2. Formation still shapes doctrine — and the player is told about it.
  const last3 = evo.metrics.slice(-3);
  const tightRounds = last3.filter((m) => m.formation === 'tight').length;
  const wideRounds = last3.filter((m) => m.formation === 'wide').length;
  evo.formationTell = null;
  if (tightRounds >= 2) {
    // Dense formations invite area-denial weapons.
    economy.ledgers.mines.share += 0.15;
    evo.formationTell =
      'Your convoys have been sailing a tight column. The enemy is exploiting it — expect heavier investment in mines and area-denial to punish the packed formation.';
  } else if (wideRounds >= 2) {
    // A dispersed stream is harder to blanket — answer with volume.
    economy.ledgers.missiles.share += 0.15;
    evo.formationTell =
      'Your convoys have been running wide and dispersed. The enemy is answering with volume — expect larger missile salvos to blanket the spread-out stream.';
  }

  // 3. Grant next round's budget, re-allocate on ROI, and commit it.
  economy.targetingDebut = null;
  // How many rounds in a row the player has just dominated. Counted off the
  // metrics history rather than carried as campaign state, so it stays a pure
  // read of what actually happened and needs no save migration.
  let dominantStreak = 0;
  for (let i = evo.metrics.length - 1; i >= 0; i--) {
    if (evo.metrics[i].deliveredFraction < ENEMY_ECONOMY.dominanceFraction) break;
    dominantStreak++;
  }
  economy.budget = grantBudget(nextRound, metrics, dominantStreak);
  allocate(economy, nextRound, rng);
  purchase(economy, nextRound, metrics, rng);

  // 4. Keep the legacy track read-out current.
  evo.tracks = deriveTracks(economy, evo.tracks);

  // 5. Warn about what is coming.
  evo.pendingWarnings = buildWarnings(evo, nextRound, rng);
}

/** Intel forecasts: warn about node gates that are about to open, and about
 *  capabilities already bought but not yet met. */
function buildWarnings(evo: EvolutionState, nextRound: number, rng: RNG): IntelWarning[] {
  const warnings: IntelWarning[] = [];
  const economy = evo.economy;
  for (const key of ENEMY_BRANCH_ORDER) {
    const def = ENEMY_BRANCHES[key];
    if (!def.implemented) continue;
    for (const node of def.nodes) {
      if (!node.implemented || !node.warning) continue;
      // Skip only what the player has actually ENCOUNTERED. A node the enemy
      // has just bought for next round is precisely what a forecast is for —
      // gating on "already purchased" would suppress every warning, since
      // procurement for the coming round runs before warnings are built.
      const met = node.techKey
        ? evo.firstSeen[node.techKey as TechKey] !== undefined
        : economy.nodesFielded.includes(node.id);
      if (met) continue;
      const roundsAway = node.gateRound - nextRound;
      if (roundsAway > ENEMY_ECONOMY.warningLeadRounds || roundsAway < 0) continue;
      warnings.push({
        track: key === 'mines' ? 'mines' : 'guidance',
        text: node.warning,
        confidencePct: Math.round(60 + (1 - roundsAway) * 20 + rng.range(0, 10)),
      });
    }
  }
  return warnings;
}

/** Make sure the enemy has actually bought something for `round`.
 *
 *  Normally `evolveEnemy` commits next round's budget at the end of the
 *  previous one. A campaign SAVED BEFORE the economy existed has no purchases
 *  at all, so resuming it would otherwise sail into an empty strait. This runs
 *  the budget → allocate → buy cycle on the spot for such a round. */
export function ensureProcurement(evo: EvolutionState, round: number, rng: RNG): void {
  const economy = evo.economy;
  if (economy.plannedForRound === round) return;
  const last = evo.metrics[evo.metrics.length - 1];
  economy.targetingDebut = null;
  economy.budget = grantBudget(round, last);
  allocate(economy, round, rng);
  purchase(economy, round, last, rng);
  evo.tracks = deriveTracks(economy, evo.tracks);
}

// ---------------------------------------------------------------------------
// Planning: turn the purchased attacks into a concrete round plan.
// ---------------------------------------------------------------------------

export function planRound(campaign: CampaignState, rng: RNG): RoundPlan {
  const round = campaign.round;
  const evo = campaign.evolution;
  const economy = evo.economy;
  const debuts: TechKey[] = [];
  const shipsOut = Object.values(campaign.composition).reduce((a, b) => a + b, 0);

  // Fire window spans the whole transit: from windowStartT until the last ship
  // (which enters at ~shipsOut * spawn interval) has had time to cross. Missiles
  // are spread across this whole span, so there is never a long silent gap at
  // the end while ships are still in the strait.
  const windowEnd = Math.min(
    SIM.maxTransitTime - 20,
    SPAWN.firstDelay + shipsOut * SPAWN.interval + EVOLUTION.windowTailT,
  );

  if (round === 1) {
    // Scripted onboarding: a light unguided probe, spread across the transit.
    return {
      round,
      spawns: scheduleMissiles(ROUND1.missileCount, 1, rng, 'missile', EVOLUTION.windowStartT, windowEnd),
      mines: [],
      installations: [],
      smoke: [],
      electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 0 },
      debuts: ['missile'],
    };
  }

  // A resumed pre-economy save has no committed purchases; buy for this round
  // before materializing it, so the strait is never silently empty.
  ensureProcurement(evo, round, rng);

  // --- Missiles --------------------------------------------------------------
  const missileLedger = economy.ledgers.missiles;
  const basicCount = missileLedger.units.unguided ?? 0;
  const guidedCount = missileLedger.units.guided ?? 0;
  // The tactic rung sets how tightly launches cluster into volleys.
  const missileTactic = tacticForRounds('missiles', missileLedger.roundsInvested);
  const volleySize = Math.max(1, Math.round(missileTactic.volumeMult * 1.6));

  // Schedule the whole missile buy ONCE and assign guidance across the result,
  // the way torpedo and boat variants are assigned. Scheduling the two kinds
  // separately gave both calls the same span and volley count, so their slot
  // centres coincided and launches arrived in correlated pairs — half the
  // events the enemy paid for, and gaps twice as long as intended between them.
  const spawns = scheduleMissiles(
    basicCount + guidedCount,
    volleySize,
    rng,
    'missile',
    EVOLUTION.windowStartT,
    windowEnd,
  );
  // Spread the guided rounds through the run rather than front- or back-loading
  // them, so the harder variant is not all survivable in one stretch.
  if (guidedCount > 0 && spawns.length > 0) {
    const stride = spawns.length / guidedCount;
    for (let i = 0; i < guidedCount; i++) {
      const at = Math.min(spawns.length - 1, Math.floor(i * stride));
      spawns[at].kind = 'guidedMissile';
    }
  }
  if (guidedCount > 0 && evo.firstSeen.guidedMissile === undefined) debuts.push('guidedMissile');

  // --- Mines -----------------------------------------------------------------
  const mineLedger = economy.ledgers.mines;
  const standardMines = mineLedger.units.standard ?? 0;
  const lowSigMines = mineLedger.units.lowSig ?? 0;
  const mineCount = standardMines + lowSigMines;
  const mines: MinePlacement[] = [];
  if (mineCount > 0) {
    if (evo.firstSeen.mine === undefined) debuts.push('mine');
    if (lowSigMines > 0 && evo.firstSeen.lowSigMine === undefined) debuts.push('lowSigMine');

    // One cluster for small fields, two for larger ones. The FIRST minefield
    // is always laid in the main shipping channel (the convoy's default lane)
    // so the debut is actually encountered; later fields spread randomly.
    const clusters = mineCount > 6 ? 2 : 1;
    const laneChoices =
      evo.firstSeen.mine === undefined
        ? [1]
        : rng.shuffle([...WORLD.lanes.keys()]).slice(0, clusters);
    for (let i = 0; i < mineCount; i++) {
      const lane = laneChoices[i % clusters];
      const cx = rng.range(850, 1450);
      mines.push({
        x: cx + rng.range(-130, 130),
        y: WORLD.lanes[lane] + rng.range(-75, 75),
        lowSig: i < lowSigMines,
      });
    }
  }

  // --- Torpedoes -------------------------------------------------------------
  // The underwater branch: launched from the shore across the transit window,
  // scheduled on the same queue as missiles so there is one timing path.
  const torpedoLedger = economy.ledgers.torpedoes;
  const straight = torpedoLedger.units.straight ?? 0;
  const homing = torpedoLedger.units.homing ?? 0;
  const lowSigTorpedoes = torpedoLedger.units.lowSigTorpedo ?? 0;
  const torpedoTotal = straight + homing + lowSigTorpedoes;
  if (torpedoTotal > 0) {
    if (evo.firstSeen.torpedo === undefined) debuts.push('torpedo');
    if (lowSigTorpedoes > 0 && evo.firstSeen.lowSigTorpedo === undefined) {
      debuts.push('lowSigTorpedo');
    }
    const torpedoTactic = tacticForRounds('torpedoes', torpedoLedger.roundsInvested);
    // Volley size rises with the tactic rung: single runs become salvos.
    const volley = Math.max(1, Math.round(torpedoTactic.volumeMult));
    const scheduled = scheduleMissiles(
      torpedoTotal,
      volley,
      rng,
      'torpedo',
      EVOLUTION.windowStartT,
      windowEnd,
    );
    // Assign variants across the scheduled runs: low-signature first (they are
    // the scarcest and nastiest), then homing, then straight runners.
    scheduled.forEach((event, i) => {
      if (i < lowSigTorpedoes) {
        event.lowSig = true;
        event.homing = true; // the low-sig node is a homing torpedo minus the wake
      } else if (i < lowSigTorpedoes + homing) {
        event.homing = true;
      }
    });
    spawns.push(...scheduled);
  }

  // --- Attack boats ----------------------------------------------------------
  // The surface branch. Boats are persistent units, so they are scheduled EARLY
  // in the window rather than spread across it: a boat that puts to sea at the
  // very end of a transit never reaches anyone, which would quietly refund the
  // enemy's most expensive purchase. Waves (the tactic ladder) are modelled as
  // tighter clustering, not as more boats — the unit count is what was bought.
  const boatLedger = economy.ledgers.attackBoats;
  const smallArmsBoats = boatLedger.units.smallArms ?? 0;
  const rocketBoats = boatLedger.units.rocket ?? 0;
  const boardingBoats = boatLedger.units.boarding ?? 0;
  const boatTotal = smallArmsBoats + rocketBoats + boardingBoats;
  if (boatTotal > 0) {
    if (evo.firstSeen.attackBoat === undefined) debuts.push('attackBoat');
    if (rocketBoats > 0 && evo.firstSeen.rocketBoat === undefined) debuts.push('rocketBoat');
    if (boardingBoats > 0 && evo.firstSeen.boardingBoat === undefined) debuts.push('boardingBoat');
    const boatTactic = tacticForRounds('attackBoats', boatLedger.roundsInvested);
    const waveSize = Math.max(1, Math.round(boatTactic.volumeMult));
    // Boats need most of the transit to close, engage and re-target, so the
    // launch window is only the first part of the run.
    const boatWindowEnd = EVOLUTION.windowStartT + (windowEnd - EVOLUTION.windowStartT) * 0.45;
    const scheduled = scheduleMissiles(
      boatTotal,
      waveSize,
      rng,
      'attackBoat',
      EVOLUTION.windowStartT,
      boatWindowEnd,
    );
    // Nastiest first, same as torpedoes: boarding parties, then rocket racks,
    // then small-arms craft.
    scheduled.forEach((event, i) => {
      if (i < boardingBoats) event.boatVariant = 'boarding';
      else if (i < boardingBoats + rocketBoats) event.boatVariant = 'rocket';
      else event.boatVariant = 'smallArms';
    });
    spawns.push(...scheduled);
  }

  // --- Artillery -------------------------------------------------------------
  // Shore guns are EMPLACED, not launched: they are placed along the hostile
  // shore before the round and shoot for as long as they survive. Position is
  // the whole decision — a gun only reaches the lanes inside its range, so
  // where it sits determines which water is dangerous.
  const gunLedger = economy.ledgers.artillery;
  const coastalGuns = gunLedger.units.coastalGun ?? 0;
  const rangingGuns = gunLedger.units.ranging ?? 0;
  const barrageGuns = gunLedger.units.rollingBarrage ?? 0;
  const installations: InstallationPlacement[] = [];
  if (coastalGuns + rangingGuns + barrageGuns > 0) {
    if (evo.firstSeen.artillery === undefined) debuts.push('artillery');
    if (rangingGuns > 0 && evo.firstSeen.rangingArtillery === undefined) {
      debuts.push('rangingArtillery');
    }
    if (barrageGuns > 0 && evo.firstSeen.rollingBarrage === undefined) {
      debuts.push('rollingBarrage');
    }
    const variants: ArtilleryVariant[] = [
      ...Array<ArtilleryVariant>(barrageGuns).fill('rollingBarrage'),
      ...Array<ArtilleryVariant>(rangingGuns).fill('ranging'),
      ...Array<ArtilleryVariant>(coastalGuns).fill('coastalGun'),
    ];
    // Spread the emplacements along the shore rather than stacking them, so
    // the guns threaten different stretches of the crossing and routing round
    // one does not walk into another.
    const span = EVOLUTION.gunFieldEndX - EVOLUTION.gunFieldStartX;
    variants.forEach((variant, i) => {
      const slot = span / variants.length;
      installations.push({
        x: EVOLUTION.gunFieldStartX + i * slot + rng.range(slot * 0.15, slot * 0.85),
        y: WORLD.launchSites[0].y + rng.range(-14, 18),
        variant,
      });
    });
  }

  // --- Smoke -----------------------------------------------------------------
  // Concealment, not damage. Screening clouds go up over the launch sites so a
  // salvo is already in the air before the player can point at it; blinding
  // clouds go up over the convoy itself. Both are scheduled across the window
  // rather than at the start — smoke that is already burning when the round
  // opens has stolen nothing.
  const smokeLedger = economy.ledgers.smoke;
  const screening = smokeLedger.units.screening ?? 0;
  const blinding = smokeLedger.units.blinding ?? 0;
  const smoke: SmokePlacement[] = [];
  if (screening + blinding > 0) {
    if (evo.firstSeen.screeningSmoke === undefined && screening > 0) debuts.push('screeningSmoke');
    if (evo.firstSeen.blindingSmoke === undefined && blinding > 0) debuts.push('blindingSmoke');
    const total = screening + blinding;
    const span = windowEnd - EVOLUTION.windowStartT;
    for (let i = 0; i < total; i++) {
      const at = EVOLUTION.windowStartT + (span * (i + 0.3)) / (total + 0.6) + rng.range(-6, 6);
      if (i < blinding) {
        // Blinding smoke resolves its center when it is laid, over whatever the
        // convoy is doing then — so it always lands on ships, not on old water.
        smoke.push({ variant: 'blinding', time: at });
      } else {
        // Screen the launch site that is actually BUSY around this time. A
        // cloud over an idle site screens nothing — the missiles simply come
        // from one of the other two and the enemy has paid for scenery.
        const near = spawns.filter((sp) => Math.abs(sp.time - at) < 25);
        const busiest = (near.length > 0 ? near : spawns).reduce<Record<number, number>>(
          (acc, sp) => ({ ...acc, [sp.siteX]: (acc[sp.siteX] ?? 0) + 1 }),
          {},
        );
        const siteX = Object.keys(busiest).length
          ? Number(Object.entries(busiest).sort((a, b) => b[1] - a[1])[0][0])
          : rng.pick(WORLD.launchSites).x;
        smoke.push({
          variant: 'screening',
          time: at,
          x: siteX + rng.range(-50, 50),
          y: WORLD.launchSites[0].y + COMBAT.enemySmoke.screeningOffsetY,
        });
      }
    }
  }

  // --- Electronic attack -----------------------------------------------------
  const eaLedger = economy.ledgers.electronic;
  const electronic: ElectronicPlan = {
    reconPlanes: eaLedger.units.reconPlane ?? 0,
    disablingDrones: eaLedger.units.disablingDrone ?? 0,
    jamming: eaLedger.units.sensorJamming ?? 0,
  };
  if (electronic.reconPlanes > 0 && evo.firstSeen.reconPlane === undefined) {
    debuts.push('reconPlane');
  }
  if (electronic.disablingDrones > 0 && evo.firstSeen.disablingDrone === undefined) {
    debuts.push('disablingDrone');
  }
  if (electronic.jamming > 0 && evo.firstSeen.sensorJamming === undefined) {
    debuts.push('sensorJamming');
  }

  return { round, spawns, mines, installations, smoke, electronic, debuts };
}

/** Spread `count` missile launches across [windowStart, windowEnd] in volleys
 *  of the given size, jittered so they never arrive on a metronome. */
function scheduleMissiles(
  count: number,
  volleySize: number,
  rng: RNG,
  kind: 'missile' | 'guidedMissile' | 'torpedo' | 'attackBoat',
  windowStart: number,
  windowEnd: number,
): SpawnEvent[] {
  const spawns: SpawnEvent[] = [];
  if (count <= 0) return spawns;
  const size = Math.max(1, volleySize);
  const span = Math.max(0, windowEnd - windowStart);
  // Note on what maxVolleyGap can and cannot promise: there is never more than
  // one volley per round fired, so with low volume the best achievable spacing
  // is span/count no matter what the ceiling says. The fire still spreads
  // across the WHOLE window rather than concentrating — a dense opening
  // followed by a silent run-in is precisely the dead-air this scheduler
  // exists to avoid, and ships are still crossing at the end of the round.
  // Number of volley EVENTS: enough to honor the volley size, but also enough
  // that no slot is wider than maxVolleyGap — so a large volley size can't
  // collapse fire into a few widely-spaced bursts. Capped at one-per-missile.
  const volleys = Math.max(
    1,
    Math.min(
      count,
      Math.max(Math.ceil(count / size), Math.ceil(span / EVOLUTION.maxVolleyGap)),
    ),
  );
  const slot = span / volleys;
  // Jitter is a FRACTION of the slot, not the whole of it. Jittering across a
  // full slot lets neighbouring volleys land at opposite ends of adjacent
  // slots, so the worst-case gap was twice the slot width and the maxVolleyGap
  // ceiling above was not actually a ceiling.
  const jitter = slot * 0.45;
  // Distribute the missiles across the volleys as evenly as possible.
  const base = Math.floor(count / volleys);
  const extra = count % volleys;
  for (let v = 0; v < volleys; v++) {
    // Grid position, jittered around the middle of its own slot.
    const volleyTime =
      windowStart + v * slot + slot / 2 + rng.range(-jitter / 2, jitter / 2);
    const site = rng.pick(WORLD.launchSites);
    const inVolley = base + (v < extra ? 1 : 0);
    for (let i = 0; i < inVolley; i++) {
      spawns.push({
        time: volleyTime + rng.range(0, 1.4),
        kind,
        siteX: site.x + rng.range(-60, 60),
      });
    }
  }
  return spawns;
}

// ---------------------------------------------------------------------------
// Read-outs for UI / telemetry
// ---------------------------------------------------------------------------

/** The enemy's current targeting doctrine, as a 0-1 "skill" the transit sim
 *  already understands. The doctrine LADDER is richer than one scalar — the
 *  higher rungs (nearest-to-shore, high-value, isolation, deny-the-delivery)
 *  arrive with the branches that grant them, since each needs its own
 *  behaviour. Until then a tier maps onto how sharply the enemy prefers close,
 *  wounded targets, which is what T1/T3 describe. */
export function targetingSkill(economy: EnemyEconomyState): number {
  const tier = economy.targetingTier;
  // A newly unlocked tier runs at reduced weight for one round (fairness rule).
  const effective = economy.targetingDebut === tier ? Math.max(0, tier - 0.5) : tier;
  return Math.max(0, Math.min(1, effective / 4));
}

/** Human-readable name of the enemy's current doctrine rung. */
export function targetingName(economy: EnemyEconomyState): string {
  return TARGETING_DOCTRINE[economy.targetingTier]?.name ?? 'Unaimed spread';
}
