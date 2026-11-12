// MAP ANALYTICS (docs/design/v3-map-convoy-lab-plan.md, slice 2; what was
// built and measured: docs/design/v3-map-lab-slices2-5.md). Turns one or
// many telemetry sidecars (sim/telemetry.ts) into the six map layers, on a
// common world grid, under one filter:
//   launches   where attacks were launched
//   damage     where hulls were hit (and, traced back, where the attacker
//              was launched: the `sources` view)
//   pickups    dropped, taken, missed
//   intercepts the player's taps and kills
//   traffic    ship-seconds, and hull lost per ship-minute
//   commands   convoy commands and the map's own mechanics, in time
//
// Rules it keeps (the plan, §5.3):
// - raw and normalised values side by side, and every rate with its
//   denominator; a cell with too little under it is masked, never shown as
//   an extreme;
// - a time window splits a ship's stretch between two samples exactly at
//   the window's edges;
// - a normal wave, the bonus wave and the map event's runs are never mixed
//   unless the filter asks for it;
// - it only reads sidecars: nothing here knows the game's rules.
//
// Pure: no DOM (ui/mapLab.ts and tools/v3/map-lab draw from it).

import { VIEW, type ThreatKind } from '../data/config';
import type { FormationId } from '../data/formations';
import type { PlayLog } from './playlog';
import type { TelEvent, TelPhase, TelPhaseKind, TelemetrySidecar } from './telemetry';

export const GRID = { w: 32, h: 18, cell: 50 } as const;
/** Ship-seconds a cell needs before a rate is given for it. */
export const THIN_SECONDS = 30;
/** Launches a cell needs before damage per launch is given for it, and
 *  pickups before a collection rate. */
export const THIN_COUNT = 3;

export interface RunData {
  id: string;
  label: string;
  sidecar: TelemetrySidecar;
  /** The play log it came from, when replay is wanted (drill-down). */
  log?: PlayLog;
}

export type Scope = 'all' | 'waves' | 'mapEvent' | 'bonus';
export type Platform = 'base' | 'mobile' | 'air';

export interface Filter {
  scope: Scope;
  /** Waves to keep (inclusive); the map event's runs are waves 11 to 13. */
  waves?: [number, number];
  /** Seconds to keep: from the start of each run (`run`) or of each
   *  stretch (`phase`: "the ten seconds round the barrage in every wave 7"). */
  window?: { from: number; to: number; base: 'run' | 'phase' };
  /** Attacker kinds (launches, hits, their sources). */
  kinds?: ThreatKind[];
  platforms?: Platform[];
  /** What hurt a threat (kills), or the weapon loaded on a tap. */
  weapon?: string;
  lane?: number;
  formation?: FormationId;
  /** Runs to keep, by id (all when absent). */
  runs?: string[];
  /** The convoy policy the run was played under. */
  policy?: string;
}

export const ALL: Filter = { scope: 'all' };

export type LayerId = 'launches' | 'sources' | 'damage' | 'pickups' | 'intercepts' | 'traffic' | 'commands';
export type MetricId =
  | 'count' | 'hp' | 'perLaunch' | 'hits' | 'sinks' | 'dropped' | 'taken' | 'missed' | 'takenRate' | 'taps' | 'kills' | 'dry' | 'shipSeconds' | 'risk' | 'entered';

