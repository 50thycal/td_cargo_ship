// V3 app shell: menu → (armory) → game → (draft between waves) → result.
// Owns the frame loop, the two side rails, the weapon loadout and the HUD.
// The sim never sees the DOM; this file turns pointer input into `tap()`
// calls and draws whatever the sim holds.

import {
  CARRIER,
  DEFAULT_SPEED,
  DEV_SPEED_STEPS,
  RULES,
  SPEED_STEPS,
  TAP_RADIUS_PX,
  WATCH_SPEED_STEPS,
  THREATS,
  VIEW,
  type ThreatKind,
  type PickupKind,
} from '../data/config';
import { CHAPTERS, MAPS, MAP_ORDER, chapterOf, type MapId } from '../data/maps';
import {
  AB,
  ABILITIES,
  ABILITY_MAX,
  ABILITY_ORDER,
  MAX_SLOTS,
  RESUPPLY_TEXT,
  SHORT_NAME,
  abilityName,
  canSwapIn,
  canTake,
  isSpecialCard,
  type AbilityId,
  type CardId,
} from '../data/abilities';
import { ARMORY, ARMORY_MAX, ARMORY_ORDER, BAY_ORDER, BAYS, CARD_DROPS, SCRAP, armoryLevel, bayItems, levelCost, scrapFor, scrapTally, type ArmoryId, type ArmoryLevels, type BayId, type CardFind, type ScrapEarned } from '../data/armory';
import { equipArmory, isUnlocked, levelUp, loadProgress, recordResult, runLoadout, type Progress } from '../platform/save';
import {
  applyFreePlay,
  commandAdvised,
  createGame,
  freeLevelPick,
  held,
  lossLimit,
  raidWarning,
  shipsSunk,
  warping,
  step,
  tracked,
  type FreePlaySetup,
  type Game,
  type Phase,
  type RaiderKind,
} from '../sim/game';
import { Alerts, CALLOUT_LEVELS, calloutKind, calloutLook, saveCalloutLevel, type AlertOpts, type CalloutIcon, type CalloutKind, type CalloutLevel } from './alerts';
import { BotRun, Mimic, PERSONAS, PERSONA_ORDER, YOU, lostByWave, type BotIO } from '../sim/mimic';
import { LOG_GAME, LOG_VERSION, Playback, Recorder, logTelemetry, playControl, playKind, replay, replayTo, type Controller, type PlayLog } from '../sim/playlog';
import { Restorer, printDiff, runPrint, samePrint } from '../sim/resume';
import { canContinue, canSaveRuns, clearRun, loadRun, makeRunSave, saveRun, timeAgo, type RunSave } from '../platform/runSave';
import { GESTURE_HINT, ROSTER, gestureOf, isBoost, isPrototype, newInChapter } from '../data/roster';
import { FOES, FOES_BUILT, RED_FOES, foeDebutTag, newOnTag, foesInChapter, type FoeSetting } from '../data/foes';
import { foeSetting, launchFoe, mapDebut, redShots, tappedRedShot } from '../sim/foes';
import { applyEncounters, applyLab } from '../sim/game';
import { labDone, labWaves, type LabSetup, type LabStats } from '../sim/lab';
import { LAB_CARDS, LAB_ROUND, cardRev, labCard, mapCardId, type LabCard } from '../data/lab';
import { endingOutcome, eventFor, lastWave } from '../sim/events';
import { EVENTS, EVENT_MAPS, EVENT_WAVE, OUTCOME_NAME, RULE_TEXT, bossIntroCards, bossRound, bossShort, eventName, lastEventWave, waveCount, waveCountParts, waveName, type EventId, type EventOutcome, type IntroCard } from '../data/events';
import {
  addLabEntry,
  roundTitle,
  defaultSetup,
  keepLabLog,
  labRunPlan,
  labDoneButton,
  watchLine,
  labPauseActions,
  labPauseHead,
  labHub,
  labLogs,
  labToolsSheet,
  openLabTools,
  labReport,
  labSetupSheet,
  labVerdictSheet,
  waveStrip,
  newVerdictDraft,
  type VerdictDraft,
  loadLabProgress,
  nextCards,
  saveLabProgress,
  type LabRunSetup,
} from './lab';
import { labArmoryEditor, loadLabArmory, mapNotesSheet } from './labArmory';
import { labArmoryIsAuto, labArmoryLevels } from '../data/labArmory';
import { RUN_RATING_AXES, noteContext, type PlayNote } from '../sim/feedback';
import {
  MAX_THUMBS,
  MOMENT_LOOK,
  captureThumb,
  noteForm,
  notesEnabled,
  ratingRows,
  runStops,
  setNotesEnabled,
  stopWhen,
  timeline,
  volleyName,
  volleySummary,
  waveRateRow,
} from './notes';
import { waveScores } from '../data/scorecard';
import { downloadLog, downloadTelemetry, flushUnsent, localLogs, logChannel, storeLog, type Channel, type UploadState } from '../platform/playlogStore';
import { reconcile, sidecarDigest, type TelemetrySidecar } from '../sim/telemetry';
import type { MapLabMemory } from './mapLab';
import { COMMANDS, CONVOY, type CommandId, type ConvoySetup } from '../data/convoy';
import { applyConvoy, commandState, convoyCommands, holdable, refusalText } from '../sim/convoy';
import { ENCOUNTERS, arcGroups, beatText, calloutsOn, encountersFor, pairBeatText, setupVersion, versionLabel, waveFire, waveScale, type EncounterSetup } from '../data/encounters';
import { enemyPair } from '../data/pairs';
import { DEV_ARMORY, DEV_ORDER, DEV_PRESETS, devEnabled, firstPlayedWave, setDevEnabled, loadDevSettings, saveDevSettings, type DevArmory } from './dev';
import { armoryArtSvg, cardArtSvg } from './cardArt';
import { ICON_COLOR, upgradeIcon } from './icons';
import { type StepSlider } from './rail';
import { AudioEngine } from '../audio/engine';
import { CUE_IDS, LOOP_CUES, MUSIC_CUES, type CueId, type LoopCue, type MusicCue } from '../audio/cues';
import { SOUNDS } from '../audio/manifest';
import { activeLoops, battleMusic } from '../audio/state';
import { chromeSvg, MARK_SVG } from './chrome';
import { calm, mapThumb, quietGame, thumbNow } from './thumbs';
import { DRY_LIFE, IMPACT_LIFE, PICKUP_COLORS, RAID_LOOK, RIPPLE_LIFE, drawFrame, type Ripple } from './render';
import { clearAll, kv } from '../platform/store';
import { clearSeen, meet, seenTypes, type SeenId } from '../platform/seen';
import { mapDebutsFoe } from '../data/mapRules';
import { PRIVACY_URL, STORE, VERSION } from '../platform/flavor';
import { haptic, hapticForCue, hapticsAvailable, hapticsEnabled, setHapticsEnabled } from '../platform/haptics';
import { earned, gameCenterAvailable, showGameCenter, submitBest, unlock } from '../platform/gamecenter';
import { FREE_CHAPTERS, buyFullGame, chapterOwned, onEntitlementChange, ownsFullGame, purchasesAvailable, restoreFullGame, unlockPrice } from '../platform/unlock';

const DT = 1 / 60;
/** Continuing a saved run: the replay's share of each frame (ms), and the
 *  least time "Restoring…" stays up (so it reads as a step, not a flash). */
const RESTORE_SLICE_MS = 12;
const RESTORE_MIN_MS = 450;
/** "Watch it" on the review: seconds before and after the moment. */
const PLAYBACK_BEFORE = 6;
const PLAYBACK_AFTER = 2;
/** A tapped card flashes this long before the next wave starts. */
const PICK_BEAT_MS = 180;
/** Round 11: the moment between a wave ending and its screen. The draft
 *  waits a beat (the player had tapped straight into a card while still
 *  firing at the last threat), and cards ignore taps for a moment after
 *  they appear. Losing gets a slow, dramatic finish before the result. */
/** Round 13: long enough to read the WAVE CLEARED stamp (it was 0.6 s, a
 *  guard against tapping a card by accident; this still covers that). */
const CLEAR_BEAT = 1.4;
const WON_BEAT = 1.2;
const LOST_BEAT = 2.6;
/** A loss finale can be skipped with a tap after this long. */
const LOST_SKIP_AFTER = 0.9;
/** Cards ignore taps for this long after the draft appears. */
const DRAFT_ARM_MS = 350;
/** Round 11: a tough threat shot down freezes the action for a beat (real
 *  seconds; the sim takes the same steps, just a moment later). */
const HIT_STOP = 0.08;
const BIG_KILL_LABEL: Partial<Record<ThreatKind, string>> = {
  heavy: 'HEAVY DOWN',
  mothership: 'MOTHERSHIP DOWN',
  strafer: 'JET DOWN',
  bomber: 'BOMBER DOWN',
  rocketTruck: 'TRUCK DOWN',
  attackHeli: 'HELI DOWN',
  armored: 'ARMOR DOWN',
  stealthJet: 'STEALTH DOWN',
  stealthBomber: 'STEALTH DOWN',
  spotter: 'SPOTTER DOWN',
  siege: 'BATTERY DOWN',
  tender: 'REPAIR SHIP DOWN',
};
/** Cards deal in over DEAL_MS each, DEAL_STAGGER_MS apart (style.css). */
const DEAL_MS = 340;
const DEAL_STAGGER_MS = 70;
const RAIL_W = 72;
/** Margin kept on the landscape side WITHOUT the Dynamic Island (rounded corners only). */
const CORNER_INSET = 16;
/** Launched from the home screen (iOS's standalone web app): the page has
 *  the whole screen, with no browser toolbar to come and go. */
const STANDALONE =
  (typeof navigator !== 'undefined' && (navigator as Navigator & { standalone?: boolean }).standalone === true) ||
  (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches);

/** Weapon feedback is about what the player just did (round 14's rule):
 *  shown at once, one card that each new message replaces. */
const WEAPON_NOTE: AlertOpts = { now: true, key: 'weapon', kind: 'ack', icon: 'zap' };
/** A first meeting, a tip or a map's idea (call-outs round: smaller, and
 *  only at Call-outs: All). */
const HINT: AlertOpts = { kind: 'hint' };
/** Something to react to now: shown at Call-outs: Essential too. */
const WARN: AlertOpts = { kind: 'warn' };

/** Dunmar Crossing (log v58): a spotter beacon's first-sight line. */
const SPOTTER_HINT = 'Marks the ship nearest it (the dashed line) and calls a shell on it. Your helpers can\'t sink it; four hits of your own do.';

const DEBUT_HINT: Partial<Record<ThreatKind, string>> = {
  drone: 'Slow, in swarms. Tap each one, or hold on the swarm.',
  ballistic: 'Fast arc. The red circle is where it lands.',
  guided: 'Homes on a ship. Takes two hits.',
  supersonic: 'Watch for the red lock line, then tap fast.',
  heavy: 'Eight hits to stop. It sinks any ship it reaches and takes half the carrier.',
  cluster: 'Splits near the ships. Hit it early.',
  mothership: 'Drops mini-drones. Kill the source.',
  strafer: 'Strafes the convoy along its line: a tight block takes it all. Three hits.',
  bomber: 'Drops guided missiles on the convoy. Shoot it down before it gets over them.',
  mine: 'Drifts on the current. A ship that touches one takes 3. One shot clears it.',
  fastboat: 'Out of a cove, watch for the white wake. A speedboat rams and burns; a gunboat sails beside one ship and shells it until it sinks; a rocket boat hangs far off and fires red rockets.',
  dreadnought: 'A battleship shelling the convoy from three gun turrets (shoot them out), launching missiles and drones from its silo. Fifty hits to sink it, or ride it out.',
  // The enemy build.
  sprinter: 'A swarm that flares a booster near its ship, then sprints in. Get them before the flare.',
  hydra: 'Kill it and it splits into two darts. Kill it far out, or catch both with a blast.',
  rocketTruck: 'Its red rockets can\'t be stopped. Kill the truck while the red ring fills (four hits).',
  attackHeli: 'Fires missile pairs on sight, hovers, moves. Five hits, or shoot its missiles.',
  torpedoSub: 'Under water, out of reach. It fires two torpedoes, each at a ship, now and then a fast amber one, then dives. Shoot the torpedoes, or get off the dashed lines.',
  armored: 'The plate takes shots from the front. Hit it as it banks (the yellow ring), or use a blast.',
  scavenger: 'Any pickup inside its red ring is locked: you can\'t take it while the drone is there. Three hits frees them.',
  stealthJet: 'No warning: a strafing jet with only a short run-in. Three hits.',
  stealthBomber: 'No warning: a flying wing with three missiles. Six hits, or shoot what it drops.',
  diveBomber: 'The red circle is where it hits. The plane dives in from the top: shoot it, or move the ships out. Its red bomb can\'t be stopped.',
  siege: 'It rises out of a hatch to shell the orange circles; its red shells can\'t be stopped. Hit the gun while it\'s up, or move.',
  spotter: 'It paints a ship and calls shells in from off the map, then flies off and comes back for another, its hits kept. Shoot it down before it calls.',
  tender: 'Sails in, then mends the most damaged enemy near it, a green pulse at a time. Six hits.',
  guard: 'Guard drones take your shots for the heavy. A blast clears the ring; the Railgun goes through.',
  lure: 'Every helper inside its yellow ring fires at it, and does nothing to it. Two hits of your own sink it: a shot, a cut, a blast.',
  cloud: 'A slow firebomb. Shot down or at its ship, it leaves a fireball burning on the water that hurts ships sailing through. Kill it far out.',
};

/** What each map's own system is, said once as the map starts (the 20-map
 *  plan: one new idea a map). */
/** One-time tips on the first map, by wave (see drainEvents): how-to, not
 *  a new type, so only on a fresh save's first campaign runs. */
const FIRST_TIPS: Record<number, [SeenId, string, string]> = {
  1: ['tip:basics', 'WAVE 1', 'Tap threats to shoot them down. Hold to keep firing.'],
  // Round 16: the SHIPS slider and the formation button are gone, and their
  // tips (waves 2 and 3, 'tip:ships' and 'tip:formations') with them.
};

/** The Call-outs setting, as Settings shows it. */
const CALLOUT_LABEL: Record<CalloutLevel, string> = { all: 'All', essential: 'Essential', off: 'Off' };
const CALLOUT_BLURB: Record<CalloutLevel, string> = {
  all: 'Every notice: waves, tips and each new threat the first time.',
  essential: 'Only what needs an answer now: raids, the dreadnought, the last ship.',
  off: 'None, except the last-ship alarm.',
};

const MAP_HINT: Partial<Record<MapId, [string, string]>> = {
  kesh: ['THE HOOK', 'Ships turn north round the cape. Lead your shots round the bend.'],
  behemoth: ['SUPERTANKER', 'One a wave. Eight hits sink it, and it counts as three ships. Get it home.'],
  needle: ['SINGLE FILE', 'The convoy queues at the gap, single file. Guard the queue.'],
  saltgate: ['LOCK GATES', 'Ships wait in each chamber while it fills. Guard them.'],
  battery: ['SHORE BATTERY', 'Two allied guns fire on their own. A hit knocks one out for a while.'],
  sowers: ['MINES', 'Mines drift across the lane on the current. Clear them before a ship sails in.'],
  rigs: ['OIL RIGS', 'Rigs launch from the sea. Bring one down and it stays down.'],
  lantern: ['NIGHT', 'Threats show only as a glow until the beam or your lamp finds them. It stays dark.'],
  dreadnought: ['DREADNOUGHT PASS', 'On waves 3, 6, 9 and 10 a battleship steams through.'],
  coves: ['ATTACK BOATS', 'Speedboats ram, gunboats lock on a ship, rocket boats fire from afar. Watch the white wakes.'],
  delta: ['THE LONG RIVER', 'One river, three times as long: the ships are under fire every mile of it. Trucks on the banks.'],
  crossing: ['TWO-WAY TRAFFIC', 'Outbound east up top, inbound west below. Both edges are a front.'],
  tide: ['THE TIDE', 'The flats lane is open only at high tide. Push ships through while it lasts.'],
  citadel: ['THE CITADEL', 'Destroy the shield generators, then wear the Citadel down: destroyed once, it stays down until the boss.'],
};

