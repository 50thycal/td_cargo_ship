// Region Workshop draft storage — a small adapter over the same key/value
// store the saves use, so UI components never touch localStorage directly and
// the adapter can be swapped for iOS-native storage with the rest of the
// platform layer.
//
// Drafts are stored under ONE versioned key as a map of id → record. Packaged
// presets are never written here: they are derived from data/regions.ts at
// load time and are read-only in the workshop.

import {
  compileRegion,
  fromRegionDef,
  migrateRegionAuthoring,
  toRegionDef,
  validateRegionAuthoring,
  type RegionAuthoringDef,
} from '../data/regionAuthoring';
import {
  REGIONS,
  REGION_ORDER,
  registerCustomRegion,
  unregisterCustomRegion,
  type RegionDef,
} from '../data/regions';

const DRAFTS_KEY = 'straitwatch.workshop.drafts.v1';

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

let store: KeyValueStore = typeof localStorage !== 'undefined' ? localStorage : memoryStore();

/** Tests swap the backing store so they never share state. */
export function useWorkshopStore(s: KeyValueStore | null): void {
  store = s ?? memoryStore();
}

export interface DraftRecord {
  def: RegionAuthoringDef;
  /** ISO timestamp of the last save. */
  updatedAt: string;
}

export interface WorkshopEntry {
  id: string;
  source: 'packaged' | 'local';
  def: RegionAuthoringDef;
  updatedAt: string | null;
  valid: boolean;
  errorCount: number;
  warningCount: number;
}

