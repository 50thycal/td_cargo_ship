// Escort Legacies — the flotilla's permanent-progression layer.
//
// The rule these tests exist to protect is the one the whole feature turns on:
// a legacy belongs to a SHIP, not to the run. It is handed to a hull when she
// is commissioned, it applies while she swims, and it goes down with her for
// the rest of the region — a replacement hull does not buy it back, and the
// next run starts with the whole loadout again.
//
// This is what an escort loss costs now. It replaced destroying the ship's
// fitted modules, which was a far worse trade than it looked: modules only
// arrive through the draft, so one mine could erase a branch the player had
// spent three rounds building toward, with no decision anywhere in it.

import { describe, expect, it } from 'vitest';
import {
  activeEscortLegacies,
  buyEscort,
  createRoundTransit,
  equipEscortModule,
  escortCost,
  moduleSpare,
  newRegionalRun,
  planCurrentRound,
  resolveTransit,
} from '../src/sim/campaign';
import { deriveEffects, stepTransit } from '../src/sim/transit';
import {
  ESCORT_LEGACIES,
  ESCORT_LEGACY_ORDER,
  activeLegacyIds,
  foldEscortLegacies,
  legacyPointsUsed,
} from '../src/data/escortLegacies';
import {
  legacyLoadoutBlockReason,
  legacyUnlockBlockReason,
  newProfile,
  sanitizedLegacyLoadout,
  setLegacyLoadout,
  unlockLegacy,
} from '../src/sim/commander';
import { migrateProfile, migrateRun } from '../src/platform/save';
import { ECONOMY, ESCORT_LEGACY } from '../src/data/tuning';
import { FIRST_REGION } from '../src/data/regions';
import type { CampaignState, Threat, ThreatKind, TransitState } from '../src/sim/types';

const NO_ABILITIES: string[] = [];

function bare(loadout: string[] = [], seed = 'legacy'): CampaignState {
  const c = newRegionalRun(seed, FIRST_REGION, NO_ABILITIES, loadout);
  c.cash = 100_000;
  return c;
}

/** A transit with the threat stream removed, so only what a test injects is in
 *  the water. */
function quietTransit(c: CampaignState): {
  state: TransitState;
  rng: ReturnType<typeof createRoundTransit>['rng'];
} {
  const { state, rng } = createRoundTransit(c, planCurrentRound(c));
  state.spawnQueue = [];
  state.threats = [];
  return { state, rng };
}

let injectId = 900_000;
function injectMine(state: TransitState, x: number, y: number): Threat {
  const threat: Threat = {
    id: injectId++,
    kind: 'mine' as ThreatKind,
    x,
    y,
    vx: 0,
    vy: 0,
    alive: true,
    spawnTime: state.time,
    targetShipId: null,
    revealed: true,
    revealedUntil: Infinity,
    claimedBy: null,
    hp: 1,
    hitsTaken: 0,
  } as unknown as Threat;
  state.threats.push(threat);
  return threat;
}

/** Sink the escort at `index` with mines and resolve the round. */
function sinkEscort(c: CampaignState, index: number): void {
  const { state, rng } = quietTransit(c);
  const victim = state.escorts[index];
  for (const e of state.escorts) e.stationed = true;
  while (victim.alive) {
    injectMine(state, victim.x, victim.y);
    stepTransit(state, [], rng);
  }
  while (!state.over) stepTransit(state, [], rng);
  resolveTransit(c, state);
}

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

