// The Map & Convoy Lab's telemetry (docs/design/v3-map-convoy-lab-plan.md,
// slice 1; docs/design/v3-map-lab-slice0-1.md). The gate: a game plays the
// same with telemetry on and off; what it attributes adds up to the hulls,
// the sinkings and the pickups; and the sidecar a live run makes is the one
// its log replays to.

import { describe, expect, it } from 'vitest';
import { HEAVY, PICKUPS, VIEW } from '../../src/v3/data/config';
import { FORMATIONS } from '../../src/v3/data/formations';
import { EVENT_ORDER } from '../../src/v3/data/events';
import { LAB_CARDS, LAB_START_WAVE, labCard } from '../../src/v3/data/lab';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { ABILITY_ORDER, type AbilityId } from '../../src/v3/data/abilities';
import { Bot, SKILLS } from '../../src/v3/sim/bot';
import { addPickup, applyFreePlay, applyLab, checkImpact, createGame, damageCarrier, damageShip, setFlow, setFormation, spawnThreat, step, tap, throwSwitch, type Game, type Ship } from '../../src/v3/sim/game';
import { lockstep, lockstepLive, stateHash } from '../../src/v3/sim/mapLab';
import { BotRun, PERSONAS, playMimic } from '../../src/v3/sim/mimic';
import { LOG_VERSION, logTelemetry, replay } from '../../src/v3/sim/playlog';
import { TEL_SAMPLING, TEL_SCHEMA, contentHash, pickupsOpen, reconcile, sidecarDigest, type TelEvent, type TelemetrySidecar } from '../../src/v3/sim/telemetry';

const DT = 1 / 60;
const DEVICE = { w: 0, h: 0, dpr: 1, touch: true, ua: 'test' };

/** A game with telemetry on, sailed until `ships` hulls are well out, with
 *  the wave's own launches held back (the test brings its own). */
function quiet(map: Parameters<typeof createGame>[0] = 'strait', ships = 4, seed = 3): Game {
  const g = createGame(map, seed, 1);
  logTelemetry(g, { id: 'test', build: 'test', v: LOG_VERSION, firstWave: 1, device: DEVICE }, 'sim', 'test');
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  for (let i = 0; i < 60 * 60 && g.ships.filter((s) => s.x > 300).length < ships; i++) step(g, DT);
  return g;
}

const events = (g: Game) => g.tel!.sidecar(g).events;
const of = <K extends TelEvent['k']>(g: Game, k: K) => events(g).filter((e): e is Extract<TelEvent, { k: K }> => e.k === k);

describe('telemetry is off unless a run asks for it', () => {
  it('a new game and a replayed log carry none', () => {
    expect(createGame('strait', 1).tel).toBeNull();
    const { log } = playMimic('strait', 5, { firstWave: 11 });
    expect(replay(log).tel).toBeNull();
    expect(replay(log, { telemetry: true }).tel).not.toBeNull();
  });

  it('the header says what it is and what it was played on', () => {
    const g = quiet('harbor');
    const h = g.tel!.sidecar(g).header;
    expect(h).toMatchObject({ schema: TEL_SCHEMA, game: 'v3', logVersion: LOG_VERSION, map: 'harbor', frame: { w: VIEW.width, h: VIEW.height }, seed: 3, mode: 'sim' });
    expect(h.mapHash).toMatch(/^[0-9a-f]{8}$/);
    expect(h.contentHash).toBe(contentHash());
    expect(h.rules).toMatchObject({ shipHp: g.stats.shipHp, carrierHp: g.stats.carrierHp, lossLimit: 6, lastWave: 13, eventWave: 11 });
    expect(h.convoy).toMatchObject({ policy: 'current', flow: 1, formation: 'pairs', flowSteps: 5 });
    // Another map is other water: a different hash.
    const other = quiet('strait');
    expect(other.tel!.sidecar(other).header.mapHash).not.toBe(h.mapHash);
  });
});

