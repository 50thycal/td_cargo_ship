// Measures every campaign map as it plays today, for the map rebuild round
// (docs/design/v3-maps-rebuild.md): each map from wave 1 to the end of its
// three-run ending, a few seeds a map, and writes the results file the review
// page and the plan doc read (`measured-<date>.json` beside this file).
//
// Two setups, because the maps were tuned against an Armory that fills as
// the campaign goes (docs/design/v3-maps-build.md, "The Armory fills up by
// about map 10"):
// - empty: the reaction-time bots (sharp, average, casual) with no Armory,
//   as `tools/v3/special-events/measure.mts --campaign` and the sweep play;
// - campaign: the persona fitted to the player's own playtests ("you",
//   sim/mimic.ts) and the average bot, with the Armory a player has about
//   then: one upgrade in each bay, at level 5 × (slot − 1) / 9 (0 on map 1,
//   full from map 10), taking the first or second upgrade of each bay seed by
//   seed.
//
// Usage: npx vite-node tools/v3/maps-rebuild/measure.mts -- [seeds=6] [--maps=a,b] [--out=file.json]

import { writeFileSync } from 'node:fs';
import { ARMORY_MAX, BAY_ORDER, bayItems, type ArmoryLevels } from '../../../src/v3/data/armory';
import { ABILITY_ORDER, type AbilityId } from '../../../src/v3/data/abilities';
import { MAP_ORDER, type MapId } from '../../../src/v3/data/maps';
import { runBot, SKILLS } from '../../../src/v3/sim/bot';
import { playMimic } from '../../../src/v3/sim/mimic';
import { RULES } from '../../../src/v3/data/config';
import { makeRng } from '../../../src/sim/rng';

const args = process.argv.slice(2);
const seeds = Number(args.find((a) => /^\d+$/.test(a)) ?? 6);
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const maps = (opt('maps')?.split(',') ?? MAP_ORDER) as MapId[];
const out = opt('out') ?? new URL(`./measured-${new Date().toISOString().slice(0, 10)}.json`, import.meta.url).pathname;

const taste = (seed: number): AbilityId[] => makeRng(seed ^ 0x7a57e).shuffle([...ABILITY_ORDER]);

/** The Armory a player has on reaching this slot (see the header). */
export function campaignArmory(slot: number, pick: number): ArmoryLevels {
  const level = Math.round((ARMORY_MAX * Math.min(1, (slot - 1) / 9)));
  if (level <= 0) return {};
  const a: ArmoryLevels = {};
  for (const bay of BAY_ORDER) {
    const items = bayItems(bay);
    a[items[pick % items.length]] = level;
  }
  return a;
}

interface Tally {
  /** Runs played. */
  n: number;
  /** Got through the ten normal waves. */
  through: number;
  /** Won the map (the ending's last run held). */
  won: number;
  /** Ships lost a run (of the six it may lose), and the wave it ended on. */
  lost: number;
  wave: number;
}
const tally = (): Tally => ({ n: 0, through: 0, won: 0, lost: 0, wave: 0 });
const add = (t: Tally, r: { won: boolean; wavesCleared: number; lost: number; wave: number }) => {
  t.n += 1;
  if (r.wavesCleared >= RULES.wavesToClear) t.through += 1;
  if (r.won) t.won += 1;
  t.lost += r.lost;
  t.wave += r.wave;
};
const pct = (k: number, n: number) => Math.round((100 * k) / Math.max(1, n));
const fin = (t: Tally) => ({ runs: t.n, through10: pct(t.through, t.n), won: pct(t.won, t.n), lost: +(t.lost / Math.max(1, t.n)).toFixed(1), wave: +(t.wave / Math.max(1, t.n)).toFixed(1) });

const result: Record<string, unknown> = {};
for (const map of maps) {
  const slot = MAP_ORDER.indexOf(map) + 1;
  const empty: Record<string, Tally> = { sharp: tally(), average: tally(), casual: tally() };
  const camp: Record<string, Tally> = { you: tally(), average: tally() };
  for (let i = 0; i < seeds; i++) {
    const seed = 1000 + i;
    for (const skill of Object.keys(empty)) add(empty[skill], runBot(map, seed, { ...SKILLS[skill], prefer: taste(seed) }, { flow: 2 }));
    const armory = campaignArmory(slot, i);
    add(camp.average, runBot(map, seed, { ...SKILLS.average, prefer: taste(seed) }, { flow: 2, armory }));
    const g = playMimic(map, seed, { armory }).game;
    add(camp.you, { won: g.cleared, wavesCleared: g.history.filter((h) => h.outcome === 'cleared').length, lost: g.lost, wave: g.wave });
  }
  result[map] = {
    slot,
    armoryLevel: Math.round(ARMORY_MAX * Math.min(1, (slot - 1) / 9)),
    empty: Object.fromEntries(Object.entries(empty).map(([k, t]) => [k, fin(t)])),
    campaign: Object.fromEntries(Object.entries(camp).map(([k, t]) => [k, fin(t)])),
  };
  const r = result[map] as { empty: Record<string, { won: number }>; campaign: Record<string, { won: number }> };
  console.log(`${map.padEnd(12)} empty: sharp ${r.empty.sharp.won}% average ${r.empty.average.won}% casual ${r.empty.casual.won}%   campaign Armory: you ${r.campaign.you.won}% average ${r.campaign.average.won}%`);
}
writeFileSync(out, JSON.stringify({
  date: new Date().toISOString().slice(0, 10),
  seeds,
  how: 'Each map from wave 1 through its three-run ending (the map is won when its last run holds), flow 2. "through10": got through the ten normal waves. "empty": the reaction-time bots, no Armory. "campaign": the persona fitted to the player\'s playtests ("you") and the average bot, with one upgrade in each bay at level 5 × (slot − 1) / 9.',
  maps: result,
}, null, 1) + '\n');
console.log(`wrote ${out}`);
