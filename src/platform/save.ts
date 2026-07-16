// Versioned local save. localStorage on the web today; the same interface
// backed by iOS-native storage after the Capacitor port. Falls back to an
// in-memory store so the sim layer stays testable in Node.

import { SAVE_VERSION } from '../sim/campaign';
import type { CampaignState } from '../sim/types';

const KEY = 'straitwatch.campaign.v1';

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const store: KeyValueStore =
  typeof localStorage !== 'undefined' ? localStorage : memoryStore();

export function saveCampaign(c: CampaignState): void {
  try {
    store.setItem(KEY, JSON.stringify({ v: SAVE_VERSION, campaign: c }));
  } catch {
    // Quota/serialization failures must never crash the game loop.
  }
}

export function loadCampaign(): CampaignState | null {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v: number; campaign: CampaignState };
    if (parsed.v !== SAVE_VERSION || !parsed.campaign) return null;
    // Forward-compatible defaults for fields added after a save was written.
    parsed.campaign.escortDamage ??= 0;
    parsed.campaign.baseDamage ??= 0;
    parsed.campaign.droneAmmo ??= 0;
    parsed.campaign.pdAmmo ??= 0;
    parsed.campaign.modulePaid ??= { cargo: {}, tanker: {}, freighter: {} };
    return parsed.campaign;
  } catch {
    return null;
  }
}

export function clearCampaign(): void {
  try {
    store.removeItem(KEY);
  } catch {
    // ignore
  }
}
