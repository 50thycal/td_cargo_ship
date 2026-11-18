// The fun measures (src/v3/sim/funMetrics.ts, docs/design/v3-fun-metrics.md):
// the copyable game, a hand-made save, the no-op fork, and the tension curve.

import { describe, expect, it } from 'vitest';
import { makeRng } from '../../src/sim/rng';
import {
  CloneRng,
  FUN,
  cloneGame,
  cloneRngOf,
  forkAction,
  forkableGame,
  funOfLog,
  tensionNow,
  tensionStats,
  type Action,
} from '../../src/v3/sim/funMetrics';
import { SIM_DT, applyCommand, replay, type LogCommand, type PlayLog } from '../../src/v3/sim/playlog';
import { spawnThreat, step, timeToImpact, type Game } from '../../src/v3/sim/game';
import { playMimic, YOU_R12 } from '../../src/v3/sim/mimic';
import { runPrint } from '../../src/v3/sim/resume';

describe('a copyable game', () => {
  it('CloneRng draws what makeRng draws, and finds a stream mid-way', () => {
    const a = makeRng(1234);
    const b = CloneRng.of(1234);
    for (let i = 0; i < 50; i++) expect(b.next()).toBe(a.next());
    expect(b.fork('x').next()).toBe(a.fork('x').next());
    const c = cloneRngOf(a, CloneRng.of(1234).s);
    expect(c.next()).toBe(a.next());
  });

  it('a game copied mid-run plays on exactly as the original', () => {
    const { log } = playMimic('strait', 4242, { persona: YOU_R12 });
    const end = replay(log);
    const g = forkableGame(log);
    const cmds = log.commands;
    let i = 0;
    let copy: Game | null = null;
    let at = 0;
    while (g.steps < 6000) {
      while (i < cmds.length && cmds[i][0] <= g.steps) applyCommand(g, cmds[i++]);
      if (g.phase !== 'wave') break;
      if (g.steps === 3000) {
        copy = cloneGame(g);
        at = i;
      }
      step(g, SIM_DT);
    }
    expect(copy).not.toBeNull();
    const c = copy!;
    let j = at;
    for (let guard = 0; guard < 1e7; guard++) {
      while (j < cmds.length && cmds[j][0] <= c.steps) applyCommand(c, cmds[j++]);
      if (c.phase === 'lost') break;
      if (c.phase !== 'wave') {
        if (j >= cmds.length || cmds[j][0] > c.steps) break;
        continue;
      }
      step(c, SIM_DT);
    }
    expect(runPrint(c).hash).toBe(runPrint(end).hash);
    expect(c.lost).toBe(end.lost);
  }, 60_000);
});

/** A board with one ship on 1 hull point and one drone closing on it, about
 *  `secs` from impact, nothing else coming; and the tap that kills it. */
function oneDrone(secs: number): { g: Game; cmd: LogCommand; a: Action } {
  const log: PlayLog = {
    v: 26,
    game: 'v3',
    id: 'fun-test',
    armory: {},
    map: 'strait',
    seed: 77,
    firstWave: 1,
    build: 'test',
    startedAt: new Date(0).toISOString(),
    device: { w: 0, h: 0, dpr: 1, touch: true, ua: 'test' },
    commands: [],
  };
  const g = forkableGame(log);
  // Sail until a ship is well out on the water.
  while (g.phase === 'wave' && !g.ships.some((s) => s.x > 500 && s.x < 1100)) step(g, SIM_DT);
  const ship = g.ships.find((s) => s.x > 500 && s.x < 1100)!;
  g.threats = [];
  g.queue = [];
  g.raids = [];
  g.raiders = [];
  g.raiderQueue = [];
  for (const s of g.ships) s.hp = 3;
  ship.hp = 1;
  const th = spawnThreat(g, 'drone', ship.x, ship.y - 70 * secs, 'base');
  th.target = ship.id;
  th.heading = Math.PI / 2;
  const margin = timeToImpact(g, th);
  const cmd: LogCommand = [g.steps, 't', Math.round(th.x), Math.round(th.y), 60];
  const a: Action = { i: 0, step: g.steps, wave: g.wave, t: g.waveT, what: 'kill', thr: th.id, thrKind: 'drone', margin };
  return { g, cmd, a };
}

describe('saves', () => {
  it('removing a kill that saved a ship is a save', () => {
    const { g, cmd, a } = oneDrone(2.5);
    expect(a.margin).toBeGreaterThan(1.5);
    // Nobody plays on: the tap is the only defence.
    const s = forkAction(g, cmd, a, 'none', 1, 1);
    expect(s).not.toBeNull();
    expect(s!.saved).toBe(1);
    expect(s!.savedAll).toBe(1);
    expect(s!.kind).toBe('kill');
  });

  it('the fork with no change differs by nothing', () => {
    const { g, cmd, a } = oneDrone(2.5);
    const s = forkAction(g, cmd, a, 'you', 2, 1, 'noop', true)!;
    expect(s.saved).toBe(0);
    expect(s.savedAll).toBe(0);
    // And on a real run, every action the scan finds.
    const { log } = playMimic('gauntlet', 31, { persona: YOU_R12 });
    const r = funOfLog(log, { only: (x) => x.wave <= 4, mode: 'noop', judgeAll: true, dice: 2 });
    expect(r.exact).toBe(true);
    expect(r.tested).toBeGreaterThan(0);
    expect(r.judged!.length).toBe(r.tested);
    for (const j of r.judged!) {
      expect(j.perDie).toEqual([0, 0]);
      expect(j.savedAll).toBe(0);
    }
    expect(r.saves).toEqual([]);
  }, 60_000);

  it('the copy at the action is the game as played', () => {
    const { g, cmd } = oneDrone(2.5);
    const c = cloneGame(g);
    applyCommand(g, cmd);
    applyCommand(c, cmd);
    for (let k = 0; k < 120; k++) {
      step(g, SIM_DT);
      step(c, SIM_DT);
    }
    expect(runPrint(c).hash).toBe(runPrint(g).hash);
  });
});

describe('tension', () => {
  it('rises as a threat closes in', () => {
    const { g } = oneDrone(5);
    const readings: number[] = [];
    while (g.phase === 'wave' && g.threats.length && readings.length < 400) {
      readings.push(tensionNow(g));
      step(g, SIM_DT);
    }
    expect(readings.length).toBeGreaterThan(60);
    const early = readings[0];
    const late = readings[readings.length - 5];
    expect(late).toBeGreaterThan(early * 3);
    // Nearly monotone: each second higher than the one before.
    for (let k = 60; k < readings.length - 5; k += 60) expect(readings[k]).toBeGreaterThan(readings[k - 60]);
  });

  it('judges a wave: peaks, release, hot and calm, shape', () => {
    const hot = FUN.hot;
    const flat = tensionStats(new Array(30).fill(0.05));
    expect(flat.shape).toBe('flat');
    expect(flat.calmShare).toBe(1);
    const saw = [0, 0.2, hot * 1.2, 0.1, 0, 0, hot * 1.3, hot * 1.5, 0.2, 0, 0, 0, hot * 2, 0.1, 0, 0, 0, 0, 0, 0];
    const s = tensionStats(saw);
    expect(s.peaks).toBe(3);
    expect(s.shape).toBe('rising');
    expect(s.releaseS).toBeCloseTo((1 + 1 + 1) / 3, 6);
    const pinned = tensionStats(new Array(20).fill(hot * 1.1));
    expect(pinned.shape).toBe('pinned');
    expect(pinned.releaseS).toBe(20);
  });
});
