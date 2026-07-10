// Campaign orchestration: the meta-game around each transit. Owns the
// economy, research pipeline, convoy scaling, campaign confidence, and the
// glue between transit results and enemy evolution. All mutations validate
// their inputs so the UI can stay dumb.

import { CAMPAIGN, ECONOMY } from '../data/tuning';
import { MODULES, RESEARCH, SHIP_CLASSES } from '../data/defs';
import { makeRng, type RNG } from './rng';
import { createTransit } from './transit';
import { evolveEnemy, newEvolution, planRound } from './evolution';
import { buildTransitCards } from './aar';
import type {
  AarCard,
  AfterActionReport,
  CampaignState,
  FormationId,
  ModuleId,
  ResearchId,
  RoundMetrics,
  RoundPlan,
  ShipClassId,
  TechKey,
  TransitState,
} from './types';

export const SAVE_VERSION = 1;

export function newCampaign(seed: string): CampaignState {
  return {
    version: SAVE_VERSION,
    seed,
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
    pendingDamage: 0,
    escorts: ECONOMY.startEscorts,
    ammo: ECONOMY.startAmmo,
    ecmUnlocked: false,
    scanUnlocked: false,
    formation: 'tight',
    completedResearch: [],
    activeResearch: null,
    evolution: newEvolution(),
    quota: {
      roundsLeft: CAMPAIGN.quotaWindowRounds,
      pointsNeeded: CAMPAIGN.startCapacity * CAMPAIGN.quotaPerCapacity,
      pointsEarned: 0,
    },
    history: [],
    lastReport: null,
  };
}

