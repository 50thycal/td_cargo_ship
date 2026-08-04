// The player-counter catalogue: Category → Branch → Nodes → Tactics.
// This is the data-driven replacement for the old 10-entry linear research
// tree. Each BRANCH is one counter family on one platform, declaring which
// enemy branch it answers, what it may target, its hardware-node progression
// (qualitative stat tiers) and its tactic progression (how it is operated).
//
// docs/PLAYER_COUNTERS.md is the design source; docs/ENEMY_ATTACKS.md is the
// locked enemy side. Rules enforced HERE (not in scattered UI checks):
//  • target compatibility (WEAPON_TARGETS / canEngage) — the sim validates
//    against this, so a missile interceptor can never be aimed at a torpedo;
//  • equipment gating (a module cannot be bought before its base node);
//  • every tier→number conversion (via statTiers.ts) — the sim only ever
//    consumes finished numbers out of deriveCounterEffects().

import { tierValue, type StatTier } from './statTiers';
import { ENEMY_BRANCHES } from './enemyBranches';
import { COMBAT } from './tuning';
import type {
  BaseModuleId,
  CombatEffects,
  EscortModuleId,
  ModuleId,
  ResearchId,
  ThreatKind,
} from '../sim/types';

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export type CounterCategoryId =
  | 'missileDefense'
  | 'mineWarfare'
  | 'torpedoWarfare'
  | 'antiSurface'
  | 'counterArtillery'
  | 'concealment'
  | 'electronicDefense'
  | 'damageControl'
  | 'support';

export type CounterBranchId =
  | 'escortInterceptor'
  | 'baseInterceptor'
  | 'selfDefense'
  | 'missileWarning'
  | 'mineSonar'
  | 'mcmDrones'
  | 'scanPulse'
  | 'hydrophone'
  | 'depthCharges'
  | 'activeSonar'
  | 'deckGun'
  | 'antiBoarding'
  | 'counterBattery'
  | 'thermalImaging'
  | 'smokeScreen'
  | 'flak'
  | 'hardened'
  | 'warthog'
  | 'reinforcedHull'
  | 'fireSuppression'
  | 'compartmentalization'
  | 'logistics';

/** Enemy branches from docs/ENEMY_ATTACKS.md (the locked catalogue). */
export type EnemyBranchKey =
  | 'missiles'
  | 'mines'
  | 'torpedoes'
  | 'attackBoats'
  | 'artillery'
  | 'smoke'
  | 'electronic';

export type PlatformKind = 'cargoModule' | 'escort' | 'shoreBase' | 'convoy';
export type CounterRole = 'detect' | 'attack' | 'mitigate' | 'disrupt' | 'support';

/** The player weapon families the compatibility matrix is keyed on. */
export type PlayerWeaponKind =
  | 'interceptor'
  | 'selfDefense'
  | 'mcmDrone'
  | 'depthCharge'
  | 'deckGun'
  | 'counterBattery'
  | 'flak'
  | 'gunRun';

export const COUNTER_CATEGORY_NAMES: Record<CounterCategoryId, string> = {
  missileDefense: 'Missile Defense',
  mineWarfare: 'Mine Warfare',
  torpedoWarfare: 'Torpedo Warfare',
  antiSurface: 'Anti-Surface Warfare',
  counterArtillery: 'Counter-Artillery',
  concealment: 'Smoke & Concealment',
  electronicDefense: 'Electronic Attack & Drones',
  damageControl: 'Hull & Damage Control',
  support: 'Logistics & Support',
};

export const ENEMY_BRANCH_NAMES: Record<EnemyBranchKey, string> = {
  missiles: 'Missiles',
  mines: 'Mines',
  torpedoes: 'Torpedoes',
  attackBoats: 'Attack Boats',
  artillery: 'Artillery',
  smoke: 'Smoke / Concealment',
  electronic: 'Electronic Attack / Drones',
};

// ---------------------------------------------------------------------------
// Target compatibility — THE central rule table
// ---------------------------------------------------------------------------

/** What each player weapon family may engage. The deterministic simulation
 *  rejects anything else — this is not a UI convenience. Notes:
 *   • interceptors/self-defense: missiles only, never torpedoes, mines, boats,
 *     artillery, smoke or jamming;
 *   • depth charges: torpedoes only (an area blast, mines are NOT triggered);
 *   • deck guns: attack boats only;
 *   • counter-battery: targets INSTALLATIONS (artillery positions), never
 *     Threat objects — its entry here is empty by design;
 *   • flak: enemy aircraft; ship-disabling drones require the proximity-fuse
 *     node (see canEngage);
 *   • gun run (the A-10's 30mm pass): whatever is sitting on or just under the
 *     surface — mines and attack boats. Nothing airborne and nothing running
 *     deep: it cannot touch a missile in flight or a torpedo under the water;
 *   • sensor jamming has no entry anywhere: it is not a shootable object. */
export const WEAPON_TARGETS: Record<PlayerWeaponKind, readonly ThreatKind[]> = {
  interceptor: ['missile', 'guidedMissile'],
  selfDefense: ['missile', 'guidedMissile'],
  mcmDrone: ['mine'],
  depthCharge: ['torpedo'],
  deckGun: ['attackBoat'],
  counterBattery: [],
  flak: ['reconPlane', 'disablingDrone'],
  gunRun: ['mine', 'attackBoat'],
};

/** Central engage check. `researched` matters only for gated variants (flak
 *  needs the proximity-fuse node before it may touch disabling drones). */
export function canEngage(
  weapon: PlayerWeaponKind,
  threatKind: ThreatKind,
  researched?: ReadonlySet<string>,
): boolean {
  if (!WEAPON_TARGETS[weapon].includes(threatKind)) return false;
  if (weapon === 'flak' && threatKind === 'disablingDrone') {
    return !!researched?.has('flak.proximityFuse');
  }
  return true;
}

// ---------------------------------------------------------------------------
// Branch / node / tactic definitions
// ---------------------------------------------------------------------------

/** A qualitative stat assignment: researching the node sets `stat` to `tier`
 *  within the branch (tiers only ever go up; see resolveBranchStats). */
export interface TierSet {
  stat: string;
  tier: StatTier;
}

export interface CounterNodeDef {
  /** Full id: `<branch>.<node>` — this is the ResearchId. */
  id: ResearchId;
  name: string;
  desc: string;
  /** Intel cost (0 for granted entries). */
  cost: number;
  /** Extra prerequisites (ids). Base node + previous chain entry are implied
   *  unless `noChain` is set; parallel tactic paths set noChain. */
  requires?: ResearchId[];
  /** Opt out of the implicit previous-entry chain (parallel paths). */
  noChain?: boolean;
  /** Auto-available once its prerequisites are met (built-in behavior). */
  granted?: boolean;
  /** Qualitative stat-tier assignments this node applies. */
  set?: TierSet[];
  /** Capability flags this node switches on. */
  flags?: string[];
  /** Discrete numeric grants (magazine sizes, charge counts). */
  grant?: Record<string, number>;
}

export type TacticKind = 'manual' | 'automation' | 'info' | 'coordination' | 'mode';

export interface CounterTacticDef extends CounterNodeDef {
  kind: TacticKind;
  /** Mutually exclusive tactic ids (may not be researched together). */
  excludes?: ResearchId[];
}

export interface CounterBranchDef {
  id: CounterBranchId;
  category: CounterCategoryId;
  name: string;
  /** One-line identity for the research screen. */
  short: string;
  platform: PlatformKind;
  role: CounterRole;
  /** Enemy branch(es) this branch answers (empty for generic survivability). */
  counters: EnemyBranchKey[];
  /** Which enemy nodes specifically, in words (UI + doc). */
  countersDetail: string;
  /** Weapon family for attack branches (drives target compatibility). */
  weapon?: PlayerWeaponKind;
  /** Physical equipment this branch needs before it does anything. */
  equipment?:
    | { kind: 'cargoModule'; id: ModuleId }
    | { kind: 'escortModule'; id: EscortModuleId }
    | { kind: 'baseModule'; id: BaseModuleId }
    | { kind: 'ability'; id: 'warthog' | 'scan' | 'sonar' | 'smoke' | 'hardened' }
    | { kind: 'builtIn'; id: 'escort' | 'base' };
  /** Ammunition the branch draws on. */
  ammo: 'interceptor' | 'selfDefense' | 'drone' | 'perRound' | 'none';
  nodes: CounterNodeDef[];
  tactics: CounterTacticDef[];
  /** ladder = tactics chain; parallel = independent paths off the base node. */
  tacticStyle: 'ladder' | 'parallel';
}

/** Convenience for building granted manual-engagement tactics. */
const manualTactic = (branch: string, desc: string): CounterTacticDef => ({
  id: `${branch}.manual`,
  name: 'Manual Engagement',
  desc,
  cost: 0,
  granted: true,
  kind: 'manual',
});

