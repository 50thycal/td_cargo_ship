// The Test Lab review page's map scorecards (tools/v3/test-lab/scores.mjs,
// inlined into the page like split.mjs): the latest score as chips, and the
// averages per category, by encounter version, on the newest card version.
// Scorecard revision 2 (2026-11-17): a score averages only with its own
// revision's, and the rows revision 2 retired still read on older scores.

import { describe, expect, it } from 'vitest';
import { SCORECARD, SCORECARD_REV } from '../../src/v3/data/scorecard';
import { EVENT_WAVE } from '../../src/v3/data/events';
import { averageWords, runNumbers, scoreAverages, scoreChips, scoreGroups, suggestionsKept, waveName, waveRatingAverages, waveRatingChips, type Run, type ScorecardDef } from '../../tools/v3/test-lab/scores.mjs';

// The scorecard as the page gets it (tools/v3/test-lab/cards.mts).
const SC: ScorecardDef = JSON.parse(JSON.stringify({ rev: SCORECARD_REV, bossFrom: EVENT_WAVE, categories: SCORECARD }));
// The revision 1 cases: the same page as it read them before revision 2.
const SC1: ScorecardDef = { ...SC, rev: 1 };
// And as it read revision 2's (the comparison and the strip).
const SC2: ScorecardDef = { ...SC, rev: 2 };
// And revision 3's (Best moment).
const SC3: ScorecardDef = { ...SC, rev: 3 };
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
      { id: 'again', label: 'Play again', text: 'Maybe' },
      { id: 'best', label: 'Best wave', text: 'B2' },
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
    const a = scoreAverages(runs, SC1);
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
    const half = scoreAverages([run({ score: { rev: 1, pacing: 'too-slow' } }), run({ score: { rev: 1, pacing: 'right' } })], SC1);
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
    const g = scoreGroups(runs, SC1);
    expect(g.rev).toBe(10);
    expect(g.older).toBe(1);
    expect(g.groups.map((x) => x.variant)).toEqual(['v1', 'v2', 'v10']);
    const [v1, v2] = g.groups;
    expect(v1).toMatchObject({ scored: 2, numbers: { runs: 2, won: 2 }, averages: { fun: { n: 2, mean: 3 } } });
    expect(v2).toMatchObject({ scored: 1, numbers: { runs: 2, won: 1 }, averages: { fun: { n: 1, mean: 5 } } });
    // One version only: one group (the page then shows no version headings).
    expect(scoreGroups([run({ score: { rev: 1, fun: 3 } }), run({})], SC1).groups).toHaveLength(1);
    expect(scoreGroups(undefined, SC)).toEqual({ rev: 0, groups: [], older: 0 });
  });

  it('revision 2: its scores average apart from revision 1\'s, retired rows are not averaged on it, the comparison averages by its values', () => {
    // Read as the page read it under revision 2.
    const SC = SC2;
    const runs = [
      run({ score: { rev: 1, fun: 1, pacing: 'too-fast', readability: 2, again: 'no' } }),
      run({ score: { rev: 2, fun: 4, vs: 'better', vsCard: 'map-gauntlet', again: 'yes' } }),
      run({ score: { rev: 2, fun: 5, vs: 'same', vsCard: 'map-harbor', pacing: 'too-slow' } }),
    ];
    const a2 = scoreAverages(runs, SC);
    expect(a2.fun).toEqual({ n: 2, mean: 4.5 });
    expect(a2.again).toMatchObject({ n: 1, counts: { yes: 1 } });
    expect(a2.vs).toMatchObject({ n: 2, mean: 0.5 });
    // Retired on revision 2: not averaged there, even if a score carries it.
    expect(a2.pacing).toBeUndefined();
    expect(a2.readability).toBeUndefined();
    expect(averageWords(cat('vs'), a2.vs, 11)).toBe('About the same (+0.5)');
    // Revision 1's own averages, asked for: its rows, its scores only.
    const a1 = scoreAverages(runs, SC, 1);
    expect(a1.fun).toEqual({ n: 1, mean: 1 });
    expect(a1.pacing).toMatchObject({ n: 1, near: 'Too fast' });
    expect(a1.vs).toBeUndefined();
    const g = scoreGroups(runs, SC).groups[0];
    expect(g).toMatchObject({ scored: 2, oldScored: 1, averages: { fun: { n: 2, mean: 4.5 } } });
    // A revision 1 score still reads as chips, retired rows and all; a
    // revision 2 one shows its comparison.
    expect(scoreChips({ rev: 1, fun: 4, pacing: 'right', mapFeel: 3 }, SC).map((c) => `${c.label} ${c.text}`)).toEqual(['Fun 4', 'Pacing Right', 'Map feel 3']);
    expect(scoreChips({ rev: 2, fun: 4, vs: 'worse', vsCard: 'map-gauntlet' }, SC).map((c) => `${c.label} ${c.text}`)).toEqual(['Fun 4', 'Vs last map Worse']);
  });
});

