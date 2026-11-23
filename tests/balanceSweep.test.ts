// The balance sweep: the CLI runner, the workshop panel's worker and these
// tests all drive src/sim/playtest/sweep.ts, so a region measured in one is
// the region measured in the others.

import { describe, expect, it, beforeEach } from 'vitest';
import { REGIONS, REGION_ORDER, registerCustomRegion, unregisterCustomRegion } from '../src/data/regions';
import { blankRegion, compileRegion, contentHash, toRegionDef } from '../src/data/regionAuthoring';
import { personasByName, playCampaign, runSweep, sweepCampaigns, maxRoundsFor } from '../src/sim/playtest/sweep';
import { summarize } from '../src/sim/playtest/analyze';
import { PERSONAS } from '../src/sim/playtest/personas';
import { deleteSweeps, listSweeps, saveSweep, useWorkshopStore, type SweepRecord } from '../src/platform/workshopStore';

function lab(id = 'sweepLab') {
  const def = blankRegion(id, REGIONS.missileCoast.start);
  def.name = 'Sweep Lab';
  def.completionRound = 3;
  def.pressure.defaultBudget = { base: 88, perRound: 98, cap: 2750 };
  def.milestones = [
    { round: 1, add: [{ branch: 'missiles', nodeId: 'unguided' }] },
    { round: 2, add: [{ branch: 'missiles', nodeId: 'guided' }] },
  ];
  return def;
}

describe('sweep engine', () => {
  beforeEach(() => unregisterCustomRegion('sweepLab'));

  it('rejects an unknown persona rather than silently running fewer builds', () => {
    expect(() => personasByName(['balanced', 'nobody'])).toThrow(/Unknown persona "nobody"/);
    expect(personasByName(['afk', 'turtle']).map((p) => p.name)).toEqual(['afk', 'turtle']);
  });

  it('caps rounds at the region watermark unless asked otherwise', () => {
    expect(maxRoundsFor(REGIONS.missileCoast)).toBe(8);
    expect(maxRoundsFor(REGIONS.openSeas)).toBe(30);
    expect(maxRoundsFor(REGIONS.missileCoast, 5)).toBe(5);
  });

  it('plays a workshop region end to end and reports win, end reason and money', () => {
    registerCustomRegion(toRegionDef(compileRegion(lab())));
    const r = playCampaign(personasByName(['balanced'])[0], 'seed-a', 'sweepLab', 3);
    expect(r.analysis.roundsPlayed).toBeGreaterThan(0);
    expect(r.analysis.roundsPlayed).toBeLessThanOrEqual(3);
    expect(['region-complete', 'round-cap', 'quota-failed', 'confidence-collapse', 'fleet-wiped']).toContain(r.analysis.endReason);
    expect(r.analysis.cashCurve).toHaveLength(r.analysis.roundsPlayed);
    expect(r.analysis.finalCash).toBe(r.campaign.cash);
    expect(r.campaign.regionId).toBe('sweepLab');
  });

  it('is deterministic: the same region and seed replay identically', () => {
    registerCustomRegion(toRegionDef(compileRegion(lab())));
    const p = personasByName(['afk'])[0];
    const a = playCampaign(p, 'seed-z', 'sweepLab', 3).analysis;
    const b = playCampaign(p, 'seed-z', 'sweepLab', 3).analysis;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('yields once per campaign with a running count, and summarises the lot', () => {
    registerCustomRegion(toRegionDef(compileRegion(lab())));
    const seen: number[] = [];
    let total = 0;
    const summary = runSweep(
      { regionId: 'sweepLab', seeds: 2, personas: personasByName(['afk', 'economist']), rounds: 2 },
      (p) => {
        seen.push(p.done);
        total = p.total;
      },
    );
    expect(seen).toEqual([1, 2, 3, 4]);
    expect(total).toBe(4);
    expect(summary.campaigns).toBe(4);
    expect(summary.personas.map((p) => p.persona).sort()).toEqual(['afk', 'economist']);
    for (const p of summary.personas) {
      expect(p.campaigns).toBe(2);
      expect(p.winRate).toBeGreaterThanOrEqual(0);
      expect(p.winRate).toBeLessThanOrEqual(p.survivalRate);
      expect(p.finalCash.min).toBeLessThanOrEqual(p.finalCash.mean);
      expect(p.finalCash.mean).toBeLessThanOrEqual(p.finalCash.max);
      expect(p.cashCurve.length).toBeGreaterThan(0);
      expect(Object.values(p.endReasons).reduce((a, b) => a + b, 0)).toBe(2);
    }
    const o = summary.overall;
    expect(Object.values(o.endReasons).reduce((a, b) => a + b, 0)).toBe(4);
    expect(o.winRate).toBeLessThanOrEqual(o.survivalRate);
    expect(o.cashCurve.length).toBe(Math.max(...summary.personas.map((p) => p.cashCurve.length)));
  });

  it('can be stopped between campaigns and still summarised', () => {
    registerCustomRegion(toRegionDef(compileRegion(lab())));
    const analyses = [];
    for (const p of sweepCampaigns({ regionId: 'sweepLab', seeds: 5, personas: personasByName(['afk']), rounds: 2 })) {
      analyses.push(p.last.analysis);
      if (p.done === 2) break;
    }
    const summary = summarize(analyses, 'now', REGIONS.missileCoast);
    expect(summary.campaigns).toBe(2);
  });

  it('every shipped persona is available to the panel', () => {
    expect(PERSONAS.length).toBeGreaterThanOrEqual(10);
    expect(REGION_ORDER.length).toBeGreaterThan(0);
  });
});

describe('sweep history store', () => {
  beforeEach(() => useWorkshopStore(null));

  const record = (regionId: string, hash: string, ranAt: string): SweepRecord => ({
    regionId,
    hash,
    regionName: regionId,
    ranAt,
    options: { seeds: 1, personas: ['afk'], rounds: 0 },
    seconds: 1,
    summary: summarize([], ranAt, REGIONS.missileCoast),
  });

  it('keeps sweeps per region, newest first, keyed by content hash', () => {
    saveSweep(record('a', 'h1', '2026-01-01T00:00:00Z'));
    saveSweep(record('a', 'h2', '2026-01-02T00:00:00Z'));
    saveSweep(record('b', 'h9', '2026-01-03T00:00:00Z'));
    expect(listSweeps('a').map((r) => r.hash)).toEqual(['h2', 'h1']);
    expect(listSweeps('b').map((r) => r.hash)).toEqual(['h9']);
    expect(listSweeps('c')).toEqual([]);
    deleteSweeps('a');
    expect(listSweeps('a')).toEqual([]);
    expect(listSweeps('b')).toHaveLength(1);
  });

  it('caps the history so the store cannot grow without bound', () => {
    for (let i = 0; i < 20; i++) saveSweep(record('a', `h${i}`, `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`));
    expect(listSweeps('a').length).toBeLessThanOrEqual(12);
    expect(listSweeps('a')[0].hash).toBe('h19');
  });

  it('a content hash changes with any edit so a stale result is detectable', () => {
    const a = lab();
    const b = lab();
    expect(contentHash(a)).toBe(contentHash(b));
    b.milestones[1].round = 3;
    expect(contentHash(a)).not.toBe(contentHash(b));
  });
});
