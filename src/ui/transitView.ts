// Transit phase view: canvas rendering, pointer input, and the HUD.
// The view owns nothing about game rules — it feeds TransitCommands into
// stepTransit on a fixed timestep and draws whatever the sim state says.

import { COMBAT, SIM, WORLD } from '../data/tuning';
import { stepTransit } from '../sim/transit';
import type { RNG } from '../sim/rng';
import type {
  AutoSystem,
  Ship,
  TargetPriority,
  Threat,
  TransitCommand,
  TransitState,
} from '../sim/types';
import { h } from './dom';

/** Placeable abilities/weapons the HUD can arm; the next map tap places them. */
type ArmedAbility = 'ecm' | 'scan' | 'sonar' | 'smoke' | 'dc';

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
const SCALE = CANVAS_W / WORLD.width; // 0.64
const OFFSET_Y = (CANVAS_H - WORLD.height * SCALE) / 2;
/** Second tap within this long (ms) counts as a double-tap → station the escort
 *  (pause it). A lone tap after the window sends it and it resumes forward. */
const DOUBLE_MS = 300;

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
  /** A first escort-destination tap awaiting a possible second (double) tap. */
  private escortTap: { x: number; y: number; escortId: number; timer: number } | null = null;
  /** An armed placeable ability: the next map tap places it. */
  private armedAbility: ArmedAbility | null = null;
  /** Depth-charge shot ids whose detonation blast has been drawn. */
  private dcDetonationsSeen = new Set<number>();
  /** Which threat a tap on a cluster of missiles resolves to. A player
   *  preference, persisted on the campaign (see onTargetPriorityChange). */
  private targetPriority: TargetPriority;

  // HUD elements updated per-frame
  private hudInfo!: HTMLElement;
  private hudQuota!: HTMLElement;
  private hudAmmo!: HTMLElement;
  private selInfo!: HTMLElement;
  private ecmBtn!: HTMLButtonElement;
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
    this.hudTop = h('div', { attrs: { id: 'hud-top' } });
    this.hudBottom = h('div', { attrs: { id: 'hud-bottom' } });
    this.toast = h('div', { attrs: { id: 'toast' } });
    this.buildHud();
    this.elements.push(this.canvas, this.hudTop, this.hudBottom, this.toast);
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
    this.lastNow = performance.now();
    requestAnimationFrame(this.frame);
  }

  // -------------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------------

  private buildHud(): void {
    this.hudInfo = h('span');
    this.hudQuota = h('span', { className: 'hud-quota', attrs: { title: 'Active delivery quota' } });
    this.hudAmmo = h('span');
    this.selInfo = h('span', { attrs: { id: 'sel-info' } });
    this.hudTop.append(
      this.hudInfo,
      this.hudQuota,
      h('span', { className: 'spacer' }),
      this.selInfo,
      this.hudAmmo,
    );

    this.ecmBtn = h('button', {
      className: 'hud-btn',
      onClick: () => this.armAbility('ecm'),
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
      text: '⏸',
      onClick: () => {
        this.paused = !this.paused;
        this.pauseBtn.textContent = this.paused ? '▶' : '⏸';
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
          this.showToast(`${toggle.hint}: ${enabled ? 'ON' : 'OFF'} (manual fire always available)`);
        },
      });
      btn.title = `${toggle.hint} — tap to toggle. Manual fire is never disabled.`;
      this.autoBtns.set(toggle.system, btn);
      autoGroup.append(btn);
    }

    this.hudBottom.append(
      this.ecmBtn,
      this.scanBtn,
      this.sonarBtn,
      this.smokeBtn,
      this.dcBtn,
      this.rebootBtn,
      this.targetBtn,
      autoGroup,
      h('span', { className: 'spacer' }),
      h('div', { className: 'hud-group' }, [this.pauseBtn, this.speedBtn]),
    );
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
    this.hudInfo.textContent =
      `Round ${this.round}   ·   Delivered ${s.delivered}/${s.launched}` +
      (s.lost > 0 ? `   ·   Lost ${s.lost}` : '') +
      `   ·   Confidence ${this.confidence}`;

    // Live quota: cargo points already banked this window PLUS this round's
    // delivered value so far, so the player watches the active quota climb
    // ship by ship as the convoy crosses. A distinct pill (not folded into the
    // info string) so it stays legible and easy to track at a glance.
    const quotaLive = this.quotaEarnedBefore + s.valueDelivered;
    this.hudQuota.textContent = `Quota ${quotaLive}/${this.quotaNeeded}`;
    this.hudQuota.classList.toggle('quota-met', quotaLive >= this.quotaNeeded);
    const t = this.state;
    const dcEquipped = t.escortModules.includes('depthCharges');
    const dcReady = t.escorts.filter((e) => e.alive && e.dcShots > 0 && e.dcCooldown <= 0).length;
    this.hudAmmo.textContent =
      `Interceptors: ${t.ammo}` +
      (t.effects.sweepDrones ? `   ·   Drones: ${t.droneAmmo}` : '') +
      (dcEquipped ? `   ·   DC ready: ${dcReady}` : '');

    // Clear the escort selection if that escort is gone or was destroyed.
    if (
      this.selectedEscort !== null &&
      !t.escorts.some((e) => e.id === this.selectedEscort && e.alive)
    ) {
      this.selectedEscort = null;
    }
    const armedHints: Record<ArmedAbility, string> = {
      scan: 'Tap a lane to send the scan plane down it',
      ecm: 'Tap open water to deploy the ECM plane',
      sonar: 'Tap the water to place the active sonar ping',
      smoke: 'Tap the water to lay the defensive smoke',
      dc: 'Tap a point in the WATER — the nearest ready escort lobs depth charges there',
    };
    this.selInfo.textContent = this.armedAbility
      ? armedHints[this.armedAbility]
      : this.selectedEscort !== null
        ? 'Escort selected — tap to send · double-tap to pause'
        : t.jammingSeconds > 0
          ? `⚠ SENSOR JAMMING — ${Math.ceil(t.jammingSeconds)}s`
          : '';

    this.targetBtn.innerHTML = `TARGET<span class="charges">${TARGET_PRIORITY_LABEL[this.targetPriority]}</span>`;
    this.targetBtn.title = TARGET_PRIORITY_HINT[this.targetPriority];

    const ecmActive = t.time < t.ecmActiveUntil;
    this.ecmBtn.innerHTML = `ECM<span class="charges">${
      ecmActive ? 'ACTIVE' : `×${t.ecmCharges}`
    }</span>`;
    this.ecmBtn.disabled = t.ecmCharges <= 0 && !ecmActive;
    this.ecmBtn.classList.toggle('off', t.ecmCharges <= 0 && !ecmActive);
    this.ecmBtn.classList.toggle('armed', this.armedAbility === 'ecm');
    this.ecmBtn.classList.toggle('hidden', t.ecmCharges <= 0 && !ecmActive && t.stats.counter.charges.ecm.available === 0);

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
      if (cmd.ability === 'ecm' && this.state.time < this.state.ecmActiveUntil) return;
    }
    this.pending.push(cmd);
  }

  /** Arm (or disarm) a placeable ability/weapon. The next map tap places it. */
  private armAbility(ability: ArmedAbility): void {
    if (this.state.over || this.paused) return;
    if (ability === 'ecm' && (this.state.ecmCharges <= 0 || this.state.time < this.state.ecmActiveUntil)) return;
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
  }

  private cancelEscortTap(): void {
    if (this.escortTap) {
      clearTimeout(this.escortTap.timer);
      this.escortTap = null;
    }
  }

  private onPointerDown = (ev: PointerEvent): void => {
    ev.preventDefault(); // keep taps from starting scroll/zoom gestures on iOS
    if (this.paused || this.state.over) return;
    const rect = this.canvas.getBoundingClientRect();
    const cx = ((ev.clientX - rect.left) / rect.width) * CANVAS_W;
    const cy = ((ev.clientY - rect.top) / rect.height) * CANVAS_H;
    const wx = cx / SCALE;
    const wy = (cy - OFFSET_Y) / SCALE;

    // 0) If an ability/weapon is armed, this tap places it where the player
    //    touched. Scan: the Y picks a lane. ECM: a plane deploys to the tapped
    //    water. Sonar/smoke: a placed area effect. DC: the nearest ready escort
    //    lobs depth charges at the point (an AREA attack — never a lock-on).
    if (this.armedAbility) {
      const ability = this.armedAbility;
      if (ability === 'dc') {
        this.queue({ type: 'depthCharge', x: wx, y: wy });
      } else {
        this.queue({ type: 'ability', ability, x: wx, y: wy });
      }
      this.armedAbility = null;
      return;
    }

    // Generous mobile-friendly tap radius (in world units).
    const tapRadius = 42 / SCALE;

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
      if (d >= tapRadius) continue;
      const claimedBand = inbound.has(threat.id) ? 1 : 0;
      let modeBand = 0;
      if (this.targetPriority === 'protectShips') {
        modeBand = threat.targetKind === 'base' ? 2 : 0;
      } else if (this.targetPriority === 'threat') {
        modeBand = threat.kind === 'guidedMissile' ? 0 : 2;
      }
      // Band dominates (each unit is worth a full tapRadius, always bigger
      // than any in-radius distance); distance only breaks ties within a band.
      const key = (modeBand + claimedBand) * tapRadius + d;
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
      let bestBoatD = tapRadius;
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
      let bestMineD = tapRadius;
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

    // 3) A tap near a living escort selects it (only escorts are player-directed).
    let bestEscort: number | null = null;
    let bestEscortD = tapRadius;
    for (const escort of this.state.escorts) {
      if (!escort.alive) continue;
      const d = Math.hypot(escort.x - wx, escort.y - wy);
      if (d < bestEscortD) {
        bestEscort = escort.id;
        bestEscortD = d;
      }
    }
    if (bestEscort !== null) {
      this.cancelEscortTap();
      this.selectedEscort = this.selectedEscort === bestEscort ? null : bestEscort;
      return;
    }

    // 4) With an escort selected, an open-water tap sets its destination:
    //    single tap → move there and resume forward; double-tap → pause there.
    if (this.selectedEscort !== null) {
      const escortId = this.selectedEscort;
      const near =
        this.escortTap &&
        this.escortTap.escortId === escortId &&
        Math.hypot(this.escortTap.x - wx, this.escortTap.y - wy) < 70 / SCALE;
      if (near) {
        // Second tap → double-tap → station (pause) the escort.
        this.cancelEscortTap();
        this.queue({ type: 'moveEscort', escortId, x: wx, y: wy, hold: true });
        this.showToast('Escort holding position');
        this.selectedEscort = null;
      } else {
        // First tap: wait briefly for a possible second tap before committing
        // to a plain move (which lets the escort resume forward on arrival).
        this.cancelEscortTap();
        const timer = window.setTimeout(() => {
          this.queue({ type: 'moveEscort', escortId, x: wx, y: wy, hold: false });
          this.selectedEscort = null;
          this.escortTap = null;
        }, DOUBLE_MS);
        this.escortTap = { x: wx, y: wy, escortId, timer };
      }
      return;
    }
  };

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
    this.cancelEscortTap();
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
          maxRadius: shot.blastRadius * SCALE,
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
          maxRadius: threat.kind === 'mine' ? 42 : 26,
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
          maxRadius: 55,
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
          maxRadius: 48,
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

  private sx(wx: number): number {
    return wx * SCALE;
  }
  private sy(wy: number): number {
    return wy * SCALE + OFFSET_Y;
  }

  private render(now: number): void {
    const ctx = this.ctx;
    const t = this.state;

    // Water
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#0e2334');
    grad.addColorStop(1, '#0a1a2a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

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
        ctx.arc(gx, gy, COMBAT.artillery.range[gun.variant] * SCALE, 0, Math.PI * 2);
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
    ctx.fillRect(this.sx(WORLD.deliverX), OFFSET_Y, CANVAS_W - this.sx(WORLD.deliverX), WORLD.height * SCALE);

    // ECM jamming orbit — drawn around each deployed ECM plane while on station.
    const ecmRadius = t.effects.abilities.ecm.radius;
    for (const ac of t.aircraft) {
      if (ac.role !== 'ecm' || ac.phase !== 'onStation') continue;
      const cx = this.sx(ac.centerX);
      const cy = this.sy(ac.centerY);
      const pulse = 1 + 0.04 * Math.sin(now / 120);
      ctx.fillStyle = 'rgba(199, 146, 234, 0.08)';
      ctx.beginPath();
      ctx.arc(cx, cy, ecmRadius * SCALE * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(199, 146, 234, 0.5)';
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, ecmRadius * SCALE * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Placed area effects: active sonar pings (blue) and defensive smoke (grey).
    for (const fx of t.areaEffects) {
      const cx = this.sx(fx.x);
      const cy = this.sy(fx.y);
      const r = fx.radius * SCALE;
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

    // Mines (revealed only)
    for (const mine of t.threats) {
      if (mine.kind !== 'mine' || !mine.alive || !mine.revealed) continue;
      const x = this.sx(mine.x);
      const y = this.sy(mine.y);
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

    // Escorts (player-directed). Draw a route to the destination when moving.
    for (const escort of t.escorts) {
      if (!escort.alive) continue; // destroyed escorts leave the map
      const x = this.sx(escort.x);
      const y = this.sy(escort.y);
      const isSel = escort.id === this.selectedEscort;
      const disabled = t.time < escort.disabledUntil;

      if (escort.moveTarget) {
        const tx = this.sx(escort.moveTarget.x);
        const ty = this.sy(escort.moveTarget.y);
        const hold = escort.moveTarget.hold;
        ctx.strokeStyle = isSel ? 'rgba(77, 195, 255, 0.6)' : 'rgba(120, 180, 220, 0.3)';
        ctx.setLineDash([5, 6]);
        ctx.lineWidth = 1.5;
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

      if (isSel) {
        ctx.strokeStyle = '#4dc3ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
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
        ctx.arc(x, y, t.effects.escort.autoRadius * SCALE, 0, Math.PI * 2);
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
      const ang = Math.atan2(threat.vy, threat.vx);
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
      // An attached boat draws a grapple line to the hull it is working on, so
      // "closing" and "alongside and killing her" never look the same.
      if (threat.engaging) {
        const victim = t.ships.find((s) => s.id === threat.targetShipId && s.alive);
        if (victim) {
          ctx.strokeStyle =
            threat.boatVariant === 'boarding' ? 'rgba(224, 138, 94, 0.9)' : 'rgba(216, 98, 106, 0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(this.sx(victim.x), this.sy(victim.y));
          ctx.stroke();
        }
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
      const r = fx.radius * SCALE;
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
      ctx.arc(ix, iy, COMBAT.artillery.splashRadius * SCALE, 0, Math.PI * 2);
      ctx.stroke();
      const sx2 = this.sx(shell.x);
      const sy2 = this.sy(shell.y);
      ctx.strokeStyle = 'rgba(255, 196, 120, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx2, sy2);
      ctx.lineTo(sx2 - shell.vx * 0.05 * SCALE, sy2 - shell.vy * 0.05 * SCALE);
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
      ctx.arc(this.sx(shot.targetX), this.sy(shot.targetY), shot.blastRadius * SCALE, 0, Math.PI * 2);
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

    // Support aircraft (scan / ECM planes).
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
        ctx.fillRect(ax, laneY - laneHalf * SCALE, CANVAS_W - ax, laneHalf * 2 * SCALE);
        ctx.strokeStyle = 'rgba(77, 195, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ax, ay, 14 + 3 * Math.sin(now / 120), 0, Math.PI * 2);
        ctx.stroke();
      }
      this.drawPlane(ax, ay, ac.heading, ac.role === 'ecm' ? '#c792ea' : '#7ce7ff');
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
        ctx.arc(x, y, fx.maxRadius * SCALE * progress, 0, Math.PI * 2);
        ctx.stroke();
      } else if (fx.kind === 'intercept') {
        ctx.strokeStyle = `rgba(160, 230, 255, ${1 - progress})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, fx.maxRadius * progress, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(255, ${140 - 80 * progress}, 60, ${0.8 * (1 - progress)})`;
        ctx.beginPath();
        ctx.arc(x, y, fx.maxRadius * (0.4 + 0.6 * progress), 0, Math.PI * 2);
        ctx.fill();
      }
    }

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
