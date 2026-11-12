// Special event attacks (docs/design/v3-special-events-build.md): the event
// after the ten waves on every map (round 7: three runs, waves 11 to 13),
// what each event sends, its rules, its grading, the Test Lab's event cards,
// and the play log. Round 7's own tests are in eventsRound7.test.ts.

import { describe, expect, it } from 'vitest';
import { RULES, VIEW, type ThreatKind } from '../../src/v3/data/config';
import { ENDING, EVENT, EVENTS, EVENT_MAPS, EVENT_ORDER, EVENT_WAVE, RULE_TEXT, bonusDef, campaignWaves, eventMap, gradeEvent, type EventId } from '../../src/v3/data/events';
import { FOES, FOES_BUILT } from '../../src/v3/data/foes';
import { MAP_ORDER, chapterOf } from '../../src/v3/data/maps';
import { LAB_CARDS, LAB_CHANGES, LAB_EVENT_RUNS, LAB_ROUNDS, LAB_SECTIONS, cardRev, labCard } from '../../src/v3/data/lab';
import { draftPool } from '../../src/v3/data/roster';
import { canTake } from '../../src/v3/data/abilities';
import { applyFreePlay, applyLab, createGame, labBring, pickUpgrade, step, type Game } from '../../src/v3/sim/game';
import { eventDropWeights, eventFor, hasRule, hydraDarts, lastWave, startBonus } from '../../src/v3/sim/events';
import { lureIn } from '../../src/v3/sim/foes';
import { labDone } from '../../src/v3/sim/lab';
import { evidenceLines } from '../../src/v3/sim/lab';
import { Recorder, replay, LOG_VERSION } from '../../src/v3/sim/playlog';
import { labResultDocs } from '../../src/v3/sim/labDocs';
import { Bot, SKILLS } from '../../src/v3/sim/bot';

const DT = 1 / 60;

/** Step until `done` (or `seconds` run out, or the game stops). */
function run(g: Game, seconds: number, done: () => boolean = () => false): void {
  for (let i = 0; i < seconds / DT && g.phase === 'wave' && !done(); i++) step(g, DT);
}

/** An event's game at its wave (a bonus event: after its wave, started as
 *  the campaign starts it), with the convoy unsinkable so the whole script
 *  runs whatever it does. */
function eventGame(id: EventId, seed = 1): Game {
  const bonus = bonusDef(id);
  const g = createGame(eventMap(id), seed, bonus ? bonus.after + 1 : EVENT_WAVE);
  if (bonus) {
    g.wave = bonus.after;
    startBonus(g, id);
  }
  g.tempo = { ...g.tempo, lossLimit: 999 };
  g.carrierHp = 999;
  // Straight in, without waiting for the convoy to sail in.
  g.event!.t0 = 0;
  return g;
}

/** Everything the script sends (its record), run to its end. */
function sentBy(id: EventId, seed = 1): { g: Game; sent: Partial<Record<ThreatKind, number>>; seen: Set<ThreatKind> } {
  const g = eventGame(id, seed);
  const seen = new Set<ThreatKind>();
  let sent: Partial<Record<ThreatKind, number>> = {};
  for (let i = 0; i < 90 / DT && g.phase === 'wave' && !g.eventLog.length; i++) {
    for (const t of g.threats) seen.add(t.kind);
    if (g.event) sent = { ...g.event.sent };
    if (g.event?.done && g.event.t > EVENT.breather + 4) break;
    step(g, DT);
  }
  return { g, sent, seen };
}

