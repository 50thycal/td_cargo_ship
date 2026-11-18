// Test Lab round 11's map scorecard (src/v3/data/scorecard.ts; docs/design/
// v3-test-lab.md "Scorecard"): its categories, how a score is cleaned and
// saved from the verdict sheet into the log (v22), how the bridge carries
// it to each map card's results document with the run's three numbers, and
// that a v21 log still replays. Revision 2 (2026-11-17): fewer rows asked,
// the retired ones still read on revision 1 scores, the comparison row, the
// last scores and the wave strip.

import { describe, expect, it } from 'vitest';
import { EVENT_WAVE } from '../../src/v3/data/events';
import { MAP_VARIANT_DEFAULT, SCORECARD, SCORECARD_REV, askedAt, cleanScorecard, reachedBoss, scoreLine, scoreRows, validAnswer, waveChips, waveLabel } from '../../src/v3/data/scorecard';
import { labCard } from '../../src/v3/data/lab';
import { labResultDocs, logVariant, mapRunNumbers, mapRuns } from '../../src/v3/sim/labDocs';
import { LOG_REPLAYS, LOG_VERSION, replaysHere, type PlayLog } from '../../src/v3/sim/playlog';
import type { WaveRecord } from '../../src/v3/sim/game';
import { agoText, defaultSetup, labRunPlan, lastScores, parseLabProgress, shortScore, verdictResult, vsTarget, waveStrip, type LabEntry } from '../../src/v3/ui/lab';

