// Region Workshop — data contract, compiler, migration snapshot and runtime.
//
//   • packaged regions round-trip through the authored form WITHOUT changing
//     their runtime configuration (the migration/snapshot guarantee);
//   • cumulative milestones, gate clamping and removals resolve as designed;
//   • validation blocks every error class the spec lists;
//   • the adaptive buyer honours node windows, per-round pressure and beats,
//     and the same seed + JSON replays identically;
//   • the draft store round-trips, imports and registers for play.

import { describe, expect, it, beforeEach } from 'vitest';
import {
  availabilityAtRound,
  blankRegion,
  compileRegion,
  contentHash,
  deleteRound,
  fromRegionDef,
  insertRound,
  migrateRegionAuthoring,
  pressureAtRound,
  toRegionDef,
  validateRegionAuthoring,
  type RegionAuthoringDef,
} from '../src/data/regionAuthoring';
import { ENEMY_BRANCHES } from '../src/data/enemyBranches';
import { ENEMY_ECONOMY } from '../src/data/tuning';
import { REGIONS, REGION_ORDER, regionDef, registerCustomRegion, unregisterCustomRegion } from '../src/data/regions';
import { newEvolution, evolveEnemy, planRound } from '../src/sim/evolution';
import { newRegionalRun, newWorkshopPlaytest, planCurrentRound } from '../src/sim/campaign';
import { makeRng } from '../src/sim/rng';
import type { RoundMetrics } from '../src/sim/types';
import {
  deleteDraft,
  libraryEntries,
  listDrafts,
  parseImport,
  registerSavedDrafts,
  saveDraft,
  useWorkshopStore,
} from '../src/platform/workshopStore';
import { buildTelemetryExport } from '../src/sim/telemetry';

function metrics(round: number, over: Partial<RoundMetrics> = {}): RoundMetrics {
  return {
    round,
    interceptRate: 0.5,
    formation: 'tight',
    mineDetectRate: -1,
    torpedoDetectRate: -1,
    valueSent: 241,
    deliveredFraction: 0.8,
    ...over,
  };
}

/** Strip the provenance stamp so a derived def can be compared to its source. */
function runtimeShape(def: ReturnType<typeof toRegionDef>) {
  const { authoring, ...rest } = def;
  void authoring;
  return rest;
}

describe('packaged regions as templates (migration snapshot)', () => {
  for (const id of REGION_ORDER) {
    it(`${id}: authored → compiled → RegionDef matches the packaged definition`, () => {
      const packaged = REGIONS[id];
      const authored = fromRegionDef(packaged);
      const v = validateRegionAuthoring(authored, undefined, undefined, { packagedIds: REGION_ORDER });
      expect(v.errors).toEqual([]);
      const back = runtimeShape(toRegionDef(compileRegion(authored)));
      // The packaged def with its optional fields normalised the way the
      // compiler emits them (geography explicit; absent maps stay absent).
      // `enemyBranches` is a SET to the sim (only ever `.includes`d), so the
      // compiler emits it in catalogue order and it is compared as one.
      const expected = { ...packaged, geography: packaged.geography ?? 'strait' };
      expect(new Set(back.enemyBranches)).toEqual(new Set(expected.enemyBranches));
      expect({ ...back, enemyBranches: [] }).toEqual({ ...expected, enemyBranches: [] });
    });
  }

  it('Missile Coast: eight rounds, squeeze, missiles only, the real budget and ceiling', () => {
    const a = fromRegionDef(REGIONS.missileCoast);
    expect(a.completionRound).toBe(8);
    expect(a.environmentPresetId).toBe('coastalSqueeze');
    expect(a.pressure.defaultBudget).toEqual({ base: 88, perRound: 98, cap: 2750 });
    expect(a.pressure.defaultBranchCeilings).toEqual({ missiles: 400 });
    expect(a.campaign).toEqual({ completionXp: 60, unlocks: 'homeStrait' });
    expect(a.start).toEqual(REGIONS.missileCoast.start);
    // Resolved catalogue gates, not one generic missile bar.
    const c = compileRegion(a);
    expect(availabilityAtRound(c, 1).map((x) => x.node.id)).toEqual(['unguided']);
    expect(availabilityAtRound(c, 2).map((x) => x.node.id)).toEqual(['unguided', 'guided']);
    expect(availabilityAtRound(c, 2).find((x) => x.node.id === 'guided')?.introducedThisRound).toBe(true);
    // Unimplemented nodes never enter a playable template.
    expect(a.milestones.flatMap((m) => m.add).some((r) => r.nodeId === 'seaSkimming')).toBe(false);
  });

  it('Home Strait: strait, missiles + mines, global economy budget', () => {
    const a = fromRegionDef(REGIONS.homeStrait);
    expect(a.environmentPresetId).toBe('openWater');
    expect(a.pressure.defaultBudget).toBeNull();
    const c = compileRegion(a);
    expect(availabilityAtRound(c, 2).some((x) => x.branch === 'mines')).toBe(false);
    expect(availabilityAtRound(c, 3).some((x) => x.node.id === 'standard')).toBe(true);
    expect(availabilityAtRound(c, 5).some((x) => x.node.id === 'lowSig')).toBe(true);
    expect(pressureAtRound(c, 3).budget).toBe(
      Math.min(ENEMY_ECONOMY.budgetCap, ENEMY_ECONOMY.budgetBase + ENEMY_ECONOMY.budgetPerRound * 3),
    );
  });

  it('a run on a packaged region has a byte-identical economy before and after the workshop', () => {
    const before = newRegionalRun('snap', 'missileCoast').evolution.economy;
    const region = toRegionDef(compileRegion(fromRegionDef(REGIONS.missileCoast)));
    const after = newEvolution(region).economy;
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });
});

