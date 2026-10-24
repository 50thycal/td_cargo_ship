// Canvas renderer. Reads a Game, draws one frame, mutates nothing. Everything
// is drawn in world units (VIEW is 1600×900); the caller sets the transform.

import { BALLISTIC, CARRIER, PICKUPS, SHIP, VIEW, type PickupKind } from '../data/config';
import { FORMATIONS } from '../data/formations';
import type { Landmass } from '../data/maps';
import { CARRIER_TARGET, reticleVisible, type Game, type Threat } from '../sim/game';

const C = {
  waterDeep: '#0b2433',
  waterShallow: '#12384a',
  waveLine: 'rgba(160, 210, 230, 0.07)',
  lane: 'rgba(180, 220, 240, 0.08)',
  enemyLand: '#3b2b24',
  enemyEdge: '#6b4a38',
  friendlyLand: '#26362a',
  friendlyEdge: '#4d6a4a',
  beach: '#c9b78a',
  base: '#d94a3a',
  hull: '#2d3640',
  hullEdge: '#8b98a5',
  carrierDeck: '#5b6570',
  drone: '#e4dccb',
  missile: '#f0f0ea',
  flame: '#ffb347',
  danger: '#ff4d3d',
  interceptor: '#7fe9ff',
  text: '#f4f1e8',
};

const CONTAINER_TINTS = ['#c2523d', '#d39b3a', '#3f7cac', '#5b9a5b', '#8a6bb0'];

export interface Ripple {
  x: number;
  y: number;
  age: number;
  /** 'dry': the tap found nothing loaded — drawn red, optionally labelled. */
  dry?: boolean;
  label?: string;
}

export const RIPPLE_LIFE = 0.4;
export const DRY_LIFE = 0.7;

export function drawFrame(ctx: CanvasRenderingContext2D, g: Game, ripples: Ripple[], shake: number): void {
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawWater(ctx, g);
  for (const land of g.map.land) drawLand(ctx, land);
  drawLanes(ctx, g);
  drawBases(ctx, g);
  drawCarrier(ctx, g);
  if (g.stats.batteryRack > 0) drawBattery(ctx, g);
  for (const th of g.threats) if (th.kind === 'ballistic') drawBallisticGround(ctx, g, th);
  for (const s of g.ships) drawShip(ctx, s.x, s.y, s.hp, s.id, g.t);
  for (const p of g.pickups) drawPickup(ctx, p.kind, p.x, p.y, p.age, g.t);
  for (const th of g.threats) drawThreat(ctx, g, th);
  for (const it of g.interceptors) {
    const a = Math.atan2(it.ty - it.y, it.tx - it.x);
    ctx.strokeStyle = 'rgba(127, 233, 255, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(it.x - Math.cos(a) * 28, it.y - Math.sin(a) * 28);
    ctx.lineTo(it.x, it.y);
    ctx.stroke();
    dot(ctx, it.x, it.y, 5.5, C.interceptor);
  }
  drawFx(ctx, g);
  for (const r of ripples) {
    const fade = 1 - r.age / (r.dry ? DRY_LIFE : RIPPLE_LIFE);
    ctx.strokeStyle = r.dry ? `rgba(255,77,61,${0.9 * fade})` : `rgba(255,255,255,${0.5 * fade})`;
    ctx.lineWidth = r.dry ? 4 : 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.dry ? 26 + r.age * 30 : 10 + r.age * 70, 0, Math.PI * 2);
    ctx.stroke();
    if (r.label) {
      ctx.fillStyle = `rgba(255,120,110,${fade})`;
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(r.label, r.x, r.y - 40 - r.age * 20);
    }
  }
  ctx.restore();
}

function drawWater(ctx: CanvasRenderingContext2D, g: Game): void {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  grad.addColorStop(0, C.waterShallow);
  grad.addColorStop(0.5, C.waterDeep);
  grad.addColorStop(1, C.waterShallow);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.strokeStyle = C.waveLine;
  ctx.lineWidth = 2;
  const drift = (g.t * 12) % 120;
  for (let y = 40; y < VIEW.height; y += 46) {
    ctx.beginPath();
    for (let x = -120 + drift + (y % 92 ? 60 : 0); x < VIEW.width; x += 120) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 15, y - 5, x + 30, y);
    }
    ctx.stroke();
  }
}

