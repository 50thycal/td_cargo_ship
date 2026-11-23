// The four new Armory upgrades (Boilers, Lifeboats, Quartermaster, Salvage
// Crews; docs/design/v3-armory-overhaul.md, "The four new upgrades"),
// measured on the real game code as check.ts measures the others: plain
// Armory loadouts, the "you" bot, the five chapter 1 maps, every wave played
// (no loss limit; the normal limit is read off the run, as the combo sweep
// does), paired with level 0 on the same seeds.
//
//   npx vite-node tools/v3/armory-ideas/new-upgrades.ts -- --seeds=12 --part=0/4 > out.jsonl
//   node tools/v3/armory-ideas/new-sum.mjs out*.jsonl > new-results.json
//
// Two bases, each with and without the card:
//   alone   the card alone against no Armory (the yardstick the other
//           upgrades' 5-8 ships saved were measured on);
//   player  on top of the player's Armory (PLAYER_ARMORY: Quick Reload 5,
//           Damage Control 4, Stockpile 5; the sim does not enforce one card
//           a bay, so this is the card's own lift on that build).
// And two ways to draft:
//   kit     the map's counter kit, forced (check.ts's mode). A forced draft
//           replaces the hand, so Quartermaster does nothing here;
//   self    the bot drafts for itself (and re-rolls a hand with nothing it
//           wants: mimic.ts `wantsReroll`).
//
//   normal  (log 44, the reworked Lifeboats and Quartermaster) the bot drafts
//           for itself under the REAL rules: the normal loss limit and a
//           carrier that can sink, so a run ends where the game ends it.
//           Lifeboats' carrier mend and extra lives, and Quartermaster's
//           golden bomb, only show here (a tough run has no limit to save
//           a life against and a carrier that can't sink). Its `lost` is
//           the ships lost up to the end, not a whole run's: read `won` and
//           `endWave`, not ships saved.
//
// Prints one JSON line a run: {cfg, base, mode, map, seed, lost, rerolls,
// lives, bomb, free, normal}: ships lost each wave 1-13; re-rolls used; the
// extra lives taken (Lifeboats: the start's and the draft's cards); the wave
// the golden bomb went off (0: never); free level-ups used; and how the run
// ends under the normal loss limit (a tough run's read off its losses, with
// its extra lives; a normal run's as played): won, endWave, and the Scrap it
// banks without and with Salvage Crews 5.

import type { AbilityId } from '../../../src/v3/data/abilities';
import { ABILITY_ORDER } from '../../../src/v3/data/abilities';
import { scrapFor, type ArmoryLevels } from '../../../src/v3/data/armory';
import type { MapId } from '../../../src/v3/data/maps';
import { mapPlan } from '../../../src/v3/data/mapPlans';
import { RULES } from '../../../src/v3/data/config';
import type { Game } from '../../../src/v3/sim/game';
import { WAVES, normalOf, playCombo } from '../combo-sweep/play';
import { PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const MAPS = (opt('maps')?.split(',') ?? ['strait', 'gauntlet', 'harbor', 'kesh', 'marrow']) as MapId[];
const seeds = Array.from({ length: Number(opt('seeds') ?? 12) }, (_, k) => Number(opt('from') ?? 900) + k);
const [part, parts] = (opt('part') ?? '0/1').split('/').map(Number);
const only = opt('only')?.split(',');
const modes = (opt('modes')?.split(',') ?? ['kit', 'self']) as ('kit' | 'self' | 'normal')[];
const bases = (opt('bases')?.split(',') ?? ['alone', 'player']) as ('alone' | 'player')[];
const lv = Number(opt('level') ?? 5);
/** Extra what-ifs: a card's numbers set after the run is made (a tuning
 *  try; the game's own numbers are the plain configs). */
const TRIES: [string, ArmoryLevels, (g: Game) => void][] = [
  ['boilers30', { boilers: 5 }, (g) => (g.stats = { ...g.stats, convoySpeed: 1.3 })],
  ['boilers50', { boilers: 5 }, (g) => (g.stats = { ...g.stats, convoySpeed: 1.5 })],
  ['qm6', { quartermaster: 5 }, (g) => ((g.stats = { ...g.stats, rerolls: 6 }), (g.rerolls = 6))],
  ['qm10', { quartermaster: 5 }, (g) => ((g.stats = { ...g.stats, rerolls: 10 }), (g.rerolls = 10))],
  ['qm5cards', { quartermaster: 5 }, (g) => (g.stats = { ...g.stats, draftCards: 5 })],
];

const CARDS: [string, ArmoryLevels, ((g: Game) => void)?][] = [
  ['none', {}],
  ['boilers', { boilers: lv }],
  ['lifeboats', { lifeboats: lv }],
  ['quartermaster', { quartermaster: lv }],
  ['salvage', { salvage: lv }],
  ...TRIES,
];
const BASE: Record<string, ArmoryLevels> = { alone: {}, player: PLAYER_ARMORY };


/** The Scrap a run banks (no first clear, no repeat cards): the waves and
 *  boss rounds it cleared under the normal limit, and the clear. */
function scrapOf(endWave: number, won: boolean, salvage: number): number {
  const cleared = Math.min(endWave - 1, WAVES);
  const t = { waves: Math.min(cleared, RULES.wavesToClear), boss: Math.max(0, cleared - RULES.wavesToClear) };
  return scrapFor(t, won, false, 0, salvage).total;
}

const canon = (ws: AbilityId[]) => [...ws].sort((a, b) => ABILITY_ORDER.indexOf(a) - ABILITY_ORDER.indexOf(b));
let i = 0;
for (const base of bases)
  for (const mode of modes)
    for (const [cfg, card, tweak] of CARDS) {
      if (only ? !only.includes(cfg) : TRIES.some(([k]) => k === cfg)) continue;
      for (const map of MAPS)
        for (const seed of seeds) {
          if (i++ % parts !== part) continue;
          const armory = { ...BASE[base], ...card };
          const loadout = mode === 'kit' ? canon(mapPlan(map)!.counters) : undefined;
          let game: Game | null = null;
          let bomb = 0;
          const r = playCombo({ map, seed, armory, persona: 'you', ...(loadout ? { loadout } : {}), ...(mode === 'normal' ? { normal: true } : {}) }, (g) => {
            if (!game && tweak) tweak(g);
            game = g;
            if (!bomb && g.bombsLeft < g.stats.goldBombs) bomb = g.wave;
          });
          const g = game as unknown as Game;
          // A tough run's ending under the normal limit, its extra lives
          // added to the limit; a normal run's as it was played.
          const n = mode === 'normal' ? { won: !!r.won, endWave: r.endWave ?? 14 } : normalOf(r.lost, RULES.shipLossLimit + g.extraLives);
          console.log(
            JSON.stringify({
              cfg,
              base,
              mode,
              map,
              seed,
              lost: r.lost,
              rerolls: g.stats.rerolls - g.rerolls,
              lives: g.extraLives,
              bomb,
              free: g.stats.freeLevels - g.freeLevelsLeft,
              normal: { won: n.won, endWave: n.endWave, scrap: scrapOf(n.endWave, n.won, 0), scrap5: scrapOf(n.endWave, n.won, 5) },
            }),
          );
        }
    }
