// RESUME A RUN IN PROGRESS (docs/design/v3-resume-run.md). The sim is
// deterministic, so a run is wholly its log: the map, seed, first wave,
// tempo, Armory and lab/Free Play/encounter/convoy setup, then every input
// stamped with its step. Saving a run mid-game is saving its log so far;
// continuing it is replaying that log to the step it was saved at, then
// carrying on with the same recorder.
//
// This file is pure (no DOM, no storage): the state fingerprint saved with
// the log, and a replay that can be run a slice at a time so a long run
// (wave 13 is ~34,000 steps) is rebuilt across frames with a progress bar.
// platform/runSave.ts keeps the record; ui/app.ts drives the screens.

import { step, type Game } from './game';
import { SIM_DT, applyCommand, setupGame, type LogCommand, type PlayLog } from './playlog';
import { hashText } from './telemetry';

/** A small summary of a game, taken when a run is saved and checked after
 *  the replay: if a new build plays the same inputs differently, the two
 *  differ and the run is not continued as a different game. Each number is
 *  cheap; together they move when almost anything on the board does. */
export interface RunPrint {
  steps: number;
  phase: Game['phase'];
  wave: number;
  waveT: number;
  score: number;
  ships: number;
  lost: number;
  delivered: number;
  carrierHp: number;
  threats: number;
  pickups: number;
  ammo: number;
  shots: number;
  nextId: number;
  /** Where everything on the board is: ships, threats, pickups and
   *  interceptors, by position and hull (one number; the effects are left
   *  out: the screen ages those on its own during a wave's end). */
  board: number;
  /** Where each RNG stream stands: a number derived from its state, read
   *  without drawing from it (a fork), so taking the print changes nothing. */
  rng: string;
  /** All of the above as one hash. */
  hash: string;
}

function boardSum(g: Game): number {
  let n = g.t * 7 + g.realT * 3 + g.flow * 11;
  for (const s of g.ships) n += s.x + s.y * 1.3 + s.hp * 5 + s.id * 0.7;
  for (const t of g.threats) n += t.x * 1.7 + t.y * 1.9 + t.hp * 3 + t.id * 0.3;
  for (const p of g.pickups) n += p.x * 1.1 + p.y * 1.2 + p.age + p.id * 0.9;
  for (const i of g.interceptors) n += i.x * 2.1 + i.y * 2.3;
  return n;
}

/** The fingerprint of `g` as it stands. Reads only: the game is unchanged. */
export function runPrint(g: Game): RunPrint {
  const rng = (Object.keys(g.rng) as (keyof Game['rng'])[]).map((k) => hashText(String(g.rng[k].fork('resume-print').next()))).join('');
  const p: Omit<RunPrint, 'hash'> = {
    steps: g.steps,
    phase: g.phase,
    wave: g.wave,
    waveT: g.waveT,
    score: g.score,
    ships: g.ships.length,
    lost: g.lost,
    delivered: g.delivered,
    carrierHp: g.carrierHp,
    threats: g.threats.length,
    pickups: g.pickups.length,
    ammo: g.ammo,
    shots: g.shots,
    nextId: g.nextId,
    board: boardSum(g),
    rng,
  };
  return { ...p, hash: hashText(JSON.stringify(p)) };
}

/** The same game? (The hash covers every field.) */
export function samePrint(a: RunPrint, b: RunPrint): boolean {
  return a.hash === b.hash;
}

/** The fields that differ, for a log line when a print does not match. */
export function printDiff(saved: RunPrint, now: RunPrint): string[] {
  return (Object.keys(saved) as (keyof RunPrint)[]).filter((k) => k !== 'hash' && saved[k] !== now[k]).map((k) => `${k}: ${saved[k]} → ${now[k]}`);
}

/** A log replayed to `lastStep` (its first `commands` inputs), a slice at a
 *  time: the same loop as `replayTo`, so the game it ends on is the same
 *  game. Headless: the sim's sound cues and UI events pile up unread and
 *  are dropped at the end (nothing in the sim reads them back). `attach`
 *  runs on the fresh game before its first step: the live run's telemetry,
 *  so the sidecar covers the whole run once, as the live run's would. */
export class Restorer {
  readonly game: Game;
  readonly lastStep: number;
  private cmds: LogCommand[];
  private i = 0;
  done = false;

  constructor(log: PlayLog, lastStep: number, commands: number, attach?: (g: Game) => void) {
    this.game = setupGame(log);
    attach?.(this.game);
    this.lastStep = lastStep;
    this.cmds = log.commands.slice(0, commands);
  }

  /** How far it has got, 0 to 1. */
  get progress(): number {
    return this.lastStep > 0 ? Math.min(1, this.game.steps / this.lastStep) : 1;
  }

  /** Play up to `steps` more sim steps; true once it has reached the saved
   *  step (or the log can go no further). */
  run(steps: number): boolean {
    const g = this.game;
    const cmds = this.cmds;
    let n = 0;
    while (!this.done && n < steps) {
      while (this.i < cmds.length && cmds[this.i][0] <= g.steps) applyCommand(g, cmds[this.i++]);
      if ((g.steps >= this.lastStep && this.i >= cmds.length) || g.phase === 'lost') this.done = true;
      else if (g.phase !== 'wave') {
        // Waiting in a draft: only a command at this very step moves it on.
        if (this.i >= cmds.length || cmds[this.i][0] > g.steps) this.done = true;
      } else {
        step(g, SIM_DT);
        n++;
      }
    }
    if (this.done) {
      g.events = [];
      g.cues.length = 0;
    }
    return this.done;
  }

  /** Run on for at most `ms` of wall time (a frame's share); true once done. */
  runFor(ms: number, now: () => number = () => performance.now()): boolean {
    const until = now() + ms;
    while (!this.done && now() < until) this.run(240);
    return this.done;
  }
}

/** The whole replay at once (tests, tools). */
export function restoreGame(log: PlayLog, lastStep: number, commands: number, attach?: (g: Game) => void): Game {
  const r = new Restorer(log, lastStep, commands, attach);
  r.run(Infinity);
  return r.game;
}
