// Replay V2 playtest logs and print what happened, wave by wave.
//   npm run v2:replay -- path/to/log.json [more.json ...]
// A file may hold one log or an array of them (e.g. a db export). Each log is
// re-run from its seed and inputs; the replay must land on the same score and
// losses the player saw, which proves the analysis is of the real game.

import { readFileSync } from 'node:fs';
import { LOG_VERSION, replay, type PlayLog } from '../../src/v2/sim/playlog';

const files = process.argv.slice(2).filter((a) => a !== '--');
if (!files.length) {
  console.error('usage: npm run v2:replay -- log.json [...]');
  process.exit(1);
}
const logs: PlayLog[] = files.flatMap((f) => {
  const data = JSON.parse(readFileSync(f, 'utf8'));
  return Array.isArray(data) ? data : [data];
});

for (const log of logs) {
  const s = log.summary;
  console.log(`\n=== ${log.id}  map ${log.map}  seed ${log.seed}  build ${log.build}  ${log.device.w}x${log.device.h}${log.device.touch ? ' touch' : ''}`);
  console.log(`ended: ${log.end ?? 'still playing (mid-run save)'} on wave ${s?.wave}  score ${s?.score}  sunk ${s?.lost}  through ${s?.delivered}  carrier ${s?.carrierHp}  ${s?.seconds}s`);
  if (log.v !== LOG_VERSION) {
    console.log(`(log format v${log.v}, this build is v${LOG_VERSION}: the rules changed, so it can't replay here — check out a build from its date)`);
  } else if ((log as { truncated?: boolean }).truncated || !log.commands.length) {
    console.log('(inputs not included — summary only)');
  } else {
    const g = replay(log);
    const match = s && g.score === s.score && g.lost === s.lost && g.steps === s.steps;
    console.log(`replay: ${match ? 'MATCHES' : 'DIFFERS'} (score ${g.score}, sunk ${g.lost}, steps ${g.steps})`);
  }
  if (!s) continue;
  console.log('wave  outcome  sunk(+)  by drone/ball/guided  shots  taps fire/empty/dry/pickup  carrier');
  let prev = { lost: 0, shots: 0, sunk: { drone: 0, ballistic: 0, guided: 0 } as Record<string, number>, taps: { fire: 0, empty: 0, dry: 0, pickup: 0 } as Record<string, number> };
  for (const w of s.waves) {
    const d = (k: string) => (w.sunkBy as Record<string, number>)[k] - (prev.sunk[k] ?? 0);
    const t = (k: string) => (w.taps as Record<string, number>)[k] - (prev.taps[k] ?? 0);
    console.log(
      `${String(w.wave).padStart(4)}  ${w.outcome.padEnd(7)}  ${String(w.lost - prev.lost).padStart(7)}  ${`${d('drone')}/${d('ballistic')}/${d('guided')}`.padStart(20)}  ${String(w.shots - prev.shots).padStart(5)}  ${`${t('fire')}/${t('empty')}/${t('dry')}/${t('pickup')}`.padStart(26)}  ${w.carrierHp}`,
    );
    prev = { lost: w.lost, shots: w.shots, sunk: { ...w.sunkBy }, taps: { ...w.taps } };
  }
  if (s.drafts.length) console.log('cards:', s.drafts.map((d) => `w${d.wave} ${d.picked} (of ${d.offered.join('/')})`).join(', '));
  const settings = log.commands.filter((c) => c[1] === 'f' || c[1] === 'm' || c[1] === 's').map((c) => `${(c[0] / 60).toFixed(0)}s ${c[1] === 'f' ? 'flow' : c[1] === 'm' ? 'formation' : 'speed'}=${c[2]}`);
  if (settings.length) console.log('settings:', settings.join(', '));
}