/** Deterministic per-round, per-purpose RNG derived from the campaign seed. */
export function roundRng(c: CampaignState, purpose: string): RNG {
  return makeRng(`${c.seed}:r${c.round}:${purpose}`);
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

export function resolveTransit(c: CampaignState, t: TransitState): AfterActionReport {
  const s = t.stats;
  const round = c.round;

  // --- Economy ---------------------------------------------------------------
  const cashEarned = s.valueDelivered * ECONOMY.cashPerValue;
  c.cash += cashEarned;
  c.ammo = t.ammo; // unused interceptors carry over
  c.formation = t.formation; // tactical formation changes persist as the new default

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
  for (const classId of Object.keys(c.composition) as ShipClassId[]) {
    c.composition[classId] = Math.min(c.composition[classId], c.fleet[classId]);
  }
  c.pendingDamage = Math.round(
    t.ships
      .filter((ship) => ship.alive)
      .reduce((sum, ship) => sum + (ship.maxHp - ship.hp), 0),
  );

  // --- Confidence ----------------------------------------------------------------
  const deliveredFraction = s.launched > 0 ? s.delivered / s.launched : 0;
  let confidenceChange = 0;
  if (deliveredFraction >= 0.9) confidenceChange += CAMPAIGN.confidenceGreatRound;
  else if (deliveredFraction >= 0.75) confidenceChange += CAMPAIGN.confidenceGoodRound;
  else if (deliveredFraction < 0.6) confidenceChange += CAMPAIGN.confidenceBadRound;
  confidenceChange += Math.max(CAMPAIGN.confidenceLossCap, CAMPAIGN.confidencePerLoss * s.lost);

  // --- Quota window -----------------------------------------------------------------
  c.quota.pointsEarned += s.valueDelivered;
  c.quota.roundsLeft--;
  const quotaEvaluated = c.quota.roundsLeft <= 0;
  let quotaMet = false;
  const quotaSnapshot = { needed: c.quota.pointsNeeded, earned: c.quota.pointsEarned };
  if (quotaEvaluated) {
    quotaMet = c.quota.pointsEarned >= c.quota.pointsNeeded;
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
    c.quota = {
      roundsLeft: CAMPAIGN.quotaWindowRounds,
      pointsNeeded: c.quota.pointsNeeded + CAMPAIGN.quotaGrowthPerWindow,
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
      if (researchCompleted === 'logistics1') {
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
  const metrics: RoundMetrics = {
    round,
    interceptRate: s.missilesSpawned > 0 ? s.missilesIntercepted / s.missilesSpawned : 1,
    formation: t.formation,
    mineDetectRate: s.minesTotal > 0 ? s.minesRevealed / s.minesTotal : -1,
    valueSent: s.valueSent,
    deliveredFraction,
  };
  evolveEnemy(c.evolution, metrics, roundRng(c, 'evolve'));

  c.campaignOver = c.confidence <= 0;

  // --- Cards --------------------------------------------------------------------------
  const cards: AarCard[] = buildTransitCards(t, newDiscoveries);
  for (const warning of c.evolution.pendingWarnings) {
    cards.push({
      kind: 'warning',
      title: `Intelligence forecast — ${warning.confidencePct}% confidence`,
      body: warning.text,
    });
  }
  if (researchCompleted) {
    cards.push({
      kind: 'research',
      title: `Research complete: ${RESEARCH[researchCompleted].name}`,
      body: RESEARCH[researchCompleted].desc,
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
    cards.push({
      kind: 'quota',
      title: quotaMet ? 'Delivery quota met' : 'Delivery quota missed',
      body: quotaMet
        ? `Delivered ${quotaSnapshot.earned} of ${quotaSnapshot.needed} required cargo points this period. Consortium confidence rises.`
        : `Delivered only ${quotaSnapshot.earned} of ${quotaSnapshot.needed} required cargo points this period. Consortium confidence is shaken.`,
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
      windowRound: CAMPAIGN.quotaWindowRounds - Math.max(0, c.quota.roundsLeft),
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

  c.round++;
  c.phase = 'aar';
  c.lastReport = report;
  return report;
}

// ---------------------------------------------------------------------------
// Research actions
// ---------------------------------------------------------------------------

export function canStartResearch(c: CampaignState, id: ResearchId): { ok: boolean; reason?: string } {
  const def = RESEARCH[id];
  if (c.completedResearch.includes(id)) return { ok: false, reason: 'Already researched' };
  if (c.activeResearch) return { ok: false, reason: 'A project is already underway' };
  if (def.requires && !c.completedResearch.includes(def.requires)) {
    return { ok: false, reason: `Requires ${RESEARCH[def.requires].name}` };
  }
  if (c.intel < def.cost) return { ok: false, reason: 'Not enough intel' };
  return { ok: true };
}

export function startResearch(c: CampaignState, id: ResearchId): boolean {
  if (!canStartResearch(c, id).ok) return false;
  c.intel -= RESEARCH[id].cost;
  c.activeResearch = { id, roundsLeft: 1 };
  return true;
}

// ---------------------------------------------------------------------------
// Procurement actions (all return false when the purchase is invalid)
// ---------------------------------------------------------------------------

export function moduleCost(c: CampaignState, classId: ShipClassId, moduleId: ModuleId): number {
  const count = Math.max(1, c.composition[classId]);
  return MODULES[moduleId].costPerShip * count;
}

export function buyModule(c: CampaignState, classId: ShipClassId, moduleId: ModuleId): boolean {
  const owned = c.classModules[classId];
  if (owned.includes(moduleId)) return false;
  if (owned.length >= SHIP_CLASSES[classId].slots) return false;
  const cost = moduleCost(c, classId, moduleId);
  if (c.cash < cost) return false;
  c.cash -= cost;
  owned.push(moduleId);
  return true;
}

export function buyAmmo(c: CampaignState, count: number): boolean {
  const cost = ECONOMY.ammoCost * count;
  if (c.cash < cost) return false;
  c.cash -= cost;
  c.ammo += count;
  return true;
}

export function buyEscort(c: CampaignState): boolean {
  if (c.escorts >= ECONOMY.maxEscorts) return false;
  if (c.cash < ECONOMY.escortCost) return false;
  c.cash -= ECONOMY.escortCost;
  c.escorts++;
  return true;
}

export function unlockEcm(c: CampaignState): boolean {
  if (c.ecmUnlocked || c.cash < ECONOMY.ecmUnlockCost) return false;
  c.cash -= ECONOMY.ecmUnlockCost;
  c.ecmUnlocked = true;
  return true;
}

export function unlockScan(c: CampaignState): boolean {
  if (c.scanUnlocked || c.cash < ECONOMY.scanUnlockCost) return false;
  c.cash -= ECONOMY.scanUnlockCost;
  c.scanUnlocked = true;
  return true;
}

export function repairCost(c: CampaignState): number {
  const mult = c.completedResearch.includes('logistics1') ? 0.5 : 1;
  return Math.ceil(c.pendingDamage * ECONOMY.repairCostPerHp * mult);
}

export function repairFleet(c: CampaignState): boolean {
  const cost = repairCost(c);
  if (cost <= 0 || c.cash < cost) return false;
  c.cash -= cost;
  c.pendingDamage = 0;
  return true;
}

export function buyShip(c: CampaignState, classId: ShipClassId): boolean {
  const cost = SHIP_CLASSES[classId].replaceCost;
  if (c.cash < cost) return false;
  c.cash -= cost;
  c.fleet[classId]++;
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
