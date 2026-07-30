// The mandatory post-round technology draft — the roguelite replacement for
// paid research (docs/design/roguelite-redesign.md → "Technology Reward
// Draft").
//
// After every successfully completed round the player is offered a small set
// of technologies from the EXISTING counter catalogue and must take exactly
// one; it activates immediately. Prerequisites and mutual exclusions are the
// catalogue's own rules, unchanged. What the round's recovered wreckage did
// is shape the draft:
//
//   • more recovery → better odds of a third option;
//   • wreckage from a threat family weights the draft toward branches that
//     counter that family (torpedo wreckage favours hydrophones and depth
//     charges without ever guaranteeing them);
//   • recovery beyond the breadth threshold starts favouring DEEPER entries.
//
// Region awareness: branches whose countered enemy families cannot appear in
// the active region are never offered, so early draft pools stay readable and
// no slot is wasted on unusable tech. Generic survivability/logistics/support
// branches stay broadly available.

import { CAMPAIGN, DRAFT } from '../data/tuning';
import { regionDef } from '../data/regions';
import {
  COUNTER_CATEGORY_NAMES,
  effectiveResearch,
  RESEARCH_INDEX,
  type CounterTacticDef,
  type ResearchEntry,
} from '../data/counters';
import { ENEMY_BRANCHES } from '../data/enemyBranches';
import type { RNG } from './rng';
import type { CampaignState, ResearchId, TechDraft } from './types';

/** Is this catalogue entry offerable in the active region, given what the
 *  player already holds? Pure eligibility — weighting happens separately. */
function eligible(
  entry: ResearchEntry,
  owned: ReadonlySet<ResearchId>,
  allowedEnemyBranches: ReadonlySet<string>,
): boolean {
  if (entry.def.granted) return false; // built-ins arrive on their own
  if (owned.has(entry.def.id)) return false;
  if (!entry.requires.every((r) => owned.has(r))) return false;
  const excludes = (entry.def as CounterTacticDef).excludes;
  if (excludes?.some((x) => owned.has(x))) return false;
  // Region awareness: a branch that only counters families this region cannot
  // field is dead weight in the draft. Branches with no counters (damage
  // control, logistics, support) stay broadly available.
  const counters = entry.branch.counters;
  if (counters.length > 0) {
    const live = counters.some(
      (key) => allowedEnemyBranches.has(key) && ENEMY_BRANCHES[key].implemented,
    );
    if (!live) return false;
  }
  return true;
}

/** How deep an entry sits in its branch, 0 (entry node) → 1 (deepest). Drives
 *  the quality scaling: heavy recovery rounds favour later tech. */
function entryDepth(entry: ResearchEntry): number {
  const branch = entry.branch;
  const list = entry.isTactic ? branch.tactics : branch.nodes;
  const idx = list.findIndex((d) => d.id === entry.def.id);
  const span = branch.nodes.length + branch.tactics.length - 1;
  if (span <= 0 || idx < 0) return 0;
  return (idx + (entry.isTactic ? branch.nodes.length : 0)) / span;
}

/** Every entry currently offerable, with its draft weight. Exported for tests
 *  and for the (deterministic) generation below. */
export function draftPool(
  c: CampaignState,
  recoveredByBranch: Record<string, number>,
): { entry: ResearchEntry; weight: number }[] {
  const region = regionDef(c.regionId);
  const allowed = new Set<string>(region.enemyBranches);
  const owned = effectiveResearch(c.completedResearch);
  const recoveredTotal = Object.values(recoveredByBranch).reduce((a, b) => a + b, 0);
  const excess = Math.max(0, recoveredTotal - DRAFT.qualityThreshold);

  const pool: { entry: ResearchEntry; weight: number }[] = [];
  for (const entry of Object.values(RESEARCH_INDEX)) {
    if (!eligible(entry, owned, allowed)) continue;
    let weight = 1;
    // Wreckage steers the draft toward counters for what was recovered.
    for (const family of entry.branch.counters) {
      const units = recoveredByBranch[family] ?? 0;
      if (units > 0) weight += units * DRAFT.branchWeightPerUnit;
    }
    // Recovery beyond the breadth threshold improves QUALITY: deeper entries
    // gain weight in proportion to how deep they sit.
    if (excess > 0) weight *= 1 + excess * DRAFT.depthWeightPerUnit * entryDepth(entry);
    pool.push({ entry, weight });
  }
  return pool;
}

/** Weighted draw without replacement; same-branch repeats are damped so a
 *  draft tends to offer distinct branches. Deterministic under the run RNG. */
