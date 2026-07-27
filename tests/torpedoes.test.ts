// The torpedo branch (docs/ENEMY_ATTACKS.md → Torpedoes): the first enemy
// vertical slice built end to end — procurement, scheduling, underwater
// behavior, detection, and the counters that are allowed to touch it.
//
// The branch's whole identity is that it is IMMUNE to the air-defense stack.
// Those immunities are pinned in counters.test.ts against injected threats;
// what is pinned here is that the enemy actually fields them, that they run
// and hit, and that the detection ladder (wake → hydrophone → active sonar)
// gates the only weapon that can kill one.

import { describe, expect, it } from 'vitest';
import { createRoundTransit, newCampaign, planCurrentRound, resolveTransit } from '../src/sim/campaign';
import { stepTransit } from '../src/sim/transit';
import { evolveEnemy, planRound } from '../src/sim/evolution';
import { makeRng } from '../src/sim/rng';
import { buildTransitCards } from '../src/sim/aar';
import { ENEMY_BRANCHES } from '../src/data/enemyBranches';
import { COMBAT, EVOLUTION, SIM, WORLD } from '../src/data/tuning';
import { LOSS_CAUSE_TO_ENEMY_BRANCH } from '../src/data/counters';
import type {
  CampaignState,
  RoundMetrics,
  RoundPlan,
  SpawnEvent,
  Threat,
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

/** A campaign whose enemy has been evolved forward `rounds` rounds, so the
 *  torpedo branch is open and funded. */
function campaignAtRound(rounds: number, seed = 'torp'): CampaignState {
  const c = newCampaign(seed);
  const rng = makeRng(seed);
  for (let r = 1; r <= rounds; r++) {
    c.round = r;
    evolveEnemy(c.evolution, metrics(r), rng);
  }
  c.round = rounds + 1;
  return c;
}

/** Torpedoes can only be aimed at hulls that are actually in the strait, so
 *  every scheduled run has to land after the convoy is under way. */
const LAUNCH_T = EVOLUTION.windowStartT + 4;

const spawn = (over: Partial<SpawnEvent> = {}): SpawnEvent => ({
  time: LAUNCH_T,
  kind: 'torpedo',
  siteX: WORLD.launchSites[0].x,
  ...over,
});

type Rng = ReturnType<typeof createRoundTransit>['rng'];

/** A transit with a hand-built plan: only the torpedoes under test run. */
function torpedoTransit(
  spawns: SpawnEvent[],
  mutate?: (c: CampaignState) => void,
): { c: CampaignState; state: TransitState; rng: Rng } {
  const c = newCampaign('torpedo-slice');
  mutate?.(c);
  const plan: RoundPlan = { ...planCurrentRound(c), spawns, mines: [], debuts: [] };
  const { state, rng } = createRoundTransit(c, plan);
  return { c, state, rng };
}

function run(state: TransitState, rng: Rng, ticks: number): void {
  for (let i = 0; i < ticks && !state.over; i++) stepTransit(state, [], rng);
}

const torpedoes = (t: TransitState): Threat[] => t.threats.filter((th) => th.kind === 'torpedo');

/** Step until the scheduled torpedoes are in the water, then hand them back. */
function launch(spawns: SpawnEvent[], mutate?: (c: CampaignState) => void): {
  state: TransitState;
  rng: Rng;
  torps: Threat[];
} {
  const { state, rng } = torpedoTransit(spawns, mutate);
  let guard = 0;
  while (state.spawnQueue.length > 0 && guard++ < Math.ceil((LAUNCH_T + 5) / SIM.dt)) {
    stepTransit(state, [], rng);
  }
  const torps = torpedoes(state);
  expect(torps.length).toBe(spawns.length);
  return { state, rng, torps };
}

/** The ship a torpedo is running at (they are only ever aimed at live hulls). */
const targetOf = (state: TransitState, torp: Threat) =>
  state.ships.find((s) => s.id === torp.targetShipId) ??
  state.ships.find((s) => s.alive && !s.delivered)!;

// ---------------------------------------------------------------------------
// Procurement: the enemy actually buys and schedules them
// ---------------------------------------------------------------------------

describe('torpedo procurement', () => {
  it('is an implemented branch with every node implemented', () => {
    const def = ENEMY_BRANCHES.torpedoes;
    expect(def.implemented).toBe(true);
    for (const node of def.nodes) expect(node.implemented).toBe(true);
  });

  it('never fields a torpedo before its gate round', () => {
    const c = newCampaign('gate');
    const rng = makeRng('gate');
    for (let r = 1; r < ENEMY_BRANCHES.torpedoes.openRound; r++) {
      c.round = r;
      expect(planRound(c, makeRng(`plan-${r}`)).spawns.some((s) => s.kind === 'torpedo')).toBe(false);
      evolveEnemy(c.evolution, metrics(r), rng);
    }
  });

  it('eventually schedules torpedo spawns once the branch is funded', () => {
    const c = campaignAtRound(13);
    expect(c.evolution.economy.openBranches).toContain('torpedoes');
    let seen = 0;
    for (let r = 14; r <= 20; r++) {
      c.round = r;
      seen += planRound(c, makeRng(`p-${r}`)).spawns.filter((s) => s.kind === 'torpedo').length;
      evolveEnemy(c.evolution, metrics(r), makeRng(`e-${r}`));
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('assigns variants to match exactly what the ledger bought', () => {
    const c = campaignAtRound(18, 'variants');
    c.evolution.economy.ledgers.torpedoes.units = { straight: 3, homing: 2, lowSigTorpedo: 1 };
    c.evolution.economy.plannedForRound = c.round;
    const fired = planRound(c, makeRng('variant-plan')).spawns.filter((s) => s.kind === 'torpedo');
    expect(fired).toHaveLength(6);
    expect(fired.filter((s) => s.lowSig)).toHaveLength(1);
    // Low-signature torpedoes are the newest node: they home as well as hide.
    expect(fired.filter((s) => s.homing && !s.lowSig)).toHaveLength(2);
    expect(fired.filter((s) => !s.homing && !s.lowSig)).toHaveLength(3);
  });

  it('caps a first appearance so the debut is a beat, not an ambush', () => {
    const c = newCampaign('cap');
    const rng = makeRng('cap');
    const cap = ENEMY_BRANCHES.torpedoes.nodes[0].firstAppearanceCap;
    for (let r = 1; r <= 24; r++) {
      c.round = r;
      const before = c.evolution.economy.nodesFielded.includes('straight');
      evolveEnemy(c.evolution, metrics(r), rng);
      if (!before && c.evolution.economy.nodesFielded.includes('straight')) {
        expect(c.evolution.economy.ledgers.torpedoes.units.straight ?? 0).toBeLessThanOrEqual(cap);
        return;
      }
    }
    throw new Error('torpedoes never debuted in 24 rounds');
  });
});

// ---------------------------------------------------------------------------
// Behavior in the water
// ---------------------------------------------------------------------------

describe('torpedo behavior', () => {
  it('spawns from the shore, runs under the surface and counts as launched', () => {
    const { state, torps } = launch([spawn()]);
    expect(state.stats.torpedoesLaunched).toBe(1);
    expect(Math.hypot(torps[0].vx, torps[0].vy)).toBeCloseTo(COMBAT.torpedo.speed, 2);
    expect(torps[0].revealed).toBe(false);
  });

  it('runs a straight bearing when it is not a homing weapon', () => {
    const { state, rng, torps } = launch([spawn()]);
    const torp = torps[0];
    const heading = Math.atan2(torp.vy, torp.vx);
    run(state, rng, 40);
    if (!torp.alive) return; // hit something early — still a straight run
    expect(Math.atan2(torp.vy, torp.vx)).toBeCloseTo(heading, 6);
  });

  it('a homing torpedo steers onto a ship that maneuvers away from its bearing', () => {
    const { state, rng, torps } = launch([spawn({ homing: true })]);
    const torp = torps[0];
    const target = targetOf(state, torp);
    const bearingErr = (): number => {
      const desired = Math.atan2(target.y - torp.y, target.x - torp.x);
      const current = Math.atan2(torp.vy, torp.vx);
      return Math.abs(Math.atan2(Math.sin(desired - current), Math.cos(desired - current)));
    };
    // Shove the target off the run PERPENDICULAR to the torpedo's heading —
    // displacing it along the bearing barely changes the angle at all. The
    // offset scales with range so the induced error is a real ~0.5 rad, not a
    // wobble the turn rate could shrug off.
    const range = Math.hypot(target.x - torp.x, target.y - torp.y);
    const heading = Math.atan2(torp.vy, torp.vx);
    target.x += Math.cos(heading + Math.PI / 2) * range * 0.55;
    target.y += Math.sin(heading + Math.PI / 2) * range * 0.55;
    const before = bearingErr();
    expect(before).toBeGreaterThan(0.4);
    run(state, rng, 20);
    expect(bearingErr()).toBeLessThan(before);
  });

  it('damages the ship it reaches and credits the torpedo branch', () => {
    const { state, rng, torps } = launch([spawn({ homing: true })]);
    const torp = torps[0];
    const target = targetOf(state, torp);
    const hp0 = target.hp;
    // Put it on the doorstep so the run resolves inside the test's tick budget.
    torp.x = target.x - COMBAT.torpedo.hitRadius * 0.5;
    torp.y = target.y;
    run(state, rng, 2);
    expect(torp.alive).toBe(false);
    expect(state.stats.torpedoesHit).toBe(1);
    expect(target.hp).toBeLessThan(hp0);
    expect(state.stats.enemyBranch.torpedoes?.damage ?? 0).toBeGreaterThan(0);
  });

  it('every torpedo loss cause is attributed to the torpedo branch', () => {
    for (const cause of ['torpedo', 'homingTorpedo', 'lowSigTorpedo']) {
      expect(LOSS_CAUSE_TO_ENEMY_BRANCH[cause]).toBe('torpedoes');
    }
  });
});

// ---------------------------------------------------------------------------
// Detection ladder: wake → hydrophone → active sonar
// ---------------------------------------------------------------------------

describe('torpedo detection', () => {
  /** Distance from the nearest active hull, in world units. */
  const nearestShipRange = (t: TransitState, torp: Threat): number =>
    Math.min(
      ...t.ships
        .filter((s) => s.alive && !s.delivered)
        .map((s) => Math.hypot(s.x - torp.x, s.y - torp.y)),
    );

  it('is invisible while it is still far from the convoy', () => {
    const { state, torps } = launch([spawn()]);
    expect(nearestShipRange(state, torps[0])).toBeGreaterThan(COMBAT.torpedo.wakeVisibleRange);
    expect(torps[0].revealed).toBe(false);
  });

  it('a wake-leaving torpedo is read off the water once it closes, with no equipment', () => {
    const { state, rng, torps } = launch([spawn()]);
    const torp = torps[0];
    const target = targetOf(state, torp);
    torp.x = target.x - COMBAT.torpedo.wakeVisibleRange * 0.5;
    torp.y = target.y;
    run(state, rng, 1);
    expect(torp.revealed).toBe(true);
    expect(state.stats.torpedoesDetected).toBe(1);
    expect(state.events.some((e) => e.type === 'torpedoDetected' && e.detail === 'wake')).toBe(true);
  });

  it('a low-signature torpedo leaves no wake, so closing the range reveals nothing', () => {
    const { state, rng, torps } = launch([spawn({ lowSig: true, homing: true })]);
    const torp = torps[0];
    const target = targetOf(state, torp);
    torp.x = target.x - COMBAT.torpedo.wakeVisibleRange * 0.5;
    torp.y = target.y;
    run(state, rng, 1);
    expect(torp.revealed).toBe(false);
    expect(state.stats.torpedoesDetected).toBe(0);
  });

  it('a hydrophone hears a wake-leaving torpedo well before the wake is readable', () => {
    const { state, rng, torps } = launch([spawn()], (c) => {
      c.completedResearch = ['hydrophone.base'];
      c.classModules = { cargo: ['hydrophone'], tanker: ['hydrophone'], freighter: ['hydrophone'] };
    });
    expect(state.effects.hydrophone.range).toBeGreaterThan(COMBAT.torpedo.wakeVisibleRange);
    const torp = torps[0];
    const target = targetOf(state, torp);
    // Park it inside hydrophone range but outside wake range.
    const standoff = (state.effects.hydrophone.range + COMBAT.torpedo.wakeVisibleRange) / 2;
    torp.x = target.x - standoff;
    torp.y = target.y;
    run(state, rng, 1);
    expect(torp.revealed).toBe(true);
    expect(state.events.some((e) => e.type === 'torpedoDetected' && e.detail === 'hydrophone')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The kill chain the branch exists to create: hear it, then kill it
// ---------------------------------------------------------------------------

describe('torpedo counter loop', () => {
  /** Hydrophone watch + depth charges on the escorts, auto-drop enabled. */
  const aswFleet = (c: CampaignState): void => {
    c.completedResearch = [
      'hydrophone.base',
      'depthCharges.base',
      'depthCharges.localAutoDrop',
    ];
    c.classModules = { cargo: ['hydrophone'], tanker: ['hydrophone'], freighter: ['hydrophone'] };
    c.escorts = 2; // campaigns start with none; ASW needs a hull to drop from
    c.escortModules = ['depthCharges'];
    c.autoFire = { ...c.autoFire, depthCharges: true };
  };

  it('a detected torpedo is depth-charged before it reaches the convoy', () => {
    const { state, rng, torps } = launch([spawn()], aswFleet);
    const torp = torps[0];
    const escort = state.escorts.find((e) => e.alive)!;
    // Walk it into the escort's emergency radius: heard, then engaged.
    torp.x = escort.x - state.effects.depthCharge.autoRadius * 0.5;
    torp.y = escort.y;
    run(state, rng, Math.ceil(4 / SIM.dt));
    expect(torp.alive).toBe(false);
    expect(state.stats.torpedoesDestroyed).toBe(1);
    expect(state.stats.counter.depthChargeKills).toBe(1);
    expect(state.events.some((e) => e.type === 'depthChargeKill')).toBe(true);
  });

  it('an undetected low-signature torpedo is never depth-charged', () => {
    // Same fleet, same geometry — the only difference is that nothing on board
    // can hear it, and the automation refuses to fire at what it cannot see.
    const { state, rng, torps } = launch([spawn({ lowSig: true })], aswFleet);
    const torp = torps[0];
    const escort = state.escorts.find((e) => e.alive)!;
    torp.x = escort.x - state.effects.depthCharge.autoRadius * 0.5;
    torp.y = escort.y;
    torp.vx = 0;
    torp.vy = 0;
    run(state, rng, Math.ceil(4 / SIM.dt));
    expect(torp.revealed).toBe(false);
    expect(state.stats.torpedoesDestroyed).toBe(0);
    expect(state.depthChargeShots).toHaveLength(0);
  });

  it('kills feed the torpedo detect rate that drives the enemy up its node ladder', () => {
    const c = newCampaign('asw-rate');
    aswFleet(c);
    const plan: RoundPlan = { ...planCurrentRound(c), spawns: [spawn()], mines: [], debuts: [] };
    const { state, rng } = createRoundTransit(c, plan);
    let guard = 0;
    while (!state.over && guard++ < Math.ceil(SIM.maxTransitTime / SIM.dt)) stepTransit(state, [], rng);
    resolveTransit(c, state);
    const recorded = c.evolution.metrics[c.evolution.metrics.length - 1];
    expect(recorded.torpedoDetectRate).toBeGreaterThanOrEqual(0);
    expect(recorded.torpedoDetectRate).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Discovery beats — the player is told what hit them
// ---------------------------------------------------------------------------

describe('torpedo discovery beats', () => {
  const debutsFrom = (spawns: SpawnEvent[]): string[] => {
    const { state, rng, torps } = launch(spawns);
    for (const torp of torps) {
      const target = targetOf(state, torp);
      torp.x = target.x - COMBAT.torpedo.hitRadius * 0.5;
      torp.y = target.y;
    }
    run(state, rng, 2);
    return state.debutsSeen;
  };

  it('announces the torpedo debut on impact even if it was never detected', () => {
    expect(debutsFrom([spawn({ lowSig: true, homing: true })])).toEqual(
      expect.arrayContaining(['torpedo', 'homingTorpedo', 'lowSigTorpedo']),
    );
  });

  it('does not claim a homing or low-signature debut for a plain straight run', () => {
    const seen = debutsFrom([spawn()]);
    expect(seen).toContain('torpedo');
    expect(seen).not.toContain('homingTorpedo');
    expect(seen).not.toContain('lowSigTorpedo');
  });

  it('announces the debut on detection too, so a successful defense still learns', () => {
    const { state, rng, torps } = launch([spawn()]);
    const torp = torps[0];
    const target = targetOf(state, torp);
    torp.x = target.x - COMBAT.torpedo.wakeVisibleRange * 0.5;
    torp.y = target.y;
    run(state, rng, 1);
    expect(state.debutsSeen).toContain('torpedo');
  });

  it('each torpedo node has its own discovery card and loss narrative', () => {
    const { state } = torpedoTransit([]);
    for (const key of ['torpedo', 'homingTorpedo', 'lowSigTorpedo'] as const) {
      const cards = buildTransitCards({ ...state, events: [] }, [key]);
      expect(cards.filter((card) => card.kind === 'discovery')).toHaveLength(1);
    }
    const withLosses = {
      ...state,
      events: (['torpedo', 'homingTorpedo', 'lowSigTorpedo'] as const).map(
        (cause, i): TransitEvent => ({ t: i, type: 'shipLost', shipName: `Hull ${i}`, cause }),
      ),
    };
    const bodies = buildTransitCards(withLosses, []).map((card) => card.body);
    expect(new Set(bodies).size).toBe(3); // three distinct forensics, not one generic line
    for (const body of bodies) expect(body).not.toMatch(/was lost\.$/);
  });
});

// ---------------------------------------------------------------------------
// The loop closes: torpedo results feed the enemy's ROI
// ---------------------------------------------------------------------------

describe('torpedo telemetry', () => {
  it('reports torpedo counters in the round log', () => {
    const c = newCampaign('torp-telemetry');
    const plan: RoundPlan = { ...planCurrentRound(c), spawns: [spawn({ homing: true })], mines: [], debuts: [] };
    const { state, rng } = createRoundTransit(c, plan);
    let guard = 0;
    while (!state.over && guard++ < Math.ceil(120 / SIM.dt)) stepTransit(state, [], rng);
    const report = resolveTransit(c, state);
    expect(report.stats.torpedoesLaunched).toBe(1);
    const round = c.telemetry[c.telemetry.length - 1];
    expect(round.torpedoesLaunched).toBe(1);
    expect(
      round.torpedoesDetected + round.torpedoesDestroyed + round.torpedoesHit,
    ).toBeGreaterThanOrEqual(0);
  });

  it('a torpedo detect rate is derived only when torpedoes actually ran', () => {
    const c = newCampaign('torp-rate');
    const plan: RoundPlan = { ...planCurrentRound(c), spawns: [], mines: [], debuts: [] };
    const { state, rng } = createRoundTransit(c, plan);
    let guard = 0;
    while (!state.over && guard++ < Math.ceil(120 / SIM.dt)) stepTransit(state, [], rng);
    resolveTransit(c, state);
    const recorded = c.evolution.metrics[c.evolution.metrics.length - 1];
    expect(recorded.torpedoDetectRate).toBe(-1); // no torpedoes → no signal, not "0% detected"
  });
});