export const COUNTER_BRANCHES: Record<CounterBranchId, CounterBranchDef> = {
  // =========================================================================
  // MISSILE DEFENSE
  // =========================================================================
  escortInterceptor: {
    id: 'escortInterceptor',
    category: 'missileDefense',
    name: 'Escort Missile Interceptors',
    short: 'Mobile, medium-performance missile defense that moves with the convoy.',
    platform: 'escort',
    role: 'attack',
    counters: ['missiles'],
    countersDetail: 'All missile nodes (unguided, guided, sea-skimming, swarm/MIRV).',
    weapon: 'interceptor',
    equipment: { kind: 'builtIn', id: 'escort' },
    ammo: 'interceptor',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'escortInterceptor.base',
        name: 'Base Escort Interceptor',
        desc: 'Medium projectile speed, accuracy, reload and visual size. Limited to the escort’s defensive range; one hit kills one missile.',
        cost: 0,
        granted: true,
        set: [
          { stat: 'speed', tier: 'medium' },
          { stat: 'accuracy', tier: 'medium' },
          { stat: 'reload', tier: 'medium' },
          { stat: 'size', tier: 'medium' },
        ],
      },
      {
        id: 'escortInterceptor.precisionGuidance',
        name: 'Precision Guidance',
        desc: 'Accuracy becomes High.',
        cost: 35,
        set: [{ stat: 'accuracy', tier: 'high' }],
      },
      {
        id: 'escortInterceptor.rapidReload',
        name: 'Rapid-Reload Cells',
        desc: 'Reload speed becomes High.',
        cost: 45,
        set: [{ stat: 'reload', tier: 'high' }],
      },
      {
        id: 'escortInterceptor.advancedSeeker',
        name: 'Advanced Seeker',
        desc: 'Accuracy becomes Extra.',
        cost: 65,
        requires: ['escortInterceptor.precisionGuidance'],
        noChain: true,
        set: [{ stat: 'accuracy', tier: 'extra' }],
      },
      {
        id: 'escortInterceptor.highVelocityMotor',
        name: 'High-Velocity Motor',
        desc: 'Projectile speed becomes High.',
        cost: 50,
        noChain: true,
        set: [{ stat: 'speed', tier: 'high' }],
      },
    ],
    tactics: [
      manualTactic(
        'escortInterceptor',
        'Tap an enemy missile; the nearest ready escort in range fires. Always available.',
      ),
      {
        id: 'escortInterceptor.localAuto',
        name: 'Local Automatic Engagement',
        desc: 'Escorts automatically fire at missiles entering a small defensive radius, on a separate automatic-fire cooldown. Can be switched off.',
        cost: 40,
        kind: 'automation',
        flags: ['auto'],
        set: [{ stat: 'autoCooldown', tier: 'high' }],
      },
      {
        id: 'escortInterceptor.expandedAuto',
        name: 'Expanded Automatic Engagement',
        desc: 'Larger automatic radius, no separate automatic cooldown (reload and ammo still limit), and never double-fires at an already-covered missile.',
        cost: 70,
        kind: 'automation',
        flags: ['autoExpanded', 'autoDedupe'],
      },
    ],
  },

  baseInterceptor: {
    id: 'baseInterceptor',
    category: 'missileDefense',
    name: 'Shore-Base Missile Interceptors',
    short: 'Fast, accurate, full-map missile defense with slow reload.',
    platform: 'shoreBase',
    role: 'attack',
    counters: ['missiles'],
    countersDetail: 'All missile nodes; the map-wide backbone of missile defense.',
    weapon: 'interceptor',
    equipment: { kind: 'builtIn', id: 'base' },
    ammo: 'interceptor',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'baseInterceptor.base',
        name: 'Base Shore Interceptor',
        desc: 'High projectile speed and accuracy, Low reload speed, High visual size. Engages missiles anywhere on the map.',
        cost: 0,
        granted: true,
        set: [
          { stat: 'speed', tier: 'high' },
          { stat: 'accuracy', tier: 'high' },
          { stat: 'reload', tier: 'low' },
          { stat: 'size', tier: 'high' },
        ],
      },
      {
        id: 'baseInterceptor.extendedBurn',
        name: 'Extended-Burn Motor',
        desc: 'Projectile speed becomes Extra.',
        cost: 40,
        set: [{ stat: 'speed', tier: 'extra' }],
      },
      {
        id: 'baseInterceptor.advancedTracking',
        name: 'Advanced Tracking',
        desc: 'Accuracy becomes Extra.',
        cost: 55,
        noChain: true,
        set: [{ stat: 'accuracy', tier: 'extra' }],
      },
      {
        id: 'baseInterceptor.maxVelocity',
        name: 'Maximum-Velocity Interceptor',
        desc: 'Projectile speed becomes Max.',
        cost: 70,
        requires: ['baseInterceptor.extendedBurn'],
        noChain: true,
        set: [{ stat: 'speed', tier: 'max' }],
      },
      {
        id: 'baseInterceptor.improvedLaunchCycle',
        name: 'Improved Launch Cycle',
        desc: 'Reload speed becomes Medium.',
        cost: 60,
        noChain: true,
        set: [{ stat: 'reload', tier: 'medium' }],
      },
    ],
    tactics: [
      manualTactic(
        'baseInterceptor',
        'Tap a missile; the nearest ready base launches. Always available.',
      ),
      {
        id: 'baseInterceptor.strategicAuto',
        name: 'Strategic Automatic Engagement',
        desc: 'Bases automatically engage missiles anywhere on the map, starting with a Max automatic-fire cooldown (separate from reload). Can be switched off.',
        cost: 50,
        kind: 'automation',
        flags: ['auto'],
        set: [{ stat: 'autoCooldown', tier: 'max' }],
      },
      {
        id: 'baseInterceptor.responsiveAuto',
        name: 'Responsive Automatic Engagement',
        desc: 'Automatic-fire cooldown becomes Medium; bases prioritize the missile with the shortest time to impact and skip already-covered threats.',
        cost: 75,
        kind: 'automation',
        flags: ['autoTti', 'autoDedupe'],
        set: [{ stat: 'autoCooldown', tier: 'medium' }],
      },
    ],
  },

  selfDefense: {
    id: 'selfDefense',
    category: 'missileDefense',
    name: 'Cargo-Ship Self-Defense Interceptor',
    short: 'Last-ditch, automatic, short-range self-defense (the evolved point-defense turret).',
    platform: 'cargoModule',
    role: 'attack',
    counters: ['missiles'],
    countersDetail: 'Terminal defense vs all missile nodes; the answer to sea-skimmers that beat long-range interceptors.',
    weapon: 'selfDefense',
    equipment: { kind: 'cargoModule', id: 'selfDefense' },
    ammo: 'selfDefense',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'selfDefense.base',
        name: 'Base Self-Defense Interceptor',
        desc: 'Automatic by default. Medium accuracy, High tracer speed, Low reload speed and Low range; one shot per equipped ship per round; one hit kills one missile.',
        cost: 35,
        set: [
          { stat: 'accuracy', tier: 'medium' },
          { stat: 'speed', tier: 'high' },
          { stat: 'range', tier: 'low' },
        ],
        grant: { magazine: 1 },
      },
      {
        id: 'selfDefense.extendedEnvelope',
        name: 'Extended Engagement Envelope',
        desc: 'Range becomes Medium.',
        cost: 30,
        set: [{ stat: 'range', tier: 'medium' }],
      },
      {
        id: 'selfDefense.improvedFireControl',
        name: 'Improved Fire Control',
        desc: 'Accuracy becomes High.',
        cost: 40,
        noChain: true,
        set: [{ stat: 'accuracy', tier: 'high' }],
      },
      {
        id: 'selfDefense.precisionTerminal',
        name: 'Precision Terminal Tracking',
        desc: 'Accuracy becomes Extra.',
        cost: 65,
        requires: ['selfDefense.improvedFireControl'],
        noChain: true,
        set: [{ stat: 'accuracy', tier: 'extra' }],
      },
      {
        id: 'selfDefense.longRangeCid',
        name: 'Long-Range Close-In Defense',
        desc: 'Range becomes High (within the short cargo-module range domain).',
        cost: 55,
        requires: ['selfDefense.extendedEnvelope'],
        noChain: true,
        set: [{ stat: 'range', tier: 'high' }],
      },
      {
        id: 'selfDefense.dualShot',
        name: 'Dual-Shot Magazine',
        desc: 'Each equipped ship gets two shots per round.',
        cost: 60,
        noChain: true,
        grant: { magazine: 2 },
      },
    ],
    tactics: [
      {
        id: 'selfDefense.autoFire',
        name: 'Base Automatic Fire',
        desc: 'The module automatically protects its ship when a valid missile enters range. No separate tactic effect.',
        cost: 0,
        granted: true,
        kind: 'automation',
      },
      {
        id: 'selfDefense.threatDesignator',
        name: 'Threat Designator',
        desc: 'Highlights the missile the module intends to engage at ~2× firing range — warning before the shot, no accuracy or range change.',
        cost: 25,
        kind: 'info',
        flags: ['designator'],
      },
      {
        id: 'selfDefense.engagementPredictor',
        name: 'Engagement Predictor',
        desc: 'Shows the projected engagement line and whether the module is loaded, empty or reloading. Informational only.',
        cost: 25,
        kind: 'info',
        flags: ['predictor'],
      },
      {
        id: 'selfDefense.coordinatedFire',
        name: 'Coordinated Fire Control',
        desc: 'Modules reserve targets before firing, never double up when a likely kill is inbound, and prioritize missiles hunting their own ship, then lowest time-to-impact.',
        cost: 55,
        requires: ['selfDefense.threatDesignator'],
        kind: 'coordination',
        flags: ['coordinated'],
      },
    ],
  },

  missileWarning: {
    id: 'missileWarning',
    category: 'missileDefense',
    name: 'Missile-Warning Receiver',
    short: 'Detects and communicates missile threats. It does not shoot.',
    platform: 'cargoModule',
    role: 'detect',
    counters: ['missiles'],
    countersDetail: 'Detection/information for every missile node; sea-skimmer node restores the stolen reaction window.',
    equipment: { kind: 'cargoModule', id: 'missileWarning' },
    ammo: 'none',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'missileWarning.base',
        name: 'Base Missile-Warning Receiver',
        desc: 'Identifies missiles targeting the equipped ship at Medium warning range; gives defending interceptors a Low accuracy assist.',
        cost: 25,
        set: [
          { stat: 'range', tier: 'medium' },
          { stat: 'assist', tier: 'low' },
        ],
      },
      {
        id: 'missileWarning.longRange',
        name: 'Long-Range Warning',
        desc: 'Warning range becomes High.',
        cost: 30,
        set: [{ stat: 'range', tier: 'high' }],
      },
      {
        id: 'missileWarning.precisionTrack',
        name: 'Precision Track Solution',
        desc: 'Defensive interceptor assistance becomes High.',
        cost: 45,
        noChain: true,
        set: [{ stat: 'assist', tier: 'high' }],
      },
      {
        id: 'missileWarning.seaSkimmer',
        name: 'Sea-Skimmer Warning',
        desc: 'Detects sea-skimming missiles earlier, restoring part of the reaction window their approach profile steals.',
        cost: 55,
        noChain: true,
        flags: ['seaSkimmer'],
      },
      {
        id: 'missileWarning.networked',
        name: 'Networked Warning',
        desc: 'Shares the ship’s threat track with nearby escorts and bases (the assist applies to their fire too).',
        cost: 50,
        noChain: true,
        flags: ['networked'],
      },
    ],
    tactics: [
      {
        id: 'missileWarning.targetVector',
        name: 'Target Vector',
        desc: 'Draws a clear line from each inbound missile toward its intended target.',
        cost: 20,
        kind: 'info',
        flags: ['targetVector'],
      },
      {
        id: 'missileWarning.impactUrgency',
        name: 'Impact Urgency',
        desc: 'The warning marker pulses with estimated time to impact — readable at a glance, no numbers.',
        cost: 25,
        kind: 'info',
        flags: ['urgency'],
      },
      {
        id: 'missileWarning.defensePriority',
        name: 'Defense Priority Tag',
        desc: 'Marks the threat as priority for manual and automatic defenses. Affects target selection only, never accuracy.',
        cost: 35,
        kind: 'coordination',
        flags: ['priorityTag'],
      },
    ],
  },

  // =========================================================================
  // MINE WARFARE
  // =========================================================================
  mineSonar: {
    id: 'mineSonar',
    category: 'mineWarfare',
    name: 'Mine-Detection Sonar',
    short: 'Detects mines. It does not clear them.',
    platform: 'cargoModule',
    role: 'detect',
    counters: ['mines'],
    countersDetail: 'Standard mines at base; low-signature via Composite-Signature Analysis; drifting via Drift Tracking.',
    equipment: { kind: 'cargoModule', id: 'mineSonar' },
    ammo: 'none',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'mineSonar.base',
        name: 'Base Mine Sonar',
        desc: 'Detects standard mines at Low range.',
        cost: 25,
        set: [{ stat: 'radius', tier: 'low' }],
      },
      {
        id: 'mineSonar.improvedRange',
        name: 'Improved Sonar Range',
        desc: 'Detection range becomes Medium.',
        cost: 30,
        set: [{ stat: 'radius', tier: 'medium' }],
      },
      {
        id: 'mineSonar.longRange',
        name: 'Long-Range Sonar',
        desc: 'Detection range becomes High.',
        cost: 45,
        set: [{ stat: 'radius', tier: 'high' }],
      },
      {
        id: 'mineSonar.compositeSignature',
        name: 'Composite-Signature Analysis',
        desc: 'Detects low-signature mines.',
        cost: 60,
        noChain: true,
        requires: ['mineSonar.improvedRange'],
        flags: ['lowSig'],
      },
      {
        id: 'mineSonar.driftTracking',
        name: 'Drift Tracking',
        desc: 'Keeps updating a drifting mine’s position after detection — a revealed drifter never freezes at its old spot.',
        cost: 45,
        noChain: true,
        flags: ['drift'],
      },
    ],
    tactics: [
      {
        id: 'mineSonar.passive',
        name: 'Passive Detection',
        desc: 'Revealed mines become visible and are always steered around.',
        cost: 0,
        granted: true,
        kind: 'info',
      },
      {
        id: 'mineSonar.dangerEnvelope',
        name: 'Danger Envelope',
        desc: 'Shows each revealed mine’s trigger area, so course changes around them are legible.',
        cost: 20,
        kind: 'info',
        flags: ['dangerEnvelope'],
      },
      {
        id: 'mineSonar.driftVector',
        name: 'Drift Vector',
        desc: 'Displays the estimated movement direction of a drifting mine.',
        cost: 25,
        requires: ['mineSonar.driftTracking'],
        noChain: true,
        kind: 'info',
        flags: ['driftVector'],
      },
      {
        id: 'mineSonar.sharedPicture',
        name: 'Shared Sonar Picture',
        desc: 'Every hull contributes a short-range contact feed, so a mine found once stays found for the whole convoy.',
        cost: 40,
        noChain: true,
        kind: 'coordination',
        flags: ['sharedPicture'],
      },
    ],
  },

  mcmDrones: {
    id: 'mcmDrones',
    category: 'mineWarfare',
    name: 'Escort Mine-Countermeasure Drones',
    short: 'Destroys already-detected mines. Detection and clearing stay separate.',
    platform: 'escort',
    role: 'attack',
    counters: ['mines'],
    countersDetail: 'All mine nodes — once detected. A drone can never be sent at an unrevealed mine.',
    weapon: 'mcmDrone',
    equipment: { kind: 'escortModule', id: 'mcmDroneLauncher' },
    ammo: 'drone',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'mcmDrones.base',
        name: 'Base Minesweeper Drone',
        desc: 'Tap a revealed mine; the nearest ready escort in range launches. Low launch range, Medium drone speed, Low reload speed; one drone kills one mine; each launch spends a purchased munition.',
        cost: 40,
        set: [
          { stat: 'launchRange', tier: 'low' },
          { stat: 'droneSpeed', tier: 'medium' },
          { stat: 'reload', tier: 'low' },
        ],
        grant: { sorties: 1 },
      },
      {
        id: 'mcmDrones.extendedLink',
        name: 'Extended Control Link',
        desc: 'Launch range becomes Medium.',
        cost: 30,
        set: [{ stat: 'launchRange', tier: 'medium' }],
      },
      {
        id: 'mcmDrones.fastDrone',
        name: 'Fast-Response Drone',
        desc: 'Drone speed becomes High.',
        cost: 35,
        noChain: true,
        set: [{ stat: 'droneSpeed', tier: 'high' }],
      },
      {
        id: 'mcmDrones.improvedSortie',
        name: 'Improved Sortie Cycle',
        desc: 'Reload speed becomes Medium.',
        cost: 35,
        noChain: true,
        set: [{ stat: 'reload', tier: 'medium' }],
      },
      {
        id: 'mcmDrones.movingTarget',
        name: 'Moving-Target Guidance',
        desc: 'A drone keeps tracking a drifting mine after launch.',
        cost: 40,
        noChain: true,
        flags: ['movingTarget'],
      },
      {
        id: 'mcmDrones.dualSortie',
        name: 'Dual-Sortie Rack',
        desc: 'Two ready launches before the launcher must fully cycle.',
        cost: 55,
        noChain: true,
        grant: { sorties: 2 },
      },
    ],
    tactics: [
      {
        id: 'mcmDrones.manual',
        name: 'Manual Mine Selection',
        desc: 'Tap a revealed mine to send a drone. Always available.',
        cost: 0,
        granted: true,
        kind: 'manual',
      },
      {
        id: 'mcmDrones.riskDesignator',
        name: 'Risk Designator',
        desc: 'Highlights revealed mines that intersect (or will intersect) a convoy route.',
        cost: 25,
        kind: 'info',
        flags: ['riskDesignator'],
      },
      {
        id: 'mcmDrones.localAuto',
        name: 'Local Automatic Clearance',
        desc: 'An escort may automatically launch at a revealed mine entering a small defensive zone, on a separate Max automatic-fire cooldown. Can be switched off.',
        cost: 45,
        kind: 'automation',
        flags: ['auto'],
        set: [{ stat: 'autoCooldown', tier: 'max' }],
      },
      {
        id: 'mcmDrones.coordinated',
        name: 'Coordinated Mine Clearance',
        desc: 'Escorts never send two drones at one mine; drifting mines and earliest convoy intersections go first.',
        cost: 40,
        requires: ['mcmDrones.riskDesignator'],
        kind: 'coordination',
        flags: ['coordinated'],
      },
    ],
  },

  scanPulse: {
    id: 'scanPulse',
    category: 'mineWarfare',
    name: 'Scan Pulse',
    short: 'Placed, charge-based sweep that temporarily reveals mines in a chosen lane.',
    platform: 'convoy',
    role: 'detect',
    counters: ['mines'],
    countersDetail: 'Standard mines at base; low-signature via Composite Scan Processing.',
    equipment: { kind: 'ability', id: 'scan' },
    ammo: 'perRound',
    tacticStyle: 'parallel',
    nodes: [
      {
        id: 'scanPulse.base',
        name: 'Base Scan Pulse',
        desc: 'Reveals standard mines along the swept lane. Two charges per round.',
        cost: 0,
        granted: true,
        grant: { charges: 2 },
      },
      {
        id: 'scanPulse.compositeScan',
        name: 'Composite Scan Processing',
        desc: 'Can reveal low-signature mines; full reliability when Composite-Signature Analysis is also researched.',
        cost: 50,
        flags: ['lowSig'],
      },
      {
        id: 'scanPulse.persistentTrack',
        name: 'Persistent Mine Track',
        desc: 'Revealed contacts stay charted longer; drifting mines keep updating during the persistence window.',
        cost: 40,
        noChain: true,
        flags: ['persistent'],
      },
    ],
    tactics: [
      {
        id: 'scanPulse.extraCharge',
        name: 'Additional Charge',
        desc: 'Two charges become three.',
        cost: 45,
        noChain: true,
        kind: 'mode',
        grant: { charges: 3 },
      },
      {
        id: 'scanPulse.expandedCoverage',
        name: 'Expanded Coverage',
        desc: 'The swept band and reveal radius grow.',
        cost: 40,
        noChain: true,
        kind: 'mode',
        flags: ['wide'],
      },
      {
        id: 'scanPulse.longerPersistence',
        name: 'Longer Track Persistence',
        desc: 'Revealed contacts remain visible longer.',
        cost: 35,
        noChain: true,
        kind: 'mode',
        flags: ['longTrack'],
      },
    ],
  },

  // =========================================================================
  // TORPEDO WARFARE
  // =========================================================================
  hydrophone: {
    id: 'hydrophone',
    category: 'torpedoWarfare',
    name: 'Hydrophone',
    short: 'Detects torpedoes in the underwater domain. It does not destroy them.',
    platform: 'cargoModule',
    role: 'detect',
    counters: ['torpedoes'],
    countersDetail: 'Standard & homing torpedo noise at base; wakeless low-signature torpedoes via Low-Signature Processing.',
    equipment: { kind: 'cargoModule', id: 'hydrophone' },
    ammo: 'none',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'hydrophone.base',
        name: 'Base Hydrophone',
        desc: 'Detects standard and homing torpedo noise at Medium range — initially an approximate bearing, not a precise fix.',
        cost: 30,
        set: [{ stat: 'range', tier: 'medium' }],
      },
      {
        id: 'hydrophone.improvedLocalization',
        name: 'Improved Localization',
        desc: 'Narrows the bearing uncertainty.',
        cost: 30,
        flags: ['localization'],
      },
      {
        id: 'hydrophone.longRange',
        name: 'Long-Range Hydrophone',
        desc: 'Detection range becomes High.',
        cost: 45,
        noChain: true,
        set: [{ stat: 'range', tier: 'high' }],
      },
      {
        id: 'hydrophone.lowSigProcessing',
        name: 'Low-Signature Processing',
        desc: 'Detects low-signature torpedoes that leave no visible wake.',
        cost: 60,
        noChain: true,
        requires: ['hydrophone.improvedLocalization'],
        flags: ['lowSig'],
      },
      {
        id: 'hydrophone.precisionTrack',
        name: 'Precision Track',
        desc: 'Converts a bearing contact into a precise track suitable for depth-charge prediction.',
        cost: 50,
        noChain: true,
        requires: ['hydrophone.improvedLocalization'],
        flags: ['precisionTrack'],
      },
    ],
    tactics: [
      {
        id: 'hydrophone.bearingCone',
        name: 'Bearing Cone',
        desc: 'Shows the approximate direction a torpedo is approaching from.',
        cost: 0,
        granted: true,
        kind: 'info',
      },
      {
        id: 'hydrophone.projectedPath',
        name: 'Projected Torpedo Path',
        desc: 'Once localized, shows the torpedo’s projected path through the convoy.',
        cost: 30,
        kind: 'info',
        flags: ['projectedPath'],
      },
      {
        id: 'hydrophone.sharedPicture',
        name: 'Shared Underwater Picture',
        desc: 'Nearby hydrophones combine information on the same contact — clarity, not a hidden accuracy bonus.',
        cost: 35,
        noChain: true,
        kind: 'coordination',
        flags: ['shared'],
      },
    ],
  },

  depthCharges: {
    id: 'depthCharges',
    category: 'torpedoWarfare',
    name: 'Escort Depth-Charge Launcher',
    short: 'Lobbed area weapon that destroys torpedoes. Completely separate from missile interceptors.',
    platform: 'escort',
    role: 'attack',
    counters: ['torpedoes'],
    countersDetail: 'All torpedo nodes — an area blast at a tapped point in the water, never a lock-on.',
    weapon: 'depthCharge',
    equipment: { kind: 'escortModule', id: 'depthCharges' },
    ammo: 'perRound',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'depthCharges.base',
        name: 'Base Depth-Charge Launcher',
        desc: 'Tap a point in the water (not the torpedo). Low launch range, Medium blast radius, Low reload speed, one launch per escort per round. The blast destroys torpedoes inside its area.',
        cost: 45,
        set: [
          { stat: 'throwRange', tier: 'low' },
          { stat: 'blastRadius', tier: 'medium' },
          { stat: 'reload', tier: 'low' },
        ],
        grant: { magazine: 1 },
      },
      {
        id: 'depthCharges.extendedThrow',
        name: 'Extended Throw Range',
        desc: 'Launch range becomes Medium.',
        cost: 30,
        set: [{ stat: 'throwRange', tier: 'medium' }],
      },
      {
        id: 'depthCharges.expandedPattern',
        name: 'Expanded Charge Pattern',
        desc: 'Blast radius becomes High.',
        cost: 45,
        noChain: true,
        set: [{ stat: 'blastRadius', tier: 'high' }],
      },
      {
        id: 'depthCharges.improvedReload',
        name: 'Improved Reload System',
        desc: 'Reload speed becomes Medium.',
        cost: 35,
        noChain: true,
        set: [{ stat: 'reload', tier: 'medium' }],
      },
      {
        id: 'depthCharges.dualRack',
        name: 'Dual-Charge Rack',
        desc: 'Two launches per escort per round.',
        cost: 50,
        noChain: true,
        grant: { magazine: 2 },
      },
      {
        id: 'depthCharges.patternSalvo',
        name: 'Pattern Salvo',
        desc: 'Places a short line of charges instead of one point — for uncertain hydrophone contacts. Never a full-map torpedo deletion tool.',
        cost: 65,
        noChain: true,
        requires: ['depthCharges.expandedPattern', 'depthCharges.dualRack'],
        flags: ['pattern'],
      },
    ],
    tactics: [
      {
        id: 'depthCharges.manualPlacement',
        name: 'Manual Area Placement',
        desc: 'Tap the water to place the attack — no missile-style lock-on. Always available.',
        cost: 0,
        granted: true,
        kind: 'manual',
      },
      {
        id: 'depthCharges.nearestReady',
        name: 'Nearest-Ready Launcher',
        desc: 'The nearest escort able to reach the tapped point fires. Built into the fire-control from the start.',
        cost: 0,
        granted: true,
        kind: 'mode',
      },
      {
        id: 'depthCharges.leadSolution',
        name: 'Lead Solution',
        desc: 'Shows a predicted detonation point from the torpedo’s current track. No blast or damage change.',
        cost: 30,
        kind: 'info',
        flags: ['leadSolution'],
      },
      {
        id: 'depthCharges.localAutoDrop',
        name: 'Local Automatic Drop',
        desc: 'An escort automatically drops charges when a DETECTED torpedo enters a small emergency radius, on a separate automatic-fire cooldown. Can be switched off.',
        cost: 50,
        kind: 'automation',
        flags: ['auto'],
        set: [{ stat: 'autoCooldown', tier: 'high' }],
      },
      {
        id: 'depthCharges.coordinatedAsw',
        name: 'Coordinated ASW',
        desc: 'Escorts avoid overlapping depth-charge patterns unless focus coverage is explicitly ordered.',
        cost: 40,
        kind: 'coordination',
        flags: ['coordinated'],
      },
    ],
  },

  activeSonar: {
    id: 'activeSonar',
    category: 'torpedoWarfare',
    name: 'Active Sonar Ping',
    short: 'Placed, charge-based ping that actively reveals torpedoes in an area.',
    platform: 'convoy',
    role: 'detect',
    counters: ['torpedoes'],
    countersDetail: 'Standard & homing torpedoes at base; low-signature via Return Processing.',
    equipment: { kind: 'ability', id: 'sonar' },
    ammo: 'perRound',
    tacticStyle: 'parallel',
    nodes: [
      {
        id: 'activeSonar.base',
        name: 'Base Active Sonar Ping',
        desc: 'Reveals standard and homing torpedoes inside the placed area. Two charges per round.',
        cost: 35,
        grant: { charges: 2 },
      },
      {
        id: 'activeSonar.lowSigReturn',
        name: 'Low-Signature Return Processing',
        desc: 'Reveals low-signature torpedoes.',
        cost: 50,
        flags: ['lowSig'],
      },
      {
        id: 'activeSonar.precisionPersistence',
        name: 'Precision Track Persistence',
        desc: 'Contacts remain precisely tracked for a period after the ping.',
        cost: 40,
        noChain: true,
        flags: ['persistent'],
      },
    ],
    tactics: [
      {
        id: 'activeSonar.extraCharge',
        name: 'Additional Charge',
        desc: 'Two charges become three.',
        cost: 40,
        noChain: true,
        kind: 'mode',
        grant: { charges: 3 },
      },
      {
        id: 'activeSonar.expandedCoverage',
        name: 'Expanded Coverage',
        desc: 'Ping radius becomes larger.',
        cost: 35,
        noChain: true,
        kind: 'mode',
        flags: ['wide'],
      },
      {
        id: 'activeSonar.longerTrack',
        name: 'Longer Track Duration',
        desc: 'Tracks last longer after the ping.',
        cost: 35,
        noChain: true,
        kind: 'mode',
        flags: ['longTrack'],
      },
    ],
  },

  // =========================================================================
  // ANTI-SURFACE WARFARE (enemy branch designed, not yet fielded)
  // =========================================================================
  deckGun: {
    id: 'deckGun',
    category: 'antiSurface',
    name: 'Escort Deck Gun / Autocannon',
    short: 'Destroys attack boats through sustained fire. Boats are persistent HP targets, not one-tap projectiles.',
    platform: 'escort',
    role: 'attack',
    counters: ['attackBoats'],
    countersDetail: 'Small-arms boats at base; rocket & boarding variants stay killable with Armor-Piercing Ammunition.',
    weapon: 'deckGun',
    equipment: { kind: 'escortModule', id: 'deckGun' },
    ammo: 'none',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'deckGun.base',
        name: 'Base Deck Gun',
        desc: 'Medium range, accuracy and damage with a High firing rate. Stays committed to a selected boat until it sinks, leaves range, or is re-tasked.',
        cost: 40,
        set: [
          { stat: 'range', tier: 'medium' },
          { stat: 'accuracy', tier: 'medium' },
          { stat: 'damage', tier: 'medium' },
          { stat: 'rate', tier: 'high' },
        ],
      },
      {
        id: 'deckGun.stabilizedMount',
        name: 'Stabilized Mount',
        desc: 'Accuracy becomes High.',
        cost: 30,
        set: [{ stat: 'accuracy', tier: 'high' }],
      },
      {
        id: 'deckGun.heavyAutocannon',
        name: 'Heavy Autocannon',
        desc: 'Damage becomes High.',
        cost: 45,
        noChain: true,
        set: [{ stat: 'damage', tier: 'high' }],
      },
      {
        id: 'deckGun.longRangeFireControl',
        name: 'Long-Range Fire Control',
        desc: 'Range becomes High.',
        cost: 40,
        noChain: true,
        set: [{ stat: 'range', tier: 'high' }],
      },
      {
        id: 'deckGun.rapidFeed',
        name: 'Rapid Ammunition Feed',
        desc: 'Firing rate becomes Extra.',
        cost: 50,
        noChain: true,
        set: [{ stat: 'rate', tier: 'extra' }],
      },
      {
        id: 'deckGun.armorPiercing',
        name: 'Armor-Piercing Ammunition',
        desc: 'Keeps full damage against the tougher rocket and boarding variants. Not a one-shot kill.',
        cost: 55,
        noChain: true,
        flags: ['ap'],
      },
    ],
    tactics: [
      {
        id: 'deckGun.manual',
        name: 'Manual Target Designation',
        desc: 'Select the boat; the gun stays committed until the engagement ends. Always available.',
        cost: 0,
        granted: true,
        kind: 'manual',
      },
      {
        id: 'deckGun.autoNearest',
        name: 'Automatic Nearest-Boat Engagement',
        desc: 'Ready guns engage the nearest valid attack boat. Can be switched off or manually overridden.',
        cost: 40,
        kind: 'automation',
        flags: ['auto'],
      },
      {
        id: 'deckGun.focusFire',
        name: 'Focus Fire',
        desc: 'Designate one boat for multiple ready escort guns — for boarding boats and other urgent targets.',
        cost: 35,
        kind: 'mode',
        flags: ['focus'],
      },
      {
        id: 'deckGun.distributedFire',
        name: 'Distributed Fire',
        desc: 'The network avoids overkill: guns spread across boats unless focus fire is ordered.',
        cost: 35,
        requires: ['deckGun.autoNearest'],
        noChain: true,
        kind: 'coordination',
        flags: ['distributed'],
      },
      {
        id: 'deckGun.layeredFire',
        name: 'Layered Fire',
        desc: 'Near escorts take boats already closing with the convoy; far escorts take approachers. Target allocation only.',
        cost: 40,
        requires: ['deckGun.distributedFire'],
        noChain: true,
        kind: 'coordination',
        flags: ['layered'],
      },
    ],
  },

  antiBoarding: {
    id: 'antiBoarding',
    category: 'antiSurface',
    name: 'Anti-Boarding Countermeasures',
    short: 'Specifically counters the Boarding Boat capture mechanic. Nothing else.',
    platform: 'cargoModule',
    role: 'mitigate',
    counters: ['attackBoats'],
    countersDetail: 'The Boarding Boat node only — no help vs missiles, mines, torpedoes, artillery or ordinary hull damage.',
    equipment: { kind: 'cargoModule', id: 'antiBoarding' },
    ammo: 'none',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'antiBoarding.base',
        name: 'Base Security Detail',
        desc: 'Slows the boarding takeover timer.',
        cost: 30,
        set: [{ stat: 'slow', tier: 'low' }],
      },
      {
        id: 'antiBoarding.reinforcedAccess',
        name: 'Reinforced Access Control',
        desc: 'Slows takeover further.',
        cost: 35,
        set: [{ stat: 'slow', tier: 'high' }],
      },
      {
        id: 'antiBoarding.citadelLockdown',
        name: 'Citadel Lockdown',
        desc: 'Boarding progress pauses temporarily when lockdown activates.',
        cost: 40,
        flags: ['lockdown'],
      },
      {
        id: 'antiBoarding.counterTeam',
        name: 'Counter-Boarding Team',
        desc: 'Boarding progress reverses while the boarding boat is under sustained deck-gun fire.',
        cost: 45,
        noChain: true,
        requires: ['antiBoarding.reinforcedAccess'],
        flags: ['counterTeam'],
      },
      {
        id: 'antiBoarding.emergencyRejection',
        name: 'Emergency Rejection',
        desc: 'Once per round, an equipped ship cancels an almost-complete capture — buying time, not destroying the boat.',
        cost: 55,
        noChain: true,
        requires: ['antiBoarding.citadelLockdown'],
        flags: ['rejection'],
      },
    ],
    tactics: [
      {
        id: 'antiBoarding.alarm',
        name: 'Boarding Alarm',
        desc: 'Clearly highlights the boarded ship and its takeover progress.',
        cost: 0,
        granted: true,
        kind: 'info',
      },
      {
        id: 'antiBoarding.autoPriority',
        name: 'Automatic Threat Priority',
        desc: 'Attached boarding boats get top deck-gun priority.',
        cost: 30,
        kind: 'coordination',
        flags: ['autoPriority'],
      },
      {
        id: 'antiBoarding.responseCue',
        name: 'Escort Response Cue',
        desc: 'Shows which escort or gun group can respond soonest. Informational — nothing teleports.',
        cost: 25,
        kind: 'info',
        flags: ['responseCue'],
      },
    ],
  },

  // =========================================================================
  // COUNTER-ARTILLERY (enemy branch designed, not yet fielded)
  // =========================================================================
  counterBattery: {
    id: 'counterBattery',
    category: 'counterArtillery',
    name: 'Shore Counter-Battery System',
    short: 'Suppresses or destroys hostile artillery positions. Fires at the gun position, never at shells in flight.',
    platform: 'shoreBase',
    role: 'attack',
    counters: ['artillery'],
    countersDetail: 'Coastal guns at base; Ranging Artillery with Extended-Range Fire Control; Rolling Barrage via Barrage Disruption.',
    weapon: 'counterBattery',
    equipment: { kind: 'baseModule', id: 'counterBattery' },
    ammo: 'none',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'counterBattery.base',
        name: 'Base Counter-Battery Fire',
        desc: 'Tap an identified coastal gun position. Medium accuracy, Low reload speed; a successful strike suppresses the position for a limited duration.',
        cost: 45,
        set: [
          { stat: 'accuracy', tier: 'medium' },
          { stat: 'reload', tier: 'low' },
          { stat: 'suppression', tier: 'medium' },
        ],
      },
      {
        id: 'counterBattery.extendedRange',
        name: 'Extended-Range Fire Control',
        desc: 'Can engage the Ranging Artillery node.',
        cost: 40,
        flags: ['ranging'],
      },
      {
        id: 'counterBattery.rapidCounterFire',
        name: 'Rapid Counter-Fire',
        desc: 'Response speed becomes High.',
        cost: 45,
        noChain: true,
        set: [{ stat: 'reload', tier: 'high' }],
      },
      {
        id: 'counterBattery.sustainedSuppression',
        name: 'Sustained Suppression',
        desc: 'Suppression duration becomes High.',
        cost: 40,
        noChain: true,
        set: [{ stat: 'suppression', tier: 'high' }],
      },
      {
        id: 'counterBattery.barrageDisruption',
        name: 'Barrage Disruption',
        desc: 'A successful strike can interrupt or shorten a Rolling Barrage.',
        cost: 55,
        noChain: true,
        requires: ['counterBattery.extendedRange'],
        flags: ['barrage'],
      },
      {
        id: 'counterBattery.coordinatedStrike',
        name: 'Coordinated Battery Strike',
        desc: 'Multiple bases may focus one position; repeated successful strikes destroy it for the round.',
        cost: 60,
        noChain: true,
        requires: ['counterBattery.sustainedSuppression'],
        flags: ['coordinated'],
      },
    ],
    tactics: [
      {
        id: 'counterBattery.manual',
        name: 'Manual Position Selection',
        desc: 'Tap the hostile artillery position. Always available.',
        cost: 0,
        granted: true,
        kind: 'manual',
      },
      {
        id: 'counterBattery.autoReturnFire',
        name: 'Automatic Return Fire',
        desc: 'Automatically targets the most recently firing position, starting with a Max automatic-fire cooldown.',
        cost: 45,
        kind: 'automation',
        flags: ['auto'],
        set: [{ stat: 'autoCooldown', tier: 'max' }],
      },
      {
        id: 'counterBattery.responsiveCounterFire',
        name: 'Responsive Counter-Fire',
        desc: 'Automatic-fire cooldown becomes Medium.',
        cost: 50,
        kind: 'automation',
        set: [{ stat: 'autoCooldown', tier: 'medium' }],
      },
      {
        id: 'counterBattery.focusSuppression',
        name: 'Focus Suppression',
        desc: 'Commit multiple bases to one high-priority artillery position.',
        cost: 35,
        noChain: true,
        kind: 'mode',
        flags: ['focus'],
      },
      {
        id: 'counterBattery.priorityDoctrine',
        name: 'Priority Doctrine',
        desc: 'Choose what auto-fire prioritizes: highest rate of fire, barrage preparation, or the most valuable threatened lane.',
        cost: 40,
        noChain: true,
        requires: ['counterBattery.autoReturnFire'],
        kind: 'mode',
        flags: ['doctrine'],
      },
    ],
  },

  // =========================================================================
  // SMOKE & CONCEALMENT
  // =========================================================================
  thermalImaging: {
    id: 'thermalImaging',
    category: 'concealment',
    name: 'Thermal/Radar Imaging',
    short: 'Sees threats through enemy smoke. Removes nothing, destroys nothing.',
    platform: 'cargoModule',
    role: 'detect',
    counters: ['smoke'],
    countersDetail: 'Screening Smoke at base; Blinding Smoke via Blinding-Smoke Resistance.',
    equipment: { kind: 'cargoModule', id: 'thermalImaging' },
    ammo: 'none',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'thermalImaging.base',
        name: 'Base Thermal/Radar Imaging',
        desc: 'Reveals precise threats inside Screening Smoke at Medium range.',
        cost: 35,
        set: [{ stat: 'range', tier: 'medium' }],
      },
      {
        id: 'thermalImaging.longRange',
        name: 'Long-Range Imaging',
        desc: 'Detection range becomes High.',
        cost: 40,
        set: [{ stat: 'range', tier: 'high' }],
      },
      {
        id: 'thermalImaging.blindingResistance',
        name: 'Blinding-Smoke Resistance',
        desc: 'Maintains useful tracks inside smoke laid over the convoy itself.',
        cost: 50,
        noChain: true,
        flags: ['blinding'],
      },
      {
        id: 'thermalImaging.trackPersistence',
        name: 'Track Persistence',
        desc: 'Keeps a target track briefly after sensor contact is lost.',
        cost: 35,
        noChain: true,
        flags: ['persistence'],
      },
      {
        id: 'thermalImaging.networkedFusion',
        name: 'Networked Sensor Fusion',
        desc: 'Shares smoke-penetrating tracks with nearby defenses.',
        cost: 45,
        noChain: true,
        flags: ['networked'],
      },
    ],
    tactics: [
      {
        id: 'thermalImaging.silhouette',
        name: 'Precise In-Smoke Silhouette',
        desc: 'Replaces the faint bearing marker with a clear target marker when the module holds a valid track.',
        cost: 0,
        granted: true,
        kind: 'info',
      },
      {
        id: 'thermalImaging.launchOrigin',
        name: 'Launch-Origin Trace',
        desc: 'Shows roughly where a hidden threat emerged from.',
        cost: 25,
        kind: 'info',
        flags: ['origin'],
      },
      {
        id: 'thermalImaging.protectedVector',
        name: 'Protected Target Vector',
        desc: 'Keeps showing the target vector while the threat is inside smoke.',
        cost: 30,
        kind: 'info',
        flags: ['protectedVector'],
      },
    ],
  },

  smokeScreen: {
    id: 'smokeScreen',
    category: 'concealment',
    name: 'Player Smoke Screen',
    short: 'Placed, charge-based cloud that degrades the enemy’s shared Targeting Doctrine.',
    platform: 'convoy',
    role: 'disrupt',
    counters: ['missiles', 'artillery', 'torpedoes', 'attackBoats'],
    countersDetail: 'Degrades the shared Targeting Doctrine (finish-the-wounded, high-value, isolation, deny-the-delivery) for ships inside — destroys nothing, blocks nothing outright.',
    equipment: { kind: 'ability', id: 'smoke' },
    ammo: 'perRound',
    tacticStyle: 'parallel',
    nodes: [
      {
        id: 'smokeScreen.base',
        name: 'Base Defensive Smoke',
        desc: 'Enemy attacks against ships inside the cloud use a one-tier-less-sophisticated targeting preference.',
        cost: 40,
        grant: { charges: 2 },
      },
      {
        id: 'smokeScreen.dense',
        name: 'Dense Defensive Smoke',
        desc: 'Targeting degradation becomes stronger.',
        cost: 45,
        flags: ['dense'],
      },
      {
        id: 'smokeScreen.trackBreaking',
        name: 'Track-Breaking Smoke',
        desc: 'Enemy targeting takes longer to reacquire a ship after it exits the cloud. Guided missiles are not permanently broken.',
        cost: 50,
        noChain: true,
        flags: ['trackBreaking'],
      },
    ],
    tactics: [
      {
        id: 'smokeScreen.extraCharge',
        name: 'Additional Charge',
        desc: 'Two charges become three.',
        cost: 40,
        noChain: true,
        kind: 'mode',
        grant: { charges: 3 },
      },
      {
        id: 'smokeScreen.expandedCoverage',
        name: 'Expanded Coverage',
        desc: 'Cloud radius becomes larger.',
        cost: 35,
        noChain: true,
        kind: 'mode',
        flags: ['wide'],
      },
      {
        id: 'smokeScreen.longerDuration',
        name: 'Longer Duration',
        desc: 'The cloud lasts longer.',
        cost: 35,
        noChain: true,
        kind: 'mode',
        flags: ['longTrack'],
      },
    ],
  },

  // =========================================================================
  // ELECTRONIC ATTACK & DRONES
  // =========================================================================
  flak: {
    id: 'flak',
    category: 'electronicDefense',
    name: 'Anti-Air Flak System',
    short: 'Attacks enemy recon planes and ship-disabling drones. Separate equipment from the missile self-defense module.',
    platform: 'cargoModule',
    role: 'attack',
    counters: ['electronic'],
    countersDetail: 'Recon Planes at base; Ship-Disabling Drones with Proximity-Fuse Ammunition. Never missiles.',
    weapon: 'flak',
    equipment: { kind: 'cargoModule', id: 'flak' },
    ammo: 'perRound',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'flak.base',
        name: 'Base Flak System',
        desc: 'Automatically engages Recon Planes entering a Low defensive radius. Medium tracking accuracy, Low reload speed, one ready shot per round.',
        cost: 40,
        set: [
          { stat: 'accuracy', tier: 'medium' },
          { stat: 'range', tier: 'low' },
          { stat: 'reload', tier: 'low' },
        ],
        grant: { magazine: 1 },
      },
      {
        id: 'flak.improvedTracking',
        name: 'Improved Tracking Mount',
        desc: 'Accuracy becomes High.',
        cost: 35,
        set: [{ stat: 'accuracy', tier: 'high' }],
      },
      {
        id: 'flak.proximityFuse',
        name: 'Proximity-Fuse Ammunition',
        desc: 'Enables engagement of Ship-Disabling Drones.',
        cost: 50,
        noChain: true,
        flags: ['proximityFuse'],
      },
      {
        id: 'flak.expandedArc',
        name: 'Expanded Air-Defense Arc',
        desc: 'Range becomes Medium.',
        cost: 35,
        noChain: true,
        set: [{ stat: 'range', tier: 'medium' }],
      },
      {
        id: 'flak.rapidCycling',
        name: 'Rapid Cycling',
        desc: 'Reload speed becomes High.',
        cost: 45,
        noChain: true,
        set: [{ stat: 'reload', tier: 'high' }],
      },
      {
        id: 'flak.dualShot',
        name: 'Dual-Shot Magazine',
        desc: 'Two shots per round.',
        cost: 50,
        noChain: true,
        grant: { magazine: 2 },
      },
    ],
    tactics: [
      {
        id: 'flak.autoLocal',
        name: 'Automatic Local Engagement',
        desc: 'Base behavior — the mount engages on its own.',
        cost: 0,
        granted: true,
        kind: 'automation',
      },
      {
        id: 'flak.earlyContact',
        name: 'Early Air-Contact Designator',
        desc: 'Highlights the intended aircraft or drone at ~2× firing range.',
        cost: 25,
        kind: 'info',
        flags: ['earlyContact'],
      },
      {
        id: 'flak.threatPriority',
        name: 'Threat Priority',
        desc: 'Choose the priority: recon plane, ship-disabling drone, or lowest time to objective.',
        cost: 35,
        kind: 'mode',
        flags: ['priority'],
      },
      {
        id: 'flak.deconfliction',
        name: 'Fire-Control Deconfliction',
        desc: 'Equipped ships avoid dumping several flak rounds into the same dying aircraft.',
        cost: 35,
        kind: 'coordination',
        flags: ['deconfliction'],
      },
    ],
  },

  hardened: {
    id: 'hardened',
    category: 'electronicDefense',
    name: 'Hardened & Backup Systems',
    short: 'Works around enemy Sensor Jamming — the one enemy node with no shootable counter.',
    platform: 'convoy',
    role: 'mitigate',
    counters: ['electronic'],
    countersDetail: 'Sensor Jamming only: shortens blackouts and keeps chosen sensor families partially alive. Cannot remove or prevent the jamming itself.',
    equipment: { kind: 'ability', id: 'hardened' },
    ammo: 'perRound',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'hardened.base',
        name: 'Base Emergency Reboot',
        desc: 'A manual activation that shortens the remaining jamming blackout.',
        cost: 35,
        set: [{ stat: 'recovery', tier: 'low' }],
        grant: { reboots: 1 },
      },
      {
        id: 'hardened.protectedChannel',
        name: 'Protected Detection Channel',
        desc: 'Pick one sensor family pre-round (mine detection, torpedo detection, missile warning, or smoke imaging) to stay partially functional during jamming.',
        cost: 40,
        grant: { channels: 1 },
      },
      {
        id: 'hardened.rapidRecovery',
        name: 'Rapid Systems Recovery',
        desc: 'Further shortens blackout duration.',
        cost: 40,
        noChain: true,
        requires: ['hardened.base'],
        set: [{ stat: 'recovery', tier: 'high' }],
      },
      {
        id: 'hardened.dualChannel',
        name: 'Dual-Channel Hardening',
        desc: 'Two sensor families stay partially functional.',
        cost: 55,
        noChain: true,
        requires: ['hardened.protectedChannel'],
        grant: { channels: 2 },
      },
      {
        id: 'hardened.redundantCommand',
        name: 'Redundant Command Network',
        desc: 'Target and readiness indicators never fully vanish during jamming; actual detection stays degraded.',
        cost: 45,
        noChain: true,
        requires: ['hardened.protectedChannel'],
        flags: ['redundant'],
      },
    ],
    tactics: [
      {
        id: 'hardened.status',
        name: 'Jamming Status Display',
        desc: 'An unmissable jamming indicator with countdown.',
        cost: 0,
        granted: true,
        kind: 'info',
      },
      {
        id: 'hardened.channelSelect',
        name: 'Pre-Round Protected-Channel Selection',
        desc: 'Choose which sensor family stays available, before the round.',
        cost: 0,
        granted: true,
        requires: ['hardened.protectedChannel'],
        kind: 'mode',
      },
      {
        id: 'hardened.rebootCharge',
        name: 'Emergency Reboot Charge',
        desc: 'One manual reboot activation per round.',
        cost: 0,
        granted: true,
        kind: 'mode',
      },
      {
        id: 'hardened.secondReboot',
        name: 'Second Reboot Charge',
        desc: 'A second reboot use per round.',
        cost: 45,
        kind: 'mode',
        grant: { reboots: 2 },
      },
    ],
  },

  // Close air support. This slot used to hold an ECM jammer that shaved the hit
  // chance of guided seekers inside an orbit. It was invisible: nothing on
  // screen changed when it worked, the player only ever saw a missile that
  // happened not to connect, and a counter you cannot watch working is a
  // counter nobody spends a charge on. The A-10 does the opposite — you call
  // it, you watch it kill things, and you can point at what it killed.
  warthog: {
    id: 'warthog',
    category: 'antiSurface',
    name: 'A-10 Warthog',
    short: 'Close air support on call: the jet holds a wheel over water you choose and guns everything on the surface inside it — mines and attack boats alike.',
    platform: 'convoy',
    role: 'attack',
    counters: ['mines', 'attackBoats'],
    countersDetail: 'Surface and near-surface targets only. Mines are destroyed outright — charted or not, the gun does not care whether the fleet had found it — and boats are shot to pieces over successive passes. It cannot touch a missile in flight, a torpedo running deep, shore artillery, smoke or jamming.',
    equipment: { kind: 'ability', id: 'warthog' },
    ammo: 'perRound',
    tacticStyle: 'parallel',
    nodes: [
      {
        id: 'warthog.base',
        name: 'Base Gun Run',
        desc: 'One sortie a round. The jet flies to a placed point, holds a wheel over it and guns mines and attack boats inside its strafe radius until it is out of time.',
        cost: 0,
        granted: true,
        grant: { charges: 1 },
      },
      {
        id: 'warthog.tankBuster',
        name: '30mm Tank-Buster Rounds',
        desc: 'Heavier armour-piercing belt: each pass does double damage, so even a rocket or boarding boat breaks up in a pass or two.',
        cost: 55,
        flags: ['tankBuster'],
      },
    ],
    tactics: [
      {
        id: 'warthog.secondSortie',
        name: 'Second Sortie',
        desc: 'The flight comes back around: two gun runs a round instead of one.',
        cost: 45,
        noChain: true,
        kind: 'mode',
        grant: { charges: 2 },
      },
      {
        id: 'warthog.extendedLoiter',
        name: 'Extended Loiter',
        desc: 'External tanks: the jet holds its wheel far longer, so one call covers a much bigger slice of the transit.',
        cost: 40,
        noChain: true,
        kind: 'mode',
        flags: ['longTrack'],
      },
      {
        id: 'warthog.wideStrafe',
        name: 'Wide Strafe Pattern',
        desc: 'Longer, looser gun runs: the radius the jet can reach from its station grows.',
        cost: 40,
        noChain: true,
        kind: 'mode',
        flags: ['wide'],
      },
    ],
  },

  // =========================================================================
  // HULL & DAMAGE CONTROL (sibling branches, deliberately NOT one chain)
  // =========================================================================
  reinforcedHull: {
    id: 'reinforcedHull',
    category: 'damageControl',
    name: 'Reinforced Hull',
    short: 'Generic survivability. Never replaces a threat’s dedicated active counter.',
    platform: 'cargoModule',
    role: 'mitigate',
    counters: [],
    countersDetail: 'All damage sources, passively.',
    equipment: { kind: 'cargoModule', id: 'reinforcedHull' },
    ammo: 'none',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'reinforcedHull.base',
        name: 'Base Hull Reinforcement',
        desc: '+50 max hull points on equipped ships.',
        cost: 0,
        granted: true,
        set: [{ stat: 'bonus', tier: 'low' }],
      },
      {
        id: 'reinforcedHull.medium',
        name: 'Medium Hull Reinforcement',
        desc: 'Hull bonus rises to the Medium tier.',
        cost: 35,
        set: [{ stat: 'bonus', tier: 'medium' }],
      },
      {
        id: 'reinforcedHull.high',
        name: 'High Hull Reinforcement',
        desc: 'Hull bonus rises to the High tier.',
        cost: 50,
        set: [{ stat: 'bonus', tier: 'high' }],
      },
      {
        id: 'reinforcedHull.extra',
        name: 'Extra Hull Reinforcement',
        desc: 'Hull bonus rises to the Extra tier.',
        cost: 70,
        set: [{ stat: 'bonus', tier: 'extra' }],
      },
    ],
    tactics: [],
  },

  fireSuppression: {
    id: 'fireSuppression',
    category: 'damageControl',
    name: 'Fire Suppression',
    short: 'Counters the missile-hit fire (damage-over-time) effect on equipped ships.',
    platform: 'cargoModule',
    role: 'mitigate',
    counters: ['missiles'],
    countersDetail: 'The fire DoT that missile hits inflict — not the hit damage itself.',
    equipment: { kind: 'cargoModule', id: 'fireSuppression' },
    ammo: 'none',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'fireSuppression.base',
        name: 'Base Fire Suppression',
        desc: 'Missile-hit fires burn for half as long on equipped ships.',
        cost: 0,
        granted: true,
        flags: ['halfDuration'],
      },
      {
        id: 'fireSuppression.automatic',
        name: 'Automatic Suppression',
        desc: 'Fires are extinguished almost immediately.',
        cost: 35,
        flags: ['auto'],
      },
      {
        id: 'fireSuppression.redundantZones',
        name: 'Redundant Fire Zones',
        desc: 'No immediate re-ignition for a short period after suppression.',
        cost: 40,
        flags: ['noReignite'],
      },
      {
        id: 'fireSuppression.maxDamageControl',
        name: 'Maximum Damage Control',
        desc: 'The missile-hit damage-over-time effect is prevented entirely.',
        cost: 60,
        flags: ['immune'],
      },
    ],
    tactics: [],
  },

  compartmentalization: {
    id: 'compartmentalization',
    category: 'damageControl',
    name: 'Compartmentalization',
    short: 'Reduces damage after a hit lands. Never touches detection or interception.',
    platform: 'cargoModule',
    role: 'mitigate',
    counters: [],
    countersDetail: 'All damage sources, after the hit.',
    equipment: { kind: 'cargoModule', id: 'compartmentalization' },
    ammo: 'none',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'compartmentalization.low',
        name: 'Low Damage Reduction',
        desc: 'Equipped ships take Low-tier reduced damage.',
        cost: 30,
        set: [{ stat: 'reduction', tier: 'low' }],
      },
      {
        id: 'compartmentalization.medium',
        name: 'Medium Damage Reduction',
        desc: 'Reduction rises to the Medium tier.',
        cost: 45,
        set: [{ stat: 'reduction', tier: 'medium' }],
      },
      {
        id: 'compartmentalization.high',
        name: 'High Damage Reduction',
        desc: 'Reduction rises to the High tier.',
        cost: 65,
        set: [{ stat: 'reduction', tier: 'high' }],
      },
    ],
    tactics: [],
  },

  // =========================================================================
  // SUPPORT
  // =========================================================================
  logistics: {
    id: 'logistics',
    category: 'support',
    name: 'Logistics',
    short: 'Berthing, repair and throughput improvements.',
    platform: 'convoy',
    role: 'support',
    counters: [],
    countersDetail: 'The economy, not a threat.',
    ammo: 'none',
    tacticStyle: 'ladder',
    nodes: [
      {
        id: 'logistics.expandedBerthing',
        name: 'Expanded Berthing',
        desc: 'Convoy capacity +5 immediately and hull repairs cost half as much.',
        cost: 70,
        flags: ['berthing'],
      },
      {
        id: 'logistics.escortRefitBay',
        name: 'Escort Refit Bay',
        desc: 'A third specialist slot on every escort. Interceptors stay built in and never use a slot — this is room for one more optional system, so an escort can cover a second role without giving up its first.',
        cost: 110,
        flags: ['escortRefit'],
      },
    ],
    tactics: [],
  },
};

