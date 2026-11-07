// V3 app shell: menu → (armory) → game → (draft between waves) → result.
// Owns the frame loop, the two side rails, the weapon loadout and the HUD.
// The sim never sees the DOM; this file turns pointer input into `tap()`
// calls and draws whatever the sim holds.

import {
  CARRIER,
  DEFAULT_SPEED,
  DEV_SPEED_STEPS,
  FLOW_STEPS,
  RULES,
  SPEED_STEPS,
  TAP_RADIUS_PX,
  WATCH_SPEED_STEPS,
  THREATS,
  VIEW,
  type ThreatKind,
  type PickupKind,
} from '../data/config';
import { FORMATIONS, FORMATION_ORDER, type FormationId } from '../data/formations';
import { CHAPTERS, MAPS, MAP_ORDER, chapterOf, type MapId } from '../data/maps';
import {
  ABILITIES,
  ABILITY_MAX,
  ABILITY_ORDER,
  MAX_SLOTS,
  RESUPPLY_TEXT,
  SHORT_NAME,
  abilityName,
  canSwapIn,
  canTake,
  type AbilityId,
  type CardId,
} from '../data/abilities';
import { ARMORY, ARMORY_MAX, BAY_ORDER, BAYS, CARD_DROPS, armoryLevel, bayItems, type ArmoryId, type ArmoryLevels, type BayId } from '../data/armory';
import { equipArmory, isUnlocked, loadProgress, recordResult, runLoadout, type Progress } from '../platform/save';
import {
  applyFreePlay,
  createGame,
  held,
  raidWarning,
  warping,
  step,
  tracked,
  type FreePlaySetup,
  type Game,
  type Phase,
  type RaiderKind,
} from '../sim/game';
import { Alerts, type AlertOpts } from './alerts';
import { BotRun, Mimic, PERSONAS, PERSONA_ORDER, YOU, lostByWave, type BotIO } from '../sim/mimic';
import { LOG_GAME, LOG_VERSION, Playback, Recorder, replay, replayTo, type Controller, type PlayLog } from '../sim/playlog';
import { GESTURE_HINT, ROSTER, gestureOf, isBoost, isPrototype, newInChapter } from '../data/roster';
import { FOES, FOES_BUILT, foesInChapter, type FoeSetting } from '../data/foes';
import { foeSetting, launchFoe, newFoeState } from '../sim/foes';
import { noteContext, type PlayNote } from '../sim/feedback';
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
} from './notes';
import { downloadLog, flushUnsent, logChannel, storeLog, type Channel, type UploadState } from '../platform/playlogStore';
import { DEV_ARMORY, DEV_ORDER, DEV_PRESETS, devEnabled, firstPlayedWave, setDevEnabled, loadDevSettings, saveDevSettings, type DevArmory } from './dev';
import { armoryArtSvg, cardArtSvg } from './cardArt';
import { ICON_COLOR, upgradeIcon } from './icons';
import { stepSlider, type StepSlider } from './rail';
import { AudioEngine } from '../audio/engine';
import { CUE_IDS, LOOP_CUES, MUSIC_CUES, type CueId, type LoopCue, type MusicCue } from '../audio/cues';
import { SOUNDS } from '../audio/manifest';
import { activeLoops, battleMusic } from '../audio/state';
import { chromeSvg, MARK_SVG } from './chrome';
import { calm, mapThumb, quietGame, thumbNow } from './thumbs';
import { DRY_LIFE, IMPACT_LIFE, PICKUP_COLORS, RAID_LOOK, RIPPLE_LIFE, drawFrame, type Ripple } from './render';
import { clearAll, kv } from '../platform/store';
import { PRIVACY_URL, STORE, VERSION } from '../platform/flavor';
import { haptic, hapticForCue, hapticsAvailable, hapticsEnabled, setHapticsEnabled } from '../platform/haptics';
import { earned, gameCenterAvailable, showGameCenter, submitBest, unlock } from '../platform/gamecenter';
import { FREE_CHAPTERS, buyFullGame, chapterOwned, onEntitlementChange, ownsFullGame, purchasesAvailable, restoreFullGame, unlockPrice } from '../platform/unlock';

const DT = 1 / 60;
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
/** Focus: a touch of the holding finger shorter than this is a tap (fired on
 *  its lift); longer, it was a hold for slow motion. */
const FOCUS_TAP_MS = 220;
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
  tender: 'TENDER DOWN',
  picket: 'PICKET DOWN',
  barge: 'BARGE DOWN',
};
/** Cards deal in over DEAL_MS each, DEAL_STAGGER_MS apart (style.css). */
const DEAL_MS = 340;
const DEAL_STAGGER_MS = 70;
const RAIL_W = 72;
/** Margin kept on the landscape side WITHOUT the Dynamic Island (rounded corners only). */
const CORNER_INSET = 16;

/** Weapon feedback is about what the player just did (round 14's rule):
 *  shown at once, one card that each new message replaces. */
const WEAPON_NOTE: AlertOpts = { now: true, key: 'weapon' };

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
  fastboat: 'Out of a cove, watch for the white wake. It rams a ship. Two hits.',
  dreadnought: 'A battleship firing broadsides as it steams through. Fifty hits to sink it, or ride it out.',
  // The enemy build.
  sprinter: 'A swarm that flares a booster near its ship, then sprints in. Get them before the flare.',
  decoy: 'Half this swarm is fake. Up close the decoys strobe white: save your shots for the real ones.',
  hydra: 'Kill it and it splits into two darts. Kill it far out, or catch both with a blast.',
  rocketTruck: 'Its rockets can\'t be stopped. Kill the truck while the red ring fills (four hits).',
  loiter: 'They circle until a ship comes near, then all dive. Clear them while they wait.',
};

/** What each map's own system is, said once as the map starts (the 20-map
 *  plan: one new idea a map). */
/** One-time tips on the first map, by wave (see drainEvents). */
const FIRST_TIPS: Record<number, [string, string]> = {
  2: ['MORE SHIPS, MORE POINTS', 'Slide SHIPS (left) up: ships come faster and each scores more.'],
  3: ['FORMATIONS', 'Tap Pairs (top left) to sail in Column, Box or Spread. Each raid card says which helps.'],
};
const TIPS_KEY = 'straitwatch.v3.tips';

/** True the first time a tip is asked for on this device. */
function firstTime(id: string): boolean {
  try {
    const seen = JSON.parse(kv.getItem(TIPS_KEY) ?? '[]') as string[];
    if (seen.includes(id)) return false;
    kv.setItem(TIPS_KEY, JSON.stringify([...seen, id]));
    return true;
  } catch {
    return true;
  }
}

const MAP_HINT: Partial<Record<MapId, [string, string]>> = {
  kesh: ['THE HOOK', 'Ships turn north round the cape. Lead your shots round the bend.'],
  behemoth: ['SUPERTANKER', 'One a wave. Eight hits sink it, and it counts as three ships. Get it home.'],
  needle: ['SINGLE FILE', 'The convoy queues at the gap. Column formation needn\'t merge.'],
  saltgate: ['LOCK GATES', 'Ships wait in each chamber while it fills. Guard them.'],
  battery: ['SHORE BATTERY', 'Two allied guns fire on their own. A hit knocks one out for a while.'],
  sowers: ['MINES', 'Mines drift across the lane on the current. Clear them before a ship sails in.'],
  rigs: ['OIL RIGS', 'Rigs launch from the sea. Bring one down and it stays down.'],
  lantern: ['NIGHT', 'Threats show only as a glow until the beam finds them. Grab Star Shells.'],
  dreadnought: ['DREADNOUGHT PASS', 'On waves 3, 6, 9 and 10 a battleship steams through.'],
  coves: ['FAST BOATS', 'Boats burst out of the coves to ram the convoy.'],
  delta: ['THE FORK', 'Tap the buoy to send the next ships north, middle or south.'],
  crossing: ['TWO-WAY TRAFFIC', 'Outbound east up top, inbound west below. Both edges are a front.'],
  tide: ['THE TIDE', 'The flats lane is open only at high tide. Push ships through while it lasts.'],
  citadel: ['THE CITADEL', 'Destroy the three shield generators, then silence the Citadel.'],
};

