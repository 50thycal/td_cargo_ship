// The Test Lab review page's map scorecards (tools/v3/test-lab/scores.mjs,
// inlined into the page like split.mjs): the latest score as chips, and the
// averages per category, by encounter version, on the newest card version.

import { describe, expect, it } from 'vitest';
import { SCORECARD, SCORECARD_REV } from '../../src/v3/data/scorecard';
import { EVENT_WAVE } from '../../src/v3/data/events';
import { averageWords, runNumbers, scoreAverages, scoreChips, scoreGroups, waveName, type Run, type ScorecardDef } from '../../tools/v3/test-lab/scores.mjs';

// The scorecard as the page gets it (tools/v3/test-lab/cards.mts).
const SC: ScorecardDef = JSON.parse(JSON.stringify({ rev: SCORECARD_REV, bossFrom: EVENT_WAVE, categories: SCORECARD }));
const cat = (id: string) => SC.categories.find((c) => c.id === id)!;
const run = (o: Partial<Run>): Run => ({ rev: 10, variant: 'v1', end: 'won', ...o });

describe('Test Lab page: a map card\'s scorecard', () => {
  it('the latest score as chips, in the scorecard\'s order, boss rounds as B1-B3', () => {
    expect(waveName(7, 11)).toBe('7');
    expect(waveName(13, 11)).toBe('B3');
    expect(scoreChips(undefined, SC)).toEqual([]);
    expect(scoreChips({ rev: 1, again: 'maybe', best: 12, fun: 4, difficulty: 'too-hard' }, SC)).toEqual([
      { id: 'fun', label: 'Fun', text: '4' },
      { id: 'difficulty', label: 'Difficulty', text: 'Too hard' },
      { id: 'best', label: 'Best wave', text: 'B2' },
      { id: 'again', label: 'Play again', text: 'Maybe' },
    ]);
  });

  it('averages per category with the runs that answered it; a choice row by its values, a wave row by the one picked most', () => {
    const runs = [
      run({ score: { rev: 1, fun: 4, difficulty: 'bit-hard', pacing: 'right', best: 7, again: 'yes' } }),
      run({ score: { rev: 1, fun: 3, difficulty: 'too-hard', best: 7, again: 'yes' } }),
      run({ score: { rev: 1, fun: 5, difficulty: 'right', best: 12, again: 'no' } }),
      run({}), // no scorecard: counts in the numbers, not the averages
      run({ score: { rev: 0, fun: 1 } }), // another scorecard revision: left out
    ];
    const a = scoreAverages(runs, SC);
    expect(a.fun).toEqual({ n: 3, mean: 4 });
    expect(a.difficulty).toMatchObject({ n: 3, mean: 1, near: 'Bit hard' });
    expect(a.pacing).toMatchObject({ n: 1, mean: 0, near: 'Right' });
    expect(a.best).toMatchObject({ n: 3, top: 7, topCount: 2 });
    expect(a.again).toMatchObject({ n: 3, counts: { yes: 2, no: 1 } });
    expect(a.variety).toBeUndefined();
    expect(averageWords(cat('fun'), a.fun, 11)).toBe('4.0');
    expect(averageWords(cat('difficulty'), a.difficulty, 11)).toBe('Bit hard (+1.0)');
    expect(averageWords(cat('pacing'), a.pacing, 11)).toBe('Right (±0.0)');
    expect(averageWords(cat('best'), a.best, 11)).toBe('7 (2 of 3)');
    expect(averageWords(cat('best'), { n: 2, top: 12, topCount: 2, counts: {} }, 11)).toBe('B2');
    expect(averageWords(cat('again'), a.again, 11)).toBe('Yes 2 · No 1');
    expect(averageWords(cat('difficulty'), { n: 2, mean: -1.5, near: 'Too easy', counts: {} }, 11)).toBe('Too easy (−1.5)');
    // Halfway between two answers, the one nearer the middle.
    const half = scoreAverages([run({ score: { rev: 1, pacing: 'too-slow' } }), run({ score: { rev: 1, pacing: 'right' } })], SC);
    expect(averageWords(cat('pacing'), half.pacing, 11)).toBe('Right (−0.5)');
  });

  it('the run numbers: runs, won, mean delivered % and ships lost', () => {
    expect(runNumbers([
      run({ end: 'won', auto: { delivered: 30, deliveredPct: 100, lost: 0, firstLoss: null } }),
      run({ end: 'lost', auto: { delivered: 12, deliveredPct: 67, lost: 6, firstLoss: 4 } }),
      run({ end: 'quit' }),
    ])).toEqual({ runs: 3, won: 1, deliveredPct: 83.5, lost: 3 });
    expect(runNumbers([])).toEqual({ runs: 0, won: 0, deliveredPct: null, lost: null });
  });

  it('groups by encounter version on the newest card version; runs on an older one are counted apart', () => {
    const runs = [
      run({ variant: 'v2', score: { rev: 1, fun: 5 } }),
      run({ variant: 'v10', score: { rev: 1, fun: 1 } }),
      run({ score: { rev: 1, fun: 2 } }),
      run({ variant: undefined, score: { rev: 1, fun: 4 } }),
      run({ variant: 'v2', end: 'lost' }),
      run({ rev: 9, score: { rev: 1, fun: 1 } }),
    ];
    const g = scoreGroups(runs, SC);
    expect(g.rev).toBe(10);
    expect(g.older).toBe(1);
    expect(g.groups.map((x) => x.variant)).toEqual(['v1', 'v2', 'v10']);
    const [v1, v2] = g.groups;
    expect(v1).toMatchObject({ scored: 2, numbers: { runs: 2, won: 2 }, averages: { fun: { n: 2, mean: 3 } } });
    expect(v2).toMatchObject({ scored: 1, numbers: { runs: 2, won: 1 }, averages: { fun: { n: 1, mean: 5 } } });
    // One version only: one group (the page then shows no version headings).
    expect(scoreGroups([run({ score: { rev: 1, fun: 3 } }), run({})], SC).groups).toHaveLength(1);
    expect(scoreGroups(undefined, SC)).toEqual({ rev: 0, groups: [], older: 0 });
  });
});
