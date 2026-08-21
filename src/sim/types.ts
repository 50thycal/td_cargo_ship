// Shared type definitions for the entire simulation. The sim layer never
// touches the DOM — every type here is plain data so the core can be ported
// to another engine (SpriteKit, Godot) without changes to the design.

import type { Geography } from '../data/geography';
import type { StatTier } from '../data/statTiers';

// ---------------------------------------------------------------------------
// Ships
// ---------------------------------------------------------------------------

export type ShipClassId = 'cargo' | 'tanker' | 'freighter';

export interface ShipClassDef {
  id: ShipClassId;
  name: string;
  /** Hit points. */
  hp: number;
  /** Max speed in world units / second. */
  speed: number;
  /** Cargo value in delivery points (also drives cash payout). */
  value: number;
  /** Module slots. */
  slots: number;
  /** Collision/visual radius in world units. */
  radius: number;
  /** Hull length in world units, used to size minimum following distance. */
  length: number;
  /** Cost to purchase a replacement hull. */
  replaceCost: number;
  /** Tankers explode on death, damaging nearby ships. */
  explodes?: { damage: number; radius: number };
}

/** Cargo-ship module ids. `selfDefense` is the evolved point-defense turret
 *  (old saves' `pointDefense` migrates into it). */
export type ModuleId =
  | 'selfDefense'
  | 'missileWarning'
  | 'reinforcedHull'
  | 'mineSonar'
  | 'fireSuppression'
  | 'hydrophone'
  | 'thermalImaging'
  | 'flak'
  | 'antiBoarding'
  | 'compartmentalization';

/** Optional escort systems. Escort missile interceptors are built in; these
 *  compete for the escort loadout's limited slots. */
export type EscortModuleId = 'deckGun' | 'mcmDroneLauncher' | 'depthCharges' | 'mineSonar';

/** Optional shore-base systems. Base missile interceptors are built in. */
export type BaseModuleId = 'counterBattery';

export interface ModuleDef {
  id: ModuleId;
  name: string;
  desc: string;
  /** Cash cost per ship equipped. */
  costPerShip: number;
}

export interface EscortModuleDef {
  id: EscortModuleId;
  name: string;
  desc: string;
  /** Flat cash cost to fit this module to ONE escort. Fitting the same module
   *  to a second escort is a second purchase — a flotilla of three gun boats
   *  costs three deck guns. */
  cost: number;
}

/** One escort in the flotilla: a persistent, individually-fitted ship rather
 *  than an anonymous slot in a count.
 *
 *  Missile interceptors are built in and are deliberately NOT in `modules` —
 *  they are not optional, they cost nothing, and they never occupy a slot. */
export interface EscortUnit {
  /** Stable for the escort's whole life, so damage, name and loadout follow
   *  the same ship between rounds and the right one is removed when it sinks. */
  id: number;
  /** Player-set, sanitised and length-limited (see ESCORT_NAME_MAX). */
  name: string;
  /** Optional specialist systems fitted to THIS escort. Capped by the escort's
   *  unlocked slot count; several escorts may carry the same module. */
  modules: EscortModuleId[];
  /** Unrepaired hull damage this escort is carrying into the next round. */
  damage: number;
  /** The escort legacy this ship carries, assigned when she was commissioned.
   *  Her loss burns it for the rest of the region — see spendEscortLegacy. */
  legacy?: string;
}

export interface BaseModuleDef {
  id: BaseModuleId;
  name: string;
  desc: string;
  cost: number;
}

export interface Ship {
  id: number;
  name: string;
  classId: ShipClassId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  delivered: boolean;
  modules: ModuleId[];
  /** Scheduled time (seconds into the transit) this ship enters the corridor. */
  spawnTime: number;
  /** True once the ship has actually entered the world at its spawn time. */
  spawned: boolean;
  /** The corridor lane this ship holds. Assigned at spawn; not player-editable
   *  (cargo ships steer themselves — only escorts are player-directed). */
  laneIndex: number;
  /** Persistent per-ship lateral offset seed in [-1, 1], scaled by the
   *  formation's spread — keeps the stream from looking like a rigid grid. */
  lateralSeed: number;
  /** Persistent per-ship pace variance (~1 ± a few %) so ships don't all
   *  move in perfect lockstep. */
  speedVariance: number;
  /** Facing angle in radians (0 = due east). The ship moves along this heading
   *  and turns toward it under a turn-rate limit, so course changes are smooth
   *  realistic arcs. */
  heading: number;
  /** Current forward speed (world units/second). Changes are acceleration-
   *  limited so ships ease up and slow down smoothly rather than snapping. */
  speed: number;
  /** Seconds of burning remaining (damage over time). */
  fireSeconds: number;
  /** Self-defense interceptor cooldown timer. */
  pdCooldown: number;
  /** Self-defense interceptor shots remaining this transit. Refills each
   *  round; a hard per-transit magazine so ship self-defense is a limited
   *  resource, not a free auto-turret. Only meaningful when the ship carries a
   *  selfDefense module. */
  pdShots: number;
  /** Anti-air flak shots remaining this transit (flak module magazine). */
  flakShots: number;
  /** Flak cooldown timer. */
  flakCooldown: number;
  /** Track-breaking smoke: enemy re-acquisition ignores this ship until this
   *  transit time (refreshed while inside a player smoke cloud). */
  smokeGraceUntil: number;
  /** True when the ship has fallen well behind its own expected pace
   *  (damage or being blocked by another ship), not behind a formation slot. */
  straggling: boolean;
  /** Seconds this hull has spent held near a standstill for crossing traffic,
   *  and whether it has given up waiting and gone back to steering around.
   *  Give-way is a courtesy with a time limit — see NAV.giveWay.maxHoldSeconds. */
  giveWayHold: number;
  giveWayExhausted: boolean;
  /** Seconds a boarding party has held this hull. Reset whenever the boarding
   *  boat is driven off, so an interrupted boarding genuinely costs the enemy
   *  its progress rather than merely pausing it. */
  boardingSeconds: number;
  /** Transit time until which Citadel Lockdown has boarding progress frozen. */
  boardingLockUntil: number;
  /** Lockdown and Emergency Rejection are once-per-round per hull, so a ship
   *  cannot stall an unlimited number of boarding attempts by itself. */
  lockdownUsed: boolean;
  rejectionUsed: boolean;
  /** Damage this hull has taken, keyed by the enemy branch that dealt it. When
   *  the ship finally dies the kill is split across these in proportion, so a
   *  branch that did the work gets the credit even if something else landed the
   *  last blow. */
  damageByBranch: Record<string, number>;
  /** Set when a boarding party has taken the hull. A captured ship is a LOSS —
   *  it is not sunk, it steers off to the hostile shore under a prize crew and
   *  costs more confidence than a sinking, so "tank the damage and push
   *  through" is not an answer to this branch. */
  captured: boolean;
  /** Transit time at which a captured hull finishes leaving the board. */
  captureExitAt: number;
  /** Dead in the water until this transit time (a disabling drone got her).
   *  She keeps her hull and her cargo but cannot move — a static target for
   *  everything else on the board. */
  disabledUntil: number;
}

// ---------------------------------------------------------------------------
// Formations
// ---------------------------------------------------------------------------

export type FormationId = 'tight' | 'wide' | 'sprint';

/** How a tap on a cluster of missiles picks which one to target:
 *   • proximity     — nearest to the tap wins (the long-standing default).
 *   • protectShips  — missiles aimed at a ship/escort always outrank ones
 *     aimed at a shore battery (the battery can absorb a hit; a ship can't).
 *   • threat        — guided (advanced) missiles always outrank unguided ones.
 *  In every mode, a threat with no interceptor already inbound still beats one
 *  that already has a shot on the way, as a secondary tiebreak. */
export type TargetPriority = 'proximity' | 'protectShips' | 'threat';

export interface FormationDef {
  id: FormationId;
  name: string;
  desc: string;
  /** Convoy speed multiplier. */
  speedMult: number;
  /** Half-range (world units) of each ship's persistent lateral jitter
   *  around its lane center — the wider this is, the less rigid the stream
   *  looks. Never affects the hard minimum-separation floor. */
  lateralSpread: number;
  /** Extra along-track buffer (world units) added on top of the
   *  two-ship-length minimum gap enforced between consecutive ships. */
  gapBonus: number;
  /** Multiplier on splash / tanker-explosion collateral radius. */
  collateralMult: number;
  /** Added to player interceptor hit chance — a concentrated column's overlapping
   *  fire is more accurate (Tight +, Wide −). */
  interceptAccuracy: number;
  /** Multiplier on defensive REACH: self-defense radius and escort interceptor
   *  range. Tight overlaps coverage (>1); Wide stretches it thin (<1). */
  defenseRangeMult: number;
  /** Radius (world units) of the bonus splash a DIRECT missile/guided hit deals
   *  to neighboring hulls — the downside of bunching up. 0 = hits stay isolated. */
  chainSplashRadius: number;
}

// ---------------------------------------------------------------------------
// Threats
// ---------------------------------------------------------------------------

/** Every threat kind the player-counter layer recognizes. Kinds mirror the
 *  enemy branches in docs/ENEMY_ATTACKS.md one-to-one; node variants within a
 *  branch (guided/homing/low-signature/boarding …) are flags on the Threat,
 *  not separate kinds. `torpedo`, `attackBoat`, `reconPlane` and
 *  `disablingDrone` are COMPATIBILITY kinds: the counter layer validates
 *  against them today, while the enemy-side implementation that spawns them
 *  lands in a later pass. Sensor jamming is deliberately NOT a threat kind —
 *  it is an enemy ability with no shootable object (see ENEMY_ATTACKS.md). */
export type ThreatKind =
  | 'missile'
  | 'guidedMissile'
  | 'mine'
  | 'torpedo'
  | 'attackBoat'
  | 'reconPlane'
  | 'disablingDrone';

/** Attack-boat behavior variants (see ENEMY_ATTACKS.md → Attack Boats). */
export type BoatVariant = 'smallArms' | 'rocket' | 'boarding';

