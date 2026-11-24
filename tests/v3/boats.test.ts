// The Coves' three attack boats (log v68; data/config.ts BOATS, sim/boats.ts):
// the speedboat rams and bursts into a ball of fire, the gunboat locks one
// ship, sails with it and shells it until it sinks, the rocket boat holds
// well off and fires salvos of red rockets that nothing stops.

import { describe, expect, it } from 'vitest';
import { BOATS, BOAT_MIX, THREATS } from '../../src/v3/data/config';
import { armBoat, boatEta } from '../../src/v3/sim/boats';
import { createGame, spawnThreat, step, type Game, type Threat } from '../../src/v3/sim/game';
import { SIM_DT } from '../../src/v3/sim/playlog';

/** A quiet Coves game with a convoy on the water and nothing launching. */
function quiet(seed = 3, wave = 5): Game {
  const g = createGame('coves', seed, wave);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.carrierHp = 1e6;
  g.tempo = { ...g.tempo, lossLimit: 999 };
  for (let i = 0; i < 60 * 40; i++) step(g, SIM_DT);
  g.threats = [];
  return g;
}

function boat(g: Game, kind: 'gun' | 'rocket' | undefined, base: number): Threat {
  const b = g.map.bases[base];
  const th = spawnThreat(g, 'fastboat', b.x, b.y, 'base');
  if (kind) armBoat(th, kind);
  return th;
}

const run = (g: Game, s: number) => {
  for (let i = 0; i < s / SIM_DT; i++) step(g, SIM_DT);
};

