// V3 app shell: menu → (armory) → game → (draft between waves) → result.
// Owns the frame loop, the two side rails, the ability buttons and the HUD.
// The sim never sees the DOM; this file turns pointer input into `tap()` and
// `activate()` calls and draws whatever the sim holds.

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
import { MAPS, MAP_ORDER, type MapId } from '../data/maps';
import {
  AB,
  ABILITIES,
  ABILITY_MAX,
  CHARGE_LABEL,
  MAX_SLOTS,
  RESUPPLY_TEXT,
  abilityName,
  canSwapIn,
  canTake,
  loadout,
  need,
  type AbilityId,
  type CardId,
} from '../data/abilities';
import { ARMORY, ARMORY_MAX, ARMORY_ORDER, armoryLevel, nextCost, type ArmoryLevels } from '../data/armory';
import { buyArmory, loadProgress, recordResult, type Progress } from '../platform/save';
import {
  abilityReady,
  chargeShare,
  createGame,
  step,
  type Game,
  type Phase,
  type RaiderKind,
} from '../sim/game';
import { BotRun, Mimic, PERSONAS, PERSONA_ORDER, YOU, lostByWave, type BotIO } from '../sim/mimic';
import { Recorder, replay, replayTo, type Controller, type FlagKind, type PlayLog } from '../sim/playlog';
import { downloadLog, flushUnsent, logChannel, storeLog, type Channel, type UploadState } from '../platform/playlogStore';
import { DEV_ARMORY, DEV_ORDER, DEV_PRESETS, devEnabled, firstPlayedWave, setDevEnabled, loadDevSettings, saveDevSettings, type DevArmory } from './dev';
import { cardArtSvg } from './cardArt';
import { ICON_COLOR, upgradeIcon } from './icons';
import { stepSlider, type StepSlider } from './rail';
import { DRY_LIFE, IMPACT_LIFE, RIPPLE_LIFE, drawFrame, type AimPreview, type Ripple } from './render';

const DT = 1 / 60;
/** A tapped card flashes this long before the next wave starts. */
const PICK_BEAT_MS = 180;
/** Round 11: the moment between a wave ending and its screen. The draft
 *  waits a beat (the player had tapped straight into a card while still
 *  firing at the last threat), and cards ignore taps for a moment after
 *  they appear. Losing gets a slow, dramatic finish before the result. */
