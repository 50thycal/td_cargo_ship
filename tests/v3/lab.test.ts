// The Test Lab (docs/design/v3-test-lab.md): the hub's cards, and test runs
// in the sim.

import { describe, expect, it } from 'vitest';
import { ABILITY_ORDER } from '../../src/v3/data/abilities';
import { FOES, FOE_ORDER } from '../../src/v3/data/foes';
import { LAB_CARDS, LAB_CHANGES, LAB_LENGTH, LAB_ROUND, LAB_ROUNDS, LAB_SCENARIOS, LAB_START_WAVE, cardChanges, cardRev, labCard } from '../../src/v3/data/lab';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { RULES } from '../../src/v3/data/config';
import { labDone } from '../../src/v3/sim/lab';
import { Recorder, replay, type PlayLog } from '../../src/v3/sim/playlog';
import { labResultDocs, logRound, ownNote } from '../../src/v3/sim/labDocs';
import { addLabEntry, currentEntry, labStatus, nextCards, olderEntries, parseLabProgress, type LabEntry } from '../../src/v3/ui/lab';
import { applyFreePlay, applyLab, createGame, damageThreat, step, type Game } from '../../src/v3/sim/game';
import { Bot, SKILLS } from '../../src/v3/sim/bot';

const DT = 1 / 60;

function labGame(id: string, seed = 3, length: 'quick' | 'full' = 'full'): Game {
  const card = labCard(id)!;
  const g = createGame(card.map, seed, LAB_START_WAVE);
  applyFreePlay(g, { weapons: card.kit.map((w) => ({ id: w, level: 1 })), frequentDrops: true });
  applyLab(g, { card: id, length, mix: 'normal' });
  return g;
}

describe('the hub\'s cards', () => {
  it('every new enemy (17), every weapon (29), eight combos and every map, each once (74 cards)', () => {
    const ids = LAB_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(74);
    expect(LAB_CARDS.filter((c) => c.kind === 'enemy')).toHaveLength(17);
    for (const f of FOE_ORDER) expect(LAB_CARDS.filter((c) => c.kind === 'enemy' && c.foes[0] === f), f).toHaveLength(1);
    expect(LAB_CARDS.filter((c) => c.kind === 'weapon').map((c) => c.weapon).sort()).toEqual([...ABILITY_ORDER].sort());
    expect(LAB_CARDS.filter((c) => c.kind === 'combo')).toHaveLength(8);
    // The combos that used the enemies cut after the playtest, remade.
    expect(LAB_CARDS.filter((c) => ['combo-siege-truck', 'combo-guard-seeker', 'combo-hydra-tesla'].includes(c.id)).map((c) => c.foes)).toEqual([['siege', 'rocketTruck'], ['bodyguard'], ['hydra', 'sprinter']]);
    expect(LAB_CARDS.filter((c) => c.kind === 'map').map((c) => c.map)).toEqual(MAP_ORDER);
    // The order: the open questions first, the reworked weapons first.
    expect(ids.slice(0, 3)).toEqual(['diveBomber', 'siege', 'rocketTruck']);
    expect(LAB_CARDS.filter((c) => c.kind === 'weapon').slice(0, 5).map((c) => c.weapon)).toEqual(['dualWield', 'cadence', 'focus', 'gunships', 'supplyRun']);
    for (const c of LAB_CARDS) {
      expect(c.kit, c.id).toHaveLength(3);
      for (const w of c.kit) expect(ABILITY_ORDER, c.id).toContain(w);
      expect(c.look.length, c.id).toBeGreaterThan(5);
    }
  });
});