/** Round 4: launchers that aren't targets — what they are, what to watch for. */
const VECTOR_HINT: Record<RaiderKind, [string, string]> = {
  sub: ['NEW: Submarine', 'Watch for the periscope: it surfaces and fires a salvo.'],
  popup: ['NEW: Missile truck', 'Drives to the shore, raises its launcher, fires, backs off.'],
  runner: ['NEW: Shore runner', 'Drives the whole coast road, stopping to fire.'],
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
  private leftRail = el('div', 'v2-rail v2-rail-left');
  private rightRail = el('div', 'v2-rail v2-rail-right');
  private formationPop = el('div', 'v2-formations');
  private formationBtn = button('', 'v2-formation-btn', () => this.toggleFormations());
  private pauseBtn = button('II', 'v2-pause', () => this.togglePause());
  /** Playtest notes: pause and say something about this moment; after a
   *  volley it offers to rate it (see openNote / openRate). */
  private noteBtn = button('', 'v3-note-btn', () => (this.rateable() ? this.openRate('rail') : this.openNote('rail')));
  private noteKey = '';
  /** Volleys finished when the note button last pulsed. */
  private volleysSeen = 0;
  private notesOn = !STORE && notesEnabled();
  /** The result screen's run, kept for its review (and a replay's way back). */
  private review: { g: Game; won: boolean; res: ReturnType<typeof recordResult> | null; best: boolean; log: PlayLog | null; ghosted: boolean; rec: Recorder | null } | null = null;
  /** "Watch it": a marked moment playing back, and where it stops. */
  private playback: { pb: Playback; until: number; from: number; stop: number } | null = null;
  /** Round 14: running power-ups count down here, in the rail, instead of
   *  in a corner of the battlefield (where they sat over roads and trucks). */
  private timers = el('div', 'v2-timers');
  private timersKey = '';
  /** Watch mode: who is playing; tap to take over or hand back. */
  private controlBtn = button('', 'v2-control', () => this.setControl(this.control === 'bot' ? 'you' : 'bot'));
  private flowSlider!: StepSlider;
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
  private devSettings = loadDevSettings();
  private speedSteps = this.dev ? DEV_SPEED_STEPS : SPEED_STEPS;
  /** Watch mode: the bot in this run, and who is at the controls. */
  private bot: Mimic | null = null;
  /** Dev ghost check in progress on the result screen. */
  private ghostRun: BotRun | null = null;
  private control: Controller = 'you';
  /** The wave whose draft is on screen (a dev stride deals several in a row). */
  private draftWave = -1;
  /** The Armory bay on show. */
  private armoryBay: BayId = 'gun';
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
    flow: (v) => {
      this.rec?.flow(v);
      this.flowSlider.set(v);
    },
    formation: (id) => {
      this.rec?.formation(id);
      this.syncFormation();
    },
    pace: (v) => this.rec?.pace(v),
  };
  private speed: number = SPEED_STEPS[DEFAULT_SPEED];
  private paused = false;
  /** Portrait while playing: the field would be a sliver, so time stops and a
   *  "turn sideways" notice shows until the phone is rotated back. */
  private portrait = false;
  /** This run has explained the radar tower (see radarHint). */
  private radarShown = false;
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
  private layoutKey = '';
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
  /** Focus (a boost): the finger whose press is slowing time. */
  private focusFinger: { id: number; x: number; y: number; at: number } | null = null;

  constructor(private root: HTMLElement) {
    root.classList.add('v2-root');
    root.classList.toggle('dev', this.dev);
    root.classList.toggle('notes', this.notesOn);
    root.append(this.canvas, this.dangerEdge, this.vignette, this.stamp, this.alerts.el, this.leftRail, this.rightRail, this.overlay, this.rotateNote, this.safeProbe);
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
    window.addEventListener('orientationchange', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
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
    this.resize();
  }

  /** Seal the current run's log and send it wherever this build can. Safe to
   *  call more than once (a cleared map that continues into endless updates
   *  the same log). */
  private endRun(end: 'won' | 'lost' | 'quit'): PlayLog | null {
    if (!this.rec) return null;
    const log = this.rec.finish(end);
    if (end !== 'won') this.rec = null;
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
    }
  }

  /** The app is going to the background (a call, the home gesture, the
   *  app switcher): pause a wave in progress and save the run so far. */
  background(): void {
    if (this.game?.phase === 'wave' && !this.paused && !this.playback) this.togglePause();
    // Mid-run: seal what there is as a quit (iOS rarely fires pagehide when
    // an app is swiped away, so this may be the last chance).
    if (this.rec && this.game && (this.game.phase === 'wave' || this.game.phase === 'draft') && !this.playback) void storeLog(this.rec.left());
  }

  start(): void {
    void flushUnsent();
    // Closing the tab mid-run still leaves a log.
    window.addEventListener('pagehide', () => {
      if (this.beat) this.finishBeat();
      if (this.game && (this.game.phase === 'wave' || this.game.phase === 'draft')) this.endRun('quit');
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
        if (g) launchFoe(g, { at: 0, kind, base }, g.map.bases[base]);
      },
      // Stop the clock with no pause menu over the frame (screenshots).
      freeze: (on: boolean) => {
        this.paused = on;
      },
      control: () => this.control,
      // The map behind the screens around a run, and how far it has sailed.
      backdrop: () => (this.backdrop ? { map: this.backdropId, steps: this.backdrop.steps } : null),
      log: () => this.rec?.snapshot() ?? null,
      // Re-run a log here, so a browser test can check a recorded run replays.
      replay: (log: PlayLog) => {
        const g = replay(log);
        return { steps: g.steps, score: g.score, lost: g.lost, wave: g.wave };
      },
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
    requestAnimationFrame((t) => this.frame(t));
  }

  // -------------------------------------------------------------------------
  // Rails

  private buildRails(): void {
    this.flowSlider = stepSlider(
      FLOW_STEPS.length,
      0,
      (s) => `×${FLOW_STEPS[s].mult}`,
      (s) => this.rec?.flow(s),
    );
    const flowHint = el('div', 'v2-rail-hint', 'more ships, more points');
    this.leftRail.append(
      this.formationBtn,
      el('div', 'v2-rail-label', 'SHIPS'),
      this.flowSlider.el,
      flowHint,
      this.noteBtn,
      this.timers,
    );
    for (const id of FORMATION_ORDER) {
      const f = FORMATIONS[id];
      const opt = button('', 'v2-formation-opt', () => {
        this.rec?.formation(id);
        this.formationPop.classList.remove('open');
        this.syncFormation();
      });
      opt.dataset.formation = id;
      const head = el('span', 'v2-formation-head', '');
      head.append(el('strong', '', f.name), el('em', 'v2-tag-good', f.tags[0]));
      if (f.tags[1] !== '—') head.append(el('em', 'v2-tag-bad', f.tags[1]));
      opt.append(formationGlyph(id), head, el('span', '', f.hint));
      this.formationPop.append(opt);
    }
    this.leftRail.append(this.formationPop);

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
        this.devSettings.watchSpeed = this.speed;
        saveDevSettings(this.devSettings);
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
        // Overclocked: its clock is stopped.
        const oc = w && 'oc' in w && w.oc !== undefined;
        const text = !w ? '' : oc ? 'OC' : gesture ? `${GESTURE_HINT[gesture].split(':')[0]} ${secs}` : id === 'focus' && g.boost?.id === 'focus' ? `HOLD ${secs}` : secs;
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

  private toggleFormations(): void {
    this.formationPop.classList.toggle('open');
    this.syncFormation();
  }

  private syncFormation(): void {
    const id = this.game?.formation ?? 'pairs';
    this.formationBtn.replaceChildren(formationGlyph(id), el('span', '', FORMATIONS[id].name));
    for (const b of this.formationPop.querySelectorAll<HTMLElement>('.v2-formation-opt')) {
      b.classList.toggle('active', b.dataset.formation === id);
    }
  }

  private togglePause(): void {
    if (this.playback) {
      this.endPlayback();
      return;
    }
    if (!this.game || this.game.phase !== 'wave') return;
    this.paused = !this.paused;
    this.pauseBtn.textContent = this.paused ? '▶' : 'II';
    if (this.paused) this.showPauseMenu();
    else this.hideOverlay();
  }

  private showPauseMenu(): void {
    const g = this.game;
    const extra: HTMLElement[] = [];
    if (this.notesOn && this.rec && g) {
      extra.push(button('📝 Add a note', 'v2-btn v3-pause-note', () => this.openNote('pause')));
      const last = this.rec.watch.latest();
      if (last) {
        const b = button(`★ Rate last volley: ${volleyName(last.volley)}${last.volley.rating ? ' ✓' : ''}`, 'v2-btn v3-pause-rate', () => this.openRate('pause'));
        extra.push(b);
      }
    }
    this.showOverlay('v2-pause-panel', [
      el('h2', '', 'Paused'),
      button('Resume', 'v2-btn primary', () => this.togglePause()),
      ...extra,
      button('Quit to menu', 'v2-btn', () => {
        this.paused = false;
        this.pauseBtn.textContent = 'II';
        this.endRun('quit');
        this.showMenu();
      }),
    ]);
  }

  // -------------------------------------------------------------------------
  // Playtest notes and volley ratings

  /** The map's part of the canvas, in canvas pixels (for a thumbnail). */
  private thumb(log: { notes?: PlayNote[] } | null): string | undefined {
    if ((log?.notes ?? []).filter((n) => n.thumb).length >= MAX_THUMBS) return undefined;
    const d = this.dpr;
    return captureThumb(this.canvas, { x: this.offX * d, y: this.offY * d, w: VIEW.width * this.scale * d, h: VIEW.height * this.scale * d });
  }

  /** Is there a finished volley this wave still to rate? */
  private rateable(): boolean {
    const last = this.rec?.watch.latest();
    return !!last && !last.volley.rating && last.volley.wave === this.game?.wave;
  }

  /** The rail's note button: NOTE, or RATE after a volley (with a pulse as
   *  it turns). Rebuilt only when that changes. */
  private syncNoteBtn(g: Game | null): void {
    const live = this.notesOn && !!g && !!this.rec && g.phase === 'wave' && !this.playback;
    const rate = live && this.rateable();
    const closed = this.rec?.watch.closed ?? 0;
    if (live && closed > this.volleysSeen) {
      this.volleysSeen = closed;
      if (rate) {
        this.noteBtn.classList.remove('pulse');
        void this.noteBtn.offsetWidth;
        this.noteBtn.classList.add('pulse');
      }
    }
    const key = `${live}:${rate}`;
    if (key === this.noteKey) return;
    this.noteKey = key;
    this.noteBtn.hidden = !live;
    this.noteBtn.classList.toggle('rate', rate);
    this.noteBtn.replaceChildren(el('b', '', rate ? '★' : '📝'), el('span', '', rate ? 'RATE' : 'NOTE'));
    this.noteBtn.setAttribute('aria-label', rate ? 'Rate the volley that just ended' : 'Pause and add a note');
  }

  /** Pause on this step and say something. The note lands in the log with
   *  the step, the game as it stands and a thumbnail, and the run is saved
   *  at once so it reaches Claude even if the game is closed straight after. */
  private openNote(from: 'rail' | 'pause'): void {
    const g = this.game;
    const rec = this.rec;
    if (!g || !rec || g.phase !== 'wave') return;
    if (from === 'rail' && this.paused) return;
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
        this.showBanner('📝 NOTE SAVED', `${stopWhen(g)}. It's in the log.`, { now: true });
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
        this.showBanner('★ VOLLEY RATED', 'Thanks: it is in the log.', { now: true });
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
      this.formationPop.classList.remove('open');
      if (this.beat?.kind === 'lost' && (performance.now() - this.beat.t) / 1000 > LOST_SKIP_AFTER) {
        this.finishBeat();
        return;
      }
      const w = this.toWorld(e.clientX, e.clientY);
      if (!w || !this.game || this.paused) return;
      // Watch mode: a touch on the battlefield takes the controls (and
      // counts as your first tap).
      if (this.bot && this.control === 'bot' && this.game.phase === 'wave') this.setControl('you');
      // Focus (a boost; the player: "one finger down and then tap with the
      // other one"): while slow motion is banked, the first finger down is
      // the holding finger. It only slows time and fires nothing; every
      // other finger taps (or presses, with a gesture weapon) as usual. A
      // quick touch of the holding finger is still a tap (on its lift), so
      // a single finger can pick a pickup up or fire.
      const g0 = this.game;
      if (g0.phase === 'wave' && g0.boost?.id === 'focus' && g0.boost.bank > 0 && !this.focusFinger && this.rec) {
        this.focusFinger = { id: e.pointerId, x: w.x, y: w.y, at: performance.now() };
        this.rec.focus(true);
        return;
      }
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
      // Focus: the holding finger lifts, and time runs at speed again.
      if (this.focusFinger?.id === e.pointerId) {
        const f = this.focusFinger;
        this.focusFinger = null;
        this.rec?.focus(false);
        if (performance.now() - f.at < FOCUS_TAP_MS) this.fire(f.x, f.y);
        return;
      }
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
  }

  /** A press still down when play stops (pause, a note, the run ends): let
   *  go of it where the finger last was, so nothing stays held. */
  private dropGesture(): void {
    if (this.focusFinger && this.game?.phase === 'wave') this.rec?.focus(false);
    this.focusFinger = null;
    if (!this.gesture) return;
    const at = this.gesture;
    this.gesture = null;
    if (this.game?.phase === 'wave') this.rec?.release(at.x, at.y, TAP_RADIUS_PX / this.scale);
  }

  /** `quiet`: a hold-to-fire repeat, which shouldn't ripple on empty water. */
  private fire(x: number, y: number, quiet = false): void {
    if (!this.game) return;
    if (!this.rec) return;
    const result = this.rec.tap(x, y, TAP_RADIUS_PX / this.scale);
    this.playCues(this.game);
    if (quiet) return;
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
    const w = Math.round(Math.max(window.innerWidth, vv?.width ?? 0)) || this.root.clientWidth;
    const h = Math.round(Math.max(window.innerHeight, vv?.height ?? 0)) || this.root.clientHeight;
    return { w, h };
  }

  private resize(): void {
    const { w, h } = this.viewport();
    // Pin the root to the real viewport so it can't lag behind it.
    this.root.style.width = `${w}px`;
    this.root.style.height = `${h}px`;
    const sa = this.safeInsets();
    this.layoutKey = `${w}x${h}:${sa.l},${sa.r},${sa.t},${sa.b}`;
    this.portrait = h > w;
    this.root.classList.toggle('portrait', this.portrait);
    this.dpr = Math.min(this.pixelCap, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    // The battlefield sits inside the safe area, with the two rails reserved
    // beside it so they never cover it (or hide under the island).
    const availW = w - sa.l - sa.r - RAIL_W * 2;
    const availH = h - sa.t - sa.b;
    this.scale = Math.max(0.05, Math.min(availW / VIEW.width, availH / VIEW.height));
    this.offX = sa.l + RAIL_W + (availW - VIEW.width * this.scale) / 2;
    this.offY = sa.t + (availH - VIEW.height * this.scale) / 2;
    this.root.style.setProperty('--map-left', `${this.offX}px`);
    this.root.style.setProperty('--map-width', `${VIEW.width * this.scale}px`);
    this.root.style.setProperty('--safe-l', `${sa.l}px`);
    this.root.style.setProperty('--safe-r', `${sa.r}px`);
    this.placeBanner();
  }

  /** Cheap per-frame check that catches a late size report with no event. */
  private checkLayout(): void {
    const { w, h } = this.viewport();
    if (!this.layoutKey.startsWith(`${w}x${h}:`)) this.resize();
  }

  // -------------------------------------------------------------------------
  // Loop

  private frame(now: number): void {
    const raw = now - (this.last || now);
    const real = Math.min(0.1, raw / 1000);
    this.last = now;
    this.checkLayout();
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
    this.alerts.update(real);
    if (g) this.raidAlert(g);
    if (g) this.radarHint(g);
    this.syncTimers(g);
    this.syncNoteBtn(g);
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
        case 'wave': {
          const hint = ev.wave === 1 ? MAP_HINT[g.map.id] : undefined;
          // The wave's bell is the sim's own cue (wave.start).
          this.showBanner(`WAVE ${ev.wave}`, ev.wave === 1 ? 'Tap threats to shoot them down. Hold to keep firing.' : '', {}, null);
          if (hint) this.showBanner(...hint);
          // Playthrough round: the first map teaches the two left-rail
          // controls a new player otherwise never learns (on a phone the
          // slider's own hint is hidden for room). Once each, ever.
          const tip = g.map.id === MAP_ORDER[0] && !this.free ? FIRST_TIPS[ev.wave] : undefined;
          if (tip && firstTime(tip[0])) this.showBanner(tip[0], tip[1], { ttl: 5 });
          break;
        }
        case 'tanker':
          this.showBanner('SUPERTANKER UNDER WAY', 'Eight hits sink it, and it counts as three ships.', {}, null);
          break;
        case 'post': {
          const def = g.map.posts?.[ev.post];
          if (def?.kind === 'radar' && ev.lost) this.showBanner('RADAR LOST', 'No more tracking for the rest of the run.', {}, null);
          else if (def?.kind === 'radar' && !ev.down) this.showBanner('RADAR HIT', `${g.posts[ev.post].hp} hits left.`, {}, null);
          else if (def?.kind === 'battery' && ev.down) this.showBanner('BATTERY KNOCKED OUT', 'Back in a few seconds.', {}, null);
          if (ev.down) this.shake = Math.max(this.shake, 10);
          break;
        }
        case 'boss':
          this.showBanner('DREADNOUGHT INBOUND', 'Broadsides every few seconds. Sink it, or keep the convoy alive till it passes.', {}, null);
          this.shake = Math.max(this.shake, 8);
          break;
        case 'fork':
          break;
        // Playthrough round: a new threat, launcher or pickup is explained
        // the first time a player meets it, not again on every map (map 2
        // re-taught all of map 1). Free Play and developer runs always show
        // them (they test them).
        case 'debut':
          if (this.explain(`debut:${ev.threat}`)) this.showBanner(`NEW: ${THREATS[ev.threat].label}`, DEBUT_HINT[ev.threat] ?? '', {}, null);
          break;
        case 'vector':
          if (this.explain(`vector:${ev.vector}`)) this.showBanner(...VECTOR_HINT[ev.vector], {}, null);
          break;
        case 'shipLost':
          this.shake = 10;
          this.hud.classList.add('hit');
          setTimeout(() => this.hud.classList.remove('hit'), 300);
          break;
        case 'carrierHit':
          this.shake = 16;
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
          this.showBanner(`${abilityName(ev.id, ev.level).toUpperCase()} · ${g.stats.weaponTime}s`, `${ABILITIES[ev.id].how}.`, WEAPON_NOTE, null);
          this.shake = Math.max(this.shake, 4);
          break;
        }
        case 'newPickup': {
          const hint = ev.pickup === 'weapon' ? weaponHint(g.stats.weaponTime) : PICKUP_HINT[ev.pickup];
          if (hint && this.explain(`pickup:${ev.pickup}`)) this.showBanner(...hint);
          break;
        }
      }
    }
    g.events.length = 0;
  }

  /** Show a first-meeting explanation? Once per device in the real game;
   *  always in Free Play and developer mode. */
  private explain(id: string): boolean {
    if (this.free || this.dev) return true;
    return firstTime(id);
  }

  /** A notice in the tray (see alerts.ts). Read time is real seconds;
   *  watching at 10× would otherwise leave each one up for 26 game-seconds. */
  private showBanner(title: string, sub: string, opts: AlertOpts = {}, sound: CueId | null = 'notice'): void {
    this.placeBanner();
    if (sound) this.audio.ui(sound);
    this.alerts.notify(title, sub, { ttl: 2.6 / Math.sqrt(Math.max(1, this.speed)), ...opts });
  }

  /** A raid on its way: its card stays up exactly as long as the warning
   *  (the bases' rings on the map still say which ones will fire). */
  /** Lee of Marrow's radar tower, explained the first time it locks on to a
   *  threat, when its lock boxes show what it does (playtest, wave 5: "Not
   *  really sure what that radar tower is even doing"). It used to be a
   *  wave-1 notice, lost among wave 1's own. */
  private radarHint(g: Game): void {
    if (this.radarShown || g.phase !== 'wave' || this.playback) return;
    if (!g.map.posts?.some((p) => p.kind === 'radar') || !g.threats.some((t) => tracked(g, t))) return;
    this.radarShown = true;
    if (this.explain('radar')) this.showBanner('RADAR TOWER', 'Threats in its sweep get a lock box: your shots at them fly faster. Missiles will go for it.', { ttl: 6 });
  }

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
    this.placeBanner();
    this.alerts.notify(`⚠ ${look.name} INBOUND`, look.tip, {
      key: `raid-${g.wave}-${raid.at}`,
      tone: 'raid',
      color: look.color,
      alive: () => this.game === g && raidWarning(g)?.raid === raid,
    });
  }

  /** The power-up countdowns in the left rail; rebuilt only when a number changes. */
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

  /** Lay the tray over the map's strip of shore (clear of bases and lanes). */
  private placeBanner(): void {
    const span = this.game?.map.alerts;
    // Clear of the carrier: its deck and the rack above it.
    const c = this.game?.map.carrier;
    if (span) this.alerts.place(span, this.scale, this.offX, this.offY, c && { x0: c.x - CARRIER.halfLength - 6, y0: c.y - CARRIER.halfBeam - 22, x1: c.x + CARRIER.halfLength + 6, y1: c.y + CARRIER.halfBeam + 4 });
  }

  private renderHud(g: Game): void {
    const pips = Array.from({ length: g.tempo.lossLimit }, (_, i) =>
      i < g.lost ? '<i class="lost"></i>' : i === g.lost && this.danger ? '<i class="next"></i>' : '<i></i>',
    ).join('');
    const waveLabel = g.endless ? `${g.wave}` : `${g.wave}/${RULES.wavesToClear}`;
    const html =
      `<span><b>WAVE</b>${waveLabel}</span>` +
      `<span><b>SCORE</b>${g.score.toLocaleString()}</span>` +
      `<span class="v2-hud-lost"><b>SUNK</b><em>${pips}</em></span>` +
      (this.free ? '<span class="v2-hud-dev">FREE PLAY</span>' : '') +
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
      this.hideOverlay();
    } else if (g.phase === 'draft') {
      this.draftWave = g.wave;
      this.saveProgress();
      // Straight out of a wave: a beat first. A dev stride's second draft
      // (draft → draft) comes up at once.
      if (from === 'wave') {
        this.startBeat('clear', CLEAR_BEAT);
      } else this.openDraft(g);
    } else if (g.phase === 'won') this.startBeat('won', WON_BEAT);
    else if (g.phase === 'lost') this.startBeat('lost', LOST_BEAT);
  }

  private openDraft(g: Game): void {
    this.showDraft(g);
    this.audio.ui('draft.open');
    this.draftShownAt = performance.now();
    // Cards take taps once armed (style.css: no pointer events before).
    const panel = this.overlay.querySelector<HTMLElement>('.v2-draft');
    setTimeout(() => panel && (panel.dataset.armed = '1'), DRAFT_ARM_MS);
    if (this.bot && this.control === 'bot') this.botDraft(g);
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
      if (kind === 'won') this.setStamp('won', 'MAP CLEARED', `Wave ${wave} survived`);
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
      if (g.phase === 'draft') this.openDraft(g);
    } else this.showResult(g, b.kind === 'won');
  }

  /** One more loss and the run is over: the last ship, or a carrier at a
   *  quarter of its hull. The screen's edge beats red and the last empty
   *  pip blinks; a banner says so once, on the way in. */
  private syncDanger(g: Game): void {
    const lastShip = g.tempo.lossLimit - g.lost === 1;
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
    if (this.rec) this.endRun(this.game?.phase === 'won' ? 'won' : 'quit');
    this.rec = null;
    this.game = null;
    this.lastPhase = null;
    this.root.classList.remove('playing');
  }

  private resetFinale(): void {
    this.beat = null;
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
    const armory = button('', 'v3-top-btn v3-armory-btn', () => this.showArmory());
    armory.innerHTML = `${chromeSvg('anchor')}<span>Armory</span>`;
    const count = el('b', 'v3-count', String(p.cards));
    armory.append(count);
    armory.setAttribute('aria-label', `Armory, ${p.cards} card${p.cards === 1 ? '' : 's'} found`);
    armory.dataset.cards = String(p.cards);
    const freePlay = button('', 'v3-top-btn v3-free-btn', () => this.showFreePlay());
    freePlay.innerHTML = `${chromeSvg('play', 16)}<span>Free Play</span>`;
    freePlay.dataset.freePlay = '1';
    const settings = button('', 'v3-top-btn icon v2-settings-btn', () => this.showSettings());
    settings.innerHTML = chromeSvg('gear', 20);
    settings.setAttribute('aria-label', 'Settings');
    bar.append(armory, freePlay);
    if (this.notesOn) {
      const note = button('', 'v3-top-btn v3-menu-note', () => this.openMenuNote());
      note.innerHTML = `${chromeSvg('note', 17)}<span>Note</span>`;
      bar.append(note);
    }
    bar.append(settings);
    // The artifact build ships one game alone; there is no other page to link to.
    // A player has no use for the old prototype: developer mode only (and
    // never in the store build, which has no other page).
    if (!STORE && !('claude' in window) && this.dev) {
      const classic = el('a', 'v2-classic', 'Play V2 →');
      classic.href = './v2.html';
      bar.prepend(classic);
    }
    const title = el('div', 'v3-title');
    title.innerHTML = MARK_SVG;
    title.append(el('h1', '', 'STRAITWATCH'));
    const maps = el('div', 'v3-menu-maps');
    // The locked-map line shows just above the tabs, under the title, where
    // it covers nothing.
    maps.append(toast, tabs, grid);
    this.showOverlay('v2-menu', [bar, title, ...(this.dev ? [this.devPanel()] : []), maps]);
  }

  /** The Armory (round 7): three bays, Gun, Hull and Supply, each a row of
   *  cards. Cards are won at the end of a run, never bought (playtest: "they
   *  don't get to pick which ones"); a card won again adds a level. A run
   *  takes ONE card from each bay: tap one you hold to equip it. Menus
   *  round: each fact once (the bay is the tab, not a label on every card;
   *  a card not found is greyed with a lock, not told three times). */
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
    const row = el('div', `v3-armory-cards n${bayItems(bay).length}`);
    row.append(
      ...bayItems(bay).map((id) => {
        const lv = armoryLevel(p.armory, id);
        const on = p.equipped[bay] === id;
        const card = this.armoryCard(id, lv, on ? 'EQUIPPED' : '', () => {
          if (lv && equipArmory(p, on ? null : id, bay)) {
            this.audio.ui(on ? 'ui.back' : 'armory.equip');
            again();
          }
        }, false);
        card.classList.toggle('chosen', on);
        card.classList.toggle('locked', !lv);
        card.disabled = !lv;
        card.setAttribute('aria-pressed', String(on));
        return card;
      }),
    );
    const count = el('span', 'v3-head-count');
    count.innerHTML = `<b>${p.cards}</b> card${p.cards === 1 ? '' : 's'} found`;
    // One line of help: how cards come while there are none, how they are
    // used once there are some.
    const hint = p.cards
      ? 'Tap a card to equip it, one per bay. Tap it again to take it off.'
      : `Clear ${CARD_DROPS.minWaves} waves in a run to win a card. A card won again gains a level.`;
    this.showOverlay('v3-armory', [this.screenHead('Armory', back, count), tabs, row, el('p', 'v3-hint', hint)]);
  }

  /** One Armory card, drawn like a weapon card: a badge, the art, its
   *  name, its level pips, what it does and the number now and next.
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
      if (lv < def.max) stat.append(el('span', 'v3-card-next', `Next: ${def.show(lv + 1)}`));
      card.append(top, art, el('strong', 'v2-card-name', def.name), pips, el('span', 'v2-card-text', def.blurb), stat);
    } else {
      // Not found yet: what it does, and what the first card would give.
      stat.append(el('span', 'v3-card-next', `First card: ${def.show(1)}`));
      card.append(top, art, el('strong', 'v2-card-name', def.name), el('span', 'v2-card-text', def.blurb), stat);
    }
    return card;
  }

  /** The result screen's Armory drop: the cards won, each one level (NEW
   *  for a card not held before), or why there were none. */
  private wonCards(cards: ArmoryId[], firstClear: boolean): HTMLElement {
    const box = el('div', 'v3-won');
    if (!cards.length) {
      box.append(el('p', 'v2-sub', `No Armory card this time: clear ${CARD_DROPS.minWaves} waves to win one.`));
      return box;
    }
    const p = this.progress;
    // Several of one card: each shows the level it brought.
    const seen: Partial<Record<ArmoryId, number>> = {};
    const total: Partial<Record<ArmoryId, number>> = {};
    for (const id of cards) total[id] = (total[id] ?? 0) + 1;
    const row = el('div', 'v3-won-cards');
    row.append(
      ...cards.map((id, i) => {
        seen[id] = (seen[id] ?? 0) + 1;
        const lv = armoryLevel(p.armory, id) - (total[id]! - seen[id]!);
        const card = this.armoryCard(id, lv, lv === 1 ? 'NEW' : lv >= ARMORY[id].max ? 'MAX' : `LV ${lv}`);
        card.tabIndex = -1;
        card.style.setProperty('--deal', `${i * 260}ms`);
        // Each card's sound lands as it is dealt in (style.css: the deal
        // starts at --deal).
        setTimeout(() => {
          if (!card.isConnected) return;
          this.audio.ui(lv === 1 ? 'card.new' : 'card.won');
          if (i === 0) haptic('success');
        }, i * 260);
        return card;
      }),
    );
    box.append(el('span', 'v2-draft-eyebrow', `Armory card${cards.length > 1 ? 's' : ''} won${firstClear ? ' · first clear bonus' : ''}`), row);
    return box;
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
      const first = newFoeState(id).lead[newFoeState(id).cursor % foes.length];
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
      boxes.push(box);
    }
    side.prepend(...boxes);
    body.append(info, side);
    const n = MAP_ORDER.indexOf(id) + 1;
    const chapter = CHAPTERS[chapterOf(id) - 1];
    this.showOverlay('v3-loadout', [this.screenHead(m.name, () => this.showMenu(), undefined, `Map ${n} · ${chapter.name}`), body]);
  }

  /** Settings (menus round): two grouped cards side by side on a landscape
   *  screen, Sound and Playtest, one sentence a row; the developer card
   *  below them only while developer mode is on. */
  private showSettings(): void {
    if (STORE) {
      this.showStoreSettings();
      return;
    }
    const notes = this.switchRow('notes', 'Playtest notes', 'Note a moment mid-run and rate each volley; both go into the game log.', this.notesOn, (on) => {
      this.notesOn = on;
      setNotesEnabled(on);
      this.root.classList.toggle('notes', on);
    });
    const dev = this.switchRow('dev', 'Developer mode', 'Short test runs, every map open, a start-wave picker and faster speeds. Dev runs never count.', this.dev, (on) => this.setDev(on));
    const cards: HTMLElement[] = [this.setCard('Sound', this.soundRows()), this.setCard('Playtest', [notes, dev])];
    if (this.dev) {
      const board = button('♪ Sound board', 'v2-btn v3-board-btn', () => void this.showSoundBoard());
      board.dataset.soundBoard = '1';
      const rows: HTMLElement[] = [
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
      ];
      if (this.devSettings.watch) rows.push(this.personaRow());
      rows.push(board);
      const card = this.setCard('Developer', rows);
      card.classList.add('wide');
      cards.push(card);
    }
    const grid = el('div', 'v3-set-grid');
    grid.append(...cards);
    this.showOverlay('v2-settings', [this.screenHead('Settings', () => this.showMenu()), grid]);
  }

  /** Settings in the App Store build: Sound (and haptics), and the game card:
   *  the full-game unlock, Game Center, privacy, credits, version and a
   *  progress reset. No playtest or developer rows. */
  private showStoreSettings(): void {
    const sound = this.soundRows();
    if (hapticsAvailable()) {
      sound.push(this.switchRow('haptics', 'Haptics', 'A tap on kills, a thud when a ship is lost, a buzz for a cleared map.', hapticsEnabled(), (on) => setHapticsEnabled(on)));
    }
    const game: HTMLElement[] = [];
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
          this.showBannerSoon(ok ? 'Full game restored' : 'No purchase found', ok ? 'Chapters 2–4 are open.' : 'This Apple ID has not bought the full game.');
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
    left.append(this.setCard('Sound', sound));
    if (game.length) left.append(this.setCard('Game', game));
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
        clearAll(['straitwatch.v3.progress', 'straitwatch.v3.tips', 'straitwatch.v3.freeplay']);
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

  /** A banner once the screen has settled (after a redraw). */
  private showBannerSoon(title: string, text: string): void {
    requestAnimationFrame(() => this.showBanner(title, text, { now: true }));
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
        st.wave = Math.max(1, Math.min(RULES.wavesToClear, st.wave + d));
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
  private play(id: MapId, free: FreeSetup | null = null): void {
    // Playtest knobs: ?wave=N starts at wave N, ?seed=N replays one seed.
    // Dev mode adds a run-length preset and a start wave.
    const params = new URLSearchParams(location.search);
    const preset = this.dev && !free ? DEV_PRESETS[this.devSettings.preset] : null;
    const tempo = preset?.tempo;
    const start = free ? free.wave : (!STORE && Number(params.get('wave'))) || (this.dev ? this.devSettings.wave : 1);
    const skip = tempo ? firstPlayedWave(start, tempo) : start;
    const seed = !STORE && params.has('seed') ? Number(params.get('seed')) : this.seedCounter++;
    const watch = this.dev && !free && this.devSettings.watch;
    if (this.rec) this.endRun('quit');
    this.free = free ? structuredClone(free) : null;
    this.radarShown = false;
    const freePlay = free ? freePlaySetup(free) : undefined;
    this.game = createGame(id, seed, skip, tempo, free ? freeArmory(free) : this.runArmory());
    if (freePlay) applyFreePlay(this.game, freePlay);
    this.rec = new Recorder(this.game, {
      build: __BUILD__,
      startedAt: new Date().toISOString(),
      firstWave: skip,
      ...(freePlay ? { freePlay } : {}),
      ...(tempo ? { tempo, dev: { preset: this.devSettings.preset, ...(watch ? { watch: true, bot: this.devSettings.bot } : {}) } } : {}),
      device: this.deviceInfo(),
    });
    this.startWatch(watch, seed, this.devSettings.bot);
    if (watch) this.setSpeed(this.devSettings.watchSpeed);
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
  private startWatch(watch: boolean, seed: number, persona = YOU.id): void {
    this.bot = watch ? new Mimic(PERSONAS[persona] ?? YOU, seed) : null;
    this.control = watch ? 'bot' : 'you';
    this.useSpeedSteps(watch ? WATCH_SPEED_STEPS : this.dev ? DEV_SPEED_STEPS : SPEED_STEPS);
    this.root.classList.toggle('watching', watch);
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
    this.game = g;
    this.lastPhase = g.phase;
    this.paused = true;
    this.root.classList.add('playing');
    this.root.classList.remove('watching');
    this.hideOverlay();
    this.flowSlider.set(g.flow);
    this.syncFormation();
    return { wave: g.wave, waveT: g.waveT, phase: g.phase };
  }

  /** Watch mode: take over (back to 1×) or hand back (to the watch speed). */
  private setControl(who: Controller): void {
    if (!this.bot || !this.rec || !this.game || who === this.control) return;
    this.control = who;
    this.rec.control(who);
    this.hold = null;
    this.dropGesture();
    if (who === 'you') {
      this.setSpeed(1);
      this.showBanner('YOU HAVE CONTROL', 'Tap BOT on the right to hand back.', { now: true, key: 'control' });
    } else {
      this.setSpeed(this.devSettings.watchSpeed);
      this.showBanner('BOT HAS CONTROL', 'Touch the battlefield to take over.', { now: true, key: 'control' });
      if (this.game.phase === 'draft') this.botDraft(this.game);
    }
    this.syncControl();
  }

  private syncControl(): void {
    const bot = this.control === 'bot';
    this.controlBtn.replaceChildren(el('b', '', bot ? 'BOT' : 'YOU'), el('span', '', bot ? 'take over' : 'hand back'));
    this.controlBtn.classList.toggle('bot', bot);
    this.controlBtn.setAttribute('aria-label', bot ? 'The bot is playing. Take over.' : 'You are playing. Hand back to the bot.');
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
    const choice = bot.choose(g);
    const wave = g.wave;
    const live = () => this.game === g && g.phase === 'draft' && g.wave === wave && this.control === 'bot';
    // The whole hand is dealt before the bot's pick shows, at any speed.
    const dealt = (DEAL_MS + DEAL_STAGGER_MS * (g.offer.length - 1)) * this.dealScale();
    setTimeout(() => {
      if (!live()) return;
      this.overlay.querySelector(`[data-upgrade="${choice.id}"]`)?.classList.add('bot-pick');
      this.overlay.querySelector('.v2-panel')?.append(el('p', 'v2-sub v2-bot-says', `Bot picks ${cardName(choice.id, (choice.id !== 'resupply' ? (g.levels[choice.id] ?? 0) : 0) + 1)}`));
    }, dealt);
    setTimeout(
      () => {
        if (live()) this.rec?.pick(choice.id, choice.replace);
      },
      dealt + 1400 / Math.sqrt(this.speed),
    );
  }

  /** Dev: restart the wave just lost, with the same cards, ships and score,
   *  as a new log that carries the old run's inputs up to that wave. */
  private retryWave(rec: Recorder): void {
    const { mark, log } = rec;
    const g = replayTo(log, mark.steps, mark.commands);
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
    this.root.classList.add('playing');
    this.flowSlider.set(this.game.flow);
    this.syncFormation();
    this.hideOverlay();
  }

  /** The draft: three weapons. With all slots full a new one can still be
 *  taken: tap it, then tap the held weapon it replaces. */
  private showDraft(g: Game, swapping: AbilityId | null = null): void {
    const owned = g.slots;
    const full = owned.length >= MAX_SLOTS;
    const slots = el('div', `v2-slots${swapping ? ' choosing' : ''}`);
    for (let i = 0; i < MAX_SLOTS; i++) {
      const id = owned[i];
      const lv = id ? (g.levels[id] ?? 0) : 0;
      const label = id ? `${abilityName(id, lv)} ${lv >= ABILITY_MAX ? 'MAX' : `LV ${lv}`}` : 'Empty slot';
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
      const lvl = id === 'resupply' ? 0 : (g.levels[id] ?? 0);
      const next = lvl + 1;
      const takeable = canTake(g.levels, id);
      const swappable = canSwapIn(g.levels, id);
      const maxed = id !== 'resupply' && lvl >= ABILITY_MAX;
      // The last level is called MAX, not "evolves" (round 7 playtest).
      const toMax = id !== 'resupply' && next === ABILITY_MAX;
      const badge = id === 'resupply' ? 'NO SWAP' : maxed ? 'MAXED' : swappable ? 'SWAP IN' : toMax ? 'MAX' : lvl > 0 ? 'LEVEL UP' : 'NEW';
      const chosen = swapping === id;
      const card = button('', `v2-card${takeable || swappable ? '' : ' locked'}${id === 'resupply' ? ' resupply' : ''}${swappable ? ' swappable' : ''}${chosen ? ' chosen' : ''}${toMax && !swappable ? ' to-max' : ''}`, () => {
        // Ignore taps that land as the cards appear: the player may still be
        // firing at the wave's last threat.
        if (swapping || this.picking || performance.now() - this.draftShownAt < DRAFT_ARM_MS) return;
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
        } else if (swappable && id !== 'resupply') {
          this.audio.ui('card.swap');
          this.showDraft(g, id);
          this.overlay.querySelector<HTMLElement>('.v2-draft')?.setAttribute('data-armed', '1');
        }
      });
      card.style.setProperty('--deal', `${i * DEAL_STAGGER_MS * this.dealScale()}ms`);
      card.disabled = (!takeable && !swappable) || (!!swapping && !chosen);
      card.dataset.upgrade = id;
      card.dataset.sfx = 'card';
      card.style.setProperty('--card-color', ICON_COLOR[id]);
      const top = el('span', 'v2-card-top', '');
      top.append(
        el('span', 'v2-card-answers', id === 'resupply' ? 'Repairs' : `vs ${ABILITIES[id].answers}`),
        el('span', `v2-badge ${badge === 'SWAP IN' ? 'swap' : badge === 'NEW' ? 'new' : badge === 'MAXED' ? 'off' : badge === 'MAX' ? 'max' : 'up'}`, badge),
      );
      const art = el('span', 'v2-card-art', '');
      art.innerHTML = cardArtSvg(id);
      // A weapon this chapter adds to the draft says so on its card.
      const chapter = chapterOf(g.map.id);
      if (id !== 'resupply' && !g.freePlay && newInChapter(chapter).includes(id)) {
        card.dataset.debut = String(chapter);
        art.append(el('span', 'v3-card-debut', `NEW · ${CHAPTERS[chapter - 1].name}`));
      }
      const level = el('span', 'v2-card-level', '');
      let text: string;
      if (id === 'resupply') {
        text = RESUPPLY_TEXT;
      } else {
        // One pip per level: those already held, the one this card adds, the rest.
        for (let k = 1; k <= ABILITY_MAX; k++) level.append(el('i', k <= lvl ? 'had' : k === next ? 'gain' : ''));
        level.append(el('span', '', maxed ? 'MAX' : `LV ${next}/${ABILITY_MAX}`));
        text = ABILITIES[id].levels[Math.min(lvl, ABILITY_MAX - 1)];
      }
      const name = id === 'resupply' ? 'Resupply' : abilityName(id, Math.min(next, ABILITY_MAX));
      // Only what is particular to this card (round 5: every card said "drops
      // as a pickup, 15 s in the gun", which is how every weapon works).
      // A number keeps its unit on the same line ("1.5 s", not "1.5 / s").
      card.append(top, art, el('strong', 'v2-card-name', name), level, el('span', 'v2-card-text', text.replace(/(\d) s\b/g, '$1\u00a0s')));
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
    head.append(el('span', 'v2-draft-eyebrow', title), el('h2', '', swapping ? 'Choose what it replaces' : 'Choose your weapon'));
    const loadoutRow = el('div', 'v2-loadout');
    loadoutRow.append(el('span', 'v2-loadout-label', 'WEAPONS'), slots);
    this.showOverlay('v2-draft', [head, ...more, row, loadoutRow, ...(rule ? [rule] : [])]);
    this.overlay.querySelector<HTMLElement>('.v2-panel')?.style.setProperty('--deal-k', String(this.dealScale()));
  }

  private showResult(g: Game, won: boolean): void {
    // Dev and Free Play runs never touch the real records, unlocks or cards.
    const free = this.free;
    const wavesCleared = g.history.filter((h) => h.outcome === 'cleared').length;
    const res = this.dev || free ? null : recordResult(this.progress, g.map.id, { score: g.score, wave: g.wave, cleared: g.cleared, wavesCleared });
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
      `<span><b>${g.lost}</b>ships sunk</span>` +
      `<span><b>${Object.values(g.kills).reduce((a, b) => a + b, 0)}</b>shot down</span>`;
    // The Armory cards this run won, drawn at random, shown as cards.
    const won_ = res ? this.wonCards(res.cards, res.firstClear) : null;
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
    if (res) buttons.push(button('⚓ Armory', `v2-btn${res.cards.length ? ' v3-can-buy' : ''}`, () => this.showArmory()));
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
        : `Convoy lost on wave ${g.wave}`;
    const sub = free ? `Free play · ${won ? 'cleared' : reason}` : won ? (next ? `${MAPS[next].name} unlocked.` : 'Every map cleared.') : reason;
    const row = el('div', 'v2-btn-row');
    row.append(...buttons);
    // Dev ghost check: how bot-you does on this same seed, for any run you
    // played some of (a run the bot played alone needs no comparing).
    const ghost = !view.ghosted && this.dev && !free && log && !g.endless && !(log.dev?.watch && !log.commands.some((c) => c[1] === 'c'));
    const ghostLine = el('div', 'v2-ghost');
    this.showOverlay('v2-result', [el('h2', '', title), el('p', 'v2-sub', sub), stats, ...(won_ ? [won_] : []), ...(ghost ? [ghostLine] : []), row, ...(STORE ? [] : [el('p', 'v2-log-status', 'Saving playtest log…')])]);
    if (ghost && log) {
      view.ghosted = true;
      this.startGhost(g, log, ghostLine);
    }
    if (!STORE && log && this.logState) void logChannel().then((c) => this.renderLogStatus(log, c));
  }

  /** The run's review: rate the whole run, then step through its marked
   *  moments (and your notes) on a timeline, note any of them, or watch one
   *  play back. */
  private showReview(selected = -1): void {
    const view = this.review;
    const log = view?.log;
    if (!view || !log) return;
    const stops = runStops(log);
    if (selected < 0 || selected >= stops.length) {
      // Start on the worst moment: the first burst, else the last loss.
      const burst = stops.findIndex((s) => s.kind === 'burst');
      const sunk = stops.map((s) => s.kind).lastIndexOf('sunk');
      selected = burst >= 0 ? burst : sunk >= 0 ? sunk : stops.length - 1;
    }
    const rows = ratingRows(log.rating);
    const save = () => {
      if (rows.any()) log.rating = rows.value();
      this.resendReview();
    };
    const stop = stops[selected];
    const detail = el('div', 'v3-stop');
    if (stop) {
      const look = stop.kind === 'note' ? { icon: '📝', label: 'Your note', color: 'var(--gold)' } : MOMENT_LOOK[stop.kind];
      const head = el('div', 'v3-stop-head');
      const icon = el('span', 'v3-stop-icon', look.icon);
      icon.style.color = look.color;
      head.append(
        button('‹', 'v2-btn v3-stop-step', () => {
          save();
          this.showReview(Math.max(0, selected - 1));
        }),
        icon,
        el('span', 'v3-stop-text', `${stopWhen(stop)} · ${stop.text}`),
        el('span', 'v3-stop-count', `${selected + 1}/${stops.length}`),
        button('›', 'v2-btn v3-stop-step', () => {
          save();
          this.showReview(Math.min(stops.length - 1, selected + 1));
        }),
      );
      const acts = el('div', 'v2-btn-row');
      if (log.commands.length && !log.notesOnly)
        acts.append(
          button('▶ Watch it', 'v2-btn v3-watch-btn', () => {
            save();
            this.startPlayback(stop.step, selected);
          }),
        );
      acts.append(
        button('📝 Note on this', 'v2-btn v3-stop-note', () => {
          save();
          this.reviewNote(selected, stop.moment);
        }),
      );
      detail.append(head, acts);
    } else detail.append(el('p', 'v2-sub', 'Nothing was marked this run: no ships lost, no carrier hits.'));
    const strip = timeline(log, stops, selected, (i) => {
      save();
      this.showReview(i);
    });
    const legend = el('div', 'v3-tl-legend');
    for (const k of ['sunk', 'burst', 'carrier', 'dry', 'debut'] as const) {
      const item = el('span', '', `${MOMENT_LOOK[k].icon} ${MOMENT_LOOK[k].label}`);
      item.style.color = MOMENT_LOOK[k].color;
      legend.append(item);
    }
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
    this.showOverlay('v3-review', [el('h2', '', 'Rate & review this run'), rows.el, strip, legend, detail, foot]);
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
      el('p', 'v2-sub', m ? m.text : `${view.won ? 'Cleared' : `Lost on wave ${view.g.wave}`} · ${view.g.lost} ships sunk`),
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
  private startPlayback(step: number, stop: number): void {
    const log = this.review?.log;
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
    this.playback = { pb, until: step + PLAYBACK_AFTER * 60, from, stop };
    this.game = pb.game;
    this.lastPhase = pb.game.phase;
    this.acc = 0;
    this.paused = false;
    this.ripples = [];
    this.root.classList.add('playing', 'replaying');
    this.flowSlider.set(pb.game.flow);
    this.syncFormation();
    this.hideOverlay();
    this.pauseBtn.textContent = '■';
    this.showBanner('▶ REPLAY', `${stopWhen(pb.game)}: the moment is ${Math.round((step - from) / 60)} s in. Tap ■ on the right to stop.`, { now: true });
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
      line.replaceChildren(
        el('span', '', 'Log saved on this device. '),
        button('Download log', 'v2-link', () => downloadLog(log)),
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
    this.overlay.replaceChildren(panel);
    this.overlay.classList.add('open');
    this.overlay.dataset.screen = screen;
    // A panel taller than the screen scrolls under its header: only then
    // does the header need a backing of its own.
    if (panel.querySelector(':scope > .v3-head')) panel.classList.toggle('scrolls', panel.scrollHeight > panel.clientHeight + 2);
  }

  private hideOverlay(): void {
    this.overlay.classList.remove('open');
    this.overlay.replaceChildren();
    delete this.overlay.dataset.screen;
  }
}

/** Round 4's new pickups get a one-line banner the first time one drops. */
const PICKUP_HINT: Partial<Record<PickupKind, [string, string]>> = {
  timewarp: ['PICKUP: Time Warp', 'Tap it: every threat slows to a crawl for a few seconds.'],
  shield: ['PICKUP: Shield', 'Tap it: the convoy and carrier shrug off every hit for a few seconds.'],
  steam: ['PICKUP: Full Steam', 'Tap it: the convoy races ahead for a few seconds.'],
  starshell: ['PICKUP: Star Shell', 'Tap it: a flare lights the whole strait for a few seconds.'],
  nuke: ['PICKUP: Nuke', 'Tap it: everything in the air and on the water is destroyed. Rare.'],
};

/** The first weapon drop's banner, with the run's seconds (Long Loads). */
function weaponHint(seconds: number): [string, string] {
  return ['WEAPON DROP', `Tap it: the gun fires that weapon for ${seconds} s. Each shot still uses a round.`];
}

const SUNK_BY: Partial<Record<ThreatKind, string>> = {
  drone: 'Drones did the most damage: Flak Cannon or Tesla Arc thin out swarms; Wide Warhead in the Armory helps.',
  ballistic: 'Ballistics did the most damage: Spread formation helps, Aegis Launchers fire from every ship; in the Armory, Fast Motors or Armor Plating.',
  guided: 'Guided missiles did the most damage: a Gravity Well drags them off course; Seeker Pods spread over a volley; Point Defense in the Armory picks off the ones near the carrier.',
  supersonic: 'Supersonics did the most damage: tap on the lock line; Aegis Launchers let the ship it is after fire back.',
  heavy: 'Heavy missiles did the most damage: the Railgun was made for them.',
  cluster: 'Cluster bomblets did the most damage: hit the missile before it splits; Flak or Seeker Pods clear the bomblets.',
  mothership: 'Mothership drones did the most damage: take the mothership down first (Railgun).',
  strafer: 'Strafing runs did the most damage: split the convoy, or Air Strike the jet; frigates shoot jets down too.',
  bomber: 'Bomber missiles did the most damage: shoot bombers down before they reach the convoy (Air Strike).',
  mine: 'Mines did the most damage: one shot clears a mine; Flak or Shrapnel clear a drift of them.',
  fastboat: 'Fast boats did the most damage: watch the coves for a white wake; Scattergun and Air Strike stop them short.',
  sprinter: 'Sprint drones did the most damage: hit them before the booster flares; Flak or the Laser Cutter take a swarm.',
  hydra: 'Hydra darts did the most damage: kill the Hydra far out, or with Flak or Tesla to catch both darts.',
  dart: 'Hydra darts did the most damage: kill the Hydra far out, or with Flak or Tesla to catch both darts.',
  rocketTruck: 'Rocket trucks did the most damage: kill the truck while its launcher raises; the Railgun and Lance reach it.',
  loiter: 'Loitering drones did the most damage: clear the circling group before ships reach it; Flak and Thermobaric catch it whole.',
};

/** One line naming what sank the most ships, and what answers it. */
function culprit(g: Game): string {
  const top = (Object.keys(g.sunkBy) as ThreatKind[]).sort((a, b) => g.sunkBy[b] - g.sunkBy[a])[0];
  return g.sunkBy[top] > 0 ? (SUNK_BY[top] ?? '') : '';
}

/** Tiny dot diagram of a formation, three ships deep. */
function formationGlyph(id: FormationId): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 40 30');
  svg.classList.add('v2-glyph');
  const f = FORMATIONS[id];
  const rows = f.group > 1 ? 2 : 3;
  for (let r = 0; r < rows; r++) {
    const slots = f.group > 1 ? f.offsets : [f.offsets[r % f.offsets.length]];
    for (const o of slots) {
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', String(4 + r * 12));
      rect.setAttribute('y', String(13 + o * 12));
      rect.setAttribute('width', '9');
      rect.setAttribute('height', '4');
      rect.setAttribute('rx', '1.5');
      svg.append(rect);
    }
  }
  return svg;
}

/** A draft card's name at the level it brings. */
function cardName(id: CardId, level: number): string {
  return id === 'resupply' ? 'Resupply' : abilityName(id, Math.min(level, ABILITY_MAX));
}

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