describe('compiler semantics', () => {
  function custom(): RegionAuthoringDef {
    const def = blankRegion('lab', REGIONS.missileCoast.start);
    def.completionRound = 8;
    def.milestones = [
      { round: 1, add: [{ branch: 'missiles', nodeId: 'unguided' }] },
      // Authored on round 1 — the catalogue gate (2) wins.
      { round: 1, add: [{ branch: 'missiles', nodeId: 'guided' }] },
    ];
    return def;
  }

  it('rounds are cumulative: added on N, active on N+1.. without re-entry', () => {
    const def = custom();
    def.milestones = [
      { round: 1, add: [{ branch: 'missiles', nodeId: 'unguided' }] },
      { round: 4, add: [{ branch: 'mines', nodeId: 'standard' }] },
      { round: 6, remove: [{ branch: 'mines', nodeId: 'standard' }], add: [] },
    ];
    const c = compileRegion(def);
    const ids = (r: number) => availabilityAtRound(c, r).map((x) => `${x.branch}:${x.node.id}`);
    expect(ids(3)).toEqual(['missiles:unguided']);
    expect(ids(4)).toEqual(['missiles:unguided', 'mines:standard']);
    expect(ids(5)).toEqual(['missiles:unguided', 'mines:standard']);
    expect(ids(6)).toEqual(['missiles:unguided', 'mines:standard']); // removal round is the last
    expect(ids(7)).toEqual(['missiles:unguided']);
  });

  it('a region may introduce a capability earlier than its catalogue default — warned, never blocked', () => {
    const def = custom();
    // Two milestones on round 1 is itself an error; merge them here.
    def.milestones = [
      { round: 1, add: [{ branch: 'missiles', nodeId: 'unguided' }, { branch: 'missiles', nodeId: 'guided' }] },
    ];
    const v = validateRegionAuthoring(def);
    expect(v.errors).toEqual([]); // early introduction never blocks
    expect(v.warnings.map((w) => w.code)).toContain('beforeGate');
    const c = compileRegion(def);
    // The AUTHORED round is the round — no clamp to the catalogue gate.
    expect(availabilityAtRound(c, 1).map((x) => x.node.id)).toEqual(['unguided', 'guided']);
    expect(availabilityAtRound(c, 1).find((x) => x.node.id === 'guided')?.introducedThisRound).toBe(true);
  });

  it('a region may still delay a capability past its catalogue default, as before', () => {
    const def = custom();
    def.milestones = [{ round: 4, add: [{ branch: 'missiles', nodeId: 'unguided' }] }];
    const v = validateRegionAuthoring(def);
    expect(v.errors).toEqual([]);
    expect(v.warnings.map((w) => w.code)).not.toContain('beforeGate');
    const c = compileRegion(def);
    expect(availabilityAtRound(c, 3).map((x) => x.node.id)).toEqual([]);
    expect(availabilityAtRound(c, 4).map((x) => x.node.id)).toEqual(['unguided']);
  });

  it('per-round pressure: override, multiplier and ceilings resolve per round', () => {
    const def = custom();
    def.milestones = [
      { round: 1, add: [{ branch: 'missiles', nodeId: 'unguided' }] },
      { round: 3, add: [], pressure: { budgetOverride: 999, branchCeilings: { missiles: 20 } } },
      { round: 4, add: [], pressure: { budgetMultiplier: 2 } },
    ];
    def.pressure.defaultBudget = { base: 100, perRound: 10, cap: 5000 };
    const c = compileRegion(def);
    expect(pressureAtRound(c, 2).budget).toBe(120);
    expect(pressureAtRound(c, 3).budget).toBe(999);
    expect(pressureAtRound(c, 4).budget).toBe(280);
    expect(pressureAtRound(c, 3).branchCeilings).toEqual({ missiles: 20 });
    expect(pressureAtRound(c, 8).branchCeilings).toEqual({ missiles: 20 }); // ceilings are cumulative too
  });

  it('insert/delete round shifts later milestones so pacing stays attached', () => {
    const def = custom();
    def.milestones = [
      { round: 1, add: [{ branch: 'missiles', nodeId: 'unguided' }] },
      { round: 5, add: [{ branch: 'mines', nodeId: 'standard' }], label: 'Mines' },
    ];
    insertRound(def, 3);
    expect(def.completionRound).toBe(9);
    expect(def.milestones.map((m) => m.round)).toEqual([1, 6]);
    deleteRound(def, 2);
    expect(def.completionRound).toBe(8);
    expect(def.milestones.map((m) => m.round)).toEqual([1, 5]);
  });

  it('content hash is stable for identical JSON and changes with any edit', () => {
    const a = custom();
    const b = JSON.parse(JSON.stringify(a)) as RegionAuthoringDef;
    expect(contentHash(a)).toBe(contentHash(b));
    b.name = 'Other';
    expect(contentHash(a)).not.toBe(contentHash(b));
  });
});