describe('a hit on a hull: who, where, how much really came off', () => {
  it('a heavy: one impact, the ship it lands on sunk, its neighbours splashed, each with the attacker named', () => {
    const g = quiet('strait', 4);
    setFormation(g, 'box');
    for (let i = 0; i < 60 * 8; i++) step(g, DT);
    const [s, a, b] = g.ships.filter((o) => o.x > 300 && o.x < 1300).sort((p, q) => p.x - q.x);
    // Two hulls close alongside (as a tight Box sails): inside the blast.
    [a.x, a.y, b.x, b.y] = [s.x + 40, s.y, s.x, s.y + 45];
    const near = g.ships.filter((o) => o !== s && Math.hypot(o.x - s.x, o.y - s.y) <= HEAVY.splash * FORMATIONS.box.splash);
    expect(near.map((o) => o.id).sort()).toEqual([a.id, b.id].sort());
    const before = new Map(g.ships.map((o) => [o.id, o.hp]));
    const th = spawnThreat(g, 'heavy', s.x, s.y, 'base');
    th.target = s.id;
    const lost = g.lost;
    checkImpact(g, th);
    const hits = of(g, 'hit');
    expect(hits.length).toBe(near.length + 1);
    // One blow: one impact id, the heavy's own id on every hull it reached.
    expect(new Set(hits.map((h) => h.imp)).size).toBe(1);
    for (const h of hits) expect(h).toMatchObject({ vt: 's', src: th.id, by: 'heavy', x: Math.round(th.x * 10) / 10, form: 'box' });
    const direct = hits.find((h) => h.vid === s.id)!;
    // A heavy sinks whatever it lands on: 99 (less the Box's armour) dealt,
    // the ship's 3 hull points removed.
    expect(direct).toMatchObject({ dir: 1, sunk: 1, amt: 99, dealt: 99 - FORMATIONS.box.armor, hp: before.get(s.id), left: 0 });
    for (const h of hits.filter((o) => o.vid !== s.id)) expect(h).toMatchObject({ dir: 0, dealt: 1, hp: 1, left: before.get(h.vid)! - 1 });
    expect(of(g, 'ship-').filter((e) => e.why === 'sunk')).toEqual([expect.objectContaining({ id: s.id, by: 'heavy', lane: s.channel })]);
    expect(g.lost).toBe(lost + 1);
    expect(reconcile(g.tel!.sidecar(g), g)).toEqual([]);
  });

  it('a blow the Shield stops, or one that glances off, is counted and takes nothing', () => {
    const g = quiet();
    const s = g.ships[0];
    g.shieldT = 5;
    damageShip(g, s, 2, 'guided');
    damageCarrier(g, 1, 'drone');
    g.shieldT = 0;
    const hits = of(g, 'hit');
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ vt: 's', vid: s.id, blk: 'shield', hp: 0, dealt: 0, amt: 2 });
    expect(hits[1]).toMatchObject({ vt: 'c', blk: 'shield', hp: 0 });
    expect(g.tel!.totals).toMatchObject({ blocked: 2, hits: 0, hpShip: 0, hpCarrier: 0 });
    expect(reconcile(g.tel!.sidecar(g), g)).toEqual([]);
  });

  it('formation armour: the warhead, what was dealt and what came off are three numbers', () => {
    const g = quiet();
    setFormation(g, 'box');
    const s = g.ships[0];
    damageShip(g, s, 2, 'guided');
    expect(of(g, 'hit')[0]).toMatchObject({ amt: 2, dealt: 1, hp: 1, left: g.stats.shipHp - 1, form: 'box' });
  });

  it('the carrier: the hull removed stops at zero though the warhead was bigger', () => {
    const g = quiet();
    g.tel!.before(g);
    const hp = g.carrierHp;
    damageCarrier(g, hp - 1, 'guided');
    damageCarrier(g, 5, 'heavy');
    const hits = of(g, 'hit');
    expect(hits[1]).toMatchObject({ vt: 'c', amt: 5, hp: 1, left: 0 });
    expect(g.tel!.totals.hpCarrier).toBe(hp);
    // The game's own tally counts the warhead (hp - 1 + 5): the events carry both.
    expect(Object.values(g.carrierDamageBy).reduce((a, b) => a + b, 0)).toBe(hp + 4);
    expect(reconcile(g.tel!.sidecar(g), g)).toEqual([]);
  });

  it('a hull changed with no event shows as an audit (the telemetry checks itself)', () => {
    const g = quiet();
    g.ships[0].hp -= 1;
    step(g, DT);
    expect(of(g, 'audit')).toEqual([expect.objectContaining({ what: 'hp', id: g.ships[0].id, want: g.stats.shipHp, got: g.stats.shipHp - 1 })]);
    expect(reconcile(g.tel!.sidecar(g), g)).toContain('audits: telemetry 1, game 0');
  });
});

