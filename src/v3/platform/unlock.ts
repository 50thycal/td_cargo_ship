// The full-game unlock: one non-consumable in-app purchase. Chapter 1 (Home
// Waters, maps 1–5) is free; chapters 2–4 need the unlock. The playtest
// flavour owns everything.
//
// Native: StoreKit 2 through @capgo/native-purchases (platform/native.ts sets
// the backend). The entitlement is cached in `kv` so the game knows at once
// on launch, and refreshed from StoreKit's current entitlements in the
// background (which also clears it after a refund).

import { STORE } from './flavor';
import { kv } from './store';

export const PRODUCT_ID = 'com.appfarm.straitwatch.fullgame';
/** Chapters playable without the unlock. */
export const FREE_CHAPTERS = 1;
const KEY = 'straitwatch.v3.fullgame';

export interface PurchaseBackend {
  /** The localized price, e.g. "$2.99", or null if the store can't say. */
  price(): Promise<string | null>;
  /** Run the purchase sheet. True if the unlock is now owned. */
  buy(): Promise<boolean>;
  /** Restore purchases. True if the unlock is owned. */
  restore(): Promise<boolean>;
  /** Is the unlock in the current entitlements? null: couldn't tell. */
  owned(): Promise<boolean | null>;
}

let backend: PurchaseBackend | null = null;
const listeners = new Set<() => void>();

function cached(): boolean {
  try {
    return kv.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function setOwned(on: boolean): void {
  const was = cached();
  try {
    if (on) kv.setItem(KEY, '1');
    else kv.removeItem(KEY);
  } catch {
    // session only
  }
  if (was !== on) for (const f of listeners) f();
}

export function setPurchaseBackend(b: PurchaseBackend | null): void {
  backend = b;
  if (b) void b.owned().then((o) => o !== null && setOwned(o), () => undefined);
}

export function purchasesAvailable(): boolean {
  return backend !== null;
}

export function ownsFullGame(): boolean {
  return !STORE || cached();
}

export function chapterOwned(chapter: number): boolean {
  return chapter <= FREE_CHAPTERS || ownsFullGame();
}

export function onEntitlementChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

export async function unlockPrice(): Promise<string | null> {
  return backend ? backend.price().catch(() => null) : null;
}

export async function buyFullGame(): Promise<boolean> {
  if (!backend) return false;
  const ok = await backend.buy().catch(() => false);
  if (ok) setOwned(true);
  return ok;
}

export async function restoreFullGame(): Promise<boolean> {
  if (!backend) return false;
  const ok = await backend.restore().catch(() => false);
  setOwned(ok);
  return ok;
}

/** Tests. */
export function _resetUnlockForTests(): void {
  backend = null;
  listeners.clear();
}
