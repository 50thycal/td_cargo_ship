// Repairs are bought a SCOPE at a time.
//
// One "repair everything" button made the decision for the player: if the cash
// was short you simply did not repair. Splitting it puts the real question back
// on the screen — patch the merchant hulls that carry the quota, or the
// warships that protect them — and the spend-what-you-have variant means a
// broke round still buys something.
//
// Note the asymmetry, which is deliberate: there is no partial order for
// "everything". Spending the whole wallet across the whole fleet is not a
// decision, it is just emptying the wallet.

import { describe, expect, it } from 'vitest';
import {
  buyEscort,
  newCampaign,
  repairCost,
  repairFleet,
  repairPartial,
  repairPartialQuote,
  scopeDamage,
  escortDamageTotal,
  totalPendingDamage,
} from '../src/sim/campaign';
import { ECONOMY } from '../src/data/tuning';
import type { CampaignState } from '../src/sim/types';

/** A run carrying damage everywhere: merchant hulls, two escorts, a battery. */
function hurt(seed = 'repair-scopes'): CampaignState {
  const c = newCampaign(seed);
  c.cash = 100_000;
  while (c.escortUnits.length < 2) buyEscort(c);
  c.pendingDamage = 100;
  c.escortUnits[0].damage = 40;
  c.escortUnits[1].damage = 20;
  c.baseDamage = 10;
  c.cash = 100_000;
  return c;
}

describe('what each scope covers', () => {
  it('splits the fleet into merchant hulls and warships', () => {
    const c = hurt();
    expect(scopeDamage(c, 'cargo')).toBe(100);
    // Escorts and batteries are patched together — the Forward Repair Yard has
    // always treated them as one class of asset, so the buttons match it.
    expect(scopeDamage(c, 'escorts')).toBe(70);
    expect(scopeDamage(c, 'all')).toBe(170);
    expect(scopeDamage(c, 'all')).toBe(totalPendingDamage(c));
  });

  it('prices each scope on its own damage', () => {
    const c = hurt();
    expect(repairCost(c, 'cargo') + repairCost(c, 'escorts')).toBe(repairCost(c, 'all'));
    expect(repairCost(c, 'cargo')).toBe(Math.ceil(100 * ECONOMY.repairCostPerHp));
  });

  it('defaults to everything, so old callers keep their behaviour', () => {
    const c = hurt();
    expect(repairCost(c)).toBe(repairCost(c, 'all'));
    expect(repairFleet(c)).toBe(true);
    expect(totalPendingDamage(c)).toBe(0);
  });
});

describe('a full repair of one scope leaves the other alone', () => {
  it('cargo only', () => {
    const c = hurt();
    const cash = c.cash;
    const cost = repairCost(c, 'cargo');
    expect(repairFleet(c, 'cargo')).toBe(true);
    expect(c.pendingDamage).toBe(0);
    expect(escortDamageTotal(c)).toBe(60); // untouched
    expect(c.baseDamage).toBe(10);
    expect(c.cash).toBe(cash - cost);
  });

  it('escorts (and the batteries with them) only', () => {
    const c = hurt();
    expect(repairFleet(c, 'escorts')).toBe(true);
    expect(escortDamageTotal(c)).toBe(0);
    expect(c.baseDamage).toBe(0);
    expect(c.pendingDamage).toBe(100); // untouched
  });

  it('refuses when the scope is already whole', () => {
    const c = hurt();
    c.pendingDamage = 0;
    expect(repairFleet(c, 'cargo')).toBe(false);
    expect(repairPartial(c, 'cargo')).toBe(false);
  });

  it('refuses when the whole price is not on hand', () => {
    const c = hurt();
    c.cash = repairCost(c, 'cargo') - 1;
    expect(repairFleet(c, 'cargo')).toBe(false);
    expect(c.pendingDamage).toBe(100);
  });
});

describe('repair what you can', () => {
  it('spends the cash on hand and patches proportionally', () => {
    const c = hurt();
    const rate = ECONOMY.repairCostPerHp;
    c.cash = Math.floor(40 * rate); // enough for 40 of the 100 hp
    const quote = repairPartialQuote(c, 'cargo');
    expect(quote.hp).toBe(40);
    expect(quote.cost).toBeLessThanOrEqual(c.cash);

    expect(repairPartial(c, 'cargo')).toBe(true);
    expect(c.pendingDamage).toBe(60);
    expect(c.cash).toBeGreaterThanOrEqual(0);
    expect(c.cash).toBeLessThan(rate); // only the unspendable remainder is left
  });

  it('never goes into debt, and never over-repairs', () => {
    const c = hurt();
    c.cash = 100_000; // far more than the cargo scope costs
    const quote = repairPartialQuote(c, 'cargo');
    expect(quote.hp).toBe(100); // capped at the damage that exists
    expect(repairPartial(c, 'cargo')).toBe(true);
    expect(c.pendingDamage).toBe(0);
    expect(c.cash).toBeGreaterThan(0);
  });

  it('does nothing at all when there is not a dollar to spend', () => {
    const c = hurt();
    c.cash = 0;
    expect(repairPartialQuote(c, 'cargo').hp).toBe(0);
    expect(repairPartial(c, 'cargo')).toBe(false);
    expect(c.pendingDamage).toBe(100);
  });

  it('patches the WORST-HURT escort first', () => {
    // The point of a partial repair is that it buys something worth having.
    // Money into the hull closest to going down is that; money spread evenly is
    // three ships that all still sink.
    const c = hurt();
    c.baseDamage = 0;
    c.cash = Math.floor(40 * ECONOMY.repairCostPerHp);
    expect(repairPartial(c, 'escorts')).toBe(true);
    expect(c.escortUnits[0].damage).toBe(0); // the 40hp one, cleared
    expect(c.escortUnits[1].damage).toBe(20); // the 20hp one, untouched
  });
});

describe('the Forward Repair Yard', () => {
  function withYard(): CampaignState {
    const c = hurt('repair-yard');
    c.completedResearch = [...c.completedResearch, 'logistics.repairYard'];
    return c;
  }

  it('patches the warships for nothing and still bills the merchants', () => {
    const c = withYard();
    expect(repairCost(c, 'escorts')).toBe(0);
    expect(repairCost(c, 'cargo')).toBeGreaterThan(0);
    expect(repairCost(c, 'all')).toBe(repairCost(c, 'cargo'));
  });

  it('does the free work even with an empty wallet', () => {
    // Gating the free repair on having money was a real bug in the bot loop:
    // a player who had bought the yard could not use it when broke.
    const c = withYard();
    c.cash = 0;
    expect(repairFleet(c, 'escorts')).toBe(true);
    expect(escortDamageTotal(c)).toBe(0);
    expect(c.baseDamage).toBe(0);
  });

  it('quotes the free work as the whole job, not a fraction of it', () => {
    const c = withYard();
    c.cash = 0;
    expect(repairPartialQuote(c, 'escorts')).toEqual({ hp: 70, cost: 0 });
  });
});
