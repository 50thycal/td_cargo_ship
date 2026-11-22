// The Map & Convoy Lab's convoy policies and tactical commands
// (docs/design/v3-map-convoy-lab-plan.md, §6, slices 3 and 4). Lab only: a
// game with no convoy setup plays as it always has.
//
// The gates: the same seed plays the same game every time; no command
// breaks the lane, the queue or the wave; every comparison carries its
// denominators; and no command is a way to wait a fight out, to be
// invulnerable, or to farm score.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FLOW, FLOW_STEPS, SHIP, VIEW } from '../../src/v3/data/config';
import { COMMANDS, CONVOY, CONVOY_REV, MAP_CONVOY, mapConvoy, type CommandId, type ConvoyPolicy, type ConvoySetup } from '../../src/v3/data/convoy';
import { FORMATIONS } from '../../src/v3/data/formations';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { applyConvoy, commandState, convoyCommand, convoyCommands, formationNow, refusalText } from '../../src/v3/sim/convoy';
import { cohort, paired, runTrial, type TrialSpec } from '../../src/v3/sim/convoyLab';
import { FULL_TEMPO, createGame, setFlow, setFormation, shipSpeed, step, type Game } from '../../src/v3/sim/game';
import { lockstep, logHash, stateHash } from '../../src/v3/sim/mapLab';
import { PERSONAS, playMimic } from '../../src/v3/sim/mimic';
import { LOG_VERSION, logTelemetry, replay, replayTo, type PlayLog } from '../../src/v3/sim/playlog';
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
    expect(convoyCommand(g, 'hold')).toEqual({ ok: false, why: 'policy' });
    expect(stateHash(g)).toBe(before);
    expect(shipSpeed(g)).toBe(SHIP.speed);
    expect(formationNow(g)).toBe(FORMATIONS.pairs);
  });

  it('round 11: Hold, the one command left, is on Sowers\' Reach only (mines cross its lane); the reference maps have none', () => {
    // Chapter 1's Kesh and Marrow (docs/design/v3-ch1-*.md) sail the map's own convoy, as the reference maps do.
    // Chapter 2's Island and Behemoth Run (docs/design/v3-ch2-*.md): the same.
    expect(Object.keys(MAP_CONVOY).sort()).toEqual(['archipelago', 'battery', 'behemoth', 'gauntlet', 'harbor', 'island', 'kesh', 'marrow', 'needle', 'rigs', 'saltgate', 'sowers', 'strait']);
    for (const id of ['strait', 'gauntlet', 'harbor', 'kesh', 'marrow', 'island', 'behemoth', 'needle', 'archipelago', 'saltgate', 'battery', 'rigs'] as const) expect(mapConvoy(id).commands, id).toEqual([]);
    // Saltgate Canal (docs/design/v3-ch2-saltgate.md): the campaign's own
    // schedule, as Sowers' Reach (the locks set the pace).
    expect(mapConvoy('saltgate')).toMatchObject({ flow: DEFAULT_FLOW, formation: 'pairs' });
    // Battery Point (docs/design/v3-ch3-battery.md): the same, the pace the
    // player rated in the campaign.
    expect(mapConvoy('battery')).toMatchObject({ flow: DEFAULT_FLOW, formation: 'pairs' });
    // The Rig Field (docs/design/v3-ch3-rigs.md, log v49): the same.
    expect(mapConvoy('rigs')).toMatchObject({ flow: DEFAULT_FLOW, formation: 'pairs' });
    expect(mapConvoy('sowers').commands).toEqual(['hold']);
    // Sowers' Reach keeps the campaign's own schedule and formation.
    expect(mapConvoy('sowers')).toMatchObject({ flow: DEFAULT_FLOW, formation: 'pairs' });
    expect(Object.keys(COMMANDS)).toEqual(['hold']);
    for (const id of MAP_ORDER) {
      const c = mapConvoy(id);
      expect(c.commands.length, id).toBeLessThanOrEqual(1);
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
    expect(convoyCommand(g, 'hold')).toEqual({ ok: false, why: 'policy' });
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

  it('D (tactical): the map\'s formation and schedule, and the map\'s command; with none, the same convoy as A', () => {
    const g = lab('strait', 'tactical');
    setFormation(g, 'box');
    expect(g.formation).toBe('pairs');
    expect(convoyCommands(g)).toEqual([]);
    expect(convoyCommands(lab('sowers', 'tactical', 1))).toEqual(['hold']);
    expect(convoyCommands(lab('harbor', 'tactical', 1))).toEqual([]);
    // A map with no command of its own sails by itself under D: the ships
    // sail exactly as under A.
    expect(convoyCommands(lab('kesh', 'tactical', 1))).toEqual([]);
    const a = lab('strait', 'auto', 40);
    const d = lab('strait', 'tactical', 40);
    expect(d.ships.map((s) => [s.id, s.x, s.y])).toEqual(a.ships.map((s) => [s.id, s.x, s.y]));
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

describe('Hold (Sowers\' Reach, round 11)', () => {
  // Round 9, the player's run v3-20261112214027-31825 (Harbor Mouth, policy
  // D, from wave 5): "The [Hold] command did not work at all". Round 9 (rev
  // 2) made Hold stop every ship short of a hold line. Round 11 (rev 3): Hold
  // stops every ship afloat, there is no line, and it moved to Sowers'
  // Reach; Harbor Mouth has no command, so that press is refused now.
  it('the round 9 press on Harbor Mouth: refused now, Harbor Mouth has no command', () => {
    const log = JSON.parse(readFileSync(new URL('./fixtures/round9-hold-31825.json', import.meta.url), 'utf8')) as PlayLog;
    const press = log.commands.findIndex((c) => c[1] === 'k');
    expect(log.commands[press]).toEqual([646, 'k', 'hold']);
    const g = replayTo(log, 646, press + 1, { telemetry: true });
    expect(g.steps).toBe(646);
    expect(g.convoy).toMatchObject({ holding: false, used: { hold: 0 }, refused: 1 });
    expect(cmds(g).at(-1)).toMatchObject({ what: 'hold', ok: 0, why: 'policy' });
    const at0 = new Map(g.ships.map((s) => [s.id, s.d] as const));
    run(g, 2);
    for (const s of g.ships.filter((o) => at0.has(o.id))) expect(s.d - at0.get(s.id)!, `ship ${s.id} sails on`).toBeGreaterThan(SHIP.speed);
  });

  it('every ship afloat stops within half a second and stays stopped; left alone it ends by itself and they sail on', () => {
    const g = lab('sowers', 'tactical', 30);
    expect(g.ships.length).toBeGreaterThanOrEqual(4);
    expect(convoyCommand(g, 'hold')).toEqual({ ok: true });
    expect(g.convoy).toMatchObject({ holding: true, used: { hold: 1 }, refused: 0 });
    const at0 = new Map(g.ships.map((s) => [s.id, s.d] as const));
    run(g, CONVOY.hold.ease + 0.1);
    const at1 = new Map(g.ships.map((s) => [s.id, s.d] as const));
    run(g, 4);
    for (const s of g.ships.filter((s) => at0.has(s.id))) {
      expect(s.d - at0.get(s.id)!, `ship ${s.id}`).toBeLessThan(SHIP.speed * CONVOY.hold.ease);
      expect(s.d, `ship ${s.id} stopped`).toBe(at1.get(s.id));
    }
    expect(g.convoy!.owed).toBeGreaterThanOrEqual(at0.size);
    // The telemetry names the ships the press stopped.
    expect(cmds(g).find((c) => c.what === 'hold')).toMatchObject({ ok: 1, ids: [...at0.keys()] });
    run(g, CONVOY.hold.max);
    expect(g.convoy!.holding).toBe(false);
    expect(cmds(g).at(-1)).toMatchObject({ what: 'release', req: 'max' });
    // (The held ships followed by id, the freest of them at full speed:
    // round 11's changes to the waves and the Cutter's taps move what
    // happens later in this run, and which ship is first in the list.)
    const d0 = new Map(g.ships.map((s) => [s.id, s.d] as const));
    run(g, 1);
    const moved = g.ships.filter((s) => d0.has(s.id)).map((s) => s.d - d0.get(s.id)!);
    expect(Math.max(...moved)).toBeGreaterThan(SHIP.speed * 0.8);
  });

  it('stops every ship afloat, wherever it is; released, they sail on; then it cools down', () => {
    const g = lab('sowers', 'tactical', 40);
    const all = [...g.ships];
    expect(all.some((s) => s.x > 800), 'a ship well along the lane').toBe(true);
    expect(all.some((s) => s.x < 500), 'a ship near the entry').toBe(true);
    const before = new Map(g.ships.map((s) => [s.id, s.d] as const));
    expect(convoyCommand(g, 'hold')).toEqual({ ok: true });
    expect(commandState(g, 'hold')).toMatchObject({ active: true, ready: true });
    run(g, 3);
    for (const s of all) {
      expect(g.ships.includes(s), `ship ${s.id} still afloat`).toBe(true);
      expect(s.d - before.get(s.id)!, `ship ${s.id}`).toBeLessThan(SHIP.speed * CONVOY.hold.ease);
    }
    expect(g.convoy!.owed).toBe(g.ships.length);
    // Release: they sail on at once.
    expect(convoyCommand(g, 'hold')).toEqual({ ok: true });
    const held = all.map((s) => s.d);
    run(g, 1);
    all.forEach((s, i) => expect(s.d - held[i]).toBeGreaterThan(SHIP.speed * 0.8));
    expect(g.convoy).toMatchObject({ owed: 0, holding: false });
    expect(convoyCommand(g, 'hold')).toEqual({ ok: false, why: 'cooldown' });
    expect(refusalText(g, 'hold', 'cooldown')).toMatch(/^Ready again in \d+ s$/);
    expect(cmds(g).map((c) => [c.what, c.req, c.ok])).toEqual([['hold', 'hold', 1], ['release', 'player', 1], ['hold', 'hold', 0]]);
  });

  it('refused, and said so, when no ship is afloat; no map has a hold line (rev 3)', () => {
    const g = lab('sowers', 'tactical', 26);
    g.ships = [];
    g.spawnT = 99;
    expect(commandState(g, 'hold')).toMatchObject({ ready: false, active: false });
    expect(convoyCommand(g, 'hold')).toEqual({ ok: false, why: 'none' });
    expect(refusalText(g, 'hold', 'none')).toBe('No ships afloat');
    expect(cmds(g).at(-1)).toMatchObject({ what: 'hold', ok: 0, why: 'none' });
    for (const [id, def] of Object.entries(MAP_CONVOY)) expect('stage' in def!, id).toBe(false);
    expect(CONVOY_REV).toBe(3);
  });

  it('never for long: it ends by itself after its seconds; the next ships wait at the entry meanwhile', () => {
    const g = lab('sowers', 'tactical', 20);
    const n = g.ships.length;
    convoyCommand(g, 'hold');
    run(g, CONVOY.hold.max + 0.2);
    expect(g.convoy!.holding).toBe(false);
    expect(cmds(g).at(-1)).toMatchObject({ what: 'release', req: 'max', ok: 1 });
    expect(g.convoy!.waited).toBeLessThanOrEqual(CONVOY.hold.max + 0.05);
    // A ship that came in during the Hold waited at the entry, never on top of another.
    expect(g.ships.length).toBeGreaterThanOrEqual(n);
    for (const a of g.ships) for (const b of g.ships) if (a.id < b.id) expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id}/${b.id}`).toBeGreaterThan(20);
  });

  it('holding as often as allowed delays ships and never drops one', () => {
    const spam = lab('sowers', 'tactical', 0);
    const plain = lab('sowers', 'auto', 0);
    for (let i = 0; i < 180 / DT; i++) {
      if (commandState(spam, 'hold').ready && !spam.convoy!.holding) convoyCommand(spam, 'hold');
      step(spam, DT);
      step(plain, DT);
    }
    const c = spam.convoy!;
    expect(c.used.hold).toBeGreaterThan(8);
    expect(c.held).toBeGreaterThan(c.used.hold);
    // Every group that came due sailed (a held entry can put the schedule a few seconds behind).
    expect(c.scheduled).toBe(c.released);
    expect(plain.convoy!.scheduled - c.scheduled).toBeLessThanOrEqual(3);
    // Held at most a third of the time: 6 s on, then 12 s before the next.
    expect(c.used.hold * CONVOY.hold.max).toBeLessThanOrEqual(180 * (CONVOY.hold.max / (CONVOY.hold.max + CONVOY.hold.cooldown)) + CONVOY.hold.max);
    // Deliveries fall behind by no more than a third (the time held), and never stop.
    expect(spam.delivered).toBeGreaterThan(plain.delivered * 0.6);
    // No hull sails on top of another.
    for (const a of spam.ships) for (const b of spam.ships) if (a.id < b.id) expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id}/${b.id}`).toBeGreaterThan(20);
  });

  it('a Hold never carries past its wave', () => {
    const g = lab('sowers', 'tactical', 20);
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
    for (const s of [spec({}), spec({ map: 'sowers', pilot: 'spam' }), spec({ map: 'gauntlet', policy: 'current', obligation: 'natural' })]) {
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
      if (s.policy === 'tactical' && mapConvoy(s.map).commands.length) expect(a.log.commands.filter((c) => c[1] === 'k').length, s.map).toBeGreaterThan(0);
    }
  }, 60_000);

  it('the commands are in the telemetry with the ships they took and the reason for each refusal', () => {
    const t = runTrial(spec({ map: 'sowers', pilot: 'spam' }));
    const sc = replay(t.log, { telemetry: true }).tel!;
    const list = sc.events.filter((e): e is Extract<TelEvent, { k: 'cmd' }> => e.k === 'cmd' && e.what === 'hold');
    expect(list.filter((c) => c.ok).length).toBeGreaterThan(5);
    for (const c of list) {
      if (c.ok) expect(c.ids!.length).toBeGreaterThan(0);
      else expect(['cooldown', 'none']).toContain(c.why);
    }
    expect(sc.header.convoy).toMatchObject({ policy: 'tactical', obligation: 'fixed', rev: CONVOY_REV, commands: ['hold'] });
  }, 30_000);
});

describe('no command is a way round the fight', () => {
  const base: Omit<TrialSpec, 'policy' | 'pilot' | 'map'> = { seed: 0, obligation: 'fixed', persona: 'tryhard', armory: { warhead: 3 }, firstWave: 4 };
  // Eight seeds (four until round 11): a run is won or lost by a wave or two,
  // so four seeds' mean score swung 35% on The Gauntlet when the decoys left
  // the waves (spam 34,220 against 25,275 on 41 to 44; over 41 to 52 the two
  // are within 4%).
  const seeds = [41, 42, 43, 44, 45, 46, 47, 48];
  const of = (map: TrialSpec['map'], policy: ConvoyPolicy, pilot: TrialSpec['pilot']) => cohort(`${policy}:${pilot}`, seeds.map((seed) => runTrial({ ...base, map, seed, policy, pilot })));

  it('on the map with a command, giving it the instant it is ready: no lane, queue or wave breaks, and nobody is made safe', () => {
    for (const map of ['sowers'] as const) {
      const auto = of(map, 'auto', 'never');
      const spam = of(map, 'tactical', 'spam');
      for (const t of spam.trials) {
        expect(t.problems, `${map} seed ${t.spec.seed}`).toEqual([]);
        // Every ship asked for sailed (any held as the run ended are still afloat).
        expect(t.owed).toBeLessThanOrEqual(t.afloat);
        expect(t.waited).toBeLessThanOrEqual(CONVOY.hold.max + 0.05);
        expect(t.commands.hold ?? 0).toBeGreaterThan(5);
      }
      // The same schedule: as many ships asked for a second of play (a run
      // lost a wave or two sooner asks for fewer in all; round 9 moved the
      // seeds' outcomes when the decoys and scavengers changed). Hold keeps
      // the next ships at the entry while it is on, so the schedule can run
      // a little behind.
      const rate = (c: typeof auto) => c.trials.reduce((a, t) => a + t.scheduled / Math.max(1, t.seconds), 0) / c.trials.length;
      expect(Math.abs(rate(spam) - rate(auto)) / rate(auto), map).toBeLessThan(0.1);
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
  it('the three-run ending and Siren Field play on under each policy', () => {
    for (const policy of ['auto', 'tactical'] as ConvoyPolicy[]) {
      // (Round 12's fixes made the Breakout sink ships: the loss limit is
      // lifted so the run plays all three boss rounds whatever it loses.)
      const { game: g, log } = playMimic('harbor', 201, { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11, tempo: { ...FULL_TEMPO, lossLimit: 99 }, convoy: setup(policy, 'natural'), pilot: 'spam' });
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
  it('a Hold is shorter than its cooldown, and eases to a stop in under a second; it is the one command (round 11)', () => {
    expect(CONVOY.hold.cooldown).toBeGreaterThan(CONVOY.hold.max);
    expect(CONVOY.hold.ease).toBeLessThan(1);
    const ids: CommandId[] = ['hold'];
    expect(Object.keys(CONVOY)).toEqual(ids);
  });
});
