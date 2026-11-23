// Saltgate Canal: each wave's planned launches under the encounters against
// the shared wave on the same dice (the test's rule w-budget yardstick):
//   npx vite-node tools/v3/saltgate/budget.ts
import { applyEncounters, createGame, type Game } from '../../../src/v3/sim/game';

const planned = (g: Game) => g.queue.filter((l) => l.at < 1e8).length + g.raiderQueue.reduce((a, r) => a + r.units.reduce((b, u) => b + u.size, 0), 0);
for (let w = 1; w <= 10; w++) {
  const row: string[] = [];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const on = createGame('saltgate', seed, w);
    applyEncounters(on, { rev: 4, version: 'v1' });
    const shared = createGame('saltgate', seed, w);
    applyEncounters(shared, { rev: 4, version: 'v1', only: [] });
    row.push(`${planned(on)}/${planned(shared)}=${(planned(on) / planned(shared)).toFixed(2)}`);
  }
  console.log(`w${w}`, row.join(' '));
}
