// The bot report's numbers (src/v3/sim/mapReport.ts, docs/design/
// v3-map-report.md): the metrics on small hand-made sidecars, and one quick
// run of the real thing.

import { describe, expect, it } from 'vitest';
import { MAPS } from '../../src/v3/data/maps';
import { BUSY, FILLER_WEIGHT } from '../../src/v3/data/encounters';
import { BUDGET_BAND, CLIFF_FLOOR, cliffOf, digestRun, isLaunch, mapReport, slope, stretchOf, stretchRows, tableLaunches, type RunDigest } from '../../src/v3/sim/mapReport';
import { playReportRun } from '../../src/v3/sim/mapReportPlay';
import type { TelEvent, TelPhase, TelemetrySidecar } from '../../src/v3/sim/telemetry';

const strait = MAPS.strait;

/** A sidecar with only what the digest reads: phases (one per wave given)
 *  and events. */
function sidecar(waves: number[], events: Partial<TelEvent>[]): TelemetrySidecar {
  const phases = waves.map((wave, i) => ({ i, wave, kind: wave > 10 ? 'mapEvent' : 'wave', s0: 0, t0: 0 }) as unknown as TelPhase);
  return { phases, events: events.map((e) => ({ s: 0, t: 0, ...e }) as TelEvent) } as unknown as TelemetrySidecar;
}

type Launch = Extract<TelEvent, { k: 'thr+' }>;
const launch = (id: number, p: number, more: Partial<Launch> = {}): Launch => ({ s: 0, t: 0, k: 'thr+', id, p, kind: 'drone', x: 0, y: 0, o: 'base', tg: 1, hp: 1, ...more }) as Launch;

describe('cliffs', () => {
  it('finds the biggest step and the waves that more than double', () => {
    const c = cliffOf([0, 0, 0.1, 0.3, 0.7, 0.8, 1.0, 2.5, 2.6, 2.4]);
    expect(c.step).toEqual({ wave: 8, up: expect.closeTo(1.5, 6) });
    // 0.3 → 0.7 doubles; 1.0 → 2.5 doubles; 0.1 → 0.3 does not (0.1 is under the floor: 0.3 ≤ 2 × 0.25).
    expect(c.doubles.map((d) => d.wave)).toEqual([5, 8]);
  });

  it('floors a quiet wave at a quarter of a ship', () => {
    expect(CLIFF_FLOOR).toBe(0.25);
    expect(cliffOf([0, 0.05, 0.45]).doubles).toEqual([]);
    expect(cliffOf([0, 0.05, 0.55]).doubles.map((d) => d.wave)).toEqual([3]);
  });

  it('a flat curve has no cliff', () => {
    expect(cliffOf(new Array(10).fill(1)).doubles).toEqual([]);
  });
});

