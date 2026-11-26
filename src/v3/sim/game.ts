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
  TURRET,
  FASTBOAT,
  BOATS,
  BOAT_MIX,
  LOCK,
  MINE,
  RIG_SHOTS,
  CITADEL,
  SOW,
  TOW,
  FIRESHIP,
  POST,
  VIP,
  isStructure,
} from '../data/config';
import { FORMATIONS, type FormationId } from '../data/formations';
import { LANE_FLOOR, MAPS, channelCycle, halfWidthAt, slotOffset, type Channel, type MapDef, type MapId, type Point } from '../data/maps';
import { flightAt, laneAt, laneDAtX, laneHalfWidth, laneLength, laneMinRadius, lanePoint } from './lanes';
import {
  AB,
  ABILITY_MAX,
  ABILITY_ORDER,
  MAX_SLOTS,
  WEAPON,
  abilityName,
  canSwapIn,
  canTake,
  isSpecialCard,
  loadout,
  type AbilityId,
  type CardId,
  type Levels,
} from '../data/abilities';
import { armoryStats, type ArmoryLevels, type ArmoryStats } from '../data/armory';
import { draftPool, gestureOf, isBoost, knownWeapon, newInChapter, ROSTER } from '../data/roster';
import { CHAPTERS, chapterOf } from '../data/maps';
import { waveSpec } from '../data/waves';
import { FOE, FOES, HEAVY_FOES, SUB_FROM, type FoeSetting } from '../data/foes';
import { LAB_SET } from '../data/lab';
import { OLD_THREATS, enemyPair, isOldThreat, memberKind, type LabPair, type PairMember } from '../data/pairs';
import { labBusy, labCame, labFoes, labHarm, labKilled, labOpener, labShotAt, labWave, labWaveCleared, newSet, setUpLab, type LabSet, type LabSetup, type LabState } from './lab';
import { absorbs, burstCloud, crossingPair, foeEta, foeWorthShooting, guardFor, lureIn, lured, paintTarget, pickupLocked, foeCount, foeDown, foesBusy, fromBase, isFoe, launchFoe, movesItself, newFoeState, nukeFoes, planFoes, updateFoe, updateParadeTruck, updateFoeMarks, updateFoeShots, type FoeData, type FoeState, foeData, onLand } from './foes';
import type { Cue, CueId } from '../audio/cues';
import { bonusDue, endEvent, eventBusy, eventCargo, eventDropWeights, eventFoeDown, isEventWave, lastWave, nextRunDue, rerunEvent, restoreConvoy, startBonus, startEvent, updateEvent, type EventRecord, type EventRun } from './events';
import { ENDING, EVENT_WAVE, type EventId, type EventOutcome } from '../data/events';
import type { HurtSrc, TelImpact, Telemetry } from './telemetry';
import { floatPace, tideAt, type TideNow } from './tide';
import { armBoat, boatEta, updateBoat, type BoatState } from './boats';
import { calloutsOn, calmBefore, dreadPasses, encountersFor, firstBeatAt, hiddenMinesOn, setupVersion, shieldRisesOn, shotRigsOn, signatureOf, swapFoe, tideClock, waveFire, waveScale, type BeaconCall, type BeatAim, type DreadPass, type Encounter, type EncounterSetup } from '../data/encounters';
import { commandState, convoyWaveEnd, flowLocked, formationLocked, formationNow, groupSailed, holdPace, updateConvoy, type ConvoyState } from './convoy';
import type { CommandId } from '../data/convoy';

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

/** Everything that flies and is not itself a munition: the planes, the
 *  attack helicopter, the dive bomber, the Spotter and the drone
 *  mothership. */
export function isAircraftKind(k: ThreatKind): boolean {
  return isPlaneKind(k) || k === 'attackHeli' || k === 'diveBomber' || k === 'spotter' || k === 'mothership';
}

/** Point Defense's targets (round 11, the player: "The point defense should
 *  not shoot down planes, only the munitions from the planes"): what does
 *  its harm by hitting a hull (a missile, a bomb or bomblet, a rocket, a
 *  drone, a torpedo, a boat that rams), never an aircraft, nor a launcher
 *  or a support (a truck, a siege gun, a sub, a beacon...). The munitions
 *  aircraft drop or fire are threats of their own, each aimed at a hull
 *  (`target`): a bomber's guided missiles, the helicopter's missiles, a
 *  cluster's bomblets, the firebomb. A strafer's guns hit the hulls under
 *  it directly and a dive bomber's bomb is a red shot: nothing in the air
 *  to intercept. */
export function isMunitionKind(k: ThreatKind): boolean {
  return !isAircraftKind(k) && (THREATS[k].damage > 0 || k === 'cluster');
}

/** Is it away from its launcher? Round 13 (the player, The Strait, wave 6:
 *  "You should not be allowed to attack any enemy munitions until it's
 *  actually released from its launcher"): a munition still on its launcher
 *  is part of the launcher, not a threat in the air. Nothing aims at it,
 *  hits it, drags or holds it: not a tap, not a helper, not a blast or a
 *  field. Only the Nuke takes it, with everything else on the map. The one
 *  munition that waits on its launcher as a threat is the supersonic,
 *  arming on its rail with its lock line showing; every other munition is
 *  spawned as it leaves (docs/design/v3-round13-escorts-munitions-nuke.md
 *  has the table). Dead threats aren't released either: this is the check
 *  every target scan makes. Log v27 (the player, Harbor Mouth: "you can
 *  attack it basically as soon as it is off the truck"): the rail is the
 *  first SUPERSONIC.rail (0.4 s) of its lock only; then it lifts off and is
 *  a target, its lock line still showing. */
export function released(th: Threat): boolean {
  return !th.dead && !racked(th) && !untouchable(th) && !th.hidden;
}

/** A supersonic still on its launcher's rail (round 13): no target yet. */
function racked(th: Threat): boolean {
  return th.kind === 'supersonic' && th.age < SUPERSONIC.rail;
}

/** The Torpedo Sub stays under water, its periscope up (the 2026-11-20
 *  playtest: "should not be able to be attacked only their torpedoes can";
 *  log v34): no shot, blast or helper touches it, nor the Nuke. It dives
 *  away on its own once it has fired. */
export function untouchable(th: Threat): boolean {
  return th.kind === 'torpedoSub';
}

/** A supersonic's share of its full speed at `age` (log v27): none on the
 *  rail, then a slow lift-off ramping up to full over `SUPERSONIC.lift` s. */
export function supersonicPace(age: number): number {
  const S = SUPERSONIC;
  if (age < S.rail) return 0;
  return S.liftFrom + (1 - S.liftFrom) * Math.min(1, (age - S.rail) / S.lift);
}

/** The seconds a supersonic of `age` will lose to its rail and lift-off
 *  against flying at full speed from now (its arming, for the bots and the
 *  helpers' timing). */
export function supersonicDelay(age: number): number {
  const S = SUPERSONIC;
  const s = Math.max(0, age - S.rail);
  const lifting = s < S.lift ? ((1 - S.liftFrom) * (S.lift - s) ** 2) / (2 * S.lift) : 0;
  return Math.max(0, S.rail - age) + lifting;
}

export interface Ship {
  id: number;
  /** Log v66 (a map's `autoHold`): paused in front of a mine this step. */
  mineHold?: boolean;
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
  /** A sowing bomber (log v70): guided missiles it drops at a ship once its mines are down. */
  sowRack?: number;
  dropT?: number;
  /** Log v48 (Sowers' Reach, MAP_SIGNATURE `sow`): a stealth bomber that
   *  sows mines ahead of the ships in place of its missiles (`bombs` is the
   *  mines it still carries). */
  sow?: boolean;
  /** The sub or truck that fired it. */
  from?: number;
  /** Telemetry only: the authored encounter (data/encounters.ts) that
   *  sent it. */
  enc?: string;
  /** An encounter's easy filler (Beat `filler`, log v47): it drops nothing
   *  when shot down (and the telemetry tags it). */
  filler?: boolean;
  /** Telemetry only (nothing in the sim reads it): what launched it when
   *  that is not a base, a sub or a truck: the bomber or helicopter that
   *  dropped it, the threat it split off, the warning mark it came up from. */
  src?: number;
  /** A structure: the base it stands on (rigs, generators, the Citadel). */
  base?: number;
  /** Log v49 (The Rig Field, MAP_SIGNATURE `kind: 'rig'`): a relief rig on
   *  its way in, towed along the rig line to this station (a base's index);
   *  it stands there once it docks (towRig). */
  tow?: number;
  /** Log v49: a missile off a docked relief rig's rack (the signature's). */
  rack?: boolean;
  /** Log v55 (round 15, Sowers' Reach under the layer, HIDDEN_MINES): a
   *  mine adrift out of sight: nothing sees, shoots or draws it until a
   *  ship's course would bring it onto the mine within MINE.surface s;
   *  then it surfaces (`surfacedT`, game seconds, for the UI's pop). */
  hidden?: boolean;
  surfacedT?: number;
  /** Log v55 (round 15, the Rig Field, SHOT_RIGS): the step and the area
   *  weapons that have already counted a shot on this rig in it (a burst
   *  counts once a rig, however many of its fragments land). */
  shotStep?: number;
  shotBy?: string[];
  /** Log v55 (UI only, nothing in the sim reads them): a relief rig's
   *  docking (game seconds) and the side its tug came from (+1: from the
   *  left), for the tow's arrival and the tug casting off. */
  dockT?: number;
  towDir?: number;
  /** Log v53 (The Coves, MAP_SIGNATURE `fireShips`, and its Fire Fleet): a
   *  fire ship, a fast boat set alight (FIRESHIP): where it is sunk, or
   *  where it rams, its fireball burns on the water (foes.ts burstCloud). */
  /** Log v59 (Tidewater Flats): launched at the crowd (BeatAim 'crowd'), the
   *  ebb's fire; a cluster's bomblets carry it. For the tools' counts only. */
  ebb?: boolean;
  fire?: boolean;
  /** Log v60 (The Citadel, MAP_SIGNATURE `dome`, and its Last Stand): a
   *  launch off the Citadel under its dome: while the shield stands it
   *  can't be shot inside the dome (`domed`). */
  dome?: boolean;
  /** Log v58 (Dunmar Crossing): a shell a spotter beacon called. */
  called?: boolean;
  /** Grapnel or Chain Shot has hold of it: it doesn't fly its own course
   *  (and can't hit anything) until let go. */
  held?: boolean;
  /** The Dreadnought: how far along its path it has steamed, and seconds to
   *  its next broadside. */
  along?: number;
  fireT?: number;
  /** Log v67 (Dreadnought Pass, TURRET): a gun turret's ship (`from`), place
   *  on its hull (`slot`), where its barrel points (`rot`, radians) and the
   *  game second it, or the silo, last fired (`shotT`; the drawing's recoil,
   *  muzzle flash and hatches). */
  slot?: number;
  rot?: number;
  shotT?: number;
  /** Log v51 (Dreadnought Pass, lab only): its pass's own numbers
   *  (data/encounters.ts DreadPass), and seconds left on station while it
   *  heaves to. */
  dread?: DreadPass;
  holdT?: number;
  /** The enemy build: a new enemy's own state (sim/foes.ts). */
  foe?: FoeData;
  /** Log v69 (The Coves' boats, data/config.ts BOATS): which fast boat this
   *  is, a gunboat or a rocket boat (none: a speedboat), and its own state
   *  (sim/boats.ts). */
  boat?: 'gun' | 'rocket';
  bs?: BoatState;
  /** Its full hull when a special event made it tougher than its kind
   *  (THREATS[kind].hp otherwise): what a Repair Tender mends it up to. */
  maxHp?: number;
  /** A special event's supply drone: shot down, it drops a pickup. */
  cargo?: boolean;
  /** An original threat an enemy pair's set brought (data/pairs.ts), not
   *  the wave's own. */
  paired?: boolean;
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
  /** The enemy build: fired by the player's own hand (a tap's shot, and
   *  since round 11 its seekers, a shell onto open water and War Drum's
   *  broadside): the Lure Beacon takes only such shots. */
  tap?: boolean;
  /** Hyper Overdrive's second shot, fired from its own muzzle beside the
   *  first (the renderer draws it a shade lighter). */
  twin?: boolean;
  /** Telemetry only: the helper that fired it (a frigate, Aegis, Point
   *  Defense, a shore battery, War Drum's broadside). */
  by?: HurtSrc;
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

export type FxKind = 'fireball' | 'boom' | 'splash' | 'tracer' | 'launch' | 'burst' | 'text' | 'sink' | 'spout' | 'spray' | 'flak' | 'block' | 'beam' | 'arc' | 'emp' | 'frag' | 'thermo'
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
  /** Drawn for Hyper Overdrive's second shot (a beam, a cut, a blast). */
  twin?: boolean;
}

export type GameEvent =
  | { kind: 'wave'; wave: number }
  | { kind: 'debut'; threat: ThreatKind }
  | { kind: 'vector'; vector: RaiderKind }
  | { kind: 'shipLost'; lost: number }
  | { kind: 'life'; lives: number }
  | { kind: 'goldBomb' }
  | { kind: 'carrierHit'; hp: number }
  /** A tough threat (3+ hits) went down: the UI gives it a punch. */
  | { kind: 'bigKill'; threat?: ThreatKind; label?: string; x: number; y: number }
  | { kind: 'pickup'; pickup: PickupKind }
  /** The first time a kind of pickup drops this game (UI explains it). */
  | { kind: 'newPickup'; pickup: PickupKind }
  /** A weapon pickup loaded the gun (level = the weapon's level). */
  | { kind: 'weapon'; id: AbilityId; level: number }
  /** Wild Card's pickup brought this passive (Test Lab round 8). */
  | { kind: 'wild'; id: AbilityId; level: number }
  | { kind: 'dry' }
  /** The 20-map plan: a supertanker sets sail; an allied structure is hit or
   *  lost; the Dreadnought arrives; the Delta's switch is thrown. */
  | { kind: 'tanker' }
  | { kind: 'post'; post: number; down: boolean; lost: boolean }
  | { kind: 'boss' }
  | { kind: 'fork'; lane: number }
  /** A special event begins (its card), and how it ended (its banner): a
   *  bonus event, or which run of the map's event of how many. */
  | { kind: 'special'; id: EventId; wave: number; bonus?: boolean; run?: number; runs?: number }
  | { kind: 'specialEnd'; id: EventId; outcome: EventOutcome; bonus: number; bonusEvent?: boolean; run?: number; runs?: number }
  /** Round 7's experiment: the convoy and the carrier restored to full
   *  before the ending's first run. */
  | { kind: 'restore' }
  /** The Map & Convoy Lab (round 12): an authored encounter starts (its
   *  warning is up), on a run with its call-outs on. */
  | { kind: 'encounter'; id: string };

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
  /** Lifeboats: extra lives the run holds as the wave ends (absent: none). */
  lives?: number;
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
  /** A special event's supply drone (the Bombardment): shot down, it drops
   *  a pickup. */
  cargo?: boolean;
  /** Brought by an enemy pair's set (data/pairs.ts). */
  paired?: boolean;
  /** An authored encounter's launch (data/encounters.ts): its id, and who
   *  it is aimed at as it leaves. */
  enc?: string;
  aim?: BeatAim;
  /** An encounter's easy filler (Beat `filler`, log v47). */
  filler?: boolean;
  /** A Rocket Truck (log v42, Saltgate Canal): the pop-up road it takes
   *  (its index; absent, one at random), its salvos (absent, its own) and
   *  its speed driving in (× its own). */
  road?: number;
  salvos?: number;
  drive?: number;
  /** Log v48 (Sowers' Reach, MAP_SIGNATURE `sow`): a stealth bomber that
   *  sows this many mines ahead of the ships in place of its missiles. */
  sow?: number;
  /** Log v49 (The Rig Field): a docked relief rig's rack. */
  tow?: boolean;
  /** Log v53 (The Coves): a fast boat that comes as a fire ship. */
  fire?: boolean;
  /** Log v69 (The Coves): a fast boat that comes as a gunboat or a rocket boat. */
  boat?: 'gun' | 'rocket';
  /** Log v60 (The Citadel): a launch off the Citadel under its dome. */
  dome?: boolean;
  /** Log v58 (Dunmar Crossing): a Lure Beacon that rises at the crossing
   *  and calls shells (BeaconCall); a shell a beacon called; an authored
   *  launch aimed only at the ships of one lane (Beat `lane`). */
  beacon?: BeaconCall;
  called?: boolean;
  inLane?: number;
}

/** What a launcher carries: a single missile, or a drone swarm of `size`. */
interface Unit {
  kind: ThreatKind;
  size: number;
  /** Log v53 (The Coves, MAP_SIGNATURE `fireShips`): a fire ship. */
  fire?: boolean;
  /** Log v69 (The Coves): a gunboat or a rocket boat. */
  boat?: 'gun' | 'rocket';
}

/** Launch platforms that are not targets (round 4): a submarine surfacing in
 *  open water, a truck that drives to the shore and back, a truck that runs
 *  the whole shore road. */
export type RaiderKind = 'sub' | 'popup' | 'runner' | 'parade';
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
  /** An authored encounter's launcher: its id and its aim. */
  enc?: string;
  aim?: BeatAim;
  /** A parade truck (log v71, Saltgate Canal's Gatecrashers): the launches
   *  it has coming (wave seconds, and the lock its ship is held at, -1
   *  any), the missiles it carries, the seconds it raises each, how fast
   *  it drives (px/s) and the ship its launch is marked on. */
  fires?: { at: number; lock: number }[];
  left?: number;
  lift?: number;
  speed?: number;
  mark?: number;
}

export interface RaiderSpawn {
  at: number;
  kind: RaiderKind;
  path: Point[];
  units: Unit[];
  enc?: string;
  aim?: BeatAim;
  /** A parade truck: its missiles, raise seconds and speed (see Raider). */
  parade?: { missiles: number; lift: number; speed: number };
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
  /** A berthed frigate (a map with locks, MapDef.berths): the end of its
   *  lane it sailed in from (-1 the start, 1 the end) and backs out to. */
  from?: -1 | 1;
  /** A lane frigate leaving (round 13): on down the lane (1), or backing
   *  out the way it came (-1) where a narrows ahead has no room beside the
   *  convoy. */
  out?: -1 | 1;
  /** Log v29: seconds it still holds the offset it stepped out to for a
   *  hull, and its sideways drift (radians off the lane), smoothed. */
  holdT?: number;
  drift?: number;
  /** Log v29: its last step across while steering for its track (px), for
   *  smoothing the next one. */
  vl?: number;
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
  /** Log v55 (the Rig Field, SHOT_RIGS): rigs this field has counted its
   *  one shot on (a flak cloud or a burning row counts once a rig). */
  rigs?: number[];
}

/** The weapon loaded in the main gun, at its level, for `t` more seconds. */
export interface Weapon {
  id: AbilityId;
  level: number;
  t: number;
  /** When it was loaded (Cadence Gun counts its beats from here). */
  t0?: number;
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
  /** Laser Cutter: what the round being cut has hit, how far it has cut
   *  (a round per AB.cutter.length; the press keeps cutting, round after
   *  round, until the finger lifts), and Hyper Overdrive's twin line's hits. */
  cut: number[];
  cutLen: number;
  cut2?: number[];
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
  /** Thrown under Hyper Overdrive: it bursts twice. */
  twin?: boolean;
  /** The threats it has run into (each set off one burst). */
  hits?: number[];
}


