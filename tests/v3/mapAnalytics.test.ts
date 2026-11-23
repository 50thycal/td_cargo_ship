// Map analytics (docs/design/v3-map-convoy-lab-plan.md, slice 2): the
// layers, their filters and their normalisations. The gate asks for tests
// of aggregation, zero denominators, thin cells and event-phase windows,
// for markers that match the replay, and for a known scripted loss
// explained from launcher to impact.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SUB } from '../../src/v3/data/config';
import { createGame, step, type Game } from '../../src/v3/sim/game';
import { ALL, GRID, LAYERS, THIN_SECONDS, cellOf, diff, exposure, histogram, layer, spans, summarize, timeline, trace, type RunData } from '../../src/v3/sim/mapAnalytics';
import { LOG_VERSION, Playback, logTelemetry, replay, type PlayLog } from '../../src/v3/sim/playlog';
import type { TelEvent, TelPhase, TelSample, TelemetrySidecar } from '../../src/v3/sim/telemetry';

const DIR = 'tests/v3/fixtures/map-lab';
const stored = (id: string): PlayLog => JSON.parse(readFileSync(`${DIR}/${id}.json`, 'utf8'));
const runOf = (id: string): RunData => {
  const log = stored(id);
  const g = replay(log, { telemetry: true });
  return { id, label: id, sidecar: g.tel!.sidecar(g), log };
};

/** A sidecar made by hand: two stretches (wave 1 for 20 s, then a bonus
 *  wave for 10 s), one ship crossing three cells, a few events. */
function synthetic(over: Partial<{ events: TelEvent[]; samples: TelSample[] }> = {}): RunData {
  const phase = (i: number, wave: number, kind: TelPhase['kind'], t0: number, t1: number): TelPhase => ({ i, wave, kind, s0: t0 * 60, t0, s1: t1 * 60, t1, end: 'cleared', lost0: 0, delivered0: 0, carrier0: 12, afloat0: 0, flow0: 1, formation0: 'pairs', ...(kind === 'bonusEvent' ? { event: 'siren-field' as const, run: 1, runs: 1 } : {}) });
  const b = (t: number) => ({ s: Math.round(t * 60), t, p: t < 20 ? 0 : 1 });
  // The ship sails x = 25 to 325 at 10 units a second along y = 425 (cells 0..6 of row 8), sampled every second.
  const samples: TelSample[] = over.samples ?? Array.from({ length: 29 }, (_, k) => ({ ...b(k + 1), k: 'ship@' as const, v: [7, 25 + 10 * (k + 1), 425] }));
  const events: TelEvent[] = over.events ?? [
    { ...b(0), k: 'ship+', id: 7, lane: 0, slot: 0, x: 25, y: 425, hp: 3, flow: 1, form: 'pairs', len: 1700 },
    { ...b(2), k: 'thr+', id: 50, kind: 'drone', x: 800, y: 100, o: 'base', base: 0, tg: 7, hp: 1 },
    { ...b(3), k: 'thr+', id: 51, kind: 'ballistic', x: 420, y: 620, o: 'sub', from: 900, tg: 7, hp: 1 },
    // A hit in the first cell the ship is barely in, and one further on.
    { ...b(1), k: 'hit', imp: 1, vt: 's', vid: 7, vx: 35, vy: 425, x: 35, y: 425, by: 'drone', src: 50, amt: 1, dealt: 1, hp: 1, left: 2, dir: 1, lane: 0, d: 10, form: 'pairs' },
    { ...b(12), k: 'hit', imp: 2, vt: 's', vid: 7, vx: 145, vy: 425, x: 150, y: 430, by: 'ballistic', src: 51, amt: 1, dealt: 1, hp: 1, left: 1, dir: 1, lane: 0, d: 120, form: 'box' },
    { ...b(11), k: 'cmd', what: 'formation', req: 'box', was: 'pairs', ok: 1, ships: 1, next: 2 },
    { ...b(25), k: 'hit', imp: 3, vt: 'c', vid: 0, vx: 800, vy: 700, x: 800, y: 700, by: 'drone', src: 50, amt: 2, dealt: 2, hp: 2, left: 10, dir: 1 },
    { ...b(5), k: 'pk+', id: 60, kind: 'ammo', x: 610, y: 410, why: 'drop' },
    { ...b(6), k: 'pk-', id: 60, kind: 'ammo', x: 610, y: 410, why: 'collected', age: 1 },
    { ...b(7), k: 'pk+', id: 61, kind: 'repair', x: 620, y: 420, why: 'drop' },
    { ...b(12), k: 'pk-', id: 61, kind: 'repair', x: 620, y: 420, why: 'expired', age: 5 },
    { ...b(6), k: 'tap', x: 610, y: 410, r: 30, res: 'pickup', pk: 60, a0: 6, a1: 6 },
    { ...b(8), k: 'tap', x: 700, y: 200, r: 30, res: 'fire', thr: 50, a0: 6, a1: 5 },
    { ...b(9), k: 'tap', x: 705, y: 205, r: 30, res: 'dry', thr: 50, a0: 0, a1: 0 },
    { ...b(9.5), k: 'hurt', id: 50, kind: 'drone', x: 710, y: 210, dmg: 1, left: 0, by: 'gun', tap: 1, kill: 1 },
  ];
  const sidecar = {
    header: { convoy: { policy: 'current', rev: 1, flow: 1, formation: 'pairs', flowSteps: 5, formations: ['column', 'pairs', 'spread', 'box'] } } as TelemetrySidecar['header'],
    phases: [phase(0, 1, 'wave', 0, 20), phase(1, 1, 'bonusEvent', 20, 30)],
    events: events.sort((x, y) => x.s - y.s),
    samples,
    totals: {} as TelemetrySidecar['totals'],
    steps: 1800,
    seconds: 30,
    truncated: false,
    droppedSamples: 0,
  };
  return { id: 'synthetic', label: 'synthetic', sidecar };
}

