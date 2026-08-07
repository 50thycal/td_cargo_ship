// The mandatory post-round technology draft — the roguelite replacement for
// paid research (docs/design/roguelite-redesign.md → "Technology Reward
// Draft").
//
// After every successfully completed round the player is offered a small set
// of technologies from the EXISTING counter catalogue and must take exactly
// one; it activates immediately. Prerequisites and mutual exclusions are the
// catalogue's own rules, unchanged.
//
// THE TABLE HAS TWO SEATS WITH DIFFERENT JOBS.
//
//   • the COUNTER SLOT belongs to the worst-covered live threat. Whatever is
//     actually getting through to the convoy has a seat at every draft, drawn
//     from the branches that answer it, preferring something that can REMOVE
//     the threat over something that merely sees it, and a new tool over a
//     fifth upgrade to the tool that is already failing;
//   • the DEVELOPMENT SLOT(s) are drawn from the open weighted pool as before
//     — upgrades, generalists, logistics, whatever the run has earned.
//
// So the choice every round is the same honest one: solve the bleeding, or
// compound the thing that is working. The player can still choose wrong and
// still lose to mines; what they can no longer do is go a whole run without
// being shown an answer.
//
// WHY THIS REPLACED THE PITY RULE. Pity was a probabilistic backstop with a
// narrow timing window (a threat had to be encountered in three separate
// rounds) and a boolean off-switch (`hasCounterFor`). In a logged run the
// window opened for exactly one round, the player took an A-10 upgrade
// instead, and because the A-10 branch nominally counters BOTH mines and
// attack boats the switch flipped to "solved" — permanently disabling the rule
// through nine more mine kills and ten more boat kills. Across eight drafts
// that run was never once offered a minesweeping drone, a deck gun, a mine
// sonar or an anti-boarding fit: the four branches that answered 21 of its 22
// combat losses. A guarantee that an unlucky roll and one wrong pick can switch
// off is not a guarantee.
//
// WHAT SHAPES THE OFFER:
//
//   • THREAT PRESSURE — how often each enemy branch has appeared, what it has
//     damaged and what it has sunk, decayed by how long ago;
//   • COVERAGE — what fraction of that branch the player is ACTUALLY
//     neutralizing, measured from the water (mines swept out of mines laid,
//     boats sunk out of boats launched) rather than inferred from the
//     catalogue. The draft weights the GAP between pressure and coverage, so
//     owning a counter that is not working does not close the subject;
//   • OFFER RECENCY — something put on the table two drafts ago steps aside;
//   • RECOVERED WRECKAGE — still a strong steer, and still what widens the
//     draft from two options to three;
//   • PREREQUISITES and region availability — hard eligibility, unchanged.
//
// AND THE PICK ARRIVES USABLE. A drafted `deckGun.base` used to grant only the
// RIGHT TO BUY a deck gun next phase, so the draft asked the player to weigh an
// IOU with a round of delay against an instant ability upgrade — which is a
// second, independent reason the specialists lost even when they were offered.
// A pick that unlocks hardware now fits one free unit of it (see
// draftEquipmentGrant); further copies still cost cash.
//
// Randomness is preserved on purpose. The counter slot fixes the CATEGORY, not
// the card: which answer arrives is still a roll, the development slots are
// still open, and the draft still offers imperfect tables.
//
// Region awareness: branches whose countered enemy families cannot appear in
// the active region are never offered, so early draft pools stay readable and
// no slot is wasted on unusable tech. Generic survivability/logistics/support
// branches stay broadly available.

import { CAMPAIGN, DRAFT } from '../data/tuning';
import { regionDef } from '../data/regions';
import {
  BASE_MODULE_RESEARCH_REQUIREMENT,
  COUNTER_CATEGORY_NAMES,
  ESCORT_MODULE_RESEARCH_REQUIREMENT,
  effectiveResearch,
  MODULE_RESEARCH_REQUIREMENT,
  RESEARCH_INDEX,
  type CounterRole,
  type CounterTacticDef,
  type ResearchEntry,
} from '../data/counters';
import {
  BASE_MODULE_SLOTS,
  BASE_MODULES,
  ESCORT_MODULE_SLOTS,
  ESCORT_MODULE_SLOTS_UNLOCKED,
  ESCORT_MODULES,
  MODULES,
  SHIP_CLASSES,
} from '../data/defs';
import { ENEMY_BRANCHES } from '../data/enemyBranches';
import type { RNG } from './rng';
import type {
  BaseModuleId,
  CampaignState,
  EscortModuleId,
  ModuleId,
  ResearchId,
  ShipClassId,
  TechDraft,
  ThreatCoverage,
  ThreatPressure,
  TransitStats,
} from './types';

