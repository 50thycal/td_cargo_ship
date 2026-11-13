// Round 8 (docs/design/v3-enemies-round8.md): the player's Test Lab notes on
// the enemies and the special events. The Decoy tint about twice as strong;
// the Hydra a little slower in both stages; the Torpedo Sub fires one by one,
// each torpedo at a ship, never across land; the Scavenger reworked to lock
// the pickups in its ring; every Spotter flies turns and calls shells in
// from off the map; Hydra Bloom without its line; Run the Canal cut down;
// Beacon Strike in place of Undertow on Dunmar Crossing.

import { describe, expect, it } from 'vitest';
import { THREATS, VIEW } from '../../src/v3/data/config';
import { FOE, type FoeId } from '../../src/v3/data/foes';
import { EV, EVENT, EVENTS, EVENT_MAPS, EVENT_ORDER, EVENT_WAVE, RULE_TEXT, eventMap, type EventId } from '../../src/v3/data/events';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { ROSTER } from '../../src/v3/data/roster';
import { LAB_CHANGES, LAB_ROUNDS, labCard } from '../../src/v3/data/lab';
import { launchFoe, onLand, pickupLocked, shellAt } from '../../src/v3/sim/foes';
import { beaconMark, hydraDarts } from '../../src/v3/sim/events';
import { addPickup, applyFreePlay, applyLab, createGame, damageThreat, step, tap, worthShooting, type Game, type Threat } from '../../src/v3/sim/game';
import { playMimic } from '../../src/v3/sim/mimic';
import { Recorder, replay } from '../../src/v3/sim/playlog';
import { Bot, SKILLS } from '../../src/v3/sim/bot';
import { DECOY_TINT } from '../../src/v3/ui/foes';
import { C } from '../../src/v3/ui/render';

const DT = 1 / 60;
const DEVICE = { w: 1, h: 1, dpr: 1, touch: false, ua: '' };

function run(g: Game, seconds: number, until?: () => boolean): void {
  for (let i = 0; i < seconds / DT && g.phase === 'wave'; i++) {
    step(g, DT);
    if (until?.()) return;
  }
}

/** A wave with nothing launching on its own, ships sailing, unsinkable. */
function quiet(map: Parameters<typeof createGame>[0] = 'strait', seed = 1): Game {
  const g = createGame(map, seed);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.threats = [];
  g.lost = -99;
  g.carrierHp = 999;
  run(g, 20);
  g.threats = [];
  return g;
}

const live = (g: Game, kind: Threat['kind']) => g.threats.filter((t) => t.kind === kind && !t.dead);

/** An event game at its wave, the convoy unsinkable, straight in. */
function eventGame(id: EventId, seed = 1): Game {
  const g = createGame(eventMap(id), seed, EVENT_WAVE);
  g.tempo = { ...g.tempo, lossLimit: 999 };
  g.carrierHp = 999;
  g.event!.t0 = 0;
  return g;
}

/** CIE76 colour difference between two hex colours. */
function deltaE(a: string, b: string): number {
  const lab = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const X = f((0.4124 * r + 0.3576 * g + 0.1805 * bl) / 0.95047);
    const Y = f(0.2126 * r + 0.7152 * g + 0.0722 * bl);
    const Z = f((0.0193 * r + 0.1192 * g + 0.9505 * bl) / 1.08883);
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
  };
  const p = lab(a);
  const q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

describe('round 8: the round and its lines', () => {
  it('round 8 is in the lab, with a line for each changed enemy and event card', () => {
    expect(LAB_ROUNDS.find((r) => r.n === 8)).toEqual({ n: 8, date: '2026-11-10', name: 'Enemy pairs; weapon and enemy notes', since: '2026-11-10T19:00' });
    const cards = ['decoy', 'hydra', 'torpedoSub', 'scavenger', 'spotter', 'ev-hydra-bloom', 'ev-run-the-canal', 'ev-beacon-strike', 'ev-supply-raid', 'ev-fire-mission', 'ev-decoy-storm', 'ev-breakout'];
    for (const id of cards) expect(LAB_CHANGES[id]!.filter((c) => c.round === 8), id).toHaveLength(1);
    // The events kept as they were have no round 8 line.
    for (const id of ['ev-siege-of-vey', 'ev-rush', 'ev-rocket-convoy', 'ev-wolf-pack', 'ev-shield-wall', 'ev-dive-circus', 'ev-bombardment', 'ev-repair-yard', 'ev-siren-field', 'ev-firestorm', 'ev-escort-run'])
      expect((LAB_CHANGES[id] ?? []).some((c) => c.round === 8), id).toBe(false);
  });
});

