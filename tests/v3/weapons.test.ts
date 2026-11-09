// The weapons plan, phases 0–1 (docs/design/v3-weapons-plan.md): the roster,
// the Nuke, and the six actives with new verbs. Each test is a real game with
// threats placed by hand, played through the same calls the UI makes (tap,
// or press / pressMove / release for the gesture weapons).

import { describe, expect, it } from 'vitest';
import { AB, ABILITIES, ABILITY_ORDER, WEAPON, type AbilityId } from '../../src/v3/data/abilities';
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
  type Raider,
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
  it('every weapon has a roster line; all are live, and each chapter brings the ones the player marked', () => {
    for (const id of ABILITY_ORDER) expect(ROSTER[id], id).toBeDefined();
    expect(ABILITY_ORDER.some(isPrototype)).toBe(false);
    // The lock-in round (tools/v3/weapon-ideas/lockin-marks-2026-11-07.json).
    const NEW: Record<number, AbilityId[]> = {
      1: ['airstrike', 'shrapnel', 'frigate', 'thermo', 'scatter', 'boomerang', 'flak', 'seeker', 'aegis', 'well', 'railgun', 'tesla', 'cutter', 'droneScreen', 'supplyRun', 'overdrive', 'timeWarp'],
      2: ['lance', 'gunships', 'overclock', 'shield', 'fullSteam'],
      3: ['grapnel', 'bomberWing', 'orbital', 'dualWield', 'focus'],
      4: ['cadence', 'wildCard'],
    };
    for (let c = 1; c <= 4; c++) {
      const before = c > 1 ? draftPool(c - 1) : [];
      expect(draftPool(c).filter((id) => !before.includes(id)).sort(), `chapter ${c}`).toEqual([...NEW[c]].sort());
    }
    expect(draftPool(4)).toEqual(ABILITY_ORDER);
  });

  it('a map deals only what its chapter has unlocked, and a later chapter deals its new weapons', () => {
    const seen: Record<number, Set<AbilityId>> = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() };
    MAP_ORDER.forEach((map, i) => {
      const chapter = Math.floor(i / 5) + 1;
      for (let seed = 1; seed <= 12; seed++) {
        const g = createGame(map, seed, 2);
        g.phase = 'wave';
        g.queue = [];
        g.threats = [];
        g.raiderQueue = [];
        g.raiders = [];
        step(g, DT);
        if ((g.phase as string) !== 'draft') continue;
        for (const id of g.offer) if (id !== 'resupply') {
          expect(ROSTER[id].unlock, `${map} ${seed} ${id}`).toBeLessThanOrEqual(chapter);
          seen[chapter].add(id);
        }
      }
    });
    for (const id of ['lance', 'gunships'] as AbilityId[]) expect(seen[2].has(id), id).toBe(true);
    for (const id of ['grapnel', 'orbital'] as AbilityId[]) expect(seen[3].has(id), id).toBe(true);
    for (const id of ['cadence', 'wildCard'] as AbilityId[]) expect(seen[4].has(id), id).toBe(true);
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

  it('War Drum: three beats in a row, and the next beat fires a free broadside', () => {
    const g = quietGame();
    load(g, 'cadence', 3);
    const target = addThreat(g, { kind: 'citadel', hp: 999, x: 800, y: 200 });
    for (let k = 0; k < 8; k++) addThreat(g, { kind: 'heavy', hp: 99, x: 260 + k * 150, y: 150 });
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

// Test Lab round 4, the player: "have the third upgrade be a little bit more
// powerful. Maybe we could blow up the platforms and vehicles."
describe('War Drum (Cadence MAX): on the beat it blows up platforms and vehicles', () => {
  /** A launch truck up on its road at (x, y). */
  const truck = (g: Game, x: number, y: number): Raider => {
    const r: Raider = { id: g.nextId++, kind: 'popup', x, y, heading: Math.PI / 2, state: 'fire', t: 0, path: [{ x, y: -40 }, { x, y }], dist: y + 40, length: y + 40, stops: [], rounds: ['drone'], units: [], fireT: 9 };
    g.raiders.push(r);
    return r;
  };
  /** One of each platform up the line x = 800, at full health, and a
   *  structure past them; a launch truck at the top. */
  const line = (g: Game) => ({
    truck: addThreat(g, { kind: 'rocketTruck', hp: 4, x: 800, y: 560 }),
    heli: addThreat(g, { kind: 'attackHeli', hp: 6, x: 800, y: 500 }),
    sub: addThreat(g, { kind: 'torpedoSub', hp: 3, x: 810, y: 440 }),
    tender: addThreat(g, { kind: 'tender', hp: 6, x: 790, y: 380 }),
    siege: addThreat(g, { kind: 'siege', hp: 5, x: 800, y: 320 }),
    bomber: addThreat(g, { kind: 'stealthBomber', hp: 6, x: 800, y: 260 }),
    rig: addThreat(g, { kind: 'rig', hp: 40, x: 800, y: 200 }),
    off: addThreat(g, { kind: 'tender', hp: 6, x: 1100, y: 380 }),
    raider: truck(g, 800, 130),
  });

  it('MAX, on the beat: every platform on the line is destroyed in one hit, and the launch truck with them; a structure only takes the hit', () => {
    const g = quietGame();
    load(g, 'cadence', 3);
    run(g, AB.cadence.period);
    // Placed on the beat (hand-placed platforms don't move or fire).
    const o = line(g);
    expect(beatClock(g, g.weapon!).off).toBeLessThan(AB.cadence.window[2]);
    tap(g, 800, 150, 30);
    for (const k of ['truck', 'heli', 'sub', 'tender', 'siege', 'bomber'] as const) expect(alive(g, o[k]), k).toBe(false);
    expect(o.rig.hp).toBe(40 - AB.cadence.damage);
    expect(alive(g, o.off)).toBe(true);
    expect(o.raider.state).toBe('reverse');
    expect(g.events.some((e) => e.kind === 'bigKill' && e.label === 'TRUCK DESTROYED')).toBe(true);
  });

  it('only at MAX, and only on the beat: level 2 on the beat and MAX off it hit for 4 as before', () => {
    const g = quietGame();
    load(g, 'cadence', 2);
    run(g, AB.cadence.period);
    const o = line(g);
    tap(g, 800, 150, 30);
    expect(o.tender.hp).toBe(6 - AB.cadence.damage);
    expect(o.heli.hp).toBe(6 - AB.cadence.damage);
    expect(o.raider.state).toBe('fire');
    const h = quietGame();
    load(h, 'cadence', 3);
    run(h, AB.cadence.period * 1.5); // halfway between beats: a plain shot
    const p = line(h);
    tap(h, p.tender.x, p.tender.y, 30);
    expect(h.interceptors.length).toBeGreaterThan(0);
    expect(alive(h, p.tender)).toBe(true);
    expect(p.raider.state).toBe('fire');
  });

  it('the draft card says so', () => {
    expect(ABILITIES.cadence.levels[2]).toMatch(/blows up any truck, siege gun, helicopter, sub or repair ship/);
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

// ---------------------------------------------------------------------------
// Phase 2: the passives (the gun stays plain; they work on their own).

describe('Drone Screen (drones off the carrier deck)', () => {
  it('launches a drone off the deck every 1.2 s; each rams a different threat', () => {
    const g = quietGame();
    load(g, 'droneScreen');
    const a = addThreat(g, { x: 600, y: 300 });
    const b = addThreat(g, { x: 1000, y: 300 });
    const c = g.map.carrier;
    run(g, 0.25);
    expect(g.wings).toHaveLength(1);
    expect(Math.hypot(g.wings[0].x - c.x, g.wings[0].y - c.y)).toBeLessThan(120);
    run(g, AB.droneScreen.gap[0]);
    expect(g.wings.length + (a.dead ? 1 : 0) + (b.dead ? 1 : 0)).toBeGreaterThanOrEqual(2);
    run(g, 3);
    expect(a.dead && b.dead).toBe(true);
    // A tap is still the plain gun.
    const t = addThreat(g, { kind: 'heavy', hp: 8, x: 800, y: 200 });
    expect(tap(g, t.x, t.y, 30)).toBe('fire');
    expect(g.interceptors.length).toBeGreaterThan(0);
  });

  it('Hornet Nest: a ram bursts and hits what is around it', () => {
    const g = quietGame();
    load(g, 'droneScreen', 3);
    const a = addThreat(g, { x: 800, y: 400 });
    const near = addThreat(g, { kind: 'guided', hp: 1, x: 830, y: 400 });
    run(g, 1.5);
    expect(a.dead && near.dead).toBe(true);
  });
});

describe('Gunship Pair (helicopters over the convoy)', () => {
  it('two helicopters fly in over the convoy and rocket the thickest cluster near it, not far threats', () => {
    const g = quietGame();
    run(g, 6); // ships in
    load(g, 'gunships');
    // The pickup's load sets them up.
    g.pickups.push({ id: g.nextId++, kind: 'weapon', weapon: 'gunships', x: 300, y: 820, age: 0 });
    tap(g, 300, 820, 30);
    expect(g.helis).toHaveLength(AB.gunships.count[0]);
    run(g, 3);
    const mid = { x: g.ships.reduce((s, x) => s + x.x, 0) / g.ships.length, y: g.ships.reduce((s, x) => s + x.y, 0) / g.ships.length };
    const pack = [0, 1, 2].map((k) => addThreat(g, { x: mid.x + k * 20, y: mid.y - 120 }));
    const far = addThreat(g, { x: mid.x > 800 ? 100 : 1500, y: 100 });
    run(g, 2);
    expect(pack.every((t) => t.dead)).toBe(true);
    expect(alive(g, far)).toBe(true);
  });

  it('when the weapon runs out they fly away', () => {
    const g = quietGame();
    run(g, 4);
    g.levels.gunships = 1;
    g.slots = ['gunships'];
    g.pickups.push({ id: g.nextId++, kind: 'weapon', weapon: 'gunships', x: 300, y: 820, age: 0 });
    tap(g, 300, 820, 30);
    g.weapon!.t = 0.01;
    run(g, 6);
    expect(g.helis).toHaveLength(0);
  });
});

describe('Bomber Wing (the shore: trucks, silos, tunnels)', () => {
  it('silences the busiest silo for 6 s: its launches in that time are cancelled, not delayed', () => {
    const g = quietGame();
    load(g, 'bomberWing');
    g.passiveT = AB.bomberWing.first;
    // Base 0 has four launches due in the next few seconds; base 1 one.
    g.queue = [
      ...[2, 2.5, 3, 3.5].map((dt) => ({ at: g.waveT + dt, kind: 'drone' as const, base: 0 })),
      { at: g.waveT + 3, kind: 'drone' as const, base: 1 },
      { at: 1e9, kind: 'drone' as const, base: 0 },
    ];
    run(g, 1.6);
    expect(g.quietUntil[0]).toBeGreaterThan(g.t);
    run(g, 4);
    // Only base 1's launch happened.
    expect(g.origins.base).toBe(1);
    run(g, 6);
    expect(g.origins.base).toBe(1);
  });

  it('destroys a truck on screen first', () => {
    const g = createGame('island', 3, 6);
    g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    run(g, 0.1);
    // Wait for a truck to roll out.
    for (let i = 0; i < 60 * 40 && !g.raiders.some((r) => r.kind !== 'sub' && r.x > 0 && r.x < 1600 && r.y > 0 && r.y < 900 && r.rounds.length + r.units.length > 0); i++) step(g, DT);
    const truck = g.raiders.find((r) => r.kind !== 'sub' && r.x > 0 && r.x < 1600);
    expect(truck).toBeDefined();
    load(g, 'bomberWing');
    g.passiveT = 0.01;
    run(g, 2);
    expect(truck!.state).toBe('reverse');
    expect(truck!.units.length + truck!.rounds.length).toBe(0);
  });

  it('Carpet Raid (MAX) also bombs a surfaced sub; level 1 leaves it alone', () => {
    const surfaced = (level: number) => {
      const g = createGame('strait', 5, 6);
      g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
      g.raiderQueue = g.raiderQueue.filter((sp) => sp.kind === 'sub');
      const up = (r: (typeof g.raiders)[number]) => r.kind === 'sub' && r.state !== 'warn' && r.state !== 'dive' && r.state !== 'reverse' && r.x > 0 && r.x < 1600 && r.y > 0 && r.y < 900;
      for (let i = 0; i < 60 * 60 && !g.raiders.some(up); i++) step(g, DT);
      const sub = g.raiders.find(up);
      expect(sub).toBeDefined();
      g.quietUntil = g.map.bases.map(() => 1e9); // no silo to pick
      load(g, 'bomberWing', level);
      g.passiveT = 0.01;
      run(g, 0.05);
      return g.sorties.some((s) => s.kind === 'truck' && s.ref === sub!.id);
    };
    expect(surfaced(3)).toBe(true);
    expect(surfaced(1)).toBe(false);
  });
});

describe('Orbital Strike (laser dots, then the beam)', () => {
  it('locks the toughest threat on screen, and the beam hits it for 3 after the lock', () => {
    const g = quietGame();
    load(g, 'orbital');
    const small = addThreat(g, { x: 500, y: 300 });
    const big = addThreat(g, { kind: 'heavy', hp: 8, x: 1000, y: 300 });
    g.passiveT = 0.01;
    run(g, 0.05);
    expect(g.orbital?.id).toBe(big.id);
    run(g, AB.orbital.lock * 0.5);
    expect(big.hp).toBe(8);
    run(g, AB.orbital.lock * 0.6);
    expect(big.hp).toBe(8 - AB.orbital.damage);
    expect(alive(g, small)).toBe(true);
  });

  it('Sky Spear: the beam lingers onto the next toughest', () => {
    const g = quietGame();
    load(g, 'orbital', 3);
    const a = addThreat(g, { kind: 'heavy', hp: 8, x: 1000, y: 300 });
    const b = addThreat(g, { kind: 'mothership', hp: 5, x: 500, y: 300 });
    g.passiveT = 0.01;
    run(g, AB.orbital.lock + AB.orbital.linger + 0.2);
    expect(a.hp).toBe(8 - AB.orbital.damage);
    expect(b.hp).toBe(5 - AB.orbital.damage);
  });
});
