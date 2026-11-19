// Log v29 (the player, Lee of Marrow: "with the boss wave have more of a
// pause before it begins ... make it feel more dramatic"): the first boss
// round of every map's three-run ending opens EVENT.bossCalm s later than
// before, with nothing launched; the rounds after it start as they did.

import { describe, expect, it } from 'vitest';
import { isStructure } from '../../src/v3/data/config';
import { EVENT, EVENT_MAPS } from '../../src/v3/data/events';
import type { MapId } from '../../src/v3/data/maps';
import { firstBossRound } from '../../src/v3/sim/events';
import { createGame, step } from '../../src/v3/sim/game';

const DT = 1 / 60;

describe('the boss intro (log v29)', () => {
  it('only the first run of a several-run ending is a first boss round', () => {
    expect(firstBossRound({ bonus: false, run: 1, runs: 3 })).toBe(true);
    expect(firstBossRound({ bonus: false, run: 2, runs: 3 })).toBe(false);
    expect(firstBossRound({ bonus: false, run: 1, runs: 1 })).toBe(false);
    expect(firstBossRound({ bonus: true, run: 1, runs: 1 })).toBe(false);
  });

  it('every map with a boss: round 1 waits EVENT.bossCalm s more, and nothing flies until the breather and the calm are over', () => {
    expect(EVENT.bossCalm).toBeGreaterThanOrEqual(3);
    for (const map of Object.keys(EVENT_MAPS) as MapId[]) {
      const g = createGame(map, 5, 11);
      expect(g.event?.run, map).toBe(1);
      const wait = (g.ships.length ? 0 : EVENT.convoyWait) + EVENT.bossCalm;
      expect(g.event!.t0, map).toBeCloseTo(wait, 5);
      // Through the breather and the calm: no launch (a map's own
      // structures, an oil rig, stand as ever).
      while (g.waveT < wait + EVENT.breather - 0.2 && g.phase === 'wave') {
        step(g, DT);
        expect(g.threats.filter((t) => !isStructure(t.kind)).length, `${map} at ${g.waveT.toFixed(1)} s`).toBe(0);
      }
    }
  });
});
