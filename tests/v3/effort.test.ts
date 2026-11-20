// The Effort rating (round 11; the player: "add in a rating for me to rate
// how hard I tried, so we know if it was a fluke or if it truly is hard"):
// a 1-5 row on the end-of-run review (the normal game's run rating, and a
// Test Lab map card's scorecard), saved in the log, read by the bot fit.
import { describe, expect, it } from 'vitest';
import { EFFORT_AXIS, LOW_EFFORT, RATING_AXES, RUN_RATING_AXES, lowEffort, runEffort } from '../../src/v3/sim/feedback';
import { SCORECARD_REV, cleanScorecard, scoreCategory, scoreLine, scoreRows } from '../../src/v3/data/scorecard';
import { verdictResult, type VerdictDraft } from '../../src/v3/ui/lab';

describe('the Effort rating', () => {
  it('is a 1-5 row on the whole run only, never on a volley or a wave', () => {
    expect(EFFORT_AXIS).toMatchObject({ id: 'effort', label: 'Effort', low: 'casual / not really trying', high: 'full focus, all-out' });
    expect(RUN_RATING_AXES.map((a) => a.id)).toEqual(['difficulty', 'fun', 'intensity', 'effort']);
    expect(RATING_AXES.map((a) => a.id)).not.toContain('effort');
  });

  it('is a row of the map scorecard, in the same style as Fun and Intensity', () => {
    const c = scoreCategory('effort')!;
    expect(c).toMatchObject({ label: 'Effort', scale: { kind: 'stars' }, low: 'casual / not really trying', high: 'full focus, all-out' });
    expect(scoreRows(7).map((r) => r.id)).toContain('effort');
    expect(cleanScorecard({ rev: SCORECARD_REV, fun: 4, effort: 2 }, 7)).toEqual({ rev: SCORECARD_REV, fun: 4, effort: 2 });
    expect(cleanScorecard({ rev: SCORECARD_REV, effort: 6 }, 7)).toBeUndefined();
    expect(cleanScorecard({ rev: SCORECARD_REV, effort: 0 }, 7)).toBeUndefined();
    // Older revisions never asked it.
    expect(cleanScorecard({ rev: 3, fun: 4, effort: 2 }, 7)).toEqual({ rev: 3, fun: 4 });
    expect(scoreLine({ rev: SCORECARD_REV, fun: 4, effort: 5 })).toBe('Fun 4 · Effort 5');
  });

  it("rides in the Test Lab verdict's score", () => {
    const d: VerdictDraft = { verdict: 'keep', tags: [], note: '', score: { fun: 3, effort: 1 } };
    expect(verdictResult(d, 10)!.score).toEqual({ rev: SCORECARD_REV, fun: 3, effort: 1 });
  });

  it("is read from a log: the run's rating, else the map card's score; low effort is 2 or less", () => {
    expect(runEffort({})).toBeUndefined();
    expect(runEffort({ rating: { fun: 4, effort: 4 } })).toBe(4);
    expect(runEffort({ labResult: { score: { effort: 1 } } })).toBe(1);
    expect(runEffort({ rating: { effort: 9 } })).toBeUndefined();
    expect(LOW_EFFORT).toBe(2);
    expect([1, 2, 3, 5, undefined].map(lowEffort)).toEqual([true, true, false, false, false]);
  });
});
