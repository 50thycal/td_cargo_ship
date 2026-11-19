// A map's wave curve on the player's own setup: the "you" bot mirroring one
// of the player's runs (same map, card setup, Armory and draft picks; see
// fit.ts mirrorRun), on the player's seed with many dice and, with
// --seeds=N, on N more seeds. Per wave: ships lost (over the runs that
// reached it), the tension curve's peak, peaks and shape (src/v3/sim/
// funMetrics.ts, no forks), and the run's win rate. Made for the chapter 1
// wave-curve pass (docs/design/v3-ch1-kesh.md, "After the v29 replay").
//
//   V3_FIT_IMPORT=1 npx vite-node tools/v3/bot-fit/curve.ts -- \
//     --ids=v3-20261119202157-1083,v3-20261119132436-3976 [--dice=16] [--seeds=16] [--json=out.json]
//
// The run must be in tools/v3/bot-fit/player.json (fit.ts --logs=...).

import { readFileSync, writeFileSync } from 'node:fs';
import { SHAPE_NAMES, funOfLog, tensionStats, waveName, type Shape } from '../../../src/v3/sim/funMetrics';
import { measure, mean } from './measure';
import { Playback, replaysHere, type PlayLog } from '../../../src/v3/sim/playlog';
import { mirrorLog, type PlayerRun } from './fit';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const HERE = new URL('.', import.meta.url).pathname;
const player = (JSON.parse(readFileSync(`${HERE}player.json`, 'utf8')) as { runs: PlayerRun[] }).runs;
const ids = (opt('ids') ?? '').split(',').filter(Boolean);
const dice = Number(opt('dice') ?? 16);
const seeds = Number(opt('seeds') ?? 0);
const WAVES = 13;
const r2 = (x: number) => Math.round(x * 100) / 100;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

interface Row {
  n: number;
  lost: number;
  peak: number;
  peaks: number;
  hot: number;
  shape: Shape;
  shapes: Partial<Record<Shape, number>>;
}

export interface CurveResult {
  id: string;
  map: string;
  runs: number;
  won: number;
  lost1to5: number;
  lost6to10: number;
  lost1to10: number;
  /** Marrow: the median wave the radar tower fell on (99: stood). */
  tower: number | null;
  /** The wave 1-10 tension peak each run first reaches 0.75 (hot) on. */
  firstHot: number;
  waves: Row[];
  /** What sank the ships, per wave (a run's mean). */
  sunkBy: Record<string, number>[];
}

/** The wave a map's allied structure (Marrow's radar tower) was lost on: 0
 *  if it stood to the end, -1 if the map has none. */
function towerFell(log: PlayLog): number {
  const pb = new Playback(log, 0);
  const g = pb.game;
  if (!g.posts.length) return -1;
  for (let guard = 0; guard < 10_000_000 && pb.advance(); guard++) if (g.posts[0].lost) return g.wave;
  return 0;
}

function curve(you: PlayerRun, plays: { seed?: number; dice: number }[]): CurveResult {
  const sunk: Record<string, number>[] = Array.from({ length: WAVES }, () => ({}));
  const per: { lost: number[]; won: boolean; tower: number; tension: (ReturnType<typeof tensionStats> | null)[] }[] = [];
  for (const p of plays) {
    const log = mirrorLog(you, 'you', p.dice, true, p.seed);
    const m = measure(log, 'bot');
    const fun = funOfLog(log, { noSaves: true });
    // A wave's summary counts the run so far: the wave's own is the change.
    let before: Record<string, number> = {};
    (log.summary?.waves ?? []).forEach((w, k) => {
      const now = (w.sunkBy ?? {}) as Record<string, number>;
      if (k < WAVES) for (const [kind, n] of Object.entries(now)) if (n > (before[kind] ?? 0)) sunk[k][kind] = (sunk[k][kind] ?? 0) + (n - (before[kind] ?? 0)) / plays.length;
      before = now;
    });
    per.push({ lost: m.lost, won: m.won, tower: towerFell(log), tension: Array.from({ length: WAVES }, (_, k) => fun.waves[k]?.tension ?? null) });
  }
  const waves: Row[] = Array.from({ length: WAVES }, (_, k) => {
    const on = per.filter((r) => r.tension[k]);
    const shapes: Partial<Record<Shape, number>> = {};
    for (const r of on) shapes[r.tension[k]!.shape] = (shapes[r.tension[k]!.shape] ?? 0) + 1 / on.length;
    const shape = (Object.entries(shapes).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? 'flat') as Shape;
    return {
      n: on.length,
      lost: r2(mean(on.map((r) => r.lost[k] ?? 0))),
      peak: r2(mean(on.map((r) => r.tension[k]!.peak))),
      peaks: r2(mean(on.map((r) => r.tension[k]!.peaks))),
      hot: r2(mean(on.map((r) => r.tension[k]!.hotShare))),
      shape,
      shapes: Object.fromEntries(Object.entries(shapes).map(([s, v]) => [s, r2(v ?? 0)])),
    };
  });
  const upTo = (r: (typeof per)[number], a: number, b: number) => sum(r.lost.slice(a - 1, b));
  const firstHot = per.map((r) => {
    const k = r.tension.slice(0, 10).findIndex((t) => t && t.peak >= 0.75);
    return k < 0 ? 11 : k + 1;
  });
  const fell = per.map((r) => r.tower).filter((x) => x >= 0);
  const tower = fell.length ? fell.map((x) => (x === 0 ? 99 : x)).sort((a, b) => a - b)[fell.length >> 1] : null;
  return {
    id: you.id,
    tower,
    map: you.map,
    runs: per.length,
    won: r2(per.filter((r) => r.won).length / per.length),
    lost1to5: r2(mean(per.map((r) => upTo(r, 1, 5)))),
    lost6to10: r2(mean(per.filter((r) => r.tension[5]).map((r) => upTo(r, 6, 10)))),
    lost1to10: r2(mean(per.map((r) => upTo(r, 1, 10)))),
    firstHot: r2(mean(firstHot)),
    waves,
    sunkBy: sunk.map((o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, r2(v)]))),
  };
}

