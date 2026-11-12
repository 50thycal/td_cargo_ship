// Canvas renderer. Reads a Game, draws one frame, mutates nothing. Everything
// is drawn in world units (VIEW is 1600×900); the caller sets the transform.

import { BALLISTIC, CARRIER, PICKUPS, SHIP, SUPERSONIC, THREATS, VIEW, VIP, type PickupKind, type RaidTheme } from '../data/config';
import { FORMATIONS } from '../data/formations';
import { type Landmass, type Point } from '../data/maps';
import { CARRIER_TARGET, beatClock, boostLevel, lanceCharge, pickupLife, raidWarning, reticleVisible, warping, type Blade, type Bomb, type Launchers, type Escort, type Field, type Game, type Pickup, type Threat } from '../sim/game';
import { AB, ABILITY_MAX, SHORT_NAME, type AbilityId } from '../data/abilities';
import { ICON_COLOR, iconImage } from './icons';
import { isBoost } from '../data/roster';
import { drawAlly, drawRoads, drawTunnels, drawPlane, drawPlaneWarnings, drawRaiders } from './vectors';
import { drawMapUnder, drawNewThreat, drawNight, drawPosts, drawTracked } from './features';
import { drawEventOver, drawEventUnder } from './events';
import { drawFoe, drawFoeAir, drawFoeGround, drawFoeShots, drawLockedPickup, isFoeAircraft } from './foes';
import { pickupLocked } from '../sim/foes';
import { laneSamples } from '../sim/lanes';

