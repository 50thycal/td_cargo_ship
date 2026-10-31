// THE ARMORY (V3). Nothing in the Armory changes inside a run: it is set
// before the run, the way gear sets your weapon in Survivor.io. Salvage
// earned from every run (won or lost) buys armory levels, and the levels are
// permanent.
//
// Round 7 ("let's overhaul that armory too, it needs some more to it"): the
// Armory is three BAYS, each with its own upgrades, and a run takes ONE
// upgrade from each bay (the round-1 rule, "the player should only be
// allowed to select one… they don't get all of them", now per bay):
//   - Gun: the main gun (open from the start; the original five).
//   - Hull: the carrier and the convoy (opened with salvage).
//   - Supply: weapon drops and power-ups (opened with more salvage).
//
// `armoryStats()` turns armory levels into the numbers the sim reads; with
// no levels it is exactly V2's base gun and the base drop rules.

import { WEAPON } from './abilities';
import { CARRIER, INTERCEPTOR, SHIP } from './config';

export type BayId = 'gun' | 'hull' | 'supply';

export type ArmoryId =
  | 'reload'
  | 'warhead'
  | 'motor'
  | 'magazine'
  | 'fuse'
  | 'plating'
  | 'pointdef'
  | 'repair'
  | 'longload'
  | 'drops'
  | 'stockpile';

export interface BayDef {
  id: BayId;
  name: string;
  /** One line: what the bay's upgrades are about. */
  blurb: string;
  /** Salvage to open it (0: open from the start). */
  cost: number;
}

export const BAYS: Record<BayId, BayDef> = {
  gun: { id: 'gun', name: 'Gun', blurb: 'The main gun', cost: 0 },
  hull: { id: 'hull', name: 'Hull', blurb: 'The carrier and the convoy', cost: 250 },
  supply: { id: 'supply', name: 'Supply', blurb: 'Weapon drops and power-ups', cost: 600 },
};

export const BAY_ORDER: BayId[] = ['gun', 'hull', 'supply'];

export interface ArmoryDef {
  id: ArmoryId;
  bay: BayId;
  name: string;
  /** One line: what a level does. */
  blurb: string;
  /** Levels it has. */
  max: number;
  /** Salvage for each level: costs[level] buys level + 1. */
  costs: readonly number[];
  /** The stat at each level (index 0 = no levels), shown as the number. */
  show: (level: number) => string;
}

/** Levels for most upgrades. */
export const ARMORY_MAX = 5;

/** Salvage for the next level of a five-level upgrade: COSTS[level] buys
 *  level + 1. */
export const ARMORY_COSTS = [80, 160, 280, 450, 700] as const;

/** Per-level effects (index = level). Round 6's audit found an 11-round rack
 *  reloading 55% faster let mashing win, so the gun stops short of that:
 *  −30% reload and a 10-round rack at the top. */
const RELOAD = [1, 0.94, 0.88, 0.82, 0.76, 0.7];
// V3 round 1: a run takes one gun upgrade, so each must matter on its own.
// At +20% a level Wide Warhead changed nothing (43% clears with or without
// it, average bot); a blast needs about 3× before it reaches past the target.
const WARHEAD = [1, 1.4, 1.8, 2.2, 2.6, 3];
const MOTOR = [1, 1.2, 1.4, 1.6, 1.8, 2];
const MAGAZINE = [0, 1, 2, 2, 3, 4];
const CONTACT = [0, 5, 10, 14, 17, 20];
// The Hull and Supply numbers were tuned on the average bot, each upgrade
// alone (round 7). Carrier hull alone changed nothing (runs are lost to
// sunk ships, not to the carrier), and nor did patching one hull every
// 10–24 s: both now reach the ships. A whole extra hit a ship was too
// coarse to level (one step from 57% to 82%, then nothing), so armour is a
// share of hits that glance off. Point Defense and Supply Lines at their
// first numbers cleared 93–95% at level 5 against Wide Warhead's 65%.
/** Armor Plating: the share of hits on a hull (ship or carrier) that glance off. */
const GLANCE = [0, 0.08, 0.16, 0.24, 0.32, 0.4];
/** Point Defense: seconds between the carrier's own shots, and their reach. */
const PD_GAP = [0, 3.5, 3, 2.6, 2.3, 2];
const PD_RANGE = [0, 280, 300, 320, 340, 360];
/** Damage Control: seconds between patches (a point on every hurt hull). */
const REPAIR = [0, 10, 8.5, 7, 5.5, 4];
/** Long Loads: seconds a weapon pickup loads the gun for. */
const LOAD_TIME = [0, 4, 8, 12, 16, 20];
/** Supply Lines: weapon drop chance (× the base share) and the pity clock. */
const DROP_SHARE = [1, 1.08, 1.16, 1.24, 1.32, 1.4];
const DROP_PITY = [WEAPON.pity, 26, 24, 22, 21, 20];
/** Stockpile: power-up drop chance and how long a timed one lasts (×). A
 *  first try, Head Start (draft a weapon before wave 1, up to MAX), changed
 *  nothing: by the late waves that decide a run every held weapon is maxed
 *  anyway (57% clears at its top level, the same as without it). */
