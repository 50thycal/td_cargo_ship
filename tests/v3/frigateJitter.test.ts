// Log v29 (the Kesh playtest, 2026-11-18, pause note at step 12067:
// "Frigates are a little jittery on the turn"). Round the Kesh Hook's tight
// bend a frigate's bow flicked about 2.5° left and right step after step:
// the lane is a polyline (its spot jumped at each corner when offset 100+ px
// across it), the track it steers for is sampled every few px, and it
// stepped out for a hull and back in on alternate steps. Measured here, with
// the convoy sailing and no enemy, as in frigateOverlap.test.ts:
// - flips: a turn one way (over 0.4° a step) right after a turn the other
//   way, a minute of a frigate on screen. Before: 27 / 39 / 71 a minute in
//   the three set-ups; after: about 1 / 1 / 3.
// - wobble: how much the turn changes step to step (°/s). Before 2.7 / 3.9 /
//   7.1; after 0.3 / 0.4 / 0.7.

import { describe, expect, it } from 'vitest';
import type { FormationId } from '../../src/v3/data/formations';
import type { MapId } from '../../src/v3/data/maps';
import { angleDiff, createGame, setFlow, setFormation, step, tap, type Game } from '../../src/v3/sim/game';

const DT = 1 / 60;
const FLIP = 0.4 * (Math.PI / 180);

function jitter(map: MapId, level: number, flow: number, form: FormationId, secs = 60): { flipsPerMin: number; wobble: number; minutes: number } {
  const g: Game = createGame(map, 1, 1);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.tempo = { ...g.tempo, lossLimit: 1e9 };
  setFlow(g, flow);
  setFormation(g, form);
  g.levels = { ...g.levels, frigate: level };
  let next = 3;
  const last = new Map<number, { h: number; turn: number; raw: number }>();
  let flips = 0;
  let wob = 0;
  let steps = 0;
  for (let i = 0; i < secs / DT; i++) {
    const t = i * DT;
    if (t >= next && !g.escorts.length) {
      g.slots = ['frigate'];
      g.pickups.push({ id: 90000 + i, kind: 'weapon', weapon: 'frigate', x: 800, y: 450, age: 0 });
      tap(g, 800, 450, 60);
      next = t + 1;
    }
    for (const s of g.ships) s.hp = 999;
    g.carrierHp = 99;
    step(g, DT);
    for (const e of g.escorts) {
      if (e.x < 0 || e.x > 1600 || e.y < 0 || e.y > 900) continue;
      const p = last.get(e.id);
      if (!p) {
        last.set(e.id, { h: e.heading, turn: 0, raw: 0 });
        continue;
      }
      const dh = angleDiff(e.heading, p.h);
      if (Math.abs(dh) > FLIP && Math.abs(p.turn) > FLIP && Math.sign(dh) !== Math.sign(p.turn)) flips++;
      wob += Math.abs(dh - p.raw);
      steps++;
      last.set(e.id, { h: e.heading, turn: Math.abs(dh) > FLIP ? dh : p.turn, raw: dh });
    }
  }
  const minutes = (steps * DT) / 60;
  return { flipsPerMin: flips / Math.max(minutes, 1e-9), wobble: ((wob / Math.max(1, steps)) * 60 * 180) / Math.PI, minutes };
}

describe('frigates round the Kesh Hook sail smoothly (log v29)', () => {
  const setups: [number, number, FormationId][] = [
    [3, 2, 'pairs'],
    [1, 3, 'spread'],
    [2, 1, 'box'],
  ];
  for (const [level, flow, form] of setups) {
    it(`level ${level}, flow ${flow}, ${form}: no heading flicker`, () => {
      const r = jitter('kesh', level, flow, form);
      expect(r.minutes).toBeGreaterThan(0.5);
      expect(r.flipsPerMin).toBeLessThan(6);
      expect(r.wobble).toBeLessThan(1.5);
    });
  }
});
