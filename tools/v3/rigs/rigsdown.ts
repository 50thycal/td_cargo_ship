// How many of the Rig Field's four rigs stand at the start of each wave and
// the boss, as the bot report's "you" bot plays the map card (the mechanic's
// read: does the bot invest in the rigs, and when?).
//   npx vite-node tools/v3/rigs/rigsdown.ts -- [--seeds=24] [--from=900]
//       [--armory=player|latest|plating|none] [--no-enc]
import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import { LATEST_ARMORY, PLATING_ARMORY, PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const n = Number(opt('seeds') ?? 24);
const from = Number(opt('from') ?? 900);
const a = opt('armory') ?? 'player';
const armory = a === 'latest' ? LATEST_ARMORY : a === 'plating' ? PLATING_ARMORY : a === 'none' ? {} : PLAYER_ARMORY;
const down: number[] = Array(14).fill(0);
const at: number[] = Array(14).fill(0);
const which: number[] = [0, 0, 0, 0];
for (let seed = from; seed < from + n; seed++) {
  const card = labCard(mapCardId('rigs', VERSION_DEFAULT))!;
  const setup = defaultSetup(card, parseLabProgress(null));
  if (args.includes('--no-enc')) setup.encounters = false;
  const p = labRunPlan(card, setup, null);
  const run = new BotRun('rigs', seed, { persona: PERSONAS.you, armory, lab: p.lab, ...(p.convoy ? { convoy: p.convoy } : {}), ...(p.encounters ? { encounters: p.encounters } : {}) });
  const g = run.game;
  let w = 0;
  while (!run.done) {
    if (g.wave !== w) {
      w = g.wave;
      if (w < 14) {
        down[w] += g.baseDown.slice(0, 4).filter(Boolean).length;
        at[w] += 1;
      }
    }
    run.advance(1);
  }
  g.baseDown.slice(0, 4).forEach((d, i) => d && which[i]++);
}
console.log(`rigs ${a}${args.includes('--no-enc') ? ' no-enc' : ''}: rigs down at the start of waves 1-13 (mean): ${down.slice(1).map((d, i) => (at[i + 1] ? (d / at[i + 1]).toFixed(2) : '-')).join(' ')}; by the end, each rig down in ${which.join(' / ')} of ${n} runs`);
