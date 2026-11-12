// Special events, round 7 (docs/design/v3-events-round7.md): Siren Field as
// a bonus event (its own category, with a condition: two passives held as
// wave 6 ends, on any map, once a run); an event for every map (the three
// chapter finales, and Undertow on Dunmar Crossing); the three-run ending
// with the convoy restored first, behind one flag; the Test Lab's cards and
// round; and replay.

import { describe, expect, it } from 'vitest';
import { VIEW, type ThreatKind } from '../../src/v3/data/config';
import { BONUS_EVENTS, ENDING, EV, EVENT, EVENTS, EVENT_MAPS, EVENT_ORDER, EVENT_WAVE, RULE_TEXT, bonusDef, eventMap, worstOutcome, type EventId } from '../../src/v3/data/events';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { ROSTER } from '../../src/v3/data/roster';
import { LAB_CARDS, LAB_CHANGES, LAB_EVENT_RUNS, LAB_ROUNDS, cardRev, labCard } from '../../src/v3/data/lab';
import { canTake, type AbilityId } from '../../src/v3/data/abilities';
import { applyFreePlay, applyLab, createGame, pickUpgrade, shipsSunk, step, type Game } from '../../src/v3/sim/game';
import { bonusDue, endingOutcome, eventDropWeights, lastWave, passivesHeld, startBonus } from '../../src/v3/sim/events';
import { labCountText } from '../../src/v3/sim/lab';
import { Recorder, replay } from '../../src/v3/sim/playlog';
import { Bot, SKILLS } from '../../src/v3/sim/bot';

const DT = 1 / 60;
const DEVICE = { w: 1, h: 1, dpr: 1, touch: false, ua: '' };

function run(g: Game, seconds: number, done: () => boolean = () => false): void {
  for (let i = 0; i < seconds / DT && g.phase === 'wave' && !done(); i++) step(g, DT);
}

/** Clear the wave on the board at once (as if everything was shot down). */
function clearWave(g: Game): void {
  g.queue = [];
  g.raiderQueue = [];
  g.raiders = [];
  g.threats = g.threats.filter((t) => t.kind === 'rig' || t.kind === 'generator' || t.kind === 'citadel');
  g.foe.marks = [];
  if (g.event) g.event.plan = [];
  step(g, DT);
}

/** Hold these weapons (in place of whatever the skip-ahead drafted). */
function hold(g: Game, ids: AbilityId[]): void {
  g.slots = [...ids];
  g.levels = Object.fromEntries(ids.map((id) => [id, 2]));
}

/** An event game at its wave, the convoy unsinkable, straight in. */
function eventGame(id: EventId, seed = 1): Game {
  const g = createGame(eventMap(id), seed, EVENT_WAVE);
  g.tempo = { ...g.tempo, lossLimit: 999 };
  g.carrierHp = 999;
  g.event!.t0 = 0;
  return g;
}

/** Run an event's first run to its end, noting every threat kind seen. */
function firstRun(g: Game, seconds = 90): Set<ThreatKind> {
  const seen = new Set<ThreatKind>();
  for (let i = 0; i < seconds / DT && g.phase === 'wave' && !g.eventLog.length; i++) {
    for (const t of g.threats) seen.add(t.kind);
    step(g, DT);
  }
  return seen;
}

