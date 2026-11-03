import { beforeEach, describe, expect, it, vi } from 'vitest';

// The App Store flavour: chapter 1 free, 2–4 behind the unlock.
vi.mock('../../src/v3/platform/flavor', () => ({ STORE: true, VERSION: '1.0.0', PRIVACY_URL: 'https://example.invalid/privacy' }));

import { _resetUnlockForTests, buyFullGame, chapterOwned, onEntitlementChange, ownsFullGame, purchasesAvailable, restoreFullGame, setPurchaseBackend, type PurchaseBackend } from '../../src/v3/platform/unlock';
import { _resetStoreForTests, kv } from '../../src/v3/platform/store';

function memStorage(): Storage {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, clear: () => m.clear(), getItem: (k) => m.get(k) ?? null, key: (i) => [...m.keys()][i] ?? null, removeItem: (k) => void m.delete(k), setItem: (k, v) => void m.set(k, String(v)) };
}

function backend(over: Partial<PurchaseBackend> = {}): PurchaseBackend {
  return { price: async () => '$2.99', buy: async () => true, restore: async () => false, owned: async () => null, ...over };
}

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = memStorage();
  _resetStoreForTests();
  _resetUnlockForTests();
});

describe('full-game unlock (store flavour)', () => {
  it('starts with chapter 1 only, and no purchases without a backend', async () => {
    expect(ownsFullGame()).toBe(false);
    expect([1, 2, 3, 4].map(chapterOwned)).toEqual([true, false, false, false]);
    expect(purchasesAvailable()).toBe(false);
    expect(await buyFullGame()).toBe(false);
  });

  it('a purchase opens every chapter, is remembered, and notifies', async () => {
    let changes = 0;
    onEntitlementChange(() => changes++);
    setPurchaseBackend(backend());
    expect(await buyFullGame()).toBe(true);
    expect(ownsFullGame()).toBe(true);
    expect(kv.getItem('straitwatch.v3.fullgame')).toBe('1');
    expect(changes).toBe(1);
  });

  it('a cancelled or failed purchase changes nothing', async () => {
    setPurchaseBackend(backend({ buy: async () => false }));
    expect(await buyFullGame()).toBe(false);
    setPurchaseBackend(backend({ buy: async () => Promise.reject(new Error('cancelled')) }));
    expect(await buyFullGame()).toBe(false);
    expect(ownsFullGame()).toBe(false);
  });

  it('restore finds an earlier purchase', async () => {
    setPurchaseBackend(backend({ restore: async () => true }));
    expect(await restoreFullGame()).toBe(true);
    expect(chapterOwned(4)).toBe(true);
  });

  it('launch refresh: StoreKit says owned → unlocked; says not owned (refund) → locked; unknown → cache kept', async () => {
    setPurchaseBackend(backend({ owned: async () => true }));
    await vi.waitFor(() => expect(ownsFullGame()).toBe(true));
    setPurchaseBackend(backend({ owned: async () => null }));
    await Promise.resolve();
    expect(ownsFullGame()).toBe(true);
    setPurchaseBackend(backend({ owned: async () => false }));
    await vi.waitFor(() => expect(ownsFullGame()).toBe(false));
  });
});
