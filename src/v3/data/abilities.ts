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
  | 'supplyRun'
  | 'overclock'
  | 'dualWield'
  | 'wildCard'
  | 'focus'
  | 'overdrive'
  | 'timeWarp'
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
  aegis: {
    id: 'aegis',
    name: 'Aegis Launchers',
    evolved: 'Bastion',
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
      'Each shell opens a vortex that drags threats in for 1.5 s, then implodes on them',
      'A wider pull and a harder implosion',
      'It holds for 2 s and the implosion hits for 4',
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
      'Swipe across threats: everything under your finger is cut (one round a swipe)',
      'A longer cut',
      'The cut stays lit for 1 s and burns what flies into it',
    ],
    how: 'Swipe across threats',
  },
  grapnel: {
    id: 'grapnel',
    name: 'Grapnel',
    evolved: 'Wrecking Ball',
    answers: 'Packs',
    levels: [
      'Hold on a threat to hook it, drag to swing it into others (2 hits each), let go to fling it',
      'The cable reaches across the whole sea',
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
      'Fire on the beat for a 3-hit shot that pierces; off the beat, a normal shot',
      'A wider beat window',
      'Four beats in a row, and the fifth fires a free broadside',
    ],
    how: 'Tap on the beat',
  },
  droneScreen: {
    id: 'droneScreen',
    name: 'Drone Screen',
    evolved: 'Hornet Nest',
    answers: 'Drones',
    levels: [
      'Your own drones lift off the carrier one after another and ram the threats closest to your ships',
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
      'Bombers hit the shore: trucks are destroyed; the busiest silo or tunnel goes quiet for 6 s, its launches cancelled',
      'A pass every 4.5 s',
      'A pass every 3.5 s, each hitting two targets, a surfaced sub too; silos stay silent for 8 s',
    ],
    how: 'Keep shooting: the bombers hit the shore',
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
  supplyRun: {
    id: 'supplyRun',
    name: 'Supply Run',
    evolved: 'Airdrop',
    answers: 'Running dry',
    levels: [
      'Kills drop twice as much, and drops fly straight to the carrier',
      'Three times as much',
      'And every 6 s a crate lands holding one of your weapons',
    ],
    how: 'Keep killing: drops fly to you',
  },
  overclock: {
    id: 'overclock',
    name: 'Overclock',
    evolved: 'Overload',
    answers: 'Your best weapon',
    levels: [
      'The loaded weapon plays a level higher and its clock stops (nothing loaded: the next one). Already at MAX: it drops more often too',
      'Every weapon picked up while it lasts is overclocked too',
      'The loaded weapon jumps straight to MAX',
    ],
    how: 'Your weapon plays a level up',
  },
  dualWield: {
    id: 'dualWield',
    name: 'Dual Wield',
    evolved: 'Arsenal Drop',
    answers: 'Combos',
    levels: [
      'The next weapon picked up joins the loaded one: every tap fires both, for one round',
      'Both clocks run at half speed',
      'And weapons drop twice as often while it lasts',
    ],
    how: 'Pick up a second weapon: both fire',
  },
  wildCard: {
    id: 'wildCard',
    name: 'Wild Card',
    evolved: 'Jackpot',
    answers: 'Anything, by luck',
    levels: [
      'With nothing loaded, each tap fires a random active weapon\'s level 1 shot',
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
      'Up to 6 s of half-speed time, spent only while a finger is down',
      '9 s, at a third of the speed',
      'Shots fired in slow motion hit for double',
    ],
    how: 'Hold a finger down: time slows',
  },
  overdrive: {
    id: 'overdrive',
    name: 'Overdrive',
    evolved: 'Hyper Overdrive',
    answers: 'Running dry',
    levels: [
      'Rounds cost nothing',
      'And the rack keeps refilling, so it is full when the boost ends',
      'Every shot fires twice',
    ],
    how: 'Free rounds: keep firing',
  },
  timeWarp: {
    id: 'timeWarp',
    name: 'Time Warp',
    evolved: 'Freeze Frame',
    answers: 'Fast threats',
    levels: [
      'Every threat moves at 40% speed; the world drains of colour and sound drops',
      '25% speed',
      'The first 2 s near-stopped (10%), then 25%',
    ],
    how: 'Threats crawl: pick them off',
  },
  shield: {
    id: 'shield',
    name: 'Shield',
    evolved: 'Reflect',
    answers: 'Missiles',
    levels: [
      'Ships and the carrier take no damage from missiles, drones and boats',
      'It blocks a strafing run too, and shatters doing it',
      'A blocked missile bounces back and bursts',
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
  'supplyRun', 'overclock', 'dualWield', 'wildCard', 'focus', 'overdrive', 'timeWarp', 'shield', 'fullSteam',
];

/** Levels per weapon; the last is the evolution. */
export const ABILITY_MAX = 3;
/** Different weapons a loadout can hold at once. */
export const MAX_SLOTS = 3;

/** Names short enough for the rail's timer chip (the card shows the full name). */
export const SHORT_NAME: Record<AbilityId, [string, string]> = {
  flak: ['FLAK', 'CURTAIN'],
  seeker: ['SEEKERS', 'SWARM POD'],
  aegis: ['AEGIS', 'BASTION'],
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
  overclock: ['OVERCLOCK', 'OVERLOAD'],
  dualWield: ['DUAL WIELD', 'ARSENAL'],
  wildCard: ['WILD CARD', 'JACKPOT'],
  focus: ['FOCUS', 'DEADEYE'],
  overdrive: ['OVERDRIVE', 'HYPER'],
  timeWarp: ['TIME WARP', 'FREEZE'],
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
  well: { radius: [200, 240, 260], time: [1.5, 1.5, 2], pull: 320, core: [100, 110, 120], damage: [2, 3, 4] },
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
   *  everything within `width` of it, up to `length` px a swipe, one round a
   *  swipe. Searing Edge leaves the cut lit `lit` s. */
  cutter: { start: 14, length: [320, 420, 420], width: 30, damage: 1, lit: 1 },
  /** Grapnel: hold on a threat within `reach` of the carrier to hook it (one
   *  round); it follows the finger at up to `speed` px/s and smacks what it
   *  touches (`smackR`) for `smack`, a threat once every `again` s. Let go (or
   *  after `hold` s) and it flies `fly` s and bursts: `burst` hits in `burstR`
   *  (the ball included). Structures can't be hooked. */
  grapnel: { reach: [620, 1800, 1800], speed: 1100, smack: 2, smackR: 34, again: 0.5, hold: 2.5, fly: 0.35, burst: [2, 2, 3], burstR: [70, 70, 130] },
  /** Cadence Gun: a beat every `period` s; a tap within `window` s of one
   *  fires a `damage` shot that pierces (`width`); off the beat, a plain
   *  shot. War Drum: `run` beats hit in a row, and the next beat fires a
   *  free broadside at the `broadside` most urgent threats. */
  cadence: { period: 0.6, window: [0.12, 0.18, 0.18], damage: 3, width: 18, run: 4, broadside: 5 },
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
   *  either side of the convoy's middle; each fires a rocket pod every `gap`
   *  s at the thickest cluster within `reach` (a `blast` px burst, `damage`
   *  a hit). */
  gunships: { count: [2, 2, 3], gap: [1.4, 1.0, 1.0], reach: 380, blast: 65, damage: [1, 1, 2], spread: 150, above: 70, speed: 320 },
  /** Bomber Wing (the player's idea): a pass every `gap` s. It destroys a
   *  truck on screen; with none, it bombs the silo (or the tunnel a truck is
   *  due out of) with the most launches in the next `quiet` s, and those
   *  launches are cancelled (measured: delaying them instead did nothing).
   *  Carpet Raid: `targets` a pass. The bomber flies at `speed`. */
  // Build 2 sweep: Carpet Raid passes every 3.5 s (at 4.5 s it won 32%).
  bomberWing: { gap: [6, 4.5, 3.5], quiet: [6, 6, 8], targets: [1, 1, 2], speed: 950, first: 1.5 },
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
  /** Supply Run: drop chances × `mult`; drops fly to the carrier at `speed`.
   *  Airdrop: a weapon crate every `crate` s. */
  supplyRun: { mult: [2, 3, 3], speed: 520, crate: 6 },
  /** Overclock on a weapon already at MAX: it drops `drops`× as often. */
  overclock: { drops: 2 },
  /** Dual Wield: the clocks run at `clock` speed; Arsenal Drop: weapons drop
   *  `drops`× as often. */
  dualWield: { clock: [1, 0.5, 0.5], drops: [1, 1, 2] },
  /** Wild Card: the passives' one-shot versions at a tap. */
  wildCard: { drones: 3 },
  /** Focus: `bank` s of slow motion at `scale` speed; Deadeye `damage`×. */
  focus: { bank: [6, 9, 9], scale: [0.5, 1 / 3, 1 / 3], damage: 2 },
  /** Time Warp: threats at `scale` speed; Freeze Frame: `freeze` for the
   *  first `freezeTime` s. */
  timeWarp: { scale: [0.4, 0.25, 0.25], freeze: 0.1, freezeTime: 2 },
  /** Shield: it shatters `shatter` s after it blocks a strafing run; Reflect
   *  bounces a blocked missile `bounce` px back to burst (`burst` px). */
  shield: { shatter: 0.8, bounce: 110, burst: 70 },
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
