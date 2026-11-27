// The Coves' boats, audited over whole bot runs (log v72): every tick of every
// fast boat is checked for being on land, being launched from a truck, and a
// gunboat or rocket boat sitting on a cargo ship's hull; the boss rounds'
// seconds and ships lost; the map's win rate.
//   npx vite-node tools/v3/coves/audit.ts -- [--seeds=96] [--from=900] [--armory=player|latest|plating|none]
import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import { onLand } from '../../../src/v3/sim/foes';
import { LATEST_ARMORY, PLATING_ARMORY, PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const n = Number(opt('seeds') ?? 96);
const from = Number(opt('from') ?? 900);
const a = opt('armory') ?? 'player';
const armory = a === 'latest' ? LATEST_ARMORY : a === 'plating' ? PLATING_ARMORY : a === 'none' ? {} : PLAYER_ARMORY;

let ticks = 0;
let land = 0;
let truck = 0;
const landBy = new Map<string, number>();
const sit = new Map<string, number>();
const near = new Map<string, number>();
const born = new Set<string>();
let launched = 0;
let wins = 0;
const boss = new Map<number, { runs: number; secs: number; lost: number }>();
const worst: string[] = [];
for (let seed = from; seed < from + n; seed++) {
  const card = labCard(mapCardId('coves', VERSION_DEFAULT))!;
  const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
  const run = new BotRun('coves', seed, { persona: PERSONAS.you, armory, lab: plan.lab, ...(plan.convoy ? { convoy: plan.convoy } : {}), ...(plan.encounters ? { encounters: plan.encounters } : {}) });
  const g = run.game;
  while (!run.done) {
    run.advance(1);
    for (const th of g.threats) {
      if (th.kind !== 'fastboat' || th.dead) continue;
      const kind = th.fire ? 'fire' : th.boat ?? 'speed';
      const key = `${seed}:${th.id}`;
      if (!born.has(key)) {
        born.add(key);
        launched++;
        if (th.from !== undefined) truck++;
      }
      ticks++;
      if (onLand(g, th.x, th.y)) {
        land++;
        landBy.set(kind, (landBy.get(kind) ?? 0) + 1);
        if (worst.length < 6) worst.push(`seed ${seed} w${g.wave} ${kind} at ${th.x.toFixed(0)},${th.y.toFixed(0)}`);
      }
      if (th.boat) {
        let d = Infinity;
        for (const s of g.ships) d = Math.min(d, Math.hypot(th.x - s.x, th.y - s.y));
        near.set(th.boat, Math.min(near.get(th.boat) ?? Infinity, d));
        if (d < 24) {
          sit.set(th.boat, (sit.get(th.boat) ?? 0) + 1);
          if (worst.length < 8) worst.push(`seed ${seed} t${g.t.toFixed(1)} ${th.boat} ${th.bs?.mode} at ${th.x.toFixed(0)},${th.y.toFixed(0)} d ${d.toFixed(0)}`);
        }
      }
    }
  }
  for (const e of g.eventLog) {
    if (e.id !== 'repair-yard' || e.outcome === 'rerun' || !e.run) continue;
    const r = boss.get(e.run) ?? { runs: 0, secs: 0, lost: 0 };
    r.runs++;
    r.secs += e.seconds;
    r.lost += e.lost;
    boss.set(e.run, r);
  }
  if (g.phase === 'won') wins++;
}
console.log(`coves audit, ${n} seeds from ${from}, armory ${a}: won ${Math.round((100 * wins) / n)}%`);
console.log(`fast boats ${launched}, from a truck ${truck}; boat-ticks ${ticks}, on land ${land} (${[...landBy].map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}); gun/rocket boat ticks within 24 px of a ship's centre: ${[...sit].map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}; closest ${[...near].map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ')}`);
if (worst.length) console.log('  e.g. ' + worst.join('; '));
for (const [w, r] of [...boss].sort((x, y) => x[0] - y[0])) console.log(`B${w}: runs ${r.runs}, secs ${(r.secs / r.runs).toFixed(1)}, lost ${(r.lost / r.runs).toFixed(2)}`);