describe('Decoy Drones: "Still can\'t tell which is which"', () => {
  it('the tint is about twice as far from the real drone\'s cream as round 7\'s, and still pale', () => {
    const r7 = deltaE(C.drone, '#d4dcdc');
    const r8 = deltaE(C.drone, DECOY_TINT);
    expect(r7).toBeGreaterThan(9);
    expect(r7).toBeLessThan(12);
    expect(r8).toBeGreaterThan(r7 * 1.6);
    expect(r8).toBeLessThan(25);
    // The same lightness within a few points (a pale drone, not a dark one).
    const L = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    };
    expect(Math.abs(L(DECOY_TINT) - L(C.drone))).toBeLessThan(0.04);
  });

  it('the bots tell a decoy apart from its launch (round 9: it fades in and out from then), anywhere on the board', () => {
    // Round 8 read it within 420 px and from 1.5 s out; round 9's pulse reads at once.
    expect(FOE.decoy.readAt).toBeGreaterThanOrEqual(Math.hypot(1600, 900));
    expect(FOE.decoy.readAfter).toBe(0);
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'decoy', base: 1 }, g.map.bases[1]);
    const fake = live(g, 'decoy')[0];
    const real = live(g, 'drone')[0];
    g.threats = [fake, real];
    run(g, 0.05);
    expect(fake.foe!.state).toBe(1);
    expect(worthShooting(g, g.threats)).not.toContain(fake);
    expect(worthShooting(g, g.threats)).toContain(real);
  });
});

describe('Hydra Missile: "slow it down just a little bit more for both stages"', () => {
  it('the missile 100 px/s (112.5), its darts 255 (290): 10 to 15% slower each', () => {
    expect(THREATS.hydra.speed).toBe(100);
    expect(THREATS.dart.speed).toBe(255);
    for (const [now, was] of [[THREATS.hydra.speed, 112.5], [THREATS.dart.speed, 290]]) {
      expect(1 - now / was).toBeGreaterThanOrEqual(0.1);
      expect(1 - now / was).toBeLessThanOrEqual(0.15);
    }
  });
});

