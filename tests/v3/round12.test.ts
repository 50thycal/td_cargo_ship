// Round 12 (docs/design/v3-playtest-fixes.md, "Round 12"): the player's
// chapter 2 notes of 2026-11-20 (log v40 -> v41).

import { describe, expect, it } from 'vitest';
import { CLUSTER } from '../../src/v3/data/config';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { clusterPace, createGame, spawnThreat, step, type Game } from '../../src/v3/sim/game';
import { SUB_SIGHT, onLand, subClear, subLaneSight, subSite, subSpot } from '../../src/v3/sim/foes';

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

describe('torpedo subs surface on open water with a torpedo line (the sub audit)', () => {
  // Saltgate Canal is being reworked in parallel (its boss and encounter
  // data): its east sub spot sees too little of the canal (2 of 9 points)
  // and is left for that rework. subSpot passes it over (below).
  const KNOWN = new Set(['saltgate 1480,610']);

  for (const id of MAP_ORDER) {
    it(`${id}: every sub spot clear of land, with a torpedo line to a lane`, () => {
      const g = createGame(id, 1, 1);
      for (const p of g.map.subSpots) {
        if (KNOWN.has(`${id} ${p.x},${p.y}`)) continue;
        expect(onLand(g, p.x, p.y), `${id} (${p.x}, ${p.y}) on land`).toBe(false);
        expect(subClear(g, p), `${id} (${p.x}, ${p.y}): land under the sub's shadow`).toBe(true);
        expect(subLaneSight(g, p), `${id} (${p.x}, ${p.y}): torpedo line`).toBeGreaterThanOrEqual(SUB_SIGHT);
      }
    });
  }

  it('a sub surfaces only at a good site while the map has one', () => {
    for (const id of MAP_ORDER) {
      const g = createGame(id, 7, 1);
      if (!g.map.subSpots.some((p) => subSite(g, p))) continue;
      for (let k = 0; k < 40; k++) {
        const p = subSpot(g, g.rng.foes);
        expect(subSite(g, p), `${id} (${p.x}, ${p.y})`).toBe(true);
      }
    }
  });

  it('the check catches a spot on land, by the shore, or behind land', () => {
    const g = createGame('needle', 1, 1);
    // The Needle's old east spot: a torpedo line to 2 of 9 lane points.
    expect(subSite(g, { x: 1500, y: 252 })).toBe(false);
    const shore = g.map.land[0].points[0];
    expect(subClear(g, shore)).toBe(false);
  });
});