/** Discovery keys — includes variants that reveal enemy evolution. */
export type TechKey =
  | 'missile'
  | 'guidedMissile'
  | 'mine'
  | 'lowSigMine'
  | 'torpedo'
  | 'homingTorpedo'
  | 'lowSigTorpedo'
  | 'attackBoat'
  | 'rocketBoat'
  | 'boardingBoat'
  | 'artillery'
  | 'rangingArtillery'
  | 'rollingBarrage'
  | 'screeningSmoke'
  | 'blindingSmoke'
  | 'reconPlane'
  | 'disablingDrone'
  | 'sensorJamming'
  | 'saturation';

/** What a missile is aimed at. Escorts and shore batteries are valid targets
 *  now, not just cargo ships. */
export type TargetKind = 'ship' | 'escort' | 'base';

export interface Threat {
  id: number;
  kind: ThreatKind;
  x: number;
  y: number;
  /** Current velocity (missiles). */
  vx: number;
  vy: number;
  speed: number;
  alive: boolean;
  /** What this missile is aimed at (default 'ship'). */
  targetKind?: TargetKind;
  /** Ship this threat is homing on / was aimed at. */
  targetShipId?: number;
  /** Escort an ATTACK BOAT has committed to, when no merchant is worth
   *  hunting. Distinct from targetShipId rather than folded into it because a
   *  boat working the screen skips the whole convoy-hull path — boarding,
   *  station sharing, give-way, delivery — and conflating the two ids would
   *  have every one of those look up an escort in the ship list. */
  targetEscortId?: number;
  /** Escort/base this missile is aimed at (when targetKind is escort/base). */
  targetEntityId?: number;
  /** Straight-line aim point for unguided missiles. */
  targetX?: number;
  targetY?: number;
  /** Mines & torpedoes: hidden until detected.
   *
   *  For a torpedo this is permanent — once you have seen the wake you know
   *  where the weapon is going, and it is gone within the minute anyway. For a
   *  MINE it is a live contact, recomputed every tick from `revealedUntil` and
   *  whether a hull is currently holding it on sonar. A mine sits in the water
   *  all round; a fix on one goes stale exactly like a real plot does. */
  revealed: boolean;
  /** Mines: transit time until which a TIMED reveal (a scan-plane fix) holds.
   *  Sonar contact is not stored here — it is re-derived from hull positions
   *  every tick, so a mine goes dark the moment the last hull loses it. */
  revealedUntil?: number;
  /** Mines: true once this mine has been detected at least once, so the round's
   *  detection count is a count of MINES FOUND and not of contact re-acquired. */
  everRevealed?: boolean;
  /** Low-signature variants resist standard detection (mines today;
   *  wakeless torpedoes when the enemy branch lands). */
  lowSig: boolean;
  /** Set when an interceptor is currently en route to this threat. */
  claimedByInterceptor: boolean;
  // --- Compatibility fields for enemy branches designed but not yet fielded --
  /** Torpedoes: corrects toward ships (homing node). */
  homing?: boolean;
  /** Mines: repositions during the round (drifting node). */
  drifting?: boolean;
  /** Missiles: low-altitude short-reaction-window profile (sea-skimming node). */
  seaSkimming?: boolean;
  /** Attack boats / aircraft: persistent sinkable units with hull points. */
  hp?: number;
  maxHp?: number;
  /** Attack boats: behavior variant (small-arms / rocket / boarding). */
  boatVariant?: BoatVariant;
  /** Escort deck gun currently committed to this boat (sustained fire). */
  engagedByEscortId?: number;
  /** True while this threat sits inside enemy smoke. A concealed threat keeps a
   *  faint bearing marker but loses its precise tap-target — the locked SOFT
   *  concealment model. It is never removed from the sim, only from the
   *  player's ability to point at it. */
  concealed?: boolean;
  /** True if this threat was concealed at any point. Support branches earn
   *  their ROI from what they enabled, so a hit that landed off a hull the
   *  player could not see pays the smoke that hid it. */
  wasConcealed?: boolean;
  /** Attack boats: transit time before which this boat will not commit to a
   *  new hull (the pause after it finishes one off). */
  retargetAt?: number;
  /** Attack boats: current facing (radians). Boats steer under a turn-rate
   *  limit rather than pointing their velocity straight at the target, so the
   *  heading is real state and not derived from vx/vy each tick. */
  heading?: number;
  /** Attack boats: the bearing off its target this boat holds station on,
   *  assigned when it commits and spaced against the boats already working
   *  that hull — so several boats surround a ship rather than stacking. */
  stationAngle?: number;
  /** Attack boats: seconds until this boat's gun may fire again. */
  fireCooldown?: number;
  /** Attack boats: true once the boat is holding station on its target and
   *  actually shooting/boarding, rather than still closing. Drives the UI tell
   *  and keeps "approaching" and "engaging" distinguishable in the sim. */
  engaging?: boolean;
  /** Self-defense modules: ship reserving this missile (coordinated fire). */
  reservedByShipId?: number;
}

/** A hostile shore installation (artillery position). The enemy pass will
 *  place these; today the array exists so counter-battery targeting and its
 *  validation are real, tested interfaces. Installations are NOT threats —
 *  counter-battery fires at the gun position, never at shells in flight. */
export interface EnemyInstallation {
  id: number;
  kind: 'artillery';
  x: number;
  y: number;
  /** Artillery node variant per ENEMY_ATTACKS.md. */
  variant: ArtilleryVariant;
  /** Transit time until which this position is suppressed (cannot fire). */
  suppressedUntil: number;
  /** Successful focused strikes accumulated (enough destroys it this round). */
  strikes: number;
  destroyed: boolean;
  /** Reload timer until this gun may fire again. */
  cooldown: number;
  /** Ship this gun is currently walking its fire onto, and how many consecutive
   *  shells it has put near it. Ranging artillery tightens its aim the longer a
   *  hull holds position; moving out of the lane resets it. */
  walkTargetShipId?: number;
  walkShots: number;
  /** Rolling barrage: shells left in the current salvo, where the sweep runs,
   *  and when the next salvo begins. */
  barrageLeft: number;
  barrageFromX: number;
  barrageY: number;
  barrageNextAt: number;
}

/** An artillery shell in flight.
 *
 *  Deliberately NOT a Threat. Shells are direct fire with no arc to intercept
 *  (ENEMY_ATTACKS.md), and keeping them out of `threats` means the target
 *  compatibility layer never sees them at all — no weapon can be pointed at a
 *  shell even by mistake, because there is nothing there to point at. */
export interface Shell {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Impact point. A shell bursts here regardless of what it hits on the way. */
  targetX: number;
  targetY: number;
  damage: number;
  variant: ArtilleryVariant;
  alive: boolean;
}

/** A smoke round on its way from the friendly shore to its burst point.
 *
 *  Deliberately NOT a `Shell`. Those are the enemy's artillery, and every
 *  shell in that array is resolved against the convoy for splash damage — a
 *  friendly round sharing the type would either need a flag threaded through
 *  the damage path or would quietly shell the ships it was sent to protect. */
export interface SmokeShell {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  /** Carried to the burst so the pocket it lays matches the research the
   *  barrage was fired under, even if something changes mid-flight. */
  radius: number;
  duration: number;
}

/** A round fired by an attack boat: machine-gun tracer or rocket, depending on
 *  the boat variant.
 *
 *  Deliberately a real object rather than a damage-per-second stream. Every
 *  point of damage this branch does to a cargo hull now crosses the water
 *  visibly, so a player who loses a ship to boats watched it happen and had
 *  the seconds of flight time to answer. Like Shell, it lives in its own array
 *  and is NOT a Threat — nothing may ever be pointed at one. */
export interface BoatShot {
  id: number;
  /** The boat that fired it (for telemetry and for culling on its death). */
  ownerBoatId: number;
  /** Hull it was aimed at. Purely informational — the round damages whatever
   *  it actually strikes, so a shot at one ship can hit another sailing
   *  through its path. */
  targetShipId?: number;
  variant: BoatVariant;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Aim point resolved at fire time (lead + scatter). A round that reaches it
   *  without striking anything is a MISS and is culled shortly after. */
  targetX: number;
  targetY: number;
  damage: number;
  /** Rendered size (px radius). */
  size: number;
  alive: boolean;
  /** Counts down once the round has overshot its aim point. */
  expireIn: number;
}

export type ArtilleryVariant = 'coastalGun' | 'ranging' | 'rollingBarrage';

/** An enemy smoke cloud laid during the round. */
export interface SmokePlacement {
  /** Screening sits over the launch sites; blinding sits over the convoy. */
  variant: 'screening' | 'blinding';
  /** Transit time it goes up. */
  time: number;
  /** Screening clouds have a fixed position; blinding ones follow the convoy
   *  and resolve their center when they are laid. */
  x?: number;
  y?: number;
}

/** Electronic-attack effects bought for a round. */
export interface ElectronicPlan {
  /** Recon plane crossings, each dragging interceptor accuracy while alive. */
  reconPlanes: number;
  /** Single-use drones, each disabling one hull. */
  disablingDrones: number;
  /** Sensor-jamming blackouts. Played at the round's start; not shootable. */
  jamming: number;
}

/** Where the enemy emplaces a gun before the round starts. */
export interface InstallationPlacement {
  x: number;
  y: number;
  variant: ArtilleryVariant;
}

export interface SpawnEvent {
  time: number;
  kind: 'missile' | 'guidedMissile' | 'torpedo' | 'attackBoat';
  /** Launch site x position along the hostile shore. */
  siteX: number;
  /** Torpedoes: corrects toward its target instead of running straight. */
  homing?: boolean;
  /** Torpedoes: leaves no wake, so it cannot be read off the water and needs
   *  an active sensor (upgraded hydrophone / active sonar) to see at all. */
  lowSig?: boolean;
  /** Attack boats: which variant puts to sea (small-arms / rocket / boarding). */
  boatVariant?: BoatVariant;
}

export interface MinePlacement {
  x: number;
  y: number;
  lowSig: boolean;
}

/** Everything the enemy will do during one transit, generated pre-round. */
export interface RoundPlan {
  round: number;
  spawns: SpawnEvent[];
  mines: MinePlacement[];
  /** Shore guns emplaced for this round. */
  installations: InstallationPlacement[];
  /** Enemy smoke clouds laid this round. */
  smoke: SmokePlacement[];
  /** Electronic-attack effects the enemy paid for this round. */
  electronic: ElectronicPlan;
  /** Tech that appears for the first time this round (for AAR forensics). */
  debuts: TechKey[];
}

