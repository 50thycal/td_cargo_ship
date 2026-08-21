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
  /** Per-round unit ceilings this region raises for a branch, replacing the
   *  catalogue's `maxUnitsPerRound`.
   *
   *  Still not a weapon rebalance, and the distinction is worth being exact
   *  about because the rule at the top of this file is worth keeping. A missile
   *  here costs what a missile costs, flies at the speed a missile flies and
   *  does the damage a missile does. What changes is HOW MANY the enemy may
   *  field in one round — availability and pacing, which is the one thing a
   *  region is for.
   *
   *  Needed because volume is a real counter to a real defence rather than a
   *  difficulty dial. The player's shore battery has unlimited range: geography
   *  cannot weaken it and distance does not matter to it, so on a map where
   *  missiles are the only threat it is close to a complete answer. What it
   *  does have is a reload — so the way past it is more missiles arriving at
   *  once than it can service. Without this lever a missile-only region is
   *  pinned at the catalogue's 46 per round however rich the enemy gets, and
   *  measured, it finished EASIER than the tutorial region: 98% delivery with
   *  the enemy scrapping a third of its war chest every round for want of
   *  anything it was allowed to buy. */
  branchUnitCeilings?: Partial<Record<EnemyBranchKey, number>>;
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
    unlocks: 'missileCoast',
  },
  missileCoast: {
    id: 'missileCoast',
    name: 'Missile Coast',
    tagline: 'A hostile shore that leans out to meet you',
    desc:
      'The coastline bulges into the shipping lane at the halfway mark, and the launch ' +
      'sites ride out with it. Nothing here is new — the same missiles, from the same ' +
      'racks — but in the alley they arrive in five seconds instead of twelve, and there ' +
      'is no minefield to sweep and no boat to shoot: only the sky, and how much of it ' +
      'you can cover.',
    completionRound: 11,
    // NO MINES, and that is the point. The kit the last two regions taught you
    // to build — sonar, sweep drones, the scan plane — buys nothing here, and a
    // player who reaches for it has brought the wrong fleet. Smoke and the
    // recon plane arrive late (rounds 7 and 8) as the saturation escalates from
    // volume into deception.
    enemyBranches: ['missiles', 'smoke', 'electronic'],
    // BOTH levers, and each answers a different half of the problem. Left on
    // the defaults this region finished EASIER than the tutorial: 96-99%
    // delivery, every build surviving, `interceptor-rush` losing 2.8 hulls in
    // eleven rounds. Missiles are the least cost-efficient thing the enemy can
    // buy, so a menu with nothing else on it under-spends by construction.
    //
    // The purse is what raises the ordinary round. The ceiling is what lets the
    // enemy answer a player who is running away with it: the anti-snowball
    // bonus can add a third to the war chest, but at the catalogue's 46
    // missiles a round there was nothing to spend it ON and it was scrapped.
    // Measured against the four builds that dominate here, lifting the ceiling
    // alone roughly doubles their attrition — automation 4.3 hulls to 9.5,
    // sensor-net 5.3 to 10.8 — while leaving the builds that are already
    // struggling untouched. That is the restoring force in SEESAW.md finally
    // reaching the water.
    //
    // PROVISIONAL, like every number in this file: a 4-seed sweep across the
    // twelve personas. What it buys is 9 of 11 builds clearing the region with
    // 87-98% delivery and real attrition, against 12 of 12 clearing it
    // untouched before.
    budget: { base: 58, perRound: 74, cap: 1400 },
    branchUnitCeilings: { missiles: 56 },
    start: { ...DEFAULT_START, fleet: { ...DEFAULT_START.fleet } },
    completionXp: 120,
    unlocks: 'headlands',
    geography: 'squeeze',
  },
  headlands: {
    id: 'headlands',
    name: 'The Headlands',
    tagline: 'Guns on a peninsula you have to sail the length of',
    desc:
      'A hostile promontory runs two-thirds of the crossing, and the batteries on it ' +
      'reach water no shore gun has ever reached before. There is no stretch to wait it ' +
      'out in and no lane that is quietly safe. The question this coast asks is the only ' +
      'one it asks: how fast can you put those guns out of action?',
    // Long enough for the artillery ladder to finish arriving. Coastal guns
    // open at 6 and ranging at 8 — the round the last safe lane disappears —
    // so a region that ended before then would be named after a branch the
    // player barely met.
    completionRound: 12,
    enemyBranches: ['artillery', 'smoke', 'missiles'],
    budget: null,
    start: { ...DEFAULT_START, fleet: { ...DEFAULT_START.fleet } },
    completionXp: 150,
    unlocks: null,
    geography: 'headlands',
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
export const REGION_ORDER: RegionId[] = [
  'homeStrait',
  'pirateNarrows',
  'missileCoast',
  'headlands',
];

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
