// THE BOT REPORT'S NUMBERS (map rebuild phase 3, docs/design/v3-map-report.md):
// the measured checks of the map and wave rules (docs/design/
// v3-map-wave-rules.md, "How a map passes" and the wave rules), read off bot
// runs and their telemetry sidecars.
//
// Two steps:
// - `digestRun` turns one run (its sidecar, and what a `ThreatWatch` saw of
//   each threat while it lived) into a small per-wave record: ships lost,
//   launches, close calls, warning time, and hull damage by stretch of each
//   lane. Digests are JSON and a few hundred bytes, so a report keeps no
//   raw log.
// - `mapReport` adds the digests of a map's runs together and judges each
//   rule: no cliffs, close calls from wave 3, wave budgets within ±15%, a
//   danger stretch and a safe stretch, warning time falling over the waves.
//
// Pure: no DOM, no Node. The tool that plays the runs is
// tools/v3/map-report/report.ts (and `mapReportPlay.ts` here).

import { VIP } from '../data/config';
import type { MapDef } from '../data/maps';
import { waveSpec } from '../data/waves';
import { timeToImpact, type Game } from './game';
import { laneLength } from './lanes';
import type { TelEvent, TelemetrySidecar } from './telemetry';

/** Waves 1-10 and the three boss rounds (11-13). */
export const REPORT_WAVES = 13;
/** A close call: a threat this many seconds or less from a hull. */
export const CLOSE_SECONDS = 2.0;
/** A warning time above this (a plane with no hull ahead of it, a
 *  structure, a mine adrift) is not a warning: left out of the mean. */
export const WARN_CAP = 30;
/** The cliff rule's floor: a wave "more than doubles" the one before when
 *  it loses more than twice max(previous, this). Below a quarter of a ship
 *  a doubling is noise (0.04 → 0.1), so the previous wave counts as 0.25:
 *  after a quiet wave, more than half a ship is a cliff. */
export const CLIFF_FLOOR = 0.25;
/** The budget band (rule w-budget). */
export const BUDGET_BAND = 0.15;
/** The safe stretch's share of a lane's losses (rule m-stretches). */
export const SAFE_SHARE = 0.25;
/** A lane with less hull damage than this a run, over waves 1-9, is too
 *  thin to name its stretches. */
export const THIN_LANE_HP = 1;

// ---------------------------------------------------------------------------
// Watching threats while they live

/** What a run saw of each threat: its seconds to impact (the sim's own
 *  `timeToImpact`, as the bots and the UI's warnings read it) the first
 *  step it was on the board, and the least it reached. Keyed by threat id. */
export interface ThreatWatchData {
  first: Record<number, number>;
  min: Record<number, number>;
}

/** Call `observe(g)` after every sim step: it reads each live threat's
 *  time to impact. Reads only, so the game plays the same. */
export class ThreatWatch {
  readonly first: Record<number, number> = {};
  readonly min: Record<number, number> = {};

  observe(g: Game): void {
    for (const t of g.threats) {
      if (t.dead) continue;
      const tti = timeToImpact(g, t);
      if (!(t.id in this.first)) {
        this.first[t.id] = round(tti, 2);
        this.min[t.id] = tti;
      } else if (tti < this.min[t.id]) this.min[t.id] = tti;
    }
  }

  data(): ThreatWatchData {
    return { first: this.first, min: this.min };
  }
}

// ---------------------------------------------------------------------------
// One run

/** One run's numbers, wave by wave (index 0 = wave 1, up to 12 = boss round
 *  3). */