describe('a run digested', () => {
  it('counts launches, not children or threats back on the board', () => {
    expect(isLaunch(launch(1, 0))).toBe(true);
    expect(isLaunch(launch(2, 0, { o: 'child', pid: 1 }))).toBe(false);
    expect(isLaunch(launch(3, 0, { o: 'air', pid: 1 }))).toBe(false);
    expect(isLaunch(launch(4, 0, { back: 1 }))).toBe(false);
    expect(isLaunch(launch(5, 0, { o: 'structure' }))).toBe(false);
    const sc = sidecar([1, 2], [launch(1, 0), launch(2, 0, { o: 'sub', from: 99 }), launch(3, 0, { o: 'child', pid: 1 }), launch(4, 1)]);
    const d = digestRun(strait, 1, sc, null);
    expect(d.launches.slice(0, 3)).toEqual([2, 1, 0]);
    expect(d.reached).toEqual([1, 2]);
  });

  it('counts a close call: aimed at a ship, within 1 s of impact, then destroyed', () => {
    const sc = sidecar([3], [
      launch(1, 0), launch(2, 0), launch(3, 0), launch(4, 0), launch(5, 0, { tg: -1 }),
      { k: 'thr-', id: 1, p: 0, why: 'kill' }, // came to 0.6 s: a close call
      { k: 'thr-', id: 2, p: 0, why: 'kill' }, // never nearer than 1.5 s
      { k: 'thr-', id: 3, p: 0, why: 'impact' }, // it hit: not a close call
      { k: 'thr-', id: 4, p: 0, why: 'kill' }, // exactly 1.0 s: counts
      { k: 'thr-', id: 5, p: 0, why: 'kill' }, // aimed at the carrier: not one
    ]);
    const watch = { first: { 1: 8, 2: 9, 3: 5, 4: 6, 5: 7 }, min: { 1: 0.6, 2: 1.5, 3: 0, 4: 1.0, 5: 0.2 } };
    expect(digestRun(strait, 1, sc, watch).close[2]).toBe(2);
  });

  it('reads warning time from launches aimed at a hull, under the cap', () => {
    const sc = sidecar([1], [launch(1, 0), launch(2, 0), launch(3, 0, { tg: -2 }), launch(4, 0), launch(5, 0, { o: 'child', pid: 1 })]);
    const watch = { first: { 1: 6, 2: 10, 3: 4, 4: 99, 5: 1 }, min: {} };
    const d = digestRun(strait, 1, sc, watch);
    expect(d.warnN[0]).toBe(2);
    expect(d.warnSum[0] / d.warnN[0]).toBe(8);
  });

  it('splits each lane in three by distance along it, outside wave 10 and the boss for `core`', () => {
    const len = 1680; // a straight lane: x from -40 to 1640
    expect(stretchOf(100, len)).toBe(0);
    expect(stretchOf(900, len)).toBe(1);
    expect(stretchOf(1500, len)).toBe(2);
    expect(stretchOf(len + 50, len)).toBe(2);
    expect(stretchOf(-10, len)).toBe(0);
    const hit = (p: number, d: number, hp: number, sunk = false) => ({ k: 'hit' as const, p, vt: 's' as const, vid: 1, lane: 0, d, hp, imp: 1, vx: 0, vy: 0, x: 0, y: 0, by: 'drone' as const, amt: hp, dealt: hp, left: 0, dir: 1 as const, ...(sunk ? { sunk: 1 as const } : {}) });
    const sc = sidecar([1, 10, 11], [
      hit(0, 100, 2), hit(0, 900, 3), hit(0, 1500, 5),
      { k: 'ship-', p: 0, id: 1, why: 'sunk', x: 0, y: 0, d: 1500, lane: 0 },
      hit(1, 100, 10), // wave 10: all, not core
      hit(2, 900, 4), // boss round: all, not core
      { k: 'hit', p: 0, vt: 'c', vid: 0, hp: 50 } as Partial<TelEvent>, // the carrier: not a stretch
      { ...hit(0, 100, 7), blk: 'shield' as const }, // blocked
    ]);
    const d = digestRun(strait, 1, sc, null);
    expect(d.stretch.core.hp[0]).toEqual([2, 3, 5]);
    expect(d.stretch.core.sunk[0]).toEqual([0, 0, 1]);
    expect(d.stretch.all.hp[0]).toEqual([12, 7, 5]);
    expect(d.lost[0]).toBe(1);
    const [lane, pooled] = stretchRows([d], 'core');
    expect(lane.hpShare).toEqual([0.2, 0.3, 0.5]);
    expect(lane.hot).toBe(2);
    expect(lane.cold).toBe(0);
    expect(pooled.lane).toBe(-1);
  });

  it('counts a VIP as the game does, and keeps bonus waves apart', () => {
    const sc = sidecar([4], [
      { k: 'ship-', p: 0, id: 1, why: 'sunk', x: 0, y: 0, d: 10, lane: 0, vip: 1 },
      { k: 'ship-', p: 0, id: 2, why: 'delivered', x: 0, y: 0, d: 10, lane: 0 },
      { k: 'ship-', p: 1, id: 3, why: 'sunk', x: 0, y: 0, d: 10, lane: 0 },
    ]);
    sc.phases.push({ i: 1, wave: 4, kind: 'bonusEvent' } as TelPhase);
    const d = digestRun(strait, 1, sc, null);
    expect(d.lost[3]).toBe(3);
    expect(d.lostBonus).toBe(1);
  });
});

/** A digest with the given launches and losses a wave. */
function fake(launches: number[], lost: number[] = []): RunDigest {
  const z = () => new Array(13).fill(0);
  const pad = (xs: number[]) => z().map((_, k) => xs[k] ?? 0);
  const g = () => [[0, 0, 0]];
  return {
    seed: 0, won: false, endWave: 10, reached: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    lost: pad(lost), lostBonus: 0, launches: pad(launches), close: z().map(() => 1), warnSum: z().map((_, k) => 10 - k), warnN: z().map(() => 1),
    waveSec: z().map(() => 60), boardSec: z().map((_, k) => 60 * (k + 1)), kills: z().map(() => 20),
    stretch: { core: { hp: [[1, 4, 5]], sunk: g() }, all: { hp: [[1, 4, 5]], sunk: g() } },
  };
}

