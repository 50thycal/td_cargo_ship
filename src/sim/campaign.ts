// Campaign orchestration: the meta-game around each transit. Owns the
// economy, research pipeline, convoy scaling, campaign confidence, and the
// glue between transit results and enemy evolution. All mutations validate
// their inputs so the UI can stay dumb.
//
// Research runs on the counter catalogue (data/counters.ts): branches with
// hardware NODES and TACTICS, multi-prerequisites, and granted built-ins.
// Equipment purchases are gated on each branch's base node — intel unlocks,
// cash equips, and neither substitutes for the other.

import { CAMPAIGN, ECONOMY, ENEMY_ECONOMY } from '../data/tuning';
import {
  BASE_MODULES,
  BASE_MODULE_SLOTS,
  ESCORT_MODULES,
  ESCORT_MODULE_SLOTS,
  MODULES,
  SHIP_CLASSES,
} from '../data/defs';
import {
  ABILITY_RESEARCH_REQUIREMENT,
  allResearchableIds,
  BASE_MODULE_RESEARCH_REQUIREMENT,
  COUNTER_BRANCHES,
  effectiveResearch,
  ESCORT_MODULE_RESEARCH_REQUIREMENT,
  MODULE_RESEARCH_REQUIREMENT,
  RESEARCH_INDEX,
  type CounterTacticDef,
} from '../data/counters';
import { makeRng, type RNG } from './rng';
import { createTransit } from './transit';
import { evolveEnemy, newEvolution, planRound, targetingName } from './evolution';
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
  FormationId,
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

export const SAVE_VERSION = 3;

const DEFAULT_AUTO_FIRE: Record<AutoSystem, boolean> = {
  escortInterceptor: true,
  baseInterceptor: true,
  mcmDrones: true,
  depthCharges: true,
  deckGun: true,
  counterBattery: true,
};

export function newCampaign(seed: string): CampaignState {
  return {
    version: SAVE_VERSION,
    seed,
    dev: false,
    godMode: false,
    round: 1,
    phase: 'prep',
    cash: ECONOMY.startCash,
    intel: ECONOMY.startIntel,
    score: 0,
    capacity: CAMPAIGN.startCapacity,
    confidence: CAMPAIGN.startConfidence,
    strongStreak: 0,
    campaignOver: false,
    fleet: { cargo: 15, tanker: 3, freighter: 2 },
    composition: { cargo: 15, tanker: 3, freighter: 2 },
    classModules: { cargo: [], tanker: [], freighter: [] },
    modulePaid: { cargo: {}, tanker: {}, freighter: {} },
    escortModules: [],
    escortModulePaid: {},
    baseModules: [],
    baseModulePaid: {},
    pendingDamage: 0,
    escortDamage: 0,
    baseDamage: 0,
    bases: ECONOMY.startBases,
    escorts: ECONOMY.startEscorts,
    ammo: ECONOMY.startAmmo,
    droneAmmo: ECONOMY.startDroneAmmo,
    pdAmmo: ECONOMY.startPdAmmo,
    ecmUnlocked: false,
    scanUnlocked: false,
    sonarUnlocked: false,
    smokeUnlocked: false,
    hardenedUnlocked: false,
    autoFire: { ...DEFAULT_AUTO_FIRE },
    protectedChannels: [],
    formation: 'tight',
    targetPriority: 'proximity',
    completedResearch: [],
    activeResearch: null,
    roundSpend: {},
    roundAmmoBought: { interceptor: 0, drone: 0, selfDefense: 0 },
    evolution: newEvolution(),
    quota: {
      roundsLeft: CAMPAIGN.quotaWindowRounds,
      pointsNeeded: CAMPAIGN.startCapacity * CAMPAIGN.quotaPerCapacity,
      pointsEarned: 0,
    },
    quotaDifficulty: CAMPAIGN.quotaDifficultyStart,
    history: [],
    telemetry: [],
    lastReport: null,
  };
}

