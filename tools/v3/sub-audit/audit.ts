// Round 12's torpedo sub audit (docs/design/v3-playtest-fixes.md, Round 12):
//   npx vite-node tools/v3/sub-audit/audit.ts [-- --all]
// For every map, every place a torpedo sub can surface: the map's sub spots
// (foes.ts subSpot, any wave's sub) and, on a map whose boss is the Wolf
// Pack, the open water its packs pick from (events.ts openWaterSpots).
// Each is checked as the game checks it (foes.ts subSite): the sub's whole
// shadow, and a margin round it, on open water (subClear), and a torpedo
// line over open water to at least SUB_SIGHT of nine points down a lane
// (subLaneSight). Prints the bad ones (--all: every one). Exits 1 if a
// map's sub spot is bad. tests/v3/round12.test.ts holds the same line.
//   --play=N  also plays N seeds of each chapter 2 map (the "you" bot, the
//             player's Armory, every wave) and checks every torpedo sub that
//             surfaced, wherever it came from (a wave, an encounter, a boss
//             round): `--maps=island,behemoth` to choose the maps.
import { MAPS, MAP_ORDER, chapterOf } from '../../../src/v3/data/maps';
import { EVENT_MAPS } from '../../../src/v3/data/events';
import { createGame } from '../../../src/v3/sim/game';
import { SUB_ROOM, SUB_SIGHT, onLand, subClear, subLaneSight } from '../../../src/v3/sim/foes';
import { openWaterSpots } from '../../../src/v3/sim/events';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import { PLAYER_ARMORY } from '../bot-fit/measure';
import type { MapId } from '../../../src/v3/data/maps';

const all = process.argv.includes('--all');
let bad = 0;
for (const id of MAP_ORDER) {
  const g = createGame(id, 1, 1);
  const rows: string[] = [];
  const check = (p: { x: number; y: number }, from: string, counts: boolean) => {
    const land = onLand(g, p.x, p.y);
    const clear = subClear(g, p);
    const sight = subLaneSight(g, p);
    const ok = !land && clear && sight >= SUB_SIGHT;
    if (!ok && counts) bad += 1;
    const where = land ? 'on land' : clear ? 'clear' : `land under its shadow (+${SUB_ROOM.margin} px)`;
    if (!ok || all) rows.push(`  ${ok ? 'ok ' : 'BAD'} ${from} (${p.x}, ${p.y}): ${where}, torpedo line to ${sight}/9 of a lane`);
  };
  for (const p of g.map.subSpots) check(p, 'sub spot', true);
  if (EVENT_MAPS[id] === 'wolf-pack') {
    const spots = new Set(g.map.subSpots.map((p) => `${p.x},${p.y}`));
    for (const p of openWaterSpots(g)) if (!spots.has(`${p.x},${p.y}`)) check(p, 'pack water', false);
  }
  console.log(`${id} (chapter ${chapterOf(id)}, ${MAPS[id].name}): ${g.map.subSpots.length} sub spots`);
  for (const r of rows) console.log(r);
}
console.log(bad ? `${bad} bad sub spot(s)` : 'every sub spot is good');

const opt = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const plays = Number(opt('play') ?? 0);
if (plays > 0) {
  const maps = (opt('maps')?.split(',') ?? ['island', 'behemoth', 'needle', 'archipelago', 'saltgate']) as MapId[];
  for (const map of maps) {
    const card = labCard(mapCardId(map, VERSION_DEFAULT))!;
    const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
    const seen = new Map<string, { n: number; waves: Set<number>; ok: boolean; why: string }>();
    let subs = 0;
    for (let k = 0; k < plays; k++) {
      const run = new BotRun(map, 900 + k, { persona: PERSONAS.you, armory: PLAYER_ARMORY, lab: plan.lab, ...(plan.convoy ? { convoy: plan.convoy } : {}), ...(plan.encounters ? { encounters: plan.encounters } : {}) });
      const g = run.game;
      g.tempo = { ...g.tempo, lossLimit: 999 };
      g.carrierHp = g.stats.carrierHp = 1e6;
      const done = new Set<number>();
      while (!run.done) {
        run.advance(1);
        for (const t of g.threats) {
          if (t.kind !== 'torpedoSub' || done.has(t.id)) continue;
          done.add(t.id);
          subs += 1;
          const key = `${Math.round(t.x)},${Math.round(t.y)}`;
          const e = seen.get(key) ?? { n: 0, waves: new Set<number>(), ok: subClear(g, t) && subLaneSight(g, t) >= SUB_SIGHT, why: `${subClear(g, t) ? 'clear' : 'land under its shadow'}, line to ${subLaneSight(g, t)}/9` };
          e.n += 1;
          e.waves.add(g.wave);
          seen.set(key, e);
        }
      }
    }
    const badSeen = [...seen.values()].filter((e) => !e.ok).reduce((x, e) => x + e.n, 0);
    console.log(`${map}: ${subs} torpedo subs over ${plays} seeds, ${badSeen} at a bad site`);
    for (const [key, e] of [...seen].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${e.ok ? 'ok ' : 'BAD'} (${key}) x${e.n}, waves ${[...e.waves].sort((a, b) => a - b).join(' ')}: ${e.why}`);
  }
}
process.exit(bad ? 1 : 0);
