// Bot vs player, knob by knob (round 12): every knob in the taxonomy
// (tools/v2/taxonomy.ts) for the player's logs next to the bot's.
//
//   npm run v2:taxonomy -- [--persona=you] [--dice=4] [--botlogs] logs…
//
// Each human log is matched by bot games on the same map and seed (`dice`
// rolls of the bot per run), so both face the same waves. Watch-mode logs
// join the bot side with --botlogs.

import { readFileSync } from 'node:fs';
import { PERSONAS, playMimic } from '../../src/v2/sim/mimic';
import type { PlayLog } from '../../src/v2/sim/playlog';
import { compare, printVerdicts, trace, type Trace } from './taxonomy';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const persona = PERSONAS[opt('persona') ?? 'you'];
if (!persona) throw new Error(`unknown persona; have ${Object.keys(PERSONAS).join(', ')}`);
const dice = Number(opt('dice') ?? 4);
const logs = args.filter((a) => a.endsWith('.json') && !a.startsWith('--')).map((f) => JSON.parse(readFileSync(f, 'utf8')) as PlayLog);
const human = logs.filter((l) => !l.dev?.watch && !l.tempo && (l.summary?.seconds ?? 0) > 60);
const you = human.map((l) => trace(l, { who: 'you' }));
const botClock = 1 / (persona.speed ?? 1);
const bot: Trace[] = [];
const t0 = Date.now();
for (const l of human)
  for (let d = 0; d < dice; d++) bot.push(trace(playMimic(l.map, l.seed, { persona, dice: d }).log, { who: 'bot', botClock }));
// A watch log says which persona played (before round 12: you-v1).
if (args.includes('--botlogs'))
  for (const l of logs.filter((x) => x.dev?.watch)) bot.push(trace(l, { who: 'bot', botClock: 1 / (PERSONAS[l.dev?.bot ?? 'you-v1']?.speed ?? 1) }));
console.log(`you: ${you.map((t) => `${t.id} ${t.map} w${t.end.wave}`).join(' · ')}`);
console.log(`bot ${persona.id}: ${bot.length} games (${((Date.now() - t0) / 1000).toFixed(1)} s), waves ${bot.map((t) => t.end.wave).join(' ')}\n`);
printVerdicts(compare(you, bot), persona.id.slice(0, 7));
// --json=path: every knob's numbers, for a report page.
const json = opt('json');
if (json) {
  const { writeFileSync } = await import('node:fs');
  const vs = compare(you, bot);
  writeFileSync(
    json,
    JSON.stringify({
      persona: persona.id,
      you: you.map((t) => ({ id: t.id, map: t.map, wave: t.end.wave })),
      bot: bot.map((t) => ({ id: t.id, map: t.map, wave: t.end.wave })),
      knobs: vs.map((v) => ({ key: v.m.key, family: v.m.family, label: v.m.label, headline: !!v.m.headline, you: v.you, lo: v.lo, hi: v.hi, bot: v.bot, ks: v.ks, pass: v.pass, na: v.na })),
    }),
  );
}
