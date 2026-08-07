// Playtest fidelity — the probe panel and the comparison rules.
//
// The question this file answers is NOT "is the balance working" (that is
// `analyze.ts`) but "is the sweep measuring the same game the playtester is
// sitting in front of". Every balance conclusion the sweep reaches is
// conditional on the bots exercising the same systems a human does, and that
// condition decays silently every time a mechanic is added to the game and not
// to the personas.
//
// This works without any new instrumentation because both halves of playtesting
// already emit the SAME artifact — a `TelemetryExport`. The in-game "Download
// game log" button and `npm run playtest` produce identical shapes, so a
// hand-played session and a bot campaign are directly comparable.
//
// Pure and DOM-free, like `analyze.ts`: `fidelity.ts` is the I/O shell around
// it. Keep it that way — the probe panel is the part that has to stay testable
// as mechanics land.

import { REGIONS } from '../../src/data/regions';

// ---------------------------------------------------------------------------
// Log shape
// ---------------------------------------------------------------------------

// Deliberately structural rather than importing TelemetryExport: this tool has
// to be able to read an OLDER log a playtester saved weeks ago, whose shape may
// predate the current type. Every field below is read defensively.
export type Log = {
  formatVersion?: number;
  regionId?: string;
  commanderAbilities?: string[];
  runOutcome?: string;
  roundsPlayed?: number;
  capacity?: number;
  confidence?: number;
  cash?: number;
  escorts?: number;
  bases?: number;
  completedResearch?: string[];
  drafts?: { round: number; offered: string[]; picked: string }[];
  recoveryTotals?: Record<string, number>;
  counterTotals?: Record<string, unknown>;
  enemyEconomy?: Record<string, unknown>;
  lossesByEnemyBranch?: Record<string, number>;
  rounds?: Round[];
};

type Round = Record<string, number | string | unknown[] | Record<string, unknown>>;

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Per-round accessor that tolerates a field the log's format version predates. */
function rf(r: Round, key: string): number {
  return num(r[key]);
}

/** Sum a per-round field across every round of every log in a side. */
function sumRounds(logs: Log[], key: string): number {
  let total = 0;
  for (const log of logs) for (const r of log.rounds ?? []) total += rf(r, key);
  return total;
}

/** Total rounds played across a side — the denominator for every per-round rate. */
function roundCount(logs: Log[]): number {
  return logs.reduce((sum, log) => sum + (log.rounds?.length ?? 0), 0);
}

function sumTotals(logs: Log[], group: 'recoveryTotals' | 'counterTotals', key: string): number {
  let total = 0;
  for (const log of logs) total += num((log[group] as Record<string, unknown> | undefined)?.[key]);
  return total;
}

/** Deep per-round counter stat (rounds[].counters.stats.<key>). */
function sumCounterStat(logs: Log[], key: string): number {
  let total = 0;
  for (const log of logs) {
    for (const r of log.rounds ?? []) {
      const counters = r.counters as { stats?: Record<string, unknown> } | undefined;
      total += num(counters?.stats?.[key]);
    }
  }
  return total;
}

/** Mean of a whole-run field (capacity, confidence, …) across a side's logs. */
function meanFinal(logs: Log[], key: keyof Log): number {
  if (logs.length === 0) return 0;
  return logs.reduce((sum, log) => sum + num(log[key]), 0) / logs.length;
}

// ---------------------------------------------------------------------------
// Probes
// ---------------------------------------------------------------------------

export type ProbeGroup = 'engagement' | 'tempo' | 'economy' | 'outcome';
export type ProbeVerdict = 'match' | 'drift' | 'divergent' | 'unexercised' | 'no-data';

export interface Probe {
  id: string;
  label: string;
  group: ProbeGroup;
  unit: string;
  /** Aggregate this probe over one side's logs. Return null when the side has
   *  no data for it at all (an old log without the field) — that is different
   *  from a measured zero, and reporting it as zero would invent a divergence. */
  value: (logs: Log[]) => number | null;
  /** Relative band inside which bot/human counts as MATCH (0.35 = ±35%). */
  tolerance: number;
  /** What a divergence on this probe invalidates. */
  why: string;
}