describe('a bonus event: Siren Field after wave 6, with two passives, on any map, once', () => {
  it('its own category, with a condition, and no longer any map\'s event', () => {
    expect(EVENTS['siren-field'].kind).toBe('bonus');
    expect(Object.values(EVENT_MAPS)).not.toContain('siren-field');
    expect(BONUS_EVENTS.map((b) => b.id)).toEqual(['siren-field']);
    const b = bonusDef('siren-field')!;
    expect(b.after).toBe(6);
    expect(b.when({ map: 'strait', wave: 6, held: [], passives: 1 })).toBe(false);
    expect(b.when({ map: 'strait', wave: 6, held: [], passives: 2 })).toBe(true);
    expect(b.when({ map: 'strait', wave: 6, held: [], passives: 3 })).toBe(true);
    // Every map event is a map event; the passives are roster.ts's.
    for (const id of EVENT_ORDER) expect(EVENTS[id].kind, id).toBe(id === 'siren-field' ? 'bonus' : 'map');
    expect(Object.keys(ROSTER).filter((id) => ROSTER[id as AbilityId].cat === 'passive').sort()).toEqual(['aegis', 'bomberWing', 'droneScreen', 'frigate', 'gunships', 'orbital']);
  });

  for (const map of ['strait', 'needle', 'citadel'] as const) {
    it(`${map}: two passives as wave 6 ends bring the bonus wave; its draft after it; wave 7 as it was`, () => {
      const g = createGame(map, 3, 6);
      hold(g, ['droneScreen', 'gunships', 'flak']);
      expect(passivesHeld(g)).toEqual(['droneScreen', 'gunships']);
      clearWave(g);
      // Straight into the bonus wave: its card, no draft yet, and the wave
      // number stays 6.
      expect(g.phase).toBe('wave');
      expect(g.wave).toBe(6);
      expect(g.event?.id).toBe('siren-field');
      expect(g.event?.bonus).toBe(true);
      expect(g.events.some((e) => e.kind === 'special' && e.id === 'siren-field' && e.bonus)).toBe(true);
      expect(lastWave(g)).toBe(13);
      // Played to its end: graded and paid, then wave 6's draft.
      g.tempo = { ...g.tempo, lossLimit: 999 };
      g.carrierHp = 999;
      const cleared = g.history.length;
      const score = g.score;
      run(g, 90);
      expect(g.phase).toBe('draft');
      expect(g.wave).toBe(6);
      const e = g.eventLog[0];
      expect(e.kind).toBe('bonus');
      expect(e.id).toBe('siren-field');
      expect(['clean', 'held', 'broken']).toContain(e.outcome);
      // No wave score and no wave record of its own: its reward is its
      // bonus (and the ships it got home).
      expect(g.history.length).toBe(cleared);
      expect(g.score - score).toBeGreaterThanOrEqual(e.bonus);
      expect(e.bonus).toBe(EVENT.bonus[e.outcome as 'clean']);
      pickUpgrade(g, g.offer.find((id) => id === 'resupply' || canTake(g.levels, id))!);
      // Wave 7, a normal wave as before.
      expect(g.phase).toBe('wave');
      expect(g.wave).toBe(7);
      expect(g.event).toBeNull();
      expect(g.raids.length).toBeGreaterThan(0);
      // Once a run: a second wave 6 would not bring it again.
      g.wave = 6;
      expect(bonusDue(g)).toBeNull();
    });
  }

  it('fewer than two passives, another wave, Free Play or the lab: no bonus wave', () => {
    const one = createGame('strait', 3, 6);
    hold(one, ['droneScreen', 'flak', 'railgun']);
    clearWave(one);
    expect(one.phase).toBe('draft');
    expect(one.eventLog).toEqual([]);

    const five = createGame('strait', 3, 5);
    hold(five, ['droneScreen', 'gunships', 'flak']);
    clearWave(five);
    expect(five.phase).toBe('draft');

    const free = createGame('strait', 3, 6);
    applyFreePlay(free, { weapons: [{ id: 'droneScreen', level: 2 }, { id: 'gunships', level: 2 }], frequentDrops: false });
    clearWave(free);
    expect(free.phase).toBe('draft');
    expect(free.event).toBeNull();
  });

  it('a campaign bot that holds two passives at wave 6 plays the bonus wave once, and goes on', () => {
    const g = createGame('strait', 21, 6);
    hold(g, ['droneScreen', 'gunships', 'flak']);
    const bot = new Bot(SKILLS.sharp, 21);
    for (let i = 0; i < 30 * 60 * 6 && g.phase !== 'won' && g.phase !== 'lost' && g.wave < 8; i++) {
      bot.act(g);
      step(g, 1 / 30);
    }
    expect(g.eventLog.filter((e) => e.kind === 'bonus').map((e) => e.id)).toEqual(['siren-field']);
    expect(g.bonusDone).toEqual(['siren-field']);
  });

  it('its card says it is a bonus event; the lab card starts it straight in, with two passives in its kit', () => {
    const card = labCard('ev-siren-field')!;
    expect(card.kit.filter((w) => ROSTER[w].cat === 'passive').length).toBeGreaterThanOrEqual(2);
    expect(card.map).toBe('crossing');
    const g = createGame(card.map, 4, card.wave);
    applyFreePlay(g, { weapons: card.kit.map((w) => ({ id: w, level: 2 })), frequentDrops: true });
    applyLab(g, { card: card.id, length: 'full', mix: 'normal' });
    expect(g.event?.id).toBe('siren-field');
    expect(g.event?.bonus).toBe(true);
    expect(g.events.find((e) => e.kind === 'special')).toMatchObject({ id: 'siren-field', bonus: true });
    // Any map: started on another, it plays the same.
    const other = createGame('island', 4, 7);
    other.wave = 6;
    startBonus(other, 'siren-field');
    other.tempo = { ...other.tempo, lossLimit: 999 };
    other.carrierHp = 999;
    other.event!.t0 = 0;
    const seen = firstRun(other);
    expect(seen.has('lure')).toBe(true);
    expect(other.eventLog[0].sent.lure).toBe(EV['siren-field'].lures);
  });
});