/** Round 4: launchers that aren't targets — what they are, what to watch for. */
const VECTOR_HINT: Record<RaiderKind, [string, string]> = {
  sub: ['NEW: Submarine', 'Watch for the periscope: it surfaces and fires a salvo.'],
  popup: ['NEW: Missile truck', 'Drives to the shore, raises its launcher, fires, backs off.'],
  runner: ['NEW: Shore runner', 'Drives the whole coast road, stopping to fire.'],
  parade: ['NEW: Missile truck', 'Drives the road without stopping, raising a missile as it goes. Shoot the missile.'],
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function button(text: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

export class App {
  private progress: Progress = loadProgress();
  /** The chapter the menu is showing (0: pick the furthest one open). */
  private menuChapter = 0;
  private game: Game | null = null;
  /** Every input goes through the recorder, so each run leaves a replayable log. */
  private rec: Recorder | null = null;
  private logState: UploadState | null = null;
  private seedCounter = Date.now() % 100000;

  private canvas = el('canvas', 'v2-canvas');
  private ctx = this.canvas.getContext('2d')!;
  private overlay = el('div', 'v2-overlay');
  private hud = el('div', 'v2-hud');
  private alerts = new Alerts();
  /** Sound (audio/engine.ts): the sim's cues, the UI's, loops and music. */
  private audio = new AudioEngine();
  /** Raid warnings already sounded (one siren per raid). */
  private raidSounded = new Set<string>();
  /** The sound board's music choice while it is open (undefined: closed). */
  private boardMusic: MusicCue | null | undefined = undefined;
  /** Round 16 (the player: "use up that blank space we have on the left"):
   *  no left rail any more. What it held (the golden bomb, the power-up
   *  timers, the map's convoy command) and Focus's button sit in this dock,
   *  an overlay in the battlefield's lower-left corner, inside the safe
   *  area; the battlefield itself takes the width the rail had. */
  private leftRail = el('div', 'v2-rail v2-rail-left v3-dock');
  /** The dock's column: bomb, timers and command, stacked up from the foot. */
  private dockCol = el('div', 'v3-dock-col');
  private rightRail = el('div', 'v2-rail v2-rail-right');
  /** The map's convoy command (round 15: one big button at the foot of the
   *  left rail, Hold on Sowers' Reach; round 16: the foot of the dock).
   *  Every game type: a map with no command shows nothing there (the ship-flow
   *  slider, the formation button and "CONVOY sails itself" are gone). */
  private commandBox = el('div', 'v3-commands');
  private commandBtns: { id: CommandId; el: HTMLButtonElement; state: HTMLElement; bar: HTMLElement; key: string }[] = [];
  private commandsTaught = new Set<CommandId>();
  /** What a command press did, in words beside the buttons: a refusal's
   *  reason, or what a Hold stopped (round 9: a shake alone said nothing). */
  private commandSays = el('div', 'v3-command-says');
  private commandSaysT = 0;
  private pauseBtn = button('II', 'v2-pause', () => this.togglePause());
  /** Playtest notes: the pause menu's "Add a note" and "Rate last volley"
   *  (round 15: the rail's NOTE / RATE button is gone, in every game type;
   *  see openNote / openRate). */
  /** Quartermaster 3+ (Armory): the golden bomb, in the dock from the
   *  run's start until it is tapped (the Nuke's blast, once a run). */
  private bombBtn = button('', 'v3-gold-bomb', () => this.tapGoldBomb());
  private notesOn = !STORE && notesEnabled();
  /** The result screen's run, kept for its review (and a replay's way back). */
  private review: { g: Game; won: boolean; res: ReturnType<typeof recordResult> | null; best: boolean; log: PlayLog | null; ghosted: boolean; rec: Recorder | null } | null = null;
  /** "Watch it": a marked moment playing back, and where it stops. */
  private playback: { pb: Playback; until: number; from: number; stop: number; after?: () => void; lab?: { g: Game; ended: 'done' | 'length' | 'lost' } } | null = null;
  /** Round 14: running power-ups count down here, in the rail, instead of
   *  in a corner of the battlefield (where they sat over roads and trucks). */
  private timers = el('div', 'v2-timers');
  private timersKey = '';
  /** Watch mode: who is playing; tap to take over or hand back. */
  private controlBtn = button('', 'v2-control', () => this.setControl(this.control === 'bot' ? 'you' : 'bot'));
  private speedSlider!: StepSlider;
  /** V3: the weapons you hold, at the bottom of the right rail — nothing to
   *  press (playtest round 2): it shows what can drop and which one is
   *  loaded, draining as its clock runs down. */
  private weaponBar = el('div', 'v3-weapons');
  private weaponChips: HTMLDivElement[] = [];
  /** What each chip shows (rebuilt only when it changes). */
  private weaponKeys: string[] = [];

  /** Developer playtest mode (`?dev=1`): presets that shorten a run, all
   *  maps open, faster speeds, and a wave retry on the loss screen. */
  private dev = !STORE && devEnabled();
  /** The Test Lab (docs/design/v3-test-lab.md): what has been tested, the
   *  test running now (its card and setup; its commands are on the pause
   *  menu), and the setup to start the next one with. */
  private labProgress = loadLabProgress();
  private labRun: { card: LabCard; setup: LabRunSetup; watch?: boolean } | null = null;
  /** The verdict sheet's picks so far, for the test it is about. */
  private labDraft: { run: NonNullable<App['labRun']>; draft: VerdictDraft } | null = null;
  private labLast: LabRunSetup | undefined;
  /** The card a ?lab= link opened: only its test reads the link's
   *  ?convoy=, ?enc= and ?plays= (a comparison); every other card starts
   *  from its own setup. */
  private labLink: string | null = null;
  private devSettings = loadDevSettings();
  private speedSteps = this.dev ? DEV_SPEED_STEPS : SPEED_STEPS;
  /** Watch mode: the bot in this run, and who is at the controls. */
  private bot: Mimic | null = null;
  /** A Test Lab Watch run (log v65): the "you" bot plays a map card on
   *  screen; Take over and Let the bot play swap the controls, and while
   *  the bot plays the player's taps on the field do nothing. */
  private labWatch = false;
  /** The speed the bot is watched at (back to it on Let the bot play). */
  private botSpeed = 1;
  /** Dev ghost check in progress on the result screen. */
  private ghostRun: BotRun | null = null;
  private control: Controller = 'you';
  /** The wave whose draft is on screen (a dev stride deals several in a row). */
  private draftWave = -1;
  /** The Armory bay on show. */
  private armoryBay: BayId = 'gun';
  /** The Armory card picked to show its level-up (null: the bay's equipped
   *  card, or its first one held). */
  private armoryPick: ArmoryId | null = null;
  /** Runs whose Scrap is banked already (a cleared map played on into
   *  endless is recorded again when it ends; its waves pay once). */
  private banked = new WeakSet<Game>();
  /** Free Play: the setup on the menu, and the one the current run uses
   *  (null: a real run). */
  private freeSetup: FreeSetup = loadFreeSetup();
  private free: FreeSetup | null = null;
  /** A card was tapped and its pick is landing (see PICK_BEAT_MS). */
  private picking = false;
  /** The beat in progress between a wave's end and its screen. */
  private beat: { kind: 'clear' | 'won' | 'lost'; t: number; dur: number; focus: { x: number; y: number } } | null = null;
  /** Loss finale camera: zoom about a point (1 = none). */
  private zoom = { z: 1, x: 800, y: 450, pull: 0 };
  private vignette = el('div', 'v2-vignette');
  private stamp = el('div', 'v2-stamp');
  /** A special event's card (as it begins) and its outcome banner (as it
   *  ends): its own centred card, not a corner call-out. */
  private eventCard = el('div', 'v3-event-card');
  private eventCardT = 0;
  /** The boss intro's cards while they play (log v30). */
  private bossIntro: { wave: number; id: EventId; cards: IntroCard[]; shown: number } | null = null;
  /** Seconds of hit-stop left (see HIT_STOP). */
  private hitStop = 0;
  /** One more loss ends the run (see `syncDanger`). */
  private danger = false;
  private dangerEdge = el('div', 'v2-danger');
  /** When the draft appeared (taps on its cards wait DRAFT_ARM_MS). */
  private draftShownAt = 0;
  /** The frozen scene last drawn (see `draw`). */
  private drawnKey = '';
  private botIO: BotIO = {
    tap: (x, y, r) => {
      const res = this.rec!.tap(x, y, r);
      this.ripples.push({ x, y, age: 0, bot: true, dry: res === 'dry' });
      return res;
    },
    pick: (id, replace) => this.rec?.pick(id, replace),
    // No rail control for these any more (round 16); the bots' own sweeps
    // leave them alone outside a lab policy that offers them (sim/mimic.ts).
    flow: (v) => this.rec?.flow(v),
    formation: (id) => this.rec?.formation(id),
    pace: (v) => this.rec?.pace(v),
    goldBomb: () => !!this.rec?.goldBomb(),
    press: (x, y, r) => {
      this.rec?.press(x, y, r);
      this.ripples.push({ x, y, age: 0, bot: true, dry: false });
    },
    move: (x, y) => this.rec?.move(x, y),
    release: (x, y, r) => this.rec?.release(x, y, r) ?? null,
  };
  private speed: number = SPEED_STEPS[DEFAULT_SPEED];
  private paused = false;
  /** Portrait while playing: the field would be a sliver, so time stops and a
   *  "turn sideways" notice shows until the phone is rotated back. */
  private portrait = false;
  /** This run has explained the radar tower (see radarHint). */
  private radarShown = false;
  /** This run has said red shots can't be stopped (see redHint). */
  private redShown = false;
  /** The screens around a run draw a quiet game behind them (menus round):
   *  the map the menu points to, or the one being briefed, its convoy
   *  under way and nothing attacking. */
  private backdrop: Game | null = null;
  private backdropId: MapId | null = null;
  private backdropAcc = 0;
  private stillMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private rotateNote = el('div', 'v2-rotate');
  /** Reads env(safe-area-inset-*) as pixels (notch / Dynamic Island / corners). */
  private safeProbe = el('div', 'v2-safe-probe');
  /** A box the browser itself sizes to the visible viewport (CSS: fixed,
   *  inset 0), read as one more witness of the screen's size beside
   *  innerWidth/innerHeight and visualViewport (log v68, `viewport`). */
  private sizeProbe = el('div', 'v2-size-probe');
  private layoutKey = '';
  /** When the per-frame check last read the safe-area insets, and until when
   *  it reads them every frame (see settle). */
  private insetCheck = 0;
  private settleUntil = 0;
  private acc = 0;
  private last = 0;
  private lastPhase: Phase | null = null;
  private ripples: Ripple[] = [];
  private shake = 0;
  private dpr = 1;
  /** Adaptive resolution: the canvas starts sharp and steps its pixel density
   *  down (2 → 1.5 → 1) if frames run slow for a sustained stretch. Playtest
   *  cycle 6 found the frame cost scales with pixel count, not with the game. */
  private pixelCap = 2;
  private frameAvg = 1000 / 60;
  private lastDrop = 0;
  private scale = 1;
  private offX = 0;
  private offY = 0;
  private hold: { x: number; y: number; since: number; next: number; id: number } | null = null;
  /** A finger pressed with a gesture weapon loaded (Charge Lance, Laser
   *  Cutter, Grapnel): its pointer, and where it last told the sim it was. */
  private gesture: { id: number; x: number; y: number } | null = null;
  /** Focus (a boost; Test Lab round 8: "a button you hold on the left side
   *  of the screen with your left thumb"): the button, shown while Focus
   *  runs, its meter (the slow motion banked, and the boost's own clock),
   *  and the pointer holding it. */
  private focusBtn = el('div', 'v3-focus-btn');
  private focusPointer: number | null = null;
  private focusKey = '';

  constructor(private root: HTMLElement) {
    root.classList.add('v2-root');
    root.classList.toggle('dev', this.dev);
    root.classList.toggle('notes', this.notesOn);
    root.append(this.canvas, this.dangerEdge, this.vignette, this.stamp, this.eventCard, this.alerts.el, this.leftRail, this.rightRail, this.overlay, this.rotateNote, this.safeProbe, this.sizeProbe);
    // Landscape only: on every screen, not just in a run (menus round).
    const phone = el('div', 'v3-rotate-phone');
    phone.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="20" y="6" width="24" height="52" rx="5" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="51" r="2.2" fill="currentColor"/></svg>`;
    this.rotateNote.append(phone, el('strong', '', 'Turn your phone sideways'), el('span', 'v3-rotate-run', 'The game is paused until you do.'), el('span', 'v3-rotate-menu', 'Straitwatch is played in landscape.'));
    this.buildRails();
    this.bindInput();
    this.bindUiSounds();
    // iOS reports the new size late after a rotation, sometimes after the
    // resize event has already fired — so layout is also re-checked every frame
    // (see `frame`) and on every signal that the viewport may have changed.
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.settle());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    // A home-screen launch (or a return to one) can settle its size and its
    // safe-area insets a moment after the first paint, with no resize event
    // (see `settle`): measure again once things have had time to land.
    window.addEventListener('load', () => this.settle());
    window.addEventListener('pageshow', () => this.settle());
    // Log v66 (the player, an iPhone held sideways: "I still have to rotate my
    // screen when it initially loads as it is not sized right"): iOS can leave
    // a freshly loaded page measuring the screen as it was a moment ago, and
    // says nothing when that changes. The first touches, a scroll and a focus
    // are all moments it has changed: measure again at each, early on.
    for (const type of ['pointerdown', 'touchstart', 'scroll', 'focus']) window.addEventListener(type, () => this.recheck(), { passive: true, capture: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.settle();
    });
    // Typing in a dialog (a note, a verdict): the phone's keyboard covers
    // most of a landscape screen (the player: "it blocks me … make sure I can
    // see the text box"). While a text box has the focus, the dialog is fitted
    // to what the keyboard leaves visible and shows only the box and its
    // buttons; the rest comes back when the keyboard goes.
    const fit = () => this.fitTyping();
    window.visualViewport?.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('scroll', fit);
    // Round 12 (the player, on the wave rating's note, an iPhone home-screen
    // app: "I can't see the text when I'm typing"): the one-line note boxes
    // (the wave rating's) are typed in the same way as the text areas.
    this.overlay.addEventListener('focusin', (e) => {
      if (typingBox(e.target)) this.enterTyping(e.target);
    });
    this.overlay.addEventListener('focusout', () => {
      // Late enough that a tap on Save lands on the button where it was.
      setTimeout(() => {
        if (!(typingBox(document.activeElement) && this.overlay.contains(document.activeElement))) this.leaveTyping();
      }, 250);
    });
    new ResizeObserver(() => this.resize()).observe(this.root);
    // A 180° flip between the two landscapes keeps the size but moves the island.
    screen.orientation?.addEventListener('change', () => this.resize());
    window.addEventListener('keydown', (e) => {
      const typing = e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement;
      if (e.code === 'Space' && this.game?.phase === 'wave' && !typing && !this.playback) {
        e.preventDefault();
        this.togglePause();
      }
    });
    // The note boxes' own keyboard (not in the store build, which has no
    // text boxes).
    if (!STORE) {
      void import('./keys').then((k) =>
        k.startKeys(this.root, {
          stamp: () => (this.game ? stopWhen(this.game) : null),
          onChange: () => this.fitTyping(),
        }),
      );
    }
    this.settle();
  }

  /** Seal the current run's log and send it wherever this build can. Safe to
   *  call more than once (a cleared map that continues into endless updates
   *  the same log). */
  /** Map & Convoy Lab telemetry (sim/telemetry.ts): recorded for Test Lab
   *  and dev runs, or with `?tel=1` (`?tel=0`: never). Not in the store
   *  build, and not for ordinary campaign play. It stays on this device:
   *  the play log is what is sent, and any log replays to its telemetry. */
  private telWanted(lab: boolean): boolean {
    if (STORE) return false;
    const q = new URLSearchParams(location.search).get('tel');
    return q === '1' || (q !== '0' && (lab || this.dev));
  }

  /** The last run's telemetry, kept until the next run starts. */
  private lastTel: TelemetrySidecar | null = null;

  /** A saved run being put back (docs/design/v3-resume-run.md): its log
   *  replaying a slice a frame under the Restoring overlay. */
  private restoring: { save: RunSave<RunUI>; rest: Restorer; since: number; bar: HTMLElement; count: HTMLElement } | null = null;

  private endRun(end: 'won' | 'lost' | 'quit'): PlayLog | null {
    if (!this.rec) return null;
    const log = this.rec.finish(end);
    const g = this.rec.game;
    if (g.tel) {
      if (end === 'quit') g.tel.leave(g);
      this.lastTel = g.tel.sidecar(g);
    }
    if (end !== 'won') this.rec = null;
    // A run that has ended can't be continued.
    if (end !== 'quit') clearRun(log.id);
    this.logState = null;
    void Promise.all([storeLog(log), logChannel()]).then(([state, channel]) => {
      this.logState = state;
      this.renderLogStatus(log, channel);
    });
    return log;
  }

  /** Save the run so far without ending it: after each wave, and whenever
   *  the game goes to the background (on iPhone, swiping away to another app
   *  is often the last thing that happens before the page is killed). */
  private saveProgress(): void {
    if (this.rec && this.game && (this.game.phase === 'wave' || this.game.phase === 'draft')) {
      void storeLog(this.rec.snapshot());
      this.keepRun();
    }
  }

  /** The app is going to the background (a call, the home gesture, the
   *  app switcher): pause a wave in progress and save the run so far. */
  background(): void {
    if (this.game?.phase === 'wave' && !this.paused && !this.playback) this.togglePause();
    // Mid-run: keep it to continue later, and seal what there is as a quit
    // (iOS rarely fires pagehide when an app is swiped away, so this may be
    // the last chance). Continued, the same log id carries on and its next
    // save replaces this one.
    if (this.rec && this.game && (this.game.phase === 'wave' || this.game.phase === 'draft') && !this.playback) {
      this.keepRun();
      void storeLog(this.rec.left());
    }
  }

  // -------------------------------------------------------------------------
  // The run in progress (docs/design/v3-resume-run.md): kept at every pause,
  // wave end and trip to the background, continued from the menu.

  /** Can the run in play be kept to continue later? A campaign, Free Play
   *  or Test Lab run mid-wave or in a draft. Not a replay, the dev watch
   *  bot (its own state isn't in the log), or endless (the map's win is
   *  already recorded; leaving endless ends it, as before). */
  private keepable(): boolean {
    const g = this.game;
    const rec = this.rec;
    return !!g && !!rec && rec.game === g && !this.playback && !this.bot && !this.restoring && !g.endless && (g.phase === 'wave' || g.phase === 'draft');
  }

  /** Keep the run in play: its log so far, the step, and a fingerprint of
   *  the game there. False when it can't be kept (see `keepable`), or the
   *  device has no storage. */
  private keepRun(): boolean {
    if (!this.keepable()) return false;
    const g = this.game!;
    const rec = this.rec!;
    // Nothing stays pressed in a kept run (a finger can't be held across
    // leaving): a gesture weapon's press is let go here, as a note does.
    if (g.phase === 'wave') this.dropGesture();
    const save = makeRunSave<RunUI>(rec, {
      kind: this.labRun ? 'lab' : this.free ? 'free' : 'campaign',
      ui: {
        ...(this.free ? { free: structuredClone(this.free) } : {}),
        ...(this.labRun ? { lab: { card: this.labRun.card.id, setup: structuredClone(this.labRun.setup) } } : {}),
        speed: this.speed,
      },
      title: this.labRun ? this.labRun.card.name : g.map.name,
      build: __BUILD__,
    });
    return !!save && saveRun(save);
  }

  /** The pause menu's Quit: keep the run to finish later (the default), or
   *  abandon it. A run that can't be kept quits as it always has. */
  private confirmQuit(): void {
    if (!this.keepable() || !canSaveRuns()) {
      this.quitRun(false);
      return;
    }
    const keep = button('Save and quit', 'v2-btn primary', () => this.quitRun(true));
    keep.dataset.quitSave = '1';
    const drop = button('Abandon run', 'v2-btn v3-abandon', () => this.quitRun(false));
    drop.dataset.quitAbandon = '1';
    const back = button('Back', 'v2-btn', () => this.showPauseMenu());
    back.dataset.quitBack = '1';
    this.showOverlay('v2-pause-panel v3-quit', [el('h2', '', 'Quit to menu'), el('p', 'v2-sub', 'Save this run and finish it later, or abandon it.'), keep, drop, back]);
  }

  /** Off to the menu. `keep`: the run is saved to continue (its log is
   *  sealed as left, as on a trip to the background, and the same id goes
   *  on when it is continued); otherwise it ends as a quit and is gone. */
  private quitRun(keep: boolean): void {
    this.paused = false;
    this.pauseBtn.textContent = 'II';
    const rec = this.rec;
    if (keep && rec && this.keepRun()) {
      void storeLog(rec.left());
      // Not ended: leaving the field must not seal it again.
      this.rec = null;
    } else {
      if (rec) clearRun(rec.log.id);
      this.endRun('quit');
    }
    this.showMenu();
  }

  /** Starting a new run while one is saved: ask first. True if it asked
   *  (`go` runs once the player chooses Start new). A restart of the run in
   *  play (the lab's Setup → Apply) replaces its save without asking. */
  private askBeforeNew(go: () => void): boolean {
    const saved = loadRun<RunUI>();
    if (!saved) return false;
    if (this.rec && this.rec.log.id === saved.log.id) {
      clearRun();
      return false;
    }
    const cont = button('Continue saved run', 'v2-btn primary', () => this.continueRun(saved));
    cont.dataset.askContinue = '1';
    const fresh = button('Start new', 'v2-btn v3-abandon', () => {
      clearRun();
      go();
    });
    fresh.dataset.askNew = '1';
    const back = button('Back', 'v2-btn', () => (saved.kind === 'lab' && !STORE ? this.showLab() : this.showMenu()));
    this.showOverlay('v2-pause-panel v3-ask-saved', [
      el('h2', '', 'You have a saved run'),
      this.savedLine(saved),
      el('p', 'v2-sub', 'Continue your saved run, or start new (the saved run is lost)?'),
      cont,
      fresh,
      back,
    ]);
    return true;
  }

  /** "Harbor Mouth · wave 6 · 12,400 · 3 min ago". */
  private savedLine(save: RunSave<RunUI>): HTMLElement {
    const line = el('p', 'v3-saved-line');
    const where = save.kind === 'lab' ? 'Test Lab' : save.kind === 'free' ? 'Free Play' : MAPS[save.log.map]?.name ?? '';
    line.append(el('b', '', save.title), el('span', '', [where !== save.title ? where : '', waveName(save.wave), `score ${save.score.toLocaleString()}`, timeAgo(save.savedAt)].filter(Boolean).join(' · ')));
    return line;
  }

  /** The menu's (and the Test Lab hub's) Continue: the saved run's map,
   *  how far it got and when. */
  private continueEntry(save: RunSave<RunUI>): HTMLElement {
    const b = button('', `v3-continue${canContinue(save) ? '' : ' old'}`, () => this.continueRun(save));
    b.dataset.continue = save.kind;
    const pic = el('span', 'v3-continue-pic');
    const img = el('img');
    img.alt = '';
    const url = thumbNow(save.log.map);
    if (url) img.src = url;
    else void mapThumb(save.log.map).then((u) => u && (img.src = u));
    pic.append(img);
    const text = el('span', 'v3-continue-text');
    const kind = save.kind === 'lab' ? 'Test Lab' : save.kind === 'free' ? 'Free Play' : '';
    text.append(el('span', 'v3-eyebrow', kind ? `Continue · ${kind}` : 'Continue'), el('strong', '', save.title), el('small', '', [waveCount(save.wave), `Score ${save.score.toLocaleString()}`, timeAgo(save.savedAt)].filter(Boolean).join(' · ')));
    const go = el('span', 'v3-continue-go');
    go.innerHTML = chromeSvg('play', 16);
    b.append(pic, text, go);
    b.setAttribute('aria-label', `Continue ${save.title}, ${waveName(save.wave)}, saved ${timeAgo(save.savedAt)}`);
    return b;
  }

  /** Continue the saved run: replay its log to the step it was saved at
   *  (headless, a slice a frame, under "Restoring…"), check the game there
   *  is the game that was saved, and open it paused. */
  private continueRun(save: RunSave<RunUI>): void {
    if (!canContinue(save) || (save.kind === 'lab' && !labCard(save.ui.lab?.card ?? ''))) {
      this.showOldRun(save);
      return;
    }
    this.leaveRun();
    this.setBackdrop(save.log.map);
    const mode = save.kind === 'lab' ? 'lab' : save.kind === 'free' ? 'freePlay' : 'campaign';
    // The run's telemetry (a lab run's), rebuilt with it: one sidecar for
    // the whole run, as if it had never stopped.
    const attach = this.telWanted(save.kind === 'lab')
      ? (g: Game) => void logTelemetry(g, save.log, mode, 'human', { touch: navigator.maxTouchPoints > 0, w: window.innerWidth, h: window.innerHeight, landscape: window.innerWidth >= window.innerHeight })
      : undefined;
    let rest: Restorer;
    try {
      rest = new Restorer(save.log, save.step, save.commands, attach);
    } catch (e) {
      console.warn('resume: the saved run could not be set up', e);
      this.showOldRun(save);
      return;
    }
    const track = el('div', 'v3-restore-track');
    const bar = el('i');
    track.append(bar);
    // The wave the replay is on, as the HUD says it (the bar shows how far
    // to the saved one).
    const count = el('span', 'v3-restore-count', waveCount(save.log.firstWave));
    const cancel = button('Cancel', 'v2-btn v3-restore-cancel', () => {
      this.restoring = null;
      this.showMenu();
    });
    this.showOverlay('v3-restore', [el('h2', '', 'Restoring…'), this.savedLine(save), track, count, cancel]);
    this.restoring = { save, rest, since: performance.now(), bar, count };
    requestAnimationFrame(() => this.runRestore());
  }

  /** One frame's slice of the replay; then the check, and the run. */
  private runRestore(): void {
    const r = this.restoring;
    if (!r) return;
    let done = false;
    try {
      // (Tests can hold it part way, to see the screen.)
      if (this.restoreCap === null || r.rest.progress < this.restoreCap) done = r.rest.runFor(RESTORE_SLICE_MS);
    } catch (e) {
      console.warn('resume: the replay failed', e);
      this.restoring = null;
      this.showOldRun(r.save);
      return;
    }
    r.bar.style.width = `${(r.rest.progress * 100).toFixed(1)}%`;
    r.count.textContent = this.waveText(r.rest.game);
    // Long enough to read, however fast the replay.
    if (!done || performance.now() - r.since < RESTORE_MIN_MS) {
      requestAnimationFrame(() => this.runRestore());
      return;
    }
    this.restoring = null;
    const g = r.rest.game;
    const now = runPrint(g);
    if (!samePrint(r.save.print, now)) {
      // A newer build plays the same inputs differently: not the same game.
      console.warn('resume: the replay differs from the saved run', printDiff(r.save.print, now));
      this.showOldRun(r.save);
      return;
    }
    this.resumeRun(r.save, g);
  }

  /** The replayed game becomes the run in play, paused: the pause menu up
   *  mid-wave, the draft in a draft (a test that has run its length: its
   *  verdict). The same log carries on (Recorder.resume). */
  private resumeRun(save: RunSave<RunUI>, g: Game): void {
    const ui = save.ui;
    this.resetFinale();
    this.endLabRun();
    this.free = save.kind === 'free' && ui.free ? structuredClone(ui.free) : null;
    const card = save.kind === 'lab' && ui.lab ? labCard(ui.lab.card) : undefined;
    this.radarShown = false;
    this.redShown = false;
    this.lastTel = null;
    this.game = g;
    this.rec = Recorder.resume(g, save.log, save.mark, __BUILD__);
    this.startWatch(false, g.seed);
    if (card && ui.lab) {
      this.labRun = { card, setup: ui.lab.setup };
      this.labLast = ui.lab.setup;
      this.root.classList.add('lab-on');
    }
    if (ui.speed && ui.speed !== this.speed && this.speedSteps.includes(ui.speed)) this.setSpeed(ui.speed);
    this.begin();
    // No beat, no deal: the screen it was on comes straight back.
    this.lastPhase = g.phase;
    this.draftWave = g.wave;
    this.restored = true;
    if (g.phase === 'wave') {
      this.paused = true;
      this.pauseBtn.textContent = '▶';
      this.showPauseMenu();
    } else if (this.labRun && labDone(g)) this.showLabVerdict('length');
    else this.openDraft(g);
    this.restored = false;
  }

  /** Screenshots: hold the restore at this much of the way (null: never). */
  private restoreCap: number | null = null;

  /** Set only while the restored run's first screen is drawn (its pause
   *  menu says so). */
  private restored = false;

  /** A saved run this build can't continue: an older log version, a card
   *  since removed, or a replay that no longer matches. Said in one line;
   *  its map (or card, with its setup) can be started again. The log it
   *  left in the log store stays as it was. */
  private showOldRun(save: RunSave<RunUI>): void {
    this.restoring = null;
    clearRun(save.log.id);
    this.leaveRun();
    const again = button('Start this map again', 'v2-btn primary', () => this.restartSaved(save));
    again.dataset.oldAgain = '1';
    const back = button('Back', 'v2-btn', () => this.showMenu());
    this.showOverlay('v2-pause-panel v3-old-run', [el('h2', '', 'Can\'t continue'), this.savedLine(save), el('p', 'v2-sub', 'This run was from an older version and can\'t be continued.'), again, back]);
  }

  /** The saved run's map from the start: the same card and setup, the same
   *  Free Play setup, or the campaign map. */
  private restartSaved(save: RunSave<RunUI>): void {
    const ui = save.ui;
    if (save.kind === 'lab') {
      const card = ui.lab ? labCard(ui.lab.card) : undefined;
      if (card && ui.lab) this.startLab(card.id, ui.lab.setup);
      else this.showLab();
    } else if (save.kind === 'free' && ui.free) {
      this.play(ui.free.map, ui.free);
    } else if (MAPS[save.log.map]) this.play(save.log.map);
    else this.showMenu();
  }

  start(): void {
    void flushUnsent();
    // Closing the tab mid-run still leaves a log.
    window.addEventListener('pagehide', () => {
      if (this.beat) this.finishBeat();
      if (this.game && (this.game.phase === 'wave' || this.game.phase === 'draft')) {
        this.keepRun();
        this.endRun('quit');
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.background();
      // Back in the app: anything that didn't get through goes now.
      else void flushUnsent();
    });
    // A purchase or restore (or a refund seen at launch) changes which
    // chapters are open: redraw the menu if it is up.
    onEntitlementChange(() => {
      if (this.overlay.dataset.screen === 'menu') this.showMenu();
    });
    // Test hook for the browser smoke test: read the game, map world → screen.
    (window as unknown as { __v3: unknown }).__v3 = {
      game: () => this.game,
      toClient: (x: number, y: number) => ({ x: this.offX + x * this.scale, y: this.offY + y * this.scale }),
      // The enemy build's checks: bring a new enemy in now (from base 1, or
      // from where it comes on its own).
      foe: (kind: ThreatKind, base = 1) => {
        const g = this.game;
        if (!g) return;
        // The stealth aircraft come through the queue (as in a wave).
        if (kind === 'stealthJet' || kind === 'stealthBomber') g.queue.unshift({ at: g.waveT, kind, base: -1 });
        else launchFoe(g, { at: 0, kind, base }, g.map.bases[base]);
      },
      // Stop the clock with no pause menu over the frame (screenshots).
      freeze: (on: boolean) => {
        this.paused = on;
      },
      control: () => this.control,
      // Run the sim on by `seconds` at once, no inputs (screenshots of a
      // special event in progress).
      advance: (seconds: number) => {
        const g = this.game;
        for (let i = 0; g && i < seconds / DT && g.phase === 'wave'; i++) step(g, DT);
      },
      // A call-out as the game would make it (e2e and screenshots of each kind).
      notify: (title: string, sub: string, opts?: AlertOpts) => this.alerts.notify(title, sub, opts),
      // The map behind the screens around a run, and how far it has sailed.
      backdrop: () => (this.backdrop ? { map: this.backdropId, steps: this.backdrop.steps } : null),
      log: () => this.rec?.snapshot() ?? null,
      // The run kept to continue (platform/runSave.ts), and how long this
      // browser takes to rebuild a log at a step, headless (resume timing).
      savedRun: () => loadRun(),
      restoreHold: (at: number | null) => {
        this.restoreCap = at;
      },
      restoreTiming: (log: PlayLog, step: number, commands = log.commands.length) => {
        const t0 = performance.now();
        const r = new Restorer(log, step, commands);
        r.run(Infinity);
        return { ms: performance.now() - t0, steps: r.game.steps, wave: r.game.wave };
      },
      // The Map & Convoy Lab's telemetry of the run in play (or the last one).
      telemetry: () => (this.game?.tel ? this.game.tel.sidecar(this.game) : this.lastTel),
      // Re-run a log here, so a browser test can check a recorded run replays.
      replay: (log: PlayLog) => {
        const g = replay(log);
        return { steps: g.steps, score: g.score, lost: g.lost, wave: g.wave };
      },
      // The same, with telemetry: what a log replays to here, to set beside
      // the sidecar the live run made.
      replayTelemetry: (log: PlayLog) => {
        const g = replay(log, { telemetry: true });
        const sc = g.tel!.sidecar(g);
        return { digest: sidecarDigest(sc), problems: reconcile(sc, g), steps: g.steps, events: sc.events.length };
      },
      telemetryDigest: (sc: TelemetrySidecar) => sidecarDigest(sc),
      // The Map Analytics screen's own numbers, as shown.
      mapLab: () => (this.overlay.querySelector('[data-maplab]') as (HTMLElement & { maplab?: unknown }) | null)?.maplab ?? null,
      // tools/v2/moment.mjs: show a log's game frozen at one step (a flag).
      showMoment: (log: PlayLog, step: number) => this.showMoment(log, step),
      // Sound: the engine's play log and state (e2e checks timing with it).
      audio: {
        log: () => this.audio.log,
        state: () => this.audio.state,
        ready: () => this.audio.ready(),
        settings: () => this.audio.settings,
      },
    };
    this.showMenu();
    // A Test Lab link from the review page: ?lab=<card> opens that test.
    const labLink = !STORE ? new URLSearchParams(location.search).get('lab') : null;
    this.labLink = labLink;
    // ?maplab=1 opens the Map & Convoy Lab's viewer.
    if (!STORE && new URLSearchParams(location.search).get('maplab') === '1') this.showMapLab();
    else if (labLink) {
      if (labCard(labLink)) this.startLab(labLink);
      else this.showLab();
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  // -------------------------------------------------------------------------
  // Rails

  private buildRails(): void {
    // Round 15 (the player: "remove the command and notes buttons on the
    // left in every game type ... the new buttons on the bottom left will
    // replace command options"): no note button in the rail (the pause menu
    // has "Add a note"), and a map's convoy command is one big button at the
    // bottom of the rail (commandBox, laid out there by style.css), which
    // glows when it is the moment for it (commandAdvised).
    // Round 16 (the player: "Drop the slider and all that old stuff"): no
    // ship-flow slider or formation button in any game type. The ships sail
    // the run's schedule and formation (the campaign's DEFAULT_FLOW in
    // Pairs; a lab map's own convoy), and the big button is the one convoy
    // control, where the map has a command.
    // Round 16, full width: the left rail is gone; its pieces and Focus's
    // button sit in the dock over the battlefield's lower-left corner.
    this.dockCol.append(
      this.bombBtn,
      this.timers,
      this.commandBox,
    );
    this.leftRail.append(this.dockCol, this.focusBtn);
    this.bombBtn.innerHTML = GOLD_BOMB_SVG + '<b>BOMB</b>';
    this.bombBtn.dataset.goldBomb = '1';
    this.bombBtn.setAttribute('aria-label', 'Golden bomb: destroy everything attacking, once a run');
    this.bombBtn.hidden = true;

    this.speedSlider = this.buildSpeedSlider();
    // V3: the speed slider shrinks to one button that steps through the
    // speeds, leaving the bottom of the rail to the weapon loadout.
    for (let i = 0; i < MAX_SLOTS; i++) {
      const c = el('div', 'v3-weapon empty') as HTMLDivElement;
      c.dataset.slot = String(i);
      this.weaponChips.push(c);
      this.weaponKeys.push('');
    }
    this.weaponBar.append(...this.weaponChips);
    this.rightRail.append(this.hud, this.pauseBtn, this.controlBtn, this.speedSlider.el, this.weaponBar);
  }

  private buildSpeedSlider(): StepSlider {
    return speedButton(this.speedSteps, DEFAULT_SPEED, (s) => {
      this.speed = this.speedSteps[s];
      this.rec?.speed(this.speed);
      if (this.bot && this.control === 'bot') {
        this.botSpeed = this.speed;
        if (!this.labWatch) {
          this.devSettings.watchSpeed = this.speed;
          saveDevSettings(this.devSettings);
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // Weapon loadout

  /** Per frame: each chip's weapon and level, and the loaded one's clock.
   *  Empty (a dashed circle), held (dim: it can drop), loaded (lit, the
   *  colour draining with the seconds left). */
  private renderWeapons(g: Game): void {
    for (let i = 0; i < MAX_SLOTS; i++) {
      const c = this.weaponChips[i];
      const id = g.slots[i];
      const lv = id ? (g.levels[id] ?? 0) : 0;
      const key = id ? `${id}:${lv}` : '';
      if (key !== this.weaponKeys[i]) {
        this.weaponKeys[i] = key;
        c.className = 'v3-weapon';
        c.replaceChildren();
        c.dataset.ability = id ?? '';
        if (id) {
          c.style.setProperty('--card-color', ICON_COLOR[id]);
          const short = SHORT_NAME[id][lv >= ABILITY_MAX ? 1 : 0];
          c.append(
            el('span', 'v3-weapon-fill'),
            upgradeIcon(id, 22),
            // Nine letters and more ran past a phone's 50 px ring (round 6).
            el('span', short.length >= 9 ? 'v3-weapon-name long' : 'v3-weapon-name', short),
            el('span', 'v3-weapon-lv', lv >= ABILITY_MAX ? 'MAX' : `LV ${lv}`),
            el('span', 'v3-weapon-tag'),
          );
          c.title = `${abilityName(id, lv)}: drops as a pickup`;
        } else {
          c.style.removeProperty('--card-color');
          c.title = 'Empty weapon slot';
        }
      }
      // Loaded: the weapon in either hand (Dual Wield), or the boost running.
      const w = id && g.phase === 'wave' ? (held(g, id) ?? (g.boost?.id === id ? g.boost : null)) : null;
      const state = !id ? 'empty' : w ? 'loaded' : 'held';
      for (const k of ['empty', 'held', 'loaded']) c.classList.toggle(k, k === state);
      c.classList.toggle('boost', !!id && isBoost(id));
      if (id) {
        c.style.setProperty('--left', w ? Math.min(1, w.t / g.stats.weaponTime).toFixed(3) : '0');
        const tag = c.querySelector<HTMLElement>('.v3-weapon-tag')!;
        const gesture = w && g.weapon === w ? gestureOf(w.id) : undefined;
        const secs = w ? `${Math.ceil(w.t)}s` : '';
        const text = !w ? '' : gesture ? `${GESTURE_HINT[gesture].split(':')[0]} ${secs}` : id === 'focus' && g.boost?.id === 'focus' ? `HOLD ${secs}` : secs;
        if (tag.textContent !== text) tag.textContent = text;
      }
    }
  }

  /** Settings → Developer mode. Only ever flipped from the menu, so no run is
   *  in progress; the speed rail is rebuilt for the dev (or normal) steps. */
  private setDev(on: boolean): void {
    setDevEnabled(on);
    this.dev = on;
    this.root.classList.toggle('dev', on);
    this.useSpeedSteps(on ? DEV_SPEED_STEPS : SPEED_STEPS);
  }

  /** Swap the speed rail's steps (normal, dev, or watch), back at 1×. */
  private useSpeedSteps(steps: readonly number[]): void {
    if (steps === this.speedSteps) return;
    this.speedSteps = steps;
    this.speed = steps[DEFAULT_SPEED];
    const slider = this.buildSpeedSlider();
    this.speedSlider.el.replaceWith(slider.el);
    this.speedSlider = slider;
  }

  private togglePause(): void {
    if (this.playback) {
      this.endPlayback();
      return;
    }
    if (!this.game || this.game.phase !== 'wave') return;
    this.paused = !this.paused;
    // Nothing stays held through a pause (Test Lab round 8: Focus's slow
    // motion came back on Resume with no finger down).
    if (this.paused) this.releaseFocus();
    this.pauseBtn.textContent = this.paused ? '▶' : 'II';
    if (this.paused) this.showPauseMenu();
    else this.hideOverlay();
  }

  private showPauseMenu(): void {
    const g = this.game;
    // A pause is a save point: the run can be continued from here.
    this.keepRun();
    const extra: HTMLElement[] = [];
    // A test (pause-menu round): its commands, where the bar along the
    // bottom of the field had them; its Note is the menu's note.
    const run = this.labRun;
    const lab = run && g?.lab ? g.lab : null;
    if (run && lab) {
      extra.push(
        ...labPauseActions(
          run.card,
          {
            // Bring one is an input at this step: the game goes on at once,
            // so the player sees it come.
            bring: () => {
              this.rec?.bring();
              this.togglePause();
            },
            note: () => this.openNote('pause'),
            setup: () => this.openLabSetup(),
            done: () => this.showLabVerdict('done'),
          },
          lab.waves,
          labWaves(lab),
        ),
        ...this.labJumps(g!),
        ...this.watchActions(),
      );
    } else if (this.notesOn && this.rec && g) {
      extra.push(button('📝 Add a note', 'v2-btn v3-pause-note', () => this.openNote('pause')));
    }
    if (this.notesOn && this.rec && g) {
      const last = this.rec.watch.latest();
      if (last) {
        const b = button(`★ Rate last volley: ${volleyName(last.volley)}${last.volley.rating ? ' ✓' : ''}`, 'v2-btn v3-pause-rate', () => this.openRate('pause'));
        extra.push(b);
      }
    }
    const script = g ? this.encounterScript(g) : null;
    const buttons = [
      button('Resume', 'v2-btn primary', () => this.togglePause()),
      ...extra,
      button('Quit to menu', 'v2-btn', () => this.confirmQuit()),
    ];
    // With the encounter script below, or a test's commands, the buttons sit
    // in a row, so the script has the room (a landscape phone is 390 px tall).
    const row = el('div', 'v3-pause-row');
    if (script || lab) row.append(...buttons);
    const head = run && lab && g ? labPauseHead(run.card, this.labStats(g), lab.waves, labWaves(lab), { plays: lab.setup.plays, wave: g.wave }) : el('h2', '', 'Paused');
    // Just continued from a save: say so, and where it stands.
    const back = this.restored && g ? [el('p', 'v3-restored', `Run restored · ${this.waveText(g)} · score ${g.score.toLocaleString()}`)] : [];
    this.showOverlay('v2-pause-panel', [head, ...back, ...(script || lab ? [row, ...(script ? [script] : [])] : buttons)]);
    if (lab) this.overlay.querySelector('.v2-pause-panel')?.classList.add('v3-lab-pause');
  }

  /** Round 11, the developer's view of the run's authored encounters (the
   *  player: "tell me what the script is essentially ... maybe when u
   *  pause"): on a run with the encounter layer on, the pause screen shows
   *  this wave's encounters (name, role, premise, every beat, and the
   *  designer's decision and test) and the map's arc in one line,
   *  this wave marked. Nothing in it is shown during play. */
  private encounterScript(g: Game): HTMLElement | null {
    if (!g.enc) return null;
    const only = g.enc.setup.only;
    // Round 12: the run's own version of the map's encounters.
    const version = setupVersion(g.enc.setup);
    const list = encountersFor(g.map.id, g.wave, version, g.enc.setup.rev).filter((e) => !only || only.includes(e.id));
    const box = el('section', 'v3-enc-script');
    box.dataset.encScript = list.map((e) => e.id).join(' ');
    box.dataset.encVersion = version;
    box.append(el('h3', '', `Encounter script · ${versionLabel(g.map.id, version)} · wave ${g.wave}`));
    const evId = EVENT_MAPS[g.map.id];
    const bossTo = lastEventWave();
    if (!list.length) {
      const boss = !!g.event && !g.event.bonus && g.event.runs > 1;
      box.append(el('p', 'v3-enc-none', boss ? `${bossRound(g.event!.run, g.event!.runs)}: ${eventName(g.event!.id, g.map.id, g.enc.setup.rev)}, the map's own event (no authored encounter).` : g.event?.bonus ? `Bonus wave: ${EVENTS[g.event.id].name} (no authored encounter).` : quietText(waveScale(g.map.id, version, g.wave))));
    }
    for (const e of list) {
      const card = el('div', 'v3-enc-card');
      card.dataset.enc = e.id;
      const title = el('p', 'v3-enc-title');
      title.append(el('b', '', e.name), el('i', '', e.role), el('small', '', `waves ${e.waves[0]}–${e.waves[e.waves.length - 1]}`));
      const beats = el('ol', 'v3-enc-beats');
      // An enemy pair (v3) first, in its order with the beats by time.
      const lines = [
        ...(e.pairs ?? []).map((p) => ({ at: p.at + (p.plus ?? 0) / 100, text: pairBeatText(p, enemyPair(p.pair)?.name ?? p.pair) })),
        ...e.beats.map((b) => ({ at: b.at + (b.plus ?? 0) / 100, text: beatText(b) })),
      ].sort((a, b) => a.at - b.at);
      for (const l of lines) beats.append(el('li', '', l.text));
      const dl = el('dl', 'v3-enc-notes');
      // Round 8 (the player: "we really should not nudge the player with
      // these kits. They should just figure that out alone through play
      // testing"): the encounter's `counters` (how the designer would
      // answer it, at times by kind of weapon) stays a design note in
      // data/encounters.ts and the map cards, never on screen.
      for (const [k, v] of [['Decision', e.decision], ['Works if', e.succeeds]] as const) dl.append(el('dt', '', k), el('dd', '', v));
      card.append(title, el('p', 'v3-enc-premise', e.premise), beats, dl);
      box.append(card);
    }
    // Round 12's fixes: a map's own extra fire, the same in every version.
    const more = waveFire(g.map.id, g.wave, g.enc.setup.rev);
    if (more) box.append(el('p', 'v3-enc-none', `Every version of this map: this wave sends ${Math.round(more * 100)}% more of its own drones and missiles.`));
    const arcLine = el('p', 'v3-enc-arc');
    arcLine.append(el('b', '', 'Arc'));
    for (const a of arcGroups(g.map.id, EVENT_WAVE, evId ? bossTo : 0, evId ? eventName(evId, g.map.id, g.enc.setup.rev) : null, version)) {
      const now = g.wave >= a.from && g.wave <= a.to;
      const chip = el('span', now ? 'now' : '', `${a.from === a.to ? a.from : `${a.from}–${a.to}`} ${a.name}`);
      if (now) chip.dataset.now = '1';
      arcLine.append(chip);
    }
    box.append(arcLine);
    return box;
  }

  // -------------------------------------------------------------------------
  // Playtest notes and volley ratings

  /** The map's part of the canvas, in canvas pixels (for a thumbnail). */
  private thumb(log: { notes?: PlayNote[] } | null): string | undefined {
    if ((log?.notes ?? []).filter((n) => n.thumb).length >= MAX_THUMBS) return undefined;
    const d = this.dpr;
    return captureThumb(this.canvas, { x: this.offX * d, y: this.offY * d, w: VIEW.width * this.scale * d, h: VIEW.height * this.scale * d });
  }

  /** Pause on this step and say something. The note lands in the log with
   *  the step, the game as it stands and a thumbnail, and the run is saved
   *  at once so it reaches Claude even if the game is closed straight after. */
  private openNote(from: 'pause'): void {
    const g = this.game;
    const rec = this.rec;
    if (!g || !rec || g.phase !== 'wave') return;
    this.paused = true;
    this.hold = null;
    this.dropGesture();
    const thumb = this.thumb(rec.log);
    const form = noteForm();
    const done = () => (from === 'pause' ? this.showPauseMenu() : this.resumeFromDialog());
    this.showOverlay('v3-note', [
      el('h2', '', '📝 Note'),
      el('p', 'v2-sub', `${stopWhen(g)}. The game is paused here; Claude gets this moment with your note.`),
      form.el,
      this.dialogButtons('Save note', () => {
        if (form.empty()) return;
        rec.note({ where: 'pause', ...form.value(), ...(thumb ? { thumb } : {}) });
        this.saveProgress();
        done();
        this.showBanner('NOTE SAVED', `${stopWhen(g)}. It's in the log.`, { now: true, kind: 'ack', icon: 'note' });
      }, done),
    ]);
  }

  /** Rate the volley that just ended: difficulty, fun and intensity, 1–5,
   *  and a note if there's more to say. */
  private openRate(from: 'rail' | 'pause'): void {
    const g = this.game;
    const rec = this.rec;
    const last = rec?.watch.latest();
    if (!g || !rec || !last || g.phase !== 'wave') return;
    if (from === 'rail' && this.paused) return;
    this.paused = true;
    this.hold = null;
    this.dropGesture();
    const thumb = this.thumb(rec.log);
    const rows = ratingRows(last.volley.rating);
    const form = noteForm({ placeholder: 'Anything to add? (optional)' });
    const done = () => (from === 'pause' ? this.showPauseMenu() : this.resumeFromDialog());
    this.showOverlay('v3-note v3-rate', [
      el('h2', '', `★ ${volleyName(last.volley)} · wave ${last.volley.wave}`),
      el('p', 'v2-sub', volleySummary(last.volley)),
      rows.el,
      form.el,
      this.dialogButtons('Save', () => {
        if (!rows.any() && form.empty()) return;
        if (rows.any()) rec.rateVolley(last.index, rows.value());
        if (!form.empty()) rec.note({ where: 'volley', volley: last.index, ...form.value(), ...(thumb ? { thumb } : {}) });
        this.saveProgress();
        done();
        this.showBanner('VOLLEY RATED', 'Thanks: it is in the log.', { now: true, kind: 'ack', icon: 'star' });
      }, done),
    ]);
  }

  private dialogButtons(save: string, onSave: () => void, onCancel: () => void, cancel = 'Cancel'): HTMLElement {
    const row = el('div', 'v2-btn-row');
    row.append(button(save, 'v2-btn primary v3-note-save', onSave), button(cancel, 'v2-btn', onCancel));
    return row;
  }

  private resumeFromDialog(): void {
    this.paused = false;
    this.pauseBtn.textContent = 'II';
    this.hideOverlay();
  }

  /** A note from the menu, about the game in general: a log of its own. */
  private openMenuNote(): void {
    const form = noteForm({ placeholder: 'A thought about the game (the 🎤 key dictates)' });
    this.showOverlay('v3-note', [
      el('h2', '', '📝 Note'),
      el('p', 'v2-sub', 'Not about one run? Say it here: it goes to Claude with the build it was made on.'),
      form.el,
      this.dialogButtons('Save note', () => {
        if (form.empty()) return;
        const now = new Date().toISOString();
        const log: PlayLog = {
          v: LOG_VERSION,
          game: LOG_GAME,
          id: `v3-note-${now.replace(/[^0-9]/g, '').slice(0, 14)}`,
          armory: {},
          build: __BUILD__,
          startedAt: now,
          map: MAP_ORDER[0],
          seed: 0,
          firstWave: 1,
          device: this.deviceInfo(),
          commands: [],
          notesOnly: true,
          notes: [{ step: 0, at: now, where: 'menu', ...form.value() }],
        };
        void storeLog(log);
        this.showMenu();
      }, () => this.showMenu()),
    ]);
  }

  // -------------------------------------------------------------------------
  // Input

  private bindInput(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.beat?.kind === 'lost' && (performance.now() - this.beat.t) / 1000 > LOST_SKIP_AFTER) {
        this.finishBeat();
        return;
      }
      const w = this.toWorld(e.clientX, e.clientY);
      if (!w || !this.game || this.paused) return;
      // Watch mode: a touch on the battlefield takes the controls (and
      // counts as your first tap). A Test Lab Watch run takes them only
      // from its Take over button: a touch on the field does nothing.
      if (this.bot && this.control === 'bot' && this.game.phase === 'wave') {
        if (this.labWatch) return;
        this.setControl('you');
      }
      // Focus slows time only from its own button (Test Lab round 8): a
      // touch on the water is always a shot.
      // A gesture weapon (the weapons plan): the finger is a press, not a
      // tap, and holding charges, swipes or drags instead of repeating.
      // A second finger while one is pressed is a plain tap (two thumbs: one
      // charges the Lance, the other keeps shooting).
      if (this.game.phase === 'wave' && gestureOf(this.game.weapon?.id) && this.rec && !this.gesture) {
        this.gesture = { id: e.pointerId, x: w.x, y: w.y };
        this.rec.press(w.x, w.y, TAP_RADIUS_PX / this.scale);
        this.playCues(this.game);
        return;
      }
      this.fire(w.x, w.y);
      // Everyone can hold to keep firing (round 4); the first repeat waits a
      // beat so an ordinary tap never fires twice.
      const first = Math.max(0.35, this.game.stats.holdRepeat);
      this.hold = { ...w, since: performance.now(), next: this.game.t + first, id: e.pointerId };
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.gesture && this.gesture.id === e.pointerId) {
        const w = this.toWorld(e.clientX, e.clientY);
        // A move every 6 px is plenty for a swipe or a swing (and keeps the
        // play log small).
        if (w && Math.hypot(w.x - this.gesture.x, w.y - this.gesture.y) >= 6) {
          this.gesture.x = w.x;
          this.gesture.y = w.y;
          this.rec?.move(w.x, w.y);
          if (this.game) this.playCues(this.game);
        }
        return;
      }
      if (!this.hold || this.hold.id !== e.pointerId) return;
      const w = this.toWorld(e.clientX, e.clientY);
      if (w) Object.assign(this.hold, w);
    });
    const lift = (e: PointerEvent) => {
      if (this.gesture && this.gesture.id === e.pointerId) {
        const w = this.toWorld(e.clientX, e.clientY) ?? this.gesture;
        this.gesture = null;
        const res = this.rec?.release(w.x, w.y, TAP_RADIUS_PX / this.scale);
        if (this.game) this.playCues(this.game);
        if (res === 'empty') this.ripples.push({ x: w.x, y: w.y, age: 0 });
        if (res === 'dry') this.ripples.push({ x: w.x, y: w.y, age: 0, dry: true, label: 'RELOADING' });
      }
      if (this.hold?.id === e.pointerId) this.hold = null;
    };
    this.canvas.addEventListener('pointerup', lift);
    this.canvas.addEventListener('pointercancel', lift);
    this.bindFocusButton();
  }

  /** The Focus button (Test Lab round 8). Held, time slows; let go, and it
   *  runs at speed again. It never fires, and a tap anywhere else is a shot.
   *  The round-7 note ("the slow motion was still going even though I was
   *  not touching the screen") came from a lift that never reached the game:
   *  the slow-motion finger was whichever touched the water first, and only
   *  the canvas's own pointerup let it go. Pausing (the pause button, or the
   *  app going to the background, when iOS may never send the lift) kept it
   *  held, so Resume went straight back into slow motion with no finger
   *  down. Now every way a touch can end lets the button go: its pointer's
   *  up, cancel or lost capture, a touchend anywhere that leaves no touch
   *  on the button, the window losing focus, a pause, the page hiding, the
   *  boost ending. */
  private bindFocusButton(): void {
    const b = this.focusBtn;
    b.setAttribute('role', 'button');
    b.setAttribute('aria-label', 'Hold for slow motion');
    b.dataset.focusBtn = '';
    b.innerHTML = '<span class="v3-focus-ring"></span><span class="v3-focus-face"><b class="v3-focus-secs"></b><small>HOLD</small></span>';
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const g = this.game;
      if (!g || !this.rec || this.paused || this.playback || g.phase !== 'wave' || g.boost?.id !== 'focus') return;
      if (this.bot && this.control === 'bot') {
        if (this.labWatch) return;
        this.setControl('you');
      }
      if (this.focusPointer !== null) return;
      this.focusPointer = e.pointerId;
      try {
        b.setPointerCapture(e.pointerId);
      } catch {
        // A synthetic pointer (tests) can't be captured; the window's
        // listeners still see it go.
      }
      b.classList.add('held');
      this.rec.focus(true);
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId === this.focusPointer) this.releaseFocus();
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    // iOS can lose a pointerup in a crowd of fingers; its touch list never
    // lies: no touch left that started on the button, and it is let go.
    const touches = (e: TouchEvent) => {
      if (this.focusPointer === null) return;
      if (![...e.touches].some((t) => t.target instanceof Node && b.contains(t.target))) this.releaseFocus();
    };
    window.addEventListener('touchend', touches, true);
    window.addEventListener('touchcancel', touches, true);
    window.addEventListener('blur', () => this.releaseFocus());
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Let the Focus button go: time runs at speed again. */
  private releaseFocus(): void {
    if (this.focusPointer === null) return;
    this.focusPointer = null;
    this.focusBtn.classList.remove('held');
    if (this.game?.phase === 'wave') this.rec?.focus(false);
  }

  /** Each frame: the Focus button shows while Focus runs, its dial the
   *  slow motion still banked, and the seconds of it in the middle (round
   *  11: only the bank; the boost's own clock is on its carrier ring and
   *  its chip). Gone, it lets go. */
  private renderFocus(g: Game | null): void {
    const b = g?.boost;
    const on = !!g && !!b && b.id === 'focus' && g.phase === 'wave' && !this.playback && !this.beat;
    if (!on && this.focusPointer !== null) this.releaseFocus();
    // Still held through a fresh Focus pickup (the sim lets go as the old
    // boost ends): the thumb on the button holds the new one.
    if (on && this.focusPointer !== null && !g!.finger) this.rec?.focus(true);
    const bank = on ? b!.bank : 0;
    const full = on ? AB.focus.bank[b!.level - 1] : 1;
    const key = on ? `${bank.toFixed(1)}|${g!.focusing ? 1 : 0}` : '';
    if (key === this.focusKey) return;
    this.focusKey = key;
    const el0 = this.focusBtn;
    el0.classList.toggle('on', on);
    if (!on) return;
    el0.classList.toggle('slow', g!.focusing);
    el0.classList.toggle('empty', bank <= 0);
    el0.style.setProperty('--bank', (bank / full).toFixed(3));
    const secs = el0.querySelector<HTMLElement>('.v3-focus-secs')!;
    const text = bank <= 0 ? 'EMPTY' : `${bank.toFixed(1)}s`;
    if (secs.textContent !== text) secs.textContent = text;
    const tag = el0.querySelector<HTMLElement>('small')!;
    const t2 = g!.focusing ? 'SLOW' : 'HOLD';
    if (tag.textContent !== t2) tag.textContent = t2;
  }

  /** A press still down when play stops (pause, a note, the run ends): let
   *  go of it where the finger last was, so nothing stays held. */
  private dropGesture(): void {
    this.releaseFocus();
    if (!this.gesture) return;
    const at = this.gesture;
    this.gesture = null;
    if (this.game?.phase === 'wave') this.rec?.release(at.x, at.y, TAP_RADIUS_PX / this.scale);
  }

  /** `quiet`: a hold-to-fire repeat, which shouldn't ripple on empty water. */
  private fire(x: number, y: number, quiet = false): void {
    if (!this.game) return;
    if (!this.rec) return;
    // A tap on a red shot (nothing there it could shoot): say so, small,
    // under the finger (Test Lab round 1).
    const red = !quiet && tappedRedShot(this.game, x, y, TAP_RADIUS_PX / this.scale);
    const result = this.rec.tap(x, y, TAP_RADIUS_PX / this.scale);
    this.playCues(this.game);
    if (quiet) return;
    if (red && result !== 'pickup' && result !== 'dry') {
      this.ripples = this.ripples.filter((r) => !r.label);
      this.ripples.push({ x, y, age: 0, dry: true, label: 'CAN\'T INTERCEPT' });
      return;
    }
    if (result === 'empty') this.ripples.push({ x, y, age: 0 });
    if (result === 'dry') {
      // Nothing loaded: say so under the finger, and point at the rack.
      const c = this.game.map.carrier;
      // One label at a time: repeated dry taps restack "RELOADING" into an
      // unreadable pile (round 3 screenshot).
      this.ripples = this.ripples.filter((r) => !r.label);
      this.ripples.push({ x, y, age: 0, dry: true, label: 'RELOADING' });
      this.ripples.push({ x: c.x, y: c.y - CARRIER.halfBeam - 15, age: 0, dry: true });
    }
  }

  private toWorld(cx: number, cy: number): { x: number; y: number } | null {
    const r = this.canvas.getBoundingClientRect();
    const x = (cx - r.left - this.offX) / this.scale;
    const y = (cy - r.top - this.offY) / this.scale;
    if (x < 0 || y < 0 || x > VIEW.width || y > VIEW.height) return null;
    return { x, y };
  }

  /** Safe-area insets in CSS px. In landscape, iOS reports the same inset on
   *  both sides, but only one side has the Dynamic Island; the other only has
   *  rounded corners, so it gets a small margin instead of the full inset. */
  private safeInsets(): { l: number; r: number; t: number; b: number } {
    const cs = getComputedStyle(this.safeProbe);
    let l = parseFloat(cs.paddingLeft) || 0;
    let r = parseFloat(cs.paddingRight) || 0;
    const t = parseFloat(cs.paddingTop) || 0;
    const b = parseFloat(cs.paddingBottom) || 0;
    const angle = screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0;
    // Turned counter-clockwise (90) puts the top of the phone, and the
    // island, on the left; clockwise (270 / -90) puts it on the right.
    if (l > CORNER_INSET && r > CORNER_INSET) {
      if (angle === 90) r = CORNER_INSET;
      else if (angle === 270 || angle === -90) l = CORNER_INSET;
    }
    return { l, r, t, b };
  }

  /** The visible viewport, read from the window rather than from the root's
   *  own box. Round 5: on an iPhone that loaded with Safari's toolbar showing
   *  (874×340), the fixed root kept that height after the toolbar went away,
   *  so the game sat in the top 340 px with a black strip under it — and the
   *  per-frame check, reading the same stale box, never noticed. */
  private viewport(): { w: number; h: number } {
    const vv = window.visualViewport;
    // Log v66: a third witness, a box the browser itself sizes to the
    // screen (CSS fixed, inset 0): a page that loads while the window's and
    // the visual viewport's readings still show the size from before it
    // settled (an upright phone's, say) read too tall, and nothing says
    // when they change. The width is the box's. The height is never made
    // taller by it (with Safari's toolbar showing the box may be taller than
    // what is visible), only cut to it.
    const pb = this.sizeProbe.getBoundingClientRect();
    let w = Math.round(Math.max(window.innerWidth, vv?.width ?? 0)) || this.root.clientWidth;
    let h = Math.round(Math.max(window.innerHeight, vv?.height ?? 0)) || this.root.clientHeight;
    if (pb.width >= 100 && pb.height >= 100) {
      w = Math.round(pb.width);
      h = Math.min(h, Math.round(pb.height));
    }
    // A home-screen app fills the screen and never more. Right after an iOS
    // launch one of the two readings can still be stale, and taking the
    // larger of them then makes the game taller than the screen (its bottom
    // cut off): no reading past the screen itself is believed.
    if (STANDALONE && screen.width > 0 && screen.height > 0) {
      const long = Math.max(screen.width, screen.height);
      const short = Math.min(screen.width, screen.height);
      const wide = w >= h;
      w = Math.min(w, wide ? long : short);
      h = Math.min(h, wide ? short : long);
    }
    return { w, h };
  }

  private static layoutKey(w: number, h: number, sa: { l: number; r: number; t: number; b: number }): string {
    return `${w}x${h}:${sa.l},${sa.r},${sa.t},${sa.b}`;
  }

  /** Lay out now, and again over the next second and a half. The player
   *  (iPhone home-screen app, landscape): "when I first load … it's just not
   *  scaled properly and rotating it back-and-forth seems to reset it". iOS
   *  hands a freshly launched standalone page its safe-area insets (and at
   *  times its final size) only after the first paint, and nothing fires
   *  when they arrive; only a rotation used to make the game measure again. */
  private settle(): void {
    this.resize();
    requestAnimationFrame(() => requestAnimationFrame(() => this.resize()));
    // Log v66: a launch has been seen to take longer than 1.5 s to settle
    // (a slow load, a page opened from a link): keep measuring to 6 s.
    for (const ms of [100, 300, 700, 1500, 2500, 4000, 6000]) setTimeout(() => this.resize(), ms);
    this.settleUntil = performance.now() + 6500;
    this.fixZoom();
  }

  /** Log v66: a touch, a scroll or a focus on a page that has not yet
   *  measured the same screen twice: lay out again at once if it moved, and
   *  keep reading every frame for a moment. */
  private recheck(): void {
    this.settleUntil = Math.max(this.settleUntil, performance.now() + 1200);
    this.checkLayout(performance.now());
    this.fixZoom();
  }

  /** Log v66: iOS can load a page already zoomed in after a turn to
   *  landscape (the page, not the game, is scaled; the player sees it "not
   *  sized right" and a rotation resets it). The viewport tag says 1, 1; put
   *  it back to say so again when the page is not at 1. */
  private fixZoom(): void {
    const scale = window.visualViewport?.scale ?? 1;
    if (Math.abs(scale - 1) < 0.01) return;
    const meta = document.querySelector('meta[name="viewport"]');
    const content = meta?.getAttribute('content');
    if (!meta || !content) return;
    meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover');
    setTimeout(() => meta.setAttribute('content', content), 300);
  }

  private resize(): void {
    const { w, h } = this.viewport();
    // Pin the root to the real viewport so it can't lag behind it.
    this.root.style.width = `${w}px`;
    this.root.style.height = `${h}px`;
    const sa = this.safeInsets();
    this.layoutKey = App.layoutKey(w, h, sa);
    this.insetCheck = performance.now();
    this.portrait = h > w;
    this.root.classList.toggle('portrait', this.portrait);
    this.dpr = Math.min(this.pixelCap, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    // Round 16, full width (the player: "use up that blank space we have on
    // the left"): only the right rail is reserved. The battlefield is fitted
    // to the rest of the screen from its left edge, and stays clear of the
    // left inset (the island) as far as the space it does not need allows:
    // where it needs that width its art runs under the inset (the buttons
    // over it, in the dock, keep to the safe area: style.css). The world is
    // still VIEW; this is the view's scale and offset only.
    const availW = w - sa.r - RAIL_W;
    const availH = h - sa.t - sa.b;
    this.scale = Math.max(0.05, Math.min(availW / VIEW.width, availH / VIEW.height));
    const mapW = VIEW.width * this.scale;
    const mapH = VIEW.height * this.scale;
    this.offX = Math.max(0, Math.min(sa.l, availW - mapW));
    this.offY = sa.t + (availH - mapH) / 2;
    this.root.style.setProperty('--map-left', `${this.offX}px`);
    this.root.style.setProperty('--map-width', `${mapW}px`);
    this.root.style.setProperty('--map-bottom', `${h - this.offY - mapH}px`);
    this.root.style.setProperty('--safe-l', `${sa.l}px`);
    this.root.style.setProperty('--safe-r', `${sa.r}px`);
    this.placeBanner();
  }

  /** Cheap per-frame check that catches a late size report with no event.
   *  The safe-area insets can change with no size change and no event too
   *  (an iOS home-screen launch: they arrive after the first paint), so they
   *  are read as well: every frame while the page settles, then four times a
   *  second (reading them costs a style lookup). */
  private checkLayout(now: number): void {
    const { w, h } = this.viewport();
    if (!this.layoutKey.startsWith(`${w}x${h}:`)) {
      this.resize();
      return;
    }
    if (now < this.settleUntil || now - this.insetCheck >= 250) {
      this.insetCheck = now;
      if (App.layoutKey(w, h, this.safeInsets()) !== this.layoutKey) this.resize();
    }
  }

  // -------------------------------------------------------------------------
  // Loop

  private frame(now: number): void {
    const raw = now - (this.last || now);
    const real = Math.min(0.1, raw / 1000);
    this.last = now;
    this.checkLayout(now);
    const g = this.game;
    this.adaptResolution(now, raw);
    if (this.hitStop > 0) this.hitStop -= real;
    else if (g && this.playback) this.runPlayback(real);
    else if (g && !this.paused && !this.portrait && g.phase === 'wave') {
      // A watched bot plays at its own game speed (you 1.2×, the rusher 2×),
      // so 1× on the slider is that player's real time.
      const pace = this.bot && this.control === 'bot' ? this.bot.pace : 1;
      this.acc += real * this.speed * pace;
      // Enough steps a frame to keep up at 10× on a slow frame; past that,
      // drop the backlog rather than spiral.
      const cap = Math.ceil((this.speed * pace * 0.1) / DT) + 2;
      let n = 0;
      while (this.acc >= DT && n < cap) {
        if (this.bot && this.control === 'bot') this.bot.act(g, this.botIO, false);
        // Cues from taps and picks made since the last step, then the step's own.
        this.playCues(g);
        step(g, DT);
        this.playCues(g, true);
        this.acc -= DT;
        n++;
        if (g.phase !== 'wave') break;
      }
      if (n >= cap) this.acc = Math.min(this.acc, DT);
      // Hold-to-fire repeats on game time, so it scales with the speed slider.
      if (this.hold && g.t >= this.hold.next) {
        this.fire(this.hold.x, this.hold.y, true);
        this.hold.next = g.t + g.stats.holdRepeat;
      }
    }
    else if (!g && this.backdrop && !this.portrait && !this.stillMotion && this.overlay.classList.contains('open')) this.stepBackdrop(real);
    if (g && this.beat) this.runBeat(now, real);
    if (g) {
      if (this.rec?.game === g) this.rec.observe();
      this.drainEvents(g);
      // A dev stride deals a second draft straight after the first: same
      // phase, new wave, so that counts as a change too. A replay's phases
      // are history: no draft or result screen for them.
      if (this.playback) this.lastPhase = g.phase;
      else if (g.phase !== this.lastPhase || (g.phase === 'draft' && g.wave !== this.draftWave)) this.onPhase(g);
      this.renderHud(g);
      this.renderWeapons(g);
      this.syncDanger(g);
    }
    for (const r of this.ripples) r.age += real;
    this.ripples = this.ripples.filter((r) => r.age < (r.impact ? IMPACT_LIFE : r.dry ? DRY_LIFE : RIPPLE_LIFE));
    this.shake = Math.max(0, this.shake - real * 40);
    this.alerts.speed = this.speed;
    this.alerts.update(real);
    if (g) this.raidAlert(g);
    if (g) this.radarHint(g);
    if (g) this.tickBossIntro(g);
    if (g) this.redHint(g);
    this.syncTimers(g);
    this.renderFocus(g);
    this.syncSound(g);
    this.draw();
    requestAnimationFrame((t) => this.frame(t));
  }

  /** Play the cues the sim has asked for since the last drain. `fromStep`:
   *  they came from the step just run (logged with it, for the browser
   *  timing test), not from a tap or a pick between steps. */
  private playCues(g: Game, fromStep = false): void {
    if (!g.cues.length) return;
    const warp = warping(g);
    for (const c of g.cues) {
      this.audio.play(c, fromStep ? g.steps : -1, warp);
      const h = fromStep && !this.playback ? hapticForCue(c.id) : null;
      if (h) haptic(h);
    }
    g.cues.length = 0;
  }

  /** Per frame: the loops the field calls for, and the music bed. */
  private syncSound(g: Game | null): void {
    const live = !!g && g.phase === 'wave' && !this.paused && !this.portrait && !this.beat;
    this.audio.setLoops(live ? activeLoops(g!) : []);
    let music: MusicCue | null = 'menu.music';
    if (g) {
      if (this.beat) music = this.beat.kind === 'clear' ? battleMusic(g) : null;
      else if (g.phase === 'wave' || g.phase === 'draft') music = battleMusic(g);
      else music = 'result.music';
    }
    this.audio.setMusic(this.boardMusic !== undefined ? this.boardMusic : music);
  }

  /** Button sounds, for every button the UI makes: a tap, a step back, a
   *  switch. Buttons with a sound of their own (cards, the Armory) set
   *  data-sfx and are skipped here. */
  private bindUiSounds(): void {
    this.root.addEventListener(
      'click',
      (e) => {
        const b = (e.target as HTMLElement).closest('button');
        if (!b || b.disabled || b.dataset.sfx) return;
        const text = (b.textContent ?? '').trim();
        const back = /^(Back|Menu|Cancel|Quit to menu|Change setup)$/.test(text);
        const toggle = b.classList.contains('v2-switch') || b.classList.contains('v2-dev-chip');
        this.audio.ui(back ? 'ui.back' : toggle ? 'ui.toggle' : 'ui.tap');
      },
      { capture: true },
    );
    this.root.addEventListener('change', (e) => {
      if ((e.target as HTMLElement).tagName === 'SELECT' || (e.target as HTMLElement).tagName === 'INPUT') this.audio.ui('ui.toggle');
    });
  }

  private adaptResolution(now: number, raw: number): void {
    const playing = this.game?.phase === 'wave' && !this.paused && !this.portrait;
    if (!playing || raw <= 0 || raw > 100) return;
    this.frameAvg = this.frameAvg * 0.95 + raw * 0.05;
    const density = Math.min(this.pixelCap, window.devicePixelRatio || 1);
    if (this.frameAvg > 22 && density > 1 && now - this.lastDrop > 1500) {
      this.pixelCap = Math.max(1, density - 0.5);
      this.lastDrop = now;
      this.frameAvg = 1000 / 60;
      this.resize();
    }
  }

  private draw(): void {
    // A frozen scene (draft, result, pause, flag dialog) is drawn once, not
    // 60 times a second: on a phone that redraw alone stalled frames for up
    // to 90 ms, and it slowed the ghost check running underneath.
    const g = this.game ?? this.backdrop;
    const still = !!g && !!this.game && !this.beat && (g.phase !== 'wave' || this.paused || this.portrait) && !this.ripples.length && this.shake <= 0;
    const key = g ? `${g.phase}:${g.steps}:${this.canvas.width}x${this.canvas.height}:${this.offX}:${this.offY}:${this.zoom.z}` : '';
    // The backdrop redraws only when it has stepped (and never while a
    // player who asked for reduced motion is looking at it).
    if ((still || (!this.game && g)) && key === this.drawnKey) return;
    this.drawnKey = still || !this.game ? key : '';
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#070d12';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!g) return;
    if (!this.game) {
      // The backdrop fills the screen edge to edge (no rails to leave room for).
      const cover = Math.max(this.canvas.width / VIEW.width, this.canvas.height / VIEW.height);
      ctx.setTransform(cover, 0, 0, cover, (this.canvas.width - VIEW.width * cover) / 2, (this.canvas.height - VIEW.height * cover) / 2);
      drawFrame(ctx, g, [], 0);
      return;
    }
    const s = this.scale * this.dpr;
    ctx.setTransform(s, 0, 0, s, this.offX * this.dpr, this.offY * this.dpr);
    ctx.beginPath();
    ctx.rect(0, 0, VIEW.width, VIEW.height);
    ctx.clip();
    if (this.zoom.z !== 1) {
      // Push in on the final blow and draw it toward the middle of the screen.
      // Clamped so the zoomed field still covers the whole view.
      const { z, x, y, pull } = this.zoom;
      const cover = (t: number, p: number, size: number) => Math.min(z * p, Math.max(size - z * (size - p), t));
      ctx.translate(cover(x + (VIEW.width / 2 - x) * pull, x, VIEW.width), cover(y + (VIEW.height / 2 - y) * pull, y, VIEW.height));
      ctx.scale(z, z);
      ctx.translate(-x, -y);
    }
    drawFrame(ctx, this.game, this.ripples, this.shake);
  }

  private drainEvents(g: Game): void {
    for (const ev of g.events) {
      switch (ev.kind) {
        case 'special':
          // Round 11 (the player: "just called the 'boss' rounds ... and
          // then say a little blurb at the start like survive the next
          // rounds"): the first of the map's ending runs says what is
          // coming. Log v29 gave the first round a longer calm (EVENT.
          // bossCalm, sim/events.ts) and one banner. Log v30 (the player:
          // "have it say 'boss round', then 'live reset', then what it is,
          // like 'drone swarm', then 'round one', so each text is like a new
          // card pop up"): the event card itself plays a sequence through
          // the calm (bossIntroCards): BOSS ROUND, Convoy restored (the
          // ships that can still be lost), the boss's name, Round 1 of 3;
          // rounds 2 and 3 one card, Round 2 of 3. The convoy restore is
          // round 7's (restoreConvoy, under ENDING.threeRuns): with it off,
          // the second card reads the losses left as they are.
          if (!ev.bonus && ev.runs && ev.runs > 1 && ev.run) {
            const left = Math.max(0, Math.ceil(lossLimit(g) - shipsSunk(g)));
            const restored = g.events.some((e) => e.kind === 'restore');
            this.startBossIntro(g, ev.id, bossIntroCards(ev.id, ev.run, ev.runs, left, restored, eventName(ev.id, g.map.id, g.enc?.setup.rev)));
          } else this.showEventCard(ev.id, ev.wave, ev.bonus ? 'bonus' : '', eventName(ev.id, g.map.id, g.enc?.setup.rev));
          break;
        case 'specialEnd':
          this.showEventOutcome(ev.id, ev.outcome, ev.bonus, ev.runs ? bossShort(ev.run!, ev.runs) : '', eventName(ev.id, g.map.id, g.enc?.setup.rev));
          break;
        case 'encounter': {
          // Round 12: an encounter's call-out as its warning shows (v2, Set
          // pieces; any version with `callouts=1`): its name and one line.
          // A warning, so it shows at Call-outs: Essential too, and at once.
          const e = ENCOUNTERS.find((x) => x.id === ev.id);
          if (e) this.showBanner(e.name.toUpperCase(), e.callout, { now: true, kind: 'warn', tone: 'raid', icon: 'target', key: `enc-${e.id}` });
          break;
        }
        case 'restore':
          // Round 7's experiment: the convoy back to full before the ending
          // (said on the boss intro's second card when the first boss round
          // starts with it, log v30).
          if (!g.events.some((e) => e.kind === 'special' && !e.bonus && e.run === 1)) this.showBanner('CONVOY RESTORED', 'Every ship back, and the carrier\'s hull repaired, for the boss rounds.', { icon: 'info' }, null);
          break;
        case 'wave': {
          // A special event's wave has its own card instead.
          if (g.event?.wave === ev.wave) break;
          // A map's own system is a new type too: said the first time the
          // player plays that map, in any mode, not on every run of it.
          const hint = ev.wave === 1 ? MAP_HINT[g.map.id] : undefined;
          // Playthrough round: the first map teaches the basics. Pause-menu
          // round: how-to, not a new type, so only in the campaign, on the
          // first map, once per save. (Round 16: the slider and formation
          // tips went with the controls.)
          const tip = g.map.id === MAP_ORDER[0] && !this.free && !this.labRun && !g.convoy ? FIRST_TIPS[ev.wave] : undefined;
          const basics = tip?.[0] === 'tip:basics' && this.explain(tip[0]);
          // The wave's bell is the sim's own cue (wave.start). The card is
          // the wave's beat (its number is the HUD's too), never a tip.
          this.showBanner(`WAVE ${ev.wave}`, basics ? tip![2] : '', { icon: 'wave' }, null);
          if (hint && this.explain(`map:${g.map.id}`)) this.showBanner(...hint, { ...HINT, icon: 'info' });
          // The Map & Convoy Lab: this wave's authored encounter, by name,
          // so a tester knows which one they are judging.
          // (Round 12: a version with call-outs names each encounter as it
          // starts instead, so not here as well.)
          const enc = g.enc?.wave === ev.wave ? ENCOUNTERS.find((e) => e.id === g.enc!.now[0]) : undefined;
          if (enc && !calloutsOn(g.map.id, g.enc!.setup)) this.showBanner(`ENCOUNTER: ${enc.name.toUpperCase()}`, enc.premise, { icon: 'info' }, null);
          if (tip && tip[0] !== 'tip:basics' && this.explain(tip[0])) this.showBanner(tip[1], tip[2], { ...HINT, icon: 'info' });
          break;
        }
        case 'tanker':
          // One every wave on Behemoth: said the first time only.
          if (this.explain('ship:supertanker', 'warn')) this.showBanner('SUPERTANKER UNDER WAY', 'Eight hits sink it, and it counts as three ships.', WARN, null);
          break;
        case 'post': {
          const def = g.map.posts?.[ev.post];
          // News, not something to answer: shown at Call-outs: All only.
          if (def?.kind === 'radar' && ev.lost) this.showBanner('RADAR LOST', 'No more tracking for the rest of the run.', {}, null);
          else if (def?.kind === 'radar' && !ev.down) {
            // Hits as the player counts them: a missile or shell takes
            // THREATS.guided.damage of its points (log v32: 6, so three).
            const left = Math.ceil(g.posts[ev.post].hp / THREATS.guided.damage);
            this.showBanner('RADAR HIT', `${left} more ${left === 1 ? 'hit' : 'hits'} and it is lost.`, {}, null);
          }
          else if (def?.kind === 'battery' && ev.down) this.showBanner('BATTERY KNOCKED OUT', 'Back in a few seconds.', {}, null);
          if (ev.down) this.shake = Math.max(this.shake, 10);
          break;
        }
        case 'boss':
          this.showBanner('DREADNOUGHT INBOUND', 'Shoot out its gun turrets, or sink it, or keep the convoy alive till it passes.', WARN, null);
          this.shake = Math.max(this.shake, 8);
          break;
        case 'fork':
          break;
        // Playthrough round: a new threat, launcher or pickup is explained
        // the first time a player meets it, not again on every map (map 2
        // re-taught all of map 1). Pause-menu round: the same memory in the
        // campaign, Free Play and the Test Lab (the player, in the lab: "so
        // drones isn't said every time"); Settings → Show tips again.
        case 'debut': {
          // Log v58 (Dunmar Crossing): a spotter beacon (a Lure Beacon that
          // calls shells, four hits) says so, not a plain beacon's two hits.
          const hint = ev.threat === 'lure' && g.threats.some((t) => t.kind === 'lure' && t.foe?.spot) ? SPOTTER_HINT : (DEBUT_HINT[ev.threat] ?? '');
          // Rule m-debut-tag: a chapter's new enemy says which chapter
          // brought it, as its new weapons' cards do.
          // Round 8: on a Test Lab map card, the map's own new enemies
          // always get their card on their debut, seen before or not, at
          // any Call-outs level but Off (WARN); the campaign: once a device.
          if (g.lab?.full && !this.playback && mapDebutsFoe(g.map.id, ev.threat)) {
            meet(`threat:${ev.threat}`);
            const tag = foeDebutTag(ev.threat);
            this.showBanner(tag ? `${tag}: ${THREATS[ev.threat].label}` : `NEW: ${THREATS[ev.threat].label}`, hint, WARN, null);
          } else if (this.explain(`threat:${ev.threat}`)) {
            const tag = foeDebutTag(ev.threat);
            this.showBanner(tag ? `${tag}: ${THREATS[ev.threat].label}` : `NEW: ${THREATS[ev.threat].label}`, hint, HINT, null);
          }
          break;
        }
        case 'vector':
          if (this.explain(`launcher:${ev.vector}`)) this.showBanner(...VECTOR_HINT[ev.vector], HINT, null);
          break;
        case 'shipLost':
          this.shake = 10;
          this.hud.classList.add('hit');
          setTimeout(() => this.hud.classList.remove('hit'), 300);
          break;
        case 'carrierHit':
          this.shake = 16;
          break;
        case 'goldBomb':
          this.shake = Math.max(this.shake, 18);
          break;
        case 'bigKill': {
          // Watching fast, the freeze shrinks with the speed.
          const stop = HIT_STOP / Math.sqrt(Math.max(1, this.speed));
          this.hitStop = Math.min(0.12, this.hitStop + stop);
          this.shake = Math.max(this.shake, 9);
          // Clear of any word already printed there (a "REPAIRED", another kill).
          let ky = ev.y;
          // (The label is drawn 40 above its point; a text fx at its own.)
          const busy = () =>
            g.fx.some((f) => f.kind === 'text' && f.age < f.life * 0.7 && Math.abs(f.x - ev.x) < 70 && Math.abs(f.y - (ky - 40)) < 24) ||
            this.ripples.some((r) => r.impact && Math.abs(r.x - ev.x) < 70 && Math.abs(r.y - ky) < 24);
          for (let k = 0; k < 4 && busy(); k++) ky -= 26;
          this.ripples.push({ x: ev.x, y: ky, age: 0, impact: ev.label ?? (ev.threat && BIG_KILL_LABEL[ev.threat]) ?? 'DOWN' });
          break;
        }
        case 'dry':
          this.hud.classList.add('dry');
          setTimeout(() => this.hud.classList.remove('dry'), 250);
          break;
        case 'pickup':
          break;
        case 'weapon': {
          // Loaded: its name, its seconds and how to fire it, in one short
          // line (round 4: with what a shot does as well, the notice wrapped
          // to two lines and, on the Island's one-card tray, rose onto the
          // carrier; what it does is on the card you drafted it from).
          // A boost's own time (Overdrive lasts longer from level 2).
          // Pause-menu round: a new weapon type only, the first time it is
          // loaded (the right rail's card shows what is loaded, and its
          // seconds, every time after).
          const secs = g.boost?.id === ev.id ? Math.round(g.boost.t) : g.stats.weaponTime;
          if (this.explain(`weapon:${ev.id}`, 'ack')) this.showBanner(`${abilityName(ev.id, ev.level).toUpperCase()} · ${secs}s`, `${ABILITIES[ev.id].how}.`, WEAPON_NOTE, null);
          this.shake = Math.max(this.shake, 4);
          break;
        }
        case 'wild':
          // Wild Card's pickup brought a passive (Test Lab round 8): the
          // banner names both (it takes the plain one's place).
          if (this.explain(`weapon:wildCard+${ev.id}`, 'ack')) this.showBanner(`WILD CARD + ${abilityName(ev.id, ev.level).toUpperCase()} · ${Math.round(g.wildPassive?.t ?? g.stats.weaponTime * AB.wildCard.time)}s`, `Each tap is a random weapon; the ${ABILITIES[ev.id].name} works on its own.`, WEAPON_NOTE, null);
          break;
        case 'newPickup': {
          const hint = ev.pickup === 'weapon' ? weaponHint(g.stats.weaponTime) : PICKUP_HINT[ev.pickup];
          if (hint && this.explain(`pickup:${ev.pickup}`)) this.showBanner(...hint, { ...HINT, icon: 'info' });
          break;
        }
      }
    }
    g.events.length = 0;
  }

  /** Introduce a type the player meets for the first time (platform/
   *  seen.ts)? Once per save, in every mode: the campaign, Free Play and
   *  the Test Lab share the memory (pause-menu round). Never while the
   *  Call-outs setting hides that kind of card, and then it isn't used up
   *  either: switched back to All, the player still meets it. Never in a
   *  replay (history: nothing in it is met). */
  private explain(id: SeenId, kind: CalloutKind = 'hint'): boolean {
    if (this.playback) return false;
    if (!calloutLook(kind, this.alerts.level)) return false;
    return meet(id);
  }

  /** A call-out (see alerts.ts: how long it stays and who sees it). Its
   *  sound plays only if the card shows. */
  private showBanner(title: string, sub: string, opts: AlertOpts = {}, sound: CueId | null = 'notice'): void {
    this.placeBanner();
    if (sound && calloutLook(calloutKind(opts), this.alerts.level)) this.audio.ui(sound);
    this.alerts.notify(title, sub, opts);
  }

  /** A special event begins: its card in the middle of the field through
   *  the breather. It names the event and any rule in force; it never says
   *  how to beat it (the player's rule). */
  private showEventCard(id: EventId, wave: number, tag: string, name: string = EVENTS[id].name): void {
    const def = EVENTS[id];
    const card = this.eventCard;
    card.className = `v3-event-card${tag === 'bonus' ? ' bonus' : ''}`;
    card.dataset.eventCard = id;
    delete card.dataset.eventOutcome;
    const rules = el('span', 'v3-event-rules');
    for (const r of def.rules) rules.append(el('i', '', RULE_TEXT[r]));
    // A bonus event says so (round 7). A boss round has its own cards
    // (startBossIntro, log v30).
    const eyebrow = tag === 'bonus' ? 'Bonus event' : tag ? `${tag} · wave ${wave}` : `Special event · wave ${wave}`;
    delete card.dataset.bossCard;
    delete card.dataset.bossKey;
    card.replaceChildren(el('span', 'v3-event-eyebrow', eyebrow), el('b', 'v3-event-name', name), ...(def.rules.length ? [rules] : []));
    this.flashEventCard(3200);
  }

  /** A special event is over: its outcome, and what it paid. */
  private showEventOutcome(id: EventId, outcome: EventOutcome, bonus: number, tag: string, name: string = EVENTS[id].name): void {
    const card = this.eventCard;
    this.bossIntro = null;
    delete card.dataset.bossCard;
    delete card.dataset.bossKey;
    card.className = `v3-event-card outcome ${outcome}`;
    card.dataset.eventOutcome = outcome;
    card.replaceChildren(
      el('span', 'v3-event-eyebrow', `${name}${tag ? ` · ${tag}` : ''}`),
      el('b', 'v3-event-name', OUTCOME_NAME[outcome]),
      el('span', 'v3-event-bonus', bonus ? `+${bonus.toLocaleString()} bonus` : outcome === 'broken' ? 'No bonus' : ''),
    );
    this.audio.ui('notice');
    this.flashEventCard(3600);
  }

  /** The boss intro (log v30): its cards on the event card, one after
   *  another, each popping in, timed on the wave's own clock (so a pause or
   *  the speed slider moves them with the calm). */
  private startBossIntro(g: Game, id: EventId, cards: IntroCard[]): void {
    this.eventCardT += 1;
    this.bossIntro = { wave: g.wave, id, cards, shown: -1 };
    this.tickBossIntro(g);
  }

  private tickBossIntro(g: Game): void {
    const bi = this.bossIntro;
    if (!bi) return;
    const card = this.eventCard;
    const t = g.waveT;
    const last = bi.cards[bi.cards.length - 1];
    if (g.wave !== bi.wave || g.phase !== 'wave' || t >= last.until) {
      this.bossIntro = null;
      card.classList.remove('show', 'pop');
      return;
    }
    let k = -1;
    for (let i = 0; i < bi.cards.length; i++) if (t >= bi.cards[i].at) k = i;
    if (k < 0 || k === bi.shown) return;
    bi.shown = k;
    const c = bi.cards[k];
    const rules = el('span', 'v3-event-rules');
    for (const r of EVENTS[bi.id].rules) rules.append(el('i', '', RULE_TEXT[r]));
    card.className = `v3-event-card boss-intro ${c.key}`;
    card.dataset.eventCard = bi.id;
    card.dataset.bossCard = `${k + 1}/${bi.cards.length}`;
    card.dataset.bossKey = c.key;
    delete card.dataset.eventOutcome;
    card.replaceChildren(
      ...(c.eyebrow ? [el('span', 'v3-event-eyebrow', c.eyebrow)] : []),
      el('b', 'v3-event-name', c.title),
      ...(c.key === 'name' && rules.childElementCount ? [rules] : []),
      ...(c.sub ? [el('span', 'v3-event-boss', c.sub)] : []),
    );
    // A pop-in for each card: the animation restarts on every new card.
    void card.offsetWidth;
    card.classList.add('show', 'pop');
    if (k > 0) this.audio.ui('notice');
  }

  private flashEventCard(ms: number): void {
    const card = this.eventCard;
    const t = ++this.eventCardT;
    requestAnimationFrame(() => card.classList.add('show'));
    setTimeout(() => {
      if (this.eventCardT === t) card.classList.remove('show');
    }, ms);
  }

  private hideEventCard(): void {
    this.eventCardT += 1;
    this.bossIntro = null;
    this.eventCard.classList.remove('show');
  }

  /** Lee of Marrow's radar tower, explained the first time it locks on to a
   *  threat, when its lock boxes show what it does (playtest, wave 5: "Not
   *  really sure what that radar tower is even doing"). It used to be a
   *  wave-1 notice, lost among wave 1's own. */
  private radarHint(g: Game): void {
    if (this.radarShown || g.phase !== 'wave' || this.playback) return;
    if (!g.map.posts?.some((p) => p.kind === 'radar') || !g.threats.some((t) => tracked(g, t))) return;
    this.radarShown = true;
    if (this.explain('post:radar')) this.showBanner('RADAR TOWER', 'Drones and missiles in its sweep are slowed (the icy ring). Missiles will go for it.', { ...HINT, icon: 'info' });
  }

  /** Test Lab round 1 ("make the projectiles red ... then we can mention to
   *  the player: red projectiles you just cannot intercept"): the first red
   *  shot in the air in a run gets one small card, without a sound. */
  private redHint(g: Game): void {
    if (this.redShown || g.phase !== 'wave' || this.playback) return;
    if (!redShots(g).length) return;
    this.redShown = true;
    if (this.explain('munition:red')) this.showBanner('RED SHOTS CAN\'T BE STOPPED', 'Hit the launcher instead.', { ...HINT, key: 'red-shots' }, null);
  }

  /** A raid on its way: its card stays up as long as the warning, four
   *  seconds at the most (the bases' rings on the map still say which ones
   *  will fire). Asked every frame: the stack keeps one card for it, and none
   *  again once that card has gone. */
  private raidAlert(g: Game): void {
    const w = raidWarning(g);
    if (!w || this.beat) return;
    const look = RAID_LOOK[w.raid.theme];
    const raid = w.raid;
    const key = `raid-${g.wave}-${raid.at}`;
    if (!this.raidSounded.has(key)) {
      // The siren for a wave's first raid; a short ping for the rest.
      this.audio.ui(raid === g.raids[0] ? 'raid.warning' : 'raid.next');
      this.raidSounded.add(key);
    }
    // Round 16: no formation to change in any game type, so the card says
    // only what is coming (it used to add which formation answers it).
    const tip = look.tip;
    this.alerts.notify(`${look.name} INBOUND`, tip, {
      key,
      tone: 'raid',
      color: look.color,
      alive: () => this.game === g && raidWarning(g)?.raid === raid,
    });
  }

  /** The power-up countdowns in the dock; rebuilt only when a number changes. */
  private syncTimers(g: Game | null): void {
    const chips: [string, number, string][] = [];
    if (g && g.phase === 'wave') {
      // The loaded weapon's seconds show on its own chip in the right rail;
      // a second copy here pushed the power-ups up over the note button
      // (playthrough round).
      if (g.overdriveT > 0) chips.push(['OVERDRIVE', g.overdriveT, PICKUP_COLORS.overdrive]);
      if (g.warpT > 0) chips.push(['TIME WARP', g.warpT, PICKUP_COLORS.timewarp]);
      if (g.shieldT > 0) chips.push(['SHIELD', g.shieldT, PICKUP_COLORS.shield]);
      if (g.steamT > 0) chips.push(['FULL STEAM', g.steamT, PICKUP_COLORS.steam]);
      if (g.flareT > 0) chips.push(['STAR SHELL', g.flareT, PICKUP_COLORS.starshell]);
      // Wild Card's passive (Test Lab round 8): what it brought, and for how long.
      const wp = g.wildPassive;
      if (wp) chips.push([SHORT_NAME[wp.id][wp.level >= ABILITY_MAX ? 1 : 0], wp.t, ICON_COLOR[wp.id]]);
    }
    const key = chips.map(([l, t]) => `${l}${Math.ceil(t)}`).join();
    if (key === this.timersKey) return;
    this.timersKey = key;
    this.timers.replaceChildren(
      ...chips.map(([label, t, color]) => {
        const chip = el('div', 'v2-timer');
        chip.style.setProperty('--chip', color);
        chip.append(el('span', '', label), el('b', '', `${Math.ceil(t)}`));
        return chip;
      }),
    );
  }

  /** The call-out stack sits in the corner by CSS; here, one card at a time
   *  where two would reach the carrier (its deck and the rack above it). */
  private placeBanner(): void {
    const c = this.game?.map.carrier;
    if (!c) return;
    const at = (x: number, y: number) => [this.offX + x * this.scale, this.offY + y * this.scale];
    const [x0, y0] = at(c.x - CARRIER.halfLength - 6, c.y - CARRIER.halfBeam - 22);
    const [x1, y1] = at(c.x + CARRIER.halfLength + 6, c.y + CARRIER.halfBeam + 4);
    this.alerts.place({ x0, y0, x1, y1 });
  }

  /** Does this run bank Scrap (and Armory cards)? Not Free Play, the Test
   *  Lab, a replay or a developer's run. */
  private earnsScrap(): boolean {
    return !this.dev && !this.free && !this.labRun && !this.playback;
  }

  /** The Scrap a run has earned so far from its waves, boss rounds and the
   *  clear (the first-clear bonus and duplicate cards come at the end). */
  private runScrap(g: Game): ScrapEarned {
    return scrapFor(scrapTally(g.history, RULES.wavesToClear, lastWave(g)), g.cleared, false, 0, armoryLevel(g.armory, 'salvage'));
  }

  /** The counter's two lines for the game in play (data/events.ts
   *  waveCountParts): ["WAVE", "3 of 10"], ["BOSS", "1/3"]. */
  private waveParts(g: Game): [string, string] {
    const boss = g.event && !g.event.bonus && g.event.runs > 1 ? { run: g.event.run, runs: g.event.runs } : null;
    // A Test Lab event card's single run counts as itself ("WAVE 11").
    const lone = !!g.event && !g.event.bonus && !boss;
    const [head, count] = waveCountParts(g.wave, { boss, bonus: !!g.event?.bonus, endless: g.endless || lone });
    return [head, head === 'BONUS' ? 'WAVE' : count];
  }

  /** The same in words: "Wave 3 of 10", "Boss 1/3". */
  private waveText(g: Game): string {
    const boss = g.event && !g.event.bonus && g.event.runs > 1 ? { run: g.event.run, runs: g.event.runs } : null;
    const lone = !!g.event && !g.event.bonus && !boss;
    return waveCount(g.wave, { boss, bonus: !!g.event?.bonus, endless: g.endless || lone });
  }

  /** The golden bomb tapped: the Nuke's blast, logged ('n'). Not while the
   *  bot has the controls or a replay plays. */
  private tapGoldBomb(): void {
    const g = this.game;
    if (!g || this.paused || this.playback || (this.bot && this.control === 'bot')) return;
    if (this.rec?.goldBomb()) this.syncGoldBomb(g);
  }

  /** The golden bomb's button: shown while the run has one left. */
  private syncGoldBomb(g: Game): void {
    const show = g.bombsLeft > 0 && (g.phase === 'wave' || g.phase === 'draft');
    if (this.bombBtn.hidden === show) this.bombBtn.hidden = !show;
    const off = g.phase !== 'wave' || !!this.playback || (!!this.bot && this.control === 'bot');
    if (this.bombBtn.disabled !== off) this.bombBtn.disabled = off;
  }

  private renderHud(g: Game): void {
    this.syncGoldBomb(g);
    if (this.commandBtns.length) this.renderCommands(g);
    // Lifeboats (Armory): each extra life is one more pip, drawn as a
    // lifeboat's (orange), after the run's own.
    const sunk = shipsSunk(g);
    const base = g.tempo.lossLimit;
    const pips = Array.from({ length: lossLimit(g) }, (_, i) => {
      const boat = i >= base ? ' life' : '';
      return i < sunk ? `<i class="lost${boat}"></i>` : i === sunk && this.danger ? `<i class="next${boat}"></i>` : `<i${boat ? ' class="life"' : ''}></i>`;
    }).join('');
    // A bonus wave is not one of the map's: the counter says so. A run of
    // the map's ending is a boss round (round 11): "BOSS 1/3".
    // The 2026-11-20 playtest: "Wave 3 of 10" on every map, and a boss
    // round as one ("BOSS 1/3", round 12: was "Round 1 of 3", which
    // wrapped), never "11/13".
    const [waveHead, waveLabel] = this.waveParts(g);
    const scrap = this.earnsScrap() ? this.runScrap(g).total : null;
    const html =
      `<span class="v3-hud-wave" data-wave-count="${waveHead} ${waveLabel}"><b>${waveHead}</b>${waveLabel}</span>` +
      `<span><b>SCORE</b>${g.score.toLocaleString()}</span>` +
      // Scrap so far (the Armory overhaul): a read-out like the score,
      // nothing to tap. Only a run that banks it shows it.
      (scrap !== null ? `<span class="v3-hud-scrap" data-scrap="${scrap}"><b>SCRAP</b>${scrap.toLocaleString()}</span>` : '') +
      `<span class="v2-hud-lost" data-sunk="${sunk}" data-limit="${lossLimit(g)}"><b>SUNK</b><em>${pips}</em></span>` +
      (this.free || this.labRun ? `<span class="v2-hud-dev">${this.labRun ? 'TEST LAB' : 'FREE PLAY'}</span>` : '') +
      (this.labWatch ? `<span class="v2-hud-dev v3-hud-watch" data-watch-hud="${this.control}">WATCH · ${this.control === 'bot' ? 'BOT' : 'YOU'}</span>` : '') +
      (this.playback ? '<span class="v2-hud-dev v3-hud-replay">▶ REPLAY</span>' : '') +
      (this.dev ? `<span class="v2-hud-dev">DEV ${DEV_PRESETS[this.devSettings.preset].label}${this.bot ? ` · WATCH${this.bot.persona.id === YOU.id ? '' : ` · ${(this.bot.persona.label ?? this.bot.persona.id).toUpperCase()}`}` : ''}</span>` : '');
    if (this.hud.innerHTML !== html) this.hud.innerHTML = html;
  }

  // -------------------------------------------------------------------------
  // Screens

  private onPhase(g: Game): void {
    const from = this.lastPhase;
    this.lastPhase = g.phase;
    if (g.phase === 'wave') {
      this.beat = null;
      // (A pause made before the run's first frame keeps its menu.)
      if (!this.paused) this.hideOverlay();
    } else if (g.phase === 'draft') {
      this.draftWave = g.wave;
      this.saveProgress();
      // Straight out of a wave: a beat first. A dev stride's second draft
      // (draft → draft) comes up at once.
      if (from === 'wave') {
        this.startBeat('clear', CLEAR_BEAT);
      } else this.openDraft(g);
    } else if (g.phase === 'won' || g.phase === 'lost') {
      // Over: nothing left to continue (endless, after a win, isn't kept).
      if (this.rec) clearRun(this.rec.log.id);
      this.startBeat(g.phase, g.phase === 'won' ? WON_BEAT : LOST_BEAT);
    }
  }

  /** Between a wave's end and its draft: the optional "Rate wave N"
   *  screen (the 2026-11-20 playtest: "move this mid round review to be its
   *  own page as I miss it at the bottom of the draft page"), where the
   *  draft showed its row (waveRateEl). Skip or Next goes on to the draft;
   *  each tap is in the log already. Anywhere else, the draft at once. */
  private openWaveRate(g: Game): void {
    const skipped = g.history[g.history.length - 1]?.wave !== g.wave;
    const row = this.waveRateEl(g, skipped);
    if (!row) {
      this.openDraft(g);
      return;
    }
    const wave = g.wave;
    const go = () => {
      if (this.game === g && g.phase === 'draft' && g.wave === wave && this.overlay.dataset.screen === 'rate') this.openDraft(g);
    };
    const head = el('div', 'v2-draft-head');
    head.append(el('span', 'v2-draft-eyebrow', `Wave ${wave} cleared`), el('h2', '', `Rate wave ${wave}`), el('p', 'v2-sub v3-rate-sub', 'Optional: tap what fits, it is saved as you go.'));
    // A test's full map run: Done here too, as on its draft.
    if (this.labRun && g.lab) {
      const done = labDoneButton(() => this.showLabVerdict('done'), g.lab.waves, labWaves(g.lab));
      done.classList.add('v3-draft-done');
      head.append(done);
    }
    const skip = button('Skip', 'v2-btn v3-rate-skip', go);
    skip.dataset.rateSkip = '1';
    const next = button('Next', 'v2-btn primary v3-rate-next', go);
    next.dataset.rateNext = '1';
    const actions = el('div', 'v3-rate-actions');
    actions.append(skip, next);
    this.showOverlay('v3-rate', [head, row, actions]);
  }

  private openDraft(g: Game): void {
    this.showDraft(g);
    this.audio.ui('draft.open');
    this.armDraft();
    if (this.bot && this.control === 'bot') this.botDraft(g);
  }

  /** A hand just dealt (the draft, or Quartermaster's re-roll) takes taps
   *  once armed (style.css: no pointer events before). */
  private armDraft(): void {
    this.draftShownAt = performance.now();
    const panel = this.overlay.querySelector<HTMLElement>('.v2-draft');
    setTimeout(() => panel && (panel.dataset.armed = '1'), DRAFT_ARM_MS);
  }

  /** Hold the field for a moment before the next screen. Watching the bot
   *  fast, the beat shortens with the speed. */
  private startBeat(kind: 'clear' | 'won' | 'lost', seconds: number): void {
    const g = this.game!;
    const dur = this.bot && this.control === 'bot' ? seconds / Math.sqrt(Math.max(1, this.speed)) : seconds;
    this.hold = null;
    this.dropGesture();
    let focus = { x: g.map.carrier.x, y: g.map.carrier.y };
    if (kind === 'lost') {
      // Zoom in on the final blow: the carrier if it went down, else the
      // last ship to sink.
      const sink = [...g.fx].reverse().find((f) => f.kind === 'sink');
      if (g.carrierHp > 0 && sink) focus = { x: sink.x, y: sink.y };
      this.shake = 24;
      this.alerts.clear();
      this.root.classList.add('finale');
      this.setStamp('lost', g.carrierHp <= 0 ? 'CARRIER DOWN' : 'CONVOY LOST');
    } else {
      // Round 13: a win gets a stamp too, the same slam as a loss's.
      const last = g.history[g.history.length - 1];
      const wave = last?.wave ?? g.wave;
      this.alerts.clear();
      if (kind === 'won') this.setStamp('won', 'MAP CLEARED', wave > RULES.wavesToClear ? 'Every wave and boss round survived' : `All ${wave} waves survived`);
      else this.setStamp('won', `WAVE ${wave} CLEARED`, `+${(200 * wave).toLocaleString()} bonus`);
      requestAnimationFrame(() => this.stamp.classList.add('show'));
    }
    this.beat = { kind, t: performance.now(), dur, focus };
    this.audio.ui(kind === 'lost' ? 'run.lost' : kind === 'won' ? 'map.cleared' : 'wave.cleared');
    if (kind === 'won') haptic('success');
  }

  /** The stamp across the field: red for a loss, gold for a cleared wave. */
  private setStamp(kind: 'lost' | 'won', text: string, sub = ''): void {
    this.stamp.classList.toggle('cleared', kind === 'won');
    this.stamp.replaceChildren(el('span', 'v2-stamp-main', text), ...(sub ? [el('span', 'v2-stamp-sub', sub)] : []));
  }

  /** Per frame while a beat runs: the loss finale's slow motion, zoom and
   *  fade to grey. */
  private runBeat(now: number, real: number): void {
    const b = this.beat!;
    const g = this.game!;
    const e = (now - b.t) / 1000;
    // Explosions and sinkings play on (slowly, for a loss) while the field
    // holds; the sim itself has stopped, so the log is untouched.
    const rate = b.kind === 'lost' ? 0.3 : 1;
    for (const f of g.fx) f.age += real * rate;
    g.fx = g.fx.filter((f) => f.age < f.life);
    if (b.kind === 'lost') {
      const k = Math.min(1, e / (b.dur * 0.6));
      const ease = 1 - (1 - k) ** 3;
      this.zoom = { z: 1 + 0.4 * ease, x: b.focus.x, y: b.focus.y, pull: 0.6 * ease };
      this.canvas.style.filter = `grayscale(${(0.85 * ease).toFixed(3)}) brightness(${(1 - 0.25 * ease).toFixed(3)})`;
      this.vignette.style.opacity = String(Math.min(1, e / 0.5));
      this.stamp.classList.toggle('show', e > b.dur * 0.3);
    }
    if (e >= b.dur) this.finishBeat();
  }

  private finishBeat(): void {
    const b = this.beat;
    const g = this.game;
    if (!b || !g) return;
    this.beat = null;
    this.stamp.classList.remove('show');
    if (b.kind === 'clear') {
      // A test that has run its length goes to its verdict, not a draft;
      // and a draft never covers a verdict sheet already up (Done tapped as
      // the wave ended).
      if (this.labRun && labDone(g)) this.showLabVerdict('length');
      else if (g.phase === 'draft' && this.overlay.dataset.screen !== 'lab-verdict') this.openWaveRate(g);
    } else if (this.labRun) this.showLabVerdict(b.kind === 'lost' ? 'lost' : 'length');
    else this.showResult(g, b.kind === 'won');
  }

  /** One more loss and the run is over: the last ship, or a carrier at a
   *  quarter of its hull. The screen's edge beats red and the last empty
   *  pip blinks; a banner says so once, on the way in. */
  private syncDanger(g: Game): void {
    const lastShip = lossLimit(g) - shipsSunk(g) <= 1;
    const carrier = g.carrierHp <= Math.ceil(g.stats.carrierHp * 0.25);
    const on = g.phase === 'wave' && !this.beat && (lastShip || carrier);
    // The last ship gets its alert; a critical carrier's klaxon is a loop
    // (audio/state.ts) that runs as long as the danger does.
    if (on && !this.danger)
      this.showBanner(lastShip ? 'LAST SHIP' : 'CARRIER CRITICAL', lastShip ? 'One more loss and the convoy is lost.' : 'One more hit could sink the carrier.', { tone: 'danger', key: 'danger' }, lastShip ? 'last.ship' : null);
    if (on !== this.danger) {
      this.danger = on;
      this.root.classList.toggle('danger', on);
    }
  }

  /** Back to a clean field (a new run, the menu). */
  /** Put this map behind the screens around a run (a new quiet game if it
   *  changed). */
  private setBackdrop(id: MapId): void {
    if (this.backdropId === id && this.backdrop) return;
    const g = quietGame(id);
    // Start with the convoy already under way.
    for (let i = 0; i < 60 * 12; i++) {
      step(g, DT);
      if (i % 60 === 0) calm(g);
    }
    calm(g);
    this.backdrop = g;
    this.backdropId = id;
    this.backdropAcc = 0;
    this.drawnKey = '';
  }

  /** The backdrop runs at a stately 0.7× and is kept clear of anything a
   *  map's own features put in the air. */
  private stepBackdrop(real: number): void {
    const g = this.backdrop!;
    this.backdropAcc += real * 0.7;
    // Two steps at a time: it moves (and is redrawn) at 30 fps at most,
    // which is plenty for ships at sea and half the work for a phone.
    if (this.backdropAcc < DT * 2) return;
    let n = 0;
    while (this.backdropAcc >= DT && n < 6) {
      step(g, DT);
      this.backdropAcc -= DT;
      n++;
    }
    if (n >= 6) this.backdropAcc = 0;
    if (g.threats.length || g.fx.length || g.events.length || g.pickups.length) calm(g);
    // A quiet game never ends, but should one ever stop, start it again.
    if (g.phase !== 'wave') this.backdropId = null;
    if (!this.backdropId && this.backdrop) this.setBackdrop(g.map.id);
  }

  /** Off the field for good: the run (if any) is logged and let go. */
  private leaveRun(): void {
    this.resetFinale();
    this.endLabRun();
    this.root.querySelector('.v3-lab-back')?.remove();
    if (this.rec) this.endRun(this.game?.phase === 'won' ? 'won' : 'quit');
    this.rec = null;
    this.game = null;
    this.lastPhase = null;
    this.root.classList.remove('playing');
  }

  private resetFinale(): void {
    this.beat = null;
    this.hideEventCard();
    this.alerts.clear();
    this.hitStop = 0;
    this.danger = false;
    this.root.classList.remove('danger');
    this.zoom = { z: 1, x: 800, y: 450, pull: 0 };
    this.canvas.style.filter = '';
    this.vignette.style.opacity = '0';
    this.stamp.classList.remove('show');
    this.root.classList.remove('finale');
  }

  private showMenu(): void {
    this.leaveRun();
    // Twenty maps in four chapters of five: the menu shows one chapter at a
    // time, five picture cards in one row, with a tab per chapter.
    const p = this.progress;
    // The store build: chapters past the free one also need the unlock.
    const bought = (id: MapId) => chapterOwned(chapterOf(id));
    const open = (id: MapId) => this.dev || (isUnlocked(p, id) && bought(id));
    if (!this.menuChapter) {
      const furthest = [...MAP_ORDER].reverse().find(open) ?? MAP_ORDER[0];
      this.menuChapter = chapterOf(furthest);
    }
    const tabs = el('div', 'v3-chapter-tabs');
    tabs.setAttribute('role', 'tablist');
    for (const c of CHAPTERS) {
      const maps = MAP_ORDER.slice((c.n - 1) * 5, c.n * 5);
      const shut = !open(maps[0]);
      const forSale = !chapterOwned(c.n);
      const tab = button('', `v3-chapter-tab${c.n === this.menuChapter ? ' on' : ''}${shut ? ' locked' : ''}`, () => {
        if (c.n === this.menuChapter) return;
        this.audio.ui('armory.tab');
        this.menuChapter = c.n;
        this.showMenu();
      });
      tab.dataset.chapter = String(c.n);
      tab.dataset.sfx = 'tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(c.n === this.menuChapter));
      // An open chapter shows how much of it is cleared; a shut one, a lock.
      const done = maps.filter((m) => p.cleared.includes(m)).length;
      const tail = el('i', 'v3-chapter-tail');
      if (shut || forSale) tail.innerHTML = chromeSvg('lock', 13);
      else tail.textContent = `${done}/5`;
      tab.append(el('b', '', `${c.n}`), el('span', '', c.name), tail);
      tabs.append(tab);
    }
    const toast = el('div', 'v3-menu-toast');
    toast.setAttribute('role', 'status');
    const shown = MAP_ORDER.map((id, i) => ({ id, i })).filter(({ id }) => chapterOf(id) === this.menuChapter);
    const cards = shown.map(({ id, i }, k) => {
      const m = MAPS[id];
      const locked = !open(id);
      const forSale = !this.dev && !bought(id);
      const best = p.best[id];
      const cleared = p.cleared.includes(id);
      // NEW marks the maps the save itself has opened and not yet played
      // (developer mode opens every map; those aren't new to the player).
      const fresh = !locked && !best && isUnlocked(p, id);
      const card = button('', `v2-map-card${locked ? ' locked' : ''}${fresh ? ' next' : ''}`, () => {
        if (!locked) {
          this.prepare(id);
          return;
        }
        if (forSale) {
          this.showUnlock();
          return;
        }
        // A locked map says why only when asked: a shake and one line.
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
        toast.textContent = `Clear ${MAPS[MAP_ORDER[i - 1]].name} to open ${m.name}`;
        toast.classList.remove('show');
        void toast.offsetWidth;
        toast.classList.add('show');
      });
      if (forSale) card.setAttribute('aria-label', `${m.name}, part of the full game`);
      else if (locked) card.setAttribute('aria-label', `${m.name}, locked: clear ${MAPS[MAP_ORDER[i - 1]].name} to open it`);
      card.dataset.map = id;
      card.style.setProperty('--i', String(k));
      const pic = el('span', 'v3-map-pic');
      const url = thumbNow(id);
      const img = el('img');
      img.alt = '';
      img.decoding = 'async';
      if (url) img.src = url;
      else {
        pic.classList.add('loading');
        void mapThumb(id).then((u) => {
          if (!u) return;
          img.src = u;
          pic.classList.remove('loading');
        });
      }
      pic.append(img);
      if (locked) pic.insertAdjacentHTML('beforeend', `<span class="v3-map-lock">${chromeSvg('lock', 22)}</span>`);
      if (fresh) pic.append(el('span', 'v3-map-flag', 'NEW'));
      if (forSale && k === 0) pic.append(el('span', 'v3-map-flag v3-full-flag', 'FULL GAME'));
      const status = el('span', 'v2-map-best');
      if (best) {
        if (cleared) status.innerHTML = `${chromeSvg('check', 12)} ${best.score.toLocaleString()}`;
        else status.textContent = `Wave ${best.wave} · ${best.score.toLocaleString()}`;
        status.classList.toggle('cleared', cleared);
      }
      const name = el('span', 'v3-map-name');
      name.append(el('span', 'v2-map-num', `${i + 1}`), el('strong', '', m.name));
      card.append(pic, name, status);
      return card;
    });
    const grid = el('div', 'v2-map-grid');
    grid.append(...cards);
    // Behind the menu: the chapter's new map, else its furthest open one,
    // else the furthest map open anywhere.
    const here = shown.map(({ id }) => id);
    const behind =
      here.find((id) => isUnlocked(p, id) && !p.best[id]) ?? [...here].reverse().find((id) => isUnlocked(p, id)) ?? [...MAP_ORDER].reverse().find((id) => isUnlocked(p, id)) ?? MAP_ORDER[0];
    this.setBackdrop(behind);
    // The top bar: the Armory, Free Play, Settings (and the note button
    // while playtest notes are on), all one style.
    const bar = el('div', 'v3-menu-bar');
    // The command room's status line (UI overhaul): the sector on the
    // screen and how much of the strait is secured.
    const status = el('div', 'v3-cic-status');
    status.setAttribute('aria-hidden', 'true');
    const sector = CHAPTERS.find((c) => c.n === this.menuChapter);
    status.append(el('i', 'v3-led live'), el('b', '', 'CIC'), el('span', '', `SECTOR ${this.menuChapter} · ${sector?.name ?? ''}`), el('span', 'v3-cic-dim', `${p.cleared.length}/${MAP_ORDER.length} SECURED`));
    bar.append(status);
    const armory = button('', 'v3-top-btn v3-armory-btn', () => this.showArmory());
    armory.innerHTML = `${chromeSvg('anchor')}<span>Armory</span>`;
    const count = el('b', 'v3-count', String(p.cards));
    armory.append(count);
    armory.setAttribute('aria-label', `Armory, ${p.cards} card${p.cards === 1 ? '' : 's'} found`);
    armory.dataset.cards = String(p.cards);
    // Scrap banked for a level: the count lights amber.
    armory.dataset.scrap = String(p.scrap);
    armory.classList.toggle('v3-can-level', this.canLevel());
    const freePlay = button('', 'v3-top-btn v3-free-btn', () => this.showFreePlay());
    freePlay.innerHTML = `${chromeSvg('play', 16)}<span>Free Play</span>`;
    freePlay.dataset.freePlay = '1';
    const settings = button('', 'v3-top-btn icon v2-settings-btn', () => this.showSettings());
    settings.innerHTML = chromeSvg('gear', 20);
    settings.setAttribute('aria-label', 'Settings');
    bar.append(armory, freePlay);
    // The Test Lab: test builds only (the player's answer: hidden in the
    // App Store build).
    if (!STORE) {
      const lab = button('', 'v3-top-btn v3-lab-btn', () => this.showLab());
      lab.innerHTML = `${chromeSvg('note', 16)}<span>Test Lab</span>`;
      lab.dataset.lab = '1';
      bar.append(lab);
    }
    if (this.notesOn) {
      const note = button('', 'v3-top-btn v3-menu-note', () => this.openMenuNote());
      note.innerHTML = `${chromeSvg('note', 17)}<span>Note</span>`;
      bar.append(note);
    }
    bar.append(settings);
    // The older builds (the classic game, V2) are off the menu: Settings'
    // Developer card links them, on the developer route only (UI overhaul).
    const title = el('div', 'v3-title');
    title.innerHTML = MARK_SVG;
    const words = el('div', 'v3-title-words');
    words.append(el('h1', '', 'STRAITWATCH'), el('span', 'v3-title-sub', 'Convoy defence · combat information centre'));
    title.append(words);
    const maps = el('div', 'v3-menu-maps');
    // The locked-map line shows just above the tabs, under the title, where
    // it covers nothing.
    maps.append(toast, tabs, grid);
    // A run left mid-game: Continue, beside the title (resume round).
    const saved = loadRun<RunUI>();
    if (saved && (!STORE || saved.kind !== 'lab')) {
      title.classList.add('with-continue');
      title.append(this.continueEntry(saved));
    }
    this.showOverlay('v2-menu', [bar, title, ...(this.dev ? [this.devPanel()] : []), maps]);
  }

  /** The Armory: three bays, Gun, Hull and Supply, each a row of cards
   *  (round 7). Cards are FOUND at the end of a run, at random (playtest:
   *  "they don't get to pick which ones"); the Armory overhaul made their
   *  levels bought with Scrap, by the player's choice (Survivor.io's gear).
   *  Tap a card you hold: its bar below the row levels it (the cost on the
   *  button, greyed with what is missing) and equips it, ONE card a bay.
   *  Menus round: each fact once (the bay is the tab, not a label on every
   *  card; a card not found is greyed with a lock, not told three times). */
  private showArmory(back: () => void = () => this.showMenu()): void {
    const p = this.progress;
    const bay = this.armoryBay;
    const again = () => this.showArmory(back);
    const tabs = el('div', 'v3-bay-tabs');
    tabs.setAttribute('role', 'tablist');
    for (const b of BAY_ORDER) {
      const eq = p.equipped[b];
      const held = bayItems(b).filter((id) => armoryLevel(p.armory, id) > 0).length;
      const tab = button('', `v3-bay-tab${b === bay ? ' on' : ''}`, () => {
        if (b === this.armoryBay) return;
        this.audio.ui('armory.tab');
        this.armoryBay = b;
        this.armoryPick = null;
        again();
      });
      tab.dataset.bay = b;
      tab.dataset.sfx = 'tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(b === bay));
      tab.style.setProperty('--card-color', BAYS[b].color);
      const top = el('span', 'v3-bay-tab-top');
      top.append(el('strong', '', BAYS[b].name), el('i', '', `${held}/${bayItems(b).length}`));
      tab.append(top, el('span', '', eq ? `${ARMORY[eq].name} ${armoryLevel(p.armory, eq)}` : held ? 'Nothing equipped' : 'No cards yet'));
      tabs.append(tab);
    }
    // The card whose bar is open: the one tapped, else the bay's equipped
    // card, else its first one held.
    const heldHere = bayItems(bay).filter((id) => armoryLevel(p.armory, id) > 0);
    const pick = this.armoryPick && heldHere.includes(this.armoryPick) ? this.armoryPick : (p.equipped[bay] ?? heldHere[0] ?? null);
    const row = el('div', `v3-armory-cards n${bayItems(bay).length}`);
    row.append(
      ...bayItems(bay).map((id) => {
        const lv = armoryLevel(p.armory, id);
        const on = p.equipped[bay] === id;
        const card = this.armoryCard(id, lv, on ? 'EQUIPPED' : '', () => {
          if (!lv || id === pick) return;
          this.audio.ui('ui.tap');
          this.armoryPick = id;
          again();
        }, false);
        card.classList.toggle('chosen', on);
        card.classList.toggle('picked', id === pick);
        card.classList.toggle('locked', !lv);
        card.disabled = !lv;
        card.setAttribute('aria-pressed', String(id === pick));
        return card;
      }),
    );
    const count = el('span', 'v3-head-count v3-scrap-count');
    count.dataset.scrap = String(p.scrap);
    count.innerHTML = `<b>${p.scrap.toLocaleString()}</b> scrap<i>·</i><b class="v3-cards-n">${p.cards}</b> card${p.cards === 1 ? '' : 's'} found`;
    const bar = pick ? this.armoryBar(pick, again) : el('p', 'v3-hint', `Clear ${CARD_DROPS.minWaves} waves in a run to find a card. A card found again pays ${SCRAP.duplicate} scrap; spend scrap here to level the cards you hold.`);
    this.showOverlay('v3-armory', [this.screenHead('Armory', back, count), tabs, row, bar]);
  }

  /** The bar under the Armory's cards for the card picked: its level now
   *  and next, Equip (or take it off), and Level up with its Scrap cost
   *  (greyed, with what is missing, when the bank is short or it is maxed). */
  private armoryBar(id: ArmoryId, again: () => void): HTMLElement {
    const p = this.progress;
    const def = ARMORY[id];
    const lv = armoryLevel(p.armory, id);
    const on = p.equipped[def.bay] === id;
    const cost = levelCost(id, lv);
    const bar = el('div', 'v3-armory-bar');
    bar.dataset.armoryBar = id;
    bar.style.setProperty('--card-color', BAYS[def.bay].color);
    const what = el('div', 'v3-armory-bar-what');
    what.append(el('strong', '', `${def.name} · LV ${lv}`), el('span', '', cost === null ? `${def.show(lv)} · max level` : `Next: ${def.show(lv + 1)}`));
    const equip = button(on ? 'Take off' : 'Equip', `v2-btn${on ? '' : ' primary'}`, () => {
      if (equipArmory(p, on ? null : id, def.bay)) {
        this.audio.ui(on ? 'ui.back' : 'armory.equip');
        again();
      }
    });
    equip.dataset.armoryEquip = id;
    const short = cost === null ? 0 : Math.max(0, cost - p.scrap);
    const level = button('', 'v2-btn v3-level-btn', () => {
      if (!levelUp(p, id)) return;
      this.audio.ui(armoryLevel(p.armory, id) >= def.max ? 'card.max' : 'card.won');
      haptic('success');
      again();
    });
    level.dataset.armoryLevel = id;
    if (cost === null) {
      level.innerHTML = '<b>Max level</b>';
      level.disabled = true;
    } else {
      level.innerHTML = `<b>Level up · LV ${lv + 1}</b><span>${cost.toLocaleString()} scrap${short ? ` · need ${short.toLocaleString()} more` : ''}</span>`;
      level.disabled = short > 0;
      level.classList.toggle('ready', !short);
    }
    level.dataset.cost = cost === null ? '' : String(cost);
    level.setAttribute('aria-label', cost === null ? `${def.name} is at its top level` : `Level ${def.name} up to ${lv + 1} for ${cost} scrap${short ? `; ${short} more needed` : ''}`);
    const btns = el('div', 'v3-armory-bar-btns');
    btns.append(equip, level);
    bar.append(what, btns);
    return bar;
  }

  /** Can any card held take a level with the Scrap banked? */
  private canLevel(): boolean {
    const p = this.progress;
    return ARMORY_ORDER.some((id) => {
      const c = levelCost(id, armoryLevel(p.armory, id));
      return c !== null && c <= p.scrap;
    });
  }

  /** One Armory card, drawn like a weapon card: a badge, the art, its
   *  name, its level pips, what it does and the number now and next (with
   *  the Scrap the next level costs).
   *  `bayTag`: name its bay (on the result screen; in the Armory the tab
   *  already does). */
  private armoryCard(id: ArmoryId, lv: number, badge: string, onTap?: () => void, bayTag = true): HTMLButtonElement {
    const def = ARMORY[id];
    const card = button('', 'v2-card v3-armory-card', () => onTap?.());
    card.dataset.armory = id;
    card.dataset.sfx = 'armory';
    card.style.setProperty('--card-color', BAYS[def.bay].color);
    const top = el('span', 'v2-card-top', '');
    const badgeClass = badge === 'EQUIPPED' ? 'max' : badge === 'NEW' ? 'new' : 'up';
    if (bayTag) top.append(el('span', 'v2-card-answers', BAYS[def.bay].name));
    if (badge) top.append(el('span', `v2-badge ${badgeClass}`, badge));
    else if (!lv) top.insertAdjacentHTML('beforeend', `<span class="v3-card-lock">${chromeSvg('lock', 14)}</span>`);
    const art = el('span', 'v2-card-art', '');
    art.innerHTML = armoryArtSvg(id);
    const stat = el('span', 'v3-card-stat');
    if (lv) {
      const pips = el('span', 'v2-card-level', '');
      for (let k = 1; k <= def.max; k++) pips.append(el('i', k <= lv ? 'had' : ''));
      pips.append(el('span', '', lv >= def.max ? 'MAX' : `LV ${lv}/${def.max}`));
      stat.append(el('b', '', def.show(lv)));
      const cost = levelCost(id, lv);
      if (cost !== null) {
        const next = el('span', 'v3-card-next', `Next: ${def.show(lv + 1)}`);
        if (!bayTag) next.append(el('em', `v3-card-cost${cost <= this.progress.scrap ? ' ok' : ''}`, `${cost.toLocaleString()} scrap`));
        stat.append(next);
      }
      card.append(top, art, el('strong', 'v2-card-name', def.name), pips, el('span', 'v2-card-text', def.blurb), stat);
    } else {
      // Not found yet: what it does, and what the first card would give.
      stat.append(el('span', 'v3-card-next', `First card: ${def.show(1)}`));
      card.append(top, art, el('strong', 'v2-card-name', def.name), el('span', 'v2-card-text', def.blurb), stat);
    }
    return card;
  }

  /** The result screen's Armory drop: the cards found (NEW for a card not
   *  held before; one held already pays Scrap) and the run's Scrap, line by
   *  line; or why there were no cards. */
  private wonCards(cards: CardFind[], firstClear: boolean, scrap: ScrapEarned): HTMLElement {
    const box = el('div', 'v3-won');
    const p = this.progress;
    const lines: [string, number][] = [
      ['waves', scrap.waves],
      ['boss rounds', scrap.boss],
      ['map cleared', scrap.clear],
      ['first clear', scrap.firstClear],
      ['repeat cards', scrap.duplicates],
      ['salvage crews', scrap.salvage],
    ];
    const ledger = el('p', 'v3-scrap-ledger');
    ledger.dataset.scrap = String(scrap.total);
    ledger.innerHTML =
      `<b>+${scrap.total.toLocaleString()} scrap</b>` +
      lines
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `<span>${k} ${v.toLocaleString()}</span>`)
        .join('') +
      `<span class="v3-scrap-bank">banked ${p.scrap.toLocaleString()}</span>`;
    if (!cards.length) {
      box.append(ledger, el('p', 'v2-sub', `No Armory card this time: clear ${CARD_DROPS.minWaves} waves to find one.`));
      return box;
    }
    const row = el('div', 'v3-won-cards');
    row.append(
      ...cards.map((c, i) => {
        const lv = armoryLevel(p.armory, c.id);
        const card = this.armoryCard(c.id, c.dup ? lv : 1, c.dup ? `+${SCRAP.duplicate} SCRAP` : 'NEW');
        card.classList.toggle('dup', c.dup);
        card.tabIndex = -1;
        card.style.setProperty('--deal', `${i * 260}ms`);
        // Each card's sound lands as it is dealt in (style.css: the deal
        // starts at --deal).
        setTimeout(() => {
          if (!card.isConnected) return;
          this.audio.ui(c.dup ? 'card.won' : 'card.new');
          if (i === 0) haptic('success');
        }, i * 260);
        return card;
      }),
    );
    box.append(el('span', 'v2-draft-eyebrow', `Armory card${cards.length > 1 ? 's' : ''} found${firstClear ? ' · first clear bonus' : ''}`), row, ledger);
    return box;
  }

  // -------------------------------------------------------------------------
  // The Test Lab (docs/design/v3-test-lab.md)

  /** The hub: Ready to test on top, the maps by chapter, and the Tools
   *  sheet over it (the Tools round). `tools`: open with Tools up (back
   *  from one of its entries). */
  private showLab(tools = false): void {
    this.leaveRun();
    const p = this.labProgress;
    // A test left mid-run: Continue, at the top of the hub.
    const saved = loadRun<RunUI>();
    // The head's Tools key opens the Tools sheet in place.
    const key = button('', 'v3-top-btn v3-lab-tools-btn', () => openLabTools(this.overlay));
    key.innerHTML = `${chromeSvg('gear', 16)}<span>Tools</span>`;
    key.dataset.labToolsOpen = '1';
    key.setAttribute('aria-haspopup', 'dialog');
    key.setAttribute('aria-expanded', String(tools));
    this.showOverlay('v3-lab', [
      this.screenHead('Test Lab', () => this.showMenu(), key, roundTitle()),
      ...(saved?.kind === 'lab' ? [this.continueEntry(saved)] : []),
      labHub(p, { start: (id) => this.startLab(id), watch: (id) => this.startLab(id, undefined, true), notes: (map) => this.showMapNotes(map) }, [...labLogs(), ...localLogs()]),
    ]);
    // The sheet sits over the whole screen, beside the panel (not in it:
    // the hub under it keeps its scroll).
    const last = labLogs()[0];
    this.overlay.append(
      labToolsSheet(
        p,
        {
          armory: () => this.showLabArmory(this.labArmoryChapter),
          callouts: {
            level: this.alerts.level,
            set: (id) => {
              this.alerts.level = id;
              saveCalloutLevel(id);
            },
          },
          report: () => this.showLabReport(),
          send: (out) => {
            out.textContent = 'Sending…';
            void flushUnsent().then((n) => (out.textContent = n ? `Sent ${n} log${n === 1 ? '' : 's'}.` : "Every log has been sent (or this device can't reach the log store right now)."));
          },
          download: last ? () => downloadLog(last) : undefined,
          analytics: () => this.showMapLab(),
        },
        tools,
      ),
    );
    if (tools) openLabTools(this.overlay);
  }

  /** The chapter the Test Lab Armory last showed (it opens there again). */
  private labArmoryChapter = 1;

  /** The Test Lab's Armory, a chapter at a time (data/labArmory.ts), from
   *  Tools; Back is the hub with Tools open. */
  private showLabArmory(chapter: number): void {
    this.leaveRun();
    this.labArmoryChapter = chapter;
    this.showOverlay('v3-labarmory', [
      this.screenHead('Test Lab Armory', () => this.showLab(true), undefined, 'Tools · strength by chapter'),
      labArmoryEditor(chapter, (ch) => (this.labArmoryChapter = ch)),
    ]);
  }

  /** A map's card in the Test Lab: what changed and why, what to look for,
   *  its history, and (one line, read only) the Armory it will play with;
   *  Play starts its card. */
  private showMapNotes(map: MapId): void {
    this.leaveRun();
    this.showOverlay('v3-mapnotes', [
      this.screenHead(MAPS[map].name, () => this.showLab(), undefined, `Test Lab · chapter ${chapterOf(map)}`),
      mapNotesSheet(map, { play: () => this.startLab(mapCardId(map)) }),
    ]);
  }

  /** The Map & Convoy Lab's viewer: the runs kept on this device, as
   *  layers on the map (ui/mapLab.ts). A developer screen. */
  private mapLabMemory: MapLabMemory = {};

  private showMapLab(): void {
    this.leaveRun();
    const seen = new Set<string>();
    const logs = [...labLogs(), ...localLogs().reverse()].filter((l) => !seen.has(l.id) && !!seen.add(l.id));
    const head = this.screenHead('Map Analytics', () => this.showLab(true), undefined, 'Test Lab · Tools');
    this.showOverlay('v3-maplab-screen', [head, el('p', 'v3-hint', 'Opening…')]);
    // Its own chunk, fetched when it is first opened: nothing of it is in
    // the game a player downloads.
    void import('./mapLab').then(({ mapLabScreen }) => {
      if (this.overlay.dataset.screen !== 'maplab-screen') return;
      this.showOverlay('v3-maplab-screen', [
        head,
        mapLabScreen({
          logs: () => logs,
          memory: this.mapLabMemory,
          // The replay from just before it, inputs and all; then back here.
          watch: (log, step) => this.startPlayback(step + PLAYBACK_BEFORE * 60, 0, { log, after: () => this.showMapLab() }),
        }),
      ]);
    });
  }

  /** Start a test: the card's water, wave 5 (or the setup's), its kit. A
   *  map card (Test Lab round 10) plays the full map from wave 1, as the
   *  campaign does, under its production setup unless changed. */
  private startLab(id: string, setup?: LabRunSetup, watch = false): void {
    const card = labCard(id);
    if (!card) return;
    // Watch (log v65): a map card only.
    watch = watch && card.kind === 'map';
    if (this.askBeforeNew(() => this.startLab(id, setup, watch))) return;
    const first = setup ?? defaultSetup(card, this.labProgress, this.labLast ? { ...this.labLast, length: this.labProgress.length, mix: this.labProgress.mix } : undefined);
    // A link's ?convoy=, ?enc= or ?plays= (a comparison), for the card it
    // named and only as it opens; the plain link is the card's own setup.
    const link = !setup && !STORE && this.labLink === id ? new URLSearchParams(location.search) : null;
    if (link) this.labLink = null;
    const plan = labRunPlan(card, first, link);
    const s = plan.setup;
    this.labLast = s;
    this.endLabRun();
    // A map card plays the chapter's Test Lab Armory, not the player's own
    // (data/labArmory.ts); the log records the levels in its `armory`.
    const ch = chapterOf(card.map);
    const armory = card.kind === 'map' ? labArmoryLevels(loadLabArmory(), ch) : undefined;
    const lab: LabSetup = armory ? { ...plan.lab, armory: { chapter: ch, auto: labArmoryIsAuto(loadLabArmory(), ch) } } : plan.lab;
    const free: FreeSetup | null = plan.full
      ? null
      : {
          map: card.map,
          wave: s.wave,
          weapons: [0, 1, 2].map((i) => s.weapons[i] ?? null),
          armory: { gun: null, hull: null, supply: null },
          frequentDrops: true,
          enemies: 'campaign',
        };
    this.play(card.map, free, lab, plan.convoy, plan.encounters, undefined, armory, watch);
    // Its commands, name and what to look for are on the pause menu (pause-
    // menu round: nothing of the test is over the field, and no card says
    // what is being tested: the hub's row said so as it was tapped).
    this.labRun = { card, setup: s, ...(watch ? { watch } : {}) };
    this.root.classList.add('lab-on');
  }

  private endLabRun(): void {
    if (!this.labRun) return;
    this.labRun = null;
    this.root.classList.remove('lab-on');
  }

  /** The test's numbers so far (the pause menu's header, the verdict). */
  private labStats(g: Game): LabStats {
    return { ...g.lab!.stats, weaponUses: g.lab!.weapon ? (g.uses[g.lab!.weapon] ?? 0) : 0 };
  }

  /** Change the wave, weapons, mix or length: the test restarts with it.
   *  Opened from the pause menu; Back to the test goes back to it. */
  private openLabSetup(): void {
    const run = this.labRun;
    if (!run || !this.game || this.game.phase !== 'wave') return;
    this.paused = true;
    this.hold = null;
    this.dropGesture();
    this.showOverlay('v3-lab-setup', [
      labSetupSheet(
        run.card,
        run.setup,
        (s) => {
          this.labProgress.length = s.length;
          this.labProgress.mix = s.mix;
          saveLabProgress(this.labProgress);
          this.startLab(run.card.id, s, !!run.watch);
        },
        () => this.showPauseMenu(),
      ),
    ]);
  }

  /** The verdict sheet: after Done, the test's length, or the convoy lost.
   *  Since scorecard revision 4 it is the normal game's "Rate & review this
   *  run" with a Test Lab section (docs/design/v3-rate-and-review.md): the
   *  run's timeline and moments (`selected`: the stop picked on it), Watch
   *  it, a note on a moment, and each wave's rating from the draft. */
  private showLabVerdict(ended: 'done' | 'length' | 'lost', selected = -1): void {
    const run = this.labRun;
    const g = this.game;
    if (!run || !g?.lab) return;
    // Drawn again (a stop picked, back from a replay or a note): the sheet
    // stays scrolled where it was.
    const again = this.overlay.dataset.screen === 'lab-verdict';
    const scroll = again ? (this.overlay.querySelector<HTMLElement>('.v2-panel')?.scrollTop ?? 0) : 0;
    this.paused = true;
    this.hold = null;
    this.dropGesture();
    const p = this.labProgress;
    const stats = this.labStats(g);
    const waves = g.lab.waves;
    const plays = g.lab.setup.plays;
    // A full map run's waves played, for its scorecard (round 11): the wave
    // it is on or ended on (a full run starts at wave 1).
    const played = g.lab.full ? Math.max(waves, g.wave) : undefined;
    // Its wave strip (scorecard revision 2): the ships lost in each wave
    // (the wave records keep the run's tally) and the moments marked.
    const strip = played !== undefined ? waveStrip(g.history, g.lost, g.wave, this.rec?.watch.moments ?? [], played, g.t) : undefined;
    const variant = g.lab.setup.variant;
    const queued = p.queue.filter((id) => id !== run.card.id);
    // Save · next stays among the card's own kind (the Tools round: a map
    // card never leads on to the old enemy, weapon or event cards).
    const next = queued.length ? labCard(queued[0]) : nextCards(p, LAB_CARDS.length, run.card.id).find((c) => c.kind === run.card.kind);
    // The sheet drawn again for the same test (a wave's end coming in under
    // it) keeps what the player has picked and typed.
    if (this.labDraft?.run !== run) this.labDraft = { run, draft: newVerdictDraft(p, run.card.id) };
    const draft = this.labDraft.draft;
    // The run so far, as the normal review shows it (the log is not sealed
    // until Save).
    const log = this.rec?.snapshot();
    const review = log
      ? {
          run: this.reviewRun(log, selected, {
            pick: (i) => this.showLabVerdict(ended, i),
            watch: (step, i) => this.startPlayback(step, i, undefined, { g, ended }),
            note: (i, moment) => this.labReviewNote(ended, i, moment),
          }),
          waves: waveScores(log.waveRatings, played),
        }
      : undefined;
    this.showOverlay('v3-lab-verdict', [
      labVerdictSheet(run.card, stats, waves, ended, p, next, {
        save: (r, then) => {
          // The verdict is for this version of the card, in this round; it
          // joins the card's history (older versions' verdicts stay).
          const rev = cardRev(run.card.id);
          const played = this.rec?.log.control ? playKind(this.rec.snapshot()) : null;
          const result = { ...r, waves, ended, stats, rev, round: LAB_ROUND, ...(plays ? { plays } : {}), ...(variant ? { variant } : {}), ...(played ? { played } : {}) };
          addLabEntry(p, run.card.id, { ...result, at: new Date().toISOString(), build: __BUILD__ });
          if (!p.session.ids.includes(run.card.id)) p.session.ids.push(run.card.id);
          p.queue = p.queue.filter((id) => id !== run.card.id);
          saveLabProgress(p);
          // The verdict rides in the test's log (it reaches Claude), and
          // any other card's 1–5 rows ride as the run's rating, as in the
          // normal game.
          if (this.rec) this.rec.log.labResult = result;
          if (this.rec && draft.rating && Object.keys(draft.rating).length) this.rec.log.rating = { ...draft.rating };
          // The test is over: its saved run (if any) goes.
          if (this.rec) clearRun(this.rec.log.id);
          // A full map run that cleared the map ends as won (and keeps no
          // run to go on with: the lab has no endless).
          const log = this.endRun(g.phase === 'won' ? 'won' : ended === 'lost' ? 'lost' : 'quit');
          this.rec = null;
          if (log) keepLabLog(run.card.id, log);
          this.labDraft = null;
          if (then === 'again') this.startLab(run.card.id, run.setup, !!run.watch);
          else if (then === 'next' && next) this.startLab(next.id);
          else this.showLab();
        },
      }, draft, plays, played, strip, review),
    ]);
    // A Watch run (log v65): who played it, under the title, and its log
    // to download as it stands.
    if (log?.control) {
      const line = watchLine(log.control);
      if (!STORE) {
        const dl = button('Download log', 'v2-link v3-watch-dl', () => downloadLog(this.rec?.snapshot() ?? log));
        dl.dataset.watchDownload = '1';
        line.append(' · ', dl);
      }
      (this.overlay.querySelector('.v3-review-title') ?? this.overlay.querySelector('.v2-panel')?.firstElementChild)?.after(line);
    }
    // Round 12: Retry the wave, or Skip to boss, under the title (nothing
    // of this sheet is saved by them: the run's log is kept as it ended).
    const jumps = this.labJumps(g);
    if (jumps.length) {
      const row = el('div', 'v3-lab-jumps');
      row.dataset.labJumps = '1';
      row.append(...jumps);
      this.overlay.querySelector('.v3-review-title')?.after(row);
    }
    if (again) {
      const panel = this.overlay.querySelector<HTMLElement>('.v2-panel');
      if (panel) panel.scrollTop = scroll;
    }
  }

  /** A note on a moment of a test's run, from its end screen: it goes into
   *  the run's log with the moment's step, as on the normal review. */
  private labReviewNote(ended: 'done' | 'length' | 'lost', selected: number, moment?: number): void {
    const rec = this.rec;
    const g = this.game;
    if (!rec || !g) return;
    const m = moment !== undefined ? rec.watch.moments[moment] : undefined;
    const form = noteForm();
    const back = () => this.showLabVerdict(ended, selected);
    this.showOverlay('v3-note', [
      el('h2', '', m ? `📝 ${stopWhen(m)}` : '📝 Note on this run'),
      el('p', 'v2-sub', m ? m.text : `${this.labRun?.card.name ?? 'Test'} · ${this.waveText(g)}`),
      form.el,
      this.dialogButtons('Save note', () => {
        if (form.empty()) return;
        const note: PlayNote = {
          step: m?.step ?? g.steps,
          at: new Date().toISOString(),
          where: 'review',
          ...form.value(),
          ...(moment !== undefined ? { moment } : {}),
          ctx: noteContext(g),
        };
        (rec.log.notes ??= []).push(note);
        back();
      }, back),
    ]);
  }

  /** What was tested today: verdicts, notes, a rewatch of each note's
   *  moment, and a way to send the logs now. */
  private showLabReport(): void {
    this.leaveRun();
    this.showOverlay('v3-lab-report', [
      this.screenHead('Session report', () => this.showLab(true), undefined, 'Test Lab · Tools'),
      labReport(
        this.labProgress,
        (log, step) => {
          this.showMoment(log, step);
          const back = button('← Back to the report', 'v2-btn primary v3-lab-back', () => {
            back.remove();
            this.showLabReport();
          });
          back.dataset.labBack = '1';
          this.root.append(back);
        },
        (out) => {
          out.textContent = 'Sending…';
          void flushUnsent().then((n) => (out.textContent = n ? `Sent ${n} log${n === 1 ? '' : 's'}.` : 'Every log has been sent (or this device can\'t reach the log store right now).'));
        },
      ),
    ]);
  }

  /** Free Play (round 7): a test run on any map, from any wave, with any
   *  weapons and Armory at any level. Nothing in it counts: no records, no
   *  unlocks, no Armory cards. The setup is kept for next time. */
  private showFreePlay(): void {
    const fp = this.freeSetup;
    // The store build without the unlock: Free Play on the free chapter only.
    if (!freeMaps().includes(fp.map)) fp.map = freeMaps()[0];
    const select = (options: [string, string][], value: string, onChange: (v: string) => void, data: string) => {
      const s = document.createElement('select');
      s.className = 'v3-select';
      s.dataset.fp = data;
      for (const [v, label] of options) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = label;
        s.append(o);
      }
      s.value = value;
      s.addEventListener('change', () => {
        onChange(s.value);
        saveFreeSetup(fp);
        this.showFreePlay();
      });
      return s;
    };
    const line = (label: string, ...controls: HTMLElement[]) => {
      const r = el('div', 'v3-fp-line');
      r.append(el('span', 'v3-fp-label', label), ...controls);
      return r;
    };
    const left = el('div', 'v3-fp-col');
    left.append(
      line('Map', select(freeMaps().map((m) => [m, MAPS[m].name]), fp.map, (v) => (fp.map = v as MapId), 'map')),
      line('Start at', select(Array.from({ length: 10 }, (_, k) => [`${k + 1}`, `Wave ${k + 1}`]), `${fp.wave}`, (v) => (fp.wave = Number(v)), 'wave')),
      // The enemy build: which new enemies come, or one on its own to try.
      line(
        'Enemies',
        select(
          [
            ['campaign', 'As the campaign'],
            ['all', 'All new enemies'],
            ['none', 'No new enemies'],
            ...FOES_BUILT.map((f): [string, string] => [f, `Only: ${FOES[f].name}`]),
          ],
          fp.enemies,
          (v) => (fp.enemies = foeSetting(v)),
          'enemies',
        ),
      ),
      ...[0, 1, 2].map((i) => {
        const w = fp.weapons[i];
        return line(
          `Weapon ${i + 1}`,
          // Prototypes (the weapons plan) are Free Play only, marked so.
          select([['', '—'], ...ABILITY_ORDER.map((a): [string, string] => [a, `${ABILITIES[a].name}${isPrototype(a) ? ' · prototype' : ''}${ROSTER[a].cat === 'active' ? '' : ` (${ROSTER[a].cat})`}`])], w?.id ?? '', (v) => {
            fp.weapons[i] = v ? { id: v as AbilityId, level: w?.level ?? 1 } : null;
          }, `weapon${i}`),
          select([['1', 'LV 1'], ['2', 'LV 2'], ['3', 'MAX']], `${w?.level ?? 1}`, (v) => {
            if (w) w.level = Number(v);
          }, `level${i}`),
        );
      }),
    );
    const right = el('div', 'v3-fp-col');
    right.append(
      ...BAY_ORDER.map((b) => {
        const a = fp.armory[b];
        return line(
          BAYS[b].name,
          select([['', '—'], ...bayItems(b).map((x): [string, string] => [x, ARMORY[x].name])], a?.id ?? '', (v) => {
            fp.armory[b] = v ? { id: v as ArmoryId, level: Math.min(a?.level ?? 1, ARMORY[v as ArmoryId].max) } : null;
          }, `bay-${b}`),
          select(Array.from({ length: a ? ARMORY[a.id].max : ARMORY_MAX }, (_, k): [string, string] => [`${k + 1}`, `LV ${k + 1}`]), `${a?.level ?? 1}`, (v) => {
            if (a) a.level = Number(v);
          }, `bay-level-${b}`),
        );
      }),
    );
    const drops = button('', `v2-switch${fp.frequentDrops ? ' on' : ''}`, () => {
      fp.frequentDrops = !fp.frequentDrops;
      saveFreeSetup(fp);
      this.showFreePlay();
    });
    drops.setAttribute('role', 'switch');
    drops.setAttribute('aria-checked', String(fp.frequentDrops));
    drops.setAttribute('aria-label', 'Frequent weapon drops');
    drops.dataset.fp = 'drops';
    const dropLine = el('label', 'v3-fp-line v3-fp-switch');
    dropLine.append(el('span', 'v3-fp-label', 'Frequent drops'), drops);
    right.append(dropLine);
    const card = (title: string, body: HTMLElement) => {
      const c = el('section', 'v3-set-card v3-fp-card');
      c.append(el('h3', 'v2-setting-group', title), body);
      return c;
    };
    const cols = el('div', 'v3-fp-cols');
    cols.append(card('Map and weapons', left), card('Armory', right));
    const go = button('', 'v2-btn primary v3-sail v3-fp-go', () => this.play(fp.map, fp));
    go.innerHTML = `<span>Start</span>${chromeSvg('arrow', 18)}`;
    go.dataset.freeStart = '1';
    const foot = el('div', 'v3-fp-foot');
    foot.append(el('p', 'v3-hint', 'Nothing in Free Play counts toward records or Armory cards.'), go);
    this.showOverlay('v3-freeplay', [this.screenHead('Free Play', () => this.showMenu()), cols, foot]);
  }

  /** The header every screen around a run shares: Back on the left, the
   *  title in the middle, an optional control on the right. */
  private screenHead(title: string, back: () => void, right?: HTMLElement, eyebrow?: string): HTMLElement {
    const head = el('div', 'v3-head');
    const b = button('', 'v3-top-btn v3-back', back);
    b.innerHTML = `${chromeSvg('back', 18)}<span>Back</span>`;
    // No data-sfx: its "Back" label gets the back sound from the shared
    // click handler.
    b.dataset.back = '1';
    const mid = el('div', 'v3-head-title');
    if (eyebrow) mid.append(el('span', 'v3-eyebrow', eyebrow));
    mid.append(el('h2', '', title));
    const end = el('div', 'v3-head-end');
    if (right) end.append(right);
    head.append(b, mid, end);
    return head;
  }

  /** Before a run, the briefing (menus round): the map's picture, what it
   *  is about, the best so far, and the loadout (one Armory card from each
   *  bay that holds one). `brief` false (Try again): straight back in when
   *  there is no loadout to change. Watch mode and the dev gun override
   *  skip it. */
  private prepare(id: MapId, brief = true): void {
    this.menuChapter = chapterOf(id);
    this.leaveRun();
    this.setBackdrop(id);
    const p = this.progress;
    const bays = BAY_ORDER.filter((b) => bayItems(b).some((a) => armoryLevel(p.armory, a) > 0));
    const watch = this.dev && this.devSettings.watch;
    if ((!bays.length && !brief) || watch || (this.dev && this.devSettings.armory !== 'yours')) {
      this.play(id);
      return;
    }
    const tile = (bay: BayId, a: ArmoryId | null) => {
      const lv = a ? armoryLevel(p.armory, a) : 0;
      const on = p.equipped[bay] === a;
      const t = button('', `v3-gun${on ? ' on' : ''}${a ? '' : ' none'}`, () => {
        if (on) return;
        this.audio.ui('armory.equip');
        equipArmory(p, a, bay);
        this.prepare(id, brief);
      });
      t.dataset.gun = a ?? `none-${bay}`;
      t.dataset.sfx = 'armory';
      t.style.setProperty('--card-color', BAYS[bay].color);
      t.setAttribute('aria-pressed', String(on));
      t.append(el('strong', '', a ? ARMORY[a].name : bay === 'gun' ? 'Base gun' : 'None'));
      if (a) {
        const pips = el('span', 'v2-card-level');
        for (let k = 1; k <= ARMORY[a].max; k++) pips.append(el('i', k <= lv ? 'had' : ''));
        pips.setAttribute('aria-label', `level ${lv} of ${ARMORY[a].max}`);
        t.append(pips);
      }
      return t;
    };
    const kit = el('div', 'v3-brief-kit');
    const kitHead = el('div', 'v3-kit-head');
    kitHead.append(el('span', 'v3-eyebrow', 'Loadout'));
    if (bays.length) {
      const toArmory = button('', 'v3-text-btn', () => this.showArmory(() => this.prepare(id, brief)));
      toArmory.innerHTML = `<span>Armory</span>${chromeSvg('arrow', 14)}`;
      kitHead.append(toArmory);
    }
    kit.append(kitHead);
    if (bays.length) {
      for (const bay of bays) {
        const row = el('div', 'v3-bay-row');
        row.dataset.bay = bay;
        row.style.setProperty('--card-color', BAYS[bay].color);
        const grid = el('div', 'v3-gun-grid');
        const owned = bayItems(bay).filter((a) => armoryLevel(p.armory, a) > 0);
        grid.append(...owned.map((a) => tile(bay, a)), tile(bay, null));
        // The bay's heading says what its chosen card does: once, for the
        // card in use, not on every tile.
        const eq = p.equipped[bay];
        const label = el('span', 'v3-bay-label');
        label.append(el('b', '', BAYS[bay].name), el('span', 'v3-bay-effect', eq ? ARMORY[eq].show(armoryLevel(p.armory, eq)) : 'no upgrade'));
        row.append(label, grid);
        kit.append(row);
      }
    } else {
      // A new player's loadout is the base gun; this is where cards will go.
      const empty = el('div', 'v3-kit-empty');
      empty.innerHTML = chromeSvg('anchor', 26);
      empty.append(el('strong', '', 'Base gun'), el('span', '', `Clear ${CARD_DROPS.minWaves} waves in a run to win an Armory card. Equip cards here.`));
      kit.append(empty);
    }
    const m = MAPS[id];
    const best = p.best[id];
    const info = el('div', 'v3-brief-map');
    const pic = el('span', 'v3-map-pic');
    const img = el('img');
    img.alt = `${m.name} map`;
    const url = thumbNow(id, 640);
    if (url) img.src = url;
    else {
      pic.classList.add('loading');
      void mapThumb(id, 640).then((u) => {
        if (!u) return;
        img.src = u;
        pic.classList.remove('loading');
      });
    }
    pic.append(img);
    info.append(pic, el('p', 'v3-brief-blurb', m.blurb));
    // The map's special event, after its ten waves (its name only). Round
    // 11: its runs are the map's boss rounds.
    const evId = EVENT_MAPS[id];
    if (evId) {
      const line = el('p', 'v3-brief-event');
      line.dataset.briefEvent = evId;
      const last = lastEventWave();
      line.append(el('b', '', last > EVENT_WAVE ? 'Boss rounds:' : 'Boss round:'), document.createTextNode(` ${EVENTS[evId].name}, ${last > EVENT_WAVE ? `waves ${EVENT_WAVE}–${last}` : `wave ${EVENT_WAVE}`}`));
      info.append(line);
    }
    if (best) {
      const b = el('span', 'v3-brief-best');
      b.innerHTML = p.cleared.includes(id) ? `${chromeSvg('check', 13)} Cleared · best ${best.score.toLocaleString()}` : `Best: wave ${best.wave} · ${best.score.toLocaleString()}`;
      b.classList.toggle('cleared', p.cleared.includes(id));
      info.append(b);
    }
    const go = button('', 'v2-btn primary v3-sail', () => this.play(id));
    go.innerHTML = `<span>Sail</span>${chromeSvg('arrow', 18)}`;
    go.dataset.start = '1';
    // Sail sits under the map's description, leaving the loadout the whole
    // right-hand column (a phone has only 375 px of height).
    info.append(go);
    const body = el('div', 'v3-brief');
    const side = el('div', 'v3-brief-side');
    side.append(kit);
    // Each chapter brings new weapons into the draft (the lock-in round):
    // the briefing names them, so a new chapter reads as new kit.
    const arrivals = newInChapter(chapterOf(id));
    const boxes: HTMLElement[] = [];
    if (arrivals.length) {
      const box = el('div', 'v3-brief-new');
      box.dataset.newWeapons = arrivals.join(' ');
      box.append(el('span', 'v3-eyebrow', `New weapons in ${CHAPTERS[chapterOf(id) - 1].name}`));
      const list = el('div', 'v3-new-list');
      for (const a of arrivals) {
        const chip = el('span', 'v3-new-chip');
        chip.style.setProperty('--card-color', ICON_COLOR[a]);
        chip.title = ABILITIES[a].levels[0];
        chip.append(upgradeIcon(a, 16), el('b', '', ABILITIES[a].name), el('i', '', ROSTER[a].cat));
        list.append(chip);
      }
      box.append(list);
      boxes.push(box);
    }
    // The enemy build: the chapter's new enemies, the one this map leads
    // with marked.
    const foes = foesInChapter(chapterOf(id));
    if (foes.length) {
      const first = mapDebut(id);
      const box = el('div', 'v3-brief-new v3-brief-foes');
      box.dataset.newEnemies = foes.join(' ');
      box.append(el('span', 'v3-eyebrow', `New enemies in ${CHAPTERS[chapterOf(id) - 1].name}`));
      const list = el('div', 'v3-new-list');
      for (const f of foes) {
        const chip = el('span', `v3-new-chip v3-foe-chip${f === first ? ' first' : ''}`);
        chip.title = FOES[f].blurb;
        chip.append(el('b', '', FOES[f].name), el('i', '', f === first ? 'first here' : FOES[f].cat));
        list.append(chip);
      }
      box.append(list);
      // Test Lab round 1: what red means, where the enemies that fire red
      // shots are listed.
      if (foes.some((f) => RED_FOES.includes(f))) box.append(el('p', 'v3-brief-red', 'Red shots can\'t be stopped: hit the launcher.'));
      boxes.push(box);
    }
    side.prepend(...boxes);
    body.append(info, side);
    const n = MAP_ORDER.indexOf(id) + 1;
    const chapter = CHAPTERS[chapterOf(id) - 1];
    this.showOverlay('v3-loadout', [this.screenHead(m.name, () => this.showMenu(), undefined, `Map ${n} · ${chapter.name}`), body]);
  }

  /** Settings (UI overhaul, docs/design/v3-ui-overhaul.md): Audio and
   *  Gameplay on the left, Playtest on the right, a build line under them.
   *  The Developer card (developer mode, watch mode, the sound board, the
   *  legacy builds) shows only on the developer route (`?dev=1`) or while
   *  developer mode is on. */
  private showSettings(): void {
    if (STORE) {
      this.showStoreSettings();
      return;
    }
    const notes = this.switchRow('notes', 'Playtest notes', 'A Note button in play and on the menu, and a rating for each volley. Both go into the game log.', this.notesOn, (on) => {
      this.notesOn = on;
      setNotesEnabled(on);
      this.root.classList.toggle('notes', on);
    });
    // Two columns that fit a phone held sideways: Audio and Playtest on the
    // left, Gameplay on the right.
    const play = this.setCard('Playtest', [notes]);
    const left = el('div', 'v3-set-col');
    left.append(this.setCard('Audio', this.soundRows()), play);
    const right = el('div', 'v3-set-col');
    right.append(this.setCard('Gameplay', [this.calloutRow(), this.tipsRow()]));
    const cards: HTMLElement[] = [left, right];
    const devRoute = new URLSearchParams(location.search).has('dev');
    if (this.dev || devRoute) {
      const rows: HTMLElement[] = [this.switchRow('dev', 'Developer mode', 'Short test runs, every map open, a start-wave picker and faster speeds. Dev runs never count.', this.dev, (on) => this.setDev(on))];
      if (this.dev) {
        rows.push(
          this.switchRow(
            'watch',
            'Watch mode',
            'A bot fitted to your logs plays: your tap rhythm, aim and card picks. Watch at up to 10×; touch the field to take over. Every watched run is logged.',
            this.devSettings.watch,
            (on) => {
              this.devSettings.watch = on;
              saveDevSettings(this.devSettings);
            },
          ),
        );
        if (this.devSettings.watch) rows.push(this.personaRow());
        const tools = el('div', 'v3-set-dev-tools');
        const board = button('♪ Sound board', 'v2-btn v3-board-btn', () => void this.showSoundBoard());
        board.dataset.soundBoard = '1';
        tools.append(board);
        // The older builds (the classic game and V2), kept for reference:
        // the artifact build has no other page to link to.
        if (!('claude' in window)) {
          for (const [text, href] of [
            ['Classic ↗', './index.html?legacy=1'],
            ['V2 ↗', './v2.html'],
          ]) {
            const a = el('a', 'v2-btn v3-set-btn v3-set-link', text);
            a.href = href;
            a.dataset.legacy = '1';
            tools.append(a);
          }
        }
        rows.push(tools);
      }
      const card = this.setCard('Developer', rows);
      card.classList.add('wide', 'v3-set-dev');
      cards.push(card);
    }
    const grid = el('div', 'v3-set-grid');
    grid.append(...cards);
    // The build, as a readout in the head (it says which build a log is from).
    const build = el('span', 'v3-set-build', `BUILD ${__BUILD__} · LOG v${LOG_VERSION}`);
    this.showOverlay('v2-settings', [this.screenHead('Settings', () => this.showMenu(), build), grid]);
  }

  /** Settings in the App Store build: Sound (and haptics), and the game card:
   *  the full-game unlock, Game Center, privacy, credits, version and a
   *  progress reset. No playtest or developer rows. */
  private showStoreSettings(): void {
    const sound = this.soundRows();
    if (hapticsAvailable()) {
      sound.push(this.switchRow('haptics', 'Haptics', 'A tap on kills, a thud when a ship is lost, a buzz for a cleared map.', hapticsEnabled(), (on) => setHapticsEnabled(on)));
    }
    const game: HTMLElement[] = [this.calloutRow(), this.tipsRow()];
    if (!ownsFullGame()) {
      const row = this.infoRow('Full game', `Chapter ${FREE_CHAPTERS} is free. One purchase opens chapters 2–4: fifteen more maps.`);
      row.append(button('Unlock', 'v2-btn primary v3-set-btn', () => this.showUnlock()));
      row.dataset.setting = 'unlock';
      game.push(row);
    }
    if (purchasesAvailable()) {
      const row = this.infoRow('Restore purchases', ownsFullGame() ? 'The full game is unlocked on this device.' : 'Bought the full game before? Get it back here.');
      const b = button('Restore', 'v2-btn v3-set-btn', () => {
        b.disabled = true;
        b.textContent = 'Restoring…';
        void restoreFullGame().then((ok) => {
          this.showSettings();
          this.showBannerSoon(ok ? 'Full game restored' : 'No purchase found', ok ? 'Chapters 2–4 are open.' : 'This Apple ID has not bought the full game.', ok ? 'check' : 'info');
        });
      });
      b.dataset.restore = '1';
      row.append(b);
      game.push(row);
    }
    if (gameCenterAvailable()) {
      const row = this.infoRow('Game Center', 'Your best score on each map and your achievements.');
      row.append(button('Open', 'v2-btn v3-set-btn', () => showGameCenter()));
      game.push(row);
    }
    const about: HTMLElement[] = [];
    const privacy = this.infoRow('Privacy', 'Straitwatch collects no data. Your progress stays on this device.');
    const link = el('a', 'v2-btn v3-set-btn v3-set-link', 'Policy');
    link.href = PRIVACY_URL;
    link.target = '_blank';
    link.rel = 'noopener';
    privacy.append(link);
    about.push(privacy);
    about.push(this.infoRow('Credits', 'Made by Calvin Wampol. Sounds: CC0. Icons: Feather (MIT).'));
    const reset = this.infoRow('Reset progress', 'Locks every map but the first and clears scores and cards. Purchases stay.');
    const resetBtn = button('Reset', 'v2-btn v3-set-btn v3-danger', () => this.confirmReset());
    resetBtn.dataset.reset = '1';
    reset.append(resetBtn);
    about.push(reset);
    const aboutCard = this.setCard('About', about);
    aboutCard.append(el('p', 'v3-set-foot', `Straitwatch · Version ${VERSION}`));
    // Two columns: Sound and Game on the left, About on the right.
    const left = el('div', 'v3-set-col');
    left.append(this.setCard('Audio', sound));
    left.append(this.setCard('Gameplay', game));
    const grid = el('div', 'v3-set-grid');
    grid.append(left, aboutCard);
    this.showOverlay('v2-settings', [this.screenHead('Settings', () => this.showMenu()), grid]);
  }

  /** A settings row with a title and one sentence (and room for a button). */
  private infoRow(title: string, text: string): HTMLElement {
    const row = el('div', 'v2-setting');
    const body = el('div', 'v2-setting-text');
    body.append(el('strong', '', title), el('span', '', text));
    row.append(body);
    return row;
  }

  /** Settings → Reset progress: ask first, then wipe everything but the
   *  purchase and the sound settings. */
  private confirmReset(): void {
    const row = el('div', 'v2-btn-row');
    row.append(
      button('Cancel', 'v2-btn primary', () => this.showSettings()),
      button('Reset progress', 'v2-btn v3-danger', () => {
        clearAll(['straitwatch.v3.progress', 'straitwatch.v3.seen', 'straitwatch.v3.tips', 'straitwatch.v3.freeplay']);
        this.progress = loadProgress();
        this.freeSetup = loadFreeSetup();
        this.menuChapter = 0;
        this.showMenu();
      }),
    );
    row.querySelector<HTMLElement>('.v3-danger')!.dataset.confirmReset = '1';
    this.showOverlay('v3-confirm', [el('h2', '', 'Reset progress?'), el('p', 'v2-sub', 'Every map but the first locks again, and best scores and Armory cards are cleared. This cannot be undone.'), row]);
  }

  /** The full-game unlock: what it opens, the price, Unlock and Restore. */
  private showUnlock(): void {
    const price = el('strong', 'v3-unlock-price', '');
    const buy = button('Unlock the full game', 'v2-btn primary v3-unlock-buy', () => {
      buy.disabled = true;
      void buyFullGame().then((ok) => {
        buy.disabled = false;
        if (ok) this.showMenu();
      });
    });
    buy.dataset.unlock = '1';
    const restore = button('Restore purchase', 'v2-btn', () => {
      restore.disabled = true;
      void restoreFullGame().then((ok) => {
        restore.disabled = false;
        if (ok) this.showMenu();
        else restore.textContent = 'No purchase found';
      });
    });
    const row = el('div', 'v2-btn-row');
    if (purchasesAvailable()) row.append(buy, restore);
    row.append(button('Not now', 'v2-btn', () => this.showMenu()));
    const chapters = el('ul', 'v3-unlock-list');
    for (const c of CHAPTERS.filter((x) => x.n > FREE_CHAPTERS)) chapters.append(el('li', '', `Chapter ${c.n}: ${c.name}`));
    const body: HTMLElement[] = [
      el('span', 'v3-eyebrow', 'FULL GAME'),
      el('h2', '', 'Fifteen more maps'),
      el('p', 'v2-sub', 'One purchase opens chapters 2–4 for good, on every device with your Apple ID. No ads, no subscriptions.'),
      chapters,
      price,
      row,
    ];
    if (!purchasesAvailable()) body.splice(4, 0, el('p', 'v3-hint', 'Purchases are not available right now.'));
    this.showOverlay('v3-unlock', body);
    void unlockPrice().then((p) => {
      if (p) price.textContent = p;
    });
  }

  /** The answer to a purchase restore, once the screen has settled (after a
   *  redraw): shown whatever the Call-outs setting. */
  private showBannerSoon(title: string, text: string, icon: CalloutIcon): void {
    requestAnimationFrame(() => this.showBanner(title, text, { now: true, kind: 'alarm', icon }));
  }

  /** A titled card of settings rows. */
  private setCard(title: string, rows: HTMLElement[]): HTMLElement {
    const card = el('section', 'v3-set-card');
    card.append(el('h3', 'v2-setting-group', title), ...rows);
    return card;
  }

  /** Dev: every sound in the game, by family, with a play button, its
   *  files and where they came from (public/v3/audio/CREDITS.json). */
  private async showSoundBoard(): Promise<void> {
    // Developer mode only: compiled out of the store build.
    if (!STORE) {
      this.audio.unlock();
      let credits: { file: string; source: string; licence: string }[] = [];
      try {
        credits = await (await fetch(`${import.meta.env.BASE_URL ?? './'}v3/audio/CREDITS.json`)).json();
      } catch {
        /* shown without sources */
      }
      const list = el('div', 'v3-board');
      for (const id of CUE_IDS) {
        const def = SOUNDS[id];
        const row = el('div', 'v3-board-row');
        const play = button('▶', 'v2-dev-chip', () => {
          if (MUSIC_CUES.includes(id as MusicCue)) this.boardMusic = id as MusicCue;
          else this.audio.play({ id, x: 800, y: 450 });
        });
        play.dataset.cue = id;
        play.dataset.sfx = 'board';
        const c = credits.find((x) => x.file === def.files[0]);
        const src = c ? `${c.licence} · ${c.source.startsWith('uisfx') ? 'uisfx (recorded)' : 'synthesized'}` : '';
        row.append(play, el('strong', '', id), el('span', '', `${def.bus} · vol ${def.volume} · ${def.files.length} file${def.files.length > 1 ? 's' : ''}${LOOP_CUES.includes(id as LoopCue) ? ' · loop (one pass)' : ''}`), el('em', '', src));
        list.append(row);
      }
      const stop = button('Stop music', 'v2-btn', () => (this.boardMusic = null));
      stop.dataset.sfx = 'board';
      const row = el('div', 'v2-btn-row');
      row.append(
        stop,
        button('Back', 'v2-btn primary', () => {
          this.boardMusic = undefined;
          this.showSettings();
        }),
      );
      this.boardMusic = 'menu.music';
      this.showOverlay('v3-soundboard', [el('h2', '', 'Sound board'), el('p', 'v2-sub', 'Every sound in the game. Files and licences: public/v3/audio/CREDITS.json. To change one, see docs/design/v3-sound-round1.md.'), list, row]);
    }
  }

  /** Settings → Sound: on/off, volume, music. Saved on this device. */
  private soundRows(): HTMLElement[] {
    const a = this.audio.settings;
    const mute = this.switchRow('sound', 'Sound', 'Effects and music. The phone’s silent switch still applies.', !a.muted, (on) => this.audio.setSettings({ muted: !on }));
    const slider = (id: string, title: string, value: number, set: (v: number) => void) => {
      const r = el('label', 'v2-setting v3-slider-row');
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '100';
      input.value = String(Math.round(value * 100));
      input.className = 'v3-range';
      input.dataset.setting = id;
      input.disabled = a.muted;
      input.addEventListener('input', () => set(Number(input.value) / 100));
      r.append(el('strong', '', title), input);
      return r;
    };
    return [
      mute,
      slider('volume', 'Volume', a.volume, (v) => this.audio.setSettings({ volume: v })),
      slider('music', 'Music', a.music, (v) => this.audio.setSettings({ music: v })),
    ];
  }

  /** Watch mode's bot: who plays (round 12). One chip per persona, and the
   *  chosen one's description. */
  private personaRow(): HTMLElement {
    const st = this.devSettings;
    const row = el('div', 'v2-setting v2-persona');
    const chips = el('div', 'v2-persona-chips');
    for (const id of PERSONA_ORDER) {
      const b = button(PERSONAS[id].label ?? id, `v2-dev-chip${st.bot === id ? ' on' : ''}`, () => {
        st.bot = id;
        saveDevSettings(st);
        this.showSettings();
      });
      b.dataset.persona = id;
      chips.append(b);
    }
    const p = PERSONAS[st.bot] ?? YOU;
    const body = el('div', 'v2-setting-text');
    const pace = p.speed && p.speed !== 1 ? ` Its game runs at ${p.speed}×, the speed it plays at, so 1× here is its real time.` : '';
    body.append(el('strong', '', 'Bot personality'), chips, el('span', 'v2-persona-blurb', `${p.blurb ?? ''}${pace}`));
    row.append(body);
    return row;
  }

  /** Call-outs: All (a new player's teaching), Essential (only what must be
   *  answered now), Off (only the last-ship alarm). */
  private calloutRow(): HTMLElement {
    const level = this.alerts.level;
    const row = el('div', 'v2-setting v3-choice-row');
    const chips = el('div', 'v3-choice');
    chips.setAttribute('role', 'radiogroup');
    for (const id of CALLOUT_LEVELS) {
      const b = button(CALLOUT_LABEL[id], `v2-dev-chip${id === level ? ' on' : ''}`, () => {
        this.alerts.level = id;
        saveCalloutLevel(id);
        this.showSettings();
      });
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(id === level));
      b.dataset.callouts = id;
      chips.append(b);
    }
    row.append(el('strong', '', 'Call-outs'), chips, el('span', '', CALLOUT_BLURB[level]));
    return row;
  }

  /** Settings → Show tips again (pause-menu round): every enemy, weapon and
   *  map is introduced again the next time the player meets it, and a fresh
   *  save's first-map tips come back. */
  private tipsRow(): HTMLElement {
    const seen = seenTypes();
    const n = [...seen].filter((id) => !id.startsWith('tip:')).length;
    const row = this.infoRow('Show tips again', `Each new type is explained once. ${n ? `${n} met.` : 'None met yet.'}`);
    row.dataset.setting = 'tips';
    row.dataset.tipsSeen = String(seen.size);
    const b = button('Show again', 'v2-btn v3-set-btn', () => {
      clearSeen();
      this.showSettings();
    });
    b.dataset.tipsReset = '1';
    b.disabled = !seen.size;
    row.append(b);
    return row;
  }

  private switchRow(id: string, title: string, text: string, on: boolean, set: (on: boolean) => void): HTMLElement {
    const sw = button('', `v2-switch${on ? ' on' : ''}`, () => {
      set(!on);
      this.showSettings();
    });
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-checked', String(on));
    sw.dataset.setting = id;
    const row = el('div', 'v2-setting');
    const body = el('div', 'v2-setting-text');
    body.append(el('strong', '', title), el('span', '', text));
    row.append(body, sw);
    return row;
  }

  /** Dev mode's menu strip: run length preset and start wave. */
  private devPanel(): HTMLElement {
    const box = el('div', 'v2-dev');
    const render = () => {
      const st = this.devSettings;
      const presets = el('div', 'v2-dev-presets');
      for (const id of DEV_ORDER) {
        const b = button(DEV_PRESETS[id].label, `v2-dev-chip${st.preset === id ? ' on' : ''}`, () => {
          st.preset = id;
          saveDevSettings(st);
          render();
        });
        b.dataset.preset = id;
        presets.append(b);
      }
      const wave = el('div', 'v2-dev-wave');
      const bump = (d: number) => () => {
        st.wave = Math.max(1, Math.min(lastEventWave(), st.wave + d));
        saveDevSettings(st);
        render();
      };
      wave.append(el('span', '', 'Start wave'), button('−', 'v2-dev-chip', bump(-1)), el('b', '', `${st.wave}`), button('+', 'v2-dev-chip', bump(1)));
      const gun = el('div', 'v2-dev-presets');
      gun.append(el('span', 'v3-dev-label', 'Gun'));
      for (const id of Object.keys(DEV_ARMORY) as DevArmory[]) {
        const b = button(DEV_ARMORY[id], `v2-dev-chip${st.armory === id ? ' on' : ''}`, () => {
          st.armory = id;
          saveDevSettings(st);
          render();
        });
        b.dataset.devArmory = id;
        gun.append(b);
      }
      box.replaceChildren(
        el('strong', 'v2-dev-title', st.watch ? 'DEV · WATCH MODE' : 'DEV PLAYTEST'),
        presets,
        wave,
        gun,
        el('p', 'v2-dev-blurb', `${DEV_PRESETS[st.preset].blurb}${st.watch ? ` Tap a map to watch ${st.bot === YOU.id ? 'bot-you' : `the ${PERSONAS[st.bot]?.label ?? st.bot} bot`} play it; touch the battlefield to take over.` : ''}`),
      );
    };
    render();
    return box;
  }

  /** Start a run on `id`; with `free`, a Free Play run set up that way. */
  private play(id: MapId, free: FreeSetup | null = null, lab: LabSetup | null = null, convoy: ConvoySetup | null = null, encounters: EncounterSetup | null = null, jump?: { start: number; retry: NonNullable<PlayLog['retry']> }, armory?: ArmoryLevels, labWatch = false): void {
    if (this.askBeforeNew(() => this.play(id, free, lab, convoy, encounters, jump, armory))) return;
    // Playtest knobs: ?wave=N starts at wave N, ?seed=N replays one seed.
    // Dev mode adds a run-length preset and a start wave.
    // A map card's full run in the Test Lab (round 10) is the campaign's own
    // map from wave 1: no playtest knob, dev preset or watch bot changes it.
    const params = new URLSearchParams(location.search);
    const fullMap = lab?.plays === 'full';
    const preset = this.dev && !free && !fullMap ? DEV_PRESETS[this.devSettings.preset] : null;
    const tempo = preset?.tempo;
    // A Test Lab "Skip to boss" (round 12, `jump`) starts at the boss rounds.
    const start = jump ? jump.start : free ? free.wave : fullMap ? 1 : (!STORE && Number(params.get('wave'))) || (this.dev ? this.devSettings.wave : 1);
    const skip = tempo ? firstPlayedWave(start, tempo) : start;
    const seed = !STORE && params.has('seed') ? Number(params.get('seed')) : this.seedCounter++;
    // A Test Lab Watch run (log v65) plays the card's own setup, with the
    // "you" bot at the controls; the dev watch mode stays the dev's.
    labWatch = labWatch && !!lab;
    const watch = labWatch || (this.dev && !free && !fullMap && this.devSettings.watch);
    const botId = labWatch ? YOU.id : this.devSettings.bot;
    if (this.rec) this.endRun('quit');
    this.free = free ? structuredClone(free) : null;
    this.radarShown = false;
    this.redShown = false;
    const freePlay = free ? freePlaySetup(free) : undefined;
    this.game = createGame(id, seed, skip, tempo, armory ?? (free ? freeArmory(free) : this.runArmory()));
    if (freePlay) applyFreePlay(this.game, freePlay);
    if (lab) applyLab(this.game, lab);
    // The Map & Convoy Lab: the map's authored encounters, then the convoy
    // policy this test is played under (the order a replay applies them in).
    if (encounters) applyEncounters(this.game, encounters);
    if (convoy) applyConvoy(this.game, convoy);
    if (!lab) this.endLabRun();
    this.rec = new Recorder(this.game, {
      build: __BUILD__,
      startedAt: new Date().toISOString(),
      firstWave: skip,
      ...(freePlay ? { freePlay } : {}),
      ...(lab ? { lab } : {}),
      ...(encounters ? { encounters } : {}),
      ...(convoy ? { convoy } : {}),
      ...(tempo ? { tempo, dev: { preset: this.devSettings.preset, ...(watch && !labWatch ? { watch: true, bot: this.devSettings.bot } : {}) } } : {}),
      ...(labWatch ? { control: playControl(botId, []) } : {}),
      ...(jump ? { retry: jump.retry } : {}),
      device: this.deviceInfo(),
    });
    this.lastTel = null;
    // A skip is not a whole run: no Map & Convoy Lab telemetry for it.
    if (!jump && this.telWanted(!!lab)) {
      this.rec.telemetry(lab ? 'lab' : watch ? 'watch' : free ? 'freePlay' : 'campaign', watch ? botId : 'human', {
        touch: navigator.maxTouchPoints > 0,
        w: window.innerWidth,
        h: window.innerHeight,
        landscape: window.innerWidth >= window.innerHeight,
      });
    }
    this.startWatch(watch, seed, botId, labWatch);
    if (watch) this.setSpeed(this.botSpeed);
    else if (preset) this.setSpeed(preset.speed);
    this.begin();
  }

  private deviceInfo(): PlayLog['device'] {
    return {
      w: window.innerWidth,
      h: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
      touch: navigator.maxTouchPoints > 0,
      ua: navigator.userAgent.slice(0, 160),
    };
  }

  /** The main gun for a run: the one equipped upgrade, or a dev override
   *  (the base gun, or the equipped upgrade, Wide Warhead if none, maxed). */
  private runArmory(): ArmoryLevels {
    if (!this.dev || this.devSettings.armory === 'yours') return runLoadout(this.progress);
    if (this.devSettings.armory === 'none') return {};
    const eq = this.progress.equipped;
    const ids = [eq.gun ?? 'warhead', eq.hull, eq.supply].filter((a): a is ArmoryId => !!a);
    return Object.fromEntries(ids.map((a) => [a, ARMORY[a].max]));
  }

  /** Watch mode on or off for the run starting now. */
  private startWatch(watch: boolean, seed: number, persona = YOU.id, lab = false): void {
    this.bot = watch ? new Mimic(PERSONAS[persona] ?? YOU, seed) : null;
    this.control = watch ? 'bot' : 'you';
    this.labWatch = watch && lab;
    // A Test Lab Watch run starts at 1x; the dev's watch speed is kept.
    this.botSpeed = this.labWatch ? 1 : this.devSettings.watchSpeed;
    // A run carried on from another (a wave retry) whose player held the
    // controls last: the bot takes them back from here.
    if (watch && this.rec && this.rec.controller !== 'bot') this.rec.control('bot');
    this.useSpeedSteps(watch ? WATCH_SPEED_STEPS : this.dev ? DEV_SPEED_STEPS : SPEED_STEPS);
    this.root.classList.toggle('watching', watch);
    this.root.classList.toggle('watch-lab', this.labWatch);
    this.syncControl();
  }

  /** Freeze the screen on a log's game as it stood at `step`. */
  private showMoment(log: PlayLog, step: number): { wave: number; waveT: number; phase: string } {
    const upto = log.commands.findIndex((c) => c[0] > step);
    const g = replayTo(log, step, upto < 0 ? log.commands.length : upto);
    g.events = [];
    this.resetFinale();
    if (this.rec) this.endRun('quit');
    this.rec = null;
    this.bot = null;
    this.labWatch = false;
    this.game = g;
    this.lastPhase = g.phase;
    this.paused = true;
    this.root.classList.add('playing');
    this.root.classList.remove('watching', 'watch-lab', 'watch-bot');
    this.hideOverlay();
    this.syncConvoy();
    return { wave: g.wave, waveT: g.waveT, phase: g.phase };
  }

  /** Watch mode: take over (back to 1×) or hand back (to the watch speed). */
  private setControl(who: Controller): void {
    if (!this.bot || !this.rec || !this.game || who === this.control) return;
    this.control = who;
    this.rec.control(who);
    this.hold = null;
    this.dropGesture();
    const lab = this.labWatch;
    if (who === 'you') {
      this.setSpeed(1);
      this.showBanner('YOU HAVE CONTROL', lab ? 'Playing from here. Let the bot play hands it back.' : 'Tap BOT on the right to hand back.', { now: true, key: 'control', kind: 'ack' });
    } else {
      this.setSpeed(this.botSpeed);
      this.showBanner('BOT HAS CONTROL', lab ? 'Tap Take over to play from here.' : 'Touch the battlefield to take over.', { now: true, key: 'control', kind: 'ack' });
      if (this.game.phase === 'draft') this.botDraft(this.game);
    }
    this.syncControl();
    // The draft on screen changes hands too: drawn again for whoever has it.
    if (lab && this.game.phase === 'draft' && this.overlay.dataset.screen === 'draft') {
      this.showDraft(this.game);
      this.armDraft();
    }
  }

  private syncControl(): void {
    const bot = this.control === 'bot';
    if (this.labWatch) {
      this.controlBtn.replaceChildren(el('b', '', bot ? 'Take over' : 'Let bot play'), el('span', '', bot ? 'bot playing' : 'you playing'));
      this.controlBtn.setAttribute('aria-label', bot ? 'The bot is playing. Take over.' : 'You are playing. Let the bot play.');
    } else {
      this.controlBtn.replaceChildren(el('b', '', bot ? 'BOT' : 'YOU'), el('span', '', bot ? 'take over' : 'hand back'));
      this.controlBtn.setAttribute('aria-label', bot ? 'The bot is playing. Take over.' : 'You are playing. Hand back to the bot.');
    }
    this.controlBtn.classList.toggle('bot', bot);
    this.controlBtn.dataset.control = this.control;
    this.root.classList.toggle('watch-bot', !!this.bot && bot);
  }

  /** A Test Lab Watch run's pause menu: hand the controls over from there
   *  too (the game stays paused; Resume plays on with the new hands). */
  private watchActions(): HTMLElement[] {
    if (!this.labWatch || !this.bot) return [];
    const bot = this.control === 'bot';
    const b = button(bot ? '🎮 Take over' : '🤖 Let the bot play', 'v2-btn v3-lab-act v3-watch-swap', () => {
      this.setControl(bot ? 'you' : 'bot');
      this.showPauseMenu();
    });
    b.dataset.watchSwap = bot ? 'you' : 'bot';
    return [b];
  }

  /** Watching the bot fast, cards deal in faster too. */
  private dealScale(): number {
    return this.bot && this.control === 'bot' ? 1 / Math.sqrt(Math.max(1, this.speed)) : 1;
  }

  /** The bot's draft: its pick lights up for a moment (shorter when
   *  watching fast), then it takes it. */
  private botDraft(g: Game): void {
    const bot = this.bot;
    if (!bot) return;
    const wave = g.wave;
    const live = () => this.game === g && g.phase === 'draft' && g.wave === wave && this.control === 'bot';
    // The whole hand is dealt before the bot's pick shows, at any speed.
    const dealt = (DEAL_MS + DEAL_STAGGER_MS * (g.offer.length - 1)) * this.dealScale();
    // Quartermaster 5: the free level-up first, on the weapon it stacks.
    const free = freeLevelPick(g);
    if (free) {
      setTimeout(() => {
        if (!live() || !this.rec?.freeLevel(free)) return;
        this.showDraft(g);
        this.armDraft();
        this.botDraft(g);
      }, dealt + 700 / Math.sqrt(this.speed));
      return;
    }
    // Quartermaster: a hand with nothing it wants, it deals again.
    if (bot.wantsReroll(g)) {
      setTimeout(() => {
        if (!live() || !this.rec?.reroll()) return;
        this.showDraft(g);
        this.armDraft();
        this.botDraft(g);
      }, dealt + 700 / Math.sqrt(this.speed));
      return;
    }
    const choice = bot.choose(g);
    setTimeout(() => {
      if (!live()) return;
      this.overlay.querySelector(`[data-upgrade="${choice.id}"]`)?.classList.add('bot-pick');
      this.overlay.querySelector('.v2-panel')?.append(el('p', 'v2-sub v2-bot-says', `Bot picks ${cardName(choice.id, (!isSpecialCard(choice.id) ? (g.levels[choice.id] ?? 0) : 0) + 1)}`));
    }, dealt);
    setTimeout(
      () => {
        if (live()) this.rec?.pick(choice.id, choice.replace);
      },
      dealt + 1400 / Math.sqrt(this.speed),
    );
  }

  /** Round 12 (the player: "when I fail like this in the test lab have an
   *  option to reset that wave so I can try again or I can also skip forward
   *  to the boss wave so all of that can save me time"): the Test Lab's two
   *  jumps, for its end screen and its pause menu. "Retry wave N": the wave
   *  in play (or just lost) again from its start, as it was (the run
   *  replayed to there: the same weapons, ships, score and Scrap). "Skip to
   *  boss" (a full map run before its boss rounds): a new run from the
   *  first boss round holding the weapons held now. Either one seals this
   *  run's log (lost, or left) and starts a new log marked `retry`. */
  private labJumps(g: Game): HTMLElement[] {
    const run = this.labRun;
    const rec = this.rec;
    if (!run || !rec || !g.lab || this.playback || rec.game !== g) return [];
    const out: HTMLElement[] = [];
    const mark = rec.mark;
    if ((g.phase === 'wave' || g.phase === 'lost') && mark.wave <= g.wave) {
      const label = mark.wave >= EVENT_WAVE && eventFor(g) ? 'Retry the boss rounds' : `Retry wave ${mark.wave}`;
      const b = button(label, 'v2-btn v3-lab-act v3-lab-retry', () => this.labRetry());
      b.dataset.labRetry = String(mark.wave);
      out.push(b);
    }
    if (g.lab.full && eventFor(g) && g.wave < EVENT_WAVE && g.phase !== 'won') {
      const b = button('Skip to boss', 'v2-btn v3-lab-act v3-lab-skip', () => this.labSkipToBoss());
      b.dataset.labSkip = '1';
      out.push(b);
    }
    return out;
  }

  /** The run's log sealed (a loss as lost, anything else as left) and kept
   *  with the card's tests, for a jump to start a new one. */
  private sealForJump(): PlayLog | null {
    const run = this.labRun;
    const g = this.game;
    if (!run || !g || !this.rec) return null;
    const log = this.endRun(g.phase === 'lost' ? 'lost' : 'quit');
    this.rec = null;
    this.labDraft = null;
    if (!log) return null;
    clearRun(log.id);
    keepLabLog(run.card.id, log);
    return log;
  }

  /** "Retry wave N" (round 12): as the dev retry, for a test. */
  private labRetry(): void {
    const run = this.labRun;
    const rec = this.rec;
    if (!run || !rec) return;
    const mark = { ...rec.mark };
    const log = this.sealForJump();
    if (!log) return;
    const g = replayTo(log, mark.steps, mark.commands);
    // The replay's own banners and blasts are old news.
    g.events = [{ kind: 'wave', wave: g.wave }];
    this.lastTel = null;
    this.game = g;
    this.rec = new Recorder(
      g,
      {
        build: __BUILD__,
        startedAt: new Date().toISOString(),
        firstWave: log.firstWave,
        ...(log.tempo ? { tempo: log.tempo } : {}),
        ...(log.freePlay ? { freePlay: log.freePlay } : {}),
        ...(log.lab ? { lab: log.lab } : {}),
        ...(log.encounters ? { encounters: log.encounters } : {}),
        ...(log.convoy ? { convoy: log.convoy } : {}),
        ...(log.control ? { control: playControl(log.control.bot, []) } : {}),
        retry: { of: log.id, wave: mark.wave, step: mark.steps },
        device: this.deviceInfo(),
      },
      { log, mark },
    );
    this.startWatch(!!run.watch, g.seed, YOU.id, true);
    if (run.watch) this.setSpeed(this.botSpeed);
    this.root.classList.add('lab-on');
    this.begin();
  }

  /** "Skip to boss" (round 12): the card's run again from the first boss
   *  round, holding the weapons held now. */
  private labSkipToBoss(): void {
    const run = this.labRun;
    const g = this.game;
    if (!run || !g) return;
    const loadout = g.slots.filter((id) => (g.levels[id] ?? 0) > 0).map((id) => ({ id, level: g.levels[id]! }));
    // The same Armory as the run it skips from (the Test Lab's, on a map card).
    const armory = { ...g.armory };
    const log = this.sealForJump();
    if (!log) return;
    const plan = labRunPlan(run.card, run.setup, null);
    this.play(run.card.map, null, { ...plan.lab, loadout, ...(log.lab?.armory ? { armory: log.lab.armory } : {}) }, plan.convoy, plan.encounters, { start: EVENT_WAVE, retry: { of: log.id, wave: EVENT_WAVE, step: 0, skip: true } }, armory, !!run.watch);
    this.labRun = run;
    this.root.classList.add('lab-on');
  }

  /** Dev: restart the wave just lost, with the same cards, ships and score,
   *  as a new log that carries the old run's inputs up to that wave. */
  private retryWave(rec: Recorder): void {
    const { mark, log } = rec;
    const g = replayTo(log, mark.steps, mark.commands, { telemetry: this.telWanted(false) });
    this.lastTel = null;
    // The replay's own banners and blasts are old news.
    g.events = [{ kind: 'wave', wave: g.wave }];
    this.game = g;
    this.rec = new Recorder(
      g,
      {
        build: __BUILD__,
        startedAt: new Date().toISOString(),
        firstWave: log.firstWave,
        ...(log.tempo ? { tempo: log.tempo } : {}),
        dev: { preset: log.dev?.preset ?? 'full', retryOf: log.id, ...(log.dev?.watch ? { watch: true, ...(log.dev.bot ? { bot: log.dev.bot } : {}) } : {}) },
        device: log.device,
      },
      { log, mark },
    );
    // A watched run from before personas was played by you-v1.
    this.startWatch(!!log.dev?.watch && this.dev, log.seed, log.dev?.bot ?? 'you-v1');
    if (this.bot) this.setSpeed(this.devSettings.watchSpeed);
    this.begin();
  }

  private setSpeed(v: number): void {
    const k = Math.max(0, this.speedSteps.indexOf(v));
    this.speed = this.speedSteps[k];
    this.speedSlider.set(k);
    this.rec?.speed(this.speed);
  }

  private begin(): void {
    if (!this.game) return;
    this.resetFinale();
    this.ghostRun = null;
    this.lastPhase = null;
    this.acc = 0;
    this.paused = false;
    this.pauseBtn.textContent = 'II';
    this.root.classList.add('playing');
    this.syncConvoy();
    this.hideOverlay();
    // The HUD drew the run before until the next frame: the overlay is gone
    // now, so the counter must already be the new run's (a Test Lab "Skip
    // to boss" showed "WAVE 1 of 10" over boss round 1 for a frame, and the
    // e2e read it whenever no frame fell between the tap and the check).
    this.renderHud(this.game);
  }

  /** The foot of the dock (round 16: no left rail): the map's convoy command, one big button
   *  (Tactical on a map with a command: Hold on Sowers' Reach). Every other
   *  run, in every game type, shows nothing there (round 16: no "CONVOY
   *  sails itself" note, and no flow slider or formation button). */
  private syncConvoy(): void {
    const g = this.game;
    const policy = g?.convoy?.setup.policy ?? 'current';
    for (const p of ['auto', 'formation', 'tactical']) this.root.classList.toggle(`convoy-${p}`, policy === p);
    this.commandBox.replaceChildren();
    this.commandBtns = [];
    this.commandsTaught.clear();
    this.commandSays.classList.remove('on');
    const cmds = g ? convoyCommands(g) : [];
    // The dock's foot is laid out for the button only when there is one.
    this.root.classList.toggle('convoy-command', cmds.length > 0);
    if (!cmds.length) return;
    for (const id of cmds) {
      const def = COMMANDS[id];
      const b = button('', 'v3-command v3-big-cmd', () => this.giveCommand(id));
      b.dataset.command = id;
      const state = el('small', '', 'READY');
      const bar = el('i');
      b.append(el('b', '', def.name), state, bar);
      this.commandBox.append(b);
      this.commandBtns.push({ id, el: b, state, bar, key: '' });
    }
    this.commandBox.append(this.commandSays);
  }

  /** Words beside the command buttons for a couple of seconds. */
  private sayCommand(text: string, refused: boolean): void {
    const t = this.commandSays;
    t.textContent = text;
    t.classList.toggle('refused', refused);
    t.classList.remove('on');
    void t.offsetWidth;
    t.classList.add('on');
    const n = ++this.commandSaysT;
    window.setTimeout(() => {
      if (n === this.commandSaysT) t.classList.remove('on');
    }, refused ? 2600 : 2000);
  }

  /** A tap on a command's button: given through the recorder (a logged
   *  input). The first time each is given in a run its cost is said once;
   *  a refusal shakes the button and says why. */
  private giveCommand(id: CommandId): void {
    const g = this.game;
    if (!g || !this.rec || this.paused || this.playback || g.phase !== 'wave') return;
    const was = g.convoy?.holding;
    const stopping = id === 'hold' && !was ? holdable(g).length : 0;
    const res = this.rec.command(id);
    const c = this.commandBtns.find((o) => o.id === id);
    if (!res.ok) {
      this.audio.ui('ui.back');
      this.sayCommand(`${COMMANDS[id].name.toUpperCase()}: ${refusalText(g, id, res.why)}`, true);
      if (c) {
        c.el.classList.remove('refused');
        void c.el.offsetWidth;
        c.el.classList.add('refused');
      }
      return;
    }
    this.audio.ui('ui.toggle');
    if (id === 'hold') this.sayCommand(was ? 'RELEASED: the held ships sail on' : `HOLDING: ${stopping} ship${stopping === 1 ? '' : 's'} stopped`, false);
    if (!this.commandsTaught.has(id)) {
      this.commandsTaught.add(id);
      const def = COMMANDS[id];
      this.showBanner(def.name.toUpperCase(), `${def.says} ${def.cost}`, { now: true, kind: 'ack', icon: 'wave' }, null);
    }
  }

  /** Each frame: every command button says where it stands. */
  private renderCommands(g: Game): void {
    for (const c of this.commandBtns) {
      const st = commandState(g, c.id);
      const def = COMMANDS[c.id];
      const total = CONVOY.hold.max;
      const cool = CONVOY.hold.cooldown;
      // Round 15: it glows when now is the moment (a ship about to sail onto
      // a mine, a shell coming down where a ship is about to be).
      const advised = commandAdvised(g, c.id);
      const label = st.active ? `${def.active.toUpperCase()} ${Math.ceil(st.left)}` : st.cool > 0 ? `WAIT ${Math.ceil(st.cool)}` : advised ? 'NOW!' : st.ready ? 'READY' : 'NO SHIPS';
      const name = st.active ? 'Release' : def.name;
      const fill = st.active ? st.left / total : st.cool > 0 ? 1 - st.cool / cool : st.ready ? 1 : 0;
      const key = `${name}|${label}|${st.active ? 'a' : st.ready ? 'r' : 'w'}|${Math.round(fill * 40)}|${advised}`;
      if (key === c.key) continue;
      c.key = key;
      c.el.firstElementChild!.textContent = name;
      c.state.textContent = label;
      c.bar.style.width = `${Math.round(fill * 100)}%`;
      c.el.classList.toggle('active', st.active);
      c.el.classList.toggle('waiting', !st.active && !st.ready);
      c.el.classList.toggle('advised', advised);
      c.el.setAttribute('aria-disabled', String(!st.ready));
      c.el.setAttribute('aria-label', `${name}: ${def.says} ${def.cost} ${label.toLowerCase()}`);
    }
  }

  /** The draft: three weapons. With all slots full a new one can still be
 *  taken: tap it, then tap the held weapon it replaces. */
  private showDraft(g: Game, swapping: AbilityId | null = null, freeing = false): void {
    const owned = g.slots;
    const full = owned.length >= MAX_SLOTS;
    // Quartermaster 5's free level-up: after its button, the held weapons
    // below MAX are tapped to take the level (the draft's pick stays).
    if (freeing && (swapping || g.freeLevelsLeft <= 0)) freeing = false;
    const slots = el('div', `v2-slots${swapping || freeing ? ' choosing' : ''}`);
    for (let i = 0; i < MAX_SLOTS; i++) {
      const id = owned[i];
      const lv = id ? (g.levels[id] ?? 0) : 0;
      const label = id ? `${abilityName(id, lv)} ${lv >= ABILITY_MAX ? 'MAX' : `LV ${lv}`}` : 'Empty slot';
      if (freeing && id && lv < ABILITY_MAX) {
        const chip = button(label, 'v2-slot v3-free-slot', () => {
          if (!this.rec?.freeLevel(id)) return;
          this.audio.ui(lv + 1 >= ABILITY_MAX ? 'card.max' : 'card.pick');
          this.showDraft(g);
          this.overlay.querySelector<HTMLElement>('.v2-draft')?.setAttribute('data-armed', '1');
        });
        chip.dataset.sfx = 'card';
        chip.dataset.free = id;
        chip.prepend(upgradeIcon(id, 16));
        chip.append(el('span', 'v3-free-plus', '+1'));
        slots.append(chip);
        continue;
      }
      if (swapping && id) {
        const chip = button(label, 'v2-slot swap', () => {
          this.audio.ui('card.pick');
          this.rec?.pick(swapping, id);
        });
        chip.dataset.sfx = 'card';
        chip.dataset.slot = id;
        chip.prepend(upgradeIcon(id, 16));
        chip.append(el('span', 'v2-slot-x', '✕'));
        slots.append(chip);
        continue;
      }
      const chip = el('span', `v2-slot${id ? '' : ' empty'}`, label);
      if (id) chip.prepend(upgradeIcon(id, 16));
      if (id) chip.style.setProperty('--card-color', ICON_COLOR[id]);
      slots.append(chip);
    }
    this.picking = false;
    const cards = g.offer.map((id, i) => {
      const special = isSpecialCard(id);
      const lvl = special ? 0 : (g.levels[id] ?? 0);
      const next = lvl + 1;
      const takeable = canTake(g.levels, id);
      const swappable = canSwapIn(g.levels, id);
      const maxed = !special && lvl >= ABILITY_MAX;
      // The last level is called MAX, not "evolves" (round 7 playtest).
      const toMax = !special && next === ABILITY_MAX;
      const badge = id === 'resupply' ? 'NO SWAP' : id === 'lifeboat' ? '+1 LIFE' : maxed ? 'MAXED' : swappable ? 'SWAP IN' : toMax ? 'MAX' : lvl > 0 ? 'LEVEL UP' : 'NEW';
      const chosen = swapping === id;
      const card = button('', `v2-card${takeable || swappable ? '' : ' locked'}${id === 'resupply' ? ' resupply' : ''}${id === 'lifeboat' ? ' v3-lifeboat' : ''}${swappable ? ' swappable' : ''}${chosen ? ' chosen' : ''}${toMax && !swappable ? ' to-max' : ''}`, () => {
        // Ignore taps that land as the cards appear: the player may still be
        // firing at the wave's last threat.
        if (swapping || freeing || this.picking || performance.now() - this.draftShownAt < DRAFT_ARM_MS) return;
        // A Test Lab Watch run: the bot's pick while it has the controls.
        if (this.labWatch && this.control === 'bot') return;
        if (takeable) {
          // The pick lands with a beat: the card flashes gold, then the wave starts.
          this.picking = true;
          card.classList.add('taken');
          this.audio.ui(toMax ? 'card.max' : 'card.pick');
          const wave = g.wave;
          setTimeout(() => {
            this.picking = false;
            if (this.game === g && g.phase === 'draft' && g.wave === wave) this.rec?.pick(id);
          }, PICK_BEAT_MS);
        } else if (swappable && !isSpecialCard(id)) {
          this.audio.ui('card.swap');
          this.showDraft(g, id);
          this.overlay.querySelector<HTMLElement>('.v2-draft')?.setAttribute('data-armed', '1');
        }
      });
      card.style.setProperty('--deal', `${i * DEAL_STAGGER_MS * this.dealScale()}ms`);
      card.disabled = (!takeable && !swappable) || (!!swapping && !chosen) || freeing;
      card.dataset.upgrade = id;
      card.dataset.sfx = 'card';
      card.style.setProperty('--card-color', ICON_COLOR[id]);
      const top = el('span', 'v2-card-top', '');
      top.append(
        el('span', 'v2-card-answers', id === 'resupply' ? 'Repairs' : id === 'lifeboat' ? 'Lifeboats' : `vs ${ABILITIES[id].answers}`),
        el('span', `v2-badge ${badge === 'SWAP IN' ? 'swap' : badge === 'NEW' ? 'new' : badge === 'MAXED' ? 'off' : badge === 'MAX' ? 'max' : badge === '+1 LIFE' ? 'life' : 'up'}`, badge),
      );
      const art = el('span', 'v2-card-art', '');
      art.innerHTML = cardArtSvg(id);
      // A weapon this chapter adds to the draft says so on its card: a band
      // across the card's top edge (the 2026-11-20 playtest: "on top of the
      // card and not overlapped on the middle of card").
      const chapter = chapterOf(g.map.id);
      const debut = !special && !g.freePlay && newInChapter(chapter).includes(id) ? el('span', 'v3-card-debut', newOnTag(chapter)) : null;
      if (debut) card.dataset.debut = String(chapter);
      // The Test Lab (round 8: "I didn't see the grapple upgrade"): the
      // weapon under test is the first card, and says so.
      if (!special && g.lab?.weapon === id) {
        card.dataset.testing = '1';
        art.append(el('span', 'v3-card-testing', 'TESTING'));
      }
      const level = el('span', 'v2-card-level', '');
      let text: string;
      if (id === 'resupply') {
        text = RESUPPLY_TEXT;
      } else if (id === 'lifeboat') {
        // Lifeboats (Armory, level 3+): the lives left now and after.
        const left = Math.max(0, Math.ceil(lossLimit(g) - shipsSunk(g)));
        level.append(el('span', '', `${left} → ${left + 1} lives`));
        text = LIFEBOAT_TEXT;
      } else {
        // One pip per level: those already held, the one this card adds, the rest.
        for (let k = 1; k <= ABILITY_MAX; k++) level.append(el('i', k <= lvl ? 'had' : k === next ? 'gain' : ''));
        level.append(el('span', '', maxed ? 'MAX' : `LV ${next}/${ABILITY_MAX}`));
        text = ABILITIES[id].levels[Math.min(lvl, ABILITY_MAX - 1)];
      }
      const name = cardName(id, next);
      // Only what is particular to this card (round 5: every card said "drops
      // as a pickup, 15 s in the gun", which is how every weapon works).
      // A number keeps its unit on the same line ("1.5 s", not "1.5 / s").
      card.append(...(debut ? [debut] : []), top, art, el('strong', 'v2-card-name', name), level, el('span', 'v2-card-text', text.replace(/(\d) s\b/g, '$1\u00a0s')));
      return card;
    });
    const row = el('div', 'v2-card-row');
    row.append(...cards);
    let rule: HTMLElement | null = null;
    if (swapping) {
      rule = el('p', 'v2-sub v2-swap-prompt', `Swap in ${ABILITIES[swapping].name}: tap the one it replaces, above (its levels are lost).`);
      rule.append(button('Cancel', 'v2-btn v3-cancel', () => {
        this.showDraft(g);
        this.overlay.querySelector<HTMLElement>('.v2-draft')?.setAttribute('data-armed', '1');
      }));
    } else if (freeing) {
      rule = el('p', 'v2-sub v2-swap-prompt v3-free-prompt', 'Free level-up: tap a weapon above to give it a level. Your pick stays.');
      rule.append(button('Cancel', 'v2-btn v3-cancel', () => {
        this.showDraft(g);
        this.overlay.querySelector<HTMLElement>('.v2-draft')?.setAttribute('data-armed', '1');
      }));
    } else if (full) {
      // A line only when the hand changes the choice (round 5: with slots
      // free it repeated the drop rule, the slot chips and the pips). Round 1:
      // with all three at max it must not offer a level-up.
      const allMax = owned.every((id) => (g.levels[id] ?? 0) >= ABILITY_MAX);
      rule = el('p', 'v2-sub', allMax ? 'All three at max: swap one out, or Resupply.' : 'Slots full: level one up, or swap a new one in.');
    }
    // Dev stride: the waves it skips each still deal a card.
    const skipped = g.history[g.history.length - 1]?.wave !== g.wave;
    const title = skipped ? `Wave ${g.wave} skipped` : `Wave ${g.wave} cleared`;
    const more = g.draftsLeft > 1 ? [el('p', 'v2-sub v2-dev-more', `Dev: ${g.draftsLeft} cards to pick before the next wave.`)] : [];
    const head = el('div', 'v2-draft-head');
    head.append(el('span', 'v2-draft-eyebrow', title), el('h2', '', swapping ? 'Choose what it replaces' : freeing ? 'Choose a weapon to level' : 'Choose your weapon'));
    // A test's full map run (round 10) has a draft after every wave, and
    // Done works then too: in the draft's own header (pause-menu round; the
    // bar it was on is gone).
    if (this.labRun && g.lab) {
      const done = labDoneButton(() => this.showLabVerdict('done'), g.lab.waves, labWaves(g.lab));
      done.classList.add('v3-draft-done');
      head.append(done);
    }
    // A Test Lab Watch run: take the pick (or hand it back) from here.
    if (this.labWatch && this.bot && !this.playback) {
      const bot = this.control === 'bot';
      const swap = button(bot ? 'Take over' : 'Let bot play', `v2-btn v3-draft-watch${bot ? ' bot' : ''}`, () => this.setControl(bot ? 'you' : 'bot'));
      swap.dataset.watchSwap = bot ? 'you' : 'bot';
      head.append(swap);
    }
    // Quartermaster (Armory): deal the hand again, a few times a run. Only
    // on a run that has it; greyed once they are spent.
    if (g.stats.rerolls > 0 && !swapping) {
      const left = g.rerolls;
      const watching = !!this.bot && this.control === 'bot';
      const reroll = button('', 'v2-btn v3-reroll', () => {
        if (this.picking || g.phase !== 'draft' || !this.rec?.reroll()) return;
        this.audio.ui('card.swap');
        this.showDraft(g);
        this.armDraft();
      });
      reroll.innerHTML = `${chromeSvg('refresh', 14)}<b>Re-roll</b><span>${left ? `${left} left` : 'none left'}</span>`;
      reroll.dataset.reroll = String(left);
      reroll.disabled = !left || watching || !!this.playback;
      reroll.setAttribute('aria-label', left ? `Re-roll the cards: ${left} re-roll${left === 1 ? '' : 's'} left this run` : 'No re-rolls left this run');
      head.append(reroll);
    }
    // Quartermaster 5: once a run, a held weapon takes a free level here.
    if (g.stats.freeLevels > 0 && !swapping) {
      const left = g.freeLevelsLeft;
      const watching = !!this.bot && this.control === 'bot';
      const can = owned.some((id) => (g.levels[id] ?? 0) > 0 && (g.levels[id] ?? 0) < ABILITY_MAX);
      const free = button('', `v2-btn v3-free-level${freeing ? ' on' : ''}`, () => {
        if (this.picking || g.phase !== 'draft') return;
        this.audio.ui('card.swap');
        this.showDraft(g, null, !freeing);
        this.overlay.querySelector<HTMLElement>('.v2-draft')?.setAttribute('data-armed', '1');
      });
      free.innerHTML = `<b>Free level-up</b><span>${left ? 'once a run' : 'used'}</span>`;
      free.dataset.freeLevel = String(left);
      free.disabled = !left || !can || watching || !!this.playback;
      free.setAttribute('aria-label', left ? (can ? 'Free level-up: give a held weapon a level without spending your pick' : 'Free level-up: hold a weapon below MAX to use it') : 'The free level-up is used this run');
      head.append(free);
    }
    const loadoutRow = el('div', 'v2-loadout');
    loadoutRow.append(el('span', 'v2-loadout-label', 'WEAPONS'), slots);
    // "Rate the wave you just played" (docs/design/v3-rate-and-review.md) is
    // its own screen before this one now (openWaveRate).
    this.showOverlay('v2-draft', [head, ...more, row, loadoutRow, ...(rule ? [rule] : [])]);
    this.overlay.querySelector<HTMLElement>('.v2-panel')?.style.setProperty('--deal-k', String(this.dealScale()));
  }

  /** The optional rating of the wave just played (its own screen before
   *  the draft, openWaveRate): only for a run
   *  the player is playing (not a replay, not the bot's turn at the
   *  controls, not a wave a dev stride skipped), with playtest notes on.
   *  Campaign, Free Play and the Test Lab alike. */
  private waveRateEl(g: Game, skipped: boolean): HTMLElement | null {
    const rec = this.rec;
    if (!this.notesOn || !rec || rec.game !== g || skipped || this.playback || (this.bot && this.control === 'bot')) return null;
    const wave = g.wave;
    const had = rec.waveRating(wave);
    return waveRateRow(wave, { rating: had?.rating, note: had?.note }, (r, note) => {
      if (this.game === g && g.phase === 'draft' && g.wave === wave) rec.rateWave(wave, r, note);
    });
  }

  private showResult(g: Game, won: boolean): void {
    // Dev and Free Play runs never touch the real records, unlocks or cards.
    const free = this.free;
    const wavesCleared = g.history.filter((h) => h.outcome === 'cleared').length;
    // Scrap: the map's waves and boss rounds cleared, won or lost; a cleared
    // map that went on into endless banked them at its win.
    const tally = scrapTally(g.history, RULES.wavesToClear, lastWave(g));
    const paid = this.banked.has(g);
    const res = this.dev || free ? null : recordResult(this.progress, g.map.id, { score: g.score, wave: g.wave, cleared: g.cleared, wavesCleared, ...tally, paid, salvage: armoryLevel(g.armory, 'salvage') });
    if (res) this.banked.add(g);
    if (res) {
      submitBest(g.map.id, g.score);
      for (const a of earned(this.progress, g.endless ? g.wave : 0)) unlock(a);
    }
    const rec = this.rec;
    const log = this.endRun(won ? 'won' : 'lost');
    this.review = { g, won, res, best: res?.best ?? false, log, ghosted: false, rec };
    this.renderResult();
  }

  /** The result screen, from the run kept in `review` (shown again after
   *  the review or a replay, without recording the result twice). */
  private renderResult(): void {
    const view = this.review;
    if (!view) return;
    const { g, won, res, best, log, rec } = view;
    const free = this.free;
    const idx = MAP_ORDER.indexOf(g.map.id);
    const next = MAP_ORDER[idx + 1];
    const stats = el('div', 'v2-stats');
    stats.innerHTML =
      `<span><b>${g.score.toLocaleString()}</b>score${best ? ' · new best!' : ''}</span>` +
      `<span><b>${g.delivered}</b>ships through</span>` +
      `<span><b>${g.lost}</b>ships sunk${g.extraLives ? ` · ${g.extraLives} extra ${g.extraLives === 1 ? 'life' : 'lives'}` : ''}</span>` +
      `<span><b>${Object.values(g.kills).reduce((a, b) => a + b, 0)}</b>shot down</span>` +
      // The run's Scrap (the Armory overhaul), banked win or lose.
      (res ? `<span class="v3-scrap-stat" data-scrap="${res.scrap.total}"><b>+${res.scrap.total.toLocaleString()}</b>scrap</span>` : '');
    // The Armory cards this run found, at random, shown as cards, and the
    // Scrap line by line.
    const won_ = res ? this.wonCards(res.cards, res.firstClear, res.scrap) : null;
    const buttons: HTMLElement[] = [];
    if (free) {
      buttons.push(button('Play it again', 'v2-btn primary', () => this.play(g.map.id, free)));
      buttons.push(button('Change setup', 'v2-btn', () => this.showFreePlay()));
    } else if (won) {
      // Short labels: five buttons fit one row on a small phone (playthrough
      // round: they wrapped and Menu fell off the bottom).
      buttons.push(button('Endless mode', 'v2-btn', () => this.rec?.endless()));
      if (next) buttons.push(button(`Next: ${MAPS[next].name}`, 'v2-btn primary', () => this.prepare(next)));
    } else {
      if (this.dev && rec) buttons.push(button(`Retry wave ${g.wave}`, 'v2-btn primary v2-dev-retry', () => this.retryWave(rec)));
      buttons.push(button(this.bot ? 'Watch a new run' : 'Try again', `v2-btn${this.dev ? '' : ' primary'}`, () => this.prepare(g.map.id, false)));
    }
    if (res) buttons.push(button('⚓ Armory', `v2-btn${res.cards.some((c) => !c.dup) || this.canLevel() ? ' v3-can-buy' : ''}`, () => this.showArmory()));
    if (this.notesOn && log) {
      const rated = !!log.rating;
      buttons.push(button(rated ? '📝 Review ✓' : '📝 Review', `v2-btn v3-review-btn${rated ? '' : ' fresh'}`, () => this.showReview()));
    }
    buttons.push(button('Menu', 'v2-btn', () => this.showMenu()));
    const reason = g.carrierHp <= 0 ? 'The carrier went down.' : `${g.lost} ships sunk. ${culprit(g)}`;
    const title = won
      ? `${g.map.name} cleared!`
      : g.endless
        ? `Endless run over: wave ${g.wave}`
        : `Convoy lost on ${waveName(g.wave)}`;
    const sub = free ? `Free play · ${won ? 'cleared' : reason}` : won ? (next ? `${MAPS[next].name} unlocked.` : 'Every map cleared.') : reason;
    const row = el('div', 'v2-btn-row');
    row.append(...buttons);
    // The special events and how they went: a bonus event, and each run of
    // the map's (round 7: three runs, and the worst of them as the whole).
    const met = g.eventLog.filter((e) => e.outcome !== 'rerun');
    const evLine = met.length ? el('p', 'v3-result-event') : null;
    if (evLine) {
      evLine.dataset.resultEvent = met.map((e) => `${e.id}:${e.outcome}`).join(' ');
      for (const e of met) {
        const o = e.outcome as EventOutcome;
        const chip = el('span', `v3-result-event-chip ${o}`);
        const label = e.kind === 'bonus' ? 'Bonus event' : e.runs ? bossRound(e.run!, e.runs) : 'Special event';
        chip.append(el('i', '', label), el('b', '', e.kind === 'bonus' ? EVENTS[e.id].name : eventName(e.id, g.map.id, g.enc?.setup.rev)), el('em', '', OUTCOME_NAME[o]), ...(e.bonus ? [el('small', '', `+${e.bonus.toLocaleString()}`)] : []));
        evLine.append(chip);
      }
      const whole = endingOutcome(g);
      if (whole) {
        evLine.dataset.resultEnding = whole;
        const chip = el('span', `v3-result-event-chip ending ${whole}`);
        chip.append(el('i', '', 'Boss rounds'), el('b', '', 'Worst round'), el('em', '', OUTCOME_NAME[whole]));
        evLine.append(chip);
      }
    }
    // Dev ghost check: how bot-you does on this same seed, for any run you
    // played some of (a run the bot played alone needs no comparing).
    const ghost = !view.ghosted && this.dev && !free && log && !g.endless && !(log.dev?.watch && !log.commands.some((c) => c[1] === 'c'));
    const ghostLine = el('div', 'v2-ghost');
    this.showOverlay('v2-result', [el('h2', '', title), el('p', 'v2-sub', sub), stats, ...(evLine ? [evLine] : []), ...(won_ ? [won_] : []), ...(ghost ? [ghostLine] : []), row, ...(STORE ? [] : [el('p', 'v2-log-status', 'Saving playtest log…')])]);
    if (ghost && log) {
      view.ghosted = true;
      this.startGhost(g, log, ghostLine);
    }
    if (!STORE && log && this.logState) void logChannel().then((c) => this.renderLogStatus(log, c));
  }

  /** The run on a review screen (the normal game's, and since scorecard
   *  revision 4 the Test Lab's end screen): the timeline (each wave's draft
   *  rating on its band), its legend, and the selected stop with ‹ ›,
   *  Watch it and Note on this. With no stop picked yet (`selected` < 0) it
   *  starts on the worst moment: the first burst, else the last loss. */
  private reviewRun(log: PlayLog, selected: number, go: { pick: (i: number) => void; watch: (step: number, i: number) => void; note: (i: number, moment?: number) => void }): HTMLElement[] {
    const stops = runStops(log);
    if (selected < 0 || selected >= stops.length) {
      const burst = stops.findIndex((s) => s.kind === 'burst');
      const sunk = stops.map((s) => s.kind).lastIndexOf('sunk');
      selected = burst >= 0 ? burst : sunk >= 0 ? sunk : stops.length - 1;
    }
    const stop = stops[selected];
    const detail = el('div', 'v3-stop');
    if (stop) {
      const look = stop.kind === 'note' ? { icon: '📝', label: 'Your note', color: 'var(--gold)' } : MOMENT_LOOK[stop.kind];
      const head = el('div', 'v3-stop-head');
      const icon = el('span', 'v3-stop-icon', look.icon);
      icon.style.color = look.color;
      head.append(
        button('‹', 'v2-btn v3-stop-step', () => go.pick(Math.max(0, selected - 1))),
        icon,
        el('span', 'v3-stop-text', `${stopWhen(stop)} · ${stop.text}`),
        el('span', 'v3-stop-count', `${selected + 1}/${stops.length}`),
        button('›', 'v2-btn v3-stop-step', () => go.pick(Math.min(stops.length - 1, selected + 1))),
      );
      const acts = el('div', 'v2-btn-row');
      if (log.commands.length && !log.notesOnly) acts.append(button('▶ Watch it', 'v2-btn v3-watch-btn', () => go.watch(stop.step, selected)));
      acts.append(button('📝 Note on this', 'v2-btn v3-stop-note', () => go.note(selected, stop.moment)));
      detail.append(head, acts);
    } else detail.append(el('p', 'v2-sub', 'Nothing was marked this run: no ships lost, no carrier hits.'));
    const strip = timeline(log, stops, selected, (i) => go.pick(i));
    const legend = el('div', 'v3-tl-legend');
    for (const k of ['sunk', 'burst', 'carrier', 'dry', 'debut'] as const) {
      const item = el('span', '', `${MOMENT_LOOK[k].icon} ${MOMENT_LOOK[k].label}`);
      item.style.color = MOMENT_LOOK[k].color;
      legend.append(item);
    }
    if (log.waveRatings?.length) {
      const item = el('span', 'v3-tl-legend-rate', '♥n your fun rating of the wave');
      item.style.color = 'var(--gold)';
      legend.append(item);
    }
    return [strip, legend, detail];
  }

  /** The run's review: rate the whole run, then step through its marked
   *  moments (and your notes) on a timeline, note any of them, or watch one
   *  play back. */
  private showReview(selected = -1): void {
    const view = this.review;
    const log = view?.log;
    if (!view || !log) return;
    // The whole run: the three axes and how hard the player tried.
    const rows = ratingRows(log.rating, RUN_RATING_AXES);
    const save = () => {
      if (rows.any()) log.rating = rows.value();
      this.resendReview();
    };
    const run = this.reviewRun(log, selected, {
      pick: (i) => {
        save();
        this.showReview(i);
      },
      watch: (step, i) => {
        save();
        this.startPlayback(step, i);
      },
      note: (i, moment) => {
        save();
        this.reviewNote(i, moment);
      },
    });
    const foot = el('div', 'v2-btn-row');
    foot.append(
      button('📝 Note on the run', 'v2-btn', () => {
        save();
        this.reviewNote(selected);
      }),
      button('Done', 'v2-btn primary v3-review-done', () => {
        save();
        this.renderResult();
      }),
    );
    this.showOverlay('v3-review', [el('h2', '', 'Rate & review this run'), rows.el, ...run, foot]);
  }

  /** A note made on the review: about a marked moment, or the run. */
  private reviewNote(selected: number, moment?: number): void {
    const view = this.review;
    const log = view?.log;
    if (!view || !log) return;
    const m = moment !== undefined ? log.moments?.[moment] : undefined;
    const form = noteForm();
    this.showOverlay('v3-note', [
      el('h2', '', m ? `📝 ${stopWhen(m)}` : '📝 Note on this run'),
      el('p', 'v2-sub', m ? m.text : `${view.won ? 'Cleared' : `Lost on ${waveName(view.g.wave)}`} · ${view.g.lost} ships sunk`),
      form.el,
      this.dialogButtons('Save note', () => {
        if (form.empty()) return;
        const note: PlayNote = {
          step: m?.step ?? view.g.steps,
          at: new Date().toISOString(),
          where: 'review',
          ...form.value(),
          ...(moment !== undefined ? { moment } : {}),
          ctx: noteContext(view.g),
        };
        (log.notes ??= []).push(note);
        this.resendReview(note);
        this.showReview(selected);
      }, () => this.showReview(selected)),
    ]);
  }

  /** The sealed log changed on the review (a rating, a note): send it again.
   *  A cleared map's run is still live for endless, so the recorder gets
   *  the same note, or its next save would drop it. */
  private resendReview(note?: PlayNote): void {
    const log = this.review?.log;
    if (!log) return;
    if (this.rec && this.rec.log.id === log.id) {
      if (note) (this.rec.log.notes ??= []).push(note);
      if (log.rating) this.rec.log.rating = log.rating;
    }
    void storeLog(log);
  }

  /** "Watch it": the run plays back from a few seconds before a moment to
   *  just after it, inputs and all. */
  private startPlayback(step: number, stop: number, other?: { log: PlayLog; after: () => void }, lab?: { g: Game; ended: 'done' | 'length' | 'lost' }): void {
    const log = other?.log ?? (lab ? this.rec?.snapshot() : this.review?.log);
    if (!log) return;
    const from = Math.max(0, step - PLAYBACK_BEFORE * 60);
    let pb: Playback;
    try {
      pb = new Playback(log, from);
    } catch {
      return;
    }
    this.resetFinale();
    this.ghostRun = null;
    pb.game.events = [];
    this.playback = { pb, until: step + PLAYBACK_AFTER * 60 + (other ? 4 * 60 : 0), from, stop, ...(other ? { after: other.after } : {}), ...(lab ? { lab } : {}) };
    this.game = pb.game;
    this.lastPhase = pb.game.phase;
    this.acc = 0;
    this.paused = false;
    this.ripples = [];
    this.root.classList.add('playing', 'replaying');
    this.syncConvoy();
    this.hideOverlay();
    this.pauseBtn.textContent = '■';
    this.showBanner('REPLAY', `${stopWhen(pb.game)}: the moment is ${Math.round((step - from) / 60)} s in. Tap ■ on the right to stop.`, { now: true, kind: 'ack', icon: 'play' });
  }

  /** Per frame while a replay runs: real time at 1×. */
  private runPlayback(real: number): void {
    const p = this.playback!;
    this.acc += real;
    let n = 0;
    while (this.acc >= DT && n < 12) {
      this.acc -= DT;
      n++;
      if (p.pb.game.steps >= p.until || !p.pb.advance()) {
        this.endPlayback();
        return;
      }
    }
  }

  private endPlayback(): void {
    const p = this.playback;
    const view = this.review;
    if (!p) return;
    this.playback = null;
    this.pauseBtn.textContent = 'II';
    this.root.classList.remove('replaying');
    this.alerts.clear();
    // A replay opened from the Map Analytics screen goes back to it.
    if (p.after) {
      this.game = null;
      this.paused = false;
      this.root.classList.remove('playing');
      p.after();
      return;
    }
    // A test's end screen: back to the paused test and its sheet.
    if (p.lab) {
      this.game = p.lab.g;
      this.lastPhase = p.lab.g.phase;
      this.syncConvoy();
      this.showLabVerdict(p.lab.ended, p.stop);
      return;
    }
    if (view) {
      this.game = view.g;
      this.lastPhase = view.g.phase;
    }
    this.paused = false;
    this.showReview(p.stop);
  }

  /** Play bot-you on this run's seed between frames (a few ms at a time, so
   *  the screen never stalls), then show both results and where they split.
   *  The result goes into the log too. */
  private startGhost(g: Game, log: PlayLog, line: HTMLElement): void {
    const run = new BotRun(log.map, log.seed, { firstWave: log.firstWave, tempo: log.tempo, armory: log.armory });
    this.ghostRun = run;
    line.textContent = 'Bot-you is playing this seed…';
    const tick = () => {
      if (this.ghostRun !== run) return;
      const t0 = performance.now();
      while (!run.done && performance.now() - t0 < 4) run.advance(10);
      if (!run.done) {
        line.textContent = `Bot-you is playing this seed… wave ${run.game.wave}`;
        setTimeout(tick, 0);
        return;
      }
      this.ghostRun = null;
      const res = run.result();
      log.ghost = res;
      void storeLog(log);
      const verdict = (cleared: boolean, wave: number, lost: number) => `${cleared ? 'cleared' : `lost on wave ${wave}`} · ${lost} sunk`;
      const mine = lostByWave(g);
      let split = 'Same losses, wave for wave.';
      for (let w = 0; w < Math.max(mine.length, res.lostByWave.length); w++) {
        const a = mine[w] ?? -1;
        const b = res.lostByWave[w] ?? -1;
        if (a < 0 || b < 0 || a === b) continue;
        split = a > b ? `You fell behind on wave ${w + 1} (you ${a} sunk by then, bot ${b}).` : `You pulled ahead on wave ${w + 1} (you ${a} sunk by then, bot ${b}).`;
        break;
      }
      const you = (g.cleared ? 100 : g.wave) * 10 - g.lost;
      const bot = (res.cleared ? 100 : res.wave) * 10 - res.lost;
      const head = you > bot ? 'You beat bot-you on this seed' : you < bot ? 'Bot-you did better on this seed' : 'Dead even with bot-you';
      line.replaceChildren(
        el('strong', '', head),
        el('span', '', `You: ${verdict(g.cleared, g.wave, g.lost)} — Bot-you: ${verdict(res.cleared, res.wave, res.lost)}`),
        el('span', '', split),
      );
      line.classList.add('done');
    };
    setTimeout(tick, 0);
  }

  private renderLogStatus(log: import('../sim/playlog').PlayLog, channel: Channel): void {
    // Playtest logs only: compiled out of the store build.
    if (!STORE) {
      const line = this.overlay.querySelector('.v2-log-status');
      if (!line) return;
      if (this.logState === 'sent') {
        line.textContent = 'Playtest log sent to Claude ✓';
        return;
      }
      if (this.logState === 'failed') {
        // The log is resent on next launch. Inside the artifact downloads are
        // blocked, so only the Vercel build offers one meanwhile.
        line.textContent = 'Log kept on this device; it will be sent to Claude next time you open the game. ';
        if (channel === 'server') line.append(button('Download log', 'v2-link', () => downloadLog(log)));
        return;
      }
      const tel = this.lastTel;
      line.replaceChildren(
        el('span', '', 'Log saved on this device. '),
        button('Download log', 'v2-link', () => downloadLog(log)),
        // A Test Lab or dev run: its Map & Convoy Lab telemetry too.
        ...(tel ? [el('span', '', ' '), button('Download telemetry', 'v2-link', () => downloadTelemetry(tel))] : []),
      );
    }
  }

  private showOverlay(cls: string, children: HTMLElement[]): void {
    const panel = el('div', `v2-panel ${cls}`);
    const screen = cls.replace(/^v[23]-/, '');
    // A redraw of the screen already up (a tab, an equip) doesn't replay
    // its entrance.
    if (this.overlay.classList.contains('open') && this.overlay.dataset.screen === screen) panel.classList.add('v3-same');
    panel.append(...children);
    this.leaveTyping();
    this.overlay.replaceChildren(panel);
    this.overlay.classList.add('open');
    // A dialog with a text box can be used with the phone held upright too
    // (the player: "give feedback with my phone up"): no "turn your phone"
    // notice over it.
    this.root.classList.toggle('noting', !!panel.querySelector('textarea, .v3-enc-script, .v3-wave-rate-text'));
    this.overlay.dataset.screen = screen;
    // A panel taller than the screen scrolls under its header: only then
    // does the header need a backing of its own.
    if (panel.querySelector(':scope > .v3-head')) panel.classList.toggle('scrolls', panel.scrollHeight > panel.clientHeight + 2);
  }

  /** The part of the screen the keyboard leaves visible, for the dialog
   *  being typed in: where it is (iOS may have panned the page under the
   *  keyboard: offsetTop), its size, and whether it is wide (a phone held
   *  sideways: the buttons go beside the box, not under it). */
  private fitTyping(): void {
    const vv = window.visualViewport;
    const w = vv?.width ?? window.innerWidth;
    // The in-app keyboard (keys.ts) isn't the phone's: the page is not
    // resized for it. It sits on the layout viewport's bottom edge, so what
    // is left to type in is the visible part of the screen above its top
    // edge (the Tools round: measured against the keyboard's top, not by
    // taking its height off the visible height, so a panned or shrunk view
    // never puts the box or its buttons under it).
    const kb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kb-h')) || 0;
    const top = vv?.offsetTop ?? 0;
    const bottom = Math.min(top + (vv?.height ?? window.innerHeight), kb > 0 ? window.innerHeight - kb : Infinity);
    const h = Math.max(0, bottom - top);
    this.root.style.setProperty('--vv-top', `${Math.round(top)}px`);
    this.root.style.setProperty('--vv-left', `${Math.round(vv?.offsetLeft ?? 0)}px`);
    this.root.style.setProperty('--vv-w', `${Math.round(w)}px`);
    this.root.style.setProperty('--vv-h', `${Math.round(h)}px`);
    this.root.classList.toggle('typing-wide', w > h * 1.3);
  }

  /** Typing in a dialog (Test Lab round 4: "I still can't see the text box
   *  all that great when writing feedback, both horizontal and vertical"):
   *  the dialog becomes the text box, big and bright, pinned to the top of
   *  what the keyboard leaves visible, with its buttons beside it (held
   *  sideways) or under it (upright), and the few controls it can't do
   *  without (the verdict sheet's Keep / Tune / Cut: `data-typing-keep`).
   *  Everything else is folded away until the keyboard goes. */
  private enterTyping(box: HTMLTextAreaElement | HTMLInputElement): void {
    const panel = this.overlay.querySelector('.v2-panel');
    if (!panel) return;
    this.leaveTyping();
    const ACTS = '.v2-btn-row, .v3-lab-sheet-acts, .v3-rate-actions';
    const KEEP = '[data-typing-keep]';
    const keep = new Set<Element>();
    const mark = (e: Element | null) => {
      for (; e && e !== this.overlay; e = e.parentElement) keep.add(e);
    };
    mark(box);
    panel.querySelectorAll(ACTS).forEach(mark);
    panel.querySelectorAll(KEEP).forEach(mark);
    for (const k of keep) {
      if (!panel.contains(k) || k === panel) continue;
      // The box, the button rows and the kept controls are laid out on the
      // panel's own grid (style.css); what holds them steps aside.
      if (k === box) k.classList.add('typing-box');
      else if (k.matches(ACTS)) k.classList.add('typing-acts');
      else if (k.matches(KEEP)) k.classList.add('typing-keep');
      else k.classList.add('typing-flat');
    }
    for (const k of keep) {
      if (k.matches(ACTS) || k.matches(KEEP) || k === box) continue;
      for (const c of Array.from(k.children)) if (!keep.has(c)) c.classList.add('typing-hide');
    }
    this.root.classList.add('typing');
    this.fitTyping();
    // Where the browser doesn't pan the box into view itself (an iPhone
    // home-screen app), bring it in once the keyboard is up.
    setTimeout(() => {
      if (document.activeElement === box) box.scrollIntoView({ block: 'nearest' });
    }, 350);
  }

  private leaveTyping(): void {
    this.root.classList.remove('typing', 'typing-wide');
    for (const cls of ['typing-hide', 'typing-box', 'typing-acts', 'typing-keep', 'typing-flat']) {
      this.overlay.querySelectorAll(`.${cls}`).forEach((e) => e.classList.remove(cls));
    }
  }

  private hideOverlay(): void {
    this.leaveTyping();
    this.root.classList.remove('noting');
    this.overlay.classList.remove('open');
    this.overlay.replaceChildren();
    delete this.overlay.dataset.screen;
  }
}

