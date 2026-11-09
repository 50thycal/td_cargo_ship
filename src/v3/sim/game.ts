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
import { flightAt, laneAt, laneDAtX, laneHalfWidth, laneLength, lanePoint } from './lanes';
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
import { draftPool, gestureOf, isBoost, newInChapter, ROSTER } from '../data/roster';
import { chapterOf } from '../data/maps';
import { waveSpec } from '../data/waves';
import { FOE, FOES, HEAVY_FOES, type FoeId, type FoeSetting } from '../data/foes';
import { LAB_SET } from '../data/lab';
import { labBusy, labCame, labFoes, labHarm, labKilled, labOpener, labShotAt, labWave, labWaveCleared, newSet, setUpLab, type LabSetup, type LabState } from './lab';
import { absorbs, foeEta, foeWorthShooting, guardFor, lureIn, lured, paintTarget, foeCount, foeDown, foesBusy, fromBase, isFoe, launchFoe, movesItself, newFoeState, nukeFoes, planFoes, updateFoe, updateFoeMarks, updateFoeShots, type FoeData, type FoeState } from './foes';
import type { Cue, CueId } from '../audio/cues';

export const CARRIER_TARGET = -1;

/** Strafing jets (the Strike jet, and the enemy build's Stealth Strafer),
 *  bombers (the Missile bomber and the Stealth Bomber): they fly the same
 *  way, run in as their kind does, and only the old two are warned of. */
export function isJet(k: ThreatKind): boolean {
  return k === 'strafer' || k === 'stealthJet';
}
export function isBomberKind(k: ThreatKind): boolean {
  return k === 'bomber' || k === 'stealthBomber';
}
export function isPlaneKind(k: ThreatKind): boolean {
  return isJet(k) || isBomberKind(k);
}

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
  /** An aircraft on a curved lane: the lane, distance along it, the way it
   *  flies (+1 with the shipping, -1 against), and its offset across. */
  route?: { lane: number; s: number; dir: number; lat: number; flown: number };
  /** Bank angle (radians, + = right wing down), from how hard it turns. */
  bank?: number;
  /** Bomber: guided missiles still aboard, and seconds since the last drop. */
  bombs?: number;
  dropT?: number;
  /** The sub or truck that fired it. */
  from?: number;
  /** A structure: the base it stands on (rigs, generators, the Citadel). */
  base?: number;
  /** Grapnel or Chain Shot has hold of it: it doesn't fly its own course
   *  (and can't hit anything) until let go. */
  held?: boolean;
  /** A strafer whose run a Shield (level 2) has blocked: all of it is. */
  blocked?: boolean;
  /** The Dreadnought: how far along its path it has steamed, and seconds to
   *  its next broadside. */
  along?: number;
  fireT?: number;
  /** The enemy build: a new enemy's own state (sim/foes.ts). */
  foe?: FoeData;
  /** A Decoy Drones swarm member (real or decoy): its place across the
   *  swarm's front, px off the line to its target, so the swarm flies spread
   *  out and closes up only near the convoy (swarmAim). */
  slot?: number;
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
  /** Dual Wield's second weapon: another tag on the shot. */
  also?: Weapon[];
  /** The enemy build: fired by the player's own tap (the Lure Beacon takes
   *  only such shots). */
  tap?: boolean;
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  /** A weapon pickup: which of your weapons it loads. */
  weapon?: AbilityId;
  /** Supply Run: seconds left on its parachute (it drifts down, then
   *  flies to the carrier). */
  chute?: number;
  x: number;
  y: number;
  age: number;
}

export type FxKind = 'boom' | 'splash' | 'tracer' | 'launch' | 'burst' | 'text' | 'sink' | 'spout' | 'spray' | 'flak' | 'block' | 'beam' | 'arc' | 'emp' | 'frag' | 'thermo'
  // The weapons plan, phase 0–1.
  | 'nuke' | 'lance' | 'cut' | 'chain' | 'beat'
  // Phase 2.
  | 'orbital'
  // Phase 3.
  | 'shatter';

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
  /** A curved lane (map visual-check round, "enemy jets should follow the
   *  curve and bank around the bend"): the aircraft flies this lane's path,
   *  `lat` across it, instead of a straight line along y. */
  lane?: number;
  lat?: number;
  /** The enemy build: a launch at one ship (a Spotter's strike), and the
   *  spotter that called it (shot down, its launches are cancelled). */
  target?: number;
  spotter?: number;
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
  /** Map visual-check round ("the frigates don't follow the actual water
   *  path and just overlap the land"): a frigate sails its lane like the
   *  convoy, `d` along it and `lat` across, to a station at (sd, slat). */
  lane: number;
  d: number;
  lat: number;
  sd: number;
  slat: number;
  /** The way the hull points (radians). */
  heading: number;
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
  /** laser: Searing Edge's lit cut; sun: Sunspear's burning line. */
  kind: 'burn' | 'flak' | 'well' | 'laser' | 'sun';
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
  /** When it was loaded (Cadence Gun counts its beats from here). */
  t0?: number;
  /** Overclock: its own level while it plays a level higher (clock stopped). */
  oc?: number;
}

/** A finger on the water with a gesture weapon loaded (Charge Lance, Laser
 *  Cutter, Grapnel): what it is doing, where it is, and since when. */
export interface Press {
  x0: number;
  y0: number;
  x: number;
  y: number;
  t0: number;
  radius: number;
  /** pending: no gesture yet (let go now and it is a tap). */
  mode: 'pending' | 'charge' | 'swipe' | 'hook' | 'dry';
  /** Grapnel: the threat on the cable. */
  hook: number | null;
  /** Laser Cutter: what this swipe has cut, and how far it has gone. */
  cut: number[];
  cutLen: number;
  /** The finger's velocity (px/s), for the Grapnel's fling. */
  vx: number;
  vy: number;
  /** Grapnel: when each threat was last smacked (id → time). */
  smacked: Record<number, number>;
}

/** A Grapnel ball let go: it flies, then bursts. */
export interface Fling {
  id: number;
  vx: number;
  vy: number;
  t: number;
  level: number;
}


/** Drone Screen: one of your drones, flying to ram its target. */
export interface Wing {
  id: number;
  x: number;
  y: number;
  heading: number;
  target: number | null;
  life: number;
}

/** Gunship Pair: a helicopter over the convoy. `slot` picks its side.
 *  It flies like one (the player: "it should rotate and then lean into
 *  it"): `heading` is where its nose points, it turns toward where it is
 *  going before it picks up speed, and eases into its hover; `lean` and
 *  `roll` (−1..1) are how hard it is accelerating ahead and sideways. */
export interface Heli {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  slot: number;
  fireT: number;
  heading: number;
  lean: number;
  roll: number;
  leaving: boolean;
}

/** A Gunship Pair missile (the player: "make their projectiles look like
 *  hellfire missiles … with a streak"): it leaves the rail along the
 *  helicopter's nose, curves onto its target and bursts there. `trail` is
 *  its smoke, the last few points it passed. */
export interface Hellfire {
  id: number;
  x: number;
  y: number;
  heading: number;
  target: number;
  tx: number;
  ty: number;
  t: number;
  dmg: number;
  trail: number[];
}

/** Supply Run: a cargo plane crossing the screen, dropping its crates in a
 *  row as it passes each spot. */
export interface CargoPlane {
  id: number;
  x: number;
  y: number;
  vx: number;
  drops: { x: number; kind: PickupKind; weapon?: AbilityId }[];
}

/** Bomber Wing: a bomber on its pass over a target on the shore. */
export interface Sortie {
  id: number;
  x: number;
  y: number;
  vx: number;
  tx: number;
  ty: number;
  hit: boolean;
  /** truck: a raider's id; silo: a base's index; tunnel: the cancelled
   *  raider spawn (already gone from the queue); lure: a Lure Beacon's
   *  threat id (the pass is wasted on it). */
  kind: 'truck' | 'silo' | 'tunnel' | 'lure';
  ref: number;
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
  rng: { ships: RNG; threats: RNG; drops: RNG; draft: RNG; armor: RNG; foes: RNG };
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
  /** Sounds asked for this step (see audio/cues.ts). Cleared at the start of
   *  every step, so headless runs never grow it; the UI drains it after each
   *  step and after each tap. Write-only for the sim: nothing reads it, so
   *  it can never change a replay. */
  cues: Cue[];
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
  /** A finger held on the water with a gesture weapon loaded. */
  press: Press | null;
  /** Grapnel balls in flight. */
  flings: Fling[];
  /** Cadence Gun: the last beat hit, beats hit in a row, and War Drum's
   *  broadside waiting for the next beat. */
  beat: { last: number; run: number; armed: boolean; seen: number };
  /** Phase 2 passives: Drone Screen's drones, the Gunship Pair, Bomber
   *  Wing's passes, the clocks to their next, and Orbital Strike's lock. */
  wings: Wing[];
  helis: Heli[];
  hellfires: Hellfire[];
  sorties: Sortie[];
  planes: CargoPlane[];
  passiveT: number;
  orbital: { id: number; t: number; second: boolean } | null;
  /** Silos Bomber Wing has silenced, until when (by base index). */
  quietUntil: number[];
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
  // ---- The weapons plan, phase 3: boosts ----
  /** The boost running (it never replaces the loaded weapon). */
  boost: Boost | null;
  /** Dual Wield: a second weapon loaded beside the first. */
  weapon2: Weapon | null;
  /** The second weapon's passive clock (two passives at once). */
  passiveT2: number;
  /** Focus: the holding finger is down (its own input, `focusHold`: it
   *  only slows time; the other finger taps). */
  finger: boolean;
  /** Focus: slow motion running this step. */
  focusing: boolean;
  /** Seconds of real (unslowed) play: Focus slows `t`, not this. */
  realT: number;
  /** Free Play: the plan's drops (the power-ups that became boosts don't drop). */
  freePlay: boolean;
  /** The enemy build: the new enemies this run can meet, and their shots. */
  foe: FoeState;
  /** The Test Lab: the card under test and its evidence (null outside it). */
  lab: LabState | null;
}



/** A boost running: its level, seconds left, and its own state. */
export interface Boost {
  id: AbilityId;
  level: number;
  t: number;
  /** Shots fired under it (Lead Rain counts to its flak). */
  n: number;
  /** Focus: seconds of slow motion left. */
  bank: number;
  /** Airdrop: seconds to the next crate. */
  crateT: number;
  /** Overclock: weapons overclocked so far; `drops`: the MAX weapon that
   *  drops more often instead. */
  clocked: number;
  drops: AbilityId | null;
  /** Seconds it has run (Freeze Frame's first 2 s). */
  age: number;
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
      foes: root.fork('foes'),
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
    cues: [],
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
    press: null,
    flings: [],
    beat: { last: -9, run: 0, armed: false, seen: -1 },
    wings: [],
    helis: [],
    hellfires: [],
    sorties: [],
    planes: [],
    passiveT: 0,
    orbital: null,
    quietUntil: [],
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
    boost: null,
    weapon2: null,
    passiveT2: 0,
    finger: false,
    focusing: false,
    realT: 0,
    freePlay: false,
    foe: newFoeState(mapId),
    lab: null,
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
  // The Test Lab: the wave's size and this wave's scenario.
  const labMods = labWave(g, spec);
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
  // The enemy build: the new enemies, each in place of a drone swarm (and
  // the heavier ones, a missile too).
  for (let k = 0; k < (labMods?.planes ?? 0); k++) {
    replace('drone', 1);
    units.push({ kind: k % 2 ? 'bomber' : 'strafer', size: 1 });
  }
  for (const id of labFoes(g, cut(foeCount(g.wave), len)) ?? planFoes(g, cut(foeCount(g.wave), len))) {
    replace('drone', 1);
    if (HEAVY_FOES.includes(id)) replace(units.some((u) => u.kind === 'guided') ? 'guided' : 'ballistic', 1);
    units.push({ kind: FOES[id].kind, size: 1 });
  }
  const themes: RaidTheme[] = ['swarm', 'barrage', 'volley', 'strike'];
  const count = (t: RaidTheme) => units.filter((u) => RAID_THEME[u.kind] === t).length;
  const present = themes.filter((t) => count(t) > 0);
  const total = Math.max(present.length, Math.round(spec.duration / RAID.every));
  // Raids per theme, in proportion to its units (at least one each), and
  // never more raids of a theme than it has units: playthrough round, wave 1
  // planned six swarm raids for three swarms, so half its "SWARM INBOUND"
  // warnings lit bases that never fired and the first drone came at 13 s.
  const per = new Map(present.map((t) => [t, 1]));
  for (let k = present.length; present.length && k < total; k++) {
    const open = present.filter((t) => per.get(t)! < count(t));
    if (!open.length) break;
    const t = open.reduce((a, b) => (count(b) / per.get(b)! > count(a) / per.get(a)! ? b : a));
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
      // A new enemy that doesn't come out of a base comes on its own.
      if (isFoe(u.kind) && !fromBase(u.kind)) {
        queue.push({ at, kind: u.kind, base: -1 });
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
  labOpener(g, queue);
  g.queue = queue.filter((l) => l.base !== -2);
  g.events.push({ kind: 'wave', wave: g.wave });
  cue(g, 'wave.start', VIEW.width / 2, VIEW.height / 2);
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
  const truckKind = (u: Unit) => u.kind !== 'strafer' && u.kind !== 'bomber' && u.kind !== 'mothership' && !isFoe(u.kind);
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

export function pathLength(path: Point[]): number {
  let n = 0;
  for (let k = 1; k < path.length; k++) n += dist(path[k - 1].x, path[k - 1].y, path[k].x, path[k].y);
  return n;
}

/** The point `d` along a path, and the heading of the stretch it is on. */
export function alongPath(path: Point[], d: number): { x: number; y: number; heading: number } {
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
  // Every base for this kind is down: most of its launches move to a
  // launcher still standing (further off, so with more warning), the rest
  // are lost.
  if (able.length) return any.length && rng.chance(STRUCTURE_REROUTE) ? rng.pick(any) : -2;
  // The original five maps: every base launches, so this is rng.int(bases).
  return any.length === g.map.bases.length ? rng.int(g.map.bases.length) : any.length ? rng.pick(any) : -2;
}

/** Share of a downed rig's launches that come from another base instead. */
const STRUCTURE_REROUTE = 0.75;

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
  g.foe.byTap = true;
  const result = tapResult(g, x, y, radius);
  g.foe.byTap = false;
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
  return fireLoaded(g, x, y, threat, radius);
}

/** Dual Wield: the second hand's shot costs no round (one round a tap). */
let freeShots = 0;
/** Hyper Overdrive fires these twice (one-shot weapons with no state). */
const HYPER_TWICE: AbilityId[] = ['railgun', 'airstrike', 'scatter', 'boomerang', 'seeker', 'flak', 'well', 'shrapnel', 'thermo'];

/** A tap that is a shot: every loaded weapon fires (Dual Wield: both, for
 *  one round); with nothing loaded, a plain interceptor or (Wild Card) a
 *  random weapon. */
function fireLoaded(g: Game, x: number, y: number, threat: Threat | null, radius: number): TapResult {
  const ws = loadedWeapons(g);
  if (!ws.length && boostLevel(g, 'wildCard')) return wildTap(g, x, y, threat, radius);
  let res: TapResult | null = null;
  const plain: Weapon[] = [];
  for (const w of ws) {
    if (res === 'dry') break;
    freeShots = res ? 1 : 0;
    const r = fireWeapon(g, w, x, y, threat, radius);
    if (r === null) plain.push(w);
    else {
      if (r === 'fire' && boostLevel(g, 'overdrive') >= ABILITY_MAX && HYPER_TWICE.includes(w.id)) {
        freeShots = 1;
        fireWeapon(g, w, x, y, threat, radius);
      }
      res = res ?? r;
    }
    freeShots = 0;
  }
  if (res === 'dry') return 'dry';
  if (!threat) {
    return res ?? 'empty';
  }
  if (plain.length || !ws.length) {
    freeShots = res ? 1 : 0;
    const ok = fireAt(g, threat, plain);
    freeShots = 0;
    return res ?? (ok ? 'fire' : 'dry');
  }
  return res!;
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
  /** The enemy build: which new enemies come (absent: as the campaign). */
  enemies?: FoeSetting;
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
  g.freePlay = true;
  if (setup.enemies && setup.enemies !== 'campaign') {
    g.foe = newFoeState(g.map.id, setup.enemies);
    replanWave(g);
  }
}

/** The first wave was planned before Free Play's or the Test Lab's setup
 *  was known: plan it again, as if it had just started. */
function replanWave(g: Game): void {
  if (g.phase !== 'wave' || g.waveT !== 0) return;
  g.events = g.events.filter((e) => e.kind !== 'wave');
  g.cues = [];
  g.wave -= 1;
  startWave(g);
}

/** The Test Lab's "Bring one now": the card's enemy comes in at once (a
 *  weapon card drops its weapon by the carrier). A recorded command, so a
 *  test replays exactly. */
export function labBring(g: Game): void {
  const lab = g.lab;
  if (!lab || g.phase !== 'wave') return;
  // A combo brings its whole set, paired as in its waves (and its weapon).
  if (lab.pair) {
    lab.sets.push(newSet(lab, g.waveT));
    updateLabSets(g);
    return;
  }
  if (lab.foes.length) {
    const f = lab.foes[lab.cursor++ % lab.foes.length];
    const kind = FOES[f].kind;
    if (isPlaneKind(kind)) g.queue.unshift({ at: g.waveT, kind, base: -1 });
    else if (fromBase(kind)) {
      const b = pickBase(g, kind, g.rng.foes);
      if (b >= 0) launchFoe(g, { at: g.waveT, kind, base: b }, g.map.bases[b]);
    } else launchFoe(g, { at: g.waveT, kind, base: -1 });
  } else if (lab.weapon) {
    const c = g.map.carrier;
    addPickup(g, 'weapon', c.x + g.rng.foes.range(-180, 180), c.y - 150, lab.weapon);
  }
}

/** Is a combo's lead at its station: the Spotter on its circle, the Repair
 *  Tender on station, the Rocket Truck at the end of its road? */
function atStation(th: Threat): boolean {
  const f = th.foe;
  if (!f) return true;
  if (th.kind === 'tender') return f.n === 1;
  if (th.kind === 'spotter' || th.kind === 'rocketTruck') return f.state >= 1;
  return true;
}

/** The live launch base furthest (on average) from the convoy's ships. */
function farBase(g: Game): number | undefined {
  const live = g.map.bases.map((b, i) => (launcher(b) && !g.baseDown[i] ? i : -1)).filter((i) => i >= 0);
  if (!live.length) return undefined;
  const ships = g.ships.length ? g.ships : [g.map.carrier];
  const far = (i: number) => ships.reduce((a, s) => a + dist(s.x, s.y, g.map.bases[i].x, g.map.bases[i].y), 0);
  return live.reduce((m, i) => (far(i) > far(m) ? i : m));
}

/** The Test Lab's combo sets (Test Lab round 4, "the recon drone and then
 *  the siege cannon never really appeared at the same time"): each set's
 *  weapon drops by the carrier, its lead launches, and the others follow on
 *  the pairing's cues, so the set is on the board together. */
function updateLabSets(g: Game): void {
  const lab = g.lab;
  if (!lab?.pair || !lab.sets.length) return;
  const P = lab.pair;
  const c = g.map.carrier;
  // One member out now; returns its base (-1 if it came from no base).
  const out = (f: FoeId, base?: number): number => {
    const kind = FOES[f].kind;
    if (isPlaneKind(kind)) {
      g.queue.unshift({ at: g.waveT, kind, base: -1 });
      return -1;
    }
    const b = fromBase(kind) ? (base ?? pickBase(g, kind, g.rng.foes)) : -1;
    if (fromBase(kind) && b < 0) return -1;
    launch(g, { at: g.waveT, kind, base: b });
    return b;
  };
  for (const s of lab.sets) {
    if (!s.dropped && g.waveT >= s.at - LAB_SET.weaponLead) {
      s.dropped = true;
      if (lab.weapon && (g.levels[lab.weapon] ?? 0) > 0) addPickup(g, 'weapon', c.x + g.rng.foes.range(-160, 160), c.y - 150, lab.weapon);
    }
    if (!s.led && g.waveT >= s.at) {
      const id = g.nextId;
      s.led = { id, t: g.waveT, base: out(P.lead, P.far ? farBase(g) : s.bases[P.lead]) };
    }
    const led = s.led;
    if (!led) continue;
    if (led.station === undefined) {
      const th = g.threats.find((t) => t.kind === FOES[P.lead].kind && t.id >= led.id);
      // Shot down first (or never on the board), or slow getting there: the
      // others come now.
      if (!th || th.dead || atStation(th) || g.waveT - led.t >= LAB_SET.station) led.station = g.waveT;
    }
    P.follow.forEach((f, i) => {
      if (s.done[i]) return;
      const base = f.base === 'same' && led.base >= 0 ? led.base : s.bases[f.foe];
      if (f.on === 'arrive') {
        // Out once the lead is due within this one's own flight from its
        // base, plus `after`: they arrive together.
        const kind = FOES[f.foe].kind;
        const from = base !== undefined && base >= 0 ? g.map.bases[base] : c;
        const speed = THREATS[kind].speed * (1 + (g.waveSpeed - 1) * WAVE_SPEED_SHARE[kind]);
        const leads = g.threats.filter((t) => !t.dead && t.kind === FOES[P.lead].kind && t.id >= led.id);
        const due = leads.some((t) => {
          const p = targetPos(g, t);
          return timeToImpact(g, t) <= dist(from.x, from.y, p.x, p.y) / speed + f.after;
        });
        if (leads.length && !due && g.waveT - led.t < LAB_SET.station) return;
      } else {
        const from = f.on === 'station' ? led.station : led.t;
        if (from === undefined || g.waveT < from + f.after) return;
      }
      s.done[i] = true;
      out(f.foe, base);
    });
  }
  lab.sets = lab.sets.filter((s) => !s.led || !s.dropped || s.done.some((d) => !d));
}

/** The Test Lab (after applyFreePlay): give the run its card. */
export function applyLab(g: Game, setup: LabSetup): void {
  setUpLab(g, setup);
  replanWave(g);
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
  // The roster (data/roster.ts) says which weapons are live and from which
  // chapter; a held one (Free Play can hand over a prototype) can level up.
  const pool = draftPool(chapterOf(g.map.id));
  const open = ABILITY_ORDER.filter((id) => (pool.includes(id) || (g.levels[id] ?? 0) > 0) && (g.levels[id] ?? 0) < ABILITY_MAX);
  const rng = g.rng.draft;
  const mine = rng.shuffle(open.filter((id) => (g.levels[id] ?? 0) > 0));
  const other = rng.shuffle(open.filter((id) => !(g.levels[id] ?? 0)));
  // Each chapter brings new weapons (the lock-in round): until you hold one
  // of this chapter's, the first new card dealt is one of them.
  const debut = newInChapter(chapterOf(g.map.id));
  if (!g.freePlay && !debut.some((id) => (g.levels[id] ?? 0) > 0)) {
    const k = other.findIndex((id) => debut.includes(id));
    if (k > 0) other.unshift(...other.splice(k, 1));
  }
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
      cue(g, 'gun.fire', g.map.carrier.x, g.map.carrier.y);
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
    // Gesture weapons: a plain tap (no hold, no swipe) is a plain shot.
    case 'lance':
    case 'cutter':
    case 'grapnel':
      return null;
    case 'cadence':
      return cadenceTap(g, w, ax, ay);
    // Passives: they work on their own; the gun is the plain gun.
    case 'droneScreen':
    case 'gunships':
    case 'bomberWing':
    case 'orbital':
      return null;
    // Boosts are never loaded (startBoost); nothing to fire.
    case 'supplyRun':
    case 'overclock':
    case 'dualWield':
    case 'wildCard':
    case 'focus':
    case 'overdrive':
    case 'timeWarp':
    case 'shield':
    case 'fullSteam':
      return null;
  }
}

/** `n` rounds from the rack (free under Overdrive). False, with a dry
 *  click, when the rack holds fewer. */
function spend(g: Game, n = 1): boolean {
  if (freeShots > 0) {
    freeShots -= 1;
    g.shots += 1;
    return true;
  }
  const free = g.overdriveT > 0 || boostLevel(g, 'overdrive') > 0;
  if (!free && g.ammo < n) {
    g.events.push({ kind: 'dry' });
    cue(g, 'gun.dry', g.map.carrier.x, g.map.carrier.y);
    return false;
  }
  if (!free) g.ammo -= n;
  g.shots += 1;
  return true;
}

/** A tagged shell bursts: a flak cloud, a vortex, fragments or a
 *  thermobaric blast where it went off. */
function burstWeapon(g: Game, w: Weapon, x: number, y: number): void {
  const k = w.level - 1;
  if (w.id === 'flak') {
    addField(g, 'flak', x, y, AB.flak.radius[k], AB.flak.time[k], w.level);
    cue(g, 'flak.burst', x, y);
  } else if (w.id === 'well') {
    addField(g, 'well', x, y, AB.well.radius[k], AB.well.time[k], w.level);
    cue(g, 'well.open', x, y);
  } else if (w.id === 'shrapnel') {
    cue(g, 'shrapnel.burst', x, y);
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
    cue(g, 'thermo.burst', x, y);
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
  cue(g, 'scatter.blast', c.x, c.y);
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
  cue(g, 'blade.throw', c.x, c.y);
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
      if (b.back) {
        b.home = true;
        cue(g, 'blade.catch', b.x, b.y);
      }
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
      cue(g, 'blade.hit', th.x, th.y);
      damageThreat(g, th, AB.boomerang.damage[k]);
    }
  }
  g.blades = g.blades.filter((b) => !b.home);
}

