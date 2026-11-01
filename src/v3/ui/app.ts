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
  raidWarning,
  step,
  type FreePlaySetup,
  type Game,
  type Phase,
  type RaiderKind,
} from '../sim/game';
import { Alerts, type AlertOpts } from './alerts';
import { BotRun, Mimic, PERSONAS, PERSONA_ORDER, YOU, lostByWave, type BotIO } from '../sim/mimic';
import { Recorder, replay, replayTo, type Controller, type FlagKind, type PlayLog } from '../sim/playlog';
import { downloadLog, flushUnsent, logChannel, storeLog, type Channel, type UploadState } from '../platform/playlogStore';
import { DEV_ARMORY, DEV_ORDER, DEV_PRESETS, devEnabled, firstPlayedWave, setDevEnabled, loadDevSettings, saveDevSettings, type DevArmory } from './dev';
import { armoryArtSvg, cardArtSvg } from './cardArt';
import { ICON_COLOR, upgradeIcon } from './icons';
import { stepSlider, type StepSlider } from './rail';
import { DRY_LIFE, IMPACT_LIFE, PICKUP_COLORS, RAID_LOOK, RIPPLE_LIFE, drawFrame, type Ripple } from './render';

const DT = 1 / 60;
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
  private leftRail = el('div', 'v2-rail v2-rail-left');
  private rightRail = el('div', 'v2-rail v2-rail-right');
  private formationPop = el('div', 'v2-formations');
  private formationBtn = button('', 'v2-formation-btn', () => this.toggleFormations());
  private pauseBtn = button('II', 'v2-pause', () => this.togglePause());
  /** Dev: mark this moment for Claude (pauses while you say why). */
  private flagBtn = button('🚩', 'v2-flag-btn', () => this.openFlag());
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
  private dev = devEnabled();
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

  constructor(private root: HTMLElement) {
    root.classList.add('v2-root');
    root.classList.toggle('dev', this.dev);
    root.append(this.canvas, this.dangerEdge, this.vignette, this.stamp, this.alerts.el, this.leftRail, this.rightRail, this.overlay, this.rotateNote, this.safeProbe);
    this.rotateNote.append(el('strong', '', 'Turn your phone sideways'), el('span', '', 'The game is paused until you do.'));
    this.buildRails();
    this.bindInput();
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
      if (e.code === 'Space' && this.game?.phase === 'wave') {
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

  start(): void {
    void flushUnsent();
    // Closing the tab mid-run still leaves a log.
    window.addEventListener('pagehide', () => {
      if (this.beat) this.finishBeat();
      if (this.game && (this.game.phase === 'wave' || this.game.phase === 'draft')) this.endRun('quit');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.saveProgress();
    });
    // Test hook for the browser smoke test: read the game, map world → screen.
    (window as unknown as { __v3: unknown }).__v3 = {
      game: () => this.game,
      toClient: (x: number, y: number) => ({ x: this.offX + x * this.scale, y: this.offY + y * this.scale }),
      control: () => this.control,
      log: () => this.rec?.snapshot() ?? null,
      // Re-run a log here, so a browser test can check a recorded run replays.
      replay: (log: PlayLog) => {
        const g = replay(log);
        return { steps: g.steps, score: g.score, lost: g.lost, wave: g.wave };
      },
      // tools/v2/moment.mjs: show a log's game frozen at one step (a flag).
      showMoment: (log: PlayLog, step: number) => this.showMoment(log, step),
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
      this.flagBtn,
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
      const w = id && g.phase === 'wave' && g.weapon?.id === id ? g.weapon : null;
      const state = !id ? 'empty' : w ? 'loaded' : 'held';
      for (const k of ['empty', 'held', 'loaded']) c.classList.toggle(k, k === state);
      if (id) {
        c.style.setProperty('--left', w ? (w.t / g.stats.weaponTime).toFixed(3) : '0');
        const tag = c.querySelector<HTMLElement>('.v3-weapon-tag')!;
        const text = w ? `${Math.ceil(w.t)}s` : '';
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
    if (!this.game || this.game.phase !== 'wave') return;
    this.paused = !this.paused;
    this.pauseBtn.textContent = this.paused ? '▶' : 'II';
    if (this.paused) {
      this.showOverlay('v2-pause-panel', [
        el('h2', '', 'Paused'),
        button('Resume', 'v2-btn primary', () => this.togglePause()),
        button('Quit to menu', 'v2-btn', () => {
          this.paused = false;
          this.pauseBtn.textContent = 'II';
          this.endRun('quit');
          this.showMenu();
        }),
      ]);
    } else {
      this.hideOverlay();
    }
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
      this.fire(w.x, w.y);
      // Everyone can hold to keep firing (round 4); the first repeat waits a
      // beat so an ordinary tap never fires twice.
      const first = Math.max(0.35, this.game.stats.holdRepeat);
      this.hold = { ...w, since: performance.now(), next: this.game.t + first, id: e.pointerId };
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.hold || this.hold.id !== e.pointerId) return;
      const w = this.toWorld(e.clientX, e.clientY);
      if (w) Object.assign(this.hold, w);
    });
    this.canvas.addEventListener('pointerup', (e) => {
      if (this.hold?.id === e.pointerId) this.hold = null;
    });
    this.canvas.addEventListener('pointercancel', (e) => {
      if (this.hold?.id === e.pointerId) this.hold = null;
    });
  }

  /** `quiet`: a hold-to-fire repeat, which shouldn't ripple on empty water. */
  private fire(x: number, y: number, quiet = false): void {
    if (!this.game) return;
    if (!this.rec) return;
    const result = this.rec.tap(x, y, TAP_RADIUS_PX / this.scale);
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
        step(g, DT);
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
    if (g && this.beat) this.runBeat(now, real);
    if (g) {
      this.drainEvents(g);
      // A dev stride deals a second draft straight after the first: same
      // phase, new wave, so that counts as a change too.
      if (g.phase !== this.lastPhase || (g.phase === 'draft' && g.wave !== this.draftWave)) this.onPhase(g);
      this.renderHud(g);
      this.renderWeapons(g);
      this.syncDanger(g);
    }
    for (const r of this.ripples) r.age += real;
    this.ripples = this.ripples.filter((r) => r.age < (r.impact ? IMPACT_LIFE : r.dry ? DRY_LIFE : RIPPLE_LIFE));
    this.shake = Math.max(0, this.shake - real * 40);
    this.alerts.update(real);
    if (g) this.raidAlert(g);
    this.syncTimers(g);
    this.draw();
    requestAnimationFrame((t) => this.frame(t));
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
    const g = this.game;
    const still = !!g && !this.beat && (g.phase !== 'wave' || this.paused || this.portrait) && !this.ripples.length && this.shake <= 0;
    const key = g ? `${g.phase}:${g.steps}:${this.canvas.width}x${this.canvas.height}:${this.offX}:${this.offY}:${this.zoom.z}` : '';
    if (still && key === this.drawnKey) return;
    this.drawnKey = still ? key : '';
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#070d12';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.game) return;
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
        case 'wave':
          this.showBanner(`WAVE ${ev.wave}`, ev.wave === 1 ? 'Tap threats to shoot them down. Hold to keep firing.' : '');
          break;
        case 'debut':
          this.showBanner(`NEW: ${THREATS[ev.threat].label}`, DEBUT_HINT[ev.threat] ?? '');
          break;
        case 'vector':
          this.showBanner(...VECTOR_HINT[ev.vector]);
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
          this.ripples.push({ x: ev.x, y: ev.y, age: 0, impact: ev.label ?? (ev.threat && BIG_KILL_LABEL[ev.threat]) ?? 'DOWN' });
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
          this.showBanner(`${abilityName(ev.id, ev.level).toUpperCase()} · ${g.stats.weaponTime}s`, `${ABILITIES[ev.id].how}.`, WEAPON_NOTE);
          this.shake = Math.max(this.shake, 4);
          break;
        }
        case 'newPickup': {
          const hint = ev.pickup === 'weapon' ? weaponHint(g.stats.weaponTime) : PICKUP_HINT[ev.pickup];
          if (hint) this.showBanner(...hint);
          break;
        }
      }
    }
    g.events.length = 0;
  }

  /** A notice in the tray (see alerts.ts). Read time is real seconds;
   *  watching at 10× would otherwise leave each one up for 26 game-seconds. */
  private showBanner(title: string, sub: string, opts: AlertOpts = {}): void {
    this.placeBanner();
    this.alerts.notify(title, sub, { ttl: 2.6 / Math.sqrt(Math.max(1, this.speed)), ...opts });
  }

  /** A raid on its way: its card stays up exactly as long as the warning
   *  (the bases' rings on the map still say which ones will fire). */
  private raidAlert(g: Game): void {
    const w = raidWarning(g);
    if (!w || this.beat) return;
    const look = RAID_LOOK[w.raid.theme];
    const raid = w.raid;
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
      // V3: the loaded weapon counts down first, like a power-up.
      if (g.weapon) chips.push([SHORT_NAME[g.weapon.id][g.weapon.level >= ABILITY_MAX ? 1 : 0], g.weapon.t, ICON_COLOR[g.weapon.id]]);
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
    if (span) this.alerts.place(span, this.scale, this.offX, this.offY);
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
    if (on && !this.danger)
      this.showBanner(lastShip ? 'LAST SHIP' : 'CARRIER CRITICAL', lastShip ? 'One more loss and the convoy is lost.' : 'One more hit could sink the carrier.', { tone: 'danger', key: 'danger' });
    if (on !== this.danger) {
      this.danger = on;
      this.root.classList.toggle('danger', on);
    }
  }

  /** Back to a clean field (a new run, the menu). */
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
    this.resetFinale();
    if (this.rec) this.endRun(this.game?.phase === 'won' ? 'won' : 'quit');
    this.rec = null;
    this.game = null;
    this.lastPhase = null;
    this.root.classList.remove('playing');
    // Twenty maps in four chapters of five: the menu shows one chapter at a
    // time (five cards still fit a landscape phone), with a tab per chapter.
    const open = (id: MapId) => this.dev || isUnlocked(this.progress, id);
    if (!this.menuChapter) {
      const furthest = [...MAP_ORDER].reverse().find(open) ?? MAP_ORDER[0];
      this.menuChapter = chapterOf(furthest);
    }
    const tabs = el('div', 'v3-chapter-tabs');
    for (const c of CHAPTERS) {
      const first = MAP_ORDER[(c.n - 1) * 5];
      const shut = !open(first);
      const tab = button('', `v3-chapter-tab${c.n === this.menuChapter ? ' on' : ''}${shut ? ' locked' : ''}`, () => {
        this.menuChapter = c.n;
        this.showMenu();
      });
      tab.dataset.chapter = String(c.n);
      tab.append(el('b', '', `${c.n}`), el('span', '', shut ? `${c.name} 🔒` : c.name));
      tabs.append(tab);
    }
    const shown = MAP_ORDER.map((id, i) => ({ id, i })).filter(({ id }) => chapterOf(id) === this.menuChapter);
    const cards = shown.map(({ id, i }) => {
      const m = MAPS[id];
      const locked = !open(id);
      const best = this.progress.best[id];
      const card = button('', `v2-map-card${locked ? ' locked' : ''}`, () => !locked && this.prepare(id));
      card.disabled = locked;
      card.dataset.map = id;
      card.append(
        el('span', 'v2-map-num', `${i + 1}`),
        el('strong', '', m.name),
        el('span', 'v2-map-blurb', locked ? `Clear ${MAPS[MAP_ORDER[i - 1]].name} to unlock.` : m.blurb),
        el('span', 'v2-map-best', best ? `Best ${best.score.toLocaleString()} · wave ${best.wave}` : locked ? '🔒' : 'Not played yet'),
      );
      return card;
    });
    const classic = el('a', 'v2-classic', 'Play V2 →');
    classic.href = './v2.html';
    // The artifact build ships one game alone; there is no other page to link to.
    classic.hidden = 'claude' in window;
    const foot = el('div', 'v2-menu-foot');
    const settings = button('⚙ Settings', 'v2-link v2-settings-btn', () => this.showSettings());
    const freePlay = button('▶ Free Play', 'v2-btn v3-free-btn', () => this.showFreePlay());
    freePlay.dataset.freePlay = '1';
    foot.append(freePlay, settings, classic);
    this.showOverlay('v2-menu', [
      el('h1', '', 'STRAITWATCH'),
      el('p', 'v2-tag', 'Keep the convoy alive. Tap the drones and missiles to shoot them down; draft weapons between waves, then tap their pickups to load the gun with them.'),
      this.armoryStrip(),
      tabs,
      el('div', 'v2-map-grid', ''),
      ...(this.dev ? [this.devPanel()] : []),
      foot,
    ]);
    this.overlay.querySelector('.v2-map-grid')!.append(...cards);
  }

  /** Menu strip: the cards found, the loadout, and the way in. */
  private armoryStrip(): HTMLElement {
    const p = this.progress;
    const strip = button('', 'v3-armory-strip', () => this.showArmory());
    const loadout = BAY_ORDER.map((b) => p.equipped[b])
      .filter((id): id is ArmoryId => !!id)
      .map((id) => `${ARMORY[id].name} ${armoryLevel(p.armory, id)}`);
    strip.append(
      el('strong', '', '⚓ ARMORY'),
      el('span', 'v3-salvage', `${p.cards} card${p.cards === 1 ? '' : 's'} found`),
      el('span', 'v3-equipped', loadout.length ? loadout.join(' · ') : 'Base gun, nothing equipped'),
      el('em', '', 'Your cards →'),
    );
    return strip;
  }

  /** The Armory (round 7): three bays, Gun, Hull and Supply, each a row of
   *  cards. Cards are won at the end of a run, never bought (playtest: "they
   *  don't get to pick which ones"); a card won again adds a level. A run
   *  takes ONE card from each bay: tap one you hold to equip it. */
  private showArmory(back: () => void = () => this.showMenu()): void {
    const p = this.progress;
    const bay = this.armoryBay;
    const again = () => this.showArmory(back);
    const tabs = el('div', 'v3-bay-tabs');
    for (const b of BAY_ORDER) {
      const eq = p.equipped[b];
      const held = bayItems(b).filter((id) => armoryLevel(p.armory, id) > 0).length;
      const tab = button('', `v3-bay-tab${b === bay ? ' on' : ''}`, () => {
        this.armoryBay = b;
        again();
      });
      tab.dataset.bay = b;
      tab.style.setProperty('--card-color', BAYS[b].color);
      tab.append(
        el('strong', '', `${BAYS[b].name.toUpperCase()} · ${held}/${bayItems(b).length}`),
        el('span', '', eq ? `${ARMORY[eq].name} ${armoryLevel(p.armory, eq)}` : held ? 'nothing equipped' : 'no cards yet'),
      );
      tabs.append(tab);
    }
    const row = el('div', `v3-armory-cards n${bayItems(bay).length}`);
    row.append(
      ...bayItems(bay).map((id) => {
        const lv = armoryLevel(p.armory, id);
        const on = p.equipped[bay] === id;
        const card = this.armoryCard(id, lv, on ? 'EQUIPPED' : lv ? 'EQUIP' : 'NOT FOUND', () => {
          if (lv && equipArmory(p, on ? null : id, bay)) again();
        });
        card.classList.toggle('chosen', on);
        card.classList.toggle('locked', !lv);
        card.disabled = !lv;
        return card;
      }),
    );
    this.showOverlay('v3-armory', [
      el('h2', '', 'Armory'),
      el('p', 'v2-sub', `Cards drop at the end of a run (clear ${CARD_DROPS.minWaves} waves; more for clearing a map). A card you hold again adds a level. A run takes one from each bay: tap a card to equip it.`),
      tabs,
      row,
      button('Back', 'v2-btn primary', back),
    ]);
  }

  /** One Armory card, drawn like a weapon card: its bay, a badge, the art,
   *  its name, its level pips, what it does and the number now and next. */
  private armoryCard(id: ArmoryId, lv: number, badge: string, onTap?: () => void): HTMLButtonElement {
    const def = ARMORY[id];
    const card = button('', 'v2-card v3-armory-card', () => onTap?.());
    card.dataset.armory = id;
    card.style.setProperty('--card-color', BAYS[def.bay].color);
    const top = el('span', 'v2-card-top', '');
    const badgeClass = badge === 'EQUIPPED' ? 'max' : badge === 'NEW' ? 'new' : badge === 'NOT FOUND' || badge === 'EQUIP' ? 'off' : 'up';
    top.append(el('span', 'v2-card-answers', BAYS[def.bay].name), el('span', `v2-badge ${badgeClass}`, badge));
    const art = el('span', 'v2-card-art', '');
    art.innerHTML = armoryArtSvg(id);
    const pips = el('span', 'v2-card-level', '');
    for (let k = 1; k <= def.max; k++) pips.append(el('i', k <= lv ? 'had' : ''));
    pips.append(el('span', '', lv >= def.max ? 'MAX' : `LV ${lv}/${def.max}`));
    const now = lv ? def.show(lv) : 'Not found yet';
    const next = lv < def.max ? `${lv ? ' · next: ' : ' · first card: '}${def.show(lv + 1)}` : '';
    card.append(top, art, el('strong', 'v2-card-name', def.name), pips, el('span', 'v2-card-text', def.blurb), el('span', 'v3-card-stat', `${now}${next}`));
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
      line('Map', select(MAP_ORDER.map((m) => [m, MAPS[m].name]), fp.map, (v) => (fp.map = v as MapId), 'map')),
      line('Start at', select(Array.from({ length: 10 }, (_, k) => [`${k + 1}`, `Wave ${k + 1}`]), `${fp.wave}`, (v) => (fp.wave = Number(v)), 'wave')),
      ...[0, 1, 2].map((i) => {
        const w = fp.weapons[i];
        return line(
          `Weapon ${i + 1}`,
          select([['', '—'], ...ABILITY_ORDER.map((a): [string, string] => [a, ABILITIES[a].name])], w?.id ?? '', (v) => {
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
    const drops = button(fp.frequentDrops ? '✓ Frequent weapon drops' : 'Frequent weapon drops: off', `v2-btn v3-fp-toggle${fp.frequentDrops ? ' on' : ''}`, () => {
      fp.frequentDrops = !fp.frequentDrops;
      saveFreeSetup(fp);
      this.showFreePlay();
    });
    drops.dataset.fp = 'drops';
    right.append(drops);
    const cols = el('div', 'v3-fp-cols');
    cols.append(left, right);
    const go = button('Start free play →', 'v2-btn primary', () => this.play(fp.map, fp));
    go.dataset.freeStart = '1';
    const row = el('div', 'v2-btn-row');
    row.append(button('Menu', 'v2-btn', () => this.showMenu()), go);
    this.showOverlay('v3-freeplay', [
      el('h2', '', 'Free Play'),
      el('p', 'v2-sub', 'Test any weapon and any Armory upgrade, at any level, from any wave. Nothing here counts toward records or Armory cards.'),
      cols,
      row,
    ]);
  }

  /** Before a run: pick the one upgrade it takes from each bay (the last
   *  ones are ready). With nothing bought yet there is nothing to pick.
   *  Watch mode and the dev gun override skip it. */
  private prepare(id: MapId): void {
    this.menuChapter = chapterOf(id);
    const p = this.progress;
    const bays = BAY_ORDER.filter((b) => bayItems(b).some((a) => armoryLevel(p.armory, a) > 0));
    const watch = this.dev && this.devSettings.watch;
    if (!bays.length || watch || (this.dev && this.devSettings.armory !== 'yours')) {
      this.play(id);
      return;
    }
    const tile = (bay: BayId, a: ArmoryId | null) => {
      const lv = a ? armoryLevel(p.armory, a) : 0;
      const on = p.equipped[bay] === a;
      const t = button('', `v3-gun${on ? ' on' : ''}`, () => {
        equipArmory(p, a, bay);
        this.prepare(id);
      });
      t.dataset.gun = a ?? `none-${bay}`;
      if (a) {
        const pips = el('span', 'v2-card-level');
        for (let k = 1; k <= ARMORY[a].max; k++) pips.append(el('i', k <= lv ? 'had' : ''));
        t.append(el('strong', '', ARMORY[a].name), pips, el('span', '', ARMORY[a].show(lv)));
      } else t.append(el('strong', '', bay === 'gun' ? 'Base gun' : 'None'), el('span', '', bay === 'gun' ? 'no upgrade' : 'leave it empty'));
      return t;
    };
    const rows = bays.map((bay) => {
      const row = el('div', 'v3-bay-row');
      row.dataset.bay = bay;
      const grid = el('div', 'v3-gun-grid');
      const owned = bayItems(bay).filter((a) => armoryLevel(p.armory, a) > 0);
      grid.style.setProperty('--n', String(owned.length + 1));
      grid.append(...owned.map((a) => tile(bay, a)), tile(bay, null));
      row.append(el('span', 'v3-bay-label', BAYS[bay].name.toUpperCase()), grid);
      return row;
    });
    const row = el('div', 'v2-btn-row');
    const go = button(`Sail: ${MAPS[id].name} →`, 'v2-btn primary', () => this.play(id));
    go.dataset.start = '1';
    row.append(button('⚓ Armory', 'v2-btn', () => this.showArmory(() => this.prepare(id))), button('Menu', 'v2-btn', () => this.showMenu()), go);
    this.showOverlay('v3-loadout', [
      el('span', 'v2-draft-eyebrow', MAPS[id].name.toUpperCase()),
      el('h2', '', 'Choose your loadout'),
      el('p', 'v2-sub', 'One Armory upgrade from each bay goes into this run.'),
      ...rows,
      row,
    ]);
  }

  private showSettings(): void {
    const sw = button('', `v2-switch${this.dev ? ' on' : ''}`, () => {
      this.setDev(!this.dev);
      this.showSettings();
    });
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-checked', String(this.dev));
    sw.dataset.setting = 'dev';
    const row = el('div', 'v2-setting');
    const text = el('div', 'v2-setting-text');
    text.append(
      el('strong', '', 'Developer mode'),
      el(
        'span',
        '',
        'For playtesting. Shorter test runs (½, ¼, ⅛ length), every map open, a start-wave picker, 3× and 4× speed, and a retry button for a lost wave. Dev runs never count toward your records.',
      ),
    );
    row.append(text, sw);
    const rows: HTMLElement[] = [row];
    if (this.dev) {
      rows.push(el('div', 'v2-setting-group', 'DEVELOPER'));
      rows.push(
        this.switchRow(
          'watch',
          'Watch mode',
          'A bot that plays like you takes the controls: same tap rhythm, aim, reactions and card picks, fitted to your logs. Watch at up to 10×, touch the battlefield to take over, 🚩 to flag a moment. Every watched run is logged for Claude.',
          this.devSettings.watch,
          (on) => {
            this.devSettings.watch = on;
            saveDevSettings(this.devSettings);
          },
        ),
      );
      if (this.devSettings.watch) rows.push(this.personaRow());
    }
    this.showOverlay('v2-settings', [el('h2', '', 'Settings'), ...rows, button('Back', 'v2-btn primary', () => this.showMenu())]);
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
    const start = free ? free.wave : Number(params.get('wave')) || (this.dev ? this.devSettings.wave : 1);
    const skip = tempo ? firstPlayedWave(start, tempo) : start;
    const seed = params.has('seed') ? Number(params.get('seed')) : this.seedCounter++;
    const watch = this.dev && !free && this.devSettings.watch;
    if (this.rec) this.endRun('quit');
    this.free = free ? structuredClone(free) : null;
    const freePlay = free ? freePlaySetup(free) : undefined;
    this.game = createGame(id, seed, skip, tempo, free ? freeArmory(free) : this.runArmory());
    if (freePlay) applyFreePlay(this.game, freePlay);
    this.rec = new Recorder(this.game, {
      build: __BUILD__,
      startedAt: new Date().toISOString(),
      firstWave: skip,
      ...(freePlay ? { freePlay } : {}),
      ...(tempo ? { tempo, dev: { preset: this.devSettings.preset, ...(watch ? { watch: true, bot: this.devSettings.bot } : {}) } } : {}),
      device: {
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
        touch: navigator.maxTouchPoints > 0,
        ua: navigator.userAgent.slice(0, 160),
      },
    });
    this.startWatch(watch, seed, this.devSettings.bot);
    if (watch) this.setSpeed(this.devSettings.watchSpeed);
    else if (preset) this.setSpeed(preset.speed);
    this.begin();
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

  /** 🚩: pause on this exact step and ask why. The flag lands in the log at
   *  this step, and the run is saved at once so it reaches Claude even if
   *  the game is closed straight after. */
  private openFlag(): void {
    const g = this.game;
    if (!this.dev || !g || !this.rec || g.phase !== 'wave' || this.paused) return;
    this.paused = true;
    this.hold = null;
    const choose = (kind: FlagKind, label: string) =>
      button(label, 'v2-btn v2-flag-kind', () => {
        this.rec?.flag(kind);
        this.saveProgress();
        this.closeFlag();
        this.showBanner(`🚩 FLAGGED: ${label.toUpperCase()}`, `Wave ${g.wave}, ${Math.round(g.waveT)} s in. Claude can replay this exact moment.`, { now: true });
      });
    const kinds = el('div', 'v2-btn-row');
    kinds.append(choose('bug', 'Bug'), choose('wrong', 'Looks wrong'), choose('hard', 'Too hard'), choose('easy', 'Too easy'));
    this.showOverlay('v2-flag', [
      el('h2', '', '🚩 Flag this moment'),
      el('p', 'v2-sub', `Wave ${g.wave}, ${Math.round(g.waveT)} s in. The game is paused on it. What is it?`),
      kinds,
      button('Cancel', 'v2-link', () => this.closeFlag()),
    ]);
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

  private closeFlag(): void {
    this.paused = false;
    this.hideOverlay();
  }

  /** Watch mode: take over (back to 1×) or hand back (to the watch speed). */
  private setControl(who: Controller): void {
    if (!this.bot || !this.rec || !this.game || who === this.control) return;
    this.control = who;
    this.rec.control(who);
    this.hold = null;
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
        const chip = button(label, 'v2-slot swap', () => this.rec?.pick(swapping, id));
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
          const wave = g.wave;
          setTimeout(() => {
            this.picking = false;
            if (this.game === g && g.phase === 'draft' && g.wave === wave) this.rec?.pick(id);
          }, PICK_BEAT_MS);
        } else if (swappable && id !== 'resupply') {
          this.showDraft(g, id);
          this.overlay.querySelector<HTMLElement>('.v2-draft')?.setAttribute('data-armed', '1');
        }
      });
      card.style.setProperty('--deal', `${i * DEAL_STAGGER_MS * this.dealScale()}ms`);
      card.disabled = (!takeable && !swappable) || (!!swapping && !chosen);
      card.dataset.upgrade = id;
      card.style.setProperty('--card-color', ICON_COLOR[id]);
      const top = el('span', 'v2-card-top', '');
      top.append(
        el('span', 'v2-card-answers', id === 'resupply' ? 'Repairs' : `vs ${ABILITIES[id].answers}`),
        el('span', `v2-badge ${badge === 'SWAP IN' ? 'swap' : badge === 'NEW' ? 'new' : badge === 'MAXED' ? 'off' : badge === 'MAX' ? 'max' : 'up'}`, badge),
      );
      const art = el('span', 'v2-card-art', '');
      art.innerHTML = cardArtSvg(id);
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
    const best = res?.best ?? false;
    const rec = this.rec;
    const log = this.endRun(won ? 'won' : 'lost');
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
      buttons.push(button('Keep going (endless)', 'v2-btn', () => this.rec?.endless()));
      if (next) buttons.push(button(`Next: ${MAPS[next].name}`, 'v2-btn primary', () => this.prepare(next)));
    } else {
      if (this.dev && rec) buttons.push(button(`Retry wave ${g.wave}`, 'v2-btn primary v2-dev-retry', () => this.retryWave(rec)));
      buttons.push(button(this.bot ? 'Watch a new run' : 'Try again', `v2-btn${this.dev ? '' : ' primary'}`, () => this.prepare(g.map.id)));
    }
    if (res) buttons.push(button('⚓ Armory', `v2-btn${res.cards.length ? ' v3-can-buy' : ''}`, () => this.showArmory()));
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
    const ghost = this.dev && !free && log && !g.endless && !(log.dev?.watch && !log.commands.some((c) => c[1] === 'c'));
    const ghostLine = el('div', 'v2-ghost');
    this.showOverlay('v2-result', [el('h2', '', title), el('p', 'v2-sub', sub), stats, ...(won_ ? [won_] : []), ...(ghost ? [ghostLine] : []), row, el('p', 'v2-log-status', 'Saving playtest log…')]);
    if (ghost) this.startGhost(g, log, ghostLine);
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

  private showOverlay(cls: string, children: HTMLElement[]): void {
    const panel = el('div', `v2-panel ${cls}`);
    panel.append(...children);
    this.overlay.replaceChildren(panel);
    this.overlay.classList.add('open');
    this.overlay.dataset.screen = cls.replace(/^v[23]-/, '');
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
  };
  try {
    const raw = JSON.parse(localStorage.getItem(FREE_KEY) ?? 'null') as Partial<FreeSetup> | null;
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
    };
  } catch {
    return base;
  }
}

function saveFreeSetup(fp: FreeSetup): void {
  try {
    localStorage.setItem(FREE_KEY, JSON.stringify(fp));
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
  return { weapons: fp.weapons.filter((w): w is { id: AbilityId; level: number } => !!w), frequentDrops: fp.frequentDrops };
}
