// WEAPONS (V3). The in-run draft deals these instead of V2's upgrade cards.
//
// Playtest round 2 ("too much managing with the activations hitting the
// buttons"): a weapon is no longer charged and fired from a button. Drafting
// one puts it in the drop pool; during a wave it drops as a pickup like the
// power-ups, and tapping the pickup loads it into the main gun for
// WEAPON.time seconds. While it is loaded every tap fires it instead of (or
// on top of) a plain interceptor, and every shot spends a round from the rack
// like any other. Nothing to aim apart from the tap you were making anyway.
//
// Round 3 ("make new drops … around the new pick up mechanic and the fact
// that it replaces the main gun"): the five weakest of round 2 (EMP Rounds,
// Hellfire Salvo, Smoke Shells, Decoy Flares, Sub Hunter) were cut and five
// new guns built for a 15 s swap: Flak Cannon, Seeker Pod, Cryo Rounds,
// Gravity Well and (after the player found a Point-Defense Laser too close to
// the Railgun: both instant hits) Aegis Dome, the one that protects instead of
// shooting. Each one changes what a plain tap does and nothing else, so there
// is still only one thing to do: tap.
//
// Round 6 (the player, after playing them: Air Strike "very fun … very op in
// a good way"; Cryo "sucks, the freeze really doesn't matter"): Cryo Rounds
// cut, and five added, four of them the player's: Shrapnel Shell (fragments
// out in every direction, at once), Frigate Escort (two frigates sail in and
// fire on their own for the 15 s), Thermobaric Shell (one huge blast),
// Scattergun (a short blast of pellets) and Boomerang (a blade out to the tap
// and back). Each one kills on its own, none only sets up other shots.
//
// Three held at once, three levels each; level 3 is the EVOLUTION, which
// changes what the weapon does, not just its numbers. (Internally they are
// still `AbilityId`s: the draft, the slots and the save were built for them.)

import type { ThreatKind } from './config';

export type AbilityId =
  | 'airstrike'
  | 'railgun'
  | 'tesla'
  | 'flak'
  | 'seeker'
  | 'aegis'
  | 'well'
  | 'shrapnel'
  | 'frigate'
  | 'thermo'
  | 'scatter'
  | 'boomerang'
  // The weapons plan (docs/design/v3-weapons-plan.md), phase 1: the actives
  // with new verbs (data/roster.ts: from which chapter each joins the draft).
  | 'lance'
  | 'cutter'
  | 'grapnel'
  | 'cadence'
  // Phase 2: four passives (the gun stays plain while they work).
  | 'droneScreen'
  | 'gunships'
  | 'bomberWing'
  | 'orbital'
  // Phase 3: boosts. Picking one up never replaces the loaded weapon: it
  // changes how everything you fire works while it lasts.
  // (Test Lab round 5 cut Overclock and Time Warp, and moved Wild Card to
  // the actives: data/roster.ts.)
  | 'supplyRun'
  | 'dualWield'
  | 'wildCard'
  | 'focus'
  | 'overdrive'
  | 'shield'
  | 'fullSteam';
/** A draft card: a weapon, or Resupply (keeps your build, takes no slot). */
export type CardId = AbilityId | 'resupply';

