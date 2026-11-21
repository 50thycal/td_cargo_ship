// The enemy build (docs/design/v3-enemy-build.md): the new enemies the player
// picked in enemy round 1, the chapter each debuts in, and their numbers.
// Like the weapons' roster: a map in chapter n can send any enemy from
// chapters 1 to n, and the chapter's own come up most.

import type { ThreatKind } from './config';
import { CHAPTERS } from './maps';

export type FoeId =
  // Chapter 1: Home Waters
  | 'sprinter' | 'hydra' | 'rocketTruck'
  // Chapter 2: The Narrows
  | 'attackHeli' | 'torpedoSub' | 'armored' | 'scavenger'
  // Chapter 3: Dark Water
  | 'stealthJet' | 'stealthBomber' | 'diveBomber' | 'siege' | 'spotter'
  // Chapter 4: Open War
  | 'tender' | 'bodyguard' | 'lure' | 'cloud'
  // Boss only (BOSS_FOES): Saltgate Canal's Gatecrashers (log v45).
  | 'missileTruck';

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
  hydra: { id: 'hydra', name: 'Hydra Missile', chapter: 1, cat: 'strike', kind: 'hydra', from: 'base', blurb: 'Kill it and it splits into two darts. Kill it early.' },
  rocketTruck: { id: 'rocketTruck', name: 'Rocket Truck', chapter: 1, cat: 'platform', kind: 'rocketTruck', from: 'road', blurb: 'Raises a launcher, then fires salvos of red rockets you can\'t stop. Kill the truck.' },
  attackHeli: { id: 'attackHeli', name: 'Attack Helicopter', chapter: 2, cat: 'platform', kind: 'attackHeli', from: 'edge', blurb: 'Fires missile pairs at the convoy as soon as a ship is in range, hovers beside the lane, and moves.' },
  torpedoSub: { id: 'torpedoSub', name: 'Torpedo Sub', chapter: 2, cat: 'platform', kind: 'torpedoSub', from: 'water', blurb: 'Stays under water, its periscope up, out of reach: fires two torpedoes one by one, each at a ship down a line on the water, now and then a fast one, and dives away. Only the torpedoes can be shot.' },
  armored: { id: 'armored', name: 'Armored Drone', chapter: 2, cat: 'strike', kind: 'armored', from: 'base', blurb: 'A plate on its nose. Hit it as it banks, or go round with a blast.' },
  scavenger: { id: 'scavenger', name: 'Scavenger Drone', chapter: 2, cat: 'support', kind: 'scavenger', from: 'edge', blurb: 'Hovers over your pickups: any pickup inside its ring is locked until it is shot down or leaves.' },
  stealthJet: { id: 'stealthJet', name: 'Stealth Strafer', chapter: 3, cat: 'platform', kind: 'stealthJet', from: 'edge', blurb: 'A strafing jet with no warning. Only its short run-in.' },
  stealthBomber: { id: 'stealthBomber', name: 'Stealth Bomber', chapter: 3, cat: 'platform', kind: 'stealthBomber', from: 'edge', blurb: 'A flying wing, no warning, six hits, three missiles.' },
  diveBomber: { id: 'diveBomber', name: 'Dive Bomber', chapter: 3, cat: 'platform', kind: 'diveBomber', from: 'edge', blurb: 'A circle on the water, then the plane dives in. Its red bomb can\'t be stopped.' },
  siege: { id: 'siege', name: 'Siege Battery', chapter: 3, cat: 'platform', kind: 'siege', from: 'shore', blurb: 'Rises from a hatch to shell circles on the lane. Red shells: hit the gun while it\'s up.' },
  spotter: { id: 'spotter', name: 'Spotter Plane', chapter: 3, cat: 'support', kind: 'spotter', from: 'edge', blurb: 'Flies in, paints a ship and calls artillery from off the map on it, then leaves and comes back, hits kept, until shot down.' },
  tender: { id: 'tender', name: 'Repair Ship', chapter: 4, cat: 'support', kind: 'tender', from: 'water', blurb: 'Sails in and mends the most damaged enemy near it, a pulse at a time.' },
  bodyguard: { id: 'bodyguard', name: 'Bodyguard Ring', chapter: 4, cat: 'support', kind: 'guard', from: 'base', blurb: 'Guard drones take your shots for a heavy missile.' },
  lure: { id: 'lure', name: 'Lure Beacon', chapter: 4, cat: 'support', kind: 'lure', from: 'water', blurb: 'Rises from the water; every helper inside its ring fires at it. Only your own weapons can sink it, not your helpers.' },
  cloud: { id: 'cloud', name: 'Incendiary Missile', chapter: 4, cat: 'strike', kind: 'cloud', from: 'base', blurb: 'A slow firebomb. Where it bursts, a fireball burns on the water. Kill it far out.' },
  missileTruck: { id: 'missileTruck', name: 'Missile Truck', chapter: 2, cat: 'platform', kind: 'missileTruck', from: 'road', blurb: 'A launcher truck with one long ballistic missile: it stops, raises it and lobs it at a ship. Kill the truck, or shoot the missile in the air.' },
};

