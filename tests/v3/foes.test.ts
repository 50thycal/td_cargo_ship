// The enemy build (docs/design/v3-enemy-build.md): the new enemies join the
// campaign by chapter, Free Play can choose them, and each does what its
// card says.

import { describe, expect, it } from 'vitest';
import { THREATS, VIEW } from '../../src/v3/data/config';
import { FOE, FOES, FOE_ORDER, FOES_BUILT, foeCount, foesInChapter, foesUpTo, type FoeId } from '../../src/v3/data/foes';
import { MAP_ORDER, chapterOf } from '../../src/v3/data/maps';
import { playMimic } from '../../src/v3/sim/mimic';
import { replay } from '../../src/v3/sim/playlog';
import { launchFoe, newFoeState } from '../../src/v3/sim/foes';
import { applyFreePlay, createGame, step, tap, type Game, type Threat } from '../../src/v3/sim/game';

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
  // Let a few ships onto the lane.
  run(g, 20);
  g.threats = [];
  return g;
}

const live = (g: Game, kind: Threat['kind']) => g.threats.filter((t) => t.kind === kind && !t.dead);
const base = (g: Game) => g.map.bases[1];

/** Every foe kind a whole wave's queue holds. */
function queued(g: Game): Set<string> {
  return new Set(g.queue.map((l) => l.kind).filter((k) => FOE_ORDER.some((f) => FOES[f].kind === k)));
}

describe('the roster', () => {
  it('twenty-one enemies, five, five, five and six a chapter; chapter 1 is built', () => {
    expect(FOE_ORDER).toHaveLength(21);
    expect([1, 2, 3, 4].map((c) => FOE_ORDER.filter((f) => FOES[f].chapter === c).length)).toEqual([5, 5, 5, 6]);
    expect(new Set(FOE_ORDER.map((f) => FOES[f].kind)).size).toBe(21);
    for (const f of FOES_BUILT) expect(THREATS[FOES[f].kind], f).toBeDefined();
    expect(foesInChapter(1)).toEqual(['sprinter', 'decoy', 'hydra', 'rocketTruck', 'loiter']);
    // Later chapters send the earlier ones too.
    expect(foesUpTo(4)).toEqual(expect.arrayContaining(foesInChapter(1)));
  });

  it('none on wave 1, one from wave 2, four on wave 10, more in endless (up to six)', () => {
    expect(foeCount(1)).toBe(0);
    expect(foeCount(2)).toBe(1);
    expect(foeCount(10)).toBe(4);
    expect(foeCount(30)).toBe(6);
  });
});

describe('the campaign', () => {
  it('each chapter 1 map leads with a different one of the chapter\'s new enemies', () => {
    const ch1 = MAP_ORDER.filter((m) => chapterOf(m) === 1);
    const firsts = ch1.map((m) => {
      const g = createGame(m, 3, 2);
      return [...queued(g)];
    });
    // Wave 2 has exactly one foe, and the five maps cover all five.
    for (const f of firsts) expect(f).toHaveLength(1);
    expect(new Set(firsts.flat()).size).toBe(5);
    // The briefing's "first here" is that one.
    ch1.forEach((m, i) => {
      const st = newFoeState(m);
      expect(FOES[st.lead[st.cursor % st.lead.length]].kind).toBe(firsts[i][0]);
    });
  });

  it('wave 1 has none; a later wave has its count, each in place of a drone swarm', () => {
    expect(queued(createGame('strait', 5, 1)).size).toBe(0);
    const g = createGame('strait', 5, 7);
    const n = g.queue.filter((l) => FOE_ORDER.some((f) => FOES[f].kind === l.kind)).length;
    expect(n).toBe(foeCount(7));
  });
});

describe('Free Play', () => {
  it('"No new enemies" plays the waves without them; "Only" brings that one every wave', () => {
    const none = createGame('strait', 4, 7);
    applyFreePlay(none, { weapons: [], frequentDrops: false, enemies: 'none' });
    expect(queued(none).size).toBe(0);
    for (const f of FOES_BUILT) {
      const g = createGame('strait', 4, 7);
      applyFreePlay(g, { weapons: [], frequentDrops: false, enemies: f });
      expect([...queued(g)], f).toEqual([FOES[f].kind]);
    }
    const all = createGame('kesh', 4, 9);
    applyFreePlay(all, { weapons: [], frequentDrops: false, enemies: 'all' });
    expect(queued(all).size).toBeGreaterThan(0);
  });

  it('a Free Play run with an enemy chosen replays exactly from its log', () => {
    const freePlay = { weapons: [{ id: 'cutter' as const, level: 2 }], frequentDrops: true, enemies: 'rocketTruck' as FoeId };
    const { game, log } = playMimic('strait', 11, { firstWave: 5, freePlay });
    expect(log.freePlay).toEqual(freePlay);
    expect(game.kills.rocketTruck + game.sunkBy.rocketTruck).toBeGreaterThan(0);
    const again = replay(log);
    expect(again.steps).toBe(game.steps);
    expect(again.score).toBe(game.score);
    expect(again.kills).toEqual(game.kills);
  });
});

