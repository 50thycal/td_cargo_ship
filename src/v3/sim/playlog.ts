// PLAYTEST LOGS. Every player input goes through a Recorder, stamped with the
// sim step it happened before. Because the sim is deterministic, a log (seed +
// inputs) replays the exact game — so a playtest can be studied input by input,
// not just from its final numbers. Pure: no DOM, no storage (see
// platform/playlogStore.ts for where logs are kept).

import type { FormationId } from '../data/formations';
import type { MapId } from '../data/maps';
import type { AbilityId, CardId } from '../data/abilities';
import type { ArmoryLevels } from '../data/armory';
import type { LabSetup, LabStats } from './lab';
import {
  applyFreePlay,
  applyLab,
  continueEndless,
  createGame,
  pickUpgrade,
  focusHold,
  labBring,
  press,
  pressMove,
  release,
  setFlow,
  setFormation,
  step,
  tap,
  type FreePlaySetup,
  type Game,
  type Phase,
  type TapResult,
  type Tempo,
  type WaveRecord,
} from './game';
import { Watch, noteContext, type Moment, type PlayNote, type Rating, type Volley } from './feedback';

/** Bump when the log format or sim rules change in a way that breaks replay.
 *  3: playtest round 3 (raids, carrier strikes, formation traits, 8-HP
 *  heavies, card swaps) — a v2 log only replays on a round-2 build.
 *  4: playtest round 4 (subs, trucks, aircraft, the new roster and pickups).
 *  5: round 5 (frigate holds station, rarer repairs, 1-damage ballistic spill).
 *  6: round 6 audit (Twin Launch, Quick Reload and frigate reworked; the
 *     Strike Package is now two jets sweeping the screen).
 *  7: round 13 (a cleared wave clears the field and refills the racks,
 *     strike jets destroy subs and trucks, truck roads moved off the bases).
 *  8: V3 round 2 (weapons drop as pickups and load the gun; no ability
 *     activations, so no 'a' commands).
 *  9: V3 round 3 (five weapons replaced: the draft deals a new roster).
 *  10: V3 round 6 (Cryo out; Shrapnel, Frigates, Thermobaric, Scattergun
 *      and Boomerang in: twelve weapons, a new draft roster).
 *  11: V3 round 7 (the Armory's Hull and Supply bays: `armory` can carry a
 *      hull and a supply upgrade, and Armor Plating draws on its own random
 *      stream; Battle Group's frigates take new stations).
 *  12: V3 round 8 (seekers hit for a third and go in threes; Aegis is every
 *      ship's own interceptors, not domes; Carpet Strike burns its row
 *      behind the jet, canister by canister).
 *  (Round 8's dev `tempo` is an optional field: a log without it is a
 *  real-game log and replays as before, so the version stays.)
 *  14: the weapons plan, phases 0–1: the Nuke joins the drops (a new roll),
 *      and the gesture weapons' presses are logged ('d', 'v', 'r').
 *  15: the lock-in: seven weapons cut, the rest dealt by chapter (a
 *      chapter's new weapons come first), the four power-ups that became
 *      boosts leave the campaign's drops.
 *  16: the enemy build: new enemies join the waves by chapter (each in
 *      place of a drone swarm, from their own RNG stream), and Free Play
 *      can choose them (`freePlay.enemies`).
 *  17: the Test Lab: a lab run carries its card (`lab`), which sets its
 *      waves, and the verdict given after it (`labResult`, outside replay).
 *  (The lab's rounds add optional `rev` and `round` to `lab` and
 *  `labResult`: the sim never reads them, and a log without them is round 1,
 *  so the version stays.) */
export const LOG_VERSION = 17;
/** V3 logs say so (and their ids start with "v3-"), so V2's tools and the
 *  shared log store keep the two games apart. */
export const LOG_GAME = 'v3';

/** A Test Lab verdict, as the player gave it. */
export interface LabResult {
  verdict: 'keep' | 'tune' | 'cut' | null;
  tags: string[];
  note: string;
  /** Waves played, how the test ended, and the evidence. */
  waves: number;
  ended: 'done' | 'length' | 'lost';
  stats: LabStats;
  /** The card's version when tested and the test round (absent: round 1,
   *  version 1). */
  rev?: number;
  round?: number;
}
export const SIM_DT = 1 / 60;

