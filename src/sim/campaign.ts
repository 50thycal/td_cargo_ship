// Campaign orchestration: the meta-game around each transit. Owns the
// economy, research pipeline, convoy scaling, campaign confidence, and the
// glue between transit results and enemy evolution. All mutations validate
// their inputs so the UI can stay dumb.

import { CAMPAIGN, ECONOMY, EVOLUTION } from '../data/tuning';
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
  ShipLoss,
  TechKey,
  TransitState,
} from './types';

export const SAVE_VERSION = 2;

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
    formation: 'tight',
    targetPriority: 'proximity',
    completedResearch: [],
    activeResearch: null,
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

// ---------------------------------------------------------------------------
// Developer / test runs
// ---------------------------------------------------------------------------

export interface DevOptions {
  /** Round to jump into (enemy doctrine is fast-forwarded to match). */
  round: number;
  /** Invincible ships/escorts/batteries and effectively unlimited munitions. */
  god: boolean;
  /** All research complete, ECM/scan installed, max assets & capacity, deep
   *  pockets and full magazines. */
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
      valueSent: 241,
      deliveredFraction: 0.85,
    };
    evolveEnemy(c.evolution, metrics, roundRng(c, `dev-evolve-${r}`));
  }
  c.round = Math.max(1, Math.floor(targetRound));
  // Field unlocked capabilities at full scale (skip the debut fairness caps) so
  // a jumped-to hard level really is hard.
  const evo = c.evolution;
  if (evo.tracks.guidance >= EVOLUTION.guidanceUnlock) evo.firstSeen.guidedMissile ??= 1;
  if (evo.tracks.mines >= EVOLUTION.minesUnlock) evo.firstSeen.mine ??= 1;
  if (evo.tracks.lowSig >= EVOLUTION.lowSigUnlock) evo.firstSeen.lowSigMine ??= 1;
}

/** Build a developer campaign: a normal campaign with the dev flag set, the
 *  chosen god/unlock loadout applied, and the enemy fast-forwarded to `round`. */
export function newDevCampaign(seed: string, opts: DevOptions): CampaignState {
  const c = newCampaign(seed);
  c.dev = true;
  c.godMode = opts.god;
  if (opts.unlockAll) {
    c.completedResearch = Object.keys(RESEARCH) as ResearchId[];
    c.ecmUnlocked = true;
    c.scanUnlocked = true;
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

export function resolveTransit(c: CampaignState, t: TransitState): AfterActionReport {
  const s = t.stats;
  const round = c.round;
  const confidenceBefore = c.confidence;

  // --- Economy ---------------------------------------------------------------
  const cashEarned = s.valueDelivered * ECONOMY.cashPerValue;
  c.cash += cashEarned;
  c.ammo = t.ammo; // unused interceptors carry over
  c.droneAmmo = t.droneAmmo; // unused drone munitions carry over
  c.pdAmmo = t.pdAmmo; // unused point-defense rounds carry over
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

export function buyModule(c: CampaignState, classId: ShipClassId, moduleId: ModuleId): boolean {
  const owned = c.classModules[classId];
  if (owned.includes(moduleId)) return false;
  if (owned.length >= SHIP_CLASSES[classId].slots) return false;
  const cost = moduleCost(c, classId, moduleId);
  if (c.cash < cost) return false;
  c.cash -= cost;
  owned.push(moduleId);
  // Remember what was paid so unequipping refunds exactly this (not a value
  // recomputed at a different fleet size).
  (c.modulePaid[classId] ??= {})[moduleId] = cost;
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
  return true;
}

export function buyDroneAmmo(c: CampaignState, buys = 1): boolean {
  if (!Number.isInteger(buys) || buys <= 0) return false;
  const cost = ECONOMY.droneAmmoCost * ECONOMY.droneAmmoPerBuy * buys;
  if (c.cash < cost) return false;
  c.cash -= cost;
  c.droneAmmo += ECONOMY.droneAmmoPerBuy * buys;
  return true;
}

export function buyPdAmmo(c: CampaignState, buys = 1): boolean {
  if (!Number.isInteger(buys) || buys <= 0) return false;
  const cost = ECONOMY.pdAmmoCost * ECONOMY.pdAmmoPerBuy * buys;
  if (c.cash < cost) return false;
  c.cash -= cost;
  c.pdAmmo += ECONOMY.pdAmmoPerBuy * buys;
  return true;
}

export function buyEscort(c: CampaignState): boolean {
  if (c.escorts >= ECONOMY.maxEscorts) return false;
  if (c.cash < ECONOMY.escortCost) return false;
  c.cash -= ECONOMY.escortCost;
  c.escorts++;
  return true;
}

export function buyBase(c: CampaignState): boolean {
  if (c.bases >= ECONOMY.maxBases) return false;
  if (c.cash < ECONOMY.baseCost) return false;
  c.cash -= ECONOMY.baseCost;
  c.bases++;
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

/** Total unrepaired hull damage across cargo hulls, escorts and batteries. */
export function totalPendingDamage(c: CampaignState): number {
  return c.pendingDamage + c.escortDamage + c.baseDamage;
}

export function repairCost(c: CampaignState): number {
  const mult = c.completedResearch.includes('logistics1') ? 0.5 : 1;
  return Math.ceil(totalPendingDamage(c) * ECONOMY.repairCostPerHp * mult);
}

export function repairFleet(c: CampaignState): boolean {
  const cost = repairCost(c);
  if (cost <= 0 || c.cash < cost) return false;
  c.cash -= cost;
  c.pendingDamage = 0;
  c.escortDamage = 0;
  c.baseDamage = 0;
  return true;
}

export function buyShip(c: CampaignState, classId: ShipClassId): boolean {
  const cost = shipCost(c, classId);
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
