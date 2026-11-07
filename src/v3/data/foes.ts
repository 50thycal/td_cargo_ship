// The enemy build (docs/design/v3-enemy-build.md): the new enemies the player
// picked in enemy round 1, the chapter each debuts in, and their numbers.
// Like the weapons' roster: a map in chapter n can send any enemy from
// chapters 1 to n, and the chapter's own come up most.

import type { ThreatKind } from './config';

export type FoeId =
  // Chapter 1: Home Waters
  | 'sprinter' | 'decoy' | 'hydra' | 'rocketTruck' | 'loiter'
  // Chapter 2: The Narrows
  | 'attackHeli' | 'torpedoSub' | 'armored' | 'crossWing' | 'scavenger'
  // Chapter 3: Dark Water
  | 'stealthJet' | 'stealthBomber' | 'diveBomber' | 'siege' | 'spotter'
  // Chapter 4: Open War
  | 'tender' | 'bodyguard' | 'picket' | 'lure' | 'barge' | 'cloud';

export type FoeCat = 'strike' | 'platform' | 'support';

/** Where a foe comes into play: out of a launch base, in from a screen edge,
 *  down a shore road, at a spot on open water, or on the enemy shore. */
export type FoeFrom = 'base' | 'edge' | 'road' | 'water' | 'shore';

export interface FoeDef {
  id: FoeId;
  name: string;
  chapter: 1 | 2 | 3 | 4;
  cat: FoeCat;
  /** The threat kind that stands for it in the waves (the one a unit of it
   *  is planned as, and launched from). */
  kind: ThreatKind;
  from: FoeFrom;
  /** One line for the briefing and Free Play. */
  blurb: string;
}

export const FOES: Record<FoeId, FoeDef> = {
  sprinter: { id: 'sprinter', name: 'Sprint Drones', chapter: 1, cat: 'strike', kind: 'sprinter', from: 'base', blurb: 'A swarm that flares a booster near its ship and sprints in.' },
  decoy: { id: 'decoy', name: 'Decoy Drones', chapter: 1, cat: 'support', kind: 'decoy', from: 'base', blurb: 'Half the swarm is fake. Up close the decoys strobe white.' },
  hydra: { id: 'hydra', name: 'Hydra Missile', chapter: 1, cat: 'strike', kind: 'hydra', from: 'base', blurb: 'Kill it and it splits into two darts. Kill it early.' },
  rocketTruck: { id: 'rocketTruck', name: 'Rocket Truck', chapter: 1, cat: 'platform', kind: 'rocketTruck', from: 'road', blurb: 'Raises a launcher, then fires rockets you can\'t stop. Kill the truck.' },
  loiter: { id: 'loiter', name: 'Loitering Drones', chapter: 1, cat: 'strike', kind: 'loiter', from: 'base', blurb: 'Circle over the lane ahead, then dive together when ships come.' },
  attackHeli: { id: 'attackHeli', name: 'Attack Helicopter', chapter: 2, cat: 'platform', kind: 'attackHeli', from: 'edge', blurb: 'Hovers beside the lane firing missile pairs, and moves.' },
  torpedoSub: { id: 'torpedoSub', name: 'Torpedo Sub', chapter: 2, cat: 'platform', kind: 'torpedoSub', from: 'water', blurb: 'Surfaces, fires a torpedo down a line on the water, dives.' },
  armored: { id: 'armored', name: 'Armored Drone', chapter: 2, cat: 'strike', kind: 'armored', from: 'base', blurb: 'A plate on its nose. Hit it as it banks, or go round with a blast.' },
  crossWing: { id: 'crossWing', name: 'Crossing Wing', chapter: 2, cat: 'strike', kind: 'crosser', from: 'base', blurb: 'Two lines of drones meet at the X, then split for six ships.' },
  scavenger: { id: 'scavenger', name: 'Scavenger Drone', chapter: 2, cat: 'support', kind: 'scavenger', from: 'edge', blurb: 'Flies off with your pickups. A grabbed pickup is gone.' },
  stealthJet: { id: 'stealthJet', name: 'Stealth Strafer', chapter: 3, cat: 'platform', kind: 'stealthJet', from: 'edge', blurb: 'A strafing jet with no warning. Only its short run-in.' },
  stealthBomber: { id: 'stealthBomber', name: 'Stealth Bomber', chapter: 3, cat: 'platform', kind: 'stealthBomber', from: 'edge', blurb: 'A flying wing, no warning, six hits, three missiles.' },
  diveBomber: { id: 'diveBomber', name: 'Dive Bomber', chapter: 3, cat: 'platform', kind: 'diveBomber', from: 'edge', blurb: 'A circle on the water, then the plane. Its bomb can\'t be stopped.' },
  siege: { id: 'siege', name: 'Siege Battery', chapter: 3, cat: 'platform', kind: 'siege', from: 'shore', blurb: 'Marks circles on the lane, then shells them. Silence the gun.' },
  spotter: { id: 'spotter', name: 'Spotter Plane', chapter: 3, cat: 'support', kind: 'spotter', from: 'edge', blurb: 'Paints one ship for the others, and calls a strike on it.' },
  tender: { id: 'tender', name: 'Repair Tender', chapter: 4, cat: 'support', kind: 'tender', from: 'water', blurb: 'Mends the most damaged enemy near it, a pulse at a time.' },
  bodyguard: { id: 'bodyguard', name: 'Bodyguard Ring', chapter: 4, cat: 'support', kind: 'guard', from: 'base', blurb: 'Guard drones take your shots for a heavy missile.' },
  picket: { id: 'picket', name: 'Flak Picket', chapter: 4, cat: 'support', kind: 'picket', from: 'water', blurb: 'Shoots down your shots that fly through its ring.' },
  lure: { id: 'lure', name: 'Lure Beacon', chapter: 4, cat: 'support', kind: 'lure', from: 'water', blurb: 'Your helpers chase it. Only your taps can sink it.' },
  barge: { id: 'barge', name: 'Supply Barge', chapter: 4, cat: 'support', kind: 'barge', from: 'water', blurb: 'While it floats, every raid gets one more missile per site.' },
  cloud: { id: 'cloud', name: 'Volatile Cloud', chapter: 4, cat: 'strike', kind: 'cloud', from: 'shore', blurb: 'Set off over your ships, it hurts them. Pop it over water.' },
};

