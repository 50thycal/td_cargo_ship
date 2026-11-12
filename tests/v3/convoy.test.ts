// The Map & Convoy Lab's convoy policies and tactical commands
// (docs/design/v3-map-convoy-lab-plan.md, §6, slices 3 and 4). Lab only: a
// game with no convoy setup plays as it always has.
//
// The gates: the same seed plays the same game every time; no command
// breaks the lane, the queue or the wave; every comparison carries its
// denominators; and no command is a way to wait a fight out, to be
// invulnerable, or to farm score.

import { describe, expect, it } from 'vitest';
import { FLOW_STEPS, SHIP, VIEW } from '../../src/v3/data/config';
import { CONVOY, CONVOY_REV, MAP_CONVOY, mapConvoy, type CommandId, type ConvoyPolicy, type ConvoySetup } from '../../src/v3/data/convoy';
import { FORMATIONS } from '../../src/v3/data/formations';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { applyConvoy, commandState, convoyCommand, convoyCommands, formationNow } from '../../src/v3/sim/convoy';
import { cohort, paired, runTrial, type TrialSpec } from '../../src/v3/sim/convoyLab';
import { createGame, damageShip, setFlow, setFormation, shipSpeed, step, type Game } from '../../src/v3/sim/game';
import { onLand } from '../../src/v3/sim/foes';
import { lockstep, logHash, stateHash } from '../../src/v3/sim/mapLab';
import { PERSONAS, playMimic } from '../../src/v3/sim/mimic';
import { LOG_VERSION, logTelemetry, replay } from '../../src/v3/sim/playlog';
import { reconcile, type TelEvent } from '../../src/v3/sim/telemetry';

const DT = 1 / 60;
const setup = (policy: ConvoyPolicy, obligation: ConvoySetup['obligation'] = 'fixed'): ConvoySetup => ({ policy, obligation, rev: CONVOY_REV });

/** A game under a policy with telemetry on, the wave's own launches held
 *  back, sailed for `seconds`. */
function lab(map: Parameters<typeof createGame>[0], policy: ConvoyPolicy, seconds = 20, obligation: ConvoySetup['obligation'] = 'fixed'): Game {
  const g = createGame(map, 4, 1);
  applyConvoy(g, setup(policy, obligation));
  logTelemetry(g, { id: 'convoy-test', build: 'test', v: LOG_VERSION, firstWave: 1, device: { w: 0, h: 0, dpr: 1, touch: false, ua: 'test' } }, 'sim', 'test');
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raids = [];
  g.raiderQueue = [];
  run(g, seconds);
  return g;
}
const run = (g: Game, seconds: number) => {
  for (let i = 0; i < seconds / DT && g.phase === 'wave'; i++) step(g, DT);
};
const cmds = (g: Game) => g.tel!.sidecar(g).events.filter((e): e is Extract<TelEvent, { k: 'cmd' }> => e.k === 'cmd');

describe('a campaign run has no convoy layer', () => {
  it('a new game carries none, and the tactical commands do nothing in it', () => {
    const g = createGame('strait', 1);
    expect(g.convoy).toBeNull();
    run(g, 5);
    const before = stateHash(g);
    expect(convoyCommand(g, 'rush')).toEqual({ ok: false, why: 'policy' });
    expect(stateHash(g)).toBe(before);
    expect(shipSpeed(g)).toBe(SHIP.speed);
    expect(formationNow(g)).toBe(FORMATIONS.pairs);
  });

  it('the three reference maps have their commands; every other map has none yet', () => {
    expect(Object.keys(MAP_CONVOY).sort()).toEqual(['gauntlet', 'harbor', 'strait']);
    expect(mapConvoy('strait').commands).toEqual(['rush', 'disperse']);
    expect(mapConvoy('gauntlet').commands).toEqual(['rush', 'disperse']);
    expect(mapConvoy('harbor').commands).toEqual(['hold']);
    for (const id of MAP_ORDER) {
      const c = mapConvoy(id);
      expect(c.commands.length, id).toBeLessThanOrEqual(2);
      expect(FLOW_STEPS[c.flow], id).toBeDefined();
    }
    expect(mapConvoy('delta').commands).toEqual([]);
  });
});

