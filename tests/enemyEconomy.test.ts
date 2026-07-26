// The enemy procurement economy (docs/SEESAW.md).
//
// These tests pin the MECHANISM that makes the seesaw real: a budget that
// grows, gets committed in full, and is reallocated according to which attacks
// are actually paying off. The designed early beats (round-1 probe, guided by
// R2, mines by R3, first-appearance caps) are pinned in sim.test.ts and must
// keep passing alongside these.

import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/sim/rng';
import { evolveEnemy, newEvolution, planRound, targetingSkill } from '../src/sim/evolution';
import { newCampaign, planCurrentRound } from '../src/sim/campaign';
import { migrateCampaign } from '../src/platform/save';
import { ENEMY_BRANCHES, ENEMY_BRANCH_ORDER } from '../src/data/enemyBranches';
import { ENEMY_ECONOMY } from '../src/data/tuning';
import type { EvolutionState, RoundMetrics } from '../src/sim/types';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function metrics(round: number, over: Partial<RoundMetrics> = {}): RoundMetrics {
  return {
    round,
    interceptRate: 0.5,
    formation: 'sprint', // avoids the tight/wide formation tells skewing shares
    mineDetectRate: -1,
    valueSent: 241,
    deliveredFraction: 0.75,
    branchResults: {},
    ...over,
  };
}

/** Play `rounds` of enemy evolution with a fixed player performance. */
function runEconomy(
  rounds: number,
  shape: (round: number) => Partial<RoundMetrics>,
  seed = 'econ',
): EvolutionState {
  const evo = newEvolution();
  const rng = makeRng(seed);
  for (let r = 1; r <= rounds; r++) {
    evolveEnemy(evo, metrics(r, shape(r)), rng);
  }
  return evo;
}

const totalUnits = (units: Record<string, number>): number =>
  Object.values(units).reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

describe('enemy budget', () => {
  it('grows every round, so absolute pressure always trends upward', () => {
    const budgets: number[] = [];
    const evo = newEvolution();
    const rng = makeRng('growth');
    for (let r = 1; r <= 8; r++) {
      evolveEnemy(evo, metrics(r), rng);
      budgets.push(evo.economy.budget);
    }
    for (let i = 1; i < budgets.length; i++) {
      expect(budgets[i]).toBeGreaterThan(budgets[i - 1]);
    }
  });

  it('is capped so a long campaign cannot run away', () => {
    const evo = runEconomy(40, () => ({}));
    expect(evo.economy.budget).toBeLessThanOrEqual(ENEMY_ECONOMY.budgetCap);
  });

  it('arms the enemy faster against a dominating player (anti-snowball, hot end)', () => {
    const dominating = runEconomy(6, () => ({
      deliveredFraction: 0.95,
      interceptRate: 0.9,
    }));
    const ordinary = runEconomy(6, () => ({
      deliveredFraction: 0.7,
      interceptRate: 0.4,
    }));
    expect(dominating.economy.budget).toBeGreaterThan(ordinary.economy.budget);
  });

  it('damps growth against a struggling player (anti-snowball, cold end)', () => {
    const struggling = runEconomy(6, () => ({
      deliveredFraction: 0.35,
      interceptRate: 0.2,
    }));
    const ordinary = runEconomy(6, () => ({
      deliveredFraction: 0.7,
      interceptRate: 0.4,
    }));
    expect(struggling.economy.budget).toBeLessThan(ordinary.economy.budget);
  });
});

// ---------------------------------------------------------------------------
// Spend-or-scrap
// ---------------------------------------------------------------------------

