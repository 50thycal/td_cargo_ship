// Measures each special event with the bots: every event on its own map,
// started at its wave (11, with ten waves of drafts handed over, as a
// `?wave=11` start does; a bonus event after its wave, with two passives in
// hand), over N seeds, for each bot skill. Prints the Clean / Held / Broken
// rates and the ships lost in the event, as the table in
// docs/design/v3-special-events-build.md.
// Usage: npx tsx tools/v3/special-events/measure.mts [seeds=20] [--skills=sharp,average] [--only=id,id] [--md] [--campaign] [--lab] [--ending=on|off|both]
// --lab plays each event as its Test Lab card does (round 6): its kit at
// level 2 with frequent drops, the default flow, and the event waiting for
// the convoy to sail in; the first run of the card.
// --campaign plays whole maps from wave 1 (the sweep's runBot). Round 7:
// --ending=both plays each map with the three-run ending (and its restore)
// off and on, to compare; it also counts the bonus Siren Field waves.
import { ABILITY_ORDER, type AbilityId } from '../../../src/v3/data/abilities';
import { ENDING, EVENTS, EVENT_ORDER, EVENT_WAVE, bonusDef, eventMap, type EventId } from '../../../src/v3/data/events';
import { MAPS } from '../../../src/v3/data/maps';
import { ROSTER } from '../../../src/v3/data/roster';
import { Bot, SKILLS } from '../../../src/v3/sim/bot';
import { applyFreePlay, applyLab, createGame, step } from '../../../src/v3/sim/game';
import { labCard } from '../../../src/v3/data/lab';
import { startBonus, type EventRecord } from '../../../src/v3/sim/events';
import { makeRng } from '../../../src/sim/rng';

const args = process.argv.slice(2);
const seeds = Number(args.find((a) => /^\d+$/.test(a)) ?? 20);
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const skills = (opt('skills') ?? 'sharp,average').split(',');
const only = opt('only')?.split(',') as EventId[] | undefined;
const md = args.includes('--md');
/** The convoy's flow (the sweep plays at 2: more ships than the default 1). */
const lab = args.includes('--lab');
const flow = Number(opt('flow') ?? (lab ? 1 : 2));

/** A seed's shuffle of the roster (as the sweep's), so every weapon gets
 *  drafted across the seeds. */
const taste = (seed: number): AbilityId[] => makeRng(seed ^ 0x7a57e).shuffle([...ABILITY_ORDER]);

/** One event run: the game at its wave, held back WARM s so the convoy is
 *  on the water as it is in the campaign (ten waves in, ships are always
 *  under way), then played by the bot to the end. A bonus event starts
 *  after its wave, with two passives held (the campaign asks for them). */
const WARM = 45;
/** Gun shots in the last play() and the ones at a decoy (round 9: the
 *  record keeps these only for the Decoy Storm; counted here for any). */
const tally = { shots: 0, decoy: 0, pickups: 0 };
function play(map: ReturnType<typeof eventMap>, seed: number, skill: string, id: EventId): EventRecord | undefined {
  tally.shots = 0;
  tally.decoy = 0;
  tally.pickups = 0;
  let taps0 = -1;
  const seen = new Set<number>();
  const bonus = bonusDef(id);
  const g = createGame(map, seed, lab ? labCard(`ev-${id}`)!.wave : bonus ? bonus.after + 1 : EVENT_WAVE);
  if (lab) {
    const card = labCard(`ev-${id}`)!;
    applyFreePlay(g, { weapons: card.kit.map((w) => ({ id: w, level: 2 })), frequentDrops: true });
    applyLab(g, { card: card.id, length: 'quick', mix: 'normal' });
  } else if (bonus) {
    // Two passives in hand, in place of the first non-passive weapons.
    for (const p of ['droneScreen', 'gunships'] as AbilityId[]) {
      if (g.slots.filter((w) => ROSTER[w].cat === 'passive').length >= 2) break;
      if (g.slots.includes(p)) continue;
      const i = g.slots.findIndex((w) => ROSTER[w].cat !== 'passive');
      if (i >= 0) {
        delete g.levels[g.slots[i]];
        g.slots[i] = p;
      } else g.slots.push(p);
      g.levels[p] = 2;
    }
    g.wave = bonus.after;
    startBonus(g, id);
    g.event!.t0 = WARM;
  } else if (g.event) g.event.t0 = WARM;
  g.flow = flow;
  const bot = new Bot({ ...SKILLS[skill], prefer: taste(seed) }, seed);
  // The first run only (the ending's next run follows straight on).
  for (let i = 0; i < 30 * 200 && g.phase === 'wave' && !g.eventLog.some((x) => x.outcome !== 'rerun'); i++) {
    bot.act(g);
    step(g, 1 / 30);
    if (!g.event) continue;
    if (taps0 < 0) taps0 = g.taps.pickup;
    tally.pickups = g.taps.pickup - taps0;
    for (const it of g.interceptors) {
      if (seen.has(it.id) || !it.tap) continue;
      seen.add(it.id);
      tally.shots += 1;
      if (g.threats.find((t) => t.id === it.target)?.kind === 'decoy') tally.decoy += 1;
    }
  }
  return g.eventLog.find((x) => x.outcome !== 'rerun');
}

