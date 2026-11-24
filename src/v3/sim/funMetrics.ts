// FUN MEASURES (docs/design/v3-fun-metrics.md): two readings of a play log,
// the player's or a bot's, that look for the moments the player called fun
// (review 2026-11-18: "close calls where that nuke or ammo drop really saved
// us ... or destroying a heavy right before it took out our last ship").
//
// 1. SAVES (counterfactual). At each player action that might matter (the
//    tap that finished a threat close to impact, a nuke, a pickup grabbed
//    while something was closing in) the game is forked at that very step
//    and played forward twice: with the action, and without it. Losses in
//    the fork without it, less losses in the fork with it, are the ships
//    the action saved. Two more variants: the same action 0.5 s later
//    (was the timing what mattered?) and, when two threats were due
//    together, the tap on the other one (was it the right choice?).
//
//    Who plays after the fork: the "you" bot (mimic.ts), in every branch,
//    with the same dice. The log's later inputs can't be kept: they were
//    aimed at a board the counterfactual no longer has. Dropping them
//    (nobody plays on) would count as "saved" every threat a player would
//    simply have shot a moment later. With the bot playing on, an action
//    is a save only when a competent player taking over at that moment
//    could not cover for it. The bot starts "warm": it has already seen
//    every threat on the board, does not look away, and changes no convoy
//    control. Both branches start identical, so a fork with no change
//    gives exactly zero (tests/v3/funMetrics.test.ts).
//
//    The sim has no state copy, and its RNG keeps its state in a closure.
//    `forkableGame` sets a log's game up exactly as `setupGame` does but
//    with RNG streams that draw the same numbers and can be copied
//    (`CloneRng`), and `cloneGame` deep-copies the whole state. A fork
//    costs a copy, not a replay from the start.
//
// 2. TENSION. A per-second danger reading from the board, no forks: the
//    sum over live threats of weight (its damage over the hull it is aimed
//    at, capped at 1) times urgency (e^(−time to impact / TAU)), less a
//    little for a loaded gun. Per wave: peak, distinct peaks, the time to
//    release after each, the share of the wave that is hot and that is
//    calm, and a shape label.
//
// Pure (no DOM, no Node). The tools: tools/v3/map-report/report.ts (the
// bot report's per-wave saves and tension) and tools/v3/bot-fit/fun.ts
// (the player's own runs against the bot's mirrored ones).

import type { RNG } from '../../sim/rng';
import { hashSeed } from '../../sim/rng';
import { THREATS, VIP } from '../data/config';
import type { PickupKind } from '../data/config';
import { EVENT_WAVE } from '../data/events';
import type { AbilityId } from '../data/abilities';
import {
  lossLimit,
  pickUpgrade,
  press,
  pressMove,
  release,
  setFlow,
  setFormation,
  step,
  tap,
  timeToImpact,
  CARRIER_TARGET,
  type Game,
  type Threat,
} from './game';
import { Mimic, PERSONAS, YOU, type BotIO } from './mimic';
import { SIM_DT, applyCommand, logTelemetry, setupGame, type LogCommand, type PlayLog } from './playlog';
import { attachTelemetry, type TelEvent } from './telemetry';

// ---------------------------------------------------------------------------
// The constants (all tunable, all here)

export const FUN = {
  // ---- Saves
  /** A kill tap is tested when its threat was this close to impact (s). */
  scanTti: 3,
  /** A pickup grab is tested when some threat aimed at a hull was this close
   *  to impact (s). A nuke is always tested. */
  scanPickupTti: 4,
  /** How far forward a fork plays at most (s). */
  horizon: 9,
  /** After the threats a tap went for are gone in every branch, play on
   *  this much longer (s) for the losses they cause on the way out. */
  tail: 0.5,
  /** The delayed variant (s). */
  delay: 0.5,
  /** A last-second kill: the threat was under this from impact (s). */
  lastSecond: 1,
  /** Cover choice: another threat aimed at a hull due within this of the
   *  one tapped (s), both under `coverTti`. */
  coverWindow: 0.75,
  coverTti: 2,
  /** A save: the branch without the action loses this many more ships
   *  (mean over the bot's dice), and at least one more in half the dice. */
  minSaved: 0.5,
  // ---- Tension
  /** Urgency e^(−tti/TAU): 1 at impact, 0.37 at TAU seconds. */
  tau: 2,
  /** Threats further than this from impact add nothing (s). */
  ttiMax: 12,
  /** A threat whose kind deals no damage itself (a cluster, a bomber: it
   *  splits or drops) counts this much; a heavy counts `heavyDamage`. */
  dmgFallback: 2,
  heavyDamage: 6,
  /** A full rack takes this share off the danger (0: readiness ignored). */
  ready: 0.3,
  /** Sample every this many sim steps; a second's value is the mean. */
  sampleSteps: 6,
  /** Hot: the reading at or above this (a whole hull's worth of damage
   *  about half a second out, or a few smaller threats a second or two
   *  out). Calm: below `calm` (nothing much within a few seconds). A peak
   *  ends (is "released") when the reading falls below `release`. Set from
   *  the player's three v26 runs: a wave's reading runs 0.1-0.5 on average,
   *  its top 0.5-3. */
  hot: 0.75,
  calm: 0.2,
  release: 0.35,
  /** A wave is "pinned" when this share of it is hot. */
  pinned: 0.3,
  /** "Rising": the last peak this much over the first. */
  rising: 1.15,
} as const;

