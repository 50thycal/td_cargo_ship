// Offline mix renders: play a bot game, collect every sound it asks for
// (the sim's cues, the loop and music state, and the UI's cues by the same
// rules app.ts uses), decide each one with the game's own MixPolicy and
// MusicDirector, and mix to WAV the way the Web Audio engine would (buses,
// equal-power pan, alert ducking, loops between their pads, crossfaded
// music). Writes, per scenario:
//   docs/audio/renders/<name>.wav     the 30 s mix, to listen to
//   assets-src/audio/stems/<name>.{alert,bed}.wav and <name>.json
// for tools/v3/audio/mixcheck.py, which measures them.
//
//   npx vite-node tools/v3/audio/render.ts [calm busy win loss]

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { CUE_IDS, LOOP_CUES, type Cue, type CueId, type LoopCue, type MusicCue } from '../../../src/v3/audio/cues';
import { DEFAULT_AUDIO } from '../../../src/v3/audio/engine';
import { LOOP_PAD, MAX_VOICES, SOUNDS, type Bus } from '../../../src/v3/audio/manifest';
import { MixPolicy, MusicDirector, panOf, type Duck, type Voice } from '../../../src/v3/audio/policy';
import { activeLoops, battleMusic, type LoopState } from '../../../src/v3/audio/state';
import type { AbilityId } from '../../../src/v3/data/abilities';
import type { MapId } from '../../../src/v3/data/maps';
import { RULES } from '../../../src/v3/data/config';
import { Mimic, YOU, type BotIO } from '../../../src/v3/sim/mimic';
import { applyFreePlay, createGame, pickUpgrade, raidWarning, setFlow, setFormation, step, tap, type Game } from '../../../src/v3/sim/game';

const SR = 44100;
const DT = 1 / 60;
/** app.ts: the beat after a wave, and how long a player looks at the draft. */
const CLEAR_BEAT = 1.4;
const DRAFT_TIME = 2.5;

interface Scenario {
  name: string;
  map: MapId;
  seed: number;
  firstWave: number;
  weapons?: { id: AbilityId; level: number }[];
  /** Which 30 s to keep: from the start, the busiest, or the end. */
  window: 'start' | 'busiest' | 'end';
  /** Play on into endless? No: stop at the end of the run. */
  maxSeconds: number;
  /** Seconds of the result screen after the run ends. */
  tail?: number;
}

const SCENARIOS: Record<string, Scenario> = {
  calm: { name: 'calm', map: 'strait', seed: 4, firstWave: 1, window: 'start', maxSeconds: 32 },
  busy: {
    name: 'busy',
    map: 'harbor',
    seed: 7,
    firstWave: 9,
    weapons: [
      { id: 'frigate', level: 3 },
      { id: 'shrapnel', level: 3 },
      { id: 'airstrike', level: 3 },
    ],
    window: 'busiest',
    maxSeconds: 100,
  },
  win: {
    name: 'win',
    map: 'strait',
    seed: 3,
    firstWave: RULES.wavesToClear,
    weapons: [
      { id: 'frigate', level: 3 },
      { id: 'railgun', level: 3 },
      { id: 'flak', level: 3 },
    ],
    window: 'end',
    maxSeconds: 200,
    tail: 7,
  },
  loss: { name: 'loss', map: 'harbor', seed: 5, firstWave: 8, window: 'end', maxSeconds: 400, tail: 7 },
};

type Event =
  | { t: number; kind: 'cue'; cue: Cue; warp: boolean; step: number }
  | { t: number; kind: 'loops'; loops: LoopState[] }
  | { t: number; kind: 'music'; want: MusicCue | null };

