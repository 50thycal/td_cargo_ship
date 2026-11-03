// Haptics: a light tap on a kill, a heavier one when a ship is lost or the
// carrier is hit, and a success pattern for a cleared map or a card won.
// Only the native app has a backend (platform/native.ts); on the web every
// call is a no-op. Busy waves fire many kills a second, so each kind is
// throttled, and a Settings switch turns them all off.

import { kv } from './store';

export type HapticKind = 'light' | 'medium' | 'success';

export interface HapticBackend {
  impact(style: 'light' | 'medium'): void;
  success(): void;
}

const KEY = 'straitwatch.v3.haptics';
/** Minimum gap between two haptics of one kind, in ms. */
export const HAPTIC_GAP: Record<HapticKind, number> = { light: 90, medium: 250, success: 600 };

let backend: HapticBackend | null = null;
const last: Record<HapticKind, number> = { light: -Infinity, medium: -Infinity, success: -Infinity };

export function setHapticBackend(b: HapticBackend | null): void {
  backend = b;
}

/** Is there anything to feel on this device? (Hides the Settings row.) */
export function hapticsAvailable(): boolean {
  return backend !== null;
}

export function hapticsEnabled(): boolean {
  try {
    return kv.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean): void {
  try {
    kv.setItem(KEY, on ? '1' : '0');
  } catch {
    // not remembered
  }
}

/** Fire one haptic, unless off, unavailable, or too soon after the last of
 *  its kind. Returns whether it fired (for tests). */
export function haptic(kind: HapticKind, now: number = performance.now()): boolean {
  if (!backend || !hapticsEnabled()) return false;
  if (now - last[kind] < HAPTIC_GAP[kind]) return false;
  last[kind] = now;
  if (kind === 'success') backend.success();
  else backend.impact(kind);
  return true;
}

/** The haptic a sim sound cue calls for, if any. */
export function hapticForCue(id: string): HapticKind | null {
  if (id.startsWith('kill.')) return 'light';
  if (id === 'ship.sunk' || id === 'carrier.hit') return 'medium';
  return null;
}

/** Tests. */
export function _resetHapticsForTests(): void {
  backend = null;
  for (const k of Object.keys(last) as HapticKind[]) last[k] = -Infinity;
}
