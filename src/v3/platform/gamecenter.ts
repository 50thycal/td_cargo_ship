// Game Center: one leaderboard per map (best score) and a few achievements.
// The native backend is the app's own GameCenter plugin
// (ios/App/App/GameCenterPlugin.swift), registered by platform/native.ts.
// On the web, and until the player is signed in, every call is a no-op.

import { MAP_ORDER, type MapId } from '../data/maps';

/** Leaderboard id for a map. App Store Connect ids must match these. */
export function leaderboardId(map: MapId): string {
  return `straitwatch.best.${map}`;
}

export const ACHIEVEMENTS = {
  firstClear: { id: 'straitwatch.ach.first_clear', name: 'Convoy Through', text: 'Clear your first map.' },
  chapter1: { id: 'straitwatch.ach.chapter1', name: 'Home Waters Secured', text: 'Clear every map in Home Waters.' },
  chapter2: { id: 'straitwatch.ach.chapter2', name: 'The Narrows Held', text: 'Clear every map in The Narrows.' },
  chapter3: { id: 'straitwatch.ach.chapter3', name: 'Dark Water Crossed', text: 'Clear every map in Dark Water.' },
  chapter4: { id: 'straitwatch.ach.chapter4', name: 'Open War Won', text: 'Clear every map in Open War.' },
  armory10: { id: 'straitwatch.ach.armory10', name: 'Quartermaster', text: 'Win 10 Armory cards.' },
  endless20: { id: 'straitwatch.ach.endless20', name: 'Long Watch', text: 'Reach wave 20 in Endless mode.' },
} as const;
export type AchievementKey = keyof typeof ACHIEVEMENTS;

export interface GameCenterBackend {
  authenticate(): Promise<boolean>;
  submitScore(leaderboardId: string, score: number): Promise<void>;
  reportAchievement(id: string, percent: number): Promise<void>;
  showDashboard(): Promise<void>;
}

let backend: GameCenterBackend | null = null;
let signedIn = false;

export async function setGameCenterBackend(b: GameCenterBackend | null): Promise<void> {
  backend = b;
  signedIn = false;
  if (b) signedIn = await b.authenticate().catch(() => false);
}

export function gameCenterAvailable(): boolean {
  return backend !== null && signedIn;
}

export function submitBest(map: MapId, score: number): void {
  if (!backend || !signedIn || !(score > 0)) return;
  void backend.submitScore(leaderboardId(map), Math.floor(score)).catch(() => undefined);
}

export function unlock(key: AchievementKey): void {
  if (!backend || !signedIn) return;
  void backend.reportAchievement(ACHIEVEMENTS[key].id, 100).catch(() => undefined);
}

export function showGameCenter(): void {
  if (backend && signedIn) void backend.showDashboard().catch(() => undefined);
}

/** The achievements a save has earned (re-reported each time: Game Center
 *  ignores repeats, and this backfills ones earned before sign-in). */
export function earned(p: { cleared: MapId[]; cards: number }, endlessWave = 0): AchievementKey[] {
  const out: AchievementKey[] = [];
  if (p.cleared.length > 0) out.push('firstClear');
  for (let c = 1; c <= 4; c++) {
    const maps = MAP_ORDER.slice((c - 1) * 5, c * 5);
    if (maps.every((m) => p.cleared.includes(m))) out.push(`chapter${c}` as AchievementKey);
  }
  if (p.cards >= 10) out.push('armory10');
  if (endlessWave >= 20) out.push('endless20');
  return out;
}

/** Tests. */
export function _resetGameCenterForTests(): void {
  backend = null;
  signedIn = false;
}