/** Drone Screen: one of your drones, flying to ram its target. */
export interface Wing {
  id: number;
  x: number;
  y: number;
  heading: number;
  target: number | null;
  /** Seconds it may still hunt; then it flies home (Test Lab round 8). */
  life: number;
  /** Back on the deck: it is gone. */
  landed?: boolean;
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
  /** Test Lab round 5 ("it should face the target when firing"): the
   *  threat it is turning to fire at (-1: none), and how long it has been
   *  turning to it. */
  aim: number;
  aimT: number;
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

/** Bomber Wing: a bomber on its pass over a target. It crosses the screen
 *  at AB.bomberWing.speed and its bomb lands as it passes over (Test Lab
 *  round 5: nothing happens before it gets there). */
export interface Sortie {
  id: number;
  x: number;
  y: number;
  vx: number;
  tx: number;
  ty: number;
  hit: boolean;
  /** truck: a launch truck or sub (a raider's id); silo: a base's index;
   *  tunnel: a raider spawn still to come (the spawn itself); air / sub: an
   *  aircraft or a torpedo sub (a threat's id: it follows it); lure: a Lure
   *  Beacon's threat id (the pass is wasted on it). */
  kind: 'truck' | 'silo' | 'tunnel' | 'lure' | 'air' | 'sub';
  ref: number;
  /** The tunnel's spawn (cancelled when the bomb lands). */
  spawn?: RaiderSpawn;
  /** Seconds it has been on screen, and whether its run sound has started. */
  seen: number;
  cued: boolean;
  /** Silo: seconds of silence it brings. */
  quiet: number;
}


/** A raid of the current wave: when it starts, its theme, and the bases it
 *  fires from (lit up during the warning). */
export interface Raid {
  at: number;
  theme: RaidTheme;
  bases: number[];
  /** Log v55 (HIDDEN_MINES): nothing in it but hidden mines, so no warning
   *  (the player: "mines don't need a warning system like the silos"). */
  quiet?: boolean;
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
  /** Tidewater Flats (log v61, lab only, under the encounter layer): this
   *  wave's low water, from and to (s of the wave), on the tide's own clock
   *  for the wave (data/encounters.ts MAP_TIDE) or the boss round's; absent,
   *  the tide runs on the map's clock (MapDef `tide`). */
  ebb?: [number, number];
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
  /** Quartermaster (Armory): draft re-rolls left this run, golden bombs
   *  left (level 3+: the Nuke, set off when the player taps it), and free
   *  weapon level-ups left (level 5). */
  rerolls: number;
  bombsLeft: number;
  freeLevelsLeft: number;
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
  /** Log v67 (The Citadel; the drawing's timeline, nothing in the sim reads
   *  it): the game seconds the Citadel last fell, the shield last dropped
   *  and was last raised (or rebuilt). */
  cit: { fellAt: number; domeDownAt: number; domeUpAt: number };
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
  /** Wild Card (level 2 up, Test Lab round 8: "it should just give you a
   *  random one, so it can be escort or heli etc., just one you get for the
   *  pickup"): the random passive its pickup brought, working on its own
   *  clock beside the gun, and that passive's own clock. */
  wildPassive: Weapon | null;
  passiveTW: number;
  /** Focus: its button is held (its own input, `focusHold`: it only slows
   *  time; every tap on the water is a shot), and since when (realT). Test
   *  Lab round 8 made it a button on the left edge, held with the left
   *  thumb: no long-press to tell a hold from a tap any more. */
  finger: boolean;
  fingerT: number;
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
  /** A special event running (sim/events.ts), and every one met this run. */
  event: EventRun | null;
  eventLog: EventRecord[];
  /** Bonus events played this run (each plays once). */
  bonusDone: EventId[];
  /** Ships lost before the convoy was restored (round 7's three-run
   *  ending): they stay in `lost`, but no longer count against the run's
   *  limit. */
  lossBase: number;
  /** Lifeboats (Armory): extra lives this run (level 5's start, and each
   *  Lifeboat card taken in a draft): ships the run can lose on top of its
   *  limit (`lossLimit`). The convoy restored before the ending keeps them. */
  extraLives: number;
  /** The Map & Convoy Lab's telemetry (sim/telemetry.ts): null unless a
   *  run asked for it. It only watches: nothing in the sim reads it. */
  tel: Telemetry | null;
  /** The Map & Convoy Lab's convoy policy and commands (sim/convoy.ts):
   *  null in every campaign run, which plays as it always has. */
  convoy: ConvoyState | null;
  /** The Map & Convoy Lab's authored encounters (data/encounters.ts): null
   *  in every campaign run, which plays the shared waves alone. */
  enc: EncState | null;
}

/** The authored encounters of a run (data/encounters.ts): its setup, the
 *  encounters played so far, the wave planned and its encounters; the
 *  enemy pairs still to launch this wave (v3: the Test Lab's combo sets,
 *  each with its own pair); and the call-outs still to come (round 12). */
export interface EncState {
  setup: EncounterSetup;
  played: string[];
  wave: number;
  now: string[];
  sets: LabSet[];
  calls: { at: number; id: string }[];
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
  /** Seconds it has run. */
  age: number;
  /** Shield: the hits it can still stop (AB.shield.hits) before it breaks,
   *  and the step and kind of the last one (a blast that reaches several
   *  hulls at once is one hit). */
  hits?: number;
  hitAt?: string;
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
    rerolls: s.rerolls,
    bombsLeft: s.goldBombs,
    freeLevelsLeft: s.freeLevels,
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
    cit: { fellAt: -99, domeDownAt: -99, domeUpAt: -99 },
    bossWave: 0,
    flareT: 0,
    boost: null,
    weapon2: null,
    passiveT2: 0,
    wildPassive: null,
    passiveTW: 0,
    finger: false,
    fingerT: 0,
    focusing: false,
    realT: 0,
    freePlay: false,
    foe: newFoeState(mapId),
    lab: null,
    event: null,
    eventLog: [],
    bonusDone: [],
    lossBase: 0,
    extraLives: s.startLives,
    tel: null,
    convoy: null,
    enc: null,
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
    const pick = g.offer.find((id): id is AbilityId => !isSpecialCard(id) && canTake(g.levels, id));
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
  g.ebb = undefined;
  g.offer = [];
  const spec = waveSpec(g.wave, g.map.threatScale);
  // A special event is a wave of its own: its script launches in place of
  // the raid planner (sim/events.ts).
  if (isEventWave(g)) {
    g.waveSpeed = spec.speed;
    g.events.push({ kind: 'wave', wave: g.wave });
    // Round 7's experiment: the convoy and the carrier restored to full
    // right before the ending's first run.
    // (A map card's full run in the Test Lab too: it is the campaign's.)
    if ((!g.lab || g.lab.full) && ENDING.threeRuns && g.wave === EVENT_WAVE) restoreConvoy(g);
    startEvent(g);
    cue(g, 'wave.start', VIEW.width / 2, VIEW.height / 2);
    return;
  }
  const len = g.tempo.waveLen;
  if (len !== 1) {
    spec.duration *= len;
    spec.drones = cut(spec.drones, len);
    spec.ballistic = cut(spec.ballistic, len);
    spec.guided = cut(spec.guided, len);
  }
  g.waveSpeed = spec.speed;
  // Log v60 (The Citadel, SHIELD_RISES): the shield is raised again for
  // every wave. Log v67 (the player: "it was down in wave 4, it should
  // really only be destroyed once, but it will come back for the boss
  // wave"): until the Citadel falls; once it has, it and its generators
  // stay down for the rest of the waves, and only the boss rebuilds them
  // (sim/events.ts lastStand).
  if (shieldRises(g) && !citadelDown(g)) raiseShield(g, CITADEL.generator, CITADEL.citadel);
  const only = g.enc?.setup.only;
  const version = setupVersion(g.enc?.setup);
  const authored = g.enc ? encountersFor(g.map.id, g.wave, version, g.enc.setup.rev).filter((e) => !only || only.includes(e.id)) : [];
  // A version's wave budget (round 12, v2's set pieces): its quiet waves
  // give up part of their drones and missiles, its set pieces take more.
  const scale = g.enc ? waveScale(g.map.id, version, g.wave) : 1;
  if (scale !== 1) {
    spec.drones = Math.round(spec.drones * scale);
    spec.ballistic = Math.round(spec.ballistic * scale);
    spec.guided = Math.round(spec.guided * scale);
  }
  // The Test Lab: the wave's size and this wave's scenario.
  const labMods = labWave(g, spec);
  const rng = g.rng.threats;
  const lead = RULES.waveLeadIn;
  const queue: Launch[] = [];
  // Tidewater Flats (log v61, MAP_TIDE): the wave's own tide, its low water
  // at a beat's moment.
  const clock = g.enc ? tideClock(g.map.id, g.wave, g.enc.setup) : undefined;
  if (clock && g.map.tide) {
    const at = lead + RAID.warn + clock.ebb * spec.duration;
    g.ebb = [at, at + clock.low];
  }
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
  // A map's signature threat (log v33, round 9; lab only, MAP_SIGNATURE):
  // the planner's new enemies, drawn as ever (so the dice don't move), then
  // the first of them stand in as the map's own, each taking out of the
  // wave what the one it stands in for would have (so the wave's launches
  // are the shared wave's, rule w-budget).
  const sig = g.enc ? signatureOf(g.map.id, g.wave, g.enc.setup) : undefined;
  const drawn = labFoes(g, cut(foeCount(g.wave), len)) ?? planFoes(g, cut(foeCount(g.wave), len));
  const signed = sig?.foe || sig?.kind ? Math.ceil(drawn.length * (sig.foeShare ?? 1)) : 0;
  // One drone out of the wave's own (the biggest swarm in a raid, else the
  // biggest that trickles in), for a signature's extra launch.
  const takeDrone = (): boolean => {
    const r = units.reduce((b, u, i) => (u.kind === 'drone' && (b < 0 || u.size > units[b].size) ? i : b), -1);
    if (r >= 0) {
      if (--units[r].size <= 0) units.splice(r, 1);
      return true;
    }
    const t = swarms.slice(0, trickle).reduce((b, n, i) => (n > 1 && (b < 0 || n > swarms[b]) ? i : b), -1);
    if (t < 0) return false;
    swarms[t]--;
    return true;
  };
  for (let k = 0; k < drawn.length; k++) {
    // Log v42 (MAP_FOE_SWAP, lab only): Saltgate Canal sends no Torpedo
    // Sub; one drawn comes as a Rocket Truck (as heavy, so the wave sends
    // the same).
    const id = swapFoe(g.map.id, g.wave, drawn[k], g.enc?.setup);
    // A Torpedo Sub drawn before its map lets it in stays a drone swarm.
    if (id === 'torpedoSub' && k >= signed && g.wave < (SUB_FROM[g.map.id] ?? 0)) continue;
    replace('drone', 1);
    if (HEAVY_FOES.includes(id)) replace(units.some((u) => u.kind === 'guided') ? 'guided' : 'ballistic', 1);
    // The Needle of Bosk (log v35, MAP_SIGNATURE `block`): a small wall of
    // armored drones out of one base. The wall stands in for a swarm as any
    // new enemy does, and its other drones come out of the wave's own, one
    // for one (the biggest swarm in a raid, else the biggest that trickles
    // in), so the wave sends no more (rule w-budget).
    let size = 1;
    if (k < signed && sig!.block) {
      for (let more = sig!.block - 1; more > 0; more--) {
        if (!takeDrone()) break;
        size++;
      }
    }
    // The Archipelago (log v37, MAP_SIGNATURE `escort`): a Scavenger Drone
    // with each mothership, its launch one drone out of the wave's own.
    if (k < signed && sig!.escort && takeDrone()) units.push({ kind: FOES[sig!.escort].kind, size: 1 });
    // Dunmar Crossing (log v58, MAP_SIGNATURE `beacons`): a spotter
    // beacon's calls come out of the wave's own shells, one for one (else
    // its guided missiles, else its drones), so the wave sends no more.
    if (k < signed && sig!.beacons)
      for (let c = sig!.beacons.calls; c > 0; c--) {
        const i = units.findIndex((u) => u.kind === 'ballistic');
        const j = i >= 0 ? i : units.findIndex((u) => u.kind === 'guided');
        if (j >= 0) units.splice(j, 1);
        else takeDrone();
      }
    // The Archipelago (log v37, MAP_SIGNATURE `kind`): one of the map's own
    // threat kinds (a drone mothership) in place of the enemy.
    units.push({ kind: k < signed ? (sig!.kind ?? FOES[sig!.foe!].kind) : FOES[id].kind, size });
  }
  // The lab's authored encounters: what each will send comes out of the
  // wave as it now stands (after the aircraft and the new enemies took
  // their places), launch for launch, so the wave is no bigger for them.
  const trickled = swarms.slice(0, trickle);
  if (authored.length) makeRoom(units, trickled, authored);
  // Battery Point (log v45, MAP_SIGNATURE `stealth`): the wave's own strike
  // jets come in dark, as Stealth Strafers, one for one.
  if (sig?.stealth) for (const u of units) if (u.kind === 'strafer') u.kind = 'stealthJet';
  // The Coves (log v53, MAP_SIGNATURE `fireShips`): so many of the wave's own
  // fast boats (what is left of them after its encounters) come as fire
  // ships, one for one, so the wave sends no more launches (rule w-budget).
  // They come out of the coves themselves (a fast boat in a raid may go to
  // a truck or a sub), the coves in turn, spread over the wave, each cove
  // lit as a raid's base first.
  let fireShips = 0;
  if (sig?.fireShips) {
    const want = sig.fireShips[Math.min(g.wave, 10) - sig.from] ?? 0;
    for (let i = units.length - 1; i >= 0 && fireShips < want; i--)
      if (units[i].kind === 'fastboat') {
        units.splice(i, 1);
        fireShips++;
      }
  }
  // The Coves (log v69): the wave's own fast boats out of the coves are not
  // all speedboats: from wave 3 every third is a gunboat, from wave 6 every
  // fourth (from its third) a rocket boat (BOAT_MIX).
  if (g.map.bases.some((b) => b.cove)) {
    let k = 0;
    for (const u of units)
      if (u.kind === 'fastboat' && !u.fire) {
        if (g.wave >= BOAT_MIX.rocketFrom && k % BOAT_MIX.rocketEvery === 2) u.boat = 'rocket';
        else if (g.wave >= BOAT_MIX.gunFrom && k % BOAT_MIX.gunEvery === 1) u.boat = 'gun';
        k++;
      }
  }
  // Tidewater Flats (log v61, MAP_SIGNATURE `ebb`): so many of the wave's
  // own clusters, then its shells, are held for the ebb and come as cluster
  // missiles at the crowd, one for one (rule w-budget).
  let ebbStrike = 0;
  if (sig?.ebb && g.ebb) {
    const want = sig.ebb[Math.min(g.wave, 10) - sig.from] ?? 0;
    for (const kind of ['cluster', 'ballistic'] as const)
      for (let i = units.length - 1; i >= 0 && ebbStrike < want; i--)
        if (units[i].kind === kind) {
          units.splice(i, 1);
          ebbStrike++;
        }
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
  // A breath before an authored climax (encounters rev 4, `calm`): the
  // raids that would fly in the quiet before it start early enough to be
  // over by then (a sub's salvo is the longest a raid runs). Only an
  // encounter that asks for it, so every other wave is planned as before.
  const hush = authored.find((e) => e.calm);
  const quietAt = hush ? firstBeatAt(hush, lead, RAID.warn, spec.duration) : 0;
  if (hush) calmBefore(raids.map((r) => r.at), quietAt, hush.calm!, Math.max(RAID.window, SUB.salvo * SUB.gap), lead).forEach((at, k) => (raids[k].at = at));
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
  const hidden = hiddenMines(g);
  let besides = 0;
  raids.forEach((raid, r) => {
    for (const u of raidUnits[r]) {
      const at = raid.at + rng.range(0, RAID.window);
      if (u.kind === 'strafer' || u.kind === 'bomber') {
        queue.push({ at, kind: u.kind, base: -1, side: rng.chance(0.5) ? 1 : -1, ...(u.kind === 'strafer' && sig?.jets ? { aim: sig.jets } : {}) });
        continue;
      }
      // The Rig Field (log v49, MAP_SIGNATURE `kind: 'rig'`): a relief rig
      // towed in from an edge, not out of a base.
      if (u.kind === 'rig') {
        queue.push({ at, kind: 'rig', base: -1 });
        continue;
      }
      // A new enemy that doesn't come out of a base comes on its own.
      if (isFoe(u.kind) && !fromBase(u.kind)) {
        // Saltgate Canal (log v42, MAP_SIGNATURE `trucks`): the wave's
        // Rocket Trucks fire at the ships held at the locks.
        // Sowers' Reach (log v48, MAP_SIGNATURE `sow`): its stealth bombers
        // sow mines ahead of the ships in place of their missiles.
        // The Black Strait (log v52, MAP_SIGNATURE `beside`): its siege
        // guns rise beside the bases of the enemy's dark bank, in turn.
        const beside = u.kind === 'siege' && sig?.beside?.length ? sig.beside[besides++ % sig.beside.length] : -1;
        const salvos = beside >= 0 && sig?.salvos !== undefined ? { salvos: sig.salvos } : {};
        queue.push({ at, kind: u.kind, base: beside, ...salvos, ...(u.kind === 'rocketTruck' && sig?.trucks ? { aim: sig.trucks } : {}), ...(u.kind === 'stealthBomber' && sig?.sow ? { sow: sig.sow } : {}), ...(u.kind === 'lure' && sig?.beacons ? { beacon: sig.beacons } : {}) });
        continue;
      }
      const base = pickBase(g, u.kind, rng);
      // Log v55 (HIDDEN_MINES): a chute's hidden mines light nothing.
      if (base >= 0 && !raid.bases.includes(base) && !(u.kind === 'mine' && hidden)) raid.bases.push(base);
      // Saltgate Canal (log v38, MAP_SIGNATURE `clusters`): the wave's own
      // cluster missiles go for the ships held at the locks.
      // The Delta (log v57, MAP_SIGNATURE `clouds`): the wave's
      // Incendiary Missiles burst on the switch's branch.
      const aim = u.kind === 'heavy' && sig?.heavies ? { aim: sig.heavies } : u.kind === 'cluster' && sig?.clusters ? { aim: sig.clusters } : u.kind === 'cloud' && sig?.clouds ? { aim: sig.clouds } : {};
      for (let d = 0; d < u.size; d++) queue.push({ at: at + d * 0.35, kind: u.kind, base, ...aim, ...(u.fire ? { fire: true } : {}), ...(u.boat ? { boat: u.boat } : {}) });
    }
  });
  if (hidden) raids.forEach((raid, r) => (raid.quiet = raidUnits[r].length > 0 && raidUnits[r].every((u) => u.kind === 'mine')));
  g.raids = raids;
  if (authored.length) planEncounters(g, authored, queue, lead, spec.duration);
  if (ebbStrike && g.ebb) {
    const base = sig!.ebbBase ?? 0;
    for (let k = 0; k < ebbStrike; k++) {
      const at = g.ebb[0] + 3 + k * 3;
      queue.push({ at, kind: 'cluster', base, aim: 'crowd' });
      g.raids.push({ at, theme: RAID_THEME.cluster, bases: [base] });
    }
  }
  if (fireShips) {
    const coves = g.map.bases.map((x, i) => (x.cove && x.kinds.includes('fastboat') ? i : -1)).filter((i) => i >= 0);
    for (let k = 0; k < fireShips && coves.length; k++) {
      const at = lead + RAID.warn + (spec.duration * (k + 1)) / (fireShips + 1);
      const base = coves[(g.wave + k) % coves.length];
      queue.push({ at, kind: 'fastboat', base, fire: true });
      g.raids.push({ at, theme: RAID_THEME.fastboat, bases: [base] });
    }
  }
  trickled.forEach((size, k) => {
    const base = pickBase(g, 'drone', rng);
    let at = lead + (spec.duration * (k + 0.5)) / Math.max(1, trickled.length) + rng.range(-2, 2);
    if (hush && at < quietAt && at + size * 0.35 > quietAt - hush.calm!) at = Math.max(lead, quietAt - hush.calm! - size * 0.35);
    for (let d = 0; d < size; d++) queue.push({ at: at + d * 0.35, kind: 'drone', base });
  });
  // The Citadel (log v60, MAP_SIGNATURE `dome`): so many of the wave's own
  // guided missiles and shells (what is left after its encounters) the
  // Citadel launches under its dome, spread over the wave, its keep lit as
  // a raid's base first; one for one, so the wave sends no more (with none
  // left, a guided missile in place of two drones).
  const core = g.map.bases.findIndex((b, i) => !!b.core && !g.baseDown[i]);
  if (sig?.dome && core >= 0) {
    const want = sig.dome[Math.min(g.wave, 10) - sig.from] ?? 0;
    const picked: ThreatKind[] = [];
    for (const kind of ['guided', 'ballistic'] as const)
      for (let i = queue.length - 1; i >= 0 && picked.length < want; i--) {
        const l = queue[i];
        if (l.kind === kind && !l.enc && !l.filler && l.base >= 0 && l.at < 1e8) {
          queue.splice(i, 1);
          picked.push(kind);
        }
      }
    // With none of its own left (its encounter took them), a guided missile
    // in place of two of the wave's own drones.
    for (let n = picked.length; n < want; n++) {
      let took = 0;
      for (let i = queue.length - 1; i >= 0 && took < 2; i--) {
        const l = queue[i];
        if (l.kind === 'drone' && !l.enc && !l.filler && l.base >= 0 && l.at < 1e8) {
          queue.splice(i, 1);
          took++;
        }
      }
      if (took < 2) break;
      picked.push('guided');
    }
    picked.forEach((kind, k) => {
      const at = lead + RAID.warn + (spec.duration * (k + 0.6)) / (picked.length + 0.4);
      queue.push({ at, kind, base: core, dome: true });
      g.raids.push({ at, theme: RAID_THEME[kind], bases: [core] });
    });
  }
  // A map's own extra fire, the same in every version (encounters rev 3:
  // The Strait's waves 5-10), on top of the wave as planned.
  const more = g.enc ? waveFire(g.map.id, g.wave, g.enc.setup.rev) : 0;
  if (more) addFire(g, queue, more, lead, spec.duration, rng);
  // Log v51 (Dreadnought Pass, lab only): the battleship's passes are the
  // layer's (DREAD_PASSES), each at its own moment.
  const passes = g.map.boss ? dreadPasses(g.map.id, g.enc?.setup) : undefined;
  const pass = passes?.[g.wave];
  if (pass && g.bossWave < g.wave) queue.push({ at: pass.at ? lead + RAID.warn + pass.at * spec.duration + (pass.plus ?? 0) : 0, kind: 'dreadnought', base: -1 });
  queue.sort((a, b) => a.at - b.at);
  labOpener(g, queue);
  g.queue = queue.filter((l) => l.base !== -2);
  g.events.push({ kind: 'wave', wave: g.wave });
  cue(g, 'wave.start', VIEW.width / 2, VIEW.height / 2);
  if (!passes && g.map.boss?.waves.includes(g.wave) && g.bossWave < g.wave) launchBoss(g);
}

/** More of a planned wave's own fire (encounters rev 3, MAP_FIRE): `more`
 *  of everything it will launch (the queue and its launchers' loads), on
 *  top: about two thirds of it as one drone swarm, the rest missiles,
 *  shells on odd waves and guided on even ones, each out of a base at a
 *  rolled moment with the base lit first, as a raid's. Added after the
 *  planner (a submarine fills its salvo whatever it is given, so more
 *  missiles in the plan alone would mostly vanish into the salvos). */
function addFire(g: Game, queue: Launch[], more: number, lead: number, duration: number, rng: RNG): void {
  const fire = queue.filter((l) => l.at < 1e8 && !isStructure(l.kind)).length + g.raiderQueue.reduce((a, r) => a + r.units.reduce((b, u) => b + u.size, 0), 0);
  const extra = Math.max(1, Math.round(fire * more));
  const drones = extra >= 3 ? Math.round((extra * 2) / 3) : 0;
  const at = () => lead + RAID.warn + duration * rng.range(0.15, 0.85);
  if (drones) {
    const t = at();
    const base = pickBase(g, 'drone', rng);
    if (base >= 0) {
      for (let d = 0; d < drones; d++) queue.push({ at: t + d * 0.35, kind: 'drone', base });
      g.raids.push({ at: t, theme: RAID_THEME.drone, bases: [base] });
    }
  }
  const kind: ThreatKind = g.wave % 2 ? 'ballistic' : 'guided';
  for (let k = drones; k < extra; k++) {
    const t = at();
    const base = pickBase(g, kind, rng);
    if (base < 0) continue;
    queue.push({ at: t, kind, base });
    g.raids.push({ at: t, theme: RAID_THEME[kind], bases: [base] });
  }
}

/** Takes out of a planned wave what its authored encounters replace: each
 *  missile by kind (one the wave doesn't have comes out of its drones
 *  instead), then the drones, from the raids' swarms first and the swarms
 *  that trickle in between after. A wave with fewer drones than that
 *  keeps its missiles (taking them would empty a submarine's salvo): the
 *  encounter's own drones are then the wave's drones. */
function makeRoom(units: { kind: ThreatKind; size: number }[], trickled: number[], list: Encounter[]): void {
  let drones = 0;
  for (const e of list) {
    drones += e.replaces.drones ?? 0;
    for (const kind of ['ballistic', 'guided'] as const)
      for (let n = e.replaces[kind] ?? 0; n > 0; n--) {
        const i = units.findIndex((u) => u.kind === kind);
        if (i >= 0) units.splice(i, 1);
        else drones++;
      }
    // Chapter 2 (encounters rev 4): a map's own extras (data/maps.ts
    // `extras`) the encounter stands in for; one the wave doesn't have
    // takes nothing.
    for (const [kind, n] of Object.entries(e.replaces.extras ?? {}))
      for (let k = n ?? 0; k > 0; k--) {
        const i = units.findIndex((u) => u.kind === kind);
        if (i >= 0) units.splice(i, 1);
      }
  }
  for (let i = units.length - 1; i >= 0 && drones > 0; i--) {
    if (units[i].kind !== 'drone') continue;
    const take = Math.min(drones, units[i].size);
    drones -= take;
    if (take === units[i].size) units.splice(i, 1);
    else units[i] = { ...units[i], size: units[i].size - take };
  }
  for (let i = trickled.length - 1; i >= 0 && drones > 0; i--) {
    const take = Math.min(drones, trickled[i]);
    drones -= take;
    if (take === trickled[i]) trickled.splice(i, 1);
    else trickled[i] -= take;
  }
}

/** The lab's authored encounters for this wave: each beat's launches at
 *  its moment, from its launcher, with the game's own warning before it (a
 *  raid's lit bases, a submarine's periscope, an aircraft's arrow). No RNG:
 *  an encounter is the same every time. */
function planEncounters(g: Game, list: Encounter[], queue: Launch[], lead: number, duration: number): void {
  // A wave planned again (a policy or a card applied before its first
  // step) is still the one wave: its encounters are noted once.
  const enc = g.enc!;
  const fresh = enc.wave !== g.wave;
  if (fresh) {
    enc.wave = g.wave;
    enc.now = list.map((e) => e.id);
    enc.played.push(...enc.now);
  }
  // Planned again (a card applied before the first step): the same sets
  // and call-outs, planned afresh.
  enc.sets = [];
  enc.calls = [];
  const calls = calloutsOn(g.map.id, enc.setup);
  for (const e of list) {
    if (fresh && g.tel) g.tel.encounter(g, e.id);
    // The moment its first warning shows: the call-out's.
    let start = Infinity;
    for (const b of e.beats) {
      // Never sooner than a raid's warning after the wave's lead-in.
      const at = lead + RAID.warn + b.at * duration + (b.plus ?? 0);
      const aim = b.aim && b.aim !== 'any' ? { aim: b.aim, ...(b.lane !== undefined ? { inLane: b.lane } : {}) } : {};
      if ('water' in b.from) {
        // Log v58 (Dunmar Crossing): a spotter beacon rises at the crossing;
        // its rising is its warning.
        for (let k = 0; k < b.count; k++) queue.push({ at: at + k * (b.gap ?? 3), kind: b.kind, base: -1, enc: e.id, ...(b.beacon ? { beacon: b.beacon } : {}) });
        start = Math.min(start, at);
      } else if ('base' in b.from) {
        const gap = b.gap ?? 0.35;
        // The Rig Field (log v49): a beat out of a rig already brought down
        // comes from the far shore instead (rigStandIn), lit there.
        // (Log v52: a siege gun beside the base fires the beat's salvos.)
        const from = b.filler ? b.from.base : rigStandIn(g, b.from.base);
        for (let k = 0; k < b.count; k++) queue.push({ at: at + k * gap, kind: b.kind, base: from, enc: e.id, ...aim, ...(b.filler ? { filler: true } : {}), ...(b.salvos !== undefined ? { salvos: b.salvos } : {}), ...(b.fire ? { fire: true } : {}), ...(b.boat ? { boat: b.boat } : {}), ...(b.dome ? { dome: true } : {}) });
        // Log v55 (HIDDEN_MINES): a chute's hidden mines just come, unwarned.
        if (b.kind === 'mine' && hiddenMines(g)) {
          start = Math.min(start, at);
          continue;
        }
        g.raids.push({ at, theme: RAID_THEME[b.kind], bases: [from] });
        start = Math.min(start, at - RAID.warn);
      } else if ('road' in b.from) {
        // Log v42 (Saltgate Canal): a Rocket Truck down a pop-up road; the
        // truck itself is its warning (it drives in, then raises its
        // launcher, a ring filling round it, before its first salvo).
        for (let k = 0; k < b.count; k++) queue.push({ at: at + k * (b.gap ?? 1.5), kind: b.kind, base: -1, road: b.from.road, enc: e.id, ...aim, ...(b.salvos !== undefined ? { salvos: b.salvos } : {}), ...(b.drive !== undefined ? { drive: b.drive } : {}) });
        start = Math.min(start, at);
      } else if ('sub' in b.from) {
        // It shows its periscope and surfaces first, so its salvo starts at `at`.
        const up = Math.max(0.2, at - SUB.warn - SUB.surface);
        g.raiderQueue.push({ at: up, kind: 'sub', path: [g.map.subSpots[b.from.sub]], units: Array.from({ length: b.count }, () => ({ kind: b.kind, size: 1 })), enc: e.id, ...aim });
        g.raiderQueue.sort((x, y) => x.at - y.at);
        start = Math.min(start, up);
      } else {
        // Log v33 (round 9): a jet aimed 'vip' flies down the supertanker's
        // own lane (vipRoute), the Behemoth Run's strike on the tanker.
        // Log v43 (Battery Point, MAP_SIGNATURE `stealth`): a jet comes in
        // dark from the signature's first wave, as the wave's own do.
        // Log v48 (Sowers' Reach, MAP_SIGNATURE `sow`): a stealth bomber
        // sows mines from the signature's first wave, as the wave's own do.
        const esig = signatureOf(g.map.id, g.wave, enc.setup);
        const kind = b.kind === 'strafer' && esig?.stealth ? 'stealthJet' : b.kind;
        const sow = kind === 'stealthBomber' && esig?.sow ? { sow: esig.sow } : {};
        for (let k = 0; k < b.count; k++) queue.push({ at: at + k * (b.gap ?? 1.5), kind, base: -1, side: b.from.air, enc: e.id, ...(b.aim === 'vip' ? { aim: 'vip' as const } : {}), ...sow });
        start = Math.min(start, at - PLANE.warn);
      }
    }
    // Enemy pairs (round 12, v3): a set each, launched on the pair's own
    // cues (updateSets). A lead out of a named base lights it first.
    for (const p of e.pairs ?? []) {
      const pair = enemyPair(p.pair)?.pair;
      if (!pair) continue;
      for (let k = 0; k < (p.count ?? 1); k++) {
        const at = lead + RAID.warn + p.at * duration + (p.plus ?? 0) + k * (p.every ?? LAB_SET.gap);
        const set: LabSet = { at, bases: {}, done: pair.follow.map(() => false), pair, enc: e.id };
        const kind = memberKind(pair.lead);
        if (p.base !== undefined && (isOldThreat(pair.lead) || fromBase(kind))) {
          set.base = p.base;
          g.raids.push({ at, theme: RAID_THEME[kind], bases: [p.base] });
          start = Math.min(start, at - RAID.warn);
        } else start = Math.min(start, at);
        enc.sets.push(set);
      }
    }
    if (calls && Number.isFinite(start)) enc.calls.push({ at: Math.max(0, start), id: e.id });
  }
  enc.sets.sort((a, b) => a.at - b.at);
  enc.calls.sort((a, b) => a.at - b.at);
}

/** The call-outs due: each encounter named as its warning shows (round
 *  12; on in a version that asks for them). */
function updateEncCalls(g: Game): void {
  const enc = g.enc;
  if (!enc) return;
  while (enc.calls.length && enc.calls[0].at <= g.waveT) g.events.push({ kind: 'encounter', id: enc.calls.shift()!.id });
}

/** An authored launch's target, picked as it leaves (data/encounters.ts,
 *  BeatAim): the ship furthest
 *  along its lane, the one nearest the mouth of the narrows, or (rev 4's
 *  'rear', only rev 4 encounters use it) the one least far along. Rev 4's
 *  chapter 1 maps: 'near', the ship nearest the launcher; 'mid', the ship
 *  nearest halfway along its lane; 'post', the map's allied structure while
 *  it stands (Lee of Marrow's radar), else the ship nearest where it stood.
 *  Chapter 2's Behemoth Run: 'vip', the supertanker while it sails. */
export function aimBeat(g: Game, th: Threat, aim: BeatAim, lane?: number): void {
  let from: Point = { x: th.x, y: th.y };
  if (aim === 'post' && g.map.posts) {
    const up = g.map.posts.map((_, i) => i).filter((i) => postUp(g, i));
    if (up.length) {
      th.target = POST_TARGET - up[0];
      if (th.kind === 'ballistic') aimBallistic(g, th);
      const tp = targetPos(g, th);
      th.heading = Math.atan2(tp.y - th.y, tp.x - th.x);
      return;
    }
    from = g.map.posts[0];
  }
  const all = targetable(g, th.kind === 'ballistic' ? VIEW.width - 320 : undefined);
  // Log v58 (Dunmar Crossing, Beat `lane`): only that lane's ships, if it
  // has any.
  const inLane = lane === undefined ? [] : all.filter((s) => s.channel === lane);
  const pool = inLane.length ? inLane : all;
  if (!pool.length) return;
  const along = (s: Ship) => s.d / laneLength(g.map.channels[s.channel]);
  // Chapter 2 (rev 4): the supertanker while it sails (else, as 'lead',
  // the ship furthest along).
  const tanker = aim === 'vip' ? pool.find((s) => s.vip) : undefined;
  let pick =
    tanker ??
    (aim === 'flats'
      ? flatsShip(g, pool, from)
      : aim === 'near' || aim === 'post'
      ? pool.reduce((a, b) => (dist(b.x, b.y, from.x, from.y) < dist(a.x, a.y, from.x, from.y) ? b : a))
      : aim === 'mid'
        ? pool.reduce((a, b) => (Math.abs(along(b) - 0.5) < Math.abs(along(a) - 0.5) ? b : a))
        : aim === 'rear'
          ? pool.reduce((a, b) => (along(b) < along(a) ? b : a))
          : aim === 'crowd'
            ? crowdShip(pool, th.id, along)
            : pool.reduce((a, b) => (along(b) > along(a) ? b : a)));
  // Chapter 2's Saltgate Canal (log v38): the ship held at a lock, in its
  // chamber or waiting at its shut entry gate, the lock nearest the
  // launcher first; no ship held there, the ship nearest the launcher.
  if (aim === 'lock') {
    const held = pool.filter((s) => atLock(g, s));
    const near = (a: Ship, b: Ship) => (dist(b.x, b.y, from.x, from.y) < dist(a.x, a.y, from.x, from.y) ? b : a);
    pick = held.length ? held.reduce(near) : pool.reduce(near);
  }
  // Chapter 4's Delta (log v57): the newest ship bound for the branch the
  // fork's switch is set to; none, the ship least far along.
  if (aim === 'switch') {
    const lane = switchLane(g);
    const bound = pool.filter((s) => s.channel === lane);
    pick = (bound.length ? bound : pool).reduce((a, b) => (along(b) < along(a) ? b : a));
  }
  // Log v58 (Dunmar Crossing): 'cross', of the next two ships to pass each
  // other (one each way), the one nearer the launcher; none, the ship
  // nearest halfway along.
  if (aim === 'cross') {
    const c = crossingPair(g);
    const pair = c ? pool.filter((s) => s.id === c.a.id || s.id === c.b.id) : [];
    pick = pair.length ? pair.reduce((a, b) => (dist(b.x, b.y, from.x, from.y) < dist(a.x, a.y, from.x, from.y) ? b : a)) : pool.reduce((a, b) => (Math.abs(along(b) - 0.5) < Math.abs(along(a) - 0.5) ? b : a));
  }
  if (aim === 'narrows') {
    const mouth = g.map.channels.map((c) => c.narrow?.fromX).find((x) => x !== undefined);
    const near = mouth === undefined ? [] : pool.filter((s) => s.x >= mouth - 220 && s.x <= mouth + 260);
    if (near.length) pick = near.reduce((a, b) => (Math.abs(b.x - mouth!) < Math.abs(a.x - mouth!) ? b : a));
  }
  th.target = pick.id;
  if (th.kind === 'ballistic') aimBallistic(g, th);
  const tp = targetPos(g, th);
  th.heading = Math.atan2(tp.y - th.y, tp.x - th.x);
}

/** Tidewater Flats (log v61, BeatAim 'flats'): the ship on a tide lane
 *  nearest `from`; none there (low water), the ship furthest from it. */
function flatsShip(g: Game, pool: Ship[], from: Point): Ship {
  const on = pool.filter((s) => g.map.channels[s.channel]?.tide);
  const d = (s: Ship) => dist(s.x, s.y, from.x, from.y);
  return on.length ? on.reduce((a, b) => (d(b) < d(a) ? b : a)) : pool.reduce((a, b) => (d(b) > d(a) ? b : a));
}

/** Tidewater Flats (log v61, BeatAim 'crowd'): how many other hulls are
 *  within CROWD_RADIUS px of a ship. */
export const CROWD_RADIUS = 170;
function crowdAround(pool: Ship[], s: Ship): number {
  let n = 0;
  for (const o of pool) if (o !== s && dist(o.x, o.y, s.x, s.y) <= CROWD_RADIUS) n++;
  return n;
}
/** The crowd's ships: the hull with the most round it and those round it,
 *  west to east; each launch takes one of them by its own id, so a strike at
 *  the crowd spreads over it rather than all going for one hull (no dice:
 *  an encounter plays the same every time). */
function crowdShip(pool: Ship[], id: number, along: (s: Ship) => number): Ship {
  const core = pool.reduce((a, b) => {
    const ca = crowdAround(pool, a);
    const cb = crowdAround(pool, b);
    return cb > ca || (cb === ca && along(b) > along(a)) ? b : a;
  });
  const near = pool.filter((s) => dist(s.x, s.y, core.x, core.y) <= CROWD_RADIUS).sort((a, b) => a.id - b.id);
  return near[id % near.length] ?? core;
}

/** Is a ship held at a lock (Saltgate Canal): in a lock's chamber, or in
 *  the queue short of its entry gate (within LOCK_QUEUE px of it)? */
export function atLock(g: Game, s: Ship): boolean {
  return (g.map.locks ?? []).some((l) => s.x >= l.x0 - LOCK_QUEUE && s.x <= l.x1);
}
const LOCK_QUEUE = 120;

/** A count shortened with the wave, keeping at least one of anything the
 *  full wave has, so every threat still shows up in a dev short wave. */
function cut(n: number, len: number): number {
  return len === 1 || n <= 0 ? n : Math.max(1, Math.round(n * len));
}

/** The next wave the dev stride plays after `wave`: every `stride`th,
 *  counted back from the last so the final wave is always played. Endless
 *  waves are never skipped. */
export function nextPlayedWave(wave: number, stride: number, last: number = RULES.wavesToClear): number {
  let w = wave + 1;
  while (stride > 1 && w < last && (last - w) % stride !== 0) w++;
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
  // (Log v55: never a structure: a relief rig a truck took was fired off
  // its rail at a ship, a rig flying over the far shore.)
  const truckKind = (u: Unit) => u.kind !== 'strafer' && u.kind !== 'bomber' && u.kind !== 'mothership' && !isFoe(u.kind) && !isStructure(u.kind);
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
export function pickBase(g: Game, kind: ThreatKind, rng: RNG): number {
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
  // A lab policy may leave the flow to the map (sim/convoy.ts).
  const lock = flowLocked(g);
  if (lock) {
    if (g.tel) g.tel.command(g, 'flow', flow, g.flow, false, lock);
    return;
  }
  if (g.tel) g.tel.command(g, 'flow', flow, g.flow, next !== g.flow);
  if (next === g.flow) return;
  g.flow = next;
  // Speeding up takes effect now rather than after the old (longer) gap.
  g.spawnT = Math.min(g.spawnT, spawnGap(g));
}

export function setFormation(g: Game, id: FormationId): void {
  const lock = formationLocked(g);
  if (lock) {
    if (g.tel) g.tel.command(g, 'formation', id, g.formation, false, lock);
    return;
  }
  if (g.tel) g.tel.command(g, 'formation', id, g.formation, id !== g.formation);
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
  const ammo0 = g.ammo;
  const [w1, w2] = [g.weapon?.id, g.weapon2?.id];
  if (g.tel) g.tel.tapStart();
  g.foe.byTap = true;
  const result = tapResult(g, x, y, radius);
  g.foe.byTap = false;
  g.taps[result] += 1;
  if (g.tel) g.tel.tapEnd(g, x, y, radius, result, ammo0, w1, w2);
  return result;
}

function tapResult(g: Game, x: number, y: number, radius: number): TapResult {
  let pickup: Pickup | null = null;
  let pd = radius + PICKUPS.radius;
  // A pickup in a Scavenger's ring (round 8) can't be taken: the tap goes
  // on to whatever it would hit, and says so on the pickup.
  let locked: Pickup | null = null;
  for (const p of g.pickups) {
    const d = dist(x, y, p.x, p.y);
    if (d < pd && pickupLocked(g, p)) {
      if (!locked || d < dist(x, y, locked.x, locked.y)) locked = p;
      continue;
    }
    if (d < pd) {
      pd = d;
      pickup = p;
    }
  }
  if (locked && !pickup) {
    if (g.tel) g.tel.tapOn({ locked: 1 });
    addFx(g, 'text', locked.x, locked.y - 34, { life: 0.7, r: 0, text: 'LOCKED' });
    cue(g, 'powerup.expire', locked.x, locked.y, { gain: 0.5 });
  }
  // Prefer a threat that still needs an interceptor, so repeated taps on a
  // swarm spread across it instead of piling onto one drone.
  let threat: Threat | null = null;
  let td = Infinity;
  let fallback: Threat | null = null;
  let fd = Infinity;
  for (const th of g.threats) {
    // A munition still on its launcher is no target (round 13): the tap
    // resolves as if it weren't there.
    if (!released(th)) continue;
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
  if (g.tel && threat) g.tel.tapOn({ thr: threat.id });
  if (pickup && (!threat || pd <= td)) {
    collect(g, pickup);
    return 'pickup';
  }
  // The Delta: a tap on the fork's buoy (with no threat nearer) throws it.
  const fork = g.map.fork;
  if (fork && dist(x, y, fork.x, fork.y) <= radius + FORK_RADIUS && (!threat || dist(x, y, fork.x, fork.y) < td)) {
    if (g.tel) g.tel.tapOn({ fork: 1 });
    throwSwitch(g);
    return 'pickup';
  }
  return fireLoaded(g, x, y, threat, radius);
}

/** Dual Wield: the second hand's shot costs no round (one round a tap). */
let freeShots = 0;
/** Hyper Overdrive fires these twice (taps that are a shot of their own;
 *  the rest fire a tagged interceptor, which `fireAt` doubles). */
const HYPER_TWICE: AbilityId[] = ['railgun', 'airstrike', 'scatter', 'boomerang', 'seeker', 'flak', 'well', 'shrapnel', 'thermo', 'cadence', 'wildCard'];

/** Hyper Overdrive's second shot, while it is being fired: how far to the
 *  side of the first its muzzle sits (0: an ordinary shot). Test Lab round
 *  5 (the player: "it should clearly show two projectiles instead of just
 *  one ... for the beam two laser beams"): the second shell, beam, cone or
 *  blade leaves from its own muzzle beside the first, so both show. */
let twinSide = 0;
/** Hyper Overdrive's first shot, while it is being fired: its muzzle goes as
 *  far to the other side, so the pair sits either side of the gun. */
let firstSide = 0;

/** Is Hyper Overdrive (Overdrive MAX) running: every shot fires twice? */
export function hyper(g: Game): boolean {
  return boostLevel(g, 'overdrive') >= ABILITY_MAX;
}

/** Where a shot at (x, y) leaves the gun: the carrier, or for Hyper
 *  Overdrive's second shot a muzzle `twinSide` px to its side, square to the
 *  line of fire (a beam from it still crosses the first at the target). */
function muzzle(g: Game, x: number, y: number): Point {
  const c = g.map.carrier;
  const side = twinSide || firstSide;
  if (!side) return { x: c.x, y: c.y };
  const d = dist(c.x, c.y, x, y) || 1;
  return { x: c.x - ((y - c.y) / d) * side, y: c.y + ((x - c.x) / d) * side };
}

/** Fire Hyper Overdrive's first shot of a pair: `f` runs with the first
 *  muzzle (the other side from the twin's). Anything else: as it is. */
function firstShot<T>(g: Game, f: () => T): T {
  if (!hyper(g) || twinSide) return f();
  firstSide = -AB.overdrive.twin;
  try {
    return f();
  } finally {
    firstSide = 0;
  }
}

/** Fire Hyper Overdrive's second shot: `f` runs with the twin muzzle, for
 *  no round. */
function twinShot(f: () => void): void {
  const free = freeShots;
  freeShots = 1;
  twinSide = AB.overdrive.twin;
  try {
    f();
  } finally {
    twinSide = 0;
    freeShots = free;
  }
}

/** A tap that is a shot: every loaded weapon fires (Dual Wield: both, for
 *  one round); with nothing loaded, a plain interceptor or (Wild Card) a
 *  random weapon. */
function fireLoaded(g: Game, x: number, y: number, threat: Threat | null, radius: number): TapResult {
  // The Laser Cutter only cuts (round 11, the player: "The laser player
  // attack still shoots a munitions from the ship. It should NOT do that it
  // should only do the cut"): a tap with it loaded fires no shell and spends
  // no round, and says how it works. Under Dual Wield the other hand still
  // fires its own shot (and Hyper Overdrive twins that one, not the cutter).
  const all = loadedWeapons(g);
  const ws = all.filter((w) => w.id !== 'cutter');
  if (ws.length < all.length && !ws.length) {
    swipeHint(g, x, y);
    return 'empty';
  }
  let res: TapResult | null = null;
  const plain: Weapon[] = [];
  for (const w of ws) {
    if (res === 'dry') break;
    freeShots = res ? 1 : 0;
    const r = HYPER_TWICE.includes(w.id) ? firstShot(g, () => fireWeapon(g, w, x, y, threat, radius)) : fireWeapon(g, w, x, y, threat, radius);
    if (r === null) plain.push(w);
    else {
      if (r === 'fire' && hyper(g) && !twinSide && HYPER_TWICE.includes(w.id)) twinShot(() => fireWeapon(g, w, x, y, threat, radius));
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

/** A tap with only the Laser Cutter loaded (round 11): no shot, just the
 *  words over the finger, one at a time. */
export const SWIPE_HINT = 'SWIPE TO CUT';
function swipeHint(g: Game, x: number, y: number): void {
  g.fx = g.fx.filter((f) => !(f.kind === 'text' && f.text === SWIPE_HINT));
  addFx(g, 'text', x, y - 30, { life: 0.9, text: SWIPE_HINT });
}

/** Take a draft card. `replace` swaps a new ability in for one you hold when
 *  all slots are full: the replaced ability and its levels are gone. */
export function pickUpgrade(g: Game, id: CardId, replace?: AbilityId): void {
  if (g.phase !== 'draft' || !g.offer.includes(id)) return;
  const swap = replace !== undefined && canSwapIn(g.levels, id) && (g.levels[replace] ?? 0) > 0;
  if (!swap && !canTake(g.levels, id)) return;
  if (g.tel) g.tel.input(g, 'pick', { card: id, ...(swap ? { rep: replace } : {}) });
  if (swap) {
    delete g.levels[replace];
    if (!isSpecialCard(id)) g.slots[g.slots.indexOf(replace!)] = id;
  }
  if (id === 'lifeboat') {
    // Lifeboats (Armory, level 3+): one more ship can be lost, in place of
    // this draft's weapon.
    g.extraLives += 1;
    g.events.push({ kind: 'life', lives: g.extraLives });
    cue(g, 'repair', g.map.carrier.x, g.map.carrier.y);
    afterPick(g);
    return;
  }
  if (id === 'resupply') {
    if (g.tel) g.tel.healAll(g, () => g.stats.shipHp, g.stats.carrierHp, 'resupply');
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

/** Hold these weapons, in slot order, at their levels (1–3), in place of
 *  whatever is held (Free Play's setup; a Test Lab "Skip to boss"). */
export function holdWeapons(g: Game, weapons: { id: AbilityId; level: number }[]): void {
  g.levels = {};
  g.slots = [];
  // A weapon cut since the setup was saved (or logged) is left out
  // (Test Lab round 5 cut Overclock and Time Warp).
  for (const w of weapons.filter((o) => knownWeapon(o.id)).slice(0, MAX_SLOTS)) {
    if (g.slots.includes(w.id)) continue;
    g.levels[w.id] = Math.max(1, Math.min(ABILITY_MAX, Math.floor(w.level)));
    g.slots.push(w.id);
  }
}

/** Free Play's frequent drops: a weapon at least every 8 s, at twice the chance. */
export const FREE_PLAY_DROPS = { pity: 8, share: 2 } as const;

export function applyFreePlay(g: Game, setup: FreePlaySetup): void {
  holdWeapons(g, setup.weapons);
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
  g.events = g.events.filter((e) => e.kind !== 'wave' && e.kind !== 'special' && e.kind !== 'restore');
  g.event = null;
  g.cues = [];
  // Log v51 (Dreadnought Pass): planned again under the layer, the wave's
  // battleship comes on its pass's own moment, not as the wave started.
  if (g.map.boss && g.bossWave === g.wave && dreadPasses(g.map.id, g.enc?.setup)) {
    g.threats = g.threats.filter((t) => t.kind !== 'dreadnought');
    g.bossWave = g.wave - 1;
  }
  g.wave -= 1;
  startWave(g);
}

/** The Test Lab's "Bring one now": the card's enemy comes in at once (a
 *  weapon card drops its weapon by the carrier). A recorded command, so a
 *  test replays exactly. */
export function labBring(g: Game): void {
  const lab = g.lab;
  if (!lab || lab.full || g.phase !== 'wave') return;
  if (g.tel) g.tel.input(g, 'bring');
  // An event card: "Run it again" (the event starts over).
  if (lab.event) {
    rerunEvent(g);
    return;
  }
  // A combo brings its whole set, paired as in its waves.
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
    addPickup(g, 'weapon', c.x + g.rng.foes.range(-180, 180), c.y - 150, lab.weapon, 'lab');
  }
}

/** Is a pair's lead at its station: the Spotter on its circle, the Repair
 *  Ship on station, the Rocket Truck at the end of its road, the Attack
 *  Helicopter at its hover, the Lure Beacon risen? */
function atStation(th: Threat): boolean {
  const f = th.foe;
  if (!f) return true;
  if (th.kind === 'tender') return f.n === 1;
  if (th.kind === 'spotter' || th.kind === 'rocketTruck' || th.kind === 'attackHeli' || th.kind === 'lure') return f.state >= 1;
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

/** Water near (x, y) for a boat: the point itself, or the first one on
 *  water stepping from it toward the convoy's lane, `clear` px past the
 *  shore. */
function waterNear(g: Game, x: number, y: number, clear: number): Point {
  const ch = g.map.channels[0];
  const to = laneAt(ch, laneLength(ch) * clamp(x / VIEW.width, 0.05, 0.95), 0);
  const d = Math.max(1, dist(x, y, to.x, to.y));
  for (let k = 0; k <= d; k += 10) {
    const px = x + ((to.x - x) * k) / d;
    const py = y + ((to.y - y) * k) / d;
    if (onLand(g, px, py)) continue;
    const u = Math.min(d, k + (k > 0 ? clear : 0));
    return { x: x + ((to.x - x) * u) / d, y: y + ((to.y - y) * u) / d };
  }
  return to;
}

/** The Test Lab's combo sets (Test Lab round 4, "the recon drone and then
 *  the siege cannon never really appeared at the same time"; round 8, enemy
 *  pairs, data/pairs.ts): each set's lead launches, and the others follow on
 *  the pairing's cues, so the set is on the board together. A map script
 *  placing a pair in a wave would launch it the same way. */
function updateLabSets(g: Game): void {
  const lab = g.lab;
  if (lab?.pair && lab.sets.length) lab.sets = updateSets(g, lab.sets, lab.pair);
  // An authored encounter's enemy pairs (round 12, v3), each set its own.
  if (g.enc?.sets.length) g.enc.sets = g.enc.sets.filter((s) => updateSets(g, [s], s.pair!).length > 0);
}

/** One pair's sets: launches what is due, and returns the sets still to
 *  finish. */
function updateSets(g: Game, sets: LabSet[], P: LabPair): LabSet[] {
  const c = g.map.carrier;
  const leadKind = memberKind(P.lead);
  const isLead = (t: Threat, led: { id: number }) => t.kind === leadKind && t.id >= led.id && (!isOldThreat(P.lead) || !!t.paired);
  // One member out now; returns its base (-1 if it came from no base). An
  // original threat is its swarm or volley out of one base: the first now,
  // the rest queued. An encounter's set tags what it launches with the
  // encounter (telemetry, and the launch's aim).
  const out = (f: PairMember, base: number | undefined, enc: string | undefined): number => {
    const kind = memberKind(f);
    const tag = enc ? { enc } : {};
    if (isOldThreat(f)) {
      const b = base ?? pickBase(g, kind, g.rng.foes);
      if (b < 0) return -1;
      const O = OLD_THREATS[f];
      launch(g, { at: g.waveT, kind, base: b, paired: true, ...tag });
      for (let k = 1; k < O.size; k++) g.queue.push({ at: g.waveT + k * O.every, kind, base: b, paired: true, ...tag });
      g.queue.sort((a, b2) => a.at - b2.at);
      return b;
    }
    if (isPlaneKind(kind)) {
      g.queue.unshift({ at: g.waveT, kind, base: -1, ...tag });
      return -1;
    }
    const b = fromBase(kind) ? (base ?? pickBase(g, kind, g.rng.foes)) : -1;
    if (fromBase(kind) && b < 0) return -1;
    const id0 = g.nextId;
    launch(g, { at: g.waveT, kind, base: b, ...tag });
    // A foe that launches itself (a truck, a helicopter) is tagged here; one
    // that comes up from a mark (a sub's periscope, a gun's hatch) through it.
    if (enc) {
      for (const t of g.threats) if (t.id >= id0 && !t.enc) t.enc = enc;
      for (const m of g.foe.marks) if (m.id >= id0 && !m.enc) m.enc = enc;
    }
    return b;
  };
  for (const s of sets) {
    if (!s.led && g.waveT >= s.at) {
      const id = g.nextId;
      s.led = { id, t: g.waveT, base: out(P.lead, s.base ?? (P.far ? farBase(g) : s.bases[P.lead]), s.enc) };
      // A Repair Ship whose truck it places: moored off the end of the
      // shore road nearest its station.
      const roads = g.map.roads.popups;
      const tender = P.lead === 'tender' && P.follow.some((f) => f.near && f.foe === 'rocketTruck') ? g.threats.find((t) => t.kind === 'tender' && t.id >= id) : undefined;
      if (tender?.foe && roads.length) {
        const k = roads.reduce((m, r, i) => (dist(r.to.x, r.to.y, tender.foe!.px, tender.foe!.py) < dist(roads[m].to.x, roads[m].to.y, tender.foe!.px, tender.foe!.py) ? i : m), 0);
        const p = waterNear(g, roads[k].to.x, roads[k].to.y, PAIR_MOOR);
        tender.foe.px = p.x;
        tender.foe.py = p.y;
        s.road = k;
      }
    }
    const led = s.led;
    if (!led) continue;
    if (led.station === undefined) {
      const th = g.threats.find((t) => isLead(t, led));
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
        const kind = memberKind(f.foe);
        const from = base !== undefined && base >= 0 ? g.map.bases[base] : c;
        const speed = THREATS[kind].speed * (1 + (g.waveSpeed - 1) * WAVE_SPEED_SHARE[kind]);
        const leads = g.threats.filter((t) => !t.dead && isLead(t, led));
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
      const lead = g.threats.find((t) => !t.dead && isLead(t, led));
      if (f.near && f.foe === 'bodyguard') {
        // A ring round the lead, no heavy of its own (gone with the lead).
        if (lead) ringGuards(g, lead, s.enc);
        return;
      }
      const id0 = g.nextId;
      out(f.foe, base, s.enc);
      if (!f.near) return;
      if (f.foe === 'torpedoSub' && lead?.foe) {
        // The sub surfaces under the helicopter's hover.
        const m = g.foe.marks.find((o) => o.kind === 'periscope' && o.id >= id0);
        if (m) {
          const p = waterNear(g, lead.foe.px, lead.foe.py, 30);
          m.x = p.x;
          m.y = p.y;
        }
      } else if (f.foe === 'rocketTruck' && s.road !== undefined) {
        // The truck takes its Repair Ship's road.
        const road = g.map.roads.popups[s.road];
        const th = g.threats.find((o) => o.kind === 'rocketTruck' && o.id >= id0);
        if (th?.foe && road) {
          th.foe.path = [road.from, road.to];
          th.x = road.from.x;
          th.y = road.from.y;
          th.heading = Math.atan2(road.to.y - road.from.y, road.to.x - road.from.x);
        }
      }
    });
  }
  return sets.filter((s) => !s.led || s.done.some((d) => !d));
}

/** How far off the shore a pair's Repair Ship moors (px of water). */
const PAIR_MOOR = 70;

/** A Bodyguard Ring round a threat already on the board (an enemy pair's:
 *  a guarded Spotter). */
function ringGuards(g: Game, th: Threat, enc?: string): void {
  for (let k = 0; k < FOE.bodyguard.guards; k++) {
    const t = spawnThreat(g, 'guard', th.x, th.y, 'base');
    t.target = CARRIER_TARGET;
    t.foe = foeData({ link: th.id, n: k });
    if (enc) t.enc = enc;
  }
}

/** The Map & Convoy Lab: turn the map's authored encounters on (after the
 *  game is created, before its first step). The wave is planned again with
 *  them in it. */
export function applyEncounters(g: Game, setup: EncounterSetup): void {
  g.enc = {
    setup: { rev: setup.rev, ...(setup.only ? { only: [...setup.only] } : {}), ...(setup.version ? { version: setup.version } : {}), ...(setup.callouts !== undefined ? { callouts: setup.callouts } : {}) },
    played: [],
    wave: -1,
    now: [],
    sets: [],
    calls: [],
  };
  // Log v55 (round 15, SHOT_RIGS): the rigs standing take RIG_SHOTS.rig
  // shots (a rig's own hits on the map are the campaign's).
  if (shotRigs(g)) for (const th of g.threats) if (th.kind === 'rig' && th.base !== undefined && th.tow === undefined && th.hp >= (g.map.bases[th.base]?.rig?.hp ?? THREATS.rig.hp) - 1e-6) th.hp = th.maxHp = RIG_SHOTS.rig;
  // Log v60 (The Citadel): its generators and the Citadel count shots.
  if (shotRigs(g)) for (const th of g.threats) if ((th.kind === 'generator' || th.kind === 'citadel') && th.base !== undefined && th.hp >= THREATS[th.kind].hp - 1e-6) th.hp = th.maxHp = CITADEL[th.kind];
  replanWave(g);
}

/** A rig's full hits on station `i`: RIG_SHOTS.rig on a map whose rigs
 *  count shots (log v55), else the map's own. */
function rigFull(g: Game, i: number): number {
  const b = g.map.bases[i];
  return shotRigs(g) ? RIG_SHOTS.rig : (b?.rig?.hp ?? THREATS.rig.hp);
}

/** The Test Lab (after applyFreePlay): give the run its card. A map
 *  card's full run (Test Lab round 10) changes nothing the first wave was
 *  planned from, so it is not planned again: the run is the campaign's,
 *  wave for wave, on the same seed. */
export function applyLab(g: Game, setup: LabSetup): void {
  setUpLab(g, setup);
  // Round 12's "Skip to boss": the weapons the run skipped from held.
  if (setup.loadout) holdWeapons(g, setup.loadout);
  if (!g.lab?.full) replanWave(g);
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
  if (g.tel) g.tel.input(g, 'endless');
  g.endless = true;
  g.draftsLeft = 1;
  openDraft(g);
}

/** Chance each draft draw comes from the loadout's own (unevolved)
 *  weapons. V3: three slots of three levels is nine picks, about one map's
 *  worth of drafts, so held weapons come up more often than V2's cards. */
const OWNED_DRAW = 0.5;

function openDraft(g: Game): void {
  dealDraft(g, []);
  g.phase = 'draft';
}

/** Quartermaster (Armory, Supply bay): deal the draft again, once per
 *  re-roll the run has left. The new hand is dealt from the draft's own
 *  dice (so a log replays it: the 'x' command), from the weapons the old
 *  hand did not show when there are enough of them. */
export function rerollDraft(g: Game): boolean {
  if (g.phase !== 'draft' || g.rerolls <= 0) return false;
  if (g.tel) g.tel.input(g, 'reroll');
  g.rerolls -= 1;
  dealDraft(g, g.offer);
  return true;
}

/** Quartermaster level 5 (Armory): once a run, a held weapon gains a level
 *  in a draft without spending the draft's pick (the 'l' command). */
export function freeLevelUp(g: Game, id: AbilityId): boolean {
  if (g.phase !== 'draft' || g.freeLevelsLeft <= 0) return false;
  const lv = g.levels[id] ?? 0;
  if (lv <= 0 || lv >= ABILITY_MAX) return false;
  if (g.tel) g.tel.input(g, 'free', { card: id });
  g.freeLevelsLeft -= 1;
  gainLevel(g, id);
  // A hand that offered this weapon's next level offers the one after (or
  // nothing, at MAX: the card is greyed as any maxed one is).
  return true;
}

/** Quartermaster level 3+ (Armory): the golden bomb, once a run, any time
 *  in a wave: the Nuke's blast (the 'n' command). */
export function goldBomb(g: Game): boolean {
  if (g.phase !== 'wave' || g.bombsLeft <= 0) return false;
  if (g.tel) g.tel.input(g, 'bomb');
  g.bombsLeft -= 1;
  nuke(g);
  g.events.push({ kind: 'goldBomb' });
  const c = g.map.carrier;
  cue(g, 'nuke.blast', c.x, c.y);
  addFx(g, 'text', c.x, c.y - CARRIER.halfBeam - 40, { life: 1.6, text: 'GOLDEN BOMB' });
  return true;
}

/** Is a re-roll worth it for a player whose favourite weapons are
 *  `preferred` (the bots' rule)? Yes when the hand has nothing they would
 *  want: no weapon they hold to level up, and no favourite to take in a
 *  free slot. */
export function rerollWorth(g: Game, preferred: readonly AbilityId[]): boolean {
  if (g.phase !== 'draft' || g.rerolls <= 0) return false;
  const room = loadout(g.levels).length < MAX_SLOTS;
  const wanted = (id: CardId) => !isSpecialCard(id) && canTake(g.levels, id) && ((g.levels[id] ?? 0) > 0 || (room && preferred.includes(id)));
  if (g.offer.some(wanted)) return false;
  // Only while a new hand could bring one: a held weapon still to level,
  // or a favourite still in the draft with a slot free.
  const pool = draftChapterPool(g);
  return ABILITY_ORDER.some((id) => (pool.includes(id) || (g.levels[id] ?? 0) > 0) && wanted(id));
}

/** The weapons the draft can deal: the map's chapter's, or every live one
 *  in a Test Lab run with all cards unlocked (log v64, LabSetup.allCards). */
function draftChapterPool(g: Game): AbilityId[] {
  return draftPool(g.lab?.setup.allCards ? CHAPTERS.length : chapterOf(g.map.id));
}

/** The draft's hand: `size` cards (3; Quartermaster 5: 4), avoiding the
 *  cards in `avoid` (a re-roll's old hand) when enough others are open. */
function dealDraft(g: Game, avoid: readonly CardId[]): void {
  // Three random weapons from everything not yet evolved. With a full
  // loadout, a new one can still be swapped in for one you hold; if nothing
  // can be taken without a swap, Resupply is added so keeping your build is
  // a choice. Each draw favours a weapon you already hold (OWNED_DRAW).
  // The roster (data/roster.ts) says which weapons are live and from which
  // chapter; a held one (Free Play can hand over a prototype) can level up.
  const pool = draftChapterPool(g);
  const size = g.stats.draftCards;
  const all = ABILITY_ORDER.filter((id) => (pool.includes(id) || (g.levels[id] ?? 0) > 0) && (g.levels[id] ?? 0) < ABILITY_MAX);
  const fresh = all.filter((id) => !avoid.includes(id));
  const open = avoid.length && fresh.length >= size ? fresh : all;
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
  while (g.offer.length < size && (mine.length || other.length)) {
    const fromMine = mine.length && (!other.length || rng.chance(OWNED_DRAW));
    g.offer.push((fromMine ? mine : other).shift()!);
  }
  // The Test Lab (round 5, the player: "when you're play testing one, it
  // should always have an upgrade ... for the one that you're actually
  // testing"): a weapon test's every draft offers its weapon's next level
  // until it is MAX.
  // Round 8 (the player: "I didn't see the grapple upgrade after the first
  // wave I completed, so make sure that's a thing"): it is always the first
  // card (it used to stay wherever the deal put it, so it could be the last
  // of three), the card says it is the one under test (the UI's TESTING
  // tag), and one swapped out of the loadout comes back as a card to swap
  // in.
  const tested = g.lab?.weapon;
  if (tested && (canTake(g.levels, tested) || canSwapIn(g.levels, tested))) {
    g.offer = [tested, ...g.offer.filter((id) => id !== tested)].slice(0, size);
  }
  if (!g.offer.some((id) => canTake(g.levels, id))) g.offer.push('resupply');
  // Lifeboats (Armory, level 3+): after every stats.lifeCard waves the
  // hand has one more card, the Lifeboat (an extra life). No dice: it is
  // dealt by the wave's number, and a re-roll deals it again.
  if (lifeCardDue(g)) g.offer.push('lifeboat');
}

/** The bots' rule for Lifeboats' card: take the extra life over a weapon
 *  once half the run's lives or fewer are left (3 of 6), or when no weapon
 *  in the hand can be taken. */
export const LIFE_LOW = 3;
export function lifeCardWorth(g: Game): boolean {
  if (!g.offer.includes('lifeboat')) return false;
  if (lossLimit(g) - shipsSunk(g) <= LIFE_LOW) return true;
  return !g.offer.some((id) => !isSpecialCard(id) && canTake(g.levels, id));
}

/** The bots' rule for Quartermaster 5's free level-up: at the first draft
 *  it can, the held weapon with the most levels (the one it is stacking;
 *  ties to the first slot), else nothing. */
export function freeLevelPick(g: Game): AbilityId | null {
  if (g.phase !== 'draft' || g.freeLevelsLeft <= 0) return null;
  const held = g.slots.filter((id) => (g.levels[id] ?? 0) > 0 && (g.levels[id] ?? 0) < ABILITY_MAX);
  return held.sort((a, b) => (g.levels[b] ?? 0) - (g.levels[a] ?? 0))[0] ?? null;
}

/** The bots' rule for Quartermaster's golden bomb (kept for when it counts,
 *  as a player keeps it): in a boss round, half a crowd of threats near the
 *  ships (GOLD_CROWD / 2 within GOLD_NEAR s of a hit); before that, a whole
 *  crowd once the run is pressed (half its lives or fewer left, or the
 *  carrier at half) or late (wave GOLD_LATE on); and any time the last ship
 *  left has two threats about to land. */
export const GOLD_CROWD = 6;
export const GOLD_NEAR = 4;
export const GOLD_LATE = 8;
export function goldBombWorth(g: Game): boolean {
  if (g.phase !== 'wave' || g.bombsLeft <= 0) return false;
  const near = g.threats.filter((t) => !t.dead && !t.hidden && timeToImpact(g, t) < GOLD_NEAR).length;
  const left = lossLimit(g) - shipsSunk(g);
  const boss = !!g.event && !g.event.bonus && g.event.runs > 1;
  if (boss && near >= GOLD_CROWD / 2) return true;
  const pressed = left <= LIFE_LOW || g.carrierHp <= g.stats.carrierHp / 2;
  if (near >= GOLD_CROWD && (pressed || g.wave >= GOLD_LATE)) return true;
  return near >= 2 && left <= 1;
}

/** Does this draft deal Lifeboats' extra-life card? */
export function lifeCardDue(g: Game): boolean {
  return g.stats.lifeCard > 0 && g.wave > 0 && g.wave % g.stats.lifeCard === 0;
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
      {
        // Hyper Overdrive's second shell lands as far aside as it left.
        const m = muzzle(g, x, y);
        const c = g.map.carrier;
        g.interceptors.push({ id: g.nextId++, x: m.x, y: m.y - 6, target: null, tx: x + m.x - c.x, ty: y + m.y - c.y, life: 0, src: 'gun', tap: true, weapon: { ...w }, ...(twinSide ? { twin: true } : {}) });
        if (!twinSide) cue(g, 'gun.fire', c.x, c.y);
      }
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
    // Wild Card (an active since Test Lab round 5): a random weapon's shot.
    case 'wildCard':
      return wildTap(g, w, x, y, threat, radius);
    // Passives: they work on their own; the gun is the plain gun.
    case 'droneScreen':
    case 'gunships':
    case 'bomberWing':
    case 'orbital':
      return null;
    // Boosts are never loaded (startBoost); nothing to fire.
    case 'supplyRun':
    case 'dualWield':
    case 'focus':
    case 'overdrive':
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
      const end = rayHits(g, x, y, turn + (i * Math.PI * 2) / n, AB.shrapnel.range[k], AB.shrapnel.width, w.level >= 3, AB.shrapnel.damage, 'shrapnel');
      addFx(g, 'frag', x, y, { life: 0.28, x2: end.x, y2: end.y });
    }
  } else if (w.id === 'thermo') {
    const r = AB.thermo.radius[k];
    cue(g, 'thermo.burst', x, y);
    for (const th of [...g.threats]) if (released(th) && dist(th.x, th.y, x, y) <= r) damageThreat(g, th, AB.thermo.damage[k], true, 'thermo');
    addFx(g, 'thermo', x, y, { life: 0.7, r });
  }
}

/** A straight path from (x, y) at `ang`, `range` long: hits the first
 *  threat within `width` of it for `dmg` (every one on it if `pierce`).
 *  Returns where the path ends (the first hit, or its full length). */
function rayHits(g: Game, x: number, y: number, ang: number, range: number, width: number, pierce: boolean, dmg: number, by: HurtSrc): Point {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const on = g.threats
    .filter(released)
    .map((t) => ({ t, along: (t.x - x) * ux + (t.y - y) * uy, off: Math.abs((t.x - x) * uy - (t.y - y) * ux) }))
    .filter((o) => o.along >= 0 && o.along <= range && o.off <= width)
    .sort((a, b) => a.along - b.along);
  if (!on.length) return { x: x + ux * range, y: y + uy * range };
  for (const o of pierce ? on : on.slice(0, 1)) damageThreat(g, o.t, dmg, true, by);
  const stop = pierce ? range : on[0].along;
  return { x: x + ux * stop, y: y + uy * stop };
}

/** Scattergun: a cone of pellets from the gun toward (x, y), short range. */
function fireScatter(g: Game, level: number, x: number, y: number): void {
  const k = level - 1;
  const c = muzzle(g, x, y);
  const base = Math.atan2(y - c.y, x - c.x);
  const n = AB.scatter.pellets[k];
  for (let i = 0; i < n; i++) {
    const ang = base + (n > 1 ? (i / (n - 1) - 0.5) * AB.scatter.spread : 0);
    const end = rayHits(g, c.x, c.y - 6, ang, AB.scatter.range[k], AB.scatter.width, level >= 3, AB.scatter.damage, 'scatter');
    addFx(g, 'frag', c.x, c.y - 6, { life: 0.3, x2: end.x, y2: end.y, r: 1 });
  }
  addFx(g, 'burst', c.x + Math.cos(base) * 30, c.y - 6 + Math.sin(base) * 30, { life: 0.2, r: 22 });
  cue(g, 'scatter.blast', c.x, c.y);
}

/** Boomerang: a blade out to (x, y), or after the threat tapped, and back
 *  (Twin Blades: a second one splayed to one side). */
function throwBlades(g: Game, level: number, x: number, y: number, threat: Threat | null): void {
  const c = muzzle(g, x, y);
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
      if (!released(th) || b.hits.includes(th.id) || dist(th.x, th.y, b.x, b.y) > AB.boomerang.width[k]) continue;
      b.hits.push(th.id);
      cue(g, 'blade.hit', th.x, th.y);
      damageThreat(g, th, AB.boomerang.damage[k], true, 'boomerang');
    }
  }
  g.blades = g.blades.filter((b) => !b.home);
}

/** Frigate Escort: the frigates sail in along a shipping lane to stations at
 *  its edge, fire on their own, and sail off down the lane when the weapon is
 *  spent or another takes over. */
function launchEscorts(g: Game, level: number): void {
  const want = AB.frigate.ships[level - 1];
  if (g.map.berths) {
    launchBerthed(g, want);
    return;
  }
  // Test Lab round 8 (the player: "the ship should just not turn around.
  // They should just run [off] the screen and then new ones should come on
  // the screen"): frigates on their way out keep going; a fresh set sails
  // in to station. (Round 5 turned the leaving ones round.) Frigates still
  // on station stay there, on a fresh clock; only the missing ones come.
  // Round 13: one backing out the way it came (a narrows ahead) would meet
  // the fresh set head on, so it is called back to its station instead (as
  // on Saltgate's berths).
  for (const e of g.escorts) {
    if (!e.leaving || e.out !== -1) continue;
    e.leaving = false;
    e.out = undefined;
  }
  const staying = g.escorts.filter((e) => !e.leaving);
  staying.slice(want).forEach((e) => (e.leaving = true));
  const kept = staying.slice(0, want);
  if (kept.length >= want) return;
  cue(g, 'frigate.arrive', 0, VIEW.height / 2, { vx: AB.frigate.speed });
  const stations = escortStations(g, want);
  // Ones on station keep theirs (no ship turns about to move up); the new
  // ones take the stations furthest from them.
  const free = stations.filter((st) => {
    const p = laneAt(g.map.channels[st.lane], st.d, st.lat);
    return !kept.some((e) => Math.hypot(e.sx - p.x, e.sy - p.y) < 120);
  });
  const open = (free.length >= want - kept.length ? free : stations).slice(0, want - kept.length);
  const group = (lane: number, slat: number) => `${lane}:${Math.sign(slat)}`;
  const rear = new Map<string, number>();
  for (const e of g.escorts) if (!e.leaving) rear.set(group(e.lane, e.slat), Math.min(rear.get(group(e.lane, e.slat)) ?? Infinity, e.d));
  open.forEach((st, k) => {
    const p = laneAt(g.map.channels[st.lane], st.d, st.lat);
    // In line astern from the lane's entry: a hull and its wake run ~210
    // long, so ships start 260 apart and never touch (round 13: and behind
    // any frigate already sailing on that side).
    const key = group(st.lane, st.lat);
    const d = Math.min(-80 - k * 260, (rear.get(key) ?? Infinity) - 260);
    rear.set(key, d);
    // On its track down that side of the lane (round 13).
    const lat = trackAt(escortTrack(g, st.lane, st.lat < 0 ? -1 : 1), d).lat;
    const at = laneAt(g.map.channels[st.lane], d, lat);
    g.escorts.push({ id: g.nextId++, x: at.x, y: at.y, sx: p.x, sy: p.y, fireT: 0.5 + k * 0.2, leaving: false, aim: 0, lane: st.lane, d, lat, sd: st.d, slat: st.lat, heading: Math.atan2(at.ty, at.tx) });
  });
  // Round 13: on each side of each lane the frigate furthest along takes
  // the furthest station, so none has to pass another to get to its own
  // (a frigate called back, or one still on station, may be ahead of a
  // fresh one bound further on).
  const groups = new Map<string, Escort[]>();
  for (const e of g.escorts) {
    if (e.leaving || e.from) continue;
    const key = group(e.lane, e.slat);
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  for (const grp of groups.values()) {
    const st = grp.map((e) => ({ sd: e.sd, slat: e.slat, sx: e.sx, sy: e.sy })).sort((a, b) => b.sd - a.sd);
    [...grp].sort((a, b) => b.d - a.d).forEach((e, k) => Object.assign(e, st[k]));
  }
}

/** A berthed frigate sails in and out this far further from the lane than
 *  its berth, and slides across onto the berth (at BERTH_SIDE of its speed,
 *  a gentle ~17° steer) over its last BERTH_SLIDE px. It backs out at
 *  BERTH_ASTERN of its speed. */
const BERTH_OUT = 40;
const BERTH_SLIDE = 160;
const BERTH_SIDE = 0.3;
const BERTH_ASTERN = 0.5;

/** Saltgate (the player: frigates must not pass the gates): frigates berth
 *  beside the canal in the stretches open to the map's edges (MapDef.
 *  berths), sailing in from the nearest edge and backing out to it. A new
 *  drop calls back any that are backing out (they never turned round, so
 *  they just sail up to their berths again); only missing ones sail in. */
function launchBerthed(g: Game, want: number): void {
  const berths = g.map.berths!.slice(0, want);
  const ch = g.map.channels[0];
  const L = laneLength(ch);
  const holds = (e: Escort, b: (typeof berths)[number]) => e.from === b.from && Math.abs(e.sx - laneAt(ch, laneDAtX(ch, b.x) ?? 0, b.lat).x) < 1;
  const kept = new Set<Escort>();
  const open = berths.filter((b) => {
    const e = g.escorts.find((o) => !kept.has(o) && holds(o, b));
    if (e) kept.add(e);
    return !e;
  });
  for (const e of g.escorts) e.leaving = !kept.has(e);
  if (!open.length) return;
  cue(g, 'frigate.arrive', open[0].from < 0 ? 0 : VIEW.width, VIEW.height / 2, { vx: -open[0].from * AB.frigate.speed });
  // In line astern from each end, the first in taking the berth furthest
  // from it, so none sails through another.
  for (const from of [-1, 1] as const) {
    open
      .filter((b) => b.from === from)
      .sort((a, b) => (b.x - a.x) * -from)
      .forEach((b, k) => {
        const sd = laneDAtX(ch, b.x) ?? 0;
        const lat = b.lat + Math.sign(b.lat) * BERTH_OUT;
        const d = from < 0 ? -80 - k * 260 : L + 80 + k * 260;
        const at = laneAt(ch, d, lat);
        const p = laneAt(ch, sd, b.lat);
        const heading = Math.atan2(at.ty, at.tx) + (from > 0 ? Math.PI : 0);
        g.escorts.push({ id: g.nextId++, x: at.x, y: at.y, sx: p.x, sy: p.y, fireT: 0.5 + k * 0.2, leaving: false, aim: heading, lane: 0, d, lat, sd, slat: b.lat, heading, from });
      });
  }
}

/** A berthed frigate's move: bow first along the water beside the lane to
 *  its berth, sliding across onto it at the end; leaving, it slides back out
 *  and backs off the way it came. It never turns round and never reaches a
 *  lock (MapDef.berths). Line astern as on the lanes. */
function sailBerthed(g: Game, e: Escort, dt: number): void {
  const ch = g.map.channels[e.lane];
  const from = e.from!;
  const goal = e.leaving ? (from < 0 ? -300 : laneLength(ch) + 300) : e.sd;
  const step = AB.frigate.speed * (e.leaving ? BERTH_ASTERN : 1) * dt;
  const before = e.d;
  // Across onto the berth at the end; out from it as it backs off.
  const out = e.slat + Math.sign(e.slat) * BERTH_OUT;
  const want = e.leaving ? out : Math.abs(e.d - e.sd) < BERTH_SLIDE ? e.slat : out;
  const side = AB.frigate.speed * BERTH_SIDE * dt;
  const dl = clamp(want - e.lat, -side, side);
  e.lat += dl;
  e.d = goal > e.d ? Math.min(goal, e.d + step) : Math.max(goal, e.d - step);
  const dir = Math.sign(e.d - before);
  if (dir) {
    for (const o of g.escorts) {
      // (One sailing out beside a berthed one passes it.)
      if (o === e || o.lane !== e.lane || Math.abs(o.lat - e.lat) >= 30) continue;
      const gap = (o.d - before) * dir;
      if (gap > 0 && gap < 400) e.d = dir > 0 ? Math.min(e.d, Math.max(before, o.d - 190)) : Math.max(e.d, Math.min(before, o.d + 190));
    }
  }
  const p = laneAt(ch, e.d, e.lat);
  // It faces in, away from the end it came from, the whole time, turned a
  // little by a slide across (a ship steering; backing out, the stern leads).
  const lane = Math.atan2(p.ty, p.tx) + (from > 0 ? Math.PI : 0);
  const moved = Math.abs(e.d - before);
  const drift = moved > 1e-6 || dl ? Math.atan2(dl * -from * (e.leaving ? -1 : 1), Math.max(moved, step)) : 0;
  const turn = ESCORT_TURN * dt;
  e.heading += clamp(angleDiff(lane + drift, e.heading), -turn, turn);
  e.x = p.x;
  e.y = p.y;
}

/** A station keeps this clear of the carrier, and frigates on one edge of a
 *  lane this far apart along it. */
/** The tightest lane turn (px of radius) a bomber flies beside, off its edge. */
const BOMBER_MIN_TURN = 250;
const ESCORT_CARRIER_CLEAR = 200;
/** Log v69 (the Delta's long river): how far along the lane a frigate's
 *  station may be at most (px; 10 s at its speed): on a lane longer than
 *  this the stations come in from the first stretch of it (the Delta's
 *  north leg, the one furthest from its carrier), so they are on station in
 *  time. A usual lane (1,680 px) is unchanged. */
const ESCORT_REACH = 2600;
const ESCORT_GAP = 280;
const ESCORT_GAP_MIN = 180;
/** How fast a frigate turns (rad/s): smoothly round a bend at its speed. */
const ESCORT_TURN = 2.6;
/** Log v29 (the Kesh playtest: "frigates are a little jittery on the
 *  turn"). Giving way round the hook's tight bend, a frigate used to step
 *  out for a hull one step and back onto its track the next, its bow
 *  flicking ~2.5° left and right each step (about 30-70 flips a minute on
 *  the Kesh Hook, none on a straight lane). Now, once it has stepped out,
 *  it holds that offset ESCORT_HOLD s before steering back in, and its bow
 *  follows its sideways drift smoothed over ESCORT_DRIFT_TAU s. */
const ESCORT_HOLD = 0.6;
const ESCORT_DRIFT_TAU = 0.25;
/** A lane is a polyline: offset 100+ px across it, a frigate's spot jumped
 *  at each corner of a bend (outside it) or doubled back (inside it), and
 *  its heading snapped by the corner's angle. Its pose is now the lane's
 *  averaged over ESCORT_SMOOTH px either side (the same on a straight). */
const ESCORT_SMOOTH = 40;
/** The bow eases onto where it wants to point over about this long (s). */
const ESCORT_HELM = 0.1;

/** A frigate's spot at d, `lat` across lane `ch`, round a bend smoothed
 *  (ESCORT_SMOOTH): the lane at that offset averaged over a short stretch,
 *  its direction the stretch's. */
function escortAt(ch: Channel, d: number, lat: number): { x: number; y: number; tx: number; ty: number } {
  let x = 0;
  let y = 0;
  let tx = 0;
  let ty = 0;
  for (let k = -2; k <= 2; k++) {
    const p = laneAt(ch, d + (k * ESCORT_SMOOTH) / 2, lat);
    x += p.x;
    y += p.y;
    tx += p.tx;
    ty += p.ty;
  }
  const n = Math.hypot(tx, ty) || 1;
  return { x: x / 5, y: y / 5, tx: tx / n, ty: ty / n };
}

// ---------------------------------------------------------------------------
// Frigates and the convoy (round 13, approved by the player: frigates must
// never run over convoy ships, on any map). Measured before: on the 19 lane
// maps a frigate overlapped a cargo hull 5-26% of its time on screen
// (docs/design/v3-saltgate-locks.md). Two causes, two fixes:
// - Stations sat at the lane's edge, inside the Spread's outer files (and
//   Harbor Mouth's opened-out Pairs). Now every station, and the track a
//   frigate sails in and out on, keeps ESCORT_WATER of clear water outside
//   the widest file any formation can sail there, out into open water off
//   the lane where the lane is too narrow (checked against the map's land).
// - Sailing in and out at 260 px/s through a convoy doing 40, cutting in
//   toward the centre where a lane narrows. Now a frigate never moves onto
//   a cargo hull: each step it takes the first move that keeps it clear,
//   on water: on along its track; else stepped out sideways into open
//   water; else slowed to hold behind or abeam the hull until there is room.

/** The hulls as drawn (ui/render.ts): a frigate is -74..78 along and ±12
 *  across; a cargo ship ±34 by ±10; the supertanker ±70 by ±16. */
const FRIGATE_HULL = { back: 74, fore: 78, beam: 12 };
const CARGO_HULL = { len: 34, beam: 10 };
const TANKER_HULL = { len: 70, beam: 16 };
/** Clear water between a frigate on its track or station and the widest
 *  file of any formation. */
const ESCORT_WATER = 12;
/** How much further out than that a track or station may go looking for
 *  open water (and still cover the convoy: a frigate reaches 560 px). */
const ESCORT_OUT = 150;
/** Clear water a frigate keeps from a cargo hull while it gives way, and
 *  from the shore. */
const ESCORT_GIVE = 4;
const ESCORT_SHORE = 4;
/** How fast a frigate steps across (a share of its speed: ~24° at most). */
const ESCORT_SIDE = 0.45;
/** It steps in ahead of a narrower stretch at this much across per px along
 *  (it can steer ESCORT_SIDE). */
const ESCORT_SLOPE = 0.4;
/** The track's sample spacing, and how far past each end of its lane. */
const TRACK_STEP = 10;
const TRACK_PAD = 600;

/** An oriented box: centre, heading, half length and beam, and how far its
 *  middle sits ahead of the centre. */
interface HullBox {
  x: number;
  y: number;
  h: number;
  L: number;
  B: number;
  o: number;
}

function frigateBox(x: number, y: number, h: number, grow = 0): HullBox {
  return { x, y, h, L: (FRIGATE_HULL.back + FRIGATE_HULL.fore) / 2 + grow, B: FRIGATE_HULL.beam + grow, o: (FRIGATE_HULL.fore - FRIGATE_HULL.back) / 2 };
}

function shipBox(s: { x: number; y: number; heading: number; vip?: boolean }): HullBox {
  const k = s.vip ? TANKER_HULL : CARGO_HULL;
  return { x: s.x, y: s.y, h: s.heading, L: k.len, B: k.beam, o: 0 };
}

/** The carrier's deck with its rack above it, as drawn (horizontal). */
function carrierHull(g: Game): HullBox {
  const c = g.map.carrier;
  return { x: c.x, y: c.y - 8, h: 0, L: CARRIER.halfLength + 4, B: CARRIER.halfBeam + 12, o: 0 };
}

/** Do two oriented boxes overlap (separating axes)? */
export function hullsOverlap(a: HullBox, b: HullBox): boolean {
  const ac = Math.cos(a.h);
  const as = Math.sin(a.h);
  const bc = Math.cos(b.h);
  const bs = Math.sin(b.h);
  const ax = a.x + ac * a.o;
  const ay = a.y + as * a.o;
  const bx = b.x + bc * b.o;
  const by = b.y + bs * b.o;
  const dx = bx - ax;
  const dy = by - ay;
  // Each box's half extent projected on an axis (ux, uy).
  const ext = (c: number, s: number, L: number, B: number, ux: number, uy: number) => L * Math.abs(c * ux + s * uy) + B * Math.abs(-s * ux + c * uy);
  for (const [ux, uy] of [[ac, as], [-as, ac], [bc, bs], [-bs, bc]]) {
    if (Math.abs(dx * ux + dy * uy) > ext(ac, as, a.L, a.B, ux, uy) + ext(bc, bs, b.L, b.B, ux, uy)) return false;
  }
  return true;
}

/** Is the whole hull (and `margin` round it) on water? Its outline is
 *  checked every ~20 px against the map's own land test. */
function hullWet(g: Game, b: HullBox, margin: number): boolean {
  const c = Math.cos(b.h);
  const s = Math.sin(b.h);
  const L = b.L + margin;
  const B = b.B + margin;
  const n = Math.ceil((2 * L) / 20);
  for (let i = 0; i <= n; i++) {
    const u = b.o - L + (2 * L * i) / n;
    for (const v of [-B, B]) if (onLand(g, b.x + c * u - s * v, b.y + s * u + c * v)) return false;
  }
  for (const u of [b.o - L, b.o + L]) if (onLand(g, b.x + c * u, b.y + s * u)) return false;
  return true;
}

/** How far off the lane's centre the widest file of any formation sails at
 *  d (slotLat's rule: one file down the middle of a narrows). */
function slotReach(ch: Channel, d: number): number {
  if (ch.vip) return 0;
  const hw = laneHalfWidth(ch, d);
  if (ch.widths && Math.min(hw, laneHalfWidth(ch, d + MERGE_AHEAD)) < LANE_FLOOR) return 0;
  let m = 0;
  for (const f of Object.values(FORMATIONS)) for (const o of f.offsets) m = Math.max(m, Math.abs(slotOffset(ch, o, hw, !!f.opens)));
  return m;
}

/** How far off the centre a hull can be at d: slotReach, held for the
 *  ~100 px a hull takes to ease across into a narrower slot. */
function fileReach(ch: Channel, d: number): number {
  let m = 0;
  for (let k = 0; k <= 100; k += 20) m = Math.max(m, slotReach(ch, d - k));
  return m;
}

/** A frigate's track down one side of a lane: `lat[i]` across at
 *  d = d0 + i·TRACK_STEP (its sign is the side): the nearest line to the
 *  files it can sail there. `berth`: that line keeps ESCORT_WATER of clear
 *  water from every file of every formation (a station can go there);
 *  `ok`: it at least passes them clear; else (a narrows, the inside of a
 *  tight bend, the carrier close by) it is as far out as there is water.
 *  `shut`: not even room beside one hull on the centre line. */
export interface EscortTrack {
  d0: number;
  lat: Float64Array;
  /** How far out (unsigned) there is water to sail at each sample. */
  wide: Float64Array;
  ok: Uint8Array;
  berth: Uint8Array;
  /** The first sample at or after i that isn't ok (or the length), and the
   *  last at or before i (or -1); the first shut one at or after i. */
  badOn: Int32Array;
  badBack: Int32Array;
  shutOn: Int32Array;
}

const tracks = new WeakMap<MapDef, Map<string, EscortTrack>>();

/** The track a frigate sails on one side (`side` ±1) of lane `lane`,
 *  checked against a box round every place a hull of any formation can be
 *  on every lane, the map's land (its own water test) and the carrier; no
 *  further out than ESCORT_OUT past the files. Fixed for the map, so worked
 *  out once. */
export function escortTrack(g: Game, lane: number, side: number): EscortTrack {
  let byKey = tracks.get(g.map);
  if (!byKey) tracks.set(g.map, (byKey = new Map()));
  const key = `${lane}:${side}`;
  const hit = byKey.get(key);
  if (hit) return hit;
  const chans = g.map.channels;
  const ch = chans[lane];
  // Every place a hull can be: along each lane, a box as wide as its files.
  const files: HullBox[] = [];
  chans.forEach((c) => {
    const L = laneLength(c);
    const hull = c.vip ? TANKER_HULL : CARGO_HULL;
    for (let d = -12; d <= L; d += 8) {
      const p = lanePoint(c, d);
      files.push({ x: p.x, y: p.y, h: Math.atan2(p.ty, p.tx), L: hull.len, B: hull.beam + fileReach(c, d), o: 0 });
    }
  });
  const carrier = carrierHull(g);
  // (It passes the carrier with a little water: more than it keeps from it
  // as it sails, room to steer.)
  const clearAt = (d: number, lat: number, water: number): boolean => {
    const p = laneAt(ch, d, lat);
    const box = frigateBox(p.x, p.y, Math.atan2(p.ty, p.tx));
    if (!hullWet(g, box, ESCORT_SHORE)) return false;
    if (hullsOverlap(frigateBox(p.x, p.y, box.h, ESCORT_GIVE + 8), carrier)) return false;
    const grown = frigateBox(p.x, p.y, box.h, water);
    for (const f of files) if (Math.abs(f.x - p.x) < 260 && Math.abs(f.y - p.y) < 260 && hullsOverlap(grown, f)) return false;
    return true;
  };
  // Water it can sail: no shore, and not the carrier.
  const wetAt = (d: number, lat: number): boolean => {
    const p = laneAt(ch, d, lat);
    const box = frigateBox(p.x, p.y, Math.atan2(p.ty, p.tx));
    return hullWet(g, box, ESCORT_SHORE) && !hullsOverlap(frigateBox(p.x, p.y, box.h, ESCORT_GIVE + 8), carrier);
  };
  const search = (d: number, from: number, water: number): number => {
    // Outward from the files, but never past a shore or the carrier to
    // water behind it (it could not get there).
    for (let lat = from; lat <= from + ESCORT_OUT; lat += 3) {
      if (clearAt(d, side * lat, water)) return lat;
      if (!wetAt(d, side * lat)) break;
    }
    return -1;
  };
  const L = laneLength(ch);
  const d0 = -TRACK_PAD;
  const n = Math.ceil((L + 2 * TRACK_PAD) / TRACK_STEP) + 1;
  const lat = new Float64Array(n);
  const ok = new Uint8Array(n);
  const berth = new Uint8Array(n);
  const shut = new Uint8Array(n);
  const wide = new Float64Array(n);
  const beams = CARGO_HULL.beam + FRIGATE_HULL.beam;
  for (let i = 0; i < n; i++) {
    const d = d0 + i * TRACK_STEP;
    const reach = fileReach(ch, Math.max(0, Math.min(L, d))) + beams;
    let at = search(d, reach + ESCORT_WATER, ESCORT_WATER);
    if (at >= 0) berth[i] = ok[i] = 1;
    else if ((at = search(d, reach + ESCORT_GIVE + 2, ESCORT_GIVE + 2)) >= 0) ok[i] = 1;
    else {
      // No clear line: as far out toward it as there is water.
      at = reach + ESCORT_GIVE + 2;
      while (at > 0 && !wetAt(d, side * at)) at -= 3;
      at = Math.max(0, at);
      if (at < beams + ESCORT_GIVE + 2) shut[i] = 1;
    }
    lat[i] = side * at;
    // And how far out from it there is water to sail.
    let w = at;
    while (w < at + ESCORT_OUT + 60 && wetAt(d, side * (w + 3))) w += 3;
    wide[i] = w;
  }
  const badOn = new Int32Array(n);
  const badBack = new Int32Array(n);
  const shutOn = new Int32Array(n);
  for (let i = n - 1, next = n; i >= 0; i--) badOn[i] = next = ok[i] ? next : i;
  for (let i = 0, last = -1; i < n; i++) badBack[i] = last = ok[i] ? last : i;
  for (let i = n - 1, next = n; i >= 0; i--) shutOn[i] = next = shut[i] ? i : next;
  const t = { d0, lat, wide, ok, berth, badOn, badBack, shutOn };
  byKey.set(key, t);
  return t;
}

/** The track's sample at or nearest d. */
function trackIndex(t: EscortTrack, d: number): number {
  return Math.max(0, Math.min(t.lat.length - 1, Math.round((d - t.d0) / TRACK_STEP)));
}

/** Does the track pass every file clear all the way from d to `to`? */
function trackClear(t: EscortTrack, d: number, to: number): boolean {
  const a = trackIndex(t, Math.min(d, to));
  const b = trackIndex(t, Math.max(d, to));
  return t.badOn[a] > b;
}

/** Is there room beside a single file all the way from d to `to`? */
function trackOpen(t: EscortTrack, d: number, to: number): boolean {
  const a = trackIndex(t, Math.min(d, to));
  const b = trackIndex(t, Math.max(d, to));
  return t.shutOn[a] > b;
}

/** The track's offset across the lane at d (between samples, a straight
 *  line), and whether a frigate could hold station there. */
function trackAt(t: EscortTrack, d: number): { lat: number; berth: boolean } {
  const u = Math.max(0, Math.min(t.lat.length - 1.001, (d - t.d0) / TRACK_STEP));
  const i = Math.floor(u);
  const k = u - i;
  return { lat: t.lat[i] + (t.lat[i + 1] - t.lat[i]) * k, berth: !!t.berth[i] && !!t.berth[i + 1] };
}

/** Where a frigate at d sailing toward `goal` steers across: its track,
 *  stepped out early enough to clear what is ahead on its way (it steps
 *  across no faster than ESCORT_SLOPE of the way it sails: out round the
 *  carrier, say), and in early enough where the water ahead narrows; never
 *  for anything past its goal. Where the two can't both be had, the water
 *  wins (it then passes the files with less room, giving way as it goes). */
function trackAhead(t: EscortTrack, d: number, goal: number): number {
  const here = trackAt(t, d).lat;
  const side = Math.sign(here) || 1;
  const dir = Math.sign(goal - d);
  if (!dir) return here;
  const i0 = trackIndex(t, d);
  const i1 = trackIndex(t, goal);
  let out = Math.abs(here);
  let room = t.wide[i0];
  const H = Math.ceil(300 / ESCORT_SLOPE / TRACK_STEP);
  for (let k = 1; k <= H; k++) {
    const i = i0 + dir * k;
    if ((i - i1) * dir > 0 || i < 0 || i >= t.lat.length) break;
    out = Math.max(out, Math.abs(t.lat[i]) - ESCORT_SLOPE * TRACK_STEP * k);
    room = Math.min(room, t.wide[i] + ESCORT_SLOPE * TRACK_STEP * k);
  }
  return side * Math.min(out, room);
}

/** Pick each frigate's lane and station: on its track beside the convoy,
 *  clear of every file (in open water off the lane where the lane is too
 *  narrow), on screen, clear of the carrier and of the other frigates. The
 *  first one in takes the furthest station. */
function escortStations(g: Game, n: number): { lane: number; d: number; lat: number }[] {
  const chans = g.map.channels;
  const usable = chans.map((_, i) => i).filter((i) => !chans[i].tide && !chans[i].vip);
  const lanes = usable.length ? usable : chans.map((_, i) => i);
  const c = g.map.carrier;
  // The first one in takes the furthest station, so none sails through another.
  const fracs = n >= 3 ? [0.62, 0.46, 0.3] : [0.62, 0.3];
  const taken: { lane: number; d: number; lat: number; x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const own = lanes[i % lanes.length];
    const side = i % 2 ? 1 : -1;
    // Candidates nearest the wanted spot first, on the wanted edge first,
    // on its own lane first (round 13: another lane's water where its own
    // has no room beside the convoy, as on the Sharra Delta's rivers),
    // where the track is clear of the files and the station is on screen.
    const cands: { lane: number; d: number; lat: number; cost: number }[] = [];
    let fall: { lane: number; d: number; lat: number } | null = null;
    for (const lane of [own, ...lanes.filter((l) => l !== own)]) {
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
      const want = (d1 - d0 < 600 && n >= 3 ? [0.96, 0.5, 0.04] : fracs)[i % fracs.length] * Math.min(1, ESCORT_REACH / Math.max(1, d1 - d0));
      if (lane === own) {
        const d = d0 + (d1 - d0) * want;
        fall = { lane, d, lat: trackAt(escortTrack(g, lane, side), d).lat };
      }
      for (let u = 0.04; u <= 0.96; u += 0.02) {
        const d = d0 + (d1 - d0) * u;
        for (const sgn of [side, -side]) {
          const tr = escortTrack(g, lane, sgn);
          const at = trackAt(tr, d);
          if (!at.berth) continue;
          const p = laneAt(ch, d, at.lat);
          if (p.x < 60 || p.x > VIEW.width - 60 || p.y < 40 || p.y > VIEW.height - 40) continue;
          // Best clear all the way in from the lane's entry (so it never
          // waits to come in, and can always back out). Past a tight
          // stretch it waits for a gap in the convoy to go in; past a
          // narrows one ship wide, for the narrows to empty.
          const entry = -80 - 2 * 260;
          const way = trackClear(tr, entry, d + 80) ? 0 : trackOpen(tr, entry, d + 80) ? 0.01 : 20;
          cands.push({ lane, d, lat: at.lat, cost: Math.abs(u - want) + (sgn === side ? 0 : 0.25) + (lane === own ? 0 : 0.3) + way });
        }
      }
    }
    cands.sort((a, b) => a.cost - b.cost);
    const ok = (k: { lane: number; d: number; lat: number }, gap: number) => {
      const p = laneAt(chans[k.lane], k.d, k.lat);
      if (Math.hypot(p.x - c.x, p.y - c.y) < ESCORT_CARRIER_CLEAR) return false;
      return taken.every((t) => (t.lane === k.lane && Math.sign(t.lat) === Math.sign(k.lat) ? Math.abs(t.d - k.d) >= gap : Math.hypot(t.x - p.x, t.y - p.y) >= 190));
    };
    // Well apart if there is room; closer (still clear of each other) in a
    // short basin. One it can sail straight in to first, either way.
    const straight = (k: { cost: number }) => k.cost < 10;
    const pick =
      cands.find((k) => straight(k) && ok(k, ESCORT_GAP)) ??
      cands.find((k) => straight(k) && ok(k, ESCORT_GAP_MIN)) ??
      cands.find((k) => ok(k, ESCORT_GAP)) ??
      cands.find((k) => ok(k, ESCORT_GAP_MIN)) ??
      cands[0] ?? fall!;
    const p = laneAt(chans[pick.lane], pick.d, pick.lat);
    taken.push({ lane: pick.lane, d: pick.d, lat: pick.lat, x: p.x, y: p.y });
  }
  return taken.map(({ lane, d, lat }) => ({ lane, d, lat }));
}

function updateEscorts(g: Game, dt: number): void {
  if (!g.escorts.length) return;
  const on = held(g, 'frigate');
  if (!on && g.escorts.some((e) => !e.leaving)) cue(g, 'frigate.leave', VIEW.width * 0.6, VIEW.height / 2, { vx: AB.frigate.speed });
  for (const e of g.escorts) {
    if (!on) e.leaving = true;
    if (e.from) sailBerthed(g, e, dt);
    else sailLane(g, e, dt);
    // Round 6 cycle 5: they used to hold fire until on station, so the far
    // frigate spent ~4.6 s of the 15 sailing in silent; now they open up as
    // soon as they are on screen.
    if (e.leaving || !on || e.x < 20 || e.x > VIEW.width - 20 || e.y < 20 || e.y > VIEW.height - 20) continue;
    e.fireT -= dt;
    if (e.fireT > 0) continue;
    // The nearest threat in reach that still needs a shot.
    // A Lure Beacon in reach draws its fire first (the enemy build).
    const target = lured(g, e.x, e.y, AB.frigate.range, g.threats
      .filter((t) => released(t) && !isStructure(t.kind) && dist(t.x, t.y, e.x, e.y) <= AB.frigate.range && assigned(g, t.id) < t.hp)
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
    g.interceptors.push({ id: g.nextId++, x: mx, y: my, target: target.id, tx: target.x, ty: target.y, life: 0, src: 'gun', by: 'frigate' });
    addFx(g, 'launch', mx, my, { life: 0.3, r: 10 });
    cue(g, 'frigate.fire', mx, my);
  }
  // Gone: off the end of its lane (a berthed one, off the end it came from).
  g.escorts = g.escorts.filter((e) => !(e.leaving && ((e.from ?? e.out) === -1 ? e.d <= -250 : e.d >= laneLength(g.map.channels[e.lane]) + 250)));
}

/** Can frigate `e` sail its track from where it is to `to` at `speed`
 *  without its hull coming within ESCORT_GIVE (and a little) of any cargo
 *  hull, each where it will be by then (sailing its lane at its speed)? */
function runClear(g: Game, e: Escort, track: EscortTrack, to: number, speed: number): boolean {
  const ch = g.map.channels[e.lane];
  const dir = Math.sign(to - e.d);
  const n = Math.ceil(Math.abs(to - e.d) / 10);
  for (let k = 1; k <= n; k++) {
    const d = e.d + (dir * Math.abs(to - e.d) * k) / n;
    const t = Math.abs(d - e.d) / Math.max(1, speed);
    const p = laneAt(ch, d, trackAhead(track, d, to));
    const box = frigateBox(p.x, p.y, Math.atan2(p.ty, p.tx), ESCORT_GIVE + 4);
    for (const s of g.ships) {
      const q = laneAt(g.map.channels[s.channel], s.d + laneSpeed(g, s) * t, s.lat);
      if (Math.abs(q.x - p.x) > 200 || Math.abs(q.y - p.y) > 200) continue;
      if (hullsOverlap(box, shipBox({ x: q.x, y: q.y, heading: Math.atan2(q.ty, q.tx), vip: s.vip }))) return false;
    }
  }
  return true;
}

/** A frigate's move on a lane: along its track (escortTrack) in to its
 *  station, or off down the lane, giving way to the convoy (round 13). Each
 *  step it takes the first of these that leaves its hull clear of every
 *  cargo hull (where that hull is now and where it is about to be) and on
 *  water: on at full speed, steering for its track; on, stepping out
 *  sideways; slower (half, then about the convoy's own speed); holding
 *  where it is; easing back. Never through a hull, never a jump: a frigate
 *  that finds no room holds behind or abeam the hull until it has some. */
function sailLane(g: Game, e: Escort, dt: number): void {
  const ch = g.map.channels[e.lane];
  const side = e.slat < 0 ? -1 : 1;
  const track = escortTrack(g, e.lane, side);
  // Off down the lane.
  const end = laneLength(ch) + 260;
  // Leaving: on down the lane, unless its track ahead runs through a
  // narrows with no room beside the convoy and the way it came is clear:
  // then it backs out that way, stern first at half speed (as a berthed
  // frigate does: it never turns about).
  if (e.leaving && !e.out) e.out = trackClear(track, e.d, end) || !trackClear(track, e.d, -260) ? 1 : -1;
  const goal = e.leaving ? (e.out === -1 ? -260 : end) : e.sd;
  const step = AB.frigate.speed * dt;
  let along = clamp(goal - e.d, -step, step) * (e.leaving && e.out === -1 ? BERTH_ASTERN : 1);
  // Where its track ahead doesn't pass every file clear (a narrows, the
  // inside of a tight bend, the carrier close by), it goes in only when it
  // can run that stretch at speed without coming near a hull (it sails it
  // ahead of time against where each hull will be); until then it waits
  // on clear water short of it. (It never stops in there, so no hull runs
  // into it from behind.)
  if (along && trackClear(track, e.d, e.d + Math.sign(along) * 40) && !trackClear(track, e.d, e.d + along + Math.sign(along) * 100)) {
    const dir0 = Math.sign(along);
    const here = trackIndex(track, e.d);
    let j = dir0 > 0 ? track.badOn[here] : track.badBack[here];
    while (j > 0 && j < track.ok.length - 1 && !track.ok[j]) j += dir0;
    const far = track.d0 + j * TRACK_STEP + dir0 * 80;
    if (!runClear(g, e, track, far, Math.abs(along) / dt)) along = 0;
  }
  // Line astern: never closer than a hull and its wake to a frigate ahead
  // on its own side of the lane.
  const dir = Math.sign(along);
  if (dir) {
    for (const o of g.escorts) {
      if (o === e || o.from || o.lane !== e.lane || Math.sign(o.slat) !== side || Math.abs(o.lat - e.lat) >= 60) continue;
      const gap = (o.d - e.d) * dir;
      if (gap > 0 && gap < 400) along = dir > 0 ? Math.min(along, Math.max(0, gap - 190)) : Math.max(along, -Math.max(0, gap - 190));
    }
  }
  const sideStep = AB.frigate.speed * ESCORT_SIDE * dt;
  const ease = Math.min(1, dt / ESCORT_DRIFT_TAU);
  // Just stepped out for a hull: hold that offset a moment, not back in.
  const holding = (e.holdT ?? 0) > 0;
  // Steering for its track, the step across eased from the last one
  // (ESCORT_DRIFT_TAU): the track is sampled every few px, and a frigate
  // chasing each sample went in and out a pixel or two a step.
  const steerFor = (d: number) => {
    let want = e.leaving || Math.abs(goal - d) > 1 ? trackAhead(track, d, goal) : e.slat;
    if (holding && side * (want - e.lat) < 0) want = e.lat;
    const gap = want - e.lat;
    const raw = clamp(gap, -sideStep, sideStep);
    const prev = clamp(e.vl ?? raw, -sideStep, sideStep);
    const eased = prev + (raw - prev) * ease;
    // Never past the track: an eased step that would overshoot stops on it.
    return Math.sign(eased) === Math.sign(gap) && Math.abs(eased) > Math.abs(gap) ? gap : eased;
  };
  const out = side * sideStep;
  // Each move: along, across, and whether it is a step out for a hull.
  const moves: [number, number, boolean][] = [];
  for (const a of [along, along * 0.5, along * 0.15, 0]) {
    const steer = steerFor(e.d + a);
    moves.push([a, steer, false], [a, out, steer !== out]);
  }
  moves.push([0, 0, false], [-0.15 * step * (dir || 1), out, true], [-0.15 * step * (dir || 1), 0, false]);
  // The hulls near enough to matter, each with the stretch it sails in the
  // next quarter second.
  const look = 0.25;
  const near = g.ships
    .filter((s) => Math.abs(s.x - e.x) < 320 && Math.abs(s.y - e.y) < 320)
    .map((s) => {
      const b = shipBox(s);
      const run = (laneSpeed(g, s) * look) / 2;
      return { ...b, x: b.x + Math.cos(b.h) * run, y: b.y + Math.sin(b.h) * run, L: b.L + run };
    });
  const turn = ESCORT_TURN * dt;
  // The bow eases onto its aim (ESCORT_HELM s), never past ESCORT_TURN.
  const steer = Math.min(1, dt / ESCORT_HELM);
  const pose = (a: number, l: number, stepOut = false) => {
    const d = e.d + a;
    const lat = e.lat + l;
    const p = escortAt(ch, d, lat);
    // Heading: the lane's, turned a little by any sideways drift (at most
    // ~24°, a ship steering across, never crabbing sideways), the drift
    // smoothed (log v29). Sailing back up the lane it goes stern first a
    // moment (it never turns about); on station it keeps whichever way it
    // faces.
    const lane = Math.atan2(p.ty, p.tx);
    const drift = (e.drift ?? 0) + ((a > 1e-6 ? Math.atan2(l, Math.max(step, 1e-6)) : 0) - (e.drift ?? 0)) * ease;
    const aim = a > 1e-6 ? lane + drift : Math.abs(angleDiff(lane + Math.PI, e.heading)) < Math.abs(angleDiff(lane, e.heading)) ? lane + Math.PI : lane;
    const heading = e.heading + clamp(angleDiff(aim, e.heading) * steer, -turn, turn);
    return { d, lat, x: p.x, y: p.y, heading, drift, stepOut };
  };
  const clear = (q: { x: number; y: number; heading: number }) => {
    const box = frigateBox(q.x, q.y, q.heading, ESCORT_GIVE);
    return near.every((b) => !hullsOverlap(box, b));
  };
  // (Nor onto the carrier, nor the shore.)
  const deck = carrierHull(g);
  const wet = (q: { x: number; y: number; heading: number }) => !hullsOverlap(frigateBox(q.x, q.y, q.heading, ESCORT_SHORE), deck) && hullWet(g, frigateBox(q.x, q.y, q.heading), 0);
  const tried = moves.map(([a, l, o]) => pose(a, l, o));
  const next = tried.find((q) => clear(q) && wet(q)) ?? tried.find(clear) ?? pose(0, 0);
  e.vl = next.lat - e.lat;
  e.d = next.d;
  e.lat = next.lat;
  e.heading = next.heading;
  e.x = next.x;
  e.y = next.y;
  e.drift = next.drift;
  e.holdT = next.stepOut ? ESCORT_HOLD : Math.max(0, (e.holdT ?? 0) - dt);
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
      .filter((t) => released(t) && isTarget(t) && dist(t.x, t.y, x, y) <= reach && assigned(g, t.id) < t.hp)
      .sort((p, q) => dist(p.x, p.y, x, y) - dist(q.x, q.y, x, y))[0]);
    if (!target) return a;
    a.ammo -= 1;
    g.interceptors.push({ id: g.nextId++, x, y: y - 8, target: target.id, tx: target.x, ty: target.y, life: 0, src: 'gun', by: 'aegis' });
    addFx(g, 'launch', x, y - 8, { life: 0.3, r: 8 });
    cue(g, 'aegis.launch', x, y);
    return a;
  };
  // What is about to hit a hull: a munition aimed at it (round 11: never
  // the aircraft that dropped or fired it, only what it dropped or fired).
  for (const s of g.ships) s.aegis = arm(s.aegis, AB.aegis.missiles[k], s.x, s.y, (t) => t.target === s.id && isMunitionKind(t.kind));
  if (w.level >= 3) {
    const c = g.map.carrier;
    g.carrierAegis = arm(g.carrierAegis, AB.aegis.carrier, c.x, c.y, (t) => t.target === CARRIER_TARGET && isMunitionKind(t.kind));
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
    .filter((t) => released(t) && !isStructure(t.kind) && dist(t.x, t.y, c.x, c.y) <= g.stats.pdRange && assigned(g, t.id) < t.hp)
    .sort((a, b) => dist(a.x, a.y, c.x, c.y) - dist(b.x, b.y, c.x, c.y))[0]);
  if (!target) {
    g.pdT = 0.1;
    return;
  }
  g.pdT = g.stats.pdGap;
  // From the carrier's bow end nearer the threat, so it reads as its own gun.
  const mx = c.x + Math.sign(target.x - c.x || 1) * CARRIER.halfLength * 0.6;
  g.interceptors.push({ id: g.nextId++, x: mx, y: c.y, target: target.id, tx: target.x, ty: target.y, life: 0, src: 'gun', by: 'pointDefense' });
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
    if (g.tel) g.tel.heal(g, 's', s.id, 1, s.hp, 'damageControl');
    addFx(g, 'text', s.x, s.y - 24, { life: 1, text: '+1' });
  }
  if (carrier) {
    g.carrierHp += 1;
    if (g.tel) g.tel.heal(g, 'c', 0, 1, g.carrierHp, 'damageControl');
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
    .filter((t) => released(t) && dist(t.x, t.y, x, y) <= Math.max(radius, AB.seeker.reach))
    .sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y));
  if (!near.length) return 'empty';
  if (!spend(g)) return 'dry';
  const c = muzzle(g, x, y);
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
      tap: true,
      blast: AB.seeker.blast,
      dmg,
      retarget: level >= 3,
      ...(twinSide ? { twin: true } : {}),
    });
  }
  return 'fire';
}

