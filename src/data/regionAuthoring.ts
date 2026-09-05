// REGION WORKSHOP — the authored region format and its pure compiler.
//
// This is a region AUTHORING layer, not a second combat simulator and not a
// parallel copy of the balance data. An authored region controls
// AVAILABILITY, PACING, composition guardrails, scripted debut beats and
// terrain; the canonical arsenal (enemyBranches.ts) keeps controlling what
// each enemy capability actually does. Nothing in this file stores a
// missile's damage, a boat's speed or a tactic's effect — only references.
//
// Everything here is pure: no DOM, no localStorage, so it runs in Node tests
// and can travel with the simulation to the iOS port unchanged.
//
// Product decisions locked in by docs/design/region-workshop.md:
//   1. Rounds are cumulative milestones — an `add` on round N holds until an
//      explicit `remove`.
//   2. The adaptive enemy stays the default; beats are optional and explicit.
//   3. Canonical gates are authoritative: resolved introduction is
//      max(catalogue gate, authored introduction). A region can delay, never
//      hurry.
//   4. Only implemented content can enter a playable region.
//   5. Built-in regions are templates (derived, never hand-copied).
//   7. The authored format is portable JSON — identifiers and values only.
//   8. No arbitrary round limit.

import {
  ENEMY_BRANCHES,
  ENEMY_BRANCH_ORDER,
  type EnemyBranchDef,
  type EnemyBranchKey,
  type EnemyNodeDef,
} from './enemyBranches';
import { GEOGRAPHIES, type GeographyDef, type GeographyId } from './geography';
import { ENEMY_ECONOMY } from './tuning';
import type { RegionDef, RegionStartState } from './regions';

// ---------------------------------------------------------------------------
// Authored schema (portable JSON)
// ---------------------------------------------------------------------------

export const REGION_AUTHORING_SCHEMA_VERSION = 1 as const;

export type RegionShapeType = 'openWater' | 'coastalSqueeze' | 'headlands' | 'islandChannel';

/** The environment presets the workshop exposes. Each is one validated
 *  canonical geography wearing a designer-facing name and shape type. */
export interface EnvironmentPreset {
  id: string;
  name: string;
  shapeType: RegionShapeType;
  geographyId: GeographyId;
  desc: string;
}

export const ENVIRONMENT_PRESETS: readonly EnvironmentPreset[] = [
  {
    id: 'openWater',
    name: 'Open Water / Strait',
    shapeType: 'openWater',
    geographyId: 'strait',
    desc: 'Two straight coasts, three straight lanes. The widest, quietest crossing.',
  },
  {
    id: 'coastalSqueeze',
    name: 'Coastal Squeeze',
    shapeType: 'coastalSqueeze',
    geographyId: 'squeeze',
    desc: 'The hostile shore bulges into the lanes at the halfway mark; warning time collapses in the alley.',
  },
  {
    id: 'headlands',
    name: 'Headlands',
    shapeType: 'headlands',
    geographyId: 'headlands',
    desc: 'A hostile peninsula held for two-thirds of the crossing — no lane is quietly safe.',
  },
  {
    id: 'islandChannel',
    name: 'Island Channel',
    shapeType: 'islandChannel',
    geographyId: 'islandChannel',
    desc:
      'A rock amidships splits the strait into two passages. The northern one is roomy and fully ' +
      'exposed; the southern one shelters two crowded lanes from shore-launched torpedoes. A hull ' +
      'commits to a channel at the western tip and cannot change sides until the eastern one.',
  },
];

export function environmentPreset(id: string): EnvironmentPreset | undefined {
  return ENVIRONMENT_PRESETS.find((p) => p.id === id);
}

/** A reference into the canonical arsenal. References ONLY — the compiler
 *  resolves names, costs, gates, prerequisites and implementation flags.
 *
 *  The catalogue today is branch → node → tactic; a missile and its mount are
 *  one node, so there is no separate payload/platform/mount id yet. Those
 *  fields are reserved (and rejected as unknown if non-empty) until the
 *  canonical data is split — nothing here fabricates a mount choice. */
export interface EnemyLoadoutRef {
  branch: EnemyBranchKey;
  nodeId: string;
  /** Tactic rungs the designer expects to be reachable. Purely descriptive
   *  today: rungs are earned by sustained investment in the sim. Validated
   *  against the catalogue so a typo cannot survive an import. */
  tacticIds?: string[];
}

export type BeatPattern = 'salvo' | 'cluster' | 'wave' | 'sustained';
export type BeatBudget = 'charged' | 'reserved' | 'outOfBudget';

/** A typed, simulation-implemented encounter beat. Deliberately small: only
 *  fields that change runtime behaviour and have a test are exposed. */
export interface EncounterBeatDef {
  id: string;
  pattern: BeatPattern;
  ref: EnemyLoadoutRef;
  /** Units guaranteed on the water this round (minimum). */
  units: number;
  /** Launch groups the units are split into (salvo/cluster/wave). Ignored for
   *  `sustained`, which spreads across the whole window. */
  groups?: number;
  /** Budget treatment: `charged` — the units are bought from this round's
   *  budget before the adaptive allocator spends (a guaranteed debut);
   *  `reserved` — same, but the region's budget for this round is lifted by
   *  the cost so the adaptive enemy is not starved by the beat;
   *  `outOfBudget` — a labelled test beat costing nothing. */
  budget: BeatBudget;
  label?: string;
}

