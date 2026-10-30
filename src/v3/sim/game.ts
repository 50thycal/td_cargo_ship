// THE WHOLE V3 SIMULATION. Pure and deterministic: no DOM, no timers, no
// Math.random — every random choice comes from the seeded RNG, so a seed plus
// the same inputs replays the same game (tests and the bot sweep rely on it).
//
// The loop: ships flow left→right on fixed lanes; enemy bases launch the
// wave's drones and missiles at them; the player taps threats to fire
// interceptors from the carrier (the main gun, set before the run in the
// Armory), and taps pickups to collect them. Clear the wave → pick 1 of 3
// weapon cards → next wave. A weapon you hold drops as a pickup; tapping it
// loads the gun with that weapon for WEAPON.time seconds, and every tap fires
// it (playtest round 2: no buttons to charge and press). Lose at
// RULES.shipLossLimit ships sunk or when the carrier goes down.

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
  FLOW_STEPS,
  GUIDED,
  INTERCEPTOR,
  PICKUPS,
  PICKUP_KINDS,
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
  type PowerKind,
  type ThreatKind,
} from '../data/config';
import { FORMATIONS, type FormationId } from '../data/formations';
import { MAPS, channelCycle, halfWidthAt, type MapDef, type MapId, type Point } from '../data/maps';
import {
  AB,
  ABILITY_MAX,
  ABILITY_ORDER,
  WEAPON,
  abilityName,
  canSwapIn,
  canTake,
  type AbilityId,
  type CardId,
  type Levels,
} from '../data/abilities';
import { gunStats, type ArmoryLevels, type GunStats } from '../data/armory';
import { waveSpec } from '../data/waves';

export const CARRIER_TARGET = -1;

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
  /** Cryo Rounds: seconds left frozen in place, and the level that froze it
   *  (hits do double; 3: any hit shatters it). */
  frozenT?: number;
  frozenLv?: number;
  /** The sub or truck that fired it. */
  from?: number;
}

export interface Interceptor {
  id: number;
  x: number;
  y: number;
  target: number | null;
  tx: number;
  ty: number;
  life: number;
  /** 'gun' is the main gun; 'seeker' is a Seeker Pod missile, with its own
   *  speed, blast and damage. */
  src: 'gun' | 'seeker';
  /** Swarm Pod: a seeker whose target is gone finds another. */
  retarget?: boolean;
  blast?: number;
  dmg?: number;
  /** The weapon loaded when it was fired: its burst does what that weapon
   *  does (flak, a freeze, a vortex, Tesla arcs), even if the weapon ran out
   *  while it flew. */
  weapon?: Weapon;
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  /** A weapon pickup: which of your weapons it loads. */
  weapon?: AbilityId;
  x: number;
  y: number;
  age: number;
}

export type FxKind = 'boom' | 'splash' | 'tracer' | 'launch' | 'burst' | 'text' | 'sink' | 'spout' | 'spray' | 'flak' | 'block' | 'beam' | 'arc' | 'emp' | 'laser' | 'frost';

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
  /** A tough threat (3+ hits) went down: the UI gives it a punch. */
  | { kind: 'bigKill'; threat?: ThreatKind; label?: string; x: number; y: number }
  | { kind: 'pickup'; pickup: PickupKind }
  /** The first time a kind of pickup drops this game (UI explains it). */
  | { kind: 'newPickup'; pickup: PickupKind }
  /** A weapon pickup loaded the gun (level = the weapon's level). */
  | { kind: 'weapon'; id: AbilityId; level: number }
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

/** A friendly jet from an Air Strike shot, flying one row across the
 *  screen (dx, dy: its unit heading). */
export interface Ally {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  band: number;
  damage: number;
  /** Carpet Strike: it knocks out subs and trucks under it. */
  knock: boolean;
  /** Threats and launchers it has already hit (each once). */
  hits: number[];
  /** Game time of its last hit (the renderer flashes its guns). */
  firedT: number;
}

/** An area on the water: a flak cloud or a gravity well (circles: x1 = x2,
 *  y1 = y2, radius `hw`), or a Carpet Strike's burning row (a strip from
 *  x1,y1 to x2,y2, half-width `hw`). `tick` counts to the next hit of a
 *  burn or a flak cloud. */
export interface Field {
  kind: 'burn' | 'flak' | 'well';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  hw: number;
  t: number;
  life: number;
  tick: number;
  /** The level of the weapon that laid it. */
  level: number;
}

/** The weapon loaded in the main gun, at its level, for `t` more seconds. */
export interface Weapon {
  id: AbilityId;
  level: number;
  t: number;
}

/** A raid of the current wave: when it starts, its theme, and the bases it
 *  fires from (lit up during the warning). */
export interface Raid {
  at: number;
  theme: RaidTheme;
  bases: number[];
}

/** Developer playtest tempo (never on for players). `waveLen` shortens every
 *  wave and scales its launches with it, so the screen is as busy as ever for
 *  half as long; `stride` plays every Nth wave (always ending on the last),
 *  drafting one card per wave skipped, so the build keeps pace with the wave;
 *  `lossLimit` is the ships you can lose, cut to match, since a shorter run
 *  has less time for losses to pile up. */