describe('the four policies: who may change what', () => {
  it('A (automatic): the map\'s schedule and formation; flow and formation are refused, and say why', () => {
    const g = lab('strait', 'auto');
    expect([g.flow, g.formation]).toEqual([mapConvoy('strait').flow, 'pairs']);
    setFlow(g, 4);
    setFormation(g, 'box');
    expect([g.flow, g.formation]).toEqual([mapConvoy('strait').flow, 'pairs']);
    expect(cmds(g).map((c) => [c.what, c.ok, c.why])).toEqual([['flow', 0, 'policy'], ['formation', 0, 'policy']]);
    expect(convoyCommands(g)).toEqual([]);
    expect(convoyCommand(g, 'rush')).toEqual({ ok: false, why: 'policy' });
  });

  it('B (formations only): the four formations, on the map\'s schedule', () => {
    const g = lab('strait', 'formation');
    setFlow(g, 4);
    setFormation(g, 'box');
    expect([g.flow, g.formation]).toEqual([mapConvoy('strait').flow, 'box']);
    expect(convoyCommands(g)).toEqual([]);
  });

  it('C (current controls): flow and formation; the flow is the map\'s only when the schedule is fixed', () => {
    const natural = lab('strait', 'current', 5, 'natural');
    setFlow(natural, 4);
    setFormation(natural, 'column');
    expect([natural.flow, natural.formation]).toEqual([4, 'column']);
    const fixed = lab('strait', 'current', 5, 'fixed');
    setFlow(fixed, 4);
    expect(fixed.flow).toBe(mapConvoy('strait').flow);
    expect(cmds(fixed).at(-1)).toMatchObject({ what: 'flow', ok: 0, why: 'fixed' });
  });

  it('D (tactical): the map\'s formation and schedule, and the map\'s commands', () => {
    const g = lab('strait', 'tactical');
    setFormation(g, 'box');
    expect(g.formation).toBe('pairs');
    expect(convoyCommands(g)).toEqual(['rush', 'disperse']);
    expect(convoyCommands(lab('harbor', 'tactical', 1))).toEqual(['hold']);
    // A map with no command of its own sails by itself under D.
    expect(convoyCommands(lab('kesh', 'tactical', 1))).toEqual([]);
  });

  it('under a fixed schedule every policy is asked for the same ships at the same times', () => {
    const sailed = (['auto', 'formation', 'current', 'tactical'] as ConvoyPolicy[]).map((p) => {
      const g = lab('gauntlet', p, 60);
      return g.tel!.sidecar(g).events.filter((e) => e.k === 'ship+').map((e) => e.s);
    });
    for (const s of sailed) expect(s).toEqual(sailed[0]);
    expect(sailed[0].length).toBeGreaterThan(10);
  });
});

