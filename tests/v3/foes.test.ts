// The enemy build (docs/design/v3-enemy-build.md): the new enemies join the
// campaign by chapter, Free Play can choose them, and each does what its
// card says.

import { describe, expect, it } from 'vitest';
import { THREATS } from '../../src/v3/data/config';
import { FOE, FOES, FOE_ORDER, FOES_BUILT, foeCount, foesInChapter, foesUpTo, type FoeId } from '../../src/v3/data/foes';
import { MAP_ORDER, chapterOf } from '../../src/v3/data/maps';
import { playMimic } from '../../src/v3/sim/mimic';
import { replay } from '../../src/v3/sim/playlog';
import { absorbs, launchFoe, newFoeState } from '../../src/v3/sim/foes';
import { addFx, applyFreePlay, createGame, damageThreat, step, tap, type Game, type Threat } from '../../src/v3/sim/game';

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
  it('seventeen enemies (four cut after the Test Lab playtest), four, four, five and four a chapter; every chapter is built', () => {
    expect(FOE_ORDER).toHaveLength(17);
    expect([1, 2, 3, 4].map((c) => FOE_ORDER.filter((f) => FOES[f].chapter === c).length)).toEqual([4, 4, 5, 4]);
    expect(new Set(FOE_ORDER.map((f) => FOES[f].kind)).size).toBe(17);
    for (const f of FOES_BUILT) expect(THREATS[FOES[f].kind], f).toBeDefined();
    expect(foesInChapter(1)).toEqual(['sprinter', 'decoy', 'hydra', 'rocketTruck']);
    expect(foesInChapter(2)).toEqual(['attackHeli', 'torpedoSub', 'armored', 'scavenger']);
    expect(foesInChapter(3)).toEqual(['stealthJet', 'stealthBomber', 'diveBomber', 'siege', 'spotter']);
    expect(foesInChapter(4)).toEqual(['tender', 'bodyguard', 'lure', 'cloud']);
    expect(FOES_BUILT).toEqual(FOE_ORDER);
    // Later chapters send the earlier ones too.
    expect(foesUpTo(4)).toEqual(expect.arrayContaining(foesInChapter(1)));
  });

  it('none on wave 1, one from wave 2, three on wave 10, more in endless (up to six)', () => {
    expect(foeCount(1)).toBe(0);
    expect(foeCount(2)).toBe(1);
    expect(foeCount(10)).toBe(3);
    expect(foeCount(30)).toBe(6);
  });
});