// ---------------------------------------------------------------------------
// Flattened research index & prerequisite resolution
// ---------------------------------------------------------------------------

export interface ResearchEntry {
  def: CounterNodeDef | CounterTacticDef;
  branch: CounterBranchDef;
  /** True when the entry lives in the branch's tactic list. */
  isTactic: boolean;
  /** Fully-resolved prerequisite ids (chain + explicit + implicit base). */
  requires: ResearchId[];
}

function buildIndex(): Record<ResearchId, ResearchEntry> {
  const index: Record<ResearchId, ResearchEntry> = {};
  for (const branch of Object.values(COUNTER_BRANCHES)) {
    const lists: { items: CounterNodeDef[]; isTactic: boolean; chained: boolean }[] = [
      { items: branch.nodes, isTactic: false, chained: true },
      { items: branch.tactics, isTactic: true, chained: branch.tacticStyle === 'ladder' },
    ];
    for (const { items, isTactic, chained } of lists) {
      items.forEach((def, i) => {
        const requires = new Set<ResearchId>(def.requires ?? []);
        // Implicit chain to the previous entry unless opted out or parallel.
        if (chained && !def.noChain && i > 0 && (def.requires === undefined)) {
          requires.add(items[i - 1].id);
        }
        // Everything implicitly requires the branch's base node (nodes[0]).
        const baseId = branch.nodes[0]?.id;
        if (baseId && def.id !== baseId) requires.add(baseId);
        index[def.id] = { def, branch, isTactic, requires: [...requires] };
      });
    }
  }
  return index;
}

