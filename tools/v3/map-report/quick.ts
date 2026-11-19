// A quick bot read while tuning a map (no fun pass, no heat map, no kits):
//   npx vite-node tools/v3/map-report/quick.ts -- --map=island [--seeds=24]
//       [--armory=player|latest|none] [--no-enc] [--tough] [--taste=a+b+c]
// Prints won %, ships lost per wave (over the runs that reached it) and the
// boss rounds, in a few lines. For tuning only: the bot report (report.ts)
// is the record.
import { MAPS, type MapId } from '../../../src/v3/data/maps';
import type { AbilityId } from '../../../src/v3/data/abilities';
import { playReportRun } from '../../../src/v3/sim/mapReportPlay';
import { LATEST_ARMORY, PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const map = opt('map') as MapId;
if (!MAPS[map]) throw new Error('--map=<id> is required');
const n = Number(opt('seeds') ?? 24);
const a = opt('armory') ?? 'player';
const armory = a === 'latest' ? LATEST_ARMORY : a === 'none' ? {} : PLAYER_ARMORY;
const taste = opt('taste')?.split('+') as AbilityId[] | undefined;
const tough = args.includes('--tough');
const ds = Array.from({ length: n }, (_, k) => playReportRun(map, 900 + k, { armory, tough, noEncounters: args.includes('--no-enc'), ...(taste ? { taste } : {}) }).digest);
const W = 13;
const reached = (w: number) => ds.filter((d) => d.reached.includes(w + 1));
const lost = Array.from({ length: W }, (_, w) => {
  const r = reached(w);
  return r.length ? r.reduce((s, d) => s + (d.lost[w] ?? 0), 0) / r.length : NaN;
});
const sum = (d: (typeof ds)[number], to: number) => d.lost.slice(0, to).reduce((x, y) => x + y, 0);
const won = ds.filter((d) => d.won).length / n;
console.log(
  `${map} armory=${a}${tough ? ' tough' : ''}${args.includes('--no-enc') ? ' no-enc' : ''}${taste ? ` taste=${taste.join('+')}` : ''}: won ${Math.round(won * 100)}%, lost 1-10 ${(ds.reduce((s, d) => s + sum(d, 10), 0) / n).toFixed(2)}, 1-5 ${(ds.reduce((s, d) => s + sum(d, 5), 0) / n).toFixed(2)}`,
);
console.log('  per wave ' + lost.map((v, k) => `${k < 10 ? k + 1 : 'B' + (k - 9)}:${Number.isFinite(v) ? v.toFixed(2) : '-'}`).join(' '));
console.log('  reached  ' + Array.from({ length: W }, (_, w) => reached(w).length).join(' '));