/** A box a dialog is typed in: a text area, or a one-line text box (the
 *  wave rating's note, round 12). */
function typingBox(e: EventTarget | Element | null): e is HTMLTextAreaElement | HTMLInputElement {
  return e instanceof HTMLTextAreaElement || (e instanceof HTMLInputElement && e.type === 'text');
}

/** Round 4's new pickups get a one-line banner the first time one drops. */
const PICKUP_HINT: Partial<Record<PickupKind, [string, string]>> = {
  timewarp: ['PICKUP: Time Warp', 'Tap it: every threat slows to a crawl for a few seconds.'],
  shield: ['PICKUP: Shield', 'Tap it: the convoy and carrier shrug off every hit for a few seconds.'],
  steam: ['PICKUP: Full Steam', 'Tap it: the convoy races ahead for a few seconds.'],
  starshell: ['PICKUP: Star Shell', 'No longer dropped (the strait stays dark). A flare lit the whole strait for a few seconds.'],
  nuke: ['PICKUP: Nuke', 'Tap it: everything in the air and on the water is destroyed. Rare.'],
};

/** The first weapon drop's banner, with the run's seconds (Long Loads). */
function weaponHint(seconds: number): [string, string] {
  return ['WEAPON DROP', `Tap it: the gun fires that weapon for ${seconds} s. Each shot still uses a round.`];
}