export interface RegionRoundMilestone {
  round: number;
  label?: string;
  /** Player-facing intel warning surfaced the round BEFORE this one. */
  intelWarning?: string;
  add: EnemyLoadoutRef[];
  remove?: EnemyLoadoutRef[];
  pressure?: {
    budgetOverride?: number;
    budgetMultiplier?: number;
    branchCeilings?: Partial<Record<EnemyBranchKey, number>>;
  };
  beats?: EncounterBeatDef[];
}

export interface RegionAuthoringDefV1 {
  schemaVersion: 1;
  id: string;
  name: string;
  tagline: string;
  description: string;
  completionRound: number;
  environmentPresetId: string;
  shapeType: RegionShapeType;
  campaign: {
    completionXp: number;
    unlocks: string | null;
  };
  start: RegionStartState;
  pressure: {
    /** null = the global ENEMY_ECONOMY defaults. */
    defaultBudget: { base: number; perRound: number; cap: number } | null;
    defaultBranchCeilings: Partial<Record<EnemyBranchKey, number>>;
  };
  milestones: RegionRoundMilestone[];
}

export type RegionAuthoringDef = RegionAuthoringDefV1;

// ---------------------------------------------------------------------------
// Migration entry point
// ---------------------------------------------------------------------------

export interface MigrationResult {
  ok: boolean;
  def?: RegionAuthoringDef;
  error?: string;
}

/** Bring a parsed JSON value up to the current schema. Unknown FUTURE versions
 *  are rejected outright — never partially loaded. */
export function migrateRegionAuthoring(raw: unknown): MigrationResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'Not a region preset object.' };
  }
  const obj = raw as Record<string, unknown>;
  const v = obj.schemaVersion;
  if (v === undefined) return { ok: false, error: 'Missing schemaVersion.' };
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    return { ok: false, error: 'schemaVersion must be an integer.' };
  }
  if (v > REGION_AUTHORING_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Schema version ${v} is newer than this build supports (${REGION_AUTHORING_SCHEMA_VERSION}).`,
    };
  }
  if (v < 1) return { ok: false, error: `Unsupported schema version ${v}.` };
  // v1 → current: nothing to do yet. Future migrations chain here.
  return { ok: true, def: normalize(obj as unknown as RegionAuthoringDefV1) };
}

/** Fill absent optional containers so the editor and compiler never branch on
 *  undefined. Never invents content. */
function normalize(def: RegionAuthoringDefV1): RegionAuthoringDefV1 {
  const d = clone(def);
  d.schemaVersion = 1;
  d.campaign ??= { completionXp: 0, unlocks: null };
  d.pressure ??= { defaultBudget: null, defaultBranchCeilings: {} };
  d.pressure.defaultBranchCeilings ??= {};
  if (d.pressure.defaultBudget === undefined) d.pressure.defaultBudget = null;
  d.milestones = Array.isArray(d.milestones) ? d.milestones : [];
  for (const m of d.milestones) {
    m.add = Array.isArray(m.add) ? m.add : [];
    if (m.remove !== undefined && !Array.isArray(m.remove)) m.remove = [];
    if (m.beats !== undefined && !Array.isArray(m.beats)) m.beats = [];
  }
  return d;
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ---------------------------------------------------------------------------
// Catalogue adapter — the arsenal as the workshop sees it
// ---------------------------------------------------------------------------

export type ArsenalCatalog = Record<EnemyBranchKey, EnemyBranchDef>;
export type EnvironmentCatalog = Record<GeographyId, GeographyDef>;

export interface ArsenalEntry {
  branch: EnemyBranchKey;
  branchName: string;
  node: EnemyNodeDef;
  /** Earliest round the canonical data allows this node on the water:
   *  max(branch openRound, node gateRound). */
  earliestRound: number;
  implemented: boolean;
  tactics: EnemyBranchDef['tactics'];
}

/** Every branch/node pair in the catalogue, in catalogue order. */
export function arsenalEntries(catalog: ArsenalCatalog = ENEMY_BRANCHES): ArsenalEntry[] {
  const out: ArsenalEntry[] = [];
  for (const key of ENEMY_BRANCH_ORDER) {
    const branch = catalog[key];
    if (!branch) continue;
    for (const node of branch.nodes) {
      out.push({
        branch: key,
        branchName: branch.name,
        node,
        earliestRound: Math.max(branch.openRound, node.gateRound),
        implemented: branch.implemented && node.implemented,
        tactics: branch.tactics,
      });
    }
  }
  return out;
}

export function refKey(ref: EnemyLoadoutRef): string {
  return `${ref.branch}:${ref.nodeId}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  /** Focus target: the responsible round and/or capability cell. */
  round?: number;
  ref?: EnemyLoadoutRef;
  field?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  issues: ValidationIssue[];
}

function finitePositive(n: unknown): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