// ---------------------------------------------------------------------------
// Player assets during transit
// ---------------------------------------------------------------------------

export interface Escort {
  id: number;
  /** The campaign EscortUnit this is sailing for. Losses are reported against
   *  it so the right named ship leaves the flotilla, and per-escort telemetry
   *  is attributed through it. */
  unitId: number;
  /** Copied from the unit so the transit can label it without reaching back
   *  into campaign state. */
  name: string;
  /** THIS escort's fitted specialist systems. Every capability gate in the
   *  sim reads this rather than a fleet-wide list — a depth charge can only be
   *  dropped by an escort that actually carries a launcher. */
  modules: EscortModuleId[];
  x: number;
  y: number;
  slotDx: number;
  slotDy: number;
  cooldown: number;
  heading: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** While time < disabledUntil the escort can't launch (recently hit). */
  disabledUntil: number;
  /** Player-set destination. `hold` = station there instead of resuming
   *  forward on arrival. */
  moveTarget: { x: number; y: number; hold: boolean } | null;
  /** The REST of a drawn route, in order, waiting behind moveTarget.
   *
   *  A path is deliberately nothing more than a queue of ordinary move targets:
   *  arriving at one pops the next. Every bit of the steering the escort
   *  already has — traffic avoidance, the blocked-and-parting rule, the arrival
   *  test — applies to a drawn route without knowing routes exist, which is why
   *  a curve around a minefield behaves like a hand-flown one rather than a
   *  rail the ship is dragged along. */
  waypoints: { x: number; y: number }[];
  /** True once a hold order has been reached: the escort holds position. */
  stationed: boolean;
  /** Seconds spent making no real ground toward the current destination. Past
   *  NAV.escortAvoidGiveUpSeconds the escort stops going around traffic and
   *  starts parting it — see the escort steering block in transit.ts. */
  blockedSeconds: number;
  /** Smoothed steering vector. Persisted because a rudder is not re-decided
   *  from scratch thirty times a second — see NAV.escortSteerSmoothing. */
  steerX: number;
  steerY: number;
  /** Which hull this escort is currently committed to passing, and on which
   *  side (-1 = to port of its own heading, +1 = to starboard). Held until the
   *  hull is well clear, so the choice cannot flip tick to tick. */
  passShipId: number | null;
  passSide: number;
  /** Seconds the committed hull has been out of the avoidance corridor. The
   *  commitment survives a brief dropout rather than being torn down the first
   *  tick the geometry says "clear" — a hull sliding in and out of the corridor
   *  used to reset the side and let it be re-decided the other way, which is a
   *  rudder reversal produced by nothing having actually changed. */
  passClearSeconds: number;
  /** SEPARATE automatic-fire cooldown (local automatic engagement tactic).
   *  Independent of the launcher reload `cooldown` by design. */
  autoCooldown: number;
  /** Separate automatic-fire cooldown for automatic mine clearance. */
  mcmAutoCooldown: number;
  /** Minesweeper-drone launcher cycle time (mcmDroneLauncher module). */
  droneCooldown: number;
  /** Drone launches available before the launcher must fully cycle
   *  (dual-sortie rack). */
  droneReady: number;
  /** Depth-charge launcher state (depthCharges module). */
  dcCooldown: number;
  dcShots: number;
  dcAutoCooldown: number;
  /** Deck-gun state (deckGun module): fire-interval timer and the boat this
   *  gun is committed to (sustained engagement until it ends). */
  gunCooldown: number;
  gunTargetId: number | null;
  /** The attack boat this escort is ORDERED onto. Unlike gunTargetId (which
   *  only holds while the boat is in gun range), a pursuit survives the boat
   *  being out of reach: the escort steams to it, takes station inside gun
   *  range and follows until the boat sinks or the player re-tasks the ship.
   *  This is what makes "engage that boat" an order rather than a wish. */
  pursueBoatId: number | null;
  /** Speed made good last tick — lets OTHER escorts read this one as a moving
   *  vessel (stern-passing needs to know whether a neighbour is under way). */
  lastSpeed: number;
}

/** A fixed shore battery. Unlimited range but a long reload — the player's
 *  baseline air defense, present from round 1 and buyable in numbers. It can be
 *  struck by missiles, which knock it offline and do hull damage; enough
 *  strikes destroy it. Unrepaired damage carries into the next round. */
export interface Base {
  id: number;
  x: number;
  y: number;
  cooldown: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** While time < disabledUntil the battery can't launch (recently hit). */
  disabledUntil: number;
  /** SEPARATE automatic-fire cooldown (strategic automatic engagement). */
  autoCooldown: number;
  /** Counter-battery system reload (counterBattery module). */
  cbCooldown: number;
  /** Separate automatic-fire cooldown for automatic return fire. */
  cbAutoCooldown: number;
}

/** 'pd' = an automatic ship self-defense tracer (limited magazine, its own
 *  hit roll). 'flak' = the anti-air module's burst. */
export type LauncherKind = 'base' | 'escort' | 'pd' | 'flak';

export interface Interceptor {
  id: number;
  x: number;
  y: number;
  targetThreatId: number;
  speed: number;
  /** Which launcher fired it (for telemetry attribution). */
  launcher: LauncherKind;
  /** EscortUnit that fired it, when an escort did. Shore batteries and cargo
   *  self-defense leave this undefined. */
  ownerUnitId?: number;
  /** Overrides the default per-launcher hit chance (used by self-defense). */
  hitChance?: number;
  /** True when an automation tactic (not a player tap) fired this. */
  auto?: boolean;
  /** Rendered size (px radius), resolved from the visual-size tier. */
  size?: number;
}

/** An autonomous minesweeper drone: flies from an escort to a revealed mine
 *  and detonates it. Requires the escort drone-launcher module and the branch's
 *  base research; each launch consumes a purchased drone munition. */
export interface Drone {
  id: number;
  x: number;
  y: number;
  /** EscortUnit that launched it, so the clearance is credited to the escort
   *  actually carrying the launcher. */
  ownerUnitId: number;
  targetMineId: number;
  speed: number;
  /** Moving-target guidance: keeps tracking a drifting mine after launch. */
  tracking: boolean;
}

/** A lobbed depth-charge round: flies to the tapped water point, then
 *  detonates, destroying torpedoes inside the blast area. Never locks on. */
export interface DepthChargeShot {
  id: number;
  /** EscortUnit that lobbed it, so torpedo kills credit the hull that carries
   *  the launcher. */
  ownerUnitId: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  blastRadius: number;
  /** True once it has detonated (kept one tick for the view, then culled). */
  detonated: boolean;
}

/** A support aircraft the player calls in for a placed ability. Scan planes fly
 *  down a chosen lane charting mines in that lane only; the Warthog flies to a
 *  water station, holds a wheel over it gunning surface targets inside its
 *  strafe radius, then departs. */
export interface Aircraft {
  id: number;
  role: 'scan' | 'warthog';
  x: number;
  y: number;
  heading: number;
  /** inbound → fly to the work area; onStation → do the job; departing → leave. */
  phase: 'inbound' | 'onStation' | 'departing';
  /** Scan: which lane the plane was sent down. The LANE is the order — a lane
   *  can bend, so the plane follows the index rather than holding one height. */
  laneIndex?: number;
  /** Scan: the lane-center Y the plane is over right now. Kept up to date as it
   *  flies, so the charting band bends with the lane. */
  laneY: number;
  /** Warthog: the run-in line the player drew, from A to B. The jet flies this
   *  line, carries on off the map, turns, and flies it back the other way. */
  runAx: number;
  runAy: number;
  runBx: number;
  runBy: number;
  /** Warthog: which pass is being flown — 0 is A→B, 1 is the return B→A. */
  pass: number;
  /** Warthog: true once the gun has been fired on THIS pass. One engagement per
   *  pass is the whole shape of the weapon: the jet commits to a target, takes
   *  it, and has to come round again for anything else. */
  firedThisPass: boolean;
  /** Warthog: transit time at which the plane breaks off and departs. */
  stationUntil: number;
  /** Warthog: seconds until the gun is ready for the next pass. */
  gunCooldown: number;
  /** Warthog: has this pass been over open water yet?
   *
   *  The break-off rule is "over land, having crossed the water" — without the
   *  second half a run drawn across the strait would break off immediately,
   *  because the jet ENTERS over the land it flew in from. */
  wetSeen: boolean;
  /** Warthog: seconds spent over land since last leaving the water. */
  landSeconds: number;
}

/** One 30mm gun run: a burst drawn from the jet to the water it hit.
 *
 *  Unlike a BoatShot this carries no damage and has no flight time — a burst
 *  from a rotary cannon crosses a few hundred metres faster than a frame, so
 *  the sim resolves the hit at the instant it fires and this object exists only
 *  so the player SEES which target the pass was against. It is not a Threat and
 *  nothing may ever be aimed at one. */
export interface StrafeRun {
  id: number;
  /** Where the burst started (the jet) and ended (the target). */
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  /** True when the pass actually destroyed what it was aimed at — the view
   *  draws a kill differently from a hit that merely hurt. */
  killed: boolean;
  /** Seconds of visibility left. */
  ttl: number;
}

/** One deck-gun round in flight, drawn from the escort to what she shot at.
 *
 *  VISUAL ONLY, exactly like StrafeRun and for the same reason: the sim
 *  resolves the accuracy roll and the damage at the trigger pull, so this
 *  object carries neither. It exists because a gun that killed attack boats
 *  with nothing visible between the escort and the boat left the player with a
 *  weapon they could only find in the after-action report.
 *
 *  The view interpolates the shell along the line over its life, so a round
 *  that misses still flies — it simply arrives with nothing to show for it. */
export interface GunShot {
  id: number;
  /** Muzzle, at fire time. */
  x: number;
  y: number;
  /** Where the round is going — the target's position when it was fired. A
   *  boat that moves is not chased: the shell was already on its way. */
  targetX: number;
  targetY: number;
  /** Did the roll land? Decides whether the far end shows an impact. */
  hit: boolean;
  /** True when this round is what sank her, so the view can flash it. */
  killed: boolean;
  /** Seconds of flight left, counted down from ttlTotal. */
  ttl: number;
  ttlTotal: number;
}