describe('the scorecard: its categories, in data', () => {
  it('keeps every row ever asked, each with an id, a label, a help line and a scale, and a revision', () => {
    expect(SCORECARD_REV).toBe(2);
    expect(SCORECARD.map((c) => c.id)).toEqual(['fun', 'difficulty', 'pacing', 'variety', 'readability', 'mapFeel', 'boss', 'vs', 'again', 'best', 'weakest']);
    for (const c of SCORECARD) {
      expect(c.label.length, c.id).toBeGreaterThan(0);
      expect(c.help.length, c.id).toBeGreaterThan(0);
    }
    const opts = (id: string) => {
      const s = SCORECARD.find((c) => c.id === id)!.scale;
      return s.kind === 'choice' ? s.options.map((o) => o.label) : s.kind;
    };
    expect(opts('difficulty')).toEqual(['Too easy', 'Bit easy', 'Right', 'Bit hard', 'Too hard']);
    expect(opts('pacing')).toEqual(['Too slow', 'Right', 'Too fast']);
    expect(opts('again')).toEqual(['Yes', 'Maybe', 'No']);
    expect(opts('vs')).toEqual(['Worse', 'About the same', 'Better']);
    for (const id of ['fun', 'variety', 'readability', 'mapFeel', 'boss']) expect(opts(id)).toBe('stars');
    expect(opts('best')).toBe('wave');
    expect(SCORECARD.find((c) => c.id === 'variety')!.help).toBe('The waves felt different from each other');
    // A too-little / too-much scale is centred on Right.
    const diff = SCORECARD.find((c) => c.id === 'difficulty')!.scale;
    expect(diff.kind === 'choice' && diff.options.find((o) => o.id === 'right')!.value).toBe(0);
  });

  it('the boss row only once the run reached the boss rounds (wave 11+); the wave chips are 1..N, the boss rounds B1-B3', () => {
    expect(EVENT_WAVE).toBe(11);
    expect(reachedBoss(10)).toBe(false);
    expect(reachedBoss(11)).toBe(true);
    expect(scoreRows(7).map((c) => c.id)).not.toContain('boss');
    expect(scoreRows(13).map((c) => c.id)).toContain('boss');
    expect(waveChips(7).map((w) => w.label)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(waveChips(13).map((w) => w.label).slice(9)).toEqual(['10', 'B1', 'B2', 'B3']);
    expect(waveLabel(12)).toBe('B2');
  });

  it('cleans a score: only valid answers stay, the boss row and waves past the run are dropped, nothing answered is no score', () => {
    expect(cleanScorecard(undefined)).toBeUndefined();
    expect(cleanScorecard({})).toBeUndefined();
    expect(cleanScorecard({ rev: 1 })).toBeUndefined();
    const raw = { fun: 4, difficulty: 'bit-hard', pacing: 'sideways', variety: 6, readability: 0, mapFeel: 2.5, boss: 3, best: 12, weakest: 3, again: 'yes', junk: 1 };
    expect(cleanScorecard(raw, 13)).toEqual({ rev: SCORECARD_REV, fun: 4, difficulty: 'bit-hard', boss: 3, best: 12, weakest: 3, again: 'yes' });
    // A run that ended on wave 7: no boss row, and no wave 12.
    expect(cleanScorecard(raw, 7)).toEqual({ rev: SCORECARD_REV, fun: 4, difficulty: 'bit-hard', weakest: 3, again: 'yes' });
    // A stored score keeps its own revision.
    expect(cleanScorecard({ rev: 7, fun: 2 })).toEqual({ rev: 7, fun: 2 });
    expect(validAnswer(SCORECARD[0], 5)).toBe(true);
    expect(validAnswer(SCORECARD[0], '5')).toBe(false);
    expect(scoreLine({ rev: 1, fun: 4, difficulty: 'bit-hard', best: 12, again: 'maybe' })).toBe('Fun 4 · Difficulty Bit hard · Play again Maybe · Best wave B2');
  });
});

describe('revision 2 (the player\'s approval, 2026-11-17): fewer rows, a comparison, rated relative to the other maps', () => {
  const entry = (at: string, score?: LabEntry['score']): LabEntry => ({ verdict: 'keep', tags: [], note: '', waves: 13, ended: 'length', stats: { came: 0, killed: 0, early: 0, harm: 0, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [] }, at, rev: 1, round: 13, plays: 'full', ...(score ? { score } : {}) });

  it('asks Fun, Difficulty, Boss rounds, the comparison, Play again, Best and Weakest; Pacing, Variety, Readability and Map feel are retired, not asked', () => {
    const retired = SCORECARD.filter((c) => c.retired !== undefined);
    expect(retired.map((c) => [c.id, c.retired])).toEqual([['pacing', 2], ['variety', 2], ['readability', 2], ['mapFeel', 2]]);
    for (const c of retired) {
      expect(askedAt(c, 1)).toBe(true);
      expect(askedAt(c, 2)).toBe(false);
    }
    expect(scoreRows(13, { vsCard: 'map-gauntlet' }).map((c) => c.id)).toEqual(['fun', 'difficulty', 'boss', 'vs', 'again', 'best', 'weakest']);
    // No other map card rated yet: no comparison row.
    expect(scoreRows(13).map((c) => c.id)).toEqual(['fun', 'difficulty', 'boss', 'again', 'best', 'weakest']);
    expect(scoreRows(7).map((c) => c.id)).toEqual(['fun', 'difficulty', 'again', 'best', 'weakest']);
    const vs = SCORECARD.find((c) => c.id === 'vs')!.scale;
    expect(vs.kind === 'choice' && vs.options.map((o) => [o.id, o.value])).toEqual([['worse', -1], ['same', 0], ['better', 1]]);
  });

  it('cleans a revision 1 score keeping its retired rows; a revision 2 score drops them; vsCard stays only beside a valid vs', () => {
    const r1 = { rev: 1, fun: 4, pacing: 'right', variety: 3, readability: 5, mapFeel: 2, again: 'yes' };
    expect(cleanScorecard(r1)).toEqual(r1);
    expect(cleanScorecard(r1, 13)).toEqual(r1);
    expect(scoreLine(cleanScorecard(r1))).toBe('Fun 4 · Pacing Right · Variety 3 · Readability 5 · Map feel 2 · Play again Yes');
    expect(cleanScorecard({ rev: 2, fun: 4, pacing: 'right', readability: 5 })).toEqual({ rev: 2, fun: 4 });
    expect(cleanScorecard({ rev: 2, vs: 'better', vsCard: 'map-gauntlet' })).toEqual({ rev: 2, vs: 'better', vsCard: 'map-gauntlet' });
    expect(cleanScorecard({ rev: 2, fun: 3, vs: 'much', vsCard: 'map-gauntlet' })).toEqual({ rev: 2, fun: 3 });
    expect(cleanScorecard({ rev: 2, fun: 3, vsCard: 'map-gauntlet' })).toEqual({ rev: 2, fun: 3 });
    expect(cleanScorecard({ rev: 2, vsCard: 'map-gauntlet' })).toBeUndefined();
    expect(scoreLine({ rev: 2, fun: 5, vs: 'same', vsCard: 'map-gauntlet' })).toBe('Fun 5 · Vs map-gauntlet About the same');
    expect(scoreLine({ rev: 2, vs: 'worse' })).toBe('Vs last map Worse');
  });

  it('Save keeps the comparison with the card it named; a draft from before cannot carry a retired row', () => {
    const d = { verdict: 'keep' as const, tags: [], note: '', score: { fun: 4, vs: 'better', pacing: 'right' } };
    expect(verdictResult(d, 13, 'map-gauntlet')).toEqual({ verdict: 'keep', tags: [], note: '', score: { rev: 2, fun: 4, vs: 'better', vsCard: 'map-gauntlet' } });
    expect(verdictResult({ ...d, score: { fun: 4 } }, 13, 'map-gauntlet')!.score).toEqual({ rev: 2, fun: 4 });
  });

  it('compares with the other map card scored most recently; never itself, never a card that is not a map, never an unscored run', () => {
    const p = parseLabProgress(null);
    expect(vsTarget(p, 'map-strait')).toBeUndefined();
    p.results['map-strait'] = [entry('2026-11-17T09:00:00Z', { rev: 2, fun: 5 })];
    p.results.rocketTruck = [entry('2026-11-17T08:00:00Z', { rev: 2, fun: 5 })];
    p.results['map-kesh'] = [entry('2026-11-17T10:00:00Z')];
    expect(vsTarget(p, 'map-strait')).toBeUndefined();
    p.results['map-harbor'] = [entry('2026-11-15T09:00:00Z', { rev: 1, fun: 5, difficulty: 'right', again: 'yes' })];
    p.results['map-gauntlet'] = [entry('2026-11-16T09:00:00Z', { rev: 2, fun: 3 }), entry('2026-11-10T09:00:00Z', { rev: 1, fun: 1 })];
    expect(vsTarget(p, 'map-strait')).toBe('map-gauntlet');
    expect(vsTarget(p, 'map-gauntlet')).toBe('map-strait');
  });

  it('the last scores: this map\'s latest (any revision), then each other map card\'s latest, newest first, four at most', () => {
    const p = parseLabProgress(null);
    const now = Date.parse('2026-11-17T12:00:00Z');
    expect(lastScores(p, 'map-strait', now)).toEqual([]);
    p.results['map-strait'] = [entry('2026-11-14T12:00:00Z', { rev: 1, fun: 4, difficulty: 'bit-hard', pacing: 'right', again: 'maybe' }), entry('2026-11-16T12:00:00Z')];
    p.results['map-harbor'] = [entry('2026-11-15T12:00:00Z', { rev: 2, fun: 5, difficulty: 'right', again: 'yes' })];
    p.results['map-gauntlet'] = [entry('2026-11-17T11:00:00Z', { rev: 2, best: 7 })];
    p.results['map-kesh'] = [entry('2026-11-01T12:00:00Z', { rev: 1, fun: 2 })];
    p.results['map-sowers'] = [entry('2026-10-01T12:00:00Z', { rev: 1, fun: 1 })];
    p.results.rocketTruck = [entry('2026-11-17T11:30:00Z', { rev: 2, fun: 5 })];
    const lines = lastScores(p, 'map-strait', now);
    expect(lines.map((l) => [l.id, l.mine, l.text])).toEqual([
      ['map-strait', true, 'Fun 4 · Bit hard · Again maybe'],
      ['map-gauntlet', false, 'Best 7'],
      ['map-harbor', false, 'Fun 5 · Right · Again yes'],
      ['map-kesh', false, 'Fun 2'],
    ]);
    expect(lines[2].name).toBe('Harbor Mouth');
    expect(shortScore({ rev: 2, fun: 5, difficulty: 'right', again: 'yes', vs: 'better' })).toBe('Fun 5 · Right · Again yes');
    expect(agoText('2026-11-17T11:00:00Z', now)).toBe('today');
    expect(agoText('2026-11-15T12:00:00Z', now)).toBe('2 days ago');
    expect(agoText('2026-10-01T12:00:00Z', now)).toBe('6 weeks ago');
  });

  it('the wave strip: ships lost per wave from the run\'s running tally, the wave in play from the tally now, and each wave\'s marked moments once', () => {
    const history = [{ wave: 1, lost: 0 }, { wave: 2, lost: 2 }, { wave: 3, lost: 2 }, { wave: 4, lost: 5 }];
    const moments = [
      { wave: 2, kind: 'sunk' as const },
      { wave: 2, kind: 'sunk' as const },
      { wave: 2, kind: 'debut' as const },
      { wave: 4, kind: 'carrier' as const },
      { wave: 4, kind: 'burst' as const },
      { wave: 5, kind: 'dry' as const },
    ];
    expect(waveStrip(history, 6, 5, moments, 5)).toEqual([
      { n: 1, lost: 0, marks: [] },
      { n: 2, lost: 2, marks: ['debut', 'sunk'] },
      { n: 3, lost: 0, marks: [] },
      { n: 4, lost: 3, marks: ['burst', 'carrier'] },
      { n: 5, lost: 1, marks: ['dry'] },
    ]);
    // A wave with no record and not in play (a run jumped past it) loses none.
    expect(waveStrip([{ wave: 1, lost: 1 }, { wave: 7, lost: 4 }], 4, 7, [], 7).map((w) => w.lost)).toEqual([1, 0, 0, 0, 0, 0, 3]);
  });
});

describe('the sheet saves it, and the log carries it', () => {
  it('Save keeps the scorecard with the verdict; skipped or blank keeps none; the verdict is still asked for', () => {
    const d = { verdict: 'keep' as const, tags: [], note: '', score: { fun: 4, best: 11, boss: 5 } };
    expect(verdictResult(d, 13)).toEqual({ verdict: 'keep', tags: [], note: '', score: { rev: SCORECARD_REV, fun: 4, best: 11, boss: 5 } });
    expect(verdictResult(d, 8)).toEqual({ verdict: 'keep', tags: [], note: '', score: { rev: SCORECARD_REV, fun: 4 } });
    expect(verdictResult({ ...d, skipScore: true }, 13)).toEqual({ verdict: 'keep', tags: [], note: '' });
    expect(verdictResult({ ...d, score: {} }, 13)).toEqual({ verdict: 'keep', tags: [], note: '' });
    // Not a full map run: no scorecard at all.
    expect(verdictResult(d)).toEqual({ verdict: 'keep', tags: [], note: '' });
    expect(verdictResult({ ...d, verdict: null }, 13)).toBeNull();
  });

  it('a map card\'s run says which encounter version it plays (v1 for now); other cards none', () => {
    const p = parseLabProgress(null);
    const plan = (id: string) => labRunPlan(labCard(id)!, defaultSetup(labCard(id)!, p), null).lab;
    expect(MAP_VARIANT_DEFAULT).toBe('v1');
    expect(plan('map-strait').variant).toBe('v1');
    expect(plan('map-kesh')).toMatchObject({ plays: 'full', variant: 'v1' });
    expect(labRunPlan(labCard('map-strait')!, { ...defaultSetup(labCard('map-strait')!, p), variant: 'v2' }, null).lab.variant).toBe('v2');
    expect(plan('rocketTruck').variant).toBeUndefined();
  });

  it('the log is version 28 (chapter 1: Kesh and Marrow\'s encounters, lab only); a v27 log still replays here (nothing it played changed), a v26 or older one no longer does', () => {
    expect(LOG_VERSION).toBe(28);
    expect(LOG_REPLAYS).toEqual([27, 28]);
    expect(replaysHere(28)).toBe(true);
    expect(replaysHere(21)).toBe(false);
    expect(replaysHere(22)).toBe(false);
    expect(replaysHere(23)).toBe(false);
    expect(replaysHere(24)).toBe(false);
    expect(replaysHere(25)).toBe(false);
    expect(replaysHere(26)).toBe(false);
    expect(replaysHere(27)).toBe(true);
    expect(replaysHere(20)).toBe(false);
  });
});

// ---- The bridge --------------------------------------------------------------

const stats = { came: 0, killed: 0, early: 0, harm: 0, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [] };
const wave = (n: number, lost: number, delivered: number): WaveRecord => ({ wave: n, lost, delivered } as WaveRecord);
function mapLog(id: string, at: string, o: { end?: PlayLog['end']; lost?: number; delivered?: number; waves?: WaveRecord[]; score?: unknown; variant?: string; rev?: number; v?: number; plays?: 'full' | 'slice' } = {}): PlayLog {
  const plays = o.plays ?? 'full';
  const lost = o.lost ?? 0;
  const delivered = o.delivered ?? 10;
  const waves = o.waves ?? [wave(1, 0, 2)];
  return {
    v: o.v ?? 22,
    game: 'v3',
    id,
    armory: {},
    build: 't',
    startedAt: at,
    endedAt: at,
    map: 'strait',
    seed: 1,
    firstWave: plays === 'full' ? 1 : 5,
    device: { w: 1, h: 1, dpr: 1, touch: false, ua: '' },
    commands: [],
    end: o.end ?? 'won',
    lab: { card: 'map-strait', rev: o.rev ?? 10, round: 10, plays, ...(o.variant ? { variant: o.variant } : {}) },
    labResult: { verdict: 'keep', tags: [], note: '', waves: waves.length, ended: o.end === 'lost' ? 'lost' : 'length', stats, rev: o.rev ?? 10, round: 10, plays, ...(o.score ? { score: o.score as never } : {}), ...(o.variant ? { variant: o.variant } : {}) },
    summary: { score: 0, wave: waves.length, cleared: o.end !== 'lost', endless: false, delivered, lost, carrierHp: 1, shots: 0, steps: 1, seconds: 1, levels: {}, uses: {}, drafts: [], waves },
  } as PlayLog;
}

describe('the bridge carries the scorecard to each map card\'s results document', () => {
  it('three numbers per full run, from the summary: delivered %, ships lost, the wave of the first loss', () => {
    expect(mapRunNumbers(mapLog('a', '2026-11-14T01:00:00Z', { lost: 0, delivered: 30 }))).toEqual({ delivered: 30, deliveredPct: 100, lost: 0, firstLoss: null });
    const lost = mapLog('b', '2026-11-14T01:00:00Z', { end: 'lost', lost: 6, delivered: 18, waves: [wave(1, 0, 2), wave(2, 0, 4), wave(3, 1, 6), wave(4, 6, 18)] });
    expect(mapRunNumbers(lost)).toEqual({ delivered: 18, deliveredPct: 75, lost: 6, firstLoss: 3 });
    // A loss in the wave still in play (no record for it yet) is that wave's.
    expect(mapRunNumbers(mapLog('c', 'x', { end: 'quit', lost: 1, delivered: 3, waves: [wave(1, 0, 2), wave(2, 0, 3)] }))?.firstLoss).toBe(2);
    expect(mapRunNumbers(mapLog('d', 'x', { plays: 'slice' }))).toBeUndefined();
    expect(mapRunNumbers({ ...mapLog('e', 'x'), summary: undefined })).toBeUndefined();
  });

  it('the latest run\'s variant, score and numbers, every full run for the averages, and the score in the history', () => {
    const old = mapLog('r10', '2026-11-13T09:00:00Z', { score: { rev: 1, fun: 2 } });
    const a = mapLog('a', '2026-11-14T01:00:00Z', { score: { rev: 1, fun: 3, difficulty: 'right', best: 12 }, lost: 2, delivered: 18, waves: [wave(1, 0, 2), wave(2, 2, 4)] });
    const b = mapLog('b', '2026-11-14T02:00:00Z', { score: { rev: 1, fun: 5, pacing: 'too-fast', bogus: 'x' }, variant: 'v2' });
    const c = mapLog('c', '2026-11-14T03:00:00Z');
    const slice = mapLog('s', '2026-11-14T04:00:00Z', { plays: 'slice', score: { rev: 1, fun: 1 } });
    // An older round of the same card goes into the history.
    old.labResult!.round = 9;
    old.lab!.round = 9;
    const doc = labResultDocs([old, a, b, c, slice]).results['map-strait'];
    // The latest result is the slice (its own setup, no score or variant).
    expect(doc.log).toBe('s');
    expect(doc.score).toBeUndefined();
    expect(doc.variant).toBeUndefined();
    expect(doc.runs!.map((r) => r.log)).toEqual(['c', 'b', 'a', 'r10']);
    expect(doc.runs![1]).toMatchObject({ variant: 'v2', end: 'won', score: { rev: 1, fun: 5, pacing: 'too-fast' } });
    expect(doc.runs![1].score).not.toHaveProperty('bogus');
    expect(doc.runs![2]).toMatchObject({ variant: 'v1', auto: { lost: 2, deliveredPct: 90, firstLoss: 2 }, score: { best: 12 } });
    expect(doc.runs![0].score).toBeUndefined();
    expect(doc.history[0]).toMatchObject({ round: 9, plays: 'full', variant: 'v1', score: { rev: 1, fun: 2 } });
    // Without the slice, the latest full run carries its own.
    const doc2 = labResultDocs([a, b]).results['map-strait'];
    expect(doc2).toMatchObject({ log: 'b', variant: 'v2', score: { fun: 5 }, auto: { deliveredPct: 100, lost: 0, firstLoss: null } });
    expect(mapRuns([a, b, slice]).map((r) => r.log)).toEqual(['b', 'a']);
  });

  it('old logs still read: a v21 map run (no variant, no score) is v1 with its numbers; other cards carry none of it', () => {
    const v21 = mapLog('old', '2026-11-13T09:00:00Z', { v: 21 });
    expect(logVariant(v21)).toBe('v1');
    const doc = labResultDocs([v21]).results['map-strait'];
    expect(doc).toMatchObject({ variant: 'v1', auto: { deliveredPct: 100 }, runs: [{ log: 'old', variant: 'v1' }] });
    expect(doc.score).toBeUndefined();
    const enemy = { ...mapLog('e', 'x'), lab: { card: 'decoy', length: 'full', mix: 'normal' } } as PlayLog;
    const ed = labResultDocs([enemy]).results.decoy;
    expect(ed.runs).toBeUndefined();
    expect(ed.variant).toBeUndefined();
    expect(ed.auto).toBeUndefined();
  });
});