describe('every map has its own event', () => {
  it('all twenty, each different; the card names it and its rules, never how to beat it', () => {
    expect(MAP_ORDER.map((m) => EVENT_MAPS[m]).every(Boolean)).toBe(true);
    expect(new Set(MAP_ORDER.map((m) => EVENT_MAPS[m])).size).toBe(MAP_ORDER.length);
    // (Round 8: Beacon Strike took Undertow's place on Dunmar Crossing.)
    expect(RULE_TEXT.beaconCall).toBe('Beacons call missiles on the ship nearest them');
    expect(EVENTS.breakout.rules.map((r) => RULE_TEXT[r])).toEqual(['No ammo drops at first']);
    for (const id of ['breakout', 'run-the-canal', 'beacon-strike', 'siege-of-vey'] as EventId[]) {
      const words = [EVENTS[id].name, EVENTS[id].look, ...EVENTS[id].rules.map((r) => RULE_TEXT[r])].join(' ').toLowerCase();
      for (const tell of ['sink the', 'shoot the', 'kill the', 'pop', 'first, then', 'save the', 'hold fire']) expect(words, `${id}: ${tell}`).not.toContain(tell);
    }
  });
});

describe('the three chapter finales', () => {
  it('The Breakout (Harbor Mouth): decoys and sprinters with no ammo drops at first, then Hydras, then a pair of trucks down the shore road', () => {
    const g = eventGame('breakout', 2);
    const w: Record<string, number> = { ammo: 40, repair: 10 };
    run(g, EVENT.breather + 2);
    eventDropWeights(g, w, 0);
    expect(w.ammo).toBe(0);
    run(g, EV.breakout.open);
    const w2: Record<string, number> = { ammo: 40 };
    eventDropWeights(g, w2, 0);
    expect(w2.ammo).toBe(40);
    const seen = firstRun(g);
    for (const k of ['decoy', 'drone', 'sprinter', 'hydra', 'rocketTruck'] as ThreatKind[]) expect(seen.has(k), k).toBe(true);
    const e = g.eventLog[0];
    expect(e.sent.rocketTruck).toBe(EV.breakout.trucks * EV.breakout.roads);
    expect(e.sent.hydra).toBe(EV.breakout.fan);
  });

  it('Run the Canal (Saltgate): subs, a gunship over a lock, then an armored block that banks together (round 8: cut down)', () => {
    const g = eventGame('run-the-canal', 2);
    run(g, EVENT.breather + EV['run-the-canal'].heliAt + 1);
    const helis = g.threats.filter((t) => t.kind === 'attackHeli');
    expect(helis).toHaveLength(EV['run-the-canal'].helis);
    const locks = g.map.locks!;
    expect(helis.map((t) => t.foe!.px)).toEqual([(locks[0].x0 + locks[0].x1) / 2]);
    run(g, 30, () => (g.event?.signals ?? 0) > 0);
    expect(g.event!.blockSpec?.drones).toBe(EV['run-the-canal'].drones);
    const block = g.threats.filter((t) => t.kind === 'armored');
    expect(block.length).toBeGreaterThan(2);
    expect(block.every((t) => t.foe!.state === 1)).toBe(true);
  });

  it('Siege of Vey (Citadel): repair ships meet by the Citadel, the mothership and a guarded heavy come out of it, then firebombs', () => {
    const g = eventGame('siege-of-vey', 2);
    run(g, EVENT.breather + 0.2);
    const core = g.map.bases.find((b) => b.core)!;
    const ms = g.threats.find((t) => t.kind === 'mothership')!;
    expect(Math.hypot(ms.x - core.x, ms.y - core.y)).toBeLessThan(30);
    const yard = g.event!.yard!;
    // The meeting spot is by the Citadel, within the repair ships' reach of it.
    expect(Math.hypot(yard.x - core.x, yard.y - core.y)).toBeLessThan(340);
    expect(g.threats.filter((t) => t.kind === 'tender')).toHaveLength(3);
    run(g, EV['siege-of-vey'].escortAt + 0.5);
    const hv = g.threats.find((t) => t.kind === 'heavy')!;
    expect(hv.maxHp).toBe(EV['siege-of-vey'].heavyHp);
    expect(g.threats.filter((t) => t.kind === 'guard')).toHaveLength(7);
    const slow = hv.speed;
    for (const t of g.threats) if (t.kind === 'guard' && t.foe!.ring === 1) t.dead = true;
    step(g, DT);
    expect(hv.speed).toBeGreaterThan(slow);
    const seen = firstRun(g);
    expect(seen.has('cloud') || (g.eventLog[0]?.sent.cloud ?? 0) > 0).toBe(true);
    expect(g.eventLog[0].sent.cloud).toBe(EV['siege-of-vey'].fire);
  });
});

