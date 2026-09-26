// Region Workshop — SCRIPTED rounds (the Round Planner's data contract).
//
//   • a scripted round fires EXACTLY what was authored — count, weapon, launch
//     point and timing pattern — and the adaptive allocator adds nothing;
//   • round 1 can be scripted (it otherwise plays the fixed onboarding probe);
//   • mines and guns land where they were placed;
//   • validation catches every malformed attack and stops adaptive-only
//     warnings from firing on scripted rounds;
//   • the authored form round-trips through the runtime RegionDef;
//   • the preview plays the real round and is deterministic per seed.

import { afterEach, describe, expect, it } from 'vitest';
import {
  compileRegion,
  extrapolateRound,
  fromRegionDef,
  roundAdapts,
  scaledCount,
  toRegionDef,
  validateRegionAuthoring,
  type RegionAuthoringDef,
  type ScriptedAttack,
} from '../src/data/regionAuthoring';
import { REGIONS, geographyOf, registerCustomRegion, unregisterCustomRegion } from '../src/data/regions';
import { newWorkshopPlaytest, planCurrentRound } from '../src/sim/campaign';
import { launchTimes } from '../src/sim/scriptedPlan';
import { SCRIPT_SCALE_MAX } from '../src/sim/evolution';
import { runPreview } from '../src/ui/workshopPreviewSim';
import { deleteSetPiece, listSetPieces, saveSetPiece, setPieceAttacks, useWorkshopStore } from '../src/platform/workshopStore';

function labRegion(): RegionAuthoringDef {
  const def = fromRegionDef(REGIONS.missileCoast);
  def.id = 'scriptLab';
  def.name = 'Script Lab';
  def.campaign.unlocks = null;
  return def;
}

function script(def: RegionAuthoringDef, round: number, attacks: ScriptedAttack[]): void {
  let m = def.milestones.find((x) => x.round === round);
  if (!m) {
    m = { round, add: [] };
    def.milestones.push(m);
    def.milestones.sort((a, b) => a.round - b.round);
  }
  m.attacks = attacks;
}

function register(def: RegionAuthoringDef): void {
  registerCustomRegion(toRegionDef(compileRegion(def)));
}

const missiles = (count: number, extra: Partial<ScriptedAttack> = {}): ScriptedAttack => ({
  id: `m${count}`,
  ref: { branch: 'missiles', nodeId: 'unguided' },
  count,
  x: 2000,
  pattern: 'salvo',
  start: 20,
  ...extra,
});

afterEach(() => unregisterCustomRegion('scriptLab'));

describe('launch timing patterns', () => {
  const base = { id: 'a', branch: 'missiles' as const, nodeId: 'unguided', x: 0, y: null, start: 10, perVolley: 3, gap: 5 };
  it('salvo fires every unit at the start time', () => {
    expect(launchTimes({ ...base, count: 4, pattern: 'salvo' }, 200)).toEqual([10, 10, 10, 10]);
  });
  it('volleys fire perVolley units every gap seconds', () => {
    expect(launchTimes({ ...base, count: 7, pattern: 'volleys' }, 200)).toEqual([10, 10, 10, 15, 15, 15, 20]);
  });
  it('stream fires one unit every gap seconds', () => {
    expect(launchTimes({ ...base, count: 3, pattern: 'stream' }, 200)).toEqual([10, 15, 20]);
  });
  it('spread spaces units evenly to the end of the window', () => {
    expect(launchTimes({ ...base, count: 2, pattern: 'spread' }, 110)).toEqual([35, 85]);
  });
});