/** Every researchable entry, keyed by id — the RESEARCH registry. */
export const RESEARCH_INDEX: Record<ResearchId, ResearchEntry> = buildIndex();

/** Ids that are auto-available once their prerequisites are met (built-in
 *  behaviors and the base nodes of systems the campaign starts with). */
export const AUTO_GRANTED: ReadonlySet<ResearchId> = new Set(
  Object.values(RESEARCH_INDEX)
    .filter((e) => e.def.granted)
    .map((e) => e.def.id),
);

/** The effective researched set: player-completed entries plus every granted
 *  entry whose prerequisites are satisfied (iterated to a fixed point so
 *  granted chains resolve). */
/** True when NONE of the enemy branches this counter answers can be fielded
 *  yet — the branch is fully defined and validated and goes live the moment the
 *  enemy pass lands. Derived from the enemy catalogue rather than a flag kept by
 *  hand, so it stops claiming "awaiting enemy capability" on its own as each
 *  branch ships. (It was wrong for the whole torpedo category until this was
 *  derived: three branches still advertised a capability that had shipped.) */
export function awaitingEnemyCapability(branch: CounterBranchDef): boolean {
  if (branch.counters.length === 0) return false;
  return branch.counters.every((key) => !ENEMY_BRANCHES[key].implemented);
}

