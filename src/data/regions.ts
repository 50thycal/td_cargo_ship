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
   *  measured in a real session it delivered 100% of seven convoys while the
   *  enemy binned more than half its war chest for want of anything it was
   *  allowed to buy. Raising the purse could not reach the water; this is the
   *  valve that lets it. */
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
  missileCoast: {
    id: 'missileCoast',
    name: 'Missile Coast',
    tagline: 'A hostile shore that leans out to meet you',
    desc:
      'Your first crossing, and the shortest lesson the war has. The coastline bulges ' +
      'into the shipping lane at the halfway mark and the launch sites ride out with it, ' +
      'so in the alley a missile arrives in five seconds instead of twelve. There is no ' +
      'minefield to sweep and no boat to shoot: only the sky, and how much of it you can ' +
      'cover. Recover what you shoot down; the wreckage is your research division now.',
    // OPENING region — short, and deliberately about one idea. Eight rounds is
    // the same length the ladder used to open with, and everything on the menu
    // is on the water from round one, so there is no stretch where the region
    // is still introducing itself.
    completionRound: 8,
    // ONE BRANCH. Everything else the region did with three was worse.
    //
    // Missiles are the only branch that opens at round 1, so a first region
    // with a longer menu is a missile region for its first six rounds anyway —
    // and then, measured in a real seven-round session, it got SOFTER: the ROI
    // allocator moved 81% of the war chest onto smoke and electronic (shares
    // 0.241 and 0.568 by round 7) which between them had scored zero kills, and
    // the branch that was actually doing the damage was left on a fifth of the
    // money. A region that teaches one thing should not be allowed to spend its
    // budget on the two things it is not teaching.
    //
    // It also makes the geography legible. The squeeze exists to shorten
    // warning time on incoming fire; with mines or boats on the board the
    // player has reasons to be where they are that have nothing to do with the
    // shore, and the alley stops being the thing they are reading.
    enemyBranches: ['missiles'],
    // The two numbers that decide this region, and the ceiling is the one that
    // matters. See RegionDef.branchUnitCeilings.
    //
    // A missile-only menu cannot spend a wide purse: the enemy is buying the
    // one thing on the shelf, so the per-round unit cap — not the money — is
    // what decides how much fire crosses the water. Measured in a real session
    // at a ceiling of 56, the enemy committed exactly 378 in each of rounds 3,
    // 4 and 5 while its budget climbed 600 → 794 → 1065, and binned 2,941 of
    // 5,737 funds across seven rounds. Delivery pinned at 100%, intercept rate
    // climbed 70% → 94%, and £3,821 of the player's cash went unspent because
    // there was nothing to answer. Raising the purse alone would have changed
    // nothing — the money was already going in the bin.
    //
    // So the ceiling is set high enough NOT to bind, and the purse is what
    // shapes the difficulty curve again. That restores the normal relationship
    // between the two dials: budget is the region's pacing, the ceiling is only
    // the promise that the enemy can spend what it is given.
    //
    // PROVISIONAL, like every number in this file, and swept at 8 seeds across
    // the twelve personas. Scrap 51% → 0.5%; delivery 87-96%; the median build
    // loses 18-22 hulls in eight rounds where it used to lose four. The purse
    // is deliberately BELOW where a 26% raise put it: that run was harder in
    // the wrong way — five of twelve builds ended on a missed quota at 85-87%
    // delivery, which is the bookkeeping killing a build that is still
    // fighting, and the opening region is the last place that should happen.
    //
    // RAISED across the board after a hand-played nine-round run finished at
    // 99 confidence having lost two hulls. Replaying that run's metrics through
    // the allocator reproduced it exactly, and showed the region going SOFT
    // from round 6 rather than holding: the old 920 cap bound on round 6 and
    // never moved again, so budget, committed spend and the missile mix were
    // byte-identical for rounds 6-9 (920 / 918 / 92 guided + 18 unguided) while
    // the player's tech kept compounding. Intercept rate climbed 79% → 94%
    // across exactly the stretch that was supposed to be the hardest.
    //
    // The cap was also swallowing the seesaw's own restoring force. Every
    // performance multiplier — strong delivery, high intercept, convoy
    // richness, the dominance streak — is applied BEFORE the cap clamp in
    // grantBudget, so once the raw figure cleared 920 a dominating player drew
    // no extra fire at all. The anti-snowball response existed and was being
    // thrown away. A cap should be a runaway backstop, not the operating point
    // of the back half of the region.
    //
    // So: a higher opening (base/perRound) so the region starts with real
    // pressure instead of ramping into it, and a cap set far enough out that
    // the performance multipliers decide the late rounds instead of the clamp.
    budget: { base: 70, perRound: 78, cap: 2200 },
    // Raised with the purse — at the old 130 the enemy hit the unit ceiling
    // almost immediately at the new budget and binned the difference, which is
    // the exact failure the note above describes.
    branchUnitCeilings: { missiles: 300 },
    start: { ...DEFAULT_START, fleet: { ...DEFAULT_START.fleet } },
    completionXp: 60,
    unlocks: 'homeStrait',
    geography: 'squeeze',
  },
  homeStrait: {
    id: 'homeStrait',
    name: 'Home Strait',
    tagline: 'The water under you turns hostile too',
    desc:
      'Open water, no shore leaning over you — and for the first time the threat is not ' +
      'all in the air. Drifting minefields go in ahead of the convoy, and nothing you ' +
      'built to cover the sky will find one. The crossing is wider and quieter than the ' +
      'coast was; what it asks is whether you can see.',
    completionRound: 8,
    enemyBranches: ['missiles', 'mines'],
    budget: null,
    start: { ...DEFAULT_START, fleet: { ...DEFAULT_START.fleet } },
    completionXp: 90,
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
    completionXp: 120,
    unlocks: 'headlands',
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
  'missileCoast',
  'homeStrait',
  'pirateNarrows',
  'headlands',
];

/** Where a fresh Commander Profile starts. */
export const FIRST_REGION: RegionId = 'missileCoast';

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
