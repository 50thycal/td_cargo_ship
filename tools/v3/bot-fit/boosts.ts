// When does a boost get taken? The player's boost pickups next to the "you"
// bot's on the same runs (the boosts round, docs/design/v3-bot-refit.md,
// "Boosts"). A boost (Overdrive, Supply Run, Shield, Full Steam, ...) drops
// like a weapon and starts the moment its pickup is tapped, so "firing" a
// boost is taking its pickup. For every weapon pickup it records:
//   - when it dropped and when it was taken (or that it expired, or the wave
//     cleared it), in real seconds;
//   - the board at the drop and at the take: threats on screen, threats
//     under 3 s from impact, the nearest impact, a danger reading (each
//     threat counts e^(-tti/2)), and how full the board was against the
//     wave's own peak;
//   - the stakes: a boss round, losses left before the loss limit;
//   - the rack (Overdrive answers "running dry"), the boost and weapon
//     already running and their seconds left;
//   - how the boost was spent: seconds it ran, how it ended (ran out, the
//     wave cleared it, another boost replaced it), shots and kills inside it.
//
// It replays logs, so run it on the build a log was played on (it imports
// only what every v3 build since log v26 has: copy it into an older build's
// tools/v3/bot-fit to read that build's logs). The bot's mirrors copy the
// log's map, seed, Armory, card setup and draft picks.
//
//   npx vite-node tools/v3/bot-fit/boosts.ts -- --logs=tools/v3/bot-fit/logs --ids=<id,...> [--dice=6] [--persona=you] [--json=out.json]

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { SIM_DT, applyCommand, replaysHere, setupGame, type PlayLog } from '../../../src/v3/sim/playlog';
import { released, shipsSunk, step, timeToImpact, worthShooting, type Game } from '../../../src/v3/sim/game';
import { isBoost } from '../../../src/v3/data/roster';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import type { AbilityId, CardId } from '../../../src/v3/data/abilities';

export interface Board {
  /** Threats on screen; under 3 s from impact; the nearest impact (s). */
  up: number;
  near: number;
  minTti: number;
  /** Danger: Σ e^(-tti/2) over the threats on screen under 6 s. */
  danger: number;
  /** `danger` over the wave's peak danger (filled in once the wave ends). */
  full: number;
  /** Rounds in the rack over its size. */
  rack: number;
  lossesLeft: number;
  /** The boost running, and its seconds left; the loaded weapon's seconds left. */
  boost: string | null;
  boostLeft: number;
  weaponLeft: number;
  /** Seconds into the wave (game). */
  waveT: number;
}

export interface PickupEvent {
  who: 'you' | 'bot';
  log: string;
  map: string;
  wave: number;
  weapon: string;
  boost: boolean;
  /** taken, expired, or cleared (the wave ended with it on the water). */
  out: 'taken' | 'expired' | 'cleared';
  /** Real seconds from the drop to the take (or to its end). */
  age: number;
  drop: Board;
  at: Board;
  /** The boost it started: seconds it ran, how it ended, shots and kills in it. */
  ran?: { sec: number; end: 'ran' | 'cleared' | 'replaced'; shots: number; kills: number; taps: number };
}

/** A run's wave play over its exact waves: real seconds, taps, shots fired. */
export interface Play {
  sec: number;
  taps: number;
  shots: number;
}

const SPEED_CODE = { you: 's', bot: 'p' } as const;
const on = (x: number, y: number) => x >= 0 && x <= 1600 && y >= 0 && y <= 900;
const sumKills = (g: Game) => Object.values(g.kills).reduce((a, b) => a + b, 0);

function board(g: Game): Board {
  const live = worthShooting(g, g.threats).filter((th) => !th.dead && released(th) && on(th.x, th.y));
  let near = 0;
  let minTti = Infinity;
  let danger = 0;
  for (const th of live) {
    const tti = timeToImpact(g, th);
    if (tti < 3) near++;
    if (tti < minTti) minTti = tti;
    if (tti < 6) danger += Math.exp(-Math.max(0, tti) / 2);
  }
  const b = g.boost;
  return {
    up: live.length,
    near,
    minTti: Number.isFinite(minTti) ? Math.round(minTti * 100) / 100 : 99,
    danger: Math.round(danger * 100) / 100,
    full: 0,
    rack: Math.round((g.ammo / Math.max(1, g.stats.rack)) * 100) / 100,
    lossesLeft: g.tempo.lossLimit - shipsSunk(g),
    boost: b ? b.id : null,
    boostLeft: b ? Math.round(b.t * 10) / 10 : 0,
    weaponLeft: g.weapon ? Math.round(g.weapon.t * 10) / 10 : 0,
    waveT: Math.round(g.waveT * 10) / 10,
  };
}

