// THE WHOLE V2 SIMULATION. Pure and deterministic: no DOM, no timers, no
// Math.random — every random choice comes from the seeded RNG, so a seed plus
// the same inputs replays the same game (tests and the bot sweep rely on it).
//
// The loop: ships flow left→right on fixed lanes; enemy bases launch the
// wave's drones and missiles at them; the player taps threats to fire
// interceptors from the carrier, and taps pickups to collect them. Clear the
// wave → pick 1 of 3 upgrade cards → next wave. Lose at RULES.shipLossLimit
// ships sunk or when the carrier goes down.

import { makeRng, type RNG } from '../../sim/rng';
import {
  BALLISTIC,
  CARRIER,
  CARRIER_STRIKE,
  CLUSTER,
  HEAVY,
  MOTHERSHIP,
  SUPERSONIC,
  zeroCounts,
  DEFAULT_FLOW,
  DRONE,
  FRIGATE,
  FLOW_STEPS,
  GUIDED,
  INTERCEPTOR,
  PICKUPS,
  PICKUP_KINDS,
  FLARE,
  SMOKE,
  RAID,
  RAID_THEME,
  RULES,
  SHIP,
  SUB,
  PLANE,
  THREATS,
  TRUCK,
  VIEW,
  type RaidTheme,
  type PickupKind,
  type ThreatKind,
} from '../data/config';
import { FORMATIONS, type FormationId } from '../data/formations';
import { MAPS, channelCycle, halfWidthAt, type MapDef, type MapId, type Point } from '../data/maps';
import { FIREPOWER, UPGRADES, UPGRADE_ORDER, canSwapIn, canTake, stats, type DefenseStats, type Levels, type UpgradeId } from '../data/upgrades';
import { waveSpec } from '../data/waves';

export const CARRIER_TARGET = -1;
/** A heavy cruise missile can go for the Escort Frigate instead (round 7). */
export const FRIGATE_TARGET = -2;

export interface Ship {
  id: number;
  x: number;
  y: number;
  hp: number;
  slot: number;
  channel: number;
  /** Flow multiplier locked in when the ship set sail. */
  mult: number;
}

export interface Threat {
  id: number;
  kind: ThreatKind;
  /** Where it is drawn and where it can be hit (airborne for ballistics). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  speed: number;
  heading: number;
  /** A ship id, or CARRIER_TARGET. */
  target: number;
  age: number;
  phase: number;
  dead: boolean;
  /** Children (bomblets, mini-drones) are blamed on what spawned them. */
  parent?: ThreatKind;
  /** Mothership: seconds until its next mini-drone. */
  spawnT: number;
  /** Ballistic only: launch point, fixed ground impact point, flight time, apex. */
  sx: number;
  sy: number;
  ix: number;
  iy: number;
  dur: number;
  apex: number;
  /** Aircraft: +1 flying right, -1 flying left. */
  side?: number;
  /** Strafing jet: hulls its guns have already hit on this pass. */
  hits?: number[];
  /** Strafing jet: guns are firing this step (renderer draws the tracers). */
  firing?: boolean;
  /** Bomber: guided missiles still aboard, and seconds since the last drop. */
  bombs?: number;
  dropT?: number;
  /** Decoy Flares: chasing a flare here instead of its ship (harmless). */
  decoy?: Point;
}

export interface Interceptor {
  id: number;
  x: number;
  y: number;
  target: number | null;
  tx: number;
  ty: number;
  life: number;
  /** Flak Burst: threats this interceptor has already clipped on its way. */
  flak?: number[];
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  age: number;
}

export type FxKind = 'boom' | 'splash' | 'tracer' | 'launch' | 'burst' | 'text' | 'sink' | 'spout' | 'spray' | 'flare' | 'flak' | 'block';

export interface Fx {
  kind: FxKind;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  age: number;
  life: number;
  text?: string;
}

export type GameEvent =
  | { kind: 'wave'; wave: number }
  | { kind: 'debut'; threat: ThreatKind }
  | { kind: 'vector'; vector: RaiderKind }
  | { kind: 'shipLost'; lost: number }
  | { kind: 'carrierHit'; hp: number }
  | { kind: 'pickup'; pickup: PickupKind }
  /** The first time a kind of pickup drops this game (UI explains it). */
  | { kind: 'newPickup'; pickup: PickupKind }
  | { kind: 'dry' };

export type Phase = 'wave' | 'draft' | 'won' | 'lost';

/** Cumulative totals at the end of each wave (playtest logs diff these). */
export interface WaveRecord {
  wave: number;
  t: number;
  outcome: 'cleared' | 'lost';
  score: number;
  delivered: number;
  lost: number;
  carrierHp: number;
  shots: number;
  kills: Record<ThreatKind, number>;
  sunkBy: Record<ThreatKind, number>;
  taps: TapCounts;
}

export type TapCounts = Record<TapResult, number>;

export interface Launch {
  at: number;
  kind: ThreatKind;
  base: number;
  /** Aircraft: which edge they come from (+1 = left edge, flying right), and
   *  the line they fly, fixed when their warning arrow appears. */
  side?: number;
  y?: number;
}

/** What a launcher carries: a single missile, or a drone swarm of `size`. */
interface Unit {
  kind: ThreatKind;
  size: number;
}

/** Launch platforms that are not targets (round 4): a submarine surfacing in
 *  open water, a truck that drives to the shore and back, a truck that runs
 *  the whole shore road. */
export type RaiderKind = 'sub' | 'popup' | 'runner';
export type RaiderState = 'warn' | 'surface' | 'fire' | 'dive' | 'drive' | 'raise' | 'lower' | 'reverse';

export interface Raider {
  id: number;
  kind: RaiderKind;
  x: number;
  y: number;
  /** Direction of travel (trucks) or of the bow (subs), radians. */
  heading: number;
  state: RaiderState;
  /** Seconds in the current state. */
  t: number;
  path: Point[];
  /** Distance along the path, and its length. */
  dist: number;
  length: number;
  /** Runner: distances along the road where it stops to fire. */
  stops: number[];
  /** What it still has to fire, expanded to single launches. */
  rounds: ThreatKind[];
  /** Whole units left (a runner fires one unit per stop). */
  units: Unit[];
  fireT: number;
}

export interface RaiderSpawn {
  at: number;
  kind: RaiderKind;
  path: Point[];
  units: Unit[];
}

/** Where each launch came from (the analyzer reads this). */
export type LaunchOrigin = 'base' | 'truck' | 'sub' | 'air' | 'child';

/** A friendly jet from a Strike Package, sweeping one line of the screen. */
export interface Ally {
  id: number;
  x: number;
  y: number;
  side: 1 | -1;
  band: number;
  /** Threats and launchers it has already hit (each once). */
  hits: number[];
  /** Game time of its last hit (the renderer flashes its guns). */
  firedT: number;
}

/** A Smoke Screen cloud, riding with the ship that laid it. */
export interface Smoke {
  ship: number;
  x: number;
  y: number;
  t: number;
}

/** The Escort Frigate: its own rack, and where it is on the water. */
export interface Frigate {
  x: number;
  y: number;
  /** Signed px/s this step (the renderer draws a wake while it moves). */
  vx: number;
  ammo: number;
  reloadT: number;
  hp: number;
}

/** A raid of the current wave: when it starts, its theme, and the bases it
 *  fires from (lit up during the warning). */
export interface Raid {
  at: number;
  theme: RaidTheme;
  bases: number[];
}

export interface Game {
  map: MapDef;
  seed: number;
  rng: { ships: RNG; threats: RNG; drops: RNG; draft: RNG };
  phase: Phase;
  t: number;
  wave: number;
  waveT: number;
  waveSpeed: number;
  queue: Launch[];
  raids: Raid[];
  /** Launch platforms on their way, and those in play. */
  raiderQueue: RaiderSpawn[];
  raiders: Raider[];
  origins: Record<LaunchOrigin, number>;
  seenVectors: Set<RaiderKind>;
  seenPickups: Set<PickupKind>;
  ships: Ship[];
  threats: Threat[];
  interceptors: Interceptor[];
  pickups: Pickup[];
  fx: Fx[];
  events: GameEvent[];
  carrierHp: number;
  ammo: number;
  reloadT: number;
  /** The Escort Frigate, once the card is taken. */
  frigate: Frigate | null;
  overdriveT: number;
  /** Round 4 pickups: seconds left on Time Warp, Shield and Full Steam. */
  warpT: number;
  shieldT: number;
  steamT: number;
  /** Smoke Screen / Decoy Flares recharge timers, and the smoke in play. */
  smokeT: number;
  smokes: Smoke[];
  flareT: number;
  allies: Ally[];
  /** Combat Rhythm: kills counted toward the next free round. */
  rhythm: number;
  flow: number;
  formation: FormationId;
  spawnT: number;
  spawnCount: number;
  channelCursor: number;
  levels: Levels;
  stats: DefenseStats;
  offer: UpgradeId[];
  score: number;
  delivered: number;
  lost: number;
  kills: Record<ThreatKind, number>;
  /** Ships sunk, by what finished them — the loss screen names the culprit. */
  sunkBy: Record<ThreatKind, number>;
  /** Carrier damage taken, by what dealt it. */
  carrierDamageBy: Record<ThreatKind, number>;
  shots: number;
  seen: Set<ThreatKind>;
  /** True once wave RULES.wavesToClear is beaten (map unlocked). */
  cleared: boolean;
  endless: boolean;
  nextId: number;
  /** Sim steps taken — playtest logs stamp every input with it, so a log
   *  replays exactly. */
  steps: number;
  taps: TapCounts;
  history: WaveRecord[];
}

// ---------------------------------------------------------------------------
// Setup