export const LAYERS: { id: LayerId; name: string; metrics: { id: MetricId; name: string; unit: string; says: string }[] }[] = [
  { id: 'launches', name: 'Launches', metrics: [{ id: 'count', name: 'Launches', unit: 'launches', says: 'Attacks launched from each square.' }] },
  {
    id: 'sources',
    name: 'Damage by source',
    metrics: [
      { id: 'hp', name: 'Hull removed', unit: 'hull points', says: 'Hull points removed, counted where the attacker was launched.' },
      { id: 'perLaunch', name: 'Per launch', unit: 'hull points a launch', says: `Hull points removed per launch from the square. Fewer than ${THIN_COUNT} launches: no rate.` },
    ],
  },
  {
    id: 'damage',
    name: 'Hits',
    metrics: [
      { id: 'hp', name: 'Hull removed', unit: 'hull points', says: 'Hull points removed from ships and the carrier, where they were hit.' },
      { id: 'hits', name: 'Hits', unit: 'hits', says: 'Hits that removed hull, where they landed.' },
      { id: 'sinks', name: 'Sinkings', unit: 'ships sunk', says: 'Where ships went down.' },
    ],
  },
  {
    id: 'pickups',
    name: 'Pickups',
    metrics: [
      { id: 'dropped', name: 'Dropped', unit: 'pickups', says: 'Pickups dropped in each square.' },
      { id: 'taken', name: 'Taken', unit: 'pickups', says: 'Pickups taken, where they dropped.' },
      { id: 'missed', name: 'Missed', unit: 'pickups', says: 'Pickups that expired or went with the wave.' },
      { id: 'takenRate', name: 'Share taken', unit: 'of pickups taken', says: `Share of the square's pickups that were taken. Fewer than ${THIN_COUNT}: no rate.` },
    ],
  },
  {
    id: 'intercepts',
    name: 'Taps and kills',
    metrics: [
      { id: 'taps', name: 'Shots', unit: 'taps that fired', says: 'Where the player tapped and a shot went.' },
      { id: 'kills', name: 'Kills', unit: 'kills', says: 'Where threats were shot down.' },
      { id: 'dry', name: 'Missed taps', unit: 'taps', says: 'Taps with the rack empty, or on nothing.' },
    ],
  },
  {
    id: 'traffic',
    name: 'Convoy',
    metrics: [
      { id: 'shipSeconds', name: 'Traffic', unit: 'ship-seconds', says: 'How long hulls spent in each square.' },
      { id: 'risk', name: 'Risk', unit: 'hull points a ship-minute', says: `Hull points lost per ship-minute spent in the square. Under ${THIN_SECONDS} ship-seconds: no rate.` },
      { id: 'entered', name: 'Ships through', unit: 'ships', says: 'Ships that sailed through the square.' },
      { id: 'sinks', name: 'Sinkings', unit: 'ships sunk', says: 'Where ships went down.' },
    ],
  },
  { id: 'commands', name: 'Commands', metrics: [{ id: 'count', name: 'Commands', unit: 'commands', says: 'Convoy commands and the map\'s own changes, in time (see the list).' }] },
];

/** One event behind a cell: enough to list it and to open the replay. */
export interface EventRef {
  run: string;
  s: number;
  t: number;
  wave: number;
  text: string;
  /** A hit's impact, for the trace. */
  imp?: number;
}

export interface Cell {
  /** The metric's value, or null when masked (too little under it). */
  v: number | null;
  /** What the value is made of (the numerator and the denominator). */
  num: number;
  den: number;
  masked: boolean;
}

export interface LayerResult {
  layer: LayerId;
  metric: MetricId;
  unit: string;
  cells: Cell[];
  /** The largest unmasked value (the top of the colour scale). */
  top: number;
  total: number;
  /** Runs and seconds of play under the filter: the sample behind it. */
  runs: number;
  seconds: number;
}

export interface Summary {
  runs: number;
  seconds: number;
  shipMinutes: number;
  launches: number;
  hits: number;
  blocked: number;
  hpShip: number;
  hpCarrier: number;
  sunk: number;
  sailed: number;
  delivered: number;
  /** Hull points lost per ship-minute, over all runs and (min, median,
   *  max) run by run: how much the runs agree. */
  risk: number | null;
  riskByRun: { min: number; median: number; max: number } | null;
  byKind: [string, number][];
  byPlatform: Record<Platform, { launches: number; hp: number }>;
  byFormation: Partial<Record<FormationId, { hp: number; sunk: number }>>;
  pickups: { dropped: number; taken: number; expired: number; cleared: number };
  taps: { fire: number; pickup: number; dry: number; empty: number };
  kills: number;
  killsBy: [string, number][];
  commands: number;
}

type Spawn = Extract<TelEvent, { k: 'thr+' }>;
type Hit = Extract<TelEvent, { k: 'hit' }>;

export const cellOf = (x: number, y: number): number => {
  const cx = Math.floor(x / GRID.cell);
  const cy = Math.floor(y / GRID.cell);
  return cx < 0 || cy < 0 || cx >= GRID.w || cy >= GRID.h ? -1 : cy * GRID.w + cx;
};
export const cellBox = (i: number) => ({ x: (i % GRID.w) * GRID.cell, y: Math.floor(i / GRID.w) * GRID.cell, w: GRID.cell, h: GRID.cell });
/** What happens just off the board is counted in the square at its edge:
 *  an aircraft's entry, and a hull sailing in or out (ships are afloat, and
 *  can be hit, a little before and after the screen), so the squares add
 *  up to the totals. */
