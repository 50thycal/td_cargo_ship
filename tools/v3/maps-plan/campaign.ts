// The 20-map campaign, played the way the plan's playtime model assumes: maps
// in order, retrying a map until it is cleared, Armory cards won at random
// after every run (the best card of each bay equipped). Prints the average
// tries each map took over several campaigns, against the plan's targets
// (1–2 tries early, 3–4 late, never more than ~5), and the hours it took.
//
//   npx vite-node tools/v3/maps-plan/campaign.ts -- [campaigns=6] [skill=average] [--calibrate] [--maps=a,b]
//
// --calibrate: for each map, the threat scale that would bring its clear
// rate to the target, at the Armory a player has when they reach it.

import { ABILITY_ORDER, type AbilityId } from '../../../src/v3/data/abilities';
import { ARMORY, BAY_ORDER, bayItems, cardsFor, drawCards, type ArmoryId, type ArmoryLevels } from '../../../src/v3/data/armory';
import { MAPS, MAP_ORDER, type MapId } from '../../../src/v3/data/maps';
import { runBot, SKILLS, type BotRun } from '../../../src/v3/sim/bot';
import { playMimic } from '../../../src/v3/sim/mimic';
import { makeRng } from '../../../src/sim/rng';

const args = process.argv.slice(2);
const campaigns = Number(args.find((a) => /^\d+$/.test(a)) ?? 6);
// --you: the persona fitted to the player's own playtests (sim/mimic.ts),
// much nearer a real person than the reaction-time bots.
const you = args.includes('--you');
const skill = you ? 'you' : args.find((a) => a in SKILLS) ?? 'average';
const calibrate = args.includes('--calibrate');
const onlyMaps = args.find((a) => a.startsWith('--maps='))?.split('=')[1]?.split(',') as MapId[] | undefined;
const CAP = 8;

/** The plan's tries per slot (docs/design/v3-maps-plan.md), as a target clear rate. */
export function targetTries(slot: number): number {
  if (slot <= 2) return 1.1;
  if (slot <= 5) return 1.6;
  if (slot <= 10) return 2.1;
  if (slot <= 15) return 2.7;
  return 3.4;
}

const DRAFT_S = 8;
const RUN_OVERHEAD_S = 15;
const realSeconds = (r: Pick<BotRun, 'seconds' | 'wavesCleared'>) => r.seconds + r.wavesCleared * DRAFT_S + RUN_OVERHEAD_S;

function taste(seed: number): AbilityId[] {
  return makeRng(seed ^ 0x7a57e).shuffle([...ABILITY_ORDER]);
}

type Run = Pick<BotRun, 'won' | 'wavesCleared' | 'seconds'>;
const play = (map: MapId, seed: number, a: ArmoryLevels): Run => {
  if (!you) return runBot(map, seed, { ...SKILLS[skill], prefer: taste(seed) }, { flow: 2, armory: a });
  const g = playMimic(map, seed, { armory: a }).game;
  return { won: g.cleared, wavesCleared: g.history.filter((h) => h.outcome === 'cleared').length, seconds: Math.round(g.t) };
};

function loadout(owned: ArmoryLevels): ArmoryLevels {
  const a: ArmoryLevels = {};
  for (const bay of BAY_ORDER) {
    const best = bayItems(bay)
      .filter((id) => (owned[id] ?? 0) > 0)
      .sort((x, y) => (owned[y] ?? 0) - (owned[x] ?? 0))[0];
    if (best) a[best] = owned[best];
  }
  return a;
}

const tries: Record<string, number[]> = {};
const kits: Record<string, ArmoryLevels[]> = {};
const hours: number[] = [];
for (let c = 0; c < campaigns; c++) {
  const owned: ArmoryLevels = {};
  const rng = makeRng(0xa4e0 + c * 7919);
  let seed = 5000 + c * 1000;
  let seconds = 0;
  for (const map of MAP_ORDER) {
    (kits[map] ??= []).push(loadout(owned));
    let n = 0;
    let first = true;
    for (;;) {
      const r = play(map, seed++, loadout(owned));
      n++;
      seconds += realSeconds(r);
      drawCards(owned, cardsFor({ wavesCleared: r.wavesCleared, cleared: r.won }, r.won && first), (k) => rng.int(k));
      if (r.won) first = false;
      if (r.won || n >= CAP) break;
    }
    (tries[map] ??= []).push(n);
  }
  hours.push(seconds / 3600);
}

const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
console.log(`Campaign — ${campaigns} campaigns, ${skill} bot (a map not cleared in ${CAP} tries counts ${CAP})\n`);
console.log('slot map           scale  tries  target  armory on arrival');
MAP_ORDER.forEach((map, i) => {
  const kit = kits[map][0];
  const levels = Object.entries(kit).map(([id, lv]) => `${ARMORY[id as ArmoryId].name} ${lv}`).join(', ') || '—';
  const t = avg(tries[map]);
  const flag = t > targetTries(i + 1) * 1.35 ? '  ▲ too hard' : t < targetTries(i + 1) / 1.35 ? '  ▼ too easy' : '';
  console.log(`${String(i + 1).padStart(4)} ${map.padEnd(13)} ${MAPS[map].threatScale.toFixed(2).padStart(5)}  ${t.toFixed(1).padStart(5)}  ${targetTries(i + 1).toFixed(1).padStart(6)}  ${levels}${flag}`);
});
console.log(`\nWhole campaign: ${avg(hours).toFixed(1)} h on average (${Math.min(...hours).toFixed(1)}–${Math.max(...hours).toFixed(1)} h)`);

if (calibrate) {
  // Clear rate against threat scale, at the Armory the first campaign
  // brought to the map; pick the scale whose rate is nearest the target.
  console.log('\nCalibration (clear rate by threat scale, 16 seeds each):');
  for (const map of onlyMaps ?? MAP_ORDER) {
    const slot = MAP_ORDER.indexOf(map) + 1;
    const want = 1 / targetTries(slot);
    const kit = kits[map][Math.floor(campaigns / 2)];
    const base = MAPS[map].threatScale;
    const row: string[] = [];
    let best = base;
    let bestGap = Infinity;
    for (const k of [0.75, 0.85, 0.95, 1.05, 1.15, 1.3, 1.45, 1.6]) {
      MAPS[map].threatScale = Math.round(base * k * 100) / 100;
      let won = 0;
      for (let s = 0; s < 16; s++) won += play(map, 9000 + s, kit).won ? 1 : 0;
      const rate = won / 16;
      row.push(`${MAPS[map].threatScale.toFixed(2)}:${Math.round(rate * 100)}%`);
      if (Math.abs(rate - want) < bestGap) {
        bestGap = Math.abs(rate - want);
        best = MAPS[map].threatScale;
      }
    }
    MAPS[map].threatScale = base;
    console.log(`  ${map.padEnd(13)} want ${Math.round(want * 100)}%  → ${best.toFixed(2)}   ${row.join('  ')}`);
  }
}