/** `firstWave` > 1 skips ahead (playtesting a late wave via `?wave=N`). */
export function createGame(mapId: MapId, seed: number, firstWave = 1): Game {
  const root = makeRng(seed);
  const s = stats({});
  const g: Game = {
    map: MAPS[mapId],
    seed,
    rng: {
      ships: root.fork('ships'),
      threats: root.fork('threats'),
      drops: root.fork('drops'),
      draft: root.fork('draft'),
    },
    phase: 'wave',
    t: 0,
    wave: 0,
    waveT: 0,
    waveSpeed: 1,
    queue: [],
    raids: [],
    raiderQueue: [],
    raiders: [],
    origins: { base: 0, truck: 0, sub: 0, air: 0, child: 0 },
    seenVectors: new Set(),
    seenPickups: new Set(),
    ships: [],
    threats: [],
    interceptors: [],
    pickups: [],
    fx: [],
    events: [],
    carrierHp: CARRIER.hp,
    ammo: s.rack,
    reloadT: 0,
    frigate: null,
    overdriveT: 0,
    warpT: 0,
    shieldT: 0,
    steamT: 0,
    smokeT: 0,
    smokes: [],
    flareT: 0,
    allies: [],
    rhythm: 0,
    flow: DEFAULT_FLOW,
    formation: 'pairs',
    spawnT: 0,
    spawnCount: 0,
    channelCursor: 0,
    levels: {},
    stats: s,
    offer: [],
    score: 0,
    delivered: 0,
    lost: 0,
    kills: zeroCounts(),
    sunkBy: zeroCounts(),
    carrierDamageBy: zeroCounts(),
    shots: 0,
    seen: new Set(),
    cleared: false,
    endless: false,
    nextId: 1,
    steps: 0,
    taps: { fire: 0, pickup: 0, dry: 0, empty: 0 },
    history: [],
  };
  // Skipping ahead (playtesting a late wave) also hands over the cards a
  // player would have drafted by then, so the wave plays as it really would.
  for (let w = 1; w < Math.floor(firstWave); w++) {
    g.wave = w;
    openDraft(g);
    const pick = g.offer.find((id) => id !== 'resupply' && canTake(g.levels, id));
    if (pick) {
      g.levels[pick] = (g.levels[pick] ?? 0) + 1;
      g.stats = stats(g.levels);
    }
  }
  g.ammo = g.stats.rack;
  syncFrigate(g, true);
  g.wave = Math.max(0, Math.floor(firstWave) - 1);
  startWave(g);
  return g;
}

function startWave(g: Game): void {
  // A frigate sunk last wave sails back in, repaired.
  if (g.stats.frigate && !g.frigate) syncFrigate(g, false);
  g.wave += 1;
  g.waveT = 0;
  g.phase = 'wave';
  g.offer = [];
  const spec = waveSpec(g.wave, g.map.threatScale);
  g.waveSpeed = spec.speed;
  const rng = g.rng.threats;
  const lead = RULES.waveLeadIn;
  const queue: Launch[] = [];
  // Most launches bunch into raids: a few seconds of several bases firing
  // at once, then a short breather. Each raid is one family of threat (a
  // drone swarm, a splash barrage, a guided volley), so each calls for its
  // own answer; a share of drone swarms trickles in between raids.
  const swarms: number[] = [];
  for (let left = spec.drones; left > 0; ) {
    const size = Math.min(left, Math.max(2, spec.swarm - rng.int(2)));
    swarms.push(size);
    left -= size;
  }
  const trickle = Math.round(swarms.length * RAID.trickle);
  // Everything that goes into raids, by family: a drone swarm counts as one unit.
  const units: Unit[] = swarms.slice(trickle).map((size) => ({ kind: 'drone', size }));
  for (let k = 0; k < spec.ballistic; k++) units.push({ kind: 'ballistic', size: 1 });
  for (let k = 0; k < spec.guided; k++) units.push({ kind: 'guided', size: 1 });
  for (const x of g.map.extras) {
    if (g.wave < x.from) continue;
    const n = Math.round(x.count + x.growth * (g.wave - x.from));
    for (let k = 0; k < n; k++) units.push({ kind: x.kind, size: 1 });
  }
  // Aircraft join from the map's chosen wave. They stand in for part of the
  // table rather than adding to it: a strafing jet replaces a drone swarm, a
  // bomber's two missiles come out of the guided count (round 4's first runs,
  // with aircraft on top, sank 2.5-3 more ships a game).
  const vp = g.map.vectors;
  const replace = (kind: ThreatKind, n: number) => {
    for (let k = 0; k < n; k++) {
      const i = units.findIndex((u) => u.kind === kind);
      if (i >= 0) units.splice(i, 1);
    }
  };
  for (let k = 0; k < vectorCount(g.wave, vp.strafers, 4, 2); k++) {
    replace('drone', 1);
    units.push({ kind: 'strafer', size: 1 });
  }
  for (let k = 0; k < vectorCount(g.wave, vp.bombers, 4, 2); k++) {
    replace('guided', PLANE.bombs);
    units.push({ kind: 'bomber', size: 1 });
  }
  const themes: RaidTheme[] = ['swarm', 'barrage', 'volley', 'strike'];
  const count = (t: RaidTheme) => units.filter((u) => RAID_THEME[u.kind] === t).length;
  const present = themes.filter((t) => count(t) > 0);
  const total = Math.max(present.length, Math.round(spec.duration / RAID.every));
  // Raids per theme, in proportion to its units (at least one each).
  const per = new Map(present.map((t) => [t, 1]));
  for (let k = present.length; present.length && k < total; k++) {
    const t = present.reduce((a, b) => (count(b) / per.get(b)! > count(a) / per.get(a)! ? b : a));
    per.set(t, per.get(t)! + 1);
  }
  const order = rng.shuffle(present.flatMap((t) => Array.from({ length: per.get(t)! }, () => t)));
  const raids: Raid[] = order.map((theme, k) => ({ at: lead + RAID.warn * 0.4 + (spec.duration * k) / order.length, theme, bases: [] }));
  const raidUnits: Unit[][] = raids.map(() => []);
  const cursor = new Map<RaidTheme, number>();
  for (const u of units) {
    const theme = RAID_THEME[u.kind];
    const mine = raids.map((r, k) => k).filter((k) => raids[k].theme === theme);
    const at0 = cursor.get(theme) ?? rng.int(mine.length);
    raidUnits[mine[at0 % mine.length]].push(u);
    cursor.set(theme, at0 + 1);
  }
  g.raiderQueue = planVectors(g, raids, raidUnits, rng);
  raids.forEach((raid, r) => {
    for (const u of raidUnits[r]) {
      const at = raid.at + rng.range(0, RAID.window);
      if (u.kind === 'strafer' || u.kind === 'bomber') {
        queue.push({ at, kind: u.kind, base: -1, side: rng.chance(0.5) ? 1 : -1 });
        continue;
      }
      const base = pickBase(g, u.kind, rng);
      if (!raid.bases.includes(base)) raid.bases.push(base);
      for (let d = 0; d < u.size; d++) queue.push({ at: at + d * 0.35, kind: u.kind, base });
    }
  });
  g.raids = raids;
  swarms.slice(0, trickle).forEach((size, k) => {
    const base = pickBase(g, 'drone', rng);
    const at = lead + (spec.duration * (k + 0.5)) / Math.max(1, trickle) + rng.range(-2, 2);
    for (let d = 0; d < size; d++) queue.push({ at: at + d * 0.35, kind: 'drone', base });
  });
  queue.sort((a, b) => a.at - b.at);
  g.queue = queue;
  g.events.push({ kind: 'wave', wave: g.wave });
}

/** How many of a vector join a wave: none before `from`, then one more every
 *  `every` waves, up to `cap`. */
function vectorCount(wave: number, from: number, every: number, cap: number): number {
  return wave < from ? 0 : Math.min(cap, 1 + Math.floor((wave - from) / every));
}

/** Hand some of each raid's launches to submarines and trucks, so threats come
 *  from the water and from moving launchers as well as the fixed bases (round
 *  4: 62% of the player's taps landed within 200 px of a base). Takes the units
 *  it uses out of `raidUnits`; returns the launchers to spawn, timed so they
 *  fire as their raid starts. */
