// The enemy build (docs/design/v3-enemy-build.md): the new enemies join the
// campaign by chapter, Free Play can choose them, and each does what its
// card says.

import { describe, expect, it } from 'vitest';
import { SHIP, THREATS, VIEW } from '../../src/v3/data/config';
import { AB, type AbilityId } from '../../src/v3/data/abilities';
import { FOE, FOES, FOE_ORDER, FOES_BUILT, foeCount, foesInChapter, foesUpTo, type FoeId } from '../../src/v3/data/foes';
import { MAP_ORDER, chapterOf } from '../../src/v3/data/maps';
import { playMimic } from '../../src/v3/sim/mimic';
import { replay } from '../../src/v3/sim/playlog';
import { absorbs, launchFoe, lureIn, newFoeState, onLand } from '../../src/v3/sim/foes';
import { Bot, SKILLS } from '../../src/v3/sim/bot';
import { CARRIER_TARGET, applyFreePlay, applyLab, createGame, damageThreat, shipAhead, spawnThreat, step, tap, worthShooting, type Game, type Threat } from '../../src/v3/sim/game';

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
    // Same speed, and each step a decoy turns as an attack drone would: a
    // real drone of the same swarm put in its place (its slot in the
    // swarm too), each flown on its own in the same sea.
    const g1 = quiet();
    launchFoe(g1, { at: 0, kind: 'decoy', base: 1 }, base(g1));
    const real = live(g1, 'drone')[0];
    expect(fake.speed).toBe(real.speed);
    real.x = fake.x;
    real.y = fake.y;
    real.phase = fake.phase;
    real.target = fake.target;
    real.slot = fake.slot;
    g.threats = [fake];
    g1.threats = [real];
    run(g, 2);
    run(g1, 2);
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
    run(g, FOE.rocketTruck.gap * FOE.rocketTruck.salvos + 2);
    // They land on hulls: damage done, all of it the truck's.
    expect(g.sunkBy.rocketTruck + g.ships.filter((s) => s.hp < g.stats.shipHp).length).toBeGreaterThan(0);
    // Then it lowers the launcher and drives off: not a kill.
    run(g, 20, () => t.dead);
    expect(t.dead).toBe(true);
    expect(g.kills.rocketTruck).toBe(0);
  });

  it('each firing is a ripple of five small rockets a tenth of a second apart round one ship, and the salvo does one hit', () => {
    const R = FOE.rocketTruck;
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'rocketTruck', base: -1 });
    const t = live(g, 'rocketTruck')[0];
    run(g, 40, () => g.foe.shots.length > 0);
    const ships = [...g.ships];
    const hull = () => ships.reduce((a, s) => a + Math.max(0, s.hp), 0);
    const before = hull();
    const launched: number[] = [];
    const seen = new Set<number>();
    const t0 = g.t;
    for (let i = 0; i < 60 && launched.length < R.perSalvo; i++) {
      for (const s of g.foe.shots) if (!seen.has(s.id)) {
        seen.add(s.id);
        launched.push(g.t - t0);
      }
      step(g, DT);
    }
    // Five, about 0.1 s apart, all one salvo, landing round one point.
    expect(launched).toHaveLength(R.perSalvo);
    for (let k = 1; k < launched.length; k++) expect(launched[k] - launched[k - 1]).toBeCloseTo(R.ripple, 1);
    const salvo = g.foe.shots.filter((s) => seen.has(s.id));
    expect(new Set(salvo.map((s) => s.salvo)).size).toBe(1);
    const cx = salvo[0].tx;
    const cy = salvo[0].ty;
    for (const s of salvo) expect(Math.hypot(s.tx - cx, s.ty - cy)).toBeLessThanOrEqual(2 * R.spread + 30);
    // All of them land; the salvo costs at most one hull point (what one
    // rocket did before).
    run(g, 1.2, () => g.foe.shots.every((s) => !seen.has(s.id)));
    expect(before - hull()).toBeLessThanOrEqual(1);
    // The whole truck: five salvos, at most five hull points.
    run(g, 30, () => t.dead);
    expect(t.foe!.n).toBe(0);
    expect(before - hull()).toBeLessThanOrEqual(R.salvos);
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
    // It flies in from off the screen; shot once it is in sight.
    run(g, 5, () => p.y > 80 && p.x > 0 && p.x < VIEW.width);
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
    run(g, 12, () => g.foe.shots.some((s) => s.kind === 'bomb'));
    const bomb = g.foe.shots.find((s) => s.kind === 'bomb')!;
    expect(bomb).toBeDefined();
    expect([bomb.tx, bomb.ty]).toEqual([m.x, m.y]);
    expect(g.threats.some((t) => t.id === bomb.id)).toBe(false);
  });

  it('a Dive Bomber flies in from off the screen at its circle, in sight all its window, then pulls away off screen', () => {
    const D = FOE.diveBomber;
    for (const seed of [1, 2, 3, 4]) {
      const g = quiet(seed);
      launchFoe(g, { at: 0, kind: 'diveBomber', base: -1 });
      const m = g.foe.marks[0];
      run(g, D.mark + 0.02, () => live(g, 'diveBomber').length > 0);
      const p = live(g, 'diveBomber')[0];
      // It sets off well past the screen's edge: it and its shadow (drawn
      // up to ~100 px below and right of it) are out of sight.
      expect(p.y < -100 || p.x < -100 || p.x > VIEW.width + 100, `seed ${seed}: (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`).toBe(true);
      let last = Math.hypot(p.x - m.x, p.y - m.y);
      let inSight = 0;
      while (!g.foe.shots.some((s) => s.kind === 'bomb')) {
        step(g, DT);
        expect(p.dead).toBe(false);
        const d = Math.hypot(p.x - m.x, p.y - m.y);
        // Straight in at its circle, never faster than its cruise.
        expect(d).toBeLessThan(last + 1e-6);
        expect((last - d) / DT).toBeLessThanOrEqual(D.cruise + 0.5);
        last = d;
        if (p.x >= 0 && p.x <= VIEW.width && p.y >= 0 && p.y <= VIEW.height) inSight += DT;
      }
      // In sight for at least its whole dive (more when its circle is low).
      expect(inSight).toBeGreaterThanOrEqual(D.window - 0.05);
      expect(last).toBeLessThan(D.short + 20);
      // Then away and gone (not a kill).
      run(g, 5, () => p.dead);
      expect(p.dead).toBe(true);
      expect(g.kills.diveBomber).toBe(0);
    }
  });

  it('a Siege Battery comes up out of a hatch, marks circles, its shells land in them; killed first, the unfired ones are gone', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'siege', base: -1 });
    // A closed hatch first: nothing to shoot.
    expect(g.foe.marks.map((m) => m.kind)).toEqual(['hatch']);
    expect(live(g, 'siege')).toHaveLength(0);
    run(g, FOE.siege.first + 0.05);
    const gun = live(g, 'siege')[0];
    expect(gun.hp).toBe(THREATS.siege.hp);
    run(g, FOE.siege.rise + 0.1, () => g.foe.marks.some((m) => m.kind === 'shell'));
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

  it('a Siege Battery goes down into its hatch between salvos: no target for taps, blasts or bots, then up again with its hits kept', () => {
    const S = FOE.siege;
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'siege', base: -1 });
    run(g, S.first + 0.05);
    const gun = live(g, 'siege')[0];
    // Up: one hit lands on it.
    g.ammo = 6;
    tap(g, gun.x, gun.y, 40);
    run(g, 2.5, () => gun.hp < THREATS.siege.hp);
    expect(gun.hp).toBe(THREATS.siege.hp - 1);
    // After its shells leave, it goes down: gone from the board.
    run(g, S.rise + S.mark + 1, () => g.foe.marks.some((m) => m.kind === 'hatch'));
    run(g, 0.1);
    expect(g.threats.includes(gun)).toBe(false);
    expect(g.foe.marks.filter((m) => m.kind === 'shell' && !m.fired)).toHaveLength(0);
    // Down: off the board, so taps, blasts, helpers and the bots (all of
    // them work from g.threats) find nothing there; the wave waits for it.
    g.ammo = 6;
    tap(g, gun.x, gun.y, 40);
    run(g, 0.8);
    expect(gun.hp).toBe(THREATS.siege.hp - 1);
    expect(worthShooting(g, g.threats).includes(gun)).toBe(false);
    expect(g.phase).toBe('wave');
    // Up again, the same gun with its hit kept, and one salvo fewer.
    run(g, S.down + 0.2, () => g.threats.includes(gun));
    expect(g.threats.includes(gun)).toBe(true);
    expect(gun.hp).toBe(THREATS.siege.hp - 1);
    expect(gun.foe!.n).toBe(S.salvos - 1);
    // After its last salvo it goes down for good: not a kill.
    run(g, 40, () => !g.threats.includes(gun) && gun.foe!.n === 0 && !g.foe.marks.some((m) => m.kind === 'hatch'));
    expect(gun.foe!.n).toBe(0);
    expect(g.kills.siege).toBe(0);
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
  it('a Repair Ship comes with a heavy, and mends the most damaged enemy near it, a pulse at a time', () => {
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

});