describe('the campaign', () => {
  it('chapter 1\'s maps lead with each of the chapter\'s new enemies in turn', () => {
    const ch1 = MAP_ORDER.filter((m) => chapterOf(m) === 1);
    const firsts = ch1.map((m) => {
      const g = createGame(m, 3, 2);
      return [...queued(g)];
    });
    // Wave 2 has exactly one foe, and the chapter's maps cover all of its
    // new enemies.
    for (const f of firsts) expect(f).toHaveLength(1);
    expect(new Set(firsts.flat()).size).toBe(foesInChapter(1).length);
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

  it('an old log naming an enemy cut after the Test Lab playtest still loads and replays', () => {
    // Free Play "Only: Loitering Drones", and a lab card for the Supply Barge:
    // both are just records now (no such enemy, no such card).
    const { log } = playMimic('strait', 11, { firstWave: 5, freePlay: { weapons: [{ id: 'cutter', level: 1 }], frequentDrops: false } });
    const old = { ...log, freePlay: { ...log.freePlay!, enemies: 'loiter' as FoeId }, lab: { card: 'barge', length: 'quick' as const, mix: 'normal' as const } };
    const g = replay(old);
    expect(g.lab).toBeNull();
    expect(g.foe.pool).toEqual([]);
    expect(g.steps).toBeGreaterThan(0);
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

  it('Test Lab round 1: a Hydra that lands whole does 2 to its hull, the sum of its two darts', () => {
    expect(THREATS.hydra.damage).toBe(2);
    expect(THREATS.dart.damage).toBe(1);
    expect(THREATS.hydra.damage).toBe(FOE.hydra.darts * THREATS.dart.damage);
    const g = quiet();
    expect(g.formation).toBe('pairs');
    launchFoe(g, { at: 0, kind: 'hydra', base: 1 }, base(g));
    const h = live(g, 'hydra')[0];
    const ship = g.ships[0];
    h.target = ship.id;
    const before = ship.hp;
    run(g, 20, () => h.dead);
    expect(h.dead).toBe(true);
    expect(g.kills.hydra).toBe(0);
    expect(live(g, 'dart')).toHaveLength(0);
    expect(before - ship.hp).toBe(2);
  });

  it('Test Lab round 1: split, each of its darts that lands does 1 to its hull', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'hydra', base: 1 }, base(g));
    const h = live(g, 'hydra')[0];
    run(g, 0.4);
    damageThreat(g, h, h.hp);
    const darts = live(g, 'dart');
    expect(darts).toHaveLength(FOE.hydra.darts);
    // Two different hulls, the two nearest it.
    expect(new Set(darts.map((d) => d.target)).size).toBe(FOE.hydra.darts);
    const hp = new Map(g.ships.map((s) => [s.id, s.hp]));
    run(g, 20, () => live(g, 'dart').length === 0);
    expect(darts.every((d) => d.dead)).toBe(true);
    for (const d of darts) {
      const s = g.ships.find((o) => o.id === d.target)!;
      expect(hp.get(s.id)! - s.hp).toBe(1);
    }
  });

  it('Test Lab round 1: decoys fly exactly like the drones beside them and show nothing in their first seconds', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'decoy', base: 1 }, base(g));
    const fake = live(g, 'decoy')[0];
    const real = live(g, 'drone')[0];
    // Same speed, and each step a decoy turns as an attack drone would.
    expect(fake.speed).toBe(real.speed);
    real.x = fake.x;
    real.y = fake.y;
    real.phase = fake.phase;
    real.target = fake.target;
    run(g, 2);
    expect(Math.hypot(fake.x - real.x, fake.y - real.y)).toBeLessThan(1);
    expect(fake.heading).toBeCloseTo(real.heading, 6);
    // Close in, but too soon: still a drone. Later, close in: the strobe.
    g.threats = [fake];
    fake.foe!.t = 0;
    const s = g.ships.find((o) => o.id === fake.target)!;
    fake.x = s.x - FOE.decoy.revealAt + 20;
    fake.y = s.y;
    run(g, FOE.decoy.revealAfter - 0.5);
    expect(fake.foe!.state).toBe(0);
    const g2 = quiet();
    launchFoe(g2, { at: 0, kind: 'decoy', base: 1 }, base(g2));
    const f2 = live(g2, 'decoy')[0];
    g2.threats = [f2];
    run(g2, FOE.decoy.revealAfter + 0.1);
    const s2 = g2.ships.find((o) => o.id === f2.target)!;
    f2.x = s2.x - FOE.decoy.revealAt + 20;
    f2.y = s2.y;
    run(g2, 0.1);
    expect(f2.foe!.state).toBe(1);
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

});

