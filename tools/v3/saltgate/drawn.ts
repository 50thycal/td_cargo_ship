// Saltgate Canal: the new enemies the planner draws for each wave of a run
// (the draw only: what the signature and the swap then make of them is the
// planner's), a few seeds:
//   npx vite-node tools/v3/saltgate/drawn.ts
import { createGame } from '../../../src/v3/sim/game';
import { foeCount, planFoes } from '../../../src/v3/sim/foes';

for (const seed of [900, 901, 902, 903, 904, 905]) {
  const g = createGame('saltgate', seed, 1);
  const row: string[] = [];
  for (let w = 2; w <= 10; w++) row.push(`${w}:${planFoes(g, foeCount(w)).join(',')}`);
  console.log(seed, row.join(' '));
}