describe('Test Lab round 2 notes (2026-11-08): the Dive Bomber, the Incendiary Missile, the Decoy Drones', () => {
  it('the Dive Bomber is quicker than round 1: its run is shorter', () => {
    const D = FOE.diveBomber;
    expect(D.window).toBeLessThan(2.2);
  });

  it('an Incendiary Missile leads its ship: it lands ahead of where the ship was, on the bow, never trailing it', () => {
    for (const seed of [1, 2, 3, 4]) {
      for (const b of [0, 1, 2]) {
        const g = quiet(seed);
        const from = g.map.bases[b];
        launchFoe(g, { at: 0, kind: 'cloud', base: b }, from);
        const c = live(g, 'cloud')[0];
        const ship = g.ships.find((s) => s.id === c.target)!;
        expect(ship, `seed ${seed} base ${b}`).toBeDefined();
        const at0 = { x: ship.x, y: ship.y };
        const fwd = { x: Math.cos(ship.heading), y: Math.sin(ship.heading) };
        let trail = 0;
        let hitAt = { x: 0, y: 0 };
        let rel = 0;
        run(g, 40, () => {
          if (!c.dead) {
            hitAt = { x: c.x, y: c.y };
            // Along the ship's course: + ahead of its middle, - behind it.
            rel = (c.x - ship.x) * fwd.x + (c.y - ship.y) * fwd.y;
            if (Math.hypot(c.x - ship.x, c.y - ship.y) < 150) trail = Math.max(trail, -rel);
          }
          return c.dead;
        });
        expect(c.dead, `seed ${seed} base ${b}`).toBe(true);
        expect(g.ships.includes(ship) ? Math.hypot(hitAt.x - ship.x, hitAt.y - ship.y) : 0).toBeLessThan(SHIP.hitRadius + 8);
        // It lands well ahead of where its ship was at launch...
        expect((hitAt.x - at0.x) * fwd.x + (hitAt.y - at0.y) * fwd.y, `seed ${seed} base ${b}`).toBeGreaterThan(60);
        // ...on the bow half, and close in it is never behind the ship.
        expect(rel, `seed ${seed} base ${b}`).toBeGreaterThanOrEqual(0);
        expect(trail, `seed ${seed} base ${b}`).toBeLessThan(10);
      }
    }
  });

  it('a Decoy Drones swarm spreads out: wide at launch, its drones apart all the way in, real and decoy alike', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'decoy', base: 1 }, base(g));
    const swarm = g.threats.filter((t) => !t.dead && (t.kind === 'decoy' || t.kind === 'drone'));
    expect(swarm).toHaveLength(FOE.decoy.size);
    expect(swarm.every((t) => t.slot !== undefined)).toBe(true);
    const width = () => {
      const xs = swarm.map((t) => t.x);
      const ys = swarm.map((t) => t.y);
      return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    };
    const gap = () => {
      let m = Infinity;
      for (const a of swarm) for (const o of swarm) if (a !== o && !a.dead && !o.dead) m = Math.min(m, Math.hypot(a.x - o.x, a.y - o.y));
      return m;
    };
    expect(width()).toBeGreaterThanOrEqual(FOE.decoy.spread * (FOE.decoy.size - 1));
    let least = Infinity;
    let widest = 0;
    for (let t = 0; t < 3.5; t += 0.25) {
      run(g, 0.25);
      least = Math.min(least, gap());
      widest = Math.max(widest, width());
    }
    // Not one clump: no two drones on top of each other, the swarm wide.
    expect(least).toBeGreaterThan(20);
    expect(widest).toBeGreaterThan(200);
  });
});