const SHORT: Record<Shape, string> = { flat: 'f', single: '1', sawtooth: 's', rising: 'sr', pinned: 'p' };

function print(label: string, c: CurveResult): void {
  console.log(`\n== ${c.map} ${label} (${c.id}, ${c.runs} runs): won ${c.won}, lost 1-5 ${c.lost1to5}, 6-10 ${c.lost6to10}, 1-10 ${c.lost1to10}; first hot wave ${c.firstHot}${c.tower !== null ? `; tower falls (median) w${c.tower}` : ''}`);
  const head = c.waves.map((_, k) => waveName(k + 1).padStart(5)).join('');
  console.log(`        ${head}`);
  console.log(`lost    ${c.waves.map((w) => w.lost.toFixed(2).padStart(5)).join('')}`);
  console.log(`peak    ${c.waves.map((w) => w.peak.toFixed(2).padStart(5)).join('')}`);
  console.log(`peaks   ${c.waves.map((w) => w.peaks.toFixed(2).padStart(5)).join('')}`);
  console.log(`hot     ${c.waves.map((w) => w.hot.toFixed(2).padStart(5)).join('')}`);
  console.log(`shape   ${c.waves.map((w) => SHORT[w.shape].padStart(5)).join('')}`);
  console.log(`sunk by ${c.sunkBy.slice(0, 10).map((o, k) => `w${k + 1} ${Object.entries(o).slice(0, 3).map(([kk, v]) => `${kk} ${v}`).join(', ')}`).join(' | ')}`);
  console.log(`n       ${c.waves.map((w) => String(w.n).padStart(5)).join('')}`);
}

const out: Record<string, unknown> = {};
for (const id of ids) {
  const you = player.find((r) => r.id === id);
  if (!you) throw new Error(`${id} is not in player.json (fit.ts --logs=...)`);
  const t0 = Date.now();
  const mirror = curve(you, Array.from({ length: dice }, (_, d) => ({ dice: d + 1 })));
  print('mirror, the player\'s seed', mirror);
  const entry: Record<string, unknown> = { mirror };
  // The player's own run, when its raw log replays on this build.
  try {
    const log = JSON.parse(readFileSync(`${HERE}logs/${id}.json`, 'utf8')) as PlayLog;
    if (replaysHere(log.v)) {
      const fun = funOfLog(log, { noSaves: true });
      const lost = measure(log, 'you').lost;
      const waves = Array.from({ length: WAVES }, (_, k) => fun.waves[k]?.tension ?? null);
      entry.player = { exact: fun.exact, lost, peak: waves.map((t) => (t ? r2(t.peak) : null)), shape: waves.map((t) => (t ? t.shape : null)) };
      const tw = towerFell(log);
      (entry.player as Record<string, unknown>).tower = tw;
      if (tw >= 0) console.log(`player  tower fell: ${tw ? `w${tw}` : 'stood'}`);
      console.log(`player  lost ${lost.map((x) => String(x).padStart(5)).join('')}`);
      console.log(`player  peak ${waves.map((t) => (t ? t.peak.toFixed(2) : '-').padStart(5)).join('')}  (exact replay: ${fun.exact})`);
      console.log(`player shape ${waves.map((t) => (t ? SHORT[t.shape] : '-').padStart(5)).join('')}`);
    }
  } catch {
    // no raw log
  }
  if (seeds) {
    const other = curve(you, Array.from({ length: seeds }, (_, k) => ({ seed: 900 + k, dice: 1 })));
    print(`the player's setup, seeds 900-${899 + seeds}`, other);
    entry.seeds = other;
  }
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s; shapes: ${Object.entries(SHORT).map(([k, v]) => `${v} ${SHAPE_NAMES[k as Shape]}`).join(', ')})`);
  out[id] = entry;
}
const file = opt('json');
if (file) writeFileSync(file, `${JSON.stringify({ about: 'The "you" bot on the player\'s setup (mirror: the player\'s seed, picks, Armory; seeds: the same setup on seeds 900..): ships lost and tension per wave. Made by tools/v3/bot-fit/curve.ts.', dice, seeds, runs: out }, null, 1)}\n`);
