// Phase 1 strength check: every map, a bot holding ONE weapon at a fixed
// level (every draft is Resupply), played through the real sim from wave 1. Compares the new actives
// with today's weapons. Usage: npx tsx tools/v3/weapon-ideas/phase1-sweep.mts [seeds] [skill] [level]
import { createGame, applyFreePlay, step, type Game } from '../../../src/v3/sim/game';
import { Bot, SKILLS } from '../../../src/v3/sim/bot';
import { MAP_ORDER } from '../../../src/v3/data/maps';
import type { AbilityId } from '../../../src/v3/data/abilities';
const seeds = Number(process.argv[2] ?? 3);
const skill = process.argv[3] ?? 'average';
const level = Number(process.argv[4] ?? 1);
const only = process.argv[5]?.split(',');
const WEAPONS: (AbilityId | 'none')[] = (only as AbilityId[]) ?? ['none', 'railgun', 'scatter', 'flak', 'airstrike', 'lance', 'cutter', 'grapnel', 'chainshot', 'firecontrol', 'cadence'];
for (const w of WEAPONS) {
  let won = 0, lost = 0, n = 0, uses = 0;
  for (const map of MAP_ORDER) for (let s = 0; s < seeds; s++) {
    const g: Game = createGame(map, 4000 + s);
    g.flow = 2;
    if (w !== 'none') applyFreePlay(g, { weapons: [{ id: w, level }], frequentDrops: false });
    // The bot keeps the one weapon: it never drafts another.
    const bot = new Bot({ ...SKILLS[skill], prefer: w === 'none' ? [] : [w] }, 4000 + s);
    for (let i = 0; i < 60 * 60 * 30; i++) {
      // Every run takes Resupply at every draft, so the weapon stays at its
      // level and runs differ only by the weapon held (taking a level-up
      // instead would cost a weapon run its repairs and confound the result).
      if (g.phase === 'draft') (g as any).offer = ['resupply'];
      bot.act(g);
      if (g.phase === 'won' || g.phase === 'lost') break;
      step(g, 1 / 30);
    }
    n++; if (g.cleared) won++; lost += g.lost; uses += w !== 'none' ? (g.uses[w as AbilityId] ?? 0) : 0;
  }
  console.log(`${w.padEnd(12)} L${level} ${skill.padEnd(8)} clear ${String(Math.round((100 * won) / n)).padStart(3)}%  lost ${(lost / n).toFixed(2)}  pickups/run ${(uses / n).toFixed(1)}`);
}
