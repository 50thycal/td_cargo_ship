// Trucks keep off each other, and the call-outs off the launchers (log v76;
// docs/design/v3-playtest-fixes.md, "Trucks that overlap"). The player, from
// a Watch run on The Coves: "Trucks should not overlap each other as well,
// the rocket truck and ballistic missile truck were just on top of each
// other. We should audit all maps too ..." and "make sure [the notifications]
// do not go in a place that is on top of enemy launchers so it isn't hidden."

import { describe, expect, it } from 'vitest';
import { PLAYER_ARMORY } from '../../tools/v3/bot-fit/measure';
import { MAP_ORDER, type MapId } from '../../src/v3/data/maps';
import { playReportRun } from '../../src/v3/sim/mapReportPlay';
import { OverlapWatch, overlapDepth, truckBody, truckClear, RAIDER_SCALE } from '../../src/v3/sim/overlap';
import { SIM_DT } from '../../src/v3/sim/playlog';
import { LANES } from '../../src/v3/sim/trucks';
import { boxesHit, stackStand, type Box } from '../../src/v3/ui/alerts';

/** One whole bot run of a map's production card, watched step by step. */
function watched(map: MapId, seed: number): OverlapWatch {
  const watch = new OverlapWatch(SIM_DT);
  let phase = '';
  playReportRun(map, seed, {
    armory: PLAYER_ARMORY,
    onStep: (g) => {
      watch.observe(g);
      phase = g.phase;
    },
  });
  watch.finish();
  // No truck waits for ever: the run ends (the sim's guard is 40 minutes).
  expect(['won', 'lost'], `${map} ${seed} ended`).toContain(phase);
  return watch;
}

describe('truck footprints', () => {
  it('two trucks nose to tail sink in by exactly what they share, side by side by the beam', () => {
    const a = truckBody(1, 'popup', 100, 100, 0, RAIDER_SCALE);
    // One truck length (66 px) apart: touching, not overlapping.
    expect(overlapDepth(a, truckBody(2, 'popup', 100 + 2 * a.hl, 100, 0, RAIDER_SCALE))).toBe(0);
    // Ten px closer: ten deep.
    expect(overlapDepth(a, truckBody(2, 'popup', 100 + 2 * a.hl - 10, 100, 0, RAIDER_SCALE))).toBeCloseTo(10, 5);
    // Side by side, a beam (34 px) apart, touching; 20 px apart, 14 deep.
    expect(overlapDepth(a, truckBody(2, 'popup', 100, 100 + 2 * a.hw, 0, RAIDER_SCALE))).toBe(0);
    expect(overlapDepth(a, truckBody(2, 'popup', 100, 120, 0, RAIDER_SCALE))).toBeCloseTo(2 * a.hw - 20, 5);
    // Crossing at a right angle: they overlap by the smaller half-extent.
    expect(overlapDepth(a, truckBody(2, 'runner', 100, 100, Math.PI / 2, RAIDER_SCALE))).toBeGreaterThan(30);
  });

  it('a truck is clear of another only with air to spare', () => {
    const a = truckBody(1, 'popup', 100, 100, 0, RAIDER_SCALE);
    const near = truckBody(2, 'popup', 100 + 2 * a.hl + 2, 100, 0, RAIDER_SCALE);
    expect(truckClear(truckBody(3, 'popup', 100 + 6 * a.hl, 100, 0, RAIDER_SCALE), [a, near])).toBe(true);
    expect(truckClear(near, [a])).toBe(false);
    expect(truckClear(truckBody(3, 'popup', 100 + 2 * a.hl + 12, 100, 0, RAIDER_SCALE), [a])).toBe(true);
  });
});

describe('the call-outs keep off the launchers', () => {
  const card: Box = { x0: 600, y0: 330, x1: 840, y1: 390 };
  const silo: Box = { x0: 700, y0: 340, x1: 730, y1: 365 };

  it('a stack clear in its corner stays', () => {
    expect(stackStand([card], [{ x0: 10, y0: 10, x1: 40, y1: 40 }], { left: 0, rise: 0 }, 300, 500)).toEqual({ left: 0, rise: 0 });
    expect(boxesHit(card, silo)).toBe(true);
  });

  it('a stack over a silo rises to the nearest place that is clear of it', () => {
    const st = stackStand([card], [silo], { left: 0, rise: 0 }, 300, 500);
    expect(st.left).toBe(0);
    // Up past the silo's top edge, and the air kept.
    expect(st.rise).toBeGreaterThan(0);
    const moved = { ...card, y0: card.y0 - st.rise, y1: card.y1 - st.rise };
    expect(boxesHit(moved, silo, 10)).toBe(false);
    expect(st.rise).toBeLessThan(120);
  });

  it('goes to the other corner when the whole right edge is taken, and covers least when nothing is clear', () => {
    const wall: Box[] = [{ x0: 560, y0: 0, x1: 880, y1: 400 }];
    const st = stackStand([card], wall, { left: 0, rise: 0 }, 300, 500);
    expect(st.left).toBe(1);
    const all: Box[] = [{ x0: 0, y0: 0, x1: 880, y1: 400 }];
    // Nothing is clear: it stays at one place and does not throw.
    expect(stackStand([card], all, { left: 0, rise: 0 }, 300, 500)).toBeDefined();
  });
});

describe('trucks on the roads of every map', () => {
  // Every map's bot run (usual Armory, seed 900) and the seeds that piled trucks up
  // most before log v76 (the audit's list): no two trucks stay on top of each other.
  const runs: [MapId, number][] = [...MAP_ORDER.map((m): [MapId, number] => [m, 900]), ['gauntlet', 904], ['harbor', 905], ['kesh', 904], ['marrow', 905], ['battery', 902], ['crossing', 905], ['needle', 902]];

  it('no sustained truck-on-truck overlap on any map', { timeout: 900_000 }, () => {
    expect(LANES.on).toBe(true);
    const bad: string[] = [];
    for (const [map, seed] of runs) {
      const watch = watched(map, seed);
      for (const e of watch.sustained) bad.push(`${map} ${seed} wave ${e.wave}: ${e.a} + ${e.b} at ${e.x},${e.y} for ${e.secs} s, ${e.depth.toFixed(0)} px deep`);
      // And the audit saw trucks to test.
      expect(watch.seen.size).toBeGreaterThan(0);
    }
    expect(bad).toEqual([]);
  });

  it('with the lanes off (the game before log v76) the same runs do pile up', { timeout: 900_000 }, () => {
    LANES.on = false;
    try {
      let piled = 0;
      const maps: MapId[] = ['kesh', 'harbor', 'marrow', 'battery', 'strait'];
      for (const map of maps) {
        const n = watched(map, 900).sustained.length;
        expect(n, `${map} piled up with the lanes off`).toBeGreaterThan(0);
        piled += n;
      }
      expect(piled).toBeGreaterThanOrEqual(5);
    } finally {
      LANES.on = true;
    }
  });
});
