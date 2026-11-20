// Does the "you" bot play like the player? Its numbers next to the player's,
// on the same ruler (measure.ts), on the reference maps' Test Lab cards, with
// the player's own Armory (map rebuild phase 2; docs/design/v3-bot-refit.md).
//
//   npx vite-node tools/v3/bot-fit/fit.ts -- --logs=<dir of play logs> [--remeasure] [--fresh]
//       measure the player's new logs and add them to tools/v3/bot-fit/player.json
//       (runs measured before are kept as they were; --remeasure measures the
//       folder's runs again, --fresh starts the file over)
//   --ids=<log id,...> limits calibration and --fun to those runs
//   --skip-low-effort leaves out the runs the player rated Effort 2 or less
//       ("casual / not really trying"; round 11); without it they are kept
//       and listed under the table, to be weighed less
//   npx vite-node tools/v3/bot-fit/fit.ts -- [--personas=you-r12,you] [--dice=6] [--own-picks] [--json=out.json]
//       calibration (the default): each of the player's runs, map cards and
//       campaign alike, mirrored by each bot with the same map, seed, Armory
//       upgrades, card setup and draft picks
//   npx vite-node tools/v3/bot-fit/fit.ts -- --cards [--seeds=12] [--maps=…] [--armory=none]
//       the reference cards' production setup today, on fresh seeds
//   npx vite-node tools/v3/bot-fit/fit.ts -- --fun [--raw=tools/v3/bot-fit/logs] [--dice=6] [--fun-dice=3] [--json=out.json]
//       the fun measures (saves, tension; docs/design/v3-fun-metrics.md) on
//       the player's runs whose raw log this build replays exactly, against
//       the bot's mirrored runs; lists the player's own saves
//
// The player's runs: every Test Lab map card's full run (log v21 and up) and
// every campaign run (v19 and up) that reached wave 5. Calibration copies
// each run's own Armory upgrades: the bot is fitted on the player's setup.
// Map testing (map-lab versions.ts) plays the baseline, with no upgrades.
// Bots play to the normal loss limit, so a boss round counts only for the
// runs that reach it, as the player's do.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { ArmoryLevels } from '../../../src/v3/data/armory';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import type { MapId } from '../../../src/v3/data/maps';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import { LOG_REPLAYS, replaysHere, type PlayLog } from '../../../src/v3/sim/playlog';
import type { Game } from '../../../src/v3/sim/game';
import type { CardId } from '../../../src/v3/data/abilities';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { PLAYER_ARMORY, measure, measureFun, pool, poolFun, type Pooled, type PooledFun, type RunMeasure } from './measure';
import { SAVE_NAMES, SHAPE_NAMES, waveName, type Save, type SaveKind } from '../../../src/v3/sim/funMetrics';
import { LOW_EFFORT, lowEffort, runEffort } from '../../../src/v3/sim/feedback';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const HERE = new URL('.', import.meta.url).pathname;
const PLAYER = `${HERE}player.json`;

export { PLAYER_ARMORY };
export const FIT_MAPS: MapId[] = ['strait', 'gauntlet', 'harbor'];

/** Which of the player's logs the fit reads. */
export function playerRun(l: PlayLog): 'card' | 'campaign' | null {
  // A Test Lab retry or skip (round 12) is not a whole run from wave 1.
  if (!l.summary || l.device?.ua === 'mimic' || l.dev?.watch || l.retry) return null;
  if (l.lab?.plays === 'full' && l.v >= 21 && l.summary.wave >= 5 && /^map-/.test(l.lab.card)) return 'card';
  if (!l.lab && !l.freePlay && l.v >= 19 && l.summary.wave >= 5) return 'campaign';
  return null;
}

