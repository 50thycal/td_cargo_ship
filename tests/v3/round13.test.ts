// Round 13 (docs/design/v3-round13-escorts-munitions-nuke.md): the player's
// notes from The Strait.
// - Wave 6: "You should not be allowed to attack any enemy munitions until
//   it's actually released from its launcher." A supersonic arming on its
//   rail is no target for anything; the launcher still is.
// - Wave 8: "The nuke should blow up everything on the map, even the
//   launcher trucks, even after it left."
// (Frigates and the convoy: frigateOverlap.test.ts.)

import { describe, expect, it } from 'vitest';
import { WEAPON, type AbilityId } from '../../src/v3/data/abilities';
import { PICKUPS, SUPERSONIC } from '../../src/v3/data/config';
import { FOE } from '../../src/v3/data/foes';
import { launchFoe } from '../../src/v3/sim/foes';
import { CARRIER_TARGET, createGame, damageThreat, released, step, tap, worthShooting, type Game, type Raider, type Threat } from '../../src/v3/sim/game';

const DT = 1 / 60;
const run = (g: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / DT) && g.phase === 'wave'; i++) step(g, DT);
};

function quietGame(seed = 1): Game {
  const g = createGame('strait', seed, 1);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  run(g, 20);
  g.threats = [];
  return g;
}

function addThreat(g: Game, over: Partial<Threat>): Threat {
  const th: Threat = {
    id: g.nextId++, kind: 'drone', x: 800, y: 300, vx: 0, vy: 0, hp: 1, speed: 0, heading: Math.PI / 2, target: CARRIER_TARGET,
    age: 0, phase: 0, dead: false, sx: 0, sy: 0, ix: 0, iy: 0, dur: 1, apex: 0, spawnT: 0, ...over,
  };
  g.threats.push(th);
  return th;
}

function load(g: Game, id: AbilityId, level = 1): void {
  g.levels[id] = level;
  if (!g.slots.includes(id)) g.slots.push(id);
  g.weapon = { id, level, t: WEAPON.time, t0: g.t };
}

/** A supersonic on its rail at a launch site (as a base launches one). */
const onRail = (g: Game, x = 700, y = 260) => addThreat(g, { kind: 'supersonic', x, y, hp: 1, speed: 430 });
const aimedAt = (g: Game, th: Threat) => g.interceptors.some((i) => i.target === th.id);

describe('munitions on their launcher are no target (round 13)', () => {
  it('a supersonic arming on its rail is not released; off the rail it is', () => {
    const g = quietGame();
    const m = onRail(g);
    expect(released(m)).toBe(false);
    run(g, SUPERSONIC.arming + 0.05);
    expect(released(m)).toBe(true);
  });

  it('a tap on it alone is a tap on empty water: no shot at it', () => {
    const g = quietGame();
    const m = onRail(g);
    const ammo = g.ammo;
    expect(tap(g, m.x, m.y, 40)).toBe('empty');
    expect(aimedAt(g, m)).toBe(false);
    expect(g.ammo).toBe(ammo);
    // Off the rail, the same tap shoots it.
    run(g, SUPERSONIC.arming + 0.02);
    expect(tap(g, m.x, m.y, 60)).toBe('fire');
    expect(aimedAt(g, m)).toBe(true);
  });

  it('a tap on it and its launcher hits the launcher', () => {
    const g = quietGame();
    // A helicopter hovering over the rail (anything shootable beside it).
    const heli = addThreat(g, { kind: 'attackHeli', x: 712, y: 262, hp: 3 });
    const m = onRail(g, 700, 260);
    expect(tap(g, 700, 260, 40)).toBe('fire');
    expect(aimedAt(g, heli)).toBe(true);
    expect(aimedAt(g, m)).toBe(false);
  });

  it('no blast, field or helper touches it: a thermobaric burst on top of it, any damage, a Gravity Well, the bots', () => {
    const g = quietGame();
    const m = onRail(g);
    load(g, 'thermo', 3);
    tap(g, m.x, m.y, 40);
    expect(m.dead).toBe(false);
    damageThreat(g, m, 9, true, 'blast');
    damageThreat(g, m, 9, true, 'frigate');
    expect(m.dead).toBe(false);
    expect(m.hp).toBe(1);
    expect(worthShooting(g, g.threats)).not.toContain(m);
    // A well right on it neither drags it nor slows its arming.
    g.fields.push({ kind: 'well', x1: m.x + 40, y1: m.y, x2: m.x + 40, y2: m.y, hw: 200, t: 0, life: 60, tick: 0, level: 3 });
    const x = m.x;
    run(g, 0.5);
    expect(m.x).toBe(x);
    expect(m.age).toBeCloseTo(0.5, 1);
  });

  it('the frigates hold fire at it until it is away, then shoot it', () => {
    const g = quietGame();
    g.levels = { ...g.levels, frigate: 3 };
    g.slots = ['frigate'];
    g.pickups.push({ id: g.nextId++, kind: 'weapon', weapon: 'frigate', x: 300, y: 600, age: 0 });
    tap(g, 300, 600, 30);
    run(g, 6);
    const m = onRail(g, 800, 470);
    const helpers = () => g.interceptors.filter((i) => i.target === m.id && i.by).length;
    run(g, SUPERSONIC.arming - 0.1);
    expect(helpers()).toBe(0);
    run(g, 0.6);
    expect(m.dead || helpers() > 0).toBe(true);
  });

  it('the Nuke takes a launch truck and the missile still on its rail', () => {
    const g = quietGame();
    const road = g.map.roads.popups[0];
    const r: Raider = { id: g.nextId++, kind: 'popup', x: road.to.x, y: road.to.y, heading: 0, state: 'fire', t: 0, path: [road.from, road.to], dist: 100, length: 400, stops: [], rounds: ['supersonic'], units: [], fireT: 0 };
    g.raiders.push(r);
    run(g, 0.1);
    const m = g.threats.find((t) => t.kind === 'supersonic' && t.from === r.id)!;
    expect(m).toBeDefined();
    expect(released(m)).toBe(false);
    g.pickups.push({ id: g.nextId++, kind: 'nuke', x: 500, y: 500, age: 0 });
    tap(g, 500, 500, 20);
    expect(m.dead).toBe(true);
  });
});