const SUNK_BY: Partial<Record<ThreatKind, string>> = {
  drone: 'Drones did the most damage: Flak Cannon or Tesla Arc thin out swarms; Wide Warhead in the Armory helps.',
  ballistic: 'Ballistics did the most damage: shoot them early, Point Defense fires from every ship; in the Armory, Fast Motors or Armor Plating.',
  guided: 'Guided missiles did the most damage: a Gravity Well drags them off course; Seeker Pods spread over a volley; Deck Guns in the Armory pick off the ones near the carrier.',
  supersonic: 'Supersonics did the most damage: tap on the lock line; Point Defense lets the ship it is after fire back.',
  heavy: 'Heavy missiles did the most damage: the Railgun was made for them.',
  cluster: 'Cluster bomblets did the most damage: hit the missile before it splits; Flak or Seeker Pods clear the bomblets.',
  mothership: 'Mothership drones did the most damage: take the mothership down first (Railgun).',
  strafer: 'Strafing runs did the most damage: Air Strike the jet; frigates shoot jets down too.',
  bomber: 'Bomber missiles did the most damage: shoot bombers down before they reach the convoy (Air Strike).',
  mine: 'Mines did the most damage: one shot clears a mine; Flak or Shrapnel clear a drift of them.',
  fastboat: 'The Coves\' boats did the most damage: watch the coves for a white wake; sink a gunboat before it is alongside; the rocket boat itself, not its rockets, is what can be stopped.',
  sprinter: 'Sprint drones did the most damage: hit them before the booster flares; Flak or the Laser Cutter take a swarm.',
  hydra: 'Hydra darts did the most damage: kill the Hydra far out, or with Flak or Tesla to catch both darts.',
  dart: 'Hydra darts did the most damage: kill the Hydra far out, or with Flak or Tesla to catch both darts.',
  rocketTruck: 'Rocket trucks did the most damage: kill the truck while its launcher raises; the Railgun and Lance reach it.',
  attackHeli: 'Helicopters did the most damage: five hits on the helicopter (the Railgun or Lance), or shoot its missile pairs.',
  torpedoSub: 'Torpedoes did the most damage: shoot the torpedoes on their dashed lines (the sub itself can\'t be hit).',
  armored: 'Armored drones did the most damage: shoot as they bank, or use blasts (Flak, Thermobaric) that go round the plate.',
  stealthJet: 'Stealth strafers did the most damage: Point Defense answers a jet you can\'t see coming.',
  stealthBomber: 'Stealth bombers did the most damage: six hits before it drops, or shoot its missiles.',
  diveBomber: 'Dive bombers did the most damage: shoot the plane in its moment, or move ships out of the red circle (Full Steam).',
  siege: 'The siege battery did the most damage: silence the gun (the Railgun reaches it), or move out of the orange circles.',
  cloud: 'Incendiary fire did the most damage: shoot the firebombs down far out, before they reach the lane.',
};

