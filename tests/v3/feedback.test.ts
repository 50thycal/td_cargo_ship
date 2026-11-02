// Playtest notes and volley ratings: what a run's log carries beyond its
// inputs (sim/feedback.ts), and that none of it changes how the log replays.

import { describe, expect, it } from 'vitest';
import { BURST, DRY_STREAK, Watch, volleyPlan } from '../../src/v3/sim/feedback';
import { BotRun } from '../../src/v3/sim/mimic';
import { Playback, replay, replayTo } from '../../src/v3/sim/playlog';
import { createGame, step } from '../../src/v3/sim/game';

const DT = 1 / 60;

/** A bot game with the recorder watching it frame by frame, as the UI does. */
function watchedRun(map: Parameters<typeof createGame>[0], seed: number, firstWave = 1, waves = 2) {
  const run = new BotRun(map, seed, { firstWave });
  const g = run.game;
  while (!run.done && g.wave < firstWave + waves) {
    run.advance(2);
    run.rec.observe();
  }
  return run;
}

describe('volleys', () => {
  it('groups back-to-back raids of one kind into one volley', () => {
    const g = createGame('gauntlet', 3, 8);
    const raids = [...g.raids].sort((a, b) => a.at - b.at);
    const plan = volleyPlan(g);
    // As many volleys as changes of theme, and every raid in one.
    const changes = raids.filter((r, i) => i === 0 || raids[i - 1].theme !== r.theme).length;
    expect(plan.length).toBe(changes);
    expect(plan.reduce((n, v) => n + v.raids, 0)).toBe(raids.length);
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i].theme).not.toBe(plan[i - 1].theme);
      expect(plan[i].start).toBeGreaterThanOrEqual(plan[i - 1].start);
    }
  });

  it('records each volley as met: when, what it brought, what it did', () => {
    const run = watchedRun('gauntlet', 5, 7, 2);
    const vs = run.rec.watch.volleys;
    expect(vs.length).toBeGreaterThan(4);
    for (const v of vs.slice(0, -1)) {
      expect(v.to).toBeGreaterThan(v.from);
      expect(Object.values(v.threats).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    }
    // In the order they opened.
    for (let i = 1; i < vs.length; i++) expect(vs[i].from).toBeGreaterThanOrEqual(vs[i - 1].from);
    // Every ship sunk counts against a volley.
    expect(vs.reduce((n, v) => n + v.sunk, 0)).toBe(run.game.lost);
    expect(run.rec.watch.closed).toBeGreaterThanOrEqual(vs.length - 1);
  });

  it('a rating lands on its volley and in the log', () => {
    const run = watchedRun('strait', 2, 3, 1);
    const last = run.rec.watch.latest();
    expect(last).not.toBeNull();
    run.rec.rateVolley(last!.index, { difficulty: 4, fun: 5 });
    run.rec.rateVolley(last!.index, { intensity: 3 });
    const log = run.rec.snapshot();
    expect(log.volleys![last!.index].rating).toEqual({ difficulty: 4, fun: 5, intensity: 3 });
  });
});

describe('marked moments', () => {
  it('marks a ship sunk, a carrier hit and a burst of three losses', () => {
    const g = createGame('strait', 1, 1);
    const w = new Watch(g);
    g.lost = 1;
    g.sunkBy.heavy += 1;
    w.observe(g);
    g.carrierHp -= 6;
    w.observe(g);
    g.t += 4;
    g.lost = 3;
    g.sunkBy.strafer += 2;
    w.observe(g);
    const kinds = w.moments.map((m) => m.kind);
    expect(kinds).toEqual(['sunk', 'carrier', 'sunk', 'burst']);
    expect(w.moments[0].text).toContain('heavy');
    expect(w.moments[3].text).toContain(`${BURST.ships} ships`);
    // A fourth loss inside the same ten seconds is no new burst.
    g.lost = 4;
    g.sunkBy.drone += 1;
    w.observe(g);
    expect(w.moments.filter((m) => m.kind === 'burst').length).toBe(1);
  });

  it('marks a run of taps on an empty rack, once per stretch', () => {
    const g = createGame('strait', 1, 1);
    const w = new Watch(g);
    for (let i = 0; i < DRY_STREAK.taps + 4; i++) {
      g.taps.dry += 1;
      g.t += 0.2;
      w.observe(g);
    }
    expect(w.moments.filter((m) => m.kind === 'dry').length).toBe(1);
  });
});

describe('notes', () => {
  it('stamps a note with its step and the game as it stood', () => {
    const run = watchedRun('strait', 4, 5, 1);
    const g = run.game;
    const n = run.rec.note({ where: 'pause', tags: ['hard', 'unfair'], text: 'Heavies from both sides' });
    expect(n.step).toBe(g.steps);
    expect(n.ctx).toMatchObject({ wave: g.wave, lost: g.lost, carrierHp: g.carrierHp, formation: g.formation });
    expect(n.ctx!.weapons.length).toBe(g.slots.length);
    const log = run.rec.snapshot();
    expect(log.notes).toHaveLength(1);
    expect(log.notes![0].text).toBe('Heavies from both sides');
  });

  it('notes, volleys and moments leave the replay exactly as it was', () => {
    const run = watchedRun('gauntlet', 8, 6, 2);
    run.rec.note({ where: 'pause', tags: ['bug'], text: 'x' });
    run.advance(Infinity);
    const log = run.finish();
    expect(log.volleys?.length).toBeGreaterThan(0);
    const g = replay(log);
    expect({ score: g.score, lost: g.lost, wave: g.wave, steps: g.steps }).toEqual({
      score: run.game.score,
      lost: run.game.lost,
      wave: run.game.wave,
      steps: run.game.steps,
    });
  });
});

describe('watch it (playback)', () => {
  it('plays a log on from a step exactly as the run went', () => {
    const run = new BotRun('gauntlet', 21, { firstWave: 6 });
    run.advance(60 * 70);
    const log = run.finish();
    const from = 60 * 30;
    const to = from + 60 * 8;
    const pb = new Playback(log, from);
    while (pb.game.steps < to && pb.advance());
    let upto = log.commands.findIndex((c) => c[0] > to);
    if (upto < 0) upto = log.commands.length;
    const ref = replayTo(log, to, upto);
    const sig = (g: typeof ref) => ({ steps: g.steps, score: g.score, lost: g.lost, shots: g.shots, hp: g.carrierHp, threats: g.threats.length, wave: g.wave });
    expect(sig(pb.game)).toEqual(sig(ref));
  });

  it('stops at the end of the run', () => {
    const run = new BotRun('strait', 3, { firstWave: 9 });
    run.advance(Infinity);
    const log = run.finish();
    const pb = new Playback(log, Math.max(0, run.game.steps - 120));
    let n = 0;
    while (pb.advance() && n < 10000) n++;
    expect(n).toBeLessThan(10000);
    // Let the sim settle onto its last step the same way.
    for (let i = 0; i < 5 && pb.game.phase === 'wave'; i++) step(pb.game, DT);
  });
});
