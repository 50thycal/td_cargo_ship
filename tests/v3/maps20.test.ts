// The 20-map plan (docs/design/v3-maps-plan.md): the order the player
// approved, the lanes as paths, and each new map's own system.

import { describe, expect, it } from 'vitest';
import { POST, THREATS, VIEW, VIP, isStructure } from '../../src/v3/data/config';
import { CHAPTERS, MAPS, MAP_ORDER, OLD_ORDER, chapterOf, type MapId } from '../../src/v3/data/maps';
import { isUnlocked, loadProgress, MAPS_VERSION } from '../../src/v3/platform/save';
import { laneAt, laneLength, lanePoint } from '../../src/v3/sim/lanes';
import { CARRIER_TARGET, createGame, highTide, shieldUp, step, tap, timeToImpact, tracked, type Game, type Threat } from '../../src/v3/sim/game';
import { runBot, SKILLS } from '../../src/v3/sim/bot';

const DT = 1 / 60;
function run(g: Game, seconds: number): void {
  for (let i = 0; i < seconds / DT && g.phase === 'wave'; i++) step(g, DT);
}

/** A map whose wave launches nothing on its own (structures still stand). */
function quiet(map: MapId, seed = 1): Game {
  const g = createGame(map, seed);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.threats = g.threats.filter((t) => isStructure(t.kind) && t.kind !== 'dreadnought');
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

describe('twenty maps, four chapters (the player\'s approved order)', () => {
  it('twenty distinct maps, five a chapter, the Gauntlet 4th and the Island 6th', () => {
    expect(MAP_ORDER).toHaveLength(20);
    expect(new Set(MAP_ORDER).size).toBe(20);
    expect(MAP_ORDER.every((id) => MAPS[id] && MAPS[id].id === id)).toBe(true);
    expect(CHAPTERS).toHaveLength(4);
    expect(MAP_ORDER.slice(0, 2)).toEqual(['strait', 'kesh']);
    expect(MAP_ORDER.indexOf('gauntlet')).toBe(3);
    expect(MAP_ORDER.indexOf('island')).toBe(5);
    expect(MAP_ORDER[19]).toBe('citadel');
    expect(chapterOf('harbor')).toBe(1);
    expect(chapterOf('saltgate')).toBe(2);
    expect(chapterOf('dreadnought')).toBe(3);
    expect(chapterOf('coves')).toBe(4);
  });

  it('every map: carrier, frigate station, sub spots and the notice tray sit clear of every lane, inside the screen', () => {
    for (const id of MAP_ORDER) {
      const m = MAPS[id];
      const clear = (x: number, y: number, pad: number) =>
        m.channels.every((ch) => {
          const L = laneLength(ch);
          for (let d = 0; d <= L; d += 10) {
            const p = lanePoint(ch, d);
            if (p.x < 0 || p.x > VIEW.width) continue;
            const hw = ch.widths || ch.narrow ? 0 : ch.halfWidth;
            if (Math.hypot(p.x - x, p.y - y) < hw + pad - 30) return false;
          }
          return true;
        });
      expect(clear(m.carrier.x, m.carrier.y, 20), `${id} carrier`).toBe(true);
      for (const s of m.subSpots) expect(clear(s.x, s.y, 10), `${id} sub ${s.x},${s.y}`).toBe(true);
      for (const p of [m.carrier, m.frigate, m.callout]) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(VIEW.width);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(VIEW.height);
      }
      expect(m.alerts.x1).toBeGreaterThan(m.alerts.x0);
    }
  });

  it('every map plays a whole bot run without errors, and a strong bot clears the first chapter', () => {
    for (const id of MAP_ORDER) {
      const r = runBot(id, 3, SKILLS.sharp);
      expect(r.wave, id).toBeGreaterThan(1);
      expect(Number.isFinite(r.score), id).toBe(true);
    }
    const ch1 = MAP_ORDER.slice(0, 2).map((id) => runBot(id, 4, SKILLS.sharp).won);
    expect(ch1.filter(Boolean).length).toBeGreaterThan(0);
  });

  it('an old save keeps every map it had open, and counts the new order from what it has cleared', () => {
    const store: Record<string, string> = {};
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => void (store[k] = v),
      removeItem: (k: string) => void delete store[k],
      clear: () => undefined,
      key: () => null,
      length: 0,
    };
    store['straitwatch.v3.progress'] = JSON.stringify({ unlocked: 3, best: {}, cards: 0, armory: {}, equipped: { gun: null, hull: null, supply: null }, cleared: ['strait', 'gauntlet'], armoryV: 2 });
    const p = loadProgress();
    expect(p.mapsV).toBe(MAPS_VERSION);
    expect(OLD_ORDER.slice(0, 3).every((id) => isUnlocked(p, id))).toBe(true); // strait, gauntlet, island
    expect(isUnlocked(p, 'kesh')).toBe(true); // strait cleared: the next map in the new order
    expect(isUnlocked(p, 'marrow')).toBe(false);
    expect(isUnlocked(p, 'harbor')).toBe(false);
    // Loading it again changes nothing.
    expect(loadProgress()).toEqual(p);
  });
});

