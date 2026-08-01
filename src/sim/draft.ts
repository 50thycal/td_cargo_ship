// The mandatory post-round technology draft — the roguelite replacement for
// paid research (docs/design/roguelite-redesign.md → "Technology Reward
// Draft").
//
// After every successfully completed round the player is offered a small set
// of technologies from the EXISTING counter catalogue and must take exactly
// one; it activates immediately. Prerequisites and mutual exclusions are the
// catalogue's own rules, unchanged.
//
// WHAT SHAPES THE OFFER. Recovered wreckage was originally the only signal,
// and it was too narrow: a player mined for three rounds running who never had
// an escort free for salvage could go a whole run without ever seeing a mine
// counter. That is a loss to draft RNG rather than to play. The pool now reads
// the run:
//
//   • THREAT PRESSURE — how often each enemy branch has actually appeared,
//     what it has damaged, and what it has sunk, decayed by how long ago;
//   • WHETHER IT IS ANSWERED — a branch the player holds no counter to
//     outweighs one they have already solved, and its ENTRY node outweighs
//     its upgrades;
//   • OFFER RECENCY — something put on the table two drafts ago steps aside
//     so the draft keeps moving;
//   • RECOVERED WRECKAGE — still a strong steer, and still what widens the
//     draft from two options to three;
//   • PREREQUISITES and region availability — hard eligibility, unchanged.
//
// And a PITY RULE (see pityCandidates): when a threat has appeared repeatedly,
// the player has no basic counter for it, and none has been offered recently,
// an entry-level counter is forced into the draft. It never fills more than
// one slot, so the player always keeps a genuine choice — the guarantee is
// that a PATH exists, not that the perfect tool arrives.
//
// Randomness is preserved on purpose. The draft still rolls, still offers
// imperfect options, and is never guaranteed to hand over the ideal counter.
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
import type { CampaignState, ResearchId, TechDraft, ThreatPressure } from './types';

/** A fresh, empty pressure record. */
export function newThreatPressure(): ThreatPressure {
  return { rounds: 0, streak: 0, damage: 0, kills: 0, lastSeenRound: 0 };
}

/** Does the player hold a real answer to this enemy family yet?
 *
 *  "Real" excludes GRANTED entries: every run starts holding those, so
 *  counting them would report every threat as answered from round 1 and the
 *  unanswered-threat weighting would never fire. */
export function hasCounterFor(c: CampaignState, family: string): boolean {
  const owned = new Set(c.completedResearch);
  for (const entry of Object.values(RESEARCH_INDEX)) {
    if (entry.def.granted) continue;
    if (!entry.branch.counters.includes(family as never)) continue;
    if (owned.has(entry.def.id)) return true;
  }
  return false;
}

/** The entry-level (base) technologies that answer this enemy family and are
 *  currently offerable — what the pity rule reaches for. */
function entryCountersFor(
  family: string,
  owned: ReadonlySet<ResearchId>,
  allowed: ReadonlySet<string>,
): ResearchEntry[] {
  const out: ResearchEntry[] = [];
  for (const entry of Object.values(RESEARCH_INDEX)) {
    if (!entry.branch.counters.includes(family as never)) continue;
    // The branch's own first node — the basic counter, not an upgrade to it.
    if (entry.branch.nodes[0]?.id !== entry.def.id) continue;
    if (!eligible(entry, owned, allowed)) continue;
    out.push(entry);
  }
  return out;
}

/** How urgent this enemy family is right now: appearances, damage and kills,
 *  faded out by how long since it was last seen. Capped so one dominant threat
 *  cannot crowd every other option off the table. */
function pressureWeight(c: CampaignState, family: string): number {
  const p = c.threatPressure?.[family];
  if (!p || p.lastSeenRound <= 0) return 0;
  const raw =
    p.rounds * DRAFT.pressurePerEncounter +
    p.kills * DRAFT.pressurePerKill +
    p.damage * DRAFT.pressurePerDamage;
  // `c.round` is the round about to be played, so the round just resolved is
  // c.round - 1 and a threat seen in it is perfectly fresh.
  const staleness = Math.max(0, c.round - 1 - p.lastSeenRound);
  const recency = Math.max(0, 1 - staleness / DRAFT.pressureMemoryRounds);
  return Math.min(DRAFT.pressureCap, raw) * recency;
}

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
  // Cache per-family lookups: every entry in a branch asks the same questions.
  const pressureOf = new Map<string, number>();
  const answeredOf = new Map<string, boolean>();

  const pool: { entry: ResearchEntry; weight: number }[] = [];
  for (const entry of Object.values(RESEARCH_INDEX)) {
    if (!eligible(entry, owned, allowed)) continue;
    let weight = 1;
    const isEntryNode = entry.branch.nodes[0]?.id === entry.def.id;
    for (const family of entry.branch.counters) {
      // Wreckage steers the draft toward counters for what was recovered.
      const units = recoveredByBranch[family] ?? 0;
      if (units > 0) weight += units * DRAFT.branchWeightPerUnit;

      // Threat pressure: what this family has actually been doing to the run.
      if (!pressureOf.has(family)) pressureOf.set(family, pressureWeight(c, family));
      const pressure = pressureOf.get(family)!;
      if (pressure <= 0) continue;
      weight += pressure;

      // An UNANSWERED threat outweighs one the player has already solved, and
      // its basic counter outweighs upgrades to counters they don't own yet.
      if (!answeredOf.has(family)) answeredOf.set(family, hasCounterFor(c, family));
      if (!answeredOf.get(family)) {
        weight *= DRAFT.unansweredMult;
        if (isEntryNode) weight *= DRAFT.entryNodeMult;
      }
    }
    // Recovery beyond the breadth threshold improves QUALITY: deeper entries
    // gain weight in proportion to how deep they sit.
    if (excess > 0) weight *= 1 + excess * DRAFT.depthWeightPerUnit * entryDepth(entry);
    // Something offered in the last couple of drafts steps aside so the table
    // keeps moving — a declined option should not simply reappear.
    const offeredAt = c.lastOfferedRound?.[entry.def.id];
    if (offeredAt !== undefined && c.round - offeredAt <= DRAFT.offerCooldownRounds) {
      weight *= DRAFT.recentlyOfferedMult;
    }
    pool.push({ entry, weight: Math.max(0.01, weight) });
  }
  return pool;
}

