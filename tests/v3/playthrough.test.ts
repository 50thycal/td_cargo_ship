// Playthrough round: a fresh-save run of the first map, played and read like
// a new player would, found these.

import { describe, expect, it } from 'vitest';
import { RAID } from '../../src/v3/data/config';
import { ARMORY } from '../../src/v3/data/armory';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { createGame, step } from '../../src/v3/sim/game';

describe('every raid the game warns of comes', () => {
  it('no raid is announced without a launch in it (every map, waves 1-10)', () => {
    for (const map of MAP_ORDER)
      for (const wave of [1, 2, 3, 5, 8, 10])
        for (const seed of [1, 2, 3]) {
          const g = createGame(map, seed, wave);
          for (const raid of g.raids) {
            const launches = g.queue.filter((l) => l.at >= raid.at - 0.01 && l.at <= raid.at + RAID.window + 3).length;
            const raiders = g.raiderQueue.filter((r) => r.at <= raid.at + 0.01 && r.at >= raid.at - 15).length;
            expect(launches + raiders, `${map} wave ${wave} seed ${seed}: a ${raid.theme} raid at ${raid.at.toFixed(1)} s`).toBeGreaterThan(0);
          }
        }
  });

  it('the first map\'s first wave has something to shoot within 9 s', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const g = createGame(MAP_ORDER[0], seed, 1);
      let first = -1;
      for (let i = 0; i < 60 * 20 && first < 0; i++) {
        step(g, 1 / 60);
        if (g.threats.length) first = g.waveT;
      }
      expect(first, `seed ${seed}`).toBeGreaterThan(0);
      expect(first, `seed ${seed}`).toBeLessThan(9);
    }
  });
});

describe('the words a player reads', () => {
  it('no Armory card quotes a developer\'s unit (px) or a bare distance', () => {
    for (const id of Object.keys(ARMORY) as (keyof typeof ARMORY)[])
      for (let l = 0; l <= ARMORY[id].max; l++) {
        const text = ARMORY[id].show(l);
        expect(text, `${id} level ${l}`).not.toMatch(/\bpx\b/);
        expect(text, `${id} level ${l}`).not.toMatch(/reach \d/);
      }
  });
});
