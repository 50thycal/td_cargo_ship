// Test Lab round 6 (docs/design/v3-events-round6.md): the player's notes on
// the special events. No Nuke in any event; the Wolf Pack's spreads and fast
// torpedoes; the Shield Wall from several launch points; Supply Raid
// scavengers from every side; the Dive Circus's missiles; the Bombardment's
// supply drones; the new Fire Mission; the Repair Yard's repair ships
// converging (and the one that never moved); and the lab bar's "Run n of 3".

import { describe, expect, it } from 'vitest';
import { PICKUPS, VIEW } from '../../src/v3/data/config';
import { AB } from '../../src/v3/data/abilities';
import { EV, EVENT, EVENT_ORDER, EVENT_WAVE, eventMap, type EventId } from '../../src/v3/data/events';
import { LAB_CHANGES, LAB_EVENT_RUNS, LAB_ROUNDS, labCard } from '../../src/v3/data/lab';
import { addPickup, applyFreePlay, applyLab, createGame, damageThreat, step, type Game, type Threat } from '../../src/v3/sim/game';
import { eventDropWeights } from '../../src/v3/sim/events';
import { onLand } from '../../src/v3/sim/foes';
import { labCountText, type LabStats } from '../../src/v3/sim/lab';
import { Bot, SKILLS } from '../../src/v3/sim/bot';

const DT = 1 / 60;

function run(g: Game, seconds: number, done: () => boolean = () => false): void {
  for (let i = 0; i < seconds / DT && g.phase === 'wave' && !done(); i++) step(g, DT);
}

/** An event's game at its wave (the first run of the ending: the tests
 *  stop as it ends), the convoy unsinkable, straight in. */
function eventGame(id: EventId, seed = 1): Game {
  const g = createGame(eventMap(id), seed, EVENT_WAVE);
  g.tempo = { ...g.tempo, lossLimit: 999 };
  g.carrierHp = 999;
  g.event!.t0 = 0;
  return g;
}

/** A lab event card's game, as the hub starts it. */
function labGame(id: EventId, seed: number, kit?: { id: string; level: number }[]): Game {
  const card = labCard(`ev-${id}`)!;
  const g = createGame(card.map, seed, card.wave);
  applyFreePlay(g, { weapons: (kit ?? card.kit.map((w) => ({ id: w, level: 2 }))) as never, frequentDrops: true });
  applyLab(g, { card: card.id, length: 'full', mix: 'normal' });
  return g;
}

describe('round 6: the round and its lines', () => {
  it('round 6 is in the lab, and each changed event card has its line', () => {
    expect(LAB_ROUNDS.find((r) => r.n === 6)).toEqual({ n: 6, date: '2026-11-10', name: 'Special events, second pass', since: '2026-11-10T04:00' });
    const changed = ['rocket-convoy', 'wolf-pack', 'shield-wall', 'supply-raid', 'dive-circus', 'bombardment', 'fire-mission', 'repair-yard'];
    for (const id of EVENT_ORDER) {
      const r6 = (LAB_CHANGES[`ev-${id}`] ?? []).filter((c) => c.round === 6);
      if (changed.includes(id)) expect(r6.length, id).toBe(1);
    }
    // The player's "keep it as it is" events are not touched.
    for (const id of ['rush', 'gunship-wall', 'blackout', 'decoy-storm', 'hydra-bloom', 'carpet-run', 'escort-run', 'siren-field', 'firestorm']) {
      expect((LAB_CHANGES[`ev-${id}`] ?? []).some((c) => c.round === 6), id).toBe(false);
    }
  });
});

