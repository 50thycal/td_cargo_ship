// The short-term lift (docs/design/v3-armory-overhaul.md): the weak Armory
// upgrades at their level-5 numbers now and at candidate numbers, each alone
// with the map's counter kit, played as the combo sweep's Armory stage plays
// them (tools/v3/combo-sweep/play.ts), on the same seeds as "No Armory".
//
// A candidate is a level-5 upgrade with some of the run's Armory numbers
// replaced (`g.stats`) right after the run is made, so no game code changes
// to try one. Every number tried here is read live by the sim (the reload
// clock, a pickup's load time, the power-up drop chance and power-up timers).
//
//   npx vite-node tools/v3/armory-ideas/lift.ts -- --seeds=12 --part=0/4 > out.jsonl
//
// Prints one JSON line a run: {cfg, map, seed, lost}.

import { ABILITY_ORDER, type AbilityId } from '../../../src/v3/data/abilities';
import { armoryStats, type ArmoryLevels, type ArmoryStats } from '../../../src/v3/data/armory';
import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import type { MapId } from '../../../src/v3/data/maps';
import { mapPlan } from '../../../src/v3/data/mapPlans';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import type { CardId } from '../../../src/v3/data/abilities';
import { pickPlan, WAVES } from '../combo-sweep/play';
import { CANDIDATES } from './candidates.mjs';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const MAPS: MapId[] = ['strait', 'gauntlet', 'harbor', 'kesh', 'marrow'];
const seeds = Array.from({ length: Number(opt('seeds') ?? 12) }, (_, k) => 900 + k);
const [part, parts] = (opt('part') ?? '0/1').split('/').map(Number);
const only = opt('only')?.split(',');

interface Cand {
  key: string;
  armory: ArmoryLevels;
  /** Stats replaced after the run is made. */
  set?: Partial<ArmoryStats>;
  /** A proposed rule tried from the harness: every weapon pickup (a weapon
   *  or a boost) also refills the rack. Read off `g.uses`, which counts them. */
  refill?: boolean;
}

const canon = (ws: AbilityId[]) => [...ws].sort((a, b) => ABILITY_ORDER.indexOf(a) - ABILITY_ORDER.indexOf(b));

function play(c: Cand, map: MapId, seed: number): number[] {
  const card = labCard(mapCardId(map, VERSION_DEFAULT));
  if (!card) throw new Error(`no card for ${map}`);
  const setup = defaultSetup(card, parseLabProgress(null));
  const plan = labRunPlan(card, setup, null);
  const run = new BotRun(map, seed, {
    persona: PERSONAS.you,
    armory: c.armory,
    lab: plan.lab,
    ...(plan.convoy ? { convoy: plan.convoy } : {}),
    ...(plan.encounters ? { encounters: plan.encounters } : {}),
  });
  const g = run.game;
  if (c.set) {
    // Only numbers read live; the rack (read once at the start) is not one.
    const want = { ...armoryStats(c.armory), ...c.set };
    Object.assign(g.stats, c.set);
    if (g.stats.reload !== want.reload) throw new Error('reload not set');
  }
  g.tempo = { ...g.tempo, lossLimit: 999 };
  g.carrierHp = g.stats.carrierHp = 1e6;
  const forced = pickPlan(canon(mapPlan(map)!.counters));
  let next = 0;
  const used = () => Object.values(g.uses).reduce((a: number, b) => a + (b ?? 0), 0);
  let uses = used();
  while (!run.done) {
    if (g.phase === 'draft') {
      const id: CardId = next < forced.length ? forced[next++] : 'resupply';
      g.offer = [id];
      run.rec.pick(id);
      continue;
    }
    run.advance(1);
    if (c.refill) {
      const u = used();
      if (u > uses) g.ammo = g.stats.rack;
      uses = u;
    }
  }
  const lost = new Array<number>(WAVES).fill(0);
  let prev = 0;
  for (const h of g.history) {
    if (h.wave >= 1 && h.wave <= WAVES) lost[h.wave - 1] += h.lost - prev;
    prev = h.lost;
  }
  return lost;
}

const jobs: { c: Cand; map: MapId; seed: number }[] = [];
for (const c of CANDIDATES as Cand[]) if (!only || only.includes(c.key)) for (const map of MAPS) for (const seed of seeds) jobs.push({ c, map, seed });
jobs.forEach((j, i) => {
  if (i % parts !== part) return;
  const lost = play(j.c, j.map, j.seed);
  console.log(JSON.stringify({ cfg: j.c.key, map: j.map, seed: j.seed, lost }));
});
