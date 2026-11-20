// THE ARMORY (V3). Nothing in the Armory changes inside a run: it is set
// before the run, the way gear sets your weapon in Survivor.io.
//
// Round 7 ("let's overhaul that armory too, it needs some more to it"): the
// Armory is three BAYS, each with its own upgrades, and a run takes ONE
// upgrade from each bay (the round-1 rule, "the player should only be
// allowed to select one… they don't get all of them", now per bay):
//   - Gun: the main gun (the original five).
//   - Hull: the carrier and the convoy.
//   - Supply: weapon drops and power-ups.
// And every upgrade is a CARD, won at the end of a run, not bought: "they
// need to get that card at the end of the game. They don't get to pick
// which ones… to get the next reload, you need to win another reload from
// a random drop" (Survivor.io's gear). A card you hold already stacks: one
// more level. Salvage (round 1's currency) is gone.
//
// The Armory overhaul (2026-11-20, docs/design/v3-armory-overhaul.md, the
// player's marks on round ar1): cards are still FOUND at random at the end
// of a run, but a card found again pays Scrap instead of a level, and levels
// 2-5 are BOUGHT with Scrap, earned in every run, by the player's choice
// (Survivor.io's gear and gold). The weak three are lifted as measured
// (Quick Reload, Stockpile, Long Loads), Deep Magazine moves to the Supply
// bay with a round at every level, and the Armory's Point Defense is shown
// as "Deck Guns" (its id stays `pointdef`, so saves and logs keep it).
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
  | 'stockpile'
  | 'boilers'
  | 'lifeboats'
  | 'quartermaster'
  | 'salvage';

export interface BayDef {
  id: BayId;
  name: string;
  /** One line: what the bay's upgrades are about. */
  blurb: string;
  /** The colour of its cards. */
  color: string;
}

export const BAYS: Record<BayId, BayDef> = {
  gun: { id: 'gun', name: 'Gun', blurb: 'The main gun', color: '#38bdf8' },
  hull: { id: 'hull', name: 'Hull', blurb: 'The carrier and the convoy', color: '#4ade80' },
  supply: { id: 'supply', name: 'Supply', blurb: 'Rounds, weapon drops and power-ups', color: '#fbbf24' },
};

export const BAY_ORDER: BayId[] = ['gun', 'hull', 'supply'];

export interface ArmoryDef {
  id: ArmoryId;
  bay: BayId;
  name: string;
  /** One line: what a level does. */
  blurb: string;
  /** Levels it has: one card each. */
  max: number;
  /** The stat at each level (index 0 = no levels), shown as the number. */
  show: (level: number) => string;
}

/** Levels for most upgrades. */
export const ARMORY_MAX = 5;

/** Per-level effects (index = level). Round 6's audit found an 11-round rack
 *  reloading 55% faster let mashing win, so the gun stops short of that.
 *  The overhaul's lift (measured: 4.5 → 6.7 ships saved at level 5): 8%
 *  faster a level, −40% at the top (it was 6%, −30%). */
const RELOAD = [1, 0.92, 0.84, 0.76, 0.68, 0.6];
// V3 round 1: a run takes one gun upgrade, so each must matter on its own.
// At +20% a level Wide Warhead changed nothing (43% clears with or without
// it, average bot); a blast needs about 3× before it reaches past the target.
const WARHEAD = [1, 1.4, 1.8, 2.2, 2.6, 3];
const MOTOR = [1, 1.2, 1.4, 1.6, 1.8, 2];
/** Deep Magazine: rounds added to the rack. Level 3 used to add nothing
 *  (8 → 8); now every level is a round (7, 8, 9, 10, 11), as the overhaul
 *  suggested. In the Supply bay it can ride with Quick Reload 5: 11 rounds
 *  at −40% is still short of round 6's mash line (11 rounds at −55%). */