describe('no Nuke in any special event ("no nukes for these special events")', () => {
  it('the drop table has no Nuke while any event runs (and has one again after)', () => {
    for (const id of EVENT_ORDER) {
      const g = eventGame(id);
      const w: Record<string, number> = { ...PICKUPS.weights, nuke: 50 };
      eventDropWeights(g, w, 16);
      expect(w.nuke, id).toBe(0);
    }
    const g = createGame('kesh', 1, 5);
    const w: Record<string, number> = { ...PICKUPS.weights };
    eventDropWeights(g, w, 16);
    expect(w.nuke).toBe(PICKUPS.weights.nuke);
  });

  it('anything that would put a Nuke on the water in an event puts a repair there instead; outside one, a Nuke is a Nuke', () => {
    const g = eventGame('bombardment');
    addPickup(g, 'nuke', 500, 400);
    expect(g.pickups.at(-1)!.kind).toBe('repair');
    const free = createGame('kesh', 1, 5);
    addPickup(free, 'nuke', 500, 400);
    expect(free.pickups.at(-1)!.kind).toBe('nuke');
  });

  it("the Supply Raid's cargo has no Nuke", () => {
    const g = eventGame('supply-raid');
    const kinds: string[] = [];
    for (let i = 0; i < 40 / DT && g.phase === 'wave'; i++) {
      for (const pl of g.planes) for (const d of pl.drops) kinds.push(d.kind);
      step(g, DT);
    }
    expect(kinds.length).toBeGreaterThan(8);
    expect(kinds).not.toContain('nuke');
  });

  it("Airdrop's planes drop no Nuke in an event, even if every crate rolled one", () => {
    const sure = AB.supplyRun as { nuke: number };
    const was = sure.nuke;
    sure.nuke = 1;
    try {
      const g = eventGame('dive-circus');
      g.slots = ['supplyRun'];
      g.levels = { supplyRun: 3 };
      g.boost = { id: 'supplyRun', level: 3, t: 30, n: 0, bank: 0, crateT: 0.1, age: 0 };
      const kinds: string[] = [];
      for (let i = 0; i < 20 / DT && g.phase === 'wave'; i++) {
        for (const pl of g.planes) for (const d of pl.drops) kinds.push(d.kind);
        step(g, DT);
      }
      expect(kinds.length).toBeGreaterThan(1);
      expect(kinds).not.toContain('nuke');
    } finally {
      sure.nuke = was;
    }
  });

  it('a bot playing every event, with drops frequent, never sees a Nuke on the water while it runs', () => {
    for (const id of EVENT_ORDER) {
      const g = labGame(id, 11);
      const bot = new Bot(SKILLS.sharp, 11);
      let seen = 0;
      for (let i = 0; i < 30 * 90 && g.phase === 'wave'; i++) {
        bot.act(g);
        step(g, 1 / 30);
        if (g.event && g.pickups.some((p) => p.kind === 'nuke')) seen += 1;
      }
      expect(seen, id).toBe(0);
    }
  });
});

describe('Wolf Pack: spreads, and one or two fast torpedoes', () => {
  it('every sub fires two or three torpedoes on different headings; one or two of the event\'s torpedoes are fast', () => {
    const E = EV['wolf-pack'];
    for (const seed of [1, 2, 3]) {
      const g = eventGame('wolf-pack', seed);
      const torps = new Map<number, Threat>();
      const when = new Map<number, number>();
      for (let i = 0; i < 40 / DT && g.phase === 'wave' && g.wave === EVENT_WAVE; i++) {
        step(g, DT);
        for (const t of g.threats)
          if (t.kind === 'torpedo' && !torps.has(t.id)) {
            torps.set(t.id, { ...t, foe: { ...t.foe! } });
            when.set(t.id, g.steps);
          }
      }
      // A sub's spread: the torpedoes fired from one spot in one step.
      const bySub = new Map<string, Threat[]>();
      for (const t of torps.values()) {
        const k = `${Math.round(t.foe!.sx!)},${Math.round(t.foe!.sy!)},${when.get(t.id)}`;
        bySub.set(k, [...(bySub.get(k) ?? []), t]);
      }
      expect(bySub.size, `seed ${seed}`).toBe(E.packs.reduce((a, n) => a + n, 0));
      for (const spread of bySub.values()) {
        expect(spread.length).toBeGreaterThanOrEqual(E.spread[0]);
        expect(spread.length).toBeLessThanOrEqual(E.spread[1]);
        // Each on its own heading (a dashed line each).
        for (let a = 0; a < spread.length; a++)
          for (let b = a + 1; b < spread.length; b++) {
            const d = Math.abs(Math.atan2(Math.sin(spread[a].heading - spread[b].heading), Math.cos(spread[a].heading - spread[b].heading)));
            expect(d).toBeGreaterThan(0.15);
          }
      }
      const fast = [...torps.values()].filter((t) => t.foe!.fast);
      expect(fast.length, `seed ${seed}`).toBeGreaterThanOrEqual(1);
      expect(fast.length).toBeLessThanOrEqual(2);
      const slow = [...torps.values()].find((t) => !t.foe!.fast)!;
      for (const t of fast) expect(t.speed).toBeCloseTo(slow.speed * E.fastSpeed, 5);
      // Not one per sub: in the whole event.
      expect(new Set(fast.map((t) => `${t.foe!.sx},${t.foe!.sy},${when.get(t.id)}`)).size).toBe(fast.length);
    }
  });
});

