// The combo sweep (tools/v3/combo-sweep, docs/design/v3-combo-sweep.md): a
// forced loadout really drafts its weapons, the loss limit read off a tough
// run, and the synergy math on toy cases.

import { describe, expect, it } from 'vitest';
import { PLAYER_ARMORY } from '../../tools/v3/bot-fit/measure';
import { normalOf, pickPlan, playCombo } from '../../tools/v3/combo-sweep/play';
import { predictFromPairs, predictLosses, predictWin, summarize, synergy } from '../../tools/v3/combo-sweep/stats';

describe('forced loadout', () => {
  it('fills the slots first, then levels each in turn', () => {
    expect(pickPlan(['scatter', 'flak'])).toEqual(['scatter', 'flak', 'scatter', 'flak', 'scatter', 'flak']);
  });

  it('drafts exactly the loadout, levelled to MAX, then Resupply', () => {
    const r = playCombo({ map: 'strait', seed: 900, loadout: ['overdrive', 'scatter', 'supplyRun'], armory: PLAYER_ARMORY });
    expect(r.held).toEqual({ overdrive: 3, scatter: 3, supplyRun: 3 });
    expect(r.picks.slice(0, 9)).toEqual(pickPlan(['overdrive', 'scatter', 'supplyRun']));
    expect(r.picks.slice(9).every((p) => p === 'resupply')).toBe(true);
    expect(r.lost).toHaveLength(13);
  });

  it('a first pick then lets the bot draft for itself', () => {
    const r = playCombo({ map: 'strait', seed: 900, loadout: ['tesla'], thenSelf: true, armory: PLAYER_ARMORY });
    expect(r.picks.slice(0, 3)).toEqual(['tesla', 'tesla', 'tesla']);
    expect(r.held.tesla).toBe(3);
    // It takes more weapons of its own once Tesla is MAX.
    expect(Object.keys(r.held).length).toBeGreaterThan(1);
  });

  it('the plain gun takes Resupply at every draft', () => {
    const r = playCombo({ map: 'strait', seed: 900, loadout: [], armory: {} });
    expect(r.held).toEqual({});
    expect(r.picks.every((p) => p === 'resupply')).toBe(true);
  });

  it('the normal run is the tough run cut at the loss limit', () => {
    const tough = playCombo({ map: 'harbor', seed: 901, loadout: [], armory: PLAYER_ARMORY });
    const normal = playCombo({ map: 'harbor', seed: 901, loadout: [], armory: PLAYER_ARMORY, normal: true });
    const read = normalOf(tough.lost);
    expect(read.won).toBe(normal.won);
    expect(read.endWave).toBe(normal.endWave);
    expect(read.lost.slice(0, read.endWave - 1)).toEqual(normal.lost.slice(0, read.endWave - 1));
  });
});

describe('loss limit', () => {
  it('6 ships in waves 1-10 end the run; the boss rounds count afresh', () => {
    expect(normalOf([0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0])).toMatchObject({ won: false, endWave: 8 });
    // 5 in waves 1-10, then 5 more in the boss rounds: won.
    expect(normalOf([1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 2, 2, 1])).toMatchObject({ won: true, endWave: 14 });
    expect(normalOf([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 0])).toMatchObject({ won: false, endWave: 12 });
  });

  it('sums runs up', () => {
    const s = summarize([
      { lost: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], held: {}, picks: [] },
      { lost: [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 3, 3, 3], held: {}, picks: [] },
    ]);
    expect(s.won).toBe(0.5);
    expect(s.flawless).toBe(0.5);
    expect(s.lost10).toBe(3);
    expect(s.boss).toBe(1.5);
    expect(s.lostAll).toBe(7.5);
    expect(s.endWave).toBe(10);
    // Only the won run reached the boss rounds: 0 a round.
    expect(s.bossNormal).toBe(0);
  });
});

describe('synergy', () => {
  it('independent weapons multiply their cuts: zero synergy', () => {
    // Plain gun 20 lost; A halves it, B cuts a quarter: together 20 × 0.5 × 0.75.
    expect(predictLosses(20, [10, 15])).toBeCloseTo(7.5, 9);
    expect(synergy(20, [10, 15], 7.5)).toBeCloseTo(0, 9);
  });

  it('better together is positive, in the way of each other negative', () => {
    expect(synergy(20, [10, 15], 2.5)).toBeCloseTo(5, 9);
    expect(synergy(20, [10, 15], 12)).toBeCloseTo(-4.5, 9);
  });

  it('a triple from its pairs: no synergy left when the pairs explain it', () => {
    // A cuts to 0.5, B to 0.8, C to 0.6; AB has an extra 0.5 together.
    const plain = 10;
    const [a, b, c] = [5, 8, 6];
    const ab = 10 * 0.5 * 0.8 * 0.5;
    const ac = 10 * 0.5 * 0.6;
    const bc = 10 * 0.8 * 0.6;
    const abc = 10 * 0.5 * 0.8 * 0.6 * 0.5;
    expect(predictFromPairs(plain, [a, b, c], [ab, ac, bc])).toBeCloseTo(abc, 9);
  });

  it('win rate: each part cuts the chance of losing', () => {
    // Plain wins 20% (loses 80%); A loses 40%, B 60%: together 0.8 × 0.5 × 0.75 = 30% lose.
    expect(predictWin(0.2, [0.6, 0.4])).toBeCloseTo(0.7, 9);
    expect(predictWin(1, [1, 1])).toBe(1);
  });
});
