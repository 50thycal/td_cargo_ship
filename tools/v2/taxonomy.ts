// The full interaction taxonomy (round 12): every knob a player turns, read
// tap by tap from a replayed log, so a human run and a bot run are measured
// by the same ruler. `trace` replays a log once and keeps one record per
// tap, threat, pickup and rail change; `METRICS` turns traces into numbers,
// family by family (docs/design/v2-bot-taxonomy.md has the list).
//
// Clocks: knobs about a person (reaction, rhythm, lapses) are in real
// seconds, so a human's game seconds are divided by the speed slider; a
// bot's are divided by its persona's speed (the slider it "plays at").
// Knobs about the game (outcomes) stay in game terms.

import { continueEndless, createGame, pickUpgrade, raidWarning, setFlow, setFormation, step, tap, timeToImpact, type TapResult, type Threat } from '../../src/v2/sim/game';
import { SIM_DT, type PlayLog } from '../../src/v2/sim/playlog';
import type { WaveRecord } from '../../src/v2/sim/game';

export interface TapEv {
  /** Real seconds from the run's start. */
  t: number;
  wave: number;
  x: number;
  y: number;
  result: TapResult;
  /** Game speed in use (1 for a bot). */
  speed: number;
  /** Live threats on screen. */
  live: number;
  /** The threat the tap went for (nearest), if any. */
  near: null | {
    id: number;
    kind: string;
    d: number;
    /** Tap offset along the threat's heading (+ ahead, − behind), and across it. */
    along: number;
    across: number;
    inRange: boolean;
    /** 0 = the most urgent threat on screen. */
    rank: number;
  };
  /** Seconds to impact of the most urgent threat on screen. */
  urgentTti: number;
  canFire: boolean;
  pickupsOn: number;
  /** It fired at a threat that already had enough interceptors on the way. */
  overkill: boolean;
}

export interface ThreatEv {
  id: number;
  kind: string;
  wave: number;
  born: number;
  firstTap?: number;
  gone?: number;
}

export interface Trace {
  id: string;
  map: string;
  who: 'you' | 'bot';
  /** Real seconds the run was played for (wave phase only), and of that,
   *  seconds with something on screen to shoot. */
  seconds: number;
  active: number;
  taps: TapEv[];
  threats: ThreatEv[];
  pickups: { born: number; got?: number }[];
  /** Stretches of ≥ LAPSE s with a threat on screen and no tap (start, length). */
  lapses: [number, number][];
  flow: [number, number][];
  formation: [number, string][];
  /** Real seconds spent at each game speed. */
  speedTime: Record<string, number>;
  raids: { warn: number; firstTap?: number }[];
  drafts: NonNullable<PlayLog['summary']>['drafts'];
  waves: WaveRecord[];
  /** Real seconds each wave took, and active seconds in it. */
  waveSecs: Record<number, { secs: number; active: number }>;
  end: { wave: number; lost: number; cleared: boolean; score: number; carrierHp: number };
}

/** A threat on screen for less than this isn't "seen" yet (lapse rule). */
const SEEN = 0.5;
/** No tap for this long with a seen threat on screen = a lapse. */
export const LAPSE = 2.5;

/** Replay `log` and trace who did what. `clock` = seconds of real time per
 *  game second for bot stretches (1 / persona speed). */
