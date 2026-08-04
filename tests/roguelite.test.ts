// Roguelite-redesign tests: the state transitions the vertical slice must
// prove (docs/design/roguelite-redesign.md → First Implementation Milestone).
//
//   • the two save layers stay separate (see also tests/sim.test.ts → save)
//   • regional runs start from region-defined state and reset on defeat while
//     Commander progression persists
//   • completing the watermark round finishes the region and unlocks the next
//   • wreckage recovery: positional, multi-escort, resets when abandoned
//   • survivor rescue and the unrescued-crew confidence penalty
//   • both failure systems (confidence, quota)
//   • the mandatory post-round draft: breadth, weighting, prerequisites,
//     region awareness, immediate activation
//   • Commander Abilities: bounded loadout, central effect application

import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/sim/rng';
import {
  ammoUnitCost,
  createRoundTransit,
  newRegionalRun,
  planCurrentRound,
  repairCost,
  resolveTransit,
  setComposition,
} from '../src/sim/campaign';
import {
  applyRunToProfile,
  loadoutBlockReason,
  newProfile,
  recordRunStart,
  sanitizedLoadout,
  setLoadout,
  unlockAbility,
  unlockBlockReason,
} from '../src/sim/commander';
import {
  dismissEmptyDraft,
  draftPool,
  generateDraft,
  hasCounterFor,
  pityCandidates,
  selectDraftOption,
} from '../src/sim/draft';
import { deriveEffects, stepTransit } from '../src/sim/transit';
import { evolveEnemy, newEvolution } from '../src/sim/evolution';
import { COMMANDER_ABILITIES } from '../src/data/commanderAbilities';
import { FIRST_REGION, REGIONS, regionDef } from '../src/data/regions';
import { RESEARCH_INDEX, effectiveResearch } from '../src/data/counters';
import { CAMPAIGN, COMMANDER, DRAFT, ECONOMY, SIM, SURVIVORS, WORLD, WRECKAGE } from '../src/data/tuning';
import type {
  CampaignState,
  RoundMetrics,
  SurvivorArea,
  TransitState,
  WreckageField,
} from '../src/sim/types';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/** A quiet region-1 transit with a controllable escort, for recovery tests. */
function quietRun(escorts = 1): {
  c: CampaignState;
  state: TransitState;
  rng: ReturnType<typeof makeRng>;
} {
  const c = newRegionalRun('quiet', FIRST_REGION);
  // The region grants 1 free escort; add more for multi-escort tests.
  while (c.escortUnits.length < escorts) {
    c.escortUnits.push({
      id: c.nextEscortId++,
      name: `Extra ${c.escortUnits.length}`,
      modules: [],
      modulePaid: {},
      damage: 0,
    });
  }
  const { state, rng } = createRoundTransit(c, planCurrentRound(c));
  state.spawnQueue = [];
  state.threats = [];
  return { c, state, rng };
}

let fieldId = 800_000;
function injectWreckage(state: TransitState, over: Partial<WreckageField> = {}): WreckageField {
  const field: WreckageField = {
    id: fieldId++,
    x: 600,
    y: WORLD.lanes[1],
    branch: 'missiles',
    threatKind: 'missile',
    required: WRECKAGE.recoverSeconds,
    progress: 0,
    expiresAt: state.time + WRECKAGE.lifetimeSeconds,
    recovered: false,
    expired: false,
    ...over,
  };
  state.wreckage.push(field);
  return field;
}

function injectSurvivors(state: TransitState, over: Partial<SurvivorArea> = {}): SurvivorArea {
  const area: SurvivorArea = {
    id: fieldId++,
    x: 600,
    y: WORLD.lanes[1],
    shipName: 'Meridian',
    required: SURVIVORS.rescueSeconds,
    progress: 0,
    expiresAt: state.time + SURVIVORS.lifetimeSeconds,
    rescued: false,
    lost: false,
    ...over,
  };
  state.survivors.push(area);
  return area;
}

/** Park an escort exactly on a point and hold it there. */
function stationEscort(state: TransitState, index: number, x: number, y: number): void {
  const escort = state.escorts[index];
  escort.x = x;
  escort.y = y;
  escort.moveTarget = null;
  escort.stationed = true;
}

function ticks(seconds: number): number {
  return Math.ceil(seconds / SIM.dt);
}

/** Run a full round headlessly with no player input. */
function playRound(c: CampaignState): ReturnType<typeof resolveTransit> {
  const { state, rng } = createRoundTransit(c, planCurrentRound(c));
  let guard = 0;
  while (!state.over && guard++ < Math.ceil(SIM.maxTransitTime / SIM.dt) + 10) {
    stepTransit(state, [], rng);
  }
  return resolveTransit(c, state);
}