/** A rate probe: numerator ÷ denominator, null when the denominator is zero
 *  (nothing happened, so there is no rate to compare rather than a rate of 0). */
function rate(numerator: (l: Log[]) => number, denominator: (l: Log[]) => number) {
  return (logs: Log[]): number | null => {
    const d = denominator(logs);
    return d > 0 ? numerator(logs) / d : null;
  };
}

export const PROBES: Probe[] = [
  // --- Engagement: which SYSTEMS the side actually touches -------------------
  {
    id: 'wreckageRecoveryRate',
    label: 'Wreckage recovered ÷ spawned',
    group: 'engagement',
    unit: 'share',
    tolerance: 0.3,
    why: 'Recovery drives draft width AND draft quality. A side that never salvages is playing a narrower roguelite than the other.',
    value: rate(
      (l) => sumTotals(l, 'recoveryTotals', 'wreckageRecovered'),
      (l) => sumTotals(l, 'recoveryTotals', 'wreckageSpawned'),
    ),
  },
  {
    id: 'survivorRescueRate',
    label: 'Survivors rescued ÷ spawned',
    group: 'engagement',
    unit: 'share',
    tolerance: 0.3,
    why: 'Unrescued crews cost extra confidence. Skipping rescue silently changes the confidence economy.',
    value: rate(
      (l) => sumTotals(l, 'recoveryTotals', 'survivorsRescued'),
      (l) => sumTotals(l, 'recoveryTotals', 'survivorsSpawned'),
    ),
  },
  {
    id: 'recoveryEscortSeconds',
    label: 'Escort-seconds on recovery per round',
    group: 'engagement',
    unit: 's/round',
    tolerance: 0.4,
    why: 'The real cost of salvage is escort time off the screen. A side that pays none gets recovery for free — or, at zero, never opts into the trade at all.',
    value: rate(
      (l) => sumTotals(l, 'recoveryTotals', 'recoveryEscortSeconds'),
      (l) => roundCount(l),
    ),
  },
  {
    id: 'draftWidth',
    label: 'Drafts offering 3+ options',
    group: 'engagement',
    unit: 'share',
    tolerance: 0.3,
    why: 'Draft width is the roguelite reward loop. Narrow drafts mean the technology the sweep converges on is a different tree than the human climbs.',
    value: (logs) => {
      let wide = 0;
      let total = 0;
      for (const log of logs) {
        for (const d of log.drafts ?? []) {
          total++;
          if ((d.offered?.length ?? 0) >= 3) wide++;
        }
      }
      return total > 0 ? wide / total : null;
    },
  },
  {
    id: 'smokePerRound',
    label: 'Smoke clouds laid per round',
    group: 'engagement',
    unit: '/round',
    tolerance: 0.5,
    why: 'Screening smoke shrinks a human reaction window and nothing at all for a bot. A gap here prices the smoke branch wrong in both directions.',
    value: rate((l) => sumRounds(l, 'smokeCloudsLaid'), (l) => roundCount(l)),
  },
  {
    id: 'warthogPerRound',
    label: 'Warthog sorties per round',
    group: 'engagement',
    unit: '/round',
    tolerance: 0.5,
    why: 'A placed ability is only worth what a player extracts from it; sortie rate is the first half of that.',
    value: rate((l) => sumRounds(l, 'warthogUsed'), (l) => roundCount(l)),
  },
  {
    id: 'scanPerRound',
    label: 'Scan pulses per round',
    group: 'engagement',
    unit: '/round',
    tolerance: 0.5,
    why: 'Scan is the mine-detection path most humans take. Under-use makes the mine branch look more lethal than it is.',
    value: rate((l) => sumRounds(l, 'scanUsed'), (l) => roundCount(l)),
  },
  {
    id: 'boardingsPerRound',
    label: 'Boarding attempts per round',
    group: 'engagement',
    unit: '/round',
    tolerance: 0.5,
    why: 'Boarding is the attack-boat endgame. If one side never meets it, the anti-boarding counters are unpriced on that side.',
    value: rate((l) => sumCounterStat(l, 'boardingAttempts'), (l) => roundCount(l)),
  },

  // --- Tempo: HOW the side fights, tick to tick -----------------------------
  {
    id: 'manualShotShare',
    label: 'Manual share of interceptor shots',
    group: 'tempo',
    unit: 'share',
    tolerance: 0.25,
    why: 'Automation research is only worth buying to a side that leans on it. A hand-firing bot under-values every auto-fire node in the tree.',
    value: rate(
      (l) => sumTotals(l, 'counterTotals', 'manualShots'),
      (l) => sumTotals(l, 'counterTotals', 'manualShots') + sumTotals(l, 'counterTotals', 'autoShots'),
    ),
  },
  {
    id: 'duplicateShotRate',
    label: 'Duplicate (wasted) shots ÷ shots',
    group: 'tempo',
    unit: 'share',
    tolerance: 0.4,
    why: 'Wasted interceptors are a human error the ammunition economy is balanced around. A perfectly deduplicating bot is a cheaper player than the real one.',
    value: rate(
      (l) => sumTotals(l, 'counterTotals', 'duplicateShots'),
      (l) => sumTotals(l, 'counterTotals', 'manualShots') + sumTotals(l, 'counterTotals', 'autoShots'),
    ),
  },
  {
    id: 'ammoPerRound',
    label: 'Interceptors expended per round',
    group: 'tempo',
    unit: '/round',
    tolerance: 0.35,
    why: 'Ammunition is the largest recurring cost in the player economy; a different burn rate is a different economy.',
    value: rate((l) => sumRounds(l, 'ammoUsed'), (l) => roundCount(l)),
  },
  {
    id: 'formationSwitches',
    label: 'Formation changes per campaign',
    group: 'tempo',
    unit: '/campaign',
    tolerance: 0.5,
    why: 'Formation is a free per-round lever. A side that never touches it cannot show whether the lever matters.',
    value: (logs) => {
      if (logs.length === 0) return null;
      let switches = 0;
      for (const log of logs) {
        const forms = (log.rounds ?? []).map((r) => String(r.formation ?? ''));
        for (let i = 1; i < forms.length; i++) if (forms[i] !== forms[i - 1]) switches++;
      }
      return switches / logs.length;
    },
  },

  // --- Economy: what the side BUILDS ----------------------------------------
  {
    id: 'finalCapacity',
    label: 'Convoy capacity at run end',
    group: 'economy',
    unit: 'hulls',
    tolerance: 0.2,
    why: 'SEESAW records convoy size as the strongest defensive stat in the game. A capacity gap outranks most equipment differences.',
    value: (logs) => (logs.length ? meanFinal(logs, 'capacity') : null),
  },
  {
    id: 'launchedPerRound',
    label: 'Hulls launched per round',
    group: 'economy',
    unit: '/round',
    tolerance: 0.2,
    why: 'The denominator of delivery %. Two sides delivering the same percentage of different convoy sizes are not in the same fight.',
    value: rate((l) => sumRounds(l, 'launched'), (l) => roundCount(l)),
  },
  {
    id: 'finalEscorts',
    label: 'Escorts alive at run end',
    group: 'economy',
    unit: 'hulls',
    tolerance: 0.4,
    why: 'Escorts are the mobile launcher AND the only platform that can salvage. Screen size gates two systems at once.',
    value: (logs) => (logs.length ? meanFinal(logs, 'escorts') : null),
  },
  {
    id: 'researchPerRound',
    label: 'Technologies completed per round',
    group: 'economy',
    unit: '/round',
    tolerance: 0.25,
    why: 'Sets how fast either side climbs the tree; a mismatch shifts every counter-value measurement earlier or later than the human sees it.',
    value: rate(
      (l) => l.reduce((sum, log) => sum + (log.completedResearch?.length ?? 0), 0),
      (l) => roundCount(l),
    ),
  },

  // --- Outcome: what the enemy DID about it ---------------------------------
  {
    id: 'deliveredPct',
    label: 'Mean delivery %',
    group: 'outcome',
    unit: '%',
    tolerance: 0.12,
    why: 'The headline seesaw signal. Only comparable once the probes above match — otherwise it agrees by coincidence.',
    value: rate((l) => sumRounds(l, 'deliveredPct'), (l) => roundCount(l)),
  },
  {
    id: 'lossesPerRound',
    label: 'Hulls lost per round',
    group: 'outcome',
    unit: '/round',
    tolerance: 0.3,
    why: 'Absolute attrition. Delivery % hides it when convoy sizes differ.',
    value: rate((l) => sumRounds(l, 'lost'), (l) => roundCount(l)),
  },
  {
    id: 'finalEnemyBudget',
    label: 'Enemy budget in the final round',
    group: 'outcome',
    unit: '$',
    tolerance: 0.2,
    why: 'The anti-snowball response. A different budget curve means the enemy is reacting to a different player.',
    value: (logs) => {
      const finals = logs
        .map((log) => {
          const last = log.rounds?.[log.rounds.length - 1];
          const enemy = last?.enemy as { budget?: number } | undefined;
          return enemy?.budget;
        })
        .filter((v): v is number => typeof v === 'number');
      return finals.length ? finals.reduce((a, b) => a + b, 0) / finals.length : null;
    },
  },
  {
    id: 'confidenceEnd',
    label: 'Confidence at run end',
    group: 'outcome',
    unit: 'pts',
    tolerance: 0.2,
    why: 'Confidence pinned at a rail on one side and wobbling on the other means the two sides are on different parts of the seesaw.',
    value: (logs) => (logs.length ? meanFinal(logs, 'confidence') : null),
  },
];

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export interface ProbeResult {
  id: string;
  label: string;
  group: ProbeGroup;
  unit: string;
  human: number | null;
  bot: number | null;
  /** bot ÷ human, when both sides have comparable non-zero data. */
  ratio: number | null;
  verdict: ProbeVerdict;
  /** |ln(ratio)| — how far apart the sides are, for ranking. */
  severity: number;
  why: string;
}

