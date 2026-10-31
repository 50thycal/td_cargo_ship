// V3: the main gun is set in the Armory before a run; the in-run draft deals
// weapons that drop as pickups and load the gun for a while (round 2). These
// tests pin both systems down.

import { describe, expect, it } from 'vitest';
import { AB, ABILITIES, ABILITY_MAX, ABILITY_ORDER, MAX_SLOTS, WEAPON, abilityName, type AbilityId } from '../../src/v3/data/abilities';
import { ARMORY, ARMORY_MAX, ARMORY_ORDER, BAY_ORDER, BAYS, CARD_DROPS, armoryStats, bayItems, cardsFor, drawCards } from '../../src/v3/data/armory';
import { CARRIER, INTERCEPTOR, PICKUPS, PICKUP_KINDS, SHIP } from '../../src/v3/data/config';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { ARMORY_VERSION, equipArmory, loadProgress, recordResult, runLoadout, type Progress } from '../../src/v3/platform/save';
import { Bot, runBot, SKILLS } from '../../src/v3/sim/bot';
import { playMimic } from '../../src/v3/sim/mimic';
import { replay } from '../../src/v3/sim/playlog';
import {
  CARRIER_TARGET,
  createGame,
  applyFreePlay,
  damageCarrier,
  FREE_PLAY_DROPS,
  pickUpgrade,
  step,
  tap,
  type Game,
  type Pickup,
  type Ship,
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

// ---------------------------------------------------------------------------

describe('the Armory (gun, hull and supply bays, set before a run)', () => {
  const GUN = bayItems('gun');
  const fresh = (): Progress => ({ unlocked: 1, best: {}, cards: 0, armory: {}, equipped: { gun: null, hull: null, supply: null }, cleared: [], armoryV: ARMORY_VERSION });
  /** A fixed card draw: always the k-th open upgrade. */
  const draw = (k: number) => (n: number) => Math.min(k, n - 1);

  it('with no levels it is exactly the base gun and the base drop rules', () => {
    const s = armoryStats({});
    expect(s.rack).toBe(INTERCEPTOR.rack);
    expect(s.reload).toBe(INTERCEPTOR.reload);
    expect(s.blast).toBe(INTERCEPTOR.blast);
    expect(s.interceptorSpeed).toBe(INTERCEPTOR.speed);
    expect(s.contact).toBe(INTERCEPTOR.contact);
    expect(s.hitDamage).toBe(1);
    expect(s.shipHp).toBe(SHIP.hp);
    expect(s.carrierHp).toBe(CARRIER.hp);
    expect(s.pdGap).toBe(0);
    expect(s.repairEvery).toBe(0);
    expect(s.weaponTime).toBe(WEAPON.time);
    expect(s.dropShare).toBe(WEAPON.share);
    expect(s.dropPity).toBe(WEAPON.pity);
    expect(s.powerShare).toBe(1);
    expect(s.powerTime).toBe(1);
    expect(s.glance).toBe(0);
  });

  it('three bays: the gun bay holds the five gun upgrades, hull and supply three each', () => {
    expect(BAY_ORDER).toEqual(['gun', 'hull', 'supply']);
    expect(GUN).toEqual(['reload', 'warhead', 'motor', 'magazine', 'fuse']);
    expect(bayItems('hull')).toEqual(['plating', 'pointdef', 'repair']);
    expect(bayItems('supply')).toEqual(['longload', 'drops', 'stockpile']);
    expect(new Set(BAY_ORDER.map((b) => BAYS[b].color)).size).toBe(3);
  });

  it('each upgrade makes only its own number better, level by level', () => {
    const base = armoryStats({});
    const field = {
      reload: 'reload', warhead: 'blast', motor: 'interceptorSpeed', magazine: 'rack', fuse: 'contact',
      plating: 'glance', pointdef: 'pdRange', repair: 'repairEvery', longload: 'weaponTime', drops: 'dropShare', stockpile: 'powerShare',
    } as const;
    const fields = Object.values(field);
    for (const id of ARMORY_ORDER) {
      let prev = base[field[id]];
      for (let lv = 1; lv <= ARMORY[id].max; lv++) {
        const s = armoryStats({ [id]: lv });
        const v = s[field[id]];
        // Times are better smaller (once Damage Control is bought).
        if (id === 'reload' || (id === 'repair' && lv > 1)) expect(v).toBeLessThan(prev);
        else expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
        // Point Defense also sets its gap, Armor Plating the ships' hull too.
        const also: Partial<Record<string, string>> = { pointdef: 'pdGap', drops: 'dropPity', stockpile: 'powerTime' };
        for (const f of fields) if (f !== field[id] && also[id] !== f) expect(s[f]).toBe(base[f]);
      }
    }
  });

  it('stops short of the mash-wins line round 6 found (≤10 rounds, ≥70% reload time)', () => {
    const top = armoryStats(Object.fromEntries(GUN.map((id) => [id, ARMORY_MAX])));
    expect(top.rack).toBeLessThanOrEqual(10);
    expect(top.reload / INTERCEPTOR.reload).toBeGreaterThanOrEqual(0.7 - 1e-9);
    expect(top.hitDamage).toBe(2);
  });

  it('the run reads the armory', () => {
    const g = createGame('strait', 1, 1, undefined, { magazine: 2 });
    expect(g.stats.rack).toBe(INTERCEPTOR.rack + 2);
    expect(g.ammo).toBe(INTERCEPTOR.rack + 2);
  });

  it('cards are won at the end of a run: one for clearing enough waves, more for a clear and a first clear', () => {
    expect(cardsFor({ wavesCleared: 0, cleared: false }, false)).toBe(0); // quit at once: nothing
    expect(cardsFor({ wavesCleared: CARD_DROPS.minWaves - 1, cleared: false }, false)).toBe(0);
    expect(cardsFor({ wavesCleared: CARD_DROPS.minWaves, cleared: false }, false)).toBe(1);
    expect(cardsFor({ wavesCleared: 10, cleared: true }, false)).toBe(2);
    expect(cardsFor({ wavesCleared: 10, cleared: true }, true)).toBe(3);
  });

  it('a card drawn is a random upgrade not yet maxed, and a card held again adds a level', () => {
    const levels = {};
    expect(drawCards(levels, 1, draw(0))).toEqual(['reload']);
    expect(drawCards(levels, 2, draw(0))).toEqual(['reload', 'reload']);
    expect(levels).toEqual({ reload: 3 });
    drawCards(levels, 2, draw(0));
    expect(levels).toEqual({ reload: 5 });
    // Maxed: it no longer drops; the next open one does.
    expect(drawCards(levels, 1, draw(0))).toEqual(['warhead']);
    // Every level of everything: nothing left to win.
    const full = Object.fromEntries(ARMORY_ORDER.map((id) => [id, ARMORY[id].max]));
    expect(drawCards(full, 3, draw(0))).toEqual([]);
    // Draws spread over the whole Armory.
    const many = {};
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 16807) % 2147483647), seed % n);
    drawCards(many, 30, rnd);
    expect(Object.keys(many).length).toBeGreaterThan(6);
  });

  it('every finished run is recorded, and the cards it won go into the Armory, the first one in a bay equipped', () => {
    const p = fresh();
    const quit = recordResult(p, 'strait', { score: 300, wave: 2, cleared: false, wavesCleared: 1 }, draw(0));
    expect(quit.cards).toEqual([]);
    const lost = recordResult(p, 'strait', { score: 900, wave: 5, cleared: false, wavesCleared: 4 }, draw(6));
    expect(lost.cards).toEqual(['pointdef']);
    expect(p.equipped.hull).toBe('pointdef');
    const won = recordResult(p, 'strait', { score: 9000, wave: 10, cleared: true, wavesCleared: 10 }, draw(0));
    expect(won.firstClear).toBe(true);
    expect(won.cards).toEqual(['reload', 'reload', 'reload']);
    expect(p.armory).toEqual({ pointdef: 1, reload: 3 });
    expect(p.equipped.gun).toBe('reload');
    expect(p.cards).toBe(4);
    const again = recordResult(p, 'strait', { score: 9000, wave: 10, cleared: true, wavesCleared: 10 }, draw(0));
    expect(again.firstClear).toBe(false);
    expect(again.cards).toHaveLength(2);
    expect(p.unlocked).toBe(2);
  });

  it('a run takes ONE upgrade from each bay: only held cards can be equipped, nothing else rides along', () => {
    const p = fresh();
    p.armory = { warhead: 2, magazine: 1, pointdef: 1, plating: 1 };
    p.equipped = { gun: 'warhead', hull: 'pointdef', supply: null };
    expect(runLoadout(p)).toEqual({ warhead: 2, pointdef: 1 });
    expect(equipArmory(p, 'reload')).toBe(false); // no card for it
    expect(equipArmory(p, 'magazine')).toBe(true);
    expect(runLoadout(p)).toEqual({ magazine: 1, pointdef: 1 });
    expect(equipArmory(p, 'plating', 'gun')).toBe(false); // not in that bay
    const g = createGame('strait', 1, 1, undefined, runLoadout(p));
    expect(g.stats.rack).toBe(INTERCEPTOR.rack + 1);
    expect(g.stats.blast).toBe(INTERCEPTOR.blast);
    expect(g.stats.pdGap).toBeGreaterThan(0);
    expect(equipArmory(p, null, 'gun')).toBe(true);
    expect(runLoadout(p)).toEqual({ pointdef: 1 });
  });

  it('an empty or broken save loads as a fresh record', () => {
    const p = loadProgress();
    expect(p.cards).toBe(0);
    expect(p.armory).toEqual({});
    expect(p.equipped).toEqual({ gun: null, hull: null, supply: null });
    expect(p.unlocked).toBe(1);
  });

  it('a save from before the cards has its Armory cleared, once; its maps and bests are kept', () => {
    const store: Record<string, string> = {};
    const ls = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v), removeItem: (k: string) => delete store[k] };
    const prev = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = ls;
    try {
      const best = { strait: { score: 9000, wave: 10 } };
      // The salvage era (one gun upgrade, a string) and the first card build
      // (no version): both cleared.
      for (const old of [
        { unlocked: 2, best, salvage: 90, earned: 400, armory: { warhead: 3, motor: 1 }, equipped: 'warhead', cleared: ['strait'] },
        { unlocked: 2, best, cards: 2, armory: { warhead: 3, pointdef: 2 }, equipped: { gun: 'warhead', hull: 'pointdef', supply: null }, cleared: ['strait'] },
      ]) {
        store['straitwatch.v3.progress'] = JSON.stringify(old);
        const p = loadProgress();
        expect(p.armory).toEqual({});
        expect(p.equipped).toEqual({ gun: null, hull: null, supply: null });
        expect(p.cards).toBe(0);
        expect(runLoadout(p)).toEqual({});
        expect([p.unlocked, p.best, p.cleared]).toEqual([2, best, ['strait']]);
        expect('salvage' in p).toBe(false);
        expect(JSON.parse(store['straitwatch.v3.progress']).armoryV).toBe(ARMORY_VERSION); // cleared for good
      }
      // A current save keeps its cards.
      store['straitwatch.v3.progress'] = JSON.stringify({ unlocked: 1, best: {}, cards: 1, armory: { reload: 1 }, equipped: { gun: 'reload', hull: null, supply: null }, cleared: [], armoryV: ARMORY_VERSION });
      const p = loadProgress();
      expect(p.armory).toMatchObject({ reload: 1 });
      expect(runLoadout(p)).toEqual({ reload: 1 });
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = prev;
    }
  });

  it('Armor Plating: a share of hits on ships and the carrier glance off, more each level', () => {
    expect(armoryStats({ plating: 1 }).glance).toBeGreaterThan(0);
    expect(armoryStats({ plating: 5 }).glance).toBeLessThan(0.5);
    const hits = (lv: number) => {
      const g = quietGame(1, { plating: lv });
      run(g, 4);
      let taken = 0;
      for (let k = 0; k < 400; k++) {
        g.carrierHp = CARRIER.hp;
        damageCarrier(g, 1, 'guided');
        taken += CARRIER.hp - g.carrierHp;
      }
      return taken / 400;
    };
    expect(hits(0)).toBe(1);
    expect(hits(1)).toBeCloseTo(1 - armoryStats({ plating: 1 }).glance, 1);
    expect(hits(5)).toBeCloseTo(1 - armoryStats({ plating: 5 }).glance, 1);
  });

  it('Point Defense: the carrier shoots a threat near it on its own, free, and leaves one out of reach alone', () => {
    const g = quietGame(1, { pointdef: 1 });
    const c = g.map.carrier;
    const near = addThreat(g, { kind: 'heavy', hp: 99, x: c.x + 150, y: c.y - 150, speed: 0 });
    const far = addThreat(g, { kind: 'heavy', hp: 99, x: c.x + 600, y: c.y - 400, speed: 0 });
    const ammo = g.ammo;
    run(g, 7);
    expect(near.hp).toBeLessThan(99);
    expect(far.hp).toBe(99);
    expect(g.ammo).toBe(ammo);
    const none = quietGame(1);
    const t = addThreat(none, { kind: 'heavy', hp: 99, x: c.x + 150, y: c.y - 150, speed: 0 });
    run(none, 7);
    expect(t.hp).toBe(99);
  });

  it('Damage Control: every damaged hull, ships and carrier, gets a point back every so often', () => {
    const every = armoryStats({ repair: 5 }).repairEvery;
    const g = quietGame(1, { repair: 5 });
    run(g, 4); // ships on the water
    const [a, b] = g.ships;
    a.hp = 1;
    b.hp = 2;
    g.carrierHp = CARRIER.hp - 2;
    run(g, every - 0.3);
    expect(a.hp).toBe(1); // not yet
    run(g, 0.5);
    expect([a.hp, b.hp, g.carrierHp]).toEqual([2, 3, CARRIER.hp - 1]);
    run(g, every + 0.2);
    expect([a.hp, b.hp, g.carrierHp]).toEqual([3, 3, CARRIER.hp]); // never past full
  });

  it('Long Loads and Supply Lines: a pickup stays loaded longer; weapons drop on a shorter clock', () => {
    const g = quietGame(1, { longload: 5 });
    g.levels.flak = 1;
    g.slots = ['flak'];
    g.pickups.push({ id: 960, kind: 'weapon', weapon: 'flak', x: 600, y: 300, age: 0 });
    tap(g, 600, 300, 20);
    expect(g.weapon?.t).toBe(WEAPON.time + 20);
    const s = armoryStats({ drops: 5 });
    expect(s.dropPity).toBeLessThan(WEAPON.pity);
    expect(s.dropShare).toBeGreaterThan(WEAPON.share);
  });

  it('Stockpile: power-ups drop more often and the timed ones last longer', () => {
    const top = armoryStats({ stockpile: ARMORY_MAX });
    expect(top.powerShare).toBeGreaterThan(1);
    const g = quietGame(1, { stockpile: ARMORY_MAX });
    g.pickups.push({ id: 961, kind: 'shield', x: 600, y: 300, age: 0 });
    tap(g, 600, 300, 20);
    expect(g.shieldT).toBeCloseTo(PICKUPS.shieldTime * top.powerTime);
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
    g.offer = ['flak', 'airstrike', 'railgun'];
    pickUpgrade(g, 'flak');
    expect(g.levels.flak).toBe(1);
    expect(g.slots).toEqual(['flak']);
    expect(g.weapon).toBeNull();
    g.phase = 'draft';
    g.offer = ['flak', 'airstrike', 'railgun'];
    pickUpgrade(g, 'flak');
    expect(g.levels.flak).toBe(2);
    expect(g.slots).toEqual(['flak']);
  });

  it('holds three; a fourth needs a swap that gives one up; level 3 is the evolution', () => {
    const g = quietGame();
    g.levels = { flak: 1, airstrike: 1, railgun: 3 };
    g.slots = ['flak', 'airstrike', 'railgun'];
    g.phase = 'draft';
    g.offer = ['tesla', 'flak', 'thermo'];
    pickUpgrade(g, 'tesla');
    expect(g.levels.tesla).toBeUndefined();
    g.phase = 'draft';
    g.offer = ['tesla', 'flak', 'thermo'];
    pickUpgrade(g, 'tesla', 'airstrike');
    expect(Object.keys(g.levels).sort()).toEqual(['flak', 'railgun', 'tesla']);
    expect(g.slots).toEqual(['flak', 'tesla', 'railgun']);
    expect(MAX_SLOTS).toBe(3);
    expect(abilityName('railgun', 3)).toBe(ABILITIES.railgun.evolved);
    expect(abilityName('railgun', 2)).toBe(ABILITIES.railgun.name);
  });

  it('loadout slots are stable: a new weapon takes the next slot, a swap takes the replaced one\'s', () => {
    const g = quietGame();
    const take = (id: 'seeker' | 'flak' | 'thermo' | 'airstrike', replace?: 'flak') => {
      g.phase = 'draft';
      g.offer = [id, 'tesla', 'well'];
      pickUpgrade(g, id, replace);
    };
    take('seeker');
    take('flak');
    take('thermo');
    expect(g.slots).toEqual(['seeker', 'flak', 'thermo']);
    take('airstrike', 'flak');
    expect(g.slots).toEqual(['seeker', 'airstrike', 'thermo']);
  });

  it('every weapon has three levels, an evolved name, and says how a tap fires it', () => {
    for (const id of ABILITY_ORDER) {
      const a = ABILITIES[id];
      expect(a.levels).toHaveLength(ABILITY_MAX);
      // No "EVOLVES:" on the line: the card's badge and new name say it.
      expect(a.levels.every((t) => !/EVOLVES/i.test(t))).toBe(true);
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
    expect(weapons.length).toBeGreaterThan(0);
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
    g.levels = { railgun: 1, aegis: 2 };
    g.slots = ['railgun', 'aegis'];
    g.weapon = { id: 'railgun', level: 1, t: 3 };
    g.pickups.push({ id: 901, kind: 'weapon', weapon: 'railgun', x: 600, y: 300, age: 0 });
    tap(g, 600, 300, 20);
    expect(g.weapon!.t).toBe(WEAPON.time);
    g.pickups.push({ id: 902, kind: 'weapon', weapon: 'aegis', x: 600, y: 300, age: 0 });
    tap(g, 600, 300, 20);
    expect(g.weapon).toEqual({ id: 'aegis', level: 2, t: WEAPON.time });
    g.pickups.push({ id: 903, kind: 'weapon', weapon: 'tesla', x: 600, y: 300, age: 0 });
    tap(g, 600, 300, 20);
    expect(g.weapon!.id).toBe('aegis');
  });

  it('a weapon dropped at the edge of the screen lands far enough in for its name to show', () => {
    for (const [x, y] of [[10, 30], [1590, 30], [10, 890], [1590, 890]]) {
      const g = quietGame();
      g.levels.flak = 1;
      g.slots = ['flak'];
      g.weaponDropT = 999; // due: the next kill drops a weapon
      g.rng.drops.chance = () => false; // and not a power-up
      const th = addThreat(g, { x, y, speed: 0 });
      tap(g, th.x, th.y, 30);
      run(g, 3);
      const p = g.pickups.find((o) => o.kind === 'weapon')!;
      expect(p, `${x},${y}`).toBeDefined();
      expect(p.x).toBeGreaterThanOrEqual(90);
      expect(p.x).toBeLessThanOrEqual(1510);
      expect(p.y).toBeLessThanOrEqual(800);
    }
  });

  it(`a weapon pickup floats ${WEAPON.life} s (longer than a power-up) before it is gone`, () => {
    const g = quietGame();
    g.pickups.push({ id: 904, kind: 'weapon', weapon: 'aegis', x: 600, y: 300, age: 0 });
    g.pickups.push({ id: 905, kind: 'ammo', x: 900, y: 300, age: 0 });
    run(g, PICKUPS.life + 0.1);
    expect(g.pickups.map((p) => p.id)).toEqual([904]);
    run(g, WEAPON.life - PICKUPS.life);
    expect(g.pickups).toHaveLength(0);
  });

  it('every weapon shot spends its rounds (Air Strike two a jet): too few is a dry click; Overdrive is free', () => {
    for (const id of ABILITY_ORDER) {
      const g = quietGame();
      load(g, id, 1);
      // Tough enough to outlive a shot.
      const th = addThreat(g, { kind: 'heavy', hp: 99, x: 800, y: 300, speed: 0 });
      const cost = id === 'airstrike' ? AB.airstrike.cost : 1;
      const before = g.ammo;
      expect(tap(g, th.x, th.y, 30), id).toBe('fire');
      expect(g.ammo, id).toBe(before - cost);
      g.ammo = cost - 1;
      expect(tap(g, th.x, th.y, 30), id).toBe('dry');
      g.overdriveT = 2;
      expect(tap(g, th.x, th.y, 30), id).toBe('fire');
      expect(g.ammo, id).toBe(cost - 1);
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
  it('Flak Cannon: the shell leaves a cloud that hits everything flying through it; Flak Curtain hangs longer', () => {
    const g = quietGame();
    load(g, 'flak', 1);
    expect(tap(g, 700, 300, 20)).toBe('fire');
    run(g, 1.2);
    const cloud = g.fields.find((f) => f.kind === 'flak')!;
    expect(cloud.hw).toBe(AB.flak.radius[0]);
    expect(cloud.life).toBe(AB.flak.time[0]);
    const inside = addThreat(g, { kind: 'guided', hp: 2, x: cloud.x1 + 20, y: cloud.y1, speed: 0 });
    const outside = addThreat(g, { x: cloud.x1 + AB.flak.radius[0] + 60, y: cloud.y1, speed: 0 });
    run(g, AB.flak.tick * 2 + 0.05);
    expect(inside.dead).toBe(true);
    expect(outside.dead).toBe(false);
    expect(AB.flak.time[2]).toBeGreaterThan(AB.flak.time[1]);
  });

  it('Seeker Pod: one round sends seekers to the threats nearest the tap; Swarm Pod seekers find a new target', () => {
    const g = quietGame();
    load(g, 'seeker', 1);
    const near = [addThreat(g, { x: 700, y: 300, speed: 0 }), addThreat(g, { x: 760, y: 300, speed: 0 }), addThreat(g, { x: 700, y: 360, speed: 0 })];
    const far = addThreat(g, { x: 1500, y: 100, speed: 0 });
    const ammo = g.ammo;
    expect(tap(g, 710, 310, 20)).toBe('fire');
    expect(g.ammo).toBe(ammo - 1);
    const seekers = g.interceptors.filter((i) => i.src === 'seeker');
    expect(seekers).toHaveLength(AB.seeker.missiles[0]);
    expect(new Set(seekers.map((i) => i.target))).toEqual(new Set(near.map((t) => t.id)));
    run(g, 2);
    expect(near.every((t) => t.dead)).toBe(true);
    expect(far.dead).toBe(false);
    // Nothing within reach: nothing fires, no round spent.
    const g0 = quietGame();
    load(g0, 'seeker', 1);
    expect(tap(g0, 300, 300, 20)).toBe('empty');
    expect(g0.ammo).toBe(g0.stats.rack);
    // Swarm Pod: a seeker whose target died goes for another.
    const g2 = quietGame();
    load(g2, 'seeker', 3);
    const only = addThreat(g2, { x: 700, y: 300, speed: 0 });
    const other = addThreat(g2, { x: 1200, y: 200, speed: 0 });
    tap(g2, only.x, only.y, 20);
    only.dead = true;
    run(g2, 2.5);
    expect(other.dead).toBe(true);
  });

  it('Aegis Dome: a shot at a threat also domes the ship it is after; the dome takes its hits, then is gone; Bastion bursts back', () => {
    const g = quietGame();
    const ship: Ship = { id: 77, x: 900, y: 600, hp: 3, slot: 0, channel: 0, mult: 1 };
    g.ships.push(ship);
    load(g, 'aegis', 1);
    const m = addThreat(g, { kind: 'guided', hp: 2, x: 500, y: 200, target: 77, speed: 0 });
    const ammo = g.ammo;
    expect(tap(g, m.x, m.y, 30)).toBe('fire');
    expect(g.ammo).toBe(ammo - 1);
    expect(ship.dome).toEqual({ t: AB.aegis.time[0], hits: AB.aegis.hits[0], level: 1 });
    expect(g.interceptors.some((i) => i.target === m.id)).toBe(true); // and a shot
    // Two missiles reach the ship: the dome takes both, the hull nothing.
    for (let k = 0; k < AB.aegis.hits[0]; k++) addThreat(g, { kind: 'guided', hp: 2, x: ship.x, y: ship.y, target: 77, speed: 0 });
    step(g, DT);
    expect(ship.hp).toBe(3);
    step(g, DT);
    expect(ship.dome).toBeUndefined();
    // The next one hits the hull.
    addThreat(g, { kind: 'guided', hp: 2, x: ship.x, y: ship.y, target: 77, speed: 0 });
    step(g, DT);
    expect(ship.hp).toBeLessThan(3);
    // A tap on open water covers the hull nearest it; far from any: nothing.
    const g2 = quietGame();
    // (Well away from the carrier, which would otherwise be the nearer hull.)
    g2.ships.push({ id: 78, x: 300, y: 400, hp: 3, slot: 0, channel: 0, mult: 1 });
    load(g2, 'aegis', 3);
    expect(tap(g2, 340, 380, 20)).toBe('fire');
    expect(g2.ships[0].dome?.level).toBe(3);
    expect(tap(g2, 200, 150, 20)).toBe('empty');
    // Bastion: the absorbed hit bursts back out.
    const near = addThreat(g2, { kind: 'guided', hp: 2, x: 360, y: 400, speed: 0 });
    addThreat(g2, { kind: 'guided', hp: 2, x: 300, y: 400, target: 78, speed: 0 });
    step(g2, DT);
    expect(g2.ships[0].hp).toBe(3);
    expect(near.dead).toBe(true);
  });

  it('Air Strike costs two rounds a jet', () => {
    const g = quietGame();
    load(g, 'airstrike', 1);
    g.ammo = 3;
    expect(tap(g, 400, 300, 20)).toBe('fire');
    expect(g.ammo).toBe(1);
    expect(tap(g, 400, 300, 20)).toBe('dry');
    expect(g.allies).toHaveLength(1);
  });

  it('Shrapnel Shell: the burst throws its fragments out in every direction, at once, each stopping at its first hit', () => {
    const g = quietGame();
    load(g, 'shrapnel', 1);
    // A ring of drones round the burst, inside the fragments' reach, and a
    // ring well outside it.
    const near = Array.from({ length: 24 }, (_, i) => addThreat(g, { x: 700 + Math.cos((i / 24) * Math.PI * 2) * 150, y: 300 + Math.sin((i / 24) * Math.PI * 2) * 150, speed: 0 }));
    const far = Array.from({ length: 12 }, (_, i) => addThreat(g, { x: 700 + Math.cos((i / 12) * Math.PI * 2) * (AB.shrapnel.range[0] + 60), y: 300 + Math.sin((i / 12) * Math.PI * 2) * (AB.shrapnel.range[0] + 60), speed: 0 }));
    expect(tap(g, 700, 300, 20)).toBe('fire');
    run(g, 1.5);
    const killed = near.filter((t) => t.dead).length;
    expect(killed).toBeGreaterThanOrEqual(4);
    expect(killed).toBeLessThanOrEqual(AB.shrapnel.frags[0]);
    expect(far.every((t) => !t.dead)).toBe(true);
  });

  it('Scattergun: a short cone of pellets toward the tap; out of reach is safe; Dragon\'s Breath pierces', () => {
    const g = quietGame();
    load(g, 'scatter', 1);
    const c = g.map.carrier;
    const inReach = addThreat(g, { kind: 'guided', hp: 2, x: c.x, y: c.y - 300, speed: 0 });
    const behind = addThreat(g, { x: c.x, y: c.y - 330, speed: 0 });
    const tooFar = addThreat(g, { x: c.x + 5, y: c.y - AB.scatter.range[0] - 80, speed: 0 });
    const ammo = g.ammo;
    expect(tap(g, inReach.x, inReach.y, 20)).toBe('fire');
    expect(g.ammo).toBe(ammo - 1);
    // At this range several of the cone's middle pellets hit the missile.
    expect(inReach.dead).toBe(true);
    expect(tooFar.dead).toBe(false);
    void behind;
    const g2 = quietGame();
    load(g2, 'scatter', 3);
    const a = addThreat(g2, { kind: 'heavy', hp: 99, x: c.x, y: c.y - 200, speed: 0 });
    const b = addThreat(g2, { x: c.x, y: c.y - 350, speed: 0 });
    tap(g2, c.x, c.y - 200, 20);
    expect(a.hp).toBeLessThan(99);
    expect(b.dead).toBe(true);
  });

  it('Thermobaric Shell: one huge blast hits everything in it, nothing past it; Daisy Cutter hits for 3', () => {
    const g = quietGame();
    load(g, 'thermo', 1);
    const r = AB.thermo.radius[0];
    const inside = [0, 1, 2, 3].map((i) => addThreat(g, { x: 700 + Math.cos(i * 1.6) * (r - 15), y: 300 + Math.sin(i * 1.6) * (r - 15), speed: 0 }));
    const outside = addThreat(g, { x: 700 + r + 40, y: 300, speed: 0 });
    tap(g, 700, 300, 20);
    run(g, 1.5);
    expect(inside.every((t) => t.dead)).toBe(true);
    expect(outside.dead).toBe(false);
    const g2 = quietGame();
    load(g2, 'thermo', 3);
    const heavy = addThreat(g2, { kind: 'heavy', hp: 8, x: 700 + AB.thermo.radius[2] - 20, y: 300, speed: 0 });
    tap(g2, 700, 300, 20);
    run(g2, 1.5);
    expect(heavy.hp).toBe(8 - AB.thermo.damage[2]);
  });

  it('Boomerang: a blade out to the tap and back, cutting on both passes, then caught; Twin Blades throws two', () => {
    const g = quietGame();
    load(g, 'boomerang', 1);
    const c = g.map.carrier;
    const tough = addThreat(g, { kind: 'guided', hp: 2, x: c.x, y: c.y - 250, speed: 0 });
    const ammo = g.ammo;
    expect(tap(g, c.x, c.y - 400, 20)).toBe('fire');
    expect(g.ammo).toBe(ammo - 1);
    expect(g.blades).toHaveLength(1);
    run(g, 0.3);
    expect(tough.hp).toBe(1); // cut on the way out
    run(g, 1.2);
    expect(tough.dead).toBe(true); // and again on the way back
    expect(g.blades).toHaveLength(0); // caught
    const g2 = quietGame();
    load(g2, 'boomerang', 3);
    tap(g2, 700, 200, 20);
    expect(g2.blades).toHaveLength(2);
  });

  it('Frigate Escort: frigates sail in, fire on their own while it lasts, then sail off; Battle Group brings three', () => {
    const g = quietGame();
    g.levels.frigate = 1;
    g.slots = ['frigate'];
    g.pickups.push({ id: 950, kind: 'weapon', weapon: 'frigate', x: 600, y: 300, age: 0 });
    tap(g, 600, 300, 20);
    expect(g.escorts).toHaveLength(AB.frigate.ships[0]);
    run(g, 6); // on station
    const e = g.escorts[0];
    const th = addThreat(g, { kind: 'heavy', hp: 99, x: e.x + 100, y: e.y - 150, speed: 0 });
    const ammo = g.ammo;
    run(g, 2);
    expect(th.hp).toBeLessThan(99); // shot by the frigates
    expect(g.ammo).toBe(ammo); // at no cost to the rack
    th.dead = true;
    run(g, WEAPON.time); // the weapon runs out: they sail off
    expect(g.weapon).toBeNull();
    run(g, 8);
    expect(g.escorts).toHaveLength(0);
    const g3 = quietGame();
    g3.levels.frigate = 3;
    g3.slots = ['frigate'];
    g3.pickups.push({ id: 951, kind: 'weapon', weapon: 'frigate', x: 600, y: 300, age: 0 });
    tap(g3, 600, 300, 20);
    expect(g3.escorts).toHaveLength(3);
  });

  it('Battle Group: three frigates sail in, hold station and sail off without one running over another', () => {
    for (const map of MAP_ORDER) {
      const g = createGame(map, 1);
      g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
      g.raiderQueue = [];
      g.levels.frigate = 3;
      g.slots = ['frigate'];
      g.pickups.push({ id: 953, kind: 'weapon', weapon: 'frigate', x: 600, y: 300, age: 0 });
      tap(g, 600, 300, 20);
      expect(g.escorts).toHaveLength(3);
      let closest = Infinity;
      for (let t = 0; t < WEAPON.time + 10; t += 0.1) {
        run(g, 0.1);
        for (const a of g.escorts)
          for (const b of g.escorts) if (a !== b && Math.abs(a.y - b.y) < 40) closest = Math.min(closest, Math.abs(a.x - b.x));
      }
      expect(g.escorts).toHaveLength(0);
      expect(closest).toBeGreaterThan(210); // a hull and its wake
    }
  });

  it('Frigate Escort: the frigates open fire as soon as they are on screen, before reaching station', () => {
    const g = quietGame();
    g.levels.frigate = 1;
    g.slots = ['frigate'];
    g.pickups.push({ id: 952, kind: 'weapon', weapon: 'frigate', x: 600, y: 300, age: 0 });
    tap(g, 600, 300, 20);
    run(g, 1.5);
    const far = g.escorts.reduce((a, b) => (b.sx > a.sx ? b : a));
    expect(far.x).toBeGreaterThan(20);
    expect(far.sx - far.x).toBeGreaterThan(200); // still sailing in
    const th = addThreat(g, { kind: 'heavy', hp: 99, x: far.x + 120, y: far.y, speed: 0 });
    run(g, 1);
    expect(th.hp).toBeLessThan(99);
  });

  it('Gravity Well: the vortex drags drones and missiles in, then implodes on them; ballistics fly on', () => {
    const g = quietGame();
    load(g, 'well', 1);
    expect(tap(g, 700, 300, 20)).toBe('fire');
    run(g, 1.1);
    const well = g.fields.find((f) => f.kind === 'well')!;
    expect(well.hw).toBe(AB.well.radius[0]);
    const d = addThreat(g, { x: well.x1 + 150, y: well.y1, speed: 70, heading: 0 });
    const m = addThreat(g, { kind: 'guided', hp: 1, x: well.x1, y: well.y1 - 140, speed: 150, heading: -Math.PI / 2 });
    run(g, AB.well.time[0]);
    expect(d.dead).toBe(true);
    expect(m.dead).toBe(true);
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
    // A tap on open water calls one too (its rounds spent).
    const ammo = g.ammo;
    expect(tap(g, 200, 700, 20)).toBe('fire');
    expect(g.ammo).toBe(ammo - AB.airstrike.cost);
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

  it('a shell fired as the clock runs out still bursts as that weapon', () => {
    const g = quietGame();
    load(g, 'flak', 1);
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

  it('a run with all three bays (Armor Plating\'s glancing hits included) replays exactly', () => {
    const armory = { warhead: 2, plating: 3, stockpile: 2 };
    const { game, log } = playMimic('gauntlet', 12, { armory });
    expect(log.armory).toEqual(armory);
    expect(game.wave).toBeGreaterThan(1);
    const again = replay(log);
    expect(again.steps).toBe(game.steps);
    expect(again.score).toBe(game.score);
    expect(again.levels).toEqual(game.levels);
    expect(again.carrierHp).toBe(game.carrierHp);
  });

  it('Free Play: the run holds the weapons set up, drops them often if asked, and its log replays exactly', () => {
    const freePlay = { weapons: [{ id: 'frigate' as const, level: 3 }, { id: 'thermo' as const, level: 2 }], frequentDrops: true };
    const g = createGame('strait', 9, 7, undefined, { plating: 2 });
    applyFreePlay(g, freePlay);
    expect(g.wave).toBe(7);
    expect(g.slots).toEqual(['frigate', 'thermo']);
    expect(g.levels).toEqual({ frigate: 3, thermo: 2 });
    expect(g.stats.dropPity).toBe(FREE_PLAY_DROPS.pity);
    expect(g.stats.dropShare).toBeCloseTo(WEAPON.share * FREE_PLAY_DROPS.share);
    const { game, log } = playMimic('strait', 9, { firstWave: 7, armory: { plating: 2 }, freePlay });
    expect(log.freePlay).toEqual(freePlay);
    expect(game.uses.frigate ?? 0).toBeGreaterThan(0);
    const again = replay(log);
    expect(again.steps).toBe(game.steps);
    expect(again.score).toBe(game.score);
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
    g.fields.push({ kind: 'flak', x1: 400, y1: 400, x2: 400, y2: 400, hw: 70, t: 0, life: 10, tick: 0, level: 1 });
    g.overdriveT = 4;
    g.shieldT = 3;
    g.warpT = 2;
    g.levels.flak = 1;
    g.slots = ['flak'];
    g.weapon = { id: 'flak', level: 1, t: 5 };
    g.ammo = 0;
    step(g, DT);
    expect(g.phase).toBe('draft');
    expect(g.pickups).toHaveLength(0);
    expect(g.interceptors).toHaveLength(0);
    expect(g.fields).toHaveLength(0);
    expect([g.overdriveT, g.shieldT, g.warpT, g.steamT]).toEqual([0, 0, 0, 0]);
    expect(g.weapon).toBeNull();
    expect(g.ammo).toBe(g.stats.rack);
    expect(g.levels.flak).toBe(1);
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
    expect(L('flak', 1)).toContain(`${AB.flak.time[0]} s`);
    expect(L('flak', 2)).toContain(`${AB.flak.time[1]} s`);
    expect(L('flak', 3)).toContain(`${AB.flak.time[2]} s`);
    expect(AB.flak.radius[1]).toBeGreaterThan(AB.flak.radius[0]); // "a bigger cloud"
    expect(L('seeker', 1)).toContain(`${AB.seeker.missiles[0]} seekers`);
    expect(L('seeker', 2)).toContain(`${AB.seeker.missiles[1]} seekers`);
    expect(L('seeker', 3)).toContain(`${AB.seeker.missiles[2]} seekers`);
    expect(L('aegis', 1)).toContain(`${AB.aegis.time[0]} s, ${AB.aegis.hits[0]} hits`);
    expect(L('aegis', 2)).toContain(`${AB.aegis.time[1]} s, ${AB.aegis.hits[1]} hits`);
    expect(L('aegis', 3)).toContain(`${AB.aegis.time[2]} s, ${AB.aegis.hits[2]} hits`);
    expect(L('aegis', 3)).toContain(`for ${AB.aegis.burstDmg}`);
    expect(ABILITIES.airstrike.how).toContain(`for ${AB.airstrike.cost} rounds`);
    expect(L('airstrike', 1)).toContain(`${AB.airstrike.cost} rounds a jet`);
    expect(L('shrapnel', 1)).toContain(`${AB.shrapnel.frags[0]} fragments`);
    expect(L('shrapnel', 2)).toContain(`${AB.shrapnel.frags[1]} fragments`);
    expect(L('shrapnel', 3)).toContain(`${AB.shrapnel.frags[2]} fragments`);
    expect(AB.shrapnel.range[1]).toBeGreaterThan(AB.shrapnel.range[0]); // "fly further"
    expect(L('frigate', 1)).toMatch(/^Two frigates/);
    expect(AB.frigate.ships[0]).toBe(2);
    expect(AB.frigate.gap[0] / AB.frigate.gap[1]).toBeCloseTo(1.5); // "half again as fast"
    expect(AB.frigate.ships[2]).toBe(3); // "a third frigate"
    expect(AB.frigate.gap[2]).toBeLessThan(AB.frigate.gap[1]); // "faster still"
    expect(AB.thermo.radius[1]).toBeGreaterThan(AB.thermo.radius[0]); // "a bigger blast"
    expect(L('thermo', 2)).toContain(`hits for ${AB.thermo.damage[1]}`);
    expect(L('thermo', 3)).toContain(`hitting for ${AB.thermo.damage[2]}`);
    expect(L('scatter', 1)).toContain(`${AB.scatter.pellets[0]} pellets`);
    expect(L('scatter', 2)).toContain(`${AB.scatter.pellets[1]} pellets`);
    expect(L('scatter', 3)).toContain(`${AB.scatter.pellets[2]} pellets`);
    expect(AB.scatter.range[1]).toBeGreaterThan(AB.scatter.range[0]); // "reaching further"
    expect(AB.boomerang.width[1]).toBeGreaterThan(AB.boomerang.width[0]); // "a wider blade"
    expect(L('boomerang', 2)).toContain(`cuts for ${AB.boomerang.damage[1]}`);
    expect(L('well', 1)).toContain(`${AB.well.time[0]} s`);
    expect(AB.well.radius[1]).toBeGreaterThan(AB.well.radius[0]); // "a wider pull"
    expect(AB.well.damage[1]).toBeGreaterThan(AB.well.damage[0]); // "a harder implosion"
    expect(L('well', 3)).toContain(`${AB.well.time[2]} s`);
    expect(L('well', 3)).toContain(`hits for ${AB.well.damage[2]}`);
    expect(AB.airstrike.band[1]).toBeGreaterThan(AB.airstrike.band[0]); // "a wider run"
    expect(AB.airstrike.damage[1]).toBeGreaterThan(AB.airstrike.damage[0]); // "harder hits"
    expect(L('airstrike', 3)).toContain(`burns for ${AB.airstrike.burnTime} s`);
    expect(AB.railgun.damage[1]).toBe(AB.railgun.damage[0] * 2); // "twice the damage"
    expect(AB.railgun.damage[2]).toBe(AB.railgun.damage[0] * 4); // "four times as hard"
    expect(AB.railgun.damage[2] * 2).toBeGreaterThanOrEqual(8); // "two bring down a heavy" (8 HP)
    expect(L('tesla', 1)).toContain(`${AB.tesla.arcs[0]} threats`);
    expect(L('tesla', 2)).toContain(`${AB.tesla.arcs[1]} arcs`);
    expect(AB.tesla.depth[1]).toBe(2); // "every arc arcs again"
  });

  it('every Armory blurb quotes its real per-level change', () => {
    const base = armoryStats({});
    const pct = (a: number, b: number) => `${Math.round(Math.abs(a / b - 1) * 100)}%`;
    expect(ARMORY.warhead.blurb).toContain(pct(armoryStats({ warhead: 1 }).blast, base.blast));
    expect(ARMORY.motor.blurb).toContain(pct(armoryStats({ motor: 1 }).interceptorSpeed, base.interceptorSpeed));
    expect(ARMORY.reload.blurb).toContain(pct(armoryStats({ reload: 1 }).reload, base.reload));
    expect(armoryStats({ fuse: ARMORY_MAX }).hitDamage).toBe(2); // "level 5 hits for 2"
  });
});
