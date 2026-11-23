// Phase 1 strength check: every map, a bot holding ONE weapon at a fixed
// level (every draft is Resupply), played through the real sim from wave 1. Compares the new actives
// with today's weapons. Usage: npx tsx tools/v3/weapon-ideas/phase1-sweep.mts [seeds] [skill] [level] [rows]
// A row is a weapon, `a+b` (held together: a boost with a weapon; `a@1`
// fixes one's level), `none`
// (Free Play, nothing held: the plan's drops) or `campaign` (nothing held,
// with the campaign's drops: Overdrive, Time Warp, Shield and Full Steam
// still drop as power-ups).
import { createGame, applyFreePlay, step, type Game } from '../../../src/v3/sim/game';
import { Bot, SKILLS } from '../../../src/v3/sim/bot';
import { MAP_ORDER } from '../../../src/v3/data/maps';
import type { AbilityId } from '../../../src/v3/data/abilities';
const seeds = Number(process.argv[2] ?? 3);
const skill = process.argv[3] ?? 'average';
const level = Number(process.argv[4] ?? 1);
const only = process.argv[5]?.split(',');
const WEAPONS: string[] = only ?? ['none', 'railgun', 'scatter', 'flak', 'airstrike', 'lance', 'cutter', 'grapnel', 'cadence'];
for (const w of WEAPONS) {
  // `id@n` holds that one at level n (e.g. flak@1+overclock@3).
  const held = w === 'none' || w === 'campaign' ? [] : w.split('+').map((p) => { const [id, lv] = p.split('@'); return { id: id as AbilityId, level: lv ? Number(lv) : level }; });
  const ids = held.map((h) => h.id);
  let won = 0, lost = 0, n = 0, uses = 0;
  for (const map of MAP_ORDER) for (let s = 0; s < seeds; s++) {
    const g: Game = createGame(map, 4000 + s);
    g.flow = 2;
    if (w !== 'campaign') applyFreePlay(g, { weapons: held, frequentDrops: false });
    // The bot keeps its weapons: it never drafts another.
    const bot = new Bot({ ...SKILLS[skill], prefer: ids }, 4000 + s);
    for (let i = 0; i < 60 * 60 * 30; i++) {
      // Every run takes Resupply at every draft, so the weapon stays at its
      // level and runs differ only by the weapon held (taking a level-up
      // instead would cost a weapon run its repairs and confound the result).
      if (g.phase === 'draft') (g as any).offer = ['resupply'];
      bot.act(g);
      if (g.phase === 'won' || g.phase === 'lost') break;
      step(g, 1 / 30);
    }
    n++; if (g.cleared) won++; lost += g.lost; uses += ids.reduce((a, id) => a + (g.uses[id] ?? 0), 0);
  }
  console.log(`${w.padEnd(22)} L${level} ${skill.padEnd(8)} clear ${String(Math.round((100 * won) / n)).padStart(3)}%  lost ${(lost / n).toFixed(2)}  pickups/run ${(uses / n).toFixed(1)}`);
}
