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
  | 'boomerang';
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
      'Each tap launches 3 seekers at the threats nearest your finger',
      '4 seekers a tap',
      '5 seekers, and one whose target is gone finds another',
    ],
    how: 'Tap in the middle of a raid',
  },
  aegis: {
    id: 'aegis',
    name: 'Aegis Dome',
    evolved: 'Bastion',
    answers: 'Ballistics',
    levels: [
      'Each shot also domes the ship its target is after: 5 s, 3 hits',
      'Domes hold 6 s, 4 hits',
      '8 s, 6 hits, and each hit bursts back out for 2',
    ],
    how: 'Tap threats as usual, or the water by a ship',
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
};

export const ABILITY_ORDER: AbilityId[] = ['airstrike', 'shrapnel', 'frigate', 'thermo', 'scatter', 'boomerang', 'flak', 'seeker', 'aegis', 'well', 'railgun', 'tesla'];

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
  seeker: { missiles: [3, 4, 5], reach: 360, speed: 900, blast: 14 },
  /** Aegis: a dome on one ship (or the carrier) for `time` s that takes
   *  `hits` hits; Bastion bursts for `burstDmg` within `burst` per hit. A tap
   *  with no threat covers the hull nearest it within `reach`. */
  aegis: { time: [5, 6, 8], hits: [3, 4, 6], reach: 220, burst: 120, burstDmg: 2 },
  /** Gravity Well: pulls threats within `radius` toward it at `pull` px/s
   *  for `time` s, then hits those within `core` for `damage`. */
  well: { radius: [200, 240, 260], time: [1.5, 1.5, 2], pull: 320, core: [100, 110, 120], damage: [2, 3, 4] },
  /** A jet costs `cost` rounds (playtest: one round a jet was too strong). */
  airstrike: { speed: 1800, band: [80, 95, 110], damage: [2, 3, 4], burnTime: 2, burnTick: 0.5, cost: 2 },
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
