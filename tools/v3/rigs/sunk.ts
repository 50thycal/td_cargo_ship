// What sinks the ships on the Rig Field, wave by wave (g.sunkBy), as the bot
// report's "you" bot plays the map card (tough: every seed plays every wave).
//   npx vite-node tools/v3/rigs/sunk.ts -- [--seeds=24] [--from=900] [--armory=player]
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
const by: Record<number, Record<string, number>> = {};
for (let seed = from; seed < from + n; seed++) {
  const card = labCard(mapCardId('rigs', VERSION_DEFAULT))!;
  const setup = defaultSetup(card, parseLabProgress(null));
  if (args.includes('--no-enc')) setup.encounters = false;
  const p = labRunPlan(card, setup, null);
  const run = new BotRun('rigs', seed, { persona: PERSONAS.you, armory, lab: p.lab, ...(p.convoy ? { convoy: p.convoy } : {}), ...(p.encounters ? { encounters: p.encounters } : {}) });
  const g = run.game;
  g.tempo = { ...g.tempo, lossLimit: 999 };
  g.carrierHp = g.stats.carrierHp = 1e6;
  let prev: Record<string, number> = {};
  let w = g.wave;
  const flush = () => {
    for (const [k, v] of Object.entries(g.sunkBy)) {
      const d = (v ?? 0) - (prev[k] ?? 0);
      if (d) (by[w] ??= {})[k] = ((by[w] ??= {})[k] ?? 0) + d;
    }
    prev = { ...(g.sunkBy as Record<string, number>) };
  };
  while (!run.done) {
    run.advance(1);
    if (g.wave !== w) {
      flush();
      w = g.wave;
    }
  }
  flush();
}
for (const [w, o] of Object.entries(by)) console.log(`w${w}: ${Object.entries(o).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${(v / n).toFixed(2)}`).join(', ')}`);
