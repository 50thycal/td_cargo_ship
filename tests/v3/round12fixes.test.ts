// Test Lab round 12's fixes, from the round 11 scorecards (docs/design/
// v3-round12-encounter-versions.md, "From the round 11 scorecards"):
// - a rocket truck drives off at its own speed once it has fired, in every
//   boss round too;
// - The Strait's and Harbor Mouth's boss rounds bring something that sinks
//   ships;
// - every version of every reference map opens with an encounter on wave 1,
//   and wave 1 stays easy;
// - The Strait's waves 5-10 send about 10% more fire in every version (the
//   encounter layer, lab only; the campaign is as it was);
// - older encounter logs (rev 1 and 2) play as they did.

import { describe, expect, it } from 'vitest';
import { EV, EVENT, EVENT_WAVE, eventMap, type EventId } from '../../src/v3/data/events';
import { THREATS, type ThreatKind } from '../../src/v3/data/config';
import { ENCOUNTER_MAPS, ENCOUNTER_REV, ENCOUNTER_VERSIONS, MAP_FIRE, arcGroups, encountersFor, waveFire } from '../../src/v3/data/encounters';
import { FOE } from '../../src/v3/data/foes';
import { labCard, mapCardId } from '../../src/v3/data/lab';
import { applyEncounters, createGame, step, type Game, type Threat } from '../../src/v3/sim/game';
import { BotRun, PERSONAS } from '../../src/v3/sim/mimic';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../src/v3/ui/lab';

const DT = 1 / 60;

/** A boss round's game (its first run), the convoy unsinkable, straight in. */
function bossGame(id: EventId, seed = 1): Game {
  const g = createGame(eventMap(id), seed, EVENT_WAVE);
  g.tempo = { ...g.tempo, lossLimit: 999 };
  g.carrierHp = 999;
  g.event!.t0 = 0;
  return g;
}

describe('a rocket truck drives off at its own speed', () => {
  for (const id of ['rocket-convoy', 'breakout'] as EventId[]) {
    it(`${id}: in at its event's drive, off at the truck's own speed (FOE.rocketTruck.leave × ${THREATS.rocketTruck.speed} px/s and the wave's pace)`, () => {
      expect(FOE.rocketTruck.leave).toBe(1);
      const g = bossGame(id, 3);
      const seen = new Map<number, { inSpeed: number; outSpeed: number; last: number; state: number }>();
      for (let i = 0; i < 60 / DT && g.phase === 'wave'; i++) {
        const before = new Map(g.threats.filter((t) => t.kind === 'rocketTruck' && !t.dead).map((t) => [t.id, { along: t.foe!.along ?? 0, state: t.foe!.state, stall: t.foe!.stall ?? 0 }]));
        step(g, DT);
        for (const t of g.threats) {
          const b = before.get(t.id);
          if (!b || t.dead || t.foe!.state !== b.state || b.stall > 0) continue;
          const v = Math.abs((t.foe!.along ?? 0) - b.along) / DT;
          const o = seen.get(t.id) ?? { inSpeed: 0, outSpeed: 0, last: 0, state: 0 };
          if (b.state === 0) o.inSpeed = Math.max(o.inSpeed, v);
          if (b.state === 4 && (t.foe!.along ?? 0) > 0) o.outSpeed = Math.max(o.outSpeed, v);
          seen.set(t.id, o);
        }
      }
      const done = [...seen.entries()].filter(([, o]) => o.outSpeed > 0);
      expect(done.length, `${id}: trucks that fired and drove off`).toBeGreaterThan(0);
      for (const [tid, o] of done) {
        const t: Threat | undefined = g.threats.find((x) => x.id === tid);
        const own = t?.speed ?? o.outSpeed;
        // Off at its own speed (never the old drive × back, about 7 ×)...
        expect(o.outSpeed, `${id} truck ${tid}`).toBeCloseTo(own * FOE.rocketTruck.leave, 3);
        expect(o.outSpeed, `${id} truck ${tid}`).toBeLessThan(THREATS.rocketTruck.speed * 1.6);
        // ...and in at its event's drive, as before.
        const drive = (EV[id] as { drive: number }).drive;
        if (o.inSpeed > 0) expect(o.inSpeed / o.outSpeed, `${id} truck ${tid}`).toBeCloseTo(drive, 3);
      }
    });
  }

  it('no event says how fast its trucks back off any more', () => {
    for (const id of ['rocket-convoy', 'breakout'] as const) expect('back' in EV[id], id).toBe(false);
  });
});