describe('Test Lab round 1 (2026-11-08): cloud, lure, tender, scavenger', () => {
  /** Load a weapon the way a finger does: its pickup, tapped. */
  function load(g: Game, id: AbilityId): void {
    g.levels[id] = 1;
    g.slots = [id];
    g.pickups.push({ id: 9900 + g.steps, kind: 'weapon', weapon: id, x: 600, y: 300, age: 0 });
    tap(g, 600, 300, 20);
  }
  /** A tough, still target at (x, y) the helpers would otherwise go for. */
  function bait(g: Game, x: number, y: number): Threat {
    const t = spawnThreat(g, 'heavy', x, y, 'base');
    t.speed = 0;
    t.hp = 99;
    return t;
  }
  function lureAt(g: Game, x: number, y: number): Threat {
    launchFoe(g, { at: 0, kind: 'lure', base: -1 });
    const l = live(g, 'lure')[0];
    l.x = x;
    l.y = y;
    return l;
  }

  it('a Incendiary Missile is a slow two-hit missile at a ship; shot down far out, its fireball hangs there and hurts nothing', () => {
    const g = quiet();
    launchFoe(g, { at: 0, kind: 'cloud', base: 1 }, base(g));
    const c = live(g, 'cloud')[0];
    expect(c.hp).toBe(2);
    expect(g.ships.some((s) => s.id === c.target)).toBe(true);
    expect(c.speed).toBeLessThan(THREATS.guided.speed / 2);
    run(g, 1);
    const hp0 = new Map(g.ships.map((s) => [s.id, s.hp]));
    const lost0 = g.lost;
    const at = { x: c.x, y: c.y };
    damageThreat(g, c, 2);
    expect(c.dead).toBe(true);
    const fire = g.foe.marks.find((m) => m.kind === 'fire')!;
    expect(fire).toBeDefined();
    expect(Math.hypot(fire.x - at.x, fire.y - at.y)).toBeLessThan(1);
    // It lingers its few seconds, then thins out; nothing near it was hurt.
    run(g, FOE.cloud.linger - 0.5);
    expect(g.foe.marks.some((m) => m.kind === 'fire')).toBe(true);
    run(g, 1);
    expect(g.foe.marks.some((m) => m.kind === 'fire')).toBe(false);
    for (const s of g.ships) if (hp0.has(s.id)) expect(s.hp).toBe(hp0.get(s.id));
    expect(g.lost).toBe(lost0);
    // Launched like a missile, out of a base.
    expect(FOES.cloud.from).toBe('base');
  });

  it('a Incendiary Missile left alone hits its ship and bursts there; a ship sailing through the fire takes one or two hits, not a sinking', () => {
    const g = quiet(4);
    launchFoe(g, { at: 0, kind: 'cloud', base: 1 }, base(g));
    const c = live(g, 'cloud')[0];
    run(g, 40, () => c.dead);
    expect(c.dead).toBe(true);
    const fire = g.foe.marks.find((m) => m.kind === 'fire')!;
    expect(fire).toBeDefined();
    expect(g.ships.some((s) => Math.hypot(s.x - fire.x, s.y - fire.y) < FOE.cloud.radius) || g.lost > 0).toBe(true);
    // A fresh ship crossing the middle of a cloud: one or two hits.
    const g2 = quiet(5);
    const ship = g2.ships[0];
    ship.hp = 3;
    const { x, y } = shipAhead(g2, ship, (FOE.cloud.radius + 30) / SHIP.speed);
    g2.foe.marks.push({ id: 1, kind: 'fire', x, y, t: 0, dur: 99, dose: {} });
    let inside = 0;
    run(g2, 12, () => {
      if (Math.hypot(ship.x - x, ship.y - y) <= FOE.cloud.radius) inside += DT;
      return inside > 0 && Math.hypot(ship.x - x, ship.y - y) > FOE.cloud.radius + 5;
    });
    expect(inside).toBeGreaterThan(2);
    expect(3 - ship.hp).toBeGreaterThanOrEqual(1);
    expect(3 - ship.hp).toBeLessThanOrEqual(2);
    expect(g2.ships).toContain(ship);
  });

  it('the Test Lab counts the fire\'s damage against the Incendiary Missile, and a missile shot down far out as stopped before harm', () => {
    const g = createGame('strait', 3, 5);
    applyFreePlay(g, { weapons: [], frequentDrops: false });
    applyLab(g, { card: 'cloud', length: 'quick', mix: 'normal' });
    g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    g.raiderQueue = [];
    run(g, 20);
    g.threats = [];
    launchFoe(g, { at: 0, kind: 'cloud', base: 1 }, base(g));
    const c = live(g, 'cloud')[0];
    run(g, 0.5);
    const killed = g.lab!.stats.killed;
    const early = g.lab!.stats.early;
    damageThreat(g, c, 2);
    expect(g.lab!.stats.killed).toBe(killed + 1);
    expect(g.lab!.stats.early).toBe(early + 1);
    const harm = g.lab!.stats.harm;
    const ship = g.ships[0];
    g.foe.marks.push({ id: 1, kind: 'fire', x: ship.x, y: ship.y, t: 0, dur: 99, dose: {} });
    run(g, 3);
    expect(g.lab!.stats.harm).toBeGreaterThan(harm);
  });

  it('the bots shoot a Incendiary Missile early, while it is still far from the convoy', () => {
    const g = quiet(6);
    launchFoe(g, { at: 0, kind: 'cloud', base: 1 }, base(g));
    const c = live(g, 'cloud')[0];
    const bot = new Bot(SKILLS.average, 6);
    g.ammo = g.stats.rack;
    let near = Infinity;
    for (let i = 0; i < 60 * 30 && !c.dead; i++) {
      bot.act(g);
      step(g, DT);
      if (!c.dead) near = g.ships.reduce((m, s) => Math.min(m, Math.hypot(s.x - c.x, s.y - c.y)), Infinity);
    }
    expect(c.dead).toBe(true);
    expect(near).toBeGreaterThan(FOE.cloud.radius * 2);
  });

  it('a Lure Beacon rises out of the water first, then every helper goes for it over a real threat', () => {
    // Drone Screen: drones already after a threat turn for the beacon.
    const g = quiet();
    load(g, 'droneScreen');
    const c = g.map.carrier;
    const heavy = bait(g, c.x + 650, c.y - 450);
    run(g, 1);
    expect(g.wings.some((w) => w.target === heavy.id)).toBe(true);
    const l = lureAt(g, c.x - 500, c.y - 380);
    expect(l.foe!.state).toBe(0);
    // Rising: it draws nothing yet.
    expect(lureIn(g, l.x, l.y)).toBeUndefined();
    run(g, FOE.lure.rise + 0.1);
    expect(l.foe!.state).toBe(1);
    run(g, 0.1);
    const after = g.wings.filter((w) => w.target !== null);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((w) => w.target === l.id)).toBe(true);
    expect(l.hp).toBe(THREATS.lure.hp); // and they do nothing to it

    // Gunships: a threat beside the beacon draws them to the beacon.
    const g2 = quiet(2);
    load(g2, 'gunships');
    run(g2, 4);
    const h = g2.helis[0];
    const t2 = bait(g2, h.x + 80, h.y - 120);
    const l2 = lureAt(g2, t2.x + 200, t2.y - 60);
    run(g2, FOE.lure.rise + 0.1);
    const n0 = g2.hellfires.length;
    run(g2, 2.5, () => g2.hellfires.length > n0);
    expect(g2.hellfires.length).toBeGreaterThan(n0);
    expect(g2.hellfires.every((m) => m.target === l2.id)).toBe(true);

    // Frigates: a beacon beyond their reach still draws them when what they
    // would shoot is inside its ring.
    const g3 = quiet(3);
    load(g3, 'frigate');
    run(g3, 6);
    const e = g3.escorts[0];
    const t3 = bait(g3, e.x, e.y - 200);
    const l3 = lureAt(g3, t3.x + 120, t3.y - 200);
    run(g3, FOE.lure.rise + 0.1);
    const i0 = g3.interceptors.length;
    run(g3, 1.5);
    const shots = g3.interceptors.slice(i0);
    expect(shots.length).toBeGreaterThan(0);
    expect(shots.every((s) => s.target === l3.id)).toBe(true);

    // Orbital Strike locks on the beacon, not the toughest threat.
    const g4 = quiet(4);
    load(g4, 'orbital');
    bait(g4, 800, 300);
    const l4 = lureAt(g4, 300, 250);
    run(g4, FOE.lure.rise + 0.05);
    g4.orbital = null;
    run(g4, AB.orbital.gap[0] + 0.2, () => !!g4.orbital);
    expect((g4.orbital as { id: number } | null)?.id).toBe(l4.id);

    // The Bomber Wing spends its pass on it.
    const g5 = quiet(5);
    load(g5, 'bomberWing');
    const l5 = lureAt(g5, 700, 250);
    run(g5, AB.bomberWing.first + 0.2, () => g5.sorties.length > 0);
    expect(g5.sorties[0]?.kind).toBe('lure');
    expect(g5.sorties[0]?.ref).toBe(l5.id);
  });

  it('a Repair Ship sails in from off the screen over open water to a station clear of the other boats', () => {
    for (const map of ['strait', 'island', 'archipelago', 'harbor'] as const) {
      const g = createGame(map, 3);
      g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
      g.raiderQueue = [];
      run(g, 20);
      g.threats = [];
      // A lure on one water spot already: the tender picks another.
      launchFoe(g, { at: 0, kind: 'lure', base: -1 });
      const lure = live(g, 'lure')[0];
      launchFoe(g, { at: 0, kind: 'tender', base: -1 });
      const t = live(g, 'tender')[0];
      expect(t.x < 0 || t.x > VIEW.width, `${map}: starts off screen (${t.x})`).toBe(true);
      const station = { x: t.foe!.px, y: t.foe!.py };
      expect(Math.hypot(station.x - lure.x, station.y - lure.y), map).toBeGreaterThan(FOE.tender.clear - 1);
      let closest = Infinity;
      for (let i = 0; i < 60 * 40 && t.foe!.n === 0 && !t.dead; i++) {
        step(g, DT);
        if (t.x > 0 && t.x < VIEW.width) expect(onLand(g, t.x, t.y), `${map}: on land at ${t.x},${t.y}`).toBe(false);
        for (const o of [...g.ships, lure]) closest = Math.min(closest, Math.hypot(o.x - t.x, o.y - t.y));
      }
      expect(t.foe!.n, `${map}: on station`).toBe(1);
      expect(Math.hypot(t.x - station.x, t.y - station.y)).toBeLessThan(40);
      expect(closest, `${map}: kept clear`).toBeGreaterThan(50);
    }
  });

  it('a Scavenger with nothing to grab circles over the water off the convoy, not parked on the shore', () => {
    const g = quiet();
    g.pickups = [];
    launchFoe(g, { at: 0, kind: 'scavenger', base: -1 });
    const sc = live(g, 'scavenger')[0];
    run(g, 5);
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 60 * 6; i++) {
      g.pickups = [];
      step(g, DT);
      if (i % 10 === 0) pts.push({ x: sc.x, y: sc.y });
    }
    expect(sc.dead).toBe(false);
    for (const p of pts) expect(onLand(g, p.x, p.y)).toBe(false);
    // It keeps moving, round a circle.
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(FOE.scavenger.orbit);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(FOE.scavenger.orbit);
    // A pickup turns up: it goes for it.
    g.pickups.push({ id: 4242, kind: 'repair', x: sc.x + 200, y: sc.y + 100, age: 0 });
    run(g, 0.2);
    expect(sc.foe!.link).toBe(4242);
  });
});

