// Folds new-upgrades.ts's run lines into tools/v3/armory-ideas/new-results.json:
// per base ("alone", "player") and draft mode ("kit", "self"), each config's
// ships lost a run (all 13 waves), ships saved against "none" on the same
// base, mode, map and seed (± one standard error, paired), per map; the share
// won under the normal loss limit (lifeboats' half losses counted); the
// Scrap a run banks (with Salvage Crews 5 for "salvage"); the lifeboats used
// and the loss tally they saved (half a ship each); the re-rolls used.
//   node tools/v3/armory-ideas/new-sum.mjs <runs.jsonl>... > new-results.json
import { readFileSync } from 'node:fs';
const seen = new Set();
const runs = process.argv
  .slice(2)
  .flatMap((f) => readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)))
  .filter((r) => {
    const k = `${r.base}/${r.mode}/${r.cfg}/${r.map}/${r.seed}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const r1 = (x) => Math.round(x * 10) / 10;
const tot = (r) => r.lost.reduce((a, b) => a + b, 0);
const se = (d) => {
  if (d.length < 2) return 0;
  const m = mean(d);
  return Math.sqrt(d.reduce((s, x) => s + (x - m) ** 2, 0) / (d.length - 1) / d.length);
};
const groups = {};
for (const r of runs) ((groups[`${r.base}/${r.mode}`] ??= {})[r.cfg] ??= []).push(r);
const out = {};
for (const [gk, by] of Object.entries(groups)) {
  if (!by.none) continue;
  const maps = [...new Set(by.none.map((r) => r.map))];
  const base = new Map(by.none.map((r) => [`${r.map}:${r.seed}`, r]));
  const g = (out[gk] = { maps, configs: {} });
  for (const [k, rs] of Object.entries(by)) {
    const d = rs.map((r) => tot(base.get(`${r.map}:${r.seed}`)) - tot(r));
    const perMap = (f) => Object.fromEntries(maps.map((m) => [m, r1(mean(rs.filter((r) => r.map === m).map(f)))]));
    const scrap = rs.map((r) => (k === 'salvage' ? r.normal.scrap5 : r.normal.scrap));
    const scrapBase = rs.map((r) => base.get(`${r.map}:${r.seed}`).normal.scrap);
    // The loss tally the lifeboats saved, against "none" (the ships sunk
    // saved, plus half a ship for each boat).
    const tally = rs.map((r, i) => d[i] + r.boats.length * 0.5);
    g.configs[k] = {
      seeds: rs.length / maps.length,
      lost: r1(mean(rs.map(tot))),
      saved: r1(mean(d)),
      se: r1(se(d)),
      won: Math.round((100 * rs.filter((r) => r.normal.won).length) / rs.length),
      endWave: r1(mean(rs.map((r) => r.normal.endWave))),
      scrap: Math.round(mean(scrap)),
      scrapGain: Math.round(mean(scrap) - mean(scrapBase)),
      ...(rs.some((r) => r.boats.length) ? { boats: r1(mean(rs.map((r) => r.boats.length))), tallySaved: r1(mean(tally)), tallySe: r1(se(tally)) } : {}),
      ...(rs.some((r) => r.rerolls) ? { rerolls: r1(mean(rs.map((r) => r.rerolls))) } : {}),
      perMap: perMap((r) => tot(base.get(`${r.map}:${r.seed}`)) - tot(r)),
    };
  }
}
console.log(JSON.stringify(out, null, 1));
