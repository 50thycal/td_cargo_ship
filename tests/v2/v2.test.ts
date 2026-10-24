// V2 headless tests: the rules of the game, end to end, with no browser.

import { describe, expect, it } from 'vitest';
import { BALLISTIC, FLOW_STEPS, INTERCEPTOR, RULES, SHIP } from '../../src/v2/data/config';
import { FORMATIONS } from '../../src/v2/data/formations';
import { MAP_ORDER } from '../../src/v2/data/maps';
import { UPGRADES, UPGRADE_ORDER, canTake } from '../../src/v2/data/upgrades';
import { waveSpec } from '../../src/v2/data/waves';
import { recordResult, type Progress } from '../../src/v2/platform/save';
import { Bot, runBot, SKILLS } from '../../src/v2/sim/bot';
import {
  CARRIER_TARGET,
  continueEndless,
  createGame,
  pickUpgrade,
  setFlow,
  setFormation,
  step,
  tap,
  type Game,
  type Threat,
} from '../../src/v2/sim/game';

const DT = 1 / 60;

function run(g: Game, seconds: number): void {
  for (let i = 0; i < seconds / DT && g.phase === 'wave'; i++) step(g, DT);
}

/** A game whose wave never launches anything (one launch parked far in the
 *  future keeps the wave open), so a test can place its own threats. */
