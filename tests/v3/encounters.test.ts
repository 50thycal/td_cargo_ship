// Authored encounters for the three reference maps
// (docs/design/v3-map-convoy-lab-plan.md, §7, slice 5). Lab only: a game
// with no encounter layer plays the shared waves as it always has.
//
// What must hold: only enemies the map already has at that wave (or, said
// so, a version's guests: v3's enemy pairs); launchers that exist and sit
// where the map puts them; a wave no bigger than the shared one; a warning
// before every authored launch; the same thing every time; and the map's
// own event and the bonus wave untouched.
//
// Round 12 (docs/design/v3-round12-encounter-versions.md): three versions a
// map: v1 (the original nine, unchanged), v2 "Set pieces", v3 "Enemy pairs".

import { describe, expect, it } from 'vitest';
import { PLANE, RAID, SUB, VIEW } from '../../src/v3/data/config';
import {
  ENCOUNTERS,
  ENCOUNTER_MAPS,
  ENCOUNTER_REV,
  ENCOUNTER_VERSIONS,
  MAP_VERSIONS,
  arc,
  calloutsOn,
  encountersFor,
  versionDef,
  waveScale,
  type Encounter,
  type EncounterVersion,
} from '../../src/v3/data/encounters';
import { HEAVY_FOES, foesUpTo, type FoeId } from '../../src/v3/data/foes';
import { MAPS, chapterOf } from '../../src/v3/data/maps';
import { OLD_THREATS, enemyPair, isOldThreat, memberKind } from '../../src/v3/data/pairs';
import { WAVE_TABLE, waveSpec } from '../../src/v3/data/waves';
import { applyEncounters, createGame, step, type Game } from '../../src/v3/sim/game';
import { isFoe, onLand } from '../../src/v3/sim/foes';
import { lockstep, stateHash } from '../../src/v3/sim/mapLab';
import { PERSONAS, playMimic } from '../../src/v3/sim/mimic';
import { LOG_VERSION, logTelemetry, replay } from '../../src/v3/sim/playlog';
import { reconcile, type TelEvent, type TelemetrySidecar } from '../../src/v3/sim/telemetry';

const DT = 1 / 60;
const ON = { rev: ENCOUNTER_REV };
const VER = (version: EncounterVersion) => ({ rev: ENCOUNTER_REV, version });

/** A wave of a map, with or without its encounters (v1 unless said),
 *  nobody shooting, with telemetry: played to its end (or `seconds`). */
function wave(map: Encounter['map'], n: number, on: boolean, seed = 9, seconds = 90, version: EncounterVersion = 'v1'): { g: Game; sc: TelemetrySidecar } {
  const g = createGame(map, seed, n);
  if (on) applyEncounters(g, VER(version));
  g.tempo = { ...g.tempo, lossLimit: 999 };
  g.carrierHp = 999;
  logTelemetry(g, { id: 'enc-test', build: 'test', v: LOG_VERSION, firstWave: n, device: { w: 0, h: 0, dpr: 1, touch: false, ua: 'test' } }, 'sim', 'none');
  for (let i = 0; i < seconds / DT && g.phase === 'wave' && g.wave === n; i++) step(g, DT);
  return { g, sc: g.tel!.sidecar(g) };
}
const launches = (sc: TelemetrySidecar) => sc.events.filter((e): e is Extract<TelEvent, { k: 'thr+' }> => e.k === 'thr+' && e.pid === undefined && e.o !== 'structure' && !e.back);
/** A beat's launches among an encounter's: not part of an enemy pair (a
 *  pair's swarm is `paired`; its other members are the new enemies). */
const beatLaunch = (l: Extract<TelEvent, { k: 'thr+' }>) => !l.paired && !isFoe(l.kind);

/** An enemy pair's members by the game's own accounting: an original
 *  threat by its size, a new enemy as the drone swarm it stands in for (a
 *  heavy one a missile too), as the wave planner does. */
function pairCost(id: string, swarm: number): number {
  return enemyPair(id)!.members.reduce((a, m) => a + (isOldThreat(m) ? OLD_THREATS[m].size : Math.min(5, swarm - 1) + (HEAVY_FOES.includes(m as FoeId) ? 1 : 0)), 0);
}

/** What a freshly planned wave will send: its queue, its launchers' loads,
 *  and its enemy pairs' sets. `weighed`: a pair's new enemies by the
 *  game's accounting (pairCost) rather than one launch each. */
