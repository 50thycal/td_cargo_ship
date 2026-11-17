// The encounter versions measured with the bots (Test Lab round 12, docs/
// design/v3-round12-encounter-versions.md): each reference map's versions
// (v1, v2, v3) played on their own Test Lab card's production setup (the
// plan the hub starts: the full map from wave 1, policy D, the encounters
// on), by the bot personas, on the same seeds, with telemetry.
//
//   npx vite-node tools/v3/map-lab/versions.ts -- [--seeds=24] [--maps=strait,harbor]
//       [--versions=v1,v2] [--personas=you,tryhard,casual] [--json=out.json]
//       [--kits=harbor [--kits-only] [--kit-bots=you,tryhard]] [--armory=player]
//   npx vite-node tools/v3/map-lab/versions.ts -- --merge=a.json,b.json --json=out.json
//
// Per map, version and bot: won %, ships lost (waves 1-10 and the boss
// rounds), the wave of the first loss, hull hits from encounter launches
// against the rest (waves 1-10), the most threats on screen at once, the
// carrier's hull lost, dry taps, and ships lost per wave (the difficulty
// curve, to see a cliff), and with the run kept going, ships lost in each
// boss round. --kits: a map's versions with the two kits the player brought
// (KITS). Pure numbers; the doc's tables are printed from the JSON.

import { readFileSync, writeFileSync } from 'node:fs';
import { loadout, type AbilityId } from '../../../src/v3/data/abilities';
import { ENCOUNTER_VERSIONS, type EncounterVersion } from '../../../src/v3/data/encounters';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import { VIEW } from '../../../src/v3/data/config';
import type { MapId } from '../../../src/v3/data/maps';
import { REFERENCE_MAPS } from '../../../src/v3/sim/mapLab';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import { PLAYER_ARMORY } from '../bot-fit/measure';
import { LOG_VERSION, logTelemetry } from '../../../src/v3/sim/playlog';
import type { TelEvent } from '../../../src/v3/sim/telemetry';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');

/** One bot run's numbers. */
export interface VersionRun {
  seed: number;
  won: boolean;
  wave: number;
  /** Ships lost: in all, in waves 1-10, and per wave (index 0 = wave 1, up
   *  to the last boss round). */
  lost: number;
  lost10: number;
  perWave: number[];
  firstLoss: number | null;
  /** Hull hits on ships and the carrier in waves 1-10: from an authored
   *  encounter's launches (and what they fired), and all. */
  hitsEnc: number;
  hits10: number;
  /** Hull points lost to them (ships and carrier). */
  hpEnc: number;
  hp10: number;
  /** Most live threats on screen at once, waves 1-10 and per wave. */
  maxOn: number;
  maxOnWave: number[];
  carrierLost: number;
  dry: number;
  /** Hull points lost by wave (1-13) and what did it ("drone", "torpedo*"
   *  with a star when an encounter sent it). */
  byKind: Record<string, number>[];
  /** The weapons it held as wave 8 began (with their levels). */
  held: Record<string, number>;
}

// Map testing plays the baseline: "you" with no Armory upgrades (a new
// player's gun). --armory=player gives it the player's own upgrades
// instead (PLAYER_ARMORY, the setup the bot was calibrated on), to read a
// map as the player will meet it.
const PERSONA_KIT: Record<string, Record<string, number>> = {
  you: process.argv.includes('--armory=player') ? PLAYER_ARMORY : {},
  casual: {},
  tryhard: { warhead: 3 },
};

/** The two kits the player brought to Harbor Mouth in round 11: weapons you
 *  aim (Overdrive, Railgun) and weapons that fire themselves (Airstrike,
 *  Seeker, Drone Screen). The bot takes these first when a draft offers
 *  them (it stacks what it holds), so a run's kit is mostly, not always,
 *  this one: `held` says what it had by wave 8. */
export const KITS: Record<string, AbilityId[]> = {
  aimed: ['overdrive', 'railgun', 'focus'],
  self: ['airstrike', 'seeker', 'droneScreen'],
};

/** `tough`: the curve's runs. The run can't be lost (no loss limit, a
 *  carrier that can't sink), so every seed plays every wave, the three boss
 *  rounds too, and ships lost per wave is measured on all of them. `kit`:
 *  the bot's taste in weapons (KITS) in place of its own. */
