// The Coves' attack boats, drawn (log v68; data/config.ts BOATS): three
// hulls that read apart on a phone, each with a real wake.
//   speedboat   a low red hull with a white stripe, bow up on the plane, a
//               rooster tail behind it; a fire ship has flames on its deck.
//   gunboat     a grey patrol boat with a gun turret that turns on its ship,
//               a red lock line to the ship it has locked, a muzzle flash.
//   rocket boat a broad olive hull with a rack of red-tipped rockets that
//               rises when it fires, a red mark on the ship it will hit.
// The wake is drawn from where the boat has been (a trail kept here, per
// boat, for the picture only): a foam ribbon that widens and fades, a bow
// wave, and a churn at the stern that grows with speed.

import { FOE } from '../data/foes';
import { BOATS, THREATS } from '../data/config';
import type { Game, Threat } from '../sim/game';

interface Trail {
  pts: { x: number; y: number }[];
  heading: number;
  bank: number;
  seen: number;
}
const trails = new Map<number, Trail>();
let frame = 0;

function trailOf(th: Threat, h: number): Trail {
  let tr = trails.get(th.id);
  if (!tr) {
    tr = { pts: [{ x: th.x, y: th.y }], heading: h, bank: 0, seen: frame };
    trails.set(th.id, tr);
  }
  const last = tr.pts[tr.pts.length - 1];
  if (Math.hypot(th.x - last.x, th.y - last.y) > 7) {
    tr.pts.push({ x: th.x, y: th.y });
    if (tr.pts.length > 18) tr.pts.shift();
  }
  // Bank into a turn: how far the heading moved since the last frame, eased.
  let dh = h - tr.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  tr.bank += (Math.max(-1, Math.min(1, dh * 14)) - tr.bank) * 0.15;
  tr.heading = h;
  tr.seen = frame;
  return tr;
}

/** Forget the trails of boats that are gone (called as the frame is drawn). */
function sweep(): void {
  frame++;
  if (frame % 120 === 0) for (const [id, tr] of trails) if (frame - tr.seen > 90) trails.delete(id);
}