export const C = {
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
  drawMapUnder(ctx, g);
  drawBases(ctx, g);
  drawRaiders(ctx, g);
  drawTunnels(ctx, g);
  drawRaidWarning(ctx, g);
  drawCarrier(ctx, g);
  drawLoaded(ctx, g);
  for (const th of g.threats) if (th.kind === 'ballistic') drawBallisticGround(ctx, g, th);
  drawFoeGround(ctx, g);
  drawEventUnder(ctx, g);
  if (g.steamT > 0 || boostLevel(g, 'fullSteam')) for (const s of g.ships) drawSteam(ctx, s.x, s.y, g.t);
  drawFields(ctx, g, 'burn');
  drawFields(ctx, g, 'well');
  drawFields(ctx, g, 'sun');
  drawFields(ctx, g, 'laser');
  for (const s of g.ships) drawShip(ctx, s.x, s.y, s.hp, s.id, g.t, s.vip ? VIP.hp : g.stats.shipHp, false, s.heading, s.vip);
  drawPosts(ctx, g);
  for (const e of g.escorts) drawEscort(ctx, e);
  if (g.shieldT > 0 || boostLevel(g, 'shield')) drawShields(ctx, g);
  drawAegis(ctx, g);
  for (const p of g.pickups) {
    if (p.chute) drawChute(ctx, p.x, p.y, p.chute);
    if (p.kind === 'weapon') drawWeaponPickup(ctx, g, p);
    else drawPickup(ctx, p.kind, p.x, p.y, p.age, g.t, pickupLife(p));
    // Locked by a Scavenger's ring (round 8).
    if (pickupLocked(g, p)) drawLockedPickup(ctx, g, p);
  }
  for (const th of g.threats) if (th.kind !== 'strafer' && th.kind !== 'bomber' && !isFoeAircraft(th.kind)) drawThreat(ctx, g, th);
  drawTracked(ctx, g);
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
    // A weapon's shell trails that weapon's colour; Hyper Overdrive's second
    // shot trails Overdrive's gold, so the pair reads as two.
    const col = it.twin ? ICON_COLOR.overdrive : it.weapon ? ICON_COLOR[it.weapon.id] : null;
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
  drawFoeShots(ctx, g);
  drawFx(ctx, g);
  drawPlanWeapons(ctx, g);
  drawPassives(ctx, g);
  // Aircraft fly above everything else, their warnings on top of that.
  for (const th of g.threats) if (th.kind === 'strafer' || th.kind === 'bomber') {
    drawPlane(ctx, g, th);
    hpPips(ctx, th.x, th.y - 44, th.hp, th.maxHp ?? THREATS[th.kind].hp);
  }
  for (const th of g.threats) if (isFoeAircraft(th.kind)) drawFoeAir(ctx, g, th);
  for (const b of g.blades) drawBlade(ctx, b);
  for (const b of g.bombs) drawBomb(ctx, b);
  for (const a of g.allies) drawAlly(ctx, g, a);
  drawEventOver(ctx, g);
  drawNight(ctx, g, (th) => drawBallisticGround(ctx, g, th));
  drawBoosts(ctx, g);
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
    // Sampled along the lane so a funnel's lanes visibly converge and a
    // bend's lanes follow the turn. A tide lane fades out at low water.
    const samples = laneSamples(ch, 80);
    const dim = ch.tide && g.map.tide && !(g.t % (g.map.tide.high + g.map.tide.low) < g.map.tide.high);
    ctx.globalAlpha = dim ? 0.25 : 1;
    for (const o of ch.vip ? [0] : offsets) {
      ctx.beginPath();
      samples.forEach(({ p, hw }, k) => {
        const x = p.x - p.ty * o * hw;
        const y = p.y + p.tx * o * hw;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
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
    // Rigs, generators and the Citadel draw as themselves (features.ts);
    // coves and mine chutes are drawn under the convoy.
    if (b.rig || b.generator || b.core || b.cove || b.chute) return;
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

function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, hp: number, id: number, t: number, maxHp: number = SHIP.hp, armored = false, heading = 0, vip = false): void {
  // The supertanker: twice the length, a plain red deck.
  const L = vip ? 70 : 34;
  const B = vip ? 16 : 10;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
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
  // Container stacks (the tanker: a long red deck with pipework)
  if (vip) {
    ctx.fillStyle = '#7a2e26';
    ctx.fillRect(-L + 14, -B + 4, L * 2 - 34, B * 2 - 8);
    ctx.strokeStyle = 'rgba(255,220,160,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-L + 16, 0);
    ctx.lineTo(L - 22, 0);
    ctx.stroke();
  } else
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = CONTAINER_TINTS[(id + i * 3) % CONTAINER_TINTS.length];
    ctx.fillRect(-L + 9 + i * 9, -B + 3, 7, B * 2 - 6);
  }
  // Bridge at the stern
  ctx.fillStyle = '#e8e4da';
  ctx.fillRect(-L + 2, -B + 3, 5, B * 2 - 6);
  ctx.restore();
  if (vip) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 40, y - 34, 80, 8);
    ctx.fillStyle = hp > maxHp / 2 ? '#5ee08a' : hp > 2 ? '#f5c542' : '#ff4d3d';
    ctx.fillRect(x - 40, y - 34, (80 * Math.max(0, hp)) / maxHp, 8);
    // No "TANKER" word over it (player: keep the water clean); its size and
    // health bar mark it, and the map's first-wave hint names it.
  }
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
    else if (kind === 'sun' || kind === 'laser') {
      // Sunspear's burning line (gold) and Searing Edge's lit cut (pink).
      const col = kind === 'sun' ? [255, 222, 120] : [255, 79, 163];
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(${col.join(',')},${0.28 * a})`;
      ctx.lineWidth = f.hw * 2;
      ctx.beginPath();
      ctx.moveTo(f.x1, f.y1);
      ctx.lineTo(f.x2, f.y2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,250,240,${0.8 * a})`;
      ctx.lineWidth = 2 + Math.sin(f.t * 30) * 0.8;
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
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

/** Point Defense (the id: aegis): each hull's own interceptors, upright over it in the
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
  // It sails its lane: around a bend the hull turns with it.
  ctx.rotate(e.heading);
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
  ctx.lineTo(30 + Math.cos(e.aim - e.heading) * 24, Math.sin(e.aim - e.heading) * 24);
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
  // A boost is a diamond (it never replaces the loaded weapon); a weapon a
  // hexagon.
  if (isBoost(id)) {
    for (let k = 0; k < 4; k++) ctx.lineTo(Math.cos((k * Math.PI) / 2) * r * 1.15, Math.sin((k * Math.PI) / 2) * r * 1.15);
  } else {
    for (let k = 0; k < 6; k++) {
      const ang = Math.PI / 6 + (k * Math.PI) / 3;
      ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
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
  // Dual Wield: the second weapon's ring sits outside the first; a boost's
  // ring outside both.
  if (g.weapon2) drawLoadedRing(ctx, g, g.weapon2.id, g.weapon2.t, 14);
  if (g.boost) drawLoadedRing(ctx, g, g.boost.id, g.boost.t, g.weapon2 ? 28 : 14, true);
  if (g.weapon) drawLoadedRing(ctx, g, g.weapon.id, g.weapon.t, 0);
}

function drawLoadedRing(ctx: CanvasRenderingContext2D, g: Game, id: AbilityId, t: number, out: number, boost = false): void {
  if (t < 2 && Math.floor(g.t * 8) % 2) return;
  const { x, y } = g.map.carrier;
  const col = ICON_COLOR[id];
  const rx = CARRIER.halfLength + 34 + out;
  const ry = CARRIER.halfBeam + 30 + out;
  const w = { t };
  if (boost) ctx.setLineDash([10, 6]);
  ctx.save();
  ctx.strokeStyle = col;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, w.t / g.stats.weaponTime)));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/** Phase 3: what the running boost looks like on the battlefield. Time
 *  Warp drains the colour and trails the threats; Focus darkens the edges
 *  while time is slowed. */
function drawBoosts(ctx: CanvasRenderingContext2D, g: Game): void {
  const c = g.map.carrier;
  if (warping(g)) {
    // Trails behind every threat, then the whole field drained of colour.
    ctx.save();
    ctx.lineCap = 'round';
    for (const th of g.threats) {
      if (th.dead || th.kind === 'ballistic' || THREATS[th.kind].hp >= 10) continue;
      const sp = Math.hypot(th.vx, th.vy);
      const ux = sp > 1 ? th.vx / sp : Math.cos(th.heading);
      const uy = sp > 1 ? th.vy / sp : Math.sin(th.heading);
      for (let k = 1; k <= 4; k++) {
        ctx.globalAlpha = 0.28 - k * 0.055;
        dot(ctx, th.x - ux * k * 14, th.y - uy * k * 14, 9 - k, '#c4b5fd');
      }
    }
    ctx.globalAlpha = 0.75;
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(167,139,250,0.55)';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, VIEW.width - 8, VIEW.height - 8);
    ctx.restore();
  }
  if (g.focusing) {
    ctx.save();
    const v = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.35, VIEW.width / 2, VIEW.height / 2, VIEW.width * 0.62);
    v.addColorStop(0, 'rgba(10,20,40,0)');
    v.addColorStop(1, 'rgba(10,20,40,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.strokeStyle = 'rgba(147,197,253,0.7)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, VIEW.width - 6, VIEW.height - 6);
    ctx.restore();
  }
  // Focus: the bank of slow motion, a bar over the carrier.
  if (g.boost?.id === 'focus') {
    const full = AB.focus.bank[g.boost.level - 1];
    const u = g.boost.bank / full;
    const w = 120;
    const y = c.y - CARRIER.halfBeam - 34;
    ctx.fillStyle = 'rgba(10,20,28,0.8)';
    ctx.fillRect(c.x - w / 2 - 2, y - 2, w + 4, 10);
    ctx.fillStyle = ICON_COLOR.focus;
    ctx.fillRect(c.x - w / 2, y, w * u, 6);
  }
}

/** The weapons plan's phase 1 weapons, drawn from the live sim state:
 *  Charge Lance's ring and aim, the Grapnel's cable and flings, Chain Shot's
 *  links, Fire Control's marks, Cadence Gun's beat. */
function drawPlanWeapons(ctx: CanvasRenderingContext2D, g: Game): void {
  const c = g.map.carrier;
  const w = g.weapon;
  const p = g.press;
  ctx.save();
  // Charge Lance: the ring on the carrier fills as the press charges; the
  // aim line follows the finger. Half and full are marked on the ring.
  if (w?.id === 'lance' && p) {
    const ch = lanceCharge(g, p, w);
    const u = Math.min(1, ch / AB.lance.full);
    const r = CARRIER.halfLength + 8;
    const full = ch >= AB.lance.full;
    const half = ch >= AB.lance.half;
    ctx.strokeStyle = 'rgba(255,243,176,0.25)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = full ? '#fffbe6' : half ? '#ffd84d' : 'rgba(255,216,77,0.7)';
    ctx.lineWidth = full ? 9 : 7;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * u);
    ctx.stroke();
    // The half mark.
    const ha = -Math.PI / 2 + Math.PI * 2 * (AB.lance.half / AB.lance.full);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(c.x + Math.cos(ha) * (r - 9), c.y + Math.sin(ha) * (r - 9));
    ctx.lineTo(c.x + Math.cos(ha) * (r + 9), c.y + Math.sin(ha) * (r + 9));
    ctx.stroke();
    if (p.mode === 'charge') {
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = full ? 'rgba(255,251,230,0.85)' : 'rgba(255,216,77,0.55)';
      ctx.lineWidth = full ? 4 : 2.5;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = full ? '#fffbe6' : '#ffd84d';
      ctx.font = '800 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(full ? 'FULL ▸ 6' : half ? 'HALF ▸ 3' : 'CHARGING', c.x, c.y - r - 16);
    }
  }
  // Laser Cutter (the player's note): a thin red sight line from the
  // carrier's gun to the finger while it is down, so the cut looks like it
  // comes from the ship. Only a look: the cut is still where the finger is.
  if (w?.id === 'cutter' && p && (p.mode === 'pending' || p.mode === 'swipe')) {
    const gx = c.x;
    const gy = c.y - 6;
    const flick = 0.85 + 0.15 * Math.sin(g.t * 41);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,30,40,${0.16 * flick})`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,70,70,${0.8 * flick})`;
    ctx.lineWidth = 1.75;
    ctx.stroke();
    ctx.lineCap = 'butt';
    for (const [x, y, r] of [[gx, gy, 5], [p.x, p.y, 4]] as const) {
      ctx.fillStyle = `rgba(255,40,40,${0.3 * flick})`;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff4a4a';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,235,235,0.95)';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Grapnel: the cable from the carrier to the ball, and the ball's ring.
  if (p?.mode === 'hook') {
    const th = g.threats.find((t) => t.id === p.hook && !t.dead);
    if (th) {
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 6);
      ctx.quadraticCurveTo((c.x + th.x) / 2, Math.max(c.y, th.y) - 20, th.x, th.y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(52,211,153,0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(th.x, th.y, AB.grapnel.smackR, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  for (const f of g.flings) {
    const th = g.threats.find((t) => t.id === f.id);
    if (!th) continue;
    ctx.strokeStyle = 'rgba(52,211,153,0.55)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(th.x - f.vx * 0.06, th.y - f.vy * 0.06);
    ctx.lineTo(th.x, th.y);
    ctx.stroke();
  }
  // Cadence Gun (the player's note): a ring closes in from the edges of the
  // sea onto the carrier and lands on the beat, and on the beat the whole
  // border of the sea pulses, so the beat is easy to see and to anticipate.
  if (w?.id === 'cadence') {
    const b = beatClock(g, w);
    const P = AB.cadence.period;
    const since = g.t - (w.t0 ?? g.t);
    const toNext = since < P ? P - since : (P - (since % P)) % P;
    const lead = 1 - toNext / P; // 0 just after a beat, 1 on the next
    const R0 = Math.hypot(VIEW.width, VIEW.height) * 0.55;
    const r = 30 + (R0 - 30) * (1 - lead);
    ctx.strokeStyle = `rgba(245,158,11,${0.25 + lead * 0.6})`;
    ctx.lineWidth = 3 + lead * 5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    // The on-beat window: the border glows while a tap counts.
    const win = AB.cadence.window[w.level - 1];
    const glow = since >= P - win ? Math.max(0, 1 - b.off / Math.max(win, 1e-6)) : 0;
    const hit = g.fx.find((f) => f.kind === 'beat');
    const pulse = Math.max(glow, hit ? 1 - hit.age / hit.life : 0);
    if (pulse > 0) {
      const t = 10 + pulse * 22;
      ctx.strokeStyle = `rgba(245,158,11,${0.25 + pulse * 0.55})`;
      ctx.lineWidth = t;
      ctx.strokeRect(t / 2, t / 2, VIEW.width - t, VIEW.height - t);
    }
    // A thin progress bar along the top edge (the cue that survives Reduced
    // Motion, and a clock either way).
    ctx.fillStyle = 'rgba(245,158,11,0.85)';
    ctx.fillRect(VIEW.width / 2 - 160, 8, 320 * lead, 6);
    ctx.strokeStyle = 'rgba(245,158,11,0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(VIEW.width / 2 - 160, 8, 320, 6);
  }
  ctx.restore();
}

/** The phase 2 passives: Drone Screen's drones, the gunships, Bomber Wing's
 *  bombers and the silos they silenced, Orbital Strike's laser dots. */
function drawPassives(ctx: CanvasRenderingContext2D, g: Game): void {
  ctx.save();
  // Drones: small cyan chevrons with a short trail.
  for (const d of g.wings) {
    ctx.strokeStyle = 'rgba(125,211,252,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(d.x - Math.cos(d.heading) * 26, d.y - Math.sin(d.heading) * 26);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.heading);
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -9);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Gunships: a ship-sized helicopter (the phone check: a strong silhouette
  // and a rotor disc), its shadow on the water. The nose points along
  // `heading`; it dips into its acceleration (lean: the body shortens and
  // the shadow trails) and banks into turns (roll: the body skews), and
  // bobs gently in the hover.
  for (const h of g.helis) {
    const bob = Math.sin(g.t * 2.3 + h.id) * 1.6;
    for (const shadow of [true, false]) {
      ctx.save();
      ctx.translate(h.x + (shadow ? 16 - Math.cos(h.heading) * h.lean * 6 : 0), h.y + (shadow ? 26 - Math.sin(h.heading) * h.lean * 6 : bob));
      ctx.rotate(h.heading);
      ctx.scale(1 - Math.abs(h.lean) * 0.12, 1 - Math.abs(h.roll) * 0.18);
      ctx.transform(1, h.roll * 0.12, 0, 1, 0, 0);
      ctx.globalAlpha = shadow ? 0.28 : 1;
      drawGunship(ctx, g, h, shadow);
      ctx.restore();
    }
  }
  // Hellfires: a smoke streak behind each missile, then the missile itself
  // with its motor glowing.
  for (const m of g.hellfires) {
    const tr = m.trail;
    ctx.lineCap = 'round';
    for (let i = 2; i < tr.length; i += 2) {
      const u = i / tr.length;
      ctx.strokeStyle = `rgba(214,214,206,${0.12 + 0.45 * u})`;
      ctx.lineWidth = 2 + (1 - u) * 6;
      ctx.beginPath();
      ctx.moveTo(tr[i - 2], tr[i - 1]);
      ctx.lineTo(tr[i], tr[i + 1]);
      ctx.stroke();
    }
    if (tr.length) {
      ctx.strokeStyle = 'rgba(230,230,222,0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(tr[tr.length - 2], tr[tr.length - 1]);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.heading);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.ellipse(-12, 0, 6 + Math.sin(g.t * 60 + m.id) * 1.5, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d7d9cf';
    ctx.fillRect(-8, -2.2, 16, 4.4);
    ctx.beginPath();
    ctx.moveTo(8, -2.2);
    ctx.lineTo(13, 0);
    ctx.lineTo(8, 2.2);
    ctx.fill();
    ctx.fillStyle = '#7b8070';
    ctx.fillRect(-8, -4.5, 3, 9);
    ctx.restore();
  }
  // Supply Run: a big four-engine cargo plane crossing, its shadow far below.
  for (const pl of g.planes) drawCargoPlane(ctx, g, pl);
  // Bombers: a heavy bomber crossing, its shadow below.
  for (const b of g.sorties) {
    for (const shadow of [true, false]) {
      ctx.save();
      ctx.translate(b.x + (shadow ? 22 : 0), b.y + (shadow ? 34 : 0));
      if (b.vx < 0) ctx.scale(-1, 1);
      ctx.globalAlpha = shadow ? 0.3 : 1;
      ctx.fillStyle = shadow ? '#000' : '#9ca3af';
      ctx.beginPath();
      ctx.moveTo(46, 0);
      ctx.lineTo(30, -6);
      ctx.lineTo(-40, -6);
      ctx.lineTo(-46, 0);
      ctx.lineTo(-40, 6);
      ctx.lineTo(30, 6);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(10, -6);
      ctx.lineTo(-12, -52);
      ctx.lineTo(-24, -52);
      ctx.lineTo(-14, -6);
      ctx.moveTo(10, 6);
      ctx.lineTo(-12, 52);
      ctx.lineTo(-24, 52);
      ctx.lineTo(-14, 6);
      ctx.fill();
      ctx.fillRect(-46, -16, 8, 32);
      ctx.restore();
    }
  }
  // Silenced silos: a red cross and the seconds left.
  g.map.bases.forEach((b, i) => {
    const left = (g.quietUntil[i] ?? 0) - g.t;
    if (left <= 0) return;
    ctx.strokeStyle = '#ff4d3d';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(b.x - 22, b.y - 22);
    ctx.lineTo(b.x + 22, b.y + 22);
    ctx.moveTo(b.x + 22, b.y - 22);
    ctx.lineTo(b.x - 22, b.y + 22);
    ctx.stroke();
    ctx.fillStyle = 'rgba(8,16,24,0.85)';
    ctx.fillRect(b.x - 48, b.y + 28, 96, 26);
    ctx.fillStyle = '#ff6b5a';
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`SILENT ${Math.ceil(left)}`, b.x, b.y + 47);
  });
  // Orbital Strike locking on: three laser dots slide in from the edges of
  // the sea and close on the target, a shrinking triangle.
  const o = g.orbital;
  if (o) {
    const th = g.threats.find((t) => t.id === o.id && !t.dead);
    if (th) {
      const u = Math.min(1, o.t / AB.orbital.lock);
      const R = (1 - u) * 520 + 6;
      ctx.strokeStyle = `rgba(255,107,107,${0.35 + u * 0.5})`;
      ctx.fillStyle = '#ff4d4d';
      ctx.lineWidth = 2;
      const pts = [0, 1, 2].map((k) => {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 3 + (1 - u) * 1.2;
        return { x: th.x + Math.cos(a) * R, y: th.y + Math.sin(a) * R };
      });
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,107,107,0.4)';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(th.x, th.y);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** A Gunship Pair helicopter, seen from above, nose along +x (Test Lab round
 *  5, the player: "make it look more like an Apache attack helicopter"): a
 *  long narrow fuselage with a tandem cockpit (gunner ahead, pilot behind
 *  and higher), the sensor turret on the nose, engine pods either side of
 *  the mast, stub wings with a rocket pod and a missile rail at each tip, a
 *  long tail boom with its tailplane, the tail rotor on its side, and a
 *  four-blade main rotor. Generic: no markings. */
function drawGunship(ctx: CanvasRenderingContext2D, g: Game, h: { id: number; lean: number; roll: number }, shadow: boolean): void {
  const body = shadow ? '#000' : '#4f5a3a';
  const dark = shadow ? '#000' : '#363e28';
  const round = (x: number, y: number, w: number, hh: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, hh, r);
    ctx.fill();
  };
  ctx.fillStyle = body;
  // Tail boom, tailplane and fin.
  ctx.beginPath();
  ctx.moveTo(-14, -5);
  ctx.lineTo(-54, -2.5);
  ctx.lineTo(-54, 2.5);
  ctx.lineTo(-14, 5);
  ctx.fill();
  round(-52, -12, 7, 24, 2);
  // Fuselage: narrow, tapering to the nose.
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.quadraticCurveTo(28, -6, 18, -6.5);
  ctx.lineTo(-10, -7.5);
  ctx.quadraticCurveTo(-18, -6, -18, 0);
  ctx.quadraticCurveTo(-18, 6, -10, 7.5);
  ctx.lineTo(18, 6.5);
  ctx.quadraticCurveTo(28, 6, 30, 0);
  ctx.fill();
  // Engine pods either side behind the mast.
  ctx.fillStyle = dark;
  round(-14, -13, 16, 6, 3);
  round(-14, 7, 16, 6, 3);
  // Stub wings, a rocket pod and a missile rail at each tip.
  ctx.fillStyle = body;
  ctx.fillRect(-2, -24, 7, 48);
  ctx.fillStyle = dark;
  for (const s of [-1, 1]) {
    round(-5, s > 0 ? 15 : -21, 15, 6, 3);
    ctx.fillRect(-4, s > 0 ? 22 : -25, 13, 3);
  }
  if (shadow) return;
  // Rocket tubes on the pods' faces, and the nose turret.
  ctx.fillStyle = '#1f2418';
  for (const s of [-1, 1]) for (const k of [-1.5, 1.5]) {
    ctx.beginPath();
    ctx.arc(10, (s > 0 ? 18 : -18) + k, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#2b3022';
  ctx.beginPath();
  ctx.arc(30, 0, 3.4, 0, Math.PI * 2);
  ctx.fill();
  // Tandem cockpit: the gunner's pane ahead, the pilot's behind it.
  ctx.fillStyle = '#b9d7ef';
  round(13, -4, 9, 8, 3);
  ctx.fillStyle = '#9cc3e3';
  round(2, -4.5, 9, 9, 3);
  ctx.strokeStyle = '#2b3022';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(11.5, -4);
  ctx.lineTo(11.5, 4);
  ctx.stroke();
  // Tail rotor on the boom's side: a small blurred disc.
  ctx.strokeStyle = 'rgba(230,240,230,0.55)';
  ctx.lineWidth = 2;
  const ta = g.t * 50 + h.id;
  ctx.beginPath();
  ctx.moveTo(-50 + Math.cos(ta) * 7, -6 + Math.sin(ta) * 2);
  ctx.lineTo(-50 - Math.cos(ta) * 7, -6 - Math.sin(ta) * 2);
  ctx.stroke();
  // The main rotor: a disc and four blades spinning, tilted with the lean.
  ctx.strokeStyle = 'rgba(230,240,230,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(-4 + h.lean * 4, 0, 40, 40 * (1 - Math.abs(h.roll) * 0.15), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(235,245,235,0.5)';
  ctx.lineWidth = 2.5;
  const a = g.t * 30 + h.id;
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const b = a + (k * Math.PI) / 2;
    ctx.moveTo(-4, 0);
    ctx.lineTo(-4 + Math.cos(b) * 40, Math.sin(b) * 40);
  }
  ctx.stroke();
  ctx.fillStyle = '#2b3022';
  ctx.beginPath();
  ctx.arc(-4, 0, 3, 0, Math.PI * 2);
  ctx.fill();
}

/** Shield pickup: a bubble over every ship and the carrier, flickering out. */
function drawShields(ctx: CanvasRenderingContext2D, g: Game): void {
  const left = g.boost?.id === 'shield' ? g.boost.t : g.shieldT;
  const ending = left < 1.2 && Math.floor(g.t * 10) % 2 === 0;
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
  if (drawNewThreat(ctx, g, th)) return;
  if (drawFoe(ctx, g, th)) return;
  const heading = Math.atan2(th.vy, th.vx) || th.heading;
  switch (th.kind) {
    case 'supersonic':
      return drawSupersonic(ctx, g, th, heading);
    case 'heavy':
      missile(ctx, th.x, th.y, heading, 64, 17, '#5d5a52', '#c9a26b');
      return hpPips(ctx, th.x, th.y - 32, th.hp, th.maxHp ?? THREATS.heavy.hp);
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
      return hpPips(ctx, th.x, th.y - 40, th.hp, th.maxHp ?? THREATS.mothership.hp);
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

export function deltaWing(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, k: number, fill: string): void {
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
export function hpPips(ctx: CanvasRenderingContext2D, x: number, y: number, hp: number, max: number): void {
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

export function missile(
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
  starshell: '#fff1a8',
  nuke: '#ff6b4a',
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
  } else if (kind === 'starshell') {
    // A bursting star: the light it throws over the dark sea.
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const rr = i % 2 ? 5 : 12;
      if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'nuke') {
    // The trefoil: three blades round a hub.
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, 13, a - 0.5, a + 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(10,20,28,0.9)';
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
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
        // (Hyper Overdrive's second cone: Overdrive's yellow.)
        ctx.strokeStyle = f.twin && f.r ? `rgba(253,224,71,${1 - u})` : f.r ? `rgba(245,190,255,${1 - u})` : `rgba(250,204,21,${0.9 * (1 - u)})`;
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
      case 'lance':
      case 'cut': {
        // Charge Lance (gold) and Laser Cutter (pink): a hot core in a sheath.
        // Hyper Overdrive's second one: Overdrive's yellow, slimmer, so the
        // two read apart.
        const col = f.twin ? '253,224,71' : f.kind === 'lance' ? '255,216,77' : '255,79,163';
        const w = f.r * (f.kind === 'lance' ? 2 : 0.9) * (1 - u * 0.6) * (f.twin ? 0.6 : 1);
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(${col},${0.6 * (1 - u)})`;
        ctx.lineWidth = w + 8;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x2, f.y2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,252,240,${1 - u})`;
        ctx.lineWidth = Math.max(2, w * 0.35);
        ctx.stroke();
        ctx.lineCap = 'butt';
        break;
      }
      case 'chain': {
        // The Grapnel's cable snapping taut on a hook.
        ctx.strokeStyle = `rgba(52,211,153,${1 - u})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x2, f.y2);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case 'nuke': {
        // A white flash over everything, then a shock ring rolling out.
        ctx.fillStyle = `rgba(255,248,235,${Math.max(0, 0.75 - u * 1.6)})`;
        ctx.fillRect(0, 0, VIEW.width, VIEW.height);
        ctx.strokeStyle = `rgba(255,107,74,${0.8 * (1 - u)})`;
        ctx.lineWidth = 18 * (1 - u) + 2;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * u, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'beat':
        // Drawn by drawPlanWeapons (the aura), not here.
        break;
      case 'orbital': {
        // Orbital Strike: a red-white column from the top of the sea.
        const w = f.r * (1 - u * 0.5);
        ctx.fillStyle = `rgba(255,107,107,${0.45 * (1 - u)})`;
        ctx.fillRect(f.x - w / 2, 0, w, f.y);
        ctx.fillStyle = `rgba(255,245,245,${1 - u})`;
        ctx.fillRect(f.x - w / 6, 0, w / 3, f.y);
        ctx.strokeStyle = `rgba(255,107,107,${1 - u})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.6 + u), 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'shatter': {
        // Shield (level 2) takes a strafing run: the bubble cracks, then
        // its shards fly off.
        ctx.strokeStyle = `rgba(103,232,249,${1 - u})`;
        ctx.lineWidth = 3;
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 + 0.3;
          const r0 = f.r * (0.55 + u * 0.9);
          const r1 = r0 + 14 + 10 * ((k * 7) % 3);
          ctx.beginPath();
          ctx.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0 * 0.6);
          ctx.lineTo(f.x + Math.cos(a + 0.18) * r1, f.y + Math.sin(a + 0.18) * r1 * 0.6);
          ctx.stroke();
        }
        if (u < 0.35) {
          // The crack lines across the bubble before it breaks.
          ctx.strokeStyle = `rgba(255,255,255,${1 - u * 2.5})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(f.x - f.r, f.y - 6);
          ctx.lineTo(f.x - 10, f.y + 4);
          ctx.lineTo(f.x + 6, f.y - 8);
          ctx.lineTo(f.x + f.r, f.y + 2);
          ctx.moveTo(f.x - 10, f.y + 4);
          ctx.lineTo(f.x - 4, f.y + 16);
          ctx.stroke();
        }
        break;
      }
      case 'beam': {
        // Railgun: a white-hot core in a pink sheath, narrowing as it fades
        // (Hyper Overdrive's second beam: a slimmer yellow sheath).
        const w = f.r * 2 * (1 - u * 0.7) * (f.twin ? 0.6 : 1);
        ctx.lineCap = 'round';
        ctx.strokeStyle = f.twin ? `rgba(253,224,71,${0.6 * (1 - u)})` : `rgba(244,114,182,${0.55 * (1 - u)})`;
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

/** A Supply Run crate on its parachute (`left`: seconds of descent left). */
function drawChute(ctx: CanvasRenderingContext2D, x: number, y: number, left: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = Math.min(1, left / 0.25);
  const sway = Math.sin(left * 7) * 0.12;
  ctx.rotate(sway);
  ctx.fillStyle = 'rgba(241,245,249,0.92)';
  ctx.strokeStyle = 'rgba(148,163,184,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, -58, 30, Math.PI, 0);
  ctx.quadraticCurveTo(15, -64, 0, -58);
  ctx.quadraticCurveTo(-15, -64, -30, -58);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#86efac';
  ctx.beginPath();
  ctx.arc(0, -58, 30, Math.PI, Math.PI * 1.33);
  ctx.lineTo(0, -58);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-30, -58);
  ctx.lineTo(-10, -20);
  ctx.moveTo(30, -58);
  ctx.lineTo(10, -20);
  ctx.moveTo(0, -58);
  ctx.lineTo(0, -20);
  ctx.stroke();
  ctx.restore();
}

/** Supply Run's cargo plane: a high wing with four turning props, a fat
 *  fuselage and a high tail, its shadow on the water. */
function drawCargoPlane(ctx: CanvasRenderingContext2D, g: Game, pl: { x: number; y: number; vx: number }): void {
  for (const shadow of [true, false]) {
    ctx.save();
    ctx.translate(pl.x + (shadow ? 30 : 0), pl.y + (shadow ? 54 : 0));
    if (pl.vx < 0) ctx.scale(-1, 1);
    ctx.globalAlpha = shadow ? 0.25 : 1;
    const hull = shadow ? '#000' : '#8a9478';
    ctx.fillStyle = hull;
    // Fuselage, nose to the right.
    ctx.beginPath();
    ctx.moveTo(70, 0);
    ctx.quadraticCurveTo(66, -12, 50, -13);
    ctx.lineTo(-56, -10);
    ctx.lineTo(-76, -3);
    ctx.lineTo(-76, 3);
    ctx.lineTo(-56, 10);
    ctx.lineTo(50, 13);
    ctx.quadraticCurveTo(66, 12, 70, 0);
    ctx.fill();
    // Wing and tailplane.
    ctx.beginPath();
    ctx.moveTo(18, -12);
    ctx.lineTo(4, -86);
    ctx.lineTo(-10, -86);
    ctx.lineTo(-6, -12);
    ctx.moveTo(18, 12);
    ctx.lineTo(4, 86);
    ctx.lineTo(-10, 86);
    ctx.lineTo(-6, 12);
    ctx.moveTo(-58, -8);
    ctx.lineTo(-70, -32);
    ctx.lineTo(-78, -32);
    ctx.lineTo(-74, -6);
    ctx.moveTo(-58, 8);
    ctx.lineTo(-70, 32);
    ctx.lineTo(-78, 32);
    ctx.lineTo(-74, 6);
    ctx.fill();
    if (!shadow) {
      // Engines and props.
      for (const ey of [-62, -34, 34, 62]) {
        ctx.fillStyle = '#5f6852';
        ctx.fillRect(4 + Math.abs(ey) * -0.12, ey - 4, 20, 8);
        ctx.strokeStyle = 'rgba(235,240,230,0.55)';
        ctx.lineWidth = 2;
        const a = g.t * 40 + ey;
        ctx.beginPath();
        ctx.moveTo(25 + Math.abs(ey) * -0.12, ey + Math.cos(a) * 11);
        ctx.lineTo(25 + Math.abs(ey) * -0.12, ey - Math.cos(a) * 11);
        ctx.stroke();
      }
      // Cockpit glass and a cargo door line.
      ctx.fillStyle = '#c9e3ff';
      ctx.fillRect(54, -6, 8, 12);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-50, -9);
      ctx.lineTo(-50, 9);
      ctx.stroke();
    }
    ctx.restore();
  }
}