describe('the report', () => {
  it('reads the action a wave: threats on the board at a moment, kills a minute', () => {
    const r = mapReport({ map: MAPS.strait, seeds: [0, 1], normal: [fake([]), fake([])], tough: [fake([])] });
    expect(r.normal.action.onBoard[0]).toBeCloseTo(1);
    expect(r.normal.action.onBoard[2]).toBeCloseTo(3);
    expect(r.normal.action.killsMin[0]).toBeCloseTo(20);
    // A wave no run reached reads NaN.
    expect(r.normal.action.onBoard[10]).toBeNaN();
  });

  it('sets the table × scale and the budget ratio to the encounters-off wave', () => {
    expect(tableLaunches(strait, 1)).toBe(Math.round(16 * strait.threatScale));
    const card = fake([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    const base = fake([10, 20, 30, 40, 50, 50, 70, 80, 90, 100]);
    const r = mapReport({ map: strait, seeds: [0], normal: [card], tough: [card], baseline: [base] });
    expect(r.tough.vsBaseline![5]).toBeCloseTo(1.2);
    expect(r.tough.vsBaseline![0]).toBe(1);
    const budget = r.checks.find((c) => c.rule === 'w-budget')!;
    expect(budget.verdict).toBe('FLAG');
    expect(budget.value).toContain('w6');
    const ok = mapReport({ map: strait, seeds: [0], normal: [base], tough: [base], baseline: [base] });
    expect(ok.checks.find((c) => c.rule === 'w-budget')!.verdict).toBe('PASS');
  });

  it('judges cliffs, close calls, stretches and warning time', () => {
    const d = fake(new Array(10).fill(10), [0, 0, 0, 0.2, 0.3, 0.4, 0.5, 2, 2, 2]);
    const r = mapReport({ map: strait, seeds: [0], normal: [d], tough: [d] });
    const by = (rule: string) => r.checks.find((c) => c.rule === rule)!;
    expect(by('w-cliff').verdict).toBe('FLAG');
    expect(r.tough.cliff.doubles.map((x) => x.wave)).toEqual([8]);
    expect(by('w-early').verdict).toBe('PASS');
    expect(by('m-stretches').verdict).toBe('PASS'); // the coldest (early) takes 10%
    expect(by('g-warning').verdict).toBe('PASS'); // 10 s on wave 1 down to 1 s on wave 10
    const even = fake(new Array(10).fill(10));
    even.stretch.core.hp = [[3, 3, 4]];
    const r2 = mapReport({ map: strait, seeds: [0], normal: [even], tough: [even] });
    expect(r2.checks.find((c) => c.rule === 'm-stretches')!.verdict).toBe('FLAG'); // the coldest takes 30%
    expect(r2.checks.find((c) => c.rule === 'w-cliff')!.verdict).toBe('PASS');
  });

  it('a slope falls when the waves warn less', () => {
    expect(slope([10, 9, 8, 7])).toBeCloseTo(-1);
    expect(slope([1, 1, 1])).toBe(0);
  });
});

describe('a quick real report', () => {
  it('plays two seeds of a map and reads every check', () => {
    const t0 = Date.now();
    const seeds = [900, 901];
    const normal = seeds.map((s) => playReportRun('strait', s).digest);
    const tough = seeds.map((s) => playReportRun('strait', s, { tough: true }).digest);
    const baseline = seeds.map((s) => playReportRun('strait', s, { tough: true, noEncounters: true }).digest);
    const r = mapReport({ map: strait, seeds, normal, tough, baseline, bossTarget: 2 });
    // Every seed plays every wave when it can't be lost.
    for (const d of tough) expect(d.reached).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(r.tough.launches[0]).toBeGreaterThan(0);
    // Wave 1 is the shared wave launch for launch, plus its easy filler (log
    // v47) at FILLER_WEIGHT a drone: within the budget's band.
    const filler = BUSY['strait-ranging-opener'].reduce((n, b) => n + b.count, 0) * FILLER_WEIGHT;
    expect(r.tough.launches[0] - r.tough.baseline![0]).toBeCloseTo(filler, 5);
    expect(Math.abs(r.tough.vsBaseline![0] - 1)).toBeLessThanOrEqual(BUDGET_BAND);
    // The action a wave: threats on the board and kills, on every wave played.
    expect(r.normal.action.onBoard[0]).toBeGreaterThan(0.3);
    expect(r.normal.action.killsMin[0]).toBeGreaterThan(5);
    expect(r.checks.map((c) => c.rule)).toEqual(expect.arrayContaining(['w-cliff', 'w-early', 'w-budget', 'm-stretches', 'g-warning', 'w-first', 'w-boss']));
    expect(r.tough.close.slice(2, 10).some((v) => v > 0)).toBe(true);
    expect(Date.now() - t0).toBeLessThan(20_000);
  }, 30_000);
});