export interface RunDigest {
  seed: number;
  won: boolean;
  /** The last wave it played (14 when it won, as the other reports). */
  endWave: number;
  /** The waves (1-13) it played. */
  reached: number[];
  /** Ships lost (a VIP counts VIP.loss, as the game counts it). */
  lost: number[];
  /** Ships lost in bonus waves (not in any wave's count). */
  lostBonus: number;
  /** Originating launches: threats a launcher sent (a base, a truck, a sub,
   *  the air), not what split off another (a Hydra's darts, a bomber's
   *  bomblets) and not a threat back on the board. The game's own count
   *  (`g.origins`). */
  launches: number[];
  /** Threats that came within CLOSE_SECONDS of a hull and were then
   *  destroyed (a kill), any threat, children too. */
  close: number[];
  /** Warning time: the sum and count of originating launches' seconds to
   *  impact as they appeared (under WARN_CAP). */
  warnSum: number[];
  warnN: number[];
  /** Ship hull points lost and ships sunk, by lane and stretch (0 early,
   *  1 middle, 2 late, by distance along the lane): over waves 1-9 (`core`,
   *  outside wave 10 and the boss rounds) and over every wave (`all`). */
  stretch: {
    core: { hp: number[][]; sunk: number[][] };
    all: { hp: number[][]; sunk: number[][] };
  };
}

const zeros = (n = REPORT_WAVES) => new Array<number>(n).fill(0);
const grid = (lanes: number) => Array.from({ length: lanes }, () => [0, 0, 0]);

/** The stretch (0-2) of a point `d` along a lane of length `len`. */
export function stretchOf(d: number, len: number): number {
  if (!(len > 0)) return 0;
  return Math.max(0, Math.min(2, Math.floor((d / len) * 3)));
}

/** The wave (1-13) an event fell in, or 0 for a bonus wave, a lab event or
 *  anything outside the waves. */
export function waveOfPhase(sc: TelemetrySidecar, p: number): number {
  const ph = sc.phases[p];
  if (!ph || (ph.kind !== 'wave' && ph.kind !== 'mapEvent')) return 0;
  return ph.wave >= 1 && ph.wave <= REPORT_WAVES ? ph.wave : 0;
}

type Ev<K extends TelEvent['k']> = Extract<TelEvent, { k: K }>;

/** Is this `thr+` a launch (the game's count): not a child, not back on the
 *  board, not a structure raised or a threat first seen on the board. */
export function isLaunch(e: Ev<'thr+'>): boolean {
  return !e.back && e.pid === undefined && e.o !== 'child' && e.o !== 'structure' && e.o !== 'seen';
}

export function digestRun(map: MapDef, seed: number, sc: TelemetrySidecar, watch: ThreatWatchData | null, outcome?: { won: boolean; wave: number }): RunDigest {
  const lanes = Math.max(1, map.channels.length);
  const lens = map.channels.map((ch) => laneLength(ch));
  const d: RunDigest = {
    seed,
    won: outcome?.won ?? false,
    endWave: 0,
    reached: [],
    lost: zeros(),
    lostBonus: 0,
    launches: zeros(),
    close: zeros(),
    warnSum: zeros(),
    warnN: zeros(),
    stretch: { core: { hp: grid(lanes), sunk: grid(lanes) }, all: { hp: grid(lanes), sunk: grid(lanes) } },
  };
  const reached = new Set<number>();
  for (let p = 0; p < sc.phases.length; p++) {
    const w = waveOfPhase(sc, p);
    if (w) reached.add(w);
  }
  d.reached = [...reached].sort((a, b) => a - b);
  const last = d.reached.length ? d.reached[d.reached.length - 1] : 0;
  d.endWave = d.won ? 14 : (outcome?.wave ?? last);
  const lenOf = (lane: number) => lens[lane] ?? lens[0] ?? 1;
  const addStretch = (w: number, lane: number | undefined, dist: number | undefined, key: 'hp' | 'sunk', v: number) => {
    if (lane === undefined || dist === undefined) return;
    const l = Math.max(0, Math.min(lanes - 1, lane));
    const s = stretchOf(dist, lenOf(l));
    d.stretch.all[key][l][s] += v;
    if (w >= 1 && w <= 9) d.stretch.core[key][l][s] += v;
  };
  for (const e of sc.events) {
    const w = waveOfPhase(sc, e.p);
    if (e.k === 'thr+') {
      if (!w || !isLaunch(e)) continue;
      d.launches[w - 1] += 1;
      const first = watch?.first[e.id];
      if (first !== undefined && first < WARN_CAP && e.tg !== -2) {
        d.warnSum[w - 1] += first;
        d.warnN[w - 1] += 1;
      }
    } else if (e.k === 'thr-') {
      if (!w || e.why !== 'kill') continue;
      const min = watch?.min[e.id];
      if (min !== undefined && min <= CLOSE_SECONDS) d.close[w - 1] += 1;
    } else if (e.k === 'hit') {
      if (e.vt !== 's' || e.blk || !w) continue;
      addStretch(w, e.lane, e.d, 'hp', e.hp);
    } else if (e.k === 'ship-') {
      if (e.why !== 'sunk') continue;
      const loss = e.vip ? VIP.loss : 1;
      const ph = sc.phases[e.p];
      if (!w) {
        if (ph?.kind === 'bonusEvent') d.lostBonus += loss;
        continue;
      }
      d.lost[w - 1] += loss;
      addStretch(w, e.lane, e.d, 'sunk', 1);
    }
  }
  for (const k of ['warnSum'] as const) d[k] = d[k].map((v) => round(v, 2));
  return d;
}

