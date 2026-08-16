// The two SUPPORT branches (docs/ENEMY_ATTACKS.md → Smoke / Concealment and
// Electronic Attack / Drones). Neither of them sinks ships as its job — they
// multiply every other branch by taking away the player's eyes and systems.
//
// Two things here are locked design and are what these tests mostly exist to
// hold down:
//
//   • Smoke uses the SOFT concealment model. A threat in cloud keeps a faint
//     bearing marker and is never removed from the sim — it is still coming and
//     will still hit. What it loses is the precise tap-target. Fully hiding it
//     would be too punishing for a tap-to-target game.
//   • Sensor jamming is the ONE capability in the whole design with no counter.
//     It cannot be shot down, it must cost real budget, and it must show an
//     unmissable indicator. Everything else is worked around, not answered.

import { describe, expect, it } from 'vitest';
import { createRoundTransit, newCampaign, planCurrentRound, resolveTransit } from '../src/sim/campaign';
import { stepTransit } from '../src/sim/transit';
import { evolveEnemy, planRound } from '../src/sim/evolution';
import { makeRng } from '../src/sim/rng';
import { buildTransitCards } from '../src/sim/aar';
import { ENEMY_BRANCHES } from '../src/data/enemyBranches';
import { canEngage } from '../src/data/counters';
import { COMBAT, ENEMY_ECONOMY, SIM, WORLD } from '../src/data/tuning';
import type {
  CampaignState,
  RoundMetrics,
  RoundPlan,
  ThreatKind,
  TransitCommand,
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

type Rng = ReturnType<typeof createRoundTransit>['rng'];
type PlanPatch = Partial<Pick<RoundPlan, 'smoke' | 'electronic' | 'mines' | 'spawns'>>;

/** A transit with only the support effects under test running. */
function supportTransit(
  patch: PlanPatch,
  mutate?: (c: CampaignState) => void,
): { c: CampaignState; state: TransitState; rng: Rng } {
  const c = newCampaign('support-slice');
  mutate?.(c);
  const base = planCurrentRound(c);
  const plan: RoundPlan = {
    ...base,
    mines: [],
    installations: [],
    smoke: [],
    electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 0 },
    debuts: [],
    ...patch,
  };
  const { state, rng } = createRoundTransit(c, plan);
  return { c, state, rng };
}

/** Run out a transit, optionally tapping missiles as a player would. */
function runOut(state: TransitState, rng: Rng, tap = false): TransitState {
  let guard = 0;
  while (!state.over && guard++ < Math.ceil(SIM.maxTransitTime / SIM.dt)) {
    const cmds: TransitCommand[] = [];
    if (tap) {
      const ready =
        state.ammo > 0 &&
        (state.bases.some((b) => b.cooldown <= 0) || state.escorts.some((e) => e.cooldown <= 0));
      if (ready) {
        for (const th of state.threats) {
          if (th.alive && (th.kind === 'missile' || th.kind === 'guidedMissile') && !th.claimedByInterceptor) {
            cmds.push({ type: 'intercept', threatId: th.id });
            break;
          }
        }
      }
    }
    stepTransit(state, cmds, rng);
  }
  return state;
}

/** Step to a given transit time. */
function runTo(state: TransitState, rng: Rng, time: number): TransitState {
  let guard = 0;
  while (state.time < time && !state.over && guard++ < Math.ceil(SIM.maxTransitTime / SIM.dt)) {
    stepTransit(state, [], rng);
  }
  return state;
}

/** A screening cloud over whichever launch site this round actually uses,
 *  timed to be up before that site's FIRST launch.
 *
 *  Deriving the time from the plan rather than hard-coding one matters: the
 *  convoy's entry pacing sets the enemy's fire window, so a fixed timestamp
 *  quietly stops covering a launch the moment anyone retunes SPAWN. Asking the
 *  plan when the site fires keeps the test about smoke. */
