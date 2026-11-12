// Test Lab round 8 (docs/design/v3-lab-round8-weapons.md): the player's
// round-7 weapon notes. Each test is a real game, played through the calls
// the UI makes (tap, press / pressMove / release, focusHold, pickUpgrade),
// with threats placed by hand. Overdrive's level 2 and Focus's other cases
// are in boosts.test.ts; the text audit's numbers in v3.test.ts.

import { describe, expect, it } from 'vitest';
import { AB, ABILITIES, ABILITY_MAX, WEAPON, type AbilityId } from '../../src/v3/data/abilities';
import { LAB_CARDS, LAB_START_WAVE, labCard } from '../../src/v3/data/lab';
import { ROSTER } from '../../src/v3/data/roster';
import { Recorder, replay } from '../../src/v3/sim/playlog';
import {
  CARRIER_TARGET,
  WILD_PASSIVES,
  applyFreePlay,
  applyLab,
  createGame,
  focusHold,
  held,
  pickUpgrade,
  press,
  pressMove,
  release,
  step,
  tap,
  type Game,
  type Threat,
} from '../../src/v3/sim/game';

const DT = 1 / 60;
const run = (g: Game, seconds: number, each?: () => void) => {
  for (let i = 0; i < Math.round(seconds / DT) && g.phase === 'wave'; i++) {
    step(g, DT);
    each?.();
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

/** Pick a weapon or boost up the way a player does: tap its pickup. */
function pickUp(g: Game, id: AbilityId, level = 1): void {
  g.levels[id] = level;
  if (!g.slots.includes(id)) g.slots.push(id);
  g.pickups.push({ id: g.nextId++, kind: 'weapon', weapon: id, x: 300, y: 600, age: 0 });
  expect(tap(g, 300, 600, 30)).toBe('pickup');
}

// ---------------------------------------------------------------------------
// Note 2: Wild Card

describe('Wild Card: from level 2 each pickup brings one random passive', () => {
  it('level 2: one passive, at level 1, working on its own clock (8 s)', () => {
    const g = quietGame();
    pickUp(g, 'wildCard', 2);
    expect(g.weapon?.id).toBe('wildCard');
    const wp = g.wildPassive!;
    expect(WILD_PASSIVES).toContain(wp.id);
    expect(ROSTER[wp.id].cat).toBe('passive');
    expect(wp.level).toBe(AB.wildCard.passive[1]);
    expect(wp.t).toBeCloseTo(g.stats.weaponTime * AB.wildCard.time, 6);
    expect(held(g, wp.id)).toBe(wp);
    expect(g.events.some((e) => e.kind === 'wild' && e.id === wp.id)).toBe(true);
    run(g, WEAPON.time * AB.wildCard.time - 0.5);
    expect(g.wildPassive).toBe(wp);
    run(g, 1);
    expect(g.wildPassive).toBeNull();
  });

  it('every passive in the roster can come, and each one works', () => {
    const passives = (Object.keys(ROSTER) as AbilityId[]).filter((id) => ROSTER[id].cat === 'passive');
    expect([...WILD_PASSIVES].sort()).toEqual(passives.sort());
    const seen = new Set<AbilityId>();
    for (let seed = 1; seed <= 40 && seen.size < passives.length; seed++) {
      const g = quietGame(seed);
      pickUp(g, 'wildCard', 2);
      const id = g.wildPassive!.id;
      seen.add(id);
      // Something to work on, then see it work.
      for (let k = 0; k < 4; k++) addThreat(g, { x: 500 + k * 120, y: 380, hp: 9, kind: 'heavy' });
      run(g, 4);
      const working =
        id === 'frigate' ? g.escorts.length > 0
        : id === 'gunships' ? g.helis.length > 0
        : id === 'droneScreen' ? g.wings.length > 0 || g.threats.some((t) => t.hp < 9)
        : id === 'aegis' ? g.ships.some((s) => s.aegis)
        : id === 'orbital' ? g.threats.some((t) => t.hp < 9)
        : true; // Bomber Wing: a pass when it has a target (below).
      expect(working, id).toBe(true);
    }
    expect([...seen].sort()).toEqual(passives.sort());
  });

  it('taps fire only active weapons now (the passive is the pickup\'s)', () => {
    const g = quietGame();
    pickUp(g, 'wildCard', 2);
    const rolled: string[] = [];
    for (let i = 0; i < 60; i++) {
      const th = addThreat(g, { x: 600 + (i % 5) * 60, y: 250, hp: 99 });
      g.ammo = g.stats.rack;
      const fx = g.fx.length;
      tap(g, th.x, th.y, 30);
      const label = g.fx.slice(fx).find((f) => f.kind === 'text')?.text;
      if (label) rolled.push(label);
      step(g, DT);
    }
    expect(rolled.length).toBeGreaterThan(30);
    const passiveNames = WILD_PASSIVES.flatMap((id) => [ABILITIES[id].name, ABILITIES[id].evolved].map((n) => n.toUpperCase()));
    for (const r of rolled) expect(passiveNames, r).not.toContain(r);
  });

  it('level 1 brings none; Jackpot brings one at level 2; a new pickup rolls again; the wave\'s end clears it', () => {
    const g = quietGame();
    pickUp(g, 'wildCard', 1);
    expect(g.wildPassive).toBeNull();
    const h = quietGame(3);
    pickUp(h, 'wildCard', 3);
    expect(h.wildPassive!.level).toBe(AB.wildCard.passive[2]);
    run(h, 3);
    const first = h.wildPassive!;
    pickUp(h, 'wildCard', 3);
    expect(h.wildPassive).not.toBe(first);
    expect(h.wildPassive!.t).toBeCloseTo(h.stats.weaponTime * AB.wildCard.time, 6);
    // Clear the wave: it goes with the field.
    h.queue = [];
    h.threats = [];
    h.raiderQueue = [];
    run(h, 30);
    expect(h.phase).toBe('draft');
    expect(h.wildPassive).toBeNull();
  });

  it('never rolls a passive already loaded in a hand', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = quietGame(seed);
      pickUp(g, 'dualWield', 1);
      pickUp(g, 'frigate', 1);
      pickUp(g, 'wildCard', 2);
      expect(g.wildPassive!.id).not.toBe('frigate');
    }
  });
});

