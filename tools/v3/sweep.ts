// V3 balance sweep: plays every map at each bot skill across N seeds and
// prints clear rates, how long a run takes (game minutes at 1×), the salvage
// it earns, how many weapon pickups it took and the share of wave time the
// gun had a weapon loaded. Usage:
//   npm run v3:sweep -- [seeds=12] [--armory=N] [--gun=id] [--no-weapons] [--flow=N] [--skills=a,b] [--focus=id]
// A run takes ONE Armory upgrade (V3 round 1): --armory=N plays with --gun
// (default warhead) at level N (0 = the base gun).
// The bot's favourite weapons are shuffled per seed, so every weapon gets
// drafted across a sweep; --focus=id makes one weapon its first choice.
// --no-weapons: the bot never picks a weapon pickup up (the base gun alone).
// The last block estimates the whole game: clearing all five maps in order
// at each skill, starting from an empty Armory and buying levels with the
// salvage earned along the way.

import { ABILITY_ORDER, type AbilityId } from '../../src/v3/data/abilities';
import { ARMORY_COSTS, ARMORY_MAX, nextCost, salvageFor, type ArmoryId, type ArmoryLevels } from '../../src/v3/data/armory';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { runBot, SKILLS, type BotRun } from '../../src/v3/sim/bot';
import { makeRng } from '../../src/sim/rng';

const args = process.argv.slice(2);
const seeds = Number(args.find((a) => /^\d+$/.test(a)) ?? 12);
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const armoryLevel = Number(opt('armory') ?? 0);
const flow = Number(opt('flow') ?? 2);
const noAbilities = args.includes('--no-weapons') || args.includes('--no-abilities');
const skillNames = (opt('skills') ?? 'sharp,average,casual').split(',');
const focus = opt('focus') as AbilityId | undefined;
const gun = (opt('gun') ?? 'warhead') as ArmoryId;
const armory: ArmoryLevels = armoryLevel > 0 ? { [gun]: armoryLevel } : {};

/** A seed's shuffle of the roster (deterministic), with --focus first. */
function taste(seed: number): AbilityId[] {
  const order = makeRng(seed ^ 0x7a57e).shuffle([...ABILITY_ORDER]);
  return focus ? [focus, ...order.filter((id) => id !== focus)] : order;
}

/** A person also spends time between waves: ~8 s a draft, ~15 s on menus and
 *  the result per run. */
const DRAFT_S = 8;
const RUN_OVERHEAD_S = 15;

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : NaN);
const play = (map: (typeof MAP_ORDER)[number], seed: number, skill: string, a: ArmoryLevels): BotRun =>
  runBot(map, seed, { ...SKILLS[skill], noAbilities, prefer: taste(seed) }, { flow, armory: a });
const realSeconds = (r: BotRun) => r.seconds + r.wavesCleared * DRAFT_S + RUN_OVERHEAD_S;

console.log(`V3 sweep — ${seeds} seeds, flow ${flow}, gun ${armoryLevel ? `${gun} ${armoryLevel}/${ARMORY_MAX}` : 'base'}${noAbilities ? ', NO weapons' : ''}${focus ? `, focus ${focus}` : ''}\n`);
console.log('map          skill     clear%  wave  lost  min/run  salvage  loaded  weapon pickups/run');
for (const map of MAP_ORDER) {
  for (const skill of skillNames) {
    const runs = Array.from({ length: seeds }, (_, i) => play(map, 1000 + i, skill, armory));
    const uses = ABILITY_ORDER.map((id) => [id, avg(runs.map((r) => r.uses[id] ?? 0))] as [AbilityId, number])
      .filter(([, n]) => n > 0)
      .map(([id, n]) => `${id} ${n.toFixed(1)}`)
      .join(', ');
    console.log(
      [
        map.padEnd(12),
        skill.padEnd(8),
        `${Math.round(avg(runs.map((r) => (r.won ? 100 : 0))))}%`.padStart(7),
        avg(runs.map((r) => r.wave)).toFixed(1).padStart(5),
        avg(runs.map((r) => r.lost)).toFixed(1).padStart(5),
        (avg(runs.map(realSeconds)) / 60).toFixed(1).padStart(8),
        Math.round(avg(runs.map((r) => salvageFor(r, false)))).toString().padStart(8),
        `${Math.round(avg(runs.map((r) => r.loaded)) * 100)}%`.padStart(7),
        ` ${uses}`,
      ].join(' '),
    );
  }
}

// The whole game, played the way a person would: maps in order, retrying a
// map until it is cleared, putting salvage into one Armory upgrade (--gun)
// after every run and taking it into each run. Capped at 60 runs a skill.
const ONE_GUN = ARMORY_COSTS.reduce((s, c) => s + c, 0);
console.log(`\nWhole game (all ${MAP_ORDER.length} maps cleared, from an empty Armory, investing in ${gun}; ${ONE_GUN} salvage maxes it):`);
for (const skill of skillNames) {
  const a: ArmoryLevels = {};
  let bank = 0;
  let seconds = 0;
  let runs = 0;
  let seed = 5000;
  const cleared: string[] = [];
  for (const map of MAP_ORDER) {
    let first = true;
    for (;;) {
      if (runs >= 60) break;
      const r = play(map, seed++, skill, a);
      runs++;
      seconds += realSeconds(r);
      bank += salvageFor(r, r.won && first);
      for (let c = nextCost(a, gun); c !== null && c <= bank; c = nextCost(a, gun)) {
        bank -= c;
        a[gun] = (a[gun] ?? 0) + 1;
      }
      if (r.won) {
        first = false;
        cleared.push(`${map} in ${runs}`);
        break;
      }
    }
    if (runs >= 60) break;
  }
  console.log(`  ${skill.padEnd(8)} ${(seconds / 3600).toFixed(1)} h, ${runs} runs, ${gun} ${a[gun] ?? 0}/${ARMORY_MAX} — ${cleared.join(', ') || 'nothing cleared'}`);
}
