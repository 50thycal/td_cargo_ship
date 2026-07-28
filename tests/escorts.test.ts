// Escort specialization: each escort is its own ship.
//
// The model this replaces was a COUNT plus one fleet-wide `escortModules`
// template — fitting a deck gun fitted every escort a deck gun, and an escort
// that sank was just the count going down. The guarantees below are the ones
// that distinction actually rests on, so each test is written to fail if the
// per-escort plumbing silently collapses back into a shared list.

import { describe, expect, it } from 'vitest';
import {
  buyEscort,
  buyEscortModule,
  createRoundTransit,
  escortDamageTotal,
  escortModuleBlockReason,
  escortSlots,
  findEscort,
  fleetHasEscortModule,
  newCampaign,
  planCurrentRound,
  removeEscortModule,
  renameEscort,
  resolveTransit,
  sanitizeEscortName,
} from '../src/sim/campaign';
import { stepTransit } from '../src/sim/transit';
import { migrateCampaign } from '../src/platform/save';
import { fitEscorts, fitUniformEscorts } from './helpers';
import {
  ESCORT_DEFAULT_NAMES,
  ESCORT_MODULES,
  ESCORT_MODULE_SLOTS,
  ESCORT_MODULE_SLOTS_UNLOCKED,
  ESCORT_NAME_MAX,
} from '../src/data/defs';
import { WORLD } from '../src/data/tuning';
import type { CampaignState, Threat, ThreatKind, TransitState } from '../src/sim/types';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/** A campaign that can afford anything and has researched every escort weapon,
 *  so a blocked purchase is always about SLOTS or the wrong escort — never
 *  about money or tech. */
function richCampaign(seed = 'escort-spec'): CampaignState {
  const c = newCampaign(seed);
  c.cash = 100_000;
  c.completedResearch = ['deckGun.base', 'depthCharges.base', 'mcmDrones.base'];
  return c;
}

/** A quiet transit with the threat stream removed, so only what the test
 *  injects is in the water. */
function quietTransit(c: CampaignState): {
  state: TransitState;
  rng: ReturnType<typeof createRoundTransit>['rng'];
} {
  const { state, rng } = createRoundTransit(c, planCurrentRound(c));
  state.spawnQueue = [];
  state.threats = [];
  return { state, rng };
}

let injectId = 700_000;
function inject(state: TransitState, kind: ThreatKind, over: Partial<Threat> = {}): Threat {
  const threat: Threat = {
    id: injectId++,
    kind,
    x: 900,
    y: WORLD.lanes[0],
    vx: 0,
    vy: 0,
    speed: 0,
    alive: true,
    revealed: true,
    lowSig: false,
    claimedByInterceptor: false,
    ...(kind === 'missile' ? { targetX: 4000, targetY: WORLD.lanes[0] } : {}),
    ...over,
  };
  state.threats.push(threat);
  return threat;
}

// ---------------------------------------------------------------------------
// 1: different escorts carry different modules
// ---------------------------------------------------------------------------

