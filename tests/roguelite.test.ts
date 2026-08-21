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
  moduleStock,
  repairCost,
  resolveTransit,
  setComposition,
} from '../src/sim/campaign';
import {
  applyRunToProfile,
  loadoutBlockReason,
  newProfile,
  recordRunStart,
  regionUnlocked,
  sanitizedLoadout,
  setLoadout,
  unlockAbility,
  unlockBlockReason,
} from '../src/sim/commander';
import { migrateProfile } from '../src/platform/save';
import {
  counterCandidates,
  MODULE_CATALOGUE,
  counterSlotPool,
  dismissEmptyDraft,
  draftOptionKey,
  draftOptionBranch,
  draftPool,
  familyCoverage,
  generateDraft,
  hasCounterFor,
  measureRoundCoverage,
  recordThreatCoverage,
  selectDraftOption,
} from '../src/sim/draft';
import { deriveEffects, stepTransit } from '../src/sim/transit';
import { evolveEnemy, newEvolution } from '../src/sim/evolution';
import { COMMANDER_ABILITIES } from '../src/data/commanderAbilities';
import { FIRST_REGION, REGION_ORDER, REGIONS, regionDef } from '../src/data/regions';
import { RESEARCH_INDEX, effectiveResearch } from '../src/data/counters';
import { CAMPAIGN, COMMANDER, DRAFT, ECONOMY, SIM, SURVIVORS, WORLD, WRECKAGE } from '../src/data/tuning';
import type {
  CampaignState,
  DraftOption,
  RoundMetrics,
  SurvivorArea,
  TransitState,
  TransitStats,
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

  it('the dev unlock opens every region without granting any of them', () => {
    // Testing affordance, behind Dev Mode (itself behind ?dev). The two ideas
    // have to stay separate: "show me everything" must not become "you have
    // earned everything", or flipping it off would silently eat progress.
    const profile = newProfile();
    expect(regionUnlocked(profile, FIRST_REGION)).toBe(true);
    for (const id of REGION_ORDER.filter((r) => r !== FIRST_REGION)) {
      expect({ id, open: regionUnlocked(profile, id) }).toEqual({ id, open: false });
    }

    profile.allRegionsUnlocked = true;
    for (const id of REGION_ORDER) {
      expect({ id, open: regionUnlocked(profile, id) }).toEqual({ id, open: true });
    }
    // Nothing was granted — the earned ladder is untouched.
    expect(profile.unlockedRegions).toEqual([FIRST_REGION]);

    // ...and turning it off restores exactly what was earned.
    profile.allRegionsUnlocked = false;
    for (const id of REGION_ORDER.filter((r) => r !== FIRST_REGION)) {
      expect({ id, open: regionUnlocked(profile, id) }).toEqual({ id, open: false });
    }
  });

  it('backfills the dev unlock onto a profile saved before it existed', () => {
    // Old saves heal forward rather than being rejected — same rule the rest
    // of the profile migration follows.
    const legacy = newProfile() as unknown as Record<string, unknown>;
    delete legacy.allRegionsUnlocked;
    const healed = migrateProfile(legacy);
    expect(healed).not.toBeNull();
    expect(healed!.allRegionsUnlocked).toBe(false);
    expect(regionUnlocked(healed!, FIRST_REGION)).toBe(true);
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

/** Does this reward answer that enemy family? Works across every category, so
 *  a test can ask the question without caring whether the answer arrived as an
 *  upgrade or as a piece of equipment. */
function answersFamily(option: DraftOption, family: string): boolean {
  const branch = draftOptionBranch(option);
  return !!branch && (branch.counters as readonly string[]).includes(family);
}

/** Same question, asked of a pool candidate. */
function candidateAnswers(cand: { branch: { counters: readonly string[] } | null }, family: string): boolean {
  return !!cand.branch && cand.branch.counters.includes(family);
}

/** A candidate that counters nothing — damage control, logistics, ordnance. */
function candidateGeneric(cand: { branch: { counters: readonly string[] } | null }): boolean {
  return !cand.branch || cand.branch.counters.length === 0;
}

describe('technology draft', () => {
  it('offers a table with nothing recovered, and only one thing to take from it', () => {
    const c = newRegionalRun('draft-base', FIRST_REGION);
    const draft = generateDraft(c, {}, makeRng('draft-base'));
    expect(draft.recoveredUnits).toBe(0);
    expect(draft.picksLeft).toBe(DRAFT.basePicks);
    expect(draft.options.length).toBeGreaterThanOrEqual(DRAFT.baseChoices);
  });

  it('recovery buys PICKS, and the table stays wider than them', () => {
    // Salvage used to buy a wider menu the player still only got one bite of,
    // which is a reward you cannot feel. It now buys another technology — and
    // the table grows faster than the picks do, so a rich draft is a bigger
    // decision rather than a hand-out.
    const c = newRegionalRun('draft-third', FIRST_REGION);
    const draft = generateDraft(c, { missiles: 2, mines: 1 }, makeRng('draft-third'));
    expect(draft.recoveredUnits).toBe(3);
    expect(draft.picksLeft).toBe(2);
    expect(draft.options.length).toBeGreaterThan(draft.picksLeft);
  });

  it('caps the picks however much is recovered', () => {
    const c = newRegionalRun('draft-cap', FIRST_REGION);
    const draft = generateDraft(c, { missiles: 40 }, makeRng('draft-cap'));
    expect(draft.picksLeft).toBe(DRAFT.maxPicks);
    expect(draft.options.length).toBeGreaterThan(DRAFT.maxPicks);
  });

  it('a multi-pick draft stays open until its picks are spent', () => {
    const c = newRegionalRun('draft-multi', FIRST_REGION);
    c.pendingDraft = generateDraft(c, { missiles: 3 }, makeRng('draft-multi'));
    c.phase = 'draft';
    const draft = c.pendingDraft;
    expect(draft.picksLeft).toBe(2);
    const first = draft.options[0];
    expect(selectDraftOption(c, first)).toBe(true);
    // Still open, one pick down, and the card taken is off the table.
    expect(c.pendingDraft).not.toBeNull();
    expect(c.pendingDraft!.picksLeft).toBe(1);
    expect(c.pendingDraft!.options).not.toContainEqual(first);
    expect(selectDraftOption(c, c.pendingDraft!.options[0])).toBe(true);
    expect(c.pendingDraft).toBeNull();
    expect(c.phase).toBe('prep');
  });

  it('never offers entries whose prerequisites are not held', () => {
    const c = newRegionalRun('draft-prereq', FIRST_REGION);
    for (let i = 0; i < 30; i++) {
      const draft = generateDraft(c, { missiles: 3 }, makeRng(`prereq-${i}`));
      const owned = effectiveResearch(c.completedResearch);
      for (const option of draft.options) {
        if (option.kind !== 'upgrade' && option.kind !== 'asset') continue;
        for (const req of RESEARCH_INDEX[option.id].requires) {
          expect(owned.has(req), `${option.id} requires ${req}`).toBe(true);
        }
      }
    }
  });

  it('is region-aware: region 1 never offers counters for absent families', () => {
    const c = newRegionalRun('draft-region', FIRST_REGION);
    const region = regionDef(FIRST_REGION);
    for (let i = 0; i < 30; i++) {
      const draft = generateDraft(c, { missiles: 3 }, makeRng(`region-${i}`));
      for (const option of draft.options) {
        const branch = draftOptionBranch(option);
        if (!branch || branch.counters.length === 0) continue; // generic is fine
        expect(
          branch.counters.some((k) => region.enemyBranches.includes(k)),
          `${draftOptionKey(option)} counters ${branch.counters.join(',')} — absent in region 1`,
        ).toBe(true);
      }
    }
    // Depth charges (torpedo counter) must be pool-ineligible in region 1.
    const pool = draftPool(c, {});
    expect(pool.some((p) => p.branch?.id === 'depthCharges')).toBe(false);
    expect(pool.some((p) => p.branch?.id === 'deckGun')).toBe(false);
  });

  it('wreckage from a family weights the draft toward its counters', () => {
    const c = newRegionalRun('draft-weight', FIRST_REGION);
    const pool = draftPool(c, { mines: 4 });
    const mineCounter = pool.find((p) => candidateAnswers(p, 'mines'));
    const generic = pool.find((p) => candidateGeneric(p));
    expect(mineCounter).toBeDefined();
    expect(generic).toBeDefined();
    expect(mineCounter!.weight).toBeGreaterThan(generic!.weight);
    // And statistically, mine counters dominate the offers.
    let mineOffers = 0;
    let total = 0;
    for (let i = 0; i < 60; i++) {
      const draft = generateDraft(c, { mines: 4 }, makeRng(`weight-${i}`));
      for (const option of draft.options) {
        total++;
        if (answersFamily(option, 'mines')) mineOffers++;
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
    const mineCounter = pool.find((p) => candidateAnswers(p, 'mines'));
    const generic = pool.find((p) => candidateGeneric(p));
    expect(mineCounter).toBeDefined();
    expect(generic).toBeDefined();
    // A specific answer to what is actually killing you still beats a general
    // one — but only by a margin, not by an order of magnitude. See the
    // starvation test below for the other half of that.
    expect(mineCounter!.weight).toBeGreaterThan(generic!.weight);
  });

  it('SURVIVABILITY: armour is priced on total danger, not starved for lacking a target', () => {
    // Everything else in the weighting prices a reward against the family it
    // answers, which left reinforced hull and compartmentalization with no
    // signal at all: a flat 1 against 5-30 for a counter under pressure. A
    // 192-campaign sweep drafted Reinforced Hull ONCE and Compartmentalization
    // never. What makes armour relevant is being hurt AT ALL.
    const quiet = newRegionalRun('armour-quiet', FIRST_REGION);
    quiet.round = 4;
    const calm = draftPool(quiet, {}).find((p) => candidateGeneric(p))!;
    expect(calm).toBeDefined();

    const bleeding = newRegionalRun('armour-bleeding', FIRST_REGION);
    bleeding.round = 4;
    bleeding.threatPressure.mines = {
      rounds: 3,
      streak: 3,
      damage: 260,
      kills: 3,
      lastSeenRound: 3,
    };
    bleeding.threatPressure.missiles = {
      rounds: 3,
      streak: 3,
      damage: 300,
      kills: 2,
      lastSeenRound: 3,
    };
    const hurt = draftPool(bleeding, {}).find((p) => candidateGeneric(p))!;
    // A run taking losses across the board values armour far more than a quiet
    // one does, which is the whole signal that was missing.
    expect(hurt.weight).toBeGreaterThan(calm.weight * 2);

    // And it is genuinely on the table: reinforced hull reaches the pool.
    const hasHull = draftPool(bleeding, {}).some(
      (p) => draftOptionKey(p.option) === 'module:cargo:reinforcedHull',
    );
    expect(hasHull).toBe(true);
  });

  it('an unanswered threat outweighs one the player is actually stopping', () => {
    const c = newRegionalRun('draft-answered', FIRST_REGION);
    c.round = 4;
    const pressure = { rounds: 3, streak: 3, damage: 200, kills: 1, lastSeenRound: 3 };
    c.threatPressure.mines = { ...pressure };
    c.threatPressure.missiles = { ...pressure };
    const weightFor = (family: string, pool: ReturnType<typeof draftPool>): number => {
      // Parens matter: `??` binds looser than the method call that follows it,
      // so `p.branch?.counters ?? [].includes(family)` was actually
      // `(p.branch?.counters) ?? ([].includes(family))` — `[].includes` is
      // always false on a literal empty array, so the `??` never fired and this
      // silently kept EVERY branched candidate regardless of family. It read as
      // passing only because the pool's overall max happened to sit on a mines
      // entry; a later change to automation-tactic weighting (which touches
      // candidates outside the mines branch) was enough to break that
      // coincidence and expose the bug as a failing assertion.
      const entries = pool.filter((p) => (p.branch?.counters ?? []).includes(family as never));
      return Math.max(...entries.map((p) => p.weight));
    };
    const mineBefore = weightFor('mines', draftPool(c, {}));
    // Now start actually sweeping the minefield and re-price the pool.
    c.threatCoverage.mines = {
      ratio: 0.9,
      fielded: 10,
      neutralized: 9,
      lastMeasuredRound: 3,
    };
    expect(weightFor('mines', draftPool(c, {}))).toBeLessThan(mineBefore);
  });

  it('AUTOMATION: is not starved by the coverage gap the way an ordinary upgrade is', () => {
    // escortInterceptor.localAuto (kind: 'automation') and
    // escortInterceptor.precisionGuidance (an ordinary accuracy upgrade) sit in
    // the same branch, at the same depth, both non-entry. Everything the
    // coverage-gap system prices them on is identical; the only difference is
    // the automation flag. A well-covered missile threat should price DOWN the
    // accuracy upgrade — more accuracy on a branch already stopping most of
    // what it sees is worth less — while the automation tactic keeps its value,
    // because what it buys (freeing the player's attention) does not shrink
    // just because the branch got good at its job.
    const c = newRegionalRun('draft-automation', FIRST_REGION);
    c.round = 4;
    c.threatCoverage.missiles = { ratio: 0.9, fielded: 20, neutralized: 18, lastMeasuredRound: 3 };
    const pool = draftPool(c, {});
    const auto = pool.find((p) => draftOptionKey(p.option) === 'escortInterceptor.localAuto');
    const accuracy = pool.find(
      (p) => draftOptionKey(p.option) === 'escortInterceptor.precisionGuidance',
    );
    expect(auto).toBeDefined();
    expect(accuracy).toBeDefined();
    expect(auto!.weight).toBeGreaterThan(accuracy!.weight);
    // And it is a real premium, not a rounding artefact of unrelated factors —
    // matches DRAFT.automationTacticMult exactly, since these two candidates
    // are identical on every other axis the weighing function reads.
    expect(auto!.weight / accuracy!.weight).toBeCloseTo(DRAFT.automationTacticMult, 5);
  });

  it('COVERAGE: scores what the round stopped, not what the fleet owns', () => {
    const stats = {
      missilesSpawned: 6,
      missilesIntercepted: 5,
      minesTotal: 4,
      minesRevealed: 2,
      minesSwept: 1,
      torpedoesLaunched: 0,
      torpedoesDestroyed: 0,
      boatsLaunched: 4,
      boatsSunk: 1,
      reconPlanes: 0,
      disablingDrones: 0,
      aircraftDowned: 0,
    } as unknown as TransitStats;
    const m = measureRoundCoverage(stats);
    expect(m.missiles).toEqual({ fielded: 6, neutralized: 5 });
    // One mine destroyed outright, one revealed-and-avoided at partial credit.
    expect(m.mines).toEqual({ fielded: 4, neutralized: 1 + DRAFT.coverageRevealCredit });
    expect(m.attackBoats).toEqual({ fielded: 4, neutralized: 1 });
    // Nothing fielded, nothing measured — an absent branch is not a failure.
    expect(m.torpedoes).toBeUndefined();
  });

  it('the first measurement is taken as-is, not smoothed up from zero', () => {
    const c = newRegionalRun('coverage-seed', FIRST_REGION);
    const stats = { missilesSpawned: 6, missilesIntercepted: 5 } as unknown as TransitStats;
    recordThreatCoverage(c, stats, 1);
    expect(familyCoverage(c, 'missiles')).toBeCloseTo(5 / 6, 5);
  });

  it('detection alone never closes a threat — only removing it does', () => {
    const c = newRegionalRun('draft-detect', FIRST_REGION);
    // Mine sonar SEES mines. It does not sweep them, and the draft must not
    // treat the subject as closed because the player can now watch the mine
    // that is about to sink them.
    c.completedResearch.push('mineSonar.base');
    expect(hasCounterFor(c, 'mines')).toBe(false);
    c.completedResearch.push('mcmDrones.base');
    expect(hasCounterFor(c, 'mines')).toBe(true);
  });

  it('COUNTER SLOT: every draft answers the worst-covered live threat', () => {
    // Across many independent rolls the guarantee must hold EVERY time — that
    // is what makes it a guarantee rather than a nudge.
    for (let i = 0; i < 25; i++) {
      const run = newRegionalRun(`counter-${i}`, FIRST_REGION);
      run.round = 5;
      run.threatPressure.mines = { rounds: 4, streak: 4, damage: 300, kills: 3, lastSeenRound: 4 };
      const draft = generateDraft(run, {}, makeRng(`counter-roll-${i}`));
      const offeredMineCounter = draft.options.some((o) => answersFamily(o, 'mines'));
      const shown = draft.options.map(draftOptionKey).join(', ');
      expect(offeredMineCounter, `roll ${i} offered ${shown}`).toBe(true);
      expect(draft.counterFamily).toBe('mines');
      expect(draft.options.map(draftOptionKey)).toContain(draft.counterOption);
    }
  });

  it('REGRESSION: an A-10 upgrade no longer marks mines and boats solved', () => {
    // The logged failure. Taking `warthog.extendedLoiter` — a longer strafing
    // pass — used to flip BOTH mines and attack boats to answered, because the
    // test was a boolean over the catalogue rather than a measurement of the
    // water. That permanently disabled the guarantee through nine more mine
    // kills and ten more boat kills, and the run was never once offered a
    // minesweeping drone, a deck gun or an anti-boarding fit.
    const c = newRegionalRun('regression-warthog', 'pirateNarrows');
    c.round = 6;
    c.completedResearch.push('warthog.extendedLoiter');
    c.threatPressure.mines = { rounds: 4, streak: 4, damage: 200, kills: 5, lastSeenRound: 5 };
    c.threatPressure.attackBoats = {
      rounds: 3,
      streak: 3,
      damage: 180,
      kills: 3,
      lastSeenRound: 5,
    };
    // One gun run against three mines and two boats a round is not an answer,
    // and the measurement says so.
    c.threatCoverage.mines = { ratio: 0.2, fielded: 10, neutralized: 2, lastMeasuredRound: 5 };
    c.threatCoverage.attackBoats = {
      ratio: 0.25,
      fielded: 8,
      neutralized: 2,
      lastMeasuredRound: 5,
    };
    expect(counterCandidates(c).map((p) => p.family)).toContain('mines');

    // And the guarantee holds on every roll, with a REAL answer — not another
    // upgrade to the aircraft that is already failing.
    for (let i = 0; i < 25; i++) {
      const run = newRegionalRun(`regression-${i}`, 'pirateNarrows');
      run.round = 6;
      run.completedResearch.push('warthog.extendedLoiter');
      run.threatPressure.mines = { ...c.threatPressure.mines };
      run.threatPressure.attackBoats = { ...c.threatPressure.attackBoats };
      run.threatCoverage.mines = { ...c.threatCoverage.mines };
      run.threatCoverage.attackBoats = { ...c.threatCoverage.attackBoats };
      const draft = generateDraft(run, {}, makeRng(`regression-roll-${i}`));
      const answered = draft.options.some((option) => {
        const branch = draftOptionBranch(option);
        return (
          !!branch &&
          branch.id !== 'warthog' &&
          (answersFamily(option, 'mines') || answersFamily(option, 'attackBoats'))
        );
      });
      const shown = draft.options.map(draftOptionKey).join(', ');
      expect(answered, `roll ${i} offered ${shown}`).toBe(true);
    }
  });

  it('the counter slot prefers a tool that removes the threat over one that sees it', () => {
    const c = newRegionalRun('counter-role', FIRST_REGION);
    c.round = 5;
    c.threatPressure.mines = { rounds: 4, streak: 4, damage: 300, kills: 3, lastSeenRound: 4 };
    const pool = counterSlotPool(c, 'mines');
    const drones = pool.find((p) => draftOptionKey(p.option) === 'module:escort:mcmDroneLauncher')!;
    const sonar = pool.find((p) => draftOptionKey(p.option) === 'module:cargo:mineSonar')!;
    expect(drones).toBeDefined();
    expect(sonar).toBeDefined();
    expect(drones.weight).toBeGreaterThan(sonar.weight);
  });

  it('a multi-family generalist no longer compounds its way past the specialists', () => {
    // The A-10 answers mines AND attack boats, so the old per-family loop gave
    // it 2.4² while the minesweeping drone — the only thing in the game that
    // destroys a mine — got 2.4×1.8 on its single family. Breadth should earn
    // more weight, but additively (it accumulates pressure from each family),
    // never geometrically.
    const c = newRegionalRun('draft-generalist', 'pirateNarrows');
    c.round = 6;
    c.threatPressure.mines = { rounds: 4, streak: 4, damage: 200, kills: 5, lastSeenRound: 5 };
    c.threatPressure.attackBoats = {
      rounds: 3,
      streak: 3,
      damage: 180,
      kills: 3,
      lastSeenRound: 5,
    };
    const pool = draftPool(c, {});
    const drones = pool.find((p) => draftOptionKey(p.option) === 'module:escort:mcmDroneLauncher')!;
    const bestWarthog = Math.max(
      ...pool.filter((p) => p.branch?.id === 'warthog').map((p) => p.weight),
    );
    expect(drones).toBeDefined();
    expect(drones.weight).toBeGreaterThan(bestWarthog);
  });

  it('the counter slot leaves a real choice — it never fills the whole draft', () => {
    const c = newRegionalRun('counter-room', FIRST_REGION);
    c.round = 5;
    c.threatPressure.mines = { rounds: 4, streak: 4, damage: 300, kills: 3, lastSeenRound: 4 };
    c.threatPressure.missiles = { rounds: 4, streak: 4, damage: 300, kills: 3, lastSeenRound: 4 };
    const draft = generateDraft(c, {}, makeRng('counter-room'));
    expect(draft.options.length).toBeGreaterThanOrEqual(2);
    // Exactly one seat is ever claimed, so the rest of the table stays open.
    expect(
      draft.options.filter((o) => draftOptionKey(o) === draft.counterOption),
    ).toHaveLength(1);
    const keys = draft.options.map(draftOptionKey);
    expect(new Set(keys).size).toBe(keys.length); // no duplicates
  });

  it('the counter slot stands down once the threat is actually being handled', () => {
    const c = newRegionalRun('counter-handled', FIRST_REGION);
    c.round = 5;
    c.threatPressure.mines = { rounds: 4, streak: 4, damage: 300, kills: 3, lastSeenRound: 4 };
    expect(counterCandidates(c).some((p) => p.family === 'mines')).toBe(true);
    c.threatCoverage.mines = { ratio: 0.97, fielded: 30, neutralized: 29, lastMeasuredRound: 4 };
    expect(counterCandidates(c).some((p) => p.family === 'mines')).toBe(false);
  });

  it('granted built-ins do not count as having answered a threat', () => {
    // Every run starts holding the granted entries. Counting them would report
    // every threat as already answered from round 1, and the coverage gap
    // (with the counter slot behind it) would never open at all.
    const c = newRegionalRun('draft-granted', FIRST_REGION);
    expect(hasCounterFor(c, 'mines')).toBe(false);
    expect(hasCounterFor(c, 'missiles')).toBe(false);
    expect(familyCoverage(c, 'mines')).toBe(0);
  });

  it('the counter slot stands down for a threat that has stopped appearing', () => {
    const c = newRegionalRun('counter-stale', FIRST_REGION);
    c.round = 20; // long since
    c.threatPressure.mines = { rounds: 4, streak: 0, damage: 300, kills: 3, lastSeenRound: 4 };
    expect(counterCandidates(c).some((p) => p.family === 'mines')).toBe(false);
  });

  it('records threat coverage from what the round actually stopped', () => {
    const c = newRegionalRun('coverage-recorded', FIRST_REGION);
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    let guard = 0;
    while (!state.over && guard++ < ticks(SIM.maxTransitTime) + 10) stepTransit(state, [], rng);
    state.stats.minesTotal = 4;
    state.stats.minesRevealed = 0;
    state.stats.minesSwept = 0;
    resolveTransit(c, state);
    // Four mines laid, none swept, none even seen: coverage is zero and the
    // gap is wide open.
    expect(familyCoverage(c, 'mines')).toBe(0);
    expect(c.threatCoverage.mines.fielded).toBe(4);
  });

  // -------------------------------------------------------------------------
  // Equipment is drafted, not bought
  // -------------------------------------------------------------------------

  it('EQUIPMENT: drafting a module delivers the unit AND its base technology', () => {
    const c = newRegionalRun('module-grant', 'pirateNarrows');
    const option: DraftOption = { kind: 'module', platform: 'escort', moduleId: 'mcmDroneLauncher' };
    c.pendingDraft = { round: 1, options: [option], recoveredUnits: 0, recoveredByBranch: {}, picksLeft: 1, picksTotal: 1 };
    c.phase = 'draft';
    const cashBefore = c.cash;

    expect(selectDraftOption(c, option)).toBe(true);
    // A unit in the locker, at no cost, ready to fit this round.
    expect(moduleStock(c, 'escort', 'mcmDroneLauncher')).toBe(1);
    expect(c.cash).toBe(cashBefore);
    // And the branch's base node came with it, so its upgrades are now
    // draftable — you can only improve what you actually have.
    expect(c.completedResearch).toContain('mcmDrones.base');
  });

  it('a second unit is more hardware, not more technology', () => {
    const c = newRegionalRun('module-second', 'pirateNarrows');
    const option: DraftOption = { kind: 'module', platform: 'escort', moduleId: 'deckGun' };
    for (let i = 0; i < 2; i++) {
      c.pendingDraft = { round: i + 1, options: [option], recoveredUnits: 0, recoveredByBranch: {}, picksLeft: 1, picksTotal: 1 };
      c.phase = 'draft';
      expect(selectDraftOption(c, option)).toBe(true);
    }
    expect(moduleStock(c, 'escort', 'deckGun')).toBe(2);
    expect(c.completedResearch.filter((id) => id === 'deckGun.base')).toHaveLength(1);
  });

  it('stops offering a module once the run holds the cap for it', () => {
    const c = newRegionalRun('module-cap', 'pirateNarrows');
    c.round = 4;
    c.moduleStock.escort.deckGun = DRAFT.escortModuleCap;
    const pool = draftPool(c, {});
    expect(
      pool.some(
        (p) => p.option.kind === 'module' && p.option.moduleId === 'deckGun',
      ),
    ).toBe(false);
    // One below the cap and it is back on the table.
    c.moduleStock.escort.deckGun = DRAFT.escortModuleCap - 1;
    expect(
      draftPool(c, {}).some(
        (p) => p.option.kind === 'module' && p.option.moduleId === 'deckGun',
      ),
    ).toBe(true);
  });

  it('never offers the same module twice in one draft', () => {
    const c = newRegionalRun('module-dupes', 'pirateNarrows');
    c.round = 5;
    c.threatPressure.mines = { rounds: 4, streak: 4, damage: 300, kills: 3, lastSeenRound: 4 };
    for (let i = 0; i < 40; i++) {
      const draft = generateDraft(c, { mines: 5 }, makeRng(`dupes-${i}`));
      const keys = draft.options.map(draftOptionKey);
      expect(new Set(keys).size, `roll ${i}: ${keys.join(', ')}`).toBe(keys.length);
    }
  });

  it('a branch base node is never offered as a bare upgrade card', () => {
    // The capability IS the hardware. Offering `deckGun.base` on its own would
    // put the IOU straight back: technology saying the fleet has a deck gun
    // while the locker says it does not.
    const c = newRegionalRun('no-bare-base', 'pirateNarrows');
    c.round = 5;
    c.threatPressure.attackBoats = {
      rounds: 4,
      streak: 4,
      damage: 300,
      kills: 3,
      lastSeenRound: 4,
    };
    const pool = draftPool(c, {});
    for (const p of pool) {
      const option = p.option;
      if (option.kind !== 'upgrade' && option.kind !== 'asset') continue;
      expect(MODULE_CATALOGUE.some((m) => m.research === option.id)).toBe(false);
    }
  });

  it('the ability capabilities are in hand from round one, only ordnance is bought', () => {
    const c = newRegionalRun('abilities-free', FIRST_REGION);
    expect(c.warthogUnlocked).toBe(true);
    expect(c.scanUnlocked).toBe(true);
    expect(c.smokeUnlocked).toBe(true);
    expect(c.sonarUnlocked).toBe(true);
    expect(c.hardenedUnlocked).toBe(true);
    // And their base nodes are granted, so they never occupy a draft slot.
    const pool = draftPool(c, {});
    const keys = pool.map((p) => draftOptionKey(p.option));
    expect(keys).not.toContain('warthog.base');
    expect(keys).not.toContain('smokeScreen.base');
  });

  it('ORDNANCE is held back until the run could use it, and never answers a threat', () => {
    const c = newRegionalRun('ordnance-late', FIRST_REGION);
    c.round = 1;
    expect(draftPool(c, {}).some((p) => p.option.kind === 'ordnance')).toBe(false);
    c.round = DRAFT.ordnanceMinRound;
    c.ammo = 0;
    expect(draftPool(c, {}).some((p) => p.option.kind === 'ordnance')).toBe(true);
    // A crate of shells is not an answer to a threat: the counter slot never
    // draws one, however badly the run is being hurt.
    c.threatPressure.mines = { rounds: 5, streak: 5, damage: 400, kills: 4, lastSeenRound: 4 };
    c.round = 5;
    expect(counterSlotPool(c, 'mines').every((p) => p.option.kind !== 'ordnance')).toBe(true);
  });

  it('keeps its randomness — the same pressure does not always yield the same table', () => {
    const offer = (seed: string): string => {
      const c = newRegionalRun(`variety-${seed}`, FIRST_REGION);
      c.round = 3;
      c.threatPressure.mines = { rounds: 1, streak: 1, damage: 40, kills: 0, lastSeenRound: 2 };
      return generateDraft(c, {}, makeRng(seed)).options.map(draftOptionKey).join('|');
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
    const offered = new Set(c.pendingDraft.options.map(draftOptionKey));
    const notOffered = Object.keys(RESEARCH_INDEX).find(
      (id) => !offered.has(id) && !RESEARCH_INDEX[id].def.granted,
    )!;
    expect(selectDraftOption(c, { kind: 'upgrade', id: notOffered })).toBe(false);
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
      // Take the first thing on offer, whatever category it is, until the
      // catalogue and every stock cap are exhausted.
      const option = pool[0].option;
      c.pendingDraft = { round: c.round, options: [option], recoveredUnits: 0, recoveredByBranch: {}, picksLeft: 1, picksTotal: 1 };
      c.phase = 'draft';
      if (!selectDraftOption(c, option)) break;
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

// ---------------------------------------------------------------------------
// Region completion waits for the open quota window
// ---------------------------------------------------------------------------

describe('quota-gated region completion', () => {
  it('victory waits for the open quota window to be honoured', () => {
    const run = newRegionalRun('quota-gated-victory', FIRST_REGION);
    const region = regionDef(FIRST_REGION);
    REGIONS.__quotaGate = { ...region, completionRound: 2 };
    run.regionId = '__quotaGate';
    // A window the fleet cannot clear by the watermark round, but can one
    // round later (empty rounds deliver the full 241-value convoy each time).
    run.quota = { roundsLeft: 3, pointsNeeded: 700, pointsEarned: 0 };
    playEmptyRound(run);
    expect(run.campaignOver).toBe(false);
    // The watermark round: survived, but 482 < 700 with a round left in the
    // window — the region must NOT complete out from under an active quota.
    playEmptyRound(run);
    expect(run.campaignOver).toBe(false);
    expect(run.runOutcome).toBe('active');
    // The window resolves met: NOW it is a victory.
    playEmptyRound(run);
    expect(run.campaignOver).toBe(true);
    expect(run.runOutcome).toBe('victory');
    delete REGIONS.__quotaGate;
  });

  it('a quota missed after the watermark still ends the run in defeat', () => {
    const run = newRegionalRun('quota-gated-defeat', FIRST_REGION);
    const region = regionDef(FIRST_REGION);
    REGIONS.__quotaGate2 = { ...region, completionRound: 2 };
    run.regionId = '__quotaGate2';
    run.quota = { roundsLeft: 3, pointsNeeded: 10_000, pointsEarned: 0 };
    playEmptyRound(run);
    playEmptyRound(run);
    expect(run.campaignOver).toBe(false);
    playEmptyRound(run); // window closes unmet
    expect(run.campaignOver).toBe(true);
    expect(run.runOutcome).toBe('defeat');
    expect(run.defeatCause).toBe('quota');
    delete REGIONS.__quotaGate2;
  });

  it('a window met exactly on the watermark round completes on time', () => {
    const run = newRegionalRun('quota-on-time', FIRST_REGION);
    const region = regionDef(FIRST_REGION);
    REGIONS.__quotaGate3 = { ...region, completionRound: 2 };
    run.regionId = '__quotaGate3';
    run.quota = { roundsLeft: 3, pointsNeeded: 400, pointsEarned: 0 };
    playEmptyRound(run); // 241 < 400: window stays open
    expect(run.campaignOver).toBe(false);
    playEmptyRound(run); // 482 >= 400: met on the watermark round itself
    expect(run.campaignOver).toBe(true);
    expect(run.runOutcome).toBe('victory');
    delete REGIONS.__quotaGate3;
  });
});
