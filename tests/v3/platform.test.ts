import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KEYS, _resetStoreForTests, clearAll, flushStore, initNativeStore, kv, type NativePrefs } from '../../src/v3/platform/store';
import { HAPTIC_GAP, _resetHapticsForTests, haptic, hapticForCue, setHapticBackend, setHapticsEnabled } from '../../src/v3/platform/haptics';
import { ACHIEVEMENTS, _resetGameCenterForTests, earned, leaderboardId, setGameCenterBackend, submitBest, unlock } from '../../src/v3/platform/gamecenter';
import { _resetUnlockForTests, chapterOwned, ownsFullGame } from '../../src/v3/platform/unlock';
import { loadProgress, recordResult, saveProgress } from '../../src/v3/platform/save';
import { MAP_ORDER } from '../../src/v3/data/maps';

/** A localStorage stand-in. */
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

/** Preferences stand-in, with a log of writes and a switch to slow them. */
function fakePrefs(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  const writes: string[] = [];
  let hold: Promise<void> | null = null;
  const prefs: NativePrefs = {
    get: async ({ key }) => ({ value: m.get(key) ?? null }),
    set: async ({ key, value }) => {
      if (hold) await hold;
      m.set(key, value);
      writes.push(`set ${key}`);
    },
    remove: async ({ key }) => {
      if (hold) await hold;
      m.delete(key);
      writes.push(`remove ${key}`);
    },
  };
  return {
    prefs,
    m,
    writes,
    holdWrites() {
      let release!: () => void;
      hold = new Promise((r) => (release = r));
      return () => {
        hold = null;
        release();
      };
    },
  };
}

const g = globalThis as { localStorage?: Storage };
let prevLs: Storage | undefined;

beforeEach(() => {
  prevLs = g.localStorage;
  g.localStorage = memStorage();
  _resetStoreForTests();
  _resetHapticsForTests();
  _resetGameCenterForTests();
  _resetUnlockForTests();
});

afterEach(() => {
  g.localStorage = prevLs;
  _resetStoreForTests();
});

describe('storage seam', () => {
  it('is plain localStorage on the web', () => {
    kv.setItem('straitwatch.v3.tips', '["a"]');
    expect(g.localStorage!.getItem('straitwatch.v3.tips')).toBe('["a"]');
    g.localStorage!.setItem('straitwatch.v3.freeplay', 'x');
    expect(kv.getItem('straitwatch.v3.freeplay')).toBe('x');
  });

  it('throws like localStorage when there is none (callers already catch)', () => {
    g.localStorage = undefined;
    expect(() => kv.getItem('k')).toThrow();
    // save.ts swallows it: progress just lasts for the session.
    expect(loadProgress().unlocked).toBe(1);
  });

  it('native: loads every key into memory, reads sync, writes through', async () => {
    const f = fakePrefs({ 'straitwatch.v3.progress': '{"unlocked":3}', 'straitwatch.v3.migrated': '1' });
    await initNativeStore(f.prefs);
    expect(kv.getItem('straitwatch.v3.progress')).toBe('{"unlocked":3}');
    kv.setItem('straitwatch.v3.tips', '["t"]');
    // Synchronous read-your-write, before Preferences has it.
    expect(kv.getItem('straitwatch.v3.tips')).toBe('["t"]');
    await flushStore();
    expect(f.m.get('straitwatch.v3.tips')).toBe('["t"]');
    // localStorage is no longer written on native.
    expect(g.localStorage!.getItem('straitwatch.v3.tips')).toBeNull();
    kv.removeItem('straitwatch.v3.tips');
    expect(kv.getItem('straitwatch.v3.tips')).toBeNull();
    await flushStore();
    expect(f.m.has('straitwatch.v3.tips')).toBe(false);
  });

  it('native: copies localStorage across on the first launch only', async () => {
    g.localStorage = memStorage({ 'straitwatch.v3.progress': '{"unlocked":7}', 'straitwatch-v3-audio': '{"muted":true}' });
    const f = fakePrefs();
    await initNativeStore(f.prefs);
    expect(kv.getItem('straitwatch.v3.progress')).toBe('{"unlocked":7}');
    expect(f.m.get('straitwatch.v3.progress')).toBe('{"unlocked":7}');
    expect(f.m.get('straitwatch-v3-audio')).toBe('{"muted":true}');
    expect(f.m.get('straitwatch.v3.migrated')).toBe('1');
    // A later launch never pulls a stale web value back over native.
    kv.removeItem('straitwatch.v3.progress');
    await flushStore();
    _resetStoreForTests();
    await initNativeStore(f.prefs);
    expect(kv.getItem('straitwatch.v3.progress')).toBeNull();
  });

  it('native: a value already in Preferences wins over localStorage', async () => {
    g.localStorage = memStorage({ 'straitwatch.v3.progress': '{"unlocked":2}' });
    const f = fakePrefs({ 'straitwatch.v3.progress': '{"unlocked":9}' });
    await initNativeStore(f.prefs);
    expect(kv.getItem('straitwatch.v3.progress')).toBe('{"unlocked":9}');
  });

  it('flushStore waits for slow writes', async () => {
    const f = fakePrefs({ 'straitwatch.v3.migrated': '1' });
    await initNativeStore(f.prefs);
    const release = f.holdWrites();
    kv.setItem('straitwatch.v3.progress', '{}');
    let done = false;
    const p = flushStore().then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    release();
    await p;
    expect(f.m.get('straitwatch.v3.progress')).toBe('{}');
  });

  it('a whole run round-trips through native storage', async () => {
    const f = fakePrefs({ 'straitwatch.v3.migrated': '1' });
    await initNativeStore(f.prefs);
    const p = loadProgress();
    recordResult(p, MAP_ORDER[0], { score: 1234, wave: 10, cleared: true, wavesCleared: 10 }, () => 0);
    await flushStore();
    _resetStoreForTests();
    await initNativeStore(f.prefs);
    const back = loadProgress();
    expect(back.unlocked).toBe(2);
    expect(back.best[MAP_ORDER[0]]?.score).toBe(1234);
    expect(back.cleared).toEqual([MAP_ORDER[0]]);
  });

  it('clearAll resets only the keys asked for', () => {
    saveProgress({ ...loadProgress(), unlocked: 5 });
    kv.setItem('straitwatch-v3-audio', '{"muted":true}');
    clearAll(['straitwatch.v3.progress']);
    expect(loadProgress().unlocked).toBe(1);
    expect(kv.getItem('straitwatch-v3-audio')).toBe('{"muted":true}');
  });

  it('KEYS lists every key the V3 sources store', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const found = new Set<string>();
    const walk = (dir: string) => {
      for (const d of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, d.name);
        if (d.isDirectory()) walk(p);
        else if (p.endsWith('.ts')) for (const m of readFileSync(p, 'utf8').matchAll(/'(straitwatch[.-]v3[.-][a-z.]+)'/g)) found.add(m[1]);
      }
    };
    walk(join(__dirname, '../../src/v3'));
    found.delete('straitwatch.v3.migrated');
    for (const k of found) expect(KEYS as readonly string[]).toContain(k);
  });
});

