// ABILITIES (V3). The in-run draft deals these instead of V2's upgrade cards.
// None of them fires on its own: each one charges from something you do (or
// something done to you), and when it is ready you set it off from its button
// at the bottom right, the way the ability says.
//
// Two knobs per ability:
//   charge     — what fills it (time, drone kills, hits, an accuracy streak,
//                enemy missile launches, damage taken, pickups, launchers seen);
//   activation — how it goes off (a button; a line you swipe; the main gun
//                taken over for a few shots or seconds; a press you hold and
//                release on a spot; a launcher you tap).
// Nothing charges from shots fired or reloads: both reward mashing the
// screen, which V2's round 6 audit made sure never wins.
//
// Three held at once, three levels each; level 3 is the EVOLUTION, which
// changes what the ability does, not just its numbers.

export type AbilityId = 'emp' | 'airstrike' | 'railgun' | 'tesla' | 'decoy' | 'smoke' | 'salvo' | 'hunter';
/** A draft card: an ability, or Resupply (keeps your build, takes no slot). */
export type CardId = AbilityId | 'resupply';

export type ChargeSource = 'time' | 'droneKills' | 'hits' | 'streak' | 'launches' | 'damage' | 'pickups' | 'launchers';
export type Activation = 'button' | 'line' | 'takeover' | 'hold' | 'target';

export interface AbilityDef {
  id: AbilityId;
  name: string;
  /** Its name once evolved (level 3). */
  evolved: string;
  /** Which threat it answers — shown on the card. */
  answers: string;
  activation: Activation;
  charge: ChargeSource;
  /** Charge needed at levels 1, 2, 3 (seconds for 'time', else a count). */
  need: [number, number, number];
  /** One line per level (index 0 = level 1). */
  levels: [string, string, string];
  /** How to set it off, shown when it is armed. */
  how: string;
}

/** Shown on the card under the name: what fills it. */
export const CHARGE_LABEL: Record<ChargeSource, (n: number) => string> = {
  time: (n) => `Charges over ${n} s`,
  droneKills: (n) => `Charges from ${n} drone kills`,
  hits: (n) => `Charges from ${n} hits`,
  streak: (n) => `Charges from ${n} hits in a row (a missed tap resets it)`,
  launches: (n) => `Charges from ${n} enemy missile launches`,
  damage: (n) => `Charges from ${n} hits on your convoy`,
  pickups: (n) => `Charges from ${n} pickups`,
  launchers: (n) => `Charges from ${n} subs or trucks spotted`,
};

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  emp: {
    id: 'emp',
    name: 'EMP Pulse',
    evolved: 'Ion Storm',
    answers: 'Swarms',
    activation: 'button',
    charge: 'droneKills',
    need: [9, 8, 7],
    levels: [
      'Fries the 8 drones closest to a ship',
      'Every drone on screen, and missiles lose lock for a moment',
      'EVOLVES: a 4 s storm — new drones die, missiles crawl',
    ],
    how: 'Tap to fire',
  },
  airstrike: {
    id: 'airstrike',
    name: 'Air Strike',
    evolved: 'Carpet Strike',
    answers: 'Aircraft',
    activation: 'line',
    charge: 'time',
    need: [36, 32, 28],
    levels: [
      'A jet flies the line you swipe, hitting everything under it',
      'Two jets side by side, harder hits',
      'EVOLVES: three jets; the line burns and launchers under it are knocked out',
    ],
    how: 'Swipe the line for the jets',
  },
  railgun: {
    id: 'railgun',
    name: 'Railgun',
    evolved: 'Mass Driver',
    answers: 'Heavies',
    activation: 'takeover',
    charge: 'hits',
    need: [18, 16, 16],
    levels: [
      'Your next 2 taps fire a beam that pierces everything in line',
      '3 beams, twice the damage',
      'EVOLVES: 2 wide slugs that one-shot heavy missiles',
    ],
    how: 'Tap where to fire the beam',
  },
  tesla: {
    id: 'tesla',
    name: 'Tesla Arc',
    evolved: 'Storm Coil',
    answers: 'Crowds',
    activation: 'takeover',
    charge: 'streak',
    need: [8, 8, 7],
    levels: [
      'For 6 s every hit arcs to 2 threats nearby',
      '8 s, 3 arcs per hit',
      'EVOLVES: 9 s, and every arc arcs again',
    ],
    how: 'Your gun is charged: keep tapping',
  },
  decoy: {
    id: 'decoy',
    name: 'Decoy Barrage',
    evolved: 'Ghost Fleet',
    answers: 'Guided',
    activation: 'button',
    charge: 'launches',
    need: [6, 5, 4],
    levels: [
      'Every guided and cluster missile in flight chases a decoy',
      'Supersonics and bomblets fall for it too',
      'EVOLVES: decoys hang in the air 6 s, pulling in every new launch',
    ],
    how: 'Tap to fire',
  },
  smoke: {
    id: 'smoke',
    name: 'Smoke Wall',
    evolved: 'Fog Bank',
    answers: 'Strafing',
    activation: 'line',
    charge: 'damage',
    need: [3, 3, 2],
    levels: [
      'Lay smoke along a line: missiles lose ships inside it (10 s)',
      '13 s, and strafing guns can\'t see through it',
      'EVOLVES: ballistics landing in it miss; drones go blind',
    ],
    how: 'Drag along the lane to lay smoke',
  },
  salvo: {
    id: 'salvo',
    name: 'Hellfire Salvo',
    evolved: 'Saturation',
    answers: 'Raids',
    activation: 'hold',
    charge: 'pickups',
    need: [4, 3, 3],
    levels: [
      'Press a spot: 6 rockets saturate it',
      'Hold longer for up to 10 rockets',
      'EVOLVES: 14 rockets that each hunt a threat near the spot',
    ],
    how: 'Press and hold on a spot, then let go',
  },
  hunter: {
    id: 'hunter',
    name: 'Sub Hunter',
    evolved: 'Hunter-Killer',
    answers: 'Launchers',
    activation: 'target',
    charge: 'launchers',
    need: [5, 4, 3],
    levels: [
      'Tap a sub or truck to destroy it before it fires',
      'Its missiles already in the air go down with it',
      'EVOLVES: one tap sinks every sub and truck on screen',
    ],
    how: 'Tap a sub or a missile truck',
  },
};

