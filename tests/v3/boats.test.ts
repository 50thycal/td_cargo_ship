// The Coves' three attack boats (log v69; data/config.ts BOATS, sim/boats.ts):
// the speedboat rams and bursts into a ball of fire, the gunboat locks one
// ship, sails with it and shells it until it sinks, the rocket boat holds
// well off and fires salvos of red rockets that nothing stops.

import { describe, expect, it } from 'vitest';
import { BOATS, BOAT_MIX, THREATS } from '../../src/v3/data/config';
import { VERSION_DEFAULT } from '../../src/v3/data/encounters';
import { labCard, mapCardId } from '../../src/v3/data/lab';
import { boatEta } from '../../src/v3/sim/boats';
import { onLand } from '../../src/v3/sim/foes';
import { createGame, step, type Game, type Threat } from '../../src/v3/sim/game';
import { BotRun, PERSONAS } from '../../src/v3/sim/mimic';
import { SIM_DT } from '../../src/v3/sim/playlog';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../src/v3/ui/lab';
import { PLAYER_ARMORY } from '../../tools/v3/bot-fit/measure';

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

/** A boat launched out of cove `base`, as the game launches one (it surfaces
 *  inside the inlet and sails out of the mouth), aimed at the ship halfway
 *  along. */
function boat(g: Game, kind: 'gun' | 'rocket' | undefined, base: number): Threat {
  g.queue = [{ at: g.waveT, kind: 'fastboat', base, aim: 'mid', ...(kind ? { boat: kind } : {}) }, { at: 1e9, kind: 'drone', base: 0 }];
  const before = new Set(g.threats.map((t) => t.id));
  for (let i = 0; i < 4; i++) step(g, SIM_DT);
  const th = g.threats.find((t) => t.kind === 'fastboat' && !before.has(t.id));
  if (!th) throw new Error('no boat launched');
  return th;
}

const run = (g: Game, s: number) => {
  for (let i = 0; i < s / SIM_DT; i++) step(g, SIM_DT);
};