// ---------------------------------------------------------------------------
// The checks

export type Verdict = 'PASS' | 'FLAG' | 'INFO';

export interface Check {
  /** The rule's id in docs/design/v3-map-wave-rules.md. */
  rule: string;
  name: string;
  value: string;
  target: string;
  verdict: Verdict;
  /** Which runs it is read on. */
  from: 'tough' | 'normal' | 'tough+baseline' | 'kits';
}

export interface CliffResult {
  /** The biggest one-wave step up in mean losses, waves 2-10. */
  step: { wave: number; up: number };
  /** Waves 2-10 that more than double the one before (its losses floored
   *  at CLIFF_FLOOR). */
  doubles: { wave: number; prev: number; cur: number }[];
}

/** `curve`: mean ships lost on waves 1-10 (index 0 = wave 1). */
export function cliffOf(curve: number[]): CliffResult {
  let step = { wave: 2, up: -Infinity };
  const doubles: CliffResult['doubles'] = [];
  for (let k = 1; k < Math.min(10, curve.length); k++) {
    const prev = curve[k - 1];
    const cur = curve[k];
    if (!Number.isFinite(prev) || !Number.isFinite(cur)) continue;
    if (cur - prev > step.up) step = { wave: k + 1, up: cur - prev };
    if (cur > 2 * Math.max(prev, CLIFF_FLOOR)) doubles.push({ wave: k + 1, prev, cur });
  }
  if (step.up === -Infinity) step = { wave: 0, up: 0 };
  return { step, doubles };
}

export interface StretchRow {
  lane: number;
  /** Shares of the lane's ship hull damage and sinkings, early/middle/late. */
  hpShare: number[];
  sunkShare: number[];
  /** Hull points and sinkings a run in the lane. */
  hp: number;
  sunk: number;
  hot: number;
  cold: number;
  thin: boolean;
}

export const STRETCH_NAMES = ['early', 'middle', 'late'] as const;

/** Stretch shares by lane, and pooled over the lanes (lane -1). */
export function stretchRows(digests: RunDigest[], which: 'core' | 'all'): StretchRow[] {
  if (!digests.length) return [];
  const lanes = digests[0].stretch[which].hp.length;
  const rows: StretchRow[] = [];
  const row = (lane: number, hp: number[], sunk: number[]): StretchRow => {
    const th = hp.reduce((a, b) => a + b, 0);
    const ts = sunk.reduce((a, b) => a + b, 0);
    const hpShare = hp.map((v) => (th ? v / th : 0));
    const order = [0, 1, 2].sort((a, b) => hp[b] - hp[a] || sunk[b] - sunk[a]);
    return {
      lane,
      hpShare,
      sunkShare: sunk.map((v) => (ts ? v / ts : 0)),
      hp: th / digests.length,
      sunk: ts / digests.length,
      hot: order[0],
      cold: order[2],
      thin: th / digests.length < THIN_LANE_HP,
    };
  };
  const pooledHp = [0, 0, 0];
  const pooledSunk = [0, 0, 0];
  for (let l = 0; l < lanes; l++) {
    const hp = [0, 0, 0];
    const sunk = [0, 0, 0];
    for (const dg of digests)
      for (let s = 0; s < 3; s++) {
        hp[s] += dg.stretch[which].hp[l][s];
        sunk[s] += dg.stretch[which].sunk[l][s];
      }
    for (let s = 0; s < 3; s++) {
      pooledHp[s] += hp[s];
      pooledSunk[s] += sunk[s];
    }
    rows.push(row(l, hp, sunk));
  }
  rows.push(row(-1, pooledHp, pooledSunk));
  return rows;
}

