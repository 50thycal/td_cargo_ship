// Round 15 (log v55; docs/design/v3-playtest-fixes.md, "Round 15"): the
// player's notes on Sowers' Reach and the Rig Field.
// - Sowers' Reach under the encounter layer: mines drift hidden (no chute
//   warning, nothing sees or shoots them) until a ship would sail onto one
//   within MINE.surface s; then it surfaces. The campaign keeps them in
//   sight. The big Hold button glows when a surfaced mine is about to meet
//   a hull (commandAdvised).
// - The Rig Field under the layer: a rig counts the player's shots, not
//   their damage.
import { describe, expect, it } from 'vitest';
import { MINE, RIG_SHOTS, TOW } from '../../src/v3/data/config';
import { ENCOUNTER_REV, encountersFor, hiddenMinesOn, shotRigsOn } from '../../src/v3/data/encounters';
import { MAPS } from '../../src/v3/data/maps';
import { applyConvoy } from '../../src/v3/sim/convoy';
import { commandAdvised, applyEncounters, createGame, damageThreat, hiddenMines, released, rigAt, rigStations, shotRigs, spawnThreat, step, worthShooting, type Game } from '../../src/v3/sim/game';
import { mapConvoy } from '../../src/v3/data/convoy';

const DT = 1 / 60;
const LAYER = { rev: ENCOUNTER_REV, version: 'v1' as const };

function sowers(seed = 3, wave = 1): Game {
  const g = createGame('sowers', seed, wave);
  applyEncounters(g, LAYER);
  g.tempo = { ...g.tempo, lossLimit: 999 };
  g.carrierHp = 999;
  return g;
}

describe('Round 15: hidden mines on Sowers\' Reach', () => {
  it('is on for the Sowers under the layer only', () => {
    expect(hiddenMinesOn('sowers', LAYER)).toBe(true);
    expect(hiddenMinesOn('sowers', { rev: 3 })).toBe(false);
    expect(hiddenMinesOn('sowers', { ...LAYER, only: [] })).toBe(false);
    expect(hiddenMinesOn('sowers', null)).toBe(false);
    expect(hiddenMinesOn('strait', LAYER)).toBe(false);
    expect(hiddenMines(createGame('sowers', 3, 1))).toBe(false);
  });

  it('a mine drifts hidden (nothing sees or shoots it), then surfaces in a ship\'s path before it can reach the hull', () => {
    const g = sowers();
    g.queue = [{ at: 9999, kind: 'drone', base: 0 }];
    g.raiderQueue = [];
    for (let i = 0; i < 20 / DT && g.ships.length < 2; i++) step(g, DT);
    const s = g.ships.reduce((a, b) => (b.x > a.x ? b : a));
    // Up-current of the lead ship's course, far enough ahead to drift onto it.
    const m = spawnThreat(g, 'mine', s.x + 240, s.y - 120, 'base');
    expect(m.hidden).toBe(true);
    expect(released(m)).toBe(false);
    expect(worthShooting(g, [m])).toEqual([]);
    const hp = s.hp;
    let upAt = -1;
    for (let i = 0; i < 12 / DT && !m.dead; i++) {
      step(g, DT);
      if (upAt < 0 && !m.hidden) upAt = g.t;
    }
    expect(upAt, 'it surfaced').toBeGreaterThan(0);
    expect(m.surfacedT).toBeCloseTo(upAt, 5);
    // It surfaced with time to spare: never hidden as it hit.
    if (s.hp < hp) expect(g.t - upAt).toBeGreaterThan(1);
  });

  it('a chute lights no warning for hidden mines', () => {
    const g = sowers();
    for (let i = 0; i < 60 / DT && g.phase === 'wave'; i++) {
      for (const r of g.raids) for (const b of r.bases) expect(MAPS.sowers.bases[b].chute, `raid at ${r.at}`).toBeFalsy();
      step(g, DT);
    }
  });

  it('the campaign keeps its mines in sight from the chute', () => {
    const g = createGame('sowers', 3, 1);
    const m = spawnThreat(g, 'mine', 430, 170, 'base');
    expect(m.hidden).toBeUndefined();
    expect(released(m)).toBe(true);
  });

  it('a surfaced mine about to meet a hull lights the Hold button (commandAdvised); a hidden one does not', () => {
    const g = sowers();
    applyConvoy(g, { policy: 'tactical', obligation: 'natural', rev: 3 });
    expect(mapConvoy('sowers').commands).toEqual(['hold']);
    for (let i = 0; i < 12 / DT && g.ships.length < 2; i++) step(g, DT);
    const s = g.ships.reduce((a, b) => (b.x > a.x ? b : a));
    const m = spawnThreat(g, 'mine', s.x + 60, s.y, 'base');
    expect(m.hidden).toBe(true);
    expect(commandAdvised(g, 'hold')).toBe(false);
    m.hidden = false;
    expect(commandAdvised(g, 'hold')).toBe(true);
    // Far from every hull: nothing to do.
    m.x = 40;
    m.y = 40;
    expect(commandAdvised(g, 'hold')).toBe(false);
    expect(MINE.surface).toBeGreaterThan(1.4);
  });

  it('the encounters\' chute beats light no raid warning on the Sowers', () => {
    const g = sowers(3, 2);
    const chuteBeats = encountersFor('sowers', 2).flatMap((e) => e.beats).filter((b) => b.kind === 'mine');
    expect(chuteBeats.length).toBeGreaterThan(0);
    for (const r of g.raids) for (const b of r.bases) expect(MAPS.sowers.bases[b].chute, `raid at ${r.at}`).toBeFalsy();
  });
});

