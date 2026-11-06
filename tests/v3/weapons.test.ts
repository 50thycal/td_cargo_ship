// The weapons plan, phases 0–1 (docs/design/v3-weapons-plan.md): the roster,
// the Nuke, and the six actives with new verbs. Each test is a real game with
// threats placed by hand, played through the same calls the UI makes (tap,
// or press / pressMove / release for the gesture weapons).

import { describe, expect, it } from 'vitest';
import { AB, ABILITY_ORDER, WEAPON, type AbilityId } from '../../src/v3/data/abilities';
import { PICKUPS, PICKUP_KINDS } from '../../src/v3/data/config';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { ROSTER, draftPool, gestureOf, isPrototype } from '../../src/v3/data/roster';
import { Recorder, replay } from '../../src/v3/sim/playlog';
import {
  CARRIER_TARGET,
  applyFreePlay,
  beatClock,
  createGame,
  pickUpgrade,
  press,
  pressMove,
  release,
  step,
  tap,
  type Game,
  type Threat,
} from '../../src/v3/sim/game';

const DT = 1 / 60;
const run = (g: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / DT) && g.phase === 'wave'; i++) step(g, DT);
};

function quietGame(seed = 1): Game {
  const g = createGame('strait', seed, 1);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  return g;
}

function addThreat(g: Game, over: Partial<Threat>): Threat {
  const th: Threat = {
    id: g.nextId++, kind: 'drone', x: 800, y: 300, vx: 0, vy: 0, hp: 1, speed: 0, heading: Math.PI / 2, target: CARRIER_TARGET,
    age: 0, phase: 0, dead: false, sx: 0, sy: 0, ix: 0, iy: 0, dur: 1, apex: 0, spawnT: 0, ...over,
  };
  g.threats.push(th);
  return th;
}

function load(g: Game, id: AbilityId, level = 1): void {
  g.levels[id] = level;
  if (!g.slots.includes(id)) g.slots.push(id);
  g.weapon = { id, level, t: WEAPON.time, t0: g.t };
}

const alive = (g: Game, th: Threat) => g.threats.includes(th) && !th.dead;

// Strait's carrier sits at (800, 705): a line straight up from it is x = 800.

describe('the roster (moddable: one line a weapon)', () => {
  it('every weapon has a roster line, and today’s twelve are live from chapter 1', () => {
    for (const id of ABILITY_ORDER) expect(ROSTER[id], id).toBeDefined();
    expect(draftPool(1)).toHaveLength(12);
    expect(draftPool(1).some(isPrototype)).toBe(false);
  });

  it('the campaign’s draft never deals a prototype, on any map', () => {
    for (const map of MAP_ORDER) {
      for (let seed = 1; seed <= 20; seed++) {
        const g = createGame(map, seed, 2);
        g.phase = 'wave';
        // Clearing the wave opens the draft.
        g.queue = [];
        g.threats = [];
        g.raiderQueue = [];
        g.raiders = [];
        step(g, DT);
        if ((g.phase as string) !== 'draft') continue;
        for (const id of g.offer) if (id !== 'resupply') expect(isPrototype(id), `${map} ${seed} ${id}`).toBe(false);
      }
    }
  });

  it('a prototype held in Free Play can still be levelled in its draft', () => {
    let offered = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const g = createGame('strait', seed, 1);
      applyFreePlay(g, { weapons: [{ id: 'lance', level: 1 }], frequentDrops: false });
      g.queue = [];
      g.threats = [];
      g.raiderQueue = [];
      step(g, DT);
      if (g.offer.includes('lance')) {
        offered++;
        pickUpgrade(g, 'lance');
        expect(g.levels.lance).toBe(2);
      }
    }
    expect(offered).toBeGreaterThan(0);
  });

  it('the gesture weapons say what holding does', () => {
    expect(gestureOf('lance')).toBe('charge');
    expect(gestureOf('cutter')).toBe('swipe');
    expect(gestureOf('grapnel')).toBe('drag');
    expect(gestureOf('railgun')).toBeUndefined();
  });
});