/** Least-squares slope of y over x = 1..n (seconds a wave). */
export function slope(ys: number[]): number {
  const pts = ys.map((y, k) => [k + 1, y]).filter(([, y]) => Number.isFinite(y));
  if (pts.length < 2) return 0;
  const mx = pts.reduce((a, [x]) => a + x, 0) / pts.length;
  const my = pts.reduce((a, [, y]) => a + y, 0) / pts.length;
  const num = pts.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0);
  const den = pts.reduce((a, [x]) => a + (x - mx) ** 2, 0);
  return den ? num / den : 0;
}

/** The shared table's launches for a wave on a map: its drones, shells and
 *  guided missiles (`waveSpec` × the map's threat scale). */
export function tableLaunches(map: MapDef, wave: number): number {
  const s = waveSpec(wave, map.threatScale);
  return s.drones + s.ballistic + s.guided;
}

export interface Curve {
  n: number;
  /** Mean over every run (a run that ended before a wave counts 0). */
  mean: number[];
  /** Mean over the runs that played the wave (NaN when none did). */
  reachedMean: number[];
  /** Runs that played each wave. */
  reached: number[];
}

export function curveOf(digests: RunDigest[], pick: (d: RunDigest) => number[]): Curve {
  const n = digests.length;
  const mean = zeros().map((_, k) => avg(digests.map((d) => pick(d)[k] ?? 0)));
  const reached = zeros().map((_, k) => digests.filter((d) => d.reached.includes(k + 1)).length);
  const reachedMean = zeros().map((_, k) => {
    const on = digests.filter((d) => d.reached.includes(k + 1));
    return on.length ? avg(on.map((d) => pick(d)[k] ?? 0)) : NaN;
  });
  return { n, mean, reachedMean, reached };
}

export interface KitSummary {
  kit: string;
  weapons: string[];
  n: number;
  endWave: number;
  won: number;
  /** Ships lost waves 1-10, normal runs (mean) and tough runs (every wave). */
  lost10: number;
  lost10Tough: number;
  curveTough: number[];
  /** Ships lost a boss round, over the runs that reached it. */
  boss: number[];
  bossReached: number[];
}

export function kitSummary(kit: string, weapons: string[], normal: RunDigest[], tough: RunDigest[]): KitSummary {
  const c = curveOf(normal, (d) => d.lost);
  const t = curveOf(tough, (d) => d.lost);
  return {
    kit,
    weapons,
    n: normal.length,
    endWave: avg(normal.map((d) => d.endWave)),
    won: normal.length ? normal.filter((d) => d.won).length / normal.length : 0,
    lost10: sum(c.mean.slice(0, 10)),
    lost10Tough: sum(t.mean.slice(0, 10)),
    curveTough: t.mean.slice(0, 10),
    boss: c.reachedMean.slice(10, 13),
    bossReached: c.reached.slice(10, 13),
  };
}

export interface MapReport {
  map: string;
  name: string;
  threatScale: number;
  seeds: number[];
  /** Normal runs (the loss limit): how far a run gets, and losses per wave
   *  over the runs that reached it; the boss rounds. */
  normal: {
    n: number;
    won: number;
    endWave: number;
    lost: Curve;
    lost10: number;
    lost15: number;
    lostBonus: number;
  };
  /** Tough runs (no loss limit, the carrier can't sink): every seed plays
   *  every wave. The per-wave curve, close calls, budgets, stretches and
   *  warning time are read here. */
  tough: {
    n: number;
    lost: number[];
    lost10: number;
    cliff: CliffResult;
    close: number[];
    /** Share of runs with at least one close call on the wave. */
    closeAny: number[];
    launches: number[];
    table: number[];
    /** Launches over the table × scale (information: aircraft, subs, trucks
     *  and the map's extras change a wave's count from the table). */
    vsTable: number[];
    /** The same map's runs with the encounters off (the card's setup
     *  otherwise), and the ratio to it: the check. */
    baseline: number[] | null;
    vsBaseline: number[] | null;
    warning: number[];
    warningN: number[];
    warningSlope: number;
    stretchCore: StretchRow[];
    stretchAll: StretchRow[];
  };
  boss: { reachedMean: number[]; reached: number[]; tough: number[] };
  kits: KitSummary[];
  checks: Check[];
}

