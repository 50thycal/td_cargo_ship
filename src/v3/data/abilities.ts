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
// Three held at once, three levels each; level 3 is the EVOLUTION, which
// changes what the weapon does, not just its numbers. (Internally they are
// still `AbilityId`s: the draft, the slots and the save were built for them.)

export type AbilityId = 'emp' | 'airstrike' | 'railgun' | 'tesla' | 'decoy' | 'smoke' | 'salvo' | 'hunter';
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
  emp: {
    id: 'emp',
    name: 'EMP Rounds',
    evolved: 'Ion Storm',
    answers: 'Swarms',
    levels: [
      'Each shot bursts as an EMP: every drone in the burst is fried',
      'A wider burst, and missiles in it lose lock for a moment',
      'EVOLVES: each burst leaves an ion cloud for 3 s: drones die in it, missiles crawl',
    ],
    how: 'Tap a swarm, or the water in front of it',
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
    how: 'Tap a row: the jet flies across it',
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
  decoy: {
    id: 'decoy',
    name: 'Decoy Flares',
    evolved: 'Ghost Fleet',
    answers: 'Guided',
    levels: [
      'Each burst throws a flare: every homing missile near it chases it and bursts harmlessly',
      'A much wider pull',
      'EVOLVES: the flare hangs 4 s, pulling in every missile that comes near',
    ],
    how: 'Tap a missile, or the water near a few',
  },
  smoke: {
    id: 'smoke',
    name: 'Smoke Shells',
    evolved: 'Fog Bank',
    answers: 'Strafing',
    levels: [
      'Each burst leaves a smoke cloud: missiles lose ships inside it and lose lock flying through',
      'Longer smoke, and strafing guns can\'t see through it',
      'EVOLVES: bigger clouds; ballistics landing in them miss and drones go blind',
    ],
    how: 'Tap a missile, or the water over your ships',
  },
  salvo: {
    id: 'salvo',
    name: 'Hellfire Salvo',
    evolved: 'Saturation',
    answers: 'Raids',
    levels: [
      'Each shot is 4 rockets saturating the spot',
      '6 rockets a shot, hitting twice as hard',
      'EVOLVES: 8 rockets that each hunt a threat near the spot',
    ],
    how: 'Tap a spot',
  },
  hunter: {
    id: 'hunter',
    name: 'Sub Hunter',
    evolved: 'Hunter-Killer',
    answers: 'Launchers',
    levels: [
      'Tap a sub or truck to destroy it before it fires',
      'Its missiles already in the air go down with it',
      'EVOLVES: every shot also sends a hunter at the nearest sub or truck',
    ],
    how: 'Tap a sub or a missile truck (threats as usual)',
  },
};

export const ABILITY_ORDER: AbilityId[] = ['emp', 'airstrike', 'railgun', 'tesla', 'decoy', 'smoke', 'salvo', 'hunter'];

/** Levels per weapon; the last is the evolution. */
export const ABILITY_MAX = 3;
/** Different weapons a loadout can hold at once. */
export const MAX_SLOTS = 3;

/** Names short enough for the rail's timer chip (the card shows the full name). */
export const SHORT_NAME: Record<AbilityId, [string, string]> = {
  emp: ['EMP', 'ION STORM'],
  airstrike: ['AIR STRIKE', 'CARPET'],
  railgun: ['RAILGUN', 'MASS DRIVER'],
  tesla: ['TESLA', 'STORM COIL'],
  decoy: ['FLARES', 'GHOSTS'],
  smoke: ['SMOKE', 'FOG BANK'],
  salvo: ['SALVO', 'SATURATION'],
  hunter: ['HUNTER', 'KILLER'],
};

/** How weapons come and go. */
export const WEAPON = {
  /** Seconds a weapon pickup keeps the gun loaded with it. */
  time: 15,
  /** A kill that drops no power-up drops a weapon you hold at this share of
   *  its power-up drop chance (only one weapon pickup on the water at once). */
  share: 1,
  /** Seconds without a weapon drop after which the next kill drops one. */
  pity: 15,
  /** Seconds a weapon pickup floats before it is gone (power-ups: 5). */
  life: 7,
} as const;

/** Every effect number, so tuning stays in data. Per-level arrays are
 *  indexed by level − 1. */
export const AB = {
  emp: { radius: [150, 190, 230], jam: 1.5, ionTime: 3, ionSlow: 0.5 },
  airstrike: { speed: 1800, band: [80, 95, 110], damage: [2, 3, 4], burnTime: 2, burnTick: 0.5 },
  railgun: { damage: [1, 2, 4], width: [14, 18, 26] },
  tesla: { arcs: [3, 4, 4], range: 200, depth: [1, 2, 2], twin: 260 },
  decoy: { radius: [300, 420, 420], ghostTime: 4, offset: 120 },
  smoke: { radius: [110, 130, 160], time: [8, 10, 12], jam: 2.5 },
  salvo: { rockets: [4, 6, 8], spread: 70, blast: 50, damage: [1, 2, 2], speed: 640, hunt: 220 },
  hunter: { reach: 140 },
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
