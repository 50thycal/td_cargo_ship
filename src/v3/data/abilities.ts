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
      'Each shell leaves a flak cloud for 1.5 s that hits whatever flies through',
      'A bigger cloud that hangs for 2 s',
      'Clouds hang for 4 s, a wall the swarm has to fly through',
    ],
    how: 'Tap a swarm, or the water in its path',
  },
  seeker: {
    id: 'seeker',
    name: 'Seeker Pod',
    evolved: 'Swarm Pod',
    answers: 'Raids',
    levels: [
      'Each tap launches 3 seekers at the threats nearest your finger, each a third of a shot',
      '4 seekers a tap',
      '5 seekers, and one whose target is gone finds another',
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
      'Every ship carries an interceptor that fires on its own at a threat about to hit it',
      'Two a ship, fired from further out',
      'Spent ones reload every 3 s, and the carrier fires its own',
    ],
    how: 'Keep shooting: every ship fires its own',
  },
  well: {
    id: 'well',
    name: 'Gravity Well',
    evolved: 'Singularity',
    answers: 'Wide raids',
    levels: [
      'Each shell opens a vortex for 1.5 s, then implodes: missiles, drones and small boats are dragged in; aircraft, helicopters and other big ones are only slowed',
      'A wider pull and a harder implosion (big ones still only slowed)',
      'It holds for 2 s, drags in everything, big ones too, and the implosion hits for 4',
    ],
    how: 'Tap between the threats you want pulled together',
  },
  airstrike: {
    id: 'airstrike',
    name: 'Air Strike',
    evolved: 'Carpet Strike',
    answers: 'Aircraft',
    levels: [
      'Each tap sends a jet down that row, hitting everything under it (2 rounds a jet)',
      'A wider run, harder hits',
      'The row burns for 2 s and subs and trucks under it are destroyed',
    ],
    how: 'Tap a row: a jet flies across it, for 2 rounds',
  },
  railgun: {
    id: 'railgun',
    name: 'Railgun',
    evolved: 'Mass Driver',
    answers: 'Heavies',
    levels: [
      'Each shot is a beam that pierces everything in line',
      'Twice the damage, a wider beam',
      'Wide slugs, four times as hard: two bring down a heavy missile',
    ],
    how: 'Tap anywhere: the beam fires through it',
  },
  tesla: {
    id: 'tesla',
    name: 'Tesla Arc',
    evolved: 'Storm Coil',
    answers: 'Crowds',
    levels: [
      'Every hit arcs to 3 threats nearby',
      '4 arcs per hit, and every arc arcs again',
      'Each tap fires a second, free shot at a threat nearby',
    ],
    how: 'Tap threats as usual',
  },
  shrapnel: {
    id: 'shrapnel',
    name: 'Shrapnel Shell',
    evolved: 'Fragstorm',
    answers: 'Swarms',
    levels: [
      'Each shell bursts into 10 fragments that fly out in every direction',
      '14 fragments that fly further',
      '18 fragments that tear through everything in their path',
    ],
    how: 'Tap into a swarm',
  },
  frigate: {
    id: 'frigate',
    name: 'Frigate Escort',
    evolved: 'Battle Group',
    answers: 'Everything',
    levels: [
      'Two frigates sail in and fire on their own while it lasts',
      'They fire half again as fast',
      'A third frigate joins, and they fire faster still',
    ],
    how: 'Keep shooting: the frigates fire on their own',
  },
  thermo: {
    id: 'thermo',
    name: 'Thermobaric Shell',
    evolved: 'Daisy Cutter',
    answers: 'Packs',
    levels: [
      'Each shell bursts in a huge blast that hits everything in it',
      'A bigger blast that hits for 2',
      'The biggest blast, hitting for 3',
    ],
    how: 'Tap the middle of a pack',
  },
  scatter: {
    id: 'scatter',
    name: 'Scattergun',
    evolved: "Dragon's Breath",
    answers: 'Rushers',
    levels: [
      'Each tap fires a short blast of 8 pellets from the gun toward your finger',
      '11 pellets, reaching further',
      '15 pellets that tear through everything in their path',
    ],
    how: 'Tap threats closing on the gun',
  },
  boomerang: {
    id: 'boomerang',
    name: 'Boomerang',
    evolved: 'Twin Blades',
    answers: 'Lines',
    levels: [
      'Each tap throws a blade out to the threat and back, cutting everything on both passes',
      'A wider blade that cuts for 2',
      'Two blades at once',
    ],
    how: 'Tap past a line of threats',
  },
  lance: {
    id: 'lance',
    name: 'Charge Lance',
    evolved: 'Sunspear',
    answers: 'Heavies',
    levels: [
      'Tap for a quick shot; hold to charge: half for a 3-hit bolt, full for a 6-hit lance through everything in line',
      'Charges a third faster, and the half bolt pierces',
      'A full lance leaves a burning line for 2 s',
    ],
    how: 'Hold to charge, let go to fire',
  },
  cutter: {
    id: 'cutter',
    name: 'Laser Cutter',
    evolved: 'Searing Edge',
    answers: 'Swarms',
    levels: [
      'Swipe across threats: everything under your finger is cut. Keep the finger down and it keeps cutting, a round for every 320 px of cut',
      'A round cuts 420 px',
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
      'Hold on any threat on screen to hook it, drag to swing it into others (2 hits each), let go to fling it',
      'It swings faster and every smack hits for 3',
      'The flung threat explodes for 3 in a wide blast',
    ],
    how: 'Hold a threat and drag it',
  },
  cadence: {
    id: 'cadence',
    name: 'Cadence Gun',
    evolved: 'War Drum',
    answers: 'Heavies',
    levels: [
      'A beat every 0.9 s: fire on it for a free 4-hit shot that pierces; off the beat, a normal shot',
      'A wider beat window',
      'On the beat it blows up any truck, siege gun, helicopter, sub or repair ship on its line; three beats in a row, and the fourth fires a free broadside at 8 threats',
    ],
    how: 'Tap on the beat',
  },
  droneScreen: {
    id: 'droneScreen',
    name: 'Drone Screen',
    evolved: 'Hornet Nest',
    answers: 'Drones',
    levels: [
      'Your own drones lift off the carrier one after another and ram the threats closest to your ships (none while nothing is on screen)',
      'A drone every 0.9 s',
      'A drone every 0.7 s, and each ram bursts, hitting everything around it',
    ],
    how: 'Keep shooting: the drones ram on their own',
  },
  gunships: {
    id: 'gunships',
    name: 'Gunship Pair',
    evolved: 'Hellfire Wing',
    answers: 'Packs',
    levels: [
      'Two helicopters hover over the convoy and rocket the thickest cluster near it',
      'They fire half again as often',
      'A third helicopter joins, and each pod hits for 2',
    ],
    how: 'Keep shooting: the helicopters fire on their own',
  },
  bomberWing: {
    id: 'bomberWing',
    name: 'Bomber Wing',
    evolved: 'Carpet Raid',
    answers: 'Launchers',
    levels: [
      'A bomber crosses the screen and bombs what it flies over: aircraft, subs and trucks are destroyed; with none up, the busiest silo or tunnel goes quiet for 6 s, its launches cancelled',
      'A pass every 4.5 s',
      'A pass every 3.5 s, two bombers each hitting a target; silos stay silent for 8 s',
    ],
    how: 'Keep shooting: the bombers hit what they fly over',
  },
  orbital: {
    id: 'orbital',
    name: 'Orbital Strike',
    evolved: 'Sky Spear',
    answers: 'Heavies',
    levels: [
      'Laser dots close in on the toughest thing on screen, then a beam from orbit hits it for 3 (and what is around it for 1)',
      'A strike every 1.8 s',
      'A strike every 1.2 s, and the beam lingers onto the next toughest',
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
      'A cargo plane drops 3 crates in a row: ammo, a repair and one of your weapons or boosts; kills drop twice as much. Tap the crates you want',
      '5 crates (two of them weapons or boosts), and kills drop three times as much',
      'And every 6 s another plane drops a crate: one of your weapons or boosts, or now and then a Nuke',
    ],
    how: 'Tap the crates you want',
  },
  dualWield: {
    id: 'dualWield',
    name: 'Dual Wield',
    evolved: 'Arsenal Drop',
    answers: 'Combos',
    levels: [
      'The next weapon picked up joins the loaded one: every tap fires both, for one round. Both last as long as the boost, then both end; another Dual Wield restarts both',
      'It lasts 20 s',
      'And weapons drop twice as often while it lasts',
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
      'It takes over the gun: each tap fires a random weapon\'s level 1 shot',
      'A random active or passive, at level 2',
      'A random active weapon\'s MAX shot',
    ],
    how: 'Each tap is a random weapon',
  },
  focus: {
    id: 'focus',
    name: 'Focus',
    evolved: 'Deadeye',
    answers: 'Everything at once',
    levels: [
      'Press and hold one finger (a quick tap is just a shot) for up to 10 s of slow motion, and tap with the other; the rack reloads at full speed',
      '15 s, at a quarter of the speed',
      'Shots fired in slow motion hit for triple',
    ],
    how: 'Press and hold one finger, tap with the other',
  },
  overdrive: {
    id: 'overdrive',
    name: 'Overdrive',
    evolved: 'Hyper Overdrive',
    answers: 'Running dry',
    levels: [
      'Rounds cost nothing',
      'And the rack keeps refilling, so it is full when the boost ends',
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
      'Ships and the carrier take no damage from missiles, drones and boats',
      'Every hit it blocks puts a round back in the rack',
      'It lasts 18 s, and a blocked missile bounces back and bursts on what is behind it',
    ],
    how: 'Your hulls are shielded',
  },
  fullSteam: {
    id: 'fullSteam',
    name: 'Full Steam',
    evolved: 'Ramming Speed',
    answers: 'Getting ships home',
    levels: [
      'The convoy steams at 1.6× speed',
      '2× speed',
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
  grapnel: { speed: [1100, 1500, 1500], smack: [2, 3, 3], smackR: 34, again: 0.5, hold: 2.5, fly: 0.35, burst: [2, 2, 3], burstR: [70, 70, 130] },
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
  droneScreen: { gap: [1.2, 0.9, 0.7], speed: 420, life: 4, damage: 1, burst: [0, 0, 50], contact: 18 },
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
  /** Wild Card: the passives' one-shot versions at a tap. */
  wildCard: { drones: 3 },
  /** Focus: `bank` s of slow motion at `scale` speed; Deadeye `damage`×. */
  // Lock-in round, buffed toward the middle of the table (6% of runs won at
  // MAX): the rack reloads on the real clock (game.ts), a bigger bank,
  // slower time and Deadeye ×3: 30%. The bot can't hold one finger and tap
  // with the other the way a person does, so it undersells Focus.
  // Test Lab round 5 (the player: "When tapping just to shoot a missile it
  // should not do the slow down; you need to long hold to activate"): time
  // slows only once the holding finger has been down `hold` s (real time);
  // a quicker touch is an ordinary shot, fired as it lifts.
  focus: { bank: [10, 15, 15], scale: [0.35, 0.25, 0.25], damage: 3, hold: 0.3 },
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
  overdrive: { twin: 34 },
  /** Full Steam: the convoy's speed ×; Ramming Speed rams within `ram` px. */
  fullSteam: { mult: [1.6, 2, 2], ram: 38 },
} as const;

export type Levels = Partial<Record<AbilityId, number>>;

export const RESUPPLY_TEXT = 'Repair every ship and the carrier, refill the rack';

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