/** Frigate Escort: the frigates sail in along a shipping lane to stations at
 *  its edge, fire on their own, and sail off down the lane when the weapon is
 *  spent or another takes over. */
function launchEscorts(g: Game, level: number): void {
  const want = AB.frigate.ships[level - 1];
  g.escorts = g.escorts.filter((e) => !e.leaving);
  if (g.escorts.length < want) cue(g, 'frigate.arrive', 0, VIEW.height / 2, { vx: AB.frigate.speed });
  const stations = escortStations(g, want);
  for (let i = 0; i < want; i++) {
    const st = stations[i];
    const p = laneAt(g.map.channels[st.lane], st.d, st.lat);
    const e = g.escorts[i];
    if (e && e.lane === st.lane) {
      Object.assign(e, { sx: p.x, sy: p.y, sd: st.d, slat: st.lat });
    } else if (!e) {
      // In line astern from the lane's entry: a hull and its wake run ~210
      // long, so ships start 260 apart and never touch.
      const d = -80 - i * 260;
      const at = laneAt(g.map.channels[st.lane], d, st.lat);
      g.escorts.push({ id: g.nextId++, x: at.x, y: at.y, sx: p.x, sy: p.y, fireT: 0.5 + i * 0.2, leaving: false, aim: 0, lane: st.lane, d, lat: st.lat, sd: st.d, slat: st.lat, heading: Math.atan2(at.ty, at.tx) });
    }
  }
}

/** A station keeps this clear of the carrier, and frigates on one edge of a
 *  lane this far apart along it. */
const ESCORT_CARRIER_CLEAR = 200;
const ESCORT_GAP = 280;
const ESCORT_GAP_MIN = 180;
/** How fast a frigate turns (rad/s): smoothly round a bend at its speed. */
const ESCORT_TURN = 2.6;

/** How far across the lane a frigate may sit at distance d: its whole hull
 *  (76 either way along, 13 across) inside the lane, wherever the hull
 *  reaches and a little ahead, so it moves in before a lock or a narrows
 *  (it can't side-step faster than it sails). */
function escortLatMax(ch: Channel, d: number, ahead = 0): number {
  let hw = Infinity;
  for (let k = d - 80 + Math.min(0, ahead); k <= d + 80 + Math.max(0, ahead); k += 20) hw = Math.min(hw, laneHalfWidth(ch, k));
  return Math.max(0, Math.min(hw * 0.85, hw - 20));
}

/** Pick each frigate's lane and station: on the lane's edge, on screen, in a
 *  stretch wide enough to sit beside the convoy, clear of the carrier and of
 *  the other frigates. The first one in takes the furthest station. */
function escortStations(g: Game, n: number): { lane: number; d: number; lat: number }[] {
  const chans = g.map.channels;
  const usable = chans.map((_, i) => i).filter((i) => !chans[i].tide && !chans[i].vip);
  const lanes = usable.length ? usable : chans.map((_, i) => i);
  const c = g.map.carrier;
  // The first one in takes the furthest station, so none sails through another.
  const fracs = n >= 3 ? [0.62, 0.46, 0.3] : [0.62, 0.3];
  const taken: { lane: number; d: number; lat: number; x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const lane = lanes[i % lanes.length];
    const ch = chans[lane];
    // The lane's stretch on screen.
    const L = laneLength(ch);
    let d0 = Infinity;
    let d1 = -Infinity;
    for (let d = 0; d <= L; d += 20) {
      const p = lanePoint(ch, d);
      if (p.x > 90 && p.x < VIEW.width - 90 && p.y > 60 && p.y < VIEW.height - 60) {
        d0 = Math.min(d0, d);
        d1 = Math.max(d1, d);
      }
    }
    if (d0 > d1) {
      d0 = 0;
      d1 = L;
    }
    // A short stretch: spread out to its ends.
    const want = (d1 - d0 < 600 && n >= 3 ? [0.96, 0.5, 0.04] : fracs)[i % fracs.length];
    const side = i % 2 ? 1 : -1;
    // Candidates nearest the wanted spot first, on the wanted edge first.
    const cands: { d: number; lat: number; cost: number }[] = [];
    for (let u = 0.04; u <= 0.96; u += 0.02) {
      const d = d0 + (d1 - d0) * u;
      const hw = laneHalfWidth(ch, d);
      if (hw < 70) continue; // too narrow to sit beside the convoy
      for (const sgn of [side, -side]) cands.push({ d, lat: sgn * escortLatMax(ch, d), cost: Math.abs(u - want) + (sgn === side ? 0 : 0.25) });
    }
    cands.sort((a, b) => a.cost - b.cost);
    const ok = (d: number, lat: number, gap: number) => {
      const p = laneAt(ch, d, lat);
      if (Math.hypot(p.x - c.x, p.y - c.y) < ESCORT_CARRIER_CLEAR) return false;
      return taken.every((t) => (t.lane === lane && Math.sign(t.lat) === Math.sign(lat) ? Math.abs(t.d - d) >= gap : Math.hypot(t.x - p.x, t.y - p.y) >= 190));
    };
    // Well apart if there is room; closer (still clear of each other) in a
    // short basin.
    const pick =
      cands.find((k) => ok(k.d, k.lat, ESCORT_GAP)) ??
      cands.find((k) => ok(k.d, k.lat, ESCORT_GAP_MIN)) ??
      cands[0] ?? { d: d0 + (d1 - d0) * want, lat: side * escortLatMax(ch, d0 + (d1 - d0) * want) };
    const p = laneAt(ch, pick.d, pick.lat);
    taken.push({ lane, d: pick.d, lat: pick.lat, x: p.x, y: p.y });
  }
  return taken.map(({ lane, d, lat }) => ({ lane, d, lat }));
}

/** Where a frigate wants to sit across the lane at distance d: its station's
 *  edge, but midstream (or the other edge) where that edge runs past the
 *  carrier, and never outside the lane where it narrows. */
function escortLat(g: Game, e: Escort, ch: Channel, d: number, ahead: number): number {
  const max = escortLatMax(ch, d, ahead);
  let lat = clamp(e.slat, -max, max);
  const c = g.map.carrier;
  const p = laneAt(ch, d, lat);
  if (Math.hypot(p.x - c.x, p.y - c.y) < 170) {
    for (const alt of [0, -lat]) {
      const q = laneAt(ch, d, alt);
      if (Math.hypot(q.x - c.x, q.y - c.y) >= 170) return alt;
    }
  }
  return lat;
}

function updateEscorts(g: Game, dt: number): void {
  if (!g.escorts.length) return;
  const on = held(g, 'frigate');
  if (!on && g.escorts.some((e) => !e.leaving)) cue(g, 'frigate.leave', VIEW.width * 0.6, VIEW.height / 2, { vx: AB.frigate.speed });
  for (const e of g.escorts) {
    if (!on) e.leaving = true;
    const ch = g.map.channels[e.lane];
    // Off down the lane.
    const end = laneLength(ch) + 260;
    const goal = e.leaving ? end : e.sd;
    const step = AB.frigate.speed * dt;
    const before = e.d;
    e.d = goal > e.d ? Math.min(goal, e.d + step) : Math.max(goal, e.d - step);
    // Line astern: never closer than a hull and its wake to a frigate ahead
    // on its own line (through a narrows they all fall into one file).
    const dir = Math.sign(e.d - before);
    if (dir) {
      const single = escortLatMax(ch, before, dir * 260) < 34;
      for (const o of g.escorts) {
        if (o === e || o.lane !== e.lane || (!single && Math.abs(o.lat - e.lat) >= 60)) continue;
        const gap = (o.d - before) * dir;
        if (gap > 0 && gap < 400) e.d = dir > 0 ? Math.min(e.d, Math.max(before, o.d - 190)) : Math.max(e.d, Math.min(before, o.d + 190));
      }
    }
    // Across the lane: steer toward where it wants to be, no faster than a
    // ship turns, but always inside the lane where it narrows.
    // Look ahead the way it is sailing, no further than it is going.
    const ahead = clamp(goal - e.d, -260, 260);
    const want = escortLat(g, e, ch, e.d, ahead);
    const lmax = escortLatMax(ch, e.d, ahead);
    const dl = clamp(want - e.lat, -AB.frigate.speed * 0.45 * dt, AB.frigate.speed * 0.45 * dt);
    e.lat = clamp(e.lat + dl, -lmax, lmax);
    const p = laneAt(ch, e.d, e.lat);
    const moved = e.d - before;
    // Heading: the lane's, turned a little by any sideways drift (at most
    // ~24°, a ship steering across, never crabbing sideways).
    const aim = Math.atan2(p.ty, p.tx) + Math.atan2(dl, Math.max(step, 1e-6)) * Math.sign(moved);
    const turn = ESCORT_TURN * dt;
    e.heading += clamp(angleDiff(aim, e.heading), -turn, turn);
    e.x = p.x;
    e.y = p.y;
    // Round 6 cycle 5: they used to hold fire until on station, so the far
    // frigate spent ~4.6 s of the 15 sailing in silent; now they open up as
    // soon as they are on screen.
    if (e.leaving || !on || e.x < 20 || e.x > VIEW.width - 20 || e.y < 20 || e.y > VIEW.height - 20) continue;
    e.fireT -= dt;
    if (e.fireT > 0) continue;
    // The nearest threat in reach that still needs a shot.
    // A Lure Beacon in reach draws its fire first (the enemy build).
    const target = lured(g, e.x, e.y, AB.frigate.range, g.threats
      .filter((t) => !t.dead && !isStructure(t.kind) && dist(t.x, t.y, e.x, e.y) <= AB.frigate.range && assigned(g, t.id) < t.hp)
      .sort((a, b) => dist(a.x, a.y, e.x, e.y) - dist(b.x, b.y, e.x, e.y))[0]);
    if (!target) {
      e.fireT = 0.1;
      continue;
    }
    e.fireT = AB.frigate.gap[on.level - 1];
    e.aim = Math.atan2(target.y - e.y, target.x - e.x);
    // The forward turret.
    const mx = e.x + Math.cos(e.heading) * 30;
    const my = e.y + Math.sin(e.heading) * 30;
    g.interceptors.push({ id: g.nextId++, x: mx, y: my, target: target.id, tx: target.x, ty: target.y, life: 0, src: 'gun' });
    addFx(g, 'launch', mx, my, { life: 0.3, r: 10 });
    cue(g, 'frigate.fire', mx, my);
  }
  g.escorts = g.escorts.filter((e) => !(e.leaving && e.d >= laneLength(g.map.channels[e.lane]) + 250));
}

/** Aegis Launchers (round 8 playtest: "all cargo ships get one interceptor
 *  missile that they can fire from their ship to hit a threat that is about
 *  to hit them… applied to all existing cargo ships and all that spawn while
 *  it is active"). While it is loaded every ship carries its own
 *  interceptors and fires one at a threat closing on it, in reach; at MAX
 *  (Bastion) a spent one reloads and the carrier has its own. When the
 *  weapon goes, so do they. */