const row = 8 * GRID.w;

describe('ship-seconds: a ship\'s stretch is laid along its line, and a time window cuts it exactly', () => {
  const run = synthetic();
  it('each cell gets the seconds the ship was in it', () => {
    const ex = exposure([run], ALL);
    // 10 units a second from x = 25: 2.5 s in the first cell, 5 s in each of the next five, to x = 315 at 29 s (seven cells entered).
    expect(ex.seconds[row + 0]).toBeCloseTo(2.5, 1);
    for (const c of [1, 2, 3, 4]) expect(ex.seconds[row + c], `cell ${c}`).toBeCloseTo(5, 1);
    expect(ex.shipMinutes * 60).toBeCloseTo(29, 5);
    expect([...ex.entered].filter((v) => v > 0)).toHaveLength(7);
  });

  it('a window from 2 s to 6 s keeps 4 ship-seconds: half a second in the first cell, 3.5 in the second', () => {
    const ex = exposure([run], { scope: 'all', window: { from: 2, to: 6, base: 'run' } });
    expect(ex.shipMinutes * 60).toBeCloseTo(4, 5);
    expect(ex.seconds[row + 0]).toBeCloseTo(0.5, 1);
    expect(ex.seconds[row + 1]).toBeCloseTo(3.5, 1);
    expect(ex.seconds[row + 2]).toBe(0);
  });

  it('the bonus wave is its own stretch: normal waves keep 20 s of it, the bonus wave 9', () => {
    expect(exposure([run], { scope: 'waves' }).shipMinutes * 60).toBeCloseTo(20, 5);
    expect(exposure([run], { scope: 'bonus' }).shipMinutes * 60).toBeCloseTo(9, 5);
    expect(exposure([run], { scope: 'mapEvent' }).shipMinutes).toBe(0);
    // A window measured from each stretch's own start.
    expect(spans(run.sidecar, { scope: 'all', window: { from: 0, to: 4, base: 'phase' } })).toEqual([[0, 4], [20, 24]]);
  });

  it('a ship that ends between two samples is counted to the moment it ended', () => {
    const cut = synthetic();
    cut.sidecar.events.push({ s: 630, t: 10.5, p: 0, k: 'ship-', id: 7, why: 'sunk', x: 130, y: 425, d: 105, lane: 0, by: 'ballistic' });
    cut.sidecar.samples = cut.sidecar.samples.filter((s) => s.t <= 10);
    expect(exposure([cut], ALL).shipMinutes * 60).toBeCloseTo(10.5, 5);
  });
});

