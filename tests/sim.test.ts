// Headless simulation tests. These play entire campaigns with scripted bot
// policies to prove the loop works end-to-end without a browser, and to pin
// the designed early-campaign beats (guided missiles by R3, mines by R5,
// fairness caps, capacity growth, determinism).

import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/sim/rng';
import {
  buyAmmo,
  buyBase,
  buyEscort,
  buyModule,
  buyPdAmmo,
  buyShip,
  createRoundTransit,
  escortDamageTotal,
  moduleCost,
  newCampaign,
  newDevCampaign,
  planCurrentRound,
  removeModule,
  repairCost,
  repairFleet,
  resolveTransit,
  setComposition,
  shipCost,
  unlockScan,
} from '../src/sim/campaign';
import { selectDraftOption } from '../src/sim/draft';
import { newProfile } from '../src/sim/commander';
import { FIRST_REGION } from '../src/data/regions';
import { fitUniformEscorts } from './helpers';
import { stepTransit } from '../src/sim/transit';
import { evolveEnemy, newEvolution, planRound } from '../src/sim/evolution';
import { buildTelemetryExport } from '../src/sim/telemetry';
import {
  clearProfile,
  clearRun,
  loadProfile,
  loadRun,
  migrateProfile,
  migrateRun,
  saveProfile,
  saveRun,
} from '../src/platform/save';
import { MODULES, SHIP_CLASSES } from '../src/data/defs';
import { allResearchableIds } from '../src/data/counters';
import { CAMPAIGN, COMBAT, ECONOMY, ENEMY_ECONOMY, SIM, SPAWN, WORLD } from '../src/data/tuning';
import type {
  AfterActionReport,
  CampaignState,
  RoundMetrics,
  ShipClassId,
  RoundPlan,
  TransitCommand,
  TransitState,
} from '../src/sim/types';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface BotOptions {
  defend: boolean;
  useScan?: boolean;
}

function runRound(c: CampaignState, opts: BotOptions): { state: TransitState; report: AfterActionReport } {
  const plan = planCurrentRound(c);
  const { state, rng } = createRoundTransit(c, plan);
  let scanUsedAt = -1;
  let rescueOrderAt = -1;
  while (!state.over) {
    const cmds: TransitCommand[] = [];
    // Fire whenever any launcher (shore battery or escort) is ready.
    const launcherReady =
      state.ammo > 0 &&
      (state.bases.some((b) => b.cooldown <= 0) || state.escorts.some((e) => e.cooldown <= 0));
    if (opts.defend && launcherReady) {
      for (const threat of state.threats) {
        if (threat.alive && threat.kind !== 'mine' && !threat.claimedByInterceptor) {
          cmds.push({ type: 'intercept', threatId: threat.id });
          break; // one launch attempt per ready window
        }
      }
    }
    if (opts.useScan && state.scanCharges > 0 && state.time > 25 && state.time - scanUsedAt > 20) {
      // Place the pulse over the shipping channel where mines cluster.
      cmds.push({ type: 'ability', ability: 'scan', x: 1150, y: WORLD.lanes[1] });
      scanUsedAt = state.time;
    }
    // Recovery: a defending bot sends its last escort to hold on the newest
    // survivor area (crews first — they cost confidence) or wreckage field.
    // This is the roguelite loop's escort-diversion tradeoff, exercised
    // end-to-end by the same harness that drives the seesaw tests.
    if (opts.defend && state.time - rescueOrderAt > 2) {
      const escort = state.escorts.filter((e) => e.alive).at(-1);
      const target =
        state.survivors.find((a) => !a.rescued && !a.lost) ??
        state.wreckage.find((f) => !f.recovered && !f.expired);
      if (escort && target) {
        cmds.push({ type: 'moveEscort', escortId: escort.id, x: target.x, y: target.y, hold: true });
        rescueOrderAt = state.time;
      }
    }
    stepTransit(state, cmds, rng);
  }
  const report = resolveTransit(c, state);
  return { state, report };
}

/** Minimal sensible procurement between rounds: keep enough firepower up and
 *  the fleet replenished. Replacing lost hulls is not optional under the
 *  roguelite rules — a shrinking convoy walks into the quota failure
 *  condition all by itself. */
function botProcure(c: CampaignState): void {
  repairFleet(c);
  buyBase(c); // more shore batteries = higher sustained fire rate
  buyEscort(c);
  const fleetTotal = (): number => c.fleet.cargo + c.fleet.tanker + c.fleet.freighter;
  while (fleetTotal() < CAMPAIGN.startCapacity && buyShip(c, 'cargo')) {
    /* replace losses */
  }
  setComposition(c, 'cargo', c.fleet.cargo);
  setComposition(c, 'tanker', c.fleet.tanker);
  setComposition(c, 'freighter', c.fleet.freighter);
  while (c.ammo < 22 && buyAmmo(c, 1)) {
    /* top up */
  }
  if (!c.scanUnlocked) unlockScan(c);
}

// ---------------------------------------------------------------------------
// RNG
// ---------------------------------------------------------------------------

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = makeRng('seed-x');
    const b = makeRng('seed-x');
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('produces different streams for forks', () => {
    const base = makeRng('seed-x');
    const f1 = base.fork('a');
    const f2 = base.fork('b');
    expect(f1.next()).not.toBe(f2.next());
  });

  it('stays in [0,1) and covers the range', () => {
    const rng = makeRng(42);
    let min = 1;
    let max = 0;
    for (let i = 0; i < 10_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(min).toBeLessThan(0.01);
    expect(max).toBeGreaterThan(0.99);
  });
});

// ---------------------------------------------------------------------------
// Transit
// ---------------------------------------------------------------------------

describe('transit', () => {
  it('is deterministic: identical seeds produce identical rounds', () => {
    const results: string[] = [];
    for (let i = 0; i < 2; i++) {
      const c = newCampaign('determinism');
      const { state } = runRound(c, { defend: true });
      results.push(JSON.stringify({ stats: state.stats, events: state.events.length, cash: c.cash }));
    }
    expect(results[0]).toBe(results[1]);
  });

  it('round 1 is a winnable onboarding for a defending player', () => {
    const c = newCampaign('friendly-start');
    const { state } = runRound(c, { defend: true });
    expect(state.stats.launched).toBe(20);
    // A single shore battery vs a light unguided probe should still deliver
    // the large majority of the convoy.
    expect(state.stats.delivered).toBeGreaterThanOrEqual(16);
  });

  it('terminates even with no player input', () => {
    const c = newCampaign('afk');
    const { state } = runRound(c, { defend: false });
    expect(state.over).toBe(true);
    // every ship is accounted for
    for (const ship of state.ships) {
      expect(ship.delivered || !ship.alive).toBe(true);
    }
    expect(state.stats.delivered + state.stats.lost).toBe(state.stats.launched);
  });

  it('defending measurably beats not defending across early rounds', () => {
    // Early rounds are deliberately gentle (few, slow, unguided missiles),
    // so any single seed can land on zero losses either way — average over
    // several seeds instead of trusting one draw.
    const play = (defend: boolean): number => {
      let lost = 0;
      for (let seed = 0; seed < 12; seed++) {
        const c = newCampaign(`ab-test-${seed}`);
        for (let r = 0; r < 4; r++) {
          const { state } = runRound(c, { defend });
          lost += state.stats.lost;
          botProcure(c);
        }
      }
      return lost;
    };
    expect(play(true)).toBeLessThan(play(false));
  });
});

// ---------------------------------------------------------------------------
// Enemy evolution
// ---------------------------------------------------------------------------

function syntheticMetrics(round: number, overrides: Partial<RoundMetrics> = {}): RoundMetrics {
  return {
    round,
    interceptRate: 0.8,
    formation: 'tight',
    mineDetectRate: -1,
    torpedoDetectRate: -1,
    valueSent: 241,
    deliveredFraction: 0.95,
    ...overrides,
  };
}

