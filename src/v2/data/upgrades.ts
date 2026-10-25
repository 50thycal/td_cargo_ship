// Upgrade cards. Interception only — every card answers a threat. After each
// wave the player is dealt 3 cards (never one already maxed) and keeps one.
// `stats()` turns the levels into the numbers the sim reads, so the sim never
// asks "do I have card X"; it reads a stat.

import { INTERCEPTOR } from './config';

export type UpgradeId =
  | 'speed'
  | 'rack'
  | 'reload'
  | 'blast'
  | 'chain'
  | 'twin'
  | 'retarget'
  | 'ciws'
  | 'radar'
  | 'battery'
  | 'hold'
  | 'resupply';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  max: number;
  /** One line per level (index 0 = level 1). */
  levels: string[];
  /** Which threat it answers — shown on the card. */
  answers: string;
}

export const UPGRADES: Record<Exclude<UpgradeId, 'resupply'>, UpgradeDef> & Partial<Record<'resupply', UpgradeDef>> = {
  speed: {
    id: 'speed',
    name: 'Faster Interceptors',
    max: 3,
    levels: ['+25% interceptor speed', '+50% interceptor speed', '+75% interceptor speed'],
    answers: 'Ballistic',
  },
  rack: {
    id: 'rack',
    name: 'Bigger Rack',
    max: 3,
    levels: [1, 2, 3].map((l) => `Hold ${INTERCEPTOR.rack + 3 * l} interceptors`),
    answers: 'Swarms',
  },
  reload: {
    id: 'reload',
    name: 'Quick Reload',
    max: 3,
    levels: ['Reloads in 25% less time', 'Reloads in 40% less time', 'Reloads in 55% less time'],
    answers: 'Everything',
  },
  blast: {
    id: 'blast',
    name: 'Wide Warhead',
    max: 3,
    levels: ['Interceptor blast twice as wide', 'Blast three times as wide', 'Blast four times as wide'],
    answers: 'Swarms',
  },
  chain: {
    id: 'chain',
    name: 'Chain Detonation',
    max: 2,
    levels: ['Kills explode, hitting nearby threats', 'Bigger chain explosions'],
    answers: 'Swarms',
  },
  twin: {
    id: 'twin',
    name: 'Twin Launch',
    max: 2,
    levels: ['Every tap fires a free 2nd interceptor', 'Every tap fires 2 free extras'],
    answers: 'Guided',
  },
  retarget: {
    id: 'retarget',
    name: 'Auto-Retarget',
    max: 2,
    levels: [
      'An interceptor whose target is gone flies on to one nobody is covering',
      'Extra interceptors on an already-covered target peel off to an uncovered one',
    ],
    answers: 'Guided',
  },
  ciws: {
    id: 'ciws',
    name: 'Carrier CIWS',
    max: 3,
    levels: ['Last-ditch carrier gun: shoots what gets close, carrier attackers first', 'Longer reach, fires faster', 'Longest reach, fires fastest'],
    answers: 'Leakers',
  },
  radar: {
    id: 'radar',
    name: 'Early-Warning Radar',
    max: 2,
    levels: ['Ballistic impact points shown at launch', 'Jamming: threats fly 12% slower'],
    answers: 'Ballistic',
  },
  battery: {
    id: 'battery',
    name: 'Shore Battery',
    max: 2,
    levels: [
      'A second launcher with its own 4-round rack; taps fire from whichever is nearer',
      'Battery rack grows to 7 rounds',
    ],
    answers: 'Range',
  },
  hold: {
    id: 'hold',
    name: 'Hold to Fire',
    max: 2,
    levels: [
      'Hold your finger down to keep firing at what is under it (every 0.45 s)',
      'Hold fire repeats faster (every 0.33 s)',
    ],
    answers: 'Swarms',
  },
};

/** Not an upgrade: offered when a full loadout's draft has nothing it can
 *  take without a swap, so keeping your build is always an option. Takes no
 *  slot. */
export const RESUPPLY: UpgradeDef = {
  id: 'resupply',
  name: 'Resupply',
  max: Infinity,
  levels: ['Repair every ship and the carrier, and refill the racks'],
  answers: 'Attrition',
};

/** Every real card (Resupply is not one). */
export const UPGRADE_ORDER = (Object.keys(UPGRADES) as UpgradeId[]).filter((id) => id !== 'resupply');

/** Different cards a loadout can hold at once. */
export const MAX_SLOTS = 3;

export function cardDef(id: UpgradeId): UpgradeDef {
  return id === 'resupply' ? RESUPPLY : UPGRADES[id];
}

/** The cards currently in the loadout (level ≥ 1). */
export function loadout(levels: Levels): UpgradeId[] {
  return UPGRADE_ORDER.filter((id) => (levels[id] ?? 0) > 0);
}

/** Can this card be taken now? An owned card can always level up (until
 *  maxed); a new card needs a free slot. */
export function canTake(levels: Levels, id: UpgradeId): boolean {
  if (id === 'resupply') return true;
  const lv = levels[id] ?? 0;
  if (lv >= UPGRADES[id].max) return false;
  return lv > 0 || loadout(levels).length < MAX_SLOTS;
}

/** Can this new card come in by replacing one you hold? Only when every
 *  slot is full — the replaced card and all its levels are given up. */
export function canSwapIn(levels: Levels, id: UpgradeId): boolean {
  if (id === 'resupply' || (levels[id] ?? 0) > 0) return false;
  return loadout(levels).length >= MAX_SLOTS;
}

export type Levels = Partial<Record<UpgradeId, number>>;

export interface DefenseStats {
  interceptorSpeed: number;
  rack: number;
  reload: number;
  blast: number;
  chainRadius: number;
  freeExtras: number;
  /** Auto-Retarget level: 1 = re-aim when the target is gone, 2 = also peel
   *  extra interceptors off an already-covered target. */
  retarget: number;
  ciwsRange: number;
  ciwsCooldown: number;
  radarReticle: boolean;
  threatSlow: number;
  /** Shore Battery rack size (0 without the card). */
  batteryRack: number;
  /** Hold to Fire: seconds of game time between repeats (0 = no card). */
  holdRepeat: number;
}

export function stats(levels: Levels): DefenseStats {
  const lv = (id: UpgradeId) => levels[id] ?? 0;
  const ciws = lv('ciws');
  return {
    interceptorSpeed: INTERCEPTOR.speed * (1 + 0.25 * lv('speed')),
    rack: INTERCEPTOR.rack + 3 * lv('rack'),
    reload: INTERCEPTOR.reload * [1, 0.75, 0.6, 0.45][lv('reload')],
    blast: INTERCEPTOR.blast * (1 + lv('blast')),
    chainRadius: [0, 55, 85][lv('chain')],
    freeExtras: lv('twin'),
    retarget: lv('retarget'),
    // Measured from the carrier: the near lane sits ~185-285 units away.
    ciwsRange: [0, 190, 240, 290][ciws],
    ciwsCooldown: [0, 1.1, 0.9, 0.7][ciws],
    radarReticle: lv('radar') >= 1,
    threatSlow: lv('radar') >= 2 ? 0.88 : 1,
    batteryRack: [0, 4, 7][lv('battery')],
    holdRepeat: [0, 0.45, 0.33][lv('hold')],
  };
}
