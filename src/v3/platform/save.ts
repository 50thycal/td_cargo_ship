// V3 progress: which maps are unlocked, the best result on each, and the
// Armory — the salvage banked, the bays opened and the levels bought with
// it, and the one upgrade equipped from each bay for the next run (playtest:
// "the player should only be allowed to select one… they don't get all of
// them"; round 7 made that one per bay). One
// small localStorage record, separate from every V1 and V2 save. Storage can
// be missing or throw (private mode); progress then just lasts for the session.

import { ARMORY, ARMORY_ORDER, BAY_ORDER, BAYS, armoryLevel, nextCost, salvageFor, type ArmoryId, type ArmoryLevels, type BayId } from '../data/armory';
import { MAP_ORDER, type MapId } from '../data/maps';

export interface Best {
  score: number;
  wave: number;
}

export interface Progress {
  /** How many maps (in MAP_ORDER) are playable. */
  unlocked: number;
  best: Partial<Record<MapId, Best>>;
  /** Salvage banked, not yet spent. */
  salvage: number;
  /** Salvage earned over every run (for the record). */
  earned: number;
  armory: ArmoryLevels;
  /** Bays opened (the Gun bay is always open). */
  bays: BayId[];
  /** The one upgrade a run takes from each bay (null: none; the base gun). */
  equipped: Record<BayId, ArmoryId | null>;
  /** Maps cleared at least once (the first clear pays a bonus). */
  cleared: MapId[];
}

const KEY = 'straitwatch.v3.progress';

function fresh(): Progress {
  return { unlocked: 1, best: {}, salvage: 0, earned: 0, armory: {}, bays: ['gun'], equipped: noneEquipped(), cleared: [] };
}

function noneEquipped(): Record<BayId, ArmoryId | null> {
  return { gun: null, hull: null, supply: null };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>;
      const armory: ArmoryLevels = {};
      for (const id of ARMORY_ORDER) armory[id] = armoryLevel(p.armory ?? {}, id);
      return {
        unlocked: Math.max(1, Math.min(MAP_ORDER.length, p.unlocked || 1)),
        best: p.best ?? {},
        salvage: Math.max(0, Math.floor(p.salvage ?? 0)),
        earned: Math.max(0, Math.floor(p.earned ?? 0)),
        armory,
        bays: BAY_ORDER.filter((b) => b === 'gun' || (p.bays ?? []).includes(b)),
        equipped: readEquipped(p.equipped, armory),
        cleared: (p.cleared ?? []).filter((m) => MAP_ORDER.includes(m)),
      };
    }
  } catch {
    // fall through to a fresh record
  }
  return fresh();
}

/** The equipped upgrades from a save. Before round 7 it was one gun
 *  upgrade (a string); only an upgrade with a level, in its own bay, counts. */
function readEquipped(raw: unknown, armory: ArmoryLevels): Record<BayId, ArmoryId | null> {
  const eq = noneEquipped();
  const ids: unknown[] = typeof raw === 'string' ? [raw] : raw && typeof raw === 'object' ? Object.values(raw) : [];
  for (const id of ids) {
    if (typeof id === 'string' && id in ARMORY && armoryLevel(armory, id as ArmoryId) > 0) eq[ARMORY[id as ArmoryId].bay] = id as ArmoryId;
  }
  return eq;
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage unavailable — keep playing without persistence
  }
}

export interface RunResult {
  best: boolean;
  /** Salvage this run paid. */
  salvage: number;
  firstClear: boolean;
}

/** Fold a finished game into progress: records, unlocks and the salvage it
 *  earned. */
export function recordResult(
  p: Progress,
  map: MapId,
  run: { score: number; wave: number; cleared: boolean; delivered: number; wavesCleared: number },
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
  const salvage = salvageFor(run, firstClear);
  p.salvage += salvage;
  p.earned += salvage;
  saveProgress(p);
  return { best: better, salvage, firstClear };
}

/** Open a bay for its salvage. False if it is open or too dear. */
export function openBay(p: Progress, bay: BayId): boolean {
  if (p.bays.includes(bay) || BAYS[bay].cost > p.salvage) return false;
  p.salvage -= BAYS[bay].cost;
  p.bays = BAY_ORDER.filter((b) => b === bay || p.bays.includes(b));
  saveProgress(p);
  return true;
}

/** Buy the next level of one Armory upgrade. False if its bay is shut, or
 *  it is maxed or too dear. */
export function buyArmory(p: Progress, id: ArmoryId): boolean {
  const bay = ARMORY[id].bay;
  const cost = nextCost(p.armory, id);
  if (!p.bays.includes(bay) || cost === null || cost > p.salvage) return false;
  p.salvage -= cost;
  p.armory[id] = armoryLevel(p.armory, id) + 1;
  // The first upgrade bought in a bay is equipped at once (nothing to choose yet).
  if (!p.equipped[bay]) p.equipped[bay] = id;
  saveProgress(p);
  return true;
}

/** Equip one upgrade for the next run, in its bay; or clear a bay (null).
 *  Only one with a level can be equipped. */
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
    if (id && p.bays.includes(bay)) a[id] = armoryLevel(p.armory, id);
  }
  return a;
}
