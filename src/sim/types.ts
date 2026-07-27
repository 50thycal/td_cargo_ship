// Shared type definitions for the entire simulation. The sim layer never
// touches the DOM — every type here is plain data so the core can be ported
// to another engine (SpriteKit, Godot) without changes to the design.

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
export type EscortModuleId = 'deckGun' | 'mcmDroneLauncher' | 'depthCharges';

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
  /** Flat cash cost to fit the escort loadout template. */
  cost: number;
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
  /** Escort/base this missile is aimed at (when targetKind is escort/base). */
  targetEntityId?: number;
  /** Straight-line aim point for unguided missiles. */
  targetX?: number;
  targetY?: number;
  /** Mines & torpedoes: hidden until detected. */
  revealed: boolean;
  /** Low-signature variants resist standard detection (mines today;
   *  wakeless torpedoes when the enemy branch lands). */
  lowSig: boolean;
  /** Set when an interceptor is currently en route to this threat. */
  claimedByInterceptor: boolean;
  /** Seconds this missile has spent inside an active ECM jamming orbit. Once it
   *  crosses the jam threshold the seeker cooks off and the missile explodes. */
  jamSeconds?: number;
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
  /** True once a hold order has been reached: the escort holds position. */
  stationed: boolean;
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
  targetMineId: number;
  speed: number;
  /** Moving-target guidance: keeps tracking a drifting mine after launch. */
  tracking: boolean;
}

/** A lobbed depth-charge round: flies to the tapped water point, then
 *  detonates, destroying torpedoes inside the blast area. Never locks on. */
export interface DepthChargeShot {
  id: number;
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
 *  down a chosen lane charting mines in that lane only; ECM planes fly to a
 *  water station, orbit while jamming inbound missiles, then depart. */
export interface Aircraft {
  id: number;
  role: 'scan' | 'ecm';
  x: number;
  y: number;
  heading: number;
  /** inbound → fly to the work area; onStation → do the job; departing → leave. */
  phase: 'inbound' | 'onStation' | 'departing';
  /** Scan: the lane-center Y the plane sweeps along. */
  laneY: number;
  /** ECM: center of the jamming orbit. */
  centerX: number;
  centerY: number;
  /** ECM: current orbit angle (radians). */
  orbitAngle: number;
  /** ECM: transit time at which the plane breaks orbit and departs. */
  stationUntil: number;
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
  | { type: 'ability'; ability: 'ecm' | 'scan' | 'sonar' | 'smoke'; x: number; y: number }
  /** Hardened systems: spend an emergency-reboot charge to shorten an active
   *  sensor-jamming blackout. */
  | { type: 'reboot' }
  /** Toggle an automation tactic on/off. Never affects manual fire. */
  | { type: 'toggleAuto'; system: AutoSystem; enabled: boolean }
  /** Send an escort to a point. hold=false → resume forward on arrival;
   *  hold=true → stay stationed there. */
  | { type: 'moveEscort'; escortId: number; x: number; y: number; hold: boolean };

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
  | 'launchFailed'
  | 'techDebut';

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
    ecm: { available: number; used: number };
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
  missilesIntercepted: number; // player interceptors + self-defense + ECM jamming
  playerIntercepts: number;
  baseIntercepts: number;
  escortIntercepts: number;
  interceptMisses: number;
  pdKills: number;
  /** Missiles destroyed by lingering inside an ECM jamming orbit. */
  ecmKills: number;
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
  ecmUsed: number;
  scanUsed: number;
  /** Escorts destroyed during the transit (lost from the fleet). */
  escortsLost: number;
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
  /** Seconds the placed effect lasts (sonar track / smoke cloud / ECM orbit). */
  duration: number;
  /** Extra seconds a revealed contact stays precisely tracked. */
  persistence: number;
  unlockedLowSig: boolean;
}

/** Research-derived combat effects, baked once at transit creation. Every
 *  number here was resolved from a stat tier in the data layer — the sim only
 *  consumes finished values. */
export interface CombatEffects {
  /** Global damage multiplier (1 normally; 0 in dev god mode). Per-ship
   *  compartmentalization applies separately, only to equipped hulls. */
  damageTakenMult: number;
  /** Guided-missile terminal hit chance while ECM is active. */
  ecmGuidedHitChance: number;
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