describe('scripted rounds at runtime', () => {
  it('fires exactly the authored salvo — no adaptive top-up', () => {
    const def = labRegion();
    script(def, 3, [missiles(5)]);
    register(def);
    const c = newWorkshopPlaytest('s', 'scriptLab', { round: 3, source: 'local' });
    const plan = planCurrentRound(c);
    expect(plan.spawns).toHaveLength(5);
    expect(plan.mines).toHaveLength(0);
    for (const sp of plan.spawns) {
      expect(sp.kind).toBe('missile');
      expect(Math.abs(sp.siteX - 2000)).toBeLessThanOrEqual(20);
      expect(sp.time).toBeGreaterThanOrEqual(20);
      expect(sp.time).toBeLessThanOrEqual(21.4);
    }
    // The same round on Auto fields far more than five.
    const auto = labRegion();
    register(auto);
    const ca = newWorkshopPlaytest('s', 'scriptLab', { round: 3, source: 'local' });
    expect(planCurrentRound(ca).spawns.length).toBeGreaterThan(20);
  });

  it('changing the count by one changes the salvo by exactly one', () => {
    for (const n of [3, 4, 5]) {
      const def = labRegion();
      script(def, 4, [missiles(n)]);
      register(def);
      const c = newWorkshopPlaytest('s', 'scriptLab', { round: 4, source: 'local' });
      expect(planCurrentRound(c).spawns).toHaveLength(n);
    }
  });

  it('scripts round 1 instead of playing the onboarding probe', () => {
    const def = labRegion();
    script(def, 1, [missiles(2, { ref: { branch: 'missiles', nodeId: 'guided' }, pattern: 'stream', gap: 8 })]);
    register(def);
    const c = newWorkshopPlaytest('s', 'scriptLab', { source: 'local' });
    const plan = planCurrentRound(c);
    expect(plan.spawns.map((s) => s.kind)).toEqual(['guidedMissile', 'guidedMissile']);
    expect(plan.spawns[1].time - plan.spawns[0].time).toBeGreaterThan(6);
  });

  it('lays mines at the marker and digs guns in on the shore', () => {
    const def = labRegion();
    script(def, 2, [
      { id: 'f', ref: { branch: 'mines', nodeId: 'lowSig' }, count: 6, x: 1500, y: 1700 },
      { id: 'g', ref: { branch: 'artillery', nodeId: 'coastalGun' }, count: 2, x: 1800 },
      { id: 't', ref: { branch: 'torpedoes', nodeId: 'homing' }, count: 3, x: 900, pattern: 'volleys', perVolley: 2, gap: 10 },
    ]);
    register(def);
    const c = newWorkshopPlaytest('s', 'scriptLab', { round: 2, source: 'local' });
    const plan = planCurrentRound(c);
    const geo = geographyOf('scriptLab');
    expect(plan.mines).toHaveLength(6);
    for (const m of plan.mines) {
      expect(m.lowSig).toBe(true);
      expect(Math.abs(m.x - 1500)).toBeLessThanOrEqual(130);
      expect(Math.abs(m.y - 1700)).toBeLessThanOrEqual(75);
    }
    expect(plan.installations.map((g) => g.variant)).toEqual(['coastalGun', 'coastalGun']);
    for (const g of plan.installations) expect(Math.abs(g.y - geo.launchY(g.x))).toBeLessThanOrEqual(18);
    const torps = plan.spawns.filter((s) => s.kind === 'torpedo');
    expect(torps).toHaveLength(3);
    expect(torps.every((t) => t.homing)).toBe(true);
  });

  it('records the scripted buy in the enemy ledgers so later Auto rounds keep learning', () => {
    const def = labRegion();
    script(def, 2, [missiles(7)]);
    register(def);
    const c = newWorkshopPlaytest('s', 'scriptLab', { round: 2, source: 'local' });
    planCurrentRound(c);
    const economy = c.evolution.economy;
    expect(economy.ledgers.missiles.units.unguided).toBe(7);
    expect(economy.authoredUnits).toEqual({ unguided: 7 });
    expect(economy.scrapped).toBe(0);
  });

  it('a scripted round with no attacks is a quiet round', () => {
    const def = labRegion();
    script(def, 3, []);
    register(def);
    const c = newWorkshopPlaytest('s', 'scriptLab', { round: 3, source: 'local' });
    const plan = planCurrentRound(c);
    expect(plan.spawns).toHaveLength(0);
    expect(plan.mines).toHaveLength(0);
  });
});

describe('scripted round validation', () => {
  const issuesFor = (attacks: ScriptedAttack[]) => {
    const def = labRegion();
    script(def, 3, attacks);
    return validateRegionAuthoring(def);
  };

  it('accepts a well-formed script and skips adaptive warnings on it', () => {
    const def = labRegion();
    script(def, 3, []);
    const v = validateRegionAuthoring(def);
    expect(v.ok).toBe(true);
    expect(v.warnings.filter((w) => w.round === 3)).toEqual([]);
  });

  it.each([
    ['zero count', [missiles(0)], 'attackCount'],
    ['fractional count', [missiles(2.5)], 'attackCount'],
    ['off-map position', [missiles(3, { x: -5 })], 'attackPosition'],
    ['unknown pattern', [missiles(3, { pattern: 'barrage' as never })], 'attackPattern'],
    ['zero gap', [missiles(3, { pattern: 'stream', gap: 0 })], 'attackTiming'],
    ['mines without a y', [{ id: 'f', ref: { branch: 'mines' as const, nodeId: 'standard' }, count: 3, x: 1000 }], 'attackPosition'],
    ['smoke (no map position yet)', [{ id: 's', ref: { branch: 'smoke' as const, nodeId: 'screening' }, count: 1, x: 1000 }], 'attackFamily'],
    ['unimplemented node', [missiles(2, { ref: { branch: 'missiles', nodeId: 'seaSkimming' } })], 'unimplemented'],
    ['duplicate ids', [missiles(2), missiles(2)], 'attackId'],
  ])('rejects %s', (_label, attacks, code) => {
    const v = issuesFor(attacks as ScriptedAttack[]);
    expect(v.ok).toBe(false);
    expect(v.errors.map((e) => e.code)).toContain(code);
  });
});

