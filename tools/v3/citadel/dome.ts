// The Citadel's signature as the bot report's "you" bot plays the map card
// (tough): per wave, the launches planned under the dome, the ones that
// left the keep under it, how many were shot down while the shield was
// down or after leaving the dome, and how long the shield stood.
//   npx vite-node tools/v3/citadel/dome.ts -- [--seeds=8] [--from=900]
import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import { shieldUp } from '../../../src/v3/sim/game';
import { PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const n = Number(opt('seeds') ?? 8);
const from = Number(opt('from') ?? 900);
const planned: number[] = Array(14).fill(0);
const flew: number[] = Array(14).fill(0);
const up: number[] = Array(14).fill(0);
const time: number[] = Array(14).fill(0);
for (let seed = from; seed < from + n; seed++) {
  const card = labCard(mapCardId('citadel', VERSION_DEFAULT))!;
  const p = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
  const run = new BotRun('citadel', seed, { persona: PERSONAS.you, armory: PLAYER_ARMORY, lab: p.lab, ...(p.convoy ? { convoy: p.convoy } : {}), ...(p.encounters ? { encounters: p.encounters } : {}) });
  const g = run.game;
  g.tempo = { ...g.tempo, lossLimit: 999 };
  g.carrierHp = g.stats.carrierHp = 1e6;
  const seen = new Set<number>();
  let w = 0;
  while (!run.done) {
    if (g.wave !== w && g.phase === 'wave') {
      w = g.wave;
      if (w < 14) planned[w] += g.queue.filter((l) => l.dome).length;
    }
    run.advance(1);
    if (g.phase !== 'wave' || w >= 14) continue;
    time[w] += 1;
    if (shieldUp(g)) up[w] += 1;
    for (const t of g.threats) if (t.dome && !seen.has(t.id)) {
      seen.add(t.id);
      flew[w] += 1;
    }
  }
}
const f = (xs: number[]) => xs.slice(1).map((d) => (d / n).toFixed(1)).join(' ');
console.log(`citadel dome fire (${n} seeds, tough), waves 1-13:`);
console.log(`  planned under the dome: ${f(planned)}`);
console.log(`  left the keep under it: ${f(flew)}`);
console.log(`  shield up, share of the wave: ${up.slice(1).map((u, i) => (time[i + 1] ? (u / time[i + 1]).toFixed(2) : '-')).join(' ')}`);
