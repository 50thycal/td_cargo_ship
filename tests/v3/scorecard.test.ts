// Test Lab round 11's map scorecard (src/v3/data/scorecard.ts; docs/design/
// v3-test-lab.md "Scorecard"): its categories, how a score is cleaned and
// saved from the verdict sheet into the log (v22), how the bridge carries
// it to each map card's results document with the run's three numbers, and
// that a v21 log still replays.

import { describe, expect, it } from 'vitest';
import { EVENT_WAVE } from '../../src/v3/data/events';
import { MAP_VARIANT_DEFAULT, SCORECARD, SCORECARD_REV, cleanScorecard, reachedBoss, scoreLine, scoreRows, validAnswer, waveChips, waveLabel } from '../../src/v3/data/scorecard';
import { labCard } from '../../src/v3/data/lab';
import { labResultDocs, logVariant, mapRunNumbers, mapRuns } from '../../src/v3/sim/labDocs';
import { LOG_REPLAYS, LOG_VERSION, replaysHere, type PlayLog } from '../../src/v3/sim/playlog';
import type { WaveRecord } from '../../src/v3/sim/game';
import { defaultSetup, labRunPlan, parseLabProgress, verdictResult } from '../../src/v3/ui/lab';

describe('the scorecard: its categories, in data', () => {
  it('has the ten rows the player asked for, each with an id, a label, a help line and a scale, and a revision', () => {
    expect(SCORECARD_REV).toBe(1);
    expect(SCORECARD.map((c) => c.id)).toEqual(['fun', 'difficulty', 'pacing', 'variety', 'readability', 'mapFeel', 'boss', 'best', 'weakest', 'again']);
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
    expect(scoreLine({ rev: 1, fun: 4, difficulty: 'bit-hard', best: 12, again: 'maybe' })).toBe('Fun 4 · Difficulty Bit hard · Best wave B2 · Play again Maybe');
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

  it('the log is version 25 (round 13: frigates give way, munitions on their launchers, the Nuke); a v24 or older log no longer replays here', () => {
    expect(LOG_VERSION).toBe(25);
    expect(LOG_REPLAYS).toEqual([25]);
    expect(replaysHere(21)).toBe(false);
    expect(replaysHere(22)).toBe(false);
    expect(replaysHere(23)).toBe(false);
    expect(replaysHere(24)).toBe(false);
    expect(replaysHere(25)).toBe(true);
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
