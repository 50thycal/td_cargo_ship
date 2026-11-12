// Authored encounters for the three reference maps
// (docs/design/v3-map-convoy-lab-plan.md, §7, slice 5). Lab only: a game
// with no encounter layer plays the shared waves as it always has.
//
// What must hold: only enemies the map already has at that wave; launchers
// that exist and sit where the map puts them; a wave no bigger than the
// shared one; a warning before every authored launch; the same thing every
// time; and the map's own event and the bonus wave untouched.

import { describe, expect, it } from 'vitest';
import { PLANE, RAID, SUB, VIEW } from '../../src/v3/data/config';
import { ENCOUNTERS, ENCOUNTER_MAPS, ENCOUNTER_REV, arc, encountersFor, type Encounter } from '../../src/v3/data/encounters';
import { MAPS } from '../../src/v3/data/maps';
import { WAVE_TABLE, waveSpec } from '../../src/v3/data/waves';
import { applyEncounters, createGame, step, type Game } from '../../src/v3/sim/game';
import { onLand } from '../../src/v3/sim/foes';
import { lockstep, stateHash } from '../../src/v3/sim/mapLab';
import { PERSONAS, playMimic } from '../../src/v3/sim/mimic';
import { LOG_VERSION, logTelemetry, replay } from '../../src/v3/sim/playlog';
import { reconcile, type TelEvent, type TelemetrySidecar } from '../../src/v3/sim/telemetry';

const DT = 1 / 60;
const ON = { rev: ENCOUNTER_REV };

/** A wave of a map, with or without its encounters, nobody shooting, with
 *  telemetry: played to its end (or `seconds`). */
function wave(map: Encounter['map'], n: number, on: boolean, seed = 9, seconds = 90): { g: Game; sc: TelemetrySidecar } {
  const g = createGame(map, seed, n);
  if (on) applyEncounters(g, ON);
  g.tempo = { ...g.tempo, lossLimit: 999 };
  g.carrierHp = 999;
  logTelemetry(g, { id: 'enc-test', build: 'test', v: LOG_VERSION, firstWave: n, device: { w: 0, h: 0, dpr: 1, touch: false, ua: 'test' } }, 'sim', 'none');
  for (let i = 0; i < seconds / DT && g.phase === 'wave' && g.wave === n; i++) step(g, DT);
  return { g, sc: g.tel!.sidecar(g) };
}
const launches = (sc: TelemetrySidecar) => sc.events.filter((e): e is Extract<TelEvent, { k: 'thr+' }> => e.k === 'thr+' && e.pid === undefined && e.o !== 'structure' && !e.back);
/** What a freshly planned wave will send: its queue and its launchers' loads. */
const planned = (g: Game) => g.queue.filter((l) => l.at < 1e8).length + g.raiderQueue.reduce((a, r) => a + r.units.reduce((b, u) => b + u.size, 0), 0);

describe('a campaign run has no encounter layer', () => {
  it('a new game carries none, and its waves are the shared ones', () => {
    const g = createGame('strait', 3, 5);
    expect(g.enc).toBeNull();
    expect(g.queue.some((l) => l.enc)).toBe(false);
  });

  it('nine encounters: three on each reference map, none anywhere else', () => {
    expect(ENCOUNTERS).toHaveLength(9);
    expect(new Set(ENCOUNTERS.map((e) => e.id)).size).toBe(9);
    for (const map of ENCOUNTER_MAPS) expect(ENCOUNTERS.filter((e) => e.map === map), map).toHaveLength(3);
    expect(encountersFor('kesh', 5)).toEqual([]);
    for (const e of ENCOUNTERS) for (const k of ['name', 'premise', 'decision', 'counters', 'succeeds'] as const) expect(e[k].length, `${e.id}.${k}`).toBeGreaterThan(k === 'name' ? 4 : 10);
  });
});