/** Log v45: enemies that only a boss sends (the player's review of
 *  Saltgate Canal's boss: "make it the missile trucks so it is different.
 *  Should be a parade of them shooting off the ballistic missiles"). No
 *  wave planner draws them, they have no Test Lab enemy card and Free
 *  Play doesn't offer them; the boss's map is their debut (`BOSS_FOE_MAP`),
 *  where they are announced with their chapter, "New on The Narrows". */
export const BOSS_FOES: FoeId[] = ['missileTruck'];
export const BOSS_FOE_MAP: Partial<Record<FoeId, string>> = { missileTruck: 'saltgate' };

/** Every enemy the waves can send, in the build's order (the boss-only
 *  ones are not among them). */
export const FOE_ORDER = (Object.keys(FOES) as FoeId[]).filter((id) => !BOSS_FOES.includes(id));

/** The foes that fire things no interceptor can stop, all drawn red (Test
 *  Lab round 1: "red projectiles you just cannot intercept"): the briefing
 *  says so where they are listed. */
export const RED_FOES: FoeId[] = ['rocketTruck', 'diveBomber', 'siege'];

/** The foes built so far (the build goes a chapter at a time). Cut after
 *  the Test Lab playtest (2026-11-08): Loitering Drones, Crossing Wing,
 *  Flak Picket, Supply Barge. Removed from the game in round 11 (the
 *  player: "remove the decoy drones ... entirely"): Decoy Drones. */
/** The 2026-11-20 playtest follow-up (log v36): the Torpedo Sub can't be
 *  hit now, so on The Behemoth Run it waits for wave `from`: one the
 *  planner draws earlier stays the drone swarm it would have replaced (the
 *  wave sends what it did, rule w-budget). Campaign and lab alike. */
export const SUB_FROM: Partial<Record<string, number>> = { behemoth: 6 };

export const FOES_BUILT: FoeId[] = [
  'sprinter', 'hydra', 'rocketTruck',
  'attackHeli', 'torpedoSub', 'armored', 'scavenger',
  'stealthJet', 'stealthBomber', 'diveBomber', 'siege', 'spotter',
  'tender', 'bodyguard', 'lure', 'cloud',
];

/** Which of its chapter's new enemies each map of the chapter leads with
 *  (its debut), by the map's place in the chapter (the nth map, the nth
 *  slot, wrapping). A chapter not listed takes its new enemies in order.
 *  `null` is a map with no debut of its own: it leads with the chapter's
 *  enemies in turn from the first, so it brings nothing new. Round 11 took
 *  the Decoy Drones out of the game, and with them Kesh's debut; Kesh has
 *  none for now (an open item: the map rebuild's design cards will give it
 *  one, docs/design/v3-round11-map-notes.md). Marrow and The Gauntlet keep
 *  theirs. */
export const DEBUT_SLOTS: Partial<Record<number, (FoeId | null)[]>> = {
  1: ['sprinter', null, 'hydra', 'rocketTruck'],
};

/** The foe a threat kind stands for, if it is one. */
export const FOE_OF_KIND: Partial<Record<ThreatKind, FoeId>> = Object.fromEntries((Object.keys(FOES) as FoeId[]).map((id) => [FOES[id].kind, id]));

/** Rule m-debut-tag (docs/design/v3-map-wave-rules.md): a new enemy from
 *  chapter 2 on is announced with its chapter, as the chapter's new weapon
 *  cards are ("New on The Narrows"). Chapter 1's (the game's first enemies)
 *  and anything that is not a new enemy: none. */
export function foeDebutTag(kind: ThreatKind): string | null {
  const id = FOE_OF_KIND[kind];
  if (!id || FOES[id].chapter < 2) return null;
  return newOnTag(FOES[id].chapter);
}

