// The four new Armory upgrades (docs/design/v3-armory-overhaul.md, "The four
// new upgrades"): Boilers, Lifeboats (Hull), Quartermaster and Salvage Crews
// (Supply). Lifeboats and Quartermaster as reworked in log 44 ("Lifeboats
// and Quartermaster reworked").
import { describe, expect, it } from 'vitest';
import { ARMORY, ARMORY_MAX, ARMORY_ORDER, LIFE_CARD_EVERY, armoryStats, bayItems, levelCost, scrapFor } from '../../src/v3/data/armory';
import { MAPS } from '../../src/v3/data/maps';
import { RULES } from '../../src/v3/data/config';
import { ABILITY_MAX, ABILITY_ORDER } from '../../src/v3/data/abilities';
import {
  LIFE_LOW,
  addPickup,
  createGame,
  damageShip,
  freeLevelPick,
  freeLevelUp,
  goldBomb,
  goldBombWorth,
  lifeCardDue,
  lifeCardWorth,
  lossLimit,
  mendHulls,
  pickUpgrade,
  rerollDraft,
  rerollWorth,
  shipSpeed,
  shipsSunk,
  spawnThreat,
  step,
  tap,
  type Game,
} from '../../src/v3/sim/game';
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

/** Clear the wave in play at once (nothing left to come): the next step
 *  ends it. */
function clearWave(g: Game): void {
  g.queue = [];
  g.threats = [];
  g.raiderQueue = [];
  g.raiders = [];
  step(g, SIM_DT);
}