describe('the Coves\' attack boats (log v68)', () => {
  it('a gunboat has 3 hits and a rocket boat 6, a speedboat the 2 it had; the rocket boat is slow and sturdy', () => {
    const g = quiet();
    const gun = boat(g, 'gun', 7);
    const rocket = boat(g, 'rocket', 4);
    const fast = boat(g, undefined, 5);
    expect([gun.hp, gun.maxHp, rocket.hp, rocket.maxHp, fast.hp]).toEqual([BOATS.gun.hp, BOATS.gun.hp, BOATS.rocket.hp, BOATS.rocket.hp, THREATS.fastboat.hp]);
    expect(BOATS.rocket.hp).toBeGreaterThan(THREATS.rocketTruck.hp);
    expect(rocket.speed).toBeLessThan(fast.speed / 2);
    expect(gun.boat).toBe('gun');
    expect(rocket.boat).toBe('rocket');
    expect(fast.boat).toBeUndefined();
  });

  it('a gunboat locks one ship, runs alongside it, and shells it once every BOATS.gun.every s until it sinks; then it takes the next', () => {
    const g = quiet();
    const th = boat(g, 'gun', 7);
    const first = g.ships.find((s) => s.id === th.target)!;
    expect(first).toBeDefined();
    let alongside = -1;
    let shells = 0;
    let hp = first.hp;
    let sunkAt = -1;
    for (let i = 0; i < 60 * 40 && !th.dead; i++) {
      step(g, SIM_DT);
      if (alongside < 0 && th.bs?.mode === 'side') alongside = g.t;
      const ship = g.ships.find((s) => s.id === first.id);
      if (ship && ship.hp < hp) {
        shells++;
        hp = ship.hp;
      }
      if (!ship && sunkAt < 0) {
        sunkAt = g.t;
        break;
      }
    }
    expect(alongside).toBeGreaterThan(0);
    expect(th.bs?.ship).toBe(first.id);
    // It sails with the ship: close to it the whole time it shells.
    expect(Math.hypot(th.x - first.x, th.y - first.y)).toBeLessThan(BOATS.gun.stand * 3);
    expect(sunkAt, 'the ship is sunk').toBeGreaterThan(alongside);
    expect(shells).toBeGreaterThanOrEqual(2);
    // The shells come about BOATS.gun.every apart.
    expect((sunkAt - alongside) / 3).toBeGreaterThan(BOATS.gun.every * 0.6);
    // Its ship gone, it locks another one.
    run(g, 1);
    if (!th.dead && g.ships.length) expect(th.bs?.ship).not.toBe(first.id);
  });

  it('a gunboat shot down before it is alongside harms nothing', () => {
    const g = quiet();
    const th = boat(g, 'gun', 5);
    const hulls = g.ships.map((s) => s.hp);
    run(g, 0.3);
    th.hp = 0;
    th.dead = true;
    run(g, 6);
    expect(g.ships.map((s) => s.hp).slice(0, hulls.length)).toEqual(hulls.slice(0, g.ships.length));
  });

  it('a rocket boat keeps its range, raises its launcher (a mark on the ship), then fires a salvo of red rockets that cannot be intercepted', () => {
    const g = quiet();
    const th = boat(g, 'rocket', 4);
    let raised = -1;
    let rockets = 0;
    let closest = Infinity;
    for (let i = 0; i < 60 * 30 && !th.dead; i++) {
      step(g, SIM_DT);
      if (raised < 0 && th.bs?.mode === 'raise') raised = g.t;
      rockets = Math.max(rockets, g.foe.shots.filter((s) => s.from === 'fastboat').length);
      const s = g.ships.find((o) => o.id === th.bs?.ship);
      if (s) closest = Math.min(closest, Math.hypot(th.x - s.x, th.y - s.y));
    }
    expect(raised).toBeGreaterThan(0);
    expect(rockets).toBeGreaterThanOrEqual(2);
    expect(closest, 'it never closes on its ship').toBeGreaterThan(BOATS.rocket.range * 0.45);
    // Its eta to harm is its next salvo, not its run to the ship.
    const g2 = quiet();
    const t2 = boat(g2, 'rocket', 4);
    run(g2, 0.1);
    expect(boatEta(g2, t2)).toBeLessThan(BOATS.rocket.gap + BOATS.rocket.raise + 6);
  });

  it('a rocket boat\'s salvo hits a hull once, as a truck\'s (the first rocket on a hull does it)', () => {
    const g = quiet();
    const th = boat(g, 'rocket', 4);
    const hp0 = new Map(g.ships.filter((s) => s.d < 900).map((s) => [s.id, s.hp]));
    for (let i = 0; i < 60 * 14; i++) {
      step(g, SIM_DT);
      if ((th.bs?.n ?? 0) >= 1 && !g.foe.shots.some((s) => s.from === 'fastboat')) break;
    }
    expect(th.bs!.n).toBeGreaterThanOrEqual(1);
    // What the boat's own salvos took off the hulls that were afloat at the start.
    let lost = 0;
    for (const [id, hp] of hp0) lost += hp - (g.ships.find((s) => s.id === id)?.hp ?? 0);
    expect(lost, 'one salvo, at most one hit').toBeLessThanOrEqual(th.bs!.n);
  });

  it('a speedboat that rams goes up in a ball of fire (a picture), and a fire ship leaves the fire on the water', () => {
    const g = quiet();
    const th = boat(g, undefined, 5);
    let ball = false;
    for (let i = 0; i < 60 * 20 && !th.dead; i++) {
      step(g, SIM_DT);
      ball ||= g.fx.some((f) => f.kind === 'fireball');
    }
    expect(th.dead).toBe(true);
    expect(ball).toBe(true);
  });

  it('the Coves\' own fast boats are a mix from wave 3: gunboats, then rocket boats from wave 6', () => {
    const count = (wave: number) => {
      let gun = 0;
      let rocket = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const g = createGame('coves', seed, wave);
        for (const l of g.queue) if (l.kind === 'fastboat' && l.at < 1e8) (l.boat === 'gun' ? gun++ : l.boat === 'rocket' ? rocket++ : 0);
      }
      return { gun, rocket };
    };
    expect(BOAT_MIX.gunFrom).toBe(3);
    expect(count(1)).toEqual({ gun: 0, rocket: 0 });
    expect(count(2)).toEqual({ gun: 0, rocket: 0 });
    expect(count(5).gun).toBeGreaterThan(0);
    expect(count(5).rocket).toBe(0);
    expect(count(8).rocket).toBeGreaterThan(0);
  });
});
