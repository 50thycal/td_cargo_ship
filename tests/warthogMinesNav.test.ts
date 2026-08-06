// Three things that all changed for the same reason: the player could not see
// what the game was doing.
//
//   • The ECM jammer became an A-10 Warthog. A counter whose only visible
//     effect was a missile that happened to miss is a counter nobody spends on;
//     a jet that guns mines and boats in front of you is one you can reason
//     about. Pinned here: it kills what it is allowed to kill, it cannot touch
//     what it is not, and it is a single sortie until you buy a second.
//   • Mine detection became a CONTACT with a lifetime instead of a permanent
//     chart mark. Pinned here: a scan fix expires, a sonar fix survives exactly
//     as long as some hull is holding it, and whoever holds it shares it.
//   • Escorts became stand-on vessels. Pinned here: a merchant slows for a
//     crossing escort rather than being shoved out of the way by it.
//
// Plus the convoy pacing change, which only counts as done if the enemy's fire
// window followed the convoy rather than staying where it was.

import { describe, expect, it } from 'vitest';
import { createRoundTransit, newCampaign, planCurrentRound } from '../src/sim/campaign';
import { stepTransit } from '../src/sim/transit';
import { convoySpawnSpan, scheduleSpawns } from '../src/sim/convoySchedule';
import { planRound } from '../src/sim/evolution';
import { makeRng } from '../src/sim/rng';
import { fitUniformEscorts } from './helpers';
import { canEngage, COUNTER_BRANCHES, deriveCounterEffects } from '../src/data/counters';
import { COMBAT, NAV, SIM, SPAWN, WORLD } from '../src/data/tuning';
import { SHIP_CLASSES } from '../src/data/defs';
import type {
  CampaignState,
  FormationId,
  ResearchId,
  Ship,
  Threat,
  TransitState,
} from '../src/sim/types';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type Rng = ReturnType<typeof createRoundTransit>['rng'];

/** A transit with an empty ocean: no scheduled attacks, no mines, nothing but
 *  the convoy. Every test below injects exactly what it wants to look at. */
function emptyTransit(
  seed: string,
  mutate?: (c: CampaignState) => void,
): { c: CampaignState; state: TransitState; rng: Rng } {
  const c = newCampaign(seed);
  mutate?.(c);
  const base = planCurrentRound(c);
  const { state, rng } = createRoundTransit(c, {
    ...base,
    spawns: [],
    mines: [],
    installations: [],
    smoke: [],
    electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 0 },
    debuts: [],
  });
  state.spawnQueue = [];
  state.threats = [];
  return { c, state, rng };
}

function addMine(state: TransitState, x: number, y: number, lowSig = false): Threat {
  const mine: Threat = {
    id: state.nextEntityId++,
    kind: 'mine',
    x,
    y,
    vx: 0,
    vy: 0,
    speed: 0,
    alive: true,
    revealed: false,
    lowSig,
    claimedByInterceptor: false,
  };
  state.threats.push(mine);
  return mine;
}

function addBoat(state: TransitState, x: number, y: number, hp = 40): Threat {
  const boat: Threat = {
    id: state.nextEntityId++,
    kind: 'attackBoat',
    x,
    y,
    vx: 0,
    vy: 0,
    speed: 0,
    alive: true,
    revealed: true,
    lowSig: false,
    claimedByInterceptor: false,
    hp,
    boatVariant: 'smallArms',
  };
  state.threats.push(boat);
  return boat;
}

function run(state: TransitState, rng: Rng, seconds: number): void {
  const steps = Math.ceil(seconds / SIM.dt);
  for (let i = 0; i < steps && !state.over; i++) stepTransit(state, [], rng);
}

/** Hold every cargo hull outside the world so it cannot interfere with what a
 *  test is measuring (trigger a mine, get shot at, block a lane).
 *
 *  They stay ALIVE and undelivered on purpose: a transit with nothing left
 *  unresolved ends on the next tick, which would stop the round before the test
 *  had run. Unspawned hulls are simply not in the world yet. */
function clearTheDecks(state: TransitState): void {
  for (const ship of state.ships) {
    ship.spawnTime = SIM.maxTransitTime * 2;
    ship.spawned = false;
  }
}

/** Reduce the convoy to a single hull under way, so a test can watch what one
 *  merchant does without its neighbours steering for it. */
function soloShip(state: TransitState): Ship {
  const [ship, ...rest] = state.ships;
  for (const other of rest) {
    other.spawnTime = SIM.maxTransitTime * 2;
    other.spawned = false;
  }
  ship.spawnTime = 0;
  return ship;
}

// ---------------------------------------------------------------------------
// The A-10 Warthog
// ---------------------------------------------------------------------------