export interface PlayerRun extends RunMeasure {
  kind: 'card' | 'campaign';
  /** How the run was set up, as its log has it: what a mirrored bot run
   *  copies (the seed, the Armory upgrades in use, the Test Lab card's
   *  setup, or none for a campaign run), and the cards picked. */
  setup: Pick<PlayLog, 'seed' | 'armory' | 'firstWave' | 'lab' | 'encounters' | 'convoy' | 'tempo' | 'freePlay'>;
  /** How hard the player said they tried, 1-5 (round 11: the run's Effort
   *  rating, or its map card's scorecard; absent: not rated). A run at
   *  LOW_EFFORT or under is a weak sample of how the player plays. */
  effort?: number;
}

/** The player's low-effort runs, flagged for the report: "map id (effort
 *  n)". */
export function effortNote(runs: readonly Pick<PlayerRun, 'id' | 'map' | 'effort'>[]): string {
  const rated = runs.filter((r) => r.effort !== undefined);
  const low = rated.filter((r) => lowEffort(r.effort));
  if (!rated.length) return 'Effort: none of these runs is rated for effort (the rating is new in round 11).';
  return `Effort: ${rated.length} of ${runs.length} runs rated (mean ${(rated.reduce((a, r) => a + r.effort!, 0) / rated.length).toFixed(1)} of 5). ${low.length ? `LOW EFFORT (${LOW_EFFORT} or less; weigh less, or rerun with --skip-low-effort): ${low.map((r) => `${r.map} ${r.id} (effort ${r.effort})`).join(', ')}.` : 'No low-effort runs.'}`;
}

/** Seconds to the millisecond: the saved file stays small. */
function compact(m: RunMeasure): RunMeasure {
  const r3 = (xs: number[]) => xs.map((x) => Math.round(x * 1000) / 1000);
  const map3 = (o: Record<string, number[]>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, r3(v)]));
  return { ...m, sec: r3(m.sec), gaps: r3(m.gaps), rests: r3(m.rests), ttiAtTap: r3(m.ttiAtTap), react: map3(m.react), grab: map3(m.grab), realSec: Math.round(m.realSec * 10) / 10 };
}

function loadPlayer(dir: string): PlayerRun[] {
  const out: PlayerRun[] = [];
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    const l = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as PlayLog;
    const kind = playerRun(l);
    if (!kind) continue;
    const setup: PlayerRun['setup'] = { seed: l.seed, armory: l.armory ?? {}, firstWave: l.firstWave };
    for (const k of ['lab', 'encounters', 'convoy', 'tempo', 'freePlay'] as const) if (l[k]) (setup as Record<string, unknown>)[k] = l[k];
    const effort = runEffort(l);
    out.push({ ...compact(measure(l, 'you')), kind, setup, ...(effort !== undefined ? { effort } : {}) });
  }
  return out;
}

/** One bot run on a map card's production setup, measured. */
export function botRun(map: MapId, persona: string, seed: number, armory: ArmoryLevels = PLAYER_ARMORY): RunMeasure {
  const card = labCard(mapCardId(map))!;
  const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
  const p = PERSONAS[persona];
  if (!p) throw new Error(`no persona ${persona}`);
  const run = new BotRun(map, seed, {
    persona: p,
    armory,
    lab: plan.lab,
    ...(plan.convoy ? { convoy: plan.convoy } : {}),
    ...(plan.encounters ? { encounters: plan.encounters } : {}),
  });
  run.advance(Infinity);
  return measure(run.finish(), 'bot', { botSpeed: p.speed ?? 1 });
}

/** Calibration: a bot run that mirrors one of the player's runs, on the
 *  same map and seed (another roll of the bot's dice each time), with the
 *  same Armory upgrades, the same Test Lab card setup (or none, for a
 *  campaign run), and, with `picks`, the same cards whenever they are
 *  offered (else the bot's own taste). */
export function mirrorRun(you: PlayerRun, persona: string, dice: number, picks = true, funDice = 0): RunMeasure {
  const log = mirrorLog(you, persona, dice, picks);
  const m = measure(log, 'bot', { botSpeed: PERSONAS[persona].speed ?? 1 });
  return funDice ? { ...m, ...measureFun(log, funDice) } : m;
}

/** A mirrored run's play log (mirrorRun's game); `seed` plays the player's
 *  setup on another seed (tools/v3/bot-fit/curve.ts). */