function drawLand(ctx: CanvasRenderingContext2D, land: Landmass): void {
  const enemy = land.side === 'enemy';
  ctx.beginPath();
  land.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = enemy ? C.enemyLand : C.friendlyLand;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.beach;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = enemy ? C.enemyEdge : C.friendlyEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawLanes(ctx: CanvasRenderingContext2D, g: Game): void {
  const offsets = FORMATIONS[g.formation].offsets;
  ctx.strokeStyle = C.lane;
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  for (const ch of g.map.channels) {
    for (const o of offsets) {
      const y = ch.y + o * ch.halfWidth;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW.width, y);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
}

function drawBases(ctx: CanvasRenderingContext2D, g: Game): void {
  for (const b of g.map.bases) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = '#2a1d18';
    hexagon(ctx, 26);
    ctx.fill();
    ctx.strokeStyle = C.base;
    ctx.lineWidth = 3;
    ctx.stroke();
    // One small glyph per weapon the base fields.
    const live = b.kinds.filter((k) => g.seen.has(k) || k === 'drone');
    live.forEach((k, i) => {
      const x = (i - (live.length - 1) / 2) * 13;
      ctx.fillStyle = k === 'drone' ? C.drone : k === 'ballistic' ? C.flame : C.danger;
      if (k === 'drone') {
        ctx.beginPath();
        ctx.moveTo(x, -6);
        ctx.lineTo(x + 5, 5);
        ctx.lineTo(x - 5, 5);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(x - 2, -8, 4, 16);
      }
    });
    ctx.restore();
  }
}

function hexagon(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r * 0.8);
  }
  ctx.closePath();
}

function drawCarrier(ctx: CanvasRenderingContext2D, g: Game): void {
  const { x, y } = g.map.carrier;
  const L = CARRIER.halfLength;
  const B = CARRIER.halfBeam;
  ctx.save();
  ctx.translate(x, y);
  // Wake
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.ellipse(0, 0, L + 16, B + 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hull: blunt stern on the left, bow to the right.
  ctx.beginPath();
  ctx.moveTo(-L, -B);
  ctx.lineTo(L - 24, -B);
  ctx.lineTo(L + 6, 0);
  ctx.lineTo(L - 24, B);
  ctx.lineTo(-L, B);
  ctx.closePath();
  ctx.fillStyle = C.carrierDeck;
  ctx.fill();
  ctx.strokeStyle = C.hullEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Angled flight deck line + centerline
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.moveTo(-L + 10, 2);
  ctx.lineTo(L - 10, 2);
  ctx.moveTo(-L + 20, B - 6);
  ctx.lineTo(L - 50, -B + 6);
  ctx.stroke();
  ctx.setLineDash([]);
  // Island superstructure on the starboard side.
  ctx.fillStyle = '#3c454f';
  ctx.fillRect(10, B - 12, 26, 9);
  ctx.restore();

  // HP bar and ammo rack, right where the player looks when firing.
  const hpFrac = g.carrierHp / CARRIER.hp;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - 60, y + B + 8, 120, 6);
  ctx.fillStyle = hpFrac > 0.5 ? '#5ee08a' : hpFrac > 0.25 ? '#f5c542' : C.danger;
  ctx.fillRect(x - 60, y + B + 8, 120 * hpFrac, 6);
  drawRack(ctx, x, y - B - 8, g.stats.rack, g.ammo, g.reloadT / g.stats.reload, g.overdriveT > 0);
}

function drawBattery(ctx: CanvasRenderingContext2D, g: Game): void {
  const { x, y } = g.map.battery;
  ctx.fillStyle = '#3c454f';
  ctx.strokeStyle = C.hullEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.interceptor;
  ctx.fillRect(x - 3, y - 24, 6, 16);
  drawRack(ctx, x, y - 30, g.stats.batteryRack, g.batteryAmmo, g.batteryReloadT / g.stats.reload, g.overdriveT > 0);
}

