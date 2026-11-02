// Quick check: one bot run per map (seeds from argv), reporting clears and
// anything odd (NaN positions, a stuck wave). Not part of the sweep.
import { MAP_ORDER } from '../../../src/v3/data/maps';
import { runBot, SKILLS } from '../../../src/v3/sim/bot';
const seeds = Number(process.argv[2] ?? 2);
const skill = (process.argv[3] ?? 'average') as keyof typeof SKILLS;
for (const map of MAP_ORDER) {
  const t0 = Date.now();
  let won = 0, waves = 0, lost = 0, sec = 0;
  for (let s = 1; s <= seeds; s++) {
    const r = runBot(map, s, SKILLS[skill], { armory: {} });
    won += r.won ? 1 : 0; waves += r.wavesCleared; lost += r.lost; sec += r.seconds;
  }
  console.log(`${map.padEnd(12)} clear ${won}/${seeds}  waves ${(waves / seeds).toFixed(1)}  lost ${(lost / seeds).toFixed(1)}  ${(sec / seeds / 60).toFixed(1)} min  (${Date.now() - t0} ms)`);
}