// ---------------------------------------------------------------------------
// A game that can be copied

/** mulberry32, as src/sim/rng.ts's `makeRng`, with its state in a field so a
 *  copy draws the same numbers from then on. */
export class CloneRng implements RNG {
  constructor(public s: number) {}

  static of(seed: number | string): CloneRng {
    let s = (typeof seed === 'string' ? hashSeed(seed) : seed) >>> 0;
    if (s === 0) s = 0x9e3779b9;
    return new CloneRng(s);
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
  fork(label: string): RNG {
    return CloneRng.of((this.s ^ hashSeed(label)) >>> 0);
  }
}

/** A copy of a closure RNG (src/sim/rng.ts's `makeRng`) that started at
 *  state `s0`. Its state is s0 plus the draws so far times mulberry32's
 *  step, and `fork` reads the state without drawing, so the draws are
 *  counted by matching a fork of each. */
export function cloneRngOf(rng: RNG, s0: number, maxDraws = 1_000_000): CloneRng {
  const want = rng.fork('fun-sync').next();
  for (let n = 0; n <= maxDraws; n++) {
    const c = new CloneRng((s0 + Math.imul(n, 0x6d2b79f5)) >>> 0);
    if (c.fork('fun-sync').next() === want) return c;
  }
  throw new Error('cloneRngOf: RNG state not found');
}

/** A log's game before its first step (`setupGame`), with its RNG streams
 *  swapped for copyable ones that stand where they stood (`createGame` and
 *  the setup already drew from some). */
export function forkableGame(log: PlayLog): Game {
  const g = setupGame(log);
  const root = CloneRng.of(log.seed);
  for (const k of Object.keys(g.rng) as (keyof Game['rng'])[]) g.rng[k] = cloneRngOf(g.rng[k], (root.fork(k) as CloneRng).s);
  return g;
}

/** A deep copy of a game (from `forkableGame`): every array, object, Set and
 *  Map in its state, shared references kept shared. The map (static data)
 *  is shared; telemetry is left off the copy. */
export function cloneGame(g: Game): Game {
  const seen = new Map<unknown, unknown>();
  seen.set(g.map, g.map);
  const copy = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    const hit = seen.get(v);
    if (hit !== undefined) return hit;
    if (Array.isArray(v)) {
      const out: unknown[] = new Array(v.length);
      seen.set(v, out);
      for (let i = 0; i < v.length; i++) out[i] = copy(v[i]);
      return out;
    }
    if (v instanceof Set) {
      const out = new Set<unknown>();
      seen.set(v, out);
      for (const x of v) out.add(copy(x));
      return out;
    }
    if (v instanceof Map) {
      const out = new Map<unknown, unknown>();
      seen.set(v, out);
      for (const [k, x] of v) out.set(copy(k), copy(x));
      return out;
    }
    if (Object.isFrozen(v)) return v;
    const out = Object.create(Object.getPrototypeOf(v)) as Record<string, unknown>;
    seen.set(v, out);
    for (const k of Object.keys(v)) out[k] = copy((v as Record<string, unknown>)[k]);
    return out;
  };
  const tel = g.tel;
  g.tel = null;
  try {
    return copy(g) as Game;
  } finally {
    g.tel = tel;
  }
}

// ---------------------------------------------------------------------------
// Tension

/** What a threat would cost the hull it is aimed at, 0-1: its damage over
 *  that hull's points (a ship's, or the carrier's), capped at 1. 0 for a
 *  threat aimed at nothing. */
export function threatWeight(g: Game, th: Threat): number {
  const base = THREATS[th.kind]?.damage ?? 0;
  const dmg = th.kind === 'heavy' ? FUN.heavyDamage : base > 0 ? base : FUN.dmgFallback;
  let hull: number;
  if (th.target === CARRIER_TARGET) hull = g.carrierHp;
  else {
    const s = g.ships.find((x) => x.id === th.target);
    if (!s) return 0;
    hull = s.hp;
  }
  if (!(hull > 0)) return 0;
  return Math.min(1, dmg / hull);
}

/** The danger on the board now (see the file's header). */
export function tensionNow(g: Game): number {
  let raw = 0;
  for (const th of g.threats) {
    if (th.dead) continue;
    const tti = timeToImpact(g, th);
    if (!(tti < FUN.ttiMax)) continue;
    const w = threatWeight(g, th);
    if (!w) continue;
    raw += w * Math.exp(-Math.max(0, tti) / FUN.tau);
  }
  if (!raw) return 0;
  const rack = Math.max(1, g.stats.rack);
  const ready = g.ammo > 0 ? Math.min(1, g.ammo / rack) : 0;
  return raw * (1 - FUN.ready * ready);
}

export type Shape = 'flat' | 'single' | 'sawtooth' | 'rising' | 'pinned';
export const SHAPE_NAMES: Record<Shape, string> = {
  flat: 'flat',
  single: 'one peak',
  sawtooth: 'sawtooth',
  rising: 'sawtooth rising',
  pinned: 'pinned',
};

