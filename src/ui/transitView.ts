// Transit phase view: canvas rendering, pointer input, and the HUD.
// The view owns nothing about game rules — it feeds TransitCommands into
// stepTransit on a fixed timestep and draws whatever the sim state says.

import { COMBAT, SIM, SURVIVORS, WORLD, WRECKAGE } from '../data/tuning';
import { stepTransit } from '../sim/transit';
import { escortStatus, resolveEscortOrder, type EscortStatus } from '../sim/escortOrders';
import type { RNG } from '../sim/rng';
import type {
  AutoSystem,
  Escort,
  Ship,
  TargetPriority,
  Threat,
  TransitCommand,
  TransitState,
} from '../sim/types';
import { Camera } from './camera';
import { h } from './dom';

/** Placeable abilities/weapons the HUD can arm; the next map tap places them. */
type ArmedAbility = 'warthog' | 'scan' | 'sonar' | 'smoke' | 'dc';

/** Automation toggle buttons, shown only for unlocked automation tactics. */
const AUTO_TOGGLES: { system: AutoSystem; label: string; hint: string }[] = [
  { system: 'escortInterceptor', label: 'ESC', hint: 'Escort automatic engagement' },
  { system: 'baseInterceptor', label: 'BASE', hint: 'Shore-base automatic engagement' },
  { system: 'mcmDrones', label: 'MCM', hint: 'Automatic mine clearance' },
  { system: 'depthCharges', label: 'ASW', hint: 'Automatic depth-charge drop' },
  { system: 'deckGun', label: 'GUN', hint: 'Automatic deck-gun engagement' },
];

/** Cycle order for the HUD targeting-priority toggle. */
const TARGET_PRIORITY_ORDER: TargetPriority[] = ['proximity', 'protectShips', 'threat'];
const TARGET_PRIORITY_LABEL: Record<TargetPriority, string> = {
  proximity: 'NEAR',
  protectShips: 'SHIPS',
  threat: 'THREAT',
};
const TARGET_PRIORITY_HINT: Record<TargetPriority, string> = {
  proximity: 'Targeting: nearest missile first',
  protectShips: 'Targeting: missiles aimed at ships first, batteries last',
  threat: 'Targeting: guided (advanced) missiles first',
};

const CANVAS_W = 1280;
const CANVAS_H = 720;
/** Pointer travel (canvas px) beyond which a press is a DRAG, not a tap. Below
 *  it the gesture issues an order; above it, it pans the map. */
const DRAG_THRESHOLD = 7;

/** Colour per escort activity — the same coding in the roster panel and on the
 *  map label, so a glance at either reads the same. */
const ACTIVITY_COLORS: Record<string, string> = {
  escorting: '#9fe0ff',
  recovering: '#f0be5c',
  rescuing: '#7ee0d6',
  engaging: '#ff9e6e',
  moving: '#9fe0ff',
  holding: '#8fe0a8',
  lost: '#8a9099',
};
/** Tap tolerance in canvas pixels — converted to world units through the
 *  camera, so the target you can hit stays the same size on screen at any
 *  zoom level. */
const TAP_RADIUS_PX = 27;
/** Tap tolerance for things a tap ATTACKS — missiles, attack boats, charted
 *  mines. Deliberately larger than the map tolerance above, because the two
 *  kinds of near-miss are not equally bad. Missing the map costs nothing; a
 *  tap aimed at a missile that lands a few pixels wide falls through to the
 *  move-order branch and sends the selected escort across the screen, so the
 *  player loses the shot AND has to sail their ship back. These are also small,
 *  fast, often-overlapping targets under a fingertip that hides them. */
const THREAT_TAP_RADIUS_PX = 46;
/** Second tap within this long (ms) counts as a double-tap → station the escort
 *  (pause it). A lone tap after the window sends it and it resumes forward. */

const SHIP_COLORS: Record<string, string> = {
  cargo: '#6fb1e0',
  tanker: '#f0a35e',
  freighter: '#8de08a',
};

interface VisualEffect {
  kind: 'explosion' | 'splash' | 'scan' | 'intercept';
  x: number;
  y: number;
  start: number;
  duration: number;
  /** Radius in WORLD units; scaled by the camera when drawn. */
  maxRadius: number;
}

export class TransitView {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly hudTop: HTMLElement;
  private readonly hudBottom: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly elements: HTMLElement[] = [];

  private pending: TransitCommand[] = [];
  private paused = false;
  private speed = 1;
  private acc = 0;
  private lastNow = 0;
  private destroyed = false;
  private doneAt = 0;
  private lastEventIndex = 0;
  private toastTimer: number | undefined;
  private effects: VisualEffect[] = [];
  private trails = new Map<number, { x: number; y: number }[]>();
  private threatWasAlive = new Map<number, { x: number; y: number }>();
  private escortDeaths = new Set<number>();
  private tutorialTip: HTMLElement | null = null;
  private tutorialDismissed = false;
  /** The escort the player has tapped to command (null = none). */
  private selectedEscort: number | null = null;
  /** The map camera (zoom / pan / smoothing). */
  private readonly camera = new Camera(
    { width: WORLD.width, height: WORLD.height },
    { width: CANVAS_W, height: CANVAS_H },
  );
  /** Live pointers, for drag-to-pan and pinch-zoom. */
  private readonly pointers = new Map<number, { x: number; y: number }>();
  /** The press in progress: where it started, and whether it has travelled far
   *  enough to be a drag. A press only issues an order if it never became one. */
  private press: { id: number; startX: number; startY: number; dragging: boolean } | null = null;
  /** Distance between the two pinch fingers on the previous move event. */
  private pinchDist = 0;
  /** Destination markers, kept briefly after an order so the player sees where
   *  they just sent a ship even once it has arrived. */
  private orderMarkers: { x: number; y: number; kind: string; at: number; escortId: number }[] = [];
  /** An armed placeable ability: the next map tap places it. */
  private armedAbility: ArmedAbility | null = null;
  /** The A-10 is aimed along a LINE, so arming it starts a two-part input
   *  rather than waiting for one tap. Either gesture works and both end here:
   *  tap-then-tap leaves the first point in `runStart` between taps, and a
   *  drag fills `runStart` on press and `runDrag` as the finger moves. World
   *  coordinates, so the line stays put if the camera moves under it. */
  private runStart: { x: number; y: number } | null = null;
  private runDrag: { x: number; y: number } | null = null;
  /** Depth-charge shot ids whose detonation blast has been drawn. */
  private dcDetonationsSeen = new Set<number>();
  /** Which threat a tap on a cluster of missiles resolves to. A player
   *  preference, persisted on the campaign (see onTargetPriorityChange). */
  private targetPriority: TargetPriority;

  // HUD elements updated per-frame. The top rail is a row of LCD readout
  // chips (label + value) rather than one long text string, so the vital
  // numbers stay scannable on a phone.
  private hudDelivered!: HTMLElement;
  private hudLost!: HTMLElement;
  private hudLostChip!: HTMLElement;
  private hudQuota!: HTMLElement;
  private hudInt!: HTMLElement;
  private hudDrones!: HTMLElement;
  private hudDronesChip!: HTMLElement;
  private hudDc!: HTMLElement;
  private hudDcChip!: HTMLElement;
  private selInfo!: HTMLElement;
  /** The escort roster: one row per ship, showing name, status and damage.
   *  This is the panel that answers "why is that one sitting there". */
  private escortPanel!: HTMLElement;
  private readonly escortRows = new Map<number, { row: HTMLElement; name: HTMLElement; status: HTMLElement; bar: HTMLElement }>();
  private centreBtn!: HTMLButtonElement;
  private zoomInBtn!: HTMLButtonElement;
  private zoomOutBtn!: HTMLButtonElement;
  private warthogBtn!: HTMLButtonElement;
  private scanBtn!: HTMLButtonElement;
  private sonarBtn!: HTMLButtonElement;
  private smokeBtn!: HTMLButtonElement;
  private rebootBtn!: HTMLButtonElement;
  private dcBtn!: HTMLButtonElement;
  private targetBtn!: HTMLButtonElement;
  private pauseBtn!: HTMLButtonElement;
  private speedBtn!: HTMLButtonElement;
  private autoBtns = new Map<AutoSystem, HTMLButtonElement>();

  constructor(
    stage: HTMLElement,
    private readonly state: TransitState,
    private readonly rng: RNG,
    private readonly round: number,
    private readonly confidence: number,
    private readonly showTutorial: boolean,
    /** Cargo points already banked toward the active quota window BEFORE this
     *  transit (i.e. campaign.quota.pointsEarned at round start). The live HUD
     *  figure is this plus the round's own valueDelivered so far. */
    private readonly quotaEarnedBefore: number,
    private readonly quotaNeeded: number,
    initialTargetPriority: TargetPriority,
    /** Called whenever the player cycles the targeting-priority toggle, so the
     *  host can persist the choice on the campaign (it isn't sim state). */
    private readonly onTargetPriorityChange: (p: TargetPriority) => void,
    private readonly onDone: (t: TransitState) => void,
  ) {
    this.targetPriority = initialTargetPriority;
    this.canvas = h('canvas', { attrs: { id: 'game-canvas' } });
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.ctx = this.canvas.getContext('2d')!;
    // The CRT glass: scanlines + vignette over the tactical display. Purely
    // cosmetic, never takes input.
    const crt = h('div', { attrs: { id: 'crt-overlay', 'aria-hidden': 'true' } });
    this.hudTop = h('div', { attrs: { id: 'hud-top' } });
    this.hudBottom = h('div', { attrs: { id: 'hud-bottom' } });
    this.toast = h('div', { attrs: { id: 'toast' } });
    this.buildHud();
    this.elements.push(this.canvas, crt, this.hudTop, this.hudBottom, this.toast);
    for (const el of this.elements) stage.append(el);

    if (this.showTutorial) {
      this.tutorialTip = h('div', {
        className: 'tutorial-tip',
        text: 'Tap an incoming missile to launch an interceptor',
        // Tapping the tip itself dismisses it.
        onClick: () => this.dismissTutorial(),
      });
      stage.append(this.tutorialTip);
      this.elements.push(this.tutorialTip);
    }

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    // Open on the convoy, and keep it framed until the player takes the wheel.
    //
    // The camera used to start centred on the world, which was the same thing
    // as centring on the convoy back when the whole strait fitted on screen.
    // It does not any more: the map is twice as wide and the widest view shows
    // about half of it, so a world-centred camera opens on empty water with the
    // convoy still off the left-hand edge, and the round begins with the player
    // hunting for their own ships. Following is also simply the right default —
    // it is what the Centre Convoy button does, and any pan or pinch releases
    // it immediately.
    const opening = this.convoyCentre();
    this.camera.follow(opening.x, opening.y);
    this.lastNow = performance.now();
    requestAnimationFrame(this.frame);
  }

  // -------------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------------

  /** An LCD readout chip: tiny label + live value. */
  private static chip(label: string, cls = ''): { el: HTMLElement; val: HTMLElement } {
    const val = h('span');
    const el = h('span', { className: cls ? `hud-chip ${cls}` : 'hud-chip' }, [
      h('span', { className: 'hud-chip-label', text: label }),
      val,
    ]);
    return { el, val };
  }