const POWER_SHARE = [1, 1.15, 1.3, 1.45, 1.6, 1.75];
const POWER_TIME = [1, 1.1, 1.2, 1.3, 1.4, 1.5];

const pct = (x: number) => `${Math.round(x * 100)}%`;

export const ARMORY: Record<ArmoryId, ArmoryDef> = {
  reload: {
    id: 'reload',
    bay: 'gun',
    name: 'Quick Reload',
    blurb: 'Each round loads 6% faster',
    max: ARMORY_MAX,
    costs: ARMORY_COSTS,
    show: (l) => `${(INTERCEPTOR.reload * RELOAD[l]).toFixed(2)} s a round`,
  },
  warhead: {
    id: 'warhead',
    bay: 'gun',
    name: 'Wide Warhead',
    blurb: 'Interceptor blast 40% wider',
    max: ARMORY_MAX,
    costs: ARMORY_COSTS,
    show: (l) => `${pct(WARHEAD[l])} blast`,
  },
  motor: {
    id: 'motor',
    bay: 'gun',
    name: 'Fast Motors',
    blurb: 'Interceptors fly 20% faster',
    max: ARMORY_MAX,
    costs: ARMORY_COSTS,
    show: (l) => `${pct(MOTOR[l])} speed`,
  },
  magazine: {
    id: 'magazine',
    bay: 'gun',
    name: 'Deep Magazine',
    blurb: 'More rounds in the rack',
    max: ARMORY_MAX,
    costs: ARMORY_COSTS,
    show: (l) => `${INTERCEPTOR.rack + MAGAZINE[l]} rounds`,
  },
  fuse: {
    id: 'fuse',
    bay: 'gun',
    name: 'Proximity Fuse',
    blurb: 'Bursts closer to a fast target; level 5 hits for 2',
    max: ARMORY_MAX,
    costs: ARMORY_COSTS,
    show: (l) => `${INTERCEPTOR.contact + CONTACT[l]} px fuse${l >= ARMORY_MAX ? ', 2 dmg' : ''}`,
  },
  plating: {
    id: 'plating',
    bay: 'hull',
    name: 'Armor Plating',
    blurb: 'Hits on a ship or the carrier glance off, 8% more a level',
    max: ARMORY_MAX,
    costs: ARMORY_COSTS,
    show: (l) => `${pct(GLANCE[l])} of hits glance off`,
  },
  pointdef: {
    id: 'pointdef',
    bay: 'hull',
    name: 'Point Defense',
    blurb: 'The carrier shoots the nearest threat on its own',
    max: ARMORY_MAX,
    costs: ARMORY_COSTS,
    show: (l) => (l ? `a shot every ${PD_GAP[l]} s, reach ${PD_RANGE[l]}` : 'none'),
  },
  repair: {
    id: 'repair',
    bay: 'hull',
    name: 'Damage Control',
    blurb: 'Crews patch every damaged hull, ships and carrier',
    max: ARMORY_MAX,
    costs: ARMORY_COSTS,
    show: (l) => (l ? `+1 hull every ${REPAIR[l]} s` : 'none'),
  },
  longload: {
    id: 'longload',
    bay: 'supply',
    name: 'Long Loads',
    blurb: 'A weapon pickup stays in the gun 4 s longer a level',
    max: ARMORY_MAX,
    costs: ARMORY_COSTS,
    show: (l) => `${WEAPON.time + LOAD_TIME[l]} s a weapon`,
  },
  drops: {
    id: 'drops',
    bay: 'supply',
    name: 'Supply Lines',
    blurb: 'Weapons drop more often',
    max: ARMORY_MAX,
    costs: ARMORY_COSTS,
    show: (l) => `${pct(DROP_SHARE[l])} drops, one at least every ${DROP_PITY[l]} s`,
  },
  stockpile: {
    id: 'stockpile',
    bay: 'supply',
    name: 'Stockpile',
    blurb: 'Power-ups drop more often and last longer',
    max: ARMORY_MAX,
    costs: ARMORY_COSTS,
    show: (l) => `${pct(POWER_SHARE[l])} drops, ${pct(POWER_TIME[l])} time`,
  },
};