describe('the legacy catalogue', () => {
  it('offers eight legacies, all of them in the display order', () => {
    expect(Object.keys(ESCORT_LEGACIES)).toHaveLength(8);
    expect(new Set(ESCORT_LEGACY_ORDER)).toEqual(new Set(Object.keys(ESCORT_LEGACIES)));
    expect(ESCORT_LEGACY_ORDER).toHaveLength(8);
  });

  it('keys every definition by its own id, and prices every one', () => {
    for (const [key, def] of Object.entries(ESCORT_LEGACIES)) {
      expect(def.id).toBe(key);
      expect(def.points).toBeGreaterThan(0);
      expect(def.xpCost).toBeGreaterThanOrEqual(0);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.desc.length).toBeGreaterThan(0);
    }
  });

  it('holds some legacies from the first commission, so the first loadout has choices', () => {
    const free = Object.values(ESCORT_LEGACIES).filter((l) => l.xpCost === 0);
    expect(free.length).toBeGreaterThanOrEqual(2);
    // ...and the free ones must fit the budget together, or the opening screen
    // is a list of things the player cannot yet equip.
    expect(legacyPointsUsed(free.slice(0, 2).map((l) => l.id))).toBeLessThanOrEqual(
      ESCORT_LEGACY.loadoutPoints,
    );
  });

  it('folds multipliers multiplicatively and bonuses additively, ignoring unknown ids', () => {
    const both = foldEscortLegacies(['gunneryDrill', 'minePlating', 'ghostLegacy']);
    expect(both.escortAccuracy).toBeCloseTo(ESCORT_LEGACIES.gunneryDrill.mods.escortAccuracy!, 6);
    expect(both.escortMineDamage).toBeCloseTo(ESCORT_LEGACIES.minePlating.mods.escortMineDamage!, 6);
    // Nothing equipped is the identity, so an empty loadout changes no number.
    const none = foldEscortLegacies([]);
    expect(none).toEqual({
      escortAccuracy: 0,
      escortReload: 1,
      escortMineDamage: 1,
      escortDamage: 1,
      escortSpeed: 1,
      recoveryRate: 1,
      freeModulePicks: 0,
      escortCost: 1,
    });
  });
});

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

describe('legacies reach the combat effects', () => {
  const loadout = { escortModules: [], baseModules: [] };

  it('applies centrally, after tech and equipment derivation', () => {
    const plain = deriveEffects([], loadout, [], []);
    const drilled = deriveEffects([], loadout, [], ['gunneryDrill']);
    expect(drilled.escort.accuracy).toBeCloseTo(
      plain.escort.accuracy + ESCORT_LEGACIES.gunneryDrill.mods.escortAccuracy!,
      5,
    );
    // Gunnery Drill is the ESCORT's crew: the shore batteries do not get it.
    expect(drilled.base.accuracy).toBeCloseTo(plain.base.accuracy, 5);
  });

  it('speeds the reload, the helm, the recovery work and the mine plating', () => {
    const plain = deriveEffects([], loadout, [], []);
    const rearm = deriveEffects([], loadout, [], ['rapidRearm']);
    expect(rearm.escort.reload).toBeLessThan(plain.escort.reload);

    const helm = deriveEffects([], loadout, [], ['veteranHelm']);
    expect(helm.escortSpeedMult).toBeGreaterThan(1);

    const rig = deriveEffects([], loadout, [], ['rescueRig']);
    expect(rig.recovery.rescueRateMult).toBeGreaterThan(plain.recovery.rescueRateMult);
    expect(rig.recovery.wreckageRateMult).toBeGreaterThan(plain.recovery.wreckageRateMult);

    const plating = deriveEffects([], loadout, [], ['minePlating']);
    expect(plating.escortMineDamageMult).toBeLessThan(1);
    // Plating answers mines only — an anti-ship missile is unimpressed.
    expect(plating.escortDamageMult).toBe(1);

    const dc = deriveEffects([], loadout, [], ['damageControl']);
    expect(dc.escortDamageMult).toBeLessThan(1);
    expect(dc.escortMineDamageMult).toBe(1);
  });

  it('leaves the CARGO hulls alone — these are escort crews', () => {
    const plain = deriveEffects([], loadout, [], []);
    const armoured = deriveEffects([], loadout, [], ['damageControl', 'minePlating']);
    expect(armoured.damageTakenMult).toBe(plain.damageTakenMult);
  });

  it('composes with Commander Abilities rather than replacing them', () => {
    const both = deriveEffects([], loadout, ['steadyHands'], ['gunneryDrill']);
    const commanderOnly = deriveEffects([], loadout, ['steadyHands'], []);
    const legacyOnly = deriveEffects([], loadout, [], ['gunneryDrill']);
    const plain = deriveEffects([], loadout, [], []);
    expect(both.escort.accuracy).toBeCloseTo(
      plain.escort.accuracy +
        (commanderOnly.escort.accuracy - plain.escort.accuracy) +
        (legacyOnly.escort.accuracy - plain.escort.accuracy),
      5,
    );
  });

  it('mine plating actually reduces the damage a mine deals an escort', () => {
    // Measured through the sim rather than asserted off the multiplier, so a
    // future refactor that stops reading escortMineDamageMult fails here.
    const hpAfter = (loadoutIds: string[]): number => {
      const c = bare(loadoutIds, 'mine-plating');
      const { state, rng } = quietTransit(c);
      const escort = state.escorts[0];
      for (const e of state.escorts) e.stationed = true;
      const before = escort.hp;
      injectMine(state, escort.x, escort.y);
      // Step until the mine has detonated on her.
      for (let i = 0; i < 200 && escort.hp === before; i++) stepTransit(state, [], rng);
      return before - escort.hp;
    };
    const plain = hpAfter([]);
    const plated = hpAfter(['minePlating']);
    expect(plain).toBeGreaterThan(0);
    expect(plated).toBeGreaterThan(0);
    expect(plated).toBeLessThan(plain);
  });
});

