// Read V2 games for what a summary can't show: how busy the screen was, who
// did the killing (the player's taps or the automatic CIWS), how long heavies
// survived, and how hard the carrier was pressed.
//   npm run v2:analyze -- log.json [more.json ...]        real playtest logs
//   npm run v2:analyze -- --bot=sharp --map=strait [--seeds=8] [--flow=4]
// Logs are re-run input by input (the same loop as replay()), so the numbers
// are the real game's; bot mode plays the same meter over bot games, so the
// two can be compared line by line.

import { readFileSync } from 'node:fs';
import type { FormationId } from '../../src/v2/data/formations';
import type { MapId } from '../../src/v2/data/maps';
import type { UpgradeId } from '../../src/v2/data/upgrades';
import { Bot, SKILLS } from '../../src/v2/sim/bot';
import { CARRIER_TARGET, raidWarning, continueEndless, createGame, pickUpgrade, setFlow, setFormation, step, tap, type Game } from '../../src/v2/sim/game';
import { LOG_VERSION, SIM_DT, type PlayLog } from '../../src/v2/sim/playlog';

export interface WaveStats {
  wave: number;
  seconds: number;
  threatSum: number;
  threatMax: number;
  quiet: number;
  dry: number;
  shots: number;
  ciwsShots: number;
  carrierThreats: number;
  carrierDamage: number;
  lost: number;
  heavies: { life: number; hits: number; killed: boolean }[];
}

/** Watches a game one step at a time. Call step() instead of the sim's. */
export class Meter {
  readonly waves: WaveStats[] = [];
  private cur: WaveStats | null = null;
  private heavy = new Map<number, { born: number; hp: number; hits: number }>();
  private seen = new Set<number>();
  private shotsAtStart = 0;

  step(g: Game): void {
    if (g.phase !== 'wave') {
      this.cur = null;
      step(g, SIM_DT);
      return;
    }
    if (!this.cur || this.cur.wave !== g.wave) {
      this.cur = { wave: g.wave, seconds: 0, threatSum: 0, threatMax: 0, quiet: 0, dry: 0, shots: 0, ciwsShots: 0, carrierThreats: 0, carrierDamage: 0, lost: 0, heavies: [] };
      this.waves.push(this.cur);
      this.shotsAtStart = g.shots;
    }
    const w = this.cur;
    const before = { ciws: g.ciwsT, heavyKills: g.kills.heavy, hp: g.carrierHp, lost: g.lost };
    step(g, SIM_DT);
    // The CIWS resets its cooldown each time it fires.
    if (g.ciwsT > before.ciws + 1e-9) w.ciwsShots++;
    // Shots are fired by taps, between steps.
    w.shots = g.shots - this.shotsAtStart;
    w.carrierDamage += Math.max(0, before.hp - g.carrierHp);
    w.lost += g.lost - before.lost;
    let heavyDowned = g.kills.heavy - before.heavyKills;
    const live = g.threats.filter((t) => !t.dead);
    w.seconds += SIM_DT;
    w.threatSum += live.length * SIM_DT;
    w.threatMax = Math.max(w.threatMax, live.length);
    if (!live.length) w.quiet += SIM_DT;
    if (g.ammo < 1 && (g.stats.batteryRack <= 0 || g.batteryAmmo < 1) && g.overdriveT <= 0) w.dry += SIM_DT;
    for (const t of live) {
      if (!this.seen.has(t.id)) {
        this.seen.add(t.id);
        if (t.target === CARRIER_TARGET) w.carrierThreats++;
      }
      if (t.kind === 'heavy') {
        const h = this.heavy.get(t.id) ?? { born: g.t, hp: t.hp, hits: 0 };
        if (t.hp < h.hp) h.hits += h.hp - t.hp;
        h.hp = t.hp;
        this.heavy.set(t.id, h);
      }
    }
    for (const [id, h] of this.heavy) {
      const t = g.threats.find((x) => x.id === id);
      if (!t || t.dead) {
        const killed = heavyDowned > 0;
        if (killed) heavyDowned--;
        w.heavies.push({ life: g.t - h.born, hits: h.hits + (killed ? h.hp : 0), killed });
        this.heavy.delete(id);
      }
    }
  }
}

export function analyzeLog(log: PlayLog): WaveStats[] {
  const g = createGame(log.map, log.seed, log.firstWave);
  const meter = new Meter();
  const cmds = log.commands;
  const lastStep = log.summary?.steps ?? Infinity;
  let i = 0;
  for (let guard = 0; guard < 10_000_000; guard++) {
    while (i < cmds.length && cmds[i][0] <= g.steps) {
      const c = cmds[i++];
      if (c[1] === 't') tap(g, c[2], c[3], c[4]);
      else if (c[1] === 'f') setFlow(g, c[2]);
      else if (c[1] === 'm') setFormation(g, c[2]);
      else if (c[1] === 'u') pickUpgrade(g, c[2], c[3]);
      else if (c[1] === 'e') continueEndless(g);
    }
    if (g.steps >= lastStep && i >= cmds.length) break;
    if (g.phase === 'lost') break;
    if (g.phase !== 'wave' && (i >= cmds.length || cmds[i][0] > g.steps)) break;
    meter.step(g);
  }
  return meter.waves;
}