/** Values below this are treated as "essentially never happens", so a probe
 *  does not report a 40× divergence between two rounding errors. */
const NEAR_ZERO = 1e-6;

function compareProbe(probe: Probe, human: Log[], bots: Log[]): ProbeResult {
  const h = probe.value(human);
  const b = probe.value(bots);
  const base: Omit<ProbeResult, 'verdict' | 'ratio' | 'severity'> = {
    id: probe.id,
    label: probe.label,
    group: probe.group,
    unit: probe.unit,
    human: h,
    bot: b,
    why: probe.why,
  };
  if (h === null || b === null) {
    return { ...base, ratio: null, verdict: 'no-data', severity: 0 };
  }
  const hZero = Math.abs(h) < NEAR_ZERO;
  const bZero = Math.abs(b) < NEAR_ZERO;
  // Neither side does this at all. Not a divergence — nothing to compare.
  if (hZero && bZero) return { ...base, ratio: null, verdict: 'match', severity: 0 };
  // The human uses a system the bots do not (or vice versa). This is the class
  // of gap that silently invalidates balance work, so it gets its own verdict
  // rather than an arbitrarily large ratio.
  if (hZero || bZero) {
    return { ...base, ratio: null, verdict: 'unexercised', severity: Infinity };
  }
  const ratio = b / h;
  // Band on the LOG ratio, not on |ratio - 1|. The linear form is asymmetric:
  // a bot doing something 100× less than the human scores |0.01 - 1| = 0.99,
  // which sits inside a ±40% probe's drift band, so the single most important
  // class of gap — the bots barely touching a system — reported as DRIFT. In
  // log space "half as much" and "twice as much" are the same distance, which
  // is the comparison actually being made.
  const severity = Math.abs(Math.log(ratio));
  const matchAt = Math.log(1 + probe.tolerance);
  const verdict: ProbeVerdict =
    severity <= matchAt ? 'match' : severity <= matchAt * 2.5 ? 'drift' : 'divergent';
  return { ...base, ratio, verdict, severity };
}