export interface TensionStats {
  /** Seconds read. */
  n: number;
  mean: number;
  peak: number;
  /** Distinct peaks: stretches at or above `hot`, apart when the reading
   *  falls below `release` between them. */
  peaks: number;
  /** Each peak's height, in order. */
  heights: number[];
  /** Mean seconds from a peak's top to below `release` (a peak still up as
   *  the wave ends counts to the end). */
  releaseS: number;
  hotShare: number;
  calmShare: number;
  shape: Shape;
}

/** A wave's per-second readings, judged. */
export function tensionStats(series: number[]): TensionStats {
  const n = series.length;
  const heights: number[] = [];
  const releases: number[] = [];
  let inPeak = false;
  let top = 0;
  let topAt = 0;
  for (let k = 0; k < n; k++) {
    const v = series[k];
    if (!inPeak && v >= FUN.hot) {
      inPeak = true;
      top = v;
      topAt = k;
    } else if (inPeak) {
      if (v > top) {
        top = v;
        topAt = k;
      }
      if (v < FUN.release) {
        inPeak = false;
        heights.push(top);
        releases.push(k - topAt);
      }
    }
  }
  if (inPeak) {
    heights.push(top);
    releases.push(n - topAt);
  }
  const hot = series.filter((v) => v >= FUN.hot).length;
  const calm = series.filter((v) => v < FUN.calm).length;
  const hotShare = n ? hot / n : 0;
  let shape: Shape;
  if (!heights.length) shape = 'flat';
  else if (hotShare >= FUN.pinned) shape = 'pinned';
  else if (heights.length === 1) shape = 'single';
  else shape = heights[heights.length - 1] >= heights[0] * FUN.rising ? 'rising' : 'sawtooth';
  return {
    n,
    mean: n ? series.reduce((a, b) => a + b, 0) / n : 0,
    peak: n ? Math.max(...series) : 0,
    peaks: heights.length,
    heights,
    releaseS: releases.length ? releases.reduce((a, b) => a + b, 0) / releases.length : 0,
    hotShare,
    calmShare: n ? calm / n : 0,
    shape,
  };
}

/** Pearson correlation (NaN with under 3 points or no spread). */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return NaN;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

// ---------------------------------------------------------------------------
// Saves

export type SaveKind = 'nuke' | 'pickup' | 'cover' | 'lastSecond' | 'kill';
export const SAVE_NAMES: Record<SaveKind, string> = {
  nuke: 'nuke save',
  pickup: 'pickup save',
  cover: 'cover choice',
  lastSecond: 'last-second kill',
  kill: 'kill save',
};
export type Stake = 'run' | 'last' | 'limit';

/** A player action worth a fork. */
export interface Action {
  /** Index of its command in the log. */
  i: number;
  step: number;
  wave: number;
  /** Seconds into the wave. */
  t: number;
  what: 'kill' | 'nuke' | 'pickup';
  /** The threat a kill tap went for, and its seconds to impact then. */
  thr?: number;
  thrKind?: string;
  /** Seconds to impact: of the threat tapped, or (a pickup, a nuke) of the
   *  nearest threat aimed at a hull. */
  margin: number;
  /** A pickup: its kind, and the weapon it loads. */
  pk?: PickupKind;
  w?: AbilityId;
  /** Cover choice: the other threat due with the one tapped. */
  rival?: number;
  /** A pickup or a nuke: the threats aimed at a hull within
   *  `scanPickupTti` of impact then (the danger it answered; the fork
   *  follows them). */
  near?: number[];
}

export interface Save extends Action {
  kind: SaveKind;
  /** Ships the action saved: the branch without it, less the branch with it
   *  (mean over the dice). */
  saved: number;
  /** The same for each roll of the bot's dice. */
  perDie: number[];
  /** The same over every loss in the fork, whatever sank it (information:
   *  chance moves it, see `lostIn`). */
  savedAll: number;
  /** Ships the branch with the action 0.5 s later lost over the branch as
   *  played (the timing's worth). */
  delayCost: number;
  /** Cover choice: what tapping the other threat would have cost. */
  swapCost?: number;
  stakes: Stake[];
  /** Ships afloat, and losses left before the run ends, at the action. */
  afloat: number;
  left: number;
  /** Seconds the fork played. */
  horizon: number;
}

export interface FunOpts {
  /** The bot that plays on in every branch (default "you"; "none": nobody
   *  plays on, the log's later inputs dropped). */
  persona?: string;
  /** Rolls of the bot's dice per branch (default 1). */
  dice?: number;
  /** Test no fork (tension only). */
  noSaves?: boolean;
  /** Only these actions (tests). */
  only?: (a: Action) => boolean;
  /** `save` (default). `placebo`, the noise floor: at each action, two
   *  branches that both keep it and differ only in the bot's dice; the
   *  "saves" found are false ones, and their rate says how far a single
   *  save can be trusted. `noop`: the same, same dice (must find nothing). */
  mode?: ForkMode;
  /** Keep every fork's record in `judged`, save or not (tests). */
  judgeAll?: boolean;
  /** A pickup or nuke grab's "removed" branch has no such pickup (else it
   *  stays on the water and the warm bot grabs it a moment later). Off by
   *  default, so earlier results compare (2026-11-19). */
  gone?: boolean;
}