function drawOptions(
  pool: { entry: ResearchEntry; weight: number }[],
  count: number,
  rng: RNG,
): ResearchId[] {
  const remaining = pool.map((p) => ({ ...p }));
  const picked: ResearchId[] = [];
  while (picked.length < count && remaining.length > 0) {
    const total = remaining.reduce((sum, p) => sum + p.weight, 0);
    let roll = rng.next() * total;
    let idx = 0;
    for (; idx < remaining.length - 1; idx++) {
      roll -= remaining[idx].weight;
      if (roll <= 0) break;
    }
    const chosen = remaining.splice(idx, 1)[0];
    picked.push(chosen.entry.def.id);
    for (const p of remaining) {
      if (p.entry.branch.id === chosen.entry.branch.id) {
        p.weight *= DRAFT.sameBranchRepeatMult;
      }
    }
  }
  return picked;
}

/** Build the mandatory draft a successfully completed round has earned.
 *
 *  A successful round ALWAYS grants a draft even with zero recovery; recovery
 *  widens it (third-option odds) and shapes it (branch + depth weighting).
 *  Returns a draft with fewer (or zero) options only when the eligible pool
 *  itself is that small — the catalogue is finite. */
export function generateDraft(
  c: CampaignState,
  recoveredByBranch: Record<string, number>,
  rng: RNG,
): TechDraft {
  const pool = draftPool(c, recoveredByBranch);
  const recoveredUnits = Object.values(recoveredByBranch).reduce((a, b) => a + b, 0);
  let choices = DRAFT.baseChoices;
  const thirdChance = Math.min(1, recoveredUnits * DRAFT.thirdChoicePerUnit);
  if (thirdChance > 0 && rng.chance(thirdChance)) choices++;
  return {
    round: c.round,
    options: drawOptions(pool, choices, rng),
    recoveredUnits,
  };
}

/** Why a draft option cannot be taken (null = it can). */
export function draftBlockReason(c: CampaignState, id: ResearchId): string | null {
  if (!c.pendingDraft) return 'No draft pending';
  if (!c.pendingDraft.options.includes(id)) return 'Not one of the offered options';
  if (!RESEARCH_INDEX[id]) return 'Unknown technology';
  return null;
}

/** Take one option from the pending draft. Activates IMMEDIATELY (the reward
 *  applies to the very next transit), records the pick for telemetry, and
 *  releases the run into the prep phase. */
export function selectDraftOption(c: CampaignState, id: ResearchId): boolean {
  if (draftBlockReason(c, id) !== null) return false;
  c.completedResearch.push(id);
  const draft = c.pendingDraft!;
  c.draftHistory.push({ round: draft.round, offered: [...draft.options], picked: id });
  c.pendingDraft = null;
  if (c.phase === 'draft') c.phase = 'prep';
  // Expanded Berthing keeps its immediate capacity effect under the draft
  // economy (it used to fire on research completion).
  if (id === 'logistics.expandedBerthing') {
    c.capacity = Math.min(CAMPAIGN.maxCapacity, c.capacity + 5);
  }
  return true;
}

/** An empty draft (exhausted catalogue) cannot demand a pick: acknowledge it
 *  and move on. The ONLY legal way past a draft without choosing. */
export function dismissEmptyDraft(c: CampaignState): boolean {
  if (!c.pendingDraft || c.pendingDraft.options.length > 0) return false;
  c.draftHistory.push({ round: c.pendingDraft.round, offered: [], picked: null });
  c.pendingDraft = null;
  if (c.phase === 'draft') c.phase = 'prep';
  return true;
}

/** Branch metadata for a draft option, resolved for the UI. */
export function draftOptionInfo(id: ResearchId): {
  name: string;
  desc: string;
  branchName: string;
  categoryName: string;
  isTactic: boolean;
} | null {
  const entry = RESEARCH_INDEX[id];
  if (!entry) return null;
  return {
    name: entry.def.name,
    desc: entry.def.desc,
    branchName: entry.branch.name,
    categoryName: COUNTER_CATEGORY_NAMES[entry.branch.category],
    isTactic: entry.isTactic,
  };
}

/** True when the entry's branch counters something this region can field —
 *  exported so tests can assert region awareness without duplicating rules. */
export function optionLegalInRegion(c: CampaignState, id: ResearchId): boolean {
  const entry = RESEARCH_INDEX[id];
  if (!entry) return false;
  const region = regionDef(c.regionId);
  if (entry.branch.counters.length === 0) return true;
  return entry.branch.counters.some((key) => region.enemyBranches.includes(key));
}
