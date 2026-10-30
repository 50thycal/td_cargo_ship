// V3: the main gun is set in the Armory before a run; the in-run draft deals
// weapons that drop as pickups and load the gun for a while (round 2). These
// tests pin both systems down.

import { describe, expect, it } from 'vitest';
import { AB, ABILITIES, ABILITY_MAX, ABILITY_ORDER, MAX_SLOTS, WEAPON, abilityName, type AbilityId } from '../../src/v3/data/abilities';
import { ARMORY, ARMORY_COSTS, ARMORY_MAX, ARMORY_ORDER, ARMORY_TOTAL, gunStats, nextCost, salvageFor, SALVAGE } from '../../src/v3/data/armory';
import { CARRIER, INTERCEPTOR, PICKUPS, PICKUP_KINDS, SHIP } from '../../src/v3/data/config';
import { buyArmory, equipArmory, loadProgress, recordResult, runGun, type Progress } from '../../src/v3/platform/save';
import { Bot, runBot, SKILLS } from '../../src/v3/sim/bot';
import { playMimic } from '../../src/v3/sim/mimic';
import { replay } from '../../src/v3/sim/playlog';
import {
  CARRIER_TARGET,
  createGame,
  pickUpgrade,
  step,
  tap,
  type Game,
  type Pickup,
  type Raider,
  type Threat,
} from '../../src/v3/sim/game';

const DT = 1 / 60;

function run(g: Game, seconds: number): void {
  for (let i = 0; i < seconds / DT && g.phase === 'wave'; i++) step(g, DT);
}

/** A game whose wave never launches anything (one launch parked far in the
 *  future keeps the wave open), so a test can place its own threats. */
function quietGame(seed = 1, armory = {}): Game {
  const g = createGame('strait', seed, 1, undefined, armory);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  return g;
}

function addThreat(g: Game, over: Partial<Threat>): Threat {
  const th: Threat = {
    id: g.nextId++,
    kind: 'drone',
    x: 800,
    y: 300,
    vx: 0,
    vy: 0,
    hp: 1,
    speed: 70,
    heading: Math.PI / 2,
    target: CARRIER_TARGET,
    age: 0,
    phase: 0,
    dead: false,
    sx: 0,
    sy: 0,
    ix: 0,
    iy: 0,
    dur: 1,
    apex: 0,
    spawnT: 0,
    ...over,
  };
  g.threats.push(th);
  return th;
}

/** Hold a weapon at a level, loaded in the gun. */
function load(g: Game, id: AbilityId, level = 1): void {
  g.levels[id] = level;
  if (!g.slots.includes(id)) g.slots.push(id);
  g.weapon = { id, level, t: WEAPON.time };
}

function addRaider(g: Game, over: Partial<Raider> = {}): Raider {
  const r: Raider = {
    id: g.nextId++,
    kind: 'sub',
    x: 700,
    y: 420,
    heading: 0,
    state: 'fire',
    t: 0,
    path: [{ x: 700, y: 420 }],
    dist: 0,
    length: 0,
    stops: [],
    rounds: ['ballistic', 'ballistic'],
    units: [],
    fireT: 5,
    ...over,
  };
  g.raiders.push(r);
  return r;
}

// ---------------------------------------------------------------------------

