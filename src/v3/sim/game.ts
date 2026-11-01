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
  BOSS,
  FASTBOAT,
  LOCK,
  MINE,
  POST,
  VIP,
  isStructure,
} from '../data/config';
import { FORMATIONS, type FormationId } from '../data/formations';
import { LANE_FLOOR, MAPS, channelCycle, halfWidthAt, type Channel, type MapDef, type MapId, type Point } from '../data/maps';
import { laneAt, laneDAtX, laneHalfWidth, laneLength, lanePoint, laneYAtX } from './lanes';
import {
  AB,
  ABILITY_MAX,
  ABILITY_ORDER,
  MAX_SLOTS,
  WEAPON,
  abilityName,
  canSwapIn,
  canTake,
  type AbilityId,
  type CardId,
  type Levels,
} from '../data/abilities';
import { armoryStats, type ArmoryLevels, type ArmoryStats } from '../data/armory';
import { waveSpec } from '../data/waves';

export const CARRIER_TARGET = -1;

export interface Ship {
  id: number;
  /** Where it is drawn and hit: worked out each step from `d` and `lat`. */
  x: number;
  y: number;
  /** Distance along its lane, and its offset across it (lanes.ts). */
  d: number;
  lat: number;
  /** The way its bow points (radians). */
  heading: number;
  hp: number;
  slot: number;
  channel: number;
  /** The supertanker (The Behemoth Run): sunk, it counts as VIP_LOSS ships. */
  vip?: boolean;
  /** Flow multiplier locked in when the ship set sail. */
  mult: number;
  /** Aegis: its own interceptors while the weapon is loaded. */
  aegis?: Launchers;
}

/** Aegis (round 8): a hull's own interceptors, fired at a threat about to
 *  hit it; at MAX (Bastion) a spent one reloads. */
export interface Launchers {
  ammo: number;
  reloadT: number;
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
  /** The sub or truck that fired it. */
  from?: number;
  /** A structure: the base it stands on (rigs, generators, the Citadel). */
  base?: number;
  /** The Dreadnought: how far along its path it has steamed, and seconds to
   *  its next broadside. */
  along?: number;
  fireT?: number;
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

export type FxKind = 'boom' | 'splash' | 'tracer' | 'launch' | 'burst' | 'text' | 'sink' | 'spout' | 'spray' | 'flak' | 'block' | 'beam' | 'arc' | 'emp' | 'frag' | 'thermo';

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
  | { kind: 'dry' }
  /** The 20-map plan: a supertanker sets sail; an allied structure is hit or
   *  lost; the Dreadnought arrives; the Delta's switch is thrown. */
  | { kind: 'tanker' }
  | { kind: 'post'; post: number; down: boolean; lost: boolean }
  | { kind: 'boss' }
  | { kind: 'fork'; lane: number };

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
/** A frigate of a Frigate Escort: sails in to its station, fires on its own
 *  while the weapon is loaded, then sails off. */
export interface Escort {
  id: number;
  x: number;
  y: number;
  /** Its station on the water. */
  sx: number;
  sy: number;
  fireT: number;
  leaving: boolean;
  /** Where its last shot went (the renderer turns the gun). */
  aim: number;
}

/** A Boomerang blade: out from the gun to (tx, ty) and back, cutting each
 *  threat once a pass. */
export interface Blade {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  back: boolean;
  /** Caught back at the gun. */
  home: boolean;
  /** The threat it was thrown at: the blade follows it out (round 6: thrown
   *  at where a moving threat had been, it arrived after it had gone). */
  target: number | null;
  level: number;
  hits: number[];
  spin: number;
}

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
  /** Carpet Strike: how far it has flown, and where it drops its next
   *  napalm canister (none for a plain Air Strike). */
  flown: number;
  nextDrop: number | null;
}

/** Carpet Strike (round 8): a napalm canister tumbling down behind the jet;
 *  it bursts after AB.airstrike.fall s and sets its stretch of the row
 *  alight. */
export interface Bomb {
  id: number;
  x: number;
  y: number;
  vx: number;
  t: number;
  level: number;
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
  rng: { ships: RNG; threats: RNG; drops: RNG; draft: RNG; armor: RNG };
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
  /** Aegis Bastion: the carrier's own interceptors. */
  carrierAegis: Launchers | null;
  ammo: number;
  reloadT: number;
  overdriveT: number;
  /** Round 4 pickups: seconds left on Time Warp, Shield and Full Steam. */
  warpT: number;
  shieldT: number;
  steamT: number;
  allies: Ally[];
  /** Carpet Strike's napalm canisters, falling. */
  bombs: Bomb[];
  /** Frigate Escort's frigates, and Boomerang blades in the air. */
  escorts: Escort[];
  blades: Blade[];
  /** Flak clouds, gravity wells and burning rows on the water. */
  fields: Field[];
  /** The weapon loaded in the main gun (null: plain interceptors). */
  weapon: Weapon | null;
  /** Seconds of wave since a weapon pickup last dropped (the pity clock). */
  weaponDropT: number;
  /** Point Defense: seconds to the carrier's next shot. */
  pdT: number;
  /** Damage Control: seconds of wave towards the next hull point patched. */
  repairT: number;
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
  /** The run's numbers from the Armory: the gun, the hulls, the drops. */
  stats: ArmoryStats;
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
  // ---- The 20-map plan ----
  /** The Delta: which of the fork's lanes the next ships take. */
  forkLane: number;
  /** The wave the last supertanker sailed in. */
  tankerWave: number;
  /** Saltgate: each lock's phase (entry open / filling / exit open). */
  lockState: { phase: 'in' | 'fill' | 'out'; t: number }[];
  /** Allied structures, matching map.posts. */
  posts: PostState[];
  /** Bases whose rig or Citadel has been destroyed (they launch no more). */
  baseDown: boolean[];
  /** The wave the Dreadnought last sailed in. */
  bossWave: number;
  /** The Black Strait: seconds left of a Star Shell's light. */
  flareT: number;
}

/** An allied structure in play: its hit points, seconds it stays knocked
 *  out (a battery), whether it is gone for good (the radar), and its gun. */
export interface PostState {
  hp: number;
  downT: number;
  lost: boolean;
  fireT: number;
  /** Where its last shot went (the renderer turns the gun / the sweep). */
  aim: number;
}

// ---------------------------------------------------------------------------
// Setup

/** `firstWave` > 1 skips ahead (playtesting a late wave via `?wave=N`).
 *  `armory` (one upgrade from each bay) sets the run's gun, hulls and drops. */
