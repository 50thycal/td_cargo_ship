// The artillery branch (docs/ENEMY_ATTACKS.md → Artillery): shore guns, and
// the first enemy that cannot be shot at in flight at all.
//
// The identity is RANGE. A gun is emplaced, fires for as long as it survives,
// and reaches only the water inside its own arc — so lane choice becomes a real
// decision and the answers are counter-battery suppression or simply not being
// there. These tests pin that geometry, the fact that a shell is untouchable by
// every weapon in the game, and the two ways a battery goes quiet.

import { describe, expect, it } from 'vitest';
import { createRoundTransit, newCampaign, planCurrentRound, resolveTransit } from '../src/sim/campaign';
import { stepTransit } from '../src/sim/transit';
import { evolveEnemy, planRound } from '../src/sim/evolution';
import { makeRng } from '../src/sim/rng';
import { buildTransitCards } from '../src/sim/aar';
import { ENEMY_BRANCHES } from '../src/data/enemyBranches';
import { LOSS_CAUSE_TO_ENEMY_BRANCH } from '../src/data/counters';
import { COMBAT, SIM, WORLD } from '../src/data/tuning';
import type {
  ArtilleryVariant,
  CampaignState,
  RoundMetrics,
  RoundPlan,
  TransitEvent,
  TransitState,
} from '../src/sim/types';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function metrics(round: number, over: Partial<RoundMetrics> = {}): RoundMetrics {
  return {
    round,
    interceptRate: 0.5,
    formation: 'sprint',
    mineDetectRate: -1,
    torpedoDetectRate: -1,
    valueSent: 241,
    deliveredFraction: 0.75,
    branchResults: {},
    ...over,
  };
}

const SHORE_Y = WORLD.launchSites[0].y;
type Rng = ReturnType<typeof createRoundTransit>['rng'];

/** A transit with the given guns emplaced and nothing else happening. */
function gunTransit(
  guns: { x: number; y?: number; variant: ArtilleryVariant }[],
  mutate?: (c: CampaignState) => void,
): { c: CampaignState; state: TransitState; rng: Rng } {
  const c = newCampaign('artillery-slice');
  mutate?.(c);
  const plan: RoundPlan = {
    ...planCurrentRound(c),
    spawns: [],
    mines: [],
    installations: guns.map((g) => ({ x: g.x, y: g.y ?? SHORE_Y, variant: g.variant })),
    debuts: [],
  };
  const { state, rng } = createRoundTransit(c, plan);
  return { c, state, rng };
}

/** Run a whole transit out and hand back the finished state. */
function runOut(state: TransitState, rng: Rng): TransitState {
  let guard = 0;
  while (!state.over && guard++ < Math.ceil(SIM.maxTransitTime / SIM.dt)) stepTransit(state, [], rng);
  return state;
}

/** Step until at least one shell is in the air. */
function untilFiring(state: TransitState, rng: Rng): TransitState {
  let guard = 0;
  while (state.stats.shellsFired === 0 && guard++ < Math.ceil(120 / SIM.dt) && !state.over) {
    stepTransit(state, [], rng);
  }
  return state;
}

/** A shore battery that can suppress and, with coordinated strike, destroy. */
const counterBattery = (c: CampaignState): void => {
  c.completedResearch = [
    'counterBattery.base',
    'counterBattery.autoReturnFire',
    'counterBattery.extendedRange',
    'counterBattery.coordinatedStrike',
  ];
  c.baseModules = ['counterBattery'];
  c.bases = 2;
};

const NEAR = WORLD.lanes[0];
const FAR = WORLD.lanes[2];

// ---------------------------------------------------------------------------
// Procurement
// ---------------------------------------------------------------------------