describe('every beat is legal on its map at its wave', () => {
  it('only enemies the map already has by then (never a later chapter\'s), from launchers that carry them', () => {
    for (const e of ENCOUNTERS) {
      const m = MAPS[e.map];
      for (const w of e.waves) {
        expect(w, e.id).toBeGreaterThanOrEqual(1);
        expect(w, e.id).toBeLessThanOrEqual(10);
        const table = WAVE_TABLE[w - 1];
        for (const b of e.beats) {
          const where = `${e.id} wave ${w}: ${b.kind}`;
          // In the shared table by this wave, or one of the map's own extras by this wave.
          const inTable = b.kind === 'drone' || (b.kind === 'ballistic' && table.ballistic > 0) || (b.kind === 'guided' && table.guided > 0);
          const extra = m.extras.some((x) => x.kind === b.kind && x.from <= w);
          const plane = (b.kind === 'strafer' && w >= m.vectors.strafers) || (b.kind === 'bomber' && w >= m.vectors.bombers);
          expect(inTable || extra || plane, where).toBe(true);
          if ('base' in b.from) {
            const base = m.bases[b.from.base];
            expect(base, where).toBeDefined();
            expect(base.kinds, where).toContain(b.kind);
          } else if ('sub' in b.from) {
            expect(w, where).toBeGreaterThanOrEqual(m.vectors.subs);
            expect(['ballistic', 'drone'], where).toContain(b.kind);
            expect(m.subSpots[b.from.sub], where).toBeDefined();
          } else expect(plane, where).toBe(true);
          expect(b.count, where).toBeGreaterThan(0);
          expect(b.at, where).toBeGreaterThanOrEqual(0);
          expect(b.at, where).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('every launcher sits where the map puts it: a base on the map, a submarine on open water', () => {
    for (const e of ENCOUNTERS) {
      const g = createGame(e.map, 1, e.waves[0]);
      for (const b of e.beats) {
        const p = 'base' in b.from ? g.map.bases[b.from.base] : 'sub' in b.from ? g.map.subSpots[b.from.sub] : null;
        if (!p) continue;
        expect(p.x > 0 && p.x < VIEW.width && p.y > 0 && p.y < VIEW.height, e.id).toBe(true);
        if ('sub' in b.from) expect(onLand(g, p.x, p.y), `${e.id}: a submarine on land`).toBe(false);
      }
    }
  });

  it('an encounter takes out of the wave what it sends: a wave with one is no bigger than the shared wave', () => {
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    for (const map of ENCOUNTER_MAPS)
      for (let w = 1; w <= 10; w++) {
        const list = encountersFor(map, w);
        if (!list.length) continue;
        // By the books: what it sends from bases and submarines is covered,
        // launch for launch, by what it takes out (a missile the scaled-down
        // table can't give comes out of the drones). An aircraft stands in
        // for a small drone swarm, as the game's own aircraft do.
        const spec = waveSpec(w, MAPS[map].threatScale);
        for (const e of list) {
          const sent = e.beats.reduce((a, b) => a + ('air' in b.from ? Math.min(5, spec.swarm - 1) * b.count : b.count), 0);
          const asked = (e.replaces.drones ?? 0) + (e.replaces.ballistic ?? 0) + (e.replaces.guided ?? 0);
          expect(sent, `${e.id} wave ${w}: sends ${sent}, takes out ${asked}`).toBeLessThanOrEqual(asked);
          expect(asked, `${e.id} wave ${w}: the wave has that much to give`).toBeLessThanOrEqual(spec.drones + spec.ballistic + spec.guided);
        }
        // And as planned: over eight seeds, no more launches than the shared
        // wave on the same dice, give or take the game's own rounding (a
        // submarine always fires a full salvo, so a missile taken from one
        // is topped back up), and not a hollowed-out wave either.
        const shared = mean(
          seeds.map((seed) => {
            // The same dice with the layer empty: the shared wave this one stands in for.
            const g = createGame(map, seed, w);
            applyEncounters(g, { ...ON, only: [] });
            expect(g.enc!.played).toEqual([]);
            return planned(g);
          }),
        );
        const got = mean(
          seeds.map((seed) => {
            const g = createGame(map, seed, w);
            applyEncounters(g, ON);
            return planned(g);
          }),
        );
        expect(got, `${map} wave ${w}: ${got.toFixed(1)} launches against the shared wave's ${shared.toFixed(1)}`).toBeLessThanOrEqual(shared + 2);
        expect(got, `${map} wave ${w}`).toBeGreaterThanOrEqual(shared * 0.6);
      }
  });
});

describe('every authored launch is warned of', () => {
  it('a base lights up a raid\'s warning before it fires; a submarine shows its periscope; an aircraft its arrow', () => {
    for (const e of ENCOUNTERS) {
      const w = e.waves[e.waves.length - 1];
      const { sc } = wave(e.map, w, true);
      const mine = launches(sc).filter((l) => l.enc === e.id);
      const want = e.beats.reduce((a, b) => a + b.count, 0);
      expect(mine.length, `${e.id}: all its launches came`).toBe(want);
      for (const l of mine) {
        if (l.o === 'base') {
          const warn = sc.events.filter((o): o is Extract<TelEvent, { k: 'warn' }> => o.k === 'warn' && o.what === 'raid' && !!o.bases?.includes(l.base!) && o.t <= l.t);
          const first = Math.max(...warn.map((o) => o.t));
          // Within the raid it belongs to, and that raid was warned of its full time ahead.
          expect(warn.length, `${e.id}: ${l.kind} from base ${l.base} at ${l.t.toFixed(1)} s`).toBeGreaterThan(0);
          expect(warn.some((o) => l.t - o.t >= RAID.warn - 0.1 && l.t - o.t < RAID.warn + 8), `${e.id}: warned ${(l.t - first).toFixed(1)} s ahead`).toBe(true);
        } else if (l.o === 'sub') {
          const up = sc.events.find((o) => o.k === 'rdr' && o.id === l.from && o.st === 'warn');
          expect(up, e.id).toBeDefined();
          expect(l.t - up!.t, e.id).toBeGreaterThanOrEqual(SUB.warn + SUB.surface - 0.05);
        } else {
          const arrow = sc.events.filter((o) => o.k === 'warn' && o.what === 'aircraft' && o.t <= l.t).at(-1);
          expect(arrow, e.id).toBeDefined();
          expect(l.t - arrow!.t, e.id).toBeGreaterThanOrEqual(PLANE.warn - 0.1);
        }
      }
      // The wave says which encounter it carried.
      expect(sc.events.filter((o) => o.k === 'env' && o.what === 'encounter').map((o) => (o as { st: string }).st)).toContain(e.id);
    }
  }, 60_000);
});

describe('each encounter is what it says', () => {
  it('The Strait, ranging shots: two shells from the middle base alone, at the ship furthest along', () => {
    const { sc } = wave('strait', 3, true);
    const mine = launches(sc).filter((l) => l.enc === 'strait-ranging-shots');
    expect(mine.map((l) => [l.kind, l.base])).toEqual([['ballistic', 1], ['ballistic', 1]]);
    expect(mine[1].t - mine[0].t).toBeCloseTo(1.6, 1);
    // Nothing else leaves that base in the two seconds round them: one warning, one place.
    const near = launches(sc).filter((l) => !l.enc && l.base === 1 && Math.abs(l.t - mine[0].t) < 1);
    expect(near).toEqual([]);
    for (const l of mine) expect(l.tg, 'aimed at a ship').toBeGreaterThan(0);
  });

  it('The Strait, the screen: a swarm, then a guided missile from the same pad behind it', () => {
    const { sc } = wave('strait', 6, true);
    const mine = launches(sc).filter((l) => l.enc === 'strait-screen');
    const drones = mine.filter((l) => l.kind === 'drone');
    const missile = mine.find((l) => l.kind === 'guided')!;
    expect(drones).toHaveLength(6);
    expect(new Set(mine.map((l) => l.base))).toEqual(new Set([2]));
    expect(missile.t).toBeGreaterThan(drones[0].t + 1);
    expect(missile.t).toBeLessThan(drones.at(-1)!.t + 1);
  });

  it('The Gauntlet, crossfire: both shores open in the same half second, then a strafing run', () => {
    const { g, sc } = wave('gauntlet', 9, true);
    const mine = launches(sc).filter((l) => l.enc === 'gauntlet-crossfire');
    const north = mine.filter((l) => l.o === 'base' && g.map.bases[l.base!].y < 450);
    const south = mine.filter((l) => l.o === 'base' && g.map.bases[l.base!].y > 450);
    expect(north.length).toBeGreaterThanOrEqual(4);
    expect(south.length).toBeGreaterThanOrEqual(4);
    expect(Math.abs(north[0].t - south[0].t)).toBeLessThan(0.5);
    const jet = mine.find((l) => l.kind === 'strafer')!;
    expect(jet.o).toBe('air');
    expect(jet.t - north[0].t).toBeGreaterThan(2);
  });

  it('Harbor Mouth, funnel salvo: a submarine off the narrows fires its salvo at the ships nearest the mouth', () => {
    const { g, sc } = wave('harbor', 5, true);
    const mine = launches(sc).filter((l) => l.enc === 'harbor-funnel-salvo');
    expect(mine).toHaveLength(4);
    const spot = g.map.subSpots[1];
    for (const l of mine) expect(l).toMatchObject({ o: 'sub', kind: 'ballistic', x: spot.x, y: spot.y });
    const mouth = g.map.channels[0].narrow!.fromX;
    // Each shell's landing point is in the funnel's mouth or just inside it.
    for (const l of mine) expect(l.ix!, `lands at x ${l.ix}`).toBeGreaterThan(mouth - 260);
    for (const l of mine) expect(l.ix!).toBeLessThan(mouth + 420);
  });

  it('Harbor Mouth, open water: waves 1 to 3 aim nothing of the encounter\'s into the narrows', () => {
    const { sc } = wave('harbor', 2, true);
    const mine = launches(sc).filter((l) => l.enc === 'harbor-open-water');
    expect(mine).toHaveLength(5);
    expect(new Set(mine.map((l) => l.base))).toEqual(new Set([0]));
  });
});

describe('the ten-wave arc, and what it leaves alone', () => {
  it('each map: waves 1-3 teach, 4-6 combine, 7-9 escalate, 10 is the climax; no wave is left without its role', () => {
    for (const map of ENCOUNTER_MAPS) {
      const a = arc(map);
      expect(a.map((w) => w.role).join()).toBe('teach,teach,teach,combine,combine,combine,escalate,escalate,escalate,climax');
      // Every wave from the second on carries an encounter; the first is the map alone (Harbor Mouth: its own lesson).
      for (const w of a.slice(1)) expect(w.encounters.length, `${map} wave ${w.wave}`).toBeGreaterThan(0);
      // A wave has at most one encounter: a decision, not a pile.
      for (const w of a) expect(w.encounters.length, `${map} wave ${w.wave}`).toBeLessThanOrEqual(1);
    }
  });

  it('the map\'s own event (runs 1 to 3) and the Siren Field bonus wave play as they do without the layer', () => {
    for (const map of ENCOUNTER_MAPS) for (const w of [11, 12, 13]) expect(encountersFor(map, w)).toEqual([]);
    const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 } };
    // From wave 11: the event's three runs, the same game with the layer on or off.
    const off = playMimic('strait', 201, { ...opts, firstWave: 11 });
    const on = playMimic('strait', 201, { ...opts, firstWave: 11, encounters: ON });
    expect(on.game.eventLog.map((e) => [e.id, e.run, e.outcome])).toEqual(off.game.eventLog.map((e) => [e.id, e.run, e.outcome]));
    expect(on.log.commands).toEqual(off.log.commands);
    expect(on.game.enc!.played).toEqual([]);
    // From wave 6 with two passives: Siren Field still comes after wave 6.
    const bonus = playMimic('strait', 8, { ...opts, firstWave: 6, encounters: ON });
    expect(bonus.game.eventLog[0]).toMatchObject({ id: 'siren-field', kind: 'bonus' });
    expect(bonus.game.enc!.played).toContain('strait-screen');
  }, 60_000);
});

describe('the same thing every time', () => {
  it('a run with encounters is the same game on the same seed, carries the layer in its log, and replays with telemetry on or off', () => {
    for (const map of ENCOUNTER_MAPS) {
      const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 4, encounters: ON };
      const a = playMimic(map, 77, opts);
      const b = playMimic(map, 77, opts);
      expect(b.log.commands, map).toEqual(a.log.commands);
      expect(a.log.encounters).toEqual(ON);
      expect(a.log.v).toBe(LOG_VERSION);
      const ls = lockstep(a.log, 600);
      expect(ls.divergedAt, map).toBe(-1);
      expect(ls.rngSame, map).toBe(true);
      expect(stateHash(replay(a.log)), map).toBe(ls.stateHash);
      expect(reconcile(ls.sidecar, ls.game), map).toEqual([]);
      expect(ls.sidecar.header.encounters).toBe(ENCOUNTER_REV);
      // The encounters played are the ones the arc names for those waves.
      const played = ls.sidecar.events.filter((e) => e.k === 'env' && e.what === 'encounter').map((e) => (e as { st: string }).st);
      expect(played.length, map).toBeGreaterThan(2);
      for (const id of played) expect(ENCOUNTERS.find((e) => e.id === id)!.map).toBe(map);
    }
  }, 90_000);

  it('an encounter is not rolled: its launches leave at the same moments on every seed', () => {
    const at = (seed: number) => launches(wave('gauntlet', 6, true, seed).sc).filter((l) => l.enc).map((l) => [l.kind, l.base, Math.round(l.t * 10)]);
    expect(at(2)).toEqual(at(11));
  });
});