/** Compact input encoding: [step, code, ...args]. */
export type LogCommand =
  | [number, 't', number, number, number] // tap x y radius (world units, rounded)
  | [number, 'd', number, number, number] // press down x y radius (a gesture weapon is loaded)
  | [number, 'v', number, number] // the pressed finger moved to x y
  | [number, 'r', number, number, number] // the finger lifted at x y radius
  | [number, 'h', 0 | 1] // Focus: the holding finger down (1) or lifted (0)
  | [number, 'b'] // Test Lab: bring the card's enemy (or weapon) in now
  | [number, 'f', number] // flow step
  | [number, 'm', FormationId] // formation
  | [number, 'u', CardId, AbilityId?] // card picked [, ability it replaced]
  | [number, 'e'] // continue into endless
  | [number, 's', number] // game speed (UI only; kept for context)
  | [number, 'c', Controller] // who is playing from here on (watch mode; UI only)
  | [number, 'g', FlagKind] // the player flagged this moment (UI only)
  | [number, 'p', number]; // the watch-mode bot's own game speed from here on (UI only)

/** Who is at the controls: the player, or the watch-mode bot. */
export type Controller = 'you' | 'bot';
export type FlagKind = 'bug' | 'wrong' | 'hard' | 'easy';

export interface PlayLog {
  v: number;
  game: typeof LOG_GAME;
  id: string;
  /** The Armory the run was played with (one upgrade from each bay). */
  armory: ArmoryLevels;
  build: string;
  startedAt: string;
  endedAt?: string;
  map: MapId;
  seed: number;
  firstWave: number;
  /** Developer playtest mode only: the tempo the run was played at (absent =
   *  the real game), the preset's name, and the run a wave retry restarted
   *  from. Balance analysis should leave these logs out. */
  tempo?: Tempo;
  dev?: { preset: string; retryOf?: string; watch?: boolean; bot?: string };
  /** A Free Play run (round 7): its setup, applied as the game is created. */
  freePlay?: FreePlaySetup;
  /** A Test Lab run: its card, applied after the Free Play setup. */
  lab?: LabSetup;
  /** The verdict the player gave after a Test Lab run, and the evidence
   *  the game counted (none of it touches replay). */
  labResult?: LabResult;
  /** Dev ghost check: the watch-mode bot's run on this same seed and tempo. */
  ghost?: GhostResult;
  device: { w: number; h: number; dpr: number; touch: boolean; ua: string };
  /** How the run ended: won (map cleared and stopped), lost, or quit.
   *  Absent on a mid-run save. */
  end?: 'won' | 'lost' | 'quit';
  /** The app went to the background mid-run (on iPhone, often the last
   *  thing that happens before it is closed): sealed `quit` in case it never
   *  comes back. A run that resumes saves over it. */
  left?: boolean;
  commands: LogCommand[];
  summary?: PlaySummary;
  /** Playtest feedback (none of it touches replay; see sim/feedback.ts):
   *  the player's notes, the attack volleys as met (with any rating), the
   *  run's hard moments marked automatically, and the whole run's rating. */
  notes?: PlayNote[];
  /** A note made on the menu: a log with no run in it, only `notes`. */
  notesOnly?: boolean;
  volleys?: Volley[];
  moments?: Moment[];
  rating?: Rating;
}

export interface GhostResult {
  bot: string;
  wave: number;
  lost: number;
  score: number;
  cleared: boolean;
  /** Ships sunk by the end of each wave, wave by wave. */
  lostByWave: number[];
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
  levels: Partial<Record<AbilityId, number>>;
  /** Weapon pickups taken, by weapon. */
  uses: Partial<Record<AbilityId, number>>;
  /** Each card offered → picked, in order. */
  drafts: { wave: number; offered: CardId[]; picked: CardId; replaced?: AbilityId }[];
  waves: WaveRecord[];
}

/** Where the wave in play began: enough to rebuild the run at that moment
 *  (dev "retry wave"). */
export interface WaveMark {
  wave: number;
  steps: number;
  commands: number;
}

export class Recorder {
  readonly log: PlayLog;
  private drafts: PlaySummary['drafts'] = [];
  mark: WaveMark;
  /** Volleys and moments, followed frame by frame (see `observe`). */
  readonly watch: Watch;

  /** `from` continues an earlier run's inputs (a dev wave retry): the game
   *  passed in must already be that run replayed up to `from.mark`. */
  constructor(
    readonly game: Game,
    meta: Omit<PlayLog, 'v' | 'game' | 'commands' | 'map' | 'seed' | 'id' | 'armory'> & { id?: string },
    from?: { log: PlayLog; mark: WaveMark },
  ) {
    this.log = {
      v: LOG_VERSION,
      game: LOG_GAME,
      id: meta.id ?? `v3-${meta.startedAt.replace(/[^0-9]/g, '').slice(0, 14)}-${game.seed}`,
      armory: { ...game.armory },
      map: game.map.id,
      seed: game.seed,
      commands: from ? from.log.commands.slice(0, from.mark.commands) : [],
      ...meta,
    };
    if (from) this.drafts = (from.log.summary?.drafts ?? []).filter((d) => d.wave < from.mark.wave);
    this.mark = { wave: game.wave, steps: game.steps, commands: this.log.commands.length };
    this.watch = new Watch(game);
  }

