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
import type { Scorecard } from '../data/scorecard';
import type { EventRecord } from './events';
import {
  applyEncounters,
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
import { WAVE_NOTE_MAX, Watch, noteContext, type Moment, type PlayNote, type Rating, type Volley, type WaveRating } from './feedback';
import { attachTelemetry, type TelHeader, type TelMode, type Telemetry } from './telemetry';
import { applyConvoy, convoyCommand, type CommandResult } from './convoy';
import type { CommandId, ConvoySetup } from '../data/convoy';
import type { EncounterSetup } from '../data/encounters';

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
 *  so the version stays.)
 *  18: special events: a campaign map with one has an 11th wave (its event),
 *      so a run that won at wave 10 now plays on; the lab's 'b' command on an
 *      event card starts the event over; `events` records each event met.
 *      Also Test Lab round 5's weapon notes: Overclock and Time Warp cut, Wild
 *      Card an active, the Gravity Well by size, the Laser Cutter cuts while
 *      held, the Grapnel reaches the whole screen, Focus slows only after a
 *      hold, Bomber Wing hits aircraft and subs as it passes over, Supply Run
 *      without its magnet, Shield's new levels, Hyper Overdrive's twin shots.
 *  19: special events, round 7: every map has an event (the three chapter
 *      finales, Undertow on Dunmar Crossing), the map's event is three runs
 *      (waves 11 to 13) with the convoy restored before the first, and a
 *      bonus Siren Field wave after wave 6 when two passives are held. A run
 *      that won at wave 11 now plays on.
 *  20: enemies and events, round 8: the Torpedo Sub fires one by one at
 *      ships, the Scavenger locks pickups instead of taking them, the
 *      Spotter flies turns and calls shells from off the map, slower
 *      Hydras, Hydra Bloom without its line, Run the Canal cut down, and
 *      Beacon Strike in place of Undertow on Dunmar Crossing.
 *      Also round 8's weapon notes: Focus slows time while its button is
 *      held ('h' commands, no long-press any more), Overdrive level 2 lasts
 *      longer instead of refilling, Wild Card's pickup brings a random
 *      passive from level 2, a thrown Grapnel ball bursts on the first
 *      threat it hits, idle drones fly home, a new Frigate drop sends a
 *      fresh set in, and a lab draft always deals the tested weapon first.
 *  21: round 9 (docs/design/v3-round9-fixes.md): the Scavenger's ring is
 *      twice as wide (240 px), decoys are told apart from launch (the bots,
 *      the broadside and the helpers leave them be), the Decoy Storm sends
 *      twelve swarms with the second half sooner, and the Map & Convoy Lab's
 *      Hold stops the ships short of its line (convoy rules rev 2).
 *  22: Test Lab round 11's map scorecard (docs/design/v3-test-lab.md,
 *      "Scorecard"): a map card's `labResult` can carry `score` (the
 *      player's scorecard) and `variant` (the map's encounter version), and
 *      its `lab` a `variant`. Round 11's game changes (Rush and Disperse cut,
 *      Hold pauses every ship, decoys out of the game, Point Defense at
 *      munitions only, a Cutter tap fires nothing, every weapon hurts a
 *      Lure Beacon, Afterburner Rush with no line, Harbor's opening pairs)
 *      mean a v21 log no longer replays to the same game.
 *  23: Test Lab round 12's fixes (docs/design/v3-round12-encounter-
 *      versions.md, "From the round 11 scorecards"): a rocket truck drives
 *      off at its own speed once it has fired (the Rocket Convoy's and the
 *      Breakout's sped off at about 7 ×), the Afterburner Rush has a Hydra
 *      behind each sprint swarm, and the Breakout's trucks come sooner, three
 *      down each shore road. A v22 log that reaches a boss round no longer
 *      replays to the same game. (The encounters' own changes are lab only
 *      and ride in the log's encounter rev.)
 *  24: Saltgate Canal's locks and frigates (docs/design/v3-saltgate-locks.
 *      md): a lock admits only what its chamber holds (the next hull waits
 *      short of the open entry gate) and its entry shuts after LOCK.grace s
 *      even on a hull in its gateway; frigates berth beside the canal,
 *      coming in from the sides, and no longer open a gate. A v23 Saltgate
 *      log that ran above the default flow, in Column, or with Frigate
 *      Escort no longer replays to the same game. (Every other map plays as
 *      it did: the map-lab baseline replays unchanged.)
 *  25: round 13 (docs/design/v3-round13-escorts-munitions-nuke.md): lane
 *      frigates hold station and sail on tracks clear of every formation's
 *      files and give way to the convoy (they never run over a ship); a
 *      munition still on its launcher (a supersonic arming on its rail) is
 *      no target for anything; the Nuke destroys every enemy on the map,
 *      off the screen and driving off included. A v24 log with frigates, a
 *      supersonic or a Nuke no longer replays to the same game.
 *  26: map rebuild phase 4, The Strait (docs/design/v3-p4-strait.md): the
 *      Afterburner Rush rises from round to round, each run of the ending
 *      sending more sprint swarms and Hydras (EV.rush.more). A v25 log that
 *      reaches The Strait's boss rounds no longer replays to the same game.
 *      (The Strait's new encounters are lab only and ride in the log's
 *      encounter rev, 4.)
 *      Also map rebuild phase 4, The Gauntlet (docs/design/v3-p4-gauntlet.md):
 *      the Rocket Convoy builds up over the three boss rounds (three trucks
 *      a column and one swarm, then three and two, then four and two
 *      smaller swarms, in place of four and three every round). A v25 log
 *      that reaches the Gauntlet's boss rounds (or a bonus Rocket Convoy in
 *      a three-run ending) no longer replays to the same game.
 *  27: after the playtest of the three rebuilt maps (review 2026-11-18;
 *      docs/design/v3-p4-harbor.md, "After the playtest"): a supersonic is
 *      on its rail, no target, for SUPERSONIC.rail (0.4 s) in place of its
 *      whole 1.1 s lock, then lifts off slowly and can be shot (it lands
 *      when it did; the lock line still shows for 1.1 s). And Harbor Mouth's Breakout (encounters
 *      rev 4, MAP_BOSS) sends one sub salvo in round 3, not two. A v26 log
 *      with a supersonic, or that reaches Harbor's third boss round under
 *      the encounter layer, no longer replays to the same game.
 *  28: map rebuild, chapter 1 (docs/design/v3-ch1-kesh.md, v3-ch1-marrow.
 *      md): the Kesh Hook and Lee of Marrow get authored encounters (rev 4,
 *      one a wave, with two new aims: the ship nearest the launcher and the
 *      ship halfway along, plus Marrow's radar tower as a target), boss
 *      rounds that rise (MAP_BOSS: the Drone Storm and Hydra Bloom), and a
 *      map card that plays them by default (the map's own convoy, no
 *      command). All of it is lab only, under the encounter layer: a
 *      campaign run plays as it did. A v28 Kesh or Marrow map-card log needs
 *      this build (an older one would play its encounters as nothing), so
 *      the version moves; a v27 log played none of it (those maps had no
 *      encounter layer, and every other map is unchanged: the map-lab
 *      baseline's twelve runs changed only their version), but as with
 *      every version before, this build lists only its own.
 *  29: after the chapter 1 playtest (review 2026-11-19; docs/design/
 *      v3-ch1-kesh.md and v3-ch1-marrow.md, "After the playtest"): Lee of
 *      Marrow's radar tower slows every enemy inside its sweep to
 *      POST.radarSlow of its pace, in place of speeding your shots at them
 *      (campaign and lab); the Kesh Hook's Drone Storm (encounters rev 4,
 *      MAP_BOSS) sends shells and guided missiles with its swarms, more
 *      each round; the first boss round of every map's three-run ending
 *      opens EVENT.bossCalm s later; and frigates round a bend smoothly
 *      (their bow and their step across eased, the bend's corners
 *      averaged). A v28 log with a frigate on a bent lane, on Marrow, or
 *      that reaches a three-run ending no longer replays to the same game.
 *  30: after the chapter 1 replay (review 2026-11-19 r6; docs/design/
 *      v3-ch1-kesh.md and v3-ch1-marrow.md, "After the v29 replay"): the
 *      Kesh Hook's and Lee of Marrow's waves climb instead of ending on a
 *      cliff (encounters rev 4 reworked, and each map's v1 moves a little
 *      of its shared waves' fire from waves 9-10 to waves 2-6: lab only);
 *      and the first boss round of every map's three-run ending opens on a
 *      calm of EVENT.bossCalm 6 s (5 before), for the intro's four cards. A
 *      v29 Kesh or Marrow map-card log, or one that reaches a three-run
 *      ending, no longer replays to the same game.
 *  31: map rebuild, chapter 2 (docs/design/v3-ch2-island.md,
 *      v3-ch2-behemoth.md): the Island and the Behemoth Run get an encounter
 *      layer (encounters rev 4: one encounter a wave), their map cards open
 *      with it, and their boss rounds rise (MAP_BOSS: the Gunship Wall's and
 *      the Wolf Pack's numbers a round, and launches the round adds). New
 *      for it: the aim 'vip' (the supertanker), and an encounter may
 *      stand in for a map's own extras (`replaces.extras`).
 *      All of it is lab only, under the encounter layer: a campaign run
 *      plays as it did, and a v30 Island or Behemoth card log played its
 *      shared waves.
 *  32: the Armory overhaul (docs/design/v3-armory-overhaul.md): Quick
 *      Reload reloads up to 40% faster (was 30%), Stockpile drops power-ups
 *      up to 3.25× and makes them last 2.5× (was 1.75× and 1.5×), Long
 *      Loads refills the rack on every weapon or boost pickup, and Deep
 *      Magazine adds a round at every level (11 at level 5, was 10). A v31
 *      log with any of those four in its `armory` no longer replays to the
 *      same game; one without them does, but only its own version replays
 *      here. */
export const LOG_VERSION = 32;
/** The log versions this build replays exactly (only its own: round 11
 *  changed the game). Tools that replay logs (Map Analytics, the map lab)
 *  take any of these. */
export const LOG_REPLAYS: readonly number[] = [32];

/** Does this build replay a log of this version exactly? */
export function replaysHere(v: number): boolean {
  return LOG_REPLAYS.includes(v);
}
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
  /** A map card (round 10): the full map or a quick slice. */
  plays?: 'full' | 'slice';
  /** A map card's full run (round 11, log v22): the player's scorecard
   *  (data/scorecard.ts; absent when skipped or left blank), and the map's
   *  encounter version played (absent: 'v1'). */
  score?: Scorecard;
  variant?: string;
}
export const SIM_DT = 1 / 60;

/** Map & Convoy Lab telemetry for a run (sim/telemetry.ts): a sidecar to
 *  its log, never part of it, so the log's format and version stay as they
 *  are and a log without one replays as before. Call it before the game's
 *  first step. `mode` and `player` say what kind of run this is; the events
 *  do not depend on them, so a live run and the replay of its log make the
 *  same sidecar. */
export function logTelemetry(
  g: Game,
  log: Pick<PlayLog, 'id' | 'build' | 'v' | 'firstWave' | 'lab' | 'dev' | 'device'>,
  mode: TelMode,
  player?: string,
  input?: TelHeader['input'],
): Telemetry {
  return attachTelemetry(g, {
    runId: log.id,
    build: log.build,
    logVersion: log.v,
    firstWave: log.firstWave,
    mode,
    player: player ?? log.dev?.bot ?? (log.device.ua === 'mimic' ? 'mimic' : 'human'),
    ...(input ? { input } : {}),
    ...(log.lab ? { lab: { card: log.lab.card, ...(log.lab.length ? { length: log.lab.length } : {}), ...(log.lab.rev !== undefined ? { rev: log.lab.rev } : {}), ...(log.lab.round !== undefined ? { round: log.lab.round } : {}), ...(log.lab.plays ? { plays: log.lab.plays } : {}) } } : {}),
  });
}

/** How to replay: `telemetry` records a sidecar as the log plays (read it
 *  from the game's `tel`). */
export interface ReplayOpts {
  telemetry?: boolean;
}

/** Compact input encoding: [step, code, ...args]. */
export type LogCommand =
  | [number, 't', number, number, number] // tap x y radius (world units, rounded)
  | [number, 'd', number, number, number] // press down x y radius (a gesture weapon is loaded)
  | [number, 'v', number, number] // the pressed finger moved to x y
  | [number, 'r', number, number, number] // the finger lifted at x y radius
  | [number, 'h', 0 | 1] // Focus: the holding finger down (1) or lifted (0)
  | [number, 'b'] // Test Lab: bring the card's enemy (or weapon) in now; an event card: run the event again
  | [number, 'f', number] // flow step
  | [number, 'm', FormationId] // formation
  | [number, 'k', CommandId] // a lab convoy command: rush, disperse, hold (sim/convoy.ts)
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
  /** A Test Lab run: its card, applied after the Free Play setup. A map
   *  card's full run (Test Lab round 10: `plays: 'full'`) has no Free Play
   *  setup: it starts at wave 1 with the player's Armory, as the campaign
   *  does, and `config` says the convoy policy and encounters it was set up
   *  with. A log with `plays: 'full'` needs a build that has it; a log
   *  without replays as before, so the version stays. */
  lab?: LabSetup;
  /** The Map & Convoy Lab: the convoy policy this run was played under
   *  (absent: today's controls, as every campaign run). Applied last. A
   *  log with it, or with a 'k' command, needs a build that has them; a
   *  log without replays as before, so the version stays. */
  convoy?: ConvoySetup;
  /** The Map & Convoy Lab: the map's authored encounters were on (absent:
   *  the shared waves alone, as every campaign run). Applied after the lab
   *  card, before the convoy policy. */
  encounters?: EncounterSetup;
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
  /** Each time this run was continued from its saved state (the menu's
   *  Continue, docs/design/v3-resume-run.md): when, the step it picked up
   *  at, and the build. The run keeps its id and every input, so the log
   *  is still one run (and replays as one); this only says it was played
   *  in more than one sitting. Never read by replay. */
  resumes?: { at: string; step: number; build: string }[];
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
  /** The player's rating of each wave, given on the weapon draft after it
   *  (optional; docs/design/v3-rate-and-review.md), in the order given.
   *  Like `rating` and `notes` it never touches replay: a log with it
   *  replays exactly as one without, so the version stays. */
  waveRatings?: WaveRating[];
  /** Special events met (sim/events.ts): when each started and ended
   *  (steps), what it sent, how it went and the shots fired in it (an older
   *  log's Decoy Storm also counted the shots at decoys). Derived: replay
   *  remakes them. */
  events?: EventRecord[];
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

  /** Map & Convoy Lab telemetry for this run, from here on (call it before
   *  the first step; a wave retry's game already carries its own). */
  telemetry(mode: TelMode, player?: string, input?: TelHeader['input']): Telemetry {
    return this.game.tel ?? logTelemetry(this.game, this.log, mode, player, input);
  }

  /** Continue a saved run (docs/design/v3-resume-run.md): `game` is its log
   *  replayed to the step it was saved at, and this recorder carries on the
   *  same log, id and all: every input so far, the draft picks, the notes,
   *  the volleys and moments as they were marked, and the wave mark. What
   *  the log said about its end (a background's `quit`, `left`) is dropped:
   *  the run is not over. */
  static resume(game: Game, log: PlayLog, mark: WaveMark, build: string, at = new Date().toISOString()): Recorder {
    const { v, game: _game, commands, map: _map, seed: _seed, armory, summary, volleys, moments, events: _events, end: _end, endedAt: _endedAt, left: _left, notes, resumes, ...meta } = log;
    const { waveRatings, ...rest } = meta;
    const rec = new Recorder(game, { ...rest, ...(notes ? { notes: notes.map((n) => ({ ...n })) } : {}), ...(waveRatings ? { waveRatings: waveRatings.map((w) => ({ ...w, rating: { ...w.rating } })) } : {}) });
    rec.log.v = v;
    rec.log.armory = { ...armory };
    rec.log.commands = [...commands];
    rec.log.resumes = [...(resumes ?? []), { at, step: game.steps, build }];
    rec.drafts = (summary?.drafts ?? []).map((d) => ({ ...d, offered: [...d.offered] }));
    rec.mark = { ...mark };
    rec.watch.restore(game, volleys ?? [], moments ?? []);
    return rec;
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

  /** The player's rating of the wave just played (on the draft after it):
   *  any of the three axes and a short note. Rated again, the wave's rating
   *  is replaced; nothing left (no axis, no note) removes it. The game is
   *  not touched. */
  rateWave(wave: number, rating: Rating, note?: string): WaveRating | undefined {
    const list = (this.log.waveRatings ??= []);
    const at = list.findIndex((w) => w.wave === wave);
    const r: Rating = {};
    for (const k of ['difficulty', 'fun', 'intensity'] as const) {
      const v = rating[k];
      if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5) r[k] = v;
    }
    const text = (note ?? '').trim().slice(0, WAVE_NOTE_MAX);
    if (!Object.keys(r).length && !text) {
      if (at >= 0) list.splice(at, 1);
      if (!list.length) delete this.log.waveRatings;
      return undefined;
    }
    const w: WaveRating = { wave, step: this.game.steps, at: new Date().toISOString(), rating: r, ...(text ? { note: text } : {}) };
    if (at >= 0) list[at] = w;
    else list.push(w);
    return w;
  }

  /** The rating given for a wave, if any. */
  waveRating(wave: number): WaveRating | undefined {
    return this.log.waveRatings?.find((w) => w.wave === wave);
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
  /** Test Lab: bring the card's enemy (or weapon) in now. (Never on a map
   *  card's full run: it has nothing of its own to bring.) */
  bring(): void {
    if (this.game.phase !== 'wave' || !this.game.lab || this.game.lab.full) return;
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

  /** A lab convoy command (Rush, Disperse, Hold): logged whether or not
   *  it was accepted, so the replay refuses the same ones. */
  command(id: CommandId): CommandResult {
    if (this.game.phase !== 'wave' || !this.game.convoy) return { ok: false, why: 'policy' };
    this.log.commands.push([this.game.steps, 'k', id]);
    return convoyCommand(this.game, id);
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
      ...(this.log.waveRatings ? { waveRatings: this.log.waveRatings.map((w) => ({ ...w, rating: { ...w.rating } })) } : {}),
      ...(volleys.length ? { volleys: volleys.map((v) => ({ ...v, threats: { ...v.threats }, ...(v.rating ? { rating: { ...v.rating } } : {}) })) } : {}),
      ...(moments.length ? { moments: [...moments] } : {}),
      ...(g.eventLog.length ? { events: g.eventLog.map((e) => ({ ...e, sent: { ...e.sent } })) } : {}),
    };
  }
}

/** One logged input, applied to a game as the live run applied it. The UI-
 *  only codes ('s', 'c', 'g', 'p') change nothing. */
export function applyCommand(g: Game, c: LogCommand): void {
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
    case 'k':
      convoyCommand(g, c[2]);
      break;
    case 'u':
      pickUpgrade(g, c[2], c[3]);
      break;
    case 'e':
      continueEndless(g);
      break;
  }
}

/** Re-run a log from its seed and inputs. Stops at the last recorded step
 *  for a quit, or when the game ends. */
export function replay(log: PlayLog, opts: ReplayOpts = {}): Game {
  const g = replayTo(log, log.summary?.steps ?? Infinity, log.commands.length, opts);
  // A run that was left (a quit, a Test Lab "Done"): its telemetry ends
  // there, as the live run's did.
  if (g.tel && log.end === 'quit' && g.phase !== 'lost' && g.phase !== 'won') g.tel.leave(g);
  return g;
}

/** A log's game as it stood before its first step: the map, seed, wave,
 *  tempo and Armory, then its Free Play setup, lab card, encounters and
 *  convoy policy, in the order the live run applied them. */
export function setupGame(log: PlayLog): Game {
  const g = createGame(log.map, log.seed, log.firstWave, log.tempo, log.armory ?? {});
  if (log.freePlay) applyFreePlay(g, log.freePlay);
  if (log.lab) applyLab(g, log.lab);
  if (log.encounters) applyEncounters(g, log.encounters);
  if (log.convoy) applyConvoy(g, log.convoy);
  return g;
}

/** Re-run a log's first `commands` inputs, stopping at step `lastStep`:
 *  with a `WaveMark`, the run exactly as that wave began. */
export function replayTo(log: PlayLog, lastStep: number, commands: number, opts: ReplayOpts = {}): Game {
  const g = setupGame(log);
  if (opts.telemetry) logTelemetry(g, log, 'replay');
  const cmds = log.commands.slice(0, commands);
  let i = 0;
  for (let guard = 0; guard < 10_000_000; guard++) {
    while (i < cmds.length && cmds[i][0] <= g.steps) applyCommand(g, cmds[i++]);
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

  constructor(log: PlayLog, from: number, opts: ReplayOpts = {}) {
    const start = Math.max(0, from);
    let upto = log.commands.findIndex((c) => c[0] > start);
    if (upto < 0) upto = log.commands.length;
    this.game = replayTo(log, start, upto, opts);
    this.cmds = log.commands;
    this.i = upto;
  }

  /** One step: the inputs due now, then the sim. False once it can't go on
   *  (the run ended, or it waits on a draft pick the log doesn't have). */
  advance(): boolean {
    const g = this.game;
    while (this.i < this.cmds.length && this.cmds[this.i][0] <= g.steps) {
      applyCommand(g, this.cmds[this.i++]);
    }
    if (g.phase !== 'wave') return this.i < this.cmds.length && this.cmds[this.i][0] <= g.steps;
    step(g, SIM_DT);
    return true;
  }
}