describe('a pickup, from drop to end', () => {
  it('dropped, then taken by a tap; dropped, then expired; dropped, then cleared with the wave', () => {
    const g = quiet();
    addPickup(g, 'ammo', 600, 400);
    const taken = g.pickups[0].id;
    expect(tap(g, 600, 400, 20)).toBe('pickup');
    addPickup(g, 'shield', 700, 300);
    const expired = g.pickups[0].id;
    for (let i = 0; i < (PICKUPS.life + 0.5) / DT; i++) step(g, DT);
    addPickup(g, 'repair', 800, 500);
    const cleared = g.pickups[0].id;
    // The wave ends: what is left on the water goes with it.
    g.queue = [];
    step(g, DT);
    expect(g.phase).toBe('draft');
    const ends = of(g, 'pk-');
    expect(ends.map((e) => [e.id, e.why])).toEqual([[taken, 'collected'], [expired, 'expired'], [cleared, 'cleared']]);
    expect(of(g, 'pk+').map((e) => e.why)).toEqual(['drop', 'drop', 'drop']);
    expect(ends[1].age).toBeGreaterThanOrEqual(PICKUPS.life);
    // The tap that took it names it, and shot nothing.
    expect(of(g, 'tap')[0]).toMatchObject({ res: 'pickup', pk: taken, x: 600, y: 400 });
    const sc = g.tel!.sidecar(g);
    expect(sc.totals.pickups).toEqual({ spawned: 3, collected: 1, expired: 1, cleared: 1, gone: 0 });
    expect(pickupsOpen(sc)).toBe(0);
    expect(reconcile(sc, g)).toEqual([]);
  });

  it('a pickup that appears or goes with no event is counted as a gap', () => {
    const g = quiet();
    g.pickups.push({ id: 90001, kind: 'steam', x: 500, y: 500, age: 0 });
    step(g, DT);
    g.pickups = [];
    step(g, DT);
    expect(of(g, 'pk+')[0]).toMatchObject({ id: 90001, why: 'seen' });
    expect(of(g, 'pk-')[0]).toMatchObject({ id: 90001, why: 'gone' });
    expect(g.tel!.totals.audits).toBe(2);
  });
});

