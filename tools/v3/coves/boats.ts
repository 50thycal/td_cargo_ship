// The Coves' win rate and ships lost by wave with its three boats (log v68):
// the bot report's runs on the map card (a shorter read than rigs/read.py).
//   npx vite-node tools/v3/coves/boats.ts -- [--seeds=24] [--from=900] [--armory=player|latest|plating|none] [--tough]
import { playReportRun } from '../../../src/v3/sim/mapReportPlay';
import { LATEST_ARMORY, PLATING_ARMORY, PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const n = Number(opt('seeds') ?? 24);
const from = Number(opt('from') ?? 900);
const a = opt('armory') ?? 'player';
const armory = a === 'latest' ? LATEST_ARMORY : a === 'plating' ? PLATING_ARMORY : a === 'none' ? {} : PLAYER_ARMORY;
let won = 0;
const lost = new Array<number>(13).fill(0);
const reached = new Array<number>(13).fill(0);
for (let seed = from; seed < from + n; seed++) {
  const d = playReportRun('coves', seed, { armory, tough: args.includes('--tough') }).digest;
  if (d.won) won++;
  d.lost.slice(0, 13).forEach((v, w) => (lost[w] += v));
  d.reached.forEach((r) => reached[r - 1]++);
}
console.log(`coves ${a}${args.includes('--tough') ? ' tough' : ''} n=${n}: won ${Math.round((100 * won) / n)}%`);
console.log('  lost/run by wave: ' + lost.map((v, w) => `${w < 10 ? w + 1 : 'B' + (w - 9)}:${(v / Math.max(1, reached[w])).toFixed(2)}`).join(' '));
