// Regional-run orchestration: the meta-game around each transit. Owns the
// economy, convoy scaling, run confidence, the mandatory technology draft,
// the run's victory/defeat conditions, and the glue between transit results
// and enemy evolution. All mutations validate their inputs so the UI can
// stay dumb.
//
// A CampaignState is one TEMPORARY regional run (see types.ts). Permanent
// progression lives in the Commander Profile (sim/commander.ts) and is only
// touched at run settlement. Technology comes from the post-round draft
// (sim/draft.ts) over the counter catalogue (data/counters.ts) — the old
// paid-research pipeline (spendable intel, one active project, completion
// delays) is retired. Equipment is no longer bought either: the draft delivers
// UNITS, the loadout fits them for free, and cash is left holding the two jobs
// it does well — hulls and ordnance.

import { CAMPAIGN, DRAFT, ECONOMY, ENEMY_ECONOMY } from '../data/tuning';
import {
  BASE_MODULE_SLOTS,
  ESCORT_DEFAULT_NAMES,
  ESCORT_MODULE_SLOTS,
  ESCORT_MODULE_SLOTS_UNLOCKED,
  ESCORT_NAME_MAX,
  SHIP_CLASSES,
} from '../data/defs';
import {
  allResearchableIds,
  effectiveResearch,
  resolveBranchStats,
  RESEARCH_INDEX,
} from '../data/counters';
import { DEV_REGION, regionDef, type RegionId } from '../data/regions';
import { foldCommanderMods } from '../data/commanderAbilities';
import { activeLegacyIds, foldEscortLegacies } from '../data/escortLegacies';
import { makeRng, type RNG } from './rng';
import { createTransit } from './transit';
import { evolveEnemy, newEvolution, planRound, targetingName } from './evolution';
import {
  applyModuleGrant,
  draftOptionKey,
  generateDraft,
  newThreatPressure,
  recordThreatCoverage,
} from './draft';
import { buildTransitCards } from './aar';
import type {
  AarCard,
  AfterActionReport,
  AutoSystem,
  BaseModuleId,
  CampaignState,
  CounterTelemetry,
  EnemyRoundTelemetry,
  EscortModuleId,
  EscortUnit,
  FormationId,
  ModulePlatform,
  ModuleId,
  ResearchId,
  RoundMetrics,
  RoundPlan,
  SensorFamily,
  ShipClassId,
  ShipLoss,
  TechKey,
  TransitState,
} from './types';

/** Bumped for the roguelite redesign: saves split into Commander Profile +
 *  Regional Run, research/intel retired, regions and drafts added. Pre-split
 *  campaign saves are an explicit migration boundary (see platform/save.ts). */
export const SAVE_VERSION = 4;

const DEFAULT_AUTO_FIRE: Record<AutoSystem, boolean> = {
  escortInterceptor: true,
  baseInterceptor: true,
  mcmDrones: true,
  depthCharges: true,
  deckGun: true,
  counterBattery: true,
};

/** Start a REGIONAL RUN: the real game entry point. The region definition
 *  supplies the starting state (all provisional numbers, deliberately data-
 *  driven); the Commander Ability loadout is snapshotted into the run so the
 *  attempt stays self-contained and deterministic even if the profile's
 *  loadout changes mid-run. */
export function newRegionalRun(
  seed: string,
  regionId: RegionId,
  commanderAbilities: readonly string[] = [],
  escortLegacies: readonly string[] = [],
): CampaignState {
  const region = regionDef(regionId);
  const start = region.start;
  const mods = foldCommanderMods(commanderAbilities);
  const legacyMods = foldEscortLegacies(escortLegacies);
  const run: CampaignState = {
    version: SAVE_VERSION,
    seed,
    regionId: region.id,
    commanderAbilities: [...commanderAbilities],
    escortLegacies: [...escortLegacies],
    spentLegacies: [],
    dev: false,
    godMode: false,
    round: 1,
    phase: 'prep',
    cash: start.cash + mods.startCash,
    score: 0,
    capacity: start.capacity,
    confidence: start.confidence,
    strongStreak: 0,
    campaignOver: false,
    runOutcome: 'active',
    defeatCause: null,
    pendingDraft: null,
    draftRerolls: 0,
    draftHistory: [],
    threatPressure: {},
    threatCoverage: {},
    lastOfferedRound: {},
    wreckageRecovered: {},
    crewRescue: { rescued: 0, lost: 0 },
    record: { launched: 0, lost: 0 },
    profileApplied: false,
    fleet: { ...start.fleet },
    composition: { ...start.fleet },
    classModules: { cargo: [], tanker: [], freighter: [] },
    moduleStock: { cargo: {}, escort: {}, base: {} },
    baseModules: [],
    pendingDamage: 0,
    baseDamage: 0,
    bases: start.bases,
    escortUnits: [],
    nextEscortId: 1,
    usedEscortNames: [],
    ammo: start.ammo,
    droneAmmo: start.droneAmmo,
    pdAmmo: start.pdAmmo,
    warthogStock: 0,
    scanStock: 0,
    gunAmmo: 0,
    // The convoy's own assets are in hand from the first round; only their
    // ordnance is bought (see the note above repairCost).
    warthogUnlocked: true,
    scanUnlocked: true,
    sonarUnlocked: true,
    hardenedUnlocked: true,
    autoFire: { ...DEFAULT_AUTO_FIRE },
    protectedChannels: [],
    formation: 'tight',
    targetPriority: 'proximity',
    completedResearch: [],
    roundSpend: {},
    roundAmmoBought: { interceptor: 0, drone: 0, selfDefense: 0, gun: 0 },
    // Enemy adaptation is scoped to the run and constrained by the region —
    // a fresh economy every attempt is a design requirement.
    evolution: newEvolution(region),
    quota: {
      roundsLeft: CAMPAIGN.quotaWindowRounds,
      pointsNeeded: start.capacity * CAMPAIGN.quotaPerCapacity,
      pointsEarned: 0,
    },
    quotaDifficulty: CAMPAIGN.quotaDifficultyStart,
    history: [],
    telemetry: [],
    lastReport: null,
  };
  // The region's free starting escorts (the recovery loop needs at least one
  // hull that can work a field, so real regions never start bare).
  for (let i = 0; i < start.escorts; i++) {
    run.escortUnits.push({
      id: run.nextEscortId++,
      name: claimEscortName(run),
      modules: [],
      damage: 0,
      legacy: claimEscortLegacy(run),
    });
  }
  // Requisition Order: a unit in the locker before the first prep phase, so the
  // legacy is worth something on round one rather than only after a draft. It
  // arrives through the draft's own grant path, which also teaches the base
  // node — hardware nobody has been trained on would be a gun that never fires.
  for (let i = 0; i < legacyMods.freeModulePicks; i++) {
    applyModuleGrant(run, 'escort', 'deckGun');
  }
  return run;
}

/** Dev/test-compat constructor: a run on the full-roster proving ground with
 *  no Commander Abilities. The pre-region test suite and headless harness
 *  keep their old threat dynamics through this. */
export function newCampaign(seed: string): CampaignState {
  return newRegionalRun(seed, DEV_REGION, []);
}

