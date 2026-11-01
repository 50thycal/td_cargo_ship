// Canvas renderer. Reads a Game, draws one frame, mutates nothing. Everything
// is drawn in world units (VIEW is 1600×900); the caller sets the transform.

import { BALLISTIC, CARRIER, PICKUPS, SHIP, SUPERSONIC, THREATS, VIEW, type PickupKind, type RaidTheme } from '../data/config';
import { FORMATIONS } from '../data/formations';
import { halfWidthAt, type Landmass, type Point } from '../data/maps';
import { CARRIER_TARGET, pickupLife, raidWarning, reticleVisible, type Blade, type Bomb, type Launchers, type Escort, type Field, type Game, type Pickup, type Threat } from '../sim/game';
import { AB, ABILITY_MAX, SHORT_NAME } from '../data/abilities';
import { ICON_COLOR, iconImage } from './icons';
import { drawAlly, drawRoads, drawTunnels, drawPlane, drawPlaneWarnings, drawRaiders } from './vectors';

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
  /** Watch mode: a tap the bot made — drawn as a gold fingertip. */
  bot?: boolean;
  /** A tough threat shot down: a flash, a shock ring and its name. */
  impact?: string;
}

export const IMPACT_LIFE = 0.75;

export const RIPPLE_LIFE = 0.4;
export const DRY_LIFE = 0.7;

/** `bannerUp`: the wave/new-threat banner is showing at the map's callout
 *  point, so a raid warning moves above it. */