/** Replays a log and lists its weapon pickups (boosts and weapons). Stops at
 *  the first wave that does not replay as recorded; `exact` is the waves kept. */
export function pickupsOf(log: PlayLog, who: 'you' | 'bot'): { events: PickupEvent[]; exact: number; play: Play } {
  const g = setupGame(log);
  const cmds = log.commands;
  const rec = log.summary!.waves;
  const marks = cmds.filter((c) => c[1] === SPEED_CODE[who]).map((c) => [c[0], c[2] as number] as const);
  const speed = (s: number) => {
    let v = 1;
    for (const [at, sp] of marks) if (at <= s) v = sp;
    return v;
  };
  const events: PickupEvent[] = [];
  let wave: PickupEvent[] = [];
  let peak = 0;
  const open = new Map<number, { e: PickupEvent; born: number }>();
  let running: { e: PickupEvent; from: number; shots: number; kills: number; taps: number } | null = null;
  const play: Play = { sec: 0, taps: 0, shots: 0 };
  let wPlay: Play = { sec: 0, taps: 0, shots: 0 };
  let taps = 0;
  let lastBoost: Game['boost'] = null;
  const closeBoost = (end: 'ran' | 'cleared' | 'replaced') => {
    if (!running) return;
    running.e.ran = { sec: Math.round(((g.steps - running.from) * SIM_DT) / speed(g.steps) * 10) / 10, end, shots: g.shots - running.shots, kills: sumKills(g) - running.kills, taps: taps - running.taps };
    running = null;
  };
  let i = 0;
  let checked = 0;
  let exact = 0;
  for (let guard = 0; guard < 5_000_000; guard++) {
    while (i < cmds.length && cmds[i][0] <= g.steps) {
      const c = cmds[i++];
      const before = new Map(g.pickups.map((p) => [p.id, p] as const));
      const boostBefore = g.boost;
      const at = c[1] === 't' && g.phase === 'wave' ? board(g) : null;
      const shots0 = g.shots;
      applyCommand(g, c);
      if (!at) continue;
      taps++;
      wPlay.taps++;
      wPlay.shots += g.shots - shots0;
      const after = new Set(g.pickups.map((p) => p.id));
      for (const [id] of before) {
        if (after.has(id)) continue;
        const o = open.get(id);
        if (!o) continue;
        open.delete(id);
        o.e.out = 'taken';
        o.e.age = Math.round((((g.steps - o.born) * SIM_DT) / speed(g.steps)) * 100) / 100;
        o.e.at = at;
        if (o.e.boost && g.boost && g.boost !== boostBefore) {
          if (running) closeBoost('replaced');
          running = { e: o.e, from: g.steps, shots: g.shots, kills: sumKills(g), taps };
        }
      }
      lastBoost = g.boost;
    }
    // A wave just ended: keep it only if it replayed as recorded.
    while (checked < g.history.length) {
      const h = g.history[checked];
      const r = rec[checked];
      checked++;
      if (!r || h.lost !== r.lost || h.shots !== r.shots) return { events, exact, play };
      for (const e of wave) {
        e.drop.full = peak ? Math.round((e.drop.danger / peak) * 100) / 100 : 0;
        e.at.full = peak ? Math.round((e.at.danger / peak) * 100) / 100 : 0;
      }
      events.push(...wave);
      wave = [];
      play.sec += wPlay.sec;
      play.taps += wPlay.taps;
      play.shots += wPlay.shots;
      wPlay = { sec: 0, taps: 0, shots: 0 };
      peak = 0;
      exact = checked;
    }
    if (g.phase === 'lost' || g.phase === 'won') break;
    if (g.phase !== 'wave') {
      // Between waves: whatever was on the water was cleared with the wave.
      for (const o of open.values()) {
        o.e.out = 'cleared';
        o.e.age = Math.round((((g.steps - o.born) * SIM_DT) / speed(g.steps)) * 100) / 100;
      }
      open.clear();
      if (running) closeBoost('cleared');
      if (i >= cmds.length || cmds[i][0] > g.steps) break;
      continue;
    }
    const ids = new Set(g.pickups.map((p) => p.id));
    wPlay.sec += SIM_DT / speed(g.steps);
    step(g, SIM_DT);
    if (g.phase === 'wave') {
      const b = board(g);
      if (b.danger > peak) peak = b.danger;
      for (const p of g.pickups) {
        if (ids.has(p.id) || p.kind !== 'weapon' || !p.weapon) continue;
        const e: PickupEvent = { who, log: log.id, map: log.map, wave: g.wave, weapon: p.weapon, boost: isBoost(p.weapon as AbilityId), out: 'expired', age: 0, drop: b, at: b };
        open.set(p.id, { e, born: g.steps });
        wave.push(e);
      }
      const now = new Set(g.pickups.map((p) => p.id));
      for (const [id, o] of open) {
        if (now.has(id)) continue;
        open.delete(id);
        o.e.age = Math.round((((g.steps - o.born) * SIM_DT) / speed(g.steps)) * 100) / 100;
        o.e.at = b;
      }
      if (running && !g.boost && lastBoost) closeBoost('ran');
    } else if (running) closeBoost('cleared');
    lastBoost = g.boost;
  }
  play.sec = Math.round(play.sec * 10) / 10;
  return { events, exact, play };
}