describe('artillery procurement', () => {
  it('is an implemented branch with every node implemented', () => {
    const def = ENEMY_BRANCHES.artillery;
    expect(def.implemented).toBe(true);
    for (const node of def.nodes) expect(node.implemented).toBe(true);
  });

  it('never emplaces a gun before its gate round', () => {
    const c = newCampaign('gun-gate');
    const rng = makeRng('gun-gate');
    for (let r = 1; r < ENEMY_BRANCHES.artillery.openRound; r++) {
      c.round = r;
      expect(planRound(c, makeRng(`p-${r}`)).installations).toHaveLength(0);
      evolveEnemy(c.evolution, metrics(r), rng);
    }
  });

  it('emplaces exactly what the ledger bought, spread along the shore', () => {
    const c = newCampaign('gun-place');
    const rng = makeRng('gun-place');
    for (let r = 1; r <= 14; r++) {
      c.round = r;
      evolveEnemy(c.evolution, metrics(r), rng);
    }
    c.round = 15;
    c.evolution.economy.ledgers.artillery.units = { coastalGun: 2, ranging: 1, rollingBarrage: 1 };
    c.evolution.economy.plannedForRound = c.round;
    const placed = planRound(c, makeRng('place')).installations;
    expect(placed).toHaveLength(4);
    expect(placed.filter((g) => g.variant === 'coastalGun')).toHaveLength(2);
    expect(placed.filter((g) => g.variant === 'ranging')).toHaveLength(1);
    expect(placed.filter((g) => g.variant === 'rollingBarrage')).toHaveLength(1);
    // All on the hostile shore, and not stacked on one another.
    for (const g of placed) expect(Math.abs(g.y - SHORE_Y)).toBeLessThan(40);
    const xs = placed.map((g) => g.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(60);
  });

  it('grants the T2 targeting rung when the first gun is fielded', () => {
    const c = newCampaign('gun-doctrine');
    const rng = makeRng('gun-doctrine');
    for (let r = 1; r <= 30; r++) {
      c.round = r;
      evolveEnemy(c.evolution, metrics(r), rng);
      if (c.evolution.economy.nodesFielded.includes('coastalGun')) break;
    }
    expect(c.evolution.economy.nodesFielded).toContain('coastalGun');
    expect(c.evolution.economy.targetingTier).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Range is the design
// ---------------------------------------------------------------------------

describe('artillery reach', () => {
  it('a coastal gun reaches the near lane and nothing beyond it', () => {
    const r = COMBAT.artillery.range.coastalGun;
    expect(NEAR - SHORE_Y).toBeLessThan(r); // near lane: inside
    expect(WORLD.lanes[1] - SHORE_Y).toBeGreaterThan(r); // middle lane: outside
    expect(FAR - SHORE_Y).toBeGreaterThan(r);
  });

  it('ranging artillery reaches one lane further, and still not the far lane', () => {
    const r = COMBAT.artillery.range.ranging;
    expect(WORLD.lanes[1] - SHORE_Y).toBeLessThan(r);
    expect(FAR - SHORE_Y).toBeGreaterThan(r);
  });

  it('every hull a gun sinks is one that was inside its reach', () => {
    const { state, rng } = gunTransit([{ x: 1000, variant: 'coastalGun' }]);
    runOut(state, rng);
    expect(state.stats.shellsFired).toBeGreaterThan(0);
    const lost = state.ships.filter((s) => !s.alive);
    expect(lost.length).toBeGreaterThan(0);
    // Losses land in the near lane only — the gun cannot touch anything else.
    for (const ship of lost) expect(ship.laneIndex).toBe(0);
  });

  it('a gun with nothing in reach never fires a shot', () => {
    // Emplaced far along the shore from where the convoy will ever be in reach.
    const { state, rng } = gunTransit([{ x: -600, variant: 'coastalGun' }]);
    runOut(state, rng);
    expect(state.stats.shellsFired).toBe(0);
    expect(state.stats.lost).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Shells are not projectiles anyone can engage
// ---------------------------------------------------------------------------

describe('shells cannot be engaged', () => {
  it('shells live outside the threat list entirely', () => {
    const { state, rng } = gunTransit([{ x: 1000, variant: 'coastalGun' }]);
    untilFiring(state, rng);
    expect(state.shells.length).toBeGreaterThan(0);
    // Nothing in `threats` — so the compatibility layer never even sees one,
    // and no weapon can be pointed at a shell by any code path.
    expect(state.threats).toHaveLength(0);
  });

  it('leaves nothing in the threat list for any weapon to acquire', () => {
    // The guarantee is structural rather than a rule anyone has to remember:
    // there is no ThreatKind for a shell and shells are never pushed into
    // `threats`, so every weapon's target search comes up empty by construction.
    // A gun firing hard, with a fully equipped convoy, still offers no target.
    const { state, rng } = gunTransit([{ x: 1000, variant: 'coastalGun' }], (c) => {
      c.completedResearch = [
        'escortInterceptor.precisionGuidance',
        'selfDefense.base',
        'depthCharges.base',
        'deckGun.base',
        'flak.base',
      ];
      c.escorts = 2;
      c.escortModules = ['deckGun', 'depthCharges'];
      c.classModules = { cargo: ['selfDefense'], tanker: ['flak'], freighter: [] };
    });
    runOut(state, rng);
    expect(state.stats.shellsFired).toBeGreaterThan(0);
    expect(state.threats).toHaveLength(0);
    // Nothing was expended shooting at shells, because there was nothing there.
    expect(state.stats.counter.deckGunRounds).toBe(0);
    expect(state.stats.counter.depthChargesDropped).toBe(0);
    expect(state.stats.counter.selfDefenseShots).toBe(0);
    expect(state.stats.counter.flakShots).toBe(0);
    expect(state.stats.ammoUsed).toBe(0);
  });

  it('counter-battery fires at the gun position, never at a shell', () => {
    const { state, rng } = gunTransit([{ x: 1000, variant: 'coastalGun' }], counterBattery);
    runOut(state, rng);
    expect(state.stats.counter.counterBatteryShots).toBeGreaterThan(0);
    // Every counter-battery shot resolved against an installation.
    expect(state.stats.counter.counterBatterySuppressions).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Silencing a battery
// ---------------------------------------------------------------------------

describe('counter-battery', () => {
  it('suppression stops a gun firing and saves hulls', () => {
    const play = (mutate?: (c: CampaignState) => void): TransitState => {
      const { state, rng } = gunTransit([{ x: 1000, variant: 'coastalGun' }], mutate);
      return runOut(state, rng);
    };
    const unanswered = play();
    const answered = play(counterBattery);
    expect(answered.stats.shellsFired).toBeLessThan(unanswered.stats.shellsFired);
    expect(answered.stats.lost).toBeLessThan(unanswered.stats.lost);
  });

  it('coordinated strikes silence a battery permanently for the round', () => {
    const { state, rng } = gunTransit([{ x: 1000, variant: 'coastalGun' }], counterBattery);
    runOut(state, rng);
    expect(state.installations[0].destroyed).toBe(true);
    expect(state.stats.batteriesDestroyed).toBe(1);
    expect(state.events.some((e) => e.type === 'suppressed' && e.detail?.startsWith('destroyed:'))).toBe(
      true,
    );
  });

  it('a suppressed crew loses the ranging solution it had been building', () => {
    const { state, rng } = gunTransit([{ x: 1000, variant: 'ranging' }], counterBattery);
    untilFiring(state, rng);
    const gun = state.installations[0];
    gun.walkShots = 5;
    gun.walkTargetShipId = 1;
    gun.suppressedUntil = state.time + 5;
    stepTransit(state, [], rng);
    expect(gun.walkShots).toBe(0);
    expect(gun.walkTargetShipId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// The node ladder
// ---------------------------------------------------------------------------

describe('artillery nodes', () => {
  it('ranging artillery hits harder per shell than a coastal gun', () => {
    expect(COMBAT.artillery.damage.ranging).toBeGreaterThan(COMBAT.artillery.damage.coastalGun);
    expect(COMBAT.artillery.reload.ranging).toBeGreaterThan(COMBAT.artillery.reload.coastalGun);
  });

  it('ranging fire walks onto a hull that holds position', () => {
    const { state, rng } = gunTransit([{ x: 1000, variant: 'ranging' }]);
    untilFiring(state, rng);
    const gun = state.installations[0];
    // Let it keep shooting at whatever stays nearest; the solution tightens.
    let guard = 0;
    while (gun.walkShots < 2 && guard++ < Math.ceil(40 / SIM.dt) && !state.over) {
      stepTransit(state, [], rng);
    }
    expect(gun.walkShots).toBeGreaterThan(0);
    expect(gun.walkTargetShipId).toBeDefined();
  });

  it('a rolling barrage walks ahead of the convoy rather than behind it', () => {
    const { state, rng } = gunTransit([{ x: 1000, variant: 'rollingBarrage' }]);
    untilFiring(state, rng);
    const gun = state.installations[0];
    const inLane = state.ships.filter(
      (s) => s.spawned && s.alive && !s.delivered && Math.abs(s.y - gun.barrageY) < 90,
    );
    if (inLane.length > 0) {
      const leadX = Math.max(...inLane.map((s) => s.x));
      // The salvo starts ahead of the leading hull, so the convoy sails into it.
      expect(gun.barrageFromX).toBeGreaterThan(leadX - 40);
    }
    expect(gun.barrageLeft).toBeLessThanOrEqual(COMBAT.artillery.barrageShells);
  });

  it('a barrage fires a burst and then pauses, rather than firing forever', () => {
    const { state, rng } = gunTransit([{ x: 1000, variant: 'rollingBarrage' }]);
    let guard = 0;
    while (state.installations[0].barrageLeft > 0 || state.stats.shellsFired === 0) {
      if (guard++ > Math.ceil(120 / SIM.dt) || state.over) break;
      stepTransit(state, [], rng);
    }
    expect(state.stats.shellsFired).toBeGreaterThan(0);
    expect(state.stats.shellsFired).toBeLessThanOrEqual(COMBAT.artillery.barrageShells);
    expect(state.installations[0].barrageNextAt).toBeGreaterThan(state.time);
  });
});

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

describe('artillery reporting', () => {
  it('credits its damage and kills to the artillery branch', () => {
    const { state, rng } = gunTransit([{ x: 1000, variant: 'coastalGun' }]);
    runOut(state, rng);
    expect(state.stats.enemyBranch.artillery?.damage ?? 0).toBeGreaterThan(0);
    for (const cause of ['artillery', 'rangingArtillery', 'rollingBarrage']) {
      expect(LOSS_CAUSE_TO_ENEMY_BRANCH[cause]).toBe('artillery');
    }
  });

  it('announces each node the first time it opens fire', () => {
    const { state, rng } = gunTransit([{ x: 1000, variant: 'ranging' }]);
    untilFiring(state, rng);
    expect(state.debutsSeen).toEqual(expect.arrayContaining(['artillery', 'rangingArtillery']));
    expect(state.debutsSeen).not.toContain('rollingBarrage');
  });

  it('each artillery node has its own discovery card and loss narrative', () => {
    const { state } = gunTransit([]);
    for (const key of ['artillery', 'rangingArtillery', 'rollingBarrage'] as const) {
      const cards = buildTransitCards({ ...state, events: [] }, [key]);
      expect(cards.filter((c) => c.kind === 'discovery')).toHaveLength(1);
    }
    const withLosses = {
      ...state,
      events: (['artillery', 'rangingArtillery', 'rollingBarrage'] as const).map(
        (cause, i): TransitEvent => ({ t: i, type: 'shipLost', shipName: `Hull ${i}`, cause }),
      ),
    };
    const bodies = buildTransitCards(withLosses, []).map((c) => c.body);
    expect(new Set(bodies).size).toBe(3);
    for (const body of bodies) expect(body).not.toMatch(/was lost\.$/);
  });

  it('reports shell counters in the round log', () => {
    const c = newCampaign('gun-telemetry');
    const plan: RoundPlan = {
      ...planCurrentRound(c),
      spawns: [],
      mines: [],
      installations: [{ x: 1000, y: SHORE_Y, variant: 'coastalGun' }],
      debuts: [],
    };
    const { state, rng } = createRoundTransit(c, plan);
    runOut(state, rng);
    resolveTransit(c, state);
    const round = c.telemetry[c.telemetry.length - 1];
    expect(round.shellsFired).toBeGreaterThan(0);
    expect(round.shellHits).toBeLessThanOrEqual(round.shellsFired);
  });
});