describe('Torpedo Sub: "they should be targeted, and [fire] one by one, not all at once"', () => {
  /** One sub's torpedoes, each with when it was fired. */
  function salvo(g: Game): { t: number; th: Threat }[] {
    g.threats = [];
    g.foe.marks = [];
    launchFoe(g, { at: 0, kind: 'torpedoSub', base: -1 });
    const out: { t: number; th: Threat }[] = [];
    const seen = new Set<number>();
    for (let i = 0; i < 10 / DT && g.phase === 'wave'; i++) {
      step(g, DT);
      for (const t of g.threats) {
        if (t.kind !== 'torpedo' || seen.has(t.id)) continue;
        seen.add(t.id);
        out.push({ t: g.t, th: t });
      }
    }
    return out;
  }

  it('three to five torpedoes, one after another `stagger` s apart, each at a ship (going round the convoy before it comes back to one)', () => {
    const counts = new Set<number>();
    for (const seed of [1, 2, 3]) {
      const g = quiet('strait', seed);
      for (let n = 0; n < 6; n++) {
        const shots = salvo(g);
        counts.add(shots.length);
        expect(shots.length).toBeGreaterThanOrEqual(3);
        expect(shots.length).toBeLessThanOrEqual(5);
        for (let k = 1; k < shots.length; k++) expect(shots[k].t - shots[k - 1].t).toBeCloseTo(FOE.torpedoSub.stagger, 1);
        const ids = shots.map((s) => s.th.target);
        for (const id of ids) expect(g.ships.some((s) => s.id === id) || id >= 0).toBe(true);
        // Its X is where its ship will be: on the torpedo's own line.
        for (const { th } of shots) {
          const f = th.foe!;
          const h = Math.atan2(f.py - f.sy!, f.px - f.sx!);
          expect(Math.abs(Math.atan2(Math.sin(h - th.heading), Math.cos(h - th.heading)))).toBeLessThan(1e-6);
        }
        // Spread across the ships: evenly over the ships it went for (a
        // ship comes round again only once the others have had theirs).
        const distinct = new Set(ids);
        const most = Math.max(...[...distinct].map((id) => ids.filter((o) => o === id).length));
        expect(most).toBeLessThanOrEqual(Math.ceil(ids.length / distinct.size) + 1);
        if (g.ships.length >= 3) expect(distinct.size).toBeGreaterThanOrEqual(2);
      }
    }
    expect([...counts].sort()).toEqual([3, 4, 5]);
  });

  it('it fires its first 3 s after it comes up; killed part way, the rest don\'t go', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'torpedoSub', base: -1 });
    run(g, FOE.torpedoSub.warn + 0.05);
    const sub = live(g, 'torpedoSub')[0];
    expect(sub.foe!.fireAt).toBeCloseTo(FOE.torpedoSub.fireAt + FOE.torpedoSub.aim, 6);
    expect(sub.foe!.fireAt).toBeCloseTo(3, 6);
    run(g, sub.foe!.fireAt! + 0.1);
    expect(live(g, 'torpedo')).toHaveLength(1);
    damageThreat(g, sub, 99);
    run(g, 3);
    expect(g.threats.filter((t) => t.kind === 'torpedo').length).toBeLessThanOrEqual(1);
  });

  it('no torpedo ever runs onto land, on any map (subs as in the waves, the Wolf Pack and Run the Canal)', () => {
    const fired = new Set<number>();
    const check = (g: Game, seconds: number): number => {
      let bad = 0;
      for (let i = 0; i < seconds / DT && g.phase === 'wave'; i++) {
        step(g, DT);
        for (const t of g.threats) {
          if (t.kind !== 'torpedo' || t.dead) continue;
          fired.add(t.id);
          if (t.x > 0 && t.x < VIEW.width && t.y > 0 && t.y < VIEW.height && onLand(g, t.x, t.y)) bad += 1;
        }
      }
      return bad;
    };
    for (const map of MAP_ORDER) {
      const g = quiet(map, 2);
      fired.clear();
      for (let n = 0; n < 4; n++) {
        g.foe.marks = [];
        launchFoe(g, { at: 0, kind: 'torpedoSub', base: -1 });
        expect(check(g, 8), map).toBe(0);
      }
      // And they do fire (subs come up where there is water to the lanes).
      expect(fired.size, map).toBeGreaterThanOrEqual(6);
    }
    for (const id of ['wolf-pack', 'run-the-canal'] as EventId[]) {
      for (const seed of [1, 2, 3]) {
        const g = eventGame(id, seed);
        expect(check(g, 40), `${id} ${seed}`).toBe(0);
        expect(g.event?.sent.torpedo ?? g.eventLog[0]?.sent.torpedo ?? 0, `${id} fired`).toBeGreaterThan(0);
      }
    }
  });
});

describe('Scavenger Drone: "deny the player the ability to pick up the weapons or boosts within a radius of the drone"', () => {
  function withScavenger(): { g: Game; scav: Threat } {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'scavenger', base: -1 });
    const scav = live(g, 'scavenger')[0];
    return { g, scav };
  }

  it('it no longer takes pickups: it flies to one and hovers over it, its ring on it', () => {
    const { g, scav } = withScavenger();
    addPickup(g, 'ammo', 600, 420);
    const p = g.pickups[0];
    run(g, 6);
    expect(g.pickups).toContain(p);
    expect(Math.hypot(scav.x - p.x, scav.y - p.y)).toBeLessThanOrEqual(FOE.scavenger.deny);
    expect(pickupLocked(g, p)).toBe(true);
  });

  it('a pickup in its ring can\'t be taken, and doesn\'t age; one outside it can; killing the drone frees it', () => {
    const { g, scav } = withScavenger();
    addPickup(g, 'repair', 600, 420);
    addPickup(g, 'ammo', 600 + FOE.scavenger.deny + 200, 420);
    const [inside, outside] = g.pickups;
    // Hold the drone over the first pickup.
    const hold = () => {
      scav.x = inside.x + 10;
      scav.y = inside.y - 10;
    };
    hold();
    expect(pickupLocked(g, inside)).toBe(true);
    expect(pickupLocked(g, outside)).toBe(false);
    const age = inside.age;
    for (let i = 0; i < 30; i++) {
      hold();
      step(g, DT);
    }
    expect(inside.age).toBe(age);
    hold();
    tap(g, inside.x, inside.y, 4);
    expect(g.pickups).toContain(inside);
    expect(tap(g, outside.x, outside.y, 4)).toBe('pickup');
    expect(g.pickups).not.toContain(outside);
    damageThreat(g, scav, 99);
    expect(pickupLocked(g, inside)).toBe(false);
    expect(tap(g, inside.x, inside.y, 4)).toBe('pickup');
    expect(g.pickups).not.toContain(inside);
  });

  it('the bots shoot it to free a locked pickup, and never tap a locked one', () => {
    const { g, scav } = withScavenger();
    addPickup(g, 'weapon', 600, 420, 'flak');
    const p = g.pickups[0];
    scav.x = p.x + 10;
    scav.y = p.y;
    const bot = new Bot(SKILLS.sharp, 1);
    for (let i = 0; i < 4 / DT && !scav.dead; i++) {
      scav.x = p.x + 10;
      scav.y = p.y;
      bot.act(g);
      step(g, DT);
    }
    expect(scav.dead).toBe(true);
  });

  it('Supply Raid: its scavengers lock the drop; shot down, they free it', () => {
    const g = eventGame('supply-raid', 2);
    run(g, EVENT.breather + EV['supply-raid'].scavAt[0] + 7);
    expect(live(g, 'scavenger').length).toBeGreaterThan(0);
    expect(g.pickups.some((p) => pickupLocked(g, p))).toBe(true);
    for (const t of live(g, 'scavenger')) damageThreat(g, t, 99);
    expect(g.pickups.some((p) => pickupLocked(g, p))).toBe(false);
  });
});