/** One line naming what sank the most ships, and what answers it. */
function culprit(g: Game): string {
  const top = (Object.keys(g.sunkBy) as ThreatKind[]).sort((a, b) => g.sunkBy[b] - g.sunkBy[a])[0];
  return g.sunkBy[top] > 0 ? (SUNK_BY[top] ?? '') : '';
}

/** A draft card's name at the level it brings. */
function cardName(id: CardId, level: number): string {
  return id === 'resupply' ? 'Resupply' : id === 'lifeboat' ? 'Lifeboat' : abilityName(id, Math.min(level, ABILITY_MAX));
}

/** Quartermaster's golden bomb: a round bomb, its fuse lit. */
const GOLD_BOMB_SVG =
  '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="14" cy="19" r="9" fill="currentColor"/><rect x="17" y="8" width="6" height="5" rx="1" transform="rotate(40 20 10.5)" fill="currentColor"/>' +
  '<path d="M22 8 Q25 4 28 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="28.5" cy="5.5" r="2.4" fill="#fff7cc"/><circle cx="11" cy="16" r="2.6" fill="#fff7cc" opacity="0.55"/></svg>';

/** Lifeboats' extra-life card (the Armory's Lifeboats 3+). */
const LIFEBOAT_TEXT = 'One more ship can be lost this run. Take it in place of a weapon.';