export function effectiveResearch(completed: readonly ResearchId[]): Set<ResearchId> {
  const set = new Set<ResearchId>(completed.filter((id) => RESEARCH_INDEX[id]));
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of AUTO_GRANTED) {
      if (set.has(id)) continue;
      const entry = RESEARCH_INDEX[id];
      if (entry.requires.every((r) => set.has(r))) {
        set.add(id);
        grew = true;
      }
    }
  }
  return set;
}

/** All ids a player could ever research (non-granted), for dev unlock-all. */
export function allResearchableIds(): ResearchId[] {
  return Object.keys(RESEARCH_INDEX).filter((id) => !RESEARCH_INDEX[id].def.granted);
}

// ---------------------------------------------------------------------------
// Equipment gating
// ---------------------------------------------------------------------------

/** Cargo module → the research entry that must be complete before purchase. */
export const MODULE_RESEARCH_REQUIREMENT: Partial<Record<ModuleId, ResearchId>> = {
  selfDefense: 'selfDefense.base',
  missileWarning: 'missileWarning.base',
  mineSonar: 'mineSonar.base',
  hydrophone: 'hydrophone.base',
  thermalImaging: 'thermalImaging.base',
  flak: 'flak.base',
  antiBoarding: 'antiBoarding.base',
  compartmentalization: 'compartmentalization.low',
  // reinforcedHull / fireSuppression: base nodes are granted, so buyable
  // immediately — the rule "no purchase before the base node" still holds.
  reinforcedHull: 'reinforcedHull.base',
  fireSuppression: 'fireSuppression.base',
};

