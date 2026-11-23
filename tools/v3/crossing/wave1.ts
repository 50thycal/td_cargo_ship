// Dunmar Crossing (log v58): wave 1 alone, as tests/v3/round12fixes.test.ts
// plays it (the map card's production setup, the "you" and casual bots),
// on many seeds: ships lost, and what sank them.
//   npx vite-node tools/v3/crossing/wave1.ts -- [--seeds=48] [--from=11]
import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const n = Number(opt('seeds') ?? 48);
const from = Number(opt('from') ?? 11);
const card = labCard(mapCardId('crossing', VERSION_DEFAULT))!;
const p = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
for (const persona of ['you', 'casual'] as const) {
  let lost = 0;
  const by: Record<string, number> = {};
  const bad: number[] = [];
  for (let seed = from; seed < from + n; seed++) {
    const run = new BotRun('crossing', seed, { persona: PERSONAS[persona], lab: p.lab, convoy: p.convoy!, encounters: p.encounters! });
    while (!run.done && run.game.wave === 1) run.advance(60);
    lost += run.game.lost;
    if (run.game.lost) bad.push(seed);
    for (const [k, v] of Object.entries((run.game as unknown as { sunkBy?: Record<string, number> }).sunkBy ?? {})) by[k] = (by[k] ?? 0) + v;
  }
  console.log(`${persona}: lost ${(lost / n).toFixed(3)} a run on wave 1; seeds ${bad.join(' ')}; by ${JSON.stringify(by)}`);
}