describe('Shield Wall: from several launch points, joining up', () => {
  it('its rows come from three launch points along the shore and form one block before it sets off', () => {
    for (const seed of [1, 2, 5]) {
      const g = eventGame('shield-wall', seed);
      const starts = new Map<number, { x: number; y: number }>();
      let formedAt: Threat[] | null = null;
      for (let i = 0; i < 30 / DT && g.phase === 'wave' && !formedAt; i++) {
        step(g, DT);
        for (const t of g.threats) if (t.kind === 'armored' && !starts.has(t.id)) starts.set(t.id, { x: t.foe!.sx!, y: t.foe!.sy! });
        if (g.event?.formed) formedAt = g.threats.filter((t) => t.kind === 'armored' && !t.dead);
      }
      expect(starts.size).toBe(EV['shield-wall'].drones);
      // Three launch points (each row's), well apart.
      const rowsAt = [...new Set([...starts.values()].map((p) => Math.round(p.x / 100)))];
      expect(rowsAt.length, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      const xs = [...starts.values()].map((p) => p.x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(EV['shield-wall'].spread);
      // Formed: one block, every drone close to the rest, all at one ship.
      expect(formedAt, `seed ${seed}: formed`).not.toBeNull();
      const block = formedAt!;
      const cx = block.reduce((a, t) => a + t.x, 0) / block.length;
      const cy = block.reduce((a, t) => a + t.y, 0) / block.length;
      for (const t of block) expect(Math.hypot(t.x - cx, t.y - cy)).toBeLessThan(110);
      expect(new Set(block.map((t) => t.target)).size).toBe(1);
    }
  });
});

describe('Supply Raid: more scavengers, from every side', () => {
  it('six scavengers a run, from all four sides of the screen, each leaving the way it came', () => {
    const g = eventGame('supply-raid', 2);
    const from = new Map<number, { x: number; y: number }>();
    for (let i = 0; i < 40 / DT && g.phase === 'wave'; i++) {
      step(g, DT);
      for (const t of g.threats) if (t.kind === 'scavenger' && !from.has(t.id)) from.set(t.id, { x: t.x, y: t.y });
    }
    expect(from.size).toBe(EV['supply-raid'].scav.reduce((a, n) => a + n, 0));
    const side = (p: { x: number; y: number }) => (p.x < 0 ? 'left' : p.x > VIEW.width ? 'right' : p.y < 0 ? 'top' : p.y > VIEW.height ? 'bottom' : 'on');
    expect(new Set([...from.values()].map(side))).toEqual(new Set(['left', 'right', 'top', 'bottom']));
  });
});

describe('Dive Circus: more than planes', () => {
  it('missile pairs come on the off-beats between the dives', () => {
    const g = eventGame('dive-circus', 3);
    const dives: number[] = [];
    const missiles: number[] = [];
    const seen = new Set<number>();
    for (let i = 0; i < 40 / DT && g.phase === 'wave' && g.wave === EVENT_WAVE; i++) {
      step(g, DT);
      for (const m of g.foe.marks) if (m.kind === 'dive' && !seen.has(m.id)) (seen.add(m.id), dives.push(g.event?.t ?? 0));
      for (const t of g.threats) if (t.kind === 'guided' && !seen.has(t.id)) (seen.add(t.id), missiles.push(g.event?.t ?? 0));
    }
    expect(dives).toHaveLength(EV['dive-circus'].planes);
    expect(missiles).toHaveLength(EV['dive-circus'].pairs * 2);
    // Each pair between two dives, not on one.
    for (const t of missiles) {
      const near = Math.min(...dives.map((d) => Math.abs(d - t)));
      expect(near).toBeGreaterThan(0.2);
      expect(dives.some((d) => d < t) && dives.some((d) => d > t)).toBe(true);
    }
  });
});

describe('Bombardment: supply drones that drop pickups', () => {
  it('every supply drone shot down drops a pickup: repairs, ammo and your weapons, never a Nuke', () => {
    const g = eventGame('bombardment', 4);
    g.slots = ['lance', 'bomberWing'];
    g.levels = { lance: 2, bomberWing: 2 };
    const dropped: string[] = [];
    let killed = 0;
    for (let i = 0; i < 30 / DT && g.phase === 'wave'; i++) {
      step(g, DT);
      for (const t of g.threats.filter((o) => o.cargo && !o.dead && o.x > 0 && o.x < VIEW.width && o.y > 0 && o.y < VIEW.height)) {
        const before = g.pickups.length;
        damageThreat(g, t, 99);
        killed += 1;
        expect(g.pickups.length, 'a drop for every one').toBe(before + 1);
        dropped.push(g.pickups.at(-1)!.kind);
      }
    }
    expect(killed).toBe(EV.bombardment.swarms * EV.bombardment.size);
    expect(new Set(dropped)).toEqual(new Set(['repair', 'ammo', 'weapon']));
    expect(dropped).not.toContain('nuke');
  });
});

describe('the new Fire Mission: spotters taking turns, walking barrages', () => {
  it('three spotters, each from its own side, take turns; each paints a ship and calls a barrage that walks down its course', () => {
    const E = EV['fire-mission'];
    const g = eventGame('fire-mission', 2);
    // Ten waves in, the convoy is under way when the event comes.
    g.event!.t0 = 30;
    const firstAt = new Map<number, { x: number; y: number }>();
    const barrages: { x: number; y: number; dur: number }[][] = [];
    const known = new Set<number>();
    let marks = 0;
    for (let i = 0; i < 75 / DT && g.phase === 'wave' && g.wave === EVENT_WAVE; i++) {
      const before = g.event?.barrages ?? 0;
      step(g, DT);
      for (const t of g.threats) if (t.kind === 'spotter' && !firstAt.has(t.id)) firstAt.set(t.id, { x: t.x, y: t.y });
      const fresh = g.foe.marks.filter((m) => m.kind === 'shell' && !known.has(m.id));
      for (const m of fresh) known.add(m.id);
      if ((g.event?.barrages ?? 0) > before) {
        barrages.push(fresh.map((m) => ({ x: m.x, y: m.y, dur: m.dur })));
        marks += fresh.length;
      }
    }
    expect(firstAt.size).toBe(E.spotters * E.turns);
    // From the left, the right and the far side.
    const sides = new Set([...firstAt.values()].map((p) => (p.x < 0 ? 'left' : p.x > VIEW.width ? 'right' : 'far')));
    expect(sides).toEqual(new Set(['left', 'right', 'far']));
    expect(barrages).toHaveLength(E.spotters * E.turns);
    expect(marks).toBe(E.spotters * E.turns * E.shells);
    for (const b of barrages) {
      // One after another, along a line (the ship's course).
      const byTime = [...b].sort((p, q) => p.dur - q.dur);
      for (let k = 1; k < byTime.length; k++) {
        expect(byTime[k].dur).toBeGreaterThan(byTime[k - 1].dur);
        expect(Math.hypot(byTime[k].x - byTime[k - 1].x, byTime[k].y - byTime[k - 1].y)).toBeGreaterThan(20);
      }
    }
  });

  it('a spotter shot down before it calls takes its barrage and its turns to come; one that survives keeps its damage', () => {
    const E = EV['fire-mission'];
    const g = eventGame('fire-mission', 2);
    g.event!.t0 = 30;
    // The first spotter is shot down while it paints, before it calls; the
    // second takes one hit on its first turn and comes back with it.
    let downed = false;
    let hit = -1;
    let back = -1;
    for (let i = 0; i < 75 / DT && g.phase === 'wave'; i++) {
      step(g, DT);
      const crew = g.event?.crew;
      if (!crew) continue;
      const live = (k: number) => g.threats.find((t) => t.kind === 'spotter' && !t.dead && t.id === crew[k].id && t.foe!.state === 1);
      const first = live(0);
      if (first && !downed) {
        const before = g.event!.barrages;
        damageThreat(g, first, 99);
        downed = true;
        run(g, E.call + 0.5);
        expect(g.event!.barrages, 'its barrage never comes').toBe(before);
        expect(crew[0].down).toBe(true);
      }
      const second = live(1);
      if (second && hit < 0) {
        damageThreat(g, second, 1);
        hit = second.id;
      } else if (second && hit > 0 && second.id !== hit && back < 0) back = second.hp;
    }
    expect(downed).toBe(true);
    expect(back).toBe(E.hp - 1);
    // The first spotter's second turn never came.
    expect(g.eventLog[0].sent.spotter).toBe(E.spotters * E.turns - 1);
  });

  it("its card names it and gives no rule: no tell", () => {
    const card = labCard('ev-fire-mission')!;
    expect(card.look.toLowerCase()).not.toMatch(/shoot|kill|before it|first/);
  });
});

describe('Repair Yard: from every side to one spot, and no ship that never moves', () => {
  it("the player's run (seed 81721): every repair ship sails in from off the screen and none rises in the closed cove", () => {
    const g = labGame('repair-yard', 81721, [{ id: 'lance', level: 2 }, { id: 'cadence', level: 2 }, { id: 'orbital', level: 2 }]);
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = 999;
    run(g, EVENT.convoyWait + EVENT.breather + 1, () => g.threats.some((t) => t.kind === 'tender'));
    const tenders = g.threats.filter((t) => t.kind === 'tender');
    expect(tenders).toHaveLength(3);
    for (const t of tenders) {
      expect(t.x < 0 || t.x > VIEW.width || t.y < 0 || t.y > VIEW.height, `starts off screen (${t.x}, ${t.y})`).toBe(true);
      expect(t.foe!.n).toBe(0);
    }
  });

  it('over twenty seeds: three repair ships from different sides, every one travels and reaches its place round one spot', () => {
    const E = EV['repair-yard'];
    for (let seed = 1; seed <= 20; seed++) {
      const g = eventGame('repair-yard', seed);
      run(g, EVENT.breather + 0.2, () => g.threats.some((t) => t.kind === 'tender'));
      const tenders = g.threats.filter((t) => t.kind === 'tender');
      expect(tenders).toHaveLength(E.tenders);
      const start = tenders.map((t) => ({ x: t.x, y: t.y }));
      const spots = tenders.map((t) => ({ x: t.foe!.px, y: t.foe!.py }));
      // One meeting spot: every place on the ring round it (or on it).
      const { x: mx, y: my } = g.event!.yard!;
      expect(onLand(g, mx, my)).toBe(false);
      for (const p of spots) expect(Math.hypot(p.x - mx, p.y - my), `seed ${seed}`).toBeLessThan(E.ring + 2);
      // From different directions, seen from the spot (on Smugglers' Coves
      // the water lets them in from the west, the east and the north-east,
      // across the lane), and from both sides of the screen.
      const bear = start.map((p) => Math.atan2(p.y - my, p.x - mx));
      for (let a = 0; a < bear.length; a++)
        for (let b = a + 1; b < bear.length; b++) expect(Math.abs(Math.atan2(Math.sin(bear[a] - bear[b]), Math.cos(bear[a] - bear[b]))), `seed ${seed}`).toBeGreaterThan(0.6);
      expect(start.some((p) => p.x < 0) && start.some((p) => p.x > VIEW.width), `seed ${seed}: both sides`).toBe(true);
      // Every one sails, over water, and gets there.
      for (let i = 0; i < 30 / DT && tenders.some((t) => !t.dead && t.foe!.n === 0); i++) {
        step(g, DT);
        for (const t of tenders) if (!t.dead && t.x > 0 && t.x < VIEW.width && t.y > 0 && t.y < VIEW.height) expect(onLand(g, t.x, t.y), `seed ${seed}: on land`).toBe(false);
      }
      tenders.forEach((t, k) => {
        expect(Math.hypot(t.x - start[k].x, t.y - start[k].y), `seed ${seed}: travelled`).toBeGreaterThan(150);
        if (!t.dead) expect(t.foe!.n, `seed ${seed}: on station`).toBe(1);
      });
    }
  });
});

describe('the lab bar: which run it is', () => {
  const s: LabStats = { came: 0, killed: 0, early: 0, harm: 0, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [], clean: 1, held: 0, broken: 0 };
  it('an event card\'s Full test reads "Run 1 of 3", then 2, then 3', () => {
    const card = labCard('ev-wolf-pack')!;
    const n = LAB_EVENT_RUNS.full;
    expect(n).toBe(3);
    expect(labCountText(card, s, 0, n)).toBe('clean 1 · held 0 · broken 0 · Run 1 of 3');
    expect(labCountText(card, s, 1, n)).toMatch(/Run 2 of 3$/);
    expect(labCountText(card, s, 3, n)).toMatch(/Run 3 of 3$/);
    expect(labCountText(card, s, 0, LAB_EVENT_RUNS.quick)).toMatch(/Run 1 of 1$/);
  });
  it('other cards keep their count', () => {
    expect(labCountText(labCard('w-aegis')!, s, 1, 8)).toBe('kills 0 · 2/8');
  });
});
