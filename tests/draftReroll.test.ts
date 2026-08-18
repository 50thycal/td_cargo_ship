// Draft rerolls — the consolation for a round that went badly.
//
// Crews only end up in the water when hulls go down, so a reroll is earned
// exactly when a round has cost the player ships. It pays for the BOAT WORK,
// not the sinking: leaving the survivors out there earns nothing. That is the
// whole point — it is a reason to go back for people on the round you can
// least afford to detach an escort.

import { describe, expect, it } from 'vitest';
import {
  createRoundTransit,
  newRegionalRun,
  planCurrentRound,
  rerollBlockReason,
  rerollDraft,
  resolveTransit,
} from '../src/sim/campaign';
import { stepTransit } from '../src/sim/transit';
import { draftOptionKey } from '../src/sim/draft';
import { migrateRun } from '../src/platform/save';
import { CAMPAIGN, DRAFT, SIM } from '../src/data/tuning';
import { FIRST_REGION } from '../src/data/regions';
import type { CampaignState } from '../src/sim/types';

/** Play one quiet round to its end and resolve it, with the survivor tallies
 *  injected at resolution time — the same trick the confidence tests use, so
 *  the round itself stays deterministic and fast. */
function quietRound(c: CampaignState, rescued: number, lost = 0): void {
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
  state.stats.survivorsRescued = rescued;
  state.stats.survivorsLost = lost;
  resolveTransit(c, state);
}

describe('earning a reroll', () => {
  it('starts a run with none', () => {
    const c = newRegionalRun('reroll-start', FIRST_REGION);
    expect(c.draftRerolls).toBe(0);
    expect(rerollBlockReason(c)).toBe('No draft is pending');
  });

  it('pays out at the crew threshold and not below it', () => {
    const short = newRegionalRun('reroll-short', FIRST_REGION);
    quietRound(short, DRAFT.crewsPerReroll - 1);
    expect(short.draftRerolls).toBe(0);

    const paid = newRegionalRun('reroll-paid', FIRST_REGION);
    quietRound(paid, DRAFT.crewsPerReroll);
    expect(paid.draftRerolls).toBe(1);
  });

  it('pays nothing for crews left in the water', () => {
    // The reward is for the rescue, not for the sinking. A round that drowns
    // six crews earns exactly what a round that drowns none does.
    const c = newRegionalRun('reroll-abandoned', FIRST_REGION);
    quietRound(c, 0, 6);
    expect(c.draftRerolls).toBe(0);
  });

  it('grants at most one a round, and banks a bounded number', () => {
    const c = newRegionalRun('reroll-bank', FIRST_REGION);
    quietRound(c, DRAFT.crewsPerReroll * 4); // a huge rescue round is still one
    expect(c.draftRerolls).toBe(1);
    for (let i = 0; i < DRAFT.maxRerolls + 3; i++) {
      c.pendingDraft = null;
      quietRound(c, DRAFT.crewsPerReroll);
    }
    expect(c.draftRerolls).toBe(DRAFT.maxRerolls);
  });

  it('says how to earn one when the player has none', () => {
    const c = newRegionalRun('reroll-hint', FIRST_REGION);
    quietRound(c, 0);
    expect(c.pendingDraft).not.toBeNull();
    expect(rerollBlockReason(c)).toContain(`${DRAFT.crewsPerReroll}`);
    expect(rerollDraft(c)).toBe(false);
  });
});

describe('spending a reroll', () => {
  function readyToReroll(seed: string): CampaignState {
    const c = newRegionalRun(seed, FIRST_REGION);
    quietRound(c, DRAFT.crewsPerReroll);
    expect(c.draftRerolls).toBe(1);
    expect(c.pendingDraft).not.toBeNull();
    return c;
  }

  it('redraws the table and spends the token', () => {
    const c = readyToReroll('reroll-spend');
    const before = c.pendingDraft!.options.map(draftOptionKey);
    expect(rerollDraft(c)).toBe(true);
    expect(c.draftRerolls).toBe(0);
    const after = c.pendingDraft!.options.map(draftOptionKey);
    // Not a guarantee that every card changed — a small pool can legitimately
    // redraw the same entry — but the table must not be identical, or the
    // reroll bought nothing.
    expect(after.join('|')).not.toBe(before.join('|'));
    expect(c.pendingDraft!.rerolls).toBe(1);
  });

  it('does not change how many picks the table carries', () => {
    // Picks are bought with wreckage. A reroll buys a DIFFERENT table, never a
    // bigger one — otherwise rescuing crews would quietly out-earn salvage.
    const c = readyToReroll('reroll-picks');
    const { picksLeft, picksTotal, round } = c.pendingDraft!;
    rerollDraft(c);
    expect(c.pendingDraft!.picksLeft).toBe(picksLeft);
    expect(c.pendingDraft!.picksTotal).toBe(picksTotal);
    expect(c.pendingDraft!.round).toBe(round);
  });

  it('refuses once the bank is empty', () => {
    const c = readyToReroll('reroll-empty');
    expect(rerollDraft(c)).toBe(true);
    expect(rerollBlockReason(c)).toContain('Rescue');
    expect(rerollDraft(c)).toBe(false);
    expect(c.pendingDraft!.rerolls).toBe(1); // unchanged by the refusal
  });

  it('is deterministic — a replay of the same run redraws the same table', () => {
    const once = readyToReroll('reroll-determinism');
    rerollDraft(once);
    const twice = readyToReroll('reroll-determinism');
    rerollDraft(twice);
    expect(twice.pendingDraft!.options.map(draftOptionKey)).toEqual(
      once.pendingDraft!.options.map(draftOptionKey),
    );
  });

  it('redraws against the same round of salvage, not a bare pool', () => {
    const c = readyToReroll('reroll-salvage');
    const salvage = c.pendingDraft!.recoveredByBranch;
    rerollDraft(c);
    expect(c.pendingDraft!.recoveredByBranch).toEqual(salvage);
    expect(c.pendingDraft!.recoveredUnits).toBe(
      Object.values(salvage).reduce((a, b) => a + b, 0),
    );
  });

  it('survives the save round-trip, token and all', () => {
    const c = readyToReroll('reroll-save');
    rerollDraft(c);
    const once = migrateRun(JSON.parse(JSON.stringify(c)))!;
    const twice = migrateRun(JSON.parse(JSON.stringify(once)))!;
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
    expect(once.pendingDraft!.rerolls).toBe(1);
  });

  it('heals a run saved before rerolls existed', () => {
    const c = newRegionalRun('reroll-migrate', FIRST_REGION) as unknown as Record<string, unknown>;
    delete c.draftRerolls;
    const healed = migrateRun(c)!;
    expect(healed).not.toBeNull();
    expect(healed.draftRerolls).toBe(0);
  });
});

describe('the reroll is aimed at the player who is losing', () => {
  it('cannot be earned by a clean round — no sinkings, no crews to rescue', () => {
    // Not a mechanical assertion so much as a statement of the design: the
    // survivor count IS the ship-loss count, so the reward is unreachable by a
    // player who is not losing hulls. Guarded here so a future change that
    // starts spawning survivors from somewhere else has to come past this test.
    const c = newRegionalRun('reroll-clean', FIRST_REGION);
    quietRound(c, 0);
    expect(c.crewRescue.rescued).toBe(0);
    expect(c.draftRerolls).toBe(0);
    // And rescuing still costs less confidence than it recovers, so the token
    // never becomes a reason to WANT the sinking.
    expect(CAMPAIGN.confidencePerCrewRescued).toBeGreaterThan(0);
  });
});
