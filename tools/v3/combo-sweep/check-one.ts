// One loadout on one map, on more seeds: checks a "trivial" lead from the
// triples stage, or a weapon's verdict (the boosts round: Overdrive by the
// bot before and after).
//   npx tsx tools/v3/combo-sweep/check-one.ts <map> <a,b,c> [seeds=16] [persona=you] [first seed=900]
// Prints ships lost a run over all 13 waves, the share won under the
// normal loss limit, and ships lost in waves 1-10 and a boss round.
import { playCombo, normalOf } from './play';
import { PLAYER_ARMORY } from '../bot-fit/measure';
import type { MapId } from '../../../src/v3/data/mapTypes';
import type { AbilityId } from '../../../src/v3/data/abilities';
const [map, kit, n = '16', persona = 'you', from = '900'] = process.argv.slice(2).filter((a) => a !== '--');
const runs = [];
for (let i = 0; i < Number(n); i++) runs.push(playCombo({ map: map as MapId, seed: Number(from) + i, loadout: kit === 'plain' ? [] : (kit.split(',') as AbilityId[]), armory: PLAYER_ARMORY, persona }));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const tot = runs.map((r) => sum(r.lost));
const normal = runs.map((r) => normalOf(r.lost));
const mean = (xs: number[]) => sum(xs) / xs.length;
const sd = Math.sqrt(mean(tot.map((t) => (t - mean(tot)) ** 2)));
console.log(
  JSON.stringify({
    map,
    kit,
    persona,
    seeds: runs.length,
    lostAvg: Math.round(mean(tot) * 100) / 100,
    se: Math.round((sd / Math.sqrt(tot.length)) * 100) / 100,
    won: Math.round(mean(normal.map((x) => (x.won ? 1 : 0))) * 100) / 100,
    lost10: Math.round(mean(runs.map((r) => sum(r.lost.slice(0, 10)))) * 100) / 100,
    boss: Math.round(mean(runs.map((r) => sum(r.lost.slice(10)) / 3)) * 100) / 100,
    flawless: tot.filter((t) => t === 0).length,
    perRun: tot,
  }),
);
