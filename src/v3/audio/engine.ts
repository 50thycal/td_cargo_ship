// THE SOUND ENGINE (browser only): Web Audio playback of the cues the sim and
// the UI ask for. What plays, at what pitch and pan, is decided by
// MixPolicy (policy.ts), the same rules the offline renderer uses; this file
// only turns those decisions into sound.
//
// - The AudioContext starts on the first pointerdown (iOS only allows audio
//   to begin from a user gesture), and every file is decoded then.
// - Buses: sfx (ducked under alerts), ui, alert, music → master.
// - Loops (burning row, spinning blade, gravity well, supersonic lock,
//   carrier critical) follow the game state each frame.
// - Music beds crossfade by screen; battle music turns intense with the wave.
// - Suspended while the page is hidden; volume, music and mute in Settings.
// - window.__v3.audio exposes a log of every play for the browser tests.

import type { Cue, CueId, LoopCue, MusicCue } from './cues';
import { LOOP_PAD, SOUNDS, type Bus } from './manifest';
import { MixPolicy, MusicDirector, panOf, type Voice } from './policy';
import type { LoopState } from './state';

const STORE_KEY = 'straitwatch-v3-audio';

export interface AudioSettings {
  /** Master volume 0..1. */
  volume: number;
  /** Music level 0..1 (on top of the master). */
  music: number;
  muted: boolean;
}

export const DEFAULT_AUDIO: AudioSettings = { volume: 0.8, music: 0.6, muted: false };

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Partial<AudioSettings> | null;
    return { ...DEFAULT_AUDIO, ...(raw ?? {}) };
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}

function saveAudioSettings(s: AudioSettings): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: the setting lasts this session */
  }
}

export interface PlayLogEntry {
  cue: CueId;
  file: string;
  /** performance.now() when asked, and AudioContext time it was scheduled. */
  wall: number;
  ctx: number;
  /** The sim step it belongs to (-1 for UI). */
  step: number;
  voices: number;
}

interface LoopVoice {
  src: AudioBufferSourceNode;
  gain: GainNode;
  pan: StereoPannerNode | null;
}

const BASE = `${import.meta.env.BASE_URL ?? './'}v3/audio/`;
const MUSIC_FADE = 1.2;

export class AudioEngine {
  settings = loadAudioSettings();
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses = {} as Record<Bus, GainNode>;
  private duck!: GainNode;
  /** A second duck stage, held down while an alert loop sounds. */
  private duckLoops!: GainNode;
  private loopDuck = 1;
  private buffers = new Map<string, AudioBuffer>();
  private loading: Promise<void> | null = null;
  private policy = new MixPolicy((f) => this.buffers.get(f)?.duration ?? 0, (Date.now() & 0xffff) + 1);
  private director = new MusicDirector();
  private loops = new Map<LoopCue, LoopVoice>();
  private music: { id: CueId; src: AudioBufferSourceNode; gain: GainNode; at: number } | null = null;
  private wantMusic: MusicCue | null = null;
  /** Recent plays (newest last), for the browser tests. */
  readonly log: PlayLogEntry[] = [];