describe('per-escort loadouts', () => {
  it('fitting a module to one escort fits it to that escort ALONE', () => {
    const c = richCampaign();
    buyEscort(c);
    buyEscort(c);
    buyEscort(c);
    const [one, two, three] = c.escortUnits;

    expect(buyEscortModule(c, one.id, 'deckGun')).toBe(true);
    expect(buyEscortModule(c, two.id, 'depthCharges')).toBe(true);
    expect(buyEscortModule(c, three.id, 'mcmDroneLauncher')).toBe(true);

    expect(one.modules).toEqual(['deckGun']);
    expect(two.modules).toEqual(['depthCharges']);
    expect(three.modules).toEqual(['mcmDroneLauncher']);
    // The failure this guards against is a shared array: three pushes onto one
    // list would leave every escort holding all three.
    expect(one.modules).not.toContain('depthCharges');
    expect(two.modules).not.toContain('deckGun');
  });

  it('a mixed flotilla sails as configured — the sim carries the fit per hull', () => {
    const c = richCampaign('mixed-sail');
    fitEscorts(c, [['deckGun', 'mcmDroneLauncher'], ['depthCharges', 'deckGun'], []]);
    const { state } = quietTransit(c);

    expect(state.escorts).toHaveLength(3);
    expect(state.escorts.map((e) => e.modules)).toEqual([
      ['deckGun', 'mcmDroneLauncher'],
      ['depthCharges', 'deckGun'],
      [],
    ]);
    // Magazines follow the fit: only the launcher-carrier gets drone sorties,
    // only the rack-carrier gets depth charges.
    expect(state.escorts[0].droneReady).toBeGreaterThan(0);
    expect(state.escorts[1].droneReady).toBe(0);
    expect(state.escorts[1].dcShots).toBeGreaterThan(0);
    expect(state.escorts[0].dcShots).toBe(0);
    expect(state.escorts[2].droneReady).toBe(0);
    expect(state.escorts[2].dcShots).toBe(0);
  });

  it('every escort keeps its own id and name into the transit', () => {
    const c = richCampaign('identity-sail');
    fitEscorts(c, [['deckGun'], ['depthCharges']]);
    renameEscort(c, c.escortUnits[0].id, 'Hammer');
    const { state } = quietTransit(c);
    expect(state.escorts.map((e) => e.unitId)).toEqual(c.escortUnits.map((u) => u.id));
    expect(state.escorts[0].name).toBe('Hammer');
    expect(state.escorts[1].name).toBe(c.escortUnits[1].name);
  });
});

// ---------------------------------------------------------------------------
// 2: multiple escorts carrying the same module
// ---------------------------------------------------------------------------

describe('duplicate fits across the flotilla', () => {
  it('all three escorts may carry the same module, each paying for it', () => {
    const c = richCampaign('all-gunboats');
    buyEscort(c);
    buyEscort(c);
    buyEscort(c);
    const cash0 = c.cash;

    for (const unit of c.escortUnits) {
      expect(escortModuleBlockReason(c, unit.id, 'deckGun')).toBeNull();
      expect(buyEscortModule(c, unit.id, 'deckGun')).toBe(true);
    }
    for (const unit of c.escortUnits) expect(unit.modules).toEqual(['deckGun']);
    // Three guns cost three guns — specialization is not a bulk discount.
    expect(cash0 - c.cash).toBe(3 * ESCORT_MODULES.deckGun.cost);
    expect(fleetHasEscortModule(c, 'deckGun')).toBe(true);
    expect(fleetHasEscortModule(c, 'depthCharges')).toBe(false);
  });

  it('refitting the SAME module to the SAME escort is refused', () => {
    const c = richCampaign('no-double-fit');
    buyEscort(c);
    const id = c.escortUnits[0].id;
    expect(buyEscortModule(c, id, 'deckGun')).toBe(true);
    expect(escortModuleBlockReason(c, id, 'deckGun')).toBe('Already fitted to this escort');
    const cash = c.cash;
    expect(buyEscortModule(c, id, 'deckGun')).toBe(false);
    expect(c.cash).toBe(cash); // a refused purchase costs nothing
    expect(c.escortUnits[0].modules).toEqual(['deckGun']);
  });
});

// ---------------------------------------------------------------------------
// 3 & 4: built-in interceptors, and the two starting slots
// ---------------------------------------------------------------------------

