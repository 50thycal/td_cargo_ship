// Round 7 (docs/design/v3-enemies-round7.md): the player's enemy notes from
// the round 6 event playtest. (The Decoy Drones' tint went with the decoys
// in round 11.) The Hydra is 25% slower before it splits; every Torpedo
// Sub fires a fan of three to five, now and then with a fast one in it.

import { describe, expect, it } from 'vitest';
import { THREATS } from '../../src/v3/data/config';
import { FOE, type FoeId } from '../../src/v3/data/foes';
import { EV, EVENT_WAVE, eventMap } from '../../src/v3/data/events';
import { LAB_CHANGES, LAB_ROUNDS, cardChanges } from '../../src/v3/data/lab';
import { launchFoe } from '../../src/v3/sim/foes';
import { playMimic } from '../../src/v3/sim/mimic';
import { replay } from '../../src/v3/sim/playlog';
import { createGame, damageThreat, step, type Game, type Threat } from '../../src/v3/sim/game';

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

describe('round 7: the round and its lines', () => {
  it('round 7 is in the lab; the three enemies, their events and their combos have a line', () => {
    expect(LAB_ROUNDS.find((r) => r.n === 7)).toEqual({ n: 7, date: '2026-11-10', name: 'Enemy tweaks; more events', since: '2026-11-10T06:00' });
    for (const id of ['decoy', 'hydra', 'torpedoSub', 'ev-decoy-storm', 'ev-hydra-bloom']) expect(LAB_CHANGES[id]!.filter((c) => c.round === 7), id).toHaveLength(1);
    // The combos take their enemies' lines on. (Round 11 removed the
    // decoys and their pairs; their lines stay as records.)
    // (Round 8: the Hydra's combos are enemy pairs; they take the line on too.)
    expect(cardChanges('combo-hydra-swarm', 6)).toContain('Hydra Missile: 25% slower before it splits; its darts as fast as before');
    // The Wolf Pack is as it was (its subs keep their two or three).
    expect((LAB_CHANGES['ev-wolf-pack'] ?? []).some((c) => c.round === 7)).toBe(false);
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
        // (Log v35: the sub can't be hit, so it fires FOE.torpedoSub.spread:
        // two, was three to five.)
        expect(spread.length).toBeGreaterThanOrEqual(FOE.torpedoSub.spread[0]);
        expect(spread.length).toBeLessThanOrEqual(FOE.torpedoSub.spread[1]);
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
    expect([...counts].sort()).toEqual(Array.from({ length: FOE.torpedoSub.spread[1] - FOE.torpedoSub.spread[0] + 1 }, (_, k) => FOE.torpedoSub.spread[0] + k));
    expect(FOE.torpedoSub.fastChance).toBe(0.25);
    expect(fastSubs / total).toBeGreaterThan(0.1);
    expect(fastSubs / total).toBeLessThan(0.45);
  });

  it('it fires later than the lone torpedo did (3.0 s up from round 8; 2.4 in round 7); since log v35 it can\'t be killed, so it always fires', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'torpedoSub', base: -1 });
    run(g, FOE.torpedoSub.warn + 0.05);
    const sub = live(g, 'torpedoSub')[0];
    expect(sub.foe!.fireAt).toBeCloseTo(3, 6);
    run(g, 2.8);
    expect(live(g, 'torpedo')).toHaveLength(0);
    damageThreat(g, sub, 99);
    expect(sub.dead).toBe(false);
    run(g, 2);
    expect(live(g, 'torpedo').length).toBeGreaterThan(0);
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
