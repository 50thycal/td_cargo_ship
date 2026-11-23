// Test Lab round 1: the Nuke blows up everything hostile on the screen
// ("even the trucks, submarines, any of the vehicles"): the new enemies'
// platforms, a siege gun down in its hatch, a sub at periscope depth, the
// launch trucks and submarines (raiders), every warning and red shot. The
// one exception, as before: structures take nukeStructure hits (weapons.test).

import { describe, expect, it } from 'vitest';
import { FOE } from '../../src/v3/data/foes';
import { launchFoe } from '../../src/v3/sim/foes';
import { createGame, step, tap, type Game } from '../../src/v3/sim/game';

const DT = 1 / 60;
function run(g: Game, seconds: number, until?: () => boolean): void {
  for (let i = 0; i < seconds / DT && g.phase === 'wave'; i++) {
    step(g, DT);
    if (until?.()) return;
  }
}

function quiet(seed = 1): Game {
  const g = createGame('strait', seed);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.threats = [];
  run(g, 20);
  g.threats = [];
  return g;
}

describe('the Nuke', () => {
  it('blows up every enemy on the screen: platforms, a gun in its hatch, a sub under water, launch trucks and subs, and every red shot', () => {
    const g = quiet();
    // A siege gun that has gone down into its hatch.
    launchFoe(g, { at: 0, kind: 'siege', base: -1 });
    run(g, 20, () => g.foe.marks.some((m) => m.kind === 'hatch' && !!m.gun));
    const gun = g.foe.marks.find((m) => m.kind === 'hatch')!.gun!;
    expect(g.threats.includes(gun)).toBe(false);
    // A rocket truck firing, a helicopter, a sub at periscope depth, a dive
    // bomber's circle.
    launchFoe(g, { at: 0, kind: 'rocketTruck', base: -1 });
    launchFoe(g, { at: 0, kind: 'attackHeli', base: -1 });
    run(g, 30, () => g.foe.shots.length > 0);
    expect(g.foe.shots.length).toBeGreaterThan(0);
    launchFoe(g, { at: 0, kind: 'torpedoSub', base: -1 });
    launchFoe(g, { at: 0, kind: 'diveBomber', base: -1 });
    launchFoe(g, { at: 0, kind: 'lure', base: -1 });
    // A launch truck on the shore road and a submarine (raiders).
    const road = g.map.roads.popups[0];
    g.raiderQueue = [
      { at: g.waveT, kind: 'popup', path: [road.from, road.to], units: [{ kind: 'guided', size: 1 }] },
      { at: g.waveT, kind: 'sub', path: [g.map.subSpots[0] ?? { x: 800, y: 500 }], units: [{ kind: 'guided', size: 1 }] },
    ];
    run(g, 3, () => g.raiders.length === 2 && g.raiders.every((r) => r.y > 0));
    expect(g.raiders.length).toBe(2);
    const truck = g.threats.find((t) => t.kind === 'rocketTruck')!;
    const heli = g.threats.find((t) => t.kind === 'attackHeli')!;
    const lure = g.threats.find((t) => t.kind === 'lure')!;
    expect(g.foe.marks.some((m) => m.kind === 'periscope')).toBe(true);
    expect(g.foe.marks.some((m) => m.kind === 'dive')).toBe(true);

    g.pickups.push({ id: g.nextId++, kind: 'nuke', x: 500, y: 500, age: 0 });
    expect(tap(g, 500, 500, 20)).toBe('pickup');
    for (const th of [gun, truck, heli, lure]) expect(th.dead, th.kind).toBe(true);
    expect(g.kills.siege).toBe(1);
    expect(g.kills.rocketTruck).toBe(1);
    // A Torpedo Sub's periscope stays: the sub is out of reach (log v35).
    expect(g.foe.marks.filter((m) => m.kind !== 'periscope')).toHaveLength(0);
    expect(g.foe.shots).toHaveLength(0);
    expect(g.raiders.every((r) => r.state === 'reverse' && r.units.length === 0)).toBe(true);
    // Nothing comes back up afterwards.
    run(g, FOE.siege.down + FOE.torpedoSub.warn + 1);
    expect(g.threats.filter((t) => t.kind === 'siege' || t.kind === 'diveBomber')).toHaveLength(0);
    expect(g.raiders).toHaveLength(0);
  });
});

describe('the Nuke and the Incendiary Missile', () => {
  it('puts out every fireball and takes a missile in flight with no new fire', () => {
    const g = quiet(2);
    g.foe.marks.push({ id: g.nextId++, kind: 'fire', x: 600, y: 400, t: 0, dur: 99, dose: {} });
    launchFoe(g, { at: 0, kind: 'cloud', base: 0 }, { x: 800, y: 60 });
    run(g, 1);
    const missile = g.threats.find((t) => t.kind === 'cloud')!;
    expect(missile).toBeDefined();
    g.pickups.push({ id: g.nextId++, kind: 'nuke', x: 500, y: 500, age: 0 });
    expect(tap(g, 500, 500, 20)).toBe('pickup');
    expect(missile.dead).toBe(true);
    run(g, 1);
    expect(g.foe.marks.filter((m) => m.kind === 'fire')).toHaveLength(0);
    expect(g.threats.filter((t) => t.kind === 'cloud' && !t.dead)).toHaveLength(0);
  });
});

// The Kesh playtest (2026-11-18, pause note at step 23976: "Not sure if it
// does or not but the nuke should not clear out the players passive
// weapons"). It does not: the Nuke takes the enemy's threats, launchers,
// marks and shots only. On the replay the nuke at wave 8, 55.0 s killed the
// wave's last threat, so the wave ended there, and every wave's end
// unloads the weapon in hand (the frigates sailed off): that is what the
// player saw. This pins it: mid-wave, a nuke leaves your passives running.
describe('the Nuke spares your own weapons', () => {
  for (const id of ['frigate', 'aegis', 'gunships'] as const) {
    it(`${id}: still loaded and on the water after a nuke`, () => {
      const g = quiet(3);
      g.levels = { ...g.levels, [id]: 3 };
      g.slots = [id];
      g.pickups.push({ id: g.nextId++, kind: 'weapon', weapon: id, x: 800, y: 450, age: 0 });
      expect(tap(g, 800, 450, 60)).toBe('pickup');
      run(g, 4);
      const count = () => ({ escorts: g.escorts.length, aegis: g.ships.filter((s) => s.aegis).length, wings: g.wings.length, helis: g.helis.length });
      const before = count();
      expect(g.weapon?.id).toBe(id);
      expect(before.escorts + before.aegis + before.wings + before.helis).toBeGreaterThan(0);
      launchFoe(g, { at: 0, kind: 'rocketTruck', base: -1 });
      g.pickups.push({ id: g.nextId++, kind: 'nuke', x: 500, y: 500, age: 0 });
      expect(tap(g, 500, 500, 20)).toBe('pickup');
      step(g, DT);
      expect(g.phase).toBe('wave');
      expect(g.weapon?.id).toBe(id);
      const after = count();
      expect(after.escorts).toBe(before.escorts);
      expect(after.aegis).toBe(before.aegis);
      expect(after.wings).toBe(before.wings);
      expect(after.helis).toBe(before.helis);
    });
  }
});
