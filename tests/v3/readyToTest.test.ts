// The Test Lab's Ready to test list (docs/design/v3-ui-overhaul.md): every
// entry names a real map card at a log version this build has, with a short
// note. A card is new until a run of that build is on the device, played once
// a run ended (won, lost or abandoned), and done only once the player has
// checked Done or saved a verdict (log v74).

import { describe, expect, it } from 'vitest';
import { READY_TO_TEST, cardRev, labCard, mapCardId } from '../../src/v3/data/lab';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { LOG_VERSION } from '../../src/v3/sim/playlog';
import { addLabEntry, labCardDone, labStatus, markLabDone, parseLabProgress, readyDone, readyState } from '../../src/v3/ui/lab';

const stats = { came: 0, killed: 0, early: 0, harm: 0, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [] };

describe('Ready to test', () => {
  it('lists real map cards at versions this build has, each once, with a short note', () => {
    expect(READY_TO_TEST.length).toBeGreaterThan(0);
    const maps = READY_TO_TEST.map((r) => r.map);
    expect(new Set(maps).size).toBe(maps.length);
    for (const r of READY_TO_TEST) {
      expect(MAP_ORDER).toContain(r.map);
      expect(labCard(mapCardId(r.map))?.kind).toBe('map');
      expect(r.log).toBeLessThanOrEqual(LOG_VERSION);
      // Three lines on a phone held sideways at most.
      expect(r.note.length).toBeLessThanOrEqual(90);
    }
  });

  it('lists the newest builds first', () => {
    const logs = READY_TO_TEST.map((r) => r.log);
    expect([...logs].sort((a, b) => b - a)).toEqual(logs);
  });

  it('is new until a run is on the device, played once one ended, done only when checked or rated', () => {
    const r = { map: 'island' as const, log: 31, tag: 'New' as const, note: '' };
    const verdict = { verdict: null, tags: [], note: '', waves: 3, ended: 'done' as const, stats };
    expect(readyState(r, [])).toBe('new');
    // An older build, another map, or a run still in progress: nothing yet.
    expect(readyState(r, [{ v: 30, map: 'island', end: 'won' }])).toBe('new');
    expect(readyState(r, [{ v: 31, map: 'kesh', end: 'won' }])).toBe('new');
    expect(readyState(r, [{ v: 31, map: 'island' }])).toBe('new');
    // Won, lost or abandoned: played, NOT done (the player: "when I abandon
    // the map it shows it as complete in the test lab").
    expect(readyState(r, [{ v: 31, map: 'island', end: 'won' }])).toBe('played');
    expect(readyState(r, [{ v: 31, map: 'island', end: 'lost' }])).toBe('played');
    expect(readyState(r, [{ v: 32, map: 'island', end: 'quit' }])).toBe('played');
    expect(readyDone(r, [{ v: 32, map: 'island', end: 'quit' }])).toBe(false);
    // A saved verdict, or a log that says Done: done.
    expect(readyState(r, [{ v: 31, map: 'island', labResult: verdict }])).toBe('done');
    expect(readyState(r, [{ v: 31, map: 'island', end: 'quit', labDone: true }])).toBe('done');
    // A Done mark kept in the Test Lab's progress, at that log version or later.
    expect(readyState(r, [], { 'map-island': { v: 31 } })).toBe('done');
    expect(readyState(r, [], { 'map-island': { v: 30 } })).toBe('new');
    expect(readyState(r, [{ v: 32, map: 'island', end: 'quit' }], { 'map-island': { v: 32 } })).toBe('done');
    // Remembered from before the device dropped the log.
    expect(readyState(r, [], {}, new Set(['island@31']))).toBe('done');
  });

  it('checks a card Done from the pause menu or the end screen, and keeps it with the verdicts', () => {
    const p = parseLabProgress(null);
    const id = mapCardId('island');
    expect(labCardDone(p, id)).toBe(false);
    expect(labStatus(p, id)).toBe('untested');
    markLabDone(p, id, 74);
    expect(labCardDone(p, id)).toBe(true);
    expect(labStatus(p, id)).toBe('tested');
    // It survives the device's save and load, and a malformed mark is dropped.
    const again = parseLabProgress(JSON.parse(JSON.stringify({ ...p, done: { ...p.done, bad: { at: 1 } } })));
    expect(labCardDone(again, id)).toBe(true);
    expect(again.done.bad).toBeUndefined();
    expect(again.done[id].v).toBe(74);
    // A verdict alone also makes it done.
    const q = parseLabProgress(null);
    addLabEntry(q, id, { verdict: 'keep', tags: [], note: '', waves: 3, ended: 'done', stats, at: 'x', rev: cardRev(id), round: 1 });
    expect(labCardDone(q, id)).toBe(true);
  });
});
