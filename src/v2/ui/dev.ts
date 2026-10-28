// Developer playtest mode (round 8: "speed up my playtesting… a mode that I
// can enable that's only for a developer"). Off by default; the menu's
// Settings screen switches it on for this device (remembered). `?dev=1` /
// `?dev=0` in the URL do the same.
//
// A full run is ~8 minutes of waves plus the drafts. Each preset halves the
// previous one with one lever, and none of them thins the screen out:
//   ½  waves 0.4× as long with their launches cut to match (same density,
//      every threat type still shows up), loss limit 3 instead of 6;
//   ¼  also plays every other wave (2, 4, 6, 8, 10), drafting a card for each
//      wave skipped so the build keeps pace; loss limit 2;
//   ⅛  the ¼ run at 2×, the fastest speed the real game has.
// Measured with the bots (tools/v2: average skill, 12 seeds a map): waves take
// ~490 s / 230 s / 132 s / 66 s, and the win rate holds (Island 6/12, 6/12, 5/12).
// Every dev log carries its tempo, so it replays exactly and stays out of the
// balance numbers.

import { RULES } from '../data/config';
import { FULL_TEMPO, nextPlayedWave, type Tempo } from '../sim/game';

export type DevPreset = 'full' | 'half' | 'quarter' | 'eighth';

export interface PresetDef {
  label: string;
  tempo: Tempo;
  /** Speed slider value the run starts at. */
  speed: number;
  blurb: string;
}

const SHORT = 0.4;

export const DEV_PRESETS: Record<DevPreset, PresetDef> = {
  full: { label: 'Full', tempo: FULL_TEMPO, speed: 1, blurb: 'The real game. About 8 min of waves.' },
  half: {
    label: '½',
    tempo: { waveLen: SHORT, stride: 1, lossLimit: 3 },
    speed: 1,
    blurb: 'Every wave, 0.4× as long, just as busy. Lose at 3 ships. About 4 min.',
  },
  quarter: {
    label: '¼',
    tempo: { waveLen: SHORT, stride: 2, lossLimit: 2 },
    speed: 1,
    blurb: 'Short waves 2, 4, 6, 8, 10; a card for each wave skipped. Lose at 2. About 2 min.',
  },
  eighth: {
    label: '⅛',
    tempo: { waveLen: SHORT, stride: 2, lossLimit: 2 },
    speed: 2,
    blurb: 'The ¼ run at 2× speed. About 1 min.',
  },
};

export const DEV_ORDER: DevPreset[] = ['full', 'half', 'quarter', 'eighth'];

export interface DevSettings {
  preset: DevPreset;
  /** Wave the run starts on (earlier cards auto-drafted). */
  wave: number;
  /** Watch mode: the you-bot plays; you watch, take over, flag moments. */
  watch: boolean;
  /** The speed a watched run starts at (the last one used). */
  watchSpeed: number;
}

const FLAG = 'straitwatch.v2.dev';
const SETTINGS = 'straitwatch.v2.dev.settings';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode / blocked storage: dev mode just won't be remembered.
  }
}

/** Is dev mode on? Reads and remembers `?dev=1` / `?dev=0`. */
export function devEnabled(): boolean {
  const q = new URLSearchParams(location.search).get('dev');
  if (q === '1') write(FLAG, '1');
  if (q === '0') write(FLAG, null);
  return q === '1' || (q !== '0' && read(FLAG) === '1');
}

export function setDevEnabled(on: boolean): void {
  write(FLAG, on ? '1' : null);
}

export function loadDevSettings(): DevSettings {
  try {
    const s = JSON.parse(read(SETTINGS) ?? '{}') as Partial<DevSettings>;
    return {
      preset: s.preset && s.preset in DEV_PRESETS ? s.preset : 'half',
      wave: Math.max(1, Math.min(RULES.wavesToClear, Math.floor(s.wave ?? 1))),
      watch: s.watch === true,
      watchSpeed: typeof s.watchSpeed === 'number' ? s.watchSpeed : 1,
    };
  } catch {
    return { preset: 'half', wave: 1, watch: false, watchSpeed: 1 };
  }
}

export function saveDevSettings(s: DevSettings): void {
  write(SETTINGS, JSON.stringify(s));
}

/** The first wave a run plays: the chosen start, moved up to one the stride
 *  plays (so a ¼ run from wave 1 opens on wave 2, its wave-1 card drafted). */
export function firstPlayedWave(start: number, tempo: Tempo): number {
  return tempo.stride > 1 ? nextPlayedWave(start - 1, tempo.stride) : start;
}
