// Map visual-check round: what follows a map's water. The player's notes on
// the Kesh Hook: "the frigates do not follow the actual water path and just
// overlap the land" and "the enemy jets should follow the curve and make a
// banking turn around the bend".

import { describe, expect, it } from 'vitest';
import { MAPS, MAP_ORDER, type MapId } from '../../src/v3/data/maps';
import { laneAt, laneLength } from '../../src/v3/sim/lanes';
import { createGame, laneBends, routePose, step, timeToImpact, type Game, type Ship } from '../../src/v3/sim/game';
import { PLANE } from '../../src/v3/data/config';
import { auditFrigates, auditMap } from '../../tools/v3/route-audit';

const DT = 1 / 60;

function quiet(map: MapId): Game {
  const g = createGame(map, 1, 3);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.threats = [];
  g.ships = [];
  g.spawnT = 1e9;
  return g;
}

/** A ship parked on lane `ch` at distance d (it won't sail: speed 0 below). */
function parked(g: Game, id: number, ch: number, d: number): Ship {
  const p = laneAt(g.map.channels[ch], d, 0);
  const s: Ship = { id, x: p.x, y: p.y, d, lat: 0, heading: Math.atan2(p.ty, p.tx), hp: 3, slot: 0, channel: ch, mult: 1 };
  g.ships.push(s);
  return s;
}

describe('frigates sail the water on every map', () => {
  it('in, on station and off again at every level: never over land, on the carrier or on each other', () => {
    for (const map of MAP_ORDER)
      for (const level of [1, 2, 3]) {
        const { issues } = auditFrigates(map, level);
        expect(issues.map((i) => `${map} L${level} ${i.phase}: ${i.what} at ${i.at.x},${i.at.y}`)).toEqual([]);
      }
  });
});

describe('aircraft follow a curved lane round its bend', () => {
  it('only the curved lanes count as bends', () => {
    const bent = MAP_ORDER.filter((id) => MAPS[id].channels.some(laneBends));
    expect(bent.sort()).toEqual(['delta', 'kesh']);
  });

  it('a strafing jet on the Kesh Hook flies the lane round the turn and strafes ships on both reaches', () => {
    const g = quiet('kesh');
    const L = laneLength(g.map.channels[0]);
    // One ship on the west reach, one on the north reach after the turn.
    const west = parked(g, 9001, 0, 500);
    const north = parked(g, 9002, 0, L - 380);
    g.queue.unshift({ at: g.waveT + 0.01, kind: 'strafer', base: -1, side: 1, y: 720, lane: 0, lat: 0 });
    let maxBank = 0;
    let turned = false;
    for (let i = 0; i < 60 * 12; i++) {
      for (const s of g.ships) {
        const p = laneAt(g.map.channels[0], s.d, 0);
        s.x = p.x;
        s.y = p.y;
      }
      const d0 = [west.d, north.d];
      step(g, DT);
      west.d = d0[0];
      north.d = d0[1];
      const jet = g.threats.find((t) => t.kind === 'strafer');
      if (jet) {
        maxBank = Math.max(maxBank, Math.abs(jet.bank ?? 0));
        if (jet.heading < -1.2) turned = true; // pointing north
      }
    }
    expect(turned).toBe(true);
    expect(maxBank).toBeGreaterThan(0.3);
    expect(west.hp).toBeLessThan(3);
    expect(north.hp).toBeLessThan(3);
  });

  it('its warning time counts along the bend, not straight across', () => {
    const g = quiet('kesh');
    const L = laneLength(g.map.channels[0]);
    const north = parked(g, 9003, 0, L - 380);
    g.queue.unshift({ at: g.waveT + 0.01, kind: 'strafer', base: -1, side: 1, y: 720, lane: 0, lat: 0 });
    step(g, DT);
    step(g, DT);
    const jet = g.threats.find((t) => t.kind === 'strafer')!;
    const eta = timeToImpact(g, jet);
    // The route to the north reach is the lane's length, not the x gap.
    expect(eta).toBeGreaterThan((north.x - jet.x) / jet.speed);
    expect(eta).toBeLessThan(30);
  });

  it('on a straight map aircraft still fly a straight line across', () => {
    const g = quiet('strait');
    g.queue.unshift({ at: g.waveT + 0.01, kind: 'strafer', base: -1, side: 1 });
    for (let i = 0; i < 60; i++) step(g, DT);
    const jet = g.threats.find((t) => t.kind === 'strafer')!;
    expect(jet.route).toBeUndefined();
    expect(Math.abs(jet.y - g.map.channels[0].y)).toBeLessThan(200);
  });
});

describe('aircraft fly a smooth path round a bend', () => {
  // Playtest note (Kesh Hook, wave 7): "Plane turned for the bomber was not
  // smooth". A bomber flies beside the lane; stepping it along the lane
  // made it lurch (175 px/s reached 1,045 at the Kesh Hook and 4,600 at the
  // Delta, turning at up to 14 rad/s).
  it('bombers and strafers on every bending map keep their speed, turn gently and stay on their route', () => {
    for (const map of MAP_ORDER) {
      for (const seed of [1, 2, 3]) {
        const g = createGame(map, seed, 8);
        const prev = new Map<number, { x: number; y: number; h: number }>();
        for (let i = 0; i < 60 * 70 && g.phase === 'wave'; i++) {
          for (const s of g.ships) s.hp = 99;
          g.carrierHp = 99;
          step(g, DT);
          for (const th of g.threats) {
            if ((th.kind !== 'bomber' && th.kind !== 'strafer') || !th.route) continue;
            const p = prev.get(th.id);
            prev.set(th.id, { x: th.x, y: th.y, h: th.heading });
            if (!p || th.x < 30 || th.x > 1570 || th.y < 30 || th.y > 870) continue;
            const v = Math.hypot(th.x - p.x, th.y - p.y) / DT;
            const turn = Math.abs(Math.atan2(Math.sin(th.heading - p.h), Math.cos(th.heading - p.h))) / DT;
            const q = routePose(g, th.route);
            const tag = `${map} seed ${seed} ${th.kind}`;
            expect(v, `${tag}: speed`).toBeLessThan(th.speed * 1.05 + 1);
            expect(v, `${tag}: speed`).toBeGreaterThan(th.speed * 0.95 - 1);
            expect(turn, `${tag}: turn rate`).toBeLessThanOrEqual(PLANE.turnRate + 1e-6);
            expect(Math.hypot(q.x - th.x, q.y - th.y), `${tag}: off its route`).toBeLessThan(40);
          }
        }
      }
    }
  });
});

describe('trucks, submarines, coves and the rest keep to their side of the coast', () => {
  it('every map: roads on enemy land and clear of silos, pop-ups stopping at the shore, subs on open water off the lanes', () => {
    // Bomber lines may cross land (an aircraft flies over it); everything
    // else on the list is a fault.
    for (const map of MAP_ORDER) expect(auditMap(map).filter((i) => !i.what.startsWith('bomber line')).map((i) => `${map}: ${i.what}`)).toEqual([]);
  });
});
