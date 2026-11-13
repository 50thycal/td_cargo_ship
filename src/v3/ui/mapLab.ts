// MAP ANALYTICS: the Test Lab's viewer for the Map & Convoy Lab's telemetry
// (docs/design/v3-map-convoy-lab-plan.md, slice 2, §5 and §9). A developer
// screen: never in play, never in the store build.
//
// It reads the runs kept on this device (the last Test Lab tests and the
// last runs), replays each log to its telemetry (sim/telemetry.ts: a log
// replays to it, so nothing was stored for this), and can play bot runs on
// the spot. Then: one layer at a time on the map's own picture, filters,
// a time window, a tap on a square for what is behind it, the replay from
// just before any of it, a hit traced from launcher to impact, and one set
// of runs against another.
//
// The numbers all come from sim/mapAnalytics.ts; this file only draws.

import { VIEW } from '../data/config';
import { MAPS, MAP_ORDER, type MapId } from '../data/maps';
import { GRID, LAYERS, cellBox, cellOf, diff, histogram, layer, summarize, timeline, trace, type EventRef, type Filter, type LayerId, type LayerResult, type MetricId, type Platform, type RunData, type Scope, type Summary, type TraceStep } from '../sim/mapAnalytics';
import { BotRun, PERSONAS } from '../sim/mimic';
import { LOG_VERSION, replay, type PlayLog } from '../sim/playlog';
import { logPlays } from '../sim/labDocs';
import { mapThumb } from './thumbs';

export interface MapLabHandlers {
  /** The logs kept on this device, newest first. */
  logs: () => PlayLog[];
  /** Open the replay of a log at a step (the screen comes back after). */
  watch: (log: PlayLog, step: number) => void;
  /** Where the screen was left, kept while the app is open. */
  memory: MapLabMemory;
}

