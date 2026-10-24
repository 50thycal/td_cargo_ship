// V2 app shell: menu → game → (draft between waves) → result. Owns the frame
// loop, the two side rails and the HUD. The sim never sees the DOM; this file
// turns pointer input into `tap()` calls and draws whatever the sim holds.

import {
  CARRIER,
  DEFAULT_SPEED,
  FLOW_STEPS,
  RULES,
  SPEED_STEPS,
  TAP_RADIUS_PX,
  THREATS,
  VIEW,
  type ThreatKind,
} from '../data/config';
import { FORMATIONS, FORMATION_ORDER, type FormationId } from '../data/formations';
import { MAPS, MAP_ORDER, type MapId } from '../data/maps';
import { UPGRADES } from '../data/upgrades';
import { loadProgress, recordResult, type Progress } from '../platform/save';
import {
  createGame,
  step,
  type Game,
  type Phase,
} from '../sim/game';
import { Recorder } from '../sim/playlog';
import { downloadLog, flushUnsent, storeLog, type UploadState } from '../platform/playlogStore';
import { stepSlider, type StepSlider } from './rail';
import { DRY_LIFE, RIPPLE_LIFE, drawFrame, type Ripple } from './render';

const DT = 1 / 60;
const RAIL_W = 72;
/** Margin kept on the landscape side WITHOUT the Dynamic Island (rounded corners only). */
const CORNER_INSET = 16;

