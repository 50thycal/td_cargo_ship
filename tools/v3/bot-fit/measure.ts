// One ruler for a person's run and a bot's run (map rebuild phase 2, "bots
// that play like you"; docs/design/v3-bot-refit.md). Everything here reads
// what a play log records on its own (per-wave losses, shots, tap results,
// the tap times, weapon pickups), so it works on a log of any version, even
// one this build no longer replays. Reaction time is the exception: it needs
// the threats on screen, so it replays the log and keeps only the waves that
// still replay exactly (the same losses and shots as the log recorded).
//
// Clocks: a person's rhythm and reaction are in real seconds (game seconds
// over the speed slider); a bot's over the game speed it plays at.

import type { ArmoryLevels } from '../../../src/v3/data/armory';
import { SIM_DT, applyCommand, setupGame, type LogCommand, type PlayLog } from '../../../src/v3/sim/playlog';
import { CARRIER_TARGET, released, step, timeToImpact, worthShooting, type Game } from '../../../src/v3/sim/game';

/** The Armory the player has played with since round 12 (every recent
 *  log): bot reports play with it, so their numbers are the player's game. */
export const PLAYER_ARMORY: ArmoryLevels = { reload: 5, repair: 4, stockpile: 5 };

/** Taps under this many real seconds apart are one burst. */
export const BURST_GAP = 0.3;
/** The eyes (reaction, targeting) are read on waves 1 to this, on both
 *  sides: a person's old logs replay exactly only for their first waves,
 *  and later waves are busier, so a bot read on every wave would look
 *  slower and more frantic than it is. */
export const EYES_TO = 5;
/** A tap within this many world units of a threat counts as a tap at it. */
const REACH = 108;

export interface RunMeasure {
  id: string;
  who: 'you' | 'bot';
  map: string;
  /** The Test Lab card (map cards), or 'campaign'. */
  card: string;
  v: number;
  end: string;
  /** The last wave played, and whether the run was won. */
  wave: number;
  won: boolean;
  /** Ships lost on each wave (index 0 = wave 1); game seconds each wave took. */
  lost: number[];
  sec: number[];
  /** Shots fired, threats killed (by anything), tap results; all waves. */
  shots: number;
  kills: number;
  taps: { fire: number; pickup: number; dry: number; empty: number };
  /** Real seconds of wave play (over the speed in use), and the share of it
   *  played above 1×. */
  realSec: number;
  fastShare: number;
  /** Tap rhythm (real seconds): taps a burst, the gap inside a burst, the
   *  rest between bursts. */
  bursts: number[];
  gaps: number[];
  rests: number[];
  /** Weapon pickups taken, by weapon, and the weapons held at the end. */
  uses: Record<string, number>;
  levels: Record<string, number>;
  /** What sank the ships (all waves), and the cards picked in order. */
  sunkBy: Record<string, number>;
  picks: string[];
  /** Reaction (real s) from a threat showing to the first tap at it, by
   *  threat kind, over the waves that still replay exactly (`exact`). */
  react: Record<string, number[]>;
  exact: number;
  /** Targeting, over the same waves: for each tap at a threat, its rank by
   *  time to impact among the threats on screen (0 = the most urgent), and
   *  the seconds it had left; and by kind, the threats that showed and the
   *  ones that got no tap before they died or hit. */
  rank: number[];
  ttiAtTap: number[];
  shown: Record<string, number>;
  untapped: Record<string, number>;
  /** Pickups collected over the same waves: real seconds from the drop to
   *  the tap, by kind ('weapon', 'supply' for a Supply Run, 'ammo',
   *  'repair', …). */
  grab: Record<string, number[]>;
}

/** A pickup's kind for the grab times: a Supply Run drop apart from the
 *  other weapon drops (it calls in a plane of them). */
const grabKind = (p: { kind: string; weapon?: string }) => (p.kind === 'weapon' ? (p.weapon === 'supplyRun' ? 'supply' : 'weapon') : p.kind);

const diff = (xs: number[]) => xs.map((v, k) => v - (k ? xs[k - 1] : 0));

/** The game speed in use at each step (a person's slider 's', a bot's own 'p'). */
function speedAt(cmds: LogCommand[], who: 'you' | 'bot', fallback: number): (stepN: number) => number {
  const code = who === 'bot' ? 'p' : 's';
  const marks = cmds.filter((c) => c[1] === code).map((c) => [c[0], c[2] as number] as const);
  return (s) => {
    let v = fallback;
    for (const [at, sp] of marks) if (at <= s) v = sp;
    return v;
  };
}

