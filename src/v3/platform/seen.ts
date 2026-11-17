// The types the player has met (pause-menu round, the player: "the
// notification system can like be reduced to just notes about new weapon
// types and that should carry over between maps in the campaign mode so
// drones isn't said every time"). An in-run tip card introduces a new type
// (an enemy, an enemy munition, a launcher, a player weapon, a pickup, a
// map's own system) the first time the player meets it, on any map and in
// any mode: the campaign, Free Play and the Test Lab share this one memory.
// Settings → Show tips again clears it.
//
// One small record in the game's storage (platform/store.ts), versioned like
// the progress save (platform/save.ts). Storage can be missing or throw
// (private mode): then every type is new each time, and nothing breaks.

import { kv } from './store';

/** Where the record lives. */
export const SEEN_KEY = 'straitwatch.v3.seen';
/** The list kept before this record (a bare JSON array of tip ids, read
 *  once and converted). */
export const LEGACY_TIPS_KEY = 'straitwatch.v3.tips';
/** The record's version. 1: `{ v, ids }`, ids as `kind:name`. */
export const SEEN_VERSION = 1;

/** A type's id: `threat:drone`, `launcher:sub`, `munition:red`,
 *  `weapon:railgun`, `pickup:shield`, `post:radar`, `map:kesh`,
 *  `ship:supertanker`; and the three first-run how-to tips, `tip:*`. */
export type SeenId = `${'threat' | 'launcher' | 'munition' | 'weapon' | 'pickup' | 'post' | 'map' | 'ship' | 'tip'}:${string}`;

interface SeenRecord {
  v: number;
  ids: string[];
}

/** The legacy list's ids, as this record names them (anything else in it is
 *  dropped: it named nothing a card is still shown for). */
function fromLegacy(old: string): SeenId | null {
  const [kind, name] = old.includes(':') ? [old.slice(0, old.indexOf(':')), old.slice(old.indexOf(':') + 1)] : ['', old];
  if (kind === 'debut' && name) return `threat:${name}`;
  if (kind === 'vector' && name) return `launcher:${name}`;
  if (kind === 'pickup' && name) return `pickup:${name}`;
  if (!kind && name === 'radar') return 'post:radar';
  if (!kind && name === 'MORE SHIPS, MORE POINTS') return 'tip:ships';
  if (!kind && name === 'FORMATIONS') return 'tip:formations';
  return null;
}

function read(): Set<string> {
  const raw = kv.getItem(SEEN_KEY);
  if (raw !== null) {
    try {
      const r = JSON.parse(raw) as Partial<SeenRecord> | null;
      // A newer version's ids are still ids: read them, keep its version.
      const ids = r && typeof r === 'object' && Array.isArray(r.ids) ? r.ids : [];
      return new Set(ids.filter((x): x is string => typeof x === 'string'));
    } catch {
      return new Set();
    }
  }
  // No record yet: an older save's tip list, converted once. A save that had
  // shown any tip has played, so the first-run how-to is not for it.
  const legacy = kv.getItem(LEGACY_TIPS_KEY);
  if (legacy === null) return new Set();
  let old: unknown = [];
  try {
    old = JSON.parse(legacy);
  } catch {
    old = [];
  }
  const list = Array.isArray(old) ? old.filter((x): x is string => typeof x === 'string') : [];
  const ids = new Set<string>();
  for (const o of list) {
    const id = fromLegacy(o);
    if (id) ids.add(id);
  }
  if (list.length) ids.add('tip:basics');
  write(ids);
  kv.removeItem(LEGACY_TIPS_KEY);
  return ids;
}

function write(ids: Set<string>): void {
  const r: SeenRecord = { v: SEEN_VERSION, ids: [...ids].sort() };
  kv.setItem(SEEN_KEY, JSON.stringify(r));
}

/** Every type met so far (empty on a fresh save, or without storage). */
export function seenTypes(): Set<string> {
  try {
    return read();
  } catch {
    return new Set();
  }
}

/** Has the player met this type? */
export function hasSeen(id: SeenId): boolean {
  return seenTypes().has(id);
}

/** Meet a type: true the first time (and remembered), false after. Without
 *  storage it is new every time. */
export function meet(id: SeenId): boolean {
  try {
    const ids = read();
    if (ids.has(id)) return false;
    ids.add(id);
    write(ids);
    return true;
  } catch {
    return true;
  }
}

/** Settings → Show tips again: every type is new again. */
export function clearSeen(): void {
  try {
    kv.removeItem(SEEN_KEY);
    kv.removeItem(LEGACY_TIPS_KEY);
  } catch {
    // nothing stored to clear
  }
}