/** The "you" bot (or another persona) on the log's own map, seed, Armory,
 *  card setup and draft picks. */
export function mirror(log: PlayLog, persona: string, dice: number): PlayLog {
  const p = PERSONAS[persona];
  if (!p) throw new Error(`no persona ${persona}`);
  const run = new BotRun(log.map, log.seed, {
    persona: p,
    armory: log.armory ?? {},
    firstWave: log.firstWave,
    dice,
    ...(log.tempo ? { tempo: log.tempo } : {}),
    ...(log.freePlay ? { freePlay: log.freePlay } : {}),
    ...(log.lab ? { lab: log.lab } : {}),
    ...(log.encounters ? { encounters: log.encounters } : {}),
    ...(log.convoy ? { convoy: log.convoy } : {}),
  });
  const picks = log.summary!.drafts.map((d) => d.picked);
  const bot = (run as unknown as { bot: { choose: (g: Game) => { id: CardId } } }).bot;
  const own = bot.choose.bind(bot);
  let k = 0;
  bot.choose = (g) => {
    const want = picks[k++] as CardId | undefined;
    return want && g.offer.includes(want) ? { id: want } : own(g);
  };
  run.advance(Infinity);
  return run.finish();
}

// Run as a tool (vite-node drops the script from argv); quiet when imported by a test.
const isMain = !process.env.VITEST;
if (isMain) {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
  const dir = opt('logs') ?? new URL('./logs', import.meta.url).pathname;
  const ids = opt('ids')?.split(',');
  const dice = Number(opt('dice') ?? 6);
  const persona = opt('persona') ?? 'you';
  const out: { log: string; map: string; v: number; you: { exact: number; play: Play; events: PickupEvent[] }; bot: { dice: number; exact: number; lost: number[]; play: Play; events: PickupEvent[] }[] }[] = [];
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    const log = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as PlayLog;
    if (ids && !ids.some((id) => log.id.includes(id))) continue;
    if (!replaysHere(log.v)) {
      console.log(`${log.id}: v${log.v} does not replay on this build, skipped`);
      continue;
    }
    const me = pickupsOf(log, 'you');
    const row = { log: log.id, map: log.map, v: log.v, you: me, bot: [] as (typeof out)[number]['bot'] };
    for (let d = 1; d <= dice; d++) {
      const bl = mirror(log, persona, d);
      const b = pickupsOf(bl, 'bot');
      const lost = bl.summary!.waves.map((w, k, a) => w.lost - (k ? a[k - 1].lost : 0));
      row.bot.push({ dice: d, exact: b.exact, lost, play: b.play, events: b.events });
    }
    out.push(row);
    const boosts = (es: PickupEvent[]) => es.filter((e) => e.boost);
    const line = (es: PickupEvent[]) => {
      const t = es.filter((e) => e.out === 'taken');
      const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : NaN);
      return `${es.length} dropped, ${t.length} taken, age med ${med(t.map((e) => e.age)).toFixed(2)} s, up ${med(t.map((e) => e.at.up))}, full ${med(t.map((e) => e.at.full)).toFixed(2)}, rack ${med(t.map((e) => e.at.rack)).toFixed(2)}`;
    };
    console.log(`${log.id} ${log.map} v${log.v}: exact ${me.exact} waves`);
    console.log(`  you  boosts: ${line(boosts(me.events))}`);
    console.log(`  bot  boosts: ${line(row.bot.flatMap((b) => boosts(b.events)))}`);
  }
  const file = opt('json');
  if (file) writeFileSync(file, `${JSON.stringify({ about: 'Weapon and boost pickups: the player against the bot mirrors (tools/v3/bot-fit/boosts.ts).', persona, dice, runs: out })}\n`);
}
