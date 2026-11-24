// The "you" bot plays the gesture weapons like a person (log v68; the player
// on the Battery watch run: "the bot does not use the lance properly, it
// needs to hold down to charge a bigger hit" and "does not use the laser").

import { describe, expect, it } from 'vitest';
import { AB } from '../../src/v3/data/abilities';
import { step, type Game } from '../../src/v3/sim/game';
import { BotRun, Mimic, PERSONAS, YOU, type BotIO } from '../../src/v3/sim/mimic';
import { replay } from '../../src/v3/sim/playlog';

const KIT = [
  { id: 'lance' as const, level: 3 },
  { id: 'cutter' as const, level: 1 },
];

function play(gestures: number, seed: number, seconds: number) {
  const run = new BotRun('battery', seed, { persona: { ...PERSONAS.you, gestures }, freePlay: { weapons: KIT, frequentDrops: true } });
  for (let n = 0; n < seconds * 60 && !run.done; n += 60) run.advance(60);
  const cmds = run.rec.log.commands;
  return { run, presses: cmds.filter((c) => c[1] === 'd').length, releases: cmds.filter((c) => c[1] === 'r').length, moves: cmds.filter((c) => c[1] === 'v').length };
}

describe('the bot holds the Lance and swipes the Cutter (log v68)', () => {
  it('with gestures it presses, drags and lets go; taps only, it never does', () => {
    const on = play(0.9, 905, 150);
    expect(on.presses).toBeGreaterThan(10);
    expect(on.releases).toBeGreaterThanOrEqual(on.presses - 1);
    expect(on.moves).toBeGreaterThan(on.presses);
    const off = play(0, 905, 150);
    expect(off.presses).toBe(0);
  });

  it('the Lance is held long enough to charge: its presses last at least the half charge, and a full lance (6 hits) is fired', () => {
    const { run } = play(1, 906, 200);
    const cmds = run.rec.log.commands;
    // Each press (d) to its release (r), in steps of 1/60 s.
    const held: number[] = [];
    let down = -1;
    for (const c of cmds) {
      if (c[1] === 'd') down = c[0] as number;
      else if (c[1] === 'r' && down >= 0) {
        held.push(((c[0] as number) - down) / 60);
        down = -1;
      }
    }
    const longHolds = held.filter((s) => s >= AB.lance.half / AB.lance.rate[2] - 0.02);
    expect(longHolds.length).toBeGreaterThan(3);
    expect(Math.max(...held)).toBeGreaterThanOrEqual(AB.lance.full / AB.lance.rate[2] - 0.05);
  });

  it('a bot with no press in its hands (the audio and fun tools) still taps, and the run replays exactly', () => {
    const run = new BotRun('battery', 907, { persona: PERSONAS.you, freePlay: { weapons: KIT, frequentDrops: true } });
    for (let n = 0; n < 40 && !run.done; n++) run.advance(60);
    const log = run.finish();
    const again: Game = replay(log);
    expect({ steps: again.steps, score: again.score, lost: again.lost, shots: again.shots }).toEqual({ steps: run.game.steps, score: run.game.score, lost: run.game.lost, shots: run.game.shots });
    // The same bot with the gesture calls taken away plays the plain taps.
    const g = run.game;
    const bot = new Mimic(YOU, 907);
    const io: BotIO = { tap: () => 'empty', pick: () => undefined, flow: () => undefined, formation: () => undefined };
    expect(() => {
      for (let n = 0; n < 120; n++) {
        bot.act(g, io);
        step(g, 1 / 60);
      }
    }).not.toThrow();
  });
});
