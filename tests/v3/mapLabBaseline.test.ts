// The Map & Convoy Lab's baseline (docs/design/v3-map-convoy-lab-plan.md,
// slice 0; docs/design/v3-map-lab-slice0-1.md): twelve stored play logs on
// The Strait, The Gauntlet and Harbor Mouth, and what each replays to.
//
// THIS TEST FAILS WHEN THE SIM CHANGES. That is its job: a run from before a
// change and one from after are not the same experiment, and nothing should
// compare them as if they were. When a change to the sim is meant (a balance
// pass, a new enemy rule):
//   1. bump LOG_VERSION in src/v3/sim/playlog.ts if old logs no longer replay;
//   2. npm run v3:map-lab -- baseline --write
//   3. say in the change's notes that the baseline was rewritten, and why.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EVENT_MAPS } from '../../src/v3/data/events';
import { MAPS } from '../../src/v3/data/maps';
import { BASELINE, REFERENCE_MAPS, baselineDiff, baselineResult, lockstep, logHash, playRecipe, stateHash, type BaselineResult } from '../../src/v3/sim/mapLab';
import { LOG_VERSION, replay, type PlayLog } from '../../src/v3/sim/playlog';
import { contentHash, mapHash, sidecarDigest } from '../../src/v3/sim/telemetry';

const DIR = 'tests/v3/fixtures/map-lab';
const HOW = 'If the sim was changed on purpose: npm run v3:map-lab -- baseline --write (see the top of this file).';
const stored = (id: string): PlayLog => JSON.parse(readFileSync(`${DIR}/${id}.json`, 'utf8'));
const manifest: { logVersion: number; results: BaselineResult[] } = JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8'));
const was = (id: string) => manifest.results.find((r) => r.id === id)!;

describe('the baseline covers what slice 0 asks', () => {
  it('twelve runs: on each reference map normal waves, the map\'s own event and the Siren Field bonus wave', () => {
    expect(BASELINE).toHaveLength(12);
    expect(manifest.results.map((r) => r.id)).toEqual(BASELINE.map((r) => r.id));
    for (const map of REFERENCE_MAPS) {
      const words = BASELINE.filter((r) => r.map === map).flatMap((r) => was(r.id).phases);
      // Ordinary waves, the bonus wave, and the map's event (a first run on
      // every map; all three where a bot gets through them).
      expect(words.some((w) => /^\d+( \(lost\))?$/.test(w)), `${map}: a normal wave`).toBe(true);
      expect(words.some((w) => w.startsWith('6+siren-field')), `${map}: the bonus wave`).toBe(true);
      expect(words.some((w) => w.startsWith(`11:${EVENT_MAPS[map]}#1`)), `${map}: its event`).toBe(true);
    }
    for (const map of ['strait', 'harbor'] as const) {
      const words = BASELINE.filter((r) => r.map === map).flatMap((r) => was(r.id).phases);
      expect(words.some((w) => w.startsWith(`13:${EVENT_MAPS[map]}#3`)), `${map}: the event's third run`).toBe(true);
    }
  });

  it('the stored results were made on this log version, this content and these maps', () => {
    expect(manifest.logVersion, HOW).toBe(LOG_VERSION);
    for (const r of manifest.results) {
      expect(r.contentHash, `${r.id}: the game's numbers changed. ${HOW}`).toBe(contentHash());
      expect(r.mapHash, `${r.id}: the map changed. ${HOW}`).toBe(mapHash(MAPS[BASELINE.find((b) => b.id === r.id)!.map]));
    }
  });
});

describe('the baseline is reproducible', () => {
  it('every stored log replays to its stored result: state, score, hulls, pickups and telemetry', () => {
    for (const r of BASELINE) {
      const log = stored(r.id);
      expect(logHash(log), r.id).toBe(was(r.id).logHash);
      const { result, problems } = baselineResult(r.id, log);
      expect(baselineDiff(was(r.id), result), `${r.id} no longer replays to its baseline. ${HOW}`).toEqual([]);
      expect(problems, r.id).toEqual([]);
      // The log's own summary (written as the run was played) agrees.
      expect(log.summary).toMatchObject({ steps: result.steps, score: result.score, lost: result.lost, delivered: result.delivered, carrierHp: result.carrierHp, shots: result.shots });
    }
  }, 60_000);

  it('telemetry on and off: each run is the same game step for step, with the same RNG draws', () => {
    // The long runs are checked on every baseline write and by `v3:map-lab -- baseline`;
    // here, a run of each kind on each map (the events and bonus waves, and one whole campaign).
    for (const id of ['strait-event', 'gauntlet-event', 'harbor-event', 'strait-bonus', 'gauntlet-bonus', 'harbor-bonus', 'harbor-campaign-you']) {
      const ls = lockstep(stored(id), 240);
      expect(ls.divergedAt, id).toBe(-1);
      expect(ls.rngSame, id).toBe(true);
      expect(ls.stateHash, id).toBe(was(id).stateHash);
      expect(sidecarDigest(ls.sidecar), id).toBe(was(id).telemetryHash);
    }
  }, 60_000);

  it('a log replays the same with no telemetry asked for (older logs carry none, and need none)', () => {
    for (const id of ['strait-event', 'harbor-bonus']) {
      const g = replay(stored(id));
      expect(g.tel).toBeNull();
      expect(stateHash(g), id).toBe(was(id).stateHash);
    }
  });

  it('the recipe (map, seed, bot, Armory, first wave) plays the stored log again, byte for byte', () => {
    for (const id of ['strait-event', 'gauntlet-event', 'harbor-event', 'harbor-campaign-you']) {
      const r = BASELINE.find((b) => b.id === id)!;
      expect(JSON.stringify(playRecipe(r).log), id).toBe(JSON.stringify(stored(id)));
    }
  }, 30_000);
});
