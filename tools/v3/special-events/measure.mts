// Measures each special event with the bots: every event on its own map,
// started at its wave (11, with ten waves of drafts handed over, as a
// `?wave=11` start does), over N seeds, for each bot skill. Prints the
// Clean / Held / Broken rates and the ships lost in the event, as the table
// in docs/design/v3-special-events-build.md.
// Usage: npx tsx tools/v3/special-events/measure.mts [seeds=20] [--skills=sharp,average] [--only=id,id] [--md] [--campaign]
import { ABILITY_ORDER, type AbilityId } from '../../../src/v3/data/abilities';
import { EVENTS, EVENT_ORDER, EVENT_WAVE, eventMap, type EventId } from '../../../src/v3/data/events';
import { MAPS } from '../../../src/v3/data/maps';
import { Bot, SKILLS } from '../../../src/v3/sim/bot';
import { createGame, step } from '../../../src/v3/sim/game';
import type { EventRecord } from '../../../src/v3/sim/events';
import { makeRng } from '../../../src/sim/rng';

const args = process.argv.slice(2);
const seeds = Number(args.find((a) => /^\d+$/.test(a)) ?? 20);
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const skills = (opt('skills') ?? 'sharp,average').split(',');
const only = opt('only')?.split(',') as EventId[] | undefined;
const md = args.includes('--md');
/** The convoy's flow (the sweep plays at 2: more ships than the default 1). */
const flow = Number(opt('flow') ?? 2);

/** A seed's shuffle of the roster (as the sweep's), so every weapon gets
 *  drafted across the seeds. */
const taste = (seed: number): AbilityId[] => makeRng(seed ^ 0x7a57e).shuffle([...ABILITY_ORDER]);

/** One event run: the game at its wave, held back WARM s so the convoy is
 *  on the water as it is in the campaign (ten waves in, ships are always
 *  under way), then played by the bot to the end. */
const WARM = 45;
function play(map: ReturnType<typeof eventMap>, seed: number, skill: string): EventRecord | undefined {
  const g = createGame(map, seed, EVENT_WAVE);
  if (g.event) g.event.t0 = WARM;
  g.flow = flow;
  const bot = new Bot({ ...SKILLS[skill], prefer: taste(seed) }, seed);
  for (let i = 0; i < 30 * 200 && g.phase === 'wave'; i++) {
    bot.act(g);
    step(g, 1 / 30);
  }
  return g.eventLog.find((x) => x.outcome !== 'rerun');
}

const pct = (n: number, d: number) => `${Math.round((100 * n) / Math.max(1, d))}%`;
const rows: string[] = [];
if (md) {
  rows.push(`| Event | Map | Bot | Clean | Held | Broken | Ships lost (avg) | Seconds (avg) |`);
  rows.push('|---|---|---|---|---|---|---|---|');
} else if (!args.includes('--campaign')) console.log(`Special events, ${seeds} seeds each, from wave ${EVENT_WAVE}, flow ${flow}\n`);
for (const id of args.includes('--campaign') ? [] : (only ?? EVENT_ORDER)) {
  const map = eventMap(id);
  for (const skill of skills) {
    const out = { clean: 0, held: 0, broken: 0, lost: 0, secs: 0, n: 0, shots: 0, decoy: 0 };
    for (let i = 0; i < seeds; i++) {
      const e = play(map, 2000 + i, skill);
      if (!e) continue;
      out.n += 1;
      out[e.outcome as 'clean' | 'held' | 'broken'] += 1;
      out.lost += e.lost;
      out.secs += e.seconds;
      out.shots += e.shots;
      out.decoy += e.decoyShots ?? 0;
    }
    const extra = id === 'decoy-storm' ? ` · ${pct(out.decoy, out.shots)} of shots at decoys` : '';
    if (md) rows.push(`| ${EVENTS[id].name} | ${MAPS[map].name} | ${skill} | ${pct(out.clean, out.n)} | ${pct(out.held, out.n)} | ${pct(out.broken, out.n)} | ${(out.lost / Math.max(1, out.n)).toFixed(2)} | ${Math.round(out.secs / Math.max(1, out.n))} |`);
    else console.log(`${EVENTS[id].name.padEnd(18)} ${map.padEnd(12)} ${skill.padEnd(8)} clean ${pct(out.clean, out.n).padStart(4)}  held ${pct(out.held, out.n).padStart(4)}  broken ${pct(out.broken, out.n).padStart(4)}  lost ${(out.lost / Math.max(1, out.n)).toFixed(2)}  ${Math.round(out.secs / Math.max(1, out.n))} s  (${out.n} runs)${extra}`);
  }
}
if (md && !args.includes('--campaign')) console.log(rows.join('\n'));

// --campaign: whole maps from wave 1 (the sweep's runBot): how often a bot
// gets through wave 10 (what "cleared" meant before the events) and how often
// it then wins the map (now that clearing the event does it).
if (args.includes('--campaign')) {
  const { MAP_ORDER } = await import('../../../src/v3/data/maps');
  const { runBot } = await import('../../../src/v3/sim/bot');
  const { campaignWaves } = await import('../../../src/v3/data/events');
  console.log(`\nCampaign, ${seeds} seeds a map: through wave 10 → map won (with its event)`);
  for (const map of MAP_ORDER.filter((m) => !only || (only as string[]).includes(m))) {
    const line: string[] = [map.padEnd(12)];
    for (const skill of skills) {
      const runs = Array.from({ length: seeds }, (_, i) => runBot(map, 1000 + i, { ...SKILLS[skill], prefer: taste(1000 + i) }, { flow }));
      const ten = runs.filter((r) => r.wavesCleared >= 10).length;
      const won = runs.filter((r) => r.won).length;
      const ev = runs.flatMap((r) => r.events.filter((e) => e.outcome !== 'rerun'));
      const o = (k: string) => ev.filter((e) => e.outcome === k).length;
      line.push(`${skill} ${pct(ten, seeds).padStart(4)} → ${pct(won, seeds).padStart(4)}${campaignWaves(map) > 10 ? ` (event C${o('clean')}/H${o('held')}/B${o('broken')})` : ' (no event)'}`);
    }
    console.log(line.join('   '));
  }
}