export const edge = (x: number, y: number) => cellOf(Math.max(0, Math.min(VIEW.width - 1, x)), Math.max(0, Math.min(VIEW.height - 1, y)));

export const platformOf = (e: Spawn): Platform => (e.o === 'base' || e.o === 'structure' ? 'base' : e.o === 'air' ? 'air' : 'mobile');

function scopeOf(kind: TelPhaseKind): Scope {
  return kind === 'wave' ? 'waves' : kind === 'bonusEvent' ? 'bonus' : 'mapEvent';
}

/** Does this stretch pass the filter? */
function phaseIn(ph: TelPhase, f: Filter): boolean {
  if (f.scope !== 'all' && scopeOf(ph.kind) !== f.scope) return false;
  if (f.waves && (ph.wave < f.waves[0] || ph.wave > f.waves[1])) return false;
  return true;
}

/** The seconds of a run the filter keeps, as [from, to] spans (stretches
 *  that pass, cut to the window). */
export function spans(sc: TelemetrySidecar, f: Filter): [number, number][] {
  const out: [number, number][] = [];
  for (const ph of sc.phases) {
    if (!phaseIn(ph, f)) continue;
    let a = ph.t0;
    let b = ph.t1 ?? sc.seconds;
    if (f.window) {
      const off = f.window.base === 'phase' ? ph.t0 : 0;
      a = Math.max(a, off + f.window.from);
      b = Math.min(b, off + f.window.to);
    }
    if (b > a) out.push([a, b]);
  }
  return out;
}

const inSpans = (t: number, sp: [number, number][]) => sp.some(([a, b]) => t >= a && t <= b);

/** A run's index of who launched what: back from what hit to what a
 *  launcher first sent (a bomblet to its cluster, a missile to its bomber). */
export function spawnIndex(sc: TelemetrySidecar): { get(id: number | undefined): Spawn | undefined; root(id: number | undefined): Spawn | undefined } {
  const spawns = new Map<number, Spawn>();
  for (const e of sc.events) if (e.k === 'thr+' && !e.back) spawns.set(e.id, e);
  return {
    get: (id) => (id === undefined ? undefined : spawns.get(id)),
    root: (id) => {
      let e = id === undefined ? undefined : spawns.get(id);
      for (let k = 0; e && k < 8; k++) {
        const up: number | undefined = e.pid ?? e.from;
        const parent = up === undefined ? undefined : spawns.get(up);
        if (!parent || parent === e) break;
        e = parent;
      }
      return e;
    },
  };
}

function runsIn(runs: RunData[], f: Filter): RunData[] {
  return runs.filter((r) => (!f.runs || f.runs.includes(r.id)) && (!f.policy || r.sidecar.header.convoy.policy === f.policy));
}

/** The formation in force at each moment of a run (from its commands). */
function formationAt(sc: TelemetrySidecar): (t: number) => FormationId {
  const marks: [number, FormationId][] = [[0, sc.header.convoy.formation]];
  for (const e of sc.events) if (e.k === 'cmd' && e.what === 'formation' && e.ok) marks.push([e.t, e.req as FormationId]);
  return (t) => {
    let f = marks[0][1];
    for (const [at, id] of marks) if (at <= t) f = id;
    return f;
  };
}

/** Adds a ship's stretch from (ta, a) to (tb, b), cut to the spans, to a
 *  grid of ship-seconds (and counts each cell it enters once). */
function addStretch(grid: Float64Array, entered: Set<number> | null, ta: number, ax: number, ay: number, tb: number, bx: number, by: number, sp: [number, number][]): number {
  let total = 0;
  if (tb <= ta) return 0;
  for (const [s0, s1] of sp) {
    const a = Math.max(ta, s0);
    const b = Math.min(tb, s1);
    if (b <= a) continue;
    // Along the line between the two samples, in pieces of about a tenth of a second.
    const n = Math.max(1, Math.ceil((b - a) / 0.1));
    for (let k = 0; k < n; k++) {
      const u = (a + ((k + 0.5) * (b - a)) / n - ta) / (tb - ta);
      const c = edge(ax + (bx - ax) * u, ay + (by - ay) * u);
      grid[c] += (b - a) / n;
      entered?.add(c);
    }
    total += b - a;
  }
  return total;
}

