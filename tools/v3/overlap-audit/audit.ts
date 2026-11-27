// Overlap audit (log v73, docs/design/v3-playtest-fixes.md, "Trucks that
// overlap"): the bot plays every map (the map's Test Lab card on its
// production setup, the "you" bot, the player's Armory, as the bot report
// does) and every sim step records which pairs of ground launchers are drawn
// on top of each other: trucks (pop-up, runner, parade, Rocket Truck) as the
// oriented rectangles they are drawn as (src/v3/sim/overlap.ts), and, in a
// second column, a truck on top of a fixed launcher (a shore pad, a siege
// gun). A pair counts once it has sunk in by 4 px or more and then for the
// seconds it stays so; "sustained" is more than 0.5 s ("a short moment" is
// two trucks passing in a crossing).
//
//   npx vite-node tools/v3/overlap-audit/audit.ts -- [--seeds=8] [--from=900] [--maps=coves,delta]
//        [--json=out.json] [--list] [--off]
//   (--off plays the game without the trucks' lanes, as before log v73;
//   --list prints every sustained event: map, seed, wave, the two trucks, where, how long)
//
// The warning-card half of the audit (a notification on top of an enemy
// launcher) is measured in a browser: tools/v3/overlap-audit/cards.mjs.

import { writeFileSync } from 'node:fs';
import { PLAYER_ARMORY } from '../bot-fit/measure';
import { MAP_ORDER, type MapId } from '../../../src/v3/data/maps';
import { playReportRun } from '../../../src/v3/sim/mapReportPlay';
import { OverlapWatch, type OverlapEvent } from '../../../src/v3/sim/overlap';
import { SIM_DT } from '../../../src/v3/sim/playlog';
import { LANES } from '../../../src/v3/sim/trucks';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const seeds = Number(opt('seeds') ?? 8);
const from = Number(opt('from') ?? 900);
const maps = (opt('maps') ? opt('maps')!.split(',') : MAP_ORDER) as MapId[];
if (args.includes('--off')) LANES.on = false;

export interface MapRow {
  map: MapId;
  runs: number;
  /** Seconds with two or more trucks on screen, over all runs. */
  crowded: number;
  trucks: number;
  /** Sustained overlaps (> 0.5 s) between two trucks, their seconds, the deepest. */
  events: number;
  secs: number;
  depth: number;
  /** Runs with at least one. */
  runsHit: number;
  /** A truck on a fixed launcher (sustained, 10 px or deeper). */
  onPad: number;
  /** Runs that hit the sim's 40-minute guard without ending. */
  stalled: number;
  pairs: Record<string, number>;
}

const rows: MapRow[] = [];
const all: (OverlapEvent & { map: MapId; seed: number })[] = [];
for (const map of maps) {
  const row: MapRow = { map, runs: 0, crowded: 0, trucks: 0, events: 0, secs: 0, depth: 0, runsHit: 0, onPad: 0, stalled: 0, pairs: {} };
  for (let seed = from; seed < from + seeds; seed++) {
    const watch = new OverlapWatch(SIM_DT);
    let phase = '';
    playReportRun(map, seed, {
      armory: PLAYER_ARMORY,
      onStep: (g) => {
        watch.observe(g);
        phase = g.phase;
      },
    });
    // A run that never ends (a truck waiting for ever) is a stall.
    if (phase !== 'won' && phase !== 'lost') row.stalled += 1;
    watch.finish();
    row.runs += 1;
    row.crowded += watch.crowded;
    row.trucks += watch.seen.size;
    const sus = watch.sustained;
    if (sus.length) row.runsHit += 1;
    for (const e of sus) {
      row.events += 1;
      row.secs += e.secs;
      row.depth = Math.max(row.depth, e.depth);
      const pk = [e.a, e.b].sort().join('+');
      row.pairs[pk] = (row.pairs[pk] ?? 0) + 1;
      all.push({ ...e, map, seed });
    }
    for (const e of watch.events)
      if (e.fixed && e.secs > 0.5 && e.depth >= 10) {
        row.onPad += 1;
        all.push({ ...e, map, seed });
      }
  }
  rows.push(row);
  console.log(`${map.padEnd(12)} runs ${row.runs}  trucks ${row.trucks}  crowded ${row.crowded.toFixed(0)} s  truck-truck: ${row.events} sustained (${row.secs.toFixed(1)} s, deepest ${row.depth.toFixed(0)} px, ${row.runsHit}/${row.runs} runs)  on a pad ${row.onPad}  stalled ${row.stalled}  ${JSON.stringify(row.pairs)}`);
}
if (args.includes('--list')) for (const e of all) console.log(`${e.map} seed ${e.seed} wave ${e.wave}: ${e.a} + ${e.b}${e.fixed ? ' (on a pad)' : ''} at ${e.x},${e.y} for ${e.secs} s, ${e.depth.toFixed(0)} px deep`);
const out = opt('json');
if (out) writeFileSync(out, `${JSON.stringify({ seeds, from, off: args.includes('--off'), rows, events: all }, null, 1)}\n`);
