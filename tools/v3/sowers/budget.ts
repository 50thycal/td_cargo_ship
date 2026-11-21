// A rebuilt map's waves under its encounters against the shared wave on the
// same dice (the encounter test's rule w-budget yardstick), by kind; as
// tools/v3/battery/budget.ts, with each filler drone (log v47) weighed as
// FILLER_WEIGHT of a launch, as the encounter test weighs it:
//   npx vite-node tools/v3/sowers/budget.ts -- [--map=sowers]
import { FILLER_WEIGHT } from '../../../src/v3/data/encounters';
import type { MapId } from '../../../src/v3/data/maps';
import { applyEncounters, createGame, type Game } from '../../../src/v3/sim/game';

const args = process.argv.slice(2).filter((a) => a !== '--');
const map = (args.find((a) => a.startsWith('--map='))?.slice(6) ?? 'sowers') as MapId;
const planned = (g: Game) => g.queue.filter((l) => l.at < 1e8).reduce((a, l) => a + (l.filler ? FILLER_WEIGHT : 1), 0) + g.raiderQueue.reduce((a, r) => a + r.units.reduce((b, u) => b + u.size, 0), 0);
const kinds = (g: Game) => {
  const o: Record<string, number> = {};
  for (const l of g.queue) if (l.at < 1e8) o[l.kind] = (o[l.kind] ?? 0) + 1;
  for (const r of g.raiderQueue) for (const u of r.units) o[u.kind] = (o[u.kind] ?? 0) + u.size;
  return o;
};
const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
for (let w = 1; w <= 10; w++) {
  let on = 0;
  let off = 0;
  let none = 0;
  const kOn: Record<string, number> = {};
  const kOff: Record<string, number> = {};
  for (const seed of seeds) {
    const a = createGame(map, seed, w);
    applyEncounters(a, { rev: 4, version: 'v1' });
    const b = createGame(map, seed, w);
    applyEncounters(b, { rev: 4, version: 'v1', only: [] });
    on += planned(a);
    none += planned(createGame(map, seed, w));
    off += planned(b);
    for (const [k, v] of Object.entries(kinds(a))) kOn[k] = (kOn[k] ?? 0) + v / seeds.length;
    for (const [k, v] of Object.entries(kinds(b))) kOff[k] = (kOff[k] ?? 0) + v / seeds.length;
  }
  const show = (o: Record<string, number>) =>
    Object.entries(o)
      .sort((x, y) => y[1] - x[1])
      .map(([k, v]) => `${k} ${v.toFixed(1)}`)
      .join(', ');
  // Against the shared wave on the same dice (its version's scale), and
  // against the wave with no layer at all (the bot report's w-budget).
  console.log(`w${w} ×${(on / off).toFixed(2)} of the shared wave, ×${(on / none).toFixed(2)} of no layer (${(on / seeds.length).toFixed(1)} / ${(off / seeds.length).toFixed(1)} / ${(none / seeds.length).toFixed(1)})`);
  console.log(`   on:  ${show(kOn)}`);
  console.log(`   off: ${show(kOff)}`);
}
