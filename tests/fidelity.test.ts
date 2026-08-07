// Playtest-fidelity probe tests.
//
// The fidelity panel is a MEASURING INSTRUMENT for the playtest harness, so the
// things worth pinning are the ones that would make it lie quietly: a gap
// reported as drift, a missing field reported as a zero, or a probe that only
// notices divergence in one direction. Each test below is a bug that was
// actually possible in a first draft of the panel.

import { describe, expect, it } from 'vitest';
import { buildReport, PROBES, type Log } from '../tools/playtest/fidelityProbes';

/** Minimal log with just enough shape for the probes under test. */
function log(over: Partial<Log> = {}): Log {
  return {
    formatVersion: 4,
    regionId: 'pirateNarrows',
    commanderAbilities: [],
    capacity: 30,
    confidence: 80,
    escorts: 2,
    completedResearch: [],
    drafts: [],
    recoveryTotals: {
      wreckageSpawned: 0,
      wreckageRecovered: 0,
      wreckageExpired: 0,
      recoveryEscortSeconds: 0,
      survivorsSpawned: 0,
      survivorsRescued: 0,
      survivorsLost: 0,
    },
    counterTotals: { manualShots: 0, autoShots: 0, duplicateShots: 0 },
    rounds: [],
    ...over,
  };
}

function round(over: Record<string, unknown> = {}) {
  return {
    round: 1,
    formation: 'tight',
    launched: 20,
    lost: 2,
    deliveredPct: 90,
    ammoUsed: 20,
    warthogUsed: 0,
    scanUsed: 0,
    smokeCloudsLaid: 0,
    enemy: { budget: 500 },
    counters: { stats: { boardingAttempts: 0 } },
    ...over,
  };
}

function probe(id: string, human: Log[], bots: Log[]) {
  const found = buildReport(human, bots, 'test').probes.find((p) => p.id === id);
  if (!found) throw new Error(`no such probe: ${id}`);
  return found;
}

describe('fidelity probe banding', () => {
  it('calls a near-total behaviour gap DIVERGENT, not DRIFT', () => {
    // The failure this pins: banding on |ratio - 1| is asymmetric. A bot doing
    // something 100x LESS than the human scores 0.99, which sits inside a ±40%
    // probe's drift band — so the single most important class of gap (the bots
    // barely touching a system) reported as a shrug.
    const human = [
      log({
        recoveryTotals: {
          wreckageSpawned: 54,
          wreckageRecovered: 44,
          recoveryEscortSeconds: 559,
          survivorsSpawned: 0,
          survivorsRescued: 0,
        },
        rounds: [round(), round()],
      }),
    ];
    const bots = [
      log({
        recoveryTotals: {
          wreckageSpawned: 2062,
          wreckageRecovered: 5,
          recoveryEscortSeconds: 487,
          survivorsSpawned: 0,
          survivorsRescued: 0,
        },
        rounds: [round(), round()],
      }),
    ];
    expect(probe('wreckageRecoveryRate', human, bots).verdict).toBe('divergent');
  });

  it('bands symmetrically — 2x and 0.5x are the same distance', () => {
    const base = (ammo: number) => [log({ rounds: [round({ ammoUsed: ammo })] })];
    const doubled = probe('ammoPerRound', base(20), base(40));
    const halved = probe('ammoPerRound', base(20), base(10));
    expect(doubled.verdict).toBe(halved.verdict);
    expect(doubled.severity).toBeCloseTo(halved.severity, 6);
  });

  it('separates "one side never does this" from a merely large ratio', () => {
    const human = [log({ rounds: [round({ smokeCloudsLaid: 0 })] })];
    const bots = [log({ rounds: [round({ smokeCloudsLaid: 2 })] })];
    expect(probe('smokePerRound', human, bots).verdict).toBe('unexercised');
  });

  it('treats "neither side does this" as a match, not a divergence', () => {
    const none = [log({ rounds: [round({ smokeCloudsLaid: 0 })] })];
    expect(probe('smokePerRound', none, none).verdict).toBe('match');
  });
});

describe('missing data is not zero', () => {
  it('reports no-data rather than inventing a gap when a side lacks the field', () => {
    // An older log saved before a mechanic existed has no denominator for its
    // probe. Reporting that as 0 would manufacture an UNEXERCISED gap against a
    // harness that is actually fine.
    const old = [log({ recoveryTotals: undefined, rounds: [round()] })];
    const current = [
      log({
        recoveryTotals: { wreckageSpawned: 10, wreckageRecovered: 8 },
        rounds: [round()],
      }),
    ];
    const result = probe('wreckageRecoveryRate', old, current);
    expect(result.verdict).toBe('no-data');
    expect(result.human).toBeNull();
  });
});

describe('run-setup diff', () => {
  it('flags a region mismatch and downgrades the whole grade', () => {
    const human = [log({ regionId: 'pirateNarrows', rounds: [round()] })];
    const bots = [log({ regionId: 'openSeas', rounds: [round()] })];
    const report = buildReport(human, bots, 'test');
    const region = report.setup.find((s) => s.key === 'Region');
    expect(region?.same).toBe(false);
    // A setup mismatch means the probe table compares two different games, and
    // the grade has to say so rather than quoting a match count off it.
    expect(report.grade).toContain('SETUP MISMATCH');
  });

  it('derives the enemy roster from the region catalogue, not a hardcoded list', () => {
    const human = [log({ regionId: 'pirateNarrows', rounds: [round()] })];
    const bots = [log({ regionId: 'openSeas', rounds: [round()] })];
    const branches = buildReport(human, bots, 'test').setup.find(
      (s) => s.key === 'Enemy branches available',
    );
    expect(branches?.human).toBe('missiles+mines+attackBoats');
    expect(branches?.bot).toContain('torpedoes');
    expect(branches?.same).toBe(false);
  });

  it('passes the grade when both sides are set up identically', () => {
    const same = [log({ regionId: 'pirateNarrows', rounds: [round()] })];
    const report = buildReport(same, same, 'test');
    expect(report.setup.every((s) => s.same)).toBe(true);
    expect(report.grade).toMatch(/^\d+\/\d+ probes match$/);
  });
});

describe('gap list', () => {
  it('ranks unexercised systems above merely divergent ones', () => {
    const human = [
      log({
        rounds: [round({ smokeCloudsLaid: 0, ammoUsed: 30 })],
        counterTotals: { manualShots: 50, autoShots: 50, duplicateShots: 10 },
      }),
    ];
    const bots = [
      log({
        rounds: [round({ smokeCloudsLaid: 3, ammoUsed: 5 })],
        counterTotals: { manualShots: 100, autoShots: 0, duplicateShots: 0 },
      }),
    ];
    const gaps = buildReport(human, bots, 'test').gaps;
    expect(gaps.length).toBeGreaterThan(1);
    expect(gaps[0].verdict).toBe('unexercised');
    // Severity must be monotonically non-increasing so the list reads as a
    // work queue rather than an unordered pile.
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i - 1].severity).toBeGreaterThanOrEqual(gaps[i].severity);
    }
  });
});

describe('the panel itself', () => {
  it('gives every probe a consequence, not just a description', () => {
    // `why` is what turns the gap list into something actionable. A probe added
    // without one degrades the report into a wall of ratios.
    for (const p of PROBES) {
      expect(p.why.length, `${p.id} needs a why`).toBeGreaterThan(30);
      expect(p.tolerance).toBeGreaterThan(0);
    }
    expect(new Set(PROBES.map((p) => p.id)).size).toBe(PROBES.length);
  });
});
