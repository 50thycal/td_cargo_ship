// How long each Coves boat lives against the bot, by kind and wave (log v68):
// seconds from launch to its end, the share the bot sinks before the boat
// has done its harm (a speedboat's ram, a gunboat's first shell, a rocket
// boat's first salvo), and salvos fired.
//   npx vite-node tools/v3/coves/boatlife.ts -- [--seeds=12] [--from=900] [--armory=player|latest|plating|none]
import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import { LATEST_ARMORY, PLATING_ARMORY, PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const n = Number(opt('seeds') ?? 12);
const from = Number(opt('from') ?? 900);
const a = opt('armory') ?? 'player';
const armory = a === 'latest' ? LATEST_ARMORY : a === 'plating' ? PLATING_ARMORY : a === 'none' ? {} : PLAYER_ARMORY;

interface Life { kind: string; wave: number; born: number; end: number; killed: boolean; salvos: number; shells: number }
const lives: Life[] = [];
for (let seed = from; seed < from + n; seed++) {
  const card = labCard(mapCardId('coves', VERSION_DEFAULT))!;
  const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
  const run = new BotRun('coves', seed, { persona: PERSONAS.you, armory, lab: plan.lab, ...(plan.convoy ? { convoy: plan.convoy } : {}), ...(plan.encounters ? { encounters: plan.encounters } : {}) });
  const g = run.game;
  const live = new Map<number, Life>();
  while (!run.done) {
    run.advance(1);
    const seen = new Set<number>();
    for (const th of g.threats) {
      if (th.kind !== 'fastboat') continue;
      seen.add(th.id);
      let l = live.get(th.id);
      if (!l) {
        l = { kind: th.fire ? 'fire' : th.boat ?? 'speed', wave: g.wave, born: g.t, end: g.t, killed: false, salvos: 0, shells: 0 };
        live.set(th.id, l);
        lives.push(l);
      }
      l.end = g.t;
      l.killed = th.dead && th.hp <= 0;
      if (th.bs) l.salvos = th.bs.n;
    }
    for (const [id, l] of live) if (!seen.has(id)) live.delete(id);
  }
}
const by = (f: (l: Life) => string) => {
  const m = new Map<string, Life[]>();
  for (const l of lives) m.set(f(l), [...(m.get(f(l)) ?? []), l]);
  return [...m.entries()].sort();
};
console.log(`coves boats, ${n} seeds, armory ${a}`);
for (const [k, ls] of by((l) => l.kind)) {
  const life = ls.reduce((s, l) => s + (l.end - l.born), 0) / ls.length;
  const sunk = ls.filter((l) => l.killed).length / ls.length;
  const sal = ls.reduce((s, l) => s + l.salvos, 0) / ls.length;
  console.log(`${k.padEnd(7)} n=${String(ls.length).padStart(3)} (${(ls.length / n).toFixed(1)}/run)  life ${life.toFixed(1)} s  sunk ${(sunk * 100).toFixed(0)}%  salvos done ${sal.toFixed(2)}`);
}
for (const [k, ls] of by((l) => `${l.kind}@${String(Math.min(l.wave, 13)).padStart(2)}`)) {
  const life = ls.reduce((s, l) => s + (l.end - l.born), 0) / ls.length;
  console.log(`   ${k} n=${ls.length} life ${life.toFixed(1)} s sunk ${((ls.filter((l) => l.killed).length / ls.length) * 100).toFixed(0)}%`);
}