/** One wave's fun numbers. */
export interface FunWave {
  wave: number;
  seconds: number;
  tension: TensionStats;
  series: number[];
  /** Taps a second over the wave. */
  taps: number[];
  /** Correlation of the tension with the taps, second by second. */
  tapR: number;
  /** Pickups grabbed: seconds each had been on the water. */
  grabAges: number[];
  saves: Save[];
  /** Actions forked on this wave. */
  tested: number;
}

export interface FunResult {
  map: string;
  seed: number;
  /** The waves played (index 0 = wave 1, up to 12 = boss round 3; a wave not
   *  reached is absent, i.e. undefined). */
  waves: (FunWave | undefined)[];
  saves: Save[];
  tested: number;
  /** Did the replay end where the log says? (false: this build plays the
   *  log differently, and the numbers are of another game). */
  exact: boolean;
  /** Across waves: the correlation of a wave's mean tension with how fast
   *  its pickups were grabbed (median age at the grab; negative: grabbed
   *  faster when tense). */
  grabR: number;
  ms: { scan: number; forks: number; branches: number };
  /** With `judgeAll`: every fork, save or not. */
  judged?: Save[];
}

const WAVES = 13;

/** Wave index 1-13 of the game now, 0 in a bonus wave. */
function waveNow(g: Game): number {
  if (g.event?.bonus) return 0;
  return g.wave >= 1 && g.wave <= WAVES ? g.wave : 0;
}

/** The threats aimed at a hull, with their seconds to impact. */
function aimed(g: Game): { th: Threat; tti: number }[] {
  const out: { th: Threat; tti: number }[] = [];
  for (const th of g.threats) {
    if (th.dead || th.target === -2) continue;
    const tti = timeToImpact(g, th);
    if (tti < FUN.ttiMax && threatWeight(g, th) > 0) out.push({ th, tti });
  }
  return out;
}

/** Pass 1: replay the log with telemetry, read the tension, the taps and the
 *  grabs, and find the actions worth a fork. */
function scan(log: PlayLog) {
  const g = forkableGame(log);
  logTelemetry(g, log, 'replay');
  const cmds = log.commands;
  const series = new Map<number, { sum: number[]; n: number[] }>();
  const taps = new Map<number, number[]>();
  const grabs = new Map<number, number[]>();
  /** Fire taps by threat: the last one at each (index, tti, rival...). */
  const lastTap = new Map<number, Action>();
  const pickups: Action[] = [];
  const bin = (m: Map<number, number[]>, w: number, sec: number, v: number) => {
    const a = m.get(w) ?? (m.set(w, []).get(w) as number[]);
    while (a.length <= sec) a.push(0);
    a[sec] += v;
  };
  let i = 0;
  let sinceSample = 0;
  for (let guard = 0; guard < 10_000_000; guard++) {
    while (i < cmds.length && cmds[i][0] <= g.steps) {
      const c = cmds[i];
      const w = waveNow(g);
      if (c[1] === 't' && g.phase === 'wave' && w) {
        bin(taps, w, Math.floor(g.waveT), 1);
        const before = new Map(g.pickups.map((p) => [p.id, p]));
        const live = aimed(g);
        const nTel = g.tel!.events.length;
        applyCommand(g, c);
        const ev = g.tel!.events.slice(nTel).find((e) => e.k === 'tap') as Extract<TelEvent, { k: 'tap' }> | undefined;
        const minTti = live.length ? Math.min(...live.map((x) => x.tti)) : 99;
        if (ev?.res === 'pickup') {
          const got = [...before.values()].find((p) => !g.pickups.some((q) => q.id === p.id));
          if (got) {
            (grabs.get(w) ?? (grabs.set(w, []).get(w) as number[])).push(got.age);
            const nuke = got.kind === 'nuke';
            if (nuke || minTti <= FUN.scanPickupTti)
              pickups.push({
                i,
                step: c[0],
                wave: w,
                t: g.waveT,
                what: nuke ? 'nuke' : 'pickup',
                margin: minTti,
                pk: got.kind,
                ...(got.weapon ? { w: got.weapon } : {}),
                near: live.filter((x) => x.tti <= FUN.scanPickupTti).map((x) => x.th.id),
              });
          }
        } else if (ev?.res === 'fire' && ev.thr !== undefined) {
          const me = live.find((x) => x.th.id === ev.thr);
          if (me) {
            const rivals = live.filter((x) => x.th.id !== me.th.id && Math.abs(x.tti - me.tti) <= FUN.coverWindow && x.tti <= FUN.coverTti);
            rivals.sort((a, b) => Math.abs(a.tti - me.tti) - Math.abs(b.tti - me.tti));
            lastTap.set(me.th.id, {
              i,
              step: c[0],
              wave: w,
              t: g.waveT,
              what: 'kill',
              thr: me.th.id,
              thrKind: me.th.kind,
              margin: me.tti,
              ...(me.tti <= FUN.coverTti && rivals.length ? { rival: rivals[0].th.id } : {}),
            });
          }
        }
      } else applyCommand(g, c);
      i++;
    }
    if (g.phase === 'lost') break;
    if (g.phase !== 'wave') {
      if (i >= cmds.length || cmds[i][0] > g.steps) break;
      continue;
    }
    if (++sinceSample >= FUN.sampleSteps) {
      sinceSample = 0;
      const w = waveNow(g);
      if (w) {
        const sec = Math.floor(g.waveT);
        const s = series.get(w) ?? (series.set(w, { sum: [], n: [] }).get(w) as { sum: number[]; n: number[] });
        while (s.sum.length <= sec) {
          s.sum.push(0);
          s.n.push(0);
        }
        s.sum[sec] += tensionNow(g);
        s.n[sec] += 1;
      }
    }
    step(g, SIM_DT);
  }
  // The telemetry says which threats the player's own hand hurt or killed.
  const handHurt = new Set<number>();
  for (const e of g.tel!.events) if (e.k === 'hurt' && e.tap) handHurt.add(e.id);
  const kills = [...lastTap.values()].filter((a) => handHurt.has(a.thr!) && a.margin <= FUN.scanTti);
  const actions = [...kills, ...pickups].sort((a, b) => a.i - b.i);
  const s = log.summary;
  const exact = !s || (g.steps === s.steps && g.lost === s.lost && g.score === s.score);
  return { g, series, taps, grabs, actions, exact };
}