export function measure(log: PlayLog, who: 'you' | 'bot', opts: { react?: boolean; botSpeed?: number; eyesTo?: number } = {}): RunMeasure {
  const s = log.summary!;
  const waves = s.waves;
  const speed = speedAt(log.commands, who, who === 'bot' ? (opts.botSpeed ?? 1) : 1);
  // Wave windows in steps: a wave record's `t` is the game clock at its end.
  const ends = waves.map((w) => Math.round(w.t / SIM_DT));
  const waveOf = (st: number) => {
    const k = ends.findIndex((e) => st <= e);
    return k < 0 ? waves.length : k + 1;
  };
  let realSec = 0;
  let fast = 0;
  for (let st = 0; st < s.steps; st += 6) {
    const sp = speed(st);
    realSec += (6 * SIM_DT) / sp;
    if (sp > 1.01) fast += (6 * SIM_DT) / sp;
  }
  const tapSteps = log.commands.filter((c) => c[1] === 't' || c[1] === 'd').map((c) => c[0]);
  const bursts: number[] = [];
  const gaps: number[] = [];
  const rests: number[] = [];
  let run = 0;
  for (let k = 0; k < tapSteps.length; k++) {
    run++;
    const next = tapSteps[k + 1];
    if (next === undefined) break;
    const gap = ((next - tapSteps[k]) * SIM_DT) / speed(tapSteps[k]);
    const sameWave = waveOf(next) === waveOf(tapSteps[k]);
    if (gap < BURST_GAP) gaps.push(gap);
    else {
      bursts.push(run);
      run = 0;
      if (sameWave && gap < 15) rests.push(gap);
    }
  }
  if (run) bursts.push(run);
  const last = waves[waves.length - 1];
  const kills = Object.values(last?.kills ?? {}).reduce((a, b) => a + b, 0);
  const m: RunMeasure = {
    id: log.id,
    who,
    map: log.map,
    card: log.lab?.card ?? 'campaign',
    v: log.v,
    end: log.end ?? 'quit',
    wave: s.wave,
    won: log.end === 'won' || s.cleared,
    lost: diff(waves.map((w) => w.lost)),
    sec: diff(waves.map((w) => w.t)),
    shots: s.shots,
    kills,
    taps: { ...(last?.taps ?? { fire: 0, pickup: 0, dry: 0, empty: 0 }) },
    realSec,
    fastShare: realSec ? fast / realSec : 0,
    bursts,
    gaps,
    rests,
    uses: { ...(s.uses as Record<string, number>) },
    levels: { ...(s.levels as Record<string, number>) },
    sunkBy: Object.fromEntries(Object.entries(last?.sunkBy ?? {}).filter(([, v]) => v > 0)),
    picks: s.drafts.map((d) => d.picked),
    react: {},
    exact: 0,
    rank: [],
    ttiAtTap: [],
    shown: {},
    untapped: {},
    grab: {},
  };
  if (opts.react !== false) Object.assign(m, reactions(log, speed, opts.eyesTo ?? EYES_TO));
  return m;
}

/** Replays the log a wave at a time while it still matches what the log
 *  recorded, timing each threat from showing on screen to the first tap
 *  that lands within reach of it. */