/** A row of rack pips centred on (x, y): full, loading (partly filled), empty. */
function drawRack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rack: number,
  ammo: number,
  loading: number,
  overdrive: boolean,
): void {
  const w = 9;
  const gap = 4;
  const total = rack * w + (rack - 1) * gap;
  for (let i = 0; i < rack; i++) {
    const rx = x - total / 2 + i * (w + gap);
    const full = i < ammo;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(rx, y - 14, w, 14);
    ctx.fillStyle = overdrive ? '#38bdf8' : full ? C.interceptor : 'rgba(127,233,255,0.35)';
    const h = full ? 14 : i === ammo ? 14 * loading : 0;
    ctx.fillRect(rx, y - h, w, h);
  }
}

function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, hp: number, id: number, t: number): void {
  const L = 34;
  const B = 10;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(-L - 26, 0);
  ctx.lineTo(-L, -B);
  ctx.lineTo(-L, B);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-L, -B);
  ctx.lineTo(L - 10, -B);
  ctx.lineTo(L, 0);
  ctx.lineTo(L - 10, B);
  ctx.lineTo(-L, B);
  ctx.closePath();
  ctx.fillStyle = C.hull;
  ctx.fill();
  ctx.strokeStyle = C.hullEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Container stacks
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = CONTAINER_TINTS[(id + i * 3) % CONTAINER_TINTS.length];
    ctx.fillRect(-L + 9 + i * 9, -B + 3, 7, B * 2 - 6);
  }
  // Bridge at the stern
  ctx.fillStyle = '#e8e4da';
  ctx.fillRect(-L + 2, -B + 3, 5, B * 2 - 6);
  ctx.restore();
  if (hp < SHIP.hp) {
    const puff = (k: number) => (t * 1.3 + k * 0.33) % 1;
    for (let k = 0; k < 3; k++) {
      const p = puff(k);
      ctx.fillStyle = hp <= 1 ? `rgba(255,120,40,${0.6 * (1 - p)})` : `rgba(160,160,160,${0.45 * (1 - p)})`;
      ctx.beginPath();
      ctx.arc(x - 6 - p * 26, y - 4 - p * 16, 4 + p * 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBallisticGround(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const p = Math.min(1, th.age / th.dur);
  const gx = th.sx + (th.ix - th.sx) * p;
  const gy = th.sy + (th.iy - th.sy) * p;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(gx, gy, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!reticleVisible(g, th)) return;
  const pulse = 0.5 + 0.5 * Math.sin(g.t * 14);
  ctx.strokeStyle = `rgba(255,77,61,${0.55 + 0.35 * pulse})`;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.arc(th.ix, th.iy, BALLISTIC.splash, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(th.ix, th.iy, BALLISTIC.splash * (1 - p), 0, Math.PI * 2);
  ctx.stroke();
}

function drawThreat(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const heading = Math.atan2(th.vy, th.vx) || th.heading;
  if (th.kind === 'ballistic') {
    // Smoke trail sampled back along the arc.
    ctx.strokeStyle = 'rgba(230,220,200,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let k = 0; k <= 8; k++) {
      const p = Math.max(0, th.age / th.dur - k * 0.025);
      const x = th.sx + (th.ix - th.sx) * p;
      const y = th.sy + (th.iy - th.sy) * p - 4 * th.apex * p * (1 - p);
      ctx[k ? 'lineTo' : 'moveTo'](x, y);
    }
    ctx.stroke();
    missile(ctx, th.x, th.y, heading, 32, 7, C.missile, C.flame);
    return;
  }
  if (th.kind === 'guided') {
    // A faint lock line to its target: the player can see who it is hunting.
    const target = th.target === CARRIER_TARGET ? g.map.carrier : g.ships.find((s) => s.id === th.target);
    if (target) {
      ctx.strokeStyle = 'rgba(255,77,61,0.22)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(th.x, th.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = 'rgba(240,240,240,0.3)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(th.x, th.y);
    ctx.lineTo(th.x - Math.cos(heading) * 40, th.y - Math.sin(heading) * 40);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(th.x + 6, th.y + 12, 13, 4, heading, 0, Math.PI * 2);
    ctx.fill();
    missile(ctx, th.x, th.y, heading, 28, 6, th.hp > 1 ? C.missile : '#ffb0a8', C.danger);
    return;
  }
  // Shahed-style delta wing, with a shadow on the water below it.
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.rotate(heading);
  for (const [dx, dy, fill] of [
    [7, 12, 'rgba(0,0,0,0.35)'],
    [0, 0, C.drone],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(18 + dx, dy);
    ctx.lineTo(-13 + dx, -16 + dy);
    ctx.lineTo(-8 + dx, dy);
    ctx.lineTo(-13 + dx, 16 + dy);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(-9, -2, 14, 4);
  ctx.restore();
}

function missile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  heading: number,
  len: number,
  w: number,
  body: string,
  tip: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.fillStyle = C.flame;
  ctx.beginPath();
  ctx.moveTo(-len / 2, -w / 2);
  ctx.lineTo(-len / 2 - 8 - Math.random() * 5, 0);
  ctx.lineTo(-len / 2, w / 2);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.fillRect(-len / 2, -w / 2, len, w);
  ctx.fillStyle = tip;
  ctx.beginPath();
  ctx.moveTo(len / 2, -w / 2);
  ctx.lineTo(len / 2 + 6, 0);
  ctx.lineTo(len / 2, w / 2);
  ctx.fill();
  ctx.fillRect(-len / 2, -w / 2 - 3, 4, w + 6);
  ctx.restore();
}

const PICKUP_COLORS: Record<PickupKind, string> = {
  ammo: '#f5c542',
  repair: '#4ade80',
  overdrive: '#38bdf8',
  emp: '#c084fc',
};

function drawPickup(ctx: CanvasRenderingContext2D, kind: PickupKind, x: number, y: number, age: number, t: number): void {
  const fading = age > PICKUPS.life - 1.5;
  if (fading && Math.floor(t * 8) % 2) return;
  const r = PICKUPS.radius * (0.92 + 0.08 * Math.sin(t * 6));
  const col = PICKUP_COLORS[kind];
  ctx.fillStyle = 'rgba(10,20,28,0.8)';
  ctx.strokeStyle = col;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  if (kind === 'ammo') {
    for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * 7 - 2.5, y - 9, 5, 18);
  } else if (kind === 'repair') {
    ctx.fillRect(x - 10, y - 3.5, 20, 7);
    ctx.fillRect(x - 3.5, y - 10, 7, 20);
  } else if (kind === 'overdrive') {
    ctx.beginPath();
    ctx.moveTo(x + 3, y - 12);
    ctx.lineTo(x - 7, y + 2);
    ctx.lineTo(x, y + 2);
    ctx.lineTo(x - 3, y + 12);
    ctx.lineTo(x + 7, y - 2);
    ctx.lineTo(x, y - 2);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.lineWidth = 2.5;
    for (const rr of [5, 11]) {
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawFx(ctx: CanvasRenderingContext2D, g: Game): void {
  for (const f of g.fx) {
    const u = f.age / f.life;
    switch (f.kind) {
      case 'boom':
        ctx.fillStyle = `rgba(255,160,60,${0.8 * (1 - u)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.4 + u), 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'burst':
        ctx.strokeStyle = `rgba(127,233,255,${0.8 * (1 - u)})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(f.x, f.y, Math.max(2, f.r * Math.min(1, u * 1.6)), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'splash':
        ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - u)})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.3 + u), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,140,60,${0.6 * (1 - u)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 0.6 * (1 - u * 0.5), 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'sink':
        ctx.fillStyle = `rgba(20,20,20,${0.5 * (1 - u)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.5 + u), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,90,40,${0.9 * (1 - u)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 0.5 * (1 - u), 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'launch':
        ctx.fillStyle = `rgba(255,77,61,${0.7 * (1 - u)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (1 + u), 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'tracer':
        ctx.strokeStyle = `rgba(255,230,120,${1 - u})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x2, f.y2);
        ctx.stroke();
        break;
      case 'text':
        ctx.fillStyle = `rgba(244,241,232,${1 - u})`;
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(f.text ?? '', f.x, f.y - u * 30);
        break;
    }
  }
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
