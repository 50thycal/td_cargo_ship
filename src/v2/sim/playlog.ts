// PLAYTEST LOGS. Every player input goes through a Recorder, stamped with the
// sim step it happened before. Because the sim is deterministic, a log (seed +
// inputs) replays the exact game — so a playtest can be studied input by input,
// not just from its final numbers. Pure: no DOM, no storage (see
// platform/playlogStore.ts for where logs are kept).

import type { FormationId } from '../data/formations';
import type { MapId } from '../data/maps';
import type { UpgradeId } from '../data/upgrades';
import {
  continueEndless,
  createGame,
  pickUpgrade,
  setFlow,
  setFormation,
  step,
  tap,
  type Game,
  type TapResult,
  type WaveRecord,
} from './game';

/** Bump when the log format or sim rules change in a way that breaks replay.
 *  3: playtest round 3 (raids, carrier strikes, formation traits, 8-HP
 *  heavies, card swaps) — a v2 log only replays on a round-2 build.
 *  4: playtest round 4 (subs, trucks, aircraft, the new roster and pickups).
 *  5: round 5 (frigate holds station, rarer repairs, 1-damage ballistic spill). */
export const LOG_VERSION = 5;
export const SIM_DT = 1 / 60;

/** Compact input encoding: [step, code, ...args]. */
export type LogCommand =
  | [number, 't', number, number, number] // tap x y radius (world units, rounded)
  | [number, 'f', number] // flow step
  | [number, 'm', FormationId] // formation
  | [number, 'u', UpgradeId, UpgradeId?] // upgrade picked [, card it replaced]
  | [number, 'e'] // continue into endless
  | [number, 's', number]; // game speed (UI only; kept for context)

export interface PlayLog {
  v: number;
  id: string;
  build: string;
  startedAt: string;
  endedAt?: string;
  map: MapId;
  seed: number;
  firstWave: number;
  device: { w: number; h: number; dpr: number; touch: boolean; ua: string };
  /** How the run ended: won (map cleared and stopped), lost, or quit.
   *  Absent on a mid-run save. */
  end?: 'won' | 'lost' | 'quit';
  commands: LogCommand[];
  summary?: PlaySummary;
}

export interface PlaySummary {
  score: number;
  wave: number;
  cleared: boolean;
  endless: boolean;
  delivered: number;
  lost: number;
  carrierHp: number;
  shots: number;
  steps: number;
  seconds: number;
  levels: Partial<Record<UpgradeId, number>>;
  /** Each card offered → picked, in order. */
  drafts: { wave: number; offered: UpgradeId[]; picked: UpgradeId; replaced?: UpgradeId }[];
  waves: WaveRecord[];
}

export class Recorder {
  readonly log: PlayLog;
  private drafts: PlaySummary['drafts'] = [];

  constructor(
    readonly game: Game,
    meta: Omit<PlayLog, 'v' | 'commands' | 'map' | 'seed' | 'id'> & { id?: string },
  ) {
    this.log = {
      v: LOG_VERSION,
      id: meta.id ?? `${meta.startedAt.replace(/[^0-9]/g, '').slice(0, 14)}-${game.seed}`,
      map: game.map.id,
      seed: game.seed,
      commands: [],
      ...meta,
    };
  }

  tap(x: number, y: number, radius: number): TapResult {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rr = Math.round(radius);
    // Only taps that could change the game are worth a log line.
    if (this.game.phase === 'wave') this.log.commands.push([this.game.steps, 't', rx, ry, rr]);
    return tap(this.game, rx, ry, rr);
  }

  flow(v: number): void {
    this.log.commands.push([this.game.steps, 'f', v]);
    setFlow(this.game, v);
  }

  formation(id: FormationId): void {
    this.log.commands.push([this.game.steps, 'm', id]);
    setFormation(this.game, id);
  }

  pick(id: UpgradeId, replace?: UpgradeId): void {
    if (this.game.phase !== 'draft' || !this.game.offer.includes(id)) return;
    this.drafts.push({ wave: this.game.wave, offered: [...this.game.offer], picked: id, ...(replace ? { replaced: replace } : {}) });
    this.log.commands.push(replace ? [this.game.steps, 'u', id, replace] : [this.game.steps, 'u', id]);
    pickUpgrade(this.game, id, replace);
  }

  endless(): void {
    this.log.commands.push([this.game.steps, 'e']);
    continueEndless(this.game);
  }

  speed(v: number): void {
    this.log.commands.push([this.game.steps, 's', v]);
  }

  /** The log so far, mid-run (no `end` yet): saved after each wave so a run
   *  that never reaches a result screen still leaves a log. A copy, so later
   *  inputs can't leak into it while it is being sent. */
  snapshot(): PlayLog {
    // A map cleared and continued into endless was sealed 'won' once; until
    // it ends again it is still in progress.
    const { end: _end, endedAt: _endedAt, ...log } = this.copy();
    return log;
  }

  /** Seal the log with how it ended and a readable summary. */
  finish(end: PlayLog['end']): PlayLog {
    this.log.end = end;
    this.log.endedAt = new Date().toISOString();
    return this.copy();
  }

  private copy(): PlayLog {
    const g = this.game;
    this.log.summary = {
      score: g.score,
      wave: g.wave,
      cleared: g.cleared,
      endless: g.endless,
      delivered: g.delivered,
      lost: g.lost,
      carrierHp: g.carrierHp,
      shots: g.shots,
      steps: g.steps,
      seconds: Math.round(g.t),
      levels: { ...g.levels },
      drafts: [...this.drafts],
      waves: [...g.history],
    };
    return { ...this.log, commands: [...this.log.commands] };
  }
}

/** Re-run a log from its seed and inputs. Stops at the last recorded step
 *  for a quit, or when the game ends. */
export function replay(log: PlayLog): Game {
  const g = createGame(log.map, log.seed, log.firstWave);
  const cmds = log.commands;
  const lastStep = log.summary?.steps ?? Infinity;
  let i = 0;
  for (let guard = 0; guard < 10_000_000; guard++) {
    while (i < cmds.length && cmds[i][0] <= g.steps) {
      const c = cmds[i++];
      switch (c[1]) {
        case 't':
          tap(g, c[2], c[3], c[4]);
          break;
        case 'f':
          setFlow(g, c[2]);
          break;
        case 'm':
          setFormation(g, c[2]);
          break;
        case 'u':
          pickUpgrade(g, c[2], c[3]);
          break;
        case 'e':
          continueEndless(g);
          break;
      }
    }
    if (g.steps >= lastStep && i >= cmds.length) break;
    if (g.phase === 'lost') break;
    if (g.phase !== 'wave') {
      // Waiting in a draft or on the win screen: only a command at this very
      // step can move it on. Anything else means the log is inconsistent.
      if (i >= cmds.length || cmds[i][0] > g.steps) break;
      continue;
    }
    step(g, SIM_DT);
  }
  return g;
}