// ---------------------------------------------------------------------------
// Note 3: Grapnel

describe('Grapnel: a thrown threat bursts on the first threat it runs into', () => {
  /** Hook `ball`, swing it right, let go mid-swing: it is thrown right. */
  const throwRight = (g: Game, ball: Threat) => {
    press(g, ball.x, ball.y, 30);
    pressMove(g, ball.x + 700, ball.y);
    for (let i = 0; i < 6; i++) step(g, DT);
    release(g, ball.x, ball.y, 30);
    expect(g.flings).toHaveLength(1);
  };

  it('a ball the burst kills explodes on impact, hitting the one it ran into', () => {
    const g = quietGame();
    pickUp(g, 'grapnel', 1);
    const ball = addThreat(g, { x: 300, y: 300, hp: 1 });
    const hit = addThreat(g, { x: 560, y: 300, hp: 9 });
    throwRight(g, ball);
    let t = 0;
    for (; t < 1 && hit.hp === 9; t += DT) step(g, DT);
    expect(t).toBeLessThan(AB.grapnel.fly);
    expect(hit.hp).toBe(9 - AB.grapnel.burst[0]);
    expect(ball.dead).toBe(true);
    expect(g.flings).toHaveLength(0);
  });

  it('a ball with health left keeps it and flies on, bursting again on the next one it runs into; no burst at the end', () => {
    const g = quietGame();
    pickUp(g, 'grapnel', 1);
    const ball = addThreat(g, { x: 300, y: 300, hp: 9 });
    const a = addThreat(g, { x: 480, y: 300, hp: 9 });
    const b = addThreat(g, { x: 640, y: 300, hp: 9 });
    throwRight(g, ball);
    const xs: number[] = [];
    run(g, AB.grapnel.fly + 0.2, () => xs.push(ball.x));
    const d = AB.grapnel.burst[0];
    expect(a.hp).toBe(9 - d);
    expect(b.hp).toBe(9 - d);
    // Hit by its own two bursts, and nothing more.
    expect(ball.dead).toBe(false);
    expect(ball.hp).toBe(9 - 2 * d);
    expect(ball.held).toBe(false);
    // It kept going past the first.
    expect(Math.max(...xs)).toBeGreaterThan(b.x - AB.grapnel.impactR);
  });

  it('a throw that meets nothing bursts where it lands, as before', () => {
    const g = quietGame();
    pickUp(g, 'grapnel', 1);
    const ball = addThreat(g, { x: 300, y: 300, hp: 1 });
    throwRight(g, ball);
    let t = 0;
    for (; t < 1 && !ball.dead; t += DT) step(g, DT);
    expect(ball.dead).toBe(true);
    expect(t).toBeGreaterThanOrEqual(AB.grapnel.fly - 0.15);
  });
});

