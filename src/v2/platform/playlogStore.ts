// Where playtest logs go. Always: the last few on this device. Then, so Claude
// can read them directly with no copy-paste:
//   - as a Claude artifact with the `db` capability: the artifact's database;
//   - on the Vercel build: POST /api/playlog (api/playlog.ts → Vercel Blob).
// Anything that doesn't get through is resent on the next launch. Local dev
// has neither, so the result screen offers "Download log" instead.

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

/** Vercel serves api/playlog.ts next to the game; dev servers don't. */
function onVercel(): boolean {
  return location.protocol === 'https:' && location.hostname.endsWith('.vercel.app');
}

export type Channel = 'artifact' | 'server' | null;

export async function logChannel(): Promise<Channel> {
  if (await artifactDb()) return 'artifact';
  return onVercel() ? 'server' : null;
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

/** A run is saved several times (after each wave, then at the end) under one
 *  id; what was delivered is that id at a given step count. */
const sentKey = (log: PlayLog): string => `${log.id}@${log.summary?.steps ?? 0}`;

async function post(log: PlayLog): Promise<boolean> {
  const body = JSON.stringify(log);
  const res = await fetch('/api/playlog', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    // Lets a send started as the page closes finish; browsers cap it at 64 KiB.
    keepalive: body.length < 60_000,
  });
  return res.ok;
}

async function send(log: PlayLog): Promise<boolean> {
  const db = await artifactDb();
  if (!db && !onVercel()) return false;
  try {
    if (db) await db.collection(DB_COLLECTION).doc(log.id).set(fitForDb(log));
    else if (!(await post(log))) return false;
    const sent = readJson<string[]>(SENT_KEY, []);
    writeJson(SENT_KEY, [...sent.filter((k) => !k.startsWith(`${log.id}@`)), sentKey(log)].slice(-50));
    return true;
  } catch {
    return false;
  }
}

/** Keep the log on the device and send it on if this build can. */
export async function storeLog(log: PlayLog): Promise<UploadState> {
  writeJson(LOCAL_KEY, [...localLogs().filter((l) => l.id !== log.id), log].slice(-KEEP));
  if (!(await logChannel())) return 'local-only';
  return (await send(log)) ? 'sent' : 'failed';
}

/** On start-up, retry any kept log that never made it to Claude. */
export async function flushUnsent(): Promise<number> {
  if (!(await logChannel())) return 0;
  const sent = new Set(readJson<string[]>(SENT_KEY, []));
  let n = 0;
  for (const log of localLogs()) if (!sent.has(sentKey(log)) && (await send(log))) n++;
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
