// One line of JSON a seed (won, ships lost per wave, the waves reached), as
// the bot report's "you" bot plays a map card; `read.py` runs four of these
// at once and pools them (the tuning reads in docs/design/v3-ch3-dreadnought.md).
//   npx vite-node tools/v3/dreadnought/seeds.ts -- [--map=dreadnought] [--seeds=48]
//       [--from=900] [--armory=player|latest|plating|none] [--tough] [--no-enc]
//       [--pilot=sharp|random|spam] (who presses Hold: sim/convoyPilot.ts)
import type { MapId } from '../../../src/v3/data/maps';
import type { PilotSkill } from '../../../src/v3/sim/convoyPilot';
import { playReportRun } from '../../../src/v3/sim/mapReportPlay';
import { LATEST_ARMORY, PLATING_ARMORY, PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const map = (opt('map') ?? 'dreadnought') as MapId;
const n = Number(opt('seeds') ?? 48);
const from = Number(opt('from') ?? 900);
const a = opt('armory') ?? 'player';
const armory = a === 'latest' ? LATEST_ARMORY : a === 'plating' ? PLATING_ARMORY : a === 'none' ? {} : PLAYER_ARMORY;
for (let seed = from; seed < from + n; seed++) {
  const d = playReportRun(map, seed, { armory, tough: args.includes('--tough'), noEncounters: args.includes('--no-enc'), ...(opt('pilot') ? { pilot: opt('pilot') as PilotSkill } : {}) }).digest;
  console.log(JSON.stringify({ seed, won: d.won, lost: d.lost.slice(0, 13), reached: d.reached }));
}