// ---------------------------------------------------------------------------
// Ownership: a legacy belongs to a hull
// ---------------------------------------------------------------------------

describe('a legacy belongs to a ship, not to the run', () => {
  it('hands one to each escort at region start, in loadout order', () => {
    const c = bare(['gunneryDrill', 'minePlating', 'veteranHelm']);
    expect(c.escortUnits.length).toBeGreaterThan(0);
    const carried = c.escortUnits.map((u) => u.legacy).filter(Boolean);
    expect(new Set(carried).size).toBe(carried.length); // never two hulls, one legacy
    expect(c.escortUnits[0].legacy).toBe('gunneryDrill');
  });

  it('gives a newly commissioned hull the next unassigned legacy', () => {
    const c = bare(['gunneryDrill', 'minePlating', 'veteranHelm']);
    const before = new Set(c.escortUnits.map((u) => u.legacy));
    expect(buyEscort(c)).toBe(true);
    const fresh = c.escortUnits[c.escortUnits.length - 1];
    expect(fresh.legacy).toBeDefined();
    expect(before.has(fresh.legacy)).toBe(false);
  });

  it('leaves a hull beyond the equipped set simply a hull', () => {
    const c = bare(['gunneryDrill']);
    while (c.escortUnits.length < ECONOMY.maxEscorts) expect(buyEscort(c)).toBe(true);
    expect(c.escortUnits.filter((u) => u.legacy).length).toBe(1);
  });

  it('reports only the legacies whose carrier is still afloat', () => {
    const c = bare(['gunneryDrill', 'minePlating']);
    expect(activeEscortLegacies(c)).toEqual(activeLegacyIds(c.escortUnits));
    // A retired id in a save is dropped rather than folded.
    c.escortUnits[0].legacy = 'ghostLegacy';
    expect(activeEscortLegacies(c)).not.toContain('ghostLegacy');
  });
});

