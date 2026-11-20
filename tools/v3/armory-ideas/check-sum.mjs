// Folds check.ts's run lines into tools/v3/armory-ideas/check-results.json:
// per persona, mode and config, ships lost a run (all 13 waves), saved
// against "none" on the same persona, mode, map and seed (± one standard
// error, paired: a config is compared with "none" on its own seeds only),
// per map, and the share won under the normal loss limit.
//   node tools/v3/armory-ideas/check-sum.mjs <runs.jsonl>... > check-results.json
import { readFileSync } from 'node:fs';
const LIMIT = 6, BOSS = 11;
const won = (lost) => { let c = 0; for (let w = 1; w <= 13; w++) { if (w === BOSS) c = 0; c += lost[w - 1]; if (c >= LIMIT) return false; } return true; };
// Runs are deterministic: one played by two sets ("none" is in several)
// counts once.
const seen = new Set();
const runs = process.argv
  .slice(2)
  .flatMap((f) => readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)))
  .filter((r) => {
    const k = `${r.persona}/${r.mode}/${r.cfg}/${r.map}/${r.seed}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const tot = (r) => r.lost.reduce((a, b) => a + b, 0);
const groups = {};
for (const r of runs) ((groups[`${r.persona}/${r.mode}`] ??= {})[r.cfg] ??= []).push(r);
const out = {};
for (const [gk, by] of Object.entries(groups)) {
  if (!by.none) continue;
  const maps = [...new Set(by.none.map((r) => r.map))];
  const base = new Map(by.none.map((r) => [`${r.map}:${r.seed}`, tot(r)]));
  const g = (out[gk] = { maps, configs: {} });
  for (const [k, rs] of Object.entries(by)) {
    const lostMap = Object.fromEntries(maps.map((m) => [m, mean(rs.filter((r) => r.map === m).map(tot))]));
    const lost = mean(maps.map((m) => lostMap[m]));
    const d = rs.map((r) => base.get(`${r.map}:${r.seed}`) - tot(r));
    const md = mean(d);
    const se = d.length > 1 ? Math.sqrt(d.reduce((s, x) => s + (x - md) ** 2, 0) / (d.length - 1) / d.length) : 0;
    g.configs[k] = {
      seeds: rs.length / maps.length,
      lost: r1(lost),
      saved: r1(mean(maps.map((m) => mean(rs.filter((r) => r.map === m).map((r) => base.get(`${r.map}:${r.seed}`) - tot(r)))))),
      se: r1(se),
      won: Math.round((100 * rs.filter((r) => won(r.lost)).length) / rs.length),
      perMap: Object.fromEntries(maps.map((m) => [m, r1(mean(rs.filter((r) => r.map === m).map((r) => base.get(`${r.map}:${r.seed}`) - tot(r))))])),
      lostPerMap: Object.fromEntries(maps.map((m) => [m, r2(lostMap[m])])),
    };
  }
}
console.log(JSON.stringify(out, null, 1));