describe('the three-run ending, the convoy restored first (one flag)', () => {
  /** A game at wave 10 with the run worn down: four ships lost, the carrier
   *  at 3, the ships afloat at 1. */
  function worn(map: 'kesh' | 'harbor' = 'kesh'): Game {
    const g = createGame(map, 6, 10);
    g.lost = 4;
    g.carrierHp = 3;
    for (const s of g.ships) s.hp = 1;
    return g;
  }

  it('right before the first run, the convoy and the carrier are back to full; the runs follow back to back; clearing the third wins', () => {
    const g = worn();
    clearWave(g);
    expect(g.phase).toBe('draft');
    pickUpgrade(g, g.offer.find((id) => id === 'resupply' || canTake(g.levels, id))!);
    expect(g.wave).toBe(11);
    expect(g.events.some((e) => e.kind === 'restore')).toBe(true);
    expect(g.lost).toBe(4);
    expect(shipsSunk(g)).toBe(0);
    expect(g.carrierHp).toBe(g.stats.carrierHp);
    for (const s of g.ships) expect(s.hp).toBe(g.stats.shipHp);
    expect(g.events.find((e) => e.kind === 'special')).toMatchObject({ id: 'decoy-storm', wave: 11, run: 1, runs: 3 });
    // Run 1 cleared: run 2 at once (its card and breather, no draft).
    clearWave(g);
    expect(g.phase).toBe('wave');
    expect(g.wave).toBe(12);
    expect(g.event?.run).toBe(2);
    expect(g.events.filter((e) => e.kind === 'special').at(-1)).toMatchObject({ wave: 12, run: 2, runs: 3 });
    clearWave(g);
    expect(g.wave).toBe(13);
    expect(g.event?.run).toBe(3);
    clearWave(g);
    expect(g.phase).toBe('won');
    expect(g.eventLog.map((e) => `${e.run}/${e.runs}`)).toEqual(['1/3', '2/3', '3/3']);
    expect(endingOutcome(g)).toBe('clean');
  });

  it('the restore is once: no second restore before runs 2 and 3; a loss in run 2 ends the map', () => {
    const g = createGame('harbor', 7, 11);
    expect(g.events.filter((e) => e.kind === 'restore')).toHaveLength(1);
    clearWave(g);
    expect(g.wave).toBe(12);
    expect(g.events.filter((e) => e.kind === 'restore')).toHaveLength(1);
    g.lost = g.lossBase + g.tempo.lossLimit - 1;
    run(g, 120);
    expect(g.phase).toBe('lost');
    expect(g.eventLog.map((e) => e.outcome)).toEqual(['clean', 'broken']);
    expect(endingOutcome(g)).toBe('broken');
  });

  it('the whole is the worst run; each run pays its own bonus', () => {
    expect(worstOutcome(['clean', 'held', 'clean'])).toBe('held');
    expect(worstOutcome(['clean', 'clean', 'clean'])).toBe('clean');
    expect(worstOutcome(['held', 'broken', 'clean'])).toBe('broken');
    expect(worstOutcome([])).toBeNull();
  });

  it('with the flag off: the old ending, one run at wave 11 and no restore', () => {
    ENDING.threeRuns = false;
    try {
      const g = worn();
      clearWave(g);
      pickUpgrade(g, g.offer.find((id) => id === 'resupply' || canTake(g.levels, id))!);
      expect(g.wave).toBe(11);
      expect(lastWave(g)).toBe(11);
      expect(g.events.some((e) => e.kind === 'restore')).toBe(false);
      expect(shipsSunk(g)).toBe(4);
      expect(g.carrierHp).toBe(3);
      expect(g.event?.runs).toBe(1);
      expect(g.events.find((e) => e.kind === 'special')).toEqual({ kind: 'special', id: 'decoy-storm', wave: 11 });
      clearWave(g);
      expect(g.phase).toBe('won');
      expect(g.eventLog[0].runs).toBeUndefined();
      expect(endingOutcome(g)).toBeNull();
    } finally {
      ENDING.threeRuns = true;
    }
  });

  it('the Test Lab\'s Full test plays as many runs as the campaign\'s ending', () => {
    expect(LAB_EVENT_RUNS.full).toBe(ENDING.runs);
    expect(labCountText(labCard('ev-beacon-strike')!, { came: 0, killed: 0, early: 0, harm: 0, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [] }, 1, LAB_EVENT_RUNS.full)).toMatch(/Run 2 of 3$/);
  });
});

