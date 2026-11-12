// Test Lab round 5 (docs/design/v3-lab-round5-weapons.md): the player's
// round-4 weapon notes. Each test is a real game with threats placed by hand,
// played through the calls the UI makes (tap, press / pressMove / release,
// focusHold). Shield, Focus, Supply Run, Wild Card and the cut weapons are
// in boosts.test.ts; the Cutter's and Bomber Wing's older cases in
// weapons.test.ts.

import { describe, expect, it } from 'vitest';
import { AB, ABILITIES, WEAPON, type AbilityId } from '../../src/v3/data/abilities';
import { labCard, LAB_START_WAVE } from '../../src/v3/data/lab';
import {
  CARRIER_TARGET,
  WELL_SMALL,
  applyFreePlay,
  applyLab,
  createGame,
  pickUpgrade,
  press,
  pressMove,
  release,
  screenThreat,
  spawnThreat,
  step,
  tap,
  wellPulls,
  type Game,
  type Threat,
} from '../../src/v3/sim/game';

const DT = 1 / 60;
const run = (g: Game, seconds: number, until?: () => boolean) => {
  for (let i = 0; i < Math.round(seconds / DT) && g.phase === 'wave'; i++) {
    step(g, DT);
    if (until?.()) return;
  }
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

describe('Point Defense (was Aegis Launchers)', () => {
  it('renamed everywhere it is shown, the id kept', () => {
    expect(ABILITIES.aegis.name).toBe('Point Defense');
    expect(ABILITIES.aegis.evolved).toBe('Point Defense Grid');
    expect(labCard('w-aegis')!.name).toBe('Point Defense');
    expect(JSON.stringify(ABILITIES)).not.toMatch(/Aegis|Bastion/);
  });
});

describe('Gravity Well: by size', () => {
  /** A well at (800, 300) and one threat of `kind` 120 px from it, flying
   *  across it; how far it ends from the core and how far it got along. */
  const inWell = (kind: Threat['kind'], level: number) => {
    const g = quietGame();
    load(g, 'well', level);
    g.fields.push({ kind: 'well', x1: 800, y1: 300, x2: 800, y2: 300, hw: AB.well.radius[level - 1], t: 0, life: 60, tick: 0, level });
    const th = addThreat(g, { kind, x: 680, y: 300, hp: 50, speed: 100, heading: 0, vx: 100 });
    if (kind === 'ballistic') Object.assign(th, { sx: 600, sy: 300, ix: 1400, iy: 300, dur: 8, apex: 0 });
    const free = quietGame();
    const twin = addThreat(free, { ...th, id: th.id });
    run(g, 1);
    run(free, 1);
    return { core: Math.hypot(th.x - 800, th.y - 300), moved: Math.hypot(th.x - 680, th.y - 300), freeMoved: Math.hypot(twin.x - 680, twin.y - 300) };
  };

  it('missiles of every kind, drones and small boats are pulled in at every level', () => {
    for (const kind of ['ballistic', 'guided', 'supersonic', 'heavy', 'hydra', 'dart', 'bomblet', 'heliRocket', 'drone', 'sprinter', 'fastboat'] as Threat['kind'][]) {
      expect(WELL_SMALL.has(kind), kind).toBe(true);
      for (const lv of [1, 2, 3]) {
        expect(wellPulls(kind, lv), `${kind} ${lv}`).toBe(true);
        expect(inWell(kind, lv).core, `${kind} L${lv}`).toBeLessThan(60);
      }
    }
  });

  it('big threats (aircraft, helicopters, motherships, subs, vehicles) are only slowed until MAX, which pulls everything in', () => {
    for (const kind of ['strafer', 'bomber', 'attackHeli', 'stealthBomber', 'mothership', 'tender', 'rocketTruck', 'torpedoSub'] as Threat['kind'][]) {
      expect(WELL_SMALL.has(kind), kind).toBe(false);
      expect(wellPulls(kind, 1), kind).toBe(false);
      expect(wellPulls(kind, 2), kind).toBe(false);
      expect(wellPulls(kind, 3), kind).toBe(true);
    }
    // A mothership flies on through, at a third of its pace.
    const slow = inWell('mothership', 1);
    expect(slow.core).toBeGreaterThan(60);
    expect(slow.moved).toBeGreaterThan(0);
    expect(slow.moved).toBeLessThan(slow.freeMoved * (AB.well.slow + 0.1));
    // At MAX it is dragged in like the rest.
    expect(inWell('mothership', 3).core).toBeLessThan(60);
    // Structures never move.
    expect(wellPulls('rig', 3)).toBe(false);
  });

  it('the level text says so', () => {
    // (Round 8's text audit: the same rules, in numbers.)
    expect(ABILITIES.well.levels[0]).toMatch(/Missiles, drones and small boats are pulled in/);
    expect(ABILITIES.well.levels[0]).toMatch(/slowed to 35%/);
    expect(ABILITIES.well.levels[2]).toMatch(/pulls in everything/);
  });
});

describe('Laser Cutter: holding keeps cutting', () => {
  it('waving back and forth with the finger down cuts again and again, a round per length, until the rack is dry', () => {
    const g = quietGame();
    load(g, 'cutter', 1);
    const tough = addThreat(g, { x: 800, y: 300, hp: 99 });
    // (No reloads meanwhile: the rack holds what it holds.)
    g.stats = { ...g.stats, reload: 1e9 };
    g.ammo = 4;
    press(g, 640, 300, 30);
    let x = 640;
    // Four passes over the threat, 320 px each: a round each.
    for (let pass = 0; pass < 6; pass++) {
      const to = pass % 2 ? 640 : 960;
      for (let k = 1; k <= 10; k++) {
        pressMove(g, x + ((to - x) * k) / 10, 300);
        step(g, DT);
      }
      x = to;
    }
    release(g, x, 300, 30);
    // Four rounds in the rack: four passes cut, the rest were dry.
    expect(g.ammo).toBe(0);
    expect(tough.hp).toBe(99 - 4);
    // A still finger spends nothing.
    const h = quietGame();
    load(h, 'cutter', 1);
    h.stats = { ...h.stats, reload: 1e9 };
    const ammo = h.ammo;
    press(h, 600, 300, 30);
    pressMove(h, 640, 300);
    run(h, 2);
    release(h, 640, 300, 30);
    expect(ammo - h.ammo).toBe(1);
  });
});

describe('Grapnel: the whole screen from level 1', () => {
  it('hooks a threat on the far side of the screen at level 1', () => {
    const g = quietGame();
    load(g, 'grapnel', 1);
    const c = g.map.carrier;
    const far = addThreat(g, { x: 40, y: 40, hp: 9 });
    expect(Math.hypot(far.x - c.x, far.y - c.y)).toBeGreaterThan(800);
    press(g, far.x, far.y, 30);
    expect(g.press?.mode).toBe('hook');
    expect(far.held).toBe(true);
  });

  it('level 2 swings faster and smacks for 3', () => {
    const smack = (level: number) => {
      const g = quietGame();
      load(g, 'grapnel', level);
      const ball = addThreat(g, { x: 300, y: 300, hp: 9 });
      const hit = addThreat(g, { x: 500, y: 300, hp: 9 });
      press(g, ball.x, ball.y, 30);
      pressMove(g, 900, 300);
      let t = 0;
      for (; t < 1 && hit.hp === 9; t += DT) step(g, DT);
      release(g, 900, 300, 30);
      return { dmg: 9 - hit.hp, t };
    };
    const one = smack(1);
    const two = smack(2);
    expect(one.dmg).toBe(2);
    expect(two.dmg).toBe(3);
    expect(two.t).toBeLessThan(one.t);
    expect(AB.grapnel.speed[1]).toBeGreaterThan(AB.grapnel.speed[0]);
  });
});

describe('Drone Screen: holds fire with nothing on screen', () => {
  it('no drones while the screen is empty; the first lifts off as soon as a threat shows', () => {
    const g = quietGame();
    load(g, 'droneScreen', 3);
    g.threats = [];
    run(g, 5);
    expect(screenThreat(g)).toBe(false);
    expect(g.wings).toHaveLength(0);
    // Something off the screen's edge doesn't count either.
    addThreat(g, { x: -60, y: 300, hp: 9 });
    run(g, 1);
    expect(g.wings).toHaveLength(0);
    addThreat(g, { x: 800, y: 200, hp: 9 });
    run(g, 2 * DT);
    expect(g.wings).toHaveLength(1);
    run(g, 2);
    expect(g.wings.length).toBeGreaterThan(1);
  });
});

describe('Gunship Pair and Frigate Escort: a new drop calls a leaving group back', () => {
  it('gunships on their way out turn round and come back (the same ones, not new), with a fresh clock', () => {
    const g = quietGame();
    pickUp(g, 'gunships', 1);
    run(g, 4);
    const ids = g.helis.map((h) => h.id);
    expect(ids).toHaveLength(2);
    // It runs out: they head off.
    g.weapon!.t = 0.01;
    run(g, 0.6);
    expect(g.helis.every((h) => h.leaving)).toBe(true);
    expect(g.helis.map((h) => h.id)).toEqual(ids);
    // Another gunship drop: the same two turn back.
    pickUp(g, 'gunships', 1);
    expect(g.weapon!.t).toBe(g.stats.weaponTime);
    expect(g.helis.map((h) => h.id).sort()).toEqual([...ids].sort());
    expect(g.helis.every((h) => !h.leaving)).toBe(true);
    run(g, 4);
    expect(g.helis.map((h) => h.id).sort()).toEqual([...ids].sort());
    for (const h of g.helis) expect(h.x > 0 && h.x < 1600 && h.y > 0 && h.y < 900, `${h.x},${h.y}`).toBe(true);
  });

  // (Frigates turning back was replaced in Test Lab round 8: the leaving
  // ones sail on and a fresh set comes in. labRound8.test.ts.)

  it('each gunship faces its target when it fires', () => {
    const g = quietGame();
    pickUp(g, 'gunships', 1);
    run(g, 4);
    // Threats behind and beside them.
    const [a, b] = g.helis;
    addThreat(g, { x: a.x - 200, y: a.y + 150, hp: 99 });
    addThreat(g, { x: b.x + 200, y: b.y + 150, hp: 99 });
    let fired = 0;
    for (let i = 0; i < 60 * 6; i++) {
      const before = new Set(g.hellfires.map((m) => m.id));
      step(g, DT);
      for (const m of g.hellfires) {
        if (before.has(m.id)) continue;
        const h = g.helis.reduce((p, q) => (Math.hypot(q.x - m.trail[0], q.y - m.trail[1]) < Math.hypot(p.x - m.trail[0], p.y - m.trail[1]) ? q : p));
        const want = Math.atan2(m.ty - h.y, m.tx - h.x);
        const off = Math.abs(Math.atan2(Math.sin(want - h.heading), Math.cos(want - h.heading)));
        expect(off).toBeLessThanOrEqual(AB.gunships.aim + 0.05);
        fired++;
      }
    }
    expect(fired).toBeGreaterThan(4);
  });
});

describe('Bomber Wing: aircraft and subs, seen before it hits', () => {
  it('bombs an aircraft on screen, catching it from behind, on screen a while before the bomb', () => {
    for (const level of [1, 3]) {
      const g = quietGame();
      g.queue = [{ at: g.waveT + 0.2, kind: 'strafer', side: 1 } as never, { at: 1e9, kind: 'drone', base: 0 }];
      run(g, 6, () => g.threats.some((t) => t.kind === 'strafer' && t.x > 100 && t.x < 1500 && t.y > 0 && t.y < 900));
      const jet = g.threats.find((t) => t.kind === 'strafer')!;
      expect(jet).toBeDefined();
      g.quietUntil = g.map.bases.map(() => 1e9);
      load(g, 'bomberWing', level);
      g.passiveT = 0.01;
      let cuedAt = -1;
      for (let i = 0; i < 3; i++) {
        step(g, DT);
        if (cuedAt < 0 && g.cues.some((c) => c.id === 'sortie.pass')) cuedAt = g.t;
      }
      const b = g.sorties.find((s) => s.kind === 'air' && s.ref === jet.id)!;
      expect(b, `level ${level}`).toBeDefined();
      // (This jet is near the left edge, flying right: caught from behind it
      // would be over it too soon, so the bomber comes in head on.)
      expect(Math.sign(b.vx)).toBe(-Math.sign(jet.vx));
      for (let i = 0; i < 60 * 6 && !b.hit; i++) {
        step(g, DT);
        if (cuedAt < 0 && g.cues.some((c) => c.id === 'sortie.pass')) cuedAt = g.t;
      }
      expect(b.hit).toBe(true);
      expect(jet.dead).toBe(true);
      expect(b.seen).toBeGreaterThanOrEqual(AB.bomberWing.seen);
      // The run sound's roar is the drop.
      expect(g.t - cuedAt).toBeGreaterThan(AB.bomberWing.roar - 0.2);
      expect(g.t - cuedAt).toBeLessThan(AB.bomberWing.roar + 0.2);
    }
  });

  it('bombs a torpedo sub that is up, and a periscope (the sub never comes up)', () => {
    const g = quietGame();
    const sub = spawnThreat(g, 'torpedoSub', 1100, 400, 'sub');
    g.quietUntil = g.map.bases.map(() => 1e9);
    load(g, 'bomberWing', 1);
    g.passiveT = 0.01;
    run(g, 0.05);
    expect(g.sorties.some((s) => s.kind === 'sub' && s.ref === sub.id)).toBe(true);
    run(g, 4, () => sub.dead);
    expect(sub.dead).toBe(true);
    const h = quietGame(2);
    h.foe.marks.push({ id: h.nextId++, kind: 'periscope', x: 500, y: 450, t: 0, dur: 99 });
    h.quietUntil = h.map.bases.map(() => 1e9);
    load(h, 'bomberWing', 1);
    h.passiveT = 0.01;
    run(h, 4, () => !h.foe.marks.length);
    expect(h.foe.marks).toHaveLength(0);
    expect(h.events.some((e) => e.kind === 'bigKill' && e.label === 'SUB DESTROYED')).toBe(true);
  });

  it('every bomb lands with its bomber over the target, on screen at least AB.bomberWing.seen s first', () => {
    for (const map of ['island', 'battery', 'coves'] as const) {
      const g = createGame(map, 7, 5);
      load(g, 'bomberWing', 3);
      g.weapon!.t = 1e9;
      let hits = 0;
      for (let i = 0; i < 60 * 40 && g.phase === 'wave'; i++) {
        const open = g.sorties.filter((s) => !s.hit);
        step(g, DT);
        for (const s of open) {
          if (!s.hit) continue;
          hits++;
          expect(s.seen, map).toBeGreaterThanOrEqual(AB.bomberWing.seen / 2);
          expect(Math.abs(s.x - s.tx), map).toBeLessThan(AB.bomberWing.speed * DT + 2);
        }
      }
      expect(hits, map).toBeGreaterThan(3);
    }
  });
});

describe('Hyper Overdrive (Overdrive MAX): two shots you can see', () => {
  const hyperGame = (id: AbilityId | null) => {
    const g = quietGame();
    if (id) load(g, id, 1);
    pickUp(g, 'overdrive', 3);
    if (id) g.weapon = { id, level: 1, t: WEAPON.time, t0: g.t };
    g.fx = [];
    return g;
  };

  it('a plain shot: two interceptors from two muzzles, the second flagged a twin', () => {
    const g = hyperGame(null);
    addThreat(g, { x: 700, y: 300, hp: 3 });
    tap(g, 700, 300, 30);
    expect(g.interceptors).toHaveLength(2);
    const [a, b] = g.interceptors;
    expect(a.twin).toBeUndefined();
    expect(b.twin).toBe(true);
    // Either side of the gun: twice the offset apart.
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(2 * AB.overdrive.twin, 0);
  });

  it('a Railgun: two beams from two muzzles, crossing at the target', () => {
    const g = hyperGame('railgun');
    addThreat(g, { x: 700, y: 300, hp: 9 });
    tap(g, 700, 300, 30);
    const beams = g.fx.filter((f) => f.kind === 'beam');
    expect(beams).toHaveLength(2);
    expect(beams.filter((f) => f.twin)).toHaveLength(1);
    expect(Math.hypot(beams[0].x - beams[1].x, beams[0].y - beams[1].y)).toBeGreaterThan(10);
  });

  it('every weapon\'s shot shows twice: shells, cones, blades, jets, seekers, a lance, a cut', () => {
    const count = (id: AbilityId, act: (g: Game) => void, what: (g: Game) => number) => {
      const g = hyperGame(id);
      act(g);
      return what(g);
    };
    const water = (g: Game) => tap(g, 900, 250, 30);
    const at = (g: Game) => {
      addThreat(g, { x: 900, y: 250, hp: 50 });
      tap(g, 900, 250, 30);
    };
    expect(count('flak', water, (g) => g.interceptors.filter((i) => i.weapon?.id === 'flak').length)).toBe(2);
    expect(count('thermo', water, (g) => g.interceptors.filter((i) => i.twin).length)).toBe(1);
    expect(count('scatter', at, (g) => g.fx.filter((f) => f.kind === 'frag' && f.twin).length)).toBe(AB.scatter.pellets[0]);
    expect(count('boomerang', at, (g) => g.blades.length)).toBe(2);
    expect(count('airstrike', at, (g) => g.allies.length)).toBe(2);
    expect(count('seeker', at, (g) => g.interceptors.filter((i) => i.twin).length)).toBe(AB.seeker.missiles[0]);
    expect(count('tesla', at, (g) => g.interceptors.length)).toBe(2);
    // A held lance.
    const lance = hyperGame('lance');
    addThreat(lance, { x: 900, y: 250, hp: 50 });
    press(lance, 900, 250, 30);
    run(lance, AB.lance.full + 0.1);
    release(lance, 900, 250, 30);
    expect(lance.fx.filter((f) => f.kind === 'lance')).toHaveLength(2);
    // A cut: two lines side by side.
    const cut = hyperGame('cutter');
    press(cut, 600, 300, 30);
    pressMove(cut, 800, 300);
    const lines = cut.fx.filter((f) => f.kind === 'cut');
    expect(lines.length).toBe(2);
    expect(Math.abs(lines[0].y - lines[1].y)).toBeCloseTo(AB.overdrive.twin, 0);
    release(cut, 800, 300, 30);
    // Below MAX: one of each.
    const g = quietGame();
    load(g, 'railgun', 1);
    pickUp(g, 'overdrive', 2);
    g.weapon = { id: 'railgun', level: 1, t: WEAPON.time, t0: g.t };
    addThreat(g, { x: 700, y: 300, hp: 9 });
    tap(g, 700, 300, 30);
    expect(g.fx.filter((f) => f.kind === 'beam')).toHaveLength(1);
  });

  it('the MAX level text says so', () => {
    expect(ABILITIES.overdrive.levels[2]).toMatch(/two beams/);
  });
});

describe('the Test Lab: a weapon test always offers the tested weapon\'s next level', () => {
  const draftOffers = (card: string, seed: number) => {
    const c = labCard(card)!;
    const g = createGame(c.map, seed, LAB_START_WAVE);
    applyFreePlay(g, { weapons: c.kit.map((w) => ({ id: w, level: 1 })), frequentDrops: true });
    applyLab(g, { card, length: 'full', mix: 'normal' });
    const offers: string[][] = [];
    for (let wave = 0; wave < 3; wave++) {
      g.queue = [];
      g.raiderQueue = [];
      g.threats = [];
      g.raiders = [];
      g.foe.marks = [];
      g.lab!.sets = [];
      for (let i = 0; i < 600 && g.phase === 'wave'; i++) step(g, DT);
      if (g.phase !== 'draft') break;
      offers.push([...g.offer]);
      // Take something else, so the next draft must offer it again.
      const other = g.offer.find((o) => o !== c.weapon) ?? 'resupply';
      if (!g.offer.includes(other)) g.offer.push(other);
      pickUpgrade(g, other as AbilityId);
    }
    return { offers, weapon: c.weapon! };
  };

  // (Round 8: no combo has a weapon now, so weapon cards only.)
  it('in every draft, for a weapon card, across seeds', () => {
    for (const card of ['w-orbital', 'w-railgun', 'w-shield']) {
      for (const seed of [1, 2, 3]) {
        const { offers, weapon } = draftOffers(card, seed);
        expect(offers.length, card).toBeGreaterThan(1);
        for (const o of offers) expect(o, `${card} ${seed}`).toContain(weapon);
      }
    }
  });

  it('until it is MAX', () => {
    const c = labCard('w-orbital')!;
    const g = createGame(c.map, 1, LAB_START_WAVE);
    applyFreePlay(g, { weapons: [{ id: 'orbital', level: 3 }, { id: 'flak', level: 1 }], frequentDrops: true });
    applyLab(g, { card: 'w-orbital', length: 'full', mix: 'normal' });
    g.queue = [];
    g.raiderQueue = [];
    g.threats = [];
    g.raiders = [];
    for (let i = 0; i < 600 && g.phase === 'wave'; i++) step(g, DT);
    expect(g.phase).toBe('draft');
    expect(g.offer).not.toContain('orbital');
  });
});