function updateAegis(g: Game, dt: number): void {
  const w = held(g, 'aegis');
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
        cue(g, 'aegis.reload', x, y);
      }
    }
    if (a.ammo < 1) return a;
    const target = lured(g, x, y, reach, g.threats
      .filter((t) => !t.dead && isTarget(t) && dist(t.x, t.y, x, y) <= reach && assigned(g, t.id) < t.hp)
      .sort((p, q) => dist(p.x, p.y, x, y) - dist(q.x, q.y, x, y))[0]);
    if (!target) return a;
    a.ammo -= 1;
    g.interceptors.push({ id: g.nextId++, x, y: y - 8, target: target.id, tx: target.x, ty: target.y, life: 0, src: 'gun' });
    addFx(g, 'launch', x, y - 8, { life: 0.3, r: 8 });
    cue(g, 'aegis.launch', x, y);
    return a;
  };
  // What is about to hit a hull: a threat aimed at it, or an aircraft over it.
  const aircraft = (t: Threat) => isPlaneKind(t.kind);
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
  const target = lured(g, c.x, c.y, g.stats.pdRange, g.threats
    .filter((t) => !t.dead && !isStructure(t.kind) && dist(t.x, t.y, c.x, c.y) <= g.stats.pdRange && assigned(g, t.id) < t.hp)
    .sort((a, b) => dist(a.x, a.y, c.x, c.y) - dist(b.x, b.y, c.x, c.y))[0]);
  if (!target) {
    g.pdT = 0.1;
    return;
  }
  g.pdT = g.stats.pdGap;
  // From the carrier's bow end nearer the threat, so it reads as its own gun.
  const mx = c.x + Math.sign(target.x - c.x || 1) * CARRIER.halfLength * 0.6;
  g.interceptors.push({ id: g.nextId++, x: mx, y: c.y, target: target.id, tx: target.x, ty: target.y, life: 0, src: 'gun' });
  addFx(g, 'launch', mx, c.y, { life: 0.3, r: 8 });
  cue(g, 'pd.fire', mx, c.y);
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
  cue(g, 'repair', g.map.carrier.x, g.map.carrier.y);
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
  cue(g, 'seeker.launch', c.x, c.y);
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
  cue(g, 'jet.flyby', dir > 0 ? -80 : VIEW.width + 80, y, { vx: dir * AB.airstrike.speed });
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
    cue(g, 'napalm.burst', b.x, b.y);
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
  cue(g, 'rail.beam', c.x, c.y);
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
    cue(g, 'tesla.arc', t.x, t.y);
    const tx = t.x;
    const ty = t.y;
    damageThreat(g, t, 1);
    teslaArc(g, level, tx, ty, t.id, depth - 1, struck);
  }
}

// ---------------------------------------------------------------------------
// The weapons plan, phase 1 (docs/design/v3-weapons-plan.md): Charge Lance,
// Laser Cutter and Grapnel are pressed, not tapped (press / pressMove /
// release, recorded in the play log like taps); Chain Shot, Fire Control and
// Cadence Gun are taps with a rule. With any of them, a plain tap is a plain
// shot, so the gun is never helpless.

/** Focus (a boost): the holding finger goes down or lifts. While it is
 *  down and the bank lasts, time slows; the finger itself fires nothing
 *  (the player: "one finger down and then tap with the other one"). */
export function focusHold(g: Game, down: boolean): void {
  if (g.phase !== 'wave') return;
  g.finger = down;
  g.focusing = down && g.boost?.id === 'focus' && g.boost.bank > 0;
}

/** A finger down on the water. With a gesture weapon loaded it starts a
 *  press; otherwise it does nothing (the UI taps instead). */
export function press(g: Game, x: number, y: number, radius: number): void {
  if (g.phase !== 'wave') return;
  const gesture = gestureOf(g.weapon?.id);
  if (!gesture) return;
  g.press = { x0: x, y0: y, x, y, t0: g.t, radius, mode: 'pending', hook: null, cut: [], cutLen: 0, vx: 0, vy: 0, smacked: {} };
  if (gesture === 'drag') {
    const w = g.weapon!;
    const c = g.map.carrier;
    // Hook the threat under the finger (structures are too big to swing).
    const th = g.threats
      .filter((t) => !t.dead && !t.held && !isStructure(t.kind) && dist(t.x, t.y, x, y) <= radius && dist(t.x, t.y, c.x, c.y) <= AB.grapnel.reach[w.level - 1])
      .sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y))[0];
    if (!th) return;
    // A pickup under the finger wins, as it would for a tap.
    if (g.pickups.some((p) => dist(p.x, p.y, x, y) <= radius + PICKUPS.radius && dist(p.x, p.y, x, y) < dist(th.x, th.y, x, y))) return;
    if (!spend(g)) {
      g.press.mode = 'dry';
      g.taps.dry += 1;
      return;
    }
    th.held = true;
    g.press.mode = 'hook';
    g.press.hook = th.id;
    g.taps.fire += 1;
    addFx(g, 'chain', c.x, c.y - 6, { life: 0.25, x2: th.x, y2: th.y });
    cue(g, 'grapnel.hook', th.x, th.y);
  }
}

/** The finger moves (the UI sends a move at most once a step). */
export function pressMove(g: Game, x: number, y: number): void {
  const p = g.press;
  if (!p || g.phase !== 'wave') return;
  const px = p.x;
  const py = p.y;
  p.x = x;
  p.y = y;
  const w = g.weapon;
  if (!w) return;
  if (w.id === 'cutter') {
    if (p.mode === 'pending' && dist(p.x0, p.y0, x, y) >= AB.cutter.start) {
      if (!spend(g)) {
        p.mode = 'dry';
        g.taps.dry += 1;
        return;
      }
      p.mode = 'swipe';
      g.taps.fire += 1;
      cue(g, 'cutter.swipe', x, y);
      cutAlong(g, w, p, p.x0, p.y0, x, y);
    } else if (p.mode === 'swipe') {
      cutAlong(g, w, p, px, py, x, y);
    }
  }
}

/** The finger lifts. A press that never became a gesture is a tap. */
export function release(g: Game, x: number, y: number, radius: number): TapResult | null {
  g.foe.byTap = true;
  try {
    return releaseNow(g, x, y, radius);
  } finally {
    g.foe.byTap = false;
  }
}

function releaseNow(g: Game, x: number, y: number, radius: number): TapResult | null {
  const p = g.press;
  if (!p) return null;
  g.press = null;
  if (g.phase !== 'wave') return null;
  p.x = x;
  p.y = y;
  if (p.mode === 'pending') {
    const w = g.weapon;
    // Charge Lance: held long enough to charge, let go: fire what it holds.
    if (w?.id === 'lance' && g.t - p.t0 >= AB.lance.tapHold) return fireLance(g, w, p);
    return tap(g, p.x0, p.y0, radius);
  }
  if (p.mode === 'charge' && g.weapon?.id === 'lance') return fireLance(g, g.weapon, p);
  if (p.mode === 'hook') letGo(g, p);
  return null;
}

/** Seconds of charge a press holds (Charge Lance; level 2 charges faster). */
export function lanceCharge(g: Game, p: Press, w: Weapon): number {
  return Math.max(0, g.t - p.t0) * AB.lance.rate[w.level - 1];
}

function fireLance(g: Game, w: Weapon, p: Press): TapResult {
  const ch = lanceCharge(g, p, w);
  if (ch < AB.lance.half) {
    // Not charged to half: a plain shot where the finger let go.
    return tap(g, p.x, p.y, p.radius);
  }
  if (!spend(g)) {
    g.taps.dry += 1;
    return 'dry';
  }
  g.taps.fire += 1;
  const c = g.map.carrier;
  const near = g.threats.filter((t) => !t.dead && dist(t.x, t.y, p.x, p.y) <= p.radius).sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y))[0];
  const ax = near ? near.x : p.x;
  const ay = near ? near.y : p.y;
  const len0 = dist(c.x, c.y, ax, ay) || 1;
  const ux = (ax - c.x) / len0;
  const uy = (ay - c.y) / len0;
  const ang = Math.atan2(uy, ux);
  if (ch >= AB.lance.full) {
    // The lance: everything in line, to the edge of the sea.
    const len = entryDistance(c.x, c.y, ux, uy);
    rayHits(g, c.x, c.y, ang, len, AB.lance.width, true, AB.lance.fullDmg);
    addFx(g, 'lance', c.x, c.y - 6, { life: 0.5, x2: c.x + ux * len, y2: c.y + uy * len, r: AB.lance.width * 1.6 });
    cue(g, 'lance.full', c.x, c.y);
    if (w.level >= ABILITY_MAX) {
      g.fields.push({ kind: 'sun', x1: c.x, y1: c.y, x2: c.x + ux * len, y2: c.y + uy * len, hw: AB.lance.width, t: 0, life: AB.lance.burn, tick: AB.airstrike.burnTick, level: w.level });
    }
    return 'fire';
  }
  // Half charge: a bolt into the first threat on the line (from level 2,
  // through everything on it).
  const end = rayHits(g, c.x, c.y, ang, entryDistance(c.x, c.y, ux, uy), AB.lance.width, w.level >= 2, AB.lance.halfDmg);
  addFx(g, 'lance', c.x, c.y - 6, { life: 0.3, x2: end.x, y2: end.y, r: AB.lance.width * 0.8 });
  cue(g, 'lance.half', c.x, c.y);
  return 'fire';
}

/** Laser Cutter: cut the stretch from (x1, y1) to (x2, y2), as much of it as
 *  this swipe has left. */
function cutAlong(g: Game, w: Weapon, p: Press, x1: number, y1: number, x2: number, y2: number): void {
  const left = AB.cutter.length[w.level - 1] - p.cutLen;
  if (left <= 0) return;
  let seg = dist(x1, y1, x2, y2);
  if (seg < 1e-6) return;
  if (seg > left) {
    x2 = x1 + ((x2 - x1) * left) / seg;
    y2 = y1 + ((y2 - y1) * left) / seg;
    seg = left;
  }
  p.cutLen += seg;
  const vx = x2 - x1;
  const vy = y2 - y1;
  const l2 = vx * vx + vy * vy;
  for (const th of [...g.threats]) {
    if (th.dead || p.cut.includes(th.id)) continue;
    const t = clamp(((th.x - x1) * vx + (th.y - y1) * vy) / l2, 0, 1);
    if (dist(th.x, th.y, x1 + vx * t, y1 + vy * t) > AB.cutter.width) continue;
    p.cut.push(th.id);
    damageThreat(g, th, AB.cutter.damage);
  }
  addFx(g, 'cut', x1, y1, { life: 0.45, x2, y2, r: AB.cutter.width });
  if (w.level >= ABILITY_MAX) g.fields.push({ kind: 'laser', x1, y1, x2, y2, hw: AB.cutter.width * 0.7, t: 0, life: AB.cutter.lit, tick: 0, level: w.level });
}

/** Each step a press is down: a Charge Lance press becomes a charge once
 *  held past a tap; a Grapnel ball follows the finger and smacks what it
 *  touches. */
function updatePress(g: Game, dt: number): void {
  const p = g.press;
  if (!p) return;
  const w = g.weapon;
  // The weapon ran out under the finger: a hook lets go, anything else
  // just ends (the lift does nothing).
  if (!w || !gestureOf(w.id)) {
    if (p.mode === 'hook') letGo(g, p);
    g.press = null;
    return;
  }
  if (w.id === 'lance' && p.mode === 'pending' && g.t - p.t0 >= AB.lance.tapHold) {
    p.mode = 'charge';
    cue(g, 'lance.charge', g.map.carrier.x, g.map.carrier.y);
  }
  if (p.mode !== 'hook') return;
  const th = g.threats.find((t) => t.id === p.hook && !t.dead);
  if (!th) {
    g.press = null;
    return;
  }
  // The ball chases the finger as fast as the cable can swing it.
  const d = dist(th.x, th.y, p.x, p.y);
  const stepLen = Math.min(d, AB.grapnel.speed * dt);
  const ox = th.x;
  const oy = th.y;
  if (d > 1e-6) {
    th.x += ((p.x - th.x) / d) * stepLen;
    th.y += ((p.y - th.y) / d) * stepLen;
  }
  // Its velocity is the fling when the finger lets go (eased, so a last
  // jitter doesn't throw it the wrong way).
  p.vx = p.vx * 0.6 + ((th.x - ox) / dt) * 0.4;
  p.vy = p.vy * 0.6 + ((th.y - oy) / dt) * 0.4;
  th.vx = p.vx;
  th.vy = p.vy;
  if (Math.hypot(th.vx, th.vy) > 30) th.heading = Math.atan2(th.vy, th.vx);
  for (const o of [...g.threats]) {
    if (o.dead || o === th || dist(o.x, o.y, th.x, th.y) > AB.grapnel.smackR) continue;
    if (g.t - (p.smacked[o.id] ?? -9) < AB.grapnel.again) continue;
    p.smacked[o.id] = g.t;
    damageThreat(g, o, AB.grapnel.smack);
    addFx(g, 'burst', o.x, o.y, { life: 0.3, r: AB.grapnel.smackR });
    cue(g, 'grapnel.smack', o.x, o.y);
  }
  if (g.t - p.t0 >= AB.grapnel.hold) {
    letGo(g, p);
    g.press = null;
  }
}

/** Grapnel: let the ball go; it flies on, then bursts. */
function letGo(g: Game, p: Press): void {
  const th = g.threats.find((t) => t.id === p.hook && !t.dead);
  if (!th) return;
  const sp = Math.hypot(p.vx, p.vy);
  const cap = AB.grapnel.speed;
  const k = sp > cap ? cap / sp : 1;
  g.flings.push({ id: th.id, vx: p.vx * k, vy: p.vy * k, t: 0, level: g.weapon?.level ?? 1 });
  cue(g, 'grapnel.fling', th.x, th.y);
}

function updateFlings(g: Game, dt: number): void {
  for (const f of g.flings) {
    const th = g.threats.find((t) => t.id === f.id && !t.dead);
    f.t += dt;
    if (!th) {
      f.t = Infinity;
      continue;
    }
    th.x = clamp(th.x + f.vx * dt, 0, VIEW.width);
    th.y = clamp(th.y + f.vy * dt, 0, VIEW.height);
    if (f.t < AB.grapnel.fly) continue;
    const k = f.level - 1;
    const r = AB.grapnel.burstR[k];
    const bx = th.x;
    const by = th.y;
    th.held = false;
    addFx(g, f.level >= ABILITY_MAX ? 'thermo' : 'burst', bx, by, { life: 0.5, r });
    cue(g, 'grapnel.burst', bx, by);
    for (const o of [...g.threats]) if (!o.dead && dist(o.x, o.y, bx, by) <= r) damageThreat(g, o, AB.grapnel.burst[k]);
    f.t = Infinity;
  }
  g.flings = g.flings.filter((f) => f.t !== Infinity);
}

/** Cadence Gun: where we are against the beat (seconds from the nearest
 *  beat, and that beat's number). Beats fall `period` s apart from loading. */
export function beatClock(g: Game, w: Weapon): { off: number; n: number; phase: number } {
  const P = AB.cadence.period;
  const since = g.t - (w.t0 ?? g.t);
  const n = Math.round(since / P);
  return { off: Math.abs(since - n * P), n, phase: (since % P) / P };
}

function cadenceTap(g: Game, w: Weapon, x: number, y: number): TapResult | null {
  const b = beatClock(g, w);
  if (b.n < 1 || b.off > AB.cadence.window[w.level - 1]) return null;
  if (!AB.cadence.free && !spend(g)) return 'dry';
  // On the beat: a piercing shot through everything on the line.
  const c = g.map.carrier;
  const len0 = dist(c.x, c.y, x, y) || 1;
  const ux = (x - c.x) / len0;
  const uy = (y - c.y) / len0;
  const len = entryDistance(c.x, c.y, ux, uy);
  // War Drum (Test Lab round 4, the player: "have the third upgrade be a
  // little bit more powerful. Maybe we could blow up the platforms and
  // vehicles"): on the beat it wrecks them on its line in one hit.
  if (w.level >= ABILITY_MAX) wreckLine(g, c.x, c.y, ux, uy, len, AB.cadence.width);
  rayHits(g, c.x, c.y, Math.atan2(uy, ux), len, AB.cadence.width, true, AB.cadence.damage);
  addFx(g, 'beam', c.x, c.y - 6, { life: 0.3, x2: c.x + ux * len, y2: c.y + uy * len, r: AB.cadence.width });
  cue(g, 'cadence.hit', c.x, c.y);
  if (b.n !== g.beat.last) {
    g.beat.run = b.n === g.beat.last + 1 ? g.beat.run + 1 : 1;
    g.beat.last = b.n;
    if (w.level >= ABILITY_MAX && g.beat.run >= AB.cadence.run) g.beat.armed = true;
  }
  return 'fire';
}

/** War Drum's beat shot: every platform and vehicle within `width` of the
 *  line from (x, y) along (ux, uy), `len` long, is destroyed outright (the
 *  kinds in AB.cadence.wrecks: a siege gun only while it is up, a torpedo
 *  sub only surfaced, as they are only targets then), and so is every launch
 *  truck or sub up within `raider` px of it. */
function wreckLine(g: Game, x: number, y: number, ux: number, uy: number, len: number, width: number): void {
  const on = (px: number, py: number, w: number) => {
    const along = (px - x) * ux + (py - y) * uy;
    return along >= 0 && along <= len && Math.abs((px - x) * uy - (py - y) * ux) <= w;
  };
  const wrecks: readonly ThreatKind[] = AB.cadence.wrecks;
  for (const th of [...g.threats]) {
    if (th.dead || !wrecks.includes(th.kind) || !on(th.x, th.y, width)) continue;
    addFx(g, 'boom', th.x, th.y, { life: 0.9, r: 48 });
    damageThreat(g, th, th.hp);
  }
  for (const r of g.raiders) if (raiderUp(r) && on(r.x, r.y, AB.cadence.raider)) knockOut(g, r);
}

/** The beat itself: a cue on each one, a missed beat breaks the run, and
 *  War Drum's broadside goes on the beat after the run. */
function updateBeat(g: Game): void {
  const w = g.weapon;
  if (!w || w.id !== 'cadence') return;
  const P = AB.cadence.period;
  const n = Math.floor((g.t - (w.t0 ?? g.t)) / P);
  if (n < 1 || n === g.beat.seen) return;
  g.beat.seen = n;
  const c = g.map.carrier;
  cue(g, 'cadence.beat', c.x, c.y);
  addFx(g, 'beat', c.x, c.y, { life: 0.3, r: 1 });
  if (n > g.beat.last + 1) g.beat.run = 0;
  if (g.beat.armed && n > g.beat.last) {
    g.beat.armed = false;
    g.beat.run = 0;
    const targets = worthShooting(g, g.threats).filter((t) => !t.dead).sort((a, b) => timeToImpact(g, a) - timeToImpact(g, b)).slice(0, AB.cadence.broadside);
    for (const t of targets) g.interceptors.push({ id: g.nextId++, x: c.x, y: c.y - 6, target: t.id, tx: t.x, ty: t.y, life: 0, src: 'gun', dmg: 2 });
    if (targets.length) cue(g, 'salvo.fire', c.x, c.y);
  }
}

// ---------------------------------------------------------------------------
// The weapons plan, phase 2: the passives. Your gun stays the plain gun;
// these work on their own while loaded and wind down when it runs out.