/** An empty round the convoy always survives (no spawns, no mines). */
function playEmptyRound(c: CampaignState): ReturnType<typeof resolveTransit> {
  const plan = { ...planCurrentRound(c), spawns: [], mines: [], installations: [], smoke: [], electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 0 }, debuts: [] };
  const { state, rng } = createRoundTransit(c, plan);
  let guard = 0;
  while (!state.over && guard++ < Math.ceil(SIM.maxTransitTime / SIM.dt) + 10) {
    stepTransit(state, [], rng);
  }
  return resolveTransit(c, state);
}

// ---------------------------------------------------------------------------
// Regional runs: creation, reset, completion
// ---------------------------------------------------------------------------

describe('regional run lifecycle', () => {
  it('starts from the region-defined state, with the free starting escort', () => {
    const region = regionDef(FIRST_REGION);
    const run = newRegionalRun('start-state', FIRST_REGION);
    expect(run.regionId).toBe(FIRST_REGION);
    expect(run.cash).toBe(region.start.cash);
    expect(run.confidence).toBe(region.start.confidence);
    expect(run.capacity).toBe(region.start.capacity);
    expect(run.fleet).toEqual(region.start.fleet);
    expect(run.escortUnits).toHaveLength(region.start.escorts);
    expect(run.escortUnits.length).toBeGreaterThan(0); // recovery needs a hull
    expect(run.completedResearch).toEqual([]); // the build never carries in
    expect(run.runOutcome).toBe('active');
  });

  it('constrains enemy procurement to the region’s branches', () => {
    const run = newRegionalRun('region-wall', FIRST_REGION);
    const region = regionDef(FIRST_REGION);
    expect(run.evolution.economy.allowedBranches).toEqual(region.enemyBranches);
    // Push the enemy economy deep into the campaign: nothing outside the
    // region's set is ever funded, however rich the enemy gets.
    const allowed = new Set<string>(region.enemyBranches);
    const rng = makeRng('region-wall');
    for (let round = 1; round <= 14; round++) {
      const metrics: RoundMetrics = {
        round,
        interceptRate: 0.8,
        formation: 'tight',
        mineDetectRate: 0.6,
        torpedoDetectRate: -1,
        valueSent: 241,
        deliveredFraction: 0.9,
      };
      evolveEnemy(run.evolution, metrics, rng);
      for (const [branch, ledger] of Object.entries(run.evolution.economy.ledgers)) {
        if (allowed.has(branch)) continue;
        expect(ledger.spend, `${branch} spend at round ${round}`).toBe(0);
        expect(Object.keys(ledger.units)).toHaveLength(0);
      }
    }
    expect(run.evolution.economy.openBranches.every((b) => allowed.has(b))).toBe(true);
  });

  it('the full-roster proving ground still opens later branches (control)', () => {
    const evo = newEvolution(); // defaults to the dev region
    const rng = makeRng('control');
    for (let round = 1; round <= 14; round++) {
      evolveEnemy(
        evo,
        {
          round,
          interceptRate: 0.8,
          formation: 'tight',
          mineDetectRate: 0.6,
          torpedoDetectRate: 0.6,
          valueSent: 241,
          deliveredFraction: 0.9,
        },
        rng,
      );
    }
    expect(evo.economy.openBranches.length).toBeGreaterThan(2);
  });

  it('completes the region at the configurable round cap and settles the profile', () => {
    const run = newRegionalRun('completion', FIRST_REGION);
    const region = regionDef(FIRST_REGION);
    // Make completion quick for the test: the cap is data, not code.
    const capped = { ...region, completionRound: 2 };
    REGIONS.__testCap = capped; // registered under a scratch id
    run.regionId = '__testCap';
    playEmptyRound(run);
    expect(run.campaignOver).toBe(false);
    playEmptyRound(run);
    expect(run.campaignOver).toBe(true);
    expect(run.runOutcome).toBe('victory');
    expect(run.pendingDraft).toBeNull();

    const profile = newProfile();
    // __testCap unlocks what the template said (pirateNarrows via spread).
    const settlement = applyRunToProfile(profile, run);
    expect(settlement.completed).toBe(true);
    expect(settlement.xpEarned).toBe(2 * COMMANDER.xpPerRound + capped.completionXp);
    expect(profile.xp).toBe(settlement.xpEarned);
    expect(settlement.regionUnlocked).toBe(capped.unlocks);
    expect(profile.unlockedRegions).toContain(capped.unlocks);
    // Idempotent: a reload of the final report can never double-award.
    const again = applyRunToProfile(profile, run);
    expect(again.xpEarned).toBe(0);
    expect(profile.xp).toBe(settlement.xpEarned);
    delete REGIONS.__testCap;
  });

  it('defeat retains Commander progression and records the attempt', () => {
    const profile = newProfile();
    const run = newRegionalRun('defeat-keeps-profile', FIRST_REGION);
    recordRunStart(profile, FIRST_REGION);
    run.confidence = 1;
    // Play undefended until the run dies.
    for (let r = 0; r < 12 && !run.campaignOver; r++) playRound(run);
    expect(run.campaignOver).toBe(true);
    expect(run.runOutcome).toBe('defeat');
    const roundsFought = run.round - 1;
    const settlement = applyRunToProfile(profile, run);
    expect(settlement.completed).toBe(false);
    expect(settlement.regionUnlocked).toBeNull();
    expect(settlement.xpEarned).toBe(roundsFought * COMMANDER.xpPerRound);
    expect(profile.records[FIRST_REGION].attempts).toBe(1);
    expect(profile.records[FIRST_REGION].bestRound).toBe(roundsFought);
    expect(profile.records[FIRST_REGION].completions).toBe(0);
    // A NEW attempt at the same region starts from round 1 with fresh state.
    const retry = newRegionalRun('retry', FIRST_REGION, sanitizedLoadout(profile));
    expect(retry.round).toBe(1);
    expect(retry.completedResearch).toEqual([]);
    expect(retry.confidence).toBe(regionDef(FIRST_REGION).start.confidence);
  });

  it('confidence reaching zero is a defeat with cause recorded', () => {
    const run = newRegionalRun('conf-defeat', FIRST_REGION);
    run.confidence = 1;
    setComposition(run, 'tanker', 0);
    setComposition(run, 'freighter', 0);
    setComposition(run, 'cargo', 5);
    for (let r = 0; r < 10 && !run.campaignOver; r++) playRound(run);
    expect(run.campaignOver).toBe(true);
    expect(run.runOutcome).toBe('defeat');
    expect(run.defeatCause).toBe('confidence');
  });
});