  private buildHud(): void {
    const round = TransitView.chip('RND');
    round.val.textContent = `${this.round}`;
    const conf = TransitView.chip('CONF', this.confidence <= 25 ? 'warn' : '');
    conf.val.textContent = `${this.confidence}`;
    const delivered = TransitView.chip('DEL');
    this.hudDelivered = delivered.val;
    const lost = TransitView.chip('LOST', 'bad');
    this.hudLost = lost.val;
    this.hudLostChip = lost.el;
    const int = TransitView.chip('INT');
    this.hudInt = int.val;
    const drones = TransitView.chip('DRN');
    this.hudDrones = drones.val;
    this.hudDronesChip = drones.el;
    const dc = TransitView.chip('DC');
    this.hudDc = dc.val;
    this.hudDcChip = dc.el;
    this.hudQuota = h('span', { className: 'hud-quota', attrs: { title: 'Active delivery quota' } });
    this.selInfo = h('span', { attrs: { id: 'sel-info' } });
    this.hudTop.append(
      round.el,
      delivered.el,
      lost.el,
      conf.el,
      this.hudQuota,
      h('span', { className: 'spacer' }),
      this.selInfo,
      int.el,
      drones.el,
      dc.el,
    );

    this.warthogBtn = h('button', {
      className: 'hud-btn',
      onClick: () => this.armAbility('warthog'),
    });
    this.scanBtn = h('button', {
      className: 'hud-btn',
      onClick: () => this.armAbility('scan'),
    });
    this.sonarBtn = h('button', {
      className: 'hud-btn',
      onClick: () => this.armAbility('sonar'),
    });
    this.smokeBtn = h('button', {
      className: 'hud-btn',
      onClick: () => this.armAbility('smoke'),
    });
    this.dcBtn = h('button', {
      className: 'hud-btn',
      onClick: () => this.armAbility('dc'),
    });
    this.rebootBtn = h('button', {
      className: 'hud-btn',
      onClick: () => this.queue({ type: 'reboot' }),
    });
    this.targetBtn = h('button', {
      className: 'hud-btn',
      onClick: () => this.cycleTargetPriority(),
    });

    this.pauseBtn = h('button', {
      className: 'hud-btn',
      text: 'II',
      onClick: () => {
        this.paused = !this.paused;
        this.pauseBtn.textContent = this.paused ? '▶' : 'II';
      },
    });
    this.speedBtn = h('button', {
      className: 'hud-btn',
      text: '1×',
      onClick: () => {
        this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1;
        this.speedBtn.textContent = `${this.speed}×`;
      },
    });

    // Automation toggles — only for automation tactics actually researched.
    // Disabling automation NEVER removes manual fire (the sim guarantees it).
    const autoGroup = h('div', { className: 'hud-group' });
    const fx = this.state.effects;
    const autoAvailable: Partial<Record<AutoSystem, boolean>> = {
      escortInterceptor: fx.escort.autoUnlocked && this.state.escorts.length > 0,
      baseInterceptor: fx.base.autoUnlocked && this.state.bases.length > 0,
      mcmDrones: fx.mcm.autoUnlocked && fx.sweepDrones,
      depthCharges: fx.depthCharge.autoUnlocked && this.state.escortModules.includes('depthCharges'),
      deckGun: fx.deckGun.autoNearest && this.state.escortModules.includes('deckGun'),
    };
    for (const toggle of AUTO_TOGGLES) {
      if (!autoAvailable[toggle.system]) continue;
      const btn = h('button', {
        className: 'hud-btn auto-btn',
        onClick: () => {
          const enabled = !this.state.autoFire[toggle.system];
          this.queue({ type: 'toggleAuto', system: toggle.system, enabled });
          this.showToast(`${toggle.hint}: ${enabled ? 'ON' : 'OFF'}`);
        },
      });
      btn.title = `${toggle.hint} — tap to toggle. Manual fire is never disabled.`;
      this.autoBtns.set(toggle.system, btn);
      autoGroup.append(btn);
    }

    // Camera controls. Zooming in to work an escort and back out to read the
    // battle is a core loop now, so it gets first-class buttons rather than
    // relying on a wheel the player may not have.
    this.zoomOutBtn = h('button', {
      className: 'hud-btn',
      text: '－',
      onClick: () => this.camera.zoomBy(1 / 1.35, CANVAS_W / 2, CANVAS_H / 2),
    });
    this.zoomOutBtn.title = 'Zoom out (mouse wheel / pinch)';
    this.zoomInBtn = h('button', {
      className: 'hud-btn',
      text: '＋',
      onClick: () => this.camera.zoomBy(1.35, CANVAS_W / 2, CANVAS_H / 2),
    });
    this.zoomInBtn.title = 'Zoom in (mouse wheel / pinch)';
    this.centreBtn = h('button', {
      className: 'hud-btn',
      text: 'CONVOY',
      onClick: () => {
        const c = this.convoyCentre();
        if (this.camera.isFollowing()) {
          // Second press releases the camera and shows the whole strait again.
          this.camera.resetToFit();
          this.showToast('Camera released — whole strait in view');
        } else {
          this.camera.follow(c.x, c.y);
          this.showToast('Camera centred on the convoy');
        }
      },
    });
    this.centreBtn.title = 'Centre the camera on the convoy (press again to view the whole strait)';

    this.hudBottom.append(
      this.warthogBtn,
      this.scanBtn,
      this.sonarBtn,
      this.smokeBtn,
      this.dcBtn,
      this.rebootBtn,
      this.targetBtn,
      autoGroup,
      h('span', { className: 'spacer' }),
      h('div', { className: 'hud-group' }, [this.zoomOutBtn, this.zoomInBtn, this.centreBtn]),
      h('div', { className: 'hud-group' }, [this.pauseBtn, this.speedBtn]),
    );

    // The escort roster. Every ship, always visible, always saying what it is
    // doing — so the player never has to hunt the map to find out why one is
    // sitting still. Tapping a row selects that escort and brings the camera
    // to her, which is the fastest way to take command of a specific ship.
    this.escortPanel = h('div', { attrs: { id: 'escort-panel' } });
    this.elements.push(this.escortPanel);
  }

  /** Centre of the live convoy — what the camera follows and what "return to
   *  escort duty" aims at. Falls back to the escorts, then the map centre. */
  private convoyCentre(): { x: number; y: number } {
    const ships = this.state.ships.filter((s) => s.alive && !s.delivered && s.spawned);
    const pool: { x: number; y: number }[] = ships.length > 0
      ? ships
      : this.state.escorts.filter((e) => e.alive);
    if (pool.length === 0) return { x: WORLD.width / 2, y: WORLD.height / 2 };
    return {
      x: pool.reduce((sum, p) => sum + p.x, 0) / pool.length,
      y: pool.reduce((sum, p) => sum + p.y, 0) / pool.length,
    };
  }

  /** Rebuild the escort roster rows in place (only when the flotilla changes)
   *  and refresh their live text every frame. */
  private updateEscortPanel(): void {
    const alive = this.state.escorts.filter((e) => e.alive);
    // Drop rows for escorts that have been lost.
    for (const [id, entry] of this.escortRows) {
      if (!alive.some((e) => e.id === id)) {
        entry.row.remove();
        this.escortRows.delete(id);
      }
    }
    for (const escort of alive) {
      let entry = this.escortRows.get(escort.id);
      if (!entry) {
        const name = h('span', { className: 'escort-name' });
        const status = h('span', { className: 'escort-status' });
        const bar = h('div', { className: 'escort-hp-fill' });
        const row = h('div', {
          className: 'escort-row',
          onClick: () => {
            this.selectedEscort = this.selectedEscort === escort.id ? null : escort.id;
            if (this.selectedEscort !== null) this.camera.centreOn(escort.x, escort.y);
          },
        }, [
          h('div', { className: 'escort-row-head' }, [name, status]),
          h('div', { className: 'escort-hp' }, [bar]),
        ]);
        entry = { row, name, status, bar };
        this.escortRows.set(escort.id, entry);
        this.escortPanel.append(row);
      }
      const st = escortStatus(this.state, escort);
      entry.name.textContent = escort.name;
      entry.status.textContent =
        st.progress !== null ? `${st.label} ${Math.round(st.progress * 100)}%` : st.label;
      entry.row.className = `escort-row${this.selectedEscort === escort.id ? ' selected' : ''}`;
      entry.row.setAttribute('data-activity', st.activity);
      const frac = Math.max(0, escort.hp / escort.maxHp);
      entry.bar.style.width = `${frac * 100}%`;
      entry.bar.className = `escort-hp-fill${frac > 0.5 ? '' : frac > 0.25 ? ' warn' : ' bad'}`;
    }
  }

  /** Cycle Proximity → Protect Ships → Threat Level → Proximity, and let the
   *  host persist the choice (it's a player preference, not sim state). */
  private cycleTargetPriority(): void {
    const i = TARGET_PRIORITY_ORDER.indexOf(this.targetPriority);
    this.targetPriority = TARGET_PRIORITY_ORDER[(i + 1) % TARGET_PRIORITY_ORDER.length];
    this.onTargetPriorityChange(this.targetPriority);
    this.showToast(TARGET_PRIORITY_HINT[this.targetPriority]);
  }