function updatePassives(g: Game, dt: number): void {
  g.passiveT -= dt;
  g.passiveT2 -= dt;
  const c = g.map.carrier;
  // Each passive runs on its own hand's clock (Dual Wield: two at once).
  const timer = (w: Weapon) => (w === g.weapon2 ? 'passiveT2' : 'passiveT');
  // ---- Drone Screen: a drone off the carrier deck every gap.
  const dw = held(g, 'droneScreen');
  if (dw && g[timer(dw)] <= 0) {
    g[timer(dw)] += AB.droneScreen.gap[dw.level - 1];
    g.wings.push({ id: g.nextId++, x: c.x, y: c.y - 8, heading: -Math.PI / 2, target: null, life: AB.droneScreen.life });
    cue(g, 'screen.launch', c.x, c.y);
  }
  for (const d of g.wings) {
    d.life -= dt;
    let th = d.target === null ? undefined : g.threats.find((t) => t.id === d.target && !t.dead);
    // A Lure Beacon that comes up turns a drone already on its way.
    const lure = lureIn(g, d.x, d.y);
    if (lure && th !== lure) {
      th = lure;
      d.target = lure.id;
    }
    if (!th) {
      // The threat closest to hitting a hull that no other drone is after.
      const claimed = new Set(g.wings.map((o) => o.target));
      th = lureIn(g, d.x, d.y) ?? g.threats.filter((t) => !t.dead && !isStructure(t.kind) && t.x > 0 && t.x < VIEW.width && t.y > 0 && t.y < VIEW.height && !claimed.has(t.id)).sort((a, b) => timeToImpact(g, a) - timeToImpact(g, b))[0];
      d.target = th ? th.id : null;
    }
    if (!th) {
      d.y -= AB.droneScreen.speed * 0.4 * dt;
      continue;
    }
    const dd = dist(d.x, d.y, th.x, th.y);
    if (dd <= AB.droneScreen.contact) {
      const bx = th.x;
      const by = th.y;
      damageThreat(g, th, AB.droneScreen.damage);
      const r = AB.droneScreen.burst[(dw?.level ?? 1) - 1];
      if (r > 0) for (const o of [...g.threats]) if (!o.dead && dist(o.x, o.y, bx, by) <= r) damageThreat(g, o, 1);
      addFx(g, 'burst', bx, by, { life: 0.3, r: Math.max(18, r) });
      d.life = 0;
      continue;
    }
    d.heading = Math.atan2(th.y - d.y, th.x - d.x);
    const stepLen = Math.min(dd, AB.droneScreen.speed * dt);
    d.x += Math.cos(d.heading) * stepLen;
    d.y += Math.sin(d.heading) * stepLen;
  }
  g.wings = g.wings.filter((d) => d.life > 0 && d.y > -40);
  // ---- Gunship Pair: hover over the convoy, rocket the thickest cluster.
  const gw = held(g, 'gunships');
  if (!gw) for (const h of g.helis) h.leaving = true;
  const mid = g.ships.length ? { x: g.ships.reduce((a, s) => a + s.x, 0) / g.ships.length, y: g.ships.reduce((a, s) => a + s.y, 0) / g.ships.length } : { x: c.x, y: c.y - 120 };
  for (const h of g.helis) {
    const n = g.helis.filter((o) => !o.leaving).length;
    const want = h.leaving
      ? { x: h.x < VIEW.width / 2 ? -200 : VIEW.width + 200, y: h.y }
      : { x: clamp(mid.x + (h.slot - (n - 1) / 2) * AB.gunships.spread * 1.8, 60, VIEW.width - 60), y: clamp(mid.y - AB.gunships.above, 60, VIEW.height - 60) };
    flyHeli(g, h, want, dt);
    if (h.leaving) continue;
    h.fireT -= dt;
    if (h.fireT > 0) continue;
    h.fireT += AB.gunships.gap[(gw?.level ?? 1) - 1];
    const near = g.threats.filter((t) => !t.dead && !isStructure(t.kind) && dist(t.x, t.y, h.x, h.y) <= AB.gunships.reach);
    let best: Threat | null = null;
    let most = 0;
    for (const t of near) {
      const m = near.filter((o) => dist(o.x, o.y, t.x, t.y) <= AB.gunships.blast).length;
      if (m > most) {
        most = m;
        best = t;
      }
    }
    // A Lure Beacon in reach, or by what they'd fire at, draws the rockets.
    const pick = lured(g, h.x, h.y, AB.gunships.reach, best ?? undefined);
    if (!pick) continue;
    launchHellfire(g, h.x, h.y, h.heading, pick, AB.gunships.damage[(gw?.level ?? 1) - 1]);
  }
  g.helis = g.helis.filter((h) => !h.leaving || (h.x > -150 && h.x < VIEW.width + 150));
  updateHellfires(g, dt);
  // ---- Bomber Wing: a pass at the shore every gap.
  const bw = held(g, 'bomberWing');
  if (bw && g[timer(bw)] <= 0) {
    const k = bw.level - 1;
    g[timer(bw)] += AB.bomberWing.gap[k];
    callSorties(g, AB.bomberWing.targets[k], AB.bomberWing.quiet[k], k === 2);
  }
  for (const b of g.sorties) {
    b.x += b.vx * dt;
    if (!b.hit && (b.vx > 0 ? b.x >= b.tx : b.x <= b.tx)) {
      b.hit = true;
      bombTarget(g, b);
    }
  }
  g.sorties = g.sorties.filter((b) => b.x > -300 && b.x < VIEW.width + 300);
  // ---- Orbital Strike: lock on (laser dots), then the beam.
  if (g.orbital) {
    g.orbital.t += dt;
    const th = g.threats.find((t) => t.id === g.orbital!.id && !t.dead);
    if (!th) g.orbital = null;
    else if (g.orbital.t >= AB.orbital.lock) {
      const bx = th.x;
      const by = th.y;
      damageThreat(g, th, AB.orbital.damage);
      for (const o of [...g.threats]) if (!o.dead && o !== th && dist(o.x, o.y, bx, by) <= AB.orbital.splash) damageThreat(g, o, 1);
      addFx(g, 'orbital', bx, by, { life: 0.45, r: AB.orbital.splash * 0.8 });
      cue(g, 'orbital.beam', th.x, th.y);
      // Sky Spear: the beam lingers onto the next toughest.
      const linger = g.orbital.second === false && (held(g, 'orbital')?.level ?? 0) >= ABILITY_MAX;
      g.orbital = null;
      if (linger) {
        const next = toughest(g, th.id);
        if (next) g.orbital = { id: next.id, t: AB.orbital.lock - AB.orbital.linger, second: true };
      }
    }
  }
  const ow = held(g, 'orbital');
  if (ow && g[timer(ow)] <= 0 && !g.orbital) {
    const th = toughest(g, -1);
    if (th) {
      g[timer(ow)] = AB.orbital.gap[ow.level - 1];
      g.orbital = { id: th.id, t: 0, second: false };
      cue(g, 'orbital.lock', th.x, th.y);
    }
  }
}

/** The toughest threat on screen (most hit points). Something that will hit
 *  a ship comes first; a structure (a rig, a generator, the Dreadnought) only
 *  when nothing else is up: its 10–40 hit points soaked every strike (build 2
 *  sweep). */
function toughest(g: Game, not: number): Threat | undefined {
  const lure = lureIn(g, 0, 0);
  if (lure && lure.id !== not) return lure;
  const up = g.threats.filter((t) => !t.dead && t.id !== not && t.x > 0 && t.x < VIEW.width && t.y > 0 && t.y < VIEW.height && !(t.kind === 'citadel' && shieldUp(g)));
  const order = (a: Threat, b: Threat) => b.hp - a.hp || timeToImpact(g, a) - timeToImpact(g, b);
  return up.filter((t) => !isStructure(t.kind)).sort(order)[0] ?? up.sort(order)[0];
}

/** A helicopter flies toward `want`: the nose turns toward where it is going
 *  first, it accelerates only as fast as it is facing that way, and it eases
 *  into the hover; hovering, it turns to face the nearest threat. */
function flyHeli(g: Game, h: Heli, want: Point, dt: number): void {
  const G = AB.gunships;
  const dx = want.x - h.x;
  const dy = want.y - h.y;
  const dd = Math.hypot(dx, dy);
  // Arrive: full speed far out, slowing over the last stretch.
  const speed = dd > 2 ? Math.min(G.speed, dd * G.arrive) : 0;
  const travel = Math.atan2(dy, dx);
  let face = h.heading;
  if (speed > G.speed * 0.25) face = travel;
  else {
    const th = g.threats.filter((t) => !t.dead && !isStructure(t.kind)).sort((a, b) => dist(a.x, a.y, h.x, h.y) - dist(b.x, b.y, h.x, h.y))[0];
    face = th && dist(th.x, th.y, h.x, h.y) <= G.reach * 1.5 ? Math.atan2(th.y - h.y, th.x - h.x) : -Math.PI / 2;
  }
  const turn = angleDiff(face, h.heading);
  h.heading += clamp(turn, -G.turn * dt, G.turn * dt);
  // Thrust follows the nose: a helicopter facing away barely moves off.
  const align = speed > 0 ? Math.max(0.15, Math.cos(angleDiff(travel, h.heading))) : 1;
  const wantVx = dd > 0 ? (dx / dd) * speed : 0;
  const wantVy = dd > 0 ? (dy / dd) * speed : 0;
  let ax = wantVx - h.vx;
  let ay = wantVy - h.vy;
  const most = G.accel * dt * align;
  const a = Math.hypot(ax, ay);
  if (a > most) {
    ax *= most / a;
    ay *= most / a;
  }
  h.vx += ax;
  h.vy += ay;
  h.x += h.vx * dt;
  h.y += h.vy * dt;
  // Lean into the acceleration: ahead (nose down) and to the side (bank).
  const full = G.accel * dt || 1;
  const fwd = (ax * Math.cos(h.heading) + ay * Math.sin(h.heading)) / full;
  const side = (-ax * Math.sin(h.heading) + ay * Math.cos(h.heading)) / full;
  const k = Math.min(1, dt * 5);
  h.lean += (clamp(fwd, -1, 1) - h.lean) * k;
  h.roll += (clamp(side, -1, 1) - h.roll) * k;
}

/** A Hellfire leaves the rail pointed at `target` (or a spot on the water),
 *  kicked at most HELLFIRE_KICK off that toward the helicopter's nose so the
 *  pair still splays a little, and homes on it. Test Lab round 1: launched
 *  along the nose, a target behind or beside the helicopter made it fly a
 *  loop first. */
export function launchHellfire(g: Game, x: number, y: number, heading: number, target: Threat | null, dmg: number, at?: Point): void {
  const tx = target ? target.x : at!.x;
  const ty = target ? target.y : at!.y;
  const want = Math.atan2(ty - y, tx - x);
  const aim = want + clamp(angleDiff(heading, want), -HELLFIRE_KICK, HELLFIRE_KICK);
  g.hellfires.push({ id: g.nextId++, x, y, heading: aim, target: target ? target.id : -1, tx, ty, t: 0, dmg, trail: [x, y] });
  cue(g, 'heli.rockets', x, y);
}

/** How far off its target a Hellfire may leave the rail (rad). */
const HELLFIRE_KICK = 0.35;

/** Homing that never orbits (Test Lab round 1: "sometimes it'll circle the
 *  entire thing"). A missile that turns at most `base` rad/s has a turning
 *  circle of radius speed/base; a target that sits inside that circle (closer
 *  than 2·radius·sin(error)) can't be reached, and the missile circles it.
 *  Turning at least HOMING_K·speed/distance keeps the circle's radius under
 *  a third of the distance left, so the target is never inside it and the
 *  nose always comes round onto it. Far out it is the missile's own turn. */
export function homingTurn(base: number, speed: number, d: number): number {
  return Math.max(base, (HOMING_K * speed) / Math.max(1, d));
}
const HOMING_K = 3;

function updateHellfires(g: Game, dt: number): void {
  const H = AB.gunships;
  for (const m of g.hellfires) {
    const th = m.target >= 0 ? g.threats.find((t) => t.id === m.target && !t.dead) : undefined;
    if (th) {
      m.tx = th.x;
      m.ty = th.y;
    }
    m.t += dt;
    // It curves onto where the target will be, turning harder the longer it
    // flies and the closer it gets (homingTurn: it can't circle it).
    const d = dist(m.x, m.y, m.tx, m.ty);
    const ahead = th ? d / H.missileSpeed : 0;
    const want = Math.atan2(m.ty + (th?.vy ?? 0) * ahead - m.y, m.tx + (th?.vx ?? 0) * ahead - m.x);
    const turn = homingTurn(H.missileTurn * (1 + m.t * 6), H.missileSpeed, d) * dt;
    m.heading += clamp(angleDiff(want, m.heading), -turn, turn);
    const stepLen = H.missileSpeed * dt;
    m.x += Math.cos(m.heading) * stepLen;
    m.y += Math.sin(m.heading) * stepLen;
    // Smoke: a point every few frames, the last eight.
    if (Math.floor(m.t / 0.025) !== Math.floor((m.t - dt) / 0.025)) {
      m.trail.push(m.x, m.y);
      if (m.trail.length > 16) m.trail.splice(0, 2);
    }
    if (dist(m.x, m.y, m.tx, m.ty) > stepLen + 14 && m.t < 1.4) continue;
    m.t = Infinity;
    addFx(g, 'burst', m.tx, m.ty, { life: 0.4, r: H.blast });
    cue(g, 'heli.hit', m.tx, m.ty);
    for (const o of [...g.threats]) if (!o.dead && dist(o.x, o.y, m.tx, m.ty) <= H.blast) damageThreat(g, o, m.dmg);
  }
  g.hellfires = g.hellfires.filter((m) => m.t !== Infinity);
}

function callGunships(g: Game, level: number): void {
  const want = AB.gunships.count[level - 1];
  g.helis = g.helis.filter((h) => !h.leaving);
  if (g.helis.length < want) cue(g, 'heli.arrive', 0, VIEW.height / 2);
  for (let i = g.helis.length; i < want; i++) {
    const left = i % 2 === 0;
    g.helis.push({ id: g.nextId++, x: left ? -120 : VIEW.width + 120, y: VIEW.height * 0.55, vx: left ? AB.gunships.speed : -AB.gunships.speed, vy: 0, slot: i, fireT: 0.6 + i * 0.35, heading: left ? 0 : Math.PI, lean: 0, roll: 0, leaving: false });
  }
  g.helis.forEach((h, i) => (h.slot = i));
}

/** Bomber Wing picks its targets: trucks on screen first, then the silos or
 *  tunnels with the most launches coming in the next `quiet` seconds. */
/** `subs`: Carpet Raid (MAX) also bombs a surfaced submarine. */
function callSorties(g: Game, n: number, quiet: number, subs = false): void {
  type Pick = { kind: Sortie['kind']; ref: number; x: number; y: number; score: number };
  const picks: Pick[] = [];
  for (const r of g.raiders) {
    if ((r.kind === 'sub' && !subs) || !raiderUp(r) || r.x < 0 || r.x > VIEW.width || r.y < 0 || r.y > VIEW.height) continue;
    picks.push({ kind: 'truck', ref: r.id, x: r.x, y: r.y, score: 100 + r.rounds.length + r.units.length });
  }
  const horizon = g.waveT + quiet;
  g.map.bases.forEach((b, i) => {
    if (g.baseDown[i] || (g.quietUntil[i] ?? 0) > g.t) return;
    const due = g.queue.filter((l) => l.base === i && l.at >= g.waveT && l.at <= horizon && l.kind !== 'strafer' && l.kind !== 'bomber').length;
    if (due > 0) picks.push({ kind: 'silo', ref: i, x: b.x, y: b.y, score: due });
  });
  g.raiderQueue.forEach((sp, i) => {
    if (sp.kind === 'sub' || sp.at < g.waveT || sp.at > horizon) return;
    const p = sp.path[0];
    picks.push({ kind: 'tunnel', ref: i, x: clamp(p.x, 30, VIEW.width - 30), y: clamp(p.y, 30, VIEW.height - 30), score: sp.units.reduce((a, u) => a + u.size, 0) });
  });
  // A Lure Beacon that's up draws the first pass, ahead of everything.
  const lure = lureIn(g, VIEW.width / 2, VIEW.height / 2);
  if (lure) picks.push({ kind: 'lure', ref: lure.id, x: lure.x, y: lure.y, score: Infinity });
  picks.sort((a, b) => b.score - a.score);
  const chosen = picks.slice(0, n);
  // A tunnel's truck is cancelled now (so a later pass can't pick it again).
  const tunnels = chosen.filter((p) => p.kind === 'tunnel').map((p) => g.raiderQueue[p.ref]);
  g.raiderQueue = g.raiderQueue.filter((sp) => !tunnels.includes(sp));
  for (const p of chosen) {
    const fromLeft = p.x > VIEW.width / 2;
    g.sorties.push({ id: g.nextId++, x: fromLeft ? -160 : VIEW.width + 160, y: p.y, vx: (fromLeft ? 1 : -1) * AB.bomberWing.speed, tx: p.x, ty: p.y, hit: false, kind: p.kind, ref: p.ref });
    if (p.kind === 'silo') g.quietUntil[p.ref] = Math.max(g.quietUntil[p.ref] ?? 0, g.t + quiet);
  }
  if (chosen.length) cue(g, 'sortie.pass', chosen[0].x, chosen[0].y);
}

function bombTarget(g: Game, b: Sortie): void {
  addFx(g, 'boom', b.tx, b.ty, { life: 0.9, r: 48 });
  cue(g, 'sortie.bomb', b.tx, b.ty);
  if (b.kind === 'truck') {
    const r = g.raiders.find((o) => o.id === b.ref);
    if (r && raiderUp(r)) knockOut(g, r);
  } else if (b.kind === 'lure') {
    const t = g.threats.find((o) => o.id === b.ref && !o.dead);
    if (t) damageThreat(g, t, 1);
  } else {
    addFx(g, 'text', b.tx, b.ty - 34, { life: 1.4, text: b.kind === 'silo' ? 'SILO SILENCED' : 'TUNNEL HIT' });
  }
}

// ---------------------------------------------------------------------------
// The weapons plan, phase 3: boosts. A boost drops like a weapon, but picking
// it up never replaces the loaded weapon: it changes how everything you fire
// works for the weapon time. A second boost replaces the first.

/** The level of this boost while it runs, else 0. */
export function boostLevel(g: Game, id: AbilityId): number {
  return g.boost?.id === id ? g.boost.level : 0;
}

/** The weapons loaded (Dual Wield: two). */
export function loadedWeapons(g: Game): Weapon[] {
  return g.weapon2 ? (g.weapon ? [g.weapon, g.weapon2] : [g.weapon2]) : g.weapon ? [g.weapon] : [];
}

/** This weapon, if it is loaded (either hand under Dual Wield). */
export function held(g: Game, id: AbilityId): Weapon | null {
  if (g.weapon?.id === id) return g.weapon;
  if (g.weapon2?.id === id) return g.weapon2;
  return null;
}

/** Threats' share of speed under Time Warp (the power-up or the boost). */
export function warpScale(g: Game): number {
  const lv = boostLevel(g, 'timeWarp');
  if (lv) {
    if (lv >= ABILITY_MAX && g.boost!.age < AB.timeWarp.freezeTime) return AB.timeWarp.freeze;
    return AB.timeWarp.scale[lv - 1];
  }
  return g.warpT > 0 ? PICKUPS.warpScale : 1;
}

/** Is time warped (the world drains of colour, the sound drops)? */
export function warping(g: Game): boolean {
  return g.warpT > 0 || boostLevel(g, 'timeWarp') > 0;
}