const MAGAZINE = [0, 1, 2, 3, 4, 5];
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
/** Long Loads: seconds a weapon pickup loads the gun for. Longer loads alone
 *  saved nothing (a new weapon drops before the old one runs out), so the
 *  overhaul gives it a second job: every weapon or boost pickup also puts
 *  rounds back in the rack (measured at level 5: 3.3 → 5.2 ships saved).
 *  RACK_REFILL's last entry is the whole rack, whatever its size (WHOLE_RACK:
 *  more rounds than any rack holds; a finite number, so stats stay JSON). */
export const WHOLE_RACK = 99;
const LOAD_TIME = [0, 4, 8, 12, 16, 20];
export const RACK_REFILL = [0, 2, 3, 4, 5, WHOLE_RACK];
/** Supply Lines: weapon drop chance (× the base share) and the pity clock. */
const DROP_SHARE = [1, 1.08, 1.16, 1.24, 1.32, 1.4];
const DROP_PITY = [WEAPON.pity, 26, 24, 22, 21, 20];
/** Stockpile: power-up drop chance and how long a timed one lasts (×). A
 *  first try, Head Start (draft a weapon before wave 1, up to MAX), changed
 *  nothing: by the late waves that decide a run every held weapon is maxed
 *  anyway (57% clears at its top level, the same as without it). */
/** The overhaul's lift: +45% drops and +30% time a level (3.25× and 2.5×
 *  at the top; measured 3.1 → 5.8 ships saved). Power-ups are rare, so it
 *  takes a big multiplier to matter. */
const POWER_SHARE = [1, 1.45, 1.9, 2.35, 2.8, 3.25];
const POWER_TIME = [1, 1.3, 1.6, 1.9, 2.2, 2.5];

// The four new upgrades (2026-11-20, the player on the Armory review page:
// "Do life boat, salvage crew, boiler and quarter master"; numbers from
// docs/design/v3-armory-overhaul.md, "New upgrades", measured in
// tools/v3/armory-ideas/new-upgrades.md).
/** Boilers: the convoy's sailing speed (×). Only how fast a hull sails:
 *  every clock on a map (Saltgate's locks, a radar's window, the spawn
 *  gaps) runs as it did. */
const CONVOY_SPEED = [1, 1.04, 1.08, 1.12, 1.16, 1.2];
/** Boilers level 5: a Full Steam pickup (the power-up or the boost) lasts
 *  this many times as long. */
const STEAM_TIME = [1, 1, 1, 1, 1, 2];
/** Lifeboats: how many waves a run the first ship sunk counts as half a loss
 *  (one a wave at most; LIFEBOATS_ALL: every wave). Every boss round is a
 *  wave of its own; a bonus wave shares the number, and the boat, of the
 *  wave it follows. */
export const LIFEBOATS_ALL = 99;
const LIFEBOATS = [0, 2, 4, 6, 8, LIFEBOATS_ALL];
/** Lifeboats: the share of a loss a ship saved by a boat still counts. */
export const LIFEBOAT_LOSS = 0.5;
/** Quartermaster: re-rolls of the weapon draft a run, and the cards a draft
 *  deals. Five levels over three re-rolls and the fourth card leave one
 *  step without a new number: level 3 (2 re-rolls, as level 2). */
const REROLLS = [0, 1, 2, 2, 3, 3];
const DRAFT_CARDS = [3, 3, 3, 3, 3, 4];
/** Salvage Crews: Scrap a run earns, × (1 + this). An economy card only. */
const SALVAGE = [0, 0.1, 0.2, 0.3, 0.4, 0.5];

const pct = (x: number) => `${Math.round(x * 100)}%`;

