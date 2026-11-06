// The weapons plan, phase 3 (docs/design/v3-weapons-plan.md): the boosts.
// A boost drops like a weapon, but picking it up never replaces the loaded
// weapon: it changes how everything you fire works while it lasts. Each test
// is a real game with threats placed by hand, played through the calls the
// UI makes (tap, press / release).

import { describe, expect, it } from 'vitest';
import { AB, ABILITY_ORDER, WEAPON, type AbilityId } from '../../src/v3/data/abilities';
import { PICKUPS } from '../../src/v3/data/config';
import { ROSTER, isBoost } from '../../src/v3/data/roster';
import { Recorder, replay } from '../../src/v3/sim/playlog';
import {
  CARRIER_TARGET,
  applyFreePlay,
  createGame,
  damageCarrier,
  press,
  release,
  shipSpeed,
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

/** Pick a weapon or boost up the way a player does: tap its pickup. */
function pickUp(g: Game, id: AbilityId, level = 1): void {
  g.levels[id] = level;
  if (!g.slots.includes(id)) g.slots.push(id);
  g.pickups.push({ id: g.nextId++, kind: 'weapon', weapon: id, x: 300, y: 600, age: 0 });
  expect(tap(g, 300, 600, 30)).toBe('pickup');
}

/** Tap a threat and let the shot land. */
function shoot(g: Game, th: Threat, wait = 1.2): void {
  tap(g, th.x, th.y, 30);
  run(g, wait);
}

const BOOSTS = ABILITY_ORDER.filter(isBoost);

describe('the boost rules', () => {
  it('eleven boosts, all prototypes for now', () => {
    expect(BOOSTS).toHaveLength(11);
    for (const id of BOOSTS) expect(ROSTER[id].status, id).toBe('prototype');
  });

  it('a boost never replaces the loaded weapon; a second boost replaces the first', () => {
    const g = quietGame();
    load(g, 'railgun');
    pickUp(g, 'overdrive');
    expect(g.weapon?.id).toBe('railgun');
    expect(g.boost?.id).toBe('overdrive');
    pickUp(g, 'timeWarp');
    expect(g.weapon?.id).toBe('railgun');
    expect(g.boost?.id).toBe('timeWarp');
  });

  it('it lasts the weapon time, and a cleared wave takes it with it', () => {
    const g = quietGame();
    pickUp(g, 'shield');
    run(g, WEAPON.time - 0.5);
    expect(g.boost?.id).toBe('shield');
    run(g, 1);
    expect(g.boost).toBeNull();
    pickUp(g, 'fireAtWill');
    g.queue = [];
    run(g, 0.2);
    expect(g.phase).toBe('draft');
    expect(g.boost).toBeNull();
    expect(g.stats.rack).toBe(g.baseStats.rack);
  });

  it('Free Play plays the plan’s drops: the four power-ups that became boosts never drop; the campaign keeps them', () => {
    const count = (free: boolean) => {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 6; seed++) {
        const g = createGame('strait', seed, 4);
        if (free) applyFreePlay(g, { weapons: [{ id: 'flak', level: 1 }], frequentDrops: false });
        for (let i = 0; i < 60 * 90 && g.phase === 'wave'; i++) {
          for (const th of g.threats) if (!th.dead && th.y > 50 && g.steps % 20 === 0) tap(g, th.x, th.y, 20);
          for (const p of g.pickups) seen.add(p.kind);
          step(g, DT);
        }
      }
      return seen;
    };
    const free = count(true);
    for (const k of ['overdrive', 'timewarp', 'shield', 'steam']) expect(free.has(k), k).toBe(false);
    expect(free.has('ammo')).toBe(true);
    const campaign = count(false);
    expect(['overdrive', 'timewarp', 'shield', 'steam'].some((k) => campaign.has(k))).toBe(true);
  });
});

describe('Fire at Will', () => {
  it('a bigger rack and full-auto hold while it lasts, back to normal after', () => {
    const g = quietGame();
    const rack = g.stats.rack;
    pickUp(g, 'fireAtWill', 1);
    expect(g.stats.rack).toBe(rack + AB.fireAtWill.rack[0]);
    expect(g.ammo).toBe(rack + AB.fireAtWill.rack[0]);
    expect(g.stats.holdRepeat).toBe(AB.fireAtWill.repeat[0]);
    pickUp(g, 'fireAtWill', 2);
    expect(g.stats.reload).toBeCloseTo(g.baseStats.reload / 2);
    run(g, WEAPON.time + 0.1);
    expect(g.stats).toBe(g.baseStats);
    expect(g.ammo).toBeLessThanOrEqual(rack);
  });

  it('Lead Rain: every 4th shot bursts into flak', () => {
    const g = quietGame();
    pickUp(g, 'fireAtWill', 3);
    const flak = () => g.fields.filter((f) => f.kind === 'flak').length;
    for (let k = 0; k < 3; k++) shoot(g, addThreat(g, { x: 500 + k * 150, y: 300 }));
    expect(flak()).toBe(0);
    shoot(g, addThreat(g, { x: 1100, y: 300 }), 1.3);
    expect(flak()).toBe(1);
  });
});

