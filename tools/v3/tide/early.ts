// What sinks the Tide's ships in its first waves (normal runs, the usual
// Armory, the map card's production setup), and whether the tide was out:
//   npx vite-node tools/v3/tide/early.ts -- [--seeds=48] [--to=2] [--from=900]
import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import { highTide } from '../../../src/v3/sim/game';
import { PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const n = Number(opt('seeds') ?? 48);
const from = Number(opt('from') ?? 900);
const to = Number(opt('to') ?? 2);
const by: Record<string, number> = {};
for (let seed = from; seed < from + n; seed++) {
  const card = labCard(mapCardId('tide', VERSION_DEFAULT))!;
  const p = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
  const run = new BotRun('tide', seed, { persona: PERSONAS.you, armory: PLAYER_ARMORY, lab: p.lab, ...(p.convoy ? { convoy: p.convoy } : {}), ...(p.encounters ? { encounters: p.encounters } : {}) });
  const g = run.game;
  let prev = { ...g.sunkBy } as Record<string, number>;
  while (!run.done && g.wave <= to) {
    run.advance(1);
    for (const [k, v] of Object.entries(g.sunkBy)) {
      const d = (v ?? 0) - (prev[k] ?? 0);
      if (d > 0) {
        const key = `w${g.wave} ${k} ${highTide(g) ? 'high' : 'LOW'} t${Math.round(g.waveT)}`;
        by[key] = (by[key] ?? 0) + d;
      }
    }
    prev = { ...g.sunkBy } as Record<string, number>;
  }
}
console.log(Object.entries(by).sort().map(([k, v]) => `${k}: ${v}`).join('\n'));
