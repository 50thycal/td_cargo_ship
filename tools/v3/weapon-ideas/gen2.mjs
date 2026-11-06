// Builds docs/design/v3-weapon-ideas-2.md from its template, the idea data
// (arsenal2.mjs) and the prototype results (proto-results.json), so the
// document can't drift from the data. Usage:
//   node tools/v3/weapon-ideas/gen2.mjs            (writes the doc)
//   node tools/v3/weapon-ideas/gen2.mjs --check    (fails if the doc is stale)
import { readFileSync, writeFileSync } from 'node:fs';
import { IDEAS, CATEGORY_RULES } from './arsenal2.mjs';

const here = new URL('.', import.meta.url);
const root = new URL('../../../', import.meta.url);
const R = JSON.parse(readFileSync(new URL('proto-results.json', here), 'utf8'));
const tpl = readFileSync(new URL('ideas2.template.md', here), 'utf8');
const base = R.runs.none;

const pct = (n) => `${Math.round(n)}%`;
const delta = (n, b) => `${n - b >= 0 ? '+' : '−'}${Math.abs(Math.round(n - b))}`;
const measured = (key) => {
  const r = R.runs[key];
  if (!r) return null;
  return `accurate player ${pct(r.average.clear)} (${delta(r.average.clear, base.average.clear)}), tap-happy ${pct(r.spammer.clear)} (${delta(r.spammer.clear, base.spammer.clear)})`;
};
const NOT_PROTO = {
  wireguide: 'needs a person steering; the bot can\'t say how it feels.',
  grapnel: 'needs a person dragging; the physics is the question, not the numbers.',
  firecontrol: 'its value is in reading a raid, which the bot doesn\'t do.',
  limpet: 'needs threats to carry a charge in the sim.',
  tidal: 'surface threats are rare on most maps; worth a map-by-map test once built.',
  cadence: 'rhythm is a feel question for a person.',
  chainshot: 'needs a person picking pairs.',
  jammer: 'needs the sim\'s homing to accept a lost lock.',
  storm: 'needs a wind model.',
  ammoShip: 'needs the enemy to prefer a ship.',
  dualWield: 'needs two loaded weapons at once in the sim.',
  wildCard: 'a random level 3 shot; balance follows the weapons\' own.',
  focus: 'slow motion helps a person, not a bot that never hesitates.',
};

function card(i, n) {
  const from = i.from === 'player' ? ' (your idea)' : '';
  const lines = [`### ${n}. ${i.name}${i.max ? ` → ${i.max}` : ''}${from}`, '', `*${i.pitch}*`, ''];
  lines.push(`- **How:** ${i.how}`);
  lines.push(`- **▲ Strong:** ${i.strong}. **▼ Weak:** ${i.weak}.`);
  if (i.levels) lines.push(`- **Levels:** 1: ${i.levels[0]}. 2: ${i.levels[1]}. MAX: ${i.levels[2]}.`);
  lines.push(`- **What's new:** ${i.novel}`);
  const m = i.proto && measured(i.proto);
  lines.push(`- **Prototype:** ${m ? `${m}${i.protoNote ? `. Note: ${i.protoNote}.` : '.'}` : `not run: ${NOT_PROTO[i.id] ?? 'not yet.'}`}`);
  if (i.tune) lines.push(`- **Tuning:** ${i.tune}`);
  if (i.echo) lines.push(`- **Close to:** ${i.echo}. Kept because the difference is the point.`);
  return lines.join('\n');
}

const section = (cat) =>
  [`> **Rule:** ${CATEGORY_RULES[cat]}`, '', ...IDEAS.filter((i) => i.cat === cat && i.status === 'keep').map((i, k) => card(i, k + 1) + '\n')].join('\n');

const NAMES = Object.fromEntries(IDEAS.filter((i) => i.proto).map((i) => [i.proto, i]));
NAMES.drones = { name: 'Drone Screen, one drone every 0.7 s', cat: 'passive', status: 'variant' };
NAMES.bomberDelay = { name: 'Bomber Wing, launches delayed instead of cancelled', cat: 'passive', status: 'variant' };
NAMES.longshot = { name: 'Long Shot, player not adapting', cat: 'boost', status: 'variant' };
NAMES.shore = { name: 'Shore Bombardment, player not adapting', cat: 'boost', status: 'variant' };
function results() {
  const rows = Object.entries(R.runs)
    .filter(([k]) => k !== 'none')
    .map(([k, r]) => ({ k, r, i: NAMES[k] ?? { name: k, cat: '?', status: '?' } }))
    .map((x) => (x.k.endsWith('A') ? { ...x, i: { ...x.i, name: `${x.i.name}, player shooting early` } } : x))
    .sort((a, b) => b.r.average.clear - a.r.average.clear);
  const out = [
    '| Idea | Category | Status | Accurate player: runs won | Tap-happy: runs won | Ships lost a run (accurate) |',
    '|---|---|---|---|---|---|',
    `| *No idea (baseline)* | | | ${pct(base.average.clear)} | ${pct(base.spammer.clear)} | ${base.average.lost.toFixed(1)} |`,
  ];
  for (const { r, i } of rows) {
    const status = i.status === 'keep' ? 'kept' : i.status === 'cut' ? '**cut**' : 'variant';
    out.push(`| ${i.name} | ${i.cat} | ${status} | ${pct(r.average.clear)} (${delta(r.average.clear, base.average.clear)}) | ${pct(r.spammer.clear)} (${delta(r.spammer.clear, base.spammer.clear)}) | ${r.average.lost.toFixed(1)} |`);
  }
  return out.join('\n');
}

function cuts() {
  const out = ['| Idea | Category | Why it was cut |', '|---|---|---|'];
  for (const i of IDEAS.filter((x) => x.status === 'cut')) out.push(`| ${i.name} | ${i.cat} | ${i.why} |`);
  return out.join('\n');
}

const token = (t) =>
  t.replace(/\{\{(\w+)\.(a|s|da|ds)\}\}/g, (_, k, f) => {
    const r = R.runs[k];
    if (!r) throw new Error(`no results for ${k}`);
    if (f === 'a') return pct(r.average.clear);
    if (f === 's') return pct(r.spammer.clear);
    if (f === 'da') return delta(r.average.clear, base.average.clear);
    return delta(r.spammer.clear, base.spammer.clear);
  });
const doc = token(tpl
  .replace('{{RUNS}}', String(R.runsPerIdea))
  .replace('{{RESULTS}}', results())
  .replace('{{ACTIVE}}', section('active'))
  .replace('{{PASSIVE}}', section('passive'))
  .replace('{{BOOST}}', section('boost'))
  .replace('{{CUTS}}', cuts())
  .replace('{{BASE_A}}', pct(base.average.clear))
  .replace('{{BASE_S}}', pct(base.spammer.clear)));
if (/\{\{/.test(doc)) throw new Error('unfilled placeholder: ' + doc.match(/\{\{[^}]*\}\}/)[0]);
const path = new URL('docs/design/v3-weapon-ideas-2.md', root);
if (process.argv.includes('--check')) {
  const now = readFileSync(path, 'utf8');
  if (now !== doc) { console.error('docs/design/v3-weapon-ideas-2.md is stale: run node tools/v3/weapon-ideas/gen2.mjs'); process.exit(1); }
  console.log('Doc matches the data.');
} else {
  writeFileSync(path, doc);
  console.log(`Wrote ${path.pathname} (${doc.length} chars).`);
}