export function playVersion(map: MapId, version: EncounterVersion, persona: string, seed: number, tough = false, kit?: string): VersionRun {
  const card = labCard(mapCardId(map, version))!;
  const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
  const run = new BotRun(map, seed, {
    persona: kit ? { ...PERSONAS[persona], taste: KITS[kit] } : PERSONAS[persona],
    armory: PERSONA_KIT[persona] ?? {},
    lab: plan.lab,
    ...(plan.convoy ? { convoy: plan.convoy } : {}),
    ...(plan.encounters ? { encounters: plan.encounters } : {}),
  });
  const g = run.game;
  if (tough) {
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = g.stats.carrierHp = 1e6;
  }
  logTelemetry(g, { id: `ver-${map}-${version}-${persona}-${seed}`, build: 'sim', v: LOG_VERSION, firstWave: 1, device: { w: 0, h: 0, dpr: 1, touch: true, ua: 'versions' } }, 'sim', 'none');
  const perWave: number[] = [];
  const maxOnWave: number[] = [];
  let lostSeen = 0;
  let firstLoss: number | null = null;
  let carrierHp = g.carrierHp;
  let carrierLost = 0;
  let held: Record<string, number> | null = null;
  const on = (x: number, y: number) => x >= 0 && x <= VIEW.width && y >= 0 && y <= VIEW.height;
  while (!run.done) {
    run.advance(6);
    const w = Math.max(1, g.wave);
    if (!held && g.wave >= 8) held = Object.fromEntries(loadout(g.levels).map((id) => [id, g.levels[id] ?? 0]));
    if (g.lost > lostSeen) {
      perWave[w - 1] = (perWave[w - 1] ?? 0) + (g.lost - lostSeen);
      if (firstLoss === null) firstLoss = w;
      lostSeen = g.lost;
    }
    if (g.carrierHp < carrierHp) carrierLost += carrierHp - g.carrierHp;
    carrierHp = g.carrierHp;
    if (g.phase === 'wave') {
      const n = g.threats.filter((t) => !t.dead && on(t.x, t.y)).length;
      maxOnWave[w - 1] = Math.max(maxOnWave[w - 1] ?? 0, n);
    }
  }
  const sc = g.tel!.sidecar(g);
  // Which threats an encounter sent: tagged at launch, and whatever they
  // launched or split into (a sub's torpedoes, a Hydra's darts).
  const encOf = new Map<number, string>();
  for (const e of sc.events) {
    if (e.k !== 'thr+') continue;
    const tag = e.enc ?? (e.pid !== undefined ? encOf.get(e.pid) : undefined) ?? (e.from !== undefined ? encOf.get(e.from) : undefined);
    if (tag) encOf.set(e.id, tag);
  }
  const waveOf = (p: number) => sc.phases[p]?.wave ?? 0;
  let hitsEnc = 0;
  let hits10 = 0;
  let hpEnc = 0;
  let hp10 = 0;
  const byKind: Record<string, number>[] = [];
  for (const e of sc.events as TelEvent[]) {
    if (e.k !== 'hit' || e.blk || (e.vt !== 's' && e.vt !== 'c')) continue;
    const w = waveOf(e.p);
    const key = `${e.by}${e.src !== undefined && encOf.has(e.src) ? '*' : ''}`;
    byKind[w - 1] = byKind[w - 1] ?? {};
    byKind[w - 1][key] = (byKind[w - 1][key] ?? 0) + e.hp;
    if (w > 10) continue;
    hits10++;
    hp10 += e.hp;
    if (e.src !== undefined && encOf.has(e.src)) {
      hitsEnc++;
      hpEnc += e.hp;
    }
  }
  const lost10 = perWave.slice(0, 10).reduce((a, b) => a + (b ?? 0), 0);
  return {
    seed,
    won: g.phase === 'won',
    wave: g.wave,
    lost: g.lost,
    lost10,
    perWave: Array.from({ length: Math.max(perWave.length, g.wave) }, (_, k) => perWave[k] ?? 0),
    firstLoss,
    hitsEnc,
    hits10,
    hpEnc,
    hp10,
    maxOn: Math.max(0, ...maxOnWave.slice(0, 10).map((v) => v ?? 0)),
    maxOnWave: Array.from({ length: maxOnWave.length }, (_, k) => maxOnWave[k] ?? 0),
    carrierLost,
    dry: sc.totals.taps.dry,
    byKind: Array.from({ length: byKind.length }, (_, k) => byKind[k] ?? {}),
    held: held ?? {},
  };
}