function startBoost(g: Game, id: AbilityId, level: number, x: number, y: number): void {
  const k = level - 1;
  const t = g.stats.weaponTime * (id === 'dualWield' ? AB.dualWield.time[k] : 1);
  // Dual Wield again while it runs (Test Lab round 4: "if you pick up another
  // dual wield it should reset all your current weapons ... back to the full
  // duration"): the boost's clock starts over, and both hands with it.
  if (id === 'dualWield' && g.boost?.id === 'dualWield') {
    const b = g.boost;
    b.level = level;
    b.t = t;
    b.age = 0;
    for (const w of loadedWeapons(g)) w.t = t;
    g.uses[id] = (g.uses[id] ?? 0) + 1;
    g.events.push({ kind: 'weapon', id, level });
    cue(g, 'boost.on', x, y);
    addFx(g, 'text', x, y - 20, { life: 1.1, text: `${abilityName(id, level).toUpperCase()} · RESET` });
    return;
  }
  endBoost(g, false);
  g.boost = { id, level, t, n: 0, bank: 0, crateT: AB.supplyRun.crate, clocked: 0, drops: null, age: 0 };
  switch (id) {
    case 'overclock':
      if (g.weapon) overclockWeapon(g, g.weapon);
      break;
    case 'focus':
      g.boost.bank = AB.focus.bank[k];
      break;
    case 'supplyRun':
      // Ammo and repairs, in turn.
      callCargoPlane(g, Array.from({ length: AB.supplyRun.crates[k] }, (_, i) => ({ kind: i % 2 ? 'repair' : 'ammo' })));
      break;
  }
  g.uses[id] = (g.uses[id] ?? 0) + 1;
  g.events.push({ kind: 'weapon', id, level });
  cue(g, 'boost.on', x, y);
  addFx(g, 'text', x, y - 20, { life: 1.1, text: abilityName(id, level).toUpperCase() });
}

/** The boost ends (ran out, replaced, or the wave was cleared). */
function endBoost(g: Game, ranOut: boolean): void {
  const b = g.boost;
  if (!b) return;
  g.boost = null;
  const c = g.map.carrier;
  if (b.id === 'overclock') for (const w of loadedWeapons(g)) unclock(w);
  // Dual Wield: both hands end with it (lock-in round, the player's call).
  // Replaced by another boost (Test Lab round 4), they aren't lost: each
  // keeps the rest of the boost's time on its own clock, so both still end
  // when the Dual Wield would have. (A cleared wave empties them anyway.)
  if (b.id === 'dualWield' && !ranOut) {
    for (const w of loadedWeapons(g)) w.t = Math.max(0, b.t);
  } else if (b.id === 'dualWield') {
    const names = loadedWeapons(g).map((w) => abilityName(w.id, w.level).toUpperCase());
    g.weapon = null;
    g.weapon2 = null;
    if (ranOut && names.length) {
      cue(g, 'weapon.done', c.x, c.y);
      addFx(g, 'text', c.x, c.y - CARRIER.halfBeam - 40, { life: 1.2, text: `${names.join(' + ')} DONE` });
    }
  }
  // Overdrive (level 2): the rack is full when it ends.
  if (b.id === 'overdrive' && b.level >= 2) g.ammo = g.stats.rack;
  if (ranOut) {
    cue(g, 'boost.off', c.x, c.y);
    addFx(g, 'text', c.x, c.y - CARRIER.halfBeam - 64, { life: 1.2, text: `${abilityName(b.id, b.level).toUpperCase()} DONE` });
  }
}

/** Overclock: the weapon plays a level higher (Overload: MAX) and its clock
 *  stops. Already at MAX: it drops more often instead. */
function overclockWeapon(g: Game, w: Weapon): void {
  const b = g.boost!;
  if (w.oc !== undefined || isBoost(w.id)) return;
  b.clocked += 1;
  // Already at MAX (round 3: "maybe it drops more often?"): its clock still
  // stops, and it drops more often instead of a level it can't have.
  if (w.level >= ABILITY_MAX) b.drops = w.id;
  w.oc = w.level;
  w.level = b.level >= ABILITY_MAX ? ABILITY_MAX : Math.min(ABILITY_MAX, w.level + 1);
  if (w.level === w.oc) return;
  if (w.id === 'gunships') callGunships(g, w.level);
  if (w.id === 'frigate') launchEscorts(g, w.level);
  addFx(g, 'text', g.map.carrier.x, g.map.carrier.y - CARRIER.halfBeam - 64, { life: 1.1, text: `${abilityName(w.id, w.level).toUpperCase()} · OVERCLOCKED` });
}

function unclock(w: Weapon): void {
  if (w.oc === undefined) return;
  w.level = w.oc;
  w.oc = undefined;
}

/** Where a weapon pickup goes. Either hand already holding it gets a fresh
 *  clock (an overclock carries over; under Dual Wield the clock is still the
 *  boost's); under Dual Wield it joins the first (both hands full: the one
 *  loaded longer ago goes, so you hold the two newest; Test Lab round 4: it
 *  was always the first hand, both showing the boost's time). Returns false
 *  when it simply takes the first hand: the second keeps the rest of its
 *  time (round 2: "both stay loaded together for the rest of their time"). */
function boostLoad(g: Game, w: Weapon): boolean {
  for (const hand of ['weapon', 'weapon2'] as const) {
    const old = g[hand];
    if (old?.id !== w.id) continue;
    if (old.oc !== undefined) {
      w.oc = old.oc;
      w.level = old.level;
    }
    g[hand] = w;
    return true;
  }
  if (g.boost?.id !== 'dualWield' || !g.weapon) return false;
  if (!g.weapon2) g.weapon2 = w;
  else if ((g.weapon2.t0 ?? 0) < (g.weapon.t0 ?? 0)) g.weapon2 = w;
  else g.weapon = w;
  return true;
}

/** Supply Run's cargo plane: it crosses over open water mid-screen from a
 *  random side and drops `load` in a row, spaced across the middle. */
function callCargoPlane(g: Game, load: { kind: PickupKind; weapon?: AbilityId }[]): void {
  const dir = g.rng.drops.chance(0.5) ? 1 : -1;
  const y = VIEW.height * 0.4;
  const n = load.length;
  const span = Math.min(VIEW.width * 0.5, 170 * (n - 1));
  const drops = load.map((o, i) => ({ ...o, x: VIEW.width / 2 + dir * (n > 1 ? -span / 2 + (span * i) / (n - 1) : 0) }));
  g.planes.push({ id: g.nextId++, x: dir > 0 ? -160 : VIEW.width + 160, y, vx: dir * AB.supplyRun.planeSpeed, drops });
  cue(g, 'supply.plane', dir > 0 ? -160 : VIEW.width + 160, y, { vx: dir * AB.supplyRun.planeSpeed });
}

function updatePlanes(g: Game, dt: number): void {
  for (const pl of g.planes) {
    pl.x += pl.vx * dt;
    while (pl.drops.length && (pl.vx > 0 ? pl.x >= pl.drops[0].x : pl.x <= pl.drops[0].x)) {
      const d = pl.drops.shift()!;
      addPickup(g, d.kind, d.x, pl.y, d.weapon);
      g.pickups[g.pickups.length - 1].chute = AB.supplyRun.chute;
      cue(g, 'supply.crate', d.x, pl.y);
    }
  }
  g.planes = g.planes.filter((pl) => pl.x > -200 && pl.x < VIEW.width + 200);
}

/** Each step a boost runs: its clock, Airdrop's crates, Focus's bank. */
function updateBoost(g: Game, dt: number, real: number): void {
  const b = g.boost;
  if (!b) return;
  b.age += dt;
  b.t -= dt;
  if (b.id === 'focus' && g.focusing) b.bank = Math.max(0, b.bank - real);
  if (b.id === 'supplyRun' && b.level >= ABILITY_MAX) {
    b.crateT -= dt;
    const weapons = g.slots.filter((id) => !isBoost(id) && (g.levels[id] ?? 0) > 0);
    if (b.crateT <= 0 && weapons.length) {
      b.crateT += AB.supplyRun.crate;
      callCargoPlane(g, [{ kind: 'weapon', weapon: g.rng.drops.pick(weapons) }]);
    }
  }
  if (b.t <= 0) endBoost(g, true);
}

/** The weapons held (the slots that aren't boosts). */
function weaponsHeld(g: Game): AbilityId[] {
  return g.slots.filter((id) => !isBoost(id) && (g.levels[id] ?? 0) > 0);
}

/** Is the running boost waiting on a weapon pickup (Dual Wield with a hand
 *  free; Overclock with nothing overclocked yet)? */
function callsWeapon(g: Game): boolean {
  const b = g.boost;
  if (!b) return false;
  if (b.id === 'dualWield') return !g.weapon || !g.weapon2;
  if (b.id === 'overclock') return b.clocked === 0;
  return false;
}

/** Drops come this many times as often (Supply Run, Dual Wield's Arsenal
 *  Drop, Overclock on a MAX weapon). */
function dropMult(g: Game, weapon: boolean): number {
  const b = g.boost;
  if (!b) return 1;
  const k = b.level - 1;
  if (b.id === 'supplyRun') return AB.supplyRun.mult[k];
  if (!weapon) return 1;
  if (b.id === 'dualWield') return AB.dualWield.drops[k];
  if (b.id === 'overclock' && b.drops) return AB.overclock.drops;
  return 1;
}

/** Wild Card: weapons a single tap can fire (no gestures, no two-tap ones). */
const WILD_ACTIVES: AbilityId[] = ['airstrike', 'shrapnel', 'thermo', 'scatter', 'boomerang', 'flak', 'seeker', 'well', 'railgun', 'tesla'];
const WILD_PASSIVES: AbilityId[] = ['droneScreen', 'gunships', 'orbital', 'bomberWing'];

/** Wild Card, nothing loaded: this tap is a random weapon's shot (level 1
 *  actives; level 2 actives or passives; Jackpot: actives at MAX). */
function wildTap(g: Game, x: number, y: number, threat: Threat | null, radius: number): TapResult {
  const lv = boostLevel(g, 'wildCard');
  const pool = lv === 2 ? [...WILD_ACTIVES, ...WILD_PASSIVES] : WILD_ACTIVES;
  const id = g.rng.drops.pick(pool);
  const level = lv;
  const w: Weapon = { id, level, t: 0, t0: g.t };
  addFx(g, 'text', x, y - 34, { life: 0.8, text: abilityName(id, level).toUpperCase() });
  cue(g, 'wild.roll', x, y);
  if (WILD_PASSIVES.includes(id)) {
    if (!spend(g)) return 'dry';
    passiveShot(g, w, x, y, threat);
    return 'fire';
  }
  const r = fireWeapon(g, w, x, y, threat, radius);
  if (r) return r;
  if (!threat) return 'empty';
  return fireAt(g, threat, [w]) ? 'fire' : 'dry';
}

/** A passive's one shot, for Wild Card: a few drones off the deck, a rocket
 *  pod, a beam from orbit, or one bomber pass. */
function passiveShot(g: Game, w: Weapon, x: number, y: number, threat: Threat | null): void {
  const c = g.map.carrier;
  const k = w.level - 1;
  const ax = threat ? threat.x : x;
  const ay = threat ? threat.y : y;
  switch (w.id) {
    case 'droneScreen':
      for (let i = 0; i < AB.wildCard.drones; i++) g.wings.push({ id: g.nextId++, x: c.x + (i - 1) * 16, y: c.y - 8, heading: -Math.PI / 2, target: null, life: AB.droneScreen.life });
      cue(g, 'screen.launch', c.x, c.y);
      break;
    case 'gunships':
    {
      // A missile from off the screen's edge (the gunship never shows).
      const sx = ax < VIEW.width / 2 ? 0 : VIEW.width;
      const target = lured(g, ax, ay, AB.gunships.reach, threat ?? undefined) ?? null;
      launchHellfire(g, sx, ay - 60, Math.atan2(60, ax - sx), target, AB.gunships.damage[k], target ? undefined : { x: ax, y: ay });
      break;
    }
    case 'orbital': {
      const th = lured(g, ax, ay, Infinity, threat ?? undefined) ?? toughest(g, -1);
      if (!th) break;
      const bx = th.x;
      const by = th.y;
      damageThreat(g, th, AB.orbital.damage);
      for (const o of [...g.threats]) if (!o.dead && o !== th && dist(o.x, o.y, bx, by) <= AB.orbital.splash) damageThreat(g, o, 1);
      addFx(g, 'orbital', bx, by, { life: 0.45, r: AB.orbital.splash * 0.8 });
      cue(g, 'orbital.beam', bx, by);
      break;
    }
    case 'bomberWing':
      callSorties(g, 1, AB.bomberWing.quiet[k]);
      break;
  }
}

/** Is this hull's damage blocked (the Shield power-up, or the boost: level 1
 *  lets a strafing run through)? */
function shielded(g: Game, by: ThreatKind): boolean {
  if (g.shieldT > 0) return true;
  const lv = boostLevel(g, 'shield');
  return lv > 0 && (!isJet(by) || lv >= 2);
}

/** Reflect (Shield MAX): a blocked missile bounces back the way it came and
 *  bursts there. */
function reflect(g: Game, th: Threat | undefined, x: number, y: number): void {
  if (boostLevel(g, 'shield') < ABILITY_MAX || !th) return;
  const sp = Math.hypot(th.vx, th.vy);
  const ux = sp > 1 ? -th.vx / sp : Math.cos(th.heading + Math.PI);
  const uy = sp > 1 ? -th.vy / sp : Math.sin(th.heading + Math.PI);
  const bx = x + ux * AB.shield.bounce;
  const by = y + uy * AB.shield.bounce;
  addFx(g, 'tracer', x, y, { life: 0.2, x2: bx, y2: by });
  addFx(g, 'burst', bx, by, { life: 0.4, r: AB.shield.burst });
  cue(g, 'shield.reflect', bx, by);
  for (const o of [...g.threats]) if (!o.dead && o !== th && dist(o.x, o.y, bx, by) <= AB.shield.burst) damageThreat(g, o, 1);
}

/** Ramming Speed (Full Steam MAX): ships run down drones and boats. */
function ram(g: Game): void {
  if (boostLevel(g, 'fullSteam') < ABILITY_MAX) return;
  for (const th of g.threats) {
    if (th.dead || (th.kind !== 'drone' && th.kind !== 'minidrone' && th.kind !== 'fastboat')) continue;
    const s = g.ships.find((o) => dist(o.x, o.y, th.x, th.y) <= AB.fullSteam.ram);
    if (!s) continue;
    addFx(g, 'text', s.x, s.y - 30, { life: 0.7, text: 'RAMMED' });
    cue(g, 'steam.ram', s.x, s.y);
    damageThreat(g, th, th.hp + 99);
  }
}

// ---------------------------------------------------------------------------
// The step

export function step(g: Game, dt: number): void {
  if (g.phase !== 'wave') return;
  // Focus: while a finger is down and the bank lasts, the whole game runs
  // slow (the bank drains in real time).
  const real = dt;
  g.realT += real;
  g.focusing = g.finger && g.boost?.id === 'focus' && g.boost.bank > 0;
  if (g.focusing) dt *= AB.focus.scale[g.boost!.level - 1];
  g.cues.length = 0;
  g.steps += 1;
  g.t += dt;
  g.waveT += dt;

  spawnShips(g, dt);
  // An aircraft's line is fixed when its warning arrow appears.
  for (const l of g.queue) {
    if (l.at - g.waveT > PLANE.warn) break;
    if ((l.kind === 'strafer' || l.kind === 'bomber') && l.y === undefined) {
      const r = planeRoute(g, l.kind, g.rng.threats);
      l.y = r.y;
      if (r.lane !== undefined) {
        l.lane = r.lane;
        l.lat = r.lat;
      }
      const at = l.lane !== undefined ? planeEntry(g, l) : { x: (l.side ?? 1) > 0 ? 0 : VIEW.width, y: l.y };
      cue(g, 'aircraft.warn', at.x, at.y);
    }
  }
  while (g.queue.length && g.queue[0].at <= g.waveT) launch(g, g.queue.shift()!);
  updateLabSets(g);
  while (g.raiderQueue.length && g.raiderQueue[0].at <= g.waveT) spawnRaider(g, g.raiderQueue.shift()!);
  for (const r of g.raiders) updateRaider(g, r, dt);
  g.raiders = g.raiders.filter((r) => r.state !== 'reverse' || r.dist > 0);
  // Focus: the rack reloads in real time, so slow motion buys shots (the
  // lock-in round: buffed to the middle of the table).
  reload(g, g.focusing ? real : dt);
  updateShips(g, dt);
  ram(g);
  // Time Warp slows every threat (not the convoy, not your interceptors).
  const tdt = dt * warpScale(g);
  for (const th of g.threats) if (!th.dead) updateThreat(g, th, tdt);
  updateTimers(g, dt);
  updateBoost(g, dt, real);
  updateAllies(g, dt);
  updateEscorts(g, dt);
  updateAegis(g, dt);
  updateBombs(g, dt);
  updatePointDefense(g, dt);
  updateDamageControl(g, dt);
  updateBlades(g, dt);
  // A held finger's work (the Lance's charge, the Cutter's line) is the
  // player's own hand.
  g.foe.byTap = true;
  updatePress(g, dt);
  updateFlings(g, dt);
  g.foe.byTap = false;
  updateBeat(g);
  updatePassives(g, dt);
  updateFields(g, dt);
  updateInterceptors(g, dt);
  updatePosts(g, dt);
  updateLocks(g, dt);
  updateFoeShots(g, tdt);
  updateFoeMarks(g, tdt);
  g.weaponDropT += dt;

  g.threats = g.threats.filter((th) => !th.dead);
  updatePlanes(g, dt);
  updatePickups(g, dt);
  for (const f of g.fx) f.age += dt;
  g.fx = g.fx.filter((f) => f.age < f.life);

  if (g.lost >= g.tempo.lossLimit || g.carrierHp <= 0) {
    g.phase = 'lost';
    recordWave(g, 'lost');
    return;
  }
  if (g.queue.length === 0 && g.threats.every(standing) && g.raiders.length === 0 && g.raiderQueue.length === 0 && !foesBusy(g) && !labBusy(g)) {
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
  endBoost(g, false);
  g.weapon2 = null;
  g.finger = false;
  g.focusing = false;
  g.weapon = null;
  g.press = null;
  g.flings = [];
  g.beat = { last: -9, run: 0, armed: false, seen: -1 };
  g.wings = [];
  g.helis = [];
  g.hellfires = [];
  g.sorties = [];
  g.planes = [];
  g.orbital = null;
  g.quietUntil = [];
  g.carrierAegis = null;
  for (const s of g.ships) s.aegis = undefined;
  g.foe.shots = [];
  g.foe.marks = [];
  g.ammo = g.stats.rack;
  g.reloadT = 0;
}

function recordWave(g: Game, outcome: WaveRecord['outcome']): void {
  if (outcome === 'cleared') labWaveCleared(g);
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
  cue(g, 'tanker.horn', t.x, t.y);
}

/** The furthest a hull may sail this step: up to a closed lock gate. */
function stopAt(g: Game, s: Ship): number {
  return gateStop(g, s.channel, s.d, LOCK.stand);
}

/** Up to a closed lock gate on a lane, for a hull at d whose bow reaches
 *  `stand` ahead of it (a frigate's runs further than a cargo ship's). */
function gateStop(g: Game, lane: number, d: number, stand: number): number {
  if (!g.map.locks) return Infinity;
  const ch = g.map.channels[lane];
  let stop = Infinity;
  g.map.locks.forEach((lock, i) => {
    const d0 = laneDAtX(ch, lock.x0);
    const d1 = laneDAtX(ch, lock.x1);
    if (d0 === null || d1 === null) return;
    const st = g.lockState[i];
    // Short of the gates: wait at the entry while it is shut.
    if (d < d0 - stand + 1 && st.phase !== 'in') stop = Math.min(stop, d0 - stand);
    // In the chamber: wait at the exit while it is shut.
    else if (d >= d0 - stand && d < d1 && st.phase !== 'out') stop = Math.min(stop, d1 - stand);
  });
  return stop;
}

/** A frigate's bow is this far ahead of its centre, plus the gap a cargo
 *  ship keeps from a gate. */
const ESCORT_STAND = LOCK.stand + 40;

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
  if (arrived.length) cue(g, 'ship.delivered', clamp(arrived[0].x, 0, VIEW.width), arrived[0].y);
  if (arrived.length) g.ships = g.ships.filter((s) => !arrived.includes(s));
}

