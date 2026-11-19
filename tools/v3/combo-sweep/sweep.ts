// THE COMBO SWEEP (docs/design/v3-combo-sweep.md): bot runs of weapon
// loadouts and Armory builds, to find the best combos, the synergies, and
// any kit that makes a map trivial (rule m-kits).
//
//   npm run v3:combo-sweep -- --stage=singles|pairs|triples|confirm|armory|report|all
//       [--seeds=N] [--maps=strait,gauntlet,...] [--top=15] [--procs=N]
//
// Stages (each writes results/<stage>.json; `report` writes the doc):
//   singles  the plain gun (Resupply at every draft), the bot drafting for
//            itself, each weapon alone (levelled to MAX, then Resupply) and
//            each weapon as the first pick (levelled to MAX, then the bot
//            drafts for itself). 12 seeds.
//   pairs    every pair of weapons (but UNMEASURED), nothing else. 6 seeds.
//   triples  the best pairs (--top, 10) with each third weapon. 4 seeds.
//   confirm  the 15 best and 5 worst triples, the Overdrive + Scattergun +
//            Supply Run kit, each map's counter kit, the plain gun and the
//            bot drafting for itself, on 12 seeds, with the tension reading.
//   armory   the Armory: none, each upgrade alone at MAX, every legal pair
//            at MAX (one upgrade a bay), every full build (one a bay) at
//            MAX, and three budgets; each with the map's counter kit and
//            (all but the pairs and full builds) with the bot drafting
//            for itself. 4 seeds.
//
// Every run: the map's Test Lab card on its production setup, the "you" bot,
// the player's Armory (PLAYER_ARMORY: Quick Reload 5, Damage Control 4,
// Stockpile 5) except in the armory stage, seeds 900.. (the same seeds for
// every loadout, so loadouts are compared on the same games). Runs are
// cached per LOG_VERSION in results/cache/ (git-ignored): a stopped stage
// resumes, and a later stage reuses an earlier one's runs.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { ABILITIES, ABILITY_ORDER, type AbilityId } from '../../../src/v3/data/abilities';
import { ARMORY, ARMORY_MAX, ARMORY_ORDER, BAY_ORDER, bayItems, type ArmoryId, type ArmoryLevels } from '../../../src/v3/data/armory';
import { MAPS, chapterOf, type MapId } from '../../../src/v3/data/maps';
import { mapPlan } from '../../../src/v3/data/mapPlans';
import { draftPool } from '../../../src/v3/data/roster';
import { LOG_VERSION } from '../../../src/v3/sim/playlog';
import { PLAYER_ARMORY } from '../bot-fit/measure';
import type { ComboJob, ComboRun } from './play';
import { counter, runJobs } from './pool';
import { overall, predictFromPairs, predictLosses, predictWin, summarize, type Summary } from './stats';
import { writeDoc } from './doc';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');

export const OUT = 'tools/v3/combo-sweep/results';
const CACHE = `${OUT}/cache/v${LOG_VERSION}.jsonl`;
/** The three reference maps and chapter 1's two new ones. */
export const STD_MAPS: MapId[] = ['strait', 'gauntlet', 'harbor', 'kesh', 'marrow'];
/** The kit the player called "really op". */
export const OP_KIT: AbilityId[] = ['overdrive', 'scatter', 'supplyRun'];
const SEEDS = { singles: 12, pairs: 6, triples: 4, confirm: 12, armory: 4 } as const;
/** Seconds a run takes on one core (measured: 0.45 s alone, a little more
 *  nearer 1 s with every core busy). For the time estimates. */
const RUN_S = 1.05;

const maps = (opt('maps')?.split(',') as MapId[] | undefined) ?? STD_MAPS;
for (const m of maps) if (!MAPS[m]) throw new Error(`unknown map ${m}`);
const procs = Number(opt('procs') ?? availableParallelism());
const top = Number(opt('top') ?? 10);
const seedsFor = (stage: keyof typeof SEEDS) => Array.from({ length: Number(opt('seeds') ?? SEEDS[stage]) }, (_, k) => 900 + k);

/** Weapons the draft deals on a map (its chapter's roster). */
const poolOf = (m: MapId) => draftPool(chapterOf(m));
/** The weapons every swept map's draft deals; the sweep keeps to these. */
export const POOL: AbilityId[] = ABILITY_ORDER.filter((id) => maps.every((m) => poolOf(m).includes(id)));
/** Weapons the bot can't play: the Laser Cutter is a swipe, and the bot
 *  only taps, so with it loaded the bot's gun does next to nothing (alone:
 *  more than twice the plain gun's losses). Played in the singles (to
 *  show it), left out of the pairs and triples. */