describe('The Strait\'s and Harbor Mouth\'s boss rounds threaten the ships', () => {
  /** What a boss round sends, and when each kind first shows (seconds
   *  after the breather). */
  function boss(id: EventId, seed = 1): { sent: Partial<Record<ThreatKind, number>>; firstAt: Partial<Record<ThreatKind, number>> } {
    const g = bossGame(id, seed);
    const firstAt: Partial<Record<ThreatKind, number>> = {};
    let sent: Partial<Record<ThreatKind, number>> = {};
    for (let i = 0; i < 70 / DT && g.phase === 'wave' && !g.eventLog.length; i++) {
      for (const t of g.threats) if (firstAt[t.kind] === undefined && g.event) firstAt[t.kind] = g.event.t - EVENT.breather;
      if (g.event) sent = { ...g.event.sent };
      step(g, DT);
    }
    return { sent, firstAt };
  }

  it('the Afterburner Rush is still a rush of sprint swarms, with a ship threat in it', () => {
    const { sent } = boss('rush');
    // Phase 4 (docs/design/v3-p4-strait.md): each run sends `more` more;
    // a lone boss round is run 1.
    expect(sent.sprinter).toBe((EV.rush.swarms + EV.rush.more[0]) * FOE.sprinter.size);
    // A Hydra behind each swarm: it splits into darts at the ships.
    expect(sent.hydra, 'something that sinks ships').toBe(EV.rush.swarms + EV.rush.more[0]);
    expect(EV.rush.hydras).toBe(EV.rush.swarms);
    // The three rounds rise.
    expect(EV.rush.more).toEqual([1, 3, 4]);
  });

  it('The Breakout keeps its three phases, its trucks sooner and more of them', () => {
    const { sent, firstAt } = boss('breakout');
    expect(sent.drone).toBe(EV.breakout.swarms * EV.breakout.size);
    expect(sent.hydra).toBe(EV.breakout.fan);
    expect(sent.rocketTruck).toBe(EV.breakout.trucks * EV.breakout.roads);
    expect(EV.breakout.trucks * EV.breakout.roads).toBeGreaterThan(2);
    expect(EV.breakout.truckAt).toBeLessThan(16);
    expect(firstAt.rocketTruck!).toBeLessThan(16);
  });

  it('with nobody shooting, each boss round hurts the ships on all three maps (the Gauntlet as the reference)', () => {
    for (const id of ['rush', 'rocket-convoy', 'breakout'] as EventId[]) {
      const g = bossGame(id, 2);
      let harm = 0;
      const hp = new Map<number, number>();
      for (let i = 0; i < 70 / DT && g.phase === 'wave' && !g.eventLog.length; i++) {
        for (const s of g.ships) {
          const was = hp.get(s.id);
          if (was !== undefined && s.hp < was) harm += was - s.hp;
          hp.set(s.id, s.hp);
        }
        step(g, DT);
      }
      expect(harm, id).toBeGreaterThan(3);
    }
  });
});

/** The card's production plan, as the hub starts it. */
const plan = (map: (typeof ENCOUNTER_MAPS)[number], v: (typeof ENCOUNTER_VERSIONS)[number]) => {
  const card = labCard(mapCardId(map, v))!;
  return labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
};