describe('Supply Run', () => {
  it('drops fly to the carrier and load themselves; a boost pickup waits for a tap', () => {
    const g = quietGame();
    g.levels.railgun = 1;
    g.slots.push('railgun');
    pickUp(g, 'supplyRun');
    g.ammo = 1;
    g.pickups.push({ id: g.nextId++, kind: 'ammo', x: 300, y: 200, age: 0 });
    g.pickups.push({ id: g.nextId++, kind: 'weapon', weapon: 'railgun', x: 1300, y: 200, age: 0 });
    g.levels.focus = 1;
    g.pickups.push({ id: g.nextId++, kind: 'weapon', weapon: 'focus', x: 1300, y: 500, age: 0 });
    run(g, 2.5);
    expect(g.ammo).toBe(g.stats.rack);
    expect(g.weapon?.id).toBe('railgun');
    expect(g.boost?.id).toBe('supplyRun');
    expect(g.pickups.some((p) => p.weapon === 'focus')).toBe(true);
  });

  it('kills drop twice as much (three times at level 2)', () => {
    const drops = (level: number) => {
      let n = 0;
      for (let seed = 1; seed <= 4; seed++) {
        const g = quietGame(seed);
        if (level) pickUp(g, 'supplyRun', level);
        for (let k = 0; k < 120; k++) {
          const th = addThreat(g, { x: 200 + (k % 12) * 100, y: 300 });
          shoot(g, th, 0.05);
          if (g.boost) g.boost.t = 99;
          n += g.pickups.filter((p) => p.kind !== 'weapon').length;
          g.pickups = [];
        }
      }
      return n;
    };
    const none = drops(0);
    expect(drops(1)).toBeGreaterThan(none * 1.5);
    expect(drops(2)).toBeGreaterThan(none * 2.3);
  });

  it('Airdrop: a crate with one of your weapons every 6 s', () => {
    const g = quietGame();
    g.levels.flak = 1;
    g.slots.push('flak');
    pickUp(g, 'supplyRun', 3);
    run(g, AB.supplyRun.crate + 0.05);
    const crates = g.pickups.filter((p) => p.crate);
    expect(crates.length + (g.weapon?.id === 'flak' ? 1 : 0)).toBeGreaterThanOrEqual(1);
  });
});

describe('Overclock', () => {
  it('the loaded weapon plays a level higher with its clock stopped; it comes back after', () => {
    const g = quietGame();
    load(g, 'flak', 1);
    pickUp(g, 'overclock', 1);
    expect(g.weapon!.level).toBe(2);
    const t = g.weapon!.t;
    run(g, 3);
    expect(g.weapon!.t).toBe(t);
    run(g, WEAPON.time);
    expect(g.weapon!.level).toBe(1);
    expect(g.weapon!.t).toBeLessThan(t);
  });

  it('nothing loaded: it waits for the next weapon (level 1: only that one; level 2: every one)', () => {
    const g = quietGame();
    pickUp(g, 'overclock', 1);
    pickUp(g, 'flak', 1);
    expect(g.weapon!.level).toBe(2);
    pickUp(g, 'railgun', 1);
    expect(g.weapon!.level).toBe(1);
    pickUp(g, 'overclock', 2);
    expect(g.weapon!.level).toBe(2);
    pickUp(g, 'scatter', 1);
    expect(g.weapon!.level).toBe(2);
  });

  it('Overload: straight to MAX; a weapon already at MAX drops more often instead', () => {
    const g = quietGame();
    load(g, 'railgun', 1);
    pickUp(g, 'overclock', 3);
    expect(g.weapon!.level).toBe(3);
    const h = quietGame();
    load(h, 'flak', 3);
    h.slots.push('railgun');
    h.levels.railgun = 1;
    pickUp(h, 'overclock', 1);
    expect(h.boost!.drops).toBe('flak');
    expect(h.weapon!.level).toBe(3);
  });
});