  abilities: {
    ecm: AbilityEffects;
    scan: AbilityEffects;
    sonar: AbilityEffects;
    smoke: AbilityEffects;
  };
}

export interface TransitState {
  time: number;
  over: boolean;
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
  /** Support aircraft in flight (scan / ECM planes). */
  aircraft: Aircraft[];
  /** Placed area effects with lifetimes (active-sonar pings, smoke clouds). */
  areaEffects: AreaEffect[];
  /** Artillery shells in flight. Kept out of `threats` on purpose — see Shell. */
  shells: Shell[];
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
  ecmCharges: number;
  /** Transit time until which an ECM plane is deployed (blocks a second call). */
  ecmActiveUntil: number;
  /** Where the active ECM jamming orbit is centered. */
  ecmCenterX: number;
  ecmCenterY: number;
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
// Research (counter branches — see src/data/counters.ts for the catalogue)
// ---------------------------------------------------------------------------

/** Research entries are `<branch>.<node>` strings defined in the counter
 *  catalogue (src/data/counters.ts). The old 10-entry linear tree's ids are
 *  migrated by the save layer. */
export type ResearchId = string;

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

export type AarCardKind = 'loss' | 'discovery' | 'warning' | 'quota' | 'capacity' | 'research' | 'info';

export interface AarCard {
  kind: AarCardKind;
  title: string;
  body: string;
}

export interface AfterActionReport {
  round: number;
  stats: TransitStats;
  cashEarned: number;
  intelEarned: number;
  confidenceChange: number;
  confidenceAfter: number;
  capacityIncreased: boolean;
  researchCompleted?: ResearchId;
  quota: { windowRound: number; earned: number; needed: number; evaluated: boolean; met: boolean };
  cards: AarCard[];
  campaignOver: boolean;
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
  intelEarned: number;
}

/** A ship lost during a transit, with the cause, for the game log. */
export interface ShipLoss {
  name: string;
  classId: ShipClassId;
  cause: string;
}

/** Player-counter snapshot recorded per round in the game log. */
export interface CounterTelemetry {
  /** Equipment by platform at round start. */
  equipped: {
    cargo: Record<ShipClassId, ModuleId[]>;
    escorts: EscortModuleId[];
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
  ecmUsed: number;
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
  intelEarned: number;
  confidenceBefore: number;
  confidenceAfter: number;
  capacity: number;
  capacityIncreased: boolean;
  basesOwned: number;
  escortsOwned: number;
  researchCompleted: ResearchId | null;
  activeResearch: ResearchId | null;
  completedResearch: ResearchId[];
  enemyTracks: EvolutionTracks;
  newDiscoveries: TechKey[];
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

export interface CampaignState {
  version: number;
  seed: string;
  /** True for a developer/test run — enables the dev tools and, with godMode,
   *  invincible ships & unlimited munitions. Never set on a normal campaign. */
  dev?: boolean;
  /** Dev invincibility: ships/escorts/batteries take no damage and munitions are
   *  effectively unlimited during transit. Only meaningful when dev is true. */
  godMode?: boolean;
  /** Round about to be played (1-based). */
  round: number;
  phase: 'prep' | 'transit' | 'aar' | 'research';
  cash: number;
  intel: number;
  score: number;
  capacity: number;
  confidence: number;
  /** Consecutive rounds with >= 85% ships delivered (drives capacity growth). */
  strongStreak: number;
  campaignOver: boolean;
  /** Ships owned per class. */
  fleet: Record<ShipClassId, number>;
  /** Ships assigned to the next convoy per class. */
  composition: Record<ShipClassId, number>;
  /** Module templates applied per ship class. */
  classModules: Record<ShipClassId, ModuleId[]>;
  /** Cash paid to equip each currently-fitted module, per class. Lets an
   *  unequip refund exactly what was spent (so loadouts can be experimented
   *  with freely without opening a buy-low / refund-high exploit). */
  modulePaid: Record<ShipClassId, Partial<Record<ModuleId, number>>>;
  /** Escort loadout template (applies to every escort; limited slots). */
  escortModules: EscortModuleId[];
  escortModulePaid: Partial<Record<EscortModuleId, number>>;
  /** Shore-base loadout template (applies to every battery; limited slots). */
  baseModules: BaseModuleId[];
  baseModulePaid: Partial<Record<BaseModuleId, number>>;
  /** Accumulated unrepaired hull damage across the fleet. */
  pendingDamage: number;
  /** Unrepaired hull damage carried by the escort ships (repaired like hulls). */
  escortDamage: number;
  /** Unrepaired hull damage carried by the shore batteries. */
  baseDamage: number;
  /** Fixed shore batteries: unlimited range, long reload. */
  bases: number;
  /** Escort ships: limited range, fast reload. Not free at campaign start. */
  escorts: number;
  ammo: number;
  /** Minesweeper-drone munitions in stock. Bought in prep; only escorts launch
   *  drones, and each launch spends one. Unused stock carries between rounds. */
  droneAmmo: number;
  /** Self-defense rounds in stock. Bought in prep; each module shot spends one.
   *  Unused stock carries between rounds. (Field name kept from the old
   *  point-defense system for save compatibility.) */
  pdAmmo: number;
  /** Convoy-wide assets: owned => charges refresh each round. */
  ecmUnlocked: boolean;
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
  completedResearch: ResearchId[];
  activeResearch: { id: ResearchId; roundsLeft: number } | null;
  /** Cash spent this prep, attributed to counter branches (telemetry). */
  roundSpend: Record<string, number>;
  /** Munitions bought this prep (telemetry). */
  roundAmmoBought: { interceptor: number; drone: number; selfDefense: number };
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
