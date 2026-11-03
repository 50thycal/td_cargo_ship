// The App Store build's playtest-log module (vite.config.ts swaps it in for
// playlogStore.ts): same interface, but nothing is kept, sent or downloaded.
// The store build collects no data (App Privacy: Data Not Collected).

import type { PlayLog } from '../sim/playlog';

export type UploadState = 'sent' | 'local-only' | 'failed';
export type Channel = 'artifact' | 'server' | null;
export const DB_COLLECTION = 'playtests';

export async function logChannel(): Promise<Channel> {
  return null;
}

export function localLogs(): PlayLog[] {
  return [];
}

export function fitForDb(log: PlayLog): PlayLog & { truncated?: boolean } {
  return log;
}

export async function storeLog(_log: PlayLog): Promise<UploadState> {
  return 'local-only';
}

export async function flushUnsent(): Promise<number> {
  return 0;
}

export function downloadLog(_log: PlayLog): void {
  // nothing leaves the app
}
