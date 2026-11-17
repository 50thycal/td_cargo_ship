// Does the "you" bot play like the player? Its numbers next to the player's,
// on the same ruler (measure.ts), on the reference maps' Test Lab cards, with
// the player's own Armory (map rebuild phase 2; docs/design/v3-bot-refit.md).
//
//   npx vite-node tools/v3/bot-fit/fit.ts -- --logs=<dir of play logs>
//       measure the player's logs and save them (tools/v3/bot-fit/player.json)
//   npx vite-node tools/v3/bot-fit/fit.ts -- [--personas=you,you-r12] [--seeds=12]
//       [--maps=strait,gauntlet,harbor] [--json=out.json]
//       the fit table: the player against each persona
//
// The player's runs: every Test Lab map card's full run (log v21 and up) that
// reached wave 5, and the campaign runs (v19 and up) for the hands-only rows.
// The bots: the same cards' production setup (v1 encounters, the convoy
// policy), the player's Armory, and the normal loss limit, so a bot's boss
// rounds are counted only when it gets there, as the player's are.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import type { ArmoryLevels } from '../../../src/v3/data/armory';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import type { MapId } from '../../../src/v3/data/maps';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import type { PlayLog } from '../../../src/v3/sim/playlog';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { PLAYER_ARMORY, measure, pool, type Pooled, type RunMeasure } from './measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const HERE = new URL('.', import.meta.url).pathname;
const PLAYER = `${HERE}player.json`;

export { PLAYER_ARMORY };
export const FIT_MAPS: MapId[] = ['strait', 'gauntlet', 'harbor'];

/** Which of the player's logs the fit reads. */
export function playerRun(l: PlayLog): 'card' | 'campaign' | null {
  if (!l.summary || l.device?.ua === 'mimic' || l.dev?.watch) return null;
  if (l.lab?.plays === 'full' && l.v >= 21 && l.summary.wave >= 5 && /^map-(strait|gauntlet|harbor)/.test(l.lab.card)) return 'card';
  if (!l.lab && !l.freePlay && l.v >= 19 && l.summary.wave >= 5) return 'campaign';
  return null;
}

export interface PlayerRun extends RunMeasure {
  kind: 'card' | 'campaign';
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
    out.push({ ...compact(measure(l, 'you')), kind });
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

function main(): void {
  const logs = opt('logs');
  if (logs) {
    const runs = loadPlayer(logs);
    writeFileSync(PLAYER, `${JSON.stringify({ about: 'The player\'s runs, measured by tools/v3/bot-fit/measure.ts from their play logs (map cards v21+, campaign v19+). Rebuild with fit.ts --logs=<dir>.', made: new Date().toISOString().slice(0, 10), runs }, null, 0)}\n`);
    console.log(`measured ${runs.length} runs (${runs.filter((r) => r.kind === 'card').length} map cards) -> ${PLAYER}`);
    return;
  }
  const player = (JSON.parse(readFileSync(PLAYER, 'utf8')) as { runs: PlayerRun[] }).runs;
  const maps = (opt('maps')?.split(',') ?? FIT_MAPS) as MapId[];
  const personas = (opt('personas') ?? 'you-r12,you').split(',');
  const seeds = Array.from({ length: Number(opt('seeds') ?? 12) }, (_, k) => 900 + k);
  const cards = player.filter((r) => r.kind === 'card' && maps.includes(r.map as MapId));
  const columns: { name: string; p: Pooled }[] = [{ name: 'you (cards)', p: pool(cards) }, { name: 'you (all)', p: pool(player) }];
  const perMap: Record<string, { name: string; p: Pooled }[]> = {};
  for (const map of maps) perMap[map] = [{ name: 'you', p: pool(cards.filter((r) => r.map === map)) }];
  const botRuns: Record<string, RunMeasure[]> = {};
  for (const persona of personas) {
    const runs: RunMeasure[] = [];
    for (const map of maps) {
      const mine = seeds.map((s) => botRun(map, persona, s));
      runs.push(...mine);
      perMap[map].push({ name: persona, p: pool(mine) });
    }
    botRuns[persona] = runs;
    columns.push({ name: persona, p: pool(runs) });
  }
  const w = 34;
  console.log(`The player's map-card runs (${cards.length}) and all their runs (${player.length}) against each bot (${seeds.length} seeds × ${maps.join(', ')}; Armory ${JSON.stringify(PLAYER_ARMORY)}).\n`);
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
  for (const map of maps)
    for (const c of perMap[map]) console.log(`  ${map.padEnd(9)} ${c.name.padEnd(10)} ${c.p.curve.map((v) => (Number.isFinite(v) ? v.toFixed(1) : ' - ')).join(' ')}   (n ${c.p.n}, boss ${c.p.bossRound.toFixed(2)}/round over ${c.p.bossN})`);
  const out = opt('json');
  if (out) writeFileSync(out, `${JSON.stringify({ seeds, maps, armory: PLAYER_ARMORY, columns, perMap }, null, 1)}\n`);
}

if (!process.env.V3_FIT_IMPORT) main();