describe('Spotter Plane: "they scout it out and lock on and then leave and come back with the same health, and repeat until you kill it"', () => {
  it('it paints, calls, flies off; comes back with its hits kept; turn after turn while the wave is on', () => {
    const g = quiet();
    // Something else of the wave still to come, so it keeps coming back.
    g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    launchFoe(g, { at: 0, kind: 'spotter', base: -1 });
    const sp = live(g, 'spotter')[0];
    const id = sp.id;
    let away = 0;
    let back = 0;
    let wasOn = true;
    let shells = 0;
    const seenShell = new Set<number>();
    for (let i = 0; i < 120 / DT; i++) {
      step(g, DT);
      if (i === 60) damageThreat(g, sp, 1);
      const on = g.threats.includes(sp) && !sp.dead;
      if (wasOn && !on) away += 1;
      if (!wasOn && on) {
        back += 1;
        expect(sp.id).toBe(id);
        expect(sp.hp).toBe(THREATS.spotter.hp - 1);
      }
      wasOn = on;
      for (const m of g.foe.marks) if (m.kind === 'shell' && !seenShell.has(m.id)) {
        seenShell.add(m.id);
        shells += 1;
      }
    }
    expect(back).toBe(FOE.spotter.turns - 1);
    expect(away).toBe(FOE.spotter.turns);
    expect(sp.foe!.n).toBe(FOE.spotter.turns);
    expect(shells).toBe(FOE.spotter.turns * FOE.spotter.shells);
    // Done: gone for good, nothing holding the wave.
    expect(g.foe.marks.some((m) => m.kind === 'recall')).toBe(false);
  });

  it('with nothing else left of the wave it doesn\'t come back; shot down, it is gone (its uncalled shells too)', () => {
    const g = quiet();
    g.queue = [];
    launchFoe(g, { at: 0, kind: 'spotter', base: -1 });
    const sp = live(g, 'spotter')[0];
    run(g, 30, () => g.foe.marks.some((m) => m.kind === 'shell'));
    expect(g.foe.marks.some((m) => m.kind === 'shell' && m.link === sp.id)).toBe(true);
    // Shot down before its shells are fired: they are off.
    damageThreat(g, sp, 99);
    expect(g.foe.marks.some((m) => m.kind === 'shell')).toBe(false);
    const g2 = quiet('strait', 2);
    g2.queue = [];
    launchFoe(g2, { at: 0, kind: 'spotter', base: -1 });
    run(g2, 60);
    expect(g2.foe.marks.some((m) => m.kind === 'recall')).toBe(false);
    expect(live(g2, 'spotter')).toHaveLength(0);
  });

  it('its shells are artillery from off the map: each comes into sight from beyond the edge', () => {
    for (const g of [quiet(), eventGame('fire-mission', 3)]) {
      g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
      if (!g.event) launchFoe(g, { at: 0, kind: 'spotter', base: -1 });
      run(g, 40, () => g.foe.marks.some((m) => m.kind === 'shell'));
      const shells = g.foe.marks.filter((m) => m.kind === 'shell');
      expect(shells.length).toBeGreaterThan(0);
      for (const m of shells) {
        expect(m.far).toBe(true);
        const off = m.gx! < 0 || m.gx! > VIEW.width || m.gy! < 0 || m.gy! > VIEW.height;
        expect(off).toBe(true);
        // As it is fired it is still off the screen, and it lands on its circle.
        const at = { ...m, t: m.dur - m.flight! };
        const p = shellAt(at);
        expect(p.x < 0 || p.x > VIEW.width || p.y < 0 || p.y > VIEW.height).toBe(true);
        const end = shellAt({ ...m, t: m.dur });
        expect(Math.hypot(end.x - m.x, end.y - m.y)).toBeLessThan(1e-6);
      }
    }
  });
});

