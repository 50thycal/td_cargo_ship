// Round 7 (docs/design/v3-enemies-round7.md): the player's enemy notes from
// the round 6 event playtest. The Decoy Drones lose their strobe for a faint
// tint, everywhere; the Hydra is 25% slower before it splits; every Torpedo
// Sub fires a fan of three to five, now and then with a fast one in it.

import { describe, expect, it } from 'vitest';
import { THREATS } from '../../src/v3/data/config';
import { FOE, type FoeId } from '../../src/v3/data/foes';
import { EV, EVENT_WAVE, eventMap } from '../../src/v3/data/events';
import { LAB_CHANGES, LAB_ROUNDS, cardChanges } from '../../src/v3/data/lab';
import { launchFoe } from '../../src/v3/sim/foes';
import { playMimic } from '../../src/v3/sim/mimic';
import { replay } from '../../src/v3/sim/playlog';
import { createGame, damageThreat, step, worthShooting, type Game, type Threat } from '../../src/v3/sim/game';
import { DECOY_TINT, drawFoe } from '../../src/v3/ui/foes';
import { C } from '../../src/v3/ui/render';

const DT = 1 / 60;
function run(g: Game, seconds: number, until?: () => boolean): void {
  for (let i = 0; i < seconds / DT && g.phase === 'wave'; i++) {
    step(g, DT);
    if (until?.()) return;
  }
}

/** A wave with nothing launching on its own, ships sailing. */
function quiet(seed = 1): Game {
  const g = createGame('strait', seed);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.threats = [];
  run(g, 20);
  g.threats = [];
  return g;
}

const live = (g: Game, kind: Threat['kind']) => g.threats.filter((t) => t.kind === kind && !t.dead);

/** A canvas that writes down every call and every style it is given. */
function recorder(): { ctx: CanvasRenderingContext2D; ops: string[] } {
  const ops: string[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_, k: string) {
      if (k in target) return target[k];
      return (...a: unknown[]) => ops.push(`${k}(${a.map((v) => (typeof v === 'number' ? v.toFixed(2) : String(v))).join(',')})`);
    },
    set(_, k: string, v) {
      target[k] = v;
      ops.push(`${k}=${v}`);
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
}

function hsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  const h = max === min ? 0 : max === r ? ((g - b) / (max - min) + 6) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
  return { h: h * 60, s, l };
}

describe('round 7: the round and its lines', () => {
  it('round 7 is in the lab; the three enemies, their events and their combos have a line', () => {
    expect(LAB_ROUNDS.find((r) => r.n === 7)).toEqual({ n: 7, date: '2026-11-10', name: 'Enemy tweaks; more events', since: '2026-11-10T06:00' });
    for (const id of ['decoy', 'hydra', 'torpedoSub', 'ev-decoy-storm', 'ev-hydra-bloom']) expect(LAB_CHANGES[id]!.filter((c) => c.round === 7), id).toHaveLength(1);
    // The combos take their enemies' lines on.
    expect(cardChanges('combo-decoy-sprint', 6)).toContain('Decoy Drones: No strobe: the decoys are a shade cooler (grey, not cream) all the way in');
    // (Round 8: the Hydra's combos are enemy pairs; they take the line on too.)
    expect(cardChanges('combo-hydra-swarm', 6)).toContain('Hydra Missile: 25% slower before it splits; its darts as fast as before');
    // The Wolf Pack is as it was (its subs keep their two or three).
    expect((LAB_CHANGES['ev-wolf-pack'] ?? []).some((c) => c.round === 7)).toBe(false);
  });
});

