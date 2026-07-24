// Versioned local save. localStorage on the web today; the same interface
// backed by iOS-native storage after the Capacitor port. Falls back to an
// in-memory store so the sim layer stays testable in Node.
//
// Forward-compatibility is the priority: as the game iterates and CampaignState
// grows new fields, an OLD save must still load and be playable. Rather than
// discarding a save whose version doesn't match, we deep-backfill any missing
// fields from a fresh campaign template — existing values (and their key order)
// are preserved, and only genuinely-absent fields get defaults. That keeps
// current saves byte-identical on round-trip while healing older ones.

import { newCampaign, SAVE_VERSION } from '../sim/campaign';
import type { CampaignState } from '../sim/types';

const KEY = 'straitwatch.campaign.v1';

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const store: KeyValueStore =
  typeof localStorage !== 'undefined' ? localStorage : memoryStore();

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Recursively fill any keys present in `template` but missing from `target`,
 *  leaving every existing value (and key order) untouched. Arrays and null are
 *  treated as leaves — never merged into. Mutates and returns `target`. */
function deepBackfill(
  target: Record<string, unknown>,
  template: Record<string, unknown>,
): Record<string, unknown> {
  for (const key of Object.keys(template)) {
    const tv = template[key];
    if (target[key] === undefined) {
      // Clone template defaults so distinct saves never share nested references.
      target[key] = isPlainObject(tv) || Array.isArray(tv) ? structuredCloneSafe(tv) : tv;
    } else if (isPlainObject(target[key]) && isPlainObject(tv)) {
      deepBackfill(target[key] as Record<string, unknown>, tv);
    }
  }
  return target;
}

/** JSON round-trip clone — structuredClone may be unavailable in some runtimes,
 *  and campaign state is always plain JSON. */
function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Bring a parsed (possibly older-version, possibly partial) campaign up to the
 *  current shape. Returns null only if the input isn't a usable object. */
export function migrateCampaign(raw: unknown): CampaignState | null {
  if (!isPlainObject(raw)) return null;
  try {
    const seed = typeof raw.seed === 'string' ? raw.seed : 'restored';
    const template = newCampaign(seed) as unknown as Record<string, unknown>;
    deepBackfill(raw, template);
    raw.version = SAVE_VERSION;
    // Minimal sanity: a campaign must have a valid phase to route to.
    const phases = ['prep', 'transit', 'aar', 'research'];
    if (!phases.includes(raw.phase as string)) raw.phase = 'prep';
    return raw as unknown as CampaignState;
  } catch {
    return null;
  }
}

export function saveCampaign(c: CampaignState): void {
  try {
    store.setItem(KEY, JSON.stringify({ v: SAVE_VERSION, campaign: c }));
  } catch {
    // Quota/serialization failures must never crash the game loop.
  }
}

export function loadCampaign(): CampaignState | null {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; campaign?: unknown };
    if (!parsed || parsed.campaign === undefined) return null;
    // Migrate rather than reject on version mismatch — old saves stay playable.
    return migrateCampaign(parsed.campaign);
  } catch {
    return null;
  }
}

export function clearCampaign(): void {
  try {
    store.removeItem(KEY);
  } catch {
    // ignore
  }
}
