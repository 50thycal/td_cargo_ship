// The record report's wave budget (rule w-budget), quickly: launches a wave
// on the tough runs (every seed plays every wave), the card against the
// same card with its encounters off; a wave outside ×0.85–×1.15 is marked.
// The Dreadnought's broadsides count, as the report counts them. Tuning
// only: the bot report (tools/v3/map-report/report.ts) is the record.
//   npx vite-node tools/v3/dreadnought/launches.ts -- [--map=dreadnought] [--seeds=12] [--from=900]
import type { MapId } from '../../../src/v3/data/maps';
import { playReportRun } from '../../../src/v3/sim/mapReportPlay';
import { PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const map = (opt('map') ?? 'dreadnought') as MapId;
const n = Number(opt('seeds') ?? 12);
const from = Number(opt('from') ?? 900);
const mean = (noEncounters: boolean) => {
  const sum = new Array<number>(10).fill(0);
  for (let s = from; s < from + n; s++) {
    const d = playReportRun(map, s, { armory: PLAYER_ARMORY, tough: true, noEncounters }).digest;
    for (let w = 0; w < 10; w++) sum[w] += d.launches[w] / n;
  }
  return sum;
};
const on = mean(false);
const off = mean(true);
console.log(on.map((x, w) => `w${w + 1} ${x.toFixed(1)}/${off[w].toFixed(1)} ×${(x / off[w]).toFixed(2)}${Math.abs(x / off[w] - 1) > 0.15 ? ' !' : ''}`).join('  '));