/** The supertanker came through: every hull gets a point back and a weapon
 *  you hold drops by the exit. */
function tankerHome(g: Game, s: Ship): void {
  for (const o of g.ships) if (o.hp < g.stats.shipHp) o.hp += 1;
  if (g.slots.length) addPickup(g, 'weapon', clamp(s.x, 120, VIEW.width - 120), clamp(s.y, 120, VIEW.height - 120), g.rng.drops.pick(g.slots));
  cue(g, 'tanker.home', clamp(s.x, 0, VIEW.width), s.y);
  g.events.push({ kind: 'bigKill', label: 'TANKER HOME', x: clamp(s.x, 160, VIEW.width - 160), y: clamp(s.y, 80, VIEW.height - 80) });
}

/** Where a decoy swarm's member flies for: its target, moved across its
 *  line of flight by its `slot`, the full slot while far out, closing up
 *  over the last `FOE.decoy.closeUp` px. */
export function swarmAim(th: Threat, tp: Point, d: number): Point {
  const k = (th.slot ?? 0) * clamp((d - FOE.decoy.fizzle) / FOE.decoy.closeUp, 0, 1);
  if (!k || d < 1) return tp;
  return { x: tp.x - ((tp.y - th.y) / d) * k, y: tp.y + ((tp.x - th.x) / d) * k };
}

/** A decoy swarm's member keeps a little room: eased away from any other
 *  member closer than `FOE.decoy.part` px (real drones and decoys alike, so
 *  nothing tells them apart). */
export function swarmPart(g: Game, th: Threat, dt: number): void {
  const R = FOE.decoy.part;
  for (const o of g.threats) {
    if (o === th || o.dead || o.slot === undefined) continue;
    const dx = th.x - o.x;
    const dy = th.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d >= R) continue;
    const push = (FOE.decoy.partSpeed * (1 - d / R) * dt) / Math.max(1, d);
    th.x += d > 0.01 ? dx * push : (th.id % 2 ? 1 : -1) * FOE.decoy.partSpeed * dt;
    th.y += dy * push;
  }
}

/** Where a ship will be `ahead` seconds from now, sailing its lane (and
 *  `plus` px further along it: a point off its bow). */
export function shipAhead(g: Game, s: Ship, ahead: number, plus = 0): Point {
  const p = laneAt(g.map.channels[s.channel], s.d + laneSpeed(g, s) * ahead + plus, s.lat);
  return { x: p.x, y: p.y };
}

/** Ships the enemy is allowed to aim at: on screen and not about to deliver. */
export function targetable(g: Game, maxX = VIEW.width - 90): Ship[] {
  // Measured along the lane, so it holds for a bend or a reversed lane: on a
  // straight lane this is x > 30 and x < maxX.
  const tail = VIEW.width + 40 - maxX;
  return g.ships.filter((s) => s.d > 70 && laneLength(g.map.channels[s.channel]) - s.d > tail);
}

/** The convoy's speed in the current formation. */
/** Full Steam (the power-up or the boost): the convoy's speed ×. */
function steamMult(g: Game): number {
  const lv = boostLevel(g, 'fullSteam');
  if (lv) return AB.fullSteam.mult[lv - 1];
  return g.steamT > 0 ? PICKUPS.steamMult : 1;
}

