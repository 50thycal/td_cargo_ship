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
  createRoundTransit,
  moduleCost,
  newCampaign,
  planCurrentRound,
  repairFleet,
  resolveTransit,
  setComposition,
  startResearch,
  unlockScan,
} from '../src/sim/campaign';
import { stepTransit } from '../src/sim/transit';
import { evolveEnemy, newEvolution, planRound } from '../src/sim/evolution';
import { buildTelemetryExport } from '../src/sim/telemetry';
import { saveCampaign, loadCampaign, clearCampaign } from '../src/platform/save';
import { SHIP_CLASSES } from '../src/data/defs';
import { WORLD } from '../src/data/tuning';
import type {
  AfterActionReport,
  CampaignState,
  RoundMetrics,
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
      cmds.push({ type: 'ability', ability: 'scan' });
      scanUsedAt = state.time;
    }
    stepTransit(state, cmds, rng);
  }
  const report = resolveTransit(c, state);
  return { state, report };
}

/** Minimal sensible procurement between rounds: keep enough firepower up. */
function botProcure(c: CampaignState): void {
  repairFleet(c);
  buyBase(c); // more shore batteries = higher sustained fire rate
  buyEscort(c);
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
    const evoDetected = newEvolution();
    const evoUndetected = newEvolution();
    const rng1 = makeRng('lowsig1');
    const rng2 = makeRng('lowsig2');
    for (let r = 1; r <= 8; r++) {
      evolveEnemy(evoDetected, syntheticMetrics(r, { mineDetectRate: 0.9 }), rng1);
      evolveEnemy(evoUndetected, syntheticMetrics(r, { mineDetectRate: 0.1 }), rng2);
    }
    expect(evoDetected.tracks.lowSig).toBeGreaterThan(evoUndetected.tracks.lowSig);
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
  it('awards cash and intel after a round', () => {
    const c = newCampaign('economy');
    const startCash = c.cash;
    const { report } = runRound(c, { defend: true });
    expect(report.cashEarned).toBeGreaterThan(0);
    expect(c.cash).toBe(startCash + report.cashEarned);
    expect(report.intelEarned).toBeGreaterThan(0);
  });

  it('capacity grows after two consecutive strong rounds', () => {
    const c = newCampaign('growth');
    // Heavy defense + a light convoy so deliveries are reliably strong, which
    // isolates the growth mechanic from round-to-round combat variance.
    c.bases = 4;
    c.ammo = 120;
    setComposition(c, 'cargo', 6);
    setComposition(c, 'tanker', 0);
    setComposition(c, 'freighter', 0);
    const startCapacity = c.capacity;
    let increased = false;
    for (let r = 0; r < 3 && !increased; r++) {
      const { report } = runRound(c, { defend: true, useScan: true });
      increased = report.capacityIncreased;
      c.ammo = 120;
      repairFleet(c);
    }
    expect(increased).toBe(true);
    expect(c.capacity).toBe(startCapacity + 5);
  });

  it('research takes one full round before completing', () => {
    const c = newCampaign('research');
    c.intel = 100;
    expect(startResearch(c, 'intercept1')).toBe(true);
    expect(c.completedResearch).toHaveLength(0);
    const { report } = runRound(c, { defend: true });
    expect(report.researchCompleted).toBe('intercept1');
    expect(c.completedResearch).toContain('intercept1');
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
    const fullPrice = moduleCost(c, 'cargo', 'pointDefense');
    setComposition(c, 'cargo', 0);
    expect(moduleCost(c, 'cargo', 'pointDefense')).toBe(fullPrice);
    setComposition(c, 'cargo', 15);
    expect(fullPrice).toBe(110 * 15);
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

describe('transit hardening', () => {
  it('a second ECM command while a burst is active does not burn a charge', () => {
    const c = newCampaign('ecm-stack');
    c.ecmUnlocked = true;
    const plan = planCurrentRound(c);
    const { state, rng } = createRoundTransit(c, plan);
    stepTransit(state, [{ type: 'ability', ability: 'ecm' }], rng);
    expect(state.ecmCharges).toBe(1);
    stepTransit(state, [{ type: 'ability', ability: 'ecm' }], rng);
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

  it('reports quota evaluation as round 3 of the window', () => {
    const c = newCampaign('quota-window');
    let lastReport;
    for (let r = 0; r < 3; r++) {
      lastReport = runRound(c, { defend: true }).report;
    }
    expect(lastReport!.quota.evaluated).toBe(true);
    expect(lastReport!.quota.windowRound).toBe(3);
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
    expect(c.escorts).toBe(0);
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
    expect(c.escorts).toBe(3);
    expect(buyEscort(c)).toBe(false);
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
    c.escorts = 1;
    const { state, rng } = createRoundTransit(c, planCurrentRound(c));
    state.spawnQueue = [];
    state.threats = [];
    const escort = state.escorts[0];
    const targetX = 900;
    const targetY = WORLD.lanes[0];
    stepTransit(state, [{ type: 'moveEscort', escortId: escort.id, x: targetX, y: targetY }], rng);
    expect(escort.moveTarget).not.toBeNull();
    // Steam until it arrives (target cleared).
    for (let i = 0; i < 30 * 60 && escort.moveTarget; i++) stepTransit(state, [], rng);
    expect(escort.moveTarget).toBeNull();
    expect(Math.hypot(escort.x - targetX, escort.y - targetY)).toBeLessThan(40);
    // Now it resumes forward motion (x increases over the next second).
    const x0 = escort.x;
    for (let i = 0; i < 30; i++) stepTransit(state, [], rng);
    expect(escort.x).toBeGreaterThan(x0);
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
  it('round-trips the campaign state', () => {
    clearCampaign();
    const c = newCampaign('savegame');
    runRound(c, { defend: true });
    saveCampaign(c);
    const loaded = loadCampaign();
    expect(loaded).not.toBeNull();
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(c));
    clearCampaign();
  });

  it('returns null when nothing is saved', () => {
    clearCampaign();
    expect(loadCampaign()).toBeNull();
  });
});