/** Deterministic per-round, per-purpose RNG derived from the campaign seed. */
export function roundRng(c: CampaignState, purpose: string): RNG {
  return makeRng(`${c.seed}:r${c.round}:${purpose}`);
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

/** The highest confidence this run can currently reach.
 *
 *  THE RULE: a full bar means an operation that has never lost a ship or a
 *  crew. Every hull on the seabed and every crew left in the water lowers the
 *  best opinion the consortium will hold of you, for the rest of the run.
 *
 *  This is what turns confidence from a mood into a RECORD, and it is the piece
 *  the old model was missing. Round-by-round arithmetic alone could never say
 *  "you have lost a sixth of everything you ever sailed" — a hand-played log
 *  sat pinned at 100 through two rounds that lost fifteen hulls between them,
 *  because each round in isolation was survivable. The ledger is not.
 *
 *  Rate-based against hulls launched, so it is size-neutral like the rest of
 *  the confidence model, and floored (confidenceCeilingFloor) so a bad record
 *  never becomes an unrecoverable one: defeat is the bar reaching zero, which
 *  the player does round by round, not a wall the ledger builds behind them. */
export function confidenceCeiling(c: CampaignState): number {
  const launched = c.record?.launched ?? 0;
  if (launched <= 0) return CAMPAIGN.maxConfidence;
  const lostShare = (c.record?.lost ?? 0) / launched;
  const crewShare = (c.crewRescue?.lost ?? 0) / launched;
  const drag =
    CAMPAIGN.confidenceCeilingLossDrag * lostShare + CAMPAIGN.confidenceCeilingCrewDrag * crewShare;
  return Math.max(
    CAMPAIGN.confidenceCeilingFloor,
    Math.min(CAMPAIGN.maxConfidence, CAMPAIGN.maxConfidence - drag),
  );
}

// ---------------------------------------------------------------------------
// Draft rerolls
// ---------------------------------------------------------------------------

/** Why the pending draft cannot be rerolled right now (null = it can). */
export function rerollBlockReason(c: CampaignState): string | null {
  if (!c.pendingDraft) return 'No draft is pending';
  if ((c.draftRerolls ?? 0) <= 0) {
    return `Rescue ${DRAFT.crewsPerReroll} crews in a round to earn one`;
  }
  if (c.pendingDraft.options.length === 0) return 'Nothing left to draw';
  return null;
}

/** Spend a banked reroll: redraw the table against the SAME round's salvage,
 *  keeping the picks it opened with.
 *
 *  Picks are earned by wreckage and a reroll must not touch them — this buys a
 *  different table, not a bigger one. Picks already taken stay taken, and their
 *  technology is already in the fleet, so the redraw naturally cannot offer it
 *  again. Deterministic: the redraw is salted by the reroll count, so a replay
 *  of the same run produces the same second table. */
export function rerollDraft(c: CampaignState): boolean {
  if (rerollBlockReason(c) !== null) return false;
  const draft = c.pendingDraft!;
  const used = (draft.rerolls ?? 0) + 1;
  const fresh = generateDraft(c, draft.recoveredByBranch ?? {}, roundRng(c, `draft:reroll${used}`));
  c.draftRerolls = (c.draftRerolls ?? 0) - 1;
  c.pendingDraft = {
    ...fresh,
    round: draft.round,
    picksLeft: draft.picksLeft,
    picksTotal: draft.picksTotal,
    rerolls: used,
  };
  return true;
}

/** The player's effective research (completed + granted built-ins). */
export function researchSet(c: CampaignState): Set<ResearchId> {
  return effectiveResearch(c.completedResearch);
}

export function hasResearch(c: CampaignState, id: ResearchId): boolean {
  return researchSet(c).has(id);
}

/** Attribute cash movement to a counter branch for the game log (negative on
 *  refunds, so the net spend per branch stays honest). */
function recordSpend(c: CampaignState, branch: string, amount: number): void {
  c.roundSpend[branch] = (c.roundSpend[branch] ?? 0) + amount;
}

// ---------------------------------------------------------------------------
// Developer / test runs
// ---------------------------------------------------------------------------

export interface DevOptions {
  /** Round to jump into (enemy doctrine is fast-forwarded to match). */
  round: number;
  /** Invincible ships/escorts/batteries and effectively unlimited munitions. */
  god: boolean;
  /** All research complete, every ability installed, max assets & capacity,
   *  deep pockets and full magazines. */
  unlockAll: boolean;
}

/** Advance the enemy's hidden doctrine as if moderate rounds had been played up
 *  to `targetRound`, so jumping into a later level actually faces later threats
 *  (guided missiles, mines, low-signature mines) rather than a round-1 probe. */
function fastForwardEvolution(c: CampaignState, targetRound: number): void {
  for (let r = 1; r < targetRound; r++) {
    const metrics: RoundMetrics = {
      round: r,
      interceptRate: 0.7,
      formation: 'tight',
      mineDetectRate: -1,
      torpedoDetectRate: -1,
      valueSent: 241,
      deliveredFraction: 0.85,
    };
    evolveEnemy(c.evolution, metrics, roundRng(c, `dev-evolve-${r}`));
  }
  c.round = Math.max(1, Math.floor(targetRound));
  // Mark already-purchased capabilities as "met" so a jumped-to level fields
  // them at full scale rather than re-running their debut fairness caps.
  const evo = c.evolution;
  const fielded = evo.economy.nodesFielded;
  if (fielded.includes('guided')) evo.firstSeen.guidedMissile ??= 1;
  if (fielded.includes('standard')) evo.firstSeen.mine ??= 1;
  if (fielded.includes('lowSig')) evo.firstSeen.lowSigMine ??= 1;
}

/** Build a developer campaign: a normal campaign with the dev flag set, the
 *  chosen god/unlock loadout applied, and the enemy fast-forwarded to `round`. */
export function newDevCampaign(seed: string, opts: DevOptions): CampaignState {
  const c = newCampaign(seed);
  c.dev = true;
  c.godMode = opts.god;
  if (opts.unlockAll) {
    c.completedResearch = allResearchableIds();
    c.warthogUnlocked = true;
    c.scanUnlocked = true;
    c.sonarUnlocked = true;
    c.hardenedUnlocked = true;
    // The limited loadout slots still apply, even for dev runs — but each
    // escort is fitted individually, so a dev flotilla is a MIXED one rather
    // than three copies of the same design.
    c.baseModules = ['counterBattery'];
    c.cash = 999_999;
    c.ammo = 999;
    c.droneAmmo = 999;
    c.pdAmmo = 999;
    // Full magazines includes the apron: sorties and pulses are stock now, so
    // "unlock everything" has to stock them or the dev run lands with the two
    // aircraft commissioned and nothing to fly.
    c.warthogStock = 999;
    c.scanStock = 999;
    c.gunAmmo = 999;
    c.bases = ECONOMY.maxBases;
    c.capacity = CAMPAIGN.maxCapacity;
    const devLoadouts: EscortModuleId[][] = [
      ['deckGun', 'mcmDroneLauncher'],
      ['depthCharges', 'deckGun'],
      ['mcmDroneLauncher', 'depthCharges'],
    ];
    for (let i = 0; i < ECONOMY.maxEscorts; i++) {
      c.escortUnits.push({
        id: c.nextEscortId++,
        name: claimEscortName(c),
        modules: [...(devLoadouts[i % devLoadouts.length] ?? [])].slice(0, escortSlots(c)),
        damage: 0,
      });
    }
  }
  fastForwardEvolution(c, opts.round);
  return c;
}

export function planCurrentRound(c: CampaignState): RoundPlan {
  return planRound(c, roundRng(c, 'plan'));
}

/** The RNG that seeds the transit must be the same instance that drives it,
 *  so a round replays identically from the campaign seed. */
export function createRoundTransit(
  c: CampaignState,
  plan: RoundPlan,
): { state: TransitState; rng: RNG } {
  const rng = roundRng(c, 'transit');
  return { state: createTransit(c, plan, rng), rng };
}

// ---------------------------------------------------------------------------
// Round resolution
// ---------------------------------------------------------------------------

/** Snapshot the enemy's procurement economy for the game log. This is the
 *  half of the seesaw that docs/SEESAW.md flagged as missing: with it, "why
 *  did the enemy pivot" is measured rather than inferred from loss causes. */
function buildEnemyTelemetry(c: CampaignState): EnemyRoundTelemetry {
  const economy = c.evolution.economy;
  const branches: EnemyRoundTelemetry['branches'] = {};
  for (const [key, ledger] of Object.entries(economy.ledgers)) {
    branches[key] = {
      spend: Math.round(ledger.spend),
      share: Math.round(ledger.share * 1000) / 1000,
      units: { ...ledger.units },
      roi: Math.round(ledger.roi * 1000) / 1000,
      // Kills are fractional: a hull worn down by two branches gives each a
      // share, so no single attack is credited with work it did not do.
      kills: Math.round(ledger.kills * 100) / 100,
      result: Math.round(ledger.result * 10) / 10,
      scrap: Math.round(ledger.scrap),
      roundsInvested: ledger.roundsInvested,
    };
  }
  return {
    budget: economy.budget,
    committed: economy.committed,
    scrapped: economy.scrapped,
    branches,
    openBranches: [...economy.openBranches],
    nodeDebuts: [...economy.nodeDebuts],
    targetingTier: economy.targetingTier,
    targetingName: targetingName(economy),
  };
}

export function resolveTransit(c: CampaignState, t: TransitState): AfterActionReport {
  const s = t.stats;
  const round = c.round;
  const confidenceBefore = c.confidence;

  // --- Economy ---------------------------------------------------------------
  // One rule, and the player can do the arithmetic themselves: cargo delivered
  // pays cash. Nothing else adds to the round's income.
  //
  // There used to be a second term here — underwriting that paid back a share
  // of every hull lost — which existed to stop a fleet past its break-even loss
  // rate from being mathematically unable to recover. It did that job, but it
  // did it invisibly: the cash figure moved for reasons the player could not
  // read off the screen, and "how much did this round actually earn me" stopped
  // having a simple answer. The same protection now lives somewhere the player
  // can see it — replacement hulls are priced so that a delivered cargo covers
  // its own hull (see SHIP_CLASSES.replaceCost) — so a bad round is survivable
  // because ships are affordable, not because a hidden rebate arrived.
  const cashEarned = s.valueDelivered * ECONOMY.cashPerValue;
  c.cash += cashEarned;
  c.ammo = t.ammo; // unused interceptors carry over
  c.droneAmmo = t.droneAmmo; // unused drone munitions carry over
  c.pdAmmo = t.pdAmmo; // unused self-defense rounds carry over
  // Deck-gun shells: what was fired is gone, the rest stays in the magazine.
  // Clamped for the same god-mode reason as the sortie stocks below.
  c.gunAmmo = Math.max(0, Math.min(c.gunAmmo, t.gunAmmo));
  // Sorties and pulses are stock too: what was flown is gone, what was not
  // flown is still on the apron next round. Clamped because a god-mode run
  // hands the transit 99 of each without the campaign having bought them.
  c.warthogStock = Math.max(0, Math.min(c.warthogStock, t.warthogCharges));
  c.scanStock = Math.max(0, Math.min(c.scanStock, t.scanCharges));
  c.formation = t.formation; // tactical formation changes persist as the new default
  c.autoFire = { ...t.autoFire }; // in-transit automation toggles persist

  const newDiscoveries: TechKey[] = [];
  for (const key of t.debutsSeen) {
    if (c.evolution.firstSeen[key] === undefined) {
      c.evolution.firstSeen[key] = round;
      newDiscoveries.push(key);
    }
  }

  // --- Recovery bookkeeping -----------------------------------------------------
  // Wreckage feeds the draft below; run totals feed records and telemetry.
  for (const [branch, units] of Object.entries(s.wreckageByBranch)) {
    c.wreckageRecovered[branch] = (c.wreckageRecovered[branch] ?? 0) + units;
  }
  c.crewRescue.rescued += s.survivorsRescued;
  c.crewRescue.lost += s.survivorsLost;
  // The hull ledger the confidence ceiling reads. Kept here, beside the crew
  // ledger it works with, and updated BEFORE confidence so this round's losses
  // are already in the record the ceiling is drawn from — a round cannot lose
  // ships and still be allowed to top out.
  c.record ??= { launched: 0, lost: 0 };
  c.record.launched += s.launched;
  c.record.lost += s.launched - s.delivered;

  // --- Threat pressure ------------------------------------------------------------
  // What each enemy branch actually did this round. This is the draft's primary
  // signal: being hurt by something is what should put its counter on the table,
  // whether or not the player had escorts free to salvage its wreckage.
  const encountered = new Set<string>();
  for (const [branch, outcome] of Object.entries(s.enemyBranch)) {
    if (outcome.damage <= 0 && outcome.kills <= 0) continue;
    encountered.add(branch);
    const p = (c.threatPressure[branch] ??= newThreatPressure());
    p.rounds++;
    p.streak = p.lastSeenRound === round - 1 ? p.streak + 1 : 1;
    p.damage += outcome.damage;
    p.kills += outcome.kills;
    p.lastSeenRound = round;
  }
  // A branch that fielded units the player shut out entirely still counts as
  // ENCOUNTERED — surviving a minefield untouched is not evidence you can
  // afford to ignore mines, and the draft should still know they are out there.
  for (const key of Object.keys(c.evolution.economy.ledgers)) {
    if (encountered.has(key)) continue;
    const fielded = Object.values(c.evolution.economy.ledgers[key].units).reduce((a, b) => a + b, 0);
    if (fielded <= 0) continue;
    const p = (c.threatPressure[key] ??= newThreatPressure());
    p.rounds++;
    p.streak = p.lastSeenRound === round - 1 ? p.streak + 1 : 1;
    p.lastSeenRound = round;
  }

  // --- Threat coverage -----------------------------------------------------------
  // Pressure says what hurt; coverage says how much of it the player actually
  // stopped. The draft weights the GAP between the two, so a branch that keeps
  // getting through keeps drawing offers no matter how much technology
  // nominally points at it.
  recordThreatCoverage(c, s, round);

  // --- Fleet bookkeeping -------------------------------------------------------
  for (const ship of t.ships) {
    if (!ship.alive) {
      c.fleet[ship.classId] = Math.max(0, c.fleet[ship.classId] - 1);
    }
  }
  // Escorts destroyed at sea leave the flotilla — the SPECIFIC ships that
  // sank, by unit id, so the surviving escorts keep their names, their fitted
  // loadouts and their accumulated damage. Under the old count-and-template
  // model this was just `escorts--` and any notion of which escort died was
  // meaningless, because they were interchangeable.
  const sunkUnitIds = new Set(t.escorts.filter((e) => !e.alive).map((e) => e.unitId));
  if (sunkUnitIds.size > 0) {
    // Her EQUIPMENT is salvaged; her LEGACY is not.
    //
    // Modules used to go down with the hull, on the theory that losing an
    // escort should cost a capability as well as a ship. It cost too much: a
    // module arrives through the draft, so there is no buying it back, and a
    // single unlucky mine could delete a branch the player had spent three
    // rounds building toward — a roll of the dice undoing a strategy, with no
    // decision anywhere in it. Losing the hull, her fitted-out state, the cash
    // to replace her and her legacy is already the most expensive thing that
    // happens in a round.
    //
    // So the units go back to the locker to be refitted to another hull, and
    // what the sinking permanently costs the RUN is the escort legacy she was
    // carrying — see spendEscortLegacy. Cargo-class fits were always untouched:
    // those live with the class.
    for (const unit of c.escortUnits.filter((u) => sunkUnitIds.has(u.id))) {
      spendEscortLegacy(c, unit);
    }
    c.escortUnits = c.escortUnits.filter((u) => !sunkUnitIds.has(u.id));
  }
  if (s.basesLost > 0) {
    c.bases = Math.max(0, c.bases - s.basesLost);
  }
  for (const classId of Object.keys(c.composition) as ShipClassId[]) {
    c.composition[classId] = Math.min(c.composition[classId], c.fleet[classId]);
  }
  // Damage-pool conservation: whatever the sailing convoy could not absorb
  // (per-hull 40% cap in createTransit) stays owed, plus the damage the
  // survivors actually carry. Destroyed ships take their share to the bottom.
  const leftoverPool = Math.max(0, c.pendingDamage - t.pendingDamageApplied);
  c.pendingDamage =
    leftoverPool +
    Math.round(
      t.ships
        .filter((ship) => ship.alive)
        .reduce((sum, ship) => sum + (ship.maxHp - ship.hp), 0),
    );
  // Escorts and batteries carry their unrepaired hull damage into next round
  // (survivors only — the destroyed ones are gone). Repaired in procurement.
  // Each surviving escort carries its OWN unrepaired damage forward, so a
  // battered gun boat stays battered and its undamaged sister does not
  // inherit a share of the wound.
  for (const unit of c.escortUnits) {
    const sailed = t.escorts.find((e) => e.unitId === unit.id);
    unit.damage = sailed && sailed.alive ? Math.round(sailed.maxHp - sailed.hp) : 0;
  }
  c.baseDamage = Math.round(
    t.bases.filter((b) => b.alive).reduce((sum, b) => sum + (b.maxHp - b.hp), 0),
  );

  // --- Confidence ----------------------------------------------------------------
  const deliveredFraction = s.launched > 0 ? s.delivered / s.launched : 0;
  let confidenceChange = 0;
  // Confidence follows the SHARE of the convoy that arrives, not the COUNT that
  // does not — one rate-based curve covering both the reward and the penalty,
  // so the same performance reads the same at 20 hulls and at 45. See the
  // CAMPAIGN.confidenceBreakEven block for the measurements behind the shape.
  confidenceChange += Math.max(
    CAMPAIGN.confidenceDeliveryFloor,
    Math.min(
      CAMPAIGN.confidenceDeliveryCeiling,
      CAMPAIGN.confidenceDeliverySwing * (deliveredFraction - CAMPAIGN.confidenceBreakEven),
    ),
  );
  // Crews left in the water bite on top of the delivery curve: the sinking cost
  // a hull, the abandonment costs trust. Rate-scaled against the convoy sailed
  // for the same reason the curve is. This is part of the ordinary disaster and
  // so sits INSIDE the round floor below. (The rescue credit does not — see
  // below.)
  if (s.launched > 0) {
    confidenceChange += CAMPAIGN.confidenceCrewLostRate * (s.survivorsLost / s.launched);
  }
  // Escorts sunk cost too. They used to be free — a logged round that lost two
  // of them and abandoned a crew still finished at 100, because nothing in this
  // block looked at the screen at all.
  confidenceChange += CAMPAIGN.confidencePerEscortLost * s.escortsLost;
  // Captures bite on top of that, and OUTSIDE the loss cap — a player already
  // at the cap still feels each hull the enemy sails away with, which is what
  // stops absorbing losses from being an answer to the boarding node.
  if (s.shipsCaptured > 0) {
    confidenceChange += Math.max(
      CAMPAIGN.confidenceCaptureCap,
      CAMPAIGN.confidencePerCapture * s.shipsCaptured,
    );
  }

  // --- Quota window -----------------------------------------------------------------
  c.quota.pointsEarned += s.valueDelivered;
  c.quota.roundsLeft--;
  // A quota resolves the moment it is MET — a new, larger one begins next
  // round — or when its rounds run out. Under the roguelite rules a missed
  // quota is one of the two run-ending failure systems (the other is
  // confidence): it terminates the regional run rather than costing points.
  const quotaMet = c.quota.pointsEarned >= c.quota.pointsNeeded;
  const quotaEvaluated = quotaMet || c.quota.roundsLeft <= 0;
  const quotaSnapshot = { needed: c.quota.pointsNeeded, earned: c.quota.pointsEarned };
  // Captured before the window resets below (1-based round within the window).
  const quotaWindowRound = CAMPAIGN.quotaWindowRounds - Math.max(0, c.quota.roundsLeft);

  // Floor on how far ORDINARY failure can drop confidence in a single round.
  //
  // A bad round, the full loss cap and a missed quota all land together — they
  // are the same disaster described three ways — and unfloored they took 35 of
  // a starting 60 at once. Two such rounds ended a campaign from full health
  // with no round in between where the player could see it coming and answer.
  // The floor turns that cliff into a slope: the same disaster still hurts more
  // than anything else in the game, but it leaves rounds to recover in, which
  // is the only thing that makes a comeback possible at all.
  //
  // Captures are deliberately NOT floored, for the same reason they are not
  // capped: absorbing losses must never become the answer to the boarding node.
  const captureLoss =
    s.shipsCaptured > 0
      ? Math.max(CAMPAIGN.confidencePerCapture * s.shipsCaptured, CAMPAIGN.confidenceCaptureCap)
      : 0;
  const ordinaryLoss = confidenceChange - captureLoss;
  confidenceChange = Math.max(ordinaryLoss, CAMPAIGN.confidenceRoundFloor) + captureLoss;
  // THE CREDITS: crews brought home, and a shipping window met. Both are
  // applied OUTSIDE the floor, on purpose — inside it, a player having the
  // disaster round the floor exists for would get nothing at all for going back
  // for their people, and that is precisely the round where the diversion
  // should still visibly mean something.
  //
  // But they MITIGATE. They never turn a losing round into a winning one.
  // Uncapped they did exactly that, twice over, in a hand-played log: a round
  // that lost seven of thirty hulls but rescued six crews came out at +1.3, and
  // a round that lost two escorts and abandoned a crew was rescued to level by
  // the quota bonus landing on top of it. Meeting a shipping target while
  // sinking a quarter of the convoy is not a round the consortium is pleased
  // about. On a losing round the credits together may cancel only a share of
  // the damage, so a worse round is always worse however much is done about it.
  const credits =
    Math.min(
      CAMPAIGN.confidenceRescueCap,
      CAMPAIGN.confidencePerCrewRescued * s.survivorsRescued,
    ) + (quotaEvaluated && quotaMet ? CAMPAIGN.confidenceQuotaMet : 0);
  confidenceChange +=
    confidenceChange < 0
      ? Math.min(credits, -confidenceChange * CAMPAIGN.confidenceCreditMitigation)
      : credits;

  // Confidence is a WHOLE-NUMBER bar, and the number in brackets on the debrief
  // must be the change the player can actually see happen to it. Two things
  // would otherwise break that. The delivery curve is continuous, so the raw
  // change is fractional and would render as 67.43999999999998. And the bar
  // clamps at both ends, so an unclamped delta reads "100 (+8)" on a round that
  // really moved +2. Round the destination, then derive the reported change
  // from where the bar actually landed.
  c.confidence = Math.round(
    Math.max(0, Math.min(confidenceCeiling(c), c.confidence + confidenceChange)),
  );
  confidenceChange = c.confidence - confidenceBefore;

  // --- Convoy capacity growth ----------------------------------------------------
  let capacityIncreased = false;
  if (deliveredFraction >= CAMPAIGN.strongRoundFraction) {
    c.strongStreak++;
    if (c.strongStreak >= CAMPAIGN.strongRoundsForGrowth && c.capacity < CAMPAIGN.maxCapacity) {
      c.capacity = Math.min(CAMPAIGN.maxCapacity, c.capacity + CAMPAIGN.capacityStep);
      c.strongStreak = 0;
      capacityIncreased = true;
    }
  } else {
    c.strongStreak = 0;
  }

  if (quotaEvaluated && quotaMet) {
    // Rubber-band the difficulty multiplier off how comfortably the window
    // cleared: an easy clear (big surplus) ratchets it up, capped so no
    // single window swings it too far. (A miss ends the run outright, so the
    // old downward ratchet has nothing left to act on.)
    const ratio = quotaSnapshot.needed > 0 ? quotaSnapshot.earned / quotaSnapshot.needed : 1;
    const surplus = Math.max(0, ratio - 1);
    const step = Math.min(CAMPAIGN.quotaDifficultyUpStep, surplus * CAMPAIGN.quotaDifficultyUpStep * 2);
    c.quotaDifficulty = Math.min(CAMPAIGN.quotaDifficultyMax, c.quotaDifficulty + step);
    // Size the next target off the CONVOY, not off what the last window
    // managed to deliver.
    //
    // Sizing from delivery had two faults that pulled in the same direction.
    // It asked more of a player who had been defending well, and — the one that
    // mattered — it punished any purchase that traded convoy size for convoy
    // quality, because the target had been set by the larger convoy they used
    // to sail and only adapted downward AFTER a miss had cost 18 confidence.
    // Measured across three builds, the quota-miss rate tracked convoy size
    // almost exactly: 28% for a build sailing 29.4 hulls of 30.4 capacity, 39%
    // at 24.6, and 60% at 19.7. Equipping the convoy was structurally punished
    // however little the equipment cost, which is why halving every module
    // price made those builds WORSE rather than better.
    //
    // Asking for a share of what the convoy can carry decouples the target from
    // both: sail less and less is expected of you, defend well and you are not
    // punished for it with a higher bar next window. The floor below is what
    // stops "sail three hulls to trivialise the quota" — it is pinned to
    // CAPACITY, which does not shrink when the convoy does.
    const convoyValue = (Object.keys(c.composition) as ShipClassId[]).reduce(
      (sum, id) => sum + c.composition[id] * SHIP_CLASSES[id].value,
      0,
    );
    const target =
      convoyValue * CAMPAIGN.quotaWindowRounds * CAMPAIGN.quotaDeliveryFraction * c.quotaDifficulty;
    const floor = c.capacity * CAMPAIGN.quotaFloorPerCapacity;
    c.quota = {
      roundsLeft: CAMPAIGN.quotaWindowRounds,
      pointsNeeded: Math.max(Math.round(target), Math.round(floor)),
      pointsEarned: 0,
    };
  }

  // --- Score ------------------------------------------------------------------------
  c.score +=
    s.valueDelivered * CAMPAIGN.scorePerValue +
    CAMPAIGN.scorePerRound +
    s.missilesIntercepted * CAMPAIGN.scorePerIntercept;

  // --- Enemy learns from this round ---------------------------------------------------
  // Weight each branch's damage and kills into the single "result" figure its
  // procurement economy divides by spend to get ROI. Kills dominate: sinking
  // hulls is the point, chip damage is not.
  const branchResults: Record<string, { result: number; kills: number }> = {};
  for (const [branch, outcome] of Object.entries(s.enemyBranch)) {
    branchResults[branch] = {
      result:
        outcome.kills * ENEMY_ECONOMY.roiKillWeight +
        outcome.damage * ENEMY_ECONOMY.roiDamageWeight,
      kills: outcome.kills,
    };
  }
  const metrics: RoundMetrics = {
    round,
    interceptRate: s.missilesSpawned > 0 ? s.missilesIntercepted / s.missilesSpawned : 1,
    formation: t.formation,
    mineDetectRate: s.minesTotal > 0 ? s.minesRevealed / s.minesTotal : -1,
    // A torpedo the player heard OR killed was a torpedo the ASW stack handled.
    torpedoDetectRate:
      s.torpedoesLaunched > 0
        ? Math.min(1, (s.torpedoesDetected + s.torpedoesDestroyed) / (2 * s.torpedoesLaunched))
        : -1,
    valueSent: s.valueSent,
    deliveredFraction,
    branchResults,
  };
  evolveEnemy(c.evolution, metrics, roundRng(c, 'evolve'));

  // --- Run outcome ----------------------------------------------------------------
  // Two failure systems and one completion watermark, checked in that order:
  // a player who fails the quota on the final round has still failed the
  // region. Defeat resets the region to round 1 on the next attempt; the
  // Commander Profile is settled by the caller (applyRunToProfile).
  const region = regionDef(c.regionId);
  if (c.confidence <= 0) {
    c.campaignOver = true;
    c.runOutcome = 'defeat';
    c.defeatCause = 'confidence';
  } else if (quotaEvaluated && !quotaMet) {
    c.campaignOver = true;
    c.runOutcome = 'defeat';
    c.defeatCause = 'quota';
  } else if (round >= region.completionRound && quotaEvaluated) {
    // Victory waits for the OPEN quota window to resolve. The completion round
    // and the 3-round quota cycle do not generally line up, and ending the
    // region mid-window walked away from a commitment the consortium was still
    // counting — the player watched an active quota bar simply vanish. So the
    // watermark round is the earliest the region can complete, and the run
    // sails on until the window in progress is met (victory) or missed
    // (defeat, handled above) — at most two extra rounds.
    c.campaignOver = true;
    c.runOutcome = 'victory';
    c.defeatCause = null;
  }

  // --- Draft rerolls ----------------------------------------------------------------
  // Crews only end up in the water when hulls go down, so a round that earns a
  // reroll is by definition a round that went badly — which is the point. The
  // token pays for the BOAT WORK, not for the sinking: a player who leaves the
  // survivors out there gets nothing.
  if (s.survivorsRescued >= DRAFT.crewsPerReroll) {
    c.draftRerolls = Math.min(DRAFT.maxRerolls, (c.draftRerolls ?? 0) + 1);
  }

  // --- Mandatory technology draft ---------------------------------------------------
  // Every successfully completed round earns one — no skipping, no banking.
  // A finished run drafts nothing: there is no next round to equip for.
  if (!c.campaignOver) {
    c.pendingDraft = generateDraft(c, s.wreckageByBranch, roundRng(c, 'draft'));
  } else {
    c.pendingDraft = null;
  }

  // --- Cards --------------------------------------------------------------------------
  const cards: AarCard[] = buildTransitCards(t, newDiscoveries);
  if (c.evolution.formationTell) {
    cards.push({
      kind: 'warning',
      title: 'Enemy is reading your formation',
      body: c.evolution.formationTell,
    });
  }
  for (const warning of c.evolution.pendingWarnings) {
    cards.push({
      kind: 'warning',
      title: `Intelligence forecast — ${warning.confidencePct}% confidence`,
      body: warning.text,
    });
  }
  // Recovery beats: what the escorts pulled out of the water, and what it
  // will mean at the draft table.
  if (s.wreckageRecovered > 0) {
    const byBranch = Object.entries(s.wreckageByBranch)
      .map(([branch, units]) => `${units}× ${branch}`)
      .join(', ');
    cards.push({
      kind: 'salvage',
      title: `Wreckage recovered: ${s.wreckageRecovered} field${s.wreckageRecovered === 1 ? '' : 's'}`,
      body:
        `Salvage teams brought back ${byBranch}. Recovered enemy technology widens tonight's ` +
        'draft and steers it toward counters for what was actually recovered.',
    });
  }
  if (s.wreckageExpired > 0 && s.wreckageRecovered === 0) {
    cards.push({
      kind: 'salvage',
      title: 'Wreckage left in the water',
      body:
        `${s.wreckageExpired} recoverable field${s.wreckageExpired === 1 ? '' : 's'} sank before ` +
        'any escort could work them. Holding an escort inside a field recovers it — leaving ' +
        'resets all progress.',
    });
  }
  if (s.survivorsRescued > 0) {
    cards.push({
      kind: 'rescue',
      title: `Crews rescued: ${s.survivorsRescued}`,
      body:
        'Escorts pulled the survivors aboard before the water took them. The families — and ' +
        'the operators association — will remember it.' +
        (s.survivorsRescued >= DRAFT.crewsPerReroll
          ? ' The association has put a favour your way: a DRAFT REROLL, spendable on the technology table.'
          : ''),
    });
  }
  if (s.survivorsLost > 0) {
    cards.push({
      kind: 'rescue',
      title: `Crews lost in the water: ${s.survivorsLost}`,
      body:
        'Survivors went unrescued, and the cost lands on top of the sinkings themselves — ' +
        'permanently, in the ceiling below. An escort holding inside a survivor area brings ' +
        'the crew home.',
    });
  }
  // The ceiling is a permanent cap, so it has to be stated the round it moves.
  // Silently capping a bar the player is trying to climb is the worst version
  // of this mechanic.
  const ceilingNow = Math.round(confidenceCeiling(c));
  if (ceilingNow < CAMPAIGN.maxConfidence) {
    cards.push({
      kind: 'warning',
      title: `Consortium confidence capped at ${ceilingNow}`,
      body:
        `${c.record.lost} of ${c.record.launched} hulls have not arrived and ` +
        `${c.crewRescue.lost} crew${c.crewRescue.lost === 1 ? ' has' : 's have'} been left in ` +
        'the water. A full bar is reserved for an operation that has lost neither — the record ' +
        'stands for the rest of the run, so every hull and every crew brought home from here ' +
        'is worth more than the last.',
    });
  }
  if (capacityIncreased) {
    cards.push({
      kind: 'capacity',
      title: `Convoy capacity increased to ${c.capacity}`,
      body: 'Two consecutive strong deliveries have convinced the shipping consortium to route more hulls through the strait. Larger convoys earn more — and draw more attention.',
    });
  }
  if (quotaEvaluated) {
    if (quotaMet) {
      // The window has already rolled over here, so c.quota now holds the
      // fresh requirement — tell the player exactly what's next. Unless the
      // run just ENDED on this clearance: promising a next window that will
      // never be sailed is worse than silence.
      cards.push({
        kind: 'quota',
        title: 'Delivery quota met',
        body:
          `Delivered ${quotaSnapshot.earned} of ${quotaSnapshot.needed} cargo points — quota cleared, ` +
          `consortium confidence rises.` +
          (c.campaignOver
            ? ' Every commitment made to the consortium has been honoured.'
            : ` New quota: deliver ${c.quota.pointsNeeded} cargo points over ` +
              `the next ${CAMPAIGN.quotaWindowRounds} rounds (scaled to your recent pace).`),
      });
    } else {
      cards.push({
        kind: 'quota',
        title: 'Delivery quota failed — operation terminated',
        body:
          `Only ${quotaSnapshot.earned} of ${quotaSnapshot.needed} cargo points arrived inside the ` +
          'window. The consortium has pulled its ships: the regional run is over. The next attempt ' +
          'restarts this region at round 1 — Commander progression is retained.',
      });
    }
  }
  if (c.runOutcome === 'defeat' && c.defeatCause === 'confidence') {
    cards.push({
      kind: 'info',
      title: 'Confidence exhausted — operation terminated',
      body:
        'Civilian crews and operators are no longer willing to sail. The regional run is over. ' +
        'The next attempt restarts this region at round 1 — Commander progression is retained.',
    });
  }
  if (c.runOutcome === 'victory') {
    cards.push({
      kind: 'capacity',
      title: `${region.name} secured`,
      body:
        `Round ${round} cleared with every delivery quota honoured — the region's completion ` +
        'watermark. The shipping lane is considered secured; Commander Experience has been earned, ' +
        'and the next region is open. Technology and equipment built during this run stay with it.',
    });
  }
  // Past the watermark with a quota window still open: say WHY the run is
  // continuing, or the extra rounds read as the game failing to end.
  if (!c.campaignOver && round >= region.completionRound) {
    cards.push({
      kind: 'quota',
      title: 'One commitment left to honour',
      body:
        `The completion watermark is behind you, but the current delivery quota — ` +
        `${c.quota.pointsEarned} of ${c.quota.pointsNeeded} cargo points, ${c.quota.roundsLeft} ` +
        `round${c.quota.roundsLeft === 1 ? '' : 's'} left — is still open. Meet it and the region ` +
        'is secured; miss it and the run ends like any other failed quota.',
    });
  }
  if (!c.campaignOver && c.confidence <= 25) {
    cards.push({
      kind: 'info',
      title: 'Consortium confidence critical',
      body: 'Backers are close to withdrawing support. Deliver consistently or the operation will be shut down.',
    });
  }

  const report: AfterActionReport = {
    round,
    stats: s,
    cashEarned,
    confidenceChange,
    confidenceAfter: c.confidence,
    capacityIncreased,
    quota: {
      windowRound: quotaWindowRound,
      earned: quotaSnapshot.earned,
      needed: quotaSnapshot.needed,
      evaluated: quotaEvaluated,
      met: quotaMet,
    },
    cards,
    campaignOver: c.campaignOver,
    runOutcome: c.runOutcome,
    draftSize: c.pendingDraft?.options.length ?? 0,
  };

  c.history.push({
    round,
    launched: s.launched,
    delivered: s.delivered,
    lost: s.lost,
    valueDelivered: s.valueDelivered,
    cashEarned,
  });

  // --- Telemetry (downloadable game log) --------------------------------------
  const losses: ShipLoss[] = t.events
    .filter((e) => e.type === 'shipLost')
    .map((e) => {
      const ship = t.ships.find((sh) => sh.id === e.shipId);
      return {
        name: e.shipName ?? ship?.name ?? 'unknown',
        classId: ship?.classId ?? 'cargo',
        cause: e.cause ?? 'unknown',
      };
    });
  // Player-counter snapshot: equipment by platform, active nodes vs tactics,
  // spend and munitions by branch — the player half of the seesaw log.
  const effective = [...researchSet(c)];
  const counters: CounterTelemetry = {
    equipped: {
      cargo: {
        cargo: [...c.classModules.cargo],
        tanker: [...c.classModules.tanker],
        freighter: [...c.classModules.freighter],
      },
      escorts: c.escortUnits.map((e) => ({ id: e.id, name: e.name, modules: [...e.modules] })),
      bases: [...c.baseModules],
      abilities: [
        ...(c.warthogUnlocked ? ['warthog'] : []),
        ...(c.scanUnlocked ? ['scanPulse'] : []),
        ...(c.sonarUnlocked ? ['activeSonar'] : []),
        ...(c.hardenedUnlocked ? ['hardened'] : []),
      ],
    },
    activeNodes: effective.filter((id) => RESEARCH_INDEX[id] && !RESEARCH_INDEX[id].isTactic).sort(),
    activeTactics: effective.filter((id) => RESEARCH_INDEX[id]?.isTactic).sort(),
    spendByBranch: { ...c.roundSpend },
    ammo: {
      interceptorBought: c.roundAmmoBought.interceptor,
      interceptorUsed: s.ammoUsed,
      droneBought: c.roundAmmoBought.drone,
      droneUsed: s.counter.droneLaunches,
      selfDefenseBought: c.roundAmmoBought.selfDefense,
      selfDefenseUsed: s.counter.selfDefenseShots,
      gunShellsBought: c.roundAmmoBought.gun,
      gunShellsUsed: s.counter.deckGunRounds,
    },
    stats: s.counter,
  };
  c.telemetry.push({
    round,
    formation: t.formation,
    transitSeconds: Math.round(t.time * 10) / 10,
    launched: s.launched,
    delivered: s.delivered,
    lost: s.lost,
    deliveredPct: s.launched > 0 ? Math.round((s.delivered / s.launched) * 100) : 0,
    valueSent: s.valueSent,
    valueDelivered: s.valueDelivered,
    missilesSpawned: s.missilesSpawned,
    missilesIntercepted: s.missilesIntercepted,
    baseIntercepts: s.baseIntercepts,
    escortIntercepts: s.escortIntercepts,
    pdKills: s.pdKills,
    interceptMisses: s.interceptMisses,
    ammoUsed: s.ammoUsed,
    warthogUsed: s.warthogUsed,
    // Split out so a log can answer "is the A-10 doing anything about the
    // boats, or only sweeping mines" — which it could not before, and which is
    // the difference between a bot mis-flying it and the aircraft being unable
    // to kill a boat at all.
    warthogKills: s.warthogKills,
    scanUsed: s.scanUsed,
    minesTotal: s.minesTotal,
    minesRevealed: s.minesRevealed,
    minesDetonated: s.minesDetonated,
    minesSwept: s.minesSwept,
    torpedoesLaunched: s.torpedoesLaunched,
    torpedoesDetected: s.torpedoesDetected,
    torpedoesHit: s.torpedoesHit,
    torpedoesDestroyed: s.torpedoesDestroyed,
    boatsLaunched: s.boatsLaunched,
    boatsSunk: s.boatsSunk,
    boatKills: s.boatKills,
    shipsCaptured: s.shipsCaptured,
    shellsFired: s.shellsFired,
    shellHits: s.shellHits,
    batteriesDestroyed: s.batteriesDestroyed,
    smokeCloudsLaid: s.smokeCloudsLaid,
    concealedSeconds: Math.round(s.concealedSeconds * 10) / 10,
    reconPlanes: s.reconPlanes,
    disablingDrones: s.disablingDrones,
    aircraftDowned: s.aircraftDowned,
    shipDisabledSeconds: Math.round(s.shipDisabledSeconds * 10) / 10,
    escortsLost: s.escortsLost,
    basesLost: s.basesLost,
    launchersDisabled: s.launchersDisabled,
    losses,
    escortPerformance: Object.values(s.escortPerformance).map((p) => ({
      ...p,
      modules: [...p.modules],
      damageTaken: Math.round(p.damageTaken),
    })),
    cashEarned,
    confidenceBefore,
    confidenceAfter: c.confidence,
    capacity: c.capacity,
    capacityIncreased,
    basesOwned: c.bases,
    escortsOwned: c.escortUnits.length,
    completedResearch: [...c.completedResearch],
    wreckageSpawned: s.wreckageSpawned,
    wreckageRecovered: s.wreckageRecovered,
    wreckageExpired: s.wreckageExpired,
    wreckageByBranch: { ...s.wreckageByBranch },
    recoveryEscortSeconds: Math.round(s.recoveryEscortSeconds * 10) / 10,
    survivorsSpawned: s.survivorsSpawned,
    survivorsRescued: s.survivorsRescued,
    survivorsLost: s.survivorsLost,
    draftOffered: c.pendingDraft ? c.pendingDraft.options.map(draftOptionKey) : [],
    enemyTracks: { ...c.evolution.tracks },
    newDiscoveries: [...newDiscoveries],
    counters,
    enemy: buildEnemyTelemetry(c),
  });

  // A fresh spend ledger for the next prep phase.
  c.roundSpend = {};
  c.roundAmmoBought = { interceptor: 0, drone: 0, selfDefense: 0, gun: 0 };

  c.round++;
  c.phase = 'aar';
  c.lastReport = report;
  return report;
}

// ---------------------------------------------------------------------------
// Procurement actions (all return false when the purchase is invalid)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Equipment: stock, not purchases
// ---------------------------------------------------------------------------
//
// Modules used to be bought per class, per escort, per battery, at a price that
// scaled with fleet size — and every one of them was gated behind a research
// node the draft had to hand over first. That made the draft an IOU: the
// technology said the fleet could field a deck gun and the bank said it could
// not, and the player was asked to weigh that against an ability upgrade that
// applied to the very next transit. The upgrade won every time.
//
// A module is now a UNIT. The draft delivers it; the shop never sells it. Units
// are fitted and refitted for free between rounds, so the interesting question
// stopped being "can I afford this" and became "which hull should carry it".
// Cash buys hulls and ordnance; the draft decides what the fleet can do.
//
// The two platforms differ in exactly one way, deliberately:
//   • a CARGO unit is fitted to a whole ship class and is never lost — hulls
//     sink and are replaced, the fit stays with the class;
//   • an ESCORT unit goes down with its escort. Losing an escort already cost
//     600 cash; now it costs the drafted equipment aboard her too, which is
//     what makes a flotilla worth defending.

/** Units of one module type the run may ever hold. */
export function moduleStockCap(platform: ModulePlatform): number {
  if (platform === 'cargo') return DRAFT.cargoModuleCap;
  if (platform === 'escort') return DRAFT.escortModuleCap;
  return DRAFT.baseModuleCap;
}

/** Units of this module the run owns — fitted and spare together. */
export function moduleStock(
  c: CampaignState,
  platform: ModulePlatform,
  moduleId: string,
): number {
  return (c.moduleStock?.[platform] as Record<string, number> | undefined)?.[moduleId] ?? 0;
}

/** Units of this module currently bolted to something. Counted off the loadout
 *  itself rather than tracked separately, so stock and fittings can never
 *  drift apart. */
export function moduleFitted(
  c: CampaignState,
  platform: ModulePlatform,
  moduleId: string,
): number {
  if (platform === 'cargo') {
    return Object.values(c.classModules).filter((mods) =>
      mods.includes(moduleId as ModuleId),
    ).length;
  }
  if (platform === 'escort') {
    return c.escortUnits.filter((e) => e.modules.includes(moduleId as EscortModuleId)).length;
  }
  return c.baseModules.includes(moduleId as BaseModuleId) ? 1 : 0;
}

/** Units in the locker, waiting for a hull. */
export function moduleSpare(
  c: CampaignState,
  platform: ModulePlatform,
  moduleId: string,
): number {
  return Math.max(0, moduleStock(c, platform, moduleId) - moduleFitted(c, platform, moduleId));
}

/** Deliver one unit. Returns false when the run is already at the cap for that
 *  module — the draft checks this before offering, and this is the backstop. */
export function grantModule(
  c: CampaignState,
  platform: ModulePlatform,
  moduleId: string,
): boolean {
  c.moduleStock ??= { cargo: {}, escort: {}, base: {} };
  const held = moduleStock(c, platform, moduleId);
  if (held >= moduleStockCap(platform)) return false;
  (c.moduleStock[platform] as Record<string, number>)[moduleId] = held + 1;
  return true;
}

/** Module slots on a merchant class, after any refit asset. */
export function classSlots(c: CampaignState, classId: ShipClassId): number {
  const extra = hasResearch(c, 'logistics.modularRefit') ? 1 : 0;
  return SHIP_CLASSES[classId].slots + extra;
}

/** Why a cargo module cannot be fitted to this class right now (null = it can). */
export function moduleBlockReason(
  c: CampaignState,
  classId: ShipClassId,
  moduleId: ModuleId,
): string | null {
  const owned = c.classModules[classId];
  if (owned.includes(moduleId)) return 'Already fitted to this class';
  if (owned.length >= classSlots(c, classId)) return 'No module slots free on this class';
  if (moduleSpare(c, 'cargo', moduleId) <= 0) {
    return moduleStock(c, 'cargo', moduleId) > 0
      ? 'Every unit is fitted elsewhere — unfit one first'
      : 'No unit held — draft one';
  }
  return null;
}

// --- Shop visibility -------------------------------------------------------
//
// Equipment appears in the loadout once the run HOLDS a unit of it. There is
// nothing to save up for any more, so a module the player cannot field is not
// a thing to plan toward — it is noise. Anything already fitted always shows,
// so it can still be moved.

export function moduleRevealed(c: CampaignState, classId: ShipClassId, moduleId: ModuleId): boolean {
  if (c.classModules[classId].includes(moduleId)) return true;
  return moduleStock(c, 'cargo', moduleId) > 0;
}

export function escortModuleRevealed(c: CampaignState, id: EscortModuleId): boolean {
  if (c.escortUnits.some((u) => u.modules.includes(id))) return true;
  return moduleStock(c, 'escort', id) > 0;
}

export function baseModuleRevealed(c: CampaignState, id: BaseModuleId): boolean {
  if (c.baseModules.includes(id)) return true;
  return moduleStock(c, 'base', id) > 0;
}

/** Fit a held cargo unit to a class. Free — the cost was the draft pick. */
export function equipModule(c: CampaignState, classId: ShipClassId, moduleId: ModuleId): boolean {
  if (moduleBlockReason(c, classId, moduleId) !== null) return false;
  c.classModules[classId].push(moduleId);
  return true;
}

/** Take a cargo unit back off a class and return it to the locker. */
export function removeModule(c: CampaignState, classId: ShipClassId, moduleId: ModuleId): boolean {
  const owned = c.classModules[classId];
  const idx = owned.indexOf(moduleId);
  if (idx < 0) return false;
  owned.splice(idx, 1);
  return true;
}

// ---------------------------------------------------------------------------
// The escort flotilla
// ---------------------------------------------------------------------------

/** Specialist slots on every escort right now. The third exists in the model
 *  from the start and is unlocked by research, so an escort's role can deepen
 *  mid-campaign without the loadout changing shape. */
export function escortSlots(c: CampaignState): number {
  return hasResearch(c, 'logistics.escortRefitBay')
    ? ESCORT_MODULE_SLOTS_UNLOCKED
    : ESCORT_MODULE_SLOTS;
}

export function findEscort(c: CampaignState, escortId: number): EscortUnit | undefined {
  return c.escortUnits.find((e) => e.id === escortId);
}

/** Trim a player-typed escort name to something safe to store and render.
 *  Collapses whitespace, strips control characters, and length-limits. An empty
 *  result falls back to the caller's default rather than an unnamed ship. */
export function sanitizeEscortName(raw: string, fallback = 'Escort'): string {
  const cleaned = [...raw]
    // eslint-disable-next-line no-control-regex
    .filter((ch) => ch >= ' ' && ch !== '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, ESCORT_NAME_MAX);
  return cleaned.length > 0 ? cleaned : fallback;
}

/** A name for a freshly commissioned escort: one this run has never used.
 *
 *  Two things were wrong with picking the first free name off the list. It
 *  only looked at the escorts currently AFLOAT, so a sunk ship's name was
 *  handed straight to her replacement — the debrief then read as though
 *  Vanguard had survived, when in fact Vanguard was on the bottom and a new
 *  hull was flying her name with none of her equipment. And taking the list in
 *  order meant the first escort of every run in the game's history was called
 *  Vanguard and the second Sentinel.
 *
 *  So: the pool is walked in an order derived from the RUN SEED (varied
 *  between runs, identical on replay), and every name the run has ever issued
 *  is remembered — see `usedEscortNames` — so nothing is ever reissued. */
function nextEscortName(c: CampaignState): string {
  const taken = new Set<string>([
    ...c.escortUnits.map((e) => e.name),
    ...(c.usedEscortNames ?? []),
  ]);
  const order = makeRng(`${c.seed}:escortNames`).shuffle([...ESCORT_DEFAULT_NAMES]);
  const free = order.find((n) => !taken.has(n));
  if (free) return free;
  // Pool exhausted (a very long run losing escorts steadily). Numbered hulls
  // keep the guarantee even past the end of the list.
  for (let i = 1; ; i++) {
    const name = `Escort ${i}`;
    if (!taken.has(name)) return name;
  }
}

/** Take the next name AND record it, so it can never come round again. Every
 *  place that commissions an escort goes through here. */
export function claimEscortName(c: CampaignState): string {
  const name = nextEscortName(c);
  c.usedEscortNames = [...(c.usedEscortNames ?? []), name];
  return name;
}

// ---------------------------------------------------------------------------
// Escort legacies
// ---------------------------------------------------------------------------

/** The legacies currently in force: the ones carried by escorts still afloat.
 *
 *  Derived rather than stored, so there is exactly one source of truth. A
 *  legacy is on because a specific ship is swimming; when she is not, the
 *  effect is simply absent from this list and every consumer stops seeing it
 *  without knowing anything about legacies. */
export function activeEscortLegacies(c: CampaignState): string[] {
  return activeLegacyIds(c.escortUnits);
}

/** Hand a newly commissioned escort the next legacy nobody is carrying and
 *  nothing has burned. Returns undefined once they are all assigned or spent —
 *  a fourth hull in a three-legacy run is just a hull. */
function claimEscortLegacy(c: CampaignState): string | undefined {
  const taken = new Set<string>([
    ...c.escortUnits.map((u) => u.legacy).filter((id): id is string => !!id),
    ...(c.spentLegacies ?? []),
  ]);
  return (c.escortLegacies ?? []).find((id) => !taken.has(id));
}

/** Burn the legacy a lost escort was carrying. This is what an escort loss
 *  costs the run now that her modules are salvaged: the veteran crew and the
 *  standing that came with them, gone until the next run. */
function spendEscortLegacy(c: CampaignState, unit: EscortUnit): void {
  if (!unit.legacy) return;
  c.spentLegacies ??= [];
  if (!c.spentLegacies.includes(unit.legacy)) c.spentLegacies.push(unit.legacy);
}

export function renameEscort(c: CampaignState, escortId: number, name: string): boolean {
  const escort = findEscort(c, escortId);
  if (!escort) return false;
  escort.name = sanitizeEscortName(name, escort.name);
  // Burn the player's chosen name too: the automatic draw must never later
  // hand the same name to a second hull and produce two ships alike.
  if (!(c.usedEscortNames ?? []).includes(escort.name)) {
    c.usedEscortNames = [...(c.usedEscortNames ?? []), escort.name];
  }
  return true;
}

/** Why a module cannot be fitted to THIS escort (null = it can). */
export function escortModuleBlockReason(
  c: CampaignState,
  escortId: number,
  id: EscortModuleId,
): string | null {
  const escort = findEscort(c, escortId);
  if (!escort) return 'No such escort';
  // Fitting the same module to a DIFFERENT escort is always allowed — three
  // gun boats is a legitimate answer to a strait full of attack boats, and
  // three drafted units is what it takes.
  if (escort.modules.includes(id)) return 'Already fitted to this escort';
  if (escort.modules.length >= escortSlots(c)) {
    return hasResearch(c, 'logistics.escortRefitBay')
      ? 'All specialist slots full on this escort'
      : 'Both specialist slots full — Escort Refit Bay unlocks a third';
  }
  if (moduleSpare(c, 'escort', id) <= 0) {
    return moduleStock(c, 'escort', id) > 0
      ? 'Every unit is fitted to another escort — unfit one first'
      : 'No unit held — draft one';
  }
  return null;
}

/** Fit a held escort unit. Free, and freely reversible: which escort carries
 *  which role is a decision the player should be able to remake every round. */
export function equipEscortModule(
  c: CampaignState,
  escortId: number,
  id: EscortModuleId,
): boolean {
  if (escortModuleBlockReason(c, escortId, id) !== null) return false;
  const escort = findEscort(c, escortId);
  if (!escort) return false;
  escort.modules.push(id);
  return true;
}

export function removeEscortModule(c: CampaignState, escortId: number, id: EscortModuleId): boolean {
  const escort = findEscort(c, escortId);
  if (!escort) return false;
  const idx = escort.modules.indexOf(id);
  if (idx < 0) return false;
  escort.modules.splice(idx, 1);
  return true;
}

/** Does ANY escort in the flotilla carry this module? Used for availability
 *  read-outs and for research effects that ask whether a capability exists at
 *  all, never for deciding which escort may fire — that is per escort. */
export function fleetHasEscortModule(c: CampaignState, id: EscortModuleId): boolean {
  return c.escortUnits.some((e) => e.modules.includes(id));
}

/** Why a base module cannot be fitted (null = it can). */
export function baseModuleBlockReason(c: CampaignState, id: BaseModuleId): string | null {
  if (c.baseModules.includes(id)) return 'Already fitted';
  if (c.baseModules.length >= BASE_MODULE_SLOTS) return 'Base loadout slots are full';
  if (moduleSpare(c, 'base', id) <= 0) return 'No unit held — draft one';
  return null;
}

export function equipBaseModule(c: CampaignState, id: BaseModuleId): boolean {
  if (baseModuleBlockReason(c, id) !== null) return false;
  c.baseModules.push(id);
  return true;
}

export function removeBaseModule(c: CampaignState, id: BaseModuleId): boolean {
  const idx = c.baseModules.indexOf(id);
  if (idx < 0) return false;
  c.baseModules.splice(idx, 1);
  return true;
}

/** Cost to buy one replacement hull of a class, INCLUDING the class's current
 *  module fit — a new hull sails with the class loadout, so the buyer pays for
 *  those modules too (per single ship, not the whole-fleet refit price). */
export function shipCost(c: CampaignState, classId: ShipClassId): number {
  // No module surcharge: fits are drafted, not bought, so a replacement hull
  // sails with the class loadout at no extra cost. Charging for it would have
  // made every drafted module a permanent tax on replacing losses — which, in
  // a fleet that is losing ships, is worth more than the module.
  void c;
  return SHIP_CLASSES[classId].replaceCost;
}

/** Interceptor round price with the Commander quartermaster modifier baked in
 *  (exported so the UI quotes the same number the purchase charges). */
export function ammoUnitCost(c: CampaignState): number {
  return Math.max(1, Math.round(ECONOMY.ammoCost * foldCommanderMods(c.commanderAbilities ?? []).ammoCost));
}

export function buyAmmo(c: CampaignState, count: number): boolean {
  if (!Number.isInteger(count) || count <= 0) return false;
  const cost = ammoUnitCost(c) * count;
  if (c.cash < cost) return false;
  c.cash -= cost;
  c.ammo += count;
  c.roundAmmoBought.interceptor += count;
  recordSpend(c, 'interceptorAmmo', cost);
  return true;
}

export function buyDroneAmmo(c: CampaignState, buys = 1): boolean {
  if (!Number.isInteger(buys) || buys <= 0) return false;
  const cost = ECONOMY.droneAmmoCost * ECONOMY.droneAmmoPerBuy * buys;
  if (c.cash < cost) return false;
  c.cash -= cost;
  c.droneAmmo += ECONOMY.droneAmmoPerBuy * buys;
  c.roundAmmoBought.drone += ECONOMY.droneAmmoPerBuy * buys;
  recordSpend(c, 'mcmDrones', cost);
  return true;
}

export function buyPdAmmo(c: CampaignState, buys = 1): boolean {
  if (!Number.isInteger(buys) || buys <= 0) return false;
  const cost = ECONOMY.pdAmmoCost * ECONOMY.pdAmmoPerBuy * buys;
  if (c.cash < cost) return false;
  c.cash -= cost;
  c.pdAmmo += ECONOMY.pdAmmoPerBuy * buys;
  c.roundAmmoBought.selfDefense += ECONOMY.pdAmmoPerBuy * buys;
  recordSpend(c, 'selfDefense', cost);
  return true;
}

/** Commission a new escort. It arrives with built-in interceptors, a default
 *  name and EMPTY specialist slots — a replacement is a new ship, not a
 *  resurrection of the one that sank, so its loadout is bought fresh. */
/** What commissioning an escort costs, after the Standing Contract legacy. */
export function escortCost(c: CampaignState): number {
  const mods = foldEscortLegacies(activeEscortLegacies(c));
  return Math.max(1, Math.round(ECONOMY.escortCost * mods.escortCost));
}

export function buyEscort(c: CampaignState): boolean {
  if (c.escortUnits.length >= ECONOMY.maxEscorts) return false;
  const cost = escortCost(c);
  if (c.cash < cost) return false;
  c.cash -= cost;
  c.escortUnits.push({
    id: c.nextEscortId++,
    name: claimEscortName(c),
    modules: [],
    damage: 0,
    // A replacement hull picks up any legacy still unassigned — but never one
    // that went down with a previous ship.
    legacy: claimEscortLegacy(c),
  });
  recordSpend(c, 'escortInterceptor', cost);
  return true;
}

export function buyBase(c: CampaignState): boolean {
  if (c.bases >= ECONOMY.maxBases) return false;
  if (c.cash < ECONOMY.baseCost) return false;
  c.cash -= ECONOMY.baseCost;
  c.bases++;
  recordSpend(c, 'baseInterceptor', ECONOMY.baseCost);
  return true;
}

// The convoy's own assets — the A-10 flight, the survey pulse, active sonar,
// defensive smoke and hardened systems — are AVAILABLE FROM ROUND ONE. They
// used to cost 150-160 each to commission on top of the technology that
// unlocked them, which was the same IOU the module economy has shed: the tech
// tree said the fleet had an A-10 and the bank said it did not. What is bought
// now is only the ORDNANCE, every round, which is the decision worth keeping.

/** How many A-10 sorties can be held at once. Research buys apron space; it no
 *  longer hands out free sorties each round. */
export function warthogCapacity(c: CampaignState): number {
  return resolveBranchStats('warthog', researchSet(c)).grants.charges ?? 0;
}

export function scanCapacity(c: CampaignState): number {
  return resolveBranchStats('scanPulse', researchSet(c)).grants.charges ?? 0;
}

export function warthogSortieBlockReason(c: CampaignState): string | null {
  if (c.warthogStock >= warthogCapacity(c)) return 'Apron full';
  if (c.cash < ECONOMY.warthogSortieCost) return 'Not enough cash';
  return null;
}

export function buyWarthogSortie(c: CampaignState): boolean {
  if (warthogSortieBlockReason(c) !== null) return false;
  c.cash -= ECONOMY.warthogSortieCost;
  c.warthogStock++;
  recordSpend(c, 'warthog', ECONOMY.warthogSortieCost);
  return true;
}

export function scanPulseBlockReason(c: CampaignState): string | null {
  if (c.scanStock >= scanCapacity(c)) return 'Stowage full';
  if (c.cash < ECONOMY.scanPulseCost) return 'Not enough cash';
  return null;
}

/** Deck-gun shells. The gun hardware arrives through the draft; every round
 *  it fires is a shell bought here. No stowage cap — like interceptor ammo,
 *  the constraint is the price, not the shelf. */
export function gunShellsBlockReason(c: CampaignState): string | null {
  if (!fleetHasEscortModule(c, 'deckGun') && c.moduleStock.escort.deckGun === undefined) {
    return 'No deck gun in the flotilla';
  }
  if (c.cash < ECONOMY.gunShellCost * ECONOMY.gunShellsPerBuy) return 'Not enough cash';
  return null;
}

export function buyGunShells(c: CampaignState): boolean {
  if (gunShellsBlockReason(c) !== null) return false;
  c.cash -= ECONOMY.gunShellCost * ECONOMY.gunShellsPerBuy;
  c.gunAmmo += ECONOMY.gunShellsPerBuy;
  c.roundAmmoBought.gun += ECONOMY.gunShellsPerBuy;
  recordSpend(c, 'deckGunAmmo', ECONOMY.gunShellCost * ECONOMY.gunShellsPerBuy);
  return true;
}

export function buyScanPulse(c: CampaignState): boolean {
  if (scanPulseBlockReason(c) !== null) return false;
  c.cash -= ECONOMY.scanPulseCost;
  c.scanStock++;
  recordSpend(c, 'scanPulse', ECONOMY.scanPulseCost);
  return true;
}


/** Pre-round protected-channel selection (hardened systems). Rejects picks
 *  beyond the researched channel capacity or unknown families. */
export function setProtectedChannels(c: CampaignState, families: SensorFamily[]): boolean {
  const valid: SensorFamily[] = ['mineDetection', 'torpedoDetection', 'missileWarning', 'smokeImaging'];
  if (families.some((f) => !valid.includes(f))) return false;
  if (new Set(families).size !== families.length) return false;
  const eff = researchSet(c);
  const capacity = eff.has('hardened.dualChannel') ? 2 : eff.has('hardened.protectedChannel') ? 1 : 0;
  if (families.length > capacity) return false;
  c.protectedChannels = [...families];
  return true;
}

/** Pre-round automation preference (also toggleable live in transit). */
export function setAutoFire(c: CampaignState, system: AutoSystem, enabled: boolean): void {
  c.autoFire[system] = enabled;
}

/** Total unrepaired hull damage across cargo hulls, escorts and batteries. */
export function totalPendingDamage(c: CampaignState): number {
  return c.pendingDamage + escortDamageTotal(c) + c.baseDamage;
}

/** Unrepaired damage across the whole flotilla. Held per escort so a wound
 *  stays with the ship that took it; summed here because repair is bought for
 *  the fleet in one go. */
export function escortDamageTotal(c: CampaignState): number {
  return c.escortUnits.reduce((sum, e) => sum + e.damage, 0);
}

/** What a repair order covers.
 *
 *  `escorts` takes the shore batteries with it. The two are the same class of
 *  asset — the warships, bought and read on the Defense screen — and the
 *  Forward Repair Yard has always treated them as one thing, patching both for
 *  nothing while the merchant hulls still bill. Splitting them here would make
 *  the yard's rule stop lining up with the buttons that spend it. */
export type RepairScope = 'cargo' | 'escorts' | 'all';

/** Unrepaired hp inside a scope. */
export function scopeDamage(c: CampaignState, scope: RepairScope = 'all'): number {
  if (scope === 'cargo') return c.pendingDamage;
  if (scope === 'escorts') return escortDamageTotal(c) + c.baseDamage;
  return totalPendingDamage(c);
}

/** The hp inside a scope the yard actually bills for. */
function billableDamage(c: CampaignState, scope: RepairScope): number {
  // The Forward Repair Yard patches the warships for nothing: only the
  // merchant hulls still bill.
  const yard = hasResearch(c, 'logistics.repairYard');
  if (!yard) return scopeDamage(c, scope);
  return scope === 'escorts' ? 0 : c.pendingDamage;
}

/** Dollars per hp, after technology and the commander modifier. */
function repairRate(c: CampaignState): number {
  const mult = hasResearch(c, 'logistics.expandedBerthing') ? 0.5 : 1;
  // Commander modifier applied last, after technology effects — same flow as
  // combat effects (base → tech → commander).
  const commander = foldCommanderMods(c.commanderAbilities ?? []).repairCost;
  return ECONOMY.repairCostPerHp * mult * commander;
}

export function repairCost(c: CampaignState, scope: RepairScope = 'all'): number {
  return Math.ceil(billableDamage(c, scope) * repairRate(c));
}

/** Clear up to `hp` of damage inside a scope, WORST-HURT HULL FIRST, and
 *  report how much was actually cleared.
 *
 *  Order matters only for a partial repair, and worst-first is the doctrine
 *  that makes one: the yard puts the money into the ship closest to going down,
 *  not into whichever one happens to be first in the list. */
function clearDamage(c: CampaignState, scope: RepairScope, hp: number): number {
  let budget = Math.max(0, hp);
  const take = (have: number): number => {
    const used = Math.min(have, budget);
    budget -= used;
    return used;
  };
  if (scope === 'cargo' || scope === 'all') {
    c.pendingDamage -= take(c.pendingDamage);
  }
  if (scope === 'escorts' || scope === 'all') {
    for (const unit of [...c.escortUnits].sort((a, b) => b.damage - a.damage)) {
      unit.damage -= take(unit.damage);
    }
    c.baseDamage -= take(c.baseDamage);
  }
  return Math.max(0, hp) - budget;
}

/** Repair a scope completely. Needs the whole price on hand — for anything
 *  less, see repairPartial. */
export function repairFleet(c: CampaignState, scope: RepairScope = 'all'): boolean {
  const damage = scopeDamage(c, scope);
  if (damage <= 0) return false;
  const cost = repairCost(c, scope);
  if (c.cash < cost) return false;
  c.cash -= cost;
  clearDamage(c, scope, damage);
  if (cost > 0) recordSpend(c, 'fleet', cost);
  return true;
}

/** What a spend-what-you-have repair would buy: the hp it would clear and the
 *  cash it would cost. Quoted rather than inferred so the button can say it. */
export function repairPartialQuote(
  c: CampaignState,
  scope: 'cargo' | 'escorts',
): { hp: number; cost: number } {
  const damage = scopeDamage(c, scope);
  if (damage <= 0) return { hp: 0, cost: 0 };
  // Free work (the Forward Repair Yard on warships) has nothing partial about
  // it: the whole scope is cleared for nothing.
  if (billableDamage(c, scope) <= 0) return { hp: damage, cost: 0 };
  const rate = repairRate(c);
  const hp = Math.min(damage, Math.floor(c.cash / rate));
  return { hp, cost: Math.min(c.cash, Math.ceil(hp * rate)) };
}

/** Put whatever cash is left into a scope and patch as much as it buys.
 *
 *  Offered for the single-category orders only, deliberately: "repair what you
 *  can across everything" is not a decision, it is just spending the wallet. A
 *  player who cannot afford it all should be choosing WHICH half to patch. */
export function repairPartial(c: CampaignState, scope: 'cargo' | 'escorts'): boolean {
  const { hp, cost } = repairPartialQuote(c, scope);
  if (hp <= 0) return false;
  c.cash -= cost;
  clearDamage(c, scope, hp);
  if (cost > 0) recordSpend(c, 'fleet', cost);
  return true;
}

export function buyShip(c: CampaignState, classId: ShipClassId): boolean {
  const cost = shipCost(c, classId);
  if (c.cash < cost) return false;
  c.cash -= cost;
  c.fleet[classId]++;
  recordSpend(c, 'fleet', cost);
  return true;
}

export function totalComposition(c: CampaignState): number {
  return Object.values(c.composition).reduce((a, b) => a + b, 0);
}

export function setComposition(c: CampaignState, classId: ShipClassId, count: number): boolean {
  const clamped = Math.max(0, Math.min(count, c.fleet[classId]));
  const others = totalComposition(c) - c.composition[classId];
  if (others + clamped > c.capacity) return false;
  c.composition[classId] = clamped;
  return true;
}

export function setFormation(c: CampaignState, formation: FormationId): void {
  c.formation = formation;
}