describe('spend-or-scrap', () => {
  it('commits the budget each round and banks nothing for a super-round', () => {
    const evo = runEconomy(8, () => ({}));
    const { budget, committed, scrapped } = evo.economy;
    // Everything granted is either committed or scrapped — never carried.
    expect(committed + scrapped).toBeLessThanOrEqual(budget + 1);
    expect(committed).toBeGreaterThan(budget * 0.5);
  });

  it('wastes only a small fraction of the budget as scrap', () => {
    let budget = 0;
    let scrapped = 0;
    const evo = newEvolution();
    const rng = makeRng('scrap');
    for (let r = 1; r <= 12; r++) {
      evolveEnemy(evo, metrics(r), rng);
      budget += evo.economy.budget;
      scrapped += evo.economy.scrapped;
    }
    // SEESAW.md wants scrap low-but-non-zero; consistently high scrap means a
    // unit is priced badly against the budget granularity.
    expect(scrapped / budget).toBeLessThan(0.15);
  });

  it('never funds a branch the simulation cannot actually field', () => {
    const evo = runEconomy(15, () => ({}));
    for (const key of ENEMY_BRANCH_ORDER) {
      if (ENEMY_BRANCHES[key].implemented) continue;
      expect(evo.economy.ledgers[key].spend, `${key} must not be funded`).toBe(0);
      expect(evo.economy.ledgers[key].share, `${key} must have no share`).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Adaptive allocation — the seesaw's engine
// ---------------------------------------------------------------------------

describe('adaptive allocation', () => {
  it('cuts a branch that stops paying and funds one that does', () => {
    // Mines earn nothing (the player has countered them); missiles earn well.
    const evo = newEvolution();
    const rng = makeRng('pivot');
    for (let r = 1; r <= 10; r++) {
      evolveEnemy(
        evo,
        metrics(r, {
          branchResults: {
            missiles: { result: 60, kills: 6 },
            mines: { result: 0, kills: 0 },
          },
        }),
        rng,
      );
    }
    const { missiles, mines } = evo.economy.ledgers;
    expect(missiles.share).toBeGreaterThan(mines.share);
    expect(missiles.roi).toBeGreaterThan(mines.roi);
  });

  it('reverses that preference when the payoff reverses', () => {
    // Same setup, opposite results: mines earn, missiles do not.
    const evo = newEvolution();
    const rng = makeRng('pivot-2');
    for (let r = 1; r <= 10; r++) {
      evolveEnemy(
        evo,
        metrics(r, {
          branchResults: {
            missiles: { result: 0, kills: 0 },
            mines: { result: 80, kills: 8 },
          },
        }),
        rng,
      );
    }
    const { missiles, mines } = evo.economy.ledgers;
    expect(mines.share).toBeGreaterThan(missiles.share);
  });

  it('never permanently abandons a branch, so it can become attractive again', () => {
    const evo = newEvolution();
    const rng = makeRng('floor');
    for (let r = 1; r <= 12; r++) {
      evolveEnemy(
        evo,
        metrics(r, {
          branchResults: {
            missiles: { result: 100, kills: 10 },
            mines: { result: 0, kills: 0 },
          },
        }),
        rng,
      );
    }
    // Mines were useless for a dozen rounds but keep a floor share.
    expect(evo.economy.ledgers.mines.share).toBeGreaterThanOrEqual(
      ENEMY_ECONOMY.minBranchShare * 0.5,
    );
  });

  it('escalates within a branch the player is hard-countering', () => {
    // A player intercepting nearly everything should push the missile branch
    // up its node ladder (unguided -> guided) rather than just buying more.
    const countered = runEconomy(6, () => ({ interceptRate: 0.95 }), 'esc-hi');
    const ignored = runEconomy(6, () => ({ interceptRate: 0.05 }), 'esc-lo');
    const guidedShare = (evo: EvolutionState): number => {
      const units = evo.economy.ledgers.missiles.units;
      const total = totalUnits(units);
      return total > 0 ? (units.guided ?? 0) / total : 0;
    };
    expect(guidedShare(countered)).toBeGreaterThan(guidedShare(ignored));
  });

  it('escalates to low-signature mines when the player charts standard ones', () => {
    const detected = runEconomy(9, () => ({ mineDetectRate: 0.95 }), 'mine-hi');
    const missed = runEconomy(9, () => ({ mineDetectRate: 0.05 }), 'mine-lo');
    const lowSigOf = (evo: EvolutionState): number => evo.economy.ledgers.mines.units.lowSig ?? 0;
    expect(lowSigOf(detected)).toBeGreaterThanOrEqual(lowSigOf(missed));
  });
});

// ---------------------------------------------------------------------------
// Nodes, caps and targeting
// ---------------------------------------------------------------------------

describe('escalation guardrails', () => {
  it('respects each node’s first-appearance cap on its debut round', () => {
    const c = newCampaign('debut-cap');
    const evo = c.evolution;
    evolveEnemy(evo, metrics(1), makeRng('cap'));
    c.round = 2;
    const plan = planRound(c, makeRng('cap-plan'));
    const guided = plan.spawns.filter((s) => s.kind === 'guidedMissile').length;
    const cap = ENEMY_BRANCHES.missiles.nodes.find((n) => n.id === 'guided')!.firstAppearanceCap;
    expect(guided).toBeGreaterThanOrEqual(1);
    expect(guided).toBeLessThanOrEqual(cap);
  });

  it('never fields a node before its progression gate', () => {
    const evo = newEvolution();
    const rng = makeRng('gates');
    for (let r = 1; r <= 4; r++) {
      evolveEnemy(evo, metrics(r), rng);
      const nextRound = r + 1;
      for (const key of ENEMY_BRANCH_ORDER) {
        for (const node of ENEMY_BRANCHES[key].nodes) {
          const units = evo.economy.ledgers[key].units[node.id] ?? 0;
          if (units > 0) {
            expect(nextRound, `${node.id} fielded before gate`).toBeGreaterThanOrEqual(
              node.gateRound,
            );
          }
        }
      }
    }
  });

  it('climbs the shared targeting ladder as it fields new nodes', () => {
    const fresh = newEvolution();
    const late = runEconomy(10, () => ({}));
    // A fresh enemy is unaimed; fielding nodes teaches it to aim.
    expect(fresh.economy.targetingTier).toBe(0);
    expect(late.economy.targetingTier).toBeGreaterThan(0);
    // And the doctrine feeds the sim as a bounded aiming skill.
    expect(targetingSkill(late.economy)).toBeGreaterThan(0);
    expect(targetingSkill(late.economy)).toBeLessThanOrEqual(1);
  });

  it('is capped at the highest rung its IMPLEMENTED branches can grant', () => {
    // The ladder is content-limited exactly like the oscillation signal: T2/T4/
    // T5/T6 are granted by artillery, boats, drones and smoke, none of which
    // the sim fields yet. This test rises automatically as those land — if it
    // starts failing, the ladder should be climbing further and isn't.
    const grantable = ENEMY_BRANCH_ORDER.flatMap((key) =>
      ENEMY_BRANCHES[key].implemented
        ? ENEMY_BRANCHES[key].nodes
            .filter((n) => n.implemented && n.grantsTargeting !== undefined)
            .map((n) => n.grantsTargeting!)
        : [],
    );
    const ceiling = Math.max(0, ...grantable);
    const late = runEconomy(20, () => ({}));
    expect(late.economy.targetingTier).toBe(ceiling);
  });

  it('runs a newly unlocked targeting rung at reduced weight for one round', () => {
    const evo = runEconomy(2, () => ({}));
    if (evo.economy.targetingDebut !== null) {
      const debutSkill = targetingSkill(evo.economy);
      const settled = { ...evo.economy, targetingDebut: null };
      expect(debutSkill).toBeLessThan(targetingSkill(settled));
    }
  });
});

// ---------------------------------------------------------------------------
// Integration with the round plan
// ---------------------------------------------------------------------------

describe('economy drives the round plan', () => {
  it('turns purchased units into exactly that many attacks', () => {
    const c = newCampaign('plan-match');
    evolveEnemy(c.evolution, metrics(1), makeRng('pm'));
    c.round = 2;
    const plan = planRound(c, makeRng('pm-plan'));
    const ledger = c.evolution.economy.ledgers.missiles;
    const unguided = plan.spawns.filter((s) => s.kind === 'missile').length;
    const guided = plan.spawns.filter((s) => s.kind === 'guidedMissile').length;
    expect(unguided).toBe(ledger.units.unguided ?? 0);
    expect(guided).toBe(ledger.units.guided ?? 0);
  });

  it('lays exactly the mines it bought, low-signature ones included', () => {
    const c = newCampaign('mine-match');
    const rng = makeRng('mm');
    for (let r = 1; r <= 5; r++) {
      evolveEnemy(c.evolution, metrics(r, { mineDetectRate: 0.9 }), rng);
    }
    c.round = 6;
    const plan = planRound(c, makeRng('mm-plan'));
    const ledger = c.evolution.economy.ledgers.mines;
    const bought = (ledger.units.standard ?? 0) + (ledger.units.lowSig ?? 0);
    expect(plan.mines.length).toBe(bought);
    expect(plan.mines.filter((m) => m.lowSig).length).toBe(ledger.units.lowSig ?? 0);
  });

  it('keeps round 1 a scripted light probe regardless of the economy', () => {
    const c = newCampaign('r1-probe');
    const plan = planCurrentRound(c);
    expect(plan.spawns.length).toBe(6);
    expect(plan.spawns.every((s) => s.kind === 'missile')).toBe(true);
    expect(plan.mines.length).toBe(0);
  });

  it('never sails an empty round for a save made before the economy existed', () => {
    // A pre-economy save has no committed purchases. Without catch-up
    // procurement the planner would field nothing and the player would resume
    // into an empty strait — a silent, campaign-ruining regression.
    const legacy = migrateCampaign({
      version: 2,
      seed: 'legacy-economy',
      round: 8,
      phase: 'prep',
      completedResearch: ['sensors1', 'intercept1', 'mines1'],
      evolution: {
        tracks: { saturation: 90, guidance: 70, mines: 60, lowSig: 40 },
        firstSeen: { missile: 1, guidedMissile: 2, mine: 3 },
        metrics: [],
        pendingWarnings: [],
        formationTell: null,
      },
    })!;
    expect(legacy.evolution.economy).toBeDefined();
    const plan = planRound(legacy, makeRng('legacy-plan'));
    expect(plan.spawns.length).toBeGreaterThan(0);
    expect(legacy.evolution.economy.committed).toBeGreaterThan(0);
    // And the round it planned for is recorded, so it does not re-buy.
    expect(legacy.evolution.economy.plannedForRound).toBe(8);
  });

  it('is deterministic: the same seed reproduces the same procurement', () => {
    const run = (): string => {
      const evo = newEvolution();
      const rng = makeRng('determinism');
      for (let r = 1; r <= 8; r++) evolveEnemy(evo, metrics(r), rng);
      return JSON.stringify(evo.economy);
    };
    expect(run()).toBe(run());
  });
});