/** V3's speed control: one button that steps through the speeds (it used to
 *  be a full-height slider; the rail's lower half is the weapon loadout). */
function speedButton(steps: readonly number[], initial: number, onChange: (step: number) => void): StepSlider {
  let current = initial;
  const b = button('', 'v3-speed', () => {
    set((current + 1) % steps.length);
    onChange(current);
  });
  const set = (k: number) => {
    current = k;
    b.replaceChildren(el('b', '', `${steps[k]}×`), el('span', '', 'speed'));
    b.setAttribute('aria-label', `Game speed ${steps[k]}×. Tap for the next speed.`);
  };
  set(initial);
  return { el: b, set };
}

// ---------------------------------------------------------------------------
// Free Play (round 7): the setup on its screen, kept between visits.

/** What the screens need to put a saved run back (platform/runSave.ts):
 *  Free Play's form, a Test Lab card and its setup, the game speed. */
interface RunUI {
  free?: FreeSetup;
  lab?: { card: string; setup: LabRunSetup };
  speed?: number;
}

interface FreeSetup {
  map: MapId;
  wave: number;
  weapons: ({ id: AbilityId; level: number } | null)[];
  armory: Record<BayId, { id: ArmoryId; level: number } | null>;
  frequentDrops: boolean;
  /** The enemy build: which new enemies come. */
  enemies: FoeSetting;
}

