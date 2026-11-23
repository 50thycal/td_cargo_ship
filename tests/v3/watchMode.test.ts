// Test Lab Watch mode (log v65): the "you" bot plays a map card on screen,
// the player takes over and hands back at will, and the log says who played
// which ticks. Both sides' inputs are ordinary commands, so the log replays
// exactly; the tools that read how the player plays leave the bot's ticks out.

import { describe, expect, it } from 'vitest';
import { labCard } from '../../src/v3/data/lab';
import { labArmoryLevels, parseLabArmory } from '../../src/v3/data/labArmory';
import { chapterOf } from '../../src/v3/data/maps';
import { applyConvoy } from '../../src/v3/sim/convoy';
import { applyEncounters, applyLab, createGame, step, worthShooting, type Game } from '../../src/v3/sim/game';
import { Mimic, YOU, type BotIO } from '../../src/v3/sim/mimic';
import { Recorder, SIM_DT, byPlayer, handPlayed, playControl, playKind, replay, type PlayLog } from '../../src/v3/sim/playlog';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../src/v3/ui/lab';
import { measure } from '../../tools/v3/bot-fit/measure';
import { runNumbers } from '../../tools/v3/test-lab/scores.mjs';
import { mapRuns } from '../../src/v3/sim/labDocs';

process.env.V3_FIT_IMPORT = '1';
const { playerRun } = await import('../../tools/v3/bot-fit/fit');

/** A map card's run as the app starts a Watch run of it: the card's setup,
 *  the chapter's Test Lab Armory, and `control` on the log. */
function watchRun(map: 'strait' | 'gauntlet', seed: number, watch = true): { g: Game; rec: Recorder; bot: Mimic; io: BotIO } {
  const card = labCard(`map-${map}`)!;
  const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
  const armory = labArmoryLevels(parseLabArmory(null), chapterOf(map));
  const g = createGame(map, seed, 1, undefined, armory);
  applyLab(g, plan.lab);
  if (plan.encounters) applyEncounters(g, plan.encounters);
  if (plan.convoy) applyConvoy(g, plan.convoy);
  const rec = new Recorder(g, {
    build: 'test',
    startedAt: new Date(0).toISOString(),
    firstWave: 1,
    lab: plan.lab,
    ...(plan.encounters ? { encounters: plan.encounters } : {}),
    ...(plan.convoy ? { convoy: plan.convoy } : {}),
    ...(watch ? { control: playControl(YOU.id, []) } : {}),
    device: { w: 874, h: 402, dpr: 2, touch: true, ua: 'test' },
  });
  const bot = new Mimic(YOU, seed);
  const io: BotIO = {
    tap: (x, y, r) => rec.tap(x, y, r),
    pick: (id, rep) => rec.pick(id, rep),
    flow: (v) => rec.flow(v),
    formation: (id) => rec.formation(id),
    pace: (v) => rec.pace(v),
    reroll: () => rec.reroll(),
    freeLevel: (id) => rec.freeLevel(id),
    goldBomb: () => rec.goldBomb(),
  };
  return { g, rec, bot, io };
}

/** The player at the controls: taps the threat nearest impact every 0.4 s,
 *  and takes the first card it can in a draft. */
function playerAct(g: Game, rec: Recorder): void {
  if (g.phase === 'draft') {
    rec.pick(g.offer[0]);
    return;
  }
  if (g.phase !== 'wave' || g.steps % 24) return;
  const th = worthShooting(g, g.threats).find((t) => !t.dead && t.x > 0 && t.x < 1600 && t.y > 0 && t.y < 900);
  if (th) rec.tap(th.x, th.y, 90);
}

function same(log: PlayLog, g: Game): void {
  const r = replay(log);
  expect({ steps: r.steps, score: r.score, lost: r.lost, wave: r.wave, shots: r.shots, phase: r.phase }).toEqual({ steps: g.steps, score: g.score, lost: g.lost, wave: g.wave, shots: g.shots, phase: g.phase });
}