describe('the table: an event for every map, built on its debut enemy', () => {
  it('twenty map events, each on its own map, built on its debut enemy (a finale: its chapter\'s new enemies); one bonus event', () => {
    const maps = EVENT_ORDER.filter((id) => EVENTS[id].kind === 'map');
    expect(maps).toHaveLength(20);
    expect(EVENT_ORDER.filter((id) => EVENTS[id].kind === 'bonus')).toEqual(['siren-field']);
    for (const id of maps) {
      const map = eventMap(id);
      expect(EVENT_MAPS[map]).toBe(id);
      const g = createGame(map, 1);
      const finale = ['breakout', 'run-the-canal', 'siege-of-vey'].includes(id);
      // The map's debut (the foe it leads with) is the event's enemy; a
      // finale brings its chapter's four.
      // (Round 8 took the scavengers out of Run the Canal: "way too much
      // going on".)
      if (!finale) expect(g.foe.lead[g.foe.cursor % g.foe.lead.length], id).toBe(EVENTS[id].foe);
      else expect([EVENTS[id].foe, ...EVENTS[id].also!].sort(), id).toEqual(FOES_BUILT.filter((f) => FOES[f].chapter === chapterOf(map) && !(id === 'run-the-canal' && f === 'scavenger')).sort());
      expect(FOES[EVENTS[id].foe].chapter, id).toBe(chapterOf(map));
    }
  });

  it('every one of the twenty maps has its own event (round 7: the finales; round 8: Beacon Strike on Dunmar Crossing)', () => {
    expect(MAP_ORDER.filter((m) => !EVENT_MAPS[m])).toEqual([]);
    expect(new Set(MAP_ORDER.map((m) => EVENT_MAPS[m])).size).toBe(20);
    expect(EVENT_MAPS.harbor).toBe('breakout');
    expect(EVENT_MAPS.saltgate).toBe('run-the-canal');
    expect(EVENT_MAPS.citadel).toBe('siege-of-vey');
    expect(EVENT_MAPS.crossing).toBe('beacon-strike');
  });

  it('the card says the event and its rules, never how to beat it', () => {
    for (const id of EVENT_ORDER) {
      const words = [EVENTS[id].name, EVENTS[id].look, ...EVENTS[id].rules.map((r) => RULE_TEXT[r])].join(' ').toLowerCase();
      for (const tell of ['how you beat', 'to beat it', 'kill them', 'shoot the', 'first, then', 'save the', 'hold fire', 'wait for']) expect(words, `${id}: ${tell}`).not.toContain(tell);
    }
    expect(EVENTS['decoy-storm'].rules.map((r) => RULE_TEXT[r])).toEqual(['No ammo drops']);
    expect(EVENTS.blackout.rules.map((r) => RULE_TEXT[r])).toContain('Night');
  });
});

