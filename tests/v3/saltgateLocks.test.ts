// Saltgate Canal's locks and frigates (docs/design/v3-saltgate-locks.md).
// The player: "The gates for the canal did not work. I think the escorts
// broke it." The jam was the locks' own: at a flow above the default the
// next hull sailed into the entry gateway behind a full chamber, so the gate
// never shut. Now a lock admits only what its chamber holds, with a backstop;
// and frigates never pass a gate (they berth beside the canal, coming in
// from the sides).

import { describe, expect, it } from 'vitest';
import { AB, WEAPON } from '../../src/v3/data/abilities';
import { FLOW_STEPS, LOCK, SHIP } from '../../src/v3/data/config';
import { FORMATION_ORDER } from '../../src/v3/data/formations';
import { MAPS, type MapId } from '../../src/v3/data/maps';
import { laneAt, laneDAtX } from '../../src/v3/sim/lanes';
import { createGame, setFlow, setFormation, step, tap, type Game, type Ship } from '../../src/v3/sim/game';

const DT = 1 / 60;

/** No enemy (the canal itself is under test), nothing sinks. */
function canal(seed = 1): Game {
  const g = createGame('saltgate', seed);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.threats = [];
  g.tempo = { ...g.tempo, lossLimit: 1e9 };
  return g;
}

function run(g: Game, seconds: number, each?: () => void): void {
  for (let i = 0; i < seconds / DT && g.phase === 'wave'; i++) {
    step(g, DT);
    each?.();
  }
}

const ch = () => MAPS.saltgate.channels[0];
const gates = MAPS.saltgate.locks!.map((l) => ({ ...l, d0: laneDAtX(ch(), l.x0)!, d1: laneDAtX(ch(), l.x1)! }));

describe('Saltgate locks: a lock admits only what its chamber holds', () => {
  it('every formation at every flow: each entry gate shuts on time with no hull in its gateway, and ships keep coming through', () => {
    for (const form of FORMATION_ORDER)
      for (let flow = 0; flow < FLOW_STEPS.length; flow++) {
        const g = canal();
        setFlow(g, flow);
        setFormation(g, form);
        const tag = `${form} flow ${flow}`;
        let longestIn = 0;
        const prev = g.lockState.map((l) => l.phase);
        run(g, 150, () => {
          g.lockState.forEach((st, i) => {
            if (st.phase === 'in') longestIn = Math.max(longestIn, st.t);
            // As it shuts, no hull straddles the gate.
            if (prev[i] === 'in' && st.phase === 'fill') {
              const straddle = g.ships.filter((s) => s.d > gates[i].d0 - LOCK.stand + 1 && s.d < gates[i].d0 + LOCK.gateway);
              expect(straddle.map((s) => s.d.toFixed(0)), `${tag}: lock ${i} shut on a hull`).toEqual([]);
            }
            prev[i] = st.phase;
          });
        });
        // Never held open longer than a hull takes to sail clear of the
        // gateway: the backstop (LOCK.grace) was never needed.
        expect(longestIn, tag).toBeLessThan(LOCK.inTime + 2);
        expect(g.delivered, tag).toBeGreaterThanOrEqual(8);
      }
  });

  it('a full chamber holds the next hull short of the open entry gate, and it goes in on the next turn', () => {
    const g = canal();
    setFlow(g, 4);
    const [lock] = gates;
    const wait = lock.d0 - LOCK.stand;
    let heldOpen = 0;
    let inside = 0;
    run(g, 60, () => {
      if (g.lockState[0].phase !== 'in') return;
      const held = g.ships.filter((s) => Math.abs(s.d - wait) < 1e-6);
      if (held.length) heldOpen++;
      inside = Math.max(inside, g.ships.filter((s) => s.d > wait + 1 && s.d < lock.d1).length);
    });
    expect(heldOpen).toBeGreaterThan(30);
    // Pairs: two files of two (the third place in a file is in the gateway).
    expect(inside).toBe(4);
    const spot = lock.d1 - LOCK.stand;
    expect(spot - SHIP.minGap * 1).toBeGreaterThanOrEqual(lock.d0 + LOCK.gateway);
    expect(spot - SHIP.minGap * 2).toBeLessThan(lock.d0 + LOCK.gateway);
  });

  it('the backstop: a hull stuck in the gateway does not hold the entry open past LOCK.grace; it rides the fill and leaves with the rest', () => {
    const g = canal();
    g.spawnT = 1e9;
    g.ships = [];
    const [lock] = gates;
    // Three in one file: the third (not admitted by the rule, put there by
    // hand) straddles the entry gate behind the two at the exit.
    const spot = lock.d1 - LOCK.stand;
    const put = (id: number, d: number): Ship => {
      const p = laneAt(ch(), d, 0);
      const s: Ship = { id, x: p.x, y: p.y, d, lat: 0, heading: 0, hp: 3, slot: 0, channel: 0, mult: 1 };
      g.ships.push(s);
      return s;
    };
    setFormation(g, 'column');
    put(9001, spot);
    put(9002, spot - SHIP.minGap);
    const stuck = put(9003, spot - 2 * SHIP.minGap);
    expect(stuck.d).toBeLessThan(lock.d0 + LOCK.gateway);
    g.lockState[0] = { phase: 'in', t: 0 };
    run(g, LOCK.inTime + LOCK.grace - 0.5);
    expect(g.lockState[0].phase).toBe('in');
    run(g, 1);
    expect(g.lockState[0].phase).toBe('fill');
    // The three wait out the fill, then all three sail out.
    run(g, lock.wait + LOCK.outTime + 10);
    expect(g.ships.filter((s) => s.d < lock.d1).map((s) => s.id)).toEqual([]);
  });
});

