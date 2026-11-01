// THE MIX RULES, shared by the browser engine (engine.ts) and the offline
// renderer (tools/v3/audio/render.ts): which cue plays, which variant, at
// what pitch, pan and gain, and when the sfx bus ducks. Pure: no Web Audio,
// no DOM, and its own seeded random numbers, so an offline render makes
// exactly the decisions the game would.

import { VIEW } from '../data/config';
import type { Cue, CueId } from './cues';
import { MAX_VOICES, SOUNDS, type Bus } from './manifest';

export interface Voice {
  id: CueId;
  file: string;
  bus: Bus;
  /** Real time it starts and ends (ms). */
  start: number;
  end: number;
  rate: number;
  gain: number;
  /** -1 (left) .. 1 (right) at the start, and how fast it moves (per s). */
  pan: number;
  panRate: number;
}

export interface Duck {
  start: number;
  end: number;
  /** sfx bus gain while ducked (0..1). */
  depth: number;
}

/** Pan from a world x: the edges of the view are ±0.8, never hard left/right. */
export function panOf(x: number): number {
  return Math.max(-0.8, Math.min(0.8, ((x / VIEW.width) * 2 - 1) * 0.8));
}

/** How long sfx stay ducked under an alert, at most (or the manifest's
 *  duckMs). Round 4: 450 ms let a 1.5 s siren drown under a busy wave. */
export const DUCK_MS = 1000;

/** Density gain: with more than DENSITY effects sounding, each new one
 *  plays quieter (by the square root of the crowd), so a busy wave thickens
 *  instead of getting louder (round 4: busy moments spiked 7-8 LU). */
export const DENSITY = 4;
export function densityGain(sfxVoices: number): number {
  return sfxVoices <= DENSITY ? 1 : Math.sqrt(DENSITY / sfxVoices);
}

/** Time Warp: sfx play a little lower and slower. */
export const WARP_RATE = 0.88;

export class MixPolicy {
  private last = new Map<CueId, number>();
  private robin = new Map<CueId, number>();
  private voices: Voice[] = [];
  private seed: number;
  /** Plays refused, by reason (the tests and the render report read it). */
  readonly dropped = { cooldown: 0, cueCap: 0, globalCap: 0 };

  constructor(
    /** Seconds a file lasts at rate 1 (known once it is decoded). */
    private duration: (file: string) => number,
    seed = 1,
  ) {
    this.seed = seed >>> 0 || 1;
  }

  private rand(): number {
    // xorshift32
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 4294967296;
  }

  /** Voices still sounding at `now`. */
  active(now: number): Voice[] {
    this.voices = this.voices.filter((v) => v.end > now);
    return this.voices;
  }

  /** Decide one cue at real time `now` (ms). Null: it doesn't play. `warp`:
   *  Time Warp is on (sfx pitched down). */
  decide(cue: Cue, now: number, warp = false): Voice | null {
    const def = SOUNDS[cue.id];
    const live = this.active(now);
    const last = this.last.get(cue.id);
    if (def.cooldownMs && last !== undefined && now - last < def.cooldownMs) {
      this.dropped.cooldown++;
      return null;
    }
    if (def.maxVoices && live.filter((v) => v.id === cue.id).length >= def.maxVoices) {
      this.dropped.cueCap++;
      return null;
    }
    // At the global cap only alerts and UI get through: they carry
    // information the player must not miss.
    if (live.length >= MAX_VOICES && def.bus !== 'alert' && def.bus !== 'ui') {
      this.dropped.globalCap++;
      return null;
    }
    const k = this.robin.get(cue.id) ?? Math.floor(this.rand() * def.files.length);
    this.robin.set(cue.id, (k + 1) % def.files.length);
    const file = def.files[k % def.files.length];
    let rate = def.pitch ? def.pitch[0] + (def.pitch[1] - def.pitch[0]) * this.rand() : 1;
    if (warp && def.bus === 'sfx') rate *= WARP_RATE;
    const dur = (this.duration(file) / rate) * 1000;
    const pan = panOf(cue.x);
    const panRate = def.moving && cue.vx ? ((cue.vx / VIEW.width) * 2 * 0.8) : 0;
    const crowd = def.bus === 'sfx' ? densityGain(live.filter((o) => o.bus === 'sfx').length + 1) : 1;
    const v: Voice = { id: cue.id, file, bus: def.bus, start: now, end: now + dur, rate, gain: def.volume * (cue.gain ?? 1) * crowd, pan, panRate };
    this.last.set(cue.id, now);
    this.voices.push(v);
    return v;
  }

  /** The duck an alert brings, if it ducks. */
  duckFor(v: Voice): Duck | null {
    const d = SOUNDS[v.id].duck;
    if (v.bus !== 'alert' || d === undefined || d >= 1) return null;
    return { start: v.start, end: v.start + Math.min(SOUNDS[v.id].duckMs ?? DUCK_MS, v.end - v.start), depth: d };
  }
}

/** Music director: which bed should play, with hysteresis so a crowded
 *  moment doesn't flip the battle music back and forth. */
export class MusicDirector {
  current: CueId | null = null;
  private since = -Infinity;
  constructor(private holdMs = 8000) {}

  /** The bed to play now, given the one the game wants. */
  pick(want: CueId | null, now: number): CueId | null {
    if (want === this.current) return want;
    // Calm ↔ intense waits out the hold; any other change is immediate.
    const battle = (id: CueId | null) => id === 'battle.music' || id === 'battle.intense';
    if (battle(want) && battle(this.current) && now - this.since < this.holdMs) return this.current;
    this.current = want;
    this.since = now;
    return want;
  }
}