export const ESCORT_MODULE_RESEARCH_REQUIREMENT: Record<EscortModuleId, ResearchId> = {
  deckGun: 'deckGun.base',
  mcmDroneLauncher: 'mcmDrones.base',
  depthCharges: 'depthCharges.base',
  mineSonar: 'mineSonar.base',
};

export const BASE_MODULE_RESEARCH_REQUIREMENT: Record<BaseModuleId, ResearchId> = {
  counterBattery: 'counterBattery.base',
};

export const ABILITY_RESEARCH_REQUIREMENT: Record<
  'warthog' | 'scan' | 'sonar' | 'smoke' | 'hardened',
  ResearchId
> = {
  warthog: 'warthog.base',
  scan: 'scanPulse.base',
  sonar: 'activeSonar.base',
  smoke: 'smokeScreen.base',
  hardened: 'hardened.base',
};

// ---------------------------------------------------------------------------
// Branch stat resolution (tier assignments → resolved stats)
// ---------------------------------------------------------------------------

/** Resolve a branch's qualitative stats from the researched set: start from
 *  the base node, apply each researched node/tactic in DEFINITION ORDER with
 *  later entries overriding — within a branch, later entries are the stronger
 *  upgrades by design. Plain max would be wrong for magnitude-named domains
 *  like autoFireCooldownSeconds, where improving means assigning a LOWER tier
 *  (Max cooldown → Medium cooldown). Grants keep the largest value (counts),
 *  flags accumulate. */
