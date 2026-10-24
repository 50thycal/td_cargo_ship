// V2 progress: which maps are unlocked and the best result on each. One small
// localStorage record, separate from every V1 save. Storage can be missing or
// throw (private mode); progress then just lasts for the session.

import { MAP_ORDER, type MapId } from '../data/maps';

export interface Best {
  score: number;
  wave: number;
}

export interface Progress {
  /** How many maps (in MAP_ORDER) are playable. */
  unlocked: number;
  best: Partial<Record<MapId, Best>>;
}

const KEY = 'straitwatch.v2.progress';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Progress;
      return { unlocked: Math.max(1, Math.min(MAP_ORDER.length, p.unlocked || 1)), best: p.best ?? {} };
    }
  } catch {
    // fall through to a fresh record
  }
  return { unlocked: 1, best: {} };
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // storage unavailable — keep playing without persistence
  }
}

/** Fold a finished game into progress. Returns true if it set a new best. */
export function recordResult(p: Progress, map: MapId, score: number, wave: number, cleared: boolean): boolean {
  const prev = p.best[map];
  const better = !prev || score > prev.score;
  if (better) p.best[map] = { score, wave: Math.max(wave, prev?.wave ?? 0) };
  else if (prev) prev.wave = Math.max(prev.wave, wave);
  if (cleared) p.unlocked = Math.max(p.unlocked, Math.min(MAP_ORDER.length, MAP_ORDER.indexOf(map) + 2));
  saveProgress(p);
  return better;
}
