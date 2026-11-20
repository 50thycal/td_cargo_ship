// Folds lift.ts's run lines into tools/v3/armory-ideas/lift-results.json:
// per config, ships lost a run (all 13 waves), saved against "none" on the
// same seeds, per map, and the share won under the normal loss limit.
//   node tools/v3/armory-ideas/summarize.mjs <runs.jsonl>... > lift-results.json
import { readFileSync } from 'node:fs';
const LIMIT = 6, BOSS = 11;
const won = (lost) => { let c = 0; for (let w = 1; w <= 13; w++) { if (w === BOSS) c = 0; c += lost[w - 1]; if (c >= LIMIT) return false; } return true; };
const runs = process.argv.slice(2).flatMap((f) => readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l)));
const by = {};
for (const r of runs) ((by[r.cfg] ??= {})[r.map] ??= []).push(r);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const r1 = (x) => Math.round(x * 10) / 10;
const tot = (r) => r.lost.reduce((a, b) => a + b, 0);
const maps = Object.keys(by.none);
const noneMap = Object.fromEntries(maps.map((m) => [m, mean(by.none[m].map(tot))]));
const noneAll = mean(maps.map((m) => noneMap[m]));
const out = { seeds: by.none[maps[0]].length, maps, configs: {} };
for (const [k, mm] of Object.entries(by)) {
  const perMap = Object.fromEntries(maps.map((m) => [m, r1(noneMap[m] - mean(mm[m].map(tot)))]));
  const lost = mean(maps.map((m) => mean(mm[m].map(tot))));
  const all = maps.flatMap((m) => mm[m]);
  // Paired with "none" on the same map and seed: the saved figure's standard error.
  const base = new Map(runs.filter((r) => r.cfg === 'none').map((r) => [`${r.map}:${r.seed}`, tot(r)]));
  const d = all.map((r) => base.get(`${r.map}:${r.seed}`) - tot(r));
  const md = mean(d);
  const se = Math.sqrt(d.reduce((s, x) => s + (x - md) ** 2, 0) / (d.length - 1) / d.length);
  out.configs[k] = { lost: r1(lost), saved: r1(noneAll - lost), se: r1(se), won: Math.round((100 * all.filter((r) => won(r.lost)).length) / all.length), perMap };
}
console.log(JSON.stringify(out, null, 1));
