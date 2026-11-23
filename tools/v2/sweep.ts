// V2 balance sweep: plays every map at every bot skill across N seeds and
// prints clear rates and how far each skill gets. Usage:
//   npm run v2:sweep -- [seeds=12]

import { MAP_ORDER } from '../../src/v2/data/maps';
import { runBot, SKILLS } from '../../src/v2/sim/bot';

const seeds = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 12);

console.log(`V2 sweep — ${seeds} seeds per cell\n`);
console.log('map        skill     clear%  avgWave  avgLost  avgScore');
for (const map of MAP_ORDER) {
  for (const [name, skill] of Object.entries(SKILLS)) {
    const runs = Array.from({ length: seeds }, (_, i) => runBot(map, 1000 + i, skill));
    const avg = (f: (r: (typeof runs)[number]) => number) =>
      runs.reduce((s, r) => s + f(r), 0) / runs.length;
    console.log(
      [
        map.padEnd(10),
        name.padEnd(9),
        `${Math.round(avg((r) => (r.won ? 100 : 0)))}%`.padStart(6),
        avg((r) => r.wave).toFixed(1).padStart(8),
        avg((r) => r.lost).toFixed(1).padStart(8),
        Math.round(avg((r) => r.score)).toString().padStart(9),
      ].join(' '),
    );
  }
}
