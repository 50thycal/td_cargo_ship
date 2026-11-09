// The weapons plan, phase 3 (docs/design/v3-weapons-plan.md): the boosts.
// A boost drops like a weapon, but picking it up never replaces the loaded
// weapon: it changes how everything you fire works while it lasts. Each test
// is a real game with threats placed by hand, played through the calls the
// UI makes (tap, press / release).

import { describe, expect, it } from 'vitest';
import { AB, ABILITIES, ABILITY_ORDER, WEAPON, type AbilityId } from '../../src/v3/data/abilities';
import { PICKUPS } from '../../src/v3/data/config';
import { ROSTER, isBoost } from '../../src/v3/data/roster';
import { Recorder, replay } from '../../src/v3/sim/playlog';
import {
  focusHold,
  CARRIER_TARGET,
  applyFreePlay,
  createGame,
  damageCarrier,
  loadedWeapons,
  pickUpgrade,
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
  it('six boosts, all live in the campaign (the lock-in round cut Fire at Will and Hot Streak; Test Lab round 5 cut Overclock and Time Warp and made Wild Card a weapon)', () => {
    expect(BOOSTS).toEqual(['supplyRun', 'dualWield', 'focus', 'overdrive', 'shield', 'fullSteam']);
    for (const id of BOOSTS) expect(ROSTER[id].status, id).toBe('live');
  });

  it('a boost never replaces the loaded weapon; a second boost replaces the first', () => {
    const g = quietGame();
    load(g, 'railgun');
    pickUp(g, 'overdrive');
    expect(g.weapon?.id).toBe('railgun');
    expect(g.boost?.id).toBe('overdrive');
    pickUp(g, 'fullSteam');
    expect(g.weapon?.id).toBe('railgun');
    expect(g.boost?.id).toBe('fullSteam');
  });

  it('it lasts the weapon time, and a cleared wave takes it with it', () => {
    const g = quietGame();
    pickUp(g, 'shield');
    run(g, WEAPON.time - 0.5);
    expect(g.boost?.id).toBe('shield');
    run(g, 1);
    expect(g.boost).toBeNull();
    pickUp(g, 'fullSteam');
    g.queue = [];
    run(g, 0.2);
    expect(g.phase).toBe('draft');
    expect(g.boost).toBeNull();
  });

  it('the default drops are ammo, repair and the Nuke: the four power-ups that became boosts never drop, in Free Play or the campaign', () => {
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
    for (const k of ['overdrive', 'timewarp', 'shield', 'steam']) expect(campaign.has(k), k).toBe(false);
    expect(campaign.has('ammo')).toBe(true);
  });
});