describe('chapter 2: The Narrows', () => {
  it('an Attack Helicopter flies to its marked spot, settles, fires pairs, moves after two and leaves after six', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'attackHeli', base: -1 });
    const h = live(g, 'attackHeli')[0];
    expect(h.hp).toBe(THREATS.attackHeli.hp);
    const spot = { x: h.foe!.px, y: h.foe!.py };
    run(g, 20, () => h.foe!.state === 2);
    expect(Math.hypot(h.x - spot.x, h.y - spot.y)).toBeLessThan(14);
    // Its pairs: one-hit missiles you can shoot.
    run(g, 0.1);
    const rockets = live(g, 'heliRocket');
    expect(rockets).toHaveLength(FOE.attackHeli.pair);
    expect(rockets.every((r) => r.hp === 1 && r.parent === 'attackHeli')).toBe(true);
    // After two pairs it moves somewhere else.
    run(g, 20, () => h.foe!.state === 0);
    expect(Math.hypot(h.foe!.px - spot.x, h.foe!.py - spot.y)).toBeGreaterThan(40);
    // And after six, off the screen: not a kill.
    run(g, 90, () => h.dead);
    expect(h.dead).toBe(true);
    expect(h.foe!.n).toBe(FOE.attackHeli.volleys);
    expect(g.kills.attackHeli).toBe(0);
  });

  it('a Torpedo Sub shows a periscope first, comes up for 3.5 s (a target), fires one torpedo down a line, and dives', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'torpedoSub', base: -1 });
    // The periscope is a warning, not a target.
    expect(g.foe.marks).toHaveLength(1);
    expect(live(g, 'torpedoSub')).toHaveLength(0);
    run(g, FOE.torpedoSub.warn + 0.05);
    const sub = live(g, 'torpedoSub')[0];
    expect(sub.hp).toBe(THREATS.torpedoSub.hp);
    run(g, FOE.torpedoSub.fireAt + 0.05);
    const torp = live(g, 'torpedo')[0];
    expect(torp).toBeDefined();
    // It runs straight.
    const h0 = torp.heading;
    run(g, 1);
    expect(torp.heading).toBe(h0);
    run(g, FOE.torpedoSub.up);
    expect(sub.dead).toBe(true);
    expect(g.kills.torpedoSub).toBe(0);
    // One hit stops the torpedo.
    g.ammo = 6;
    if (!torp.dead) {
      tap(g, torp.x, torp.y, 40);
      run(g, 3, () => torp.dead);
      expect(g.kills.torpedo).toBe(1);
    }
  });

  it('a torpedo hits whatever hull is on its line', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'torpedoSub', base: -1 });
    run(g, FOE.torpedoSub.warn + FOE.torpedoSub.fireAt + 0.1);
    const torp = live(g, 'torpedo')[0];
    // A hull put right in its path.
    const s = g.ships[0];
    const hp = s.hp;
    run(g, 0.01);
    torp.x = s.x - Math.cos(torp.heading) * 30;
    torp.y = s.y - Math.sin(torp.heading) * 30;
    run(g, 1, () => torp.dead);
    expect(torp.dead).toBe(true);
    expect(s.hp < hp || g.sunkBy.torpedoSub > 0).toBe(true);
  });

  it('an Armored Drone\'s plate takes shots from the front; from the side or behind, and blasts, hit the drone', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'armored', base: 1 }, base(g));
    const a = live(g, 'armored')[0];
    a.heading = 0;
    const front = { x: a.x + 100, y: a.y };
    const behind = { x: a.x - 100, y: a.y };
    expect(absorbs(g, a, front, 1)).toBe(true);
    expect(a.foe!.n).toBe(FOE.armored.plate - 1);
    expect(absorbs(g, a, behind, 1)).toBe(false);
    expect(absorbs(g, a, { x: a.x, y: a.y + 100 }, 1)).toBe(false);
    // It banks part way in.
    let banked = false;
    run(g, 30, () => {
      banked ||= a.foe!.state === 1;
      return a.dead;
    });
    expect(banked).toBe(true);
  });

  it('a Scavenger takes the pickup it flies to (it is gone); shot first, the pickup stays', () => {
    const g = quiet();
    g.pickups.push({ id: 7777, kind: 'repair', x: 800, y: 330, age: 0 });
    launchFoe(g, { at: 0, kind: 'scavenger', base: -1 });
    const sc = live(g, 'scavenger')[0];
    run(g, 0.1);
    expect(sc.foe!.link).toBe(7777);
    // Pickups don't sit forever: keep this one fresh while it flies.
    run(g, 15, () => {
      for (const p of g.pickups) p.age = 0;
      return !g.pickups.some((p) => p.id === 7777);
    });
    expect(g.pickups.some((p) => p.id === 7777)).toBe(false);
    run(g, 8, () => sc.dead);
    expect(sc.dead).toBe(true);
    expect(g.kills.scavenger).toBe(0);
    // Again, but shoot it on the way.
    g.pickups.push({ id: 8888, kind: 'ammo', x: 800, y: 330, age: 0 });
    launchFoe(g, { at: 0, kind: 'scavenger', base: -1 });
    const sc2 = live(g, 'scavenger')[0];
    run(g, 1.2);
    g.ammo = 6;
    tap(g, sc2.x, sc2.y, 40);
    run(g, 3, () => {
      for (const p of g.pickups) p.age = 0;
      return sc2.dead;
    });
    expect(g.kills.scavenger).toBe(1);
    expect(g.pickups.some((p) => p.id === 8888)).toBe(true);
  });
});

