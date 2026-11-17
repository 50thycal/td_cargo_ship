// Round 13 (approved by the player): frigates never run over convoy ships,
// on any map. docs/design/v3-round13-escorts-munitions-nuke.md.
//
// Every map in MAPS: the Frigate Escort called in 3 s into wave 1 and again
// each time the last set has gone, the convoy sailing with no enemy, for 60 s
// in four set-ups (level 1 Spread at flow 3, level 2 Box at flow 1, level 3
// Pairs at flow 3, level 3 Spread at flow 1: the Spread's outer files and
// Harbor Mouth's opened-out Pairs are where frigates used to sit on hulls).
// The hulls are the boxes the renderer draws: a frigate -74..78 along and
// ±12 across, a cargo ship ±34 by ±10, the supertanker ±70 by ±16. Any
// intersection fails. Frigates also stay on water (the hull's centre and
// both ends) and keep sailing (every set reaches the screen).

import { describe, expect, it } from 'vitest';
import type { FormationId } from '../../src/v3/data/formations';
import { MAPS, type MapId } from '../../src/v3/data/maps';
import { onLand } from '../../src/v3/sim/foes';
import { createGame, setFlow, setFormation, step, tap, type Game } from '../../src/v3/sim/game';

const DT = 1 / 60;
const SECS = 60;

interface Box { x: number; y: number; h: number; L: number; B: number; o: number }
function overlap(a: Box, b: Box): boolean {
  const corners = (k: Box) => {
    const c = Math.cos(k.h), s = Math.sin(k.h);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [k.x + c * (k.o + k.L * u) - s * k.B * v, k.y + s * (k.o + k.L * u) + c * k.B * v]);
  };
  const A = corners(a), B = corners(b);
  return [a.h, a.h + Math.PI / 2, b.h, b.h + Math.PI / 2].every((h) => {
    const pa = A.map(([x, y]) => x * Math.cos(h) + y * Math.sin(h));
    const pb = B.map(([x, y]) => x * Math.cos(h) + y * Math.sin(h));
    return Math.max(...pa) >= Math.min(...pb) && Math.max(...pb) >= Math.min(...pa);
  });
}

const SETUPS: { level: number; flow: number; form: FormationId }[] = [
  { level: 1, flow: 3, form: 'spread' },
  { level: 2, flow: 1, form: 'box' },
  { level: 3, flow: 3, form: 'pairs' },
  { level: 3, flow: 1, form: 'spread' },
];

function run(map: MapId, level: number, flow: number, form: FormationId): string[] {
  const g: Game = createGame(map, 1, 1);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.tempo = { ...g.tempo, lossLimit: 1e9 };
  setFlow(g, flow);
  setFormation(g, form);
  g.levels = { ...g.levels, frigate: level };
  const bad: string[] = [];
  let next = 3;
  let calls = 0;
  let seen = 0;
  for (let i = 0; i < SECS / DT && bad.length < 3; i++) {
    const t = i * DT;
    if (t >= next && !g.escorts.length) {
      g.slots = ['frigate'];
      g.pickups.push({ id: 90000 + i, kind: 'weapon', weapon: 'frigate', x: 800, y: 450, age: 0 });
      tap(g, 800, 450, 60);
      calls++;
      next = t + 1;
    }
    for (const s of g.ships) s.hp = 999;
    g.carrierHp = 99;
    step(g, DT);
    if (g.escorts.some((e) => e.x > 0 && e.x < 1600 && e.y > 0 && e.y < 900)) seen = calls;
    for (const e of g.escorts) {
      const f = { x: e.x, y: e.y, h: e.heading, L: 76, B: 12, o: 2 };
      const ends = [-74, 0, 78].map((u) => [e.x + Math.cos(e.heading) * u, e.y + Math.sin(e.heading) * u]);
      if (ends.some(([x, y]) => x > 0 && x < 1600 && y > 0 && y < 900 && onLand(g, x, y))) bad.push(`t=${t.toFixed(1)} frigate on land at ${e.x.toFixed(0)},${e.y.toFixed(0)}`);
      for (const s of g.ships) {
        if (!overlap(f, { x: s.x, y: s.y, h: s.heading, L: s.vip ? 70 : 34, B: s.vip ? 16 : 10, o: 0 })) continue;
        bad.push(`t=${t.toFixed(1)} frigate ${e.x.toFixed(0)},${e.y.toFixed(0)} (${e.leaving ? 'leaving' : Math.abs(e.d - e.sd) < 1 ? 'on station' : 'arriving'}) on ship ${s.x.toFixed(0)},${s.y.toFixed(0)}`);
      }
    }
  }
  if (calls && seen < calls - 1) bad.push(`only ${seen} of ${calls} sets of frigates came on screen`);
  return bad.map((b) => `L${level} flow ${flow} ${form}: ${b}`);
}

describe('frigates never run over convoy ships (every map)', () => {
  for (const map of Object.keys(MAPS) as MapId[]) {
    it(map, () => {
      const bad = SETUPS.flatMap(({ level, flow, form }) => run(map, level, flow, form));
      expect(bad).toEqual([]);
    });
  }
});