describe('Rush', () => {
  it('ships afloat sail faster, then slower: the same distance in the end, then a cooldown', () => {
    const a = lab('strait', 'tactical', 20);
    const b = lab('strait', 'tactical', 20);
    const lead = a.ships[0].id;
    expect(convoyCommand(a, 'rush')).toEqual({ ok: true });
    expect(shipSpeed(a)).toBeCloseTo(SHIP.speed * CONVOY.rush.speed, 6);
    run(a, CONVOY.rush.time + 0.05);
    run(b, CONVOY.rush.time + 0.05);
    const d = (g: Game) => g.ships.find((s) => s.id === lead)!.d;
    // Ahead by the rush's gain while it lasts...
    expect(d(a) - d(b)).toBeCloseTo(SHIP.speed * (CONVOY.rush.speed - 1) * CONVOY.rush.time, -1);
    expect(shipSpeed(a)).toBeCloseTo(SHIP.speed * CONVOY.rush.coastSpeed, 6);
    run(a, CONVOY.rush.coast + 0.1);
    run(b, CONVOY.rush.coast + 0.1);
    // ...and level again once it has coasted.
    expect(Math.abs(d(a) - d(b))).toBeLessThan(3);
    expect(shipSpeed(a)).toBe(SHIP.speed);
    expect(CONVOY.rush.coast).toBeCloseTo(((CONVOY.rush.speed - 1) * CONVOY.rush.time) / (1 - CONVOY.rush.coastSpeed), 6);
  });

  it('refused on cooldown, while dispersed, and with no ship afloat; each refusal is in the telemetry', () => {
    const g = lab('strait', 'tactical', 20);
    expect(convoyCommand(g, 'rush').ok).toBe(true);
    expect(convoyCommand(g, 'rush')).toEqual({ ok: false, why: 'cooldown' });
    expect(convoyCommand(g, 'disperse')).toEqual({ ok: false, why: 'busy' });
    run(g, CONVOY.rush.cooldown + 0.1);
    expect(commandState(g, 'rush')).toMatchObject({ ready: true, active: false, cool: 0 });
    expect(convoyCommand(g, 'rush').ok).toBe(true);
    const empty = lab('strait', 'tactical', 0);
    expect(convoyCommand(empty, 'rush')).toEqual({ ok: false, why: 'none' });
    const list = cmds(g).map((c) => [c.what, c.ok, c.why]);
    expect(list).toEqual([['rush', 1, undefined], ['rush', 0, 'cooldown'], ['disperse', 0, 'busy'], ['rush', 1, undefined]]);
    // An accepted Rush names the ships it took hold of.
    expect(cmds(g)[0].ids!.length).toBe(cmds(g)[0].ships);
    expect(g.convoy).toMatchObject({ used: { rush: 2, disperse: 0, hold: 0 }, refused: 2 });
  });

  it('a ballistic aimed before the Rush lands behind its ship', () => {
    // The same shell at the same ship, with and without a Rush given as it launches.
    const land = (rush: boolean) => {
      const g = lab('strait', 'tactical', 30);
      const s = g.ships.filter((o) => o.x > 500 && o.x < 900)[0];
      g.queue = [{ at: g.waveT + 0.01, kind: 'ballistic', base: 0, target: s.id }, { at: 1e9, kind: 'drone', base: 0 }];
      step(g, DT);
      step(g, DT);
      const th = g.threats.find((t) => t.kind === 'ballistic')!;
      expect(th.target).toBe(s.id);
      if (rush) convoyCommand(g, 'rush');
      const hp = s.hp;
      run(g, th.dur + 0.2);
      return { hit: s.hp < hp, behind: s.x - th.ix, flight: th.dur };
    };
    const plain = land(false);
    const rushed = land(true);
    expect(plain.flight).toBeGreaterThanOrEqual(2.6);
    expect(plain.hit).toBe(true);
    expect(rushed.hit).toBe(false);
    expect(rushed.behind).toBeGreaterThan(50);
  });
});

describe('Disperse', () => {
  it('for its seconds the hulls open out, a blast reaches one hull only, and the convoy slows', () => {
    const g = lab('strait', 'tactical', 20);
    const wide = (h: Game) => Math.max(...h.ships.map((s) => Math.abs(s.lat)));
    const before = wide(g);
    expect(convoyCommand(g, 'disperse')).toEqual({ ok: true });
    const f = formationNow(g);
    expect(f).toMatchObject({ splash: 0, blastCut: 0.5, armor: 0 });
    expect(Math.max(...f.offsets.map(Math.abs))).toBeLessThanOrEqual(CONVOY.disperse.limit);
    expect(shipSpeed(g)).toBeCloseTo(SHIP.speed * CONVOY.disperse.speed, 6);
    run(g, 3);
    expect(wide(g)).toBeGreaterThan(before * 1.5);
    // Never off the water or out of the lane.
    for (const s of g.ships) {
      expect(onLand(g, s.x, s.y), `ship ${s.id} at ${s.x.toFixed(0)}, ${s.y.toFixed(0)}`).toBe(false);
      expect(Math.abs(s.lat)).toBeLessThanOrEqual(g.map.channels[s.channel].halfWidth);
    }
    // Splash weapons do half damage while it lasts (a 2-damage ballistic: 1).
    const s = g.ships[0];
    const hp = s.hp;
    damageShip(g, s, 2, 'ballistic');
    expect(hp - s.hp).toBe(1);
    run(g, CONVOY.disperse.time);
    expect(formationNow(g)).toBe(FORMATIONS.pairs);
    expect(shipSpeed(g)).toBe(SHIP.speed);
    run(g, 6);
    expect(wide(g)).toBeCloseTo(before, 0);
  });
});

