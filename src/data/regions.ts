// Region Definitions — the data-driven campaign structure of the roguelite
// redesign (docs/design/roguelite-redesign.md → "Region Definitions").
//
// A region is an independent roguelite campaign: it controls which enemy
// branches may be fielded, when they may debut, the threat-budget curve, the
// completion watermark and the run's starting state. Regions NEVER create
// separately-balanced versions of an enemy or a weapon — an attack boat costs
// and fights the same everywhere; regions only shape availability, pacing and
// starting conditions.
//
// Every number in this file is PROVISIONAL. The design doc explicitly defers
// region length, starting resources and budget curves to playtesting on the
// working vertical slice.

import type { EnemyBranchKey } from './enemyBranches';
import { geography, type Geography, type GeographyId } from './geography';
import type { ShipClassId } from '../sim/types';

export type RegionId = string;

/** The run-start state a region hands to a fresh attempt. */
export interface RegionStartState {
  cash: number;
  ammo: number;
  droneAmmo: number;
  pdAmmo: number;
  bases: number;
  /** Escorts commissioned free at run start (empty specialist slots). */
  escorts: number;
  capacity: number;
  confidence: number;
  fleet: Record<ShipClassId, number>;
}

export interface RegionDef {
  id: RegionId;
  name: string;
  /** One-line identity for the region-select screen. */
  tagline: string;
  desc: string;
  /** Surviving THIS round's transit completes the region. */
  completionRound: number;
  /** Enemy branches the region permits. The adaptive enemy still decides what
   *  to emphasize WITHIN this set — the region sets the menu, not the order. */
  enemyBranches: EnemyBranchKey[];
  /** Optional per-branch earliest-round floors on top of each branch's own
   *  openRound — a region may DELAY a branch for pacing, never hurry one past
   *  its global gate (which would need node-level rebalancing). */
  branchDebutRounds?: Partial<Record<EnemyBranchKey, number>>;
  /** Region threat-budget curve. null = the global ENEMY_ECONOMY defaults. */
  budget: { base: number; perRound: number; cap: number } | null;
  start: RegionStartState;
  /** Commander XP awarded for completing the region. */
  completionXp: number;
  /** Region permanently unlocked by completing this one (null = none yet). */
  unlocks: RegionId | null;
  /** THE WATER this region is fought in — coastlines, lanes and emplacement
   *  lines (see geography.ts). Omitted means the default strait.
   *
   *  This is the one region property that changes the battlefield rather than
   *  the opposition, and it is still not an exception to the rule above: a
   *  geography moves coastlines, never weapon stats. What makes a region hard
   *  is how close the enemy shore is to the shipping lane and how much room a
   *  hull has to work in — both of which the same missile, unchanged, exploits
   *  differently. */
  geography?: GeographyId;
}

/** The shared provisional starting state. Mirrors the pre-redesign campaign
 *  opening, plus ONE free escort — the recovery loop (wreckage + survivors)
 *  is escort-driven, so a run must never start without a hull that can
 *  perform it. */
const DEFAULT_START: RegionStartState = {
  // Trimmed from 450 when ability commissioning was removed. A run used to
  // spend its whole opening purse on one shore battery (300) and commissioning
  // the A-10 (150); the aircraft is free now, so the same 450 would have made
  // round one's shopping a formality rather than a decision.
  cash: 350,
  ammo: 28,
  droneAmmo: 0,
  pdAmmo: 0,
  bases: 1,
  escorts: 1,
  capacity: 20,
  confidence: 60,
  fleet: { cargo: 15, tanker: 3, freighter: 2 },
};

export const REGIONS: Record<RegionId, RegionDef> = {
  homeStrait: {
    id: 'homeStrait',
    name: 'Home Strait',
    tagline: 'Missiles and mines over home water',
    desc:
      'The first contested crossing. Enemy doctrine here is young: cruise missiles and ' +
      'drifting minefields, nothing more — but every convoy teaches them where to aim. ' +
      'Recover what you shoot down; the wreckage is your research division now.',
    completionRound: 8,
    enemyBranches: ['missiles', 'mines'],
    budget: null,
    start: { ...DEFAULT_START, fleet: { ...DEFAULT_START.fleet } },
    completionXp: 60,
    unlocks: 'pirateNarrows',
  },
  pirateNarrows: {
    id: 'pirateNarrows',
    name: 'Pirate Narrows',
    tagline: 'Fast attack boats join the missiles and mines',
    desc:
      'A choke point worked by fast boats — small-arms crews, rocket racks, and boarding ' +
      'parties that would rather take a hull than sink it. Everything you learned in the ' +
      'Home Strait still applies; none of the equipment you built there comes with you.',
    completionRound: 10,
    enemyBranches: ['missiles', 'mines', 'attackBoats'],
    budget: null,
    start: { ...DEFAULT_START, fleet: { ...DEFAULT_START.fleet } },
    completionXp: 90,
    unlocks: null,
  },
  // Not part of the campaign ladder: the full-threat proving ground used by
  // dev runs and the headless playtest harness. Never appears in REGION_ORDER,
  // so it cannot be selected (or unlocked) through normal play.
  openSeas: {
    id: 'openSeas',
    name: 'Open Seas (proving ground)',
    tagline: 'Every enemy branch, no completion watermark',
    desc: 'Developer proving ground: the full threat roster with no round cap.',
    completionRound: 999,
    enemyBranches: [
      'missiles',
      'mines',
      'torpedoes',
      'attackBoats',
      'artillery',
      'smoke',
      'electronic',
    ],
    budget: null,
    // Starts BARE (no free escort) — this region exists to reproduce the
    // pre-redesign campaign's opening for dev runs and headless tests.
    start: { ...DEFAULT_START, escorts: 0, fleet: { ...DEFAULT_START.fleet } },
    completionXp: 0,
    unlocks: null,
  },
};

/** Campaign ladder, in unlock order. The dev proving ground is excluded. */
export const REGION_ORDER: RegionId[] = ['homeStrait', 'pirateNarrows'];

/** Where a fresh Commander Profile starts. */
export const FIRST_REGION: RegionId = 'homeStrait';

/** The full-roster region dev runs and the headless harness use. */
export const DEV_REGION: RegionId = 'openSeas';

export function regionDef(id: RegionId): RegionDef {
  return REGIONS[id] ?? REGIONS[FIRST_REGION];
}

/** The water this region is fought in. One lookup for every system that needs
 *  to know where the land is, so the sim never reaches for `WORLD` directly. */
export function geographyOf(id: RegionId): Geography {
  return geography(regionDef(id).geography ?? 'strait');
}
