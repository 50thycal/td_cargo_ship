// The enemy pairs, measured (docs/design/v3-enemy-pairs.md): for each pair's
// Test Lab card, over seeds,
//  - quiet (nobody shooting, the convoy can't lose): the longest stretch in
//    the first wave with every member on the board at once (the round-4
//    metric), and the same after Bring one;
//  - with the bots (sharp, average), a Quick test (two waves): that stretch
//    in the first wave, the card's own tally of hull hits, the convoy's hull
//    hits in all, ships sunk, and how many tests the convoy came through.
// Usage: npx vite-node tools/v3/test-lab/pairs.mts -- [seeds] [card ids...]
// (an enemy card's id measures that enemy alone, for comparison)
import { LAB_CARDS, LAB_START_WAVE, labCard } from '../../../src/v3/data/lab';
import { enemyPair, type PairMember } from '../../../src/v3/data/pairs';
import { applyFreePlay, applyLab, createGame, labBring, step, type Game } from '../../../src/v3/sim/game';
import { foeOnBoard } from '../../../src/v3/sim/lab';
import { Bot, SKILLS } from '../../../src/v3/sim/bot';

const args = process.argv.slice(2).filter((a) => a !== '--');
const SEEDS = Number(args.find((a) => /^\d+$/.test(a)) ?? 20);
const ids = args.filter((a) => !/^\d+$/.test(a));
const cards = ids.length ? ids : LAB_CARDS.filter((c) => c.kind === 'combo').map((c) => c.id);
const DT = 1 / 30;

function game(id: string, seed: number, length: 'quick' | 'full'): Game {
  const card = labCard(id)!;
  const g = createGame(card.map, seed, LAB_START_WAVE);
  applyFreePlay(g, { weapons: card.kit.map((w) => ({ id: w, level: 1 })), frequentDrops: true });
  applyLab(g, { card: id, length, mix: 'normal' });
  return g;
}

/** Hull hits the convoy has taken so far (tracked step by step). */
class Hull {
  hp = new Map<number, number>();
  hits = 0;
  see(g: Game): void {
    const now = new Map(g.ships.map((s) => [s.id, s.hp]));
    for (const [id, hp] of this.hp) this.hits += Math.max(0, hp - (now.get(id) ?? 0));
    this.hp = now;
  }
}

function together(g: Game, members: PairMember[], secs: number, bot?: Bot): number {
  let run = 0;
  let best = 0;
  const w = g.wave;
  for (let i = 0; i < secs / DT && g.phase === 'wave' && g.wave === w; i++) {
    bot?.act(g);
    step(g, DT);
    run = members.every((f) => foeOnBoard(g, f)) ? run + DT : 0;
    best = Math.max(best, run);
  }
  return best;
}

const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const f1 = (n: number) => n.toFixed(1);

console.log(`seeds ${SEEDS}`);
for (const id of cards) {
  // An enemy card (for comparison): its enemy is the whole set.
  const p = enemyPair(id.replace(/^combo-/, '')) ?? { name: labCard(id)!.name, members: labCard(id)!.foes as PairMember[] };
  const members = [...new Set(p.members)];
  const quiet: number[] = [];
  const brought: number[] = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const g = game(id, seed, 'full');
    g.lost = -99;
    g.carrierHp = g.stats.carrierHp = 1e6;
    quiet.push(together(g, members, 90));
    const b = game(id, seed, 'full');
    b.lost = -99;
    b.carrierHp = b.stats.carrierHp = 1e6;
    b.lab!.sets = [];
    step(b, DT);
    labBring(b);
    brought.push(together(b, members, 40));
  }
  const line = [`${p.name.padEnd(34)} quiet ${f1(med(quiet))} (min ${f1(Math.min(...quiet))}, ${quiet.filter((t) => t >= 4.5).length}/${SEEDS} >= 4.5) · bring ${f1(med(brought))} (min ${f1(Math.min(...brought))})`];
  for (const skill of ['sharp', 'average'] as const) {
    const tog: number[] = [];
    let harm = 0;
    let hull = 0;
    let sunk = 0;
    let through = 0;
    let sets = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = game(id, seed, 'quick');
      const bot = new Bot(SKILLS[skill], seed);
      const h = new Hull();
      sets += g.lab!.sets.length;
      tog.push(together(g, members, 90, bot));
      for (let i = 0; i < 60 * 60 * 6 && g.phase !== 'lost' && g.lab!.waves < 2; i++) {
        bot.act(g);
        if (g.phase !== 'wave' && g.phase !== 'draft') break;
        step(g, DT);
        h.see(g);
      }
      harm += g.lab!.stats.harm;
      hull += h.hits;
      sunk += g.lost;
      if (g.phase !== 'lost') through += 1;
    }
    line.push(`  ${skill.padEnd(7)} together ${f1(med(tog))} · its hits ${f1(harm / SEEDS)}/test · convoy hits ${f1(hull / SEEDS)}/test · sunk ${f1(sunk / SEEDS)}/test · through ${through}/${SEEDS} · sets in wave 1 ${f1(sets / SEEDS)}`);
  }
  console.log(line.join('\n'));
}
