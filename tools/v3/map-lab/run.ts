// The Map & Convoy Lab's command line (docs/design/v3-map-convoy-lab-plan.md;
// what slices 0 and 1 found: docs/design/v3-map-lab-slice0-1.md).
//
//   npm run v3:map-lab -- baseline            replay the stored baseline logs; say what differs
//   npm run v3:map-lab -- baseline --write    play the recipes again and store their logs and results
//   npm run v3:map-lab -- telemetry <log.json> [--out=sidecar.json]
//                                             replay any V3 play log with telemetry on
//   npm run v3:map-lab -- audit [--seeds=3] [--maps=a,b] [--personas=you,tryhard]
//                                             bot runs on every map: on/off equivalence, replay, reconciliation
//   npm run v3:map-lab -- bench               what telemetry costs: time, bytes, and the sampling rate's error
//   npm run v3:map-lab -- preview             what the baseline's telemetry adds up to, map by map
//   npm run v3:map-lab -- experiment [--seeds=8] [--maps=a,b] [--personas=you,tryhard]
//                                             the convoy policies A to D on the same seeds, with their denominators
//   npx vite-node tools/v3/map-lab/page.ts -- report.html --logs=a.json,b.json
//                                             a report page (maps, layers, numbers) from any play logs
//
// A sidecar is a pure function of the build and the log, so nothing here
// needs a sidecar to have been saved when the run was played.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { MAP_ORDER, type MapId } from '../../../src/v3/data/maps';
import { VIEW } from '../../../src/v3/data/config';
import { BASELINE, baselineDiff, baselineResult, lockstep, phaseWords, playRecipe, stateHash, type BaselineResult } from '../../../src/v3/sim/mapLab';
import { PERSONAS, playMimic } from '../../../src/v3/sim/mimic';
import { LOG_VERSION, Playback, replay, type PlayLog } from '../../../src/v3/sim/playlog';
import { TEL_SAMPLING, reconcile, sidecarDigest, type TelemetrySidecar } from '../../../src/v3/sim/telemetry';
import { PLATFORMS, SCOPES, buildPreview } from './preview';
import { CONVOY_REV, mapConvoy } from '../../../src/v3/data/convoy';
import { cohort, paired, runTrial, type Cohort, type TrialSpec } from '../../../src/v3/sim/convoyLab';
import { REFERENCE_MAPS } from '../../../src/v3/sim/mapLab';

import { ENCOUNTER_REV } from '../../../src/v3/data/encounters';

const DIR = 'tests/v3/fixtures/map-lab';
const args = process.argv.slice(2).filter((a) => a !== '--');
const cmd = args[0] ?? 'baseline';
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const flag = (k: string) => args.includes(`--${k}`);
const pad = (v: unknown, n: number) => String(v).padEnd(n);
const lpad = (v: unknown, n: number) => String(v).padStart(n);

/** `--json=path`: the command's numbers as a results file (the review page
 *  and the slice's notes read them from there, never retyped). */
function saveJson(data: unknown): void {
  const out = opt('json');
  if (!out) return;
  writeFileSync(out, `${JSON.stringify(data, null, 1)}\n`);
  console.log(`wrote ${out}`);
}

