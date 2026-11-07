// The enemy build plan: what the player's marks on enemy round 1 turned
// into. One entry per enemy that is being built, in the chapter it debuts in.
// The plan doc (docs/design/v3-enemy-build.md, written by plan.mjs) and the
// review page's Build tab (page.mjs) both read this, so they can't drift.

export const BUILD_DATE = '2026-11-07';

/** Chapters, as the campaign has them (src/v3/data/maps.ts CHAPTERS). */
export const CHAPTER_NAMES = { 1: 'Home Waters', 2: 'The Narrows', 3: 'Dark Water', 4: 'Open War' };

/** Why each chapter gets the enemies it does. */
export const CHAPTER_WHY = {
  1: 'Easy to read at a glance: each one bends a rule you already know (drones, missiles, trucks).',
  2: 'Each asks for a new kind of answer: a target that moves between spots, one that travels in the lane, a plate, a moment, a race.',
  3: 'Surprise and marks on the water. Two of the five are the stealth aircraft, on the chapter with the night map.',
  4: 'Support: enemies that change the rules for the others. Last, once every other enemy is known.',
};

/**
 * Each enemy: `from` is its idea on the review page; `how` is what the build
 * does, in the player's terms; `tell` and `answer` are the fairness rule
 * (en-unstoppable: always a tell first, and the source is always killable);
 * `numbers` are first proposals, tuned in the build's sweep.
 */