  /** Once a frame (and before the UI drains the game's events): keeps the
   *  volleys and the marked moments up to date. */
  observe(): void {
    this.watch.observe(this.game);
  }

  /** The player's note, stamped with this step and the game as it stands. */
  note(n: Omit<PlayNote, 'step' | 'at' | 'ctx'>): PlayNote {
    const note: PlayNote = { step: this.game.steps, at: new Date().toISOString(), ...n, ctx: noteContext(this.game) };
    (this.log.notes ??= []).push(note);
    return note;
  }

  /** The player's rating of a finished volley. */
  rateVolley(index: number, rating: Rating): void {
    const v = this.watch.volleys[index];
    if (v) v.rating = { ...v.rating, ...rating };
  }

  tap(x: number, y: number, radius: number): TapResult {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rr = Math.round(radius);
    // Only taps that could change the game are worth a log line.
    if (this.game.phase === 'wave') this.log.commands.push([this.game.steps, 't', rx, ry, rr]);
    return tap(this.game, rx, ry, rr);
  }

  /** A finger down with a gesture weapon loaded (Charge Lance, Laser
   *  Cutter, Grapnel): the sim's press. */
  press(x: number, y: number, radius: number): void {
    const [rx, ry, rr] = [Math.round(x), Math.round(y), Math.round(radius)];
    if (this.game.phase !== 'wave') return;
    this.log.commands.push([this.game.steps, 'd', rx, ry, rr]);
    press(this.game, rx, ry, rr);
  }

  /** The pressed finger moved (the UI sends at most one a step). */
  move(x: number, y: number): void {
    if (!this.game.press || this.game.phase !== 'wave') return;
    const [rx, ry] = [Math.round(x), Math.round(y)];
    if (rx === Math.round(this.game.press.x) && ry === Math.round(this.game.press.y)) return;
    this.log.commands.push([this.game.steps, 'v', rx, ry]);
    pressMove(this.game, rx, ry);
  }

  /** Focus (a boost): the holding finger down or lifted. It only slows
   *  time; the other finger taps. */
  /** Test Lab: bring the card's enemy (or weapon) in now. */
  bring(): void {
    if (this.game.phase !== 'wave' || !this.game.lab) return;
    this.log.commands.push([this.game.steps, 'b']);
    labBring(this.game);
  }

  focus(down: boolean): void {
    if (this.game.phase !== 'wave' || this.game.finger === down) return;
    this.log.commands.push([this.game.steps, 'h', down ? 1 : 0]);
    focusHold(this.game, down);
  }

  release(x: number, y: number, radius: number): TapResult | null {
    if (!this.game.press) return null;
    const [rx, ry, rr] = [Math.round(x), Math.round(y), Math.round(radius)];
    this.log.commands.push([this.game.steps, 'r', rx, ry, rr]);
    return release(this.game, rx, ry, rr);
  }

  flow(v: number): void {
    this.log.commands.push([this.game.steps, 'f', v]);
    setFlow(this.game, v);
  }

  formation(id: FormationId): void {
    this.log.commands.push([this.game.steps, 'm', id]);
    setFormation(this.game, id);
  }

  pick(id: CardId, replace?: AbilityId): void {
    if (this.game.phase !== 'draft' || !this.game.offer.includes(id)) return;
    this.drafts.push({ wave: this.game.wave, offered: [...this.game.offer], picked: id, ...(replace ? { replaced: replace } : {}) });
    this.log.commands.push(replace ? [this.game.steps, 'u', id, replace] : [this.game.steps, 'u', id]);
    pickUpgrade(this.game, id, replace);
    if ((this.game.phase as Phase) === 'wave') this.mark = { wave: this.game.wave, steps: this.game.steps, commands: this.log.commands.length };
  }

  /** Set off an ability. Only a use that went off is logged. */


  endless(): void {
    this.log.commands.push([this.game.steps, 'e']);
    continueEndless(this.game);
  }

  speed(v: number): void {
    this.log.commands.push([this.game.steps, 's', v]);
  }