export interface Tempo {
  waveLen: number;
  stride: number;
  lossLimit: number;
}

export const FULL_TEMPO: Tempo = { waveLen: 1, stride: 1, lossLimit: RULES.shipLossLimit };

export interface Game {
  map: MapDef;
  seed: number;
  tempo: Tempo;
  /** Cards still to pick before the next wave (more than one when the dev
   *  stride skips waves). */
  draftsLeft: number;
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
  overdriveT: number;
  /** Round 4 pickups: seconds left on Time Warp, Shield and Full Steam. */
  warpT: number;
  shieldT: number;
  steamT: number;
  allies: Ally[];
  /** Flak clouds, gravity wells and burning rows on the water. */
  fields: Field[];
  /** The weapon loaded in the main gun (null: plain interceptors). */
  weapon: Weapon | null;
  /** Seconds of wave since a weapon pickup last dropped (WEAPON.pity). */
  weaponDropT: number;
  flow: number;
  formation: FormationId;
  spawnT: number;
  spawnCount: number;
  channelCursor: number;
  /** The Armory levels this run was started with (fixed for the run). */
  armory: ArmoryLevels;
  /** Weapon levels held this run. */
  levels: Levels;
  /** The held weapons in the order they were drafted: a new one takes the
   *  next slot, a swap takes the replaced one's. */
  slots: AbilityId[];
  /** Weapon pickups taken this run, by weapon. */
  uses: Partial<Record<AbilityId, number>>;
  stats: GunStats;
  offer: CardId[];
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

/** `firstWave` > 1 skips ahead (playtesting a late wave via `?wave=N`).
 *  `armory` sets the main gun for the whole run. */
export function createGame(mapId: MapId, seed: number, firstWave = 1, tempo: Tempo = FULL_TEMPO, armory: ArmoryLevels = {}): Game {
  const root = makeRng(seed);
  const s = gunStats(armory);
  const g: Game = {
    map: MAPS[mapId],
    seed,
    tempo,
    draftsLeft: 0,
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
    overdriveT: 0,
    warpT: 0,
    shieldT: 0,
    steamT: 0,
    allies: [],
    fields: [],
    weapon: null,
    weaponDropT: 0,
    flow: DEFAULT_FLOW,
    formation: 'pairs',
    spawnT: 0,
    spawnCount: 0,
    channelCursor: 0,
    armory: { ...armory },
    levels: {},
    slots: [],
    uses: {},
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
  // Skipping ahead (playtesting a late wave) also hands over the weapons a
  // player would have drafted by then, so the wave plays as it really would.
  for (let w = 1; w < Math.floor(firstWave); w++) {
    g.wave = w;
    openDraft(g);
    const pick = g.offer.find((id): id is AbilityId => id !== 'resupply' && canTake(g.levels, id));
    if (pick) gainLevel(g, pick);
  }
  g.ammo = g.stats.rack;
  g.wave = Math.max(0, Math.floor(firstWave) - 1);
  startWave(g);
  return g;
}

function startWave(g: Game): void {
  g.wave += 1;
  g.waveT = 0;
  g.phase = 'wave';
  g.offer = [];
  const spec = waveSpec(g.wave, g.map.threatScale);
  const len = g.tempo.waveLen;
  if (len !== 1) {
    spec.duration *= len;
    spec.drones = cut(spec.drones, len);
    spec.ballistic = cut(spec.ballistic, len);
    spec.guided = cut(spec.guided, len);
  }
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
    const n = cut(Math.round(x.count + x.growth * (g.wave - x.from)), len);
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
  for (let k = 0; k < cut(vectorCount(g.wave, vp.strafers, 4, 2), len); k++) {
    replace('drone', 1);
    units.push({ kind: 'strafer', size: 1 });
  }
  for (let k = 0; k < cut(vectorCount(g.wave, vp.bombers, 4, 2), len); k++) {
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

/** A count shortened with the wave, keeping at least one of anything the
 *  full wave has, so every threat still shows up in a dev short wave. */
function cut(n: number, len: number): number {
  return len === 1 || n <= 0 ? n : Math.max(1, Math.round(n * len));
}

/** The next wave the dev stride plays after `wave`: every `stride`th,
 *  counted back from the last so the final wave is always played. Endless
 *  waves are never skipped. */
export function nextPlayedWave(wave: number, stride: number): number {
  let w = wave + 1;
  while (stride > 1 && w < RULES.wavesToClear && (RULES.wavesToClear - w) % stride !== 0) w++;
  return w;
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
  for (let k = 0; k < cut(vectorCount(g.wave, vp.subs, 2, 3), g.tempo.waveLen) && spots.length; k++) {
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
  for (let k = 0; k < cut(vectorCount(g.wave, vp.trucks, 2, 5), g.tempo.waveLen); k++) {
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
  let pd = radius + PICKUPS.radius;
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
  const loaded = g.weapon ? fireWeapon(g, g.weapon, x, y, threat, radius) : null;
  if (loaded) return loaded;
  if (!threat) return 'empty';
  return fireAt(g, threat) ? 'fire' : 'dry';
}

/** Take a draft card. `replace` swaps a new ability in for one you hold when
 *  all slots are full: the replaced ability and its levels are gone. */
export function pickUpgrade(g: Game, id: CardId, replace?: AbilityId): void {
  if (g.phase !== 'draft' || !g.offer.includes(id)) return;
  const swap = replace !== undefined && canSwapIn(g.levels, id) && (g.levels[replace] ?? 0) > 0;
  if (!swap && !canTake(g.levels, id)) return;
  if (swap) {
    delete g.levels[replace];
    if (id !== 'resupply') g.slots[g.slots.indexOf(replace!)] = id;
  }
  if (id === 'resupply') {
    for (const s of g.ships) s.hp = g.stats.shipHp;
    g.carrierHp = CARRIER.hp;
    g.ammo = g.stats.rack;
    afterPick(g);
    return;
  }
  gainLevel(g, id);
  afterPick(g);
}

/** One more level of a weapon (level 1: it joins the drop pool). */
function gainLevel(g: Game, id: AbilityId): void {
  g.levels[id] = (g.levels[id] ?? 0) + 1;
  if (!g.slots.includes(id)) g.slots.push(id);
}

/** Into the next wave, or (dev stride) on to the next skipped wave's draft. */
function afterPick(g: Game): void {
  if (g.draftsLeft > 1) {
    g.draftsLeft -= 1;
    g.wave += 1;
    openDraft(g);
    return;
  }
  g.draftsLeft = 0;
  startWave(g);
}

/** After clearing the map, keep going for score. */
export function continueEndless(g: Game): void {
  if (g.phase !== 'won') return;
  g.endless = true;
  g.draftsLeft = 1;
  openDraft(g);
}

/** Chance each draft draw comes from the loadout's own (unevolved)
 *  weapons. V3: three slots of three levels is nine picks, about one map's
 *  worth of drafts, so held weapons come up more often than V2's cards. */
const OWNED_DRAW = 0.5;

function openDraft(g: Game): void {
  // Three random weapons from everything not yet evolved. With a full
  // loadout, a new one can still be swapped in for one you hold; if nothing
  // can be taken without a swap, Resupply is added so keeping your build is
  // a choice. Each draw favours a weapon you already hold (OWNED_DRAW).
  const open = ABILITY_ORDER.filter((id) => (g.levels[id] ?? 0) < ABILITY_MAX);
  const rng = g.rng.draft;
  const mine = rng.shuffle(open.filter((id) => (g.levels[id] ?? 0) > 0));
  const other = rng.shuffle(open.filter((id) => !(g.levels[id] ?? 0)));
  g.offer = [];
  while (g.offer.length < 3 && (mine.length || other.length)) {
    const fromMine = mine.length && (!other.length || rng.chance(OWNED_DRAW));
    g.offer.push((fromMine ? mine : other).shift()!);
  }
  if (!g.offer.some((id) => canTake(g.levels, id))) g.offer.push('resupply');
  g.phase = 'draft';
}

// ---------------------------------------------------------------------------
// Weapons: what a tap fires while one is loaded

/** A tap while a weapon is loaded. Returns what the tap did, or null when
 *  this weapon fires a plain (tagged) interceptor at the threat instead —
 *  `fireAt` handles that, and the burst does the weapon's work. Every shot
 *  spends a round, as the plain gun does. */
function fireWeapon(g: Game, w: Weapon, x: number, y: number, threat: Threat | null, radius: number): TapResult | null {
  // Aimed at the threat under the finger, else at the spot itself.
  const ax = threat ? threat.x : x;
  const ay = threat ? threat.y : y;
  switch (w.id) {
    case 'tesla':
      return null;
    case 'flak':
    case 'cryo':
    case 'well':
      // A shell: at the threat as usual, or onto open water to burst there.
      if (threat) return null;
      if (!spend(g)) return 'dry';
      g.interceptors.push({ id: g.nextId++, x: g.map.carrier.x, y: g.map.carrier.y - 6, target: null, tx: x, ty: y, life: 0, src: 'gun', weapon: { ...w } });
      return 'fire';
    case 'laser':
      // Instant: the threat under the finger is hit now (open water: nothing).
      if (!threat) return null;
      if (!spend(g)) return 'dry';
      fireLaser(g, w.level, threat);
      return 'fire';
    case 'seeker':
      return fireSeekers(g, w.level, x, y, radius);
    case 'railgun':
      if (!spend(g)) return 'dry';
      fireBeam(g, w.level, ax, ay);
      return 'fire';
    case 'airstrike':
      if (!spend(g)) return 'dry';
      callJet(g, w.level, ax, ay);
      return 'fire';
  }
}

/** One round from the rack (free under Overdrive). False, with a dry
 *  click, when the rack is empty. */
function spend(g: Game): boolean {
  if (g.overdriveT <= 0 && g.ammo < 1) {
    g.events.push({ kind: 'dry' });
    return false;
  }
  if (g.overdriveT <= 0) g.ammo -= 1;
  g.shots += 1;
  return true;
}

/** A tagged shell bursts: a flak cloud, a freeze or a vortex where it went
 *  off. */
function burstWeapon(g: Game, w: Weapon, x: number, y: number): void {
  const k = w.level - 1;
  if (w.id === 'flak') addField(g, 'flak', x, y, AB.flak.radius[k], AB.flak.time[k], w.level);
  else if (w.id === 'well') addField(g, 'well', x, y, AB.well.radius[k], AB.well.time[k], w.level);
  else if (w.id === 'cryo') {
    const r = AB.cryo.radius[k];
    // Frozen first, then the frost bites: a hit for 1, doubled on ice
    // (Absolute Zero: shattered).
    for (const th of [...g.threats]) {
      if (th.dead || dist(th.x, th.y, x, y) > r) continue;
      th.frozenT = AB.cryo.time[k];
      th.frozenLv = w.level;
      damageThreat(g, th, 1);
    }
    addFx(g, 'frost', x, y, { life: 0.5, r });
  }
}

function addField(g: Game, kind: Field['kind'], x: number, y: number, r: number, life: number, level: number): void {
  g.fields.push({ kind, x1: x, y1: y, x2: x, y2: y, hw: r, t: 0, life, tick: 0, level });
}

/** Point-Defense Laser: the threat is hit at once (Overcharge: a kill gives
 *  the round back). */
function fireLaser(g: Game, level: number, th: Threat): void {
  const c = g.map.carrier;
  addFx(g, 'laser', c.x, c.y - 6, { life: 0.22, x2: th.x, y2: th.y });
  damageThreat(g, th, AB.laser.damage[level - 1]);
  if (th.dead && level >= 3 && g.overdriveT <= 0) g.ammo = Math.min(g.stats.rack, g.ammo + 1);
}

/** Seeker Pod: one round launches a seeker at each of the threats nearest
 *  the tap (the closest again if there are fewer), as long as one is within
 *  reach of it. */
function fireSeekers(g: Game, level: number, x: number, y: number, radius: number): TapResult {
  const k = level - 1;
  const near = g.threats
    .filter((t) => !t.dead && dist(t.x, t.y, x, y) <= Math.max(radius, AB.seeker.reach))
    .sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y));
  if (!near.length) return 'empty';
  if (!spend(g)) return 'dry';
  const c = g.map.carrier;
  const n = AB.seeker.missiles[k];
  for (let i = 0; i < n; i++) {
    const t = near[i % near.length];
    const spread = (i - (n - 1) / 2) * 14;
    g.interceptors.push({
      id: g.nextId++,
      x: c.x + spread,
      y: c.y - 6,
      target: t.id,
      tx: t.x,
      ty: t.y,
      life: -i * 0.03,
      src: 'seeker',
      blast: AB.seeker.blast,
      dmg: 1,
      retarget: level >= 3,
    });
  }
  return 'fire';
}

/** The live threat nearest (x, y), if any. */
function nearestThreat(g: Game, x: number, y: number): Threat | undefined {
  let best: Threat | undefined;
  let bd = Infinity;
  for (const t of g.threats) {
    if (t.dead) continue;
    const d = dist(t.x, t.y, x, y);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}

/** Air Strike: a jet in from the nearer edge, flying the whole row at y
 *  (Carpet Strike: the row burns behind it). */
function callJet(g: Game, level: number, x: number, y: number): void {
  const k = level - 1;
  const dir = x < VIEW.width / 2 ? 1 : -1;
  g.allies.push({
    id: g.nextId++,
    x: dir > 0 ? -80 : VIEW.width + 80,
    y,
    dx: dir,
    dy: 0,
    band: AB.airstrike.band[k],
    damage: AB.airstrike.damage[k],
    knock: level >= 3,
    hits: [],
    firedT: -1,
  });
  if (level >= 3) {
    g.fields.push({ kind: 'burn', x1: 0, y1: y, x2: VIEW.width, y2: y, hw: AB.airstrike.band[k] * 0.6, t: 0, life: AB.airstrike.burnTime, tick: 0, level });
  }
}

/** How far from (x, y) along (ux, uy) until the screen edge. */
function entryDistance(x: number, y: number, ux: number, uy: number): number {
  const tx = ux > 0 ? (VIEW.width - x) / ux : ux < 0 ? -x / ux : Infinity;
  const ty = uy > 0 ? (VIEW.height - y) / uy : uy < 0 ? -y / uy : Infinity;
  return Math.max(0, Math.min(tx, ty));
}

/** Railgun: an instant beam from the carrier through (x, y) to the edge of
 *  the screen, hitting everything along it. */
function fireBeam(g: Game, level: number, x: number, y: number): void {
  const c = g.map.carrier;
  const len0 = dist(c.x, c.y, x, y) || 1;
  const ux = (x - c.x) / len0;
  const uy = (y - c.y) / len0;
  const len = entryDistance(c.x, c.y, ux, uy);
  const k = level - 1;
  const width = AB.railgun.width[k];
  for (const th of [...g.threats]) {
    if (th.dead) continue;
    const along = (th.x - c.x) * ux + (th.y - c.y) * uy;
    if (along < 0 || along > len) continue;
    const off = Math.abs((th.x - c.x) * uy - (th.y - c.y) * ux);
    if (off <= width + 8) damageThreat(g, th, AB.railgun.damage[k]);
  }
  addFx(g, 'beam', c.x, c.y - 6, { life: 0.35, x2: c.x + ux * len, y2: c.y + uy * len, r: width });
}

/** Tesla Arc: a hit arcs to the nearest threats around it (and, evolved,
 *  each arc arcs again). */
function teslaArc(g: Game, level: number, x: number, y: number, fromId: number, depth: number, struck: Set<number>): void {
  if (depth <= 0) return;
  const k = level - 1;
  const next = g.threats
    .filter((t) => !t.dead && t.id !== fromId && !struck.has(t.id) && dist(t.x, t.y, x, y) <= AB.tesla.range)
    .sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y))
    .slice(0, AB.tesla.arcs[k]);
  for (const t of next) {
    struck.add(t.id);
    addFx(g, 'arc', x, y, { life: 0.3, x2: t.x, y2: t.y });
    const tx = t.x;
    const ty = t.y;
    damageThreat(g, t, 1);
    teslaArc(g, level, tx, ty, t.id, depth - 1, struck);
  }
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
    if (l.at - g.waveT > PLANE.warn) break;
    if ((l.kind === 'strafer' || l.kind === 'bomber') && l.y === undefined) l.y = planeLine(g, l.kind, g.rng.threats);
  }
  while (g.queue.length && g.queue[0].at <= g.waveT) launch(g, g.queue.shift()!);
  while (g.raiderQueue.length && g.raiderQueue[0].at <= g.waveT) spawnRaider(g, g.raiderQueue.shift()!);
  for (const r of g.raiders) updateRaider(g, r, dt);
  g.raiders = g.raiders.filter((r) => r.state !== 'reverse' || r.dist > 0);
  reload(g, dt);
  updateShips(g, dt);
  // Time Warp slows every threat (not the convoy, not your interceptors). A
  // frozen one (Cryo Rounds) hangs where it is until it thaws.
  const tdt = g.warpT > 0 ? dt * PICKUPS.warpScale : dt;
  for (const th of g.threats) {
    if (th.dead) continue;
    if (th.frozenT && th.frozenT > 0) {
      th.frozenT -= dt;
      th.vx = 0;
      th.vy = 0;
      continue;
    }
    updateThreat(g, th, tdt);
  }
  updateTimers(g, dt);
  updateAllies(g, dt);
  updateFields(g, dt);
  updateInterceptors(g, dt);
  g.weaponDropT += dt;

  g.threats = g.threats.filter((th) => !th.dead);
  updatePickups(g, dt);
  for (const f of g.fx) f.age += dt;
  g.fx = g.fx.filter((f) => f.age < f.life);

  if (g.lost >= g.tempo.lossLimit || g.carrierHp <= 0) {
    g.phase = 'lost';
    recordWave(g, 'lost');
    return;
  }
  if (g.queue.length === 0 && g.threats.length === 0 && g.raiders.length === 0 && g.raiderQueue.length === 0) {
    g.score += 200 * g.wave;
    clearField(g);
    recordWave(g, 'cleared');
    if (!g.endless && g.wave >= RULES.wavesToClear) {
      g.cleared = true;
      g.phase = 'won';
    } else {
      g.draftsLeft = g.endless ? 1 : nextPlayedWave(g.wave, g.tempo.stride) - g.wave;
      openDraft(g);
    }
  }
}

/** V2 round 13 ("the next wave starts fresh"): a cleared wave takes
 *  everything in flight with it. Interceptors and seekers still in the
 *  air, pickups left on the water, flak clouds, gravity wells and burning
 *  rows, strike jets, running power-ups and the loaded weapon are gone, and
 *  the rack is full for the next wave. Explosions already on screen play
 *  out. */
function clearField(g: Game): void {
  g.interceptors = [];
  g.pickups = [];
  g.fields = [];
  g.allies = [];
  g.overdriveT = 0;
  g.warpT = 0;
  g.shieldT = 0;
  g.steamT = 0;
  g.weapon = null;
  g.ammo = g.stats.rack;
  g.reloadT = 0;
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
    speed: def.speed * (1 + (g.waveSpeed - 1) * WAVE_SPEED_SHARE[kind]),
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
  if (th.target !== CARRIER_TARGET) {
    const s = g.ships.find((o) => o.id === th.target);
    if (s) return s;
  }
  return g.map.carrier;
}

/** Drones and guided missiles find a new ship when theirs is gone. */
function ensureTarget(g: Game, th: Threat): void {
  if (th.target === CARRIER_TARGET) return;
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
  // Gravity Well: dragged toward the vortex instead of flying its course
  // (a ballistic's arc is fixed, so it is not).
  if (g.fields.length && th.kind !== 'ballistic') {
    const well = g.fields.find((f) => f.kind === 'well' && fieldDist(f, th.x, th.y) <= f.hw);
    if (well) {
      const d = dist(th.x, th.y, well.x1, well.y1);
      const stepLen = Math.min(d, AB.well.pull * dt);
      if (d > 0) {
        th.x += ((well.x1 - th.x) / d) * stepLen;
        th.y += ((well.y1 - th.y) / d) * stepLen;
      }
      th.vx = (th.x - px) / dt;
      th.vy = (th.y - py) / dt;
      return;
    }
  }
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
      th.heading += clamp(angleDiff(want, th.heading), -turn, turn);
    }
    const boost =
      th.kind === 'guided' && th.age < GUIDED.boost
        ? GUIDED.boostFrom + (1 - GUIDED.boostFrom) * (th.age / GUIDED.boost)
        : 1;
    th.x += Math.cos(th.heading) * th.speed * boost * dt;
    th.y += Math.sin(th.heading) * th.speed * boost * dt;
    if (th.kind === 'mothership') spawnChildren(g, th, dt);
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
  if (th.target === CARRIER_TARGET) {
    if (!onCarrier(g, th.x, th.y)) return;
    th.dead = true;
    // A heavy takes half the carrier's health (round 7).
    damageCarrier(g, heavy ? Math.ceil(CARRIER.hp / 2) : dmg, blame);
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

function child(g: Game, parent: Threat, kind: ThreatKind, target: number, heading: number): Threat {
  return {
    ...parent,
    id: g.nextId++,
    kind,
    parent: parent.kind,
    hp: THREATS[kind].hp,
    speed: THREATS[kind].speed * (1 + (g.waveSpeed - 1) * WAVE_SPEED_SHARE[kind]),
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
  // A frozen threat (Cryo Rounds) takes double; Absolute Zero shatters it.
  if (th.frozenT && th.frozenT > 0) amount = (th.frozenLv ?? 0) >= 3 ? th.hp : amount * 2;
  th.hp -= amount;
  if (th.hp > 0) return;
  th.dead = true;
  g.kills[th.kind] += 1;
  addFx(g, 'boom', th.x, th.y, { life: 0.55, r: th.kind === 'drone' ? 18 : 26 });
  if (THREATS[th.kind].hp >= 3) g.events.push({ kind: 'bigKill', threat: th.kind, x: th.x, y: th.y });
  if (!drops) return;
  if (g.rng.drops.chance(THREATS[th.kind].dropChance)) dropPickup(g, th.x, th.y);
  // Weapons drop on their own roll, on top of the power-ups (playtest round
  // 2: sharing one roll, they crowded out the repairs and Overdrives).
  else if (weaponDue(g, th.kind)) dropWeapon(g, th.x, th.y);
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

/** Can a tap fire anything right now? (Bot + UI share this.) */
export function canFire(g: Game): boolean {
  return g.overdriveT > 0 || g.ammo >= 1;
}

/** A shot at a threat, tagged with the loaded weapon (its burst does that
 *  weapon's work). Storm Coil adds a free second shot at the uncovered threat
 *  nearest the first. */
function fireAt(g: Game, th: Threat): boolean {
  if (!spend(g)) return false;
  const p = g.map.carrier;
  const w = g.weapon;
  const shoot = (t: Threat) =>
    g.interceptors.push({ id: g.nextId++, x: p.x, y: p.y - 6, target: t.id, tx: t.x, ty: t.y, life: 0, src: 'gun', weapon: w ? { ...w } : undefined });
  shoot(th);
  if (w?.id === 'tesla' && w.level >= 3) {
    const twin = g.threats
      .filter((o) => !o.dead && o.id !== th.id && assigned(g, o.id) < o.hp && dist(o.x, o.y, th.x, th.y) <= AB.tesla.twin)
      .sort((a, b) => dist(a.x, a.y, th.x, th.y) - dist(b.x, b.y, th.x, th.y))[0];
    if (twin) shoot(twin);
  }
  return true;
}

function reload(g: Game, dt: number): void {
  if (g.overdriveT > 0) {
    g.overdriveT -= dt;
    g.ammo = g.stats.rack;
    g.reloadT = 0;
    return;
  }
  if (g.ammo >= g.stats.rack) {
    g.ammo = g.stats.rack;
    g.reloadT = 0;
    return;
  }
  g.reloadT += dt;
  while (g.reloadT >= g.stats.reload && g.ammo < g.stats.rack) {
    g.reloadT -= g.stats.reload;
    g.ammo += 1;
  }
  if (g.ammo >= g.stats.rack) g.reloadT = 0;
}

function updateInterceptors(g: Game, dt: number): void {
  const live: Interceptor[] = [];
  for (const it of g.interceptors) {
    it.life += dt;
    // A seeker waits its turn on the rail (negative life).
    if (it.life < 0) {
      live.push(it);
      continue;
    }
    const speed = it.src === 'seeker' ? AB.seeker.speed : g.stats.interceptorSpeed;
    let th = it.target === null ? undefined : g.threats.find((o) => o.id === it.target && !o.dead);
    if (!th && it.target !== null) {
      // Swarm Pod: a seeker whose target is gone finds the nearest other.
      th = it.retarget ? nearestThreat(g, it.x, it.y) : undefined;
      it.target = th ? th.id : null;
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
    // Proximity Fuse (Armory): it bursts as soon as it is close to the target.
    const fused = th !== undefined && dist(it.x, it.y, th.x, th.y) <= g.stats.contact;
    if (fused || d <= stepLen + g.stats.contact || it.life > INTERCEPTOR.maxLife) {
      const bx = th ? th.x : it.tx;
      const by = th ? th.y : it.ty;
      const radius = it.blast ?? g.stats.blast;
      addFx(g, 'burst', bx, by, { life: 0.35, r: radius });
      if (th) {
        damageThreat(g, th, it.dmg ?? g.stats.hitDamage);
        // A Tesla Arc hit arcs on to the threats around it.
        if (it.weapon?.id === 'tesla') teslaArc(g, it.weapon.level, bx, by, th.id, AB.tesla.depth[it.weapon.level - 1], new Set([th.id]));
      }
      blast(g, bx, by, radius, th ? th.id : -1);
      if (it.weapon) burstWeapon(g, it.weapon, bx, by);
      continue;
    }
    it.x += ((it.tx - it.x) / d) * stepLen;
    it.y += ((it.ty - it.y) / d) * stepLen;
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
      spawnThreat(g, r.rounds.shift()!, r.x, r.y, origin).from = r.id;
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
// Timed effects, strips on the water and friendly jets

function updateTimers(g: Game, dt: number): void {
  g.warpT = Math.max(0, g.warpT - dt);
  g.shieldT = Math.max(0, g.shieldT - dt);
  g.steamT = Math.max(0, g.steamT - dt);
  if (g.weapon) {
    g.weapon.t -= dt;
    if (g.weapon.t <= 0) g.weapon = null;
  }
}

/** Distance from (x, y) to the segment of a field. */
function fieldDist(f: Field, x: number, y: number): number {
  const vx = f.x2 - f.x1;
  const vy = f.y2 - f.y1;
  const l2 = vx * vx + vy * vy || 1;
  const t = clamp(((x - f.x1) * vx + (y - f.y1) * vy) / l2, 0, 1);
  return dist(x, y, f.x1 + vx * t, f.y1 + vy * t);
}

function updateFields(g: Game, dt: number): void {
  for (const f of g.fields) {
    f.t += dt;
    if (f.kind === 'well') {
      // The vortex closes: everything dragged into its core is hit.
      if (f.t >= f.life) {
        const k = f.level - 1;
        for (const th of [...g.threats]) if (!th.dead && dist(th.x, th.y, f.x1, f.y1) <= AB.well.core[k]) damageThreat(g, th, AB.well.damage[k]);
        addFx(g, 'emp', f.x1, f.y1, { life: 0.5, r: AB.well.core[k] * 1.4 });
      }
      continue;
    }
    // Carpet Strike's row burns and flak clouds hit: anything inside is hit
    // every tick.
    f.tick -= dt;
    if (f.tick > 0) continue;
    f.tick += f.kind === 'burn' ? AB.airstrike.burnTick : AB.flak.tick;
    for (const th of [...g.threats]) if (!th.dead && fieldDist(f, th.x, th.y) <= f.hw) damageThreat(g, th, 1);
  }
  g.fields = g.fields.filter((f) => f.t < f.life);
}

/** Is this sub or truck up and able to fire (what a strike knocks out)? */
function raiderUp(r: Raider): boolean {
  return r.kind === 'sub' ? r.state !== 'warn' && r.state !== 'dive' && r.state !== 'reverse' : r.state !== 'reverse' && r.dist > 0;
}

function updateAllies(g: Game, dt: number): void {
  for (const a of g.allies) {
    a.x += a.dx * AB.airstrike.speed * dt;
    a.y += a.dy * AB.airstrike.speed * dt;
    // What's under the jet: within `band` of its line, close along it.
    const under = (x: number, y: number, reach: number) => {
      const rx = x - a.x;
      const ry = y - a.y;
      return Math.abs(rx * a.dx + ry * a.dy) <= reach && Math.abs(rx * a.dy - ry * a.dx) <= a.band;
    };
    for (const th of g.threats) {
      if (th.dead || a.hits.includes(th.id) || !under(th.x, th.y, 40)) continue;
      a.hits.push(th.id);
      a.firedT = g.t;
      addFx(g, 'tracer', a.x + a.dx * 30, a.y + a.dy * 30, { life: 0.18, x2: th.x, y2: th.y });
      damageThreat(g, th, a.damage);
    }
    if (!a.knock) continue;
    for (const r of g.raiders) {
      if (a.hits.includes(r.id) || !raiderUp(r) || !under(r.x, r.y, 50)) continue;
      a.hits.push(r.id);
      a.firedT = g.t;
      knockOut(g, r);
    }
  }
  // Gone once well off the far side of the screen.
  g.allies = g.allies.filter((a) => {
    const ahead = (a.x - VIEW.width / 2) * a.dx + (a.y - VIEW.height / 2) * a.dy;
    return ahead < 1100;
  });
}

/** A launcher hit by a Carpet Strike blows up (V2 round 13:
 *  it used to just leave): its rounds are lost and it is gone, a sub with a
 *  spout of water, a truck in a ball of fire. */
function knockOut(g: Game, r: Raider): void {
  r.units = [];
  r.rounds = [];
  r.state = 'reverse';
  r.dist = 0;
  addFx(g, 'boom', r.x, r.y, { life: 1.1, r: 52 });
  addFx(g, r.kind === 'sub' ? 'sink' : 'burst', r.x, r.y, { life: r.kind === 'sub' ? 2 : 0.9, r: 40 });
  g.events.push({ kind: 'bigKill', label: r.kind === 'sub' ? 'SUB DESTROYED' : 'TRUCK DESTROYED', x: r.x, y: r.y });
}

// ---------------------------------------------------------------------------
// Pickups

/** How long a pickup floats before it is gone. */
export function pickupLife(p: Pickup): number {
  return p.kind === 'weapon' ? WEAPON.life : PICKUPS.life;
}

function updatePickups(g: Game, dt: number): void {
  for (const p of g.pickups) p.age += dt;
  g.pickups = g.pickups.filter((p) => p.age < pickupLife(p));
}

/** Does this kill drop a weapon? Only with one held and none already on the
 *  water: a roll scaled by the threat's drop chance, or any kill once
 *  WEAPON.pity seconds have gone by without one. */
function weaponDue(g: Game, kind: ThreatKind): boolean {
  if (!g.slots.length || g.pickups.some((p) => p.kind === 'weapon')) return false;
  return g.weaponDropT >= WEAPON.pity || g.rng.drops.chance(THREATS[kind].dropChance * WEAPON.share);
}

function dropWeapon(g: Game, x: number, y: number): void {
  g.weaponDropT = 0;
  addPickup(g, 'weapon', x, y, g.rng.drops.pick(g.slots));
}

/** A kill drops a power-up, picked by PICKUPS.weights. */
function dropPickup(g: Game, x: number, y: number): void {
  const w = PICKUPS.weights;
  let roll = g.rng.drops.next() * PICKUP_KINDS.reduce((a, k) => a + w[k], 0);
  let kind: PowerKind = 'ammo';
  for (const k of PICKUP_KINDS) {
    roll -= w[k];
    if (roll < 0) {
      kind = k;
      break;
    }
  }
  addPickup(g, kind, x, y);
}

function addPickup(g: Game, kind: PickupKind, x: number, y: number, weapon?: AbilityId): void {
  if (!g.seenPickups.has(kind)) {
    g.seenPickups.add(kind);
    g.events.push({ kind: 'newPickup', pickup: kind });
  }
  g.pickups.push({
    id: g.nextId++,
    kind,
    weapon,
    x: clamp(x, 40, VIEW.width - 40),
    y: clamp(y, 60, VIEW.height - 60),
    age: 0,
  });
}

const PICKUP_TEXT: Record<PowerKind, string> = {
  ammo: 'RACK FULL',
  repair: 'REPAIRED',
  overdrive: 'OVERDRIVE',
  timewarp: 'TIME WARP',
  shield: 'SHIELD',
  steam: 'FULL STEAM',
};

function collect(g: Game, p: Pickup): void {
  g.pickups = g.pickups.filter((o) => o !== p);
  g.events.push({ kind: 'pickup', pickup: p.kind });
  if (p.kind === 'weapon') {
    // Loads the gun for WEAPON.time (the same weapon again: a fresh clock;
    // another one: it takes over). One you swapped out loads nothing.
    const id = p.weapon!;
    const level = g.levels[id] ?? 0;
    if (level <= 0) return;
    g.weapon = { id, level, t: WEAPON.time };
    g.uses[id] = (g.uses[id] ?? 0) + 1;
    g.events.push({ kind: 'weapon', id, level });
    addFx(g, 'text', p.x, p.y - 20, { life: 1.1, text: abilityName(id, level).toUpperCase() });
    return;
  }
  addFx(g, 'text', p.x, p.y - 20, { life: 1.1, text: PICKUP_TEXT[p.kind] });
  switch (p.kind) {
    case 'ammo':
      g.ammo = g.stats.rack;
      break;
    case 'repair': {
      const max = g.stats.shipHp;
      const hurt = g.ships.filter((s) => s.hp < max).sort((a, b) => a.hp - b.hp)[0];
      if (hurt) hurt.hp = Math.min(max, hurt.hp + PICKUPS.repairHp);
      else g.carrierHp = Math.min(CARRIER.hp, g.carrierHp + PICKUPS.carrierRepairHp);
      break;
    }
    case 'overdrive':
      g.overdriveT = PICKUPS.overdriveTime;
      break;
    case 'timewarp':
      g.warpT = PICKUPS.warpTime;
      break;
    case 'shield':
      g.shieldT = PICKUPS.shieldTime;
      break;
    case 'steam':
      g.steamT = PICKUPS.steamTime;
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
    const warn = RAID.warn;
    if (ahead > 0 && ahead <= warn) return { raid, p: 1 - ahead / warn };
  }
  return null;
}

/** Is the ballistic's impact reticle visible yet? (Renderer + bot share this.) */
export function reticleVisible(g: Game, th: Threat): boolean {
  return th.age / th.dur >= BALLISTIC.reticleFrom;
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
