// Transit phase view: canvas rendering, pointer input, and the HUD.
// The view owns nothing about game rules — it feeds TransitCommands into
// stepTransit on a fixed timestep and draws whatever the sim state says.

import { COMBAT, SIM, WORLD } from '../data/tuning';
import { stepTransit } from '../sim/transit';
import type { RNG } from '../sim/rng';
import type {
  Ship,
  Threat,
  TransitCommand,
  TransitState,
} from '../sim/types';
import { h } from './dom';

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
  private armedAbility: 'ecm' | 'scan' | null = null;

  // HUD elements updated per-frame
  private hudInfo!: HTMLElement;
  private hudAmmo!: HTMLElement;
  private selInfo!: HTMLElement;
  private ecmBtn!: HTMLButtonElement;
  private scanBtn!: HTMLButtonElement;
  private pauseBtn!: HTMLButtonElement;
  private speedBtn!: HTMLButtonElement;

  constructor(
    stage: HTMLElement,
    private readonly state: TransitState,
    private readonly rng: RNG,
    private readonly round: number,
    private readonly confidence: number,
    private readonly showTutorial: boolean,
    private readonly onDone: (t: TransitState) => void,
  ) {
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
    this.hudAmmo = h('span');
    this.selInfo = h('span', { attrs: { id: 'sel-info' } });
    this.hudTop.append(
      this.hudInfo,
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

    this.hudBottom.append(
      this.ecmBtn,
      this.scanBtn,
      h('span', { className: 'spacer' }),
      h('div', { className: 'hud-group' }, [this.pauseBtn, this.speedBtn]),
    );
  }

  private updateHud(): void {
    const s = this.state.stats;
    this.hudInfo.textContent =
      `Round ${this.round}   ·   Delivered ${s.delivered}/${s.launched}` +
      (s.lost > 0 ? `   ·   Lost ${s.lost}` : '') +
      `   ·   Confidence ${this.confidence}`;
    this.hudAmmo.textContent =
      `Interceptors: ${this.state.ammo}` +
      (this.state.effects.sweepDrones ? `   ·   Drones: ${this.state.droneAmmo}` : '');

    // Clear the escort selection if that escort is gone or was destroyed.
    if (
      this.selectedEscort !== null &&
      !this.state.escorts.some((e) => e.id === this.selectedEscort && e.alive)
    ) {
      this.selectedEscort = null;
    }
    this.selInfo.textContent = this.armedAbility
      ? this.armedAbility === 'scan'
        ? 'Tap a lane to send the scan plane down it'
        : 'Tap open water to deploy the ECM plane'
      : this.selectedEscort !== null
        ? 'Escort selected — tap to send · double-tap to pause'
        : '';

    const ecmActive = this.state.time < this.state.ecmActiveUntil;
    this.ecmBtn.innerHTML = `ECM<span class="charges">${
      ecmActive ? 'ACTIVE' : `×${this.state.ecmCharges}`
    }</span>`;
    this.ecmBtn.disabled = this.state.ecmCharges <= 0 && !ecmActive;
    this.ecmBtn.classList.toggle('off', this.state.ecmCharges <= 0 && !ecmActive);
    this.ecmBtn.classList.toggle('armed', this.armedAbility === 'ecm');

    this.scanBtn.innerHTML = `SCAN<span class="charges">×${this.state.scanCharges}</span>`;
    this.scanBtn.disabled = this.state.scanCharges <= 0;
    this.scanBtn.classList.toggle('off', this.state.scanCharges <= 0);
    this.scanBtn.classList.toggle('armed', this.armedAbility === 'scan');
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

  /** Arm (or disarm) a placeable ability. The next map tap places it. */
  private armAbility(ability: 'ecm' | 'scan'): void {
    if (this.state.over || this.paused) return;
    if (ability === 'ecm' && (this.state.ecmCharges <= 0 || this.state.time < this.state.ecmActiveUntil)) return;
    if (ability === 'scan' && this.state.scanCharges <= 0) return;
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

    // 0) If an ability is armed, this tap places it where the player touched.
    //    Scan: the Y picks a lane and a plane flies it. ECM: a plane deploys to
    //    the tapped water (rejected on land, see the sim). The aircraft itself is
    //    the visual feedback, so no placed ripple is drawn here.
    if (this.armedAbility) {
      const ability = this.armedAbility;
      this.queue({ type: 'ability', ability, x: wx, y: wy });
      this.armedAbility = null;
      return;
    }

    // Generous mobile-friendly tap radius (in world units).
    const tapRadius = 42 / SCALE;

    // 1) A tap near an incoming missile fires an interceptor at it. When several
    //    missiles are bunched under one tap, prefer the one that does NOT already
    //    have an interceptor inbound, so a tap defaults to a fresh target instead
    //    of doubling up. (Doubling up is still possible — tap the same one again.)
    const inbound = new Set(
      this.state.interceptors
        .filter((i) => i.launcher !== 'pd')
        .map((i) => i.targetThreatId),
    );
    let bestThreat: Threat | null = null;
    let bestThreatKey = Infinity;
    for (const threat of this.state.threats) {
      if (!threat.alive || threat.kind === 'mine') continue;
      const d = Math.hypot(threat.x - wx, threat.y - wy);
      if (d >= tapRadius) continue;
      // Sort key: un-targeted missiles (band 0) always beat targeted ones
      // (band 1); within a band, nearest to the tap wins.
      const key = (inbound.has(threat.id) ? tapRadius : 0) + d;
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
        case 'techDebut':
          if (ev.detail === 'guidedMissile') this.showToast('Warning: missile is maneuvering!');
          break;
        default:
          break;
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
    for (const ac of t.aircraft) {
      if (ac.role !== 'ecm' || ac.phase !== 'onStation') continue;
      const cx = this.sx(ac.centerX);
      const cy = this.sy(ac.centerY);
      const pulse = 1 + 0.04 * Math.sin(now / 120);
      ctx.fillStyle = 'rgba(199, 146, 234, 0.08)';
      ctx.beginPath();
      ctx.arc(cx, cy, COMBAT.ecm.radius * SCALE * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(199, 146, 234, 0.5)';
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, COMBAT.ecm.radius * SCALE * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
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
        ctx.arc(x, y - 2, 16, -Math.PI / 2, -Math.PI / 2 + (1 - base.cooldown / COMBAT.base.reload) * Math.PI * 2);
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
        ctx.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + (1 - escort.cooldown / COMBAT.interceptor.cooldown) * Math.PI * 2);
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

    // Missiles with trails
    for (const threat of t.threats) {
      if (!threat.alive || threat.kind === 'mine') continue;

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

      // Missile-Warning Receiver module: mark the hunted ship.
      if (threat.kind === 'guidedMissile') {
        const target = t.ships.find(
          (s) => s.id === threat.targetShipId && s.alive && !s.delivered,
        );
        if (target?.modules.includes('missileWarning')) {
          const px = this.sx(target.x);
          const py = this.sy(target.y);
          const blink = Math.sin(now / 110) > 0;
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

    // Interceptors (player launches = cyan dots) and point-defense tracers
    // (bright streaks flying at their target so nothing is deleted silently).
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
      } else {
        ctx.fillStyle = '#7ce7ff';
        ctx.beginPath();
        ctx.arc(ix, iy, 3.5, 0, Math.PI * 2);
        ctx.fill();
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
        // lane it is charting reads clearly.
        const laneY = this.sy(ac.laneY);
        ctx.fillStyle = 'rgba(77, 195, 255, 0.06)';
        ctx.fillRect(ax, laneY - COMBAT.scan.laneHalfWidth * SCALE, CANVAS_W - ax, COMBAT.scan.laneHalfWidth * 2 * SCALE);
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