export const ARMORY: Record<ArmoryId, ArmoryDef> = {
  reload: {
    id: 'reload',
    bay: 'gun',
    name: 'Quick Reload',
    blurb: 'Each round loads 8% faster',
    max: ARMORY_MAX,
    show: (l) => `${(INTERCEPTOR.reload * RELOAD[l]).toFixed(2)} s a round`,
  },
  warhead: {
    id: 'warhead',
    bay: 'gun',
    name: 'Wide Warhead',
    blurb: 'Interceptor blast 40% wider',
    max: ARMORY_MAX,
    show: (l) => `${pct(WARHEAD[l])} blast`,
  },
  motor: {
    id: 'motor',
    bay: 'gun',
    name: 'Fast Motors',
    blurb: 'Interceptors fly 20% faster',
    max: ARMORY_MAX,
    show: (l) => `${pct(MOTOR[l])} speed`,
  },
  magazine: {
    id: 'magazine',
    bay: 'supply',
    name: 'Deep Magazine',
    blurb: 'One more round in the rack a level',
    max: ARMORY_MAX,
    show: (l) => `${INTERCEPTOR.rack + MAGAZINE[l]} rounds`,
  },
  fuse: {
    id: 'fuse',
    bay: 'gun',
    name: 'Proximity Fuse',
    blurb: 'Bursts closer to a fast target; level 5 hits for 2',
    max: ARMORY_MAX,
    // As a share of the plain fuse, like its neighbours' "140% blast" (it
    // used to say "19 px fuse": a developer's unit, playthrough round).
    show: (l) => `${Math.round((100 * (INTERCEPTOR.contact + CONTACT[l])) / INTERCEPTOR.contact)}% fuse reach${l >= ARMORY_MAX ? ', 2 dmg' : ''}`,
  },
  plating: {
    id: 'plating',
    bay: 'hull',
    name: 'Armor Plating',
    blurb: 'Hits on a ship or the carrier glance off, 8% more a level',
    max: ARMORY_MAX,
    show: (l) => `${pct(GLANCE[l])} of hits glance off`,
  },
  pointdef: {
    id: 'pointdef',
    bay: 'hull',
    // Shown as Deck Guns (overhaul): "Point Defense" is also a weapon you
    // draft in a run. The id stays `pointdef` (saves, logs, bot presets).
    name: 'Deck Guns',
    blurb: 'The carrier shoots the nearest threat on its own',
    max: ARMORY_MAX,
    // Reach in metres (a bare "reach 280" meant nothing to a player).
    show: (l) => (l ? `a shot every ${PD_GAP[l]} s, ${PD_RANGE[l]} m reach` : 'none'),
  },
  repair: {
    id: 'repair',
    bay: 'hull',
    name: 'Damage Control',
    blurb: 'Crews patch every damaged hull, ships and carrier',
    max: ARMORY_MAX,
    show: (l) => (l ? `+1 hull every ${REPAIR[l]} s` : 'none'),
  },
  longload: {
    id: 'longload',
    bay: 'supply',
    name: 'Long Loads',
    blurb: 'Weapons stay loaded longer, and every pickup refills the rack',
    max: ARMORY_MAX,
    show: (l) => `${WEAPON.time + LOAD_TIME[l]} s a weapon` + (l ? `, refills ${RACK_REFILL[l] >= WHOLE_RACK ? 'the whole rack' : `${RACK_REFILL[l]} rounds`}` : ''),
  },
  drops: {
    id: 'drops',
    bay: 'supply',
    name: 'Supply Lines',
    blurb: 'Weapons drop more often',
    max: ARMORY_MAX,
    show: (l) => `${pct(DROP_SHARE[l])} drops, one at least every ${DROP_PITY[l]} s`,
  },
  stockpile: {
    id: 'stockpile',
    bay: 'supply',
    name: 'Stockpile',
    blurb: 'Power-ups drop more often and last longer',
    max: ARMORY_MAX,
    show: (l) => `${pct(POWER_SHARE[l])} drops, ${pct(POWER_TIME[l])} time`,
  },
  boilers: {
    id: 'boilers',
    bay: 'hull',
    name: 'Boilers',
    blurb: 'The convoy sails 4% faster a level; level 5 doubles Full Steam',
    max: ARMORY_MAX,
    show: (l) => `${pct(CONVOY_SPEED[l])} speed${STEAM_TIME[l] > 1 ? `, Full Steam ×${STEAM_TIME[l]}` : ''}`,
  },
  lifeboats: {
    id: 'lifeboats',
    bay: 'hull',
    name: 'Lifeboats',
    blurb: 'The first ship sunk in a wave counts as half a loss',
    max: ARMORY_MAX,
    show: (l) => (!l ? 'none' : LIFEBOATS[l] >= LIFEBOATS_ALL ? 'half a loss, every wave' : `half a loss, ${LIFEBOATS[l]} waves a run`),
  },
  quartermaster: {
    id: 'quartermaster',
    bay: 'supply',
    name: 'Quartermaster',
    blurb: 'Re-roll the weapon draft; level 5 deals 4 cards',
    max: ARMORY_MAX,
    show: (l) => (!l ? 'no re-rolls' : `${REROLLS[l]} re-roll${REROLLS[l] === 1 ? '' : 's'} a run${DRAFT_CARDS[l] > 3 ? `, ${DRAFT_CARDS[l]} cards` : ''}`),
  },
  salvage: {
    id: 'salvage',
    bay: 'supply',
    name: 'Salvage Crews',
    blurb: '10% more Scrap from a run, a level',
    max: ARMORY_MAX,
    show: (l) => `${pct(1 + SALVAGE[l])} scrap`,
  },
};