describe('validation', () => {
  function base(): RegionAuthoringDef {
    const def = blankRegion('valid', REGIONS.missileCoast.start);
    def.completionRound = 6;
    def.milestones = [{ round: 1, add: [{ branch: 'missiles', nodeId: 'unguided' }] }];
    return def;
  }
  const codes = (def: RegionAuthoringDef) =>
    validateRegionAuthoring(def, undefined, undefined, { packagedIds: REGION_ORDER }).errors.map((e) => e.code);

  it('accepts a minimal valid region', () => {
    expect(codes(base())).toEqual([]);
  });
  it('rejects bad ids, rounds and environments', () => {
    const d = base();
    d.id = '9 bad id';
    d.completionRound = 0;
    d.environmentPresetId = 'nowhere';
    expect(codes(d)).toEqual(expect.arrayContaining(['id', 'completionRound', 'environment']));
  });
  it('rejects milestones outside the region and unknown references', () => {
    const d = base();
    d.milestones.push({ round: 9, add: [{ branch: 'lasers' as never, nodeId: 'x' }] });
    d.milestones.push({ round: 2, add: [{ branch: 'missiles', nodeId: 'nope', tacticIds: ['t9'] }] });
    expect(codes(d)).toEqual(expect.arrayContaining(['milestoneOutside', 'unknownBranch', 'unknownNode']));
  });
  it('rejects unimplemented capabilities and removal before introduction; warns (does not reject) an early introduction', () => {
    const d = base();
    d.completionRound = 12;
    d.milestones.push({ round: 6, add: [{ branch: 'missiles', nodeId: 'seaSkimming' }] });
    d.milestones.push({ round: 2, add: [{ branch: 'mines', nodeId: 'standard' }] });
    d.milestones.push({ round: 3, add: [], remove: [{ branch: 'torpedoes', nodeId: 'straight' }] });
    expect(codes(d)).toEqual(expect.arrayContaining(['unimplemented', 'removeBeforeIntro']));
    expect(codes(d)).not.toContain('beforeGate');
    const warnings = validateRegionAuthoring(d, undefined, undefined, { packagedIds: REGION_ORDER }).warnings.map((w) => w.code);
    expect(warnings).toContain('beforeGate');
  });
  it('rejects fabricated mount/platform components', () => {
    const d = base();
    (d.milestones[0].add[0] as unknown as Record<string, unknown>).mountId = 'rail';
    expect(codes(d)).toContain('unknownComponent');
  });
  it('rejects unlock self-loops and missing packaged targets', () => {
    const d = base();
    d.campaign.unlocks = 'valid';
    expect(codes(d)).toContain('unlocks');
    d.campaign.unlocks = 'notARegion';
    expect(codes(d)).toContain('unlocks');
    d.campaign.unlocks = 'homeStrait';
    expect(codes(d)).toEqual([]);
  });
  it('rejects beats that are unavailable, over the ceiling, or malformed', () => {
    const d = base();
    d.milestones[0].beats = [
      { id: 'b1', pattern: 'salvo', ref: { branch: 'mines', nodeId: 'standard' }, units: 3, budget: 'charged' },
      { id: 'b2', pattern: 'salvo', ref: { branch: 'missiles', nodeId: 'unguided' }, units: 500, budget: 'charged' },
      { id: 'b2', pattern: 'zigzag' as never, ref: { branch: 'missiles', nodeId: 'unguided' }, units: 0, budget: 'free' as never },
    ];
    expect(codes(d)).toEqual(
      expect.arrayContaining(['beatUnavailable', 'beatOverCeiling', 'beatId', 'beatPattern', 'beatBudget', 'beatUnits']),
    );
  });
  it('rejects negative or non-finite budget values', () => {
    const d = base();
    d.pressure.defaultBudget = { base: -1, perRound: NaN, cap: Infinity };
    expect(codes(d).filter((c) => c === 'budget')).toHaveLength(3);
  });
  it('warns (does not block) on empty rounds and dominant beats', () => {
    const d = base();
    d.milestones = [{ round: 3, add: [{ branch: 'mines', nodeId: 'standard' }] }];
    d.pressure.defaultBudget = { base: 100, perRound: 0, cap: 100 };
    d.milestones[0].beats = [
      { id: 'b', pattern: 'cluster', ref: { branch: 'mines', nodeId: 'standard' }, units: 2, budget: 'charged' },
    ];
    const v = validateRegionAuthoring(d);
    expect(v.ok).toBe(true);
    const w = v.warnings.map((x) => x.code);
    expect(w).toContain('emptyRound');
    expect(w).toContain('beatDominates');
    expect(v.warnings.find((x) => x.code === 'emptyRound')?.round).toBe(1);
  });
  it('issues point at the responsible round and capability', () => {
    const d = base();
    d.milestones.push({ round: 2, add: [{ branch: 'mines', nodeId: 'standard' }] });
    const issue = validateRegionAuthoring(d).warnings.find((w) => w.code === 'beforeGate')!;
    expect(issue.round).toBe(2);
    expect(issue.ref).toEqual({ branch: 'mines', nodeId: 'standard' });
  });
});