  private updateHud(): void {
    const s = this.state.stats;
    this.hudDelivered.textContent = `${s.delivered}/${s.launched}`;
    this.hudLostChip.classList.toggle('hidden', s.lost === 0);
    this.hudLost.textContent = `${s.lost}`;

    // Live quota: cargo points already banked this window PLUS this round's
    // delivered value so far, so the player watches the active quota climb
    // ship by ship as the convoy crosses.
    const quotaLive = this.quotaEarnedBefore + s.valueDelivered;
    this.hudQuota.textContent = `QUOTA ${quotaLive}/${this.quotaNeeded}`;
    this.hudQuota.classList.toggle('quota-met', quotaLive >= this.quotaNeeded);
    const t = this.state;
    const dcEquipped = t.escortModules.includes('depthCharges');
    const dcReady = t.escorts.filter((e) => e.alive && e.dcShots > 0 && e.dcCooldown <= 0).length;
    this.hudInt.textContent = `${t.ammo}`;
    this.hudDronesChip.classList.toggle('hidden', !t.effects.sweepDrones);
    this.hudDrones.textContent = `${t.droneAmmo}`;
    this.hudDcChip.classList.toggle('hidden', !dcEquipped);
    this.hudDc.textContent = `${dcReady}`;

    // Clear the escort selection if that escort is gone or was destroyed.
    if (
      this.selectedEscort !== null &&
      !t.escorts.some((e) => e.id === this.selectedEscort && e.alive)
    ) {
      this.selectedEscort = null;
    }
    const armedHints: Record<ArmedAbility, string> = {
      scan: 'Tap a lane to send the scan plane down it',
      warthog:
        'Drag the A-10\u2019s run-in line over open water, or tap its two ends — it guns what lies ahead of it, then comes back the other way',
      sonar: 'Tap the water to place the active sonar ping',
      smoke: 'Tap the water to lay the defensive smoke',
      dc: 'Tap a point in the WATER — the nearest ready escort lobs depth charges there',
    };
    const selected = t.escorts.find((e) => e.id === this.selectedEscort && e.alive);
    this.selInfo.textContent = this.armedAbility
      ? armedHints[this.armedAbility]
      : selected
        ? `${selected.name} — tap water to move · wreck/crew to work it · convoy to rejoin`
        : t.jammingSeconds > 0
          ? `⚠ SENSOR JAMMING — ${Math.ceil(t.jammingSeconds)}s`
          : '';
    this.selInfo.classList.toggle('escort-selected', !!selected && !this.armedAbility);

    this.updateEscortPanel();
    this.centreBtn.classList.toggle('armed', this.camera.isFollowing());
    this.zoomInBtn.disabled = this.camera.zoom >= this.camera.maxZoom() - 1e-4;
    this.zoomOutBtn.disabled = this.camera.isFitted();

    this.targetBtn.innerHTML = `TARGET<span class="charges">${TARGET_PRIORITY_LABEL[this.targetPriority]}</span>`;
    this.targetBtn.title = TARGET_PRIORITY_HINT[this.targetPriority];

    const warthogActive = t.time < t.warthogActiveUntil;
    this.warthogBtn.innerHTML = `A-10<span class="charges">${
      warthogActive ? 'ON TASK' : `×${t.warthogCharges}`
    }</span>`;
    this.warthogBtn.disabled = t.warthogCharges <= 0 && !warthogActive;
    this.warthogBtn.classList.toggle('off', t.warthogCharges <= 0 && !warthogActive);
    this.warthogBtn.classList.toggle('armed', this.armedAbility === 'warthog');
    this.warthogBtn.classList.toggle(
      'hidden',
      t.warthogCharges <= 0 && !warthogActive && t.stats.counter.charges.warthog.available === 0,
    );

    this.scanBtn.innerHTML = `SCAN<span class="charges">×${t.scanCharges}</span>`;
    this.scanBtn.disabled = t.scanCharges <= 0;
    this.scanBtn.classList.toggle('off', t.scanCharges <= 0);
    this.scanBtn.classList.toggle('armed', this.armedAbility === 'scan');
    this.scanBtn.classList.toggle('hidden', t.scanCharges <= 0 && t.stats.counter.charges.scan.available === 0);

    this.sonarBtn.innerHTML = `PING<span class="charges">×${t.sonarCharges}</span>`;
    this.sonarBtn.disabled = t.sonarCharges <= 0;
    this.sonarBtn.classList.toggle('off', t.sonarCharges <= 0);
    this.sonarBtn.classList.toggle('armed', this.armedAbility === 'sonar');
    this.sonarBtn.classList.toggle('hidden', t.stats.counter.charges.sonar.available === 0);

    this.smokeBtn.innerHTML = `SMOKE<span class="charges">×${t.smokeCharges}</span>`;
    this.smokeBtn.disabled = t.smokeCharges <= 0;
    this.smokeBtn.classList.toggle('off', t.smokeCharges <= 0);
    this.smokeBtn.classList.toggle('armed', this.armedAbility === 'smoke');
    this.smokeBtn.classList.toggle('hidden', t.stats.counter.charges.smoke.available === 0);

    this.rebootBtn.innerHTML = `RBT<span class="charges">×${t.rebootCharges}</span>`;
    this.rebootBtn.disabled = t.rebootCharges <= 0 || t.jammingSeconds <= 0;
    this.rebootBtn.classList.toggle('hidden', t.stats.counter.charges.reboot.available === 0);
    this.rebootBtn.title = 'Emergency reboot — shortens an active sensor-jamming blackout';

    this.dcBtn.innerHTML = `DC<span class="charges">×${dcReady}</span>`;
    this.dcBtn.disabled = dcReady <= 0;
    this.dcBtn.classList.toggle('off', dcReady <= 0);
    this.dcBtn.classList.toggle('armed', this.armedAbility === 'dc');
    this.dcBtn.classList.toggle('hidden', !dcEquipped);
    this.dcBtn.title = 'Depth charges — arm, then tap a point in the water (torpedoes only)';

    // Automation toggle states: launcher reload and the SEPARATE auto-fire
    // cooldown are both visible so automation is never hidden behavior.
    for (const [system, btn] of this.autoBtns) {
      const on = t.autoFire[system];
      btn.innerHTML = `${AUTO_TOGGLES.find((a) => a.system === system)?.label}<span class="charges">${on ? 'AUTO' : 'MAN'}</span>`;
      btn.classList.toggle('off', !on);
    }
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  private queue(cmd: TransitCommand): void {
    if (this.state.over || this.paused) return;
    // Ability placements must not stack: two in one frame would burn two charges.
    if (cmd.type === 'ability') {
      if (this.pending.some((p) => p.type === 'ability' && p.ability === cmd.ability)) return;
      if (cmd.ability === 'warthog' && this.state.time < this.state.warthogActiveUntil) return;
    }
    this.pending.push(cmd);
  }

  /** Arm (or disarm) a placeable ability/weapon. The next map tap places it. */
  private armAbility(ability: ArmedAbility): void {
    if (this.state.over || this.paused) return;
    if (
      ability === 'warthog' &&
      (this.state.warthogCharges <= 0 || this.state.time < this.state.warthogActiveUntil)
    ) {
      return;
    }
    if (ability === 'scan' && this.state.scanCharges <= 0) return;
    if (ability === 'sonar' && this.state.sonarCharges <= 0) return;
    if (ability === 'smoke' && this.state.smokeCharges <= 0) return;
    if (
      ability === 'dc' &&
      !this.state.escorts.some((e) => e.alive && e.dcShots > 0 && e.dcCooldown <= 0)
    ) {
      return;
    }
    this.armedAbility = this.armedAbility === ability ? null : ability; // toggle
    // A half-drawn run belongs to the arming that started it.
    this.runStart = null;
    this.runDrag = null;
  }

  /** Canvas-space coordinates for a pointer event (the canvas is letterboxed
   *  and scaled by CSS, so client pixels are not canvas pixels). */
  private canvasPoint(ev: PointerEvent | WheelEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((ev.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  }

  private onPointerDown = (ev: PointerEvent): void => {
    ev.preventDefault(); // keep taps from starting scroll/zoom gestures on iOS
    this.canvas.setPointerCapture?.(ev.pointerId);
    const p = this.canvasPoint(ev);
    this.pointers.set(ev.pointerId, p);
    if (this.pointers.size === 2) {
      // Second finger down: this is a pinch, not a tap. Abandon the press.
      const [a, b] = [...this.pointers.values()];
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.press = null;
      return;
    }
    this.press = { id: ev.pointerId, startX: p.x, startY: p.y, dragging: false };
    // With the A-10 armed and no first point yet, this press may become the
    // start of a dragged run line. (If it turns out to be a tap, handleTap
    // takes it instead — the two gestures share the same first point.)
    if (this.armedAbility === 'warthog' && !this.runStart) {
      this.runDrag = null;
    }
  };

  private onPointerMove = (ev: PointerEvent): void => {
    if (!this.pointers.has(ev.pointerId)) return;
    const p = this.canvasPoint(ev);
    const prev = this.pointers.get(ev.pointerId)!;
    this.pointers.set(ev.pointerId, p);

    // Two fingers: pinch to zoom about the midpoint between them.
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchDist > 0 && d > 0) {
        this.camera.zoomBy(d / this.pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      this.pinchDist = d;
      return;
    }

    if (!this.press || this.press.id !== ev.pointerId) return;
    const travelled = Math.hypot(p.x - this.press.startX, p.y - this.press.startY);
    if (!this.press.dragging && travelled > DRAG_THRESHOLD) this.press.dragging = true;
    if (!this.press.dragging) return;
    // With the A-10 armed, a drag DRAWS THE RUN rather than panning: the line
    // is the weapon, so the most natural gesture for it has to be the one that
    // aims it. Panning is still available by disarming.
    if (this.armedAbility === 'warthog') {
      const from = this.runStart ?? {
        x: this.camera.screenToWorldX(this.press.startX),
        y: this.camera.screenToWorldY(this.press.startY),
      };
      this.runStart = from;
      this.runDrag = {
        x: this.camera.screenToWorldX(p.x),
        y: this.camera.screenToWorldY(p.y),
      };
      return;
    }
    // Otherwise a drag pans the map — the press will not issue an order.
    this.camera.panByScreen(p.x - prev.x, p.y - prev.y);
  };

  private onPointerUp = (ev: PointerEvent): void => {
    const p = this.pointers.get(ev.pointerId);
    this.pointers.delete(ev.pointerId);
    if (this.pointers.size < 2) this.pinchDist = 0;
    if (!this.press || this.press.id !== ev.pointerId) return;
    const wasDrag = this.press.dragging;
    this.press = null;
    // A dragged A-10 run is complete on release — that gesture IS the order.
    if (wasDrag && this.armedAbility === 'warthog' && this.runStart && this.runDrag) {
      this.commitWarthogRun(this.runStart, this.runDrag);
      return;
    }
    // Any other drag moved the camera; it was never an order.
    if (wasDrag || !p) return;
    this.handleTap(p.x, p.y);
  };

  private onWheel = (ev: WheelEvent): void => {
    ev.preventDefault();
    const p = this.canvasPoint(ev);
    // Normalise across deltaMode (pixel / line / page) so a notch is a notch.
    const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? CANVAS_H : 1;
    this.camera.zoomBy(Math.exp((-ev.deltaY * unit) / 400), p.x, p.y);
  };

  /** Send the A-10 down the line the player drew, and clear the input state.
   *  Both gestures (tap-then-tap, and drag) funnel through here so the sim only
   *  ever sees one shape of order. The sim validates water and minimum length
   *  and reports back through the normal event channel, so this does not
   *  second-guess it — it just stops arming for a run that was never sent. */
  private commitWarthogRun(a: { x: number; y: number }, b: { x: number; y: number }): void {
    this.runStart = null;
    this.runDrag = null;
    this.armedAbility = null;
    this.queue({ type: 'ability', ability: 'warthog', x: a.x, y: a.y, x2: b.x, y2: b.y });
  }

  /** A tap that was not a drag: resolve it to an action. */
  private handleTap(cx: number, cy: number): void {
    if (this.paused || this.state.over) return;
    const wx = this.camera.screenToWorldX(cx);
    const wy = this.camera.screenToWorldY(cy);

    // 0) If an ability/weapon is armed, this tap places it where the player
    //    touched. Scan: the Y picks a lane. A-10: the jet takes station on the
    //    water. Sonar/smoke: a placed area effect. DC: the nearest ready escort
    //    lobs depth charges at the point (an AREA attack — never a lock-on).
    if (this.armedAbility) {
      const ability = this.armedAbility;
      // The A-10 needs a LINE, so it takes two taps: the first marks where the
      // run begins, the second where it ends. (Dragging does the same thing in
      // one gesture — see onPointerMove.) Nothing is spent until the second
      // point lands, so a misplaced first tap costs only another tap.
      if (ability === 'warthog') {
        if (!this.runStart) {
          this.runStart = { x: wx, y: wy };
          this.runDrag = null;
          this.showToast('Run-in start marked — tap where the pass should end');
          return;
        }
        this.commitWarthogRun(this.runStart, { x: wx, y: wy });
        return;
      }
      if (ability === 'dc') {
        this.queue({ type: 'depthCharge', x: wx, y: wy });
      } else {
        this.queue({ type: 'ability', ability, x: wx, y: wy });
      }
      this.armedAbility = null;
      return;
    }

    // Tap tolerance is a constant number of SCREEN pixels, converted to world
    // units through the camera — so what the player can hit stays the same
    // size under their finger however far they have zoomed in or out.
    const tapRadius = TAP_RADIUS_PX * this.camera.worldPerPixel();
    const threatTapRadius = THREAT_TAP_RADIUS_PX * this.camera.worldPerPixel();

    // 1) A tap near an incoming missile fires an interceptor at it. When several
    //    missiles are bunched under one tap, which one wins depends on the
    //    HUD targeting-priority toggle:
    //     - proximity:    nearest wins.
    //     - protectShips: a missile aimed at a ship/escort always outranks one
    //       aimed at a shore battery.
    //     - threat:       a guided (advanced) missile always outranks an
    //       unguided one.
    //    In every mode a threat with no interceptor already inbound still
    //    beats one that already has a shot on the way (so a tap defaults to a
    //    fresh target instead of doubling up — doubling up is still possible
    //    by tapping the same one again).
    const inbound = new Set(
      this.state.interceptors
        .filter((i) => i.launcher !== 'pd' && i.launcher !== 'flak')
        .map((i) => i.targetThreatId),
    );
    let bestThreat: Threat | null = null;
    let bestThreatKey = Infinity;
    for (const threat of this.state.threats) {
      // Interceptor taps resolve to MISSILES only — torpedoes, mines and boats
      // have their own interactions (the sim would reject them anyway).
      if (!threat.alive || (threat.kind !== 'missile' && threat.kind !== 'guidedMissile')) continue;
      const d = Math.hypot(threat.x - wx, threat.y - wy);
      if (d >= threatTapRadius) continue;
      const claimedBand = inbound.has(threat.id) ? 1 : 0;
      let modeBand = 0;
      if (this.targetPriority === 'protectShips') {
        modeBand = threat.targetKind === 'base' ? 2 : 0;
      } else if (this.targetPriority === 'threat') {
        modeBand = threat.kind === 'guidedMissile' ? 0 : 2;
      }
      // Band dominates (each unit is worth a full tapRadius, always bigger
      // than any in-radius distance); distance only breaks ties within a band.
      const key = (modeBand + claimedBand) * threatTapRadius + d;
      if (key < bestThreatKey) {
        bestThreatKey = key;
        bestThreat = threat;
      }
    }
    if (bestThreat) {
      this.queue({ type: 'intercept', threatId: bestThreat.id });
      this.dismissTutorial();
      return;
    }

    // 1b) A tap on an attack boat commits a deck gun to it (sustained fire).
    if (this.state.escortModules.includes('deckGun')) {
      let bestBoat: Threat | null = null;
      let bestBoatD = threatTapRadius;
      for (const threat of this.state.threats) {
        if (!threat.alive || threat.kind !== 'attackBoat') continue;
        const d = Math.hypot(threat.x - wx, threat.y - wy);
        if (d < bestBoatD) {
          bestBoat = threat;
          bestBoatD = d;
        }
      }
      if (bestBoat) {
        this.queue({ type: 'engageBoat', threatId: bestBoat.id });
        return;
      }
    }

    // 2) With minesweeping researched, a tap on a charted mine sends a drone from
    //    the nearest in-range escort (the sim validates range / munitions).
    if (this.state.effects.sweepDrones) {
      let bestMine: Threat | null = null;
      let bestMineD = threatTapRadius;
      for (const mine of this.state.threats) {
        if (mine.kind !== 'mine' || !mine.alive || !mine.revealed) continue;
        if (this.state.drones.some((dr) => dr.targetMineId === mine.id)) continue; // already swept
        const d = Math.hypot(mine.x - wx, mine.y - wy);
        if (d < bestMineD) {
          bestMine = mine;
          bestMineD = d;
        }
      }
      if (bestMine) {
        this.queue({ type: 'sweepMine', threatId: bestMine.id });
        return;
      }
    }

    // 3) A tap near a living escort selects it. Selection PERSISTS: it survives
    //    issuing orders, so a player can work one ship through several moves
    //    without re-finding it. Tapping the selected escort again releases it.
    let bestEscort: number | null = null;
    let bestEscortD = tapRadius * 1.4; // escorts are small; be generous
    for (const escort of this.state.escorts) {
      if (!escort.alive) continue;
      const d = Math.hypot(escort.x - wx, escort.y - wy);
      if (d < bestEscortD) {
        bestEscort = escort.id;
        bestEscortD = d;
      }
    }
    if (bestEscort !== null) {
      const escort = this.state.escorts.find((e) => e.id === bestEscort);
      this.selectedEscort = this.selectedEscort === bestEscort ? null : bestEscort;
      if (this.selectedEscort !== null && escort) {
        this.showToast(`${escort.name} selected — tap the map to give her orders`);
      }
      this.dismissTutorial();
      return;
    }

    // 4) With an escort selected, a tap on the map is an ORDER — and what the
    //    player tapped decides which one. Tapping the thing you want worked
    //    (a wreckage field, a crew in the water, the convoy) beats having to
    //    know that all of them are really "move here and hold".
    if (this.selectedEscort !== null) {
      const escortId = this.selectedEscort;
      const order = resolveEscortOrder(this.state, wx, wy, tapRadius);
      this.queue({ type: 'moveEscort', escortId, x: order.x, y: order.y, hold: order.hold });
      const escort = this.state.escorts.find((e) => e.id === escortId);
      this.showToast(`${escort?.name ?? 'Escort'} — ${order.message.toLowerCase()}`);
      this.orderMarkers.push({
        x: order.x,
        y: order.y,
        kind: order.kind,
        at: performance.now(),
        escortId,
      });
      this.dismissTutorial();
      return;
    }
  }

  private dismissTutorial(): void {
    if (this.tutorialDismissed || !this.tutorialTip) return;
    this.tutorialDismissed = true;
    this.tutorialTip.remove();
  }

  // -------------------------------------------------------------------------
  // Loop
  // -------------------------------------------------------------------------

  private frame = (now: number): void => {
    if (this.destroyed) return;
    const dtReal = Math.min(0.1, (now - this.lastNow) / 1000);
    this.lastNow = now;

    if (!this.paused && !this.state.over) {
      this.acc += dtReal * this.speed;
      while (this.acc >= SIM.dt) {
        stepTransit(this.state, this.pending, this.rng);
        this.pending = [];
        this.acc -= SIM.dt;
        if (this.state.over) break;
      }
    }

    // Camera: follow the convoy if asked, then ease toward the target. Done
    // every frame regardless of pause, so panning and zooming stay live while
    // the player is stopped and thinking.
    if (this.camera.isFollowing()) {
      const c = this.convoyCentre();
      this.camera.updateFollowTarget(c.x, c.y);
    }
    this.camera.update(dtReal);
    // Order markers fade out after a few seconds.
    this.orderMarkers = this.orderMarkers.filter((m) => now - m.at < 4000);

    this.processEvents(now);
    this.render(now);
    this.updateHud();

    if (this.state.over && this.doneAt === 0) this.doneAt = now + 1400;
    if (this.doneAt !== 0 && now >= this.doneAt) {
      const state = this.state;
      this.destroy();
      this.onDone(state);
      return;
    }
    requestAnimationFrame(this.frame);
  };

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    for (const el of this.elements) el.remove();
  }

  // -------------------------------------------------------------------------
  // Event → feedback
  // -------------------------------------------------------------------------

  private processEvents(now: number): void {
    const events = this.state.events;
    for (; this.lastEventIndex < events.length; this.lastEventIndex++) {
      const ev = events[this.lastEventIndex];
      switch (ev.type) {
        case 'launchFailed':
          this.showToast(ev.detail ?? 'Launch failed');
          break;
        case 'shipLost':
          this.showToast(
            ev.cause?.startsWith('escort:')
              ? 'Escort ship destroyed!'
              : ev.cause?.startsWith('base:')
                ? 'Shore battery destroyed!'
                : `${ev.shipName} lost!`,
          );
          break;
        case 'mineRevealed':
          this.showToast(ev.lowSig ? 'Low-signature mine detected!' : 'Mine detected ahead!');
          break;
        case 'torpedoDetected':
          this.showToast(
            ev.detail === 'activeSonar'
              ? 'Sonar ping: torpedo contact!'
              : ev.detail === 'wake'
                ? 'Wake sighted — torpedo closing!'
                : ev.lowSig
                  ? 'Hydrophone: low-signature torpedo!'
                  : 'Hydrophone: torpedo in the water!',
          );
          break;
        case 'depthChargeKill':
          this.showToast('Depth charges destroyed a torpedo');
          break;
        case 'enemySmoke':
          this.showToast(ev.detail === 'blinding' ? 'Blinding smoke over the convoy!' : 'Screening smoke laid');
          break;
        case 'jammingStarted':
          this.showToast('SENSORS JAMMED — mine detection is offline');
          break;
        case 'shipDisabled':
          this.showToast(`${ev.shipName} is dead in the water!`);
          break;
        case 'suppressed':
          this.showToast(
            ev.detail?.startsWith('destroyed:')
              ? 'Shore battery destroyed — silenced for the round'
              : 'Shore battery suppressed',
          );
          break;
        case 'boatSunk':
          this.showToast('Attack boat sunk');
          break;
        case 'boardingStarted':
          this.showToast(`Boarders on ${ev.shipName}! Sink that boat!`);
          break;
        case 'boardingRepelled':
          this.showToast(
            ev.detail === 'rejection'
              ? `${ev.shipName} threw the boarding party off — that was the last chance`
              : `Boarders driven off ${ev.shipName}`,
          );
          break;
        case 'flakKill':
          this.showToast('Flak downed an enemy aircraft');
          break;
        case 'wreckageSpawned':
          this.showToast('Recoverable wreckage in the water — hold an escort inside it');
          break;
        case 'wreckageRecovered':
          this.showToast('Wreckage recovered — it will shape tonight’s technology draft');
          break;
        case 'wreckageExpired':
          this.showToast('Wreckage sank before it could be recovered');
          break;
        case 'survivorsSpawned':
          this.showToast(`Survivors from ${ev.shipName ?? 'a lost ship'} in the water!`);
          break;
        case 'survivorsRescued':
          this.showToast(`${ev.shipName ?? 'The'} crew pulled from the water`);
          break;
        case 'survivorsLost':
          this.showToast(`${ev.shipName ?? 'A'} crew was lost to the water`);
          break;
        case 'techDebut':
          if (ev.detail === 'guidedMissile') this.showToast('Warning: missile is maneuvering!');
          else if (ev.detail === 'torpedo') this.showToast('Torpedo in the water — air defense cannot touch it!');
          else if (ev.detail === 'lowSigTorpedo') this.showToast('That torpedo left no wake at all!');
          else if (ev.detail === 'attackBoat') this.showToast('Attack boats closing — deck guns only!');
          else if (ev.detail === 'rocketBoat') this.showToast('Rocket boat — it will open a hull fast!');
          else if (ev.detail === 'boardingBoat') this.showToast('Boarding boat — they mean to take a ship!');
          else if (ev.detail === 'artillery') this.showToast('Shore guns! They only reach the near lane');
          else if (ev.detail === 'rangingArtillery') this.showToast('Heavy shore battery — do not hold position!');
          else if (ev.detail === 'rollingBarrage') this.showToast('Barrage walking up the lane ahead!');
          else if (ev.detail === 'screeningSmoke') this.showToast('Smoke over their launch sites — no firing solution in there');
          else if (ev.detail === 'blindingSmoke') this.showToast('They are laying smoke over OUR ships!');
          else if (ev.detail === 'reconPlane') this.showToast('Recon aircraft overhead — our accuracy is down');
          else if (ev.detail === 'disablingDrone') this.showToast('Disabling drone inbound!');
          else if (ev.detail === 'sensorJamming') this.showToast('SENSORS JAMMED — no mine detection');
          break;
        default:
          break;
      }
    }

    // Depth-charge detonations: one expanding blast ring per shot.
    for (const shot of this.state.depthChargeShots) {
      if (shot.detonated && !this.dcDetonationsSeen.has(shot.id)) {
        this.dcDetonationsSeen.add(shot.id);
        this.effects.push({
          kind: 'explosion',
          x: shot.targetX,
          y: shot.targetY,
          start: now,
          duration: 650,
          maxRadius: shot.blastRadius,
        });
      }
    }

    // Explosion effects: detect threats that died since last frame.
    for (const threat of this.state.threats) {
      const prev = this.threatWasAlive.get(threat.id);
      if (threat.alive) {
        this.threatWasAlive.set(threat.id, { x: threat.x, y: threat.y });
      } else if (prev) {
        this.threatWasAlive.delete(threat.id);
        this.trails.delete(threat.id);
        this.effects.push({
          kind: threat.kind === 'mine' ? 'explosion' : 'intercept',
          x: prev.x,
          y: prev.y,
          start: now,
          duration: 550,
          maxRadius: threat.kind === 'mine' ? 66 : 41,
        });
      }
    }
    // Ship deaths get bigger explosions.
    for (const ship of this.state.ships) {
      if (!ship.alive && !this.trails.has(-ship.id)) {
        this.trails.set(-ship.id, []); // sentinel so we only fire once
        this.effects.push({
          kind: 'explosion',
          x: ship.x,
          y: ship.y,
          start: now,
          duration: 800,
          maxRadius: 86,
        });
      }
    }
    // Escort deaths too (escort ids are distinct from ship ids).
    for (const escort of this.state.escorts) {
      if (!escort.alive && !this.escortDeaths.has(escort.id)) {
        this.escortDeaths.add(escort.id);
        this.effects.push({
          kind: 'explosion',
          x: escort.x,
          y: escort.y,
          start: now,
          duration: 800,
          maxRadius: 75,
        });
      }
    }
  }

  private showToast(message: string): void {
    this.toast.textContent = message;
    this.toast.classList.add('show');
    if (this.toastTimer !== undefined) clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('show'), 1900);
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  /** World → canvas. Everything drawn goes through these, so zoom and pan are
   *  a property of the camera rather than something each draw call handles. */
  // Positions for the WORLD layer, which is drawn under the camera's
  // magnification transform (see render). They carry the pan but not the zoom:
  // the transform supplies the zoom, which is how every sprite, ring and line
  // weight in the world gets bigger together when the player zooms in.
  private sx(wx: number): number {
    return this.camera.fitScreenX(wx);
  }

  private sy(wy: number): number {
    return this.camera.fitScreenY(wy);
  }

  /** True canvas position — for anything drawn OUTSIDE the world transform
   *  (edge markers, banners) and for hit-testing against the real screen. */
  private screenX(wx: number): number {
    return this.camera.worldToScreenX(wx);
  }

  private screenY(wy: number): number {
    return this.camera.worldToScreenY(wy);
  }

  /** Units → pixels for world-sized rings drawn inside the world transform.
   *  Fit scale, because the transform multiplies in the rest. */
  private get scale(): number {
    return this.camera.fitZoom();
  }

  private render(now: number): void {
    const ctx = this.ctx;
    const t = this.state;

    // Water. Drawn in plain canvas space — it is a full-screen backdrop with
    // nothing in the world to line up with.
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#0e2334');
    grad.addColorStop(1, '#0a1a2a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // --- The world layer -----------------------------------------------------
    // Everything from here to the matching restore() is drawn at FIT scale and
    // magnified by one canvas transform. That is the whole reason zooming in
    // makes a ship bigger: every pixel size below — hull lengths, mine spikes,
    // missile streaks, HP bars, line weights — is expressed once, at the fitted
    // view, and the transform does the rest. Previously only the handful of
    // things multiplied by `scale` responded to zoom, so zooming in moved the
    // world under a fixed-size stencil.
    const detail = this.camera.detailScale();
    ctx.save();
    ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
    ctx.scale(detail, detail);
    ctx.translate(-CANVAS_W / 2, -CANVAS_H / 2);

    // Hostile shore (top) and friendly shore (bottom)
    ctx.fillStyle = '#33222a';
    ctx.beginPath();
    ctx.moveTo(0, this.sy(0) - 60);
    for (let x = 0; x <= WORLD.width; x += 200) {
      ctx.lineTo(this.sx(x), this.sy(110 + 45 * Math.sin(x * 0.004)));
    }
    ctx.lineTo(CANVAS_W, this.sy(0) - 60);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#22301f';
    ctx.beginPath();
    ctx.moveTo(0, this.sy(WORLD.height) + 60);
    for (let x = 0; x <= WORLD.width; x += 200) {
      ctx.lineTo(this.sx(x), this.sy(WORLD.height - 100 - 40 * Math.sin(x * 0.003 + 2)));
    }
    ctx.lineTo(CANVAS_W, this.sy(WORLD.height) + 60);
    ctx.closePath();
    ctx.fill();

    // Launch sites
    ctx.fillStyle = '#7a3b45';
    for (const site of WORLD.launchSites) {
      ctx.beginPath();
      ctx.moveTo(this.sx(site.x), this.sy(site.y) + 10);
      ctx.lineTo(this.sx(site.x) - 8, this.sy(site.y) - 6);
      ctx.lineTo(this.sx(site.x) + 8, this.sy(site.y) - 6);
      ctx.closePath();
      ctx.fill();
    }

    // Shore batteries, and the water each one can actually reach. The reach
    // ring is the whole decision this branch asks the player to make, so it is
    // drawn rather than left to be inferred from where shells happen to land.
    for (const gun of t.installations) {
      const gx = this.sx(gun.x);
      const gy = this.sy(gun.y);
      const suppressed = t.time < gun.suppressedUntil;
      if (!gun.destroyed) {
        ctx.strokeStyle = suppressed ? 'rgba(120, 160, 200, 0.22)' : 'rgba(255, 138, 94, 0.30)';
        ctx.setLineDash([6, 9]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(gx, gy, COMBAT.artillery.range[gun.variant] * this.scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = gun.destroyed
        ? 'rgba(90, 96, 104, 0.65)'
        : suppressed
          ? '#6f7f92'
          : gun.variant === 'coastalGun'
            ? '#e0703c'
            : '#d8484f';
      ctx.beginPath();
      ctx.arc(gx, gy, gun.variant === 'coastalGun' ? 6 : 8, 0, Math.PI * 2);
      ctx.fill();
      if (gun.destroyed) {
        ctx.strokeStyle = 'rgba(220, 226, 232, 0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx - 6, gy - 6);
        ctx.lineTo(gx + 6, gy + 6);
        ctx.moveTo(gx + 6, gy - 6);
        ctx.lineTo(gx - 6, gy + 6);
        ctx.stroke();
      } else if (suppressed) {
        ctx.strokeStyle = 'rgba(140, 190, 240, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gx, gy, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Lane guides
    ctx.strokeStyle = 'rgba(120, 160, 200, 0.14)';
    ctx.setLineDash([14, 18]);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < WORLD.lanes.length; i++) {
      const y = this.sy(WORLD.lanes[i]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Exit zone
    const exitGrad = ctx.createLinearGradient(this.sx(WORLD.deliverX), 0, CANVAS_W, 0);
    exitGrad.addColorStop(0, 'rgba(89, 217, 140, 0.0)');
    exitGrad.addColorStop(1, 'rgba(89, 217, 140, 0.28)');
    ctx.fillStyle = exitGrad;
    ctx.fillRect(
      this.sx(WORLD.deliverX),
      this.sy(0),
      CANVAS_W - this.sx(WORLD.deliverX),
      WORLD.height * this.scale,
    );

    // Recovery areas — wreckage fields (salvage amber) and survivor areas
    // (rescue cyan). Both draw their working radius, a center marker, and a
    // progress ring that visibly resets to zero if every escort leaves.
    const drawRecoveryArea = (
      x: number,
      y: number,
      radius: number,
      progress: number,
      required: number,
      expiresAt: number,
      color: string,
      marker: 'wreck' | 'crew',
    ): void => {
      const cx = this.sx(x);
      const cy = this.sy(y);
      const r = radius * this.scale;
      // Fade the area as its lifetime runs out, so "about to sink" is legible.
      const lifeLeft = Math.max(0, Math.min(1, (expiresAt - t.time) / 20));
      const alpha = 0.35 + 0.65 * lifeLeft;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color.replace('ALPHA', '0.07');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color.replace('ALPHA', '0.55');
      ctx.setLineDash([7, 9]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // Progress ring (inner): sweeps as escorts work the area.
      if (progress > 0) {
        ctx.strokeStyle = color.replace('ALPHA', '0.95');
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 15, -Math.PI / 2, -Math.PI / 2 + (progress / required) * Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = color.replace('ALPHA', '0.9');
      ctx.lineWidth = 2;
      if (marker === 'wreck') {
        // Broken-hull diamond.
        ctx.beginPath();
        ctx.moveTo(cx, cy - 7);
        ctx.lineTo(cx + 7, cy);
        ctx.lineTo(cx, cy + 7);
        ctx.lineTo(cx - 7, cy);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy);
        ctx.lineTo(cx + 3, cy);
        ctx.stroke();
      } else {
        // Life-ring: circle with a bobbing head.
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = color.replace('ALPHA', '0.9');
        ctx.beginPath();
        ctx.arc(cx, cy - 1 + Math.sin(now / 260) * 1.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    for (const field of t.wreckage) {
      if (field.recovered || field.expired) continue;
      drawRecoveryArea(
        field.x,
        field.y,
        WRECKAGE.radius,
        field.progress,
        field.required,
        field.expiresAt,
        'rgba(240, 190, 92, ALPHA)',
        'wreck',
      );
    }
    for (const area of t.survivors) {
      if (area.rescued || area.lost) continue;
      drawRecoveryArea(
        area.x,
        area.y,
        SURVIVORS.radius,
        area.progress,
        area.required,
        area.expiresAt,
        'rgba(126, 224, 214, ALPHA)',
        'crew',
      );
    }

    // The run-in line being drawn right now, before it is sent. Without this
    // the player is aiming a line weapon blind — the first tap would vanish and
    // a drag would show nothing until the jet appeared somewhere unexpected.
    if (this.armedAbility === 'warthog' && this.runStart) {
      const end = this.runDrag;
      const ax = this.sx(this.runStart.x);
      const ay = this.sy(this.runStart.y);
      ctx.strokeStyle = 'rgba(255, 176, 84, 0.75)';
      ctx.lineWidth = 2;
      if (end) {
        const bx = this.sx(end.x);
        const by = this.sy(end.y);
        const long =
          Math.hypot(end.x - this.runStart.x, end.y - this.runStart.y) >=
          COMBAT.warthog.minRunLength;
        // A run too short to fly is drawn in warning red, so the rule is
        // learned from the picture rather than from a rejection message.
        ctx.strokeStyle = long ? 'rgba(255, 176, 84, 0.75)' : 'rgba(255, 110, 90, 0.8)';
        ctx.setLineDash([12, 7]);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.setLineDash([]);
        // An arrowhead at the far end: the run has a direction, and the first
        // pass goes this way.
        const ang = Math.atan2(by - ay, bx - ax);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - Math.cos(ang - 0.4) * 14, by - Math.sin(ang - 0.4) * 14);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - Math.cos(ang + 0.4) * 14, by - Math.sin(ang + 0.4) * 14);
        ctx.stroke();
      }
      // The start marker stays put between the two taps.
      ctx.beginPath();
      ctx.arc(ax, ay, 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // The Warthog's run-in line and its gun cone. The line is what the player
    // drew; the cone is what the gun can actually reach off the nose. Together
    // they make a sortie readable while it happens — what is inside the cone is
    // about to be strafed, what is merely near the line is not.
    const coneHalf =
      COMBAT.warthog.coneHalfAngle *
      (t.effects.abilities.warthog.wide ? COMBAT.warthog.wideConeMult : 1);
    for (const ac of t.aircraft) {
      if (ac.role !== 'warthog') continue;
      ctx.strokeStyle = 'rgba(255, 176, 84, 0.28)';
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.sx(ac.runAx), this.sy(ac.runAy));
      ctx.lineTo(this.sx(ac.runBx), this.sy(ac.runBy));
      ctx.stroke();
      ctx.setLineDash([]);
      // The live cone, only while a firing pass is being flown and only while
      // the gun still has its one engagement for that pass in hand.
      if (ac.phase !== 'onStation' || ac.firedThisPass) continue;
      const ax = this.sx(ac.x);
      const ay = this.sy(ac.y);
      const reach = COMBAT.warthog.coneRange * this.scale;
      ctx.fillStyle = 'rgba(255, 176, 84, 0.07)';
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.arc(ax, ay, reach, ac.heading - coneHalf, ac.heading + coneHalf);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 176, 84, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Placed area effects: active sonar pings (blue) and defensive smoke (grey).
    for (const fx of t.areaEffects) {
      const cx = this.sx(fx.x);
      const cy = this.sy(fx.y);
      const r = fx.radius * this.scale;
      const remain = Math.max(0, fx.until - t.time);
      if (fx.kind === 'sonar') {
        ctx.strokeStyle = 'rgba(77, 195, 255, 0.5)';
        ctx.setLineDash([4, 7]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // A sweeping ping arm makes the active window readable.
        const ang = (now / 500) % (Math.PI * 2);
        ctx.strokeStyle = 'rgba(77, 195, 255, 0.35)';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
        ctx.stroke();
      } else {
        // Smoke: a soft grey blob, fading as it nears expiry.
        const fade = Math.min(1, remain / 4);
        ctx.fillStyle = `rgba(170, 180, 190, ${0.16 * fade})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(190, 200, 210, ${0.35 * fade})`;
        ctx.setLineDash([10, 10]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Mines the fleet currently holds a contact on. A contact is not permanent:
    // as the fix ages out it is drawn fading, and the last seconds blink, so
    // losing the plot on a mine is something the player watches happen and can
    // still act on — not something they discover by sailing into it.
    for (const mine of t.threats) {
      if (mine.kind !== 'mine' || !mine.alive || !mine.revealed) continue;
      const x = this.sx(mine.x);
      const y = this.sy(mine.y);
      const left = (mine.revealedUntil ?? 0) - t.time;
      const stale = clampNum(left / COMBAT.mineContact.fadeSeconds, 0, 1);
      // Fading contacts also pulse, so a mine about to drop off the plot is
      // caught out of the corner of the eye.
      const alpha = stale >= 1 ? 1 : 0.3 + 0.7 * stale * (0.6 + 0.4 * Math.sin(now / 110));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = mine.lowSig ? '#4a3550' : '#3d3d46';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = mine.lowSig ? '#c792ea' : '#ffc857';
      ctx.lineWidth = 1.5;
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(ang) * 7, y + Math.sin(ang) * 7);
        ctx.lineTo(x + Math.cos(ang) * 11, y + Math.sin(ang) * 11);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.stroke();

      // Sweep affordance: when drones are researched and in stock, and no drone
      // is already inbound, show a green targeting bracket — tap it to sweep.
      const beingSwept = t.drones.some((dr) => dr.targetMineId === mine.id);
      if (t.effects.sweepDrones && t.droneAmmo > 0 && !beingSwept) {
        ctx.strokeStyle = 'rgba(120, 224, 176, 0.8)';
        ctx.lineWidth = 1.5;
        const r = 18 + 1.5 * Math.sin(now / 200);
        for (let q = 0; q < 4; q++) {
          const a0 = q * (Math.PI / 2) + Math.PI / 4 - 0.35;
          ctx.beginPath();
          ctx.arc(x, y, r, a0, a0 + 0.7);
          ctx.stroke();
        }
      } else if (beingSwept) {
        ctx.strokeStyle = 'rgba(120, 224, 176, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 17, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Shore batteries on the friendly (bottom) shore.
    for (const base of t.bases) {
      const x = this.sx(base.x);
      const y = this.sy(base.y);
      if (!base.alive) {
        // Destroyed battery: a dark, broken emplacement.
        ctx.fillStyle = '#3a2a2a';
        ctx.fillRect(x - 13, y - 5, 26, 10);
        ctx.strokeStyle = 'rgba(120, 90, 90, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 4);
        ctx.lineTo(x + 6, y + 4);
        ctx.moveTo(x + 8, y - 4);
        ctx.lineTo(x - 4, y + 5);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = '#5f7d92';
      ctx.fillRect(x - 13, y - 6, 26, 12);
      ctx.fillStyle = '#8fb0c4';
      ctx.fillRect(x - 9, y - 12, 18, 7);
      // Twin launch rails
      ctx.strokeStyle = '#c9d4de';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 12);
      ctx.lineTo(x - 7, y - 20);
      ctx.moveTo(x + 4, y - 12);
      ctx.lineTo(x + 7, y - 20);
      ctx.stroke();
      const disabled = t.time < base.disabledUntil;
      const ready = base.cooldown <= 0 && !disabled;
      ctx.fillStyle = disabled ? '#ff6b6b' : ready ? '#59d98c' : '#ffc857';
      ctx.beginPath();
      ctx.arc(x, y - 2, 3, 0, Math.PI * 2);
      ctx.fill();
      if (disabled) {
        // Offline: a red ring winding down over the outage.
        const remain = (base.disabledUntil - t.time) / COMBAT.base.disableSeconds;
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y - 2, 16, -Math.PI / 2, -Math.PI / 2 + Math.max(0, Math.min(1, remain)) * Math.PI * 2);
        ctx.stroke();
      } else if (!ready) {
        ctx.strokeStyle = 'rgba(255, 200, 87, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y - 2, 16, -Math.PI / 2, -Math.PI / 2 + (1 - base.cooldown / t.effects.base.reload) * Math.PI * 2);
        ctx.stroke();
      }
      // Separate automatic-fire cooldown (inner amber arc) — automation state
      // is never hidden behavior: reload and auto-cycle read independently.
      if (t.effects.base.autoUnlocked && t.autoFire.baseInterceptor && base.autoCooldown > 0 && t.effects.base.autoCooldown > 0) {
        ctx.strokeStyle = 'rgba(199, 146, 234, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y - 2, 11, -Math.PI / 2, -Math.PI / 2 + (1 - base.autoCooldown / t.effects.base.autoCooldown) * Math.PI * 2);
        ctx.stroke();
      }
      // HP bar when the battery is damaged.
      if (base.hp < base.maxHp) {
        const frac = Math.max(0, base.hp / base.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x - 13, y - 26, 26, 3);
        ctx.fillStyle = frac > 0.5 ? '#59d98c' : frac > 0.25 ? '#ffc857' : '#ff6b6b';
        ctx.fillRect(x - 13, y - 26, 26 * frac, 3);
      }
    }

    // Ships
    for (const ship of t.ships) {
      if (!ship.spawned || !ship.alive || ship.delivered) continue;
      this.drawShip(ship);
    }

    // Order confirmations: a ping where the player just sent a ship. It
    // outlives the order itself for a few seconds, so a tap always produces
    // visible feedback even if the escort is already standing on the spot.
    for (const marker of this.orderMarkers) {
      const age = (now - marker.at) / 4000;
      const mx = this.sx(marker.x);
      const my = this.sy(marker.y);
      const colour =
        marker.kind === 'recover'
          ? '240, 190, 92'
          : marker.kind === 'rescue'
            ? '126, 224, 214'
            : marker.kind === 'rejoin'
              ? '111, 177, 224'
              : '77, 195, 255';
      // Expanding ping in the first half-second, then a steady marker fading.
      const ping = Math.min(1, age * 8);
      if (ping < 1) {
        ctx.strokeStyle = `rgba(${colour}, ${0.8 * (1 - ping)})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(mx, my, 6 + 26 * ping, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = `rgba(${colour}, ${0.75 * (1 - age)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx, my - 11);
      ctx.lineTo(mx, my - 4);
      ctx.moveTo(mx, my + 4);
      ctx.lineTo(mx, my + 11);
      ctx.moveTo(mx - 11, my);
      ctx.lineTo(mx - 4, my);
      ctx.moveTo(mx + 4, my);
      ctx.lineTo(mx + 11, my);
      ctx.stroke();
    }

    // Escorts (player-directed). Draw a route to the destination when moving.
    for (const escort of t.escorts) {
      if (!escort.alive) continue; // destroyed escorts leave the map
      const x = this.sx(escort.x);
      const y = this.sy(escort.y);
      const isSel = escort.id === this.selectedEscort;
      const disabled = t.time < escort.disabledUntil;

      const status = escortStatus(t, escort);

      // The route it is running. Drawn brighter for the selected ship, and the
      // marker at the far end says what will happen on arrival.
      if (escort.moveTarget) {
        const tx = this.sx(escort.moveTarget.x);
        const ty = this.sy(escort.moveTarget.y);
        const hold = escort.moveTarget.hold;
        ctx.strokeStyle = isSel ? 'rgba(77, 195, 255, 0.75)' : 'rgba(120, 180, 220, 0.28)';
        ctx.setLineDash([5, 6]);
        ctx.lineWidth = isSel ? 2 : 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = hold ? 'rgba(120, 220, 160, 0.9)' : 'rgba(77, 195, 255, 0.8)';
        ctx.lineWidth = 2;
        if (hold) {
          // A hold order: draw a square "station here" marker.
          ctx.strokeRect(tx - 5, ty - 5, 10, 10);
        } else {
          // A move order: draw an X waypoint.
          ctx.beginPath();
          ctx.moveTo(tx - 5, ty - 5);
          ctx.lineTo(tx + 5, ty + 5);
          ctx.moveTo(tx + 5, ty - 5);
          ctx.lineTo(tx - 5, ty + 5);
          ctx.stroke();
        }
      }

      // Stationed marker: a steady ring shows it is holding position.
      if (escort.stationed) {
        ctx.strokeStyle = 'rgba(120, 220, 160, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.stroke();
      }

      // SELECTION. The commonest complaint was not knowing which ship was
      // under command, so the selected escort gets an unmistakable double
      // ring that pulses — nothing else on the map looks like it.
      if (isSel) {
        const pulse = 1 + 0.06 * Math.sin(now / 180);
        ctx.strokeStyle = 'rgba(77, 195, 255, 0.35)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(x, y, 22 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#4dc3ff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, 22 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        // Bearing pip: which way she is pointed, readable at any zoom.
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(escort.heading) * 22 * pulse, y + Math.sin(escort.heading) * 22 * pulse);
        ctx.lineTo(x + Math.cos(escort.heading) * 30 * pulse, y + Math.sin(escort.heading) * 30 * pulse);
        ctx.stroke();
      }

      // Hull, rotated to heading. Dimmed while its launcher is knocked offline.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(escort.heading);
      ctx.fillStyle = disabled ? '#8a9099' : '#c9d4de';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(4, -5);
      ctx.lineTo(-12, -5);
      ctx.lineTo(-12, 5);
      ctx.lineTo(4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5b6b7a';
      ctx.fillRect(-5, -2.5, 6, 5);
      ctx.restore();

      if (disabled) {
        // Offline from a hit: a red ring winding down over the outage.
        const remain = (escort.disabledUntil - t.time) / COMBAT.escort.disableSeconds;
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + Math.max(0, Math.min(1, remain)) * Math.PI * 2);
        ctx.stroke();
      } else if (escort.cooldown > 0) {
        ctx.strokeStyle = 'rgba(255, 200, 87, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + (1 - escort.cooldown / t.effects.escort.reload) * Math.PI * 2);
        ctx.stroke();
      }
      // Separate automatic-fire cooldown arc (independent of launcher reload).
      if (t.effects.escort.autoUnlocked && t.autoFire.escortInterceptor && escort.autoCooldown > 0 && t.effects.escort.autoCooldown > 0) {
        ctx.strokeStyle = 'rgba(199, 146, 234, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + (1 - escort.autoCooldown / t.effects.escort.autoCooldown) * Math.PI * 2);
        ctx.stroke();
      }
      // Local automatic-engagement radius (faint) while automation is on.
      if (t.effects.escort.autoUnlocked && t.autoFire.escortInterceptor && !disabled) {
        ctx.strokeStyle = 'rgba(199, 146, 234, 0.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, t.effects.escort.autoRadius * this.scale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // HP bar when the escort is damaged.
      if (escort.hp < escort.maxHp) {
        const frac = Math.max(0, escort.hp / escort.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x - 12, y - 16, 24, 3);
        ctx.fillStyle = frac > 0.5 ? '#59d98c' : frac > 0.25 ? '#ffc857' : '#ff6b6b';
        ctx.fillRect(x - 12, y - 16, 24 * frac, 3);
      }

      // NAME, and what she is doing. Every escort carries her name on the map
      // so the roster panel and the ships are the same fleet in the player's
      // head; the selected one also says her current job underneath, because
      // that is the ship they are actively thinking about.
      this.drawEscortLabel(escort, x, y, isSel, status);
    }

    // Revealed torpedoes: a teal underwater runner with a short wake. Hidden
    // ones stay invisible — detection is the hydrophone/active-sonar job.
    for (const threat of t.threats) {
      if (threat.kind !== 'torpedo' || !threat.alive || !threat.revealed) continue;
      const x = this.sx(threat.x);
      const y = this.sy(threat.y);
      const ang = Math.atan2(threat.vy, threat.vx);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = '#4fd8c4';
      ctx.fillRect(-7, -2, 14, 4);
      ctx.strokeStyle = 'rgba(79, 216, 196, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-26, 0);
      ctx.stroke();
      ctx.restore();
      // Depth charges are the counter — cue the area-attack affordance.
      if (t.escortModules.includes('depthCharges')) {
        ctx.strokeStyle = 'rgba(79, 216, 196, 0.5)';
        ctx.setLineDash([3, 5]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 15 + 2 * Math.sin(now / 180), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Attack boats: persistent surface craft with hull bars; a committed deck
    // gun draws its fire line.
    for (const threat of t.threats) {
      if (threat.kind !== 'attackBoat' || !threat.alive) continue;
      const x = this.sx(threat.x);
      const y = this.sy(threat.y);
      // Boats steer under a turn limit, so heading is real state — a boat
      // holding station has near-zero velocity but is still pointed somewhere.
      const ang = threat.heading ?? Math.atan2(threat.vy, threat.vx);
      // Wake: the visible tell that a boat is a moving hull rather than a
      // marker that appears alongside. Length tracks actual speed.
      const wake = Math.min(1, (threat.speed ?? 0) / COMBAT.attackBoat.speed);
      if (wake > 0.15) {
        ctx.strokeStyle = `rgba(180, 210, 235, ${0.05 + 0.16 * wake})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - Math.cos(ang) * 26 * wake, y - Math.sin(ang) * 26 * wake);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = threat.boatVariant === 'boarding' ? '#e08a5e' : '#d8626a';
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(3, -4);
      ctx.lineTo(-9, -4);
      ctx.lineTo(-9, 4);
      ctx.lineTo(3, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (threat.maxHp && threat.hp !== undefined && threat.hp < threat.maxHp) {
        const frac = Math.max(0, threat.hp / threat.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x - 10, y - 12, 20, 3);
        ctx.fillStyle = frac > 0.5 ? '#59d98c' : frac > 0.25 ? '#ffc857' : '#ff6b6b';
        ctx.fillRect(x - 10, y - 12, 20 * frac, 3);
      }
      for (const escort of t.escorts) {
        if (!escort.alive || escort.gunTargetId !== threat.id) continue;
        ctx.strokeStyle = 'rgba(255, 200, 87, 0.5)';
        ctx.setLineDash([2, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(this.sx(escort.x), this.sy(escort.y));
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // A BOARDING boat that has grappled draws a hard line to the hull — it
      // is physically attached and the player must break that contact. Gun
      // boats no longer draw one: they stand off and their rounds crossing the
      // water are the tell, so "attached" and "shooting at her" never read the
      // same. A faint target thread shows which hull a gun boat is working.
      const victim = threat.engaging
        ? t.ships.find((s) => s.id === threat.targetShipId && s.alive)
        : undefined;
      if (victim) {
        const boarding = threat.boatVariant === 'boarding';
        ctx.strokeStyle = boarding ? 'rgba(224, 138, 94, 0.9)' : 'rgba(216, 98, 106, 0.22)';
        ctx.lineWidth = boarding ? 2 : 1;
        if (!boarding) ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(this.sx(victim.x), this.sy(victim.y));
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Attack-boat rounds in flight. Every point of damage this branch does to
    // a cargo hull is one of these crossing the water — a tracer for machine
    // guns, a fatter glowing round for rockets — so a player who loses a ship
    // to boats watched the rounds come and had the seconds to answer.
    for (const shot of t.boatShots) {
      if (!shot.alive) continue;
      const sxp = this.sx(shot.x);
      const syp = this.sy(shot.y);
      const speed = Math.hypot(shot.vx, shot.vy) || 1;
      const rocket = shot.variant === 'rocket';
      // Draw as a short streak along the direction of travel so fast rounds
      // read as motion rather than as a dot that teleports each frame.
      const trail = rocket ? 13 : 9;
      const tx = sxp - (shot.vx / speed) * trail;
      const ty = syp - (shot.vy / speed) * trail;
      const grad = ctx.createLinearGradient(tx, ty, sxp, syp);
      grad.addColorStop(0, rocket ? 'rgba(255, 138, 94, 0)' : 'rgba(255, 224, 160, 0)');
      grad.addColorStop(1, rocket ? 'rgba(255, 158, 110, 0.95)' : 'rgba(255, 236, 180, 0.9)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = shot.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(sxp, syp);
      ctx.stroke();
      ctx.lineCap = 'butt';
      if (rocket) {
        ctx.fillStyle = 'rgba(255, 190, 130, 0.9)';
        ctx.beginPath();
        ctx.arc(sxp, syp, shot.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Boarding Alarm (a granted anti-boarding tactic): the boarded hull and its
    // takeover progress have to be unmistakable, because the player's window to
    // answer is short and a capture cannot be undone.
    for (const ship of t.ships) {
      if (ship.boardingSeconds <= 0 || !ship.alive) continue;
      const frac = Math.min(1, ship.boardingSeconds / COMBAT.attackBoat.boardingSeconds);
      const x = this.sx(ship.x);
      const y = this.sy(ship.y);
      ctx.strokeStyle = `rgba(255, 107, 107, ${0.55 + 0.35 * Math.sin(now / 110)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x - 16, y - 27, 32, 4);
      ctx.fillStyle = frac > 0.75 ? '#ff6b6b' : '#ffc857';
      ctx.fillRect(x - 16, y - 27, 32 * frac, 4);
    }

    // Enemy smoke: a soft grey mass. Anything inside it keeps only a faint
    // bearing marker, which is drawn with the threats below.
    for (const fx of t.areaEffects) {
      if (fx.kind !== 'enemySmoke' || t.time >= fx.until) continue;
      const cx = this.sx(fx.x);
      const cy = this.sy(fx.y);
      const r = fx.radius * this.scale;
      const fade = Math.min(1, (fx.until - t.time) / 5);
      const grad = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
      const tint = fx.blinding ? '190, 178, 168' : '176, 182, 190';
      grad.addColorStop(0, `rgba(${tint}, ${0.5 * fade})`);
      grad.addColorStop(1, `rgba(${tint}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Recon planes and disabling drones.
    for (const threat of t.threats) {
      if (!threat.alive) continue;
      if (threat.kind !== 'reconPlane' && threat.kind !== 'disablingDrone') continue;
      const x = this.sx(threat.x);
      const y = this.sy(threat.y);
      const recon = threat.kind === 'reconPlane';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(threat.vy, threat.vx));
      ctx.fillStyle = recon ? '#b9a3e3' : '#e3a34f';
      ctx.beginPath();
      ctx.moveTo(recon ? 11 : 8, 0);
      ctx.lineTo(-6, recon ? -7 : -5);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-6, recon ? 7 : 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Shells in flight, with the water they are about to burst on marked. The
    // impact ring is the readable part — nothing can shoot a shell down, so the
    // only useful information is where NOT to be.
    for (const shell of t.shells) {
      const ix = this.sx(shell.targetX);
      const iy = this.sy(shell.targetY);
      ctx.strokeStyle = 'rgba(255, 138, 94, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ix, iy, COMBAT.artillery.splashRadius * this.scale, 0, Math.PI * 2);
      ctx.stroke();
      const sx2 = this.sx(shell.x);
      const sy2 = this.sy(shell.y);
      ctx.strokeStyle = 'rgba(255, 196, 120, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx2, sy2);
      ctx.lineTo(sx2 - shell.vx * 0.05 * this.scale, sy2 - shell.vy * 0.05 * this.scale);
      ctx.stroke();
    }

    // Depth-charge rounds in flight, plus their aim points.
    for (const shot of t.depthChargeShots) {
      if (shot.detonated) continue;
      const sx = this.sx(shot.x);
      const sy = this.sy(shot.y);
      ctx.fillStyle = '#9aa8b5';
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(154, 168, 181, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.sx(shot.targetX), this.sy(shot.targetY), shot.blastRadius * this.scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Missiles with trails
    for (const threat of t.threats) {
      if (!threat.alive || (threat.kind !== 'missile' && threat.kind !== 'guidedMissile')) continue;

      // Concealed by enemy smoke: the SOFT model. A faint, deliberately fuzzy
      // marker so the player can still read "something is coming from over
      // there", but no crisp sprite and no tap-target until it clears. Never
      // hidden outright — that would be unfair in a tap-to-target game.
      if (threat.concealed) {
        const cx = this.sx(threat.x);
        const cy = this.sy(threat.y);
        const pulse = 0.22 + 0.12 * Math.sin(now / 220);
        ctx.fillStyle = `rgba(255, 170, 140, ${pulse})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 190, 160, ${pulse + 0.15})`;
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }

      // Early-Warning Network research: show where each missile is headed.
      if (t.effects.showTargetVectors) {
        const target =
          threat.kind === 'guidedMissile'
            ? t.ships.find((s) => s.id === threat.targetShipId && s.alive && !s.delivered)
            : undefined;
        const tx = target ? target.x : threat.targetX;
        const ty = target ? target.y : threat.targetY;
        if (tx !== undefined && ty !== undefined) {
          ctx.strokeStyle = 'rgba(255, 120, 120, 0.22)';
          ctx.setLineDash([4, 8]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(this.sx(threat.x), this.sy(threat.y));
          ctx.lineTo(this.sx(tx), this.sy(ty));
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Missile-Warning Receiver module: mark the hunted ship. With the
      // impact-urgency tactic the pulse speeds up as the missile closes —
      // a readable urgency state, never a number to read.
      if (threat.kind === 'guidedMissile') {
        const target = t.ships.find(
          (s) => s.id === threat.targetShipId && s.alive && !s.delivered,
        );
        if (target?.modules.includes('missileWarning')) {
          const px = this.sx(target.x);
          const py = this.sy(target.y);
          let blinkPeriod = 110;
          if (t.effects.missileWarning.urgency) {
            const d = Math.hypot(threat.x - target.x, threat.y - target.y);
            const tti = d / Math.max(1, threat.speed);
            blinkPeriod = tti < 3 ? 45 : tti < 7 ? 75 : 130;
          }
          const blink = Math.sin(now / blinkPeriod) > 0;
          if (blink) {
            ctx.strokeStyle = 'rgba(255, 107, 107, 0.9)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px, py - 22);
            ctx.lineTo(px - 7, py - 11);
            ctx.lineTo(px + 7, py - 11);
            ctx.closePath();
            ctx.stroke();
          }
        }
      }

      let trail = this.trails.get(threat.id);
      if (!trail) {
        trail = [];
        this.trails.set(threat.id, trail);
      }
      trail.push({ x: threat.x, y: threat.y });
      if (trail.length > 14) trail.shift();

      ctx.strokeStyle =
        threat.kind === 'guidedMissile' ? 'rgba(255, 120, 90, 0.45)' : 'rgba(255, 170, 90, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        if (i === 0) ctx.moveTo(this.sx(p.x), this.sy(p.y));
        else ctx.lineTo(this.sx(p.x), this.sy(p.y));
      }
      ctx.stroke();

      const x = this.sx(threat.x);
      const y = this.sy(threat.y);
      ctx.fillStyle = threat.kind === 'guidedMissile' ? '#ff6b5e' : '#ffb35e';
      ctx.beginPath();
      ctx.arc(x, y, threat.kind === 'guidedMissile' ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();

      // Tap affordance ring. Multiple interceptors can be sent at one missile;
      // when any are inbound, show a solid ring plus a count.
      const incoming = t.interceptors.reduce(
        (n, i) => (i.targetThreatId === threat.id && i.launcher !== 'pd' ? n + 1 : n),
        0,
      );
      if (incoming > 0) {
        ctx.strokeStyle = 'rgba(120, 220, 255, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.stroke();
        if (incoming > 1) {
          ctx.fillStyle = 'rgba(150, 230, 255, 0.95)';
          ctx.font = '600 10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${incoming}`, x, y - 13);
        }
      } else {
        const pulse = 12 + 2.5 * Math.sin(now / 160);
        ctx.strokeStyle = 'rgba(255, 190, 120, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Interceptors — three visibly distinct munitions:
    //  • point-defense tracer: tiny pale-yellow streak
    //  • battery interceptor: the FAST one — a larger white-blue round with a glow
    //  • escort interceptor: a smaller cyan round
    for (const interceptor of t.interceptors) {
      const ix = this.sx(interceptor.x);
      const iy = this.sy(interceptor.y);
      if (interceptor.launcher === 'pd') {
        const threat = t.threats.find((th) => th.id === interceptor.targetThreatId);
        if (threat) {
          ctx.strokeStyle = 'rgba(255, 240, 170, 0.8)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(ix, iy);
          ctx.lineTo(this.sx(threat.x), this.sy(threat.y));
          ctx.stroke();
        }
        ctx.fillStyle = '#fff3aa';
        ctx.beginPath();
        ctx.arc(ix, iy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (interceptor.launcher === 'flak') {
        // Flak burst: a short amber tracer.
        ctx.fillStyle = '#ffd27a';
        ctx.beginPath();
        ctx.arc(ix, iy, interceptor.size ?? 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (interceptor.launcher === 'base') {
        // Battery interceptor: bigger, brighter, with a soft glow — it reads as
        // the heavier, faster round. Visual size follows its size tier.
        const size = interceptor.size ?? 5;
        ctx.fillStyle = 'rgba(180, 230, 255, 0.28)';
        ctx.beginPath();
        ctx.arc(ix, iy, size + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#eaf6ff';
        ctx.beginPath();
        ctx.arc(ix, iy, size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Escort interceptor: smaller cyan round (size tier–driven).
        ctx.fillStyle = '#4dc3ff';
        ctx.beginPath();
        ctx.arc(ix, iy, interceptor.size ?? 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Self-defense module cues: the threat-designator tactic highlights the
    // missile each module intends to engage (at ~2× firing range — warning
    // before the shot); the engagement-predictor tactic adds the projected
    // engagement line and a loaded/empty/reloading status pip.
    const sd = t.effects.selfDefense;
    if (sd.designator || sd.predictor) {
      const designateRange = sd.range * 2;
      for (const ship of t.ships) {
        if (!ship.spawned || !ship.alive || ship.delivered) continue;
        if (!ship.modules.includes('selfDefense')) continue;
        const px = this.sx(ship.x);
        const py = this.sy(ship.y);
        if (sd.predictor) {
          const status =
            ship.pdShots <= 0 || t.pdAmmo <= 0
              ? '#ff6b6b' // empty / no rounds
              : ship.pdCooldown > 0
                ? '#ffc857' // reloading
                : '#59d98c'; // loaded
          ctx.fillStyle = status;
          ctx.fillRect(px + 8, py - 14, 5, 5);
        }
        if (ship.pdShots <= 0 || t.pdAmmo <= 0) continue;
        let intended: Threat | null = null;
        let bestD = designateRange;
        for (const threat of t.threats) {
          if (!threat.alive || (threat.kind !== 'missile' && threat.kind !== 'guidedMissile')) continue;
          const d = Math.hypot(threat.x - ship.x, threat.y - ship.y);
          if (d < bestD) {
            bestD = d;
            intended = threat;
          }
        }
        if (!intended) continue;
        const tx = this.sx(intended.x);
        const ty = this.sy(intended.y);
        if (sd.designator) {
          // Amber corner brackets on the intended target.
          ctx.strokeStyle = 'rgba(255, 210, 122, 0.85)';
          ctx.lineWidth = 1.5;
          const r = 9;
          for (let q = 0; q < 4; q++) {
            const a0 = q * (Math.PI / 2) + Math.PI / 4 - 0.3;
            ctx.beginPath();
            ctx.arc(tx, ty, r, a0, a0 + 0.6);
            ctx.stroke();
          }
        }
        if (sd.predictor) {
          ctx.strokeStyle = 'rgba(255, 210, 122, 0.3)';
          ctx.setLineDash([3, 5]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Minesweeper drones flying out to charted mines.
    for (const drone of t.drones) {
      const dx = this.sx(drone.x);
      const dy = this.sy(drone.y);
      const mine = t.threats.find((m) => m.id === drone.targetMineId);
      if (mine) {
        ctx.strokeStyle = 'rgba(120, 230, 160, 0.4)';
        ctx.setLineDash([3, 5]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(this.sx(mine.x), this.sy(mine.y));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = '#8de0b0';
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(now / 200); // spinning body reads as a drone
      ctx.fillRect(-4, -1.2, 8, 2.4);
      ctx.fillRect(-1.2, -4, 2.4, 8);
      ctx.restore();
    }

    // Gun runs: a burst of 30mm from the jet to what it hit. Short-lived on
    // purpose — the point is that every kill the Warthog makes is one the
    // player SAW it make, which is exactly what the jammer it replaced could
    // never show.
    for (const run of t.strafeRuns) {
      const fade = clampNum(run.ttl / COMBAT.warthog.burstSeconds, 0, 1);
      const x0 = this.sx(run.x);
      const y0 = this.sy(run.y);
      const x1 = this.sx(run.targetX);
      const y1 = this.sy(run.targetY);
      // A STREAM of tracer, not one line. The gun is a rotary cannon and the
      // burst should read as such: individual rounds strung out along the line
      // of fire, the leading ones already at the target while the tail is still
      // leaving the aircraft. The string slides toward the target as the burst
      // ages, which is what sells it as gunfire rather than a drawn beam.
      const rounds = COMBAT.warthog.burstRounds;
      const travel = 1 - fade; // 0 at the muzzle, 1 when the burst has landed
      for (let i = 0; i < rounds; i++) {
        const spacing = i / rounds;
        const at = Math.min(1, spacing * 0.55 + travel * 0.9);
        const rx = x0 + (x1 - x0) * at;
        const ry = y0 + (y1 - y0) * at;
        // The head of the stream is brightest; the tail dims as it is spent.
        const heat = 0.35 + 0.65 * (1 - spacing);
        ctx.fillStyle = `rgba(255, 226, 150, ${heat * fade})`;
        ctx.beginPath();
        ctx.arc(rx, ry, 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
      // A faint line of the gun's axis under the tracer, so the direction of
      // the pass stays legible at the moment the rounds are still bunched.
      ctx.strokeStyle = `rgba(255, 216, 130, ${0.22 * fade})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      // Impact splash at the far end; a kill flashes harder than a hit.
      ctx.fillStyle = run.killed
        ? `rgba(255, 236, 180, ${0.8 * fade})`
        : `rgba(255, 190, 110, ${0.5 * fade})`;
      ctx.beginPath();
      ctx.arc(x1, y1, (run.killed ? 9 : 5) * (2 - fade), 0, Math.PI * 2);
      ctx.fill();
    }

    // Support aircraft (scan plane / the Warthog).
    for (const ac of t.aircraft) {
      const ax = this.sx(ac.x);
      const ay = this.sy(ac.y);
      if (ac.role === 'scan') {
        // A scan plane sweeping its lane; draw a bright band ahead of it so the
        // lane it is charting reads clearly (band width scales with the
        // expanded-coverage research path).
        const laneHalf =
          COMBAT.scan.laneHalfWidth * (t.effects.abilities.scan.radius / COMBAT.scan.baseRevealRadius);
        const laneY = this.sy(ac.laneY);
        ctx.fillStyle = 'rgba(77, 195, 255, 0.06)';
        ctx.fillRect(ax, laneY - laneHalf * this.scale, CANVAS_W - ax, laneHalf * 2 * this.scale);
        ctx.strokeStyle = 'rgba(77, 195, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ax, ay, 14 + 3 * Math.sin(now / 120), 0, Math.PI * 2);
        ctx.stroke();
      }
      this.drawPlane(ax, ay, ac.heading, ac.role === 'warthog' ? '#ffb054' : '#7ce7ff');
    }

    // Visual effects
    this.effects = this.effects.filter((fx) => now - fx.start < fx.duration);
    for (const fx of this.effects) {
      const progress = (now - fx.start) / fx.duration;
      const x = this.sx(fx.x);
      const y = this.sy(fx.y);
      if (fx.kind === 'scan') {
        ctx.strokeStyle = `rgba(77, 195, 255, ${0.7 * (1 - progress)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, fx.maxRadius * this.scale * progress, 0, Math.PI * 2);
        ctx.stroke();
      } else if (fx.kind === 'intercept') {
        ctx.strokeStyle = `rgba(160, 230, 255, ${1 - progress})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, fx.maxRadius * this.scale * progress, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(255, ${140 - 80 * progress}, 60, ${0.8 * (1 - progress)})`;
        ctx.beginPath();
        ctx.arc(x, y, fx.maxRadius * this.scale * (0.4 + 0.6 * progress), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- End of the world layer ---------------------------------------------
    // Everything below is chrome: it belongs to the screen, not to the sea, so
    // it keeps its size however far the player has zoomed in.
    ctx.restore();

    // Edge arrows for the selected escort and the convoy when they are off the
    // visible map — drawn last so nothing overlaps them.
    this.drawOffscreenMarkers();

    // Sensor jamming: ENEMY_ATTACKS.md locks this as the one capability with no
    // counter at all, and requires an UNMISSABLE indicator in exchange. A
    // player who cannot see why their detection stopped working would read a
    // deliberate design choice as a bug.
    if (t.jammingSeconds > 0) {
      const pulse = 0.55 + 0.25 * Math.sin(now / 160);
      ctx.strokeStyle = `rgba(255, 96, 96, ${pulse})`;
      ctx.lineWidth = 5;
      ctx.strokeRect(2.5, 2.5, CANVAS_W - 5, CANVAS_H - 5);
      const label = `SENSORS JAMMED — ${Math.ceil(t.jammingSeconds)}s`;
      ctx.font = '600 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(label).width + 28;
      ctx.fillStyle = `rgba(120, 20, 20, ${0.62 + 0.12 * Math.sin(now / 160)})`;
      ctx.fillRect(CANVAS_W / 2 - w / 2, 12, w, 30);
      ctx.fillStyle = '#ffe0e0';
      ctx.fillText(label, CANVAS_W / 2, 33);
      ctx.textAlign = 'left';
    }

    // Paused overlay
    if (this.paused) {
      ctx.fillStyle = 'rgba(5, 10, 18, 0.55)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#d8e6f3';
      ctx.font = '600 30px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2);
    }

    // End-of-transit banner
    if (t.over) {
      ctx.fillStyle = 'rgba(5, 10, 18, 0.5)';
      ctx.fillRect(0, CANVAS_H / 2 - 44, CANVAS_W, 88);
      ctx.fillStyle = '#d8e6f3';
      ctx.font = '600 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `Transit complete — ${t.stats.delivered}/${t.stats.launched} ships delivered`,
        CANVAS_W / 2,
        CANVAS_H / 2 + 9,
      );
    }
  }

  /** A small top-down aircraft silhouette (swept wings), pointed along heading. */
  /** Edge markers for things that matter but are off the visible map.
   *
   *  Zooming in to work one escort is only safe if the player can still find
   *  the rest of the fleet — without this, "zoom in to manage escorts" trades
   *  away "zoom out to understand the battle" the moment they lose track of
   *  where anything is. The selected escort gets a bright arrow; the convoy a
   *  quiet one. */
  private drawOffscreenMarkers(): void {
    if (this.camera.isFitted()) return; // everything is on screen already
    const ctx = this.ctx;
    const margin = 26;
    const arrow = (wx: number, wy: number, colour: string, label: string, strong: boolean): void => {
      // True screen position: these markers live on the frame, not in the sea.
      const sx = this.screenX(wx);
      const sy = this.screenY(wy);
      if (sx >= 0 && sx <= CANVAS_W && sy >= 0 && sy <= CANVAS_H) return; // visible
      // Point from the screen centre toward the target and clamp to the edge.
      const cx = CANVAS_W / 2;
      const cy = CANVAS_H / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const ex = clampNum(cx + Math.cos(ang) * CANVAS_W, margin, CANVAS_W - margin);
      const ey = clampNum(cy + Math.sin(ang) * CANVAS_H, margin, CANVAS_H - margin);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.fillStyle = colour;
      ctx.globalAlpha = strong ? 0.95 : 0.5;
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(-7, -7);
      ctx.lineTo(-7, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (strong) {
        ctx.globalAlpha = 0.95;
        ctx.font = '11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = colour;
        // Keep the whole name on screen — an arrow at the edge would
        // otherwise clip the very label that says which ship it points at.
        const half = ctx.measureText(label).width / 2 + 4;
        ctx.fillText(
          label,
          clampNum(ex, half, CANVAS_W - half),
          ey + (ey > CANVAS_H / 2 ? -16 : 24),
        );
        ctx.textAlign = 'left';
      }
      ctx.globalAlpha = 1;
    };

    const selected = this.state.escorts.find((e) => e.id === this.selectedEscort && e.alive);
    if (selected) arrow(selected.x, selected.y, '#4dc3ff', selected.name, true);
    const c = this.convoyCentre();
    arrow(c.x, c.y, '#6fb1e0', 'Convoy', false);
  }

  /** Name plate under an escort, plus its current job when selected. Drawn in
   *  screen space at a constant size so it stays legible at every zoom. */
  private drawEscortLabel(
    escort: Escort,
    x: number,
    y: number,
    selected: boolean,
    status: EscortStatus,
  ): void {
    const ctx = this.ctx;
    const lines: { text: string; color: string; size: number }[] = [
      { text: escort.name, color: selected ? '#9fe0ff' : 'rgba(201, 212, 222, 0.72)', size: 11 },
    ];
    if (selected) {
      const detail =
        status.progress !== null
          ? `${status.label} ${Math.round(status.progress * 100)}%`
          : status.label;
      lines.push({ text: detail, color: ACTIVITY_COLORS[status.activity], size: 10 });
    }
    // Names sit inside the magnified world layer, so left alone they would grow
    // with the ships. Damp them back to the square root of the magnification:
    // big enough not to look lost beside a zoomed-in hull, small enough that
    // three escorts close together do not become a wall of text.
    const damp = 1 / Math.sqrt(this.camera.detailScale());
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(damp, damp);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let ly = 16 / damp;
    for (const line of lines) {
      ctx.font = `${line.size}px system-ui, sans-serif`;
      const w = ctx.measureText(line.text).width;
      ctx.fillStyle = 'rgba(8, 18, 28, 0.55)';
      ctx.fillRect(-w / 2 - 3, ly - 1, w + 6, line.size + 3);
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, 0, ly);
      ly += line.size + 4;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  private drawPlane(x: number, y: number, heading: number, color: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(11, 0); // nose
    ctx.lineTo(2, 3);
    ctx.lineTo(-4, 3);
    ctx.lineTo(-4, 9); // swept wing
    ctx.lineTo(-8, 9);
    ctx.lineTo(-7, 2);
    ctx.lineTo(-11, 2); // tailplane
    ctx.lineTo(-11, -2);
    ctx.lineTo(-7, -2);
    ctx.lineTo(-8, -9);
    ctx.lineTo(-4, -9);
    ctx.lineTo(-4, -3);
    ctx.lineTo(2, -3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawShip(ship: Ship): void {
    const ctx = this.ctx;
    const x = this.sx(ship.x);
    const y = this.sy(ship.y);
    const len = ship.classId === 'tanker' ? 20 : ship.classId === 'freighter' ? 13 : 16;
    const wid = ship.classId === 'tanker' ? 7 : 5;

    if (ship.straggling) {
      ctx.strokeStyle = 'rgba(255, 200, 87, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, len + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Hull, rotated to the ship's heading so turns and lane changes read as
    // the ship actually pointing where it is going.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ship.heading);
    ctx.fillStyle = SHIP_COLORS[ship.classId] ?? '#9ab';
    ctx.beginPath();
    ctx.moveTo(len, 0);
    ctx.lineTo(len - 6, -wid);
    ctx.lineTo(-len, -wid);
    ctx.lineTo(-len, wid);
    ctx.lineTo(len - 6, wid);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Fire
    if (ship.fireSeconds > 0) {
      ctx.fillStyle = `rgba(255, ${120 + 80 * Math.random()}, 40, 0.9)`;
      ctx.beginPath();
      ctx.arc(x - 2 + Math.random() * 4, y - wid - 3, 3 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // HP bar (only when damaged)
    if (ship.hp < ship.maxHp) {
      const frac = Math.max(0, ship.hp / ship.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - 12, y - wid - 10, 24, 3);
      ctx.fillStyle = frac > 0.5 ? '#59d98c' : frac > 0.25 ? '#ffc857' : '#ff6b6b';
      ctx.fillRect(x - 12, y - wid - 10, 24 * frac, 3);
    }
  }
}

function clampNum(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
