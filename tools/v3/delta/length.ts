// How long each map's lanes are (px along the path), to hold the Delta to
// "about three times the usual length" (log v68).
//   npx vite-node tools/v3/delta/length.ts
import { MAPS } from '../../../src/v3/data/maps';
import { laneLength } from '../../../src/v3/sim/lanes';

const rows = Object.values(MAPS).map((m) => ({ id: m.id, lanes: m.channels.map((c) => Math.round(laneLength(c))) }));
const typical = rows.filter((r) => r.id !== 'delta').flatMap((r) => r.lanes);
const mean = typical.reduce((a, b) => a + b, 0) / typical.length;
for (const r of rows) console.log(`${r.id.padEnd(12)} ${r.lanes.join(', ')}`);
console.log(`mean lane on the other maps ${Math.round(mean)} px; the Delta's ${rows.find((r) => r.id === 'delta')!.lanes[0]} px = ${(rows.find((r) => r.id === 'delta')!.lanes[0] / mean).toFixed(2)}x`);