export function validateRegionAuthoring(
  def: RegionAuthoringDef,
  catalog: ArsenalCatalog = ENEMY_BRANCHES,
  environments: EnvironmentCatalog = GEOGRAPHIES,
  opts: { packagedIds?: readonly string[] } = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const err = (code: string, message: string, extra: Partial<ValidationIssue> = {}) =>
    issues.push({ severity: 'error', code, message, ...extra });
  const warn = (code: string, message: string, extra: Partial<ValidationIssue> = {}) =>
    issues.push({ severity: 'warning', code, message, ...extra });

  // --- identity -----------------------------------------------------------
  if (typeof def.id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(def.id)) {
    err('id', 'Region ID must be a short identifier (letters, digits, _ or -), starting with a letter.', {
      field: 'id',
    });
  }
  if (typeof def.name !== 'string' || def.name.trim().length === 0) {
    err('name', 'Region needs a name.', { field: 'name' });
  }
  if (!Number.isInteger(def.completionRound) || def.completionRound < 1) {
    err('completionRound', 'Completion round must be a positive integer.', {
      field: 'completionRound',
    });
  }
  // --- environment --------------------------------------------------------
  const env = environmentPreset(def.environmentPresetId);
  if (!env) {
    err('environment', `Unknown environment preset "${def.environmentPresetId}".`, {
      field: 'environmentPresetId',
    });
  } else {
    if (!environments[env.geographyId]) {
      err('environment', `Environment "${env.name}" points at a geography this build does not have.`, {
        field: 'environmentPresetId',
      });
    }
    if (def.shapeType !== env.shapeType) {
      err('shapeType', `Shape type "${def.shapeType}" does not match the environment's "${env.shapeType}".`, {
        field: 'shapeType',
      });
    }
  }
  // --- campaign -----------------------------------------------------------
  if (!finitePositive(def.campaign?.completionXp)) {
    err('completionXp', 'Completion XP must be a non-negative number.', { field: 'completionXp' });
  }
  if (def.campaign?.unlocks !== null && def.campaign?.unlocks !== undefined) {
    if (def.campaign.unlocks === def.id) {
      err('unlocks', 'A region cannot unlock itself.', { field: 'unlocks' });
    } else if (opts.packagedIds && !opts.packagedIds.includes(def.campaign.unlocks)) {
      err('unlocks', `Unlock target "${def.campaign.unlocks}" is not a packaged region.`, {
        field: 'unlocks',
      });
    }
  }
  // --- start state --------------------------------------------------------
  const start = def.start as Partial<RegionStartState> | undefined;
  if (!start) err('start', 'Missing starting state.', { field: 'start' });
  else {
    for (const k of ['cash', 'ammo', 'droneAmmo', 'pdAmmo', 'bases', 'escorts', 'capacity', 'confidence'] as const) {
      if (!finitePositive(start[k])) err('start', `Starting ${k} must be a non-negative number.`, { field: `start.${k}` });
    }
    if (!start.fleet || typeof start.fleet !== 'object') {
      err('start', 'Starting fleet is missing.', { field: 'start.fleet' });
    } else {
      for (const [cls, n] of Object.entries(start.fleet)) {
        if (!Number.isInteger(n) || (n as number) < 0) {
          err('start', `Starting fleet "${cls}" must be a non-negative integer.`, { field: 'start.fleet' });
        }
      }
    }
  }
  // --- pressure -----------------------------------------------------------
  const budget = def.pressure?.defaultBudget;
  if (budget) {
    for (const k of ['base', 'perRound', 'cap'] as const) {
      if (!finitePositive(budget[k])) err('budget', `Budget ${k} must be a non-negative number.`, { field: `budget.${k}` });
    }
  }
  for (const [branch, ceiling] of Object.entries(def.pressure?.defaultBranchCeilings ?? {})) {
    if (!catalog[branch as EnemyBranchKey]) err('ceiling', `Unknown branch "${branch}" in branch ceilings.`, { field: 'ceilings' });
    else if (!Number.isInteger(ceiling) || (ceiling as number) < 1) {
      err('ceiling', `Ceiling for ${branch} must be a positive integer.`, { field: 'ceilings' });
    }
  }

  // --- milestones ---------------------------------------------------------
  const seenRounds = new Set<number>();
  const introduced = new Map<string, number>();
  const removed = new Map<string, number>();
  const sorted = [...(def.milestones ?? [])].sort((a, b) => a.round - b.round);
  const checkRef = (ref: EnemyLoadoutRef, round: number, what: string): ArsenalEntry | null => {
    const branch = catalog[ref.branch];
    if (!branch) {
      err('unknownBranch', `Round ${round}: unknown branch "${ref.branch}" in ${what}.`, { round, ref });
      return null;
    }
    const node = branch.nodes.find((n) => n.id === ref.nodeId);
    if (!node) {
      err('unknownNode', `Round ${round}: unknown ${branch.name} node "${ref.nodeId}" in ${what}.`, { round, ref });
      return null;
    }
    const extra = ref as unknown as Record<string, unknown>;
    for (const k of ['payloadId', 'platformId', 'mountId']) {
      if (extra[k] !== undefined && extra[k] !== null && extra[k] !== '') {
        err('unknownComponent', `Round ${round}: ${k} "${String(extra[k])}" — the catalogue has no separate ${k.replace('Id', '')} for ${node.name}.`, { round, ref });
      }
    }
    for (const t of ref.tacticIds ?? []) {
      if (!branch.tactics.some((x) => x.id === t)) {
        err('unknownTactic', `Round ${round}: unknown ${branch.name} tactic "${t}".`, { round, ref });
      }
    }
    return {
      branch: ref.branch,
      branchName: branch.name,
      node,
      earliestRound: Math.max(branch.openRound, node.gateRound),
      implemented: branch.implemented && node.implemented,
      tactics: branch.tactics,
    };
  };

  for (const m of sorted) {
    const round = m.round;
    if (!Number.isInteger(round) || round < 1) {
      err('milestoneRound', `Milestone round "${String(round)}" must be a positive integer.`, { round });
      continue;
    }
    if (Number.isInteger(def.completionRound) && round > def.completionRound) {
      err('milestoneOutside', `Round ${round} is beyond the completion round (${def.completionRound}).`, { round });
    }
    if (seenRounds.has(round)) err('duplicateMilestone', `Round ${round} has more than one milestone.`, { round });
    seenRounds.add(round);

    for (const ref of m.add ?? []) {
      const entry = checkRef(ref, round, 'add');
      if (!entry) continue;
      const key = refKey(ref);
      if (!entry.implemented) {
        err('unimplemented', `Round ${round}: ${entry.node.name} is designed but not implemented — it cannot enter a playable region.`, { round, ref });
      }
      if (round < entry.earliestRound) {
        err('beforeGate', `Round ${round}: ${entry.node.name} cannot appear before its catalogue gate (round ${entry.earliestRound}). Change the global gate in the arsenal data, not here.`, { round, ref });
      }
      const prevRemoved = removed.get(key);
      const prevIntro = introduced.get(key);
      if (prevIntro !== undefined && (prevRemoved === undefined || prevRemoved >= round)) {
        warn('reintroduced', `Round ${round}: ${entry.node.name} is already available from round ${prevIntro}.`, { round, ref });
      }
      if (prevIntro === undefined || (prevRemoved !== undefined && prevRemoved < round)) {
        introduced.set(key, round);
        removed.delete(key);
      }
    }
    for (const ref of m.remove ?? []) {
      const entry = checkRef(ref, round, 'remove');
      if (!entry) continue;
      const key = refKey(ref);
      const intro = introduced.get(key);
      if (intro === undefined || intro > round) {
        err('removeBeforeIntro', `Round ${round}: ${entry.node.name} is removed before it was introduced.`, { round, ref });
      } else {
        removed.set(key, round);
      }
    }
    const p = m.pressure;
    if (p) {
      if (p.budgetOverride !== undefined && !finitePositive(p.budgetOverride)) {
        err('pressure', `Round ${round}: budget override must be a non-negative number.`, { round, field: 'budgetOverride' });
      }
      if (p.budgetMultiplier !== undefined && !finitePositive(p.budgetMultiplier)) {
        err('pressure', `Round ${round}: budget multiplier must be a non-negative number.`, { round, field: 'budgetMultiplier' });
      }
      for (const [branch, ceiling] of Object.entries(p.branchCeilings ?? {})) {
        if (!catalog[branch as EnemyBranchKey]) err('ceiling', `Round ${round}: unknown branch "${branch}" in ceilings.`, { round });
        else if (!Number.isInteger(ceiling) || (ceiling as number) < 1) {
          err('ceiling', `Round ${round}: ceiling for ${branch} must be a positive integer.`, { round });
        }
      }
    }
    const beatIds = new Set<string>();
    for (const beat of m.beats ?? []) {
      if (!beat.id || beatIds.has(beat.id)) err('beatId', `Round ${round}: every beat needs a unique id.`, { round });
      beatIds.add(beat.id);
      if (!['salvo', 'cluster', 'wave', 'sustained'].includes(beat.pattern)) {
        err('beatPattern', `Round ${round}: unknown beat pattern "${String(beat.pattern)}".`, { round, ref: beat.ref });
      }
      if (!['charged', 'reserved', 'outOfBudget'].includes(beat.budget)) {
        err('beatBudget', `Round ${round}: unknown budget treatment "${String(beat.budget)}".`, { round, ref: beat.ref });
      }
      if (!Number.isInteger(beat.units) || beat.units < 1) {
        err('beatUnits', `Round ${round}: beat unit count must be a positive integer.`, { round, ref: beat.ref });
      }
      if (beat.groups !== undefined && (!Number.isInteger(beat.groups) || beat.groups < 1)) {
        err('beatGroups', `Round ${round}: beat group count must be a positive integer.`, { round, ref: beat.ref });
      }
      const entry = beat.ref ? checkRef(beat.ref, round, 'beat') : null;
      if (!entry) continue;
      if (!entry.implemented) {
        err('unimplemented', `Round ${round}: beat uses ${entry.node.name}, which is not implemented.`, { round, ref: beat.ref });
      }
      if (round < entry.earliestRound) {
        err('beforeGate', `Round ${round}: beat fires ${entry.node.name} before its catalogue gate (round ${entry.earliestRound}).`, { round, ref: beat.ref });
      }
      const key = refKey(beat.ref);
      const intro = introduced.get(key);
      const rem = removed.get(key);
      if (intro === undefined || intro > round || (rem !== undefined && rem < round)) {
        err('beatUnavailable', `Round ${round}: beat fires ${entry.node.name}, which is not available on this round. Add it first.`, { round, ref: beat.ref });
      }
      const ceilingDefault =
        def.pressure?.defaultBranchCeilings?.[beat.ref.branch] ?? catalog[beat.ref.branch].maxUnitsPerRound;
      const ceiling = p?.branchCeilings?.[beat.ref.branch] ?? ceilingDefault;
      if (Number.isInteger(beat.units) && ceiling !== undefined && beat.units > ceiling) {
        err('beatOverCeiling', `Round ${round}: beat fields ${beat.units} ${entry.node.name}s, above the ${ceiling}-unit ceiling.`, { round, ref: beat.ref });
      }
    }
  }

  const errors = issues.filter((i) => i.severity === 'error');
  // Warnings that need the compiled timeline are only meaningful on a
  // structurally valid definition.
  if (errors.length === 0) {
    const compiled = compileRegion(def, catalog, environments);
    let prevBudget = 0;
    for (let r = 1; r <= def.completionRound; r++) {
      const avail = availabilityAtRound(compiled, r);
      const pressure = pressureAtRound(compiled, r);
      const beats = beatsAtRound(compiled, r);
      if (avail.length === 0) warn('emptyRound', `Round ${r} has no available threat.`, { round: r });
      const cheapest = Math.min(...avail.map((a) => a.node.cost), Infinity);
      if (avail.length > 0 && pressure.budget < cheapest) {
        warn('unaffordable', `Round ${r}: the ${pressure.budget} budget cannot buy a single unit of anything available.`, { round: r });
      }
      // Stranded budget: what the ceilings allow at the cheapest node price.
      const buyable = Object.entries(groupBy(avail, (a) => a.branch)).reduce((sum, [branch, entries]) => {
        const ceiling = pressure.branchCeilings[branch as EnemyBranchKey] ?? catalog[branch as EnemyBranchKey].maxUnitsPerRound;
        const dearest = Math.max(...entries.map((e) => e.node.cost));
        return sum + ceiling * dearest;
      }, 0);
      if (avail.length > 0 && pressure.budget > buyable * 1.5) {
        warn('stranded', `Round ${r}: the budget (${pressure.budget}) is well above what the unit ceilings can absorb (~${buyable}); much of it will be scrapped.`, { round: r });
      }
      const beatCost = beats.reduce((s, b) => (b.budget === 'outOfBudget' ? s : s + b.units * b.entry.node.cost), 0);
      if (beatCost > 0 && pressure.budget > 0 && beatCost >= pressure.budget * 0.8) {
        warn('beatDominates', `Round ${r}: scripted beats consume ${Math.round((100 * beatCost) / pressure.budget)}% of the round budget.`, { round: r });
      }
      if (r > 1 && prevBudget > 0 && pressure.budget > prevBudget * 2) {
        warn('pressureJump', `Round ${r}: budget more than doubles from round ${r - 1} (${prevBudget} → ${pressure.budget}).`, { round: r });
      }
      prevBudget = pressure.budget;
      for (const a of avail) {
        if (a.introducedThisRound && a.node.warning) {
          const prior = compiled.def.milestones.find((m) => m.round === r - 1);
          if (r > 1 && !prior?.intelWarning) {
            // The sim's own intel forecast covers catalogue gates; an authored
            // warning is only missing when the designer delayed a debut.
            if (r > a.earliestRound) {
              warn('noWarning', `Round ${r}: ${a.node.name} debuts with no authored intel warning on round ${r - 1}.`, { round: r, ref: { branch: a.branch, nodeId: a.node.id } });
            }
          }
        }
      }
    }
  }

  const warnings = issues.filter((i) => i.severity === 'warning');
  return { ok: errors.length === 0, errors, warnings, issues };
}