// ---------------------------------------------------------------------------
// Wreckage recovery
// ---------------------------------------------------------------------------

describe('wreckage recovery', () => {
  it('an escort holding inside the field recovers it; the branch is recorded', () => {
    const { state, rng } = quietRun(1);
    const field = injectWreckage(state, { branch: 'mines', threatKind: 'mine' });
    stationEscort(state, 0, field.x, field.y);
    for (let i = 0; i < ticks(WRECKAGE.recoverSeconds + 1); i++) stepTransit(state, [], rng);
    expect(field.recovered).toBe(true);
    expect(state.stats.wreckageRecovered).toBe(1);
    expect(state.stats.wreckageByBranch.mines).toBe(1);
    expect(state.stats.recoveryEscortSeconds).toBeGreaterThan(0);
  });

  it('multiple escorts recover FASTER than one', () => {
    const timeToRecover = (escorts: number): number => {
      const { state, rng } = quietRun(escorts);
      const field = injectWreckage(state);
      for (let i = 0; i < escorts; i++) stationEscort(state, i, field.x, field.y);
      let steps = 0;
      while (!field.recovered && steps++ < ticks(60)) stepTransit(state, [], rng);
      return steps;
    };
    const solo = timeToRecover(1);
    const pair = timeToRecover(2);
    expect(pair).toBeLessThan(solo);
    // The scaling is the tuned rate, not a doubling: 1 + extraEscortRate.
    expect(pair).toBeGreaterThan(solo / 2.5);
  });

  it('progress resets COMPLETELY when every escort leaves', () => {
    const { state, rng } = quietRun(1);
    const field = injectWreckage(state);
    stationEscort(state, 0, field.x, field.y);
    for (let i = 0; i < ticks(WRECKAGE.recoverSeconds * 0.5); i++) stepTransit(state, [], rng);
    expect(field.progress).toBeGreaterThan(0);
    expect(field.recovered).toBe(false);
    // The escort leaves: park it far outside the radius.
    stationEscort(state, 0, field.x + WRECKAGE.radius * 4, field.y);
    stepTransit(state, [], rng);
    expect(field.progress).toBe(0); // touch-and-go preserved nothing
  });

  it('an unworked field expires and is counted abandoned', () => {
    const { state, rng } = quietRun(1);
    const field = injectWreckage(state, { expiresAt: state.time + 2 });
    stationEscort(state, 0, field.x + WRECKAGE.radius * 4, field.y);
    for (let i = 0; i < ticks(3); i++) stepTransit(state, [], rng);
    expect(field.expired).toBe(true);
    expect(field.recovered).toBe(false);
    expect(state.stats.wreckageExpired).toBe(1);
  });

  it('destroyed threats can drop wreckage; expended ones never do', () => {
    // Statistical: intercepted missiles across many kills should produce
    // SOME wreckage at the tuned drop chance (0.22 → P(none in 40) ≈ 5e-5).
    const { state, rng } = quietRun(1);
    let spawned = 0;
    for (let k = 0; k < 40; k++) {
      const missile = {
        id: 900_000 + k,
        kind: 'missile' as const,
        x: 900,
        y: WORLD.lanes[0],
        vx: 0,
        vy: 0,
        speed: 60,
        alive: true,
        revealed: true,
        lowSig: false,
        claimedByInterceptor: false,
        targetX: 4000,
        targetY: WORLD.lanes[0],
      };
      state.threats.push(missile);
      state.interceptors.push({
        id: 950_000 + k,
        x: missile.x,
        y: missile.y + 1, // inside the 18-unit fuse radius: resolves this tick
        targetThreatId: missile.id,
        speed: 400,
        launcher: 'base',
        hitChance: 1,
      });
      stepTransit(state, [], rng);
      spawned = state.stats.wreckageSpawned;
    }
    expect(spawned).toBeGreaterThan(0);
    expect(spawned).toBeLessThan(40); // it is a chance, not a guarantee
  });
});