describe('the player\'s hand and the convoy commands', () => {
  it('a tap: where, what it went for, what was loaded, the rack before and after', () => {
    const g = quiet();
    const th = spawnThreat(g, 'drone', 800, 200, 'base');
    const rack = g.ammo;
    expect(tap(g, 800, 200, 30)).toBe('fire');
    expect(tap(g, 100, 850, 10)).toBe('empty');
    g.ammo = 0;
    expect(tap(g, 800, 200, 30)).toBe('dry');
    const taps = of(g, 'tap');
    expect(taps[0]).toMatchObject({ x: 800, y: 200, r: 30, res: 'fire', thr: th.id, a0: rack, a1: rack - 1 });
    expect(taps[1]).toMatchObject({ res: 'empty', a0: rack - 1, a1: rack - 1 });
    expect(taps[1].thr).toBeUndefined();
    expect(taps[2]).toMatchObject({ res: 'dry', thr: th.id, a1: 0 });
    expect(g.tel!.totals.taps).toEqual(g.taps);
  });

  it('flow and formation: what was asked, what stood, whether it took, how many ships it reaches', () => {
    const g = quiet();
    setFlow(g, 1);
    setFlow(g, 4);
    setFormation(g, 'spread');
    setFormation(g, 'spread');
    const cmds = of(g, 'cmd');
    expect(cmds.map((c) => [c.what, c.req, c.was, c.ok, c.why])).toEqual([
      ['flow', 1, 1, 0, 'same'],
      ['flow', 4, 1, 1, undefined],
      ['formation', 'spread', 'pairs', 1, undefined],
      ['formation', 'spread', 'spread', 0, 'same'],
    ]);
    expect(cmds[1].ships).toBe(g.ships.length);
    // A ship that sails after says which flow and formation it sailed under.
    for (let i = 0; i < 60 * 6; i++) step(g, DT);
    expect(of(g, 'ship+').at(-1)).toMatchObject({ flow: 4, form: 'spread' });
  });

  it('the Delta\'s switch is a command', () => {
    const g = quiet('delta', 1);
    const was = g.forkLane;
    throwSwitch(g);
    expect(of(g, 'cmd').at(-1)).toMatchObject({ what: 'fork', was, req: g.forkLane, ok: 1 });
  });
});