describe('Hold (Harbor Mouth)', () => {
  it('holds the next groups off the entry, never the ships afloat; released, they sail one behind another', () => {
    const g = lab('harbor', 'tactical', 20);
    const afloat = g.ships.map((s) => [s.id, s.d] as const);
    const sailed = () => g.tel!.sidecar(g).events.filter((e) => e.k === 'ship+').length;
    const n0 = sailed();
    expect(convoyCommand(g, 'hold')).toEqual({ ok: true });
    expect(commandState(g, 'hold')).toMatchObject({ active: true, ready: true });
    run(g, 4.5);
    // Ships already out keep sailing.
    for (const [id, d] of afloat) expect(g.ships.find((s) => s.id === id)!.d).toBeGreaterThan(d + 100);
    expect(sailed()).toBe(n0);
    expect(g.convoy!.owed).toBe(1);
    // Release: the held group sails at once, and the schedule's next follows at its own time.
    expect(convoyCommand(g, 'hold')).toEqual({ ok: true });
    run(g, 1);
    expect(sailed()).toBe(n0 + FORMATIONS.pairs.group);
    expect(g.convoy).toMatchObject({ owed: 0, holding: false });
    expect(convoyCommand(g, 'hold')).toEqual({ ok: false, why: 'cooldown' });
    expect(cmds(g).map((c) => [c.what, c.req, c.ok])).toEqual([['hold', 'hold', 1], ['release', 'player', 1], ['hold', 'hold', 0]]);
  });

  it('never for long: it ends by itself after its seconds, or when the staging water is full', () => {
    const g = lab('harbor', 'tactical', 20);
    convoyCommand(g, 'hold');
    run(g, CONVOY.hold.max + 0.2);
    expect(g.convoy!.holding).toBe(false);
    expect(cmds(g).at(-1)).toMatchObject({ what: 'release', ok: 1 });
    expect(['max', 'queue']).toContain(cmds(g).at(-1)!.req);
    expect(g.convoy!.waited).toBeLessThanOrEqual(CONVOY.hold.max + 0.05);
    // A faster schedule fills the staging water first.
    const fast = createGame('harbor', 4, 1);
    applyConvoy(fast, { ...setup('tactical'), flow: 4, tune: { holdMax: 12 } });
    logTelemetry(fast, { id: 't', build: 'test', v: LOG_VERSION, firstWave: 1, device: { w: 0, h: 0, dpr: 1, touch: false, ua: 'test' } }, 'sim', 'test');
    fast.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    run(fast, 12);
    convoyCommand(fast, 'hold');
    run(fast, 12);
    expect(cmds(fast).find((c) => c.what === 'release')).toMatchObject({ req: 'queue', was: CONVOY.hold.groups });
    expect(fast.convoy!.waited).toBeLessThan(12);
  });

  it('holding as often as allowed delays ships and never drops one: every group the schedule called for sails', () => {
    const spam = lab('harbor', 'tactical', 0);
    const plain = lab('harbor', 'auto', 0);
    for (let i = 0; i < 180 / DT; i++) {
      if (commandState(spam, 'hold').ready && !spam.convoy!.holding) convoyCommand(spam, 'hold');
      step(spam, DT);
      step(plain, DT);
    }
    const c = spam.convoy!;
    expect(c.used.hold).toBeGreaterThan(8);
    expect(c.scheduled).toBe(plain.convoy!.scheduled);
    // Released = scheduled, less what is waiting right now (at most the staging water's two).
    expect(c.scheduled - c.released).toBe(c.owed);
    expect(c.owed).toBeLessThanOrEqual(CONVOY.hold.groups);
    // Held at most a third of the time: 6 s on, then 12 s before the next.
    expect(c.used.hold * CONVOY.hold.max).toBeLessThanOrEqual(180 * (CONVOY.hold.max / (CONVOY.hold.max + CONVOY.hold.cooldown)) + CONVOY.hold.max);
    // Deliveries fall behind by no more than the ships still held or just released.
    expect(plain.delivered - spam.delivered).toBeLessThanOrEqual(6);
    expect(spam.delivered).toBeGreaterThan(plain.delivered * 0.8);
    // No hull sails on top of another at the entry.
    for (const a of spam.ships) for (const b of spam.ships) if (a.id < b.id) expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id}/${b.id}`).toBeGreaterThan(20);
  });

  it('a Hold never carries past its wave', () => {
    const g = lab('harbor', 'tactical', 20);
    convoyCommand(g, 'hold');
    run(g, 2);
    g.queue = [];
    step(g, DT);
    expect(g.phase).toBe('draft');
    expect(g.convoy!.holding).toBe(false);
    expect(cmds(g).at(-1)).toMatchObject({ what: 'release', req: 'wave' });
  });
});

describe('the gate: the same seed is the same game, and the log replays it', () => {
  const spec = (over: Partial<TrialSpec>): TrialSpec => ({ map: 'strait', seed: 31, policy: 'tactical', obligation: 'fixed', pilot: 'sharp', persona: 'tryhard', armory: { warhead: 3 }, firstWave: 5, ...over });

  it('two trials of one spec are identical; the log carries its policy and its commands and replays to the same state, with telemetry on or off', () => {
    for (const s of [spec({}), spec({ map: 'harbor', pilot: 'spam' }), spec({ map: 'gauntlet', policy: 'current', obligation: 'natural' })]) {
      const a = runTrial(s);
      const b = runTrial(s);
      const strip = ({ log: _l, ...t }: typeof a) => t;
      expect(strip(b)).toEqual(strip(a));
      // (The log's `endedAt` is the clock on the wall; everything a replay reads is the same.)
      expect(logHash(b.log)).toBe(logHash(a.log));
      expect(b.log.summary).toEqual(a.log.summary);
      expect(a.log.convoy).toMatchObject({ policy: s.policy, obligation: s.obligation, rev: CONVOY_REV });
      expect(a.log.v).toBe(LOG_VERSION);
      expect(a.problems).toEqual([]);
      const ls = lockstep(a.log, 600);
      expect(ls.divergedAt, s.map).toBe(-1);
      expect(ls.rngSame, s.map).toBe(true);
      expect(stateHash(replay(a.log))).toBe(ls.stateHash);
      if (s.policy === 'tactical') expect(a.log.commands.filter((c) => c[1] === 'k').length, s.map).toBeGreaterThan(0);
    }
  }, 60_000);

  it('the commands are in the telemetry with the ships they took and the reason for each refusal', () => {
    const t = runTrial(spec({ pilot: 'spam' }));
    const sc = replay(t.log, { telemetry: true }).tel!;
    const list = sc.events.filter((e): e is Extract<TelEvent, { k: 'cmd' }> => e.k === 'cmd' && (['rush', 'disperse'] as string[]).includes(e.what));
    expect(list.filter((c) => c.ok).length).toBeGreaterThan(5);
    for (const c of list) {
      if (c.ok) expect(c.ids!.length).toBeGreaterThan(0);
      else expect(['cooldown', 'busy', 'none']).toContain(c.why);
    }
    expect(sc.header.convoy).toMatchObject({ policy: 'tactical', obligation: 'fixed', rev: CONVOY_REV, commands: ['rush', 'disperse'] });
  }, 30_000);
});

describe('no command is a way round the fight', () => {
  const base: Omit<TrialSpec, 'policy' | 'pilot' | 'map'> = { seed: 0, obligation: 'fixed', persona: 'tryhard', armory: { warhead: 3 }, firstWave: 4 };
  const seeds = [41, 42, 43, 44];
  const of = (map: TrialSpec['map'], policy: ConvoyPolicy, pilot: TrialSpec['pilot']) => cohort(`${policy}:${pilot}`, seeds.map((seed) => runTrial({ ...base, map, seed, policy, pilot })));

  it('on every reference map, giving every command the instant it is ready: no lane, queue or wave breaks, and nobody is made safe', () => {
    for (const map of ['strait', 'gauntlet', 'harbor'] as const) {
      const auto = of(map, 'auto', 'never');
      const spam = of(map, 'tactical', 'spam');
      for (const t of spam.trials) {
        expect(t.problems, `${map} seed ${t.spec.seed}`).toEqual([]);
        // Every ship asked for sailed (less any held or due as the run ended).
        expect(t.owed).toBeLessThanOrEqual(CONVOY.hold.groups);
        expect(t.waited).toBeLessThanOrEqual(CONVOY.hold.max + 0.05);
        expect(t.commands.rush ?? t.commands.hold ?? 0).toBeGreaterThan(5);
      }
      // The same waves were played, so the same ships were asked for (to within what was held at the end).
      expect(Math.abs(spam.m.scheduled.mean - auto.m.scheduled.mean) / auto.m.scheduled.mean, map).toBeLessThan(0.06);
      // Not invulnerable: the convoy still takes hull, and still loses it at a comparable rate.
      expect(spam.m.hpShip.mean, map).toBeGreaterThan(auto.m.hpShip.mean * 0.5);
      // Not starved: deliveries are not bought by keeping ships off the map.
      expect(spam.m.delivered.mean, map).toBeGreaterThan(auto.m.delivered.mean * 0.85);
      // Not a score farm.
      expect(spam.m.score.mean, map).toBeLessThan(auto.m.score.mean * 1.15);
    }
  }, 180_000);

  it('a comparison carries its denominators, seed by seed', () => {
    const a = of('strait', 'auto', 'never');
    const d = of('strait', 'tactical', 'sharp');
    for (const c of [a, d]) {
      expect(c.n).toBe(seeds.length);
      for (const k of ['scheduled', 'sailed', 'delivered', 'sunk', 'hpShip', 'shipMinutes', 'risk', 'seconds']) expect(c.m[k], k).toMatchObject({ mean: expect.any(Number), min: expect.any(Number), max: expect.any(Number) });
      expect(c.m.shipMinutes.mean).toBeGreaterThan(50);
    }
    const p = paired(a, d, (t) => t.hpShip);
    expect(p.n).toBe(seeds.length);
    expect(p.lower).toBeLessThanOrEqual(p.n);
    // The telemetry of every trial adds up to its game.
    for (const t of [...a.trials, ...d.trials]) expect(t.problems).toEqual([]);
  }, 120_000);
});

describe('the ending and the bonus wave under a policy', () => {
  it('the three-run ending and Siren Field play on under each policy; a Hold given in an event still ends by itself', () => {
    for (const policy of ['auto', 'tactical'] as ConvoyPolicy[]) {
      const { game: g, log } = playMimic('harbor', 201, { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11, convoy: setup(policy, 'natural'), pilot: 'spam' });
      expect(g.eventLog.map((e) => e.run), policy).toEqual([1, 2, 3]);
      expect(g.phase).toBe('won');
      expect(g.convoy!.waited).toBeLessThanOrEqual(CONVOY.hold.max + 0.05);
      const again = replay(log, { telemetry: true });
      expect(reconcile(again.tel!.sidecar(again), again), policy).toEqual([]);
      expect(again.tel!.sidecar(again).phases.map((p) => p.kind)).toEqual(['mapEvent', 'mapEvent', 'mapEvent']);
    }
    const bonus = playMimic('strait', 8, { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 6, convoy: setup('tactical', 'natural'), pilot: 'sharp' });
    expect(bonus.game.eventLog[0]).toMatchObject({ id: 'siren-field', kind: 'bonus' });
    expect(VIEW.width).toBe(1600);
  }, 60_000);
});

describe('the commands\' numbers are prototypes that hang together', () => {
  it('a Rush pays back what it gains; a cooldown outlasts its command; a Hold is shorter than its cooldown', () => {
    const R = CONVOY.rush;
    expect((R.speed - 1) * R.time).toBeCloseTo((1 - R.coastSpeed) * R.coast, 6);
    expect(R.cooldown).toBeGreaterThanOrEqual(R.time + R.coast);
    expect(CONVOY.disperse.cooldown).toBeGreaterThan(CONVOY.disperse.time * 2);
    expect(CONVOY.hold.cooldown).toBeGreaterThan(CONVOY.hold.max);
    const ids: CommandId[] = ['rush', 'disperse', 'hold'];
    expect(ids).toHaveLength(3);
  });
});