/** A fresh, empty pressure record. */
export function newThreatPressure(): ThreatPressure {
  return { rounds: 0, streak: 0, damage: 0, kills: 0, lastSeenRound: 0 };
}

/** A fresh, empty coverage record. Coverage starts UNMEASURED rather than at
 *  zero: a branch that has never been fielded is not a threat the player is
 *  failing to stop. */
export function newThreatCoverage(): ThreatCoverage {
  return { ratio: 0, fielded: 0, neutralized: 0, lastMeasuredRound: 0 };
}

// ---------------------------------------------------------------------------
// Coverage — what the player is ACTUALLY stopping
// ---------------------------------------------------------------------------

/** Roles that genuinely answer a threat: they remove it or blunt its effect.
 *
 *  `detect` is deliberately excluded. Seeing a mine is not sweeping a mine, and
 *  treating detection as an answer is how a run ends up holding three Scan
 *  Pulse upgrades while mines sink eight hulls. `disrupt` (defensive smoke) and
 *  `support` are excluded for the same reason — useful, but not an answer. */
const ANSWERING_ROLES: ReadonlySet<CounterRole> = new Set<CounterRole>(['attack', 'mitigate']);

/** One round's measurement for one enemy branch. */
interface CoverageSample {
  fielded: number;
  neutralized: number;
}

/** What each enemy branch put in the water this round, and how much of it the
 *  player took off the board.
 *
 *  Only branches with an honest neutralized/fielded pair appear. Artillery and
 *  enemy smoke have no such pair in the round stats (there is no count of guns
 *  emplaced or clouds that mattered), so they are left unmeasured and fall back
 *  to the ownership estimate in familyCoverage rather than being scored on a
 *  number that does not mean what it would need to mean.
 *
 *  Mines are the one blended case. A mine DESTROYED is fully neutralized; a
 *  mine merely REVEALED and then steered around is a real but partial answer —
 *  the hull survived, the minefield did not go away — so it earns partial
 *  credit. A mine that detonated, and one that was never seen at all, earn
 *  nothing. */
export function measureRoundCoverage(s: TransitStats): Record<string, CoverageSample> {
  const out: Record<string, CoverageSample> = {};
  const add = (family: string, fielded: number, neutralized: number): void => {
    if (fielded <= 0) return;
    out[family] = { fielded, neutralized: Math.max(0, Math.min(fielded, neutralized)) };
  };

  add('missiles', s.missilesSpawned, s.missilesIntercepted);
  add(
    'mines',
    s.minesTotal,
    s.minesSwept + DRAFT.coverageRevealCredit * Math.max(0, s.minesRevealed - s.minesSwept),
  );
  add('torpedoes', s.torpedoesLaunched, s.torpedoesDestroyed);
  add('attackBoats', s.boatsLaunched, s.boatsSunk);
  add('electronic', s.reconPlanes + s.disablingDrones, s.aircraftDowned);
  return out;
}

/** Fold this round's measurement into the run's rolling coverage.
 *
 *  The first measurement is taken as-is rather than smoothed up from zero: a
 *  round that stopped five of six missiles should read as 0.83, not as 0.46
 *  because the run started with an assumed-zero prior. */
export function recordThreatCoverage(c: CampaignState, s: TransitStats, round: number): void {
  c.threatCoverage ??= {};
  for (const [family, sample] of Object.entries(measureRoundCoverage(s))) {
    const cov = (c.threatCoverage[family] ??= newThreatCoverage());
    const measured = sample.neutralized / sample.fielded;
    cov.ratio =
      cov.lastMeasuredRound === 0
        ? measured
        : cov.ratio + (measured - cov.ratio) * DRAFT.coverageSmoothing;
    cov.fielded += sample.fielded;
    cov.neutralized += sample.neutralized;
    cov.lastMeasuredRound = round;
  }
}

/** Does the player hold a real answer to this enemy family — something that can
 *  remove or blunt it, not merely see it?
 *
 *  "Real" also excludes GRANTED entries: every run starts holding those, so
 *  counting them would report every threat as answered from round 1. */
