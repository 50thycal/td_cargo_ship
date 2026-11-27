// Where the Coves' water is: an ASCII chart of land (#) and water (.) round
// each cove, so a mouth waypoint can be placed on open water (log v72).
//   npx vite-node tools/v3/coves/probe-water.ts
import { createGame } from '../../../src/v3/sim/game';
import { onLand } from '../../../src/v3/sim/foes';

const g = createGame('coves', 1, 1);
for (const b of g.map.bases.filter((x) => x.cove)) {
  console.log(`cove at ${b.x},${b.y}`);
  for (let y = b.y - 110; y <= b.y + 110; y += 10) {
    let row = `${String(y).padStart(4)} `;
    for (let x = b.x - 120; x <= b.x + 120; x += 6) row += x === b.x && y === b.y ? 'O' : onLand(g, x, y) ? '#' : '.';
    console.log(row);
  }
}