/** Play the scenario's game, collecting what the player would hear. */
function timeline(sc: Scenario): { events: Event[]; end: number; result: string } {
  const g = createGame(sc.map, sc.seed, sc.firstWave);
  if (sc.weapons) applyFreePlay(g, { weapons: sc.weapons, frequentDrops: true });
  const bot = new Mimic(YOU, sc.seed);
  const io: BotIO = {
    tap: (x, y, r) => tap(g, x, y, r),
    pick: (id, rep) => pickUpgrade(g, id, rep),
    flow: (v) => setFlow(g, v),
    formation: (id) => setFormation(g, id),
  };
  const events: Event[] = [];
  let t = 0;
  const center = { x: 800, y: 450 };
  const ui = (id: CueId) => events.push({ t, kind: 'cue', cue: { id, ...center }, warp: false, step: -1 });
  const listen = () => {
    for (const c of g.cues) events.push({ t, kind: 'cue', cue: c, warp: g.warpT > 0, step: g.steps });
    g.cues.length = 0;
    // The UI's notices (app.ts drainEvents): a new pickup's hint.
    for (const ev of g.events) if (ev.kind === 'newPickup') ui('notice');
    g.events.length = 0;
  };
  const raids = new Set<string>();
  let danger = false;
  let prevLoops = '';
  let phase = g.phase;
  while (t < sc.maxSeconds * 1000) {
    if (g.phase === 'wave') {
      bot.act(g, io);
      listen();
      step(g, DT);
      listen();
      // app.ts raidAlert / syncDanger
      const w = raidWarning(g);
      if (w) {
        const key = `${g.wave}-${w.raid.at}`;
        if (!raids.has(key)) {
          raids.add(key);
          ui(w.raid === g.raids[0] ? 'raid.warning' : 'raid.next');
        }
      }
      const lastShip = g.tempo.lossLimit - g.lost === 1;
      const on = g.phase === 'wave' && lastShip;
      if (on && !danger) ui('last.ship');
      danger = on;
      const loops = activeLoops(g);
      const key = JSON.stringify(loops.map((l) => [l.id, Math.round(l.x / 40), Math.round(l.level * 10)]));
      if (key !== prevLoops) {
        events.push({ t, kind: 'loops', loops });
        prevLoops = key;
      }
      events.push({ t, kind: 'music', want: battleMusic(g) });
      t += DT * 1000;
    }
    if (g.phase !== phase) {
      events.push({ t, kind: 'loops', loops: [] });
      prevLoops = '';
      if (g.phase === 'draft') {
        ui('wave.cleared');
        t += CLEAR_BEAT * 1000;
        ui('draft.open');
        t += DRAFT_TIME * 1000;
        ui('card.pick');
        bot.act(g, io);
        if (g.phase === 'draft') pickUpgrade(g, g.offer[0]);
        t += 180;
        listen();
      } else if (g.phase === 'won' || g.phase === 'lost') {
        ui(g.phase === 'won' ? 'map.cleared' : 'run.lost');
        events.push({ t, kind: 'music', want: null });
        const beat = g.phase === 'won' ? 1.2 : 2.6;
        events.push({ t: t + beat * 1000, kind: 'music', want: 'result.music' });
        return { events, end: t + (sc.tail ?? 6) * 1000, result: g.phase };
      }
      phase = g.phase;
    }
  }
  return { events, end: t, result: `wave ${g.wave} still running` };
}

// ---------------------------------------------------------------------------
// Audio files

const buffers = new Map<string, Float32Array[]>();
function load(file: string, stereo: boolean): Float32Array[] {
  const got = buffers.get(file);
  if (got) return got;
  const path = `public/v3/audio/${file}`;
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-f', 'f32le', '-ac', stereo ? '2' : '1', '-ar', String(SR), '-'], { maxBuffer: 1 << 28 }) as unknown as Uint8Array;
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=duration', '-of', 'csv=p=0', path], { encoding: 'utf8' }).trim());
  const all = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const n = Math.round(dur * SR);
  const ch = stereo ? 2 : 1;
  const out = Array.from({ length: ch }, (_, c) => {
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = all[i * ch + c] ?? 0;
    return a;
  });
  buffers.set(file, out);
  return out;
}

const isMusic = (id: CueId) => SOUNDS[id].bus === 'music';
for (const id of CUE_IDS) for (const f of SOUNDS[id].files) load(f, isMusic(id));
const durationOf = (f: string) => buffers.get(f)![0].length / SR;

// ---------------------------------------------------------------------------
// Mixing

interface Track {
  L: Float32Array;
  R: Float32Array;
}
const track = (n: number): Track => ({ L: new Float32Array(n), R: new Float32Array(n) });

