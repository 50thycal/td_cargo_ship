// One loadout on one map, on more seeds: checks a "trivial" lead from the
// triples stage. npx tsx tools/v3/combo-sweep/check-one.ts <map> <a,b,c> [seeds]
import { playCombo, normalOf } from './play';
import { PLAYER_ARMORY } from '../bot-fit/measure';
import type { MapId } from '../../../src/v3/data/mapTypes';
import type { AbilityId } from '../../../src/v3/data/abilities';
const [map, kit, n = '16'] = process.argv.slice(2);
const runs = [];
for (let i = 0; i < Number(n); i++) runs.push(playCombo({ map: map as MapId, seed: 900 + i, loadout: kit.split(',') as AbilityId[], armory: PLAYER_ARMORY }));
const tot = runs.map((r: any) => r.lost.reduce((a: number, b: number) => a + b, 0));
const normal = runs.map((r: any) => normalOf(r.lost));
console.log(JSON.stringify({ map, kit, seeds: runs.length, lostAvg: tot.reduce((a, b) => a + b, 0) / runs.length, flawless: tot.filter((t) => t === 0).length, perRun: tot, normal: normal.map((x: any) => x && x.won) }));