describe('chapter 1: Home Waters', () => {
  it('Sprint Drones cruise, flare their booster near the ship, then sprint at it', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'sprinter', base: 1 }, base(g));
    const sw = live(g, 'sprinter');
    expect(sw).toHaveLength(FOE.sprinter.size);
    const d0 = sw[0];
    run(g, 30, () => d0.foe!.state === 1);
    expect(d0.foe!.state).toBe(1);
    run(g, 30, () => d0.foe!.state === 2);
    run(g, 0.1);
    expect(Math.hypot(d0.vx, d0.vy)).toBeGreaterThan(250);
  });

  it('Decoys look like drones far out, strobe up close, and fizzle at the convoy without harm', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'decoy', base: 1 }, base(g));
    expect(live(g, 'decoy')).toHaveLength(FOE.decoy.fakes);
    expect(live(g, 'drone')).toHaveLength(FOE.decoy.size - FOE.decoy.fakes);
    // Real drones out of the way: only the decoys fly on.
    g.threats = g.threats.filter((t) => t.kind === 'decoy');
    const fakes = live(g, 'decoy');
    expect(fakes.every((t) => t.foe!.state === 0)).toBe(true);
    const carrier = g.carrierHp;
    run(g, 40, () => live(g, 'decoy').length === 0);
    expect(fakes.every((t) => t.foe!.state === 1 && t.dead)).toBe(true);
    expect(g.kills.decoy).toBe(0);
    // Nobody was hurt: every hull whole, the carrier untouched.
    expect(g.ships.every((s) => s.hp === g.stats.shipHp)).toBe(true);
    expect(g.carrierHp).toBe(carrier);
  });

  it('a Hydra killed splits into two darts at the ships nearest it; one that lands does not split', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'hydra', base: 1 }, base(g));
    const h = live(g, 'hydra')[0];
    run(g, 0.4);
    // Two hits on their way: the second splits it.
    g.ammo = 6;
    tap(g, h.x, h.y, 40);
    tap(g, h.x, h.y, 40);
    run(g, 2, () => h.dead);
    expect(h.dead).toBe(true);
    expect(g.kills.hydra).toBe(1);
    expect(live(g, 'dart')).toHaveLength(FOE.hydra.darts);
    expect(live(g, 'dart').every((d) => d.parent === 'hydra')).toBe(true);
    // One left alone hits its ship whole: no darts.
    g.threats = [];
    launchFoe(g, { at: 0, kind: 'hydra', base: 1 }, base(g));
    const h2 = live(g, 'hydra')[0];
    run(g, 20, () => h2.dead);
    expect(h2.dead).toBe(true);
    expect(g.kills.hydra).toBe(1);
    expect(live(g, 'dart')).toHaveLength(0);
  });

  it('a Rocket Truck drives in and raises (no rockets yet); after the raise its rockets can\'t be shot and hit ships', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'rocketTruck', base: -1 });
    const t = live(g, 'rocketTruck')[0];
    expect(t.hp).toBe(THREATS.rocketTruck.hp);
    run(g, 30, () => t.foe!.state === 1);
    expect(t.foe!.state).toBe(1);
    // All through the raise: nothing fired.
    run(g, FOE.rocketTruck.raise - 0.1);
    expect(g.foe.shots).toHaveLength(0);
    run(g, 0.3);
    run(g, 0.05, () => g.foe.shots.length > 0);
    expect(g.foe.shots.length).toBeGreaterThan(0);
    // The rockets are not threats: a tap can't reach them.
    expect(g.threats.some((th) => g.foe.shots.some((s) => s.id === th.id))).toBe(false);
    run(g, FOE.rocketTruck.gap * FOE.rocketTruck.rockets + 2);
    // They land on hulls: damage done, all of it the truck's.
    expect(g.sunkBy.rocketTruck + g.ships.filter((s) => s.hp < g.stats.shipHp).length).toBeGreaterThan(0);
    // Then it lowers the launcher and drives off: not a kill.
    run(g, 20, () => t.dead);
    expect(t.dead).toBe(true);
    expect(g.kills.rocketTruck).toBe(0);
  });

  it('a Rocket Truck killed while it raises fires nothing', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'rocketTruck', base: -1 });
    const t = live(g, 'rocketTruck')[0];
    run(g, 30, () => t.foe!.state === 1);
    for (let k = 0; k < THREATS.rocketTruck.hp && !t.dead; k++) {
      g.ammo = 6;
      tap(g, t.x, t.y, 40);
      run(g, 1.2, () => t.dead);
    }
    expect(t.dead).toBe(true);
    expect(g.kills.rocketTruck).toBe(1);
    run(g, 5);
    expect(g.foe.shots).toHaveLength(0);
  });

  it('Loitering Drones circle their spot until a ship comes near, then all dive at once', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'loiter', base: 1 }, base(g));
    const group = live(g, 'loiter');
    expect(group).toHaveLength(FOE.loiter.size);
    const f = group[0].foe!;
    // Waiting: they circle while no ship is inside the ring.
    run(g, 30, () => group.every((t) => t.foe!.state === 1));
    expect(group.every((t) => t.foe!.state === 1)).toBe(true);
    for (const t of group) expect(Math.hypot(t.x - f.px, t.y - f.py)).toBeLessThan(FOE.loiter.orbit + 2);
    const near = () => g.ships.some((s) => Math.hypot(s.x - f.px, s.y - f.py) <= FOE.loiter.trigger);
    run(g, 60, () => near() || group.some((t) => t.foe!.state === 2));
    // They dived together, and only once a ship came near.
    expect(near()).toBe(true);
    step(g, DT);
    expect(group.every((t) => t.foe!.state === 2)).toBe(true);
    expect(group.every((t) => t.x > -1 && t.x < VIEW.width + 1)).toBe(true);
  });
});