/** The live threat nearest (x, y), if any. */
function nearestThreat(g: Game, x: number, y: number): Threat | undefined {
  let best: Threat | undefined;
  let bd = Infinity;
  for (const t of g.threats) {
    if (!released(t)) continue;
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
  // Hyper Overdrive's second jet flies the same row, a length behind.
  const behind = twinSide ? 170 : 0;
  if (!twinSide) cue(g, 'jet.flyby', dir > 0 ? -80 : VIEW.width + 80, y, { vx: dir * AB.airstrike.speed });
  g.allies.push({
    id: g.nextId++,
    x: dir > 0 ? -80 - behind : VIEW.width + 80 + behind,
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
  const c = muzzle(g, x, y);
  const len0 = dist(c.x, c.y, x, y) || 1;
  const ux = (x - c.x) / len0;
  const uy = (y - c.y) / len0;
  const len = entryDistance(c.x, c.y, ux, uy);
  const k = level - 1;
  const width = AB.railgun.width[k];
  for (const th of [...g.threats]) {
    if (!released(th)) continue;
    const along = (th.x - c.x) * ux + (th.y - c.y) * uy;
    if (along < 0 || along > len) continue;
    const off = Math.abs((th.x - c.x) * uy - (th.y - c.y) * ux);
    if (off <= width + 8) damageThreat(g, th, AB.railgun.damage[k], true, 'railgun');
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
    .filter((t) => released(t) && t.id !== fromId && !struck.has(t.id) && dist(t.x, t.y, x, y) <= AB.tesla.range)
    .sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y))
    .slice(0, AB.tesla.arcs[k]);
  for (const t of next) {
    struck.add(t.id);
    addFx(g, 'arc', x, y, { life: 0.3, x2: t.x, y2: t.y });
    cue(g, 'tesla.arc', t.x, t.y);
    const tx = t.x;
    const ty = t.y;
    damageThreat(g, t, 1, true, 'tesla');
    teslaArc(g, level, tx, ty, t.id, depth - 1, struck);
  }
}

// ---------------------------------------------------------------------------
// The weapons plan, phase 1 (docs/design/v3-weapons-plan.md): Charge Lance,
// Laser Cutter and Grapnel are pressed, not tapped (press / pressMove /
// release, recorded in the play log like taps); Chain Shot, Fire Control and
// Cadence Gun are taps with a rule. With any of them, a plain tap is a plain
// shot, so the gun is never helpless.

/** Focus (a boost): its button goes down or comes up (Test Lab round 8:
 *  "a button you hold on the left side of the screen with your left thumb
 *  ... so it doesn't waste ammo"). While it is held and the bank lasts, time
 *  slows; the button fires nothing, and every tap on the water is a shot.
 *  Recorded in the play log as 'h' commands, so a run replays exactly. */
export function focusHold(g: Game, down: boolean): void {
  if (g.phase !== 'wave') return;
  if (g.tel) g.tel.input(g, 'focus', { on: down ? 1 : 0 });
  if (down && !g.finger) g.fingerT = g.realT;
  g.finger = down;
  g.focusing = focusOn(g);
}

/** Is Focus slowing time: the button held, with time banked? (Round 5's
 *  0.3 s long-press is gone: the button is only ever a hold.) */
function focusOn(g: Game): boolean {
  return g.finger && g.boost?.id === 'focus' && g.boost.bank > 0;
}

/** A finger down on the water. With a gesture weapon loaded it starts a
 *  press; otherwise it does nothing (the UI taps instead). */
export function press(g: Game, x: number, y: number, radius: number): void {
  if (g.phase !== 'wave') return;
  const gesture = gestureOf(g.weapon?.id);
  if (!gesture) return;
  if (g.tel) g.tel.input(g, 'press', { x, y, r: radius });
  g.press = { x0: x, y0: y, x, y, t0: g.t, radius, mode: 'pending', hook: null, cut: [], cutLen: 0, vx: 0, vy: 0, smacked: {} };
  if (gesture === 'drag') {
    const w = g.weapon!;
    const c = g.map.carrier;
    // Hook the threat under the finger, anywhere on the screen (Test Lab
    // round 5; structures are too big to swing).
    void w;
    const th = g.threats
      .filter((t) => released(t) && !t.held && !isStructure(t.kind) && dist(t.x, t.y, x, y) <= radius)
      .sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y))[0];
    if (!th) return;
    // A pickup under the finger wins, as it would for a tap.
    if (g.pickups.some((p) => dist(p.x, p.y, x, y) <= radius + PICKUPS.radius && dist(p.x, p.y, x, y) < dist(th.x, th.y, x, y) && !pickupLocked(g, p))) return;
    if (!spend(g)) {
      g.press.mode = 'dry';
      g.taps.dry += 1;
      if (g.tel) g.tel.gesture(g, 'dry', x, y, w.id, th.id);
      return;
    }
    th.held = true;
    g.press.mode = 'hook';
    g.press.hook = th.id;
    g.taps.fire += 1;
    if (g.tel) g.tel.gesture(g, 'fire', x, y, w.id, th.id);
    addFx(g, 'chain', c.x, c.y - 6, { life: 0.25, x2: th.x, y2: th.y });
    cue(g, 'grapnel.hook', th.x, th.y);
  }
}