/** Deterministic per-round, per-purpose RNG derived from the campaign seed. */
export function roundRng(c: CampaignState, purpose: string): RNG {
  return makeRng(`${c.seed}:r${c.round}:${purpose}`);
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
    c.ecmUnlocked = true;
    c.scanUnlocked = true;
    c.sonarUnlocked = true;
    c.smokeUnlocked = true;
    c.hardenedUnlocked = true;
    // The limited loadout slots still apply, even for dev runs.
    c.escortModules = ['mcmDroneLauncher', 'deckGun'];
    c.baseModules = ['counterBattery'];
    c.cash = 999_999;
    c.intel = 9_999;
    c.ammo = 999;
    c.droneAmmo = 999;
    c.pdAmmo = 999;
    c.bases = ECONOMY.maxBases;
    c.escorts = ECONOMY.maxEscorts;
    c.capacity = CAMPAIGN.maxCapacity;
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
      kills: ledger.kills,
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
  const cashEarned = s.valueDelivered * ECONOMY.cashPerValue;
  c.cash += cashEarned;
  c.ammo = t.ammo; // unused interceptors carry over
  c.droneAmmo = t.droneAmmo; // unused drone munitions carry over
  c.pdAmmo = t.pdAmmo; // unused self-defense rounds carry over
  c.formation = t.formation; // tactical formation changes persist as the new default
  c.autoFire = { ...t.autoFire }; // in-transit automation toggles persist

  const newDiscoveries: TechKey[] = [];
  for (const key of t.debutsSeen) {
    if (c.evolution.firstSeen[key] === undefined) {
      c.evolution.firstSeen[key] = round;
      newDiscoveries.push(key);
    }
  }
  const intelEarned = Math.min(
    ECONOMY.intelMaxPerRound,
    ECONOMY.intelPerRound +
      ECONOMY.intelPerLoss * s.lost +
      ECONOMY.intelPerIntercept * s.missilesIntercepted +
      ECONOMY.intelPerDiscovery * newDiscoveries.length,
  );
  c.intel += intelEarned;

  // --- Fleet bookkeeping -------------------------------------------------------
  for (const ship of t.ships) {
    if (!ship.alive) {
      c.fleet[ship.classId] = Math.max(0, c.fleet[ship.classId] - 1);
    }
  }
  // Escorts and batteries destroyed at sea are removed from the fleet.
  if (s.escortsLost > 0) {
    c.escorts = Math.max(0, c.escorts - s.escortsLost);
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
  c.escortDamage = Math.round(
    t.escorts.filter((e) => e.alive).reduce((sum, e) => sum + (e.maxHp - e.hp), 0),
  );
  c.baseDamage = Math.round(
    t.bases.filter((b) => b.alive).reduce((sum, b) => sum + (b.maxHp - b.hp), 0),
  );

  // --- Confidence ----------------------------------------------------------------
  const deliveredFraction = s.launched > 0 ? s.delivered / s.launched : 0;
  let confidenceChange = 0;
  if (deliveredFraction >= 0.9) confidenceChange += CAMPAIGN.confidenceGreatRound;
  else if (deliveredFraction >= 0.75) confidenceChange += CAMPAIGN.confidenceGoodRound;
  else if (deliveredFraction < 0.6) confidenceChange += CAMPAIGN.confidenceBadRound;
  confidenceChange += Math.max(CAMPAIGN.confidenceLossCap, CAMPAIGN.confidencePerLoss * s.lost);
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
  // A quota resolves the moment it is MET — a new, larger one begins next round —
  // or when its rounds run out (a miss). No more waiting out a window you've
  // already cleared.
  const quotaMet = c.quota.pointsEarned >= c.quota.pointsNeeded;
  const quotaEvaluated = quotaMet || c.quota.roundsLeft <= 0;
  const quotaSnapshot = { needed: c.quota.pointsNeeded, earned: c.quota.pointsEarned };
  // Captured before the window resets below (1-based round within the window).
  const quotaWindowRound = CAMPAIGN.quotaWindowRounds - Math.max(0, c.quota.roundsLeft);
  if (quotaEvaluated) {
    confidenceChange += quotaMet ? CAMPAIGN.confidenceQuotaMet : CAMPAIGN.confidenceQuotaMissed;
  }

  c.confidence = Math.max(0, Math.min(CAMPAIGN.maxConfidence, c.confidence + confidenceChange));

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

  if (quotaEvaluated) {
    // Rubber-band the difficulty multiplier off how comfortably the window
    // resolved: an easy clear (big surplus) ratchets it up; a miss (big
    // shortfall) eases it back down. Each step scales with the margin, capped
    // so no single window swings it too far.
    const ratio = quotaSnapshot.needed > 0 ? quotaSnapshot.earned / quotaSnapshot.needed : 1;
    if (quotaMet) {
      const surplus = Math.max(0, ratio - 1);
      const step = Math.min(CAMPAIGN.quotaDifficultyUpStep, surplus * CAMPAIGN.quotaDifficultyUpStep * 2);
      c.quotaDifficulty = Math.min(CAMPAIGN.quotaDifficultyMax, c.quotaDifficulty + step);
    } else {
      const shortfall = Math.max(0, 1 - ratio);
      const step = Math.min(CAMPAIGN.quotaDifficultyDownStep, shortfall * CAMPAIGN.quotaDifficultyDownStep * 2);
      c.quotaDifficulty = Math.max(CAMPAIGN.quotaDifficultyMin, c.quotaDifficulty - step);
    }
    // Size the next target off the player's own recent pace (average value
    // delivered per round actually played this window) rather than a flat
    // increment, so it tracks real capability as the campaign progresses.
    const avgPerRound = quotaWindowRound > 0 ? quotaSnapshot.earned / quotaWindowRound : quotaSnapshot.earned;
    const target = avgPerRound * CAMPAIGN.quotaWindowRounds * c.quotaDifficulty;
    const floor = c.capacity * CAMPAIGN.quotaFloorPerCapacity;
    c.quota = {
      roundsLeft: CAMPAIGN.quotaWindowRounds,
      pointsNeeded: Math.max(Math.round(target), Math.round(floor)),
      pointsEarned: 0,
    };
  }

  // --- Research pipeline -----------------------------------------------------------
  let researchCompleted: ResearchId | undefined;
  if (c.activeResearch) {
    c.activeResearch.roundsLeft--;
    if (c.activeResearch.roundsLeft <= 0) {
      researchCompleted = c.activeResearch.id;
      c.completedResearch.push(researchCompleted);
      c.activeResearch = null;
      if (researchCompleted === 'logistics.expandedBerthing') {
        c.capacity = Math.min(CAMPAIGN.maxCapacity, c.capacity + 5);
      }
    }
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

  c.campaignOver = c.confidence <= 0;

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
  if (researchCompleted && RESEARCH_INDEX[researchCompleted]) {
    const entry = RESEARCH_INDEX[researchCompleted];
    cards.push({
      kind: 'research',
      title: `Research complete: ${entry.def.name}`,
      body: `${entry.branch.name} — ${entry.def.desc}`,
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
    // The window has already rolled over to the next one here, so c.quota now
    // holds the fresh requirement — tell the player exactly what's next.
    const next = `New quota: deliver ${c.quota.pointsNeeded} cargo points over the next ${CAMPAIGN.quotaWindowRounds} rounds (scaled to your recent pace).`;
    cards.push({
      kind: 'quota',
      title: quotaMet ? 'Delivery quota met' : 'Delivery quota missed',
      body:
        (quotaMet
          ? `Delivered ${quotaSnapshot.earned} of ${quotaSnapshot.needed} cargo points — quota cleared, consortium confidence rises. `
          : `Delivered only ${quotaSnapshot.earned} of ${quotaSnapshot.needed} cargo points in time — consortium confidence is shaken. `) +
        next,
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
    intelEarned,
    confidenceChange,
    confidenceAfter: c.confidence,
    capacityIncreased,
    researchCompleted,
    quota: {
      windowRound: quotaWindowRound,
      earned: quotaSnapshot.earned,
      needed: quotaSnapshot.needed,
      evaluated: quotaEvaluated,
      met: quotaMet,
    },
    cards,
    campaignOver: c.campaignOver,
  };

  c.history.push({
    round,
    launched: s.launched,
    delivered: s.delivered,
    lost: s.lost,
    valueDelivered: s.valueDelivered,
    cashEarned,
    intelEarned,
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
      escorts: [...c.escortModules],
      bases: [...c.baseModules],
      abilities: [
        ...(c.ecmUnlocked ? ['ecm'] : []),
        ...(c.scanUnlocked ? ['scanPulse'] : []),
        ...(c.sonarUnlocked ? ['activeSonar'] : []),
        ...(c.smokeUnlocked ? ['smokeScreen'] : []),
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
    ecmUsed: s.ecmUsed,
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
    escortsLost: s.escortsLost,
    basesLost: s.basesLost,
    launchersDisabled: s.launchersDisabled,
    losses,
    cashEarned,
    intelEarned,
    confidenceBefore,
    confidenceAfter: c.confidence,
    capacity: c.capacity,
    capacityIncreased,
    basesOwned: c.bases,
    escortsOwned: c.escorts,
    researchCompleted: researchCompleted ?? null,
    activeResearch: c.activeResearch?.id ?? null,
    completedResearch: [...c.completedResearch],
    enemyTracks: { ...c.evolution.tracks },
    newDiscoveries: [...newDiscoveries],
    counters,
    enemy: buildEnemyTelemetry(c),
  });

  // A fresh spend ledger for the next prep phase.
  c.roundSpend = {};
  c.roundAmmoBought = { interceptor: 0, drone: 0, selfDefense: 0 };

  c.round++;
  c.phase = 'aar';
  c.lastReport = report;
  return report;
}

// ---------------------------------------------------------------------------
// Research actions
// ---------------------------------------------------------------------------

export function canStartResearch(c: CampaignState, id: ResearchId): { ok: boolean; reason?: string } {
  const entry = RESEARCH_INDEX[id];
  if (!entry) return { ok: false, reason: 'Unknown project' };
  if (entry.def.granted) return { ok: false, reason: 'Built-in — no research needed' };
  const eff = researchSet(c);
  if (eff.has(id)) return { ok: false, reason: 'Already researched' };
  if (c.activeResearch) return { ok: false, reason: 'A project is already underway' };
  const missing = entry.requires.find((r) => !eff.has(r));
  if (missing) {
    return { ok: false, reason: `Requires ${RESEARCH_INDEX[missing]?.def.name ?? missing}` };
  }
  const excludes = (entry.def as CounterTacticDef).excludes;
  const conflict = excludes?.find((e) => eff.has(e));
  if (conflict) {
    return {
      ok: false,
      reason: `Mutually exclusive with ${RESEARCH_INDEX[conflict]?.def.name ?? conflict}`,
    };
  }
  if (c.intel < entry.def.cost) return { ok: false, reason: 'Not enough intel' };
  return { ok: true };
}

export function startResearch(c: CampaignState, id: ResearchId): boolean {
  if (!canStartResearch(c, id).ok) return false;
  c.intel -= RESEARCH_INDEX[id].def.cost;
  c.activeResearch = { id, roundsLeft: 1 };
  return true;
}

// ---------------------------------------------------------------------------
// Procurement actions (all return false when the purchase is invalid)
// ---------------------------------------------------------------------------

/** Priced on OWNED hulls, not the mutable convoy assignment — composition can
 *  be toggled to zero for free, which would otherwise let the player buy a
 *  class-wide refit at single-ship price. Fleet size only shrinks through
 *  real losses, so it is exploit-proof as a price basis.
 *
 *  The rate itself SOFT-CAPS: hulls up to moduleCostSoftCap are billed at the
 *  full per-ship rate (so early-game pricing is unchanged), and hulls beyond
 *  the cap are billed at a fraction of it — otherwise a late-campaign fleet of
 *  30+ ships makes every refit cost thousands and nothing is ever affordable. */
export function moduleCost(c: CampaignState, classId: ShipClassId, moduleId: ModuleId): number {
  const count = Math.max(1, c.fleet[classId]);
  const cap = ECONOMY.moduleCostSoftCap;
  const billable = count <= cap ? count : cap + (count - cap) * ECONOMY.moduleCostTaperRate;
  return Math.round(MODULES[moduleId].costPerShip * billable);
}

/** Why a cargo module cannot be bought right now (null = it can). Purchase is
 *  gated on the branch's base research node — cash never skips the lab. */
export function moduleBlockReason(
  c: CampaignState,
  classId: ShipClassId,
  moduleId: ModuleId,
): string | null {
  const owned = c.classModules[classId];
  if (owned.includes(moduleId)) return 'Already equipped';
  if (owned.length >= SHIP_CLASSES[classId].slots) return 'No module slots free on this class';
  const req = MODULE_RESEARCH_REQUIREMENT[moduleId];
  if (req && !hasResearch(c, req)) {
    return `Requires research: ${RESEARCH_INDEX[req]?.def.name ?? req}`;
  }
  if (c.cash < moduleCost(c, classId, moduleId)) return 'Not enough cash';
  return null;
}

export function buyModule(c: CampaignState, classId: ShipClassId, moduleId: ModuleId): boolean {
  if (moduleBlockReason(c, classId, moduleId) !== null) return false;
  const cost = moduleCost(c, classId, moduleId);
  c.cash -= cost;
  c.classModules[classId].push(moduleId);
  // Remember what was paid so unequipping refunds exactly this (not a value
  // recomputed at a different fleet size).
  (c.modulePaid[classId] ??= {})[moduleId] = cost;
  recordSpend(c, moduleId, cost);
  return true;
}

/** Unequip a class module and refund exactly what was paid to fit it, so the
 *  player can freely try loadouts within a class's limited slots. */
export function removeModule(c: CampaignState, classId: ShipClassId, moduleId: ModuleId): boolean {
  const owned = c.classModules[classId];
  const idx = owned.indexOf(moduleId);
  if (idx < 0) return false;
  owned.splice(idx, 1);
  const paid = c.modulePaid[classId]?.[moduleId];
  if (paid !== undefined) {
    c.cash += paid;
    delete c.modulePaid[classId][moduleId];
    recordSpend(c, moduleId, -paid);
  }
  return true;
}

/** Why an escort module cannot be fitted (null = it can). */
export function escortModuleBlockReason(c: CampaignState, id: EscortModuleId): string | null {
  if (c.escortModules.includes(id)) return 'Already fitted';
  if (c.escortModules.length >= ESCORT_MODULE_SLOTS) return 'Escort loadout slots are full';
  const req = ESCORT_MODULE_RESEARCH_REQUIREMENT[id];
  if (!hasResearch(c, req)) return `Requires research: ${RESEARCH_INDEX[req]?.def.name ?? req}`;
  if (c.cash < ESCORT_MODULES[id].cost) return 'Not enough cash';
  return null;
}

export function buyEscortModule(c: CampaignState, id: EscortModuleId): boolean {
  if (escortModuleBlockReason(c, id) !== null) return false;
  const cost = ESCORT_MODULES[id].cost;
  c.cash -= cost;
  c.escortModules.push(id);
  c.escortModulePaid[id] = cost;
  recordSpend(c, COUNTER_BRANCHES[id === 'mcmDroneLauncher' ? 'mcmDrones' : id].id, cost);
  return true;
}

export function removeEscortModule(c: CampaignState, id: EscortModuleId): boolean {
  const idx = c.escortModules.indexOf(id);
  if (idx < 0) return false;
  c.escortModules.splice(idx, 1);
  const paid = c.escortModulePaid[id];
  if (paid !== undefined) {
    c.cash += paid;
    delete c.escortModulePaid[id];
    recordSpend(c, COUNTER_BRANCHES[id === 'mcmDroneLauncher' ? 'mcmDrones' : id].id, -paid);
  }
  return true;
}

/** Why a base module cannot be fitted (null = it can). */
export function baseModuleBlockReason(c: CampaignState, id: BaseModuleId): string | null {
  if (c.baseModules.includes(id)) return 'Already fitted';
  if (c.baseModules.length >= BASE_MODULE_SLOTS) return 'Base loadout slots are full';
  const req = BASE_MODULE_RESEARCH_REQUIREMENT[id];
  if (!hasResearch(c, req)) return `Requires research: ${RESEARCH_INDEX[req]?.def.name ?? req}`;
  if (c.cash < BASE_MODULES[id].cost) return 'Not enough cash';
  return null;
}

export function buyBaseModule(c: CampaignState, id: BaseModuleId): boolean {
  if (baseModuleBlockReason(c, id) !== null) return false;
  const cost = BASE_MODULES[id].cost;
  c.cash -= cost;
  c.baseModules.push(id);
  c.baseModulePaid[id] = cost;
  recordSpend(c, id, cost);
  return true;
}

export function removeBaseModule(c: CampaignState, id: BaseModuleId): boolean {
  const idx = c.baseModules.indexOf(id);
  if (idx < 0) return false;
  c.baseModules.splice(idx, 1);
  const paid = c.baseModulePaid[id];
  if (paid !== undefined) {
    c.cash += paid;
    delete c.baseModulePaid[id];
    recordSpend(c, id, -paid);
  }
  return true;
}

/** Cost to buy one replacement hull of a class, INCLUDING the class's current
 *  module fit — a new hull sails with the class loadout, so the buyer pays for
 *  those modules too (per single ship, not the whole-fleet refit price). */
export function shipCost(c: CampaignState, classId: ShipClassId): number {
  const modules = c.classModules[classId] ?? [];
  const moduleSurcharge = modules.reduce((sum, m) => sum + MODULES[m].costPerShip, 0);
  return SHIP_CLASSES[classId].replaceCost + moduleSurcharge;
}

export function buyAmmo(c: CampaignState, count: number): boolean {
  if (!Number.isInteger(count) || count <= 0) return false;
  const cost = ECONOMY.ammoCost * count;
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

export function buyEscort(c: CampaignState): boolean {
  if (c.escorts >= ECONOMY.maxEscorts) return false;
  if (c.cash < ECONOMY.escortCost) return false;
  c.cash -= ECONOMY.escortCost;
  c.escorts++;
  recordSpend(c, 'escortInterceptor', ECONOMY.escortCost);
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

export function unlockEcm(c: CampaignState): boolean {
  if (c.ecmUnlocked || c.cash < ECONOMY.ecmUnlockCost) return false;
  if (!hasResearch(c, ABILITY_RESEARCH_REQUIREMENT.ecm)) return false;
  c.cash -= ECONOMY.ecmUnlockCost;
  c.ecmUnlocked = true;
  recordSpend(c, 'ecm', ECONOMY.ecmUnlockCost);
  return true;
}

export function unlockScan(c: CampaignState): boolean {
  if (c.scanUnlocked || c.cash < ECONOMY.scanUnlockCost) return false;
  if (!hasResearch(c, ABILITY_RESEARCH_REQUIREMENT.scan)) return false;
  c.cash -= ECONOMY.scanUnlockCost;
  c.scanUnlocked = true;
  recordSpend(c, 'scanPulse', ECONOMY.scanUnlockCost);
  return true;
}

export function unlockSonar(c: CampaignState): boolean {
  if (c.sonarUnlocked || c.cash < ECONOMY.sonarUnlockCost) return false;
  if (!hasResearch(c, ABILITY_RESEARCH_REQUIREMENT.sonar)) return false;
  c.cash -= ECONOMY.sonarUnlockCost;
  c.sonarUnlocked = true;
  recordSpend(c, 'activeSonar', ECONOMY.sonarUnlockCost);
  return true;
}

export function unlockSmoke(c: CampaignState): boolean {
  if (c.smokeUnlocked || c.cash < ECONOMY.smokeUnlockCost) return false;
  if (!hasResearch(c, ABILITY_RESEARCH_REQUIREMENT.smoke)) return false;
  c.cash -= ECONOMY.smokeUnlockCost;
  c.smokeUnlocked = true;
  recordSpend(c, 'smokeScreen', ECONOMY.smokeUnlockCost);
  return true;
}

export function unlockHardened(c: CampaignState): boolean {
  if (c.hardenedUnlocked || c.cash < ECONOMY.hardenedUnlockCost) return false;
  if (!hasResearch(c, ABILITY_RESEARCH_REQUIREMENT.hardened)) return false;
  c.cash -= ECONOMY.hardenedUnlockCost;
  c.hardenedUnlocked = true;
  recordSpend(c, 'hardened', ECONOMY.hardenedUnlockCost);
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
  return c.pendingDamage + c.escortDamage + c.baseDamage;
}

export function repairCost(c: CampaignState): number {
  const mult = hasResearch(c, 'logistics.expandedBerthing') ? 0.5 : 1;
  return Math.ceil(totalPendingDamage(c) * ECONOMY.repairCostPerHp * mult);
}

export function repairFleet(c: CampaignState): boolean {
  const cost = repairCost(c);
  if (cost <= 0 || c.cash < cost) return false;
  c.cash -= cost;
  c.pendingDamage = 0;
  c.escortDamage = 0;
  c.baseDamage = 0;
  recordSpend(c, 'fleet', cost);
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
