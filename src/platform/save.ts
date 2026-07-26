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
import {
  MODULE_MIGRATION,
  MODULE_MIGRATION_RESEARCH,
  RESEARCH_INDEX,
  RESEARCH_MIGRATION,
} from '../data/counters';
import { SHIP_CLASSES } from '../data/defs';
import type { CampaignState, ModuleId, ShipClassId } from '../sim/types';

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

/** Deterministic legacy translation (save v2 → v3): the old 10-entry linear
 *  research tree and the pointDefense module map into the counter catalogue.
 *  Runs BEFORE deepBackfill so translated fields are preserved, not clobbered.
 *  Value-preserving by construction:
 *   • every old research id expands to the counter node(s) that reproduce its
 *    effect (RESEARCH_MIGRATION);
 *   • pointDefense → selfDefense module (same slot, same paid price);
 *   • an equipped module implies its base node (the old purchase carried the
 *    capability), so equipment keeps working (MODULE_MIGRATION_RESEARCH);
 *   • old mine-warfare research fits the escort drone launcher for free (it
 *    was previously implicit in the research);
 *   • old fleet-wide compartmentalization research equips the module where a
 *    class has a free slot (research progress itself is always kept). */
function migrateLegacyFields(raw: Record<string, unknown>): void {
  const legacyResearch = Array.isArray(raw.completedResearch)
    ? (raw.completedResearch as string[])
    : [];
  const isLegacy =
    legacyResearch.some((id) => RESEARCH_MIGRATION[id] !== undefined) ||
    (isPlainObject(raw.classModules) &&
      Object.values(raw.classModules as Record<string, unknown>).some(
        (mods) => Array.isArray(mods) && mods.includes('pointDefense'),
      ));

  // --- Research ids ---------------------------------------------------------
  const mapped = new Set<string>();
  for (const id of legacyResearch) {
    for (const nid of RESEARCH_MIGRATION[id] ?? (RESEARCH_INDEX[id] ? [id] : [])) {
      mapped.add(nid);
    }
  }
  // An in-flight legacy project was already paid for — grant its mapped nodes
  // outright rather than losing the secondary entries.
  const active = raw.activeResearch as { id?: string } | null | undefined;
  if (active && typeof active.id === 'string' && RESEARCH_MIGRATION[active.id]) {
    for (const nid of RESEARCH_MIGRATION[active.id]) mapped.add(nid);
    raw.activeResearch = null;
  }

  // --- Modules --------------------------------------------------------------
  if (isPlainObject(raw.classModules)) {
    const classModules = raw.classModules as Record<string, unknown>;
    for (const classId of Object.keys(classModules)) {
      const mods = classModules[classId];
      if (!Array.isArray(mods)) continue;
      classModules[classId] = mods.map((m) => MODULE_MIGRATION[m as string] ?? m);
      for (const m of classModules[classId] as ModuleId[]) {
        for (const nid of MODULE_MIGRATION_RESEARCH[m] ?? []) mapped.add(nid);
      }
    }
  }
  if (isPlainObject(raw.modulePaid)) {
    const modulePaid = raw.modulePaid as Record<string, Record<string, number>>;
    for (const classId of Object.keys(modulePaid)) {
      const paid = modulePaid[classId];
      if (!isPlainObject(paid)) continue;
      for (const [oldId, newId] of Object.entries(MODULE_MIGRATION)) {
        if (oldId !== newId && paid[oldId] !== undefined) {
          paid[newId] = paid[oldId];
          delete paid[oldId];
        }
      }
    }
  }

  // --- Equipment implied by legacy research ---------------------------------
  if (legacyResearch.includes('mines1')) {
    const escortModules = Array.isArray(raw.escortModules) ? (raw.escortModules as string[]) : [];
    if (!escortModules.includes('mcmDroneLauncher')) escortModules.push('mcmDroneLauncher');
    raw.escortModules = escortModules;
  }
  if (legacyResearch.includes('resilience1') && isPlainObject(raw.classModules)) {
    const classModules = raw.classModules as Record<string, ModuleId[]>;
    for (const classId of Object.keys(classModules) as ShipClassId[]) {
      const slots = SHIP_CLASSES[classId]?.slots ?? 0;
      const mods = classModules[classId];
      if (Array.isArray(mods) && mods.length < slots && !mods.includes('compartmentalization')) {
        mods.push('compartmentalization');
      }
    }
  }

  if (isLegacy || mapped.size > 0) {
    // Keep any already-new ids, drop legacy ones, add the translations.
    const kept = legacyResearch.filter((id) => RESEARCH_INDEX[id] !== undefined);
    raw.completedResearch = [...new Set([...kept, ...mapped])];
  }
}

/** Bring a parsed (possibly older-version, possibly partial) campaign up to the
 *  current shape. Returns null only if the input isn't a usable object. */
export function migrateCampaign(raw: unknown): CampaignState | null {
  if (!isPlainObject(raw)) return null;
  try {
    migrateLegacyFields(raw);
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