describe('Test Lab page: scorecard revision 3 (Best moment)', () => {
  it('the page reads revision 3; Best moment averages like a wave row, only on revision 3 scores', () => {
    const SC = SC3;
    const runs = [
      run({ score: { rev: 2, fun: 5, best: 10 } }),
      run({ score: { rev: 3, fun: 4, moment: 10, momentT: 31.5 } }),
      run({ score: { rev: 3, fun: 2, moment: 10, momentT: 60 } }),
      run({ score: { rev: 3, moment: 7 } }),
    ];
    const a3 = scoreAverages(runs, SC);
    expect(a3.fun).toEqual({ n: 2, mean: 3 });
    expect(a3.moment).toMatchObject({ n: 3, top: 10, topCount: 2 });
    expect(averageWords(cat('moment'), a3.moment, 11)).toBe('10 (2 of 3)');
    // Revision 2 never asked it.
    expect(scoreAverages(runs, SC, 2).moment).toBeUndefined();
    expect(scoreChips({ rev: 3, fun: 4, moment: 12, momentT: 8 }, SC).map((c) => `${c.label} ${c.text}`)).toEqual(['Fun 4', 'Best moment B2']);
  });
});

describe('Test Lab page: scorecard revision 4 (the merged review screen)', () => {
  it('the page reads revision 4: Intensity averages like Fun; Best moment is no longer averaged; older revisions average apart', () => {
    expect(SC.rev).toBe(4);
    const runs = [
      run({ score: { rev: 3, fun: 5, moment: 10, momentT: 4 } }),
      run({ score: { rev: 4, fun: 4, intensity: 5, best: 10 } }),
      run({ score: { rev: 4, fun: 2, intensity: 2, best: 10, moment: 3 } }),
    ];
    const a4 = scoreAverages(runs, SC);
    expect(a4.fun).toEqual({ n: 2, mean: 3 });
    expect(a4.intensity).toEqual({ n: 2, mean: 3.5 });
    expect(averageWords(cat('intensity'), a4.intensity, 11)).toBe('3.5');
    expect(a4.moment).toBeUndefined();
    expect(scoreAverages(runs, SC, 3).moment).toMatchObject({ n: 1, top: 10 });
    expect(scoreAverages(runs, SC, 3).intensity).toBeUndefined();
    const g = scoreGroups(runs, SC).groups[0];
    expect(g).toMatchObject({ scored: 2, oldScored: 1 });
    expect(scoreChips({ rev: 4, fun: 4, difficulty: 'right', intensity: 5 }, SC).map((c) => `${c.label} ${c.text}`)).toEqual(['Fun 4', 'Difficulty Right', 'Intensity 5']);
  });

  it('the waves rated on the draft: as chips, averaged wave by wave over the runs, and how the suggested Best and Weakest fared', () => {
    const score = { rev: 4, waves: [{ n: 12, fun: 5, intensity: 5 }, { n: 2, fun: 2, difficulty: 1, note: 'slow' }, { n: 3, note: 'x' }] };
    expect(waveRatingChips(score, 11)).toEqual([
      { id: 'w2', label: '2', text: 'F2 D1', note: 'slow' },
      { id: 'w3', label: '3', text: 'note', note: 'x' },
      { id: 'w12', label: 'B2', text: 'F5 I5' },
    ]);
    expect(waveRatingChips({ rev: 3, fun: 4 }, 11)).toEqual([]);
    expect(waveRatingChips(undefined, 11)).toEqual([]);
    const runs = [
      run({ score: { rev: 4, waves: [{ n: 2, fun: 2 }, { n: 10, fun: 5, intensity: 4 }], best: 10, bestSuggested: 10, weakest: 1, weakestSuggested: 2 } }),
      run({ score: { rev: 4, waves: [{ n: 10, fun: 4, intensity: 5 }] } }),
      run({ score: { rev: 3, fun: 1 } }),
      run({}),
    ];
    expect(waveRatingAverages(runs)).toEqual({ 2: { n: 1, fun: 2 }, 10: { n: 2, fun: 4.5, intensity: 4.5 } });
    expect(waveRatingAverages(undefined)).toEqual({});
    expect(suggestionsKept(runs)).toEqual({ best: { suggested: 1, kept: 1 }, weakest: { suggested: 1, kept: 0 } });
  });
});