describe('launches: where each came from', () => {
  const run = () => {
    const { log } = playMimic('gauntlet', 103, { persona: PERSONAS.tryhard, armory: { warhead: 3 } });
    const g = replay(log, { telemetry: true });
    return { g, sc: g.tel!.sidecar(g) };
  };
  const { g, sc } = run();
  const spawns = sc.events.filter((e): e is Extract<TelEvent, { k: 'thr+' }> => e.k === 'thr+');

  it('every threat has one id from launch to end, and every end has a launch', () => {
    const ids = spawns.filter((e) => !e.back).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of sc.events) if (e.k === 'thr-' || e.k === 'hurt') expect(ids, `${e.k} ${e.id}`).toContain(e.id);
    expect(spawns.some((e) => e.o === 'seen')).toBe(false);
  });

  it('a launch from a base names the base; from a sub or a truck, the launcher (and the launcher\'s own stops are there)', () => {
    const raiders = new Set(sc.events.filter((e) => e.k === 'rdr').map((e) => (e as Extract<TelEvent, { k: 'rdr' }>).id));
    let fromBase = 0;
    let fromRaider = 0;
    for (const e of spawns) {
      if (e.o === 'base' && e.base !== undefined) {
        fromBase++;
        expect(g.map.bases[e.base]).toMatchObject({ x: e.x, y: e.y });
      }
      if ((e.o === 'sub' || e.o === 'truck') && e.from !== undefined && raiders.has(e.from)) fromRaider++;
    }
    expect(fromBase).toBeGreaterThan(50);
    expect(fromRaider).toBeGreaterThan(10);
    // Where the platform surfaced or stopped, apart from where each round left it.
    const fire = sc.events.filter((e) => e.k === 'rdr' && e.st === 'fire');
    expect(fire.length).toBeGreaterThan(3);
  });

  it('a split or a dropped missile names what it came off', () => {
    const born = new Set(spawns.map((e) => e.id));
    const kids = spawns.filter((e) => e.o === 'child');
    expect(kids.length).toBeGreaterThan(0);
    for (const e of kids) expect(born.has(e.pid!), `${e.kind} ${e.id}`).toBe(true);
    // A bomber's guided missile: launched from the air, off its bomber.
    for (const e of spawns.filter((o) => o.kind === 'guided' && o.o === 'air')) expect(born.has(e.from!)).toBe(true);
  });

  it('every hit names an attacker that was launched, and where it was launched from can be traced', () => {
    const born = new Map(spawns.map((e) => [e.id, e]));
    const marks = new Set(sc.events.filter((e) => e.k === 'mark+').map((e) => (e as Extract<TelEvent, { k: 'mark+' }>).id));
    const hits = sc.events.filter((e): e is Extract<TelEvent, { k: 'hit' }> => e.k === 'hit');
    expect(hits.length).toBeGreaterThan(30);
    for (const h of hits) {
      expect(h.src, `hit ${h.imp} by ${h.by}`).toBeDefined();
      expect(born.has(h.src!) || marks.has(h.src!), `hit ${h.imp} by ${h.by} from ${h.src}`).toBe(true);
    }
  });

  it('a raid\'s warning and an aircraft\'s arrow are in the stream before what they warn of', () => {
    const warns = sc.events.filter((e): e is Extract<TelEvent, { k: 'warn' }> => e.k === 'warn');
    expect(warns.filter((w) => w.what === 'raid').length).toBeGreaterThan(20);
    expect(warns.filter((w) => w.what === 'aircraft').length).toBeGreaterThan(0);
    for (const w of warns) expect(w.lead).toBeGreaterThanOrEqual(0);
  });

  it('every coordinate is in world units, on or just off the 1600 x 900 board', () => {
    const on = (x: number, y: number, m: number) => x >= -m && x <= VIEW.width + m && y >= -m && y <= VIEW.height + m;
    for (const e of sc.events) {
      if (e.k === 'hit') expect(on(e.vx, e.vy, 60) && on(e.x, e.y, 60), `hit ${e.imp}`).toBe(true);
      if (e.k === 'ship+' || e.k === 'ship-') expect(on(e.x, e.y, 80), `${e.k} ${e.id}`).toBe(true);
      if (e.k === 'pk+' || e.k === 'pk-') expect(on(e.x, e.y, 0), `${e.k} ${e.id}`).toBe(true);
      if (e.k === 'tap') expect(on(e.x, e.y, 0)).toBe(true);
      if (e.k === 'thr+') expect(on(e.x, e.y, 320), `thr+ ${e.kind} ${e.x},${e.y}`).toBe(true);
    }
  });

  it('ship positions are sampled 4 times a second, only for ships afloat', () => {
    const afloat = new Set<number>();
    const merged = [...sc.events.filter((e) => e.k === 'ship+' || e.k === 'ship-'), ...sc.samples.filter((s) => s.k === 'ship@')].sort((a, b) => a.s - b.s || (a.k === 'ship@' ? 1 : -1));
    let samples = 0;
    for (const e of merged) {
      if (e.k === 'ship+') afloat.add(e.id);
      else if (e.k === 'ship-') afloat.delete(e.id);
      else if (e.k === 'ship@') {
        samples++;
        expect(e.s % TEL_SAMPLING.ship).toBe(0);
        expect(e.v.length % 3).toBe(0);
        for (let i = 0; i < e.v.length; i += 3) expect(afloat.has(e.v[i]), `ship ${e.v[i]} at step ${e.s}`).toBe(true);
      }
    }
    expect(samples).toBeGreaterThan(sc.steps / TEL_SAMPLING.ship / 2);
  });

  it('the run adds up', () => {
    expect(reconcile(sc, g)).toEqual([]);
    expect(sc.totals.audits).toBe(0);
    expect(sc.truncated).toBe(false);
  });
});