describe('enemy evolution', () => {
  it('round 1 is a small unguided probe with no mines', () => {
    const c = newCampaign('r1');
    const plan = planCurrentRound(c);
    expect(plan.spawns.length).toBe(6);
    expect(plan.spawns.every((s) => s.kind === 'missile')).toBe(true);
    expect(plan.mines.length).toBe(0);
  });

  it('guided missiles debut by round 2 with a fairness cap', () => {
    const c = newCampaign('beats');
    const rng = makeRng('evo');
    evolveEnemy(c.evolution, syntheticMetrics(1), rng);
    c.round = 2;
    const plan = planRound(c, makeRng('plan2'));
    const guided = plan.spawns.filter((s) => s.kind === 'guidedMissile');
    expect(guided.length).toBeGreaterThanOrEqual(1);
    expect(guided.length).toBeLessThanOrEqual(3); // firstGuidedCap
    expect(plan.debuts).toContain('guidedMissile');
  });

  it('mines debut by round 3, small first field in the main channel', () => {
    const c = newCampaign('beats2');
    const rng = makeRng('evo2');
    for (let r = 1; r <= 2; r++) evolveEnemy(c.evolution, syntheticMetrics(r), rng);
    c.round = 3;
    const plan = planRound(c, makeRng('plan3'));
    expect(plan.mines.length).toBeGreaterThanOrEqual(1);
    expect(plan.mines.length).toBeLessThanOrEqual(4);
    expect(plan.debuts).toContain('mine');
    // First field targets the default (center) lane so the beat lands.
    for (const mine of plan.mines) {
      expect(Math.abs(mine.y - 520)).toBeLessThanOrEqual(75);
    }
  });

  it('strong mine detection pushes the enemy toward low-signature mines', () => {
    // Same seed on both arms, varying only the detection rate. Comparing two
    // different seeds lets exploration jitter move the shares more than the
    // signal does — see docs/SEESAW.md; the escalation tests in
    // enemyEconomy.test.ts were passing on that noise for weeks. The horizon
    // has to be long enough for the mine branch to buy meaningfully, which gets
    // longer with every enemy branch that ships and splits the budget.
    const run = (mineDetectRate: number): number => {
      const evo = newEvolution();
      const rng = makeRng('lowsig');
      for (let r = 1; r <= 18; r++) evolveEnemy(evo, syntheticMetrics(r, { mineDetectRate }), rng);
      return evo.tracks.lowSig;
    };
    expect(run(0.9)).toBeGreaterThan(run(0.1));
  });

  it('surfaces a formation tell: tight invites mines, wide invites salvos', () => {
    const evoTight = newEvolution();
    const rng1 = makeRng('tell-tight');
    for (let r = 1; r <= 3; r++) evolveEnemy(evoTight, syntheticMetrics(r, { formation: 'tight' }), rng1);
    expect(evoTight.formationTell).toBeTruthy();
    expect(evoTight.formationTell!.toLowerCase()).toContain('mine');

    const evoWide = newEvolution();
    const rng2 = makeRng('tell-wide');
    for (let r = 1; r <= 3; r++) evolveEnemy(evoWide, syntheticMetrics(r, { formation: 'wide' }), rng2);
    expect(evoWide.formationTell).toBeTruthy();
    expect(evoWide.formationTell!.toLowerCase()).toMatch(/salvo|volume/);
  });

  it('emits an intelligence warning about a capability before it is seen', () => {
    const evo = newEvolution();
    const rng = makeRng('warn');
    // After round 1 the guidance track reaches its unlock threshold, so a
    // warning about guided missiles is pending before they are ever fielded.
    evolveEnemy(evo, syntheticMetrics(1), rng);
    expect(evo.pendingWarnings.some((w) => w.track === 'guidance')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Campaign economy & progression
// ---------------------------------------------------------------------------

describe('campaign', () => {
  it('awards cash after a round', () => {
    const c = newCampaign('economy');
    const startCash = c.cash;
    const { report } = runRound(c, { defend: true });
    expect(report.cashEarned).toBeGreaterThan(0);
    expect(c.cash).toBe(startCash + report.cashEarned);
  });

  it('capacity grows after two consecutive strong rounds', () => {
    // This pins the GROWTH RULE, so it runs the rounds against an empty enemy
    // plan rather than trying to out-defend a live one. Stacking bases and
    // ammunition used to be enough to guarantee strong deliveries, but the
    // enemy now reallocates toward whatever the player has not answered, so
    // "heavy defense" is not a fixed quantity any more and the scenario drifted
    // out from under the rule it was meant to check. Combat is covered by the
    // campaign-survival tests; this one is about the consortium's response to
    // two good rounds.
    const c = newCampaign('growth');
    setComposition(c, 'cargo', 6);
    setComposition(c, 'tanker', 0);
    setComposition(c, 'freighter', 0);
    const startCapacity = c.capacity;
    let increased = false;
    for (let r = 0; r < CAMPAIGN.strongRoundsForGrowth && !increased; r++) {
      const plan: RoundPlan = { ...planCurrentRound(c), spawns: [], mines: [], debuts: [] };
      const { state, rng } = createRoundTransit(c, plan);
      let guard = 0;
      while (!state.over && guard++ < Math.ceil(SIM.maxTransitTime / SIM.dt)) {
        stepTransit(state, [], rng);
      }
      const report = resolveTransit(c, state);
      expect(state.stats.delivered).toBe(state.stats.launched); // unopposed
      increased = report.capacityIncreased;
    }
    expect(increased).toBe(true);
    expect(c.capacity).toBe(startCapacity + CAMPAIGN.capacityStep);
  });

  it('every surviving round earns a mandatory technology draft', () => {
    const c = newCampaign('draft-pipeline');
    expect(c.pendingDraft).toBeNull();
    const { report } = runRound(c, { defend: true });
    expect(c.campaignOver).toBe(false);
    expect(c.pendingDraft).not.toBeNull();
    expect(report.draftSize).toBe(c.pendingDraft!.options.length);
    expect(c.pendingDraft!.options.length).toBeGreaterThanOrEqual(2);
    // Taking an option activates it immediately for the active run.
    const pick = c.pendingDraft!.options[0];
    expect(selectDraftOption(c, pick)).toBe(true);
    expect(c.completedResearch).toContain(pick);
    expect(c.pendingDraft).toBeNull();
    expect(c.draftHistory).toHaveLength(1);
    expect(c.draftHistory[0].picked).toBe(pick);
  });

  it('an undefended campaign eventually collapses', () => {
    const c = newCampaign('collapse');
    for (let r = 0; r < 15 && !c.campaignOver; r++) {
      runRound(c, { defend: false });
    }
    expect(c.campaignOver).toBe(true);
  });

  it('a defended campaign survives well past the early rounds', () => {
    const c = newCampaign('survival');
    for (let r = 0; r < 6; r++) {
      expect(c.campaignOver).toBe(false);
      runRound(c, { defend: true, useScan: true });
      botProcure(c);
    }
    expect(c.confidence).toBeGreaterThan(0);
    expect(c.round).toBe(7);
    expect(c.history).toHaveLength(6);
  });

  it('losses persist in the fleet and composition is clamped', () => {
    const c = newCampaign('attrition');
    for (let r = 0; r < 5; r++) {
      runRound(c, { defend: false });
    }
    const owned = c.fleet.cargo + c.fleet.tanker + c.fleet.freighter;
    const assigned = c.composition.cargo + c.composition.tanker + c.composition.freighter;
    expect(owned).toBeLessThan(20);
    expect(assigned).toBeLessThanOrEqual(owned);
  });
});

// ---------------------------------------------------------------------------
// Regression tests for review findings
// ---------------------------------------------------------------------------

describe('economy hardening', () => {
  it('rejects non-positive or fractional ammo purchases', () => {
    const c = newCampaign('ammo-guard');
    const cash = c.cash;
    const ammo = c.ammo;
    expect(buyAmmo(c, 0)).toBe(false);
    expect(buyAmmo(c, -10)).toBe(false);
    expect(buyAmmo(c, 2.5)).toBe(false);
    expect(c.cash).toBe(cash);
    expect(c.ammo).toBe(ammo);
    expect(buyAmmo(c, 3)).toBe(true);
    expect(c.ammo).toBe(ammo + 3);
  });

  it('module price is based on owned hulls, immune to composition toggling', () => {
    const c = newCampaign('module-exploit');
    const fullPrice = moduleCost(c, 'cargo', 'selfDefense');
    setComposition(c, 'cargo', 0);
    expect(moduleCost(c, 'cargo', 'selfDefense')).toBe(fullPrice);
    setComposition(c, 'cargo', 15);
    // Below the soft cap this is still a flat per-ship rate; above it, the
    // marginal hull is billed at the taper rate (see moduleCost).
    const cap = ECONOMY.moduleCostSoftCap;
    const billable = 15 <= cap ? 15 : cap + (15 - cap) * ECONOMY.moduleCostTaperRate;
    expect(fullPrice).toBe(Math.round(110 * billable));
  });

  it('module refit cost soft-caps so a large fleet stays affordable', () => {
    const c = newCampaign('module-softcap');
    c.fleet.cargo = 40; // a big late-campaign fleet
    const cost40 = moduleCost(c, 'cargo', 'selfDefense');
    // Linear pricing would be 110 * 40 = 4400; the soft cap must price it well
    // under that so upgrades stay reachable at scale.
    expect(cost40).toBeLessThan(110 * 40 * 0.7);
    // Still strictly more expensive than a small fleet (more hulls to refit).
    c.fleet.cargo = 10;
    const cost10 = moduleCost(c, 'cargo', 'selfDefense');
    expect(cost10).toBe(110 * 10); // at/under the cap: unchanged flat rate
    expect(cost40).toBeGreaterThan(cost10);
  });

  it('a new hull costs its base price plus its class module fit', () => {
    const c = newCampaign('hull-surcharge');
    c.cash = 100_000;
    c.completedResearch = ['selfDefense.base']; // purchases are research-gated
    const base = SHIP_CLASSES.freighter.replaceCost;
    expect(shipCost(c, 'freighter')).toBe(base);
    // Fit a module on the freighter class (1 slot).
    expect(buyModule(c, 'freighter', 'selfDefense')).toBe(true);
    expect(shipCost(c, 'freighter')).toBe(base + MODULES.selfDefense.costPerShip);
    const before = c.cash;
    expect(buyShip(c, 'freighter')).toBe(true);
    expect(c.cash).toBe(before - (base + MODULES.selfDefense.costPerShip));
  });

  it('unequipping a module refunds exactly what was paid and frees the slot', () => {
    const c = newCampaign('module-refund');
    c.cash = 5000;
    const cash0 = c.cash;
    const price = moduleCost(c, 'cargo', 'reinforcedHull');
    expect(buyModule(c, 'cargo', 'reinforcedHull')).toBe(true);
    expect(c.cash).toBe(cash0 - price);
    expect(c.classModules.cargo).toContain('reinforcedHull');
    expect(removeModule(c, 'cargo', 'reinforcedHull')).toBe(true);
    expect(c.cash).toBe(cash0); // fully refunded
    expect(c.classModules.cargo).not.toContain('reinforcedHull');
    // Removing something not fitted is a no-op.
    expect(removeModule(c, 'cargo', 'reinforcedHull')).toBe(false);
  });

  it('point-defense rounds are purchasable and carry over', () => {
    const c = newCampaign('pd-ammo-buy');
    c.cash = 1000;
    const pd0 = c.pdAmmo;
    expect(buyPdAmmo(c)).toBe(true);
    expect(c.pdAmmo).toBe(pd0 + ECONOMY.pdAmmoPerBuy);
  });

  it('unrepaired damage beyond the per-convoy cap is conserved, not erased', () => {
    const c = newCampaign('damage-pool');
    c.pendingDamage = 900;
    // Sail a single freighter (70 hp -> absorbs at most 28 damage).
    setComposition(c, 'cargo', 0);
    setComposition(c, 'tanker', 0);
    setComposition(c, 'freighter', 1);
    runRound(c, { defend: true });
    // 900 - 28 = 872 must still be owed (plus any new damage taken).
    expect(c.pendingDamage).toBeGreaterThanOrEqual(872);
  });
});

// ---------------------------------------------------------------------------
// Anti-snowball — the restoring force SEESAW.md promises at BOTH ends
// ---------------------------------------------------------------------------

describe('anti-snowball: the losing side', () => {
  it('round income is cargo delivered and NOTHING else', () => {
    // The economy's transparency rule. There is no rebate, no underwriting and
    // no hidden term: a player can multiply what arrived by the delivery rate
    // and get the number on the report. Checked on a round with real losses,
    // because the retired mechanic paid out precisely there.
    const c = newDevCampaign('income-transparent', { round: 9, god: false, unlockAll: false });
    setComposition(c, 'cargo', 8);
    const { state, report } = runRound(c, { defend: false });
    expect(state.ships.some((s) => !s.alive)).toBe(true); // hulls were lost
    expect(report.cashEarned).toBe(state.stats.valueDelivered * ECONOMY.cashPerValue);
  });

  it('a delivered hull earns about what replacing her costs', () => {
    // This is the restoring force now, and it is one the player can check:
    // set delivery income against replacement price and the fleet breaks even
    // around a 50% loss rate, so losing half a convoy is a bad round rather
    // than the start of an unrecoverable spiral.
    for (const classId of ['cargo', 'tanker', 'freighter'] as ShipClassId[]) {
      const def = SHIP_CLASSES[classId];
      const earns = def.value * ECONOMY.cashPerValue;
      const breakEven = earns / def.replaceCost;
      expect(breakEven, `${classId} break-even loss rate`).toBeGreaterThan(0.45);
      expect(breakEven, `${classId} break-even loss rate`).toBeLessThanOrEqual(1);
    }
  });

  it('a fleet that loses badly can still afford to rebuild', () => {
    // The property the retired underwriting existed to guarantee, asserted
    // end-to-end instead of through a payout: sail undefended, lose hulls, and
    // the round's earnings still cover replacing a meaningful share of them.
    const c = newDevCampaign('rebuild-after-losses', { round: 9, god: false, unlockAll: false });
    setComposition(c, 'cargo', 10);
    const { state, report } = runRound(c, { defend: false });
    const lost = state.ships.filter((s) => !s.alive).length;
    expect(lost).toBeGreaterThan(0);
    const replacements = Math.floor(report.cashEarned / shipCost(c, 'cargo'));
    // Deliveries in a losing round still fund a real fraction of the rebuild.
    expect(replacements).toBeGreaterThanOrEqual(Math.floor((state.stats.delivered * 0.9)));
  });

  it('losing a hull is never profitable — there is no payout at all', () => {
    const c = newCampaign('no-payout');
    const plan = { ...planCurrentRound(c), spawns: [], mines: [], debuts: [] };
    const { state, rng } = createRoundTransit(c, plan);
    let guard = 0;
    while (!state.over && guard++ < Math.ceil(SIM.maxTransitTime / SIM.dt) + 10) {
      stepTransit(state, [], rng);
    }
    // Scuttle one hull's worth of cargo before resolving: strictly less income.
    const delivered = state.stats.valueDelivered;
    state.stats.valueDelivered = delivered - SHIP_CLASSES.cargo.value;
    const report = resolveTransit(c, state);
    expect(report.cashEarned).toBe((delivered - SHIP_CLASSES.cargo.value) * ECONOMY.cashPerValue);
    expect(report.cashEarned).toBeLessThan(delivered * ECONOMY.cashPerValue);
  });

  it('floors ordinary confidence loss so a disaster round is a slope, not a cliff', () => {
    // Bad round + full loss cap + several crews lost in the water all describe
    // the same disaster and all land together. Unfloored, that stack can take
    // most of a starting confidence bar in one round — the floor keeps it the
    // worst thing in the game while leaving rounds to recover in. (A missed
    // quota no longer costs confidence at all: it ends the run outright.)
    const unflooredWorstCase =
      CAMPAIGN.confidenceBadRound + CAMPAIGN.confidenceLossCap + CAMPAIGN.confidencePerCrewLost * 3;
    expect(unflooredWorstCase).toBeLessThan(CAMPAIGN.confidenceRoundFloor);
    // The floor has to leave more than two rounds of headroom from the start.
    expect(CAMPAIGN.startConfidence / Math.abs(CAMPAIGN.confidenceRoundFloor)).toBeGreaterThan(2);
  });

  it('the floor does NOT cover captures — absorbing losses is no answer to boarding', () => {
    const c = newCampaign('capture-floor');
    c.confidence = 90;
    const before = c.confidence;
    const { state } = runRound(c, { defend: false });
    // Force the worst ordinary round AND a capture, then confirm the capture
    // pushed the total past the ordinary floor.
    state.stats.shipsCaptured = 3;
    state.stats.lost = 10;
    state.stats.delivered = 0;
    state.stats.launched = 10;
    const c2 = newCampaign('capture-floor');
    c2.confidence = 90;
    resolveTransit(c2, state);
    const drop = before - c2.confidence;
    expect(drop).toBeGreaterThan(Math.abs(CAMPAIGN.confidenceRoundFloor));
  });
});

describe('anti-snowball: the winning side', () => {
  it('a player who keeps dominating faces a budget that keeps climbing', () => {
    // The flat bonus fires readily but never moved a build sitting at 94%
    // delivery. Sustained dominance has to compound or it is not a restoring
    // force at all — measured, 56% of rounds finished above 90% delivered.
    const budgetAfter = (dominantRounds: number): number => {
      const evo = newEvolution();
      const rng = makeRng('dominance');
      for (let r = 1; r <= dominantRounds; r++) {
        evolveEnemy(evo, syntheticMetrics(r, { deliveredFraction: 0.95 }), rng);
      }
      return evo.economy.budget;
    };
    // Per-round growth is in the curve, so compare the RATIO to a matched
    // run where the player is merely holding even rather than dominating.
    const heldEven = (rounds: number): number => {
      const evo = newEvolution();
      const rng = makeRng('dominance');
      for (let r = 1; r <= rounds; r++) {
        evolveEnemy(evo, syntheticMetrics(r, { deliveredFraction: 0.7 }), rng);
      }
      return evo.economy.budget;
    };
    const short = budgetAfter(2) / heldEven(2);
    const long = budgetAfter(7) / heldEven(7);
    expect(long).toBeGreaterThan(short);
  });

  it('the pressure releases the round the player drops back into the band', () => {
    // It scales with how LONG they have dominated, so a broken streak resets
    // it — otherwise it is a difficulty ramp, not a restoring force.
    //
    // Both arms end on an identical DOMINANT round, so the flat
    // bonusStrongDelivery is paid in both and cancels out. The only thing that
    // differs is how long the streak behind that round ran. Without holding the
    // last round equal this passes on the flat bonus alone and says nothing
    // about the streak at all — which an earlier version of it did.
    const budgetAfter = (deliveries: number[]): number => {
      const evo = newEvolution();
      const rng = makeRng('release');
      deliveries.forEach((d, i) => {
        evolveEnemy(evo, syntheticMetrics(i + 1, { deliveredFraction: d }), rng);
      });
      return evo.economy.budget;
    };
    const D = 0.95; // dominant
    const B = 0.7; // back inside the healthy band
    const unbroken = budgetAfter([D, D, D, D, D, D, D]);
    const broken = budgetAfter([D, D, D, D, D, B, D]);
    expect(broken).toBeLessThan(unbroken);
  });

  it('is capped, so dominance never runs away into an unplayable round', () => {
    expect(ENEMY_ECONOMY.dominanceStreakMax).toBeLessThan(1);
    expect(ENEMY_ECONOMY.dominanceStreakStep).toBeLessThan(ENEMY_ECONOMY.dominanceStreakMax);
  });
});

describe('a bigger convoy is a bigger target', () => {
  const budgetFor = (valueSent: number): number => {
    const evo = newEvolution();
    const rng = makeRng('convoy-scale');
    for (let r = 1; r <= 5; r++) {
      evolveEnemy(evo, syntheticMetrics(r, { valueSent, deliveredFraction: 0.8 }), rng);
    }
    return evo.economy.budget;
  };

  it('draws more enemy ordnance the more value sails', () => {
    // Without this the enemy fires a budget-determined volume whatever sails,
    // so growing the convoy DILUTES incoming fire and hull count becomes the
    // best defensive stat in the game — while also being the scoring stat.
    // Measured before the fix: 6 hulls took 4.13 missiles each, 40 took 0.85.
    expect(budgetFor(500)).toBeGreaterThan(budgetFor(120));
  });

  it('scales against a FIXED reference, not the campaign\'s own first convoy', () => {
    // Measuring against the player's opening convoy is self-cancelling: a build
    // that starts big and stays big reads as 1.0 forever and never draws the
    // extra ordnance — which is precisely the build this exists to price.
    // A campaign whose every round sails a big convoy must still be scaled up.
    const evo = newEvolution();
    const rng = makeRng('fixed-ref');
    for (let r = 1; r <= 5; r++) {
      evolveEnemy(evo, syntheticMetrics(r, { valueSent: 600, deliveredFraction: 0.8 }), rng);
    }
    const alwaysBig = evo.economy.budget;
    expect(alwaysBig).toBeGreaterThan(budgetFor(ENEMY_ECONOMY.convoyValueBaseline));
  });

  it('is clamped at both ends — sailing light is a smaller target, never a free pass', () => {
    expect(ENEMY_ECONOMY.convoyScaleMin).toBeLessThan(0);
    expect(ENEMY_ECONOMY.convoyScaleMin).toBeGreaterThan(-1);
    expect(ENEMY_ECONOMY.convoyScaleMax).toBeGreaterThan(0);
    // A one-hull convoy must still meet an enemy.
    expect(budgetFor(10)).toBeGreaterThan(0);
  });
});

describe('transit hardening', () => {
  it('a second ECM command while a burst is active does not burn a charge', () => {
    const c = newCampaign('ecm-stack');
    c.ecmUnlocked = true;
    const plan = planCurrentRound(c);
    const { state, rng } = createRoundTransit(c, plan);
    stepTransit(state, [{ type: 'ability', ability: 'ecm', x: 900, y: WORLD.lanes[1] }], rng);
    expect(state.ecmCharges).toBe(1);
    stepTransit(state, [{ type: 'ability', ability: 'ecm', x: 900, y: WORLD.lanes[1] }], rng);
    expect(state.ecmCharges).toBe(1); // still active -> rejected
  });

  it('a crippled ship falls behind its own pace and is flagged straggling', () => {
    const c = newCampaign('cripple-straggle');
    const plan = planCurrentRound(c);
    const { state, rng } = createRoundTransit(c, plan);
    for (let i = 0; i < 30 * 3; i++) stepTransit(state, [], rng);
    const victim = state.ships.find((s) => s.spawned && s.alive && !s.delivered);
    expect(victim).toBeDefined();
    victim!.hp = victim!.maxHp * 0.3; // below crippleHpFraction
    let flagged = false;
    for (let i = 0; i < 30 * 20 && victim!.alive && !victim!.delivered; i++) {
      stepTransit(state, [], rng);
      if (victim!.straggling) {
        flagged = true;
        break;
      }
    }
    expect(flagged).toBe(true);
  });

  it('a met quota resolves immediately and rolls into a larger one', () => {
    const c = newCampaign('quota-early');
    // A meetable target within a single strong round.
    c.quota = { roundsLeft: 3, pointsNeeded: 50, pointsEarned: 0 };
    const before = c.quota.pointsNeeded;
    const { report } = runRound(c, { defend: true });
    expect(report.quota.evaluated).toBe(true);
    expect(report.quota.met).toBe(true);
    // Did not wait out the window: it was cleared on round 1 of the window.
    expect(report.quota.windowRound).toBe(1);
    // A fresh, larger quota is now active.
    expect(c.quota.pointsEarned).toBe(0);
    expect(c.quota.roundsLeft).toBe(3);
    expect(c.quota.pointsNeeded).toBeGreaterThan(before);
  });

  it('an unmet quota still resolves when its rounds run out', () => {
    const c = newCampaign('quota-expire');
    // A target too large to clear in three light rounds.
    c.quota = { roundsLeft: 3, pointsNeeded: 100_000, pointsEarned: 0 };
    let lastReport;
    for (let r = 0; r < 3; r++) {
      lastReport = runRound(c, { defend: true }).report;
    }
    expect(lastReport!.quota.evaluated).toBe(true);
    expect(lastReport!.quota.met).toBe(false);
    expect(lastReport!.quota.windowRound).toBe(3);
  });

  it('quota difficulty ratchets up on an easy clear, and the next target is sized off the CONVOY', () => {
    const c = newCampaign('quota-ratchet-up');
    const before = c.quotaDifficulty;
    // Trivially easy target: cleared on round 1 with a big surplus.
    c.quota = { roundsLeft: 3, pointsNeeded: 10, pointsEarned: 0 };
    runRound(c, { defend: true });
    expect(c.quotaDifficulty).toBeGreaterThan(before);
    // The target asks for a share of what the convoy CAN carry, not a multiple
    // of what the last window happened to deliver. Pinning the formula is what
    // makes this a real test: "a smaller convoy is asked for less" sounds like
    // the property worth asserting and is NOT — under the old delivery-based
    // rule a smaller convoy also delivered less, so both implementations
    // satisfy it and the assertion catches nothing. Checked by mutation.
    //
    // The regression it guards: sizing off delivery meant any purchase that
    // traded convoy size for convoy quality missed a quota set by the larger
    // convoy it used to sail, and the target only adapted downward AFTER that
    // miss had cost 18 confidence. Measured across three builds the miss rate
    // tracked convoy size almost exactly — 28% sailing 29.4 hulls of 30.4
    // capacity, 39% at 24.6, 60% at 19.7 — so equipping the convoy was
    // structurally unaffordable however cheap the equipment was.
    const convoyValue = (Object.keys(c.composition) as ShipClassId[]).reduce(
      (sum, id) => sum + c.composition[id] * SHIP_CLASSES[id].value,
      0,
    );
    const expected = convoyValue * 3 * CAMPAIGN.quotaDeliveryFraction * c.quotaDifficulty;
    const floor = c.capacity * CAMPAIGN.quotaFloorPerCapacity;
    expect(c.quota.pointsNeeded).toBe(Math.max(Math.round(expected), Math.round(floor)));
  });

  it('the floor stops a player shrinking the convoy to trivialise the quota', () => {
    const c = newCampaign('quota-floor-guard');
    c.quota = { roundsLeft: 3, pointsNeeded: 10, pointsEarned: 0 };
    setComposition(c, 'tanker', 0);
    setComposition(c, 'freighter', 0);
    setComposition(c, 'cargo', 1); // sail almost nothing
    runRound(c, { defend: true });
    // Capacity is untouched by the convoy shrinking, so the floor still bites.
    expect(c.quota.pointsNeeded).toBe(Math.round(c.capacity * CAMPAIGN.quotaFloorPerCapacity));
  });

  it('a missed quota ENDS the regional run (the second failure system)', () => {
    const c = newCampaign('quota-run-ends');
    // Impossible target: guaranteed miss when the window's rounds run out.
    c.quota = { roundsLeft: 3, pointsNeeded: 1_000_000, pointsEarned: 0 };
    let rounds = 0;
    while (!c.campaignOver && rounds++ < 3) runRound(c, { defend: true });
    expect(rounds).toBe(3); // mid-window rounds do not end anything
    expect(c.campaignOver).toBe(true);
    expect(c.runOutcome).toBe('defeat');
    expect(c.defeatCause).toBe('quota');
    // No draft for a dead run — there is no next round to equip for.
    expect(c.pendingDraft).toBeNull();
  });

  it('repeated easy clears keep raising the bar (difficulty climbs, capped)', () => {
    const c = newCampaign('quota-climb');
    c.bases = 4;
    c.ammo = 200;
    let prevDifficulty = c.quotaDifficulty;
    let roseAtLeastOnce = false;
    for (let i = 0; i < 6; i++) {
      runRound(c, { defend: true });
      botProcure(c);
      if (c.quotaDifficulty > prevDifficulty) roseAtLeastOnce = true;
      expect(c.quotaDifficulty).toBeLessThanOrEqual(1.6); // quotaDifficultyMax
      prevDifficulty = c.quotaDifficulty;
    }
    expect(roseAtLeastOnce).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Convoy spawning & spacing
// ---------------------------------------------------------------------------

function stretchCapacity(c: CampaignState, cargo: number, tanker: number, freighter: number): void {
  c.capacity = cargo + tanker + freighter;
  c.fleet = { cargo, tanker, freighter };
  setComposition(c, 'cargo', cargo);
  setComposition(c, 'tanker', tanker);
  setComposition(c, 'freighter', freighter);
}

describe('convoy spawning', () => {
  it('the spawn pattern visibly reflects the chosen formation', () => {
    const build = (formation: 'tight' | 'wide' | 'sprint') => {
      const c = newCampaign(`spawn-${formation}`);
      c.formation = formation;
      return createRoundTransit(c, planCurrentRound(c)).state.ships;
    };

    // Sprint: single-file volleys — ships enter one lane at a time in a
    // volley, then relocate to a different lane for the next volley. So no
    // single lane holds ALL the ships, but each volley is single-file.
    const sprint = build('sprint');
    expect(new Set(sprint.map((s) => s.laneIndex)).size).toBeGreaterThan(1);

    // Tight: grouped waves — some ships enter together (within a wave) across
    // different lanes.
    const tight = build('tight');
    let sawWave = false;
    for (let i = 0; i < tight.length && !sawWave; i++) {
      for (let j = i + 1; j < tight.length; j++) {
        if (
          Math.abs(tight[i].spawnTime - tight[j].spawnTime) < 0.4 &&
          tight[i].laneIndex !== tight[j].laneIndex
        ) {
          sawWave = true;
          break;
        }
      }
    }
    expect(sawWave).toBe(true);
    expect(new Set(tight.map((s) => s.laneIndex)).size).toBeGreaterThan(1);

    // Wide: staggered — spread across all lanes, one at a time (well-separated
    // entry times, never a simultaneous wave).
    const wide = build('wide');
    expect(new Set(wide.map((s) => s.laneIndex)).size).toBe(WORLD.lanes.length);
    const times = wide.map((s) => s.spawnTime).sort((a, b) => a - b);
    let minGap = Infinity;
    for (let i = 1; i < times.length; i++) minGap = Math.min(minGap, times[i] - times[i - 1]);
    expect(minGap).toBeGreaterThan(1);
  });

  it('sprint sends 3-6 ship volleys single-file, then relocates to a different lane', () => {
    const c = newCampaign('sprint-volleys');
    c.formation = 'sprint';
    const { state } = createRoundTransit(c, planCurrentRound(c));
    const byTime = [...state.ships].sort((a, b) => a.spawnTime - b.spawnTime);

    // Group into volleys: consecutive (by spawn order) ships sharing a lane.
    const volleys: { lane: number; size: number; times: number[] }[] = [];
    for (const ship of byTime) {
      const last = volleys[volleys.length - 1];
      if (last && last.lane === ship.laneIndex) {
        last.size++;
        last.times.push(ship.spawnTime);
      } else {
        volleys.push({ lane: ship.laneIndex, size: 1, times: [ship.spawnTime] });
      }
    }

    expect(volleys.length).toBeGreaterThan(1); // more than one volley for a 20-ship convoy
    // Every volley (but possibly the last, which may be a partial remainder)
    // falls in the 3-6 range.
    for (let i = 0; i < volleys.length - 1; i++) {
      expect(volleys[i].size).toBeGreaterThanOrEqual(3);
      expect(volleys[i].size).toBeLessThanOrEqual(6);
    }
    // Consecutive volleys never reuse the same lane.
    for (let i = 1; i < volleys.length; i++) {
      expect(volleys[i].lane).not.toBe(volleys[i - 1].lane);
    }
    // Within a volley, spacing is tight (~sprintInterval, allow jitter); the
    // gap between a volley's last ship and the next volley's first ship is
    // the longer sprintVolleyGap.
    const withinVolleyMax = SPAWN.sprintInterval + 2 * SPAWN.timeJitter;
    const betweenVolleyMin = SPAWN.sprintVolleyGap - 2 * SPAWN.timeJitter;
    for (const v of volleys) {
      const sorted = [...v.times].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i] - sorted[i - 1]).toBeLessThan(withinVolleyMax);
      }
    }
    for (let i = 1; i < volleys.length; i++) {
      const prevLast = Math.max(...volleys[i - 1].times);
      const nextFirst = Math.min(...volleys[i].times);
      expect(nextFirst - prevLast).toBeGreaterThanOrEqual(betweenVolleyMin);
      // And clearly bigger than the in-volley cadence, so the pause reads.
      expect(nextFirst - prevLast).toBeGreaterThan(withinVolleyMax);
    }
  });

  it('ships enter individually with staggered timing that scales with convoy size', () => {
    const small = newCampaign('spawn-scale-small'); // default 20-ship convoy
    const big = newCampaign('spawn-scale-big');
    stretchCapacity(big, 40, 3, 2); // max-capacity-sized convoy

    const { state: stateSmall } = createRoundTransit(small, planCurrentRound(small));
    const { state: stateBig } = createRoundTransit(big, planCurrentRound(big));

    const timesSmall = stateSmall.ships.map((s) => s.spawnTime).sort((a, b) => a - b);
    const timesBig = stateBig.ships.map((s) => s.spawnTime).sort((a, b) => a - b);

    // Individually staggered, not a single instantaneous block.
    expect(new Set(timesSmall).size).toBeGreaterThan(1);
    expect(timesSmall[timesSmall.length - 1] - timesSmall[0]).toBeGreaterThan(5);

    // Scales without special-casing: a larger convoy takes longer to fully arrive.
    expect(timesBig[timesBig.length - 1]).toBeGreaterThan(timesSmall[timesSmall.length - 1]);
  });

  it('never lets two ships overlap, at max convoy size in the tightest formation', () => {
    const c = newCampaign('no-overlap-stress');
    c.formation = 'tight';
    stretchCapacity(c, 40, 3, 2); // the densest, largest case the game allows

    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    let pairsChecked = 0;
    let tick = 0;
    while (!state.over) {
      stepTransit(state, [], rng);
      tick++;
      // Ships move a fraction of a world unit per 1/30s tick at these speeds,
      // so sampling every 4th tick (~0.13s resolution) still can't miss a
      // real violation while cutting this stress test's runtime ~4x.
      if (tick % 4 !== 0) continue;
      const active = state.ships.filter((s) => s.spawned && s.alive && !s.delivered);
      for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
          const a = active[i];
          const b = active[j];
          const minHull = SHIP_CLASSES[a.classId].radius + SHIP_CLASSES[b.classId].radius;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          expect(d).toBeGreaterThanOrEqual(minHull - 0.01);
          pairsChecked++;
        }
      }
    }
    expect(pairsChecked).toBeGreaterThan(0);
  });

  it('a faster ship overtakes a slower one in the same lane instead of stalling', () => {
    const c = newCampaign('overtake');
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    // Isolate two ships in one lane: a slow tanker ahead, a fast freighter
    // behind. No threats so we observe steering alone.
    state.spawnQueue = [];
    state.threats = [];
    const tanker = state.ships.find((s) => s.classId === 'tanker')!;
    const freighter = state.ships.find((s) => s.classId === 'freighter')!;
    for (const s of state.ships) {
      if (s === tanker || s === freighter) continue;
      s.spawned = true;
      s.delivered = true; // remove from the sim
    }
    for (const s of [tanker, freighter]) {
      s.spawned = true;
      s.alive = true;
      s.delivered = false;
      s.laneIndex = 1;
      s.lateralSeed = 0;
      s.speedVariance = 1;
      s.heading = 0;
      s.y = WORLD.lanes[1];
      s.speed = SHIP_CLASSES[s.classId].speed;
    }
    tanker.x = 340;
    freighter.x = 200;

    for (let i = 0; i < 30 * 40 && !state.over; i++) stepTransit(state, [], rng);

    // The freighter (speed 34) must get past the tanker (speed 22); if passing
    // were broken it would queue behind and stay slower.
    expect(freighter.x).toBeGreaterThan(tanker.x);
  });
});

// ---------------------------------------------------------------------------
// Air defense economy & telemetry
// ---------------------------------------------------------------------------

describe('air defense & telemetry', () => {
  it('starts with a shore battery and no free escort', () => {
    const c = newCampaign('loadout');
    expect(c.bases).toBe(1);
    expect(c.escortUnits).toHaveLength(0);
  });

  it('bases and escorts are buyable and capped', () => {
    const c = newCampaign('buy-launchers');
    c.cash = 100_000;
    let guard = 0;
    while (buyBase(c) && guard++ < 20) {
      /* buy to cap */
    }
    expect(c.bases).toBe(4);
    expect(buyBase(c)).toBe(false);
    guard = 0;
    while (buyEscort(c) && guard++ < 20) {
      /* buy to cap */
    }
    expect(c.escortUnits).toHaveLength(3);
    expect(buyEscort(c)).toBe(false);
    // Each commissioned hull is a distinct ship with its own identity.
    expect(new Set(c.escortUnits.map((e) => e.id)).size).toBe(3);
    expect(new Set(c.escortUnits.map((e) => e.name)).size).toBe(3);
    for (const e of c.escortUnits) expect(e.modules).toEqual([]);
  });

  it('the transit builds one shore battery per owned base', () => {
    const c = newCampaign('base-count');
    c.bases = 3;
    const { state } = createRoundTransit(c, planCurrentRound(c));
    expect(state.bases).toHaveLength(3);
    // Batteries sit on the friendly (bottom) shore.
    for (const base of state.bases) expect(base.y).toBeGreaterThan(800);
  });

  it('a base-only defender still downs missiles (unlimited range)', () => {
    const c = newCampaign('base-defense');
    // No escorts; the shore battery must be able to engage anything.
    const { state } = runRound(c, { defend: true });
    expect(state.escorts).toHaveLength(0);
    expect(state.bases.length).toBeGreaterThan(0);
    expect(state.stats.baseIntercepts).toBeGreaterThan(0);
    expect(state.stats.escortIntercepts).toBe(0);
  });

  it('a moveEscort command sends the escort to the point, then it resumes forward', () => {
    const c = newCampaign('escort-move');
    fitUniformEscorts(c, 1);
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    const escort = state.escorts[0];
    const targetX = 900;
    const targetY = WORLD.lanes[0];
    stepTransit(state, [{ type: 'moveEscort', escortId: escort.id, x: targetX, y: targetY, hold: false }], rng);
    expect(escort.moveTarget).not.toBeNull();
    // Steam until it arrives (target cleared).
    for (let i = 0; i < 30 * 60 && escort.moveTarget; i++) stepTransit(state, [], rng);
    expect(escort.moveTarget).toBeNull();
    expect(escort.stationed).toBe(false);
    expect(Math.hypot(escort.x - targetX, escort.y - targetY)).toBeLessThan(40);
    // Now it resumes forward motion (x increases over the next second).
    const x0 = escort.x;
    for (let i = 0; i < 30; i++) stepTransit(state, [], rng);
    expect(escort.x).toBeGreaterThan(x0);
  });

  it('a hold order stations the escort in place instead of resuming forward', () => {
    const c = newCampaign('escort-hold');
    fitUniformEscorts(c, 1);
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    const escort = state.escorts[0];
    const targetX = 900;
    const targetY = WORLD.lanes[0];
    stepTransit(state, [{ type: 'moveEscort', escortId: escort.id, x: targetX, y: targetY, hold: true }], rng);
    for (let i = 0; i < 30 * 60 && escort.moveTarget; i++) stepTransit(state, [], rng);
    expect(escort.moveTarget).toBeNull();
    expect(escort.stationed).toBe(true);
    // Stationed: it holds position — x does not drift forward over a second.
    const x0 = escort.x;
    const y0 = escort.y;
    for (let i = 0; i < 30; i++) stepTransit(state, [], rng);
    expect(Math.abs(escort.x - x0)).toBeLessThan(1);
    expect(Math.abs(escort.y - y0)).toBeLessThan(1);
    // A fresh tap order releases it from station and it resumes forward.
    stepTransit(state, [{ type: 'moveEscort', escortId: escort.id, x: escort.x + 50, y: escort.y, hold: false }], rng);
    expect(escort.stationed).toBe(false);
    for (let i = 0; i < 30 * 60 && escort.moveTarget; i++) stepTransit(state, [], rng);
    const x1 = escort.x;
    for (let i = 0; i < 30; i++) stepTransit(state, [], rng);
    expect(escort.x).toBeGreaterThan(x1);
  });

  it('escorts can be destroyed by fire and are removed from the fleet', () => {
    const c = newCampaign('escort-killable');
    fitUniformEscorts(c, 1);
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    const escort = state.escorts[0];
    // Park a mine right on the escort and station it there so it detonates.
    state.threats.push({
      id: state.nextEntityId++,
      kind: 'mine',
      x: escort.x,
      y: escort.y,
      vx: 0,
      vy: 0,
      speed: 0,
      alive: true,
      revealed: false,
      lowSig: false,
      claimedByInterceptor: false,
    });
    // One heavy mine won't kill a 130hp escort; drop its hp first so it dies.
    escort.hp = 40;
    stepTransit(state, [], rng);
    expect(escort.alive).toBe(false);
    expect(state.stats.escortsLost).toBe(1);
    resolveTransit(c, state);
    expect(c.escortUnits).toHaveLength(0);
  });

  it('a hit temporarily disables an escort launcher', () => {
    const c = newCampaign('escort-disable');
    fitUniformEscorts(c, 1);
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    const escort = state.escorts[0];
    // A charted mine beside the escort clips it (survivable) and disables it.
    state.threats.push({
      id: state.nextEntityId++,
      kind: 'mine',
      x: escort.x,
      y: escort.y,
      vx: 0,
      vy: 0,
      speed: 0,
      alive: true,
      revealed: false,
      lowSig: false,
      claimedByInterceptor: false,
    });
    escort.hp = escort.maxHp; // survives the 115 mine hit
    stepTransit(state, [], rng);
    if (escort.alive) {
      expect(escort.disabledUntil).toBeGreaterThan(state.time);
      expect(state.stats.launchersDisabled).toBeGreaterThan(0);
    }
  });

  it('a battery strike knocks a shore battery offline without destroying it', () => {
    const c = newCampaign('base-disable');
    c.bases = 1;
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    const base = state.bases[0];
    // A missile arriving on the battery disables it.
    state.threats.push({
      id: state.nextEntityId++,
      kind: 'missile',
      x: base.x,
      y: base.y - 1,
      vx: 0,
      vy: COMBAT.missile.speed,
      speed: COMBAT.missile.speed,
      alive: true,
      targetX: base.x,
      targetY: base.y,
      targetKind: 'base',
      targetEntityId: base.id,
      revealed: true,
      lowSig: false,
      claimedByInterceptor: false,
    });
    stepTransit(state, [], rng);
    expect(base.disabledUntil).toBeGreaterThan(state.time);
    // Battery is not destroyed — it still exists in the array.
    expect(state.bases).toHaveLength(1);
  });

  it('keeps firing missiles into the late transit (no long end-of-round silence)', () => {
    const c = newCampaign('late-fire');
    for (let i = 0; i < 3; i++) runRound(c, { defend: true }); // reach a round with volume
    const plan = planCurrentRound(c);
    expect(plan.spawns.length).toBeGreaterThan(6);
    // Missile launch times themselves span the transit: the last scheduled
    // launch is well into the round, not clustered in the opening seconds.
    const spawnTimes = plan.spawns.map((s) => s.time).sort((a, b) => a - b);
    const lastScheduled = spawnTimes[spawnTimes.length - 1];
    expect(lastScheduled).toBeGreaterThan(60);
    // No 30s+ stretch with nothing for the player to do. Time between LAUNCHES
    // is the wrong measure now that the enemy fields persistent units: an
    // attack boat spawned at t=20 is still alongside a hull at t=80, so it
    // occupies the whole window rather than a moment of it. Treat a boat as
    // covering its engagement window and measure the silence that is left.
    const boatOccupancy = COMBAT.attackBoat.engageRange / COMBAT.attackBoat.speed + 45;
    const covered = plan.spawns
      .map((s) => ({ from: s.time, to: s.kind === 'attackBoat' ? s.time + boatOccupancy : s.time }))
      .sort((a, b) => a.from - b.from);
    let maxGap = covered[0].from;
    let clearUntil = covered[0].to;
    for (const span of covered.slice(1)) {
      maxGap = Math.max(maxGap, Math.max(0, span.from - clearUntil));
      clearUntil = Math.max(clearUntil, span.to);
    }
    expect(maxGap).toBeLessThan(30);

    // And in a live defended transit there is never a 30s+ silent stretch while
    // the convoy is still substantially in the strait (≥4 ships crossing) —
    // that dead-air near the end was the reported problem.
    c.ammo = 60;
    const { state, rng } = createRoundTransit(c, plan);
    let lastSpawnT = 0;
    let prevSpawned = state.stats.missilesSpawned;
    let maxGapWhileBusy = 0;
    while (!state.over) {
      const cmds: TransitCommand[] = [];
      const ready =
        state.ammo > 0 &&
        (state.bases.some((b) => b.cooldown <= 0 && state.time >= b.disabledUntil) ||
          state.escorts.some((e) => e.alive && e.cooldown <= 0 && state.time >= e.disabledUntil));
      if (ready) {
        for (const threat of state.threats) {
          if (threat.alive && threat.kind !== 'mine' && !threat.claimedByInterceptor) {
            cmds.push({ type: 'intercept', threatId: threat.id });
            break;
          }
        }
      }
      stepTransit(state, cmds, rng);
      if (state.stats.missilesSpawned > prevSpawned) {
        lastSpawnT = state.time;
        prevSpawned = state.stats.missilesSpawned;
      }
      // A live boat on the field is pressure too — the clock only runs while
      // there is genuinely nothing in the water demanding a response.
      if (state.threats.some((th) => th.alive && th.kind === 'attackBoat')) lastSpawnT = state.time;
      const active = state.ships.filter((s) => s.spawned && s.alive && !s.delivered).length;
      if (prevSpawned > 0 && active >= 4) {
        maxGapWhileBusy = Math.max(maxGapWhileBusy, state.time - lastSpawnT);
      }
    }
    expect(maxGapWhileBusy).toBeLessThan(30);
  });

  /** Build a bare threat for combat unit tests. */
  function makeMissile(state: TransitState, over: Partial<Record<string, unknown>>): number {
    const id = state.nextEntityId++;
    state.threats.push({
      id,
      kind: 'missile',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      speed: COMBAT.missile.speed,
      alive: true,
      revealed: true,
      lowSig: false,
      claimedByInterceptor: false,
      ...(over as object),
    } as never);
    return id;
  }

  it('an intercept fires from the nearest launcher (escort vs battery)', () => {
    const c = newCampaign('nearest-launcher');
    fitUniformEscorts(c, 1);
    c.bases = 1;
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    const escort = state.escorts[0];
    const base = state.bases[0];

    // A threat close to the escort (within its range, clear of both the hull
    // and its own aim point so it stays alive this tick). Aim points are far so
    // nothing self-detonates.
    const nearEscort = makeMissile(state, { x: escort.x + 100, y: escort.y, targetX: escort.x + 1200, targetY: escort.y });
    stepTransit(state, [{ type: 'intercept', threatId: nearEscort }], rng);
    expect(state.interceptors.find((i) => i.targetThreatId === nearEscort)?.launcher).toBe('escort');

    // A threat just above the battery (escort is far up-map): battery is nearer.
    const nearBase = makeMissile(state, { x: base.x, y: base.y - 100, targetX: base.x, targetY: 0 });
    stepTransit(state, [{ type: 'intercept', threatId: nearBase }], rng);
    expect(state.interceptors.find((i) => i.targetThreatId === nearBase)?.launcher).toBe('base');
  });

  it('allows more than one interceptor against a single missile', () => {
    const c = newCampaign('multi-intercept');
    c.bases = 2;
    c.ammo = 10;
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    // Aim point far away so the missile doesn't self-detonate this tick.
    const threat = makeMissile(state, { x: 900, y: 300, targetX: 1900, targetY: 300 });
    const ammo0 = state.ammo;
    stepTransit(
      state,
      [
        { type: 'intercept', threatId: threat },
        { type: 'intercept', threatId: threat },
      ],
      rng,
    );
    const inbound = state.interceptors.filter((i) => i.targetThreatId === threat && i.launcher !== 'pd');
    expect(inbound.length).toBe(2);
    expect(state.ammo).toBe(ammo0 - 2);
  });

  it('point defense launches a tracer projectile instead of deleting the missile', () => {
    const c = newCampaign('pd-projectile');
    c.classModules.cargo = ['selfDefense'];
    c.pdAmmo = 10;
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    // Bring a point-defense ship into the world.
    let ship = undefined as ReturnType<TransitState['ships']['find']>;
    for (let i = 0; i < 30 * 12 && !ship; i++) {
      stepTransit(state, [], rng);
      ship = state.ships.find((s) => s.spawned && s.alive && !s.delivered && s.modules.includes('selfDefense'));
    }
    expect(ship).toBeDefined();
    // Within point-defense radius (95) but outside strike range (30) and not
    // heading into the hull, so it survives to be engaged by point defense.
    makeMissile(state, { x: ship!.x + 60, y: ship!.y, targetX: ship!.x + 1000, targetY: ship!.y });
    stepTransit(state, [], rng);
    expect(state.interceptors.some((i) => i.launcher === 'pd')).toBe(true);
  });

  it('enough battery strikes destroy a shore battery (and remove it from the fleet)', () => {
    const c = newCampaign('base-destroy');
    c.bases = 1;
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    const base = state.bases[0];
    for (let k = 0; k < 30 && base.alive; k++) {
      makeMissile(state, {
        x: base.x,
        y: base.y - 1,
        vx: 0,
        vy: COMBAT.missile.speed,
        targetX: base.x,
        targetY: base.y,
        targetKind: 'base',
        targetEntityId: base.id,
      });
      stepTransit(state, [], rng);
    }
    expect(base.alive).toBe(false);
    expect(state.stats.basesLost).toBe(1);
    resolveTransit(c, state);
    expect(c.bases).toBe(0);
  });

  it('escorts and batteries carry damage between rounds and are repaired for cash', () => {
    const c = newCampaign('repair-assets');
    fitUniformEscorts(c, 1);
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    const escort = state.escorts[0];
    escort.hp = escort.maxHp;
    // A mine clips the escort (survivable at full hp) — leaves hull damage.
    state.threats.push({
      id: state.nextEntityId++,
      kind: 'mine',
      x: escort.x,
      y: escort.y,
      vx: 0,
      vy: 0,
      speed: 0,
      alive: true,
      revealed: false,
      lowSig: false,
      claimedByInterceptor: false,
    });
    while (!state.over) stepTransit(state, [], rng);
    resolveTransit(c, state);
    if (c.escortUnits.length > 0) {
      expect(escortDamageTotal(c)).toBeGreaterThan(0);
      const cost = repairCost(c);
      expect(cost).toBeGreaterThan(0);
      c.cash = cost;
      expect(repairFleet(c)).toBe(true);
      expect(escortDamageTotal(c)).toBe(0);
      expect(c.baseDamage).toBe(0);
    }
  });

  it('a tapped mine is swept by a drone from an in-range escort (munition spent)', () => {
    const c = newCampaign('sweeper-drone');
    c.completedResearch = ['mcmDrones.base'];
    fitUniformEscorts(c, 1, ['mcmDroneLauncher']);
    c.droneAmmo = 5;
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    expect(state.effects.sweepDrones).toBe(true);
    state.spawnQueue = [];
    state.threats = [];
    const escort = state.escorts[0];
    const ammo0 = state.droneAmmo;
    // A revealed mine well within drone range of the escort — no ship touches it.
    const mine = {
      id: state.nextEntityId++,
      kind: 'mine' as const,
      x: escort.x + 60,
      y: escort.y,
      vx: 0,
      vy: 0,
      speed: 0,
      alive: true,
      revealed: true,
      lowSig: false,
      claimedByInterceptor: false,
    };
    state.threats.push(mine);
    const swept0 = state.stats.minesSwept;
    // Player taps the mine to send a drone.
    stepTransit(state, [{ type: 'sweepMine', threatId: mine.id }], rng);
    expect(state.drones.length).toBe(1);
    expect(state.droneAmmo).toBe(ammo0 - 1); // munition consumed at launch
    for (let i = 0; i < 30 * 20 && mine.alive; i++) stepTransit(state, [], rng);
    expect(mine.alive).toBe(false);
    expect(state.stats.minesSwept).toBeGreaterThan(swept0);
  });

  it('drones are NOT auto-launched — an untapped charted mine is left alone', () => {
    const c = newCampaign('sweeper-manual');
    c.completedResearch = ['mcmDrones.base'];
    fitUniformEscorts(c, 1, ['mcmDroneLauncher']);
    c.droneAmmo = 5;
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    const escort = state.escorts[0];
    state.threats.push({
      id: state.nextEntityId++,
      kind: 'mine' as const,
      x: escort.x + 60,
      y: escort.y,
      vx: 0,
      vy: 0,
      speed: 0,
      alive: true,
      revealed: true,
      lowSig: false,
      claimedByInterceptor: false,
    });
    for (let i = 0; i < 30 * 10; i++) stepTransit(state, [], rng); // no command issued
    expect(state.drones.length).toBe(0);
    expect(state.droneAmmo).toBe(5);
  });

  it('a drone will not launch when no escort is within range of the mine', () => {
    const c = newCampaign('sweeper-oor');
    c.completedResearch = ['mcmDrones.base'];
    fitUniformEscorts(c, 1, ['mcmDroneLauncher']);
    c.droneAmmo = 5;
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    const escort = state.escorts[0];
    // A revealed mine far beyond drone launch range of the only escort.
    const mine = {
      id: state.nextEntityId++,
      kind: 'mine' as const,
      x: escort.x + state.effects.mcm.launchRange + 400,
      y: escort.y,
      vx: 0,
      vy: 0,
      speed: 0,
      alive: true,
      revealed: true,
      lowSig: false,
      claimedByInterceptor: false,
    };
    state.threats.push(mine);
    stepTransit(state, [{ type: 'sweepMine', threatId: mine.id }], rng);
    expect(state.drones.length).toBe(0);
    expect(state.droneAmmo).toBe(5); // no munition spent
    expect(state.events.some((e) => e.type === 'launchFailed')).toBe(true);
  });

  it('drones do NOT launch without munitions in stock', () => {
    const c = newCampaign('sweeper-no-ammo');
    c.completedResearch = ['mcmDrones.base'];
    fitUniformEscorts(c, 1, ['mcmDroneLauncher']);
    c.droneAmmo = 0; // researched, but nothing bought
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    const escort = state.escorts[0];
    state.threats.push({
      id: state.nextEntityId++,
      kind: 'mine' as const,
      x: escort.x + 60,
      y: escort.y,
      vx: 0,
      vy: 0,
      speed: 0,
      alive: true,
      revealed: true,
      lowSig: false,
      claimedByInterceptor: false,
    });
    const mineId = state.threats[state.threats.length - 1].id;
    stepTransit(state, [{ type: 'sweepMine', threatId: mineId }], rng);
    expect(state.drones.length).toBe(0);
    expect(state.events.some((e) => e.type === 'launchFailed')).toBe(true);
  });

  function pushMine(state: TransitState, x: number, y: number, revealed = false) {
    const mine = {
      id: state.nextEntityId++,
      kind: 'mine' as const,
      x,
      y,
      vx: 0,
      vy: 0,
      speed: 0,
      alive: true,
      revealed,
      lowSig: false,
      claimedByInterceptor: false,
    };
    state.threats.push(mine);
    return mine;
  }

  it('a scan plane charts mines only in the selected lane', () => {
    const c = newCampaign('scan-lane');
    c.scanUnlocked = true;
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    const inLane = pushMine(state, 1000, WORLD.lanes[0]);
    const otherLane = pushMine(state, 1000, WORLD.lanes[2]);
    // Send the scan plane down the NORTH lane (lanes[0]).
    stepTransit(state, [{ type: 'ability', ability: 'scan', x: 0, y: WORLD.lanes[0] }], rng);
    for (let i = 0; i < 30 * 12 && state.aircraft.length > 0; i++) stepTransit(state, [], rng);
    expect(inLane.revealed).toBe(true);
    expect(otherLane.revealed).toBe(false);
  });

  it('runs two scan sorties in one transit without error (regression)', () => {
    const c = newCampaign('scan-twice');
    c.scanUnlocked = true;
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    const north = pushMine(state, 900, WORLD.lanes[0]);
    const south = pushMine(state, 1200, WORLD.lanes[2]);
    stepTransit(state, [{ type: 'ability', ability: 'scan', x: 0, y: WORLD.lanes[0] }], rng);
    for (let i = 0; i < 30 * 8; i++) stepTransit(state, [], rng);
    stepTransit(state, [{ type: 'ability', ability: 'scan', x: 0, y: WORLD.lanes[2] }], rng);
    for (let i = 0; i < 30 * 8; i++) stepTransit(state, [], rng);
    expect(state.scanCharges).toBe(state.effects.abilities.scan.charges - 2);
    expect(north.revealed).toBe(true);
    expect(south.revealed).toBe(true);
  });

  it('an ECM plane destroys a missile that lingers in its jamming orbit', () => {
    const c = newCampaign('ecm-jam');
    c.ecmUnlocked = true;
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    const cx = 1000;
    const cy = WORLD.lanes[1];
    // A near-stationary missile parked at the orbit center (aim point far away
    // so it never self-detonates); it should cook off once the plane is jamming.
    const m = makeMissile(state, { x: cx, y: cy, vx: 0, vy: 0, targetX: cx, targetY: -400 });
    stepTransit(state, [{ type: 'ability', ability: 'ecm', x: cx, y: cy }], rng);
    const threat = state.threats.find((th) => th.id === m)!;
    for (let i = 0; i < 30 * 12 && threat.alive; i++) stepTransit(state, [], rng);
    expect(threat.alive).toBe(false);
    expect(state.stats.ecmKills).toBeGreaterThan(0);
  });

  it('rejects an ECM deployment on land (off the water band), wasting no charge', () => {
    const c = newCampaign('ecm-land');
    c.ecmUnlocked = true;
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    const charges0 = state.ecmCharges;
    // y=40 is up on the hostile shore, over the launchers — not open water.
    stepTransit(state, [{ type: 'ability', ability: 'ecm', x: 900, y: 40 }], rng);
    expect(state.ecmCharges).toBe(charges0); // no charge spent
    expect(state.aircraft.some((a) => a.role === 'ecm')).toBe(false);
    expect(state.events.some((e) => e.type === 'launchFailed')).toBe(true);
  });

  it('point defense fires only its per-transit magazine, then stops', () => {
    const c = newCampaign('pd-magazine');
    c.classModules.cargo = ['selfDefense'];
    c.pdAmmo = 20; // plenty of rounds in stock; the per-ship magazine is the cap
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    let ship = undefined as ReturnType<TransitState['ships']['find']>;
    for (let i = 0; i < 30 * 12 && !ship; i++) {
      stepTransit(state, [], rng);
      ship = state.ships.find((s) => s.spawned && s.alive && !s.delivered && s.modules.includes('selfDefense'));
    }
    expect(ship).toBeDefined();
    expect(ship!.pdShots).toBe(state.effects.selfDefense.magazine);
    // Keep feeding fresh in-range missiles; PD may only ever fire `magazine` shots.
    let pdLaunches = 0;
    const seen = new Set<number>();
    for (let k = 0; k < 20 && ship!.alive && !ship!.delivered; k++) {
      makeMissile(state, { x: ship!.x + 60, y: ship!.y, targetX: ship!.x + 2000, targetY: ship!.y });
      stepTransit(state, [], rng);
      for (const i of state.interceptors) {
        if (i.launcher === 'pd' && !seen.has(i.id)) {
          seen.add(i.id);
          pdLaunches++;
        }
      }
    }
    expect(pdLaunches).toBeLessThanOrEqual(state.effects.selfDefense.magazine);
    expect(ship!.pdShots).toBe(0);
  });

  it('point defense will not fire without point-defense rounds in stock', () => {
    const c = newCampaign('pd-no-ammo');
    c.classModules.cargo = ['selfDefense'];
    c.pdAmmo = 0; // module fitted but no rounds bought
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    let ship = undefined as ReturnType<TransitState['ships']['find']>;
    for (let i = 0; i < 30 * 12 && !ship; i++) {
      stepTransit(state, [], rng);
      ship = state.ships.find((s) => s.spawned && s.alive && !s.delivered && s.modules.includes('selfDefense'));
    }
    expect(ship).toBeDefined();
    for (let k = 0; k < 10; k++) {
      makeMissile(state, { x: ship!.x + 60, y: ship!.y, targetX: ship!.x + 2000, targetY: ship!.y });
      stepTransit(state, [], rng);
    }
    expect(state.interceptors.some((i) => i.launcher === 'pd')).toBe(false);
    expect(ship!.pdShots).toBe(state.effects.selfDefense.magazine); // never spent
  });

  it('formation shapes escort reach: Tight extends range, Wide shrinks it', () => {
    const range = (formation: 'tight' | 'wide') => {
      const c = newCampaign(`reach-${formation}`);
      c.formation = formation;
      fitUniformEscorts(c, 1);
      c.bases = 0; // isolate the escort (no unlimited-range battery)
      c.ammo = 10;
      const { state, rng } = createRoundTransit(c, planCurrentRound(c));
      state.spawnQueue = [];
      state.threats = [];
      const escort = state.escorts[0];
      // A threat 700u from the escort: inside Tight reach (~1014) but beyond
      // Wide reach (~608). Aim point far away so it survives the tick.
      const id = makeMissile(state, {
        x: escort.x + 700,
        y: escort.y,
        targetX: escort.x + 3000,
        targetY: escort.y,
      });
      stepTransit(state, [{ type: 'intercept', threatId: id }], rng);
      return state.interceptors.some((i) => i.targetThreatId === id && i.launcher === 'escort');
    };
    expect(range('tight')).toBe(true); // in reach
    expect(range('wide')).toBe(false); // out of reach
  });

  it('a direct hit chains blast into a neighbor in Tight, but not in Wide', () => {
    const neighborHurt = (formation: 'tight' | 'wide') => {
      const c = newCampaign(`chain-${formation}`);
      c.formation = formation;
      const { state, rng } = createRoundTransit(c, planCurrentRound(c));
      state.spawnQueue = [];
      state.threats = [];
      // Two active ships packed ~30u apart (inside Tight's 55u chain radius).
      const [a, b] = state.ships;
      for (const s of state.ships) {
        s.spawned = true;
        s.delivered = s !== a && s !== b;
        s.alive = true;
      }
      a.x = 900; a.y = WORLD.lanes[1]; a.hp = a.maxHp;
      b.x = 930; b.y = WORLD.lanes[1]; b.hp = b.maxHp;
      // A stationary missile sitting on ship A → direct hit this tick.
      makeMissile(state, { x: a.x, y: a.y, vx: 0, vy: 0, targetX: a.x + 3000, targetY: a.y });
      stepTransit(state, [], rng);
      return b.hp < b.maxHp;
    };
    expect(neighborHurt('tight')).toBe(true);
    expect(neighborHurt('wide')).toBe(false);
  });

  it('does not fire missiles at a ship that has all but crossed the delivery line', () => {
    const c = newCampaign('no-target-delivered');
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [{ time: 0.05, kind: 'missile', siteX: 900 }];
    state.threats = [];
    // Only one live ship, sitting right at the delivery line (inside the safe
    // margin); every other ship removed from the sim.
    const survivors = state.ships.filter((s) => s.spawned || true);
    let kept = false;
    for (const s of survivors) {
      if (!kept) {
        s.spawned = true;
        s.alive = true;
        s.delivered = false;
        s.x = WORLD.deliverX - 10; // within deliverSafeMargin of the line
        s.y = WORLD.lanes[1];
        kept = true;
      } else {
        s.spawned = true;
        s.delivered = true;
      }
    }
    stepTransit(state, [], rng);
    expect(state.stats.missilesSpawned).toBe(0);
  });

  it('accumulates per-round telemetry and exports valid totals', () => {
    const c = newCampaign('telemetry');
    runRound(c, { defend: true });
    runRound(c, { defend: true });
    expect(c.telemetry).toHaveLength(2);
    const exported = buildTelemetryExport(c, '2026-01-01T00:00:00.000Z');
    expect(exported.game).toBe('straitwatch');
    expect(exported.seed).toBe('telemetry');
    expect(exported.rounds).toHaveLength(2);
    expect(exported.totals.launched).toBe(
      c.telemetry.reduce((sum, r) => sum + r.launched, 0),
    );
    expect(exported.totals.launched).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Save / load
// ---------------------------------------------------------------------------

describe('save', () => {
  it('round-trips the regional-run state', () => {
    clearRun();
    const c = newCampaign('savegame');
    runRound(c, { defend: true });
    saveRun(c);
    const loaded = loadRun();
    expect(loaded).not.toBeNull();
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(c));
    clearRun();
  });

  it('returns null when nothing is saved', () => {
    clearRun();
    expect(loadRun()).toBeNull();
  });

  it('heals a partial run save, backfilling missing fields', () => {
    // A minimal save from an earlier build of the redesign (missing fields).
    const old = { version: 4, seed: 'partial', round: 4, phase: 'prep', cash: 500 };
    const m = migrateRun(old)!;
    expect(m).not.toBeNull();
    // Preserved values survive.
    expect(m.seed).toBe('partial');
    expect(m.round).toBe(4);
    expect(m.cash).toBe(500);
    // New fields are backfilled to sane defaults.
    expect(m.pdAmmo).toBe(0);
    expect(m.droneAmmo).toBe(0);
    expect(m.dev).toBe(false);
    expect(m.modulePaid).toEqual({ cargo: {}, tanker: {}, freighter: {} });
    expect(m.quota.pointsNeeded).toBeGreaterThan(0);
    expect(m.evolution.formationTell).toBe(null);
    expect(Array.isArray(m.history)).toBe(true);
    expect(m.runOutcome).toBe('active');
    expect(m.pendingDraft).toBeNull();
    expect(Array.isArray(m.draftHistory)).toBe(true);
    expect(typeof m.regionId).toBe('string');
    // A garbage phase is repaired (including the retired 'research' phase).
    expect(migrateRun({ seed: 'x', phase: 'research' })!.phase).toBe('prep');
    expect(migrateRun({ seed: 'x', phase: 'nonsense' })!.phase).toBe('prep');
    // Non-objects are rejected.
    expect(migrateRun(null)).toBeNull();
    expect(migrateRun(42)).toBeNull();
  });

  it('does not clobber existing nested values when healing', () => {
    const c = newCampaign('nested');
    c.classModules.cargo = ['selfDefense'];
    c.modulePaid.cargo = { selfDefense: 220 };
    c.evolution.tracks.mines = 55;
    const m = migrateRun(JSON.parse(JSON.stringify(c)))!;
    expect(m.classModules.cargo).toEqual(['selfDefense']);
    expect(m.modulePaid.cargo).toEqual({ selfDefense: 220 });
    expect(m.evolution.tracks.mines).toBe(55);
  });

  it('keeps the Commander Profile and the run under separate keys', () => {
    clearRun();
    clearProfile();
    const profile = newProfile();
    profile.xp = 77;
    saveProfile(profile);
    const run = newCampaign('separation');
    saveRun(run);
    // Clearing / replacing the RUN never touches the profile.
    clearRun();
    expect(loadRun()).toBeNull();
    expect(loadProfile()!.xp).toBe(77);
    // And clearing the profile never touches a saved run.
    saveRun(run);
    clearProfile();
    expect(loadProfile()).toBeNull();
    expect(loadRun()).not.toBeNull();
    clearRun();
  });

  it('round-trips and heals the Commander Profile', () => {
    clearProfile();
    const p = newProfile();
    p.xp = 30;
    p.records.homeStrait = { bestRound: 5, attempts: 2, completions: 0 };
    saveProfile(p);
    const loaded = loadProfile()!;
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(p));
    // A partial profile heals forward.
    const healed = migrateProfile({ xp: 12 })!;
    expect(healed.xp).toBe(12);
    expect(healed.unlockedRegions).toContain(FIRST_REGION);
    expect(Array.isArray(healed.loadout)).toBe(true);
    clearProfile();
  });
});

// ---------------------------------------------------------------------------
// Dev mode
// ---------------------------------------------------------------------------

describe('dev mode', () => {
  it('builds a dev campaign with the god / unlock loadout and jumps to a round', () => {
    const c = newDevCampaign('dev-run', { round: 6, god: true, unlockAll: true });
    expect(c.dev).toBe(true);
    expect(c.godMode).toBe(true);
    expect(c.round).toBe(6);
    expect(c.completedResearch.length).toBe(allResearchableIds().length);
    expect(c.ecmUnlocked).toBe(true);
    expect(c.scanUnlocked).toBe(true);
    expect(c.cash).toBeGreaterThan(100000);
    // Jumping to a later round faces later threats: the enemy is fast-forwarded.
    const plan = planCurrentRound(c);
    expect(plan.mines.length).toBeGreaterThan(0); // mines are online by round 6
    expect(plan.spawns.some((s) => s.kind === 'guidedMissile')).toBe(true);
  });

  it('god mode makes hulls invincible and munitions unlimited', () => {
    const c = newDevCampaign('god-run', { round: 3, god: true, unlockAll: true });
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    expect(state.effects.damageTakenMult).toBe(0);
    expect(state.ammo).toBeGreaterThan(1000);
    state.spawnQueue = [];
    state.threats = [];
    // Bring a ship into the world and slam a mine onto it — it must survive.
    let ship = undefined as ReturnType<TransitState['ships']['find']>;
    for (let i = 0; i < 30 * 12 && !ship; i++) {
      stepTransit(state, [], rng);
      ship = state.ships.find((s) => s.spawned && s.alive && !s.delivered);
    }
    expect(ship).toBeDefined();
    const hp0 = ship!.hp;
    state.threats.push({
      id: state.nextEntityId++,
      kind: 'mine',
      x: ship!.x,
      y: ship!.y,
      vx: 0,
      vy: 0,
      speed: 0,
      alive: true,
      revealed: false,
      lowSig: false,
      claimedByInterceptor: false,
    });
    stepTransit(state, [], rng);
    expect(ship!.alive).toBe(true);
    expect(ship!.hp).toBe(hp0); // took zero damage
  });

  it('a normal campaign is never a dev run', () => {
    const c = newCampaign('normal');
    expect(c.dev).toBe(false);
    expect(c.godMode).toBe(false);
  });
});