/** The bot that plays on in a branch: warm (it has seen everything on the
 *  board), focused (no look-away), and leaving the convoy controls alone. */
function warmBot(g: Game, persona: string, seed: number, dice: number): Mimic | null {
  if (persona === 'none') return null;
  const p = PERSONAS[persona] ?? YOU;
  const bot = new Mimic(p, seed, dice);
  const b = bot as unknown as {
    flowPlan: unknown;
    formationPlan: unknown;
    start: number | null;
    moodWave: number;
    moodK: number;
    nextLapse: number | null;
    noticeAt: Map<number, number>;
    pace: number;
  };
  b.flowPlan = null;
  b.formationPlan = null;
  b.start = g.t;
  b.moodWave = g.wave;
  b.moodK = 1;
  b.pace = p.speed ?? 1;
  b.nextLapse = Infinity;
  for (const th of g.threats) b.noticeAt.set(th.id, g.t - 1);
  return bot;
}

function botIO(g: Game): BotIO {
  return {
    tap: (x, y, r) => tap(g, x, y, r),
    pick: (id, rep) => pickUpgrade(g, id, rep),
    flow: (v) => setFlow(g, v),
    formation: (id) => setFormation(g, id),
    press: (x, y, r) => press(g, x, y, r),
    move: (x, y) => pressMove(g, x, y),
    release: (x, y, r) => release(g, x, y, r),
  };
}

interface Branch {
  g: Game;
  /** null: nobody plays on (persona "none"). */
  bot: Mimic | null;
  io: BotIO;
  lost0: number;
  /** A late action: at this step, do it. */
  later?: { at: number; run: (g: Game) => void };
  /** The threats followed (a kill tap's and what split off it). */
  follow: Set<number>;
  resolvedAt: number;
}

function branch(base: Game, persona: string, seed: number, dice: number, follow: number[]): Branch {
  const g = cloneGame(base);
  // The branch's own telemetry: which threat dealt each blow (`lostIn`).
  attachTelemetry(g, { runId: 'fork', build: 'sim', logVersion: 0, firstWave: g.wave, mode: 'replay', player: 'fork' });
  return { g, bot: warmBot(g, persona, seed, dice), io: botIO(g), lost0: g.lost, follow: new Set(follow), resolvedAt: follow.length ? -1 : Infinity };
}

/** Play the branches in step, until the threats followed are gone in all
 *  of them (plus the tail) or the horizon. Returns the steps played. */
function playBranches(bs: Branch[], following: boolean): number {
  const cap = Math.round(FUN.horizon / SIM_DT);
  const tail = Math.round(FUN.tail / SIM_DT);
  let n = 0;
  for (; n < cap; n++) {
    let anyOn = false;
    for (const b of bs) {
      const g = b.g;
      if (b.later && n >= b.later.at) {
        if (g.phase === 'wave') b.later.run(g);
        b.later = undefined;
      }
      if (g.phase !== 'wave') continue;
      anyOn = true;
      b.bot?.act(g, b.io, false);
      step(g, SIM_DT);
      if (following && b.resolvedAt < 0) {
        for (const th of g.threats) if (th.src !== undefined && b.follow.has(th.src)) b.follow.add(th.id);
        if (!g.threats.some((th) => !th.dead && b.follow.has(th.id))) b.resolvedAt = n;
      }
    }
    if (!anyOn) break;
    if (following && bs.every((b) => b.resolvedAt >= 0 || b.g.phase !== 'wave' || b.later) && n >= Math.max(...bs.map((b) => (b.resolvedAt < 0 ? 0 : b.resolvedAt))) + tail) break;
  }
  return n;
}

/** Ships a branch lost to the threats it follows: a ship sunk in the fork
 *  that one of them (or what split off or was fired from it) hit in the
 *  fork. A VIP counts VIP.loss, as the game counts it. Losses to anything
 *  else are left out: once two branches differ, the bot's later taps differ
 *  too, and what that does elsewhere on the board is chance, not the
 *  action (the placebo measures it). Following nothing (a nuke with no
 *  threat near): every loss. */
