// Do frigates run over convoy ships? (docs/design/v3-saltgate-locks.md, "Do
// escorts run over convoy ships?") Every map x frigate level x flow (1, 3) x
// formation: 90 s with the convoy sailing and no enemy, frigates called in 3 s
// into the wave and again each time the last set has gone. Hulls are the
// boxes the renderer draws (ui/render.ts); an overlap is any intersection
// (separating axes).
//
// Usage: npx vite-node tools/v3/saltgate/escort-overlap.ts [-- maps=strait,saltgate secs=90]
declare const process: { argv: string[] };
import { MAP_ORDER, type MapId } from '../../../src/v3/data/maps';
import type { FormationId } from '../../../src/v3/data/formations';
import { createGame, setFlow, setFormation, step, tap, type Game } from '../../../src/v3/sim/game';

const DT = 1 / 60;
const arg = (k: string) => process.argv.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
const maps = (arg('maps')?.split(',') ?? MAP_ORDER) as MapId[];
const secs = Number(arg('secs') ?? 90);

/** Centre, heading, half length, half beam, and how far the box's middle
 *  sits ahead of the centre. Frigate: drawn -74..78 along, ±12 across;
 *  cargo ship: -34..34, ±10. */
interface Box { x: number; y: number; h: number; L: number; B: number; o: number }
const corners = (b: Box) => {
  const c = Math.cos(b.h), s = Math.sin(b.h);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => ({ x: b.x + c * (b.o + b.L * u) - s * b.B * v, y: b.y + s * (b.o + b.L * u) + c * b.B * v }));
};
function overlap(a: Box, b: Box): boolean {
  return [a.h, a.h + Math.PI / 2, b.h, b.h + Math.PI / 2].every((h) => {
    const pr = (k: Box) => corners(k).map((p) => p.x * Math.cos(h) + p.y * Math.sin(h));
    const A = pr(a), B = pr(b);
    return Math.max(...A) >= Math.min(...B) && Math.max(...B) >= Math.min(...A);
  });
}

console.log('| Map | Frigate-s on screen | Overlap s | Overlap share | Events | Runs hit | Closest (px) | Events: arriving / station / leaving |');
console.log('|---|---|---|---|---|---|---|---|');
for (const map of maps) {
  let frigS = 0, overS = 0, events = 0, closest = Infinity, runs = 0, hitRuns = 0;
  const phase = { arriving: 0, station: 0, leaving: 0 };
  for (const level of [1, 2, 3])
    for (const flow of [1, 3])
      for (const form of ['column', 'pairs', 'spread', 'box'] as FormationId[]) {
        const g: Game = createGame(map, 1, 1);
        g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
        g.raiderQueue = [];
        g.tempo = { ...g.tempo, lossLimit: 1e9 };
        setFlow(g, flow);
        setFormation(g, form);
        g.levels = { ...g.levels, frigate: level };
        let live = new Set<string>();
        let hit = false;
        let next = 3;
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
          g.threats = [];
          step(g, DT);
          const now = new Set<string>();
          for (const e of g.escorts) {
            if (e.x < -60 || e.x > 1660 || e.y < -60 || e.y > 960) continue;
            frigS += DT;
            let any = false;
            for (const s of g.ships) {
              if (s.x < -40 || s.x > 1640) continue;
              closest = Math.min(closest, Math.hypot(s.x - e.x, s.y - e.y));
              if (!overlap({ x: e.x, y: e.y, h: e.heading, L: 76, B: 12, o: 2 }, { x: s.x, y: s.y, h: s.heading, L: 34, B: 10, o: 0 })) continue;
              any = true;
              const k = `${e.id}:${s.id}`;
              now.add(k);
              if (!live.has(k)) {
                events++;
                phase[e.leaving ? 'leaving' : Math.abs(e.d - e.sd) < 1 ? 'station' : 'arriving']++;
              }
            }
            if (any) {
              overS += DT;
              hit = true;
            }
          }
          live = now;
        }
        runs++;
        if (hit) hitRuns++;
      }
  console.log(`| ${map} | ${frigS.toFixed(0)} | ${overS.toFixed(0)} | ${((100 * overS) / Math.max(frigS, 1e-9)).toFixed(1)}% | ${events} | ${hitRuns}/${runs} | ${closest.toFixed(0)} | ${events ? `${phase.arriving} / ${phase.station} / ${phase.leaving}` : '–'} |`);
}
