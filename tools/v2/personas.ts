// The bot personalities side by side (round 12): each persona's fingerprint
// on the taxonomy's knobs, its results, whether every pair is recognisably
// different, and which persona each of the player's runs sits closest to.
//
//   npm run v2:personas -- [--dice=2] [--seeds=4] player-log.json …
//
// Bots play the player's own maps and seeds (plus `--seeds` extra seeds per
// map), so a persona's results line up with the player's.

import { readFileSync } from 'node:fs';
import type { MapId } from '../../src/v2/data/maps';
import { PERSONAS, PERSONA_ORDER, playMimic, type Persona } from '../../src/v2/sim/mimic';
import type { PlayLog } from '../../src/v2/sim/playlog';
import { METRICS, trace, type Metric, type Trace } from './taxonomy';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const dice = Number(opt('dice') ?? 2);
const extra = Number(opt('seeds') ?? 0);
const logs = args.filter((a) => a.endsWith('.json') && !a.startsWith('--')).map((f) => JSON.parse(readFileSync(f, 'utf8')) as PlayLog);
const human = logs.filter((l) => !l.dev?.watch && !l.tempo && (l.summary?.seconds ?? 0) > 60);
const you = human.map((l) => trace(l, { who: 'you' }));
const games: { map: MapId; seed: number }[] = [
  ...human.map((l) => ({ map: l.map, seed: l.seed })),
  ...[...new Set(human.map((l) => l.map))].flatMap((map) => Array.from({ length: extra }, (_, k) => ({ map, seed: 7000 + k }))),
];

const KEYS = [
  'react.all', 'react.ballistic', 'gap.med', 'burst.mean', 'pause.med', 'rate.active', 'hands.two', 'aim.med', 'aim.p90',
  'target.urgent', 'target.overkill', 'result.dry', 'result.empty', 'pickup.got', 'rails.speed', 'noise.lapses', 'noise.lapseLen',
  'noise.rateCv', 'noise.fatigue', 'cards.stack', 'out.wave', 'out.lostBy5',
];
const metric = (k: string) => METRICS.find((m) => m.key === k)!;
const ms: Metric[] = KEYS.map(metric);

function play(p: Persona): Trace[] {
  const out: Trace[] = [];
  for (const g of games) for (let d = 0; d < dice; d++) out.push(trace(playMimic(g.map, g.seed, { persona: p, dice: d }).log, { who: 'bot', botClock: 1 / (p.speed ?? 1) }));
  return out;
}

const ids = [...PERSONA_ORDER] as string[];
const t0 = Date.now();
const runs: Record<string, Trace[]> = {};
for (const id of ids) runs[id] = play(PERSONAS[id]);
console.log(`${ids.length} personas × ${games.length * dice} games (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);

const f = (v: number) => (!Number.isFinite(v) ? '-' : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));
const col = (s: string) => s.slice(0, 8).padStart(8);
console.log(`${'knob'.padEnd(18)}${col('you(log)')}${ids.map(col).join('')}`);
const val: Record<string, Record<string, number>> = {};
for (const m of ms) {
  val[m.key] = {};
  for (const id of ids) val[m.key][id] = m.value(runs[id]);
  console.log(`${m.key.padEnd(18)}${col(f(you.length ? m.value(you) : NaN))}${ids.map((id) => col(f(val[m.key][id]))).join('')}`);
}

// A knob tells two personas apart when they differ by more than the player's
// own run-to-run spread on it (or the knob's slack, whichever is larger).
const width: Record<string, number> = {};
for (const m of ms) {
  const per = you.map((t) => m.value([t])).filter(Number.isFinite);
  const y = m.value(you);
  width[m.key] = Math.max(per.length ? Math.max(...per) - Math.min(...per) : 0, Math.abs(y) * (m.tol ?? 0.2), m.abs ?? 0);
}
console.log('\nknobs that tell each pair apart (need ≥ 3):');
let worst = Infinity;
for (let a = 0; a < ids.length; a++)
  for (let b = a + 1; b < ids.length; b++) {
    const diff = ms.filter((m) => Math.abs(val[m.key][ids[a]] - val[m.key][ids[b]]) > width[m.key]).map((m) => m.key);
    worst = Math.min(worst, diff.length);
    if (diff.length < 5) console.log(`  ${ids[a]} vs ${ids[b]}: ${diff.length} ${diff.length < 3 ? 'TOO CLOSE' : ''} (${diff.join(', ')})`);
  }
console.log(`  fewest for any pair: ${worst}`);

console.log('\nresults (wave reached: mean, and each game):');
for (const id of ids) {
  const w = runs[id].map((t) => t.end.wave);
  console.log(`  ${id.padEnd(11)} ${(w.reduce((x, y) => x + y, 0) / w.length).toFixed(1)}  ${w.join(' ')}`);
}

// Which persona each of the player's runs looks most like: distance over
// the person-side knobs (not outcomes), each scaled by its width.
if (you.length) {
  console.log('\nyour runs, nearest persona:');
  const person = ms.filter((m) => !m.key.startsWith('out.'));
  for (const t of you) {
    const d = ids
      .map((id) => {
        let s = 0;
        let n = 0;
        for (const m of person) {
          const a = m.value([t]);
          const b = val[m.key][id];
          if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
          s += Math.min(9, ((a - b) / width[m.key]) ** 2);
          n++;
        }
        return { id, d: Math.sqrt(s / Math.max(1, n)) };
      })
      .sort((x, y) => x.d - y.d);
    console.log(`  ${t.id} ${t.map.padEnd(7)} w${t.end.wave}: ${d.slice(0, 3).map((x) => `${x.id} ${x.d.toFixed(2)}`).join(' · ')}`);
  }
}

// --json=path: the fingerprint table, results and nearest personas, for a report page.
const json = opt('json');
if (json) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(
    json,
    JSON.stringify({
      personas: ids.map((id) => ({ id, label: PERSONAS[id].label, blurb: PERSONAS[id].blurb, speed: PERSONAS[id].speed ?? 1, waves: runs[id].map((t) => t.end.wave) })),
      knobs: ms.map((m) => ({ key: m.key, label: m.label, you: you.length ? m.value(you) : null, width: width[m.key], values: val[m.key] })),
    }),
  );
}