function lostIn(b: Branch): number {
  if (!b.follow.size) return b.g.lost - b.lost0;
  const ev = b.g.tel?.events ?? [];
  const struck = new Set<number>();
  for (const e of ev) if (e.k === 'hit' && e.vt === 's' && e.src !== undefined && b.follow.has(e.src) && (e.hp > 0 || e.sunk)) struck.add(e.vid);
  let n = 0;
  for (const e of ev) if (e.k === 'ship-' && e.why === 'sunk' && struck.has(e.id)) n += e.vip ? VIP.loss : 1;
  return n;
}
const lostAll = (b: Branch) => b.g.lost - b.lost0;

/** A save: the branch without the action lost `minSaved` ships more on
 *  average over the dice, and at least one more in half of them. */
export function isSave(perDie: number[]): boolean {
  return mean(perDie) >= FUN.minSaved && perDie.filter((v) => v >= 1).length * 2 >= perDie.length;
}
const afloat = (g: Game) => g.ships.filter((s) => s.hp > 0).length;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Fork one action (the game just before its command) and judge it. */
/** How a fork compares: `save` the action against no action (and the
 *  variants); `placebo` the action against itself with the bot's dice
 *  rolled differently (the noise floor); `noop` the action against itself,
 *  same dice (must give exactly 0). */
export type ForkMode = 'save' | 'placebo' | 'noop';

/** Judge one action: `base` is the game just before its command. Returns
 *  the save, or null when the action saved nothing (`judge` true: the save
 *  record whatever it found, for tests). */
export function forkAction(base: Game, cmd: LogCommand, a: Action, persona: string, dice: number, seed: number, mode: ForkMode = 'save', judge = false, gone = false): Save | null {
  const placebo = mode !== 'save';
  const follow = a.what === 'kill' && a.thr !== undefined ? [a.thr, ...(a.rival !== undefined ? [a.rival] : [])] : (a.near ?? []);
  const dAct: number[] = [];
  const dCut: number[] = [];
  const dLate: number[] = [];
  const dSwap: number[] = [];
  const runLost: number[] = [];
  const lastLost: number[] = [];
  const dAll: number[] = [];
  let horizon = 0;
  const lateStep = Math.round(FUN.delay / SIM_DT);
  for (let d = 0; d < dice; d++) {
    const bSeed = (seed ^ Math.imul(a.step + 1, 0x9e3779b1)) >>> 0;
    const act = branch(base, persona, bSeed, d, follow);
    const had = act.g.pickups.map((p) => p.id);
    applyCommand(act.g, cmd);
    // The placebo (the noise floor): the "cut" branch keeps the action and
    // only rolls the bot's dice differently.
    const cut = branch(base, persona, bSeed, mode === 'placebo' ? d + 1000 : d, follow);
    if (placebo) applyCommand(cut.g, cmd);
    // `gone` (2026-11-19): without a pickup's grab, the pickup is not there
    // at all. Left on the water, the warm bot grabs it itself a step or two
    // later, so a grab only counts when those few steps matter (the
    // Battery playtest's "clutch nuke" read as no save that way).
    else if (gone && a.what !== 'kill') {
      const took = new Set(had.filter((id) => !act.g.pickups.some((p) => p.id === id)));
      cut.g.pickups = cut.g.pickups.filter((p) => !took.has(p.id));
    }
    const late = branch(base, persona, bSeed, d, follow);
    late.later = {
      at: lateStep,
      run: (g) => {
        if (a.what === 'kill') {
          const th = g.threats.find((x) => x.id === a.thr && !x.dead);
          if (th) tap(g, th.x, th.y, cmd[4] as number);
        } else applyCommand(g, cmd);
      },
    };
    const bs = placebo ? [act, cut] : [act, cut, late];
    let swap: Branch | null = null;
    if (a.rival !== undefined && !placebo) {
      swap = branch(base, persona, bSeed, d, follow);
      const rv = swap.g.threats.find((x) => x.id === a.rival);
      if (rv) tap(swap.g, rv.x, rv.y, cmd[4] as number);
      bs.push(swap);
    }
    horizon = Math.max(horizon, playBranches(bs, follow.length > 0) * SIM_DT);
    dAct.push(lostIn(act));
    dCut.push(lostIn(cut));
    dLate.push(lostIn(late));
    if (swap) dSwap.push(lostIn(swap));
    const mattered = dCut[d] > dAct[d];
    runLost.push(mattered && cut.g.phase === 'lost' && act.g.phase !== 'lost' ? 1 : 0);
    lastLost.push(mattered && afloat(cut.g) === 0 && afloat(act.g) > 0 ? 1 : 0);
    dAll.push(lostAll(cut) - lostAll(act));
  }
  const perDie = dCut.map((v, k) => v - dAct[k]);
  const saved = mean(perDie);
  if (!judge && !isSave(perDie)) return null;
  const swapCost = dSwap.length ? mean(dSwap) - mean(dAct) : undefined;
  let kind: SaveKind;
  if (a.what === 'nuke') kind = 'nuke';
  else if (a.what === 'pickup') kind = 'pickup';
  else if (swapCost !== undefined && swapCost >= FUN.minSaved) kind = 'cover';
  else if (a.margin < FUN.lastSecond) kind = 'lastSecond';
  else kind = 'kill';
  const left = lossLimit(base) - (base.lost - base.lossBase);
  const stakes: Stake[] = [];
  if (mean(runLost) >= 0.5) stakes.push('run');
  if (mean(lastLost) >= 0.5) stakes.push('last');
  if (left <= 1) stakes.push('limit');
  return {
    ...a,
    kind,
    saved: round(saved, 2),
    perDie,
    savedAll: round(mean(dAll), 2),
    delayCost: round(mean(dLate) - mean(dAct), 2),
    ...(swapCost !== undefined ? { swapCost: round(swapCost, 2) } : {}),
    stakes,
    afloat: afloat(base),
    left,
    horizon: round(horizon, 2),
  };
}