/** The finger moves (the UI sends a move at most once a step). Its cut is
 *  the player's own hand (round 11: the Laser Cutter now cuts a Lure
 *  Beacon). */
export function pressMove(g: Game, x: number, y: number): void {
  const p = g.press;
  if (!p || g.phase !== 'wave') return;
  g.foe.byTap = true;
  try {
    pressMoveNow(g, p, x, y);
  } finally {
    g.foe.byTap = false;
  }
}

function pressMoveNow(g: Game, p: Press, x: number, y: number): void {
  if (g.tel) g.tel.input(g, 'move', { x, y });
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
        if (g.tel) g.tel.gesture(g, 'dry', x, y, w.id);
        return;
      }
      p.mode = 'swipe';
      g.taps.fire += 1;
      if (g.tel) g.tel.gesture(g, 'fire', x, y, w.id);
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
    const held = !!g.press;
    const res = releaseNow(g, x, y, radius);
    if (g.tel && held) g.tel.input(g, 'release', { x, y, r: radius, ...(res ? { res } : {}) });
    return res;
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
    if (g.tel) g.tel.gesture(g, 'dry', p.x, p.y, w.id);
    return 'dry';
  }
  g.taps.fire += 1;
  if (g.tel) g.tel.gesture(g, 'fire', p.x, p.y, w.id);
  const near = g.threats.filter((t) => released(t) && dist(t.x, t.y, p.x, p.y) <= p.radius).sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y))[0];
  const ax = near ? near.x : p.x;
  const ay = near ? near.y : p.y;
  firstShot(g, () => lanceShot(g, w, ch, ax, ay));
  // Hyper Overdrive: a second lance from its own muzzle, crossing the first
  // at the target.
  if (hyper(g)) twinShot(() => lanceShot(g, w, ch, ax, ay));
  return 'fire';
}

