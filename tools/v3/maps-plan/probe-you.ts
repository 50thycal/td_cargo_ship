// Probe the persona on one map: wins, what sank ships, tanker losses.
import { playMimic } from '../../../src/v3/sim/mimic';
import type { ArmoryId, ArmoryLevels } from '../../../src/v3/data/armory';
import type { MapId } from '../../../src/v3/data/maps';
const map = (process.argv[2] ?? 'behemoth') as MapId;
const armory: ArmoryLevels = Object.fromEntries((process.argv[3] ?? '').split(',').filter(Boolean).map((p) => [p.split(':')[0] as ArmoryId, Number(p.split(':')[1])]));
const sunk: Record<string, number> = {};
let won = 0, waves = 0, tankersLost = 0;
const N = Number(process.argv[4] ?? 8);
for (let s = 0; s < N; s++) {
  const g = playMimic(map, 7000 + s, { armory }).game;
  won += g.cleared ? 1 : 0; waves += g.wave;
  for (const [k, v] of Object.entries(g.sunkBy)) if (v) sunk[k] = (sunk[k] ?? 0) + v;
  tankersLost += Math.max(0, g.lost - Object.values(g.sunkBy).reduce((a, b) => a + b, 0)) / 2;
}
console.log(map, `won ${won}/${N}`, `wave ${(waves / N).toFixed(1)}`, 'sunkBy', sunk, 'tankers lost ~', tankersLost);