describe('the Nuke destroys everything on the map (round 13)', () => {
  it('trucks driving in and driving off (off the screen too), a popup truck reversing out, helicopters off screen, a Spotter away, a missile on its rail', () => {
    const g = quietGame();
    // A rocket truck that has fired and is driving off, now off the screen.
    launchFoe(g, { at: 0, kind: 'rocketTruck', base: -1 });
    const gone = g.threats.find((t) => t.kind === 'rocketTruck')!;
    gone.foe!.state = 4;
    gone.x = -60;
    gone.y = 940;
    // One still driving in, off the screen.
    launchFoe(g, { at: 0, kind: 'rocketTruck', base: -1 });
    const coming = g.threats.filter((t) => t.kind === 'rocketTruck')[1];
    coming.x = 1660;
    // A helicopter coming in from off the screen.
    const heli = addThreat(g, { kind: 'attackHeli', x: -50, y: 300, hp: 3 });
    // A Spotter away between its turns (off the board in a recall mark).
    const spotter = addThreat(g, { kind: 'spotter', x: -60, y: 200, hp: 2 });
    spotter.dead = true;
    g.threats = g.threats.filter((t) => t !== spotter);
    g.foe.marks.push({ id: g.nextId++, kind: 'recall', x: -60, y: 200, t: 0, dur: 99, gun: spotter });
    // A popup launch truck reversing back up its road after firing.
    const road = g.map.roads.popups[0];
    const truck: Raider = { id: g.nextId++, kind: 'popup', x: road.from.x, y: road.from.y, heading: 0, state: 'reverse', t: 0, path: [road.from, road.to], dist: 30, length: 400, stops: [], rounds: [], units: [], fireT: 0 };
    g.raiders.push(truck);
    const rail = onRail(g);
    const kills = { ...g.kills };
    g.pickups.push({ id: g.nextId++, kind: 'nuke', x: 500, y: 500, age: 0 });
    expect(tap(g, 500, 500, 20)).toBe('pickup');
    for (const th of [gone, coming, heli, spotter, rail]) expect(th.dead, th.kind).toBe(true);
    expect(g.kills.rocketTruck - kills.rocketTruck).toBe(2);
    expect(g.kills.attackHeli - kills.attackHeli).toBe(1);
    expect(g.kills.spotter - kills.spotter).toBe(1);
    expect(g.kills.supersonic - kills.supersonic).toBe(1);
    expect(truck.state === 'reverse' && truck.dist === 0).toBe(true);
    expect(g.events.some((e) => e.kind === 'bigKill' && e.label === 'TRUCK DESTROYED')).toBe(true);
    // Nothing comes back.
    run(g, FOE.siege.down + 2);
    expect(g.raiders).toHaveLength(0);
    expect(g.threats.filter((t) => t.kind === 'spotter' || t.kind === 'rocketTruck' || t.kind === 'attackHeli')).toHaveLength(0);
  });

  it('structures still take PICKUPS.nukeStructure hits (the player\'s pick, "3 hits, not a kill"), wherever they are', () => {
    const g = quietGame();
    const rig = addThreat(g, { kind: 'rig', hp: 10, x: 600, y: 150 });
    g.pickups.push({ id: g.nextId++, kind: 'nuke', x: 500, y: 500, age: 0 });
    tap(g, 500, 500, 20);
    expect(rig.dead).toBe(false);
    expect(rig.hp).toBe(10 - PICKUPS.nukeStructure);
  });
});