/** A game at the draft after `wave` (no picks made before it). */
function draftAt(armory: Parameters<typeof armoryStats>[0], wave: number, seed = 5): Game {
  const g = createGame('strait', seed, 1, undefined, armory);
  g.wave = wave;
  clearWave(g);
  expect(g.phase).toBe('draft');
  expect(g.wave).toBe(wave);
  return g;
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
      // Every level brings something new (no level repeats the one before,
      // as Deep Magazine's level 3 once did).
      for (let l = 1; l <= ARMORY_MAX; l++) expect(ARMORY[id].show(l), `${id} ${l}`).not.toBe(ARMORY[id].show(l - 1));
    }
  });

  it('with none of them, every number is as before', () => {
    const s = armoryStats({});
    expect([s.convoySpeed, s.steamTime, s.mendCarrier, s.mendShips, s.lifeCard, s.startLives, s.rerolls, s.draftCards, s.goldBombs, s.freeLevels, s.salvage]).toEqual([1, 1, 0, 0, 0, 0, 0, 3, 0, 0, 0]);
  });

  it('their numbers, level by level', () => {
    const at = (id: (typeof NEW)[number], f: keyof ReturnType<typeof armoryStats>) => [0, 1, 2, 3, 4, 5].map((l) => armoryStats({ [id]: l })[f]);
    expect(at('boilers', 'convoySpeed')).toEqual([1, 1.04, 1.08, 1.12, 1.16, 1.2]);
    expect(at('boilers', 'steamTime')).toEqual([1, 1, 1, 1, 1, 2]);
    // Lifeboats (log 44): repairs and lives take turns.
    expect(at('lifeboats', 'mendCarrier')).toEqual([0, 0.66, 0.66, 0.66, 1, 1]);
    expect(at('lifeboats', 'mendShips')).toEqual([0, 0, 0.66, 0.66, 1, 1]);
    expect(at('lifeboats', 'lifeCard')).toEqual([0, 0, 0, 3, 3, 3]);
    expect(at('lifeboats', 'startLives')).toEqual([0, 0, 0, 0, 0, 1]);
    // Quartermaster (log 44): the player's path, 1 / 2 re-rolls, a bomb, 3, then 4 cards and a free level-up.
    expect(at('quartermaster', 'rerolls')).toEqual([0, 1, 2, 2, 3, 3]);
    expect(at('quartermaster', 'goldBombs')).toEqual([0, 0, 0, 1, 1, 1]);
    expect(at('quartermaster', 'draftCards')).toEqual([3, 3, 3, 3, 3, 4]);
    expect(at('quartermaster', 'freeLevels')).toEqual([0, 0, 0, 0, 0, 1]);
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

describe('Lifeboats (reworked, log 44): mended hulls and extra lives, level by level', () => {
  /** A hurt convoy: the carrier at half, the first ship two points down,
   *  the second one point down. */
  function hurt(g: Game): void {
    withShips(g, 2);
    g.carrierHp = g.stats.carrierHp / 2;
    g.ships[0].hp = g.stats.shipHp - 2;
    g.ships[1].hp = g.stats.shipHp - 1;
  }
  const hulls = (g: Game) => [g.carrierHp, g.ships[0].hp, g.ships[1].hp];

  it('a ship sunk counts whole at every level (the half loss is gone)', () => {
    const g = createGame('strait', 9, 1, undefined, { lifeboats: 5 });
    withShips(g, 3);
    damageShip(g, g.ships[0], 99, 'drone');
    expect(shipsSunk(g)).toBe(1);
    expect('lossCredit' in g || 'boatsUsed' in g).toBe(false);
  });

  it('level 1 mends 66% of the carrier\'s missing hull between waves, not the ships', () => {
    const g = createGame('strait', 9, 1, undefined, { lifeboats: 1 });
    hurt(g);
    mendHulls(g);
    // 6 missing: +4 (66% of 6 is 3.96, a whole point each).
    expect(hulls(g)).toEqual([10, 1, 2]);
  });

  it('level 2 (and 3) mend the carrier and every ship 66%: a ship two down gets one, one down gets it', () => {
    for (const lv of [2, 3]) {
      const g = createGame('strait', 9, 1, undefined, { lifeboats: lv });
      hurt(g);
      mendHulls(g);
      expect(hulls(g), `level ${lv}`).toEqual([10, 2, 3]);
    }
  });

  it('level 4 (and 5) mend every hull to full', () => {
    for (const lv of [4, 5]) {
      const g = createGame('strait', 9, 1, undefined, { lifeboats: lv });
      hurt(g);
      mendHulls(g);
      expect(hulls(g), `level ${lv}`).toEqual([12, 3, 3]);
    }
  });

  it('the mend comes as a wave is cleared, and not without the card', () => {
    const at = (lifeboats: number) => {
      const g = createGame('strait', 9, 1, undefined, { lifeboats });
      hurt(g);
      clearWave(g);
      expect(g.phase).toBe('draft');
      return g.carrierHp;
    };
    expect(at(0)).toBe(6);
    expect(at(1)).toBe(10);
    expect(at(4)).toBe(12);
  });

  it('level 3: the Lifeboat card is dealt after every third wave, on top of the weapons, and on no other draft', () => {
    for (const wave of [1, 2, 3, 4, 5, 6, 9]) {
      const g = draftAt({ lifeboats: 3 }, wave);
      expect(g.offer.includes('lifeboat'), `wave ${wave}`).toBe(wave % LIFE_CARD_EVERY === 0);
      expect(g.offer.filter((id) => id === 'lifeboat').length).toBeLessThanOrEqual(1);
      expect(lifeCardDue(g)).toBe(wave % 3 === 0);
    }
    // Levels 1 and 2 never deal it.
    expect(draftAt({ lifeboats: 2 }, 3).offer).not.toContain('lifeboat');
  });

  it("the card moves no dice: the weapons dealt are the same game's without it, and the same on the same seed", () => {
    for (const seed of [3, 4, 5]) {
      const a = draftAt({ lifeboats: 3 }, 6, seed);
      const b = draftAt({ lifeboats: 3 }, 6, seed);
      const plain = draftAt({}, 6, seed);
      expect(a.offer).toEqual(b.offer);
      expect(a.offer.filter((id) => id !== 'lifeboat')).toEqual(plain.offer);
      expect(a.offer[a.offer.length - 1]).toBe('lifeboat');
    }
  });

  it('a re-roll deals the card again (one a draft)', () => {
    const g = draftAt({ lifeboats: 3, quartermaster: 2 }, 3);
    expect(rerollDraft(g)).toBe(true);
    expect(g.offer.filter((id) => id === 'lifeboat')).toHaveLength(1);
  });

  it('taking it is +1 life in place of a weapon: the run can lose one more ship, and the convoy restored keeps it', () => {
    const g = draftAt({ lifeboats: 3 }, 3);
    const levels = { ...g.levels };
    pickUpgrade(g, 'lifeboat');
    expect(g.phase).toBe('wave');
    expect(g.levels).toEqual(levels);
    expect(g.extraLives).toBe(1);
    expect(lossLimit(g)).toBe(RULES.shipLossLimit + 1);
    restoreConvoy(g);
    expect(g.extraLives).toBe(1);
    // Six sunk since the restore: still going; the seventh ends it.
    g.lost = g.lossBase + RULES.shipLossLimit;
    step(g, SIM_DT);
    expect(g.phase).toBe('wave');
    withShips(g, 1);
    damageShip(g, g.ships[0], 99, 'drone');
    step(g, SIM_DT);
    expect(g.phase).toBe('lost');
  });

  it('level 5 starts the run with one extra life; levels 1-4 with none', () => {
    expect(createGame('strait', 9, 1, undefined, { lifeboats: 5 }).extraLives).toBe(1);
    for (const lv of [0, 1, 2, 3, 4]) expect(createGame('strait', 9, 1, undefined, { lifeboats: lv }).extraLives).toBe(0);
  });

  it('the bots take the life when half their lives or fewer are left, a weapon otherwise', () => {
    const g = draftAt({ lifeboats: 3 }, 3);
    const you = new Mimic(PERSONAS.you, 1);
    expect(lifeCardWorth(g)).toBe(false);
    expect(you.choose(g).id).not.toBe('lifeboat');
    g.lost = RULES.shipLossLimit - LIFE_LOW;
    expect(lifeCardWorth(g)).toBe(true);
    expect(you.choose(g).id).toBe('lifeboat');
  });

  it("a bot run with Lifeboats 5 takes lives ('u' lifeboat), and its log replays to the same game", () => {
    let took = 0;
    for (const seed of [31, 32, 33, 34]) {
      const run = new BotRun('gauntlet', seed, { armory: { lifeboats: 5 } });
      run.advance(Infinity);
      const log = run.finish();
      const picks = log.commands.filter((c) => c[1] === 'u' && c[2] === 'lifeboat').length;
      took += picks;
      expect(run.game.extraLives).toBe(1 + picks);
      expect(stateHash(replay(log))).toBe(stateHash(run.game));
    }
    expect(took).toBeGreaterThan(0);
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
    const a = toDraft({ quartermaster: 2 }).game;
    const b = toDraft({ quartermaster: 2 }).game;
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

describe("Quartermaster's golden bomb (level 3+)", () => {
  /** A game in wave 2 with a few threats in the air. */
  function busy(qm: number): Game {
    const g = createGame('strait', 6, 2, undefined, { quartermaster: qm });
    for (let i = 0; i < 60 * 8; i++) step(g, SIM_DT);
    for (let k = 0; k < 4; k++) spawnThreat(g, 'drone', 300 + k * 120, 200, 'base');
    expect(g.threats.filter((t) => !t.dead).length).toBeGreaterThanOrEqual(4);
    return g;
  }

  it('none below level 3; one a run from level 3', () => {
    for (const [lv, n] of [[0, 0], [2, 0], [3, 1], [4, 1], [5, 1]]) expect(createGame('strait', 6, 1, undefined, { quartermaster: lv }).bombsLeft, `level ${lv}`).toBe(n);
    const g = busy(2);
    expect(goldBomb(g)).toBe(false);
  });

  it('it stays until used (waves and drafts go by), then fires the Nuke once: every threat down', () => {
    const g = createGame('strait', 6, 1, undefined, { quartermaster: 3 });
    clearWave(g);
    expect(g.phase).toBe('draft');
    expect(goldBomb(g)).toBe(false);
    expect(g.bombsLeft).toBe(1);
    const h = busy(3);
    expect(goldBomb(h)).toBe(true);
    step(h, SIM_DT);
    expect(h.threats.filter((t) => !t.dead && t.kind === 'drone')).toHaveLength(0);
    expect(h.bombsLeft).toBe(0);
    expect(goldBomb(h)).toBe(false);
  });

  it("is logged ('n') and the log replays to the same game", () => {
    const run = new BotRun('strait', 12, { armory: { quartermaster: 3 } });
    // Into wave 1 a while, threats up, then the player taps it.
    run.advance(60 * 20);
    expect(run.game.phase).toBe('wave');
    const used = run.game.bombsLeft;
    if (used) expect(run.rec.goldBomb()).toBe(true);
    expect(run.rec.log.commands.filter((c) => c[1] === 'n')).toHaveLength(1);
    expect(run.game.bombsLeft).toBe(0);
    run.advance(60 * 60 * 4);
    const log = run.finish();
    expect(stateHash(replay(log))).toBe(stateHash(run.game));
  });

  it('the bots set it off into a crowd near the ships, not into a quiet sea', () => {
    const g = busy(3);
    g.threats = [];
    expect(goldBombWorth(g)).toBe(false);
    let bombed = 0;
    for (const seed of [41, 42, 43, 44]) {
      const run = new BotRun('gauntlet', seed, { armory: { quartermaster: 3 } });
      run.advance(Infinity);
      const log = run.finish();
      bombed += log.commands.filter((c) => c[1] === 'n').length;
      expect(log.commands.filter((c) => c[1] === 'n').length).toBeLessThanOrEqual(1);
      expect(stateHash(replay(log))).toBe(stateHash(run.game));
    }
    expect(bombed).toBeGreaterThan(0);
  });
});

describe("Quartermaster's free level-up (level 5)", () => {
  it('once a run, a held weapon gains a level in a draft without spending the pick', () => {
    const g = toDraft({ quartermaster: 5 }).game;
    expect(g.freeLevelsLeft).toBe(1);
    const id = ABILITY_ORDER[0];
    g.levels = { [id]: 1 };
    g.slots = [id];
    const offer = [...g.offer];
    expect(freeLevelPick(g)).toBe(id);
    expect(freeLevelUp(g, id)).toBe(true);
    expect(g.levels[id]).toBe(2);
    expect(g.phase).toBe('draft');
    expect(g.offer).toEqual(offer);
    expect(g.freeLevelsLeft).toBe(0);
    expect(freeLevelUp(g, id)).toBe(false);
    expect(freeLevelPick(g)).toBeNull();
  });

  it('not a weapon not held, nor one at MAX, nor below level 5, nor in a wave', () => {
    const g = toDraft({ quartermaster: 5 }).game;
    const [a, b] = ABILITY_ORDER;
    g.levels = { [a]: ABILITY_MAX };
    g.slots = [a];
    expect(freeLevelUp(g, a)).toBe(false);
    expect(freeLevelUp(g, b)).toBe(false);
    expect(g.freeLevelsLeft).toBe(1);
    const four = toDraft({ quartermaster: 4 }).game;
    four.levels = { [b]: 1 };
    four.slots = [b];
    expect(freeLevelUp(four, b)).toBe(false);
    const w = createGame('strait', 3, 1, undefined, { quartermaster: 5 });
    w.levels = { [b]: 1 };
    w.slots = [b];
    expect(freeLevelUp(w, b)).toBe(false);
  });

  it("is logged ('l'), the bots use it on the weapon they stack, and the log replays", () => {
    let used = 0;
    for (const seed of [21, 22]) {
      const run = new BotRun('gauntlet', seed, { armory: { quartermaster: 5 } });
      run.advance(Infinity);
      const log = run.finish();
      const free = log.commands.filter((c) => c[1] === 'l');
      expect(free.length).toBeLessThanOrEqual(1);
      used += free.length;
      expect(stateHash(replay(log))).toBe(stateHash(run.game));
    }
    expect(used).toBe(2);
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
      // A save from log 40-43 holding the reworked cards keeps their ids and
      // levels: the levels now mean the new effects.
      store['straitwatch.v3.progress'] = JSON.stringify({ unlocked: 3, best: {}, cards: 19, armory: { ...armory, lifeboats: 5, quartermaster: 3 }, equipped: { gun: 'reload', hull: 'lifeboats', supply: 'quartermaster' }, cleared: ['strait'], armoryV: ARMORY_VERSION, scrap: 640, scrapEarned: 3000, open: [], mapsV: 2 });
      const q = loadProgress();
      expect(runLoadout(q)).toEqual({ reload: 5, lifeboats: 5, quartermaster: 3 });
      const s = armoryStats(runLoadout(q));
      expect([s.mendCarrier, s.startLives, s.rerolls, s.goldBombs]).toEqual([1, 1, 2, 1]);
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = prev;
    }
  });
});