const CLEAR_BEAT = 0.6;
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
  private game: Game | null = null;
  /** Every input goes through the recorder, so each run leaves a replayable log. */
  private rec: Recorder | null = null;
  private logState: UploadState | null = null;
  private seedCounter = Date.now() % 100000;

  private canvas = el('canvas', 'v2-canvas');
  private ctx = this.canvas.getContext('2d')!;
  private overlay = el('div', 'v2-overlay');
  private hud = el('div', 'v2-hud');
  private banner = el('div', 'v2-banner');
  private leftRail = el('div', 'v2-rail v2-rail-left');
  private rightRail = el('div', 'v2-rail v2-rail-right');
  private formationPop = el('div', 'v2-formations');
  private formationBtn = button('', 'v2-formation-btn', () => this.toggleFormations());
  private pauseBtn = button('II', 'v2-pause', () => this.togglePause());
  /** Dev: mark this moment for Claude (pauses while you say why). */
  private flagBtn = button('🚩', 'v2-flag-btn', () => this.openFlag());
  /** Watch mode: who is playing; tap to take over or hand back. */
  private controlBtn = button('', 'v2-control', () => this.setControl(this.control === 'bot' ? 'you' : 'bot'));
  private flowSlider!: StepSlider;
  private speedSlider!: StepSlider;
  /** V3: one button per ability slot, at the bottom of the right rail. */
  private abilityBar = el('div', 'v3-abilities');
  private abilityBtns: HTMLButtonElement[] = [];
  /** What each button shows (rebuilt only when it changes). */
  private abilityKeys: string[] = [];
  /** An ability waiting for its gesture (a line, a hold or a target). */
  private armed: AbilityId | null = null;
  /** The gesture in progress for the armed ability. */
  private gesture: { id: AbilityId; pointer: number; x: number; y: number; x2: number; y2: number; since: number } | null = null;

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
    activate: (id, aim) => this.rec?.activate(id, aim) ?? false,
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
  private bannerT = 0;
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
    root.append(this.canvas, this.dangerEdge, this.vignette, this.stamp, this.banner, this.leftRail, this.rightRail, this.overlay, this.rotateNote, this.safeProbe);
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
      // Keys 1–3 press the ability buttons (desktop playtesting); Escape disarms.
      const slot = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (slot >= 0 && this.game?.phase === 'wave') this.pressAbility(slot);
      if (e.code === 'Escape' && this.armed) this.disarm();
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
    // speeds, leaving the bottom of the rail to the ability buttons, under
    // the right thumb.
    for (let i = 0; i < MAX_SLOTS; i++) {
      const b = button('', 'v3-ability empty', () => this.pressAbility(i));
      b.dataset.slot = String(i);
      this.abilityBtns.push(b);
      this.abilityKeys.push('');
    }
    this.abilityBar.append(...this.abilityBtns);
    this.rightRail.append(this.hud, this.pauseBtn, this.controlBtn, this.speedSlider.el, this.abilityBar);
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
  // Ability buttons

  /** A button pressed: fire it now (button / takeover abilities), or arm it
   *  for the gesture it needs. Pressing an armed button disarms it. */
  private pressAbility(slot: number): void {
    const g = this.game;
    if (!g || !this.rec || g.phase !== 'wave' || this.paused) return;
    const id = loadout(g.levels)[slot];
    if (!id) return;
    if (this.bot && this.control === 'bot') this.setControl('you');
    if (this.armed === id) {
      this.disarm();
      return;
    }
    if (!abilityReady(g, id)) {
      const share = Math.round(chargeShare(g, id) * 100);
      this.showBanner(`${abilityName(id, g.levels[id] ?? 1).toUpperCase()} CHARGING ${share}%`, CHARGE_LABEL[ABILITIES[id].charge](need(id, g.levels[id] ?? 1)));
      return;
    }
    const act = ABILITIES[id].activation;
    if (act === 'button' || act === 'takeover') {
      this.rec.activate(id);
      return;
    }
    // Hunter-Killer (evolved) needs no target: one press sinks them all.
    if (act === 'target' && (g.levels[id] ?? 0) >= ABILITY_MAX) {
      if (!this.rec.activate(id)) this.showBanner('NO SUBS OR TRUCKS UP', 'It fires when one is on the map.');
      return;
    }
    this.armed = id;
    this.hold = null;
    this.showBanner(`${abilityName(id, g.levels[id] ?? 1).toUpperCase()} ARMED`, `${ABILITIES[id].how}. Tap its button again to cancel.`);
  }

  private disarm(): void {
    this.armed = null;
    this.gesture = null;
  }

  /** The armed ability's gesture ended at (x, y): set it off if it says
   *  enough, else stay armed and say why. */
  private finishGesture(x: number, y: number): void {
    const ges = this.gesture;
    const g = this.game;
    this.gesture = null;
    if (!ges || !g || !this.rec) return;
    const id = ges.id;
    const act = ABILITIES[id].activation;
    let ok = false;
    if (act === 'line') {
      ok = this.rec.activate(id, { x: ges.x, y: ges.y, x2: x, y2: y });
      if (!ok) this.showBanner('SWIPE FURTHER', ABILITIES[id].how);
    } else if (act === 'hold') {
      const held = (performance.now() - ges.since) / 1000;
      ok = this.rec.activate(id, { x: ges.x, y: ges.y, power: Math.min(1, held / AB.salvo.holdFull) });
    } else if (act === 'target') {
      ok = this.rec.activate(id, { x, y });
      if (!ok) this.showBanner('NO SUB OR TRUCK THERE', ABILITIES[id].how);
    }
    if (ok) this.disarm();
  }

  /** The armed ability's aim, for the renderer. */
  private aimPreview(): AimPreview | null {
    const id = this.armed;
    if (!id) return null;
    const color = ICON_COLOR[id];
    const act = ABILITIES[id].activation;
    const ges = this.gesture;
    if (!ges) return null;
    const label = abilityName(id, this.game?.levels[id] ?? 1).toUpperCase();
    if (act === 'line') return { kind: 'line', x: ges.x, y: ges.y, x2: ges.x2, y2: ges.y2, power: 0, color, label };
    if (act === 'hold') {
      const power = Math.min(1, (performance.now() - ges.since) / 1000 / AB.salvo.holdFull);
      return { kind: 'hold', x: ges.x2, y: ges.y2, x2: ges.x2, y2: ges.y2, power, color, label };
    }
    return { kind: 'target', x: ges.x2, y: ges.y2, x2: ges.x2, y2: ges.y2, power: 0, color, label };
  }

  /** Per frame: each button's ability, level, charge ring and state. */
  private renderAbilities(g: Game): void {
    const held = loadout(g.levels);
    if (this.armed && (!abilityReady(g, this.armed) || g.phase !== 'wave')) this.disarm();
    for (let i = 0; i < MAX_SLOTS; i++) {
      const b = this.abilityBtns[i];
      const id = held[i];
      const lv = id ? (g.levels[id] ?? 0) : 0;
      const key = id ? `${id}:${lv}` : '';
      if (key !== this.abilityKeys[i]) {
        this.abilityKeys[i] = key;
        b.replaceChildren();
        b.dataset.ability = id ?? '';
        if (id) {
          b.style.setProperty('--card-color', ICON_COLOR[id]);
          b.append(upgradeIcon(id, 26), el('span', 'v3-ability-name', abilityName(id, lv)), el('span', 'v3-ability-lv', lv >= ABILITY_MAX ? 'EVO' : `LV ${lv}`));
          b.setAttribute('aria-label', `${abilityName(id, lv)}, key ${i + 1}`);
        } else {
          b.append(el('span', 'v3-ability-name', 'empty'));
          b.setAttribute('aria-label', 'Empty ability slot');
        }
      }
      const ready = !!id && abilityReady(g, id);
      const active = !!id && g.gunMode?.id === id;
      b.style.setProperty('--charge', id ? (active ? '1' : chargeShare(g, id).toFixed(3)) : '0');
      b.classList.toggle('empty', !id);
      b.classList.toggle('ready', ready && this.armed !== id);
      b.classList.toggle('armed', !!id && this.armed === id);
      b.classList.toggle('active', active);
      b.disabled = !id;
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
      // An armed ability takes this touch: a line, a hold or a target, not a shot.
      if (this.armed && this.game.phase === 'wave') {
        this.gesture = { id: this.armed, pointer: e.pointerId, x: w.x, y: w.y, x2: w.x, y2: w.y, since: performance.now() };
        return;
      }
      this.fire(w.x, w.y);
      // Everyone can hold to keep firing (round 4); the first repeat waits a
      // beat so an ordinary tap never fires twice.
      const first = Math.max(0.35, this.game.stats.holdRepeat);
      this.hold = { ...w, since: performance.now(), next: this.game.t + first, id: e.pointerId };
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.gesture?.pointer === e.pointerId) {
        const w = this.toWorldClamped(e.clientX, e.clientY);
        this.gesture.x2 = w.x;
        this.gesture.y2 = w.y;
        return;
      }
      if (!this.hold || this.hold.id !== e.pointerId) return;
      const w = this.toWorld(e.clientX, e.clientY);
      if (w) Object.assign(this.hold, w);
    });
    this.canvas.addEventListener('pointerup', (e) => {
      if (this.gesture?.pointer === e.pointerId) {
        const w = this.toWorldClamped(e.clientX, e.clientY);
        this.finishGesture(w.x, w.y);
      }
      if (this.hold?.id === e.pointerId) this.hold = null;
    });
    this.canvas.addEventListener('pointercancel', (e) => {
      if (this.gesture?.pointer === e.pointerId) this.gesture = null;
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

  /** Like `toWorld`, but a finger that slid off the field is held at its edge
   *  (a swipe may well end past the map). */
  private toWorldClamped(cx: number, cy: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const x = (cx - r.left - this.offX) / this.scale;
    const y = (cy - r.top - this.offY) / this.scale;
    return { x: Math.max(0, Math.min(VIEW.width, x)), y: Math.max(0, Math.min(VIEW.height, y)) };
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
      this.renderAbilities(g);
      this.syncDanger(g);
    }
    for (const r of this.ripples) r.age += real;
    this.ripples = this.ripples.filter((r) => r.age < (r.impact ? IMPACT_LIFE : r.dry ? DRY_LIFE : RIPPLE_LIFE));
    this.shake = Math.max(0, this.shake - real * 40);
    this.bannerT -= real;
    this.banner.classList.toggle('show', this.bannerT > 0);
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
    const still = !!g && !this.beat && !this.gesture && (g.phase !== 'wave' || this.paused || this.portrait) && !this.ripples.length && this.shake <= 0;
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
    drawFrame(ctx, this.game, this.ripples, this.shake, this.bannerT > 0, this.aimPreview());
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
          this.ripples.push({ x: ev.x, y: ev.y, age: 0, impact: BIG_KILL_LABEL[ev.threat] ?? 'DOWN' });
          break;
        }
        case 'dry':
          this.hud.classList.add('dry');
          setTimeout(() => this.hud.classList.remove('dry'), 250);
          break;
        case 'pickup':
          break;
        case 'ability': {
          const a = ABILITIES[ev.id];
          this.showBanner(abilityName(ev.id, ev.level).toUpperCase(), a.levels[ev.level - 1].replace(/^EVOLVES: /, ''));
          this.shake = Math.max(this.shake, 6);
          break;
        }
        case 'abilityReady': {
          const slot = loadout(g.levels).indexOf(ev.id);
          const b = this.abilityBtns[slot];
          if (b) {
            b.classList.remove('flash');
            void b.offsetWidth;
            b.classList.add('flash');
          }
          break;
        }
        case 'newPickup': {
          const hint = PICKUP_HINT[ev.pickup];
          if (hint) this.showBanner(...hint);
          break;
        }
      }
    }
    g.events.length = 0;
  }

  private showBanner(title: string, sub: string): void {
    this.banner.replaceChildren(el('strong', '', title), ...(sub ? [el('span', '', sub)] : []));
    // Read-time, in real seconds; watching at 10× would otherwise leave every
    // banner up for 26 game-seconds.
    this.bannerT = 2.6 / Math.sqrt(Math.max(1, this.speed));
    this.placeBanner();
  }

  /** Pin the banner to the map's callout point (clear of bases and lanes). */
  private placeBanner(): void {
    const c = this.game?.map.callout;
    if (!c) return;
    this.banner.style.left = `${this.offX + c.x * this.scale}px`;
    this.banner.style.top = `${this.offY + c.y * this.scale}px`;
    this.banner.style.maxWidth = `${780 * this.scale}px`;
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
      (this.dev ? `<span class="v2-hud-dev">DEV ${DEV_PRESETS[this.devSettings.preset].label}${this.bot ? ` · WATCH${this.bot.persona.id === YOU.id ? '' : ` · ${(this.bot.persona.label ?? this.bot.persona.id).toUpperCase()}`}` : ''}</span>` : '');
    if (this.hud.innerHTML !== html) this.hud.innerHTML = html;
  }

  // -------------------------------------------------------------------------
  // Screens

  private onPhase(g: Game): void {
    const from = this.lastPhase;
    this.lastPhase = g.phase;
    if (g.phase !== 'wave') this.disarm();
    if (g.phase === 'wave') {
      this.beat = null;
      this.hideOverlay();
    } else if (g.phase === 'draft') {
      this.draftWave = g.wave;
      this.saveProgress();
      // Straight out of a wave: a beat first. A dev stride's second draft
      // (draft → draft) comes up at once.
      if (from === 'wave') {
        const last = g.history[g.history.length - 1];
        this.showBanner(`WAVE ${last?.wave ?? g.wave} CLEARED`, `+${(200 * (last?.wave ?? g.wave)).toLocaleString()} bonus`);
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
      this.bannerT = 0;
      this.root.classList.add('finale');
      this.stamp.textContent = g.carrierHp <= 0 ? 'CARRIER DOWN' : 'CONVOY LOST';
    }
    this.beat = { kind, t: performance.now(), dur, focus };
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
    const carrier = g.carrierHp <= Math.ceil(CARRIER.hp * 0.25);
    const on = g.phase === 'wave' && !this.beat && (lastShip || carrier);
    if (on && !this.danger) this.showBanner(lastShip ? 'LAST SHIP' : 'CARRIER CRITICAL', lastShip ? 'One more loss and the convoy is lost.' : 'One more hit could sink the carrier.');
    if (on !== this.danger) {
      this.danger = on;
      this.root.classList.toggle('danger', on);
    }
  }

  /** Back to a clean field (a new run, the menu). */
  private resetFinale(): void {
    this.beat = null;
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
    const cards = MAP_ORDER.map((id, i) => {
      const m = MAPS[id];
      const locked = i >= this.progress.unlocked && !this.dev;
      const best = this.progress.best[id];
      const card = button('', `v2-map-card${locked ? ' locked' : ''}`, () => !locked && this.play(id));
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
    foot.append(settings, classic);
    this.showOverlay('v2-menu', [
      el('h1', '', 'STRAITWATCH'),
      el('p', 'v2-tag', 'Keep the convoy alive. Tap the drones and missiles to shoot them down; draft abilities between waves and fire them from the buttons at the bottom right.'),
      this.armoryStrip(),
      el('div', 'v2-map-grid', ''),
      ...(this.dev ? [this.devPanel()] : []),
      foot,
    ]);
    this.overlay.querySelector('.v2-map-grid')!.append(...cards);
  }

  /** Menu strip: salvage banked, the gun's levels, and the way in. */
  private armoryStrip(): HTMLElement {
    const p = this.progress;
    const strip = button('', 'v3-armory-strip', () => this.showArmory());
    const pips = el('span', 'v3-armory-pips');
    for (const id of ARMORY_ORDER) {
      const lv = armoryLevel(p.armory, id);
      pips.append(el('span', '', `${ARMORY[id].name.split(' ').pop()} ${lv}/${ARMORY_MAX}`));
    }
    const affordable = ARMORY_ORDER.some((id) => (nextCost(p.armory, id) ?? Infinity) <= p.salvage);
    strip.append(el('strong', '', '⚓ ARMORY'), el('span', 'v3-salvage', `${p.salvage.toLocaleString()} salvage`), pips, el('em', affordable ? 'v3-can-buy' : '', affordable ? 'Upgrade ready →' : 'Main gun upgrades →'));
    return strip;
  }

  /** The Armory: five permanent main-gun upgrades bought with salvage. The
   *  gun has no upgrades inside a run; this is where it gets better. */
  private showArmory(back: () => void = () => this.showMenu()): void {
    const p = this.progress;
    const rows = ARMORY_ORDER.map((id) => {
      const def = ARMORY[id];
      const lv = armoryLevel(p.armory, id);
      const cost = nextCost(p.armory, id);
      const row = el('div', 'v3-armory-row');
      row.dataset.armory = id;
      const pips = el('span', 'v2-card-level');
      for (let k = 1; k <= ARMORY_MAX; k++) pips.append(el('i', k <= lv ? 'had' : ''));
      const text = el('div', 'v3-armory-text');
      text.append(el('strong', '', def.name), el('span', '', def.blurb), pips);
      const now = el('div', 'v3-armory-stat');
      now.append(el('b', '', def.show(lv)), ...(cost === null ? [] : [el('span', '', `next: ${def.show(lv + 1)}`)]));
      const buy = button(cost === null ? 'MAXED' : `Upgrade · ${cost}`, `v2-btn${cost !== null && cost <= p.salvage ? ' primary' : ''}`, () => {
        if (buyArmory(p, id)) this.showArmory(back);
      });
      buy.disabled = cost === null || cost > p.salvage;
      row.append(text, now, buy);
      return row;
    });
    const list = el('div', 'v3-armory-list');
    list.append(...rows);
    this.showOverlay('v3-armory', [
      el('h2', '', 'Armory'),
      el('p', 'v2-sub', `Your main gun, set before every run. Salvage comes from every run, won or lost: ${p.salvage.toLocaleString()} banked, ${p.earned.toLocaleString()} earned in all.`),
      list,
      button('Back', 'v2-btn primary', back),
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

  private play(id: MapId): void {
    // Playtest knobs: ?wave=N starts at wave N, ?seed=N replays one seed.
    // Dev mode adds a run-length preset and a start wave.
    const params = new URLSearchParams(location.search);
    const preset = this.dev ? DEV_PRESETS[this.devSettings.preset] : null;
    const tempo = preset?.tempo;
    const start = Number(params.get('wave')) || (this.dev ? this.devSettings.wave : 1);
    const skip = tempo ? firstPlayedWave(start, tempo) : start;
    const seed = params.has('seed') ? Number(params.get('seed')) : this.seedCounter++;
    const watch = this.dev && this.devSettings.watch;
    if (this.rec) this.endRun('quit');
    this.game = createGame(id, seed, skip, tempo, this.runArmory());
    this.rec = new Recorder(this.game, {
      build: __BUILD__,
      startedAt: new Date().toISOString(),
      firstWave: skip,
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

  /** The main gun for a run: the Armory, or a dev override. */
  private runArmory(): ArmoryLevels {
    if (!this.dev || this.devSettings.armory === 'yours') return { ...this.progress.armory };
    const lv = this.devSettings.armory === 'max' ? ARMORY_MAX : 0;
    return Object.fromEntries(ARMORY_ORDER.map((id) => [id, lv]));
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
        this.showBanner(`🚩 FLAGGED: ${label.toUpperCase()}`, `Wave ${g.wave}, ${Math.round(g.waveT)} s in. Claude can replay this exact moment.`);
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
      this.showBanner('YOU HAVE CONTROL', 'Tap BOT on the right to hand back.');
    } else {
      this.setSpeed(this.devSettings.watchSpeed);
      this.showBanner('BOT HAS CONTROL', 'Touch the battlefield to take over.');
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

  /** The draft: three abilities. With all slots full a new one can still be
 *  taken: tap it, then tap the held ability it replaces. */
  private showDraft(g: Game, swapping: AbilityId | null = null): void {
    const owned = loadout(g.levels);
    const full = owned.length >= MAX_SLOTS;
    const slots = el('div', `v2-slots${swapping ? ' choosing' : ''}`);
    for (let i = 0; i < MAX_SLOTS; i++) {
      const id = owned[i];
      const lv = id ? (g.levels[id] ?? 0) : 0;
      const label = id ? `${abilityName(id, lv)} ${lv >= ABILITY_MAX ? 'EVO' : `LV ${lv}`}` : 'Empty slot';
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
      const evolves = id !== 'resupply' && next === ABILITY_MAX;
      const badge = id === 'resupply' ? 'NO SWAP' : maxed ? 'MAXED' : swappable ? 'SWAP IN' : evolves ? 'EVOLVES' : lvl > 0 ? 'LEVEL UP' : 'NEW';
      const chosen = swapping === id;
      const card = button('', `v2-card${takeable || swappable ? '' : ' locked'}${id === 'resupply' ? ' resupply' : ''}${swappable ? ' swappable' : ''}${chosen ? ' chosen' : ''}${evolves && !swappable ? ' evolves' : ''}`, () => {
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
        el('span', `v2-badge ${badge === 'SWAP IN' ? 'swap' : badge === 'NEW' ? 'new' : badge === 'MAXED' ? 'off' : badge === 'EVOLVES' ? 'evo' : 'up'}`, badge),
      );
      const art = el('span', 'v2-card-art', '');
      art.innerHTML = cardArtSvg(id);
      const level = el('span', 'v2-card-level', '');
      let text: string;
      if (id === 'resupply') {
        level.textContent = 'Keeps your abilities';
        text = RESUPPLY_TEXT;
      } else {
        // One pip per level: those already held, the one this card adds, the rest.
        for (let k = 1; k <= ABILITY_MAX; k++) level.append(el('i', k <= lvl ? 'had' : k === next ? 'gain' : ''));
        level.append(el('span', '', maxed ? 'MAX' : `LV ${next}/${ABILITY_MAX}`));
        text = ABILITIES[id].levels[Math.min(lvl, ABILITY_MAX - 1)];
      }
      const name = id === 'resupply' ? 'Resupply' : abilityName(id, Math.min(next, ABILITY_MAX));
      card.append(top, art, el('strong', 'v2-card-name', name), level, el('span', 'v2-card-text', text));
      if (id !== 'resupply') {
        const a = ABILITIES[id];
        card.append(el('span', 'v3-card-how', `${CHARGE_LABEL[a.charge](need(id, Math.min(next, ABILITY_MAX)))} · ${a.how}`));
      }
      return card;
    });
    const row = el('div', 'v2-card-row');
    row.append(...cards);
    let rule: HTMLElement;
    if (swapping) {
      rule = el('p', 'v2-sub v2-swap-prompt', `Swap in ${ABILITIES[swapping].name}: tap the ability it replaces above. That one and its levels are gone.`);
      rule.append(button('Cancel', 'v2-link', () => {
        this.showDraft(g);
        this.overlay.querySelector<HTMLElement>('.v2-draft')?.setAttribute('data-armed', '1');
      }));
    } else {
      rule = el(
        'p',
        'v2-sub',
        full
          ? 'Slots full: level up an ability you hold (level 3 evolves it), or swap a new one in.'
          : `Pick one. You can hold ${MAX_SLOTS} abilities (${MAX_SLOTS - owned.length} slot${MAX_SLOTS - owned.length === 1 ? '' : 's'} free); level 3 evolves.`,
      );
    }
    // Dev stride: the waves it skips each still deal a card.
    const skipped = g.history[g.history.length - 1]?.wave !== g.wave;
    const title = skipped ? `Wave ${g.wave} skipped` : `Wave ${g.wave} cleared`;
    const more = g.draftsLeft > 1 ? [el('p', 'v2-sub v2-dev-more', `Dev: ${g.draftsLeft} cards to pick before the next wave.`)] : [];
    const head = el('div', 'v2-draft-head');
    head.append(el('span', 'v2-draft-eyebrow', title), el('h2', '', swapping ? 'Choose what it replaces' : 'Choose your ability'));
    const loadoutRow = el('div', 'v2-loadout');
    loadoutRow.append(el('span', 'v2-loadout-label', 'ABILITIES'), slots);
    this.showOverlay('v2-draft', [head, ...more, row, loadoutRow, rule]);
    this.overlay.querySelector<HTMLElement>('.v2-panel')?.style.setProperty('--deal-k', String(this.dealScale()));
  }

  private showResult(g: Game, won: boolean): void {
    // Dev runs never touch the real records, unlocks or salvage.
    const wavesCleared = g.history.filter((h) => h.outcome === 'cleared').length;
    const res = this.dev ? null : recordResult(this.progress, g.map.id, { score: g.score, wave: g.wave, cleared: g.cleared, delivered: g.delivered, wavesCleared });
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
      `<span><b>${Object.values(g.kills).reduce((a, b) => a + b, 0)}</b>shot down</span>` +
      (res ? `<span class="v3-salvage-earned"><b>+${res.salvage}</b>salvage${res.firstClear ? ' · first clear!' : ''}</span>` : '');
    const buttons: HTMLElement[] = [];
    if (won) {
      buttons.push(button('Keep going (endless)', 'v2-btn', () => this.rec?.endless()));
      if (next) buttons.push(button(`Next: ${MAPS[next].name}`, 'v2-btn primary', () => this.play(next)));
    } else {
      if (this.dev && rec) buttons.push(button(`Retry wave ${g.wave}`, 'v2-btn primary v2-dev-retry', () => this.retryWave(rec)));
      buttons.push(button(this.bot ? 'Watch a new run' : 'Try again', `v2-btn${this.dev ? '' : ' primary'}`, () => this.play(g.map.id)));
    }
    if (!this.dev) {
      const affordable = ARMORY_ORDER.some((id) => (nextCost(this.progress.armory, id) ?? Infinity) <= this.progress.salvage);
      buttons.push(button(affordable ? '⚓ Armory: upgrade ready' : '⚓ Armory', `v2-btn${affordable ? ' v3-can-buy' : ''}`, () => this.showArmory()));
    }
    buttons.push(button('Menu', 'v2-btn', () => this.showMenu()));
    const reason = g.carrierHp <= 0 ? 'The carrier went down.' : `${g.lost} ships sunk. ${culprit(g)}`;
    const title = won
      ? `${g.map.name} cleared!`
      : g.endless
        ? `Endless run over: wave ${g.wave}`
        : `Convoy lost on wave ${g.wave}`;
    const sub = won ? (next ? `${MAPS[next].name} unlocked.` : 'Every map cleared.') : reason;
    const row = el('div', 'v2-btn-row');
    row.append(...buttons);
    // Dev ghost check: how bot-you does on this same seed, for any run you
    // played some of (a run the bot played alone needs no comparing).
    const ghost = this.dev && log && !g.endless && !(log.dev?.watch && !log.commands.some((c) => c[1] === 'c'));
    const ghostLine = el('div', 'v2-ghost');
    this.showOverlay('v2-result', [el('h2', '', title), el('p', 'v2-sub', sub), stats, ...(ghost ? [ghostLine] : []), row, el('p', 'v2-log-status', 'Saving playtest log…')]);
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
};

const SUNK_BY: Partial<Record<ThreatKind, string>> = {
  drone: 'Drones did the most damage: EMP Pulse or Tesla Arc thin out swarms; Wide Warhead in the Armory helps.',
  ballistic: 'Ballistics did the most damage: Spread formation helps, and Fast Motors in the Armory.',
  guided: 'Guided missiles did the most damage: Decoy Barrage pulls them off.',
  supersonic: 'Supersonics did the most damage: tap on the lock line; Decoy Barrage level 2 fools them.',
  heavy: 'Heavy missiles did the most damage: the Railgun was made for them.',
  cluster: 'Cluster bomblets did the most damage: hit the missile before it splits; Hellfire Salvo clears the bomblets.',
  mothership: 'Mothership drones did the most damage: take the mothership down first (Railgun).',
  strafer: 'Strafing runs did the most damage: split the convoy, or Air Strike the jet; Smoke Wall hides ships.',
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
 *  be a full-height slider; the rail's lower half is the ability buttons'). */
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