export const UNMEASURED: AbilityId[] = ['cutter'];
/** Canonical order (the roster's): the order the forced draft fills slots. */
const canon = (ws: AbilityId[]) => [...ws].sort((a, b) => ABILITY_ORDER.indexOf(a) - ABILITY_ORDER.indexOf(b));
export const nameOf = (ws: AbilityId[] | undefined, thenSelf?: boolean) => (ws ? (ws.length ? ws.map((w) => ABILITIES[w].name).join(' + ') + (thenSelf ? ' (first, then own picks)' : '') : 'Plain gun') : 'Bot drafts for itself');

export interface Config {
  key: string;
  name: string;
  kind: 'plain' | 'self' | 'single' | 'lead' | 'pair' | 'triple' | 'kit' | 'armory';
  /** Forced loadout; per map when the kit is the map's own. */
  loadout?: AbilityId[];
  perMapLoadout?: Partial<Record<MapId, AbilityId[]>>;
  thenSelf?: boolean;
  armory: ArmoryLevels;
  /** Armory stage: which kit. */
  kit?: 'counter' | 'self';
  tension?: boolean;
}

export interface ConfigResult {
  key: string;
  name: string;
  kind: Config['kind'];
  weapons?: AbilityId[];
  kit?: Config['kit'];
  armory?: ArmoryLevels;
  perMap: Partial<Record<MapId, Summary>>;
  all: Summary;
  /** Synergy (pairs and triples), ships a run saved beyond the prediction. */
  syn?: { perMap: Partial<Record<MapId, number>>; mean: number; predicted: number; win: number; winPredicted: number; fromPairs?: number };
}

export interface StageFile {
  stage: string;
  about: string;
  logVersion: number;
  date: string;
  seeds: number[];
  maps: MapId[];
  pool: AbilityId[];
  seconds: number;
  runs: number;
  configs: ConfigResult[];
  notes?: string[];
}

const loadoutOn = (c: Config, m: MapId) => c.perMapLoadout?.[m] ?? c.loadout;

function jobsOf(c: Config, seeds: number[]): ComboJob[] {
  const out: ComboJob[] = [];
  for (const m of maps)
    for (const seed of seeds) {
      const l = loadoutOn(c, m);
      out.push({ map: m, seed, armory: c.armory, ...(l ? { loadout: l } : {}), ...(c.thenSelf ? { thenSelf: true } : {}), ...(c.tension ? { tension: true } : {}) });
    }
  return out;
}

/** Play the configs on the seeds (cached runs are reused) and sum them up. */
async function play(cs: Config[], seeds: number[], label: string): Promise<{ results: ConfigResult[]; runs: number }> {
  const jobs = cs.flatMap((c) => jobsOf(c, seeds));
  const est = (jobs.length * RUN_S) / procs;
  console.log(`${label}: ${cs.length} configs × ${maps.length} maps × ${seeds.length} seeds = ${jobs.length} runs; at most ~${(est / 60).toFixed(1)} min on ${procs} cores (less for cached runs)`);
  const runs = await runJobs(jobs, CACHE, { procs, label });
  let k = 0;
  const results = cs.map((c) => {
    const perMap: Partial<Record<MapId, Summary>> = {};
    for (const m of maps) {
      const rs: ComboRun[] = runs.slice(k, k + seeds.length);
      k += seeds.length;
      perMap[m] = summarize(rs);
    }
    const r: ConfigResult = { key: c.key, name: c.name, kind: c.kind, perMap, all: overall(Object.values(perMap) as Summary[]) };
    if (c.loadout) r.weapons = c.loadout;
    if (c.kit) r.kit = c.kit;
    if (c.kind === 'armory') r.armory = c.armory;
    return r;
  });
  return { results, runs: jobs.length };
}

const tidy = (_k: string, v: unknown) => (typeof v === 'number' ? (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null) : v);

/** Runs played when the stage started (a stage all read from the cache
 *  keeps the time it took when it was played). */
let playedAtStart = 0;

