// Round 11, part B (docs/design/v3-round11-map-notes.md): the Lure Beacon
// audit. The player, on Beacon Strike: "The laser cutter did not do any hits
// on the beacon so do an audit to make sure all weapons will actually
// attack the beacon". A beacon takes only the player's own hand (its
// helpers' shots pass through it, by design); every weapon the player fires
// must be that hand, whether it hurts at once (a shot, a beam) or over time
// (a cut, a cloud, a jet, a blade, a burning line). Each case below puts a
// beacon in the weapon's path, fires it the way a finger does, and checks
// the beacon takes damage, or that it doesn't, for the helpers.

import { describe, expect, it } from 'vitest';
import { ABILITY_ORDER, WEAPON, type AbilityId } from '../../src/v3/data/abilities';
import { isBoost, ROSTER } from '../../src/v3/data/roster';
import { beatClock, createGame, press, pressMove, release, spawnThreat, step, tap, type Game, type Threat } from '../../src/v3/sim/game';
import { launchFoe } from '../../src/v3/sim/foes';

const DT = 1 / 60;
const run = (g: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / DT) && g.phase === 'wave'; i++) step(g, DT);
};

function quietGame(): Game {
  const g = createGame('strait', 3, 1);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.threats = [];
  g.ammo = g.stats.rack;
  return g;
}

/** A beacon up out of the water at (x, y), tough enough to show the damage. */
function beacon(g: Game, x = 800, y = 300): Threat {
  launchFoe(g, { at: 0, kind: 'lure', base: -1 });
  const b = g.threats.find((t) => t.kind === 'lure' && !t.dead)!;
  b.x = x;
  b.y = y;
  b.foe!.state = 1;
  b.foe!.t = 0;
  b.foe!.life = 999;
  b.hp = b.maxHp = 60;
  return b;
}

function load(g: Game, id: AbilityId, level: number): void {
  g.levels[id] = level;
  if (!g.slots.includes(id)) g.slots.push(id);
  if (isBoost(id)) {
    g.pickups.push({ id: g.nextId++, kind: 'weapon', weapon: id, x: 300, y: 650, age: 0 });
    expect(tap(g, 300, 650, 30)).toBe('pickup');
  } else g.weapon = { id, level, t: WEAPON.time, t0: g.t };
}

/** Fire the loaded weapon at the beacon the way a finger does. */
function fireAt(g: Game, id: AbilityId, b: Threat): void {
  switch (id) {
    case 'cutter':
      press(g, b.x - 150, b.y, 30);
      for (let k = 1; k <= 10; k++) pressMove(g, b.x - 150 + k * 30, b.y);
      release(g, b.x + 150, b.y, 30);
      return;
    case 'lance':
      press(g, b.x, b.y, 30);
      run(g, 0.9);
      release(g, b.x, b.y, 30);
      return;
    case 'grapnel': {
      // Hook a drone and throw it into the beacon.
      const d = spawnThreat(g, 'drone', b.x - 220, b.y, 'base');
      d.speed = 0;
      d.hp = 3;
      press(g, d.x, d.y, 30);
      for (let k = 1; k <= 8; k++) {
        pressMove(g, d.x + k * 25, d.y);
        step(g, DT);
      }
      release(g, b.x, b.y, 30);
      return;
    }
    case 'cadence': {
      // On the beat.
      const w = g.weapon!;
      for (let i = 0; i < 200 && !(beatClock(g, w).n >= 1 && beatClock(g, w).off < 0.02); i++) step(g, DT);
      tap(g, b.x, b.y, 30);
      return;
    }
    default:
      for (let k = 0; k < 3; k++) {
        tap(g, b.x, b.y, 30);
        run(g, 0.4);
      }
  }
}

/** Helpers by design: their shots pass through a beacon (it lures them). */
const HELPERS: AbilityId[] = ['frigate', 'aegis', 'droneScreen', 'gunships', 'bomberWing', 'orbital'];
/** Boosts that fire nothing of their own (the gun's shot under them is
 *  checked with the plain gun): Shield, Full Steam, Supply Run. */
const NO_SHOT: AbilityId[] = ['shield', 'fullSteam', 'supplyRun'];

describe('Round 11 audit: every weapon you fire can hurt a Lure Beacon', () => {
  it('the plain gun (no weapon loaded)', () => {
    const g = quietGame();
    const b = beacon(g);
    tap(g, b.x, b.y, 30);
    run(g, 2);
    expect(b.hp).toBeLessThan(60);
  });

  for (const id of ABILITY_ORDER) {
    if (HELPERS.includes(id) || NO_SHOT.includes(id)) continue;
    for (const level of [1, 3]) {
      it(`${id} (level ${level})`, () => {
        const g = quietGame();
        const b = beacon(g);
        load(g, id, level);
        fireAt(g, id, b);
        run(g, 3);
        expect(b.hp, `${id} L${level}: ${ROSTER[id].cat}`).toBeLessThan(60);
      });
    }
  }

  it('the lingering work hurts it too: a flak cloud, a lit cut, a burning row, a burning lance', () => {
    // Each laid next to the beacon, then the beacon moved into it.
    for (const id of ['flak', 'cutter', 'airstrike', 'lance'] as AbilityId[]) {
      const g = quietGame();
      const b = beacon(g, 600, 200);
      load(g, id, 3);
      const spot = { x: 900, y: 300 };
      if (id === 'cutter') {
        press(g, spot.x - 150, spot.y, 30);
        for (let k = 1; k <= 10; k++) pressMove(g, spot.x - 150 + k * 30, spot.y);
        release(g, spot.x + 150, spot.y, 30);
      } else if (id === 'lance') {
        press(g, spot.x, spot.y, 30);
        run(g, 0.9);
        release(g, spot.x, spot.y, 30);
      } else tap(g, spot.x, spot.y, 30);
      for (let i = 0; i < 240 && !g.fields.length; i++) step(g, DT);
      const field = g.fields[0];
      expect(field, id).toBeDefined();
      const hp = b.hp;
      b.x = (field.x1 + field.x2) / 2;
      b.y = (field.y1 + field.y2) / 2;
      run(g, 0.8);
      expect(b.hp, id).toBeLessThan(hp);
    }
  });

  it('the helpers are lured by it and do it no harm (by design)', () => {
    for (const id of HELPERS) {
      const g = quietGame();
      const b = beacon(g, 640, 420);
      load(g, id, 3);
      run(g, 8);
      expect(b.hp, id).toBe(60);
    }
  });
});