/** Ship-seconds by cell under the filter (and, per cell, ships entering). */
export function exposure(runs: RunData[], f: Filter): { seconds: Float64Array; entered: Float64Array; shipMinutes: number; byRun: Map<string, number> } {
  const seconds = new Float64Array(GRID.w * GRID.h);
  const entered = new Float64Array(GRID.w * GRID.h);
  let shipSeconds = 0;
  const byRun = new Map<string, number>();
  for (const r of runsIn(runs, f)) {
    const sc = r.sidecar;
    const sp = spans(sc, f);
    const form = f.formation ? formationAt(sc) : null;
    let mine = 0;
    const last = new Map<number, { x: number; y: number; t: number; lane: number; cells: Set<number> }>();
    const stretch = (id: number, t: number, x: number, y: number) => {
      const was = last.get(id);
      if (!was) return;
      const keep = (f.lane === undefined || was.lane === f.lane) && (!form || form((was.t + t) / 2) === f.formation);
      if (keep) mine += addStretch(seconds, was.cells, was.t, was.x, was.y, t, x, y, sp);
      was.x = x;
      was.y = y;
      was.t = t;
    };
    // Sailing, samples and endings in the order they happened: a ship's
    // first and last stretches run to its `ship+` and `ship-` events, so a
    // ship that sinks between two samples is counted to the moment it sank.
    const marks: { t: number; s: number; k: 0 | 1 | 2; e: TelEvent | (typeof sc.samples)[number] }[] = [];
    for (const e of sc.events) if (e.k === 'ship+' || e.k === 'ship-') marks.push({ t: e.t, s: e.s, k: e.k === 'ship+' ? 0 : 2, e });
    for (const s of sc.samples) if (s.k === 'ship@') marks.push({ t: s.t, s: s.s, k: 1, e: s });
    marks.sort((a, b) => a.s - b.s || a.k - b.k);
    for (const m of marks) {
      const e = m.e;
      if (e.k === 'ship+') last.set(e.id, { x: e.x, y: e.y, t: e.t, lane: e.lane, cells: new Set() });
      else if (e.k === 'ship@') for (let i = 0; i < e.v.length; i += 3) stretch(e.v[i], e.t, e.v[i + 1], e.v[i + 2]);
      else if (e.k === 'ship-') {
        stretch(e.id, e.t, e.x, e.y);
        for (const c of last.get(e.id)?.cells ?? []) entered[c] += 1;
        last.delete(e.id);
      }
    }
    for (const [, l] of last) for (const c of l.cells) entered[c] += 1;
    shipSeconds += mine;
    byRun.set(r.id, mine);
  }
  return { seconds, entered, shipMinutes: shipSeconds / 60, byRun };
}

const kindOk = (f: Filter, kind: ThreatKind | string) => !f.kinds || f.kinds.includes(kind as ThreatKind);
const platOk = (f: Filter, p: Platform | undefined) => !f.platforms || (p !== undefined && f.platforms.includes(p));

interface Walk {
  run: RunData;
  e: TelEvent;
  ph: TelPhase;
  /** For a hit: the launch it traces back to. */
  root?: Spawn;
}

