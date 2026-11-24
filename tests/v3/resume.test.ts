// Resume a run in progress (docs/design/v3-resume-run.md). The player: "Do
// we have a way to save when you leave mid game, so I can come back and
// finish it?" A run is saved as its log so far (platform/runSave.ts) and
// continued by replaying that log to the saved step (sim/resume.ts), then
// carrying on with the same recorder: the same log id, every input, one run.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RUN_KEY, RUN_SAVE_VERSION, canContinue, canSaveRuns, clearRun, loadRun, makeRunSave, saveRun, timeAgo, type RunSave } from '../../src/v3/platform/runSave';
import { KEYS, _resetStoreForTests } from '../../src/v3/platform/store';
import { Restorer, printDiff, restoreGame, runPrint, samePrint } from '../../src/v3/sim/resume';
import { LOG_REPLAYS, LOG_VERSION, Recorder, replay, replayTo, type PlayLog } from '../../src/v3/sim/playlog';
import { BotRun, PERSONAS, type RunOpts } from '../../src/v3/sim/mimic';
import { FULL_TEMPO, step, type FreePlaySetup, type Game } from '../../src/v3/sim/game';
import type { MapId } from '../../src/v3/data/maps';
import { hashText } from '../../src/v3/sim/telemetry';
import { labCard } from '../../src/v3/data/lab';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../src/v3/ui/lab';

function memStorage(init: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(init));
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const glob = globalThis as { localStorage?: Storage };
let prev: Storage | undefined;

beforeEach(() => {
  prev = glob.localStorage;
  glob.localStorage = memStorage();
  _resetStoreForTests();
});

afterEach(() => {
  glob.localStorage = prev;
  _resetStoreForTests();
});

const DT = 1 / 60;

/** The whole game, every field the sim keeps (the RNG streams by where
 *  they stand, read without drawing), but the UI's unread event and cue
 *  queues (a resumed game starts with them empty), the telemetry and the
 *  map (fixed data). */
function digest(g: Game): string {
  const text = JSON.stringify(g, (k, v) => {
    if (k === 'tel' || k === 'rng' || k === 'map' || k === 'events' || k === 'cues') return undefined;
    if (v instanceof Set) return [...v];
    return v;
  });
  return `${hashText(text)}:${runPrint(g).rng}:${g.steps}`;
}

/** Play a bot run until `until` says stop (or `max` steps). */
function playTo(run: BotRun, until: (g: Game) => boolean, max = 60 * 60 * 30, each?: (run: BotRun) => void): void {
  for (let n = 0; n < max && !run.done && !until(run.game); n++) {
    each?.(run);
    run.advance(1);
  }
}

/** The player's own hand after the save: the same scripted inputs on both
 *  copies of the run (a tap on the oldest threat every 20 steps, the first
 *  card in a draft). The bot can't carry on (its own state isn't in the
 *  log), so both sides play this instead. */
function hand(rec: Recorder, steps: number): void {
  const g = rec.game;
  for (let n = 0; n < steps && g.phase !== 'lost' && g.phase !== 'won'; n++) {
    if (g.phase === 'draft') rec.pick(g.offer[0]);
    else if (g.steps % 20 === 0) {
      const th = g.threats.find((t) => !t.dead);
      if (th) rec.tap(th.x, th.y, 108);
      else rec.tap(800, 450, 108);
    }
    step(g, DT);
  }
}

/** Save the run in play through the real record and storage, read it back
 *  (as a new session would) and continue it. */
function saveAndResume(run: BotRun, kind: RunSave['kind'] = 'campaign'): { save: RunSave; game: Game; rec: Recorder } {
  const made = makeRunSave(run.rec, { kind, ui: { speed: 1 }, title: run.game.map.name, build: 'test' });
  expect(made).not.toBeNull();
  expect(saveRun(made!)).toBe(true);
  // A new session: only what was stored.
  glob.localStorage = memStorage({ [RUN_KEY]: glob.localStorage!.getItem(RUN_KEY)! });
  const save = loadRun()!;
  expect(save).not.toBeNull();
  expect(canContinue(save)).toBe(true);
  const r = new Restorer(save.log, save.step, save.commands);
  // A slice at a time, as the app does across frames.
  let slices = 0;
  while (!r.run(500)) slices++;
  expect(slices).toBeGreaterThan(0);
  const game = r.game;
  expect(samePrint(save.print, runPrint(game)), printDiff(save.print, runPrint(game)).join('; ')).toBe(true);
  const rec = Recorder.resume(game, save.log, save.mark, 'test-2', '2026-11-17T12:00:00.000Z');
  return { save, game, rec };
}

/** Save mid-run, continue, play on the same way on both copies: the same
 *  game at the save, the same game after, and the continued log replays to
 *  the whole run. */