/** What the screen remembers between visits (a replay and back). */
export interface MapLabMemory {
  map?: MapId;
  layer?: LayerId;
  metric?: MetricId;
  scope?: Scope;
  waves?: string;
  kind?: string;
  platform?: string;
  weapon?: string;
  /** Which set each run is in: A (the set shown), B (compared with it) or out. */
  sets?: Record<string, 'a' | 'b' | 'off'>;
  cell?: number;
  win?: [number, number];
  /** Runs read so far (replayed or played here), by id. */
  runs?: Map<string, RunData>;
  seed?: number;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
function button(text: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** One hue, dark to light (on the dark map, near zero sinks in and the most
 *  stands out); a rate gets the second hue; a difference, two with a
 *  neutral middle. Chosen with the dataviz validator for this surface. */
const RAMP = ['#0d366b', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb'];
const RAMP_RATE = ['#5c2409', '#8a3610', '#b84a1a', '#d95926', '#ee8a5f', '#f6b79a', '#fde0d2'];
const DIVERGE = { less: ['#9ec5f4', '#3987e5', '#184f95'], more: ['#f6b79a', '#d95926', '#8a3610'], mid: '#383835' };
const RATES: MetricId[] = ['risk', 'perLaunch', 'takenRate'];

const fmt = (v: number): string => (Number.isInteger(v) ? String(v) : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));
const clock = (t: number): string => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** A log as a run: replayed here to its telemetry. Null when it is not
 *  this build's log version, or no longer replays to its own summary (a
 *  log from before a change to the game). */
export function runFromLog(log: PlayLog): RunData | null {
  if (log.game !== 'v3' || log.v !== LOG_VERSION || log.notesOnly || !log.commands?.length) return null;
  const g = replay(log, { telemetry: true });
  const s = log.summary;
  if (s && (s.steps !== g.steps || s.score !== g.score || s.lost !== g.lost)) return null;
  const who = log.dev?.bot ? `bot ${log.dev.bot}` : 'you';
  // A map card's run (Test Lab round 10) says which it was: the full map
  // or a quick slice (a map card's log from before round 10 was a slice).
  const plays = logPlays(log);
  const what = log.lab ? `${log.lab.card}${log.lab.rev ? ` v${log.lab.rev}` : ''}${plays === 'full' ? ' · full map' : plays === 'slice' ? ` · quick slice from wave ${log.firstWave}` : ''}` : `from wave ${log.firstWave}`;
  return { id: log.id, label: `${who} · ${what} · ${log.startedAt.slice(5, 16).replace('T', ' ')}`, sidecar: g.tel!.sidecar(g), log };
}

const WAVES: { id: string; name: string; range?: [number, number] }[] = [
  { id: 'all', name: 'All waves' },
  { id: '1-3', name: 'Waves 1-3', range: [1, 3] },
  { id: '4-6', name: 'Waves 4-6', range: [4, 6] },
  { id: '7-9', name: 'Waves 7-9', range: [7, 9] },
  { id: '10', name: 'Wave 10', range: [10, 10] },
  { id: '11', name: 'Event run 1', range: [11, 11] },
  { id: '12', name: 'Event run 2', range: [12, 12] },
  { id: '13', name: 'Event run 3', range: [13, 13] },
];
const SCOPES: { id: Scope; name: string }[] = [
  { id: 'all', name: 'Everything' },
  { id: 'waves', name: 'Normal waves' },
  { id: 'mapEvent', name: 'Map event' },
  { id: 'bonus', name: 'Bonus wave' },
];

export function mapLabScreen(h: MapLabHandlers): HTMLElement {
  const m = h.memory;
  m.runs ??= new Map();
  m.sets ??= {};
  const runs = m.runs;
  const root = el('div', 'v3-maplab');
  root.dataset.maplab = '1';

  // ---- State ---------------------------------------------------------------
  const logs = h.logs().filter((l) => l.game === 'v3' && !l.notesOnly && l.commands?.length);
  const mapsWithRuns = () => MAP_ORDER.filter((id) => logs.some((l) => l.map === id) || [...runs.values()].some((r) => r.sidecar.header.map === id));
  let map: MapId = m.map ?? mapsWithRuns()[0] ?? 'harbor';
  let layerId: LayerId = m.layer ?? 'damage';
  let metric: MetricId = m.metric ?? 'hp';
  let scope: Scope = m.scope ?? 'all';
  let cell = m.cell ?? -1;
  let tracePath: TraceStep[] = [];
  let busy = '';

  const mapRuns = () => [...runs.values()].filter((r) => r.sidecar.header.map === map);
  const setOf = (id: string) => m.sets![id] ?? 'a';
  const setRuns = (s: 'a' | 'b') => mapRuns().filter((r) => setOf(r.id) === s);
  const length = () => Math.max(1, ...mapRuns().filter((r) => setOf(r.id) !== 'off').map((r) => r.sidecar.seconds));

  function filter(): Filter {
    const w = WAVES.find((o) => o.id === (m.waves ?? 'all'));
    const win = m.win;
    return {
      scope,
      ...(w?.range ? { waves: w.range } : {}),
      ...(m.kind && m.kind !== 'all' ? { kinds: [m.kind as never] } : {}),
      ...(m.platform && m.platform !== 'all' ? { platforms: [m.platform as Platform] } : {}),
      ...(m.weapon && m.weapon !== 'all' ? { weapon: m.weapon } : {}),
      ...(win ? { window: { from: win[0], to: win[1], base: 'run' as const } } : {}),
    };
  }

  // ---- The parts -------------------------------------------------------------
  const side = el('div', 'v3-maplab-side');
  const main = el('div', 'v3-maplab-main');
  const boardWrap = el('div', 'v3-maplab-board');
  const canvas = el('canvas', 'v3-maplab-canvas');
  canvas.width = 960;
  canvas.height = 540;
  canvas.setAttribute('role', 'img');
  const legend = el('div', 'v3-maplab-legend');
  const strip = el('canvas', 'v3-maplab-strip');
  strip.width = 960;
  strip.height = 56;
  const win = el('div', 'v3-maplab-window');
  const detail = el('div', 'v3-maplab-detail');
  detail.setAttribute('aria-live', 'polite');
  const sum = el('div', 'v3-maplab-sum');
  const status = el('p', 'v3-maplab-status');
  status.setAttribute('aria-live', 'polite');
  boardWrap.append(canvas);
  main.append(boardWrap, legend, strip, win, detail);

  const pick = <T extends string>(label: string, key: string, options: { id: T; name: string }[], value: T, on: (v: T) => void): HTMLLabelElement => {
    const wrap = el('label', 'v3-maplab-pick');
    wrap.append(el('span', '', label));
    const s = el('select');
    s.dataset.maplabPick = key;
    for (const o of options) {
      const opt = el('option', '', o.name);
      opt.value = o.id;
      s.append(opt);
    }
    s.value = value;
    s.addEventListener('change', () => on(s.value as T));
    wrap.append(s);
    return wrap;
  };
  const segs = <T extends string>(label: string, key: string, options: { id: T; name: string }[], value: T, on: (v: T) => void): HTMLElement => {
    const g = el('div', 'v3-maplab-segs');
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', label);
    for (const o of options) {
      const b = button(o.name, `v3-maplab-seg${o.id === value ? ' on' : ''}`, () => on(o.id));
      b.dataset[key] = o.id;
      b.setAttribute('aria-pressed', String(o.id === value));
      g.append(b);
    }
    return g;
  };

  // ---- Reading runs --------------------------------------------------------
  /** Replays this map's kept logs, one a tick, so the screen stays alive. */
  function readLogs(): void {
    const todo = logs.filter((l) => l.map === map && !runs.has(l.id) && !skipped.has(l.id));
    if (!todo.length) {
      busy = '';
      draw();
      return;
    }
    busy = `Reading ${todo.length} run${todo.length > 1 ? 's' : ''} kept on this device…`;
    drawStatus();
    setTimeout(() => {
      if (!root.isConnected) return;
      const log = todo[0];
      let r: RunData | null = null;
      try {
        r = runFromLog(log);
      } catch {
        r = null;
      }
      if (r) runs.set(r.id, r);
      else skipped.add(log.id);
      readLogs();
    }, 0);
  }
  const skipped = new Set<string>();

  /** Plays `n` bot runs of this map here (the bot fitted to the player),
   *  recorded and with telemetry, a slice a tick. */
  function playBots(n: number): void {
    m.seed ??= 301;
    const seed = m.seed++;
    const run = new BotRun(map, seed, { persona: PERSONAS.you, build: 'maplab' });
    run.rec.telemetry('watch', 'you');
    const tick = () => {
      if (!root.isConnected) return;
      const done = run.advance(4000);
      busy = `Bot run on ${MAPS[map].name}, seed ${seed}: wave ${run.game.wave}…`;
      drawStatus();
      if (!done) {
        setTimeout(tick, 0);
        return;
      }
      const log = { ...run.finish(), id: `v3-maplab-${map}-${seed}`, dev: { preset: 'maplab', watch: true, bot: 'you' } };
      runs.set(log.id, { id: log.id, label: `bot you · seed ${seed} · to wave ${run.game.wave}`, sidecar: run.game.tel!.sidecar(run.game), log });
      if (n > 1) playBots(n - 1);
      else {
        busy = '';
        draw();
      }
    };
    setTimeout(tick, 0);
  }

  // ---- Drawing ---------------------------------------------------------------
  let bg: HTMLImageElement | null = null;
  let bgMap: MapId | null = null;
  function loadBg(): void {
    if (bgMap === map) return;
    bgMap = map;
    bg = null;
    const want = map;
    void mapThumb(map, 960).then((url) => {
      if (want !== map || !url) return;
      const img = new Image();
      img.onload = () => {
        if (want !== map) return;
        bg = img;
        drawBoard(current);
      };
      img.src = url;
    });
  }

  interface View {
    a: LayerResult & { refs: EventRef[][] };
    b: (LayerResult & { refs: EventRef[][] }) | null;
    d: ReturnType<typeof diff> | null;
    sa: Summary;
    sb: Summary | null;
  }
  let current: View | null = null;

  function compute(): View {
    const f = filter();
    const A = setRuns('a');
    const B = setRuns('b');
    const a = layer(A, f, layerId, metric);
    const b = B.length ? layer(B, f, layerId, metric) : null;
    return { a, b, d: b ? diff(a, b) : null, sa: summarize(A, f), sb: B.length ? summarize(B, f) : null };
  }

  function colorOf(v: number, top: number, ramp: string[]): string {
    const f = top > 0 ? Math.sqrt(Math.max(0, v) / top) : 0;
    return ramp[Math.min(ramp.length - 1, Math.floor(f * ramp.length))];
  }

  function drawBoard(v: View | null): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const k = canvas.width / VIEW.width;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0f161d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (bg) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (!v) return;
    const ramp = RATES.includes(metric) ? RAMP_RATE : RAMP;
    const labels: { i: number; v: number }[] = [];
    v.a.cells.forEach((c, i) => {
      const box = cellBox(i);
      if (v.d) {
        const dv = v.d.cells[i];
        if (dv === null) {
          if (c.masked || v.b!.cells[i].masked) hatch(ctx, box);
          return;
        }
        if (dv === 0 && !c.num && !v.b!.cells[i].num) return;
        const f = v.d.top > 0 ? Math.abs(dv) / v.d.top : 0;
        const arm = dv > 0 ? DIVERGE.more : DIVERGE.less;
        ctx.fillStyle = dv === 0 ? DIVERGE.mid : arm[Math.min(2, Math.floor(f * 3))];
        ctx.globalAlpha = 0.9;
        ctx.fillRect(box.x + 2, box.y + 2, box.w - 4, box.h - 4);
        ctx.globalAlpha = 1;
        if (dv !== 0) labels.push({ i, v: dv });
        return;
      }
      if (c.masked) {
        hatch(ctx, box);
        return;
      }
      if (c.v === null || (c.v === 0 && !RATES.includes(metric))) return;
      if (c.v === 0) {
        // A rate of zero with enough under it: shown, as the faintest step.
        ctx.strokeStyle = ramp[1];
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x + 4, box.y + 4, box.w - 8, box.h - 8);
        return;
      }
      ctx.fillStyle = colorOf(c.v, v.a.top, ramp);
      ctx.globalAlpha = 0.9;
      ctx.fillRect(box.x + 2, box.y + 2, box.w - 4, box.h - 4);
      ctx.globalAlpha = 1;
      labels.push({ i, v: c.v });
    });
    // The three largest are written on the map (the rest are a tap away).
    labels.sort((x, y) => Math.abs(y.v) - Math.abs(x.v));
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const l of labels.slice(0, 3)) {
      const box = cellBox(l.i);
      const text = `${v.d && l.v > 0 ? '+' : ''}${fmt(l.v)}`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#0f161d';
      ctx.strokeText(text, box.x + box.w / 2, box.y + box.h / 2);
      ctx.fillStyle = '#f0efec';
      ctx.fillText(text, box.x + box.w / 2, box.y + box.h / 2);
    }
    // The carrier, and the square picked.
    const c = MAPS[map].carrier;
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = '#f0efec';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 74, 26, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (cell >= 0) {
      const box = cellBox(cell);
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 5;
      ctx.strokeRect(box.x, box.y, box.w, box.h);
    }
    // A traced hit: the line from the launcher to the hull, numbered.
    const pts = tracePath.filter((s) => s.x !== undefined && s.y !== undefined);
    if (pts.length > 1) {
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 4;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x!, p.y!) : ctx.moveTo(p.x!, p.y!)));
      ctx.stroke();
      ctx.font = '700 22px system-ui, sans-serif';
      pts.forEach((p, i) => {
        ctx.fillStyle = '#0f161d';
        ctx.beginPath();
        ctx.arc(p.x!, p.y!, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f5c542';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#f5c542';
        ctx.fillText(String(i + 1), p.x!, p.y! + 1);
      });
    }
  }

  function hatch(ctx: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x + 2, box.y + 2, box.w - 4, box.h - 4);
    ctx.clip();
    ctx.strokeStyle = '#c3c2b7';
    ctx.lineWidth = 2.5;
    for (let d = -box.h; d < box.w; d += 10) {
      ctx.beginPath();
      ctx.moveTo(box.x + d, box.y + box.h);
      ctx.lineTo(box.x + d + box.h, box.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStrip(): void {
    const ctx = strip.getContext('2d');
    if (!ctx) return;
    const W = strip.width;
    const H = strip.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f161d';
    ctx.fillRect(0, 0, W, H);
    const L = length();
    const bins = 96;
    const hist = histogram(setRuns('a'), { ...filter(), window: undefined }, bins, L);
    const top = Math.max(1, ...hist.launches);
    const topHp = Math.max(1, ...hist.hp);
    const bw = W / bins;
    for (let i = 0; i < bins; i++) {
      // Launches up from the middle (blue), hull lost down from it (orange).
      const a = (hist.launches[i] / top) * (H / 2 - 4);
      const b = (hist.hp[i] / topHp) * (H / 2 - 4);
      ctx.fillStyle = '#3987e5';
      if (a > 0) ctx.fillRect(i * bw + 1, H / 2 - 1 - a, bw - 2, a);
      ctx.fillStyle = '#d95926';
      if (b > 0) ctx.fillRect(i * bw + 1, H / 2 + 1, bw - 2, b);
    }
    ctx.fillStyle = '#52514e';
    ctx.fillRect(0, H / 2 - 1, W, 2);
    // Where each wave began (the first run of the set).
    const first = setRuns('a')[0];
    ctx.fillStyle = '#c3c2b7';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    for (const ph of first?.sidecar.phases ?? []) {
      const x = (ph.t0 / L) * W;
      ctx.fillRect(x, 0, 1, H);
      ctx.fillText(ph.kind === 'wave' ? String(ph.wave) : ph.kind === 'bonusEvent' ? 'B' : `E${ph.run}`, x + 3, 2);
    }
    const w = m.win;
    if (w) {
      ctx.fillStyle = 'rgb(15 22 29 / 0.72)';
      ctx.fillRect(0, 0, (w[0] / L) * W, H);
      ctx.fillRect((w[1] / L) * W, 0, W - (w[1] / L) * W, H);
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 2;
      ctx.strokeRect((w[0] / L) * W, 1, ((w[1] - w[0]) / L) * W, H - 2);
    }
  }

  function drawWindow(): void {
    const L = length();
    const w = m.win ?? [0, L];
    win.replaceChildren();
    const mk = (label: string, key: string, value: number, on: (v: number) => void) => {
      const wrap = el('label', 'v3-maplab-range');
      const out = el('b', '', clock(value));
      const r = el('input');
      r.type = 'range';
      r.min = '0';
      r.max = String(Math.ceil(L));
      r.step = '1';
      r.value = String(Math.round(value));
      r.dataset.maplabRange = key;
      r.addEventListener('input', () => {
        out.textContent = clock(Number(r.value));
        on(Number(r.value));
      });
      wrap.append(el('span', '', label), r, out);
      return wrap;
    };
    const from = mk('From', 'from', w[0], (v) => {
      const to = m.win?.[1] ?? L;
      m.win = [Math.min(v, to - 1), to];
      later();
    });
    const to = mk('To', 'to', Math.min(w[1], L), (v) => {
      const fr = m.win?.[0] ?? 0;
      m.win = [fr, Math.max(v, fr + 1)];
      later();
    });
    const whole = button('Whole run', 'v3-maplab-seg', () => {
      m.win = undefined;
      draw();
    });
    whole.dataset.maplabWhole = '1';
    whole.disabled = !m.win;
    win.append(from, to, whole);
  }
  let timer = 0;
  /** A slider is moving: redraw the map and the numbers, not the sliders. */
  function later(): void {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      current = compute();
      drawBoard(current);
      drawStrip();
      drawLegend(current);
      drawSummary(current);
      drawDetail(current);
      const wh = win.querySelector<HTMLButtonElement>('[data-maplab-whole]');
      if (wh) wh.disabled = !m.win;
    }, 60);
  }

  function drawLegend(v: View): void {
    legend.replaceChildren();
    const def = LAYERS.find((l) => l.id === layerId)!.metrics.find((o) => o.id === metric)!;
    legend.append(el('p', '', def.says));
    const keys = el('div', 'v3-maplab-keys');
    const sw = (colors: string[]) => {
      const r = el('span', 'v3-maplab-ramp');
      for (const c of colors) {
        const i = el('i');
        i.style.background = c;
        r.append(i);
      }
      return r;
    };
    if (layerId === 'commands') keys.append(el('span', '', 'Commands have no place on the map: they are listed under it, in time.'));
    else if (v.d) {
      keys.append(el('span', '', 'fewer in B'), sw([...DIVERGE.less].reverse().concat(DIVERGE.mid, DIVERGE.more)), el('span', '', `more in B (up to ${fmt(v.d.top)} ${def.unit})`));
    } else {
      keys.append(sw(RATES.includes(metric) ? RAMP_RATE : RAMP), el('span', 'v3-maplab-num', `0 to ${fmt(v.a.top)} ${def.unit}`));
    }
    if (RATES.includes(metric)) {
      const h2 = el('span', 'v3-maplab-hatch');
      keys.append(h2, el('span', '', 'too little under it for a rate'));
    }
    keys.append(el('span', 'v3-maplab-sample', `${v.a.runs} run${v.a.runs === 1 ? '' : 's'}, ${clock(v.a.seconds)} of play${v.b ? ` · B: ${v.b.runs} run${v.b.runs === 1 ? '' : 's'}, ${clock(v.b.seconds)}` : ''}`));
    legend.append(keys);
    canvas.setAttribute('aria-label', `${MAPS[map].name}: ${def.name.toLowerCase()} by square, ${v.a.runs} runs. The numbers are in the summary beside it.`);
  }

  function drawSummary(v: View): void {
    sum.replaceChildren();
    const rows: [string, (s: Summary) => string][] = [
      ['Runs, minutes of play', (s) => `${s.runs}, ${fmt(s.seconds / 60)}`],
      ['Ship-minutes afloat', (s) => fmt(s.shipMinutes)],
      ['Launches', (s) => String(s.launches)],
      ['Hull lost: ships, carrier', (s) => `${fmt(s.hpShip)}, ${fmt(s.hpCarrier)}`],
      ['Hull per ship-minute', (s) => (s.risk === null ? 'too little traffic' : `${fmt(s.risk)}${s.riskByRun ? ` (runs ${fmt(s.riskByRun.min)} to ${fmt(s.riskByRun.max)})` : ''}`)],
      ['Ships: sailed, delivered, sunk', (s) => `${s.sailed}, ${s.delivered}, ${s.sunk}`],
      ['Most damage from', (s) => s.byKind.slice(0, 3).map(([k, n]) => `${k} ${fmt(n)}`).join(', ') || 'none'],
      ['Base: launches, hull', (s) => `${s.byPlatform.base.launches}, ${fmt(s.byPlatform.base.hp)}`],
      ['Truck or sub: launches, hull', (s) => `${s.byPlatform.mobile.launches}, ${fmt(s.byPlatform.mobile.hp)}`],
      ['Aircraft: launches, hull', (s) => `${s.byPlatform.air.launches}, ${fmt(s.byPlatform.air.hp)}`],
      ['Hull lost by formation', (s) => Object.entries(s.byFormation).map(([k, o]) => `${k} ${fmt(o!.hp)}`).join(', ') || 'none'],
      ['Pickups: dropped, taken', (s) => `${s.pickups.dropped}, ${s.pickups.taken}`],
      ['Taps: fired, missed', (s) => `${s.taps.fire}, ${s.taps.dry + s.taps.empty}`],
      ['Kills, most by', (s) => `${s.kills}${s.killsBy[0] ? `, ${s.killsBy[0][0]} ${s.killsBy[0][1]}` : ''}`],
      ['Convoy commands', (s) => String(s.commands)],
    ];
    const t = el('table', 'v3-maplab-table');
    const head = el('tr');
    head.append(el('th', '', ''), el('th', '', v.sb ? 'A' : 'These runs'));
    if (v.sb) head.append(el('th', '', 'B'));
    t.append(head);
    for (const [name, f] of rows) {
      const tr = el('tr');
      tr.append(el('th', '', name), el('td', '', f(v.sa)));
      if (v.sb) tr.append(el('td', '', f(v.sb)));
      t.append(tr);
    }
    sum.append(t);
  }

  function drawDetail(v: View): void {
    detail.replaceChildren();
    if (layerId === 'commands') {
      const list = timeline(setRuns('a'), filter());
      detail.append(el('h4', '', `${list.length} command${list.length === 1 ? '' : 's'} and changes, in time`));
      detail.append(refList(list.slice(0, 60)));
      return;
    }
    if (cell < 0) {
      detail.append(el('p', 'v3-maplab-hint', 'Tap a square for what is behind it.'));
      return;
    }
    const c = v.a.cells[cell];
    const box = cellBox(cell);
    const def = LAYERS.find((l) => l.id === layerId)!.metrics.find((o) => o.id === metric)!;
    const head = el('h4', '', `Square ${(cell % GRID.w) + 1}, ${Math.floor(cell / GRID.w) + 1} (x ${box.x}-${box.x + box.w}, y ${box.y}-${box.y + box.h})`);
    const says = c.masked
      ? `${fmt(c.num)} over ${fmt(c.den)}: too little under it for a rate.`
      : c.v === null
        ? 'Nothing here under this filter.'
        : RATES.includes(metric)
          ? `${fmt(c.v)} ${def.unit} (${fmt(c.num)} over ${fmt(c.den)}).`
          : `${fmt(c.v)} ${def.unit}.`;
    detail.append(head, el('p', '', says + (v.b ? ` In B: ${v.b.cells[cell].v === null ? 'nothing' : fmt(v.b.cells[cell].v!)}.` : '')));
    const refs = v.a.refs[cell];
    if (refs.length) detail.append(refList(refs));
    if (tracePath.length) {
      const ol = el('ol', 'v3-maplab-trace');
      ol.dataset.maplabTrace = '1';
      for (const s of tracePath) ol.append(el('li', '', `${clock(s.t)} · ${s.text}`));
      detail.append(el('h4', '', 'From launcher to impact'), ol);
    }
  }

  function refList(list: EventRef[]): HTMLElement {
    const ul = el('ul', 'v3-maplab-refs');
    for (const r of list) {
      const li = el('li');
      const run = runs.get(r.run);
      li.append(el('span', '', `wave ${r.wave} · ${clock(r.t)} · ${r.text}`));
      if (run?.log) {
        const w = button('Watch', 'v3-maplab-link', () => {
          m.cell = cell;
          // From three seconds before, so what led to it is on screen.
          h.watch(run.log!, Math.max(0, r.s - 180));
        });
        w.dataset.maplabWatch = String(r.s);
        li.append(w);
      }
      if (r.imp !== undefined && run) {
        const t = button('Trace', 'v3-maplab-link', () => {
          tracePath = trace(run.sidecar, r.imp!);
          drawBoard(current);
          if (current) drawDetail(current);
        });
        t.dataset.maplabTraceBtn = String(r.imp);
        li.append(t);
      }
      ul.append(li);
    }
    return ul;
  }

  function drawStatus(): void {
    status.textContent = busy;
    status.hidden = !busy;
  }

  function drawSide(): void {
    side.replaceChildren();
    // Every map, those with runs first (and how many).
    const have = mapsWithRuns();
    const count = (id: MapId) => new Set([...logs.filter((l) => l.map === id).map((l) => l.id), ...[...runs.values()].filter((r) => r.sidecar.header.map === id).map((r) => r.id)]).size;
    const options = [...have, ...MAP_ORDER.filter((id) => !have.includes(id))].map((id) => ({ id, name: `${MAPS[id].name}${count(id) ? ` (${count(id)})` : ''}` }));
    side.append(
      pick('Map', 'map', options, map, (v) => {
        map = v;
        m.map = v;
        cell = -1;
        m.win = undefined;
        tracePath = [];
        readLogs();
        draw();
      }),
    );
    // The runs: in set A (shown), in set B (compared with A), or out.
    const list = el('div', 'v3-maplab-runs');
    const rs = mapRuns();
    list.append(el('span', 'v3-maplab-label', rs.length ? 'Runs (tap: A, B, out)' : 'No runs of this map yet'));
    for (const r of rs) {
      const s = setOf(r.id);
      const b = button('', `v3-maplab-run ${s}`, () => {
        m.sets![r.id] = s === 'a' ? 'b' : s === 'b' ? 'off' : 'a';
        cell = -1;
        tracePath = [];
        draw();
      });
      b.dataset.maplabRun = r.id;
      b.dataset.set = s;
      b.append(el('b', '', s === 'off' ? '–' : s.toUpperCase()), el('span', '', r.label));
      list.append(b);
    }
    const bots = button('Play 2 bot runs here', 'v2-btn v3-maplab-bots', () => playBots(2));
    bots.dataset.maplabBots = '1';
    bots.disabled = !!busy;
    side.append(list, bots, status);
    side.append(
      segs('Which waves', 'maplabScope', SCOPES, scope, (v) => {
        scope = v;
        m.scope = v;
        draw();
      }),
      pick('Waves', 'waves', WAVES.map((w) => ({ id: w.id, name: w.name })), m.waves ?? 'all', (v) => {
        m.waves = v;
        draw();
      }),
    );
    // Filters by what is in these runs.
    const kinds = new Set<string>();
    const weapons = new Set<string>();
    for (const r of rs) {
      for (const e of r.sidecar.events) {
        if (e.k === 'thr+') kinds.add(e.kind);
        else if (e.k === 'hurt' && e.kill) weapons.add(e.w ?? e.by);
      }
    }
    side.append(
      pick('Enemy', 'kind', [{ id: 'all', name: 'Every enemy' }, ...[...kinds].sort().map((k) => ({ id: k, name: k }))], m.kind ?? 'all', (v) => {
        m.kind = v;
        draw();
      }),
      pick('Launched from', 'platform', [{ id: 'all', name: 'Anywhere' }, { id: 'base', name: 'A base' }, { id: 'mobile', name: 'A truck or submarine' }, { id: 'air', name: 'An aircraft' }], m.platform ?? 'all', (v) => {
        m.platform = v;
        draw();
      }),
      pick('Weapon', 'weapon', [{ id: 'all', name: 'Every weapon' }, ...[...weapons].sort().map((k) => ({ id: k, name: k }))], m.weapon ?? 'all', (v) => {
        m.weapon = v;
        draw();
      }),
    );
    side.append(sum);
  }

  function drawTop(): HTMLElement {
    const top = el('div', 'v3-maplab-top');
    top.append(
      segs('Layer', 'maplabLayer', LAYERS.map((l) => ({ id: l.id, name: l.name })), layerId, (v) => {
        layerId = v;
        m.layer = v;
        metric = LAYERS.find((l) => l.id === v)!.metrics[0].id;
        m.metric = metric;
        tracePath = [];
        draw();
      }),
    );
    const ms = LAYERS.find((l) => l.id === layerId)!.metrics;
    if (ms.length > 1) {
      top.append(
        segs('Measure', 'maplabMetric', ms.map((o) => ({ id: o.id, name: o.name })), metric, (v) => {
          metric = v;
          m.metric = v;
          draw();
        }),
      );
    }
    return top;
  }

  let topEl: HTMLElement | null = null;
  function draw(): void {
    loadBg();
    current = compute();
    drawSide();
    const t = drawTop();
    if (topEl) topEl.replaceWith(t);
    else main.prepend(t);
    topEl = t;
    drawBoard(current);
    drawStrip();
    drawWindow();
    drawLegend(current);
    drawSummary(current);
    drawDetail(current);
    drawStatus();
  }

  // A tap on the map picks its square.
  canvas.addEventListener('click', (ev) => {
    const r = canvas.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * VIEW.width;
    const y = ((ev.clientY - r.top) / r.height) * VIEW.height;
    const c = cellOf(x, y);
    cell = c === cell ? -1 : c;
    m.cell = cell;
    tracePath = [];
    drawBoard(current);
    if (current) drawDetail(current);
  });

  root.append(main, side);
  // What the browser test reads (the screen's numbers, as shown).
  (root as HTMLElement & { maplab?: unknown }).maplab = {
    state: () => ({ map, layer: layerId, metric, scope, cell, runs: mapRuns().map((r) => ({ id: r.id, set: setOf(r.id), steps: r.sidecar.steps })), busy, total: current?.a.total ?? 0, top: current?.a.top ?? 0, diffTop: current?.d?.top ?? null, summary: current?.sa ?? null, trace: tracePath.length, window: m.win ?? null }),
    cellAt: (i: number) => current?.a.cells[i] ?? null,
    refs: (i: number) => current?.a.refs[i] ?? [],
    hottest: () => (current ? current.a.cells.reduce((best, c, i) => ((c.v ?? 0) > (current!.a.cells[best]?.v ?? 0) ? i : best), 0) : -1),
  };
  draw();
  readLogs();
  return root;
}
