// The interceptor economy has to be SOLVABLE.
//
// Interceptors are the only general answer to a missile, and their ammunition
// is the one defensive purchase a player must repeat every single round. That
// makes its price the hinge the whole missile game swings on, and it is a
// price that can silently fall out of date: the enemy's purse is tuned region
// by region against how the fight FEELS, while the ammunition it has to be
// answered with is priced once, globally, in tuning.ts.
//
// That is exactly what happened. Missile Coast's budget was raised twice on
// the strength of hand-play saying the volume was right — and it was — but the
// price of answering it never moved with it. By round 4 the arithmetic had
// gone underwater: putting ONE interceptor up per incoming missile, before a
// single miss, cost more than the round earned. The run was not hard, it was
// unwinnable, and nothing in the build said so because nothing was watching
// this ratio.
//
// So these tests watch it. They are deliberately about ARITHMETIC rather than
// outcomes: not "does a bot win" — that depends on twelve other systems — but
// "can a round's income buy a round's answer". A campaign can be brutal and
// still pass this; it cannot be impossible and pass it.

import { describe, expect, it } from 'vitest';
import {
  ammoUnitCost,
  buyAmmo,
  buyBase,
  buyEscort,
  createRoundTransit,
  newRegionalRun,
  planCurrentRound,
  resolveTransit,
  setComposition,
} from '../src/sim/campaign';
import { stepTransit } from '../src/sim/transit';
import { ECONOMY, SIM } from '../src/data/tuning';
import { REGION_ORDER, regionDef } from '../src/data/regions';
import { allResearchableIds } from '../src/data/counters';
import type { CampaignState, ShipClassId } from '../src/sim/types';

/** Play one round. No manual shots — shore batteries and whatever automation
 *  the run has, only. Deliberately the LOW end of player skill: the ratio
 *  under test must not depend on heroics at the tap. */
function playRound(c: CampaignState): void {
  const { state, rng } = createRoundTransit(c, planCurrentRound(c));
  let guard = 0;
  while (!state.over && guard++ < Math.ceil(SIM.maxTransitTime / SIM.dt) + 10) {
    stepTransit(state, [], rng);
  }
  resolveTransit(c, state);
}

/** Keep the run ALIVE to the region's completion round, so the late rounds —
 *  where the enemy's purse is largest, and where the defect lived — are
 *  actually reached and measured.
 *
 *  This is the load-bearing part of the fixture, and the first draft of this
 *  file got it wrong in a way worth recording. A bot that simply plays until it
 *  dies never sees round 6, because it dies of the very shortfall being
 *  measured; averaged over a run that ends at round 3, an economy that is
 *  catastrophic at round 8 reads as perfectly healthy. That draft passed
 *  cheerfully against the exact numbers it had been written to reject.
 *
 *  So the fleet is underwritten rather than played: hulls, batteries and
 *  escorts are restored each round from a purse that cannot run out. That is
 *  not the same as making the run easy — it removes every OTHER way to fail so
 *  that what is left is the one question this file asks, which is whether the
 *  income a round pays can buy the ammunition that round demands. The income
 *  measured stays entirely real: cashEarned is delivered cargo and nothing
 *  else, so a fleet that defends badly still earns badly. */
function underwrite(c: CampaignState): void {
  c.cash += 100_000;
  // A player who has read the after-action report and drafted toward the
  // threat: every launcher researched, automation on. This is the "reasonably
  // successful player" the bar is written for, not a perfect one — the round
  // is still fought by automation alone, with no manual shot taken anywhere.
  c.completedResearch = allResearchableIds();
  while (buyBase(c));
  while (buyEscort(c));
  for (const classId of Object.keys(c.fleet) as ShipClassId[]) {
    for (let n = c.capacity; n > 0; n--) {
      if (setComposition(c, classId, n)) break;
    }
  }
  // Magazines other than the one under test are kept full, so this measures
  // the interceptor's price and not some neighbouring shortage.
  c.pdAmmo = 999;
  c.gunAmmo = 999;
  c.droneAmmo = 999;
  // Stock against what the last round actually threw, the way a player reads
  // their own after-action report.
  const last = c.telemetry[c.telemetry.length - 1];
  const want = Math.max(40, Math.ceil((last?.missilesSpawned ?? 0) * 1.5));
  while (c.ammo < want && buyAmmo(c, ECONOMY.ammoPerBuy));
}

interface Bill {
  round: number;
  /** Missiles that crossed the water this round. */
  incoming: number;
  /** Cash the round paid out — delivered cargo, and nothing else. */
  income: number;
  /** What one interceptor per incoming missile would have cost. */
  answerCost: number;
}