function checkResume(map: MapId, seed: number, opts: RunOpts, at: (g: Game) => boolean, kind: RunSave['kind'] = 'campaign', each?: (run: BotRun) => void) {
  const run = new BotRun(map, seed, opts);
  playTo(run, at, undefined, each);
  const live = run.game;
  expect(live.phase === 'wave' || live.phase === 'draft').toBe(true);
  const before = digest(live);
  const { save, game, rec } = saveAndResume(run, kind);
  // The exact state, not just the fingerprint.
  expect(digest(game)).toBe(before);
  expect(game.phase).toBe(live.phase);
  // The same log, id and all.
  expect(rec.log.id).toBe(run.rec.log.id);
  expect(rec.log.commands).toEqual(run.rec.log.commands);
  expect(rec.log.resumes).toEqual([{ at: '2026-11-17T12:00:00.000Z', step: save.step, build: 'test-2' }]);
  expect(rec.log.end).toBeUndefined();
  expect(rec.log.left).toBeUndefined();
  // Play on: the live run and the continued one stay the same game.
  hand(run.rec, 60 * 40);
  hand(rec, 60 * 40);
  expect(digest(game)).toBe(digest(live));
  expect(rec.log.commands).toEqual(run.rec.log.commands);
  // The continued log is the whole run: it replays to the game played.
  const log = rec.finish(game.phase === 'won' ? 'won' : game.phase === 'lost' ? 'lost' : 'quit');
  const again = replay(log);
  again.events = [];
  expect(digest(again)).toBe(digest(live));
  return { run, save, game, rec, log };
}

