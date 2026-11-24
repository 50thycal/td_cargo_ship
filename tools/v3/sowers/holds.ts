// How often a ship stops by itself for a mine (log v68, sim/game.ts
// minePace): per wave, steps with a ship held, and mines that sank a ship.
//   npx vite-node tools/v3/sowers/holds.ts -- [--seed=900] [--waves=10]
import { CONVOY_REV } from '../../../src/v3/data/convoy';
import { ENCOUNTER_REV } from '../../../src/v3/data/encounters';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string, d: number) => Number(args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d);
const seed = opt('seed', 900);
const waves = opt('waves', 10);
const run = new BotRun('sowers', seed, { persona: PERSONAS.you, armory: { reload: 5, repair: 4, stockpile: 5 }, encounters: { rev: ENCOUNTER_REV, version: 'v1' }, convoy: { policy: 'tactical', obligation: 'natural', rev: CONVOY_REV } });
const g = run.game;
const held = new Map<number, number>();
const surfaced = new Map<number, number>();
let lastWave = 0;
while (!run.done && g.wave <= waves) {
  run.advance(1);
  if (g.phase !== 'wave') continue;
  if (g.ships.some((s) => s.mineHold)) held.set(g.wave, (held.get(g.wave) ?? 0) + 1);
  for (const th of g.threats) if (th.kind === 'mine' && th.surfacedT !== undefined && !surfaced.has(th.id)) surfaced.set(th.id, g.wave);
  lastWave = g.wave;
}
const perWave = (m: Map<number, number>) => Array.from({ length: lastWave }, (_, k) => m.get(k + 1) ?? 0).join(' ');
const counts = new Map<number, number>();
for (const w of surfaced.values()) counts.set(w, (counts.get(w) ?? 0) + 1);
console.log(`seed ${seed}: steps with a ship held, by wave: ${perWave(held)}`);
console.log(`mines that surfaced, by wave: ${perWave(counts)}`);