describe('the Nuke', () => {
  it('is a drop, not before wave 3, and only one on the water at a time', () => {
    expect(PICKUP_KINDS).toContain('nuke');
    expect(PICKUPS.weights.nuke).toBeGreaterThan(0);
    // Roll lots of drops on wave 1 and on wave 5.
    const roll = (wave: number) => {
      const g = quietGame();
      g.wave = wave;
      let nukes = 0;
      for (let k = 0; k < 3000; k++) {
        const th = addThreat(g, { kind: 'heavy', hp: 1, dropChance: 1 } as Partial<Threat>);
        tap(g, th.x, th.y, 30);
        g.ammo = g.stats.rack;
        run(g, 1.2);
        nukes += g.pickups.filter((p) => p.kind === 'nuke').length > 1 ? 99 : 0;
        if (g.pickups.some((p) => p.kind === 'nuke')) nukes++;
        g.pickups = [];
      }
      return nukes;
    };
    expect(roll(1)).toBe(0);
    const w5 = roll(5);
    expect(w5).toBeGreaterThan(0);
    expect(w5).toBeLessThan(99);
  });

  it('destroys every drone, missile and aircraft on screen; structures take 3 hits', () => {
    const g = quietGame();
    const ths = [addThreat(g, { x: 300, y: 200 }), addThreat(g, { kind: 'heavy', hp: 8, x: 900, y: 400 }), addThreat(g, { kind: 'strafer', hp: 3, x: 1400, y: 300 })];
    const rig = addThreat(g, { kind: 'rig', hp: 10, x: 600, y: 150 });
    g.pickups.push({ id: g.nextId++, kind: 'nuke', x: 500, y: 500, age: 0 });
    expect(tap(g, 500, 500, 20)).toBe('pickup');
    for (const th of ths) expect(th.dead).toBe(true);
    expect(rig.dead).toBe(false);
    expect(rig.hp).toBe(10 - PICKUPS.nukeStructure);
    expect(g.pickups.filter((p) => p.kind !== 'weapon')).toHaveLength(0); // no loot shower
  });
});

describe('Charge Lance (hold to charge, let go to fire)', () => {
  it('a quick tap is a plain shot', () => {
    const g = quietGame();
    load(g, 'lance');
    const th = addThreat(g, { x: 800, y: 400 });
    press(g, th.x, th.y, 30);
    run(g, 0.05);
    expect(release(g, th.x, th.y, 30)).toBe('fire');
    expect(g.interceptors).toHaveLength(1);
  });

  it('half a charge: 3 hits to the first threat on the line, one round', () => {
    const g = quietGame();
    load(g, 'lance');
    const near = addThreat(g, { kind: 'heavy', hp: 8, x: 800, y: 500 });
    const far = addThreat(g, { kind: 'heavy', hp: 8, x: 800, y: 250 });
    const ammo = g.ammo;
    press(g, far.x, far.y, 30);
    run(g, AB.lance.half + 0.05);
    expect(g.press?.mode).toBe('charge');
    release(g, far.x, far.y, 30);
    expect(near.hp).toBe(8 - AB.lance.halfDmg);
    expect(far.hp).toBe(8);
    expect(g.ammo).toBe(ammo - 1);
  });

  it('a full charge: 6 hits to everything in line; level 2 charges faster; MAX leaves a burning line', () => {
    const g = quietGame();
    load(g, 'lance', 3);
    const a = addThreat(g, { kind: 'heavy', hp: 8, x: 800, y: 500 });
    const b = addThreat(g, { kind: 'heavy', hp: 8, x: 800, y: 250 });
    press(g, b.x, b.y, 30);
    run(g, AB.lance.full / AB.lance.rate[2] + 0.05);
    release(g, b.x, b.y, 30);
    expect(a.hp).toBe(8 - AB.lance.fullDmg);
    expect(b.hp).toBe(8 - AB.lance.fullDmg);
    expect(g.fields.some((f) => f.kind === 'sun')).toBe(true);
  });
});