/** Categorical run-setup facts. If these differ, the probes below them are
 *  comparing two different GAMES and every downstream number is suspect — so
 *  this is reported first and loudest. */
export interface SetupDiff {
  key: string;
  human: string;
  bot: string;
  same: boolean;
  why: string;
}

function branchesOf(regionId: string): string {
  return (REGIONS[regionId]?.enemyBranches ?? []).join('+') || '(unknown region)';
}

function startEscortsOf(regionId: string): string {
  const start = REGIONS[regionId]?.start;
  return start ? String(start.escorts) : '?';
}

function completionRoundOf(regionId: string): string {
  const def = REGIONS[regionId];
  if (!def) return '?';
  return def.completionRound >= 999 ? 'none (endless)' : String(def.completionRound);
}

function modeOf(logs: Log[], pick: (l: Log) => string): string {
  const counts = new Map<string, number>();
  for (const log of logs) {
    const v = pick(log);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return '(none)';
  return ranked.length === 1 ? ranked[0][0] : `${ranked[0][0]} (+${ranked.length - 1} other)`;
}

export function diffSetup(human: Log[], bots: Log[]): SetupDiff[] {
  const hRegion = modeOf(human, (l) => l.regionId ?? '?');
  const bRegion = modeOf(bots, (l) => l.regionId ?? '?');
  const one = (l: Log[]): string => l[0]?.regionId ?? '?';
  const rows: SetupDiff[] = [
    {
      key: 'Region',
      human: hRegion,
      bot: bRegion,
      same: hRegion === bRegion,
      why: 'A region sets the enemy roster, the starting state and the completion watermark. Different regions are different games.',
    },
    {
      key: 'Enemy branches available',
      human: branchesOf(one(human)),
      bot: branchesOf(one(bots)),
      same: branchesOf(one(human)) === branchesOf(one(bots)),
      why: 'A wider roster splits the same budget more ways, so every branch debuts later and weaker than the player meets it.',
    },
    {
      key: 'Escorts at run start',
      human: startEscortsOf(one(human)),
      bot: startEscortsOf(one(bots)),
      same: startEscortsOf(one(human)) === startEscortsOf(one(bots)),
      why: 'The escort is the only platform that can salvage; starting without one changes the opening several rounds.',
    },
    {
      key: 'Completion round',
      human: completionRoundOf(one(human)),
      bot: completionRoundOf(one(bots)),
      same: completionRoundOf(one(human)) === completionRoundOf(one(bots)),
      why: 'A run with a win condition is played differently from an endless one — and only one of them is shipping.',
    },
    {
      key: 'Commander abilities',
      human: modeOf(human, (l) => (l.commanderAbilities ?? []).join(',') || '(none)'),
      bot: modeOf(bots, (l) => (l.commanderAbilities ?? []).join(',') || '(none)'),
      same:
        modeOf(human, (l) => (l.commanderAbilities ?? []).join(',') || '(none)') ===
        modeOf(bots, (l) => (l.commanderAbilities ?? []).join(',') || '(none)'),
      why: 'Commander abilities modify accuracy, recovery rate, prices and start cash before anything else is derived.',
    },
  ];
  return rows;
}

export interface FidelityReport {
  generatedAt: string;
  humanLogs: number;
  botLogs: number;
  humanRounds: number;
  botRounds: number;
  setup: SetupDiff[];
  probes: ProbeResult[];
  /** Probes at DIVERGENT or UNEXERCISED, worst first — the work list. */
  gaps: ProbeResult[];
  /** One-line fidelity grade for tracking across playtests. */
  grade: string;
}

export function buildReport(human: Log[], bots: Log[], generatedAt: string): FidelityReport {
  const probes = PROBES.map((p) => compareProbe(p, human, bots));
  const gaps = probes
    .filter((p) => p.verdict === 'divergent' || p.verdict === 'unexercised')
    .sort((a, b) => b.severity - a.severity);
  const setup = diffSetup(human, bots);
  const setupMismatches = setup.filter((s) => !s.same).length;
  const scored = probes.filter((p) => p.verdict !== 'no-data').length;
  const matched = probes.filter((p) => p.verdict === 'match').length;
  const grade =
    setupMismatches > 0
      ? `SETUP MISMATCH (${setupMismatches}) — probe comparisons are between different games`
      : `${matched}/${scored} probes match`;
  return {
    generatedAt,
    humanLogs: human.length,
    botLogs: bots.length,
    humanRounds: roundCount(human),
    botRounds: roundCount(bots),
    setup,
    probes,
    gaps,
    grade,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function pad(s: string, w: number): string {
  return s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length);
}
function padLeft(s: string, w: number): string {
  return s.length >= w ? s : ' '.repeat(w - s.length) + s;
}

function fmt(v: number | null, unit: string): string {
  if (v === null) return '—';
  if (unit === 'share') return `${(v * 100).toFixed(1)}%`;
  if (unit === '%') return v.toFixed(1);
  if (unit === '$') return Math.round(v).toString();
  if (Math.abs(v) >= 100) return Math.round(v).toString();
  return v.toFixed(2);
}

const VERDICT_MARK: Record<ProbeVerdict, string> = {
  match: 'MATCH',
  drift: 'DRIFT',
  divergent: 'DIVERGENT',
  unexercised: 'UNEXERCISED',
  'no-data': 'no data',
};

const GROUP_TITLES: Record<ProbeGroup, string> = {
  engagement: 'ENGAGEMENT — which systems each side actually touches',
  tempo: 'TEMPO — how each side fights, tick to tick',
  economy: 'ECONOMY — what each side builds',
  outcome: 'OUTCOME — what the enemy did about it',
};

export function printReport(report: FidelityReport): void {
  const line = '─'.repeat(86);
  console.log(`\n${line}`);
  console.log('STRAITWATCH PLAYTEST FIDELITY — does the sweep play the game the human plays?');
  console.log(line);
  console.log(
    `  human: ${report.humanLogs} log(s), ${report.humanRounds} rounds` +
      `    bots: ${report.botLogs} campaign(s), ${report.botRounds} rounds`,
  );

  // --- Setup ---------------------------------------------------------------
  console.log('\nRUN SETUP (everything below is only comparable if these match)');
  console.log(line);
  console.log(`${pad('', 28)}${pad('HUMAN', 30)}${pad('BOTS', 30)}`);
  for (const s of report.setup) {
    const mark = s.same ? '  ' : '! ';
    console.log(`${mark}${pad(s.key, 26)}${pad(s.human, 30)}${pad(s.bot, 30)}`);
  }
  const mismatches = report.setup.filter((s) => !s.same);
  for (const s of mismatches) {
    console.log(`    ! ${s.key}: ${s.why}`);
  }

  // --- Probes --------------------------------------------------------------
  for (const group of ['engagement', 'tempo', 'economy', 'outcome'] as ProbeGroup[]) {
    const rows = report.probes.filter((p) => p.group === group);
    if (rows.length === 0) continue;
    console.log(`\n${GROUP_TITLES[group]}`);
    console.log(line);
    console.log(
      `${pad('PROBE', 38)}${padLeft('HUMAN', 10)}${padLeft('BOTS', 10)}${padLeft('BOT÷HUM', 10)}  VERDICT`,
    );
    for (const p of rows) {
      console.log(
        pad(p.label, 38) +
          padLeft(fmt(p.human, p.unit), 10) +
          padLeft(fmt(p.bot, p.unit), 10) +
          padLeft(p.ratio === null ? '—' : `${p.ratio.toFixed(2)}×`, 10) +
          '  ' +
          VERDICT_MARK[p.verdict],
      );
    }
  }

  // --- The work list -------------------------------------------------------
  console.log('\nFIDELITY GAPS (worst first — close these in the HARNESS, not the game)');
  console.log(line);
  if (report.gaps.length === 0) {
    console.log('  None. Every probe is inside tolerance; sweep balance numbers are trustworthy.');
  } else {
    report.gaps.forEach((g, i) => {
      const gap =
        g.verdict === 'unexercised'
          ? `human ${fmt(g.human, g.unit)} vs bots ${fmt(g.bot, g.unit)} — one side never does this`
          : `human ${fmt(g.human, g.unit)} vs bots ${fmt(g.bot, g.unit)} (${g.ratio?.toFixed(2)}×)`;
      console.log(`  ${i + 1}. ${g.label} — ${gap}`);
      console.log(`     ${g.why}`);
    });
  }

  console.log(`\nGRADE: ${report.grade}`);
  console.log(`${line}\n`);
}