const pct = (n: number, d: number) => `${Math.round((100 * n) / Math.max(1, d))}%`;
const rows: string[] = [];
if (md) {
  rows.push(`| Event | Map | Bot | Clean | Held | Broken | Ships lost (avg) | Seconds (avg) |`);
  rows.push('|---|---|---|---|---|---|---|---|');
} else if (!args.includes('--campaign')) console.log(`Special events, ${seeds} seeds each, from wave ${EVENT_WAVE}, flow ${flow}${lab ? ', as the Test Lab card plays it' : ''}\n`);
for (const id of args.includes('--campaign') ? [] : (only ?? EVENT_ORDER)) {
  const map = eventMap(id);
  for (const skill of skills) {
    const out = { clean: 0, held: 0, broken: 0, lost: 0, secs: 0, n: 0, shots: 0, decoy: 0, pickups: 0 };
    for (let i = 0; i < seeds; i++) {
      const e = play(map, 2000 + i, skill, id);
      if (!e) continue;
      out.n += 1;
      out[e.outcome as 'clean' | 'held' | 'broken'] += 1;
      out.lost += e.lost;
      out.secs += e.seconds;
      out.shots += tally.shots;
      out.decoy += tally.decoy;
      out.pickups += tally.pickups;
    }
    const extra = (out.decoy ? ` · ${pct(out.decoy, out.shots)} of shots at decoys (${out.decoy}/${out.shots})` : '') + (id === 'supply-raid' ? ` · ${(out.pickups / Math.max(1, out.n)).toFixed(1)} pickups taken a run` : '');
    if (md) rows.push(`| ${EVENTS[id].name} | ${MAPS[map].name} | ${skill} | ${pct(out.clean, out.n)} | ${pct(out.held, out.n)} | ${pct(out.broken, out.n)} | ${(out.lost / Math.max(1, out.n)).toFixed(2)} | ${Math.round(out.secs / Math.max(1, out.n))} |`);
    else console.log(`${EVENTS[id].name.padEnd(18)} ${map.padEnd(12)} ${skill.padEnd(8)} clean ${pct(out.clean, out.n).padStart(4)}  held ${pct(out.held, out.n).padStart(4)}  broken ${pct(out.broken, out.n).padStart(4)}  lost ${(out.lost / Math.max(1, out.n)).toFixed(2)}  ${Math.round(out.secs / Math.max(1, out.n))} s  (${out.n} runs)${extra}`);
  }
}
if (md && !args.includes('--campaign')) console.log(rows.join('\n'));

// --campaign: whole maps from wave 1 (the sweep's runBot): how often a bot
// gets through wave 10 (what "cleared" meant before the events) and how often
// it then wins the map (now that clearing the event does it). With
// --ending=both, each map is played with the three-run ending off (one run,
// no restore) and on.
if (args.includes('--campaign')) {
  const { MAP_ORDER } = await import('../../../src/v3/data/maps');
  const { runBot } = await import('../../../src/v3/sim/bot');
  const endings = (opt('ending') ?? 'on') === 'both' ? [false, true] : [(opt('ending') ?? 'on') !== 'off'];
  console.log(`\nCampaign, ${seeds} seeds a map, flow ${flow}: through wave 10 → map won; the map event's runs C/H/B; bonus Siren Field waves met (C/H/B)`);
  for (const map of MAP_ORDER.filter((m) => !only || (only as string[]).includes(m))) {
    const line: string[] = [map.padEnd(12)];
    for (const skill of skills) {
      for (const on of endings) {
        ENDING.threeRuns = on;
        const runs = Array.from({ length: seeds }, (_, i) => runBot(map, 1000 + i, { ...SKILLS[skill], prefer: taste(1000 + i) }, { flow }));
        const ten = runs.filter((r) => r.wavesCleared >= 10).length;
        const won = runs.filter((r) => r.won).length;
        const ev = runs.flatMap((r) => r.events.filter((e) => e.outcome !== 'rerun' && e.kind !== 'bonus'));
        const bon = runs.flatMap((r) => r.events.filter((e) => e.kind === 'bonus'));
        const o = (list: EventRecord[], k: string) => list.filter((e) => e.outcome === k).length;
        line.push(`${skill}${endings.length > 1 ? (on ? ' 3-run' : ' 1-run') : ''} ${pct(ten, seeds).padStart(4)} → ${pct(won, seeds).padStart(4)} (C${o(ev, 'clean')}/H${o(ev, 'held')}/B${o(ev, 'broken')}; bonus ${bon.length}: ${o(bon, 'clean')}/${o(bon, 'held')}/${o(bon, 'broken')})`);
      }
    }
    console.log(line.join('   '));
  }
  ENDING.threeRuns = true;
}