function addVoice(dst: Track, v: Voice, t0: number, buf: Float32Array, gain: number): void {
  // Linear-interpolated playback at v.rate, equal-power pan (StereoPanner).
  const start = Math.round(((v.start - t0) / 1000) * SR);
  const len = Math.floor(buf.length / v.rate);
  for (let i = 0; i < len; i++) {
    const j = start + i;
    if (j < 0) continue;
    if (j >= dst.L.length) break;
    const p = i * v.rate;
    const k = Math.floor(p);
    const s = (buf[k] ?? 0) + ((buf[k + 1] ?? 0) - (buf[k] ?? 0)) * (p - k);
    const pan = Math.max(-0.8, Math.min(0.8, v.pan + v.panRate * (i / SR)));
    const a = ((pan + 1) * Math.PI) / 4;
    dst.L[j] += s * gain * Math.cos(a);
    dst.R[j] += s * gain * Math.sin(a);
  }
}

/** A one-pole approach to a target, like AudioParam.setTargetAtTime. */
function smooth(target: Float32Array, tcMs: number): Float32Array {
  const out = new Float32Array(target.length);
  const k = 1 - Math.exp(-1 / ((tcMs / 1000) * SR));
  let cur = target[0];
  for (let i = 0; i < target.length; i++) {
    cur += (target[i] - cur) * k;
    out[i] = cur;
  }
  return out;
}