function summary(sc: TelemetrySidecar): string {
  const t = sc.totals;
  const noSrc = sc.events.filter((e) => e.k === 'hit' && e.src === undefined).length;
  return [
    `  ${sc.header.map} seed ${sc.header.seed}, ${sc.steps} steps (${sc.seconds} s), schema ${sc.header.schema}, log v${sc.header.logVersion}, map ${sc.header.mapHash}, content ${sc.header.contentHash}`,
    `  phases: ${phaseWords(sc).join(' | ')}`,
    `  ${sc.events.length} events, ${sc.samples.length} samples; launches ${t.spawned}, kills ${t.kills}`,
    `  hull: ${t.hits} hits (${t.blocked} blocked), ${t.hpShip} ship hull points, ${t.hpCarrier} carrier, ${t.hpPost} post; healed ${t.healed}; hits with no attacker named: ${noSrc}`,
    `  ships: ${t.sailed} sailed, ${t.delivered} delivered, ${t.sunk} sunk`,
    `  pickups: ${t.pickups.spawned} dropped, ${t.pickups.collected} taken, ${t.pickups.expired} expired, ${t.pickups.cleared} cleared with the wave, ${t.pickups.gone} unexplained`,
    `  taps: ${t.taps.fire} fire, ${t.taps.pickup} pickup, ${t.taps.dry} dry, ${t.taps.empty} empty; convoy commands ${t.commands}`,
    `  audits (things no hook told of): ${t.audits}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------

function baseline(): void {
  const write = flag('write');
  if (write) mkdirSync(DIR, { recursive: true });
  const manifestPath = `${DIR}/manifest.json`;
  const stored: BaselineResult[] = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')).results : [];
  const fresh: BaselineResult[] = [];
  let bad = 0;
  console.log(`Map & Convoy Lab baseline (log v${LOG_VERSION}): ${BASELINE.length} runs${write ? ', writing' : ''}\n`);
  console.log(`${pad('run', 28)} ${pad('end', 5)} ${lpad('wave', 4)} ${lpad('steps', 6)} ${lpad('deliv', 5)} ${lpad('lost', 4)} ${lpad('hull', 4)} ${lpad('hits', 4)} ${lpad('events', 6)}  check`);
  for (const r of BASELINE) {
    const path = `${DIR}/${r.id}.json`;
    let log: PlayLog;
    if (write) {
      log = playRecipe(r).log;
      writeFileSync(path, JSON.stringify(log));
    } else if (existsSync(path)) log = JSON.parse(readFileSync(path, 'utf8'));
    else {
      console.log(`${pad(r.id, 28)} no stored log: run with --write`);
      bad++;
      continue;
    }
    const { result, problems } = baselineResult(r.id, log);
    // The same log played side by side with telemetry on and off.
    const ls = lockstep(log);
    const was = stored.find((s) => s.id === r.id);
    const diff = was && !write ? baselineDiff(was, result) : [];
    const notes: string[] = [];
    if (ls.divergedAt >= 0) notes.push(`telemetry on/off diverge at step ${ls.divergedAt}`);
    if (!ls.rngSame) notes.push('telemetry on/off drew differently from the RNG');
    if (ls.stateHash !== result.stateHash) notes.push('side-by-side replay ended in a different state');
    if (problems.length) notes.push(...problems);
    if (!was && !write) notes.push('not in the manifest');
    if (diff.length) notes.push(...diff);
    if (notes.length) bad++;
    console.log(
      `${pad(r.id, 28)} ${pad(result.end ?? '-', 5)} ${lpad(result.wave, 4)} ${lpad(result.steps, 6)} ${lpad(result.delivered, 5)} ${lpad(result.lost, 4)} ${lpad(result.hpShip, 4)} ${lpad(result.hits, 4)} ${lpad(result.events, 6)}  ${notes.length ? 'DIFFERS' : `same (${ls.fullChecks} full-state checks)`}`,
    );
    for (const n of notes) console.log(`    ${n}`);
    fresh.push(result);
  }
  if (write) {
    writeFileSync(manifestPath, JSON.stringify({ about: 'Map & Convoy Lab baseline: what each stored log replays to. Made by `npm run v3:map-lab -- baseline --write`; checked by tests/v3/mapLabBaseline.test.ts.', logVersion: LOG_VERSION, results: fresh }, null, 1));
    console.log(`\nWrote ${fresh.length} logs and ${manifestPath}.`);
  }
  console.log(bad ? `\n${bad} run(s) differ from the baseline. If the sim was changed on purpose, write a new baseline (--write) and say so in the slice's log.` : '\nEvery baseline run replays exactly, with telemetry on and off.');
  if (bad && !write) process.exitCode = 1;
}

function telemetry(): void {
  const path = args.find((a, i) => i > 0 && !a.startsWith('--'));
  if (!path) throw new Error('usage: telemetry <log.json> [--out=sidecar.json]');
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const logs: PlayLog[] = Array.isArray(raw) ? raw : raw.logs ?? [raw];
  for (const log of logs) {
    if (log.game !== 'v3' || log.notesOnly || !log.commands?.length) continue;
    if (log.v !== LOG_VERSION) {
      console.log(`${log.id}: log v${log.v} is not this build's v${LOG_VERSION}; it replays only on the build that made it.`);
      continue;
    }
    const g = replay(log, { telemetry: true });
    const sc = g.tel!.sidecar(g);
    const stepsOk = !log.summary || (log.summary.steps === g.steps && log.summary.score === g.score && log.summary.lost === g.lost && log.summary.delivered === g.delivered);
    console.log(`${log.id} (${log.end ?? 'unfinished'}): replay ${stepsOk ? 'matches the log\'s summary' : `DOES NOT match its summary (steps ${g.steps}/${log.summary?.steps}, score ${g.score}/${log.summary?.score}, lost ${g.lost}/${log.summary?.lost})`}`);
    console.log(summary(sc));
    const problems = reconcile(sc, g);
    console.log(problems.length ? `  DOES NOT ADD UP:\n    ${problems.join('\n    ')}` : '  adds up to the game (hull points, sinkings, deliveries, kills, launches, pickups, taps)');
    const out = opt('out');
    if (out) {
      const text = JSON.stringify(sc);
      writeFileSync(logs.length > 1 ? out.replace(/(\.json)?$/, `-${log.id}.json`) : out, text);
      console.log(`  wrote ${out} (${(text.length / 1024).toFixed(0)} KiB, ${(gzipSync(text).length / 1024).toFixed(0)} KiB gzipped), digest ${sidecarDigest(sc)}`);
    }
    // --merge=file.json: add this replay's digest to a results file (the browser check's run.json).
    const merge = opt('merge');
    if (merge) {
      const into = { ...JSON.parse(readFileSync(merge, 'utf8')), digestNodeReplay: sidecarDigest(sc) };
      const to = opt('to') ?? merge;
      writeFileSync(to, `${JSON.stringify(into, null, 1)}\n`);
      console.log(`  wrote ${to}`);
    }
  }
}

/** Bot runs across the maps: everything the gate asks, on water the three
 *  reference maps don't have (locks, forks, tides, posts, the boss, the
 *  supertanker, night). */
function audit(): void {
  const seeds = Number(opt('seeds') ?? 2);
  const maps = (opt('maps')?.split(',') ?? MAP_ORDER) as MapId[];
  const personas = (opt('personas') ?? 'tryhard').split(',');
  let runs = 0;
  let bad = 0;
  const kinds: Record<string, number> = {};
  const by: Record<string, number> = {};
  let hits = 0;
  let noSrc = 0;
  console.log(`${pad('map', 12)} ${pad('bot', 8)} ${lpad('seed', 4)} ${lpad('wave', 4)} ${lpad('steps', 6)} ${lpad('events', 6)} ${lpad('hits', 4)} ${lpad('nosrc', 5)} ${lpad('audit', 5)}  check`);
  for (const map of maps)
    for (const persona of personas)
      for (let k = 0; k < seeds; k++) {
        const seed = 700 + k;
        // A late start now and then, so the events and the late enemies come.
        const firstWave = k % 3 === 1 ? 11 : k % 3 === 2 ? 6 : 1;
        const { game, log } = playMimic(map, seed, { persona: PERSONAS[persona], armory: { warhead: 3 }, firstWave });
        const ls = lockstep(log, 600);
        const problems = reconcile(ls.sidecar, ls.game);
        const notes: string[] = [];
        if (ls.divergedAt >= 0) notes.push(`on/off diverge at step ${ls.divergedAt}`);
        if (!ls.rngSame) notes.push('RNG drawn differently');
        if (ls.stateHash !== stateHash(game)) notes.push('replay ends in a different state than the live run');
        notes.push(...problems);
        runs++;
        if (notes.length) bad++;
        const n = ls.sidecar.events.filter((e) => e.k === 'hit' && e.src === undefined).length;
        for (const e of ls.sidecar.events) {
          kinds[e.k] = (kinds[e.k] ?? 0) + 1;
          if (e.k === 'hit') {
            hits++;
            by[e.by] = (by[e.by] ?? 0) + 1;
          }
        }
        noSrc += n;
        console.log(`${pad(map, 12)} ${pad(persona, 8)} ${lpad(seed, 4)} ${lpad(`${firstWave}-${game.wave}`, 4)} ${lpad(game.steps, 6)} ${lpad(ls.sidecar.events.length, 6)} ${lpad(ls.sidecar.totals.hits, 4)} ${lpad(n, 5)} ${lpad(ls.sidecar.totals.audits, 5)}  ${notes.length ? 'FAIL' : 'ok'}`);
        for (const note of notes) console.log(`    ${note}`);
      }
  console.log(`\n${runs} runs, ${bad} with a problem. Hull hits ${hits}, with no attacker named ${noSrc}.`);
  saveJson({ seeds, maps: maps.length, personas, runs, bad, hits, noSrc, events: Object.values(kinds).reduce((a, b) => a + b, 0), byThreat: by, byKind: kinds });
  console.log(`hits by threat: ${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`events by kind: ${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  if (bad) process.exitCode = 1;
}

/** Ship-seconds by 50 x 50 cell from position samples every `every` steps
 *  (joined by straight lines) against every step's true positions. */
function exposureError(log: PlayLog, every: number): { cells: number; total: number; worst: number; mean: number; l1: number } {
  const W = 32;
  const H = 18;
  const cell = VIEW.width / W;
  const truth = new Float64Array(W * H);
  const est = new Float64Array(W * H);
  const add = (grid: Float64Array, x: number, y: number, w: number) => {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return;
    grid[cy * W + cx] += w;
  };
  const pb = new Playback(log, 0);
  const last = new Map<number, { x: number; y: number; step: number }>();
  for (let n = 0; n < 10_000_000; n++) {
    const more = pb.advance();
    const g = pb.game;
    if (g.phase === 'wave') for (const s of g.ships) add(truth, s.x, s.y, 1 / 60);
    if (g.steps % every === 0 || !more) {
      const seen = new Set<number>();
      for (const s of g.ships) {
        seen.add(s.id);
        const was = last.get(s.id);
        if (was) {
          // The stretch since the last sample, a step at a time along the line.
          const k = g.steps - was.step;
          for (let i = 1; i <= k; i++) add(est, was.x + ((s.x - was.x) * i) / k, was.y + ((s.y - was.y) * i) / k, 1 / 60);
        }
        last.set(s.id, { x: Math.round(s.x * 10) / 10, y: Math.round(s.y * 10) / 10, step: g.steps });
      }
      for (const id of [...last.keys()]) if (!seen.has(id)) last.delete(id);
    }
    if (!more) break;
  }
  let cells = 0;
  let total = 0;
  let worst = 0;
  let sum = 0;
  let l1 = 0;
  for (let i = 0; i < truth.length; i++) {
    total += truth[i];
    l1 += Math.abs(truth[i] - est[i]);
    // Cells with real traffic (10 ship-seconds or more): thin ones are masked in a heatmap anyway.
    if (truth[i] < 10) continue;
    cells++;
    const err = Math.abs(est[i] - truth[i]) / truth[i];
    worst = Math.max(worst, err);
    sum += err;
  }
  return { cells, total, worst, mean: cells ? sum / cells : 0, l1: total ? l1 / total : 0 };
}

function bench(): void {
  const time = (f: () => void, n: number) => {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) f();
    return (performance.now() - t0) / n;
  };
  console.log('What telemetry costs (Node, this machine). Replay of each stored baseline log, best of 5.\n');
  console.log(`${pad('run', 28)} ${lpad('steps', 6)} ${lpad('off ms', 7)} ${lpad('on ms', 7)} ${lpad('+%', 5)} ${lpad('us/step', 8)} ${lpad('events', 6)} ${lpad('samples', 7)} ${lpad('KiB', 6)} ${lpad('gz KiB', 6)} ${lpad('B/s play', 8)}`);
  let off = 0;
  let on = 0;
  let bytes = 0;
  let gz = 0;
  let secs = 0;
  const rows: Record<string, number | string>[] = [];
  const sampling: Record<string, number | string>[] = [];
  for (const r of BASELINE) {
    const path = `${DIR}/${r.id}.json`;
    if (!existsSync(path)) continue;
    const log: PlayLog = JSON.parse(readFileSync(path, 'utf8'));
    const best = (f: () => void) => Math.min(...Array.from({ length: 5 }, () => time(f, 1)));
    replay(log);
    const a = best(() => replay(log));
    const b = best(() => replay(log, { telemetry: true }));
    const g = replay(log, { telemetry: true });
    const sc = g.tel!.sidecar(g);
    const text = JSON.stringify(sc);
    const z = gzipSync(text).length;
    off += a;
    on += b;
    bytes += text.length;
    gz += z;
    secs += g.realT;
    rows.push({ id: r.id, steps: g.steps, offMs: Math.round(a), onMs: Math.round(b), events: sc.events.length, samples: sc.samples.length, bytes: text.length, gz: z, seconds: Math.round(g.realT) });
    console.log(
      `${pad(r.id, 28)} ${lpad(g.steps, 6)} ${lpad(a.toFixed(0), 7)} ${lpad(b.toFixed(0), 7)} ${lpad((((b - a) / a) * 100).toFixed(0), 5)} ${lpad((((b - a) * 1000) / g.steps).toFixed(2), 8)} ${lpad(sc.events.length, 6)} ${lpad(sc.samples.length, 7)} ${lpad((text.length / 1024).toFixed(0), 6)} ${lpad((z / 1024).toFixed(0), 6)} ${lpad((text.length / g.realT).toFixed(0), 8)}`,
    );
  }
  console.log(`\nAll runs: telemetry adds ${(((on - off) / off) * 100).toFixed(0)}% to a headless replay; ${(bytes / secs).toFixed(0)} bytes of JSON per second of play (${(gz / secs).toFixed(0)} gzipped).`);

  console.log(`\nShip sampling: ship-seconds by 50 x 50 cell from samples joined by straight lines, against every step's true positions.`);
  console.log(`(Cells with 10 ship-seconds or more. Now: every ${TEL_SAMPLING.ship} steps = ${60 / TEL_SAMPLING.ship} Hz.)\n`);
  console.log(`${pad('run', 28)} ${lpad('Hz', 4)} ${lpad('cells', 5)} ${lpad('ship-s', 7)} ${lpad('worst cell', 10)} ${lpad('mean cell', 9)} ${lpad('misplaced', 9)}`);
  for (const id of ['strait-campaign-tryhard', 'harbor-campaign-tryhard', 'gauntlet-campaign-tryhard']) {
    const path = `${DIR}/${id}.json`;
    if (!existsSync(path)) continue;
    const log: PlayLog = JSON.parse(readFileSync(path, 'utf8'));
    for (const every of [6, 15, 30, 60, 120]) {
      const e = exposureError(log, every);
      sampling.push({ run: id, hz: 60 / every, cells: e.cells, shipSeconds: Math.round(e.total), worst: e.worst, mean: e.mean, misplaced: e.l1 });
      console.log(`${pad(id, 28)} ${lpad(60 / every, 4)} ${lpad(e.cells, 5)} ${lpad(e.total.toFixed(0), 7)} ${lpad(`${(e.worst * 100).toFixed(1)}%`, 10)} ${lpad(`${(e.mean * 100).toFixed(2)}%`, 9)} ${lpad(`${(e.l1 * 100).toFixed(2)}%`, 9)}`);
    }
  }
  // A map whose lanes bend (the Kesh Hook), played fresh.
  const kesh = playMimic('kesh', 101, { persona: PERSONAS.tryhard, armory: { warhead: 3 } }).log;
  for (const every of [6, 15, 30, 60, 120]) {
    const e = exposureError(kesh, every);
    sampling.push({ run: 'kesh (a bend)', hz: 60 / every, cells: e.cells, shipSeconds: Math.round(e.total), worst: e.worst, mean: e.mean, misplaced: e.l1 });
    console.log(`${pad('kesh (a bend), seed 101', 28)} ${lpad(60 / every, 4)} ${lpad(e.cells, 5)} ${lpad(e.total.toFixed(0), 7)} ${lpad(`${(e.worst * 100).toFixed(1)}%`, 10)} ${lpad(`${(e.mean * 100).toFixed(2)}%`, 9)} ${lpad(`${(e.l1 * 100).toFixed(2)}%`, 9)}`);
  }
  saveJson({ runs: rows, addPct: ((on - off) / off) * 100, bytesPerSecond: bytes / secs, gzPerSecond: gz / secs, samplingHz: 60 / TEL_SAMPLING.ship, sampling });
}

/** What the baseline's telemetry says, map by map (the numbers behind the
 *  review page's first maps). */
function preview(): void {
  for (const p of buildPreview()) {
    console.log(`\n${p.name} (${p.runs.length} bot runs)`);
    for (const s of SCOPES) {
      const d = p.scopes[s.id];
      const per = (hp: number, min: number) => (min > 0.5 ? (hp / min).toFixed(2) : '-');
      console.log(`  ${s.name}: ${(d.seconds / 60).toFixed(1)} min of play, ${d.shipMinutes.toFixed(0)} ship-minutes, ${d.launches} launches, ${d.hits} hits (${d.blocked} blocked), ${d.hpShip} ship + ${d.hpCarrier} carrier hull points, ${d.sunk} sunk of ${d.sailed} sailed, ${d.delivered} delivered`);
      console.log(`    hull points per ship-minute: ${per(d.hpShip, d.shipMinutes)}; by third of the board (left, middle, right): ${d.thirds.map((t) => `${per(t.hp, t.shipMinutes)} (${t.hp} in ${t.shipMinutes.toFixed(0)} min, ${t.sunk} sunk)`).join(' | ')}`);
      console.log(`    by attacker: ${d.byKind.slice(0, 6).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      console.log(`    by launch platform: ${PLATFORMS.map((pl) => `${pl.name} ${d.byPlatform[pl.id].launches} launches -> ${d.byPlatform[pl.id].hp} hull points`).join('; ')}`);
      console.log(`    pickups: ${d.pickups.dropped} dropped, ${d.pickups.taken} taken, ${d.pickups.expired} expired, ${d.pickups.cleared} cleared; taps: ${d.taps.fire} fire, ${d.taps.dry} dry, ${d.taps.pickup} pickup, ${d.taps.empty} empty`);
    }
  }
}

/** The convoy experiment: the same maps, seeds, bots and Armory under each
 *  policy. Two tables a map, never mixed: a fixed schedule (equal ships
 *  asked of every policy, no run ended by ships lost) and each policy under
 *  its own rules. Every row says what it is out of. */
function experiment(): void {
  const maps = (opt('maps')?.split(',') ?? REFERENCE_MAPS) as MapId[];
  const seeds = Array.from({ length: Number(opt('seeds') ?? 8) }, (_, k) => 500 + k);
  const personas = (opt('personas') ?? 'you,tryhard').split(',');
  const kit = (p: string) => (p === 'you' ? {} : { warhead: 3 });
  const enc = flag('encounters');
  const out: Record<string, unknown>[] = [];
  const num = (c: Cohort, k: string, d = 0) => c.m[k].mean.toFixed(d);
  const range = (c: Cohort, k: string, d = 0) => `${c.m[k].mean.toFixed(d)} (${c.m[k].min.toFixed(d)}-${c.m[k].max.toFixed(d)})`;
  for (const map of maps)
    for (const persona of personas) {
      const mk = (name: string, o: Partial<TrialSpec>): Cohort => cohort(name, seeds.map((seed) => runTrial({ map, seed, policy: 'auto', obligation: 'fixed', pilot: 'never', persona, armory: kit(persona), ...(enc ? { encounters: { rev: ENCOUNTER_REV } } : {}), ...o })));
      const blocks: [string, Cohort[]][] = [
        [
          `fixed schedule (the map's flow, step ${mapConvoy(map).flow}; no run ends on ships lost)`,
          [
            mk('A automatic', { policy: 'auto' }),
            mk('B formations', { policy: 'formation' }),
            mk('D tactical, never used', { policy: 'tactical', pilot: 'never' }),
            mk('D tactical, sharp', { policy: 'tactical', pilot: 'sharp' }),
            mk('D tactical, random', { policy: 'tactical', pilot: 'random' }),
            mk('D tactical, spam', { policy: 'tactical', pilot: 'spam' }),
          ],
        ],
        ['fixed schedule at the fastest flow (step 4)', [mk('A automatic', { policy: 'auto', flow: 4 }), mk('B formations', { policy: 'formation', flow: 4 }), mk('D tactical, sharp', { policy: 'tactical', pilot: 'sharp', flow: 4 })]],
        [
          'each policy under its own rules (the game\'s loss limit; C keeps its flow slider and its score)',
          [mk('A automatic', { policy: 'auto', obligation: 'natural' }), mk('B formations', { policy: 'formation', obligation: 'natural' }), mk('C current controls', { policy: 'current', obligation: 'natural' }), mk('D tactical, sharp', { policy: 'tactical', pilot: 'sharp', obligation: 'natural' })],
        ],
      ];
      console.log(`\n${map} · bot ${persona} · Armory ${persona === 'you' ? 'base gun' : 'Wide Warhead 3'} · ${seeds.length} seeds${enc ? ` · encounters rev ${ENCOUNTER_REV}` : ''}`);
      for (const [title, cohorts] of blocks) {
        console.log(`  ${title}`);
        console.log(`    ${pad('policy', 24)} ${lpad('wave', 5)} ${lpad('done', 4)} ${lpad("groups", 6)} ${lpad('sailed', 6)} ${lpad('deliv', 6)} ${lpad('sunk', 12)} ${lpad('hull lost', 14)} ${lpad('carrier', 7)} ${lpad('ship-min', 8)} ${lpad('hull/ship-min', 18)} ${lpad('score', 7)} ${lpad('cmds', 5)}  vs A: hull, sunk (seeds lower)`);
        const a = cohorts[0];
        for (const c of cohorts) {
          const bad = c.trials.filter((t) => t.problems.length).length;
          const dh = paired(a, c, (t) => t.hpShip);
          const ds = paired(a, c, (t) => t.sunk);
          console.log(
            `    ${pad(c.name, 24)} ${lpad(num(c, 'wave', 1), 5)} ${lpad(`${c.finished}/${c.n}`, 4)} ${lpad(num(c, 'scheduled'), 6)} ${lpad(num(c, 'sailed'), 6)} ${lpad(num(c, 'delivered'), 6)} ${lpad(range(c, 'sunk', 1), 12)} ${lpad(range(c, 'hpShip'), 14)} ${lpad(num(c, 'hpCarrier', 1), 7)} ${lpad(num(c, 'shipMinutes'), 8)} ${lpad(range(c, 'risk', 2), 18)} ${lpad(num(c, 'score'), 7)} ${lpad(num(c, 'commands', 1), 5)}  ${c === a ? '-' : `${dh.mean >= 0 ? '+' : ''}${dh.mean.toFixed(1)} (${dh.lower}/${dh.n}), ${ds.mean >= 0 ? '+' : ''}${ds.mean.toFixed(1)} (${ds.lower}/${ds.n})`}${bad ? `  ${bad} DO NOT ADD UP` : ''}`,
          );
          out.push({ map, persona, block: title, policy: c.name, n: c.n, finished: c.finished, m: c.m, vsA: c === a ? null : { hull: dh, sunk: ds, delivered: paired(a, c, (t) => t.delivered), score: paired(a, c, (t) => t.score) }, problems: bad });
        }
      }
    }
  saveJson({ seeds: seeds.length, convoyRev: CONVOY_REV, encounters: enc ? ENCOUNTER_REV : null, rows: out });
}

if (cmd === 'baseline') baseline();
else if (cmd === 'experiment') experiment();
else if (cmd === 'preview') preview();
else if (cmd === 'telemetry') telemetry();
else if (cmd === 'audit') audit();
else if (cmd === 'bench') bench();
else console.log('usage: v3:map-lab -- baseline [--write] | telemetry <log.json> [--out=file] | audit [--seeds=N] [--maps=a,b] [--personas=a,b] | bench');