export function analyzeBot(map: MapId, seed: number, skill: string, flow?: number, prefer?: UpgradeId[], formation?: FormationId): { waves: WaveStats[]; game: Game } {
  const g = createGame(map, seed);
  if (flow !== undefined) setFlow(g, flow);
  const adaptive = (formation as string) === 'adaptive';
  if (formation && !adaptive) setFormation(g, formation);
  const bot = new Bot({ ...SKILLS[skill], ...(prefer ? { prefer } : {}) }, seed);
  const meter = new Meter();
  for (let i = 0; i < 60 * 60 * 30 && g.phase !== 'lost' && g.phase !== 'won'; i++) {
    // "adaptive": answer each raid's warning with the formation its tags
    // suggest — Spread for a splash barrage, Box for a guided volley, Column
    // to hurry ships past a drone swarm.
    if (adaptive && g.phase === 'wave') {
      const w = raidWarning(g);
      if (w) setFormation(g, w.raid.theme === 'barrage' ? 'spread' : w.raid.theme === 'volley' ? 'box' : 'column');
    }
    bot.act(g);
    meter.step(g);
  }
  return { waves: meter.waves, game: g };
}

const pct = (x: number, of: number) => `${Math.round((100 * x) / Math.max(of, 1e-9))}`.padStart(5);

function print(waves: WaveStats[]): void {
  console.log('wave  secs  avgOnScreen  max  quiet%  dry%  shots  ciws  →carrier  carrierDmg  sunk  heavies(life s/hits, ! = got through)');
  for (const w of waves) {
    const hv = w.heavies.map((h) => `${h.life.toFixed(1)}/${h.hits}${h.killed ? '' : '!'}`).join(' ');
    console.log(
      `${String(w.wave).padStart(4)}  ${w.seconds.toFixed(0).padStart(4)}  ${(w.threatSum / w.seconds).toFixed(1).padStart(11)}  ${String(Math.round(w.threatMax)).padStart(3)}  ${pct(w.quiet, w.seconds)}  ${pct(w.dry, w.seconds)}  ${String(Math.round(w.shots)).padStart(5)}  ${String(Math.round(w.ciwsShots)).padStart(4)}  ${String(Math.round(w.carrierThreats)).padStart(8)}  ${String(Math.round(w.carrierDamage)).padStart(10)}  ${String(Math.round(w.lost)).padStart(4)}  ${hv}`,
    );
  }
}

/** Average several games wave by wave (waves a game never reached are skipped). */
function mean(runs: WaveStats[][]): WaveStats[] {
  const out: WaveStats[] = [];
  const maxWave = Math.max(...runs.map((r) => r.length));
  for (let k = 0; k < maxWave; k++) {
    const ws = runs.map((r) => r[k]).filter(Boolean);
    const avg = (f: (w: WaveStats) => number) => ws.reduce((s, w) => s + f(w), 0) / ws.length;
    out.push({
      wave: k + 1,
      seconds: avg((w) => w.seconds),
      threatSum: avg((w) => w.threatSum),
      threatMax: avg((w) => w.threatMax),
      quiet: avg((w) => w.quiet),
      dry: avg((w) => w.dry),
      shots: avg((w) => w.shots),
      ciwsShots: avg((w) => w.ciwsShots),
      carrierThreats: avg((w) => w.carrierThreats),
      carrierDamage: avg((w) => w.carrierDamage),
      lost: avg((w) => w.lost),
      heavies: [],
    });
  }
  return out;
}

{
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
  const bot = opt('bot');
  if (bot) {
    const map = (opt('map') ?? 'strait') as MapId;
    const seeds = Number(opt('seeds') ?? 8);
    const flow = opt('flow') !== undefined ? Number(opt('flow')) : undefined;
    const prefer = opt('prefer')?.split(',') as UpgradeId[] | undefined;
    const formation = opt('formation') as FormationId | undefined;
    const runs = Array.from({ length: seeds }, (_, i) => analyzeBot(map, 1000 + i, bot, flow, prefer, formation));
    const won = runs.filter((r) => r.game.cleared).length;
    const lost = runs.reduce((s, r) => s + r.game.lost, 0) / seeds;
    const hp = runs.reduce((s, r) => s + r.game.carrierHp, 0) / seeds;
    console.log(`\n=== bot ${bot} on ${map}, ${seeds} seeds${flow !== undefined ? `, flow ${flow}` : ''}${prefer ? `, prefers ${prefer.join('/')}` : ''}${formation ? `, ${formation}` : ''}: cleared ${won}/${seeds}, avg sunk ${lost.toFixed(1)}, avg carrier ${hp.toFixed(1)}`);
    print(mean(runs.map((r) => r.waves)));
    const hv = runs.flatMap((r) => r.waves.flatMap((w) => w.heavies));
    if (hv.length) {
      const killed = hv.filter((h) => h.killed);
      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
      console.log(
        `heavies: ${hv.length}, shot down ${killed.length} (${Math.round((100 * killed.length) / hv.length)}%), avg life when shot down ${avg(killed.map((h) => h.life)).toFixed(1)} s, got through after avg ${avg(hv.filter((h) => !h.killed).map((h) => h.hits)).toFixed(1)} hits`,
      );
    }
  } else {
    for (const f of args) {
      const logs: PlayLog[] = [JSON.parse(readFileSync(f, 'utf8'))].flat();
      for (const log of logs) {
        console.log(`\n=== ${log.id}  ${log.map}  ${log.end ?? 'mid-run'}  sunk ${log.summary?.lost}  carrier ${log.summary?.carrierHp}`);
        if (log.v !== LOG_VERSION) {
          console.log(`(log v${log.v} needs a build of its own rules to re-run; this build is v${LOG_VERSION})`);
          continue;
        }
        print(analyzeLog(log));
      }
    }
  }
}