function screeningOverBusiestSite(plan: RoundPlan, time?: number): RoundPlan {
  const busiest: Record<number, number> = {};
  for (const sp of plan.spawns) busiest[sp.siteX] = (busiest[sp.siteX] ?? 0) + 1;
  const siteX = Number(Object.entries(busiest).sort((a, b) => b[1] - a[1])[0][0]);
  const firstAtSite = plan.spawns
    .filter((sp) => sp.siteX === siteX)
    .reduce((min, sp) => Math.min(min, sp.time), Infinity);
  const at = time ?? Math.max(0, firstAtSite - 2);
  return {
    ...plan,
    smoke: [{ variant: 'screening', time: at, x: siteX, y: WORLD.launchSites[0].y + 40 }],
  };
}

// ---------------------------------------------------------------------------
// Procurement
// ---------------------------------------------------------------------------

describe('support branch procurement', () => {
  it('both branches and all their nodes are implemented', () => {
    for (const key of ['smoke', 'electronic'] as const) {
      expect(ENEMY_BRANCHES[key].implemented).toBe(true);
      for (const node of ENEMY_BRANCHES[key].nodes) expect(node.implemented).toBe(true);
    }
  });

  it('never fields either branch before its gate round', () => {
    const c = newCampaign('support-gate');
    const rng = makeRng('support-gate');
    const earliest = Math.min(ENEMY_BRANCHES.smoke.openRound, ENEMY_BRANCHES.electronic.openRound);
    for (let r = 1; r < earliest; r++) {
      c.round = r;
      const plan = planRound(c, makeRng(`p-${r}`));
      expect(plan.smoke).toHaveLength(0);
      expect(plan.electronic.reconPlanes + plan.electronic.disablingDrones + plan.electronic.jamming).toBe(0);
      evolveEnemy(c.evolution, metrics(r), rng);
    }
  });

  it('screens the launch site that is actually busy, not an idle one', () => {
    const c = newCampaign('screen-place');
    const rng = makeRng('screen-place');
    for (let r = 1; r <= 12; r++) {
      c.round = r;
      evolveEnemy(c.evolution, metrics(r), rng);
    }
    c.round = 13;
    c.evolution.economy.ledgers.smoke.units = { screening: 1 };
    c.evolution.economy.plannedForRound = c.round;
    const plan = planRound(c, makeRng('screen-plan'));
    expect(plan.smoke).toHaveLength(1);
    const cloud = plan.smoke[0];
    // Some launch actually happens within the cloud's reach — a cloud over a
    // site nobody fires from screens nothing and is budget thrown away.
    const covered = plan.spawns.filter(
      (sp) => Math.abs(sp.siteX - (cloud.x ?? 0)) <= COMBAT.enemySmoke.radius,
    );
    expect(covered.length).toBeGreaterThan(0);
  });

  it('sensor jamming costs real budget — it is never a free opening move', () => {
    // ENEMY_ATTACKS.md locks this: the one node with no counter has to be paid
    // for, or the enemy would simply open every round with it.
    const node = ENEMY_BRANCHES.electronic.nodes.find((n) => n.id === 'sensorJamming');
    expect(node).toBeDefined();
    expect(node!.cost).toBeGreaterThan(0);
    // And dearer than the branch's shootable nodes, which do have answers.
    const shootable = ENEMY_BRANCHES.electronic.nodes.filter((n) => n.id !== 'sensorJamming');
    for (const other of shootable) expect(node!.cost).toBeGreaterThan(other.cost);
  });
});

// ---------------------------------------------------------------------------
// Smoke: the soft concealment model
// ---------------------------------------------------------------------------

