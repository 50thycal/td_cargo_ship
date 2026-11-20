// The 2026-11-20 playtest's notes (docs/design/v3-playtest-fixes.md, log
// v34): the Shield breaks after a number of hits; the Attack Helicopter fires
// as soon as a ship is in range; the Torpedo Sub can't be hit, only its
// torpedoes; the Scavenger takes three hits; the wave counter reads "Wave N
// of 10" and a boss round as one.

import { describe, expect, it } from 'vitest';
import { AB } from '../../src/v3/data/abilities';
import { THREATS } from '../../src/v3/data/config';
import { FOE } from '../../src/v3/data/foes';
import { waveCount, waveCountParts, waveName } from '../../src/v3/data/events';
import { launchFoe } from '../../src/v3/sim/foes';
import { createGame, damageCarrier, damageThreat, released, step, tap, worthShooting, type Game } from '../../src/v3/sim/game';

const DT = 1 / 60;

function run(g: Game, seconds: number, until?: () => boolean): void {
  for (let i = 0; i < seconds / DT && g.phase === 'wave'; i++) {
    step(g, DT);
    if (until?.()) return;
  }
}

/** A wave with nothing launching on its own, ships sailing, unsinkable. */
function quiet(map: Parameters<typeof createGame>[0] = 'island', seed = 1): Game {
  const g = createGame(map, seed);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.threats = [];
  g.lost = -99;
  g.carrierHp = 999;
  run(g, 20);
  g.threats = [];
  return g;
}

/** The Shield boost up at `level`, as a pickup would start it. */
function shieldUp(g: Game, level: number): void {
  g.levels.shield = level;
  g.boost = { id: 'shield', level, t: 15, n: 0, bank: 0, crateT: 0, age: 0, hits: AB.shield.hits[level - 1] };
}

describe('the Shield breaks after a number of hits', () => {
  it('each blocked hit counts one, whatever its damage; the last one breaks it', () => {
    const g = quiet();
    shieldUp(g, 1);
    const n = AB.shield.hits[0];
    const hp = g.carrierHp;
    for (let k = 0; k < n; k++) {
      expect(g.boost?.id).toBe('shield');
      damageCarrier(g, k === 0 ? 1 : 9, 'heavy');
      step(g, DT);
    }
    expect(g.carrierHp).toBe(hp);
    expect(g.boost).toBeNull();
    damageCarrier(g, 1, 'drone');
    expect(g.carrierHp).toBe(hp - 1);
  });

  it('one blast reaching several hulls in the same step is one hit', () => {
    const g = quiet();
    shieldUp(g, 2);
    g.boost!.hits = 3;
    damageCarrier(g, 2, 'ballistic');
    damageCarrier(g, 2, 'ballistic');
    expect(g.boost!.hits).toBe(2);
    step(g, DT);
    damageCarrier(g, 2, 'ballistic');
    expect(g.boost!.hits).toBe(1);
  });

  it('no fewer hits at a higher level', () => {
    expect(AB.shield.hits.length).toBe(3);
    expect(AB.shield.hits[0]).toBeLessThanOrEqual(AB.shield.hits[1]);
    expect(AB.shield.hits[1]).toBeLessThanOrEqual(AB.shield.hits[2]);
  });
});

describe('the Attack Helicopter fires as soon as a ship is in range', () => {
  it('its first pair goes before it reaches its spot', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'attackHeli', base: 0 }, g.map.bases[0]);
    const heli = g.threats.find((t) => t.kind === 'attackHeli')!;
    heli.hp = heli.maxHp = 999;
    let firstAt = -1;
    run(g, 20, () => {
      if (g.threats.some((t) => t.kind === 'heliRocket')) {
        firstAt = heli.foe!.state;
        return true;
      }
      return false;
    });
    expect(firstAt).toBeGreaterThanOrEqual(0);
    // Still on its way (0) or settling (1), not hovering at the spot (2).
    expect(firstAt).toBeLessThan(2);
  });
});

describe('the Torpedo Sub stays under water, out of reach', () => {
  function withSub(): Game {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'torpedoSub', base: 0 }, g.map.bases[0]);
    run(g, 10, () => g.threats.some((t) => t.kind === 'torpedoSub' && !t.dead));
    return g;
  }

  it('no shot, blast or Nuke touches it, and nothing targets it', () => {
    const g = withSub();
    const sub = g.threats.find((t) => t.kind === 'torpedoSub' && !t.dead)!;
    expect(sub).toBeTruthy();
    expect(released(sub)).toBe(false);
    expect(worthShooting(g, g.threats)).not.toContain(sub);
    damageThreat(g, sub, 99, true, 'railgun');
    damageThreat(g, sub, 99, false, 'nuke');
    expect(sub.dead).toBe(false);
    expect(sub.hp).toBe(THREATS.torpedoSub.hp);
    expect(tap(g, sub.x, sub.y, 6)).not.toBe('fire');
  });

  it('it fires its torpedoes, which can be shot, then dives away on its own', () => {
    const g = withSub();
    const sub = g.threats.find((t) => t.kind === 'torpedoSub' && !t.dead)!;
    run(g, 20, () => sub.dead);
    expect(sub.dead).toBe(true);
    expect(sub.foe!.n).toBeGreaterThanOrEqual(FOE.torpedoSub.spread[0]);
  });
});

describe('the Scavenger takes more hits', () => {
  it('three hits to shoot down', () => {
    expect(THREATS.scavenger.hp).toBe(3);
  });
});

describe('the wave counter', () => {
  it('reads "Wave N of 10" on every map, and a boss round as one', () => {
    expect(waveCount(3)).toBe('Wave 3 of 10');
    expect(waveCount(10)).toBe('Wave 10 of 10');
    expect(waveCount(11)).toBe('Boss · Round 1 of 3');
    expect(waveCount(13)).toBe('Boss · Round 3 of 3');
    expect(waveCount(14, { endless: true })).toBe('Wave 14');
    expect(waveCountParts(12, { boss: { run: 2, runs: 3 } })).toEqual(['BOSS', 'Round 2 of 3']);
    expect(waveName(7)).toBe('wave 7');
    expect(waveName(12)).toBe('boss round 2');
  });
});