type Eyes = Pick<RunMeasure, 'react' | 'exact' | 'rank' | 'ttiAtTap' | 'shown' | 'untapped' | 'grab'>;
function reactions(log: PlayLog, speed: (s: number) => number, eyesTo: number): Eyes {
  const rec = log.summary!.waves;
  const g: Game = setupGame(log);
  const cmds = log.commands;
  const seen = new Map<number, { at: number; kind: string; done: boolean; counted?: boolean; carrier: boolean }>();
  const pending: Record<string, number[]> = {};
  const react: Record<string, number[]> = {};
  const out: Eyes = { react, exact: 0, rank: [], ttiAtTap: [], shown: {}, untapped: {}, grab: {} };
  let wGrab: [string, number][] = [];
  // This wave's targeting, kept once the wave proves exact.
  let wRank: number[] = [];
  let wTti: number[] = [];
  let i = 0;
  let checked = 0;
  const on = (x: number, y: number) => x >= 0 && x <= 1600 && y >= 0 && y <= 900;
  for (let guard = 0; guard < 5_000_000; guard++) {
    while (i < cmds.length && cmds[i][0] <= g.steps) {
      const c = cmds[i++];
      if ((c[1] === 't' || c[1] === 'd') && g.phase === 'wave') {
        const live = worthShooting(g, g.threats).filter((th) => !th.dead && released(th) && on(th.x, th.y));
        let near = null as (typeof live)[number] | null;
        let nd = REACH;
        for (const th of live) {
          const d = Math.hypot(th.x - c[2], th.y - c[3]);
          if (d <= nd) {
            nd = d;
            near = th;
          }
        }
        if (near) {
          const tti = timeToImpact(g, near);
          wRank.push(live.filter((o) => timeToImpact(g, o) < tti).length);
          if (Number.isFinite(tti)) wTti.push(tti / speed(g.steps));
        }
        const before = new Map(g.pickups.map((pk) => [pk.id, pk] as const));
        applyCommand(g, c);
        const after = new Set(g.pickups.map((pk) => pk.id));
        for (const [id, pk] of before) if (!after.has(id)) wGrab.push([grabKind(pk), pk.age / speed(g.steps)]);
        for (const th of g.threats) {
          const s = seen.get(th.id);
          if (!s || s.done || th.dead) continue;
          if (Math.hypot(th.x - c[2], th.y - c[3]) <= REACH) {
            s.done = true;
            (pending[s.kind] ??= []).push(((g.steps - s.at) * SIM_DT) / speed(s.at));
          }
        }
        continue;
      }
      applyCommand(g, c);
    }
    // A wave just ended: keep its reactions only if it replayed exactly.
    while (checked < g.history.length) {
      const h = g.history[checked];
      const r = rec[checked];
      checked++;
      if (!r || h.lost !== r.lost || h.shots !== r.shots) return out;
      for (const [k, v] of Object.entries(pending)) (react[k] ??= []).push(...v);
      for (const k of Object.keys(pending)) delete pending[k];
      for (const [k, v] of wGrab) (out.grab[k] ??= []).push(v);
      wGrab = [];
      out.rank.push(...wRank);
      out.ttiAtTap.push(...wTti);
      wRank = [];
      wTti = [];
      for (const v of seen.values()) {
        if (v.counted) continue;
        v.counted = true;
        out.shown[v.kind] = (out.shown[v.kind] ?? 0) + 1;
        if (!v.done) out.untapped[v.kind] = (out.untapped[v.kind] ?? 0) + 1;
        if (v.carrier) {
          out.shown['@carrier'] = (out.shown['@carrier'] ?? 0) + 1;
          if (!v.done) out.untapped['@carrier'] = (out.untapped['@carrier'] ?? 0) + 1;
        } else if (v.kind === 'ballistic' || v.kind === 'guided') {
          out.shown['@ship'] = (out.shown['@ship'] ?? 0) + 1;
          if (!v.done) out.untapped['@ship'] = (out.untapped['@ship'] ?? 0) + 1;
        }
      }
      out.exact = checked;
      if (checked >= eyesTo) return out;
    }
    if (g.phase === 'lost' || g.phase === 'won') break;
    if (g.phase !== 'wave') {
      wRank = [];
      wTti = [];
      wGrab = [];
      if (i >= cmds.length || cmds[i][0] > g.steps) break;
      continue;
    }
    step(g, SIM_DT);
    for (const th of g.threats) if (!seen.has(th.id) && !th.dead && on(th.x, th.y)) seen.set(th.id, { at: g.steps, kind: th.kind, done: false, carrier: th.target === CARRIER_TARGET && (th.kind === 'ballistic' || th.kind === 'guided') });
  }
  return out;
}

// ---- Pooling runs into the numbers the fit compares ----

export const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const q = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

export interface Pooled {
  n: number;
  /** Mean ships lost a run: waves 1-5, 6-10; and a boss round, over the runs
   *  that reached it (a round a run reached but was lost on counts). */
  lost1to5: number;
  lost6to10: number;
  bossRound: number;
  bossN: number;
  /** Share of the runs that reached wave 6 having lost nothing. */
  clean5: number;
  /** Mean ships lost per wave played (waves 1-13): the curve. */
  curve: number[];
  /** Hands. */
  tapsPerSec: number;
  burst: number;
  gap: number;
  rest: number;
  rest90: number;
  fireShare: number;
  dryShare: number;
  emptyShare: number;
  pickupsPerMin: number;
  killsPerShot: number;
  fastShare: number;
  /** Eyes: median reaction (real s), all threats and by kind (n ≥ 5). */
  react: number;
  reactBy: Record<string, number>;
  /** Weapons: pickups taken a minute, and weapons held at the end. */
  usesPerMin: number;
  held: number;
  /** Targeting: share of taps at the most urgent threat on screen, and in
   *  the top three; median seconds to impact at the tap; share of each
   *  kind that got no tap at all. */
  urgent: number;
  top3: number;
  tti: number;
  untapped: Record<string, number>;
  /** Median real seconds from a drop to its tap, by pickup kind (n ≥ 3). */
  grab: Record<string, number>;
}