describe('rates carry their denominators, and thin cells are masked', () => {
  const run = synthetic();
  it('risk: a hit where the ship spent 2.5 s is masked, not shown as an extreme', () => {
    const r = layer([run], ALL, 'traffic', 'risk');
    expect(THIN_SECONDS).toBeGreaterThan(5);
    const first = r.cells[row + 0];
    expect(first).toMatchObject({ v: null, masked: true, num: 1 });
    expect(first.den * 60).toBeCloseTo(2.5, 1);
    // No cell has enough traffic in one crossing: nothing is given a rate, and the top of the scale is 0.
    expect(r.top).toBe(0);
    expect(r.cells.filter((c) => c.masked)).toHaveLength(2);
  });

  it('with enough traffic the same cell gets its rate, and a quiet cell reads zero, not blank', () => {
    // Twenty crossings: 50 s in the first cell, 100 s in the others.
    const many: RunData[] = Array.from({ length: 20 }, (_, k) => ({ ...synthetic(), id: `r${k}` }));
    const r = layer(many, ALL, 'traffic', 'risk');
    expect(r.cells[row + 0].masked).toBe(false);
    expect(r.cells[row + 0].v).toBeCloseTo(20 / (50 / 60), 1);
    expect(r.cells[row + 4]).toMatchObject({ v: 0, masked: false });
    // A cell no ship ever entered has no rate at all.
    expect(r.cells[0]).toMatchObject({ v: null, masked: false });
    expect(r.runs).toBe(20);
  });

  it('damage per launch: one launch is too few for a rate', () => {
    const r = layer([run], ALL, 'sources', 'perLaunch');
    const base = cellOf(800, 100);
    expect(r.cells[base]).toMatchObject({ v: null, masked: true, num: 3, den: 1 });
    expect(layer([run], ALL, 'sources', 'hp').cells[base].v).toBe(3);
  });

  it('pickups: dropped, taken and missed where they dropped; the share taken only with enough of them', () => {
    const c = cellOf(610, 410);
    expect(layer([run], ALL, 'pickups', 'dropped').cells[c].v).toBe(2);
    expect(layer([run], ALL, 'pickups', 'taken').cells[c].v).toBe(1);
    expect(layer([run], ALL, 'pickups', 'missed').cells[c].v).toBe(1);
    expect(layer([run], ALL, 'pickups', 'takenRate').cells[c]).toMatchObject({ v: null, masked: true });
    const many = Array.from({ length: 3 }, (_, k) => ({ ...synthetic(), id: `r${k}` }));
    expect(layer(many, ALL, 'pickups', 'takenRate').cells[c].v).toBeCloseTo(0.5, 6);
  });
});

describe('filters', () => {
  const run = synthetic();
  it('scope: the carrier hit in the bonus wave is not in the normal waves', () => {
    expect(summarize([run], { scope: 'waves' })).toMatchObject({ hpShip: 2, hpCarrier: 0, hits: 2 });
    expect(summarize([run], { scope: 'bonus' })).toMatchObject({ hpShip: 0, hpCarrier: 2, hits: 1 });
    expect(summarize([run], ALL)).toMatchObject({ hpShip: 2, hpCarrier: 2, launches: 2, kills: 1, sailed: 1 });
  });

  it('by attacker, by platform (traced to the launch), by formation at impact', () => {
    expect(summarize([run], { scope: 'all', kinds: ['ballistic'] })).toMatchObject({ hpShip: 1, hpCarrier: 0, launches: 1 });
    const s = summarize([run], ALL);
    expect(s.byPlatform).toEqual({ base: { launches: 1, hp: 3 }, mobile: { launches: 1, hp: 1 }, air: { launches: 0, hp: 0 } });
    expect(s.byFormation).toEqual({ pairs: { hp: 1, sunk: 0 }, box: { hp: 1, sunk: 0 } });
    expect(summarize([run], { scope: 'all', platforms: ['mobile'] }).hpShip).toBe(1);
    expect(summarize([run], { scope: 'all', formation: 'box' })).toMatchObject({ hpShip: 1 });
    // Traffic under a formation is the time that formation was in force (from 11 s on).
    expect(exposure([run], { scope: 'all', formation: 'box' }).shipMinutes * 60).toBeCloseTo(18, 0);
  });

  it('taps and kills, and the weapon behind them', () => {
    expect(layer([run], ALL, 'intercepts', 'taps').total).toBe(1);
    expect(layer([run], ALL, 'intercepts', 'dry').total).toBe(1);
    expect(layer([run], ALL, 'intercepts', 'kills').cells[cellOf(710, 210)].v).toBe(1);
    expect(layer([run], { scope: 'all', weapon: 'railgun' }, 'intercepts', 'kills').total).toBe(0);
    expect(summarize([run], ALL).killsBy).toEqual([['gun', 1]]);
  });

  it('commands are a list in time, with what stood before', () => {
    expect(timeline([run], ALL).map((e) => e.text)).toEqual(['formation: pairs to box (1 ships afloat)']);
  });

  it('every layer has a metric that reads without the others, and its unit', () => {
    for (const l of LAYERS) for (const m of l.metrics) expect(layer([run], ALL, l.id, m.id).unit, `${l.id}/${m.id}`).toBe(m.unit);
  });
});