describe('A-10 Warthog', () => {
  it('comes with ONE sortie, and a second is something you buy', () => {
    const base = deriveCounterEffects([], { escortModules: [], baseModules: [] });
    expect(base.abilities.warthog.charges).toBe(1);
    const withSortie = deriveCounterEffects(['warthog.secondSortie'] as ResearchId[], {
      escortModules: [],
      baseModules: [],
    });
    expect(withSortie.abilities.warthog.charges).toBe(2);
  });

  it('the loiter and radius upgrades each buy what they say they buy', () => {
    const ctx = { escortModules: [], baseModules: [] };
    const base = deriveCounterEffects([], ctx).abilities.warthog;
    const longer = deriveCounterEffects(['warthog.extendedLoiter'] as ResearchId[], ctx)
      .abilities.warthog;
    const wider = deriveCounterEffects(['warthog.wideStrafe'] as ResearchId[], ctx).abilities.warthog;
    expect(longer.duration).toBeGreaterThan(base.duration);
    expect(longer.radius).toBe(base.radius); // loiter is not reach
    expect(wider.radius).toBeGreaterThan(base.radius);
    expect(wider.duration).toBe(base.duration); // reach is not loiter
  });

  it('tank-buster rounds double what a pass does to a boat', () => {
    const ctx = { escortModules: [], baseModules: [] };
    const plain = deriveCounterEffects([], ctx).warthogDamage;
    const heavy = deriveCounterEffects(['warthog.tankBuster'] as ResearchId[], ctx).warthogDamage;
    expect(heavy).toBeCloseTo(plain * COMBAT.warthog.tankBusterMult, 5);
  });

  it('may engage mines and boats, and nothing airborne or running deep', () => {
    expect(canEngage('gunRun', 'mine')).toBe(true);
    expect(canEngage('gunRun', 'attackBoat')).toBe(true);
    expect(canEngage('gunRun', 'missile')).toBe(false);
    expect(canEngage('gunRun', 'guidedMissile')).toBe(false);
    expect(canEngage('gunRun', 'torpedo')).toBe(false);
    expect(canEngage('gunRun', 'reconPlane')).toBe(false);
    // And the branch is declared against the families it actually answers, so
    // the draft's threat-pressure weighting can find it.
    expect([...COUNTER_BRANCHES.warthog.counters].sort()).toEqual(['attackBoats', 'mines']);
  });

  it('destroys mines along the run it was given — charted or not', () => {
    const { state, rng } = emptyTransit('warthog-mines', (c) => {
      c.warthogUnlocked = true;
      c.warthogStock = 1;
    });
    clearTheDecks(state);
    const cy = WORLD.lanes[1];
    // Two mines strung out along the run line: one for the outbound pass, one
    // for the return. The gun takes ONE target per pass, so a sortie is worth
    // exactly two engagements however many targets are lying about.
    const first = addMine(state, 1000, cy);
    const second = addMine(state, 1150, cy);
    // Never detected by anything: the gun does not care whether the plot had it.
    expect([first, second].every((m) => !m.revealed)).toBe(true);
    stepTransit(
      state,
      [{ type: 'ability', ability: 'warthog', x: 800, y: cy, x2: 1300, y2: cy }],
      rng,
    );
    run(state, rng, 40);
    expect(first.alive).toBe(false);
    expect(second.alive).toBe(false);
    expect(state.stats.minesSwept).toBe(2);
    expect(state.stats.warthogKills).toBe(2);
    expect(state.stats.counter.gunRunKills).toBe(2);
  });

  it('engages once per pass, and only twice in a sortie', () => {
    const { state, rng } = emptyTransit('warthog-passes', (c) => {
      c.warthogUnlocked = true;
      c.warthogStock = 1;
    });
    clearTheDecks(state);
    const cy = WORLD.lanes[1];
    // Five mines in a row. A wheel would have swept the lot; a strafing run
    // gets two of them and has to be called again for the rest. That limit is
    // what makes WHERE the line goes a decision.
    for (let i = 0; i < 5; i++) addMine(state, 950 + i * 60, cy);
    stepTransit(
      state,
      [{ type: 'ability', ability: 'warthog', x: 800, y: cy, x2: 1400, y2: cy }],
      rng,
    );
    run(state, rng, 60);
    expect(state.stats.counter.gunRuns).toBe(2);
    expect(state.threats.filter((m) => m.kind === 'mine' && m.alive).length).toBe(3);
  });

  it('leaves alone what sits off the run line, however close to the track', () => {
    const { state, rng } = emptyTransit('warthog-cone', (c) => {
      c.warthogUnlocked = true;
      c.warthogStock = 1;
    });
    clearTheDecks(state);
    const cy = WORLD.lanes[1];
    // On the line and well within reach.
    const onLine = addMine(state, 1000, cy);
    // Abeam of the run, far outside the gun cone — a fixed gun points where the
    // aircraft points, so this is never in the solution however near it looks.
    const abeam = addMine(state, 900, cy - 330);
    stepTransit(
      state,
      [{ type: 'ability', ability: 'warthog', x: 800, y: cy, x2: 1300, y2: cy }],
      rng,
    );
    run(state, rng, 50);
    expect(onLine.alive).toBe(false);
    expect(abeam.alive).toBe(true);
  });

  it('draws a visible burst of tracer for every engagement', () => {
    const { state, rng } = emptyTransit('warthog-boat', (c) => {
      c.warthogUnlocked = true;
      c.warthogStock = 1;
    });
    clearTheDecks(state);
    const cy = WORLD.lanes[1];
    // A light boat: two passes at the base 26 is 52, so this one breaks up
    // inside a single sortie while a heavy one would need another call.
    const boat = addBoat(state, 1050, cy, 40);
    stepTransit(
      state,
      [{ type: 'ability', ability: 'warthog', x: 800, y: cy, x2: 1300, y2: cy }],
      rng,
    );
    // Every point of damage crosses the water as a drawn burst.
    let sawBurst = false;
    for (let i = 0; i < Math.ceil(50 / SIM.dt) && boat.alive; i++) {
      stepTransit(state, [], rng);
      if (state.strafeRuns.length > 0) sawBurst = true;
    }
    expect(sawBurst).toBe(true);
    expect(boat.alive).toBe(false);
    expect(state.stats.boatsSunk).toBe(1);
  });

  it('cannot reach a missile — an air threat is not its problem', () => {
    const { state, rng } = emptyTransit('warthog-missile', (c) => {
      c.warthogUnlocked = true;
      c.warthogStock = 1;
    });
    clearTheDecks(state);
    const cx = 1000;
    const cy = WORLD.lanes[1];
    const missile: Threat = {
      id: state.nextEntityId++,
      kind: 'missile',
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      speed: 0,
      alive: true,
      revealed: true,
      lowSig: false,
      claimedByInterceptor: false,
      targetX: cx,
      targetY: -900, // aim point far off-map so it never self-resolves
    };
    state.threats.push(missile);
    stepTransit(state, [{ type: 'ability', ability: 'warthog', x: cx, y: cy }], rng);
    run(state, rng, 30);
    expect(missile.alive).toBe(true);
    expect(state.stats.counter.gunRuns).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Mine contacts go stale
// ---------------------------------------------------------------------------

describe('mine contacts', () => {
  it('a scan-plane fix expires, and the mine drops back off the plot', () => {
    const { state, rng } = emptyTransit('mine-scan-expiry', (c) => {
      c.scanUnlocked = true;
      c.scanStock = 2;
    });
    clearTheDecks(state); // nothing with sonar anywhere near it
    const laneY = WORLD.lanes[1];
    const mine = addMine(state, 1200, laneY);
    stepTransit(state, [{ type: 'ability', ability: 'scan', x: 0, y: laneY }], rng);
    run(state, rng, 12); // the plane needs time to fly out to it
    expect(mine.revealed).toBe(true);
    expect(state.stats.minesRevealed).toBe(1);

    run(state, rng, COMBAT.mineContact.scanHoldSeconds);
    expect(mine.revealed).toBe(false);
    // Still there, still lethal — only the plot went dark.
    expect(mine.alive).toBe(true);
    // And it is not counted as a second discovery when it is found again.
    expect(state.stats.minesRevealed).toBe(1);
  });

  it('a sonar contact lives exactly as long as a hull is holding it', () => {
    const { state, rng } = emptyTransit('mine-sonar-hold', (c) => {
      c.classModules.cargo = ['mineSonar'];
      c.completedResearch.push('mineSonar.base' as ResearchId);
    });
    const laneY = WORLD.lanes[1];
    const mine = addMine(state, 800, laneY);
    const radius = state.effects.mineSonar.radius;
    expect(radius).toBeGreaterThan(0);

    // Park a hull right on top of it: contact held.
    const ship = state.ships[0];
    ship.spawned = true;
    ship.alive = true;
    ship.x = mine.x - radius * 0.5;
    ship.y = laneY;
    for (const other of state.ships) {
      if (other !== ship) {
        other.spawnTime = SIM.maxTransitTime * 2;
        other.alive = false;
      }
    }
    ship.disabledUntil = SIM.maxTransitTime; // dead in the water, holding station
    run(state, rng, 1);
    expect(mine.revealed).toBe(true);

    // Take the hull away and the contact dies with it (after the grace).
    ship.x = mine.x + radius * 4;
    run(state, rng, COMBAT.mineContact.sonarGraceSeconds + 1);
    expect(mine.revealed).toBe(false);

    // Come back and it is re-acquired — a contact, not a one-shot discovery.
    ship.x = mine.x - radius * 0.5;
    run(state, rng, 0.5);
    expect(mine.revealed).toBe(true);
    expect(state.stats.minesRevealed).toBe(1);
  });

  it('one hull hearing a mine shares it with the whole fleet', () => {
    const { state, rng } = emptyTransit('mine-shared', (c) => {
      c.classModules.cargo = ['mineSonar'];
      c.completedResearch.push('mineSonar.base' as ResearchId);
    });
    const laneY = WORLD.lanes[0];
    const mine = addMine(state, 700, laneY);
    const listener = state.ships[0];
    listener.spawned = true;
    listener.alive = true;
    listener.x = mine.x;
    listener.y = laneY;
    listener.disabledUntil = SIM.maxTransitTime;
    run(state, rng, 1);
    // Revealed is a FLEET fact, not a per-ship one: there is one flag and every
    // hull steers off it. Everyone else is nowhere near the mine.
    const others = state.ships.filter((s) => s !== listener && s.alive && s.spawned);
    for (const other of others) {
      expect(Math.hypot(other.x - mine.x, other.y - mine.y)).toBeGreaterThan(
        state.effects.mineSonar.radius,
      );
    }
    expect(mine.revealed).toBe(true);
  });

  it('an escort WITH sonar fitted holds contacts for the ships behind it', () => {
    const { state, rng } = emptyTransit('mine-escort-sonar', (c) => {
      fitUniformEscorts(c, 1, ['mineSonar']);
      c.completedResearch.push('mineSonar.base' as ResearchId);
    });
    clearTheDecks(state); // no cargo hull is anywhere near
    const mine = addMine(state, 1400, WORLD.lanes[2]);
    const escort = state.escorts[0];
    escort.x = mine.x;
    escort.y = mine.y;
    escort.stationed = true;
    run(state, rng, 1);
    expect(mine.revealed).toBe(true);
    expect(state.stats.counter.detections.mineSonar).toBe(1);
  });

  it('an escort WITHOUT sonar hears nothing, however close it sits', () => {
    // The reported bug: mines were being charted in the first round by a fleet
    // that had bought no sonar at all. Nothing detects a mine by existing.
    const { state, rng } = emptyTransit('mine-escort-deaf', (c) => {
      fitUniformEscorts(c, 1, ['deckGun']);
      c.completedResearch.push('mineSonar.base' as ResearchId);
    });
    clearTheDecks(state);
    const mine = addMine(state, 1400, WORLD.lanes[2]);
    const escort = state.escorts[0];
    escort.x = mine.x;
    escort.y = mine.y;
    escort.stationed = true;
    run(state, rng, 3);
    expect(mine.revealed).toBe(false);
    expect(state.stats.minesRevealed).toBe(0);
  });

  it('an unequipped convoy with no research is deaf to mines entirely', () => {
    // Sailing right over one is not detection. Until something aboard is
    // listening, a mine is found the hard way.
    const { state, rng } = emptyTransit('mine-no-kit');
    const mine = addMine(state, 700, WORLD.lanes[1]);
    const ship = soloShip(state);
    ship.spawnTime = 0;
    run(state, rng, 1);
    ship.x = mine.x - 40;
    ship.y = mine.y;
    ship.disabledUntil = SIM.maxTransitTime; // stopped right beside it
    run(state, rng, 3);
    expect(state.effects.mineSonar.fleetDetectRadius).toBe(0);
    expect(mine.revealed).toBe(false);
    expect(state.stats.minesRevealed).toBe(0);
  });

  it('a low-signature mine still needs the research, contact or not', () => {
    const { state, rng } = emptyTransit('mine-lowsig', (c) => {
      c.classModules.cargo = ['mineSonar'];
      c.completedResearch.push('mineSonar.base' as ResearchId);
    });
    const mine = addMine(state, 700, WORLD.lanes[1], true);
    const ship = state.ships[0];
    ship.spawned = true;
    ship.alive = true;
    ship.x = mine.x;
    ship.y = mine.y;
    ship.disabledUntil = SIM.maxTransitTime;
    run(state, rng, 2);
    expect(state.effects.mineSonar.detectLowSig).toBe(false);
    expect(mine.revealed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Ships slow for hazards instead of only steering around them
// ---------------------------------------------------------------------------

describe('convoy helmsmanship', () => {
  it('comes off the throttle for a charted mine dead ahead', () => {
    const { state, rng } = emptyTransit('mine-slow', (c) => {
      c.classModules.cargo = ['mineSonar'];
      c.completedResearch.push('mineSonar.base' as ResearchId);
    });
    // One hull, under way, with a charted mine planted right on its track.
    const ship = soloShip(state);
    run(state, rng, 4);
    const cruising = ship.speed;
    expect(cruising).toBeGreaterThan(0);

    const mine = addMine(state, ship.x + 70, ship.y);
    mine.revealedUntil = SIM.maxTransitTime;
    mine.revealed = true;
    let slowest = cruising;
    for (let i = 0; i < Math.ceil(3 / SIM.dt); i++) {
      stepTransit(state, [], rng);
      slowest = Math.min(slowest, ship.speed);
    }
    expect(slowest).toBeLessThan(cruising * 0.9);
    // Slowing is not stopping — a merchant that halts in a minefield is a
    // sitting target, and it still has to get through.
    expect(slowest).toBeGreaterThan(0);
  });

  it('opens the range on a charted mine to several ship lengths', () => {
    const { state, rng } = emptyTransit('mine-berth', (c) => {
      c.classModules.cargo = ['mineSonar'];
      c.completedResearch.push('mineSonar.base' as ResearchId);
    });
    const ship = soloShip(state);
    run(state, rng, 4);

    // Plant a charted mine right on the ship's track, a little ahead.
    const mine = addMine(state, ship.x + 120, ship.y);
    mine.revealedUntil = SIM.maxTransitTime;
    mine.revealed = true;

    const r = SHIP_CLASSES[ship.classId].radius;
    let closest = Infinity;
    for (let i = 0; i < Math.ceil(20 / SIM.dt); i++) {
      stepTransit(state, [], rng);
      closest = Math.min(closest, Math.hypot(ship.x - mine.x, ship.y - mine.y));
      if (ship.x > mine.x + 200) break; // well past it
    }
    // Three ship lengths is the floor the design asks for; a length is about
    // two hull radii.
    expect(closest).toBeGreaterThan(r * 6);
    // And it did not simply stop short of the mine and give up.
    expect(ship.x).toBeGreaterThan(mine.x);
  });

  it('keeps clear of a mine that appears alongside, not just ahead', () => {
    // Forward-cone steering alone cannot answer this one: by the time a hull
    // has a mine abeam, nothing is in the cone at all.
    const { state, rng } = emptyTransit('mine-berth-abeam', (c) => {
      c.classModules.cargo = ['mineSonar'];
      c.completedResearch.push('mineSonar.base' as ResearchId);
    });
    const ship = soloShip(state);
    run(state, rng, 4);
    const r = SHIP_CLASSES[ship.classId].radius;
    const mine = addMine(state, ship.x, ship.y + r * 2.5);
    mine.revealedUntil = SIM.maxTransitTime;
    mine.revealed = true;
    const gap0 = Math.hypot(ship.x - mine.x, ship.y - mine.y);
    run(state, rng, 5);
    expect(Math.hypot(ship.x - mine.x, ship.y - mine.y)).toBeGreaterThan(gap0);
  });

  it('takes the way off for an escort crossing its bow', () => {
    const { state, rng } = emptyTransit('give-way', (c) => {
      fitUniformEscorts(c, 1);
    });
    const ship = soloShip(state);
    run(state, rng, 4);
    const cruising = ship.speed;
    const laneBefore = ship.y;
    expect(cruising).toBeGreaterThan(0);

    // The escort steams across the merchant's bow, under orders — the exact
    // situation that used to end with the column shoved apart.
    const escort = state.escorts[0];
    escort.stationed = false;
    escort.x = ship.x + 100;
    escort.y = ship.y - 70;
    escort.moveTarget = { x: escort.x, y: ship.y + 260, hold: false };
    let slowest = cruising;
    for (let i = 0; i < Math.ceil(5 / SIM.dt); i++) {
      stepTransit(state, [], rng);
      slowest = Math.min(slowest, ship.speed);
    }
    // The merchant takes the way off. A band rather than a figure: how hard it
    // has to brake depends on exactly where the escort's own steering puts her
    // as she crosses, and that is allowed to change.
    expect(slowest).toBeLessThan(cruising * 0.25);
    // ...and it answers with the throttle, not by lurching out of its lane.
    expect(Math.abs(ship.y - laneBefore)).toBeLessThan(SHIP_CLASSES[ship.classId].radius * 2);
  });

  it('does NOT give way to an escort travelling the same way it is', () => {
    // The rule that keeps give-way from becoming deadlock. An escort keeping
    // station alongside never clears anybody's bow, so a merchant that waited
    // for it would still be waiting when the round expired — measured, that
    // alone turned one loss in five across a sweep into "lost at sea".
    const { state, rng } = emptyTransit('no-deadlock', (c) => {
      fitUniformEscorts(c, 1);
    });
    const ship = soloShip(state);
    run(state, rng, 4);
    const startX = ship.x;

    const escort = state.escorts[0];
    escort.stationed = false;
    escort.moveTarget = null; // cruising forward with the convoy
    escort.x = ship.x + NAV.giveWay.stopDistance * 0.5;
    escort.y = ship.y;
    run(state, rng, 25);
    // It got past, one way or another. What it did not do is stop dead.
    expect(ship.x - startX).toBeGreaterThan(200);
  });

  it('gives up waiting rather than sitting in the water forever', () => {
    // The backstop, for any geometry the crossing test does not catch.
    const { state, rng } = emptyTransit('give-way-timeout', (c) => {
      fitUniformEscorts(c, 1);
    });
    const ship = soloShip(state);
    run(state, rng, 4);
    const escort = state.escorts[0];
    escort.stationed = false;
    // Pinned square on the bow and always crossing — an impossible escort
    // that never clears, held there by force every tick.
    let held = 0;
    const startX = ship.x;
    for (let i = 0; i < Math.ceil(20 / SIM.dt); i++) {
      escort.x = ship.x + NAV.giveWay.stopDistance * 0.5;
      escort.y = ship.y;
      escort.moveTarget = { x: escort.x, y: escort.y + 400, hold: false };
      stepTransit(state, [], rng);
      if (ship.speed < 1) held += SIM.dt;
    }
    expect(held).toBeLessThan(NAV.giveWay.maxHoldSeconds + 2);
    expect(ship.x - startX).toBeGreaterThan(50);
  });

  it('an escort crossing a packed column still carries out its order', () => {
    // The original complaint: an escort cutting through a row of merchants
    // bulldozed them and was itself knocked off course. It now steers around
    // traffic — but a column with no gap in it has nothing to steer around, and
    // an order has to be carried out. It parts the line instead of circling it.
    const { state, rng } = emptyTransit('escort-track', (c) => {
      fitUniformEscorts(c, 1);
    });
    const escort = state.escorts[0];
    const laneY = WORLD.lanes[1];
    state.ships.forEach((ship, i) => {
      ship.spawnTime = 0;
      ship.spawned = true;
      ship.alive = true;
      ship.x = 600 + i * 46;
      ship.y = laneY;
      ship.heading = 0;
      ship.speed = 0;
    });
    escort.x = 620;
    escort.y = laneY - 240;
    const targetX = 760;
    const targetY = laneY + 240;
    escort.moveTarget = { x: targetX, y: targetY, hold: true };
    run(state, rng, 40);
    expect(Math.hypot(escort.x - targetX, escort.y - targetY)).toBeLessThan(
      NAV.escortArrive + 12,
    );
  });

  it('passes ASTERN of a merchant under way, not across her bow', () => {
    // Crossing ahead of a moving ship is a losing race — she keeps coming, so
    // the escort keeps having to bear away and gets herded off its track. This
    // pins the choice: the escort ends up behind her, not in front.
    const { state, rng } = emptyTransit('escort-astern', (c) => {
      fitUniformEscorts(c, 1);
    });
    const laneY = WORLD.lanes[1];
    const merchant = soloShip(state);
    merchant.spawnTime = 0;
    merchant.spawned = true;
    merchant.alive = true;
    merchant.x = 900;
    merchant.y = laneY;
    merchant.heading = 0;
    merchant.speed = SHIP_CLASSES[merchant.classId].speed;

    // The escort is ordered straight across her track, from north to south,
    // arriving right where she will be.
    const escort = state.escorts[0];
    escort.x = 900;
    escort.y = laneY - 150;
    escort.heading = Math.PI / 2; // heading south, at her
    escort.moveTarget = { x: 900, y: laneY + 150, hold: true };

    // Watch which side of her the escort is on as it crosses her lane.
    let crossedAhead = false;
    let crossedAstern = false;
    for (let i = 0; i < Math.ceil(20 / SIM.dt) && escort.moveTarget; i++) {
      stepTransit(state, [], rng);
      const near = Math.abs(escort.y - merchant.y) < 40;
      if (near) {
        if (escort.x > merchant.x + 10) crossedAhead = true;
        if (escort.x < merchant.x - 10) crossedAstern = true;
      }
    }
    expect(crossedAstern).toBe(true);
    expect(crossedAhead).toBe(false);
  });

  it('holds a steady course near the convoy instead of shaking', () => {
    // The steering forces are recomputed every tick against a moving world, so
    // the raw vector flickers even when nothing has changed. Sending that to
    // the rudder made the escort visibly shake whenever it got close to a hull.
    const { state, rng } = emptyTransit('escort-steady', (c) => {
      fitUniformEscorts(c, 1);
    });
    const laneY = WORLD.lanes[1];
    // A short line of hulls under way for the escort to work past.
    state.ships.forEach((ship, i) => {
      if (i >= 5) {
        ship.spawnTime = SIM.maxTransitTime * 2;
        ship.spawned = false;
        return;
      }
      ship.spawnTime = 0;
      ship.spawned = true;
      ship.alive = true;
      ship.x = 800 + i * 90;
      ship.y = laneY;
      ship.heading = 0;
      ship.speed = SHIP_CLASSES[ship.classId].speed;
    });
    const escort = state.escorts[0];
    escort.x = 820;
    escort.y = laneY - 120;
    escort.heading = Math.PI / 2;
    escort.moveTarget = { x: 1150, y: laneY + 120, hold: true };

    // Count direction REVERSALS in the rudder. A ship altering course turns one
    // way for a while; a shaking one changes its mind several times a second.
    // What counts as the rudder MOVING. One tick at full rudder is
    // escortTurnRate * dt (~87 mrad); this is ~2% of that. Below it the heading
    // is being nudged by float noise in a steering vector that has not
    // meaningfully changed — counting those as reversals measures arithmetic,
    // not helmsmanship, and no such turn is visible on screen. The shake this
    // test exists to catch alternated at the full-rudder cap, so it is still
    // caught with room to spare.
    const SIGNIFICANT_TURN = NAV.escortTurnRate * SIM.dt * 0.02;
    let prev = escort.heading;
    let prevTurn = 0;
    let reversals = 0;
    let ticks = 0;
    let sharpest = 0;
    for (let i = 0; i < Math.ceil(16 / SIM.dt) && escort.moveTarget; i++) {
      stepTransit(state, [], rng);
      const turn = escort.heading - prev;
      sharpest = Math.max(sharpest, Math.abs(turn));
      if (Math.abs(turn) > SIGNIFICANT_TURN) {
        if (prevTurn !== 0 && Math.sign(turn) !== Math.sign(prevTurn)) reversals++;
        prevTurn = turn;
      }
      prev = escort.heading;
      ticks++;
    }
    // Well under one reversal a second over a manoeuvre that involves passing
    // five hulls. Measured, this ran at 74 before the steering vector was
    // filtered and the passing side committed — a reversal every few ticks,
    // which is exactly what "it shakes" looks like.
    expect(reversals).toBeLessThan(ticks / 30);
    // And the rudder never moves faster than the ship can turn. It used to
    // snap on arrival, which is the one moment the player is watching.
    expect(sharpest).toBeLessThanOrEqual(NAV.escortTurnRate * SIM.dt + 1e-6);
  });

  it('holds its heading on station instead of chasing a collapsed steering vector', () => {
    // An escort that has ARRIVED has no goal force left, so its steering vector
    // is whatever residue the nearby hulls contribute — a vector two orders of
    // magnitude shorter than a real steering command, pointing wherever the
    // nearest merchant happened to drift that tick. atan2 returns an angle for
    // it just as confidently as for a real one, so the ship used to put the
    // rudder hard over, full stop to full stop, in answer to nothing at all.
    const { state, rng } = emptyTransit('escort-on-station', (c) => {
      fitUniformEscorts(c, 1);
    });
    const laneY = WORLD.lanes[1];
    state.ships.forEach((ship, i) => {
      if (i >= 3) {
        ship.spawnTime = SIM.maxTransitTime * 2;
        ship.spawned = false;
        return;
      }
      ship.spawnTime = 0;
      ship.spawned = true;
      ship.alive = true;
      ship.x = 900 + i * 80;
      ship.y = laneY;
      ship.heading = 0;
      ship.speed = SHIP_CLASSES[ship.classId].speed;
    });
    // Parked on station right beside the column: no goal force, hulls close
    // enough aboard to keep feeding it separation residue.
    const escort = state.escorts[0];
    escort.x = 940;
    escort.y = laneY - 70;
    escort.heading = 0;
    escort.moveTarget = null;

    const start = escort.heading;
    let sharpest = 0;
    for (let i = 0; i < Math.ceil(8 / SIM.dt); i++) {
      const before = escort.heading;
      stepTransit(state, [], rng);
      sharpest = Math.max(sharpest, Math.abs(escort.heading - before));
    }
    // Nothing is asking this ship to turn, so it should barely have moved the
    // rudder at all — certainly nowhere near the hard-over it used to apply.
    expect(sharpest).toBeLessThan(NAV.escortTurnRate * SIM.dt * 0.5);
    expect(Math.abs(escort.heading - start)).toBeLessThan(0.5);
  });

  it('an escort goes AROUND a hull stopped dead on its track, not through it', () => {
    // The reported bug. A merchant under way can give way; one stopped in the
    // water cannot, so the escort has to be the one that alters course.
    const { state, rng } = emptyTransit('escort-around', (c) => {
      fitUniformEscorts(c, 1);
    });
    const laneY = WORLD.lanes[1];
    const blocker = soloShip(state);
    blocker.spawnTime = 0;
    blocker.spawned = true;
    blocker.alive = true;
    blocker.x = 900;
    blocker.y = laneY;
    blocker.heading = 0;
    blocker.speed = 0;
    blocker.disabledUntil = SIM.maxTransitTime; // dead in the water
    const blockerY0 = blocker.y;

    const escort = state.escorts[0];
    escort.x = 700;
    escort.y = laneY;
    escort.heading = 0;
    escort.moveTarget = { x: 1100, y: laneY, hold: true };

    let closest = Infinity;
    for (let i = 0; i < Math.ceil(20 / SIM.dt) && escort.moveTarget; i++) {
      stepTransit(state, [], rng);
      closest = Math.min(closest, Math.hypot(escort.x - blocker.x, escort.y - blocker.y));
    }
    // It arrived...
    expect(Math.hypot(escort.x - 1100, escort.y - laneY)).toBeLessThan(NAV.escortArrive + 12);
    // ...without ever driving over the hull...
    expect(closest).toBeGreaterThan(SHIP_CLASSES[blocker.classId].radius);
    // ...and without dragging it out of the water it was sitting in.
    expect(Math.abs(blocker.y - blockerY0)).toBeLessThan(26);
  });
});

// ---------------------------------------------------------------------------
// Convoy pacing
// ---------------------------------------------------------------------------

describe('convoy entry pacing', () => {
  const FORMATIONS: FormationId[] = ['wide', 'tight', 'sprint'];

  it('the schedule matches what the span estimate promises, per formation', () => {
    for (const formation of FORMATIONS) {
      const ships: Ship[] = Array.from({ length: 14 }, (_, i) => makeStubShip(i));
      scheduleSpawns(ships, makeRng(`span-${formation}`), formation);
      const last = Math.max(...ships.map((s) => s.spawnTime));
      const estimate = convoySpawnSpan(ships.length, formation);
      // An estimate, not a promise — the volley sizes are rolled — but it has to
      // be in the right neighbourhood or the enemy fire window is wrong.
      expect(last).toBeGreaterThan(estimate * 0.5);
      expect(last).toBeLessThan(estimate * 1.9);
    }
  });

  it('a Tight convoy is fully on the map long before a Wide one', () => {
    // The reason the estimate has to be formation-aware at all.
    expect(convoySpawnSpan(15, 'tight')).toBeLessThan(convoySpawnSpan(15, 'wide') * 0.5);
  });

  it('the enemy fire window follows the convoy instead of staying put', () => {
    // Doubling the entry spacing without this would spread the same number of
    // missiles over twice the water — a difficulty cut hidden in a pacing
    // change. The window has to track the convoy it is shooting at.
    const shots = (formation: FormationId): number => {
      const c = newCampaign(`window-${formation}`);
      c.formation = formation;
      const plan = planRound(c, makeRng('window'));
      return Math.max(...plan.spawns.map((s) => s.time));
    };
    expect(shots('tight')).toBeLessThan(shots('wide'));
  });

  it('every hull still gets on the map with time to cross', () => {
    // A pacing change is only safe if the last ship out can still reach the
    // far shore before the transit's hard cap.
    const slowest = Math.min(...Object.values(SHIP_CLASSES).map((sc) => sc.speed));
    const crossing = (WORLD.deliverX - WORLD.spawnX) / (slowest * 0.95);
    for (const formation of FORMATIONS) {
      const ships: Ship[] = Array.from({ length: 24 }, (_, i) => makeStubShip(i));
      scheduleSpawns(ships, makeRng(`cap-${formation}`), formation);
      const last = Math.max(...ships.map((s) => s.spawnTime));
      expect(last + crossing).toBeLessThan(SIM.maxTransitTime);
    }
  });

  it('doubling the gaps did not also double the wait for the first hull', () => {
    // Pacing between ships is the thing that needed room; dead air at the start
    // of a round is not.
    expect(SPAWN.firstDelay).toBeLessThanOrEqual(1.5);
  });
});

/** A bare Ship, enough for the scheduler to fill in times and lanes. */
function makeStubShip(i: number): Ship {
  return {
    id: i,
    name: `Stub ${i}`,
    classId: 'cargo',
    hp: 100,
    maxHp: 100,
    x: 0,
    y: 0,
    heading: 0,
    speed: 0,
    alive: true,
    delivered: false,
    modules: [],
    spawnTime: 0,
    spawned: false,
    laneIndex: 1,
    lateralSeed: 0,
    speedVariance: 1,
    straggling: false,
    fireSeconds: 0,
    pdCooldown: 0,
    pdShots: 0,
    disabledUntil: -1,
    smokeGraceUntil: -1,
    damageByBranch: {},
  } as unknown as Ship;
}