export function pool(runs: RunMeasure[]): Pooled {
  const all = (f: (r: RunMeasure) => number[]) => runs.flatMap(f);
  const sum = (f: (r: RunMeasure) => number) => runs.reduce((a, r) => a + f(r), 0);
  const upTo = (r: RunMeasure, a: number, b: number) => r.lost.slice(a - 1, b).reduce((x, y) => x + y, 0);
  const boss: number[] = [];
  for (const r of runs) for (let w = 11; w <= Math.min(13, r.wave); w++) boss.push(r.lost[w - 1] ?? 0);
  const reached6 = runs.filter((r) => r.wave >= 6);
  const curve = Array.from({ length: 13 }, (_, k) => mean(runs.filter((r) => r.wave >= k + 1).map((r) => r.lost[k] ?? 0)));
  const taps = sum((r) => r.taps.fire + r.taps.pickup + r.taps.dry + r.taps.empty);
  const realMin = sum((r) => r.realSec) / 60;
  const react: Record<string, number[]> = {};
  for (const r of runs) for (const [k, v] of Object.entries(r.react)) (react[k] ??= []).push(...v);
  const reactBy: Record<string, number> = {};
  for (const [k, v] of Object.entries(react)) if (v.length >= 5) reactBy[k] = median(v);
  return {
    n: runs.length,
    lost1to5: mean(runs.map((r) => upTo(r, 1, 5))),
    lost6to10: mean(runs.filter((r) => r.wave >= 6).map((r) => upTo(r, 6, 10))),
    bossRound: mean(boss),
    bossN: boss.length,
    clean5: reached6.length ? reached6.filter((r) => upTo(r, 1, 5) === 0).length / reached6.length : NaN,
    curve,
    tapsPerSec: taps / (realMin * 60),
    burst: mean(all((r) => r.bursts)),
    gap: median(all((r) => r.gaps)),
    rest: median(all((r) => r.rests)),
    rest90: q(all((r) => r.rests), 0.9),
    fireShare: sum((r) => r.taps.fire) / taps,
    dryShare: sum((r) => r.taps.dry) / taps,
    emptyShare: sum((r) => r.taps.empty) / taps,
    pickupsPerMin: sum((r) => r.taps.pickup) / realMin,
    killsPerShot: sum((r) => r.kills) / sum((r) => r.shots),
    fastShare: sum((r) => r.fastShare * r.realSec) / sum((r) => r.realSec),
    react: median(Object.values(react).flat()),
    reactBy,
    usesPerMin: sum((r) => Object.values(r.uses).reduce((a, b) => a + b, 0)) / realMin,
    held: mean(runs.map((r) => Object.keys(r.levels).length)),
    urgent: all((r) => r.rank).filter((k) => k === 0).length / all((r) => r.rank).length,
    top3: all((r) => r.rank).filter((k) => k < 3).length / all((r) => r.rank).length,
    tti: median(all((r) => r.ttiAtTap)),
    grab: (() => {
      const g: Record<string, number[]> = {};
      for (const r of runs) for (const [k, v] of Object.entries(r.grab ?? {})) (g[k] ??= []).push(...v);
      return Object.fromEntries(Object.entries(g).filter(([, v]) => v.length >= 3).map(([k, v]) => [k, median(v)]));
    })(),
    untapped: (() => {
      const shown: Record<string, number> = {};
      const un: Record<string, number> = {};
      for (const r of runs) for (const [k, v] of Object.entries(r.shown)) {
        shown[k] = (shown[k] ?? 0) + v;
        un[k] = (un[k] ?? 0) + (r.untapped[k] ?? 0);
      }
      return Object.fromEntries(Object.entries(shown).filter(([, v]) => v >= 10).map(([k, v]) => [k, un[k] / v]));
    })(),
  };
}