export const BUILD = [
  // ---- Chapter 1: Home Waters ----
  {
    id: 'sprinter', from: 'p-sprint-drones', chapter: 1, name: 'Sprint Drones', cat: 'strike', sub: 'swarm',
    how: 'A swarm of four small drones flies in like the usual drones. Near its ship each one flares a booster for half a second, then sprints straight at it at four times the speed.',
    tell: 'The booster flare.', answer: 'Pick them off before the flare; Flak, Cutter and Scattergun take the swarm.',
    numbers: '1 hit each. Cruise 70, sprint 300 from 240 px out. 1 damage.',
  },
  {
    id: 'decoy', from: 'p-decoy', chapter: 1, name: 'Decoy Drones', cat: 'support', sub: 'deceive',
    how: 'A swarm of six that looks like any other, but three are decoys. Within 300 px of the convoy the decoys give themselves away: a white strobe and a dotted trail instead of the red light and exhaust. Decoys that reach a ship fizzle out harmlessly.',
    tell: 'Strobe and trail, up close.', answer: 'Wait and pick the real ones, or spend the rack early. Your helpers ignore decoys once they show.',
    numbers: '1 hit each. Real ones do 1 damage; decoys none.',
  },
  {
    id: 'hydra', from: 'hydra', chapter: 1, name: 'Hydra Missile', cat: 'strike', sub: 'trick',
    how: 'A two-hit missile with a forked tail. The hit that kills it splits it into two fast darts aimed at the two ships nearest it. Killed far out, the darts are easy; killed close, they arrive before you can answer.',
    tell: 'The forked tail.', answer: 'Kill it early, or with an area weapon that catches both darts.',
    numbers: 'Missile: 2 hits, 2 damage. Darts: 1 hit, speed 290, 1 damage.',
  },
  {
    id: 'rocketTruck', from: 'p-rocket-truck', chapter: 1, name: 'Rocket Artillery Truck', cat: 'platform', sub: 'shore',
    how: 'A truck drives down a shore road, stops, and slowly raises its launcher (2.4 s). Then it fires a rocket every 1.5 s, five in all, too fast to intercept. The truck itself is a target: four hits.',
    tell: 'The slow launcher raise.', answer: 'Drop everything and kill the truck while it raises.',
    numbers: 'Truck: 4 hits. Rockets: speed 560, 1 damage, can\'t be shot.',
  },
  {
    id: 'loiter', from: 'p-loiter', chapter: 1, name: 'Loitering Ambush Drones', cat: 'strike', sub: 'swarm',
    how: 'Four drones fly to a spot over the lane ahead of the convoy and circle there. When a ship comes within 190 px they all dive at once, each at a different ship. After 30 s they dive anyway.',
    tell: 'The circling group.', answer: 'Clear them while they wait, or save the rack for the raid and meet the dive.',
    numbers: '1 hit each. Dive speed 230, 1 damage.',
  },
  // ---- Chapter 2: The Narrows ----
  {
    id: 'attackHeli', from: 'p-attack-heli', chapter: 2, name: 'Attack Helicopter', cat: 'platform', sub: 'air',
    how: 'Flies in, settles over a firing spot beside the lane (the spot is marked as it comes), and fires a pair of small missiles every 3.2 s. After two pairs it moves to another spot; after six it leaves.',
    tell: 'It arrives and settles; the spot is marked.', answer: 'Commit six hits to it, or keep shooting its missiles (one hit each).',
    numbers: 'Heli: 6 hits. Missiles: 1 hit, 1 damage.',
  },
  {
    id: 'torpedoSub', from: 'p-torpedo-sub', chapter: 2, name: 'Torpedo Attack Submarine', cat: 'platform', sub: 'sea',
    how: 'A periscope, then the sub surfaces and stays up for 3.5 s, a target. It fires one slow torpedo along a straight line to where a ship will be, with the line drawn on the water. Anything in the line is hit. Then it dives.',
    tell: 'The wake line to the crossing point.', answer: 'Hit the sub while it is up, hit the torpedo (one hit), or change formation so no hull is on the line.',
    numbers: 'Sub: 3 hits while up. Torpedo: speed 75, 3 damage (sinks a fresh ship).',
  },
  {
    id: 'armored', from: 'p-armored-drone', chapter: 2, name: 'Armored Drone', cat: 'strike', sub: 'tough',
    how: 'A big drone with a plate on its nose. Shots from your gun that meet the nose hit the plate (four hits to break it). Halfway in it banks through a wide S-turn, and for that moment its side and tail face the carrier: shots then hit the drone itself (two hits). Blasts, the Railgun and the Lance go round the plate.',
    tell: 'The plate, and the bank.', answer: 'Time your shots for the turn, or use area weapons.',
    numbers: 'Plate 4, body 2. Speed 60, 2 damage.',
  },
  {
    id: 'crossWing', from: 'p-crossing-wing', chapter: 2, name: 'Crossing Attack Wing', cat: 'strike', sub: 'swarm',
    how: 'Six drones in two lines from two bases, flying to meet at one point over the water (marked with an X). For a moment they pass through each other, tightly packed, then each peels off at a different ship.',
    tell: 'The two lines converging, and the X.', answer: 'One area shot at the crossing, or six single shots after.',
    numbers: '1 hit each, 1 damage.',
  },
  {
    id: 'scavenger', from: 'scavenger', chapter: 2, name: 'Scavenger Drone', cat: 'support', sub: 'sabotage',
    how: 'A drone with a claw that flies to the pickup nearest it (weapon, ammo, repair or Nuke), with a line to the one it wants. If it gets there the pickup is gone, and it flies off. With nothing on the water it waits at the top of the screen.',
    tell: 'The claw, and the line to the pickup.', answer: 'Shoot it first, or take the pickup before it arrives.',
    numbers: '1 hit. Speed 170.',
  },
  // ---- Chapter 3: Dark Water ----
  {
    id: 'stealthJet', from: 'p-stealth-strafer', chapter: 3, name: 'Stealth Strafer', cat: 'platform', sub: 'air',
    how: 'A dark, faceted jet that comes in with no warning arrow and no band. It still flies 300 px onto the screen before its guns open, about a second to react.',
    tell: 'Only the jet, on its run-in.', answer: 'Shoot it on the run-in, or Shield and Aegis.',
    numbers: '3 hits, as the Strike jet. Guns: 1 damage per hull.',
  },
  {
    id: 'stealthBomber', from: 'p-stealth-bomber', chapter: 3, name: 'Stealth Bomber', cat: 'platform', sub: 'air',
    how: 'A flying wing (the B-2\'s shape, as the player asked) with no warning. After a long run-in it drops three guided missiles on the convoy. More armour than the missile bomber.',
    tell: 'Only the bomber.', answer: 'Spend six hits on it, or shoot its three missiles.',
    numbers: '6 hits (the missile bomber has 3). 3 missiles, 1 hit each.',
  },
  {
    id: 'diveBomber', from: 'p-dive-bomber', chapter: 3, name: 'Dive Bomber', cat: 'platform', sub: 'air',
    how: 'The player\'s redesign: a circle appears on the water where a ship is about to be. 2.2 s later the plane drops out of the sky onto it, and for 1.1 s it can be shot. If it lives, the bomb falls and nothing can stop it. The circle does not follow the ship.',
    tell: 'The circle, then the plane.', answer: 'Hit the plane in its window, or move the ships out of the circle.',
    numbers: 'Plane: 2 hits. Bomb: 3 damage in the circle (sinks a fresh ship), 1 within 70 px.',
  },
  {
    id: 'siege', from: 'p-siege-battery', chapter: 3, name: 'Coastal Siege Battery', cat: 'platform', sub: 'shore',
    how: 'A gun on the enemy shore. It marks three circles on the lane ahead of the convoy, and 3.4 s later its shells land in them. Shells can\'t be intercepted. It fires four salvos, 6 s apart. The gun can be destroyed.',
    tell: 'The circles on the water.', answer: 'Silence the gun, or move the convoy out of the circles.',
    numbers: 'Gun: 6 hits. Shells: 2 damage each, 46 px.',
  },
  {
    id: 'spotter', from: 'p-spotter', chapter: 3, name: 'Target-Spotter Aircraft', cat: 'support', sub: 'coordinate',
    how: 'A recon plane circles beside the convoy and paints one ship with a beam. While it paints, most new launches go for that ship, and 4 s in it calls a strike: three missiles from the bases at it. Shoot it down and the strike it called is cancelled; what has launched keeps coming.',
    tell: 'The beam on one ship.', answer: 'Break the spotter before the strike, or cover the marked ship.',
    numbers: '4 hits. Leaves after 22 s.',
  },
  // ---- Chapter 4: Open War ----
  {
    id: 'tender', from: 'p-repair-tender', chapter: 4, name: 'Repair Tender', cat: 'support', sub: 'shield',
    how: 'An enemy vessel that sails in with a heavy missile. Every 3.5 s it charges a beam (you see it for a second) and mends the most damaged enemy near it by two hits.',
    tell: 'The beam and its pulse.', answer: 'Finish the tough target between pulses, or sink the tender first.',
    numbers: '6 hits. Mends 2 within 340 px.',
  },
  {
    id: 'bodyguard', from: 'bodyguard', chapter: 4, name: 'Bodyguard Ring', cat: 'support', sub: 'shield',
    how: 'Three little guard drones circle a heavy cruise missile. A shot at the heavy meets a guard first: the guard dies, the heavy is untouched. Guards don\'t attack. Blasts that catch the ring clear it; the Railgun and Lance go straight through.',
    tell: 'The orbiting ring.', answer: 'Clear the ring with an area weapon, or spend three shots first.',
    numbers: 'Guards: 1 hit each. The heavy as usual (8 hits).',
  },
  {
    id: 'picket', from: 'picket', chapter: 4, name: 'Flak Picket', cat: 'support', sub: 'sabotage',
    how: 'A small warship sits off the lane in a ring. Your shots that fly through the ring at something else are shot down, one every half second, with a puff where each dies. A burst gets through; a trickle doesn\'t. Shots at the picket itself are not shot down.',
    tell: 'The ring, and puffs where your shots die.', answer: 'Sink it (five hits), fire in bursts, or use helpers that don\'t fly through it.',
    numbers: '5 hits. Ring 120 px. Downs 2 shots a second.',
  },
  {
    id: 'lure', from: 'lure', chapter: 4, name: 'Lure Beacon', cat: 'support', sub: 'sabotage',
    how: 'A flashing buoy in open water. While it flashes, your helpers (Drone Screen, Gunship Pair, Orbital Strike, Aegis, Frigate Escort, the allied guns) go for it instead of real threats, and their shots do nothing to it. Only your taps can sink it: two hits.',
    tell: 'The flashing buoy, and helpers turning toward it.', answer: 'Two taps on the buoy and your helpers are back.',
    numbers: '2 hits (taps only). Gone after 20 s.',
  },
  {
    id: 'barge', from: 'barge', chapter: 4, name: 'Supply Barge', cat: 'support', sub: 'coordinate',
    how: 'An enemy barge moors off the enemy shore. While it floats, every raid gets one more missile from each site that fires in it, with a +1 over each site. It never fires.',
    tell: 'Crates on deck, and +1 over each site.', answer: 'Twelve hits sink it; the next raid shrinks back.',
    numbers: '12 hits.',
  },
  {
    id: 'cloud', from: 'volatile', chapter: 4, name: 'Volatile Cloud', cat: 'strike', sub: 'trick',
    how: 'The player brought it back: a gas cloud drifts off the enemy shore and across the lane. Any explosion inside it sets it off (your bursts, enemy hits, a tap on the cloud). Set off over your ships, it hurts every hull under it; set off over open water, it\'s harmless. Left alone it thins out after 28 s.',
    tell: 'The cloud itself, drifting.', answer: 'Pop it before it reaches the convoy, and don\'t fire into it once it\'s over your ships.',
    numbers: '1 hit pops it. 2 damage to each ship under it. Radius 75.',
  },
];