describe('the event after the ten waves as they were (round 7: three runs)', () => {
  it('every map has 13 waves: its ten and three runs of its event (11 with the experiment off)', () => {
    for (const m of MAP_ORDER) expect(campaignWaves(m), m).toBe(13);
    expect(lastWave(createGame('kesh', 1))).toBe(13);
    expect(lastWave(createGame('harbor', 1))).toBe(13);
    ENDING.threeRuns = false;
    try {
      for (const m of MAP_ORDER) expect(campaignWaves(m), m).toBe(11);
      expect(lastWave(createGame('kesh', 1))).toBe(11);
    } finally {
      ENDING.threeRuns = true;
    }
  });

  it('waves 1 to 10 plan as before (no event); wave 11 is the event and replaces the raid planner', () => {
    const g = createGame('kesh', 4, 10);
    expect(g.event).toBeNull();
    expect(g.raids.length).toBeGreaterThan(0);
    const e = createGame('kesh', 4, 11);
    expect(e.event?.id).toBe('decoy-storm');
    expect(e.raids).toEqual([]);
    expect(e.events.some((ev) => ev.kind === 'special' && ev.id === 'decoy-storm' && ev.wave === 11)).toBe(true);
  });

  it('clearing wave 10 goes on to a draft, then the event; clearing its three runs wins the map', () => {
    const g = createGame('strait', 5, 10);
    g.queue = [];
    g.raiderQueue = [];
    g.threats = [];
    step(g, DT);
    expect(g.phase).toBe('draft');
    expect(g.cleared).toBe(false);
    pickUpgrade(g, g.offer.find((id) => id === 'resupply' || canTake(g.levels, id))!);
    expect(g.phase).toBe('wave');
    expect(g.wave).toBe(11);
    expect(g.event?.id).toBe('rush');
    const w = createGame('strait', 5, 11);
    w.tempo = { ...w.tempo, lossLimit: 999 };
    w.carrierHp = 999;
    run(w, 300);
    expect(w.phase).toBe('won');
    expect(w.cleared).toBe(true);
    expect(w.wave).toBe(13);
    expect(w.eventLog.map((e) => `${e.id} ${e.run}/${e.runs}`)).toEqual(['rush 1/3', 'rush 2/3', 'rush 3/3']);
  });

  it('with the experiment off, clearing wave 11 wins the map as before', () => {
    ENDING.threeRuns = false;
    try {
      const w = createGame('strait', 5, 11);
      w.tempo = { ...w.tempo, lossLimit: 999 };
      w.carrierHp = 999;
      run(w, 120);
      expect(w.phase).toBe('won');
      expect(w.wave).toBe(11);
      expect(w.eventLog.map((e) => e.id)).toEqual(['rush']);
      expect(w.eventLog[0].runs).toBeUndefined();
    } finally {
      ENDING.threeRuns = true;
    }
  });

  it('a sharp bot plays a whole campaign map through its event', () => {
    const g = createGame('kesh', 7);
    const bot = new Bot(SKILLS.sharp, 7);
    for (let i = 0; i < 60 * 60 * 20 && g.phase !== 'won' && g.phase !== 'lost'; i++) {
      bot.act(g);
      step(g, 1 / 30);
    }
    const ending = g.eventLog.filter((e) => e.kind !== 'bonus');
    if (g.phase === 'won') {
      expect(g.wave).toBe(13);
      expect(ending).toHaveLength(3);
      for (const e of ending) expect(['clean', 'held', 'broken']).toContain(e.outcome);
    } else expect(g.wave).toBeLessThanOrEqual(13);
  });

  it('Free Play has no events (not in this build): ten waves', () => {
    const g = createGame('kesh', 1);
    applyFreePlay(g, { weapons: [], frequentDrops: false });
    expect(eventFor(g)).toBeNull();
    expect(lastWave(g)).toBe(10);
  });
});

