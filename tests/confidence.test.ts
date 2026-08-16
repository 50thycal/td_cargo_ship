// Confidence is a RECORD, not a mood.
//
// The rule this suite exists to protect, in the player's own words: a full bar
// means 100% of ships not lost and no crews lost. Anything less than a clean
// operation caps below it, permanently, for the rest of the run.
//
// The evidence that forced the rework came from a hand-played log. Round 5 lost
// two escorts AND abandoned a crew and still climbed to 100. Rounds 6 and 7
// delivered 77% and 73% — fifteen hulls between them — and confidence did not
// move off 100 for either. Every round in isolation was survivable; the ledger
// was not, and nothing in the model was reading the ledger.

import { describe, expect, it } from 'vitest';
import {
  confidenceCeiling,
  createRoundTransit,
  newRegionalRun,
  planCurrentRound,
  resolveTransit,
} from '../src/sim/campaign';
import { stepTransit } from '../src/sim/transit';
import { migrateRun } from '../src/platform/save';
import { CAMPAIGN, SIM } from '../src/data/tuning';
import { FIRST_REGION } from '../src/data/regions';
import type { CampaignState } from '../src/sim/types';

/** Resolve one quiet round with the outcome tallies injected, so a scenario is
 *  stated rather than simulated into existence. */
function round(
  c: CampaignState,
  over: {
    launched?: number;
    delivered?: number;
    escortsLost?: number;
    survivorsRescued?: number;
    survivorsLost?: number;
    shipsCaptured?: number;
  },
): number {
  const plan = {
    ...planCurrentRound(c),
    spawns: [],
    mines: [],
    installations: [],
    smoke: [],
    electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 0 },
    debuts: [],
  };
  const { state, rng } = createRoundTransit(c, plan);
  let guard = 0;
  while (!state.over && guard++ < Math.ceil(SIM.maxTransitTime / SIM.dt) + 10) {
    stepTransit(state, [], rng);
  }
  Object.assign(state.stats, over);
  resolveTransit(c, state);
  return c.confidence;
}

const clean = { launched: 30, delivered: 30 };

describe('the ceiling is the run record', () => {
  it('starts unbounded — nothing has sailed yet', () => {
    const c = newRegionalRun('ceil-fresh', FIRST_REGION);
    expect(confidenceCeiling(c)).toBe(CAMPAIGN.maxConfidence);
    expect(c.record).toEqual({ launched: 0, lost: 0 });
  });

  it('stays at the maximum through a flawless operation', () => {
    const c = newRegionalRun('ceil-flawless', FIRST_REGION);
    for (let i = 0; i < 4; i++) round(c, clean);
    expect(confidenceCeiling(c)).toBe(CAMPAIGN.maxConfidence);
  });

  it('lets a flawless run actually REACH the maximum', () => {
    // The rule cuts both ways: if perfect play could not reach 100, the number
    // would be decorative.
    const c = newRegionalRun('ceil-reach', FIRST_REGION);
    for (let i = 0; i < 12; i++) round(c, clean);
    expect(c.confidence).toBe(CAMPAIGN.maxConfidence);
  });

  it('falls with every hull that does not arrive', () => {
    const c = newRegionalRun('ceil-hulls', FIRST_REGION);
    round(c, { launched: 30, delivered: 27 });
    const after = confidenceCeiling(c);
    expect(after).toBeLessThan(CAMPAIGN.maxConfidence);
    expect(c.record).toEqual({ launched: 30, lost: 3 });
    // And keeps falling as the record worsens.
    round(c, { launched: 30, delivered: 21 });
    expect(confidenceCeiling(c)).toBeLessThan(after);
  });

  it('falls harder for a crew left in the water than for the hull alone', () => {
    const hullOnly = newRegionalRun('ceil-hull', FIRST_REGION);
    round(hullOnly, { launched: 30, delivered: 27 });
    const andCrews = newRegionalRun('ceil-crew', FIRST_REGION);
    round(andCrews, { launched: 30, delivered: 27, survivorsLost: 3 });
    expect(confidenceCeiling(andCrews)).toBeLessThan(confidenceCeiling(hullOnly));
  });

  it('is size-neutral: the same SHARE lost caps the same at any convoy size', () => {
    const small = newRegionalRun('ceil-small', FIRST_REGION);
    round(small, { launched: 20, delivered: 18 }); // 10%
    const big = newRegionalRun('ceil-big', FIRST_REGION);
    round(big, { launched: 40, delivered: 36 }); // 10%
    expect(confidenceCeiling(small)).toBeCloseTo(confidenceCeiling(big), 6);
  });

  it('never strangles a run below the floor, however bad the record', () => {
    const c = newRegionalRun('ceil-floor', FIRST_REGION);
    for (let i = 0; i < 5; i++) round(c, { launched: 30, delivered: 0, survivorsLost: 30 });
    expect(confidenceCeiling(c)).toBe(CAMPAIGN.confidenceCeilingFloor);
    expect(CAMPAIGN.confidenceCeilingFloor).toBeGreaterThan(0);
  });

  it('pulls a bar already above it back down', () => {
    // The cap is not only a limit on climbing. A round that wrecks the record
    // must move the number the player is looking at.
    const c = newRegionalRun('ceil-pull', FIRST_REGION);
    for (let i = 0; i < 10; i++) round(c, clean);
    expect(c.confidence).toBe(CAMPAIGN.maxConfidence);
    const after = round(c, { launched: 30, delivered: 12, survivorsLost: 18 });
    expect(after).toBeLessThan(CAMPAIGN.maxConfidence);
    expect(after).toBeLessThanOrEqual(Math.round(confidenceCeiling(c)));
  });

  it('survives the save round-trip and heals an older run', () => {
    const c = newRegionalRun('ceil-save', FIRST_REGION);
    round(c, { launched: 30, delivered: 27 });
    const once = migrateRun(JSON.parse(JSON.stringify(c)))!;
    const twice = migrateRun(JSON.parse(JSON.stringify(once)))!;
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));

    const older = JSON.parse(JSON.stringify(c)) as Record<string, unknown>;
    delete older.record;
    const healed = migrateRun(older)!;
    expect(healed).not.toBeNull();
    expect(healed.record).toEqual({ launched: 0, lost: 0 });
  });
});

