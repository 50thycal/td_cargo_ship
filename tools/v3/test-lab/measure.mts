// Scratch: the bots' Test Lab evidence for a few enemy cards (came, killed,
// stopped early, hull harm, ships sunk), summed over seeds.
// Usage: npx vite-node tools/v3/test-lab/measure.mts -- siege rocketTruck
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
  for (const skill of ['sharp', 'casual'] as const) {
    const sum = { came: 0, killed: 0, early: 0, harm: 0, sunk: 0 };
    for (let seed = 1; seed <= 10; seed++) {
      const card = labCard(id)!;
      const g = createGame(card.map, seed, LAB_START_WAVE);
      applyFreePlay(g, { weapons: card.kit.map((w) => ({ id: w, level: 1 })), frequentDrops: true });
      applyLab(g, { card: id, length: 'full', mix: 'normal' });
      g.lost = -99;
      const bot = new Bot(SKILLS[skill], seed);
      const start = g.wave;
      for (let i = 0; i < 60 * 30 * 12 && g.wave < start + 3; i++) {
        bot.act(g);
        if (g.phase !== 'wave' && g.phase !== 'between' && g.phase !== 'draft') break;
        step(g, DT);
      }
      const s = g.lab!.stats;
      for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += s[k];
    }
    console.log(id.padEnd(12), skill.padEnd(7), JSON.stringify(sum));
  }
}