export function resolveBranchStats(
  branchId: CounterBranchId,
  researched: ReadonlySet<ResearchId>,
): { tiers: Record<string, StatTier>; flags: Set<string>; grants: Record<string, number> } {
  const branch = COUNTER_BRANCHES[branchId];
  const tiers: Record<string, StatTier> = {};
  const flags = new Set<string>();
  const grants: Record<string, number> = {};
  const apply = (def: CounterNodeDef): void => {
    for (const s of def.set ?? []) tiers[s.stat] = s.tier;
    for (const f of def.flags ?? []) flags.add(f);
    for (const [k, v] of Object.entries(def.grant ?? {})) {
      grants[k] = Math.max(grants[k] ?? 0, v);
    }
  };
  for (const def of [...branch.nodes, ...branch.tactics]) {
    if (researched.has(def.id)) apply(def);
  }
  return { tiers, flags, grants };
}

// ---------------------------------------------------------------------------
// Ability base tuning (charges come from grants; these are the physical
// numbers the parallel upgrade paths modify)
// ---------------------------------------------------------------------------

const ABILITY_BASE = {
  // Loiter is long compared to the old jamming orbit because the Warthog has to
  // FIND and KILL things in its radius one burst at a time, where jamming
  // applied to everything inside it at once.
  warthog: { radius: 230, wideRadius: 300, duration: 14, longDuration: 26 },
  scan: { radius: 130, wideRadius: 185, duration: 0, longDuration: 0 },
  sonar: { radius: 260, wideRadius: 335, duration: 8, longDuration: 16 },
  smoke: { radius: 200, wideRadius: 265, duration: 14, longDuration: 22 },
} as const;

// ---------------------------------------------------------------------------
// Effects derivation — the single place research becomes combat numbers
// ---------------------------------------------------------------------------

export interface LoadoutContext {
  escortModules: readonly EscortModuleId[];
  baseModules: readonly BaseModuleId[];
}