describe('the Test Lab: round 7', () => {
  it('round 7, a card for each new event, and a round 7 line for each new or changed event card', () => {
    expect(LAB_ROUNDS.find((r) => r.n === 7)).toEqual({ n: 7, date: '2026-11-10', name: 'Enemy tweaks; more events', since: '2026-11-10T06:00' });
    for (const id of ['breakout', 'run-the-canal', 'siege-of-vey', 'siren-field']) {
      const card = labCard(`ev-${id}`)!;
      expect(card, id).toBeDefined();
      expect(card.kind).toBe('event');
      expect(LAB_CHANGES[card.id].filter((c) => c.round === 7), id).toHaveLength(1);
      // (Round 8 changed The Breakout and Run the Canal again.)
      expect(cardRev(card.id)).toBe(['breakout', 'run-the-canal'].includes(id) ? 8 : 7);
    }
    // Undertow was cut in round 8; its place's kit has no helpers either.
    expect(labCard('ev-beacon-strike')!.kit.filter((w) => ROSTER[w].cat === 'passive')).toEqual([]);
    expect(LAB_CARDS.filter((c) => c.kind === 'event')).toHaveLength(21);
  });

  it('each new card starts straight into its event on its own map', () => {
    for (const id of ['breakout', 'run-the-canal', 'beacon-strike', 'siege-of-vey'] as EventId[]) {
      const card = labCard(`ev-${id}`)!;
      const g = createGame(card.map, 5, card.wave);
      applyFreePlay(g, { weapons: card.kit.map((w) => ({ id: w, level: 2 })), frequentDrops: true });
      applyLab(g, { card: card.id, length: 'quick', mix: 'normal' });
      expect(g.map.id).toBe(eventMap(id));
      expect(g.event?.id).toBe(id);
      expect(g.event?.runs).toBe(1);
      // No restore in the lab.
      expect(g.events.some((e) => e.kind === 'restore')).toBe(false);
    }
  });
});

