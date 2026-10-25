// Upgrade cards. Interception only — every card answers a threat. After each
// wave the player is dealt 3 cards (never one already maxed) and keeps one.
// `stats()` turns the levels into the numbers the sim reads, so the sim never
// asks "do I have card X"; it reads a stat.

import { CARRIER, INTERCEPTOR, PICKUPS, SHIP } from './config';

/** Hold-to-fire repeat everyone gets without the card (seconds). */
export const HOLD_FREE = 0.6;

export type UpgradeId =
  | 'speed'
  | 'reload'
  | 'blast'
  | 'chain'
  | 'twin'
  | 'radar'
  | 'frigate'
  | 'hold'
  | 'salvage'
  | 'supercharge'
  | 'magnet'
  | 'armor'
  | 'smoke'
  | 'flares'
  | 'flak'
  | 'rhythm'
  | 'proxfuse'
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

// Round 4 roster: no turret defences (CIWS is gone); Bigger Rack folded into
// Quick Reload, Auto-Retarget into Twin Launch; Radar warns of everything
// sooner; the Shore Battery became an Escort Frigate that sails in; a slow
// hold-to-fire is free and the card only speeds it up.
export const UPGRADES: Record<Exclude<UpgradeId, 'resupply'>, UpgradeDef> & Partial<Record<'resupply', UpgradeDef>> = {
  speed: {
    id: 'speed',
    name: 'Faster Interceptors',
    max: 3,
    levels: ['+25% interceptor speed', '+50% interceptor speed', '+75% interceptor speed'],
    answers: 'Ballistic',
  },
  reload: {
    id: 'reload',
    name: 'Quick Reload',
    max: 3,
    levels: [
      'Reloads in 25% less time',
      `Reloads in 40% less time, rack holds ${INTERCEPTOR.rack + 2}`,
      `Reloads in 55% less time, rack holds ${INTERCEPTOR.rack + 4}`,
    ],
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
    max: 3,
    levels: [
      'Every tap fires a free 2nd interceptor',
      'Interceptors whose target is gone fly on to an uncovered one',
      'Every tap fires 2 free extras; spare ones peel off to uncovered threats',
    ],
    answers: 'Guided',
  },
  radar: {
    id: 'radar',
    name: 'Early-Warning Radar',
    max: 2,
    levels: [
      'Raids, subs and aircraft flagged 1.5 s sooner; ballistic impact points shown at launch',
      'Jamming: threats fly 12% slower',
    ],
    answers: 'Surprise',
  },
  frigate: {
    id: 'frigate',
    name: 'Escort Frigate',
    max: 2,
    levels: [
      'A frigate sails in beside the carrier with its own 4-round rack; taps fire from whichever is nearer',
      'Frigate rack holds 7 and it steams toward the thick of the fight',
    ],
    answers: 'Range',
  },
  hold: {
    id: 'hold',
    name: 'Rapid Hold',
    max: 2,
    levels: [
      `Holding your finger down repeats faster (every 0.45 s, not ${HOLD_FREE} s)`,
      'Hold repeats every 0.33 s',
    ],
    answers: 'Swarms',
  },
  // ---- Round 4: ten new cards (Escort Frigate above, nine here) ----
  salvage: {
    id: 'salvage',
    name: 'Salvage Crews',
    max: 2,
    levels: ['+25% pickup drops', `Pickups last ${PICKUPS.salvageLife} s instead of ${PICKUPS.life}`],
    answers: 'Attrition',
  },
  supercharge: {
    id: 'supercharge',
    name: 'Supercharged Pickups',
    max: 2,
    levels: ['Timed pickups last 50% longer, Repair heals 1 more', 'Every pickup also reloads 2 rounds'],
    answers: 'Attrition',
  },
  magnet: {
    id: 'magnet',
    name: 'Pickup Magnet',
    max: 2,
    levels: ['Grab pickups from twice as far', 'Pickups fly to the carrier on their own'],
    answers: 'Attrition',
  },
  armor: {
    id: 'armor',
    name: 'Armored Hulls',
    max: 2,
    levels: [`Ships take ${SHIP.hp + 1} hits to sink`, `Ships take ${SHIP.hp + 2} hits; carrier +4 HP`],
    answers: 'Everything',
  },
  smoke: {
    id: 'smoke',
    name: 'Smoke Screen',
    max: 2,
    levels: [
      'A ship that is hit lays smoke: guided missiles lose their lock on it (recharges in 10 s)',
      'Recharges in 6 s, and the smoke also hides ships from strafing guns',
    ],
    answers: 'Guided',
  },
  flares: {
    id: 'flares',
    name: 'Decoy Flares',
    max: 2,
    levels: [
      'A guided missile about to hit a ship chases a flare instead (recharges in 8 s)',
      'Recharges in 4 s, and fools supersonics too',
    ],
    answers: 'Guided',
  },
  flak: {
    id: 'flak',
    name: 'Flak Burst',
    max: 2,
    levels: ['Interceptors hit everything they pass close to on the way', 'Wider flak along the way'],
    answers: 'Aircraft',
  },
  rhythm: {
    id: 'rhythm',
    name: 'Combat Rhythm',
    max: 2,
    levels: ['Every 4th kill reloads a round instantly', 'Every 3rd kill, and the frigate reloads too'],
    answers: 'Swarms',
  },
  proxfuse: {
    id: 'proxfuse',
    name: 'Proximity Fuse',
    max: 2,
    levels: ['Interceptors burst when they get close: fast missiles stop slipping past', 'A fused hit does double damage'],
    answers: 'Ballistic',
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
  /** Twin Launch retargeting: 1 = re-aim when the target is gone, 2 = also
   *  peel extra interceptors off an already-covered target. */
  retarget: number;
  radarReticle: boolean;
  /** Seconds sooner that raids, subs and aircraft are flagged (Radar). */
  radarLead: number;
  threatSlow: number;
  /** Escort Frigate rack size (0 without the card). */
  frigateRack: number;
  /** Frigate L2: steams toward the threats instead of holding station. */
  frigateRoams: boolean;
  /** Hold to fire: seconds of game time between repeats (free, card speeds up). */
  holdRepeat: number;
  /** Pickup cards. */
  dropMult: number;
  pickupLife: number;
  /** Multiplies timed pickups (and adds to Repair). */
  pickupPower: number;
  pickupReload: number;
  grabMult: number;
  autoCollect: boolean;
  /** Armored Hulls. */
  shipHp: number;
  carrierHp: number;
  /** Smoke Screen recharge (0 = no card); L2 smoke also blinds strafing guns. */
  smokeEvery: number;
  smokeVsGuns: boolean;
  /** Decoy Flares recharge (0 = no card); L2 also fools supersonics. */
  flareEvery: number;
  flaresVsSupersonic: boolean;
  /** Flak Burst radius along an interceptor's path (0 = no card). */
  flak: number;
  /** Combat Rhythm: kills per free round (0 = no card); L2 feeds the frigate. */
  rhythmEvery: number;
  rhythmFrigate: boolean;
  /** Interceptor contact distance (Proximity Fuse widens it) and hit damage. */
  contact: number;
  hitDamage: number;
}

export function stats(levels: Levels): DefenseStats {
  const lv = (id: UpgradeId) => levels[id] ?? 0;
  const reload = lv('reload');
  const twin = lv('twin');
  return {
    interceptorSpeed: INTERCEPTOR.speed * (1 + 0.25 * lv('speed')),
    rack: INTERCEPTOR.rack + [0, 0, 2, 4][reload],
    reload: INTERCEPTOR.reload * [1, 0.75, 0.6, 0.45][reload],
    blast: INTERCEPTOR.blast * (1 + lv('blast')),
    chainRadius: [0, 55, 85][lv('chain')],
    freeExtras: [0, 1, 1, 2][twin],
    retarget: [0, 0, 1, 2][twin],
    radarReticle: lv('radar') >= 1,
    radarLead: lv('radar') >= 1 ? 1.5 : 0,
    threatSlow: lv('radar') >= 2 ? 0.88 : 1,
    frigateRack: [0, 4, 7][lv('frigate')],
    frigateRoams: lv('frigate') >= 2,
    holdRepeat: [HOLD_FREE, 0.45, 0.33][lv('hold')],
    dropMult: lv('salvage') >= 1 ? 1.25 : 1,
    pickupLife: lv('salvage') >= 2 ? PICKUPS.salvageLife : PICKUPS.life,
    pickupPower: lv('supercharge') >= 1 ? 1.5 : 1,
    pickupReload: lv('supercharge') >= 2 ? 2 : 0,
    grabMult: lv('magnet') >= 1 ? 2 : 1,
    autoCollect: lv('magnet') >= 2,
    shipHp: SHIP.hp + lv('armor'),
    carrierHp: CARRIER.hp + (lv('armor') >= 2 ? 4 : 0),
    smokeEvery: [0, 10, 6][lv('smoke')],
    smokeVsGuns: lv('smoke') >= 2,
    flareEvery: [0, 8, 4][lv('flares')],
    flaresVsSupersonic: lv('flares') >= 2,
    flak: [0, 28, 45][lv('flak')],
    rhythmEvery: [0, 4, 3][lv('rhythm')],
    rhythmFrigate: lv('rhythm') >= 2,
    contact: lv('proxfuse') >= 1 ? 34 : INTERCEPTOR.contact,
    hitDamage: lv('proxfuse') >= 2 ? 2 : 1,
  };
}
