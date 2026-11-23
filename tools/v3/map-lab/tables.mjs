// The convoy experiment's results as Markdown tables, for the notes
// (docs/design/v3-map-lab-slices2-5.md): node tools/v3/map-lab/tables.mjs
// Reads results/experiment.json and results/experiment-encounters.json, so
// the numbers in the notes are these files' and not retyped.

import { readFileSync } from 'node:fs';

const R = 'tools/v3/map-lab/results';
const read = (f) => JSON.parse(readFileSync(`${R}/${f}`, 'utf8'));
const shared = read('experiment.json');
const enc = read('experiment-encounters.json');
const MAP = { strait: 'The Strait', gauntlet: 'The Gauntlet', harbor: 'Harbor Mouth' };
const BOT = { you: 'fitted to the owner, base gun', tryhard: 'sharper, Wide Warhead 3' };
const FIXED = 'fixed schedule (';
const FAST = 'fixed schedule at the fastest flow';
const OWN = 'each policy under its own rules';
const rows = (e, map, persona, block) => e.rows.filter((r) => r.map === map && r.persona === persona && r.block.startsWith(block));
const sign = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
const md = (head, body) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...body.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const pairs = Object.keys(MAP).flatMap((map) => Object.keys(BOT).map((persona) => [map, persona]));

function policies(e, block, title) {
  console.log(`\n#### ${title}\n`);
  console.log(
    md(
      ['Map', 'Bot', 'Policy', 'Finished', 'Hull lost', 'Sunk', 'Hull per ship-minute', 'Score', 'Commands', 'Hull against A (seeds lower)'],
      pairs.flatMap(([map, persona]) =>
        rows(e, map, persona, block).map((r) => [MAP[map], persona, r.policy, `${r.finished}/${r.n}`, r.m.hpShip.mean.toFixed(0), r.m.sunk.mean.toFixed(1), r.m.risk.mean.toFixed(2), r.m.score.mean.toFixed(0), r.m.commands.mean.toFixed(1), r.vsA ? `${sign(r.vsA.hull.mean)} (${r.vsA.hull.lower}/${r.n})` : '']),
      ),
    ),
  );
}

console.log(`Bots: ${Object.entries(BOT).map(([k, v]) => `\`${k}\` (${v})`).join('; ')}. ${shared.seeds} seeds a row; convoy rules rev ${shared.convoyRev}; encounters rev ${enc.encounters}. Problems reported by the telemetry's own checks: ${shared.rows.reduce((a, r) => a + r.problems, 0)} (shared), ${enc.rows.reduce((a, r) => a + r.problems, 0)} (encounters).`);
policies(shared, FIXED, 'Shared waves, the same ships owed under every policy (the map\'s flow, step 2)');
policies(shared, OWN, 'Shared waves, each policy under its own rules (the game\'s loss limit; C keeps its slider and its score)');
policies(enc, FIXED, 'Encounters on, the same ships owed under every policy');

console.log('\n#### The flow slider: policy A at the map\'s flow and at the fastest\n');
console.log(
  md(
    ['Map', 'Bot', 'Waves', 'Hull per ship-minute, step 2', 'Step 4', 'Score, step 2', 'Step 4'],
    [['shared', shared], ['encounters', enc]].flatMap(([name, e]) =>
      pairs.map(([map, persona]) => {
        const a = rows(e, map, persona, FIXED).find((r) => r.policy.startsWith('A'));
        const b = rows(e, map, persona, FAST).find((r) => r.policy.startsWith('A'));
        return [MAP[map], persona, name, a.m.risk.mean.toFixed(2), b.m.risk.mean.toFixed(2), a.m.score.mean.toFixed(0), b.m.score.mean.toFixed(0)];
      }),
    ),
  ),
);

console.log('\n#### What the encounters did to the waves: policy A, shared against encounters\n');
console.log(
  md(
    ['Map', 'Bot', 'Hull per ship-minute, shared', 'Encounters', 'Hull lost, shared', 'Encounters', 'Sunk, shared', 'Encounters', 'Finished, shared', 'Encounters'],
    pairs.map(([map, persona]) => {
      const a = rows(shared, map, persona, FIXED).find((r) => r.policy.startsWith('A'));
      const b = rows(enc, map, persona, FIXED).find((r) => r.policy.startsWith('A'));
      return [MAP[map], persona, a.m.risk.mean.toFixed(2), b.m.risk.mean.toFixed(2), a.m.hpShip.mean.toFixed(0), b.m.hpShip.mean.toFixed(0), a.m.sunk.mean.toFixed(1), b.m.sunk.mean.toFixed(1), `${a.finished}/${a.n}`, `${b.finished}/${b.n}`];
    }),
  ),
);