function groupBy<T>(items: T[], key: (t: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const it of items) (out[key(it)] ??= []).push(it);
  return out;
}

// ---------------------------------------------------------------------------
// Compilation — cumulative milestones resolved ONCE
// ---------------------------------------------------------------------------

export interface AvailableCapability extends ArsenalEntry {
  /** First region round this capability is on the menu (already clamped to the
   *  catalogue gate). */
  from: number;
  /** Last round it is available, or null for "to the end". */
  until: number | null;
  introducedThisRound: boolean;
}

export interface RoundPressure {
  round: number;
  /** The base curve figure for this round BEFORE the sim's anti-snowball
   *  modifiers (which are player-performance driven and cannot be authored). */
  budget: number;
  override: number | null;
  multiplier: number | null;
  branchCeilings: Partial<Record<EnemyBranchKey, number>>;
}

export interface CompiledBeat extends EncounterBeatDef {
  round: number;
  entry: ArsenalEntry;
}

export interface CompiledRegion {
  def: RegionAuthoringDef;
  /** Stable content hash of the authored JSON (for telemetry and replay). */
  hash: string;
  environment: EnvironmentPreset;
  /** Per capability: the availability windows, keyed by refKey. */
  windows: Record<string, { entry: ArsenalEntry; from: number; until: number | null }[]>;
  /** Per-round resolved figures, index 1..completionRound. */
  pressure: RoundPressure[];
  beats: CompiledBeat[];
  intelWarnings: Record<number, string>;
  labels: Record<number, string>;
}