describe('Decoy Drones: "a faint color difference everywhere, instead of the flash on, flash off"', () => {
  // Round 9 turned this round back (the player: "go full extreme ... make
  // it flash the whole time like it used to, or fade in and out"): the
  // tint stays, and on top a decoy fades in and out from its launch. What
  // round 7 asked for that still holds: its tint, no white strobe, no dash.
  it('a decoy keeps its tint and fades in and out from launch, read or not (round 9); no white strobe or dashes; a real drone is cream and never fades', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'decoy', base: 1 }, g.map.bases[1]);
    const fake = live(g, 'decoy')[0];
    const real = live(g, 'drone')[0];
    const draw = (th: Threat) => {
      const r = recorder();
      if (!drawFoe(r.ctx, g, th)) {
        // A real drone: render.ts draws it as this delta wing in C.drone.
        r.ops.push(`fillStyle=${C.drone}`);
      }
      return r.ops;
    };
    const alpha = (ops: string[]) => Number(ops.find((o) => o.startsWith('globalAlpha='))!.split('=')[1]);
    fake.age = 0;
    const first = draw(fake);
    expect(first).toContain(`fillStyle=${DECOY_TINT}`);
    expect(alpha(first)).toBeCloseTo(1, 5);
    // Nothing white or near it, no dashes.
    expect(first.some((o) => /fillStyle=rgba\(255,255,255/.test(o) || /strokeStyle=rgba\(23\d,24\d,255/.test(o))).toBe(false);
    expect(first.some((o) => o.startsWith('setLineDash('))).toBe(false);
    // Over its flight, read or not: deep troughs and full peaks, again and again.
    for (const state of [0, 1]) {
      fake.foe!.state = state;
      const seen: number[] = [];
      for (let k = 0; k < 40; k++) {
        fake.age = k * 0.05;
        seen.push(alpha(draw(fake)));
      }
      expect(Math.min(...seen)).toBeLessThan(0.25);
      expect(Math.max(...seen)).toBeGreaterThan(0.95);
      // At least two full beats in its first two seconds, and under 3 a second.
      const troughs = seen.filter((a, i) => i > 0 && i < seen.length - 1 && a <= seen[i - 1] && a < seen[i + 1]).length;
      expect(troughs).toBeGreaterThanOrEqual(2);
      expect(troughs).toBeLessThanOrEqual(6);
    }
    expect(draw(real)).toContain(`fillStyle=${C.drone}`);
    expect(draw(real).some((o) => o.startsWith('globalAlpha='))).toBe(false);
  });

  it('the tint keeps the drone\'s lightness and turns its warmth cool (round 8 made it about twice as strong)', () => {
    const d = hsl(C.drone);
    const t = hsl(DECOY_TINT);
    expect(DECOY_TINT).not.toBe(C.drone);
    expect(Math.abs(t.l - d.l)).toBeLessThan(0.04);
    // Cream (hue about 40°) to a cool blue-grey (180° to 220°).
    expect(t.h).toBeGreaterThan(180);
    expect(t.h).toBeLessThan(220);
  });

  it('the Decoy Storm\'s decoys are the same decoys (drawn in the tint)', () => {
    const g = createGame(eventMap('decoy-storm'), 3, EVENT_WAVE);
    g.event!.t0 = 0;
    run(g, 4, () => live(g, 'decoy').length > 0);
    const fake = live(g, 'decoy')[0];
    const r = recorder();
    expect(drawFoe(r.ctx, g, fake)).toBe(true);
    expect(r.ops).toContain(`fillStyle=${DECOY_TINT}`);
  });

  it('the bots read a decoy as a careful player would: within readAt of its ship and readAfter s out, not before', () => {
    expect(FOE.decoy.readAt).toBeGreaterThan(160);
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'decoy', base: 1 }, g.map.bases[1]);
    const fake = live(g, 'decoy')[0];
    g.threats = [fake];
    // Far out: worth a shot (it could be real).
    expect(worthShooting(g, g.threats)).toContain(fake);
    const s = g.ships.find((o) => o.id === fake.target)!;
    run(g, FOE.decoy.readAfter + 0.1);
    fake.x = s.x - FOE.decoy.readAt + 30;
    fake.y = s.y;
    run(g, 0.05);
    expect(fake.foe!.state).toBe(1);
    expect(worthShooting(g, g.threats)).not.toContain(fake);
  });
});

describe('Hydra Missile: "about 25% slower before the split"', () => {
  it('its first stage flies slower than its old 150 px/s (0.75 × in round 7, two thirds from round 8); its darts at their own speed', () => {
    // Round 8 slowed both stages a little more (enemiesRound8.test.ts).
    expect(THREATS.hydra.speed).toBeLessThanOrEqual(150 * 0.75);
    const g = quiet();
    g.waveSpeed = 1.2;
    launchFoe(g, { at: 0, kind: 'hydra', base: 1 }, g.map.bases[1]);
    const h = live(g, 'hydra')[0];
    const share = (h.speed / THREATS.hydra.speed - 1) / 0.2;
    expect(h.speed).toBeCloseTo(THREATS.hydra.speed * (1 + 0.2 * share), 6);
    run(g, 0.5);
    damageThreat(g, h, 99);
    const darts = live(g, 'dart');
    expect(darts).toHaveLength(FOE.hydra.darts);
    for (const d of darts) expect(d.speed).toBeCloseTo(THREATS.dart.speed * (1 + 0.2 * share), 6);
  });

  it('in the Hydra Bloom too: the Hydra\'s own speed, the event\'s own slow on top', () => {
    const g = createGame(eventMap('hydra-bloom'), 1, EVENT_WAVE);
    g.event!.t0 = 0;
    run(g, 6, () => live(g, 'hydra').length > 0);
    const h = live(g, 'hydra')[0];
    const base = THREATS.hydra.speed * EV['hydra-bloom'].slow;
    expect(h.speed).toBeGreaterThanOrEqual(base - 1e-6);
    expect(h.speed).toBeLessThanOrEqual(base * g.waveSpeed + 1e-6);
  });
});