function readAll(): Record<string, DraftRecord> {
  try {
    const raw = store.getItem(DRAFTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { v?: number; drafts?: Record<string, DraftRecord> };
    return parsed?.drafts ?? {};
  } catch {
    return {};
  }
}

function writeAll(drafts: Record<string, DraftRecord>): void {
  try {
    store.setItem(DRAFTS_KEY, JSON.stringify({ v: 1, drafts }));
  } catch {
    // Quota failures must never crash the editor; the caller re-reads.
  }
}

/** Packaged ids the workshop offers as templates and as unlock targets. */
export function packagedIds(): string[] {
  return REGION_ORDER;
}

export function packagedTemplate(id: string): RegionAuthoringDef | null {
  const region = REGIONS[id];
  return region ? fromRegionDef(region) : null;
}

export function listDrafts(): DraftRecord[] {
  return Object.values(readAll()).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function loadDraft(id: string): DraftRecord | null {
  return readAll()[id] ?? null;
}

export function hasDraft(id: string): boolean {
  return !!readAll()[id];
}

/** Persist a draft. Invalid drafts are kept (marked "Draft — not playable" by
 *  the UI) so work is never lost; they are simply not registered for play. */
export function saveDraft(def: RegionAuthoringDef, now = new Date()): DraftRecord {
  const drafts = readAll();
  const record: DraftRecord = { def: JSON.parse(JSON.stringify(def)), updatedAt: now.toISOString() };
  drafts[def.id] = record;
  writeAll(drafts);
  registerIfValid(def);
  return record;
}

export function deleteDraft(id: string): void {
  const drafts = readAll();
  delete drafts[id];
  writeAll(drafts);
  unregisterCustomRegion(id);
}

/** Validate against the packaged ladder as unlock targets. */
export function validateDraft(def: RegionAuthoringDef) {
  return validateRegionAuthoring(def, undefined, undefined, { packagedIds: packagedIds() });
}

/** Make a valid draft playable right now — no rebuild. Returns the compiled
 *  RegionDef, or null if the draft does not validate. */
export function registerIfValid(def: RegionAuthoringDef): RegionDef | null {
  if (REGIONS[def.id]) return null; // packaged ids are read-only
  const result = validateDraft(def);
  if (!result.ok) {
    unregisterCustomRegion(def.id);
    return null;
  }
  const region = toRegionDef(compileRegion(def));
  registerCustomRegion(region);
  return region;
}

/** Register every valid saved draft. Called once at boot so a saved region a
 *  run was started on still resolves after a reload. */
export function registerSavedDrafts(): number {
  let n = 0;
  for (const record of listDrafts()) {
    if (registerIfValid(record.def)) n++;
  }
  return n;
}

export function libraryEntries(): WorkshopEntry[] {
  const out: WorkshopEntry[] = [];
  for (const id of REGION_ORDER) {
    const def = packagedTemplate(id)!;
    const v = validateDraft(def);
    out.push({
      id,
      source: 'packaged',
      def,
      updatedAt: null,
      valid: v.ok,
      errorCount: v.errors.length,
      warningCount: v.warnings.length,
    });
  }
  for (const record of listDrafts()) {
    const v = validateDraft(record.def);
    out.push({
      id: record.def.id,
      source: 'local',
      def: record.def,
      updatedAt: record.updatedAt,
      valid: v.ok,
      errorCount: v.errors.length,
      warningCount: v.warnings.length,
    });
  }
  return out;
}

/** A fresh id that collides with neither packaged regions nor drafts. */
export function freshId(base: string): string {
  const drafts = readAll();
  const clean = base.replace(/[^a-zA-Z0-9_-]/g, '').replace(/^[^a-zA-Z]+/, '') || 'region';
  if (!REGIONS[clean] && !drafts[clean]) return clean;
  for (let i = 2; i < 1000; i++) {
    const id = `${clean}${i}`;
    if (!REGIONS[id] && !drafts[id]) return id;
  }
  return `${clean}${Date.now().toString(36)}`;
}

export interface ImportOutcome {
  ok: boolean;
  error?: string;
  def?: RegionAuthoringDef;
  /** The parsed id already exists (packaged or draft) — caller must choose. */
  collision?: 'packaged' | 'local';
  validation?: ReturnType<typeof validateDraft>;
}

/** Parse + migrate + validate an imported JSON text. Writes NOTHING: the
 *  caller resolves collisions (replace / import-as-copy) and then saves. */
export function parseImport(text: string): ImportOutcome {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Not valid JSON.' };
  }
  const migrated = migrateRegionAuthoring(raw);
  if (!migrated.ok || !migrated.def) return { ok: false, error: migrated.error };
  const def = migrated.def;
  const validation = validateDraft(def);
  const collision: ImportOutcome['collision'] = REGIONS[def.id]
    ? 'packaged'
    : hasDraft(def.id)
      ? 'local'
      : undefined;
  return { ok: true, def, collision, validation };
}

/** The exact portable JSON for a preset. */
export function exportJson(def: RegionAuthoringDef): string {
  return JSON.stringify(def, null, 2);
}

// ---------------------------------------------------------------------------
// Balance-sweep history
// ---------------------------------------------------------------------------
//
// Every sweep a designer runs is kept with the region it measured, keyed by
// the preset's CONTENT HASH — so after an edit the previous result is still
// there to read against the new one, and a result can never be mistaken for a
// measurement of a region that has since changed.

import type { SweepSummary } from '../sim/playtest/analyze';

const SWEEPS_KEY = 'straitwatch.workshop.sweeps.v1';
/** Kept per region, newest first. */
const SWEEP_HISTORY_LIMIT = 12;

export interface SweepRecord {
  /** Region id and the content hash of the exact preset that was swept. */
  regionId: string;
  hash: string;
  regionName: string;
  ranAt: string;
  options: { seeds: number; personas: string[]; rounds: number };
  /** Wall-clock seconds the sweep took. */
  seconds: number;
  summary: SweepSummary;
}

function readSweeps(): Record<string, SweepRecord[]> {
  try {
    const raw = store.getItem(SWEEPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { v?: number; sweeps?: Record<string, SweepRecord[]> };
    return parsed?.sweeps ?? {};
  } catch {
    return {};
  }
}

function writeSweeps(sweeps: Record<string, SweepRecord[]>): void {
  try {
    store.setItem(SWEEPS_KEY, JSON.stringify({ v: 1, sweeps }));
  } catch {
    // A full store loses the oldest history, never the editor.
  }
}

export function saveSweep(record: SweepRecord): void {
  const all = readSweeps();
  const list = [record, ...(all[record.regionId] ?? [])].slice(0, SWEEP_HISTORY_LIMIT);
  all[record.regionId] = list;
  writeSweeps(all);
}

export function listSweeps(regionId: string): SweepRecord[] {
  return readSweeps()[regionId] ?? [];
}

export function deleteSweeps(regionId: string): void {
  const all = readSweeps();
  delete all[regionId];
  writeSweeps(all);
}