export interface AbilityDef {
  id: AbilityId;
  name: string;
  /** Its name once evolved (level 3). */
  evolved: string;
  /** Which threat it answers — shown on the card. */
  answers: string;
  /** What a shot does at levels 1, 2, 3 (index 0 = level 1); level 3 is the
   *  evolution (the card's badge and new name say so, the line doesn't). */
  levels: [string, string, string];
  /** How a tap fires it, shown when it is loaded. */
  how: string;
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  flak: {
    id: 'flak',
    name: 'Flak Cannon',
    evolved: 'Flak Curtain',
    answers: 'Swarms',
    levels: [
      'Each shell leaves a flak cloud for 1.5 s; anything in it takes 1 hit every 0.35 s',
      'Cloud 21% wider; lasts 2 s',
      'Clouds last 4 s and are 17% wider: a wall the swarm must fly through',
    ],
    how: 'Tap a swarm, or the water in its path',
  },
  seeker: {
    id: 'seeker',
    name: 'Seeker Pod',
    evolved: 'Swarm Pod',
    answers: 'Raids',
    levels: [
      'Each tap launches 3 seekers at the threats nearest your finger, 1/3 hit each',
      '4 seekers a tap',
      '5 seekers a tap; one whose target dies finds another',
    ],
    how: 'Tap in the middle of a raid',
  },
  // Test Lab round 5 (the player: "can we rename it to something else? I
  // don't like what we have"): Point Defense, the id kept.
  aegis: {
    id: 'aegis',
    name: 'Point Defense',
    evolved: 'Point Defense Grid',
    answers: 'Missiles',
    levels: [
      'Every ship carries 1 interceptor that fires on its own at a threat about to hit it',
      '2 interceptors a ship; they fire from 33% further out',
      'Spent interceptors reload every 3 s; the carrier gets 3 of its own',
    ],
    how: 'Keep shooting: every ship fires its own',
  },
  well: {
    id: 'well',
    name: 'Gravity Well',
    evolved: 'Singularity',
    answers: 'Wide raids',
    levels: [
      'Each shell opens a vortex for 1.5 s, then implodes for 2 hits. Missiles, drones and small boats are pulled in; big ones are slowed to 35%',
      'Pull 20% wider; implosion hits for 3',
      'Lasts 2 s, pulls in everything (big ones too) and implodes for 4',
    ],
    how: 'Tap between the threats you want pulled together',
  },
  airstrike: {
    id: 'airstrike',
    name: 'Air Strike',
    evolved: 'Carpet Strike',
    answers: 'Aircraft',
    levels: [
      'Each tap sends a jet down that row: 2 hits on everything under it. 2 rounds a jet',
      'Row 19% wider; hits for 3',
      'Hits for 4; the row burns for 2 s, and subs and trucks under it are destroyed',
    ],
    how: 'Tap a row: a jet flies across it, for 2 rounds',
  },
  railgun: {
    id: 'railgun',
    name: 'Railgun',
    evolved: 'Mass Driver',
    answers: 'Heavies',
    levels: [
      'Each shot is a beam that pierces everything in line, 1 hit each',
      'Beam hits for 2 and is 29% wider',
      'Beam hits for 4 and is 44% wider: two bring down a heavy missile',
    ],
    how: 'Tap anywhere: the beam fires through it',
  },
  tesla: {
    id: 'tesla',
    name: 'Tesla Arc',
    evolved: 'Storm Coil',
    answers: 'Crowds',
    levels: [
      'Every hit arcs to 3 threats nearby, 1 hit each',
      '4 arcs a hit, and every arc arcs again',
      'Each tap also fires a free second shot at a threat nearby',
    ],
    how: 'Tap threats as usual',
  },
  shrapnel: {
    id: 'shrapnel',
    name: 'Shrapnel Shell',
    evolved: 'Fragstorm',
    answers: 'Swarms',
    levels: [
      'Each shell bursts into 10 fragments in every direction, 1 hit each',
      '14 fragments, reaching 23% further',
      '18 fragments that pierce everything in their path',
    ],
    how: 'Tap into a swarm',
  },
  frigate: {
    id: 'frigate',
    name: 'Frigate Escort',
    evolved: 'Battle Group',
    answers: 'Everything',
    levels: [
      'Two frigates sail in and fire on their own, a shot every 0.9 s each',
      'Fire rate +50%',
      'A third frigate joins; fire rate +33%',
    ],
    how: 'Keep shooting: the frigates fire on their own',
  },
  thermo: {
    id: 'thermo',
    name: 'Thermobaric Shell',
    evolved: 'Daisy Cutter',
    answers: 'Packs',
    levels: [
      'Each shell bursts in a huge blast: 1 hit on everything in it',
      'Blast 27% wider; hits for 2',
      'Blast 26% wider again; hits for 3',
    ],
    how: 'Tap the middle of a pack',
  },
  scatter: {
    id: 'scatter',
    name: 'Scattergun',
    evolved: "Dragon's Breath",
    answers: 'Rushers',
    levels: [
      'Each tap fires 8 pellets in a short cone toward your finger, 1 hit each',
      '11 pellets, reaching 17% further',
      '15 pellets that pierce everything in their path',
    ],
    how: 'Tap threats closing on the gun',
  },
  boomerang: {
    id: 'boomerang',
    name: 'Boomerang',
    evolved: 'Twin Blades',
    answers: 'Lines',
    levels: [
      'Each tap throws a blade to the threat and back: 1 hit on everything it passes, both ways',
      'Blade 29% wider; hits for 2',
      'Two blades a tap',
    ],
    how: 'Tap past a line of threats',
  },
  lance: {
    id: 'lance',
    name: 'Charge Lance',
    evolved: 'Sunspear',
    answers: 'Heavies',
    levels: [
      'Tap: a normal shot. Hold 0.35 s: a 3-hit bolt. Hold 0.7 s: a 6-hit lance through everything in line',
      'Charges 33% faster; the 3-hit bolt pierces',
      'A full lance leaves a line that burns for 2 s',
    ],
    how: 'Hold to charge, let go to fire',
  },
  cutter: {
    id: 'cutter',
    name: 'Laser Cutter',
    evolved: 'Searing Edge',
    answers: 'Swarms',
    levels: [
      'Swipe across threats: 1 hit on everything under your finger. Keep it down to keep cutting, 1 round per 320 px',
      'Each round cuts 31% further (420 px)',
      'The cut stays lit for 1 s and burns what flies into it',
    ],
    how: 'Swipe across threats; hold to keep cutting',
  },
  grapnel: {
    id: 'grapnel',
    name: 'Grapnel',
    evolved: 'Wrecking Ball',
    answers: 'Packs',
    levels: [
      'Hold a threat to hook it, drag to smash it into others (2 hits each), let go to throw it: it bursts for 2 on the first threat it hits',
      'Swings 36% faster; smashes hit for 3',
      'The burst hits for 3 and is 86% wider',
    ],
    how: 'Hold a threat, drag, let go to throw',
  },
  cadence: {
    id: 'cadence',
    name: 'Cadence Gun',
    evolved: 'War Drum',
    answers: 'Heavies',
    levels: [
      'A beat every 0.9 s. Tap on it for a free 4-hit shot that pierces; off it, a normal shot',
      'Beat window 50% longer',
      'On the beat it destroys any truck, siege gun, helicopter, sub or repair ship in line; 3 beats in a row and the 4th fires a free broadside at 8 threats',
    ],
    how: 'Tap on the beat',
  },
  droneScreen: {
    id: 'droneScreen',
    name: 'Drone Screen',
    evolved: 'Hornet Nest',
    answers: 'Drones',
    levels: [
      'A drone lifts off the carrier every 1.2 s and rams the threat closest to your ships, 1 hit (none while nothing is on screen)',
      'Launch rate +33% (a drone every 0.9 s)',
      'Launch rate +29% (every 0.7 s); each ram bursts, hitting everything around it',
    ],
    how: 'Keep shooting: the drones ram on their own',
  },
  gunships: {
    id: 'gunships',
    name: 'Gunship Pair',
    evolved: 'Hellfire Wing',
    answers: 'Packs',
    levels: [
      'Two helicopters hover over the convoy, each firing a rocket at the thickest cluster every 1.25 s, 1 hit in a blast',
      'Fire rate +39%',
      'A third helicopter joins; rockets hit for 2',
    ],
    how: 'Keep shooting: the helicopters fire on their own',
  },
  bomberWing: {
    id: 'bomberWing',
    name: 'Bomber Wing',
    evolved: 'Carpet Raid',
    answers: 'Launchers',
    levels: [
      'Every 6 s a bomber crosses and destroys an aircraft, sub or truck it flies over; with none up, it silences the busiest silo or tunnel for 6 s',
      'A pass every 4.5 s',
      'A pass every 3.5 s with 2 bombers, each on its own target; silos stay silent 8 s',
    ],
    how: 'Keep shooting: the bombers hit what they fly over',
  },
  orbital: {
    id: 'orbital',
    name: 'Orbital Strike',
    evolved: 'Sky Spear',
    answers: 'Heavies',
    levels: [
      'Every 2.5 s a beam from orbit hits the toughest threat on screen for 3 (1 to what is around it)',
      'A strike every 1.8 s',
      'A strike every 1.2 s; each beam strikes the next toughest too',
    ],
    how: 'Keep shooting: the satellite picks the biggest',
  },
  // ---- Phase 3: boosts (the weapons plan, round 3's levels).
  // Test Lab round 5 (the player: "Remove the magnet part ... especially if
  // the player does not want the power up ... it can be weapons or the nuke
  // too"): nothing flies to the carrier any more; the crates carry weapons
  // and boosts too, and Airdrop's now and then a Nuke.
  supplyRun: {
    id: 'supplyRun',
    name: 'Supply Run',
    evolved: 'Airdrop',
    answers: 'Running dry',
    levels: [
      'A cargo plane drops 3 crates: ammo, a repair and one of your weapons or boosts; kills drop 2× as much. Tap the crates you want',
      '5 crates (2 of them gear); kills drop 3× as much',
      'Every 6 s another plane drops a crate of gear, now and then a Nuke',
    ],
    how: 'Tap the crates you want',
  },
  dualWield: {
    id: 'dualWield',
    name: 'Dual Wield',
    evolved: 'Arsenal Drop',
    answers: 'Combos',
    levels: [
      'The next weapon you pick up joins the loaded one: every tap fires both, for 1 round. Lasts 15 s; another Dual Wield restarts it',
      'Lasts 20 s',
      'Weapons drop 2× as often while it lasts',
    ],
    how: 'Pick up a second weapon: both fire',
  },
  // Test Lab round 5 (the player: "it needs to be a weapon drop not a
  // boost ... replace whatever weapon you currently have since it takes
  // over the main gun"): an active weapon now, loaded like any other.
  wildCard: {
    id: 'wildCard',
    name: 'Wild Card',
    evolved: 'Jackpot',
    answers: 'Anything, by luck',
    levels: [
      'Takes over the gun: each tap fires a random weapon\'s level 1 shot',
      'Each pickup also brings 1 random passive (frigates, gunships, drones…) for 8 s; shots at level 2',
      'Shots at MAX; the passive at level 2',
    ],
    how: 'Each tap is a random weapon',
  },
  focus: {
    id: 'focus',
    name: 'Focus',
    evolved: 'Deadeye',
    answers: 'Everything at once',
    levels: [
      'Hold the button on the left for slow motion (35% speed), up to 10 s in all; tap anywhere to shoot. The rack reloads at full speed',
      '15 s of slow motion, at 25% speed',
      'Shots fired in slow motion hit for 3×',
    ],
    how: 'Hold the left button to slow time; tap to shoot',
  },
  overdrive: {
    id: 'overdrive',
    name: 'Overdrive',
    evolved: 'Hyper Overdrive',
    answers: 'Running dry',
    levels: [
      'Shots cost no rounds for 15 s',
      'Lasts 18 s',
      'Every shot fires twice: two shells, two beams, two blades, side by side',
    ],
    how: 'Free rounds: keep firing',
  },
  shield: {
    id: 'shield',
    name: 'Shield',
    evolved: 'Reflect',
    answers: 'Missiles',
    levels: [
      'For 15 s, ships and the carrier take no damage from missiles, drones and boats',
      'Every hit it blocks puts 1 round back in the rack',
      'Lasts 18 s; a blocked missile bounces back and bursts on what is behind it',
    ],
    how: 'Your hulls are shielded',
  },
  fullSteam: {
    id: 'fullSteam',
    name: 'Full Steam',
    evolved: 'Ramming Speed',
    answers: 'Getting ships home',
    levels: [
      'The convoy sails 1.6× faster for 15 s',
      'Speed 2×',
      'Ships at full steam ram drones and boats out of the water',
    ],
    how: 'The convoy runs for it',
  },
};