/** Entry-level counters the PITY RULE says must be offered now: a threat that
 *  has appeared repeatedly, that the player still has no answer to, and whose
 *  basic counter has not been on the table recently.
 *
 *  This is the anti-unwinnable guarantee. It does not remove randomness — the
 *  rest of the draft still rolls normally, and this never claims more than
 *  DRAFT.pityMaxPerDraft of the slots. It only ensures a player always has a
 *  PATH to answer what is actually killing them. Returned most-pressing
 *  first, so the worst-served threat is the one that gets the slot. */
export function pityCandidates(
  c: CampaignState,
): { family: string; entries: ResearchEntry[]; pressure: number }[] {
  const region = regionDef(c.regionId);
  const allowed = new Set<string>(region.enemyBranches);
  const owned = effectiveResearch(c.completedResearch);
  const out: { family: string; entries: ResearchEntry[]; pressure: number }[] = [];

  for (const family of region.enemyBranches) {
    const p = c.threatPressure?.[family];
    if (!p || p.rounds < DRAFT.pityMinEncounters) continue;
    // Only fires while the threat is still live in the run: a branch the enemy
    // has stopped fielding is not an emergency.
    const staleness = Math.max(0, c.round - 1 - p.lastSeenRound);
    if (staleness > DRAFT.pressureMemoryRounds) continue;
    if (hasCounterFor(c, family)) continue;

    const entries = entryCountersFor(family, owned, allowed);
    if (entries.length === 0) continue;
    // Respect the grace window: a counter the player was recently shown (and
    // passed on) is not forced back onto the table immediately.
    const recentlyOffered = entries.every((e) => {
      const at = c.lastOfferedRound?.[e.def.id];
      return at !== undefined && c.round - at <= DRAFT.pityOfferGraceRounds;
    });
    if (recentlyOffered) continue;
    // The slack between "seen enough" and "forced" is what keeps the rule from
    // making every draft predictable — it fires within a round or two, not on
    // a fixed beat.
    if (p.rounds < DRAFT.pityMinEncounters + DRAFT.pityForceAfterRounds) continue;

    out.push({
      family,
      entries: entries.filter((e) => {
        const at = c.lastOfferedRound?.[e.def.id];
        return at === undefined || c.round - at > DRAFT.pityOfferGraceRounds;
      }),
      pressure: pressureWeight(c, family),
    });
  }
  return out
    .filter((p) => p.entries.length > 0)
    .sort((a, b) => b.pressure - a.pressure);
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
 *  widens it (third-option odds) and shapes it, alongside threat pressure and
 *  what the player can and cannot currently answer. The pity rule may claim
 *  one slot to guarantee an unanswered, repeatedly-encountered threat has a
 *  path. Returns fewer (or zero) options only when the eligible pool itself is
 *  that small — the catalogue is finite.
 *
 *  Records what was offered on the run so future drafts can step aside from
 *  recently-shown entries. */
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

  // The pity rule takes its slot(s) FIRST, so the guaranteed path is never
  // squeezed out by an unlucky roll — then the rest of the table is drawn
  // normally from the weighted pool with those entries removed.
  const options: ResearchId[] = [];
  const pityBranches: string[] = [];
  for (const candidate of pityCandidates(c)) {
    if (options.length >= DRAFT.pityMaxPerDraft || options.length >= choices - 1) break;
    // Which basic counter is still a roll — the rule guarantees a path, not a
    // specific tool.
    const pick = rng.pick(candidate.entries);
    if (!pick || options.includes(pick.def.id)) continue;
    options.push(pick.def.id);
    pityBranches.push(candidate.family);
  }

  const rest = pool.filter((p) => !options.includes(p.entry.def.id));
  options.push(...drawOptions(rest, choices - options.length, rng));

  for (const id of options) c.lastOfferedRound[id] = c.round;
  return {
    round: c.round,
    options,
    recoveredUnits,
    ...(pityBranches.length > 0 ? { pityBranches } : {}),
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