export function trace(log: PlayLog, opts: { who?: 'you' | 'bot'; botClock?: number } = {}): Trace {
  const g = createGame(log.map, log.seed, log.firstWave, log.tempo);
  let control: 'you' | 'bot' = log.dev?.watch ? 'bot' : 'you';
  const who = opts.who ?? control;
  // A bot's own game speed: from its persona (botClock), or from the 'p'
  // commands a round-12 bot log carries.
  let botPace = 1 / (opts.botClock ?? 1);
  let speed = 1;
  let clock = 0;
  const tr: Trace = {
    id: log.id,
    map: log.map,
    who,
    seconds: 0,
    active: 0,
    taps: [],
    threats: [],
    pickups: [],
    lapses: [],
    flow: [],
    formation: [],
    speedTime: {},
    raids: [],
    drafts: log.summary?.drafts ?? [],
    waves: log.summary?.waves ?? [],
    waveSecs: {},
    end: { wave: 0, lost: 0, cleared: false, score: 0, carrierHp: 0 },
  };
  const threats = new Map<number, ThreatEv>();
  const alive = new Map<number, ThreatEv>();
  const pickups = new Map<number, { born: number; got?: number }>();
  let lastTap = 0;
  let quietFrom: number | null = null;
  let warned = false;
  const mine = () => control === who;
  const cmds = log.commands;
  const last = log.summary?.steps ?? Infinity;
  let i = 0;

  const seen = (th: Threat) => !th.dead && clock - (threats.get(th.id)?.born ?? clock) >= SEEN;
  for (let guard = 0; guard < 5_000_000; guard++) {
    if (g.phase === 'wave') {
      for (const th of g.threats)
        if (!threats.has(th.id)) {
          const ev: ThreatEv = { id: th.id, kind: th.kind, wave: g.wave, born: clock };
          threats.set(th.id, ev);
          alive.set(th.id, ev);
          if (mine()) tr.threats.push(ev);
        }
      if (alive.size) {
        const ids = new Set<number>();
        for (const t of g.threats) if (!t.dead) ids.add(t.id);
        for (const [id, ev] of alive)
          if (!ids.has(id)) {
            ev.gone = clock;
            alive.delete(id);
          }
      }
      for (const p of g.pickups)
        if (!pickups.has(p.id)) {
          const ev = { born: clock };
          pickups.set(p.id, ev);
          if (mine()) tr.pickups.push(ev);
        }
      const w = raidWarning(g);
      if (w && !warned && mine()) tr.raids.push({ warn: clock });
      warned = !!w;
    }
    while (i < cmds.length && cmds[i][0] <= g.steps) {
      const c = cmds[i++];
      switch (c[1]) {
        case 't': {
          if (!mine() || g.phase !== 'wave') {
            tap(g, c[2], c[3], c[4]);
            break;
          }
          const live = g.threats.filter((t) => !t.dead);
          let near: TapEv['near'] = null;
          let urgentTti = Infinity;
          if (live.length) {
            const tti = live.map((t) => timeToImpact(g, t));
            urgentTti = Math.min(...tti);
            const d = live.map((t) => Math.hypot(t.x - c[2], t.y - c[3]));
            const k = d.indexOf(Math.min(...d));
            const th = live[k];
            const v = Math.hypot(th.vx, th.vy) || 1;
            const ux = th.vx / v;
            const uy = th.vy / v;
            const dx = c[2] - th.x;
            const dy = c[3] - th.y;
            near = {
              id: th.id,
              kind: th.kind,
              d: d[k],
              along: dx * ux + dy * uy,
              across: Math.abs(-dx * uy + dy * ux),
              inRange: d[k] <= c[4],
              rank: tti.filter((x) => x < tti[k]).length,
            };
            const ev = threats.get(th.id);
            if (ev && near.inRange && ev.firstTap === undefined) ev.firstTap = clock;
          }
          const pickupsOn = g.pickups.length;
          const canFireNow = g.overdriveT > 0 || g.ammo >= 1 || !!(g.frigate && g.frigate.ammo >= 1);
          const before = new Set(g.pickups.map((p) => p.id));
          const inFlight = g.interceptors.length;
          const result = tap(g, c[2], c[3], c[4]);
          let overkill = false;
          if (result === 'fire' && g.interceptors.length > inFlight) {
            const shot = g.interceptors.at(-1)!;
            const th = g.threats.find((x) => x.id === shot.target);
            const already = g.interceptors.filter((x) => x !== shot && x.target === shot.target).length;
            overkill = !!th && already >= th.hp;
          }
          if (result === 'pickup')
            for (const id of before)
              if (!g.pickups.some((p) => p.id === id)) {
                const ev = pickups.get(id);
                if (ev && ev.got === undefined) ev.got = clock;
              }
          tr.taps.push({ t: clock, wave: g.wave, x: c[2], y: c[3], result, speed: control === 'bot' ? botPace : speed, live: live.length, near, urgentTti, canFire: canFireNow, pickupsOn, overkill });
          for (const r of tr.raids) if (r.firstTap === undefined) r.firstTap = clock;
          lastTap = clock;
          if (quietFrom !== null && clock - quietFrom >= LAPSE) tr.lapses.push([quietFrom, clock - quietFrom]);
          quietFrom = null;
          break;
        }
        case 'f':
          if (mine()) tr.flow.push([clock, c[2]]);
          setFlow(g, c[2]);
          break;
        case 'm':
          if (mine()) tr.formation.push([clock, c[2]]);
          setFormation(g, c[2]);
          break;
        case 'u':
          pickUpgrade(g, c[2], c[3]);
          break;
        case 'e':
          continueEndless(g);
          break;
        case 's':
          speed = c[2];
          break;
        case 'c':
          control = c[2];
          break;
        case 'p':
          botPace = c[2];
          break;
      }
    }
    if (g.steps >= last && i >= cmds.length) break;
    if (g.phase === 'lost' || g.phase === 'won') break;
    if (g.phase !== 'wave') {
      quietFrom = null;
      if (i >= cmds.length || cmds[i][0] > g.steps) break;
      continue;
    }
    const dt = control === 'bot' ? SIM_DT / botPace : SIM_DT / speed;
    const anySeen = g.threats.some(seen);
    if (mine()) {
      tr.seconds += dt;
      const ws = (tr.waveSecs[g.wave] ??= { secs: 0, active: 0 });
      ws.secs += dt;
      if (g.threats.some((t) => !t.dead)) {
        tr.active += dt;
        ws.active += dt;
      }
      const sk = String(control === 'bot' ? botPace : speed);
      tr.speedTime[sk] = (tr.speedTime[sk] ?? 0) + dt;
    }
    // A lapse: a threat has been on screen long enough to see, and no tap.
    if (mine() && anySeen) quietFrom ??= Math.max(lastTap, clock);
    else if (quietFrom !== null) {
      if (clock - quietFrom >= LAPSE) tr.lapses.push([quietFrom, clock - quietFrom]);
      quietFrom = null;
    }
    clock += dt;
    step(g, SIM_DT);
  }
  tr.end = { wave: g.wave, lost: g.lost, cleared: g.cleared, score: g.score, carrierHp: g.carrierHp };
  return tr;
}