export const ARMORY_ORDER: ArmoryId[] = ['reload', 'warhead', 'motor', 'magazine', 'fuse', 'plating', 'pointdef', 'repair', 'longload', 'drops', 'stockpile'];

/** The upgrades in one bay, in order. */
export function bayItems(bay: BayId): ArmoryId[] {
  return ARMORY_ORDER.filter((id) => ARMORY[id].bay === bay);
}

export type ArmoryLevels = Partial<Record<ArmoryId, number>>;

/** Hold-to-fire repeat (seconds of game time). Free for everyone, as in V2. */
export const HOLD_REPEAT = 0.6;

/** Everything the sim reads from the Armory: the main gun's numbers, the
 *  hulls', and the drop rules. */
export interface ArmoryStats {
  interceptorSpeed: number;
  rack: number;
  reload: number;
  blast: number;
  contact: number;
  hitDamage: number;
  holdRepeat: number;
  /** Hits a ship and the carrier take (fixed; kept here so one place says it). */
  shipHp: number;
  carrierHp: number;
  /** Armor Plating: the chance a hit on a hull glances off. */
  glance: number;
  /** Point Defense: seconds between shots (0: none) and their reach. */
  pdGap: number;
  pdRange: number;
  /** Damage Control: seconds to patch a hull point (0: none). */
  repairEvery: number;
  /** Seconds a weapon pickup loads the gun for. */
  weaponTime: number;
  /** Weapon drop chance, × a kill's power-up chance, and the pity clock. */
  dropShare: number;
  dropPity: number;
  /** Stockpile: power-up drop chance and timed power-up length (×). */
  powerShare: number;
  powerTime: number;
}

export function armoryLevel(a: ArmoryLevels, id: ArmoryId): number {
  return Math.max(0, Math.min(ARMORY[id].max, Math.floor(a[id] ?? 0)));
}

export function armoryStats(a: ArmoryLevels = {}): ArmoryStats {
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
    carrierHp: CARRIER.hp,
    glance: GLANCE[lv('plating')],
    pdGap: PD_GAP[lv('pointdef')],
    pdRange: PD_RANGE[lv('pointdef')],
    repairEvery: REPAIR[lv('repair')],
    weaponTime: WEAPON.time + LOAD_TIME[lv('longload')],
    dropShare: WEAPON.share * DROP_SHARE[lv('drops')],
    dropPity: DROP_PITY[lv('drops')],
    powerShare: POWER_SHARE[lv('stockpile')],
    powerTime: POWER_TIME[lv('stockpile')],
  };
}

/** Salvage for the next level of one upgrade, or null when it is maxed. */
export function nextCost(a: ArmoryLevels, id: ArmoryId): number | null {
  const l = armoryLevel(a, id);
  return l >= ARMORY[id].max ? null : ARMORY[id].costs[l];
}

/** Salvage to open every bay and buy every level of every upgrade. */
export const ARMORY_TOTAL =
  BAY_ORDER.reduce((s, b) => s + BAYS[b].cost, 0) + ARMORY_ORDER.reduce((s, id) => s + ARMORY[id].costs.reduce((t, c) => t + c, 0), 0);

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