/** Both measures on one log. */
export function funOfLog(log: PlayLog, o: FunOpts = {}): FunResult {
  const t0 = now();
  const sc = scan(log);
  const t1 = now();
  const persona = o.persona ?? 'you';
  const dice = Math.max(1, o.dice ?? 1);
  const actions = o.noSaves ? [] : o.only ? sc.actions.filter(o.only) : sc.actions;
  const saves: Save[] = [];
  const judged: Save[] = [];
  const mode = o.mode ?? 'save';
  let branches = 0;
  if (actions.length) {
    // Pass 2: replay again on a copyable game, forking at each action.
    const g = forkableGame(log);
    const cmds = log.commands;
    const due = new Map(actions.map((a) => [a.i, a]));
    let i = 0;
    const seed = (log.seed ^ 0xf0f0) >>> 0;
    for (let guard = 0; guard < 10_000_000 && due.size; guard++) {
      while (i < cmds.length && cmds[i][0] <= g.steps) {
        const a = due.get(i);
        if (a) {
          const s = forkAction(g, cmds[i], a, persona, dice, seed, mode, o.judgeAll, o.gone);
          branches += dice * (mode !== 'save' ? 2 : a.rival !== undefined ? 4 : 3);
          if (s && o.judgeAll) judged.push(s);
          if (s && isSave(s.perDie)) saves.push(s);
          due.delete(i);
        }
        applyCommand(g, cmds[i++]);
      }
      if (g.phase === 'lost') break;
      if (g.phase !== 'wave') {
        if (i >= cmds.length || cmds[i][0] > g.steps) break;
        continue;
      }
      step(g, SIM_DT);
    }
  }
  const t2 = now();
  const waves: (FunWave | undefined)[] = [];
  for (let w = 1; w <= WAVES; w++) {
    const s = sc.series.get(w);
    if (!s) continue;
    const series = s.sum.map((v, k) => (s.n[k] ? round(v / s.n[k], 3) : 0));
    const tp = (sc.taps.get(w) ?? []).slice(0, series.length);
    while (tp.length < series.length) tp.push(0);
    const mine = saves.filter((x) => x.wave === w);
    waves[w - 1] = {
      wave: w,
      seconds: series.length,
      tension: tensionStats(series),
      series,
      taps: tp,
      tapR: pearson(series, tp),
      grabAges: (sc.grabs.get(w) ?? []).map((v) => round(v, 2)),
      saves: mine,
      tested: actions.filter((a) => a.wave === w).length,
    };
  }
  const withGrabs = waves.filter((w): w is FunWave => !!w && w.grabAges.length > 0);
  const grabR = pearson(
    withGrabs.map((w) => w.tension.mean),
    withGrabs.map((w) => median(w.grabAges)),
  );
  return {
    map: log.map,
    seed: log.seed,
    waves,
    saves,
    tested: actions.length,
    exact: sc.exact,
    grabR,
    ms: { scan: Math.round(t1 - t0), forks: Math.round(t2 - t1), branches },
    ...(o.judgeAll ? { judged } : {}),
  };
}

// ---------------------------------------------------------------------------
// Summaries (the bot report and the calibration table)

/** A run's fun, wave by wave, small enough to keep in a report's JSON. */
export interface FunDigest {
  seed: number;
  /** Per wave (index 0 = wave 1 ... 12 = boss round 3); a wave not played
   *  is null. */
  waves: (null | {
    saves: number;
    saved: number;
    kinds: Partial<Record<SaveKind, number>>;
    /** Saves with stakes (the run, the last ship, at the loss limit). */
    big: number;
    /** Saves the 0.5 s later version also loses (the timing mattered). */
    clutch: number;
    tested: number;
    peak: number;
    peaks: number;
    releaseS: number;
    hotShare: number;
    calmShare: number;
    mean: number;
    shape: Shape;
    tapR: number;
  })[];
  ms: number;
  exact: boolean;
}