describe('Test Lab round 4 notes (2026-11-09): the Dive Bomber, the Incendiary Missile, the Repair Ship', () => {
  it('the Dive Bomber is a hair slower: a 2.0 s dive, flown at 210 px/s at most (10% under round 3\'s 233)', () => {
    const D = FOE.diveBomber;
    const before = 420 / 1.8;
    expect(D.window).toBeCloseTo(2.0, 6);
    expect(D.cruise).toBeLessThanOrEqual(before * 0.9 + 0.5);
    expect(D.cruise).toBeGreaterThanOrEqual(before * 0.85);
    // A full dive is flown at its cruise: no speed-up into it.
    expect(D.run / D.window).toBeCloseTo(D.cruise, 6);
  });

  it('a Dive Bomber never pops in: on every map it sets off out of sight, and its bomb lands on its circle when the flight in says', () => {
    const D = FOE.diveBomber;
    for (const map of ['strait', 'delta', 'kesh', 'island', 'gauntlet'] as const) {
      for (const seed of [1, 2, 3]) {
        const g = createGame(map, seed);
        g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
        g.raiderQueue = [];
        g.threats = [];
        run(g, 20);
        g.threats = [];
        launchFoe(g, { at: 0, kind: 'diveBomber', base: -1 });
        const m = g.foe.marks.find((o) => o.kind === 'dive')!;
        const t0 = g.t;
        run(g, D.mark + 0.02, () => live(g, 'diveBomber').length > 0);
        const p = live(g, 'diveBomber')[0];
        const tag = `${map} seed ${seed}: (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`;
        expect(p.y < -100 || p.x < -100 || p.x > VIEW.width + 100, tag).toBe(true);
        const app = p.foe!.dive!.app;
        run(g, 12, () => g.foe.shots.some((s) => s.kind === 'bomb'));
        const bomb = g.foe.shots.find((s) => s.kind === 'bomb')!;
        expect([bomb.tx, bomb.ty], tag).toEqual([m.x, m.y]);
        // Released `mark` + its flight in after the circle, give or take a step.
        expect(g.t - t0, tag).toBeCloseTo(D.mark + app + D.window, 1);
        // The circle still shows a fair warning before the plane is in sight.
        expect(D.mark + app, tag).toBeGreaterThan(1.9);
      }
    }
  });

  it('an Incendiary Missile is a little quicker: 12.5% faster than round 3', () => {
    expect(THREATS.cloud.speed).toBeGreaterThanOrEqual(48 * 1.1);
    expect(THREATS.cloud.speed).toBeLessThanOrEqual(48 * 1.15);
  });

  it('an Incendiary Missile\'s burst does no harm: only its fire does', () => {
    for (const seed of [4, 5, 6]) {
      const g = quiet(seed);
      for (const s of g.ships) s.hp = 20;
      launchFoe(g, { at: 0, kind: 'cloud', base: 1 }, base(g));
      const c = live(g, 'cloud')[0];
      const ship = g.ships.find((s) => s.id === c.target)!;
      let before = ship.hp;
      run(g, 60, () => {
        if (!c.dead) before = ship.hp;
        return c.dead;
      });
      expect(c.dead, `seed ${seed}`).toBe(true);
      // It reached its ship (not shot down): it burst on it, and the ship
      // took nothing from the hit.
      expect(Math.hypot(c.x - ship.x, c.y - ship.y), `seed ${seed}`).toBeLessThan(SHIP.hitRadius + 8);
      expect(ship.hp, `seed ${seed}`).toBe(before);
      expect(g.foe.marks.some((m) => m.kind === 'fire')).toBe(true);
      // Its fire does the harm: a hit `first` s in, while the ship is in it.
      run(g, FOE.cloud.first + 0.1);
      expect(ship.hp, `seed ${seed}`).toBe(before - THREATS.cloud.damage);
    }
  });

  it('an Incendiary Missile at the carrier only bursts there too', () => {
    const g = quiet();
    const c = spawnThreat(g, 'cloud', g.map.carrier.x, g.map.carrier.y, 'base');
    c.foe = { state: 0, t: 0, n: 0, px: 0, py: 0, link: 0 };
    c.target = CARRIER_TARGET;
    const hp = g.carrierHp;
    step(g, DT);
    expect(c.dead).toBe(true);
    expect(g.carrierHp).toBe(hp);
    expect(g.foe.marks.some((m) => m.kind === 'fire')).toBe(true);
  });

  it('the Repair Tender is now called the Repair Ship wherever the player sees it (its id stays)', () => {
    expect(FOES.tender.name).toBe('Repair Ship');
    expect(THREATS.tender.label).toBe('Repair ship');
  });
});