/** Every weapon, in roster order (the draft and Free Play read which are
 *  live and when they unlock from data/roster.ts). */
export const ABILITY_ORDER: AbilityId[] = [
  'airstrike', 'shrapnel', 'frigate', 'thermo', 'scatter', 'boomerang', 'flak', 'seeker', 'aegis', 'well', 'railgun', 'tesla',
  'lance', 'cutter', 'grapnel', 'cadence',
  'droneScreen', 'gunships', 'bomberWing', 'orbital',
  'wildCard',
  'supplyRun', 'dualWield', 'focus', 'overdrive', 'shield', 'fullSteam',
];

/** Levels per weapon; the last is the evolution. */
export const ABILITY_MAX = 3;
/** Different weapons a loadout can hold at once. */
export const MAX_SLOTS = 3;

/** Names short enough for the rail's timer chip (the card shows the full name). */
export const SHORT_NAME: Record<AbilityId, [string, string]> = {
  flak: ['FLAK', 'CURTAIN'],
  seeker: ['SEEKERS', 'SWARM POD'],
  aegis: ['POINT DEF', 'PD GRID'],
  well: ['GRAVITY', 'SINGULARITY'],
  airstrike: ['AIR STRIKE', 'CARPET'],
  railgun: ['RAILGUN', 'MASS DRIVER'],
  tesla: ['TESLA', 'STORM COIL'],
  shrapnel: ['SHRAPNEL', 'FRAGSTORM'],
  frigate: ['FRIGATES', 'BATTLE GRP'],
  thermo: ['THERMO', 'DAISY CUT'],
  scatter: ['SCATTER', 'DRAGON'],
  boomerang: ['BOOMERANG', 'TWIN BLADES'],
  lance: ['LANCE', 'SUNSPEAR'],
  cutter: ['CUTTER', 'SEARING'],
  grapnel: ['GRAPNEL', 'WRECKER'],
  cadence: ['CADENCE', 'WAR DRUM'],
  droneScreen: ['DRONES', 'HORNETS'],
  gunships: ['GUNSHIPS', 'HELLFIRE'],
  bomberWing: ['BOMBERS', 'CARPET RAID'],
  orbital: ['ORBITAL', 'SKY SPEAR'],
  supplyRun: ['SUPPLY RUN', 'AIRDROP'],
  dualWield: ['DUAL WIELD', 'ARSENAL'],
  wildCard: ['WILD CARD', 'JACKPOT'],
  focus: ['FOCUS', 'DEADEYE'],
  overdrive: ['OVERDRIVE', 'HYPER'],
  shield: ['SHIELD', 'REFLECT'],
  fullSteam: ['FULL STEAM', 'RAMMING'],
};