function save(stage: string, about: string, seeds: number[], t0: number, runs: number, configs: ConfigResult[], notes?: string[]): StageFile {
  const old = readStage(stage);
  const fresh = counter.played > playedAtStart || !old || old.logVersion !== LOG_VERSION;
  const seconds = fresh ? Math.round((Date.now() - t0) / 1000) : old.seconds;
  const f: StageFile = { stage, about, logVersion: LOG_VERSION, date: new Date().toISOString().slice(0, 10), seeds, maps, pool: POOL, seconds, runs, configs, ...(notes ? { notes } : {}) };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${stage}.json`, `${JSON.stringify(f, tidy, 1)}\n`);
  console.log(`wrote ${OUT}/${stage}.json (${f.seconds} s)`);
  return f;
}

export function readStage(stage: string): StageFile | null {
  const p = `${OUT}/${stage}.json`;
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as StageFile) : null;
}

const plainC = (armory: ArmoryLevels = PLAYER_ARMORY): Config => ({ key: 'plain', name: nameOf([]), kind: 'plain', loadout: [], armory });
const selfC = (armory: ArmoryLevels = PLAYER_ARMORY): Config => ({ key: 'self', name: nameOf(undefined), kind: 'self', armory });
const setC = (ws: AbilityId[], kind: Config['kind']): Config => {
  const l = canon(ws);
  return { key: l.join('+'), name: nameOf(l), kind, loadout: l, armory: PLAYER_ARMORY };
};

/** Per map, a set's synergy against its singles (and the plain gun). */
function withSynergy(sets: ConfigResult[], singles: Map<AbilityId, ConfigResult>, plain: ConfigResult, pairs?: Map<string, ConfigResult>): void {
  for (const r of sets) {
    const ws = r.weapons!;
    const perMap: Partial<Record<MapId, number>> = {};
    const preds: number[] = [];
    const winPreds: number[] = [];
    const fromPairs: number[] = [];
    for (const m of maps) {
      const P = plain.perMap[m]!;
      const parts = ws.map((w) => singles.get(w)!.perMap[m]!);
      const pred = predictLosses(P.lostAll, parts.map((s) => s.lostAll));
      preds.push(pred);
      perMap[m] = pred - r.perMap[m]!.lostAll;
      winPreds.push(predictWin(P.won, parts.map((s) => s.won)));
      if (pairs && ws.length === 3) {
        const pk = (a: AbilityId, b: AbilityId) => canon([a, b]).join('+');
        const ps = [pk(ws[0], ws[1]), pk(ws[0], ws[2]), pk(ws[1], ws[2])].map((k) => pairs.get(k)?.perMap[m]?.lostAll);
        if (ps.every((v) => v !== undefined)) {
          const pp = predictFromPairs(P.lostAll, parts.map((s) => s.lostAll) as [number, number, number], ps as [number, number, number]);
          if (Number.isFinite(pp)) fromPairs.push(pp - r.perMap[m]!.lostAll);
        }
      }
    }
    const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
    r.syn = {
      perMap,
      mean: mean(Object.values(perMap) as number[]),
      predicted: mean(preds),
      win: r.all.won - mean(winPreds),
      winPredicted: mean(winPreds),
      ...(fromPairs.length === maps.length ? { fromPairs: mean(fromPairs) } : {}),
    };
  }
}

const byLosses = (a: ConfigResult, b: ConfigResult) => a.all.lostAll - b.all.lostAll || b.all.won - a.all.won;

async function stageSingles(): Promise<void> {
  const t0 = Date.now();
  const seeds = seedsFor('singles');
  const cs: Config[] = [plainC(), selfC(), ...POOL.map((w) => setC([w], 'single')), ...POOL.map((w): Config => ({ key: `${w}>self`, name: nameOf([w], true), kind: 'lead', loadout: [w], thenSelf: true, armory: PLAYER_ARMORY }))];
  const { results, runs } = await play(cs, seeds, 'singles');
  save('singles', 'Each weapon alone (levelled to MAX, then Resupply at every draft) and as the first pick (then the bot drafts for itself); the plain gun; the bot drafting for itself.', seeds, t0, runs, results);
}

/** The singles and the plain gun, on these seeds (cached runs). */
async function baseOn(seeds: number[]): Promise<{ plain: ConfigResult; singles: Map<AbilityId, ConfigResult>; self: ConfigResult }> {
  const { results } = await play([plainC(), selfC(), ...POOL.map((w) => setC([w], 'single'))], seeds, 'singles (for the synergy)');
  return { plain: results[0], self: results[1], singles: new Map(results.slice(2).map((r) => [r.weapons![0], r])) };
}

async function stagePairs(): Promise<void> {
  const t0 = Date.now();
  const seeds = seedsFor('pairs');
  const base = await baseOn(seeds);
  const cs: Config[] = [];
  const ws = POOL.filter((w) => !UNMEASURED.includes(w));
  for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) cs.push(setC([ws[i], ws[j]], 'pair'));
  const { results, runs } = await play(cs, seeds, 'pairs');
  withSynergy(results, base.singles, base.plain);
  save('pairs', 'Every pair of weapons, nothing else (each levelled to MAX in turn, then Resupply). Synergy against the singles on the same seeds.', seeds, t0, runs, [base.plain, base.self, ...base.singles.values(), ...results]);
}

async function stageTriples(): Promise<void> {
  const t0 = Date.now();
  const pairsFile = readStage('pairs');
  if (!pairsFile) throw new Error('run --stage=pairs first');
  const seeds = seedsFor('triples');
  const best = pairsFile.configs.filter((c) => c.kind === 'pair' && !c.weapons!.some((w) => UNMEASURED.includes(w))).sort(byLosses).slice(0, top);
  const keys = new Set<string>();
  const cs: Config[] = [];
  for (const p of best)
    for (const w of POOL) {
      if (p.weapons!.includes(w) || UNMEASURED.includes(w)) continue;
      const c = setC([...p.weapons!, w], 'triple');
      if (keys.has(c.key)) continue;
      keys.add(c.key);
      cs.push(c);
    }
  // The kit the player flagged, whether or not its pairs made the cut.
  const op = setC(OP_KIT, 'triple');
  if (!keys.has(op.key)) cs.push(op);
  const base = await baseOn(seeds);
  const pairsHere = await play(pairsFile.configs.filter((c) => c.kind === 'pair').map((c) => setC(c.weapons!, 'pair')), seeds, 'pairs (for the synergy)');
  const pairs = new Map(pairsHere.results.map((r) => [r.key, r]));
  const { results, runs } = await play(cs, seeds, 'triples');
  withSynergy(results, base.singles, base.plain, pairs);
  save('triples', `The ${top} best pairs (fewest ships lost) with each third weapon, and Overdrive + Scattergun + Supply Run. Synergy against the singles and against the pairs, on the same seeds.`, seeds, t0, runs, [base.plain, base.self, ...results], [`pairs extended: ${best.map((p) => p.name).join('; ')}`]);
}

async function stageConfirm(): Promise<void> {
  const t0 = Date.now();
  const triplesFile = readStage('triples');
  if (!triplesFile) throw new Error('run --stage=triples first');
  const seeds = seedsFor('confirm');
  const ranked = triplesFile.configs.filter((c) => c.kind === 'triple').sort(byLosses);
  const pick = [...ranked.slice(0, 15), ...ranked.slice(-5)];
  const cs: Config[] = pick.map((c) => ({ ...setC(c.weapons!, 'triple'), tension: true }));
  const op = setC(OP_KIT, 'triple');
  if (!cs.some((c) => c.key === op.key)) cs.push({ ...op, tension: true });
  const counters: Partial<Record<MapId, AbilityId[]>> = {};
  for (const m of maps) {
    const p = mapPlan(m);
    if (p) counters[m] = canon(p.counters);
  }
  cs.push({ key: 'counter', name: "The map's counter kit", kind: 'kit', loadout: [], perMapLoadout: counters, armory: PLAYER_ARMORY, tension: true });
  cs.push({ ...plainC(), tension: true }, { ...selfC(), tension: true });
  const { results, runs } = await play(cs, seeds, 'confirm');
  // Synergy against the singles on the confirm seeds (played there too).
  // Against the pairs: the triples stage's (the pairs on 12 seeds would
  // cost more than the rest of the stage).
  const base = await baseOn(seeds);
  withSynergy(
    results.filter((r) => r.kind === 'triple'),
    base.singles,
    base.plain,
  );
  for (const r of results) if (r.kind === 'kit') r.weapons = undefined;
  save('confirm', 'The 15 best and 5 worst triples, Overdrive + Scattergun + Supply Run, each map\'s counter kit, the plain gun and the bot drafting for itself, on more seeds, with the tension reading.', seeds, t0, runs, [...results, ...base.singles.values()], [
    `counter kits: ${maps.map((m) => `${m} ${(counters[m] ?? []).join('+')}`).join('; ')}`,
  ]);
}

/** The Armory builds: none, each alone at MAX, every legal pair (two bays)
 *  at MAX, every full build (one a bay) at MAX, and three budgets. */
export function armoryBuilds(): { key: string; name: string; armory: ArmoryLevels; group: string }[] {
  const nm = (a: ArmoryLevels) => (Object.keys(a).length ? Object.entries(a).map(([k, v]) => `${ARMORY[k as ArmoryId].name} ${v}`).join(' + ') : 'No Armory');
  const key = (a: ArmoryLevels) => (Object.keys(a).length ? Object.entries(a).map(([k, v]) => `${k}${v}`).join('.') : 'none');
  const out: { key: string; name: string; armory: ArmoryLevels; group: string }[] = [];
  const add = (a: ArmoryLevels, group: string) => out.push({ key: key(a), name: nm(a), armory: a, group });
  add({}, 'none');
  for (const id of ARMORY_ORDER) add({ [id]: ARMORY_MAX }, 'single');
  for (let i = 0; i < BAY_ORDER.length; i++)
    for (let j = i + 1; j < BAY_ORDER.length; j++)
      for (const a of bayItems(BAY_ORDER[i])) for (const b of bayItems(BAY_ORDER[j])) add({ [a]: ARMORY_MAX, [b]: ARMORY_MAX }, 'pair');
  for (const a of bayItems('gun')) for (const b of bayItems('hull')) for (const c of bayItems('supply')) add({ [a]: ARMORY_MAX, [b]: ARMORY_MAX, [c]: ARMORY_MAX }, 'full');
  add({ reload: 1, repair: 1, stockpile: 1 }, 'budget');
  add({ reload: 3, repair: 3, stockpile: 3 }, 'budget');
  add({ ...PLAYER_ARMORY }, 'budget');
  return out;
}

async function stageArmory(): Promise<void> {
  const t0 = Date.now();
  const seeds = seedsFor('armory');
  const counters: Partial<Record<MapId, AbilityId[]>> = {};
  const notes: string[] = [];
  for (const m of maps) {
    const p = mapPlan(m);
    if (!p) continue;
    counters[m] = canon(p.counters);
    const off = p.counters.filter((w) => !poolOf(m).includes(w));
    if (off.length) notes.push(`${MAPS[m].name}'s counter kit has ${off.map((w) => ABILITIES[w].name).join(', ')}, which its chapter's draft does not deal; forced in anyway (the kit as the plan names it).`);
  }
  const cs: Config[] = [];
  for (const b of armoryBuilds()) {
    cs.push({ key: `counter@${b.key}`, name: b.name, kind: 'armory', kit: 'counter', loadout: [], perMapLoadout: counters, armory: b.armory });
    // The pairs and the full builds with the counter kit only (time: see
    // the doc's cuts).
    if (b.group !== 'pair' && b.group !== 'full') cs.push({ key: `self@${b.key}`, name: b.name, kind: 'armory', kit: 'self', armory: b.armory });
  }
  const { results, runs } = await play(cs, seeds, 'armory');
  for (const r of results) r.weapons = undefined;
  save('armory', 'Armory builds with each map\'s counter kit (forced) and with the bot drafting for itself.', seeds, t0, runs, results, notes);
}

async function main(): Promise<void> {
  const stage = opt('stage') ?? 'report';
  const t0 = Date.now();
  console.log(`combo sweep, LOG_VERSION ${LOG_VERSION}, maps ${maps.join(', ')}, ${POOL.length} weapons in the draft: ${POOL.join(', ')}`);
  const left = ABILITY_ORDER.filter((id) => !POOL.includes(id));
  if (left.length) console.log(`  not dealt on these maps (left out): ${left.join(', ')}`);
  const stages: Record<string, () => Promise<void>> = { singles: stageSingles, pairs: stagePairs, triples: stageTriples, confirm: stageConfirm, armory: stageArmory };
  const order = stage === 'all' ? ['singles', 'pairs', 'triples', 'confirm', 'armory'] : stage === 'report' ? [] : [stage];
  for (const s of order) {
    if (!stages[s]) throw new Error(`unknown stage ${s}`);
    playedAtStart = counter.played;
    await stages[s]();
  }
  writeDoc();
  console.log(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

if (!process.env.VITEST) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