function quietGame(seed = 1): Game {
  const g = createGame('strait', seed);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
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

describe('V2 simulation', () => {
  it('is deterministic for a seed', () => {
    const a = runBot('island', 42, SKILLS.average);
    const b = runBot('island', 42, SKILLS.average);
    expect(a).toEqual(b);
  });

  it('an idle player loses', () => {
    const g = createGame('strait', 7);
    for (let i = 0; i < 60 * 600 && g.phase !== 'lost'; i++) {
      if (g.phase === 'draft') pickUpgrade(g, g.offer[0]);
      step(g, DT);
    }
    expect(g.phase).toBe('lost');
    expect(g.lost >= RULES.shipLossLimit || g.carrierHp <= 0).toBe(true);
  });

  it('a sharp player clears the first map, and that unlocks the second', () => {
    const r = runBot('strait', 1000, SKILLS.sharp);
    expect(r.won).toBe(true);
    expect(r.wave).toBe(RULES.wavesToClear);
    const p: Progress = { unlocked: 1, best: {} };
    expect(recordResult(p, 'strait', r.score, r.wave, r.won)).toBe(true);
    expect(p.unlocked).toBe(2);
    expect(p.best.strait?.score).toBe(r.score);
  });

  it('maps get harder in order for the same player', () => {
    const avgWave = (map: (typeof MAP_ORDER)[number]) =>
      [1, 2, 3, 4, 5, 6].reduce((s, seed) => s + runBot(map, seed, SKILLS.casual).wave, 0);
    expect(avgWave('strait')).toBeGreaterThanOrEqual(avgWave('island'));
  });
});

describe('tapping', () => {
  it('fires at a threat, spends a round, and kills it', () => {
    const g = quietGame();
    const th = addThreat(g, { x: 800, y: 400 });
    const ammo = g.ammo;
    expect(tap(g, 805, 395, 30)).toBe('fire');
    expect(g.ammo).toBe(ammo - 1);
    run(g, 1.5);
    expect(th.dead).toBe(true);
    expect(g.kills.drone).toBe(1);
  });

  it('a tap on open water does nothing', () => {
    const g = quietGame();
    addThreat(g, { x: 800, y: 300 });
    expect(tap(g, 200, 600, 30)).toBe('empty');
    expect(g.interceptors).toHaveLength(0);
  });

  it('an empty rack is reported, not fired', () => {
    const g = quietGame();
    addThreat(g, { x: 800, y: 300 });
    g.ammo = 0;
    expect(tap(g, 800, 300, 30)).toBe('dry');
    expect(g.interceptors).toHaveLength(0);
  });

  it('repeated taps on a swarm spread across it', () => {
    const g = quietGame();
    const a = addThreat(g, { x: 800, y: 300 });
    const b = addThreat(g, { x: 812, y: 304 });
    tap(g, 801, 301, 40);
    tap(g, 801, 301, 40);
    expect(g.interceptors.map((i) => i.target).sort()).toEqual([a.id, b.id].sort());
  });

  it('collects a pickup instead of firing when it is closer', () => {
    const g = quietGame();
    addThreat(g, { x: 860, y: 300 });
    g.pickups.push({ id: g.nextId++, kind: 'ammo', x: 800, y: 300, age: 0 });
    g.ammo = 1;
    expect(tap(g, 800, 300, 40)).toBe('pickup');
    expect(g.ammo).toBe(g.stats.rack);
    expect(g.pickups).toHaveLength(0);
  });

  it('EMP clears every drone on screen', () => {
    const g = quietGame();
    for (let i = 0; i < 5; i++) addThreat(g, { x: 300 + i * 200, y: 250 });
    addThreat(g, { kind: 'guided', hp: 2, x: 700, y: 260 });
    g.pickups.push({ id: g.nextId++, kind: 'emp', x: 800, y: 600, age: 0 });
    tap(g, 800, 600, 30);
    step(g, DT);
    expect(g.threats.map((t) => t.kind)).toEqual(['guided']);
  });
});

describe('threats', () => {
  it('a ballistic missile splashes every ship inside its radius', () => {
    const g = quietGame();
    g.spawnT = 999;
    g.ships = [];
    const mk = (x: number, y: number) => {
      const s = { id: g.nextId++, x, y, hp: SHIP.hp, slot: 0, channel: 0, mult: 1 };
      g.ships.push(s);
      return s;
    };
    const near = mk(800, 470);
    const alsoNear = mk(800 + BALLISTIC.splash - 5, 470);
    const far = mk(800 + BALLISTIC.splash + 80, 470);
    addThreat(g, { kind: 'ballistic', sx: 800, sy: 100, ix: 800, iy: 470, dur: 0.05, apex: 10 });
    step(g, DT);
    step(g, DT);
    step(g, DT);
    step(g, DT);
    expect(near.hp).toBe(SHIP.hp - 2);
    expect(alsoNear.hp).toBe(SHIP.hp - 2);
    expect(far.hp).toBe(SHIP.hp);
  });

  it('a guided missile re-targets when its ship is gone', () => {
    const g = quietGame();
    g.spawnT = 999;
    g.ships = [
      { id: 900, x: 600, y: 470, hp: 3, slot: 0, channel: 0, mult: 1 },
      { id: 901, x: 900, y: 470, hp: 3, slot: 0, channel: 0, mult: 1 },
    ];
    const th = addThreat(g, { kind: 'guided', hp: 2, speed: 150, x: 800, y: 200, target: 999 });
    step(g, DT);
    expect([900, 901]).toContain(th.target);
  });

  it('losing the carrier ends the game', () => {
    const g = quietGame();
    g.carrierHp = 1;
    const c = g.map.carrier;
    addThreat(g, { x: c.x, y: c.y - 30, speed: 200, target: CARRIER_TARGET });
    run(g, 2);
    expect(g.phase).toBe('lost');
  });

  it('the wave table only gets harder, and endless keeps growing', () => {
    for (let w = 2; w <= 14; w++) {
      const a = waveSpec(w - 1);
      const b = waveSpec(w);
      expect(b.drones + b.ballistic + b.guided).toBeGreaterThanOrEqual(a.drones + a.ballistic + a.guided);
      expect(b.speed).toBeGreaterThanOrEqual(a.speed);
    }
    expect(waveSpec(1).ballistic + waveSpec(1).guided).toBe(0);
    expect(waveSpec(20).speed).toBeLessThanOrEqual(1.8);
  });
});

describe('rails: flow and formations', () => {
  it('the flow slider sets the score multiplier a ship carries home', () => {
    const g = quietGame();
    setFlow(g, FLOW_STEPS.length - 1);
    g.ships = [];
    g.spawnT = 0;
    step(g, DT);
    expect(g.ships.every((s) => s.mult === FLOW_STEPS[FLOW_STEPS.length - 1].mult)).toBe(true);
    const before = g.score;
    g.ships.forEach((s) => (s.x = 1640));
    g.spawnT = 999;
    step(g, DT);
    expect(g.score - before).toBe(SHIP.points * FLOW_STEPS[FLOW_STEPS.length - 1].mult * 2);
  });

  it('more flow means more ships per minute', () => {
    const count = (flow: number) => {
      const g = quietGame();
      setFlow(g, flow);
      run(g, 30);
      return g.ships.length + g.delivered;
    };
    expect(count(4)).toBeGreaterThan(count(0) * 3);
  });

  it('changing formation mid-wave moves ships into the new lanes', () => {
    const g = quietGame();
    setFormation(g, 'column');
    run(g, 25);
    const ch = g.map.channels[0];
    expect(g.ships.length).toBeGreaterThan(2);
    expect(g.ships.every((s) => Math.abs(s.y - ch.y) < 2)).toBe(true);
    setFormation(g, 'spread');
    run(g, 4);
    const lanes = new Set(g.ships.map((s) => Math.round((s.y - ch.y) / ch.halfWidth / 0.8)));
    expect(lanes).toEqual(new Set([-1, 0, 1]));
    expect(FORMATIONS.spread.offsets).toHaveLength(3);
  });
});

describe('waves and upgrades', () => {
  it('clearing a wave deals 3 different cards; picking one starts the next wave', () => {
    const g = createGame('strait', 3);
    const bot = new Bot(SKILLS.sharp);
    for (let i = 0; i < 60 * 120 && g.phase === 'wave'; i++) {
      bot.act(g);
      step(g, DT);
    }
    expect(g.phase).toBe('draft');
    expect(new Set(g.offer).size).toBe(3);
    const pick = g.offer[0];
    pickUpgrade(g, pick);
    expect(g.levels[pick]).toBe(1);
    expect(g.phase).toBe('wave');
    expect(g.wave).toBe(2);
  });

  it('maxed cards are never offered again', () => {
    const g = createGame('strait', 5);
    for (const id of UPGRADE_ORDER) g.levels[id] = UPGRADES[id].max;
    g.levels.rack = UPGRADES.rack.max - 1;
    g.queue = [];
    g.threats = [];
    step(g, DT);
    expect(g.phase).toBe('draft');
    expect(g.offer).toEqual(['rack']);
  });

  it('a bigger rack is loaded immediately', () => {
    const g = createGame('strait', 5);
    g.phase = 'draft';
    g.offer = ['rack'];
    const before = g.ammo;
    pickUpgrade(g, 'rack');
    expect(g.stats.rack).toBe(INTERCEPTOR.rack + 3);
    expect(g.ammo).toBe(before + 3);
  });

  it('twin launch sends a free second interceptor', () => {
    const g = quietGame();
    g.levels.twin = 1;
    g.stats = { ...g.stats, freeExtras: 1 };
    addThreat(g, { kind: 'guided', hp: 2, x: 800, y: 300 });
    const ammo = g.ammo;
    tap(g, 800, 300, 30);
    expect(g.interceptors).toHaveLength(2);
    expect(g.ammo).toBe(ammo - 1);
  });

  it('beating the last wave clears the map; endless continues with a draft', () => {
    const g = createGame('strait', 9, RULES.wavesToClear);
    g.queue = [];
    step(g, DT);
    expect(g.phase).toBe('won');
    expect(g.cleared).toBe(true);
    continueEndless(g);
    expect(g.phase).toBe('draft');
    pickUpgrade(g, g.offer.find((id) => canTake(g.levels, id))!);
    expect(g.wave).toBe(RULES.wavesToClear + 1);
    expect(g.endless).toBe(true);
  });
});

describe('ballistic arcs stay tappable', () => {
  it('no ballistic flight ever leaves the top of the screen, on any map', () => {
    for (const map of MAP_ORDER) {
      const g = createGame(map, 21, 9);
      let top = Infinity;
      for (let i = 0; i < 60 * 60 && g.phase === 'wave'; i++) {
        step(g, DT);
        for (const th of g.threats) if (th.kind === 'ballistic') top = Math.min(top, th.y);
      }
      expect(top).toBeGreaterThanOrEqual(BALLISTIC.ceiling - 1);
    }
  });
});

describe('station keeping', () => {
  it('no two hulls ever overlap, through every formation switch at max flow', () => {
    const overlaps = (g: Game) => {
      let n = 0;
      const s = g.ships;
      for (let i = 0; i < s.length; i++)
        for (let j = i + 1; j < s.length; j++)
          if (Math.abs(s[i].x - s[j].x) < 64 && Math.abs(s[i].y - s[j].y) < 18) n++;
      return n;
    };
    const ids = Object.keys(FORMATIONS) as (keyof typeof FORMATIONS)[];
    for (const map of ['strait', 'gauntlet', 'harbor'] as const) {
      for (const from of ids) {
        for (const to of ids) {
          if (from === to) continue;
          const g = createGame(map, 4);
          g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
          setFlow(g, FLOW_STEPS.length - 1);
          setFormation(g, from);
          run(g, 30);
          setFormation(g, to);
          let worst = 0;
          for (let i = 0; i < 60 * 8; i++) {
            step(g, DT);
            worst = Math.max(worst, overlaps(g));
          }
          expect(worst, `${map} ${from} -> ${to}`).toBe(0);
        }
      }
    }
  });
});

describe('shore battery', () => {
  it('fires from its own rack when it is nearer, and covers for an empty carrier', () => {
    const g = quietGame();
    g.phase = 'draft';
    g.offer = ['battery'];
    pickUpgrade(g, 'battery');
    g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    expect(g.batteryAmmo).toBe(4);
    const b = g.map.battery;
    // Nearer to the battery: the battery fires and spends its own round.
    const carrierAmmo = g.ammo;
    addThreat(g, { x: b.x + 40, y: b.y - 200 });
    tap(g, b.x + 40, b.y - 200, 30);
    expect(g.batteryAmmo).toBe(3);
    expect(g.ammo).toBe(carrierAmmo);
    expect(g.interceptors[0].x).toBe(b.x);
    // Carrier dry: a threat right over the carrier is still answered, by the battery.
    g.ammo = 0;
    const c = g.map.carrier;
    addThreat(g, { x: c.x, y: c.y - 150 });
    expect(tap(g, c.x, c.y - 150, 30)).toBe('fire');
    expect(g.batteryAmmo).toBe(2);
    expect(g.interceptors[1].x).toBe(b.x);
  });
});

describe('progression details', () => {
  it('skipping to a late wave hands over the cards a player would have drafted', () => {
    const g = createGame('strait', 3, 7);
    const picked = Object.values(g.levels).reduce((a, b) => a + (b ?? 0), 0);
    expect(g.wave).toBe(7);
    // Six drafts; a draft with nothing takeable (a Resupply) adds no level.
    expect(picked).toBeGreaterThanOrEqual(4);
    expect(picked).toBeLessThanOrEqual(6);
    expect(Object.keys(g.levels).length).toBeLessThanOrEqual(3);
    expect(g.ammo).toBe(g.stats.rack);
  });

  it('a scoreless first run is not a "new best", but still records the wave reached', () => {
    const p: Progress = { unlocked: 1, best: {} };
    expect(recordResult(p, 'strait', 0, 3, false)).toBe(false);
    expect(p.best.strait).toEqual({ score: 0, wave: 3 });
    expect(recordResult(p, 'strait', 500, 2, false)).toBe(true);
    expect(p.best.strait).toEqual({ score: 500, wave: 3 });
  });

  it('records which threat sank each ship', () => {
    const g = quietGame();
    g.spawnT = 999;
    g.ships = [{ id: 950, x: 800, y: 470, hp: 1, slot: 0, channel: 0, mult: 1 }];
    addThreat(g, { kind: 'drone', x: 800, y: 460, speed: 70, target: 950 });
    step(g, DT);
    expect(g.sunkBy.drone).toBe(1);
    expect(Object.values(g.sunkBy).reduce((a, b) => a + b, 0)).toBe(1);
  });
});

describe('playtest logs', () => {
  it('a recorded game replays exactly from its seed and inputs', async () => {
    const { Recorder, replay } = await import('../../src/v2/sim/playlog');
    const g = createGame('island', 77);
    const rec = new Recorder(g, {
      build: 'test',
      startedAt: '2026-01-01T00:00:00.000Z',
      firstWave: 1,
      device: { w: 844, h: 390, dpr: 2, touch: true, ua: 'test' },
    });
    // A scripted, imperfect player: taps a threat every 20 steps (sometimes
    // wide), changes flow and formation, takes the first card each draft.
    for (let i = 0; i < 60 * 60 * 6 && g.phase !== 'lost'; i++) {
      if (g.phase === 'draft') rec.pick(g.offer[0]);
      if (g.phase === 'won') break;
      if (i % 20 === 0 && g.threats.length) {
        const t = g.threats[(i / 20) % g.threats.length];
        rec.tap(t.x + (i % 60 === 0 ? 90 : 3), t.y - 2, 40);
      }
      if (i === 900) rec.flow(3);
      if (i === 1800) rec.formation('spread');
      if (i === 2700) rec.flow(1);
      step(g, DT);
    }
    const log = rec.finish(g.phase === 'lost' ? 'lost' : 'quit');
    expect(log.commands.length).toBeGreaterThan(100);
    expect(log.summary!.waves.length).toBeGreaterThan(2);

    const r = replay(JSON.parse(JSON.stringify(log)));
    expect(r.steps).toBe(g.steps);
    expect(r.score).toBe(g.score);
    expect(r.lost).toBe(g.lost);
    expect(r.wave).toBe(g.wave);
    expect(r.kills).toEqual(g.kills);
    expect(r.taps).toEqual(g.taps);
    expect(r.history).toEqual(g.history);
  });
});

describe('three-slot loadout', () => {
  it('a full loadout cannot take a new card, only level up its own', async () => {
    const { MAX_SLOTS, canTake, loadout } = await import('../../src/v2/data/upgrades');
    const g = createGame('strait', 5);
    g.levels = { rack: 1, speed: 1, twin: 1 };
    expect(loadout(g.levels)).toHaveLength(MAX_SLOTS);
    expect(canTake(g.levels, 'blast')).toBe(false);
    expect(canTake(g.levels, 'rack')).toBe(true);
    g.phase = 'draft';
    g.offer = ['blast', 'rack', 'ciws'];
    pickUpgrade(g, 'blast');
    expect(g.levels.blast).toBeUndefined();
    expect(g.phase).toBe('draft');
    pickUpgrade(g, 'rack');
    expect(g.levels.rack).toBe(2);
    expect(g.phase).toBe('wave');
  });

  it('a draft with nothing takeable offers Resupply, which repairs and refills', async () => {
    const g = createGame('strait', 6);
    g.levels = { rack: 3, speed: 3, twin: 2 }; // full and all maxed
    g.queue = [];
    g.threats = [];
    g.carrierHp = 4;
    g.ammo = 0;
    step(g, DT);
    expect(g.phase).toBe('draft');
    expect(g.offer).toContain('resupply');
    pickUpgrade(g, 'resupply');
    expect(g.carrierHp).toBe(12);
    expect(g.ammo).toBe(g.stats.rack);
    expect(Object.keys(g.levels)).toHaveLength(3);
  });

  it('over many drafts a full loadout sometimes gets an upgrade and sometimes not', async () => {
    const { canTake } = await import('../../src/v2/data/upgrades');
    let upgradable = 0;
    const N = 300;
    for (let seed = 1; seed <= N; seed++) {
      const g = createGame('strait', seed);
      g.levels = { rack: 1, hold: 1, blast: 1 };
      g.queue = [];
      g.threats = [];
      step(g, DT);
      if (g.offer.some((id) => id !== 'resupply' && canTake(g.levels, id))) upgradable++;
    }
    // 3 of 11 cards owned: about two drafts in three show one of them.
    expect(upgradable / N).toBeGreaterThan(0.55);
    expect(upgradable / N).toBeLessThan(0.8);
  });
});

describe('new threat types', () => {
  const shipAt = (g: Game, id: number, x: number, y: number) => {
    const s = { id, x, y, hp: SHIP.hp, slot: 0, channel: 0, mult: 1 };
    g.ships.push(s);
    return s;
  };

  it('a supersonic sits on its rail while its lock line shows, then is fast', async () => {
    const { SUPERSONIC, THREATS } = await import('../../src/v2/data/config');
    const g = quietGame();
    g.spawnT = 999;
    g.ships = [];
    shipAt(g, 700, 900, 470);
    const th = addThreat(g, { kind: 'supersonic', x: 800, y: 100, speed: THREATS.supersonic.speed, target: 700 });
    run(g, SUPERSONIC.arming * 0.8);
    expect(Math.hypot(th.x - 800, th.y - 100)).toBeLessThan(1);
    run(g, SUPERSONIC.arming * 0.4 + 0.3);
    expect(Math.hypot(th.x - 800, th.y - 100)).toBeGreaterThan(80);
  });

  it('a heavy missile takes four hits and its splash hurts the ships around its target', async () => {
    const { HEAVY } = await import('../../src/v2/data/config');
    const g = quietGame();
    const th = addThreat(g, { kind: 'heavy', hp: 4, x: 800, y: 300, speed: 0 });
    for (let k = 0; k < 3; k++) {
      tap(g, 800, 300, 30);
      run(g, 1.2);
    }
    expect(th.dead).toBe(false);
    expect(th.hp).toBe(1);
    // Now let one through onto a pair of ships.
    const g2 = quietGame();
    g2.spawnT = 999;
    g2.ships = [];
    const a = shipAt(g2, 801, 800, 470);
    const b = shipAt(g2, 802, 800 + HEAVY.splash - 10, 470);
    addThreat(g2, { kind: 'heavy', hp: 5, x: 800, y: 455, speed: 55, target: 801 });
    run(g2, 0.5);
    expect(g2.ships.includes(a)).toBe(false);
    expect(b.hp).toBe(SHIP.hp - HEAVY.splashDamage);
    expect(g2.sunkBy.heavy).toBe(1);
  });

  it('a cluster splits into bomblets near its target; the bomblets are blamed on it', async () => {
    const { CLUSTER } = await import('../../src/v2/data/config');
    const g = quietGame();
    g.spawnT = 999;
    g.ships = [];
    for (let k = 0; k < 3; k++) shipAt(g, 900 + k, 760 + k * 70, 470);
    for (const s of g.ships) s.hp = 1;
    addThreat(g, { kind: 'cluster', x: 800, y: 470 - CLUSTER.splitRange - 40, speed: 170, target: 900 });
    run(g, 0.5);
    expect(g.threats.filter((t) => t.kind === 'bomblet')).toHaveLength(CLUSTER.bomblets);
    expect(g.threats.every((t) => t.kind !== 'cluster')).toBe(true);
    run(g, 3);
    expect(g.sunkBy.cluster).toBeGreaterThan(0);
    expect(g.sunkBy.bomblet).toBe(0);
  });

  it('a mothership drops mini-drones on a timer until it is shot down', async () => {
    const { MOTHERSHIP } = await import('../../src/v2/data/config');
    const g = quietGame();
    const ms = addThreat(g, { kind: 'mothership', hp: 5, x: 200, y: 200, speed: 38, spawnT: MOTHERSHIP.spawnEvery });
    run(g, MOTHERSHIP.spawnEvery * 2 + 0.1);
    expect(g.threats.filter((t) => t.kind === 'minidrone' && t.parent === 'mothership')).toHaveLength(2);
    ms.hp = 1;
    tap(g, ms.x, ms.y, 40);
    run(g, 1.5);
    expect(ms.dead).toBe(true);
    const before = g.threats.filter((t) => t.kind === 'minidrone').length + g.kills.minidrone;
    run(g, MOTHERSHIP.spawnEvery * 2);
    expect(g.threats.filter((t) => t.kind === 'minidrone').length + g.kills.minidrone).toBeLessThanOrEqual(before);
  });

  it('map extras launch on schedule: the Island fields supersonics from wave 4', () => {
    expect(createGame('island', 4, 3).queue.some((l) => l.kind === 'supersonic')).toBe(false);
    const g = createGame('island', 4, 4);
    expect(g.queue.some((l) => l.kind === 'supersonic')).toBe(true);
    const s = createGame('strait', 4, 9);
    expect(s.queue.every((l) => ['drone', 'ballistic', 'guided'].includes(l.kind))).toBe(true);
  });
});