describe('Hydra Bloom: "Hydras should split even before the line is crossed; you can remove that line"', () => {
  it('no line; a Hydra killed anywhere splits into three (slower) darts', () => {
    const g = eventGame('hydra-bloom', 1);
    expect(g.event!.line).toBeUndefined();
    expect(RULE_TEXT.hydraThree).toBe('Hydras split into three, not two');
    run(g, EVENT.breather + 0.3, () => live(g, 'hydra').length > 0);
    const h = live(g, 'hydra')[0];
    expect(h).toBeDefined();
    // Killed right out of its base, far from any line there was.
    expect(hydraDarts(g, h)).toBe(3);
    const before = live(g, 'dart').length;
    damageThreat(g, h, 99);
    const darts = live(g, 'dart').slice(before);
    expect(darts).toHaveLength(3);
    for (const d of darts) expect(d.speed).toBeLessThan(THREATS.dart.speed * g.waveSpeed);
    // Outside the event, two.
    const q = quiet();
    launchFoe(q, { at: 0, kind: 'hydra', base: 0 }, q.map.bases[0]);
    expect(hydraDarts(q, live(q, 'hydra')[0])).toBe(2);
  });
});

describe('Run the Canal: "way too difficult, way too much going on"', () => {
  it('cut down: two subs, one gunship, a block of four; no scavengers or second pack', () => {
    const g = eventGame('run-the-canal', 2);
    const seen = new Set<string>();
    for (let i = 0; i < 90 / DT && g.phase === 'wave' && !g.eventLog.length; i++) {
      for (const t of g.threats) seen.add(t.kind);
      step(g, DT);
    }
    const sent = g.eventLog[0]?.sent ?? g.event!.sent;
    expect(sent.torpedoSub).toBe(2);
    expect(sent.attackHeli).toBe(1);
    expect(sent.armored).toBe(4);
    expect(sent.scavenger ?? 0).toBe(0);
    expect(seen.has('scavenger')).toBe(false);
    expect(EVENTS['run-the-canal'].also).toEqual(['attackHeli', 'armored']);
  });
});