export function createGame(mapId: MapId, seed: number, firstWave = 1, tempo: Tempo = FULL_TEMPO, armory: ArmoryLevels = {}): Game {
  const root = makeRng(seed);
  const s = armoryStats(armory);
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
      armor: root.fork('armor'),
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
    carrierHp: s.carrierHp,
    carrierAegis: null,
    ammo: s.rack,
    reloadT: 0,
    overdriveT: 0,
    warpT: 0,
    shieldT: 0,
    steamT: 0,
    allies: [],
    bombs: [],
    escorts: [],
    blades: [],
    fields: [],
    weapon: null,
    weaponDropT: 0,
    pdT: 0,
    repairT: 0,
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
    forkLane: 0,
    tankerWave: 0,
    lockState: [],
    posts: [],
    baseDown: [],
    bossWave: 0,
    flareT: 0,
  };
  const m = g.map;
  if (m.fork) g.forkLane = m.fork.start;
  g.lockState = (m.locks ?? []).map((_, i) => ({ phase: i % 2 ? 'out' : 'in', t: 0 }));
  g.posts = (m.posts ?? []).map((p) => ({ hp: p.hp, downT: 0, lost: false, fireT: 1, aim: -Math.PI / 2 }));
  g.baseDown = m.bases.map(() => false);
  raiseStructures(g);
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
      if (base >= 0 && !raid.bases.includes(base)) raid.bases.push(base);
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
  g.queue = queue.filter((l) => l.base !== -2);
  g.events.push({ kind: 'wave', wave: g.wave });
  if (g.map.boss?.waves.includes(g.wave) && g.bossWave < g.wave) launchBoss(g);
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
function alongPath(path: Point[], d: number): { x: number; y: number; heading: number } {
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

/** A base to launch `kind` from. One whose rig or Citadel is down launches
 *  nothing: if every base that could fire this kind is down, the launch is
 *  dropped (-2): knocking out a rig really thins the waves. A kind no base
 *  on the map carries (an extra) comes from any live launcher, as before. */
function pickBase(g: Game, kind: ThreatKind, rng: RNG): number {
  const able = g.map.bases.map((b, i) => (b.kinds.includes(kind) ? i : -1)).filter((i) => i >= 0);
  const live = able.filter((i) => !g.baseDown[i]);
  if (live.length) return rng.pick(live);
  const any = g.map.bases.map((b, i) => (launcher(b) && !g.baseDown[i] ? i : -1)).filter((i) => i >= 0);
  // Every base for this kind is down: half its launches move to a launcher
  // still standing (further off, so with more warning), half are lost.
  if (able.length) return any.length && rng.chance(STRUCTURE_REROUTE) ? rng.pick(any) : -2;
  // The original five maps: every base launches, so this is rng.int(bases).
  return any.length === g.map.bases.length ? rng.int(g.map.bases.length) : any.length ? rng.pick(any) : -2;
}

/** Share of a downed rig's launches that come from another base instead. */
const STRUCTURE_REROUTE = 0.5;

/** A base that fires missiles (not a generator, cove or mine chute). */
function launcher(b: { kinds: ThreatKind[]; cove?: boolean; chute?: boolean; generator?: unknown }): boolean {
  return b.kinds.length > 0 && !b.cove && !b.chute && !b.generator;
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
  const order = [...g.ships].filter((s) => !s.vip).sort((a, b) => b.d - a.d);
  // Across a straight lane a row's top-to-bottom order is its y; across a
  // path lane it is the offset (a row on the Kesh Hook's turn runs east-west).
  const across = (s: Ship) => (g.map.channels[s.channel].path ? s.lat : s.y);
  let next = 0;
  for (let i = 0; i < order.length; ) {
    let j = i + 1;
    while (j < order.length && order[i].d - order[j].d < SHIP.minGap / 2) j++;
    const row = order.slice(i, j).sort((a, b) => across(a) - across(b));
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
  // The Delta: a tap on the fork's buoy (with no threat nearer) throws it.
  const fork = g.map.fork;
  if (fork && dist(x, y, fork.x, fork.y) <= radius + FORK_RADIUS && (!threat || dist(x, y, fork.x, fork.y) < td)) {
    throwSwitch(g);
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
    g.carrierHp = g.stats.carrierHp;
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

/** Free Play (round 7): a test run, set up on the menu. It starts holding
 *  the weapons chosen, at their levels (in place of whatever the skip ahead
 *  drafted), and can drop weapons far more often. */
export interface FreePlaySetup {
  /** The held weapons, in slot order, with their levels (1–3). */
  weapons: { id: AbilityId; level: number }[];
  /** Weapons drop every few seconds instead of at the normal rate. */
  frequentDrops: boolean;
}

/** Free Play's frequent drops: a weapon at least every 8 s, at twice the chance. */
export const FREE_PLAY_DROPS = { pity: 8, share: 2 } as const;

export function applyFreePlay(g: Game, setup: FreePlaySetup): void {
  g.levels = {};
  g.slots = [];
  for (const w of setup.weapons.slice(0, MAX_SLOTS)) {
    if (g.slots.includes(w.id)) continue;
    g.levels[w.id] = Math.max(1, Math.min(ABILITY_MAX, Math.floor(w.level)));
    g.slots.push(w.id);
  }
  if (setup.frequentDrops) {
    g.stats = { ...g.stats, dropPity: Math.min(g.stats.dropPity, FREE_PLAY_DROPS.pity), dropShare: g.stats.dropShare * FREE_PLAY_DROPS.share };
  }
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
    case 'well':
    case 'shrapnel':
    case 'thermo':
      // A shell: at the threat as usual, or onto open water to burst there.
      if (threat) return null;
      if (!spend(g)) return 'dry';
      g.interceptors.push({ id: g.nextId++, x: g.map.carrier.x, y: g.map.carrier.y - 6, target: null, tx: x, ty: y, life: 0, src: 'gun', weapon: { ...w } });
      return 'fire';
    case 'aegis':
      // The ships fire their own interceptors (`updateAegis`); the gun is
      // the plain gun.
      return null;
    case 'seeker':
      return fireSeekers(g, w.level, x, y, radius);
    case 'railgun':
      if (!spend(g)) return 'dry';
      fireBeam(g, w.level, ax, ay);
      return 'fire';
    case 'airstrike':
      if (!spend(g, AB.airstrike.cost)) return 'dry';
      callJet(g, w.level, ax, ay);
      return 'fire';
    case 'scatter':
      if (!spend(g)) return 'dry';
      fireScatter(g, w.level, ax, ay);
      return 'fire';
    case 'boomerang':
      if (!spend(g)) return 'dry';
      throwBlades(g, w.level, ax, ay, threat);
      return 'fire';
    case 'frigate':
      // The frigates do their own shooting; the gun is the plain gun.
      return null;
  }
}

/** `n` rounds from the rack (free under Overdrive). False, with a dry
 *  click, when the rack holds fewer. */
function spend(g: Game, n = 1): boolean {
  if (g.overdriveT <= 0 && g.ammo < n) {
    g.events.push({ kind: 'dry' });
    return false;
  }
  if (g.overdriveT <= 0) g.ammo -= n;
  g.shots += 1;
  return true;
}

/** A tagged shell bursts: a flak cloud, a vortex, fragments or a
 *  thermobaric blast where it went off. */
function burstWeapon(g: Game, w: Weapon, x: number, y: number): void {
  const k = w.level - 1;
  if (w.id === 'flak') addField(g, 'flak', x, y, AB.flak.radius[k], AB.flak.time[k], w.level);
  else if (w.id === 'well') addField(g, 'well', x, y, AB.well.radius[k], AB.well.time[k], w.level);
  else if (w.id === 'shrapnel') {
    // Fragments out in every direction, at once (turned a little each shot
    // so the spokes don't line up shot after shot).
    const n = AB.shrapnel.frags[k];
    const turn = (g.shots % 7) * 0.37;
    for (let i = 0; i < n; i++) {
      const end = rayHits(g, x, y, turn + (i * Math.PI * 2) / n, AB.shrapnel.range[k], AB.shrapnel.width, w.level >= 3, AB.shrapnel.damage);
      addFx(g, 'frag', x, y, { life: 0.28, x2: end.x, y2: end.y });
    }
  } else if (w.id === 'thermo') {
    const r = AB.thermo.radius[k];
    for (const th of [...g.threats]) if (!th.dead && dist(th.x, th.y, x, y) <= r) damageThreat(g, th, AB.thermo.damage[k]);
    addFx(g, 'thermo', x, y, { life: 0.7, r });
  }
}

/** A straight path from (x, y) at `ang`, `range` long: hits the first
 *  threat within `width` of it for `dmg` (every one on it if `pierce`).
 *  Returns where the path ends (the first hit, or its full length). */
function rayHits(g: Game, x: number, y: number, ang: number, range: number, width: number, pierce: boolean, dmg: number): Point {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const on = g.threats
    .filter((t) => !t.dead)
    .map((t) => ({ t, along: (t.x - x) * ux + (t.y - y) * uy, off: Math.abs((t.x - x) * uy - (t.y - y) * ux) }))
    .filter((o) => o.along >= 0 && o.along <= range && o.off <= width)
    .sort((a, b) => a.along - b.along);
  if (!on.length) return { x: x + ux * range, y: y + uy * range };
  for (const o of pierce ? on : on.slice(0, 1)) damageThreat(g, o.t, dmg);
  const stop = pierce ? range : on[0].along;
  return { x: x + ux * stop, y: y + uy * stop };
}

/** Scattergun: a cone of pellets from the gun toward (x, y), short range. */
function fireScatter(g: Game, level: number, x: number, y: number): void {
  const k = level - 1;
  const c = g.map.carrier;
  const base = Math.atan2(y - c.y, x - c.x);
  const n = AB.scatter.pellets[k];
  for (let i = 0; i < n; i++) {
    const ang = base + (n > 1 ? (i / (n - 1) - 0.5) * AB.scatter.spread : 0);
    const end = rayHits(g, c.x, c.y - 6, ang, AB.scatter.range[k], AB.scatter.width, level >= 3, AB.scatter.damage);
    addFx(g, 'frag', c.x, c.y - 6, { life: 0.3, x2: end.x, y2: end.y, r: 1 });
  }
  addFx(g, 'burst', c.x + Math.cos(base) * 30, c.y - 6 + Math.sin(base) * 30, { life: 0.2, r: 22 });
}

/** Boomerang: a blade out to (x, y), or after the threat tapped, and back
 *  (Twin Blades: a second one splayed to one side). */
function throwBlades(g: Game, level: number, x: number, y: number, threat: Threat | null): void {
  const c = g.map.carrier;
  const d = dist(c.x, c.y, x, y) || 1;
  const reach = Math.min(d, AB.boomerang.range);
  const base = Math.atan2(y - c.y, x - c.x);
  // Twin Blades: one down the line you aimed at, the second splayed to one
  // side, alternating (round 6: two splayed either side both missed the line).
  const side = g.shots % 2 ? 1 : -1;
  for (const off of level >= 3 ? [0, 0.24 * side] : [0]) {
    g.blades.push({
      id: g.nextId++,
      x: c.x,
      y: c.y - 6,
      tx: c.x + Math.cos(base + off) * reach,
      ty: c.y - 6 + Math.sin(base + off) * reach,
      back: false,
      home: false,
      target: off === 0 && threat ? threat.id : null,
      level,
      hits: [],
      spin: 0,
    });
  }
}

function updateBlades(g: Game, dt: number): void {
  const c = g.map.carrier;
  for (const b of g.blades) {
    // Out after its threat while it lives, then on to where it was.
    const t = !b.back && b.target !== null ? g.threats.find((o) => o.id === b.target && !o.dead) : undefined;
    if (t) {
      b.tx = t.x;
      b.ty = t.y;
    }
    const gx = b.back ? c.x : b.tx;
    const gy = b.back ? c.y - 6 : b.ty;
    const d = dist(b.x, b.y, gx, gy);
    const step = AB.boomerang.speed * dt;
    b.spin += dt * 18;
    if (d <= step) {
      b.x = gx;
      b.y = gy;
      if (b.back) b.home = true;
      else {
        // Turn round: the way back is a fresh pass.
        b.back = true;
        b.hits = [];
      }
    } else {
      b.x += ((gx - b.x) / d) * step;
      b.y += ((gy - b.y) / d) * step;
    }
    const k = b.level - 1;
    for (const th of [...g.threats]) {
      if (th.dead || b.hits.includes(th.id) || dist(th.x, th.y, b.x, b.y) > AB.boomerang.width[k]) continue;
      b.hits.push(th.id);
      damageThreat(g, th, AB.boomerang.damage[k]);
    }
  }
  g.blades = g.blades.filter((b) => !b.home);
}

/** Frigate Escort: the frigates sail to their stations, fire on their own,
 *  and sail off when the weapon is spent or another takes over. */
function launchEscorts(g: Game, level: number): void {
  const k = level - 1;
  const want = AB.frigate.ships[k];
  const lanes = g.map.channels;
  // Stations across the screen. Ships 0 and 2 share an edge, so with three
  // the first one in takes the far station and the third the near one: they
  // sail in line astern instead of the third running through the first
  // (round 7 playtest).
  const xs = want >= 3 ? [0.62, 0.46, 0.3] : [0.3, 0.62];
  g.escorts = g.escorts.filter((e) => !e.leaving);
  for (let i = 0; i < want; i++) {
    // On station at the edge of a lane (above it, then below), clear of the
    // convoy sailing down its middle, still on open water.
    const lane = lanes[i % lanes.length];
    const station = g.map.escortStations?.[i % g.map.escortStations.length];
    const sx = station ? station.x : VIEW.width * xs[i];
    const sy = station ? station.y : laneYAtX(lane, sx) + (i % 2 ? 1 : -1) * halfWidthAt(lane, sx) * 0.85;
    const e = g.escorts[i];
    if (e) {
      e.sx = sx;
      e.sy = sy;
    } else {
      // A hull and its wake run ~210 long; two ships on one edge start 260
      // apart, so they never touch.
      g.escorts.push({ id: g.nextId++, x: -120 - i * 130, y: sy, sx, sy, fireT: 0.5 + i * 0.2, leaving: false, aim: 0 });
    }
  }
}

function updateEscorts(g: Game, dt: number): void {
  if (!g.escorts.length) return;
  const on = g.weapon?.id === 'frigate' ? g.weapon : null;
  for (const e of g.escorts) {
    if (!on) e.leaving = true;
    const gx = e.leaving ? VIEW.width + 140 : e.sx;
    const gy = e.leaving ? e.y : e.sy;
    const d = dist(e.x, e.y, gx, gy);
    const step = AB.frigate.speed * dt;
    if (d > step) {
      e.x += ((gx - e.x) / d) * step;
      e.y += ((gy - e.y) / d) * step;
    } else {
      e.x = gx;
      e.y = gy;
    }
    // Round 6 cycle 5: they used to hold fire until on station, so the far
    // frigate spent ~4.6 s of the 15 sailing in silent; now they open up as
    // soon as they are on screen.
    if (e.leaving || !on || e.x < 20) continue;
    e.fireT -= dt;
    if (e.fireT > 0) continue;
    // The nearest threat in reach that still needs a shot.
    const target = g.threats
      .filter((t) => !t.dead && dist(t.x, t.y, e.x, e.y) <= AB.frigate.range && assigned(g, t.id) < t.hp)
      .sort((a, b) => dist(a.x, a.y, e.x, e.y) - dist(b.x, b.y, e.x, e.y))[0];
    if (!target) {
      e.fireT = 0.1;
      continue;
    }
    e.fireT = AB.frigate.gap[on.level - 1];
    e.aim = Math.atan2(target.y - e.y, target.x - e.x);
    const mx = e.x + 30;
    g.interceptors.push({ id: g.nextId++, x: mx, y: e.y, target: target.id, tx: target.x, ty: target.y, life: 0, src: 'gun' });
    addFx(g, 'launch', mx, e.y, { life: 0.3, r: 10 });
  }
  g.escorts = g.escorts.filter((e) => !(e.leaving && e.x >= VIEW.width + 130));
}

/** Aegis Launchers (round 8 playtest: "all cargo ships get one interceptor
 *  missile that they can fire from their ship to hit a threat that is about
 *  to hit them… applied to all existing cargo ships and all that spawn while
 *  it is active"). While it is loaded every ship carries its own
 *  interceptors and fires one at a threat closing on it, in reach; at MAX
 *  (Bastion) a spent one reloads and the carrier has its own. When the
 *  weapon goes, so do they. */
function updateAegis(g: Game, dt: number): void {
  const w = g.weapon?.id === 'aegis' ? g.weapon : null;
  if (!w) {
    for (const s of g.ships) s.aegis = undefined;
    g.carrierAegis = null;
    return;
  }
  const k = w.level - 1;
  const reach = AB.aegis.reach[k];
  const arm = (l: Launchers | undefined | null, max: number, x: number, y: number, isTarget: (t: Threat) => boolean): Launchers => {
    const a = l ?? { ammo: max, reloadT: 0 };
    if (w.level >= 3 && a.ammo < max) {
      a.reloadT += dt;
      if (a.reloadT >= AB.aegis.reload) {
        a.ammo += 1;
        a.reloadT = 0;
      }
    }
    if (a.ammo < 1) return a;
    const target = g.threats
      .filter((t) => !t.dead && isTarget(t) && dist(t.x, t.y, x, y) <= reach && assigned(g, t.id) < t.hp)
      .sort((p, q) => dist(p.x, p.y, x, y) - dist(q.x, q.y, x, y))[0];
    if (!target) return a;
    a.ammo -= 1;
    g.interceptors.push({ id: g.nextId++, x, y: y - 8, target: target.id, tx: target.x, ty: target.y, life: 0, src: 'gun' });
    addFx(g, 'launch', x, y - 8, { life: 0.3, r: 8 });
    return a;
  };
  // What is about to hit a hull: a threat aimed at it, or an aircraft over it.
  const aircraft = (t: Threat) => t.kind === 'strafer' || t.kind === 'bomber';
  for (const s of g.ships) s.aegis = arm(s.aegis, AB.aegis.missiles[k], s.x, s.y, (t) => t.target === s.id || aircraft(t));
  if (w.level >= 3) {
    const c = g.map.carrier;
    g.carrierAegis = arm(g.carrierAegis, AB.aegis.carrier, c.x, c.y, (t) => t.target === CARRIER_TARGET || aircraft(t));
  }
}

/** Point Defense (Armory, Hull bay): the carrier fires a free interceptor
 *  at the nearest threat in reach that still needs a shot, every pdGap s. */
function updatePointDefense(g: Game, dt: number): void {
  if (!g.stats.pdGap) return;
  g.pdT -= dt;
  if (g.pdT > 0) return;
  const c = g.map.carrier;
  const target = g.threats
    .filter((t) => !t.dead && dist(t.x, t.y, c.x, c.y) <= g.stats.pdRange && assigned(g, t.id) < t.hp)
    .sort((a, b) => dist(a.x, a.y, c.x, c.y) - dist(b.x, b.y, c.x, c.y))[0];
  if (!target) {
    g.pdT = 0.1;
    return;
  }
  g.pdT = g.stats.pdGap;
  // From the carrier's bow end nearer the threat, so it reads as its own gun.
  const mx = c.x + Math.sign(target.x - c.x || 1) * CARRIER.halfLength * 0.6;
  g.interceptors.push({ id: g.nextId++, x: mx, y: c.y, target: target.id, tx: target.x, ty: target.y, life: 0, src: 'gun' });
  addFx(g, 'launch', mx, c.y, { life: 0.3, r: 8 });
}

/** Damage Control (Armory, Hull bay): every repairEvery s of wave, every
 *  damaged hull gets a point back, ships and carrier. The clock only runs
 *  while something is hurt (no time banked while all hulls are whole). */
function updateDamageControl(g: Game, dt: number): void {
  if (!g.stats.repairEvery) return;
  const max = g.stats.shipHp;
  const hurt = g.ships.filter((s) => s.hp > 0 && s.hp < max);
  const carrier = g.carrierHp > 0 && g.carrierHp < g.stats.carrierHp;
  if (!hurt.length && !carrier) {
    g.repairT = 0;
    return;
  }
  g.repairT += dt;
  if (g.repairT < g.stats.repairEvery) return;
  g.repairT = 0;
  for (const s of hurt) {
    s.hp += 1;
    addFx(g, 'text', s.x, s.y - 24, { life: 1, text: '+1' });
  }
  if (carrier) {
    g.carrierHp += 1;
    const c = g.map.carrier;
    addFx(g, 'text', c.x, c.y - CARRIER.halfBeam - 24, { life: 1, text: '+1 HULL' });
  }
}

function addField(g: Game, kind: Field['kind'], x: number, y: number, r: number, life: number, level: number): void {
  g.fields.push({ kind, x1: x, y1: y, x2: x, y2: y, hw: r, t: 0, life, tick: 0, level });
}

/** Seeker Pod: one round launches seekers at the threats nearest the tap,
 *  as long as one is within reach of it. A seeker hits for a third of a
 *  shot (round 8 playtest: "since one shot makes like 3 or more of the
 *  seekers… each should do about a third of the damage"), so they go in
 *  threes: each threat, nearest first, gets as many as it takes to bring it
 *  down, and any left over go to the nearest. */
function fireSeekers(g: Game, level: number, x: number, y: number, radius: number): TapResult {
  const k = level - 1;
  const near = g.threats
    .filter((t) => !t.dead && dist(t.x, t.y, x, y) <= Math.max(radius, AB.seeker.reach))
    .sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y));
  if (!near.length) return 'empty';
  if (!spend(g)) return 'dry';
  const c = g.map.carrier;
  const n = AB.seeker.missiles[k];
  const dmg = g.stats.hitDamage * AB.seeker.damage;
  const targets: Threat[] = [];
  for (const t of near) {
    let need = Math.ceil((t.hp - assigned(g, t.id)) / dmg - 1e-9);
    while (need-- > 0 && targets.length < n) targets.push(t);
    if (targets.length >= n) break;
  }
  while (targets.length < n) targets.push(near[0]);
  for (let i = 0; i < n; i++) {
    const t = targets[i];
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
      dmg,
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
    flown: 0,
    // Carpet Strike: canisters from the screen's edge on (it starts 80 off),
    // let go early by the distance they drift as they fall.
    nextDrop: level >= 3 ? 80 + AB.airstrike.dropGap / 2 - napalmDrift() : null,
  });
}