/** In bay order: Gun (4), Hull (5), Supply (6). */
export const ARMORY_ORDER: ArmoryId[] = ['reload', 'warhead', 'motor', 'fuse', 'plating', 'pointdef', 'repair', 'boilers', 'lifeboats', 'magazine', 'longload', 'drops', 'stockpile', 'quartermaster', 'salvage'];

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
  /** Long Loads: rounds a weapon or boost pickup puts back in the rack
   *  (0: none; WHOLE_RACK: all of it). */
  refill: number;
  /** Weapon drop chance, × a kill's power-up chance, and the pity clock. */
  dropShare: number;
  dropPity: number;
  /** Stockpile: power-up drop chance and timed power-up length (×). */
  powerShare: number;
  powerTime: number;
  /** Boilers: the convoy's sailing speed (×), and a Full Steam pickup's
   *  length (×). */
  convoySpeed: number;
  steamTime: number;
  /** Lifeboats: waves a run whose first ship sunk counts as half a loss. */
  lifeboats: number;
  /** Quartermaster: draft re-rolls a run, and the cards a draft deals. */
  rerolls: number;
  draftCards: number;
  /** Salvage Crews: Scrap × (1 + this). Read by the result, not the sim. */
  salvage: number;
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
    refill: RACK_REFILL[lv('longload')],
    dropShare: WEAPON.share * DROP_SHARE[lv('drops')],
    dropPity: DROP_PITY[lv('drops')],
    powerShare: POWER_SHARE[lv('stockpile')],
    powerTime: POWER_TIME[lv('stockpile')],
    convoySpeed: CONVOY_SPEED[lv('boilers')],
    steamTime: STEAM_TIME[lv('boilers')],
    lifeboats: LIFEBOATS[lv('lifeboats')],
    rerolls: REROLLS[lv('quartermaster')],
    draftCards: DRAFT_CARDS[lv('quartermaster')],
    salvage: SALVAGE[lv('salvage')],
  };
}

/** Armory cards a finished run finds: one for any run that cleared enough
 *  waves to count (a run quit at once finds nothing), one more for clearing
 *  the map, one more the first time it is cleared. */
export const CARD_DROPS = {
  minWaves: 3,
  run: 1,
  clear: 1,
  firstClear: 1,
} as const;

export function cardsFor(run: { wavesCleared: number; cleared: boolean }, firstClear: boolean): number {
  if (run.wavesCleared < CARD_DROPS.minWaves && !run.cleared) return 0;
  return CARD_DROPS.run + (run.cleared ? CARD_DROPS.clear : 0) + (run.cleared && firstClear ? CARD_DROPS.firstClear : 0);
}

/** A card found at the end of a run: new (it joins at level 1), or one
 *  already held (it pays SCRAP.duplicate instead of a level). */
export interface CardFind {
  id: ArmoryId;
  dup: boolean;
}

/** Find `n` Armory cards at random from every upgrade (the overhaul: a card
 *  is a FIND, not a level). A new one joins `levels` at level 1; one already
 *  held (or found earlier in the same draw) is a duplicate. `pick(k)`
 *  returns an integer in [0, k). */
