// V3 progress: which maps are unlocked, the best result on each, and the
// Armory — the salvage banked and the main-gun levels bought with it. One
// small localStorage record, separate from every V1 and V2 save. Storage can
// be missing or throw (private mode); progress then just lasts for the session.

import { ARMORY_ORDER, armoryLevel, nextCost, salvageFor, type ArmoryId, type ArmoryLevels } from '../data/armory';
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
  /** Maps cleared at least once (the first clear pays a bonus). */
  cleared: MapId[];
}

const KEY = 'straitwatch.v3.progress';

function fresh(): Progress {
  return { unlocked: 1, best: {}, salvage: 0, earned: 0, armory: {}, cleared: [] };
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
        cleared: (p.cleared ?? []).filter((m) => MAP_ORDER.includes(m)),
      };
    }
  } catch {
    // fall through to a fresh record
  }
  return fresh();
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

/** Buy the next level of one Armory upgrade. False if maxed or too dear. */
export function buyArmory(p: Progress, id: ArmoryId): boolean {
  const cost = nextCost(p.armory, id);
  if (cost === null || cost > p.salvage) return false;
  p.salvage -= cost;
  p.armory[id] = armoryLevel(p.armory, id) + 1;
  saveProgress(p);
  return true;
}