const FREE_KEY = 'straitwatch.v3.freeplay';

/** The default: wave 7 on The Strait (late enough to test against, early
 *  enough to last), three of round 6's weapons, frequent drops. */
function loadFreeSetup(): FreeSetup {
  const base: FreeSetup = {
    map: 'strait',
    wave: 7,
    weapons: [
      { id: 'shrapnel', level: 1 },
      { id: 'frigate', level: 1 },
      { id: 'thermo', level: 1 },
    ],
    armory: { gun: null, hull: null, supply: null },
    frequentDrops: true,
    enemies: 'campaign',
  };
  try {
    const raw = JSON.parse(kv.getItem(FREE_KEY) ?? 'null') as Partial<FreeSetup> | null;
    if (!raw) return base;
    const level = (n: unknown, max: number) => Math.max(1, Math.min(max, Math.floor(Number(n) || 1)));
    return {
      map: MAP_ORDER.includes(raw.map as MapId) ? (raw.map as MapId) : base.map,
      wave: level(raw.wave, 10),
      weapons: [0, 1, 2].map((i) => {
        const w = raw.weapons?.[i];
        return w && ABILITY_ORDER.includes(w.id) ? { id: w.id, level: level(w.level, ABILITY_MAX) } : null;
      }),
      armory: Object.fromEntries(
        BAY_ORDER.map((b) => {
          const a = raw.armory?.[b];
          return [b, a && a.id in ARMORY && ARMORY[a.id].bay === b ? { id: a.id, level: level(a.level, ARMORY[a.id].max) } : null];
        }),
      ) as FreeSetup['armory'],
      frequentDrops: raw.frequentDrops ?? base.frequentDrops,
      enemies: foeSetting(raw.enemies),
    };
  } catch {
    return base;
  }
}