describe('Supply Run', () => {
  it('no magnet at any level (Test Lab round 5): drops stay where they fell until you tap them', () => {
    for (const level of [1, 2, 3]) {
      const g = quietGame();
      g.levels.railgun = 1;
      g.slots.push('railgun');
      pickUp(g, 'supplyRun', level);
      g.planes = [];
      g.ammo = 1;
      g.pickups.push({ id: g.nextId++, kind: 'ammo', x: 300, y: 200, age: 0 });
      g.pickups.push({ id: g.nextId++, kind: 'weapon', weapon: 'railgun', x: 1300, y: 200, age: 0 });
      run(g, 2.5);
      expect(g.ammo, `level ${level}`).toBeLessThan(g.stats.rack);
      expect(g.weapon, `level ${level}`).toBeNull();
      const ammo = g.pickups.find((p) => p.kind === 'ammo')!;
      expect([ammo.x, ammo.y]).toEqual([300, 200]);
      expect(tap(g, 1300, 200, 30)).toBe('pickup');
      expect(g.weapon?.id).toBe('railgun');
    }
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

  /** The crates a Supply Run's first plane drops, in order. */
  const crates = (level: number, seed = 1, hold: AbilityId[] = ['flak', 'shield']) => {
    const g = quietGame(seed);
    for (const id of hold) {
      g.levels[id] = 1;
      g.slots.push(id);
    }
    pickUp(g, 'supplyRun', level);
    expect(g.planes).toHaveLength(1);
    const seen: { kind: string; weapon?: string; x: number }[] = [];
    for (let i = 0; i < 60 * 5; i++) {
      step(g, DT);
      for (const p of g.pickups) if (p.chute && !seen.some((o) => o.x === p.x)) seen.push({ kind: p.kind, weapon: p.weapon, x: p.x });
    }
    return { g, seen };
  };

  it('a cargo plane drops its crates in a row on parachutes: ammo, your gear (a weapon or boost) and a repair; they stay on the water', () => {
    const { g, seen } = crates(1);
    expect(seen.map((o) => o.kind)).toEqual(['ammo', 'weapon', 'repair']);
    expect(['flak', 'shield']).toContain(seen[1].weapon);
    // In a row: evenly spaced across the middle of the screen.
    const xs = seen.map((o) => o.x).sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBeCloseTo(xs[2] - xs[1], 3);
    expect(g.planes).toHaveLength(0);
    // Nothing flew to the carrier: all three still float where they fell.
    expect(g.pickups).toHaveLength(3);
    // Supply Run never drops itself.
    for (let seed = 1; seed <= 8; seed++) expect(crates(2, seed, ['flak']).seen.every((o) => o.weapon !== 'supplyRun')).toBe(true);
  });

  it('level 2: five crates, two of them your gear; nothing else held: ammo in their place', () => {
    const { seen } = crates(2);
    expect(seen.map((o) => o.kind)).toEqual(['ammo', 'weapon', 'repair', 'weapon', 'ammo']);
    expect(crates(2, 1, []).seen.map((o) => o.kind)).toEqual(['ammo', 'ammo', 'repair', 'ammo', 'ammo']);
  });

  it('Airdrop: another plane every 6 s drops one of your weapons or boosts, or now and then a Nuke', () => {
    const kinds = new Set<string>();
    let nukes = 0;
    let gear = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const g = quietGame(seed);
      g.levels.flak = 1;
      g.slots.push('flak');
      pickUp(g, 'supplyRun', 3);
      g.planes = [];
      run(g, AB.supplyRun.crate + 3);
      for (const p of g.pickups) {
        kinds.add(p.kind === 'weapon' ? p.weapon! : p.kind);
        if (p.kind === 'nuke') nukes++;
        else gear++;
      }
    }
    expect(kinds.has('flak')).toBe(true);
    expect(kinds.has('nuke')).toBe(true);
    // Now and then: well under half the crates.
    expect(nukes).toBeLessThan(gear / 2);
    expect(kinds.has('supplyRun')).toBe(false);
  });
});

describe('cut weapons (Test Lab round 5): Overclock and Time Warp', () => {
  it('are gone from the roster, the draft, Free Play and the Test Lab; Time Warp\'s power-up never drops', async () => {
    const { ABILITIES } = await import('../../src/v3/data/abilities');
    const { CUT_WEAPONS, draftPool, freePlayPool, knownWeapon } = await import('../../src/v3/data/roster');
    const { LAB_CARDS } = await import('../../src/v3/data/lab');
    for (const id of CUT_WEAPONS) {
      expect(ABILITY_ORDER as string[]).not.toContain(id);
      expect(id in ABILITIES).toBe(false);
      expect(id in ROSTER).toBe(false);
      expect(knownWeapon(id)).toBe(false);
      for (const ch of [1, 2, 3, 4]) expect(draftPool(ch) as string[]).not.toContain(id);
      expect(freePlayPool() as string[]).not.toContain(id);
      expect(LAB_CARDS.some((c) => c.id === `w-${id}` || c.weapon === (id as string) || (c.kit as string[]).includes(id))).toBe(false);
    }
    expect(PICKUPS.weights.timewarp).toBe(0);
  });

  it('an old Free Play setup or play log naming one still starts: the cut weapon is left out', () => {
    const g = createGame('strait', 2, 3);
    applyFreePlay(g, { weapons: [{ id: 'overclock' as AbilityId, level: 2 }, { id: 'flak', level: 1 }, { id: 'timeWarp' as AbilityId, level: 1 }], frequentDrops: true });
    expect(g.slots).toEqual(['flak']);
    expect(Object.keys(g.levels)).toEqual(['flak']);
    run(g, 20);
    expect(g.phase === 'wave' || g.phase === 'draft').toBe(true);
    // A draft pick naming one does nothing.
    g.phase = 'draft';
    g.offer = ['flak', 'resupply'];
    pickUpgrade(g, 'overclock' as AbilityId);
    expect(g.phase).toBe('draft');
    expect(g.levels).not.toHaveProperty('overclock');
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

  it('with a hand free it calls the next weapon in: the next kill drops one (a weapon, not a boost)', () => {
    const g = quietGame(3);
    g.levels.scatter = 1;
    g.slots.push('scatter');
    load(g, 'railgun', 1);
    pickUp(g, 'dualWield', 1);
    g.weaponDropT = 0;
    for (let k = 0; k < 4 && !g.pickups.some((p) => p.kind === 'weapon'); k++) {
      shoot(g, addThreat(g, { x: 500 + k * 200, y: 300 }), 1.2);
      g.pickups = g.pickups.filter((p) => p.kind === 'weapon');
    }
    const p = g.pickups.find((o) => o.kind === 'weapon');
    expect(p).toBeDefined();
    expect(['railgun', 'scatter']).toContain(p!.weapon);
  });

  it('a passive joins too, and both passives run (two of them)', () => {
    const g = quietGame();
    load(g, 'droneScreen', 1);
    g.passiveT = 0.1;
    pickUp(g, 'dualWield', 1);
    pickUp(g, 'gunships', 1);
    // Something on screen for the drones to go for (they hold fire without).
    addThreat(g, { x: 800, y: 200, hp: 99 });
    run(g, 0.5);
    expect(g.helis.length).toBe(2);
    expect(g.wings.length).toBeGreaterThan(0);
  });

  it('both weapons last exactly as long as the boost, then both end', () => {
    const g = quietGame();
    load(g, 'railgun', 1);
    g.weapon!.t = 3;
    pickUp(g, 'dualWield', 1);
    pickUp(g, 'scatter', 1);
    run(g, 5);
    // The railgun had 3 s left: under the boost it keeps going.
    expect(g.weapon?.id).toBe('railgun');
    expect(g.weapon2?.id).toBe('scatter');
    expect(g.weapon!.t).toBeCloseTo(g.boost!.t, 1);
    run(g, WEAPON.time - 5 + 0.1);
    expect(g.boost).toBeNull();
    expect(g.weapon).toBeNull();
    expect(g.weapon2).toBeNull();
  });

  it('level 2: it lasts 20 s; MAX: weapons drop twice as often', () => {
    const g = quietGame();
    load(g, 'railgun', 1);
    pickUp(g, 'dualWield', 2);
    expect(g.boost!.t).toBeCloseTo(WEAPON.time * AB.dualWield.time[1], 5);
    run(g, WEAPON.time + 2);
    expect(g.weapon?.id).toBe('railgun');
    const pity = (level: number) => {
      const h = quietGame(5);
      h.levels.flak = 1;
      h.slots.push('flak');
      pickUp(h, 'dualWield', level);
      // Both hands full, so it isn't calling a weapon in.
      h.levels.railgun = 1;
      h.levels.scatter = 1;
      h.weapon = { id: 'railgun', level: 1, t: 99 };
      h.weapon2 = { id: 'scatter', level: 1, t: 99 };
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

  it('the second hand keeps the rest of its time: a new pickup takes the first hand, the same weapon refreshes its own', () => {
    const g = quietGame();
    load(g, 'railgun', 1);
    g.weapon2 = { id: 'scatter', level: 1, t: 5 };
    pickUp(g, 'flak', 1);
    expect(g.weapon?.id).toBe('flak');
    expect(g.weapon2?.id).toBe('scatter');
    pickUp(g, 'scatter', 1);
    expect(g.weapon2?.t).toBe(WEAPON.time);
    expect(g.weapon?.id).toBe('flak');
  });
});

// Test Lab round 4, the player on Dual Wield: "if you pick up another dual
// wield it should reset all your current weapons that you have back to the
// full duration ... I'm not sure there's other scenarios on there too". Every
// case, one test each (docs/design/v3-lab-round4.md has the rule table).
describe('Dual Wield: every case (Test Lab round 4)', () => {
  const FULL = WEAPON.time; // level 1: the weapon time

  it('another Dual Wield while it runs: the boost and both hands go back to the full time', () => {
    const g = quietGame();
    load(g, 'railgun', 1);
    pickUp(g, 'dualWield', 1);
    pickUp(g, 'scatter', 1);
    run(g, 9);
    expect(g.boost!.t).toBeCloseTo(FULL - 9, 1);
    pickUp(g, 'dualWield', 1);
    expect(g.boost?.id).toBe('dualWield');
    expect(g.boost!.t).toBeCloseTo(FULL, 5);
    expect(g.weapon?.id).toBe('railgun');
    expect(g.weapon2?.id).toBe('scatter');
    expect(g.weapon!.t).toBeCloseTo(FULL, 5);
    expect(g.weapon2!.t).toBeCloseTo(FULL, 5);
    // A full time from the second pickup: still both after 14 s, both gone at 15.
    run(g, FULL - 1);
    expect(g.weapon?.id).toBe('railgun');
    expect(g.weapon2?.id).toBe('scatter');
    run(g, 1.2);
    expect(g.boost).toBeNull();
    expect(g.weapon).toBeNull();
    expect(g.weapon2).toBeNull();
  });

  it('a different weapon with one hand loaded fills the second hand, on the boost\'s clock', () => {
    const g = quietGame();
    load(g, 'railgun', 1);
    pickUp(g, 'dualWield', 1);
    run(g, 4);
    pickUp(g, 'scatter', 1);
    run(g, 0.1);
    expect(g.weapon?.id).toBe('railgun');
    expect(g.weapon2?.id).toBe('scatter');
    expect(g.weapon2!.t).toBeCloseTo(g.boost!.t, 1);
  });

  it('a different weapon with both hands full replaces the one loaded longer ago, and keeps the boost\'s clock', () => {
    const g = quietGame();
    load(g, 'railgun', 1);
    pickUp(g, 'dualWield', 1);
    run(g, 1);
    pickUp(g, 'scatter', 1);
    run(g, 1);
    pickUp(g, 'flak', 1);
    // The railgun was loaded first: the Flak takes its hand.
    expect(g.weapon?.id).toBe('flak');
    expect(g.weapon2?.id).toBe('scatter');
    run(g, 1);
    pickUp(g, 'tesla', 1);
    // Now the scatter is the older: the Tesla takes its hand.
    expect(g.weapon?.id).toBe('flak');
    expect(g.weapon2?.id).toBe('tesla');
    run(g, 0.1);
    expect(g.weapon!.t).toBeCloseTo(g.boost!.t, 1);
    expect(g.weapon2!.t).toBeCloseTo(g.boost!.t, 1);
  });

  it('a hand\'s weapon never runs out on its own while the boost runs (1 s left when it started: it lasts the boost)', () => {
    const g = quietGame();
    load(g, 'railgun', 1);
    g.weapon!.t = 1;
    pickUp(g, 'dualWield', 1);
    run(g, 5);
    expect(g.weapon?.id).toBe('railgun');
    expect(g.weapon!.t).toBeCloseTo(g.boost!.t, 1);
  });

  it('the boost runs out: both hands end with it, said once over the gun', () => {
    const g = quietGame();
    load(g, 'railgun', 1);
    pickUp(g, 'dualWield', 1);
    pickUp(g, 'scatter', 1);
    g.fx = [];
    run(g, FULL + 0.1);
    expect(g.boost).toBeNull();
    expect(g.weapon).toBeNull();
    expect(g.weapon2).toBeNull();
    const said = g.fx.filter((f) => f.kind === 'text').map((f) => f.text);
    expect(said).toContain('RAILGUN + SCATTERGUN DONE');
    expect(said).toContain('DUAL WIELD DONE');
  });

  it('the same weapon as a hand holds refreshes that hand (fresh load, still on the boost\'s clock), never both hands', () => {
    const g = quietGame();
    load(g, 'railgun', 1);
    pickUp(g, 'dualWield', 1);
    pickUp(g, 'scatter', 1);
    run(g, 3);
    const t0 = g.weapon2!.t0!;
    pickUp(g, 'scatter', 1);
    expect(g.weapon?.id).toBe('railgun');
    expect(g.weapon2?.id).toBe('scatter');
    expect(g.weapon2!.t0).toBeGreaterThan(t0);
    run(g, 0.1);
    expect(g.weapon2!.t).toBeCloseTo(g.boost!.t, 1);
    pickUp(g, 'railgun', 1);
    expect(g.weapon?.id).toBe('railgun');
    expect(g.weapon2?.id).toBe('scatter');
  });

  it('the Nuke and the power-ups leave the boost and both hands as they are', () => {
    const g = quietGame();
    load(g, 'railgun', 1);
    pickUp(g, 'dualWield', 1);
    pickUp(g, 'scatter', 1);
    run(g, 2);
    const t = g.boost!.t;
    for (const kind of ['nuke', 'ammo', 'repair'] as const) {
      g.pickups.push({ id: g.nextId++, kind, x: 300, y: 600, age: 0 });
      expect(tap(g, 300, 600, 30)).toBe('pickup');
    }
    expect(g.boost?.id).toBe('dualWield');
    expect(g.boost!.t).toBeCloseTo(t, 5);
    expect(g.weapon?.id).toBe('railgun');
    expect(g.weapon2?.id).toBe('scatter');
  });

  it('another boost replaces it: both hands keep the rest of its time and end together when it would have', () => {
    const g = quietGame();
    load(g, 'railgun', 1);
    pickUp(g, 'dualWield', 1);
    pickUp(g, 'scatter', 1);
    run(g, 5);
    pickUp(g, 'shield', 1);
    expect(g.boost?.id).toBe('shield');
    expect(g.weapon?.id).toBe('railgun');
    expect(g.weapon2?.id).toBe('scatter');
    expect(g.weapon!.t).toBeCloseTo(FULL - 5, 1);
    expect(g.weapon2!.t).toBeCloseTo(FULL - 5, 1);
    run(g, FULL - 5 - 0.5);
    expect(g.weapon?.id).toBe('railgun');
    expect(g.weapon2?.id).toBe('scatter');
    run(g, 0.6);
    expect(g.weapon).toBeNull();
    expect(g.weapon2).toBeNull();
  });

  it('a cleared wave ends it and empties both hands; a level drafted after counts from the next pickup', () => {
    const g = quietGame();
    load(g, 'railgun', 1);
    pickUp(g, 'dualWield', 1);
    pickUp(g, 'scatter', 1);
    g.queue = [];
    for (let i = 0; i < 60 && g.phase === 'wave'; i++) step(g, DT);
    expect(g.phase).toBe('draft');
    expect(g.boost).toBeNull();
    expect(g.weapon).toBeNull();
    expect(g.weapon2).toBeNull();
    // The draft levels Dual Wield up: the next one picked up lasts 20 s.
    g.offer = ['dualWield', ...g.offer.filter((o) => o !== 'dualWield')];
    pickUpgrade(g, 'dualWield');
    expect(g.levels.dualWield).toBe(2);
    expect(g.phase).toBe('wave');
    g.pickups.push({ id: g.nextId++, kind: 'weapon', weapon: 'dualWield', x: 300, y: 600, age: 0 });
    tap(g, 300, 600, 30);
    expect(g.boost!.t).toBeCloseTo(WEAPON.time * AB.dualWield.time[1], 5);
  });

  it('started with both hands empty: the first weapon takes the first hand, the next the second, both on its clock', () => {
    const g = quietGame();
    g.levels.railgun = 1;
    g.slots.push('railgun');
    pickUp(g, 'dualWield', 1);
    expect(g.weapon).toBeNull();
    run(g, 2);
    pickUp(g, 'railgun', 1);
    expect(g.weapon?.id).toBe('railgun');
    expect(g.weapon2).toBeNull();
    pickUp(g, 'scatter', 1);
    expect(g.weapon2?.id).toBe('scatter');
    run(g, 0.1);
    expect(g.weapon!.t).toBeCloseTo(g.boost!.t, 1);
    run(g, g.boost!.t + 0.1);
    expect(g.weapon).toBeNull();
    expect(g.weapon2).toBeNull();
  });

  it('started with an empty second hand: it calls a weapon in (the next kill drops one), which joins on the boost\'s clock', () => {
    const g = quietGame(3);
    g.levels.scatter = 1;
    g.slots.push('scatter');
    load(g, 'railgun', 1);
    pickUp(g, 'dualWield', 1);
    for (let k = 0; k < 4 && !g.pickups.some((p) => p.kind === 'weapon'); k++) {
      shoot(g, addThreat(g, { x: 500 + k * 200, y: 300 }), 1.2);
      g.pickups = g.pickups.filter((p) => p.kind === 'weapon');
    }
    const p = g.pickups.find((o) => o.kind === 'weapon')!;
    expect(p).toBeDefined();
    tap(g, p.x, p.y, 30);
    expect(loadedWeapons(g).length).toBeGreaterThanOrEqual(1);
    run(g, 0.1);
    for (const w of loadedWeapons(g)) expect(w.t).toBeCloseTo(g.boost!.t, 1);
  });
});

describe('Wild Card (a weapon since Test Lab round 5)', () => {
  it('it is an active: picked up, it takes over the gun, replacing the loaded weapon, for the weapon time', () => {
    expect(ROSTER.wildCard.cat).toBe('active');
    expect(isBoost('wildCard')).toBe(false);
    const g = quietGame();
    load(g, 'railgun', 1);
    pickUp(g, 'wildCard', 1);
    expect(g.weapon?.id).toBe('wildCard');
    expect(g.boost).toBeNull();
    expect(g.weapon!.t).toBe(g.stats.weaponTime);
    run(g, WEAPON.time + 0.2);
    expect(g.weapon).toBeNull();
  });

  it('loaded: each tap is a random weapon’s shot, at its level', () => {
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

  it('another weapon picked up replaces it, as weapons do', () => {
    const g = quietGame();
    pickUp(g, 'wildCard', 1);
    pickUp(g, 'railgun', 1);
    expect(g.weapon?.id).toBe('railgun');
    addThreat(g, { x: 800, y: 300, hp: 9 });
    tap(g, 800, 300, 30);
    expect(g.cues.some((c) => c.id === 'wild.roll')).toBe(false);
    expect(g.cues.some((c) => c.id === 'rail.beam')).toBe(true);
  });
});

describe('Focus', () => {
  it('a quick tap never slows time (Test Lab round 5); a hold slows it only once held 0.3 s', () => {
    const g = quietGame();
    pickUp(g, 'focus', 1);
    expect(AB.focus.hold).toBe(0.3);
    // A tap: down for 0.2 s.
    let t = g.t;
    focusHold(g, true);
    expect(g.focusing).toBe(false);
    run(g, 0.2);
    focusHold(g, false);
    expect(g.t - t).toBeCloseTo(0.2, 3);
    expect(g.boost!.bank).toBe(AB.focus.bank[0]);
    // A hold: normal speed for the first 0.3 s, then slow.
    focusHold(g, true);
    t = g.t;
    run(g, 0.3);
    // (the step that reaches 0.3 s is already slow)
    expect(g.t - t).toBeGreaterThan(0.3 - DT);
    expect(g.focusing).toBe(true);
    t = g.t;
    run(g, 1);
    expect(g.t - t).toBeCloseTo(AB.focus.scale[0], 2);
    focusHold(g, false);
    expect(g.focusing).toBe(false);
  });

  it('time slows only while a finger is held down, spending the bank in real time', () => {
    const g = quietGame();
    pickUp(g, 'focus', 1);
    let t = g.t;
    run(g, 1);
    expect(g.t - t).toBeCloseTo(1, 2);
    focusHold(g, true);
    run(g, AB.focus.hold);
    t = g.t;
    run(g, 2);
    expect(g.t - t).toBeCloseTo(2 * AB.focus.scale[0], 2);
    expect(g.boost!.bank).toBeCloseTo(AB.focus.bank[0] - 2, 1);
    focusHold(g, false);
    t = g.t;
    run(g, 1);
    expect(g.t - t).toBeCloseTo(1, 2);
  });

  it('the holding finger fires nothing (the other finger taps), and the rack reloads at full speed in slow motion', () => {
    const g = quietGame();
    pickUp(g, 'focus', 1);
    const shots = g.shots;
    focusHold(g, true);
    run(g, AB.focus.hold);
    expect(g.shots).toBe(shots);
    expect(g.focusing).toBe(true);
    g.ammo = 0;
    g.reloadT = 0;
    // 1.5 reloads of real time at half speed: 0.75 reloads of game time,
    // but the rack reloads on the real clock.
    const real = g.stats.reload * 1.5;
    run(g, real);
    const slowed = g.ammo;
    const h = quietGame();
    h.ammo = 0;
    h.reloadT = 0;
    for (let i = 0; i < Math.round((real * AB.focus.scale[0]) / DT); i++) step(h, DT);
    expect(slowed).toBeGreaterThan(h.ammo);
  });

  it('the bank runs out: time goes back to normal with the finger still down', () => {
    const g = quietGame();
    pickUp(g, 'focus', 2);
    focusHold(g, true);
    run(g, AB.focus.bank[1] + 0.5);
    const t = g.t;
    run(g, 1);
    expect(g.t - t).toBeCloseTo(1, 2);
  });

  it('Deadeye: shots fired in slow motion hit for triple', () => {
    const g = quietGame();
    pickUp(g, 'focus', 3);
    focusHold(g, true);
    run(g, AB.focus.hold);
    const th = addThreat(g, { x: 800, y: 300, hp: 5 });
    tap(g, 800, 300, 30);
    run(g, 3);
    expect(th.hp).toBe(5 - AB.focus.damage);
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
        rec.focus(true);
        presses++;
      }
      if (i % 120 === 60 && g.finger) rec.focus(false);
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

describe('Shield (was a power-up)', () => {
  it('ships and the carrier take no damage', () => {
    const g = quietGame();
    pickUp(g, 'shield', 1);
    const hp = g.carrierHp;
    damageCarrier(g, 2, 'guided');
    expect(g.carrierHp).toBe(hp);
  });

  it('new levels (Test Lab round 5): no level blocks a strafing run or shatters; MAX lasts 18 s', () => {
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
        step(g, DT);
        if (g.fx.some((f) => f.kind === 'shatter')) shattered = true;
      }
      return { hurt: dmg() - before, shattered };
    };
    const none = strafe(0);
    expect(none.hurt).toBeGreaterThan(0);
    for (const lv of [1, 2, 3]) expect(strafe(lv)).toEqual({ hurt: none.hurt, shattered: false });
    const time = (lv: number) => {
      const g = quietGame();
      pickUp(g, 'shield', lv);
      return g.boost!.t;
    };
    expect(time(1)).toBeCloseTo(WEAPON.time, 3);
    expect(time(2)).toBeCloseTo(WEAPON.time, 3);
    expect(time(3)).toBeCloseTo(18, 3);
    expect(ABILITIES.shield.levels.join(' ')).not.toMatch(/strafing/i);
  });

  it('level 2: every hit it blocks puts a round back in the rack (level 1 does not)', () => {
    for (const lv of [1, 2]) {
      const g = quietGame();
      pickUp(g, 'shield', lv);
      g.ammo = 1;
      damageCarrier(g, 2, 'guided');
      damageCarrier(g, 2, 'drone');
      expect(g.ammo, `level ${lv}`).toBe(lv >= 2 ? 3 : 1);
    }
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