export function findCards(levels: ArmoryLevels, n: number, pick: (k: number) => number): CardFind[] {
  const found: CardFind[] = [];
  for (let i = 0; i < n; i++) {
    const id = ARMORY_ORDER[pick(ARMORY_ORDER.length)];
    const dup = armoryLevel(levels, id) > 0;
    if (!dup) levels[id] = 1;
    found.push({ id, dup });
  }
  return found;
}

// ---------------------------------------------------------------------------
// Scrap (the overhaul's currency). Earned in every run, won or lost; spent in
// the Armory on the next level of a card you hold.

export const SCRAP = {
  /** A wave cleared, waves 1 to RULES.wavesToClear (10). */
  wave: 40,
  /** A boss round survived (the map's ending, waves 11-13). */
  boss: 50,
  /** Clearing the map. */
  clear: 150,
  /** The first clear of a map, on top. */
  firstClear: 250,
  /** A card found that you already hold. */
  duplicate: 100,
} as const;

/** Scrap to take a card from level `l` to `l + 1` (index = the level now;
 *  level 1 comes with the find). 1750 takes a card from 1 to 5. */
export const LEVEL_COST: readonly number[] = [0, 150, 300, 500, 800];

/** The Scrap for the next level of a card at level `lv`, or null when there
 *  is none to buy (not held, or maxed). */
export function levelCost(id: ArmoryId, lv: number): number | null {
  return lv >= 1 && lv < ARMORY[id].max ? (LEVEL_COST[lv] ?? null) : null;
}

/** What a run's waves pay for: the cleared waves of the map (1 to `waves`,
 *  the map's waves before its ending) and its boss rounds (after `waves`, up
 *  to `last`). Endless waves past the last count for nothing. */
export function scrapTally(history: readonly { wave: number; outcome: string }[], waves: number, last: number): { waves: number; boss: number } {
  let w = 0;
  let b = 0;
  for (const h of history) {
    if (h.outcome !== 'cleared') continue;
    if (h.wave >= 1 && h.wave <= waves) w++;
    else if (h.wave > waves && h.wave <= last) b++;
  }
  return { waves: w, boss: b };
}

/** The Scrap a run earns, line by line. */
export interface ScrapEarned {
  waves: number;
  boss: number;
  clear: number;
  firstClear: number;
  duplicates: number;
  /** Salvage Crews: its share on top of the run's own Scrap (waves, boss
   *  rounds, the clear and a first clear; not a repeat card's, which is
   *  the card's, not the run's). */
  salvage: number;
  total: number;
}

/** `salvageLevel`: the Salvage Crews level the run took (0: none). */
export function scrapFor(t: { waves: number; boss: number }, cleared: boolean, firstClear: boolean, duplicates = 0, salvageLevel = 0): ScrapEarned {
  const e = {
    waves: t.waves * SCRAP.wave,
    boss: t.boss * SCRAP.boss,
    clear: cleared ? SCRAP.clear : 0,
    firstClear: cleared && firstClear ? SCRAP.firstClear : 0,
    duplicates: duplicates * SCRAP.duplicate,
  };
  const share = SALVAGE[Math.max(0, Math.min(ARMORY_MAX, Math.floor(salvageLevel)))] ?? 0;
  const salvage = Math.round((e.waves + e.boss + e.clear + e.firstClear) * share);
  return { ...e, salvage, total: e.waves + e.boss + e.clear + e.firstClear + e.duplicates + salvage };
}

/** Spend `bank` Scrap on levels, a card at a time in `order` (each one as
 *  far as the bank goes before the next). Returns what is left. For the
 *  tools that model a career; in the game the player chooses. */
export function spendScrap(levels: ArmoryLevels, bank: number, order: readonly ArmoryId[]): number {
  for (const id of order) {
    for (;;) {
      const c = levelCost(id, armoryLevel(levels, id));
      if (c === null || bank < c) break;
      bank -= c;
      levels[id] = armoryLevel(levels, id) + 1;
    }
  }
  return bank;
}