/** The maps Free Play offers: every map, or in the store build without the
 *  unlock, the free chapter's. */
function freeMaps(): MapId[] {
  return MAP_ORDER.filter((m) => chapterOwned(chapterOf(m)));
}

function saveFreeSetup(fp: FreeSetup): void {
  try {
    kv.setItem(FREE_KEY, JSON.stringify(fp));
  } catch {
    // storage unavailable: the setup lasts for the session
  }
}

/** The Armory a Free Play run takes: its picks, at their levels. */
function freeArmory(fp: FreeSetup): ArmoryLevels {
  const a: ArmoryLevels = {};
  for (const b of BAY_ORDER) {
    const x = fp.armory[b];
    if (x) a[x.id] = x.level;
  }
  return a;
}

/** What the sim (and the play log) needs from a Free Play setup. */
function freePlaySetup(fp: FreeSetup): FreePlaySetup {
  return { weapons: fp.weapons.filter((w): w is { id: AbilityId; level: number } => !!w), frequentDrops: fp.frequentDrops, enemies: fp.enemies };
}

/** The pause script's line for a wave with no encounter (round 12: a
 *  version can make it lighter or heavier than the shared wave). */
function quietText(scale: number): string {
  if (scale === 1) return 'No authored encounter this wave: the shared wave plays as it is.';
  return `No authored encounter this wave: the shared wave at ${Math.round(scale * 100)}% of its drones and missiles${scale < 1 ? ' (a quiet wave)' : ''}.`;
}