/** How far a canister drifts on along the row while it falls. */
function napalmDrift(): number {
  return AB.airstrike.speed * AB.airstrike.drift * AB.airstrike.fall;
}

/** Carpet Strike's canisters: each tumbles AB.airstrike.fall s behind the
 *  jet, then bursts and sets its stretch of the row burning for burnTime
 *  (round 8 playtest: "like a napalm bomb that spins and then explodes
 *  behind the jet, so it's like a bombing run"). The stretches meet edge to
 *  edge, so the whole row burns, a beat behind the jet. */
function updateBombs(g: Game, dt: number): void {
  const live: Bomb[] = [];
  for (const b of g.bombs) {
    b.t += dt;
    b.x += b.vx * dt;
    if (b.t < AB.airstrike.fall) {
      live.push(b);
      continue;
    }
    const k = b.level - 1;
    const half = AB.airstrike.dropGap / 2;
    g.fields.push({ kind: 'burn', x1: b.x - half, y1: b.y, x2: b.x + half, y2: b.y, hw: AB.airstrike.band[k] * 0.6, t: 0, life: AB.airstrike.burnTime, tick: 0, level: b.level });
    addFx(g, 'boom', b.x, b.y, { life: 0.6, r: 40 });
    addFx(g, 'burst', b.x, b.y, { life: 0.45, r: 30 });
  }
  g.bombs = live;
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
  // Time Warp slows every threat (not the convoy, not your interceptors).
  const tdt = g.warpT > 0 ? dt * PICKUPS.warpScale : dt;
  for (const th of g.threats) if (!th.dead) updateThreat(g, th, tdt);
  updateTimers(g, dt);
  updateAllies(g, dt);
  updateEscorts(g, dt);
  updateAegis(g, dt);
  updateBombs(g, dt);
  updatePointDefense(g, dt);
  updateDamageControl(g, dt);
  updateBlades(g, dt);
  updateFields(g, dt);
  updateInterceptors(g, dt);
  updatePosts(g, dt);
  updateLocks(g, dt);
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
  if (g.queue.length === 0 && g.threats.every(standing) && g.raiders.length === 0 && g.raiderQueue.length === 0) {
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
  g.bombs = [];
  g.escorts = [];
  g.blades = [];
  g.overdriveT = 0;
  g.warpT = 0;
  g.shieldT = 0;
  g.steamT = 0;
  g.weapon = null;
  g.carrierAegis = null;
  for (const s of g.ships) s.aegis = undefined;
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

/** How far ahead a hull looks for a single-file gap to merge for. */
const MERGE_AHEAD = 140;

/** The offset across its lane a hull steers for: its formation slot, scaled
 *  to the lane's width where it is. Where the lane ahead narrows below
 *  LANE_FLOOR (a single-file gap), every hull lines up on the centre line,
 *  one behind another; the supertanker always sails the middle. */
function slotLat(g: Game, s: Ship): number {
  if (s.vip) return 0;
  const ch = g.map.channels[s.channel];
  if (ch.widths && Math.min(laneHalfWidth(ch, s.d), laneHalfWidth(ch, s.d + MERGE_AHEAD)) < LANE_FLOOR) return 0;
  const offsets = FORMATIONS[g.formation].offsets;
  return offsets[s.slot % offsets.length] * halfWidthAt(ch, s.x);
}

/** Put a hull where its lane distance and offset say. */
function placeShip(g: Game, s: Ship): void {
  const p = laneAt(g.map.channels[s.channel], s.d, s.lat);
  s.x = p.x;
  s.y = p.y;
  s.heading = Math.atan2(p.ty, p.tx);
}

/** The lane the next group sails: the spawn cycle, or the lane the Delta's
 *  switch is set to; at low tide a tide lane is skipped. */
function nextChannel(g: Game): number {
  const fork = g.map.fork;
  if (fork) return fork.lanes[g.forkLane % fork.lanes.length];
  const cycle = channelCycle(g.map);
  for (let k = 0; k < cycle.length; k++) {
    const c = cycle[(g.channelCursor + k) % cycle.length];
    if (!g.map.channels[c].tide || highTide(g)) {
      g.channelCursor += k;
      return c;
    }
  }
  return cycle[g.channelCursor % cycle.length];
}

/** Is a hull sitting in the way of a lane's entry? */
function entryBusy(g: Game, ch: Channel): boolean {
  const e = lanePoint(ch, 0);
  return g.ships.some((s) => {
    const rx = s.x - e.x;
    const ry = s.y - e.y;
    const along = rx * e.tx + ry * e.ty;
    const off = Math.abs(-rx * e.ty + ry * e.tx);
    return along < SHIP.minGap + SHIP.easeGap && off <= ch.halfWidth + SHIP.laneMatch;
  });
}

function newShip(g: Game, channel: number, slot: number, d: number): Ship {
  const ship: Ship = { id: g.nextId++, x: 0, y: 0, d, lat: 0, heading: 0, hp: g.stats.shipHp, slot, channel, mult: FLOW_STEPS[g.flow].mult };
  placeShip(g, ship);
  ship.lat = slotLat(g, ship);
  placeShip(g, ship);
  return ship;
}

function spawnShips(g: Game, dt: number): void {
  spawnTanker(g);
  g.spawnT -= dt;
  if (g.spawnT > 0) return;
  const f = FORMATIONS[g.formation];
  const channel = nextChannel(g);
  // Never drop a hull on top of one still waiting at the entry: hold the spawn
  // (it retries next tick) until the entry is clear.
  if (entryBusy(g, g.map.channels[channel])) return;
  g.channelCursor++;
  for (let i = 0; i < f.group; i++) {
    const slot = f.group > 1 ? i : g.spawnCount++ % f.offsets.length;
    g.ships.push(newShip(g, channel, slot, -g.rng.ships.range(0, 12)));
  }
  g.spawnT += spawnGap(g);
}

/** The Behemoth Run: one supertanker a wave sails the tanker lane, from a
 *  few seconds into the wave, while none is already out. */
function spawnTanker(g: Game): void {
  const lane = g.map.channels.findIndex((c) => c.vip);
  if (lane < 0 || g.tankerWave >= g.wave || g.waveT < VIP.after) return;
  if (g.ships.some((s) => s.vip) || entryBusy(g, g.map.channels[lane])) return;
  g.tankerWave = g.wave;
  const t = newShip(g, lane, 0, 0);
  t.vip = true;
  t.hp = VIP.hp;
  g.ships.push(t);
  g.events.push({ kind: 'tanker' });
}

/** The furthest a hull may sail this step: up to a closed lock gate. */
function stopAt(g: Game, s: Ship): number {
  if (!g.map.locks) return Infinity;
  const ch = g.map.channels[s.channel];
  let stop = Infinity;
  g.map.locks.forEach((lock, i) => {
    const d0 = laneDAtX(ch, lock.x0);
    const d1 = laneDAtX(ch, lock.x1);
    if (d0 === null || d1 === null) return;
    const st = g.lockState[i];
    // Short of the gates: wait at the entry while it is shut.
    if (s.d < d0 - LOCK.stand + 1 && st.phase !== 'in') stop = Math.min(stop, d0 - LOCK.stand);
    // In the chamber: wait at the exit while it is shut.
    else if (s.d >= d0 - LOCK.stand && s.d < d1 && st.phase !== 'out') stop = Math.min(stop, d1 - LOCK.stand);
  });
  return stop;
}

function updateShips(g: Game, dt: number): void {
  const ease = Math.min(1, SHIP.slotEase * dt);
  // Keep station on the rails: a hull eases off when the one ahead in its lane
  // is too close. This is what turns two ships abreast into a single file when
  // a formation change merges their lanes, instead of stacking them. "Ahead"
  // and "in its lane" are measured along and across the hull's own heading,
  // so the same rule holds on a bend, a reversed lane or a fork.
  const order = [...g.ships].sort((a, b) => b.d - a.d || a.id - b.id);
  const want = order.map((s) => slotLat(g, s));
  const aim = order.map((s, i) => laneAt(g.map.channels[s.channel], s.d, want[i]));
  for (let i = 0; i < order.length; i++) {
    const s = order[i];
    const ch = g.map.channels[s.channel];
    const t = lanePoint(ch, s.d);
    const nx = -t.ty;
    const ny = t.tx;
    let gap = Infinity;
    for (let j = 0; j < order.length; j++) {
      if (j === i) continue;
      const o = order[j];
      const along = (o.x - s.x) * t.tx + (o.y - s.y) * t.ty;
      if (along < 0 || (along === 0 && j > i)) continue;
      // Sailing the other way (two-way traffic): never "ahead in my lane".
      if (Math.cos(o.heading - s.heading) < 0.2) continue;
      const sameSlot = Math.abs((aim[j].x - aim[i].x) * nx + (aim[j].y - aim[i].y) * ny) < SHIP.laneMatch;
      const sameLine = Math.abs((o.x - s.x) * nx + (o.y - s.y) * ny) < SHIP.laneMatch;
      if (sameSlot || sameLine) gap = Math.min(gap, along);
    }
    const slow = clamp((gap - SHIP.minGap) / SHIP.easeGap, 0, 1);
    const next = s.d + laneSpeed(g, s) * slow * dt;
    s.d = Math.max(s.d, Math.min(next, stopAt(g, s)));
    placeShip(g, s);
    // Only move across into the new lane once that stretch of it is empty.
    const clear = order.every((o, j) => {
      if (j === i) return true;
      const along = Math.abs((o.x - s.x) * t.tx + (o.y - s.y) * t.ty);
      const off = Math.abs((o.x - aim[i].x) * nx + (o.y - aim[i].y) * ny);
      return along >= SHIP.minGap || off >= SHIP.laneMatch;
    });
    if (clear) {
      s.lat += (want[i] - s.lat) * ease;
      placeShip(g, s);
    }
  }
  const arrived = g.ships.filter((s) => s.d > laneLength(g.map.channels[s.channel]));
  for (const s of arrived) {
    const pts = Math.round(SHIP.points * s.mult * (s.vip ? VIP.points : 1));
    g.score += pts;
    g.delivered += 1;
    addFx(g, 'text', clamp(s.x, 70, VIEW.width - 70), clamp(s.y, 40, VIEW.height - 40), { life: 1.2, text: `+${pts}` });
    if (s.vip) tankerHome(g, s);
  }
  if (arrived.length) g.ships = g.ships.filter((s) => !arrived.includes(s));
}

/** The supertanker came through: every hull gets a point back and a weapon
 *  you hold drops by the exit. */
function tankerHome(g: Game, s: Ship): void {
  for (const o of g.ships) if (o.hp < g.stats.shipHp) o.hp += 1;
  if (g.slots.length) addPickup(g, 'weapon', clamp(s.x, 120, VIEW.width - 120), clamp(s.y, 120, VIEW.height - 120), g.rng.drops.pick(g.slots));
  g.events.push({ kind: 'bigKill', label: 'TANKER HOME', x: clamp(s.x, 160, VIEW.width - 160), y: clamp(s.y, 80, VIEW.height - 80) });
}

/** Where a ship will be `ahead` seconds from now, sailing its lane. */
function shipAhead(g: Game, s: Ship, ahead: number): Point {
  const p = laneAt(g.map.channels[s.channel], s.d + laneSpeed(g, s) * ahead, s.lat);
  return { x: p.x, y: p.y };
}

/** Ships the enemy is allowed to aim at: on screen and not about to deliver. */
function targetable(g: Game, maxX = VIEW.width - 90): Ship[] {
  // Measured along the lane, so it holds for a bend or a reversed lane: on a
  // straight lane this is x > 30 and x < maxX.
  const tail = VIEW.width + 40 - maxX;
  return g.ships.filter((s) => s.d > 70 && laneLength(g.map.channels[s.channel]) - s.d > tail);
}

/** The convoy's speed in the current formation. */
export function shipSpeed(g: Game): number {
  return SHIP.speed * FORMATIONS[g.formation].speed * (g.steamT > 0 ? PICKUPS.steamMult : 1);
}

/** A hull's speed in its own channel (some lanes are crossed faster). */
function laneSpeed(g: Game, s: Ship): number {
  return shipSpeed(g) * (g.map.channels[s.channel]?.speed ?? 1);
}

/** Tidewater Flats: is the tide in? (A map without a tide: always.) */
export function highTide(g: Game): boolean {
  const t = g.map.tide;
  if (!t) return true;
  return g.t % (t.high + t.low) < t.high;
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
  if (glances(g, s.x, s.y, 30)) return;
  const f = FORMATIONS[g.formation];
  if (f.blastCut > 0 && SPLASH_WEAPONS.includes(by)) amount = Math.max(1, Math.ceil(amount * (1 - f.blastCut)));
  s.hp -= direct ? Math.max(1, amount - f.armor) : amount;
  if (s.hp > 0) return;
  g.ships = g.ships.filter((o) => o !== s);
  g.lost += s.vip ? VIP.loss : 1;
  g.sunkBy[by] += 1;
  addFx(g, 'sink', s.x, s.y, { life: 2.2, r: 34 });
  g.events.push({ kind: 'shipLost', lost: g.lost });
}

/** Armor Plating (Armory, Hull bay): a hit on a hull may glance off. */
function glances(g: Game, x: number, y: number, r: number): boolean {
  if (!g.stats.glance || !g.rng.armor.chance(g.stats.glance)) return false;
  addFx(g, 'block', x, y, { life: 0.4, r });
  return true;
}

/** A hit on the carrier (exported so the tests can land one directly). */
export function damageCarrier(g: Game, amount: number, by: ThreatKind): void {
  if (g.shieldT > 0) {
    addFx(g, 'block', g.map.carrier.x, g.map.carrier.y, { life: 0.4, r: 60 });
    return;
  }
  if (glances(g, g.map.carrier.x, g.map.carrier.y, 60)) return;
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
  mine: 0.3,
  fastboat: 0.6,
  rig: 0,
  generator: 0,
  citadel: 0,
  dreadnought: 0,
};

function launch(g: Game, l: Launch): void {
  if (l.kind === 'strafer' || l.kind === 'bomber') {
    launchPlane(g, l);
    return;
  }
  if (l.base < 0 || g.baseDown[l.base]) return;
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
  // The 20-map plan. Heavies and guided go for the supertanker when it is out;
  // some missiles go for an allied radar or battery; a mine has no target.
  if (kind === 'mine') th.target = NO_TARGET;
  else if (g.map.channels.some((c) => c.vip) || g.map.posts) aimSpecial(g, th, pool, rng);

  if (kind === 'ballistic') aimBallistic(g, th);
  const tp = kind === 'mine' ? { x: th.x + (g.map.current?.x ?? 0), y: th.y + (g.map.current?.y ?? 1) } : targetPos(g, th);
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
  const ship = g.ships.find((o) => o.id === th.target);
  let at: Point = t;
  let dur = dist(th.sx, th.sy, t.x, t.y) / th.speed;
  for (let k = 0; k < 2 && ship; k++) {
    at = shipAhead(g, ship, dur);
    dur = dist(th.sx, th.sy, at.x, at.y) / th.speed;
  }
  th.ix = Math.min(VIEW.width - 20, at.x);
  th.iy = at.y;
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
  if (isPostTarget(th.target)) {
    const p = g.map.posts?.[postIndex(th.target)];
    if (p) return p;
  } else if (th.target !== CARRIER_TARGET && th.target !== NO_TARGET) {
    const s = g.ships.find((o) => o.id === th.target);
    if (s) return s;
  }
  return g.map.carrier;
}

/** Drones and guided missiles find a new ship when theirs is gone. */
function ensureTarget(g: Game, th: Threat): void {
  if (th.target === CARRIER_TARGET || th.target === NO_TARGET) return;
  if (isPostTarget(th.target) ? postUp(g, postIndex(th.target)) : g.ships.some((s) => s.id === th.target)) return;
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
  if (g.fields.length && th.kind !== 'ballistic' && !isStructure(th.kind)) {
    const well = g.fields.find((f) => f.kind === 'well' && fieldDist(f, th.x, th.y) <= f.hw);
    if (well) {
      // Drawn in, and swirled round the core once there, so what it caught
      // stays a ring you can count (round 4: all of it stacked on one point).
      const d = dist(th.x, th.y, well.x1, well.y1) || 1;
      const ring = WELL_RING + (th.id % 3) * 10;
      const inward = Math.min(Math.max(0, d - ring), AB.well.pull * dt);
      const swirl = AB.well.pull * 0.5 * dt;
      const ux = (well.x1 - th.x) / d;
      const uy = (well.y1 - th.y) / d;
      th.x += ux * inward - uy * swirl;
      th.y += uy * inward + ux * swirl;
      th.vx = (th.x - px) / dt;
      th.vy = (th.y - py) / dt;
      return;
    }
  }
  if (isStructure(th.kind)) {
    if (th.kind === 'dreadnought') updateBoss(g, th, dt);
  } else if (th.kind === 'mine') {
    updateMine(g, th, dt);
  } else if (th.kind === 'strafer' || th.kind === 'bomber') {
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
  fastboat: FASTBOAT.turnRate,
};

/** Where a ship will be when a fast threat reaches it. */
function leadPoint(g: Game, th: Threat): Point {
  const t = targetPos(g, th);
  const ship = g.ships.find((o) => o.id === th.target);
  if (!ship) return t;
  return shipAhead(g, ship, dist(th.x, th.y, t.x, t.y) / th.speed);
}

function checkImpact(g: Game, th: Threat): void {
  const dmg = THREATS[th.kind].damage;
  const blame = th.parent ?? th.kind;
  const heavy = th.kind === 'heavy';
  if (isPostTarget(th.target)) {
    const i = postIndex(th.target);
    const p = g.map.posts![i];
    if (dist(th.x, th.y, p.x, p.y) > POST.hitRadius) return;
    th.dead = true;
    addFx(g, 'boom', th.x, th.y, { life: 0.7, r: heavy ? 50 : 30 });
    damagePost(g, i, heavy ? 99 : Math.max(1, dmg));
    return;
  }
  if (th.target === CARRIER_TARGET) {
    if (!onCarrier(g, th.x, th.y)) return;
    th.dead = true;
    // A heavy takes half the carrier's health (round 7).
    // Half the BASE carrier: Armor Plating's extra hull outlasts a heavy.
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

/** Gravity Well: the radius caught threats circle the core at (well inside
 *  AB.well.core, so the implosion still reaches them all). */
const WELL_RING = 22;

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
  g.map.posts?.forEach((p, i) => {
    if (dist(p.x, p.y, th.ix, th.iy) <= BALLISTIC.splash) damagePost(g, i, dmg);
  });
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
  // The Citadel can't be hurt while any shield generator stands.
  if (th.kind === 'citadel' && shieldUp(g)) {
    if (g.steps % 3 === 0) addFx(g, 'block', th.x, th.y, { life: 0.4, r: 70 });
    return;
  }
  th.hp -= amount;
  // Thirds of a hit (seekers) add up to a whole one, float error aside.
  if (th.hp > 1e-6) return;
  th.dead = true;
  g.kills[th.kind] += 1;
  if (isStructure(th.kind)) {
    structureDown(g, th);
  } else {
    addFx(g, 'boom', th.x, th.y, { life: 0.55, r: th.kind === 'drone' ? 18 : 26 });
    if (THREATS[th.kind].hp >= 3) g.events.push({ kind: 'bigKill', threat: th.kind, x: th.x, y: th.y });
  }
  if (!drops) return;
  if (g.rng.drops.chance(THREATS[th.kind].dropChance * g.stats.powerShare)) dropPickup(g, th.x, th.y);
  // Weapons drop on their own roll, on top of the power-ups (playtest round
  // 2: sharing one roll, they crowded out the repairs and Overdrives).
  else if (weaponDue(g, th.kind)) dropWeapon(g, th.x, th.y);
}

function blast(g: Game, x: number, y: number, radius: number, exceptId: number, amount = 1): void {
  for (const o of g.threats) {
    if (o.dead || o.id === exceptId) continue;
    if (dist(x, y, o.x, o.y) <= radius) damageThreat(g, o, amount);
  }
}

// ---------------------------------------------------------------------------
// Interceptors

/** The damage already on its way to a threat (a seeker counts its third). */
function assigned(g: Game, threatId: number): number {
  let n = 0;
  for (const i of g.interceptors) if (i.target === threatId) n += i.dmg ?? g.stats.hitDamage;
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
    let th = it.target === null ? undefined : g.threats.find((o) => o.id === it.target && !o.dead);
    // Lee of Marrow: a shot at a threat the radar is tracking flies faster.
    const speed = (it.src === 'seeker' ? AB.seeker.speed : g.stats.interceptorSpeed) * (th && tracked(g, th) ? POST.radarBoost : 1);
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
      // A seeker's splash is its own third of a hit.
      blast(g, bx, by, radius, th ? th.id : -1, it.src === 'seeker' ? (it.dmg ?? 1) : 1);
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
  const p = alongPath(r.path, r.dist);
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
  g.flareT = Math.max(0, g.flareT - dt);
  if (g.weapon) {
    g.weapon.t -= dt;
    if (g.weapon.t <= 0) {
      // Round 4: say so over the gun, or a player keeps tapping as if loaded.
      const c = g.map.carrier;
      addFx(g, 'text', c.x, c.y - CARRIER.halfBeam - 40, { life: 1.2, text: `${abilityName(g.weapon.id, g.weapon.level).toUpperCase()} DONE` });
      g.weapon = null;
    }
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
    a.flown += AB.airstrike.speed * dt;
    // Carpet Strike drops a canister every dropGap across the screen; each
    // lands (and burns) dropGap wide, edge to edge, until one would land
    // past the far edge.
    while (a.nextDrop !== null && a.flown >= a.nextDrop) {
      const lands = a.nextDrop - 80 + napalmDrift();
      if (lands - AB.airstrike.dropGap / 2 >= VIEW.width) {
        a.nextDrop = null;
        break;
      }
      const x = a.x - a.dx * (a.flown - a.nextDrop);
      g.bombs.push({ id: g.nextId++, x, y: a.y, vx: a.dx * AB.airstrike.speed * AB.airstrike.drift, t: 0, level: 3 });
      a.nextDrop += AB.airstrike.dropGap;
    }
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
// The 20-map plan: structures, allied posts, mines, locks, the fork

/** A threat with no target (a mine drifts where the current takes it). */
const NO_TARGET = -2;
/** Allied structures are targets -10, -11, ... (map.posts order). */
const POST_TARGET = -10;
const isPostTarget = (t: number) => t <= POST_TARGET;
const postIndex = (t: number) => POST_TARGET - t;
/** How far from the Delta's buoy a tap still throws it. */
export const FORK_RADIUS = 34;

/** Can a structure still be hit? (A lost radar or a knocked-out battery can't.) */
function postUp(g: Game, i: number): boolean {
  const st = g.posts[i];
  return !!st && !st.lost && st.downT <= 0;
}

/** Heavies and guided go for the supertanker while it is out; some missiles
 *  are aimed at a standing allied structure instead of a ship. */
function aimSpecial(g: Game, th: Threat, pool: Ship[], rng: RNG): void {
  const tanker = pool.find((s) => s.vip);
  if (tanker && (th.kind === 'heavy' || th.kind === 'guided') && rng.chance(VIP.targetShare)) {
    th.target = tanker.id;
    return;
  }
  if (!g.map.posts || !['guided', 'heavy', 'ballistic', 'supersonic'].includes(th.kind)) return;
  const up = g.map.posts.map((_, i) => i).filter((i) => postUp(g, i));
  if (up.length && rng.chance(POST.targetShare)) th.target = POST_TARGET - rng.pick(up);
}

/** A hit on an allied structure: a radar at 0 is gone for the rest of the
 *  run (the player's review: "if it is lost it is lost"); a battery is
 *  knocked out for a while, then back at full strength. */
function damagePost(g: Game, i: number, amount: number): void {
  const st = g.posts[i];
  const def = g.map.posts?.[i];
  if (!st || !def || !postUp(g, i)) return;
  if (g.shieldT > 0) {
    addFx(g, 'block', def.x, def.y, { life: 0.4, r: 34 });
    return;
  }
  st.hp -= amount;
  addFx(g, 'boom', def.x, def.y, { life: 0.6, r: 30 });
  if (st.hp > 0) {
    g.events.push({ kind: 'post', post: i, down: false, lost: false });
    return;
  }
  st.hp = 0;
  if (def.kind === 'radar') st.lost = true;
  else st.downT = POST.batteryDown;
  addFx(g, 'boom', def.x, def.y, { life: 1.1, r: 56 });
  g.events.push({ kind: 'post', post: i, down: true, lost: st.lost });
}

/** Is a threat inside a standing radar's sweep? */
export function tracked(g: Game, th: Threat): boolean {
  const posts = g.map.posts;
  if (!posts) return false;
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    if (p.kind === 'radar' && postUp(g, i) && dist(th.x, th.y, p.x, p.y) <= p.reach) return true;
  }
  return false;
}

/** Radar sweeps turn; batteries fire on their own and come back after a hit. */
function updatePosts(g: Game, dt: number): void {
  const posts = g.map.posts;
  if (!posts) return;
  posts.forEach((p, i) => {
    const st = g.posts[i];
    if (p.kind === 'radar') {
      if (!st.lost) st.aim += dt * ((Math.PI * 2) / 4);
      return;
    }
    if (st.downT > 0) {
      st.downT -= dt;
      if (st.downT <= 0) {
        st.hp = p.hp;
        g.events.push({ kind: 'post', post: i, down: false, lost: false });
      }
      return;
    }
    st.fireT -= dt;
    if (st.fireT > 0) return;
    const target = g.threats
      .filter((t) => !t.dead && !isStructure(t.kind) && dist(t.x, t.y, p.x, p.y) <= p.reach && assigned(g, t.id) < t.hp)
      .sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y))[0];
    if (!target) {
      st.fireT = 0.1;
      return;
    }
    st.fireT = POST.batteryGap;
    st.aim = Math.atan2(target.y - p.y, target.x - p.x);
    g.interceptors.push({ id: g.nextId++, x: p.x, y: p.y - 10, target: target.id, tx: target.x, ty: target.y, life: 0, src: 'gun' });
    addFx(g, 'launch', p.x, p.y - 10, { life: 0.3, r: 9 });
  });
}

/** Rigs, generators and the Citadel stand from the start, on their bases. */
function raiseStructures(g: Game): void {
  g.map.bases.forEach((b, i) => {
    const kind: ThreatKind | null = b.rig ? 'rig' : b.generator ? 'generator' : b.core ? 'citadel' : null;
    if (!kind) return;
    const hp = b.rig?.hp ?? b.generator?.hp ?? b.core?.hp ?? THREATS[kind].hp;
    g.threats.push(structure(g, kind, b.x, b.y, hp, i));
  });
}

function structure(g: Game, kind: ThreatKind, x: number, y: number, hp: number, base?: number): Threat {
  return {
    id: g.nextId++, kind, x, y, vx: 0, vy: 0, hp, speed: THREATS[kind].speed, heading: Math.PI, target: NO_TARGET,
    age: 0, phase: 0, dead: false, spawnT: 0, sx: x, sy: y, ix: 0, iy: 0, dur: 1, apex: 0, base,
  };
}

/** Structures that stand between waves (a wave can end with them up). */
function standing(th: Threat): boolean {
  return th.kind === 'rig' || th.kind === 'generator' || th.kind === 'citadel';
}

/** Is this structure worth a shot? (Not the Citadel while it is shielded.) */
export function hittable(g: Game, th: Threat): boolean {
  return !(th.kind === 'citadel' && shieldUp(g));
}

/** Threats a player would bother with right now: anything that strikes; a
 *  structure only when nothing else is up and the rack is all but full (or
 *  a Railgun is loaded, made for big targets). */
export function worthShooting(g: Game, list: Threat[]): Threat[] {
  const live = list.filter((t) => !t.dead);
  const strikers = live.filter((t) => !isStructure(t.kind));
  const rail = g.weapon?.id === 'railgun';
  const structures = live.filter((t) => isStructure(t.kind) && hittable(g, t));
  if (rail) return [...strikers, ...structures];
  if (strikers.length) return strikers;
  return g.overdriveT > 0 || g.ammo >= g.stats.rack - 1 ? structures : [];
}

/** The fork lane a sensible player would send ships down: the branch with
 *  the fewest threats closing on its hulls, staying put unless another is
 *  clearly quieter (null: leave the switch alone). */
export function quieterBranch(g: Game): number | null {
  const fork = g.map.fork;
  if (!fork) return null;
  const heat = fork.lanes.map((lane) => g.threats.filter((t) => !t.dead && g.ships.some((s) => s.id === t.target && s.channel === lane)).length);
  const cur = g.forkLane % fork.lanes.length;
  let best = cur;
  heat.forEach((h, i) => {
    if (h < heat[best]) best = i;
  });
  return heat[cur] - heat[best] >= 2 ? best : null;
}

/** Is the Citadel's shield up? (While any generator stands.) */
export function shieldUp(g: Game): boolean {
  return !!g.map.shield && g.threats.some((t) => t.kind === 'generator' && !t.dead);
}

const STRUCTURE_DOWN: Partial<Record<ThreatKind, string>> = {
  rig: 'RIG DESTROYED',
  generator: 'GENERATOR DOWN',
  citadel: 'CITADEL SILENCED',
  dreadnought: 'DREADNOUGHT SUNK',
};

/** A structure falls: its base launches no more, and it goes up in a big
 *  explosion with its name. The last generator drops the shield. */
function structureDown(g: Game, th: Threat): void {
  if (th.base !== undefined) g.baseDown[th.base] = true;
  addFx(g, 'boom', th.x, th.y, { life: 1.2, r: 70 });
  addFx(g, th.kind === 'dreadnought' ? 'sink' : 'burst', th.x, th.y, { life: 1.4, r: 60 });
  const label = th.kind === 'generator' && !shieldUp(g) && g.map.shield ? 'SHIELD DOWN' : STRUCTURE_DOWN[th.kind] ?? 'DESTROYED';
  g.events.push({ kind: 'bigKill', label, x: th.x, y: th.y });
}

/** The Dreadnought steams in from the right edge for this wave. */
function launchBoss(g: Game): void {
  const boss = g.map.boss!;
  g.bossWave = g.wave;
  const p = boss.path[0];
  const th = structure(g, 'dreadnought', p.x, p.y, boss.hp);
  th.along = 0;
  th.fireT = BOSS.firstShot;
  if (!g.seen.has('dreadnought')) {
    g.seen.add('dreadnought');
    g.events.push({ kind: 'debut', threat: 'dreadnought' });
  }
  g.threats.push(th);
  g.events.push({ kind: 'boss' });
}

/** Along its path, firing a broadside every BOSS.every s; off the far end
 *  it is gone (no kill). */
function updateBoss(g: Game, th: Threat, dt: number): void {
  const path = g.map.boss!.path;
  th.along = (th.along ?? 0) + th.speed * dt;
  const p = alongPath(path, th.along);
  th.x = p.x;
  th.y = p.y;
  th.heading = p.heading;
  th.age += 0;
  if (th.along >= pathLength(path)) {
    th.dead = true;
    return;
  }
  th.fireT = (th.fireT ?? BOSS.every) - dt;
  if (th.fireT > 0 || th.x > VIEW.width - 40 || th.x < 40) return;
  th.fireT = BOSS.every;
  BOSS.broadside.forEach((kind, k) => {
    const m = spawnThreat(g, kind, th.x + (k - 1) * 60, th.y, 'base');
    m.from = th.id;
  });
  addFx(g, 'launch', th.x, th.y, { life: 0.6, r: 40 });
}

/** A mine drifts on the current (with a little wobble), blows up the first
 *  hull it touches, and is gone off the edge of the screen. */
function updateMine(g: Game, th: Threat, dt: number): void {
  const c = g.map.current ?? { x: 0, y: 1 };
  const k = th.speed / (Math.hypot(c.x, c.y) || 1);
  const wob = Math.sin(th.age * 1.3 + th.phase) * MINE.wobble;
  th.x += (c.x * k + wob * (c.y * k) / (th.speed || 1)) * dt;
  th.y += (c.y * k - wob * (c.x * k) / (th.speed || 1)) * dt;
  th.heading = Math.atan2(c.y, c.x);
  if (th.x < -40 || th.x > VIEW.width + 40 || th.y < -40 || th.y > VIEW.height + 40) {
    th.dead = true;
    return;
  }
  for (const s of g.ships) {
    if (dist(s.x, s.y, th.x, th.y) > MINE.hitRadius + (s.vip ? 24 : 0)) continue;
    th.dead = true;
    addFx(g, 'splash', th.x, th.y, { life: 0.9, r: 46 });
    damageShip(g, s, THREATS.mine.damage, 'mine');
    return;
  }
  if (onCarrier(g, th.x, th.y)) {
    th.dead = true;
    addFx(g, 'splash', th.x, th.y, { life: 0.9, r: 46 });
    damageCarrier(g, 1, 'mine');
  }
}

/** Seconds until a mine drifts into a hull (99 if it never will). */
function mineEta(g: Game, th: Threat): number {
  let best = 99;
  for (const s of g.ships) {
    // Where the ship will be relative to the mine, over the next few seconds.
    for (let t = 0; t <= 8; t += 0.5) {
      const p = shipAhead(g, s, t);
      const mx = th.x + th.vx * t;
      const my = th.y + th.vy * t;
      if (dist(p.x, p.y, mx, my) <= MINE.hitRadius + 6) {
        best = Math.min(best, t);
        break;
      }
    }
  }
  return best;
}

/** Locks: the entry gate stays open LOCK.inTime s (until no hull straddles
 *  it), the chamber fills for the lock's wait, then the exit opens
 *  LOCK.outTime s, until the chamber is empty. */
function updateLocks(g: Game, dt: number): void {
  g.map.locks?.forEach((lock, i) => {
    const st = g.lockState[i];
    st.t += dt;
    const inside = (lo: number, hi: number) =>
      g.ships.some((s) => {
        const ch = g.map.channels[s.channel];
        const d0 = laneDAtX(ch, lock.x0);
        const d1 = laneDAtX(ch, lock.x1);
        if (d0 === null || d1 === null) return false;
        const a = lo < 0 ? d0 + lo : d0 + lo;
        const b = hi === Infinity ? d1 : d0 + hi;
        return s.d >= a && s.d < b;
      });
    if (st.phase === 'in' && st.t >= LOCK.inTime && !inside(-LOCK.stand, 14)) {
      st.phase = 'fill';
      st.t = 0;
    } else if (st.phase === 'fill' && st.t >= lock.wait) {
      st.phase = 'out';
      st.t = 0;
    } else if (st.phase === 'out' && st.t >= LOCK.outTime && !inside(-LOCK.stand + 1, Infinity)) {
      st.phase = 'in';
      st.t = 0;
    }
  });
}

/** Seconds left in a lock's current phase (the renderer's countdown). */
export function lockCountdown(g: Game, i: number): number {
  const st = g.lockState[i];
  const lock = g.map.locks?.[i];
  if (!st || !lock) return 0;
  const len = st.phase === 'in' ? LOCK.inTime : st.phase === 'fill' ? lock.wait : LOCK.outTime;
  return Math.max(0, len - st.t);
}

/** The Delta's switch: the next ships take the fork's next lane. */
export function throwSwitch(g: Game): void {
  const fork = g.map.fork;
  if (!fork) return;
  g.forkLane = (g.forkLane + 1) % fork.lanes.length;
  addFx(g, 'text', fork.x, fork.y - 50, { life: 1, text: FORK_NAMES[g.forkLane] ?? 'SWITCHED' });
  g.events.push({ kind: 'fork', lane: g.forkLane });
}

const FORK_NAMES = ['NORTH', 'MIDDLE', 'SOUTH'];

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
 *  the pity clock (WEAPON.pity; Supply Lines shortens it) has run out. */
function weaponDue(g: Game, kind: ThreatKind): boolean {
  if (!g.slots.length || g.pickups.some((p) => p.kind === 'weapon')) return false;
  return g.weaponDropT >= g.stats.dropPity || g.rng.drops.chance(THREATS[kind].dropChance * g.stats.dropShare);
}

function dropWeapon(g: Game, x: number, y: number): void {
  g.weaponDropT = 0;
  addPickup(g, 'weapon', x, y, g.rng.drops.pick(g.slots));
}

/** A kill drops a power-up, picked by PICKUPS.weights. */
function dropPickup(g: Game, x: number, y: number): void {
  const w = g.map.night ? { ...PICKUPS.weights, starshell: PICKUPS.starshellWeight } : PICKUPS.weights;
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
  // A weapon pickup is bigger and carries its name under it: kept far
  // enough in that both stay on screen (round 4: at the old margin the name
  // was cut off at the edges).
  const mx = kind === 'weapon' ? 90 : 40;
  g.pickups.push({
    id: g.nextId++,
    kind,
    weapon,
    x: clamp(x, mx, VIEW.width - mx),
    y: clamp(y, 60, VIEW.height - (kind === 'weapon' ? 100 : 60)),
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
  starshell: 'STAR SHELL',
};

function collect(g: Game, p: Pickup): void {
  g.pickups = g.pickups.filter((o) => o !== p);
  g.events.push({ kind: 'pickup', pickup: p.kind });
  if (p.kind === 'weapon') {
    // Loads the gun for weaponTime (WEAPON.time, more with Long Loads; the
    // same weapon again: a fresh clock;
    // another one: it takes over). One you swapped out loads nothing.
    const id = p.weapon!;
    const level = g.levels[id] ?? 0;
    if (level <= 0) return;
    g.weapon = { id, level, t: g.stats.weaponTime };
    if (id === 'frigate') launchEscorts(g, level);
    // Aegis: a fresh pickup rearms every hull in full.
    if (id === 'aegis') {
      for (const s of g.ships) s.aegis = undefined;
      g.carrierAegis = null;
    }
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
      else g.carrierHp = Math.min(g.stats.carrierHp, g.carrierHp + PICKUPS.carrierRepairHp);
      break;
    }
    case 'overdrive':
      g.overdriveT = PICKUPS.overdriveTime * g.stats.powerTime;
      break;
    case 'timewarp':
      g.warpT = PICKUPS.warpTime * g.stats.powerTime;
      break;
    case 'shield':
      g.shieldT = PICKUPS.shieldTime * g.stats.powerTime;
      break;
    case 'steam':
      g.steamT = PICKUPS.steamTime * g.stats.powerTime;
      break;
    case 'starshell':
      g.flareT = PICKUPS.starshellTime * g.stats.powerTime;
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
  if (isStructure(th.kind)) return 99;
  if (th.kind === 'mine') return mineEta(g, th);
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