  /** Watch mode: the game speed the bot plays at from here on (its
   *  persona's, and faster on a wave it rushes). UI only: the sim doesn't
   *  read it, the analysis tools do. */
  pace(v: number): void {
    this.log.commands.push([this.game.steps, 'p', v]);
  }

  /** Watch mode: the bot or the player takes the controls from this step. */
  control(who: Controller): void {
    this.log.commands.push([this.game.steps, 'c', who]);
  }

  /** The player marked this moment for Claude to look at. */
  flag(kind: FlagKind): void {
    this.log.commands.push([this.game.steps, 'g', kind]);
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

  /** The app is going to the background mid-run: the run so far, sealed as
   *  a quit in case the app is closed now (playtest: an iPhone swipe-away
   *  left logs with no ending). If the player comes back and plays on, the
   *  next save of this id replaces it. */
  left(): PlayLog {
    return { ...this.snapshot(), end: 'quit', endedAt: new Date().toISOString(), left: true };
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
      uses: { ...g.uses },
      drafts: [...this.drafts],
      waves: [...g.history],
    };
    const { volleys, moments } = this.watch;
    return {
      ...this.log,
      commands: [...this.log.commands],
      ...(this.log.notes ? { notes: this.log.notes.map((n) => ({ ...n })) } : {}),
      ...(volleys.length ? { volleys: volleys.map((v) => ({ ...v, threats: { ...v.threats }, ...(v.rating ? { rating: { ...v.rating } } : {}) })) } : {}),
      ...(moments.length ? { moments: [...moments] } : {}),
    };
  }
}

/** Re-run a log from its seed and inputs. Stops at the last recorded step
 *  for a quit, or when the game ends. */
export function replay(log: PlayLog): Game {
  return replayTo(log, log.summary?.steps ?? Infinity, log.commands.length);
}

/** Re-run a log's first `commands` inputs, stopping at step `lastStep`:
 *  with a `WaveMark`, the run exactly as that wave began. */
export function replayTo(log: PlayLog, lastStep: number, commands: number): Game {
  const g = createGame(log.map, log.seed, log.firstWave, log.tempo, log.armory ?? {});
  if (log.freePlay) applyFreePlay(g, log.freePlay);
  if (log.lab) applyLab(g, log.lab);
  const cmds = log.commands.slice(0, commands);
  let i = 0;
  for (let guard = 0; guard < 10_000_000; guard++) {
    while (i < cmds.length && cmds[i][0] <= g.steps) {
      const c = cmds[i++];
      switch (c[1]) {
        case 't':
          tap(g, c[2], c[3], c[4]);
          break;
        case 'd':
          press(g, c[2], c[3], c[4]);
          break;
        case 'v':
          pressMove(g, c[2], c[3]);
          break;
        case 'r':
          release(g, c[2], c[3], c[4]);
          break;
        case 'h':
          focusHold(g, c[2] === 1);
          break;
        case 'b':
          labBring(g);
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

/** Plays a log back from a step onwards, inputs and all, a step at a time:
 *  the result screen's "watch it" on a marked moment. */
export class Playback {
  readonly game: Game;
  private i: number;
  private cmds: LogCommand[];

  constructor(log: PlayLog, from: number) {
    const start = Math.max(0, from);
    let upto = log.commands.findIndex((c) => c[0] > start);
    if (upto < 0) upto = log.commands.length;
    this.game = replayTo(log, start, upto);
    this.cmds = log.commands;
    this.i = upto;
  }

  /** One step: the inputs due now, then the sim. False once it can't go on
   *  (the run ended, or it waits on a draft pick the log doesn't have). */
  advance(): boolean {
    const g = this.game;
    while (this.i < this.cmds.length && this.cmds[this.i][0] <= g.steps) {
      const c = this.cmds[this.i++];
      if (c[1] === 't') tap(g, c[2], c[3], c[4]);
      else if (c[1] === 'd') press(g, c[2], c[3], c[4]);
      else if (c[1] === 'v') pressMove(g, c[2], c[3]);
      else if (c[1] === 'r') release(g, c[2], c[3], c[4]);
      else if (c[1] === 'h') focusHold(g, c[2] === 1);
      else if (c[1] === 'b') labBring(g);
      else if (c[1] === 'f') setFlow(g, c[2]);
      else if (c[1] === 'm') setFormation(g, c[2]);
      else if (c[1] === 'u') pickUpgrade(g, c[2], c[3]);
      else if (c[1] === 'e') continueEndless(g);
    }
    if (g.phase !== 'wave') return this.i < this.cmds.length && this.cmds[this.i][0] <= g.steps;
    step(g, SIM_DT);
    return true;
  }
}
