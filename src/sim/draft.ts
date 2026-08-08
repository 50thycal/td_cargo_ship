// The mandatory post-round technology draft — the roguelite replacement for
// paid research (docs/design/roguelite-redesign.md → "Technology Reward
// Draft").
//
// After every successfully completed round the player is offered a small set of
// rewards and must take exactly one; it takes effect immediately.
//
// FOUR CATEGORIES, because a draft hands over four different kinds of thing and
// the player should never have to work out which they are looking at:
//
//   • UPGRADE — a branch node or tactic. Free, permanent, and applied to EVERY
//     copy of that system the fleet carries: effects resolve per branch, so
//     fitting three self-defense mounts and drafting one accuracy node upgrades
//     all three. You never upgrade a module, you upgrade a BRANCH.
//   • MODULE — one physical unit of equipment, held as stock and fitted for
//     free. Cargo units fit a whole ship class and survive anything; escort
//     units arm one hull and go down with her.
//   • ASSET — a change to the fleet's shape: berthing, slots, repair, salvage.
//   • ORDNANCE — a one-off crate of consumables. Deliberately the weakest
//     category, and it exists for one reason: a draft with nothing useful left
//     to offer should still offer something real rather than a card the player
//     resents.
//
// WHY MODULES ARE DRAFTED AND NOT BOUGHT. They used to be purchases gated
// behind a research node, which made every equipment draft an IOU: the
// technology said the fleet could field a deck gun and the bank said it could
// not, and the player was asked to weigh that against an ability upgrade that
// applied to the very next transit. The upgrade won every time, and a logged
// run finished round 9 with an escort carrying nothing at all. The draft now
// delivers the hardware itself; cash is left holding hulls and ordnance.
//
// THE TABLE HAS TWO SEATS WITH DIFFERENT JOBS.
//
//   • the COUNTER SLOT belongs to the worst-covered live threat — whatever is
//     actually getting through to the convoy has a seat at every draft, drawn
//     from the rewards that answer it, preferring something that can REMOVE the
//     threat over something that merely sees it, and a capability the fleet
//     does not have at all over another upgrade to one already failing;
//   • the DEVELOPMENT SLOT(s) are drawn from the open weighted pool.
//
// So the choice every round is the same honest one: solve the bleeding, or
// compound the thing that is working. The player can still choose wrong and
// still lose to mines; what they can no longer do is go a whole run without
// being shown an answer.
//
// WHAT SHAPES THE OFFER:
//
//   • THREAT PRESSURE — how often each enemy branch has appeared, what it has
//     damaged and what it has sunk, decayed by how long ago;
//   • COVERAGE — what fraction of that branch the player is ACTUALLY
//     neutralising, measured from the water rather than inferred from the
//     catalogue, so owning a counter that is not working does not close the
//     subject;
//   • OFFER RECENCY — something put on the table two drafts ago steps aside;
//   • RECOVERED WRECKAGE — still a strong steer, and still what widens the
//     draft from two options to three;
//   • PREREQUISITES, region availability and STOCK CAPS — hard eligibility.
//
// Randomness is preserved on purpose. The counter slot fixes the CATEGORY of
// problem being answered, not the card: which answer arrives is still a roll.