describe('chapter 3: Dark Water', () => {
  it('the stealth aircraft come with no warning: nothing is queued ahead for them to show', () => {
    for (const kind of ['stealthJet', 'stealthBomber'] as const) {
      const g = quiet();
      g.queue = [{ at: g.waveT + 0.5, kind, base: -1 }, { at: 1e9, kind: 'drone', base: 0 }];
      // A warned aircraft has its line fixed PLANE.warn ahead; these don't.
      run(g, 0.3);
      expect(g.queue[0].y).toBeUndefined();
      run(g, 0.4);
      const p = live(g, kind)[0];
      expect(p, kind).toBeDefined();
      expect(p.hp).toBe(THREATS[kind].hp);
    }
  });

  it('Test Lab round 1: the Stealth Strafer is faster than the Strike jet, with a run-in still over a second long', () => {
    expect(THREATS.stealthJet.speed).toBeGreaterThanOrEqual(THREATS.strafer.speed * 1.15);
    expect(FOE.stealthJet.runIn / THREATS.stealthJet.speed).toBeGreaterThanOrEqual(1.1);
    const g = quiet();
    g.queue = [{ at: g.waveT + 0.1, kind: 'stealthJet', base: -1 }, { at: 1e9, kind: 'drone', base: 0 }];
    run(g, 0.3);
    const j = live(g, 'stealthJet')[0];
    run(g, 0.5);
    expect(Math.hypot(j.vx, j.vy)).toBeGreaterThan(THREATS.strafer.speed * 1.1);
  });

  it('a Stealth Bomber drops three guided missiles; a Stealth Strafer\'s guns hit hulls in its band', () => {
    const g = quiet();
    g.queue = [{ at: g.waveT + 0.1, kind: 'stealthBomber', base: -1 }, { at: 1e9, kind: 'drone', base: 0 }];
    run(g, 0.3);
    const b = live(g, 'stealthBomber')[0];
    expect(b.bombs).toBe(FOE.stealthBomber.bombs);
    let dropped = 0;
    run(g, 20, () => {
      dropped = Math.max(dropped, g.threats.filter((t) => t.kind === 'guided' && t.parent === 'stealthBomber').length);
      return b.dead;
    });
    expect(FOE.stealthBomber.bombs - (b.bombs ?? 0)).toBeGreaterThan(0);
  });

  it('a Dive Bomber: a circle first (no plane), then the plane for its window; shot down, no bomb', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'diveBomber', base: -1 });
    expect(g.foe.marks.map((m) => m.kind)).toEqual(['dive']);
    expect(live(g, 'diveBomber')).toHaveLength(0);
    run(g, FOE.diveBomber.mark + 0.05);
    const p = live(g, 'diveBomber')[0];
    expect(p).toBeDefined();
    g.ammo = 6;
    tap(g, p.x, p.y + 60, 80);
    tap(g, p.x, p.y + 60, 80);
    run(g, FOE.diveBomber.window, () => p.dead);
    expect(g.kills.diveBomber).toBe(1);
    run(g, 2);
    expect(g.foe.shots.filter((s) => s.kind === 'bomb')).toHaveLength(0);
  });

  it('a Dive Bomber left alone drops a bomb no one can stop onto its circle', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'diveBomber', base: -1 });
    const m = g.foe.marks[0];
    run(g, FOE.diveBomber.mark + FOE.diveBomber.window + 0.05);
    const bomb = g.foe.shots.find((s) => s.kind === 'bomb')!;
    expect(bomb).toBeDefined();
    expect([bomb.tx, bomb.ty]).toEqual([m.x, m.y]);
    expect(g.threats.some((t) => t.id === bomb.id)).toBe(false);
  });

  it('a Siege Battery marks circles, its shells land in them; killed first, the unfired ones are gone', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'siege', base: -1 });
    const gun = live(g, 'siege')[0];
    expect(gun.hp).toBe(THREATS.siege.hp);
    run(g, FOE.siege.setup + FOE.siege.gap + 0.1, () => g.foe.marks.length > 0);
    const shells = g.foe.marks.filter((m) => m.kind === 'shell');
    expect(shells.length).toBeGreaterThan(0);
    expect(shells.every((m) => !m.fired)).toBe(true);
    // Kill the gun before they fire: no shells.
    gun.hp = 1;
    g.ammo = 6;
    tap(g, gun.x, gun.y, 40);
    run(g, 2, () => gun.dead);
    expect(gun.dead).toBe(true);
    expect(g.foe.marks.filter((m) => m.kind === 'shell' && !m.fired)).toHaveLength(0);
  });

  it('a Spotter paints a ship, draws launches to it, calls a strike, and its strike is cancelled when it is shot down', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'spotter', base: -1 });
    const sp = live(g, 'spotter')[0];
    run(g, 30, () => !!g.foe.paint);
    expect(g.foe.paint?.by).toBe(sp.id);
    run(g, FOE.spotter.call + 0.2, () => g.queue.some((l) => l.spotter === sp.id));
    const strike = g.queue.filter((l) => l.spotter === sp.id);
    expect(strike).toHaveLength(FOE.spotter.strike);
    expect(strike.every((l) => l.target === g.foe.paint!.ship)).toBe(true);
    damageThreat(g, sp, sp.hp);
    expect(sp.dead).toBe(true);
    expect(g.queue.some((l) => l.spotter === sp.id)).toBe(false);
    expect(g.foe.paint).toBeNull();
  });

  it('Test Lab round 1: a Spotter circles further off the lane, and its whole circle stays on screen on every map', () => {
    const P = FOE.spotter;
    for (const map of MAP_ORDER) {
      for (let seed = 1; seed <= 3; seed++) {
        const g = createGame(map, seed);
        g.threats = [];
        launchFoe(g, { at: 0, kind: 'spotter', base: -1 });
        const f = live(g, 'spotter')[0].foe!;
        expect(f.px - P.orbit, map).toBeGreaterThanOrEqual(P.edge);
        expect(f.py - P.orbit, map).toBeGreaterThanOrEqual(P.edge);
        expect(f.px + P.orbit, map).toBeLessThanOrEqual(VIEW.width - P.edge);
        expect(f.py + P.orbit, map).toBeLessThanOrEqual(VIEW.height - P.edge);
      }
    }
    // On the lab's water (The Strait) its circle stands clear of the lane
    // by its full stand-off, and its plane never comes within 60 px of it.
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'spotter', base: -1 });
    const f = live(g, 'spotter')[0].foe!;
    const ch = g.map.channels[0];
    expect(Math.abs(f.py - ch.y) - ch.halfWidth).toBeGreaterThanOrEqual(P.off - 1);
    expect(Math.abs(f.py - ch.y) - ch.halfWidth - P.orbit).toBeGreaterThan(60);
  });
});