export const FOE_ORDER = Object.keys(FOES) as FoeId[];

/** The foes built so far (the build goes a chapter at a time). */
export const FOES_BUILT: FoeId[] = [
  'sprinter', 'decoy', 'hydra', 'rocketTruck', 'loiter',
  'attackHeli', 'torpedoSub', 'armored', 'crossWing', 'scavenger',
  'stealthJet', 'stealthBomber', 'diveBomber', 'siege', 'spotter',
  'tender', 'bodyguard', 'picket', 'lure', 'barge', 'cloud',
];

/** The foe a threat kind stands for, if it is one. */
export const FOE_OF_KIND: Partial<Record<ThreatKind, FoeId>> = Object.fromEntries(FOE_ORDER.map((id) => [FOES[id].kind, id]));

/** The foes that debut in a chapter. */
export function foesInChapter(chapter: number): FoeId[] {
  return FOE_ORDER.filter((id) => FOES[id].chapter === chapter && FOES_BUILT.includes(id));
}

/** Every foe a map of this chapter can send. */
export function foesUpTo(chapter: number): FoeId[] {
  return FOE_ORDER.filter((id) => FOES[id].chapter <= chapter && FOES_BUILT.includes(id));
}

/** How many foes a wave brings: none on wave 1, one on waves 2 to 5, two on
 *  6 to 9, three on 10; endless adds one every three waves past it, up
 *  to six. Each one stands in for part of the wave's table: a drone swarm,
 *  and the heavier ones (HEAVY_FOES) a missile too. The first sweep, with
 *  four by wave 10 and a drone swarm each, cut the average bot's clears on
 *  half the maps (Harbor 67% → 17%). */
export const FOE_WAVE = [0, 1, 1, 1, 1, 2, 2, 2, 2, 3];

export function foeCount(wave: number): number {
  if (wave <= FOE_WAVE.length) return FOE_WAVE[Math.max(1, wave) - 1];
  return Math.min(6, FOE_WAVE[FOE_WAVE.length - 1] + Math.floor((wave - FOE_WAVE.length) / 3));
}

/** Foes worth a missile as well as a drone swarm out of the wave's table:
 *  the platforms that fire several times, the ones that bring a heavy, and
 *  the ones that make every raid bigger. */
export const HEAVY_FOES: FoeId[] = ['rocketTruck', 'attackHeli', 'torpedoSub', 'stealthBomber', 'diveBomber', 'siege', 'spotter', 'tender', 'bodyguard', 'barge'];

/** Free Play's Enemies line: as the campaign (the map's chapter), none of
 *  the new ones, all of them, or one on its own. */
export type FoeSetting = 'campaign' | 'none' | 'all' | FoeId;

/** Share of a wave's foes drawn from the chapter's own new ones. */
export const FOE_LEAD_SHARE = 0.6;

/** The numbers (first proposals; the plan doc has them in words). */
export const FOE = {
  sprinter: { size: 4, boostAt: 160, flare: 0.6, sprint: 300 },
  decoy: { size: 6, fakes: 3, revealAt: 300, fizzle: 40 },
  hydra: { darts: 2, spread: 0.5, clear: 34 },
  rocketTruck: { raise: 2.4, gap: 1.5, rockets: 5, rocketSpeed: 560, hitRadius: 30, lower: 0.6 },
  loiter: { size: 4, orbit: 46, spin: 1.6, trigger: 190, dive: 230, wait: 30, settle: 1.6 },
  attackHeli: { accel: 260, settle: 0.8, gap: 3.2, pair: 2, perSpot: 2, volleys: 6, off: 90, pairGap: 0.25 },
  torpedoSub: { warn: 1.5, up: 3.5, fireAt: 1.2, run: 300, hitRadius: 24 },
  armored: { plate: 4, turnAt: 0.45, turn: 1.6, swing: 1.75, front: 70 },
  crossWing: { per: 3, gap: 30, peel: 130, turn: 3 },
  scavenger: { grab: 24, leave: 210, wait: 14 },
  stealthJet: { runIn: 300 },
  stealthBomber: { runIn: 420, bombs: 3 },
  diveBomber: { lead: 4.7, mark: 2.2, window: 1.8, fall: 0.7, high: 220, low: 50, hit: 30, splash: 70, splashDamage: 1 },
  siege: { setup: 1.5, salvos: 3, shells: 2, mark: 3.4, flight: 1.1, gap: 6, radius: 46, damage: 2, pack: 2 },
  spotter: { orbit: 110, off: 150, paint: 2, call: 4, strike: 3, strikeGap: 0.4, share: 0.7, stay: 22 },
  tender: { gap: 3.5, charge: 1, mend: 2, reach: 340 },
  bodyguard: { guards: 3, orbit: 34, spin: 2.2 },
  picket: { ring: 120, every: 0.5 },
  lure: { life: 20 },
  barge: { off: 150 },
  cloud: { radius: 75, drift: 22, slow: 6, life: 28 },
} as const;