/** How weapons come and go. */
export const WEAPON = {
  /** Seconds a weapon pickup keeps the gun loaded with it. */
  time: 15,
  /** A kill that drops no power-up drops a weapon you hold at this share of
   *  its power-up drop chance (only one weapon pickup on the water at once). */
  share: 0.45,
  /** Seconds without a weapon drop after which the next kill drops one. */
  pity: 28,
  /** Seconds a weapon pickup floats before it is gone (power-ups: 5). */
  life: 7,
} as const;

/** Every effect number, so tuning stays in data. Per-level arrays are
 *  indexed by level − 1. */
export const AB = {
  /** Flak: a cloud of radius `radius` for `time` s, hitting each threat in
   *  it for 1 every `tick` s. */
  flak: { radius: [95, 115, 135], time: [1.5, 2, 4], tick: 0.35 },
  /** Seekers: `missiles` per tap at the threats nearest the tap (within
   *  `reach`), each hitting for 1 with a small blast. */
  seeker: { missiles: [3, 4, 5], reach: 360, speed: 900, blast: 14, damage: 1 / 3 },
  /** Aegis: a dome on one ship (or the carrier) for `time` s that takes
   *  `hits` hits; Bastion bursts for `burstDmg` within `burst` per hit. A tap
   *  with no threat covers the hull nearest it within `reach`. */
  // Round 8: each ship's own interceptors, fired at a threat closing on it
  // within `reach`; Bastion reloads one every `reload` s, the carrier too.
  aegis: { missiles: [1, 2, 2], reach: [240, 320, 320], reload: 3, carrier: 3 },
  /** Gravity Well: pulls threats within `radius` toward it at `pull` px/s
   *  for `time` s, then hits those within `core` for `damage`. */
  // Test Lab round 5 (the player: "categorize it by size: bigger stuff it
  // just kind of slows it down while the smaller stuff it does pull it in
  // and then eventually pull in everything once it's fully upgraded"):
  // small threats (every missile you can shoot, drones, small boats, mines)
  // are dragged in at every level; big ones (aircraft, helicopters,
  // motherships, vehicles, subs, the tender) only move at `slow` of their
  // speed inside it until MAX, which drags in everything. Structures never.
  well: { radius: [200, 240, 260], time: [1.5, 1.5, 2], pull: 320, core: [100, 110, 120], damage: [2, 3, 4], slow: 0.35 },
  /** A jet costs `cost` rounds (playtest: one round a jet was too strong). */
  // Carpet Strike's napalm (round 8): a canister every dropGap, falling for
  // `fall` s while drifting on at `drift` of the jet's speed.
  airstrike: { speed: 1800, band: [80, 95, 110], damage: [2, 3, 4], burnTime: 2, burnTick: 0.5, cost: 2, dropGap: 130, fall: 0.35, drift: 0.12 },
  railgun: { damage: [1, 2, 4], width: [14, 18, 26] },
  tesla: { arcs: [3, 4, 4], range: 200, depth: [1, 2, 2], twin: 260 },
  /** Shrapnel: `frags` fragments out from the burst, each reaching `range`
   *  and hitting the first threat within `width` of its path (Fragstorm:
   *  every threat on it). */
  shrapnel: { frags: [10, 14, 18], range: [220, 270, 300], width: 18, damage: 1 },
  /** Frigates: `ships` sail to stations and fire a free interceptor every
   *  `gap` s at a threat within `range`. */
  frigate: { ships: [2, 2, 3], gap: [0.9, 0.6, 0.45], range: 560, speed: 260 },
  /** Thermobaric: one blast of `radius`, hitting everything in it. */
  thermo: { radius: [150, 190, 240], damage: [1, 2, 3] },
  /** Scattergun: `pellets` from the gun over `spread` radians toward the tap,
   *  each reaching `range` and hitting the first threat within `width` of its
   *  path (Dragon's Breath: every threat on it). */
  scatter: { pellets: [8, 11, 15], spread: 0.32, range: [650, 760, 860], width: 18, damage: 1 },
  /** Boomerang: a blade at `speed` to the tap (at most `range`) and back,
   *  cutting each threat within `width` once a pass. */
  boomerang: { speed: 1100, range: 900, width: [34, 44, 44], damage: [1, 2, 2] },
  /** Charge Lance: a tap under `tapHold` s is a plain shot; holding charges
   *  (× `rate` a level); let go at `half` s for a `halfDmg` bolt at the threat
   *  under the finger, at `full` s for a `fullDmg` lance through everything
   *  `width` either side of the line. Sunspear burns that line `burn` s. */
  // Phase 1 sweep: a charge only for heavies barely mattered (heavies are
  // rare); a short hold now triples any shot, so it is worth doing on most
  // threats, and a full one pierces everything in line.
  lance: { tapHold: 0.15, half: 0.35, full: 0.7, rate: [1, 1.33, 1.33], halfDmg: 3, fullDmg: 6, width: 22, burn: 2 },
  /** Laser Cutter: a press that moves `start` px is a swipe; the path cuts
   *  everything within `width` of it, one round for every `length` px of
   *  path (each threat once a round). Test Lab round 5 (the player: "if your
   *  finger is still holding down, it should keep using the ammo"): no cap
   *  on a press, it cuts until the finger lifts or the rack runs dry.
   *  Searing Edge leaves the cut lit `lit` s. */
  cutter: { start: 14, length: [320, 420, 420], width: 30, damage: 1, lit: 1 },
  /** Grapnel: hold on any threat on screen to hook it (one round); it
   *  follows the finger at up to `speed` px/s and smacks what it touches
   *  (`smackR`) for `smack`, a threat once every `again` s. Let go (or after
   *  `hold` s) and it flies `fly` s and bursts: `burst` hits in `burstR` (the
   *  ball included). Structures can't be hooked. */
  // Test Lab round 5 (the player: "Make the grapple so it can always reach
  // anywhere across the screen; that shouldn't be a level lock"): the reach
  // is the whole screen from level 1, and level 2 swings faster and smacks
  // harder instead.
  // Test Lab round 8 (the player: "if it runs into another enemy [it]
  // explodes, unless it will still have some health"): a flung ball that
  // comes within `impactR` of another threat bursts there at once; one that
  // survives its own burst keeps its hit points and flies on.
  grapnel: { speed: [1100, 1500, 1500], smack: [2, 3, 3], smackR: 34, again: 0.5, hold: 2.5, fly: 0.35, burst: [2, 2, 3], burstR: [70, 70, 130], impactR: 34 },
  /** Cadence Gun: a beat every `period` s; a tap within `window` s of one
   *  fires a `damage` shot that pierces (`width`); off the beat, a plain
   *  shot. War Drum: `run` beats hit in a row, and the next beat fires a
   *  free broadside at the `broadside` most urgent threats. */
  // Lock-in round: the player asked for a slower beat ("tap tap tap in the
  // same intervals": 0.6 s burned the rack) and for it to be buffed to the
  // middle of the table. At 0.9 s it won 20% at MAX; beat shots that cost
  // no round (`free`), hit harder and wider, and a quicker War Drum: 41%.
  // Test Lab round 4 ("have the third upgrade be a little bit more powerful.
  // Maybe we could blow up the platforms and vehicles"): War Drum's beat shot
  // also destroys outright every platform and vehicle on its line (`wrecks`;
  // a siege gun while it is up, a torpedo sub surfaced) and every launch
  // truck or sub up within `raider` px of it. Level 3, on the beat, only.
  cadence: {
    period: 0.9, window: [0.16, 0.24, 0.24], damage: 4, width: 40, run: 3, broadside: 8, free: true as boolean,
    wrecks: ['rocketTruck', 'siege', 'attackHeli', 'torpedoSub', 'tender', 'stealthBomber', 'stealthJet', 'diveBomber', 'mothership'] as ThreatKind[],
    raider: 50,
  },
  /** Drone Screen (the player's idea): a drone lifts off the carrier deck
   *  every `gap` s (the player: "always the carrier deck") and flies at
   *  `speed` to ram the threat closest to hitting a hull that no other drone
   *  is after, for `damage`; it gives up after `life` s. Hornet Nest: each
   *  ram bursts `burst` px. Measured at a drone every 0.7 s it was too
   *  strong; every 1.2 s it sat with the other strong weapons. */
  // Build 2 sweep: at MAX 0.9 s it trailed today's passives (35% of runs
  // won against Frigates' 55%): Hornet Nest launches every 0.7 s.
  // Test Lab round 8 (the player: "the drone kind of drives away awkwardly
  // once all the targets have been destroyed"): a drone with nothing to ram
  // (or out of `life`) flies home at `home` of its speed, its nose turning
  // at most `turn` rad/s, and lands on the deck; while every threat up has
  // a drone on it, a spare one waits `wait` px over the deck.
  droneScreen: { gap: [1.2, 0.9, 0.7], speed: 420, life: 4, damage: 1, burst: [0, 0, 50], contact: 18, home: 0.75, turn: 5, wait: 70 },
  /** Gunship Pair (the player's idea): `count` helicopters hover `ahead` px
   *  either side of the convoy's middle; each fires a Hellfire every `gap`
   *  s at the thickest cluster within `reach` (a `blast` px burst, `damage`
   *  a hit). They fly like helicopters: top `speed`, `accel` px/s², the nose
   *  turning `turn` rad/s, slowing over the last 1/`arrive` s; a missile
   *  flies at `missileSpeed`, curving at `missileTurn` rad/s and harder. */
  // Test Lab round 5 (the player: "it should face the target when firing"):
  // a gunship fires only once its nose is within `aim` rad of its target,
  // turning to it first, at `aimTurn` rad/s (a slow turn holds the shot at
  // most `wait` s). The turning cost them shots (the sweep at MAX, 12 seeds
  // a map: 47% → 40%), so they fire a little more often: every 1.25 / 0.9 /
  // 0.85 s (was 1.4 / 1.0 / 1.0): 47% again.
  gunships: { count: [2, 2, 3], gap: [1.25, 0.9, 0.85], reach: 380, blast: 65, damage: [1, 1, 2], spread: 150, above: 70, speed: 320, accel: 420, turn: 3.2, arrive: 2.2, missileSpeed: 1150, missileTurn: 2.5, aim: 0.35, wait: 0.6, aimTurn: 6 },
  /** Bomber Wing (the player's idea): a pass every `gap` s. It destroys a
   *  truck on screen; with none, it bombs the silo (or the tunnel a truck is
   *  due out of) with the most launches in the next `quiet` s, and those
   *  launches are cancelled (measured: delaying them instead did nothing).
   *  Carpet Raid: `targets` a pass. The bomber flies at `speed`. */
  // Build 2 sweep: Carpet Raid passes every 3.5 s (at 4.5 s it won 32%).
  // Test Lab round 5 (the player: "it doesn't attack submarines and aircraft
  // ... silence before the bomber even passes over ... it should at least be
  // on the screen before the bomber hits them"): aircraft (`air`) and subs
  // are targets at every level; a bomber flies on screen at least `seen` s
  // before its bomb lands, tracks a moving target, and everything (the hit,
  // the silence, a cancelled tunnel) happens as it passes over. Its run
  // sound is cued so its roar (`roar` s into the sound) is the drop.
  bomberWing: {
    gap: [6, 4.5, 3.5], quiet: [6, 6, 8], targets: [1, 1, 2], speed: 800, first: 1.5, seen: 0.8, roar: 0.95, track: 900,
    air: ['strafer', 'bomber', 'attackHeli', 'stealthJet', 'stealthBomber', 'diveBomber', 'spotter'] as ThreatKind[],
  },
  /** Orbital Strike: every `gap` s, laser dots close on the toughest threat
   *  for `lock` s (the player: "laser dots triangulating on my spot, then the
   *  big beam hits"), then the beam hits it for `damage`. Sky Spear: the
   *  beam lingers and strikes the next toughest `linger` s later. */
  // Build 2 sweep: one target every 1.5–2.5 s trailed today's passives (33%
  // at MAX): the beam's edge (`splash` px) hits what is around the target for
  // 1, and Sky Spear strikes every 1.2 s.
  orbital: { gap: [2.5, 1.8, 1.2], lock: 0.8, damage: 3, splash: 60, linger: 0.5, first: 1 },
  // ---- Phase 3: boosts. Each lasts the weapon time (15 s) at every level
  // (round 3: "each level should change something").
  /** Supply Run: drop chances × `mult`. A cargo plane (the player: "a big
   *  cargo plane to come in and drop it in a row") crosses at `planeSpeed`,
   *  dropping `crates` in a row (`load`: ammo, repair, gear = one of your
   *  weapons or boosts), each under a parachute for `chute` s. Airdrop:
   *  another plane every `crate` s with a gear crate, a Nuke `nuke` of the
   *  time. Nothing flies to the carrier (round 5): you tap what you want. */
  supplyRun: { mult: [2, 3, 3], crate: 6, crates: [3, 5, 5], planeSpeed: 460, chute: 0.9, nuke: 0.15, load: ['ammo', 'gear', 'repair', 'gear', 'ammo'] as ('ammo' | 'repair' | 'gear')[] },
  /** Dual Wield: it lasts `time`× the weapon time, and both hands last as
   *  long as it does, then both end (the player: "the weapons last as long
   *  as the boost"); Arsenal Drop: weapons drop `drops`× as often. */
  dualWield: { time: [1, 4 / 3, 4 / 3], drops: [1, 1, 2] },
  /** Wild Card: from level 2 its pickup brings one random passive (Test Lab
   *  round 8), working beside the gun for `time`× the weapon time (8 s) at
   *  `passive`'s level. The sweep: at level 2 and 15 s it won 45% at level 2
   *  (was 22%) and 56% at MAX (was 40%), two weapons at once nearly all the
   *  time; at 8 s and level 1 (level 2 at MAX), about 39% and 46%. */
  wildCard: { passive: [0, 1, 2], time: 8 / 15 },
  /** Focus: `bank` s of slow motion at `scale` speed; Deadeye `damage`×. */
  // Lock-in round, buffed toward the middle of the table (6% of runs won at
  // MAX): the rack reloads on the real clock (game.ts), a bigger bank,
  // slower time and Deadeye ×3: 30%. The bot can't hold one finger and tap
  // with the other the way a person does, so it undersells Focus.
  // Test Lab round 5 (the player: "When tapping just to shoot a missile it
  // should not do the slow down; you need to long hold to activate"): time
  // slows only once the holding finger has been down `hold` s (real time);
  // a quicker touch is an ordinary shot, fired as it lifts.
  // Test Lab round 8 (the player: "the slow motion should just be a button
  // you hold on the left side of the screen with your left thumb"): time
  // slows while the Focus button is held; no long-press any more.
  focus: { bank: [10, 15, 15], scale: [0.35, 0.25, 0.25], damage: 3 },
  /** Shield: it lasts `time`× the weapon time; from level 2 every hit it
   *  blocks puts `refund` rounds back in the rack; Reflect bounces a blocked
   *  missile `bounce` px back to burst (`burst` px). */
  // Test Lab round 5 (the player: "drop the whole strafe thing and come up
  // with new ideas for the leveling up"): strafing runs are never blocked
  // now; level 2 refills a round a block, MAX lasts 18 s and reflects (the
  // sweep: 20 s and a refill from level 2 won 52% at MAX, top of the table;
  // this, 41%).
  shield: { time: [1, 1, 1.2], refund: [0, 1, 1], bounce: 110, burst: 70 },
  /** Hyper Overdrive (Overdrive MAX): every shot fires twice, the second
   *  `twin` px to the side of the first (from its own muzzle) so both show
   *  (Test Lab round 5: "it should clearly show two projectiles"). */
  // Test Lab round 8 (the player: level 2 "doesn't make sense if it fills
  // the rack but it is already full at the end"): level 2 lasts `time`× the
  // weapon time (18 s) instead, and so does MAX. (At 20 s, MAX won 54% of
  // the sweep's runs, the top of the table, up from 41%; at 18 s, 49%.)
  overdrive: { twin: 34, time: [1, 1.2, 1.2] },
  /** Full Steam: the convoy's speed ×; Ramming Speed rams within `ram` px. */
  fullSteam: { mult: [1.6, 2, 2], ram: 38 },
} as const;

