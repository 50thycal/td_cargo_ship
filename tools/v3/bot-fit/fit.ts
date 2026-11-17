// Does the "you" bot play like the player? Its numbers next to the player's,
// on the same ruler (measure.ts), on the reference maps' Test Lab cards, with
// the player's own Armory (map rebuild phase 2; docs/design/v3-bot-refit.md).
//
//   npx vite-node tools/v3/bot-fit/fit.ts -- --logs=<dir of play logs>
//       measure the player's logs and save them (tools/v3/bot-fit/player.json)
//   npx vite-node tools/v3/bot-fit/fit.ts -- [--personas=you-r12,you] [--dice=6] [--own-picks] [--json=out.json]
//       calibration (the default): each of the player's runs, map cards and
//       campaign alike, mirrored by each bot with the same map, seed, Armory
//       upgrades, card setup and draft picks
//   npx vite-node tools/v3/bot-fit/fit.ts -- --cards [--seeds=12] [--maps=…] [--armory=none]
//       the reference cards' production setup today, on fresh seeds
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
import type { PlayLog } from '../../../src/v3/sim/playlog';
import type { Game } from '../../../src/v3/sim/game';
import type { CardId } from '../../../src/v3/data/abilities';
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
  /** How the run was set up, as its log has it: what a mirrored bot run
   *  copies (the seed, the Armory upgrades in use, the Test Lab card's
   *  setup, or none for a campaign run), and the cards picked. */
  setup: Pick<PlayLog, 'seed' | 'armory' | 'firstWave' | 'lab' | 'encounters' | 'convoy' | 'tempo' | 'freePlay'>;
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
    out.push({ ...compact(measure(l, 'you')), kind, setup });
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
export function mirrorRun(you: PlayerRun, persona: string, dice: number, picks = true): RunMeasure {
  const p = PERSONAS[persona];
  if (!p) throw new Error(`no persona ${persona}`);
  const st = you.setup;
  const run = new BotRun(you.map as MapId, st.seed, {
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
  if (out) writeFileSync(out, `${JSON.stringify({ about: head, columns, perMap }, null, 1)}\n`);
}

if (!process.env.V3_FIT_IMPORT) main();