describe('many runs, and one against another', () => {
  it('runs add up; a run against itself differs nowhere; two scales become one', () => {
    const a = synthetic();
    const b = { ...synthetic(), id: 'b' };
    const one = layer([a], ALL, 'damage', 'hp');
    const two = layer([a, b], ALL, 'damage', 'hp');
    expect(two.total).toBe(one.total * 2);
    expect(layer([a, b], { scope: 'all', runs: ['b'] }, 'damage', 'hp').total).toBe(one.total);
    expect(diff(one, one).top).toBe(0);
    const d = diff(one, two);
    expect(d.top).toBe(2);
    expect(d.scaleTop).toBe(two.top);
  });

  it('how much the runs agree: hull per ship-minute run by run', () => {
    const runs = ['harbor-campaign-tryhard', 'harbor-campaign-you', 'harbor-bonus'].map(runOf);
    const s = summarize(runs, { scope: 'waves' });
    expect(s.runs).toBe(3);
    expect(s.riskByRun!.min).toBeLessThanOrEqual(s.riskByRun!.median);
    expect(s.riskByRun!.median).toBeLessThanOrEqual(s.riskByRun!.max);
    expect(s.risk!).toBeGreaterThan(s.riskByRun!.min - 1e-9);
    expect(s.risk!).toBeLessThan(s.riskByRun!.max + 1e-9);
  }, 30_000);
});

