// The Rigs boss rounds as the encounter test's bot plays them (the
// tryhard bot from wave 11 with a little Armory), seed by seed: each round's
// outcome and what it sent (tests/v3/encounters.test.ts picks its seed here).
//   npx vite-node tools/v3/delta/probe-boss.ts -- [--from=218] [--seeds=12]
import { PERSONAS, playMimic } from '../../../src/v3/sim/mimic';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const from = Number(opt('from') ?? 218);
const n = Number(opt('seeds') ?? 12);
for (let seed = from; seed < from + n; seed++) {
  const on = playMimic('delta', seed, { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11, encounters: { rev: 4, version: 'v1' } });
  console.log(seed, on.game.eventLog.map((e) => `r${e.run}:${e.outcome}:${Math.round(e.seconds)}s:${JSON.stringify(e.sent)}`).join(' | '));
}