describe('normal waves, the bonus wave and the map\'s event are told apart', () => {
  it('Siren Field after wave 6 is a bonus stretch; the ending is three stretches, runs 1 to 3', () => {
    const { log } = playMimic('strait', 8, { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 6 });
    const g = replay(log, { telemetry: true });
    const sc = g.tel!.sidecar(g);
    expect(sc.phases.map((p) => [p.wave, p.kind, p.event ?? '', p.run ?? 0])).toEqual([
      [6, 'wave', '', 0], [6, 'bonusEvent', 'siren-field', 1],
      [7, 'wave', '', 0], [8, 'wave', '', 0], [9, 'wave', '', 0], [10, 'wave', '', 0],
      [11, 'mapEvent', 'rush', 1], [12, 'mapEvent', 'rush', 2], [13, 'mapEvent', 'rush', 3],
    ]);
    // Each event stretch carries the grade the game gave it.
    const graded = g.eventLog.map((e) => e.outcome);
    expect(sc.phases.filter((p) => p.event).map((p) => p.grade)).toEqual(graded);
    // Every event sits in its own stretch's steps.
    for (const e of sc.events) {
      const ph = sc.phases[e.p];
      expect(e.s >= ph.s0 && e.s <= (ph.s1 ?? Infinity), `${e.k} at step ${e.s} in stretch ${e.p}`).toBe(true);
    }
    // The restore before the ending is in the stream, as heals (when a hull
    // or the carrier was short of full then; it always resets the losses).
    const ending = sc.phases.find((p) => p.kind === 'mapEvent')!;
    expect(g.lossBase).toBe(ending.lost0);
    expect(sc.events.some((e) => e.k === 'heal' && e.why === 'restore') || g.lost === 0 || g.lossBase > 0).toBe(true);
    expect(reconcile(sc, g)).toEqual([]);
  });
});

