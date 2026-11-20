// The Test Lab's Ready to test list (docs/design/v3-ui-overhaul.md): every
// entry names a real map card at a log version this build has, with a short
// note, and ticks itself off once that build has been played.

import { describe, expect, it } from 'vitest';
import { READY_TO_TEST, labCard, mapCardId } from '../../src/v3/data/lab';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { LOG_VERSION } from '../../src/v3/sim/playlog';
import { readyPlayed } from '../../src/v3/ui/lab';

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

  it('ticks off once a finished run of that map at that version or later is on the device', () => {
    const r = { map: 'island' as const, log: 31, tag: 'New' as const, note: '' };
    expect(readyPlayed(r, [])).toBe(false);
    // An older build, another map, or a run still in progress: not yet.
    expect(readyPlayed(r, [{ v: 30, map: 'island', end: 'won' }])).toBe(false);
    expect(readyPlayed(r, [{ v: 31, map: 'kesh', end: 'won' }])).toBe(false);
    expect(readyPlayed(r, [{ v: 31, map: 'island' }])).toBe(false);
    // Won, lost or quit, or a Test Lab verdict: played.
    expect(readyPlayed(r, [{ v: 31, map: 'island', end: 'lost' }])).toBe(true);
    expect(readyPlayed(r, [{ v: 32, map: 'island', end: 'quit' }])).toBe(true);
    expect(readyPlayed(r, [{ v: 31, map: 'island', labResult: { verdict: null, tags: [], note: '', waves: 3, ended: 'done', stats: { came: 0, killed: 0, early: 0, harm: 0, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [] } } }])).toBe(true);
    // Remembered from before the device dropped the log.
    expect(readyPlayed(r, [], new Set(['island@31']))).toBe(true);
  });
});