describe('a test run', () => {
  it('opens every wave with the card\'s enemy within seconds, rotates scenarios, and keeps a third or more of the new enemies its own', () => {
    const g = labGame('sprinter');
    g.lost = -99; // the test is about the waves, not the bot's skill
    const bot = new Bot(SKILLS.sharp, 3);
    const kind = FOES.sprinter.kind;
    let waves = 0;
    let featured = 0;
    let others = 0;
    let seen = 0;
    for (let i = 0; i < 60 * 60 * 15 && waves < 4; i++) {
      if (g.phase === 'wave' && g.wave !== seen) {
        seen = g.wave;
        const first = g.queue.find((l) => l.kind === kind);
        expect(first, `wave ${g.wave}`).toBeDefined();
        expect(first!.at).toBeLessThanOrEqual(RULES.waveLeadIn + 1.5);
        const foes = g.queue.filter((l) => FOE_ORDER.some((f) => FOES[f].kind === l.kind));
        featured += foes.filter((l) => l.kind === kind).length;
        others += foes.filter((l) => l.kind !== kind).length;
        waves++;
      }
      bot.act(g);
      step(g, DT);
    }
    expect(waves).toBeGreaterThanOrEqual(3);
    expect(featured / (featured + others)).toBeGreaterThanOrEqual(0.3);
    expect(LAB_SCENARIOS.length).toBeGreaterThan(2);
  });

  it('runs past wave 10 (no win), counts its length, and the evidence', () => {
    const g = labGame('rocketTruck', 5);
    g.lost = -99; // the test is about the clock, not the bot's skill
    g.carrierHp = g.stats.carrierHp = 1e6; // nor the carrier's luck with ballistics
    const bot = new Bot(SKILLS.sharp, 5);
    for (let i = 0; i < 60 * 60 * 30 && !labDone(g); i++) {
      bot.act(g);
      step(g, 1 / 30);
    }
    expect(labDone(g)).toBe(true);
    expect(g.lab!.waves).toBe(LAB_LENGTH.full);
    expect(g.wave).toBeGreaterThan(RULES.wavesToClear);
    expect(g.cleared).toBe(false);
    const s = g.lab!.stats;
    expect(s.came).toBeGreaterThan(0);
    expect(s.killed).toBeLessThanOrEqual(s.came);
    expect(s.early).toBeLessThanOrEqual(s.killed);
  });

  it('a kill before harm counts as early; a truck that fired doesn\'t', () => {
    const g = labGame('rocketTruck', 6);
    for (let i = 0; i < 60 * 12 && !g.threats.some((t) => t.kind === 'rocketTruck'); i++) step(g, DT);
    const t = g.threats.find((o) => o.kind === 'rocketTruck')!;
    damageThreat(g, t, 99);
    expect(g.lab!.stats.killed).toBe(1);
    expect(g.lab!.stats.early).toBe(1);
  });

  it('"Bring one" is a recorded command: a test that used it replays exactly', () => {
    const card = labCard('torpedoSub')!;
    const g = createGame(card.map, 9, LAB_START_WAVE);
    const free = { weapons: card.kit.map((w) => ({ id: w, level: 1 })), frequentDrops: true };
    applyFreePlay(g, free);
    const lab = { card: 'torpedoSub', length: 'quick' as const, mix: 'heavy' as const };
    applyLab(g, lab);
    const rec = new Recorder(g, { build: 't', startedAt: '', firstWave: LAB_START_WAVE, freePlay: free, lab, device: { w: 1, h: 1, dpr: 1, touch: false, ua: '' } });
    // Only recorded inputs (a bot's taps would bypass the log).
    for (let i = 0; i < 60 * 40; i++) {
      if (i === 200 || i === 900) rec.bring();
      if (g.phase === 'draft') rec.pick(g.offer[0]);
      if (g.phase === 'lost') break;
      step(g, DT);
    }
    expect(rec.log.commands.filter((c) => c[1] === 'b')).toHaveLength(2);
    const log = rec.finish('quit');
    expect(log.lab).toEqual(lab);
    const again = replay(log);
    expect(again.steps).toBe(g.steps);
    expect(again.lab!.stats).toEqual(g.lab!.stats);
  });

  it('a map card plays its map\'s own waves with its chapter\'s enemies', () => {
    const g = labGame('map-coves');
    expect(g.map.id).toBe('coves');
    expect(g.lab!.map).toBe(true);
    expect(g.foe.lead.length).toBeGreaterThan(0);
  });
});

// ---- Rounds and versions ----------------------------------------------------