/** Every event the filter keeps, run by run. */
function* walk(runs: RunData[], f: Filter): Generator<Walk> {
  for (const run of runsIn(runs, f)) {
    const sc = run.sidecar;
    const sp = spans(sc, f);
    if (!sp.length) continue;
    const idx = spawnIndex(sc);
    const form = f.formation ? formationAt(sc) : null;
    for (const e of sc.events) {
      if (!inSpans(e.t, sp)) continue;
      const ph = sc.phases[e.p];
      if (e.k === 'hit') {
        if (!kindOk(f, e.by)) continue;
        const root = idx.root(e.src);
        if (f.platforms && !platOk(f, root ? platformOf(root) : undefined)) continue;
        if (f.lane !== undefined && e.vt === 's' && e.lane !== f.lane) continue;
        if (f.formation && e.vt === 's' && e.form !== f.formation) continue;
        yield { run, e, ph, root };
      } else if (e.k === 'thr+') {
        if (!kindOk(f, e.kind) || (f.platforms && !platOk(f, platformOf(e)))) continue;
        yield { run, e, ph };
      } else if (e.k === 'hurt') {
        if (f.weapon && e.by !== f.weapon && e.w !== f.weapon) continue;
        if (!kindOk(f, e.kind)) continue;
        yield { run, e, ph };
      } else if (e.k === 'tap') {
        if (f.weapon && e.w !== f.weapon && e.w2 !== f.weapon && !(f.weapon === 'gun' && !e.w)) continue;
        yield { run, e, ph };
      } else if (e.k === 'ship+' || e.k === 'ship-') {
        if (f.lane !== undefined && e.lane !== f.lane) continue;
        if (form && form(e.t) !== f.formation) continue;
        yield { run, e, ph };
      } else yield { run, e, ph };
    }
  }
}

const isLaunch = (e: TelEvent): e is Spawn => e.k === 'thr+' && !e.back && e.pid === undefined && e.o !== 'structure' && e.o !== 'seen';
const hitText = (h: Hit) => `${h.by} ${h.vt === 's' ? `hit ship ${h.vid}` : h.vt === 'c' ? 'hit the carrier' : `hit post ${h.vid}`}: ${h.hp} hull${h.sunk ? ', sunk' : ''}${h.dir ? '' : ' (splash)'}`;