const DEBUT_HINT: Record<ThreatKind, string> = {
  drone: 'Slow, in swarms. Tap each one.',
  ballistic: 'Fast arc. The red circle is where it lands.',
  guided: 'Homes on a ship. Takes two hits.',
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
  private flowSlider!: StepSlider;
  private speedSlider!: StepSlider;

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
    root.append(this.canvas, this.banner, this.leftRail, this.rightRail, this.overlay, this.rotateNote, this.safeProbe);
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
  private endRun(end: 'won' | 'lost' | 'quit'): void {
    if (!this.rec) return;
    const log = this.rec.finish(end);
    if (end !== 'won') this.rec = null;
    this.logState = null;
    void storeLog(log).then((state) => {
      this.logState = state;
      this.renderLogStatus(log);
    });
  }

  start(): void {
    void flushUnsent();
    // Closing the tab mid-run still leaves a log.
    window.addEventListener('pagehide', () => {
      if (this.game && (this.game.phase === 'wave' || this.game.phase === 'draft')) this.endRun('quit');
    });
    // Test hook for the browser smoke test: read the game, map world → screen.
    (window as unknown as { __v2: unknown }).__v2 = {
      game: () => this.game,
      toClient: (x: number, y: number) => ({ x: this.offX + x * this.scale, y: this.offY + y * this.scale }),
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
    );
    for (const id of FORMATION_ORDER) {
      const f = FORMATIONS[id];
      const opt = button('', 'v2-formation-opt', () => {
        this.rec?.formation(id);
        this.formationPop.classList.remove('open');
        this.syncFormation();
      });
      opt.dataset.formation = id;
      opt.append(formationGlyph(id), el('strong', '', f.name), el('span', '', f.hint));
      this.formationPop.append(opt);
    }
    this.leftRail.append(this.formationPop);

    this.speedSlider = stepSlider(
      SPEED_STEPS.length,
      DEFAULT_SPEED,
      (s) => `${SPEED_STEPS[s]}×`,
      (s) => {
        this.speed = SPEED_STEPS[s];
        this.rec?.speed(this.speed);
      },
    );
    this.rightRail.append(this.hud, this.pauseBtn, el('div', 'v2-rail-label', 'SPEED'), this.speedSlider.el);
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
      const w = this.toWorld(e.clientX, e.clientY);
      if (!w || !this.game || this.paused) return;
      this.fire(w.x, w.y);
      this.hold = { ...w, since: performance.now(), next: this.game.t + 0.25, id: e.pointerId };
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.hold || this.hold.id !== e.pointerId) return;
      const w = this.toWorld(e.clientX, e.clientY);
      if (w) Object.assign(this.hold, w);
    });
    const end = (e: PointerEvent) => {
      if (this.hold?.id === e.pointerId) this.hold = null;
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
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

  private resize(): void {
    const w = this.root.clientWidth || window.innerWidth;
    const h = this.root.clientHeight || window.innerHeight;
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
    const w = this.root.clientWidth || window.innerWidth;
    const h = this.root.clientHeight || window.innerHeight;
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
    if (g && !this.paused && !this.portrait && g.phase === 'wave') {
      this.acc += real * this.speed;
      let n = 0;
      while (this.acc >= DT && n < 12) {
        step(g, DT);
        this.acc -= DT;
        n++;
        if (g.phase !== 'wave') break;
      }
      // Hold-to-fire repeats on game time, so it scales with the speed slider.
      if (this.hold && g.stats.holdRepeat > 0 && g.t >= this.hold.next) {
        this.fire(this.hold.x, this.hold.y, true);
        this.hold.next = g.t + g.stats.holdRepeat;
      }
    }
    if (g) {
      this.drainEvents(g);
      if (g.phase !== this.lastPhase) this.onPhase(g);
      this.renderHud(g);
    }
    for (const r of this.ripples) r.age += real;
    this.ripples = this.ripples.filter((r) => r.age < (r.dry ? DRY_LIFE : RIPPLE_LIFE));
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
    drawFrame(ctx, this.game, this.ripples, this.shake);
  }

  private drainEvents(g: Game): void {
    for (const ev of g.events) {
      switch (ev.kind) {
        case 'wave':
          this.showBanner(`WAVE ${ev.wave}`, ev.wave === 1 ? 'Tap threats to shoot them down.' : '');
          break;
        case 'debut':
          this.showBanner(`NEW: ${THREATS[ev.threat].label}`, DEBUT_HINT[ev.threat]);
          break;
        case 'shipLost':
          this.shake = 10;
          this.hud.classList.add('hit');
          setTimeout(() => this.hud.classList.remove('hit'), 300);
          break;
        case 'carrierHit':
          this.shake = 16;
          break;
        case 'dry':
          this.hud.classList.add('dry');
          setTimeout(() => this.hud.classList.remove('dry'), 250);
          break;
        case 'pickup':
          break;
      }
    }
    g.events.length = 0;
  }

  private showBanner(title: string, sub: string): void {
    this.banner.replaceChildren(el('strong', '', title), ...(sub ? [el('span', '', sub)] : []));
    this.bannerT = 2.6;
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
    const pips = Array.from({ length: RULES.shipLossLimit }, (_, i) =>
      i < g.lost ? '<i class="lost"></i>' : '<i></i>',
    ).join('');
    const waveLabel = g.endless ? `${g.wave}` : `${g.wave}/${RULES.wavesToClear}`;
    const html =
      `<span><b>WAVE</b>${waveLabel}</span>` +
      `<span><b>SCORE</b>${g.score.toLocaleString()}</span>` +
      `<span class="v2-hud-lost"><b>SUNK</b><em>${pips}</em></span>`;
    if (this.hud.innerHTML !== html) this.hud.innerHTML = html;
  }

  // -------------------------------------------------------------------------
  // Screens

  private onPhase(g: Game): void {
    this.lastPhase = g.phase;
    if (g.phase === 'wave') this.hideOverlay();
    else if (g.phase === 'draft') this.showDraft(g);
    else if (g.phase === 'won') this.showResult(g, true);
    else if (g.phase === 'lost') this.showResult(g, false);
  }

  private showMenu(): void {
    if (this.rec) this.endRun(this.game?.phase === 'won' ? 'won' : 'quit');
    this.rec = null;
    this.game = null;
    this.lastPhase = null;
    this.root.classList.remove('playing');
    const cards = MAP_ORDER.map((id, i) => {
      const m = MAPS[id];
      const locked = i >= this.progress.unlocked;
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
    const classic = el('a', 'v2-classic', 'Play the classic version →');
    classic.href = './index.html';
    // The artifact build ships V2 alone; there is no classic page to link to.
    classic.hidden = 'claude' in window;
    this.showOverlay('v2-menu', [
      el('h1', '', 'STRAITWATCH'),
      el('p', 'v2-tag', 'Keep the convoy alive. Tap the drones and missiles to shoot them down.'),
      el('div', 'v2-map-grid', ''),
      classic,
    ]);
    this.overlay.querySelector('.v2-map-grid')!.append(...cards);
  }

  private play(id: MapId): void {
    // Playtest knobs: ?wave=N starts at wave N, ?seed=N replays one seed.
    const params = new URLSearchParams(location.search);
    const skip = Number(params.get('wave')) || 1;
    const seed = params.has('seed') ? Number(params.get('seed')) : this.seedCounter++;
    if (this.rec) this.endRun('quit');
    this.game = createGame(id, seed, skip);
    this.rec = new Recorder(this.game, {
      build: __BUILD__,
      startedAt: new Date().toISOString(),
      firstWave: skip,
      device: {
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
        touch: navigator.maxTouchPoints > 0,
        ua: navigator.userAgent.slice(0, 160),
      },
    });
    this.lastPhase = null;
    this.acc = 0;
    this.paused = false;
    this.root.classList.add('playing');
    this.flowSlider.set(this.game.flow);
    this.syncFormation();
    this.hideOverlay();
  }

  private showDraft(g: Game): void {
    const cards = g.offer.map((id) => {
      const u = UPGRADES[id];
      const lvl = g.levels[id] ?? 0;
      const card = button('', 'v2-card', () => this.rec?.pick(id));
      card.dataset.upgrade = id;
      card.append(
        el('span', 'v2-card-answers', `vs ${u.answers}`),
        el('strong', '', u.name),
        el('span', 'v2-card-level', `Level ${lvl + 1}/${u.max}`),
        el('span', 'v2-card-text', u.levels[lvl]),
      );
      return card;
    });
    const row = el('div', 'v2-card-row');
    row.append(...cards);
    this.showOverlay('v2-draft', [
      el('h2', '', `Wave ${g.wave} cleared`),
      el('p', 'v2-sub', 'Pick one upgrade.'),
      row,
    ]);
  }

  private showResult(g: Game, won: boolean): void {
    const best = recordResult(this.progress, g.map.id, g.score, g.wave, g.cleared);
    this.endRun(won ? 'won' : 'lost');
    const idx = MAP_ORDER.indexOf(g.map.id);
    const next = MAP_ORDER[idx + 1];
    const stats = el('div', 'v2-stats');
    stats.innerHTML =
      `<span><b>${g.score.toLocaleString()}</b>score${best ? ' · new best!' : ''}</span>` +
      `<span><b>${g.delivered}</b>ships through</span>` +
      `<span><b>${g.lost}</b>ships sunk</span>` +
      `<span><b>${g.kills.drone + g.kills.ballistic + g.kills.guided}</b>shot down</span>`;
    const buttons: HTMLElement[] = [];
    if (won) {
      buttons.push(button('Keep going (endless)', 'v2-btn', () => this.rec?.endless()));
      if (next) buttons.push(button(`Next: ${MAPS[next].name}`, 'v2-btn primary', () => this.play(next)));
    } else {
      buttons.push(button('Try again', 'v2-btn primary', () => this.play(g.map.id)));
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
    this.showOverlay('v2-result', [el('h2', '', title), el('p', 'v2-sub', sub), stats, row, el('p', 'v2-log-status', 'Saving playtest log…')]);
  }

  private renderLogStatus(log: import('../sim/playlog').PlayLog): void {
    const line = this.overlay.querySelector('.v2-log-status');
    if (!line) return;
    if (this.logState === 'sent') {
      line.textContent = 'Playtest log sent to Claude ✓';
      return;
    }
    if (this.logState === 'failed') {
      // Inside the artifact downloads are blocked; the log is resent on next launch.
      line.textContent = 'Log kept on this device; it will be sent to Claude next time you open the game.';
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
    this.overlay.dataset.screen = cls.replace('v2-', '');
  }

  private hideOverlay(): void {
    this.overlay.classList.remove('open');
    this.overlay.replaceChildren();
    delete this.overlay.dataset.screen;
  }
}

const SUNK_BY: Record<ThreatKind, string> = {
  drone: 'Drones did the most damage: Wide Warhead or Chain Detonation thin out swarms.',
  ballistic: 'Ballistics did the most damage: Faster Interceptors and Spread formation help.',
  guided: 'Guided missiles did the most damage: Twin Launch hits them twice per tap.',
};

/** One line naming what sank the most ships, and what answers it. */
function culprit(g: Game): string {
  const top = (Object.keys(g.sunkBy) as ThreatKind[]).sort((a, b) => g.sunkBy[b] - g.sunkBy[a])[0];
  return g.sunkBy[top] > 0 ? SUNK_BY[top] : '';
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
