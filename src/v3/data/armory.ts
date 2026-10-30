// THE ARMORY (V3). The main gun has no upgrades inside a run: its stats are
// set before the run, here, the way gear sets your weapon in Survivor.io.
// Salvage earned from every run (won or lost) buys armory levels, and the
// levels are permanent. Five upgrades, each touching only the main gun; a
// run takes ONE of them, the one equipped (playtest round 1).
//
// `gunStats()` turns armory levels into the numbers the sim reads; with no
// levels it is exactly V2's base gun.

import { INTERCEPTOR, SHIP } from './config';

export type ArmoryId = 'reload' | 'warhead' | 'motor' | 'magazine' | 'fuse';

export interface ArmoryDef {
  id: ArmoryId;
  name: string;
  /** One line: what a level does. */
  blurb: string;
  /** The stat at each level (index 0 = no levels), shown as the number. */
  show: (level: number) => string;
}

/** Levels per upgrade. */
export const ARMORY_MAX = 5;

/** Salvage for the next level: COSTS[level] buys level + 1. Every upgrade
 *  costs the same, so the order you buy them in is the only choice. */
export const ARMORY_COSTS = [80, 160, 280, 450, 700] as const;

/** Per-level effects. Round 6's audit found an 11-round rack reloading 55%
 *  faster let mashing win, so the armory stops short of that: −30% reload
 *  and a 10-round rack at the top. */
const RELOAD = [1, 0.94, 0.88, 0.82, 0.76, 0.7];
// V3 round 1: a run takes one upgrade, so each must matter on its own. At
// +20% a level Wide Warhead changed nothing (43% clears with or without it,
// average bot); a blast needs about 3× before it reaches past the target.
const WARHEAD = [1, 1.4, 1.8, 2.2, 2.6, 3];
const MOTOR = [1, 1.2, 1.4, 1.6, 1.8, 2];
const MAGAZINE = [0, 1, 2, 2, 3, 4];
const CONTACT = [0, 5, 10, 14, 17, 20];

export const ARMORY: Record<ArmoryId, ArmoryDef> = {
  reload: {
    id: 'reload',
    name: 'Quick Reload',
    blurb: 'Each round loads 6% faster',
    show: (l) => `${(INTERCEPTOR.reload * RELOAD[l]).toFixed(2)} s a round`,
  },
  warhead: {
    id: 'warhead',
    name: 'Wide Warhead',
    blurb: 'Interceptor blast 40% wider',
    show: (l) => `${Math.round(WARHEAD[l] * 100)}% blast`,
  },
  motor: {
    id: 'motor',
    name: 'Fast Motors',
    blurb: 'Interceptors fly 20% faster',
    show: (l) => `${Math.round(MOTOR[l] * 100)}% speed`,
  },
  magazine: {
    id: 'magazine',
    name: 'Deep Magazine',
    blurb: 'More rounds in the rack',
    show: (l) => `${INTERCEPTOR.rack + MAGAZINE[l]} rounds`,
  },
  fuse: {
    id: 'fuse',
    name: 'Proximity Fuse',
    blurb: 'Bursts closer to a fast target; level 5 hits for 2',
    show: (l) => `${INTERCEPTOR.contact + CONTACT[l]} px fuse${l >= ARMORY_MAX ? ', 2 dmg' : ''}`,
  },
};

export const ARMORY_ORDER: ArmoryId[] = ['reload', 'warhead', 'motor', 'magazine', 'fuse'];

export type ArmoryLevels = Partial<Record<ArmoryId, number>>;

/** Hold-to-fire repeat (seconds of game time). Free for everyone, as in V2. */
export const HOLD_REPEAT = 0.6;

/** The main gun's numbers, which is everything the sim reads about it. */
export interface GunStats {
  interceptorSpeed: number;
  rack: number;
  reload: number;
  blast: number;
  contact: number;
  hitDamage: number;
  holdRepeat: number;
  /** Fixed in V3 (Armored Hulls is gone); kept here so one place says it. */
  shipHp: number;
}

export function armoryLevel(a: ArmoryLevels, id: ArmoryId): number {
  return Math.max(0, Math.min(ARMORY_MAX, Math.floor(a[id] ?? 0)));
}

export function gunStats(a: ArmoryLevels = {}): GunStats {
  const lv = (id: ArmoryId) => armoryLevel(a, id);
  return {
    interceptorSpeed: INTERCEPTOR.speed * MOTOR[lv('motor')],
    rack: INTERCEPTOR.rack + MAGAZINE[lv('magazine')],
    reload: INTERCEPTOR.reload * RELOAD[lv('reload')],
    blast: INTERCEPTOR.blast * WARHEAD[lv('warhead')],
    contact: INTERCEPTOR.contact + CONTACT[lv('fuse')],
    hitDamage: lv('fuse') >= ARMORY_MAX ? 2 : 1,
    holdRepeat: HOLD_REPEAT,
    shipHp: SHIP.hp,
  };
}

/** Salvage for the next level of one upgrade, or null when it is maxed. */
export function nextCost(a: ArmoryLevels, id: ArmoryId): number | null {
  const l = armoryLevel(a, id);
  return l >= ARMORY_MAX ? null : ARMORY_COSTS[l];
}

/** Salvage to buy every level of every upgrade. */
export const ARMORY_TOTAL = ARMORY_COSTS.reduce((s, c) => s + c, 0) * ARMORY_ORDER.length;

/** Salvage a run earns: a little for every ship through, more for every wave
 *  cleared, and a bonus the first time a map is cleared. A lost run still
 *  pays, so a hard map is never a dead end. */
export const SALVAGE = {
  perShip: 1,
  perWave: 6,
  clear: 40,
  firstClear: 80,
} as const;

export function salvageFor(run: { delivered: number; wavesCleared: number; cleared: boolean }, firstClear: boolean): number {
  return (
    run.delivered * SALVAGE.perShip +
    run.wavesCleared * SALVAGE.perWave +
    (run.cleared ? SALVAGE.clear : 0) +
    (run.cleared && firstClear ? SALVAGE.firstClear : 0)
  );
}
