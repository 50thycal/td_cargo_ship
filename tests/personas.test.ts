// Playtest-persona tests.
//
// The personas are the harness's model of a player, and a persona that quietly
// cannot do something a player does makes every balance number measured through
// it wrong in a way nothing else catches. These tests pin the capabilities that
// were MISSING when the fidelity panel first measured them (docs/PLAYTEST_FIDELITY.md)
// — so a future refactor that drops one fails here rather than in a tuning
// decision six weeks later.

import { describe, expect, it } from 'vitest';
import {
  commanderLoadoutError,
  decideCommands,
  newTransitMemory,
  personaByName,
  PERSONAS,
  procure,
  research,
  type Persona,
} from '../tools/playtest/personas';
import {
  createRoundTransit,
  newRegionalRun,
  planCurrentRound,
  resolveTransit,
} from '../src/sim/campaign';
import { stepTransit } from '../src/sim/transit';
import type { CampaignState } from '../src/sim/types';

/** Play a whole regional run the way the sweep runner does. */
function playPersona(persona: Persona, seed: string, rounds: number): CampaignState {
  const c = newRegionalRun(seed, 'pirateNarrows', persona.commander ?? []);
  for (let round = 0; round < rounds; round++) {
    if (c.campaignOver) break;
    procure(c, persona);
    if (Object.values(c.composition).reduce((a, b) => a + b, 0) === 0) break;
    const plan = planCurrentRound(c);
    const { state, rng } = createRoundTransit(c, plan);
    const mem = newTransitMemory();
    let guard = 0;
    while (!state.over && guard++ < 100_000) {
      stepTransit(state, decideCommands(state, persona, mem), rng);
    }
    resolveTransit(c, state);
    research(c, persona);
  }
  return c;
}

function playRun(personaName: string, seed: string, rounds: number): CampaignState {
  const persona = personaByName(personaName);
  if (!persona) throw new Error(`no persona ${personaName}`);
  return playPersona(persona, seed, rounds);
}

describe('commander loadouts', () => {
  it('every persona commissions a legal loadout', () => {
    // Not clamped, checked. A loadout silently losing its third ability for
    // going a point over budget would make the persona quietly different from
    // what its comment says it is.
    for (const p of PERSONAS) {
      expect(commanderLoadoutError(p), `${p.name}: ${commanderLoadoutError(p)}`).toBeNull();
    }
  });

  it('rejects an over-budget loadout rather than truncating it', () => {
    const base = PERSONAS[0];
    expect(
      commanderLoadoutError({ ...base, commander: ['steadyHands', 'warChest', 'shipwright'] }),
    ).toContain('loadout points');
    expect(commanderLoadoutError({ ...base, commander: ['nonexistent'] })).toContain('unknown');
    expect(
      commanderLoadoutError({ ...base, commander: ['salvageTeams', 'salvageTeams'] }),
    ).toContain('duplicate');
  });
});

describe('recovery is actually exercised', () => {
  // THE regression this whole file exists for. No persona issued `moveEscort`,
  // so sweeps recovered 0.2% of wreckage against a hand-played 81% — and
  // recovered wreckage is what widens the technology draft from two options to
  // three. Every counter-value number was being measured on a narrower tree
  // than a player climbs.
  it('a fighting persona recovers wreckage and rescues crews', () => {
    const c = playRun('automation', 'recovery-seed', 6);
    const spawned = c.telemetry.reduce((n, r) => n + r.wreckageSpawned, 0);
    const recovered = c.telemetry.reduce((n, r) => n + r.wreckageRecovered, 0);
    expect(spawned).toBeGreaterThan(0);
    expect(recovered).toBeGreaterThan(0);
    // Not a rate assertion — seeds vary and pinning a rate would be fitting
    // noise. The claim is that the loop RUNS at all, which is what was broken.
    expect(c.telemetry.reduce((n, r) => n + r.recoveryEscortSeconds, 0)).toBeGreaterThan(30);
  });

  it('recovering widens the technology draft past the two-option floor', () => {
    const c = playRun('automation', 'recovery-seed', 6);
    expect(c.draftHistory.length).toBeGreaterThan(0);
    expect(c.draftHistory.some((d) => d.offered.length >= 3)).toBe(true);
  });

  it('the AFK control still recovers nothing — it is the floor, not a player', () => {
    const c = playRun('afk', 'recovery-seed', 4);
    expect(c.telemetry.reduce((n, r) => n + r.wreckageRecovered, 0)).toBe(0);
  });
});