export function deriveCounterEffects(
  completed: readonly ResearchId[],
  loadout: LoadoutContext,
): CombatEffects {
  const r = effectiveResearch(completed);
  const t = (id: CounterBranchId) => resolveBranchStats(id, r);

  const esc = t('escortInterceptor');
  const bas = t('baseInterceptor');
  const sd = t('selfDefense');
  const mw = t('missileWarning');
  const ms = t('mineSonar');
  const mcm = t('mcmDrones');
  const scan = t('scanPulse');
  const wart = t('warthog');
  const hyd = t('hydrophone');
  const dc = t('depthCharges');
  const asn = t('activeSonar');
  const gun = t('deckGun');
  const ab = t('antiBoarding');
  const cb = t('counterBattery');
  const th = t('thermalImaging');
  const smk = t('smokeScreen');
  const flk = t('flak');
  const hrd = t('hardened');
  const hull = t('reinforcedHull');
  const fs = t('fireSuppression');
  const cmp = t('compartmentalization');

  const ability = (
    key: 'warthog' | 'scan' | 'sonar' | 'smoke',
    stats: { flags: Set<string>; grants: Record<string, number> },
  ) => ({
    charges: stats.grants.charges ?? 0,
    radius: stats.flags.has('wide') ? ABILITY_BASE[key].wideRadius : ABILITY_BASE[key].radius,
    duration: stats.flags.has('longTrack')
      ? ABILITY_BASE[key].longDuration
      : ABILITY_BASE[key].duration,
    persistence: stats.flags.has('persistent') || stats.flags.has('longTrack')
      ? tierValue('trackPersistenceSeconds', stats.flags.has('longTrack') ? 'high' : 'low')
      : 0,
    unlockedLowSig: stats.flags.has('lowSig'),
  });

  return {
    damageTakenMult: 1,
    warthogDamage:
      COMBAT.warthog.damage * (wart.flags.has('tankBuster') ? COMBAT.warthog.tankBusterMult : 1),
    sweepDrones: r.has('mcmDrones.base') && loadout.escortModules.includes('mcmDroneLauncher'),
    autoExtinguish: fs.flags.has('auto'),
    showTargetVectors: mw.flags.has('targetVector'),

    escort: {
      speed: tierValue('interceptorSpeed', esc.tiers.speed ?? 'medium'),
      accuracy: tierValue('weaponAccuracy', esc.tiers.accuracy ?? 'medium'),
      reload: tierValue('reloadSeconds', esc.tiers.reload ?? 'medium'),
      projectileSize: tierValue('visualProjectileSize', esc.tiers.size ?? 'medium'),
      autoUnlocked: esc.flags.has('auto') || esc.flags.has('autoExpanded'),
      autoRadius: esc.flags.has('autoExpanded') ? 460 : esc.flags.has('auto') ? 280 : 0,
      autoCooldown: esc.flags.has('autoExpanded')
        ? 0
        : esc.tiers.autoCooldown
          ? tierValue('autoFireCooldownSeconds', esc.tiers.autoCooldown)
          : 0,
      autoDedupe: esc.flags.has('autoDedupe'),
      autoPrioritizeTti: false,
    },
    base: {
      speed: tierValue('interceptorSpeed', bas.tiers.speed ?? 'high'),
      accuracy: tierValue('weaponAccuracy', bas.tiers.accuracy ?? 'high'),
      reload: tierValue('reloadSeconds', bas.tiers.reload ?? 'low'),
      projectileSize: tierValue('visualProjectileSize', bas.tiers.size ?? 'high'),
      autoUnlocked: bas.flags.has('auto'),
      autoRadius: Infinity,
      autoCooldown: bas.tiers.autoCooldown
        ? tierValue('autoFireCooldownSeconds', bas.tiers.autoCooldown)
        : 0,
      autoDedupe: bas.flags.has('autoDedupe'),
      autoPrioritizeTti: bas.flags.has('autoTti'),
    },

    selfDefense: {
      accuracy: tierValue('weaponAccuracy', sd.tiers.accuracy ?? 'medium'),
      projectileSpeed: tierValue('gunProjectileSpeed', sd.tiers.speed ?? 'high'),
      range: tierValue('cargoModuleRange', sd.tiers.range ?? 'low'),
      magazine: sd.grants.magazine ?? 1,
      projectileSize: tierValue('visualProjectileSize', 'low'),
      designator: sd.flags.has('designator'),
      predictor: sd.flags.has('predictor'),
      coordinated: sd.flags.has('coordinated'),
    },

    missileWarning: {
      assist: tierValue('detectionAssist', mw.tiers.assist ?? 'low'),
      range: tierValue('warningRange', mw.tiers.range ?? 'medium'),
      seaSkimmer: mw.flags.has('seaSkimmer'),
      networked: mw.flags.has('networked'),
      urgency: mw.flags.has('urgency'),
      priorityTag: mw.flags.has('priorityTag'),
    },

    mineSonar: {
      radius: tierValue('mineDetectionRange', ms.tiers.radius ?? 'low'),
      detectLowSig: ms.flags.has('lowSig'),
      driftTracking: ms.flags.has('drift'),
      fleetDetectRadius: ms.flags.has('sharedPicture') ? 120 : 0,
      dangerEnvelope: ms.flags.has('dangerEnvelope'),
      driftVector: ms.flags.has('driftVector'),
    },

    mcm: {
      launchRange: tierValue('droneLaunchRange', mcm.tiers.launchRange ?? 'low'),
      droneSpeed: tierValue('droneSpeed', mcm.tiers.droneSpeed ?? 'medium'),
      reload: tierValue('reloadSeconds', mcm.tiers.reload ?? 'low'),
      movingTarget: mcm.flags.has('movingTarget'),
      dualSortie: (mcm.grants.sorties ?? 1) >= 2,
      autoUnlocked: mcm.flags.has('auto'),
      autoRadius: 300,
      autoCooldown: mcm.tiers.autoCooldown
        ? tierValue('autoFireCooldownSeconds', mcm.tiers.autoCooldown)
        : tierValue('autoFireCooldownSeconds', 'max'),
      riskDesignator: mcm.flags.has('riskDesignator'),
      coordinated: mcm.flags.has('coordinated'),
    },

    depthCharge: {
      throwRange: tierValue('depthChargeThrowRange', dc.tiers.throwRange ?? 'low'),
      blastRadius: tierValue('blastRadius', dc.tiers.blastRadius ?? 'medium'),
      reload: tierValue('reloadSeconds', dc.tiers.reload ?? 'low'),
      magazine: dc.grants.magazine ?? 1,
      patternSalvo: dc.flags.has('pattern'),
      leadSolution: dc.flags.has('leadSolution'),
      autoUnlocked: dc.flags.has('auto'),
      autoRadius: 220,
      autoCooldown: dc.tiers.autoCooldown
        ? tierValue('autoFireCooldownSeconds', dc.tiers.autoCooldown)
        : tierValue('autoFireCooldownSeconds', 'high'),
      coordinated: dc.flags.has('coordinated'),
    },

    deckGun: {
      range: tierValue('deckGunRange', gun.tiers.range ?? 'medium'),
      accuracy: tierValue('weaponAccuracy', gun.tiers.accuracy ?? 'medium'),
      damage: tierValue('deckGunDamage', gun.tiers.damage ?? 'medium'),
      fireInterval: tierValue('fireIntervalSeconds', gun.tiers.rate ?? 'high'),
      armorPiercing: gun.flags.has('ap'),
      autoNearest: gun.flags.has('auto'),
      focusFire: gun.flags.has('focus'),
      distributedFire: gun.flags.has('distributed'),
      layeredFire: gun.flags.has('layered'),
    },

    counterBattery: {
      canEngageRanging: cb.flags.has('ranging'),
      accuracy: tierValue('weaponAccuracy', cb.tiers.accuracy ?? 'medium'),
      reload: tierValue('reloadSeconds', cb.tiers.reload ?? 'low'),
      suppressionSeconds: tierValue('suppressionSeconds', cb.tiers.suppression ?? 'medium'),
      barrageDisruption: cb.flags.has('barrage'),
      coordinatedStrike: cb.flags.has('coordinated'),
      autoUnlocked: cb.flags.has('auto'),
      autoCooldown: cb.tiers.autoCooldown
        ? tierValue('autoFireCooldownSeconds', cb.tiers.autoCooldown)
        : tierValue('autoFireCooldownSeconds', 'max'),
    },

    flak: {
      accuracy: tierValue('weaponAccuracy', flk.tiers.accuracy ?? 'medium'),
      range: tierValue('cargoModuleRange', flk.tiers.range ?? 'low'),
      reload: tierValue('reloadSeconds', flk.tiers.reload ?? 'low'),
      magazine: flk.grants.magazine ?? 1,
      projectileSpeed: tierValue('gunProjectileSpeed', 'high'),
      proximityFuse: flk.flags.has('proximityFuse'),
      earlyContact: flk.flags.has('earlyContact'),
      deconfliction: flk.flags.has('deconfliction'),
    },

    hydrophone: {
      range: tierValue('underwaterDetectionRange', hyd.tiers.range ?? 'medium'),
      detectLowSig: hyd.flags.has('lowSig'),
      improvedLocalization: hyd.flags.has('localization'),
      precisionTrack: hyd.flags.has('precisionTrack'),
      projectedPath: hyd.flags.has('projectedPath'),
      shared: hyd.flags.has('shared'),
    },

    thermal: {
      range: tierValue('imagingRange', th.tiers.range ?? 'medium'),
      blindingResistance: th.flags.has('blinding'),
      trackPersistence: th.flags.has('persistence')
        ? tierValue('trackPersistenceSeconds', 'low')
        : 0,
      networked: th.flags.has('networked'),
    },

    antiBoarding: {
      equippedEffect: r.has('antiBoarding.base'),
      slowMult: ab.tiers.slow ? tierValue('boardingSlow', ab.tiers.slow) : 1,
      lockdown: ab.flags.has('lockdown'),
      counterTeam: ab.flags.has('counterTeam'),
      emergencyRejection: ab.flags.has('rejection'),
      autoPriority: ab.flags.has('autoPriority'),
    },

    hardened: {
      recovery: hrd.tiers.recovery ? tierValue('jammingRecovery', hrd.tiers.recovery) : 0,
      protectedChannelCount: hrd.grants.channels ?? 0,
      redundantCommand: hrd.flags.has('redundant'),
      rebootCharges: hrd.grants.reboots ?? 0,
    },

    hullBonusHp: tierValue('hullReinforcement', hull.tiers.bonus ?? 'low'),
    compartmentReduction: cmp.tiers.reduction
      ? tierValue('damageReduction', cmp.tiers.reduction)
      : 0,
    fire: {
      durationMult: fs.flags.has('halfDuration') ? 0.5 : 1,
      noReignite: fs.flags.has('noReignite'),
      immune: fs.flags.has('immune'),
    },
    smokeDegradation: r.has('smokeScreen.base') ? (smk.flags.has('dense') ? 1.0 : 0.5) : 0,
    smokeTrackBreakSeconds: smk.flags.has('trackBreaking') ? 4 : 0,
    scanLowSigChance: ms.flags.has('lowSig') ? 1.0 : scan.flags.has('lowSig') ? 0.75 : 0.35,
    // Baseline recovery rates. Commander Abilities multiply these AFTER this
    // derivation (applyCommanderCombatEffects) — the design's effect flow.
    recovery: { wreckageRateMult: 1, rescueRateMult: 1 },

    abilities: {
      warthog: ability('warthog', wart),
      scan: {
        ...ability('scan', scan),
        // Composite scan reliability rises with sensor research (see doc).
        unlockedLowSig: scan.flags.has('lowSig'),
      },
      sonar: ability('sonar', asn),
      smoke: ability('smoke', smk),
    },
  };
}

/** Low-signature reveal chance for a scan pulse, informed by sensor research
 *  (the Composite Scan Processing node explicitly scales with it). */
export function scanLowSigChance(researched: ReadonlySet<ResearchId>): number {
  if (!researched.has('scanPulse.compositeScan')) return 0.35;
  return researched.has('mineSonar.compositeSignature') ? 1.0 : 0.75;
}

/** Smoke targeting degradation: fraction of the enemy's targeting skill
 *  removed for ships inside a player smoke cloud (one doctrine tier ≈ 0.5;
 *  dense smoke ≈ a full doctrine reset). */
export function smokeDegradation(researched: ReadonlySet<ResearchId>): number {
  if (!researched.has('smokeScreen.base')) return 0;
  return researched.has('smokeScreen.dense') ? 1.0 : 0.5;
}

// ---------------------------------------------------------------------------
// Save migration: the old 10-entry linear tree → counter branches
// ---------------------------------------------------------------------------

/** Old ResearchId → replacement counter entries. Deterministic and
 *  value-preserving: each legacy effect maps to the node(s) that reproduce it
 *  (see docs/PLAYER_COUNTERS.md → Save migration). */
export const RESEARCH_MIGRATION: Record<string, ResearchId[]> = {
  sensors1: ['missileWarning.base', 'missileWarning.targetVector'],
  sensors2: ['mineSonar.base', 'mineSonar.improvedRange', 'mineSonar.sharedPicture'],
  sensors3: ['mineSonar.longRange', 'mineSonar.compositeSignature', 'scanPulse.compositeScan'],
  intercept1: ['escortInterceptor.precisionGuidance', 'baseInterceptor.extendedBurn'],
  intercept2: ['escortInterceptor.rapidReload', 'baseInterceptor.maxVelocity'],
  mines1: ['mcmDrones.base'],
  resilience1: ['compartmentalization.low', 'compartmentalization.medium'],
  resilience2: ['fireSuppression.automatic', 'fireSuppression.redundantZones'],
  // The legacy EW node bought a jamming upgrade on a branch that no longer
  // exists. Its nearest heir is the gun-run damage node on the branch that
  // replaced it.
  ew1: ['warthog.tankBuster'],
  logistics1: ['logistics.expandedBerthing'],
};

/** Old cargo-module id → new id (pointDefense evolved into selfDefense). */
export const MODULE_MIGRATION: Record<string, ModuleId> = {
  pointDefense: 'selfDefense',
  missileWarning: 'missileWarning',
  reinforcedHull: 'reinforcedHull',
  mineSonar: 'mineSonar',
  fireSuppression: 'fireSuppression',
};

/** Research granted when a migrated save carries the module equipped (the old
 *  purchase implied the capability, so equipment keeps working). */
export const MODULE_MIGRATION_RESEARCH: Partial<Record<ModuleId, ResearchId[]>> = {
  selfDefense: ['selfDefense.base'],
  missileWarning: ['missileWarning.base'],
  mineSonar: ['mineSonar.base'],
  // The legacy fire-suppression module fully prevented fires; keep that value
  // by granting the nodes that restore near-immunity.
  fireSuppression: ['fireSuppression.automatic'],
};

/** Loss causes → the enemy branch they attribute to. 'collateral' and
 *  'attrition' are explicit non-branch outcomes (secondary blast, lost at
 *  sea) so every loss still maps cleanly for the seesaw evaluation. */
export const LOSS_CAUSE_TO_ENEMY_BRANCH: Record<string, EnemyBranchKey | 'collateral' | 'attrition'> = {
  missile: 'missiles',
  guidedMissile: 'missiles',
  chain: 'missiles',
  fire: 'missiles',
  mine: 'mines',
  chartedMine: 'mines',
  lowSigMine: 'mines',
  torpedo: 'torpedoes',
  homingTorpedo: 'torpedoes',
  lowSigTorpedo: 'torpedoes',
  attackBoat: 'attackBoats',
  rocketBoat: 'attackBoats',
  captured: 'attackBoats',
  rangingArtillery: 'artillery',
  rollingBarrage: 'artillery',
  artillery: 'artillery',
  explosion: 'collateral',
  timeout: 'attrition',
};

/** Category display order for the research screen. */
export const CATEGORY_ORDER: CounterCategoryId[] = [
  'missileDefense',
  'mineWarfare',
  'torpedoWarfare',
  'antiSurface',
  'counterArtillery',
  'concealment',
  'electronicDefense',
  'damageControl',
  'support',
];
