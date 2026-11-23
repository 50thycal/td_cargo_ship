// Log v29 (the player, Lee of Marrow: "with the boss wave have more of a
// pause before it begins ... make it feel more dramatic"): the first boss
// round of every map's three-run ending opens EVENT.bossCalm s later than
// before, with nothing launched; the rounds after it start as they did.
// Log v30 (the player: "have it say 'boss round', then 'live reset', then
// what it is, like 'drone swarm', then 'round one', so each text is like a
// new card pop up"): the intro is a sequence of cards (bossIntroCards), and
// the calm is long enough for all four to read before the first launch.

import { describe, expect, it } from 'vitest';
import { isStructure } from '../../src/v3/data/config';
import { EVENT, EVENTS, EVENT_MAPS, bossIntroCards } from '../../src/v3/data/events';
import type { MapId } from '../../src/v3/data/maps';
import { firstBossRound } from '../../src/v3/sim/events';
import { createGame, step } from '../../src/v3/sim/game';

const DT = 1 / 60;

describe('the boss intro (log v29, cards since v30)', () => {
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

  it('the intro (log v30): BOSS ROUND, the convoy restored, the boss, Round 1 of 3, each card readable before the first launch', () => {
    const cards = bossIntroCards('drone-storm', 1, 3, 6, true);
    expect(cards.map((c) => c.key)).toEqual(['boss', 'restore', 'name', 'round']);
    expect(cards.map((c) => c.title)).toEqual(['Boss round', 'Convoy restored', EVENTS['drone-storm'].name, 'Boss 1/3']);
    expect(cards[1].sub).toBe('6 ships can still be lost');
    expect(cards[3].sub).toBe('Survive the next 3 rounds');
    // One after another, each held EVENT.introCard s (at least 1.5 s to
    // read), the last until the first launch: the breather and the calm.
    expect(EVENT.introCard).toBeGreaterThanOrEqual(1.5);
    cards.forEach((c, k) => {
      expect(c.at).toBeCloseTo(k * EVENT.introCard, 5);
      expect(c.until - c.at).toBeGreaterThanOrEqual(EVENT.introCard);
      if (k) expect(c.at).toBeCloseTo(cards[k - 1].until, 5);
    });
    expect(cards[3].until).toBeCloseTo(EVENT.breather + EVENT.bossCalm, 5);
    // No restore: the second card reads the losses left as they are.
    const none = bossIntroCards('drone-storm', 1, 3, 1, false);
    expect([none[1].title, none[1].sub]).toEqual(['1 ship left', 'can still be lost']);
    // Rounds 2 and 3: one short card.
    for (const run of [2, 3]) {
      const later = bossIntroCards('hydra-bloom', run, 3, 4, true);
      expect(later.map((c) => [c.eyebrow, c.title])).toEqual([[EVENTS['hydra-bloom'].name, `Boss ${run}/3`]]);
      expect(later[0].until).toBeLessThanOrEqual(EVENT.breather);
    }
  });
});