/** A placed area effect with a lifetime: active-sonar ping (reveals the
 *  underwater picture) or defensive smoke (degrades enemy targeting). */
export interface AreaEffect {
  id: number;
  /** `smoke` is the PLAYER's track-breaking cloud; `enemySmoke` is the enemy's
   *  concealment branch. They are deliberately distinct kinds — one hides the
   *  player's ships from the enemy, the other hides the enemy's threats from
   *  the player, and nothing should ever treat them interchangeably. */
  kind: 'sonar' | 'smoke' | 'enemySmoke';
  x: number;
  y: number;
  radius: number;
  /** Transit time at which the effect expires. */
  until: number;
  /** Enemy smoke: blinding clouds also degrade missile-warning cues inside. */
  blinding?: boolean;
}

// ---------------------------------------------------------------------------
// Wreckage recovery & crew rescue (roguelite loop)
// ---------------------------------------------------------------------------

/** A recoverable enemy wreckage field left by a threat the player destroyed.
 *  Recovery is POSITIONAL: one or more escorts must hold inside the field's
 *  radius; more escorts recover faster; progress resets completely the moment
 *  no escort is working it (touch-and-go preserves nothing by design). */
export interface WreckageField {
  id: number;
  x: number;
  y: number;
  /** Enemy branch family that produced the wreck (drives draft weighting). */
  branch: string;
  /** The threat kind that was destroyed (display + telemetry). */
  threatKind: ThreatKind;
  /** Escort-seconds of work a SINGLE escort would need to recover it. */
  required: number;
  /** Work done so far, in single-escort-equivalent seconds. */
  progress: number;
  /** Transit time at which the field sinks for good. */
  expiresAt: number;
  recovered: boolean;
  expired: boolean;
}

/** Survivors in the water where a civilian hull went down. Same recovery
 *  mechanics as wreckage; an unrescued crew costs extra confidence when the
 *  round resolves. */
export interface SurvivorArea {
  id: number;
  x: number;
  y: number;
  /** Name of the lost ship, so the rescue reads as saving HER crew. */
  shipName: string;
  required: number;
  progress: number;
  expiresAt: number;
  rescued: boolean;
  lost: boolean;
}

// ---------------------------------------------------------------------------
// Transit state & commands
// ---------------------------------------------------------------------------

/** Player-toggleable automation systems (each unlocked by a tactic). Manual
 *  fire always remains available regardless of these switches. */
export type AutoSystem =
  | 'escortInterceptor'
  | 'baseInterceptor'
  | 'mcmDrones'
  | 'depthCharges'
  | 'deckGun'
  | 'counterBattery';

export type TransitCommand =
  | { type: 'intercept'; threatId: number }
  /** Send a minesweeper drone at a charted mine (from the nearest in-range
   *  escort). Player-directed, like an intercept but for mines. */
  | { type: 'sweepMine'; threatId: number }
  /** Depth charge: tap a POINT IN THE WATER (never the torpedo sprite). The
   *  nearest ready equipped escort lobs a charge at it. */
  | { type: 'depthCharge'; x: number; y: number }
  /** Deck gun: commit the nearest ready gun escort to sustained fire on an
   *  attack boat until it sinks, leaves range, or is re-tasked. */
  | { type: 'engageBoat'; threatId: number; focus?: boolean }
  /** Counter-battery: fire at an identified hostile artillery POSITION (an
   *  installation id — never a projectile or mobile unit). */
  | { type: 'counterBattery'; installationId: number }
  /** Placed ability: x/y is where the player put the effect on the map. */
  /** x/y is where the player put the effect. The Warthog additionally carries
   *  x2/y2: it is aimed along a LINE the player draws, not parked on a point,
   *  and the line is the weapon (see the gun-cone targeting in transit.ts). */
  | {
      type: 'ability';
      ability: 'warthog' | 'scan' | 'sonar' | 'smoke';
      x: number;
      y: number;
      x2?: number;
      y2?: number;
    }
  /** Hardened systems: spend an emergency-reboot charge to shorten an active
   *  sensor-jamming blackout. */
  | { type: 'reboot' }
  /** Toggle an automation tactic on/off. Never affects manual fire. */
  | { type: 'toggleAuto'; system: AutoSystem; enabled: boolean }
  /** Send an escort to a point. hold=false → resume forward on arrival;
   *  hold=true → stay stationed there. */
  | { type: 'moveEscort'; escortId: number; x: number; y: number; hold: boolean }
  /** A drawn ROUTE: the escort steams the points in order. The last one
   *  carries `hold`, exactly as a single move order would. */
  | { type: 'pathEscort'; escortId: number; points: { x: number; y: number }[]; hold: boolean };

export type TransitEventType =
  | 'delivered'
  | 'shipLost'
  | 'shipHit'
  | 'intercepted'
  | 'pdKill'
  | 'flakKill'
  | 'interceptMiss'
  | 'missileMiss'
  | 'mineRevealed'
  | 'torpedoDetected'
  | 'mineSwept'
  | 'mineDetonated'
  | 'depthChargeKill'
  | 'boatSunk'
  | 'boardingStarted'
  | 'boardingRepelled'
  | 'enemySmoke'
  | 'jammingStarted'
  | 'shipDisabled'
  | 'suppressed'
  | 'abilityUsed'
  | 'escortTasked'
  | 'launchFailed'
  | 'techDebut'
  | 'wreckageSpawned'
  | 'wreckageRecovered'
  | 'wreckageExpired'
  | 'survivorsSpawned'
  | 'survivorsRescued'
  | 'survivorsLost';

export interface TransitEvent {
  t: number;
  type: TransitEventType;
  shipId?: number;
  shipName?: string;
  threatKind?: ThreatKind;
  lowSig?: boolean;
  cause?: string;
  detail?: string;
}

/** Per-round player-counter stats: which counter did what, split by
 *  automatic vs manual, with detection and mitigation attribution — the
 *  player-side half of the seesaw telemetry. */
export interface CounterRoundStats {
  /** Interceptor shots initiated by a player tap vs by an automation tactic. */
  manualShots: number;
  autoShots: number;
  manualIntercepts: number;
  autoIntercepts: number;
  /** Automation declined to double-fire at an already-covered threat. */
  duplicateShotsAvoided: number;
  /** Shots (manual or auto) fired at a threat that already had one inbound. */
  duplicateShots: number;
  selfDefenseShots: number;
  selfDefenseKills: number;
  droneLaunches: number;
  droneKills: number;
  depthChargesDropped: number;
  depthChargeKills: number;
  deckGunRounds: number;
  deckGunKills: number;
  /** A-10 gun runs fired, and how many of those passes killed what they hit. */
  gunRuns: number;
  gunRunKills: number;
  counterBatteryShots: number;
  counterBatterySuppressions: number;
  flakShots: number;
  flakKills: number;
  /** Detection events by sensor family. */
  detections: {
    mineSonar: number;
    hydrophone: number;
    scanPulse: number;
    activeSonar: number;
    thermal: number;
    missileWarning: number;
  };
  /** Damage (hp) prevented by each mitigation branch. */
  damagePrevented: {
    compartmentalization: number;
    reinforcedHull: number;
    fireSuppression: number;
  };
  boardingAttempts: number;
  boardingInterrupted: number;
  boardingCaptures: number;
  jammingSeconds: number;
  jammingMitigatedSeconds: number;
  /** Ability charges available at round start / expended. */
  charges: {
    warthog: { available: number; used: number };
    scan: { available: number; used: number };
    sonar: { available: number; used: number };
    smoke: { available: number; used: number };
    reboot: { available: number; used: number };
  };
}

export interface TransitStats {
  launched: number;
  delivered: number;
  lost: number;
  valueSent: number;
  valueDelivered: number;
  missilesSpawned: number;
  missilesIntercepted: number; // player interceptors + self-defense
  playerIntercepts: number;
  baseIntercepts: number;
  escortIntercepts: number;
  interceptMisses: number;
  pdKills: number;
  /** Mines and boats destroyed by A-10 gun runs. */
  warthogKills: number;
  minesTotal: number;
  minesRevealed: number;
  minesDetonated: number;
  minesSwept: number;
  /** Torpedoes launched at the convoy this transit. */
  torpedoesLaunched: number;
  /** Torpedoes the player detected (by wake, hydrophone or active sonar). */
  torpedoesDetected: number;
  /** Torpedoes that reached a hull. */
  torpedoesHit: number;
  /** Torpedoes destroyed by depth charges. */
  torpedoesDestroyed: number;
  /** Attack boats that reached the convoy this transit. */
  boatsLaunched: number;
  /** Attack boats destroyed (deck guns are the only thing that can). */
  boatsSunk: number;
  /** Hulls sunk by boat gunfire (boarding captures are counted separately). */
  boatKills: number;
  /** Boat rounds fired, and how many struck a hull. The gap between them is
   *  what a maneuvering convoy (and a boat forced to shoot from its standoff
   *  ring) is actually worth. */
  boatRoundsFired: number;
  boatRoundsHit: number;
  /** Hulls taken by a boarding party — losses, but not sinkings. */
  shipsCaptured: number;
  /** Artillery shells fired at the convoy, and how many burst on a hull. */
  shellsFired: number;
  shellHits: number;
  /** Shore batteries the player permanently silenced this transit. */
  batteriesDestroyed: number;
  /** Enemy smoke clouds laid, and seconds of threat-time spent concealed. */
  smokeCloudsLaid: number;
  concealedSeconds: number;
  /** Recon planes and disabling drones fielded, and how many were shot down. */
  reconPlanes: number;
  disablingDrones: number;
  aircraftDowned: number;
  /** Seconds a hull spent dead in the water from a disabling drone. */
  shipDisabledSeconds: number;
  ammoUsed: number;
  warthogUsed: number;
  scanUsed: number;
  /** Escorts destroyed during the transit (lost from the fleet). */
  escortsLost: number;
  /** What each escort did this transit, keyed by EscortUnit id. Attribution is
   *  per SHIP rather than per weapon type, so a log can answer whether fitting
   *  the deck gun to a particular escort was worth the slot. */
  escortPerformance: Record<number, EscortPerformance>;
  /** Shore batteries destroyed during the transit (lost from the fleet). */
  basesLost: number;
  /** Times a launcher (escort or battery) was knocked offline by a hit. */
  launchersDisabled: number;
  /** Player-counter attribution (auto/manual split, per-weapon, detection,
   *  mitigation). */
  counter: CounterRoundStats;
  /** What each ENEMY branch achieved this round — damage dealt and hulls
   *  sunk, keyed by branch. This is the numerator of the enemy's ROI: without
   *  it the procurement economy cannot tell which attack is paying off, and
   *  the seesaw cannot pivot. */
  enemyBranch: Record<string, { damage: number; kills: number }>;
  /** Wreckage fields spawned / recovered / abandoned this transit. */
  wreckageSpawned: number;
  wreckageRecovered: number;
  wreckageExpired: number;
  /** Recovered wreckage units by the enemy branch that produced them —
   *  the input to the post-round technology draft's weighting. */
  wreckageByBranch: Record<string, number>;
  /** Escort-seconds spent working recovery areas (wreckage + survivors) —
   *  the telemetry that prices what recovery actually costs in escort time. */
  recoveryEscortSeconds: number;
  /** Survivor areas spawned / rescued / lost this transit. */
  survivorsSpawned: number;
  survivorsRescued: number;
  survivorsLost: number;
}