function planVectors(g: Game, raids: Raid[], raidUnits: Unit[][], rng: RNG): RaiderSpawn[] {
  const out: RaiderSpawn[] = [];
  const vp = g.map.vectors;
  const take = (r: number, pred: (u: Unit) => boolean, n: number): Unit[] => {
    const got: Unit[] = [];
    for (let k = 0; k < raidUnits[r].length && got.length < n; ) {
      if (pred(raidUnits[r][k])) got.push(...raidUnits[r].splice(k, 1));
      else k++;
    }
    return got;
  };
  const surfaceKind = (u: Unit) => u.kind === 'ballistic' || u.kind === 'drone';
  const truckKind = (u: Unit) => u.kind !== 'strafer' && u.kind !== 'bomber' && u.kind !== 'mothership';
  // Submarines: a salvo of ballistics back to back, or a drone swarm.
  const spots = rng.shuffle([...g.map.subSpots]);
  for (let k = 0; k < vectorCount(g.wave, vp.subs, 2, 3) && spots.length; k++) {
    const options = raids.map((_, r) => r).filter((r) => raidUnits[r].some(surfaceKind));
    if (!options.length) break;
    const r = rng.pick(options);
    const barrage = raidUnits[r].some((u) => u.kind === 'ballistic');
    let load = barrage ? take(r, (u) => u.kind === 'ballistic', SUB.salvo) : take(r, (u) => u.kind === 'drone', 1);
    if (barrage) while (load.length < SUB.salvo) load.push({ kind: 'ballistic', size: 1 });
    const spot = spots.shift()!;
    out.push({ at: Math.max(0.2, raids[r].at - SUB.warn - SUB.surface), kind: 'sub', path: [spot], units: load });
  }
  // Trucks: pop-ups drive to the shore, fire one or two, reverse out; runners
  // drive the whole road, stopping to fire each of up to three.
  const roads = g.map.roads;
  for (let k = 0; k < vectorCount(g.wave, vp.trucks, 2, 5); k++) {
    const options = raids.map((_, r) => r).filter((r) => raidUnits[r].some(truckKind));
    if (!options.length) break;
    const r = rng.pick(options);
    const runner = roads.runners.length > 0 && rng.chance(0.4);
    if (runner) {
      const path = rng.pick(roads.runners);
      const load = take(r, truckKind, 4);
      const length = pathLength(path);
      const firstStop = length * 0.2;
      out.push({ at: Math.max(0.2, raids[r].at - firstStop / TRUCK.runnerSpeed - TRUCK.raise), kind: 'runner', path, units: load });
    } else {
      const road = rng.pick(roads.popups);
      const load = take(r, truckKind, 2);
      const drive = dist(road.from.x, road.from.y, road.to.x, road.to.y) / TRUCK.speed;
      out.push({ at: Math.max(0.2, raids[r].at - drive - TRUCK.raise), kind: 'popup', path: [road.from, road.to], units: load });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

function pathLength(path: Point[]): number {
  let n = 0;
  for (let k = 1; k < path.length; k++) n += dist(path[k - 1].x, path[k - 1].y, path[k].x, path[k].y);
  return n;
}

/** The point `d` along a path, and the heading of the stretch it is on. */
function along(path: Point[], d: number): { x: number; y: number; heading: number } {
  let left = Math.max(0, d);
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1];
    const b = path[k];
    const seg = dist(a.x, a.y, b.x, b.y);
    if (left <= seg || k === path.length - 1) {
      const u = seg > 0 ? Math.min(1, left / seg) : 0;
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, heading: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    left -= seg;
  }
  return { x: path[0].x, y: path[0].y, heading: 0 };
}

function pickBase(g: Game, kind: ThreatKind, rng: RNG): number {
  const able = g.map.bases.map((b, i) => (b.kinds.includes(kind) ? i : -1)).filter((i) => i >= 0);
  return able.length ? rng.pick(able) : rng.int(g.map.bases.length);
}

// ---------------------------------------------------------------------------
// Player commands

export function setFlow(g: Game, flow: number): void {
  const next = Math.max(0, Math.min(FLOW_STEPS.length - 1, Math.round(flow)));
  if (next === g.flow) return;
  g.flow = next;
  // Speeding up takes effect now rather than after the old (longer) gap.
  g.spawnT = Math.min(g.spawnT, spawnGap(g));
}

export function setFormation(g: Game, id: FormationId): void {
  if (id === g.formation) return;
  g.formation = id;
  const offsets = FORMATIONS[id].offsets;
  // Re-slot every hull, front of the convoy first, so the change is visible
  // right away; the ships glide over to their new lanes. Ships sailing abreast
  // are re-slotted as a row that keeps its top-to-bottom order, so no hull is
  // sent across another's bow.
  const order = [...g.ships].sort((a, b) => b.x - a.x);
  let next = 0;
  for (let i = 0; i < order.length; ) {
    let j = i + 1;
    while (j < order.length && order[i].x - order[j].x < SHIP.minGap / 2) j++;
    const row = order.slice(i, j).sort((a, b) => a.y - b.y);
    const slots = row.map((_, k) => (next + k) % offsets.length).sort((a, b) => offsets[a] - offsets[b]);
    row.forEach((s, k) => (s.slot = slots[k]));
    next += row.length;
    i = j;
  }
  g.spawnCount = 0;
}

export type TapResult = 'fire' | 'pickup' | 'dry' | 'empty';

/** A tap at (x, y) in world units, reaching `radius` world units. */
export function tap(g: Game, x: number, y: number, radius: number): TapResult {
  if (g.phase !== 'wave') return 'empty';
  const result = tapResult(g, x, y, radius);
  g.taps[result] += 1;
  return result;
}

function tapResult(g: Game, x: number, y: number, radius: number): TapResult {
  let pickup: Pickup | null = null;
  let pd = (radius + PICKUPS.radius) * g.stats.grabMult;
  for (const p of g.pickups) {
    const d = dist(x, y, p.x, p.y);
    if (d < pd) {
      pd = d;
      pickup = p;
    }
  }
  // Prefer a threat that still needs an interceptor, so repeated taps on a
  // swarm spread across it instead of piling onto one drone.
  let threat: Threat | null = null;
  let td = Infinity;
  let fallback: Threat | null = null;
  let fd = Infinity;
  for (const th of g.threats) {
    if (th.dead) continue;
    const d = dist(x, y, th.x, th.y);
    if (d > radius) continue;
    if (d < fd) {
      fd = d;
      fallback = th;
    }
    if (assigned(g, th.id) < th.hp && d < td) {
      td = d;
      threat = th;
    }
  }
  if (!threat) {
    threat = fallback;
    td = fd;
  }
  if (pickup && (!threat || pd <= td)) {
    collect(g, pickup);
    return 'pickup';
  }
  if (!threat) return 'empty';
  return fireAt(g, threat) ? 'fire' : 'dry';
}

/** Take a draft card. `replace` swaps a new card in for one you hold when
 *  all slots are full: the replaced card and its levels are gone. */
export function pickUpgrade(g: Game, id: UpgradeId, replace?: UpgradeId): void {
  if (g.phase !== 'draft' || !g.offer.includes(id)) return;
  const swap = replace !== undefined && canSwapIn(g.levels, id) && (g.levels[replace] ?? 0) > 0;
  if (!swap && !canTake(g.levels, id)) return;
  if (swap) delete g.levels[replace];
  if (id === 'resupply') {
    for (const s of g.ships) s.hp = g.stats.shipHp;
    g.carrierHp = g.stats.carrierHp;
    g.ammo = g.stats.rack;
    if (g.frigate) g.frigate.ammo = g.stats.frigateRack;
    startWave(g);
    return;
  }
  const old = g.stats;
  g.levels[id] = (g.levels[id] ?? 0) + 1;
  g.stats = stats(g.levels);
  g.ammo = Math.max(0, Math.min(g.stats.rack, g.ammo + (g.stats.rack - old.rack)));
  // Armored Hulls toughen the hulls already at sea (and a swap that gives it
  // up never leaves a hull above the new maximum).
  for (const s of g.ships) s.hp = Math.max(1, Math.min(g.stats.shipHp, s.hp + g.stats.shipHp - old.shipHp));
  g.carrierHp = Math.max(1, Math.min(g.stats.carrierHp, g.carrierHp + g.stats.carrierHp - old.carrierHp));
  syncFrigate(g, false);
  startWave(g);
}

/** Bring the frigate in line with the card: it arrives (sailing in from the
 *  screen edge on its station's side of the carrier, so it never crosses the
 *  carrier; or already on station when skipping ahead) when the card is
 *  taken, its rack grows with the level, and it leaves if swapped out. */
function syncFrigate(g: Game, onStation: boolean): void {
  const rack = g.stats.frigateRack;
  if (!g.stats.frigate) {
    g.frigate = null;
    return;
  }
  if (!g.frigate) {
    const st = g.map.frigate;
    const edge = st.x < g.map.carrier.x ? FRIGATE.startX : VIEW.width - FRIGATE.startX;
    g.frigate = { x: onStation ? st.x : edge, y: st.y, vx: 0, ammo: rack, reloadT: 0, hp: FRIGATE.hp };
    return;
  }
  g.frigate.ammo = Math.min(rack, g.frigate.ammo + 3);
}

/** After clearing the map, keep going for score. */
export function continueEndless(g: Game): void {
  if (g.phase !== 'won') return;
  g.endless = true;
  openDraft(g);
}

/** Chance each draft draw comes from the loadout's own (unmaxed) cards. */
const OWNED_DRAW = 0.37;

function openDraft(g: Game): void {
  // Three random cards from everything not yet maxed. With a full loadout, a
  // new card can still be swapped in for one you hold — whether one of your
  // own comes up to level is the luck of the draw — and if nothing can be
  // taken without a swap, Resupply is added so keeping your build is a choice.
  // Each of the three draws favours a card you already hold (OWNED_DRAW), so a
  // loadout levels up in most drafts but not all.
  const open = UPGRADE_ORDER.filter((id) => (g.levels[id] ?? 0) < UPGRADES[id].max);
  const rng = g.rng.draft;
  const mine = rng.shuffle(open.filter((id) => (g.levels[id] ?? 0) > 0));
  const other = rng.shuffle(open.filter((id) => !(g.levels[id] ?? 0)));
  g.offer = [];
  while (g.offer.length < 3 && (mine.length || other.length)) {
    const fromMine = mine.length && (!other.length || rng.chance(OWNED_DRAW));
    g.offer.push((fromMine ? mine : other).shift()!);
  }
  // At least one firepower card: if none was dealt, the last card dealt from
  // the open pool gives way to the first firepower card left in it.
  if (!g.offer.some((id) => FIREPOWER.includes(id))) {
    const fire = [...mine, ...other].find((id) => FIREPOWER.includes(id));
    const k = g.offer.length - 1;
    if (fire && k >= 0) g.offer[k] = fire;
  }
  if (!g.offer.some((id) => canTake(g.levels, id))) g.offer.push('resupply');
  g.phase = 'draft';
}

// ---------------------------------------------------------------------------
// The step

export function step(g: Game, dt: number): void {
  if (g.phase !== 'wave') return;
  g.steps += 1;
  g.t += dt;
  g.waveT += dt;

  spawnShips(g, dt);
  // An aircraft's line is fixed when its warning arrow appears.
  for (const l of g.queue) {
    if (l.at - g.waveT > PLANE.warn + g.stats.radarLead) break;
    if ((l.kind === 'strafer' || l.kind === 'bomber') && l.y === undefined) l.y = planeLine(g, l.kind, g.rng.threats);
  }
  while (g.queue.length && g.queue[0].at <= g.waveT) launch(g, g.queue.shift()!);
  while (g.raiderQueue.length && g.raiderQueue[0].at <= g.waveT) spawnRaider(g, g.raiderQueue.shift()!);
  for (const r of g.raiders) updateRaider(g, r, dt);
  g.raiders = g.raiders.filter((r) => r.state !== 'reverse' || r.dist > 0);
  reload(g, dt);
  updateShips(g, dt);
  // Time Warp slows every threat (not the convoy, not your interceptors).
  const tdt = g.warpT > 0 ? dt * PICKUPS.warpScale : dt;
  for (const th of g.threats) if (!th.dead) updateThreat(g, th, tdt);
  updateTimers(g, dt);
  updateAllies(g, dt);
  updateFrigate(g, dt);
  updateInterceptors(g, dt);

  g.threats = g.threats.filter((th) => !th.dead);
  updatePickups(g, dt);
  for (const f of g.fx) f.age += dt;
  g.fx = g.fx.filter((f) => f.age < f.life);

  if (g.lost >= RULES.shipLossLimit || g.carrierHp <= 0) {
    g.phase = 'lost';
    recordWave(g, 'lost');
    return;
  }
  if (g.queue.length === 0 && g.threats.length === 0 && g.raiders.length === 0 && g.raiderQueue.length === 0) {
    g.score += 200 * g.wave;
    recordWave(g, 'cleared');
    if (!g.endless && g.wave >= RULES.wavesToClear) {
      g.cleared = true;
      g.phase = 'won';
    } else {
      openDraft(g);
    }
  }
}

function recordWave(g: Game, outcome: WaveRecord['outcome']): void {
  g.history.push({
    wave: g.wave,
    t: Math.round(g.t * 10) / 10,
    outcome,
    score: g.score,
    delivered: g.delivered,
    lost: g.lost,
    carrierHp: g.carrierHp,
    shots: g.shots,
    kills: { ...g.kills },
    sunkBy: { ...g.sunkBy },
    taps: { ...g.taps },
  });
}

// ---------------------------------------------------------------------------
// Ships

function spawnGap(g: Game): number {
  return FLOW_STEPS[g.flow].interval * FORMATIONS[g.formation].group;
}

function slotY(g: Game, s: Ship): number {
  const ch = g.map.channels[s.channel];
  const offsets = FORMATIONS[g.formation].offsets;
  return ch.y + offsets[s.slot % offsets.length] * halfWidthAt(ch, s.x);
}

function spawnShips(g: Game, dt: number): void {
  g.spawnT -= dt;
  if (g.spawnT > 0) return;
  const f = FORMATIONS[g.formation];
  const cycle = channelCycle(g.map);
  const channel = cycle[g.channelCursor % cycle.length];
  // Never drop a hull on top of one still waiting at the entry: hold the spawn
  // (it retries next tick) until the entry is clear.
  const ch = g.map.channels[channel];
  const entryBusy = g.ships.some(
    (s) => s.x < -40 + SHIP.minGap + SHIP.easeGap && Math.abs(s.y - ch.y) <= ch.halfWidth + SHIP.laneMatch,
  );
  if (entryBusy) return;
  g.channelCursor++;
  for (let i = 0; i < f.group; i++) {
    const slot = f.group > 1 ? i : g.spawnCount++ % f.offsets.length;
    const ship: Ship = {
      id: g.nextId++,
      x: -40 - g.rng.ships.range(0, 12),
      y: 0,
      hp: g.stats.shipHp,
      slot,
      channel,
      mult: FLOW_STEPS[g.flow].mult,
    };
    ship.y = slotY(g, ship);
    g.ships.push(ship);
  }
  g.spawnT += spawnGap(g);
}

function updateShips(g: Game, dt: number): void {
  const ease = Math.min(1, SHIP.slotEase * dt);
  // Keep station on the rails: a hull eases off when the one ahead in its lane
  // is too close. This is what turns two ships abreast into a single file when
  // a formation change merges their lanes, instead of stacking them.
  const order = [...g.ships].sort((a, b) => b.x - a.x || a.id - b.id);
  const lane = order.map((s) => slotY(g, s));
  for (let i = 0; i < order.length; i++) {
    const s = order[i];
    let gap = Infinity;
    for (let j = 0; j < i; j++) {
      const o = order[j];
      if (Math.abs(lane[j] - lane[i]) < SHIP.laneMatch || Math.abs(o.y - s.y) < SHIP.laneMatch) {
        gap = Math.min(gap, o.x - s.x);
      }
    }
    const slow = clamp((gap - SHIP.minGap) / SHIP.easeGap, 0, 1);
    s.x += laneSpeed(g, s) * slow * dt;
    // Only move across into the new lane once that stretch of it is empty.
    const clear = order.every(
      (o, j) => j === i || Math.abs(o.x - s.x) >= SHIP.minGap || Math.abs(o.y - lane[i]) >= SHIP.laneMatch,
    );
    if (clear) s.y += (lane[i] - s.y) * ease;
  }
  const arrived = g.ships.filter((s) => s.x > VIEW.width + 40);
  for (const s of arrived) {
    const pts = Math.round(SHIP.points * s.mult);
    g.score += pts;
    g.delivered += 1;
    addFx(g, 'text', VIEW.width - 70, s.y, { life: 1.2, text: `+${pts}` });
  }
  if (arrived.length) g.ships = g.ships.filter((s) => s.x <= VIEW.width + 40);
}

/** Ships the enemy is allowed to aim at: on screen and not about to deliver. */
function targetable(g: Game, maxX = VIEW.width - 90): Ship[] {
  return g.ships.filter((s) => s.x > 30 && s.x < maxX);
}

/** The convoy's speed in the current formation. */
export function shipSpeed(g: Game): number {
  return SHIP.speed * FORMATIONS[g.formation].speed * (g.steamT > 0 ? PICKUPS.steamMult : 1);
}

/** A hull's speed in its own channel (some lanes are crossed faster). */
function laneSpeed(g: Game, s: Ship): number {
  return shipSpeed(g) * (g.map.channels[s.channel]?.speed ?? 1);
}

/** How fast the ship a threat is after is moving (0 for the carrier/frigate). */
function targetSpeed(g: Game, th: Threat): number {
  const s = g.ships.find((o) => o.id === th.target);
  return s ? laneSpeed(g, s) : 0;
}

// Bomblets are blamed on the cluster that dropped them.
const SPLASH_WEAPONS: ThreatKind[] = ['ballistic', 'heavy', 'cluster', 'bomblet'];

/** `direct`: the hit was aimed at this ship (formation armour applies);
 *  splash spilling over from a neighbour's hit is not reduced. Spread's
 *  blast cut applies to splash weapons either way. */
function damageShip(g: Game, s: Ship, amount: number, by: ThreatKind, direct = true): void {
  if (g.shieldT > 0) {
    addFx(g, 'block', s.x, s.y, { life: 0.4, r: 30 });
    return;
  }
  // Smoke Screen: the hit ship lays smoke (once per recharge).
  if (g.stats.smokeEvery > 0 && g.smokeT <= 0) {
    g.smokes.push({ ship: s.id, x: s.x, y: s.y, t: 0 });
    g.smokeT = g.stats.smokeEvery;
  }
  const f = FORMATIONS[g.formation];
  if (f.blastCut > 0 && SPLASH_WEAPONS.includes(by)) amount = Math.max(1, Math.ceil(amount * (1 - f.blastCut)));
  s.hp -= direct ? Math.max(1, amount - f.armor) : amount;
  if (s.hp > 0) return;
  g.ships = g.ships.filter((o) => o !== s);
  g.lost += 1;
  g.sunkBy[by] += 1;
  addFx(g, 'sink', s.x, s.y, { life: 2.2, r: 34 });
  g.events.push({ kind: 'shipLost', lost: g.lost });
}

function damageCarrier(g: Game, amount: number, by: ThreatKind): void {
  if (g.shieldT > 0) {
    addFx(g, 'block', g.map.carrier.x, g.map.carrier.y, { life: 0.4, r: 60 });
    return;
  }
  g.carrierHp = Math.max(0, g.carrierHp - amount);
  g.carrierDamageBy[by] += amount;
  g.events.push({ kind: 'carrierHit', hp: g.carrierHp });
}

function onCarrier(g: Game, x: number, y: number, pad = 0): boolean {
  const c = g.map.carrier;
  const dx = (x - c.x) / (CARRIER.halfLength + pad);
  const dy = (y - c.y) / (CARRIER.halfBeam + pad);
  return dx * dx + dy * dy <= 1;
}

// ---------------------------------------------------------------------------
// Threats

/** How much of a wave's speed-up each threat takes (fast ones take less). */
const WAVE_SPEED_SHARE: Record<ThreatKind, number> = {
  drone: 1,
  ballistic: 1,
  guided: GUIDED.waveSpeedShare,
  supersonic: SUPERSONIC.waveSpeedShare,
  heavy: HEAVY.waveSpeedShare,
  cluster: GUIDED.waveSpeedShare,
  mothership: MOTHERSHIP.waveSpeedShare,
  strafer: 0.3,
  bomber: 0.3,
  bomblet: 0.5,
  minidrone: 1,
};

function launch(g: Game, l: Launch): void {
  if (l.kind === 'strafer' || l.kind === 'bomber') {
    launchPlane(g, l);
    return;
  }
  const base = g.map.bases[l.base];
  spawnThreat(g, l.kind, base.x, base.y, 'base');
}

/** A threat leaves a launcher at (x, y): a base, a truck or a submarine. */
function spawnThreat(g: Game, kind: ThreatKind, x: number, y: number, origin: LaunchOrigin): Threat {
  const def = THREATS[kind];
  const rng = g.rng.threats;
  g.origins[origin] += 1;
  if (!g.seen.has(kind)) {
    g.seen.add(kind);
    g.events.push({ kind: 'debut', threat: kind });
  }
  const th: Threat = {
    id: g.nextId++,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: def.hp,
    speed: def.speed * (1 + (g.waveSpeed - 1) * WAVE_SPEED_SHARE[kind]) * g.stats.threatSlow,
    heading: 0,
    target: CARRIER_TARGET,
    age: 0,
    phase: rng.range(0, Math.PI * 2),
    dead: false,
    spawnT: MOTHERSHIP.spawnEvery * 0.5,
    sx: x,
    sy: y,
    ix: 0,
    iy: 0,
    dur: 1,
    apex: 0,
  };
  const strike = CARRIER_STRIKE[kind];
  const goCarrier = kind === 'mothership' || (!!strike && g.wave >= strike.from && rng.chance(strike.share));
  const pool = targetable(g, kind === 'ballistic' ? VIEW.width - 320 : undefined);
  if (!goCarrier && pool.length) th.target = rng.pick(pool).id;
  else if (goCarrier && kind === 'heavy' && g.frigate && rng.chance(FRIGATE.heavyShare)) th.target = FRIGATE_TARGET;

  if (kind === 'ballistic') aimBallistic(g, th);
  const tp = targetPos(g, th);
  th.heading = Math.atan2(tp.y - th.y, tp.x - th.x);
  g.threats.push(th);
  // Launch flash by where it came from: a base's red flare, a column of spray
  // off a submarine's deck, a truck's smaller flash (round 4: the base flare
  // drawn over a sub or a truck hid it completely).
  if (origin === 'sub') addFx(g, 'spray', x, y, { life: 0.7, r: 16 });
  else if (origin === 'truck') addFx(g, 'launch', x, y, { life: 0.45, r: 9 });
  else if (origin === 'base') addFx(g, 'launch', x, y, { life: 0.6, r: 20 });
  return th;
}

/** The line an aircraft flies. A strafing jet lines up on the densest band of
 *  hulls (a tight block is its favourite target); a bomber flies just outside
 *  a shipping channel and drops its missiles in. */
function planeLine(g: Game, kind: ThreatKind, rng: RNG): number {
  if (kind === 'bomber') return rng.pick(g.map.bomberLines);
  const ch = g.map.channels[rng.int(g.map.channels.length)];
  let best = ch.y;
  let most = 0;
  for (const s of g.ships) {
    const n = g.ships.filter((o) => Math.abs(o.y - s.y) <= PLANE.band).length;
    if (n > most) {
      most = n;
      best = s.y;
    }
  }
  return best;
}

function launchPlane(g: Game, l: Launch): void {
  const side = l.side ?? 1;
  const y = l.y ?? planeLine(g, l.kind, g.rng.threats);
  const x = side > 0 ? -60 : VIEW.width + 60;
  const th = spawnThreat(g, l.kind, x, y, 'air');
  th.side = side;
  th.heading = side > 0 ? 0 : Math.PI;
  th.target = CARRIER_TARGET;
  th.hits = [];
  th.bombs = l.kind === 'bomber' ? PLANE.bombs : 0;
  th.dropT = 99;
}

/** Ballistics commit at launch to the point their ship will have reached. */
function aimBallistic(g: Game, th: Threat): void {
  const t = targetPos(g, th);
  const v = targetSpeed(g, th);
  let ix = t.x;
  let dur = dist(th.sx, th.sy, t.x, t.y) / th.speed;
  for (let k = 0; k < 2; k++) {
    ix = t.x + v * dur;
    dur = dist(th.sx, th.sy, ix, t.y) / th.speed;
  }
  th.ix = Math.min(VIEW.width - 20, ix);
  th.iy = t.y;
  th.dur = Math.max(BALLISTIC.minFlight / g.waveSpeed, dur);
  th.apex = Math.min(BALLISTIC.apexMax, BALLISTIC.apexFrac * dist(th.sx, th.sy, th.ix, th.iy));
  // Keep the top of the arc on screen: a missile you can't see can't be tapped.
  let lo = 0;
  let hi = th.apex;
  for (let k = 0; k < 20 && arcTop(th, hi) < BALLISTIC.ceiling; k++) {
    const mid = (lo + hi) / 2;
    if (arcTop(th, mid) < BALLISTIC.ceiling) hi = mid;
    else lo = mid;
    if (hi - lo < 1) hi = lo;
  }
  th.apex = hi;
}

/** Highest (smallest y) point of a ballistic arc with the given apex. */
function arcTop(th: Threat, apex: number): number {
  let top = Math.min(th.sy, th.iy);
  for (let i = 1; i < 32; i++) {
    const p = i / 32;
    top = Math.min(top, th.sy + (th.iy - th.sy) * p - 4 * apex * p * (1 - p));
  }
  return top;
}

function targetPos(g: Game, th: Threat): Point {
  if (th.target === FRIGATE_TARGET) return g.frigate ?? g.map.carrier;
  if (th.target !== CARRIER_TARGET) {
    const s = g.ships.find((o) => o.id === th.target);
    if (s) return s;
  }
  return g.map.carrier;
}

/** Drones and guided missiles find a new ship when theirs is gone. */
function ensureTarget(g: Game, th: Threat): void {
  if (th.target === FRIGATE_TARGET && !g.frigate) th.target = CARRIER_TARGET;
  if (th.target === CARRIER_TARGET || th.target === FRIGATE_TARGET) return;
  if (g.ships.some((s) => s.id === th.target)) return;
  let best: Ship | null = null;
  let bd = Infinity;
  for (const s of targetable(g, VIEW.width + 40)) {
    const d = dist(th.x, th.y, s.x, s.y);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  th.target = best ? best.id : CARRIER_TARGET;
}

function updateThreat(g: Game, th: Threat, dt: number): void {
  th.age += dt;
  const px = th.x;
  const py = th.y;
  if (th.kind === 'strafer' || th.kind === 'bomber') {
    updatePlane(g, th, dt);
  } else if (th.kind === 'ballistic') {
    const p = Math.min(1, th.age / th.dur);
    th.x = th.sx + (th.ix - th.sx) * p;
    th.y = th.sy + (th.iy - th.sy) * p - 4 * th.apex * p * (1 - p);
    if (p >= 1) impactBallistic(g, th);
  } else if (th.kind === 'supersonic' && th.age < SUPERSONIC.arming) {
    // On the rail with its lock line showing: aim, don't move yet.
    ensureTarget(g, th);
    const tp = leadPoint(g, th);
    th.heading = Math.atan2(tp.y - th.y, tp.x - th.x);
  } else if (th.decoy) {
    // Decoyed: it swerves after the flare and bursts on it.
    const want = Math.atan2(th.decoy.y - th.y, th.decoy.x - th.x);
    th.heading += clamp(angleDiff(want, th.heading), -6 * dt, 6 * dt);
    th.x += Math.cos(th.heading) * th.speed * dt;
    th.y += Math.sin(th.heading) * th.speed * dt;
    if (dist(th.x, th.y, th.decoy.x, th.decoy.y) < 18 || th.age > 30) {
      th.dead = true;
      addFx(g, 'boom', th.x, th.y, { life: 0.6, r: 30 });
    }
  } else {
    ensureTarget(g, th);
    const tp = th.kind === 'supersonic' ? leadPoint(g, th) : targetPos(g, th);
    const d = dist(th.x, th.y, tp.x, tp.y);
    const want = Math.atan2(tp.y - th.y, tp.x - th.x);
    if (th.kind === 'drone' || th.kind === 'minidrone') {
      // Shahed-style: slow and steady with a lazy weave, re-aiming as it goes.
      const weave = DRONE.weaveAmp * Math.sin(th.age * DRONE.weaveFreq + th.phase);
      th.heading = want + (d > 80 ? weave : 0);
    } else if (th.kind === 'mothership') {
      th.heading = want;
    } else {
      const base = STEER[th.kind] ?? GUIDED.turnRate;
      const close = Math.max(0, 1 - d / GUIDED.terminalRange);
      const turn = (base + (th.kind === 'guided' ? GUIDED.terminalTurn * close : 0)) * dt;
      // Smoke Screen: a homing missile can't see a ship in smoke and flies on blind.
      const homing = th.kind === 'guided' || th.kind === 'supersonic' || th.kind === 'cluster';
      const blind = homing && th.target !== CARRIER_TARGET && smoked(g, th.target);
      if (!blind) th.heading += clamp(angleDiff(want, th.heading), -turn, turn);
    }
    const boost =
      th.kind === 'guided' && th.age < GUIDED.boost
        ? GUIDED.boostFrom + (1 - GUIDED.boostFrom) * (th.age / GUIDED.boost)
        : 1;
    th.x += Math.cos(th.heading) * th.speed * boost * dt;
    th.y += Math.sin(th.heading) * th.speed * boost * dt;
    if (th.kind === 'mothership') spawnChildren(g, th, dt);
    if (decoyed(g, th)) return;
    if (th.kind === 'cluster' && th.target !== CARRIER_TARGET && d < CLUSTER.splitRange) {
      splitCluster(g, th);
    } else {
      checkImpact(g, th);
    }
  }
  th.vx = (th.x - px) / dt;
  th.vy = (th.y - py) / dt;
}

/** Aircraft fly straight across. A strafing jet's guns walk a line of hits
 *  ahead of it, catching every hull within PLANE.band of its line once; a
 *  bomber drops guided missiles as it passes over the convoy. Off the far
 *  edge, either is gone (no kill, no pickup). */
function updatePlane(g: Game, th: Threat, dt: number): void {
  const side = th.side ?? 1;
  th.x += side * th.speed * dt;
  // How far onto the screen it has flown from its entry edge.
  const inside = side > 0 ? th.x : VIEW.width - th.x;
  if (th.kind === 'strafer') {
    const gx = th.x + side * PLANE.gunLead;
    const band = inside < PLANE.strafeRunIn ? [] : g.ships.filter((s) => Math.abs(s.y - th.y) <= PLANE.band);
    th.firing = band.some((s) => {
      const ahead = (s.x - gx) * side;
      return ahead > -60 && ahead < 220;
    });
    for (const s of band) {
      if (th.hits!.includes(s.id) || Math.abs(s.x - gx) > 22) continue;
      if (g.stats.smokeVsGuns && smoked(g, s.id)) continue;
      th.hits!.push(s.id);
      addFx(g, 'boom', s.x, s.y, { life: 0.4, r: 16 });
      damageShip(g, s, THREATS.strafer.damage, 'strafer');
    }
    // Water spouts walk along the gun line while it fires (no RNG: jitter from
    // the step count, so the sim stays reproducible).
    if (th.firing && g.steps % 2 === 0) {
      const j = ((g.steps * 7919) % 97) / 97 - 0.5;
      addFx(g, 'spout', gx + j * 30, th.y + j * 2 * PLANE.band * 0.6, { life: 0.5, r: 8 });
    }
  } else {
    th.dropT = (th.dropT ?? 99) + dt;
    const ahead = inside < PLANE.bomberRunIn ? undefined : g.ships
      .filter((s) => {
        const d = (s.x - th.x) * side;
        return d > 0 && d < PLANE.dropReach;
      })
      .sort((a, b) => dist(a.x, a.y, th.x, th.y) - dist(b.x, b.y, th.x, th.y))[0];
    if (ahead && (th.bombs ?? 0) > 0 && th.dropT >= PLANE.dropEvery) {
      th.bombs! -= 1;
      th.dropT = 0;
      const m = spawnThreat(g, 'guided', th.x, th.y, 'air');
      m.target = ahead.id;
      m.parent = 'bomber';
      m.hp = 1;
      g.origins.air -= 1;
      g.origins.child += 1;
    }
  }
  if (th.x < -120 || th.x > VIEW.width + 120) th.dead = true;
}

/** Turn rates (rad/s) for the steering threats. */
const STEER: Partial<Record<ThreatKind, number>> = {
  guided: GUIDED.turnRate,
  supersonic: SUPERSONIC.turnRate,
  heavy: HEAVY.turnRate,
  cluster: CLUSTER.turnRate,
  bomblet: CLUSTER.bombletTurn,
};

/** Where a ship will be when a fast threat reaches it. */
function leadPoint(g: Game, th: Threat): Point {
  const t = targetPos(g, th);
  const v = targetSpeed(g, th);
  if (!v) return t;
  const eta = dist(th.x, th.y, t.x, t.y) / th.speed;
  return { x: t.x + v * eta, y: t.y };
}

function checkImpact(g: Game, th: Threat): void {
  const dmg = THREATS[th.kind].damage;
  const blame = th.parent ?? th.kind;
  const heavy = th.kind === 'heavy';
  if (th.target === FRIGATE_TARGET && g.frigate) {
    const f = g.frigate;
    if (dist(th.x, th.y, f.x, f.y) > FRIGATE.hitRadius) return;
    th.dead = true;
    addFx(g, 'boom', th.x, th.y, { life: 0.8, r: 50 });
    damageFrigate(g, Math.ceil(FRIGATE.hp / 2));
    return;
  }
  if (th.target === CARRIER_TARGET || th.target === FRIGATE_TARGET) {
    if (!onCarrier(g, th.x, th.y)) return;
    th.dead = true;
    // A heavy takes half the carrier's health (round 7).
    damageCarrier(g, heavy ? Math.ceil(g.stats.carrierHp / 2) : dmg, blame);
    addFx(g, 'boom', th.x, th.y, { life: 0.7, r: th.kind === 'heavy' || th.kind === 'mothership' ? 50 : 30 });
    return;
  }
  const s = g.ships.find((o) => o.id === th.target);
  if (!s || dist(th.x, th.y, s.x, s.y) >= SHIP.hitRadius) return;
  th.dead = true;
  if (th.kind === 'heavy') {
    // A heavy warhead also damages everything close by.
    const reach = HEAVY.splash * FORMATIONS[g.formation].splash;
    addFx(g, 'splash', th.x, th.y, { life: 0.9, r: Math.max(reach, 24) });
    for (const o of [...g.ships]) {
      if (o !== s && dist(o.x, o.y, th.x, th.y) <= reach) damageShip(g, o, HEAVY.splashDamage, blame, false);
    }
  } else {
    addFx(g, 'boom', th.x, th.y, { life: 0.7, r: 28 });
  }
  // A heavy's direct hit sinks the ship whatever its armour or formation.
  damageShip(g, s, heavy ? HEAVY_SINKS : dmg, blame);
}

/** More than any hull can take, through any armour or formation cut. */
const HEAVY_SINKS = 99;

/** The frigate is hit; sunk, it is gone until the next wave. */
function damageFrigate(g: Game, amount: number): void {
  const f = g.frigate;
  if (!f) return;
  if (g.shieldT > 0) {
    addFx(g, 'block', f.x, f.y, { life: 0.4, r: 50 });
    return;
  }
  f.hp -= amount;
  if (f.hp > 0) return;
  addFx(g, 'sink', f.x, f.y, { life: 2.2, r: 50 });
  addFx(g, 'text', f.x, f.y - 40, { life: 1.4, text: 'FRIGATE SUNK' });
  g.frigate = null;
}

function child(g: Game, parent: Threat, kind: ThreatKind, target: number, heading: number): Threat {
  return {
    ...parent,
    id: g.nextId++,
    kind,
    parent: parent.kind,
    hp: THREATS[kind].hp,
    speed: THREATS[kind].speed * (1 + (g.waveSpeed - 1) * WAVE_SPEED_SHARE[kind]) * g.stats.threatSlow,
    heading,
    target,
    age: 0,
    dead: false,
    spawnT: 0,
  };
}

/** A cluster that reaches its split range becomes bomblets aimed at the ships
 *  around its target. Hit it before then and none of this happens. */
function splitCluster(g: Game, th: Threat): void {
  th.dead = true;
  const near = targetable(g, VIEW.width + 40)
    .filter((s) => dist(s.x, s.y, th.x, th.y) <= CLUSTER.spread)
    .sort((a, b) => dist(a.x, a.y, th.x, th.y) - dist(b.x, b.y, th.x, th.y));
  const targets = near.length ? near : [];
  for (let k = 0; k < CLUSTER.bomblets; k++) {
    const t = targets.length ? targets[k % targets.length].id : th.target;
    const spreadAngle = th.heading + (k - (CLUSTER.bomblets - 1) / 2) * 0.35;
    g.threats.push(child(g, th, 'bomblet', t, spreadAngle));
  }
  addFx(g, 'burst', th.x, th.y, { life: 0.5, r: 40 });
}

function spawnChildren(g: Game, th: Threat, dt: number): void {
  th.spawnT -= dt;
  if (th.spawnT > 0) return;
  th.spawnT += MOTHERSHIP.spawnEvery;
  const pool = targetable(g);
  const t = pool.length ? g.rng.threats.pick(pool).id : CARRIER_TARGET;
  g.threats.push(child(g, th, 'minidrone', t, th.heading + Math.PI / 2));
  addFx(g, 'launch', th.x, th.y, { life: 0.4, r: 12 });
}

function impactBallistic(g: Game, th: Threat): void {
  th.dead = true;
  const dmg = THREATS.ballistic.damage;
  // The formation sets how far the blast reaches other hulls; Spread (0)
  // means only the nearest ship inside the blast is hit.
  const reach = BALLISTIC.splash * FORMATIONS[g.formation].splash;
  addFx(g, 'splash', th.ix, th.iy, { life: 0.9, r: Math.max(reach, BALLISTIC.splash) });
  const inBlast = g.ships
    .map((s) => ({ s, d: dist(s.x, s.y, th.ix, th.iy) }))
    .filter((o) => o.d <= Math.max(reach, BALLISTIC.splash))
    .sort((a, b) => a.d - b.d);
  // The ship it lands on takes the full hit; neighbours caught in the blast
  // take BALLISTIC.spill (round 5: at full damage a 4-missile sub salvo sank a
  // packed Box of 26 ships three and four at a time).
  inBlast.forEach((o, k) => {
    if (k === 0 ? o.d <= BALLISTIC.splash : o.d <= reach) damageShip(g, o.s, k === 0 ? dmg : BALLISTIC.spill, 'ballistic', k === 0);
  });
  if (onCarrier(g, th.ix, th.iy, BALLISTIC.splash * 0.5)) damageCarrier(g, dmg, 'ballistic');
}

/** Where a threat will be `ahead` seconds from now. */
function predict(th: Threat, ahead: number): Point {
  if (th.kind === 'ballistic') {
    const p = Math.min(1, (th.age + ahead) / th.dur);
    return {
      x: th.sx + (th.ix - th.sx) * p,
      y: th.sy + (th.iy - th.sy) * p - 4 * th.apex * p * (1 - p),
    };
  }
  return { x: th.x + th.vx * ahead, y: th.y + th.vy * ahead };
}

function damageThreat(g: Game, th: Threat, amount: number, drops = true): void {
  if (th.dead) return;
  th.hp -= amount;
  if (th.hp > 0) return;
  th.dead = true;
  g.kills[th.kind] += 1;
  addFx(g, 'boom', th.x, th.y, { life: 0.55, r: th.kind === 'drone' ? 18 : 26 });
  if (drops && g.rng.drops.chance(THREATS[th.kind].dropChance * g.stats.dropMult)) dropPickup(g, th.x, th.y);
  if (g.stats.rhythmEvery > 0 && ++g.rhythm % g.stats.rhythmEvery === 0) {
    g.ammo = Math.min(g.stats.rack, g.ammo + 1);
    if (g.frigate && g.stats.rhythmFrigate) g.frigate.ammo = Math.min(g.stats.frigateRack, g.frigate.ammo + 1);
  }
  if (g.stats.chainRadius > 0) {
    addFx(g, 'burst', th.x, th.y, { life: 0.4, r: g.stats.chainRadius });
    blast(g, th.x, th.y, g.stats.chainRadius, th.id);
  }
}

function blast(g: Game, x: number, y: number, radius: number, exceptId: number): void {
  for (const o of g.threats) {
    if (o.dead || o.id === exceptId) continue;
    if (dist(x, y, o.x, o.y) <= radius) damageThreat(g, o, 1);
  }
}

// ---------------------------------------------------------------------------
// Interceptors

function assigned(g: Game, threatId: number): number {
  let n = 0;
  for (const i of g.interceptors) if (i.target === threatId) n++;
  return n;
}

type Launcher = 'carrier' | 'frigate';

function launcherPos(g: Game, l: Launcher): Point {
  return l === 'frigate' && g.frigate ? { x: g.frigate.x + 8, y: g.frigate.y } : g.map.carrier;
}

/** Is the frigate on screen with a round (or Overdrive) to fire? */
function frigateReady(g: Game): boolean {
  const f = g.frigate;
  const onScreen = !!f && f.x >= FRIGATE.fireFromX && f.x <= VIEW.width - FRIGATE.fireFromX;
  // Level 1 fires from the carrier's rack; level 2 has its own as well.
  return onScreen && (g.overdriveT > 0 || f!.ammo >= 1 || g.ammo >= 1);
}

/** The nearest launcher that can fire right now, or null if every rack is dry. */
function readyLauncher(g: Game, x: number, y: number): Launcher | null {
  const ready: Launcher[] = [];
  if (g.overdriveT > 0 || g.ammo >= 1) ready.push('carrier');
  if (frigateReady(g)) ready.push('frigate');
  if (!ready.length) return null;
  const d = (l: Launcher) => dist(launcherPos(g, l).x, launcherPos(g, l).y, x, y);
  return ready.sort((a, b) => d(a) - d(b))[0];
}

/** Can a tap fire anything right now? (Bot + UI share this.) */
export function canFire(g: Game): boolean {
  return g.overdriveT > 0 || g.ammo >= 1 || frigateReady(g);
}

function fireAt(g: Game, th: Threat): boolean {
  const from = readyLauncher(g, th.x, th.y);
  if (!from) {
    g.events.push({ kind: 'dry' });
    return false;
  }
  if (g.overdriveT <= 0) {
    if (from === 'frigate' && g.frigate!.ammo >= 1) g.frigate!.ammo -= 1;
    else g.ammo -= 1;
  }
  g.shots += 1;
  spawnInterceptor(g, th, from);
  // Free extras (Twin Launch) only fly at the tapped threat, and only while it
  // still needs them: a 2-hit guided missile dies to one tap, but a drone
  // gets no bonus shot. (Round 6: extras used to spread to any neighbour
  // within 300 px, so mashing the screen cleared every swarm.)
  for (let k = 0; k < g.stats.freeExtras && assigned(g, th.id) < th.hp; k++) spawnInterceptor(g, th, from);
  return true;
}

function spawnInterceptor(g: Game, th: Threat, from: Launcher): void {
  const p = launcherPos(g, from);
  g.interceptors.push({
    id: g.nextId++,
    x: p.x,
    y: p.y - 6,
    target: th.id,
    tx: th.x,
    ty: th.y,
    life: 0,
  });
}

function reload(g: Game, dt: number): void {
  const f = g.frigate;
  if (g.overdriveT > 0) {
    g.overdriveT -= dt;
    g.ammo = g.stats.rack;
    g.reloadT = 0;
    if (f) [f.ammo, f.reloadT] = [g.stats.frigateRack, 0];
    return;
  }
  // Both racks reload in parallel at the same rate.
  const refill = (ammo: number, t: number, cap: number, every: number): [number, number] => {
    if (ammo >= cap) return [cap, 0];
    t += dt;
    while (t >= every && ammo < cap) {
      t -= every;
      ammo += 1;
    }
    return [ammo, ammo >= cap ? 0 : t];
  };
  [g.ammo, g.reloadT] = refill(g.ammo, g.reloadT, g.stats.rack, g.stats.reload);
  if (f) [f.ammo, f.reloadT] = refill(f.ammo, f.reloadT, g.stats.frigateRack, g.stats.reload * g.stats.frigateReloadMult);
}

/** The frigate sails in to its station, eases to a stop and holds there. */
function updateFrigate(g: Game, dt: number): void {
  const f = g.frigate;
  if (!f) return;
  const d = g.map.frigate.x - f.x;
  if (Math.abs(d) < 0.5) {
    f.x = g.map.frigate.x;
    f.vx = 0;
    return;
  }
  const speed = FRIGATE.sail * Math.min(1, Math.max(0.15, Math.abs(d) / FRIGATE.brake));
  const move = Math.sign(d) * Math.min(Math.abs(d), speed * dt);
  f.x += move;
  f.vx = move / dt;
}

/** Twin Launch L2+: an interceptor whose target died re-aims at a threat this
 *  close (round 6: 450 px let one tap hunt across the screen). */
const RETARGET_RANGE = 150;

function updateInterceptors(g: Game, dt: number): void {
  const speed = g.stats.interceptorSpeed;
  const live: Interceptor[] = [];
  for (const it of g.interceptors) {
    it.life += dt;
    let th = it.target === null ? undefined : g.threats.find((o) => o.id === it.target && !o.dead);
    if (!th && it.target !== null) {
      it.target = null;
      if (g.stats.retarget) {
        // Prefer the nearest threat nobody is covering yet; a covered one
        // counts as if it were further away.
        let bd = Infinity;
        for (const o of g.threats) {
          if (o.dead) continue;
          const d = dist(it.x, it.y, o.x, o.y) + (assigned(g, o.id) >= o.hp ? 250 : 0);
          if (d < bd && d < RETARGET_RANGE) {
            bd = d;
            th = o;
          }
        }
        if (th) it.target = th.id;
      }
    }
    if (th) {
      // Lead the target: aim where it will be when we get there.
      let aim: Point = th;
      for (let k = 0; k < 2; k++) aim = predict(th, dist(it.x, it.y, aim.x, aim.y) / speed);
      it.tx = aim.x;
      it.ty = aim.y;
    }
    const d = dist(it.x, it.y, it.tx, it.ty);
    const stepLen = speed * dt;
    // Proximity Fuse: it bursts as soon as it is close to the target itself.
    const fused = th !== undefined && dist(it.x, it.y, th.x, th.y) <= g.stats.contact;
    if (fused || d <= stepLen + g.stats.contact || it.life > INTERCEPTOR.maxLife) {
      const bx = th ? th.x : it.tx;
      const by = th ? th.y : it.ty;
      addFx(g, 'burst', bx, by, { life: 0.35, r: g.stats.blast });
      if (th) damageThreat(g, th, g.stats.hitDamage);
      blast(g, bx, by, g.stats.blast, th ? th.id : -1);
      continue;
    }
    it.x += ((it.tx - it.x) / d) * stepLen;
    it.y += ((it.ty - it.y) / d) * stepLen;
    if (g.stats.flak > 0) flak(g, it, th);
    live.push(it);
  }
  g.interceptors = live;
}

// ---------------------------------------------------------------------------
// Raiders: submarines and missile trucks

function spawnRaider(g: Game, sp: RaiderSpawn): void {
  if (!g.seenVectors.has(sp.kind)) {
    g.seenVectors.add(sp.kind);
    g.events.push({ kind: 'vector', vector: sp.kind });
  }
  const length = sp.kind === 'sub' ? 0 : pathLength(sp.path);
  const p0 = sp.path[0];
  const h0 = sp.path.length > 1 ? Math.atan2(sp.path[1].y - p0.y, sp.path[1].x - p0.x) : 0;
  // A runner stops to fire each unit, spread over the middle of its road.
  const n = sp.units.length;
  const stops = sp.kind === 'runner' ? sp.units.map((_, k) => length * (0.2 + (n > 1 ? (0.6 * k) / (n - 1) : 0.3))) : [];
  g.raiders.push({
    id: g.nextId++,
    kind: sp.kind,
    x: p0.x,
    y: p0.y,
    // Subs lie across the current: bow toward the convoy's direction.
    heading: sp.kind === 'sub' ? 0 : h0,
    state: sp.kind === 'sub' ? 'warn' : 'drive',
    t: 0,
    path: sp.path,
    dist: 0,
    length,
    stops,
    rounds: [],
    units: [...sp.units],
    fireT: 0,
  });
}

function setState(r: Raider, state: RaiderState): void {
  r.state = state;
  r.t = 0;
  r.fireT = 0;
}

/** Load the next unit's launches into the rounds to fire. */
function loadUnit(r: Raider): void {
  const u = r.units.shift();
  if (u) for (let k = 0; k < u.size; k++) r.rounds.push(u.kind);
}

function updateRaider(g: Game, r: Raider, dt: number): void {
  r.t += dt;
  const origin: LaunchOrigin = r.kind === 'sub' ? 'sub' : 'truck';
  const fire = (gap: number): boolean => {
    // Launch the loaded rounds one at a time; true once all are away.
    r.fireT -= dt;
    if (r.fireT <= 0 && r.rounds.length) {
      spawnThreat(g, r.rounds.shift()!, r.x, r.y, origin);
      r.fireT = gap;
    }
    return r.rounds.length === 0 && r.fireT <= 0;
  };
  if (r.kind === 'sub') {
    if (r.state === 'warn' && r.t >= SUB.warn) setState(r, 'surface');
    else if (r.state === 'surface' && r.t >= SUB.surface) {
      setState(r, 'fire');
      while (r.units.length) loadUnit(r);
    } else if (r.state === 'fire' && fire(SUB.gap)) setState(r, 'dive');
    else if (r.state === 'dive' && r.t >= SUB.dive) {
      r.state = 'reverse';
      r.dist = 0; // gone
    }
    return;
  }
  const speed = r.kind === 'runner' ? TRUCK.runnerSpeed : TRUCK.speed;
  if (r.state === 'drive') {
    const next = r.kind === 'runner' ? r.stops[0] : r.length;
    r.dist = Math.min(r.dist + speed * dt, next ?? r.length);
    if (next !== undefined && r.dist >= next) {
      if (r.kind === 'runner') r.stops.shift();
      setState(r, 'raise');
    } else if (r.kind === 'runner' && r.dist >= r.length) {
      r.state = 'reverse';
      r.dist = 0; // off the end of the road
      return;
    }
  } else if (r.state === 'raise' && r.t >= TRUCK.raise) {
    setState(r, 'fire');
    if (r.kind === 'runner') loadUnit(r);
    else while (r.units.length) loadUnit(r);
  } else if (r.state === 'fire' && fire(TRUCK.gap)) {
    setState(r, 'lower');
  } else if (r.state === 'lower' && r.t >= TRUCK.lower) {
    if (r.kind === 'popup') setState(r, 'reverse');
    else setState(r, 'drive');
  } else if (r.state === 'reverse') {
    r.dist = Math.max(0, r.dist - speed * dt);
  }
  const p = along(r.path, r.dist);
  r.x = p.x;
  r.y = p.y;
  r.heading = p.heading;
}

// ---------------------------------------------------------------------------
// Round 4 defensive cards and timed pickups

function updateTimers(g: Game, dt: number): void {
  g.warpT = Math.max(0, g.warpT - dt);
  g.shieldT = Math.max(0, g.shieldT - dt);
  g.steamT = Math.max(0, g.steamT - dt);
  g.smokeT = Math.max(0, g.smokeT - dt);
  g.flareT = Math.max(0, g.flareT - dt);
  for (const sm of g.smokes) {
    sm.t += dt;
    const s = g.ships.find((o) => o.id === sm.ship);
    if (s) [sm.x, sm.y] = [s.x, s.y];
  }
  g.smokes = g.smokes.filter((sm) => sm.t < SMOKE.time);
}

/** Is this ship inside a smoke cloud? */
function smoked(g: Game, shipId: number | null): boolean {
  if (!g.smokes.length || shipId === null) return false;
  const s = g.ships.find((o) => o.id === shipId);
  return !!s && g.smokes.some((sm) => dist(sm.x, sm.y, s.x, s.y) <= SMOKE.radius);
}

/** Decoy Flares: a guided missile (or, at level 2, a supersonic) closing on
 *  a ship chases a flare instead and is gone. One flare per recharge. */
function decoyed(g: Game, th: Threat): boolean {
  if (g.stats.flareEvery <= 0 || g.flareT > 0 || th.target === CARRIER_TARGET) return false;
  if (th.kind !== 'guided' && !(th.kind === 'supersonic' && g.stats.flaresVsSupersonic)) return false;
  const s = g.ships.find((o) => o.id === th.target);
  if (!s || dist(th.x, th.y, s.x, s.y) > FLARE.range) return false;
  // The flare goes up off to one side of the missile's approach, so the
  // missile is seen to swerve away from the ship after it.
  const a = Math.atan2(th.y - s.y, th.x - s.x) + (th.id % 2 ? 1 : -1) * 1.1;
  th.decoy = { x: s.x + Math.cos(a) * 110, y: s.y + Math.sin(a) * 110 };
  th.age = Math.min(th.age, 29);
  g.flareT = g.stats.flareEvery;
  addFx(g, 'flare', s.x, s.y, { life: 0.9, x2: th.decoy.x, y2: th.decoy.y });
  addFx(g, 'text', s.x, s.y - 30, { life: 0.9, text: 'FLARE' });
  return true;
}

/** Flak Burst: an interceptor clips every other threat it passes close to. */
function flak(g: Game, it: Interceptor, target: Threat | undefined): void {
  for (const o of g.threats) {
    if (o.dead || o === target || dist(it.x, it.y, o.x, o.y) > g.stats.flak) continue;
    it.flak ??= [];
    if (it.flak.includes(o.id)) continue;
    it.flak.push(o.id);
    addFx(g, 'flak', o.x, o.y, { life: 0.35, r: 12 });
    damageThreat(g, o, 1);
  }
}

/** Strike Package: two friendly jets come in low from the left. The first
 *  flies the most urgent threat's line; the second a launcher's line if a sub
 *  or truck is up, else the next most urgent threat clear of the first. */
function strike(g: Game): void {
  const live = g.threats.filter((t) => !t.dead).sort((a, b) => timeToImpact(g, a) - timeToImpact(g, b) || a.id - b.id);
  const band = PICKUPS.strikeBand * (g.stats.pickupPower > 1 ? 1.4 : 1);
  const lines: number[] = [];
  if (live.length) lines.push(live[0].y);
  const raider = g.raiders.find((r) => raiderUp(r));
  if (raider && lines.every((y) => Math.abs(y - raider.y) > band)) lines.push(raider.y);
  for (const th of live) {
    if (lines.length >= PICKUPS.strikeJets) break;
    if (lines.every((y) => Math.abs(y - th.y) > band * 1.5)) lines.push(th.y);
  }
  // Nothing to hit: sweep the convoy's lanes anyway, so the pickup is seen.
  while (lines.length < PICKUPS.strikeJets) lines.push(g.map.channels[lines.length % g.map.channels.length].y);
  lines.forEach((y, k) => {
    g.allies.push({ id: g.nextId++, x: -120 - k * 160, y: clamp(y, 40, VIEW.height - 40), side: 1, band, hits: [], firedT: -1 });
  });
}

/** Is this sub or truck up and able to fire (what a strike knocks out)? */
function raiderUp(r: Raider): boolean {
  return r.kind === 'sub' ? r.state !== 'warn' && r.state !== 'dive' && r.state !== 'reverse' : r.state !== 'reverse' && r.dist > 0;
}

function updateAllies(g: Game, dt: number): void {
  for (const a of g.allies) {
    a.x += a.side * PICKUPS.strikeSpeed * dt;
    for (const th of g.threats) {
      if (th.dead || a.hits.includes(th.id)) continue;
      if (Math.abs(th.y - a.y) > a.band || Math.abs(th.x - a.x) > 40) continue;
      a.hits.push(th.id);
      a.firedT = g.t;
      addFx(g, 'tracer', a.x + 30, a.y, { life: 0.18, x2: th.x, y2: th.y });
      damageThreat(g, th, PICKUPS.strikeDamage);
    }
    for (const r of g.raiders) {
      if (a.hits.includes(r.id) || !raiderUp(r)) continue;
      if (Math.abs(r.y - a.y) > a.band || Math.abs(r.x - a.x) > 50) continue;
      a.hits.push(r.id);
      a.firedT = g.t;
      knockOut(g, r);
    }
  }
  g.allies = g.allies.filter((a) => a.x < VIEW.width + 160);
}

/** A launcher hit by a strike: its remaining rounds are lost and it leaves. */
function knockOut(g: Game, r: Raider): void {
  r.units = [];
  r.rounds = [];
  addFx(g, 'boom', r.x, r.y, { life: 0.8, r: 34 });
  addFx(g, 'text', r.x, r.y - 30, { life: 1, text: 'KNOCKED OUT' });
  if (r.kind === 'sub') setState(r, 'dive');
  else if (r.kind === 'popup') setState(r, 'reverse');
  else {
    r.stops = [];
    setState(r, 'drive');
  }
}

// ---------------------------------------------------------------------------
// Pickups

function updatePickups(g: Game, dt: number): void {
  for (const p of g.pickups) p.age += dt;
  g.pickups = g.pickups.filter((p) => p.age < g.stats.pickupLife);
  if (g.stats.magnetDelay <= 0) return;
  // Pickup Magnet: after a beat, pickups fly to the carrier.
  const c = g.map.carrier;
  for (const p of [...g.pickups]) {
    if (p.age < g.stats.magnetDelay) continue;
    const d = dist(p.x, p.y, c.x, c.y);
    const stepLen = PICKUPS.magnetSpeed * dt;
    if (d <= stepLen + 30) {
      collect(g, p);
      continue;
    }
    p.x += ((c.x - p.x) / d) * stepLen;
    p.y += ((c.y - p.y) / d) * stepLen;
    p.age = Math.min(p.age, g.stats.pickupLife - 1.6);
  }
}

function dropPickup(g: Game, x: number, y: number): void {
  const w = PICKUPS.weights;
  let roll = g.rng.drops.next() * PICKUP_KINDS.reduce((a, k) => a + w[k], 0);
  let kind: PickupKind = 'ammo';
  for (const k of PICKUP_KINDS) {
    roll -= w[k];
    if (roll < 0) {
      kind = k;
      break;
    }
  }
  if (!g.seenPickups.has(kind)) {
    g.seenPickups.add(kind);
    g.events.push({ kind: 'newPickup', pickup: kind });
  }
  g.pickups.push({
    id: g.nextId++,
    kind,
    x: clamp(x, 40, VIEW.width - 40),
    y: clamp(y, 60, VIEW.height - 60),
    age: 0,
  });
}

const PICKUP_TEXT: Record<PickupKind, string> = {
  ammo: 'RACK FULL',
  repair: 'REPAIRED',
  overdrive: 'OVERDRIVE',
  emp: 'EMP!',
  timewarp: 'TIME WARP',
  shield: 'SHIELD',
  strike: 'STRIKE!',
  steam: 'FULL STEAM',
};

function collect(g: Game, p: Pickup): void {
  g.pickups = g.pickups.filter((o) => o !== p);
  const power = g.stats.pickupPower;
  if (g.stats.pickupReload > 0) {
    g.ammo = Math.min(g.stats.rack, g.ammo + g.stats.pickupReload);
  }
  g.events.push({ kind: 'pickup', pickup: p.kind });
  addFx(g, 'text', p.x, p.y - 20, { life: 1.1, text: PICKUP_TEXT[p.kind] });
  switch (p.kind) {
    case 'ammo':
      g.ammo = g.stats.rack;
      if (g.frigate) g.frigate.ammo = g.stats.frigateRack;
      break;
    case 'repair': {
      // Supercharged Pickups: Repair heals one more.
      const bonus = power > 1 ? 1 : 0;
      const max = g.stats.shipHp;
      const hurt = g.ships.filter((s) => s.hp < max).sort((a, b) => a.hp - b.hp)[0];
      if (hurt) hurt.hp = Math.min(max, hurt.hp + PICKUPS.repairHp + bonus);
      else g.carrierHp = Math.min(g.stats.carrierHp, g.carrierHp + PICKUPS.carrierRepairHp + bonus);
      break;
    }
    case 'overdrive':
      g.overdriveT = PICKUPS.overdriveTime * power;
      break;
    case 'timewarp':
      g.warpT = PICKUPS.warpTime * power;
      break;
    case 'shield':
      g.shieldT = PICKUPS.shieldTime * power;
      break;
    case 'steam':
      g.steamT = PICKUPS.steamTime * power;
      break;
    case 'strike':
      strike(g);
      break;
    case 'emp':
      for (const th of g.threats) if (th.kind === 'drone') damageThreat(g, th, 99, false);
      addFx(g, 'burst', p.x, p.y, { life: 0.8, r: 900 });
      break;
  }
}

// ---------------------------------------------------------------------------
// Helpers

function addFx(
  g: Game,
  kind: FxKind,
  x: number,
  y: number,
  o: { life: number; r?: number; x2?: number; y2?: number; text?: string },
): void {
  g.fx.push({ kind, x, y, x2: o.x2 ?? x, y2: o.y2 ?? y, r: o.r ?? 0, age: 0, life: o.life, text: o.text });
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** The raid about to start, while its warning is up (null otherwise), with
 *  how far through the warning we are (0 → 1). */
export function raidWarning(g: Game): { raid: Raid; p: number } | null {
  if (g.phase !== 'wave') return null;
  for (const raid of g.raids) {
    const ahead = raid.at - g.waveT;
    const warn = RAID.warn + g.stats.radarLead;
    if (ahead > 0 && ahead <= warn) return { raid, p: 1 - ahead / warn };
  }
  return null;
}

/** Is the ballistic's impact reticle visible yet? (Renderer + bot share this.) */
export function reticleVisible(g: Game, th: Threat): boolean {
  return g.stats.radarReticle || th.age / th.dur >= BALLISTIC.reticleFrom;
}

/** Seconds until a threat reaches what it is aimed at (bot + UI warnings). */
export function timeToImpact(g: Game, th: Threat): number {
  if (th.kind === 'ballistic') return Math.max(0, th.dur - th.age);
  if (th.kind === 'strafer' || th.kind === 'bomber') {
    // Until its guns (or bombs) reach the nearest hull ahead of it.
    const side = th.side ?? 1;
    const lead = th.kind === 'strafer' ? PLANE.gunLead : 0;
    let best = Infinity;
    for (const s of g.ships) {
      const ahead = (s.x - th.x) * side - lead;
      if (ahead >= 0 && (th.kind === 'bomber' || Math.abs(s.y - th.y) <= PLANE.band)) best = Math.min(best, ahead / th.speed);
    }
    return best === Infinity ? 30 : best;
  }
  const t = targetPos(g, th);
  const arming = th.kind === 'supersonic' ? Math.max(0, SUPERSONIC.arming - th.age) : 0;
  return arming + dist(th.x, th.y, t.x, t.y) / th.speed;
}