export interface ReportInput {
  map: MapDef;
  seeds: number[];
  normal: RunDigest[];
  tough: RunDigest[];
  /** Tough runs with the encounters off (for the budget). */
  baseline?: RunDigest[];
  kits?: KitSummary[];
  /** The boss target on the bot's scale, ships a round (the recorded bias:
   *  about 2 on the Strait and Harbor Mouth, else about 1). */
  bossTarget?: number;
}

export function mapReport(input: ReportInput): MapReport {
  const { map, normal, tough } = input;
  const nc = curveOf(normal, (d) => d.lost);
  const tc = curveOf(tough, (d) => d.lost);
  const toughLost = tc.mean;
  const cliff = cliffOf(toughLost.slice(0, 10));
  const close = curveOf(tough, (d) => d.close).mean;
  const closeAny = zeros().map((_, k) => (tough.length ? tough.filter((d) => d.close[k] > 0).length / tough.length : 0));
  const launches = curveOf(tough, (d) => d.launches).mean;
  const table = zeros(10).map((_, k) => tableLaunches(map, k + 1));
  const vsTable = table.map((t, k) => (t ? launches[k] / t : NaN));
  const baseline = input.baseline?.length ? curveOf(input.baseline, (d) => d.launches).mean.slice(0, 10) : null;
  const vsBaseline = baseline ? baseline.map((b, k) => (b ? launches[k] / b : NaN)) : null;
  const warnSum = zeros().map((_, k) => sum(tough.map((d) => d.warnSum[k])));
  const warningN = zeros().map((_, k) => sum(tough.map((d) => d.warnN[k])));
  const warning = warnSum.map((s, k) => (warningN[k] ? s / warningN[k] : NaN));
  const warningSlope = slope(warning.slice(0, 10));
  const stretchCore = stretchRows(tough, 'core');
  const stretchAll = stretchRows(tough, 'all');
  const report: MapReport = {
    map: map.id,
    name: map.name,
    threatScale: map.threatScale,
    seeds: input.seeds,
    normal: {
      n: normal.length,
      won: normal.length ? normal.filter((d) => d.won).length / normal.length : 0,
      endWave: avg(normal.map((d) => d.endWave)),
      lost: nc,
      lost10: sum(nc.mean.slice(0, 10)),
      lost15: sum(nc.mean.slice(0, 5)),
      lostBonus: avg(normal.map((d) => d.lostBonus)),
    },
    tough: {
      n: tough.length,
      lost: toughLost,
      lost10: sum(toughLost.slice(0, 10)),
      cliff,
      close,
      closeAny,
      launches,
      table,
      vsTable,
      baseline,
      vsBaseline,
      warning,
      warningN,
      warningSlope,
      stretchCore,
      stretchAll,
    },
    boss: { reachedMean: nc.reachedMean.slice(10, 13), reached: nc.reached.slice(10, 13), tough: toughLost.slice(10, 13) },
    kits: input.kits ?? [],
    checks: [],
  };
  report.checks = checksOf(report, input.bossTarget ?? 1);
  return report;
}

const f = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const pct = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '–');