describe('Beacon Strike (Dunmar Crossing), in place of Undertow', () => {
  it('Dunmar Crossing\'s event; Undertow is gone; its rule on the card; a kit with no helpers', () => {
    expect(EVENT_MAPS.crossing).toBe('beacon-strike');
    expect(EVENT_ORDER).not.toContain('undertow' as EventId);
    expect(EVENTS['beacon-strike'].foe).toBe('lure');
    expect(EVENTS['beacon-strike'].rules).toEqual(['beaconCall']);
    expect(RULE_TEXT.beaconCall).toBe('Beacons call missiles on the ship nearest them');
    const card = labCard('ev-beacon-strike')!;
    expect(card.map).toBe('crossing');
    expect(card.kit.filter((w) => ROSTER[w].cat === 'passive')).toEqual([]);
    expect(labCard('ev-undertow')).toBeUndefined();
  });

  it('beacons rise by the lanes; each marks the ship nearest it and calls a missile on that ship; sunk, it calls no more', () => {
    const g = eventGame('beacon-strike', 2);
    const E = EV['beacon-strike'];
    run(g, EVENT.breather + 0.2);
    const pair = live(g, 'lure');
    expect(pair).toHaveLength(2);
    // Up, and marking a ship before its first call.
    run(g, FOE.lure.rise + E.first - E.charge + 0.2);
    const b = pair[0];
    const s = beaconMark(g, b)!;
    expect(s).toBeDefined();
    const nearest = [...g.ships].filter((o) => o.x < VIEW.width - 90).sort((x, y) => Math.hypot(x.x - b.x, x.y - b.y) - Math.hypot(y.x - b.x, y.y - b.y))[0];
    expect(s.id).toBe(nearest.id);
    // The call: a ballistic missile at that ship.
    const queued = () => g.queue.filter((l) => l.kind === 'ballistic' && l.target === s.id).length + live(g, 'ballistic').filter((t) => t.target === s.id).length;
    run(g, E.charge + 0.1);
    expect(queued()).toBeGreaterThan(0);
    // Sunk by the player's hand: no more calls from it.
    g.foe.byTap = true;
    damageThreat(g, b, 99);
    g.foe.byTap = false;
    expect(b.dead).toBe(true);
    const sent = g.event!.sent.ballistic ?? 0;
    const other = pair[1];
    g.foe.byTap = true;
    damageThreat(g, other, 99);
    g.foe.byTap = false;
    run(g, E.every + 0.5);
    expect(g.event!.sent.ballistic ?? 0).toBe(sent);
    run(g, E.at[1] + 1);
    expect(g.event!.sent.lure).toBe(4);
  });

  it('its lab card starts straight into it, and the bots hold it', () => {
    const card = labCard('ev-beacon-strike')!;
    let held = 0;
    for (const seed of [1, 2, 3, 4]) {
      const g = createGame(card.map, seed, card.wave);
      applyFreePlay(g, { weapons: card.kit.map((w) => ({ id: w, level: 2 })), frequentDrops: true });
      applyLab(g, { card: card.id, length: 'quick', mix: 'normal' });
      const bot = new Bot(SKILLS.sharp, seed);
      for (let i = 0; i < 30 * 120 && g.phase === 'wave' && !g.eventLog.length; i++) {
        bot.act(g);
        step(g, 1 / 30);
      }
      expect(g.eventLog[0]?.id).toBe('beacon-strike');
      if (g.eventLog[0]?.outcome !== 'broken') held += 1;
    }
    expect(held).toBeGreaterThanOrEqual(3);
  });
});

describe('determinism and replay', () => {
  it('the same seed plays the new enemies the same way twice', () => {
    const play = () => {
      const g = quiet('saltgate', 4);
      g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
      for (const kind of ['torpedoSub', 'scavenger', 'spotter'] as const) launchFoe(g, { at: 0, kind, base: -1 });
      addPickup(g, 'ammo', 700, 400);
      run(g, 40);
      return { t: g.threats.map((t) => [t.kind, Math.round(t.x), Math.round(t.y)]), marks: g.foe.marks.length, pickups: g.pickups.map((p) => p.age), steps: g.steps };
    };
    expect(play()).toEqual(play());
  });

  it('a Free Play run with each of the reworked enemies replays exactly from its log', () => {
    for (const enemies of ['torpedoSub', 'scavenger', 'spotter'] as FoeId[]) {
      const freePlay = { weapons: [{ id: 'cutter' as const, level: 2 }], frequentDrops: true, enemies };
      const { game, log } = playMimic('saltgate', 7, { firstWave: 5, freePlay });
      const again = replay(log);
      expect(again.steps, enemies).toBe(game.steps);
      expect(again.score, enemies).toBe(game.score);
      expect(again.kills, enemies).toEqual(game.kills);
    }
  });

  it('a recorded Beacon Strike replays exactly', () => {
    const g = createGame('crossing', 6, EVENT_WAVE);
    const rec = new Recorder(g, { build: 't', startedAt: '2026-11-10T00:00:00Z', firstWave: EVENT_WAVE, device: DEVICE });
    for (let i = 0; i < 60 * 90 && g.phase === 'wave' && !g.eventLog.length; i++) {
      if (i % 10 === 0) {
        const t = g.threats.find((o) => !o.dead && o.x > 0 && o.x < VIEW.width && o.y > 0 && o.y < VIEW.height);
        if (t) rec.tap(t.x, t.y, 40);
      }
      step(g, DT);
    }
    const log = rec.finish('quit');
    expect(log.v).toBe(21);
    expect(log.events![0].id).toBe('beacon-strike');
    const again = replay(log);
    expect(again.steps).toBe(g.steps);
    expect(again.score).toBe(g.score);
    expect(again.eventLog).toEqual(g.eventLog);
  });
});
