// The four new Armory upgrades (docs/design/v3-armory-overhaul.md, "The four
// new upgrades"): Boilers, Lifeboats (Hull), Quartermaster and Salvage Crews
// (Supply).
import { describe, expect, it } from 'vitest';
import { ARMORY, ARMORY_MAX, ARMORY_ORDER, LIFEBOATS_ALL, armoryStats, bayItems, levelCost, scrapFor } from '../../src/v3/data/armory';
import { MAPS } from '../../src/v3/data/maps';
import { ABILITY_ORDER } from '../../src/v3/data/abilities';
import { addPickup, createGame, damageShip, rerollDraft, rerollWorth, shipSpeed, shipsSunk, step, tap, type Game } from '../../src/v3/sim/game';
import { restoreConvoy } from '../../src/v3/sim/events';
import { BotRun, PERSONAS, Mimic, PREFER_TOP } from '../../src/v3/sim/mimic';
import { replay, SIM_DT } from '../../src/v3/sim/playlog';
import { stateHash } from '../../src/v3/sim/mapLab';
import { loadProgress, recordResult, runLoadout } from '../../src/v3/platform/save';
import { ARMORY_VERSION } from '../../src/v3/platform/save';

const NEW = ['boilers', 'lifeboats', 'quartermaster', 'salvage'] as const;

/** Play a bot run up to its first draft. */
function toDraft(armory: Parameters<typeof armoryStats>[0], seed = 7, map: 'strait' | 'gauntlet' = 'strait'): BotRun {
  const run = new BotRun(map, seed, { armory });
  // The bot would pick at once: step the sim ourselves up to the draft.
  const g = run.game;
  for (let i = 0; i < 60 * 600 && g.phase === 'wave'; i++) step(g, SIM_DT);
  expect(g.phase).toBe('draft');
  return run;
}

/** Step a game until it has `n` ships on the water. */
function withShips(g: Game, n: number): void {
  for (let i = 0; i < 60 * 120 && g.ships.length < n; i++) step(g, SIM_DT);
  expect(g.ships.length).toBeGreaterThanOrEqual(n);
}

describe('the four new upgrades: in the Armory like the others', () => {
  it('two in each of Hull and Supply, five levels, the same Scrap costs, 15 cards in all', () => {
    expect(ARMORY_ORDER).toHaveLength(15);
    expect(bayItems('hull').slice(-2)).toEqual(['boilers', 'lifeboats']);
    expect(bayItems('supply').slice(-2)).toEqual(['quartermaster', 'salvage']);
    for (const id of NEW) {
      expect(ARMORY[id].max).toBe(ARMORY_MAX);
      expect([1, 2, 3, 4].map((l) => levelCost(id, l))).toEqual([1, 2, 3, 4].map((l) => levelCost('plating', l)));
      expect(levelCost(id, 5)).toBeNull();
      // Every level reads as something (none of them says the same as no card).
      for (let l = 1; l <= ARMORY_MAX; l++) expect(ARMORY[id].show(l)).not.toBe(ARMORY[id].show(0));
    }
  });

  it('with none of them, every number is as before', () => {
    const s = armoryStats({});
    expect([s.convoySpeed, s.steamTime, s.lifeboats, s.rerolls, s.draftCards, s.salvage]).toEqual([1, 1, 0, 0, 3, 0]);
  });

  it('their numbers, level by level', () => {
    const at = (id: (typeof NEW)[number], f: keyof ReturnType<typeof armoryStats>) => [0, 1, 2, 3, 4, 5].map((l) => armoryStats({ [id]: l })[f]);
    expect(at('boilers', 'convoySpeed')).toEqual([1, 1.04, 1.08, 1.12, 1.16, 1.2]);
    expect(at('boilers', 'steamTime')).toEqual([1, 1, 1, 1, 1, 2]);
    expect(at('lifeboats', 'lifeboats')).toEqual([0, 2, 4, 6, 8, LIFEBOATS_ALL]);
    expect(at('quartermaster', 'rerolls')).toEqual([0, 1, 2, 2, 3, 3]);
    expect(at('quartermaster', 'draftCards')).toEqual([3, 3, 3, 3, 3, 4]);
    expect(at('salvage', 'salvage')).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
  });
});