describe('Dual Wield', () => {
  it('the next weapon joins the loaded one, and a tap fires both for one round', () => {
    const g = quietGame();
    load(g, 'railgun', 1);
    pickUp(g, 'dualWield', 1);
    pickUp(g, 'scatter', 1);
    expect(g.weapon?.id).toBe('railgun');
    expect(g.weapon2?.id).toBe('scatter');
    const ammo = g.ammo;
    addThreat(g, { x: 800, y: 300, hp: 5 });
    tap(g, 800, 300, 30);
    expect(g.ammo).toBe(ammo - 1);
    expect(g.fx.some((f) => f.kind === 'beam')).toBe(true);
    expect(g.fx.some((f) => f.kind === 'frag')).toBe(true);
  });

  it('a passive joins too, and both passives run (two of them)', () => {
    const g = quietGame();
    load(g, 'droneScreen', 1);
    g.passiveT = 0.1;
    pickUp(g, 'dualWield', 1);
    pickUp(g, 'gunships', 1);
    run(g, 0.5);
    expect(g.helis.length).toBe(2);
    expect(g.wings.length).toBeGreaterThan(0);
  });

  it('level 2: both clocks at half speed; MAX: weapons drop twice as often', () => {
    const g = quietGame();
    load(g, 'railgun', 1);
    pickUp(g, 'dualWield', 2);
    const t = g.weapon!.t;
    run(g, 2);
    expect(t - g.weapon!.t).toBeCloseTo(1, 1);
    const pity = (level: number) => {
      const h = quietGame(5);
      h.levels.flak = 1;
      h.slots.push('flak');
      pickUp(h, 'dualWield', level);
      h.weaponDropT = h.stats.dropPity * 0.6;
      // Kill after kill until something drops (a power-up roll comes first).
      for (let k = 0; k < 6 && !h.pickups.some((p) => p.kind === 'weapon'); k++) {
        h.weaponDropT = h.stats.dropPity * 0.6;
        shoot(h, addThreat(h, { x: 800, y: 300 }), 1.2);
        h.pickups = h.pickups.filter((p) => p.kind === 'weapon');
      }
      return h.pickups.some((p) => p.kind === 'weapon');
    };
    expect(pity(1)).toBe(false);
    expect(pity(3)).toBe(true);
  });

  it('without Dual Wield, a pickup takes the whole gun', () => {
    const g = quietGame();
    load(g, 'railgun', 1);
    g.weapon2 = { id: 'scatter', level: 1, t: 5 };
    pickUp(g, 'flak', 1);
    expect(g.weapon?.id).toBe('flak');
    expect(g.weapon2).toBeNull();
  });
});

describe('Hot Streak', () => {
  it('hits in a row double the damage at 5 and triple it at 10; a tap on nothing resets', () => {
    const g = quietGame();
    pickUp(g, 'hotStreak', 1);
    for (let k = 0; k < 5; k++) shoot(g, addThreat(g, { x: 400 + k * 160, y: 300 }));
    expect(g.streak).toBe(5);
    const tough = addThreat(g, { x: 800, y: 250, hp: 6 });
    shoot(g, tough);
    expect(tough.hp).toBe(4);
    tap(g, 200, 200, 10);
    expect(g.streak).toBe(0);
  });

  it('level 2: double at 4, triple at 8', () => {
    const g = quietGame();
    pickUp(g, 'hotStreak', 2);
    for (let k = 0; k < 8; k++) shoot(g, addThreat(g, { x: 300 + k * 130, y: 300 }));
    const tough = addThreat(g, { x: 800, y: 250, hp: 6 });
    shoot(g, tough);
    expect(tough.hp).toBe(3);
  });

  it('On Fire: at 10 a shot pierces to the next threat, and a miss no longer resets', () => {
    const g = quietGame();
    pickUp(g, 'hotStreak', 3);
    for (let k = 0; k < 10; k++) shoot(g, addThreat(g, { x: 300 + k * 110, y: 300 }));
    expect(g.streak).toBe(10);
    tap(g, 200, 200, 10);
    expect(g.streak).toBe(10);
    const a = addThreat(g, { x: 800, y: 250, hp: 9 });
    const b = addThreat(g, { x: 860, y: 250, hp: 9 });
    shoot(g, a);
    expect(b.hp).toBeLessThan(9);
  });
});

