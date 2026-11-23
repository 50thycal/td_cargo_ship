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
import { FIRST_REGION } from '../data/regions';
import { newProfile, PROFILE_VERSION, type CommanderProfile } from '../sim/commander';
import type { CampaignState } from '../sim/types';

const RUN_KEY = 'straitwatch.run.v1';
/** Region Workshop playtests live in their OWN slot so a designer's test run
 *  can never overwrite the player's campaign save. */
const WORKSHOP_RUN_KEY = 'straitwatch.workshopRun.v1';
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
    // NOTE: the used-escort-name ledger is deliberately NOT reconciled here.
    // Rewriting it to include the ships currently afloat was tried, and it
    // costs more than it buys: healing must leave a current-format save byte
    // for byte identical, or a run starts behaving differently purely for
    // having been saved and loaded. The guarantee it was reaching for is
    // enforced at the point names are ISSUED instead — nextEscortName unions
    // the ledger with the names of every escort afloat, so a restored save can
    // never hand out a name that is already in service. The only thing an
    // upgraded save cannot know is the name of a ship lost before it upgraded.
    return raw as unknown as CampaignState;
  } catch {
    return null;
  }
}

export function saveRun(c: CampaignState): void {
  try {
    store.setItem(c.workshop ? WORKSHOP_RUN_KEY : RUN_KEY, JSON.stringify({ v: c.version, run: c }));
  } catch {
    // Quota/serialization failures must never crash the game loop.
  }
}

export function loadRun(): CampaignState | null {
  return loadRunFrom(RUN_KEY);
}

/** The saved Region Workshop playtest, if one is in progress. */
export function loadWorkshopRun(): CampaignState | null {
  return loadRunFrom(WORKSHOP_RUN_KEY);
}

export function clearWorkshopRun(): void {
  try {
    store.removeItem(WORKSHOP_RUN_KEY);
  } catch {
    // ignore
  }
}

function loadRunFrom(key: string): CampaignState | null {
  try {
    const raw = store.getItem(key);
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
    // The opening region is ALWAYS available, whatever the profile remembers.
    //
    // `deepBackfill` fills absent fields; it cannot repair a present-but-stale
    // one. A profile saved before the ladder was reordered holds the region
    // that used to open it, so without this a returning player finds the
    // game's FIRST region locked and no way to unlock it — the only region
    // whose unlock has no prerequisite is the one nothing grants. Cheap to
    // assert, and it is an invariant of the ladder rather than a one-off
    // patch for this particular reorder.
    const unlocked = raw.unlockedRegions;
    if (Array.isArray(unlocked)) {
      if (!unlocked.includes(FIRST_REGION)) unlocked.unshift(FIRST_REGION);
    } else {
      raw.unlockedRegions = [FIRST_REGION];
    }
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