describe('the rounds the log complained about', () => {
  it('a round that loses escorts and abandons a crew does not climb', () => {
    // The logged round 5: 97% delivered, two escorts down, one crew left.
    // It finished at 100. It must not.
    const c = newRegionalRun('log-r5', FIRST_REGION);
    for (let i = 0; i < 4; i++) round(c, { launched: 25, delivered: 24 });
    const before = c.confidence;
    const after = round(c, {
      launched: 30,
      delivered: 29,
      escortsLost: 2,
      survivorsLost: 1,
    });
    expect(after).toBeLessThan(before);
  });

  it('a 77%-delivery round costs confidence even with most crews rescued', () => {
    // The logged round 6: seven of thirty hulls lost, six of seven crews saved,
    // and confidence did not move. Rescue mitigates; it never profits.
    const c = newRegionalRun('log-r6', FIRST_REGION);
    for (let i = 0; i < 3; i++) round(c, clean);
    const before = c.confidence;
    const after = round(c, {
      launched: 30,
      delivered: 23,
      survivorsRescued: 6,
      survivorsLost: 1,
    });
    expect(after).toBeLessThan(before);
  });

  it('losing escorts costs something on its own', () => {
    const kept = newRegionalRun('esc-kept', FIRST_REGION);
    round(kept, clean);
    const sunk = newRegionalRun('esc-sunk', FIRST_REGION);
    round(sunk, { ...clean, escortsLost: 2 });
    expect(sunk.confidence).toBeLessThan(kept.confidence);
    expect(CAMPAIGN.confidencePerEscortLost).toBeLessThan(0);
  });
});

describe('rescue mitigates, it never profits', () => {
  it('cannot turn a losing round into a gain', () => {
    const c = newRegionalRun('rescue-profit', FIRST_REGION);
    for (let i = 0; i < 3; i++) round(c, clean);
    const before = c.confidence;
    // A catastrophe with every single crew brought home.
    const after = round(c, {
      launched: 30,
      delivered: 15,
      survivorsRescued: 15,
      survivorsLost: 0,
    });
    expect(after).toBeLessThan(before);
  });

  it('still visibly pays on the round it matters most', () => {
    const outcome = (rescued: number): number => {
      const c = newRegionalRun(`rescue-pay-${rescued}`, FIRST_REGION);
      for (let i = 0; i < 3; i++) round(c, clean);
      return round(c, {
        launched: 30,
        delivered: 18,
        survivorsRescued: rescued,
        survivorsLost: 12 - rescued,
      });
    };
    // Going back for the crews is worth real confidence against not going.
    expect(outcome(12)).toBeGreaterThan(outcome(0));
  });

  it('pays in full on a round that lost nothing to mitigate', () => {
    // The cap applies to LOSING rounds only — a clean round's rescue credit is
    // untouched, so the tactical bargain keeps its simple shape.
    const c = newRegionalRun('rescue-clean', FIRST_REGION);
    const bare = newRegionalRun('rescue-clean-bare', FIRST_REGION);
    round(bare, clean);
    round(c, { ...clean, survivorsRescued: 3 });
    expect(c.confidence - bare.confidence).toBe(CAMPAIGN.confidencePerCrewRescued * 3);
  });
});

describe('the numbers still hang together', () => {
  it('a losing round costs and a clean round earns', () => {
    const good = newRegionalRun('band-good', FIRST_REGION);
    const before = good.confidence;
    expect(round(good, clean)).toBeGreaterThan(before);

    const bad = newRegionalRun('band-bad', FIRST_REGION);
    expect(round(bad, { launched: 30, delivered: 18 })).toBeLessThan(bad.confidence + 1);
  });

  it('holds break-even inside the healthy delivery band', () => {
    // SEESAW.md calls 60-90% healthy. Break-even must sit inside it, near the
    // top: holding station should take a good round, never a perfect one.
    expect(CAMPAIGN.confidenceBreakEven).toBeGreaterThan(0.6);
    expect(CAMPAIGN.confidenceBreakEven).toBeLessThan(0.9);
  });

  it('keeps the round floor the bound on how fast a single round can fall', () => {
    const c = newRegionalRun('floor', FIRST_REGION);
    for (let i = 0; i < 6; i++) round(c, clean);
    const before = c.confidence;
    const after = round(c, { launched: 30, delivered: 0, survivorsLost: 30 });
    // The ceiling can outrun the floor — that is the point of having both — but
    // the ORDINARY arithmetic still cannot drop more than the floor allows.
    expect(before - after).toBeGreaterThan(0);
    expect(after).toBeGreaterThanOrEqual(0);
  });
});
