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
// Prints one JSON line a run: {cfg, base, mode, map, seed, lost, boats,
// rerolls, normal}: ships lost each wave 1-13; the waves whose first ship
// went to a lifeboat; re-rolls used; and how the run ends under the normal
// loss limit with the lifeboats' half losses counted (won, endWave, and the
// Scrap it banks without and with Salvage Crews 5).

import type { AbilityId } from '../../../src/v3/data/abilities';
import { ABILITY_ORDER } from '../../../src/v3/data/abilities';
import { LIFEBOAT_LOSS, scrapFor, type ArmoryLevels } from '../../../src/v3/data/armory';
import type { MapId } from '../../../src/v3/data/maps';
import { mapPlan } from '../../../src/v3/data/mapPlans';
import { RULES } from '../../../src/v3/data/config';
import type { Game } from '../../../src/v3/sim/game';
import { BOSS_FROM, WAVES, playCombo } from '../combo-sweep/play';
import { PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const MAPS = (opt('maps')?.split(',') ?? ['strait', 'gauntlet', 'harbor', 'kesh', 'marrow']) as MapId[];
const seeds = Array.from({ length: Number(opt('seeds') ?? 12) }, (_, k) => Number(opt('from') ?? 900) + k);
const [part, parts] = (opt('part') ?? '0/1').split('/').map(Number);
const only = opt('only')?.split(',');
const modes = (opt('modes')?.split(',') ?? ['kit', 'self']) as ('kit' | 'self')[];
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

/** The run under the normal loss limit, lifeboats' half losses counted:
 *  6 ships in waves 1-10, 6 more in the boss rounds (the convoy restored). */
function normal(lost: number[], boatWaves: Set<number>): { won: boolean; endWave: number } {
  let count = 0;
  for (let w = 1; w <= WAVES; w++) {
    if (w === BOSS_FROM) count = 0;
    count += lost[w - 1] - (boatWaves.has(w) && lost[w - 1] > 0 ? 1 - LIFEBOAT_LOSS : 0);
    if (count >= RULES.shipLossLimit) return { won: false, endWave: w };
  }
  return { won: true, endWave: 14 };
}

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
          const r = playCombo({ map, seed, armory, persona: 'you', ...(loadout ? { loadout } : {}) }, (g) => {
            if (!game && tweak) tweak(g);
            game = g;
          });
          const g = game as unknown as Game;
          const boatWaves = new Set<number>();
          let prev = 0;
          for (const h of g.history) {
            if ((h.boats ?? 0) > prev) boatWaves.add(h.wave);
            prev = h.boats ?? 0;
          }
          const n = normal(r.lost, boatWaves);
          console.log(
            JSON.stringify({
              cfg,
              base,
              mode,
              map,
              seed,
              lost: r.lost,
              boats: [...boatWaves],
              rerolls: g.stats.rerolls - g.rerolls,
              normal: { ...n, scrap: scrapOf(n.endWave, n.won, 0), scrap5: scrapOf(n.endWave, n.won, 5) },
            }),
          );
        }
    }
