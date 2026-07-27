// The attack-boat branch (docs/ENEMY_ATTACKS.md → Attack Boats): the second
// enemy vertical slice, and the first threat that is a UNIT rather than a shot.
//
// Everything else the enemy fields is spent on use — a missile, a mine and a
// torpedo each resolve once. A boat arrives, commits to a hull, works on it
// until it is gone and then picks another, and it is still there afterwards.
// That is what these tests pin: persistence, commitment, re-targeting, the fact
// that only the deck gun can end it, and the capture mechanic that makes
// absorbing the damage a losing answer.

import { describe, expect, it } from 'vitest';
import { createRoundTransit, newCampaign, planCurrentRound, resolveTransit } from '../src/sim/campaign';
import { stepTransit } from '../src/sim/transit';
import { evolveEnemy, planRound } from '../src/sim/evolution';
import { makeRng } from '../src/sim/rng';
import { buildTransitCards } from '../src/sim/aar';
import { ENEMY_BRANCHES, ENEMY_BRANCH_ORDER } from '../src/data/enemyBranches';
import { canEngage, LOSS_CAUSE_TO_ENEMY_BRANCH, awaitingEnemyCapability, COUNTER_BRANCHES } from '../src/data/counters';
import { CAMPAIGN, COMBAT, EVOLUTION, SIM, WORLD } from '../src/data/tuning';
import type {
  BoatVariant,
  CampaignState,
  RoundMetrics,
  RoundPlan,
  Ship,
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

const LAUNCH_T = EVOLUTION.windowStartT + 4;

const spawn = (variant: BoatVariant, over: Partial<SpawnEvent> = {}): SpawnEvent => ({
  time: LAUNCH_T,
  kind: 'attackBoat',
  siteX: WORLD.launchSites[0].x,
  boatVariant: variant,
  ...over,
});

type Rng = ReturnType<typeof createRoundTransit>['rng'];

/** A transit carrying only the boats under test. */
function boatTransit(
  spawns: SpawnEvent[],
  mutate?: (c: CampaignState) => void,
): { c: CampaignState; state: TransitState; rng: Rng } {
  const c = newCampaign('boat-slice');
  mutate?.(c);
  const plan: RoundPlan = { ...planCurrentRound(c), spawns, mines: [], debuts: [] };
  const { state, rng } = createRoundTransit(c, plan);
  return { c, state, rng };
}

function run(state: TransitState, rng: Rng, ticks: number): void {
  for (let i = 0; i < ticks && !state.over; i++) stepTransit(state, [], rng);
}

const boats = (t: TransitState): Threat[] => t.threats.filter((th) => th.kind === 'attackBoat');

/** Step until the scheduled boats are on the water. */
function launch(spawns: SpawnEvent[], mutate?: (c: CampaignState) => void): {
  c: CampaignState;
  state: TransitState;
  rng: Rng;
  fleet: Threat[];
} {
  const { c, state, rng } = boatTransit(spawns, mutate);
  let guard = 0;
  while (state.spawnQueue.length > 0 && guard++ < Math.ceil((LAUNCH_T + 5) / SIM.dt)) {
    stepTransit(state, [], rng);
  }
  const fleet = boats(state);
  expect(fleet.length).toBe(spawns.length);
  return { c, state, rng, fleet };
}

/** Run a boat all the way in until it is holding station on a hull. */
function engage(spawns: SpawnEvent[], mutate?: (c: CampaignState) => void) {
  const ctx = launch(spawns, mutate);
  let guard = 0;
  while (!ctx.fleet[0].engaging && guard++ < Math.ceil(90 / SIM.dt) && !ctx.state.over) {
    stepTransit(ctx.state, [], ctx.rng);
  }
  return ctx;
}

const victimOf = (state: TransitState, boat: Threat): Ship | undefined =>
  state.ships.find((s) => s.id === boat.targetShipId);

/** Escorts with deck guns and auto-engagement — the branch's only real answer. */
const gunboatEscorts = (c: CampaignState): void => {
  c.completedResearch = ['deckGun.base', 'deckGun.autoNearest'];
  c.escorts = 2;
  c.escortModules = ['deckGun'];
  c.autoFire = { ...c.autoFire, deckGun: true };
};

// ---------------------------------------------------------------------------
// Procurement
// ---------------------------------------------------------------------------

describe('attack-boat procurement', () => {
  it('is an implemented branch with every node implemented', () => {
    const def = ENEMY_BRANCHES.attackBoats;
    expect(def.implemented).toBe(true);
    for (const node of def.nodes) expect(node.implemented).toBe(true);
  });

  it('never fields a boat before its gate round', () => {
    const c = newCampaign('boat-gate');
    const rng = makeRng('boat-gate');
    for (let r = 1; r < ENEMY_BRANCHES.attackBoats.openRound; r++) {
      c.round = r;
      expect(planRound(c, makeRng(`p-${r}`)).spawns.some((s) => s.kind === 'attackBoat')).toBe(false);
      evolveEnemy(c.evolution, metrics(r), rng);
    }
  });

  it('assigns variants to match exactly what the ledger bought', () => {
    const c = newCampaign('boat-variants');
    const rng = makeRng('boat-variants');
    for (let r = 1; r <= 16; r++) {
      c.round = r;
      evolveEnemy(c.evolution, metrics(r), rng);
    }
    c.round = 17;
    c.evolution.economy.ledgers.attackBoats.units = { smallArms: 3, rocket: 2, boarding: 1 };
    c.evolution.economy.plannedForRound = c.round;
    const fired = planRound(c, makeRng('variant-plan')).spawns.filter((s) => s.kind === 'attackBoat');
    expect(fired).toHaveLength(6);
    expect(fired.filter((s) => s.boatVariant === 'boarding')).toHaveLength(1);
    expect(fired.filter((s) => s.boatVariant === 'rocket')).toHaveLength(2);
    expect(fired.filter((s) => s.boatVariant === 'smallArms')).toHaveLength(3);
  });

  it('launches boats early in the window, since a boat needs time to be worth anything', () => {
    const c = newCampaign('boat-timing');
    const rng = makeRng('boat-timing');
    for (let r = 1; r <= 16; r++) {
      c.round = r;
      evolveEnemy(c.evolution, metrics(r), rng);
    }
    c.round = 17;
    c.evolution.economy.ledgers.attackBoats.units = { smallArms: 4 };
    c.evolution.economy.plannedForRound = c.round;
    const plan = planRound(c, makeRng('timing-plan'));
    const boatTimes = plan.spawns.filter((s) => s.kind === 'attackBoat').map((s) => s.time);
    const missileTimes = plan.spawns.filter((s) => s.kind !== 'attackBoat').map((s) => s.time);
    expect(boatTimes.length).toBeGreaterThan(0);
    if (missileTimes.length > 0) {
      expect(Math.max(...boatTimes)).toBeLessThan(Math.max(...missileTimes));
    }
  });

  it('raises the doctrine to whatever rung a node grants when it is fielded', () => {
    // Asserts the GRANT MECHANISM, not affordability. Which round the enemy can
    // first buy the boarding boat — the dearest node in the catalogue — drifts
    // with every branch that ships and competes for the same budget, and an
    // earlier version of this test was really measuring that rather than the
    // doctrine wiring. What must hold is simpler and never drifts: every node
    // the enemy has actually fielded has had its rung honoured.
    const c = newCampaign('boat-doctrine');
    const rng = makeRng('boat-doctrine');
    for (let r = 1; r <= 30; r++) {
      c.round = r;
      evolveEnemy(c.evolution, metrics(r), rng);
    }
    const fielded = c.evolution.economy.nodesFielded;
    const granted = ENEMY_BRANCH_ORDER.flatMap((key) =>
      ENEMY_BRANCHES[key].nodes
        .filter((n) => fielded.includes(n.id) && n.grantsTargeting !== undefined)
        .map((n) => n.grantsTargeting!),
    );
    expect(granted.length).toBeGreaterThan(0);
    expect(c.evolution.economy.targetingTier).toBe(Math.max(...granted));
    // And the boarding node still declares the T4 rung it is responsible for.
    const boarding = ENEMY_BRANCHES.attackBoats.nodes.find((n) => n.id === 'boarding');
    expect(boarding?.grantsTargeting).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Behaviour: a unit, not a shot
// ---------------------------------------------------------------------------

describe('attack-boat behaviour', () => {
  it('puts to sea with hull points and stays on the field', () => {
    const { state, fleet } = launch([spawn('smallArms')]);
    const boat = fleet[0];
    expect(state.stats.boatsLaunched).toBe(1);
    expect(boat.hp).toBe(COMBAT.attackBoat.hp.smallArms);
    expect(boat.maxHp).toBe(COMBAT.attackBoat.hp.smallArms);
    expect(boat.revealed).toBe(true); // a surface craft is not a detection puzzle
  });

  it('closes with the convoy and holds station on one hull', () => {
    const { state, fleet } = engage([spawn('smallArms')]);
    const boat = fleet[0];
    expect(boat.engaging).toBe(true);
    const victim = victimOf(state, boat);
    expect(victim).toBeDefined();
    expect(Math.hypot(victim!.x - boat.x, victim!.y - boat.y)).toBeLessThanOrEqual(
      COMBAT.attackBoat.engageRange + 1,
    );
  });

  it('stays committed to the same hull rather than spreading damage around', () => {
    const { state, rng, fleet } = engage([spawn('smallArms')]);
    const boat = fleet[0];
    const first = boat.targetShipId;
    const victim = victimOf(state, boat)!;
    const hp0 = victim.hp;
    run(state, rng, Math.ceil(6 / SIM.dt));
    expect(boat.targetShipId).toBe(first);
    expect(victim.hp).toBeLessThan(hp0);
    // Nothing else took damage from the boat.
    const others = state.ships.filter((s) => s.id !== victim.id && s.spawned && s.alive);
    for (const other of others) expect(other.hp).toBe(other.maxHp);
  });

  it('a rocket boat opens a hull faster than a small-arms boat', () => {
    const damageOver = (variant: BoatVariant): number => {
      const { state, rng, fleet } = engage([spawn(variant)]);
      const victim = victimOf(state, fleet[0])!;
      const hp0 = victim.hp;
      run(state, rng, Math.ceil(5 / SIM.dt));
      return hp0 - victim.hp;
    };
    expect(damageOver('rocket')).toBeGreaterThan(damageOver('smallArms'));
  });

  it('moves to another hull after finishing one, but not instantly', () => {
    const { state, rng, fleet } = engage([spawn('rocket')]);
    const boat = fleet[0];
    const victim = victimOf(state, boat)!;
    victim.hp = 1; // hurry the first kill along
    run(state, rng, Math.ceil(1 / SIM.dt));
    expect(victim.alive).toBe(false);
    expect(state.stats.boatKills).toBe(1);
    expect(boat.targetShipId).toBeUndefined();
    // The reposition is a real gap — it does not re-commit on the next tick.
    expect(boat.retargetAt).toBeGreaterThan(state.time);
    run(state, rng, Math.ceil((COMBAT.attackBoat.retargetDelay + 4) / SIM.dt));
    expect(boat.alive).toBe(true);
    expect(boat.targetShipId).toBeDefined();
  });

  it('credits its damage and kills to the attack-boat branch', () => {
    const { state, rng } = engage([spawn('smallArms')]);
    run(state, rng, Math.ceil(5 / SIM.dt));
    expect(state.stats.enemyBranch.attackBoats?.damage ?? 0).toBeGreaterThan(0);
    for (const cause of ['attackBoat', 'rocketBoat', 'captured']) {
      expect(LOSS_CAUSE_TO_ENEMY_BRANCH[cause]).toBe('attackBoats');
    }
  });

  it('splits a kill across the branches that wore the hull down', () => {
    // Regression, and the most consequential scoring rule in the economy. Kill
    // credit used to go entirely to whatever landed the FINAL blow, so a
    // 115-damage mine (a one-shot on a 100hp hull) collected nearly every kill
    // while a 34-damage missile collected almost none — measured at ~1200
    // budget per kill against a mine's ~70. The allocator read that as
    // "missiles do not work" when they had in fact done most of the damage.
    const { state, rng, fleet } = engage([spawn('smallArms')]);
    const victim = victimOf(state, fleet[0])!;
    run(state, rng, Math.ceil(6 / SIM.dt));
    const boatDamage = victim.damageByBranch.attackBoats ?? 0;
    expect(boatDamage).toBeGreaterThan(0);

    // Pretend a mine had also chipped this hull, then let the boat finish it.
    victim.damageByBranch.mines = boatDamage;
    victim.hp = 0.01;
    run(state, rng, Math.ceil(2 / SIM.dt));
    expect(victim.alive).toBe(false);

    const credited = state.stats.enemyBranch;
    // Both branches share the hull, in proportion to the work each did.
    expect(credited.attackBoats?.kills ?? 0).toBeCloseTo(0.5, 2);
    expect(credited.mines?.kills ?? 0).toBeCloseTo(0.5, 2);
    // And a hull is still exactly one kill however it is divided up.
    const total = Object.values(credited).reduce((a, b) => a + b.kills, 0);
    expect(total).toBeCloseTo(state.stats.lost, 5);
  });
});

// ---------------------------------------------------------------------------
// The counter: deck guns, and nothing else
// ---------------------------------------------------------------------------

describe('attack-boat counters', () => {
  it('only the deck gun may engage a boat', () => {
    expect(canEngage('deckGun', 'attackBoat')).toBe(true);
    for (const weapon of ['interceptor', 'selfDefense', 'depthCharge', 'flak', 'mcmDrone'] as const) {
      expect(canEngage(weapon, 'attackBoat')).toBe(false);
    }
  });

  it('escort deck guns sink a boat and stop it earning', () => {
    const { state, rng } = engage([spawn('smallArms')], gunboatEscorts);
    let guard = 0;
    while (state.stats.boatsSunk === 0 && guard++ < Math.ceil(60 / SIM.dt) && !state.over) {
      stepTransit(state, [], rng);
    }
    expect(state.stats.boatsSunk).toBe(1);
    expect(state.stats.counter.deckGunKills).toBe(1);
    expect(boats(state)[0].alive).toBe(false);
    expect(state.events.some((e) => e.type === 'boatSunk')).toBe(true);
  });

  it('a convoy with no deck gun cannot touch the boat at all', () => {
    const { state, rng, fleet } = engage([spawn('smallArms')]);
    run(state, rng, Math.ceil(40 / SIM.dt));
    expect(state.stats.boatsSunk).toBe(0);
    expect(fleet[0].hp).toBe(COMBAT.attackBoat.hp.smallArms);
  });

  it('tougher variants shrug off deck-gun rounds until armour-piercing lands', () => {
    const secondsToSink = (variant: BoatVariant, ap: boolean): number => {
      const { state, rng } = engage([spawn(variant)], (c) => {
        gunboatEscorts(c);
        if (ap) c.completedResearch = [...c.completedResearch, 'deckGun.armorPiercing'];
      });
      const start = state.time;
      let guard = 0;
      while (state.stats.boatsSunk === 0 && guard++ < Math.ceil(90 / SIM.dt) && !state.over) {
        stepTransit(state, [], rng);
      }
      expect(state.stats.boatsSunk).toBe(1);
      return state.time - start;
    };
    // A rocket boat's armour halves incoming rounds until AP is researched, so
    // the same guns kill it markedly faster once it is.
    expect(secondsToSink('rocket', true)).toBeLessThan(secondsToSink('rocket', false));
    // And the light hull was never the problem — it dies fast either way.
    expect(secondsToSink('smallArms', false)).toBeLessThan(secondsToSink('rocket', false));
  });
});

// ---------------------------------------------------------------------------
// Boarding and capture
// ---------------------------------------------------------------------------

describe('boarding and capture', () => {
  /** Anti-boarding fitted on every hull, at a chosen depth of research. */
  const defended = (research: string[]) => (c: CampaignState): void => {
    c.completedResearch = ['antiBoarding.base', ...research] as CampaignState['completedResearch'];
    c.classModules = {
      cargo: ['antiBoarding'],
      tanker: ['antiBoarding'],
      freighter: ['antiBoarding'],
    };
  };

  it('a boarding boat takes the hull instead of sinking it', () => {
    const { state, rng, fleet } = engage([spawn('boarding')]);
    const victim = victimOf(state, fleet[0])!;
    const hp0 = victim.hp;
    let guard = 0;
    while (state.stats.shipsCaptured === 0 && guard++ < Math.ceil(60 / SIM.dt) && !state.over) {
      stepTransit(state, [], rng);
    }
    expect(state.stats.shipsCaptured).toBe(1);
    expect(victim.captured).toBe(true);
    expect(victim.alive).toBe(false);
    expect(victim.hp).toBe(0);
    // It was taken, not shot to pieces: no gunfire damage preceded the capture.
    expect(state.stats.boatKills).toBe(0);
    expect(hp0).toBe(victim.maxHp);
    expect(state.events.some((e) => e.type === 'shipLost' && e.cause === 'captured')).toBe(true);
  });

  it('boarding a hull is announced and takes real time', () => {
    const { state, rng, fleet } = engage([spawn('boarding')]);
    run(state, rng, 2);
    const victim = victimOf(state, fleet[0])!;
    expect(state.events.some((e) => e.type === 'boardingStarted')).toBe(true);
    expect(state.stats.counter.boardingAttempts).toBe(1);
    expect(victim.boardingSeconds).toBeGreaterThan(0);
    expect(victim.boardingSeconds).toBeLessThan(COMBAT.attackBoat.boardingSeconds);
    expect(victim.captured).toBe(false);
  });

  it('anti-boarding countermeasures slow the takeover down', () => {
    const progressAfter = (mutate?: (c: CampaignState) => void): number => {
      const { state, rng, fleet } = engage([spawn('boarding')], mutate);
      run(state, rng, Math.ceil(4 / SIM.dt));
      return victimOf(state, fleet[0])?.boardingSeconds ?? 0;
    };
    expect(progressAfter(defended(['antiBoarding.reinforcedAccess']))).toBeLessThan(progressAfter());
  });

  it('sinking the boarding boat throws the party off and loses their progress', () => {
    const ctx = engage([spawn('boarding')], gunboatEscorts);
    const { state, rng } = ctx;
    run(state, rng, 2);
    const victim = victimOf(state, ctx.fleet[0])!;
    expect(victim.boardingSeconds).toBeGreaterThan(0);
    let guard = 0;
    while (state.stats.boatsSunk === 0 && guard++ < Math.ceil(60 / SIM.dt) && !state.over) {
      stepTransit(state, [], rng);
    }
    expect(state.stats.boatsSunk).toBe(1);
    expect(victim.boardingSeconds).toBe(0); // progress lost, not merely paused
    expect(victim.captured).toBe(false);
    expect(state.stats.counter.boardingInterrupted).toBeGreaterThan(0);
    expect(state.events.some((e) => e.type === 'boardingRepelled')).toBe(true);
  });

  it('a capture costs more confidence than the same hull merely sinking', () => {
    const confidenceDrop = (cause: 'captured' | 'sunk'): number => {
      const c = newCampaign(`conf-${cause}`);
      const plan: RoundPlan = {
        ...planCurrentRound(c),
        spawns: cause === 'captured' ? [spawn('boarding')] : [],
        mines: [],
        debuts: [],
      };
      const { state, rng } = createRoundTransit(c, plan);
      if (cause === 'sunk') {
        // Kill exactly one hull by other means, for a like-for-like comparison.
        let guard = 0;
        while (state.ships.every((s) => !s.spawned) && guard++ < Math.ceil(30 / SIM.dt)) {
          stepTransit(state, [], rng);
        }
        const doomed = state.ships.find((s) => s.spawned && s.alive)!;
        doomed.hp = 0;
        doomed.alive = false;
        state.stats.lost = 1;
      }
      let guard = 0;
      while (!state.over && guard++ < Math.ceil(SIM.maxTransitTime / SIM.dt)) stepTransit(state, [], rng);
      const before = c.confidence;
      const report = resolveTransit(c, state);
      expect(state.stats.lost).toBeGreaterThan(0);
      return before - (before + report.confidenceChange);
    };
    // Same single loss either way; the captured hull hurts strictly more.
    expect(CAMPAIGN.confidencePerCapture).toBeLessThan(0);
    expect(confidenceDrop('captured')).toBeGreaterThan(confidenceDrop('sunk'));
  });

  it('the capture penalty lands even when ordinary losses are already capped', () => {
    // The point of putting it outside the loss cap: a player being overrun
    // still feels every hull the enemy sails away with.
    const lossesOnly = Math.max(CAMPAIGN.confidenceLossCap, CAMPAIGN.confidencePerLoss * 20);
    expect(lossesOnly).toBe(CAMPAIGN.confidenceLossCap);
    const withCapture =
      lossesOnly + Math.max(CAMPAIGN.confidenceCaptureCap, CAMPAIGN.confidencePerCapture * 1);
    expect(withCapture).toBeLessThan(lossesOnly);
  });
});

// ---------------------------------------------------------------------------
// Discovery beats and reporting
// ---------------------------------------------------------------------------

describe('attack-boat discovery beats', () => {
  it('announces each variant the moment it puts to sea — boats hide from nobody', () => {
    const { state } = launch([spawn('boarding')]);
    expect(state.debutsSeen).toEqual(expect.arrayContaining(['attackBoat', 'boardingBoat']));
    expect(state.debutsSeen).not.toContain('rocketBoat');
  });

  it('each boat node has its own discovery card and loss narrative', () => {
    const { state } = boatTransit([]);
    for (const key of ['attackBoat', 'rocketBoat', 'boardingBoat'] as const) {
      const cards = buildTransitCards({ ...state, events: [] }, [key]);
      expect(cards.filter((card) => card.kind === 'discovery')).toHaveLength(1);
    }
    const withLosses = {
      ...state,
      events: (['attackBoat', 'rocketBoat', 'captured'] as const).map(
        (cause, i): TransitEvent => ({ t: i, type: 'shipLost', shipName: `Hull ${i}`, cause }),
      ),
    };
    const bodies = buildTransitCards(withLosses, []).map((card) => card.body);
    expect(new Set(bodies).size).toBe(3);
    for (const body of bodies) expect(body).not.toMatch(/was lost\.$/);
    // The capture narrative has to say plainly that this is not a sinking.
    expect(bodies[2]).toMatch(/boarded and taken|prize crew/i);
  });

  it('reports boat counters in the round log', () => {
    const c = newCampaign('boat-telemetry');
    gunboatEscorts(c);
    const plan: RoundPlan = {
      ...planCurrentRound(c),
      spawns: [spawn('smallArms')],
      mines: [],
      debuts: [],
    };
    const { state, rng } = createRoundTransit(c, plan);
    let guard = 0;
    while (!state.over && guard++ < Math.ceil(SIM.maxTransitTime / SIM.dt)) stepTransit(state, [], rng);
    resolveTransit(c, state);
    const round = c.telemetry[c.telemetry.length - 1];
    expect(round.boatsLaunched).toBe(1);
    expect(round.boatsSunk + round.boatKills + round.shipsCaptured).toBeGreaterThanOrEqual(0);
  });

  it('the anti-surface counters no longer claim to be awaiting the enemy', () => {
    // Derived from the enemy catalogue: these must flip on their own the moment
    // the branch they answer ships, or the research screen lies to the player.
    expect(awaitingEnemyCapability(COUNTER_BRANCHES.deckGun)).toBe(false);
    expect(awaitingEnemyCapability(COUNTER_BRANCHES.antiBoarding)).toBe(false);
    expect(awaitingEnemyCapability(COUNTER_BRANCHES.hydrophone)).toBe(false);
  });
});