describe('against a real run', () => {
  const run = runOf('gauntlet-campaign-tryhard');
  const sc = run.sidecar;

  it('hull by square adds up to the hull lost: a ship hit just off the board counts in the square at its edge', () => {
    for (const metric of ['hp', 'sinks'] as const) {
      const l = layer([run], ALL, 'damage', metric);
      expect(l.total, metric).toBe(metric === 'hp' ? sc.totals.hpShip + sc.totals.hpCarrier : sc.totals.sunk);
    }
    expect(layer([run], ALL, 'sources', 'hp').total).toBe(sc.totals.hpShip + sc.totals.hpCarrier);
    expect(layer([run], ALL, 'traffic', 'risk').cells.reduce((a, c) => a + c.num, 0)).toBe(sc.totals.hpShip);
  });

  it('the summary under no filter is the sidecar\'s own ledger', () => {
    const s = summarize([run], ALL);
    const t = sc.totals;
    expect(s).toMatchObject({ hits: t.hits, hpShip: t.hpShip, hpCarrier: t.hpCarrier, sunk: t.sunk, sailed: t.sailed, delivered: t.delivered, kills: t.kills, blocked: t.blocked });
    expect(s.pickups.dropped).toBe(t.pickups.spawned);
    expect(s.taps.fire).toBe(sc.events.filter((e) => e.k === 'tap' && e.res === 'fire').length);
    // The stretches partition the run: scope by scope adds to the whole.
    const parts = (['waves', 'mapEvent', 'bonus'] as const).map((scope) => summarize([run], { scope }));
    expect(parts.reduce((a, p) => a + p.hpShip, 0)).toBe(s.hpShip);
    expect(parts.reduce((a, p) => a + p.launches, 0)).toBe(s.launches);
    expect(parts.reduce((a, p) => a + p.shipMinutes, 0)).toBeCloseTo(s.shipMinutes, 3);
  });

  it('ship-seconds from the samples match every step\'s true positions (to 1%)', () => {
    const pb = new Playback(run.log!, 0);
    let truth = 0;
    for (let n = 0; n < 1e7; n++) {
      const more = pb.advance();
      if (pb.game.phase === 'wave') truth += pb.game.ships.length / 60;
      if (!more) break;
    }
    const got = [...exposure([run], ALL).seconds].reduce((a, b) => a + b, 0);
    expect(Math.abs(got - truth) / truth).toBeLessThan(0.01);
  }, 30_000);

  it('markers sit where the replay has the hulls: every hit\'s victim is at its marker', () => {
    const hits = sc.events.filter((e): e is Extract<TelEvent, { k: 'hit' }> => e.k === 'hit' && e.vt === 's' && !e.sunk);
    expect(hits.length).toBeGreaterThan(20);
    const pb = new Playback(run.log!, 0);
    let checked = 0;
    for (const h of hits) {
      while (pb.game.steps < h.s && pb.advance());
      const ship = pb.game.ships.find((s) => s.id === h.vid);
      if (!ship) continue; // sunk later in the same step by another blow
      expect(Math.hypot(ship.x - h.vx, ship.y - h.vy), `hit ${h.imp} at step ${h.s}`).toBeLessThan(0.11);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
  }, 30_000);

  it('the strip under the scrubber: launches, hull and kills over the run', () => {
    const h = histogram([run], ALL, 40, sc.seconds);
    expect(h.launches.reduce((a, b) => a + b, 0)).toBe(summarize([run], ALL).launches);
    expect(h.hp.reduce((a, b) => a + b, 0)).toBe(sc.totals.hpShip + sc.totals.hpCarrier);
  });
});

describe('a known scripted loss, from launcher to impact', () => {
  /** One submarine surfaces off The Strait's lane and fires a salvo of
   *  ballistics at a convoy nobody defends. (The far spot: from the near
   *  one a ballistic's lead ignores its minimum flight time and it lands
   *  behind its ship. Found here, noted in the slice's notes, not changed.) */
  function scripted(): { g: Game; sc: TelemetrySidecar } {
    const g = createGame('strait', 5, 2);
    logTelemetry(g, { id: 'scripted', build: 'test', v: LOG_VERSION, firstWave: 2, device: { w: 0, h: 0, dpr: 1, touch: false, ua: 'test' } }, 'sim', 'none');
    g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    g.raids = [];
    g.raiderQueue = [{ at: 45, kind: 'sub', path: [g.map.subSpots[1]], units: Array.from({ length: SUB.salvo }, () => ({ kind: 'ballistic' as const, size: 1 })) }];
    for (let i = 0; i < 60 * 70; i++) step(g, 1 / 60);
    return { g, sc: g.tel!.sidecar(g) };
  }

  it('the trace reads: the submarine warned, surfaced and fired; the ballistic launched; it landed; the hull it hit', () => {
    const { g, sc } = scripted();
    const hit = sc.events.find((e): e is Extract<TelEvent, { k: 'hit' }> => e.k === 'hit' && e.by === 'ballistic' && e.vt === 's');
    expect(hit, 'the salvo hit a ship').toBeDefined();
    const steps = trace(sc, hit!.imp);
    const whats = steps.map((s) => s.what);
    expect(whats.filter((w) => w === 'platform').length).toBeGreaterThanOrEqual(3);
    expect(whats.indexOf('platform')).toBeLessThan(whats.indexOf('launch'));
    expect(whats.indexOf('launch')).toBeLessThan(whats.indexOf('impact'));
    expect(whats.at(-1)).toBe('victim');
    const spot = g.map.subSpots[1];
    const plat = steps.filter((s) => s.what === 'platform');
    expect(plat.map((s) => s.text)).toEqual(['submarine: warn', 'submarine: surface', 'submarine: fire']);
    for (const p of plat) expect(p).toMatchObject({ x: spot.x, y: spot.y });
    const launch = steps.find((s) => s.what === 'launch')!;
    expect(launch).toMatchObject({ x: spot.x, y: spot.y });
    expect(launch.text).toBe('ballistic launched from sub');
    // The warning the player had: the submarine showed SUB.warn + SUB.surface seconds before it fired.
    expect(launch.t - plat[0].t).toBeGreaterThanOrEqual(SUB.warn + SUB.surface - 0.05);
    const impact = steps.find((s) => s.what === 'impact')!;
    expect(impact.text).toMatch(/^ballistic landed, \d+\.\d s after launch$/);
    // The same loss on the map: counted at the submarine's square as a source, and under the ship as damage.
    const run: RunData = { id: 'scripted', label: 'scripted', sidecar: sc };
    const src = layer([run], ALL, 'sources', 'hp');
    expect(src.cells[cellOf(spot.x, spot.y)].v).toBe(sc.totals.hpShip + sc.totals.hpCarrier);
    expect(src.refs[cellOf(spot.x, spot.y)].some((r) => r.imp === hit!.imp)).toBe(true);
    expect(layer([run], ALL, 'damage', 'hp').cells[cellOf(hit!.vx, hit!.vy)].v).toBeGreaterThanOrEqual(hit!.hp);
  });
});