describe('resume a run in progress', () => {
  it('a campaign run saved mid-wave continues as the same game', () => {
    const { save } = checkResume('kesh', 11, { persona: PERSONAS.you }, (g) => g.wave === 3 && g.phase === 'wave' && g.waveT > 25);
    expect(save.phase).toBe('wave');
    expect(save.wave).toBe(3);
    expect(save.v).toBe(RUN_SAVE_VERSION);
    expect(save.logVersion).toBe(LOG_VERSION);
  });

  it('a campaign run saved in a draft continues in that draft', () => {
    const { save, game } = checkResume('strait', 5, { persona: PERSONAS.you }, (g) => g.phase === 'draft' && g.wave >= 3);
    expect(save.phase).toBe('draft');
    expect(save.wave).toBeGreaterThanOrEqual(3);
    // It went on past the draft (the hand picked the first card).
    expect(game.wave).toBeGreaterThan(save.wave);
  });

  it('the draft picks, notes and volleys so far stay in the log', () => {
    const run = new BotRun('kesh', 4, { persona: PERSONAS.you });
    playTo(run, (g) => g.wave === 2 && g.phase === 'wave' && g.waveT > 30);
    // Volleys are followed frame by frame by the UI; here once a step.
    run.rec.note({ where: 'pause', tags: ['hard'], text: 'left at wave 2' });
    for (let n = 0; n < 600; n++) {
      run.rec.observe();
      run.advance(1);
    }
    const volleys = run.rec.watch.volleys.length;
    expect(volleys).toBeGreaterThan(0);
    run.rec.rateVolley(0, { fun: 4 });
    // A wave rated on the draft (docs/design/v3-rate-and-review.md).
    run.rec.rateWave(1, { fun: 3, intensity: 2 }, 'quiet start');
    const { rec } = saveAndResume(run);
    const log = rec.snapshot();
    expect(log.notes?.map((n) => n.text)).toEqual(['left at wave 2']);
    expect(log.waveRatings?.map((w) => [w.wave, w.rating, w.note])).toEqual([[1, { fun: 3, intensity: 2 }, 'quiet start']]);
    expect(log.summary?.drafts).toEqual(run.rec.snapshot().summary?.drafts);
    expect(log.summary?.drafts.length).toBeGreaterThan(0);
    expect(rec.watch.volleys.length).toBe(volleys);
    expect(rec.watch.volleys[0].rating).toEqual({ fun: 4 });
    // It goes on following volleys.
    for (let n = 0; n < 60 * 30; n++) {
      rec.observe();
      step(rec.game, DT);
    }
    expect(rec.watch.volleys.length).toBeGreaterThanOrEqual(volleys);
  });

  it('a Test Lab map card with encounters and the convoy commands continues mid-wave and in a draft', () => {
    const card = labCard('map-harbor')!;
    const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
    expect(plan.encounters).toBeTruthy();
    expect(plan.convoy).toBeTruthy();
    const opts: RunOpts = { persona: PERSONAS.you, lab: plan.lab, convoy: plan.convoy!, encounters: plan.encounters!, pilot: 'sharp' };
    // A Hold given now and then (the pilot gives its own too), so the save
    // has convoy commands in it.
    const holds = (run: BotRun) => {
      if (run.game.phase === 'wave' && run.game.steps % 900 === 450) run.rec.command('hold');
    };
    const mid = checkResume('harbor', 3, opts, (g) => g.wave === 4 && g.phase === 'wave' && g.waveT > 20, 'lab', holds);
    expect(mid.save.log.lab?.plays).toBe('full');
    expect(mid.save.log.encounters).toBeTruthy();
    expect(mid.save.log.convoy).toBeTruthy();
    // The pilot gave convoy commands before the save: they replay too.
    expect(mid.save.log.commands.some((c) => c[1] === 'k')).toBe(true);
    expect(mid.game.lab?.full).toBe(true);
    expect(mid.game.enc).toBeTruthy();
    const draft = checkResume('harbor', 3, opts, (g) => g.phase === 'draft' && g.wave >= 2, 'lab', holds);
    expect(draft.save.phase).toBe('draft');
  });

  it('a map card with the convoy\'s Hold (?hold=1, log v66: Sowers\' own Hold is automatic) continues, its commands and all', () => {
    const card = labCard('map-sowers')!;
    const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), new URLSearchParams('hold=1'));
    expect(plan.convoy?.policy).toBe('tactical');
    const opts: RunOpts = { persona: PERSONAS.you, lab: plan.lab, convoy: plan.convoy!, ...(plan.encounters ? { encounters: plan.encounters } : {}), pilot: 'sharp' };
    let given = 0;
    const holds = (run: BotRun) => {
      if (run.game.phase === 'wave' && run.game.steps % 600 === 300 && run.rec.command('hold').ok) given++;
    };
    const { save, game } = checkResume('sowers', 4, opts, (g) => g.wave === 3 && g.phase === 'wave' && g.waveT > 15, 'lab', holds);
    expect(given).toBeGreaterThan(0);
    expect(save.log.commands.filter((c) => c[1] === 'k').length).toBeGreaterThan(0);
    expect(game.convoy?.def.commands).toEqual(['hold']);
  });

  it('Sowers\' Reach\'s automatic Hold continues too: a ship stopped for a mine is stopped again on resume', () => {
    const card = labCard('map-sowers')!;
    const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
    expect(plan.convoy?.tune).toBeUndefined();
    const opts: RunOpts = { persona: PERSONAS.you, lab: plan.lab, convoy: plan.convoy!, ...(plan.encounters ? { encounters: plan.encounters } : {}), pilot: 'sharp' };
    const { game } = checkResume('sowers', 4, opts, (g) => g.wave === 3 && g.phase === 'wave' && g.waveT > 15, 'lab');
    expect(game.convoy?.def).toMatchObject({ commands: [], autoHold: true });
  });

  it('a Free Play run continues', () => {
    const freePlay: FreePlaySetup = { weapons: [{ id: 'railgun', level: 2 }, { id: 'flak', level: 1 }], frequentDrops: true, enemies: 'all' };
    const { save } = checkResume('gauntlet', 9, { persona: PERSONAS.you, firstWave: 5, freePlay }, (g) => g.wave === 6 && g.phase === 'wave' && g.waveT > 15, 'free');
    expect(save.log.freePlay).toBeTruthy();
    expect(save.log.firstWave).toBe(5);
  });

  it('the Restorer is replayTo, a slice at a time', () => {
    const run = new BotRun('marrow', 2, { persona: PERSONAS.you });
    playTo(run, (g) => g.wave === 3 && g.waveT > 10);
    const log = run.rec.snapshot();
    const a = replayTo(log, run.game.steps, log.commands.length);
    a.events = [];
    const b = restoreGame(log, run.game.steps, log.commands.length);
    expect(digest(b)).toBe(digest(a));
    expect(digest(b)).toBe(digest(run.game));
  });

  it('the fingerprint reads the game without changing it, and moves with it', () => {
    const run = new BotRun('strait', 1, { persona: PERSONAS.you });
    playTo(run, (g) => g.wave === 2 && g.waveT > 5);
    const g = run.game;
    const d = digest(g);
    const p = runPrint(g);
    expect(runPrint(g)).toEqual(p);
    expect(digest(g)).toBe(d);
    run.advance(1);
    expect(samePrint(p, runPrint(g))).toBe(false);
    expect(printDiff(p, runPrint(g))).toContain(`steps: ${p.steps} → ${p.steps + 1}`);
  });

  it('a build that plays the inputs differently is caught by the fingerprint', () => {
    const run = new BotRun('kesh', 8, { persona: PERSONAS.you });
    playTo(run, (g) => g.wave === 2 && g.waveT > 20);
    const save = makeRunSave(run.rec, { kind: 'campaign', ui: {}, title: 'The Kesh Hook', build: 'old' })!;
    // Stand-in for a sim change: the same log replayed with one tap moved.
    const at = save.log.commands.findIndex((c) => c[1] === 't');
    expect(at).toBeGreaterThanOrEqual(0);
    const moved: PlayLog = { ...save.log, commands: save.log.commands.map((c, i) => (i === at && c[1] === 't' ? ([c[0], 't', c[2] + 300, c[3] - 200, c[4]] as typeof c) : c)) };
    const g = restoreGame(moved, save.step, save.commands);
    expect(samePrint(save.print, runPrint(g))).toBe(false);
  });

  it('a save from an older log version is not continued', () => {
    const run = new BotRun('kesh', 8, { persona: PERSONAS.you });
    playTo(run, (g) => g.wave === 1 && g.waveT > 20);
    const save = makeRunSave(run.rec, { kind: 'campaign', ui: {}, title: 'The Kesh Hook', build: 'old' })!;
    expect(canContinue(save)).toBe(true);
    // (The oldest version this build no longer replays: v40 still replays
    // v39, which the new Armory upgrades leave as it was.)
    const old = Math.min(...LOG_REPLAYS) - 1;
    expect(canContinue({ ...save, logVersion: old, log: { ...save.log, v: old } })).toBe(false);
    expect(canContinue({ ...save, logVersion: LOG_VERSION - 1, log: { ...save.log, v: LOG_VERSION - 1 } })).toBe(LOG_REPLAYS.includes(LOG_VERSION - 1));
    expect(canContinue({ ...save, v: RUN_SAVE_VERSION + 1 })).toBe(false);
    // Still read (the menu says it can't be continued and offers the map).
    saveRun({ ...save, logVersion: old });
    expect(loadRun()?.logVersion).toBe(old);
  });

  it('a run that has ended (or not begun its first wave) is not kept', () => {
    const run = new BotRun('strait', 3, { persona: PERSONAS.tryhard, tempo: { ...FULL_TEMPO, lossLimit: 1 } });
    playTo(run, () => false, 60 * 60 * 60);
    expect(['lost', 'won']).toContain(run.game.phase);
    expect(makeRunSave(run.rec, { kind: 'campaign', ui: {}, title: '', build: 'x' })).toBeNull();
  });
});

