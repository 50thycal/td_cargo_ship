// V3: the main gun is set in the Armory before a run; the in-run draft deals
// abilities you charge and set off. These tests pin both systems down.

import { describe, expect, it } from 'vitest';
import { AB, ABILITIES, ABILITY_MAX, ABILITY_ORDER, MAX_SLOTS, START_CHARGE, abilityName, need, type AbilityId } from '../../src/v3/data/abilities';
import { ARMORY, ARMORY_COSTS, ARMORY_MAX, ARMORY_ORDER, ARMORY_TOTAL, gunStats, nextCost, salvageFor, SALVAGE } from '../../src/v3/data/armory';
import { CARRIER, INTERCEPTOR, PICKUP_KINDS, SHIP } from '../../src/v3/data/config';
import { buyArmory, equipArmory, loadProgress, recordResult, runGun, type Progress } from '../../src/v3/platform/save';
import { runBot, SKILLS } from '../../src/v3/sim/bot';
import { playMimic } from '../../src/v3/sim/mimic';
import { replay } from '../../src/v3/sim/playlog';
import {
  CARRIER_TARGET,
  abilityReady,
  activate,
  chargeShare,
  createGame,
  pickUpgrade,
  step,
  tap,
  type Game,
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

/** Hold an ability at a level, fully charged. */
function hold(g: Game, id: AbilityId, level = 1): void {
  g.levels[id] = level;
  g.charge[id] = need(id, level);
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

describe('the draft deals abilities', () => {
  it('three different abilities after a wave; no V2 cards, no main-gun upgrades', () => {
    const g = createGame('strait', 3);
    for (let i = 0; i < 60 * 300 && g.phase === 'wave'; i++) {
      for (const th of g.threats) th.dead = true;
      step(g, DT);
    }
    expect(g.phase).toBe('draft');
    expect(new Set(g.offer).size).toBe(3);
    for (const id of g.offer) expect(ABILITY_ORDER).toContain(id);
  });

  it('a new ability arrives empty (START_CHARGE); levelling keeps its charge', () => {
    const g = quietGame();
    g.phase = 'draft';
    g.offer = ['emp', 'airstrike', 'railgun'];
    pickUpgrade(g, 'emp');
    expect(g.levels.emp).toBe(1);
    expect(g.charge.emp).toBe(need('emp', 1) * START_CHARGE);
    g.phase = 'draft';
    g.offer = ['emp', 'airstrike', 'railgun'];
    pickUpgrade(g, 'emp');
    expect(g.levels.emp).toBe(2);
    expect(g.charge.emp).toBe(need('emp', 1) * START_CHARGE);
  });

  it('holds three; a fourth needs a swap that gives one up; level 3 is the evolution', () => {
    const g = quietGame();
    g.levels = { emp: 1, airstrike: 1, railgun: 3 };
    g.phase = 'draft';
    g.offer = ['tesla', 'emp', 'decoy'];
    pickUpgrade(g, 'tesla');
    expect(g.levels.tesla).toBeUndefined();
    g.phase = 'draft';
    g.offer = ['tesla', 'emp', 'decoy'];
    pickUpgrade(g, 'tesla', 'airstrike');
    expect(Object.keys(g.levels).sort()).toEqual(['emp', 'railgun', 'tesla']);
    expect(MAX_SLOTS).toBe(3);
    expect(abilityName('railgun', 3)).toBe(ABILITIES.railgun.evolved);
    expect(abilityName('railgun', 2)).toBe(ABILITIES.railgun.name);
  });

  it('button slots are stable: a new ability takes the next slot, a swap takes the replaced one\'s', () => {
    const g = quietGame();
    const take = (id: 'salvo' | 'emp' | 'decoy' | 'airstrike', replace?: 'emp') => {
      g.phase = 'draft';
      g.offer = [id, 'tesla', 'hunter'];
      pickUpgrade(g, id, replace);
    };
    take('salvo');
    take('emp');
    take('decoy');
    // EMP is first in the roster, but Salvo was taken first and keeps slot 1.
    expect(g.slots).toEqual(['salvo', 'emp', 'decoy']);
    take('airstrike', 'emp');
    expect(g.slots).toEqual(['salvo', 'airstrike', 'decoy']);
  });

  it('every ability has three levels, an evolved name, and nothing charges from shots or reloads', () => {
    for (const id of ABILITY_ORDER) {
      const a = ABILITIES[id];
      expect(a.levels).toHaveLength(ABILITY_MAX);
      expect(a.need).toHaveLength(ABILITY_MAX);
      expect(a.levels[2]).toMatch(/^EVOLVES/);
      expect(a.evolved).not.toBe(a.name);
      expect(a.need[2]).toBeLessThanOrEqual(a.need[0]);
    }
    // The design rule: every knob is used at least once.
    expect(new Set(ABILITY_ORDER.map((id) => ABILITIES[id].charge)).size).toBe(8);
    expect(new Set(ABILITY_ORDER.map((id) => ABILITIES[id].activation)).size).toBe(5);
  });

  it('EMP and Strike are no longer pickups', () => {
    expect(PICKUP_KINDS).not.toContain('emp');
    expect(PICKUP_KINDS).not.toContain('strike');
  });
});

// ---------------------------------------------------------------------------

describe('charging', () => {
  it('time: Air Strike fills over its seconds, and stops at full', () => {
    const g = quietGame();
    g.levels.airstrike = 1;
    g.charge.airstrike = 0;
    run(g, need('airstrike', 1) / 2);
    expect(chargeShare(g, 'airstrike')).toBeCloseTo(0.5, 1);
    run(g, need('airstrike', 1));
    expect(chargeShare(g, 'airstrike')).toBe(1);
    expect(abilityReady(g, 'airstrike')).toBe(true);
    expect(g.events.some((e) => e.kind === 'abilityReady' && e.id === 'airstrike')).toBe(true);
  });

  it('drone kills charge EMP Pulse; main-gun hits charge the Railgun', () => {
    const g = quietGame();
    g.levels = { emp: 1, railgun: 1 };
    g.charge = { emp: 0, railgun: 0 };
    const d = addThreat(g, { kind: 'drone', x: 800, y: 300, speed: 0 });
    expect(tap(g, d.x, d.y, 20)).toBe('fire');
    run(g, 2);
    expect(d.dead).toBe(true);
    expect(g.charge.emp).toBe(1);
    expect(g.charge.railgun).toBe(1);
  });

  it('a streak: hits build Tesla Arc, a tap on empty water starts it over', () => {
    const g = quietGame();
    g.levels.tesla = 1;
    g.charge.tesla = 0;
    for (let k = 0; k < 3; k++) {
      const d = addThreat(g, { x: 700 + k * 40, y: 300, speed: 0 });
      tap(g, d.x, d.y, 10);
      run(g, 1.5);
    }
    expect(g.charge.tesla).toBe(3);
    expect(tap(g, 100, 500, 10)).toBe('empty');
    expect(g.charge.tesla).toBe(0);
  });

  it('enemy missile launches charge Decoy Barrage; hits on the convoy charge Smoke Wall', () => {
    // Wave 1 is drones only; wave 4 brings ballistics and guided missiles.
    const g = createGame('strait', 5, 4);
    g.levels = { decoy: 1, smoke: 1 };
    g.charge = { decoy: 0, smoke: 0 };
    for (let i = 0; i < 60 * 200 && g.phase === 'wave'; i++) step(g, DT);
    expect(g.charge.decoy).toBe(need('decoy', 1));
    expect(g.charge.smoke).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------

describe('setting abilities off', () => {
  it('not ready means nothing happens and nothing is spent', () => {
    const g = quietGame();
    g.levels.emp = 1;
    g.charge.emp = 1;
    expect(activate(g, 'emp')).toBe(false);
    expect(g.charge.emp).toBe(1);
    expect(activate(g, 'tesla')).toBe(false);
  });

  it('EMP Pulse: L1 the 8 nearest drones; L2 every drone and missiles jammed; L3 a storm', () => {
    const g = quietGame();
    const drones = Array.from({ length: 12 }, (_, k) => addThreat(g, { x: 200 + k * 90, y: 300 }));
    hold(g, 'emp', 1);
    expect(activate(g, 'emp')).toBe(true);
    expect(drones.filter((d) => d.dead)).toHaveLength(AB.emp.l1Count);
    expect(g.charge.emp).toBe(0);

    const g2 = quietGame();
    const ds = Array.from({ length: 12 }, (_, k) => addThreat(g2, { x: 200 + k * 90, y: 300 }));
    const gm = addThreat(g2, { kind: 'guided', hp: 2, speed: 150 });
    hold(g2, 'emp', 2);
    activate(g2, 'emp');
    expect(ds.every((d) => d.dead)).toBe(true);
    expect(gm.jamT).toBeGreaterThan(0);

    const g3 = quietGame();
    hold(g3, 'emp', 3);
    activate(g3, 'emp');
    expect(g3.ionT).toBe(AB.emp.stormTime);
    const late = addThreat(g3, { x: 600, y: 200 });
    step(g3, DT);
    expect(late.dead).toBe(true);
  });

  it('Air Strike flies the swiped line and hits what is under it; too short a swipe does nothing', () => {
    const g = quietGame();
    hold(g, 'airstrike', 1);
    expect(activate(g, 'airstrike', { x: 400, y: 300, x2: 420, y2: 300 })).toBe(false);
    const on = addThreat(g, { kind: 'guided', hp: 2, x: 900, y: 310, speed: 0 });
    const off = addThreat(g, { kind: 'guided', hp: 2, x: 900, y: 600, speed: 0 });
    expect(activate(g, 'airstrike', { x: 100, y: 300, x2: 1500, y2: 300 })).toBe(true);
    expect(g.allies).toHaveLength(1);
    run(g, 3);
    expect(on.dead).toBe(true);
    expect(off.dead).toBe(false);
  });

  it('Carpet Strike (evolved): three jets, a burning line, launchers under it knocked out', () => {
    const g = quietGame();
    hold(g, 'airstrike', 3);
    const r = addRaider(g, { x: 800, y: 420 });
    activate(g, 'airstrike', { x: 100, y: 420, x2: 1500, y2: 420 });
    expect(g.allies).toHaveLength(3);
    expect(g.fields.some((f) => f.kind === 'burn')).toBe(true);
    run(g, 2);
    expect(r.rounds).toHaveLength(0);
  });

  it('Railgun takes over the gun: taps fire piercing beams with no ammo, then it hands back', () => {
    const g = quietGame();
    hold(g, 'railgun', 1);
    const near = addThreat(g, { kind: 'heavy', hp: 8, x: 800, y: 300, speed: 0 });
    const far = addThreat(g, { kind: 'drone', hp: 1, x: 800, y: 200, speed: 0 });
    g.ammo = 0;
    expect(activate(g, 'railgun')).toBe(true);
    expect(tap(g, 800, 250, 10)).toBe('fire');
    expect(far.dead).toBe(true);
    expect(near.hp).toBe(8 - AB.railgun.damage[0]);
    expect(g.ammo).toBe(0);
    tap(g, 800, 250, 10);
    expect(g.gunMode).toBeNull();
    // Mass Driver one-shots a heavy.
    const g2 = quietGame();
    hold(g2, 'railgun', 3);
    const h = addThreat(g2, { kind: 'heavy', hp: 8, x: 800, y: 300, speed: 0 });
    activate(g2, 'railgun');
    tap(g2, 800, 300, 10);
    expect(h.dead).toBe(true);
  });

  it('only one takeover at a time', () => {
    const g = quietGame();
    hold(g, 'railgun', 1);
    hold(g, 'tesla', 1);
    activate(g, 'railgun');
    expect(abilityReady(g, 'tesla')).toBe(false);
    expect(activate(g, 'tesla')).toBe(false);
  });

  it('Tesla Arc: while it has the gun, a hit arcs to threats nearby', () => {
    const g = quietGame();
    hold(g, 'tesla', 1);
    activate(g, 'tesla');
    const hit = addThreat(g, { x: 800, y: 300, speed: 0 });
    const n1 = addThreat(g, { x: 860, y: 300, speed: 0 });
    const n2 = addThreat(g, { x: 800, y: 380, speed: 0 });
    const far = addThreat(g, { x: 1200, y: 300, speed: 0 });
    tap(g, hit.x, hit.y, 10);
    run(g, 1.5);
    expect([hit, n1, n2].every((t) => t.dead)).toBe(true);
    expect(far.dead).toBe(false);
  });

  it('Decoy Barrage: guided missiles chase decoys; level 2 fools supersonics; Ghost Fleet pulls in new launches', () => {
    const g = quietGame();
    hold(g, 'decoy', 1);
    const gm = addThreat(g, { kind: 'guided', hp: 2, speed: 150 });
    const ss = addThreat(g, { kind: 'supersonic', hp: 1, speed: 430, age: 5 });
    activate(g, 'decoy');
    expect(gm.decoy).toBeDefined();
    expect(ss.decoy).toBeUndefined();
    const g2 = quietGame();
    hold(g2, 'decoy', 2);
    const ss2 = addThreat(g2, { kind: 'supersonic', hp: 1, speed: 430, age: 5 });
    activate(g2, 'decoy');
    expect(ss2.decoy).toBeDefined();
    const g3 = quietGame();
    run(g3, 30);
    hold(g3, 'decoy', 3);
    activate(g3, 'decoy');
    expect(g3.ghostT).toBe(AB.decoy.ghostTime);
    g3.queue = [{ at: g3.waveT + 0.01, kind: 'guided', base: 0 }, { at: 1e9, kind: 'drone', base: 0 }];
    run(g3, 0.1);
    expect(g3.threats.find((t) => t.kind === 'guided')?.decoy).toBeDefined();
  });

  it('Smoke Wall: missiles lose a ship in the smoke; Fog Bank makes ballistics landing in it miss', () => {
    const g = quietGame();
    run(g, 20);
    const ship = g.ships.find((s) => s.x > 300)!;
    hold(g, 'smoke', 3);
    expect(activate(g, 'smoke', { x: ship.x - 100, y: ship.y, x2: ship.x + 300, y2: ship.y })).toBe(true);
    const hp = ship.hp;
    addThreat(g, { kind: 'ballistic', hp: 1, speed: 380, x: ship.x, y: ship.y - 100, ix: ship.x, iy: ship.y, sx: ship.x, sy: 100, dur: 0.05, age: 0.049, target: ship.id });
    step(g, DT);
    expect(ship.hp).toBe(hp);
  });

  it('Hellfire Salvo: rockets saturate the spot; holding longer at level 2 fires more', () => {
    const g = quietGame();
    hold(g, 'salvo', 1);
    activate(g, 'salvo', { x: 800, y: 300 });
    expect(g.interceptors.filter((i) => i.src === 'salvo')).toHaveLength(AB.salvo.rockets[0]);
    const quick = quietGame();
    hold(quick, 'salvo', 2);
    activate(quick, 'salvo', { x: 800, y: 300, power: 0 });
    const full = quietGame();
    hold(full, 'salvo', 2);
    activate(full, 'salvo', { x: 800, y: 300, power: 1 });
    expect(quick.interceptors).toHaveLength(AB.salvo.minRockets);
    expect(full.interceptors).toHaveLength(AB.salvo.rockets[1]);
    const swarm = Array.from({ length: 6 }, (_, k) => addThreat(full, { x: 760 + k * 15, y: 300, speed: 0 }));
    run(full, 3);
    expect(swarm.every((t) => t.dead)).toBe(true);
  });

  it('Sub Hunter: needs a launcher by the tap; L2 downs its missiles too; Hunter-Killer gets them all', () => {
    const g = quietGame();
    hold(g, 'hunter', 2);
    const r = addRaider(g, { x: 700, y: 420 });
    const m = addThreat(g, { kind: 'ballistic', from: r.id, speed: 0, dur: 99 });
    expect(activate(g, 'hunter', { x: 200, y: 200 })).toBe(false);
    expect(activate(g, 'hunter', { x: 720, y: 430 })).toBe(true);
    expect(r.rounds).toHaveLength(0);
    expect(m.dead).toBe(true);
    const g2 = quietGame();
    hold(g2, 'hunter', 3);
    const rs = [addRaider(g2, { x: 300 }), addRaider(g2, { x: 1200 })];
    expect(activate(g2, 'hunter')).toBe(true);
    expect(rs.every((x) => x.rounds.length === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('logs, bots and the curve', () => {
  it('a watched run with abilities replays exactly, armory included', () => {
    const { game, log } = playMimic('strait', 11, { armory: { warhead: 2, reload: 1 } });
    expect(log.game).toBe('v3');
    expect(log.armory).toEqual({ warhead: 2, reload: 1 });
    expect(log.commands.some((c) => c[1] === 'a')).toBe(true);
    const again = replay(log);
    expect(again.steps).toBe(game.steps);
    expect(again.score).toBe(game.score);
    expect(again.lost).toBe(game.lost);
    expect(again.uses).toEqual(game.uses);
  });

  it('abilities and the Armory each make a bot stronger than the bare gun', () => {
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
  it('a cleared wave clears the field: nothing in flight, no power-up or running ability carries over, the rack is full, charge is kept', () => {
    const g = createGame('strait', 3);
    g.queue = [];
    g.raiderQueue = [];
    g.pickups.push({ id: 9001, kind: 'ammo', x: 700, y: 500, age: 0 });
    g.interceptors.push({ id: 9002, x: 800, y: 600, target: 1, tx: 800, ty: 200, life: 0, src: 'gun' });
    g.fields.push({ kind: 'smoke', x1: 100, y1: 400, x2: 600, y2: 400, hw: 70, t: 0, life: 10, tick: 0, level: 1 });
    g.overdriveT = 4;
    g.shieldT = 3;
    g.warpT = 2;
    g.gunMode = { id: 'tesla', level: 1, shots: 0, t: 5 };
    g.ionT = 3;
    g.ghostT = 3;
    g.levels.emp = 1;
    g.charge.emp = 5;
    g.ammo = 0;
    step(g, DT);
    expect(g.phase).toBe('draft');
    expect(g.pickups).toHaveLength(0);
    expect(g.interceptors).toHaveLength(0);
    expect(g.fields).toHaveLength(0);
    expect([g.overdriveT, g.shieldT, g.warpT, g.steamT, g.ionT, g.ghostT]).toEqual([0, 0, 0, 0, 0, 0]);
    expect(g.gunMode).toBeNull();
    expect(g.ammo).toBe(g.stats.rack);
    expect(g.charge.emp).toBe(5);
  });

  it('Carpet Strike jets blow up a truck on the road: gone, rounds and all, with a punch', () => {
    const g = createGame('island', 2);
    g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    const road = g.map.roads.runners[1];
    g.raiderQueue = [{ at: g.waveT, kind: 'runner', path: road, units: [{ kind: 'ballistic', size: 1 }, { kind: 'ballistic', size: 1 }] }];
    run(g, 1.2);
    const truck = g.raiders[0];
    expect(truck.dist).toBeGreaterThan(0);
    expect(g.origins.truck).toBe(0);
    hold(g, 'airstrike', 3);
    expect(activate(g, 'airstrike', { x: 40, y: truck.y, x2: 1560, y2: truck.y })).toBe(true);
    run(g, 3);
    expect(g.raiders).toHaveLength(0);
    expect(g.origins.truck).toBeLessThan(2);
    run(g, 6);
    expect(g.origins.truck).toBeLessThan(2);
    expect(g.events.some((e) => e.kind === 'bigKill' && e.label === 'TRUCK DESTROYED')).toBe(true);
  });

  it('Sub Hunter destroys the sub outright, with the same punch', () => {
    const g = quietGame();
    hold(g, 'hunter', 1);
    const r = addRaider(g, { x: 700, y: 420 });
    expect(activate(g, 'hunter', { x: 700, y: 420 })).toBe(true);
    expect(g.events.some((e) => e.kind === 'bigKill' && e.label === 'SUB DESTROYED')).toBe(true);
    step(g, DT);
    expect(g.raiders.includes(r)).toBe(false);
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
  it('every number an ability card quotes is the one the game uses', () => {
    expect(L('emp', 1)).toContain(`${AB.emp.l1Count} drones`);
    expect(L('emp', 3)).toContain(`${AB.emp.stormTime} s storm`);
    expect(AB.airstrike.jets).toEqual([1, 2, 3]);
    expect(L('airstrike', 1)).toMatch(/^A jet/);
    expect(L('airstrike', 2)).toMatch(/^Two jets/);
    expect(L('airstrike', 3)).toMatch(/three jets/);
    expect(L('railgun', 1)).toContain(`next ${AB.railgun.shots[0]} taps`);
    expect(L('railgun', 2)).toContain(`${AB.railgun.shots[1]} beams`);
    expect(AB.railgun.damage[1]).toBe(AB.railgun.damage[0] * 2); // "twice the damage"
    expect(L('railgun', 3)).toContain(`${AB.railgun.shots[2]} wide slugs`);
    expect(AB.railgun.damage[2]).toBeGreaterThanOrEqual(8); // "one-shot heavy missiles" (8 HP)
    expect(L('tesla', 1)).toContain(`${AB.tesla.time[0]} s`);
    expect(L('tesla', 1)).toContain(`${AB.tesla.arcs[0]} threats`);
    expect(L('tesla', 2)).toContain(`${AB.tesla.time[1]} s, ${AB.tesla.arcs[1]} arcs`);
    expect(L('tesla', 3)).toContain(`${AB.tesla.time[2]} s`);
    expect(L('decoy', 3)).toContain(`${AB.decoy.ghostTime} s`);
    expect(L('smoke', 1)).toContain(`(${AB.smoke.time[0]} s)`);
    expect(L('smoke', 2)).toContain(`${AB.smoke.time[1]} s`);
    expect(L('salvo', 1)).toContain(`${AB.salvo.rockets[0]} rockets`);
    expect(L('salvo', 2)).toContain(`up to ${AB.salvo.rockets[1]} rockets`);
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