describe('detaching an escort is a trade, not free value', () => {
  it('never sends the last screening hull away', () => {
    // `screenReserve` is what makes salvage cost something. Without it a
    // flotilla strips its own screen to chase wreckage, which no player does.
    const persona = personaByName('automation')!;
    const c = newRegionalRun('reserve-seed', 'pirateNarrows', persona.commander ?? []);
    procure(c, persona);
    const plan = planCurrentRound(c);
    const { state, rng } = createRoundTransit(c, plan);
    const mem = newTransitMemory();
    let guard = 0;
    let detachOrders = 0;
    while (!state.over && guard++ < 100_000) {
      const cmds = decideCommands(state, persona, mem);
      // A hold order is a detachment; a rejoin (hold=false) is a recall.
      detachOrders += cmds.filter((cmd) => cmd.type === 'moveEscort' && cmd.hold).length;
      const alive = state.escorts.filter((e) => e.alive).length;
      expect(mem.jobs.size).toBeLessThanOrEqual(Math.max(0, alive - persona.transit.screenReserve));
      stepTransit(state, cmds, rng);
    }
    void detachOrders;
  });
});

describe('sparing interception', () => {
  it('withholds shots an always-on build would take, on identical state', () => {
    // Both policies are asked for commands from THE SAME state on every tick,
    // which is the only way to compare them. Playing two separate runs does not
    // work: after round one they have diverged into different economies facing
    // different threat volumes, and the sparing arm can legitimately end up
    // firing MORE in total — measured 113 against 99, which says nothing about
    // the rule.
    const sparing = personaByName('automation')!;
    expect(sparing.transit.intercept).toBe('sparing');
    const eager = { ...sparing, transit: { ...sparing.transit, intercept: 'always' as const } };

    const c = newRegionalRun('sparing-seed', 'pirateNarrows', sparing.commander ?? []);
    procure(c, sparing);
    const plan = planCurrentRound(c);
    const { state, rng } = createRoundTransit(c, plan);
    const memA = newTransitMemory();
    const memB = newTransitMemory();
    let guard = 0;
    let spared = 0;
    let eagerly = 0;
    let withheld = 0;
    while (!state.over && guard++ < 100_000) {
      const a = decideCommands(state, sparing, memA);
      const b = decideCommands(state, eager, memB);
      const aShots = a.filter((cmd) => cmd.type === 'intercept').length;
      const bShots = b.filter((cmd) => cmd.type === 'intercept').length;
      // `sparing` adds a condition to the same candidate loop, so on identical
      // state it can never fire MORE than `always`. That invariant is the rule.
      expect(aShots).toBeLessThanOrEqual(bShots);
      if (bShots > aShots) withheld++;
      spared += aShots;
      eagerly += bShots;
      stepTransit(state, a, rng);
    }
    // And it genuinely declines shots rather than being a no-op rename.
    expect(withheld).toBeGreaterThan(0);
    expect(spared).toBeLessThan(eagerly);
  });
});

describe('formation is a per-round lever', () => {
  it('an adaptive persona changes formation across a run', () => {
    const persona = personaByName('automation')!;
    expect(persona.adaptFormation).toBe(true);
    const c = playRun('automation', 'formation-seed', 7);
    const forms = c.telemetry.map((r) => r.formation);
    expect(new Set(forms).size).toBeGreaterThan(1);
  });

  it('a fixed persona holds one formation, so the lever is still a variable', () => {
    const persona = personaByName('gunboat')!;
    expect(persona.adaptFormation).toBeFalsy();
    const c = playRun('gunboat', 'formation-seed', 6);
    expect(new Set(c.telemetry.map((r) => r.formation)).size).toBe(1);
  });
});

describe('the run the sweep plays', () => {
  it('is a shipping region with a win condition, not the dev proving ground', () => {
    // `newCampaign` hard-codes `openSeas`: seven branches, no starting escort,
    // no completion watermark, and excluded from REGION_ORDER so no player can
    // select it. The sweep balancing against it was the largest single fidelity
    // gap measured.
    const c = playRun('automation', 'region-seed', 12);
    expect(c.regionId).toBe('pirateNarrows');
    expect(['victory', 'defeat']).toContain(c.runOutcome);
    expect(c.commanderAbilities.length).toBeGreaterThan(0);
  });
});