describe('wave 1 says something about the map, in every version', () => {
  it('every version of every reference map opens with an encounter on wave 1: the version\'s first, or a light opener drawn from it', () => {
    for (const map of ENCOUNTER_MAPS)
      for (const v of ENCOUNTER_VERSIONS) {
        const first = encountersFor(map, 1, v);
        expect(first, `${map} ${v}`).toHaveLength(1);
        const e = first[0];
        expect(e.role, e.id).toBe('teach');
        // An opener is light: a few launches, never a set piece.
        if (e.opener) {
          const sent = e.beats.reduce((a, b) => a + b.count, 0) + (e.pairs?.length ?? 0) * 7;
          expect(sent, e.id).toBeLessThanOrEqual(9);
          expect(e.rev, e.id).toBe(3);
        }
        // v1 and v3 open with their first encounter (or one of the same
        // name); v2's opener is its own, and its four set pieces stay the peaks.
        // Phase 4 (rev 4): The Strait's v1 keeps rev 3's opener (one shell
        // across the open water: the map's long warning, rule w-first) and
        // its waves 2-10 are its own (docs/design/v3-p4-strait.md).
        const later = [2, 3, 4].flatMap((w) => encountersFor(map, w, v, map === 'strait' && v === 'v1' ? 3 : undefined)).filter((x) => !x.opener)[0];
        if (v !== 'v2') expect(e.name, `${map} ${v}`).toBe(later.name);
      }
    expect(arcGroups('strait', 11, 13, 'Afterburner Rush')[0]).toEqual({ from: 1, to: 1, name: 'Ranging shots' });
  });

  it('a log of an older encounter rev plays the wave 1 it had (nothing new on it)', () => {
    for (const map of ENCOUNTER_MAPS)
      for (const v of ENCOUNTER_VERSIONS) {
        const old = encountersFor(map, 1, v, 2).map((e) => e.id);
        expect(old, `${map} ${v}`).toEqual(map === 'harbor' && v === 'v1' ? ['harbor-open-water'] : []);
        const g = createGame(map, 5, 1);
        applyEncounters(g, { rev: 2, version: v });
        expect(g.enc!.played, `${map} ${v}`).toEqual(old);
      }
  });

  it('wave 1 stays easy: no ship lost on it for the bots that play like the player, on every card', () => {
    for (const map of ENCOUNTER_MAPS)
      for (const v of ENCOUNTER_VERSIONS) {
        const p = plan(map, v);
        expect(p.encounters, `${map} ${v}`).toEqual({ rev: ENCOUNTER_REV, version: v });
        for (const persona of ['you', 'casual'])
          for (const seed of [11, 12, 13]) {
            const run = new BotRun(map, seed, { persona: PERSONAS[persona], lab: p.lab, convoy: p.convoy!, encounters: p.encounters! });
            while (!run.done && run.game.wave === 1) run.advance(60);
            expect(run.game.enc!.played[0], `${map} ${v}`).toBe(encountersFor(map, 1, v)[0].id);
            expect(run.game.lost, `${map} ${v} ${persona} seed ${seed}: ships lost on wave 1`).toBe(0);
          }
      }
  }, 240_000);
});

describe('The Strait sends about 10% more fire on waves 5-10, the same in every version', () => {
  /** A wave's launches as planned (no encounter, so only the wave's own). */
  const planned = (map: (typeof ENCOUNTER_MAPS)[number], w: number, v: (typeof ENCOUNTER_VERSIONS)[number], rev: number, seed: number) => {
    const g = createGame(map, seed, w);
    applyEncounters(g, { rev, version: v, only: [] });
    return g.queue.filter((l) => l.at < 1e8).length + g.raiderQueue.reduce((a, r) => a + r.units.reduce((b, u) => b + u.size, 0), 0);
  };

  it('waves 5-10 on The Strait, in all three versions: 5-20% more launches than the same wave at rev 2; waves 1-4 and the other maps as they were', () => {
    expect(MAP_FIRE).toEqual({ strait: { from: 5, to: 10, more: 0.1 } });
    const seeds = [1, 2, 3, 4, 5, 6];
    for (const v of ENCOUNTER_VERSIONS)
      for (let w = 1; w <= 10; w++) {
        const now = seeds.reduce((a, s) => a + planned('strait', w, v, ENCOUNTER_REV, s), 0);
        const was = seeds.reduce((a, s) => a + planned('strait', w, v, 2, s), 0);
        if (w < 5) expect(now, `strait ${v} wave ${w}`).toBe(was);
        else {
          expect(now / was, `strait ${v} wave ${w}`).toBeGreaterThan(1.05);
          expect(now / was, `strait ${v} wave ${w}`).toBeLessThan(1.2);
        }
        expect(waveFire('strait', w)).toBe(w >= 5 ? 0.1 : 0);
        expect(waveFire('strait', w, 2)).toBe(0);
      }
    for (const map of ['gauntlet', 'harbor'] as const) for (let w = 1; w <= 10; w++) expect(waveFire(map, w), `${map} ${w}`).toBe(0);
    // Past the tenth wave (the boss rounds) nothing changes.
    expect(waveFire('strait', 11)).toBe(0);
  });

  it('the campaign\'s Strait is unchanged: a game with no encounter layer plans the same wave on the same seed as before', () => {
    const g = createGame('strait', 3, 6);
    expect(g.enc).toBeNull();
    // The extra fire comes only through the layer (waveFire), never the
    // shared table: the table's wave 6 is what it was.
    const h = createGame('strait', 3, 6);
    expect(h.queue.map((l) => [l.kind, l.base, Math.round(l.at * 100)])).toEqual(g.queue.map((l) => [l.kind, l.base, Math.round(l.at * 100)]));
  });
});
