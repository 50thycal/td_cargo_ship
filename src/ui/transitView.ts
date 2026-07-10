// Transit phase view: canvas rendering, pointer input, and the HUD.
// The view owns nothing about game rules — it feeds TransitCommands into
// stepTransit on a fixed timestep and draws whatever the sim state says.

import { COMBAT, SIM, WORLD } from '../data/tuning';
import { FORMATIONS } from '../data/defs';
import { stepTransit } from '../sim/transit';
import type { RNG } from '../sim/rng';
import type {
  FormationId,
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
  private tutorialTip: HTMLElement | null = null;
  private tutorialDismissed = false;

  // HUD elements updated per-frame
  private hudInfo!: HTMLElement;
  private hudAmmo!: HTMLElement;
  private ecmBtn!: HTMLButtonElement;
  private scanBtn!: HTMLButtonElement;
  private pauseBtn!: HTMLButtonElement;
  private speedBtn!: HTMLButtonElement;
  private formationBtns = new Map<FormationId, HTMLButtonElement>();

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
    this.hudTop.append(
      this.hudInfo,
      h('span', { className: 'spacer' }),
      this.hudAmmo,
    );

    this.ecmBtn = h('button', {
      className: 'hud-btn',
      onClick: () => this.queue({ type: 'ability', ability: 'ecm' }),
    });
    this.scanBtn = h('button', {
      className: 'hud-btn',
      onClick: () => this.queue({ type: 'ability', ability: 'scan' }),
    });

    const formationGroup = h('div', { className: 'hud-group' });
    for (const id of Object.keys(FORMATIONS) as FormationId[]) {
      const btn = h('button', {
        className: 'hud-btn',
        text: FORMATIONS[id].name,
        onClick: () => this.queue({ type: 'formation', formation: id }),
      });
      this.formationBtns.set(id, btn);
      formationGroup.append(btn);
    }

    const laneUp = h('button', {
      className: 'hud-btn',
      text: '▲ Lane',
      onClick: () => this.queue({ type: 'lane', direction: -1 }),
    });
    const laneDown = h('button', {
      className: 'hud-btn',
      text: '▼ Lane',
      onClick: () => this.queue({ type: 'lane', direction: 1 }),
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
        this.speed = this.speed === 1 ? 2 : 1;
        this.speedBtn.textContent = `${this.speed}×`;
      },
    });

    this.hudBottom.append(
      this.ecmBtn,
      this.scanBtn,
      h('span', { className: 'spacer' }),
      formationGroup,
      h('span', { className: 'spacer' }),
      h('div', { className: 'hud-group' }, [laneUp, laneDown]),
      h('div', { className: 'hud-group' }, [this.pauseBtn, this.speedBtn]),
    );
  }

  private updateHud(): void {
    const s = this.state.stats;
    this.hudInfo.textContent =
      `Round ${this.round}   ·   Delivered ${s.delivered}/${s.launched}` +
      (s.lost > 0 ? `   ·   Lost ${s.lost}` : '') +
      `   ·   Confidence ${this.confidence}`;
    this.hudAmmo.textContent = `Interceptors: ${this.state.ammo}`;

    const ecmActive = this.state.time < this.state.ecmActiveUntil;
    this.ecmBtn.innerHTML = `ECM<span class="charges">${
      ecmActive ? 'ACTIVE' : `×${this.state.ecmCharges}`
    }</span>`;
    this.ecmBtn.disabled = this.state.ecmCharges <= 0 && !ecmActive;
    this.ecmBtn.classList.toggle('off', this.state.ecmCharges <= 0 && !ecmActive);

    this.scanBtn.innerHTML = `SCAN<span class="charges">×${this.state.scanCharges}</span>`;
    this.scanBtn.disabled = this.state.scanCharges <= 0;
    this.scanBtn.classList.toggle('off', this.state.scanCharges <= 0);

    for (const [id, btn] of this.formationBtns) {
      btn.classList.toggle('selected', this.state.formation === id);
    }
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  private queue(cmd: TransitCommand): void {
    if (this.state.over || this.paused) return;
    // Ability taps must not stack: a double-tap (or two taps in one frame)
    // would otherwise burn two charges for one activation.
    if (cmd.type === 'ability') {
      if (this.pending.some((p) => p.type === 'ability' && p.ability === cmd.ability)) return;
      if (cmd.ability === 'ecm' && this.state.time < this.state.ecmActiveUntil) return;
    }
    this.pending.push(cmd);
  }

  private onPointerDown = (ev: PointerEvent): void => {
    ev.preventDefault(); // keep taps from starting scroll/zoom gestures on iOS
    if (this.paused || this.state.over) return;
    const rect = this.canvas.getBoundingClientRect();
    const cx = ((ev.clientX - rect.left) / rect.width) * CANVAS_W;
    const cy = ((ev.clientY - rect.top) / rect.height) * CANVAS_H;
    const wx = cx / SCALE;
    const wy = (cy - OFFSET_Y) / SCALE;

    // Generous mobile-friendly tap radius (in world units).
    const tapRadius = 42 / SCALE;
    let best: Threat | null = null;
    let bestD = tapRadius;
    for (const threat of this.state.threats) {
      if (!threat.alive || threat.kind === 'mine' || threat.claimedByInterceptor) continue;
      const d = Math.hypot(threat.x - wx, threat.y - wy);
      if (d < bestD) {
        best = threat;
        bestD = d;
      }
    }
    if (best) {
      this.queue({ type: 'intercept', threatId: best.id });
      this.dismissTutorial();
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
          this.showToast(`${ev.shipName} lost!`);
          break;
        case 'mineRevealed':
          this.showToast(ev.lowSig ? 'Low-signature mine detected!' : 'Mine detected ahead!');
          break;
        case 'techDebut':
          if (ev.detail === 'guidedMissile') this.showToast('Warning: missile is maneuvering!');
          break;
        case 'abilityUsed':
          if (ev.detail === 'scan') {
            const cx = this.state.anchorX + 220;
            this.effects.push({
              kind: 'scan',
              x: cx,
              y: this.state.laneY,
              start: now,
              duration: 900,
              maxRadius: COMBAT.scan.radius,
            });
          }
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
    // Active lane marker
    ctx.strokeStyle = 'rgba(120, 190, 255, 0.25)';
    ctx.strokeRect(0, this.sy(t.targetLaneY) - 4, CANVAS_W, 8);

    // Exit zone
    const exitGrad = ctx.createLinearGradient(this.sx(WORLD.deliverX), 0, CANVAS_W, 0);
    exitGrad.addColorStop(0, 'rgba(89, 217, 140, 0.0)');
    exitGrad.addColorStop(1, 'rgba(89, 217, 140, 0.28)');
    ctx.fillStyle = exitGrad;
    ctx.fillRect(this.sx(WORLD.deliverX), OFFSET_Y, CANVAS_W - this.sx(WORLD.deliverX), WORLD.height * SCALE);

    // ECM aura
    if (t.time < t.ecmActiveUntil) {
      const cx = this.sx(t.anchorX - 80);
      const cy = this.sy(t.laneY);
      const pulse = 1 + 0.04 * Math.sin(now / 120);
      ctx.strokeStyle = 'rgba(199, 146, 234, 0.5)';
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 210 * pulse, 0, Math.PI * 2);
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
    }

    // Ships
    for (const ship of t.ships) {
      if (!ship.alive || ship.delivered) continue;
      this.drawShip(ship);
    }

    // Escorts
    for (const escort of t.escorts) {
      const x = this.sx(escort.x);
      const y = this.sy(escort.y);
      ctx.fillStyle = '#c9d4de';
      ctx.beginPath();
      ctx.moveTo(x + 12, y);
      ctx.lineTo(x + 4, y - 5);
      ctx.lineTo(x - 10, y - 5);
      ctx.lineTo(x - 12, y);
      ctx.lineTo(x - 10, y + 5);
      ctx.lineTo(x + 4, y + 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5b6b7a';
      ctx.fillRect(x - 5, y - 2.5, 6, 5);
      if (escort.cooldown > 0) {
        ctx.strokeStyle = 'rgba(255, 200, 87, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + (1 - escort.cooldown / COMBAT.interceptor.cooldown) * Math.PI * 2);
        ctx.stroke();
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

      // Tap affordance ring / claimed marker
      if (threat.claimedByInterceptor) {
        ctx.strokeStyle = 'rgba(120, 220, 255, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const pulse = 12 + 2.5 * Math.sin(now / 160);
        ctx.strokeStyle = 'rgba(255, 190, 120, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Interceptors
    ctx.fillStyle = '#7ce7ff';
    for (const interceptor of t.interceptors) {
      ctx.beginPath();
      ctx.arc(this.sx(interceptor.x), this.sy(interceptor.y), 3.5, 0, Math.PI * 2);
      ctx.fill();
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

    ctx.fillStyle = SHIP_COLORS[ship.classId] ?? '#9ab';
    ctx.beginPath();
    ctx.moveTo(x + len, y);
    ctx.lineTo(x + len - 6, y - wid);
    ctx.lineTo(x - len, y - wid);
    ctx.lineTo(x - len, y + wid);
    ctx.lineTo(x + len - 6, y + wid);
    ctx.closePath();
    ctx.fill();

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
      ctx.fillRect(x - 12, y - wid - 8, 24, 3);
      ctx.fillStyle = frac > 0.5 ? '#59d98c' : frac > 0.25 ? '#ffc857' : '#ff6b6b';
      ctx.fillRect(x - 12, y - wid - 8, 24 * frac, 3);
    }
  }
}