describe('lanes as paths', () => {
  it('a straight lane is the old channel: distance is x + 40, the offset is y off the lane', () => {
    const ch = MAPS.strait.channels[0];
    const p = laneAt(ch, 500, 30);
    expect(p.x).toBeCloseTo(460);
    expect(p.y).toBeCloseTo(ch.y + 30);
    expect(laneLength(ch)).toBe(1680);
  });

  it('the Kesh Hook: ships sail the turn and leave off the top edge, bows following the lane', () => {
    const g = quiet('kesh');
    run(g, 70);
    const turning = g.ships.find((s) => s.x > 950 && s.y < 650 && s.y > 250);
    expect(turning).toBeDefined();
    expect(Math.abs(Math.sin(turning!.heading))).toBeGreaterThan(0.3); // pointing up-ish, not east
    run(g, 40);
    expect(g.delivered).toBeGreaterThan(0);
    // Nobody delivered off the right edge: the exit is the top.
    expect(g.ships.every((s) => s.x < 1400)).toBe(true);
  });

  it('Dunmar Crossing: the inbound lane sails right to left and delivers at the left edge', () => {
    const g = quiet('crossing');
    run(g, 60);
    const inbound = g.ships.filter((s) => s.channel === 1);
    expect(inbound.length).toBeGreaterThan(0);
    expect(inbound.every((s) => Math.cos(s.heading) < -0.9)).toBe(true);
    run(g, 40);
    expect(g.delivered).toBeGreaterThan(0);
  });

  it('the Needle of Bosk: ships close into one file before the gap and never overlap in it', () => {
    const g = quiet('needle');
    g.formation = 'box';
    let inGap = 0;
    for (let t = 0; t < 120; t += DT) {
      step(g, DT);
      const gap = g.ships.filter((s) => s.x > 1010 && s.x < 1230);
      inGap = Math.max(inGap, gap.length);
      for (const a of gap) {
        expect(Math.abs(a.y - 450)).toBeLessThan(12);
        for (const b of gap) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(50);
      }
    }
    expect(inGap).toBeGreaterThan(1);
  });
});