// ---------------------------------------------------------------------------
// Research-derived combat effects (all numbers tier-resolved in the data layer)
// ---------------------------------------------------------------------------

/** Escort/base interceptor performance + automation, resolved from tiers. */
export interface InterceptorEffects {
  speed: number;
  accuracy: number;
  reload: number;
  projectileSize: number;
  /** Automation tactic researched (radius > 0 means local auto works). */
  autoUnlocked: boolean;
  /** Auto-engagement radius (escorts; Infinity for map-wide base auto). */
  autoRadius: number;
  /** Separate automatic-fire cooldown (0 = removed by the top tactic). */
  autoCooldown: number;
  /** Automation avoids double-firing at an already-covered missile. */
  autoDedupe: boolean;
  /** Base: prioritize the missile with the shortest time to impact. */
  autoPrioritizeTti: boolean;
}

export interface AbilityEffects {
  charges: number;
  radius: number;
  /** Seconds the placed effect lasts (sonar track / smoke cloud / A-10 loiter). */
  duration: number;
  /** Extra seconds a revealed contact stays precisely tracked. */
  persistence: number;
  unlockedLowSig: boolean;
  /** The Wide node is set. For the placed abilities this is already folded into
   *  `radius`; the Warthog needs it separately because its wide node opens a
   *  gun CONE rather than growing a circle. */
  wide: boolean;
}

/** Research-derived combat effects, baked once at transit creation. Every
 *  number here was resolved from a stat tier in the data layer — the sim only
 *  consumes finished values. */
export interface CombatEffects {
  /** Global damage multiplier (1 normally; 0 in dev god mode). Per-ship
   *  compartmentalization applies separately, only to equipped hulls. */
  damageTakenMult: number;
  /** Escort-only damage multipliers, on top of damageTakenMult. Escort
   *  legacies live here: a flotilla can be hardened without also hardening the
   *  merchant hulls, which is a different (and much bigger) lever. */
  escortDamageMult: number;
  /** Applied on top of escortDamageMult for MINE damage only. */
  escortMineDamageMult: number;
  /** Multiplies escort transit speed. */
  escortSpeedMult: number;
  /** Damage one A-10 gun run does to an attack boat (mines die outright). */
  warthogDamage: number;
  /** Minesweeper drones available (branch researched AND launcher equipped). */
  sweepDrones: boolean;
  /** Fires extinguish themselves quickly (fire-suppression node). */
  autoExtinguish: boolean;
  /** Missile-warning tactic: draw target-vector lines for inbound missiles. */
  showTargetVectors: boolean;

  escort: InterceptorEffects;
  base: InterceptorEffects;

  selfDefense: {
    accuracy: number;
    projectileSpeed: number;
    range: number;
    magazine: number;
    projectileSize: number;
    /** Tactic: highlight the intended target at ~2× firing range. */
    designator: boolean;
    /** Tactic: show engagement line + loaded/empty/reloading status. */
    predictor: boolean;
    /** Tactic: reserve targets, avoid duplicate shots, prioritize own ship. */
    coordinated: boolean;
  };

  missileWarning: {
    assist: number;
    range: number;
    seaSkimmer: boolean;
    networked: boolean;
    urgency: boolean;
    priorityTag: boolean;
  };

  mineSonar: {
    radius: number;
    detectLowSig: boolean;
    driftTracking: boolean;
    /** Shared-picture tactic: every hull contributes this detection radius. */
    fleetDetectRadius: number;
    dangerEnvelope: boolean;
    driftVector: boolean;
  };

  mcm: {
    launchRange: number;
    droneSpeed: number;
    reload: number;
    movingTarget: boolean;
    dualSortie: boolean;
    autoUnlocked: boolean;
    autoRadius: number;
    autoCooldown: number;
    riskDesignator: boolean;
    coordinated: boolean;
  };

  depthCharge: {
    throwRange: number;
    blastRadius: number;
    reload: number;
    /** Launches available per escort per round. */
    magazine: number;
    patternSalvo: boolean;
    leadSolution: boolean;
    autoUnlocked: boolean;
    autoRadius: number;
    autoCooldown: number;
    coordinated: boolean;
  };

  deckGun: {
    range: number;
    accuracy: number;
    damage: number;
    fireInterval: number;
    armorPiercing: boolean;
    autoNearest: boolean;
    focusFire: boolean;
    distributedFire: boolean;
    layeredFire: boolean;
  };

  counterBattery: {
    canEngageRanging: boolean;
    accuracy: number;
    reload: number;
    suppressionSeconds: number;
    barrageDisruption: boolean;
    /** Focused repeat strikes can permanently destroy a position this round. */
    coordinatedStrike: boolean;
    autoUnlocked: boolean;
    autoCooldown: number;
  };

  flak: {
    accuracy: number;
    range: number;
    reload: number;
    magazine: number;
    projectileSpeed: number;
    /** Proximity-fuse node: may engage ship-disabling drones too. */
    proximityFuse: boolean;
    earlyContact: boolean;
    deconfliction: boolean;
  };

  hydrophone: {
    range: number;
    detectLowSig: boolean;
    improvedLocalization: boolean;
    precisionTrack: boolean;
    projectedPath: boolean;
    shared: boolean;
  };

  thermal: {
    range: number;
    blindingResistance: boolean;
    trackPersistence: number;
    networked: boolean;
  };

  antiBoarding: {
    equippedEffect: boolean;
    slowMult: number;
    lockdown: boolean;
    counterTeam: boolean;
    emergencyRejection: boolean;
    /** Deck-gun auto-acquisition puts an attached boarding boat first. */
    autoPriority: boolean;
  };

  hardened: {
    /** Fraction of a jamming blackout removed per emergency reboot. */
    recovery: number;
    /** Sensor families kept partially alive through jamming (pre-round pick). */
    protectedChannelCount: number;
    redundantCommand: boolean;
    rebootCharges: number;
  };

  /** Reinforced-hull bonus hp for equipped ships (tier-resolved). */
  hullBonusHp: number;
  /** Compartmentalization damage reduction for equipped ships. */
  compartmentReduction: number;
  /** Fire-suppression: burn-duration multiplier / full immunity node. */
  fire: { durationMult: number; noReignite: boolean; immune: boolean };
  /** Fraction of enemy targeting skill removed for ships inside player smoke
   *  (one doctrine tier ≈ 0.5; dense ≈ 1.0). 0 = smoke not researched. */
  smokeDegradation: number;
  /** Track-breaking smoke: seconds of re-acquisition grace after a ship exits
   *  the cloud (0 = node not researched). */
  smokeTrackBreakSeconds: number;
  /** Probability a scan pulse reveals a low-signature mine (research-scaled). */
  scanLowSigChance: number;
  /** Recovery-operation rates. 1 = baseline; Commander Abilities are applied
   *  on top of derived tech/equipment effects (the central modifier point the
   *  design requires) and land here among other places. */
  recovery: { wreckageRateMult: number; rescueRateMult: number };

  abilities: {
    warthog: AbilityEffects;
    scan: AbilityEffects;
    sonar: AbilityEffects;
    smoke: AbilityEffects;
  };
}