describe('each event sends what it should', () => {
  const expectSent: Record<EventId, Partial<Record<ThreatKind, number>>> = {
    rush: { sprinter: 24 },
    'decoy-storm': { decoy: 40, drone: 20 },
    'hydra-bloom': { hydra: 6 },
    'rocket-convoy': { rocketTruck: 8 },
    'gunship-wall': { attackHeli: 4 },
    'wolf-pack': { torpedoSub: 7 },
    'shield-wall': { armored: 12 },
    'supply-raid': { scavenger: 6 },
    blackout: { stealthJet: 8 },
    'carpet-run': { stealthBomber: 6 },
    'dive-circus': { diveBomber: 8, guided: 6 },
    bombardment: { siege: 3, drone: 16 },
    'fire-mission': { spotter: 6, drone: 15 },
    'repair-yard': { mothership: 1, tender: 3 },
    'escort-run': { heavy: 1, guard: 12 },
    'siren-field': { lure: 5 },
    firestorm: { cloud: 9 },
    // Round 7: the finales; round 8: Beacon Strike.
    breakout: { decoy: 9, sprinter: 4, hydra: 3, rocketTruck: 2 },
    'run-the-canal': { torpedoSub: 2, attackHeli: 1, armored: 4 },
    'beacon-strike': { lure: 4 },
    'siege-of-vey': { mothership: 1, tender: 3, heavy: 1, guard: 7, lure: 2, cloud: 5 },
  };
  for (const id of EVENT_ORDER) {
    it(`${EVENTS[id].name}: its debut enemy, as many as the script says`, () => {
      const { sent, seen } = sentBy(id);
      for (const [k, n] of Object.entries(expectSent[id])) expect(sent[k as ThreatKind], `${id} ${k}`).toBe(n);
      expect(seen.has(FOES[EVENTS[id].foe].kind) || id === 'wolf-pack' || id === 'bombardment' || id === 'dive-circus', id).toBe(true);
    });
  }

  it('the Rocket Convoy drives a column down each shore road, each truck stopping behind the one ahead and raising after it', () => {
    const g = eventGame('rocket-convoy', 2);
    run(g, EVENT.breather + 6);
    const all = g.threats.filter((t) => t.kind === 'rocketTruck');
    expect(all).toHaveLength(8);
    const roads = [...new Set(all.map((t) => t.foe!.path))];
    // Round 6: two columns, one on each of the Gauntlet's shore roads.
    expect(roads).toHaveLength(2);
    expect(roads).toEqual(expect.arrayContaining(g.map.roads.runners));
    for (const road of roads) {
      const col = all.filter((t) => t.foe!.path === road).sort((a, b) => (b.foe!.stop ?? 0) - (a.foe!.stop ?? 0));
      expect(col).toHaveLength(4);
      for (let k = 1; k < col.length; k++) expect(col[k].foe!.stop!).toBeLessThan(col[k - 1].foe!.stop!);
    }
  });

  it('the Gunship Wall holds a line and fires in turn, left to right', () => {
    const g = eventGame('gunship-wall', 3);
    const fired: number[] = [];
    for (let i = 0; i < 20 / DT; i++) {
      step(g, DT);
      for (const t of g.threats) if (t.kind === 'attackHeli' && t.foe!.n > 0 && !fired.includes(t.id)) fired.push(t.id);
    }
    const helis = g.threats.filter((t) => t.kind === 'attackHeli');
    const byX = [...helis].sort((a, b) => a.foe!.px - b.foe!.px).map((t) => t.id);
    expect(fired.slice(0, byX.length)).toEqual(byX);
  });

  it('the Shield Wall flies as one block and banks together at its signal', () => {
    const g = eventGame('shield-wall', 2);
    run(g, 30, () => (g.event?.signals ?? 0) > 0);
    const block = g.threats.filter((t) => t.kind === 'armored');
    expect(block.length).toBeGreaterThan(6);
    expect(block.every((t) => t.foe!.state === 1)).toBe(true);
  });

  it('the Afterburner Rush: the first sprinter over the line sets off every cruising one', () => {
    const g = eventGame('rush', 2);
    const line = g.event!.line!;
    // Two swarms out, all still cruising (they cruise slower than a sprint
    // swarm normally flies).
    run(g, 30, () => g.threats.filter((t) => t.kind === 'sprinter').length >= 8);
    const sprinters = g.threats.filter((t) => t.kind === 'sprinter');
    expect(sprinters.length).toBeGreaterThanOrEqual(8);
    expect(sprinters.every((t) => t.foe!.state === 0)).toBe(true);
    expect(sprinters[0].speed).toBeLessThan(70 * 1.6);
    // One over the line: next step, every one of them flares.
    sprinters[0].y = line.y + line.dir * 4;
    step(g, DT);
    expect(g.threats.filter((t) => t.kind === 'sprinter').every((t) => t.foe!.state >= 1)).toBe(true);
  });

  it('the Escort Run: each ring of guards stripped speeds the heavy up', () => {
    const g = eventGame('escort-run', 2);
    run(g, EVENT.breather + 1);
    const hv = g.threats.find((t) => t.id === g.event!.boss)!;
    step(g, DT);
    const slow = hv.speed;
    for (const t of g.threats) if (t.kind === 'guard' && t.foe!.ring === 2) t.dead = true;
    step(g, DT);
    expect(hv.speed).toBeGreaterThan(slow);
  });
});