describe('losing the ship burns the legacy for the rest of the region', () => {
  it('takes the ability out of the effects the moment she goes down', () => {
    const c = bare(['gunneryDrill', 'minePlating', 'veteranHelm'], 'legacy-loss');
    const lost = c.escortUnits[0].legacy!;
    expect(activeEscortLegacies(c)).toContain(lost);

    sinkEscort(c, 0);
    expect(activeEscortLegacies(c)).not.toContain(lost);
    expect(c.spentLegacies).toContain(lost);
  });

  it('does NOT hand it back to a replacement hull', () => {
    const c = bare(['gunneryDrill', 'minePlating', 'veteranHelm'], 'legacy-replacement');
    const lost = c.escortUnits[0].legacy!;
    sinkEscort(c, 0);

    c.cash = 100_000;
    expect(buyEscort(c)).toBe(true);
    const fresh = c.escortUnits[c.escortUnits.length - 1];
    expect(fresh.legacy).not.toBe(lost);
    expect(activeEscortLegacies(c)).not.toContain(lost);
  });

  it('salvages her MODULES even as it burns her legacy', () => {
    // The two halves of the same design decision: the drafted hardware comes
    // off her, the veteran crew does not.
    const c = bare(['gunneryDrill'], 'legacy-salvage');
    c.completedResearch = ['deckGun.base'];
    c.moduleStock.escort = { deckGun: 1 };
    const first = c.escortUnits[0];
    first.modules = ['deckGun'];
    const lost = first.legacy!;

    sinkEscort(c, 0);
    expect(c.spentLegacies).toContain(lost);
    expect(moduleSpare(c, 'escort', 'deckGun')).toBe(1); // back in the locker
  });

  it('comes back on the next run — the loss is scoped to the region', () => {
    const spent = bare(['gunneryDrill', 'minePlating'], 'legacy-region');
    sinkEscort(spent, 0);
    expect(spent.spentLegacies.length).toBeGreaterThan(0);

    const next = newRegionalRun('legacy-next', FIRST_REGION, NO_ABILITIES, [
      'gunneryDrill',
      'minePlating',
    ]);
    expect(next.spentLegacies).toEqual([]);
    expect(activeEscortLegacies(next)).toContain('gunneryDrill');
  });
});

// ---------------------------------------------------------------------------
// The two legacies that act outside combat
// ---------------------------------------------------------------------------