describe('determinism and replay', () => {
  it('the same seed and inputs play the three-run ending the same way twice', () => {
    const play = () => {
      const g = createGame('saltgate', 8, 11);
      const bot = new Bot(SKILLS.sharp, 8);
      for (let i = 0; i < 30 * 200 && g.phase === 'wave'; i++) {
        bot.act(g);
        step(g, 1 / 30);
      }
      return { steps: g.steps, score: g.score, log: g.eventLog };
    };
    expect(play()).toEqual(play());
  });

  it('a recorded run of the ending (and the restore) replays exactly', () => {
    const g = createGame('crossing', 6, EVENT_WAVE);
    const rec = new Recorder(g, { build: 't', startedAt: '2026-11-10T00:00:00Z', firstWave: EVENT_WAVE, device: DEVICE });
    for (let i = 0; i < 60 * 120 && g.phase === 'wave'; i++) {
      if (i % 10 === 0) {
        const t = g.threats.find((o) => !o.dead && o.x > 0 && o.x < VIEW.width && o.y > 0 && o.y < VIEW.height);
        if (t) rec.tap(t.x, t.y, 40);
      }
      step(g, DT);
    }
    const log = rec.finish(g.phase === 'won' ? 'won' : g.phase === 'lost' ? 'lost' : 'quit');
    expect(log.v).toBe(20);
    expect(log.events!.length).toBeGreaterThanOrEqual(1);
    expect(log.events![0].id).toBe('beacon-strike');
    const again = replay(log);
    expect(again.steps).toBe(g.steps);
    expect(again.score).toBe(g.score);
    expect(again.lossBase).toBe(g.lossBase);
    expect(again.eventLog).toEqual(g.eventLog);
  });

  it('a recorded run through the bonus wave replays exactly', () => {
    // A seed whose skip-ahead drafts hold two passives by wave 6.
    let seed = 0;
    for (let s = 1; s < 400 && !seed; s++) if (passivesHeld(createGame('strait', s, 6)).length >= 2) seed = s;
    expect(seed).toBeGreaterThan(0);
    const g = createGame('strait', seed, 6);
    const rec = new Recorder(g, { build: 't', startedAt: '2026-11-10T00:00:00Z', firstWave: 6, device: DEVICE });
    for (let i = 0; i < 60 * 150 && g.phase !== 'won' && g.phase !== 'lost' && g.wave < 8; i++) {
      if (g.phase === 'draft') {
        rec.pick(g.offer.find((id) => id === 'resupply' || canTake(g.levels, id))!);
        continue;
      }
      if (i % 8 === 0) {
        const t = g.threats.find((o) => !o.dead && o.x > 0 && o.x < VIEW.width && o.y > 0 && o.y < VIEW.height);
        if (t) rec.tap(t.x, t.y, 40);
      }
      step(g, DT);
    }
    const log = rec.finish('quit');
    const again = replay(log);
    expect(again.steps).toBe(g.steps);
    expect(again.eventLog).toEqual(g.eventLog);
    expect(again.bonusDone).toEqual(g.bonusDone);
    if (g.wave >= 7) expect(g.eventLog.some((e) => e.kind === 'bonus')).toBe(true);
  });
});

