// What the shared waves send on a map with no encounter layer (8 seeds),
// by kind and by base (`kind@base`; -1 an aircraft or a foe on its own):
// the yardstick the Delta's encounters were written against.
//   npx vite-node tools/v3/delta/shared.ts -- [--map=delta]
import type { MapId } from '../../../src/v3/data/maps';
import { createGame } from '../../../src/v3/sim/game';

const args = process.argv.slice(2).filter((a) => a !== '--');
const map = (args.find((a) => a.startsWith('--map='))?.slice(6) ?? 'delta') as MapId;
const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
for (let w = 1; w <= 10; w++) {
  const o: Record<string, number> = {};
  const bases: Record<string, number> = {};
  for (const s of seeds) {
    const g = createGame(map, s, w);
    for (const l of g.queue) {
      if (l.at >= 1e8) continue;
      o[l.kind] = (o[l.kind] ?? 0) + 1 / seeds.length;
      bases[`${l.kind}@${l.base}`] = (bases[`${l.kind}@${l.base}`] ?? 0) + 1 / seeds.length;
    }
    for (const r of g.raiderQueue) for (const u of r.units) o[u.kind] = (o[u.kind] ?? 0) + u.size / seeds.length;
  }
  const show = (x: Record<string, number>) =>
    Object.entries(x)
      .sort()
      .map(([k, v]) => `${k} ${v.toFixed(1)}`)
      .join(', ');
  console.log(`w${w} ${show(o)}`);
  console.log(`    ${show(bases)}`);
}