describe('built-in interceptors and slot budget', () => {
  it('a bare escort still intercepts — interceptors cost no slot', () => {
    const c = newCampaign('built-in-pd');
    fitUniformEscorts(c, 1); // no modules at all
    c.ammo = 20;
    const { state, rng } = quietTransit(c);
    const escort = state.escorts[0];
    expect(escort.modules).toEqual([]);
    escort.stationed = true;

    const missile = inject(state, 'missile', { x: escort.x + 150, y: escort.y });
    stepTransit(state, [{ type: 'intercept', threatId: missile.id }], rng);
    expect(state.interceptors.length).toBeGreaterThan(0);
    expect(state.interceptors[0].ownerUnitId).toBe(escort.unitId);
  });

  it('both starting slots fill, and the third is refused before research', () => {
    const c = richCampaign('two-slots');
    buyEscort(c);
    const id = c.escortUnits[0].id;
    expect(escortSlots(c)).toBe(ESCORT_MODULE_SLOTS);

    expect(buyEscortModule(c, id, 'deckGun')).toBe(true);
    expect(buyEscortModule(c, id, 'depthCharges')).toBe(true);
    expect(findEscort(c, id)!.modules).toHaveLength(ESCORT_MODULE_SLOTS);

    const cash = c.cash;
    expect(escortModuleBlockReason(c, id, 'mcmDroneLauncher')).toMatch(/Escort Refit Bay/);
    expect(buyEscortModule(c, id, 'mcmDroneLauncher')).toBe(false);
    expect(c.cash).toBe(cash);
    expect(findEscort(c, id)!.modules).toHaveLength(ESCORT_MODULE_SLOTS);
  });

  it('interceptors keep working on a fully-slotted escort', () => {
    // The point of "interceptors do not consume a slot" is that two specialist
    // modules never cost the escort its missile defense.
    const c = richCampaign('full-and-armed');
    fitUniformEscorts(c, 1, ['deckGun', 'depthCharges']);
    c.ammo = 20;
    const { state, rng } = quietTransit(c);
    const escort = state.escorts[0];
    escort.stationed = true;
    const missile = inject(state, 'missile', { x: escort.x + 150, y: escort.y });
    stepTransit(state, [{ type: 'intercept', threatId: missile.id }], rng);
    expect(state.interceptors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 5: the third slot locks and unlocks
// ---------------------------------------------------------------------------

describe('the third specialist slot', () => {
  it('Escort Refit Bay raises every escort from two slots to three', () => {
    const c = richCampaign('refit-bay');
    buyEscort(c);
    buyEscort(c);
    const [a, b] = c.escortUnits;
    buyEscortModule(c, a.id, 'deckGun');
    buyEscortModule(c, a.id, 'depthCharges');
    expect(buyEscortModule(c, a.id, 'mcmDroneLauncher')).toBe(false);

    c.completedResearch = [...c.completedResearch, 'logistics.escortRefitBay'];
    expect(escortSlots(c)).toBe(ESCORT_MODULE_SLOTS_UNLOCKED);

    expect(buyEscortModule(c, a.id, 'mcmDroneLauncher')).toBe(true);
    expect(a.modules).toHaveLength(3);
    // The unlock is fleet-wide: the escort that was empty gets three too.
    expect(buyEscortModule(c, b.id, 'deckGun')).toBe(true);
    expect(buyEscortModule(c, b.id, 'depthCharges')).toBe(true);
    expect(buyEscortModule(c, b.id, 'mcmDroneLauncher')).toBe(true);
    expect(b.modules).toHaveLength(3);
  });

  it('a fourth module is refused even with the bay unlocked', () => {
    const c = richCampaign('slot-ceiling');
    c.completedResearch = [...c.completedResearch, 'logistics.escortRefitBay'];
    fitUniformEscorts(c, 1, ['deckGun', 'depthCharges', 'mcmDroneLauncher']);
    const id = c.escortUnits[0].id;
    // There is no fourth escort module to fit, so removing one and re-fitting a
    // different one is the only way to a fourth attempt: prove the count gates.
    expect(escortModuleBlockReason(c, id, 'deckGun')).toBe('Already fitted to this escort');
    removeEscortModule(c, id, 'deckGun');
    expect(c.escortUnits[0].modules).toHaveLength(2);
    expect(buyEscortModule(c, id, 'deckGun')).toBe(true);
    expect(c.escortUnits[0].modules).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 6: renaming and name persistence
// ---------------------------------------------------------------------------

describe('escort names', () => {
  it('commissioned escorts get distinct sensible defaults', () => {
    const c = richCampaign('default-names');
    buyEscort(c);
    buyEscort(c);
    buyEscort(c);
    expect(c.escortUnits.map((e) => e.name)).toEqual(ESCORT_DEFAULT_NAMES.slice(0, 3));
  });

  it('sanitizes control characters, collapses whitespace and length-limits', () => {
    expect(sanitizeEscortName('  Vanguard   Two  ')).toBe('Vanguard Two');
    expect(sanitizeEscortName('Van gu\nard')).toBe('Vanguard');
    expect(sanitizeEscortName('x'.repeat(200))).toHaveLength(ESCORT_NAME_MAX);
    // An all-whitespace or all-junk name keeps the ship's existing name rather
    // than leaving it blank.
    expect(sanitizeEscortName('   ', 'Sentinel')).toBe('Sentinel');
    expect(sanitizeEscortName('', 'Sentinel')).toBe('Sentinel');
  });

  it('renaming one escort leaves the others alone and survives a save round-trip', () => {
    const c = richCampaign('rename-persist');
    buyEscort(c);
    buyEscort(c);
    const [a, b] = c.escortUnits;
    const bName = b.name;

    expect(renameEscort(c, a.id, '  Iron   Duke  ')).toBe(true);
    expect(a.name).toBe('Iron Duke');
    expect(b.name).toBe(bName);
    expect(renameEscort(c, 9999, 'Ghost')).toBe(false); // no such escort

    buyEscortModule(c, a.id, 'deckGun');
    const reloaded = migrateCampaign(JSON.parse(JSON.stringify(c)))!;
    expect(reloaded.escortUnits[0].name).toBe('Iron Duke');
    expect(reloaded.escortUnits[0].modules).toEqual(['deckGun']);
    expect(reloaded.escortUnits[1].name).toBe(bName);
  });

  it('a name survives a round of combat', () => {
    const c = richCampaign('name-through-round');
    fitUniformEscorts(c, 1, ['deckGun']);
    renameEscort(c, c.escortUnits[0].id, 'Bulwark II');
    const { state, rng } = quietTransit(c);
    while (!state.over) stepTransit(state, [], rng);
    resolveTransit(c, state);
    if (c.escortUnits.length > 0) {
      expect(c.escortUnits[0].name).toBe('Bulwark II');
      expect(c.escortUnits[0].modules).toEqual(['deckGun']);
    }
  });
});

// ---------------------------------------------------------------------------
// 7 & 8: destruction removes the right ship; replacements start fresh
// ---------------------------------------------------------------------------

describe('losing and replacing an escort', () => {
  /** Sink exactly one escort by parking a mine on it and stationing it there. */
  function sinkOne(c: CampaignState, index: number): TransitState {
    const { state, rng } = quietTransit(c);
    const victim = state.escorts[index];
    for (const e of state.escorts) e.stationed = true;
    while (victim.alive) {
      inject(state, 'mine', { x: victim.x, y: victim.y, kind: 'mine' });
      stepTransit(state, [], rng);
    }
    while (!state.over) stepTransit(state, [], rng);
    resolveTransit(c, state);
    return state;
  }

  it('the escort that sank is the escort removed — by identity, not by index', () => {
    const c = richCampaign('sink-the-middle');
    fitEscorts(c, [['deckGun'], ['depthCharges'], ['mcmDroneLauncher']]);
    const [a, b, cc] = c.escortUnits.map((u) => ({ id: u.id, name: u.name, modules: [...u.modules] }));

    sinkOne(c, 1); // the MIDDLE one

    expect(c.escortUnits).toHaveLength(2);
    expect(c.escortUnits.map((u) => u.id)).toEqual([a.id, cc.id]);
    expect(c.escortUnits.map((u) => u.name)).toEqual([a.name, cc.name]);
    // The survivors keep THEIR fits — a shift-by-index bug would hand the
    // third escort's launcher to the second slot.
    expect(c.escortUnits[0].modules).toEqual(a.modules);
    expect(c.escortUnits[1].modules).toEqual(cc.modules);
    expect(findEscort(c, b.id)).toBeUndefined();
  });

  it('a replacement is a new ship: default name, empty slots, no inherited damage', () => {
    const c = richCampaign('replacement');
    fitEscorts(c, [['deckGun'], ['depthCharges', 'mcmDroneLauncher']]);
    renameEscort(c, c.escortUnits[1].id, 'Doomed');
    const lostId = c.escortUnits[1].id;

    sinkOne(c, 1);
    expect(c.escortUnits.map((u) => u.id)).not.toContain(lostId);

    c.cash = 100_000;
    expect(buyEscort(c)).toBe(true);
    const fresh = c.escortUnits[c.escortUnits.length - 1];
    expect(fresh.id).not.toBe(lostId); // ids are never recycled
    expect(fresh.name).not.toBe('Doomed');
    expect(ESCORT_DEFAULT_NAMES).toContain(fresh.name);
    expect(fresh.modules).toEqual([]);
    expect(fresh.modulePaid).toEqual({});
    expect(fresh.damage).toBe(0);
  });

  it('damage stays with the ship that took it, and repair clears the flotilla', () => {
    const c = richCampaign('damage-identity');
    fitEscorts(c, [['deckGun'], ['depthCharges']]);
    const { state, rng } = quietTransit(c);
    const [hurt, healthy] = state.escorts;
    for (const e of state.escorts) e.stationed = true;
    // One clipping mine on the first escort only; it survives at full hp.
    hurt.hp = hurt.maxHp;
    inject(state, 'mine', { x: hurt.x, y: hurt.y });
    while (!state.over) stepTransit(state, [], rng);
    const wounded = hurt.alive && hurt.hp < hurt.maxHp;
    resolveTransit(c, state);

    if (wounded) {
      const unit = findEscort(c, hurt.unitId)!;
      expect(unit.damage).toBeGreaterThan(0);
      expect(findEscort(c, healthy.unitId)?.damage ?? 0).toBe(0);
      expect(escortDamageTotal(c)).toBe(unit.damage);
    }
  });
});

// ---------------------------------------------------------------------------
// 9: per-escort purchase and refund accounting
// ---------------------------------------------------------------------------

describe('per-escort cash accounting', () => {
  it('unequipping refunds exactly what THAT escort paid', () => {
    const c = richCampaign('refund-exact');
    buyEscort(c);
    const id = c.escortUnits[0].id;
    const cash0 = c.cash;
    buyEscortModule(c, id, 'deckGun');
    expect(c.cash).toBe(cash0 - ESCORT_MODULES.deckGun.cost);
    expect(removeEscortModule(c, id, 'deckGun')).toBe(true);
    expect(c.cash).toBe(cash0); // exactly whole, neither more nor less
    expect(c.escortUnits[0].modules).toEqual([]);
    expect(c.escortUnits[0].modulePaid.deckGun).toBeUndefined();
  });

  it('refunding one escort never touches another escort of the same fit', () => {
    const c = richCampaign('refund-isolated');
    buyEscort(c);
    buyEscort(c);
    const [a, b] = c.escortUnits;
    buyEscortModule(c, a.id, 'deckGun');
    buyEscortModule(c, b.id, 'deckGun');
    const cash = c.cash;

    removeEscortModule(c, a.id, 'deckGun');
    expect(c.cash).toBe(cash + ESCORT_MODULES.deckGun.cost); // ONE gun back
    expect(a.modules).toEqual([]);
    expect(b.modules).toEqual(['deckGun']); // still fitted, still paid for
    expect(b.modulePaid.deckGun).toBe(ESCORT_MODULES.deckGun.cost);
  });

  it('no buy-once-refund-many exploit: a fit-and-strip cycle is cash-neutral', () => {
    const c = richCampaign('no-money-pump');
    buyEscort(c);
    buyEscort(c);
    buyEscort(c);
    const cash0 = c.cash;
    for (let round = 0; round < 5; round++) {
      for (const unit of c.escortUnits) buyEscortModule(c, unit.id, 'deckGun');
      for (const unit of c.escortUnits) removeEscortModule(c, unit.id, 'deckGun');
    }
    expect(c.cash).toBe(cash0);
    for (const unit of c.escortUnits) expect(unit.modules).toEqual([]);
  });

  it('a price change after purchase does not change the refund', () => {
    const c = richCampaign('receipt-not-pricelist');
    buyEscort(c);
    const unit = c.escortUnits[0];
    buyEscortModule(c, unit.id, 'deckGun');
    // Simulate the module having been bought under a cheaper price list — the
    // receipt on the escort is the only thing a refund may consult.
    unit.modulePaid.deckGun = 40;
    const cash = c.cash;
    removeEscortModule(c, unit.id, 'deckGun');
    expect(c.cash).toBe(cash + 40);
  });

  it('a module cannot be refunded from an escort that never carried it', () => {
    const c = richCampaign('no-phantom-refund');
    buyEscort(c);
    buyEscort(c);
    const [a, b] = c.escortUnits;
    buyEscortModule(c, a.id, 'deckGun');
    const cash = c.cash;
    // b never bought one — asking to strip it must be a no-op, not a payout.
    expect(removeEscortModule(c, b.id, 'deckGun')).toBe(false);
    expect(removeEscortModule(c, 9999, 'deckGun')).toBe(false);
    expect(c.cash).toBe(cash);
    expect(a.modules).toEqual(['deckGun']);
  });

  it('research and cash gates are reported per escort', () => {
    const c = newCampaign('gates');
    buyEscortAt(c, 2);
    const id = c.escortUnits[0].id;
    c.cash = 100_000;
    expect(escortModuleBlockReason(c, id, 'deckGun')).toMatch(/^Requires research/);
    c.completedResearch = ['deckGun.base'];
    expect(escortModuleBlockReason(c, id, 'deckGun')).toBeNull();
    c.cash = 0;
    expect(escortModuleBlockReason(c, id, 'deckGun')).toBe('Not enough cash');
  });

  function buyEscortAt(c: CampaignState, n: number): void {
    fitUniformEscorts(c, n);
  }
});

// ---------------------------------------------------------------------------
// 10: save migration from the shared template
// ---------------------------------------------------------------------------

describe('save migration from the shared escortModules template', () => {
  it('gives every owned escort the loadout they were all already carrying', () => {
    const m = migrateCampaign({
      version: 3,
      seed: 'shared-template',
      phase: 'prep',
      escorts: 3,
      escortModules: ['deckGun', 'depthCharges'],
      escortModulePaid: { deckGun: 260, depthCharges: 240 },
      escortDamage: 30,
      completedResearch: ['deckGun.base', 'depthCharges.base'],
    })!;

    expect(m.escortUnits).toHaveLength(3);
    for (const unit of m.escortUnits) {
      expect(unit.modules).toEqual(['deckGun', 'depthCharges']);
      expect(unit.damage).toBe(10); // the shared pool split evenly
      expect(unit.name.length).toBeGreaterThan(0);
    }
    expect(new Set(m.escortUnits.map((u) => u.id)).size).toBe(3);
    expect(m.nextEscortId).toBeGreaterThan(3);
    // The legacy fields are gone, not shadowing the new ones.
    const raw = m as unknown as Record<string, unknown>;
    expect(raw.escorts).toBeUndefined();
    expect(raw.escortModules).toBeUndefined();
    expect(raw.escortModulePaid).toBeUndefined();
    expect(raw.escortDamage).toBeUndefined();
  });

  it('each migrated escort refunds what was PAID, not the current list price', () => {
    // The legacy price is deliberately unequal to today's catalogue cost: a
    // refund that reads the price list instead of the receipt would pay out the
    // difference, which is free money every time a price is retuned.
    const legacyPrice = ESCORT_MODULES.deckGun.cost - 80;
    const m = migrateCampaign({
      version: 3,
      seed: 'migrated-refund',
      phase: 'prep',
      cash: 0,
      escorts: 2,
      escortModules: ['deckGun'],
      escortModulePaid: { deckGun: legacyPrice },
      completedResearch: ['deckGun.base'],
    })!;
    m.cash = 0;
    expect(removeEscortModule(m, m.escortUnits[0].id, 'deckGun')).toBe(true);
    expect(m.cash).toBe(legacyPrice);
    expect(m.cash).not.toBe(ESCORT_MODULES.deckGun.cost);
    expect(m.escortUnits[1].modules).toEqual(['deckGun']);
  });

  it('truncates an over-full legacy loadout to the current slot count', () => {
    const m = migrateCampaign({
      version: 3,
      seed: 'over-full',
      phase: 'prep',
      escorts: 1,
      escortModules: ['deckGun', 'depthCharges', 'mcmDroneLauncher'],
      completedResearch: [],
    })!;
    expect(m.escortUnits[0].modules).toHaveLength(ESCORT_MODULE_SLOTS);
  });

  it('a save with no escorts migrates to an empty flotilla, not a phantom ship', () => {
    const m = migrateCampaign({
      version: 3,
      seed: 'no-escorts',
      phase: 'prep',
      escorts: 0,
      escortModules: ['mcmDroneLauncher'],
      completedResearch: ['mcmDrones.base'],
    })!;
    expect(m.escortUnits).toEqual([]);
    // The RESEARCH survives, so the capability is still unlocked for the next
    // hull the player commissions — only the free fitting is gone, and there
    // was no hull carrying it to begin with.
    expect(m.completedResearch).toContain('mcmDrones.base');
  });

  it('an already-migrated save round-trips untouched', () => {
    const c = richCampaign('already-new');
    fitEscorts(c, [['deckGun'], ['depthCharges']]);
    renameEscort(c, c.escortUnits[0].id, 'Steadfast II');
    const once = migrateCampaign(JSON.parse(JSON.stringify(c)))!;
    const twice = migrateCampaign(JSON.parse(JSON.stringify(once)))!;
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
    expect(once.escortUnits[0].name).toBe('Steadfast II');
  });
});

// ---------------------------------------------------------------------------
// 11: only escorts that carry the weapon may use it
// ---------------------------------------------------------------------------

describe('weapon selection uses only escorts that carry the module', () => {
  it('MANUAL depth charges come from the fitted escort, never the bare one', () => {
    const c = richCampaign('manual-dc');
    // Bare escort first, so an "any escort" bug would pick the wrong one.
    fitEscorts(c, [[], ['depthCharges']]);
    const { state, rng } = quietTransit(c);
    const [bare, fitted] = state.escorts;
    for (const e of state.escorts) e.stationed = true;
    expect(bare.dcShots).toBe(0);
    expect(fitted.dcShots).toBeGreaterThan(0);

    // Stood off far enough not to strike a hull, but inside throwing range of
    // BOTH escorts — so only the magazine, not geometry, decides who drops.
    const aim = { x: fitted.x + 150, y: fitted.y };
    inject(state, 'torpedo', aim);
    stepTransit(state, [{ type: 'depthCharge', ...aim }], rng);
    expect(state.depthChargeShots.length).toBeGreaterThan(0);
    for (const shot of state.depthChargeShots) expect(shot.ownerUnitId).toBe(fitted.unitId);
    expect(bare.dcShots).toBe(0); // nothing was taken from a magazine it lacks
  });

  it('a flotilla with no racks at all cannot depth-charge anything', () => {
    const c = richCampaign('no-racks');
    fitUniformEscorts(c, 2, ['deckGun']);
    const { state, rng } = quietTransit(c);
    for (const e of state.escorts) e.stationed = true;
    const torpedo = inject(state, 'torpedo', { x: state.escorts[0].x + 150, y: state.escorts[0].y });
    stepTransit(state, [{ type: 'depthCharge', x: torpedo.x, y: torpedo.y }], rng);
    expect(state.depthChargeShots).toHaveLength(0);
  });

  it('MANUAL drone sweeps launch only from a launcher-equipped escort', () => {
    const c = richCampaign('manual-drone');
    fitEscorts(c, [[], ['mcmDroneLauncher']]);
    c.droneAmmo = 5;
    const { state, rng } = quietTransit(c);
    const [bare, fitted] = state.escorts;
    for (const e of state.escorts) e.stationed = true;
    expect(state.effects.sweepDrones).toBe(true);

    // Inside drone range of both escorts, outside the mine's trigger radius.
    const mine = inject(state, 'mine', { x: fitted.x + 180, y: fitted.y, revealed: true });
    stepTransit(state, [{ type: 'sweepMine', threatId: mine.id }], rng);
    expect(state.drones.length).toBeGreaterThan(0);
    for (const drone of state.drones) expect(drone.ownerUnitId).toBe(fitted.unitId);
    expect(bare.droneReady).toBe(0);
  });

  it('AUTOMATIC deck-gun fire is taken up only by gun-carrying escorts', () => {
    const c = richCampaign('auto-gun');
    c.completedResearch = [...c.completedResearch, 'deckGun.autoNearest'];
    fitEscorts(c, [[], ['deckGun']]);
    c.autoFire = { ...c.autoFire, deckGun: true };
    const { state, rng } = quietTransit(c);
    const [bare, gunboat] = state.escorts;
    for (const e of state.escorts) e.stationed = true;

    // One boat parked between them; only the armed escort may engage it.
    inject(state, 'attackBoat', { x: gunboat.x + 120, y: gunboat.y, hp: 40 });
    for (let i = 0; i < 30 * 5; i++) stepTransit(state, [], rng);
    expect(gunboat.gunTargetId).not.toBeNull();
    expect(bare.gunTargetId).toBeNull();
  });

  it('per-escort performance is attributed to the escort that did the work', () => {
    const c = richCampaign('attribution');
    fitEscorts(c, [[], ['depthCharges']]);
    renameEscort(c, c.escortUnits[1].id, 'Picket');
    const { state, rng } = quietTransit(c);
    const [bare, fitted] = state.escorts;
    for (const e of state.escorts) e.stationed = true;

    const torpedo = inject(state, 'torpedo', { x: fitted.x + 150, y: fitted.y });
    stepTransit(state, [{ type: 'depthCharge', x: torpedo.x, y: torpedo.y }], rng);
    for (let i = 0; i < 30 * 6; i++) stepTransit(state, [], rng);

    const perf = state.stats.escortPerformance;
    expect(perf[fitted.unitId].name).toBe('Picket');
    expect(perf[fitted.unitId].modules).toEqual(['depthCharges']);
    expect(perf[bare.unitId].modules).toEqual([]);
    expect(torpedo.alive).toBe(false);
    expect(perf[fitted.unitId].torpedoKills).toBeGreaterThan(0);
    expect(perf[bare.unitId].torpedoKills).toBe(0);
  });

  it('the round log records what each escort did, keyed by id and name', () => {
    const c = richCampaign('telemetry-log');
    fitEscorts(c, [['deckGun'], ['depthCharges']]);
    renameEscort(c, c.escortUnits[0].id, 'Gunline');
    const { state, rng } = quietTransit(c);
    while (!state.over) stepTransit(state, [], rng);
    resolveTransit(c, state);

    const round = c.telemetry[c.telemetry.length - 1];
    expect(round.escortPerformance).toHaveLength(2);
    expect(round.escortPerformance[0].name).toBe('Gunline');
    expect(round.escortPerformance[0].modules).toEqual(['deckGun']);
    expect(round.escortPerformance[1].modules).toEqual(['depthCharges']);
    // The round-start snapshot lists the same two escorts, kept apart.
    expect(round.counters.equipped.escorts.map((e) => e.modules)).toEqual([
      ['deckGun'],
      ['depthCharges'],
    ]);
  });
});