import { CAMPAIGN, DRAFT } from '../data/tuning';
import { regionDef } from '../data/regions';
import {
  BASE_MODULE_RESEARCH_REQUIREMENT,
  COUNTER_CATEGORY_NAMES,
  ESCORT_MODULE_RESEARCH_REQUIREMENT,
  effectiveResearch,
  FLEET_ASSET_BRANCHES,
  MODULE_RESEARCH_REQUIREMENT,
  RESEARCH_INDEX,
  resolveBranchStats,
  type CounterBranchDef,
  type CounterRole,
  type CounterTacticDef,
  type ResearchEntry,
} from '../data/counters';
import {
  BASE_MODULES,
  ESCORT_MODULES,
  MODULES,
  ORDNANCE_PACKS,
  type OrdnancePackDef,
} from '../data/defs';
import { ENEMY_BRANCHES } from '../data/enemyBranches';
import type { RNG } from './rng';
import type {
  BaseModuleId,
  CampaignState,
  DraftOption,
  DraftOptionKind,
  EscortModuleId,
  ModuleId,
  ModulePlatform,
  ResearchId,
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
// Option identity
// ---------------------------------------------------------------------------

/** Stable key for an option — recency bookkeeping, duplicate suppression, and
 *  telling the UI which card filled the counter slot.
 *
 *  A module's platform is part of its identity and can never be dropped:
 *  `mineSonar` is BOTH a cargo module and an escort module, and they are
 *  different pieces of equipment that happen to share a branch. */
export function draftOptionKey(option: DraftOption): string {
  if (option.kind === 'module') return `module:${option.platform}:${option.moduleId}`;
  if (option.kind === 'ordnance') return `ordnance:${option.packId}`;
  return option.id;
}

export function sameDraftOption(a: DraftOption, b: DraftOption): boolean {
  return draftOptionKey(a) === draftOptionKey(b);
}

/** Every module the catalogue can deliver, with the research node that arrives
 *  with the first unit. Derived from the purchase-gate maps rather than
 *  restated, so a new module cannot be added in one place and forgotten here. */
interface ModuleDefEntry {
  platform: ModulePlatform;
  moduleId: string;
  name: string;
  desc: string;
  /** Base research the first unit teaches. */
  research: ResearchId;
}

function buildModuleCatalogue(): ModuleDefEntry[] {
  const out: ModuleDefEntry[] = [];
  for (const [moduleId, research] of Object.entries(MODULE_RESEARCH_REQUIREMENT)) {
    if (!research) continue;
    const def = MODULES[moduleId as ModuleId];
    out.push({ platform: 'cargo', moduleId, name: def.name, desc: def.desc, research });
  }
  for (const [moduleId, research] of Object.entries(ESCORT_MODULE_RESEARCH_REQUIREMENT)) {
    const def = ESCORT_MODULES[moduleId as EscortModuleId];
    out.push({ platform: 'escort', moduleId, name: def.name, desc: def.desc, research });
  }
  for (const [moduleId, research] of Object.entries(BASE_MODULE_RESEARCH_REQUIREMENT)) {
    const def = BASE_MODULES[moduleId as BaseModuleId];
    out.push({ platform: 'base', moduleId, name: def.name, desc: def.desc, research });
  }
  return out;
}

export const MODULE_CATALOGUE: readonly ModuleDefEntry[] = buildModuleCatalogue();

function moduleEntry(platform: ModulePlatform, moduleId: string): ModuleDefEntry | undefined {
  return MODULE_CATALOGUE.find((m) => m.platform === platform && m.moduleId === moduleId);
}

/** Research nodes that arrive WITH a module rather than being drafted on their
 *  own. A branch's base node is the capability itself; you get it by being
 *  handed the hardware, never as a bare upgrade card. */
const MODULE_DELIVERED_RESEARCH: ReadonlySet<ResearchId> = new Set(
  MODULE_CATALOGUE.map((m) => m.research),
);

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

function stockCap(platform: ModulePlatform): number {
  if (platform === 'cargo') return DRAFT.cargoModuleCap;
  if (platform === 'escort') return DRAFT.escortModuleCap;
  return DRAFT.baseModuleCap;
}

function heldUnits(c: CampaignState, platform: ModulePlatform, moduleId: string): number {
  return (c.moduleStock?.[platform] as Record<string, number> | undefined)?.[moduleId] ?? 0;
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

interface CoverageSample {
  fielded: number;
  neutralized: number;
}

/** What each enemy branch put in the water this round, and how much of it the
 *  player took off the board.
 *
 *  Only branches with an honest neutralized/fielded pair appear. Artillery and
 *  enemy smoke have no such pair in the round stats, so they are left unmeasured
 *  and fall back to the ownership estimate in familyCoverage rather than being
 *  scored on a number that does not mean what it would need to mean.
 *
 *  Mines are the one blended case. A mine DESTROYED is fully neutralised; a mine
 *  merely REVEALED and steered around is a real but partial answer — the hull
 *  survived, the minefield did not go away — so it earns partial credit. A mine
 *  that detonated, and one never seen at all, earn nothing. */
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

/** How much of this enemy family the player is neutralising, 0..1. Measured
 *  where the round stats support it; otherwise falls back to what the player
 *  owns. */
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

/** How badly this family is being handled right now: how much it is hurting the
 *  run, times how much of it is still getting through. Falls to nothing when
 *  EITHER the threat stops appearing or the player starts actually stopping it. */
export function familyDeficit(c: CampaignState, family: string): number {
  return pressureWeight(c, family) * (1 - familyCoverage(c, family));
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/** Can this branch's rewards appear in the active region at all? A branch that
 *  only counters families the region cannot field is dead weight; branches with
 *  no counters (damage control, logistics, support) stay broadly available. */
function branchLiveInRegion(branch: CounterBranchDef, allowed: ReadonlySet<string>): boolean {
  if (branch.counters.length === 0) return true;
  return branch.counters.some((key) => allowed.has(key) && ENEMY_BRANCHES[key].implemented);
}

/** Is this catalogue entry offerable as an UPGRADE or ASSET? */
function eligibleResearch(
  entry: ResearchEntry,
  owned: ReadonlySet<ResearchId>,
  allowed: ReadonlySet<string>,
): boolean {
  if (entry.def.granted) return false; // built-ins arrive on their own
  if (owned.has(entry.def.id)) return false;
  // A branch's base node is the CAPABILITY, and capabilities arrive as
  // hardware. Offering it as a bare upgrade card would put the IOU back.
  if (MODULE_DELIVERED_RESEARCH.has(entry.def.id)) return false;
  if (!entry.requires.every((r) => owned.has(r))) return false;
  const excludes = (entry.def as CounterTacticDef).excludes;
  if (excludes?.some((x) => owned.has(x))) return false;
  return branchLiveInRegion(entry.branch, allowed);
}

/** Is another unit of this module offerable? */
function eligibleModule(
  c: CampaignState,
  m: ModuleDefEntry,
  allowed: ReadonlySet<string>,
): boolean {
  if (heldUnits(c, m.platform, m.moduleId) >= stockCap(m.platform)) return false;
  const branch = RESEARCH_INDEX[m.research]?.branch;
  if (!branch) return false;
  return branchLiveInRegion(branch, allowed);
}

/** Would this ordnance pack actually land somewhere useful? A crate that
 *  overflows a full magazine is a wasted card. */
function eligibleOrdnance(c: CampaignState, pack: OrdnancePackDef): boolean {
  if (c.round < DRAFT.ordnanceMinRound) return false;
  if (pack.needs === 'mcmDroneLauncher') {
    if (!c.escortUnits.some((e) => e.modules.includes('mcmDroneLauncher'))) return false;
  }
  if (pack.needs === 'selfDefenseModule') {
    if (!Object.values(c.classModules).some((mods) => mods.includes('selfDefense'))) return false;
  }
  const research = effectiveResearch(c.completedResearch);
  const capacityOf = (branchId: 'warthog' | 'scanPulse' | 'smokeScreen'): number =>
    resolveBranchStats(branchId, research).grants.charges ?? 0;
  if (pack.grant.warthogStock && c.warthogStock >= capacityOf('warthog')) return false;
  if (pack.grant.scanStock && c.scanStock >= capacityOf('scanPulse')) return false;
  if (pack.grant.smokeStock && c.smokeStock >= capacityOf('smokeScreen')) return false;
  return true;
}

// ---------------------------------------------------------------------------
// The pool
// ---------------------------------------------------------------------------

export interface DraftCandidate {
  option: DraftOption;
  /** Branch this reward belongs to (null for ordnance). */
  branch: CounterBranchDef | null;
  /** Research entry, when the option is a node or tactic. */
  entry: ResearchEntry | null;
  weight: number;
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

/** Is this branch's capability already in the player's hands?
 *
 *  The test is the BASE NODE, and a granted base counts. The A-10 is flying
 *  from round one whether or not a warthog node has been drafted, so a longer
 *  strafing pass is deepening something that exists, not acquiring a new
 *  answer — and treating it as new is how a run gets fed gun-run upgrades while
 *  mines sink eight hulls. A minesweeping drone, by contrast, is a capability
 *  the fleet simply does not have until a unit is drafted. */
function branchInService(c: CampaignState, branch: CounterBranchDef): boolean {
  const base = branch.nodes[0];
  if (!base) return false;
  return effectiveResearch(c.completedResearch).has(base.id);
}

/** The shared weighting every category is priced with. */
function weighCandidate(
  c: CampaignState,
  cand: { option: DraftOption; branch: CounterBranchDef | null; entry: ResearchEntry | null },
  recoveredByBranch: Record<string, number>,
  excess: number,
  pressureOf: Map<string, number>,
  gapOf: Map<string, number>,
): number {
  let weight = 1;
  const { option, branch, entry } = cand;

  if (branch) {
    let pressureSum = 0;
    let liveFamilies = 0;
    let worstGap = 0;
    for (const family of branch.counters) {
      const units = recoveredByBranch[family] ?? 0;
      if (units > 0) weight += units * DRAFT.branchWeightPerUnit;

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
    // they nominally touch and outbid the specialists that actually remove one.
    if (liveFamilies > 0) {
      weight += pressureSum / Math.pow(liveFamilies, DRAFT.breadthDampingExponent);
    }
    if (worstGap > 0) {
      // A threat getting through untouched pays the full multiplier; one the
      // player is mostly stopping pays almost none. Smooth, not a cliff.
      weight *= 1 + (DRAFT.coverageGapMult - 1) * worstGap;
      // The basic capability should surface before its refinements — and a
      // module IS the basic capability now.
      const isEntry = option.kind === 'module' || (entry !== null && entry.branch.nodes[0]?.id === entry.def.id);
      if (isEntry) weight *= 1 + (DRAFT.entryNodeMult - 1) * worstGap;
    }
  }

  // Recovery beyond the breadth threshold improves QUALITY: deeper entries gain
  // weight in proportion to how deep they sit.
  if (excess > 0 && entry) {
    weight *= 1 + excess * DRAFT.depthWeightPerUnit * entryDepth(entry);
  }

  // Something offered in the last couple of drafts steps aside so the table
  // keeps moving — a declined option should not simply reappear.
  const offeredAt = c.lastOfferedRound?.[draftOptionKey(option)];
  if (offeredAt !== undefined && c.round - offeredAt <= DRAFT.offerCooldownRounds) {
    weight *= DRAFT.recentlyOfferedMult;
  }

  // Category bias. Left flat, a module would win every table — a thing you
  // cannot do yet always reads better than a thing you can do slightly better —
  // so its advantage is spent where it belongs: in the counter slot, answering
  // a threat that is actually getting through.
  weight *= DRAFT.categoryWeight[option.kind] ?? 1;
  // A cargo unit fits an entire ship class; an escort unit arms one hull. Same
  // card, very different gift.
  if (option.kind === 'module' && option.platform === 'cargo') {
    weight *= DRAFT.cargoModuleRarity;
  }
  return Math.max(0.01, weight);
}

/** Every reward currently offerable, with its draft weight. */
export function draftPool(
  c: CampaignState,
  recoveredByBranch: Record<string, number>,
): DraftCandidate[] {
  const region = regionDef(c.regionId);
  const allowed = new Set<string>(region.enemyBranches);
  const owned = effectiveResearch(c.completedResearch);
  const recoveredTotal = Object.values(recoveredByBranch).reduce((a, b) => a + b, 0);
  const excess = Math.max(0, recoveredTotal - DRAFT.qualityThreshold);
  const pressureOf = new Map<string, number>();
  const gapOf = new Map<string, number>();

  const raw: { option: DraftOption; branch: CounterBranchDef | null; entry: ResearchEntry | null }[] =
    [];

  // Upgrades and fleet assets.
  for (const entry of Object.values(RESEARCH_INDEX)) {
    if (!eligibleResearch(entry, owned, allowed)) continue;
    const isAsset = FLEET_ASSET_BRANCHES.has(entry.branch.id);
    raw.push({
      option: isAsset
        ? { kind: 'asset', id: entry.def.id }
        : { kind: 'upgrade', id: entry.def.id },
      branch: entry.branch,
      entry,
    });
  }

  // Equipment units.
  for (const m of MODULE_CATALOGUE) {
    if (!eligibleModule(c, m, allowed)) continue;
    raw.push({
      option: { kind: 'module', platform: m.platform, moduleId: m.moduleId } as DraftOption,
      branch: RESEARCH_INDEX[m.research]?.branch ?? null,
      entry: null,
    });
  }

  // Ordnance.
  for (const pack of Object.values(ORDNANCE_PACKS)) {
    if (!eligibleOrdnance(c, pack)) continue;
    raw.push({ option: { kind: 'ordnance', packId: pack.id }, branch: null, entry: null });
  }

  const pool = raw.map((cand) => ({
    ...cand,
    weight: weighCandidate(c, cand, recoveredByBranch, excess, pressureOf, gapOf),
  }));

  // Ordnance is priced as a SHARE of the table rather than on its own merits,
  // because its whole job is relative: with a full catalogue in front of the
  // player a crate of shells should almost never be the interesting card, and
  // with everything worth having already drafted or capped it should be. A flat
  // weight cannot do both — it either drowns in a rich pool or dominates a thin
  // one — so the share grows as the alternatives run out.
  const others = pool.filter((p) => p.option.kind !== 'ordnance');
  const crates = pool.filter((p) => p.option.kind === 'ordnance');
  if (crates.length > 0) {
    const thinness = Math.max(0, 1 - others.length / DRAFT.ordnanceRichPool);
    const share = Math.min(
      0.9,
      DRAFT.ordnanceShare + DRAFT.ordnanceScarcityShare * thinness,
    );
    const otherWeight = others.reduce((sum, p) => sum + p.weight, 0);
    // Solve for the per-crate weight that gives the crates `share` of the total.
    const target = otherWeight > 0 ? (otherWeight * share) / (1 - share) : 1;
    for (const crate of crates) crate.weight = Math.max(0.01, target / crates.length);
  }
  return pool;
}

// ---------------------------------------------------------------------------
// The counter slot
// ---------------------------------------------------------------------------

/** The live threats with a real coverage deficit, worst first. */
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

/** The offerable rewards that answer one family, weighted for the counter slot.
 *  A different question from the open pool's: not "what is interesting right
 *  now" but "what would most help against THIS". Ordnance is never eligible —
 *  a crate of shells is not an answer to a threat. */
export function counterSlotPool(c: CampaignState, family: string): DraftCandidate[] {
  const region = regionDef(c.regionId);
  const allowed = new Set<string>(region.enemyBranches);
  const owned = effectiveResearch(c.completedResearch);
  const answers = (branch: CounterBranchDef | null): boolean =>
    !!branch && branch.counters.includes(family as never);

  const pool: (DraftCandidate & { fresh: boolean })[] = [];
  const consider = (
    option: DraftOption,
    branch: CounterBranchDef | null,
    entry: ResearchEntry | null,
  ): void => {
    if (!answers(branch)) return;
    let weight = 1;
    // Something that can take the threat off the board beats something that
    // only reports it.
    if (ANSWERING_ROLES.has(branch!.role)) weight *= DRAFT.counterSlotAttackMult;
    const fresh = !branchInService(c, branch!);
    if (fresh && option.kind === 'module') weight *= DRAFT.counterSlotNewBranchMult;
    const offeredAt = c.lastOfferedRound?.[draftOptionKey(option)];
    if (offeredAt !== undefined && c.round - offeredAt <= DRAFT.offerCooldownRounds) {
      weight *= DRAFT.counterSlotRecentMult;
    }
    if (option.kind === 'module' && option.platform === 'cargo') {
      weight *= DRAFT.cargoModuleRarity;
    }
    pool.push({ option, branch, entry, weight: Math.max(0.01, weight), fresh });
  };

  for (const entry of Object.values(RESEARCH_INDEX)) {
    if (!eligibleResearch(entry, owned, allowed)) continue;
    if (FLEET_ASSET_BRANCHES.has(entry.branch.id)) continue;
    consider({ kind: 'upgrade', id: entry.def.id }, entry.branch, entry);
  }
  for (const m of MODULE_CATALOGUE) {
    if (!eligibleModule(c, m, allowed)) continue;
    consider(
      { kind: 'module', platform: m.platform, moduleId: m.moduleId } as DraftOption,
      RESEARCH_INDEX[m.research]?.branch ?? null,
      null,
    );
  }

  // While the threat is genuinely getting through, the counter slot owes the
  // player a NEW capability — something that changes what the fleet can do
  // about it — not a stat bump to a branch already in service and already
  // failing to cope. This is the loophole that made the old guarantee hollow: a
  // longer A-10 strafing pass counts as "a mine counter" by the catalogue and
  // answers nothing about eight hulls on the bottom. Once every fresh answer
  // has been drafted the slot rightly falls through to deepening what is there.
  if (familyCoverage(c, family) < DRAFT.coverageAnsweredAt) {
    const fresh = pool.filter((p) => p.fresh);
    if (fresh.length > 0) return fresh.map(({ fresh: _f, ...rest }) => rest);
  }
  return pool.map(({ fresh: _f, ...rest }) => rest);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** Weighted draw without replacement; same-branch repeats are damped so a draft
 *  tends to offer distinct branches. Deterministic under the run RNG. */
function drawOptions(pool: DraftCandidate[], count: number, rng: RNG): DraftOption[] {
  const remaining = pool.map((p) => ({ ...p }));
  const picked: DraftOption[] = [];
  while (picked.length < count && remaining.length > 0) {
    const total = remaining.reduce((sum, p) => sum + p.weight, 0);
    let roll = rng.next() * total;
    let idx = 0;
    for (; idx < remaining.length - 1; idx++) {
      roll -= remaining[idx].weight;
      if (roll <= 0) break;
    }
    const chosen = remaining.splice(idx, 1)[0];
    picked.push(chosen.option);
    for (const p of remaining) {
      if (chosen.branch && p.branch?.id === chosen.branch.id) {
        p.weight *= DRAFT.sameBranchRepeatMult;
      }
    }
  }
  return picked;
}

/** Fill the counter slot: work down the deficit queue and take the first family
 *  that still has something to offer. */
function drawCounterSlot(
  c: CampaignState,
  rng: RNG,
): { option: DraftOption; family: string } | null {
  for (const candidate of counterCandidates(c)) {
    const pool = counterSlotPool(c, candidate.family);
    if (pool.length === 0) continue; // exhausted — try the next-worst threat
    const [option] = drawOptions(pool, 1, rng);
    if (option) return { option, family: candidate.family };
  }
  return null;
}

/** Build the mandatory draft a successfully completed round has earned. */
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

  const options: DraftOption[] = [];
  let counterFamily: string | undefined;
  let counterOption: string | undefined;
  // The counter slot never takes the last seat: a forced option that filled the
  // whole table would make the draft an announcement rather than a choice.
  if (choices >= 2) {
    const counter = drawCounterSlot(c, rng);
    if (counter) {
      options.push(counter.option);
      counterFamily = counter.family;
      counterOption = draftOptionKey(counter.option);
    }
  }

  // The development draw has to know what the counter slot already put on the
  // table, or the two draws happily produce three upgrades to the same branch —
  // and the same module twice, which is just a broken card.
  const taken = new Set(options.map(draftOptionKey));
  const counterBranch = options.length > 0 ? pool.find((p) => taken.has(draftOptionKey(p.option)))?.branch : null;
  const rest = pool
    .filter((p) => !taken.has(draftOptionKey(p.option)))
    .map((p) => ({
      ...p,
      weight:
        counterBranch && p.branch?.id === counterBranch.id
          ? p.weight * DRAFT.sameBranchRepeatMult
          : p.weight,
    }));
  options.push(...drawOptions(rest, choices - options.length, rng));

  // Shuffle so the counter slot is not always the first card. Its position must
  // carry no meaning — the badge on the card is what identifies it. A fixed seat
  // trains "always take the left one", which is the reflex the draft exists to
  // replace with a decision.
  rng.shuffle(options);

  for (const option of options) c.lastOfferedRound[draftOptionKey(option)] = c.round;
  return {
    round: c.round,
    options,
    recoveredUnits,
    ...(counterFamily ? { counterFamily, counterOption } : {}),
  };
}

// ---------------------------------------------------------------------------
// Taking the pick
// ---------------------------------------------------------------------------

/** Why a draft option cannot be taken (null = it can). */
export function draftBlockReason(c: CampaignState, option: DraftOption): string | null {
  if (!c.pendingDraft) return 'No draft pending';
  if (!c.pendingDraft.options.some((o) => sameDraftOption(o, option))) {
    return 'Not one of the offered options';
  }
  if ((option.kind === 'upgrade' || option.kind === 'asset') && !RESEARCH_INDEX[option.id]) {
    return 'Unknown technology';
  }
  if (option.kind === 'module' && !moduleEntry(option.platform, option.moduleId)) {
    return 'Unknown equipment';
  }
  if (option.kind === 'ordnance' && !ORDNANCE_PACKS[option.packId]) return 'Unknown package';
  return null;
}

/** Hand over one unit of equipment, plus the base research the first unit
 *  teaches. Later units are just more hardware. */
function applyModuleGrant(c: CampaignState, platform: ModulePlatform, moduleId: string): void {
  const m = moduleEntry(platform, moduleId);
  if (!m) return;
  c.moduleStock ??= { cargo: {}, escort: {}, base: {} };
  const bucket = c.moduleStock[platform] as Record<string, number>;
  bucket[moduleId] = (bucket[moduleId] ?? 0) + 1;
  if (!c.completedResearch.includes(m.research)) c.completedResearch.push(m.research);
}

/** Top up stock from an ordnance package, clamped to what the fleet can hold. */
function applyOrdnance(c: CampaignState, pack: OrdnancePackDef): void {
  const research = effectiveResearch(c.completedResearch);
  const cap = (branchId: 'warthog' | 'scanPulse' | 'smokeScreen'): number =>
    resolveBranchStats(branchId, research).grants.charges ?? 0;
  const g = pack.grant;
  if (g.ammo) c.ammo += g.ammo;
  if (g.droneAmmo) c.droneAmmo += g.droneAmmo;
  if (g.pdAmmo) c.pdAmmo += g.pdAmmo;
  if (g.warthogStock) c.warthogStock = Math.min(cap('warthog'), c.warthogStock + g.warthogStock);
  if (g.scanStock) c.scanStock = Math.min(cap('scanPulse'), c.scanStock + g.scanStock);
  if (g.smokeStock) c.smokeStock = Math.min(cap('smokeScreen'), c.smokeStock + g.smokeStock);
}

/** Take one option from the pending draft. Applies IMMEDIATELY — the reward is
 *  live for the very next transit — records the pick for telemetry, and releases
 *  the run into the prep phase. */
export function selectDraftOption(c: CampaignState, option: DraftOption): boolean {
  if (draftBlockReason(c, option) !== null) return false;
  if (option.kind === 'upgrade' || option.kind === 'asset') {
    c.completedResearch.push(option.id);
    // Expanded Berthing keeps its immediate capacity effect under the draft
    // economy (it used to fire on research completion).
    if (option.id === 'logistics.expandedBerthing') {
      c.capacity = Math.min(CAMPAIGN.maxCapacity, c.capacity + 5);
    }
  } else if (option.kind === 'module') {
    applyModuleGrant(c, option.platform, option.moduleId);
  } else {
    applyOrdnance(c, ORDNANCE_PACKS[option.packId]);
  }

  const draft = c.pendingDraft!;
  c.draftHistory.push({ round: draft.round, offered: [...draft.options], picked: option });
  c.pendingDraft = null;
  if (c.phase === 'draft') c.phase = 'prep';
  return true;
}

/** An empty draft (exhausted catalogue) cannot demand a pick: acknowledge it and
 *  move on. The ONLY legal way past a draft without choosing. */
export function dismissEmptyDraft(c: CampaignState): boolean {
  if (!c.pendingDraft || c.pendingDraft.options.length > 0) return false;
  c.draftHistory.push({ round: c.pendingDraft.round, offered: [], picked: null });
  c.pendingDraft = null;
  if (c.phase === 'draft') c.phase = 'prep';
  return true;
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

export interface DraftOptionInfo {
  kind: DraftOptionKind;
  name: string;
  desc: string;
  branchName: string;
  categoryName: string;
  /** Upgrades only: is it a tactic rather than a hardware node? */
  isTactic: boolean;
  /** Modules only. */
  platform?: ModulePlatform;
  /** Modules only: units held before this pick, and the ceiling. */
  held?: number;
  cap?: number;
  /** Upgrades only: nodes already taken in this branch, and how many exist. */
  branchDepth?: { taken: number; total: number };
}

/** Everything the UI needs to draw a card, resolved from the option alone. */
export function draftOptionInfo(c: CampaignState, option: DraftOption): DraftOptionInfo | null {
  if (option.kind === 'upgrade' || option.kind === 'asset') {
    const entry = RESEARCH_INDEX[option.id];
    if (!entry) return null;
    const all = [...entry.branch.nodes, ...entry.branch.tactics].filter((d) => !d.granted);
    const owned = new Set(c.completedResearch);
    return {
      kind: option.kind,
      name: entry.def.name,
      desc: entry.def.desc,
      branchName: entry.branch.name,
      categoryName: COUNTER_CATEGORY_NAMES[entry.branch.category],
      isTactic: entry.isTactic,
      branchDepth: { taken: all.filter((d) => owned.has(d.id)).length, total: all.length },
    };
  }
  if (option.kind === 'module') {
    const m = moduleEntry(option.platform, option.moduleId);
    if (!m) return null;
    const branch = RESEARCH_INDEX[m.research]?.branch;
    return {
      kind: 'module',
      name: m.name,
      desc: m.desc,
      branchName: branch?.name ?? m.name,
      categoryName: branch ? COUNTER_CATEGORY_NAMES[branch.category] : 'Equipment',
      isTactic: false,
      platform: option.platform,
      held: heldUnits(c, option.platform, option.moduleId),
      cap: stockCap(option.platform),
    };
  }
  const pack = ORDNANCE_PACKS[option.packId];
  if (!pack) return null;
  return {
    kind: 'ordnance',
    name: pack.name,
    desc: pack.desc,
    branchName: 'Ordnance',
    categoryName: 'Logistics & Support',
    isTactic: false,
  };
}

/** The research a reward carries, when it carries any: an upgrade or asset IS
 *  a research id, and a module's first unit delivers its branch's base node.
 *  Null for ordnance. Lets callers that think in research ids — the playtest
 *  personas' doctrine lists, for one — keep doing so. */
export function draftOptionResearchId(option: DraftOption): ResearchId | null {
  if (option.kind === 'upgrade' || option.kind === 'asset') return option.id;
  if (option.kind === 'module') {
    return moduleEntry(option.platform, option.moduleId)?.research ?? null;
  }
  return null;
}

/** The branch a reward belongs to, for icons and tags (null for ordnance). */
export function draftOptionBranch(option: DraftOption): CounterBranchDef | null {
  if (option.kind === 'upgrade' || option.kind === 'asset') {
    return RESEARCH_INDEX[option.id]?.branch ?? null;
  }
  if (option.kind === 'module') {
    const m = moduleEntry(option.platform, option.moduleId);
    return m ? (RESEARCH_INDEX[m.research]?.branch ?? null) : null;
  }
  return null;
}

/** True when the option's branch counters something this region can field —
 *  exported so tests can assert region awareness without duplicating rules. */
export function optionLegalInRegion(c: CampaignState, option: DraftOption): boolean {
  const branch = draftOptionBranch(option);
  if (!branch) return true;
  const region = regionDef(c.regionId);
  if (branch.counters.length === 0) return true;
  return branch.counters.some((key) => region.enemyBranches.includes(key));
}