/** The difficulty curve (tough runs): mean ships lost on each of waves
 *  1-10 over every seed, and the biggest one-wave step up. */
export interface CurveRow {
  map: MapId;
  version: EncounterVersion;
  persona: string;
  n: number;
  lost: number[];
  step: { wave: number; up: number };
  peak: { wave: number; lost: number };
  total: number;
  /** Mean ships lost in each boss round (waves 11-13), every seed. */
  boss: number[];
}

export function curveRow(map: MapId, version: EncounterVersion, persona: string, runs: VersionRun[]): CurveRow {
  const lost = Array.from({ length: 10 }, (_, k) => mean(runs.map((r) => r.perWave[k] ?? 0)));
  let step = { wave: 2, up: -Infinity };
  let peak = { wave: 1, lost: -Infinity };
  lost.forEach((v, k) => {
    if (v > peak.lost) peak = { wave: k + 1, lost: v };
    if (k > 0 && v - lost[k - 1] > step.up) step = { wave: k + 1, up: v - lost[k - 1] };
  });
  const boss = [10, 11, 12].map((k) => mean(runs.map((r) => r.perWave[k] ?? 0)));
  return { map, version, persona, n: runs.length, lost, step, peak, total: lost.reduce((a, b) => a + b, 0), boss };
}