describe('event rules: on for the event, off after', () => {
  it('Decoy Storm: no ammo drops while it runs', () => {
    const g = eventGame('decoy-storm');
    expect(hasRule(g, 'noAmmo')).toBe(true);
    const w: Record<string, number> = { ammo: 40, repair: 20 };
    eventDropWeights(g, w, 16);
    expect(w.ammo).toBe(0);
    expect(w.repair).toBe(20);
    g.event = null;
    const w2: Record<string, number> = { ammo: 40 };
    eventDropWeights(g, w2, 16);
    expect(w2.ammo).toBe(40);
  });

  it('Blackout: night (and star shells in the drops) while it runs, and a star shell drops', () => {
    const g = eventGame('blackout');
    expect(hasRule(g, 'night')).toBe(true);
    const w: Record<string, number> = { starshell: 0 };
    eventDropWeights(g, w, 16);
    expect(w.starshell).toBe(16);
    run(g, EVENT.breather + 8, () => g.pickups.some((p) => p.kind === 'starshell'));
    expect(g.pickups.some((p) => p.kind === 'starshell')).toBe(true);
  });

  it('Siren Field: every helper chases a beacon, however far; not after the event', () => {
    const g = eventGame('siren-field');
    expect(g.event!.bonus).toBe(true);
    run(g, EVENT.breather + 3);
    const lures = g.threats.filter((t) => t.kind === 'lure');
    expect(lures.length).toBe(5);
    for (const l of lures) l.foe!.state = 1;
    expect(lureIn(g, 0, 0, 10)).toBeDefined();
    const ev = g.event;
    g.event = null;
    // Away from every ring, a helper is free again.
    const far = lureIn(g, -2000, -2000, 10);
    expect(far).toBeUndefined();
    g.event = ev;
  });

  it('Hydra Bloom: a Hydra splits into three wherever it is killed (round 8: no line); after it, two', () => {
    const g = eventGame('hydra-bloom');
    expect(g.event!.line).toBeUndefined();
    for (const y of [-50, 200, 600]) expect(hydraDarts(g, { y } as never)).toBe(3);
    g.event = null;
    expect(hydraDarts(g, { y: 200 } as never)).toBe(2);
  });

  it('Supply Raid: the cargo rains pickups down', () => {
    const g = eventGame('supply-raid');
    run(g, EVENT.breather + 6, () => g.pickups.length >= 4);
    expect(g.pickups.length).toBeGreaterThanOrEqual(4);
  });

  it('Firestorm: its fireballs burn longer than a normal one', () => {
    const g = eventGame('firestorm');
    run(g, 40, () => g.foe.marks.some((m) => m.kind === 'fire'));
    const fire = g.foe.marks.find((m) => m.kind === 'fire');
    expect(fire?.dur).toBeGreaterThan(7);
  });
});

describe('grading', () => {
  it('Clean: nothing lost; Held: one ship or a carrier hit; Broken: two ships or the map', () => {
    expect(gradeEvent(0, false, false)).toBe('clean');
    expect(gradeEvent(0, true, false)).toBe('held');
    expect(gradeEvent(1, false, false)).toBe('held');
    expect(gradeEvent(1, true, false)).toBe('held');
    expect(gradeEvent(2, false, false)).toBe('broken');
    expect(gradeEvent(0, false, true)).toBe('broken');
  });

  it('an event run to its end is graded, scored and recorded; a loss in it is Broken', () => {
    const g = eventGame('dive-circus', 4);
    const before = g.score;
    run(g, 120, () => g.eventLog.length > 0);
    // The next run follows straight on (the three-run ending).
    expect(g.phase).toBe('wave');
    expect(g.wave).toBe(EVENT_WAVE + 1);
    const e = g.eventLog[0];
    expect(e.id).toBe('dive-circus');
    expect(['clean', 'held', 'broken']).toContain(e.outcome);
    expect(g.score - before).toBe(200 * EVENT_WAVE + e.bonus);
    expect(e.bonus).toBe(EVENT.bonus[e.outcome as 'clean']);
    expect(g.events.some((ev) => ev.kind === 'specialEnd')).toBe(true);

    const lose = createGame('gauntlet', 4, EVENT_WAVE);
    lose.lost = lose.tempo.lossLimit - 1;
    run(lose, 120);
    expect(lose.phase).toBe('lost');
    expect(lose.eventLog[0].outcome).toBe('broken');
    expect(lose.eventLog[0].bonus).toBe(0);
  });
});