describe('authored ⇄ runtime round trip', () => {
  it('fromRegionDef(toRegionDef(x)) keeps every attack with defaults resolved', () => {
    const def = labRegion();
    script(def, 5, [missiles(4, { pattern: 'volleys' }), { id: 'f', ref: { branch: 'mines', nodeId: 'standard' }, count: 3, x: 1000, y: 1600 }]);
    const region = toRegionDef(compileRegion(def));
    expect(region.scriptedRounds?.[5]).toHaveLength(2);
    const back = fromRegionDef(region);
    const attacks = back.milestones.find((m) => m.round === 5)?.attacks;
    expect(attacks?.[0]).toMatchObject({ count: 4, pattern: 'volleys', perVolley: 3, gap: 15, start: 20, x: 2000 });
    expect(attacks?.[1]).toMatchObject({ ref: { branch: 'mines', nodeId: 'standard' }, count: 3, x: 1000, y: 1600 });
  });

  it('packaged regions carry no scripted rounds', () => {
    for (const id of Object.keys(REGIONS)) {
      expect(toRegionDef(compileRegion(fromRegionDef(REGIONS[id]))).scriptedRounds).toBeUndefined();
    }
  });
});

describe('attack preview', () => {
  it('plays the real round and replays identically for a seed', () => {
    const def = labRegion();
    script(def, 3, [missiles(6)]);
    const a = runPreview({ def, round: 3, seed: 'x', defences: true });
    const b = runPreview({ def, round: 3, seed: 'x', defences: true });
    expect(a.scripted).toBe(true);
    expect(a.summary.launched).toBe(6);
    expect(a.fielded).toEqual({ 'missiles:unguided': 6 });
    expect(a.frames.length).toBeGreaterThan(100);
    expect(b.summary).toEqual(a.summary);
  });

  it('with nobody defending, nothing is shot down', () => {
    const def = labRegion();
    script(def, 3, [missiles(6)]);
    const r = runPreview({ def, round: 3, seed: 'x', defences: false });
    expect(r.summary.shotDown).toBe(0);
  });

  it('reports what an Auto round chose to field', () => {
    const r = runPreview({ def: labRegion(), round: 3, seed: 'x', defences: true });
    expect(r.scripted).toBe(false);
    const total = Object.values(r.fielded).reduce((s, n) => s + n, 0);
    expect(total).toBe(r.summary.launched + r.summary.minesLaid + r.summary.guns);
  });
});

describe('extrapolating one round across later rounds', () => {
  it('copies the round with counts growing by a fixed step', () => {
    const def = labRegion();
    script(def, 1, [missiles(30), { id: 'f', ref: { branch: 'mines', nodeId: 'standard' }, count: 4, x: 1000, y: 1600 }]);
    const written = extrapolateRound(def, 1, 5, 'add', 2);
    expect(written).toEqual([2, 3, 4, 5]);
    const counts = (r: number) => def.milestones.find((m) => m.round === r)!.attacks!.map((a) => a.count);
    expect(counts(2)).toEqual([32, 6]);
    expect(counts(5)).toEqual([38, 12]);
    // Positions and timing ride along; ids stay unique per round.
    const r5 = def.milestones.find((m) => m.round === 5)!.attacks!;
    expect(r5[0]).toMatchObject({ x: 2000, pattern: 'salvo', start: 20 });
    const ids = def.milestones.flatMap((m) => m.attacks ?? []).map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateRegionAuthoring(def).ok).toBe(true);
  });

  it('compounds a percentage and never drops below one unit', () => {
    expect([0, 1, 2, 3].map((k) => scaledCount(30, k, 'percent', 10))).toEqual([30, 33, 36, 40]);
    expect(scaledCount(3, 5, 'add', -2)).toBe(1);
    expect(scaledCount(150, 5, 'add', 20)).toBe(200);
  });

  it('extends the region when asked to fill past its last round', () => {
    const def = labRegion();
    script(def, 8, [missiles(10)]);
    extrapolateRound(def, 8, 10, 'add', 1);
    expect(def.completionRound).toBe(10);
    expect(def.milestones.find((m) => m.round === 10)!.attacks![0].count).toBe(12);
  });

  it('scaled rounds fire exactly their scaled counts in the game', () => {
    const def = labRegion();
    script(def, 2, [missiles(5)]);
    extrapolateRound(def, 2, 4, 'add', 3);
    register(def);
    const c = newWorkshopPlaytest('s', 'scriptLab', { round: 4, source: 'local' });
    expect(planCurrentRound(c).spawns).toHaveLength(11);
  });
});