  constructor() {
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.visibilityState === 'hidden') void this.ctx.suspend();
      else if (!this.settings.muted) void this.ctx.resume();
    });
  }

  get state(): AudioContextState | 'locked' {
    return this.ctx?.state ?? 'locked';
  }

  /** Create (or resume) the context from a user gesture, then decode. */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));
      this.master = ctx.createGain();
      // A safety limiter: the mix rules keep the busiest renders under
      // -1.7 dBFS (docs/audio/mix-report.md), so this should only ever
      // catch a freak pile-up, never shape the normal mix.
      const safety = ctx.createDynamicsCompressor();
      safety.threshold.value = -3;
      safety.knee.value = 2;
      safety.ratio.value = 20;
      safety.attack.value = 0.002;
      safety.release.value = 0.12;
      this.master.connect(safety);
      safety.connect(ctx.destination);
      for (const b of ['sfx', 'ui', 'alert', 'music'] as Bus[]) {
        this.buses[b] = ctx.createGain();
        this.buses[b].connect(this.master);
      }
      // sfx → duck → sfx bus: alerts dip the duck gain.
      this.duck = ctx.createGain();
      this.duckLoops = ctx.createGain();
      this.duck.connect(this.duckLoops);
      this.duckLoops.connect(this.buses.sfx);
      this.applySettings();
      this.loading = this.loadAll();
    }
    if (this.ctx.state === 'suspended' && !this.settings.muted && document.visibilityState !== 'hidden') void this.ctx.resume();
  }

  private async loadAll(): Promise<void> {
    const files = new Set<string>();
    // Music and the commonest sounds first, so the first seconds are covered.
    for (const def of Object.values(SOUNDS)) for (const f of def.files) files.add(f);
    const order = [...files].sort((a, b) => Number(b.includes('music')) - Number(a.includes('music')));
    await Promise.all(
      order.map(async (f) => {
        try {
          const res = await fetch(BASE + f);
          const buf = await res.arrayBuffer();
          this.buffers.set(f, await this.ctx!.decodeAudioData(buf));
        } catch {
          /* a missing file plays as silence; the asset tests catch it */
        }
      }),
    );
    this.syncMusic();
  }

  /** Resolves once every file has decoded (tests). */
  ready(): Promise<void> {
    return this.loading ?? Promise.resolve();
  }

  setSettings(s: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...s };
    saveAudioSettings(this.settings);
    this.applySettings();
  }

  private applySettings(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.settings;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.volume, t, 0.02);
    this.buses.music.gain.setTargetAtTime(s.music, t, 0.05);
    if (s.muted) void this.ctx.suspend();
    else if (document.visibilityState !== 'hidden') void this.ctx.resume();
  }

  /** Play a cue now. `step`: the sim step it came from (-1 for UI). */
  play(cue: Cue, step = -1, warp = false): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const def = SOUNDS[cue.id];
    if (!def || !this.buffers.has(def.files[0])) return;
    const now = performance.now();
    const v = this.policy.decide(cue, now, warp);
    if (!v) return;
    const buf = this.buffers.get(v.file);
    if (!buf) return;
    this.start(v, buf);
    const d = this.policy.duckFor(v);
    if (d) {
      const t = ctx.currentTime;
      this.duck.gain.cancelScheduledValues(t);
      this.duck.gain.setTargetAtTime(d.depth, t, 0.015);
      this.duck.gain.setTargetAtTime(1, t + (d.end - d.start) / 1000, 0.12);
    }
    this.log.push({ cue: cue.id, file: v.file, wall: now, ctx: ctx.currentTime, step, voices: this.policy.active(now).length });
    if (this.log.length > 400) this.log.splice(0, this.log.length - 400);
  }

  /** A UI sound (no position: centre). */
  ui(id: CueId): void {
    this.play({ id, x: 800, y: 450 });
  }

  private start(v: Voice, buf: AudioBuffer): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = v.rate;
    const g = ctx.createGain();
    g.gain.value = v.gain;
    let node: AudioNode = src;
    node.connect(g);
    node = g;
    if (ctx.createStereoPanner && v.bus !== 'ui') {
      const p = ctx.createStereoPanner();
      const t = ctx.currentTime;
      p.pan.setValueAtTime(v.pan, t);
      if (v.panRate) {
        const dur = (v.end - v.start) / 1000;
        p.pan.linearRampToValueAtTime(Math.max(-0.8, Math.min(0.8, v.pan + v.panRate * dur)), t + dur);
      }
      node.connect(p);
      node = p;
    }
    node.connect(v.bus === 'sfx' ? this.duck : this.buses[v.bus]);
    src.start();
  }

  /** Per frame: the loops the game state calls for. */
  setLoops(want: LoopState[]): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const on = new Set(want.map((l) => l.id));
    for (const [id, lv] of this.loops) {
      if (on.has(id)) continue;
      lv.gain.gain.setTargetAtTime(0, t, 0.08);
      lv.src.stop(t + 0.5);
      this.loops.delete(id);
    }
    // An alert loop (supersonic lock, carrier critical) holds the effects
    // down while it sounds, as a one-shot alert does.
    const loopDuck = Math.min(1, ...want.map((l) => (SOUNDS[l.id].bus === 'alert' ? (SOUNDS[l.id].duck ?? 1) : 1)));
    if (loopDuck !== this.loopDuck) {
      this.loopDuck = loopDuck;
      this.duckLoops.gain.setTargetAtTime(loopDuck, t, loopDuck < 1 ? 0.015 : 0.12);
    }
    for (const l of want) {
      const def = SOUNDS[l.id];
      let lv = this.loops.get(l.id);
      if (!lv) {
        const buf = this.buffers.get(def.files[0]);
        if (!buf) continue;
        const src = loopSource(ctx, buf);
        const gain = ctx.createGain();
        gain.gain.value = 0;
        src.connect(gain);
        let pan: StereoPannerNode | null = null;
        if (ctx.createStereoPanner) {
          pan = ctx.createStereoPanner();
          gain.connect(pan);
          pan.connect(def.bus === 'sfx' ? this.duck : this.buses[def.bus]);
        } else gain.connect(def.bus === 'sfx' ? this.duck : this.buses[def.bus]);
        src.start(t, LOOP_PAD);
        lv = { src, gain, pan };
        this.loops.set(l.id, lv);
        this.log.push({ cue: l.id, file: def.files[0], wall: performance.now(), ctx: t, step: -1, voices: this.loops.size });
      }
      lv.gain.gain.setTargetAtTime(def.volume * l.level, t, 0.05);
      lv.pan?.pan.setTargetAtTime(panOf(l.x), t, 0.1);
    }
  }

  /** The music bed the screen wants (null: silence). */
  setMusic(id: MusicCue | null): void {
    this.wantMusic = id;
    this.syncMusic();
  }

  private syncMusic(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const id = this.director.pick(this.wantMusic, performance.now());
    if ((this.music?.id ?? null) === id) return;
    const t = ctx.currentTime;
    // Calm and intense battle beds share tempo, key and length: the new one
    // enters at the same point in the bar, so the crossfade is in time.
    const battle = (x: CueId | null | undefined) => x === 'battle.music' || x === 'battle.intense';
    const offsetFrom = battle(this.music?.id) && battle(id) ? t - this.music!.at : 0;
    if (this.music) {
      const old = this.music;
      old.gain.gain.setTargetAtTime(0, t, MUSIC_FADE / 4);
      old.src.stop(t + MUSIC_FADE * 2);
      this.music = null;
    }
    if (!id) return;
    const def = SOUNDS[id];
    const buf = this.buffers.get(def.files[0]);
    if (!buf) return;
    const src = loopSource(ctx, buf);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(def.volume, t, MUSIC_FADE / 4);
    src.connect(gain);
    gain.connect(this.buses.music);
    const offset = offsetFrom > 0 ? offsetFrom % (buf.duration - 2 * LOOP_PAD) : 0;
    src.start(t, LOOP_PAD + offset);
    this.music = { id, src, gain, at: t - offset };
    this.log.push({ cue: id, file: def.files[0], wall: performance.now(), ctx: t, step: -1, voices: 0 });
  }
}

/** A source that loops between the codec pads (LOOP_PAD). */
function loopSource(ctx: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = LOOP_PAD;
  src.loopEnd = buf.duration - LOOP_PAD;
  return src;
}
