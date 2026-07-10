// Headless simulation tests. These play entire campaigns with scripted bot
// policies to prove the loop works end-to-end without a browser, and to pin
// the designed early-campaign beats (guided missiles by R3, mines by R5,
// fairness caps, capacity growth, determinism).

import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/sim/rng';
import {
  buyAmmo,
  createRoundTransit,
  newCampaign,
  planCurrentRound,
  repairFleet,
  resolveTransit,
  startResearch,
  unlockScan,
} from '../src/sim/campaign';
import { stepTransit } from '../src/sim/transit';
import { evolveEnemy, newEvolution, planRound } from '../src/sim/evolution';
import { saveCampaign, loadCampaign, clearCampaign } from '../src/platform/save';
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
    if (opts.defend && state.escorts.some((e) => e.cooldown <= 0) && state.ammo > 0) {
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

/** Minimal sensible procurement between rounds. */
function botProcure(c: CampaignState): void {
  repairFleet(c);
  while (c.ammo < 14 && buyAmmo(c, 1)) {
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

  it('round 1 heavily favors a defending player', () => {
    const c = newCampaign('friendly-start');
    const { state } = runRound(c, { defend: true });
    expect(state.stats.launched).toBe(20);
    expect(state.stats.delivered).toBeGreaterThanOrEqual(18);
    expect(state.stats.lost).toBeLessThanOrEqual(2);
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
    const play = (defend: boolean): number => {
      const c = newCampaign('ab-test');
      let lost = 0;
      for (let r = 0; r < 4; r++) {
        const { state } = runRound(c, { defend });
        lost += state.stats.lost;
        botProcure(c);
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
  it('round 1 is a small unguided attack with no mines', () => {
    const c = newCampaign('r1');
    const plan = planCurrentRound(c);
    expect(plan.spawns.length).toBe(4);
    expect(plan.spawns.every((s) => s.kind === 'missile')).toBe(true);
    expect(plan.mines.length).toBe(0);
  });

  it('guided missiles appear by round 3 with a fairness cap', () => {
    const c = newCampaign('beats');
    const rng = makeRng('evo');
    evolveEnemy(c.evolution, syntheticMetrics(1), rng);
    evolveEnemy(c.evolution, syntheticMetrics(2), rng);
    c.round = 3;
    const plan = planRound(c, makeRng('plan3'));
    const guided = plan.spawns.filter((s) => s.kind === 'guidedMissile');
    expect(guided.length).toBeGreaterThanOrEqual(1);
    expect(guided.length).toBeLessThanOrEqual(2);
    expect(plan.debuts).toContain('guidedMissile');
  });

  it('mines appear by round 5 at the latest, small first field in the main channel', () => {
    const c = newCampaign('beats2');
    const rng = makeRng('evo2');
    for (let r = 1; r <= 4; r++) evolveEnemy(c.evolution, syntheticMetrics(r), rng);
    c.round = 5;
    const plan = planRound(c, makeRng('plan5'));
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

  it('emits an intelligence warning before an unseen capability debuts', () => {
    const evo = newEvolution();
    const rng = makeRng('warn');
    // Guidance floor after round 2 is exactly at the unlock threshold, so a
    // warning about guided missiles must be pending before round 3.
    evolveEnemy(evo, syntheticMetrics(1), rng);
    evolveEnemy(evo, syntheticMetrics(2), rng);
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
    const startCapacity = c.capacity;
    let increased = false;
    for (let r = 0; r < 4 && !increased; r++) {
      const { report } = runRound(c, { defend: true, useScan: true });
      increased = report.capacityIncreased;
      botProcure(c);
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
