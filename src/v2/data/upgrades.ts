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
  | 'hold';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  max: number;
  /** One line per level (index 0 = level 1). */
  levels: string[];
  /** Which threat it answers — shown on the card. */
  answers: string;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
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
    levels: ['Hold 8 interceptors', 'Hold 10 interceptors', 'Hold 12 interceptors'],
    answers: 'Drone swarms',
  },
  reload: {
    id: 'reload',
    name: 'Quick Reload',
    max: 3,
    levels: ['Reload 18% faster', 'Reload 36% faster', 'Reload 54% faster'],
    answers: 'Everything',
  },
  blast: {
    id: 'blast',
    name: 'Wide Warhead',
    max: 3,
    levels: ['Bigger interceptor blast', 'Even bigger blast', 'Huge blast'],
    answers: 'Drone swarms',
  },
  chain: {
    id: 'chain',
    name: 'Chain Detonation',
    max: 2,
    levels: ['Kills explode, hitting nearby threats', 'Bigger chain explosions'],
    answers: 'Drone swarms',
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
    max: 1,
    levels: ['Interceptors whose target dies find a new one'],
    answers: 'Guided',
  },
  ciws: {
    id: 'ciws',
    name: 'Carrier CIWS',
    max: 3,
    levels: ['Carrier gun shoots nearby threats', 'Longer range, faster gun', 'Max range, max rate'],
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
    max: 1,
    levels: ['A second launch point — taps fire from the nearer one'],
    answers: 'Range',
  },
  hold: {
    id: 'hold',
    name: 'Hold to Fire',
    max: 1,
    levels: ['Hold your finger down to keep firing at what is under it'],
    answers: 'Swarms',
  },
};

export const UPGRADE_ORDER = Object.keys(UPGRADES) as UpgradeId[];

export type Levels = Partial<Record<UpgradeId, number>>;

export interface DefenseStats {
  interceptorSpeed: number;
  rack: number;
  reload: number;
  blast: number;
  chainRadius: number;
  freeExtras: number;
  retarget: boolean;
  ciwsRange: number;
  ciwsCooldown: number;
  radarReticle: boolean;
  threatSlow: number;
  battery: boolean;
  holdToFire: boolean;
}

export function stats(levels: Levels): DefenseStats {
  const lv = (id: UpgradeId) => levels[id] ?? 0;
  const ciws = lv('ciws');
  return {
    interceptorSpeed: INTERCEPTOR.speed * (1 + 0.25 * lv('speed')),
    rack: INTERCEPTOR.rack + 2 * lv('rack'),
    reload: INTERCEPTOR.reload * (1 - 0.18 * lv('reload')),
    blast: INTERCEPTOR.blast + 14 * lv('blast'),
    chainRadius: [0, 42, 64][lv('chain')],
    freeExtras: lv('twin'),
    retarget: lv('retarget') > 0,
    ciwsRange: ciws ? 110 + 45 * ciws : 0,
    ciwsCooldown: [0, 1.1, 0.8, 0.55][ciws],
    radarReticle: lv('radar') >= 1,
    threatSlow: lv('radar') >= 2 ? 0.88 : 1,
    battery: lv('battery') > 0,
    holdToFire: lv('hold') > 0,
  };
}