export function compileRegion(
  def: RegionAuthoringDef,
  catalog: ArsenalCatalog = ENEMY_BRANCHES,
  environments: EnvironmentCatalog = GEOGRAPHIES,
): CompiledRegion {
  void environments;
  const env = environmentPreset(def.environmentPresetId) ?? ENVIRONMENT_PRESETS[0];
  const windows: CompiledRegion['windows'] = {};
  const sorted = [...def.milestones].sort((a, b) => a.round - b.round);
  const open = new Map<string, { entry: ArsenalEntry; from: number; until: number | null }>();
  const entryFor = (ref: EnemyLoadoutRef): ArsenalEntry | null => {
    const branch = catalog[ref.branch];
    const node = branch?.nodes.find((n) => n.id === ref.nodeId);
    if (!branch || !node) return null;
    return {
      branch: ref.branch,
      branchName: branch.name,
      node,
      earliestRound: Math.max(branch.openRound, node.gateRound),
      implemented: branch.implemented && node.implemented,
      tactics: branch.tactics,
    };
  };
  for (const m of sorted) {
    for (const ref of m.add) {
      const entry = entryFor(ref);
      if (!entry) continue;
      const key = refKey(ref);
      if (open.has(key)) continue; // already available — cumulative
      // Decision 3: a region can delay a capability, never hurry it.
      const w = { entry, from: Math.max(m.round, entry.earliestRound), until: null as number | null };
      open.set(key, w);
      (windows[key] ??= []).push(w);
    }
    for (const ref of m.remove ?? []) {
      const key = refKey(ref);
      const w = open.get(key);
      if (!w) continue;
      w.until = m.round;
      open.delete(key);
    }
  }

  const curve = def.pressure.defaultBudget ?? {
    base: ENEMY_ECONOMY.budgetBase,
    perRound: ENEMY_ECONOMY.budgetPerRound,
    cap: ENEMY_ECONOMY.budgetCap,
  };
  const pressure: RoundPressure[] = [];
  const beats: CompiledBeat[] = [];
  const intelWarnings: Record<number, string> = {};
  const labels: Record<number, string> = {};
  const ceilingState: Partial<Record<EnemyBranchKey, number>> = { ...def.pressure.defaultBranchCeilings };
  const rounds = Math.max(1, Math.floor(def.completionRound));
  for (let r = 1; r <= rounds; r++) {
    const m = sorted.find((x) => x.round === r);
    if (m?.pressure?.branchCeilings) Object.assign(ceilingState, m.pressure.branchCeilings);
    let budget = Math.min(curve.cap, Math.round(curve.base + curve.perRound * r));
    const override = m?.pressure?.budgetOverride ?? null;
    const multiplier = m?.pressure?.budgetMultiplier ?? null;
    if (override !== null) budget = Math.round(override);
    else if (multiplier !== null) budget = Math.round(budget * multiplier);
    pressure[r] = { round: r, budget, override, multiplier, branchCeilings: { ...ceilingState } };
    if (m?.intelWarning) intelWarnings[r] = m.intelWarning;
    if (m?.label) labels[r] = m.label;
    for (const b of m?.beats ?? []) {
      const entry = entryFor(b.ref);
      if (!entry) continue;
      beats.push({ ...clone(b), round: r, entry });
    }
  }
  return {
    def,
    hash: contentHash(def),
    environment: env,
    windows,
    pressure,
    beats,
    intelWarnings,
    labels,
  };
}