export function mirrorLog(you: PlayerRun, persona: string, dice: number, picks = true, seed?: number): PlayLog {
  const p = PERSONAS[persona];
  if (!p) throw new Error(`no persona ${persona}`);
  const st = you.setup;
  const run = new BotRun(you.map as MapId, seed ?? st.seed, {
    persona: p,
    armory: st.armory,
    firstWave: st.firstWave,
    dice,
    ...(st.tempo ? { tempo: st.tempo } : {}),
    ...(st.freePlay ? { freePlay: st.freePlay } : {}),
    ...(st.lab ? { lab: st.lab } : {}),
    ...(st.encounters ? { encounters: st.encounters } : {}),
    ...(st.convoy ? { convoy: st.convoy } : {}),
  });
  if (picks) {
    const bot = (run as unknown as { bot: { choose: (g: Game) => { id: CardId } } }).bot;
    const own = bot.choose.bind(bot);
    let k = 0;
    bot.choose = (g) => {
      const want = you.picks[k++] as CardId | undefined;
      return want && g.offer.includes(want) ? { id: want } : own(g);
    };
  }
  run.advance(Infinity);
  return run.finish();
}

export const ROWS: { key: keyof Pooled | string; name: string; d: number; group: string }[] = [
  { key: 'lost1to5', name: 'ships lost, waves 1-5', d: 2, group: 'Outcome' },
  { key: 'clean5', name: 'runs with no loss by wave 5', d: 2, group: 'Outcome' },
  { key: 'lost6to10', name: 'ships lost, waves 6-10', d: 2, group: 'Outcome' },
  { key: 'bossRound', name: 'ships lost a boss round', d: 2, group: 'Outcome' },
  { key: 'tapsPerSec', name: 'taps a second (real)', d: 2, group: 'Hands' },
  { key: 'burst', name: 'taps a burst', d: 2, group: 'Hands' },
  { key: 'gap', name: 'gap inside a burst (s)', d: 3, group: 'Hands' },
  { key: 'rest', name: 'rest between bursts, median (s)', d: 2, group: 'Hands' },
  { key: 'rest90', name: 'rest between bursts, 90th % (s)', d: 2, group: 'Hands' },
  { key: 'fireShare', name: 'taps that fire', d: 2, group: 'Accuracy' },
  { key: 'emptyShare', name: 'taps on nothing', d: 2, group: 'Accuracy' },
  { key: 'dryShare', name: 'taps on an empty rack', d: 2, group: 'Accuracy' },
  { key: 'killsPerShot', name: 'kills a shot', d: 2, group: 'Accuracy' },
  { key: 'react', name: 'reaction, median (s)', d: 2, group: 'Eyes' },
  { key: 'urgent', name: 'taps at the most urgent threat', d: 2, group: 'Eyes' },
  { key: 'top3', name: 'taps at a top-3 urgent threat', d: 2, group: 'Eyes' },
  { key: 'tti', name: 'seconds to impact at the tap', d: 2, group: 'Eyes' },
  { key: 'pickupsPerMin', name: 'pickup taps a minute', d: 2, group: 'Weapons' },
  { key: 'usesPerMin', name: 'weapon pickups a minute', d: 2, group: 'Weapons' },
  { key: 'fastShare', name: 'time played above 1×', d: 2, group: 'Tempo' },
];

const get = (p: Pooled, key: string): number => (p as unknown as Record<string, number>)[key];

const FUN_ROWS: { key: keyof PooledFun; name: string; d: number }[] = [
  { key: 'savesWave', name: 'saves a wave (1-10)', d: 2 },
  { key: 'savesBoss', name: 'saves a boss round', d: 2 },
  { key: 'savedWave', name: 'ships saved a wave (1-10)', d: 2 },
  { key: 'bigRun', name: 'big saves a run (stakes)', d: 2 },
  { key: 'peak', name: 'tension peak a wave', d: 2 },
  { key: 'peaks', name: 'tension peaks a wave', d: 2 },
  { key: 'releaseS', name: 'release after a peak (s)', d: 1 },
  { key: 'hotShare', name: 'hot share of a wave', d: 2 },
  { key: 'calmShare', name: 'calm share of a wave', d: 2 },
  { key: 'tapR', name: 'taps follow tension (r)', d: 2 },
];