describe('Torpedo Sub: "the torpedo sub will fire three to five, and then sometimes fast ones"', () => {
  /** Launches one normal sub at a time and collects each one's spread (all
   *  of it: round 8 fires them one by one). */
  function spreads(seed: number, subs: number): Threat[][] {
    const g = quiet(seed);
    const out: Threat[][] = [];
    const S = FOE.torpedoSub;
    // Unsinkable, so every sub has ships to aim at.
    g.lost = -99;
    g.carrierHp = 999;
    for (let n = 0; n < subs; n++) {
      g.threats = [];
      g.foe.marks = [];
      launchFoe(g, { at: 0, kind: 'torpedoSub', base: -1 });
      const seen = new Map<number, Threat>();
      for (let i = 0; i < (S.warn + S.fireAt + S.aim + (S.spread[1] - 1) * S.stagger + 0.1) / DT && g.phase === 'wave'; i++) {
        step(g, DT);
        for (const t of g.threats) if (t.kind === 'torpedo' && !seen.has(t.id)) seen.set(t.id, { ...t, foe: { ...t.foe! } });
      }
      out.push([...seen.values()]);
    }
    return out;
  }

  it('every sub fires three to five torpedoes (a dashed line each); about one in four carries a fast one', () => {
    let fastSubs = 0;
    let total = 0;
    const counts = new Set<number>();
    for (const seed of [1, 2, 3, 4]) {
      for (const spread of spreads(seed, 12)) {
        total += 1;
        counts.add(spread.length);
        expect(spread.length).toBeGreaterThanOrEqual(3);
        expect(spread.length).toBeLessThanOrEqual(5);
        // All from the sub. (Round 8: one by one, each at a ship, in place
        // of the fan: enemiesRound8.test.ts.)
        expect(new Set(spread.map((t) => `${t.foe!.sx},${t.foe!.sy}`)).size).toBe(1);
        const fast = spread.filter((t) => t.foe!.fast);
        expect(fast.length).toBeLessThanOrEqual(1);
        if (fast.length) {
          fastSubs += 1;
          const slow = spread.find((t) => !t.foe!.fast)!;
          expect(fast[0].speed).toBeCloseTo(slow.speed * FOE.torpedoSub.fastSpeed, 6);
        }
      }
    }
    expect([...counts].sort()).toEqual([3, 4, 5]);
    expect(FOE.torpedoSub.fastChance).toBe(0.25);
    expect(fastSubs / total).toBeGreaterThan(0.1);
    expect(fastSubs / total).toBeLessThan(0.45);
  });

  it('it fires later than the lone torpedo did (3.0 s up from round 8; 2.4 in round 7), and a sub killed before then fires nothing', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'torpedoSub', base: -1 });
    run(g, FOE.torpedoSub.warn + 0.05);
    const sub = live(g, 'torpedoSub')[0];
    expect(sub.foe!.fireAt).toBeCloseTo(3, 6);
    run(g, 2.8);
    expect(live(g, 'torpedo')).toHaveLength(0);
    damageThreat(g, sub, 99);
    run(g, 2);
    expect(live(g, 'torpedo')).toHaveLength(0);
  });
  it('the same seed fires the same spreads, and a Free Play run with the sub replays exactly from its log', () => {
    const a = spreads(5, 6).map((s) => s.map((t) => [t.heading, t.speed, t.foe!.fast ?? 0]));
    const b = spreads(5, 6).map((s) => s.map((t) => [t.heading, t.speed, t.foe!.fast ?? 0]));
    expect(a).toEqual(b);
    const freePlay = { weapons: [{ id: 'cutter' as const, level: 2 }], frequentDrops: true, enemies: 'torpedoSub' as FoeId };
    const { game, log } = playMimic('strait', 7, { firstWave: 5, freePlay });
    expect(game.kills.torpedoSub + game.kills.torpedo + game.sunkBy.torpedoSub).toBeGreaterThan(0);
    const again = replay(log);
    expect(again.steps).toBe(game.steps);
    expect(again.score).toBe(game.score);
    expect(again.kills).toEqual(game.kills);
  });
});
