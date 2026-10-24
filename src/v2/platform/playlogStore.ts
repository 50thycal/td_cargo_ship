// Where playtest logs go. Always: the last few on this device. When the game
// runs as a Claude artifact with the `db` capability: the artifact's shared
// database too, which Claude can read directly — no copy-paste. Elsewhere
// (the Vercel build): a "Download log" button on the result screen.

import type { PlayLog } from '../sim/playlog';

const LOCAL_KEY = 'straitwatch.v2.playlogs';
const SENT_KEY = 'straitwatch.v2.playlogs.sent';
const KEEP = 10;
/** The db caps a document at 256 KiB; leave headroom. */
const MAX_DOC_BYTES = 240 * 1024;
export const DB_COLLECTION = 'playtests';

export type UploadState = 'sent' | 'local-only' | 'failed';

interface DbDoc {
  set(data: unknown): Promise<unknown>;
}
interface Db {
  collection(path: string): { doc(id: string): DbDoc };
}

let dbPromise: Promise<Db | null> | null = null;

/** The artifact db, or null when not running as an artifact (or not granted). */
function artifactDb(): Promise<Db | null> {
  if (!dbPromise) {
    const claude = (window as unknown as { claude?: { use(name: string): Promise<unknown> } }).claude;
    dbPromise = claude?.use ? claude.use('db').then((d) => (d as Db | null) ?? null, () => null) : Promise.resolve(null);
  }
  return dbPromise;
}

export async function canSendToClaude(): Promise<boolean> {
  return (await artifactDb()) !== null;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable: the log still goes to the db if it can
  }
}

export function localLogs(): PlayLog[] {
  return readJson<PlayLog[]>(LOCAL_KEY, []);
}

/** A log small enough for one db document: the full input list if it fits,
 *  otherwise the summary alone (flagged, so replay knows it can't). */
export function fitForDb(log: PlayLog): PlayLog & { truncated?: boolean } {
  if (JSON.stringify(log).length <= MAX_DOC_BYTES) return log;
  return { ...log, commands: [], truncated: true };
}

async function send(log: PlayLog): Promise<boolean> {
  const db = await artifactDb();
  if (!db) return false;
  try {
    await db.collection(DB_COLLECTION).doc(log.id).set(fitForDb(log));
    const sent = readJson<string[]>(SENT_KEY, []);
    writeJson(SENT_KEY, [...sent.filter((id) => id !== log.id), log.id].slice(-50));
    return true;
  } catch {
    return false;
  }
}

/** Keep the log on the device and send it on if this build can. */
export async function storeLog(log: PlayLog): Promise<UploadState> {
  writeJson(LOCAL_KEY, [...localLogs().filter((l) => l.id !== log.id), log].slice(-KEEP));
  if (!(await artifactDb())) return 'local-only';
  return (await send(log)) ? 'sent' : 'failed';
}

/** On start-up, retry any kept log that never made it to the db. */
export async function flushUnsent(): Promise<number> {
  if (!(await artifactDb())) return 0;
  const sent = new Set(readJson<string[]>(SENT_KEY, []));
  let n = 0;
  for (const log of localLogs()) if (!sent.has(log.id) && (await send(log))) n++;
  return n;
}

export function downloadLog(log: PlayLog): void {
  const blob = new Blob([JSON.stringify(log)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `straitwatch-${log.map}-${log.id}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