describe('Saltgate frigates: they never pass a lock gate', () => {
  for (const level of [1, 2, 3])
    it(`level ${level}: in from the sides to berths beside the canal, out the same way, never near a gate`, () => {
      const g = canal();
      setFlow(g, 3);
      run(g, 20);
      g.levels = { ...g.levels, frigate: level };
      g.slots = ['frigate'];
      g.pickups.push({ id: 99999, kind: 'weapon', weapon: 'frigate', x: 800, y: 450, age: 0 });
      tap(g, 800, 450, 60);
      expect(g.escorts).toHaveLength(AB.frigate.ships[level - 1]);
      const firstSeen = new Map<number, number>();
      const seen = new Set<number>();
      let near = 0;
      run(g, WEAPON.time + 12, () => {
        for (const e of g.escorts) {
          seen.add(e.id);
          if (!firstSeen.has(e.id)) firstSeen.set(e.id, e.x);
          // The whole hull (78 either way) stays clear of every lock's walls.
          for (const l of MAPS.saltgate.locks!) if (e.x + 78 > l.x0 - 62 && e.x - 78 < l.x1 + 62) near++;
          // Outside the convoy's lane, on the friendly side.
          expect(e.y).toBeGreaterThan(ch().y + ch().halfWidth);
        }
      });
      expect(near).toBe(0);
      // No pop-in: each came in from off the screen, on the side of its berth.
      for (const x of firstSeen.values()) expect(x < -40 || x > 1640).toBe(true);
      expect(seen.size).toBe(AB.frigate.ships[level - 1]);
      expect(g.escorts).toHaveLength(0);
    });

  it('they hold their berths while the weapon lasts, and a new drop calls back ones backing out (none turns round, none new)', () => {
    const g = canal();
    g.levels = { ...g.levels, frigate: 1 };
    g.slots = ['frigate'];
    g.pickups.push({ id: 99998, kind: 'weapon', weapon: 'frigate', x: 800, y: 450, age: 0 });
    tap(g, 800, 450, 60);
    run(g, 4);
    expect(g.escorts.every((e) => Math.hypot(e.x - e.sx, e.y - e.sy) < 1)).toBe(true);
    const ids = g.escorts.map((e) => e.id);
    const facing = new Map(g.escorts.map((e) => [e.id, Math.cos(e.heading)]));
    g.weapon!.t = 0.01;
    run(g, 1);
    expect(g.escorts.every((e) => e.leaving)).toBe(true);
    g.slots = ['frigate'];
    g.pickups.push({ id: 99997, kind: 'weapon', weapon: 'frigate', x: 800, y: 450, age: 0 });
    tap(g, 800, 450, 60);
    expect(g.escorts.map((e) => e.id)).toEqual(ids);
    expect(g.escorts.every((e) => !e.leaving)).toBe(true);
    run(g, 4, () => {
      for (const e of g.escorts) expect(Math.sign(Math.cos(e.heading))).toBe(Math.sign(facing.get(e.id)!));
    });
    expect(g.escorts.every((e) => Math.hypot(e.x - e.sx, e.y - e.sy) < 1)).toBe(true);
  });

  it('they never run over a convoy ship: every level, formation and a high flow (hulls as the renderer draws them)', () => {
    // A hull as a box: centre (x, y), heading h, half length L, half beam B,
    // its middle `o` ahead of the centre. Frigate: drawn -74..78 along,
    // ±12 across; cargo ship: -34..34, ±10 (ui/render.ts).
    type Box = { x: number; y: number; h: number; L: number; B: number; o: number };
    const corners = (b: Box) => {
      const c = Math.cos(b.h), s = Math.sin(b.h);
      return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => ({ x: b.x + c * (b.o + b.L * u) - s * b.B * v, y: b.y + s * (b.o + b.L * u) + c * b.B * v }));
    };
    const overlap = (a: Box, b: Box) =>
      [a.h, a.h + Math.PI / 2, b.h, b.h + Math.PI / 2].every((h) => {
        const pr = (b: Box) => corners(b).map((p) => p.x * Math.cos(h) + p.y * Math.sin(h));
        const A = pr(a), B = pr(b);
        return Math.max(...A) >= Math.min(...B) && Math.max(...B) >= Math.min(...A);
      });
    for (const level of [1, 2, 3])
      for (const form of FORMATION_ORDER) {
        const g = canal();
        setFlow(g, 3);
        setFormation(g, form);
        g.levels = { ...g.levels, frigate: level };
        let hits = 0;
        let calls = 0;
        run(g, 75, () => {
          // Called in again each time the last set has gone.
          if (!g.escorts.length && g.waveT > 3) {
            calls++;
            g.slots = ['frigate'];
            g.pickups.push({ id: 99990 + calls, kind: 'weapon', weapon: 'frigate', x: 800, y: 450, age: 0 });
            tap(g, 800, 450, 60);
          }
          for (const e of g.escorts)
            for (const s of g.ships)
              if (overlap({ x: e.x, y: e.y, h: e.heading, L: 76, B: 12, o: 2 }, { x: s.x, y: s.y, h: s.heading, L: 34, B: 10, o: 0 })) hits++;
        });
        expect(calls, `L${level} ${form}`).toBeGreaterThanOrEqual(3);
        expect(hits, `L${level} ${form}`).toBe(0);
      }
  });

  it('only a map with locks berths its frigates', () => {
    for (const id of Object.keys(MAPS) as MapId[]) expect(!!MAPS[id].berths, id).toBe(!!MAPS[id].locks);
  });
});