/** The lance (or the half-charge bolt) from the gun through (ax, ay). */
function lanceShot(g: Game, w: Weapon, ch: number, ax: number, ay: number): void {
  const c = muzzle(g, ax, ay);
  const len0 = dist(c.x, c.y, ax, ay) || 1;
  const ux = (ax - c.x) / len0;
  const uy = (ay - c.y) / len0;
  const ang = Math.atan2(uy, ux);
  if (ch >= AB.lance.full) {
    // The lance: everything in line, to the edge of the sea.
    const len = entryDistance(c.x, c.y, ux, uy);
    rayHits(g, c.x, c.y, ang, len, AB.lance.width, true, AB.lance.fullDmg, 'lance');
    addFx(g, 'lance', c.x, c.y - 6, { life: 0.5, x2: c.x + ux * len, y2: c.y + uy * len, r: AB.lance.width * 1.6 });
    if (!twinSide) cue(g, 'lance.full', c.x, c.y);
    if (w.level >= ABILITY_MAX) {
      g.fields.push({ kind: 'sun', x1: c.x, y1: c.y, x2: c.x + ux * len, y2: c.y + uy * len, hw: AB.lance.width, t: 0, life: AB.lance.burn, tick: AB.airstrike.burnTick, level: w.level });
    }
    return;
  }
  // Half charge: a bolt into the first threat on the line (from level 2,
  // through everything on it).
  const end = rayHits(g, c.x, c.y, ang, entryDistance(c.x, c.y, ux, uy), AB.lance.width, w.level >= 2, AB.lance.halfDmg, 'lance');
  addFx(g, 'lance', c.x, c.y - 6, { life: 0.3, x2: end.x, y2: end.y, r: AB.lance.width * 0.8 });
  if (!twinSide) cue(g, 'lance.half', c.x, c.y);
}

/** Laser Cutter: cut the stretch from (x1, y1) to (x2, y2). A round cuts
 *  AB.cutter.length px; while the finger stays down the cut goes on, a new
 *  round for each length (and each threat can be cut again by it), until
 *  the finger lifts or the rack is dry (Test Lab round 5: "once you hold
 *  down, you could just burn through all your ammo, but at the same rate"). */
function cutAlong(g: Game, w: Weapon, p: Press, x1: number, y1: number, x2: number, y2: number): void {
  const L = AB.cutter.length[w.level - 1];
  let seg = dist(x1, y1, x2, y2);
  while (seg > 1e-6 && p.mode === 'swipe') {
    if (L - p.cutLen <= 1e-6) {
      // This round is cut through: the next one, while the rack lasts.
      if (!spend(g)) {
        p.mode = 'dry';
        return;
      }
      p.cutLen = 0;
      p.cut = [];
      p.cut2 = [];
      cue(g, 'cutter.swipe', x1, y1);
    }
    const take = Math.min(seg, L - p.cutLen);
    const ex = x1 + ((x2 - x1) * take) / seg;
    const ey = y1 + ((y2 - y1) * take) / seg;
    cutStretch(g, w, p.cut, x1, y1, ex, ey);
    // Hyper Overdrive: a second beam beside the first, cutting on its own.
    if (hyper(g)) {
      const ox = (-(ey - y1) / take) * AB.overdrive.twin;
      const oy = ((ex - x1) / take) * AB.overdrive.twin;
      p.cut2 ??= [];
      twinSide = AB.overdrive.twin;
      cutStretch(g, w, p.cut2, x1 + ox, y1 + oy, ex + ox, ey + oy);
      twinSide = 0;
    }
    p.cutLen += take;
    seg -= take;
    x1 = ex;
    y1 = ey;
  }
}

/** One stretch of a cut: every threat within reach of it not yet in `cut`. */
function cutStretch(g: Game, w: Weapon, cut: number[], x1: number, y1: number, x2: number, y2: number): void {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const l2 = vx * vx + vy * vy || 1;
  for (const th of [...g.threats]) {
    if (!released(th) || cut.includes(th.id)) continue;
    const t = clamp(((th.x - x1) * vx + (th.y - y1) * vy) / l2, 0, 1);
    if (dist(th.x, th.y, x1 + vx * t, y1 + vy * t) > AB.cutter.width) continue;
    cut.push(th.id);
    damageThreat(g, th, AB.cutter.damage, true, 'cutter');
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
  const k = w.level - 1;
  const d = dist(th.x, th.y, p.x, p.y);
  const stepLen = Math.min(d, AB.grapnel.speed[k] * dt);
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
    if (!released(o) || o === th || dist(o.x, o.y, th.x, th.y) > AB.grapnel.smackR) continue;
    if (g.t - (p.smacked[o.id] ?? -9) < AB.grapnel.again) continue;
    p.smacked[o.id] = g.t;
    damageThreat(g, o, AB.grapnel.smack[k], true, 'grapnel');
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
  const level = g.weapon?.level ?? 1;
  const cap = AB.grapnel.speed[level - 1];
  const k = sp > cap ? cap / sp : 1;
  g.flings.push({ id: th.id, vx: p.vx * k, vy: p.vy * k, t: 0, level, ...(hyper(g) ? { twin: true } : {}) });
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
    // Test Lab round 8 (the player: "if it runs into another enemy [it]
    // explodes, unless it will still have some health"): the first threat
    // the ball runs into sets off its burst there and then. A ball with hit
    // points left after its own burst keeps them and flies on (and can run
    // into the next one); one that doesn't is gone in the blast.
    if (!f.hits) f.hits = [];
    const hits = f.hits;
    const into = g.threats.find((o) => released(o) && o !== th && !hits.includes(o.id) && dist(o.x, o.y, th.x, th.y) <= AB.grapnel.impactR);
    if (into) {
      hits.push(into.id);
      flingBurst(g, f, th.x, th.y);
      if (th.dead) {
        f.t = Infinity;
        continue;
      }
      cue(g, 'grapnel.smack', th.x, th.y);
    }
    if (f.t < AB.grapnel.fly) continue;
    th.held = false;
    // Flown its course without running into anything: it bursts where it is,
    // as before. One that already burst on a threat is just let go.
    if (!hits.length) flingBurst(g, f, th.x, th.y);
    f.t = Infinity;
  }
  g.flings = g.flings.filter((f) => f.t !== Infinity);
}

/** A flung Grapnel ball bursts at (bx, by): `burst` hits on everything in
 *  `burstR`, the ball included (Hyper Overdrive: a second burst beside it). */