/** The resolved set the adaptive enemy may use on `round`. */
export function availabilityAtRound(compiled: CompiledRegion, round: number): AvailableCapability[] {
  const out: AvailableCapability[] = [];
  for (const key of Object.keys(compiled.windows)) {
    for (const w of compiled.windows[key]) {
      if (round >= w.from && (w.until === null || round <= w.until)) {
        out.push({ ...w.entry, from: w.from, until: w.until, introducedThisRound: round === w.from });
      }
    }
  }
  // Catalogue order for stable display.
  const order = arsenalEntries().map((e) => `${e.branch}:${e.node.id}`);
  out.sort((a, b) => order.indexOf(`${a.branch}:${a.node.id}`) - order.indexOf(`${b.branch}:${b.node.id}`));
  return out;
}

export function pressureAtRound(compiled: CompiledRegion, round: number): RoundPressure {
  const rounds = compiled.pressure.length - 1;
  const r = Math.max(1, Math.min(rounds, Math.floor(round)));
  return compiled.pressure[r];
}

export function beatsAtRound(compiled: CompiledRegion, round: number): CompiledBeat[] {
  return compiled.beats.filter((b) => b.round === round);
}

/** Branches with at least one window anywhere in the region. */
export function compiledBranches(compiled: CompiledRegion): EnemyBranchKey[] {
  const keys = new Set<EnemyBranchKey>();
  for (const key of Object.keys(compiled.windows)) {
    if (compiled.windows[key].length > 0) keys.add(compiled.windows[key][0].entry.branch);
  }
  return ENEMY_BRANCH_ORDER.filter((k) => keys.has(k));
}

