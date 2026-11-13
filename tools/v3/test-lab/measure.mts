// Scratch: the bots' Test Lab evidence for a few enemy cards (came, killed,
// stopped early, hull harm, ships sunk), summed over seeds.
// Usage: npx vite-node tools/v3/test-lab/measure.mts -- siege rocketTruck
// SEEDS=80 SKILLS=sharp,average,casual for the round docs' tables (each run
// is three Full waves of the card).
import { labCard, LAB_START_WAVE } from '../../../src/v3/data/lab';
import { applyFreePlay, applyLab, createGame, step } from '../../../src/v3/sim/game';
import { Bot, SKILLS } from '../../../src/v3/sim/bot';

import { FOE } from '../../../src/v3/data/foes';

// Try other numbers without editing: SET="diveBomber.run=300,siege.down=2".
for (const kv of (process.env.SET ?? '').split(',').filter(Boolean)) {
  const [path, v] = kv.split('=');
  const [foe, key] = path.split('.');
  ((FOE as unknown as Record<string, Record<string, number>>)[foe])[key] = Number(v);
}

const cards = process.argv.slice(2).filter((a) => a !== '--');
const DT = 1 / 30;
for (const id of cards.length ? cards : ['siege', 'rocketTruck', 'diveBomber', 'attackHeli']) {
  for (const skill of (process.env.SKILLS ?? 'sharp,casual').split(',')) {
    const sum = { came: 0, killed: 0, early: 0, harm: 0, sunk: 0 };
    let pickups = 0;
    // Ships sunk by anything (a combo's old threats are not the card's).
    let allSunk = 0;
    // Gun shots, and the ones fired at a decoy (round 9: do the bots still
    // waste shots on decoys?).
    let shots = 0;
    let decoyShots = 0;
    for (let seed = 1; seed <= Number(process.env.SEEDS ?? 10); seed++) {
      const card = labCard(id)!;
      const g = createGame(card.map, seed, LAB_START_WAVE);
      applyFreePlay(g, { weapons: card.kit.map((w) => ({ id: w, level: 1 })), frequentDrops: true });
      applyLab(g, { card: id, length: 'full', mix: 'normal' });
      g.lost = -99;
      const bot = new Bot(SKILLS[skill], seed);
      const start = g.wave;
      const seen = new Set<number>();
      for (let i = 0; i < 60 * 30 * 12 && g.wave < start + 3; i++) {
        bot.act(g);
        if (g.phase !== 'wave' && g.phase !== 'between' && g.phase !== 'draft') break;
        step(g, DT);
        for (const it of g.interceptors) {
          if (seen.has(it.id) || !it.tap) continue;
          seen.add(it.id);
          shots += 1;
          if (g.threats.find((t) => t.id === it.target)?.kind === 'decoy') decoyShots += 1;
        }
      }
      const s = g.lab!.stats;
      for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += s[k];
      pickups += g.taps.pickup;
      allSunk += g.lost + 99;
    }
    console.log(id.padEnd(12), skill.padEnd(7), JSON.stringify({ ...sum, pickups, allSunk, shots, decoyShots }));
  }
}