describe('economy and requisition legacies', () => {
  it('Requisition Order puts a unit in the locker before round one', () => {
    const without = bare([]);
    const with_ = bare(['requisitionOrder']);
    expect(without.moduleStock.escort.deckGun ?? 0).toBe(0);
    expect(with_.moduleStock.escort.deckGun ?? 0).toBe(1);
  });

  it('teaches the gun as well as issuing it, so it can actually shoot', () => {
    // A unit in the locker with no base node is a gun nobody has been trained
    // on: fittable, and silent. The grant goes through the draft's own path.
    const c = bare(['requisitionOrder']);
    expect(c.completedResearch).toContain('deckGun.base');
    expect(equipEscortModule(c, c.escortUnits[0].id, 'deckGun')).toBe(true);
  });

  it('Standing Contract discounts the hull, and stops discounting when she sinks', () => {
    const c = bare(['standingContract'], 'legacy-contract');
    const discounted = escortCost(c);
    expect(discounted).toBeLessThan(ECONOMY.escortCost);

    sinkEscort(c, 0);
    expect(escortCost(c)).toBe(ECONOMY.escortCost);
  });

  it('charges the discounted price at the till, not just on the label', () => {
    const c = bare(['standingContract'], 'legacy-till');
    const cost = escortCost(c);
    c.cash = cost;
    expect(buyEscort(c)).toBe(true);
    expect(c.cash).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The profile layer
// ---------------------------------------------------------------------------

describe('unlocking and equipping legacies', () => {
  it('starts with the zero-cost legacies held and nothing equipped', () => {
    const p = newProfile();
    const free = Object.values(ESCORT_LEGACIES)
      .filter((l) => l.xpCost === 0)
      .map((l) => l.id);
    expect(new Set(p.unlockedLegacies)).toEqual(new Set(free));
    expect(p.legacyLoadout).toEqual([]);
  });

  it('spends Commander XP to unlock, and refuses when there is not enough', () => {
    const p = newProfile();
    const paid = Object.values(ESCORT_LEGACIES).find((l) => l.xpCost > 0)!;
    expect(legacyUnlockBlockReason(p, paid.id)).toContain('Commander XP');
    expect(unlockLegacy(p, paid.id)).toBe(false);

    p.xp = paid.xpCost;
    expect(unlockLegacy(p, paid.id)).toBe(true);
    expect(p.xp).toBe(0);
    expect(p.unlockedLegacies).toContain(paid.id);
    expect(legacyUnlockBlockReason(p, paid.id)).toBe('Already unlocked');
  });

  it('draws abilities and legacies from the SAME XP pool', () => {
    const p = newProfile();
    const paid = Object.values(ESCORT_LEGACIES).find((l) => l.xpCost > 0)!;
    p.xp = paid.xpCost + 5;
    unlockLegacy(p, paid.id);
    expect(p.xp).toBe(5); // the ability screen sees the smaller balance
  });

  it('enforces berths, points, unlocks and duplicates', () => {
    const p = newProfile();
    for (const id of ESCORT_LEGACY_ORDER) {
      p.unlockedLegacies.includes(id) || p.unlockedLegacies.push(id);
    }
    expect(legacyLoadoutBlockReason(p, ['gunneryDrill', 'gunneryDrill'])).toBe('Duplicate legacy');
    expect(legacyLoadoutBlockReason(p, ['ghostLegacy'])).toBe('Unknown legacy');
    expect(legacyLoadoutBlockReason(p, ESCORT_LEGACY_ORDER.slice(0, 4))).toContain('At most');

    const locked = newProfile();
    const paid = Object.values(ESCORT_LEGACIES).find((l) => l.xpCost > 0)!;
    expect(legacyLoadoutBlockReason(locked, [paid.id])).toBe('Legacy not unlocked');

    // A trio that busts the point budget is refused on points, not on slots.
    const dear = ESCORT_LEGACY_ORDER.slice()
      .sort((a, b) => ESCORT_LEGACIES[b].points - ESCORT_LEGACIES[a].points)
      .slice(0, 3);
    if (legacyPointsUsed(dear) > ESCORT_LEGACY.loadoutPoints) {
      expect(legacyLoadoutBlockReason(p, dear)).toContain('points');
    }
  });

  it('setLegacyLoadout accepts a legal build and refuses an illegal one', () => {
    const p = newProfile();
    const free = Object.values(ESCORT_LEGACIES)
      .filter((l) => l.xpCost === 0)
      .map((l) => l.id);
    expect(setLegacyLoadout(p, free.slice(0, 2))).toBe(true);
    expect(p.legacyLoadout).toEqual(free.slice(0, 2));
    expect(setLegacyLoadout(p, ['ghostLegacy'])).toBe(false);
    expect(p.legacyLoadout).toEqual(free.slice(0, 2)); // unchanged by the refusal
  });

  it('sanitizes rather than refusing to sail', () => {
    const p = newProfile();
    const free = Object.values(ESCORT_LEGACIES)
      .filter((l) => l.xpCost === 0)
      .map((l) => l.id);
    const paid = Object.values(ESCORT_LEGACIES).find((l) => l.xpCost > 0)!;
    p.legacyLoadout = ['ghostLegacy', free[0], free[0], paid.id];
    expect(sanitizedLegacyLoadout(p)).toEqual([free[0]]);
  });

  it('grandfathers a profile saved before legacies existed', () => {
    const p = newProfile() as unknown as Record<string, unknown>;
    delete p.unlockedLegacies;
    delete p.legacyLoadout;
    const healed = migrateProfile(p)!;
    expect(healed).not.toBeNull();
    expect(healed.legacyLoadout).toEqual([]);
    expect(healed.unlockedLegacies.length).toBeGreaterThan(0);
  });

  it('heals a run saved before legacies existed', () => {
    const c = bare(['gunneryDrill']) as unknown as Record<string, unknown>;
    delete c.escortLegacies;
    delete c.spentLegacies;
    const healed = migrateRun(c)!;
    expect(healed).not.toBeNull();
    expect(healed.escortLegacies).toEqual([]);
    expect(healed.spentLegacies).toEqual([]);
  });

  it('round-trips a current-format run untouched', () => {
    const c = bare(['gunneryDrill', 'minePlating'], 'legacy-roundtrip');
    const once = migrateRun(JSON.parse(JSON.stringify(c)))!;
    const twice = migrateRun(JSON.parse(JSON.stringify(once)))!;
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });
});