export interface VersionRow {
  map: MapId;
  version: EncounterVersion;
  persona: string;
  n: number;
  won: number;
  /** Means over the seeds. */
  lost: number;
  lost10: number;
  firstLoss: number | null;
  noLoss: number;
  hitsEnc: number;
  hits10: number;
  encShare: number;
  maxOn: number;
  carrierLost: number;
  dry: number;
  /** Mean ships lost on each wave (waves 1 to 13), over every run (a run
   *  that ended earlier counts 0 for the waves it never reached), and the
   *  share of runs that reached it. */
  perWave: number[];
  reached: number[];
  /** Mean ships lost on each wave over the runs that played it (the
   *  difficulty curve: a run that ended before a wave says nothing of it). */
  curve: number[];
  /** The mean wave a run ended on (won: 14, past the last boss round). */
  endWave: number;
  /** The worst wave of 1-10 on the curve, and its step up from the wave
   *  before it; the biggest step up anywhere in waves 2-10 (a cliff). */
  peak: { wave: number; lost: number };
  step: { wave: number; up: number };
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function summarise(map: MapId, version: EncounterVersion, persona: string, runs: VersionRun[]): VersionRow {
  const W = 13;
  const perWave = Array.from({ length: W }, (_, k) => mean(runs.map((r) => r.perWave[k] ?? 0)));
  const reached = Array.from({ length: W }, (_, k) => runs.filter((r) => r.wave >= k + 1).length / runs.length);
  // Over the runs that played the wave (a run that ended on it counts it).
  const curve = Array.from({ length: W }, (_, k) => {
    const played = runs.filter((r) => r.wave >= k + 1);
    return played.length >= Math.max(3, runs.length / 2) ? mean(played.map((r) => r.perWave[k] ?? 0)) : NaN;
  });
  let peak = { wave: 1, lost: 0 };
  let step = { wave: 2, up: -Infinity };
  for (let k = 0; k < 10; k++) {
    if (!(curve[k] <= peak.lost) && Number.isFinite(curve[k])) peak = { wave: k + 1, lost: curve[k] };
    if (k > 0 && Number.isFinite(curve[k]) && Number.isFinite(curve[k - 1]) && curve[k] - curve[k - 1] > step.up) step = { wave: k + 1, up: curve[k] - curve[k - 1] };
  }
  const losses = runs.filter((r) => r.firstLoss !== null).map((r) => r.firstLoss!);
  const hitsEnc = mean(runs.map((r) => r.hitsEnc));
  const hits10 = mean(runs.map((r) => r.hits10));
  return {
    map,
    version,
    persona,
    n: runs.length,
    won: runs.filter((r) => r.won).length / runs.length,
    lost: mean(runs.map((r) => r.lost)),
    lost10: mean(runs.map((r) => r.lost10)),
    firstLoss: losses.length ? mean(losses) : null,
    noLoss: runs.length - losses.length,
    hitsEnc,
    hits10,
    encShare: hits10 ? hitsEnc / hits10 : 0,
    maxOn: mean(runs.map((r) => r.maxOn)),
    carrierLost: mean(runs.map((r) => r.carrierLost)),
    dry: mean(runs.map((r) => r.dry)),
    perWave,
    reached,
    curve,
    endWave: mean(runs.map((r) => (r.won ? 14 : r.wave))),
    peak,
    step,
  };
}

/** A kit's runs on a map's version (round 12's fixes: Harbor Mouth's wave 8
 *  against the two kits the player brought). `ended8`: the share of the
 *  runs that reached wave 8 and were lost on it; `curve`: ships lost per
 *  wave 1-10 with the run kept going (every seed). */
export interface KitRow {
  map: MapId;
  version: EncounterVersion;
  persona: string;
  kit: string;
  n: number;
  endWave: number;
  reached8: number;
  ended8: number;
  lost8: number;
  curve: number[];
  /** Mean of the kit's weapons held as wave 8 began (0 to 3), and the
   *  weapons held most often. */
  kitHeld: number;
  held: Record<string, number>;
}

export function kitRow(map: MapId, version: EncounterVersion, persona: string, kit: string, seeds: number[]): KitRow {
  const runs = seeds.map((seed) => playVersion(map, version, persona, seed, false, kit));
  const tough = seeds.map((seed) => playVersion(map, version, persona, seed, true, kit));
  const at8 = runs.filter((r) => r.wave >= 8);
  const held: Record<string, number> = {};
  for (const r of runs) for (const id of Object.keys(r.held)) held[id] = (held[id] ?? 0) + 1 / runs.length;
  return {
    map,
    version,
    persona,
    kit,
    n: runs.length,
    endWave: mean(runs.map((r) => (r.won ? 14 : r.wave))),
    reached8: at8.length / runs.length,
    ended8: at8.length ? at8.filter((r) => !r.won && r.wave === 8).length / at8.length : 0,
    lost8: mean(at8.map((r) => r.perWave[7] ?? 0)),
    curve: Array.from({ length: 10 }, (_, k) => mean(tough.map((r) => r.perWave[k] ?? 0))),
    kitHeld: mean(runs.filter((r) => r.wave >= 8).map((r) => Object.keys(r.held).filter((id) => KITS[kit].includes(id as AbilityId)).length)),
    held,
  };
}

/** --merge=a.json,b.json --json=out.json: one results file from runs made
 *  side by side (a map each, on the same seeds), rows in the order given. */
function merge(files: string[], out: string): void {
  const parts = files.map((f) => JSON.parse(readFileSync(f, 'utf8')));
  const all = { ...parts[0], rows: parts.flatMap((p) => p.rows ?? []), curves: parts.flatMap((p) => p.curves ?? []), kitRows: parts.flatMap((p) => p.kitRows ?? []) };
  for (const p of parts) if (JSON.stringify(p.seeds) !== JSON.stringify(all.seeds)) throw new Error('merge: the files were made on different seeds');
  writeFileSync(out, `${JSON.stringify(all, null, 1)}\n`);
  console.log(`merged ${files.length} files into ${out}`);
}

function main(): void {
  if (opt('merge')) return merge(opt('merge')!.split(','), opt('json')!);
  const seeds = Array.from({ length: Number(opt('seeds') ?? 24) }, (_, k) => 900 + k);
  const maps = (opt('maps')?.split(',') ?? REFERENCE_MAPS) as MapId[];
  const versions = (opt('versions')?.split(',') ?? ENCOUNTER_VERSIONS) as EncounterVersion[];
  const personas = (opt('personas') ?? 'you,tryhard,casual').split(',');
  const rows: VersionRow[] = [];
  const curves: CurveRow[] = [];
  const doCurve = !args.includes('--no-curve');
  const f = (v: number, d = 1) => v.toFixed(d);
  console.log(`Encounter versions on each card's production setup: ${seeds.length} seeds a row (${seeds[0]}-${seeds[seeds.length - 1]}).\n`);
  console.log(`${'map'.padEnd(9)} ver ${'bot'.padEnd(8)} ${'won'.padStart(4)} ${'end'.padStart(5)} ${'lost'.padStart(5)} ${'1-10'.padStart(5)} ${'1st'.padStart(4)} ${'enc/hits'.padStart(10)} ${'max'.padStart(4)} ${'carr'.padStart(4)} ${'dry'.padStart(4)}  ships lost per wave played 1..10 | boss 11-13 (peak; biggest step)`);
  for (const map of args.includes('--kits-only') ? [] : maps)
    for (const version of versions)
      for (const persona of personas) {
        const runs = seeds.map((seed) => playVersion(map, version, persona, seed));
        const r = summarise(map, version, persona, runs);
        rows.push(r);
        if (doCurve) curves.push(curveRow(map, version, persona, seeds.map((seed) => playVersion(map, version, persona, seed, true))));
        // --diag=5: what did the hull damage on that wave, over the runs.
        const diag = Number(opt('diag') ?? 0);
        if (diag) {
          const tot: Record<string, number> = {};
          for (const run of runs) for (const [k, v] of Object.entries(run.byKind[diag - 1] ?? {})) tot[k] = (tot[k] ?? 0) + v / runs.length;
          console.log(`    wave ${diag} hull points a run by: ${Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}`);
        }
        console.log(
          `${map.padEnd(9)} ${version}  ${persona.padEnd(8)} ${`${Math.round(r.won * 100)}%`.padStart(4)} ${f(r.endWave).padStart(5)} ${f(r.lost).padStart(5)} ${f(r.lost10).padStart(5)} ${(r.firstLoss === null ? '-' : f(r.firstLoss)).padStart(4)} ${`${f(r.hitsEnc, 0)}/${f(r.hits10, 0)}`.padStart(10)} ${f(r.maxOn, 0).padStart(4)} ${f(r.carrierLost, 1).padStart(4)} ${f(r.dry, 0).padStart(4)}  ${r.curve.slice(0, 10).map((v) => (Number.isFinite(v) ? f(v, 2) : ' -  ')).join(' ')} | ${r.curve.slice(10).map((v) => (Number.isFinite(v) ? f(v, 2) : ' -  ')).join(' ')} (w${r.peak.wave} ${f(r.peak.lost, 2)}; w${r.step.wave} +${f(r.step.up, 2)})`,
        );
      }
  if (doCurve) {
    console.log(`\nThe difficulty curve: the same seeds with the run kept going (no loss limit, the carrier can't sink), so every seed plays waves 1-10.`);
    console.log(`${'map'.padEnd(9)} ver ${'bot'.padEnd(8)} ${'1-10'.padStart(5)}  ships lost per wave 1..10 (peak; biggest step up)`);
    for (const c of curves)
      console.log(`${c.map.padEnd(9)} ${c.version}  ${c.persona.padEnd(8)} ${f(c.total).padStart(5)}  ${c.lost.map((v) => f(v, 2)).join(' ')} (w${c.peak.wave} ${f(c.peak.lost, 2)}; w${c.step.wave} +${f(c.step.up, 2)}) | boss ${c.boss.map((v) => f(v, 2)).join(' ')} = ${f(c.boss.reduce((a, b) => a + b, 0), 2)}`);
  }
  // --kits=harbor: that map's versions with each kit (KITS), by the bots
  // in --kit-bots (you and tryhard).
  const kits: KitRow[] = [];
  for (const map of (opt('kits')?.split(',') ?? []) as MapId[]) {
    console.log(`\nKits on ${map}: wave reached, the share of runs at wave 8 lost on it, ships lost on wave 8 (runs that played it); the curve (every seed).`);
    for (const version of versions)
      for (const bot of (opt('kit-bots') ?? 'you,tryhard').split(','))
        for (const kit of Object.keys(KITS)) {
          const k = kitRow(map, version, bot, kit, seeds);
          kits.push(k);
          console.log(`${map.padEnd(9)} ${version}  ${bot.padEnd(8)} ${kit.padEnd(6)} end ${f(k.endWave)}  reached 8 ${Math.round(k.reached8 * 100)}%  ended on 8 ${Math.round(k.ended8 * 100)}%  lost on 8 ${f(k.lost8, 2)}  kit held ${f(k.kitHeld, 1)}/3  curve ${k.curve.map((v) => f(v, 2)).join(' ')}`);
        }
  }
  const out = opt('json');
  if (out) {
    writeFileSync(out, `${JSON.stringify({ about: 'Test Lab round 12: the reference maps\' encounter versions on their cards\' production setups, by bot. Made by `npx vite-node tools/v3/map-lab/versions.ts`.', seeds, personas, kit: PERSONA_KIT, kits: KITS, rows, curves, kitRows: kits }, null, 1)}\n`);
    console.log(`wrote ${out}`);
  }
}

// Run as a script; a tool that only wants playVersion (a tuning sweep) sets
// V3_VERSIONS_IMPORT before it imports this file.
if (!process.env.V3_VERSIONS_IMPORT) main();
