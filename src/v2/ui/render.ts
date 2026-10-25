// Canvas renderer. Reads a Game, draws one frame, mutates nothing. Everything
// is drawn in world units (VIEW is 1600×900); the caller sets the transform.

import { BALLISTIC, CARRIER, PICKUPS, SHIP, SMOKE, SUPERSONIC, THREATS, VIEW, type PickupKind, type RaidTheme, type ThreatKind } from '../data/config';
import { FORMATIONS } from '../data/formations';
import { halfWidthAt, type Landmass } from '../data/maps';
import { CARRIER_TARGET, raidWarning, reticleVisible, type Game, type Threat } from '../sim/game';
import { drawBunkers, drawPlane, drawPlaneWarnings, drawRaiders } from './vectors';

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

/** `bannerUp`: the wave/new-threat banner is showing at the map's callout
 *  point, so a raid warning moves above it. */
export function drawFrame(ctx: CanvasRenderingContext2D, g: Game, ripples: Ripple[], shake: number, bannerUp = false): void {
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawWater(ctx, g);
  for (const land of g.map.land) drawLand(ctx, land);
  drawBunkers(ctx, g);
  drawLanes(ctx, g);
  drawBases(ctx, g);
  drawRaiders(ctx, g);
  drawRaidWarning(ctx, g, bannerUp);
  drawCarrier(ctx, g);
  if (g.frigate) drawFrigate(ctx, g);
  for (const th of g.threats) if (th.kind === 'ballistic') drawBallisticGround(ctx, g, th);
  if (g.steamT > 0) for (const s of g.ships) drawSteam(ctx, s.x, s.y, g.t);
  const armored = g.stats.shipHp > SHIP.hp;
  for (const s of g.ships) drawShip(ctx, s.x, s.y, s.hp, s.id, g.t, g.stats.shipHp, armored);
  drawSmoke(ctx, g);
  if (g.shieldT > 0) drawShields(ctx, g);
  for (const p of g.pickups) drawPickup(ctx, p.kind, p.x, p.y, p.age, g.t, g.stats.pickupLife);
  for (const th of g.threats) if (th.kind !== 'strafer' && th.kind !== 'bomber') drawThreat(ctx, g, th);
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
  // Aircraft fly above everything else, their warnings on top of that.
  for (const th of g.threats) if (th.kind === 'strafer' || th.kind === 'bomber') {
    drawPlane(ctx, g, th);
    hpPips(ctx, th.x, th.y - 44, th.hp, THREATS[th.kind].hp);
  }
  drawPlaneWarnings(ctx, g);
  drawTimedPickups(ctx, g);
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
      // Sampled across x so a funnelling channel's lanes visibly converge.
      ctx.beginPath();
      for (let x = 0; x <= VIEW.width; x += 80) {
        const y = ch.y + o * halfWidthAt(ch, x);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
}

const BASE_GLYPH: Partial<Record<ThreatKind, string>> = {
  drone: C.drone,
  ballistic: C.flame,
  guided: C.danger,
  supersonic: '#ff8af0',
  heavy: '#c9a26b',
  cluster: '#ffd24a',
  mothership: '#9fd0a8',
};

const RAID_LOOK: Record<RaidTheme, { color: string; name: string; tip: string }> = {
  swarm: { color: '255,255,255', name: 'SWARM', tip: 'drones · Column hurries ships past' },
  barrage: { color: '255,180,80', name: 'BARRAGE', tip: 'splash · Spread halves it' },
  volley: { color: '255,120,230', name: 'VOLLEY', tip: 'guided · Box armour blunts it' },
  strike: { color: '140,200,255', name: 'AIR STRIKE', tip: 'strafing · split up: Pairs or Spread' },
};

/** A raid is coming: its bases light up and its type is called out, so the
 *  player has a moment to pick the formation that answers it. */
function drawRaidWarning(ctx: CanvasRenderingContext2D, g: Game, bannerUp: boolean): void {
  const w = raidWarning(g);
  if (!w) return;
  const look = RAID_LOOK[w.raid.theme];
  const flash = 0.5 + 0.5 * Math.sin(g.t * 14);
  for (const i of w.raid.bases) {
    const b = g.map.bases[i];
    ctx.strokeStyle = `rgba(${look.color},${0.45 + 0.5 * flash})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 30 + 10 * w.p, 0, Math.PI * 2);
    ctx.stroke();
  }
  const fade = Math.min(1, (1 - w.p) * 6, w.p * 8);
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  const title = `⚠ ${look.name} INBOUND`;
  ctx.font = '600 17px system-ui, sans-serif';
  const tipW = ctx.measureText(look.tip).width;
  ctx.font = '800 26px system-ui, sans-serif';
  const width = Math.max(ctx.measureText(title).width, tipW) + 36;
  // At the map's callout point: clear of every base and shipping lane.
  const x = g.map.callout.x;
  const y = g.map.callout.y - 6 - (bannerUp ? 80 : 0);
  ctx.fillStyle = 'rgba(4,8,11,0.82)';
  ctx.strokeStyle = `rgba(${look.color},0.8)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - 26, width, 62, 12);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = `rgb(${look.color})`;
  ctx.fillText(title, x, y + 4);
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(220,230,235,0.9)';
  ctx.fillText(look.tip, x, y + 26);
  ctx.restore();
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
      ctx.fillStyle = BASE_GLYPH[k] ?? C.danger;
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
  // Overdrive: the whole ship glows and pulses, ringed by a timer that
  // drains as it runs out (round 3: "some type of hue or glow on the
  // carrier when that is active").
  const od = g.overdriveT > 0 ? Math.min(1, g.overdriveT / PICKUPS.overdriveTime) : 0;
  if (od > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(g.t * 10);
    const halo = ctx.createRadialGradient(0, 0, B, 0, 0, L + 48);
    halo.addColorStop(0, `rgba(56,189,248,${0.55 + 0.25 * pulse})`);
    halo.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.ellipse(0, 0, L + 48, B + 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(125,211,252,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, L + 30, B + 24, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * od);
    ctx.stroke();
  }
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
  ctx.strokeStyle = od > 0 ? '#7dd3fc' : C.hullEdge;
  ctx.lineWidth = od > 0 ? 3 : 2;
  ctx.stroke();
  if (od > 0) {
    ctx.fillStyle = `rgba(56,189,248,${0.18 + 0.12 * Math.sin(g.t * 10)})`;
    ctx.fill();
  }
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
  const hpFrac = g.carrierHp / g.stats.carrierHp;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - 60, y + B + 8, 120, 6);
  ctx.fillStyle = hpFrac > 0.5 ? '#5ee08a' : hpFrac > 0.25 ? '#f5c542' : C.danger;
  ctx.fillRect(x - 60, y + B + 8, 120 * hpFrac, 6);
  drawRack(ctx, x, y - B - 8, g.stats.rack, g.ammo, g.reloadT / g.stats.reload, g.overdriveT > 0);
}

/** The Escort Frigate: a slim grey warship with a launcher aft and its own
 *  rack above it, a bow wave while it is under way. */
function drawFrigate(ctx: CanvasRenderingContext2D, g: Game): void {
  const f = g.frigate!;
  const { x, y } = f;
  const L = 46;
  const B = 11;
  const moving = Math.abs(f.vx) > 1;
  ctx.save();
  ctx.translate(x, y);
  if (f.vx < -1) ctx.scale(-1, 1);
  // Wake: a long V behind it while it steams, a faint ring at rest.
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.ellipse(0, 0, L + 10, B + 7, 0, 0, Math.PI * 2);
  ctx.fill();
  if (moving) {
    const k = Math.min(1, Math.abs(f.vx) / 120);
    ctx.strokeStyle = `rgba(230,245,255,${0.25 + 0.35 * k})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(L, 0);
    ctx.lineTo(-L - 50 * k - 20, -B - 14 * k - 4);
    ctx.moveTo(L, 0);
    ctx.lineTo(-L - 50 * k - 20, B + 14 * k + 4);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.3 * k})`;
    ctx.beginPath();
    ctx.ellipse(L + 2, 0, 6, B * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Hull: square stern, sharp bow.
  ctx.beginPath();
  ctx.moveTo(-L, -B);
  ctx.lineTo(L - 18, -B);
  ctx.lineTo(L + 6, 0);
  ctx.lineTo(L - 18, B);
  ctx.lineTo(-L, B);
  ctx.closePath();
  ctx.fillStyle = '#6b7783';
  ctx.fill();
  ctx.strokeStyle = g.overdriveT > 0 ? '#7dd3fc' : '#e6edf2';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Superstructure, mast, gun forward, launcher cells aft.
  ctx.fillStyle = '#4a545e';
  ctx.fillRect(-8, -7, 22, 14);
  ctx.fillStyle = '#9aa6b1';
  ctx.fillRect(2, -3, 6, 6);
  ctx.fillStyle = '#4a545e';
  ctx.beginPath();
  ctx.arc(26, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(26, -1.5, 12, 3);
  ctx.fillStyle = C.interceptor;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) ctx.fillRect(-36 + i * 8, -6 + j * 7, 5, 5);
  ctx.restore();
  // Its own rack, like the carrier's.
  const rack = g.stats.frigateRack;
  drawRack(ctx, x, y - B - 10, rack, f.ammo, f.reloadT / g.stats.reload, g.overdriveT > 0);
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

function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, hp: number, id: number, t: number, maxHp: number = SHIP.hp, armored = false): void {
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
  // Armored Hulls: a heavy steel-blue edge.
  ctx.strokeStyle = armored ? '#a3b8cc' : C.hullEdge;
  ctx.lineWidth = armored ? 3 : 1.5;
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
  if (hp < maxHp) {
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

/** Full Steam: a white bow wave and speed streaks behind every hull. */
function drawSteam(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  // A churned white wake fanning out astern, streaks racing back, a bow wave.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(x - 34, y - 9);
  ctx.lineTo(x - 120, y - 22);
  ctx.lineTo(x - 120, y + 22);
  ctx.lineTo(x - 34, y + 9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 3;
  for (let k = -1; k <= 1; k++) {
    const off = (t * 260 + k * 29) % 70;
    ctx.beginPath();
    ctx.moveTo(x - 40 - off, y + k * 9);
    ctx.lineTo(x - 72 - off, y + k * 13);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x + 30, y, 13, -1.1, 1.1);
  ctx.stroke();
}

/** Smoke Screen clouds: billowing grey puffs riding with the ship. */
function drawSmoke(ctx: CanvasRenderingContext2D, g: Game): void {
  for (const sm of g.smokes) {
    const u = sm.t / SMOKE.time;
    const a = u < 0.15 ? u / 0.15 : 1 - Math.max(0, (u - 0.6) / 0.4);
    for (let k = 0; k < 7; k++) {
      const ang = k * 0.9 + sm.ship;
      const rr = SMOKE.radius * (0.35 + 0.45 * ((k * 37) % 10) / 10) * (0.6 + 0.4 * Math.min(1, u * 4));
      ctx.fillStyle = `rgba(200,205,210,${0.42 * a})`;
      ctx.beginPath();
      ctx.arc(sm.x + Math.cos(ang) * rr * 0.8 - u * 20, sm.y + Math.sin(ang) * rr * 0.5, 22 + 10 * Math.sin(k + sm.t * 2), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Shield pickup: a bubble over every ship and the carrier, flickering out. */
function drawShields(ctx: CanvasRenderingContext2D, g: Game): void {
  const ending = g.shieldT < 1.2 && Math.floor(g.t * 10) % 2 === 0;
  if (ending) return;
  ctx.strokeStyle = 'rgba(226,232,240,0.85)';
  ctx.fillStyle = 'rgba(186,230,253,0.16)';
  ctx.lineWidth = 2;
  const bubble = (x: number, y: number, rx: number, ry: number) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  for (const s of g.ships) bubble(s.x, s.y, 46, 22);
  bubble(g.map.carrier.x, g.map.carrier.y, CARRIER.halfLength + 22, CARRIER.halfBeam + 20);
}

/** Time Warp tint, and a countdown chip for every timed pickup running. */
function drawTimedPickups(ctx: CanvasRenderingContext2D, g: Game): void {
  if (g.warpT > 0) {
    const a = Math.min(1, g.warpT / 0.5);
    ctx.fillStyle = `rgba(94,234,212,${0.1 * a})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.strokeStyle = `rgba(94,234,212,${0.6 * a})`;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, VIEW.width - 8, VIEW.height - 8);
  }
  const chips: [string, number, string][] = [];
  if (g.overdriveT > 0) chips.push(['OVERDRIVE', g.overdriveT, PICKUP_COLORS.overdrive]);
  if (g.warpT > 0) chips.push(['TIME WARP', g.warpT, PICKUP_COLORS.timewarp]);
  if (g.shieldT > 0) chips.push(['SHIELD', g.shieldT, PICKUP_COLORS.shield]);
  if (g.steamT > 0) chips.push(['FULL STEAM', g.steamT, PICKUP_COLORS.steam]);
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  let x = 24;
  for (const [label, t, col] of chips) {
    const text = `${label} ${Math.ceil(t)}`;
    const w = ctx.measureText(text).width + 24;
    ctx.fillStyle = 'rgba(8,16,24,0.75)';
    ctx.beginPath();
    ctx.roundRect(x, 18, w, 34, 8);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.fillText(text, x + 12, 43);
    x += w + 10;
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
  switch (th.kind) {
    case 'supersonic':
      return drawSupersonic(ctx, g, th, heading);
    case 'heavy':
      missile(ctx, th.x, th.y, heading, 64, 17, '#5d5a52', '#c9a26b');
      return hpPips(ctx, th.x, th.y - 32, th.hp, THREATS.heavy.hp);
    case 'cluster': {
      const pulse = 0.5 + 0.5 * Math.sin(g.t * 9);
      ctx.strokeStyle = `rgba(255,210,74,${0.35 + 0.4 * pulse})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(th.x, th.y, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      missile(ctx, th.x, th.y, heading, 28, 8, '#ffd24a', C.danger);
      return;
    }
    case 'bomblet':
      ctx.strokeStyle = 'rgba(255,180,80,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(th.x, th.y);
      ctx.lineTo(th.x - Math.cos(heading) * 16, th.y - Math.sin(heading) * 16);
      ctx.stroke();
      ctx.fillStyle = '#ffb44f';
      ctx.strokeStyle = '#1b1b1b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(th.x, th.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      return;
    case 'mothership':
      deltaWing(ctx, th.x, th.y, heading, 2, '#9fd0a8');
      return hpPips(ctx, th.x, th.y - 40, th.hp, THREATS.mothership.hp);
    case 'minidrone':
      deltaWing(ctx, th.x, th.y, heading, 0.7, '#cfe8d2');
      return;
  }
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
  deltaWing(ctx, th.x, th.y, heading, 1, C.drone);
}

function deltaWing(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, k: number, fill: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.scale(k, k);
  for (const [dx, dy, f] of [
    [7, 12, 'rgba(0,0,0,0.35)'],
    [0, 0, fill],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(18 + dx, dy);
    ctx.lineTo(-13 + dx, -16 + dy);
    ctx.lineTo(-8 + dx, dy);
    ctx.lineTo(-13 + dx, 16 + dy);
    ctx.closePath();
    ctx.fillStyle = f;
    ctx.fill();
  }
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 2 / k;
  ctx.stroke();
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(-9, -2, 14, 4);
  ctx.restore();
}

/** Remaining hits over an armoured threat: one pip per hit, in a bar of
 *  fixed width so an 8-hit heavy stays as compact as a 5-hit mothership. */
function hpPips(ctx: CanvasRenderingContext2D, x: number, y: number, hp: number, max: number): void {
  const width = 66;
  const gap = 2;
  const w = (width - (max - 1) * gap) / max;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - width / 2 - 3, y - 3, width + 6, 13);
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = i < hp ? '#ff8a7a' : 'rgba(255,138,122,0.18)';
    ctx.fillRect(x - width / 2 + i * (w + gap), y, w, 7);
  }
}

function drawSupersonic(ctx: CanvasRenderingContext2D, g: Game, th: Threat, heading: number): void {
  if (th.age < SUPERSONIC.arming) {
    // Locking on: the base glows and a flashing line marks where it will go.
    const target = th.target === CARRIER_TARGET ? g.map.carrier : g.ships.find((s) => s.id === th.target);
    const flash = Math.floor(g.t * 8) % 2 === 0;
    ctx.fillStyle = `rgba(255,138,240,${0.25 + 0.25 * (th.age / SUPERSONIC.arming)})`;
    ctx.beginPath();
    ctx.arc(th.x, th.y, 30, 0, Math.PI * 2);
    ctx.fill();
    if (target) {
      ctx.strokeStyle = flash ? 'rgba(255,77,61,0.85)' : 'rgba(255,77,61,0.35)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(th.x, th.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    missile(ctx, th.x, th.y, th.heading, 30, 5, '#f4f1e8', '#ff8af0');
    return;
  }
  ctx.strokeStyle = 'rgba(255,138,240,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(th.x, th.y);
  ctx.lineTo(th.x - Math.cos(heading) * 90, th.y - Math.sin(heading) * 90);
  ctx.stroke();
  missile(ctx, th.x, th.y, heading, 34, 5, '#f4f1e8', '#ff8af0');
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
  timewarp: '#5eead4',
  shield: '#e2e8f0',
  strike: '#f87171',
  steam: '#fb923c',
};

function drawPickup(ctx: CanvasRenderingContext2D, kind: PickupKind, x: number, y: number, age: number, t: number, life: number = PICKUPS.life): void {
  const fading = age > life - 1.5;
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
  } else if (kind === 'timewarp') {
    // An hourglass.
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 12);
    ctx.lineTo(x + 9, y - 12);
    ctx.lineTo(x - 9, y + 12);
    ctx.lineTo(x + 9, y + 12);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'shield') {
    ctx.beginPath();
    ctx.moveTo(x, y - 13);
    ctx.lineTo(x + 10, y - 8);
    ctx.lineTo(x + 9, y + 2);
    ctx.quadraticCurveTo(x + 6, y + 9, x, y + 13);
    ctx.quadraticCurveTo(x - 6, y + 9, x - 9, y + 2);
    ctx.lineTo(x - 10, y - 8);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'strike') {
    // A jet seen from above, nose up.
    ctx.beginPath();
    ctx.moveTo(x, y - 13);
    ctx.lineTo(x + 3, y - 4);
    ctx.lineTo(x + 12, y + 3);
    ctx.lineTo(x + 3, y + 3);
    ctx.lineTo(x + 5, y + 11);
    ctx.lineTo(x, y + 9);
    ctx.lineTo(x - 5, y + 11);
    ctx.lineTo(x - 3, y + 3);
    ctx.lineTo(x - 12, y + 3);
    ctx.lineTo(x - 3, y - 4);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'steam') {
    // Double chevron: full ahead.
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    for (const dx of [-6, 4]) {
      ctx.beginPath();
      ctx.moveTo(x + dx - 4, y - 9);
      ctx.lineTo(x + dx + 5, y);
      ctx.lineTo(x + dx - 4, y + 9);
      ctx.stroke();
    }
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
      case 'flare': {
        // A burning flare arcs from the ship to the decoy point (the missile
        // chases it there), trailing sparks and smoke.
        const k = Math.min(1, u * 2.5);
        const px = f.x + (f.x2 - f.x) * k;
        const py = f.y + (f.y2 - f.y) * k - Math.sin(k * Math.PI) * 30;
        for (let j = 1; j <= 5; j++) {
          const kk = Math.max(0, k - j * 0.08);
          ctx.fillStyle = `rgba(210,210,215,${0.35 * (1 - u)})`;
          ctx.beginPath();
          ctx.arc(f.x + (f.x2 - f.x) * kk, f.y + (f.y2 - f.y) * kk - Math.sin(kk * Math.PI) * 30, 5 + j * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        const glow = ctx.createRadialGradient(px, py, 0, px, py, 26);
        glow.addColorStop(0, `rgba(255,250,220,${1 - u * 0.6})`);
        glow.addColorStop(0.35, `rgba(255,180,70,${0.8 * (1 - u * 0.6)})`);
        glow.addColorStop(1, 'rgba(255,140,40,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, 26, 0, Math.PI * 2);
        ctx.fill();
        if (u < 0.2) {
          ctx.strokeStyle = `rgba(255,240,200,${1 - u * 5})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(f.x, f.y, 20 + u * 80, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
      case 'flak':
        ctx.fillStyle = `rgba(70,75,82,${0.85 * (1 - u)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.6 + u), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,200,120,${1 - u * 2})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'jet': {
        // Strike Package: a friendly jet dives across the target, leaving a trail.
        const k = Math.min(1, u * 2.2);
        const jx = f.x2 + (f.x + 200 - f.x2) * k;
        const jy = f.y2 + (f.y + 40 - f.y2) * k;
        // Contrail, then the jet itself: a white delta with a red stripe.
        ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - u)})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(f.x2, f.y2);
        ctx.lineTo(jx, jy);
        ctx.stroke();
        ctx.setLineDash([]);
        const ang = Math.atan2(f.y + 40 - f.y2, f.x + 200 - f.x2);
        ctx.save();
        ctx.translate(jx, jy);
        ctx.rotate(ang);
        ctx.globalAlpha = 1 - u * u;
        ctx.fillStyle = '#f2f4f6';
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-10, -13);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-10, 13);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f87171';
        ctx.fillRect(-4, -1.5, 14, 3);
        ctx.restore();
        ctx.strokeStyle = `rgba(255,220,180,${0.8 * (1 - u)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(f.x - 14, f.y - 14);
        ctx.lineTo(f.x + 14, f.y + 14);
        ctx.moveTo(f.x + 14, f.y - 14);
        ctx.lineTo(f.x - 14, f.y + 14);
        ctx.stroke();
        break;
      }
      case 'block':
        // A hit turned away by the Shield.
        ctx.strokeStyle = `rgba(226,232,240,${1 - u})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (1 + u * 0.5), 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'spray': {
        // A missile leaving a submarine: a column of white water bursting up
        // (seen from above: a ring and droplets flung out) with a small flare.
        ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - u)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.6 + u * 0.8), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(220,240,250,${0.7 * (1 - u)})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (1 + u * 2.4), 0, Math.PI * 2);
        ctx.stroke();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + f.x * 0.01;
          ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - u)})`;
          ctx.beginPath();
          ctx.arc(f.x + Math.cos(a) * f.r * 2.4 * u, f.y + Math.sin(a) * f.r * 1.6 * u, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(255,150,70,${0.9 * (1 - u * 2)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 5 * (1 - u), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'spout': {
        // A gun round hitting the water: a white splash ring and droplets.
        ctx.strokeStyle = `rgba(240,248,252,${0.85 * (1 - u)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.5 + u * 1.4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - u)})`;
        for (let k = 0; k < 3; k++) {
          const a = k * 2.1 + f.x;
          ctx.beginPath();
          ctx.arc(f.x + Math.cos(a) * f.r * u * 1.8, f.y + Math.sin(a) * f.r * u * 1.8 - u * 10, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
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
