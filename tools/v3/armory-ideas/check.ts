// The lift, re-checked on the real game code (the Armory overhaul build):
// each config is a plain Armory loadout, read by the sim as the game reads
// it (no `set` overrides, no harness refill as in lift.ts). Played like
// lift.ts and the combo sweep's Armory stage (tools/v3/combo-sweep/play.ts):
// every wave played (no loss limit), the "you" bot, on the five chapter 1
// maps, paired with "none" on the same seeds.
//
//   npx vite-node tools/v3/armory-ideas/check.ts -- --set=lift --seeds=12 --part=0/4 [--maps=marrow] > out.jsonl
//   node tools/v3/armory-ideas/check-sum.mjs out*.jsonl > check-results.json
//
// Sets:
//   lift   the three lifted upgrades, references and whole builds, with the
//          map's counter kit (lift.ts's mode), seeds 900..
//   drops  Supply Lines alone at level 5 against none, more seeds, both with
//          the counter kit ("kit") and with the bot drafting for itself
//          ("self"): the review asked to measure it again.
//   mash   Quick Reload 5 with Deep Magazine 5 (now in different bays, so
//          they can ride together), for the "you" bot and the masher, with
//          the rack at 11 (as built) and at 10.
//
// Prints one JSON line a run: {cfg, mode, persona, map, seed, lost}.

import type { AbilityId } from '../../../src/v3/data/abilities';
import { ABILITY_ORDER } from '../../../src/v3/data/abilities';
import type { ArmoryLevels } from '../../../src/v3/data/armory';
import type { MapId } from '../../../src/v3/data/maps';
import { mapPlan } from '../../../src/v3/data/mapPlans';
import { playCombo } from '../combo-sweep/play';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const MAPS = (opt('maps')?.split(',') ?? ['strait', 'gauntlet', 'harbor', 'kesh', 'marrow']) as MapId[];
const set = opt('set') ?? 'lift';
const seeds = Array.from({ length: Number(opt('seeds') ?? 12) }, (_, k) => Number(opt('from') ?? 900) + k);
const [part, parts] = (opt('part') ?? '0/1').split('/').map(Number);

interface Cfg {
  key: string;
  armory: ArmoryLevels;
  mode: 'kit' | 'self';
  persona?: string;
  /** The rack, set after the run is made (the mash check's 10 rounds). */
  rack?: number;
}

const kitCfgs = (xs: [string, ArmoryLevels][]): Cfg[] => xs.map(([key, armory]) => ({ key, armory, mode: 'kit' }));
const SETS: Record<string, Cfg[]> = {
  lift: kitCfgs([
    ['none', {}],
    ['plating5', { plating: 5 }],
    ['pointdef5', { pointdef: 5 }],
    ['fuse5', { fuse: 5 }],
    ['reload5', { reload: 5 }],
    ['longload5', { longload: 5 }],
    ['stockpile5', { stockpile: 5 }],
    ['magazine5', { magazine: 5 }],
    ['player', { reload: 5, repair: 4, stockpile: 5 }],
    ['top', { warhead: 5, plating: 5, stockpile: 5 }],
  ]),
  drops: [
    ...kitCfgs([
      ['none', {}],
      ['drops5', { drops: 5 }],
    ]),
    { key: 'none', armory: {}, mode: 'self' },
    { key: 'drops5', armory: { drops: 5 }, mode: 'self' },
  ],
  mash: (['you', 'masher'] as const).flatMap((persona): Cfg[] => [
    { key: 'none', armory: {}, mode: 'kit', persona },
    { key: 'reload5', armory: { reload: 5 }, mode: 'kit', persona },
    { key: 'pair11', armory: { reload: 5, magazine: 5 }, mode: 'kit', persona },
    { key: 'pair10', armory: { reload: 5, magazine: 5 }, mode: 'kit', persona, rack: 10 },
  ]),
};

const canon = (ws: AbilityId[]) => [...ws].sort((a, b) => ABILITY_ORDER.indexOf(a) - ABILITY_ORDER.indexOf(b));
const cfgs = SETS[set];
if (!cfgs) throw new Error(`--set=${Object.keys(SETS).join('|')}`);
let i = 0;
for (const c of cfgs)
  for (const map of MAPS)
    for (const seed of seeds) {
      if (i++ % parts !== part) continue;
      const loadout = c.mode === 'kit' ? canon(mapPlan(map)!.counters) : undefined;
      const r = playCombo({ map, seed, armory: c.armory, persona: c.persona ?? 'you', ...(loadout ? { loadout } : {}), ...(c.rack ? { rack: c.rack } : {}) });
      console.log(JSON.stringify({ cfg: c.key, mode: c.mode, persona: c.persona ?? 'you', map, seed, lost: r.lost }));
    }