describe('the gate: the same game with telemetry on and off', () => {
  it('a recorded run: every step equal, the same RNG draws, and the live sidecar is the replay\'s', () => {
    const run = new BotRun('harbor', 103, { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 5 });
    run.rec.telemetry('watch', 'tryhard');
    run.advance(Infinity);
    const live = run.game.tel!.sidecar(run.game);
    const log = run.finish();
    // The log itself has no telemetry in it: a sidecar, not a new log format.
    expect(JSON.stringify(log)).not.toContain('"tel"');
    const again = replay(log, { telemetry: true });
    expect(sidecarDigest(again.tel!.sidecar(again))).toBe(sidecarDigest(live));
    expect(stateHash(again)).toBe(stateHash(run.game));
    const ls = lockstep(log, 120);
    expect(ls.divergedAt).toBe(-1);
    expect(ls.rngSame).toBe(true);
    expect(ls.fullChecks).toBeGreaterThan(50);
    expect(sidecarDigest(ls.sidecar)).toBe(sidecarDigest(live));
    expect(reconcile(ls.sidecar, ls.game)).toEqual([]);
  });

  const bot = (seed: number) => () => {
    const b = new Bot(SKILLS.sharp, seed);
    return (g: Game) => b.act(g);
  };
  const check = (name: string, ls: ReturnType<typeof lockstepLive>, sc: TelemetrySidecar = ls.sidecar) => {
    expect(ls.divergedAt, `${name}: diverged`).toBe(-1);
    expect(ls.rngSame, `${name}: RNG`).toBe(true);
    expect(reconcile(sc, ls.game), name).toEqual([]);
  };

  it('every weapon in hand (the gesture weapons held, swiped and flung by the bot), drops frequent', () => {
    const kits: AbilityId[][] = [];
    for (let i = 0; i < ABILITY_ORDER.length; i += 3) kits.push(ABILITY_ORDER.slice(i, i + 3));
    const by = new Set<string>();
    kits.forEach((kit, k) => {
      const make = () => {
        const g = createGame(MAP_ORDER[k % 5], 40 + k, 6);
        applyFreePlay(g, { weapons: kit.map((id) => ({ id, level: 3 })), frequentDrops: true });
        return g;
      };
      const ls = lockstepLive(make, bot(k), { steps: 60 * 45 });
      check(kit.join('+'), ls);
      for (const e of ls.sidecar.events) if (e.k === 'hurt') by.add(e.by);
    });
    // The weapons' own work is told apart from the plain gun's.
    for (const src of ['gun', 'blast', 'thermo', 'flak', 'railgun', 'frigate', 'lance', 'cutter', 'grapnel', 'droneScreen', 'gunship', 'orbital', 'cadence']) expect([...by].sort(), src).toContain(src);
  }, 60_000);

  it('every special event card in the Test Lab, with a rerun ("Bring one") on the way', () => {
    for (const id of EVENT_ORDER) {
      const card = labCard(`ev-${id}`)!;
      const make = () => {
        const g = createGame(card.map, 7, card.wave ?? LAB_START_WAVE);
        applyFreePlay(g, { weapons: card.kit.map((w) => ({ id: w, level: 2 })), frequentDrops: true });
        applyLab(g, { card: card.id, length: 'quick', mix: 'normal' });
        return g;
      };
      const ls = lockstepLive(make, bot(3), { steps: 60 * 50 });
      check(card.id, ls);
      expect(ls.sidecar.phases[0], card.id).toMatchObject({ kind: 'labEvent', event: id });
      expect(ls.sidecar.header.lab, card.id).toMatchObject({ card: card.id });
    }
  }, 60_000);

  it('every enemy and enemy-pair card, and a map card on each kind of water (locks, a fork, a tide, posts, the boss, the supertanker, night)', () => {
    const cards = [
      ...LAB_CARDS.filter((c) => c.kind === 'enemy' || c.kind === 'combo'),
      ...['saltgate', 'delta', 'tide', 'marrow', 'dreadnought', 'behemoth', 'battery', 'citadel', 'crossing', 'kesh'].map((m) => LAB_CARDS.find((c) => c.kind === 'map' && c.map === m)!),
    ];
    expect(cards.length).toBeGreaterThan(35);
    const env = new Set<string>();
    for (const card of cards) {
      const make = () => {
        const g = createGame(card.map, 11, card.wave ?? LAB_START_WAVE);
        applyFreePlay(g, { weapons: card.kit.map((w) => ({ id: w, level: 1 })), frequentDrops: true });
        applyLab(g, { card: card.id, length: 'quick', mix: 'normal' });
        return g;
      };
      const ls = lockstepLive(make, bot(5), { steps: 60 * 40 });
      check(card.id, ls);
      for (const e of ls.sidecar.events) if (e.k === 'env') env.add(e.what);
    }
    // The maps' own mechanics show in the stream.
    expect([...env]).toEqual(expect.arrayContaining(['lock', 'tide']));
  }, 120_000);
});

describe('what a ship lived through can be read back', () => {
  it('a ship\'s hull at any moment is its sailing hull less its hits plus its heals', () => {
    const { log } = playMimic('harbor', 20, { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 6 });
    const g = replay(log, { telemetry: true });
    const sc = g.tel!.sidecar(g);
    const hull = new Map<number, number>();
    for (const e of sc.events) {
      if (e.k === 'ship+') hull.set(e.id, e.hp);
      else if (e.k === 'hit' && e.vt === 's' && !e.blk) {
        expect(hull.get(e.vid)! - e.hp, `ship ${e.vid} at step ${e.s}`).toBeCloseTo(e.left, 6);
        hull.set(e.vid, e.left);
      } else if (e.k === 'heal' && e.vt === 's') {
        expect(hull.get(e.vid)! + e.hp).toBeCloseTo(e.left, 6);
        hull.set(e.vid, e.left);
      } else if (e.k === 'ship-') {
        if (e.why === 'sunk') expect(hull.get(e.id)).toBe(0);
        hull.delete(e.id);
      }
    }
    // What is still afloat is what the game has afloat, hull for hull.
    expect([...hull.entries()].sort()).toEqual(g.ships.map((s: Ship) => [s.id, s.hp]).sort());
  });
});