function render(sc: Scenario): void {
  const { events, end, result } = timeline(sc);
  // The 30 s window.
  let from = 0;
  if (sc.window === 'end') from = Math.max(0, end - 30000);
  if (sc.window === 'busiest') {
    let best = -1;
    for (let s = 0; s + 30000 <= end; s += 1000) {
      const n = events.filter((e) => e.kind === 'cue' && e.t >= s && e.t < s + 30000).length;
      if (n > best) {
        best = n;
        from = s;
      }
    }
  }
  const to = Math.min(end, from + 30000);
  const n = Math.round(((to - from) / 1000) * SR);
  const policy = new MixPolicy(durationOf, sc.seed);
  const director = new MusicDirector();
  const buses: Record<Bus, Track> = { sfx: track(n), ui: track(n), alert: track(n), music: track(n) };
  const voices: (Voice & { cueStep: number })[] = [];
  const ducks: Duck[] = [];
  let maxVoices = 0;
  // Policy runs from the start of the game (cooldowns, round-robin), but
  // only the window is mixed.
  const loopSpans = new Map<LoopCue, { on: number; x: number; level: number }[]>();
  const musicSpans: { t: number; id: MusicCue | null }[] = [];
  for (const e of events) {
    if (e.kind === 'cue') {
      if (LOOP_CUES.includes(e.cue.id as LoopCue)) continue;
      const v = policy.decide(e.cue, e.t, e.warp);
      maxVoices = Math.max(maxVoices, policy.active(e.t).length);
      if (!v) continue;
      voices.push({ ...v, cueStep: e.step });
      const d = policy.duckFor(v);
      if (d) ducks.push(d);
    } else if (e.kind === 'loops') {
      for (const id of LOOP_CUES) {
        const l = e.loops.find((o) => o.id === id);
        const list = loopSpans.get(id) ?? [];
        list.push({ on: e.t, x: l?.x ?? 800, level: l ? l.level : 0 });
        loopSpans.set(id, list);
      }
    } else {
      const id = director.pick(e.want, e.t) as MusicCue | null;
      if (musicSpans[musicSpans.length - 1]?.id !== id) musicSpans.push({ t: e.t, id });
    }
  }
  const s = DEFAULT_AUDIO;
  for (const v of voices) {
    if (v.end < from || v.start > to) continue;
    const buf = buffers.get(v.file)![0];
    addVoice(buses[v.bus], v, from, buf, v.gain);
  }
  // Loops: each plays from its loop start when it comes on (the engine makes
  // a new source), level and pan smoothed.
  for (const [id, spans] of loopSpans) {
    const buf = buffers.get(SOUNDS[id].files[0])![0];
    const pad = Math.round(LOOP_PAD * SR);
    const loopLen = buf.length - 2 * pad;
    const target = new Float32Array(n);
    const panT = new Float32Array(n);
    const startAt = new Int32Array(n);
    let on = false;
    let since = 0;
    let si = 0;
    for (let i = 0; i < n; i++) {
      const tm = from + (i / SR) * 1000;
      while (si + 1 < spans.length && spans[si + 1].on <= tm) si++;
      const sp = spans[si] && spans[si].on <= tm ? spans[si] : null;
      const lvl = sp ? sp.level : 0;
      if (lvl > 0 && !on) since = i;
      on = lvl > 0;
      target[i] = lvl * SOUNDS[id].volume;
      panT[i] = panOf(sp?.x ?? 800);
      startAt[i] = since;
    }
    const g = smooth(target, 50);
    const p = smooth(panT, 100);
    const dst = buses[SOUNDS[id].bus];
    for (let i = 0; i < n; i++) {
      if (g[i] < 1e-4) continue;
      const smp = buf[pad + ((i - startAt[i]) % loopLen)] * g[i];
      const a = ((p[i] + 1) * Math.PI) / 4;
      dst.L[i] += smp * Math.cos(a);
      dst.R[i] += smp * Math.sin(a);
    }
  }
  // Music: crossfades (tc 0.3 s), calm/intense in step.
  const mus = buses.music;
  const fades = new Map<MusicCue, Float32Array>();
  for (const id of ['menu.music', 'battle.music', 'battle.intense', 'result.music'] as MusicCue[]) {
    const tg = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const tm = from + (i / SR) * 1000;
      let cur: MusicCue | null = null;
      for (const m of musicSpans) if (m.t <= tm) cur = m.id;
      tg[i] = cur === id ? SOUNDS[id].volume : 0;
    }
    fades.set(id, smooth(tg, 300));
  }
  for (const [id, gain] of fades) {
    const [bl, br] = buffers.get(SOUNDS[id].files[0])!;
    const pad = Math.round(LOOP_PAD * SR);
    const loopLen = bl.length - 2 * pad;
    for (let i = 0; i < n; i++) {
      if (gain[i] < 1e-4) continue;
      const k = pad + ((Math.round((from / 1000) * SR) + i) % loopLen);
      mus.L[i] += bl[k] * gain[i];
      mus.R[i] += br[k] * gain[i];
    }
  }
  // Ducking on the sfx bus (tc 15 ms down, 120 ms back).
  const duck = new Float32Array(n).fill(1);
  for (const d of ducks) {
    const a = Math.max(0, Math.round(((d.start - from) / 1000) * SR));
    const b = Math.min(n, Math.round(((d.end - from) / 1000) * SR));
    for (let i = a; i < b; i++) duck[i] = Math.min(duck[i], d.depth);
  }
  // Alert loops hold the effects down while they sound (engine.setLoops).
  for (const [id, spans] of loopSpans) {
    const depth = SOUNDS[id].bus === 'alert' ? (SOUNDS[id].duck ?? 1) : 1;
    if (depth >= 1) continue;
    for (let k = 0; k < spans.length; k++) {
      if (spans[k].level <= 0) continue;
      const a = Math.max(0, Math.round(((spans[k].on - from) / 1000) * SR));
      const b = Math.min(n, Math.round((((spans[k + 1]?.on ?? to) - from) / 1000) * SR));
      for (let i = a; i < b; i++) duck[i] = Math.min(duck[i], depth);
    }
  }
  const duckDown = smooth(duck, 15);
  const duckG = new Float32Array(n);
  let cur = 1;
  const kd = 1 - Math.exp(-1 / (0.015 * SR));
  const ku = 1 - Math.exp(-1 / (0.12 * SR));
  for (let i = 0; i < n; i++) {
    cur += (duck[i] - cur) * (duck[i] < cur ? kd : ku);
    duckG[i] = cur;
  }
  void duckDown;
  const master = s.volume;
  const out = track(n);
  const alert = track(n);
  const bed = track(n);
  for (let i = 0; i < n; i++) {
    for (const ch of ['L', 'R'] as const) {
      const fx = buses.sfx[ch][i] * duckG[i];
      const m = buses.music[ch][i] * s.music;
      const a = buses.alert[ch][i];
      const u = buses.ui[ch][i];
      out[ch][i] = (fx + m + a + u) * master;
      alert[ch][i] = a * master;
      bed[ch][i] = (fx + m + u) * master;
    }
  }
  // Report: plays per cue per second, voices, drops.
  const inWin = voices.filter((v) => v.start >= from && v.start < to);
  const perCue = new Map<CueId, number[]>();
  for (const v of inWin) perCue.set(v.id, [...(perCue.get(v.id) ?? []), v.start]);
  const rate: Record<string, { plays: number; maxPerSec: number; allowed: number }> = {};
  for (const [id, ts] of perCue) {
    let maxPerSec = 0;
    for (const t0 of ts) maxPerSec = Math.max(maxPerSec, ts.filter((t) => t >= t0 && t < t0 + 1000).length);
    const cd = SOUNDS[id].cooldownMs;
    rate[id] = { plays: ts.length, maxPerSec, allowed: cd ? Math.ceil(1000 / cd) : Infinity };
  }
  const alerts = inWin.filter((v) => v.bus === 'alert').map((v) => ({ id: v.id, t: (v.start - from) / 1000, dur: (v.end - v.start) / 1000 }));
  const loopAlerts: { id: string; t: number; dur: number }[] = [];
  for (const id of LOOP_CUES.filter((l) => SOUNDS[l].bus === 'alert')) {
    const sp = loopSpans.get(id) ?? [];
    for (let k = 0; k < sp.length; k++) {
      if (sp[k].level > 0 && sp[k].on >= from && sp[k].on < to && (k === 0 || sp[k - 1].level === 0)) {
        const off = sp.slice(k + 1).find((o) => o.level === 0)?.on ?? to;
        loopAlerts.push({ id, t: (sp[k].on - from) / 1000, dur: (off - sp[k].on) / 1000 });
      }
    }
  }
  mkdirSync('docs/audio/renders', { recursive: true });
  mkdirSync('assets-src/audio/stems', { recursive: true });
  writeWav(`docs/audio/renders/${sc.name}.wav`, out, true);
  writeWav(`assets-src/audio/stems/${sc.name}.alert.wav`, alert, false);
  writeWav(`assets-src/audio/stems/${sc.name}.bed.wav`, bed, false);
  // Also a float master, to measure clipping before 16-bit conversion.
  writeWav(`assets-src/audio/stems/${sc.name}.mix.wav`, out, false);
  const report = {
    name: sc.name,
    map: sc.map,
    seed: sc.seed,
    firstWave: sc.firstWave,
    weapons: sc.weapons ?? [],
    result,
    window: [from / 1000, to / 1000],
    /** When the run ended, in window seconds (null: it didn't). */
    endAt: result === 'won' || result === 'lost' ? (end - (sc.tail ?? 6) * 1000 - from) / 1000 : null,
    voicesMax: maxVoices,
    voiceCap: MAX_VOICES,
    dropped: policy.dropped,
    plays: inWin.length,
    rate,
    alerts: [...alerts, ...loopAlerts].sort((a, b) => a.t - b.t),
    cues: inWin.map((v) => ({ id: v.id, t: Math.round(v.start - from) / 1000, file: v.file })),
  };
  writeFileSync(`assets-src/audio/stems/${sc.name}.json`, JSON.stringify(report, null, 1));
  console.log(`${sc.name}: ${result}, window ${(from / 1000).toFixed(1)}–${(to / 1000).toFixed(1)} s, ${inWin.length} plays, max ${maxVoices} voices, dropped ${JSON.stringify(policy.dropped)}`);
}

function writeWav(path: string, t: Track, pcm16: boolean): void {
  const n = t.L.length;
  const bytes = pcm16 ? 2 : 4;
  const data = new DataView(new ArrayBuffer(44 + n * 2 * bytes));
  const str = (o: number, s: string) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  data.setUint32(4, 36 + n * 2 * bytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, pcm16 ? 1 : 3, true);
  data.setUint16(22, 2, true);
  data.setUint32(24, SR, true);
  data.setUint32(28, SR * 2 * bytes, true);
  data.setUint16(32, 2 * bytes, true);
  data.setUint16(34, bytes * 8, true);
  str(36, 'data');
  data.setUint32(40, n * 2 * bytes, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (const v of [t.L[i], t.R[i]]) {
      if (pcm16) data.setInt16(o, Math.max(-32768, Math.min(32767, Math.round(v * 32767))), true);
      else data.setFloat32(o, v, true);
      o += bytes;
    }
  }
  writeFileSync(path, new Uint8Array(data.buffer));
}

const names = process.argv.slice(2).filter((a) => a in SCENARIOS);
for (const name of names.length ? names : Object.keys(SCENARIOS)) render(SCENARIOS[name]);