describe('Test Lab Watch mode (log v65)', () => {
  it('a Watch run the bot plays alone: bot-only segments, labelled sim, and it replays exactly', () => {
    const { g, rec, bot, io } = watchRun('strait', 11);
    for (let n = 0; n < 60 * 90 && g.phase !== 'lost' && g.phase !== 'won'; n++) {
      bot.act(g, io);
      step(g, SIM_DT);
    }
    expect(g.shots).toBeGreaterThan(0);
    const log = rec.finish('quit');
    expect(log.control).toMatchObject({ mode: 'watch', bot: 'you', label: 'sim', playerShare: 0, playerTicks: 0, switches: 0 });
    expect(log.control!.segments).toEqual([{ fromTick: 0, toTick: g.steps, by: 'bot' }]);
    expect(log.control!.botTicks).toBe(g.steps);
    expect(playKind(log)).toBe('sim');
    expect(handPlayed(log)).toBe(false);
    // The bot's taps are ordinary commands: the log replays to the same game.
    expect(log.commands.filter((c) => c[1] === 't').length).toBeGreaterThan(5);
    same(log, g);
  });

  it('taken over mid-wave and handed back: the switch ticks, a note by whom, and an exact replay', () => {
    const { g, rec, bot, io } = watchRun('strait', 23);
    let took = -1;
    let gave = -1;
    let who: 'bot' | 'you' = 'bot';
    for (let n = 0; n < 60 * 150 && g.phase !== 'lost' && g.phase !== 'won'; n++) {
      // Take over halfway through wave 1, hand back early in wave 3.
      if (who === 'bot' && took < 0 && g.phase === 'wave' && g.wave === 1 && g.waveT > 12) {
        took = g.steps;
        rec.control('you');
        who = 'you';
        rec.note({ where: 'pause', tags: [], text: 'took over here' });
      }
      if (who === 'you' && g.phase === 'wave' && g.wave === 3 && g.waveT > 4) {
        rec.note({ where: 'pause', tags: [], text: 'handing back' });
        gave = g.steps;
        rec.control('bot');
        who = 'bot';
      }
      if (who === 'bot') bot.act(g, io);
      else playerAct(g, rec);
      if (g.phase === 'wave') step(g, SIM_DT);
    }
    expect(took).toBeGreaterThan(0);
    expect(gave).toBeGreaterThan(took);
    const log = rec.finish(g.phase === 'won' ? 'won' : g.phase === 'lost' ? 'lost' : 'quit');
    expect(log.commands.filter((c) => c[1] === 'c')).toEqual([
      [took, 'c', 'you'],
      [gave, 'c', 'bot'],
    ]);
    expect(log.control!.segments).toEqual([
      { fromTick: 0, toTick: took, by: 'bot' },
      { fromTick: took, toTick: gave, by: 'player' },
      { fromTick: gave, toTick: g.steps, by: 'bot' },
    ]);
    expect(log.control!.label).toBe('mixed');
    expect(log.control!.switches).toBe(2);
    expect(log.control!.playerShare).toBeCloseTo((gave - took) / g.steps, 2);
    // Each note: who was playing, the wave and the tick.
    expect(log.notes!.map((n) => ({ by: n.by, wave: n.wave, step: n.step }))).toEqual([
      { by: 'player', wave: 1, step: took },
      { by: 'player', wave: 3, step: gave },
    ]);
    // The player's taps and the bot's alike are commands: it replays exactly.
    same(log, g);
    const mine = byPlayer(log);
    expect([mine(0), mine(took - 1), mine(took), mine(gave - 1), mine(gave), mine(g.steps + 5)]).toEqual([false, false, true, true, false, false]);
  });

  it('the bot fit and the Test Lab averages leave out what the bot played', () => {
    // A mixed run: bot, then the player from wave 2 on.
    const { g, rec, bot, io } = watchRun('gauntlet', 5);
    let took = -1;
    for (let n = 0; n < 60 * 200 && g.phase !== 'lost' && g.phase !== 'won' && g.wave < 6; n++) {
      if (took < 0 && g.phase === 'wave' && g.wave === 2) {
        took = g.steps;
        rec.control('you');
      }
      if (took < 0) bot.act(g, io);
      else playerAct(g, rec);
      if (g.phase === 'wave') step(g, SIM_DT);
    }
    const mixed = rec.finish('quit');
    expect(playKind(mixed)).toBe('mixed');
    // The fit takes only hand-played runs whole.
    expect(playerRun(mixed)).toBeNull();
    // The same inputs as a hand-played run (no control): taken.
    const hand = { ...mixed, control: undefined, commands: mixed.commands.filter((c) => c[1] !== 'c') } as PlayLog;
    delete hand.control;
    expect(playKind(hand)).toBe('full playtest');
    // (The fit wants a run that reached wave 5; this one is cut short.)
    expect(playerRun({ ...hand, summary: { ...hand.summary!, wave: 6 } })).toBe('card');
    expect(playerRun({ ...mixed, summary: { ...mixed.summary!, wave: 6 } })).toBeNull();
    // Tap rhythm from the player's ticks only: the bot's taps before the
    // take-over are not the player's.
    const taps = mixed.commands.filter((c) => c[1] === 't' || c[1] === 'd');
    const theirs = taps.filter((c) => c[0] >= took).length;
    const m = measure(mixed, 'you', { react: false });
    const all = measure(hand, 'you', { react: false });
    expect(m.bursts.reduce((a, b) => a + b, 0)).toBe(theirs);
    expect(all.bursts.reduce((a, b) => a + b, 0)).toBe(taps.length);
    expect(theirs).toBeLessThan(taps.length);
    expect(m.realSec).toBeLessThan(all.realSec);
    // The lab's documents say how a run was played; the page's averages
    // count the hand-played runs only.
    const result = { verdict: null, tags: [], note: '', waves: g.wave, ended: 'done' as const, stats: { kills: 0, shots: 0, lost: 0, leaked: 0, weaponUses: 0 } as never, plays: 'full' as const };
    const runs = mapRuns([
      { ...mixed, labResult: { ...result, played: 'mixed' } },
      { ...hand, id: 'hand', labResult: result },
    ]);
    expect(runs.filter((r) => r.played === 'mixed').length).toBe(1);
    const nums = runNumbers(runs as never);
    expect(nums.runs).toBe(1);
    expect(nums.bot).toBe(1);
  });

  it('a log with no bot reads as a full playtest; a dev watch log or a sweep log as sim', () => {
    const { g, rec } = watchRun('strait', 3, false);
    for (let n = 0; n < 600; n++) {
      playerAct(g, rec);
      step(g, SIM_DT);
    }
    const log = rec.finish('quit');
    expect(log.control).toBeUndefined();
    expect(playKind(log)).toBe('full playtest');
    expect(log.notes).toBeUndefined();
    expect(playKind({ ...log, dev: { preset: 'sim', watch: true } })).toBe('sim');
    expect(playKind({ ...log, device: { ...log.device, ua: 'mimic' } })).toBe('sim');
    expect(playKind({ ...log, dev: { preset: 'half', watch: true }, commands: [...log.commands, [300, 'c', 'you']] })).toBe('mixed');
  });
});
