// Where each map's frigates take station (level 3, Pairs, a frigate drop 3 s
// into wave 1), and how long each takes to get there.
// Usage: npx vite-node tools/v3/round13/stations.ts [-- maps=kesh,needle]
declare const process: { argv: string[] };
import { MAP_ORDER, type MapId } from '../../../src/v3/data/maps';
import { createGame, step, tap, type Game } from '../../../src/v3/sim/game';

const DT = 1 / 60;
const arg = (k: string) => process.argv.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
const maps = (arg('maps')?.split(',') ?? MAP_ORDER) as MapId[];
for (const map of maps) {
  const g: Game = createGame(map, 1, 1);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.levels = { ...g.levels, frigate: 3 };
  const arrive = new Map<number, number>();
  for (let i = 0; i < 20 / DT; i++) {
    if (i === Math.round(3 / DT)) {
      g.slots = ['frigate'];
      g.pickups.push({ id: 90000, kind: 'weapon', weapon: 'frigate', x: 800, y: 450, age: 0 });
      tap(g, 800, 450, 60);
    }
    step(g, DT);
    for (const e of g.escorts) if (!arrive.has(e.id) && Math.abs(e.d - e.sd) < 1) arrive.set(e.id, i * DT - 3);
  }
  const out = g.escorts.map((e) => `(${e.sx.toFixed(0)},${e.sy.toFixed(0)}) lane ${e.lane} lat ${e.slat.toFixed(0)} in ${arrive.has(e.id) ? arrive.get(e.id)!.toFixed(1) + 's' : 'never'}`);
  console.log(`${map}: ${out.join(' | ')}`);
}
