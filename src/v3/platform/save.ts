// V3 progress: which maps are unlocked, the best result on each, and the
// Armory — the cards found and the level each has reached, the Scrap banked
// to buy more levels, and the one upgrade equipped from each bay for the
// next run (playtest: "the player should only be allowed to select one…
// they don't get all of them"; round 7 made that one per bay; the Armory
// overhaul made levels bought with Scrap). One small localStorage record,
// separate from every V1 and V2 save. Storage can be missing or throw
// (private mode); progress then just lasts for the session.

import {
  ARMORY,
  ARMORY_ORDER,
  BAY_ORDER,
  armoryLevel,
  bayItems,
  cardsFor,
  findCards,
  levelCost,
  scrapFor,
  type ArmoryId,
  type ArmoryLevels,
  type BayId,
  type CardFind,
  type ScrapEarned,
} from '../data/armory';
import { RULES } from '../data/config';
import { MAP_ORDER, OLD_ORDER, type MapId } from '../data/maps';
import { kv } from './store';

export interface Best {
  score: number;
  wave: number;
}

export interface Progress {
  /** How many maps (in MAP_ORDER) are playable. */
  unlocked: number;
  best: Partial<Record<MapId, Best>>;
  /** Armory cards found over every run, new or not (for the record). */
  cards: number;
  /** Each upgrade's level: 1 when its card is found, then bought with Scrap. */
  armory: ArmoryLevels;
  /** The one upgrade a run takes from each bay (null: none; the base gun). */
  equipped: Record<BayId, ArmoryId | null>;
  /** Maps cleared at least once (the first clear pays a bonus). */
  cleared: MapId[];
  /** Which Armory the levels belong to (ARMORY_VERSION). */
  armoryV: number;
  /** Scrap banked, to spend on levels in the Armory. */
  scrap: number;
  /** Scrap earned over every run (for the record). */
  scrapEarned: number;
  /** Maps playable out of turn: ones a save from before the 20-map order had
   *  unlocked (the order changed, so its count no longer names them). */
  open?: MapId[];
  /** Which map order `unlocked` counts in (MAPS_VERSION). */
  mapsV?: number;
}

/** The map order's save version. 2: the 20-map plan's order. A save from
 *  before it counted unlocks in the old five-map order: every map it had
 *  open stays open, and the new count runs up the new order as far as the
 *  maps already cleared go. */
export const MAPS_VERSION = 2;

/** Can this map be played yet? */
export function isUnlocked(p: Progress, id: MapId): boolean {
  return MAP_ORDER.indexOf(id) < p.unlocked || (p.open ?? []).includes(id);
}

const KEY = 'straitwatch.v3.progress';

/** The Armory's save version.
 *  2: upgrades are cards won after a run (round 7). A save from before it
 *     holds levels bought with salvage, which the player asked to clear
 *     ("reset my armory as it has unlocks from the old"): its Armory loads
 *     empty, once; maps and bests are kept.
 *  3: the overhaul: Scrap, and Deep Magazine in the Supply bay. A version 2
 *     save keeps every level and starts with 0 Scrap (the player's call);
 *     a Deep Magazine equipped in the Gun bay moves to Supply if that bay is
 *     free, and an emptied Gun bay takes the best gun card held. */
export const ARMORY_VERSION = 3;

function fresh(): Progress {
  return { unlocked: 1, best: {}, cards: 0, armory: {}, equipped: noneEquipped(), cleared: [], armoryV: ARMORY_VERSION, scrap: 0, scrapEarned: 0, open: [], mapsV: MAPS_VERSION };
}

function noneEquipped(): Record<BayId, ArmoryId | null> {
  return { gun: null, hull: null, supply: null };
}

/** A whole number of Scrap, 0 or more (anything else in a save reads as 0). */
function scrapOf(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0;
}

export function loadProgress(): Progress {
  try {
    const raw = kv.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>;
      // Version 2 (round 7's cards) and 3 keep their levels; older ones don't.
      const v = typeof p.armoryV === 'number' ? p.armoryV : 0;
      const keep = v >= 2;
      const armory: ArmoryLevels = {};
      if (keep) for (const id of ARMORY_ORDER) armory[id] = armoryLevel(p.armory ?? {}, id);
      const cleared = (p.cleared ?? []).filter((m) => MAP_ORDER.includes(m));
      const oldMaps = p.mapsV !== MAPS_VERSION;
      let unlocked = Math.max(1, Math.min(MAP_ORDER.length, p.unlocked || 1));
      let open = (p.open ?? []).filter((m) => MAP_ORDER.includes(m));
      if (oldMaps) {
        open = OLD_ORDER.slice(0, Math.max(1, Math.min(OLD_ORDER.length, p.unlocked || 1)));
        let run = 0;
        while (run < MAP_ORDER.length && cleared.includes(MAP_ORDER[run])) run++;
        unlocked = Math.min(MAP_ORDER.length, run + 1);
      }
      const equipped = readEquipped(keep ? p.equipped : null, armory);
      if (keep && v < 3) refitBays(equipped, p.equipped, armory);
      const current = v === ARMORY_VERSION;
      const loaded: Progress = {
        unlocked,
        best: p.best ?? {},
        cards: keep ? Math.max(0, Math.floor(p.cards ?? 0)) : 0,
        armory,
        equipped,
        cleared,
        armoryV: ARMORY_VERSION,
        scrap: current ? scrapOf(p.scrap) : 0,
        scrapEarned: current ? scrapOf(p.scrapEarned) : 0,
        open,
        mapsV: MAPS_VERSION,
      };
      // An old Armory or map order is converted for good, not on every load.
      if (!current || oldMaps) saveProgress(loaded);
      return loaded;
    }
  } catch {
    // fall through to a fresh record
  }
  return fresh();
}

