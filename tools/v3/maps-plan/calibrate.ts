// Calibrate maps' threat scales: clear rate by scale for the player-fitted
// persona (sim/mimic.ts), at a given Armory loadout, and the scale nearest the
// plan's target for the map's slot. Maps can be split across processes.
//
//   npx vite-node tools/v3/maps-plan/calibrate.ts -- --maps=a,b [--armory=id:lv,id:lv] [--seeds=12] [--scales=0.8,1,1.2]
//   (--bot=average uses the reaction-time bot instead of the persona)

import type { ArmoryId, ArmoryLevels } from '../../../src/v3/data/armory';
import { MAPS, MAP_ORDER, type MapId } from '../../../src/v3/data/maps';
import { runBot, SKILLS } from '../../../src/v3/sim/bot';
import { playMimic } from '../../../src/v3/sim/mimic';
import { targetTries } from './targets';

const opt = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const maps = (opt('maps')?.split(',') ?? MAP_ORDER) as MapId[];
const seeds = Number(opt('seeds') ?? 12);
const bot = opt('bot');
const armory: ArmoryLevels = Object.fromEntries((opt('armory') ?? '').split(',').filter(Boolean).map((p) => [p.split(':')[0] as ArmoryId, Number(p.split(':')[1])]));
const scales = (opt('scales') ?? '0.8,0.95,1.1,1.25,1.4,1.6,1.8').split(',').map(Number);

for (const map of maps) {
  const slot = MAP_ORDER.indexOf(map) + 1;
  const want = 1 / targetTries(slot);
  const base = MAPS[map].threatScale;
  const row: string[] = [];
  let best = base;
  let bestGap = Infinity;
  for (const sc of scales) {
    MAPS[map].threatScale = sc;
    let won = 0;
    for (let s = 0; s < seeds; s++) {
      const seed = 7000 + s;
      won += (bot ? runBot(map, seed, SKILLS[bot], { flow: 2, armory }).won : playMimic(map, seed, { armory }).game.cleared) ? 1 : 0;
    }
    const rate = won / seeds;
    row.push(`${sc.toFixed(2)}:${Math.round(rate * 100)}%`);
    if (Math.abs(rate - want) < bestGap - 1e-9) {
      bestGap = Math.abs(rate - want);
      best = sc;
    }
  }
  MAPS[map].threatScale = base;
  console.log(`${map.padEnd(12)} slot ${String(slot).padStart(2)} want ${String(Math.round(want * 100)).padStart(3)}% → ${best.toFixed(2)}  (now ${base.toFixed(2)})  ${row.join('  ')}`);
}
