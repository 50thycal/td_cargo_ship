// One playtest, measured: the player's runs against the "you" bot's mirrors
// of them, the player's saves and tension wave by wave, and the scorecard's
// Best moment against the tension peaks and the saves.
//
//   V3_FIT_IMPORT=1 npx vite-node tools/v3/bot-fit/playtest.ts -- \
//     --review=tools/v3/map-rules/review-2026-11-19.json --dice=12 --fun-dice=3 \
//     --json=tools/v3/bot-fit/results/ch1-playtest-2026-11-19.json
//
// The runs are the review file's `playtest` entries; their raw logs are read
// from tools/v3/bot-fit/logs. The logs must replay exactly on this build (the
// fun measures fork the game): run it on the build the playtest was played on.
// `--predict` adds the map cards' bot predictions (ships lost in waves 1-10
// and a boss round), as `map=w1to10/b1/b2/b3;...`.

import { readFileSync, writeFileSync } from 'node:fs';
import type { PlayLog } from '../../../src/v3/sim/playlog';
import { funOfLog, SAVE_NAMES, SHAPE_NAMES, waveName, type FunResult, type Save } from '../../../src/v3/sim/funMetrics';
import { measure, mean } from './measure';
import { mirrorRun, type PlayerRun } from './fit';
import { lowEffort, runEffort } from '../../../src/v3/sim/feedback';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const HERE = new URL('.', import.meta.url).pathname;
const review = JSON.parse(readFileSync(opt('review') ?? `${HERE}../map-rules/review-2026-11-19.json`, 'utf8')) as {
  playtest: Record<string, { log: string; score?: { moment?: number; momentT?: number }; notes?: string[]; pauseNotes?: string[] }>;
};
const dice = Number(opt('dice') ?? 12);
const funDice = Number(opt('fun-dice') ?? 3);
const player = (JSON.parse(readFileSync(`${HERE}player.json`, 'utf8')) as { runs: PlayerRun[] }).runs;
const predict: Record<string, number[]> = {};
for (const part of (opt('predict') ?? '').split(';').filter(Boolean)) {
  const [m, v] = part.split('=');
  predict[m] = v.split('/').map(Number);
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** The seconds of a wave's tension series at or above `hot`, grouped into
 *  peaks (split where the reading falls below `release`), each with its top. */
function peaksOf(series: number[], hot = 0.75, release = 0.35): { from: number; to: number; at: number; top: number }[] {
  const out: { from: number; to: number; at: number; top: number }[] = [];
  let cur: { from: number; to: number; at: number; top: number } | null = null;
  series.forEach((v, s) => {
    if (v >= hot) {
      if (!cur) cur = { from: s, to: s, at: s, top: v };
      cur.to = s;
      if (v > cur.top) {
        cur.top = v;
        cur.at = s;
      }
    } else if (cur && v < release) {
      out.push(cur);
      cur = null;
    }
  });
  if (cur) out.push(cur);
  return out.map((p) => ({ ...p, top: r2(p.top) }));
}

const saveRow = (s: Save) => ({
  wave: waveName(s.wave),
  t: Math.round(s.t * 10) / 10,
  step: s.step,
  kind: SAVE_NAMES[s.kind],
  what: s.what === 'kill' ? s.thrKind : s.w ?? s.pk,
  margin: r2(s.margin),
  saved: r2(s.saved),
  clutch: s.delayCost >= 0.5,
  stakes: s.stakes,
  afloat: s.afloat,
  left: s.left,
});

const out: Record<string, unknown> = {};
for (const [name, p] of Object.entries(review.playtest)) {
  const log = JSON.parse(readFileSync(`${HERE}logs/${p.log}.json`, 'utf8')) as PlayLog;
  const me = measure(log, 'you');
  const fun: FunResult = funOfLog(log, { dice: funDice, judgeAll: true });
  const waves = fun.waves.map((w, k) => {
    if (!w) return null;
    return {
      wave: waveName(k + 1),
      lost: me.lost[k] ?? 0,
      sec: w.seconds,
      peak: r2(w.tension.peak),
      peakAt: w.series.indexOf(Math.max(...w.series)),
      mean: r2(w.tension.mean),
      hot: r2(w.tension.hotShare),
      peaks: peaksOf(w.series),
      shape: SHAPE_NAMES[w.tension.shape],
      tapR: r2(w.tapR),
      saves: w.saves.map(saveRow),
    };
  });
  // The Best moment: the wave and the second the player tapped.
  let best: Record<string, unknown> | null = null;
  const mw = p.score?.moment;
  if (mw && fun.waves[mw - 1]) {
    const w = fun.waves[mw - 1]!;
    const at = Math.min(w.series.length - 1, Math.floor(p.score?.momentT ?? 0));
    const pk = peaksOf(w.series);
    const nearPeak = pk.map((x) => ({ ...x, off: x.from <= at && at <= x.to ? 0 : Math.min(Math.abs(at - x.from), Math.abs(at - x.to)) })).sort((a, b) => a.off - b.off)[0];
    const nearSave = w.saves.map((s) => ({ ...saveRow(s), off: r2(Math.abs(s.t - (p.score?.momentT ?? 0))) })).sort((a, b) => a.off - b.off)[0];
    const runPeak = fun.waves.map((x, k) => ({ k, top: x ? x.tension.peak : -1 })).sort((a, b) => b.top - a.top)[0];
    best = {
      wave: waveName(mw),
      t: p.score?.momentT,
      tensionThen: r2(w.series[at]),
      waveTop: r2(w.tension.peak),
      waveTopAt: w.series.indexOf(Math.max(...w.series)),
      nearestPeak: nearPeak ?? null,
      nearestSave: nearSave ?? null,
      runTopWave: waveName(runPeak.k + 1),
      runTop: r2(runPeak.top),
      lossesThatWave: me.lost[mw - 1] ?? 0,
    };
  }
  // Every nuke forked, save or not (the "clutch nuke" question).
  const nukes = (fun.judged ?? []).filter((s) => s.what === 'nuke').map((s) => ({ ...saveRow(s), perDie: s.perDie.map(r2), save: fun.saves.includes(s) }));
  const entry: Record<string, unknown> = {
    log: p.log,
    map: log.map,
    exact: fun.exact,
    lost: me.lost,
    saves: fun.saves.map(saveRow),
    tested: fun.tested,
    waves,
    best,
    nukes,
    notes: (log.notes ?? []).map((n) => ({ step: n.step, wave: n.ctx?.wave, t: n.ctx?.waveT, text: n.text })),
  };
  // The bot's mirrors: same map, seed, Armory, card setup and picks.
  const run = player.find((r) => r.id === p.log);
  if (run && run.kind === 'card') {
    const ms = Array.from({ length: dice }, (_, d) => mirrorRun(run, 'you', d + 1, true));
    const per = (k: number) => {
      const on = ms.filter((m) => m.lost.length > k);
      return { n: on.length, mean: on.length ? r2(mean(on.map((m) => m.lost[k]))) : null };
    };
    const curve = Array.from({ length: 13 }, (_, k) => per(k));
    entry.bot = {
      dice,
      won: r2(ms.filter((m) => m.won).length / ms.length),
      endWave: r2(mean(ms.map((m) => m.wave))),
      lost1to10: r2(mean(ms.map((m) => sum(m.lost.slice(0, 10))))),
      curve,
      boss: [10, 11, 12].map((k) => curve[k].mean),
    };
    entry.you = { lost1to10: sum(me.lost.slice(0, 10)), boss: me.lost.slice(10, 13) };
    if (predict[log.map]) entry.cardPrediction = { lost1to10: predict[log.map][0], boss: predict[log.map].slice(1) };
  }
  // Round 11: how hard the player said they tried (a low-effort run is a
  // weak sample: weigh it less).
  const effort = runEffort(log);
  if (effort !== undefined) entry.effort = { rating: effort, low: lowEffort(effort) };
  out[name] = entry;
  // A readable summary.
  console.log(`\n== ${name} (${p.log}, ${log.map}, exact replay: ${fun.exact}${effort !== undefined ? `, effort ${effort}${lowEffort(effort) ? ' LOW: weigh less' : ''}` : ''})`);
  console.log(`lost by wave: ${me.lost.join(' ')}  (waves 1-10: ${sum(me.lost.slice(0, 10))}; boss ${me.lost.slice(10).join('/') || '-'})`);
  if (entry.bot) {
    const b = entry.bot as { lost1to10: number; boss: (number | null)[]; won: number; curve: { n: number; mean: number | null }[] };
    console.log(`bot mirror (${dice} dice): won ${b.won}, waves 1-10 ${b.lost1to10}, boss ${b.boss.join(' / ')}; curve ${b.curve.map((c) => (c.mean === null ? '-' : c.mean.toFixed(2))).join(' ')}`);
    if (entry.cardPrediction) console.log(`card prediction: ${JSON.stringify(entry.cardPrediction)}`);
  }
  for (const w of waves) if (w) console.log(`  ${w.wave.padEnd(3)} lost ${w.lost}  peak ${w.peak.toFixed(2)} @${w.peakAt}s  mean ${w.mean.toFixed(2)}  hot ${w.hot.toFixed(2)}  ${w.shape}  saves ${w.saves.length}  peaks ${w.peaks.map((x) => `${x.from}-${x.to}s(${x.top})`).join(' ')}`);
  for (const s of fun.saves) console.log(`  SAVE ${JSON.stringify(saveRow(s))}`);
  if (best) console.log(`  BEST MOMENT ${JSON.stringify(best)}`);
  for (const n of nukes) console.log(`  NUKE ${JSON.stringify(n)}`);
}
const file = opt('json');
if (file) writeFileSync(file, `${JSON.stringify({ about: 'A playtest measured: the player against the "you" bot mirrors (same map, seed, Armory, card setup, picks), the player\'s saves and tension per wave, and Best moment against the peaks and saves. Made by tools/v3/bot-fit/playtest.ts.', funDice, runs: out }, null, 1)}\n`);