describe('the Test Lab: an Events section, one card per event', () => {
  const labGame = (id: string, seed = 3, length: 'quick' | 'full' = 'quick'): Game => {
    const card = labCard(id)!;
    const g = createGame(card.map, seed, card.wave);
    applyFreePlay(g, { weapons: card.kit.map((w) => ({ id: w, level: 2 })), frequentDrops: true });
    applyLab(g, { card: id, length, mix: 'normal' });
    return g;
  };

  it('twenty-one event cards, on their own maps, with a kit from that map\'s chapter, first in the list', () => {
    const cards = LAB_CARDS.filter((c) => c.kind === 'event');
    expect(cards.map((c) => c.event)).toEqual(EVENT_ORDER);
    expect(cards).toHaveLength(21);
    expect(LAB_SECTIONS[0].kind).toBe('event');
    const fresh: Record<string, number> = { breakout: 7, 'run-the-canal': 7, 'siege-of-vey': 7, 'beacon-strike': 8 };
    for (const c of cards) {
      expect(c.map).toBe(eventMap(c.event!));
      expect(c.kit).toHaveLength(3);
      for (const w of c.kit) expect(draftPool(chapterOf(c.map)), `${c.id} ${w}`).toContain(w);
      // Round 5's events, and round 7's new ones.
      expect(LAB_CHANGES[c.id]?.[0]?.round, c.id).toBe(fresh[c.event!] ?? 5);
      // Later rounds changed some of them (round 6: the playtest's notes;
      // round 7: the Decoy Drones and the Hydra everywhere).
      expect(cardRev(c.id)).toBe(Math.max(...LAB_CHANGES[c.id].map((x) => x.round)));
    }
    expect(LAB_ROUNDS.find((r) => r.n === 5)).toEqual({ n: 5, date: '2026-11-09', name: 'Special events and new notes', since: '2026-11-09T18:00' });
  });

  it('a card starts straight into its event, on its map, at wave 11 (a bonus event: after its wave)', () => {
    for (const id of EVENT_ORDER) {
      const g = labGame(`ev-${id}`);
      expect(g.map.id).toBe(eventMap(id));
      expect(g.wave).toBe(bonusDef(id)?.after ?? EVENT_WAVE);
      expect(g.event?.id).toBe(id);
      expect(g.events.some((e) => e.kind === 'special' && e.id === id)).toBe(true);
      // No convoy yet: the attack waits for it.
      expect(g.event!.t0).toBe(EVENT.convoyWait);
    }
  });

  it('Run it again starts the event over (a recorded command), and the test ends after its runs', () => {
    const g = labGame('ev-dive-circus', 5, 'quick');
    run(g, EVENT.convoyWait + EVENT.breather + 4);
    const first = g.event!;
    labBring(g);
    expect(g.event).not.toBe(first);
    expect(g.event!.t).toBe(0);
    expect(g.eventLog.at(-1)!.outcome).toBe('rerun');
    expect(g.threats.filter((t) => t.kind === 'diveBomber')).toHaveLength(0);
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = 999;
    run(g, 120);
    expect(g.phase).toBe('draft');
    expect(g.lab!.waves).toBe(LAB_EVENT_RUNS.quick);
    expect(labDone(g)).toBe(true);
    const s = g.lab!.stats;
    expect((s.clean ?? 0) + (s.held ?? 0) + (s.broken ?? 0)).toBe(1);
    expect(evidenceLines(labCard('ev-dive-circus')!, s, g.lab!.waves)[0]).toMatch(/^Clean \d · Held \d · Broken \d$/);
  });

  it('the review page\'s bridge takes event cards like any other', () => {
    const log = {
      v: LOG_VERSION, game: 'v3', id: 'v3-x', armory: {}, build: '2026-11-09T19:00', startedAt: '2026-11-09T19:00:00Z', map: 'kesh', seed: 1, firstWave: 11,
      device: { w: 1, h: 1, dpr: 1, touch: false, ua: '' }, commands: [],
      lab: { card: 'ev-decoy-storm', length: 'quick', mix: 'normal', rev: 5, round: 5 },
      labResult: { verdict: 'keep', tags: [], note: 'good', waves: 1, ended: 'length', stats: { came: 10, killed: 8, early: 6, harm: 2, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [], held: 1 }, rev: 5, round: 5 },
    } as never;
    const { results } = labResultDocs([log]);
    expect(results['ev-decoy-storm'].round).toBe(5);
    expect(results['ev-decoy-storm'].evidence).toContain('Held 1');
  });
});

