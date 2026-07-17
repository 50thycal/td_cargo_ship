// Shared type definitions for the entire simulation. The sim layer never
// touches the DOM — every type here is plain data so the core can be ported
// to another engine (SpriteKit, Godot) without changes to the design.

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

export type ModuleId =
  | 'pointDefense'
  | 'missileWarning'
  | 'reinforcedHull'
  | 'mineSonar'
  | 'fireSuppression';

export interface ModuleDef {
  id: ModuleId;
  name: string;
  desc: string;
  /** Cash cost per ship equipped. */
  costPerShip: number;
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
  /** Point-defense cooldown timer. */
  pdCooldown: number;
  /** Point-defense shots remaining this transit. Refills each round; a hard
   *  per-transit magazine so ship self-defense is a limited resource, not a
   *  free auto-turret. Only meaningful when the ship carries a pointDefense
   *  module. */
  pdShots: number;
  /** True when the ship has fallen well behind its own expected pace
   *  (damage or being blocked by another ship), not behind a formation slot. */
  straggling: boolean;
}

// ---------------------------------------------------------------------------
// Formations
// ---------------------------------------------------------------------------

export type FormationId = 'tight' | 'wide' | 'sprint';

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
  /** Multiplier on defensive REACH: point-defense radius and escort interceptor
   *  range. Tight overlaps coverage (>1); Wide stretches it thin (<1). */
  defenseRangeMult: number;
  /** Radius (world units) of the bonus splash a DIRECT missile/guided hit deals
   *  to neighboring hulls — the downside of bunching up. 0 = hits stay isolated. */
  chainSplashRadius: number;
}

// ---------------------------------------------------------------------------
// Threats
// ---------------------------------------------------------------------------

export type ThreatKind = 'missile' | 'guidedMissile' | 'mine';

/** Discovery keys — includes variants that reveal enemy evolution. */
export type TechKey = 'missile' | 'guidedMissile' | 'mine' | 'lowSigMine' | 'saturation';

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
  /** Mines: hidden until detected. */
  revealed: boolean;
  /** Low-signature mines resist standard detection. */
  lowSig: boolean;
  /** Set when an interceptor is currently en route to this threat. */
  claimedByInterceptor: boolean;
  /** Seconds this missile has spent inside an active ECM jamming orbit. Once it
   *  crosses the jam threshold the seeker cooks off and the missile explodes. */
  jamSeconds?: number;
}

export interface SpawnEvent {
  time: number;
  kind: 'missile' | 'guidedMissile';
  /** Launch site x position along the hostile shore. */
  siteX: number;
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
}

/** 'pd' = an automatic ship point-defense tracer (no ammo, its own hit roll). */
export type LauncherKind = 'base' | 'escort' | 'pd';

export interface Interceptor {
  id: number;
  x: number;
  y: number;
  targetThreatId: number;
  speed: number;
  /** Which launcher fired it (for telemetry attribution). */
  launcher: LauncherKind;
  /** Overrides the default per-launcher hit chance (used by point defense). */
  hitChance?: number;
}

/** An autonomous minesweeper drone: flies from an escort to a revealed mine
 *  and detonates it. Unlocked by mine-warfare research; each launch consumes a
 *  purchased drone munition. */