function billThroughRegion(seed: string, regionId: string): Bill[] {
  const c = newRegionalRun(seed, regionId);
  const bills: Bill[] = [];
  const last = regionDef(regionId).completionRound;
  for (let round = 0; round < last && !c.campaignOver; round++) {
    underwrite(c);
    const unit = ammoUnitCost(c);
    playRound(c);
    const t = c.telemetry[c.telemetry.length - 1];
    if (!t) break;
    bills.push({
      round: t.round,
      incoming: t.missilesSpawned,
      income: t.cashEarned,
      answerCost: t.missilesSpawned * unit,
    });
  }
  return bills;
}

/** The rounds that decide whether a run is winnable. Round 1 is a scripted
 *  onboarding — five missiles against a full purse — and would flatter any
 *  price at all; the late rounds are where the budget curve has arrived. */
function lateBill(bills: Bill[]): { income: number; answerCost: number; incoming: number } {
  return bills
    .filter((b) => b.round >= 4)
    .reduce(
      (acc, b) => ({
        income: acc.income + b.income,
        answerCost: acc.answerCost + b.answerCost,
        incoming: acc.incoming + b.incoming,
      }),
      { income: 0, answerCost: 0, incoming: 0 },
    );
}

const SEEDS = ['econ-a', 'econ-b', 'econ-c'];

describe('interceptor economy', () => {
  // Every shipping region, because the price is global while the threat that
  // sets the bill is regional — and a region that leans hard on one branch can
  // push the ratio out of range on its own, which is the failure this file
  // exists for.
  for (const regionId of REGION_ORDER) {
    it(`lets late-round income answer late-round missiles in ${regionId}`, () => {
      const ratios: number[] = [];
      for (const seed of SEEDS) {
        const late = lateBill(billThroughRegion(seed, regionId));
        // A seed can draw a region that fields almost nothing from the air;
        // there is no price question to ask then.
        if (late.incoming < 20) continue;
        ratios.push(late.answerCost / Math.max(1, late.income));
      }
      expect(ratios.length, 'no seed fielded enough missiles to measure').toBeGreaterThan(0);

      // THE BAR: from round 4 on, putting one interceptor up per incoming
      // missile costs at most 85% of what those rounds earn.
      //
      // Under 1.0 rather than at it, because 1.0 is the point of no return
      // rather than a margin — at 1.0 a run has to spend literally everything
      // it earns on ammunition and can never replace a hull, hire an escort or
      // repair anything, which is a loss on a delay. 0.85 leaves the run
      // solvent while keeping ammunition comfortably the largest line on the
      // shopping list, which is the decision the raid is supposed to force.
      //
      // The number is measured, not chosen. Against this same fixture the
      // ratio on Missile Coast reads:
      //
      //     $8/round (the defect)   1.391    unwinnable
      //     $5/round                0.869    still short
      //     $4/round (shipping)     0.695    solvent, and still tight
      //     $3/round                0.521    comfortable
      //
      // and the sweep agrees with the arithmetic: over 72 campaigns, campaigns
      // reaching the region's final round went 13 at $8 → 14 at $5 → 20 at $4.
      // A bar of 0.85 rejects both prices that did not fix it.
      //
      // The other three regions sit at 0.15-0.26 on the shipping price: they
      // split the same purse across three or four branches, so the interceptor
      // is one bill among several rather than the whole fight.
      for (const ratio of ratios) {
        expect(ratio).toBeLessThan(0.85);
      }
    });
  }

  it('still charges enough for ammunition to be a real line on the budget', () => {
    // The other side of the same bar, and the reason the answer here was not
    // simply "make it free". A defended fleet in the region the problem was
    // found in should be committing a visible share of its income to
    // ammunition — if answering a raid rounds to nothing, the decision the
    // raid is supposed to force has been deleted rather than balanced.
    const ratios = SEEDS.map((seed) => {
      const late = lateBill(billThroughRegion(seed, 'missileCoast'));
      return late.answerCost / Math.max(1, late.income);
    });
    expect(Math.max(...ratios)).toBeGreaterThan(0.15);
  });

  it('sells ammunition in a pack, so stocking a raid is not fifty taps', () => {
    // A late Missile Coast round throws ninety-odd missiles. At the old pack of
    // five that was eighteen presses of one button to answer one round.
    const c = newRegionalRun('econ-pack', 'missileCoast');
    const before = c.ammo;
    const cash = c.cash;
    const unit = ammoUnitCost(c);
    expect(buyAmmo(c, ECONOMY.ammoPerBuy)).toBe(true);
    expect(c.ammo - before).toBe(ECONOMY.ammoPerBuy);
    expect(cash - c.cash).toBe(unit * ECONOMY.ammoPerBuy);
    expect(ECONOMY.ammoPerBuy).toBeGreaterThanOrEqual(10);
  });
});