/** One layer, as a grid, with what is behind each cell. */
export function layer(runs: RunData[], f: Filter, id: LayerId, metric: MetricId): LayerResult & { refs: EventRef[][] } {
  const N = GRID.w * GRID.h;
  const num = new Float64Array(N);
  const den = new Float64Array(N);
  const refs: EventRef[][] = Array.from({ length: N }, () => []);
  const ref = (c: number, w: Walk, text: string, imp?: number) => {
    if (c >= 0 && refs[c].length < 40) refs[c].push({ run: w.run.id, s: w.e.s, t: w.e.t, wave: w.ph.wave, text, ...(imp !== undefined ? { imp } : {}) });
  };
  const used = runsIn(runs, f);
  const seconds = used.reduce((a, r) => a + spans(r.sidecar, f).reduce((b, [x, y]) => b + y - x, 0), 0);
  let mask: (i: number) => boolean = () => false;
  let ratio = false;
  /** Where each pickup dropped, run by run. */
  const drops = new Map<string, Map<number, { x: number; y: number }>>();
  const dropOf = (run: RunData, pid: number) => {
    let m = drops.get(run.id);
    if (!m) {
      m = new Map();
      for (const o of run.sidecar.events) if (o.k === 'pk+') m.set(o.id, { x: o.x, y: o.y });
      drops.set(run.id, m);
    }
    return m.get(pid);
  };

  if (id === 'traffic' && metric !== 'sinks') {
    const ex = exposure(runs, f);
    if (metric === 'shipSeconds') ex.seconds.forEach((v, i) => (num[i] = v));
    else if (metric === 'entered') ex.entered.forEach((v, i) => (num[i] = v));
    else {
      ratio = true;
      ex.seconds.forEach((v, i) => (den[i] = v / 60));
      mask = (i) => ex.seconds[i] < THIN_SECONDS;
    }
  }
  for (const w of walk(runs, f)) {
    const e = w.e;
    if (id === 'launches' && isLaunch(e)) {
      const c = edge(e.x, e.y);
      num[c] += 1;
      ref(c, w, `${e.kind} launched (${platformOf(e)})`);
    } else if (id === 'sources') {
      if (isLaunch(e)) den[edge(e.x, e.y)] += 1;
      if (e.k === 'hit' && !e.blk && e.vt !== 'p' && w.root) {
        const c = edge(w.root.x, w.root.y);
        num[c] += e.hp;
        ref(c, w, `its ${hitText(e)}`, e.imp);
      }
    } else if (id === 'damage' && e.k === 'hit' && !e.blk && e.vt !== 'p') {
      const c = edge(e.vx, e.vy);
      if (metric === 'sinks' ? !e.sunk : false) continue;
      num[c] += metric === 'hp' ? e.hp : 1;
      ref(c, w, hitText(e), e.imp);
    } else if (id === 'traffic' && e.k === 'hit' && !e.blk && e.vt === 's') {
      const c = edge(e.vx, e.vy);
      if (metric === 'risk') {
        num[c] += e.hp;
        ref(c, w, hitText(e), e.imp);
      } else if (metric === 'sinks' && e.sunk) {
        num[c] += 1;
        ref(c, w, hitText(e), e.imp);
      }
    } else if (id === 'pickups' && e.k === 'pk-') {
      // Counted where it dropped; a pickup still on the water is not counted yet.
      const born = dropOf(w.run, e.id);
      const c = cellOf(born?.x ?? e.x, born?.y ?? e.y);
      if (c < 0) continue;
      const taken = e.why === 'collected';
      den[c] += 1;
      if (metric === 'dropped' || (metric === 'taken' && taken) || (metric === 'missed' && !taken) || (metric === 'takenRate' && taken)) num[c] += 1;
      ref(c, w, `${e.kind}${e.w ? ` (${e.w})` : ''} ${taken ? `taken after ${e.age.toFixed(1)} s` : e.why}`);
    } else if (id === 'intercepts') {
      if (e.k === 'tap' && (metric === 'taps' ? e.res === 'fire' : metric === 'dry' ? e.res === 'dry' || e.res === 'empty' : false)) {
        const c = cellOf(e.x, e.y);
        if (c < 0) continue;
        num[c] += 1;
        ref(c, w, `tap: ${e.res}${e.w ? ` with ${e.w}` : ''}`);
      } else if (e.k === 'hurt' && e.kill && metric === 'kills') {
        const c = edge(e.x, e.y);
        num[c] += 1;
        ref(c, w, `${e.kind} shot down by ${e.w ?? e.by}`);
      }
    }
    // (Commands and the map's own changes have no place of their own: they
    // are in `timeline`, not on the grid.)
  }
  if (id === 'sources' && metric === 'perLaunch') {
    ratio = true;
    mask = (i) => den[i] < THIN_COUNT;
  }
  if (id === 'pickups' && metric === 'takenRate') {
    ratio = true;
    mask = (i) => den[i] < THIN_COUNT;
  }
  const cells: Cell[] = [];
  let top = 0;
  let total = 0;
  for (let i = 0; i < N; i++) {
    // A rate: too little under it and something on top is masked (and
    // says so); nothing under it is no data; otherwise the rate, zero
    // included. A count is the count.
    const thin = ratio && mask(i);
    const masked = thin && num[i] > 0;
    const v = !ratio ? num[i] : thin || den[i] <= 0 ? null : num[i] / den[i];
    cells.push({ v, num: num[i], den: den[i], masked });
    if (v !== null) top = Math.max(top, v);
    total += num[i];
  }
  const def = LAYERS.find((l) => l.id === id)!.metrics.find((m) => m.id === metric) ?? LAYERS.find((l) => l.id === id)!.metrics[0];
  return { layer: id, metric, unit: def.unit, cells, top, total, runs: used.length, seconds, refs };
}

