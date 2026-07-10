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
  /** Formation slot offset relative to convoy anchor. */
  slotDx: number;
  slotDy: number;
  /** Transient lateral offset used to steer around revealed mines. */
  avoidDy: number;
  /** Seconds of burning remaining (damage over time). */
  fireSeconds: number;
  /** Point-defense cooldown timer. */
  pdCooldown: number;
  /** True when the ship has fallen behind its formation slot. */
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
  /** Horizontal / vertical spacing between formation slots. */
  spacingX: number;
  spacingY: number;
  /** Ships per column (grid height). */
  rows: number;
  /** Multiplier on splash / tanker-explosion collateral radius. */
  collateralMult: number;
  /** Chance a ship successfully steers clear of a revealed mine in its path. */
  mineAvoidChance: number;
}

// ---------------------------------------------------------------------------
// Threats
// ---------------------------------------------------------------------------

export type ThreatKind = 'missile' | 'guidedMissile' | 'mine';

/** Discovery keys — includes variants that reveal enemy evolution. */
export type TechKey = 'missile' | 'guidedMissile' | 'mine' | 'lowSigMine' | 'saturation';

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
  /** Ship this threat is homing on / was aimed at. */
  targetShipId?: number;
  /** Straight-line aim point for unguided missiles. */
  targetX?: number;
  targetY?: number;
  /** Mines: hidden until detected. */
  revealed: boolean;
  /** Low-signature mines resist standard detection. */
  lowSig: boolean;
  /** Set when an interceptor is currently en route to this threat. */
  claimedByInterceptor: boolean;
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
}

export interface Interceptor {
  id: number;
  x: number;
  y: number;
  targetThreatId: number;
  speed: number;
}

// ---------------------------------------------------------------------------
// Transit state & commands
// ---------------------------------------------------------------------------

export type TransitCommand =
  | { type: 'intercept'; threatId: number }
  | { type: 'ability'; ability: 'ecm' | 'scan' }
  | { type: 'formation'; formation: FormationId }
  | { type: 'lane'; direction: -1 | 1 };

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
  missilesIntercepted: number; // player interceptors + point defense
  playerIntercepts: number;
  pdKills: number;
  minesTotal: number;
  minesRevealed: number;
  minesDetonated: number;
  minesSwept: number;
  ammoUsed: number;
  ecmUsed: number;
  scanUsed: number;
}

/** Research-derived combat effects, baked once at transit creation. */
export interface CombatEffects {
  interceptHitBonus: number;
  interceptorSpeedMult: number;
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
  /** Scan pulse also destroys revealed mines in radius. */
  scanSweeps: boolean;
  /** Fires extinguish themselves quickly. */
  autoExtinguish: boolean;
  /** Sensors research: draw target-vector lines for inbound missiles. */
  showTargetVectors: boolean;
}

export interface TransitState {
  time: number;
  over: boolean;
  /** Convoy anchor position (formation slots are relative to this). */
  anchorX: number;
  laneY: number;
  targetLaneY: number;
  laneIndex: number;
  formation: FormationId;
  /** Seconds remaining during which ships are re-forming (slower). */
  reforming: number;
  ships: Ship[];
  escorts: Escort[];
  threats: Threat[];
  interceptors: Interceptor[];
  ammo: number;
  ecmCharges: number;
  ecmActiveUntil: number;
  scanCharges: number;
  /** Pending enemy spawns, sorted by time. */
  spawnQueue: SpawnEvent[];
  events: TransitEvent[];
  stats: TransitStats;
  effects: CombatEffects;
  /** Convoy base speed (slowest ship class present). */
  baseSpeed: number;
  nextEntityId: number;
  /** Memoized per ship-mine pair: did this crew spot the mine in time? */
  avoidRolls: Record<string, boolean>;
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
  /** Accumulated unrepaired hull damage across the fleet. */
  pendingDamage: number;
  escorts: number;
  ammo: number;
  /** Convoy-wide assets: owned => charges refresh each round. */
  ecmUnlocked: boolean;
  scanUnlocked: boolean;
  formation: FormationId;
  completedResearch: ResearchId[];
  activeResearch: { id: ResearchId; roundsLeft: number } | null;
  evolution: EvolutionState;
  quota: QuotaWindow;
  history: RoundSummary[];
  /** Last AAR, kept for the report screen after a reload. */
  lastReport: AfterActionReport | null;
}
