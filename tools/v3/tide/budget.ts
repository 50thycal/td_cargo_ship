// The Tide's wave budgets as planned (rule w-budget): each wave's launches
// (a filler drone FILLER_WEIGHT of one, a launcher's load counted) on the
// map card's production setup against the same wave with no encounters,
// the mean over seeds.
//   npx vite-node tools/v3/tide/budget.ts -- [--seeds=8] [--map=tide]
import { ENCOUNTER_REV, FILLER_WEIGHT } from '../../../src/v3/data/encounters';
import type { MapId } from '../../../src/v3/data/maps';
import { applyEncounters, createGame, type Game } from '../../../src/v3/sim/game';
import { mapProduction } from '../../../src/v3/data/lab';
import { CONVOY_REV } from '../../../src/v3/data/convoy';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const map = (opt('map') ?? 'tide') as MapId;
const seeds = Number(opt('seeds') ?? 8);
void mapProduction;
void CONVOY_REV;
const planned = (g: Game) =>
  g.queue.filter((l) => l.at < 1e8).reduce((a, l) => a + (l.filler ? FILLER_WEIGHT : 1), 0) + g.raiderQueue.reduce((a, r) => a + r.units.reduce((b, u) => b + u.size, 0), 0);
const out: string[] = [];
for (let w = 1; w <= 10; w++) {
  let on = 0;
  let off = 0;
  for (let s = 1; s <= seeds; s++) {
    const a = createGame(map, s, w);
    applyEncounters(a, { rev: ENCOUNTER_REV, version: 'v1' });
    on += planned(a);
    const b = createGame(map, s, w);
    applyEncounters(b, { rev: ENCOUNTER_REV, version: 'v1', only: [] });
    off += planned(b);
  }
  out.push(`w${w} ×${(on / off).toFixed(2)} (${(on / seeds).toFixed(1)} / ${(off / seeds).toFixed(1)})`);
}
console.log(out.join('  '));
