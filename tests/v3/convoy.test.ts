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
import { FLOW_STEPS, SHIP, VIEW } from '../../src/v3/data/config';
import { CONVOY, CONVOY_REV, MAP_CONVOY, mapConvoy, type CommandId, type ConvoyPolicy, type ConvoySetup } from '../../src/v3/data/convoy';
import { FORMATIONS } from '../../src/v3/data/formations';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { applyConvoy, commandState, convoyCommand, convoyCommands, formationNow, holdLineD, refusalText } from '../../src/v3/sim/convoy';
import { laneDAtX } from '../../src/v3/sim/lanes';
import { cohort, paired, runTrial, type TrialSpec } from '../../src/v3/sim/convoyLab';
import { createGame, damageShip, setFlow, setFormation, shipSpeed, step, type Game } from '../../src/v3/sim/game';
import { onLand } from '../../src/v3/sim/foes';
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
  // Round 9, the player's run v3-20261112214027-31825 (Harbor Mouth, policy
  // D, from wave 5): "The [Hold] command did not work at all". Rev 1 took
  // the press (ok) and changed nothing that could be seen: it kept only the
  // groups that came due while it was on off the map, and the next was 5.2 s
  // away, so one group sailed 0.7 s late and every ship on the water sailed
  // on. Rev 2: every ship short of the hold line stops, there and then.
  it('the player\'s press: every ship short of the hold line stops within half a second and stays stopped; the line is on the lane, in the wide water', () => {
    const log = JSON.parse(readFileSync(new URL('./fixtures/round9-hold-31825.json', import.meta.url), 'utf8')) as PlayLog;
    const press = log.commands.findIndex((c) => c[1] === 'k');
    expect(log.commands[press]).toEqual([646, 'k', 'hold']);
    const g = replayTo(log, 646, press + 1, { telemetry: true });
    expect(g.steps).toBe(646);
    expect(g.convoy).toMatchObject({ holding: true, used: { hold: 1, rush: 0, disperse: 0 }, refused: 0 });
    // The ships on the water (two pairs, all short of the line).
    const line = holdLineD(g, 0)!;
    const ch = g.map.channels[0];
    expect(laneDAtX(ch, 700)! - line).toBeGreaterThan(80);
    expect(g.ships.length).toBe(4);
    expect(g.ships.every((s) => s.d < line - 100)).toBe(true);
    const at0 = new Map(g.ships.map((s) => [s.id, s.d] as const));
    run(g, CONVOY.hold.ease + 0.1);
    const at1 = new Map(g.ships.map((s) => [s.id, s.d] as const));
    run(g, 4);
    for (const s of g.ships.filter((s) => at0.has(s.id))) {
      // Under rev 1 each sailed on at full speed (about 160 px in these 4.5 s).
      expect(s.d - at0.get(s.id)!, `ship ${s.id}`).toBeLessThan(SHIP.speed * CONVOY.hold.ease);
      expect(s.d, `ship ${s.id} stopped`).toBe(at1.get(s.id));
    }
    expect(g.convoy!.owed).toBeGreaterThanOrEqual(4);
    // The telemetry names the ships the press stopped.
    expect(cmds(g).find((c) => c.what === 'hold')).toMatchObject({ ok: 1, ids: [...at0.keys()] });
    // Left alone it ends by itself, and they sail on.
    run(g, CONVOY.hold.max);
    expect(g.convoy!.holding).toBe(false);
    expect(cmds(g).at(-1)).toMatchObject({ what: 'release', req: 'max' });
    const d0 = g.ships[0].d;
    run(g, 1);
    expect(g.ships[0].d - d0).toBeGreaterThan(SHIP.speed * 0.8);
  });

  it('stops the ships short of the line, never the ships past it; released, they sail on; then it cools down', () => {
    const g = lab('harbor', 'tactical', 26);
    const line = holdLineD(g, 0)!;
    const past = g.ships.filter((s) => s.d >= line);
    const short = g.ships.filter((s) => s.d < line - 60);
    expect(past.length, 'a ship already past the line').toBeGreaterThan(0);
    expect(short.length, 'a ship short of it').toBeGreaterThan(0);
    const before = new Map(g.ships.map((s) => [s.id, s.d] as const));
    expect(convoyCommand(g, 'hold')).toEqual({ ok: true });
    expect(commandState(g, 'hold')).toMatchObject({ active: true, ready: true });
    run(g, 3);
    for (const s of past) if (g.ships.includes(s)) expect(s.d).toBeGreaterThan(before.get(s.id)! + 100);
    for (const s of short) {
      expect(s.d - before.get(s.id)!).toBeLessThan(SHIP.speed * CONVOY.hold.ease);
      expect(s.d).toBeLessThan(line);
    }
    // Release: they sail on at once.
    expect(convoyCommand(g, 'hold')).toEqual({ ok: true });
    const held = short.map((s) => s.d);
    run(g, 1);
    short.forEach((s, i) => expect(s.d - held[i]).toBeGreaterThan(SHIP.speed * 0.8));
    expect(g.convoy).toMatchObject({ owed: 0, holding: false });
    expect(convoyCommand(g, 'hold')).toEqual({ ok: false, why: 'cooldown' });
    expect(refusalText(g, 'hold', 'cooldown')).toMatch(/^Ready again in \d+ s$/);
    expect(cmds(g).map((c) => [c.what, c.req, c.ok])).toEqual([['hold', 'hold', 1], ['release', 'player', 1], ['hold', 'hold', 0]]);
  });

  it('refused, and said so, when no ship is short of the line; no other map has a hold line', () => {
    const g = lab('harbor', 'tactical', 26);
    const line = holdLineD(g, 0)!;
    g.ships = g.ships.filter((s) => s.d >= line);
    g.spawnT = 99;
    expect(commandState(g, 'hold')).toMatchObject({ ready: false, active: false });
    expect(convoyCommand(g, 'hold')).toEqual({ ok: false, why: 'none' });
    expect(refusalText(g, 'hold', 'none')).toBe('No ship short of the hold line');
    expect(refusalText(g, 'rush', 'busy')).toBe('Not while dispersed');
    expect(cmds(g).at(-1)).toMatchObject({ what: 'hold', ok: 0, why: 'none' });
    for (const [id, def] of Object.entries(MAP_CONVOY)) expect(!!def!.stage, id).toBe(def!.commands.includes('hold'));
  });

  it('never for long: it ends by itself after its seconds; the next ships wait at the entry meanwhile', () => {
    const g = lab('harbor', 'tactical', 20);
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
    const spam = lab('harbor', 'tactical', 0);
    const plain = lab('harbor', 'auto', 0);
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
        // Every ship asked for sailed (any held as the run ended are still afloat).
        expect(t.owed).toBeLessThanOrEqual(t.afloat);
        expect(t.waited).toBeLessThanOrEqual(CONVOY.hold.max + 0.05);
        expect(t.commands.rush ?? t.commands.hold ?? 0).toBeGreaterThan(5);
      }
      // The same schedule: as many ships asked for a second of play (a run
      // lost a wave or two sooner asks for fewer in all; round 9 moved the
      // seeds' outcomes when the decoys and scavengers changed). Rev 2's
      // Hold keeps the next ships at the entry while it is on, so Harbor
      // Mouth's can run a little behind.
      const rate = (c: typeof auto) => c.trials.reduce((a, t) => a + t.scheduled / Math.max(1, t.seconds), 0) / c.trials.length;
      expect(Math.abs(rate(spam) - rate(auto)) / rate(auto), map).toBeLessThan(map === 'harbor' ? 0.1 : 0.06);
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
