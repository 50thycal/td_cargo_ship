// Writes docs/design/v3-combo-sweep.md from the combo sweep's results
// (results/<stage>.json) and the hand-written reading of them
// (tools/v3/combo-sweep/notes.md, put in at the top).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ABILITIES, type AbilityId } from '../../../src/v3/data/abilities';
import { ARMORY, type ArmoryId } from '../../../src/v3/data/armory';
import { MAPS, type MapId } from '../../../src/v3/data/maps';
import type { Summary } from './stats';

const OUT = 'tools/v3/combo-sweep/results';
const DOC = 'docs/design/v3-combo-sweep.md';
const NOTES = 'tools/v3/combo-sweep/notes.md';

interface ConfigResult {
  key: string;
  name: string;
  kind: string;
  weapons?: AbilityId[];
  kit?: 'counter' | 'self';
  armory?: Partial<Record<ArmoryId, number>>;
  perMap: Partial<Record<MapId, Summary>>;
  all: Summary;
  syn?: { perMap: Partial<Record<MapId, number>>; mean: number; predicted: number; win: number; winPredicted: number; fromPairs?: number };
}
interface StageFile {
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

const read = (s: string): StageFile | null => (existsSync(`${OUT}/${s}.json`) ? (JSON.parse(readFileSync(`${OUT}/${s}.json`, 'utf8')) as StageFile) : null);
const f = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : v.toFixed(d));
const sg = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : `${v > 0 ? '+' : ''}${v.toFixed(d)}`);
const pct = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : `${Math.round(v * 100)}%`);
const row = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`;
const head = (cells: string[]) => `${row(cells)}\n${row(cells.map(() => '---'))}`;
const mapName = (m: MapId) => MAPS[m].name;
const byLosses = (a: ConfigResult, b: ConfigResult) => a.all.lostAll - b.all.lostAll || b.all.won - a.all.won;
const byLossesOn = (m: MapId) => (a: ConfigResult, b: ConfigResult) => a.perMap[m]!.lostAll - b.perMap[m]!.lostAll || b.perMap[m]!.won - a.perMap[m]!.won;
const wname = (w: AbilityId) => ABILITIES[w].name;

/** "Trivial" (rule m-kits: no kit should win a map without losing a ship):
 *  at least half the runs won without losing a ship, or under one ship lost
 *  a run over all 13 waves. "Nearly": won 90% or more and under 2 ships lost a run. */
export function triviality(s: Summary): 'trivial' | 'nearly' | null {
  if (s.flawless >= 0.5 || (s.won >= 0.95 && s.lostAll < 1)) return 'trivial';
  if (s.won >= 0.9 && s.lostAll < 2) return 'nearly';
  return null;
}

const COLS = ['Won', 'Won, no ship lost', 'Ships lost, waves 1–10', 'Ships lost a boss round', 'Ships lost, all 13 waves'];
const cols = (s: Summary) => [pct(s.won), pct(s.flawless), f(s.lost10), f(s.boss, 2), `**${f(s.lostAll)}**`];

export function writeDoc(): void {
  const singles = read('singles');
  const pairs = read('pairs');
  const triples = read('triples');
  const confirm = read('confirm');
  const armory = read('armory');
  const any = singles ?? pairs ?? triples ?? confirm ?? armory;
  if (!any) {
    console.log('no results yet: no doc written');
    return;
  }
  const maps = any.maps;
  const L: string[] = [];
  const P = (s = '') => L.push(s);
  P('# V3 combo sweep: weapon loadouts and Armory builds');
  P();
  P(`> Made by \`npm run v3:combo-sweep\` (tools/v3/combo-sweep/), game version ${any.logVersion} (LOG_VERSION), ${any.date}. The tables below are written by the tool; the reading at the top is hand-written (tools/v3/combo-sweep/notes.md). The chapter 1 changes coming in LOG_VERSION 29 (Marrow's radar, Kesh's boss, a calm before the boss) will move these numbers: re-run the sweep once they land.`);
  P();
  if (existsSync(NOTES)) {
    P(readFileSync(NOTES, 'utf8').trim());
    P();
  }
  P('## How the runs were played');
  P();
  P(`- **Maps:** ${maps.map(mapName).join(', ')}: the three reference maps and chapter 1's two new ones, each on its Test Lab card's production setup (as the bot reports play them).`);
  P('- **Player:** the "you" bot (fitted to your own play, docs/design/v3-bot-refit.md), with your usual Armory (Quick Reload 5, Damage Control 4, Stockpile 5), except in the Armory section.');
  P(`- **Weapons:** all ${any.pool.length} weapons the chapter 1 draft deals: ${any.pool.map(wname).join(', ')}. All five maps are chapter 1, so every loadout here is one you can really draft on them; the chapter 2-4 weapons are left out. **The Laser Cutter is not measured:** it is a swipe and the bot only taps, so with it loaded the bot does next to nothing (alone it loses more than twice the plain gun's ships). It is in the singles table to show that, and left out of the pairs and triples.`);
  P('- **A loadout is forced:** every draft offers only the next card of the loadout: each weapon at level 1 in turn (the slots fill early, as you fill them), then level 2, then level 3 (MAX); after that, Resupply at every draft. So it is the best case for that loadout: a draft that always deals what you want. "Bot drafts for itself" is the bot choosing from the real draft.');
  P('- **Every wave is played:** each run goes on past the loss limit to the end of boss round 3, so every loadout is measured on every wave. "Won" is what the normal loss limit (6 ships in waves 1–10, 6 more in the boss rounds) would have made of the same run; it is the same game up to that point.');
  P('- **Synergy** compares a set with what its weapons do alone. Each weapon alone cuts the plain gun\'s losses by some share; if the weapons did not help or hinder each other, a pair would cut by both shares (plain × A\'s share × B\'s share). Synergy is the predicted ships lost minus the ships really lost, a run over all 13 waves: **positive = better together**, negative = they get in each other\'s way. Below about ±1 ship it is within the noise. Because the weapons share one gun, nearly every set falls short of that prediction, so the tables also give **relative synergy**: a set\'s synergy against the mean of all sets of its size.');
  P('- **Trivial** (rule `m-kits`: no kit should win a map without losing a ship): at least half the runs won without losing a ship, or under 1 ship lost a run in all 13 waves. **Nearly trivial**: won 90%+ with under 2 ships lost a run.');
  P();
  P('Columns: **Won** (under the normal loss limit); **Won, no ship lost**; **Ships lost** in waves 1–10, a boss round (the mean of the three), and over all 13 waves (the main ranking: fewer is better).');
  P();

  // ---- The flagged kit ----
  const opIn = (s: StageFile | null) => s?.configs.find((c) => c.key === 'scatter+supplyRun+overdrive');
  const op = opIn(confirm) ?? opIn(triples);
  if (op) {
    const src = opIn(confirm) ? confirm! : triples!;
    P('## Overdrive + Scattergun + Supply Run (the kit you called "really op")');
    P();
    const rank = src.configs.filter((c) => c.kind === 'triple').sort(byLosses).findIndex((c) => c.key === op.key) + 1;
    const nT = src.configs.filter((c) => c.kind === 'triple').length;
    P(`${src.seeds.length} seeds a map. Rank ${rank} of the ${nT} triples in the ${src.stage} stage by ships lost.`);
    P();
    P(head(['Map', ...COLS, 'Synergy (ships a run)', 'Trivial?']));
    for (const m of maps) {
      const s = op.perMap[m]!;
      P(row([mapName(m), ...cols(s), sg(op.syn?.perMap[m]), triviality(s) ?? 'no']));
    }
    P(row(['**All five**', ...cols(op.all), sg(op.syn?.mean), '']));
    const plain = src.configs.find((c) => c.key === 'plain');
    const self = src.configs.find((c) => c.key === 'self');
    if (plain && self) {
      P(row(['_Plain gun, all five_', ...cols(plain.all), '', '']));
      P(row(['_Bot drafts for itself_', ...cols(self.all), '', '']));
    }
    P();
  }

  // ---- Trivial kits ----
  P('## Kits that make a map trivial');
  P();
  const trivRows: string[] = [];
  const seen = new Set<string>();
  for (const st of [confirm, triples, pairs, singles]) {
    if (!st) continue;
    for (const c of st.configs)
      for (const m of maps) {
        const s = c.perMap[m];
        if (!s) continue;
        const t = triviality(s);
        const id = `${c.key}|${m}`;
        if (!t || seen.has(id)) continue;
        seen.add(id);
        trivRows.push(row([mapName(m), c.name, st.stage, `${s.n}`, t === 'trivial' ? '**trivial**' : 'nearly', pct(s.won), pct(s.flawless), f(s.lostAll)]));
      }
  }
  if (trivRows.length) {
    P('Every weapon set that met the bar on a map, from the stage with the most seeds that played it (fewer seeds: more noise; a pair or triple with 6–8 seeds a map is a lead to check, not a verdict).');
    P();
    P(head(['Map', 'Loadout', 'Stage', 'Runs', 'Verdict', 'Won', 'Won, no ship lost', 'Ships lost, all 13 waves']));
    for (const r of trivRows) P(r);
  } else P('None: no weapon set met the bar on any map.');
  P();

  // ---- Best and worst ----
  if (confirm) {
    const T = confirm.configs.filter((c) => c.kind === 'triple').sort(byLosses);
    P(`## Best and worst loadouts (confirmed on ${confirm.seeds.length} seeds a map)`);
    P();
    P('The 15 best and 5 worst triples of the triples stage, played again on more seeds, with each map\'s counter kit (the plan\'s), the plain gun and the bot drafting for itself for scale. Tension: the danger on the board each second (docs/design/v3-fun-metrics.md), over the waves the run reached: mean peak, share of time "hot", share of waves with a sawtooth shape (rises and releases, the shape we want).');
    P();
    P(head(['#', 'Loadout', ...COLS, 'Synergy', 'Tension peak', 'Hot', 'Sawtooth waves']));
    const rest = confirm.configs.filter((c) => c.kind !== 'triple' && c.kind !== 'single');
    T.forEach((c, k) => P(row([`${k + 1}`, c.name, ...cols(c.all), sg(c.syn?.mean), f(c.all.tension?.peak, 2), pct(c.all.tension?.hot), pct(c.all.tension?.sawtooth)])));
    for (const c of rest) P(row(['', `_${c.name}_`, ...cols(c.all), '', f(c.all.tension?.peak, 2), pct(c.all.tension?.hot), pct(c.all.tension?.sawtooth)]));
    P();
    P('### By map');
    P();
    for (const m of maps) {
      const t = [...T].sort(byLossesOn(m));
      P(`**${mapName(m)}** (counter kit: ${confirm.notes?.find((n) => n.startsWith('counter kits'))?.match(new RegExp(`${m} ([\\w+]+)`))?.[1]?.split('+').map((w) => wname(w as AbilityId)).join(', ') ?? '–'})`);
      P();
      P(head(['', 'Loadout', ...COLS]));
      t.slice(0, 5).forEach((c, k) => P(row([`best ${k + 1}`, c.name, ...cols(c.perMap[m]!)])));
      t.slice(-3).forEach((c, k) => P(row([`worst ${3 - k}`, c.name, ...cols(c.perMap[m]!)])));
      for (const c of confirm.configs.filter((x) => x.kind === 'kit' || x.kind === 'plain' || x.kind === 'self')) P(row(['', `_${c.name}_`, ...cols(c.perMap[m]!)]));
      P();
    }
  }

  // ---- Singles ----
  if (singles) {
    P(`## Each weapon on its own (${singles.seeds.length} seeds a map)`);
    P();
    P('**Alone**: the weapon levelled to MAX by wave 4, then Resupply at every draft (nothing else held). **First pick**: the weapon levelled to MAX first, then the bot drafts for itself (a realistic run that starts with it). Sorted by ships lost alone.');
    P();
    const alone = singles.configs.filter((c) => c.kind === 'single').sort(byLosses);
    const lead = new Map(singles.configs.filter((c) => c.kind === 'lead').map((c) => [c.weapons![0], c]));
    P(head(['Weapon', 'Alone: won', 'Alone: lost 1–10', 'Alone: boss round', 'Alone: all 13', 'First pick: won', 'First pick: all 13', ...maps.map((m) => `Alone: ${mapName(m)}`)]));
    for (const c of alone) {
      const l = lead.get(c.weapons![0]);
      P(row([wname(c.weapons![0]), pct(c.all.won), f(c.all.lost10), f(c.all.boss, 2), `**${f(c.all.lostAll)}**`, pct(l?.all.won), f(l?.all.lostAll), ...maps.map((m) => f(c.perMap[m]!.lostAll))]));
    }
    for (const c of singles.configs.filter((x) => x.kind === 'plain' || x.kind === 'self')) P(row([`_${c.name}_`, pct(c.all.won), f(c.all.lost10), f(c.all.boss, 2), `**${f(c.all.lostAll)}**`, '', '', ...maps.map((m) => f(c.perMap[m]!.lostAll))]));
    P();
  }

  // ---- Pairs ----
  if (pairs) {
    const pr = pairs.configs.filter((c) => c.kind === 'pair');
    P(`## Pairs (${pr.length} pairs, ${pairs.seeds.length} seeds a map)`);
    P();
    P('Two weapons, nothing else. Best 10 and worst 5 by ships lost.');
    P();
    const sorted = [...pr].sort(byLosses);
    P(head(['#', 'Pair', ...COLS, 'Synergy']));
    sorted.slice(0, 10).forEach((c, k) => P(row([`${k + 1}`, c.name, ...cols(c.all), sg(c.syn?.mean)])));
    sorted.slice(-5).forEach((c, k) => P(row([`${pr.length - 4 + k}`, c.name, ...cols(c.all), sg(c.syn?.mean)])));
    P();
    P('### Synergy: pairs');
    P();
    const sing = new Map(pairs.configs.filter((c) => c.kind === 'single').map((c) => [c.weapons![0], c]));
    const avgSyn = pr.reduce((t, c) => t + c.syn!.mean, 0) / pr.length;
    const bestAlone = (c: ConfigResult) => Math.min(...c.weapons!.map((w) => sing.get(w)?.all.lostAll ?? NaN));
    const short = pr.filter((c) => c.syn!.mean < 0).length;
    P(`**${short === pr.length ? 'Every pair falls' : `${short} of the ${pr.length} pairs fall`} short of the prediction** (mean synergy ${sg(avgSyn)} ships a run). That is expected in this game: the weapons share one gun (a pickup replaces the loaded weapon), so two weapons split the gun's time and the drops instead of adding up, and a run has some losses no weapon prevents. So read synergy against the other pairs: **relative synergy** = a pair's synergy less the mean of all pairs. Positive: these two fit together better than most; negative: worse than most. "Second weapon adds" is the plainest test: ships a run the pair saves over the better of its two weapons alone (negative: the pair does worse than its best weapon alone).`);
    P();
    P('All 13 waves, the mean over the five maps (per map: relative synergy).');
    P();
    const bySyn = [...pr].sort((x, y) => y.syn!.mean - x.syn!.mean);
    const line = (tag: string, c: ConfigResult) =>
      P(row([tag, c.name, f(c.all.lostAll), f(bestAlone(c)), sg(bestAlone(c) - c.all.lostAll), f(c.syn!.predicted), `**${sg(c.syn!.mean - avgSyn)}**`, ...maps.map((m) => sg(c.syn!.perMap[m]! - avgSyn))]));
    P(head(['', 'Pair', 'Lost', 'Best alone', 'Second weapon adds', 'Predicted (independent)', 'Relative synergy', ...maps.map(mapName)]));
    bySyn.slice(0, 10).forEach((c) => line('best partners', c));
    bySyn.slice(-10).reverse().forEach((c) => line('worst partners', c));
    P();
    // Which weapon pairs well on the whole.
    const by = new Map<AbilityId, number[]>();
    for (const c of pr) for (const w of c.weapons!) by.set(w, [...(by.get(w) ?? []), c.syn!.mean]);
    const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
    P('Mean relative synergy of each weapon over all its pairs (a good partner, or one that does its job alone):');
    P();
    P(head(['Weapon', 'Mean relative synergy in a pair']));
    for (const [w, xs] of [...by].sort((x, y) => mean(y[1]) - mean(x[1]))) P(row([wname(w), sg(mean(xs) - avgSyn, 2)]));
    P();
  }

  // ---- Triples ----
  if (triples) {
    const tr = triples.configs.filter((c) => c.kind === 'triple');
    P(`## Triples (${tr.length} triples, ${triples.seeds.length} seeds a map)`);
    P();
    P(`${triples.notes?.[0] ?? ''}`);
    P();
    const sorted = [...tr].sort(byLosses);
    P(head(['#', 'Triple', ...COLS, 'Synergy (vs singles)', 'Third weapon\'s own synergy (vs pairs)']));
    sorted.slice(0, 15).forEach((c, k) => P(row([`${k + 1}`, c.name, ...cols(c.all), sg(c.syn?.mean), sg(c.syn?.fromPairs)])));
    P(row(['…', '', '', '', '', '', '', '', '']));
    sorted.slice(-5).forEach((c, k) => P(row([`${tr.length - 4 + k}`, c.name, ...cols(c.all), sg(c.syn?.mean), sg(c.syn?.fromPairs)])));
    P();
    P('### Synergy: triples');
    P();
    P('Against the singles: what the three weapons alone predict. Against the pairs: what the three pairs inside it predict, so what is left is what the three do only all together.');
    P();
    const bySyn = [...tr].filter((c) => c.syn?.fromPairs !== undefined).sort((a, b) => b.syn!.fromPairs! - a.syn!.fromPairs!);
    const avgS = tr.reduce((t, c) => t + (c.syn?.mean ?? 0), 0) / tr.length;
    const avgP = bySyn.reduce((t, c) => t + c.syn!.fromPairs!, 0) / Math.max(1, bySyn.length);
    P(`Means over the triples: ${sg(avgS)} against the singles, ${sg(avgP)} against the pairs. As with the pairs, read each against the mean (relative).`);
    P();
    P(head(['', 'Triple', 'Lost', 'Synergy vs singles', 'Relative', 'Synergy vs pairs', 'Relative']));
    bySyn.slice(0, 6).forEach((c) => P(row(['all three together', c.name, f(c.all.lostAll), sg(c.syn!.mean), sg(c.syn!.mean - avgS), sg(c.syn!.fromPairs), `**${sg(c.syn!.fromPairs! - avgP)}**`])));
    bySyn.slice(-6).reverse().forEach((c) => P(row(['crowded', c.name, f(c.all.lostAll), sg(c.syn!.mean), sg(c.syn!.mean - avgS), sg(c.syn!.fromPairs), `**${sg(c.syn!.fromPairs! - avgP)}**`])));
    P();
  }

  // ---- Armory ----
  if (armory) {
    P(`## The Armory (${armory.seeds.length} seeds a map)`);
    P();
    P('A run equips one upgrade from each bay (Gun, Hull, Supply), so only builds with at most one upgrade a bay are played: each upgrade alone at level 5, every pair from two bays at level 5 and every full build (one a bay) at level 5 (these two with the counter kit only), and three budgets (your usual three at level 1, at level 3, and as you have them: Quick Reload 5, Damage Control 4, Stockpile 5). Each with the map\'s counter kit forced (the plan\'s, docs/design/v3-map-plans) and with the bot drafting for itself.');
    for (const n of armory.notes ?? []) P(`- ${n}`);
    P();
    for (const kit of ['counter', 'self'] as const) {
      const cs = armory.configs.filter((c) => c.kit === kit);
      const none = cs.find((c) => !Object.keys(c.armory ?? {}).length)!;
      P(`### ${kit === 'counter' ? "With the map's counter kit" : 'With the bot drafting for itself'}`);
      P();
      P('Each upgrade alone at level 5: ships saved a run (all 13 waves) against no Armory, per map. Higher is better.');
      P();
      const singlesA = cs.filter((c) => Object.keys(c.armory ?? {}).length === 1 && Object.values(c.armory!)[0] === 5).sort((a, b) => a.all.lostAll - b.all.lostAll);
      P(head(['Upgrade', 'Bay', 'Won', 'Lost, all 13', 'Saved, all five', ...maps.map(mapName)]));
      for (const c of singlesA) {
        const id = Object.keys(c.armory!)[0] as ArmoryId;
        P(row([ARMORY[id].name, ARMORY[id].bay, pct(c.all.won), f(c.all.lostAll), `**${sg(none.all.lostAll - c.all.lostAll)}**`, ...maps.map((m) => sg(none.perMap[m]!.lostAll - c.perMap[m]!.lostAll))]));
      }
      P(row(['_No Armory_', '', pct(none.all.won), f(none.all.lostAll), '', ...maps.map(() => '')]));
      P();
      const full = cs.filter((c) => Object.keys(c.armory ?? {}).length === 3 && Object.values(c.armory!).every((v) => v === 5)).sort(byLosses);
      P(full.length ? 'Full builds (one upgrade a bay, all at level 5): best 8 and worst 3, and the budgets.' : 'The budgets.');
      P();
      P(head(['', 'Build', ...COLS]));
      full.slice(0, 8).forEach((c, k) => P(row([`best ${k + 1}`, c.name, ...cols(c.all)])));
      full.slice(-3).forEach((c, k) => P(row([`worst ${3 - k}`, c.name, ...cols(c.all)])));
      for (const c of cs.filter((x) => Object.values(x.armory ?? {}).some((v) => v !== 5) || !Object.keys(x.armory ?? {}).length)) P(row(['', `_${c.name}_`, ...cols(c.all)]));
      P();
      const pairsA = cs.filter((c) => Object.keys(c.armory ?? {}).length === 2).sort(byLosses);
      if (pairsA.length) {
        P(`Pairs from two bays at level 5: best 5 of ${pairsA.length}: ${pairsA.slice(0, 5).map((c) => `${c.name} (${f(c.all.lostAll)} lost, won ${pct(c.all.won)})`).join('; ')}.`);
        P();
      }
      const triv: string[] = [];
      for (const c of cs)
        for (const m of maps) {
          const s = c.perMap[m]!;
          const t = triviality(s);
          if (t) triv.push(row([mapName(m), c.name, t === 'trivial' ? '**trivial**' : 'nearly', pct(s.won), pct(s.flawless), f(s.lostAll)]));
        }
      P(`Builds that make a map trivial or nearly (${kit === 'counter' ? 'counter kit' : 'own draft'}):`);
      P();
      if (triv.length) {
        P(head(['Map', 'Build', 'Verdict', 'Won', 'Won, no ship lost', 'Lost, all 13']));
        for (const r of triv) P(r);
      } else P('None.');
      P();
    }
  }

  // ---- Running it ----
  P('## Running it again');
  P();
  P('```');
  P('npm run v3:combo-sweep -- --stage=all                 # every stage, then this doc');
  P('npm run v3:combo-sweep -- --stage=pairs --seeds=4     # one stage, fewer seeds');
  P('npm run v3:combo-sweep -- --stage=report              # this doc from the saved results');
  P('```');
  P();
  P('Stages: `singles`, `pairs`, `triples` (needs pairs), `confirm` (needs triples), `armory`, `report`, `all`. Options: `--seeds=N`, `--maps=a,b`, `--top=N` (pairs carried into triples), `--procs=N`. Each run is cached in `tools/v3/combo-sweep/results/cache/v<LOG_VERSION>.jsonl` (not committed), so a stopped stage resumes and a game change (a new LOG_VERSION) starts afresh.');
  P();
  P(head(['Stage', 'Seeds a map', 'Runs', 'Minutes (4 cores)']));
  for (const st of [singles, pairs, triples, confirm, armory]) if (st) P(row([st.stage, `${st.seeds.length}`, `${st.runs}`, f(st.seconds / 60)]));
  P();
  writeFileSync(DOC, `${L.join('\n')}\n`);
  console.log(`wrote ${DOC}`);
}