describe('Laser Cutter (swipe across threats)', () => {
  it('a swipe cuts everything under the finger once, for one round; a tap is a plain shot', () => {
    const g = quietGame();
    load(g, 'cutter');
    const line = [300, 380, 460].map((x) => addThreat(g, { x, y: 300 }));
    const off = addThreat(g, { x: 380, y: 420 });
    const ammo = g.ammo;
    press(g, 260, 300, 30);
    for (const x of [300, 340, 380, 420, 460, 500]) {
      pressMove(g, x, 300);
      step(g, DT);
    }
    release(g, 500, 300, 30);
    for (const th of line) expect(th.dead).toBe(true);
    expect(alive(g, off)).toBe(true);
    expect(g.ammo).toBe(ammo - 1);
    // A press that never moves is a tap.
    const t = addThreat(g, { x: 900, y: 300 });
    press(g, t.x, t.y, 30);
    expect(release(g, t.x, t.y, 30)).toBe('fire');
    expect(g.interceptors.length).toBeGreaterThan(0);
  });

  it('a swipe cuts at most its length; Searing Edge leaves the cut lit', () => {
    const g = quietGame();
    load(g, 'cutter', 3);
    const far = addThreat(g, { x: 1200, y: 300 });
    press(g, 100, 300, 30);
    pressMove(g, 1300, 300);
    release(g, 1300, 300, 30);
    expect(alive(g, far)).toBe(true);
    expect(g.fields.some((f) => f.kind === 'laser')).toBe(true);
  });
});

describe('Grapnel (hold a threat, drag it, let go)', () => {
  it('hooks the threat under the finger, swings it into others, flings it to burst', () => {
    const g = quietGame();
    load(g, 'grapnel');
    const ball = addThreat(g, { kind: 'heavy', hp: 8, x: 800, y: 300 });
    const hit = addThreat(g, { kind: 'guided', hp: 2, x: 950, y: 300 });
    const ammo = g.ammo;
    press(g, ball.x, ball.y, 30);
    expect(g.press?.mode).toBe('hook');
    expect(ball.held).toBe(true);
    expect(g.ammo).toBe(ammo - 1);
    for (let k = 0; k < 30; k++) {
      pressMove(g, 800 + k * 8, 300);
      step(g, DT);
    }
    expect(hit.dead).toBe(true); // smacked for 2
    release(g, 1040, 300, 30);
    run(g, AB.grapnel.fly + 0.1);
    expect(ball.held).toBe(false);
    expect(ball.hp).toBe(8 - AB.grapnel.burst[0]);
  });

  it('a held threat can’t hit anything, structures can’t be hooked, and a press on nothing is a tap', () => {
    const g = quietGame();
    load(g, 'grapnel');
    const rig = addThreat(g, { kind: 'rig', hp: 10, x: 800, y: 300 });
    press(g, rig.x, rig.y, 30);
    expect(g.press?.mode).toBe('pending');
    expect(release(g, rig.x, rig.y, 30)).toBe('fire');
    const m = addThreat(g, { kind: 'guided', hp: 2, x: 800, y: 600, speed: 150, target: CARRIER_TARGET });
    press(g, m.x, m.y, 30);
    const hp = g.carrierHp;
    run(g, 2);
    expect(g.carrierHp).toBe(hp);
  });
});

describe('Chain Shot (tap one, then a second)', () => {
  it('the first tap fires and marks; a second in reach chains them for 2 hits each', () => {
    const g = quietGame();
    load(g, 'chainshot');
    const a = addThreat(g, { kind: 'heavy', hp: 8, x: 700, y: 300 });
    const b = addThreat(g, { kind: 'heavy', hp: 8, x: 900, y: 300 });
    const between = addThreat(g, { kind: 'guided', hp: 2, x: 800, y: 300 });
    expect(tap(g, a.x, a.y, 30)).toBe('fire');
    expect(g.link?.id).toBe(a.id);
    expect(tap(g, b.x, b.y, 30)).toBe('fire');
    expect(a.held && b.held).toBe(true);
    run(g, AB.chainshot.pull + 0.05);
    expect(b.hp).toBe(8 - AB.chainshot.damage[0]);
    expect(between.dead).toBe(true);
    expect(g.link).toBeNull();
  });
});