describe('Round 15: the Rig Field\'s rigs count shots', () => {
  function rigs(seed = 5, wave = 1): Game {
    const g = createGame('rigs', seed, wave);
    applyEncounters(g, LAYER);
    return g;
  }

  it('is on for the Rigs under the layer only; its rigs stand with RIG_SHOTS.rig', () => {
    expect(shotRigsOn('rigs', LAYER)).toBe(true);
    expect(shotRigsOn('rigs', { rev: 3 })).toBe(false);
    expect(shotRigsOn('rigs', { ...LAYER, only: [] })).toBe(false);
    const g = rigs();
    expect(shotRigs(g)).toBe(true);
    for (const i of rigStations(g)) expect([rigAt(g, i)!.hp, rigAt(g, i)!.maxHp]).toEqual([RIG_SHOTS.rig, RIG_SHOTS.rig]);
    // The campaign's: the map's own hits, by damage.
    const c = createGame('rigs', 5, 1);
    const r = rigAt(c, rigStations(c)[0])!;
    expect(r.hp).toBe(MAPS.rigs.bases[rigStations(c)[0]].rig!.hp);
    damageThreat(c, r, 6, false, 'railgun');
    expect(r.hp).toBe(MAPS.rigs.bases[rigStations(c)[0]].rig!.hp - 6);
  });

  it('a shot is one whatever its damage; a seeker\'s third a third; an area weapon once a rig a step; the Nuke three', () => {
    const g = rigs();
    const r = rigAt(g, rigStations(g)[0])!;
    const hp = r.hp;
    damageThreat(g, r, 8, false, 'railgun');
    expect(r.hp).toBe(hp - 1);
    damageThreat(g, r, 3, false, 'gun');
    expect(r.hp).toBe(hp - 2);
    damageThreat(g, r, 1 / 3, false, 'seeker');
    expect(r.hp).toBeCloseTo(hp - 2 - 1 / 3, 6);
    // Shrapnel's fragments landing together: one.
    for (let k = 0; k < 6; k++) damageThreat(g, r, 1, false, 'shrapnel');
    expect(r.hp).toBeCloseTo(hp - 3 - 1 / 3, 6);
    // The next step, a new burst counts again.
    g.steps += 1;
    damageThreat(g, r, 1, false, 'shrapnel');
    expect(r.hp).toBeCloseTo(hp - 4 - 1 / 3, 6);
    damageThreat(g, r, 3, false, 'nuke');
    expect(r.hp).toBeCloseTo(hp - 7 - 1 / 3, 6);
  });

  it('a flak cloud over a rig is one shot however long it burns', () => {
    const g = rigs();
    g.queue = [{ at: 9999, kind: 'drone', base: 0 }];
    g.raiderQueue = [];
    const r = rigAt(g, rigStations(g)[1])!;
    const hp = r.hp;
    g.fields.push({ kind: 'flak', x1: r.x, y1: r.y, x2: r.x, y2: r.y, hw: 60, t: 0, life: 4, tick: 0, level: 3 });
    for (let i = 0; i < 4 / DT; i++) step(g, DT);
    expect(r.hp).toBe(hp - 1);
  });

  it('a relief rig on its tow takes TOW.hp shots, docked TOW.dock', () => {
    expect(TOW.hp).toBeGreaterThanOrEqual(10);
    expect(TOW.dock).toBeGreaterThanOrEqual(25);
  });
});
