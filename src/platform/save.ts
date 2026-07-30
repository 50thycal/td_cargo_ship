// Versioned local saves. localStorage on the web today; the same interface
// backed by iOS-native storage after the Capacitor port. Falls back to an
// in-memory store so the sim layer stays testable in Node.
//
// The roguelite redesign splits persistence into TWO layers, saved under
// separate keys so one can never clobber the other:
//
//   • the Commander Profile — PERMANENT progress (XP, abilities, unlocked
//     regions, records). Survives every defeat and completion.
//   • the active Regional Run — TEMPORARY state for one attempt at one
//     region. Cleared on defeat or completion; clearing it must never touch
//     the profile, which the key separation guarantees structurally.
//
// Forward-compatibility within each layer keeps the old principle: rather than
// discarding a save whose shape is older, missing fields are deep-backfilled
// from a fresh template — existing values (and key order) are preserved, and
// only genuinely-absent fields get defaults.
//
// The PRE-REDESIGN single campaign save ('straitwatch.campaign.v1') is an
// explicit migration boundary: the campaign model changed too substantially to
// translate a mid-campaign save into a regional run honestly (regions,
// commander layer and the draft economy have no pre-image there). The old key
// is left untouched and simply ignored.

import { newCampaign } from '../sim/campaign';
import { newProfile, PROFILE_VERSION, type CommanderProfile } from '../sim/commander';
import type { CampaignState } from '../sim/types';

const RUN_KEY = 'straitwatch.run.v1';
const PROFILE_KEY = 'straitwatch.commander.v1';

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
 *  and save state is always plain JSON. */
function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ---------------------------------------------------------------------------
// The active Regional Run
// ---------------------------------------------------------------------------

/** Bring a parsed (possibly partial) regional run up to the current shape.
 *  Returns null only if the input isn't a usable object. */
export function migrateRun(raw: unknown): CampaignState | null {
  if (!isPlainObject(raw)) return null;
  try {
    const seed = typeof raw.seed === 'string' ? raw.seed : 'restored';
    const template = newCampaign(seed) as unknown as Record<string, unknown>;
    deepBackfill(raw, template);
    // Minimal sanity: a run must have a valid phase to route to.
    const phases = ['prep', 'transit', 'aar', 'draft'];
    if (!phases.includes(raw.phase as string)) raw.phase = 'prep';
    return raw as unknown as CampaignState;
  } catch {
    return null;
  }
}

export function saveRun(c: CampaignState): void {
  try {
    store.setItem(RUN_KEY, JSON.stringify({ v: c.version, run: c }));
  } catch {
    // Quota/serialization failures must never crash the game loop.
  }
}

export function loadRun(): CampaignState | null {
  try {
    const raw = store.getItem(RUN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; run?: unknown };
    if (!parsed || parsed.run === undefined) return null;
    return migrateRun(parsed.run);
  } catch {
    return null;
  }
}

/** Clear ONLY the active run. The Commander Profile is untouched by design —
 *  losing or completing a region must never erase permanent progress. */
export function clearRun(): void {
  try {
    store.removeItem(RUN_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// The Commander Profile
// ---------------------------------------------------------------------------

/** Backfill a parsed profile against a fresh template (same principle as the
 *  run: old profiles heal forward, current ones round-trip untouched). */
export function migrateProfile(raw: unknown): CommanderProfile | null {
  if (!isPlainObject(raw)) return null;
  try {
    const template = newProfile() as unknown as Record<string, unknown>;
    deepBackfill(raw, template);
    raw.version = PROFILE_VERSION;
    return raw as unknown as CommanderProfile;
  } catch {
    return null;
  }
}

export function saveProfile(p: CommanderProfile): void {
  try {
    store.setItem(PROFILE_KEY, JSON.stringify({ v: p.version, profile: p }));
  } catch {
    // ignore
  }
}

export function loadProfile(): CommanderProfile | null {
  try {
    const raw = store.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; profile?: unknown };
    if (!parsed || parsed.profile === undefined) return null;
    return migrateProfile(parsed.profile);
  } catch {
    return null;
  }
}

/** Load the profile, creating (and persisting) a fresh one if none exists.
 *  The game always runs against a real profile object. */
export function loadOrCreateProfile(): CommanderProfile {
  const existing = loadProfile();
  if (existing) return existing;
  const fresh = newProfile();
  saveProfile(fresh);
  return fresh;
}

export function clearProfile(): void {
  try {
    store.removeItem(PROFILE_KEY);
  } catch {
    // ignore
  }
}