describe('the play log', () => {
  it('records each event: when, what it sent, how it went, the shots, and on the Decoy Storm the shots at decoys', () => {
    const g = createGame('kesh', 6, EVENT_WAVE);
    const rec = new Recorder(g, { build: 't', startedAt: '2026-11-09T00:00:00Z', firstWave: EVENT_WAVE, device: { w: 1, h: 1, dpr: 1, touch: false, ua: '' } });
    // Taps only through the recorder (so the log replays): every second, at
    // the nearest threat.
    for (let i = 0; i < 60 * 80 && g.phase === 'wave' && !g.eventLog.length; i++) {
      if (i % 12 === 0) {
        const t = g.threats.find((o) => !o.dead && o.x > 0 && o.x < VIEW.width && o.y > 0 && o.y < VIEW.height);
        if (t) rec.tap(t.x, t.y, 40);
      }
      step(g, DT);
    }
    const log = rec.finish(g.phase === 'won' ? 'won' : 'quit');
    expect(log.v).toBe(20);
    expect(log.events).toHaveLength(1);
    const e = log.events![0];
    expect(e.id).toBe('decoy-storm');
    expect(e.wave).toBe(EVENT_WAVE);
    expect(e.sent.decoy).toBe(40);
    expect(e.shots).toBeGreaterThan(0);
    expect(e.decoyShots).toBeGreaterThanOrEqual(0);
    expect(e.decoyShots!).toBeLessThanOrEqual(e.shots);
    expect(e.end).toBeGreaterThan(e.step);
    // It replays exactly, event and all.
    const again = replay(log);
    expect(again.steps).toBe(g.steps);
    expect(again.score).toBe(g.score);
    expect(again.eventLog).toEqual(g.eventLog);
  });

  it('a lab event test with Run it again replays exactly', () => {
    const card = labCard('ev-firestorm')!;
    const g = createGame(card.map, 9, card.wave);
    const free = { weapons: card.kit.map((w) => ({ id: w, level: 2 })), frequentDrops: true };
    applyFreePlay(g, free);
    const lab = { card: card.id, length: 'quick' as const, mix: 'normal' as const };
    applyLab(g, lab);
    const rec = new Recorder(g, { build: 't', startedAt: '', firstWave: card.wave!, freePlay: free, lab, device: { w: 1, h: 1, dpr: 1, touch: false, ua: '' } });
    for (let i = 0; i < 60 * 50 && g.phase === 'wave'; i++) {
      if (i === 60 * 16) rec.bring();
      if (i % 15 === 0) {
        const t = g.threats.find((o) => !o.dead && o.x > 0 && o.x < VIEW.width && o.y > 0 && o.y < VIEW.height);
        if (t) rec.tap(t.x, t.y, 40);
      }
      step(g, DT);
    }
    const log = rec.finish('quit');
    const again = replay(log);
    expect(again.steps).toBe(g.steps);
    expect(again.eventLog).toEqual(g.eventLog);
    expect(again.eventLog[0].outcome).toBe('rerun');
  });
});

void RULES;