describe('haptics', () => {
  it('does nothing without a native backend', () => {
    expect(haptic('light', 0)).toBe(false);
  });

  it('throttles each kind, and the switch turns them off', () => {
    const fired: string[] = [];
    setHapticBackend({ impact: (s) => fired.push(s), success: () => fired.push('success') });
    expect(haptic('light', 1000)).toBe(true);
    expect(haptic('light', 1000 + HAPTIC_GAP.light - 1)).toBe(false);
    expect(haptic('medium', 1001)).toBe(true);
    expect(haptic('light', 1000 + HAPTIC_GAP.light)).toBe(true);
    expect(haptic('success', 1002)).toBe(true);
    expect(fired).toEqual(['light', 'medium', 'light', 'success']);
    setHapticsEnabled(false);
    expect(haptic('success', 99999)).toBe(false);
    setHapticsEnabled(true);
    expect(haptic('success', 99999)).toBe(true);
  });

  it('maps sim cues to haptics', () => {
    expect(hapticForCue('kill.small')).toBe('light');
    expect(hapticForCue('kill.big')).toBe('light');
    expect(hapticForCue('ship.sunk')).toBe('medium');
    expect(hapticForCue('carrier.hit')).toBe('medium');
    expect(hapticForCue('gun.fire')).toBeNull();
  });
});

describe('game center', () => {
  it('ids are stable and unique', () => {
    const ids = MAP_ORDER.map(leaderboardId);
    expect(new Set(ids).size).toBe(MAP_ORDER.length);
    expect(ids[0]).toBe(`straitwatch.best.${MAP_ORDER[0]}`);
    const ach = Object.values(ACHIEVEMENTS).map((a) => a.id);
    expect(new Set(ach).size).toBe(ach.length);
  });

  it('earned: first clear, chapters, cards, endless', () => {
    expect(earned({ cleared: [], cards: 0 })).toEqual([]);
    expect(earned({ cleared: [MAP_ORDER[0]], cards: 0 })).toEqual(['firstClear']);
    expect(earned({ cleared: MAP_ORDER.slice(0, 5), cards: 10 }, 20)).toEqual(['firstClear', 'chapter1', 'armory10', 'endless20']);
    expect(earned({ cleared: [...MAP_ORDER], cards: 0 })).toContain('chapter4');
  });

  it('reports only once signed in', async () => {
    const sent: string[] = [];
    const backend = {
      authenticate: async () => false,
      submitScore: async (id: string, s: number) => void sent.push(`${id}=${s}`),
      reportAchievement: async (id: string) => void sent.push(id),
      showDashboard: async () => undefined,
    };
    await setGameCenterBackend(backend);
    submitBest(MAP_ORDER[0], 100);
    expect(sent).toEqual([]);
    await setGameCenterBackend({ ...backend, authenticate: async () => true });
    submitBest(MAP_ORDER[0], 100.7);
    submitBest(MAP_ORDER[0], 0);
    unlock('firstClear');
    await Promise.resolve();
    expect(sent).toEqual([`straitwatch.best.${MAP_ORDER[0]}=100`, ACHIEVEMENTS.firstClear.id]);
  });
});

describe('full-game unlock (playtest flavour)', () => {
  it('owns every chapter outside the store build', () => {
    expect(ownsFullGame()).toBe(true);
    for (const c of [1, 2, 3, 4]) expect(chapterOwned(c)).toBe(true);
  });
});
