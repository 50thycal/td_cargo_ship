// The weapons plan, phase 4 (docs/design/v3-weapons-plan.md): the player's
// maybes, built to be tried: Tidal Cannon, Storm Front, Ammunition Ship. Each
// test is a real game with threats placed by hand, played through taps.

import { describe, expect, it } from 'vitest';
import { AB, WEAPON, type AbilityId } from '../../src/v3/data/abilities';
import { ROSTER } from '../../src/v3/data/roster';
import { CARRIER_TARGET, ammoReload, createGame, step, tap, type Game, type Threat } from '../../src/v3/sim/game';

const DT = 1 / 60;
const run = (g: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / DT) && g.phase === 'wave'; i++) step(g, DT);
};

function quietGame(seed = 1): Game {
  const g = createGame('strait', seed, 1);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
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

function pickUp(g: Game, id: AbilityId, level = 1): void {
  g.levels[id] = level;
  if (!g.slots.includes(id)) g.slots.push(id);
  g.pickups.push({ id: g.nextId++, kind: 'weapon', weapon: id, x: 300, y: 600, age: 0 });
  expect(tap(g, 300, 600, 30)).toBe('pickup');
}

describe('the experiments are prototypes', () => {
  it('Tidal Cannon is an active, Storm Front and the Ammunition Ship passives; none in the campaign draft', () => {
    expect(ROSTER.tidal).toMatchObject({ cat: 'active', status: 'prototype' });
    expect(ROSTER.storm).toMatchObject({ cat: 'passive', status: 'prototype' });
    expect(ROSTER.ammoShip).toMatchObject({ cat: 'passive', status: 'prototype' });
  });
});

describe('Tidal Cannon', () => {
  it('a shot on open water rolls a wave that swamps a boat and a mine; a missile flies over it', () => {
    const g = quietGame();
    load(g, 'tidal', 1);
    const boat = addThreat(g, { kind: 'fastboat', x: 900, y: 400, hp: 2 });
    const mine = addThreat(g, { kind: 'mine', x: 700, y: 420, hp: 1, target: -2 });
    const missile = addThreat(g, { kind: 'guided', x: 820, y: 330, hp: 2 });
    const far = addThreat(g, { kind: 'fastboat', x: 1300, y: 400, hp: 2 });
    const ammo = g.ammo;
    expect(tap(g, 800, 400, 20)).toBe('fire');
    expect(g.ammo).toBe(ammo - 1);
    run(g, 0.6);
    expect(boat.dead).toBe(true);
    expect(mine.dead).toBe(true);
    expect(missile.dead).toBe(false);
    expect(far.dead).toBe(false);
    expect(g.waves).toHaveLength(0);
  });

  it('a drone diving on a hull goes under; one high in the sky does not', () => {
    const g = quietGame();
    run(g, 6);
    load(g, 'tidal', 1);
    const s = g.ships[0];
    const diving = addThreat(g, { x: s.x + 60, y: s.y - 40, target: s.id });
    const high = addThreat(g, { x: s.x + 60, y: s.y - 260, target: s.id });
    tap(g, s.x + 60, s.y - 150, 6);
    run(g, 0.5);
    expect(diving.dead).toBe(true);
    expect(high.dead).toBe(false);
  });

  it('a tap on a boat raises the wave right there (a phone tap rarely finds open water beside one)', () => {
    const g = quietGame();
    load(g, 'tidal', 1);
    const boat = addThreat(g, { kind: 'fastboat', x: 900, y: 400, hp: 2 });
    tap(g, 905, 400, 135);
    expect(g.waves).toHaveLength(1);
    run(g, 0.3);
    expect(boat.dead).toBe(true);
  });

  it('a tap on a missile (or a drone high in the sky) is a plain shot', () => {
    const g = quietGame();
    load(g, 'tidal', 1);
    addThreat(g, { x: 800, y: 300, hp: 3 });
    tap(g, 800, 300, 30);
    expect(g.waves).toHaveLength(0);
    expect(g.interceptors).toHaveLength(1);
  });

  it('level 2 shoves what it passes back; Tsunami rolls across the whole sea', () => {
    const g = quietGame();
    load(g, 'tidal', 2);
    const m = addThreat(g, { kind: 'guided', x: 900, y: 400, hp: 2 });
    tap(g, 800, 400, 6);
    run(g, 0.3);
    expect(m.x).toBeGreaterThan(900 + AB.tidal.shove[1] - 5);
    const h = quietGame();
    load(h, 'tidal', 3);
    const boat = addThreat(h, { kind: 'fastboat', x: 1500, y: 150, hp: 2 });
    tap(h, 200, 600, 6);
    run(h, 2.5);
    expect(boat.dead).toBe(true);
  });
});

describe('Storm Front', () => {
  it('a cell drifts with the wind; lightning strikes a drone in it', () => {
    const g = quietGame(2);
    pickUp(g, 'storm', 1);
    expect(g.storms).toHaveLength(1);
    const cell = g.storms[0];
    const x0 = cell.x;
    const d = addThreat(g, { x: cell.x, y: cell.y, hp: 2 });
    run(g, 1);
    expect(Math.abs(cell.x - x0)).toBeCloseTo(AB.storm.drift[0], -1);
    expect(d.dead).toBe(true);
    expect(g.fx.some((f) => f.kind === 'bolt') || g.kills.drone > 0).toBe(true);
  });

  it('half the missiles that cross it are blown into the sea', () => {
    const g = quietGame(2);
    pickUp(g, 'storm', 1);
    const cell = g.storms[0];
    cell.vx = 0;
    const ms = [0, 1, 2, 3, 4, 5].map((k) => addThreat(g, { kind: 'guided', x: cell.x + (k - 2.5) * 20, y: cell.y, hp: 5 }));
    run(g, 0.1);
    const blown = ms.filter((m) => m.dead).length;
    expect(blown).toBe(3);
  });

  it('Hurricane: two cells; the storm leaves when the weapon does', () => {
    const g = quietGame(2);
    pickUp(g, 'storm', 3);
    expect(g.storms).toHaveLength(2);
    g.weapon = null;
    run(g, 0.1);
    expect(g.storms).toHaveLength(0);
  });
});

describe('Ammunition Ship', () => {
  it('sails in at the entry; while it floats the rack reloads twice as fast', () => {
    const g = quietGame();
    run(g, 2);
    pickUp(g, 'ammoShip', 1);
    run(g, 3);
    const ship = g.ships.find((s) => s.ammo);
    expect(ship).toBeDefined();
    expect(ship!.hp).toBe(AB.ammoShip.hp[0]);
    expect(ammoReload(g)).toBe(2);
    g.ammo = 0;
    g.reloadT = 0;
    run(g, g.stats.reload * 2.1 / 2);
    expect(g.ammo).toBe(2);
  });

  it('every other missile aimed at a ship goes for it; sunk, it isn’t a lost ship', () => {
    const g = createGame('strait', 3, 3);
    g.raiderQueue = [];
    run(g, 4);
    pickUp(g, 'ammoShip', 1);
    for (let i = 0; i < 60 * 30 && !g.ships.some((s) => s.ammo && s.x > 150); i++) step(g, DT);
    const ship = g.ships.find((s) => s.ammo)!;
    expect(ship).toBeDefined();
    let at = 0;
    let shipTargets = 0;
    for (let i = 0; i < 60 * 30 && g.phase === 'wave' && g.ships.includes(ship); i++) {
      step(g, DT);
      for (const th of g.threats) if (th.age < DT * 1.5 && th.target >= 0) {
        shipTargets++;
        if (th.target === ship.id) at++;
      }
    }
    expect(at).toBeGreaterThan(shipTargets * 0.3);
    const lost = g.lost;
    ship.hp = 1;
    if (g.ships.includes(ship)) {
      g.shieldT = 0;
      // A hit it can't take: it sinks, and the convoy's losses don't move.
      const m = addThreat(g, { kind: 'guided', x: ship.x, y: ship.y, hp: 1, target: ship.id });
      run(g, 0.1);
      expect(m.dead).toBe(true);
    }
    expect(g.ships.includes(ship)).toBe(false);
    expect(g.lost).toBe(lost);
    expect(ammoReload(g)).toBe(1);
  });

  it('a pickup while it floats repairs it instead of sending another', () => {
    const g = quietGame();
    run(g, 2);
    pickUp(g, 'ammoShip', 1);
    run(g, 3);
    const ship = g.ships.find((s) => s.ammo)!;
    ship.hp = 1;
    pickUp(g, 'ammoShip', 2);
    run(g, 2);
    expect(g.ships.filter((s) => s.ammo)).toHaveLength(1);
    expect(ship.hp).toBe(AB.ammoShip.hp[1]);
  });

  it('Arsenal Ship: a free round at the nearest threat every 2 s', () => {
    const g = quietGame();
    run(g, 2);
    pickUp(g, 'ammoShip', 3);
    for (let i = 0; i < 60 * 20 && !g.ships.some((s) => s.ammo && s.x > 200); i++) step(g, DT);
    const ship = g.ships.find((s) => s.ammo)!;
    const ammo = g.ammo;
    addThreat(g, { x: ship.x, y: ship.y - 200, hp: 9 });
    run(g, 2.1);
    expect(g.interceptors.length + g.kills.drone).toBeGreaterThan(0);
    expect(g.ammo).toBeGreaterThanOrEqual(ammo);
  });
});
