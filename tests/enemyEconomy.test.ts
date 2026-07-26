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
import type { EnemyBranchKey } from '../src/data/enemyBranches';
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
    torpedoDetectRate: -1,
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

/** Every unit a branch bought across the whole run, summed per node.
 *
 *  A single round's composition is a poor measuring stick: units are whole
 *  numbers and a branch holding a quarter of the budget buys two or three of
 *  them, so a real change in the escalation share frequently cannot move it at
 *  all. Summing the campaign's purchases integrates that quantization away and
 *  measures the same observable thing — what the enemy actually built. */
function unitsOverRun(
  rounds: number,
  shape: (round: number) => Partial<RoundMetrics>,
  seed: string,
  branch: EnemyBranchKey,
): Record<string, number> {
  const evo = newEvolution();
  const rng = makeRng(seed);
  const totals: Record<string, number> = {};
  for (let r = 1; r <= rounds; r++) {
    evolveEnemy(evo, metrics(r, shape(r)), rng);
    for (const [node, n] of Object.entries(evo.economy.ledgers[branch].units)) {
      totals[node] = (totals[node] ?? 0) + n;
    }
  }
  return totals;
}

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

  it('does not let an idle round launder a failing branch back to optimism', () => {
    // Regression. ROI fell back to the neutral prior whenever a branch spent
    // nothing that round, and "spent nothing" also covers "was allocated too
    // little to afford a single unit". A branch the player had comprehensively
    // beaten could therefore skip one round and come back scored as though it
    // had never been tried — so the allocator kept refunding it. With four
    // branches splitting the budget this happens constantly.
    const evo = newEvolution();
    const rng = makeRng('launder');
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
    const mines = evo.economy.ledgers.mines;
    expect(evo.economy.openBranches).toContain('mines');
    // Ten rounds of earning nothing must not read as neutral.
    expect(mines.roi).toBeLessThan(ENEMY_ECONOMY.priorRoi);
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

  // The escalation tests below hold the SEED constant across both arms and vary
  // only the counter signal. Different seeds give the exploration jitter its own
  // say in branch shares, which drowns out the effect being measured — an
  // earlier version of the mine test compared two seeds and passed for rounds
  // while the signal it claimed to check was doing nothing at all.
  /** Share of everything the branch built over the run that was the newest node. */
  const escalatedShare = (
    rounds: number,
    shape: Partial<RoundMetrics>,
    seed: string,
    branch: EnemyBranchKey,
    node: string,
  ): number => {
    const totals = unitsOverRun(rounds, () => shape, seed, branch);
    const all = totalUnits(totals);
    return all > 0 ? (totals[node] ?? 0) / all : 0;
  };

  /** Run both arms over many seeds, varying ONLY the counter signal; the
   *  countered arm must escalate at least as far every time and strictly
   *  further on a clear majority. */
  const expectEscalation = (
    rounds: number,
    branch: EnemyBranchKey,
    node: string,
    counteredMetrics: Partial<RoundMetrics>,
    ignoredMetrics: Partial<RoundMetrics>,
  ): void => {
    let strictlyHigher = 0;
    const seeds = 10;
    for (let i = 0; i < seeds; i++) {
      const seed = `esc-${branch}-${i}`;
      const countered = escalatedShare(rounds, counteredMetrics, seed, branch, node);
      const ignored = escalatedShare(rounds, ignoredMetrics, seed, branch, node);
      expect(countered).toBeGreaterThanOrEqual(ignored);
      if (countered > ignored) strictlyHigher++;
    }
    expect(strictlyHigher).toBeGreaterThanOrEqual(seeds / 2);
  };

  it('escalates within a branch the player is hard-countering', () => {
    // A player intercepting nearly everything should push the missile branch
    // up its node ladder (unguided -> guided) rather than just buying more.
    expectEscalation(6, 'missiles', 'guided', { interceptRate: 0.95 }, { interceptRate: 0.05 });
  });

  it('escalates to low-signature mines when the player charts standard ones', () => {
    expectEscalation(14, 'mines', 'lowSig', { mineDetectRate: 0.95 }, { mineDetectRate: 0.05 });
  });

  it('escalates to low-signature torpedoes when the player hears and kills them', () => {
    expectEscalation(
      12,
      'torpedoes',
      'lowSigTorpedo',
      { torpedoDetectRate: 0.95 },
      { torpedoDetectRate: 0.05 },
    );
  });

  it('answers a counter even on a branch that has already maxed its tenure escalation', () => {
    // Regression: the countered bonus used to be summed BEFORE the tenure clamp,
    // so any branch invested in for ~6 rounds was already pinned at
    // escalationShareMax and the player's counter changed nothing.
    const longRun = runEconomy(12, () => ({ mineDetectRate: -1 }), 'clamp');
    expect(longRun.economy.ledgers.mines.roundsInvested).toBeGreaterThan(
      (ENEMY_ECONOMY.escalationShareMax - ENEMY_ECONOMY.escalationShareBase) /
        ENEMY_ECONOMY.escalationSharePerRound,
    );
    expectEscalation(12, 'mines', 'lowSig', { mineDetectRate: 0.95 }, { mineDetectRate: -1 });
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
