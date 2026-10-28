// V2 headless tests: the rules of the game, end to end, with no browser.

import { describe, expect, it } from 'vitest';
import { BALLISTIC, CARRIER, FLOW_STEPS, INTERCEPTOR, RULES, SHIP } from '../../src/v2/data/config';
import { FORMATIONS } from '../../src/v2/data/formations';
import { MAP_ORDER, halfWidthAt } from '../../src/v2/data/maps';
import { UPGRADES, UPGRADE_ORDER, canTake, stats } from '../../src/v2/data/upgrades';
import { waveSpec } from '../../src/v2/data/waves';
import { recordResult, type Progress } from '../../src/v2/platform/save';
import { Bot, runBot, SKILLS } from '../../src/v2/sim/bot';
import {
  CARRIER_TARGET,
  continueEndless,
  createGame,
  pickUpgrade,
  raidWarning,
  setFlow,
  setFormation,
  shipSpeed,
  step,
  tap,
  type Game,
  type Threat,
} from '../../src/v2/sim/game';

const DT = 1 / 60;
const PICKUPS_OD = 5;
const shipSpeedOf = (g: Game) => shipSpeed({ ...g, steamT: 0 } as Game);

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
  it('a ballistic missile hits its ship in full and splashes the others inside its radius', () => {
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
    expect(alsoNear.hp).toBe(SHIP.hp - BALLISTIC.spill);
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
    g.levels.reload = UPGRADES.reload.max - 1;
    g.queue = [];
    g.threats = [];
    g.raiderQueue = [];
    step(g, DT);
    expect(g.phase).toBe('draft');
    expect(g.offer).toEqual(['reload']);
  });

  it('Quick Reload level 2 grows the rack (Bigger Rack folded in), loaded at once', () => {
    const g = createGame('strait', 5);
    g.levels = { reload: 1 };
    g.stats = stats(g.levels);
    expect(g.stats.rack).toBe(INTERCEPTOR.rack + 1);
    g.phase = 'draft';
    g.offer = ['reload'];
    const before = g.ammo;
    pickUpgrade(g, 'reload');
    expect(g.stats.rack).toBe(INTERCEPTOR.rack + 2);
    expect(g.ammo).toBe(before + 1);
    expect(stats({ reload: 3 }).rack).toBe(INTERCEPTOR.rack + 3);
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
    g.raiderQueue = [];
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

describe('escort frigate', () => {
  const withFrigate = (level = 1) => {
    const g = quietGame();
    g.phase = 'draft';
    g.offer = ['frigate'];
    pickUpgrade(g, 'frigate');
    if (level === 2) {
      g.phase = 'draft';
      g.offer = ['frigate'];
      pickUpgrade(g, 'frigate');
    }
    g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    g.raiderQueue = [];
    return g;
  };

  it('sails in from the left edge to its station, and only fires once on screen', () => {
    const g = withFrigate();
    const f = g.frigate!;
    expect(f.x).toBeLessThan(0);
    expect(f.ammo).toBe(0); // level 1 has no rack of its own
    // Off screen it cannot take a tap even when it is nearer.
    g.ammo = 0;
    addThreat(g, { x: 60, y: f.y - 150, speed: 0 });
    expect(tap(g, 60, f.y - 150, 30)).toBe('dry');
    g.threats = [];
    run(g, 8);
    expect(g.frigate!.x).toBeCloseTo(g.map.frigate.x, 0);
  });

  it('on maps where it stations past the carrier, it enters from the right and never crosses the carrier', () => {
    for (const map of ['gauntlet', 'archipelago'] as const) {
      const g = createGame(map, 1);
      g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
      g.raiderQueue = [];
      g.phase = 'draft';
      g.offer = ['frigate'];
      pickUpgrade(g, 'frigate');
      g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
      g.raiderQueue = [];
      const c = g.map.carrier;
      expect(g.frigate!.x).toBeGreaterThan(1600);
      for (let i = 0; i < 60 * 10; i++) {
        step(g, DT);
        expect(g.frigate!.x - c.x).toBeGreaterThan(CARRIER.halfLength + 50);
      }
      expect(g.frigate!.x).toBeCloseTo(g.map.frigate.x, 0);
    }
  });

  it('level 1 launches from the frigate when it is nearer, using the carrier\'s rack (round 6 audit)', () => {
    const g = withFrigate();
    run(g, 8);
    const f = g.frigate!;
    const carrierAmmo = g.ammo;
    addThreat(g, { x: f.x - 60, y: f.y - 200, speed: 0 });
    expect(tap(g, f.x - 60, f.y - 200, 30)).toBe('fire');
    expect(g.interceptors[0].x).toBe(f.x + 8);
    expect(g.ammo).toBe(carrierAmmo - 1);
    // No rack of its own: with the carrier dry, it can't fire either.
    g.ammo = 0;
    addThreat(g, { x: f.x - 40, y: f.y - 150, speed: 0 });
    expect(tap(g, f.x - 40, f.y - 150, 30)).toBe('dry');
  });

  it('level 2 adds its own 2-round rack, spent first, and covers for an empty carrier', () => {
    const g = withFrigate(2);
    run(g, 8);
    const f = g.frigate!;
    expect(f.ammo).toBe(2);
    const carrierAmmo = g.ammo;
    addThreat(g, { x: f.x - 60, y: f.y - 200, speed: 0 });
    tap(g, f.x - 60, f.y - 200, 30);
    expect(g.frigate!.ammo).toBe(1);
    expect(g.ammo).toBe(carrierAmmo);
    g.ammo = 0;
    const c = g.map.carrier;
    addThreat(g, { x: c.x, y: c.y - 150, speed: 0 });
    expect(tap(g, c.x, c.y - 150, 30)).toBe('fire');
    expect(g.frigate!.ammo).toBe(0);
  });

  it('has a station on every map, in open water clear of the carrier', async () => {
    const { MAPS } = await import('../../src/v2/data/maps');
    for (const m of Object.values(MAPS)) {
      const st = m.frigate;
      expect(Math.abs(st.x - m.carrier.x)).toBeGreaterThan(CARRIER.halfLength + 50);
      // Clear of every sub spot (a sub surfacing on the frigate would hide both).
      for (const sp of m.subSpots) expect(Math.hypot(sp.x - st.x, sp.y - st.y), `${m.id} sub spot ${sp.x}`).toBeGreaterThan(120);
      for (const ch of m.channels) expect(Math.abs(ch.y - st.y)).toBeGreaterThan(halfWidthAt(ch, st.x) + 15);
    }
  });

  it('once on station it stays put, whatever the threats do (round 5: it read as jumpy)', () => {
    for (const level of [1, 2]) {
      const g = withFrigate(level);
      run(g, 8);
      const st = g.map.frigate;
      expect(g.frigate!.x).toBe(st.x);
      const c = g.map.carrier;
      addThreat(g, { x: c.x, y: c.y - 300, speed: 0 });
      addThreat(g, { x: 100, y: 200, speed: 0 });
      for (let i = 0; i < 60 * 10; i++) {
        step(g, DT);
        expect(g.frigate!.x).toBe(st.x);
        expect(g.frigate!.vx).toBe(0);
      }
    }
  });

  it('eases to a stop as it arrives (no overshoot)', () => {
    const g = withFrigate();
    const st = g.map.frigate;
    let prev = Infinity;
    for (let i = 0; i < 60 * 9; i++) {
      step(g, DT);
      const gap = Math.abs(st.x - g.frigate!.x);
      expect(gap).toBeLessThanOrEqual(prev);
      prev = gap;
    }
    expect(prev).toBe(0);
  });

  it('its own rack reloads slower than the carrier\'s', () => {
    expect(stats({ frigate: 2 }).frigateRack).toBe(2);
    expect(stats({ frigate: 1 }).frigateRack).toBe(0);
    expect(stats({ frigate: 2 }).frigateReloadMult).toBeGreaterThan(1);
  });

  it('leaves when swapped out', () => {
    const g = withFrigate();
    g.levels = { ...g.levels, speed: 1, twin: 1 };
    g.stats = stats(g.levels);
    g.phase = 'draft';
    g.offer = ['blast'];
    pickUpgrade(g, 'blast', 'frigate');
    expect(g.frigate).toBeNull();
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

  it('a save taken at a wave end replays to that point, and later play does not leak into it', async () => {
    const { Recorder, replay } = await import('../../src/v2/sim/playlog');
    const g = createGame('strait', 31);
    const rec = new Recorder(g, {
      build: 'test',
      startedAt: '2026-01-01T00:00:00.000Z',
      firstWave: 1,
      device: { w: 844, h: 390, dpr: 2, touch: true, ua: 'test' },
    });
    const saves: ReturnType<typeof rec.snapshot>[] = [];
    const at: { steps: number; score: number; lost: number }[] = [];
    for (let i = 0; i < 60 * 60 * 5 && g.phase !== 'lost' && g.phase !== 'won'; i++) {
      if (g.phase === 'draft') {
        // What the app does when the draft opens: save, then the player picks.
        saves.push(rec.snapshot());
        at.push({ steps: g.steps, score: g.score, lost: g.lost });
        rec.pick(g.offer.find((id) => id === 'resupply' || canTake(g.levels, id))!);
      }
      if (i % 15 === 0 && g.threats.length) rec.tap(g.threats[0].x, g.threats[0].y, 40);
      step(g, DT);
    }
    expect(saves.length).toBeGreaterThan(1);
    const first = saves[0];
    expect(first.end).toBeUndefined();
    expect(first.summary!.steps).toBe(at[0].steps);
    // Inputs after the save are not in it.
    expect(first.commands.every((c) => c[0] <= at[0].steps)).toBe(true);
    expect(first.commands.length).toBeLessThan(rec.log.commands.length);
    for (const [k, save] of saves.entries()) {
      const r = replay(JSON.parse(JSON.stringify(save)));
      expect(r.phase).toBe('draft');
      expect({ steps: r.steps, score: r.score, lost: r.lost }).toEqual(at[k]);
    }
  });
});

describe('round 3: raids and carrier strikes', () => {
  it('launches bunch into raids instead of a steady trickle', async () => {
    const { RAID } = await import('../../src/v2/data/config');
    const g = createGame('strait', 12, 8);
    const times = g.queue.map((l) => l.at);
    // Busiest RAID.window-second stretch vs what an even spread would give.
    let busiest = 0;
    for (const t0 of times) busiest = Math.max(busiest, times.filter((t) => t >= t0 && t < t0 + RAID.window).length);
    const even = (times.length * RAID.window) / waveSpec(8, g.map.threatScale).duration;
    expect(busiest).toBeGreaterThan(even * 1.8);
  });

  it('missiles start going for the carrier from wave 3', () => {
    const aimedAtCarrier = (wave: number) => {
      let n = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const g = createGame('strait', seed, wave);
        for (let i = 0; i < 60 * 40; i++) {
          step(g, DT);
          n += g.threats.filter((t) => t.kind !== 'drone' && t.target === CARRIER_TARGET && t.age < DT * 1.5).length;
        }
      }
      return n;
    };
    // Before wave 3 only the no-ship-in-reach fallback aims at the carrier.
    const early = aimedAtCarrier(2);
    const later = aimedAtCarrier(4);
    expect(early).toBeLessThanOrEqual(2);
    expect(later).toBeGreaterThan(early + 5);
  });

});

describe('round 4 roster', () => {
  it('has no turret defences and no folded-in cards', () => {
    for (const gone of ['ciws', 'rack', 'retarget', 'battery']) expect(UPGRADE_ORDER).not.toContain(gone);
    expect(stats({}).rack).toBe(6); // Bigger Rack is gone: one more round as standard
  });

  it('a slow hold-to-fire is free; the card speeds it up', async () => {
    const { HOLD_FREE } = await import('../../src/v2/data/upgrades');
    expect(stats({}).holdRepeat).toBe(HOLD_FREE);
    expect(stats({ hold: 1 }).holdRepeat).toBeLessThan(HOLD_FREE);
    expect(stats({ hold: 2 }).holdRepeat).toBeLessThan(stats({ hold: 1 }).holdRepeat);
  });

  it('Twin Launch L2 re-aims an interceptor whose target died at a threat close by (Auto-Retarget folded in)', () => {
    const play = (twin: number) => {
      const g = quietGame();
      g.levels = { twin };
      g.stats = stats(g.levels);
      // Both interceptors commit to a 2-hit target that dies just before they
      // arrive; another threat sits close by (inside the 150 px re-aim reach).
      const a = addThreat(g, { kind: 'guided', hp: 2, x: 800, y: 250, speed: 0 });
      const b = addThreat(g, { x: 880, y: 260, speed: 0 });
      tap(g, 800, 250, 30);
      run(g, 0.7);
      a.dead = true;
      g.threats = g.threats.filter((t) => !t.dead);
      run(g, 2);
      return b.dead || b.hp < 1;
    };
    expect(play(1)).toBe(false);
    expect(play(2)).toBe(true);
  });

  it('Twin Launch extras only go at the tapped threat, and only if it can take them (round 6 audit)', () => {
    const g = quietGame();
    g.levels = { twin: 3 };
    g.stats = stats(g.levels);
    // A drone (1 hit) gets no free extra, and nothing spreads to its neighbours.
    const d = addThreat(g, { x: 800, y: 300, speed: 0 });
    addThreat(g, { x: 860, y: 300, speed: 0 });
    addThreat(g, { x: 740, y: 300, speed: 0 });
    tap(g, 800, 300, 30);
    expect(g.interceptors).toHaveLength(1);
    expect(g.interceptors[0].target).toBe(d.id);
    // A 2-hit guided missile gets exactly one extra; a heavy gets two.
    const gm = addThreat(g, { kind: 'guided', hp: 2, x: 500, y: 300, speed: 0 });
    tap(g, 500, 300, 30);
    expect(g.interceptors.filter((i) => i.target === gm.id)).toHaveLength(2);
    const hv = addThreat(g, { kind: 'heavy', hp: 8, x: 1100, y: 300, speed: 0 });
    tap(g, 1100, 300, 30);
    expect(g.interceptors.filter((i) => i.target === hv.id)).toHaveLength(3);
  });

  it('every draft offers at least one firepower card', async () => {
    const { FIREPOWER } = await import('../../src/v2/data/upgrades');
    for (let seed = 1; seed <= 200; seed++) {
      const g = createGame('strait', seed);
      g.queue = [];
      g.threats = [];
      g.raiderQueue = [];
      step(g, DT);
      expect(g.offer.some((id) => FIREPOWER.includes(id)), `seed ${seed}: ${g.offer}`).toBe(true);
    }
  });

  it('Radar flags raids and aircraft 1.5 s sooner', async () => {
    const { RAID } = await import('../../src/v2/data/config');
    const g = createGame('strait', 12, 6);
    const raid = g.raids[0];
    g.waveT = raid.at - RAID.warn - 1;
    expect(raidWarning(g)).toBeNull();
    g.levels = { radar: 1 };
    g.stats = stats(g.levels);
    expect(raidWarning(g)).not.toBeNull();
  });
});

describe('formations and raid themes', () => {
  const lone = (formation: 'column' | 'pairs' | 'spread' | 'box', over: Partial<Threat>) => {
    const g = quietGame();
    g.spawnT = 999;
    g.ships = [];
    setFormation(g, formation);
    const s = { id: 900, x: 700, y: 470, hp: SHIP.hp, slot: 0, channel: 0, mult: 1 };
    g.ships.push(s);
    addThreat(g, { x: 690, y: 470, speed: 1, target: 900, ...over });
    run(g, 0.5);
    return s;
  };

  it('Box armour blunts a guided hit; nothing blunts a heavy', () => {
    expect(lone('pairs', { kind: 'guided' }).hp).toBe(SHIP.hp - 2);
    expect(lone('box', { kind: 'guided' }).hp).toBe(SHIP.hp - 1);
    // Round 7: a heavy's direct hit sinks a ship in any formation, armour or not.
    for (const f of ['pairs', 'spread', 'box', 'column'] as const) expect(lone(f, { kind: 'heavy', hp: 8 }).hp, f).toBeLessThanOrEqual(0);
  });

  it('a ballistic splash reaches the neighbours of a Box but never past one Spread ship', () => {
    const blast = (formation: 'spread' | 'box') => {
      const g = quietGame();
      g.spawnT = 999;
      setFormation(g, formation);
      g.ships = [0, 1, 2].map((k) => ({ id: 800 + k, x: 800, y: 420 + k * 45, hp: SHIP.hp, slot: k, channel: 0, mult: 1 }));
      addThreat(g, { kind: 'ballistic', x: 800, y: 465, sx: 800, sy: 200, ix: 800, iy: 465, dur: 0.05, apex: 0, age: 0, target: 801, speed: 1 });
      run(g, 0.3);
      return g.ships.filter((s) => s.hp < SHIP.hp).length + g.lost;
    };
    expect(blast('box')).toBe(3);
    expect(blast('spread')).toBe(1);
  });

  it('Column ships move fastest and Box slowest', async () => {
    const { shipSpeed } = await import('../../src/v2/sim/game');
    const g = quietGame();
    const speeds = (['column', 'pairs', 'spread', 'box'] as const).map((f) => {
      setFormation(g, f);
      return shipSpeed(g);
    });
    expect(speeds[0]).toBeGreaterThan(speeds[1]);
    expect(speeds[1]).toBeGreaterThan(speeds[2]);
    expect(speeds[2]).toBeGreaterThan(speeds[3]);
  });

  it('each raid is one family of threat, and its warning comes first', async () => {
    const { RAID, RAID_THEME } = await import('../../src/v2/data/config');
    const { raidWarning } = await import('../../src/v2/sim/game');
    const g = createGame('island', 33, 7);
    expect(new Set(g.raids.map((r) => r.theme)).size).toBeGreaterThan(1);
    const launches = new Map<number, Set<string>>();
    for (const l of g.queue) {
      // A launch belongs to the latest raid that started before it.
      let r = -1;
      g.raids.forEach((raid, k) => {
        if (raid.at <= l.at && (r < 0 || raid.at > g.raids[r].at)) r = k;
      });
      if (r >= 0 && l.kind !== 'drone') launches.set(r, (launches.get(r) ?? new Set()).add(RAID_THEME[l.kind]));
    }
    for (const themes of launches.values()) expect(themes.size).toBe(1);
    // The warning is up before the first raid lands.
    const first = g.raids[0];
    while (g.waveT < first.at - RAID.warn / 2) step(g, DT);
    expect(raidWarning(g)?.raid).toBe(first);
  });
});

describe('round 4: submarines, trucks and aircraft', () => {
  const raider = (g: Game, kind: 'sub' | 'popup' | 'runner', path: { x: number; y: number }[], units: { kind: never | string; size: number }[]) =>
    g.raiderQueue.push({ at: g.waveT, kind, path, units } as never);

  it('a submarine warns, surfaces, fires 4 ballistics back to back from its spot, then dives away', async () => {
    const { SUB } = await import('../../src/v2/data/config');
    const g = quietGame();
    raider(g, 'sub', [{ x: 420, y: 250 }], [{ kind: 'ballistic', size: 1 }, { kind: 'ballistic', size: 1 }, { kind: 'ballistic', size: 1 }, { kind: 'ballistic', size: 1 }]);
    step(g, DT);
    expect(g.raiders[0].state).toBe('warn');
    run(g, SUB.warn - 0.1);
    expect(g.threats.filter((t) => t.kind === 'ballistic')).toHaveLength(0);
    // Watch every launch: all 4 leave from the sub's spot, SUB.gap apart.
    const launches: { id: number; t: number; sx: number; sy: number }[] = [];
    for (let i = 0; i < (0.1 + SUB.surface + SUB.gap * 4 + 0.1) / DT; i++) {
      step(g, DT);
      for (const t of g.threats) if (t.kind === 'ballistic' && !launches.some((l) => l.id === t.id)) launches.push({ id: t.id, t: g.t, sx: t.sx, sy: t.sy });
    }
    expect(launches).toHaveLength(4);
    expect(launches.every((l) => l.sx === 420 && l.sy === 250)).toBe(true);
    expect(launches[3].t - launches[0].t).toBeCloseTo(SUB.gap * 3, 1);
    run(g, SUB.dive + 0.2);
    expect(g.raiders).toHaveLength(0);
    expect(g.origins.sub).toBe(4);
  });

  it('a pop-up truck drives to the shore, fires, and reverses back out; a runner fires at stops along the road', async () => {
    const g = quietGame();
    raider(g, 'popup', [{ x: 540, y: -40 }, { x: 540, y: 128 }], [{ kind: 'guided', size: 1 }]);
    step(g, DT);
    run(g, 1);
    expect(g.raiders[0].y).toBeGreaterThan(-40);
    expect(g.threats).toHaveLength(0);
    run(g, 3);
    const m = g.threats.find((t) => t.kind === 'guided')!;
    expect(m.sx).toBe(540);
    expect(m.sy).toBeCloseTo(128, 0);
    expect(['reverse', 'lower']).toContain(g.raiders[0].state);
    run(g, 4);
    expect(g.raiders).toHaveLength(0);

    const r = quietGame();
    const road = [{ x: -60, y: 124 }, { x: 1660, y: 124 }];
    raider(r, 'runner', road, [{ kind: 'guided', size: 1 }, { kind: 'guided', size: 1 }, { kind: 'drone', size: 3 }]);
    const from = new Set<number>();
    for (let t = 0; t < 30 && (r.raiders.length || !t); t += DT) {
      step(r, DT);
      for (const th of r.threats) if (th.age < DT * 1.5) from.add(Math.round(th.sx / 50) * 50);
    }
    expect(r.origins.truck).toBe(5);
    expect(from.size).toBe(3); // three different stops along the road
  });

  it('a strafing jet hits every hull under its line once and none outside it, then flies off', async () => {
    const { PLANE } = await import('../../src/v2/data/config');
    const g = quietGame();
    g.spawnT = 999;
    g.ships = [];
    // Pairs lanes on the Strait sit at 470 ± 48: the jet flies the upper one.
    const inBand = [0, 1, 2].map((k) => ({ id: 900 + k, x: 600 + k * 150, y: 422, hp: SHIP.hp, slot: 0, channel: 0, mult: 1 }));
    const outside = { id: 950, x: 900, y: 518, hp: SHIP.hp, slot: 1, channel: 0, mult: 1 };
    expect(518 - 422).toBeGreaterThan(PLANE.band);
    g.ships.push(...inBand, outside);
    g.queue.unshift({ at: 0, kind: 'strafer', base: -1, side: 1, y: 422 } as never);
    run(g, 9);
    expect(inBand.map((s) => s.hp)).toEqual([SHIP.hp - 1, SHIP.hp - 1, SHIP.hp - 1]);
    expect(outside.hp).toBe(SHIP.hp);
    expect(g.threats.some((t) => t.kind === 'strafer')).toBe(false);
    expect(g.kills.strafer).toBe(0); // flew off, not shot down
  });

  it('a bomber drops nothing during its run-in, then drops its missiles on the convoy', async () => {
    const { PLANE } = await import('../../src/v2/data/config');
    const g = quietGame();
    g.spawnT = 999;
    g.ships = [{ id: 901, x: 200, y: 470, hp: SHIP.hp, slot: 0, channel: 0, mult: 1 }, { id: 902, x: 800, y: 470, hp: SHIP.hp, slot: 0, channel: 0, mult: 1 }];
    g.queue.unshift({ at: 0, kind: 'bomber', base: -1, side: 1, y: 250 } as never);
    step(g, DT);
    const bomber = g.threats.find((t) => t.kind === 'bomber')!;
    while (bomber.x < PLANE.bomberRunIn - 5) step(g, DT);
    expect(g.threats.filter((t) => t.kind === 'guided')).toHaveLength(0);
    run(g, 3);
    const drops = g.threats.filter((t) => t.kind === 'guided' && t.parent === 'bomber');
    expect(drops.length).toBeGreaterThan(0);
    expect(drops.every((t) => t.hp === 1)).toBe(true);
  });

  it('the wave waits for every launcher, and late-wave runs with all vectors replay exactly', async () => {
    const { Recorder, replay } = await import('../../src/v2/sim/playlog');
    const g = createGame('harbor', 77, 8);
    expect(g.raiderQueue.length).toBeGreaterThan(0);
    expect(g.queue.some((l) => l.kind === 'strafer' || l.kind === 'bomber')).toBe(true);
    const rec = new Recorder(g, { build: 'test', startedAt: '2026-01-01T00:00:00.000Z', firstWave: 8, device: { w: 1, h: 1, dpr: 1, touch: true, ua: 't' } });
    let sawRaiders = false;
    for (let i = 0; i < 60 * 70 && g.phase === 'wave'; i++) {
      if (g.raiders.length) sawRaiders = true;
      if (g.queue.length === 0 && g.threats.length === 0) expect(g.raiders.length + g.raiderQueue.length).toBeGreaterThan(0);
      if (i % 10 === 0 && g.threats.length) rec.tap(g.threats[0].x, g.threats[0].y, 40);
      step(g, DT);
    }
    expect(sawRaiders).toBe(true);
    const log = rec.finish('quit');
    const r = replay(JSON.parse(JSON.stringify(log)));
    expect({ steps: r.steps, score: r.score, lost: r.lost, origins: r.origins }).toEqual({ steps: g.steps, score: g.score, lost: g.lost, origins: g.origins });
  });

  it('by the middle waves about half the launches come from somewhere other than a fixed base', () => {
    let base = 0;
    let other = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const g = createGame('strait', seed, 7);
      g.flow = 4;
      for (let i = 0; i < 60 * 80 && g.phase === 'wave'; i++) {
        for (const th of g.threats) th.hp = th.age > 0.5 ? 0 : th.hp; // keep the screen clear
        step(g, DT);
      }
      base += g.origins.base;
      other += g.origins.truck + g.origins.sub + g.origins.air;
    }
    expect(other / (base + other)).toBeGreaterThan(0.35);
  });
});

describe('three-slot loadout', () => {
  it('a full loadout cannot take a new card, only level up its own', async () => {
    const { MAX_SLOTS, canTake, loadout } = await import('../../src/v2/data/upgrades');
    const g = createGame('strait', 5);
    g.levels = { reload: 1, speed: 1, twin: 1 };
    expect(loadout(g.levels)).toHaveLength(MAX_SLOTS);
    expect(canTake(g.levels, 'blast')).toBe(false);
    expect(canTake(g.levels, 'reload')).toBe(true);
    g.phase = 'draft';
    g.offer = ['blast', 'reload', 'radar'];
    pickUpgrade(g, 'blast');
    expect(g.levels.blast).toBeUndefined();
    expect(g.phase).toBe('draft');
    pickUpgrade(g, 'reload');
    expect(g.levels.reload).toBe(2);
    expect(g.phase).toBe('wave');
  });

  it('with all slots full a new card swaps in for a held one, which loses its levels', async () => {
    const { canSwapIn, stats: statsOf } = await import('../../src/v2/data/upgrades');
    const g = createGame('strait', 5);
    g.levels = { reload: 2, speed: 1, twin: 1 };
    g.stats = statsOf(g.levels);
    g.ammo = g.stats.rack;
    expect(canSwapIn(g.levels, 'blast')).toBe(true);
    expect(canSwapIn(g.levels, 'reload')).toBe(false); // already held: it levels up instead
    g.phase = 'draft';
    g.offer = ['blast', 'reload', 'radar'];
    pickUpgrade(g, 'blast', 'radar'); // not held: refused
    expect(g.phase).toBe('draft');
    pickUpgrade(g, 'blast', 'reload');
    expect(g.levels).toEqual({ speed: 1, twin: 1, blast: 1 });
    expect(g.phase).toBe('wave');
    // Giving up Quick Reload's bigger rack drops the rounds it held.
    expect(g.stats.rack).toBe(INTERCEPTOR.rack);
    expect(g.ammo).toBeLessThanOrEqual(g.stats.rack);
  });

  it('a log with a swap replays exactly', async () => {
    const { Recorder, replay } = await import('../../src/v2/sim/playlog');
    const g = createGame('strait', 21);
    const rec = new Recorder(g, { build: 'test', startedAt: '2026-01-01T00:00:00.000Z', firstWave: 1, device: { w: 1, h: 1, dpr: 1, touch: true, ua: 't' } });
    let swapped = false;
    for (let i = 0; i < 60 * 60 * 8 && g.phase !== 'lost' && g.phase !== 'won'; i++) {
      if (g.phase === 'draft') {
        const swapIn = g.offer.find((id) => id !== 'resupply' && !(g.levels[id] ?? 0) && Object.keys(g.levels).length >= 3);
        if (swapIn && !swapped) {
          rec.pick(swapIn, Object.keys(g.levels)[0] as never);
          swapped = true;
        } else rec.pick(g.offer.find((id) => id === 'resupply' || canTake(g.levels, id))!);
      }
      if (i % 12 === 0 && g.threats.length) rec.tap(g.threats[0].x, g.threats[0].y, 40);
      step(g, DT);
    }
    expect(swapped).toBe(true);
    const log = rec.finish(g.phase === 'lost' ? 'lost' : 'quit');
    expect(log.commands.some((c) => c[1] === 'u' && c.length === 4)).toBe(true);
    const r = replay(JSON.parse(JSON.stringify(log)));
    expect({ steps: r.steps, score: r.score, lost: r.lost, levels: r.levels }).toEqual({ steps: g.steps, score: g.score, lost: g.lost, levels: g.levels });
  });

  it('a draft with nothing takeable offers Resupply, which repairs and refills', async () => {
    const g = createGame('strait', 6);
    g.levels = { reload: 3, speed: 3, twin: 3 }; // full and all maxed
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
      g.levels = { reload: 1, hold: 1, blast: 1 };
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

  it('a heavy missile takes eight hits and its splash hurts the ships around its target', async () => {
    const { HEAVY, THREATS } = await import('../../src/v2/data/config');
    expect(THREATS.heavy.hp).toBe(8);
    const g = quietGame();
    const th = addThreat(g, { kind: 'heavy', hp: THREATS.heavy.hp, x: 800, y: 300, speed: 0 });
    for (let k = 0; k < THREATS.heavy.hp - 1; k++) {
      tap(g, 800, 300, 30);
      run(g, 1.6);
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
    // Count every mini-drone launched, not just those still flying: one can
    // reach a nearby ship before the second is due.
    const spawned = new Set<number>();
    for (let t = 0; t < MOTHERSHIP.spawnEvery * 2 + 0.1; t += DT) {
      step(g, DT);
      for (const th of g.threats) if (th.kind === 'minidrone' && th.parent === 'mothership') spawned.add(th.id);
    }
    expect(spawned.size).toBe(2);
    ms.hp = 1;
    tap(g, ms.x, ms.y, 40);
    run(g, 1.5);
    expect(ms.dead).toBe(true);
    const before = g.threats.filter((t) => t.kind === 'minidrone').length + g.kills.minidrone;
    run(g, MOTHERSHIP.spawnEvery * 2);
    expect(g.threats.filter((t) => t.kind === 'minidrone').length + g.kills.minidrone).toBeLessThanOrEqual(before);
  });

  it('map extras launch on schedule: the Island fields supersonics from wave 4', () => {
    // A wave's launches: from the bases, plus what its trucks and subs carry.
    const kinds = (g: Game) => [...g.queue.map((l) => l.kind), ...g.raiderQueue.flatMap((r) => r.units.map((u) => u.kind))];
    expect(kinds(createGame('island', 4, 3)).includes('supersonic')).toBe(false);
    const g = createGame('island', 4, 4);
    expect(kinds(g).includes('supersonic')).toBe(true);
    // The Strait keeps to the basics until a late taste of supersonics (wave 6)
    // and one heavy in the finale.
    expect(kinds(createGame('strait', 4, 5)).every((k) => ['drone', 'ballistic', 'guided', 'strafer'].includes(k))).toBe(true);
    expect(kinds(createGame('strait', 4, 6)).includes('supersonic')).toBe(true);
    expect(kinds(createGame('strait', 4, 9)).includes('heavy')).toBe(false);
    expect(kinds(createGame('strait', 4, 10)).filter((k) => k === 'heavy')).toHaveLength(1);
  });
});

describe('replay with the new threats', () => {
  it('a late Archipelago run (motherships, clusters, heavies) replays exactly', async () => {
    const { Recorder, replay } = await import('../../src/v2/sim/playlog');
    const g = createGame('archipelago', 91, 8);
    const rec = new Recorder(g, {
      build: 'test',
      startedAt: '2026-01-01T00:00:00.000Z',
      firstWave: 8,
      device: { w: 874, h: 402, dpr: 3, touch: true, ua: 'test' },
    });
    const kinds = new Set<string>();
    for (let i = 0; i < 60 * 150 && g.phase !== 'lost' && g.phase !== 'won'; i++) {
      if (g.phase === 'draft') rec.pick(g.offer.find((id) => canTake(g.levels, id))!);
      for (const t of g.threats) kinds.add(t.kind);
      if (i % 12 === 0 && g.threats.length) {
        const t = g.threats[(i / 12) % g.threats.length];
        rec.tap(t.x + 2, t.y - 1, 45);
      }
      step(g, DT);
    }
    const log = rec.finish(g.phase === 'lost' ? 'lost' : g.phase === 'won' ? 'won' : 'quit');
    expect([...kinds]).toEqual(expect.arrayContaining(['mothership', 'minidrone']));
    const r = replay(JSON.parse(JSON.stringify(log)));
    expect(r.steps).toBe(g.steps);
    expect(r.score).toBe(g.score);
    expect(r.kills).toEqual(g.kills);
    expect(r.sunkBy).toEqual(g.sunkBy);
    expect(r.history).toEqual(g.history);
  });
});

describe('round 4: new cards', () => {
  const withCards = (levels: Partial<Record<string, number>>, seed = 1) => {
    const g = quietGame(seed);
    g.raiderQueue = [];
    g.levels = levels as Game['levels'];
    g.stats = stats(g.levels);
    return g;
  };

  it('every card has a name, an icon colour and one line per level', async () => {
    const { ICON_COLOR } = await import('../../src/v2/ui/icons');
    expect(UPGRADE_ORDER).toHaveLength(17);
    for (const id of UPGRADE_ORDER) {
      expect(UPGRADES[id].levels).toHaveLength(UPGRADES[id].max);
      expect(ICON_COLOR[id]).toMatch(/^#/);
    }
  });

  it('Salvage Crews: +25% drops (not +50%), and pickups last 8 s at level 2', () => {
    expect(stats({ salvage: 1 }).dropMult).toBe(1.25);
    expect(stats({ salvage: 1 }).pickupLife).toBe(5);
    expect(stats({ salvage: 2 }).pickupLife).toBe(8);
    const count = (levels: Game['levels']) => {
      let drops = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const g = withCards(levels, seed);
        g.overdriveT = 100; // a round for every tap
        for (let k = 0; k < 40; k++) {
          const th = addThreat(g, { x: 300 + k * 25, y: 300, speed: 0 });
          tap(g, th.x, th.y, 10);
        }
        run(g, 2.5);
        drops += g.pickups.length;
      }
      return drops;
    };
    const base = count({});
    const more = count({ salvage: 1 });
    expect(base).toBeGreaterThan(100);
    expect(more / base).toBeGreaterThan(1.1);
    expect(more / base).toBeLessThan(1.45);
  });

  it('Supercharged Pickups: Overdrive runs 50% longer; level 2 reloads 2 rounds per pickup', () => {
    const g = withCards({ supercharge: 2 });
    g.ammo = 0;
    g.pickups.push({ id: 999, kind: 'overdrive', x: 500, y: 300, age: 0 });
    tap(g, 500, 300, 30);
    expect(g.overdriveT).toBeCloseTo(PICKUPS_OD * 1.5, 5);
    const h = withCards({ supercharge: 2 });
    h.ammo = 0;
    h.pickups.push({ id: 998, kind: 'steam', x: 500, y: 300, age: 0 });
    tap(h, 500, 300, 30);
    expect(h.ammo).toBe(2);
  });

  it('Pickup Magnet: pickups fly to the carrier by themselves; level 2 at once, and grabbed from twice as far', () => {
    const fly = (magnet: number, seconds: number) => {
      const g = withCards({ magnet });
      g.ammo = 0;
      g.pickups.push({ id: 902, kind: 'ammo', x: 300, y: 200, age: 0 });
      run(g, seconds);
      return g.pickups.length === 0 && g.ammo === g.stats.rack;
    };
    // ~710 px from the carrier at 420 px/s, after a 1.5 s (L1) or 0.3 s (L2) beat.
    expect(fly(1, 2.4)).toBe(false);
    expect(fly(1, 3.6)).toBe(true);
    expect(fly(2, 2.4)).toBe(true);
    const near = withCards({});
    near.pickups.push({ id: 900, kind: 'ammo', x: 500, y: 300, age: 0 });
    expect(tap(near, 500 + 75, 300, 30)).not.toBe('pickup');
    const far = withCards({ magnet: 2 });
    far.pickups.push({ id: 901, kind: 'ammo', x: 500, y: 300, age: 0 });
    expect(tap(far, 500 + 75, 300, 30)).toBe('pickup');
  });

  it('Armored Hulls: ships take an extra hit (hulls at sea too); level 2 adds 5 carrier HP', () => {
    const g = quietGame();
    run(g, 6);
    expect(g.ships.length).toBeGreaterThan(0);
    g.phase = 'draft';
    g.offer = ['armor'];
    pickUpgrade(g, 'armor');
    for (const s of g.ships) expect(s.hp).toBe(SHIP.hp + 1);
    g.phase = 'draft';
    g.offer = ['armor'];
    pickUpgrade(g, 'armor');
    expect(g.carrierHp).toBe(CARRIER.hp + 5);
    for (const s of g.ships) expect(s.hp).toBe(SHIP.hp + 1);
  });

  it('Smoke Screen: a hit ship lays smoke and a guided missile loses its lock on it', () => {
    const play = (smoke: number) => {
      const g = withCards(smoke ? { smoke } : {});
      run(g, 8);
      const s = g.ships[0];
      // A first hit lays the smoke; then a guided missile comes in from the side.
      g.events.length = 0;
      const first = addThreat(g, { kind: 'drone', x: s.x + 5, y: s.y, target: s.id, speed: 0 });
      step(g, DT);
      expect(first.dead).toBe(true);
      const hp = s.hp;
      addThreat(g, { kind: 'guided', hp: 2, x: s.x + 150, y: s.y - 260, heading: Math.PI / 2, target: s.id, speed: 150 });
      run(g, 3);
      return hp - s.hp;
    };
    expect(play(0)).toBeGreaterThan(0);
    expect(play(1)).toBe(0);
  });

  it('Decoy Flares: a guided missile closing on a ship is pulled off; recharges', () => {
    const g = withCards({ flares: 1 });
    run(g, 8);
    const s = g.ships[0];
    const m = addThreat(g, { kind: 'guided', hp: 2, x: s.x + 60, y: s.y - 60, target: s.id, speed: 150 });
    step(g, DT);
    expect(m.decoy).toBeDefined(); // swerving after the flare
    run(g, 1.5);
    expect(m.dead).toBe(true);
    expect(s.hp).toBe(SHIP.hp);
    expect(g.flareT).toBeGreaterThan(6); // 8 s recharge, 1.5 s spent
    // Recharging: the next one gets through.
    const m2 = addThreat(g, { kind: 'guided', hp: 2, x: s.x + 60, y: s.y - 60, target: s.id, speed: 150 });
    run(g, 2);
    expect(m2.dead).toBe(true);
    expect(s.hp).toBeLessThan(SHIP.hp);
  });

  it('Flak Burst: an interceptor clips threats it passes on the way to its target', () => {
    const play = (flak: number) => {
      const g = withCards(flak ? { flak } : {});
      const c = g.map.carrier;
      const target = addThreat(g, { x: c.x, y: c.y - 400, speed: 0, hp: 5 });
      const passer = addThreat(g, { x: c.x + 15, y: c.y - 200, speed: 0 });
      tap(g, target.x, target.y, 10);
      run(g, 1.5);
      return passer.dead;
    };
    expect(play(0)).toBe(false);
    expect(play(1)).toBe(true);
  });

  it('Combat Rhythm: every 4th kill reloads a round', () => {
    const g = withCards({ rhythm: 1 });
    for (let k = 0; k < 8; k++) addThreat(g, { x: 400 + k * 50, y: 300, speed: 0 });
    // One interceptor each (Overdrive pays for them), then an empty rack.
    g.overdriveT = 1;
    for (const th of [...g.threats]) tap(g, th.x, th.y, 10);
    g.overdriveT = 0;
    g.ammo = 0;
    g.stats = { ...g.stats, reload: 1e9 }; // no ordinary reload during the test
    const kills = () => Object.values(g.kills).reduce((a, b) => a + b, 0);
    for (let i = 0; i < 180 && kills() < 8; i++) step(g, DT);
    expect(kills()).toBe(8);
    expect(g.ammo).toBe(2);
  });

  it('Proximity Fuse: bursts close to the target; level 2 hits twice as hard', () => {
    expect(stats({ proxfuse: 1 }).contact).toBeGreaterThan(INTERCEPTOR.contact * 2);
    const g = withCards({ proxfuse: 2 });
    const heavy = addThreat(g, { kind: 'heavy', hp: 8, x: 800, y: 300, speed: 0 });
    tap(g, 800, 300, 10);
    run(g, 1.5);
    expect(heavy.hp).toBe(6);
  });
});

describe('round 4: new pickups', () => {
  const withPickup = (kind: 'timewarp' | 'shield' | 'strike' | 'steam') => {
    const g = quietGame();
    g.raiderQueue = [];
    run(g, 8);
    g.pickups.push({ id: 777, kind, x: 500, y: 450, age: 0 });
    expect(tap(g, 500, 450, 30)).toBe('pickup');
    return g;
  };

  it('Time Warp slows every threat but not the convoy', () => {
    const g = withPickup('timewarp');
    const th = addThreat(g, { kind: 'guided', x: 800, y: 200, heading: 0, speed: 150, target: CARRIER_TARGET });
    const ship = g.ships[0];
    const [tx, sx] = [th.x, ship.x];
    run(g, 1);
    const moved = Math.hypot(th.x - tx, th.y - 200);
    expect(moved).toBeLessThan(150 * 0.5);
    expect(ship.x - sx).toBeGreaterThan(20);
  });

  it('Shield: no ship or carrier damage while it lasts', () => {
    const g = withPickup('shield');
    const s = g.ships[0];
    const hp = g.carrierHp;
    addThreat(g, { kind: 'drone', x: s.x + 5, y: s.y, target: s.id, speed: 0 });
    const c = g.map.carrier;
    addThreat(g, { kind: 'drone', x: c.x, y: c.y, target: CARRIER_TARGET, speed: 0 });
    step(g, DT);
    expect(s.hp).toBe(SHIP.hp);
    expect(g.carrierHp).toBe(hp);
  });

  it('Strike Package: friendly jets sweep the screen, hitting what is on their line and knocking out a firing sub', () => {
    const g = quietGame();
    const spot = g.map.subSpots[0];
    g.raiderQueue = [{ at: g.waveT, kind: 'sub', path: [spot], units: [{ kind: 'ballistic', size: 4 }] }];
    run(g, 2.9); // warn 2 s + surface 0.8 s: now firing
    const sub = g.raiders[0];
    expect(sub.state).toBe('fire');
    const launched = g.origins.sub;
    // The most urgent threat sets the first jet's line; one far off any line survives.
    const urgent = addThreat(g, { kind: 'guided', hp: 2, x: 900, y: 520, speed: 0, target: CARRIER_TARGET });
    const away = addThreat(g, { kind: 'guided', hp: 2, x: 900, y: spot.y > 450 ? 60 : 860, speed: 0, target: CARRIER_TARGET });
    g.pickups.push({ id: 778, kind: 'strike', x: 300, y: 450, age: 0 });
    tap(g, 300, 450, 30);
    expect(g.allies).toHaveLength(2);
    expect(urgent.dead).toBe(false); // not yet: the jets have to get there
    run(g, 2.5);
    expect(urgent.dead).toBe(true);
    expect(away.dead).toBe(false);
    expect(['dive', 'reverse']).toContain(sub.state);
    expect(g.origins.sub).toBeLessThan(launched + 3);
    expect(g.allies).toHaveLength(0); // flown off the far edge
  });

  it('Full Steam speeds the convoy up', () => {
    const g = withPickup('steam');
    const s = g.ships[0];
    const x0 = s.x;
    run(g, 1);
    expect(s.x - x0).toBeGreaterThan(shipSpeedOf(g) * 0.9 * 1.4);
  });

  it('new pickups drop in play, and the old four still do exactly what they did', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 6; seed++) {
      const g = createGame('island', seed, 6);
      const bot = new Bot(SKILLS.average, seed);
      for (let i = 0; i < 60 * 90 && g.phase === 'wave'; i++) {
        for (const p of g.pickups) seen.add(p.kind);
        bot.act(g);
        step(g, DT);
      }
    }
    for (const k of ['ammo', 'repair', 'overdrive', 'emp', 'timewarp', 'shield', 'strike', 'steam']) expect(seen.has(k), k).toBe(true);
    // Old four, no cards: unchanged numbers.
    const g = quietGame();
    g.pickups.push({ id: 1, kind: 'overdrive', x: 500, y: 450, age: 0 });
    tap(g, 500, 450, 30);
    expect(g.overdriveT).toBe(PICKUPS_OD);
  });
});

describe('round 7: the heavy cruise missile and the Island lanes', () => {
  it('a heavy sinks an armoured ship outright', () => {
    const g = quietGame();
    g.levels = { armor: 2 };
    g.stats = stats(g.levels);
    g.spawnT = 999;
    g.ships = [{ id: 900, x: 800, y: 470, hp: g.stats.shipHp, slot: 0, channel: 0, mult: 1 }];
    addThreat(g, { kind: 'heavy', hp: 8, x: 800, y: 470, speed: 55, target: 900 });
    step(g, DT);
    expect(g.ships).toHaveLength(0);
    expect(g.lost).toBe(1);
  });

  it('a heavy takes half the carrier\'s health, armoured carrier included', () => {
    for (const armor of [0, 2]) {
      const g = quietGame();
      g.levels = armor ? { armor } : {};
      g.stats = stats(g.levels);
      g.carrierHp = g.stats.carrierHp;
      const c = g.map.carrier;
      addThreat(g, { kind: 'heavy', hp: 8, x: c.x, y: c.y, speed: 55, target: CARRIER_TARGET });
      step(g, DT);
      expect(g.carrierHp).toBe(g.stats.carrierHp - Math.ceil(g.stats.carrierHp / 2));
    }
  });

  it('heavies hunt the frigate too: half its hull per hit, sunk by two, back next wave', async () => {
    const { FRIGATE } = await import('../../src/v2/data/config');
    const { FRIGATE_TARGET } = await import('../../src/v2/sim/game');
    const g = quietGame();
    g.phase = 'draft';
    g.offer = ['frigate'];
    pickUpgrade(g, 'frigate');
    g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    g.raiderQueue = [];
    run(g, 8);
    const f = g.frigate!;
    expect(f.hp).toBe(FRIGATE.hp);
    addThreat(g, { kind: 'heavy', hp: 8, x: f.x, y: f.y, speed: 55, target: FRIGATE_TARGET });
    step(g, DT);
    expect(g.frigate!.hp).toBe(FRIGATE.hp - Math.ceil(FRIGATE.hp / 2));
    addThreat(g, { kind: 'heavy', hp: 8, x: f.x, y: f.y, speed: 55, target: FRIGATE_TARGET });
    step(g, DT);
    expect(g.frigate).toBeNull();
    // A heavy already aimed at it goes for the carrier instead.
    const late = addThreat(g, { kind: 'heavy', hp: 8, x: 800, y: 300, speed: 55, target: FRIGATE_TARGET });
    step(g, DT);
    expect(late.target).toBe(CARRIER_TARGET);
    // Next wave it sails back in, repaired.
    g.queue = [];
    g.threats = [];
    run(g, 0.1);
    expect(g.phase).toBe('draft');
    pickUpgrade(g, g.offer.find((id) => canTake(g.levels, id)) ?? g.offer[0]);
    expect(g.frigate).not.toBeNull();
    expect(g.frigate!.hp).toBe(FRIGATE.hp);
  });

  it('some carrier-bound heavies pick the frigate when it is out', async () => {
    const { FRIGATE_TARGET } = await import('../../src/v2/sim/game');
    let atFrigate = 0;
    let heavies = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const g = createGame('island', seed, 8);
      if (!g.frigate) {
        g.levels = { ...g.levels, frigate: 1 };
        g.stats = stats(g.levels);
        g.frigate = { x: g.map.frigate.x, y: g.map.frigate.y, vx: 0, ammo: 0, reloadT: 0, hp: 6 };
      }
      for (let i = 0; i < 60 * 60 && g.phase === 'wave'; i++) {
        step(g, DT);
        for (const t of g.threats) if (t.kind === 'heavy' && t.age < DT * 1.5) {
          heavies++;
          if (t.target === FRIGATE_TARGET) atFrigate++;
        }
        g.lost = 0;
        g.carrierHp = 12;
        if (g.frigate) g.frigate.hp = 6;
      }
    }
    expect(heavies).toBeGreaterThan(5);
    expect(atFrigate).toBeGreaterThan(0);
    expect(atFrigate).toBeLessThan(heavies);
  });

  it('Island ships use both lanes, north and south of the island', () => {
    const g = createGame('island', 3);
    g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    g.raiderQueue = [];
    const seen = new Set<number>();
    for (let i = 0; i < 60 * 40; i++) {
      step(g, DT);
      for (const s of g.ships) seen.add(s.channel);
    }
    expect([...seen].sort()).toEqual([0, 1]);
    const north = g.ships.filter((s) => s.channel === 1);
    for (const s of north) expect(s.y).toBeLessThan(260);
  });

  it('the risky north lane takes one group in three, and its ships run faster', async () => {
    const { MAPS, channelCycle } = await import('../../src/v2/data/maps');
    expect(channelCycle(MAPS.island)).toEqual([0, 0, 1]);
    const g = createGame('island', 4);
    g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    g.raiderQueue = [];
    let south = g.ships;
    let north = g.ships;
    for (let i = 0; i < 60 * 60; i++) {
      step(g, DT);
      south = g.ships.filter((s) => s.channel === 0 && s.x > 0);
      north = g.ships.filter((s) => s.channel === 1 && s.x > 0);
      if (north.length && south.length) break;
    }
    expect(north.length).toBeGreaterThan(0);
    const x0 = new Map(g.ships.map((s) => [s.id, s.x]));
    step(g, DT);
    const moved = (list: typeof south) => Math.max(...list.map((s) => s.x - x0.get(s.id)!));
    expect(moved(north)).toBeGreaterThan(moved(south) * 1.3);
  });

  it('Island hulls never overlap at max flow, through every formation switch', () => {
    const g = createGame('island', 9);
    g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    g.raiderQueue = [];
    setFlow(g, FLOW_STEPS.length - 1);
    const order = ['column', 'pairs', 'spread', 'box'] as const;
    for (let i = 0; i < 60 * 90; i++) {
      if (i % (60 * 9) === 0) setFormation(g, order[(i / (60 * 9)) % 4]);
      step(g, DT);
      for (let a = 0; a < g.ships.length; a++)
        for (let b = a + 1; b < g.ships.length; b++) {
          const p = g.ships[a];
          const q = g.ships[b];
          expect(Math.abs(p.x - q.x) < 50 && Math.abs(p.y - q.y) < 16, `overlap at step ${i}`).toBe(false);
        }
    }
  });
});

describe('round 8: dev playtest tempo', () => {
  const SHORT = { waveLen: 0.4, stride: 1, lossLimit: 3 };
  const launches = (g: Game) => g.queue.length + g.raiderQueue.reduce((n, r) => n + r.units.reduce((m, u) => m + u.size, 0), 0);

  it('a short wave is 0.4× as long and just as busy, and keeps every threat type', () => {
    for (const map of MAP_ORDER) {
      const full = createGame(map, 12, 9);
      const short = createGame(map, 12, 9, SHORT);
      const span = (g: Game) => Math.max(...g.queue.map((l) => l.at), ...g.raids.map((r) => r.at)) - RULES.waveLeadIn;
      const ratio = span(short) / span(full);
      expect(ratio, map).toBeGreaterThan(0.3);
      expect(ratio, map).toBeLessThan(0.5);
      // Same launches per second, give or take the rounding.
      const density = (g: Game) => launches(g) / waveSpec(9).duration / (g.tempo.waveLen);
      expect(density(short) / density(full), map).toBeGreaterThan(0.8);
      expect(density(short) / density(full), map).toBeLessThan(1.3);
      const kinds = (g: Game) => new Set([...g.queue.map((l) => l.kind), ...g.raiderQueue.flatMap((r) => r.units.map((u) => u.kind))]);
      expect([...kinds(short)].sort(), map).toEqual([...kinds(full)].sort());
    }
  });

  it('the stride plays every other wave, ends on the last, and drafts a card per wave skipped', async () => {
    const { nextPlayedWave } = await import('../../src/v2/sim/game');
    expect([0, 2, 4, 8].map((w) => nextPlayedWave(w, 2))).toEqual([2, 4, 6, 10]);
    expect(nextPlayedWave(9, 3)).toBe(10);
    expect(nextPlayedWave(10, 2)).toBe(11);
    const g = createGame('strait', 4, 2, { waveLen: 0.4, stride: 2, lossLimit: 2 });
    expect(g.wave).toBe(2);
    g.queue = [];
    g.raiderQueue = [];
    g.threats = [];
    g.raiders = [];
    step(g, DT);
    expect(g.phase).toBe('draft');
    expect(g.draftsLeft).toBe(2);
    pickUpgrade(g, g.offer.find((id) => canTake(g.levels, id))!);
    expect(g.phase).toBe('draft');
    expect(g.wave).toBe(3);
    pickUpgrade(g, g.offer.find((id) => canTake(g.levels, id))!);
    expect(g.phase).toBe('wave');
    expect(g.wave).toBe(4);
    expect(Object.values(g.levels).reduce((a, b) => a + (b ?? 0), 0)).toBe(3);
  });

  it('the run ends at the tempo’s loss limit', () => {
    const g = createGame('strait', 4, 1, SHORT);
    g.lost = 2;
    step(g, DT);
    expect(g.phase).toBe('wave');
    g.lost = 3;
    step(g, DT);
    expect(g.phase).toBe('lost');
  });

  it('a dev run with a wave retry replays exactly, and the retry starts from the wave as it began', async () => {
    const { Recorder, replay, replayTo } = await import('../../src/v2/sim/playlog');
    const tempo = { waveLen: 0.4, stride: 2, lossLimit: 2 };
    const meta = { build: 'test', startedAt: '2026-01-01T00:00:00.000Z', firstWave: 2, tempo, dev: { preset: 'quarter' }, device: { w: 844, h: 390, dpr: 2, touch: true, ua: 'test' } };
    const play = (rec: InstanceType<typeof Recorder>, g: Game, sloppy: boolean) => {
      for (let i = 0; i < 60 * 60 * 4 && g.phase !== 'lost' && g.phase !== 'won'; i++) {
        if (g.phase === 'draft') rec.pick(g.offer.find((id) => id === 'resupply' || canTake(g.levels, id))!);
        if (i % (sloppy ? 45 : 12) === 0 && g.threats.length) rec.tap(g.threats[0].x, g.threats[0].y, 40);
        step(g, DT);
      }
    };
    const g = createGame('island', 8, 2, tempo);
    const rec = new Recorder(g, meta);
    play(rec, g, true);
    expect(g.phase).toBe('lost');
    const lostLog = rec.finish('lost');
    expect(replay(JSON.parse(JSON.stringify(lostLog))).score).toBe(g.score);

    // Retry: rebuild the lost wave's start, play it again as a new log.
    const mark = rec.mark;
    expect(mark.wave).toBe(g.wave);
    const g2 = replayTo(rec.log, mark.steps, mark.commands);
    expect(g2.phase).toBe('wave');
    expect(g2.wave).toBe(g.wave);
    expect(g2.waveT).toBe(0);
    expect(g2.lost).toBe(g.history[g.history.length - 2]?.lost ?? 0);
    const rec2 = new Recorder(g2, { ...meta, startedAt: '2026-01-01T00:05:00.000Z', dev: { preset: 'quarter', retryOf: lostLog.id } }, { log: rec.log, mark });
    play(rec2, g2, false);
    const log2 = rec2.finish(g2.phase === 'won' ? 'won' : g2.phase === 'lost' ? 'lost' : 'quit');
    // The retry's log keeps the drafts made before the retried wave.
    const before = lostLog.summary!.drafts.filter((d) => d.wave < mark.wave);
    expect(before.length).toBeGreaterThan(0);
    expect(log2.summary!.drafts.slice(0, before.length)).toEqual(before);
    const r = replay(JSON.parse(JSON.stringify(log2)));
    expect({ steps: r.steps, score: r.score, lost: r.lost, wave: r.wave }).toEqual({ steps: g2.steps, score: g2.score, lost: g2.lost, wave: g2.wave });
    expect(r.history).toEqual(g2.history);
  });
});
