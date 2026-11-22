// Dunmar Crossing (log v58): what the spotter beacons do in a run, wave by
// wave: beacons up, shells they called, beacons shot down, where they rose.
// The "you" bot with the usual Armory on the map's Test Lab card, tough.
//   npx vite-node tools/v3/crossing/probe.ts -- [--seeds=4]
import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import { PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const n = Number(args.find((a) => a.startsWith('--seeds='))?.slice(8) ?? 4);
const gone: string[] = [];
const per: { up: number; shells: number; down: number; xs: number[] }[] = Array.from({ length: 13 }, () => ({ up: 0, shells: 0, down: 0, xs: [] }));
for (let s = 0; s < n; s++) {
  const card = labCard(mapCardId('crossing', VERSION_DEFAULT))!;
  const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
  const run = new BotRun('crossing', 900 + s, { persona: PERSONAS.you, armory: PLAYER_ARMORY, lab: plan.lab, ...(plan.convoy ? { convoy: plan.convoy } : {}), ...(plan.encounters ? { encounters: plan.encounters } : {}) });
  const g = run.game;
  g.tempo = { ...g.tempo, lossLimit: 999 };
  const seen = new Set<number>();
  const last = new Map<number, { hp: number; calls: number; t: number; state: number }>();
  while (!run.done) {
    run.advance(1);
    const w = per[Math.min(13, g.wave) - 1];
    for (const [id, v] of last)
      if (!g.threats.some((t) => t.id === id && !t.dead)) {
        last.delete(id);
        if (v.calls > 0) {
          w.down++;
          gone.push(`${v.state}/${v.t.toFixed(1)}/${v.calls}`);
        }
      }
    for (const th of g.threats) if (th.kind === 'lure' && th.foe?.spot && !th.dead) last.set(th.id, { hp: th.hp, calls: th.foe.calls ?? 0, t: th.foe.t, state: th.foe.state });
    for (const th of g.threats) {
      if (!seen.has(th.id)) {
        seen.add(th.id);
        if (th.kind === 'lure' && th.foe?.spot) {
          w.up++;
          w.xs.push(Math.round(th.x));
        }
        if (th.called) w.shells++;
      }
    }
  }
}
per.forEach((w, k) => console.log(`w${k + 1}: beacons ${(w.up / n).toFixed(2)}, gone early ${(w.down / n).toFixed(2)}, shells called ${(w.shells / n).toFixed(2)}  x ${w.xs.slice(0, 8).join(' ')}`));
console.log('gone with calls left (state/t/calls):', gone.slice(0, 30).join(' '));
