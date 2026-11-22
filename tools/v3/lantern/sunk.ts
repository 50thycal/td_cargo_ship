// What sinks the ships, wave by wave, as the report's bot plays a map card
// (chapter 3, the Black Strait: docs/design/v3-ch3-lantern.md). For each wave:
// ships sunk a run (over the runs that reached it) by the threat that sank
// them, and how often the map's shore guns were knocked out. Tuning only:
// the bot report (tools/v3/map-report/report.ts) is the record.
//   npx vite-node tools/v3/lantern/sunk.ts -- [--map=battery] [--seeds=24]
//       [--from=900] [--armory=player|latest|plating|none] [--tough] [--no-enc]
import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import type { MapId } from '../../../src/v3/data/maps';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import { LOG_VERSION, logTelemetry } from '../../../src/v3/sim/playlog';
import { LATEST_ARMORY, PLATING_ARMORY, PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const map = (opt('map') ?? 'lantern') as MapId;
const n = Number(opt('seeds') ?? 24);
const from = Number(opt('from') ?? 900);
const a = opt('armory') ?? 'player';
const armory = a === 'latest' ? LATEST_ARMORY : a === 'plating' ? PLATING_ARMORY : a === 'none' ? {} : PLAYER_ARMORY;
const tough = args.includes('--tough');

const W = 13;
const reached = new Array<number>(W).fill(0);
const sunk: Record<string, number>[] = Array.from({ length: W }, () => ({}));
const downs = new Array<number>(W).fill(0);
for (let seed = from; seed < from + n; seed++) {
  const card = labCard(mapCardId(map, VERSION_DEFAULT))!;
  const setup = defaultSetup(card, parseLabProgress(null));
  if (args.includes('--no-enc')) setup.encounters = false;
  const plan = labRunPlan(card, setup, null);
  const run = new BotRun(map, seed, { persona: PERSONAS.you, armory, lab: plan.lab, ...(plan.convoy ? { convoy: plan.convoy } : {}), ...(plan.encounters ? { encounters: plan.encounters } : {}) });
  const g = run.game;
  if (tough) {
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = g.stats.carrierHp = 1e6;
  }
  logTelemetry(g, { id: `sunk-${seed}`, build: 'sim', v: LOG_VERSION, firstWave: 1, device: { w: 0, h: 0, dpr: 1, touch: true, ua: 'sunk' } }, 'sim', 'you');
  while (!run.done) run.advance(1);
  const sc = g.tel!.sidecar(g);
  const waveOf = (p: number) => sc.phases[p]?.wave ?? 0;
  const seen = new Set<number>();
  for (const ph of sc.phases) if (ph.wave >= 1 && ph.wave <= W) seen.add(ph.wave);
  for (const w of seen) reached[w - 1]++;
  for (const e of sc.events) {
    const w = waveOf(e.p);
    if (w < 1 || w > W) continue;
    if (e.k === 'ship-' && e.why === 'sunk') sunk[w - 1][e.by ?? '?'] = (sunk[w - 1][e.by ?? '?'] ?? 0) + (e.vip ? 3 : 1);
    if (e.k === 'env' && e.what === 'post' && e.st === 'down') downs[w - 1]++;
  }
}
console.log(`${map} armory=${a}${tough ? ' tough' : ''}: ${n} seeds from ${from}`);
for (let w = 0; w < W; w++) {
  const r = reached[w] || 1;
  const tot = Object.values(sunk[w]).reduce((x, y) => x + y, 0) / r;
  const by = Object.entries(sunk[w]).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${(v / r).toFixed(2)}`).join(', ');
  console.log(`  ${w < 10 ? `w${w + 1}` : `B${w - 9}`} (${reached[w]}) lost ${tot.toFixed(2)}  guns down ${(downs[w] / r).toFixed(2)}  | ${by}`);
}