export function shipSpeed(g: Game): number {
  return SHIP.speed * FORMATIONS[g.formation].speed * steamMult(g);
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
export function damageShip(g: Game, s: Ship, amount: number, by: ThreatKind, direct = true): void {
  if (shielded(g, by)) {
    addFx(g, 'block', s.x, s.y, { life: 0.4, r: 30 });
    cue(g, 'shield.block', s.x, s.y);
    return;
  }
  if (glances(g, s.x, s.y, 30)) return;
  const f = FORMATIONS[g.formation];
  if (f.blastCut > 0 && SPLASH_WEAPONS.includes(by)) amount = Math.max(1, Math.ceil(amount * (1 - f.blastCut)));
  const dealt = direct ? Math.max(1, amount - f.armor) : amount;
  s.hp -= dealt;
  if (g.lab) labHarm(g, by, dealt, s.hp <= 0);
  if (s.hp > 0) {
    cue(g, 'ship.hit', s.x, s.y);
    return;
  }
  g.ships = g.ships.filter((o) => o !== s);
  g.lost += s.vip ? VIP.loss : 1;
  g.sunkBy[by] += 1;
  addFx(g, 'sink', s.x, s.y, { life: 2.2, r: 34 });
  cue(g, 'ship.sunk', s.x, s.y);
  g.events.push({ kind: 'shipLost', lost: g.lost });
}

/** Armor Plating (Armory, Hull bay): a hit on a hull may glance off. */
function glances(g: Game, x: number, y: number, r: number): boolean {
  if (!g.stats.glance || !g.rng.armor.chance(g.stats.glance)) return false;
  addFx(g, 'block', x, y, { life: 0.4, r });
  cue(g, 'glance', x, y);
  return true;
}

/** A hit on the carrier (exported so the tests can land one directly). */
export function damageCarrier(g: Game, amount: number, by: ThreatKind): void {
  if (shielded(g, by)) {
    addFx(g, 'block', g.map.carrier.x, g.map.carrier.y, { life: 0.4, r: 60 });
    cue(g, 'shield.block', g.map.carrier.x, g.map.carrier.y);
    return;
  }
  if (glances(g, g.map.carrier.x, g.map.carrier.y, 60)) return;
  g.carrierHp = Math.max(0, g.carrierHp - amount);
  g.carrierDamageBy[by] += amount;
  g.events.push({ kind: 'carrierHit', hp: g.carrierHp });
  cue(g, 'carrier.hit', g.map.carrier.x, g.map.carrier.y);
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
  // The enemy build: drones and missiles speed up with the wave like their
  // kin; platforms and aircraft barely.
  sprinter: 1,
  decoy: 1,
  hydra: GUIDED.waveSpeedShare,
  dart: 0.5,
  rocketTruck: 0,
  attackHeli: 0.3,
  heliRocket: 0.5,
  torpedoSub: 0,
  torpedo: 0.3,
  armored: 0.6,
  scavenger: 0.3,
  stealthJet: 0.3,
  stealthBomber: 0.3,
  diveBomber: 0,
  siege: 0,
  spotter: 0.2,
  tender: 0,
  guard: 0,
  lure: 0,
  cloud: 0.3,
};

function launch(g: Game, l: Launch): void {
  if (l.kind === 'strafer' || l.kind === 'bomber') {
    launchPlane(g, l);
    return;
  }
  // The stealth aircraft: no warning, so their line is picked now.
  if (isPlaneKind(l.kind)) {
    launchPlane(g, { ...l, side: g.rng.foes.chance(0.5) ? 1 : -1 });
    return;
  }
  if (isFoe(l.kind) && !fromBase(l.kind)) {
    launchFoe(g, l);
    return;
  }
  if (l.base < 0 || g.baseDown[l.base]) return;
  // Bomber Wing silenced this silo: the launch is cancelled, not delayed.
  if ((g.quietUntil[l.base] ?? 0) > g.t) return;
  const base = g.map.bases[l.base];
  if (isFoe(l.kind)) launchFoe(g, l, base);
  else {
    const th = spawnThreat(g, l.kind, base.x, base.y, 'base');
    // A Spotter's strike goes for its painted ship, if it is still afloat.
    if (l.target !== undefined && g.ships.some((s) => s.id === l.target)) {
      th.target = l.target;
      if (th.kind === 'ballistic') aimBallistic(g, th);
    }
  }
}

/** A threat leaves a launcher at (x, y): a base, a truck or a submarine. */
export function spawnThreat(g: Game, kind: ThreatKind, x: number, y: number, origin: LaunchOrigin): Threat {
  const def = THREATS[kind];
  const rng = g.rng.threats;
  g.origins[origin] += 1;
  if (!g.seen.has(kind)) {
    g.seen.add(kind);
    g.events.push({ kind: 'debut', threat: kind });
    cue(g, 'debut.sting', x, y);
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
  // The enemy build: a Spotter's painted ship draws most launches.
  if (g.foe.paint) paintTarget(g, th);

  if (kind === 'ballistic') aimBallistic(g, th);
  const tp = kind === 'mine' ? { x: th.x + (g.map.current?.x ?? 0), y: th.y + (g.map.current?.y ?? 1) } : targetPos(g, th);
  th.heading = Math.atan2(tp.y - th.y, tp.x - th.x);
  g.threats.push(th);
  if (g.lab) labCame(g, th);
  // Launch flash by where it came from: a base's red flare, a column of spray
  // off a submarine's deck, a truck's smaller flash (round 4: the base flare
  // drawn over a sub or a truck hid it completely).
  launchCue(g, th, origin);
  if (origin === 'sub') addFx(g, 'spray', x, y, { life: 0.7, r: 16 });
  else if (origin === 'truck') addFx(g, 'launch', x, y, { life: 0.45, r: 9 });
  else if (origin === 'base') addFx(g, 'launch', x, y, { life: 0.6, r: 20 });
  return th;
}

/** Does a lane curve (rather than run straight across the screen)? */
export function laneBends(ch: Channel): boolean {
  const p = ch.path;
  if (!p) return false;
  for (let i = 1; i < p.length; i++) if (Math.abs(p[i].y - p[i - 1].y) > 0.15 * Math.abs(p[i].x - p[i - 1].x) + 2) return true;
  return false;
}

/** The line an aircraft flies. A strafing jet lines up on the densest band of
 *  hulls (a tight block is its favourite target); a bomber flies just outside
 *  a shipping channel and drops its missiles in. Where the lane curves, the
 *  aircraft follows it round instead: a strafer down its middle, a bomber
 *  off its edge. */
function planeRoute(g: Game, kind: ThreatKind, rng: RNG): { y: number; lane?: number; lat?: number } {
  const chans = g.map.channels;
  if (isBomberKind(kind)) {
    const bent = chans.map((c, i) => i).filter((i) => laneBends(chans[i]) && !chans[i].tide);
    if (!bent.length) return { y: rng.pick(g.map.bomberLines) };
    const lane = rng.pick(bent);
    // Off whichever edge keeps it on screen more (at the Kesh Hook, the inside
    // of the turn: the outside runs along the screen's bottom edge).
    const ch = chans[lane];
    const off = ch.halfWidth + 70;
    const seen = (lat: number) => {
      let n = 0;
      const L = laneLength(ch);
      for (let d = 0; d <= L; d += 25) {
        const p = laneAt(ch, d, lat);
        if (p.x > 60 && p.x < VIEW.width - 60 && p.y > 60 && p.y < VIEW.height - 60) n++;
      }
      return n;
    };
    const a = seen(-off);
    const b = seen(off);
    const sign = a === b ? (rng.chance(0.5) ? 1 : -1) : a > b ? -1 : 1;
    return { y: lanePoint(ch, 0).y, lane, lat: sign * off };
  }
  const lane = rng.int(chans.length);
  const ch = chans[lane];
  if (laneBends(ch)) return { y: lanePoint(ch, 0).y, lane, lat: 0 };
  let best = ch.y;
  let most = 0;
  for (const s of g.ships) {
    const n = g.ships.filter((o) => Math.abs(o.y - s.y) <= PLANE.band).length;
    if (n > most) {
      most = n;
      best = s.y;
    }
  }
  return { y: best };
}

/** Where an aircraft on a route is at distance s, and the way it points. */
export function routePose(g: Game, r: { lane: number; s: number; dir: number; lat: number }): { x: number; y: number; tx: number; ty: number } {
  // A plane's route: the lane's smoothed flight path, not the raw offset
  // (which doubles back on the inside of a bend).
  const p = flightAt(g.map.channels[r.lane], r.s, r.lat);
  return { x: p.x, y: p.y, tx: p.tx * r.dir, ty: p.ty * r.dir };
}

function launchPlane(g: Game, l: Launch): void {
  const side = l.side ?? 1;
  const route = l.y === undefined ? planeRoute(g, l.kind, g.rng.threats) : { y: l.y, lane: l.lane, lat: l.lat };
  const y = route.y;
  let x = side > 0 ? -60 : VIEW.width + 60;
  let sy = y;
  let r: Threat['route'];
  if (route.lane !== undefined) {
    const ch = g.map.channels[route.lane];
    // Enter where the lane does (or leaves, flying against the shipping),
    // a little off screen.
    r = { lane: route.lane, s: side > 0 ? -20 : laneLength(ch) + 20, dir: side, lat: route.lat ?? 0, flown: 0 };
    const p = routePose(g, r);
    x = p.x - p.tx * 40;
    sy = p.y - p.ty * 40;
    r.s -= side * 40;
  }
  const th = spawnThreat(g, l.kind, x, sy, 'air');
  th.side = side;
  th.heading = side > 0 ? 0 : Math.PI;
  if (r) {
    th.route = r;
    const p = routePose(g, r);
    th.heading = Math.atan2(p.ty, p.tx);
    th.bank = 0;
  }
  th.target = CARRIER_TARGET;
  th.hits = [];
  th.bombs = l.kind === 'bomber' ? PLANE.bombs : l.kind === 'stealthBomber' ? FOE.stealthBomber.bombs : 0;
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
  // On a Grapnel cable or a Chain Shot link: moved by that, not by itself.
  if (th.held) return;
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
  } else if (isPlaneKind(th.kind)) {
    updatePlane(g, th, dt);
  } else if (movesItself(th.kind)) {
    updateFoe(g, th, dt, (t) => targetPos(g, t), (t) => checkImpact(g, t), (t) => ensureTarget(g, t));
  } else if (th.kind === 'ballistic') {
    const left = th.dur - th.age;
    // A short flight whistles from its first step.
    if (left <= BALLISTIC_WHISTLE && (left + dt > BALLISTIC_WHISTLE || th.age <= dt)) cue(g, 'ballistic.whistle', th.ix, th.iy);
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
      // A decoy swarm's drones keep their place in its spread.
      const weave = DRONE.weaveAmp * Math.sin(th.age * DRONE.weaveFreq + th.phase);
      const at = th.slot ? swarmAim(th, tp, d) : tp;
      th.heading = Math.atan2(at.y - th.y, at.x - th.x) + (d > 80 ? weave : 0);
    } else if (th.kind === 'mothership') {
      th.heading = want;
    } else {
      const base = STEER[th.kind] ?? GUIDED.turnRate;
      const close = Math.max(0, 1 - d / GUIDED.terminalRange);
      // The enemy helicopter's missiles home without circling (Test Lab
      // round 1: "the missile for the enemy helicopter also needs to be
      // fixed"); the rest keep their own turn.
      const turn = (th.kind === 'heliRocket' ? homingTurn(base, th.speed, d) : base + (th.kind === 'guided' ? GUIDED.terminalTurn * close : 0)) * dt;
      th.heading += clamp(angleDiff(want, th.heading), -turn, turn);
    }
    const boost =
      th.kind === 'guided' && th.age < GUIDED.boost
        ? GUIDED.boostFrom + (1 - GUIDED.boostFrom) * (th.age / GUIDED.boost)
        : 1;
    th.x += Math.cos(th.heading) * th.speed * boost * dt;
    th.y += Math.sin(th.heading) * th.speed * boost * dt;
    if (th.slot !== undefined) swarmPart(g, th, dt);
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

/** Where an aircraft on a curved lane comes on screen (its warning sits
 *  there). */
export function planeEntry(g: Game, l: Launch): Point {
  const ch = g.map.channels[l.lane!];
  const side = l.side ?? 1;
  const L = laneLength(ch);
  // The first point of its route on screen.
  for (let k = 0; k <= L; k += 10) {
    const p = laneAt(ch, side > 0 ? k : L - k, l.lat ?? 0);
    if (p.x >= 0 && p.x <= VIEW.width && p.y >= 0 && p.y <= VIEW.height) return { x: p.x, y: p.y };
  }
  return laneAt(ch, side > 0 ? 0 : L, l.lat ?? 0);
}

/** A hull's place in an aircraft's frame at point (gx, gy) heading (tx, ty):
 *  how far ahead and how far across. On its own lane, measured along the
 *  lane (so ahead still means ahead round a bend). */
function planeFrame(g: Game, th: Threat, s: Ship, gx: number, gy: number, tx: number, ty: number, gunS?: number): { along: number; across: number } {
  const r = th.route;
  if (r && gunS !== undefined && s.channel === r.lane) return { along: (s.d - gunS) * r.dir, across: s.lat - r.lat };
  const dx = s.x - gx;
  const dy = s.y - gy;
  return { along: dx * tx + dy * ty, across: -dx * ty + dy * tx };
}

/** Aircraft fly straight across, or round a curved lane, banking into the
 *  turn. A strafing jet's guns walk a line of hits ahead of it, catching
 *  every hull within PLANE.band of its track once; a bomber drops guided
 *  missiles as it passes over the convoy. Off the far edge, either is gone
 *  (no kill, no pickup). */
function updatePlane(g: Game, th: Threat, dt: number): void {
  const side = th.side ?? 1;
  const r = th.route;
  let tx = side;
  let ty = 0;
  let inside: number;
  let gx: number;
  let gy: number;
  let gunS: number | undefined;
  if (r) {
    // The plane flies its own path at its own speed, steering for a point
    // ahead on the route and turning no faster than a plane can. Playtest:
    // "Plane turned for the bomber was not smooth". A bomber's route runs
    // beside the lane, so round a bend it is shorter or longer than the lane
    // (and can jump at a corner). Stepping it along the lane at a fixed rate
    // made the bomber lurch: 175 px/s at times reached 1,045 at the Kesh
    // Hook and 4,600 at the Delta.
    const step = th.speed * dt;
    r.flown += step;
    const was = th.heading;
    const look = routePose(g, { ...r, s: r.s + r.dir * PLANE.look });
    const turn = PLANE.turnRate * dt;
    th.heading += clamp(angleDiff(Math.atan2(look.y - th.y, look.x - th.x), th.heading), -turn, turn);
    th.x += Math.cos(th.heading) * step;
    th.y += Math.sin(th.heading) * step;
    // Keep the route's place abreast of the plane: the point on it nearest
    // the plane, searched a little either side of where it was.
    let best = r.s;
    let bestD = Infinity;
    for (let j = -2; j <= 8; j++) {
      const s = r.s + r.dir * step * j * 0.5;
      const q = routePose(g, { ...r, s });
      const d = (q.x - th.x) ** 2 + (q.y - th.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    r.s = best;
    const rate = angleDiff(th.heading, was) / Math.max(dt, 1e-6);
    // Bank into the turn: up to ~60° at the Kesh Hook's turn rate and more.
    const want = clamp(rate * 0.9, -1.05, 1.05);
    th.bank = (th.bank ?? 0) + clamp(want - (th.bank ?? 0), -2.5 * dt, 2.5 * dt);
    tx = Math.cos(th.heading);
    ty = Math.sin(th.heading);
    inside = r.flown - 60;
    gunS = r.s + r.dir * PLANE.gunLead;
    const gp = routePose(g, { ...r, s: gunS });
    gx = gp.x;
    gy = gp.y;
  } else {
    th.x += side * th.speed * dt;
    // How far onto the screen it has flown from its entry edge.
    inside = side > 0 ? th.x : VIEW.width - th.x;
    gx = th.x + side * PLANE.gunLead;
    gy = th.y;
  }
  if (isJet(th.kind)) {
    const frame = (s: Ship) => planeFrame(g, th, s, gx, gy, tx, ty, gunS);
    const runIn = th.kind === 'stealthJet' ? FOE.stealthJet.runIn : PLANE.strafeRunIn;
    const band = inside < runIn ? [] : g.ships.filter((s) => Math.abs(frame(s).across) <= PLANE.band);
    const was = th.firing;
    th.firing = band.some((s) => {
      const ahead = frame(s).along;
      return ahead > -60 && ahead < 220;
    });
    if (th.firing && !was) cue(g, 'strafer.guns', gx, gy, { vx: tx * th.speed });
    for (const s of band) {
      if (th.hits!.includes(s.id) || Math.abs(frame(s).along) > 22) continue;
      th.hits!.push(s.id);
      // Shield (level 2): it blocks the whole run, and shatters doing it.
      if (th.blocked || boostLevel(g, 'shield') >= 2) {
        if (!th.blocked) {
          th.blocked = true;
          addFx(g, 'shatter', s.x, s.y, { life: 0.9, r: 44 });
          cue(g, 'shield.shatter', s.x, s.y);
          if (g.boost) g.boost.t = Math.min(g.boost.t, AB.shield.shatter);
        }
        addFx(g, 'block', s.x, s.y, { life: 0.4, r: 30 });
        continue;
      }
      addFx(g, 'boom', s.x, s.y, { life: 0.4, r: 16 });
      damageShip(g, s, THREATS[th.kind].damage, th.kind);
    }
    // Water spouts walk along the gun line while it fires (no RNG: jitter from
    // the step count, so the sim stays reproducible).
    if (th.firing && g.steps % 2 === 0) {
      const j = ((g.steps * 7919) % 97) / 97 - 0.5;
      const a = j * 30;
      const c = j * 2 * PLANE.band * 0.6;
      addFx(g, 'spout', gx + tx * a - ty * c, gy + ty * a + tx * c, { life: 0.5, r: 8 });
    }
  } else {
    th.dropT = (th.dropT ?? 99) + dt;
    const ahead = inside < (th.kind === 'stealthBomber' ? FOE.stealthBomber.runIn : PLANE.bomberRunIn) ? undefined : g.ships
      .filter((s) => {
        const d = r ? planeFrame(g, th, s, th.x, th.y, tx, ty, r.s).along : (s.x - th.x) * side;
        return d > 0 && d < PLANE.dropReach;
      })
      .sort((a, b) => dist(a.x, a.y, th.x, th.y) - dist(b.x, b.y, th.x, th.y))[0];
    if (ahead && (th.bombs ?? 0) > 0 && th.dropT >= PLANE.dropEvery) {
      th.bombs! -= 1;
      th.dropT = 0;
      const m = spawnThreat(g, 'guided', th.x, th.y, 'air');
      m.target = ahead.id;
      m.parent = th.kind;
      cue(g, 'bomber.drop', th.x, th.y);
      m.hp = 1;
      g.origins.air -= 1;
      g.origins.child += 1;
    }
  }
  if (r) {
    // Off the far end of its route and off screen: gone.
    const L = laneLength(g.map.channels[r.lane]);
    const past = r.dir > 0 ? r.s > L + 60 : r.s < -60;
    const off = th.x < -120 || th.x > VIEW.width + 120 || th.y < -120 || th.y > VIEW.height + 120;
    if (past && off) th.dead = true;
    if (r.flown > 6000) th.dead = true;
  } else if (th.x < -120 || th.x > VIEW.width + 120) th.dead = true;
}

/** Turn rates (rad/s) for the steering threats. */
const STEER: Partial<Record<ThreatKind, number>> = {
  guided: GUIDED.turnRate,
  supersonic: SUPERSONIC.turnRate,
  heavy: HEAVY.turnRate,
  cluster: CLUSTER.turnRate,
  bomblet: CLUSTER.bombletTurn,
  fastboat: FASTBOAT.turnRate,
  hydra: GUIDED.turnRate,
  dart: 5,
  heliRocket: 3,
};

/** Where a ship will be when a fast threat reaches it. */
function leadPoint(g: Game, th: Threat): Point {
  const t = targetPos(g, th);
  const ship = g.ships.find((o) => o.id === th.target);
  if (!ship) return t;
  return shipAhead(g, ship, dist(th.x, th.y, t.x, t.y) / th.speed);
}

export function checkImpact(g: Game, th: Threat): void {
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
    // An Incendiary Missile at its target only bursts (Test Lab round 4:
    // "the hit … should not do damage; only damage should be from the
    // fire"): foes.ts lights its fireball there.
    if (th.kind === 'cloud') return;
    if (shielded(g, blame)) reflect(g, th, th.x, th.y);
    // A heavy takes half the carrier's health (round 7).
    // Half the BASE carrier: Armor Plating's extra hull outlasts a heavy.
    damageCarrier(g, heavy ? Math.ceil(CARRIER.hp / 2) : dmg, blame);
    addFx(g, 'boom', th.x, th.y, { life: 0.7, r: th.kind === 'heavy' || th.kind === 'mothership' ? 50 : 30 });
    return;
  }
  const s = g.ships.find((o) => o.id === th.target);
  if (!s || dist(th.x, th.y, s.x, s.y) >= SHIP.hitRadius) return;
  th.dead = true;
  if (th.kind === 'cloud') return; // only its fireball does harm (above)
  if (shielded(g, blame)) reflect(g, th, th.x, th.y);
  if (th.kind === 'heavy') {
    // A heavy warhead also damages everything close by.
    const reach = HEAVY.splash * FORMATIONS[g.formation].splash;
    addFx(g, 'splash', th.x, th.y, { life: 0.9, r: Math.max(reach, 24) });
    cue(g, 'impact.splash', th.x, th.y);
    for (const o of [...g.ships]) {
      if (o !== s && dist(o.x, o.y, th.x, th.y) <= reach) damageShip(g, o, HEAVY.splashDamage, blame, false);
    }
  } else {
    addFx(g, 'boom', th.x, th.y, { life: 0.7, r: 28 });
  }
  // A heavy's direct hit sinks the ship whatever its armour or formation
  // (the supertanker takes VIP.heavyHit: it is built to take one).
  damageShip(g, s, heavy ? (s.vip ? VIP.heavyHit : HEAVY_SINKS) : dmg, blame);
}

/** Gravity Well: the radius caught threats circle the core at (well inside
 *  AB.well.core, so the implosion still reaches them all). */
const WELL_RING = 22;

/** More than any hull can take, through any armour or formation cut. */
const HEAVY_SINKS = 99;

export function child(g: Game, parent: Threat, kind: ThreatKind, target: number, heading: number): Threat {
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
  cue(g, 'cluster.split', th.x, th.y);
}

function spawnChildren(g: Game, th: Threat, dt: number): void {
  th.spawnT -= dt;
  if (th.spawnT > 0) return;
  th.spawnT += MOTHERSHIP.spawnEvery;
  const pool = targetable(g);
  const t = pool.length ? g.rng.threats.pick(pool).id : CARRIER_TARGET;
  g.threats.push(child(g, th, 'minidrone', t, th.heading + Math.PI / 2));
  addFx(g, 'launch', th.x, th.y, { life: 0.4, r: 12 });
  cue(g, 'minidrone.spawn', th.x, th.y);
}

function impactBallistic(g: Game, th: Threat): void {
  th.dead = true;
  const dmg = THREATS.ballistic.damage;
  // The formation sets how far the blast reaches other hulls; Spread (0)
  // means only the nearest ship inside the blast is hit.
  const reach = BALLISTIC.splash * FORMATIONS[g.formation].splash;
  addFx(g, 'splash', th.ix, th.iy, { life: 0.9, r: Math.max(reach, BALLISTIC.splash) });
  cue(g, 'impact.splash', th.ix, th.iy);
  if (shielded(g, 'ballistic')) reflect(g, th, th.ix, th.iy);
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

export function damageThreat(g: Game, th: Threat, amount: number, drops = true): void {
  if (th.dead) return;
  // The Citadel can't be hurt while any shield generator stands.
  if (th.kind === 'citadel' && shieldUp(g)) {
    if (g.steps % 3 === 0) addFx(g, 'block', th.x, th.y, { life: 0.4, r: 70 });
    cue(g, 'shield.block', th.x, th.y);
    return;
  }
  // The Lure Beacon: helpers' shots pass through it; only the player's own
  // hand sinks it.
  if (th.kind === 'lure' && !g.foe.byTap) {
    if (g.steps % 4 === 0) addFx(g, 'block', th.x, th.y, { life: 0.3, r: 26 });
    return;
  }
  th.hp -= amount;
  // Thirds of a hit (seekers) add up to a whole one, float error aside.
  if (th.hp > 1e-6) return;
  th.dead = true;
  g.kills[th.kind] += 1;
  if (isFoe(th.kind)) foeDown(g, th, !drops);
  if (g.lab) labKilled(g, th, !!g.lab.weapon && !!held(g, g.lab.weapon));
  if (isStructure(th.kind)) {
    structureDown(g, th);
  } else {
    addFx(g, 'boom', th.x, th.y, { life: 0.55, r: th.kind === 'drone' || th.kind === 'decoy' ? 18 : 26 });
    cue(g, KILL_CUE[th.kind], th.x, th.y);
    if (THREATS[th.kind].hp >= 3) g.events.push({ kind: 'bigKill', threat: th.kind, x: th.x, y: th.y });
  }
  if (!drops) return;
  if (g.rng.drops.chance(THREATS[th.kind].dropChance * g.stats.powerShare * dropMult(g, false))) dropPickup(g, th.x, th.y);
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
  return g.overdriveT > 0 || boostLevel(g, 'overdrive') > 0 || g.ammo >= 1;
}

/** A shot at a threat, tagged with the loaded weapon (its burst does that
 *  weapon's work). Storm Coil adds a free second shot at the uncovered threat
 *  nearest the first. */
function fireAt(g: Game, th: Threat, tags: Weapon[] = loadedWeapons(g)): boolean {
  if (!spend(g)) return false;
  const p = g.map.carrier;
  const [w, ...rest] = tags;
  const also = rest.map((o) => ({ ...o }));
  // Deadeye (Focus MAX) multiplies the hit.
  const deadeye = g.focusing && boostLevel(g, 'focus') >= ABILITY_MAX ? AB.focus.damage : 1;
  const dmg = g.stats.hitDamage * deadeye;
  const shoot = (t: Threat) =>
    g.interceptors.push({
      id: g.nextId++, x: p.x, y: p.y - 6, target: t.id, tx: t.x, ty: t.y, life: 0, src: 'gun', tap: true,
      weapon: w ? { ...w } : undefined,
      ...(also.length ? { also } : {}),
      ...(dmg !== g.stats.hitDamage ? { dmg } : {}),
    });
  shoot(th);
  if (g.lab) labShotAt(g, th.id);
  cue(g, 'gun.fire', p.x, p.y);
  const twinOf = () =>
    g.threats
      .filter((o) => !o.dead && o.id !== th.id && assigned(g, o.id) < o.hp && dist(o.x, o.y, th.x, th.y) <= AB.tesla.twin)
      .sort((a, b) => dist(a.x, a.y, th.x, th.y) - dist(b.x, b.y, th.x, th.y))[0];
  if (tags.some((o) => o.id === 'tesla' && o.level >= 3)) {
    const twin = twinOf();
    if (twin) shoot(twin);
  }
  // Hyper Overdrive: every shot fires twice (the second at the next threat).
  if (boostLevel(g, 'overdrive') >= ABILITY_MAX) shoot(twinOf() ?? th);
  return true;
}

function reload(g: Game, dt: number): void {
  // Overdrive the boost (level 2): the rack keeps refilling.
  if (boostLevel(g, 'overdrive') >= 2) {
    g.ammo = g.stats.rack;
    g.reloadT = 0;
    return;
  }
  if (g.overdriveT > 0) {
    g.overdriveT -= dt;
    g.ammo = g.stats.rack;
    g.reloadT = 0;
    if (g.overdriveT <= 0) cue(g, 'overdrive.off', g.map.carrier.x, g.map.carrier.y);
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
    cue(g, 'gun.reload', g.map.carrier.x, g.map.carrier.y);
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
      // A Bodyguard Ring: the shot meets a guard first.
      if (th) th = guardFor(g, th, it) ?? th;
      g.foe.byTap = !!it.tap;
      const bx = th ? th.x : it.tx;
      const by = th ? th.y : it.ty;
      const radius = it.blast ?? g.stats.blast;
      addFx(g, 'burst', bx, by, { life: 0.35, r: radius });
      // The burst pops on its own only when it kills nothing: a kill's
      // explosion covers it (two sounds for one flash muddied the mix).
      if (!th || th.hp - (it.dmg ?? g.stats.hitDamage) > 1e-6) cue(g, 'gun.burst', bx, by, it.src === 'seeker' ? { gain: 0.6 } : undefined);
      if (th) {
        // The enemy build: an Armored Drone's plate takes a shot from the front.
        if (!absorbs(g, th, it, it.dmg ?? g.stats.hitDamage)) damageThreat(g, th, it.dmg ?? g.stats.hitDamage);
        // A Tesla Arc hit arcs on to the threats around it.
        const arc = [it.weapon, ...(it.also ?? [])].find((o) => o?.id === 'tesla');
        if (arc) teslaArc(g, arc.level, bx, by, th.id, AB.tesla.depth[arc.level - 1], new Set([th.id]));
      }
      // A seeker's splash is its own third of a hit.
      blast(g, bx, by, radius, th ? th.id : -1, it.src === 'seeker' ? (it.dmg ?? 1) : 1);
      if (it.weapon) burstWeapon(g, it.weapon, bx, by);
      for (const o of it.also ?? []) burstWeapon(g, o, bx, by);
      g.foe.byTap = false;
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
    cue(g, 'debut.sting', sp.path[0].x, sp.path[0].y);
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
      cue(g, r.kind === 'sub' ? 'sub.fire' : 'truck.fire', r.x, r.y);
      spawnThreat(g, r.rounds.shift()!, r.x, r.y, origin).from = r.id;
      r.fireT = gap;
    }
    return r.rounds.length === 0 && r.fireT <= 0;
  };
  if (r.kind === 'sub') {
    if (r.state === 'warn' && r.t >= SUB.warn) {
      setState(r, 'surface');
      cue(g, 'sub.surface', r.x, r.y);
    }
    else if (r.state === 'surface' && r.t >= SUB.surface) {
      setState(r, 'fire');
      while (r.units.length) loadUnit(r);
    } else if (r.state === 'fire' && fire(SUB.gap)) {
      setState(r, 'dive');
      cue(g, 'sub.dive', r.x, r.y);
    }
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
      cue(g, 'truck.raise', r.x, r.y);
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
  const c0 = g.map.carrier;
  const ends = (t: number) => t > 0 && t - dt <= 0;
  if (ends(g.warpT)) cue(g, 'timewarp.off', c0.x, c0.y);
  if (ends(g.shieldT)) cue(g, 'shield.off', c0.x, c0.y);
  if (ends(g.steamT)) cue(g, 'steam.off', c0.x, c0.y);
  g.warpT = Math.max(0, g.warpT - dt);
  g.shieldT = Math.max(0, g.shieldT - dt);
  g.steamT = Math.max(0, g.steamT - dt);
  g.flareT = Math.max(0, g.flareT - dt);
  // Dual Wield: both hands run on the boost's clock (it ends them both).
  // Overclock stops one.
  const dual = g.boost?.id === 'dualWield' ? g.boost : null;
  for (const hand of ['weapon', 'weapon2'] as const) {
    const w = g[hand];
    if (!w) continue;
    if (dual) {
      w.t = dual.t;
      continue;
    }
    const was = w.t;
    if (w.oc === undefined) w.t -= dt;
    if (was > WEAPON_EXPIRING && w.t <= WEAPON_EXPIRING && w.t > 0) cue(g, 'weapon.expiring', c0.x, c0.y);
    if (w.t <= 0) {
      cue(g, 'weapon.done', c0.x, c0.y);
      // Round 4: say so over the gun, or a player keeps tapping as if loaded.
      const c = g.map.carrier;
      addFx(g, 'text', c.x, c.y - CARRIER.halfBeam - 40, { life: 1.2, text: `${abilityName(w.id, w.level).toUpperCase()} DONE` });
      g[hand] = null;
    }
  }
  // The second hand moves up when the first runs out.
  if (!g.weapon && g.weapon2) {
    g.weapon = g.weapon2;
    g.weapon2 = null;
    g.passiveT = g.passiveT2;
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
        cue(g, 'well.implode', f.x1, f.y1);
      }
      continue;
    }
    // Carpet Strike's row burns and flak clouds hit: anything inside is hit
    // every tick.
    f.tick -= dt;
    if (f.tick > 0) continue;
    f.tick += f.kind === 'flak' ? AB.flak.tick : AB.airstrike.burnTick;
    if (f.kind === 'flak') cue(g, 'flak.cloud', f.x1, f.y1);
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
      cue(g, 'napalm.drop', x, a.y);
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
      cue(g, 'jet.guns', th.x, th.y);
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
  cue(g, r.kind === 'sub' ? 'sub.destroyed' : 'truck.destroyed', r.x, r.y);
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
  cue(g, 'ship.hit', def.x, def.y);
  if (st.hp > 0) {
    g.events.push({ kind: 'post', post: i, down: false, lost: false });
    return;
  }
  st.hp = 0;
  if (def.kind === 'radar') st.lost = true;
  else st.downT = POST.batteryDown;
  addFx(g, 'boom', def.x, def.y, { life: 1.1, r: 56 });
  cue(g, st.lost ? 'post.lost' : 'post.down', def.x, def.y);
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
        cue(g, 'post.up', p.x, p.y);
        g.events.push({ kind: 'post', post: i, down: false, lost: false });
      }
      return;
    }
    st.fireT -= dt;
    if (st.fireT > 0) return;
    const target = lured(g, p.x, p.y, p.reach, g.threats
      .filter((t) => !t.dead && !isStructure(t.kind) && dist(t.x, t.y, p.x, p.y) <= p.reach && assigned(g, t.id) < t.hp)
      .sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y))[0]);
    if (!target) {
      st.fireT = 0.1;
      return;
    }
    st.fireT = POST.batteryGap;
    st.aim = Math.atan2(target.y - p.y, target.x - p.x);
    g.interceptors.push({ id: g.nextId++, x: p.x, y: p.y - 10, target: target.id, tx: target.x, ty: target.y, life: 0, src: 'gun' });
    addFx(g, 'launch', p.x, p.y - 10, { life: 0.3, r: 9 });
    // A shore battery's shot: the same burp as the carrier's Point Defense.
    cue(g, 'pd.fire', p.x, p.y);
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
  const live = list.filter((t) => !t.dead && (!isFoe(t.kind) || foeWorthShooting(g, t)));
  const strikers = live.filter((t) => !isStructure(t.kind));
  const rail = !!held(g, 'railgun');
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
  const shieldFalls = th.kind === 'generator' && !shieldUp(g) && !!g.map.shield;
  const label = shieldFalls ? 'SHIELD DOWN' : STRUCTURE_DOWN[th.kind] ?? 'DESTROYED';
  cue(g, 'structure.down', th.x, th.y);
  if (shieldFalls) cue(g, 'shield.down', th.x, th.y);
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
  cue(g, 'boss.horn', p.x, p.y);
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
  cue(g, 'boss.broadside', th.x, th.y);
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
    cue(g, 'mine.blast', th.x, th.y);
    damageShip(g, s, THREATS.mine.damage, 'mine');
    return;
  }
  if (onCarrier(g, th.x, th.y)) {
    th.dead = true;
    addFx(g, 'splash', th.x, th.y, { life: 0.9, r: 46 });
    cue(g, 'mine.blast', th.x, th.y);
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
    const hulls = g.ships.map((s) => ({ lane: s.channel, d: s.d, ext: 0 }));
    const inside = (lo: number, hi: number) =>
      hulls.some((s) => {
        const ch = g.map.channels[s.lane];
        const d0 = laneDAtX(ch, lock.x0);
        const d1 = laneDAtX(ch, lock.x1);
        if (d0 === null || d1 === null) return false;
        const a = d0 + lo - s.ext;
        const b = (hi === Infinity ? d1 : d0 + hi) + s.ext;
        return s.d >= a && s.d < b;
      });
    if (st.phase === 'in' && st.t >= LOCK.inTime && !inside(-LOCK.stand, 14)) {
      st.phase = 'fill';
      st.t = 0;
      cue(g, 'lock.gate', (lock.x0 + lock.x1) / 2, VIEW.height / 2);
    } else if (st.phase === 'fill' && st.t >= lock.wait) {
      st.phase = 'out';
      st.t = 0;
      cue(g, 'lock.gate', (lock.x0 + lock.x1) / 2, VIEW.height / 2);
    } else if (st.phase === 'out' && st.t >= LOCK.outTime && !inside(-LOCK.stand + 1, Infinity)) {
      st.phase = 'in';
      st.t = 0;
    }
  });
}