/** The tag a chapter's new weapons and enemies carry. Round 12 (the
 *  player: "NEW · The Narrows" should read "New on The Narrows"): "New on
 *  The Narrows", "New on Dark Water". */
export function newOnTag(chapter: number): string {
  return `New on ${CHAPTERS[chapter - 1].name}`;
}

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
 *  the platforms that fire several times, and the ones that bring a heavy. */
export const HEAVY_FOES: FoeId[] = ['rocketTruck', 'attackHeli', 'torpedoSub', 'stealthBomber', 'diveBomber', 'siege', 'spotter', 'tender', 'bodyguard'];

/** Free Play's Enemies line: as the campaign (the map's chapter), none of
 *  the new ones, all of them, or one on its own. */
export type FoeSetting = 'campaign' | 'none' | 'all' | FoeId;

/** Share of a wave's foes drawn from the chapter's own new ones. */
export const FOE_LEAD_SHARE = 0.6;

/** The numbers (first proposals; the plan doc has them in words). */
export const FOE = {
  sprinter: { size: 4, boostAt: 160, flare: 0.6, sprint: 300 },
  // Round 7 ("about 25% slower before the split"): the missile itself is
  // 25% slower (THREATS.hydra: 150 → 112.5 px/s); its darts are as fast as
  // before (THREATS.dart, 290). Round 8 ("a little bit more for both
  // stages"): 100 px/s, and its darts 255.
  hydra: { darts: 2, spread: 0.5, clear: 34 },
  // Test Lab round 1: each firing is a ripple of `perSalvo` small rockets,
  // `ripple` s apart, spread `spread` px round one aim point; the salvo
  // does what one rocket did (1 to the first hull it hits). Round 12's
  // fixes (the player, round 11: "The rocket truck speed off too fast when
  // they are done shooting, they should go at normal speeds"): done
  // firing, a truck drives off at `leave` × its own speed (THREATS.
  // rocketTruck, 75 px/s), in a boss round too. An event's trucks drive in
  // faster (EV's `drive`), but none drives off faster (it was drive ×
  // back, about 7 ×).
  rocketTruck: { raise: 2.4, gap: 1.5, salvos: 5, perSalvo: 5, ripple: 0.1, spread: 18, rocketSpeed: 560, hitRadius: 30, lower: 0.6, leave: 1 },
  // Log v45 (Saltgate Canal's boss): the Missile Truck, a TEL. It drives
  // to its spot, raises its one long missile on the erector over `raise` s
  // (a ring fills round it and a dashed red line marks the ship), holds it
  // upright `hold` s, and fires it: an ordinary ballistic missile (it can
  // be shot down, its red landing circle shows), lobbed high (at least
  // `apex` px over its line) and in the air at least `flight` s. It carries
  // `missiles` (one unless a boss says), `reload` s apart (the erector
  // comes down and goes up again), then lowers it (`lower` s) and drives
  // off at `leave` × its speed.
  missileTruck: { raise: 2.6, hold: 0.5, missiles: 1, reload: 3.2, flight: 3.0, apex: 150, lower: 0.8, leave: 1 },
  // The 2026-11-20 playtest ("it should just be able to start attacking it
  // doesn't need to go to a specific spot"; log v34): it fires whenever it
  // is `edge` px inside the screen, on the way in too; its first volley
  // `first` s after it may (a beat to see it and shoot first: with the
  // hover gone, 3 s and 5 hits (was 6) keep its volleys a helicopter where
  // they were, 0.63 against 0.57 on the Island: tools/v3/playtest-fixes/
  // measure.ts --what=foes).
  attackHeli: { accel: 260, settle: 0.8, gap: 3.2, pair: 2, perSpot: 2, volleys: 6, off: 90, pairGap: 0.25, edge: 30, first: 3 },
  // Round 7 ("the torpedo sub will fire three to five, and then sometimes
  // fast ones"): every sub fires a spread of `spread` torpedoes (three to
  // five) on headings at least `fan` rad apart: the first `aimed` at a
  // ship, the rest fanned out round it over the water (as a Rocket Truck's
  // salvo lands on and round its ship). With a spread to fire it fires `aim`
  // s later than a lone torpedo went (2.4 s after it comes up, not 1.2), and
  // stays up as long after. A sub carries a fast one in its spread with
  // chance `fastChance` (about one sub in four): it runs at `fastSpeed` × a
  // torpedo's speed, its line amber. Tuned with the Test Lab bots (80 seeds
  // of the card, three bots): the Wolf Pack's way (every torpedo at a ship
  // of its own, 0.6 s later) did 5.3× the lone torpedo's harm to the
  // convoy; this does about 2.4×.
  // Round 8 ("All the torpedoes just kind of fire in a random direction;
  // they should be targeted, and [fire] one by one, not all at once"; "the
  // subs shoot torpedoes from water to land"): no fan. Its three to five
  // torpedoes go one after another, `stagger` s apart, the first `aim` s
  // later than a lone torpedo went (3.0 s after it comes up; 2.4 in round
  // 7, so there is a beat more to shoot it first); each is aimed at a ship
  // (the one it has fired at least at, so the spread goes round the convoy
  // and comes back to a ship only when there are fewer ships than
  // torpedoes), down a line that is open water all the way to where it
  // meets the ship. A ship with no such line is passed over; with none, that
  // torpedo isn't fired. A torpedo's run past its ship stops short of any
  // shore. The sub dives `after` s after its last torpedo. Killed part way,
  // the rest don't go. A sub surfaces where it has open water to the lanes.
  // Tuned with the Test Lab bots (80 seeds of the card, three bots; the
  // round doc has the table).
  torpedoSub: { warn: 1.5, up: 3.5, fireAt: 1.2, run: 300, hitRadius: 24, spread: [2, 2], aim: 1.8, stagger: 0.8, after: 1.4, fan: 0.55, fastChance: 0.25, fastSpeed: 2.2 },
  armored: { plate: 4, turnAt: 0.45, turn: 1.6, swing: 1.75, front: 70 },
  /** Round 8, a full rework (the player: "when this drone is present it
   *  will deny the player the ability to pick up the weapons or boosts if
   *  [they are] within a radius of the drone"): it no longer takes
   *  pickups. Any pickup within `deny` px of it (its ring, drawn) is
   *  locked: a tap on it does nothing, and it doesn't age while locked, so
   *  killing the drone frees it whole. It flies to the pickup no other
   *  scavenger's ring covers (a weapon first, then the nearest) and hovers
   *  over it, circling `hover` px round it at `hoverSpin` rad/s, until it
   *  has none in its ring; with nothing on the water it circles (`orbit`
   *  px, `spin` rad/s) over the water `above` px off the convoy. It leaves
   *  (at `leave` px/s), its ring off, once nothing but helpers' targets is
   *  left of the wave, or after `stay` s.
   *  Round 9 (the player, on Supply Raid: "Radius for the drones could be
   *  about twice as large, and make sure it applies to the drones normally,
   *  outside of the special event"): `deny` 120 → 240 px, for every
   *  scavenger (its card, its pairs and Supply Raid share this one number;
   *  the ring is drawn from it). */
  scavenger: { deny: 240, hover: 48, hoverSpin: 1.1, leave: 210, stay: 40, orbit: 85, spin: 0.9, above: 170 },
  // Its run-in grows with its speed (Test Lab round 1: 270 → 315 px/s), so
  // the time to shoot it before its guns open stays about 1.1 s.
  stealthJet: { runIn: 350 },
  stealthBomber: { runIn: 420, bombs: 3 },
  // Test Lab round 1: seen from above like the other aircraft. Its run, in
  // the window: `run` px of ground (at most; from `top` px under the
  // screen's top edge, at least `minRun`), at up to `slant` rad off straight
  // down, letting go `short` px before the circle; then it pulls up and
  // banks away (`bank` rad/s) to the nearer edge at up to `exit` px/s.
  // Flying in from that far, the window is 0.4 s longer (the bots' sharp
  // player let three times the bombs through at 1.8 s) and the circle 0.4 s
  // shorter: the bomb still lands 4.7 s after the circle shows (`lead`).
  // Test Lab round 2 ("make it a little quicker", "make it faster and an
  // A-10 Warthog"): its run is 1.8 s, not 2.2 (the plane flies it 22%
  // faster), and the circle shows 0.4 s longer, 2.2 s, so the bomb still
  // lands 4.7 s after the circle. It pulls away faster too.
  // Test Lab round 4 ("slow it down a hair, not much … it still kinda just
  // appears, it should come in off screen like the rest"): it no longer
  // pops in near the top. `mark` s after the circle shows, it sets off from
  // `off` px past the screen's edge (plane and shadow out of sight), on the
  // line of its dive, flying in level at `cruise` px/s; the last `run` px
  // (at most) are its dive, in `window` s. Its run is 2.0 s, not 1.8: a
  // full dive is flown at 210 px/s, not 233 (10% slower), and nothing it
  // flies is faster than that. The circle shows 1.8 s before it sets off,
  // so with the off-screen stretch it comes into sight about 2.4 s after the
  // circle (2.2 before); its bomb lands `mark` + the flight in + `fall`
  // after the circle (5.1 to 5.6 s on the lab's water, 6.2 at most on a
  // map whose lane runs low; 4.7 before), and it is in sight 2.0 to 2.5 s
  // before it lets go (3.1 at most; 1.8 before).
  diveBomber: { mark: 1.8, window: 2.0, fall: 0.7, cruise: 210, off: 120, run: 420, top: 40, minRun: 140, slant: 0.4, short: 36, bank: 2, exit: 640, hit: 30, splash: 70, splashDamage: 1 },
  // Test Lab round 1: it hides in a hatch and is a target only while up.
  // `first`: the closed hatch before its first rise; `rise`: the gun coming
  // up (a target; the tell); up until its shells leave, and `hold`; then
  // down for `down` (no target; `lower` of it the gun sinking), and up
  // again. A salvo every rise + mark - flight + hold + down = 6.5 s. Out of
  // reach part of the time, it takes 5 hits, not 6 (THREATS.siege), so it
  // is no stronger than before (the Test Lab bots: about the same harm).
  siege: { first: 1, rise: 1.5, salvos: 3, shells: 2, mark: 3.4, flight: 1.1, hold: 0.3, lower: 0.6, down: 2.4, open: 0.5, radius: 46, damage: 2 },
  // `off`: how far past the lane's edge it circles (Test Lab round 1: "spot
  // from a little further", 150 → 185; its circle 110 → 100 so that fits on
  // screen). `edge`: its whole circle stays this far inside the screen.
  // Round 8 (the player, on the Fire Mission: "this is how the recon planes
  // should behave in general as well: they scout it out and lock on and
  // then leave and come back with the same health, and repeat until you
  // kill it. Also the projectile coming in should be like an artillery
  // shell coming in from off the map"): every Spotter flies turns. It flies
  // in to its circle, paints a ship `paint` s after it gets there (one it
  // didn't paint last turn, if it can), calls the guns `call` s later and
  // flies off the screen; `away` s later it comes back with the hits it
  // took, to a new circle, up to `turns` turns, as long as the rest of the
  // wave is still on (with nothing else left it doesn't come back). Its
  // call is `shells` artillery shells from a battery off the map, landing
  // `mark` s after the call and `gap` s apart, round where the ship will be
  // (`spread` px apart along its course), `dmg` each in FOE.siege.radius;
  // each comes into sight from the map's edge and flies `flight` s, and is
  // called off if the spotter is shot down before it is fired. (Before:
  // three ballistic missiles from the bases, which could be shot down, and
  // it circled for 22 s.) `share`: of new launches go for the painted ship.
  spotter: { orbit: 100, off: 185, edge: 35, paint: 2, call: 4, away: 6, turns: 4, shells: 3, mark: 2.6, gap: 0.45, spread: 50, flight: 1.6, dmg: 1, share: 0.7 },
  /** It sails in from a screen edge to open water `clear` px from any other
   *  boat, and keeps `keep` px off them while it moves. */
  tender: { gap: 3.5, charge: 1, mend: 2, reach: 340, clear: 150, keep: 90 },
  bodyguard: { guards: 3, orbit: 34, spin: 2.2 },
  /** It rises out of the water for `rise` s; then every helper within
   *  `radius` of it (or aiming at something within it) fires at it. */
  lure: { life: 20, rise: 1.4, radius: 300 },
  /** An incendiary missile (`turn` rad/s). Shot down or at its ship, it
   *  bursts into a fireball of `radius` that lingers `linger` s: a hull inside it
   *  takes a hit after `first` s, then every `tick` s (a ship sailing
   *  through takes one or two). Test Lab round 2: it flies at where its ship
   *  will be when it gets there (looking at most `horizon` s ahead), aiming
   *  up to `bow` px off the ship's bow until it is `bowFrom` px off, so it
   *  comes in on the bow or the flank; within `close` px it turns three
   *  times as hard. A ship whose bearing to the base is further astern than
   *  `astern` (the cosine off its bow; -0.2 is about 12° abaft the beam) it
   *  could only chase up its wake, so it picks the best placed ship. */
  cloud: { radius: 75, linger: 7, first: 0.7, tick: 2, turn: 0.9, horizon: 20, bow: 60, bowFrom: 40, close: 120, astern: 0.4 },
} as const;
