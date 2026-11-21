// Debug (log v45): the boss test's seed, round by round.
import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { PERSONAS, playMimic } from '../../../src/v3/sim/mimic';
const seed = Number(process.argv.slice(2).filter((a) => a !== '--')[0] ?? 208);
const on = playMimic('saltgate', seed, { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11, encounters: { rev: 4, version: VERSION_DEFAULT } });
for (const e of on.game.eventLog) console.log(e.run, e.outcome, e.seconds.toFixed(1), JSON.stringify(e.sent));