// ---------------------------------------------------------------------------
// Metrics

export interface Metric {
  key: string;
  family: string;
  label: string;
  /** Pool of traces → one number. */
  value: (ts: Trace[]) => number;
  /** Raw samples, for a distribution distance (KS). */
  samples?: (ts: Trace[]) => number[];
  /** Absolute slack for small numbers (e.g. shares near 0). */
  abs?: number;
  /** Relative slack (default ±20%). */
  tol?: number;
  headline?: boolean;
}

export function q(a: number[], p: number): number {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const mean = (a: number[]) => (a.length ? sum(a) / a.length : NaN);
const flat = <T>(ts: Trace[], f: (t: Trace) => T[]) => ts.flatMap(f);
const share = (n: number, d: number) => (d ? n / d : NaN);

/** Gaps between consecutive taps in the same wave. */
function gaps(t: Trace): number[] {
  const out: number[] = [];
  for (let k = 1; k < t.taps.length; k++) if (t.taps[k].wave === t.taps[k - 1].wave) out.push(t.taps[k].t - t.taps[k - 1].t);
  return out;
}
const BURST = 0.3;
function bursts(t: Trace): { len: number[]; pause: number[]; inner: number[] } {
  const len: number[] = [];
  const pause: number[] = [];
  const inner: number[] = [];
  let run = 1;
  for (let k = 1; k < t.taps.length; k++) {
    const gap = t.taps[k].t - t.taps[k - 1].t;
    if (t.taps[k].wave !== t.taps[k - 1].wave) {
      len.push(run);
      run = 1;
    } else if (gap < BURST) {
      run++;
      inner.push(gap);
    } else {
      len.push(run);
      pause.push(gap);
      run = 1;
    }
  }
  if (t.taps.length) len.push(run);
  return { len, pause, inner };
}
/** Two taps too close in time and too far apart for one thumb. */
const twoThumb = (a: TapEv, b: TapEv) => b.t - a.t < 0.12 && Math.hypot(b.x - a.x, b.y - a.y) > 350;
const react = (t: Trace, kinds?: string[]) =>
  t.threats.filter((e) => e.firstTap !== undefined && (!kinds || kinds.includes(e.kind))).map((e) => e.firstTap! - e.born);
const untapped = (t: Trace, kinds?: string[]) => {
  const es = t.threats.filter((e) => !kinds || kinds.includes(e.kind));
  return [es.filter((e) => e.firstTap === undefined).length, es.length];
};
const results = (ts: Trace[], r: TapResult) => share(flat(ts, (t) => t.taps).filter((x) => x.result === r).length, flat(ts, (t) => t.taps).length);
const nearOf = (ts: Trace[], kinds?: string[]) =>
  flat(ts, (t) => t.taps)
    .map((x) => x.near)
    .filter((n): n is NonNullable<TapEv['near']> => !!n && (!kinds || kinds.includes(n.kind)));
function perWave(t: Trace, f: (taps: TapEv[], w: number) => number): number[] {
  const ws = [...new Set(t.taps.map((x) => x.wave))];
  return ws.map((w) => f(t.taps.filter((x) => x.wave === w), w)).filter(Number.isFinite);
}
const cv = (a: number[]) => {
  const m = mean(a);
  return a.length > 1 ? Math.sqrt(mean(a.map((x) => (x - m) ** 2))) / m : NaN;
};
function dryStreaks(t: Trace): number[] {
  const out: number[] = [];
  let run = 0;
  for (const x of t.taps) {
    if (x.result === 'dry') run++;
    else if (run) {
      out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out;
}
function afterDry(t: Trace): number[] {
  const out: number[] = [];
  for (let k = 1; k < t.taps.length; k++) if (t.taps[k - 1].result === 'dry' && t.taps[k].wave === t.taps[k - 1].wave) out.push(t.taps[k].t - t.taps[k - 1].t);
  return out;
}
function switches(t: Trace): [number, number] {
  let n = 0;
  let d = 0;
  for (let k = 1; k < t.taps.length; k++) {
    const a = t.taps[k - 1].near;
    const b = t.taps[k].near;
    if (!a || !b || t.taps[k].t - t.taps[k - 1].t >= BURST) continue;
    d++;
    if (a.id !== b.id) n++;
  }
  return [n, d];
}
const travel = (t: Trace) => {
  const out: number[] = [];
  for (let k = 1; k < t.taps.length; k++) if (t.taps[k].t - t.taps[k - 1].t < BURST) out.push(Math.hypot(t.taps[k].x - t.taps[k - 1].x, t.taps[k].y - t.taps[k - 1].y));
  return out;
};
const meanSpeed = (t: Trace) => {
  const e = Object.entries(t.speedTime);
  const real = sum(e.map(([, v]) => v));
  return sum(e.map(([k, v]) => Number(k) * v)) / real;
};
const thirds = (t: Trace, f: (a: Trace) => number) => {
  const end = t.seconds;
  const cut = (lo: number, hi: number): Trace => ({
    ...t,
    taps: t.taps.filter((x) => x.t >= lo && x.t < hi),
    threats: t.threats.filter((e) => e.born >= lo && e.born < hi),
  });
  return f(cut((2 * end) / 3, Infinity)) / f(cut(0, end / 3));
};
const firstFlow = (t: Trace) => (t.flow.length ? t.flow[0][0] : NaN);

const KINDS = ['drone', 'ballistic', 'guided', 'supersonic', 'strafer', 'bomber', 'heavy', 'minidrone'];

export const METRICS: Metric[] = [
  // A. Reaction: a threat appears → the first tap in range of it.
  { key: 'react.all', family: 'A reaction', label: 'reaction, any threat (median s)', value: (ts) => q(flat(ts, (t) => react(t)), 0.5), samples: (ts) => flat(ts, (t) => react(t)) },
  { key: 'react.p10', family: 'A reaction', label: 'reaction p10 (fast end, s)', value: (ts) => q(flat(ts, (t) => react(t)), 0.1) },
  { key: 'react.p90', family: 'A reaction', label: 'reaction p90 (slow end, s)', value: (ts) => q(flat(ts, (t) => react(t)), 0.9) },
  ...KINDS.map(
    (k): Metric => ({
      key: `react.${k}`,
      family: 'A reaction',
      label: `reaction to ${k} (median s)`,
      value: (ts) => q(flat(ts, (t) => react(t, [k])), 0.5),
      samples: (ts) => flat(ts, (t) => react(t, [k])),
      headline: ['drone', 'ballistic', 'guided'].includes(k),
    }),
  ),
  ...['drone', 'ballistic', 'guided', 'supersonic', 'strafer'].map(
    (k): Metric => ({
      key: `untapped.${k}`,
      family: 'A reaction',
      label: `${k}s never tapped (share)`,
      value: (ts) => {
        const u = ts.map((t) => untapped(t, [k]));
        return share(sum(u.map((x) => x[0])), sum(u.map((x) => x[1])));
      },
      abs: 0.05,
    }),
  ),
  // B. Rhythm.
  { key: 'gap.med', family: 'B rhythm', label: 'gap between taps (median s)', value: (ts) => q(flat(ts, gaps), 0.5), samples: (ts) => flat(ts, gaps), headline: true },
  { key: 'gap.p10', family: 'B rhythm', label: 'gap p10 (s)', value: (ts) => q(flat(ts, gaps), 0.1) },
  { key: 'gap.p90', family: 'B rhythm', label: 'gap p90 (s)', value: (ts) => q(flat(ts, gaps), 0.9) },
  { key: 'burst.inner', family: 'B rhythm', label: 'gap inside a burst (median s)', value: (ts) => q(flat(ts, (t) => bursts(t).inner), 0.5), samples: (ts) => flat(ts, (t) => bursts(t).inner) },
  { key: 'burst.mean', family: 'B rhythm', label: 'taps per burst (mean)', value: (ts) => mean(flat(ts, (t) => bursts(t).len)), samples: (ts) => flat(ts, (t) => bursts(t).len), headline: true },
  { key: 'burst.p90', family: 'B rhythm', label: 'taps per burst (p90)', value: (ts) => q(flat(ts, (t) => bursts(t).len), 0.9) },
  { key: 'burst.single', family: 'B rhythm', label: 'single-tap bursts (share)', value: (ts) => share(flat(ts, (t) => bursts(t).len).filter((x) => x === 1).length, flat(ts, (t) => bursts(t).len).length) },
  { key: 'pause.med', family: 'B rhythm', label: 'pause between bursts (median s)', value: (ts) => q(flat(ts, (t) => bursts(t).pause), 0.5), samples: (ts) => flat(ts, (t) => bursts(t).pause), headline: true },
  { key: 'pause.p90', family: 'B rhythm', label: 'pause p90 (s)', value: (ts) => q(flat(ts, (t) => bursts(t).pause), 0.9) },
  { key: 'rate.active', family: 'B rhythm', label: 'taps per active second', value: (ts) => sum(ts.map((t) => t.taps.length)) / sum(ts.map((t) => t.active)) },
  { key: 'rate.idle', family: 'B rhythm', label: 'taps with nothing on screen (share)', value: (ts) => share(flat(ts, (t) => t.taps).filter((x) => !x.live).length, flat(ts, (t) => t.taps).length), abs: 0.02 },
  // C. Hands.
  { key: 'hands.two', family: 'C hands', label: 'two-thumb taps (share)', value: (ts) => share(sum(ts.map((t) => t.taps.filter((x, k) => k > 0 && twoThumb(t.taps[k - 1], x)).length)), flat(ts, (t) => t.taps).length), abs: 0.008, tol: 0.35, headline: true },
  { key: 'hands.left', family: 'C hands', label: 'taps on the left half (share)', value: (ts) => share(flat(ts, (t) => t.taps).filter((x) => x.x < 800).length, flat(ts, (t) => t.taps).length) },
  { key: 'hands.top', family: 'C hands', label: 'taps in the top half (share)', value: (ts) => share(flat(ts, (t) => t.taps).filter((x) => x.y < 450).length, flat(ts, (t) => t.taps).length) },
  { key: 'hands.travel', family: 'C hands', label: 'finger travel inside a burst (median px)', value: (ts) => q(flat(ts, travel), 0.5), samples: (ts) => flat(ts, travel) },
  // D. Aim.
  { key: 'aim.med', family: 'D aim', label: 'distance to target (median px)', value: (ts) => q(nearOf(ts).map((n) => n.d), 0.5), samples: (ts) => nearOf(ts).map((n) => n.d), headline: true },
  { key: 'aim.p90', family: 'D aim', label: 'distance to target (p90 px)', value: (ts) => q(nearOf(ts).map((n) => n.d), 0.9) },
  { key: 'aim.inRange', family: 'D aim', label: 'taps in reach of a threat (share)', value: (ts) => share(nearOf(ts).filter((n) => n.inRange).length, nearOf(ts).length) },
  { key: 'aim.along.drone', family: 'D aim', label: 'lead/lag on drones (median px, − = behind)', value: (ts) => q(nearOf(ts, ['drone']).map((n) => n.along), 0.5), abs: 6 },
  { key: 'aim.along.guided', family: 'D aim', label: 'lead/lag on guided (median px)', value: (ts) => q(nearOf(ts, ['guided', 'supersonic']).map((n) => n.along), 0.5), abs: 8 },
  { key: 'aim.across', family: 'D aim', label: 'miss across the heading (median px)', value: (ts) => q(nearOf(ts).map((n) => n.across), 0.5) },
  { key: 'aim.ballistic', family: 'D aim', label: 'distance on ballistics (median px)', value: (ts) => q(nearOf(ts, ['ballistic']).map((n) => n.d), 0.5) },
  // E. Targeting.
  { key: 'target.urgent', family: 'E targeting', label: 'tap goes to the most urgent threat (share)', value: (ts) => share(nearOf(ts).filter((n) => n.rank === 0).length, nearOf(ts).length), headline: true },
  { key: 'target.rank', family: 'E targeting', label: 'urgency rank of the target (mean)', value: (ts) => mean(nearOf(ts).map((n) => n.rank)) },
  { key: 'target.crowd', family: 'E targeting', label: 'threats on screen at a tap (median)', value: (ts) => q(flat(ts, (t) => t.taps).map((x) => x.live), 0.5) },
  { key: 'target.panic', family: 'E targeting', label: 'urgent threat < 1 s out: tap goes to it (share)', value: (ts) => {
    const xs = flat(ts, (t) => t.taps).filter((x) => x.near && x.urgentTti < 1);
    return share(xs.filter((x) => x.near!.rank === 0).length, xs.length);
  } },
  { key: 'target.switch', family: 'E targeting', label: 'target changes inside a burst (share)', value: (ts) => {
    const s = ts.map(switches);
    return share(sum(s.map((x) => x[0])), sum(s.map((x) => x[1])));
  } },
  { key: 'target.overkill', family: 'E targeting', label: 'shots at a threat already covered (share of fire)', value: (ts) => {
    const f = flat(ts, (t) => t.taps).filter((x) => x.result === 'fire');
    return share(f.filter((x) => x.overkill).length, f.length);
  } },
  { key: 'target.shotsPerKill', family: 'E targeting', label: 'shots per kill', value: (ts) => sum(ts.map((t) => t.waves.at(-1)?.shots ?? 0)) / sum(ts.map((t) => Object.values(t.waves.at(-1)?.kills ?? {}).reduce((a, b) => a + b, 0))) },
  // F. Tap results.
  { key: 'result.fire', family: 'F results', label: 'fire (share of taps)', value: (ts) => results(ts, 'fire') },
  { key: 'result.dry', family: 'F results', label: 'dry: rack empty (share)', value: (ts) => results(ts, 'dry'), headline: true },
  { key: 'result.pickup', family: 'F results', label: 'pickup (share)', value: (ts) => results(ts, 'pickup'), abs: 0.015 },
  { key: 'result.empty', family: 'F results', label: 'empty water (share)', value: (ts) => results(ts, 'empty'), abs: 0.02 },
  { key: 'dry.streak', family: 'F results', label: 'dry taps in a row (mean)', value: (ts) => mean(flat(ts, dryStreaks)) },
  { key: 'dry.next', family: 'F results', label: 'gap after a dry tap (median s)', value: (ts) => q(flat(ts, afterDry), 0.5) },
  { key: 'dry.whenEmpty', family: 'F results', label: 'taps while the rack is empty (share of taps)', value: (ts) => share(flat(ts, (t) => t.taps).filter((x) => !x.canFire && x.live).length, flat(ts, (t) => t.taps).length) },
  // G. Pickups.
  { key: 'pickup.got', family: 'G pickups', label: 'pickups collected (share)', value: (ts) => share(flat(ts, (t) => t.pickups).filter((p) => p.got !== undefined).length, flat(ts, (t) => t.pickups).length) },
  { key: 'pickup.time', family: 'G pickups', label: 'time to collect (median s)', value: (ts) => q(flat(ts, (t) => t.pickups).filter((p) => p.got !== undefined).map((p) => p.got! - p.born), 0.5) },
  // H. Rails.
  { key: 'rails.flowAt', family: 'H rails', label: 'first flow change (s into the run)', value: (ts) => q(ts.map(firstFlow).filter(Number.isFinite), 0.5) },
  { key: 'rails.flowTop', family: 'H rails', label: 'flow step reached', value: (ts) => mean(ts.map((t) => (t.flow.length ? t.flow.at(-1)![1] : 1))) },
  { key: 'rails.formations', family: 'H rails', label: 'formation changes per run', value: (ts) => mean(ts.map((t) => t.formation.length)), abs: 0.5 },
  { key: 'rails.speed', family: 'H rails', label: 'mean game speed (×)', value: (ts) => mean(ts.map(meanSpeed)), tol: 0.06, headline: true },
  { key: 'rails.raidReact', family: 'H rails', label: 'raid warning → next tap (median s)', value: (ts) => q(flat(ts, (t) => t.raids.filter((r) => r.firstTap !== undefined).map((r) => r.firstTap! - r.warn)), 0.5) },
  // I. Cards.
  { key: 'cards.stack', family: 'I cards', label: 'picks that level a held card (share)', value: (ts) => {
    const ds = flat(ts, (t) => stackFlags(t));
    return share(ds.filter(Boolean).length, ds.length);
  } },
  { key: 'cards.resupply', family: 'I cards', label: 'Resupply taken when offered (share)', value: (ts) => {
    const ds = flat(ts, (t) => t.drafts).filter((d) => d.offered.includes('resupply'));
    return share(ds.filter((d) => d.picked === 'resupply').length, ds.length);
  } },
  // J. Noise.
  { key: 'noise.lapses', family: 'J noise', label: `lapses (≥ ${LAPSE} s, threat up, no tap) per minute`, value: (ts) => sum(ts.map((t) => t.lapses.length)) / (sum(ts.map((t) => t.active)) / 60), abs: 0.15 },
  { key: 'noise.lapseLen', family: 'J noise', label: 'lapse length (median s)', value: (ts) => q(flat(ts, (t) => t.lapses.map((l) => l[1])), 0.5) },
  { key: 'noise.rateCv', family: 'J noise', label: 'tap rate wave to wave (CV)', value: (ts) => mean(ts.map((t) => cv(perWave(t, (xs, w) => xs.length / (t.waveSecs[w]?.active || 1))))) },
  { key: 'noise.reactCv', family: 'J noise', label: 'reaction wave to wave (CV of medians)', value: (ts) => mean(ts.map((t) => cv(perWaveReact(t)))) },
  { key: 'noise.fatigue', family: 'J noise', label: 'reaction, last third ÷ first third', value: (ts) => mean(ts.map((t) => thirds(t, (a) => q(react(a), 0.5)))) },
  { key: 'noise.rateDrift', family: 'J noise', label: 'tap rate, last third ÷ first third', value: (ts) => mean(ts.map((t) => thirds(t, (a) => a.taps.length))) },
  // Wave by wave: how often a whole wave runs hot, cold or distracted
  // against the rest of that run (the player's "sometimes I rush,
  // sometimes I'm distracted").
  { key: 'noise.waveLapse', family: 'J noise', label: 'waves with a lapse in them (share)', value: (ts) => shareOfWaves(ts, (t, w) => t.lapses.some((l) => waveOf(t, l[0]) === w)), abs: 0.08 },
  { key: 'noise.waveHot', family: 'J noise', label: 'waves tapped ≥ 1.3× the run\'s usual rate (share)', value: (ts) => shareOfWaves(ts, (t, w, rel) => rel.rate[w] >= 1.3), abs: 0.06 },
  { key: 'noise.waveCold', family: 'J noise', label: 'waves tapped ≤ 0.75× the run\'s usual rate (share)', value: (ts) => shareOfWaves(ts, (t, w, rel) => rel.rate[w] <= 0.75), abs: 0.06 },
  { key: 'noise.waveSlowEyes', family: 'J noise', label: 'waves reacting ≥ 1.4× slower than usual (share)', value: (ts) => shareOfWaves(ts, (t, w, rel) => rel.react[w] >= 1.4), abs: 0.06 },
  { key: 'noise.waveRush', family: 'J noise', label: 'waves played mostly above 1.25× game speed (share)', value: (ts) => shareOfWaves(ts, (t, w) => waveSpeed(t, w) > 1.25), abs: 0.08 },
  // K. Outcomes (game terms).
  { key: 'out.wave', family: 'K outcomes', label: 'wave reached (mean)', value: (ts) => mean(ts.map((t) => t.end.wave)), abs: 1 },
  { key: 'out.lostBy5', family: 'K outcomes', label: 'ships lost by the end of wave 5 (mean)', value: (ts) => mean(ts.map((t) => t.waves.find((w) => w.wave === 5)?.lost ?? t.end.lost)), abs: 1 },
  { key: 'out.carrier', family: 'K outcomes', label: 'carrier hits taken by wave 7 (mean)', value: (ts) => mean(ts.map((t) => 12 - (t.waves.find((w) => w.wave === 7)?.carrierHp ?? t.end.carrierHp))), abs: 2 },
  { key: 'out.kills', family: 'K outcomes', label: 'kills per wave played (mean)', value: (ts) => mean(ts.map((t) => Object.values(t.waves.at(-1)?.kills ?? {}).reduce((a, b) => a + b, 0) / Math.max(1, t.waves.length))) },
];

function waveOf(t: Trace, at: number): number {
  let w = t.taps[0]?.wave ?? 1;
  for (const x of t.taps) {
    if (x.t > at) break;
    w = x.wave;
  }
  return w;
}

/** Each wave's tap rate and reaction, relative to the run's median wave. */
function relWaves(t: Trace): { rate: Record<number, number>; react: Record<number, number> } {
  const ws = Object.keys(t.waveSecs).map(Number).filter((w) => (t.waveSecs[w]?.active ?? 0) > 5);
  const rate: Record<number, number> = {};
  const react: Record<number, number> = {};
  for (const w of ws) rate[w] = t.taps.filter((x) => x.wave === w).length / t.waveSecs[w].active;
  for (const w of ws) react[w] = q(t.threats.filter((e) => e.wave === w && e.firstTap !== undefined).map((e) => e.firstTap! - e.born), 0.5);
  const mr = q(Object.values(rate), 0.5);
  const mx = q(Object.values(react).filter(Number.isFinite), 0.5);
  for (const w of ws) {
    rate[w] /= mr;
    react[w] /= mx;
  }
  return { rate, react };
}

function shareOfWaves(ts: Trace[], f: (t: Trace, w: number, rel: ReturnType<typeof relWaves>) => boolean): number {
  let n = 0;
  let d = 0;
  for (const t of ts) {
    const rel = relWaves(t);
    for (const w of Object.keys(rel.rate).map(Number)) {
      d++;
      if (f(t, w, rel)) n++;
    }
  }
  return share(n, d);
}

/** Mean game speed over a wave's taps (the slider is only logged at changes). */
function waveSpeed(t: Trace, w: number): number {
  const xs = t.taps.filter((x) => x.wave === w);
  return xs.length ? mean(xs.map((x) => x.speed)) : NaN;
}

function stackFlags(t: Trace): boolean[] {
  const held = new Set<string>();
  const out: boolean[] = [];
  for (const d of t.drafts) {
    if (d.picked === 'resupply') continue;
    out.push(held.has(d.picked));
    held.add(d.picked);
    if (d.replaced) held.delete(d.replaced);
  }
  return out;
}

function perWaveReact(t: Trace): number[] {
  const ws = [...new Set(t.threats.map((e) => e.wave))];
  return ws.map((w) => q(t.threats.filter((e) => e.wave === w && e.firstTap !== undefined).map((e) => e.firstTap! - e.born), 0.5)).filter(Number.isFinite);
}

/** Two-sample Kolmogorov–Smirnov statistic (0 = same distribution). */
export function ks(a: number[], b: number[]): number {
  if (!a.length || !b.length) return NaN;
  const x = [...a].sort((p, r) => p - r);
  const y = [...b].sort((p, r) => p - r);
  let i = 0;
  let j = 0;
  let d = 0;
  while (i < x.length && j < y.length) {
    const v = Math.min(x[i], y[j]);
    while (i < x.length && x[i] <= v) i++;
    while (j < y.length && y[j] <= v) j++;
    d = Math.max(d, Math.abs(i / x.length - j / y.length));
  }
  return d;
}

export interface Verdict {
  m: Metric;
  you: number;
  lo: number;
  hi: number;
  bot: number;
  ks: number;
  pass: boolean;
  /** No data on the player's side (a threat they never met): not scored. */
  na: boolean;
}

/** Knob by knob: the bot passes a knob when it lands within ±20% of the
 *  player's pooled value or, for all but the headline knobs, inside the
 *  player's own run-to-run spread (widened 10%). */
export function compare(you: Trace[], bot: Trace[], metrics = METRICS): Verdict[] {
  return metrics.map((m) => {
    const y = m.value(you);
    const per = you.map((t) => m.value([t])).filter(Number.isFinite);
    let lo = Math.min(...per);
    let hi = Math.max(...per);
    const pad = (hi - lo) * 0.1;
    lo -= pad;
    hi += pad;
    const b = m.value(bot);
    const slack = Math.max(Math.abs(y) * (m.tol ?? 0.2), m.abs ?? 0);
    const na = !Number.isFinite(y);
    // A headline knob must match the pooled value; the rest may also land
    // anywhere in the player's own run-to-run spread.
    const pass = !na && Number.isFinite(b) && (Math.abs(b - y) <= slack || (!m.headline && b >= lo && b <= hi));
    return { m, you: y, lo, hi, bot: b, ks: m.samples ? ks(m.samples(you), m.samples(bot)) : NaN, pass, na };
  });
}

export function score(vs: Verdict[]): { passed: number; scored: number; heads: number; headsPassed: number } {
  const sc = vs.filter((v) => !v.na);
  const h = sc.filter((v) => v.m.headline);
  return { passed: sc.filter((v) => v.pass).length, scored: sc.length, heads: h.length, headsPassed: h.filter((v) => v.pass).length };
}

export function printVerdicts(vs: Verdict[], botLabel = 'bot'): void {
  const f = (v: number) => (!Number.isFinite(v) ? '-' : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));
  let fam = '';
  console.log(`${'knob'.padEnd(52)} ${'you'.padStart(7)} ${'your spread'.padStart(15)} ${botLabel.padStart(7)}   KS   `);
  for (const v of vs) {
    if (v.m.family !== fam) {
      fam = v.m.family;
      console.log(`— ${fam}`);
    }
    console.log(
      `${(v.m.headline ? '★ ' : '  ') + v.m.label.padEnd(50)} ${f(v.you).padStart(7)} ${`${f(v.lo)}–${f(v.hi)}`.padStart(15)} ${f(v.bot).padStart(7)}  ${Number.isFinite(v.ks) ? v.ks.toFixed(2) : '  - '}  ${v.na ? 'n/a' : v.pass ? 'ok' : 'MISS'}`,
    );
  }
  const { passed, scored, heads, headsPassed } = score(vs);
  console.log(`\n${passed}/${scored} knobs pass (${((passed / scored) * 100).toFixed(0)}%); headline ${headsPassed}/${heads}`);
  const miss = vs.filter((v) => !v.pass && !v.na).map((v) => v.m.key);
  if (miss.length) console.log(`misses: ${miss.join(', ')}`);
}