const saveLine = (s: Save) =>
  `${(s.wave >= 11 ? waveName(s.wave) : `w${s.wave}`).padEnd(4)} ${s.t.toFixed(1).padStart(5)} s  ${SAVE_NAMES[s.kind].padEnd(17)} ${(s.what === 'kill' ? s.thrKind ?? '' : s.w ?? s.pk ?? '').padEnd(12)} ${s.margin.toFixed(2)} s from impact  saved ${s.saved.toFixed(2)}${s.delayCost >= 0.5 ? '  clutch (0.5 s later loses it)' : ''}${s.stakes.length ? `  STAKES: ${s.stakes.join(', ')}` : ''}  (${s.afloat} afloat, ${s.left} loss${s.left === 1 ? '' : 'es'} left)`;

/** The fun measures on the player's runs that replay exactly here, and on
 *  the bot's mirrors of them. */
function funCalibration(player: PlayerRun[]): void {
  const raw = opt('raw') ?? `${HERE}logs`;
  const dice = Number(opt('dice') ?? 6);
  const funDice = Number(opt('fun-dice') ?? 3);
  const personas = (opt('personas') ?? 'you').split(',');
  const picks = !args.includes('--own-picks');
  const t0 = Date.now();
  const byId = new Map<string, PlayLog>();
  for (const f of readdirSync(raw).filter((x) => x.endsWith('.json'))) {
    const l = JSON.parse(readFileSync(`${raw}/${f}`, 'utf8')) as PlayLog;
    byId.set(l.id, l);
  }
  const mine: (PlayerRun & RunMeasure)[] = [];
  for (const r of player) {
    const l = byId.get(r.id);
    if (!l) continue;
    // A log this build no longer replays exactly would be forked into a
    // different game: its saves would be wrong, so it is left out.
    if (!replaysHere(l.v)) {
      console.log(`SKIPPED ${r.id} (${r.map}): a v${l.v} log; this build replays v${LOG_REPLAYS.join(', v')} only, so its forks would be another game.`);
      continue;
    }
    const f = measureFun(l, funDice);
    if (!f.fun) {
      console.log(`SKIPPED ${r.id} (${r.map}, v${l.v}): its replay on this build does not end as the log did, so its forks would be another game.`);
      continue;
    }
    mine.push({ ...r, ...f });
  }
  console.log(`The player's runs with a raw log in ${raw} that this build replays exactly: ${mine.length} of ${player.length}${mine.length ? ` (${mine.map((r) => `${r.map} v${r.v}`).join(', ')})` : ''}. Without the raw log a run can't be forked: player.json keeps no inputs.`);
  if (!mine.length) {
    console.log(`\nNothing to compare: no player log here replays exactly on this build (v${LOG_REPLAYS.join(', v')}). Add new playtest logs to ${raw}. The last results, on the v26 build, are in tools/v3/bot-fit/results/fun-2026-11-18.json.`);
    return;
  }
  const cols: { name: string; runs: RunMeasure[] }[] = [{ name: 'you', runs: mine }];
  const mirrors = new Map<string, RunMeasure[]>();
  for (const persona of personas) {
    const all: RunMeasure[] = [];
    for (const r of mine) {
      const ms = Array.from({ length: dice }, (_, d) => mirrorRun(r, persona, d + 1, picks, funDice));
      mirrors.set(`${persona}:${r.id}`, ms);
      all.push(...ms);
    }
    cols.push({ name: persona, runs: all });
  }
  const pooled = cols.map((c) => ({ name: c.name, p: pool(c.runs) }));
  const w = 34;
  console.log(`\nFun: the player's ${mine.length} runs against each bot's ${dice} mirrors of each (same map, seed, Armory, setup${picks ? ', draft picks' : ''}); forks with ${funDice} rolls of the "you" bot's dice.\n`);
  console.log(`${''.padEnd(w)}${pooled.map((c) => c.name.padStart(13)).join('')}`);
  for (const r of ROWS.slice(0, 4)) console.log(`  ${r.name.padEnd(w - 2)}${pooled.map((c) => get(c.p, r.key as string).toFixed(r.d).padStart(13)).join('')}`);
  for (const r of FUN_ROWS) console.log(`  ${r.name.padEnd(w - 2)}${pooled.map((c) => (c.p.fun ? (c.p.fun[r.key] as number).toFixed(r.d) : '-').padStart(13)).join('')}`);
  console.log('  n (runs)'.padEnd(w) + pooled.map((c) => `${c.p.n}`.padStart(13)).join(''));
  console.log('\nSaves a wave, by map (waves 1-10, B1-B3):');
  const perMap: Record<string, { name: string; fun: PooledFun | null }[]> = {};
  for (const map of [...new Set(mine.map((r) => r.map))]) {
    perMap[map] = cols.map((c) => ({ name: c.name, fun: poolFun(c.runs.filter((r) => r.map === map)) }));
    for (const c of perMap[map]) {
      if (!c.fun) continue;
      console.log(`  ${map.padEnd(9)} ${c.name.padEnd(5)} saves ${c.fun.waves.map((x) => (x.n ? x.saves.toFixed(1) : ' - ')).join(' ')}`);
      console.log(`  ${''.padEnd(9)} ${''.padEnd(5)} shape ${c.fun.waves.map((x) => (x.n ? SHAPE_NAMES[x.shape].split(' ').map((y) => y[0]).join('').padStart(3) : ' - ')).join(' ')}`);
    }
  }
  console.log('\nThe player\'s own saves, and the bot\'s on the same run (mean of its mirrors):');
  const rows: Record<string, unknown>[] = [];
  for (const r of mine) {
    console.log(`\n  ${r.map} (${r.id}, ${r.end}, wave ${r.wave}, ${r.lost.reduce((a, b) => a + b, 0)} lost${r.effort !== undefined ? `, effort ${r.effort}${lowEffort(r.effort) ? ' LOW' : ''}` : ''})`);
    for (const s of r.saves ?? []) console.log(`    ${saveLine(s)}`);
    if (!r.saves?.length) console.log('    none');
    const kinds = (list: Save[]) => {
      const k: Partial<Record<SaveKind, number>> = {};
      for (const s of list) k[s.kind] = (k[s.kind] ?? 0) + 1;
      return k;
    };
    const yk = kinds(r.saves ?? []);
    for (const persona of personas) {
      const ms = mirrors.get(`${persona}:${r.id}`) ?? [];
      const n = ms.length || 1;
      const all = ms.flatMap((m) => m.saves ?? []);
      const bk = kinds(all);
      const kindText = (k: Partial<Record<SaveKind, number>>, div: number) => (Object.keys(SAVE_NAMES) as SaveKind[]).filter((x) => k[x]).map((x) => `${SAVE_NAMES[x]} ${((k[x] ?? 0) / div).toFixed(1)}`).join(', ') || 'none';
      console.log(`    you: ${(r.saves ?? []).length} saves (${kindText(yk, 1)}), ${(r.saves ?? []).filter((s) => s.stakes.length).length} with stakes`);
      console.log(`    ${persona}: ${(all.length / n).toFixed(1)} saves a run (${kindText(bk, n)}), ${(all.filter((s) => s.stakes.length).length / n).toFixed(1)} with stakes; reached wave ${(ms.reduce((a, m) => a + m.wave, 0) / n).toFixed(1)}, lost ${(ms.reduce((a, m) => a + m.lost.reduce((x, y) => x + y, 0), 0) / n).toFixed(1)}`);
      rows.push({ id: r.id, map: r.map, persona, you: r.saves ?? [], youKinds: yk, botSavesRun: all.length / n, botKinds: Object.fromEntries(Object.entries(bk).map(([k, v]) => [k, (v ?? 0) / n])), botStakesRun: all.filter((s) => s.stakes.length).length / n });
    }
  }
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const out = opt('json');
  if (out)
    writeFileSync(
      out,
      `${JSON.stringify({ about: 'Fun measures (docs/design/v3-fun-metrics.md): the player\'s runs that replay exactly against the bot\'s mirrors. Made by tools/v3/bot-fit/fit.ts --fun.', dice, funDice, columns: pooled.map((c) => ({ name: c.name, n: c.p.n, lost1to5: c.p.lost1to5, lost6to10: c.p.lost6to10, bossRound: c.p.bossRound, fun: c.p.fun })), perMap, runs: rows, digests: { you: mine.map((r) => ({ id: r.id, map: r.map, fun: r.fun })) } }, (_k, v) => (typeof v === 'number' ? (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null) : v), 1)}\n`,
    );
}