describe('the Armory (the main gun, set before a run)', () => {
  it('with no levels it is exactly the base gun', () => {
    const s = gunStats({});
    expect(s.rack).toBe(INTERCEPTOR.rack);
    expect(s.reload).toBe(INTERCEPTOR.reload);
    expect(s.blast).toBe(INTERCEPTOR.blast);
    expect(s.interceptorSpeed).toBe(INTERCEPTOR.speed);
    expect(s.contact).toBe(INTERCEPTOR.contact);
    expect(s.hitDamage).toBe(1);
    expect(s.shipHp).toBe(SHIP.hp);
  });

  it('each upgrade makes only its own number better, level by level', () => {
    const base = gunStats({});
    const field = { reload: 'reload', warhead: 'blast', motor: 'interceptorSpeed', magazine: 'rack', fuse: 'contact' } as const;
    for (const id of ARMORY_ORDER) {
      let prev = base[field[id]];
      for (let lv = 1; lv <= ARMORY_MAX; lv++) {
        const s = gunStats({ [id]: lv });
        const v = s[field[id]];
        // Reload is a time: better is smaller.
        if (id === 'reload') expect(v).toBeLessThan(prev);
        else expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
        for (const other of ARMORY_ORDER) if (other !== id) expect(s[field[other]]).toBe(base[field[other]]);
      }
    }
  });

  it('stops short of the mash-wins line round 6 found (≤10 rounds, ≥70% reload time)', () => {
    const top = gunStats(Object.fromEntries(ARMORY_ORDER.map((id) => [id, ARMORY_MAX])));
    expect(top.rack).toBeLessThanOrEqual(10);
    expect(top.reload / INTERCEPTOR.reload).toBeGreaterThanOrEqual(0.7 - 1e-9);
    expect(top.hitDamage).toBe(2);
  });

  it('costs climb, cap at level 5, and the run reads its gun from the armory', () => {
    expect([...ARMORY_COSTS]).toEqual([...ARMORY_COSTS].sort((a, b) => a - b));
    expect(nextCost({ warhead: 0 }, 'warhead')).toBe(ARMORY_COSTS[0]);
    expect(nextCost({ warhead: ARMORY_MAX }, 'warhead')).toBeNull();
    expect(ARMORY_TOTAL).toBe(ARMORY_COSTS.reduce((a, b) => a + b, 0) * 5);
    const g = createGame('strait', 1, 1, undefined, { magazine: 2 });
    expect(g.stats.rack).toBe(INTERCEPTOR.rack + 2);
    expect(g.ammo).toBe(INTERCEPTOR.rack + 2);
  });

  it('every run pays salvage, a cleared map more, the first clear a bonus once', () => {
    const p: Progress = { unlocked: 1, best: {}, salvage: 0, earned: 0, armory: {}, equipped: null, cleared: [] };
    const lost = recordResult(p, 'strait', { score: 900, wave: 4, cleared: false, delivered: 30, wavesCleared: 3 });
    expect(lost.salvage).toBe(30 * SALVAGE.perShip + 3 * SALVAGE.perWave);
    const won = recordResult(p, 'strait', { score: 9000, wave: 10, cleared: true, delivered: 80, wavesCleared: 10 });
    expect(won.firstClear).toBe(true);
    expect(won.salvage).toBe(salvageFor({ delivered: 80, wavesCleared: 10, cleared: true }, true));
    const again = recordResult(p, 'strait', { score: 9000, wave: 10, cleared: true, delivered: 80, wavesCleared: 10 });
    expect(again.firstClear).toBe(false);
    expect(again.salvage).toBe(won.salvage - SALVAGE.firstClear);
    expect(p.unlocked).toBe(2);
    expect(p.salvage).toBe(lost.salvage + won.salvage + again.salvage);
  });

  it('buying spends salvage and raises the level; too dear or maxed does nothing', () => {
    const p: Progress = { unlocked: 1, best: {}, salvage: ARMORY_COSTS[0] + 5, earned: 0, armory: {}, equipped: null, cleared: [] };
    expect(buyArmory(p, 'reload')).toBe(true);
    expect(p.armory.reload).toBe(1);
    expect(p.salvage).toBe(5);
    expect(buyArmory(p, 'reload')).toBe(false);
    p.salvage = 1e6;
    p.armory.fuse = ARMORY_MAX;
    expect(buyArmory(p, 'fuse')).toBe(false);
  });

  it('a run takes ONE upgrade: the first one bought is equipped, only owned ones can be, and the gun has only it', () => {
    const p: Progress = { unlocked: 1, best: {}, salvage: 1e6, earned: 0, armory: {}, equipped: null, cleared: [] };
    expect(runGun(p)).toEqual({});
    buyArmory(p, 'warhead');
    buyArmory(p, 'warhead');
    buyArmory(p, 'magazine');
    expect(p.equipped).toBe('warhead');
    expect(runGun(p)).toEqual({ warhead: 2 });
    expect(equipArmory(p, 'reload')).toBe(false);
    expect(equipArmory(p, 'magazine')).toBe(true);
    expect(runGun(p)).toEqual({ magazine: 1 });
    const g = createGame('strait', 1, 1, undefined, runGun(p));
    expect(g.stats.rack).toBe(INTERCEPTOR.rack + 1);
    expect(g.stats.blast).toBe(INTERCEPTOR.blast);
    expect(equipArmory(p, null)).toBe(true);
    expect(runGun(p)).toEqual({});
  });

  it('an empty or broken save loads as a fresh record', () => {
    const p = loadProgress();
    expect(p.salvage).toBe(0);
    expect(p.armory).toEqual({});
    expect(p.equipped).toBeNull();
    expect(p.unlocked).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe('the draft deals weapons', () => {
  it('three different weapons after a wave; no V2 cards, no main-gun upgrades', () => {
    const g = createGame('strait', 3);
    for (let i = 0; i < 60 * 300 && g.phase === 'wave'; i++) {
      for (const th of g.threats) th.dead = true;
      step(g, DT);
    }
    expect(g.phase).toBe('draft');
    expect(new Set(g.offer).size).toBe(3);
    for (const id of g.offer) expect(ABILITY_ORDER).toContain(id);
  });

  it('drafting a weapon puts it in the drop pool; nothing is loaded until its pickup is tapped', () => {
    const g = quietGame();
    g.phase = 'draft';
    g.offer = ['emp', 'airstrike', 'railgun'];
    pickUpgrade(g, 'emp');
    expect(g.levels.emp).toBe(1);
    expect(g.slots).toEqual(['emp']);
    expect(g.weapon).toBeNull();
    g.phase = 'draft';
    g.offer = ['emp', 'airstrike', 'railgun'];
    pickUpgrade(g, 'emp');
    expect(g.levels.emp).toBe(2);
    expect(g.slots).toEqual(['emp']);
  });

  it('holds three; a fourth needs a swap that gives one up; level 3 is the evolution', () => {
    const g = quietGame();
    g.levels = { emp: 1, airstrike: 1, railgun: 3 };
    g.slots = ['emp', 'airstrike', 'railgun'];
    g.phase = 'draft';
    g.offer = ['tesla', 'emp', 'decoy'];
    pickUpgrade(g, 'tesla');
    expect(g.levels.tesla).toBeUndefined();
    g.phase = 'draft';
    g.offer = ['tesla', 'emp', 'decoy'];
    pickUpgrade(g, 'tesla', 'airstrike');
    expect(Object.keys(g.levels).sort()).toEqual(['emp', 'railgun', 'tesla']);
    expect(g.slots).toEqual(['emp', 'tesla', 'railgun']);
    expect(MAX_SLOTS).toBe(3);
    expect(abilityName('railgun', 3)).toBe(ABILITIES.railgun.evolved);
    expect(abilityName('railgun', 2)).toBe(ABILITIES.railgun.name);
  });

  it('loadout slots are stable: a new weapon takes the next slot, a swap takes the replaced one\'s', () => {
    const g = quietGame();
    const take = (id: 'salvo' | 'emp' | 'decoy' | 'airstrike', replace?: 'emp') => {
      g.phase = 'draft';
      g.offer = [id, 'tesla', 'hunter'];
      pickUpgrade(g, id, replace);
    };
    take('salvo');
    take('emp');
    take('decoy');
    expect(g.slots).toEqual(['salvo', 'emp', 'decoy']);
    take('airstrike', 'emp');
    expect(g.slots).toEqual(['salvo', 'airstrike', 'decoy']);
  });

  it('every weapon has three levels, an evolved name, and says how a tap fires it', () => {
    for (const id of ABILITY_ORDER) {
      const a = ABILITIES[id];
      expect(a.levels).toHaveLength(ABILITY_MAX);
      expect(a.levels[2]).toMatch(/^EVOLVES/);
      expect(a.evolved).not.toBe(a.name);
      expect(a.how.length).toBeGreaterThan(5);
    }
  });

  it('EMP and Strike are not power-ups, and a weapon pickup is not one of the power-up rolls', () => {
    expect(PICKUP_KINDS).not.toContain('emp');
    expect(PICKUP_KINDS).not.toContain('strike');
    expect(PICKUP_KINDS).not.toContain('weapon');
  });
});

// ---------------------------------------------------------------------------

describe('weapons drop as pickups and load the gun', () => {
  /** Play a wave with the bot, noting every pickup that appears. */
  function watchPickups(g: Game, seconds: number): { all: Pickup[]; twoAtOnce: boolean } {
    const bot = new Bot(SKILLS.sharp, 5);
    const seen = new Map<number, Pickup>();
    let twoAtOnce = false;
    for (let i = 0; i < seconds * 30 && g.phase === 'wave'; i++) {
      bot.act(g);
      step(g, 1 / 30);
      for (const p of g.pickups) seen.set(p.id, { ...p });
      if (g.pickups.filter((p) => p.kind === 'weapon').length > 1) twoAtOnce = true;
    }
    return { all: [...seen.values()], twoAtOnce };
  }

  it('with no weapon held, none ever drops', () => {
    const { all } = watchPickups(createGame('strait', 4), 120);
    expect(all.length).toBeGreaterThan(0);
    expect(all.some((p) => p.kind === 'weapon')).toBe(false);
  });

  it('with weapons held, they drop alongside the power-ups: always one you hold, one at a time', () => {
    const g = createGame('strait', 4, 4);
    expect(g.slots.length).toBeGreaterThan(0);
    const { all, twoAtOnce } = watchPickups(g, 120);
    const weapons = all.filter((p) => p.kind === 'weapon');
    expect(weapons.length).toBeGreaterThan(1);
    expect(all.length).toBeGreaterThan(weapons.length);
    for (const p of weapons) expect(g.slots).toContain(p.weapon);
    expect(twoAtOnce).toBe(false);
    expect(Object.values(g.uses).reduce((a, b) => a + (b ?? 0), 0)).toBeGreaterThan(0);
  });

  it(`tapping one loads the gun for ${WEAPON.time} s, then it is the plain gun again`, () => {
    const g = quietGame();
    g.levels.railgun = 2;
    g.slots = ['railgun'];
    g.pickups.push({ id: 900, kind: 'weapon', weapon: 'railgun', x: 600, y: 300, age: 0 });
    expect(tap(g, 600, 300, 20)).toBe('pickup');
    expect(g.weapon).toEqual({ id: 'railgun', level: 2, t: WEAPON.time });
    expect(g.events).toContainEqual({ kind: 'weapon', id: 'railgun', level: 2 });
    expect(g.uses.railgun).toBe(1);
    run(g, WEAPON.time - 0.5);
    expect(g.weapon?.id).toBe('railgun');
    run(g, 1);
    expect(g.weapon).toBeNull();
  });

  it('the same weapon again restarts its clock; another one takes over; a swapped-out one loads nothing', () => {
    const g = quietGame();
    g.levels = { railgun: 1, emp: 2 };
    g.slots = ['railgun', 'emp'];
    g.weapon = { id: 'railgun', level: 1, t: 3 };
    g.pickups.push({ id: 901, kind: 'weapon', weapon: 'railgun', x: 600, y: 300, age: 0 });
    tap(g, 600, 300, 20);
    expect(g.weapon!.t).toBe(WEAPON.time);
    g.pickups.push({ id: 902, kind: 'weapon', weapon: 'emp', x: 600, y: 300, age: 0 });
    tap(g, 600, 300, 20);
    expect(g.weapon).toEqual({ id: 'emp', level: 2, t: WEAPON.time });
    g.pickups.push({ id: 903, kind: 'weapon', weapon: 'tesla', x: 600, y: 300, age: 0 });
    tap(g, 600, 300, 20);
    expect(g.weapon!.id).toBe('emp');
  });

  it(`a weapon pickup floats ${WEAPON.life} s (longer than a power-up) before it is gone`, () => {
    const g = quietGame();
    g.pickups.push({ id: 904, kind: 'weapon', weapon: 'emp', x: 600, y: 300, age: 0 });
    g.pickups.push({ id: 905, kind: 'ammo', x: 900, y: 300, age: 0 });
    run(g, PICKUPS.life + 0.1);
    expect(g.pickups.map((p) => p.id)).toEqual([904]);
    run(g, WEAPON.life - PICKUPS.life);
    expect(g.pickups).toHaveLength(0);
  });

  it('every weapon shot spends a round like a plain one: an empty rack is a dry click; Overdrive is free', () => {
    for (const id of ABILITY_ORDER) {
      const g = quietGame();
      load(g, id, 1);
      const th = addThreat(g, { x: 800, y: 300 });
      if (id === 'hunter') addRaider(g, { x: 800, y: 300 });
      const before = g.ammo;
      expect(tap(g, th.x, th.y, 30), id).toBe('fire');
      expect(g.ammo, id).toBe(before - 1);
      g.ammo = 0;
      expect(tap(g, th.x, th.y, 30), id).toBe('dry');
      g.overdriveT = 2;
      expect(tap(g, th.x, th.y, 30), id).toBe('fire');
      expect(g.ammo, id).toBe(0);
    }
  });

  it('the plain gun, loaded with nothing, is unchanged: a tap on empty water fires nothing', () => {
    const g = quietGame();
    expect(tap(g, 500, 300, 20)).toBe('empty');
    expect(g.ammo).toBe(g.stats.rack);
  });
});

// ---------------------------------------------------------------------------

describe('what each weapon does with a tap', () => {
  it('EMP Rounds: the burst fries every drone in it (not past it); L2 jams missiles; Ion Storm leaves a cloud', () => {
    const g = quietGame();
    load(g, 'emp', 1);
    const r = AB.emp.radius[0];
    const a = addThreat(g, { x: 700, y: 300, speed: 0 });
    const b = addThreat(g, { x: 700 + r - 20, y: 300, speed: 0 });
    const far = addThreat(g, { x: 700 + r + 60, y: 300, speed: 0 });
    tap(g, 700, 300, 20);
    run(g, 2);
    expect([a.dead, b.dead, far.dead]).toEqual([true, true, false]);

    const g2 = quietGame();
    load(g2, 'emp', 2);
    const m = addThreat(g2, { kind: 'guided', hp: 2, x: 760, y: 300, speed: 0 });
    tap(g2, 700, 300, 20);
    run(g2, 1.2);
    expect(m.jamT).toBeGreaterThan(0);

    const g3 = quietGame();
    load(g3, 'emp', 3);
    tap(g3, 700, 300, 20);
    run(g3, 1.2);
    const cloud = g3.fields.find((f) => f.kind === 'ion')!;
    expect(cloud.hw).toBe(AB.emp.radius[2]);
    const late = addThreat(g3, { x: cloud.x1, y: cloud.y1 });
    run(g3, 0.1);
    expect(late.dead).toBe(true);
  });

  it('Air Strike: a jet flies the tapped row in from the nearer edge, hitting what is under it', () => {
    const g = quietGame();
    load(g, 'airstrike', 1);
    const th = addThreat(g, { kind: 'strafer', hp: 3, x: 1300, y: 250, speed: 0, side: -1 });
    const other = addThreat(g, { x: 1000, y: 250 + AB.airstrike.band[0] - 10, speed: 0 });
    const clear = addThreat(g, { x: 1000, y: 600, speed: 0 });
    expect(tap(g, th.x, th.y, 30)).toBe('fire');
    expect(g.allies[0].dx).toBe(-1);
    run(g, 1.5);
    expect(th.hp).toBe(3 - AB.airstrike.damage[0]);
    expect(other.dead).toBe(true);
    expect(clear.dead).toBe(false);
    // A tap on open water calls one too (a round spent).
    const ammo = g.ammo;
    expect(tap(g, 200, 700, 20)).toBe('fire');
    expect(g.ammo).toBe(ammo - 1);
  });

  it('Carpet Strike: the row burns, and a truck under the jet is destroyed, rounds and all', () => {
    const g = createGame('island', 2);
    g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    const road = g.map.roads.runners[1];
    g.raiderQueue = [{ at: g.waveT, kind: 'runner', path: road, units: [{ kind: 'ballistic', size: 1 }, { kind: 'ballistic', size: 1 }] }];
    run(g, 1.2);
    const truck = g.raiders[0];
    expect(truck.dist).toBeGreaterThan(0);
    load(g, 'airstrike', 3);
    expect(tap(g, truck.x < 800 ? 40 : 1560, truck.y, 20)).toBe('fire');
    expect(g.fields.some((f) => f.kind === 'burn')).toBe(true);
    run(g, 2);
    expect(g.raiders).toHaveLength(0);
    expect(g.origins.truck).toBe(0);
    expect(g.events.some((e) => e.kind === 'bigKill' && e.label === 'TRUCK DESTROYED')).toBe(true);
  });

  it('Railgun: each tap is a beam through everything in line; Mass Driver hits four times as hard', () => {
    const g = quietGame();
    load(g, 'railgun', 1);
    const c = g.map.carrier;
    const near = addThreat(g, { kind: 'guided', hp: 2, x: c.x, y: c.y - 200, speed: 0 });
    const farther = addThreat(g, { kind: 'guided', hp: 2, x: c.x, y: c.y - 400, speed: 0 });
    const aside = addThreat(g, { kind: 'guided', hp: 2, x: c.x + 300, y: c.y - 300, speed: 0 });
    tap(g, c.x, c.y - 300, 20);
    expect([near.hp, farther.hp, aside.hp]).toEqual([2 - AB.railgun.damage[0], 2 - AB.railgun.damage[0], 2]);
    const g2 = quietGame();
    load(g2, 'railgun', 3);
    const heavy = addThreat(g2, { kind: 'heavy', hp: 8, x: c.x, y: c.y - 300, speed: 0 });
    tap(g2, heavy.x, heavy.y, 30);
    tap(g2, heavy.x, heavy.y, 30);
    expect(heavy.dead).toBe(true);
  });

  it('Tesla Arc: a hit arcs to threats nearby; Storm Coil adds a free second shot', () => {
    const g = quietGame();
    load(g, 'tesla', 1);
    const t0 = addThreat(g, { x: 800, y: 300, speed: 0 });
    const t1 = addThreat(g, { x: 880, y: 300, speed: 0, hp: 2 });
    const t2 = addThreat(g, { x: 720, y: 300, speed: 0, hp: 2 });
    tap(g, t0.x, t0.y, 20);
    run(g, 2);
    expect(t0.dead).toBe(true);
    expect([t1.hp, t2.hp]).toEqual([1, 1]);
    const g2 = quietGame();
    load(g2, 'tesla', 3);
    const a = addThreat(g2, { x: 800, y: 300, speed: 0 });
    addThreat(g2, { x: 950, y: 300, speed: 0 });
    const ammo = g2.ammo;
    tap(g2, a.x, a.y, 20);
    expect(g2.interceptors).toHaveLength(2);
    expect(g2.ammo).toBe(ammo - 1);
  });

  it('Decoy Flares: homing missiles near the burst chase the flare; Ghost Fleet pulls in one that comes later', () => {
    const g = quietGame();
    g.ships.push({ id: 77, x: 900, y: 600, hp: 3, slot: 0, channel: 0, mult: 1 });
    load(g, 'decoy', 1);
    const shot = addThreat(g, { kind: 'guided', hp: 2, x: 700, y: 300, target: 77, speed: 0 });
    const near = addThreat(g, { kind: 'guided', hp: 2, x: 700 + AB.decoy.radius[0] - 40, y: 300, target: 77, speed: 150 });
    const far = addThreat(g, { kind: 'guided', hp: 2, x: 700 + AB.decoy.radius[0] + 80, y: 300, target: 77, speed: 150 });
    tap(g, shot.x, shot.y, 20);
    run(g, 1.2);
    expect(near.decoy).toBeDefined();
    expect(far.decoy).toBeUndefined();
    const g2 = quietGame();
    g2.ships.push({ id: 78, x: 900, y: 600, hp: 3, slot: 0, channel: 0, mult: 1 });
    load(g2, 'decoy', 3);
    tap(g2, 700, 300, 20);
    run(g2, 1.2);
    const flare = g2.fields.find((f) => f.kind === 'flare')!;
    expect(flare.life).toBe(AB.decoy.ghostTime);
    const later = addThreat(g2, { kind: 'supersonic', x: flare.x1 + 100, y: flare.y1, target: 78, speed: 0, age: 5 });
    run(g2, 0.1);
    expect(later.decoy).toEqual({ x: flare.x1, y: flare.y1 });
  });

  it('Smoke Shells: the burst leaves a cloud; a missile after a ship in it, or flying through it, loses lock', () => {
    const g = quietGame();
    g.ships.push({ id: 79, x: 700, y: 600, hp: 3, slot: 0, channel: 0, mult: 1 });
    load(g, 'smoke', 1);
    tap(g, 700, 600, 20);
    run(g, 1.2);
    const cloud = g.fields.find((f) => f.kind === 'smoke')!;
    expect(cloud.hw).toBe(AB.smoke.radius[0]);
    expect(cloud.life).toBe(AB.smoke.time[0]);
    const m = addThreat(g, { kind: 'guided', hp: 2, x: 700 - 30, y: 600 - 30, target: 79, speed: 0, heading: 0 });
    run(g, 0.1);
    expect(m.jamT).toBeGreaterThan(0);
  });

  it('Hellfire Salvo: one tap, one round, a burst of rockets at the spot', () => {
    const g = quietGame();
    load(g, 'salvo', 2);
    const ammo = g.ammo;
    expect(tap(g, 600, 300, 20)).toBe('fire');
    expect(g.ammo).toBe(ammo - 1);
    expect(g.interceptors.filter((i) => i.src === 'salvo')).toHaveLength(AB.salvo.rockets[1]);
  });

  it('Sub Hunter: a tap on a sub destroys it (L2: its missiles too); a tap on a threat is a plain shot; Hunter-Killer hunts with every shot', () => {
    const g = quietGame();
    load(g, 'hunter', 2);
    const r = addRaider(g, { x: 700, y: 420 });
    const m = addThreat(g, { kind: 'ballistic', x: 600, y: 300, from: r.id, dur: 9 });
    expect(tap(g, 700, 420, 20)).toBe('fire');
    expect(g.events.some((e) => e.kind === 'bigKill' && e.label === 'SUB DESTROYED')).toBe(true);
    expect(m.dead).toBe(true);
    step(g, DT);
    expect(g.raiders.includes(r)).toBe(false);
    const d = addThreat(g, { x: 300, y: 300 });
    tap(g, d.x, d.y, 20);
    expect(g.interceptors.some((i) => i.target === d.id)).toBe(true);
    const g2 = quietGame();
    load(g2, 'hunter', 3);
    const sub = addRaider(g2, { x: 1300, y: 500 });
    const t = addThreat(g2, { x: 300, y: 300 });
    tap(g2, t.x, t.y, 20);
    expect(sub.state).toBe('reverse');
  });

  it('a shell fired as the clock runs out still bursts as that weapon', () => {
    const g = quietGame();
    load(g, 'emp', 1);
    g.weapon!.t = 0.05;
    const a = addThreat(g, { x: 700, y: 200, speed: 0 });
    const b = addThreat(g, { x: 740, y: 200, speed: 0 });
    tap(g, a.x, a.y, 20);
    run(g, 0.2);
    expect(g.weapon).toBeNull();
    run(g, 2);
    expect(b.dead).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('logs, bots and the curve', () => {
  it('a watched run with weapons replays exactly, armory included', () => {
    const { game, log } = playMimic('strait', 11, { armory: { warhead: 2, reload: 1 } });
    expect(log.game).toBe('v3');
    expect(log.armory).toEqual({ warhead: 2, reload: 1 });
    expect(Object.keys(game.uses).length).toBeGreaterThan(0);
    const again = replay(log);
    expect(again.steps).toBe(game.steps);
    expect(again.score).toBe(game.score);
    expect(again.lost).toBe(game.lost);
    expect(again.uses).toEqual(game.uses);
  });

  it('weapons and the Armory each make a bot stronger than the bare gun', () => {
    const seeds = [21, 22, 23, 24];
    const waves = (o: { abilities: boolean; armory: number }) =>
      seeds.reduce((s, seed) => {
        const r = runBot('gauntlet', seed, { ...SKILLS.average, noAbilities: !o.abilities }, { armory: Object.fromEntries(ARMORY_ORDER.map((id) => [id, o.armory])) });
        return s + (r.won ? 11 : r.wave);
      }, 0);
    const bare = waves({ abilities: false, armory: 0 });
    expect(waves({ abilities: true, armory: 0 })).toBeGreaterThan(bare);
    expect(waves({ abilities: false, armory: ARMORY_MAX })).toBeGreaterThan(bare);
  });

  it('the carrier and hulls are fixed (no Armored Hulls in V3)', () => {
    const g = createGame('strait', 1);
    expect(g.carrierHp).toBe(CARRIER.hp);
    run(g, 10);
    for (const s of g.ships) expect(s.hp).toBeLessThanOrEqual(SHIP.hp);
  });
});

// ---------------------------------------------------------------------------
// V2 rounds 13–14, ported one to one (V3 forked from V2 just before them).

describe('V2 round 13 in V3: a fresh start each wave, strikes, roads, the Island', () => {
  it('a cleared wave clears the field: nothing in flight, no power-up or loaded weapon carries over, the rack is full, weapons are kept', () => {
    const g = createGame('strait', 3);
    g.queue = [];
    g.raiderQueue = [];
    g.pickups.push({ id: 9001, kind: 'ammo', x: 700, y: 500, age: 0 });
    g.interceptors.push({ id: 9002, x: 800, y: 600, target: 1, tx: 800, ty: 200, life: 0, src: 'gun' });
    g.fields.push({ kind: 'smoke', x1: 100, y1: 400, x2: 600, y2: 400, hw: 70, t: 0, life: 10, tick: 0, level: 1 });
    g.overdriveT = 4;
    g.shieldT = 3;
    g.warpT = 2;
    g.levels.emp = 1;
    g.slots = ['emp'];
    g.weapon = { id: 'emp', level: 1, t: 5 };
    g.ammo = 0;
    step(g, DT);
    expect(g.phase).toBe('draft');
    expect(g.pickups).toHaveLength(0);
    expect(g.interceptors).toHaveLength(0);
    expect(g.fields).toHaveLength(0);
    expect([g.overdriveT, g.shieldT, g.warpT, g.steamT]).toEqual([0, 0, 0, 0]);
    expect(g.weapon).toBeNull();
    expect(g.ammo).toBe(g.stats.rack);
    expect(g.levels.emp).toBe(1);
  });

  it('no truck road runs over a base, on any map', () => {
    const segDist = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    };
    for (const map of ['strait', 'gauntlet', 'island', 'harbor', 'archipelago'] as const) {
      const m = createGame(map, 1).map;
      const routes = [...m.roads.runners, ...m.roads.popups.map((p) => [p.from, p.to])];
      for (const path of routes)
        for (const b of m.bases)
          for (let i = 1; i < path.length; i++) expect(segDist(b, path[i - 1], path[i]), `${map} road near base ${b.x},${b.y}`).toBeGreaterThan(36);
    }
  });

  it('the Island has the round 13 easing: its supersonics start on wave 6', () => {
    const kinds = (g: Game) => [...g.queue.map((l) => l.kind), ...g.raiderQueue.flatMap((r) => r.units.map((u) => u.kind))];
    expect(kinds(createGame('island', 4, 5)).includes('supersonic')).toBe(false);
    expect(kinds(createGame('island', 4, 6)).includes('supersonic')).toBe(true);
  });

  it('V3 maps are V2 maps: same geometry and difficulty data', async () => {
    const v2 = await import('../../src/v2/data/maps');
    const v3 = await import('../../src/v3/data/maps');
    expect(JSON.stringify(v3.MAPS)).toBe(JSON.stringify(v2.MAPS));
  });
});

// ---------------------------------------------------------------------------
// Playtest round 1: the words on the cards are the numbers in the game. These
// drifted once already (tuning changed AB, the card text stayed).

describe('card text matches the numbers', () => {
  const L = (id: AbilityId, lv: number) => ABILITIES[id].levels[lv - 1];
  it('every number a weapon card quotes is the one the game uses', () => {
    expect(L('emp', 3)).toContain(`ion cloud for ${AB.emp.ionTime} s`);
    expect(AB.emp.radius[1]).toBeGreaterThan(AB.emp.radius[0]); // "a wider burst"
    expect(AB.airstrike.band[1]).toBeGreaterThan(AB.airstrike.band[0]); // "a wider run"
    expect(AB.airstrike.damage[1]).toBeGreaterThan(AB.airstrike.damage[0]); // "harder hits"
    expect(L('airstrike', 3)).toContain(`burns for ${AB.airstrike.burnTime} s`);
    expect(AB.railgun.damage[1]).toBe(AB.railgun.damage[0] * 2); // "twice the damage"
    expect(AB.railgun.damage[2]).toBe(AB.railgun.damage[0] * 4); // "four times as hard"
    expect(AB.railgun.damage[2] * 2).toBeGreaterThanOrEqual(8); // "two bring down a heavy" (8 HP)
    expect(L('tesla', 1)).toContain(`${AB.tesla.arcs[0]} threats`);
    expect(L('tesla', 2)).toContain(`${AB.tesla.arcs[1]} arcs`);
    expect(AB.tesla.depth[1]).toBe(2); // "every arc arcs again"
    expect(AB.decoy.radius[1]).toBeGreaterThan(AB.decoy.radius[0]); // "a much wider pull"
    expect(L('decoy', 3)).toContain(`${AB.decoy.ghostTime} s`);
    expect(AB.smoke.time[1]).toBeGreaterThan(AB.smoke.time[0]); // "longer smoke"
    expect(AB.smoke.radius[2]).toBeGreaterThan(AB.smoke.radius[1]); // "bigger clouds"
    expect(L('salvo', 1)).toContain(`${AB.salvo.rockets[0]} rockets`);
    expect(L('salvo', 2)).toContain(`${AB.salvo.rockets[1]} rockets`);
    expect(AB.salvo.damage[1]).toBe(AB.salvo.damage[0] * 2); // "twice as hard"
    expect(L('salvo', 3)).toContain(`${AB.salvo.rockets[2]} rockets`);
  });

  it('every Armory blurb quotes its real per-level change', () => {
    const base = gunStats({});
    const pct = (a: number, b: number) => `${Math.round(Math.abs(a / b - 1) * 100)}%`;
    expect(ARMORY.warhead.blurb).toContain(pct(gunStats({ warhead: 1 }).blast, base.blast));
    expect(ARMORY.motor.blurb).toContain(pct(gunStats({ motor: 1 }).interceptorSpeed, base.interceptorSpeed));
    expect(ARMORY.reload.blurb).toContain(pct(gunStats({ reload: 1 }).reload, base.reload));
    expect(gunStats({ fuse: ARMORY_MAX }).hitDamage).toBe(2); // "level 5 hits for 2"
  });
});