export interface TransitState {
  time: number;
  over: boolean;
  /** THE WATER this transit is fought in — coastlines, lanes and emplacement
   *  lines for the region that was sailed into (see data/geography.ts).
   *
   *  On the state rather than reached for as a module constant because the map
   *  is a property of the round, and everything that asks where the land is —
   *  the sim, the renderer, the escort order resolver — has to be asking about
   *  the SAME map. Not serialized: it is derived from the region id. */
  geo: Geography;
  /** Notional patrol/progress reference used to position escorts and center
   *  convoy-wide ability effects — no longer a slot anchor for cargo ships,
   *  which now move individually through the corridor. */
  anchorX: number;
  /** Formation chosen in prep; fixed for the whole transit. */
  formation: FormationId;
  ships: Ship[];
  escorts: Escort[];
  bases: Base[];
  threats: Threat[];
  /** Hostile shore installations (artillery positions). Empty until the
   *  enemy-side artillery branch is implemented; counter-battery targets these. */
  installations: EnemyInstallation[];
  interceptors: Interceptor[];
  drones: Drone[];
  depthChargeShots: DepthChargeShot[];
  /** Transit seconds after which anything still afloat is lost at sea. Sized
   *  from the convoy's own arrival span (see transitTimeLimit) rather than a
   *  flat number, so entering last is never itself a death sentence. */
  timeLimit: number;
  /** Support aircraft in flight (scan planes / the A-10). */
  aircraft: Aircraft[];
  /** Gun-run bursts still being drawn. Visual only — see StrafeRun. */
  strafeRuns: StrafeRun[];
  /** Deck-gun rounds in flight. Visual only — see GunShot. */
  gunShots: GunShot[];
  /** Placed area effects with lifetimes (active-sonar pings, smoke clouds). */
  areaEffects: AreaEffect[];
  /** Artillery shells in flight. Kept out of `threats` on purpose — see Shell. */
  shells: Shell[];
  /** The player's smoke barrage: rounds in flight, and the bursts still
   *  waiting their turn as the barrage walks up the lane. */
  smokeShells: SmokeShell[];
  smokeBarrage: { x: number; y: number; at: number; radius: number; duration: number }[];
  /** Attack-boat rounds in flight. Kept out of `threats` for the same reason:
   *  a boat's gunfire is not a thing the player can shoot down, only something
   *  they can see coming (and outmaneuver). Killing the BOAT is the answer. */
  boatShots: BoatShot[];
  /** Recoverable wreckage fields from destroyed enemy threats. */
  wreckage: WreckageField[];
  /** Survivor areas where lost civilian ships went down. */
  survivors: SurvivorArea[];
  /** Enemy smoke still to be laid this round. */
  smokeQueue: SmokePlacement[];
  /** Recon planes and drones still to launch this round. */
  eaQueue: { time: number; kind: 'reconPlane' | 'disablingDrone' }[];
  /** Sensor-jamming blackouts bought but not yet played. */
  pendingJamming: number;
  /** Escort loadout template applied to every escort this transit. */
  escortModules: EscortModuleId[];
  /** Shore-base loadout template. */
  baseModules: BaseModuleId[];
  /** Automation switches (player toggleable; manual fire always available). */
  autoFire: Record<AutoSystem, boolean>;
  /** Hardened systems: sensor families kept alive through jamming this round. */
  protectedChannels: SensorFamily[];
  ammo: number;
  /** Drone munitions remaining: each minesweeper drone launch consumes one. */
  droneAmmo: number;
  /** Self-defense rounds remaining: each module shot draws from this pool. */
  pdAmmo: number;
  /** Deck-gun shells remaining: every round any gun fires draws one. A gun
   *  with an empty magazine holds its fire — shells are bought in prep. */
  gunAmmo: number;
  /** One "out of shells" warning per dry spell, not one per silent trigger
   *  pull — thirty toasts a second is noise, not information. */
  gunAmmoWarned: boolean;
  /** Sorties in hand. Sorties STACK — several jets may be on task at once, on
   *  different bearings — so this count is the only thing limiting the player.
   *  There is deliberately no "one flight at a time" gate: with one, holding
   *  four charges and flying one made the count a lie. */
  warthogCharges: number;
  scanCharges: number;
  sonarCharges: number;
  smokeCharges: number;
  rebootCharges: number;
  /** Seconds of enemy sensor jamming remaining (0 = not jammed). The enemy
   *  pass activates this; hardened systems shorten it. */
  jammingSeconds: number;
  /** How sharply the enemy prioritizes closer / weaker ships (0 = near-random,
   *  1 = fully focused). Ramps with the campaign round. */
  enemyTargetingSkill: number;
  /** Pending enemy spawns, sorted by time. */
  spawnQueue: SpawnEvent[];
  events: TransitEvent[];
  stats: TransitStats;
  effects: CombatEffects;
  /** Convoy base speed (slowest ship class present). */
  baseSpeed: number;
  nextEntityId: number;
  /** Tech keys already announced via techDebut events this transit. */
  debutsSeen: TechKey[];
  /** How much of the campaign's pendingDamage pool this convoy absorbed. */
  pendingDamageApplied: number;
}

// ---------------------------------------------------------------------------
// Technology (counter branches — see src/data/counters.ts for the catalogue)
// ---------------------------------------------------------------------------

/** Technology entries are `<branch>.<node>` strings defined in the counter
 *  catalogue (src/data/counters.ts). Under the roguelite loop these are no
 *  longer bought with intel — they arrive through the mandatory post-round
 *  technology draft — but the catalogue, its prerequisites and its effect
 *  derivation are reused unchanged. */
export type ResearchId = string;

/** A mandatory post-round technology draft. The player must pick exactly one
 *  option before the next round; picks activate immediately and cannot be
 *  banked or skipped (an EMPTY options list is the one exception — the
 *  catalogue has been exhausted and there is nothing left to offer). */
/** Which kind of reward a draft card is. Four shapes, because they behave in
 *  four different ways and the player should never have to work out which they
 *  are looking at:
 *
 *   • UPGRADE — a branch node or tactic. Free, permanent, applies to EVERY copy
 *     of that system the fleet is carrying (effects resolve per branch, not per
 *     module), and takes effect on the next transit.
 *   • MODULE — one physical unit of equipment. Held as stock, fitted and
 *     refitted freely between rounds. Cargo units survive anything; an escort
 *     unit goes down with its hull.
 *   • ASSET — a change to the shape of the fleet itself: berthing, slots,
 *     repair and salvage capability.
 *   • ORDNANCE — a one-off delivery of consumables. The only category that is
 *     spent rather than kept, and deliberately the weakest: it exists so a
 *     draft with nothing useful left to offer still offers something real. */
export type DraftOptionKind = 'upgrade' | 'module' | 'asset' | 'ordnance';

/** Where a module unit can be fitted. `mineSonar` exists as BOTH a cargo module
 *  and an escort module, so the platform is part of a module's identity and can
 *  never be inferred from its id alone. */
export type ModulePlatform = 'cargo' | 'escort' | 'base';

export type DraftOption =
  | { kind: 'upgrade'; id: ResearchId }
  | { kind: 'asset'; id: ResearchId }
  | { kind: 'module'; platform: 'cargo'; moduleId: ModuleId }
  | { kind: 'module'; platform: 'escort'; moduleId: EscortModuleId }
  | { kind: 'module'; platform: 'base'; moduleId: BaseModuleId }
  | { kind: 'ordnance'; packId: string };

/** Stock of equipment the drafts have delivered, by platform then module.
 *  Counts every unit OWNED — fitted and spare alike; what is fitted is read off
 *  the loadout itself, so the two can never disagree. */
export interface ModuleStock {
  cargo: Partial<Record<ModuleId, number>>;
  escort: Partial<Record<EscortModuleId, number>>;
  base: Partial<Record<BaseModuleId, number>>;
}

export interface TechDraft {
  /** Round whose transit earned this draft. */
  round: number;
  options: DraftOption[];
  /** Wreckage units recovered that round (drove breadth and weighting). */
  recoveredUnits: number;
  /** The per-branch salvage the table was drawn against, kept so a REROLL can
   *  redraw against the same round rather than against a bare pool. */
  recoveredByBranch: Record<string, number>;
  /** Times this table has been rerolled — shown to the player, and used to
   *  salt the redraw so a reroll is deterministic on replay. */
  rerolls?: number;
  /** How many options may be TAKEN from this table. One ordinarily; recovery
   *  buys a second and a third. Picking decrements it, and the draft closes
   *  when it reaches zero — so a rich salvage round is a bigger shopping trip
   *  rather than merely a wider menu it still only gets one bite of. */
  picksLeft: number;
  /** How many picks the table OPENED with, so the UI can say "pick 2 of 3"
   *  rather than only counting down. */
  picksTotal: number;
  /** The enemy branch the COUNTER SLOT was drawn to answer (absent when no
   *  live threat was under-covered and the slot fell through to the open
   *  pool) — surfaced so the UI can say WHY an option is on the table. */
  counterFamily?: string;
  /** Key of the option that filled the counter slot (see draftOptionKey), so
   *  the UI can badge exactly that card rather than guessing from the family. */
  counterOption?: string;
}

/** What one enemy branch has actually been doing to this run.
 *
 *  The draft reads this, not just recovered wreckage: a player who has been
 *  mined for three rounds running needs to be offered mine counters whether
 *  or not they had the escorts to spare for salvage. */
export interface ThreatPressure {
  /** Rounds in which this branch was encountered at all. */
  rounds: number;
  /** Consecutive most-recent rounds it has appeared in. */
  streak: number;
  /** Hull damage it has dealt across the run. */
  damage: number;
  /** Ships it has sunk or taken across the run. */
  kills: number;
  /** Last round it was seen (0 = never). */
  lastSeenRound: number;
}

/** How well the player is ACTUALLY handling one enemy branch, 0..1.
 *
 *  Owning a counter is not the same as answering a threat, and the difference
 *  is what made the draft go wrong: one A-10 gun run per round against three
 *  mines and two boats used to flip mines AND attack boats to "solved" —
 *  because the old test was a boolean over the catalogue, not a measurement of
 *  the water. Coverage is measured from what the round did: mines swept out of
 *  mines laid, boats sunk out of boats launched, missiles intercepted out of
 *  missiles fired. A branch that keeps killing hulls keeps a low coverage no
 *  matter how much tech nominally points at it, and the draft keeps offering
 *  answers for it. */
export interface ThreatCoverage {
  /** Smoothed neutralized fraction (0..1) — the number the draft weights on. */
  ratio: number;
  /** Units of this branch fielded against the run so far. */
  fielded: number;
  /** Units of it the player neutralized. */
  neutralized: number;
  /** Last round a measurement was taken (0 = never measured). */
  lastMeasuredRound: number;
}

/** One draft's telemetry: what was offered and what the player took. */
export interface DraftRecord {
  round: number;
  offered: DraftOption[];
  picked: DraftOption | null;
}

/** Sensor families the hardened-systems protected channel can preserve. */
export type SensorFamily = 'mineDetection' | 'torpedoDetection' | 'missileWarning' | 'smokeImaging';

// ---------------------------------------------------------------------------
// Enemy evolution
// ---------------------------------------------------------------------------

/** Legacy doctrine tracks. The enemy now runs a real procurement economy
 *  (EnemyEconomyState); these remain as a DERIVED read-out so old saves,
 *  existing telemetry consumers and the AAR keep working. They are computed
 *  from cumulative branch spend, never used to decide what the enemy buys. */
export interface EvolutionTracks {
  /** More simultaneous missiles / volleys. */
  saturation: number;
  /** Guided missiles: share and quality. */
  guidance: number;
  /** Minelaying capability. */
  mines: number;
  /** Low-signature mines that defeat standard detection. */
  lowSig: number;
}

/** What one enemy branch did with its money last round — the raw material for
 *  ROI, and the field docs/SEESAW.md called out as missing instrumentation. */