function main(): void {
  const logs = opt('logs');
  if (logs) {
    // The player's earlier runs stay as they were measured: their raw logs
    // are not all kept, and a log measured on its own build reads its eyes
    // on more exact waves than a later build can. Only new runs are added;
    // --remeasure measures again the runs in the folder, --fresh starts over.
    const before = args.includes('--fresh') ? [] : (JSON.parse(readFileSync(PLAYER, 'utf8')) as { runs: PlayerRun[] }).runs;
    const had = new Set(before.map((r) => r.id));
    const fresh = loadPlayer(logs).filter((r) => args.includes('--remeasure') || !had.has(r.id));
    const ids = new Set(fresh.map((r) => r.id));
    const kept = before.filter((r) => !ids.has(r.id));
    const runs = [...kept, ...fresh].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    writeFileSync(PLAYER, `${JSON.stringify({ about: 'The player\'s runs, measured by tools/v3/bot-fit/measure.ts from their play logs (map cards v21+, campaign v19+). Rebuild with fit.ts --logs=<dir>.', made: new Date().toISOString().slice(0, 10), runs }, null, 0)}\n`);
    console.log(`measured ${fresh.length} runs from ${logs}, kept ${kept.length} earlier: ${runs.length} runs (${runs.filter((r) => r.kind === 'card').length} map cards) -> ${PLAYER}`);
    return;
  }
  const only = opt('ids')?.split(',');
  const all = (JSON.parse(readFileSync(PLAYER, 'utf8')) as { runs: PlayerRun[] }).runs.filter((r) => !only || only.includes(r.id));
  // Round 11: the runs the player said they weren't really trying on.
  const skipLow = args.includes('--skip-low-effort');
  const player = skipLow ? all.filter((r) => !lowEffort(r.effort)) : all;
  console.log(`${effortNote(all)}${skipLow && all.length > player.length ? ` Left out: ${all.length - player.length}.` : ''}\n`);
  if (args.includes('--fun')) {
    funCalibration(player);
    return;
  }
  const maps = (opt('maps')?.split(',') ?? FIT_MAPS) as MapId[];
  const personas = (opt('personas') ?? 'you-r12,you').split(',');
  const columns: { name: string; p: Pooled }[] = [];
  const perMap: Record<string, { name: string; p: Pooled }[]> = {};
  let head: string;
  if (args.includes('--cards')) {
    // The cards' production setup today, on fresh seeds, with the player's
    // usual Armory (or --armory=none): how the bot reads a map now.
    const seeds = Array.from({ length: Number(opt('seeds') ?? 12) }, (_, k) => 900 + k);
    const armory = opt('armory') === 'none' ? {} : PLAYER_ARMORY;
    const cards = player.filter((r) => r.kind === 'card' && maps.includes(r.map as MapId));
    columns.push({ name: 'you (cards)', p: pool(cards) });
    for (const map of maps) perMap[map] = [{ name: 'you', p: pool(cards.filter((r) => r.map === map)) }];
    for (const persona of personas) {
      const runs: RunMeasure[] = [];
      for (const map of maps) {
        const mine = seeds.map((s) => botRun(map, persona, s, armory));
        runs.push(...mine);
        perMap[map].push({ name: persona, p: pool(mine) });
      }
      columns.push({ name: persona, p: pool(runs) });
    }
    head = `The player's map-card runs (${cards.length}) against each bot on the cards' production setup today (${seeds.length} seeds × ${maps.join(', ')}; Armory ${JSON.stringify(armory)}).`;
  } else {
    // Calibration (the default): every bot run mirrors one of the player's
    // runs, map cards and campaign alike: same map, seed, Armory upgrades,
    // card setup and (unless --own-picks) draft picks.
    const dice = Number(opt('dice') ?? 6);
    const picks = !args.includes('--own-picks');
    columns.push({ name: 'you', p: pool(player) });
    const byMap = [...new Set(player.map((r) => r.map))];
    for (const map of byMap) perMap[map] = [{ name: 'you', p: pool(player.filter((r) => r.map === map)) }];
    for (const persona of personas) {
      const all: RunMeasure[] = [];
      for (const map of byMap) {
        const mine = player.filter((r) => r.map === map).flatMap((r) => Array.from({ length: dice }, (_, d) => mirrorRun(r, persona, d + 1, picks)));
        all.push(...mine);
        perMap[map].push({ name: persona, p: pool(mine) });
      }
      columns.push({ name: persona, p: pool(all) });
    }
    head = `Calibration: each of the player's ${player.length} runs (${player.filter((r) => r.kind === 'card').length} map cards, ${player.filter((r) => r.kind === 'campaign').length} campaign) mirrored ${dice}× by each bot: same map, seed, Armory upgrades and setup${picks ? ', and the same draft picks where offered' : ''}.`;
  }
  const w = 34;
  console.log(`${head}\n`);
  console.log(`${''.padEnd(w)}${columns.map((c) => c.name.padStart(13)).join('')}`);
  let group = '';
  for (const r of ROWS) {
    if (r.group !== group) console.log((group = r.group));
    console.log(`  ${r.name.padEnd(w - 2)}${columns.map((c) => get(c.p, r.key as string).toFixed(r.d).padStart(13)).join('')}`);
  }
  console.log('  n (runs; boss rounds)'.padEnd(w) + columns.map((c) => `${c.p.n}; ${c.p.bossN}`.padStart(13)).join(''));
  const kinds = ['@carrier', '@ship', 'drone', 'ballistic', 'guided', 'heavy', 'cluster', 'strafer', 'supersonic', 'sprinter', 'hydra', 'rocketTruck', 'bomber'];
  console.log('Share of each kind given no tap (exact waves)');
  for (const k of kinds) console.log(`  ${k.padEnd(w - 2)}${columns.map((c) => (c.p.untapped[k] === undefined ? '-' : c.p.untapped[k].toFixed(2)).padStart(13)).join('')}`);
  console.log('Seconds from a drop to its tap (median, exact waves)');
  for (const k of ['supply', 'weapon', 'ammo', 'repair', 'nuke']) console.log(`  ${k.padEnd(w - 2)}${columns.map((c) => (c.p.grab[k] === undefined ? '-' : c.p.grab[k].toFixed(2)).padStart(13)).join('')}`);
  console.log('\nShips lost per wave played (1-13), by map:');
  for (const map of Object.keys(perMap))
    for (const c of perMap[map]) console.log(`  ${map.padEnd(9)} ${c.name.padEnd(10)} ${c.p.curve.map((v) => (Number.isFinite(v) ? v.toFixed(1) : ' - ')).join(' ')}   (n ${c.p.n}, boss ${c.p.bossRound.toFixed(2)}/round over ${c.p.bossN})`);
  const out = opt('json');
  if (out) writeFileSync(out, `${JSON.stringify({ about: head, columns, perMap, effort: player.map((r) => ({ id: r.id, map: r.map, effort: r.effort ?? null, low: lowEffort(r.effort) })) }, null, 1)}\n`);
}

if (!process.env.V3_FIT_IMPORT) main();