export interface Drone {
  id: number;
  x: number;
  y: number;
  targetMineId: number;
  speed: number;
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

// ---------------------------------------------------------------------------
// Transit state & commands
// ---------------------------------------------------------------------------

export type TransitCommand =
  | { type: 'intercept'; threatId: number }
  /** Send a minesweeper drone at a charted mine (from the nearest in-range
   *  escort). Player-directed, like an intercept but for mines. */
  | { type: 'sweepMine'; threatId: number }
  /** Placed ability: x/y is where the player put the effect on the map. */
  | { type: 'ability'; ability: 'ecm' | 'scan'; x: number; y: number }
  /** Send an escort to a point. hold=false → resume forward on arrival;
   *  hold=true → stay stationed there. */
  | { type: 'moveEscort'; escortId: number; x: number; y: number; hold: boolean };

export type TransitEventType =
  | 'delivered'
  | 'shipLost'
  | 'shipHit'
  | 'intercepted'
  | 'pdKill'
  | 'interceptMiss'
  | 'missileMiss'
  | 'mineRevealed'
  | 'mineSwept'
  | 'mineDetonated'
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

export interface TransitStats {
  launched: number;
  delivered: number;
  lost: number;
  valueSent: number;
  valueDelivered: number;
  missilesSpawned: number;
  missilesIntercepted: number; // player interceptors + point defense + ECM jamming
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
  ammoUsed: number;
  ecmUsed: number;
  scanUsed: number;
  /** Escorts destroyed during the transit (lost from the fleet). */
  escortsLost: number;
  /** Shore batteries destroyed during the transit (lost from the fleet). */
  basesLost: number;
  /** Times a launcher (escort or battery) was knocked offline by a hit. */
  launchersDisabled: number;
}

/** Research-derived combat effects, baked once at transit creation. */
export interface CombatEffects {
  interceptHitBonus: number;
  /** Speed multiplier for shore-battery interceptors — scales strongly with
   *  interception research (batteries are the fast, upgradeable launcher). */
  baseInterceptorSpeedMult: number;
  /** Speed multiplier for escort-launched interceptors — the slower, shorter-
   *  ranged ship-mounted launcher; barely scales with research. */
  escortInterceptorSpeedMult: number;
  escortCooldownMult: number;
  /** Mine-detection radius for ships WITHOUT sonar (0 = cannot detect). */
  baseDetectRadius: number;
  /** Multiplier on sonar module detection radius. */
  sonarRadiusMult: number;
  /** Whether standard detection can see low-signature mines. */
  detectLowSig: boolean;
  /** Multiplier on all damage taken by ships. */
  damageTakenMult: number;
  /** Guided-missile terminal hit chance while ECM is active. */
  ecmGuidedHitChance: number;
  /** Mine-warfare research: the player can send minesweeper drones at charted
   *  mines (tap a revealed mine, drone launches from the nearest in-range escort). */
  sweepDrones: boolean;
  /** Fires extinguish themselves quickly. */
  autoExtinguish: boolean;
  /** Sensors research: draw target-vector lines for inbound missiles. */
  showTargetVectors: boolean;
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
  interceptors: Interceptor[];
  drones: Drone[];
  /** Support aircraft in flight (scan / ECM planes). */
  aircraft: Aircraft[];
  ammo: number;
  /** Drone munitions remaining: each minesweeper drone launch consumes one. */
  droneAmmo: number;
  /** Point-defense rounds remaining: each turret shot draws from this pool. */
  pdAmmo: number;
  ecmCharges: number;
  /** Transit time until which an ECM plane is deployed (blocks a second call). */
  ecmActiveUntil: number;
  /** Where the active ECM jamming orbit is centered. */
  ecmCenterX: number;
  ecmCenterY: number;
  scanCharges: number;
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
// Research
// ---------------------------------------------------------------------------

export type ResearchBranch =
  | 'sensors'
  | 'interception'
  | 'mineWarfare'
  | 'resilience'
  | 'electronicWarfare'
  | 'logistics';

export type ResearchId =
  | 'sensors1'
  | 'sensors2'
  | 'sensors3'
  | 'intercept1'
  | 'intercept2'
  | 'mines1'
  | 'resilience1'
  | 'resilience2'
  | 'ew1'
  | 'logistics1';

export interface ResearchDef {
  id: ResearchId;
  branch: ResearchBranch;
  name: string;
  desc: string;
  /** Intel cost to start. */
  cost: number;
  /** Prerequisite within the same branch. */
  requires?: ResearchId;
}

// ---------------------------------------------------------------------------
// Enemy evolution
// ---------------------------------------------------------------------------

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
  mineDetectRate: number; // revealed / total (1 if no mines)
  valueSent: number;
  deliveredFraction: number;
}

export interface EvolutionState {
  tracks: EvolutionTracks;
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
}

export interface CampaignState {
  version: number;
  seed: string;
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
  /** Point-defense rounds in stock. Bought in prep; each turret shot spends one.
   *  Unused stock carries between rounds. */
  pdAmmo: number;
  /** Convoy-wide assets: owned => charges refresh each round. */
  ecmUnlocked: boolean;
  scanUnlocked: boolean;
  formation: FormationId;
  completedResearch: ResearchId[];
  activeResearch: { id: ResearchId; roundsLeft: number } | null;
  evolution: EvolutionState;
  quota: QuotaWindow;
  history: RoundSummary[];
  /** Full per-round telemetry for the downloadable game log. */
  telemetry: RoundTelemetry[];
  /** Last AAR, kept for the report screen after a reload. */
  lastReport: AfterActionReport | null;
}
