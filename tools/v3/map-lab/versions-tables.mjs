// Prints round 12's tables (docs/design/v3-round12-encounter-versions.md)
// from the versions results file, so the doc's numbers are never retyped.
//
//   node tools/v3/map-lab/versions-tables.mjs [tools/v3/map-lab/results/round12-versions.json]

import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'tools/v3/map-lab/results/round12-versions.json';
const data = JSON.parse(readFileSync(file, 'utf8'));
const NAME = { strait: 'The Strait', gauntlet: 'The Gauntlet', harbor: 'Harbor Mouth' };
const f = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? '–' : Number(v).toFixed(d));

console.log(`## The bots' table (${data.seeds.length} seeds a bot)\n`);
console.log('| Map | Version | Bot | Won | Wave reached | Ships lost (1–10) | First loss | Hits from encounters / all (1–10) | Most on screen | Carrier hull lost |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const r of data.rows)
  console.log(`| ${NAME[r.map]} | ${r.version} | ${r.persona} | ${Math.round(r.won * 100)}% | ${f(r.endWave)} | ${f(r.lost10)} | ${f(r.firstLoss)} | ${f(r.hitsEnc, 0)} / ${f(r.hits10, 0)} (${Math.round(r.encShare * 100)}%) | ${f(r.maxOn, 0)} | ${f(r.carrierLost)} |`);

console.log('\n## The difficulty curve (every seed plays waves 1–10: no loss limit)\n');
console.log('| Map | Version | Bot | Ships lost on waves 1 to 10 | Biggest step up |');
console.log('|---|---|---|---|---|');
for (const c of data.curves ?? []) console.log(`| ${NAME[c.map]} | ${c.version} | ${c.persona} | ${c.lost.map((v) => f(v, 1)).join(' · ')} | +${f(c.step.up, 1)} on wave ${c.step.wave} |`);

// Round 12's fixes: ships lost in each boss round, with the run kept going
// (every seed plays all three), and Harbor Mouth's wave 8 by kit.
if ((data.curves ?? []).some((c) => c.boss)) {
  console.log('\n## Boss rounds (every seed plays all three: no loss limit)\n');
  console.log('| Map | Version | Bot | Ships lost in boss rounds 1 · 2 · 3 | All three |');
  console.log('|---|---|---|---|---|');
  for (const c of data.curves) if (c.boss) console.log(`| ${NAME[c.map]} | ${c.version} | ${c.persona} | ${c.boss.map((v) => f(v, 1)).join(' · ')} | ${f(c.boss.reduce((a, b) => a + b, 0))} |`);
}
if (data.kitRows?.length) {
  console.log('\n## Wave 8 by kit\n');
  console.log('| Map | Version | Bot | Kit | Wave reached | Reached wave 8 | Of those, lost on wave 8 | Ships lost on wave 8 | Kit weapons held by wave 8 | Wave 7 → 8 → 9 (every seed) |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const k of data.kitRows) console.log(`| ${NAME[k.map]} | ${k.version} | ${k.persona} | ${k.kit} | ${f(k.endWave)} | ${Math.round(k.reached8 * 100)}% | ${Math.round(k.ended8 * 100)}% | ${f(k.lost8)} | ${f(k.kitHeld)} of 3 | ${k.curve.slice(6, 9).map((v) => f(v, 1)).join(' → ')} |`);
}