describe('Boilers', () => {
  it('sails the convoy 20% faster at level 5, 4% a level', () => {
    const base = shipSpeed(createGame('strait', 3));
    expect(shipSpeed(createGame('strait', 3, 1, undefined, { boilers: 1 })) / base).toBeCloseTo(1.04, 9);
    expect(shipSpeed(createGame('strait', 3, 1, undefined, { boilers: 5 })) / base).toBeCloseTo(1.2, 9);
  });

  it('level 5: a Full Steam pickup lasts twice as long', () => {
    const steam = (boilers: number) => {
      const g = createGame('strait', 3, 1, undefined, { boilers });
      addPickup(g, 'steam', 600, 300);
      const p = g.pickups[g.pickups.length - 1];
      tap(g, p.x, p.y, 40);
      return g.steamT;
    };
    expect(steam(0)).toBeGreaterThan(0);
    expect(steam(4)).toBe(steam(0));
    expect(steam(5)).toBeCloseTo(2 * steam(0), 9);
  });

  it("leaves Saltgate's locks on their own clocks: each lock fills for its `wait`", () => {
    const fills = (boilers: number) => {
      const g = createGame('saltgate', 5, 1, undefined, { boilers });
      g.tempo = { ...g.tempo, lossLimit: 999 };
      const out: number[] = [];
      const was = g.lockState.map((l) => l.phase);
      const since = g.lockState.map(() => 0);
      for (let i = 0; i < 60 * 90 && g.phase === 'wave'; i++) {
        step(g, SIM_DT);
        g.lockState.forEach((l, k) => {
          if (was[k] !== l.phase) {
            if (was[k] === 'fill') out.push(Math.round((g.t - since[k]) * 10) / 10 - MAPS.saltgate.locks![k].wait);
            since[k] = g.t;
            was[k] = l.phase;
          }
        });
      }
      return out;
    };
    const fast = fills(5);
    expect(fast.length).toBeGreaterThan(0);
    for (const d of [...fast, ...fills(0)]) expect(Math.abs(d)).toBeLessThan(0.1);
  });
});

describe('Lifeboats', () => {
  it("a wave's first ship sunk counts half; the next in the same wave counts whole; ships are still sunk", () => {
    const g = createGame('strait', 9, 1, undefined, { lifeboats: 5 });
    withShips(g, 3);
    damageShip(g, g.ships[0], 99, 'drone');
    expect(g.lost).toBe(1);
    expect(shipsSunk(g)).toBe(0.5);
    damageShip(g, g.ships[0], 99, 'drone');
    expect(g.lost).toBe(2);
    expect(shipsSunk(g)).toBe(1.5);
    // The next wave's first ship: half again (two halves make one).
    g.wave += 1;
    damageShip(g, g.ships[0], 99, 'drone');
    expect(shipsSunk(g)).toBe(2);
    expect(g.boatsUsed).toBe(2);
  });

  it('the run ends at the loss limit counted with the halves: six ships over six waves is three losses', () => {
    const g = createGame('strait', 9, 1, undefined, { lifeboats: 5 });
    for (let w = 0; w < 6; w++) {
      withShips(g, 1);
      damageShip(g, g.ships[0], 99, 'drone');
      g.wave += 1;
    }
    expect(g.lost).toBe(6);
    expect(shipsSunk(g)).toBe(3);
    step(g, SIM_DT);
    expect(g.phase).not.toBe('lost');
    // Without boats the same six end it.
    const h = createGame('strait', 9);
    for (let w = 0; w < 6; w++) {
      withShips(h, 1);
      damageShip(h, h.ships[0], 99, 'drone');
    }
    step(h, SIM_DT);
    expect(h.phase).toBe('lost');
  });

  it('a level has its boats a run (level 1: two waves), and the convoy restored before the boss rounds wipes the halves with the losses', () => {
    const g = createGame('strait', 9, 1, undefined, { lifeboats: 1 });
    for (let w = 0; w < 3; w++) {
      withShips(g, 1);
      damageShip(g, g.ships[0], 99, 'drone');
      g.wave += 1;
    }
    expect(shipsSunk(g)).toBe(2);
    expect(g.boatsUsed).toBe(2);
    restoreConvoy(g);
    expect(shipsSunk(g)).toBe(0);
  });

  it("the wave's record carries the boats used; a run without them has no such field", () => {
    const run = new BotRun('strait', 4, { armory: { lifeboats: 5 }, tempo: { waveLen: 1, stride: 1, lossLimit: 99 } });
    run.advance(Infinity);
    const g = run.game;
    expect(g.history.some((h) => (h.boats ?? 0) > 0)).toBe(true);
    const plain = new BotRun('strait', 4, { tempo: { waveLen: 1, stride: 1, lossLimit: 99 } });
    plain.advance(60 * 60 * 2);
    expect(plain.game.history.every((h) => !('boats' in h))).toBe(true);
  });
});