export interface BranchLedger {
  /** Budget allocated to this branch this round. */
  spend: number;
  /** Units actually fielded, keyed by node id. */
  units: Record<string, number>;
  /** Budget allocated but not convertible into whole units — wasted. */
  scrap: number;
  /** Damage + kills the branch produced, weighted (see ENEMY_ECONOMY). */
  result: number;
  /** result ÷ spend from the round that just resolved. */
  roi: number;
  /** Ships this branch sank (or captured) last round. */
  kills: number;
  /** Consecutive rounds the enemy has funded this branch. */
  roundsInvested: number;
  /** Allocation weight carried into next round's split. */
  share: number;
  /** Every credit ever spent on this branch, and everything it ever returned.
   *  ROI is their ratio rather than the round's, so a branch that buys one
   *  expensive unit is judged on its average instead of on the variance a
   *  single lumpy purchase produces. */
  lifetimeSpend: number;
  lifetimeResult: number;
}

/** The enemy's procurement economy — a mirror of the player's prep phase.
 *  Budget arrives, is committed in full, and whatever is not spent is scrapped;
 *  what it buys is driven by which branches are paying off. */
export interface EnemyEconomyState {
  /** REGION GATING: enemy branch keys the active region permits. Procurement
   *  never funds anything outside this set — the region decides what the
   *  enemy CAN use; the adaptive economy decides what it emphasizes. */
  allowedBranches: string[];
  /** Optional per-branch earliest-round floors from the region definition
   *  (pacing DELAYS on top of each branch's own openRound). */
  branchDebutRounds: Record<string, number>;
  /** Per-round unit ceilings this region raises for a branch (see RegionDef). */
  branchUnitCeilings: Record<string, number>;
  /** The region's threat-budget curve (base + perRound × round, capped). */
  budgetCurve: { base: number; perRound: number; cap: number };
  /** War funds granted this round (after anti-snowball modifiers). */
  budget: number;
  /** Budget actually committed to attacks. */
  committed: number;
  /** Budget wasted this round (could not be converted to whole units). */
  scrapped: number;
  /** Per-branch ledgers, including closed branches (share 0). */
  ledgers: Record<string, BranchLedger>;
  /** Branches the enemy has paid to open. */
  openBranches: string[];
  /** Highest targeting doctrine tier unlocked. */
  targetingTier: number;
  /** Tier unlocked this round, if any — drives the one-round reduced-weight
   *  fairness rule and the discovery beat. */
  targetingDebut: number | null;
  /** Node ids fielded at least once, so first-appearance caps fire exactly
   *  once per node. */
  nodesFielded: string[];
  /** Node ids that debuted this round (for AAR discovery cards). */
  nodeDebuts: string[];
  /** Round the current purchases were committed FOR. Planning a different
   *  round means procurement has not run for it — which happens when a save
   *  from before the economy existed is resumed — and the planner runs a
   *  catch-up buy rather than fielding an empty round. */
  plannedForRound: number;
}

export interface IntelWarning {
  /** Which track the warning is about. */
  track: keyof EvolutionTracks;
  text: string;
  confidencePct: number;
}

export interface RoundMetrics {
  round: number;
  interceptRate: number; // intercepted / missiles spawned (1 if none spawned)
  formation: FormationId;
  mineDetectRate: number; // revealed / total (-1 if no mines)
  /** Detected+destroyed / launched (-1 if no torpedoes ran). Drives the torpedo
   *  branch's escalation toward low-signature casings, the same way
   *  mineDetectRate drives the mine branch's. */
  torpedoDetectRate: number;
  valueSent: number;
  deliveredFraction: number;
  /** Weighted result each enemy branch produced this round (kills + damage),
   *  keyed by branch. This is the numerator of ROI — without it the enemy
   *  cannot tell which of its attacks is actually paying. */
  branchResults?: Record<string, { result: number; kills: number }>;
}

export interface EvolutionState {
  /** Derived read-out of cumulative branch spend (see EvolutionTracks). */
  tracks: EvolutionTracks;
  /** The enemy's procurement economy — what actually decides its attacks. */
  economy: EnemyEconomyState;
  /** Round on which the player first encountered each tech (for fairness caps). */
  firstSeen: Partial<Record<TechKey, number>>;
  metrics: RoundMetrics[];
  pendingWarnings: IntelWarning[];
  /** A note about how the enemy is adapting to the player's recent formation
   *  choices (null = no notable formation-driven adaptation this round). */
  formationTell: string | null;
}

// ---------------------------------------------------------------------------
// After-action report
// ---------------------------------------------------------------------------

export type AarCardKind =
  | 'loss'
  | 'discovery'
  | 'warning'
  | 'quota'
  | 'capacity'
  | 'research'
  | 'info'
  | 'salvage'
  | 'rescue';

export interface AarCard {
  kind: AarCardKind;
  title: string;
  body: string;
}

export interface AfterActionReport {
  round: number;
  stats: TransitStats;
  /** Cash the round earned. Cargo delivered × the delivery rate, and nothing
   *  else — every number the economy shows the player is one they can derive
   *  themselves. */
  cashEarned: number;
  confidenceChange: number;
  confidenceAfter: number;
  capacityIncreased: boolean;
  quota: { windowRound: number; earned: number; needed: number; evaluated: boolean; met: boolean };
  cards: AarCard[];
  /** True when the regional run ended this round (defeat OR completion). */
  campaignOver: boolean;
  /** How it ended, mirrored from the run state for the report screen. */
  runOutcome: 'active' | 'defeat' | 'victory';
  /** Options in the technology draft this round earned (0 = run over or
   *  catalogue exhausted). */
  draftSize: number;
}

// ---------------------------------------------------------------------------
// Campaign
// ---------------------------------------------------------------------------

export interface QuotaWindow {
  /** Rounds remaining in the current 3-round window (counts down). */
  roundsLeft: number;
  pointsNeeded: number;
  pointsEarned: number;
}

export interface RoundSummary {
  round: number;
  launched: number;
  delivered: number;
  lost: number;
  valueDelivered: number;
  cashEarned: number;
}

/** A ship lost during a transit, with the cause, for the game log. */
export interface ShipLoss {
  name: string;
  classId: ShipClassId;
  cause: string;
}

/** One escort's identity and fit, recorded per round so performance can be
 *  attributed to a specific ship and a specific loadout. */
export interface EscortLoadoutTelemetry {
  id: number;
  name: string;
  modules: EscortModuleId[];
}

/** What one escort actually did during a transit. Keyed by unit id so a
 *  campaign log can answer "was fitting the deck gun to Sentinel worth it"
 *  rather than only "did the fleet shoot anything". */
export interface EscortPerformance {
  id: number;
  name: string;
  modules: EscortModuleId[];
  /** Missile interceptors — built in, so this is every escort's baseline. */
  intercepts: number;
  /** Attack boats destroyed by this escort's deck gun. */
  boatKills: number;
  /** Torpedoes destroyed by this escort's depth charges. */
  torpedoKills: number;
  /** Mines cleared by drones this escort launched. */
  minesSwept: number;
  /** Hull damage this escort absorbed, and whether it survived the transit. */
  damageTaken: number;
  lost: boolean;
}

/** Player-counter snapshot recorded per round in the game log. */
export interface CounterTelemetry {
  /** Equipment by platform at round start. */
  equipped: {
    cargo: Record<ShipClassId, ModuleId[]>;
    /** One entry per escort, so a log records WHICH escort carried what rather
     *  than one fleet-wide list. Reading back whether a specialist loadout paid
     *  off needs the loadouts kept apart. */
    escorts: EscortLoadoutTelemetry[];
    bases: BaseModuleId[];
    abilities: string[];
  };
  /** Active research split by hardware nodes vs tactics. */
  activeNodes: ResearchId[];
  activeTactics: ResearchId[];
  /** Cash spent this round, attributed to counter branches. */
  spendByBranch: Record<string, number>;
  /** Munitions bought this round / expended this transit, by counter type. */
  ammo: {
    interceptorBought: number;
    interceptorUsed: number;
    droneBought: number;
    droneUsed: number;
    selfDefenseBought: number;
    selfDefenseUsed: number;
    gunShellsBought: number;
    gunShellsUsed: number;
  };
  stats: CounterRoundStats;
}

/** Rich per-round record accumulated across the whole campaign and exported
 *  as the downloadable game log so a playtester's session can be analyzed. */
export interface RoundTelemetry {
  round: number;
  formation: FormationId;
  transitSeconds: number;
  launched: number;
  delivered: number;
  lost: number;
  deliveredPct: number;
  valueSent: number;
  valueDelivered: number;
  missilesSpawned: number;
  missilesIntercepted: number;
  baseIntercepts: number;
  escortIntercepts: number;
  pdKills: number;
  interceptMisses: number;
  ammoUsed: number;
  warthogUsed: number;
  /** Mines and boats destroyed by A-10 gun runs this round. */
  warthogKills: number;
  scanUsed: number;
  minesTotal: number;
  minesRevealed: number;
  minesDetonated: number;
  minesSwept: number;
  torpedoesLaunched: number;
  torpedoesDetected: number;
  torpedoesHit: number;
  torpedoesDestroyed: number;
  boatsLaunched: number;
  boatsSunk: number;
  boatKills: number;
  shipsCaptured: number;
  shellsFired: number;
  shellHits: number;
  batteriesDestroyed: number;
  smokeCloudsLaid: number;
  concealedSeconds: number;
  reconPlanes: number;
  disablingDrones: number;
  aircraftDowned: number;
  shipDisabledSeconds: number;
  /** Escorts destroyed this transit. */
  escortsLost: number;
  /** Shore batteries destroyed this transit. */
  basesLost: number;
  /** Launcher-offline events (escort or battery hit). */
  launchersDisabled: number;
  losses: ShipLoss[];
  cashEarned: number;
  confidenceBefore: number;
  confidenceAfter: number;
  capacity: number;
  capacityIncreased: boolean;
  basesOwned: number;
  escortsOwned: number;
  /** Technologies held at round end (drafted + granted base entries). */
  completedResearch: ResearchId[];
  /** Wreckage generated, recovered and abandoned this round, with the branch
   *  breakdown and the escort time it cost — the recovery half of the new
   *  loop's telemetry. */
  wreckageSpawned: number;
  wreckageRecovered: number;
  wreckageExpired: number;
  wreckageByBranch: Record<string, number>;
  recoveryEscortSeconds: number;
  /** Survivors generated, rescued and lost this round. */
  survivorsSpawned: number;
  survivorsRescued: number;
  survivorsLost: number;
  /** The draft this round earned (options offered; pick recorded when made). */
  draftOffered: ResearchId[];
  enemyTracks: EvolutionTracks;
  newDiscoveries: TechKey[];
  /** What each escort individually did this transit, keyed by unit id. Paired
   *  with `counters.equipped.escorts` (the fit at round start) this is what
   *  makes a specialist loadout evaluable: the fleet aggregate cannot say which
   *  hull earned the kills. Escorts lost mid-transit still appear, flagged. */
  escortPerformance: EscortPerformance[];
  /** Player-counter side of the seesaw (equipment, spend, per-weapon stats). */
  counters: CounterTelemetry;
  /** ENEMY side of the seesaw — the instrumentation docs/SEESAW.md required
   *  before the arms race could be evaluated rather than inferred. */
  enemy: EnemyRoundTelemetry;
}