describe('Wild Card', () => {
  it('nothing loaded: each tap is a random weapon’s shot, at the boost’s level', () => {
    const g = quietGame();
    pickUp(g, 'wildCard', 3);
    const rolls = new Set<string>();
    for (let k = 0; k < 12; k++) {
      addThreat(g, { x: 800, y: 300, hp: 99 });
      tap(g, 800, 300, 30);
      for (const c of g.cues) if (c.id === 'wild.roll') rolls.add(String(k));
      g.cues.length = 0;
      g.ammo = g.stats.rack;
      run(g, 0.3);
    }
    expect(rolls.size).toBe(12);
    // Something other than plain shots happened: fields, beams, jets, blades…
    expect(g.fx.length + g.fields.length + g.blades.length + g.allies.length).toBeGreaterThan(0);
  });

  it('a loaded weapon fires as usual (Wild Card waits for it to run out)', () => {
    const g = quietGame();
    pickUp(g, 'wildCard', 1);
    load(g, 'railgun', 1);
    addThreat(g, { x: 800, y: 300, hp: 9 });
    tap(g, 800, 300, 30);
    expect(g.cues.some((c) => c.id === 'wild.roll')).toBe(false);
    expect(g.cues.some((c) => c.id === 'rail.beam')).toBe(true);
  });
});

describe('Focus', () => {
  it('time slows only while a finger is down, spending the bank in real time', () => {
    const g = quietGame();
    pickUp(g, 'focus', 1);
    let t = g.t;
    run(g, 1);
    expect(g.t - t).toBeCloseTo(1, 2);
    press(g, 800, 300, 30);
    t = g.t;
    run(g, 2);
    expect(g.t - t).toBeCloseTo(1, 2);
    expect(g.boost!.bank).toBeCloseTo(AB.focus.bank[0] - 2, 1);
    release(g, 800, 300, 30);
    t = g.t;
    run(g, 1);
    expect(g.t - t).toBeCloseTo(1, 2);
  });

  it('the bank runs out: time goes back to normal with the finger still down', () => {
    const g = quietGame();
    pickUp(g, 'focus', 2);
    press(g, 800, 300, 30);
    run(g, AB.focus.bank[1] + 0.5);
    const t = g.t;
    run(g, 1);
    expect(g.t - t).toBeCloseTo(1, 2);
  });

  it('Deadeye: shots fired in slow motion hit for double', () => {
    const g = quietGame();
    pickUp(g, 'focus', 3);
    press(g, 100, 100, 5);
    const th = addThreat(g, { x: 800, y: 300, hp: 5 });
    tap(g, 800, 300, 30);
    run(g, 3);
    expect(th.hp).toBe(3);
  });

  it('a Focus run replays exactly from the play log', () => {
    const g = createGame('strait', 4, 3);
    const setup = { weapons: [{ id: 'focus' as AbilityId, level: 2 }, { id: 'flak' as AbilityId, level: 1 }], frequentDrops: true };
    applyFreePlay(g, setup);
    const rec = new Recorder(g, { build: 'test', startedAt: '2026-11-06T00:00:00Z', firstWave: 3, freePlay: setup } as never);
    let presses = 0;
    for (let i = 0; i < 60 * 60 && g.phase === 'wave'; i++) {
      if (i % 30 === 0 && g.pickups.length) rec.tap(g.pickups[0].x, g.pickups[0].y, 30);
      const th = g.threats.find((t) => !t.dead && t.y > 100 && t.y < 800);
      if (i % 120 === 0 && g.boost?.id === 'focus') {
        rec.press(800, 400, 30);
        presses++;
      }
      if (i % 120 === 60 && g.finger) rec.release(800, 400, 30);
      if (i % 20 === 0 && th) rec.tap(th.x, th.y, 30);
      step(g, DT);
    }
    expect(presses).toBeGreaterThan(2);
    const r = replay(rec.snapshot());
    expect(r.steps).toBe(g.steps);
    expect(r.score).toBe(g.score);
    expect(r.kills).toEqual(g.kills);
  });
});

describe('Overdrive (was a power-up)', () => {
  it('rounds cost nothing; level 2 hands the rack back full', () => {
    const g = quietGame();
    pickUp(g, 'overdrive', 1);
    g.ammo = 2;
    for (let k = 0; k < 5; k++) shoot(g, addThreat(g, { x: 300 + k * 200, y: 300 }), 0.1);
    expect(g.ammo).toBeGreaterThanOrEqual(2);
    const h = quietGame();
    pickUp(h, 'overdrive', 2);
    h.ammo = 0;
    run(h, WEAPON.time + 0.1);
    expect(h.ammo).toBe(h.stats.rack);
  });

  it('Hyper Overdrive: every shot fires twice', () => {
    const g = quietGame();
    pickUp(g, 'overdrive', 3);
    addThreat(g, { x: 700, y: 300, hp: 3 });
    addThreat(g, { x: 800, y: 300, hp: 3 });
    tap(g, 700, 300, 30);
    expect(g.interceptors).toHaveLength(2);
  });
});