describe('Quartermaster', () => {
  it('level 5 deals four cards; level 4 three', () => {
    const four = toDraft({ quartermaster: 5 }).game.offer.filter((id) => id !== 'resupply');
    const three = toDraft({ quartermaster: 4 }).game.offer.filter((id) => id !== 'resupply');
    expect(four).toHaveLength(4);
    expect(three).toHaveLength(3);
  });

  it('a re-roll deals again from the draft dice: the same on the same seed, a new hand, the count goes down', () => {
    const a = toDraft({ quartermaster: 3 }).game;
    const b = toDraft({ quartermaster: 3 }).game;
    expect(a.rerolls).toBe(2);
    const old = [...a.offer];
    expect(rerollDraft(a)).toBe(true);
    expect(rerollDraft(b)).toBe(true);
    expect(a.offer).toEqual(b.offer);
    expect(a.offer.some((id) => !old.includes(id))).toBe(true);
    expect(a.offer.filter((id) => id !== 'resupply').every((id) => !old.includes(id))).toBe(true);
    expect(a.rerolls).toBe(1);
    expect(rerollDraft(a)).toBe(true);
    expect(rerollDraft(a)).toBe(false);
    expect(a.rerolls).toBe(0);
  });

  it('no card, no re-roll', () => {
    const g = toDraft({}).game;
    const old = [...g.offer];
    expect(rerollDraft(g)).toBe(false);
    expect(g.offer).toEqual(old);
  });

  it("a re-roll is logged ('x') and the log replays to the same game", () => {
    const run = toDraft({ quartermaster: 5 }, 12);
    expect(run.rec.reroll()).toBe(true);
    expect(run.rec.log.commands.some((c) => c[1] === 'x')).toBe(true);
    run.advance(60 * 60 * 8);
    const log = run.finish();
    const again = replay(log);
    expect(again.steps).toBe(run.game.steps);
    expect(again.rerolls).toBe(run.game.rerolls);
    expect(stateHash(again)).toBe(stateHash(run.game));
  });

  it('the bots re-roll a hand with nothing they want (nothing held to level, none of their favourites), and their runs replay', () => {
    const g = toDraft({ quartermaster: 5 }).game;
    const you = PERSONAS.you;
    // A hand of nothing it likes, with a free slot: worth a re-roll.
    g.levels = {};
    g.slots = [];
    const top = you.taste.slice(0, PREFER_TOP);
    const dislike = ABILITY_ORDER.filter((id) => !top.includes(id)).slice(0, 3);
    g.offer = [...dislike];
    expect(rerollWorth(g, top)).toBe(true);
    expect(new Mimic(you, 1).wantsReroll(g)).toBe(true);
    // A favourite in the hand: no re-roll.
    g.offer = [top[0], ...dislike.slice(1)];
    expect(new Mimic(you, 1).wantsReroll(g)).toBe(false);
    // A weapon it holds, to level up: no re-roll.
    g.levels = { [dislike[0]]: 1 };
    g.slots = [dislike[0]];
    g.offer = [...dislike];
    expect(new Mimic(you, 1).wantsReroll(g)).toBe(false);
    // A whole run: re-rolls spent, and the log replays.
    let used = 0;
    let replayed = 0;
    for (const seed of [21, 22, 23, 24]) {
      const run = new BotRun('gauntlet', seed, { armory: { quartermaster: 5 } });
      run.advance(Infinity);
      const log = run.finish();
      used += run.game.stats.rerolls - run.game.rerolls;
      expect(log.commands.filter((c) => c[1] === 'x')).toHaveLength(run.game.stats.rerolls - run.game.rerolls);
      if (log.commands.some((c) => c[1] === 'x')) {
        expect(stateHash(replay(log))).toBe(stateHash(run.game));
        replayed++;
      }
    }
    expect(used).toBeGreaterThan(0);
    expect(replayed).toBeGreaterThan(0);
  });
});

describe('Salvage Crews', () => {
  it("adds 10% a level to the run's own Scrap, not to a repeat card's", () => {
    const t = { waves: 10, boss: 3 };
    const plain = scrapFor(t, true, false, 2);
    const five = scrapFor(t, true, false, 2, 5);
    const run = 10 * 40 + 3 * 50 + 150;
    expect(plain.salvage).toBe(0);
    expect(five.salvage).toBe(run / 2);
    expect(five.total).toBe(plain.total + run / 2);
    expect(scrapFor(t, true, false, 0, 1).salvage).toBe(Math.round(run * 0.1));
  });

  it('banks with the result: the level the run took', () => {
    const store: Record<string, string> = {};
    const prev = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v), removeItem: (k: string) => delete store[k] };
    try {
      const p = loadProgress();
      const r = recordResult(p, 'strait', { score: 1, wave: 5, cleared: false, wavesCleared: 4, waves: 4, boss: 0, salvage: 5 }, () => 0);
      expect(r.scrap.salvage).toBe(80);
      expect(p.scrap).toBe(r.scrap.total);
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = prev;
    }
  });
});

describe('an old save', () => {
  it('without the new ids loads them at level 0, everything else kept, and can equip them once found', () => {
    const store: Record<string, string> = {};
    const prev = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v), removeItem: (k: string) => delete store[k] };
    try {
      const armory = { reload: 5, warhead: 2, repair: 4, stockpile: 5, magazine: 3 };
      store['straitwatch.v3.progress'] = JSON.stringify({ unlocked: 3, best: {}, cards: 19, armory, equipped: { gun: 'reload', hull: 'repair', supply: 'stockpile' }, cleared: ['strait'], armoryV: ARMORY_VERSION, scrap: 640, scrapEarned: 3000, open: [], mapsV: 2 });
      const p = loadProgress();
      expect(p.armory).toMatchObject(armory);
      for (const id of NEW) expect(p.armory[id]).toBe(0);
      expect(runLoadout(p)).toEqual({ reload: 5, repair: 4, stockpile: 5 });
      expect([p.scrap, p.scrapEarned, p.cards]).toEqual([640, 3000, 19]);
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = prev;
    }
  });
});