describe('scripted rounds that adapt to the player', () => {
  const run = (def: RegionAuthoringDef, round: number) => {
    register(def);
    const c = newWorkshopPlaytest('adapt', 'scriptLab', { round, source: 'local' });
    const plan = planCurrentRound(c);
    return { n: plan.spawns.length, scale: c.evolution.economy.scriptScale ?? 1 };
  };

  it('fires the written count when the round does not adapt', () => {
    const def = labRegion();
    script(def, 4, [missiles(20)]);
    expect(run(def, 4).n).toBe(20);
  });

  it('scales with how the player did (the fast-forward reports a strong player)', () => {
    const def = labRegion();
    script(def, 4, [missiles(20)]);
    def.scriptAdapt = true;
    const { n, scale } = run(def, 4);
    expect(scale).toBeGreaterThan(1);
    expect(scale).toBeLessThanOrEqual(SCRIPT_SCALE_MAX);
    expect(n).toBe(Math.round(20 * scale));
  });

  it('a round can opt out of the region default, and vice versa', () => {
    const def = labRegion();
    script(def, 4, [missiles(20)]);
    def.scriptAdapt = true;
    def.milestones.find((m) => m.round === 4)!.adapt = false;
    expect(roundAdapts(def, 4)).toBe(false);
    expect(run(def, 4).n).toBe(20);
    const def2 = labRegion();
    script(def2, 4, [missiles(20)]);
    def2.milestones.find((m) => m.round === 4)!.adapt = true;
    expect(roundAdapts(def2, 4)).toBe(true);
    expect(run(def2, 4).n).toBeGreaterThan(20);
  });

  it('round 1 has no player signal yet, so it fires as written', () => {
    const def = labRegion();
    script(def, 1, [missiles(12)]);
    def.scriptAdapt = true;
    expect(run(def, 1)).toEqual({ n: 12, scale: 1 });
  });

  it('round-trips through the runtime region', () => {
    const def = labRegion();
    script(def, 3, [missiles(5)]);
    script(def, 5, [missiles(5)]);
    def.milestones.find((m) => m.round === 5)!.adapt = true;
    const region = toRegionDef(compileRegion(def));
    expect(region.scriptedAdaptive).toEqual([5]);
    const back = fromRegionDef(region);
    expect(roundAdapts(back, 5)).toBe(true);
    expect(roundAdapts(back, 3)).toBe(false);
  });
});

describe('set pieces', () => {
  it('save, list, reuse with fresh ids, overwrite by name and delete', () => {
    useWorkshopStore(null);
    const rush = saveSetPiece('Boat rush', [
      { id: 'b1', ref: { branch: 'attackBoats', nodeId: 'smallArms' }, count: 3, x: 1800, pattern: 'volleys', perVolley: 1, gap: 8 },
    ]);
    saveSetPiece('Mine wall', [{ id: 'm1', ref: { branch: 'mines', nodeId: 'standard' }, count: 6, x: 1500, y: 1700 }]);
    expect(listSetPieces().map((p) => p.name)).toEqual(['Mine wall', 'Boat rush']);

    // Reuse: dropped into a round with fresh ids, and it plays.
    const def = labRegion();
    const copies = setPieceAttacks(rush, 'r4');
    expect(copies[0].id).not.toBe('b1');
    script(def, 4, copies);
    expect(validateRegionAuthoring(def).ok).toBe(true);
    register(def);
    const c = newWorkshopPlaytest('s', 'scriptLab', { round: 4, source: 'local' });
    expect(planCurrentRound(c).spawns.filter((s) => s.kind === 'attackBoat')).toHaveLength(3);

    // Same name (any case) overwrites rather than duplicating.
    saveSetPiece('boat RUSH', [{ id: 'b2', ref: { branch: 'attackBoats', nodeId: 'rocket' }, count: 2, x: 1800 }]);
    expect(listSetPieces()).toHaveLength(2);
    expect(listSetPieces().find((p) => p.id === rush.id)?.attacks[0].count).toBe(2);

    deleteSetPiece(rush.id);
    expect(listSetPieces().map((p) => p.name)).toEqual(['Mine wall']);
  });
});