/** The equipped upgrades from a save: only an upgrade with a level, in its
 *  own bay, counts (a card a save had in another bay goes to its own bay,
 *  unless that bay names its own card). */
function readEquipped(raw: unknown, armory: ArmoryLevels): Record<BayId, ArmoryId | null> {
  const eq = noneEquipped();
  const own: Partial<Record<BayId, boolean>> = {};
  const entries: [string, unknown][] = raw && typeof raw === 'object' ? Object.entries(raw) : [];
  for (const [bay, id] of entries) {
    if (typeof id !== 'string' || !(id in ARMORY) || armoryLevel(armory, id as ArmoryId) <= 0) continue;
    const home = ARMORY[id as ArmoryId].bay;
    const mine = bay === home;
    if (own[home] && !mine) continue;
    eq[home] = id as ArmoryId;
    if (mine) own[home] = true;
  }
  return eq;
}

/** The overhaul moved Deep Magazine from the Gun bay to Supply: a version 2
 *  save that had it in the Gun bay would find that bay empty. Give the Gun
 *  bay the best gun card held instead (no loadout gets weaker by the move,
 *  beyond the bay rule itself). */
function refitBays(eq: Record<BayId, ArmoryId | null>, raw: unknown, armory: ArmoryLevels): void {
  const was = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  for (const bay of BAY_ORDER) {
    if (eq[bay] || !was[bay]) continue;
    const best = bayItems(bay)
      .filter((id) => armoryLevel(armory, id) > 0)
      .sort((a, b) => armoryLevel(armory, b) - armoryLevel(armory, a))[0];
    if (best) eq[bay] = best;
  }
}

export function saveProgress(p: Progress): void {
  try {
    kv.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage unavailable — keep playing without persistence
  }
}

export interface RunResult {
  best: boolean;
  /** The Armory cards this run found, in order: new ones join at level 1, a
   *  card already held pays Scrap. */
  cards: CardFind[];
  firstClear: boolean;
  /** The Scrap this run banked, line by line. */
  scrap: ScrapEarned;
}

/** Fold a finished game into progress: records, unlocks, the Scrap it
 *  earned (won or lost: all of it is kept), and the Armory cards it found
 *  (at random: the player doesn't choose them). `run.waves` / `run.boss`:
 *  the map's waves and boss rounds cleared (scrapTally); `run.paid`: the
 *  run's waves were banked already (a cleared map played on into endless
 *  is recorded again when it ends: only its new cards count then).
 *  `pick(k)` returns an integer in [0, k). */
export function recordResult(
  p: Progress,
  map: MapId,
  run: { score: number; wave: number; cleared: boolean; wavesCleared: number; waves?: number; boss?: number; paid?: boolean },
  pick: (k: number) => number = (k) => Math.floor(Math.random() * k),
): RunResult {
  const prev = p.best[map];
  // A best has to beat something: a first run that scored nothing isn't one.
  const better = run.score > (prev?.score ?? 0);
  if (better || !prev) p.best[map] = { score: Math.max(run.score, prev?.score ?? 0), wave: Math.max(run.wave, prev?.wave ?? 0) };
  else prev.wave = Math.max(prev.wave, run.wave);
  const firstClear = run.cleared && !p.cleared.includes(map);
  if (run.cleared) {
    p.unlocked = Math.max(p.unlocked, Math.min(MAP_ORDER.length, MAP_ORDER.indexOf(map) + 2));
    if (firstClear) p.cleared.push(map);
  }
  const cards = findCards(p.armory, cardsFor(run, firstClear), pick);
  p.cards += cards.length;
  // A first card in a bay with nothing equipped goes straight in.
  for (const c of cards) if (!c.dup && !p.equipped[ARMORY[c.id].bay]) p.equipped[ARMORY[c.id].bay] = c.id;
  const tally = run.paid ? { waves: 0, boss: 0 } : { waves: run.waves ?? Math.min(run.wavesCleared, RULES.wavesToClear), boss: run.boss ?? 0 };
  const scrap = scrapFor(tally, run.cleared && !run.paid, firstClear, cards.filter((c) => c.dup).length);
  p.scrap = scrapOf(p.scrap) + scrap.total;
  p.scrapEarned = scrapOf(p.scrapEarned) + scrap.total;
  saveProgress(p);
  return { best: better, cards, firstClear, scrap };
}

/** Buy the next level of a card held, if the Scrap is banked. */
export function levelUp(p: Progress, id: ArmoryId): boolean {
  const cost = levelCost(id, armoryLevel(p.armory, id));
  if (cost === null || p.scrap < cost) return false;
  p.scrap -= cost;
  p.armory[id] = armoryLevel(p.armory, id) + 1;
  saveProgress(p);
  return true;
}

/** Equip one upgrade for the next run, in its bay; or clear a bay (null).
 *  Only one with a level (a card found) can be equipped. */
export function equipArmory(p: Progress, id: ArmoryId | null, bay: BayId = id ? ARMORY[id].bay : 'gun'): boolean {
  if (id !== null && (armoryLevel(p.armory, id) <= 0 || ARMORY[id].bay !== bay)) return false;
  p.equipped[bay] = id;
  saveProgress(p);
  return true;
}

/** What a run takes: the equipped upgrade from each bay, at its level,
 *  nothing else. */
export function runLoadout(p: Progress): ArmoryLevels {
  const a: ArmoryLevels = {};
  for (const bay of BAY_ORDER) {
    const id = p.equipped[bay];
    if (id) a[id] = armoryLevel(p.armory, id);
  }
  return a;
}