// ---------------------------------------------------------------------------
// Note 3: the lab's draft

/** Empty the field so the wave ends, and run to the draft. */
function toDraft(g: Game): boolean {
  g.queue = [];
  g.raiderQueue = [];
  g.threats = [];
  g.raiders = [];
  g.foe.marks = [];
  if (g.lab) g.lab.sets = [];
  for (let i = 0; i < 1200 && g.phase === 'wave'; i++) step(g, DT);
  return g.phase === 'draft';
}

/** A weapon card's test as the lab starts it (Free Play's kit at level 1,
 *  frequent drops), from `wave`. */
function labRun(card: string, seed: number, wave: number): Game {
  const c = labCard(card)!;
  const g = createGame(c.map, seed, wave);
  applyFreePlay(g, { weapons: c.kit.map((w) => ({ id: w, level: 1 })), frequentDrops: true });
  applyLab(g, { card, length: 'full', mix: 'normal' });
  return g;
}

const WEAPON_CARDS = LAB_CARDS.filter((c) => c.weapon && (c.kind === 'weapon' || c.kind === 'combo'));

describe('the Test Lab: every draft of a weapon test deals the tested weapon first', () => {
  it('covers every weapon card (one per weapon) and every combo with a weapon', () => {
    expect(WEAPON_CARDS.filter((c) => c.kind === 'weapon')).toHaveLength(Object.keys(ABILITIES).length);
    expect(WEAPON_CARDS.filter((c) => c.kind === 'combo').length).toBeGreaterThan(0);
  });

  for (const c of WEAPON_CARDS) {
    it(`${c.id}: first in every draft, picking something else each time (from wave ${LAB_START_WAVE} and from 11)`, () => {
      for (const wave of [LAB_START_WAVE, 11]) {
        for (const seed of [1, 2]) {
          const g = labRun(c.id, seed, wave);
          for (let d = 0; d < 3; d++) {
            expect(toDraft(g), `${c.id} wave ${wave} seed ${seed} draft ${d}`).toBe(true);
            expect(g.offer[0], `${c.id} wave ${wave} seed ${seed} draft ${d}: ${g.offer.join()}`).toBe(c.weapon);
            const other = g.offer.find((o) => o !== c.weapon && o !== 'resupply' && (g.levels[o] ?? 0) > 0) ?? 'resupply';
            if (!g.offer.includes(other)) g.offer.push(other);
            pickUpgrade(g, other);
          }
        }
      }
    });
  }

  it('taken each time, it is offered until MAX and then left to the normal draft', () => {
    for (const c of WEAPON_CARDS.filter((o) => o.kind === 'weapon')) {
      const g = labRun(c.id, 3, LAB_START_WAVE);
      for (let lv = 1; lv < ABILITY_MAX; lv++) {
        expect(toDraft(g)).toBe(true);
        expect(g.offer[0], c.id).toBe(c.weapon);
        pickUpgrade(g, c.weapon!);
      }
      expect(g.levels[c.weapon!]).toBe(ABILITY_MAX);
      expect(toDraft(g)).toBe(true);
      expect(g.offer, c.id).not.toContain(c.weapon);
    }
  });

  it('swapped out of the loadout, it comes back as a card to swap in', () => {
    const g = labRun('w-grapnel', 1, LAB_START_WAVE);
    expect(toDraft(g)).toBe(true);
    const fresh = (Object.keys(ABILITIES) as AbilityId[]).find((id) => !(g.levels[id] ?? 0))!;
    g.offer = [fresh, ...g.offer.filter((o) => o !== fresh)];
    pickUpgrade(g, fresh, 'grapnel');
    expect(g.levels.grapnel ?? 0).toBe(0);
    expect(toDraft(g)).toBe(true);
    expect(g.offer[0]).toBe('grapnel');
  });
});

