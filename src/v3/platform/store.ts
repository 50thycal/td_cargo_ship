// The one storage seam for V3. Every key the game keeps goes through `kv`.
//
// - Web (Vercel, dev, tests, the store bundle in a plain browser): `kv` is
//   localStorage, read live each call (tests swap `globalThis.localStorage`).
// - Native (the Capacitor iOS app): WKWebView's localStorage can be evicted
//   by iOS under storage pressure, so progress lives in Preferences
//   (UserDefaults). `initStore()` loads every key into memory once, before
//   the game starts; reads stay synchronous against that copy and writes go
//   to memory at once and to Preferences in the background.
//
// First native launch: any value already in localStorage (a TestFlight build
// that ran before this seam, or the web view's own store) is copied across
// once, so no progress is lost in the move.

/** Every key V3 stores. Keep this list complete: native loads only these. */
export const KEYS = [
  'straitwatch.v3.progress',
  'straitwatch-v3-audio',
  'straitwatch.v3.tips',
  'straitwatch.v3.freeplay',
  'straitwatch.v3.notes',
  'straitwatch.v3.dev',
  'straitwatch.v3.dev.settings',
  'straitwatch.v3.playlogs',
  'straitwatch.v3.playlogs.sent',
  'straitwatch.v3.haptics',
  'straitwatch.v3.fullgame',
  // Settings: which call-outs show in play (ui/alerts.ts).
  'straitwatch.v3.callouts',
  // The Test Lab: what has been tested, and the last tests' logs to rewatch.
  'straitwatch.v3.lab',
  'straitwatch.v3.lab.logs',
] as const;

/** Set once the localStorage → Preferences copy has run. */
const MIGRATED = 'straitwatch.v3.migrated';

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Where native writes go: the subset of @capacitor/preferences we use. */
export interface NativePrefs {
  get(o: { key: string }): Promise<{ value: string | null }>;
  set(o: { key: string; value: string }): Promise<void>;
  remove(o: { key: string }): Promise<void>;
}

function local(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

/** Web: straight through to localStorage. Throws exactly as it would. */
const webKV: KV = {
  getItem: (k) => {
    const ls = local();
    if (!ls) throw new Error('no localStorage');
    return ls.getItem(k);
  },
  setItem: (k, v) => {
    const ls = local();
    if (!ls) throw new Error('no localStorage');
    ls.setItem(k, v);
  },
  removeItem: (k) => {
    const ls = local();
    if (!ls) throw new Error('no localStorage');
    ls.removeItem(k);
  },
};

let native: { prefs: NativePrefs; mem: Map<string, string>; pending: Set<Promise<unknown>> } | null = null;

function track(p: Promise<unknown>): void {
  if (!native) return;
  const set = native.pending;
  const q = p.catch(() => undefined).finally(() => set.delete(q));
  set.add(q);
}

const nativeKV: KV = {
  getItem: (k) => native!.mem.get(k) ?? null,
  setItem: (k, v) => {
    native!.mem.set(k, v);
    track(native!.prefs.set({ key: k, value: v }));
  },
  removeItem: (k) => {
    native!.mem.delete(k);
    track(native!.prefs.remove({ key: k }));
  },
};

/** The game's storage. Same contract as localStorage. */
export const kv: KV = {
  getItem: (k) => (native ? nativeKV : webKV).getItem(k),
  setItem: (k, v) => (native ? nativeKV : webKV).setItem(k, v),
  removeItem: (k) => (native ? nativeKV : webKV).removeItem(k),
};

/** Load every key from native storage into memory and switch `kv` over to
 *  it; copy localStorage across the first time. Call once, before the game
 *  reads anything. `prefs` is null on the web (nothing to do). */
export async function initNativeStore(prefs: NativePrefs | null): Promise<void> {
  if (!prefs) return;
  const mem = new Map<string, string>();
  const migrated = (await prefs.get({ key: MIGRATED }).catch(() => ({ value: null }))).value === '1';
  const ls = local();
  for (const key of KEYS) {
    let value = (await prefs.get({ key }).catch(() => ({ value: null }))).value;
    if (value === null && !migrated && ls) {
      try {
        value = ls.getItem(key);
      } catch {
        value = null;
      }
      if (value !== null) await prefs.set({ key, value }).catch(() => undefined);
    }
    if (value !== null) mem.set(key, value);
  }
  if (!migrated) await prefs.set({ key: MIGRATED, value: '1' }).catch(() => undefined);
  native = { prefs, mem, pending: new Set() };
}

/** Wait for every native write so far (the app is going to the background). */
export async function flushStore(): Promise<void> {
  while (native && native.pending.size) await Promise.all([...native.pending]);
}

/** Forget every stored key: Settings → Reset progress. */
export function clearAll(keys: readonly string[] = KEYS): void {
  for (const k of keys) {
    try {
      kv.removeItem(k);
    } catch {
      // nothing stored to clear
    }
  }
}

/** Tests: back to the web backend. */
export function _resetStoreForTests(): void {
  native = null;
}