const planned = (g: Game, weighed = false) =>
  g.queue.filter((l) => l.at < 1e8).length +
  g.raiderQueue.reduce((a, r) => a + r.units.reduce((b, u) => b + u.size, 0), 0) +
  (g.enc?.sets ?? []).reduce(
    (a, s) =>
      a +
      [s.pair!.lead, ...s.pair!.follow.map((f) => f.foe)].reduce(
        (b, m) => b + (isOldThreat(m) ? OLD_THREATS[m].size : weighed ? Math.min(5, waveSpec(g.wave, g.map.threatScale).swarm - 1) + (HEAVY_FOES.includes(m as FoeId) ? 1 : 0) : 1),
        0,
      ),
    0,
  );

describe('a campaign run has no encounter layer', () => {
  it('a new game carries none, and its waves are the shared ones', () => {
    const g = createGame('strait', 3, 5);
    expect(g.enc).toBeNull();
    expect(g.queue.some((l) => l.enc)).toBe(false);
  });

  it('three versions on each reference map, none anywhere else: v1\'s nine unchanged, v2 four set pieces, v3 an encounter in most waves', () => {
    expect(new Set(ENCOUNTERS.map((e) => e.id)).size).toBe(ENCOUNTERS.length);
    expect(ENCOUNTER_VERSIONS).toEqual(['v1', 'v2', 'v3']);
    for (const map of ENCOUNTER_MAPS) {
      const of = (v: EncounterVersion) => ENCOUNTERS.filter((e) => e.map === map && e.version === v);
      // Rev 3 (round 12's fixes): wave 1's opener on top (Harbor Mouth's v1
      // already opens with its first encounter).
      const big = (v: EncounterVersion) => of(v).filter((e) => !e.opener);
      expect(big('v1'), map).toHaveLength(3);
      expect(big('v2'), map).toHaveLength(4);
      expect(big('v3').length, map).toBeGreaterThanOrEqual(7);
      for (const v of ENCOUNTER_VERSIONS) expect(of(v).filter((e) => e.opener), `${map} ${v}`).toHaveLength(map === 'harbor' && v === 'v1' ? 0 : 1);
      for (const v of ENCOUNTER_VERSIONS) {
        const d = versionDef(map, v)!;
        expect(d.name.length, `${map} ${v}`).toBeGreaterThan(4);
        expect(d.idea.length, `${map} ${v}`).toBeGreaterThan(30);
      }
    }
    expect(ENCOUNTERS.filter((e) => e.version === 'v1' && !e.opener).map((e) => e.id)).toEqual([
      'strait-ranging-shots', 'strait-screen', 'strait-rolling-push',
      'gauntlet-north-then-south', 'gauntlet-overlap', 'gauntlet-crossfire',
      'harbor-open-water', 'harbor-funnel-salvo', 'harbor-last-mile',
    ]);
    expect(encountersFor('kesh', 5)).toEqual([]);
    expect(encountersFor('kesh', 5, 'v2')).toEqual([]);
    for (const e of ENCOUNTERS) for (const k of ['name', 'premise', 'decision', 'counters', 'succeeds', 'callout'] as const) expect(e[k].length, `${e.id}.${k}`).toBeGreaterThan(k === 'name' ? 4 : 10);
    // The call-out is short: it sits in a corner card on a phone.
    for (const e of ENCOUNTERS) expect(e.callout.length, e.id).toBeLessThanOrEqual(42);
  });

  it('v1 is the original: no wave budget of its own, no call-outs, no pairs', () => {
    for (const map of ENCOUNTER_MAPS) {
      expect(versionDef(map, 'v1')!.scale, map).toBeUndefined();
      expect(versionDef(map, 'v1')!.callouts, map).toBe(false);
      for (let w = 1; w <= 10; w++) expect(waveScale(map, 'v1', w)).toBe(1);
    }
    for (const e of ENCOUNTERS.filter((x) => x.version === 'v1')) expect(e.pairs, e.id).toBeUndefined();
  });
});