export function hasCounterFor(c: CampaignState, family: string): boolean {
  const owned = new Set(c.completedResearch);
  for (const entry of Object.values(RESEARCH_INDEX)) {
    if (entry.def.granted) continue;
    if (!ANSWERING_ROLES.has(entry.branch.role)) continue;
    if (!entry.branch.counters.includes(family as never)) continue;
    if (owned.has(entry.def.id)) return true;
  }
  return false;
}

/** How much of this enemy family the player is neutralizing, 0..1.
 *
 *  Measured where the round stats support it. Where they do not — a branch that
 *  fielded nothing measurable, or one with no honest sample to take — it falls
 *  back to what the player OWNS: an idle branch the player has a real answer to
 *  reads as mostly handled, and one they have nothing for reads as wide open. */
export function familyCoverage(c: CampaignState, family: string): number {
  const cov = c.threatCoverage?.[family];
  if (cov && cov.lastMeasuredRound > 0) return Math.max(0, Math.min(1, cov.ratio));
  return hasCounterFor(c, family) ? DRAFT.coverageIdleWithCounter : 0;
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

/** How badly this family is being handled right now: how much it is hurting
 *  the run, times how much of it is still getting through. This single number
 *  is what the counter slot ranks on — it is high for a threat that is both
 *  live and unanswered, and falls to nothing when EITHER the threat stops
 *  appearing or the player starts actually stopping it. */
export function familyDeficit(c: CampaignState, family: string): number {
  const gap = 1 - familyCoverage(c, family);
  return pressureWeight(c, family) * gap;
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

/** Is this the first (basic) node of its branch? */
function isEntryNode(entry: ResearchEntry): boolean {
  return entry.branch.nodes[0]?.id === entry.def.id;
}

/** Is this branch's capability already in the player's hands?
 *
 *  The test is the BASE NODE, and a granted base counts. The A-10 is flying
 *  from round one whether or not a single warthog node has been drafted, so a
 *  longer strafing pass is deepening something that exists, not acquiring a new
 *  answer — and treating it as new is precisely how a run gets fed gun-run
 *  upgrades while mines sink eight hulls. A minesweeping drone, by contrast, is
 *  a capability the fleet simply does not have until its base node is drafted. */
function branchInService(c: CampaignState, entry: ResearchEntry): boolean {
  const base = entry.branch.nodes[0];
  if (!base) return false;
  return effectiveResearch(c.completedResearch).has(base.id);
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
  const gapOf = new Map<string, number>();

  const pool: { entry: ResearchEntry; weight: number }[] = [];
  for (const entry of Object.values(RESEARCH_INDEX)) {
    if (!eligible(entry, owned, allowed)) continue;
    let weight = 1;
    // The coverage gap is taken as the WORST across the families this branch
    // answers, and applied ONCE. It used to be applied inside the per-family
    // loop, which compounded: a branch nominally answering two open threats
    // took 2.4² and one answering four took 2.4³, so the generalists
    // (A-10, defensive smoke) priced themselves above every specialist at
    // being counters while being worse counters. Breadth still earns more
    // weight — it accumulates PRESSURE from each family below — it just no
    // longer earns it geometrically.
    let worstGap = 0;
    let pressureSum = 0;
    let liveFamilies = 0;
    for (const family of entry.branch.counters) {
      // Wreckage steers the draft toward counters for what was recovered.
      const units = recoveredByBranch[family] ?? 0;
      if (units > 0) weight += units * DRAFT.branchWeightPerUnit;

      // Threat pressure: what this family has actually been doing to the run.
      if (!pressureOf.has(family)) pressureOf.set(family, pressureWeight(c, family));
      const pressure = pressureOf.get(family)!;
      if (pressure <= 0) continue;
      pressureSum += pressure;
      liveFamilies++;

      if (!gapOf.has(family)) gapOf.set(family, 1 - familyCoverage(c, family));
      worstGap = Math.max(worstGap, gapOf.get(family)!);
    }
    // Breadth earns more weight, but SUB-linearly. One A-10 that strafes both
    // mines and attack boats is not a minesweeper plus a gun boat — it is one
    // sortie a round divided between two jobs — so a branch claiming several
    // live families banks the sum of their pressure damped by how thinly it is
    // spread. Without this the generalists collect full credit for every threat
    // they nominally touch and price themselves above the specialists that
    // actually remove one.
    if (liveFamilies > 0) {
      weight += pressureSum / Math.pow(liveFamilies, DRAFT.breadthDampingExponent);
    }
    if (worstGap > 0) {
      // A threat getting through untouched pays the full multiplier; one the
      // player is mostly stopping pays almost none. Smooth, not a cliff.
      weight *= 1 + (DRAFT.coverageGapMult - 1) * worstGap;
      // The basic counter should surface before its upgrades — and more so the
      // wider the gap.
      if (isEntryNode(entry)) weight *= 1 + (DRAFT.entryNodeMult - 1) * worstGap;
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

// ---------------------------------------------------------------------------
// The counter slot
// ---------------------------------------------------------------------------

/** The live threats with a real coverage deficit, worst first — the queue the
 *  counter slot works down.
 *
 *  A family qualifies while it is BOTH hurting the run and getting through. It
 *  drops off the queue when the enemy stops fielding it (pressure decays) or
 *  when the player starts genuinely stopping it (coverage rises) — never
 *  because the player happens to own a piece of tech pointed in its direction. */
export function counterCandidates(
  c: CampaignState,
): { family: string; deficit: number; coverage: number }[] {
  const region = regionDef(c.regionId);
  const out: { family: string; deficit: number; coverage: number }[] = [];
  for (const family of region.enemyBranches) {
    if (!ENEMY_BRANCHES[family].implemented) continue;
    const deficit = familyDeficit(c, family);
    if (deficit < DRAFT.counterSlotMinDeficit) continue;
    out.push({ family, deficit, coverage: familyCoverage(c, family) });
  }
  return out.sort((a, b) => b.deficit - a.deficit);
}

/** The offerable entries that answer one family, weighted for the counter
 *  slot. This is a different question from the open pool's: not "what is
 *  interesting right now" but "what would most help against THIS". */
export function counterSlotPool(
  c: CampaignState,
  family: string,
): { entry: ResearchEntry; weight: number }[] {
  const region = regionDef(c.regionId);
  const allowed = new Set<string>(region.enemyBranches);
  const owned = effectiveResearch(c.completedResearch);
  const pool: { entry: ResearchEntry; weight: number; fresh: boolean }[] = [];
  for (const entry of Object.values(RESEARCH_INDEX)) {
    if (!entry.branch.counters.includes(family as never)) continue;
    if (!eligible(entry, owned, allowed)) continue;
    let weight = 1;
    // Something that can take the threat off the board beats something that
    // only reports it.
    if (ANSWERING_ROLES.has(entry.branch.role)) weight *= DRAFT.counterSlotAttackMult;
    const fresh = !branchInService(c, entry);
    // A tool the player does not have at all beats another upgrade to one
    // already in service. (Only meaningful in the fall-through case below —
    // inside a fresh-only draw every candidate qualifies.)
    if (fresh && isEntryNode(entry)) weight *= DRAFT.counterSlotNewBranchMult;
    const offeredAt = c.lastOfferedRound?.[entry.def.id];
    if (offeredAt !== undefined && c.round - offeredAt <= DRAFT.offerCooldownRounds) {
      weight *= DRAFT.counterSlotRecentMult;
    }
    pool.push({ entry, weight: Math.max(0.01, weight), fresh });
  }

  // While the threat is genuinely getting through, the counter slot owes the
  // player a NEW capability — something that changes what the fleet can do
  // about it — not a stat bump to a branch already in service and already
  // failing to cope. This is the loophole that made the old guarantee hollow:
  // a longer A-10 strafing pass counts as "a mine counter" by the catalogue
  // and answers nothing about eight hulls on the bottom. Once every fresh
  // answer has been drafted the slot rightly falls through to deepening what
  // is there.
  if (familyCoverage(c, family) < DRAFT.coverageAnsweredAt) {
    const fresh = pool.filter((p) => p.fresh);
    if (fresh.length > 0) return fresh.map(({ entry, weight }) => ({ entry, weight }));
  }
  return pool.map(({ entry, weight }) => ({ entry, weight }));
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

/** Fill the counter slot: work down the deficit queue and take the first
 *  family that still has something to offer. Returns null when no live threat
 *  is under-covered, or when every answer to the ones that are has already
 *  been drafted — in both cases the slot simply reverts to an ordinary
 *  development draw and the table stays full. */
function drawCounterSlot(
  c: CampaignState,
  rng: RNG,
): { id: ResearchId; family: string } | null {
  for (const candidate of counterCandidates(c)) {
    const pool = counterSlotPool(c, candidate.family);
    if (pool.length === 0) continue; // exhausted — try the next-worst threat
    const [id] = drawOptions(pool, 1, rng);
    if (id) return { id, family: candidate.family };
  }
  return null;
}

/** Build the mandatory draft a successfully completed round has earned.
 *
 *  A successful round ALWAYS grants a draft even with zero recovery; recovery
 *  widens it (third-option odds) and shapes it. The COUNTER SLOT takes its seat
 *  first so the guarantee is never squeezed out by an unlucky roll, and never
 *  claims more than one seat so the player always keeps a real choice. Returns
 *  fewer (or zero) options only when the eligible pool itself is that small —
 *  the catalogue is finite.
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

  const options: ResearchId[] = [];
  let counterFamily: string | undefined;
  let counterOption: ResearchId | undefined;
  // The counter slot never takes the last seat: a forced option that filled the
  // whole table would make the draft an announcement rather than a choice.
  if (choices >= 2) {
    const counter = drawCounterSlot(c, rng);
    if (counter) {
      options.push(counter.id);
      counterFamily = counter.family;
      counterOption = counter.id;
    }
  }

  // The development draw has to know what the counter slot already put on the
  // table, or the two draws happily produce three upgrades to the same branch —
  // which is the table the player complained about in the first place. Same
  // damping the development draw applies to itself.
  const counterBranch = counterOption ? RESEARCH_INDEX[counterOption]?.branch.id : null;
  const rest = pool
    .filter((p) => !options.includes(p.entry.def.id))
    .map((p) => ({
      entry: p.entry,
      weight: p.entry.branch.id === counterBranch ? p.weight * DRAFT.sameBranchRepeatMult : p.weight,
    }));
  options.push(...drawOptions(rest, choices - options.length, rng));
  // Shuffle so the counter slot is not always the first card. Its position must
  // carry no meaning — the badge on the card is what identifies it. A fixed
  // seat trains "always take the left one", which is the same reflex the draft
  // exists to replace with a decision.
  rng.shuffle(options);

  for (const id of options) c.lastOfferedRound[id] = c.round;
  return {
    round: c.round,
    options,
    recoveredUnits,
    ...(counterFamily ? { counterFamily, counterOption } : {}),
  };
}

// ---------------------------------------------------------------------------
// Hardware that comes with the technology
// ---------------------------------------------------------------------------

/** One free fitting a draft pick brings with it. */
export interface DraftEquipmentGrant {
  kind: 'cargoModule' | 'escortModule' | 'baseModule';
  /** The module id being fitted. */
  moduleId: ModuleId | EscortModuleId | BaseModuleId;
  /** Display name of the module. */
  name: string;
  /** Ship class the class-module fit lands on (cargo modules only). */
  classId?: ShipClassId;
  /** Escort receiving the fit (escort modules only). */
  escortId?: number;
  /** Where it lands, in words, for the draft card and the AAR. */
  placement: string;
}

/** Escort specialist slots right now. Duplicated from campaign.ts rather than
 *  imported because campaign.ts imports THIS module. */
function escortSlotCount(c: CampaignState): number {
  return effectiveResearch(c.completedResearch).has('logistics.escortRefitBay')
    ? ESCORT_MODULE_SLOTS_UNLOCKED
    : ESCORT_MODULE_SLOTS;
}

/** The ship class carrying the most value in the convoy as currently composed
 *  — where a single free class fit does the most good. Falls back to the fleet
 *  when nothing has been composed yet. */
function richestClass(c: CampaignState): ShipClassId | null {
  let best: ShipClassId | null = null;
  let bestValue = 0;
  for (const classId of Object.keys(SHIP_CLASSES) as ShipClassId[]) {
    const count = c.composition?.[classId] || c.fleet?.[classId] || 0;
    const value = count * SHIP_CLASSES[classId].value;
    if (value > bestValue) {
      bestValue = value;
      best = classId;
    }
  }
  return best;
}

/** What taking this draft option would fit for free, or null if nothing.
 *
 *  Only a pick that UNLOCKS hardware grants any — the node the purchase gate
 *  names, and only while the player cannot field the thing yet. Upgrades to
 *  equipment already in service grant nothing, and a second free copy is never
 *  handed out. Pure: the UI calls it to print the promise on the card, and
 *  selectDraftOption calls it to keep it. */
export function draftEquipmentGrant(
  c: CampaignState,
  id: ResearchId,
): DraftEquipmentGrant | null {
  const entry = RESEARCH_INDEX[id];
  const equipment = entry?.branch.equipment;
  if (!equipment) return null;

  if (equipment.kind === 'cargoModule') {
    const moduleId = equipment.id;
    if (MODULE_RESEARCH_REQUIREMENT[moduleId] !== id) return null;
    // Already fitted somewhere: the technology is not what was missing.
    if (Object.values(c.classModules).some((mods) => mods.includes(moduleId))) return null;
    const classId = richestClass(c);
    if (!classId) return null;
    if (c.classModules[classId].length >= SHIP_CLASSES[classId].slots) return null;
    return {
      kind: 'cargoModule',
      moduleId,
      name: MODULES[moduleId].name,
      classId,
      placement: `fitted across the ${SHIP_CLASSES[classId].name} class`,
    };
  }

  if (equipment.kind === 'escortModule') {
    const moduleId = equipment.id;
    if (ESCORT_MODULE_RESEARCH_REQUIREMENT[moduleId] !== id) return null;
    if (c.escortUnits.some((e) => e.modules.includes(moduleId))) return null;
    const slots = escortSlotCount(c);
    // The least-loaded escort with room — a specialist fit should not crowd out
    // a hull that is already carrying two jobs.
    const host = c.escortUnits
      .filter((e) => e.modules.length < slots)
      .sort((a, b) => a.modules.length - b.modules.length)[0];
    if (!host) return null;
    return {
      kind: 'escortModule',
      moduleId,
      name: ESCORT_MODULES[moduleId].name,
      escortId: host.id,
      placement: `fitted to ${host.name}`,
    };
  }

  // `ability` and `builtIn` branches have no hardware to fit: the A-10, the
  // scan pulse and defensive smoke are already in the player's hands, and
  // their consumables are round stock bought in preparation. They never had
  // the IOU problem this grant exists to fix.
  if (equipment.kind !== 'baseModule') return null;
  const moduleId = equipment.id;
  if (BASE_MODULE_RESEARCH_REQUIREMENT[moduleId] !== id) return null;
  if (c.baseModules.includes(moduleId)) return null;
  if (c.baseModules.length >= BASE_MODULE_SLOTS) return null;
  return {
    kind: 'baseModule',
    moduleId,
    name: BASE_MODULES[moduleId].name,
    placement: 'fitted to the shore batteries',
  };
}

/** Fit what the pick brought with it. Everything is recorded as having cost
 *  ZERO, so unequipping refunds nothing — a free fit must never become a cash
 *  press through the shop's refund path. */
function applyEquipmentGrant(c: CampaignState, grant: DraftEquipmentGrant): void {
  if (grant.kind === 'cargoModule' && grant.classId) {
    const moduleId = grant.moduleId as ModuleId;
    c.classModules[grant.classId].push(moduleId);
    (c.modulePaid[grant.classId] ??= {})[moduleId] = 0;
    return;
  }
  if (grant.kind === 'escortModule' && grant.escortId !== undefined) {
    const escort = c.escortUnits.find((e) => e.id === grant.escortId);
    if (!escort) return;
    escort.modules.push(grant.moduleId as EscortModuleId);
    escort.modulePaid[grant.moduleId as EscortModuleId] = 0;
    return;
  }
  if (grant.kind === 'baseModule') {
    c.baseModules.push(grant.moduleId as BaseModuleId);
    c.baseModulePaid[grant.moduleId as BaseModuleId] = 0;
  }
}

// ---------------------------------------------------------------------------
// Taking the pick
// ---------------------------------------------------------------------------

/** Why a draft option cannot be taken (null = it can). */
export function draftBlockReason(c: CampaignState, id: ResearchId): string | null {
  if (!c.pendingDraft) return 'No draft pending';
  if (!c.pendingDraft.options.includes(id)) return 'Not one of the offered options';
  if (!RESEARCH_INDEX[id]) return 'Unknown technology';
  return null;
}

/** Take one option from the pending draft. Activates IMMEDIATELY (the reward
 *  applies to the very next transit), fits any hardware the pick unlocks,
 *  records the pick for telemetry, and releases the run into the prep phase. */
export function selectDraftOption(c: CampaignState, id: ResearchId): boolean {
  if (draftBlockReason(c, id) !== null) return false;
  // Resolved BEFORE the research lands: the grant asks whether the player can
  // field the hardware yet, and taking the node is exactly what changes that
  // answer.
  const grant = draftEquipmentGrant(c, id);
  c.completedResearch.push(id);
  if (grant) applyEquipmentGrant(c, grant);
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