// ---------------------------------------------------------------------------
// Survivor rescue
// ---------------------------------------------------------------------------

describe('survivor rescue', () => {
  it('a stationed escort rescues the crew before the water takes them', () => {
    const { state, rng } = quietRun(1);
    const area = injectSurvivors(state);
    stationEscort(state, 0, area.x, area.y);
    for (let i = 0; i < ticks(SURVIVORS.rescueSeconds + 1); i++) stepTransit(state, [], rng);
    expect(area.rescued).toBe(true);
    expect(state.stats.survivorsRescued).toBe(1);
    expect(state.stats.survivorsLost).toBe(0);
  });

  it('leaving mid-rescue resets progress, like wreckage', () => {
    const { state, rng } = quietRun(1);
    const area = injectSurvivors(state);
    stationEscort(state, 0, area.x, area.y);
    for (let i = 0; i < ticks(SURVIVORS.rescueSeconds * 0.5); i++) stepTransit(state, [], rng);
    expect(area.progress).toBeGreaterThan(0);
    stationEscort(state, 0, area.x + SURVIVORS.radius * 4, area.y);
    stepTransit(state, [], rng);
    expect(area.progress).toBe(0);
  });

  it('an unrescued crew costs extra confidence at round resolution', () => {
    // Two identical quiet rounds; one leaves a crew in the water.
    const outcome = (lostCrews: number): number => {
      const c = newRegionalRun('crew-penalty', FIRST_REGION);
      const plan = { ...planCurrentRound(c), spawns: [], mines: [], installations: [], smoke: [], electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 0 }, debuts: [] };
      const { state, rng } = createRoundTransit(c, plan);
      let guard = 0;
      while (!state.over && guard++ < ticks(SIM.maxTransitTime) + 10) stepTransit(state, [], rng);
      state.stats.survivorsLost = lostCrews; // injected at resolution time
      resolveTransit(c, state);
      return c.confidence;
    };
    const clean = outcome(0);
    const abandoned = outcome(2);
    // The penalty is rate-scaled against the convoy that sailed, so the exact
    // figure depends on the round's hull count — what must hold is that leaving
    // crews behind costs confidence, and costs it in proportion.
    expect(abandoned).toBeLessThan(clean);
    expect(CAMPAIGN.confidenceCrewLostRate).toBeLessThan(0);
  });

  it('rescue prevents the abandonment penalty AND recovers some confidence', () => {
    const outcome = (rescued: number, lost: number): number => {
      const c = newRegionalRun('crew-rescued', FIRST_REGION);
      const plan = { ...planCurrentRound(c), spawns: [], mines: [], installations: [], smoke: [], electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 0 }, debuts: [] };
      const { state, rng } = createRoundTransit(c, plan);
      let guard = 0;
      while (!state.over && guard++ < ticks(SIM.maxTransitTime) + 10) stepTransit(state, [], rng);
      state.stats.survivorsRescued = rescued;
      state.stats.survivorsLost = lost;
      resolveTransit(c, state);
      return c.confidence;
    };
    const none = outcome(0, 0);
    // Bringing crews home pays — it is the one way confidence moves upward
    // inside a round other than delivering cargo.
    expect(outcome(2, 0)).toBe(none + CAMPAIGN.confidencePerCrewRescued * 2);
    // Rescuing instead of abandoning is worth the difference between the two,
    // and a rescue never fully offsets having lost the ship in the first place.
    expect(outcome(2, 0)).toBeGreaterThan(outcome(0, 2));
    // A single rescue never pays more than abandoning the whole convoy's crews
    // would cost, so going back for people stays a mitigation, not a strategy.
    expect(CAMPAIGN.confidencePerCrewRescued).toBeLessThan(
      Math.abs(CAMPAIGN.confidenceCrewLostRate),
    );
  });

  it('EVERY ordinary sinking leaves a crew in the water', () => {
    // Survivor generation used to be a coin flip, which made the beat feel
    // arbitrary — two identical losses, one with a crew to save and one
    // without, and nothing on screen explaining the difference.
    const { state, rng } = quietRun(1);
    const victims = state.ships.slice(0, 4);
    for (const ship of victims) {
      ship.spawned = true;
      ship.hp = 1;
    }
    // Sink them with ordinary damage, one at a time.
    let sunk = 0;
    for (const ship of victims) {
      const before = state.stats.survivorsSpawned;
      // A missile strike is the plainest ordinary cause there is.
      ship.x = 600;
      ship.y = WORLD.lanes[1];
      state.threats.push({
        id: 970_000 + sunk,
        kind: 'missile',
        x: ship.x,
        y: ship.y,
        vx: 0,
        vy: 0,
        speed: 60,
        alive: true,
        revealed: true,
        lowSig: false,
        claimedByInterceptor: false,
        targetX: ship.x,
        targetY: ship.y,
      });
      stepTransit(state, [], rng);
      if (!ship.alive) {
        sunk++;
        expect(state.stats.survivorsSpawned).toBe(before + 1);
      }
    }
    expect(sunk).toBeGreaterThan(0);
    expect(state.stats.survivorsSpawned).toBe(sunk);
    // One area per lost hull, each named for the ship that went down.
    expect(state.survivors).toHaveLength(sunk);
    for (const area of state.survivors) expect(area.shipName.length).toBeGreaterThan(0);
  });

  it('a hull sunk by boat gunfire leaves survivors too', () => {
    // Regression: boat gunfire used to bypass the damage path that spawns
    // survivors entirely, so those sinkings silently never left a crew.
    const { state, rng } = quietRun(1);
    const ship = state.ships[0];
    ship.spawned = true;
    ship.x = 600;
    ship.y = WORLD.lanes[1];
    ship.hp = 1;
    state.boatShots.push({
      id: 980_001,
      ownerBoatId: 1,
      targetShipId: ship.id,
      variant: 'smallArms',
      x: ship.x - 5,
      y: ship.y,
      vx: 200,
      vy: 0,
      targetX: ship.x + 40,
      targetY: ship.y,
      damage: 50,
      size: 2,
      alive: true,
      expireIn: 0.35,
    });
    stepTransit(state, [], rng);
    expect(ship.alive).toBe(false);
    expect(state.stats.survivorsSpawned).toBe(1);
  });

  it('timeout losses at transit end leave no survivors (no round left to rescue in)', () => {
    const { state, rng } = quietRun(1);
    // Strand one hull dead in the water for the whole transit — it can never
    // deliver, so the round runs to the time cap and she is lost at sea.
    const stranded = state.ships[0];
    stranded.disabledUntil = Number.POSITIVE_INFINITY;
    let guard = 0;
    while (!state.over && guard++ < ticks(SIM.maxTransitTime) + 20) stepTransit(state, [], rng);
    expect(state.over).toBe(true);
    expect(
      state.events.some((e) => e.type === 'shipLost' && e.cause === 'timeout'),
    ).toBe(true);
    // No other loss cause existed in this quiet transit, so any survivor area
    // would have to have come from the timeout — and none may.
    expect(state.stats.survivorsSpawned).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The mandatory technology draft
// ---------------------------------------------------------------------------

describe('technology draft', () => {
  it('always offers at least the base choices after a successful round', () => {
    const c = newRegionalRun('draft-base', FIRST_REGION);
    const draft = generateDraft(c, {}, makeRng('draft-base'));
    expect(draft.options.length).toBe(2);
    expect(draft.recoveredUnits).toBe(0);
  });

  it('strong recovery produces the third option', () => {
    const c = newRegionalRun('draft-third', FIRST_REGION);
    // 3+ units → third-choice chance saturates at 1.0 with the tuned rate.
    const draft = generateDraft(c, { missiles: 2, mines: 1 }, makeRng('draft-third'));
    expect(draft.recoveredUnits).toBe(3);
    expect(draft.options.length).toBe(3);
  });

  it('never offers entries whose prerequisites are not held', () => {
    const c = newRegionalRun('draft-prereq', FIRST_REGION);
    for (let i = 0; i < 30; i++) {
      const draft = generateDraft(c, { missiles: 3 }, makeRng(`prereq-${i}`));
      const owned = effectiveResearch(c.completedResearch);
      for (const id of draft.options) {
        for (const req of RESEARCH_INDEX[id].requires) {
          expect(owned.has(req), `${id} requires ${req}`).toBe(true);
        }
      }
    }
  });

  it('is region-aware: region 1 never offers counters for absent families', () => {
    const c = newRegionalRun('draft-region', FIRST_REGION);
    const region = regionDef(FIRST_REGION);
    for (let i = 0; i < 30; i++) {
      const draft = generateDraft(c, { missiles: 3 }, makeRng(`region-${i}`));
      for (const id of draft.options) {
        const counters = RESEARCH_INDEX[id].branch.counters;
        if (counters.length === 0) continue; // generic survivability is fine
        expect(
          counters.some((k) => region.enemyBranches.includes(k)),
          `${id} counters ${counters.join(',')} — none present in region 1`,
        ).toBe(true);
      }
    }
    // Depth charges (torpedo counter) must be pool-ineligible in region 1.
    const pool = draftPool(c, {});
    expect(pool.some((p) => p.entry.branch.id === 'depthCharges')).toBe(false);
    expect(pool.some((p) => p.entry.branch.id === 'deckGun')).toBe(false);
  });

  it('wreckage from a family weights the draft toward its counters', () => {
    const c = newRegionalRun('draft-weight', FIRST_REGION);
    const pool = draftPool(c, { mines: 4 });
    const mineCounter = pool.find((p) => p.entry.branch.counters.includes('mines'));
    const generic = pool.find((p) => p.entry.branch.counters.length === 0);
    expect(mineCounter).toBeDefined();
    expect(generic).toBeDefined();
    expect(mineCounter!.weight).toBeGreaterThan(generic!.weight);
    // And statistically, mine counters dominate the offers.
    let mineOffers = 0;
    let total = 0;
    for (let i = 0; i < 60; i++) {
      const draft = generateDraft(c, { mines: 4 }, makeRng(`weight-${i}`));
      for (const id of draft.options) {
        total++;
        if (RESEARCH_INDEX[id].branch.counters.includes('mines')) mineOffers++;
      }
    }
    expect(mineOffers / total).toBeGreaterThan(0.3);
  });

  it('weights toward threats that are actually hurting the run', () => {
    // The reported failure: mines encountered for several rounds running, and
    // the basic mine counter never offered. Wreckage alone was the only signal,
    // so a player without escorts to spare for salvage never got the steer.
    const c = newRegionalRun('draft-pressure', FIRST_REGION);
    c.round = 4;
    c.threatPressure.mines = {
      rounds: 3,
      streak: 3,
      damage: 260,
      kills: 2,
      lastSeenRound: 3,
    };
    const pool = draftPool(c, {}); // NO wreckage recovered at all
    const mineCounter = pool.find((p) => p.entry.branch.counters.includes('mines'));
    const generic = pool.find((p) => p.entry.branch.counters.length === 0);
    expect(mineCounter).toBeDefined();
    expect(generic).toBeDefined();
    expect(mineCounter!.weight).toBeGreaterThan(generic!.weight * 3);
  });

  it('an unanswered threat outweighs one the player has already solved', () => {
    const c = newRegionalRun('draft-answered', FIRST_REGION);
    c.round = 4;
    const pressure = { rounds: 3, streak: 3, damage: 200, kills: 1, lastSeenRound: 3 };
    c.threatPressure.mines = { ...pressure };
    c.threatPressure.missiles = { ...pressure };
    const weightFor = (family: string, pool: ReturnType<typeof draftPool>): number => {
      const entries = pool.filter((p) => p.entry.branch.counters.includes(family as never));
      return Math.max(...entries.map((p) => p.weight));
    };
    const before = draftPool(c, {});
    const mineBefore = weightFor('mines', before);
    // Now answer the mine threat and re-price the pool.
    c.completedResearch.push('mineSonar.base');
    const after = draftPool(c, {});
    expect(weightFor('mines', after)).toBeLessThan(mineBefore);
  });

  it('steps aside from entries it put on the table a round or two ago', () => {
    const c = newRegionalRun('draft-recency', FIRST_REGION);
    c.round = 5;
    c.threatPressure.mines = { rounds: 3, streak: 3, damage: 200, kills: 1, lastSeenRound: 4 };
    const fresh = draftPool(c, {});
    const target = fresh.find((p) => p.entry.branch.counters.includes('mines'))!;
    c.lastOfferedRound[target.entry.def.id] = c.round; // offered just now
    const after = draftPool(c, {});
    const same = after.find((p) => p.entry.def.id === target.entry.def.id)!;
    expect(same.weight).toBeLessThan(target.weight);
  });

  it('PITY RULE: guarantees a basic counter for a repeated, unanswered threat', () => {
    const c = newRegionalRun('draft-pity', FIRST_REGION);
    c.round = 5;
    // Mined for four rounds running, still no answer, nothing offered yet.
    c.threatPressure.mines = { rounds: 4, streak: 4, damage: 300, kills: 3, lastSeenRound: 4 };
    const candidates = pityCandidates(c);
    expect(candidates.some((p) => p.family === 'mines')).toBe(true);

    // Across many independent rolls the guarantee must hold EVERY time — that
    // is what makes it a guarantee rather than a nudge.
    for (let i = 0; i < 25; i++) {
      const run = newRegionalRun(`pity-${i}`, FIRST_REGION);
      run.round = 5;
      run.threatPressure.mines = { rounds: 4, streak: 4, damage: 300, kills: 3, lastSeenRound: 4 };
      const draft = generateDraft(run, {}, makeRng(`pity-roll-${i}`));
      const offeredMineCounter = draft.options.some((id) =>
        RESEARCH_INDEX[id].branch.counters.includes('mines'),
      );
      expect(offeredMineCounter, `roll ${i} offered ${draft.options.join(', ')}`).toBe(true);
      expect(draft.pityBranches).toContain('mines');
    }
  });

  it('the pity rule leaves a real choice — it never fills the whole draft', () => {
    const c = newRegionalRun('draft-pity-room', FIRST_REGION);
    c.round = 5;
    c.threatPressure.mines = { rounds: 4, streak: 4, damage: 300, kills: 3, lastSeenRound: 4 };
    c.threatPressure.missiles = { rounds: 4, streak: 4, damage: 300, kills: 3, lastSeenRound: 4 };
    const draft = generateDraft(c, {}, makeRng('pity-room'));
    expect(draft.options.length).toBeGreaterThanOrEqual(2);
    expect((draft.pityBranches ?? []).length).toBeLessThanOrEqual(DRAFT.pityMaxPerDraft);
    expect(new Set(draft.options).size).toBe(draft.options.length); // no duplicates
  });

  it('does not fire the pity rule once the threat has an answer', () => {
    const c = newRegionalRun('draft-pity-answered', FIRST_REGION);
    c.round = 5;
    c.threatPressure.mines = { rounds: 4, streak: 4, damage: 300, kills: 3, lastSeenRound: 4 };
    expect(hasCounterFor(c, 'mines')).toBe(false);
    c.completedResearch.push('mineSonar.base');
    expect(hasCounterFor(c, 'mines')).toBe(true);
    expect(pityCandidates(c).some((p) => p.family === 'mines')).toBe(false);
  });

  it('granted built-ins do not count as having answered a threat', () => {
    // Every run starts holding the granted entries. Counting them would report
    // every threat as already answered from round 1, and the unanswered-threat
    // weighting (and the pity rule with it) would never fire at all.
    const c = newRegionalRun('draft-granted', FIRST_REGION);
    expect(hasCounterFor(c, 'mines')).toBe(false);
    expect(hasCounterFor(c, 'missiles')).toBe(false);
  });

  it('does not fire the pity rule for a threat that has stopped appearing', () => {
    const c = newRegionalRun('draft-pity-stale', FIRST_REGION);
    c.round = 20; // long since
    c.threatPressure.mines = { rounds: 4, streak: 0, damage: 300, kills: 3, lastSeenRound: 4 };
    expect(pityCandidates(c).some((p) => p.family === 'mines')).toBe(false);
  });

  it('keeps its randomness — the same pressure does not always yield the same table', () => {
    const offer = (seed: string): string => {
      const c = newRegionalRun(`variety-${seed}`, FIRST_REGION);
      c.round = 3;
      c.threatPressure.mines = { rounds: 1, streak: 1, damage: 40, kills: 0, lastSeenRound: 2 };
      return generateDraft(c, {}, makeRng(seed)).options.join('|');
    };
    const seen = new Set(Array.from({ length: 14 }, (_, i) => offer(`seed-${i}`)));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('records threat pressure from what the round actually did', () => {
    const c = newRegionalRun('pressure-recorded', FIRST_REGION);
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    let guard = 0;
    while (!state.over && guard++ < ticks(SIM.maxTransitTime) + 10) stepTransit(state, [], rng);
    state.stats.enemyBranch.mines = { damage: 120, kills: 1 };
    resolveTransit(c, state);
    const p = c.threatPressure.mines;
    expect(p).toBeDefined();
    expect(p.rounds).toBe(1);
    expect(p.damage).toBe(120);
    expect(p.kills).toBe(1);
    expect(p.lastSeenRound).toBe(1);
  });

  it('the pick activates immediately and cannot be repeated or skipped', () => {
    const c = newRegionalRun('draft-pick', FIRST_REGION);
    c.pendingDraft = generateDraft(c, {}, makeRng('pick'));
    c.phase = 'draft';
    const [a] = c.pendingDraft.options;
    // Cannot dismiss a non-empty draft (mandatory).
    expect(dismissEmptyDraft(c)).toBe(false);
    // Cannot take something that was not offered.
    const notOffered = Object.keys(RESEARCH_INDEX).find(
      (id) => !c.pendingDraft!.options.includes(id) && !RESEARCH_INDEX[id].def.granted,
    )!;
    expect(selectDraftOption(c, notOffered)).toBe(false);
    expect(selectDraftOption(c, a)).toBe(true);
    expect(c.completedResearch.length).toBeGreaterThan(0);
    expect(c.pendingDraft).toBeNull();
    expect(c.phase).toBe('prep');
    // No second pick from the same draft.
    expect(selectDraftOption(c, a)).toBe(false);
  });

  it('an exhausted catalogue yields an empty draft that may be dismissed', () => {
    const c = newRegionalRun('draft-empty', FIRST_REGION);
    // Own everything eligible: drain the pool via repeated full drafts.
    for (let guard = 0; guard < 200; guard++) {
      const pool = draftPool(c, {});
      if (pool.length === 0) break;
      c.completedResearch.push(pool[0].entry.def.id);
    }
    expect(draftPool(c, {}).length).toBe(0);
    const draft = generateDraft(c, {}, makeRng('empty'));
    expect(draft.options).toHaveLength(0);
    c.pendingDraft = draft;
    c.phase = 'draft';
    expect(dismissEmptyDraft(c)).toBe(true);
    expect(c.phase).toBe('prep');
  });

  it('a full round resolution earns a draft; a fatal round does not', () => {
    const alive = newRegionalRun('draft-earned', FIRST_REGION);
    playEmptyRound(alive);
    expect(alive.pendingDraft).not.toBeNull();
    expect(alive.pendingDraft!.round).toBe(1);

    const dying = newRegionalRun('draft-denied', FIRST_REGION);
    dying.quota = { roundsLeft: 1, pointsNeeded: 1_000_000, pointsEarned: 0 };
    playEmptyRound(dying);
    expect(dying.campaignOver).toBe(true);
    expect(dying.pendingDraft).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Commander Abilities: bounded loadout + central effect application
// ---------------------------------------------------------------------------

describe('commander abilities', () => {
  it('unlocks spend XP and are permanent; the loadout is bounded', () => {
    const p = newProfile();
    // Zero-cost standing commissions arrive unlocked.
    expect(p.unlockedAbilities).toContain('salvageTeams');
    expect(unlockBlockReason(p, 'salvageTeams')).toBe('Already unlocked');
    // Cannot afford warChest at 0 XP.
    expect(unlockBlockReason(p, 'warChest')).toMatch(/Requires/);
    expect(unlockAbility(p, 'warChest')).toBe(false);
    p.xp = COMMANDER_ABILITIES.warChest.xpCost;
    expect(unlockAbility(p, 'warChest')).toBe(true);
    expect(p.xp).toBe(0); // spent
    // Loadout rules: unlocked only, unique, slot- and point-capped.
    expect(setLoadout(p, ['steadyHands'])).toBe(false); // not unlocked
    expect(setLoadout(p, ['salvageTeams', 'salvageTeams'])).toBe(false);
    expect(setLoadout(p, ['salvageTeams', 'rescueDoctrine', 'warChest'])).toBe(true);
    // Point budget: salvage(8) + rescue(6) + warChest(10) = 24 ≤ 25; adding a
    // fourth breaks the slot cap first.
    p.unlockedAbilities.push('quartermaster');
    expect(
      loadoutBlockReason(p, ['salvageTeams', 'rescueDoctrine', 'warChest', 'quartermaster']),
    ).toMatch(/At most/);
  });

  it('sanitizedLoadout drops anything invalid rather than refusing to sail', () => {
    const p = newProfile();
    p.loadout = ['salvageTeams', 'ghostAbility', 'salvageTeams', 'steadyHands'];
    expect(sanitizedLoadout(p)).toEqual(['salvageTeams']); // ghost + dupe + locked dropped
  });

  it('applies combat modifiers centrally, after tech/equipment derivation', () => {
    const bare = deriveEffects([], { escortModules: [], baseModules: [] });
    const steady = deriveEffects([], { escortModules: [], baseModules: [] }, ['steadyHands']);
    const mods = COMMANDER_ABILITIES.steadyHands.mods;
    expect(steady.escort.accuracy).toBeCloseTo(bare.escort.accuracy + mods.interceptAccuracy!, 5);
    expect(steady.base.accuracy).toBeCloseTo(bare.base.accuracy + mods.interceptAccuracy!, 5);
    const salvage = deriveEffects([], { escortModules: [], baseModules: [] }, ['salvageTeams']);
    expect(salvage.recovery.wreckageRateMult).toBeCloseTo(
      COMMANDER_ABILITIES.salvageTeams.mods.wreckageRate!,
      5,
    );
  });

  it('salvage teams measurably speed up recovery in the sim', () => {
    const recoverTime = (abilities: string[]): number => {
      const c = newRegionalRun('rate', FIRST_REGION, abilities);
      const { state, rng } = createRoundTransit(c, planCurrentRound(c));
      state.spawnQueue = [];
      state.threats = [];
      const field = injectWreckage(state);
      stationEscort(state, 0, field.x, field.y);
      let steps = 0;
      while (!field.recovered && steps++ < ticks(60)) stepTransit(state, [], rng);
      return steps;
    };
    expect(recoverTime(['salvageTeams'])).toBeLessThan(recoverTime([]));
  });

  it('applies economy modifiers to run start, repairs and munitions', () => {
    const plain = newRegionalRun('econ-plain', FIRST_REGION);
    const funded = newRegionalRun('econ-funded', FIRST_REGION, ['warChest']);
    expect(funded.cash).toBe(plain.cash + COMMANDER_ABILITIES.warChest.mods.startCash!);

    const shipwright = newRegionalRun('econ-yard', FIRST_REGION, ['shipwright']);
    plain.pendingDamage = 100;
    shipwright.pendingDamage = 100;
    expect(repairCost(shipwright)).toBeLessThan(repairCost(plain));

    const quartermaster = newRegionalRun('econ-ammo', FIRST_REGION, ['quartermaster']);
    expect(ammoUnitCost(quartermaster)).toBeLessThan(ECONOMY.ammoCost);
    expect(ammoUnitCost(plain)).toBe(ECONOMY.ammoCost);
  });

  it('the run snapshots the loadout so mid-run profile edits change nothing', () => {
    const p = newProfile();
    setLoadout(p, ['salvageTeams']);
    const run = newRegionalRun('snapshot', FIRST_REGION, sanitizedLoadout(p));
    setLoadout(p, []);
    expect(run.commanderAbilities).toEqual(['salvageTeams']);
  });
});