export function funDigest(r: FunResult): FunDigest {
  const waves: FunDigest['waves'] = [];
  for (let k = 0; k < WAVES; k++) {
    const w = r.waves[k];
    if (!w) {
      waves.push(null);
      continue;
    }
    const kinds: Partial<Record<SaveKind, number>> = {};
    for (const s of w.saves) kinds[s.kind] = (kinds[s.kind] ?? 0) + 1;
    const t = w.tension;
    waves.push({
      saves: w.saves.length,
      saved: round(w.saves.reduce((a, s) => a + s.saved, 0), 2),
      kinds,
      big: w.saves.filter((s) => s.stakes.length).length,
      clutch: w.saves.filter((s) => s.delayCost >= FUN.minSaved).length,
      tested: w.tested,
      peak: round(t.peak, 2),
      peaks: t.peaks,
      releaseS: round(t.releaseS, 2),
      hotShare: round(t.hotShare, 3),
      calmShare: round(t.calmShare, 3),
      mean: round(t.mean, 3),
      shape: t.shape,
      tapR: round(w.tapR, 3),
    });
  }
  return { seed: r.seed, waves, ms: r.ms.scan + r.ms.forks, exact: r.exact };
}

/** A wave's fun over many runs. */
export interface FunWaveSummary {
  wave: number;
  /** Runs that played it. */
  n: number;
  saves: number;
  saved: number;
  big: number;
  clutch: number;
  kinds: Partial<Record<SaveKind, number>>;
  /** Share of runs with no save on the wave. */
  none: number;
  peak: number;
  peaks: number;
  releaseS: number;
  hotShare: number;
  calmShare: number;
  /** The most common shape, and each shape's share. */
  shape: Shape;
  shapes: Partial<Record<Shape, number>>;
  tapR: number;
}

export function funSummary(ds: FunDigest[]): FunWaveSummary[] {
  const out: FunWaveSummary[] = [];
  for (let k = 0; k < WAVES; k++) {
    const on = ds.map((d) => d.waves[k]).filter((w): w is NonNullable<FunDigest['waves'][number]> => !!w);
    const n = on.length;
    const kinds: Partial<Record<SaveKind, number>> = {};
    const shapes: Partial<Record<Shape, number>> = {};
    for (const w of on) {
      for (const [kk, v] of Object.entries(w.kinds)) kinds[kk as SaveKind] = (kinds[kk as SaveKind] ?? 0) + (v ?? 0) / n;
      shapes[w.shape] = (shapes[w.shape] ?? 0) + 1 / n;
    }
    const shape = (Object.entries(shapes).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? 'flat') as Shape;
    const m = (f: (w: (typeof on)[number]) => number) => (n ? mean(on.map(f).filter(Number.isFinite)) : NaN);
    out.push({
      wave: k + 1,
      n,
      saves: m((w) => w.saves),
      saved: m((w) => w.saved),
      big: m((w) => w.big),
      clutch: m((w) => w.clutch),
      kinds,
      none: n ? on.filter((w) => !w.saves).length / n : NaN,
      peak: m((w) => w.peak),
      peaks: m((w) => w.peaks),
      releaseS: m((w) => w.releaseS),
      hotShare: m((w) => w.hotShare),
      calmShare: m((w) => w.calmShare),
      shape,
      shapes,
      tapR: m((w) => w.tapR),
    });
  }
  return out;
}

/** The fun check (provisional, docs/design/v3-fun-metrics.md): on the
 *  "you" bot, each of waves 1-10 about 1-2 real saves, more in waves 8-10
 *  and the boss rounds. Flat: a wave with under FLAT_SAVES a run. Chaotic:
 *  over CHAOS_SAVES a run, most of them small (no stakes, not clutch). */
export const FUN_TARGET = { flat: 0.5, chaos: 4, low: 1, high: 2 } as const;

export interface FunVerdict {
  flat: number[];
  chaotic: number[];
  /** Waves 8-10 and the boss rounds have more saves than waves 1-7. */
  rising: boolean;
  value: string;
  verdict: 'PASS' | 'FLAG';
}

export function funVerdict(s: FunWaveSummary[]): FunVerdict {
  const core = s.slice(0, 10);
  const flat = core.filter((w) => w.n && w.saves < FUN_TARGET.flat).map((w) => w.wave);
  const chaotic = core.filter((w) => w.n && w.saves > FUN_TARGET.chaos && w.big + w.clutch < w.saves / 2).map((w) => w.wave);
  const early = mean(s.slice(0, 7).filter((w) => w.n).map((w) => w.saves));
  const lateW = [...s.slice(7, 10), ...s.slice(10, 13)].filter((w) => w.n);
  const late = mean(lateW.map((w) => w.saves));
  const rising = late > early;
  const f = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '–');
  return {
    flat,
    chaotic,
    rising,
    value: `saves a run: waves 1–7 ${f(early)}, 8–10 + boss ${f(late)}${flat.length ? `; flat (under ${FUN_TARGET.flat}) w${flat.join(', w')}` : ''}${chaotic.length ? `; chaotic w${chaotic.join(', w')}` : ''}`,
    verdict: flat.length || chaotic.length || !rising ? 'FLAG' : 'PASS',
  };
}

/** A wave's chip: "7", or "B2". */
export function waveName(w: number): string {
  return w >= EVENT_WAVE ? `B${w - EVENT_WAVE + 1}` : String(w);
}

function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function round(v: number, d: number): number {
  if (!Number.isFinite(v)) return v;
  const m = 10 ** d;
  return Math.round(v * m) / m;
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