/** Each rule the bots can measure, judged. */
export function checksOf(r: MapReport, bossTarget: number): Check[] {
  const out: Check[] = [];
  const t = r.tough;
  // No cliffs.
  const dbl = t.cliff.doubles;
  out.push({
    rule: 'w-cliff',
    name: 'No cliffs',
    value: `biggest step w${t.cliff.step.wave} +${f(t.cliff.step.up)}; ${dbl.length ? `doubles on ${dbl.map((x) => `w${x.wave} (${f(x.prev)}→${f(x.cur)})`).join(', ')}` : 'no wave doubles'}`,
    target: `no wave 2–10 more than 2× the one before (before floored at ${CLIFF_FLOOR})`,
    verdict: dbl.length ? 'FLAG' : 'PASS',
    from: 'tough',
  });
  // Close calls from wave 3.
  const cc = t.close.slice(2, 10);
  const low = cc.map((v, k) => ({ wave: k + 3, v })).filter((x) => x.v < 1);
  const worst = cc.reduce((a, v, k) => (v < a.v ? { wave: k + 3, v } : a), { wave: 3, v: Infinity });
  out.push({
    rule: 'w-early',
    name: 'Close calls from wave 3',
    value: `fewest w${worst.wave} ${f(worst.v)} a run (${pct(t.closeAny[worst.wave - 1])} of runs have one)${low.length ? `; under 1 on ${low.map((x) => `w${x.wave}`).join(', ')}` : ''}`,
    target: '≥ 1 a run on every wave 3–10',
    verdict: low.length ? 'FLAG' : 'PASS',
    from: 'tough',
  });
  // Wave budgets.
  if (t.vsBaseline) {
    const out15 = t.vsBaseline.map((v, k) => ({ wave: k + 1, v })).filter((x) => Math.abs(x.v - 1) > BUDGET_BAND);
    const far = t.vsBaseline.reduce((a, v, k) => (Math.abs(v - 1) > Math.abs(a.v - 1) ? { wave: k + 1, v } : a), { wave: 1, v: 1 });
    out.push({
      rule: 'w-budget',
      name: 'Wave budgets ±15%',
      value: `furthest w${far.wave} ×${f(far.v)} of the no-encounter wave${out15.length ? `; outside on ${out15.map((x) => `w${x.wave} ×${f(x.v)}`).join(', ')}` : ''}`,
      target: `every wave 1–10 within ×${f(1 - BUDGET_BAND)}–×${f(1 + BUDGET_BAND)} of the table × scale as planned (encounters off)`,
      verdict: out15.length ? 'FLAG' : 'PASS',
      from: 'tough+baseline',
    });
  }
  // A danger stretch and a safe stretch.
  const lanes = t.stretchCore.filter((s) => s.lane >= 0 && !s.thin);
  const pooled = t.stretchCore.find((s) => s.lane === -1);
  const bad = lanes.filter((s) => s.hpShare[s.cold] >= SAFE_SHARE);
  if (pooled) {
    out.push({
      rule: 'm-stretches',
      name: 'A danger and a safe stretch',
      value: `${lanes
        .map((s) => `lane ${s.lane + 1}: hot ${STRETCH_NAMES[s.hot]} ${pct(s.hpShare[s.hot])}, cold ${STRETCH_NAMES[s.cold]} ${pct(s.hpShare[s.cold])}`)
        .join('; ')}${lanes.length ? '' : 'no lane with enough damage'}`,
      target: `each lane's coldest stretch < ${pct(SAFE_SHARE)} of its ship hull damage (waves 1–9)`,
      verdict: !lanes.length || bad.length ? 'FLAG' : 'PASS',
      from: 'tough',
    });
  }
  // Warning time falls.
  const w1 = t.warning[0];
  const w10 = t.warning[9];
  out.push({
    rule: 'g-warning',
    name: 'Warning time falls 1→10',
    value: `w1 ${f(w1, 1)} s → w10 ${f(w10, 1)} s (slope ${f(t.warningSlope)} s a wave)`,
    target: 'falls: slope < 0 and wave 10 below wave 1',
    verdict: t.warningSlope < 0 && w10 < w1 ? 'PASS' : 'FLAG',
    from: 'tough',
  });
  // Wave 1 shows the map: no loss.
  const lost1 = t.lost[0];
  out.push({
    rule: 'w-first',
    name: 'Wave 1: no ship lost',
    value: `${f(lost1)} a run`,
    target: '0 (under 0.1 a run)',
    verdict: lost1 < 0.1 ? 'PASS' : 'FLAG',
    from: 'tough',
  });
  // Information only (the bots set the floor; the player's scorecard the
  // target, rule w-bots).
  out.push({
    rule: 'w-early',
    name: 'Ships lost waves 1–5',
    value: `${f(r.normal.lost15)} a run`,
    target: 'a good player 0–1 (rule w-early)',
    verdict: 'INFO',
    from: 'normal',
  });
  const b = r.boss.reachedMean;
  out.push({
    rule: 'w-boss',
    name: 'Boss rounds',
    value: `normal (runs that reached it): ${b.map((v, k) => `r${k + 1} ${f(v)} (${r.boss.reached[k]})`).join(', ')}; tough (every run): ${r.boss.tough.map((v) => f(v)).join(', ')}`,
    target: `about ${bossTarget} a round on the bot's scale, rising`,
    verdict: 'INFO',
    from: 'normal',
  });
  if (r.kits.length >= 2) {
    const sorted = [...r.kits].sort((a, b2) => a.lost10Tough - b2.lost10Tough);
    out.push({
      rule: 'm-kits',
      name: 'Kits',
      value: sorted.map((k) => `${k.kit} ${f(k.lost10Tough, 1)} lost 1–10, end ${f(k.endWave, 1)}`).join('; '),
      target: 'the counter kit clearly better; neither trivial',
      verdict: 'INFO',
      from: 'kits',
    });
  }
  return out;
}