/** Per-round record of the enemy's procurement economy: what it was given,
 *  where it put the money, what that bought, what it earned, and what it
 *  wasted. Together with the player-side block this makes both ends of the
 *  seesaw measurable in the same log. */
export interface EnemyRoundTelemetry {
  /** War funds granted for this round (after anti-snowball modifiers). */
  budget: number;
  /** Budget actually committed to attacks. */
  committed: number;
  /** Budget that could not be converted into whole units — wasted. */
  scrapped: number;
  /** Per-branch: spend, units fielded by node, ROI earned, kills, scrap. */
  branches: Record<
    string,
    {
      spend: number;
      share: number;
      units: Record<string, number>;
      roi: number;
      kills: number;
      result: number;
      scrap: number;
      roundsInvested: number;
    }
  >;
  /** Branches the enemy has paid to open. */
  openBranches: string[];
  /** Node ids fielded for the first time this round. */
  nodeDebuts: string[];
  /** Current shared Targeting Doctrine rung, and its human-readable name. */
  targetingTier: number;
  targetingName: string;
}

/** The active REGIONAL RUN. Everything in here is temporary to one attempt at
 *  one region: it is created when the run starts and cleared when the run is
 *  lost or the region is completed. Permanent progress lives in the separate
 *  CommanderProfile (src/sim/commander.ts) — keeping the two layers apart is a
 *  core architectural requirement of the roguelite redesign. The name
 *  CampaignState is retained so the sim/UI surface area stays familiar. */
export interface CampaignState {
  version: number;
  seed: string;
  /** Region this run is being fought in (key into data/regions.ts). */
  regionId: string;
  /** Commander Ability loadout locked in for this run at run start. */
  commanderAbilities: string[];
  /** Escort legacies equipped for this run, snapshotted from the profile at
   *  region start, and the ones whose ship has since gone down. A spent legacy
   *  is never reassigned: a replacement hull is a new ship with a new crew. */
  escortLegacies: string[];
  spentLegacies: string[];
  /** True for a developer/test run — enables the dev tools and, with godMode,
   *  invincible ships & unlimited munitions. Never set on a normal campaign. */
  dev?: boolean;
  /** Dev invincibility: ships/escorts/batteries take no damage and munitions are
   *  effectively unlimited during transit. Only meaningful when dev is true. */
  godMode?: boolean;
  /** Round about to be played (1-based). */
  round: number;
  phase: 'prep' | 'transit' | 'aar' | 'draft';
  cash: number;
  score: number;
  capacity: number;
  confidence: number;
  /** Consecutive rounds with >= 85% ships delivered (drives capacity growth). */
  strongStreak: number;
  /** True once the run has ended — through defeat OR region completion. */
  campaignOver: boolean;
  /** How the run stands: fighting, lost, or region completed. */
  runOutcome: 'active' | 'defeat' | 'victory';
  /** Which failure system ended a defeated run. */
  defeatCause: 'confidence' | 'quota' | null;
  /** Mandatory technology draft awaiting a pick (null = none pending). */
  pendingDraft: TechDraft | null;
  /** Banked draft rerolls, earned by pulling crews out of the water. */
  draftRerolls: number;
  /** Every draft offered this run, with what was picked (telemetry). */
  draftHistory: DraftRecord[];
  /** What each enemy branch has actually done to this run — the primary
   *  signal the draft weights against, so the technology on offer tracks the
   *  threats the player is really facing. */
  threatPressure: Record<string, ThreatPressure>;
  /** How much of each enemy branch the player is actually neutralizing. The
   *  draft weights on the GAP between pressure and coverage, so a threat that
   *  keeps getting through keeps drawing offers even when the player already
   *  owns something that nominally counters it. */
  threatCoverage: Record<string, ThreatCoverage>;
  /** Round each technology was last OFFERED (whether or not it was taken), so
   *  the draft can avoid re-offering the same entry every round and the pity
   *  rule can tell "never offered" from "offered and declined". */
  lastOfferedRound: Record<string, number>;
  /** Wreckage recovered across the whole run, by enemy branch. */
  wreckageRecovered: Record<string, number>;
  /** Crew-rescue totals across the run (drives records + AAR framing). */
  crewRescue: { rescued: number; lost: number };
  /** The run's cumulative hull ledger — every merchant sailed and every one
   *  that did not arrive. This is what the CONFIDENCE CEILING is read from:
   *  the consortium's highest opinion of you is your record, not your last
   *  round. See CAMPAIGN.confidenceCeilingLossDrag. */
  record: { launched: number; lost: number };
  /** True once this run's ending has been applied to the Commander Profile,
   *  so a reload of the final report can never award XP twice. */
  profileApplied: boolean;
  /** Ships owned per class. */
  fleet: Record<ShipClassId, number>;
  /** Ships assigned to the next convoy per class. */
  composition: Record<ShipClassId, number>;
  /** Module templates applied per ship class. */
  classModules: Record<ShipClassId, ModuleId[]>;
  /** Equipment units the drafts have delivered. Modules are no longer bought:
   *  the draft grants a UNIT, and the unit is fitted and refitted for free. */
  moduleStock: ModuleStock;
  /** Shore-base loadout template (applies to every battery; limited slots). */
  baseModules: BaseModuleId[];
  /** Accumulated unrepaired hull damage across the fleet. */
  pendingDamage: number;
  /** Unrepaired hull damage carried by the shore batteries. */
  baseDamage: number;
  /** Fixed shore batteries: unlimited range, long reload. */
  bases: number;
  /** The escort flotilla — every escort individually named and fitted.
   *
   *  This replaced a count plus one shared `escortModules` template. Under the
   *  template every escort carried the same loadout and was recreated as an
   *  interchangeable unit each round, so "three escorts" could only ever mean
   *  three copies of one design. Owning the units directly is what lets a
   *  flotilla specialise — a gun boat, a submarine hunter and a minesweeper —
   *  and what keeps a name, a loadout and accumulated damage attached to the
   *  same ship from round to round. */
  escortUnits: EscortUnit[];
  /** Monotonic source of EscortUnit ids. Never reused, so a sunk escort's id
   *  cannot be confused with its replacement's in saves or telemetry. */
  nextEscortId: number;
  /** Every escort name this run has ever issued, including those of ships that
   *  have since gone down. A name is never reissued: a replacement hull under
   *  a sunk ship's name made the debrief read as though she had survived, and
   *  hid the fact that her fitted equipment went down with her. */
  usedEscortNames: string[];
  ammo: number;
  /** Minesweeper-drone munitions in stock. Bought in prep; only escorts launch
   *  drones, and each launch spends one. Unused stock carries between rounds. */
  droneAmmo: number;
  /** Self-defense rounds in stock. Bought in prep; each module shot spends one.
   *  Unused stock carries between rounds. (Field name kept from the old
   *  point-defense system for save compatibility.) */
  pdAmmo: number;
  /** A-10 sorties and scan pulses in stock. Bought in preparation, spent on
   *  use, carried over when unused — the same contract as every other
   *  consumable above. They used to refill for free every round once the
   *  capability was unlocked, which put the two most flexible tools in the game
   *  outside the economy every other counter competes inside. Research now
   *  raises how many can be HELD (see warthogCapacity / scanCapacity) rather
   *  than handing out a fresh allowance. */
  warthogStock: number;
  scanStock: number;
  smokeStock: number;
  /** Deck-gun shells in stock: bought in preparation, drawn one per round
   *  fired, carried over when unused — same contract as the other consumables.
   *  The gun hardware comes from the draft; the shells never do. */
  gunAmmo: number;
  /** Convoy-wide assets: owned => the capability is commissioned and its
   *  ordnance can be bought. */
  warthogUnlocked: boolean;
  scanUnlocked: boolean;
  sonarUnlocked: boolean;
  smokeUnlocked: boolean;
  hardenedUnlocked: boolean;
  /** Automation preferences (persist between rounds; default on when the
   *  tactic is researched). */
  autoFire: Record<AutoSystem, boolean>;
  /** Hardened systems: sensor families chosen to stay alive through jamming
   *  (picked pre-round; capacity from the researched nodes). */
  protectedChannels: SensorFamily[];
  formation: FormationId;
  /** Player preference for which threat a tap on a cluster of missiles
   *  selects: nearest first, ship-aimed missiles before base-aimed ones, or
   *  guided (advanced) missiles before unguided ones. Purely a UI/input
   *  preference — does not change sim behavior, only which threat a tap
   *  resolves to. Persists across rounds like formation. */
  targetPriority: TargetPriority;
  /** Technologies acquired THIS RUN (drafted; granted entries derive on top).
   *  Reset with the run — the build does not carry between regions. */
  completedResearch: ResearchId[];
  /** Cash spent this prep, attributed to counter branches (telemetry). */
  roundSpend: Record<string, number>;
  /** Munitions bought this prep (telemetry). */
  roundAmmoBought: { interceptor: number; drone: number; selfDefense: number; gun: number };
  evolution: EvolutionState;
  quota: QuotaWindow;
  /** Rubber-band multiplier applied when sizing the NEXT quota window off the
   *  player's recent output — rises on an easy clear, falls on a miss. See
   *  CAMPAIGN.quotaDifficulty* in tuning.ts. */
  quotaDifficulty: number;
  history: RoundSummary[];
  /** Full per-round telemetry for the downloadable game log. */
  telemetry: RoundTelemetry[];
  /** Last AAR, kept for the report screen after a reload. */
  lastReport: AfterActionReport | null;
}

// Re-export the tier type so sim-facing code has one import site.
export type { StatTier };