function flingBurst(g: Game, f: Fling, bx: number, by: number): void {
  const k = f.level - 1;
  const r = AB.grapnel.burstR[k];
  addFx(g, f.level >= ABILITY_MAX ? 'thermo' : 'burst', bx, by, { life: 0.5, r });
  cue(g, 'grapnel.burst', bx, by);
  for (const o of [...g.threats]) if (released(o) && dist(o.x, o.y, bx, by) <= r) damageThreat(g, o, AB.grapnel.burst[k], true, 'grapnel');
  // Hyper Overdrive: a second burst beside the first.
  if (f.twin) {
    const sp = Math.hypot(f.vx, f.vy) || 1;
    const tx = bx - (f.vy / sp) * r * 0.6;
    const ty = by + (f.vx / sp) * r * 0.6;
    twinSide = AB.overdrive.twin;
    addFx(g, f.level >= ABILITY_MAX ? 'thermo' : 'burst', tx, ty, { life: 0.5, r });
    twinSide = 0;
    for (const o of [...g.threats]) if (released(o) && dist(o.x, o.y, tx, ty) <= r) damageThreat(g, o, AB.grapnel.burst[k], true, 'grapnel');
  }
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
  const c = muzzle(g, x, y);
  const len0 = dist(c.x, c.y, x, y) || 1;
  const ux = (x - c.x) / len0;
  const uy = (y - c.y) / len0;
  const len = entryDistance(c.x, c.y, ux, uy);
  // War Drum (Test Lab round 4, the player: "have the third upgrade be a
  // little bit more powerful. Maybe we could blow up the platforms and
  // vehicles"): on the beat it wrecks them on its line in one hit.
  if (w.level >= ABILITY_MAX) wreckLine(g, c.x, c.y, ux, uy, len, AB.cadence.width);
  rayHits(g, c.x, c.y, Math.atan2(uy, ux), len, AB.cadence.width, true, AB.cadence.damage, 'cadence');
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
    if (!released(th) || !wrecks.includes(th.kind) || !on(th.x, th.y, width)) continue;
    addFx(g, 'boom', th.x, th.y, { life: 0.9, r: 48 });
    damageThreat(g, th, th.hp, true, 'cadence');
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
    for (const t of targets) g.interceptors.push({ id: g.nextId++, x: c.x, y: c.y - 6, target: t.id, tx: t.x, ty: t.y, life: 0, src: 'gun', dmg: 2, by: 'broadside', tap: true });
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
  g.passiveTW -= dt;
  const timer = (w: Weapon) => passiveTimer(g, w);
  // ---- Drone Screen: a drone off the carrier deck every gap.
  // Test Lab round 5 (the player: "the drone shouldn't start firing unless
  // there's actually a threat on the screen"): with nothing on screen to
  // ram, the deck holds its drones, and the next lifts off the moment
  // something shows.
  const dw = held(g, 'droneScreen');
  if (dw && g[timer(dw)] <= 0) {
    if (screenThreat(g)) {
      g[timer(dw)] += AB.droneScreen.gap[dw.level - 1];
      g.wings.push({ id: g.nextId++, x: c.x, y: c.y - 8, heading: -Math.PI / 2, target: null, life: AB.droneScreen.life });
      cue(g, 'screen.launch', c.x, c.y);
    } else g[timer(dw)] = 0;
  }
  for (const d of g.wings) {
    d.life -= dt;
    // Test Lab round 8 (the player: "the drone kind of drives away
    // awkwardly once all the targets have been destroyed"): a drone with
    // nothing left to ram, or out of time, flies home and lands on the deck
    // (homeDrone); it used to drift up off the top of the screen.
    if (d.life <= 0) {
      d.target = null;
      if (homeDrone(g, d, dt)) d.landed = true;
      continue;
    }
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
      th = lureIn(g, d.x, d.y) ?? g.threats.filter((t) => released(t) && !isStructure(t.kind) && t.x > 0 && t.x < VIEW.width && t.y > 0 && t.y < VIEW.height && !claimed.has(t.id)).sort((a, b) => timeToImpact(g, a) - timeToImpact(g, b))[0];
      d.target = th ? th.id : null;
    }
    if (!th) {
      // Threats up but each one already has a drone on it: it waits over
      // the deck for one to come free. Nothing left: home.
      if (screenThreat(g)) homeDrone(g, d, dt, AB.droneScreen.wait);
      else if (homeDrone(g, d, dt)) d.landed = true;
      continue;
    }
    const dd = dist(d.x, d.y, th.x, th.y);
    if (dd <= AB.droneScreen.contact) {
      const bx = th.x;
      const by = th.y;
      damageThreat(g, th, AB.droneScreen.damage, true, 'droneScreen');
      const r = AB.droneScreen.burst[(dw?.level ?? 1) - 1];
      if (r > 0) for (const o of [...g.threats]) if (released(o) && dist(o.x, o.y, bx, by) <= r) damageThreat(g, o, 1, true, 'droneScreen');
      addFx(g, 'burst', bx, by, { life: 0.3, r: Math.max(18, r) });
      // Spent in the ram.
      d.landed = true;
      continue;
    }
    d.heading = Math.atan2(th.y - d.y, th.x - d.x);
    const stepLen = Math.min(dd, AB.droneScreen.speed * dt);
    d.x += Math.cos(d.heading) * stepLen;
    d.y += Math.sin(d.heading) * stepLen;
  }
  g.wings = g.wings.filter((d) => !d.landed);
  // ---- Gunship Pair: hover over the convoy, rocket the thickest cluster.
  const gw = held(g, 'gunships');
  if (!gw) for (const h of g.helis) h.leaving = true;
  const mid = g.ships.length ? { x: g.ships.reduce((a, s) => a + s.x, 0) / g.ships.length, y: g.ships.reduce((a, s) => a + s.y, 0) / g.ships.length } : { x: c.x, y: c.y - 120 };
  // Round 12 (the player: "the level three helicopters ... overlap each
  // other"): the row of hovers is kept whole on the screen. Each was
  // clamped to the edge on its own, so with the convoy coming in at the
  // screen's edge two (or all three) hovered on the same spot. Now the row
  // slides in from the edge instead, each in its place in the row (its
  // rank among those staying, so a gap left by one leaving closes).
  const row = g.helis.filter((o) => !o.leaving).sort((a, b) => a.slot - b.slot || a.id - b.id);
  const n = row.length;
  const pitch = AB.gunships.spread * 1.8;
  const half = ((n - 1) / 2) * pitch;
  const cx = clamp(mid.x, 60 + half, VIEW.width - 60 - half);
  for (const h of g.helis) {
    const want = h.leaving
      ? { x: h.x < VIEW.width / 2 ? -200 : VIEW.width + 200, y: h.y }
      : { x: cx + (row.indexOf(h) - (n - 1) / 2) * pitch, y: clamp(mid.y - AB.gunships.above, 60, VIEW.height - 60) };
    flyHeli(g, h, want, dt);
    if (h.leaving) continue;
    h.fireT -= dt;
    if (h.fireT > 0) continue;
    const gap = AB.gunships.gap[(gw?.level ?? 1) - 1];
    const near = g.threats.filter((t) => released(t) && !isStructure(t.kind) && dist(t.x, t.y, h.x, h.y) <= AB.gunships.reach);
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
    if (!pick) {
      h.fireT += gap;
      h.aim = -1;
      continue;
    }
    // Test Lab round 5 ("it should face the target when firing"): it turns
    // its nose onto the target first (flyHeli), and fires once it faces it.
    h.aim = pick.id;
    if (Math.abs(angleDiff(Math.atan2(pick.y - h.y, pick.x - h.x), h.heading)) > AB.gunships.aim && h.aimT < AB.gunships.wait) {
      h.aimT += dt;
      continue;
    }
    h.aimT = 0;
    h.fireT = Math.max(0.2, h.fireT + gap);
    launchHellfire(g, h.x, h.y, h.heading, pick, AB.gunships.damage[(gw?.level ?? 1) - 1]);
  }
  g.helis = g.helis.filter((h) => !h.leaving || (h.x > -150 && h.x < VIEW.width + 150));
  updateHellfires(g, dt);
  // ---- Bomber Wing: a pass every gap.
  const bw = held(g, 'bomberWing');
  if (bw && g[timer(bw)] <= 0) {
    const k = bw.level - 1;
    g[timer(bw)] += AB.bomberWing.gap[k];
    callSorties(g, AB.bomberWing.targets[k], AB.bomberWing.quiet[k]);
  }
  updateSorties(g, dt);
  // ---- Orbital Strike: lock on (laser dots), then the beam.
  if (g.orbital) {
    g.orbital.t += dt;
    const th = g.threats.find((t) => t.id === g.orbital!.id && !t.dead);
    if (!th) g.orbital = null;
    else if (g.orbital.t >= AB.orbital.lock) {
      const bx = th.x;
      const by = th.y;
      damageThreat(g, th, AB.orbital.damage, true, 'orbital');
      for (const o of [...g.threats]) if (released(o) && o !== th && dist(o.x, o.y, bx, by) <= AB.orbital.splash) damageThreat(g, o, 1, true, 'orbital');
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

/** A Drone Screen drone with nothing to ram flies back to the carrier deck
 *  (AB.droneScreen.home of its speed, its nose turning at most `turn`
 *  rad/s, so it banks round rather than snapping about) and lands. True
 *  once it is down. */
function homeDrone(g: Game, d: Wing, dt: number, above = 0): boolean {
  const c = g.map.carrier;
  const hx = c.x;
  const hy = c.y - 8 - above;
  const dd = dist(d.x, d.y, hx, hy);
  const speed = AB.droneScreen.speed * AB.droneScreen.home;
  if (dd <= Math.max(6, speed * dt)) {
    // Waiting over the deck: it circles there.
    if (above > 0) {
      d.heading += AB.droneScreen.turn * 0.5 * dt;
      d.x = hx + Math.cos(d.heading - Math.PI / 2) * 4;
      d.y = hy + Math.sin(d.heading - Math.PI / 2) * 4;
      return false;
    }
    return true;
  }
  const want = Math.atan2(hy - d.y, hx - d.x);
  const turn = AB.droneScreen.turn * dt;
  d.heading += clamp(angleDiff(want, d.heading), -turn, turn);
  // Close in, it comes straight in.
  if (dd < 60) d.heading = want;
  // Banking round near an edge, it stays on the screen.
  d.x = clamp(d.x + Math.cos(d.heading) * speed * dt, 8, VIEW.width - 8);
  d.y = clamp(d.y + Math.sin(d.heading) * speed * dt, 8, VIEW.height - 8);
  return false;
}

/** Is there a threat on the screen your drones could ram? */
export function screenThreat(g: Game): boolean {
  return g.threats.some((t) => released(t) && !isStructure(t.kind) && t.x > 0 && t.x < VIEW.width && t.y > 0 && t.y < VIEW.height);
}

/** The toughest threat on screen (most hit points). Something that will hit
 *  a ship comes first; a structure (a rig, a generator, the Dreadnought) only
 *  when nothing else is up: its 10–40 hit points soaked every strike (build 2
 *  sweep). */
function toughest(g: Game, not: number): Threat | undefined {
  const lure = lureIn(g, 0, 0);
  if (lure && lure.id !== not) return lure;
  const up = g.threats.filter((t) => released(t) && t.id !== not && t.x > 0 && t.x < VIEW.width && t.y > 0 && t.y < VIEW.height && !(t.kind === 'citadel' && shieldUp(g)) && !domed(g, t));
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
  // Turning to fire: the nose goes onto the target, moving or not.
  const aim = h.aim >= 0 && !h.leaving ? g.threats.find((t) => t.id === h.aim && !t.dead) : undefined;
  if (aim) face = Math.atan2(aim.y - h.y, aim.x - h.x);
  else if (speed > G.speed * 0.25) face = travel;
  else {
    const th = g.threats.filter((t) => released(t) && !isStructure(t.kind)).sort((a, b) => dist(a.x, a.y, h.x, h.y) - dist(b.x, b.y, h.x, h.y))[0];
    face = th && dist(th.x, th.y, h.x, h.y) <= G.reach * 1.5 ? Math.atan2(th.y - h.y, th.x - h.x) : -Math.PI / 2;
  }
  const turn = angleDiff(face, h.heading);
  // Turning to fire it pedal-turns quicker (AB.gunships.aimTurn).
  const rate = aim ? G.aimTurn : G.turn;
  h.heading += clamp(turn, -rate * dt, rate * dt);
  // Thrust follows the nose: a helicopter facing away barely moves off.
  // (Turning to fire, it sideslips: a helicopter can fly sideways, so it
  // keeps up with the convoy while its nose is on the target.)
  const align = speed > 0 && !aim ? Math.max(0.15, Math.cos(angleDiff(travel, h.heading))) : 1;
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
    for (const o of [...g.threats]) if (released(o) && dist(o.x, o.y, m.tx, m.ty) <= H.blast) damageThreat(g, o, m.dmg, true, 'gunship');
  }
  g.hellfires = g.hellfires.filter((m) => m.t !== Infinity);
}

function callGunships(g: Game, level: number): void {
  const want = AB.gunships.count[level - 1];
  // Test Lab round 5 (the player: "if they are leaving the screen ... they
  // come back normally if you select another gunship instead of the
  // existing ones disappearing"): a pair on its way out turns round and
  // comes back to its hover; only the ones still missing fly in.
  const staying = g.helis.filter((h) => !h.leaving).length;
  g.helis.sort((a, b) => Number(a.leaving) - Number(b.leaving));
  g.helis.forEach((h, i) => (h.leaving = i >= want));
  if (staying < want) cue(g, 'heli.arrive', 0, VIEW.height / 2);
  for (let i = g.helis.length; i < want; i++) {
    const left = i % 2 === 0;
    g.helis.push({ id: g.nextId++, x: left ? -120 : VIEW.width + 120, y: VIEW.height * 0.55, vx: left ? AB.gunships.speed : -AB.gunships.speed, vy: 0, slot: i, fireT: 0.6 + i * 0.35, heading: left ? 0 : Math.PI, lean: 0, roll: 0, leaving: false, aim: -1, aimT: 0 });
  }
  g.helis.forEach((h, i) => (h.slot = i));
}

/** Is this on the screen (a margin in from its edges)? */
function onScreen(x: number, y: number, m = 0): boolean {
  return x >= m && x <= VIEW.width - m && y >= m && y <= VIEW.height - m;
}

/** A launch truck or sub Bomber Wing can bomb: a truck up on its road, a
 *  sub surfaced or at periscope depth (not diving). */
function bombableRaider(r: Raider): boolean {
  return r.kind === 'sub' ? r.state === 'warn' || r.state === 'surface' || r.state === 'fire' : raiderUp(r);
}

/** Bomber Wing picks its targets (Test Lab round 5: aircraft and subs too,
 *  at every level): aircraft, subs (a torpedo sub up or its periscope, a
 *  launch sub surfaced or at periscope depth) and trucks on screen first,
 *  then the silos or tunnels with the most launches coming in the next
 *  `quiet` seconds. Nothing another bomber is already after. */
function callSorties(g: Game, n: number, quiet: number): void {
  type Pick = { kind: Sortie['kind']; ref: number; x: number; y: number; score: number; spawn?: RaiderSpawn; from?: number };
  const picks: Pick[] = [];
  const taken = (kind: Sortie['kind'], ref: number) => g.sorties.some((b) => !b.hit && b.kind === kind && b.ref === ref);
  const air: readonly ThreatKind[] = AB.bomberWing.air;
  for (const th of g.threats) {
    if (!released(th) || !onScreen(th.x, th.y)) continue;
    // (A Torpedo Sub is never a target: log v34.)
    const kind = air.includes(th.kind) ? 'air' : null;
    if (!kind || taken(kind, th.id)) continue;
    picks.push({ kind, ref: th.id, x: th.x, y: th.y, score: 110 + th.hp, from: sortieRun(th.x, th.vx).dir });
  }
  for (const r of g.raiders) {
    if (!bombableRaider(r) || !onScreen(r.x, r.y) || taken('truck', r.id)) continue;
    picks.push({ kind: 'truck', ref: r.id, x: r.x, y: r.y, score: 100 + r.rounds.length + r.units.length });
  }
  // A silo or tunnel: what is due from when the bomber gets there.
  g.map.bases.forEach((b, i) => {
    if (g.baseDown[i] || (g.quietUntil[i] ?? 0) > g.t || taken('silo', i)) return;
    const x = clamp(b.x, 30, VIEW.width - 30);
    const from = g.waveT + sortieRun(x).eta;
    const due = g.queue.filter((l) => l.base === i && l.at >= from && l.at <= from + quiet && l.kind !== 'strafer' && l.kind !== 'bomber').length;
    if (due > 0) picks.push({ kind: 'silo', ref: i, x, y: clamp(b.y, 30, VIEW.height - 30), score: due });
  });
  g.raiderQueue.forEach((sp, i) => {
    const p = sp.path[0];
    const x = clamp(p.x, 30, VIEW.width - 30);
    const from = g.waveT + sortieRun(x).eta;
    if (sp.kind === 'sub' || sp.at < g.waveT || sp.at > from + quiet || g.sorties.some((b) => !b.hit && b.spawn === sp)) return;
    picks.push({ kind: 'tunnel', ref: i, spawn: sp, x, y: clamp(p.y, 30, VIEW.height - 30), score: sp.units.reduce((a, u) => a + u.size, 0) });
  });
  // A Lure Beacon that's up draws the first pass, ahead of everything.
  const lure = lureIn(g, VIEW.width / 2, VIEW.height / 2);
  if (lure && !taken('lure', lure.id)) picks.push({ kind: 'lure', ref: lure.id, x: lure.x, y: lure.y, score: Infinity });
  picks.sort((a, b) => b.score - a.score);
  for (const p of picks.slice(0, n)) {
    // In from a side far enough off (or behind a plane) that it is on screen
    // for a while before the bomb drops: you see what is attacking.
    const dir = p.from ?? sortieRun(p.x).dir;
    g.sorties.push({
      id: g.nextId++, x: dir > 0 ? -SORTIE_OFF : VIEW.width + SORTIE_OFF, y: p.y, vx: dir * AB.bomberWing.speed, tx: p.x, ty: p.y, hit: false,
      kind: p.kind, ref: p.ref, ...(p.spawn ? { spawn: p.spawn } : {}), seen: 0, cued: false, quiet,
    });
  }
}

/** Bomber Wing: the side a bomber comes in from to bomb at x (a target
 *  moving at vx across the screen), and how long until it is over it. It
 *  prefers the nearer edge (or, for a plane, coming in behind it), if that
 *  still gives it AB.bomberWing.seen s on screen first; else the other side,
 *  or whichever gives it longer. */
function sortieRun(x: number, vx = 0): { dir: number; eta: number } {
  const B = AB.bomberWing;
  const first = Math.abs(vx) > 40 ? Math.sign(vx) : x < VIEW.width / 2 ? 1 : -1;
  const side = (dir: number) => {
    const from = dir > 0 ? -SORTIE_OFF : VIEW.width + SORTIE_OFF;
    const closing = B.speed - vx * dir;
    const eta = closing > 50 ? ((x - from) * dir) / closing : Infinity;
    return { dir, eta, seen: eta - SORTIE_OFF / B.speed };
  };
  const a = side(first);
  const b = side(-first);
  const pick = a.seen >= B.seen && a.eta < Infinity ? a : b.seen >= B.seen && b.eta < Infinity ? b : a.eta < Infinity && (a.seen >= b.seen || b.eta === Infinity) ? a : b;
  return { dir: pick.dir, eta: pick.eta };
}

/** How far off the screen's edge a bomber starts its run (px). */
const SORTIE_OFF = 160;

/** Bomber Wing's bombers in flight: each follows its target, its run sound
 *  starts so the roar comes as it passes over, and the bomb lands as it
 *  crosses the target, never before it has been on screen AB.bomberWing.seen
 *  s (Test Lab round 5: "it should at least be on the screen before the
 *  bomber hits them so you can actually see what is attacking"). */
function updateSorties(g: Game, dt: number): void {
  const B = AB.bomberWing;
  for (const b of g.sorties) {
    // A moving target (a plane, a sub): the bomber's line follows it.
    const th = b.kind === 'air' || b.kind === 'sub' ? g.threats.find((t) => t.id === b.ref && !t.dead) : undefined;
    if (!b.hit && th) {
      b.tx = th.x;
      b.ty = th.y;
      // A plane that flies off the screen first is let go (no bombs out of
      // sight): the bomber flies on.
      if (!onScreen(th.x, th.y)) b.hit = true;
    }
    if (!b.hit) b.y += clamp(b.ty - b.y, -B.track * dt, B.track * dt);
    b.x += b.vx * dt;
    if (onScreen(b.x, b.y, -30)) b.seen += dt;
    if (b.hit) continue;
    const dir = Math.sign(b.vx);
    const ahead = (b.tx - b.x) * dir;
    // The run sound, so its roar is the drop.
    const closing = Math.max(1, Math.abs(b.vx) - (th ? th.vx * dir : 0));
    if (!b.cued && ahead / closing <= B.roar) {
      b.cued = true;
      cue(g, 'sortie.pass', b.x, b.y, { vx: b.vx });
    }
    if (ahead > 0) continue;
    b.hit = true;
    // Over it too soon to have been seen (a target that turned on it): the
    // pass is let go, no bomb out of nowhere.
    if (b.seen < B.seen / 2) continue;
    if (!b.cued) cue(g, 'sortie.pass', b.x, b.y, { vx: b.vx });
    b.cued = true;
    bombTarget(g, b);
  }
  g.sorties = g.sorties.filter((b) => (b.vx > 0 ? b.x < VIEW.width + 300 : b.x > -300));
}

/** A bomber over its target: the bomb lands, and only now does what it
 *  hits go (Test Lab round 5: a silo used to fall silent as the bomber was
 *  called, before it had even come on screen). */
function bombTarget(g: Game, b: Sortie): void {
  addFx(g, 'boom', b.tx, b.ty, { life: 0.9, r: 48 });
  cue(g, 'sortie.bomb', b.tx, b.ty);
  if (b.kind === 'truck') {
    const r = g.raiders.find((o) => o.id === b.ref);
    if (r && bombableRaider(r)) knockOut(g, r);
  } else if (b.kind === 'lure') {
    const t = g.threats.find((o) => o.id === b.ref && !o.dead);
    if (t) damageThreat(g, t, 1, true, 'bomberWing');
  } else if (b.kind === 'air' || b.kind === 'sub') {
    if (b.ref < 0) {
      // A periscope: the sub never comes up.
      const id = -b.ref;
      const m = g.foe.marks.find((o) => o.id === id && o.kind === 'periscope');
      if (m) {
        g.foe.marks = g.foe.marks.filter((o) => o !== m);
        addFx(g, 'sink', m.x, m.y, { life: 2, r: 40 });
        g.events.push({ kind: 'bigKill', label: 'SUB DESTROYED', x: m.x, y: m.y });
        cue(g, 'sub.destroyed', m.x, m.y);
      }
      return;
    }
    const t = g.threats.find((o) => o.id === b.ref && !o.dead);
    if (t) damageThreat(g, t, t.hp + 99, true, 'bomberWing');
  } else if (b.kind === 'silo') {
    g.quietUntil[b.ref] = Math.max(g.quietUntil[b.ref] ?? 0, g.t + b.quiet);
    addFx(g, 'text', b.tx, b.ty - 34, { life: 1.4, text: 'SILO SILENCED' });
  } else {
    // A tunnel: the truck due out of it is cancelled; one already out on
    // its road by the tunnel is knocked out.
    if (b.spawn && g.raiderQueue.includes(b.spawn)) g.raiderQueue = g.raiderQueue.filter((sp) => sp !== b.spawn);
    else for (const r of g.raiders) if (raiderUp(r) && dist(r.x, r.y, b.tx, b.ty) <= 90) knockOut(g, r);
    addFx(g, 'text', b.tx, b.ty - 34, { life: 1.4, text: 'TUNNEL HIT' });
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
  if (g.wildPassive?.id === id) return g.wildPassive;
  return null;
}

/** Which clock a working passive fires on: the first hand's, the second's
 *  (Dual Wield) or Wild Card's passive's. */
function passiveTimer(g: Game, w: Weapon): 'passiveT' | 'passiveT2' | 'passiveTW' {
  return w === g.weapon2 ? 'passiveT2' : w === g.wildPassive ? 'passiveTW' : 'passiveT';
}

/** A passive starts working (its pickup, or Wild Card's roll): the first
 *  drone, bomber or beam is due soon; the helicopters and frigates come in;
 *  Point Defense rearms every hull. */
function startPassive(g: Game, w: Weapon): void {
  const timer = passiveTimer(g, w);
  const id = w.id;
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
}

/** Threats' share of speed under the Time Warp power-up (the Time Warp
 *  weapon was cut in Test Lab round 5, and the power-up no longer drops:
 *  PICKUPS.weights). */
export function warpScale(g: Game): number {
  return g.warpT > 0 ? PICKUPS.warpScale : 1;
}

/** Is time warped (the world drains of colour, the sound drops)? */
export function warping(g: Game): boolean {
  return g.warpT > 0;
}

function startBoost(g: Game, id: AbilityId, level: number, x: number, y: number): void {
  const k = level - 1;
  // Dual Wield and (Test Lab round 8) Overdrive last longer from level 2.
  // Boilers 5 (Armory): Full Steam lasts twice as long.
  const t = g.stats.weaponTime * (id === 'dualWield' ? AB.dualWield.time[k] : id === 'overdrive' ? AB.overdrive.time[k] : id === 'fullSteam' ? g.stats.steamTime : 1);
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
  g.boost = { id, level, t: id === 'shield' ? t * AB.shield.time[k] : t, n: 0, bank: 0, crateT: AB.supplyRun.crate, age: 0 };
  // The Shield breaks after AB.shield.hits[k] hits (log v34).
  if (id === 'shield') g.boost.hits = AB.shield.hits[k];
  switch (id) {
    case 'focus':
      g.boost.bank = AB.focus.bank[k];
      break;
    case 'supplyRun':
      // Ammo, a repair and your gear, in turn (Test Lab round 5: "it can be
      // weapons or the nuke too").
      callCargoPlane(g, AB.supplyRun.load.slice(0, AB.supplyRun.crates[k]).map((c) => (c === 'gear' ? gearCrate(g, false) : { kind: c })));
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
  // Focus ends: its button goes, and nothing stays held (Test Lab round 8:
  // "the slow motion was still going even though I was not touching").
  if (b.id === 'focus') {
    g.finger = false;
    g.focusing = false;
  }
  const c = g.map.carrier;
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
  if (ranOut) {
    cue(g, 'boost.off', c.x, c.y);
    addFx(g, 'text', c.x, c.y - CARRIER.halfBeam - 64, { life: 1.2, text: `${abilityName(b.id, b.level).toUpperCase()} DONE` });
  }
}

/** Where a weapon pickup goes. Either hand already holding it gets a fresh
 *  clock (under Dual Wield the clock is still the boost's); under Dual Wield it joins the first (both hands full: the one
 *  loaded longer ago goes, so you hold the two newest; Test Lab round 4: it
 *  was always the first hand, both showing the boost's time). Returns false
 *  when it simply takes the first hand: the second keeps the rest of its
 *  time (round 2: "both stay loaded together for the rest of their time"). */
function boostLoad(g: Game, w: Weapon): boolean {
  for (const hand of ['weapon', 'weapon2'] as const) {
    const old = g[hand];
    if (old?.id !== w.id) continue;
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
export function callCargoPlane(g: Game, load: { kind: PickupKind; weapon?: AbilityId }[]): void {
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
      addPickup(g, d.kind, d.x, pl.y, d.weapon, 'plane');
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
    if (b.crateT <= 0) {
      b.crateT += AB.supplyRun.crate;
      callCargoPlane(g, [gearCrate(g, true)]);
    }
  }
  if (b.t <= 0) endBoost(g, true);
}

/** The weapons held (the slots that aren't boosts). */
function weaponsHeld(g: Game): AbilityId[] {
  return g.slots.filter((id) => !isBoost(id) && (g.levels[id] ?? 0) > 0);
}

/** Supply Run's gear crate: one of your weapons or boosts (never Supply Run
 *  itself), or (`nuke`: Airdrop's planes) now and then a Nuke. With nothing
 *  else held, ammo. */
function gearCrate(g: Game, nuke: boolean): { kind: PickupKind; weapon?: AbilityId } {
  // No Nuke in a special event (Test Lab round 6).
  if (nuke && !g.event && g.rng.drops.chance(AB.supplyRun.nuke)) return { kind: 'nuke' };
  const gear = g.slots.filter((id) => id !== 'supplyRun' && (g.levels[id] ?? 0) > 0);
  return gear.length ? { kind: 'weapon', weapon: g.rng.drops.pick(gear) } : { kind: 'ammo' };
}

/** Is the running boost waiting on a weapon pickup (Dual Wield with a hand
 *  free)? */
function callsWeapon(g: Game): boolean {
  const b = g.boost;
  if (!b) return false;
  if (b.id === 'dualWield') return !g.weapon || !g.weapon2;
  return false;
}

/** Drops come this many times as often (Supply Run, Dual Wield's Arsenal
 *  Drop). */
function dropMult(g: Game, weapon: boolean): number {
  const b = g.boost;
  if (!b) return 1;
  const k = b.level - 1;
  if (b.id === 'supplyRun') return AB.supplyRun.mult[k];
  if (!weapon) return 1;
  if (b.id === 'dualWield') return AB.dualWield.drops[k];
  return 1;
}

/** Wild Card: weapons a single tap can fire (no gestures, no two-tap ones). */
const WILD_ACTIVES: AbilityId[] = ['airstrike', 'shrapnel', 'thermo', 'scatter', 'boomerang', 'flak', 'seeker', 'well', 'railgun', 'tesla'];
/** Wild Card's passives: one comes with each pickup from level 2 (Test Lab
 *  round 8), every passive in the roster. */
export const WILD_PASSIVES: AbilityId[] = ['frigate', 'aegis', 'droneScreen', 'gunships', 'bomberWing', 'orbital'];

/** Wild Card's pickup at level 2 up: one random passive (not one already
 *  loaded in a hand) works beside the gun for the weapon time, at the Wild
 *  Card's level (AB.wildCard.passive). A second pickup rolls again: the new
 *  one replaces the old (the same one again: a fresh clock). */
function wildPassive(g: Game, level: number, x: number, y: number): void {
  const pool = WILD_PASSIVES.filter((id) => g.weapon?.id !== id && g.weapon2?.id !== id);
  const id = g.rng.drops.pick(pool);
  const lv = AB.wildCard.passive[level - 1];
  const w: Weapon = { id, level: lv, t: g.stats.weaponTime * AB.wildCard.time, t0: g.t };
  g.wildPassive = w;
  startPassive(g, w);
  g.events.push({ kind: 'wild', id, level: lv });
  cue(g, 'wild.roll', x, y);
  addFx(g, 'text', x, y - 44, { life: 1.4, text: `+ ${abilityName(id, lv).toUpperCase()}` });
}

/** Wild Card loaded: this tap is a random active weapon's shot, at the Wild
 *  Card's level (Test Lab round 8: the passives come with the pickup now,
 *  not on a tap). */
function wildTap(g: Game, wild: Weapon, x: number, y: number, threat: Threat | null, radius: number): TapResult {
  const lv = wild.level;
  const id = g.rng.drops.pick(WILD_ACTIVES);
  const level = lv;
  const w: Weapon = { id, level, t: 0, t0: g.t };
  addFx(g, 'text', x, y - 34, { life: 0.8, text: abilityName(id, level).toUpperCase() });
  cue(g, 'wild.roll', x, y);
  const r = fireWeapon(g, w, x, y, threat, radius);
  if (r) return r;
  if (!threat) return 'empty';
  return fireAt(g, threat, [w]) ? 'fire' : 'dry';
}

/** Is this hull's damage blocked (the Shield power-up, or the boost, which
 *  never blocks a strafing run: Test Lab round 5 dropped that)? */
function shielded(g: Game, by: ThreatKind): boolean {
  if (g.shieldT > 0) return true;
  return boostLevel(g, 'shield') > 0 && !isJet(by);
}

/** The Shield blocked a hit: from level 2 the boost puts a round back. The
 *  boost (not the power-up) breaks after AB.shield.hits hits (the
 *  2026-11-20 playtest: "the shield should break after x amount of hits not
 *  damage but actual hits", log v34): every missile, drone, shell or boat it
 *  stops is one hit, whatever its damage; one blast that reaches several
 *  hulls in the same step is one hit. */
function blockRefund(g: Game, by: ThreatKind): void {
  if (g.shieldT > 0) return;
  const lv = boostLevel(g, 'shield');
  if (lv <= 0) return;
  const b = g.boost!;
  const key = `${g.steps}:${by}`;
  if (b.hitAt === key) return;
  b.hitAt = key;
  g.ammo = Math.min(g.stats.rack, g.ammo + AB.shield.refund[lv - 1]);
  b.hits = (b.hits ?? AB.shield.hits[lv - 1]) - 1;
  if (b.hits > 0) return;
  const c = g.map.carrier;
  addFx(g, 'burst', c.x, c.y, { life: 0.5, r: 90 });
  addFx(g, 'text', c.x, c.y - 40, { life: 1.2, text: 'SHIELD BROKEN' });
  endBoost(g, true);
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
  for (const o of [...g.threats]) if (released(o) && o !== th && dist(o.x, o.y, bx, by) <= AB.shield.burst) damageThreat(g, o, 1, true, 'reflect');
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
    damageThreat(g, th, th.hp + 99, true, 'ram');
  }
}

// ---------------------------------------------------------------------------
// The step

export function step(g: Game, dt: number): void {
  if (g.phase !== 'wave') return;
  // Telemetry (off unless a run asked for it) looks before and after; it
  // changes nothing in between.
  if (!g.tel) {
    stepSim(g, dt);
    return;
  }
  g.tel.before(g);
  stepSim(g, dt);
  g.tel.after(g);
}

function stepSim(g: Game, dt: number): void {
  // Focus: while a finger is down and the bank lasts, the whole game runs
  // slow (the bank drains in real time).
  const real = dt;
  g.realT += real;
  g.focusing = focusOn(g);
  if (g.focusing) dt *= AB.focus.scale[g.boost!.level - 1];
  g.cues.length = 0;
  g.steps += 1;
  g.t += dt;
  g.waveT += dt;

  if (g.convoy) updateConvoy(g, dt);
  spawnShips(g, dt);
  // An aircraft's line is fixed when its warning arrow appears.
  for (const l of g.queue) {
    if (l.at - g.waveT > PLANE.warn) break;
    if ((l.kind === 'strafer' || l.kind === 'bomber') && l.y === undefined) {
      const r = (l.aim === 'vip' && vipRoute(g)) || planeRoute(g, l.kind, g.rng.threats);
      l.y = r.y;
      if (r.lane !== undefined) {
        l.lane = r.lane;
        l.lat = r.lat;
      }
      const at = l.lane !== undefined ? planeEntry(g, l) : { x: (l.side ?? 1) > 0 ? 0 : VIEW.width, y: l.y };
      if (g.tel) g.tel.warnAircraft(g, l.kind, at.x, at.y, l.at - g.waveT);
      cue(g, 'aircraft.warn', at.x, at.y);
    }
  }
  updateEvent(g);
  while (g.queue.length && g.queue[0].at <= g.waveT) launch(g, g.queue.shift()!);
  updateLabSets(g);
  updateEncCalls(g);
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
  // Your own weapons' work over time (the Air Strike's jets, the
  // Boomerang's blades, a held finger's Lance or Cutter, the Grapnel's
  // throws, the clouds, wells and burning lines your shots leave) is the
  // player's own hand: it hurts a Lure Beacon (round 11's audit: "make sure
  // all weapons will actually attack the beacon"). The helpers' shots
  // (frigates, Point Defense, drones, gunships...) still pass through it.
  g.foe.byTap = true;
  updateAllies(g, dt);
  g.foe.byTap = false;
  updateEscorts(g, dt);
  updateAegis(g, dt);
  updateBombs(g, dt);
  updatePointDefense(g, dt);
  updateDamageControl(g, dt);
  g.foe.byTap = true;
  updateBlades(g, dt);
  updatePress(g, dt);
  updateFlings(g, dt);
  g.foe.byTap = false;
  updateBeat(g);
  updatePassives(g, dt);
  g.foe.byTap = true;
  updateFields(g, dt);
  g.foe.byTap = false;
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

  if (shipsSunk(g) >= lossLimit(g) || g.carrierHp <= 0) {
    g.phase = 'lost';
    if (g.event) endEvent(g, true);
    recordWave(g, 'lost');
    return;
  }
  if (g.queue.length === 0 && g.threats.every(standing) && g.raiders.length === 0 && g.raiderQueue.length === 0 && !foesBusy(g) && !labBusy(g) && !(g.enc?.sets.length) && !eventBusy(g)) {
    // A bonus wave is not one of the map's: no wave score (its event bonus
    // is its reward) and no wave record, and the draft the wave before it
    // earned comes now.
    const bonus = !!g.event?.bonus;
    if (!bonus) g.score += 200 * g.wave;
    // The lab's Hold ends with the wave, told of while the wave (or the
    // event's run) is still the telemetry's phase.
    if (g.convoy) convoyWaveEnd(g);
    // A special event is graded as its wave ends (its bonus is in the
    // wave's score).
    if (g.event) endEvent(g, false);
    clearField(g);
    if (!bonus) {
      recordWave(g, 'cleared');
      mendHulls(g);
    }
    const due = bonus ? null : bonusDue(g);
    if (!bonus && !g.endless && g.wave >= lastWave(g)) {
      g.cleared = true;
      g.phase = 'won';
    } else if (due) startBonus(g, due);
    else if (nextRunDue(g)) startWave(g);
    else {
      g.draftsLeft = g.endless ? 1 : nextPlayedWave(g.wave, g.tempo.stride, lastWave(g)) - g.wave;
      openDraft(g);
    }
  }
}

/** Ships sunk that count against the run's limit (all of them, unless the
 *  convoy was restored before the ending: then those since). */
export function shipsSunk(g: Game): number {
  return g.lost - g.lossBase;
}

/** The ships a run can lose before it ends: the tempo's limit, and the
 *  extra lives Lifeboats has given (Armory). */
export function lossLimit(g: Game): number {
  return g.tempo.lossLimit + g.extraLives;
}

/** Lifeboats (Armory, Hull bay): as a wave is cleared, the carrier (level
 *  1+) and every ship afloat (level 2+) mend a share of their missing hull,
 *  rounded to whole points (66%; level 4+: all of it). */
export function mendHulls(g: Game): void {
  const { mendCarrier, mendShips } = g.stats;
  if (!mendCarrier && !mendShips) return;
  let mended = false;
  if (mendShips)
    for (const s of g.ships) {
      const max = s.vip ? VIP.hp : g.stats.shipHp;
      const add = Math.min(max - s.hp, Math.round((max - s.hp) * mendShips));
      if (s.hp <= 0 || add <= 0) continue;
      s.hp += add;
      mended = true;
      if (g.tel) g.tel.heal(g, 's', s.id, add, s.hp, 'lifeboats');
      addFx(g, 'text', s.x, s.y - 24, { life: 1.2, text: `+${add}` });
    }
  const add = Math.min(g.stats.carrierHp - g.carrierHp, Math.round((g.stats.carrierHp - g.carrierHp) * mendCarrier));
  if (g.carrierHp > 0 && add > 0) {
    g.carrierHp += add;
    mended = true;
    if (g.tel) g.tel.heal(g, 'c', 0, add, g.carrierHp, 'lifeboats');
    const c = g.map.carrier;
    addFx(g, 'text', c.x, c.y - CARRIER.halfBeam - 24, { life: 1.4, text: `+${add} HULL` });
  }
  if (mended) cue(g, 'repair', g.map.carrier.x, g.map.carrier.y);
}

/** V2 round 13 ("the next wave starts fresh"): a cleared wave takes
 *  everything in flight with it. Interceptors and seekers still in the
 *  air, pickups left on the water, flak clouds, gravity wells and burning
 *  rows, strike jets, running power-ups and the loaded weapon are gone, and
 *  the rack is full for the next wave. Explosions already on screen play
 *  out. */
function clearField(g: Game): void {
  if (g.convoy) convoyWaveEnd(g);
  g.interceptors = [];
  if (g.tel) for (const p of g.pickups) g.tel.pickupOut(g, p, 'cleared');
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
  g.wildPassive = null;
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
    ...(g.extraLives ? { lives: g.extraLives } : {}),
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
 *  to the lane's width where it is (and, round 11, opened out in the wide
 *  water of a lane that asks for it: Harbor Mouth's pairs). Where the lane
 *  ahead narrows below LANE_FLOOR (a single-file gap), every hull lines up
 *  on the centre line, one behind another; the supertanker always sails
 *  the middle. */
function slotLat(g: Game, s: Ship): number {
  if (s.vip) return 0;
  const ch = g.map.channels[s.channel];
  if (ch.widths && Math.min(laneHalfWidth(ch, s.d), laneHalfWidth(ch, s.d + MERGE_AHEAD)) < LANE_FLOOR) return 0;
  const f = formationNow(g);
  return slotOffset(ch, f.offsets[s.slot % f.offsets.length], halfWidthAt(ch, s.x), !!f.opens);
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
    const ship = newShip(g, channel, slot, -g.rng.ships.range(0, 12));
    g.ships.push(ship);
    if (g.tel) g.tel.shipIn(g, ship);
  }
  groupSailed(g);
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
  if (g.tel) g.tel.shipIn(g, t);
  g.events.push({ kind: 'tanker' });
  cue(g, 'tanker.horn', t.x, t.y);
}

/** The furthest a hull may sail this step: up to a closed lock gate, or
 *  short of an open entry gate while the chamber has no room left in its
 *  file. (The lab's Hold, sim/convoy.ts, slows the hull itself: holdPace.) */
function stopAt(g: Game, s: Ship): number {
  if (!g.map.locks) return Infinity;
  const ch = g.map.channels[s.channel];
  let stop = Infinity;
  g.map.locks.forEach((lock, i) => {
    const d0 = laneDAtX(ch, lock.x0);
    const d1 = laneDAtX(ch, lock.x1);
    if (d0 === null || d1 === null) return;
    const st = g.lockState[i];
    const wait = d0 - LOCK.stand;
    // Short of the gates: wait at the entry while it is shut, or while the
    // chamber holds all it can in this hull's file. (The player's Saltgate
    // jam: at a high flow the next hull sailed on into the gateway behind a
    // full chamber, so the entry gate could never shut, the chamber never
    // filled and the exit never opened.)
    if (s.d < wait + 1) {
      if (st.phase !== 'in' || !chamberRoom(g, s, ch, d0, d1)) stop = Math.min(stop, wait);
    }
    // In the chamber: wait at the exit while it is shut.
    else if (s.d < d1 && st.phase !== 'out') stop = Math.min(stop, d1 - LOCK.stand);
  });
  return stop;
}

/** Is there room in a lock's chamber for a hull short of its entry? The
 *  hulls in its file queue back from the exit gate a station-keeping gap
 *  apart; the next place in that queue must be clear of the entry gateway,
 *  or the gate could not shut behind it. */
function chamberRoom(g: Game, s: Ship, ch: Channel, d0: number, d1: number): boolean {
  const spot = d1 - LOCK.stand;
  const mine = fileLat(g, s, ch, spot);
  let ahead = 0;
  for (const o of g.ships) {
    if (o === s || o.channel !== s.channel || o.d < d0 - LOCK.stand + 1 || o.d >= d1) continue;
    if (Math.abs(fileLat(g, o, ch, spot) - mine) < SHIP.laneMatch) ahead++;
  }
  return spot - SHIP.minGap * ahead >= d0 + LOCK.gateway;
}

/** The offset across its lane a hull will hold at distance d: slotLat's
 *  rule, at d rather than where the hull is now (its file in a lock). */
function fileLat(g: Game, s: Ship, ch: Channel, d: number): number {
  if (s.vip) return 0;
  if (ch.widths && Math.min(laneHalfWidth(ch, d), laneHalfWidth(ch, d + MERGE_AHEAD)) < LANE_FLOOR) return 0;
  const f = formationNow(g);
  return slotOffset(ch, f.offsets[s.slot % f.offsets.length], laneHalfWidth(ch, d), !!f.opens);
}

function updateShips(g: Game, dt: number): void {
  const ease = Math.min(1, SHIP.slotEase * dt);
  // Keep station on the rails: a hull eases off when the one ahead in its lane
  // is too close. This is what turns two ships abreast into a single file when
  // a formation change merges their lanes, instead of stacking them. "Ahead"
  // and "in its lane" are measured along and across the hull's own heading,
  // so the same rule holds on a bend, a reversed lane or a fork.
  const order = [...g.ships].sort((a, b) => b.d - a.d || a.id - b.id);
  const mines = autoHold(g) ? g.threats.filter((th) => th.kind === 'mine' && released(th)) : [];
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
    // (The lab's Hold, sim/convoy.ts: a held hull eases to a stop.)
    const next = s.d + laneSpeed(g, s) * slow * (g.convoy ? holdPace(g, s) : 1) * minePace(g, s, mines) * dt;
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
    if (g.tel) g.tel.shipDelivered(g, s, pts);
    addFx(g, 'text', clamp(s.x, 70, VIEW.width - 70), clamp(s.y, 40, VIEW.height - 40), { life: 1.2, text: `+${pts}` });
    if (s.vip) tankerHome(g, s);
  }
  if (arrived.length) cue(g, 'ship.delivered', clamp(arrived[0].x, 0, VIEW.width), arrived[0].y);
  if (arrived.length) g.ships = g.ships.filter((s) => !arrived.includes(s));
}

/** Tidewater Flats (log v68): how afloat a hull is, 1 on any lane but the
 *  flats; on the flats it eases to a stop as the water drops and is stuck
 *  until the tide is back in (sim/tide.ts floatPace). */
export function aground(g: Game, s: Ship): number {
  if (!g.map.tide || !g.map.channels[s.channel]?.tide) return 1;
  return floatPace(tideNow(g).level);
}

/** The supertanker came through: every hull gets a point back and a weapon
 *  you hold drops by the exit. */
function tankerHome(g: Game, s: Ship): void {
  for (const o of g.ships) {
    if (o.hp >= g.stats.shipHp) continue;
    o.hp += 1;
    if (g.tel) g.tel.heal(g, 's', o.id, 1, o.hp, 'tanker');
  }
  if (g.slots.length) addPickup(g, 'weapon', clamp(s.x, 120, VIEW.width - 120), clamp(s.y, 120, VIEW.height - 120), g.rng.drops.pick(g.slots), 'tanker');
  cue(g, 'tanker.home', clamp(s.x, 0, VIEW.width), s.y);
  g.events.push({ kind: 'bigKill', label: 'TANKER HOME', x: clamp(s.x, 160, VIEW.width - 160), y: clamp(s.y, 80, VIEW.height - 80) });
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
  // Boilers (Armory): sailing only; no map clock reads this.
  return SHIP.speed * FORMATIONS[g.formation].speed * steamMult(g) * g.stats.convoySpeed;
}

/** A hull's speed in its own channel (some lanes are crossed faster). */
function laneSpeed(g: Game, s: Ship): number {
  // Tidewater Flats (log v68): a hull on the flats runs aground as the
  // water drops and sits there until the tide is back (sim/tide.ts).
  return shipSpeed(g) * (g.map.channels[s.channel]?.speed ?? 1) * (g.map.tide ? aground(g, s) : 1);
}

/** Tidewater Flats: is the tide in, the flats lane taking new ships? Only
 *  at high water: not while it falls, is out, or is still coming back in
 *  (sim/tide.ts). Under the encounter layer (log v61) the wave's own low
 *  water (`g.ebb`). (A map without a tide: always.) */
export function highTide(g: Game): boolean {
  return tideNow(g).phase === 'high';
}

/** The tide now (sim/tide.ts tideAt): its phase, the water over the flats
 *  (1 high, 0 low), the seconds to the next turn. */
export function tideNow(g: Game): TideNow {
  return tideAt(g.map, g.t, g.waveT, g.ebb);
}

/** The tide gauge (Tidewater Flats): the tide now, as the gauge reads it. */
export function tideGauge(g: Game): TideNow {
  return tideNow(g);
}

// Bomblets are blamed on the cluster that dropped them.
const SPLASH_WEAPONS: ThreatKind[] = ['ballistic', 'heavy', 'cluster', 'bomblet'];

/** `direct`: the hit was aimed at this ship (formation armour applies);
 *  splash spilling over from a neighbour's hit is not reduced. Spread's
 *  blast cut applies to splash weapons either way. */
export function damageShip(g: Game, s: Ship, amount: number, by: ThreatKind, direct = true, imp?: TelImpact): void {
  if (shielded(g, by)) {
    if (g.tel) g.tel.shipBlocked(g, s, amount, by, direct, 'shield', imp);
    addFx(g, 'block', s.x, s.y, { life: 0.4, r: 30 });
    cue(g, 'shield.block', s.x, s.y);
    blockRefund(g, by);
    return;
  }
  if (glances(g, s.x, s.y, 30)) {
    if (g.tel) g.tel.shipBlocked(g, s, amount, by, direct, 'glance', imp);
    return;
  }
  const f = formationNow(g);
  const nominal = amount;
  if (f.blastCut > 0 && SPLASH_WEAPONS.includes(by)) amount = Math.max(1, Math.ceil(amount * (1 - f.blastCut)));
  const dealt = direct ? Math.max(1, amount - f.armor) : amount;
  const before = s.hp;
  s.hp -= dealt;
  if (g.tel) g.tel.shipHit(g, s, nominal, dealt, before, by, direct, imp);
  if (g.lab) labHarm(g, by, dealt, s.hp <= 0);
  if (s.hp > 0) {
    cue(g, 'ship.hit', s.x, s.y);
    return;
  }
  g.ships = g.ships.filter((o) => o !== s);
  const loss = s.vip ? VIP.loss : 1;
  g.lost += loss;
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
export function damageCarrier(g: Game, amount: number, by: ThreatKind, imp?: TelImpact): void {
  if (shielded(g, by)) {
    if (g.tel) g.tel.carrierHit(g, amount, g.carrierHp, by, imp, 'shield');
    addFx(g, 'block', g.map.carrier.x, g.map.carrier.y, { life: 0.4, r: 60 });
    cue(g, 'shield.block', g.map.carrier.x, g.map.carrier.y);
    blockRefund(g, by);
    return;
  }
  if (glances(g, g.map.carrier.x, g.map.carrier.y, 60)) {
    if (g.tel) g.tel.carrierHit(g, amount, g.carrierHp, by, imp, 'glance');
    return;
  }
  const before = g.carrierHp;
  g.carrierHp = Math.max(0, g.carrierHp - amount);
  if (g.tel) g.tel.carrierHit(g, amount, before, by, imp);
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
  turret: 0,
  // The enemy build: drones and missiles speed up with the wave like their
  // kin; platforms and aircraft barely.
  sprinter: 1,
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
  // The Rig Field (log v49): a relief rig is towed in (an encounter's from
  // the edge its beat names).
  if (l.kind === 'rig') {
    towRig(g, l.enc ? l.side : undefined, l.enc);
    return;
  }
  // Log v51: a Dreadnought pass of the layer's (DREAD_PASSES).
  if (l.kind === 'dreadnought') {
    const pass = dreadPasses(g.map.id, g.enc?.setup)?.[g.wave];
    if (pass && g.map.boss && g.bossWave < g.wave) launchBoss(g, pass);
    return;
  }
  if (l.kind === 'strafer' || l.kind === 'bomber') {
    launchPlane(g, l);
    return;
  }
  // The stealth aircraft: no warning, so their line is picked now.
  // (An encounter's own comes from the side its beat names: log v45.)
  if (isPlaneKind(l.kind)) {
    launchPlane(g, { ...l, side: l.enc && l.side ? l.side : g.rng.foes.chance(0.5) ? 1 : -1 });
    return;
  }
  if (isFoe(l.kind) && !fromBase(l.kind)) {
    launchFoe(g, l);
    return;
  }
  // The Rig Field (log v49): an encounter's launch off a rig brought down
  // since its wave began comes from the far shore instead (rigStandIn).
  if (l.enc && !l.filler && l.base >= 0 && g.baseDown[l.base] && g.map.bases[l.base].rig) l = { ...l, base: rigStandIn(g, l.base) };
  // The Citadel (log v60, SHIELD_RISES): what the Citadel would have fired
  // once it is silenced comes off the far silo nearest it (a long flight),
  // and not under the dome.
  if (l.base >= 0 && g.baseDown[l.base] && g.map.bases[l.base].core && shieldRises(g)) l = { ...l, base: rigStandIn(g, l.base), dome: false };
  if (l.base < 0 || g.baseDown[l.base]) return;
  // Bomber Wing silenced this silo: the launch is cancelled, not delayed.
  if ((g.quietUntil[l.base] ?? 0) > g.t) return;
  const base = g.map.bases[l.base];
  if (isFoe(l.kind)) launchFoe(g, l, base);
  else {
    const th = spawnThreat(g, l.kind, base.x, base.y, 'base');
    if (l.enc) th.enc = l.enc;
    if (l.filler) th.filler = true;
    if (l.tow) th.rack = true;
    if (l.fire && l.kind === 'fastboat') lightFireShip(th);
    else if (l.boat && l.kind === 'fastboat') armBoat(th, l.boat);
    if (l.aim === 'crowd') th.ebb = true;
    // The Citadel (log v60, MAP_SIGNATURE `dome`): from the signature's
    // first wave everything the Citadel fires leaves under its dome.
    if (base.core && (l.dome || !!signatureOf(g.map.id, g.wave, g.enc?.setup)?.dome)) th.dome = true;
    // Log v67 (the drawing's salvo: the keep's hatches, its flash): when the
    // Citadel last launched.
    if (base.core) {
      const keep = g.threats.find((t) => t.kind === 'citadel' && t.base === l.base && !t.dead);
      if (keep) keep.shotT = g.t;
    }
    if (l.aim) aimBeat(g, th, l.aim, l.inLane);
    if (l.called) th.called = true;
    if (l.paired) th.paired = true;
    if (l.spotter !== undefined) th.src = l.spotter;
    // A supply drone (the Bombardment's) heads for the carrier.
    if (l.cargo) {
      th.cargo = true;
      th.target = CARRIER_TARGET;
    }
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
  // Log v55 (round 15, HIDDEN_MINES): a mine drifts out of sight until a
  // ship comes close: no flash, no sound, nothing at its chute.
  if (kind === 'mine' && hiddenMines(g)) th.hidden = true;
  g.threats.push(th);
  if (g.tel) g.tel.spawn(g, th, origin);
  if (g.lab) labCame(g, th);
  if (th.hidden) return th;
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

/** Log v33 (round 9, the Behemoth Run's strike on the supertanker): an
 *  aircraft's line down the middle of the map's VIP lane (round it, where
 *  it bends), or none on a map without one. */
export function vipRoute(g: Game): { y: number; lane?: number; lat?: number } | null {
  const lane = g.map.channels.findIndex((c) => c.vip);
  if (lane < 0) return null;
  const ch = g.map.channels[lane];
  if (laneBends(ch)) return { y: lanePoint(ch, 0).y, lane, lat: 0 };
  return { y: lanePoint(ch, 0).y };
}

/** The line an aircraft flies. A strafing jet lines up on the densest band of
 *  hulls (a tight block is its favourite target); a bomber flies just outside
 *  a shipping channel and drops its missiles in. Where the lane curves, the
 *  aircraft follows it round instead: a strafer down its middle, a bomber
 *  off its edge. */
function planeRoute(g: Game, kind: ThreatKind, rng: RNG): { y: number; lane?: number; lat?: number } {
  const chans = g.map.channels;
  if (isBomberKind(kind)) {
    // (Log v69: not a lane that turns tighter than a bomber can fly beside it,
    // the Delta's hairpins: its bombers fly the map's own lines across it.)
    const bent = chans.map((c, i) => i).filter((i) => laneBends(chans[i]) && !chans[i].tide && laneMinRadius(chans[i]) > BOMBER_MIN_TURN);
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

export function launchPlane(g: Game, l: Launch): void {
  const side = l.side ?? 1;
  const route = l.y === undefined ? (l.sow ? sowRoute(g) : (l.aim === 'vip' && vipRoute(g)) || planeRoute(g, l.kind, g.rng.threats)) : { y: l.y, lane: l.lane, lat: l.lat };
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
  if (l.enc) th.enc = l.enc;
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
  if (l.sow) sowMines(th, l.sow, SOW.rack);
}

/** Log v49 (The Rig Field): where an encounter's launch off rig station
 *  `i` comes from: the rig while it stands; brought down, the far shore's
 *  silo nearest it (a launcher with no rig: a long flight, so more
 *  warning), as most of the wave's own launches off a downed rig move to a
 *  launcher still standing (pickBase). Any other base: itself. */
export function rigStandIn(g: Game, i: number): number {
  const b = g.map.bases[i];
  // (Log v60: the silenced Citadel's too.)
  if (!(b?.rig || b?.core) || !g.baseDown[i]) return i;
  const far = g.map.bases.map((x, k) => (!x.rig && !x.core && launcher(x) && !g.baseDown[k] ? k : -1)).filter((k) => k >= 0);
  return far.sort((p, q) => Math.abs(g.map.bases[p].x - b.x) - Math.abs(g.map.bases[q].x - b.x))[0] ?? -1;
}

/** The Rig Field's rig stations (its bases with a rig), west to east. */
export function rigStations(g: Game): number[] {
  return g.map.bases.map((b, i) => (b.rig ? i : -1)).filter((i) => i >= 0);
}

/** The rig standing on station `i` (not one still on its tow). */
export function rigAt(g: Game, i: number): Threat | undefined {
  return g.threats.find((t) => !t.dead && t.kind === 'rig' && t.base === i && t.tow === undefined);
}

/** Log v49 (The Rig Field, MAP_SIGNATURE `kind: 'rig'`, lab only): a relief
 *  rig is towed in along the rig line (TOW). It makes for a downed station
 *  (one no other tow is making for), the one nearest the ship least far
 *  along (the way in is the map's danger); with none down, for the most
 *  damaged rig standing (the one nearest that ship if none is). It comes from the edge `side` names (+1 the left,
 *  sailing right), else the edge nearer its station. */
export function towRig(g: Game, side?: number, enc?: string): void {
  const st = rigStations(g);
  if (!st.length) return;
  const rear = g.ships.reduce<Ship | undefined>((a, s) => (!a || s.d < a.d ? s : a), undefined);
  const lx = rear ? rear.x : VIEW.width / 2;
  const coming = new Set(g.threats.filter((t) => !t.dead && t.tow !== undefined).map((t) => t.tow));
  const near = (a: number, b: number) => Math.abs(g.map.bases[a].x - lx) - Math.abs(g.map.bases[b].x - lx);
  const down = st.filter((i) => g.baseDown[i] && !coming.has(i)).sort(near);
  const up = st.filter((i) => !g.baseDown[i]).sort((a, b) => (rigAt(g, a)?.hp ?? 0) - (rigAt(g, b)?.hp ?? 0) || near(a, b));
  const to = down[0] ?? up[0] ?? st[0];
  const b = g.map.bases[to];
  const from = side ?? (b.x < VIEW.width / 2 ? 1 : -1);
  const th = structure(g, 'rig', from > 0 ? -60 : VIEW.width + 60, b.y, TOW.hp);
  th.maxHp = TOW.hp;
  th.tow = to;
  th.heading = from > 0 ? 0 : Math.PI;
  if (enc) th.enc = enc;
  g.threats.push(th);
  if (g.tel) g.tel.spawn(g, th, 'structure');
}

/** Log v49 (The Rig Field's Rig Barrage): a rig rises again on downed
 *  station `i`, `hp` hits, and the station launches again. */
export function raiseRig(g: Game, i: number, hp: number): void {
  const b = g.map.bases[i];
  g.baseDown[i] = false;
  const th = structure(g, 'rig', b.x, b.y, hp, i);
  // Counting shots (log v55), its pips are its own: the shots it rose with.
  th.maxHp = shotRigs(g) ? hp : rigFull(g, i);
  g.threats.push(th);
  if (g.tel) g.tel.spawn(g, th, 'structure');
  addFx(g, 'splash', b.x, b.y + 30, { life: 1.2, r: 60 });
  g.events.push({ kind: 'bigKill', label: 'RIG RAISED', x: b.x, y: b.y });
}

/** A relief rig on its tow: on along the rig line to its station, and in. */
function updateTow(g: Game, th: Threat, dt: number): void {
  const b = g.map.bases[th.tow!];
  const dx = b.x - th.x;
  const step = TOW.speed * dt;
  th.vx = Math.sign(dx) * TOW.speed;
  if (Math.abs(dx) > step) {
    th.x += Math.sign(dx) * step;
    return;
  }
  dockRig(g, th);
}

/** A relief rig docks at its station: it stands there, `TOW.dock` hits,
 *  and the station launches again; or, with a rig already standing there,
 *  it mends that one by as much and goes. Either way its rack of guided
 *  missiles goes off at the ship nearest the station, lit first. */
function dockRig(g: Game, th: Threat): void {
  const i = th.tow!;
  const b = g.map.bases[i];
  const full = rigFull(g, i);
  const rig = rigAt(g, i);
  // Round 15 (UI only): the side its tug came from, for the cast-off.
  th.towDir = th.vx < 0 ? -1 : 1;
  th.vx = 0;
  // Round 15: it settles on its legs with a splash (the tow's arrival).
  addFx(g, 'splash', b.x, b.y + 34, { life: 1.1, r: 80 });
  if (!rig) {
    th.dockT = g.t;
    g.baseDown[i] = false;
    th.tow = undefined;
    th.base = i;
    th.x = b.x;
    th.y = b.y;
    th.hp = TOW.dock;
    th.maxHp = full;
    g.events.push({ kind: 'bigKill', label: 'RIG RAISED', x: b.x, y: b.y });
  } else {
    rig.hp = Math.min(full, rig.hp + TOW.dock);
    th.dead = true;
    g.events.push({ kind: 'bigKill', label: 'RIG MENDED', x: b.x, y: b.y });
  }
  addFx(g, 'launch', b.x, b.y, { life: TOW.fire, r: 46 });
  for (let k = 0; k < TOW.rack; k++) g.queue.push({ at: g.waveT + TOW.fire + k * TOW.gap, kind: 'guided', base: i, aim: 'near', tow: true });
  g.queue.sort((x, y) => x.at - y.at);
}

/** Log v48 (Sowers' Reach): a bomber that sows `n` mines in place of its
 *  missiles. */
export function sowMines(th: Threat, n: number, rack = 0): void {
  th.sow = true;
  th.bombs = n;
  if (rack > 0) {
    th.sowRack = rack;
    th.hp += SOW.armor;
    th.maxHp = th.hp;
  }
}

/** A sowing bomber's line (log v48): along the first lane, SOW.line of its
 *  half-width up-current of its middle, so the mines it lays drift across
 *  the whole lane. A straight lane only (Sowers' Reach's); a bent one, the
 *  bombers' own route. */
function sowRoute(g: Game): { y: number; lane?: number; lat?: number } {
  const ch = g.map.channels[0];
  if (laneBends(ch)) return planeRoute(g, 'stealthBomber', g.rng.threats);
  const up = (g.map.current?.y ?? 1) >= 0 ? -1 : 1;
  return { y: ch.y + up * SOW.line * ch.halfWidth };
}

/** The ship a sowing bomber lays its next mine ahead of (log v48): one it
 *  is SOW.near to SOW.far px ahead of along the ship's course, within
 *  SOW.across of its line; the nearest such. */
function sowAhead(g: Game, th: Threat): Ship | undefined {
  let best: Ship | undefined;
  let bd = Infinity;
  for (const s of g.ships) {
    const p = shipAhead(g, s, 1);
    const hx = p.x - s.x;
    const hy = p.y - s.y;
    const L = Math.hypot(hx, hy);
    if (L < 1e-6) continue;
    const along = ((th.x - s.x) * hx + (th.y - s.y) * hy) / L;
    const across = Math.abs((th.y - s.y) * hx - (th.x - s.x) * hy) / L;
    if (along < SOW.near || along > SOW.far || across > SOW.across) continue;
    if (along < bd) {
      bd = along;
      best = s;
    }
  }
  return best;
}

/** Ballistics commit at launch to the point their ship will have reached.
 *  Log v46: a Missile Truck's lob is in the air at least `lob.flight` s and
 *  climbs at least `lob.apex` px (still under the ceiling). */
function aimBallistic(g: Game, th: Threat, lob?: { flight: number; apex: number }): void {
  const t = targetPos(g, th);
  const ship = g.ships.find((o) => o.id === th.target);
  const least = lob ? lob.flight : BALLISTIC.minFlight / g.waveSpeed;
  let at: Point = t;
  let dur = Math.max(lob ? least : 0, dist(th.sx, th.sy, t.x, t.y) / th.speed);
  // A Missile Truck's lob reads the gates: a ship held at a shut one is
  // aimed where it waits (the gate may open while the missile flies).
  const ahead = (s: Ship, t: number): Point => {
    if (!lob) return shipAhead(g, s, t);
    const p = laneAt(g.map.channels[s.channel], Math.min(s.d + laneSpeed(g, s) * t, Math.max(s.d, stopAt(g, s))), s.lat);
    return { x: p.x, y: p.y };
  };
  for (let k = 0; k < 2 && ship; k++) {
    at = ahead(ship, dur);
    dur = Math.max(lob ? least : 0, dist(th.sx, th.sy, at.x, at.y) / th.speed);
  }
  th.ix = Math.min(VIEW.width - 20, at.x);
  th.iy = at.y;
  th.dur = Math.max(least, dur);
  th.apex = Math.min(BALLISTIC.apexMax, BALLISTIC.apexFrac * dist(th.sx, th.sy, th.ix, th.iy));
  if (lob) th.apex = Math.max(th.apex, lob.apex);
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

/** Log v46 (the Missile Truck): a ballistic at ship `target` (or, gone,
 *  wherever it was aimed), lobbed high and slow. */
export function lobBallistic(g: Game, th: Threat, target: number, lob: { flight: number; apex: number }): void {
  th.target = target;
  aimBallistic(g, th, lob);
  th.heading = Math.atan2(th.iy - th.sy, th.ix - th.sx);
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

export function targetPos(g: Game, th: Threat): Point {
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
export function ensureTarget(g: Game, th: Threat): void {
  if (th.target === CARRIER_TARGET || th.target === NO_TARGET) return;
  if (isPostTarget(th.target) ? postUp(g, postIndex(th.target)) : g.ships.some((s) => s.id === th.target)) return;
  // Log v43 (Battery Point, lab only under the encounter layer): a launch
  // at a shore gun that is knocked out on its way goes for the other gun
  // while that one stands, not the nearest ship (the map's signature: the
  // guns are the target). The campaign retargets as it always has.
  if (isPostTarget(th.target) && g.enc && g.enc.setup.rev >= 4 && g.map.posts) {
    const up = g.map.posts.map((_, i) => i).filter((i) => postUp(g, i));
    if (up.length) {
      th.target = POST_TARGET - up[0];
      return;
    }
  }
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
  const px = th.x;
  const py = th.y;
  // The step's own length, for the velocity (a Gravity Well slows the rest).
  const dt0 = dt;
  // Gravity Well (Test Lab round 5: by size): a small threat is dragged
  // toward the vortex instead of flying its course; a big one only slows
  // inside it, until MAX drags in everything.
  if (g.fields.length && !isStructure(th.kind) && released(th)) {
    const well = g.fields.find((f) => f.kind === 'well' && fieldDist(f, th.x, th.y) <= f.hw);
    if (well && wellPulls(th.kind, well.level)) {
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
      // A ballistic missile hangs in the vortex, its whole arc carried with
      // it (its clock stops), so it flies on from there if it gets out.
      if (th.kind === 'ballistic') {
        const mx = th.x - px;
        const my = th.y - py;
        th.sx += mx;
        th.sy += my;
        th.ix += mx;
        th.iy += my;
      } else th.age += dt;
      th.vx = (th.x - px) / dt;
      th.vy = (th.y - py) / dt;
      return;
    }
    if (well) dt *= AB.well.slow;
  }
  // Lee of Marrow's radar (log v29): every enemy unit and munition inside a
  // standing tower's sweep moves at POST.radarSlow of its pace, its clock
  // too (a shell's arc, a missile's boost, a drone's weave).
  if (g.map.posts && !isStructure(th.kind) && released(th) && tracked(g, th)) dt *= POST.radarSlow;
  th.age += dt;
  if (isStructure(th.kind)) {
    if (th.kind === 'dreadnought') updateBoss(g, th, dt);
    else if (th.kind === 'turret') updateTurret(g, th, dt);
    else if (th.tow !== undefined) updateTow(g, th, dt);
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
  } else if (th.kind === 'fastboat' && th.boat) {
    // Log v69 (The Coves): a gunboat or a rocket boat sails itself (sim/boats.ts).
    updateBoat(g, th, dt);
  } else if (th.kind === 'supersonic' && th.age < SUPERSONIC.rail) {
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
      th.heading = Math.atan2(tp.y - th.y, tp.x - th.x) + (d > 80 ? weave : 0);
    } else if (th.kind === 'mothership') {
      th.heading = want;
    } else {
      const base = STEER[th.kind] ?? GUIDED.turnRate;
      const close = Math.max(0, 1 - d / GUIDED.terminalRange);
      // The enemy helicopter's missiles home without circling (Test Lab
      // round 1: "the missile for the enemy helicopter also needs to be
      // fixed"); the rest keep their own turn.
      const turn = (th.kind === 'heliRocket' ? homingTurn(base, th.speed, d) : base + (th.kind === 'guided' ? GUIDED.terminalTurn * close : 0)) * dt;
      // Log v69: and a speedboat swings a little side to side while it is far, as a boat flat out does.
      const wob = th.kind === 'fastboat' && d > 160 ? BOATS.speed.weave * Math.sin(th.age * BOATS.speed.weaveHz + th.phase) : 0;
      th.heading += clamp(angleDiff(want + wob, th.heading), -turn, turn);
    }
    // Off the rail slowly (a guided missile from its launch; a supersonic
    // from the end of its rail, log v27).
    // Log v69 (The Coves' speedboat): it planes up out of its cove.
    const boost =
      th.kind === 'fastboat'
        ? BOATS.speed.from + (1 - BOATS.speed.from) * Math.min(1, th.age / BOATS.speed.plane)
        : th.kind === 'guided' && th.age < GUIDED.boost
        ? GUIDED.boostFrom + (1 - GUIDED.boostFrom) * (th.age / GUIDED.boost)
        : th.kind === 'supersonic'
          ? supersonicPace(th.age)
          : th.kind === 'cluster'
            ? clusterPace(th.age)
            : 1;
    th.x += Math.cos(th.heading) * th.speed * boost * dt;
    th.y += Math.sin(th.heading) * th.speed * boost * dt;
    if (th.kind === 'mothership') spawnChildren(g, th, dt);
    if (th.kind === 'cluster' && th.target !== CARRIER_TARGET) {
      // Round 12: armed only after its climb (CLUSTER.armAfter); until then
      // it is a missile in the air, nothing to split and nothing to hit
      // (its own damage is 0: only its bomblets do harm).
      if (clusterArmed(th) && d < CLUSTER.splitRange) splitCluster(g, th);
    } else {
      checkImpact(g, th);
    }
  }
  th.vx = (th.x - px) / dt0;
  th.vy = (th.y - py) / dt0;
}

/** Gravity Well (Test Lab round 5): what it drags in at every level, the
 *  small threats: every missile and shot you can shoot down, drones, small
 *  boats and mines. Everything else (aircraft, helicopters, motherships,
 *  vehicles, subs, the tender, the buoy) it only slows, until MAX. */
export const WELL_SMALL: ReadonlySet<ThreatKind> = new Set<ThreatKind>([
  'ballistic', 'guided', 'supersonic', 'heavy', 'cluster', 'bomblet', 'hydra', 'dart', 'heliRocket', 'torpedo', 'cloud',
  'drone', 'minidrone', 'sprinter', 'armored', 'scavenger', 'guard',
  'fastboat', 'mine',
]);

/** Does a well of this level drag this kind in (else it slows it)? */
export function wellPulls(kind: ThreatKind, level: number): boolean {
  return !isStructure(kind) && (WELL_SMALL.has(kind) || level >= ABILITY_MAX);
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
      addFx(g, 'boom', s.x, s.y, { life: 0.4, r: 16 });
      damageShip(g, s, THREATS[th.kind].damage, th.kind, true, g.tel?.impact(th.id, s.x, s.y));
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
    // Log v48 (Sowers' Reach): a sowing bomber lays a mine in the water a
    // ship is about to sail through, in place of a missile at it.
    if (th.sow) {
      const runIn = th.kind === 'stealthBomber' ? FOE.stealthBomber.runIn : PLANE.bomberRunIn;
      if ((th.bombs ?? 0) > 0 && th.dropT >= SOW.every && inside >= runIn && sowAhead(g, th)) {
        th.bombs! -= 1;
        th.dropT = 0;
        const m = spawnThreat(g, 'mine', th.x, th.y, 'air');
        m.parent = th.kind;
        m.src = th.id;
        cue(g, 'mine.drop', th.x, th.y);
        // Log v55: a hidden mine goes into the water with a splash under
        // the bomber, and is gone from sight until a ship comes close.
        if (m.hidden) addFx(g, 'splash', th.x, th.y, { life: 0.5, r: 16 });
        g.origins.air -= 1;
        g.origins.child += 1;
      }
    }
    // Log v70: with its mines down, a signature bomber drops its guided
    // missiles on the ships its mines have halted.
    if (th.sow && (th.bombs ?? 0) <= 0 && (th.sowRack ?? 0) > 0 && th.dropT >= PLANE.dropEvery && inside >= (th.kind === 'stealthBomber' ? FOE.stealthBomber.runIn : PLANE.bomberRunIn)) {
      const tgt = g.ships
        .filter((s) => (r ? planeFrame(g, th, s, th.x, th.y, tx, ty, r.s).along : (s.x - th.x) * side) > 0)
        .sort((a, b) => dist(a.x, a.y, th.x, th.y) - dist(b.x, b.y, th.x, th.y))[0];
      if (tgt) {
        th.sowRack! -= 1;
        th.dropT = 0;
        const m = spawnThreat(g, 'guided', th.x, th.y, 'air');
        m.target = tgt.id;
        m.parent = th.kind;
        m.src = th.id;
        cue(g, 'bomber.drop', th.x, th.y);
        m.hp = 1;
        g.origins.air -= 1;
        g.origins.child += 1;
      }
    }
    const ahead = th.sow ? undefined : inside < (th.kind === 'stealthBomber' ? FOE.stealthBomber.runIn : PLANE.bomberRunIn) ? undefined : g.ships
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
      m.src = th.id;
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
    damagePost(g, i, heavy ? 99 : Math.max(1, dmg), blame, g.tel?.impact(th.id, th.x, th.y));
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
    damageCarrier(g, heavy ? Math.ceil(CARRIER.hp / 2) : dmg, blame, g.tel?.impact(th.id, th.x, th.y));
    addFx(g, 'boom', th.x, th.y, { life: 0.7, r: th.kind === 'heavy' || th.kind === 'mothership' ? 50 : 30 });
    return;
  }
  const s = g.ships.find((o) => o.id === th.target);
  if (!s || dist(th.x, th.y, s.x, s.y) >= SHIP.hitRadius) return;
  th.dead = true;
  if (th.kind === 'cloud') return; // only its fireball does harm (above)
  // Telemetry: one impact, shared by every hull this blow reaches.
  const imp = g.tel?.impact(th.id, th.x, th.y);
  if (shielded(g, blame)) reflect(g, th, th.x, th.y);
  if (th.kind === 'heavy') {
    // A heavy warhead also damages everything close by.
    const reach = HEAVY.splash * formationNow(g).splash;
    addFx(g, 'splash', th.x, th.y, { life: 0.9, r: Math.max(reach, 24) });
    cue(g, 'impact.splash', th.x, th.y);
    for (const o of [...g.ships]) {
      if (o !== s && dist(o.x, o.y, th.x, th.y) <= reach) damageShip(g, o, HEAVY.splashDamage, blame, false, imp);
    }
  } else {
    addFx(g, 'boom', th.x, th.y, { life: 0.7, r: 28 });
  }
  // A heavy's direct hit sinks the ship whatever its armour or formation
  // (the supertanker takes VIP.heavyHit: it is built to take one).
  // The Coves (log v53): a fire ship rams for FIRESHIP.ram (its weapon is
  // its fire), and leaves the fire on the lane.
  damageShip(g, s, heavy ? (s.vip ? VIP.heavyHit : HEAVY_SINKS) : th.fire ? FIRESHIP.ram : dmg, blame, true, imp);
  if (th.fire) burstCloud(g, th, FIRESHIP.burn);
  // Log v69: a speedboat goes up in a ball of fire where it rams (a picture:
  // the fire that stays on the water is the fire ship's).
  else if (th.kind === 'fastboat') addFx(g, 'fireball', th.x, th.y, { life: 0.9, r: BOATS.speed.blast });
}

/** Log v53 (The Coves): a fast boat set alight, a fire ship (FIRESHIP):
 *  more hits, a little slower. */
export function lightFireShip(th: Threat): void {
  th.fire = true;
  th.hp = th.maxHp = FIRESHIP.hp;
  th.speed *= FIRESHIP.speed;
}

/** Gravity Well: the radius caught threats circle the core at (well inside
 *  AB.well.core, so the implosion still reaches them all). */
const WELL_RING = 22;

/** More than any hull can take, through any armour or formation cut. */
const HEAVY_SINKS = 99;

export function child(g: Game, parent: Threat, kind: ThreatKind, target: number, heading: number): Threat {
  const th: Threat = {
    ...parent,
    id: g.nextId++,
    kind,
    parent: parent.kind,
    src: parent.id,
    hp: THREATS[kind].hp,
    speed: THREATS[kind].speed * (1 + (g.waveSpeed - 1) * WAVE_SPEED_SHARE[kind]),
    heading,
    target,
    age: 0,
    dead: false,
    spawnT: 0,
  };
  if (g.tel) g.tel.spawn(g, th, 'child', parent);
  return th;
}

/** Round 12: a cluster's pace through its climb off the rail, from
 *  CLUSTER.climbFrom up to full at CLUSTER.armAfter. */
export function clusterPace(age: number): number {
  return age >= CLUSTER.armAfter ? 1 : CLUSTER.climbFrom + (1 - CLUSTER.climbFrom) * (age / CLUSTER.armAfter);
}

/** Round 12: a cluster can split only once it has flown CLUSTER.armAfter s. */
export function clusterArmed(th: Threat): boolean {
  return th.age >= CLUSTER.armAfter;
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
  const reach = BALLISTIC.splash * formationNow(g).splash;
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
  const imp = g.tel?.impact(th.id, th.ix, th.iy);
  inBlast.forEach((o, k) => {
    if (k === 0 ? o.d <= BALLISTIC.splash : o.d <= reach) damageShip(g, o.s, k === 0 ? dmg : BALLISTIC.spill, 'ballistic', k === 0, imp);
  });
  if (onCarrier(g, th.ix, th.iy, BALLISTIC.splash * 0.5)) damageCarrier(g, dmg, 'ballistic', imp);
  g.map.posts?.forEach((p, i) => {
    if (dist(p.x, p.y, th.ix, th.iy) <= BALLISTIC.splash) damagePost(g, i, dmg, 'ballistic', imp);
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

export function damageThreat(g: Game, th: Threat, amount: number, drops = true, by: HurtSrc = 'other', weapon?: AbilityId): void {
  if (th.dead || untouchable(th)) return;
  // Still on its launcher (round 13): only the Nuke touches it.
  if (!released(th) && by !== 'nuke') return;
  // The Citadel can't be hurt while any shield generator stands.
  if (th.kind === 'citadel' && shieldUp(g)) {
    if (g.steps % 3 === 0) addFx(g, 'block', th.x, th.y, { life: 0.4, r: 70 });
    cue(g, 'shield.block', th.x, th.y);
    return;
  }
  // Log v60 (The Citadel): the Citadel's own fire is shielded while it is
  // inside the dome and the shield stands.
  if (domed(g, th)) {
    if (g.steps % 3 === 0) addFx(g, 'block', th.x, th.y, { life: 0.3, r: 24 });
    cue(g, 'shield.block', th.x, th.y);
    return;
  }
  // The Lure Beacon: helpers' shots pass through it; only the player's own
  // hand sinks it.
  if (th.kind === 'lure' && !g.foe.byTap) {
    if (g.steps % 4 === 0) addFx(g, 'block', th.x, th.y, { life: 0.3, r: 26 });
    return;
  }
  // Log v55 (round 15, SHOT_RIGS): a rig counts shots, not damage.
  // (Log v60: the Citadel's generators and the Citadel itself too.)
  if ((th.kind === 'rig' || th.kind === 'generator' || th.kind === 'citadel') && shotRigs(g)) {
    amount = rigShot(g, th, amount, by);
    if (amount <= 0) return;
  }
  const before = th.hp;
  th.hp -= amount;
  // Thirds of a hit (seekers) add up to a whole one, float error aside.
  if (th.hp > 1e-6) {
    if (g.tel) g.tel.hurt(g, th, before, by, weapon);
    return;
  }
  th.dead = true;
  g.kills[th.kind] += 1;
  if (g.tel) g.tel.hurt(g, th, before, by, weapon);
  if (isFoe(th.kind)) foeDown(g, th, !drops);
  // The Coves (log v53): a fire ship sunk burns where it went down (the
  // Nuke puts it out, as an Incendiary Missile's).
  if (th.fire && drops) burstCloud(g, th, FIRESHIP.burn);
  if (g.event) eventFoeDown(g, th);
  if (g.lab) labKilled(g, th, !!g.lab.weapon && !!held(g, g.lab.weapon));
  if (isStructure(th.kind)) {
    structureDown(g, th);
  } else {
    addFx(g, 'boom', th.x, th.y, { life: 0.55, r: th.kind === 'drone' ? 18 : 26 });
    cue(g, KILL_CUE[th.kind], th.x, th.y);
    if (THREATS[th.kind].hp >= 3) g.events.push({ kind: 'bigKill', threat: th.kind, x: th.x, y: th.y });
  }
  // An encounter's easy filler (log v47) drops nothing: it rolls no dice and
  // moves no pity clock, so the run's pickups and weapons come as they would
  // without it (with drops, the Island's extra early kills brought weapons
  // on at other moments, and the bots lost more on its wave 4).
  if (!drops || th.filler || th.tow !== undefined) return;
  // A special event's supply drone always drops (the Bombardment's).
  if (th.cargo && g.event) {
    const c = eventCargo(g);
    addPickup(g, c.kind, th.x, th.y, c.weapon, 'event');
    return;
  }
  if (g.rng.drops.chance(THREATS[th.kind].dropChance * g.stats.powerShare * dropMult(g, false))) dropPickup(g, th.x, th.y);
  // Weapons drop on their own roll, on top of the power-ups (playtest round
  // 2: sharing one roll, they crowded out the repairs and Overdrives).
  else if (weaponDue(g, th.kind)) dropWeapon(g, th.x, th.y);
}

/** Log v55 (round 15, SHOT_RIGS): do this map's rigs count shots? */
export function shotRigs(g: Game): boolean {
  return !!g.enc && shotRigsOn(g.map.id, g.enc.setup);
}

/** Weapons whose one shot lands on a rig in several pieces at once (a
 *  burst's fragments, a blast round its target, pellets): one shot a rig
 *  a step, however many land. */
const AREA_SHOT: ReadonlySet<HurtSrc> = new Set<HurtSrc>(['blast', 'shrapnel', 'scatter', 'thermo', 'grapnel', 'orbital', 'gunship', 'droneScreen', 'reflect', 'well', 'airstrike']);

/** What a hit does to a rig on a map that counts shots (log v55; the
 *  player: "it has to consume X amount of your ammo to be destroyed, that
 *  way power-ups can't do a huge amount of hit points with one ammo"): a
 *  shot is one, whatever its damage (a Railgun's, a warhead's, a powered-up
 *  shot's); a seeker's third is a third; an area weapon counts once a rig
 *  a step; the Nuke and the golden bomb count PICKUPS.nukeStructure. */
function rigShot(g: Game, th: Threat, amount: number, by: HurtSrc): number {
  if (by === 'nuke') return amount;
  if (AREA_SHOT.has(by)) {
    if (th.shotStep !== g.steps) {
      th.shotStep = g.steps;
      th.shotBy = [];
    }
    if (th.shotBy!.includes(by)) return 0;
    th.shotBy!.push(by);
  }
  return Math.min(1, amount);
}

function blast(g: Game, x: number, y: number, radius: number, exceptId: number, amount = 1, weapon?: AbilityId): void {
  for (const o of g.threats) {
    if (!released(o) || o.id === exceptId) continue;
    if (dist(x, y, o.x, o.y) <= radius) damageThreat(g, o, amount, true, 'blast', weapon);
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
  const shoot = (t: Threat, from: Point = muzzle(g, t.x, t.y)) =>
    g.interceptors.push({
      id: g.nextId++, x: from.x, y: from.y - 6, target: t.id, tx: t.x, ty: t.y, life: 0, src: 'gun', tap: true,
      weapon: w ? { ...w } : undefined,
      ...(also.length ? { also } : {}),
      ...(dmg !== g.stats.hitDamage ? { dmg } : {}),
      ...(twinSide ? { twin: true } : {}),
    });
  firstShot(g, () => shoot(th));
  if (g.lab) labShotAt(g, th.id);
  cue(g, 'gun.fire', p.x, p.y);
  const twinOf = () =>
    g.threats
      .filter((o) => released(o) && o.id !== th.id && assigned(g, o.id) < o.hp && dist(o.x, o.y, th.x, th.y) <= AB.tesla.twin)
      .sort((a, b) => dist(a.x, a.y, th.x, th.y) - dist(b.x, b.y, th.x, th.y))[0];
  if (tags.some((o) => o.id === 'tesla' && o.level >= 3)) {
    const twin = twinOf();
    if (twin) shoot(twin);
  }
  // Hyper Overdrive: every shot fires twice (the second at the next threat),
  // the second from its own muzzle beside the first (Test Lab round 5).
  if (hyper(g) && !twinSide) {
    const t2 = twinOf() ?? th;
    twinSide = AB.overdrive.twin;
    shoot(t2, muzzle(g, t2.x, t2.y));
    twinSide = 0;
  }
  return true;
}

function reload(g: Game, dt: number): void {
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
    const speed = it.src === 'seeker' ? AB.seeker.speed : g.stats.interceptorSpeed;
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
        if (!absorbs(g, th, it, it.dmg ?? g.stats.hitDamage)) damageThreat(g, th, it.dmg ?? g.stats.hitDamage, true, it.by ?? it.src, it.weapon?.id);
        // A Tesla Arc hit arcs on to the threats around it.
        const arc = [it.weapon, ...(it.also ?? [])].find((o) => o?.id === 'tesla');
        if (arc) teslaArc(g, arc.level, bx, by, th.id, AB.tesla.depth[arc.level - 1], new Set([th.id]));
      }
      // A seeker's splash is its own third of a hit.
      blast(g, bx, by, radius, th ? th.id : -1, it.src === 'seeker' ? (it.dmg ?? 1) : 1, it.weapon?.id);
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
  // (A parade truck is the ordinary truck: no debut of its own.)
  if (sp.kind !== 'parade' && !g.seenVectors.has(sp.kind)) {
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
    ...(sp.enc ? { enc: sp.enc } : {}),
    ...(sp.aim ? { aim: sp.aim } : {}),
    ...(sp.parade ? { fires: [], left: sp.parade.missiles, lift: sp.parade.lift, speed: sp.parade.speed } : {}),
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
      const th = spawnThreat(g, r.rounds.shift()!, r.x, r.y, origin);
      th.from = r.id;
      if (r.enc) th.enc = r.enc;
      if (r.aim) aimBeat(g, th, r.aim);
      // Saltgate Canal (log v38, MAP_SIGNATURE `clusters`): the wave's own
      // cluster missiles, off a truck as off a silo, go for the locks.
      else if (th.kind === 'cluster') {
        const sig = g.enc ? signatureOf(g.map.id, g.wave, g.enc.setup) : undefined;
        if (sig?.clusters) aimBeat(g, th, sig.clusters);
      }
      // Battery Point (log v45, MAP_SIGNATURE `heavies`): the wave's own
      // heavy cruise missiles, off a truck as off a silo, go for the shore
      // guns. (Only at the guns: the Behemoth Run's truck heavies pick their
      // target as they did.)
      else if (th.kind === 'heavy') {
        const sig = g.enc ? signatureOf(g.map.id, g.wave, g.enc.setup) : undefined;
        if (sig?.heavies === 'post') aimBeat(g, th, sig.heavies);
      }
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
  if (r.kind === 'parade') {
    updateParadeTruck(g, r, dt);
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
  const dual = g.boost?.id === 'dualWield' ? g.boost : null;
  for (const hand of ['weapon', 'weapon2'] as const) {
    const w = g[hand];
    if (!w) continue;
    if (dual) {
      w.t = dual.t;
      continue;
    }
    const was = w.t;
    w.t -= dt;
    if (was > WEAPON_EXPIRING && w.t <= WEAPON_EXPIRING && w.t > 0) cue(g, 'weapon.expiring', c0.x, c0.y);
    if (w.t <= 0) {
      cue(g, 'weapon.done', c0.x, c0.y);
      // Round 4: say so over the gun, or a player keeps tapping as if loaded.
      const c = g.map.carrier;
      addFx(g, 'text', c.x, c.y - CARRIER.halfBeam - 40, { life: 1.2, text: `${abilityName(w.id, w.level).toUpperCase()} DONE` });
      g[hand] = null;
    }
  }
  // Wild Card's passive runs out on its own clock (the pickup's time).
  const wp = g.wildPassive;
  if (wp) {
    wp.t -= dt;
    if (wp.t <= 0) {
      g.wildPassive = null;
      const c = g.map.carrier;
      addFx(g, 'text', c.x, c.y - CARRIER.halfBeam - 64, { life: 1.2, text: `${abilityName(wp.id, wp.level).toUpperCase()} DONE` });
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
        for (const th of [...g.threats]) if (released(th) && dist(th.x, th.y, f.x1, f.y1) <= AB.well.core[k]) damageThreat(g, th, AB.well.damage[k], true, 'well');
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
    for (const th of [...g.threats]) {
      if (!released(th) || fieldDist(f, th.x, th.y) > f.hw) continue;
      // Log v55 (SHOT_RIGS): a cloud or a burning row is one shot a rig.
      if (th.kind === 'rig' && shotRigs(g)) {
        if (f.rigs?.includes(th.id)) continue;
        (f.rigs ??= []).push(th.id);
      }
      damageThreat(g, th, 1, true, f.kind === 'flak' ? 'flak' : 'burn');
    }
  }
  g.fields = g.fields.filter((f) => f.t < f.life);
}

/** Is this sub or truck up and able to fire (what a strike knocks out)? */
function raiderUp(r: Raider): boolean {
  // (A parade truck can't be hit: its missiles are what you shoot.)
  if (r.kind === 'parade') return false;
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
      if (!released(th) || a.hits.includes(th.id) || !under(th.x, th.y, 40)) continue;
      a.hits.push(th.id);
      a.firedT = g.t;
      addFx(g, 'tracer', a.x + a.dx * 30, a.y + a.dy * 30, { life: 0.18, x2: th.x, y2: th.y });
      cue(g, 'jet.guns', th.x, th.y);
      damageThreat(g, th, a.damage, true, 'airstrike');
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
  scrubRacked(g, (m) => m.from === r.id);
  r.state = 'reverse';
  r.dist = 0;
  addFx(g, 'boom', r.x, r.y, { life: 1.1, r: 52 });
  addFx(g, r.kind === 'sub' ? 'sink' : 'burst', r.x, r.y, { life: r.kind === 'sub' ? 2 : 0.9, r: 40 });
  g.events.push({ kind: 'bigKill', label: r.kind === 'sub' ? 'SUB DESTROYED' : 'TRUCK DESTROYED', x: r.x, y: r.y });
  cue(g, r.kind === 'sub' ? 'sub.destroyed' : 'truck.destroyed', r.x, r.y);
}

// ---------------------------------------------------------------------------
// The 20-map plan: structures, allied posts, mines, locks, the fork

/** Round 13: a launcher destroyed with a munition still on it (a supersonic
 *  arming on a truck, a sub, a rig or the Dreadnought) takes the munition
 *  with it: it never flies. Not a kill of its own (the launcher's was). */
function scrubRacked(g: Game, on: (th: Threat) => boolean): void {
  for (const m of g.threats) {
    if (m.dead || !racked(m) || !on(m)) continue;
    m.dead = true;
    addFx(g, 'boom', m.x, m.y, { life: 0.5, r: 20 });
  }
}

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
function damagePost(g: Game, i: number, amount: number, by: ThreatKind, imp?: TelImpact): void {
  const st = g.posts[i];
  const def = g.map.posts?.[i];
  if (!st || !def || !postUp(g, i)) return;
  if (g.shieldT > 0) {
    if (g.tel) g.tel.postHit(g, i, amount, st.hp, by, imp, 'shield');
    addFx(g, 'block', def.x, def.y, { life: 0.4, r: 34 });
    return;
  }
  const before = st.hp;
  st.hp -= amount;
  if (g.tel) g.tel.postHit(g, i, amount, before, by, imp);
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

/** Is a threat inside a standing radar's sweep (slowed, log v29)? */
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
        if (g.tel) g.tel.heal(g, 'p', i, p.hp - st.hp, p.hp, 'rebuilt');
        st.hp = p.hp;
        cue(g, 'post.up', p.x, p.y);
        g.events.push({ kind: 'post', post: i, down: false, lost: false });
      }
      return;
    }
    st.fireT -= dt;
    if (st.fireT > 0) return;
    const target = lured(g, p.x, p.y, p.reach, g.threats
      .filter((t) => released(t) && !isStructure(t.kind) && dist(t.x, t.y, p.x, p.y) <= p.reach && assigned(g, t.id) < t.hp)
      .sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y))[0]);
    if (!target) {
      st.fireT = 0.1;
      return;
    }
    st.fireT = POST.batteryGap;
    st.aim = Math.atan2(target.y - p.y, target.x - p.x);
    g.interceptors.push({ id: g.nextId++, x: p.x, y: p.y - 10, target: target.id, tx: target.x, ty: target.y, life: 0, src: 'gun', by: 'battery' });
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
  // (Log v60: not the Citadel's fire while the dome shields it.)
  const live = list.filter((t) => released(t) && (!isFoe(t.kind) || foeWorthShooting(g, t)) && !domed(g, t));
  // A relief rig on its tow (log v49) is worth a look as any threat is:
  // a few hits on the way in, before it stands; and in the Rig Barrage the
  // rigs are the boss, each firing volleys until it is brought down.
  const barrage = !!g.event && g.event.id === 'dive-circus' && (g.enc?.setup.rev ?? 0) >= 4 && g.map.id === 'rigs';
  // (Log v67: a Dreadnought's gun turret is a target like a launcher: worth a shot while it fires.)
  const strikers = live.filter((t) => !isStructure(t.kind) || t.tow !== undefined || t.kind === 'turret' || (barrage && t.kind === 'rig'));
  const rail = !!held(g, 'railgun');
  const structures = live.filter((t) => isStructure(t.kind) && t.kind !== 'turret' && t.tow === undefined && !(barrage && t.kind === 'rig') && hittable(g, t));
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
  // Log v57: a branch burning at its mouth (the Delta's incendiaries and its
  // boss's oil) is as hot as a raid on it: a player sends the ships round.
  const heat = fork.lanes.map((lane) => g.threats.filter((t) => !t.dead && g.ships.some((s) => s.id === t.target && s.channel === lane)).length + (branchBurning(g, lane) ? 6 : 0));
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

/** Log v60 (The Citadel, MAP_SIGNATURE `dome`): is this the Citadel's own
 *  fire, inside the dome while the shield stands (it can't be shot)? */
export function domed(g: Game, th: Threat): boolean {
  const s = g.map.shield;
  return !!th.dome && !!s && !th.dead && dist(th.x, th.y, s.x, s.y) <= s.r && shieldUp(g);
}

/** Log v67: has the Citadel fallen (and not been rebuilt)? */
export function citadelDown(g: Game): boolean {
  return g.map.bases.some((b, i) => !!b.core && g.baseDown[i]);
}

/** Log v60 (SHIELD_RISES): does this run raise the Citadel's shield again
 *  every wave (the map card under its encounter layer)? */
export function shieldRises(g: Game): boolean {
  return !!g.enc && shieldRisesOn(g.map.id, g.enc.setup);
}

/** Log v60 (The Citadel): the shield rises again: every generator brought
 *  down stands again with `gen` shots, and a silenced Citadel is manned
 *  again with `core` (the boss rounds' own numbers, or CITADEL's). The
 *  generators and the Citadel still standing keep what they have. */
export function raiseShield(g: Game, gen: number, core: number): boolean {
  let rose = false;
  let returned = false;
  g.map.bases.forEach((b, i) => {
    const kind: ThreatKind | null = b.generator ? 'generator' : b.core ? 'citadel' : null;
    if (!kind) return;
    const standing = g.threats.find((t) => !t.dead && t.kind === kind && t.base === i);
    if (standing) {
      // Log v67: one still up for the boss round is brought down to the
      // round's own numbers (a Citadel worn down over the waves keeps what
      // is left of its 70, up to the round's).
      const cap = kind === 'generator' ? gen : core;
      if (standing.hp > cap) standing.hp = cap;
      if ((standing.maxHp ?? Infinity) > cap) standing.maxHp = cap;
      return;
    }
    g.baseDown[i] = false;
    const th = structure(g, kind, b.x, b.y, kind === 'generator' ? gen : core, i);
    th.maxHp = th.hp;
    g.threats.push(th);
    if (g.tel) g.tel.spawn(g, th, 'structure');
    addFx(g, 'emp', b.x, b.y, { life: 0.8, r: kind === 'citadel' ? 90 : 46 });
    if (kind === 'citadel') returned = true;
    rose = true;
  });
  const s = g.map.shield;
  if (rose) g.cit.domeUpAt = g.t;
  if (rose && s) addFx(g, 'text', s.x, s.y - s.r - 18, { life: 2.6, text: returned ? 'THE CITADEL RETURNS' : 'SHIELD RAISED' });
  return rose;
}

const STRUCTURE_DOWN: Partial<Record<ThreatKind, string>> = {
  rig: 'RIG DESTROYED',
  generator: 'GENERATOR DOWN',
  citadel: 'CITADEL SILENCED',
  dreadnought: 'DREADNOUGHT SUNK',
  turret: 'TURRET DOWN',
};

/** A structure falls: its base launches no more, and it goes up in a big
 *  explosion with its name. The last generator drops the shield. */
function structureDown(g: Game, th: Threat): void {
  if (th.base !== undefined) g.baseDown[th.base] = true;
  // A missile still arming on it goes up with it (round 13).
  scrubRacked(g, (m) => m.from === th.id || (th.base !== undefined && dist(m.x, m.y, th.x, th.y) < 2));
  addFx(g, 'boom', th.x, th.y, { life: 1.2, r: 70 });
  addFx(g, th.kind === 'dreadnought' ? 'sink' : 'burst', th.x, th.y, { life: 1.4, r: 60 });
  const shieldFalls = th.kind === 'generator' && !shieldUp(g) && !!g.map.shield;
  if (shieldFalls) g.cit.domeDownAt = g.t;
  if (th.kind === 'citadel') g.cit.fellAt = g.t;
  const label = shieldFalls ? 'SHIELD DOWN' : th.tow !== undefined ? 'TOW SUNK' : STRUCTURE_DOWN[th.kind] ?? 'DESTROYED';
  cue(g, 'structure.down', th.x, th.y);
  if (shieldFalls) cue(g, 'shield.down', th.x, th.y);
  g.events.push({ kind: 'bigKill', label, x: th.x, y: th.y });
}

/** The Dreadnought steams in from the right edge for this wave (log v51,
 *  lab only: a pass of its own, `pass`; Dreadnought Pass's boss rounds
 *  send it too, sim/events.ts). */
export function launchBoss(g: Game, pass?: DreadPass): Threat {
  const boss = g.map.boss!;
  if (!g.event) g.bossWave = g.wave;
  const p = boss.path[0];
  const th = structure(g, 'dreadnought', p.x, p.y, pass?.hp ?? boss.hp);
  th.along = 0;
  th.fireT = pass?.first ?? BOSS.firstShot;
  if (pass) {
    th.dread = pass;
    th.maxHp = pass.hp;
    if (pass.speed) th.speed = pass.speed;
  }
  if (!g.seen.has('dreadnought')) {
    g.seen.add('dreadnought');
    g.events.push({ kind: 'debut', threat: 'dreadnought' });
  }
  g.threats.push(th);
  if (g.tel) g.tel.spawn(g, th, 'structure');
  // Log v67 (under the encounter layer): its artillery is three turrets on
  // the deck, targets the player can shoot out.
  if (pass) {
    const every = turretEvery(pass);
    TURRET.slots.forEach((_, i) => {
      const t = structure(g, 'turret', th.x, th.y, TURRET.hp);
      t.from = th.id;
      t.slot = i;
      t.rot = Math.PI;
      t.fireT = (pass.first ?? BOSS.firstShot) + (i * every) / TURRET.slots.length;
      g.threats.push(t);
      if (g.tel) g.tel.spawn(g, t, 'structure');
    });
  }
  g.events.push({ kind: 'boss' });
  cue(g, 'boss.horn', p.x, p.y);
  return th;
}

/** The Dreadnought's course: the map's (east to west down the deep
 *  channel), or (log v51) a glimpse's, in to its turn and back out east. */
function dreadPath(g: Game, th: Threat): Point[] {
  const path = g.map.boss!.path;
  const turn = th.dread?.turn;
  return turn === undefined ? path : [path[0], { x: turn, y: path[0].y }, path[0]];
}

/** Along its path, firing a broadside every BOSS.every s; off the far end
 *  it is gone (no kill). Log v51 (lab only): its pass's own broadside,
 *  cadence and aim, and a pass that heaves to on station for a while. */
function updateBoss(g: Game, th: Threat, dt: number): void {
  const path = dreadPath(g, th);
  const P = th.dread;
  const station = P?.hold ? Math.abs(path[0].x - P.hold[0]) : Infinity;
  if (P?.hold && th.holdT === undefined && (th.along ?? 0) + th.speed * dt >= station) {
    th.along = station;
    th.holdT = P.hold[1];
  }
  if (th.holdT !== undefined && th.holdT > 0) {
    th.holdT -= dt;
    if (th.holdT <= 0) th.speed *= P?.dash ?? 1;
  } else th.along = (th.along ?? 0) + th.speed * dt;
  const p = alongPath(path, th.along!);
  th.x = p.x;
  th.y = p.y;
  th.heading = p.heading;
  th.age += 0;
  if (th.along! >= pathLength(path)) {
    th.dead = true;
    return;
  }
  th.fireT = (th.fireT ?? BOSS.every) - dt;
  if (th.fireT > 0 || th.x > VIEW.width - 40 || th.x < 40) return;
  th.fireT = P?.every ?? BOSS.every;
  // Log v67 (under the layer): the artillery shells come off the turrets
  // (updateTurret); the silo launches the rest, its hatches already open.
  const kinds: readonly ThreatKind[] = (P?.broadside ?? BOSS.broadside).filter((k) => !P || k !== 'ballistic');
  if (P && !kinds.length) return;
  const apart = P ? 16 : kinds.length > 3 ? 40 : 60;
  const sx = P ? th.x + Math.cos(th.heading) * TURRET.silo : th.x;
  const sy = P ? th.y + Math.sin(th.heading) * TURRET.silo : th.y;
  if (P) th.shotT = g.t;
  kinds.forEach((kind, k) => {
    const off = (k - (kinds.length - 1) / 2) * apart;
    const m = spawnThreat(g, kind, P ? sx + Math.cos(th.heading) * off : th.x + off, P ? sy + Math.sin(th.heading) * off : th.y, 'base');
    m.from = th.id;
    if (P) {
      m.parent = 'dreadnought';
      // Log v51: the drones off its deck go for the carrier (they count
      // in the wave, they do not sink a ship); its guns at the ships.
      if (kind === 'drone') {
        m.target = CARRIER_TARGET;
        const tp = targetPos(g, m);
        m.heading = Math.atan2(tp.y - m.y, tp.x - m.x);
      } else if (P.aim) aimBeat(g, m, P.aim);
    }
  });
  addFx(g, 'launch', sx, sy, { life: 0.6, r: P ? 30 : 40 });
  cue(g, 'boss.broadside', sx, sy);
}

/** Seconds between one turret's shells on a pass (TURRET.slow x its broadside
 *  cadence; a glimpse, the first wave's teaching pass, three times slower; a
 *  boss round's battleship, heaving to on station, TURRET.bossQuick x faster). */
function turretEvery(P: DreadPass | undefined): number {
  return (P?.every ?? BOSS.every) * TURRET.slow * (P?.turn !== undefined ? 3 : 1) * (P?.hold ? TURRET.bossQuick : 1);
}

/** Log v67 (Dreadnought Pass, TURRET): a gun turret rides its ship's deck,
 *  trains on the ship nearest it, and fires an artillery shell (a ballistic
 *  missile, aimed as the pass aims its broadsides) every `slow` x the pass's
 *  cadence, off its own clock. Shot out, it fires no more; the ship sunk or
 *  gone, it goes with it. */
function updateTurret(g: Game, th: Threat, dt: number): void {
  const ship = g.threats.find((t) => t.id === th.from && t.kind === 'dreadnought');
  if (!ship || ship.dead) {
    th.dead = true;
    return;
  }
  const lx = TURRET.slots[th.slot ?? 0];
  th.x = ship.x + Math.cos(ship.heading) * lx;
  th.y = ship.y + Math.sin(ship.heading) * lx;
  th.heading = ship.heading;
  // Train on the nearest ship (the carrier when none sails).
  const pool = targetable(g);
  let want = th.rot ?? ship.heading;
  if (pool.length) {
    const near = pool.reduce((a, b) => (dist(b.x, b.y, th.x, th.y) < dist(a.x, a.y, th.x, th.y) ? b : a));
    want = Math.atan2(near.y - th.y, near.x - th.x);
  }
  th.rot = (th.rot ?? ship.heading) + clamp(angleDiff(want, th.rot ?? ship.heading), -TURRET.turn * dt, TURRET.turn * dt);
  th.fireT = Math.max(0, (th.fireT ?? 0) - dt);
  if (th.fireT > 0 || th.x > VIEW.width - 40 || th.x < 40) return;
  const P = ship.dread;
  th.fireT = turretEvery(P);
  th.shotT = g.t;
  const mx = th.x + Math.cos(th.rot) * 30;
  const my = th.y + Math.sin(th.rot) * 30;
  const m = spawnThreat(g, 'ballistic', mx, my, 'base');
  m.from = ship.id;
  m.parent = 'dreadnought';
  if (P?.aim) aimBeat(g, m, P.aim);
  th.rot = Math.atan2(m.iy - th.y, m.ix - th.x);
  addFx(g, 'launch', mx, my, { life: 0.3, r: 14 });
  cue(g, 'boss.broadside', th.x, th.y);
}

/** A mine drifts on the current (with a little wobble), blows up the first
 *  hull it touches, and is gone off the edge of the screen. */
function updateMine(g: Game, th: Threat, dt: number): void {
  const c = g.map.current ?? { x: 0, y: 1 };
  const k = th.speed / (Math.hypot(c.x, c.y) || 1);
  if (th.hidden && (g.steps + th.id) % 3 === 0 && mineNear(g, th, c.x * k, c.y * k)) surfaceMine(g, th);
  // Log v55: a hidden mine that has drifted past every lane is gone (out of
  // sight it would only hold the wave open, drifting on to the edge).
  if (th.hidden && g.map.channels.every((ch) => th.y > ch.y + ch.halfWidth + 60)) {
    th.dead = true;
    return;
  }
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
    damageShip(g, s, THREATS.mine.damage, 'mine', true, g.tel?.impact(th.id, th.x, th.y));
    return;
  }
  if (onCarrier(g, th.x, th.y)) {
    th.dead = true;
    addFx(g, 'splash', th.x, th.y, { life: 0.9, r: 46 });
    cue(g, 'mine.blast', th.x, th.y);
    damageCarrier(g, 1, 'mine', g.tel?.impact(th.id, th.x, th.y));
  }
}

/** Log v55 (round 15, the player: "that button should glow when it is
 *  advantageous to use it, like when a ship is about to hit a mine"): is
 *  now a moment for this convoy command? For Hold: a mine in sight that a
 *  ship will sail onto within ADVISE.mine s, or a shell in the air aimed
 *  at water a ship has still to reach (held, the ship is not there when it
 *  lands). Never while the command is on or cannot be given. Read by the
 *  big command button and by the bots' sharp pilot alike. */
export function commandAdvised(g: Game, id: CommandId): boolean {
  if (g.phase !== 'wave') return false;
  const st = commandState(g, id);
  if (!st.ready || st.active) return false;
  if (id !== 'hold') return false;
  for (const th of g.threats) {
    if (!released(th)) continue;
    if (th.kind === 'mine') {
      if (mineEta(g, th) <= ADVISE.mine) return true;
      continue;
    }
    if (th.kind !== 'ballistic' || th.target < 0) continue;
    const left = th.dur - th.age;
    if (left < ADVISE.shell[0] || left > ADVISE.shell[1]) continue;
    const s = g.ships.find((o) => o.id === th.target);
    if (s && dist(s.x, s.y, th.ix, th.iy) > BALLISTIC.splash + 10) return true;
  }
  return false;
}

/** When a command is advised (commandAdvised): a mine this many seconds
 *  from a hull; a shell with this long still to fly. */
const ADVISE = { mine: 2.6, shell: [0.6, 3] as const };

/** Log v66: does this game's map hold its ships back from mines by itself
 *  (the map's convoy `autoHold`, a lab convoy setup)? */
export function autoHold(g: Game): boolean {
  return !!g.convoy?.def.autoHold;
}

/** Log v66 (the player: "make the vault command automatic... right before
 *  the ships collided with the mine, about 1/3 the spotting distance, the
 *  ship in the path will pause until that mine is gone or shot down"): 0 for
 *  a ship whose course, sailing on, would put it on a mine in sight within
 *  MINE.surface * MINE.holdShare s; it waits where it is (every hull but the
 *  ones behind it, which queue) until that mine is shot or has drifted past
 *  its course, then sails on. 1 for every other ship. */
function minePace(g: Game, s: Ship, mines: Threat[]): number {
  s.mineHold = false;
  if (!mines.length) return 1;
  const T = MINE.surface * MINE.holdShare;
  const c = g.map.current ?? { x: 0, y: 1 };
  for (const th of mines) {
    const k = th.speed / (Math.hypot(c.x, c.y) || 1);
    const reach = MINE.hitRadius + (s.vip ? 24 : 0) + 6;
    for (let t = 0; t <= T + 1e-9; t += 0.15) {
      const p = shipAhead(g, s, t);
      if (dist(p.x, p.y, th.x + c.x * k * t, th.y + c.y * k * t) <= reach) {
        s.mineHold = true;
        return 0;
      }
    }
  }
  return 1;
}

/** Log v55 (round 15, HIDDEN_MINES): do this map's mines drift hidden? */
export function hiddenMines(g: Game): boolean {
  return !!g.enc && hiddenMinesOn(g.map.id, g.enc.setup);
}

/** Would a ship's course (or the carrier) bring it onto this mine within
 *  MINE.surface s, the mine drifting at (vx, vy)? (Log v55: then it
 *  surfaces, in that ship's path.) */
function mineNear(g: Game, th: Threat, vx: number, vy: number): boolean {
  const S = MINE.surface;
  for (const s of g.ships) {
    const reach = MINE.hitRadius + (s.vip ? 24 : 0) + 4;
    if (dist(s.x, s.y, th.x, th.y) > reach + S * (SHIP.speed * g.waveSpeed * 1.5 + th.speed)) continue;
    // Sailing on, or (held, or stopped behind the ship ahead) where it is.
    for (let t = 0; t <= S + 1e-9; t += 0.15) {
      const p = shipAhead(g, s, t);
      const mx = th.x + vx * t;
      const my = th.y + vy * t;
      if (dist(p.x, p.y, mx, my) <= reach || dist(s.x, s.y, mx, my) <= reach) return true;
    }
  }
  return onCarrier(g, th.x + vx * S, th.y + vy * S);
}

/** A hidden mine surfaces (log v55): in sight, a target, with a splash. */
function surfaceMine(g: Game, th: Threat): void {
  th.hidden = false;
  th.surfacedT = g.t;
  addFx(g, 'splash', th.x, th.y, { life: 0.7, r: 34 });
  cue(g, 'mine.drop', th.x, th.y);
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
 *  LOCK.outTime s, until the chamber is empty. A hull goes in only while
 *  its file in the chamber has room (stopAt), so the gateway clears once
 *  the chamber is full. The backstop: LOCK.grace s past LOCK.inTime the
 *  entry shuts even on a hull still in its gateway. That hull is past the
 *  waiting spot, so it counts as in the chamber: it waits at the exit with
 *  the rest and leaves with them (it can't be sent back: hulls only sail
 *  forward). The exit needs no backstop: it waits only for hulls sailing
 *  out, which nothing holds but the next lock's queue, and that lock has
 *  its own. */
function updateLocks(g: Game, dt: number): void {
  g.map.locks?.forEach((lock, i) => {
    const st = g.lockState[i];
    st.t += dt;
    // Any hull from `lo` past the entry gate to `hi` past it (Infinity: up
    // to the exit gate).
    const inside = (lo: number, hi: number) =>
      g.ships.some((s) => {
        const ch = g.map.channels[s.channel];
        const d0 = laneDAtX(ch, lock.x0);
        const d1 = laneDAtX(ch, lock.x1);
        if (d0 === null || d1 === null) return false;
        return s.d >= d0 + lo && s.d < (hi === Infinity ? d1 : d0 + hi);
      });
    // (A hull waiting at the entry, LOCK.stand short of the gate, is not in
    // its gateway.)
    if (st.phase === 'in' && st.t >= LOCK.inTime && (st.t >= LOCK.inTime + LOCK.grace || !inside(-LOCK.stand + 1, LOCK.gateway))) {
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
  if (g.tel) g.tel.command(g, 'fork', (g.forkLane + 1) % fork.lanes.length, g.forkLane, true);
  g.forkLane = (g.forkLane + 1) % fork.lanes.length;
  addFx(g, 'text', fork.x, fork.y - 50, { life: 1, text: FORK_NAMES[g.forkLane] ?? 'SWITCHED' });
  g.events.push({ kind: 'fork', lane: g.forkLane });
  cue(g, 'fork.switch', fork.x, fork.y);
}

const FORK_NAMES = ['NORTH', 'MIDDLE', 'SOUTH'];

/** The lane the Delta's switch sends the next ships down (-1: no fork). */
export function switchLane(g: Game): number {
  const fork = g.map.fork;
  return fork ? fork.lanes[g.forkLane % fork.lanes.length] : -1;
}

/** How far past the buoy, along a branch, its mouth is: where the Delta's
 *  incendiaries burst and its boss's burning oil lies (log v57), clear of
 *  the river the three branches share. */
export const FORK_MOUTH = 270;

/** The mouth of a branch of the Delta's fork (its lane's index): on the
 *  branch FORK_MOUTH px past the buoy. */
export function branchMouth(g: Game, lane: number): Point {
  const fork = g.map.fork!;
  const ch = g.map.channels[lane];
  const d0 = laneDAtX(ch, fork.x) ?? 0;
  const p = laneAt(ch, d0 + FORK_MOUTH, 0);
  return { x: p.x, y: p.y };
}

/** Is a branch of the fork burning at its mouth (a fireball on the water
 *  there: an incendiary's, or the boss's burning oil)? */
export function branchBurning(g: Game, lane: number): boolean {
  if (!g.map.fork) return false;
  const m = branchMouth(g, lane);
  return g.foe.marks.some((k) => k.kind === 'fire' && k.t < k.dur - 2 && dist(k.x, k.y, m.x, m.y) <= 90);
}

// ---------------------------------------------------------------------------
// Pickups

/** How long a pickup floats before it is gone. */
export function pickupLife(p: Pickup): number {
  return p.kind === 'weapon' ? WEAPON.life : PICKUPS.life;
}

function updatePickups(g: Game, dt: number): void {
  // Under a parachute: drifting down, not yet ageing. (Supply Run's drops
  // used to fly to the carrier; Test Lab round 5 took that out: "especially
  // if the player does not want the power up". You tap what you want.)
  for (const p of g.pickups) {
    if (!p.chute) continue;
    p.chute = Math.max(0, p.chute - dt);
    p.y += 45 * dt;
  }
  // A pickup locked by a Scavenger's ring (round 8) waits: it doesn't age
  // until the drone is gone.
  for (const p of g.pickups) if (!p.chute && !pickupLocked(g, p)) p.age += dt;
  for (const p of g.pickups) {
    if (p.age < pickupLife(p)) continue;
    if (g.tel) g.tel.pickupOut(g, p, 'expired');
    cue(g, 'powerup.expire', p.x, p.y);
  }
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
  // A boost that is calling a weapon gets one; the boost already running
  // isn't dealt again.
  const want = callsWeapon(g) && weaponsHeld(g).length ? weaponsHeld(g) : g.slots.filter((id) => id !== g.boost?.id);
  addPickup(g, 'weapon', x, y, g.rng.drops.pick(want.length ? want : g.slots));
}

/** The power-ups that became boosts (phase 3). (Time Warp's power-up has
 *  no boost since Test Lab round 5 cut it: its weight is 0.) */
const BOOSTED_POWERS: [PowerKind, AbilityId][] = [['overdrive', 'overdrive'], ['shield', 'shield'], ['steam', 'fullSteam']];

/** A kill drops a power-up, picked by PICKUPS.weights. */
function dropPickup(g: Game, x: number, y: number): void {
  // Log v67 (the player: "there should not be a light drop it should always be
  // dark"): the Black Strait and Blackout drop no Star Shell.
  const base = PICKUPS.weights;
  // The Nuke: not before wave nukeFrom, and one on the water at a time.
  const w = g.wave < PICKUPS.nukeFrom || g.pickups.some((p) => p.kind === 'nuke') ? { ...base, nuke: 0 } : { ...base };
  // The power-ups that became boosts leave the drops once their boost is
  // live (Free Play: now, so it plays the plan's rules).
  for (const [k, id] of BOOSTED_POWERS) if (g.freePlay || ROSTER[id].status === 'live') w[k] = 0;
  eventDropWeights(g, w);
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

export function addPickup(g: Game, kind: PickupKind, x: number, y: number, weapon?: AbilityId, why: 'drop' | 'plane' | 'tanker' | 'lab' | 'event' = 'drop'): void {
  // No Nuke appears during a special event (Test Lab round 6: "no nukes for
  // these special events"), whatever would drop one: the drop table and the
  // cargo already leave it out; anything else gets a repair in its place.
  if (kind === 'nuke' && g.event) kind = 'repair';
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
  if (g.tel) g.tel.pickupIn(g, g.pickups[g.pickups.length - 1], why);
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
  if (g.tel) g.tel.pickupOut(g, p, 'collected');
  g.events.push({ kind: 'pickup', pickup: p.kind });
  if (p.kind === 'weapon') {
    // Loads the gun for weaponTime (WEAPON.time, more with Long Loads; the
    // same weapon again: a fresh clock;
    // another one: it takes over). One you swapped out loads nothing.
    const id = p.weapon!;
    const level = g.levels[id] ?? 0;
    if (level <= 0) return;
    // Long Loads (the Armory overhaul): every weapon or boost pickup also
    // puts rounds back in the rack, the whole rack at level 5.
    if (g.stats.refill > 0) g.ammo = Math.min(g.stats.rack, g.ammo + g.stats.refill);
    // A boost runs beside whatever is loaded (phase 3).
    if (isBoost(id)) {
      startBoost(g, id, level, p.x, p.y);
      return;
    }
    const w: Weapon = { id, level, t: g.stats.weaponTime, t0: g.t };
    // Dual Wield: it joins the loaded weapon; otherwise it takes the gun.
    if (!boostLoad(g, w)) g.weapon = w;
    if (id === 'cadence') g.beat = { last: -9, run: 0, armed: false, seen: -1 };
    // The same passive Wild Card brought is now loaded for real: the
    // loaded one takes over (no second set of frigates).
    if (g.wildPassive?.id === id) g.wildPassive = null;
    startPassive(g, w);
    g.uses[id] = (g.uses[id] ?? 0) + 1;
    g.events.push({ kind: 'weapon', id, level: w.level });
    cue(g, 'weapon.load', p.x, p.y);
    addFx(g, 'text', p.x, p.y - 20, { life: 1.1, text: abilityName(id, w.level).toUpperCase() + (g.weapon2 === w ? ' + ' + abilityName(g.weapon!.id, g.weapon!.level).toUpperCase() : '') });
    // Wild Card from level 2: its pickup brings one random passive too.
    if (id === 'wildCard' && w.level >= 2) wildPassive(g, w.level, p.x, p.y);
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
      if (hurt) {
        const to = Math.min(max, hurt.hp + PICKUPS.repairHp);
        if (g.tel) g.tel.heal(g, 's', hurt.id, to - hurt.hp, to, 'repair');
        hurt.hp = to;
      } else {
        const to = Math.min(g.stats.carrierHp, g.carrierHp + PICKUPS.carrierRepairHp);
        if (g.tel) g.tel.heal(g, 'c', 0, to - g.carrierHp, to, 'repair');
        g.carrierHp = to;
      }
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
      g.steamT = PICKUPS.steamTime * g.stats.powerTime * g.stats.steamTime;
      break;
    case 'starshell':
      g.flareT = PICKUPS.starshellTime * g.stats.powerTime;
      break;
    case 'nuke':
      nuke(g);
      break;
  }
}

/** The Nuke: every enemy unit and munition on the map is destroyed (no
 *  drops: a screen-clear isn't a loot shower). Test Lab round 1 ("blow up
 *  everything on the screen, even the trucks, submarines, any of the
 *  vehicles") made it take the launch trucks, subs, every new enemy
 *  platform and every warning circle and shot on the water. Round 13 (the
 *  player, The Strait, wave 8: "The nuke should blow up everything on the
 *  map, even the launcher trucks, even after it left"): no exceptions left.
 *  - The whole map, not just the screen: a rocket truck driving in or
 *    driving off after its salvo, a helicopter or a plane still coming in
 *    from off the edge, a popup truck reversing back up its road.
 *  - Launchers in every state: a sub still at periscope depth or diving, a
 *    siege gun down in its hatch, a Spotter away between turns.
 *  - Munitions still on their launcher (a supersonic arming on its rail).
 *  Each dies as any kill does (its explosion, its kill counted as the
 *  Nuke's); a launcher of the old kind (Raider) is knocked out as a Carpet
 *  Strike knocks it out. The one exception, as before: structures (rigs,
 *  generators, the Citadel) and the Dreadnought boss take nukeStructure
 *  hits (the player's own pick in the weapons review: "3 hits, not a
 *  kill"), wherever they are. Launch sites with nothing on them to shoot
 *  (plain silos and coves) can't be destroyed anywhere in the game. */
function nuke(g: Game): void {
  const c = g.map.carrier;
  nukeFoes(g);
  // The Lure Beacon takes only the player's own hand; the Nuke is that.
  const byTap = g.foe.byTap;
  g.foe.byTap = true;
  for (const th of [...g.threats]) {
    if (th.dead) continue;
    if (isStructure(th.kind)) damageThreat(g, th, PICKUPS.nukeStructure, false, 'nuke');
    else damageThreat(g, th, th.hp + 99, false, 'nuke');
  }
  g.foe.byTap = byTap;
  // Every launcher still on the map (one already knocked out is gone).
  for (const r of g.raiders) if (r.state !== 'reverse' || r.dist > 0) knockOut(g, r);
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
  turret: 'structure.down',
  // The enemy build.
  sprinter: 'kill.small',
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
  g.fx.push({ kind, x, y, x2: o.x2 ?? x, y2: o.y2 ?? y, r: o.r ?? 0, age: 0, life: o.life, text: o.text, ...(twinSide ? { twin: true } : {}) });
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
    if (raid.quiet) continue;
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
  // Log v67: a gun turret is as urgent as its next shell is near.
  if (th.kind === 'turret') return (th.fireT ?? 9) + 3;
  if (isStructure(th.kind)) return 99;
  // Inside a standing radar's sweep it flies slowed (log v29): the time
  // left as if it stays slowed (the bots and the warnings read it).
  if (g.map.posts && released(th) && th.kind !== 'mine' && tracked(g, th)) return rawTti(g, th) / POST.radarSlow;
  return rawTti(g, th);
}

function rawTti(g: Game, th: Threat): number {
  if (th.kind === 'mine') return mineEta(g, th);
  if (th.kind === 'ballistic') return Math.max(0, th.dur - th.age);
  if (th.kind === 'fastboat' && th.boat) return boatEta(g, th);
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
  const arming = th.kind === 'supersonic' ? supersonicDelay(th.age) : 0;
  return arming + dist(th.x, th.y, t.x, t.y) / th.speed;
}