/** What to look at, in a line each, from the flags. */
export function lookAt(r: MapReport): string[] {
  const out: string[] = [];
  const t = r.tough;
  for (const c of r.checks) {
    if (c.verdict !== 'FLAG') continue;
    if (c.rule === 'w-cliff')
      out.push(`Cliff: ${t.cliff.doubles.map((x) => `wave ${x.wave} loses ${f(x.cur)} after ${f(x.prev)}`).join('; ')}. Move budget from it to the wave before, or soften its biggest raid.`);
    else if (c.rule === 'w-early') {
      const low = t.close.slice(2, 10).map((v, k) => ({ wave: k + 3, v })).filter((x) => x.v < 1);
      out.push(`Too few close calls on ${low.map((x) => `wave ${x.wave} (${f(x.v)})`).join(', ')}: give those waves a launch from a near site, or one aimed at the danger stretch.`);
    } else if (c.rule === 'w-budget' && t.vsBaseline)
      out.push(`Budget: ${t.vsBaseline.map((v, k) => ({ wave: k + 1, v })).filter((x) => Math.abs(x.v - 1) > BUDGET_BAND).map((x) => `wave ${x.wave} sends ×${f(x.v)} the no-encounter wave`).join('; ')}. Encounters should replace launches, not add them.`);
    else if (c.rule === 'm-stretches') {
      const bad = t.stretchCore.filter((s) => s.lane >= 0 && !s.thin && s.hpShare[s.cold] >= SAFE_SHARE);
      out.push(`No safe stretch on ${bad.map((s) => `lane ${s.lane + 1} (coldest ${STRETCH_NAMES[s.cold]} takes ${pct(s.hpShare[s.cold])})`).join(', ')}: aim waves 1–9 away from it.`);
    } else if (c.rule === 'g-warning') out.push(`Warning time does not fall (wave 1 ${f(t.warning[0], 1)} s, wave 10 ${f(t.warning[9], 1)} s): later waves should fire from nearer sites.`);
    else if (c.rule === 'w-first') out.push(`Wave 1 sinks ${f(t.lost[0])} ships a run: it should cost nothing.`);
  }
  const peak = t.lost.slice(0, 10).reduce((a, v, k) => (v > a.v ? { wave: k + 1, v } : a), { wave: 1, v: -1 });
  out.push(`Hardest of waves 1–10 for the bot: wave ${peak.wave} (${f(peak.v)} ships a run, tough runs).`);
  const pooled = t.stretchCore.find((s) => s.lane === -1);
  if (pooled) out.push(`Hull damage by stretch (waves 1–9, all lanes): ${pooled.hpShare.map((v, k) => `${STRETCH_NAMES[k]} ${pct(v)}`).join(', ')}.`);
  return out;
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

function round(v: number, d: number): number {
  const m = 10 ** d;
  return Math.round(v * m) / m;
}