describe('the saved-run record', () => {
  function someSave(id = 'v3-a'): RunSave {
    const run = new BotRun('strait', 2, { persona: PERSONAS.you });
    playTo(run, (g) => g.waveT > 10);
    const s = makeRunSave(run.rec, { kind: 'campaign', ui: {}, title: 'The Strait', build: 'b' })!;
    return { ...s, log: { ...s.log, id } };
  }

  it('one slot, cleared when the run ends, is abandoned, or a new run starts', () => {
    expect(loadRun()).toBeNull();
    saveRun(someSave('v3-a'));
    expect(loadRun()?.log.id).toBe('v3-a');
    // Another run's end leaves it alone; its own clears it.
    clearRun('v3-b');
    expect(loadRun()?.log.id).toBe('v3-a');
    clearRun('v3-a');
    expect(loadRun()).toBeNull();
    // A new run (or abandoning it) clears whatever is there.
    saveRun(someSave('v3-c'));
    saveRun(someSave('v3-d'));
    expect(loadRun()?.log.id).toBe('v3-d');
    clearRun();
    expect(loadRun()).toBeNull();
    expect(KEYS as readonly string[]).toContain(RUN_KEY);
  });

  it('garbage in storage is no saved run', () => {
    glob.localStorage!.setItem(RUN_KEY, '{not json');
    expect(loadRun()).toBeNull();
    glob.localStorage!.setItem(RUN_KEY, JSON.stringify({ v: 1, log: {} }));
    expect(loadRun()).toBeNull();
  });

  it('no storage: the feature is off, and nothing throws', () => {
    const save = someSave();
    glob.localStorage = undefined;
    expect(canSaveRuns()).toBe(false);
    expect(saveRun(save)).toBe(false);
    expect(loadRun()).toBeNull();
    expect(() => clearRun()).not.toThrow();
    expect(() => clearRun('v3-a')).not.toThrow();
    // Storage that throws on every call (private mode, a full disk).
    glob.localStorage = {
      ...memStorage(),
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    } as Storage;
    expect(saveRun(save)).toBe(false);
    expect(loadRun()).toBeNull();
    expect(() => clearRun()).not.toThrow();
  });

  it('time ago reads as a person would say it', () => {
    const now = Date.parse('2026-11-17T12:00:00Z');
    expect(timeAgo('2026-11-17T11:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-11-17T11:57:00Z', now)).toBe('3 min ago');
    expect(timeAgo('2026-11-17T09:00:00Z', now)).toBe('3 h ago');
    expect(timeAgo('2026-11-16T09:00:00Z', now)).toBe('yesterday');
    expect(timeAgo('2026-11-13T09:00:00Z', now)).toBe('4 days ago');
  });
});