describe('migration', () => {
  it('rejects unknown future versions without loading anything', () => {
    expect(migrateRegionAuthoring({ schemaVersion: 2, id: 'x' }).ok).toBe(false);
    expect(migrateRegionAuthoring({ id: 'x' }).ok).toBe(false);
    expect(migrateRegionAuthoring('nope').ok).toBe(false);
  });
  it('loads v1 and fills absent optional containers', () => {
    const r = migrateRegionAuthoring({ schemaVersion: 1, id: 'x', milestones: [{ round: 1 }] });
    expect(r.ok).toBe(true);
    expect(r.def?.milestones[0].add).toEqual([]);
    expect(r.def?.pressure.defaultBranchCeilings).toEqual({});
  });
});

describe('runtime integration', () => {
  function labRegion(): RegionAuthoringDef {
    const def = blankRegion('lab', REGIONS.missileCoast.start);
    def.name = 'Lab';
    def.completionRound = 8;
    def.environmentPresetId = 'headlands';
    def.shapeType = 'headlands';
    def.pressure.defaultBudget = { base: 200, perRound: 100, cap: 3000 };
    def.milestones = [
      { round: 1, add: [{ branch: 'missiles', nodeId: 'unguided' }] },
      // Guided DELAYED to round 4 (gate is 2); mines from 3; guided removed after 5.
      {
        round: 3,
        add: [{ branch: 'mines', nodeId: 'standard' }],
        intelWarning: 'Authored: drifting minefields expected.',
      },
      {
        round: 4,
        add: [{ branch: 'missiles', nodeId: 'guided' }],
        beats: [
          { id: 'salvo4', pattern: 'salvo', ref: { branch: 'missiles', nodeId: 'guided' }, units: 6, groups: 2, budget: 'charged' },
        ],
        pressure: { budgetOverride: 700 },
      },
      { round: 5, add: [], remove: [{ branch: 'missiles', nodeId: 'guided' }] },
    ];
    return def;
  }

  beforeEach(() => unregisterCustomRegion('lab'));

  it('compiles to a RegionDef with derived legacy fields and node windows', () => {
    const region = toRegionDef(compileRegion(labRegion()));
    expect(region.enemyBranches).toEqual(['missiles', 'mines']);
    expect(region.branchDebutRounds).toBeUndefined(); // mines at 3 = catalogue open round
    expect(region.nodeWindows).toEqual({ 'missiles:guided': [{ from: 4, until: 5 }] });
    expect(region.roundPressure).toEqual({ 4: { budgetOverride: 700 } });
    expect(region.beats?.[0]).toMatchObject({ id: 'salvo4', round: 4, nodeId: 'guided', units: 6, groups: 2 });
    expect(region.geography).toBe('headlands');
    expect(region.intelWarnings).toEqual({ 3: 'Authored: drifting minefields expected.' });
  });

  it('the adaptive buyer honours node windows, the override and the beat', () => {
    const region = toRegionDef(compileRegion(labRegion()));
    const evo = newEvolution(region);
    const rng = makeRng('lab');
    // Hard-counter missiles so the allocator WANTS guided as early as possible.
    const guidedAt: Record<number, number> = {};
    for (let r = 1; r <= 7; r++) {
      evolveEnemy(evo, metrics(r, { interceptRate: 0.9 }), rng);
      guidedAt[r + 1] = evo.economy.ledgers.missiles.units.guided ?? 0;
      if (r + 1 === 4) {
        expect(evo.economy.budget).toBe(700);
        expect(evo.economy.authoredUnits).toEqual({ guided: 6 });
        expect(evo.economy.authoredSpend).toBe(6 * ENEMY_BRANCHES.missiles.nodes[1].cost);
      }
    }
    expect(guidedAt[2]).toBe(0); // scripted debut also held by the window
    expect(guidedAt[3]).toBe(0);
    expect(guidedAt[4]).toBeGreaterThanOrEqual(6);
    expect(guidedAt[6]).toBe(0); // removed after round 5
    expect(guidedAt[7]).toBe(0);
  });

  it('the adaptive buyer can open and buy a node introduced before its catalogue gate', () => {
    // Torpedoes gate at round 5 in the catalogue; windowed here from round 1 —
    // full freedom, not just a delay. Proves candidateBranches/availableNodes
    // in evolution.ts honour an early window, not just the compiler's menu.
    const def = blankRegion('early', REGIONS.missileCoast.start);
    def.completionRound = 6;
    def.pressure.defaultBudget = { base: 400, perRound: 100, cap: 3000 };
    def.milestones = [
      { round: 1, add: [{ branch: 'missiles', nodeId: 'unguided' }, { branch: 'torpedoes', nodeId: 'straight' }] },
    ];
    expect(validateRegionAuthoring(def).errors).toEqual([]);
    const region = toRegionDef(compileRegion(def));
    expect(region.nodeWindows).toEqual({ 'torpedoes:straight': [{ from: 1, until: null }] });
    const evo = newEvolution(region);
    const rng = makeRng('early-torps');
    let opened = false;
    for (let r = 1; r <= 5 && !opened; r++) {
      evolveEnemy(evo, metrics(r), rng);
      if (evo.economy.openBranches.includes('torpedoes')) opened = true;
    }
    expect(opened).toBe(true);
    expect(evo.economy.ledgers.torpedoes.units.straight ?? 0).toBeGreaterThan(0);
  });

  it('the authored intel warning surfaces one round ahead', () => {
    const region = toRegionDef(compileRegion(labRegion()));
    const evo = newEvolution(region);
    const rng = makeRng('warn');
    evolveEnemy(evo, metrics(1), rng); // planning round 2 → warns about round 3
    expect(evo.pendingWarnings.map((w) => w.text)).toContain('Authored: drifting minefields expected.');
  });

  it('a salvo beat groups the round’s missiles into the authored number of volleys', () => {
    const region = toRegionDef(compileRegion(labRegion()));
    registerCustomRegion(region);
    const c = newWorkshopPlaytest('salvo-seed', 'lab', { round: 4, source: 'local' });
    expect(c.round).toBe(4);
    const plan = planRound(c, makeRng('plan'));
    const times = plan.spawns.filter((s) => s.kind === 'missile' || s.kind === 'guidedMissile').map((s) => s.time).sort((a, b) => a - b);
    expect(times.length).toBeGreaterThanOrEqual(6);
    // Two groups: launches cluster into two tight bursts (≤ 2s inside a burst).
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    const bigGaps = gaps.filter((g) => g > 2);
    expect(bigGaps.length).toBe(1);
    expect(plan.spawns.filter((s) => s.kind === 'guidedMissile').length).toBeGreaterThanOrEqual(6);
  });

  it('same seed + same JSON replays identically', () => {
    const region = toRegionDef(compileRegion(labRegion()));
    registerCustomRegion(region);
    const a = newWorkshopPlaytest('replay', 'lab', { source: 'local' });
    const b = newWorkshopPlaytest('replay', 'lab', { source: 'local' });
    const pa = planCurrentRound(a);
    const pb = planCurrentRound(b);
    expect(JSON.stringify(pa)).toBe(JSON.stringify(pb));
    expect(JSON.stringify(a.evolution)).toBe(JSON.stringify(b.evolution));
  });

  it('a workshop playtest carries provenance into telemetry and never touches the campaign slot', () => {
    const region = toRegionDef(compileRegion(labRegion()));
    registerCustomRegion(region);
    const c = newWorkshopPlaytest('tele', 'lab', { source: 'local' });
    expect(c.workshop).toEqual({ hash: region.authoring!.hash, schemaVersion: 1, source: 'local' });
    expect(c.dev).toBe(true);
    expect(c.godMode).toBe(false);
    const t = buildTelemetryExport(c, '2026-01-01T00:00:00Z');
    expect(t.regionAuthoring).toEqual(c.workshop);
    expect(regionDef('lab').name).toBe('Lab');
  });
});