/** The numbers under the filter: every rate with what it is out of. */
export function summarize(runs: RunData[], f: Filter): Summary {
  const used = runsIn(runs, f);
  const ex = exposure(runs, f);
  const s: Summary = {
    runs: used.length,
    seconds: used.reduce((a, r) => a + spans(r.sidecar, f).reduce((b, [x, y]) => b + y - x, 0), 0),
    shipMinutes: ex.shipMinutes,
    launches: 0, hits: 0, blocked: 0, hpShip: 0, hpCarrier: 0, sunk: 0, sailed: 0, delivered: 0,
    risk: null, riskByRun: null, byKind: [],
    byPlatform: { base: { launches: 0, hp: 0 }, mobile: { launches: 0, hp: 0 }, air: { launches: 0, hp: 0 } },
    byFormation: {},
    pickups: { dropped: 0, taken: 0, expired: 0, cleared: 0 },
    taps: { fire: 0, pickup: 0, dry: 0, empty: 0 },
    kills: 0, killsBy: [], commands: 0,
  };
  const kinds = new Map<string, number>();
  const killsBy = new Map<string, number>();
  const hpByRun = new Map<string, number>();
  for (const w of walk(runs, f)) {
    const e = w.e;
    if (isLaunch(e)) {
      s.launches += 1;
      s.byPlatform[platformOf(e)].launches += 1;
    } else if (e.k === 'hit') {
      if (e.blk) {
        s.blocked += 1;
        continue;
      }
      if (e.vt === 'p') continue;
      s.hits += 1;
      if (e.vt === 's') {
        s.hpShip += e.hp;
        hpByRun.set(w.run.id, (hpByRun.get(w.run.id) ?? 0) + e.hp);
        if (e.form) {
          const b = (s.byFormation[e.form] ??= { hp: 0, sunk: 0 });
          b.hp += e.hp;
          if (e.sunk) b.sunk += 1;
        }
      } else s.hpCarrier += e.hp;
      kinds.set(e.by, (kinds.get(e.by) ?? 0) + e.hp);
      if (w.root) s.byPlatform[platformOf(w.root)].hp += e.hp;
    } else if (e.k === 'ship+') s.sailed += 1;
    else if (e.k === 'ship-') {
      if (e.why === 'sunk') s.sunk += 1;
      else s.delivered += 1;
    } else if (e.k === 'pk+') s.pickups.dropped += 1;
    else if (e.k === 'pk-') {
      if (e.why === 'collected') s.pickups.taken += 1;
      else if (e.why === 'expired') s.pickups.expired += 1;
      else s.pickups.cleared += 1;
    } else if (e.k === 'tap') s.taps[e.res] += 1;
    else if (e.k === 'hurt' && e.kill) {
      s.kills += 1;
      const by = e.w ?? e.by;
      killsBy.set(by, (killsBy.get(by) ?? 0) + 1);
    } else if (e.k === 'cmd') s.commands += 1;
  }
  s.byKind = [...kinds.entries()].sort((a, b) => b[1] - a[1]);
  s.killsBy = [...killsBy.entries()].sort((a, b) => b[1] - a[1]);
  if (ex.shipMinutes * 60 >= THIN_SECONDS) s.risk = s.hpShip / ex.shipMinutes;
  const per = used.map((r) => ({ sec: ex.byRun.get(r.id) ?? 0, hp: hpByRun.get(r.id) ?? 0 })).filter((o) => o.sec >= THIN_SECONDS).map((o) => o.hp / (o.sec / 60)).sort((a, b) => a - b);
  if (per.length >= 2) s.riskByRun = { min: per[0], median: per[Math.floor(per.length / 2)], max: per[per.length - 1] };
  return s;
}

/** Convoy commands and the map's own changes under the filter, in time. */
export function timeline(runs: RunData[], f: Filter): EventRef[] {
  const out: EventRef[] = [];
  for (const w of walk(runs, f)) {
    const e = w.e;
    if (e.k === 'cmd') {
      const refused = e.ok ? '' : `, refused (${e.why ?? 'no change'})`;
      const text =
        e.what === 'flow' || e.what === 'formation' || e.what === 'fork'
          ? `${e.what}: ${e.was} to ${e.req}${e.ok ? ` (${e.ships} ships afloat)` : refused}`
          : e.what === 'release'
            ? `release (${e.req}): ${e.was} group${e.was === 1 ? '' : 's'} waiting`
            : `${e.what}${e.ok ? (e.ids ? ` (${e.ids.length} ships)` : '') : refused}`;
      out.push({ run: w.run.id, s: e.s, t: e.t, wave: w.ph.wave, text });
    }
    else if (e.k === 'env') out.push({ run: w.run.id, s: e.s, t: e.t, wave: w.ph.wave, text: `${e.what}${e.i !== undefined ? ` ${e.i}` : ''}: ${e.st}` });
  }
  return out;
}

/** Events over time under the filter, in `bins` equal slices of the run
 *  (the scrubber's strip): launches, hull removed, kills. */
export function histogram(runs: RunData[], f: Filter, bins: number, length: number): { launches: number[]; hp: number[]; kills: number[] } {
  const h = { launches: new Array(bins).fill(0), hp: new Array(bins).fill(0), kills: new Array(bins).fill(0) };
  const at = (t: number) => Math.max(0, Math.min(bins - 1, Math.floor((t / Math.max(1e-9, length)) * bins)));
  for (const w of walk(runs, { ...f, window: undefined })) {
    const e = w.e;
    if (isLaunch(e)) h.launches[at(e.t)] += 1;
    else if (e.k === 'hit' && !e.blk && e.vt !== 'p') h.hp[at(e.t)] += e.hp;
    else if (e.k === 'hurt' && e.kill) h.kills[at(e.t)] += 1;
  }
  return h;
}