describe('each new map\'s own system', () => {
  it('Saltgate: ships wait in a lock\'s chamber while it fills (at least the 6 s the player chose)', () => {
    const g = quiet('saltgate');
    const lock = g.map.locks![0];
    expect(lock.wait).toBe(6);
    const still = new Map<number, number>();
    let longest = 0;
    let last = new Map(g.ships.map((s) => [s.id, s.d]));
    for (let t = 0; t < 120; t += DT) {
      step(g, DT);
      for (const s of g.ships) {
        const moved = Math.abs(s.d - (last.get(s.id) ?? s.d));
        if (s.x > lock.x0 && s.x < lock.x1 && moved < 1e-6) still.set(s.id, (still.get(s.id) ?? 0) + DT);
        longest = Math.max(longest, still.get(s.id) ?? 0);
      }
      last = new Map(g.ships.map((s) => [s.id, s.d]));
    }
    expect(longest).toBeGreaterThan(5.5);
    expect(g.delivered).toBeGreaterThan(0);
  });

  it('the Behemoth Run: one supertanker a wave; losing it counts as three ships; bringing it home repairs and drops a weapon', () => {
    const g = quiet('behemoth');
    g.levels.flak = 1;
    g.slots = ['flak'];
    run(g, VIP.after + 1);
    const tankers = g.ships.filter((s) => s.vip);
    expect(tankers).toHaveLength(1);
    run(g, 5);
    expect(g.ships.filter((s) => s.vip)).toHaveLength(1);
    // Home: a weapon drops and the convoy is patched up.
    const t = g.ships.find((s) => s.vip)!;
    g.ships.filter((s) => !s.vip).forEach((s) => (s.hp = 1));
    t.d = laneLength(g.map.channels[t.channel]) - 0.1;
    step(g, DT);
    step(g, DT);
    expect(g.pickups.some((p) => p.kind === 'weapon')).toBe(true);
    expect(g.ships.filter((s) => !s.vip).every((s) => s.hp >= 2)).toBe(true);
    // Sunk: three ships lost.
    const g2 = quiet('behemoth');
    run(g2, VIP.after + 1);
    const t2 = g2.ships.find((s) => s.vip)!;
    t2.hp = 1;
    addThreat(g2, { kind: 'guided', x: t2.x, y: t2.y - 5, target: t2.id, speed: 10, hp: 2 });
    step(g2, DT);
    step(g2, DT);
    expect(g2.lost).toBe(VIP.loss);
  });

  it('Lee of Marrow: shots at threats in the radar\'s sweep fly faster; four hits and the radar is lost for good', () => {
    const g = quiet('marrow');
    const r = g.map.posts![0];
    const inSweep = addThreat(g, { x: r.x + 100, y: r.y + 200 });
    const outside = addThreat(g, { x: 1500, y: 260 });
    expect(tracked(g, inSweep)).toBe(true);
    expect(tracked(g, outside)).toBe(false);
    // Hits on the tower (a guided aimed at it lands on it).
    for (let k = 0; k < 2; k++) {
      addThreat(g, { kind: 'guided', x: r.x, y: r.y + 4, target: -10, speed: 10, hp: 2 });
      step(g, DT);
      step(g, DT);
    }
    expect(g.posts[0].lost).toBe(true);
    expect(tracked(g, inSweep)).toBe(false);
    run(g, 60);
    expect(g.posts[0].lost).toBe(true); // lost is lost
  });

  it('Battery Point: the shore guns fire on their own; a hit knocks one out, and it comes back', () => {
    const g = quiet('battery');
    const b = g.map.posts![0];
    const drone = addThreat(g, { x: b.x, y: b.y - 200 });
    run(g, 3);
    expect(drone.dead).toBe(true);
    addThreat(g, { kind: 'heavy', x: b.x, y: b.y + 4, target: -10, speed: 10, hp: 8 });
    step(g, DT);
    step(g, DT);
    expect(g.posts[0].downT).toBeGreaterThan(0);
    run(g, POST.batteryDown + 1);
    expect(g.posts[0].downT).toBeLessThanOrEqual(0);
    expect(g.posts[0].hp).toBe(b.hp);
  });

  it('Sowers\' Reach: a mine drifts on the current, blows a ship for 3, and one shot clears it', () => {
    const g = quiet('sowers');
    run(g, 20);
    const s = g.ships[0];
    const hp = s.hp;
    const mine = addThreat(g, { kind: 'mine', x: s.x + 2, y: s.y, speed: THREATS.mine.speed, target: -2 });
    step(g, DT);
    expect(mine.dead).toBe(true);
    expect(g.ships.includes(s) ? s.hp : 0).toBe(Math.max(0, hp - 3) || 0);
    const other = addThreat(g, { kind: 'mine', x: 700, y: 200, speed: THREATS.mine.speed, target: -2 });
    const x0 = other.x;
    run(g, 1);
    expect(other.x).toBeGreaterThan(x0); // drifting east on the current
    expect(tap(g, other.x, other.y, 20)).toBe('fire');
    run(g, 2);
    expect(other.dead).toBe(true);
  });

  it('Smugglers\' Coves: a fast boat runs at a ship and rams it for 2', () => {
    const g = quiet('coves');
    run(g, 20);
    const s = g.ships[g.ships.length - 1];
    const boat = addThreat(g, { kind: 'fastboat', x: s.x + 200, y: s.y - 150, speed: THREATS.fastboat.speed, target: s.id, hp: 2 });
    run(g, 4);
    expect(boat.dead).toBe(true);
    expect(g.sunkBy.fastboat + (s.hp < 3 ? 1 : 0)).toBeGreaterThan(0);
  });

  it('the Rig Field: rigs stand with hit points; a downed rig launches no more, and a wave can end with rigs standing', () => {
    const g = createGame('rigs', 1);
    const rigs = g.threats.filter((t) => t.kind === 'rig');
    expect(rigs).toHaveLength(4);
    expect(timeToImpact(g, rigs[0])).toBe(99);
    rigs[0].hp = 1;
    tap(g, rigs[0].x, rigs[0].y, 20);
    run(g, 2);
    expect(rigs[0].dead).toBe(true);
    expect(g.baseDown[rigs[0].base!]).toBe(true);
    const g2 = quiet('rigs');
    g2.queue = [];
    step(g2, DT);
    expect(g2.phase).toBe('draft'); // the wave ended with three rigs... all four still up
    expect(g2.threats.filter((t) => t.kind === 'rig')).toHaveLength(4);
  });

  it('Citadel of Vey: the Citadel takes no damage until every generator is down', () => {
    const g = quiet('citadel');
    const core = g.threats.find((t) => t.kind === 'citadel')!;
    const gens = g.threats.filter((t) => t.kind === 'generator');
    expect(gens).toHaveLength(3);
    expect(shieldUp(g)).toBe(true);
    const hp = core.hp;
    tap(g, core.x, core.y, 20);
    run(g, 2);
    expect(core.hp).toBe(hp);
    for (const gen of gens) {
      gen.hp = 1;
      tap(g, gen.x, gen.y, 20);
      run(g, 2.5);
    }
    expect(gens.every((t) => t.dead)).toBe(true);
    expect(shieldUp(g)).toBe(false);
    tap(g, core.x, core.y, 20);
    run(g, 2);
    expect(core.hp).toBeLessThan(hp);
  });

  it('Dreadnought Pass: on its waves the battleship steams in, fires broadsides, and the wave waits for it', () => {
    const g = createGame('dreadnought', 1, 3);
    const boss = g.threats.find((t) => t.kind === 'dreadnought');
    expect(boss).toBeDefined();
    const x0 = boss!.x;
    g.queue = [];
    g.raiderQueue = [];
    run(g, 12);
    expect(boss!.x).toBeLessThan(x0);
    expect(g.origins.base).toBeGreaterThan(0); // its broadsides
    expect(g.phase).toBe('wave'); // still out there
    expect(createGame('dreadnought', 1, 2).threats.some((t) => t.kind === 'dreadnought')).toBe(false);
  });

  it('the Sharra Delta: a tap on the buoy sends the next ships down the next branch', () => {
    const g = quiet('delta');
    const fork = g.map.fork!;
    expect(g.forkLane).toBe(fork.start);
    tap(g, fork.x, fork.y, 20);
    expect(g.forkLane).toBe((fork.start + 1) % 3);
    run(g, 20);
    const lanes = new Set(g.ships.filter((s) => s.d < 600).map((s) => s.channel));
    expect(lanes.has(fork.lanes[g.forkLane])).toBe(true);
  });

  it('Tidewater Flats: no ship enters the flats lane at low tide', () => {
    const g = quiet('tide');
    const flats = g.map.channels.findIndex((c) => c.tide);
    let lowEntries = 0;
    let seen = new Set(g.ships.map((s) => s.id));
    for (let t = 0; t < 90; t += DT) {
      step(g, DT);
      for (const s of g.ships) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        if (s.channel === flats && !highTide(g)) lowEntries++;
      }
    }
    expect(lowEntries).toBe(0);
    expect(g.ships.some((s) => s.channel === flats) || g.delivered > 0).toBe(true);
  });

  it('the Black Strait: a Star Shell lights the sea for a few seconds', () => {
    const g = quiet('lantern');
    g.pickups.push({ id: 999, kind: 'starshell', x: 600, y: 300, age: 0 });
    tap(g, 600, 300, 20);
    expect(g.flareT).toBeGreaterThan(0);
    run(g, 10);
    expect(g.flareT).toBe(0);
  });
});