export function drawFrame(ctx: CanvasRenderingContext2D, g: Game, ripples: Ripple[], shake: number): void {
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawWater(ctx, g);
  for (const land of g.map.land) drawLand(ctx, land);
  drawRoads(ctx, g);
  drawLanes(ctx, g);
  drawBases(ctx, g);
  drawRaiders(ctx, g);
  drawTunnels(ctx, g);
  drawRaidWarning(ctx, g);
  drawCarrier(ctx, g);
  drawLoaded(ctx, g);
  for (const th of g.threats) if (th.kind === 'ballistic') drawBallisticGround(ctx, g, th);
  if (g.steamT > 0) for (const s of g.ships) drawSteam(ctx, s.x, s.y, g.t);
  drawFields(ctx, g, 'burn');
  drawFields(ctx, g, 'well');
  for (const s of g.ships) drawShip(ctx, s.x, s.y, s.hp, s.id, g.t, g.stats.shipHp);
  for (const e of g.escorts) drawEscort(ctx, e);
  if (g.shieldT > 0) drawShields(ctx, g);
  drawAegis(ctx, g);
  for (const p of g.pickups) {
    if (p.kind === 'weapon') drawWeaponPickup(ctx, g, p);
    else drawPickup(ctx, p.kind, p.x, p.y, p.age, g.t, pickupLife(p));
  }
  for (const th of g.threats) if (th.kind !== 'strafer' && th.kind !== 'bomber') drawThreat(ctx, g, th);
  drawFields(ctx, g, 'flak');
  for (const it of g.interceptors) {
    if (it.life < 0) continue;
    const a = Math.atan2(it.ty - it.y, it.tx - it.x);
    if (it.src === 'seeker') {
      // A seeker: a lime dart with a halo and a long trail (round 4: at
      // 3.5 px they couldn't be followed to their targets).
      ctx.strokeStyle = 'rgba(163, 230, 53, 0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(it.x - Math.cos(a) * 38, it.y - Math.sin(a) * 38);
      ctx.lineTo(it.x, it.y);
      ctx.stroke();
      dot(ctx, it.x, it.y, 10, 'rgba(163, 230, 53, 0.25)');
      dot(ctx, it.x, it.y, 5.5, ICON_COLOR.seeker);
      continue;
    }
    // A weapon's shell trails that weapon's colour.
    const col = it.weapon ? ICON_COLOR[it.weapon.id] : null;
    ctx.strokeStyle = col ?? 'rgba(127, 233, 255, 0.45)';
    ctx.globalAlpha = col ? 0.7 : 1;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(it.x - Math.cos(a) * 28, it.y - Math.sin(a) * 28);
    ctx.lineTo(it.x, it.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    dot(ctx, it.x, it.y, col ? 6.5 : 5.5, col ?? C.interceptor);
  }
  drawFx(ctx, g);
  // Aircraft fly above everything else, their warnings on top of that.
  for (const th of g.threats) if (th.kind === 'strafer' || th.kind === 'bomber') {
    drawPlane(ctx, g, th);
    hpPips(ctx, th.x, th.y - 44, th.hp, THREATS[th.kind].hp);
  }
  for (const b of g.blades) drawBlade(ctx, b);
  for (const b of g.bombs) drawBomb(ctx, b);
  for (const a of g.allies) drawAlly(ctx, g, a);
  drawPlaneWarnings(ctx, g);
  drawTimedPickups(ctx, g);
  for (const r of ripples) {
    if (r.impact) {
      const k = r.age / IMPACT_LIFE;
      const fade = 1 - k;
      // A white flash that collapses, a gold shock ring that opens out.
      if (k < 0.25) {
        ctx.fillStyle = `rgba(255,248,220,${0.85 * (1 - k / 0.25)})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 34 * (1 - k), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(245,197,66,${0.9 * fade})`;
      ctx.lineWidth = 6 * fade + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 20 + k * 110, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(245,197,66,${Math.min(1, fade * 1.6)})`;
      ctx.strokeStyle = `rgba(7,13,18,${Math.min(1, fade * 1.6)})`;
      ctx.lineWidth = 5;
      ctx.font = '900 30px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText(r.impact, r.x, r.y - 40 - k * 30);
      ctx.fillText(r.impact, r.x, r.y - 40 - k * 30);
      continue;
    }
    const fade = 1 - r.age / (r.dry ? DRY_LIFE : RIPPLE_LIFE);
    if (r.bot) {
      // The bot's fingertip: a filled dot where it pressed, a ring opening out.
      ctx.fillStyle = `rgba(245,197,66,${0.55 * fade})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(245,197,66,${0.9 * fade})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 16 + r.age * 60, 0, Math.PI * 2);
      ctx.stroke();
      if (!r.dry) continue;
    }
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
  if (land.hill) drawHill(ctx, land.points, enemy);
}

/** Round 13: the island as a hill, contour rings rising to a ridge, lit
 *  from the north-west so it reads as high ground at a glance. */
function drawHill(ctx: CanvasRenderingContext2D, pts: Point[], enemy: boolean): void {
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const rings = enemy ? ['#45332a', '#4e3a30', '#584337', '#634c3f'] : ['#2c3e30', '#334736', '#3a503d', '#425944'];
  rings.forEach((fill, i) => {
    const k = 0.82 - i * 0.2;
    ctx.beginPath();
    pts.forEach((p, j) => {
      // Rings sit a little north of centre: the light side of the hill.
      const x = cx + (p.x - cx) * k;
      const y = cy - 6 * (i + 1) + (p.y - cy) * k;
      if (j) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,225,190,0.10)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
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

/** Each raid's colour and call-out (the tray card in app.ts uses it too). */
export const RAID_LOOK: Record<RaidTheme, { color: string; name: string; tip: string }> = {
  swarm: { color: '255,255,255', name: 'SWARM', tip: 'drones · Column hurries ships past' },
  barrage: { color: '255,180,80', name: 'BARRAGE', tip: 'splash · Spread halves it' },
  volley: { color: '255,120,230', name: 'VOLLEY', tip: 'guided · Box armour blunts it' },
  strike: { color: '140,200,255', name: 'AIR STRIKE', tip: 'strafing · split up: Pairs or Spread' },
};

/** A raid is coming: its bases light up and its type is called out, so the
 *  player has a moment to pick the formation that answers it. */
function drawRaidWarning(ctx: CanvasRenderingContext2D, g: Game): void {
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
  // The call-out itself is a card in the notification tray (ui/alerts.ts).
}

/** Round 13: each base is a missile silo, a concrete pad with a hatch that
 *  slides open just before it fires and closes after. No symbol says what
 *  is inside: the raid warning (drawRaidWarning) still marks a raid's bases. */
function drawBases(ctx: CanvasRenderingContext2D, g: Game): void {
  g.map.bases.forEach((b, i) => {
    const open = hatchOpen(g, i);
    ctx.save();
    ctx.translate(b.x, b.y);
    // Pad, with a red rim: enemy ground.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 30, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a524b';
    ctx.strokeStyle = C.base;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 23, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30,26,22,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 21, 17, 0, 0, Math.PI * 2);
    ctx.stroke();
    // The shaft, lit from below while the hatch is open.
    ctx.fillStyle = open > 0 ? `rgb(${Math.round(40 + 120 * open)},${Math.round(18 + 40 * open)},10)` : '#141110';
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Two hatch doors sliding apart.
    const slide = 15 * open;
    ctx.fillStyle = '#7d756c';
    ctx.strokeStyle = '#2d2925';
    ctx.lineWidth = 1.5;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 12, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.rect(side < 0 ? -16 - slide : slide, -13, 16, 26);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  });
}

/** How open a base's hatch is, 0..1: opening over the 0.7 s before a launch
 *  it has queued, held while it fires, closing over 0.6 s after. */
function hatchOpen(g: Game, i: number): number {
  let open = 0;
  if (g.phase === 'wave')
    for (const l of g.queue) {
      if (l.base !== i || l.kind === 'strafer' || l.kind === 'bomber') continue;
      const ahead = l.at - g.waveT;
      if (ahead > 0.7) break;
      open = Math.max(open, 1 - ahead / 0.7);
    }
  const b = g.map.bases[i];
  for (const f of g.fx) {
    if (f.kind !== 'launch' || Math.abs(f.x - b.x) > 2 || Math.abs(f.y - b.y) > 2) continue;
    open = Math.max(open, 1 - f.age / f.life);
  }
  return Math.min(1, open);
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

/** What the weapons leave on the water: flak clouds (dark puffs sparking as
 *  they hit), gravity wells (a violet spiral turning inward, tightening as
 *  it closes) and Carpet Strike's burning row (flames along it). All fade in
 *  fast and out slowly. */
function drawFields(ctx: CanvasRenderingContext2D, g: Game, kind: Field['kind']): void {
  for (const f of g.fields) {
    if (f.kind !== kind) continue;
    const u = f.t / f.life;
    const a = u < 0.08 ? u / 0.08 : 1 - Math.max(0, (u - 0.7) / 0.3);
    if (kind === 'burn') drawBurn(ctx, f, a);
    else if (kind === 'flak') {
      // Dark puffs filling the circle, sparks winking in them (evolved,
      // Flak Curtain: a touch warmer).
      ctx.fillStyle = f.level >= 3 ? `rgba(92,74,62,${0.5 * a})` : `rgba(78,82,90,${0.48 * a})`;
      for (let k = 0; k < 8; k++) {
        const ang = k * 2.39996 + f.t * 0.4;
        const rr = k === 0 ? 0 : f.hw * 0.55 * Math.sqrt(k / 7);
        const wob = Math.sin(k * 1.7 + f.t * 2);
        ctx.beginPath();
        ctx.arc(f.x1 + Math.cos(ang) * rr, f.y1 + Math.sin(ang) * rr, f.hw * (0.42 + 0.08 * wob), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(255,200,120,${0.9 * a})`;
      for (let k = 0; k < 6; k++) {
        const ang = k * 1.9 + Math.floor(g.t * 12) * 0.7;
        const rr = f.hw * (0.2 + 0.7 * (((k * 37 + Math.floor(g.t * 12)) % 10) / 10));
        ctx.beginPath();
        ctx.arc(f.x1 + Math.cos(ang) * rr, f.y1 + Math.sin(ang) * rr, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // A gravity well: a haze, and a spiral turning in, shrinking to its
      // core as it closes.
      const glow = ctx.createRadialGradient(f.x1, f.y1, 0, f.x1, f.y1, f.hw);
      glow.addColorStop(0, `rgba(192,132,252,${0.3 * a})`);
      glow.addColorStop(1, 'rgba(192,132,252,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(f.x1, f.y1, f.hw, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(216,180,254,${0.8 * a})`;
      ctx.lineWidth = 2.5;
      const reach = f.hw * (1 - 0.6 * u);
      for (let arm = 0; arm < 3; arm++) {
        ctx.beginPath();
        for (let k = 0; k <= 24; k++) {
          const p = k / 24;
          const ang = arm * ((Math.PI * 2) / 3) + p * 4 + f.t * 5;
          const rr = reach * (1 - p);
          const x = f.x1 + Math.cos(ang) * rr;
          const y = f.y1 + Math.sin(ang) * rr;
          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      dot(ctx, f.x1, f.y1, 5, `rgba(250,245,255,${a})`);
    }
  }
}

/** Aegis Launchers: each hull's own interceptors, upright over it in the
 *  weapon's colour (one per round left); a reloading Bastion slot fills in
 *  as it comes back. */
function drawAegis(ctx: CanvasRenderingContext2D, g: Game): void {
  const col = ICON_COLOR.aegis;
  const one = (x: number, y: number, l: Launchers, max: number) => {
    // Round 8: half again as big, outlined: at the first size they were
    // ~4 px on a phone.
    for (let k = 0; k < max; k++) {
      const mx = x - (max - 1) * 10 + k * 20;
      const loaded = k < l.ammo;
      ctx.save();
      ctx.translate(mx, y);
      ctx.globalAlpha = loaded ? 1 : 0.25 + 0.5 * Math.min(1, l.reloadT / AB.aegis.reload) * (k === l.ammo ? 1 : 0);
      ctx.fillStyle = loaded ? col : 'rgba(255,255,255,0.35)';
      ctx.strokeStyle = '#0b2430';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(5.5, -5);
      ctx.lineTo(5.5, 9);
      ctx.lineTo(-5.5, 9);
      ctx.lineTo(-5.5, -5);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }
  };
  const w = g.weapon?.id === 'aegis' ? g.weapon : null;
  if (!w) return;
  const k = w.level - 1;
  for (const s of g.ships) if (s.aegis) one(s.x, s.y - 36, s.aegis, AB.aegis.missiles[k]);
  if (g.carrierAegis) one(g.map.carrier.x, g.map.carrier.y - CARRIER.halfBeam - 26, g.carrierAegis, AB.aegis.carrier);
}

/** Carpet Strike's napalm canisters: tumbling end over end as they fall
 *  behind the jet, shrinking towards the water, a shadow closing in under
 *  them. */
function drawBomb(ctx: CanvasRenderingContext2D, b: Bomb): void {
  const u = Math.min(1, b.t / AB.airstrike.fall);
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.25 * u})`;
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + 6, 10 - 4 * u, 4 - 1.5 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(b.x, b.y - 22 * (1 - u));
  ctx.rotate(b.t * 18);
  ctx.scale(1.25 - 0.45 * u, 1.25 - 0.45 * u);
  ctx.fillStyle = '#3b3f45';
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f97316';
  ctx.fillRect(-3, -4.5, 3, 9);
  ctx.fillStyle = '#2a2d31';
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-15, -6);
  ctx.lineTo(-15, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A Frigate Escort frigate: a grey warship in the weapon's steel, bigger
 *  than a cargo hull, its gun turned to its last target. */
function drawEscort(ctx: CanvasRenderingContext2D, e: Escort): void {
  // Round 6: at cargo-hull size and grey it read as part of the convoy; a
  // frigate is half again as long, dark, outlined, with a wake.
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.strokeStyle = 'rgba(226,240,255,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-74, -6);
  ctx.lineTo(-130, -16);
  ctx.moveTo(-74, 6);
  ctx.lineTo(-130, 16);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(4, 10, 76, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3f4a55';
  ctx.strokeStyle = ICON_COLOR.frigate;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-74, -12);
  ctx.lineTo(52, -12);
  ctx.lineTo(78, 0);
  ctx.lineTo(52, 12);
  ctx.lineTo(-74, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8796a3';
  ctx.fillRect(-40, -8, 44, 16);
  ctx.fillRect(-18, -4, 12, 8);
  // The gun: a turret forward, its barrel toward the last target.
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(30, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(30 + Math.cos(e.aim) * 24, Math.sin(e.aim) * 24);
  ctx.stroke();
  ctx.restore();
}

/** A Boomerang blade: three curved arms spinning. */
function drawBlade(ctx: CanvasRenderingContext2D, b: Blade): void {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.spin);
  // Round 6 cycle 3: at phone size the first blade (22 px arms) read as a
  // small cyan dot; longer, outlined arms read as a spinning blade.
  const r = b.level >= 2 ? 40 : 34;
  ctx.fillStyle = ICON_COLOR.boomerang;
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#0e3a44';
  ctx.lineWidth = 2.5;
  for (let k = 0; k < 3; k++) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.6, -r * 0.1, r, -r * 0.75);
    ctx.quadraticCurveTo(r * 0.45, -r * 0.02, -2, r * 0.3);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }
  dot(ctx, 0, 0, 5, '#ecfeff');
  ctx.restore();
}

/** Carpet Strike's row: a dim band of heat with small flames licking up
 *  along it (round 4: full-strength beads across the whole screen drowned
 *  out the threats). */
function drawBurn(ctx: CanvasRenderingContext2D, f: Field, a: number): void {
  ctx.strokeStyle = `rgba(255,120,40,${0.14 * a})`;
  ctx.lineWidth = f.hw * 2;
  ctx.beginPath();
  ctx.moveTo(f.x1, f.y1);
  ctx.lineTo(f.x2, f.y2);
  ctx.stroke();
  const len = Math.hypot(f.x2 - f.x1, f.y2 - f.y1);
  const n = Math.max(2, Math.round(len / 40));
  for (let k = 0; k <= n; k++) {
    const p = k / n;
    const x = f.x1 + (f.x2 - f.x1) * p;
    const y = f.y1 + (f.y2 - f.y1) * p;
    const wob = Math.sin(k * 1.7 + f.t * 6);
    ctx.fillStyle = `rgba(255,${130 + Math.round(60 * wob)},50,${0.32 * a})`;
    ctx.beginPath();
    ctx.arc(x, y + wob * 3, 6 + 4 * Math.abs(wob), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A weapon pickup: bigger than a power-up, a hexagon in the weapon's
 *  colour with its icon, its name under it and a spinning ring, so it reads
 *  as "a new gun", not another power-up. Blinks before it is gone. */
function drawWeaponPickup(ctx: CanvasRenderingContext2D, g: Game, p: Pickup): void {
  const life = pickupLife(p);
  if (p.age > life - 1.5 && Math.floor(g.t * 8) % 2) return;
  const id = p.weapon!;
  const col = ICON_COLOR[id];
  const r = PICKUPS.radius * 1.3 * (0.94 + 0.06 * Math.sin(g.t * 6));
  ctx.save();
  ctx.translate(p.x, p.y);
  const halo = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2);
  halo.addColorStop(0, `${col}55`);
  halo.addColorStop(1, `${col}00`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(10,20,28,0.88)';
  ctx.strokeStyle = col;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const ang = Math.PI / 6 + (k * Math.PI) / 3;
    ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 7]);
  ctx.lineDashOffset = -g.t * 30;
  ctx.beginPath();
  ctx.arc(0, 0, r + 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  const img = iconImage(id);
  if (img) ctx.drawImage(img, -r * 0.62, -r * 0.62, r * 1.24, r * 1.24);
  const lv = g.levels[id] ?? 1;
  const label = SHORT_NAME[id][lv >= ABILITY_MAX ? 1 : 0];
  // Round 4: at 15 px the name was ~7 px on a phone; 22 px reads at ~10.
  ctx.font = '900 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(7,13,18,0.9)';
  ctx.strokeText(label, 0, r + 30);
  ctx.fillStyle = col;
  ctx.fillText(label, 0, r + 30);
  ctx.restore();
}

/** A weapon loaded: a ring in its colour around the carrier, draining with
 *  the seconds left (as Overdrive's does), and blinking in the last two. */
function drawLoaded(ctx: CanvasRenderingContext2D, g: Game): void {
  const w = g.weapon;
  if (!w || (w.t < 2 && Math.floor(g.t * 8) % 2)) return;
  const { x, y } = g.map.carrier;
  const col = ICON_COLOR[w.id];
  const rx = CARRIER.halfLength + 34;
  const ry = CARRIER.halfBeam + 30;
  ctx.save();
  ctx.strokeStyle = col;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, w.t / g.stats.weaponTime));
  ctx.stroke();
  ctx.restore();
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
  // The countdowns themselves are in the left rail (app.ts syncTimers),
  // off the battlefield.
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

export const PICKUP_COLORS: Record<PickupKind, string> = {
  weapon: '#ffd166',
  ammo: '#f5c542',
  repair: '#4ade80',
  overdrive: '#38bdf8',
  timewarp: '#5eead4',
  shield: '#e2e8f0',
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
      case 'frag': {
        // A fragment (Shrapnel) or a pellet (Scattergun, r = 1): a bright
        // streak from where it left to where it stopped, running out along
        // it, then fading.
        const k = Math.min(1, u * 3);
        const hx = f.x + (f.x2 - f.x) * k;
        const hy = f.y + (f.y2 - f.y) * k;
        ctx.strokeStyle = f.r ? `rgba(245,190,255,${1 - u})` : `rgba(250,204,21,${0.9 * (1 - u)})`;
        ctx.lineWidth = 4; // round 6 cycle 3: 2.5 px fragments were hair-thin on a phone
        ctx.beginPath();
        ctx.moveTo(f.x + (f.x2 - f.x) * Math.max(0, k - 0.45), f.y + (f.y2 - f.y) * Math.max(0, k - 0.45));
        ctx.lineTo(hx, hy);
        ctx.stroke();
        dot(ctx, hx, hy, 3.5, `rgba(255,250,220,${1 - u})`);
        break;
      }
      case 'thermo': {
        // Thermobaric: a white-hot flash filling the blast, a rose shock
        // ring racing to its edge.
        ctx.fillStyle = `rgba(255,236,210,${0.55 * Math.max(0, 1 - u * 2.2)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * Math.min(1, 0.4 + u * 2), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(251,113,133,${0.9 * (1 - u)})`;
        ctx.lineWidth = 8 * (1 - u) + 2;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * Math.min(1, 0.3 + u * 1.4), 0, Math.PI * 2);
        ctx.stroke();
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
      case 'beam': {
        // Railgun: a white-hot core in a pink sheath, narrowing as it fades.
        const w = f.r * 2 * (1 - u * 0.7);
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(244,114,182,${0.55 * (1 - u)})`;
        ctx.lineWidth = w + 10;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x2, f.y2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,245,250,${1 - u})`;
        ctx.lineWidth = Math.max(2, w * 0.4);
        ctx.stroke();
        ctx.lineCap = 'butt';
        break;
      }
      case 'arc': {
        // Tesla Arc: a jagged bolt (jitter from the endpoints, no RNG).
        ctx.strokeStyle = `rgba(199,210,254,${1 - u})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        const n = 6;
        for (let k = 1; k < n; k++) {
          const p = k / n;
          const j = Math.sin(k * 12.9898 + f.x * 0.37 + f.y2 * 0.11) * 14;
          const dx = f.x2 - f.x;
          const dy = f.y2 - f.y;
          const l = Math.hypot(dx, dy) || 1;
          ctx.lineTo(f.x + dx * p - (dy / l) * j, f.y + dy * p + (dx / l) * j);
        }
        ctx.lineTo(f.x2, f.y2);
        ctx.stroke();
        break;
      }
      case 'emp':
        // Gravity Well closing: a violet ring snapping out from its core.
        ctx.strokeStyle = `rgba(192,132,252,${0.9 * (1 - u)})`;
        ctx.lineWidth = 10 * (1 - u) + 2;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * u, 0, Math.PI * 2);
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