/** Readings of the marks the player should check (shown on the page). */
export const READINGS = [
  { id: 'p-dive-bomber', text: 'The Dive Bomber had a note but no verdict button pressed. The note starts "I like this", so it is built, your way (circle first, the plane only at the last moment, the falling bomb can\'t be stopped).' },
  { id: 'lure', text: 'Your note on the Lure Beacon: "passive attacks will hit this". I read it as: your helpers go for the beacon. As built, their shots do nothing to it and only taps sink it. If you meant their shots should hurt it, say so on the Build tab.' },
  { id: 'scavenger', text: 'Scavenger: once it reaches a pickup, the pickup is gone (your note). Shooting it on the way home gives nothing back.' },
  { id: 'volatile', text: 'Volatile Cloud: brought back as your note says, an explosion inside it over your ships hurts them. It hurts only your ships, never threats.' },
  { id: 'p-stealth-bomber', text: 'Stealth Bomber: a flying wing like the B-2, and 6 hits instead of the missile bomber\'s 3.' },
];

/** The answers, and what each means for the build. */
export const ANSWER_EFFECT = {
  'en-taxonomy': 'Strikes, Platforms, Support stay the three categories; each enemy\'s card and debut note names its own.',
  'en-count': 'Every enemy you marked Go further is built: twenty, plus the Volatile Cloud you brought back. They are built a chapter at a time.',
  'en-chapters': 'A few debut in each chapter, like the weapons: five, five, five and six. Once debuted, an enemy can turn up on every later map.',
  'en-stealth': 'Two enemies, the Stealth Strafer and the Stealth Bomber, each its own kind.',
  'en-unstoppable': 'Rocket Truck, Siege Battery and Dive Bomber: each has a clear tell first, and its source can always be shot.',
};

/** Questions on the Build tab, for this round. */
export const BUILD_QUESTIONS = [
  {
    id: 'eb-lure',
    q: 'Lure Beacon: your helpers go for it. Should their shots hurt it?',
    options: ['No: helpers waste their shots, only taps sink it (as built)', 'Yes: helpers can sink it too, so it gets more health', 'Something else (note)'],
  },
  {
    id: 'eb-pace',
    q: 'How many of the new enemies in a wave?',
    options: ['One from wave 2, rising to four by wave 10 (as built)', 'Fewer: they should be a surprise, not the wave', 'More: make them the main event'],
  },
];
