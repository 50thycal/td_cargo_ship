// Pause-menu round: the types a player has met (platform/seen.ts). A tip
// card introduces a new enemy, munition or weapon once per save, in every
// mode, and Settings → Show tips again brings them all back.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LEGACY_TIPS_KEY, SEEN_KEY, SEEN_VERSION, clearSeen, hasSeen, meet, seenTypes } from '../../src/v3/platform/seen';
import { KEYS, _resetStoreForTests, clearAll, initNativeStore, type NativePrefs } from '../../src/v3/platform/store';

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

const g = globalThis as { localStorage?: Storage };
let prev: Storage | undefined;

beforeEach(() => {
  prev = g.localStorage;
  g.localStorage = memStorage();
  _resetStoreForTests();
});

afterEach(() => {
  g.localStorage = prev;
  _resetStoreForTests();
});

describe('seen types', () => {
  it('a fresh save has met nothing', () => {
    expect(seenTypes().size).toBe(0);
    expect(hasSeen('threat:drone')).toBe(false);
    expect(g.localStorage!.getItem(SEEN_KEY)).toBeNull();
  });

  it('a type is new once, then remembered, in a versioned record', () => {
    expect(meet('threat:drone')).toBe(true);
    expect(meet('threat:drone')).toBe(false);
    expect(meet('weapon:railgun')).toBe(true);
    expect(hasSeen('threat:drone')).toBe(true);
    expect(JSON.parse(g.localStorage!.getItem(SEEN_KEY)!)).toEqual({ v: SEEN_VERSION, ids: ['threat:drone', 'weapon:railgun'] });
  });

  it('survives a reload (storage is read afresh: another map, another mode)', () => {
    meet('threat:drone');
    meet('launcher:sub');
    const saved = g.localStorage!.getItem(SEEN_KEY)!;
    // A new session on the same device: only what was stored.
    g.localStorage = memStorage({ [SEEN_KEY]: saved });
    expect(meet('threat:drone')).toBe(false);
    expect(meet('launcher:sub')).toBe(false);
    expect(meet('threat:guided')).toBe(true);
  });

  it('survives a reload on the native app too (the key is one native loads)', async () => {
    expect(KEYS).toContain(SEEN_KEY);
    const m = new Map<string, string>();
    const prefs: NativePrefs = {
      get: async ({ key }) => ({ value: m.get(key) ?? null }),
      set: async ({ key, value }) => void m.set(key, value),
      remove: async ({ key }) => void m.delete(key),
    };
    await initNativeStore(prefs);
    meet('threat:drone');
    await Promise.resolve();
    _resetStoreForTests();
    await initNativeStore(prefs);
    expect(hasSeen('threat:drone')).toBe(true);
  });

  it('Show tips again clears every type, and the first-run tips', () => {
    meet('threat:drone');
    meet('tip:basics');
    clearSeen();
    expect(seenTypes().size).toBe(0);
    expect(meet('threat:drone')).toBe(true);
    expect(meet('tip:basics')).toBe(true);
  });

  it('Reset progress clears it too', () => {
    meet('threat:drone');
    clearAll(['straitwatch.v3.progress', SEEN_KEY, LEGACY_TIPS_KEY, 'straitwatch.v3.freeplay']);
    expect(hasSeen('threat:drone')).toBe(false);
  });

  it('migrates an old save\'s tip list once: its types kept, the first-run how-to done', () => {
    g.localStorage = memStorage({ [LEGACY_TIPS_KEY]: JSON.stringify(['debut:drone', 'vector:sub', 'pickup:shield', 'radar', 'FORMATIONS', 'MORE SHIPS, MORE POINTS', 'something else']) });
    const ids = [...seenTypes()].sort();
    expect(ids).toEqual(['launcher:sub', 'pickup:shield', 'post:radar', 'threat:drone', 'tip:basics', 'tip:formations', 'tip:ships']);
    // Converted for good: the new record written, the old list gone.
    expect(g.localStorage!.getItem(LEGACY_TIPS_KEY)).toBeNull();
    expect(JSON.parse(g.localStorage!.getItem(SEEN_KEY)!).v).toBe(SEEN_VERSION);
    expect(meet('threat:drone')).toBe(false);
    expect(meet('threat:guided')).toBe(true);
  });

  it('an empty or unreadable old list is a fresh save', () => {
    g.localStorage = memStorage({ [LEGACY_TIPS_KEY]: '[]' });
    expect(seenTypes().size).toBe(0);
    g.localStorage = memStorage({ [LEGACY_TIPS_KEY]: 'not json' });
    expect(seenTypes().size).toBe(0);
    expect(meet('threat:drone')).toBe(true);
  });

  it('a damaged record reads as nothing met; a newer version\'s ids are still read', () => {
    g.localStorage = memStorage({ [SEEN_KEY]: '{oops' });
    expect(seenTypes().size).toBe(0);
    g.localStorage = memStorage({ [SEEN_KEY]: JSON.stringify({ v: SEEN_VERSION + 1, ids: ['threat:drone', 7] }) });
    expect([...seenTypes()]).toEqual(['threat:drone']);
  });

  it('without storage every type is new, and nothing throws', () => {
    g.localStorage = undefined;
    expect(meet('threat:drone')).toBe(true);
    expect(meet('threat:drone')).toBe(true);
    expect(hasSeen('threat:drone')).toBe(false);
    expect(() => clearSeen()).not.toThrow();
  });
});
