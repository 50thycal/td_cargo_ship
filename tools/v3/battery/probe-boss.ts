// Which seeds let the tryhard bot play all three Blackout boss rounds on the
// Battery (tests/v3/encounters.test.ts, "Battery Point's boss rounds")? The
// test's seed changed with log v67 (no star shell drops, so the drop dice
// fall differently).
//   npx vite-node tools/v3/battery/probe-boss.ts -- [--from=200] [--seeds=40]
import { ENCOUNTER_REV } from '../../../src/v3/data/encounters';
import { PERSONAS, playMimic } from '../../../src/v3/sim/mimic';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const from = Number(opt('from') ?? 200);
const n = Number(opt('seeds') ?? 40);
const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11 };
for (let seed = from; seed < from + n; seed++) {
  const on = playMimic('battery', seed, { ...opts, encounters: { rev: ENCOUNTER_REV, version: 'v1' } });
  const runs = on.game.eventLog.map((e) => `${e.run}:${e.outcome}`).join(' ');
  const done = on.game.eventLog.filter((e) => e.outcome !== 'broken' || e.run! < 3).length;
  console.log(`seed ${seed}: ${runs}${on.game.eventLog.length === 3 && done >= 2 ? '   <- all three' : ''}`);
}
