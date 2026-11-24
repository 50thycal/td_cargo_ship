// The boosts round (docs/design/v3-bot-refit.md, "Boosts"): the "you" bot
// takes a boost in a lull and fires freely under Overdrive; the phase 2 fit
// is kept as you-p2 to compare against. And the combo diversity check's
// overlap math (tools/v3/combo-sweep/diversity.ts).
import { describe, expect, it } from 'vitest';
import { BOT_REV, PERSONAS, YOU, YOU_P2 } from '../../src/v3/sim/mimic';
import { jaccard, spearman } from '../../tools/v3/combo-sweep/diversity';

describe('the boosts round', () => {
  it('"you" plays boosts the player\'s way; you-p2 is phase 2 unchanged', () => {
    expect(YOU.boosts).toBeDefined();
    expect(YOU_P2.boosts).toBeUndefined();
    expect(PERSONAS['you-p2']).toBe(YOU_P2);
    // (Log v69: and `gestures`, the Lance held and the Cutter swiped.)
    const { id: _a, label: _b, blurb: _c, boosts: _d, gestures: _h, ...now } = YOU;
    const { id: _e, label: _f, blurb: _g, ...before } = YOU_P2;
    expect(now).toEqual(before);
    expect(BOT_REV).toBeGreaterThanOrEqual(2);
  });

  it('the personas built on "you" play boosts its way', () => {
    for (const id of ['tryhard', 'casual', 'tired']) expect(PERSONAS[id].boosts).toEqual(YOU.boosts);
  });
});

describe('combo diversity math', () => {
  it('Jaccard of two top lists', () => {
    expect(jaccard(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1);
    expect(jaccard(['a', 'b'], ['c', 'd'])).toBe(0);
    expect(jaccard(['a', 'b', 'c'], ['b', 'c', 'd'])).toBeCloseTo(0.5);
  });

  it('Spearman rank correlation, ties averaged', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(spearman([1, 1, 2, 3], [1, 1, 2, 3])).toBeCloseTo(1);
  });
});