export type Levels = Partial<Record<AbilityId, number>>;

export const RESUPPLY_TEXT = 'Every ship and the carrier fully repaired; rack full';

/** The weapon's name at a level (evolved at level 3). */
export function abilityName(id: AbilityId, level: number): string {
  return level >= ABILITY_MAX ? ABILITIES[id].evolved : ABILITIES[id].name;
}

/** The weapons currently held (level ≥ 1), in roster order. */
export function loadout(levels: Levels): AbilityId[] {
  return ABILITY_ORDER.filter((id) => (levels[id] ?? 0) > 0);
}

/** Can this card be taken now? A held weapon can level up until it has
 *  evolved; a new one needs a free slot. */
export function canTake(levels: Levels, id: CardId): boolean {
  if (id === 'resupply') return true;
  const lv = levels[id] ?? 0;
  if (lv >= ABILITY_MAX) return false;
  return lv > 0 || loadout(levels).length < MAX_SLOTS;
}

/** Can this new weapon come in by replacing one you hold? Only when every
 *  slot is full — the replaced weapon and its levels are given up. */
export function canSwapIn(levels: Levels, id: CardId): boolean {
  if (id === 'resupply' || (levels[id] ?? 0) > 0) return false;
  return loadout(levels).length >= MAX_SLOTS;
}