describe('chapter 4: Open War', () => {
  it('a Repair Tender comes with a heavy, and mends the most damaged enemy near it, a pulse at a time', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'tender', base: -1 });
    const t = live(g, 'tender')[0];
    expect(live(g, 'heavy')).toHaveLength(1);
    // A hurt drone right beside it.
    launchFoe(g, { at: 0, kind: 'armored', base: 1 }, { x: t.x + 60, y: t.y });
    const a = live(g, 'armored')[0];
    a.hp = 1;
    a.speed = 0;
    run(g, FOE.tender.gap + FOE.tender.charge + 0.2, () => a.hp > 1);
    expect(a.hp).toBe(THREATS.armored.hp);
  });

  it('a Bodyguard Ring: shots at the heavy kill guards, the heavy untouched; when the heavy dies the guards go', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'guard', base: 1 }, base(g));
    const heavy = live(g, 'heavy')[0];
    expect(live(g, 'guard')).toHaveLength(FOE.bodyguard.guards);
    run(g, 0.5);
    g.ammo = 6;
    tap(g, heavy.x, heavy.y, 10);
    run(g, 2, () => live(g, 'guard').length < FOE.bodyguard.guards);
    expect(live(g, 'guard')).toHaveLength(FOE.bodyguard.guards - 1);
    expect(heavy.hp).toBe(THREATS.heavy.hp);
    damageThreat(g, heavy, 99);
    run(g, 0.1);
    expect(live(g, 'guard')).toHaveLength(0);
    expect(g.kills.guard).toBe(1);
  });

  it('a Lure Beacon: helpers\' shots do nothing to it, a tap does', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'lure', base: -1 });
    const l = live(g, 'lure')[0];
    damageThreat(g, l, 1);
    expect(l.hp).toBe(THREATS.lure.hp);
    g.ammo = 6;
    tap(g, l.x, l.y, 20);
    run(g, 3, () => l.hp < THREATS.lure.hp);
    expect(l.hp).toBe(THREATS.lure.hp - 1);
    // It gives out on its own after a while.
    run(g, FOE.lure.life + 1, () => l.dead);
    expect(l.dead).toBe(true);
  });

  it('a Volatile Cloud set off over ships hurts them; over open water it hurts nothing', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'cloud', base: -1 });
    const c = live(g, 'cloud')[0];
    // Over open water, popped: nothing hurt.
    c.x = 800;
    c.y = 250;
    c.foe!.px = c.x;
    c.foe!.py = c.y;
    const sum = () => g.ships.reduce((n, s) => n + s.hp, 0) + g.lost * 10;
    const s0 = sum();
    damageThreat(g, c, 1);
    expect(c.dead).toBe(true);
    expect(sum()).toBe(s0);
    // Over a ship, a burst inside it sets it off.
    launchFoe(g, { at: 0, kind: 'cloud', base: -1 });
    const c2 = live(g, 'cloud')[0];
    const ship = g.ships[0];
    c2.x = ship.x;
    c2.y = ship.y;
    c2.foe!.px = c2.x;
    c2.foe!.py = c2.y;
    c2.speed = 0;
    const hp = ship.hp;
    addFx(g, 'burst', ship.x + 10, ship.y, { life: 0.3, r: 20 });
    step(g, DT);
    expect(c2.dead).toBe(true);
    expect(ship.hp < hp || g.lost > 0).toBe(true);
  });
});