describe('every beat is legal on its map at its wave', () => {
  it('only enemies the map already has by then (never a later chapter\'s), from launchers that carry them', () => {
    for (const e of ENCOUNTERS) {
      const m = MAPS[e.map];
      for (const w0 of e.waves) {
        expect(w0, e.id).toBeGreaterThanOrEqual(1);
        expect(w0, e.id).toBeLessThanOrEqual(10);
        // Wave 1's opener (rev 3) may preview what the map has by wave 2
        // (the first shell, the first periscope), never anything later.
        const w = e.opener ? (expect(w0, e.id).toBe(1), 2) : w0;
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

  it('an enemy pair is one of the pairs, each member the map\'s own by its chapter or a guest its version names', () => {
    for (const e of ENCOUNTERS) {
      if (!e.pairs) continue;
      expect(e.version, e.id).toBe('v3');
      const guests = versionDef(e.map, e.version)!.guests ?? [];
      const own = foesUpTo(chapterOf(e.map));
      for (const p of e.pairs) {
        const pair = enemyPair(p.pair);
        expect(pair, `${e.id}: ${p.pair}`).toBeDefined();
        for (const m of pair!.members) if (!isOldThreat(m)) expect(own.includes(m) || guests.includes(m), `${e.id}: ${m} is neither the map's nor a guest`).toBe(true);
        if (p.base !== undefined) {
          const base = MAPS[e.map].bases[p.base];
          expect(base, e.id).toBeDefined();
          expect(base.kinds.length, `${e.id}: base ${p.base} launches`).toBeGreaterThan(0);
        }
        expect(p.at, e.id).toBeGreaterThanOrEqual(0);
        expect(p.at, e.id).toBeLessThanOrEqual(1);
      }
    }
    // Every guest is used by one of its version's pairs, and none is one the map has anyway.
    for (const map of ENCOUNTER_MAPS) {
      const d = versionDef(map, 'v3')!;
      const used = new Set(ENCOUNTERS.filter((e) => e.map === map && e.version === 'v3').flatMap((e) => (e.pairs ?? []).flatMap((p) => enemyPair(p.pair)!.members)));
      for (const gst of d.guests ?? []) {
        expect(used.has(gst), `${map}: guest ${gst} unused`).toBe(true);
        expect(foesUpTo(chapterOf(map)), `${map}: ${gst} is no guest`).not.toContain(gst);
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
    for (const version of ENCOUNTER_VERSIONS)
      for (const map of ENCOUNTER_MAPS)
        for (let w = 1; w <= 10; w++) {
          const list = encountersFor(map, w, version);
          if (!list.length) continue;
          // By the books: what it sends from bases and submarines is covered,
          // launch for launch, by what it takes out (a missile the scaled-down
          // table can't give comes out of the drones). An aircraft stands in
          // for a small drone swarm, as the game's own aircraft do; an enemy
          // pair's new enemies as the game's own new enemies do.
          const spec = waveSpec(w, MAPS[map].threatScale);
          for (const e of list) {
            const sent = e.beats.reduce((a, b) => a + ('air' in b.from ? Math.min(5, spec.swarm - 1) * b.count : b.count), 0) + (e.pairs ?? []).reduce((a, p) => a + (p.count ?? 1) * pairCost(p.pair, spec.swarm), 0);
            const asked = (e.replaces.drones ?? 0) + (e.replaces.ballistic ?? 0) + (e.replaces.guided ?? 0);
            expect(sent, `${e.id} wave ${w}: sends ${sent}, takes out ${asked}`).toBeLessThanOrEqual(asked);
            expect(asked, `${e.id} wave ${w}: the wave has that much to give`).toBeLessThanOrEqual(spec.drones + spec.ballistic + spec.guided);
          }
          // And as planned: over eight seeds, no more launches than the same
          // version's wave with no encounter on the same dice, give or take
          // the game's own rounding (a submarine always fires a full salvo,
          // so a missile taken from one is topped back up), and not a
          // hollowed-out wave either (an enemy pair's new enemies weighed as
          // the game weighs them: a few launches that each fire many times).
          const shared = mean(
            seeds.map((seed) => {
              const g = createGame(map, seed, w);
              applyEncounters(g, { ...VER(version), only: [] });
              expect(g.enc!.played).toEqual([]);
              return planned(g);
            }),
          );
          const games = seeds.map((seed) => {
            const g = createGame(map, seed, w);
            applyEncounters(g, VER(version));
            return g;
          });
          const got = mean(games.map((g) => planned(g)));
          const weight = mean(games.map((g) => planned(g, true)));
          expect(got, `${map} ${version} wave ${w}: ${got.toFixed(1)} launches against the shared wave's ${shared.toFixed(1)}`).toBeLessThanOrEqual(shared + 2);
          expect(weight, `${map} ${version} wave ${w}`).toBeGreaterThanOrEqual(shared * 0.6);
        }
  });

  it('a version\'s wave budget moves fire between its waves, never adds to the ten', () => {
    for (const map of ENCOUNTER_MAPS)
      for (const v of ENCOUNTER_VERSIONS) {
        const scale = Array.from({ length: 10 }, (_, k) => waveScale(map, v, k + 1));
        const total = scale.reduce((a, b) => a + b, 0);
        expect(total, `${map} ${v}`).toBeLessThanOrEqual(10);
        for (const s of scale) {
          expect(s, `${map} ${v}`).toBeGreaterThanOrEqual(0.6);
          expect(s, `${map} ${v}`).toBeLessThanOrEqual(1.25);
        }
        // Past the tenth wave (the boss rounds, endless) nothing is scaled.
        expect(waveScale(map, v, 11)).toBe(1);
      }
    // A quiet v2 wave plans fewer launches than the same wave in v1 on the same dice.
    const g1 = createGame('strait', 4, 4);
    applyEncounters(g1, { ...VER('v1'), only: [] });
    const g2 = createGame('strait', 4, 4);
    applyEncounters(g2, VER('v2'));
    expect(encountersFor('strait', 4, 'v2')).toEqual([]);
    expect(planned(g2)).toBeLessThan(planned(g1));
  });
});

describe('every authored launch is warned of', () => {
  it('a base lights up a raid\'s warning before it fires; a submarine shows its periscope; an aircraft its arrow', () => {
    for (const e of ENCOUNTERS) {
      const w = e.waves[e.waves.length - 1];
      const { sc } = wave(e.map, w, true, 9, 90, e.version);
      const mine = launches(sc).filter((l) => l.enc === e.id && beatLaunch(l));
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
  }, 120_000);

  it('an enemy pair comes whole, its members tagged with the encounter, and a lead out of a named base lights it first', () => {
    for (const e of ENCOUNTERS.filter((x) => x.pairs)) {
      const w = e.waves[e.waves.length - 1];
      const { sc } = wave(e.map, w, true, 9, 120, e.version);
      const mine = sc.events.filter((l): l is Extract<TelEvent, { k: 'thr+' }> => l.k === 'thr+' && l.enc === e.id);
      for (const p of e.pairs!) {
        const pair = enemyPair(p.pair)!;
        for (const m of pair.members) {
          const kind = memberKind(m);
          // A Bodyguard Ring's guards; a sub comes up from its periscope.
          expect(mine.some((l) => l.kind === kind || (kind === 'guard' && l.kind === 'guard')), `${e.id}: ${m} came, tagged`).toBe(true);
        }
        if (p.base !== undefined) {
          // (Another pair's swarm may leave the same base: one of these is the lead.)
          const leads = mine.filter((l) => l.kind === memberKind(pair.pair.lead) && l.base === p.base);
          expect(leads.length, `${e.id}: its lead from base ${p.base}`).toBeGreaterThan(0);
          const warned = leads.some((lead) => sc.events.some((o) => o.k === 'warn' && o.what === 'raid' && !!o.bases?.includes(p.base!) && lead.t - o.t >= RAID.warn - 0.1 && lead.t - o.t < RAID.warn + 1));
          expect(warned, `${e.id}: base ${p.base} lit ${RAID.warn} s before its lead`).toBe(true);
        }
      }
    }
  }, 120_000);
});

describe('call-outs (round 12)', () => {
  it('v2 names each encounter as its first warning shows; v1 and v3 only when a run asks', () => {
    for (const map of ENCOUNTER_MAPS) {
      expect(calloutsOn(map, VER('v2')), map).toBe(true);
      expect(calloutsOn(map, VER('v1')), map).toBe(false);
      expect(calloutsOn(map, VER('v3')), map).toBe(false);
      expect(calloutsOn(map, { ...VER('v1'), callouts: true }), map).toBe(true);
      expect(calloutsOn(map, { ...VER('v2'), callouts: false }), map).toBe(false);
    }
    const calls = (map: Encounter['map'], n: number, setup: Parameters<typeof applyEncounters>[1]) => {
      const g = createGame(map, 9, n);
      applyEncounters(g, setup);
      g.tempo = { ...g.tempo, lossLimit: 999 };
      g.carrierHp = 999;
      const seen: { id: string; t: number }[] = [];
      for (let i = 0; i < 90 / DT && g.phase === 'wave' && g.wave === n; i++) {
        step(g, DT);
        for (const ev of g.events) if (ev.kind === 'encounter') seen.push({ id: ev.id, t: g.waveT });
        g.events.length = 0;
      }
      return { g, seen };
    };
    for (const e of ENCOUNTERS.filter((x) => x.version === 'v2')) {
      const w = e.waves[0];
      const { g, seen } = calls(e.map, w, VER('v2'));
      expect(seen.map((s) => s.id), e.id).toEqual([e.id]);
      // At its first warning: a raid's lit bases, a periscope, an arrow.
      const firstLaunch = Math.min(...g.raids.filter((r) => r.bases.length).map((r) => r.at));
      expect(seen[0].t, e.id).toBeLessThan(firstLaunch + 60);
    }
    // v1 says nothing; v1 with call-outs asked for names its encounter.
    expect(calls('strait', 6, VER('v1')).seen).toEqual([]);
    expect(calls('strait', 6, { ...VER('v1'), callouts: true }).seen.map((s) => s.id)).toEqual(['strait-screen']);
  }, 60_000);

  it('the call-out comes as the warning starts: a raid\'s warning time before the set piece\'s first launch', () => {
    const g = createGame('gauntlet', 9, 3);
    applyEncounters(g, VER('v2'));
    const c = g.enc!.calls[0];
    expect(c.id).toBe('gauntlet-v2-pincer');
    const first = Math.min(...g.queue.filter((l) => l.enc === 'gauntlet-v2-pincer').map((l) => l.at));
    expect(first - c.at).toBeCloseTo(RAID.warn, 5);
  });
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
  it('each map (v1): waves 1-3 teach, 4-6 combine, 7-9 escalate, 10 is the climax; no wave is left without its role', () => {
    for (const map of ENCOUNTER_MAPS) {
      const a = arc(map);
      expect(a.map((w) => w.role).join()).toBe('teach,teach,teach,combine,combine,combine,escalate,escalate,escalate,climax');
      // Every wave carries an encounter (rev 3: wave 1 too, its opener, or Harbor Mouth's own lesson).
      for (const w of a) expect(w.encounters.length, `${map} wave ${w.wave}`).toBeGreaterThan(0);
      // A wave has at most one encounter: a decision, not a pile.
      for (const w of a) expect(w.encounters.length, `${map} wave ${w.wave}`).toBeLessThanOrEqual(1);
    }
  });

  it('v2, set pieces: four, one a wave, with a quiet wave between any two; each set piece wave has more of the budget than the quiet ones', () => {
    for (const map of ENCOUNTER_MAPS) {
      const a = arc(map, 'v2');
      // Wave 1's opener (rev 3) is a small call-out, not a set piece.
      const on = a.filter((w) => w.encounters.some((e) => !e.opener)).map((w) => w.wave);
      expect(a[0].encounters.map((e) => e.opener), map).toEqual([true]);
      expect(on, map).toHaveLength(4);
      for (const w of a) expect(w.encounters.length, `${map} wave ${w.wave}`).toBeLessThanOrEqual(1);
      for (let k = 1; k < on.length; k++) expect(on[k] - on[k - 1], `${map}: set pieces ${on[k - 1]} and ${on[k]}`).toBeGreaterThanOrEqual(2);
      // Teach, combine, escalate, climax in that order; the climax on wave 10.
      expect(on.map((w) => encountersFor(map, w, 'v2')[0].role)).toEqual(['teach', 'combine', 'escalate', 'climax']);
      expect(on[3]).toBe(10);
      // Each one a big moment: two beats or more, or a salvo of five or more.
      for (const w of on) {
        const e = encountersFor(map, w, 'v2')[0];
        expect(e.beats.length >= 2 || e.beats.reduce((x, b) => x + b.count, 0) >= 5, e.id).toBe(true);
      }
      const quiet = a.filter((w) => !w.encounters.some((e) => !e.opener) && w.wave > 1).map((w) => waveScale(map, 'v2', w.wave));
      expect(Math.max(...quiet), map).toBeLessThanOrEqual(1.15);
    }
  });

  it('v3, enemy pairs: an encounter in most waves, each built on a pair; a pair is taught alone before it is combined, and two overlap only once both are known', () => {
    for (const map of ENCOUNTER_MAPS) {
      const a = arc(map, 'v3');
      expect(a.filter((w) => w.encounters.length).length, map).toBeGreaterThanOrEqual(8);
      const known = new Set<string>();
      for (const w of a) {
        expect(w.encounters.length, `${map} wave ${w.wave}`).toBeLessThanOrEqual(1);
        const e = w.encounters[0];
        if (!e) continue;
        expect(e.pairs?.length, e.id).toBeGreaterThan(0);
        const ids = e.pairs!.map((p) => p.pair);
        const fresh = ids.filter((id) => !known.has(id));
        if (fresh.length) {
          // A new pair comes on its own, in a teach wave.
          expect(e.role, `${e.id} brings ${fresh.join()} new`).toBe('teach');
          expect(ids, e.id).toHaveLength(1);
        }
        for (const id of ids) known.add(id);
      }
      expect(known.size, map).toBe(3);
    }
  });

  it('the map\'s own event (runs 1 to 3) and the Siren Field bonus wave play as they do without the layer', () => {
    for (const map of ENCOUNTER_MAPS) for (const v of ENCOUNTER_VERSIONS) for (const w of [11, 12, 13]) expect(encountersFor(map, w, v)).toEqual([]);
    const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 } };
    // From wave 11: the event's three runs, the same game with the layer on or off.
    const off = playMimic('strait', 201, { ...opts, firstWave: 11 });
    for (const v of ENCOUNTER_VERSIONS) {
      const on = playMimic('strait', 201, { ...opts, firstWave: 11, encounters: VER(v) });
      expect(on.game.eventLog.map((e) => [e.id, e.run, e.outcome]), v).toEqual(off.game.eventLog.map((e) => [e.id, e.run, e.outcome]));
      expect(on.log.commands, v).toEqual(off.log.commands);
      expect(on.game.enc!.played, v).toEqual([]);
    }
    // From wave 6 with two passives: Siren Field still comes after wave 6.
    const bonus = playMimic('strait', 8, { ...opts, firstWave: 6, encounters: ON });
    expect(bonus.game.eventLog[0]).toMatchObject({ id: 'siren-field', kind: 'bonus' });
    expect(bonus.game.enc!.played).toContain('strait-screen');
  }, 90_000);
});

describe('the same thing every time', () => {
  it('a run with encounters is the same game on the same seed, carries the layer in its log, and replays with telemetry on or off', () => {
    for (const map of ENCOUNTER_MAPS)
      for (const v of ENCOUNTER_VERSIONS) {
        const setup = VER(v);
        const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 4, encounters: setup };
        const a = playMimic(map, 77, opts);
        const b = playMimic(map, 77, opts);
        expect(b.log.commands, `${map} ${v}`).toEqual(a.log.commands);
        expect(a.log.encounters).toEqual(setup);
        expect(a.log.v).toBe(LOG_VERSION);
        const ls = lockstep(a.log, 600);
        expect(ls.divergedAt, `${map} ${v}`).toBe(-1);
        expect(ls.rngSame, `${map} ${v}`).toBe(true);
        expect(stateHash(replay(a.log)), `${map} ${v}`).toBe(ls.stateHash);
        expect(reconcile(ls.sidecar, ls.game), `${map} ${v}`).toEqual([]);
        expect(ls.sidecar.header.encounters).toBe(ENCOUNTER_REV);
        // The encounters played are the version's own, on this map.
        const played = ls.sidecar.events.filter((e) => e.k === 'env' && e.what === 'encounter').map((e) => (e as { st: string }).st);
        expect(played.length, `${map} ${v}`).toBeGreaterThan(1);
        for (const id of played) expect(ENCOUNTERS.find((e) => e.id === id)!).toMatchObject({ map, version: v });
      }
  }, 240_000);

  it('a log from before the versions (rev 1, no version) plays v1', () => {
    const a = playMimic('harbor', 31, { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 4, encounters: { rev: 1 } });
    const b = playMimic('harbor', 31, { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 4, encounters: VER('v1') });
    expect(a.game.enc!.played).toEqual(b.game.enc!.played);
    expect(a.log.commands).toEqual(b.log.commands);
    expect(a.game.enc!.played[0]).toBe('harbor-funnel-salvo');
  }, 60_000);

  it('an encounter is not rolled: its launches leave at the same moments on every seed', () => {
    const at = (seed: number) => launches(wave('gauntlet', 6, true, seed).sc).filter((l) => l.enc).map((l) => [l.kind, l.base, Math.round(l.t * 10)]);
    expect(at(2)).toEqual(at(11));
    const at2 = (seed: number) => launches(wave('harbor', 7, true, seed, 90, 'v2').sc).filter((l) => l.enc).map((l) => [l.kind, Math.round(l.t * 10)]);
    expect(at2(2)).toEqual(at2(11));
  });
});

// Kept for the type: every version is a map's.
void MAP_VERSIONS;
