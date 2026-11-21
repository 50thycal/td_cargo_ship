// Wave 1 of a map card for a persona over many seeds (rule w-first: no ship
// lost on wave 1; tests/v3/round12fixes.test.ts plays seeds 11-13 of "you"
// and "casual"): how often a ship sinks, and to what.
//   npx vite-node tools/v3/rigs/wave1.ts -- [--map=rigs] [--persona=casual] [--seeds=48] [--from=1]
import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import type { MapId } from '../../../src/v3/data/maps';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const map = (opt('map') ?? 'rigs') as MapId;
const persona = opt('persona') ?? 'casual';
const n = Number(opt('seeds') ?? 48);
const from = Number(opt('from') ?? 1);
const by: Record<string, number> = {};
let lost = 0;
const bad: number[] = [];
for (let seed = from; seed < from + n; seed++) {
  const card = labCard(mapCardId(map, VERSION_DEFAULT))!;
  const p = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
  const run = new BotRun(map, seed, { persona: PERSONAS[persona], lab: p.lab, ...(p.convoy ? { convoy: p.convoy } : {}), ...(p.encounters ? { encounters: p.encounters } : {}) });
  const g = run.game;
  while (!run.done && g.wave === 1) run.advance(1);
  for (const [k, v] of Object.entries(g.sunkBy)) if (v) by[k] = (by[k] ?? 0) + v;
  if (g.lost) bad.push(seed);
  lost += g.lost;
}
console.log(`${map} ${persona} wave 1: ${lost} ships over ${n} seeds; seeds with a loss: ${bad.join(' ') || 'none'}; ${JSON.stringify(by)}`);