export interface TraceStep {
  what: 'warning' | 'platform' | 'launch' | 'split' | 'hurt' | 'impact' | 'victim';
  s: number;
  t: number;
  x?: number;
  y?: number;
  text: string;
}

/** A hit, from launcher to impact: the warning that went up, the platform
 *  that fired, the launch, each split on the way, the shots that failed to
 *  stop it, and every hull the blow reached. */
export function trace(sc: TelemetrySidecar, imp: number): TraceStep[] {
  const hits = sc.events.filter((e): e is Hit => e.k === 'hit' && e.imp === imp);
  if (!hits.length) return [];
  const idx = spawnIndex(sc);
  const steps: TraceStep[] = [];
  const chain: Spawn[] = [];
  let e = idx.get(hits[0].src);
  for (let k = 0; e && k < 8; k++) {
    chain.unshift(e);
    const up: number | undefined = e.pid ?? e.from;
    const parent = up === undefined ? undefined : idx.get(up);
    if (!parent || parent === e) break;
    e = parent;
  }
  const first = chain[0];
  if (first) {
    // The raid warning that covered the launch, and the launcher's own stops.
    if (first.raid !== undefined) {
      const ph = first.p;
      const w = sc.events.find((o) => o.k === 'warn' && o.what === 'raid' && o.raid === first.raid && o.p === ph);
      if (w && w.k === 'warn') steps.push({ what: 'warning', s: w.s, t: w.t, text: `${w.theme} raid warned, ${(first.t - w.t).toFixed(1)} s before this launch` });
    }
    if (first.from !== undefined && !idx.get(first.from)) {
      for (const o of sc.events) {
        if (o.k === 'rdr' && o.id === first.from && o.s <= first.s && (o.st === 'warn' || o.st === 'surface' || o.st === 'raise' || o.st === 'fire')) steps.push({ what: 'platform', s: o.s, t: o.t, x: o.x, y: o.y, text: `${o.kind === 'sub' ? 'submarine' : 'truck'}: ${o.st}` });
        if (o.k === 'mark+' && o.id === first.from) steps.push({ what: 'platform', s: o.s, t: o.t, x: o.x, y: o.y, text: `${o.kind} warning on the water, ${o.dur.toFixed(1)} s` });
      }
    }
  }
  chain.forEach((c, i) => {
    steps.push({ what: i === 0 ? 'launch' : 'split', s: c.s, t: c.t, x: c.x, y: c.y, text: i === 0 ? `${c.kind} launched from ${c.o === 'base' && c.base !== undefined ? `base ${c.base}` : c.o}` : `${c.kind} came off the ${chain[i - 1].kind}` });
    for (const o of sc.events) if (o.k === 'hurt' && o.id === c.id && !o.kill) steps.push({ what: 'hurt', s: o.s, t: o.t, x: o.x, y: o.y, text: `hit by ${o.w ?? o.by} for ${o.dmg}, ${o.left} left: not stopped` });
  });
  const h0 = hits[0];
  steps.push({ what: 'impact', s: h0.s, t: h0.t, x: h0.x, y: h0.y, text: `${h0.by} landed${first ? `, ${(h0.t - first.t).toFixed(1)} s after launch` : ''}` });
  for (const h of hits) steps.push({ what: 'victim', s: h.s, t: h.t, x: h.vx, y: h.vy, text: h.blk ? `${hitText(h)}: stopped (${h.blk})` : `${hitText(h)}${h.form ? `, in ${h.form}` : ''}` });
  return steps.sort((a, b) => a.s - b.s);
}

/** Two results on one scale: B less A, cell by cell (masked where either
 *  is). `top` is the largest absolute difference. */
export function diff(a: LayerResult, b: LayerResult): { cells: (number | null)[]; top: number; scaleTop: number } {
  const cells = a.cells.map((c, i) => (c.masked || b.cells[i].masked ? null : (b.cells[i].v ?? 0) - (c.v ?? 0)));
  return { cells, top: Math.max(0, ...cells.map((v) => Math.abs(v ?? 0))), scaleTop: Math.max(a.top, b.top) };
}