describe('Fire Control (mark, then the salvo)', () => {
  it('taps mark without spending; the salvo fires at all of them at once, a round for every two', () => {
    const g = quietGame();
    load(g, 'firecontrol');
    const ths = [600, 800, 1000].map((x) => addThreat(g, { kind: 'heavy', hp: 8, x, y: 200 }));
    const ammo = g.ammo;
    for (const th of ths) expect(tap(g, th.x, th.y, 30)).toBe('fire');
    expect(g.ammo).toBe(ammo);
    expect(g.marks).toHaveLength(3);
    run(g, AB.firecontrol.wait[0] + 0.05);
    expect(g.ammo).toBe(ammo - Math.ceil(3 / AB.firecontrol.perRound));
    expect(g.interceptors).toHaveLength(3);
  });

  it('a threat about to hit is shot at once, not marked', () => {
    const g = quietGame();
    load(g, 'firecontrol');
    const th = addThreat(g, { kind: 'guided', hp: 2, x: 800, y: 660, speed: 150 });
    tap(g, th.x, th.y, 30);
    expect(g.marks).toHaveLength(0);
    expect(g.interceptors).toHaveLength(1);
  });
});

describe('Cadence Gun (fire on the beat)', () => {
  it('on the beat: 3 hits through everything in line; off the beat: a plain shot', () => {
    const g = quietGame();
    load(g, 'cadence');
    const a = addThreat(g, { kind: 'heavy', hp: 8, x: 800, y: 500 });
    const b = addThreat(g, { kind: 'heavy', hp: 8, x: 800, y: 250 });
    run(g, AB.cadence.period); // the first beat
    expect(beatClock(g, g.weapon!).off).toBeLessThan(AB.cadence.window[0]);
    tap(g, b.x, b.y, 30);
    expect(a.hp).toBe(8 - AB.cadence.damage);
    expect(b.hp).toBe(8 - AB.cadence.damage);
    run(g, AB.cadence.period / 2); // halfway between beats
    tap(g, b.x, b.y, 30);
    expect(g.interceptors.length).toBeGreaterThan(0);
  });

  it('War Drum: four beats in a row, and the next beat fires a free broadside', () => {
    const g = quietGame();
    load(g, 'cadence', 3);
    const target = addThreat(g, { kind: 'citadel', hp: 999, x: 800, y: 200 });
    for (let k = 0; k < 6; k++) addThreat(g, { kind: 'heavy', hp: 99, x: 300 + k * 150, y: 150 });
    for (let k = 0; k < AB.cadence.run; k++) {
      run(g, AB.cadence.period);
      tap(g, target.x, target.y, 30);
    }
    expect(g.beat.armed).toBe(true);
    const ammo = g.ammo;
    g.interceptors = [];
    run(g, AB.cadence.period + 0.02);
    expect(g.interceptors.length).toBe(AB.cadence.broadside);
    expect(g.ammo).toBeGreaterThanOrEqual(ammo); // free (the rack only reloads)
  });
});

describe('the play log records presses, so a gesture run replays exactly', () => {
  it('a Free Play run with Lance, Cutter and Grapnel replays to the same game', () => {
    const g = createGame('strait', 7, 3);
    const setup = { weapons: [{ id: 'lance' as AbilityId, level: 2 }, { id: 'cutter' as AbilityId, level: 1 }, { id: 'grapnel' as AbilityId, level: 1 }], frequentDrops: true };
    applyFreePlay(g, setup);
    const rec = new Recorder(g, { build: 'test', startedAt: '2026-11-06T00:00:00Z', firstWave: 3, freePlay: setup } as never);
    let k = 0;
    for (let i = 0; i < 60 * 60 && g.phase === 'wave'; i++) {
      // Every few seconds: load whatever weapon is on the water, then use it.
      if (i % 30 === 0 && g.pickups.length) rec.tap(g.pickups[0].x, g.pickups[0].y, 30);
      const th = g.threats.find((t) => !t.dead && t.y > 100 && t.y < 800);
      if (th && i % 45 === 0) {
        k++;
        rec.press(th.x, th.y, 30);
      }
      if (g.press && i % 45 > 0 && i % 45 < 30) rec.move(g.press.x + 12, g.press.y - 6);
      if (g.press && i % 45 === 30) rec.release(g.press.x, g.press.y, 30);
      if (i % 20 === 0 && th) rec.tap(th.x, th.y, 30);
      step(g, 1 / 60);
    }
    expect(k).toBeGreaterThan(10);
    const log = rec.snapshot();
    expect(log.commands.some((c) => c[1] === 'd')).toBe(true);
    const r = replay(log);
    expect(r.steps).toBe(g.steps);
    expect(r.score).toBe(g.score);
    expect(r.ammo).toBe(g.ammo);
    expect(r.kills).toEqual(g.kills);
  });
});