/** FNV-1a over the canonical JSON — small, deterministic, dependency-free. */
export function contentHash(def: RegionAuthoringDef): string {
  const s = JSON.stringify(def);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// Runtime bridge — the compiled region as the RegionDef the sim reads
// ---------------------------------------------------------------------------

/** Node-level availability the runtime honours on top of branch gating. Keyed
 *  `branch:nodeId`; a node with NO entry is governed only by the catalogue
 *  gate, which is how every packaged region behaves today. */
export type NodeWindows = Record<string, { from: number; until: number | null }[]>;

/** Per-round pressure the runtime applies on top of the region's budget curve.
 *  Absent rounds use the curve unmodified. */
export interface RoundPressureRule {
  budgetOverride?: number;
  budgetMultiplier?: number;
  branchCeilings?: Partial<Record<EnemyBranchKey, number>>;
}

/** An authored beat, as the runtime schedules it. */
export interface RuntimeBeat {
  id: string;
  round: number;
  branch: EnemyBranchKey;
  nodeId: string;
  pattern: BeatPattern;
  units: number;
  groups: number | null;
  budget: BeatBudget;
}

/** The RegionDef the simulation runs, generated from the compiled preset. The
 *  legacy fields (`enemyBranches`, `branchDebutRounds`, `budget`,
 *  `branchUnitCeilings`) are DERIVED here so there is one editable definition
 *  and the existing allocator contract is unchanged. */
export function toRegionDef(compiled: CompiledRegion): RegionDef {
  const def = compiled.def;
  const branches = compiledBranches(compiled);
  const branchDebutRounds: Partial<Record<EnemyBranchKey, number>> = {};
  const nodeWindows: NodeWindows = {};
  for (const key of branches) {
    // The branch's debut floor is the earliest round any of its nodes is
    // authored available. Only recorded when it DELAYS the catalogue.
    let earliest = Infinity;
    for (const wkey of Object.keys(compiled.windows)) {
      for (const w of compiled.windows[wkey]) {
        if (w.entry.branch !== key) continue;
        earliest = Math.min(earliest, w.from);
      }
    }
    if (Number.isFinite(earliest) && earliest > ENEMY_BRANCHES[key].openRound) {
      branchDebutRounds[key] = earliest;
    }
  }
  for (const wkey of Object.keys(compiled.windows)) {
    const ws = compiled.windows[wkey];
    if (ws.length === 0) continue;
    const entry = ws[0].entry;
    // Only record windows that differ from "catalogue gate to the end" — that
    // keeps packaged regions byte-identical to their pre-workshop shape.
    const trivial = ws.length === 1 && ws[0].from <= entry.earliestRound && ws[0].until === null;
    if (trivial) continue;
    nodeWindows[wkey] = ws.map((w) => ({ from: w.from, until: w.until }));
  }
  const roundPressure: Record<number, RoundPressureRule> = {};
  for (const m of def.milestones) {
    if (!m.pressure) continue;
    const rule: RoundPressureRule = {};
    if (m.pressure.budgetOverride !== undefined) rule.budgetOverride = m.pressure.budgetOverride;
    if (m.pressure.budgetMultiplier !== undefined) rule.budgetMultiplier = m.pressure.budgetMultiplier;
    if (m.pressure.branchCeilings && Object.keys(m.pressure.branchCeilings).length > 0) {
      rule.branchCeilings = { ...m.pressure.branchCeilings };
    }
    if (Object.keys(rule).length > 0) roundPressure[m.round] = rule;
  }
  const beats: RuntimeBeat[] = compiled.beats.map((b) => ({
    id: b.id,
    round: b.round,
    branch: b.ref.branch,
    nodeId: b.ref.nodeId,
    pattern: b.pattern,
    units: b.units,
    groups: b.groups ?? null,
    budget: b.budget,
  }));
  const intelWarnings: Record<number, string> = { ...compiled.intelWarnings };

  const out: RegionDef = {
    id: def.id,
    name: def.name,
    tagline: def.tagline,
    desc: def.description,
    completionRound: def.completionRound,
    enemyBranches: branches,
    budget: def.pressure.defaultBudget ? { ...def.pressure.defaultBudget } : null,
    start: clone(def.start),
    completionXp: def.campaign.completionXp,
    unlocks: def.campaign.unlocks,
    geography: compiled.environment.geographyId,
  };
  if (Object.keys(branchDebutRounds).length > 0) out.branchDebutRounds = branchDebutRounds;
  if (Object.keys(def.pressure.defaultBranchCeilings).length > 0) {
    out.branchUnitCeilings = { ...def.pressure.defaultBranchCeilings };
  }
  if (Object.keys(nodeWindows).length > 0) out.nodeWindows = nodeWindows;
  if (Object.keys(roundPressure).length > 0) out.roundPressure = roundPressure;
  if (beats.length > 0) out.beats = beats;
  if (Object.keys(intelWarnings).length > 0) out.intelWarnings = intelWarnings;
  out.authoring = { schemaVersion: def.schemaVersion, hash: compiled.hash };
  return out;
}

// ---------------------------------------------------------------------------
// Templates — packaged regions DERIVED from the canonical definitions
// ---------------------------------------------------------------------------

function presetForGeography(geo: GeographyId | undefined): EnvironmentPreset {
  return ENVIRONMENT_PRESETS.find((p) => p.geographyId === (geo ?? 'strait')) ?? ENVIRONMENT_PRESETS[0];
}

/** Derive the authored form of a packaged RegionDef. Each implemented node of
 *  each permitted branch becomes an `add` on its RESOLVED introduction round
 *  (max of the branch open round, the node gate and the region's debut floor),
 *  so the timeline shows the real catalogue gates rather than one generic bar. */
export function fromRegionDef(region: RegionDef, catalog: ArsenalCatalog = ENEMY_BRANCHES): RegionAuthoringDef {
  const env = presetForGeography(region.geography);
  const byRound = new Map<number, RegionRoundMilestone>();
  const milestone = (r: number): RegionRoundMilestone => {
    let m = byRound.get(r);
    if (!m) {
      m = { round: r, add: [] };
      byRound.set(r, m);
    }
    return m;
  };
  for (const key of region.enemyBranches) {
    const branch = catalog[key];
    if (!branch) continue;
    const floor = region.branchDebutRounds?.[key] ?? 0;
    for (const node of branch.nodes) {
      if (!branch.implemented || !node.implemented) continue;
      const windows = region.nodeWindows?.[`${key}:${node.id}`];
      if (windows) {
        for (const w of windows) {
          milestone(w.from).add.push({ branch: key, nodeId: node.id });
          if (w.until !== null) (milestone(w.until).remove ??= []).push({ branch: key, nodeId: node.id });
        }
        continue;
      }
      const intro = Math.max(branch.openRound, node.gateRound, floor);
      milestone(intro).add.push({ branch: key, nodeId: node.id });
    }
  }
  for (const [r, rule] of Object.entries(region.roundPressure ?? {})) {
    const m = milestone(Number(r));
    m.pressure = { ...rule, branchCeilings: rule.branchCeilings ? { ...rule.branchCeilings } : undefined };
    if (m.pressure.branchCeilings === undefined) delete m.pressure.branchCeilings;
  }
  for (const b of region.beats ?? []) {
    const m = milestone(b.round);
    (m.beats ??= []).push({
      id: b.id,
      pattern: b.pattern,
      ref: { branch: b.branch, nodeId: b.nodeId },
      units: b.units,
      ...(b.groups !== null ? { groups: b.groups } : {}),
      budget: b.budget,
    });
  }
  for (const [r, text] of Object.entries(region.intelWarnings ?? {})) {
    milestone(Number(r)).intelWarning = text;
  }
  const milestones = [...byRound.values()].sort((a, b) => a.round - b.round);
  return {
    schemaVersion: 1,
    id: region.id,
    name: region.name,
    tagline: region.tagline,
    description: region.desc,
    completionRound: region.completionRound,
    environmentPresetId: env.id,
    shapeType: env.shapeType,
    campaign: { completionXp: region.completionXp, unlocks: region.unlocks },
    start: clone(region.start),
    pressure: {
      defaultBudget: region.budget ? { ...region.budget } : null,
      defaultBranchCeilings: { ...(region.branchUnitCeilings ?? {}) },
    },
    milestones,
  };
}

/** A blank region the designer builds up from nothing. */
export function blankRegion(id: string, start: RegionStartState): RegionAuthoringDef {
  return {
    schemaVersion: 1,
    id,
    name: 'New Region',
    tagline: '',
    description: '',
    completionRound: 8,
    environmentPresetId: 'openWater',
    shapeType: 'openWater',
    campaign: { completionXp: 0, unlocks: null },
    start: clone(start),
    pressure: { defaultBudget: null, defaultBranchCeilings: {} },
    milestones: [],
  };
}

// ---------------------------------------------------------------------------
// Editing helpers — pure transforms the UI calls
// ---------------------------------------------------------------------------

export function milestoneAt(def: RegionAuthoringDef, round: number, create: false): RegionRoundMilestone | undefined;
export function milestoneAt(def: RegionAuthoringDef, round: number, create: true): RegionRoundMilestone;
export function milestoneAt(def: RegionAuthoringDef, round: number, create: boolean): RegionRoundMilestone | undefined {
  let m = def.milestones.find((x) => x.round === round);
  if (!m && create) {
    m = { round, add: [] };
    def.milestones.push(m);
    def.milestones.sort((a, b) => a.round - b.round);
  }
  return m;
}

/** Drop a milestone that carries nothing, so an untouched round stays absent
 *  from the JSON. */
export function pruneMilestone(def: RegionAuthoringDef, round: number): void {
  const m = def.milestones.find((x) => x.round === round);
  if (!m) return;
  const empty =
    m.add.length === 0 &&
    (m.remove?.length ?? 0) === 0 &&
    (m.beats?.length ?? 0) === 0 &&
    !m.label &&
    !m.intelWarning &&
    (!m.pressure || Object.keys(m.pressure).length === 0);
  if (empty) def.milestones = def.milestones.filter((x) => x !== m);
}

/** Insert an empty round before `round`; later milestones shift down the
 *  timeline so authored pacing stays attached to its position. */
export function insertRound(def: RegionAuthoringDef, round: number): void {
  for (const m of def.milestones) if (m.round >= round) m.round++;
  def.completionRound++;
}

/** Remove a round; later milestones shift up. Authored changes ON the removed
 *  round are dropped (a removal window that ended there closes one earlier). */
export function deleteRound(def: RegionAuthoringDef, round: number): void {
  if (def.completionRound <= 1) return;
  def.milestones = def.milestones.filter((m) => m.round !== round);
  for (const m of def.milestones) if (m.round > round) m.round--;
  def.completionRound--;
}

export function duplicateRound(def: RegionAuthoringDef, from: number, to: number): void {
  const src = def.milestones.find((m) => m.round === from);
  if (!src) return;
  const copy = clone(src);
  copy.round = to;
  copy.beats = copy.beats?.map((b, i) => ({ ...b, id: `${b.id}-r${to}-${i}` }));
  def.milestones = def.milestones.filter((m) => m.round !== to);
  def.milestones.push(copy);
  def.milestones.sort((a, b) => a.round - b.round);
}

export function clearRound(def: RegionAuthoringDef, round: number): void {
  def.milestones = def.milestones.filter((m) => m.round !== round);
}

/** Cell state for one capability on one round, as the matrix draws it. */
export type CellState =
  | { kind: 'none' }
  | { kind: 'introduced'; from: number; until: number | null }
  | { kind: 'active'; from: number; until: number | null }
  | { kind: 'removed'; from: number }
  | { kind: 'gated'; earliest: number };

export function cellState(compiled: CompiledRegion, key: string, entry: ArsenalEntry, round: number): CellState {
  const ws = compiled.windows[key] ?? [];
  for (const w of ws) {
    if (round === w.from) return { kind: 'introduced', from: w.from, until: w.until };
    if (round > w.from && (w.until === null || round < w.until)) return { kind: 'active', from: w.from, until: w.until };
    if (w.until !== null && round === w.until && round > w.from) return { kind: 'removed', from: w.from };
    if (w.until !== null && round === w.until && round === w.from) return { kind: 'introduced', from: w.from, until: w.until };
  }
  if (round < entry.earliestRound) return { kind: 'gated', earliest: entry.earliestRound };
  return { kind: 'none' };
}
