// Collects a balance sweep (phase1-sweep.mts output, one file per job) into
// lockin-results.json for the lock-in review page. Every row was measured the
// same way: the "average" bot, every map from wave 1, 5 seeds (100 runs), the
// row's weapons held at a fixed level, Resupply at every draft, Free Play's
// drops (`campaign`: the campaign's drops, nothing held).
// Usage: node tools/v3/weapon-ideas/lockin-sweep.mjs <sweep.txt>...
import { readFileSync, writeFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) throw new Error('usage: node lockin-sweep.mjs <sweep.txt>...');
const rows = {};
for (const f of files) {
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^(\S+)\s+L(\d)\s+(\S+)\s+clear\s+(\d+)%\s+lost\s+([\d.]+)/);
    if (!m) continue;
    const [, row, lv, skill, clear, lost] = m;
    rows[row] ??= {};
    rows[row][lv === '1' ? 'l1' : 'max'] = { clear: Number(clear), lost: Number(lost), skill };
  }
}
const out = new URL('lockin-results.json', import.meta.url);
writeFileSync(out, JSON.stringify({ measured: new Date().toISOString().slice(0, 10), runs: 100, bot: 'average', drops: 'Free Play (the plan’s): ammo, repair, the Nuke', rows }, null, 1) + '\n');
console.log(`Wrote ${Object.keys(rows).length} rows to ${out.pathname}`);