/** The foam ribbon behind the boat: widest and faintest at the far end. */
function ribbon(ctx: CanvasRenderingContext2D, tr: Trail, th: Threat, width: number, alpha: number): void {
  const pts = [...tr.pts, { x: th.x, y: th.y }];
  const n = pts.length;
  if (n < 2) return;
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const m = Math.hypot(dx, dy) || 1;
    const u = 1 - i / (n - 1); // 1 at the oldest point, 0 at the boat
    const w = width * (0.25 + 0.75 * u);
    left.push({ x: pts[i].x - (dy / m) * w, y: pts[i].y + (dx / m) * w });
    right.push({ x: pts[i].x + (dy / m) * w, y: pts[i].y - (dx / m) * w });
  }
  // Drawn in slices so the far end fades out.
  for (let i = 0; i < n - 1; i++) {
    const u = i / (n - 1);
    ctx.fillStyle = `rgba(255,255,255,${alpha * (0.15 + 0.85 * u)})`;
    ctx.beginPath();
    ctx.moveTo(left[i].x, left[i].y);
    ctx.lineTo(left[i + 1].x, left[i + 1].y);
    ctx.lineTo(right[i + 1].x, right[i + 1].y);
    ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    ctx.fill();
  }
  // A thin bright core down the middle.
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.9})`;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(pts[Math.max(0, n - 9)].x, pts[Math.max(0, n - 9)].y);
  for (let i = Math.max(1, n - 8); i < n; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

/** The bow wave (a V off the stem) and the stern's churn, in the boat's own
 *  frame (x forward). `k`: how hard it is planing, 0..1. */
function bowAndStern(ctx: CanvasRenderingContext2D, len: number, beam: number, k: number, t: number): void {
  ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.35 * k})`;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  const spread = beam * (1.1 + 1.3 * k);
  const back = len * (0.55 + 0.5 * k);
  ctx.beginPath();
  ctx.moveTo(len * 0.5, 0);
  ctx.quadraticCurveTo(len * 0.2, -spread * 0.6, len * 0.5 - back, -spread);
  ctx.moveTo(len * 0.5, 0);
  ctx.quadraticCurveTo(len * 0.2, spread * 0.6, len * 0.5 - back, spread);
  ctx.stroke();
  // The long V of the wake, off the bow, spreading and fading with distance.
  const reach = 70 + 110 * k + len;
  ctx.lineWidth = 2.2;
  for (const sgn of [-1, 1]) {
    let px = len * 0.46;
    let py = 0;
    for (let i = 1; i <= 7; i++) {
      const u = i / 7;
      const x = len * 0.46 - reach * u;
      const y = sgn * (beam * 0.45 + reach * u * 0.34);
      ctx.strokeStyle = `rgba(255,255,255,${(0.1 + 0.55 * k) * (1 - u) + 0.08})`;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
      px = x;
      py = y;
    }
  }
  // Churn: blobs boiling up astern, drifting back and widening.
  for (let i = 0; i < 6; i++) {
    const age = (t * (1.4 + k) + i / 6) % 1;
    ctx.fillStyle = `rgba(255,255,255,${(0.5 + 0.3 * k) * (1 - age)})`;
    ctx.beginPath();
    ctx.ellipse(-len * 0.5 - age * len * (0.5 + k * 0.5), Math.sin(i * 2.3 + t * 9) * beam * 0.45 * age, 4 + age * 8, 3 + age * 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function hullPath(ctx: CanvasRenderingContext2D, len: number, beam: number, bowK = 0.55): void {
  const L = len / 2;
  const B = beam / 2;
  ctx.beginPath();
  ctx.moveTo(-L, -B * 0.85);
  ctx.lineTo(L * bowK, -B);
  ctx.quadraticCurveTo(L * 0.92, -B * 0.55, L, 0);
  ctx.quadraticCurveTo(L * 0.92, B * 0.55, L * bowK, B);
  ctx.lineTo(-L, B * 0.85);
  ctx.closePath();
}

function hpBar(ctx: CanvasRenderingContext2D, th: Threat, y: number, w: number, col: string, always = false): void {
  const full = th.maxHp ?? THREATS.fastboat.hp;
  if (!always && th.hp >= full) return;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(th.x - w / 2 - 2, th.y + y - 2, w + 4, 10);
  ctx.fillStyle = col;
  ctx.fillRect(th.x - w / 2, th.y + y, w * Math.max(0, Math.min(1, th.hp / full)), 6);
  // One tick a hit, so a sturdy boat reads as hits to go.
  if (full > 2 && full <= 12) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    for (let i = 1; i < full; i++) ctx.fillRect(th.x - w / 2 + (w * i) / full - 0.5, th.y + y, 1, 6);
  }
}

export function drawAttackBoat(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  sweep();
  const sp = Math.hypot(th.vx, th.vy);
  const h = sp > 6 ? Math.atan2(th.vy, th.vx) : th.heading;
  const tr = trailOf(th, h);
  const t = g.t + th.phase;
  const kind = th.boat ?? 'speed';
  const planing = Math.max(0, Math.min(1, sp / 120));
  // The wake first, under everything.
  ribbon(ctx, tr, th, kind === 'rocket' ? 19 : kind === 'gun' ? 14 : 12, kind === 'rocket' ? 0.5 : 0.62);
  // Lock lines first too, under the hull.
  const ship = th.bs && th.bs.ship >= 0 ? g.ships.find((s) => s.id === th.bs!.ship) : undefined;
  if (kind === 'gun' && ship && th.bs!.mode === 'side') {
    const pulse = 0.55 + 0.25 * Math.sin(t * 7);
    ctx.strokeStyle = `rgba(255,96,70,${pulse})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = -t * 30;
    ctx.beginPath();
    ctx.moveTo(th.x, th.y);
    ctx.lineTo(ship.x, ship.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(255,96,70,${pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, 30, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (kind === 'rocket' && ship && th.bs!.mode === 'raise') {
    const p = Math.min(1, th.bs!.t / BOATS.rocket.raise);
    ctx.strokeStyle = `rgba(255,70,50,${0.35 + 0.5 * p})`;
    ctx.lineWidth = 2 + 2 * p;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(th.x, th.y);
    ctx.lineTo(ship.x, ship.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, 24 + 10 * (1 - p), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(th.x, th.y + Math.sin(t * 6.3) * (kind === 'rocket' ? 0.8 : 1.4));
  ctx.rotate(h);
  if (kind === 'speed') drawSpeedboat(ctx, th, tr, planing, t);
  else if (kind === 'gun') drawGunboat(ctx, g, th, tr, planing, t, ship);
  else drawRocketBoat(ctx, th, tr, planing, t);
  ctx.restore();
  // A fire ship's ring: the size of the fire it leaves where it goes down.
  if (th.fire) {
    ctx.strokeStyle = 'rgba(255,122,26,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.arc(th.x, th.y, FOE.cloud.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (kind === 'rocket') hpBar(ctx, th, -44, 46, '#e8c35a', true);
  else if (kind === 'gun') hpBar(ctx, th, -30, 34, '#9ec7ff');
  else hpBar(ctx, th, -26, 30, th.fire ? '#ff9a3a' : '#ff8a7a');
}

function drawSpeedboat(ctx: CanvasRenderingContext2D, th: Threat, tr: Trail, k: number, t: number): void {
  const len = 52;
  const beam = 19;
  bowAndStern(ctx, len, beam, k, t);
  // Banked into the turn: the hull leans, one side shows more.
  ctx.rotate(tr.bank * 0.06);
  ctx.save();
  ctx.scale(1, 1 - Math.abs(tr.bank) * 0.07);
  ctx.fillStyle = th.fire ? '#7a2a14' : '#d8382b';
  ctx.strokeStyle = '#1d1d22';
  ctx.lineWidth = 2.2;
  hullPath(ctx, len, beam, 0.4);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // White stripe and a dark deck.
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(-len * 0.4, -1.8, len * 0.8, 3.6);
  ctx.fillStyle = '#2a2d33';
  ctx.beginPath();
  ctx.moveTo(-len * 0.3, -beam * 0.3);
  ctx.lineTo(len * 0.12, -beam * 0.27);
  ctx.lineTo(len * 0.22, 0);
  ctx.lineTo(len * 0.12, beam * 0.27);
  ctx.lineTo(-len * 0.3, beam * 0.3);
  ctx.closePath();
  ctx.fill();
  // Windscreen, and two outboards at the transom.
  ctx.fillStyle = '#bfe4f5';
  ctx.fillRect(len * 0.02, -beam * 0.2, 6, beam * 0.4);
  ctx.fillStyle = '#16181c';
  ctx.fillRect(-len * 0.58, -beam * 0.3, 7, 6);
  ctx.fillRect(-len * 0.58, beam * 0.3 - 6, 7, 6);
  // Bow spray when it is flat out.
  if (k > 0.5) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 3; i++) {
      const a = (t * 7 + i * 2.1) % 1;
      ctx.beginPath();
      ctx.arc(len * 0.45 - a * 10, (i - 1) * 5 * a, 2.5 * (1 - a) + 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (th.fire) drawFlames(ctx, th, t);
}

function drawFlames(ctx: CanvasRenderingContext2D, th: Threat, t: number): void {
  ctx.fillStyle = '#ff7a1a';
  for (let i = 0; i < 4; i++) {
    const fx = -16 + i * 9;
    const hh = 14 + 6 * Math.sin(t * 9 + i * 2.1);
    ctx.beginPath();
    ctx.moveTo(fx - 5, 0);
    ctx.quadraticCurveTo(fx - 3, -hh * 0.6, fx - 6, -hh);
    ctx.quadraticCurveTo(fx + 4, -hh * 0.5, fx + 5, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#ffd34a';
  ctx.beginPath();
  ctx.arc(-2, -2, 5, 0, Math.PI * 2);
  ctx.fill();
  void th;
}

function drawGunboat(ctx: CanvasRenderingContext2D, g: Game, th: Threat, tr: Trail, k: number, t: number, ship: { x: number; y: number } | undefined): void {
  const len = 64;
  const beam = 24;
  bowAndStern(ctx, len, beam, k * 0.8, t);
  ctx.rotate(tr.bank * 0.04);
  ctx.fillStyle = '#6f7d8c';
  ctx.strokeStyle = '#1b2026';
  ctx.lineWidth = 2.4;
  hullPath(ctx, len, beam, 0.5);
  ctx.fill();
  ctx.stroke();
  // Deck plating and a pale waterline stripe.
  ctx.fillStyle = '#8c9aa8';
  ctx.beginPath();
  ctx.moveTo(-len * 0.42, -beam * 0.32);
  ctx.lineTo(len * 0.22, -beam * 0.3);
  ctx.lineTo(len * 0.36, 0);
  ctx.lineTo(len * 0.22, beam * 0.3);
  ctx.lineTo(-len * 0.42, beam * 0.32);
  ctx.closePath();
  ctx.fill();
  // The bridge, aft.
  ctx.fillStyle = '#c9d2db';
  ctx.strokeStyle = '#1b2026';
  ctx.lineWidth = 1.6;
  ctx.fillRect(-len * 0.3, -beam * 0.24, len * 0.2, beam * 0.48);
  ctx.strokeRect(-len * 0.3, -beam * 0.24, len * 0.2, beam * 0.48);
  // The turret on the foredeck, its barrel turned on the ship it has locked.
  const bx = len * 0.2;
  const world = Math.atan2(th.vy, th.vx) || th.heading;
  const aim = ship ? Math.atan2(ship.y - th.y, ship.x - th.x) - world : 0;
  ctx.save();
  ctx.translate(bx, 0);
  ctx.rotate(aim);
  ctx.fillStyle = '#3a4350';
  ctx.strokeStyle = '#11151a';
  ctx.lineWidth = 1.6;
  ctx.fillRect(2, -2.4, 22, 4.8);
  ctx.strokeRect(2, -2.4, 22, 4.8);
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Muzzle flash on a shell.
  const since = th.bs ? g.t - th.bs.flash : 9;
  if (since < 0.16) {
    ctx.fillStyle = `rgba(255,224,120,${1 - since / 0.16})`;
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(36, -7);
    ctx.lineTo(32, 0);
    ctx.lineTo(36, 7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // A red pennant: this one is locked on.
  if (th.bs?.mode === 'side') {
    ctx.fillStyle = '#ff5a46';
    ctx.fillRect(-len * 0.2, -beam * 0.24 - 9, 8, 5);
    ctx.fillRect(-len * 0.2 - 1, -beam * 0.24 - 10, 1.6, 10);
  }
}

function drawRocketBoat(ctx: CanvasRenderingContext2D, th: Threat, tr: Trail, k: number, t: number): void {
  const len = 90;
  const beam = 38;
  bowAndStern(ctx, len, beam, k * 0.5, t);
  ctx.rotate(tr.bank * 0.02);
  ctx.fillStyle = '#566a46';
  ctx.strokeStyle = '#161b12';
  ctx.lineWidth = 2.8;
  hullPath(ctx, len, beam, 0.6);
  ctx.fill();
  ctx.stroke();
  // Deck, a darker band round the edge.
  ctx.fillStyle = '#6f8458';
  ctx.beginPath();
  ctx.moveTo(-len * 0.44, -beam * 0.34);
  ctx.lineTo(len * 0.26, -beam * 0.34);
  ctx.lineTo(len * 0.4, 0);
  ctx.lineTo(len * 0.26, beam * 0.34);
  ctx.lineTo(-len * 0.44, beam * 0.34);
  ctx.closePath();
  ctx.fill();
  // The wheelhouse, forward, with its windows.
  ctx.fillStyle = '#a7b293';
  ctx.strokeStyle = '#161b12';
  ctx.lineWidth = 1.8;
  ctx.fillRect(len * 0.1, -beam * 0.2, len * 0.17, beam * 0.4);
  ctx.strokeRect(len * 0.1, -beam * 0.2, len * 0.17, beam * 0.4);
  ctx.fillStyle = '#2c3a44';
  ctx.fillRect(len * 0.23, -beam * 0.13, 4, beam * 0.26);
  // The rocket rack aft: it lifts and glows when the boat raises it to fire.
  const bs = th.bs;
  const up = bs ? (bs.mode === 'raise' ? Math.min(1, bs.t / BOATS.rocket.raise) : bs.mode === 'fire' ? 1 : 0) : 0;
  ctx.save();
  ctx.translate(-len * 0.14, 0);
  ctx.fillStyle = '#2e3328';
  ctx.strokeStyle = '#11140e';
  ctx.lineWidth = 1.8;
  ctx.fillRect(-len * 0.2, -beam * 0.3, len * 0.4, beam * 0.6);
  ctx.strokeRect(-len * 0.2, -beam * 0.3, len * 0.4, beam * 0.6);
  // Four tubes across; each shows a red-tipped rocket, longer as it rises.
  for (let i = 0; i < 4; i++) {
    const y = -beam * 0.22 + i * beam * 0.147;
    const ext = 6 + up * 16;
    ctx.fillStyle = '#c9ccc2';
    ctx.fillRect(len * 0.04, y - 2.4, ext, 4.8);
    ctx.fillStyle = `rgb(${210 + 40 * up},${60 - 30 * up},${50 - 20 * up})`;
    ctx.beginPath();
    ctx.moveTo(len * 0.04 + ext, y - 2.8);
    ctx.lineTo(len * 0.04 + ext + 6, y);
    ctx.lineTo(len * 0.04 + ext, y + 2.8);
    ctx.closePath();
    ctx.fill();
  }
  if (up > 0.2) {
    ctx.fillStyle = `rgba(255,90,60,${0.18 + 0.3 * up})`;
    ctx.beginPath();
    ctx.arc(len * 0.1, 0, beam * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Funnel amidships, a little smoke.
  ctx.fillStyle = '#2b2f26';
  ctx.beginPath();
  ctx.arc(-len * 0.34, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(70,70,70,0.45)';
  for (let i = 0; i < 3; i++) {
    const a = (t * 0.9 + i / 3) % 1;
    ctx.beginPath();
    ctx.arc(-len * 0.34 - a * 22, -a * 6, 4 + a * 7, 0, Math.PI * 2);
    ctx.fill();
  }
}
