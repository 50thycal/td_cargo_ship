// Round 12 (docs/design/v3-playtest-fixes.md, "Round 12"): the player's
// chapter 2 notes of 2026-11-20 (log v40 -> v41).

import { describe, expect, it } from 'vitest';
import { CLUSTER } from '../../src/v3/data/config';
import { clusterPace, createGame, spawnThreat, step, type Game } from '../../src/v3/sim/game';

const DT = 1 / 60;
const run = (g: Game, seconds: number, each?: () => void) => {
  for (let i = 0; i < Math.round(seconds / DT) && g.phase === 'wave'; i++) {
    each?.();
    step(g, DT);
  }
};

function quietGame(map: Parameters<typeof createGame>[0] = 'strait', seed = 3): Game {
  const g = createGame(map, seed, 1);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.threats = [];
  run(g, 12);
  g.threats = [];
  g.interceptors = [];
  g.tempo = { ...g.tempo, lossLimit: 999 };
  return g;
}

describe('cluster missiles: a window to shoot them before they split', () => {
  it('climbs off the rail and is armed only after CLUSTER.armAfter', () => {
    expect(CLUSTER.armAfter).toBeGreaterThanOrEqual(1.2);
    expect(CLUSTER.armAfter).toBeLessThanOrEqual(1.5);
    expect(clusterPace(0)).toBeCloseTo(CLUSTER.climbFrom);
    expect(clusterPace(CLUSTER.armAfter)).toBe(1);
    expect(clusterPace(10)).toBe(1);
  });

  for (const off of [40, 120, 190]) {
    it(`launched ${off} px from its ship: still a missile for ${CLUSTER.armAfter} s, then splits`, () => {
      const g = quietGame('strait', 4);
      const s = g.ships[0];
      const c = spawnThreat(g, 'cluster', s.x + off, s.y - 10, 'truck');
      c.target = s.id;
      let alive = 0;
      const bomblets = new Set<number>();
      run(g, 4, () => {
        if (g.threats.some((t) => t.id === c.id && !t.dead)) alive = c.age;
        for (const t of g.threats) if (t.kind === 'bomblet') bomblets.add(t.id);
      });
      // In the air, shootable, for the whole climb; then it splits.
      expect(alive).toBeGreaterThanOrEqual(CLUSTER.armAfter - 2 * DT);
      expect(alive).toBeLessThan(CLUSTER.armAfter + 1);
      expect(bomblets.size).toBeGreaterThan(0); // (one can land in the step it is dropped)
    });
  }

  it('a far launch splits at its range as before (only the climb is new)', () => {
    const g = quietGame('strait', 4);
    const s = g.ships[0];
    const c = spawnThreat(g, 'cluster', s.x, s.y - 600, 'air');
    c.target = s.id;
    let splitD = -1;
    run(g, 8, () => {
      if (splitD < 0 && !g.threats.some((t) => t.id === c.id && !t.dead)) splitD = Math.hypot(c.x - s.x, c.y - s.y);
    });
    expect(splitD).toBeGreaterThan(0);
    expect(splitD).toBeLessThanOrEqual(CLUSTER.splitRange + 10);
  });
});