describe('draft store', () => {
  beforeEach(() => {
    useWorkshopStore(null);
    unregisterCustomRegion('mine');
  });

  it('saves, lists, registers for play, exports and deletes', () => {
    const def = blankRegion('mine', REGIONS.homeStrait.start);
    def.milestones = [{ round: 1, add: [{ branch: 'missiles', nodeId: 'unguided' }] }];
    saveDraft(def, new Date('2026-01-02T00:00:00Z'));
    expect(listDrafts().map((d) => d.def.id)).toEqual(['mine']);
    expect(regionDef('mine').id).toBe('mine'); // playable without a rebuild
    const lib = libraryEntries();
    expect(lib.filter((e) => e.source === 'packaged').map((e) => e.id)).toEqual(REGION_ORDER);
    expect(lib.find((e) => e.id === 'mine')?.valid).toBe(true);
    deleteDraft('mine');
    expect(listDrafts()).toEqual([]);
    expect(regionDef('mine').id).toBe('missileCoast'); // falls back once unregistered
  });

  it('an invalid draft is kept but not playable', () => {
    const def = blankRegion('mine', REGIONS.homeStrait.start);
    // An early introduction no longer invalidates a draft (it is a warning);
    // a genuinely blocking error still does.
    def.milestones = [{ round: 1, add: [{ branch: 'mines', nodeId: 'drifting' }] }]; // designed, not implemented
    saveDraft(def);
    expect(libraryEntries().find((e) => e.id === 'mine')?.valid).toBe(false);
    expect(regionDef('mine').id).toBe('missileCoast');
  });

  it('import validates schema and reports collisions without writing', () => {
    expect(parseImport('{').ok).toBe(false);
    expect(parseImport(JSON.stringify({ schemaVersion: 7 })).ok).toBe(false);
    const packaged = parseImport(JSON.stringify(fromRegionDef(REGIONS.missileCoast)));
    expect(packaged.ok).toBe(true);
    expect(packaged.collision).toBe('packaged');
    expect(listDrafts()).toEqual([]);
    const def = blankRegion('mine', REGIONS.homeStrait.start);
    def.milestones = [{ round: 1, add: [{ branch: 'missiles', nodeId: 'unguided' }] }];
    saveDraft(def);
    expect(parseImport(JSON.stringify(def)).collision).toBe('local');
  });

  it('registerSavedDrafts makes saved valid drafts resolvable after a reload', () => {
    const def = blankRegion('mine', REGIONS.homeStrait.start);
    def.milestones = [{ round: 1, add: [{ branch: 'missiles', nodeId: 'unguided' }] }];
    saveDraft(def);
    unregisterCustomRegion('mine');
    expect(registerSavedDrafts()).toBe(1);
    expect(regionDef('mine').id).toBe('mine');
  });
});
