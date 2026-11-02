// Drawing for the 20-map plan's new things (docs/design/v3-maps-plan.md):
// enemy structures (rigs, shield generators, the Citadel, the Dreadnought),
// allied posts (the radar and the shore batteries), mines and fast boats,
// lock gates, the Delta's switch buoy, the tide, night and words on the map.
// Like render.ts it reads the game and mutates nothing.

import { THREATS } from '../data/config';
import { FORK_RADIUS, highTide, lockCountdown, reticleVisible, shieldUp, tracked, type Game, type Threat } from '../sim/game';
import { laneSamples } from '../sim/lanes';

const RED = '#ff5a3d';
const RIM = '#d94a3a';
const MINT = '#8fe0a2';
const GOLD = '#ffd166';
const CYAN = '#7fe8ff';

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, col: string): void {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, 10);
  ctx.fillStyle = col;
  ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, frac)), 6);
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, col: string, size = 20): void {
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(7,13,18,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = col;
  ctx.fillText(text, x, y);
}

// ---------------------------------------------------------------------------
// Under the convoy: tide flats, lock chambers, words, coves, chutes, wrecks

export function drawMapUnder(ctx: CanvasRenderingContext2D, g: Game): void {
  const m = g.map;
  if (m.tide) drawTide(ctx, g);
  m.locks?.forEach((lock, i) => drawLock(ctx, g, i, lock.x0, lock.x1));
  for (const mk of m.marks ?? []) {
    ctx.globalAlpha = 0.55;
    label(ctx, mk.text, mk.x, mk.y, '#dfeef7', 22);
    ctx.globalAlpha = 1;
  }
  m.bases.forEach((b, i) => {
    if (b.cove) drawCove(ctx, b.x, b.y);
    else if (b.chute) drawChute(ctx, b.x, b.y);
    else if ((b.rig || b.core) && g.baseDown[i]) drawWreck(ctx, b.x, b.y, b.core ? 1.6 : 1, g.t);
    else if (b.generator && g.baseDown[i]) drawWreck(ctx, b.x, b.y, 0.8, g.t);
  });
  if (m.shield && shieldUp(g)) {
    const pulse = 0.5 + 0.5 * Math.sin(g.t * 3);
    ctx.fillStyle = `rgba(127,232,255,${0.06 + 0.05 * pulse})`;
    ctx.strokeStyle = `rgba(127,232,255,${0.5 + 0.35 * pulse})`;
    ctx.lineWidth = 4;
    ctx.setLineDash([16, 10]);
    ctx.beginPath();
    ctx.arc(m.shield.x, m.shield.y, m.shield.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (m.fork) drawFork(ctx, g);
}

function drawTide(ctx: CanvasRenderingContext2D, g: Game): void {
  const t = g.map.tide!;
  const lane = g.map.channels.find((c) => c.tide);
  if (!lane) return;
  const cycle = t.high + t.low;
  const into = g.t % cycle;
  const high = highTide(g);
  // The flats: sand showing at low water, a wet sheen at high.
  const top = lane.y - lane.halfWidth - 50;
  const bot = lane.y + lane.halfWidth + 50;
  ctx.fillStyle = high ? 'rgba(201,183,138,0.07)' : 'rgba(201,183,138,0.42)';
  ctx.fillRect(0, top, 1600, bot - top);
  if (!high) {
    ctx.strokeStyle = 'rgba(120,96,60,0.35)';
    ctx.lineWidth = 2;
    for (let x = -40; x < 1640; x += 46) {
      ctx.beginPath();
      ctx.moveTo(x, top + 10);
      ctx.lineTo(x + 30, bot - 10);
      ctx.stroke();
    }
  }
  // The gauge: time to the turn of the tide.
  const left = high ? t.high - into : cycle - into;
  const frac = high ? left / t.high : left / t.low;
  const gx = 1500;
  const gy = top - 14;
  bar(ctx, gx, gy, 150, frac, high ? CYAN : '#d8c08a');
  label(ctx, high ? `HIGH TIDE · ${Math.ceil(left)} s` : `LOW TIDE · flats closed · ${Math.ceil(left)} s`, gx - 75 + 75, gy - 8, high ? CYAN : '#ead7a4', 18);
}

function drawLock(ctx: CanvasRenderingContext2D, g: Game, i: number, x0: number, x1: number): void {
  const st = g.lockState[i];
  const ch = g.map.channels[0];
  const hw = 66;
  const y = ch.y;
  const filling = st.phase === 'fill';
  // The chamber's water rises while it fills.
  const k = filling ? st.t / (g.map.locks![i].wait || 1) : st.phase === 'out' ? 1 : 0;
  ctx.fillStyle = `rgba(127,200,255,${0.06 + 0.12 * k})`;
  ctx.fillRect(x0, y - hw - 10, x1 - x0, hw * 2 + 20);
  ctx.strokeStyle = 'rgba(255,209,102,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(x0, y - hw - 10, x1 - x0, hw * 2 + 20);
  ctx.setLineDash([]);
  const gate = (x: number, open: boolean) => {
    ctx.fillStyle = open ? 'rgba(255,209,102,0.25)' : GOLD;
    ctx.fillRect(x - 6, y - hw - 16, 12, open ? 22 : hw * 2 + 32);
    if (open) ctx.fillRect(x - 6, y + hw - 6, 12, 22);
    ctx.fillStyle = open ? '#4ade80' : '#ff5a5a';
    ctx.beginPath();
    ctx.arc(x, y - hw - 30, 9, 0, Math.PI * 2);
    ctx.fill();
  };
  gate(x0, st.phase === 'in');
  gate(x1, st.phase === 'out');
  const secs = Math.ceil(lockCountdown(g, i));
  const word = st.phase === 'in' ? `ENTER · ${secs}` : st.phase === 'fill' ? `FILLING · ${secs}` : `LEAVE`;
  label(ctx, word, (x0 + x1) / 2, y + hw + 40, filling ? GOLD : '#dfeef7', 20);
  if (filling) bar(ctx, (x0 + x1) / 2, y + hw + 48, x1 - x0 - 30, st.t / (g.map.locks![i].wait || 1), GOLD);
}

function drawFork(ctx: CanvasRenderingContext2D, g: Game): void {
  const f = g.map.fork!;
  const lane = g.map.channels[f.lanes[g.forkLane % f.lanes.length]];
  // An arrow down the branch the next ships will take.
  const pts = laneSamples(lane, 40).filter((s) => s.p.x > f.x + 20 && s.p.x < f.x + 300);
  if (pts.length > 1) {
    ctx.strokeStyle = 'rgba(255,209,102,0.85)';
    ctx.lineWidth = 6;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    pts.forEach((s, k) => (k ? ctx.lineTo(s.p.x, s.p.y) : ctx.moveTo(s.p.x, s.p.y)));
    ctx.stroke();
    ctx.setLineDash([]);
    const a = pts[pts.length - 1].p;
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(a.x + a.tx * 18, a.y + a.ty * 18);
    ctx.lineTo(a.x - a.ty * 11, a.y + a.tx * 11);
    ctx.lineTo(a.x + a.ty * 11, a.y - a.tx * 11);
    ctx.fill();
  }
  const bob = Math.sin(g.t * 2.4) * 3;
  ctx.fillStyle = GOLD;
  ctx.strokeStyle = '#3b2a00';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(f.x, f.y + bob, FORK_RADIUS - 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  label(ctx, ['N', 'M', 'S'][g.forkLane] ?? '?', f.x, f.y + bob + 8, '#3b2a00', 24);
  label(ctx, 'TAP TO SWITCH', f.x, f.y + 52, GOLD, 16);
}

function drawCove(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#0d2b38';
  ctx.beginPath();
  ctx.ellipse(x, y, 26, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,90,61,0.6)';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawChute(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#4a3a30';
  ctx.strokeStyle = RIM;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 22, y - 22);
  ctx.lineTo(x + 22, y - 22);
  ctx.lineTo(x + 14, y + 6);
  ctx.lineTo(x - 14, y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  drawMineShape(ctx, x, y - 10, 0.7, 0);
}

function drawWreck(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, t: number): void {
  ctx.fillStyle = 'rgba(20,16,14,0.85)';
  ctx.beginPath();
  ctx.ellipse(x, y, 34 * k, 26 * k, 0.3, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.5 + i / 3) % 1;
    ctx.fillStyle = `rgba(90,90,90,${0.35 * (1 - p)})`;
    ctx.beginPath();
    ctx.arc(x - 8 + i * 8, y - 10 - p * 50 * k, (6 + p * 14) * k, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Allied posts: the radar tower and its sweep, the shore batteries

export function drawPosts(ctx: CanvasRenderingContext2D, g: Game): void {
  g.map.posts?.forEach((p, i) => {
    const st = g.posts[i];
    const up = !st.lost && st.downT <= 0;
    if (p.kind === 'radar') {
      if (up) {
        // The sweep: a wedge turning through the covered circle, fading behind.
        ctx.strokeStyle = 'rgba(143,224,162,0.28)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.reach, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        for (let k = 0; k < 10; k++) {
          const a = st.aim - k * 0.06;
          ctx.fillStyle = `rgba(143,224,162,${0.22 * (1 - k / 10)})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.arc(p.x, p.y, p.reach, a - 0.06, a);
          ctx.closePath();
          ctx.fill();
        }
      }
      // The tower: a mast and a dish.
      ctx.fillStyle = up ? '#15391f' : '#2a2421';
      ctx.strokeStyle = up ? MINT : '#6b5a50';
      ctx.lineWidth = 3;
      ctx.fillRect(p.x - 8, p.y - 40, 16, 40);
      ctx.strokeRect(p.x - 8, p.y - 40, 16, 40);
      if (up) {
        ctx.save();
        ctx.translate(p.x, p.y - 44);
        ctx.rotate(Math.sin(st.aim) * 0.6);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-26, -6);
        ctx.quadraticCurveTo(0, 14, 26, -6);
        ctx.stroke();
        ctx.restore();
        bar(ctx, p.x, p.y + 12, 60, st.hp / p.hp, MINT);
      } else {
        drawWreck(ctx, p.x, p.y - 18, 0.7, g.t);
        label(ctx, 'RADAR LOST', p.x, p.y + 30, '#ff8a7a', 18);
      }
      return;
    }
    // A battery: a squat turret, its reach faintly ringed.
    ctx.strokeStyle = up ? 'rgba(143,224,162,0.18)' : 'rgba(255,138,122,0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.reach, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = up ? '#15391f' : '#2a2421';
    ctx.strokeStyle = up ? MINT : '#6b5a50';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(st.aim) * 34, p.y + Math.sin(st.aim) * 34);
    ctx.stroke();
    ctx.lineCap = 'butt';
    if (up) bar(ctx, p.x, p.y + 28, 44, st.hp / p.hp, MINT);
    else {
      drawWreck(ctx, p.x, p.y, 0.6, g.t);
      label(ctx, `BACK IN ${Math.ceil(st.downT)}`, p.x, p.y + 44, '#ff8a7a', 16);
    }
  });
}

/** A lock box round each threat the radar is tracking. */
export function drawTracked(ctx: CanvasRenderingContext2D, g: Game): void {
  if (!g.map.posts?.some((p) => p.kind === 'radar')) return;
  ctx.strokeStyle = 'rgba(143,224,162,0.9)';
  ctx.lineWidth = 2;
  for (const th of g.threats) {
    if (th.dead || !tracked(g, th)) continue;
    const r = 22;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.beginPath();
      ctx.moveTo(th.x + sx * r, th.y + sy * (r - 8));
      ctx.lineTo(th.x + sx * r, th.y + sy * r);
      ctx.lineTo(th.x + sx * (r - 8), th.y + sy * r);
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------------------
// Threats the plan adds

/** Draws the new kinds; false for a kind render.ts draws itself. */
export function drawNewThreat(ctx: CanvasRenderingContext2D, g: Game, th: Threat): boolean {
  switch (th.kind) {
    case 'mine':
      drawMineShape(ctx, th.x, th.y, 1, g.t + th.phase);
      return true;
    case 'fastboat':
      drawBoat(ctx, th);
      return true;
    case 'rig':
      drawRig(ctx, th, g.t);
      return true;
    case 'generator':
      drawGenerator(ctx, th, g.t);
      return true;
    case 'citadel':
      drawCitadel(ctx, g, th);
      return true;
    case 'dreadnought':
      drawDreadnought(ctx, th, g.t);
      return true;
    default:
      return false;
  }
}

function drawMineShape(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, t: number): void {
  ctx.strokeStyle = '#ffd6d6';
  ctx.lineWidth = 3 * k;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 11 * k, y + Math.sin(a) * 11 * k);
    ctx.lineTo(x + Math.cos(a) * 18 * k, y + Math.sin(a) * 18 * k);
    ctx.stroke();
  }
  ctx.fillStyle = '#2b1414';
  ctx.beginPath();
  ctx.arc(x, y, 12 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // A blinking light: it is armed.
  ctx.fillStyle = Math.floor(t * 3) % 2 ? '#ff5a5a' : '#5a1b1b';
  ctx.beginPath();
  ctx.arc(x, y, 4 * k, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoat(ctx: CanvasRenderingContext2D, th: Threat): void {
  const h = Math.atan2(th.vy, th.vx) || th.heading;
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.rotate(h);
  // The white wake: the warning.
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.moveTo(-14, -6);
  ctx.lineTo(-64, -18);
  ctx.lineTo(-64, 18);
  ctx.lineTo(-14, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a3f46';
  ctx.strokeStyle = '#ff8a7a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-16, -8);
  ctx.lineTo(10, -8);
  ctx.lineTo(22, 0);
  ctx.lineTo(10, 8);
  ctx.lineTo(-16, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c9d2db';
  ctx.fillRect(-8, -4, 8, 8);
  ctx.restore();
  if (th.hp < THREATS.fastboat.hp) bar(ctx, th.x, th.y - 26, 30, th.hp / THREATS.fastboat.hp, '#ff8a7a');
}

function drawRig(ctx: CanvasRenderingContext2D, th: Threat, t: number): void {
  const { x, y } = th;
  // Legs into the water, a deck, a derrick and a flare stack.
  ctx.strokeStyle = '#6b5a50';
  ctx.lineWidth = 5;
  for (const dx of [-26, 26]) {
    ctx.beginPath();
    ctx.moveTo(x + dx, y + 8);
    ctx.lineTo(x + dx * 1.15, y + 34);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (const dx of [-30, 30]) {
    ctx.beginPath();
    ctx.ellipse(x + dx, y + 36, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#4a3a33';
  ctx.strokeStyle = RIM;
  ctx.lineWidth = 3;
  ctx.fillRect(x - 36, y - 10, 72, 22);
  ctx.strokeRect(x - 36, y - 10, 72, 22);
  ctx.strokeStyle = '#9a8678';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 14, y - 10);
  ctx.lineTo(x - 4, y - 46);
  ctx.lineTo(x + 6, y - 10);
  ctx.moveTo(x - 11, y - 24);
  ctx.lineTo(x + 3, y - 24);
  ctx.stroke();
  const flick = 0.6 + 0.4 * Math.sin(t * 13 + x);
  ctx.fillStyle = `rgba(255,150,40,${flick})`;
  ctx.beginPath();
  ctx.arc(x + 26, y - 26, 6 + 3 * flick, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(x + 18, y + 1, 6, 0, Math.PI * 2);
  ctx.fill();
  bar(ctx, x, y - 62, 70, th.hp / (THREATS.rig.hp || 1), '#ff8a7a');
}

function drawGenerator(ctx: CanvasRenderingContext2D, th: Threat, t: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);
  ctx.fillStyle = '#203a46';
  ctx.strokeStyle = `rgba(127,232,255,${0.6 + 0.4 * pulse})`;
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const px = th.x + Math.cos(a) * 30;
    const py = th.y + Math.sin(a) * 30;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  label(ctx, '⚡', th.x, th.y + 9, CYAN, 26);
  bar(ctx, th.x, th.y - 50, 60, th.hp / THREATS.generator.hp, CYAN);
}

function drawCitadel(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const { x, y } = th;
  const shield = shieldUp(g);
  // A star fort: walls, bastions and a keep with its battery.
  ctx.fillStyle = '#4a3a33';
  ctx.strokeStyle = RIM;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 ? 46 : 74;
    if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2d221d';
  ctx.beginPath();
  ctx.arc(x, y, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fill();
  bar(ctx, x, y - 96, 120, th.hp / THREATS.citadel.hp, shield ? 'rgba(255,138,122,0.4)' : '#ff8a7a');
  label(ctx, shield ? 'SHIELDED · destroy the generators' : 'SHIELD DOWN', x, y - 104, shield ? CYAN : GOLD, 18);
}

function drawDreadnought(ctx: CanvasRenderingContext2D, th: Threat, t: number): void {
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.rotate(th.heading);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(-120, -20);
  ctx.lineTo(-210, -40);
  ctx.lineTo(-210, 40);
  ctx.lineTo(-120, 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4a2e28';
  ctx.strokeStyle = '#ff7d62';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-124, -26);
  ctx.lineTo(96, -26);
  ctx.lineTo(136, 0);
  ctx.lineTo(96, 26);
  ctx.lineTo(-124, 26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6b4a40';
  ctx.fillRect(-30, -14, 44, 28);
  for (const dx of [-80, -10, 60]) {
    ctx.fillStyle = '#2d1c18';
    ctx.beginPath();
    ctx.arc(dx, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff7d62';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(dx, 0);
    ctx.lineTo(dx + 6, 30 + Math.sin(t * 2 + dx) * 2);
    ctx.stroke();
  }
  ctx.restore();
  bar(ctx, th.x, th.y - 52, 160, th.hp / THREATS.dreadnought.hp, '#ff8a7a');
  label(ctx, 'DREADNOUGHT', th.x, th.y - 60, '#ffb2a3', 18);
}

// ---------------------------------------------------------------------------
// Night

/** The Black Strait: darkness over the sea, cut by the lighthouse beam, the
 *  carrier's lamp, launch flashes and a Star Shell's light. Threats outside
 *  the light are redrawn on top as a faint glow (still tappable), and a
 *  ballistic's landing circle always shows: every threat keeps a warning. */
let dark: HTMLCanvasElement | null = null;

export function drawNight(ctx: CanvasRenderingContext2D, g: Game, drawReticle: (th: Threat) => void): void {
  const n = g.map.night;
  if (!n) return;
  const flare = g.flareT > 0 ? Math.min(1, g.flareT / 1) : 0;
  const alpha = 0.78 * (1 - flare);
  if (alpha <= 0.02) return;
  if (!dark) dark = document.createElement('canvas');
  if (dark.width !== 1600) {
    dark.width = 1600;
    dark.height = 900;
  }
  const d = dark.getContext('2d')!;
  d.globalCompositeOperation = 'source-over';
  d.clearRect(0, 0, 1600, 900);
  d.fillStyle = `rgba(2,8,16,${alpha})`;
  d.fillRect(0, 0, 1600, 900);
  d.globalCompositeOperation = 'destination-out';
  const hole = (x: number, y: number, r: number, k = 1) => {
    const grad = d.createRadialGradient(x, y, r * 0.2, x, y, r);
    grad.addColorStop(0, `rgba(0,0,0,${k})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = grad;
    d.beginPath();
    d.arc(x, y, r, 0, Math.PI * 2);
    d.fill();
  };
  // The lighthouse beam.
  const beam = beamAngle(g);
  const w = (n.width * Math.PI) / 180;
  const grad = d.createRadialGradient(n.light.x, n.light.y, 10, n.light.x, n.light.y, n.reach);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0.6)');
  d.fillStyle = grad;
  d.beginPath();
  d.moveTo(n.light.x, n.light.y);
  d.arc(n.light.x, n.light.y, n.reach, beam - w / 2, beam + w / 2);
  d.closePath();
  d.fill();
  hole(n.light.x, n.light.y, 70);
  hole(g.map.carrier.x, g.map.carrier.y, 230);
  for (const f of g.fx) if (f.kind === 'launch' || f.kind === 'boom' || f.kind === 'burst') hole(f.x, f.y, 90 + f.r * 2, 1 - f.age / f.life);
  for (const s of g.ships) hole(s.x, s.y, 46, 0.5);
  ctx.drawImage(dark, 0, 0);
  // The beam itself, a pale cone.
  ctx.fillStyle = 'rgba(255,243,196,0.07)';
  ctx.beginPath();
  ctx.moveTo(n.light.x, n.light.y);
  ctx.arc(n.light.x, n.light.y, n.reach, beam - w / 2, beam + w / 2);
  ctx.closePath();
  ctx.fill();
  // Threats in the dark: a faint glow where their engine is.
  for (const th of g.threats) {
    if (th.dead || lit(g, th.x, th.y)) continue;
    ctx.fillStyle = 'rgba(255,170,90,0.45)';
    ctx.beginPath();
    ctx.arc(th.x, th.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,170,90,0.12)';
    ctx.beginPath();
    ctx.arc(th.x, th.y, 14, 0, Math.PI * 2);
    ctx.fill();
    if (th.kind === 'ballistic' && reticleVisible(g, th)) drawReticle(th);
  }
}

/** Where the lighthouse beam points now (radians). */
export function beamAngle(g: Game): number {
  const n = g.map.night!;
  const k = (g.t % n.period) / n.period;
  // Sweeps one way and back.
  const u = k < 0.5 ? k * 2 : 2 - k * 2;
  return ((n.a0 + (n.a1 - n.a0) * u) * Math.PI) / 180;
}

/** Is (x, y) in light right now? */
export function lit(g: Game, x: number, y: number): boolean {
  const n = g.map.night;
  if (!n || g.flareT > 0) return true;
  const c = g.map.carrier;
  if (Math.hypot(x - c.x, y - c.y) < 200) return true;
  const a = Math.atan2(y - n.light.y, x - n.light.x);
  let diff = a - beamAngle(g);
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) < ((n.width / 2) * Math.PI) / 180 && Math.hypot(x - n.light.x, y - n.light.y) < n.reach;
}

