// The Citadel's mechanic read: in each wave (and boss round), the most of
// the three shield generators down at once, how often the shield fell, and
// how often the Citadel is silenced in it, as the bot report's
// "you" bot plays the map card (does the bot invest in the shield, and when?).
//   npx vite-node tools/v3/citadel/down.ts -- [--seeds=24] [--from=900]
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
const gensMost: number[] = Array(14).fill(0);
const shieldFell: number[] = Array(14).fill(0);
const coreDown: number[] = Array(14).fill(0);
const at: number[] = Array(14).fill(0);
for (let seed = from; seed < from + n; seed++) {
  const card = labCard(mapCardId('citadel', VERSION_DEFAULT))!;
  const setup = defaultSetup(card, parseLabProgress(null));
  if (args.includes('--no-enc')) setup.encounters = false;
  const p = labRunPlan(card, setup, null);
  const run = new BotRun('citadel', seed, { persona: PERSONAS.you, armory, lab: p.lab, ...(p.convoy ? { convoy: p.convoy } : {}), ...(p.encounters ? { encounters: p.encounters } : {}) });
  const g = run.game;
  let w = 0;
  let most = 0;
  let fell = false;
  let silenced = false;
  const close = () => {
    if (w > 0 && w < 14) {
      gensMost[w] += most;
      shieldFell[w] += fell ? 1 : 0;
      coreDown[w] += silenced ? 1 : 0;
      at[w] += 1;
    }
  };
  while (!run.done) {
    if (g.wave !== w) {
      close();
      w = g.wave;
      most = 0;
      fell = false;
      silenced = false;
    }
    const d = g.baseDown.slice(1, 4).filter(Boolean).length;
    most = Math.max(most, d);
    if (d === 3) fell = true;
    if (g.baseDown[0]) silenced = true;
    run.advance(1);
  }
  close();
}
const f = (xs: number[]) => xs.slice(1).map((d, i) => (at[i + 1] ? (d / at[i + 1]).toFixed(2) : '-')).join(' ');
console.log(`citadel ${a}${args.includes('--no-enc') ? ' no-enc' : ''} (${n} seeds), waves 1-13:`);
console.log(`  most generators down in the wave (mean): ${f(gensMost)}`);
console.log(`  shield down at some point (share):       ${f(shieldFell)}`);
console.log(`  Citadel silenced in the wave (share):    ${f(coreDown)}`);