/** Saltgate: warships have priority passage. A lock gate swings open while a
 *  frigate is in its gateway (the convoy still waits its turn), so a Frigate
 *  Escort can take station anywhere on the canal within its 15 s instead of
 *  waiting ~20 s at each lock. The renderer draws that gate open. */
export function frigateAtGate(g: Game, x: number): boolean {
  // Open well before the bow reaches it (a hull's length ahead), shut once
  // the stern is through.
  return g.escorts.some((e) => {
    // Only under way: one holding station short of a lock leaves it shut.
    if (!e.leaving && Math.abs(e.d - e.sd) < 1) return false;
    const ahead = (x - e.x) * Math.sign(Math.cos(e.heading) || 1);
    return ahead > -(ESCORT_STAND + 30) && ahead < ESCORT_STAND + 130 && Math.abs(e.y - laneYAt(g, e)) < 140;
  });
}

function laneYAt(g: Game, e: Escort): number {
  return lanePoint(g.map.channels[e.lane], e.d).y;
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
  cue(g, 'fork.switch', fork.x, fork.y);
}

const FORK_NAMES = ['NORTH', 'MIDDLE', 'SOUTH'];

// ---------------------------------------------------------------------------
// Pickups

/** How long a pickup floats before it is gone. */
export function pickupLife(p: Pickup): number {
  return p.kind === 'weapon' ? WEAPON.life : PICKUPS.life;
}

function updatePickups(g: Game, dt: number): void {
  // Supply Run: drops fly to the carrier and load on arrival (a boost waits
  // for a tap: it would replace this one).
  // Under a parachute: drifting down, not yet ageing.
  for (const p of g.pickups) {
    if (!p.chute) continue;
    p.chute = Math.max(0, p.chute - dt);
    p.y += 45 * dt;
  }
  if (boostLevel(g, 'supplyRun')) {
    const c = g.map.carrier;
    for (const p of [...g.pickups]) {
      if (p.chute || (p.kind === 'weapon' && isBoost(p.weapon))) continue;
      const d = dist(p.x, p.y, c.x, c.y);
      if (d <= CARRIER.halfBeam) {
        collect(g, p);
        continue;
      }
      if (p.age < 0.35) continue;
      const st = Math.min(d, AB.supplyRun.speed * dt);
      p.x += ((c.x - p.x) / d) * st;
      p.y += ((c.y - p.y) / d) * st;
      p.age = Math.min(p.age, 1);
    }
  }
  for (const p of g.pickups) if (!p.chute) p.age += dt;
  for (const p of g.pickups) if (p.age >= pickupLife(p)) cue(g, 'powerup.expire', p.x, p.y);
  g.pickups = g.pickups.filter((p) => p.age < pickupLife(p));
}

/** Does this kill drop a weapon? Only with one held and none already on the
 *  water: a roll scaled by the threat's drop chance, or any kill once
 *  the pity clock (WEAPON.pity; Supply Lines shortens it) has run out. */
function weaponDue(g: Game, kind: ThreatKind): boolean {
  if (!g.slots.length || g.pickups.some((p) => p.kind === 'weapon')) return false;
  // Dual Wield with a hand free, or Overclock waiting for a weapon: the next
  // kill drops one (at the normal rate, one rarely came inside the boost's
  // 15 s: build 3's sweep found two hands loaded 0% of the time).
  if (callsWeapon(g) && weaponsHeld(g).length) return true;
  const m = dropMult(g, true);
  return g.weaponDropT >= g.stats.dropPity / m || g.rng.drops.chance(THREATS[kind].dropChance * g.stats.dropShare * m);
}

function dropWeapon(g: Game, x: number, y: number): void {
  g.weaponDropT = 0;
  // Overclock on a MAX weapon: that weapon drops more often. A boost that is
  // calling a weapon gets one; the boost already running isn't dealt again.
  const pin = g.boost?.id === 'overclock' ? g.boost.drops : null;
  const want = callsWeapon(g) && weaponsHeld(g).length ? weaponsHeld(g) : g.slots.filter((id) => id !== g.boost?.id);
  addPickup(g, 'weapon', x, y, pin ?? g.rng.drops.pick(want.length ? want : g.slots));
}

/** The power-ups that became boosts (phase 3). */
const BOOSTED_POWERS: [PowerKind, AbilityId][] = [['overdrive', 'overdrive'], ['timewarp', 'timeWarp'], ['shield', 'shield'], ['steam', 'fullSteam']];

/** A kill drops a power-up, picked by PICKUPS.weights. */
function dropPickup(g: Game, x: number, y: number): void {
  const base = g.map.night ? { ...PICKUPS.weights, starshell: PICKUPS.starshellWeight } : PICKUPS.weights;
  // The Nuke: not before wave nukeFrom, and one on the water at a time.
  const w = g.wave < PICKUPS.nukeFrom || g.pickups.some((p) => p.kind === 'nuke') ? { ...base, nuke: 0 } : { ...base };
  // The power-ups that became boosts leave the drops once their boost is
  // live (Free Play: now, so it plays the plan's rules).
  for (const [k, id] of BOOSTED_POWERS) if (g.freePlay || ROSTER[id].status === 'live') w[k] = 0;
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
  cue(g, kind === 'weapon' ? 'weapon.drop' : 'powerup.drop', x, y);
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
  nuke: 'NUKE',
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
    // A boost runs beside whatever is loaded (phase 3).
    if (isBoost(id)) {
      startBoost(g, id, level, p.x, p.y);
      return;
    }
    const w: Weapon = { id, level, t: g.stats.weaponTime, t0: g.t };
    // Dual Wield: it joins the loaded weapon; otherwise it takes the gun.
    if (!boostLoad(g, w)) g.weapon = w;
    // Overclock: the first weapon loaded under it (level 2: every one).
    if (g.boost?.id === 'overclock' && (g.boost.level >= 2 || g.boost.clocked === 0)) overclockWeapon(g, w);
    const timer = w === g.weapon2 ? 'passiveT2' : 'passiveT';
    if (id === 'cadence') g.beat = { last: -9, run: 0, armed: false, seen: -1 };
    if (id === 'droneScreen') g[timer] = 0.2;
    if (id === 'bomberWing') g[timer] = AB.bomberWing.first;
    if (id === 'orbital') {
      g[timer] = AB.orbital.first;
      g.orbital = null;
    }
    if (id === 'gunships') callGunships(g, w.level);
    if (id === 'frigate') launchEscorts(g, w.level);
    // Aegis: a fresh pickup rearms every hull in full.
    if (id === 'aegis') {
      for (const s of g.ships) s.aegis = undefined;
      g.carrierAegis = null;
    }
    g.uses[id] = (g.uses[id] ?? 0) + 1;
    g.events.push({ kind: 'weapon', id, level: w.level });
    cue(g, 'weapon.load', p.x, p.y);
    addFx(g, 'text', p.x, p.y - 20, { life: 1.1, text: abilityName(id, w.level).toUpperCase() + (g.weapon2 === w ? ' + ' + abilityName(g.weapon!.id, g.weapon!.level).toUpperCase() : '') });
    return;
  }
  addFx(g, 'text', p.x, p.y - 20, { life: 1.1, text: PICKUP_TEXT[p.kind] });
  cue(g, PICKUP_CUE[p.kind], p.x, p.y);
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
    case 'nuke':
      nuke(g);
      break;
  }
}

/** How far past the screen's edge the Nuke still reaches (px): anything
 *  partly in view. */
const NUKE_EDGE = 40;

/** The Nuke: everything hostile on the screen is destroyed (no drops: a
 *  screen-clear isn't a loot shower). Test Lab round 1 ("blow up everything
 *  on the screen, even the trucks, submarines, any of the vehicles"): that
 *  includes the launch trucks and submarines (raiders, not targets
 *  otherwise), every new enemy platform (a siege gun down in its hatch, a
 *  sub at periscope depth, the Lure Beacon) and every warning circle and
 *  shot on the water. The one exception, as before: structures (rigs,
 *  generators, the Citadel) and the Dreadnought boss take nukeStructure
 *  hits instead of dying. */
function nuke(g: Game): void {
  const c = g.map.carrier;
  const M = NUKE_EDGE;
  const onScreen = (x: number, y: number) => x >= -M && x <= VIEW.width + M && y >= -M && y <= VIEW.height + M;
  nukeFoes(g);
  // The Lure Beacon takes only the player's own hand; the Nuke is that.
  const byTap = g.foe.byTap;
  g.foe.byTap = true;
  for (const th of [...g.threats]) {
    if (th.dead || !onScreen(th.x, th.y)) continue;
    if (isStructure(th.kind)) damageThreat(g, th, PICKUPS.nukeStructure, false);
    else damageThreat(g, th, th.hp + 99, false);
  }
  g.foe.byTap = byTap;
  for (const r of g.raiders) if (r.state !== 'reverse' && onScreen(r.x, r.y)) knockOut(g, r);
  addFx(g, 'nuke', c.x, c.y, { life: 1.2, r: Math.hypot(VIEW.width, VIEW.height) });
}

// ---------------------------------------------------------------------------
// Sound cues (audio/cues.ts): write-only, never read by the sim.

/** A sound for this moment, at (x, y) on the battlefield. */
export function cue(g: Game, id: CueId, x: number, y: number, o?: { vx?: number; gain?: number }): void {
  g.cues.push(o ? { id, x, y, ...o } : { id, x, y });
}

/** The incoming whistle starts this long before a ballistic lands. */
export const BALLISTIC_WHISTLE = 0.9;
/** The loaded weapon's clock warns at this many seconds left. */
export const WEAPON_EXPIRING = 2;

export const KILL_CUE: Record<ThreatKind, CueId> = {
  drone: 'kill.small',
  minidrone: 'kill.small',
  bomblet: 'kill.small',
  ballistic: 'kill.missile',
  guided: 'kill.missile',
  supersonic: 'kill.missile',
  cluster: 'kill.missile',
  heavy: 'kill.big',
  mothership: 'kill.big',
  strafer: 'kill.big',
  bomber: 'kill.big',
  mine: 'mine.blast',
  fastboat: 'kill.missile',
  // Structures fall through structureDown (structure.down / shield.down).
  rig: 'structure.down',
  generator: 'structure.down',
  citadel: 'structure.down',
  dreadnought: 'structure.down',
  // The enemy build.
  sprinter: 'kill.small',
  decoy: 'kill.small',
  hydra: 'kill.missile',
  dart: 'kill.small',
  rocketTruck: 'truck.destroyed',
  attackHeli: 'kill.big',
  heliRocket: 'kill.small',
  torpedoSub: 'sub.destroyed',
  torpedo: 'kill.missile',
  armored: 'kill.big',
  scavenger: 'kill.small',
  stealthJet: 'kill.big',
  stealthBomber: 'kill.big',
  diveBomber: 'kill.big',
  siege: 'structure.down',
  spotter: 'kill.big',
  tender: 'kill.big',
  guard: 'kill.small',
  lure: 'kill.missile',
  cloud: 'kill.missile',
};

export const PICKUP_CUE: Record<PowerKind, CueId> = {
  ammo: 'rack.full',
  repair: 'repair.pickup',
  overdrive: 'overdrive.on',
  timewarp: 'timewarp.on',
  shield: 'shield.on',
  steam: 'steam.on',
  starshell: 'starshell.on',
  nuke: 'nuke.blast',
};

/** A threat leaves its launcher: a sound by kind (aircraft and children
 *  have their own). */
export const LAUNCH_CUE: Partial<Record<ThreatKind, CueId>> = {
  drone: 'drone.launch',
  minidrone: 'minidrone.spawn',
  bomblet: 'cluster.split',
  ballistic: 'ballistic.launch',
  guided: 'missile.launch',
  supersonic: 'missile.launch',
  heavy: 'missile.launch',
  cluster: 'missile.launch',
  mothership: 'mothership.spawn',
  strafer: 'strafer.pass',
  bomber: 'bomber.pass',
  mine: 'mine.drop',
  fastboat: 'fastboat.launch',
  // The enemy build (their own sounds come in its audio pass).
  sprinter: 'drone.launch',
  decoy: 'drone.launch',
  hydra: 'missile.launch',
  dart: 'cluster.split',
  rocketTruck: 'truck.raise',
  attackHeli: 'foe.rotor',
  heliRocket: 'missile.launch',
  torpedoSub: 'sub.surface',
  torpedo: 'sub.fire',
  armored: 'drone.launch',
  scavenger: 'drone.launch',
  stealthJet: 'strafer.pass',
  stealthBomber: 'bomber.pass',
  diveBomber: 'bomber.pass',
  siege: 'truck.raise',
  spotter: 'bomber.pass',
  tender: 'sub.surface',
  guard: 'minidrone.spawn',
  lure: 'mine.drop',
  cloud: 'missile.launch',
  // Structures are raised, never launched.
};

function launchCue(g: Game, th: Threat, origin: LaunchOrigin): void {
  // A bomber's missile has its own drop cue.
  if (origin === 'air' && th.kind === 'guided') return;
  // Aircraft engines are loops that follow them (audio/state.ts); their
  // warning sounded when their arrow appeared.
  if (isPlaneKind(th.kind)) return;
  const id = LAUNCH_CUE[th.kind];
  if (id) cue(g, id, th.x, th.y);
}

// ---------------------------------------------------------------------------
// Helpers

export function addFx(
  g: Game,
  kind: FxKind,
  x: number,
  y: number,
  o: { life: number; r?: number; x2?: number; y2?: number; text?: string },
): void {
  // Words never print on top of each other (playthrough round: "JET DOWN"
  // and "REPAIRED" landed on one spot): a new one steps up above any still
  // fresh nearby.
  if (kind === 'text') for (let k = 0; k < 4 && g.fx.some((f) => f.kind === 'text' && f.age < f.life * 0.7 && Math.abs(f.x - x) < 70 && Math.abs(f.y - y) < 20); k++) y -= 24;
  g.fx.push({ kind, x, y, x2: o.x2 ?? x, y2: o.y2 ?? y, r: o.r ?? 0, age: 0, life: o.life, text: o.text });
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function angleDiff(a: number, b: number): number {
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
  if (isFoe(th.kind)) {
    const eta = foeEta(g, th);
    if (eta !== null) return eta;
  }
  if (isPlaneKind(th.kind)) {
    // Until its guns (or bombs) reach the nearest hull ahead of it.
    const side = th.side ?? 1;
    const lead = isJet(th.kind) ? PLANE.gunLead : 0;
    const tx = Math.cos(th.heading);
    const ty = Math.sin(th.heading);
    let best = Infinity;
    for (const s of g.ships) {
      // Round a bend, ahead and across are measured along its route.
      const f = th.route ? planeFrame(g, th, s, th.x, th.y, tx, ty, th.route.s) : { along: (s.x - th.x) * side, across: s.y - th.y };
      const ahead = f.along - lead;
      if (ahead >= 0 && (isBomberKind(th.kind) || Math.abs(f.across) <= PLANE.band)) best = Math.min(best, ahead / th.speed);
    }
    return best === Infinity ? 30 : best;
  }
  const t = targetPos(g, th);
  const arming = th.kind === 'supersonic' ? Math.max(0, SUPERSONIC.arming - th.age) : 0;
  return arming + dist(th.x, th.y, t.x, t.y) / th.speed;
}