// ---------------------------------------------------------------------------
// Note 4: Drone Screen

describe('Drone Screen: with nothing left to ram, the drones fly home and land', () => {
  it('they turn for the deck (no snapping round), stay on screen and land', () => {
    const g = quietGame();
    pickUp(g, 'droneScreen', 1);
    const c = g.map.carrier;
    const far = addThreat(g, { x: c.x + 400, y: 120, hp: 99 });
    run(g, 2.5);
    expect(g.wings.length).toBeGreaterThan(0);
    // The target goes: every drone is out over the water with nothing to do.
    far.dead = true;
    g.threats = [];
    const before = new Map(g.wings.map((w) => [w.id, w.heading]));
    let maxTurn = 0;
    let minY = Infinity;
    let maxDist = 0;
    const start = Math.max(...g.wings.map((w) => Math.hypot(w.x - c.x, w.y - c.y)));
    for (let i = 0; i < 60 * 4 && g.wings.length; i++) {
      step(g, DT);
      for (const w of g.wings) {
        const h0 = before.get(w.id);
        if (h0 !== undefined) {
          const d = Math.abs(Math.atan2(Math.sin(w.heading - h0), Math.cos(w.heading - h0)));
          if (Math.hypot(w.x - c.x, w.y - c.y) > 60) maxTurn = Math.max(maxTurn, d);
        }
        before.set(w.id, w.heading);
        minY = Math.min(minY, w.y);
        maxDist = Math.max(maxDist, Math.hypot(w.x - c.x, w.y - c.y));
      }
    }
    expect(g.wings).toHaveLength(0);
    expect(minY).toBeGreaterThan(0);
    // At most a turning circle further out while it banks round.
    expect(maxDist).toBeLessThanOrEqual(start + (2 * AB.droneScreen.speed * AB.droneScreen.home) / AB.droneScreen.turn);
    expect(maxTurn).toBeLessThanOrEqual(AB.droneScreen.turn * DT + 1e-6);
  });

  it('a spare drone waits over the deck while every threat already has one on it', () => {
    const g = quietGame();
    pickUp(g, 'droneScreen', 3);
    const c = g.map.carrier;
    addThreat(g, { x: c.x + 500, y: 80, hp: 99 });
    run(g, 2.2);
    const spare = g.wings.filter((w) => w.target === null);
    expect(spare.length).toBeGreaterThan(0);
    for (const w of spare) {
      expect(Math.hypot(w.x - c.x, w.y - (c.y - 8 - AB.droneScreen.wait))).toBeLessThan(60);
    }
  });

  it('a drone out of time flies home too, and a ram still spends the drone', () => {
    const g = quietGame();
    pickUp(g, 'droneScreen', 1);
    const c = g.map.carrier;
    const t = addThreat(g, { x: c.x, y: c.y - 300, hp: 1 });
    run(g, 2);
    expect(t.dead).toBe(true);
    run(g, 3);
    expect(g.wings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Note 5: Focus (the sim side; the button itself is in e2e/v3.mjs)

describe('Focus: a button held to slow time', () => {
  it('only the button slows time: taps while it is held are shots, and it ends the step it comes up', () => {
    const g = quietGame();
    pickUp(g, 'focus', 1);
    const th = addThreat(g, { x: 700, y: 300, hp: 9 });
    // A tap with nothing held: a shot at full speed.
    const shots = g.shots;
    expect(tap(g, th.x, th.y, 30)).toBe('fire');
    expect(g.shots).toBe(shots + 1);
    step(g, DT);
    expect(g.focusing).toBe(false);
    focusHold(g, true);
    expect(tap(g, th.x, th.y, 30)).toBe('fire');
    step(g, DT);
    expect(g.focusing).toBe(true);
    expect(g.finger).toBe(true);
    focusHold(g, false);
    step(g, DT);
    expect(g.focusing).toBe(false);
  });

  it('ends with the boost: another boost picked up (or the wave cleared) lets go of the button', () => {
    const g = quietGame();
    pickUp(g, 'focus', 1);
    focusHold(g, true);
    step(g, DT);
    expect(g.focusing).toBe(true);
    pickUp(g, 'overdrive', 1);
    expect(g.finger).toBe(false);
    step(g, DT);
    expect(g.focusing).toBe(false);
    // A new Focus doesn't start in slow motion.
    pickUp(g, 'focus', 1);
    step(g, DT);
    expect(g.focusing).toBe(false);
  });

  it('the button\'s downs and ups are in the play log, and the run replays exactly', () => {
    const g = createGame('strait', 7, 3);
    const setup = { weapons: [{ id: 'focus' as AbilityId, level: 2 }, { id: 'flak' as AbilityId, level: 1 }], frequentDrops: true };
    applyFreePlay(g, setup);
    const rec = new Recorder(g, { build: 'test', startedAt: '2026-11-10T00:00:00Z', firstWave: 3, freePlay: setup } as never);
    let slow = 0;
    for (let i = 0; i < 60 * 60 && g.phase === 'wave'; i++) {
      if (i % 30 === 0 && g.pickups.length) rec.tap(g.pickups[0].x, g.pickups[0].y, 30);
      if (i % 90 === 0 && g.boost?.id === 'focus') rec.focus(true);
      if (i % 90 === 40) rec.focus(false);
      const th = g.threats.find((t) => !t.dead && t.y > 100 && t.y < 800);
      if (i % 15 === 0 && th) rec.tap(th.x, th.y, 30);
      step(g, DT);
      if (g.focusing) slow++;
    }
    const log = rec.snapshot();
    expect(log.commands.filter((c) => c[1] === 'h').length).toBeGreaterThan(4);
    expect(slow).toBeGreaterThan(60);
    const r = replay(log);
    expect(r.steps).toBe(g.steps);
    expect(r.t).toBeCloseTo(g.t, 9);
    expect(r.score).toBe(g.score);
    expect(r.kills).toEqual(g.kills);
  });
});

// ---------------------------------------------------------------------------
// Note 7: Frigate Escort

describe('Frigate Escort: a new drop while they sail off sends a fresh set in', () => {
  it('the leaving ones keep going off the screen (none turns round); new ones sail in to station', () => {
    const g = quietGame();
    pickUp(g, 'frigate', 1);
    run(g, 8);
    const old = g.escorts.map((e) => e.id);
    expect(old).toHaveLength(2);
    g.weapon!.t = 0.01;
    run(g, 1.5);
    expect(g.escorts.every((e) => e.leaving)).toBe(true);
    pickUp(g, 'frigate', 1);
    const fresh = g.escorts.filter((e) => !old.includes(e.id));
    expect(fresh).toHaveLength(AB.frigate.ships[0]);
    expect(fresh.every((e) => !e.leaving)).toBe(true);
    expect(g.escorts.filter((e) => old.includes(e.id)).every((e) => e.leaving)).toBe(true);
    // Nobody ever sails back up the lane.
    const last = new Map(g.escorts.map((e) => [e.id, e.d]));
    let back = 0;
    run(g, 10, () => {
      for (const e of g.escorts) {
        if ((last.get(e.id) ?? -Infinity) > e.d + 1e-6) back++;
        last.set(e.id, e.d);
      }
    });
    expect(back).toBe(0);
    // The old pair is gone off the end of its lane; the new pair is on station.
    expect(g.escorts.map((e) => e.id).sort()).toEqual(fresh.map((e) => e.id).sort());
    for (const e of g.escorts) expect(Math.abs(e.d - e.sd)).toBeLessThan(2);
  });

  it('a drop while they are on station keeps them there on a fresh clock (no new ships)', () => {
    const g = quietGame();
    pickUp(g, 'frigate', 1);
    run(g, 8);
    const ids = g.escorts.map((e) => e.id);
    pickUp(g, 'frigate', 1);
    expect(g.escorts.map((e) => e.id)).toEqual(ids);
    expect(g.weapon!.t).toBeCloseTo(g.stats.weaponTime, 6);
  });

  it('levelled up to MAX while on station: the third frigate joins, the two stay put', () => {
    const g = quietGame();
    pickUp(g, 'frigate', 2);
    run(g, 8);
    const before = g.escorts.map((e) => ({ id: e.id, sd: e.sd }));
    pickUp(g, 'frigate', 3);
    expect(g.escorts).toHaveLength(3);
    for (const b of before) expect(g.escorts.find((e) => e.id === b.id)!.sd).toBe(b.sd);
  });
});