const stats = { came: 3, killed: 2, early: 1, harm: 1, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [] };
const today = new Date().toISOString().slice(0, 10);
/** Progress as saved before rounds: one result object per card. */
const oldShape = {
  results: {
    rocketTruck: { verdict: 'keep', tags: ['Fun'], note: 'best one so far', waves: 2, ended: 'done', stats, at: '2026-11-08T01:00:00Z' },
    torpedoSub: { verdict: 'keep', tags: [], note: '', waves: 2, ended: 'done', stats, at: '2026-11-08T01:10:00Z' },
  },
  length: 'quick',
  mix: 'normal',
  queue: [],
  session: { day: today, ids: ['rocketTruck'] },
};

describe('test rounds and card versions', () => {
  it('the rounds are in order and every change names a real card and round', () => {
    expect(LAB_ROUNDS.map((r) => r.n)).toEqual([1, 2]);
    expect(LAB_ROUND).toBe(2);
    for (const [id, list] of Object.entries(LAB_CHANGES)) {
      expect(labCard(id), id).toBeDefined();
      for (const c of list) expect(LAB_ROUNDS.map((r) => r.n), id).toContain(c.round);
    }
    expect(cardRev('rocketTruck')).toBe(2);
    expect(cardRev('torpedoSub')).toBe(1);
    expect(cardRev('w-gunships')).toBe(2);
    expect(cardChanges('rocketTruck', 1)).toHaveLength(1);
    expect(cardChanges('rocketTruck', 2)).toEqual([]);
  });

  it('a combo takes on its enemies\' and weapon\'s versions and changes', () => {
    // Lure Beacon + Drone Screen has no change of its own; the Lure Beacon did.
    expect(LAB_CHANGES['combo-lure-screen']).toBeUndefined();
    expect(cardRev('combo-lure-screen')).toBe(2);
    expect(cardChanges('combo-lure-screen').some((l) => l.startsWith(`${labCard('lure')!.name}:`))).toBe(true);
    // Siege + Rocket Truck: its own line, and both enemies'.
    expect(cardChanges('combo-siege-truck')).toHaveLength(3);
  });

  it('progress saved before rounds becomes round 1 history', () => {
    const p = parseLabProgress(JSON.parse(JSON.stringify(oldShape)));
    expect(p.results.rocketTruck).toHaveLength(1);
    expect(p.results.rocketTruck[0]).toMatchObject({ verdict: 'keep', note: 'best one so far', rev: 1, round: 1 });
    expect(p.length).toBe('quick');
    expect(p.session.ids).toEqual(['rocketTruck']);
    // Already-migrated progress loads as it is.
    expect(parseLabProgress(JSON.parse(JSON.stringify(p))).results).toEqual(p.results);
  });

  it('a card changed in round 2 with only a round 1 verdict is not tested, and Next up offers it first', () => {
    const p = parseLabProgress(JSON.parse(JSON.stringify(oldShape)));
    expect(currentEntry(p, 'rocketTruck')).toBeUndefined();
    expect(olderEntries(p, 'rocketTruck')).toHaveLength(1);
    expect(labStatus(p, 'rocketTruck')).toBe('changed');
    // The Torpedo Sub didn't change: its round 1 verdict still counts.
    expect(labStatus(p, 'torpedoSub')).toBe('tested');
    expect(currentEntry(p, 'torpedoSub')!.note).toBe('');
    expect(labStatus(p, 'diveBomber')).toBe('untested');
    // Dive Bomber comes first on the checklist, but the changed card first.
    const next = nextCards(p, 3).map((c) => c.id);
    expect(next[0]).toBe('rocketTruck');
    expect(next).not.toContain('torpedoSub');
    expect(nextCards(p, 1, 'rocketTruck')[0].id).toBe('diveBomber');
  });

  it('a new verdict is appended (the old stays) and becomes the current one', () => {
    const p = parseLabProgress(JSON.parse(JSON.stringify(oldShape)));
    const e: LabEntry = { verdict: 'tune', tags: [], note: 'rockets read', waves: 2, ended: 'done', stats, at: '2026-11-09T00:00:00Z', rev: cardRev('rocketTruck'), round: LAB_ROUND, build: 't' };
    addLabEntry(p, 'rocketTruck', e);
    expect(p.results.rocketTruck).toHaveLength(2);
    expect(currentEntry(p, 'rocketTruck')).toEqual(e);
    expect(olderEntries(p, 'rocketTruck').map((o) => o.note)).toEqual(['best one so far']);
    expect(labStatus(p, 'rocketTruck')).toBe('tested');
    expect(nextCards(p, 1)[0].id).not.toBe('rocketTruck');
  });
});

