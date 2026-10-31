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
// Three held at once, three levels each; level 3 is the EVOLUTION, which
// changes what the weapon does, not just its numbers. (Internally they are
// still `AbilityId`s: the draft, the slots and the save were built for them.)

export type AbilityId = 'airstrike' | 'railgun' | 'tesla' | 'flak' | 'seeker' | 'aegis' | 'cryo' | 'well';
/** A draft card: a weapon, or Resupply (keeps your build, takes no slot). */
export type CardId = AbilityId | 'resupply';

export interface AbilityDef {
  id: AbilityId;
  name: string;
  /** Its name once evolved (level 3). */
  evolved: string;
  /** Which threat it answers — shown on the card. */
  answers: string;
  /** What a shot does at levels 1, 2, 3 (index 0 = level 1). */
  levels: [string, string, string];
  /** How a tap fires it, shown on the card and when it is picked up. */
  how: string;
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  flak: {
    id: 'flak',
    name: 'Flak Cannon',
    evolved: 'Flak Curtain',
    answers: 'Swarms',
    levels: [
      'Each shell bursts into a flak cloud for 1.5 s: everything flying through it is hit',
      'A bigger cloud that hangs for 2 s',
      'EVOLVES: clouds hang for 4 s, a wall the swarm has to fly through',
    ],
    how: 'Tap a swarm, or the water in its path',
  },
  seeker: {
    id: 'seeker',
    name: 'Seeker Pod',
    evolved: 'Swarm Pod',
    answers: 'Raids',
    levels: [
      'Each tap launches 3 seekers at the 3 threats nearest your finger',
      '4 seekers a tap',
      'EVOLVES: 5 seekers, and one whose target is gone finds another',
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
      'EVOLVES: 8 s, 6 hits, and each hit bursts back out for 2',
    ],
    how: 'Tap threats as usual, or the water by a ship',
  },
  cryo: {
    id: 'cryo',
    name: 'Cryo Rounds',
    evolved: 'Absolute Zero',
    answers: 'Heavies',
    levels: [
      'Each burst freezes everything in it for 2.5 s and bites for 2; frozen threats take double damage',
      'A bigger burst that holds them 3 s',
      'EVOLVES: any hit shatters a frozen threat outright, the burst included',
    ],
    how: 'Tap a threat, or the water in front of a pack',
  },
  well: {
    id: 'well',
    name: 'Gravity Well',
    evolved: 'Singularity',
    answers: 'Spread raids',
    levels: [
      'Each shell opens a vortex: drones, missiles and jets near it are dragged in for 1.5 s, then it implodes',
      'A wider pull and a harder implosion',
      'EVOLVES: it holds for 2 s and the implosion hits for 4',
    ],
    how: 'Tap between the threats you want pulled together',
  },
  airstrike: {
    id: 'airstrike',
    name: 'Air Strike',
    evolved: 'Carpet Strike',
    answers: 'Aircraft',
    levels: [
      'Each shot calls a jet down the row you tapped, hitting everything under it',
      'A wider run, harder hits',
      'EVOLVES: the row burns for 2 s and subs and trucks under it are destroyed',
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
      'EVOLVES: wide slugs, four times as hard: two bring down a heavy missile',
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
      'EVOLVES: each tap fires a second, free shot at a threat nearby',
    ],
    how: 'Tap threats as usual',
  },
};

export const ABILITY_ORDER: AbilityId[] = ['flak', 'seeker', 'aegis', 'cryo', 'well', 'airstrike', 'railgun', 'tesla'];

/** Levels per weapon; the last is the evolution. */
export const ABILITY_MAX = 3;
/** Different weapons a loadout can hold at once. */
export const MAX_SLOTS = 3;

/** Names short enough for the rail's timer chip (the card shows the full name). */
export const SHORT_NAME: Record<AbilityId, [string, string]> = {
  flak: ['FLAK', 'CURTAIN'],
  seeker: ['SEEKERS', 'SWARM POD'],
  aegis: ['AEGIS', 'BASTION'],
  cryo: ['CRYO', 'ABS. ZERO'],
  well: ['GRAVITY', 'SINGULARITY'],
  airstrike: ['AIR STRIKE', 'CARPET'],
  railgun: ['RAILGUN', 'MASS DRIVER'],
  tesla: ['TESLA', 'STORM COIL'],
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
  /** Cryo: threats within `radius` of the burst freeze for `time` s. */
  cryo: { radius: [100, 120, 140], time: [2.5, 3, 3] },
  /** Gravity Well: pulls threats within `radius` toward it at `pull` px/s
   *  for `time` s, then hits those within `core` for `damage`. */
  well: { radius: [200, 240, 260], time: [1.5, 1.5, 2], pull: 320, core: [100, 110, 120], damage: [2, 3, 4] },
  /** A jet costs `cost` rounds (playtest: one round a jet was too strong). */
  airstrike: { speed: 1800, band: [80, 95, 110], damage: [2, 3, 4], burnTime: 2, burnTick: 0.5, cost: 2 },
  railgun: { damage: [1, 2, 4], width: [14, 18, 26] },
  tesla: { arcs: [3, 4, 4], range: 200, depth: [1, 2, 2], twin: 260 },
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
