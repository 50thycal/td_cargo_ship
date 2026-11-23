// Test Lab round 1: homing missiles fly a near-straight line to their target
// and never circle it ("the hellfire missiles from the gun ship ...
// sometimes it'll circle the entire thing"; "the missile for the enemy
// helicopter also needs to be fixed").
//
// The cause: both turned at a capped rate (the Hellfire at 2.5 rad/s at
// first, at 1150 px/s: a turning circle 460 px across; the helicopter's
// missile at 3 rad/s), and both left the rail along the helicopter's nose.
// A target inside the turning circle (close, and off to the side or behind)
// can't be reached that way: the missile orbits it. Now they leave the rail
// pointed at the target, and turn at least 3·speed/distance (homingTurn), so
// the circle is never wide enough to hold the target.

import { describe, expect, it } from 'vitest';
import { AB } from '../../src/v3/data/abilities';
import { SHIP } from '../../src/v3/data/config';
import { angleDiff, createGame, homingTurn, launchHellfire, spawnThreat, step, type Game } from '../../src/v3/sim/game';

const DT = 1 / 60;

/** A wave with nothing launching on its own, a few ships sailing. */
function quiet(seed = 1): Game {
  const g = createGame('strait', seed);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.threats = [];
  for (let i = 0; i < 20 / DT; i++) step(g, DT);
  g.threats = [];
  return g;
}

/** Fly a point missile with homingTurn at a target; how long it took and
 *  how far it turned in all. */
function fly(speed: number, base: number, d: number, err: number, tv: { x: number; y: number }, reach: number) {
  let x = 0;
  let y = 0;
  let h = err;
  let tx = d;
  let ty = 0;
  let turned = 0;
  for (let t = 0; t < 10; t += DT) {
    tx += tv.x * DT;
    ty += tv.y * DT;
    const dd = Math.hypot(tx - x, ty - y);
    if (dd <= reach) return { t, turned };
    const want = Math.atan2(ty - y, tx - x);
    const turn = homingTurn(base, speed, dd) * DT;
    const dh = Math.max(-turn, Math.min(turn, angleDiff(want, h)));
    h += dh;
    turned += Math.abs(dh);
    x += Math.cos(h) * speed * DT;
    y += Math.sin(h) * speed * DT;
  }
  return { t: Infinity, turned };
}

describe('homing that never circles', () => {
  it('from any heading, at any range, at a still or a crossing target: it gets there in bounded time, turning less than a full circle', () => {
    const cases = [
      { speed: AB.gunships.missileSpeed, base: AB.gunships.missileTurn, reach: AB.gunships.missileSpeed * DT + 14 },
      { speed: 200, base: 3, reach: SHIP.hitRadius },
    ];
    for (const c of cases) {
      for (const d of [30, 60, 120, 250, 400]) {
        for (let k = 0; k <= 8; k++) {
          const err = (k / 8) * Math.PI;
          for (const tv of [{ x: 0, y: 0 }, { x: 0, y: 60 }, { x: -40, y: 40 }]) {
            const r = fly(c.speed, c.base, d, err, tv, c.reach);
            const label = `speed ${c.speed}, ${d} px, ${err.toFixed(2)} rad off, target moving ${tv.x},${tv.y}`;
            // Never a loop: less than one full turn in all...
            expect(r.turned, label).toBeLessThan(1.5 * Math.PI);
            // ...and there within the straight-line time, plus the turn.
            expect(r.t, label).toBeLessThan((d * 2) / c.speed + 0.6);
          }
        }
      }
    }
  });

  it('a Gunship Pair\'s Hellfire leaves the rail pointed at its target and flies a near-straight line to it, wherever the helicopter faces', () => {
    const H = AB.gunships;
    for (const [dx, dy] of [[0, -300], [250, 0], [-120, 90], [60, -40], [-300, -200], [20, 30]]) {
      for (const nose of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 2.5]) {
        const g = quiet();
        const th = spawnThreat(g, 'drone', 800, 450, 'base');
        th.held = true;
        th.hp = 99;
        const sx = 800 + dx;
        const sy = 450 + dy;
        launchHellfire(g, sx, sy, nose, th, 1);
        const m = g.hellfires[g.hellfires.length - 1];
        const label = `from ${dx},${dy}, nose ${nose}`;
        // Off the rail within HELLFIRE_KICK of the target's bearing.
        expect(Math.abs(angleDiff(m.heading, Math.atan2(450 - sy, 800 - sx))), label).toBeLessThanOrEqual(0.35 + 1e-9);
        let turned = 0;
        let h = m.heading;
        let flown = 0;
        let px = m.x;
        let py = m.y;
        let lastT = 0;
        while (g.hellfires.includes(m)) {
          lastT = m.t;
          step(g, DT);
          turned += Math.abs(angleDiff(m.heading, h));
          flown += Math.hypot(m.x - px, m.y - py);
          h = m.heading;
          if (g.hellfires.includes(m)) {
            px = m.x;
            py = m.y;
          }
        }
        // It burst on arrival, not on running out of time.
        expect(lastT, label).toBeLessThan(1.4 - DT);
        expect(Math.hypot(px - 800, py - 450), label).toBeLessThan(H.missileSpeed * DT * 2 + 14);
        // It reached the drone (the burst hurt it) without a loop, and flew
        // little more than the straight line.
        expect(th.hp, label).toBeLessThan(99);
        expect(turned, label).toBeLessThan(1);
        expect(flown, label).toBeLessThan(Math.hypot(dx, dy) * 1.25 + H.missileSpeed * DT * 2);
      }
    }
  });

  it('an enemy helicopter\'s missile reaches its ship even launched close and facing away', () => {
    for (const [dx, dy] of [[0, -70], [90, 0], [-60, -60], [150, 40], [-200, -120]]) {
      for (const turn of [0, Math.PI / 2, Math.PI]) {
        const g = quiet(2);
        const s = g.ships[0];
        const m = spawnThreat(g, 'heliRocket', s.x + dx, s.y + dy, 'air');
        m.target = s.id;
        m.heading = Math.atan2(-dy, -dx) + turn;
        const hp = s.hp;
        let turned = 0;
        let h = m.heading;
        let t = 0;
        while (!m.dead && t < 5) {
          step(g, DT);
          t += DT;
          turned += Math.abs(angleDiff(m.heading, h));
          h = m.heading;
        }
        const label = `from ${dx},${dy}, turned ${turn}`;
        expect(m.dead, label).toBe(true);
        expect(s.hp < hp || !g.ships.includes(s), label).toBe(true);
        expect(turned, label).toBeLessThan(1.5 * Math.PI);
        expect(t, label).toBeLessThan((Math.hypot(dx, dy) * 1.6) / m.speed + 0.8);
      }
    }
  });
});