describe('Time Warp (was a power-up)', () => {
  const moved = (level: number, seconds: number, after = 0) => {
    const g = quietGame();
    if (level) pickUp(g, 'timeWarp', level);
    run(g, after);
    const th = addThreat(g, { x: 800, y: 100, speed: 60, target: CARRIER_TARGET });
    run(g, seconds);
    return th.y - 100;
  };
  it('threats crawl: 40%, then 25%; Freeze Frame near-stops them for 2 s', () => {
    const base = moved(0, 1);
    expect(moved(1, 1) / base).toBeCloseTo(AB.timeWarp.scale[0], 1);
    expect(moved(2, 1) / base).toBeCloseTo(AB.timeWarp.scale[1], 1);
    expect(moved(3, 1) / base).toBeCloseTo(AB.timeWarp.freeze, 1);
    expect(moved(3, 1, 2.1) / base).toBeCloseTo(AB.timeWarp.scale[2], 1);
  });
});

describe('Shield (was a power-up)', () => {
  it('ships and the carrier take no damage', () => {
    const g = quietGame();
    pickUp(g, 'shield', 1);
    const hp = g.carrierHp;
    damageCarrier(g, 2, 'guided');
    expect(g.carrierHp).toBe(hp);
  });

  it('level 1 lets a strafing run through; level 2 blocks it and shatters', () => {
    const strafe = (level: number) => {
      const g = createGame('strait', 9, 3);
      g.queue = [{ at: g.waveT + 0.5, kind: 'strafer', side: -1 } as never, { at: 1e9, kind: 'drone', base: 0 }];
      g.raiderQueue = [];
      run(g, 2);
      if (level) pickUp(g, 'shield', level);
      const dmg = () => g.ships.reduce((a, s) => a + (g.stats.shipHp - s.hp), 0) + g.lost * g.stats.shipHp;
      const before = dmg();
      let shattered = false;
      for (let i = 0; i < 60 * 12 && g.phase === 'wave'; i++) {
        if (g.boost) g.boost.t = Math.max(g.boost.t, g.fx.some((f) => f.kind === 'shatter') ? 0 : 5);
        step(g, DT);
        if (g.fx.some((f) => f.kind === 'shatter')) shattered = true;
      }
      return { hurt: dmg() - before, shattered, boost: g.boost?.id ?? null };
    };
    const none = strafe(0);
    expect(none.hurt).toBeGreaterThan(0);
    expect(strafe(1).hurt).toBe(none.hurt);
    const two = strafe(2);
    expect(two.hurt).toBe(0);
    expect(two.shattered).toBe(true);
    expect(two.boost).toBeNull();
  });

  it('Reflect: a blocked missile bounces back and bursts on what is behind it', () => {
    const g = quietGame();
    pickUp(g, 'shield', 3);
    const c = g.map.carrier;
    const missile = addThreat(g, { kind: 'guided', x: c.x, y: c.y - 30, speed: 200, vy: 200, heading: Math.PI / 2, hp: 2, target: CARRIER_TARGET });
    const behind = addThreat(g, { x: c.x, y: c.y - 30 - AB.shield.bounce, hp: 1 });
    const hp = g.carrierHp;
    run(g, 0.5);
    expect(missile.dead).toBe(true);
    expect(g.carrierHp).toBe(hp);
    expect(behind.dead).toBe(true);
  });
});

describe('Full Steam (was a power-up)', () => {
  it('the convoy at 1.6×, then 2×; Ramming Speed runs down drones', () => {
    const g = quietGame();
    const base = shipSpeed(g);
    pickUp(g, 'fullSteam', 1);
    expect(shipSpeed(g)).toBeCloseTo(base * AB.fullSteam.mult[0]);
    pickUp(g, 'fullSteam', 3);
    expect(shipSpeed(g)).toBeCloseTo(base * AB.fullSteam.mult[2]);
    run(g, 4);
    const s = g.ships[0];
    const d = addThreat(g, { x: s.x + 10, y: s.y, target: s.id });
    const hp = s.hp;
    run(g, 0.05);
    expect(d.dead).toBe(true);
    expect(s.hp).toBe(hp);
  });

  it('the old power-up still works in the campaign', () => {
    const g = quietGame();
    const base = shipSpeed(g);
    g.steamT = 3;
    expect(shipSpeed(g)).toBeCloseTo(base * PICKUPS.steamMult);
  });
});