export const ABILITY_ORDER: AbilityId[] = ['emp', 'airstrike', 'railgun', 'tesla', 'decoy', 'smoke', 'salvo', 'hunter'];

/** Levels per ability; the last is the evolution. */
export const ABILITY_MAX = 3;
/** Different abilities a loadout can hold at once. */
export const MAX_SLOTS = 3;
/** A newly drafted ability starts this full, so it is tried in its first wave. */
export const START_CHARGE = 0.5;

/** Every effect number, so tuning stays in data. */
export const AB = {
  emp: { l1Count: 8, jam: 1.5, stormTime: 4, stormSlow: 0.5 },
  airstrike: { speed: 950, band: 70, damage: [2, 3, 3], jets: [1, 2, 3], spacing: 130, burnTime: 4, burnBand: 40, burnTick: 0.5 },
  railgun: { shots: [2, 3, 2], damage: [2, 4, 8], width: [16, 18, 24], timeout: 10 },
  tesla: { time: [6, 8, 9], arcs: [2, 3, 3], range: 170, depth: [1, 1, 2] },
  decoy: { ghostTime: 6, offset: 120 },
  smoke: { time: [10, 13, 15], halfWidth: 70, maxLength: 760 },
  salvo: { rockets: [6, 10, 14], minRockets: 6, holdFull: 1, spread: 110, blast: 50, damage: [2, 2, 3], speed: 640 },
  hunter: { reach: 140 },
  /** Shortest swipe that counts as a line (world px). */
  minLine: 60,
} as const;

export type Levels = Partial<Record<AbilityId, number>>;

export const RESUPPLY_TEXT = 'Repair every ship and the carrier, refill the rack';

export function need(id: AbilityId, level: number): number {
  return ABILITIES[id].need[Math.max(1, Math.min(ABILITY_MAX, level)) - 1];
}

/** The ability's name at a level (evolved at level 3). */
export function abilityName(id: AbilityId, level: number): string {
  return level >= ABILITY_MAX ? ABILITIES[id].evolved : ABILITIES[id].name;
}

/** The abilities currently held (level ≥ 1), in roster order. */
export function loadout(levels: Levels): AbilityId[] {
  return ABILITY_ORDER.filter((id) => (levels[id] ?? 0) > 0);
}

/** Can this card be taken now? A held ability can level up until it has
 *  evolved; a new one needs a free slot. */
export function canTake(levels: Levels, id: CardId): boolean {
  if (id === 'resupply') return true;
  const lv = levels[id] ?? 0;
  if (lv >= ABILITY_MAX) return false;
  return lv > 0 || loadout(levels).length < MAX_SLOTS;
}

/** Can this new ability come in by replacing one you hold? Only when every
 *  slot is full — the replaced ability and its levels are given up. */
export function canSwapIn(levels: Levels, id: CardId): boolean {
  if (id === 'resupply' || (levels[id] ?? 0) > 0) return false;
  return loadout(levels).length >= MAX_SLOTS;
}