describe('the Coves\' attack boats (log v69)', () => {
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
    // Alongside (log v72): BOATS.gun.stand px off its beam, not 66.
    expect(BOATS.gun.stand).toBeGreaterThanOrEqual(150);
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
    expect(Math.hypot(th.x - first.x, th.y - first.y)).toBeLessThan(BOATS.gun.stand * 2);
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
    let shortest = Infinity;
    for (let i = 0; i < 60 * 30 && !th.dead; i++) {
      step(g, SIM_DT);
      if (raised < 0 && th.bs?.mode === 'raise') raised = g.t;
      if (th.bs?.mode === 'raise') {
        const s0 = g.ships.find((o) => o.id === th.bs?.ship);
        if (s0) shortest = Math.min(shortest, Math.hypot(th.x - s0.x, th.y - s0.y));
      }
      rockets = Math.max(rockets, g.foe.shots.filter((s) => s.from === 'fastboat').length);
      const s = g.ships.find((o) => o.id === th.bs?.ship);
      if (s) closest = Math.min(closest, Math.hypot(th.x - s.x, th.y - s.y));
    }
    expect(raised).toBeGreaterThan(0);
    expect(rockets).toBeGreaterThanOrEqual(2);
    expect(closest, 'it never closes on its ship').toBeGreaterThan(BOATS.rocket.keep - 1);
    // It fires from well off (330 before log v72): from at least half its range, and its range is longer.
    expect(BOATS.rocket.range).toBeGreaterThanOrEqual(430);
    expect(shortest, 'it raises its launcher from far off').toBeGreaterThan(BOATS.rocket.range * 0.5);
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

  it('every boat comes out of its cove: it surfaces inside the inlet, sails out of the mouth, and only then turns for its ship', () => {
    for (const base of [4, 5, 6, 7]) {
      const g = quiet();
      const cove = g.map.bases[base];
      const th = boat(g, undefined, base);
      expect(cove.cove).toBe(true);
      expect(th.cove).toBe(true);
      // Up at the inner end of the inlet, bow to the mouth.
      expect(Math.hypot(th.x - cove.inner!.x, th.y - cove.inner!.y)).toBeLessThan(6);
      expect(th.mouth).toBeDefined();
      let out = -1;
      for (let i = 0; i < 60 * 4 && !th.dead; i++) {
        step(g, SIM_DT);
        expect(onLand(g, th.x, th.y), `cove ${base} at ${th.x.toFixed(0)},${th.y.toFixed(0)}`).toBe(false);
        if (out < 0 && !th.mouth) out = th.age;
      }
      // Through the mouth in a second or two, not popping out at the ship.
      expect(out).toBeGreaterThan(0.6);
      expect(out).toBeLessThan(3);
    }
  });

  it('a gunboat is held off the hulls: it fires from BOATS.gun.stand away and never sits on a ship', () => {
    const g = quiet(3, 6);
    const th = boat(g, 'gun', 7);
    let fired = Infinity;
    let nearest = Infinity;
    for (let i = 0; i < 60 * 30 && !th.dead; i++) {
      // The ship it is about to shell, and where both are as it does.
      const s0 = g.ships.find((o) => o.id === th.bs?.ship);
      const was = s0 ? Math.hypot(th.x - s0.x, th.y - s0.y) : Infinity;
      const flash = th.bs!.flash;
      step(g, SIM_DT);
      if (th.bs!.flash !== flash) fired = Math.min(fired, was);
      for (const o of g.ships) nearest = Math.min(nearest, Math.hypot(th.x - o.x, th.y - o.y));
    }
    expect(fired, 'it shelled at all').toBeLessThan(Infinity);
    expect(fired, 'it shelled from its station').toBeLessThan(BOATS.gun.stand + 20);
    expect(fired).toBeGreaterThan(BOATS.gun.stand - 20);
    expect(nearest).toBeGreaterThanOrEqual(BOATS.gun.keep - 1);
  });

  it('whole bot runs: no boat is ever on land, none is launched from a truck, a gunboat or rocket boat never sits on a hull', () => {
    for (const seed of [903, 911, 925, 940]) {
      const card = labCard(mapCardId('coves', VERSION_DEFAULT))!;
      const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
      const run = new BotRun('coves', seed, { persona: PERSONAS.you, armory: PLAYER_ARMORY, lab: plan.lab, ...(plan.convoy ? { convoy: plan.convoy } : {}), ...(plan.encounters ? { encounters: plan.encounters } : {}) });
      const g = run.game;
      let boats = 0;
      let wet = true;
      let truck = 0;
      let sat = 0;
      const seen = new Set<number>();
      while (!run.done) {
        run.advance(1);
        for (const r of g.raiderQueue) for (const u of r.units) if (u.kind === 'fastboat') truck++;
        for (const r of g.raiders) for (const u of [...r.units, ...r.rounds.map((kind) => ({ kind }))]) if (u.kind === 'fastboat') truck++;
        for (const th of g.threats) {
          if (th.kind !== 'fastboat' || th.dead) continue;
          if (!seen.has(th.id)) {
            seen.add(th.id);
            boats++;
            if (th.from !== undefined) truck++;
          }
          if (onLand(g, th.x, th.y)) wet = false;
          if (th.boat && th.bs?.mode !== 'leave') for (const o of g.ships) if (Math.hypot(th.x - o.x, th.y - o.y) < BOATS.gun.keep - 1) sat++;
        }
      }
      expect(boats, `seed ${seed}`).toBeGreaterThan(20);
      expect(wet, `seed ${seed}: every boat, every step, on water`).toBe(true);
      expect(truck, `seed ${seed}: no truck launches a boat`).toBe(0);
      expect(sat, `seed ${seed}: no gunboat or rocket boat on a hull`).toBe(0);
    }
  }, 120_000);
});