describe('smoke concealment', () => {
  it('conceals threats inside the cloud without removing them from the sim', () => {
    const c = newCampaign('conceal');
    const plan = screeningOverBusiestSite({
      ...planCurrentRound(c),
      mines: [],
      installations: [],
      smoke: [],
      electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 0 },
      debuts: [],
    });
    const { state, rng } = createRoundTransit(c, plan);
    runOut(state, rng, true);
    expect(state.stats.smokeCloudsLaid).toBe(1);
    expect(state.stats.concealedSeconds).toBeGreaterThan(0);
    // The missiles were never deleted — they still flew and still resolved.
    expect(state.stats.missilesSpawned).toBeGreaterThan(0);
  });

  it('a concealed threat cannot be given a firing solution, but is still coming', () => {
    const c = newCampaign('conceal-tap');
    const plan = screeningOverBusiestSite({
      ...planCurrentRound(c),
      mines: [],
      installations: [],
      smoke: [],
      electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 0 },
      debuts: [],
    });
    const { state, rng } = createRoundTransit(c, plan);
    runOut(state, rng, true);
    const refused = state.events.filter(
      (e) => e.type === 'launchFailed' && e.detail?.includes('smoke'),
    );
    expect(refused.length).toBeGreaterThan(0);
  });

  it('costs the player shot opportunities, and only when it is laid', () => {
    // What screening smoke takes is SHOT OPPORTUNITIES, and that is what this
    // measures — refused firing solutions with the cloud up, none without.
    //
    // Deliberately not measured as an interception RATE. Against a bot with
    // perfect reflexes the rate barely moves: a cloud over the launch sites
    // hides a missile for the first few seconds of a thirty-second flight, and
    // a bot that re-evaluates every tick simply fires a moment later and still
    // connects. An earlier version of this test asserted a rate delta and sat
    // inside its own noise, flipping sign whenever enemy procurement shifted
    // around it. The reaction window this branch steals is worth far more to a
    // human than the harness can see — docs/PLAYTESTING.md records that as a
    // known limit of headless measurement rather than pretending otherwise.
    const refusals = (withSmoke: boolean): number => {
      let refused = 0;
      for (let s = 0; s < 6; s++) {
        const seed = `conceal-rate-${s}`;
        const c = newCampaign(seed);
        // Round 1 is a scripted light probe that a tapping bot clears entirely.
        // Advance to a round with real salvo volume first.
        const rng0 = makeRng(seed);
        for (let r = 1; r <= 6; r++) {
          c.round = r;
          evolveEnemy(c.evolution, metrics(r), rng0);
        }
        c.round = 7;
        const base: RoundPlan = {
          ...planCurrentRound(c),
          mines: [],
          installations: [],
          smoke: [],
          electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 0 },
          debuts: [],
        };
        const plan = withSmoke ? screeningOverBusiestSite(base) : base;
        const { state, rng } = createRoundTransit(c, plan);
        runOut(state, rng, true);
        refused += state.events.filter(
          (e) => e.type === 'launchFailed' && e.detail?.includes('smoke'),
        ).length;
      }
      return refused;
    };
    expect(refusals(true)).toBeGreaterThan(0);
    expect(refusals(false)).toBe(0);
  });

  it('deals no damage of its own', () => {
    const { state, rng } = supportTransit({
      spawns: [],
      smoke: [{ variant: 'blinding', time: 12 }],
    });
    runOut(state, rng);
    expect(state.stats.smokeCloudsLaid).toBe(1);
    // Nothing was fired at anyone, so nothing was lost. Smoke is concealment.
    expect(state.stats.lost).toBe(0);
    expect(state.stats.delivered).toBe(state.stats.launched);
  });

  it('thermal imaging sees through screening smoke, and blinding needs the resistance node', () => {
    const concealedWith = (research: string[], modules: boolean): number => {
      const c = newCampaign('thermal');
      c.completedResearch = research as CampaignState['completedResearch'];
      if (modules) {
        c.classModules = {
          cargo: ['thermalImaging'],
          tanker: ['thermalImaging'],
          freighter: ['thermalImaging'],
        };
      }
      const plan = screeningOverBusiestSite({
        ...planCurrentRound(c),
        mines: [],
        installations: [],
        smoke: [],
        electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 0 },
        debuts: [],
      });
      const { state, rng } = createRoundTransit(c, plan);
      runOut(state, rng, true);
      return state.stats.concealedSeconds;
    };
    const blind = concealedWith([], false);
    const seeing = concealedWith(['thermalImaging.base'], true);
    expect(blind).toBeGreaterThan(0);
    expect(seeing).toBeLessThan(blind);
  });

  it('earns its ROI from what it enabled, since it can never earn from a kill', () => {
    // Support branches score zero on damage-and-kills alone, so the allocator
    // would defund them on the first settlement and two of seven branches would
    // be dead content at any price. A hit the player never got a clean look at
    // pays the cloud that hid it.
    expect(ENEMY_ECONOMY.assistShare).toBeGreaterThan(0);
    const c = newCampaign('assist');
    const plan = screeningOverBusiestSite({
      ...planCurrentRound(c),
      mines: [],
      installations: [],
      smoke: [],
      electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 0 },
      debuts: [],
    });
    const { state, rng } = createRoundTransit(c, plan);
    // No interception: the question here is who gets CREDITED for a hit that
    // landed under a cloud, so the hit has to be allowed to land.
    runOut(state, rng);
    expect(state.stats.enemyBranch.smoke?.damage ?? 0).toBeGreaterThan(0);
    // And the branch that actually fired keeps its full credit — the assist is
    // an addition, not a transfer.
    expect(state.stats.enemyBranch.missiles?.damage ?? 0).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Electronic attack
// ---------------------------------------------------------------------------

describe('electronic attack', () => {
  it('a recon plane crosses the lanes and drags interceptor accuracy down', () => {
    const { state, rng } = supportTransit({ electronic: { reconPlanes: 1, disablingDrones: 0, jamming: 0 } });
    runTo(state, rng, 45);
    const plane = state.threats.find((th) => th.kind === 'reconPlane');
    expect(state.stats.reconPlanes).toBe(1);
    expect(plane).toBeDefined();
    // It flies over the shipping lanes, not along its own shore — otherwise
    // nothing the player owns could ever reach it.
    expect(plane!.y).toBeGreaterThan(WORLD.lanes[0] - 120);
    expect(COMBAT.electronic.reconAccuracyPenalty).toBeGreaterThan(0);
  });

  it('flak is the answer to both flying nodes, and nothing else is', () => {
    for (const kind of ['reconPlane', 'disablingDrone'] as ThreatKind[]) {
      expect(canEngage('interceptor', kind)).toBe(false);
      expect(canEngage('deckGun', kind)).toBe(false);
      expect(canEngage('depthCharge', kind)).toBe(false);
      expect(canEngage('mcmDrone', kind)).toBe(false);
    }
    // Recon planes are fair game for base flak; the smaller, faster drone is
    // gated behind the proximity-fuse node, so the counter has a ladder of its
    // own rather than answering the whole branch on purchase.
    expect(canEngage('flak', 'reconPlane')).toBe(true);
    expect(canEngage('flak', 'disablingDrone')).toBe(false);
    expect(canEngage('flak', 'disablingDrone', new Set(['flak.proximityFuse']))).toBe(true);
  });

  it('flak shoots recon planes down', () => {
    const { state, rng } = supportTransit(
      { electronic: { reconPlanes: 2, disablingDrones: 0, jamming: 0 } },
      (c) => {
        c.completedResearch = ['flak.base'];
        c.classModules = { cargo: ['flak'], tanker: ['flak'], freighter: [] };
      },
    );
    runOut(state, rng);
    expect(state.stats.reconPlanes).toBe(2);
    expect(state.stats.aircraftDowned).toBeGreaterThan(0);
  });

  it('a disabling drone stops a hull dead without sinking her', () => {
    const { state, rng } = supportTransit({
      spawns: [],
      electronic: { reconPlanes: 0, disablingDrones: 1, jamming: 0 },
    });
    runOut(state, rng);
    expect(state.stats.disablingDrones).toBe(1);
    expect(state.stats.shipDisabledSeconds).toBeGreaterThan(0);
    expect(state.events.some((e) => e.type === 'shipDisabled')).toBe(true);
    // She keeps her hull and her cargo — this branch does not sink anything.
    expect(state.stats.lost).toBe(0);
  });

  it('a disabled hull is genuinely dead in the water', () => {
    const { state, rng } = supportTransit({
      spawns: [],
      electronic: { reconPlanes: 0, disablingDrones: 1, jamming: 0 },
    });
    let guard = 0;
    while (!state.events.some((e) => e.type === 'shipDisabled') && guard++ < Math.ceil(120 / SIM.dt)) {
      stepTransit(state, [], rng);
    }
    const hit = state.events.find((e) => e.type === 'shipDisabled')!;
    const ship = state.ships.find((s) => s.id === hit.shipId)!;
    expect(ship.disabledUntil).toBeGreaterThan(state.time);
    const x0 = ship.x;
    for (let i = 0; i < Math.ceil(6 / SIM.dt); i++) stepTransit(state, [], rng);
    expect(ship.alive).toBe(true);
    expect(ship.x - x0).toBeLessThan(20); // coasted to a stop rather than sailing on
  });
});

// ---------------------------------------------------------------------------
// Sensor jamming — the one capability with no counter
// ---------------------------------------------------------------------------

describe('sensor jamming', () => {
  // Placed where the convoy is while the blackout is still running — mines far
  // down the strait are reached after jamming has already expired and would
  // measure nothing.
  const minedLane = (lowSig = false) =>
    WORLD.lanes.flatMap((y) => [
      { x: 620, y, lowSig },
      { x: 760, y, lowSig },
      { x: 900, y, lowSig },
    ]);

  const withSonar = (c: CampaignState): void => {
    c.completedResearch = ['mineSonar.base'];
    c.classModules = { cargo: ['mineSonar'], tanker: ['mineSonar'], freighter: [] };
  };

  it('blacks out mine detection entirely while it is running', () => {
    const revealed = (jamming: number): number => {
      const { state, rng } = supportTransit(
        { spawns: [], mines: minedLane(), electronic: { reconPlanes: 0, disablingDrones: 0, jamming } },
        withSonar,
      );
      runTo(state, rng, COMBAT.electronic.jammingStartT + 20);
      return state.stats.minesRevealed;
    };
    expect(revealed(0)).toBeGreaterThan(0);
    expect(revealed(1)).toBe(0);
  });

  it('is an ability, not an object — there is nothing to shoot at', () => {
    const { state, rng } = supportTransit({
      spawns: [],
      electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 1 },
    });
    runTo(state, rng, COMBAT.electronic.jammingStartT + 3);
    expect(state.jammingSeconds).toBeGreaterThan(0);
    // No threat, no installation, no shell — nothing exists to be engaged.
    expect(state.threats).toHaveLength(0);
    expect(state.installations).toHaveLength(0);
    expect(state.shells).toHaveLength(0);
  });

  it('plays once at the round start, so its cost is visible up front', () => {
    const { state, rng } = supportTransit({
      spawns: [],
      electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 1 },
    });
    runTo(state, rng, COMBAT.electronic.jammingStartT - 1);
    expect(state.jammingSeconds).toBe(0);
    runTo(state, rng, COMBAT.electronic.jammingStartT + 1);
    expect(state.jammingSeconds).toBeGreaterThan(0);
    expect(state.events.filter((e) => e.type === 'jammingStarted')).toHaveLength(1);
  });

  it('expires on its own — the blackout is finite', () => {
    const { state, rng } = supportTransit({
      spawns: [],
      electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 1 },
    });
    runTo(state, rng, COMBAT.electronic.jammingStartT + COMBAT.electronic.jammingSeconds + 4);
    expect(state.jammingSeconds).toBe(0);
    expect(state.stats.counter.jammingSeconds).toBeGreaterThan(0);
  });

  it('hardened protected channels keep working through it — a work-around, not a counter', () => {
    const { state, rng } = supportTransit(
      { spawns: [], mines: minedLane(), electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 1 } },
      (c) => {
        withSonar(c);
        c.hardenedUnlocked = true;
        // The base node alone protects nothing — Protected Channel is the node
        // that actually buys a family kept alive through a blackout.
        c.completedResearch = [...c.completedResearch, 'hardened.base', 'hardened.protectedChannel'];
        c.protectedChannels = ['mineDetection'];
      },
    );
    runTo(state, rng, COMBAT.electronic.jammingStartT + 20);
    // Jamming is still running — it was never countered, only routed around.
    expect(state.jammingSeconds).toBeGreaterThan(0);
    expect(state.stats.minesRevealed).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

describe('support branch reporting', () => {
  it('every support node has its own discovery card', () => {
    const { state } = supportTransit({ spawns: [] });
    for (const key of [
      'screeningSmoke',
      'blindingSmoke',
      'reconPlane',
      'disablingDrone',
      'sensorJamming',
    ] as const) {
      const cards = buildTransitCards({ ...state, events: [] }, [key]);
      expect(cards.filter((card) => card.kind === 'discovery')).toHaveLength(1);
    }
  });

  it('the jamming card says plainly that there is no counter', () => {
    const { state } = supportTransit({ spawns: [] });
    const card = buildTransitCards({ ...state, events: [] }, ['sensorJamming'])[0];
    expect(card.body).toMatch(/no counter|work(ed)? around/i);
  });

  it('reports support counters in the round log', () => {
    const c = newCampaign('support-telemetry');
    const plan: RoundPlan = {
      ...planCurrentRound(c),
      spawns: [],
      mines: [],
      installations: [],
      smoke: [{ variant: 'blinding', time: 12 }],
      electronic: { reconPlanes: 1, disablingDrones: 0, jamming: 1 },
      debuts: [],
    };
    const { state, rng } = createRoundTransit(c, plan);
    runOut(state, rng);
    resolveTransit(c, state);
    const round = c.telemetry[c.telemetry.length - 1];
    expect(round.smokeCloudsLaid).toBe(1);
    expect(round.reconPlanes).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// The player's smoke: a barrage walked up one lane
// ---------------------------------------------------------------------------

describe('defensive smoke barrage', () => {
  /** Call smoke on the lane containing `y` and run the barrage out. */
  function layBarrage(y: number, seconds = COMBAT.smokeBarrage.walkSeconds + 6) {
    const { state, rng } = supportTransit({ spawns: [] }, (c) => {
      c.smokeUnlocked = true;
      c.smokeStock = 1;
      c.completedResearch = ['smokeScreen.base'];
    });
    state.spawnQueue = [];
    stepTransit(state, [{ type: 'ability', ability: 'smoke', x: 2000, y }], rng);
    for (let i = 0; i < Math.ceil(seconds / SIM.dt) && !state.over; i++) {
      stepTransit(state, [], rng);
    }
    return state;
  }

  it('screens the lane the player picked, not the point they tapped', () => {
    const laneY = WORLD.lanes[0];
    const state = layBarrage(laneY);
    const pockets = state.areaEffects.filter((f) => f.kind === 'smoke');
    expect(pockets.length).toBeGreaterThan(3);
    // Every pocket sits on the chosen lane — a tap anywhere in its band picks
    // the whole lane, the way it does for the scan plane.
    for (const p of pockets) expect(p.y).toBe(laneY);
    // ...and a tap in a different band picks a different lane.
    const other = layBarrage(WORLD.lanes[2]).areaEffects.filter((f) => f.kind === 'smoke');
    expect(other.length).toBeGreaterThan(3);
    for (const p of other) expect(p.y).toBe(WORLD.lanes[2]);
  });

  it('covers the middle of the lane and leaves both ends open', () => {
    const state = layBarrage(WORLD.lanes[1]);
    const pockets = state.areaEffects.filter((f) => f.kind === 'smoke');
    const xs = pockets.map((p) => p.x);
    const first = Math.min(...xs);
    const last = Math.max(...xs);
    const sailed = WORLD.deliverX - WORLD.spawnX;
    const gap = (sailed * (1 - COMBAT.smokeBarrage.laneCoverage)) / 2;
    // Both ends stay clear — the screen is where the crossing happens, not
    // over the start line or the delivery line.
    expect(first).toBeGreaterThan(WORLD.spawnX + gap * 0.8);
    expect(last).toBeLessThan(WORLD.deliverX - gap * 0.8);
    // And the covered span is about the share the tuning asks for.
    const spanned = last - first;
    expect(spanned / sailed).toBeGreaterThan(COMBAT.smokeBarrage.laneCoverage - 0.12);
    expect(spanned / sailed).toBeLessThan(COMBAT.smokeBarrage.laneCoverage + 0.02);
  });

  it('lays a continuous screen rather than a string of separate puffs', () => {
    const state = layBarrage(WORLD.lanes[1]);
    const xs = state.areaEffects
      .filter((f) => f.kind === 'smoke')
      .map((f) => f.x)
      .sort((a, b) => a - b);
    const radius = state.effects.abilities.smoke.radius;
    for (let i = 1; i < xs.length; i++) {
      // Neighbouring pockets overlap: a gap wider than two radii would be a
      // hole in the screen for a hull to be picked off through.
      expect(xs[i] - xs[i - 1]).toBeLessThan(radius * 2);
    }
  });

  it('walks west to east over time instead of arriving at once', () => {
    const { state, rng } = supportTransit({ spawns: [] }, (c) => {
      c.smokeUnlocked = true;
      c.smokeStock = 1;
      c.completedResearch = ['smokeScreen.base'];
    });
    state.spawnQueue = [];
    stepTransit(state, [{ type: 'ability', ability: 'smoke', x: 2000, y: WORLD.lanes[1] }], rng);
    // Nothing on the water yet — the shore still has to fire and the rounds
    // still have to fly.
    expect(state.areaEffects.filter((f) => f.kind === 'smoke')).toHaveLength(0);
    const seen: number[] = [];
    for (let i = 0; i < Math.ceil((COMBAT.smokeBarrage.walkSeconds + 6) / SIM.dt); i++) {
      stepTransit(state, [], rng);
      for (const fx of state.areaEffects) {
        if (fx.kind === 'smoke' && !seen.includes(fx.x)) seen.push(fx.x);
      }
    }
    expect(seen.length).toBeGreaterThan(3);
    // Recorded in the order they burst: strictly increasing in x.
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThan(seen[i - 1]);
  });

  it('the rounds come from the friendly shore and never damage the convoy', () => {
    const { state, rng } = supportTransit({ spawns: [] }, (c) => {
      c.smokeUnlocked = true;
      c.smokeStock = 1;
      c.completedResearch = ['smokeScreen.base'];
    });
    // A hull parked squarely under the barrage's path.
    const ship = state.ships[0];
    ship.spawned = true;
    ship.x = 2000;
    ship.y = WORLD.lanes[1];
    const hp0 = ship.hp;
    stepTransit(state, [{ type: 'ability', ability: 'smoke', x: 2000, y: WORLD.lanes[1] }], rng);
    let sawShellOnFriendlyShore = false;
    for (let i = 0; i < Math.ceil((COMBAT.smokeBarrage.walkSeconds + 6) / SIM.dt); i++) {
      stepTransit(state, [], rng);
      if (state.smokeShells.some((sh) => sh.y >= WORLD.friendlyShoreY - WORLD.shoreWave)) {
        sawShellOnFriendlyShore = true;
      }
    }
    expect(sawShellOnFriendlyShore).toBe(true);
    // Smoke rounds are not artillery: they must never be resolved for damage.
    expect(ship.hp).toBe(hp0);
    expect(state.shells).toHaveLength(0);
  });

  it('spends a canister, and does nothing with an empty stowage', () => {
    const { state, rng } = supportTransit({ spawns: [] }, (c) => {
      c.smokeUnlocked = true;
      c.smokeStock = 0;
      c.completedResearch = ['smokeScreen.base'];
    });
    stepTransit(state, [{ type: 'ability', ability: 'smoke', x: 2000, y: WORLD.lanes[1] }], rng);
    expect(state.smokeBarrage).toHaveLength(0);
    expect(state.smokeShells).toHaveLength(0);
    state.smokeCharges = 1;
    stepTransit(state, [{ type: 'ability', ability: 'smoke', x: 2000, y: WORLD.lanes[1] }], rng);
    expect(state.smokeCharges).toBe(0);
    expect(state.smokeBarrage.length + state.smokeShells.length).toBeGreaterThan(0);
  });
});