describe('the bridge to the review pages', () => {
  const log = (id: string, card: string, at: string, verdict: 'keep' | 'tune' | 'cut', note: string, round?: number): PlayLog =>
    ({
      v: 17,
      game: 'v3',
      id,
      armory: {},
      build: 't',
      startedAt: at,
      endedAt: at,
      map: 'strait',
      seed: 1,
      firstWave: 5,
      device: { w: 1, h: 1, dpr: 1, touch: false, ua: '' },
      commands: [],
      lab: { card, length: 'full', mix: 'normal', ...(round ? { rev: cardRev(card), round } : {}) },
      labResult: { verdict, tags: [], note, waves: 2, ended: 'done', stats, ...(round ? { rev: cardRev(card), round } : {}) },
    }) as PlayLog;

  it('groups logs by card and round: the latest round on top, earlier rounds as history', () => {
    const { results, builds } = labResultDocs([
      log('a', 'rocketTruck', '2026-11-08T01:00:00Z', 'keep', 'round one, early'),
      log('b', 'rocketTruck', '2026-11-08T02:00:00Z', 'keep', 'round one, later'),
      log('c', 'rocketTruck', '2026-11-09T01:00:00Z', 'tune', 'round two', 2),
      log('d', 'torpedoSub', '2026-11-08T01:00:00Z', 'keep', 'sub'),
    ]);
    const rt = results.rocketTruck;
    expect(rt).toMatchObject({ verdict: 'tune', note: 'round two', round: 2, rev: 2, log: 'c' });
    expect(rt.changes).toEqual(cardChanges('rocketTruck', 1));
    expect(rt.history).toEqual([{ round: 1, verdict: 'keep', note: 'round one, later', at: '2026-11-08T02:00:00Z', log: 'b' }]);
    // A log from before rounds is round 1, version 1.
    expect(results.torpedoSub).toMatchObject({ round: 1, rev: 1, history: [], changes: [] });
    expect(builds.rocketTruck).toMatchObject({ verdict: 'tune', round: 2 });
  });

  it('drops an earlier round\'s note copied in at the start of a new one', () => {
    expect(ownNote('Old words.\n\n\nNew words.', ['Old words.'])).toBe('New words.');
    expect(ownNote('Only new.', ['Old words.'])).toBe('Only new.');
  });

  it('places a log from before rounds by its build: a round-2 build counts as round 2', () => {
    const old = { ...log('e', 'rocketTruck', '2026-11-08T04:00:00Z', 'keep', 'first look'), build: '2026-11-08T03:46' };
    const after = { ...log('f', 'rocketTruck', '2026-11-08T16:00:00Z', 'tune', 'salvos'), build: '2026-11-08T15:07' };
    expect(logRound(old)).toBe(1);
    expect(logRound(after)).toBe(2);
    const { results } = labResultDocs([old, after]);
    expect(results.rocketTruck).toMatchObject({ round: 2, rev: 2, note: 'salvos' });
    expect(results.rocketTruck.history).toEqual([{ round: 1, verdict: 'keep', note: 'first look', at: '2026-11-08T04:00:00Z', log: 'e' }]);
  });

  it('a log from before rounds still replays', () => {
    const card = labCard('rocketTruck')!;
    const g = createGame(card.map, 4, LAB_START_WAVE);
    const free = { weapons: card.kit.map((w) => ({ id: w, level: 1 })), frequentDrops: true };
    applyFreePlay(g, free);
    const lab = { card: 'rocketTruck', length: 'quick' as const, mix: 'normal' as const };
    applyLab(g, lab);
    const rec = new Recorder(g, { build: 't', startedAt: '', firstWave: LAB_START_WAVE, freePlay: free, lab, device: { w: 1, h: 1, dpr: 1, touch: false, ua: '' } });
    for (let i = 0; i < 60 * 10; i++) step(g, DT);
    const old = rec.finish('quit');
    expect(old.lab!.round).toBeUndefined();
    expect(replay(old).steps).toBe(g.steps);
  });
});
