// The enemy build: how the new enemies look (docs/design/v3-enemy-build.md).
// Each one is drawn so its tell reads on a phone: the booster flare, the
// decoys' strobe, the forked tail, the launcher's slow raise, the circling
// group.

import { THREATS } from '../data/config';
import { FOE } from '../data/foes';
import { CARRIER_TARGET, type Game, type Threat } from '../sim/game';
import { revealedDecoy, shellAt, siegeUp, type FoeMark } from '../sim/foes';
import { C, deltaWing, hpPips, missile } from './render';

/** Draw a new enemy; false if `th` isn't one of them. */
export function drawFoe(ctx: CanvasRenderingContext2D, g: Game, th: Threat): boolean {
  const heading = Math.atan2(th.vy, th.vx) || th.heading;
  switch (th.kind) {
    case 'sprinter':
      drawSprinter(ctx, g, th, heading);
      return true;
    case 'decoy':
      drawDecoy(ctx, g, th, heading);
      return true;
    case 'hydra':
      drawHydra(ctx, g, th, heading);
      return true;
    case 'dart':
      // Small and fast: a violet halo and a long trail so the pair reads.
      ctx.fillStyle = 'rgba(176,124,255,0.28)';
      ctx.beginPath();
      ctx.arc(th.x, th.y, 15, 0, Math.PI * 2);
      ctx.fill();
      trail(ctx, th.x, th.y, heading, 54, 'rgba(196,140,255,0.7)', 3.5);
      missile(ctx, th.x, th.y, heading, 24, 6, '#f3e8ff', '#b07cff');
      return true;
    case 'loiter':
      drawLoiter(ctx, th, heading);
      return true;
    case 'rocketTruck':
      drawRocketTruck(ctx, g, th);
      return true;
    case 'heliRocket':
      trail(ctx, th.x, th.y, heading, 30, 'rgba(255,200,170,0.45)', 2.5);
      missile(ctx, th.x, th.y, heading, 20, 5, '#f4e4dc', C.danger);
      return true;
    case 'torpedoSub':
      drawTorpedoSub(ctx, g, th);
      return true;
    case 'torpedo':
      drawTorpedo(ctx, g, th);
      return true;
    case 'armored':
      drawArmored(ctx, g, th, heading);
      return true;
    case 'crosser':
      deltaWing(ctx, th.x, th.y, heading, 0.85, (th.foe?.state ?? 0) === 0 ? '#7dd3c0' : '#5eead4');
      return true;
    case 'scavenger':
      drawScavenger(ctx, g, th, heading);
      return true;
    case 'siege':
      drawSiege(ctx, g, th);
      return true;
    case 'tender':
      drawTender(ctx, g, th);
      return true;
    case 'guard':
      deltaWing(ctx, th.x, th.y, th.heading, 0.62, '#fde68a');
      return true;
    case 'picket':
      drawPicket(ctx, th);
      return true;
    case 'lure':
      drawLure(ctx, g, th);
      return true;
    case 'barge':
      drawBarge(ctx, th);
      return true;
    case 'cloud':
      drawCloud(ctx, g, th);
      return true;
    default:
      return false;
  }
}

/** Aircraft among the new enemies: drawn above the rest. */
export function isFoeAircraft(kind: Threat['kind']): boolean {
  return kind === 'attackHeli' || kind === 'stealthJet' || kind === 'stealthBomber' || kind === 'diveBomber' || kind === 'spotter';
}

/** The aircraft layer. */
export function drawFoeAir(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  if (th.kind === 'attackHeli') drawAttackHeli(ctx, g, th);
  else if (th.kind === 'stealthJet') drawStealthJet(ctx, g, th);
  else if (th.kind === 'stealthBomber') drawStealthBomber(ctx, th);
  else if (th.kind === 'diveBomber') drawDiveBomber(ctx, th);
  else if (th.kind === 'spotter') drawSpotter(ctx, th);
}

/** Under everything that flies: the loiter spots, the trucks' targets, the
 *  periscopes, the torpedo lines, the wing's crossing. */
export function drawFoeGround(ctx: CanvasRenderingContext2D, g: Game): void {
  for (const m of g.foe.marks) if (m.kind === 'periscope') drawPeriscope(ctx, g, m.x, m.y, m.t / m.dur);
  for (const th of g.threats) if (th.kind === 'torpedo' && !th.dead) drawTorpedoLine(ctx, g, th);
  const wings = new Map<number, Threat>();
  for (const th of g.threats) if (th.kind === 'crosser' && !th.dead && th.foe && th.foe.state === 0) wings.set(th.foe.link, th);
  for (const th of wings.values()) drawCrossing(ctx, g, th);
  for (const th of g.threats) if (th.kind === 'attackHeli' && !th.dead && th.foe && th.foe.state === 0) drawHeliSpot(ctx, g, th);
  // Marks on the water: a dive bomber's circle (before the plane, under it,
  // under its bomb), a siege battery's circles.
  for (const m of g.foe.marks) {
    if (m.kind === 'dive') drawTargetCircle(ctx, g, m.x, m.y, FOE.diveBomber.hit + 14, m.t / m.dur, '255,77,61');
    if (m.kind === 'shell') drawTargetCircle(ctx, g, m.x, m.y, FOE.siege.radius, m.t / m.dur, '255,170,60');
    if (m.kind === 'hatch') drawHatch(ctx, g, m);
  }
  for (const th of g.threats) if (th.kind === 'diveBomber' && th.foe && th.foe.state === 0) drawTargetCircle(ctx, g, th.foe.px, th.foe.py, FOE.diveBomber.hit + 14, 1, '255,77,61');
  for (const s of g.foe.shots) if (s.kind === 'bomb') drawTargetCircle(ctx, g, s.tx, s.ty, FOE.diveBomber.hit + 14, 1, '255,77,61');
  // A Flak Picket's ring; a Bodyguard Ring's orbit; a Supply Barge's +1
  // over every live site; a Tender's beam as it charges.
  for (const th of g.threats) {
    if (th.dead) continue;
    if (th.kind === 'picket') drawPicketRing(ctx, g, th);
    if (th.kind === 'heavy' && g.threats.some((t) => t.kind === 'guard' && !t.dead && t.foe?.link === th.id)) {
      ctx.strokeStyle = 'rgba(253,230,138,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(th.x, th.y, FOE.bodyguard.orbit, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (th.kind === 'barge') drawBargeTags(ctx, g);
    if (th.kind === 'tender' && th.foe?.state === 1) {
      const t = g.threats.find((o) => o.id === th.foe!.link && !o.dead);
      if (t) {
        const k = Math.min(1, th.foe.t / FOE.tender.charge);
        ctx.strokeStyle = `rgba(74,222,128,${0.35 + 0.6 * k})`;
        ctx.lineWidth = 2 + 4 * k;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(th.x, th.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = `rgba(74,222,128,${0.5 + 0.5 * k})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 30 - 10 * k, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  // A spotter's beam and the bracket round its ship.
  const p = g.foe.paint;
  const spotter = p && g.threats.find((t) => t.id === p.by && !t.dead);
  const ship = p && g.ships.find((o) => o.id === p.ship);
  if (spotter && ship) drawPaint(ctx, g, spotter, ship);
  const spots = new Map<number, Threat>();
  for (const th of g.threats) if (th.kind === 'loiter' && !th.dead && th.foe && th.foe.state < 2) spots.set(th.foe.link, th);
  for (const th of spots.values()) {
    const f = th.foe!;
    // The ambush ring: how close a ship can come before they dive.
    const pulse = 0.5 + 0.5 * Math.sin(g.t * 3);
    ctx.strokeStyle = `rgba(255,170,90,${0.18 + 0.14 * pulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.arc(f.px, f.py, FOE.loiter.trigger, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** Test Lab round 1: everything no interceptor can stop is red all over,
 *  with a red glow ("make the projectiles red, then we can tell the player:
 *  red projectiles you just cannot intercept"). Missiles you can shoot are
 *  pale with a red tip; these are red from nose to tail. */
export const RED_SHOT = '#ff2b2b';
const RED_DEEP = '#8f0d0d';

/** The red glow round a shot that can't be stopped. */
function redGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a = 0.55): void {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(255,50,40,${a})`);
  grad.addColorStop(1, 'rgba(255,40,40,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** A red ball (a shell; a bomb seen from above) with a dark rim. */
function redBall(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, angle = 0): void {
  ctx.fillStyle = RED_SHOT;
  ctx.strokeStyle = RED_DEEP;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,220,210,0.8)';
  ctx.beginPath();
  ctx.arc(x - rx * 0.3, y - ry * 0.35, Math.max(1.5, Math.min(rx, ry) * 0.3), 0, Math.PI * 2);
  ctx.fill();
}

/** Shots no interceptor can stop, all red: the Rocket Truck's salvos, a
 *  dive bomber's bomb, a siege battery's shells in flight. */
export function drawFoeShots(ctx: CanvasRenderingContext2D, g: Game): void {
  for (const m of g.foe.marks) {
    if (m.kind !== 'shell' || !m.fired) continue;
    // A shell lobbed from the gun, arcing down onto its circle; its shadow
    // runs straight along the ground under it.
    const p = shellAt(m);
    const u = Math.max(0, Math.min(1, 1 - (m.dur - m.t) / FOE.siege.flight));
    const gx = m.gx ?? m.x;
    const gy = m.gy ?? m.y;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(gx + (m.x - gx) * u, gy + (m.y - gy) * u, 5, 0, Math.PI * 2);
    ctx.fill();
    redGlow(ctx, p.x, p.y, 20);
    redBall(ctx, p.x, p.y, 7, 7);
  }
  for (const s of g.foe.shots) {
    if (s.kind === 'bomb') {
      // Falling on from where the plane let go: it closes on its shadow and
      // shrinks toward the water.
      const u = Math.min(1, s.t / s.dur);
      const alt = 1 - u;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(s.x + 10 * alt, s.y + 15 * alt, 5 + 2 * u, 3 + 1.5 * u, 0, 0, Math.PI * 2);
      ctx.fill();
      const a = Math.atan2(s.ty - s.sy, s.tx - s.sx);
      redGlow(ctx, s.x, s.y, 22);
      redBall(ctx, s.x, s.y, 10 - 3 * u, 6 - 1.5 * u, a);
      continue;
    }
    const a = Math.atan2(s.ty - s.sy, s.tx - s.sx);
    // Where it lands, the moment it's fired: a small red cross on the water.
    ctx.strokeStyle = 'rgba(255,60,50,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.tx - 6, s.ty - 6);
    ctx.lineTo(s.tx + 6, s.ty + 6);
    ctx.moveTo(s.tx + 6, s.ty - 6);
    ctx.lineTo(s.tx - 6, s.ty + 6);
    ctx.stroke();
    // A small red rocket with a red-tinged smoke streak back toward the
    // truck (a salvo is five of these, a tenth of a second apart).
    const back = Math.min(70, Math.hypot(s.x - s.sx, s.y - s.sy));
    const grad = ctx.createLinearGradient(s.x - Math.cos(a) * back, s.y - Math.sin(a) * back, s.x, s.y);
    grad.addColorStop(0, 'rgba(200,170,165,0)');
    grad.addColorStop(1, 'rgba(255,110,90,0.8)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(a) * back, s.y - Math.sin(a) * back);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    redGlow(ctx, s.x, s.y, 13, 0.5);
    missile(ctx, s.x, s.y, a, 11, 3.5, RED_SHOT, RED_DEEP);
  }
}

function trail(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, len: number, color: string, w: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - Math.cos(heading) * len, y - Math.sin(heading) * len);
  ctx.stroke();
}

/** A small dart-shaped drone; its flare is a fat orange flame and a glow,
 *  and once sprinting, a long hot streak. */
function drawSprinter(ctx: CanvasRenderingContext2D, g: Game, th: Threat, heading: number): void {
  const st = th.foe?.state ?? 0;
  if (st === 1) {
    // The flare: a hot glow and a ring that tightens onto it, so the
    // moment before the sprint can't be missed.
    const k = Math.min(1, (th.foe?.t ?? 0) / FOE.sprinter.flare);
    ctx.fillStyle = `rgba(255,170,50,${0.3 + 0.35 * k})`;
    ctx.beginPath();
    ctx.arc(th.x, th.y, 16 + 10 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,240,200,${0.5 + 0.5 * k})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(th.x, th.y, 44 - 22 * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (st === 2) trail(ctx, th.x, th.y, heading, 70, 'rgba(255,170,60,0.6)', 4);
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.rotate(heading);
  if (st >= 1) {
    // The booster.
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(-9, -4);
    ctx.lineTo(-22 - (st === 2 ? 10 : 6) - (g.steps % 3) * 2, 0);
    ctx.lineTo(-9, 4);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.moveTo(19, 9);
  ctx.lineTo(-5, -1);
  ctx.lineTo(-1, 9);
  ctx.lineTo(-5, 19);
  ctx.fill();
  ctx.fillStyle = '#f0a35e';
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(-9, -2, 12, 4);
  ctx.restore();
}

/** Far off, a decoy is an attack drone, light and all. Up close it gives
 *  itself away: a white strobe and a dotted trail. */
function drawDecoy(ctx: CanvasRenderingContext2D, g: Game, th: Threat, heading: number): void {
  if (!revealedDecoy(th)) {
    drawDroneLike(ctx, th, heading);
    return;
  }
  ctx.strokeStyle = 'rgba(230,240,255,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 6]);
  ctx.beginPath();
  ctx.moveTo(th.x, th.y);
  ctx.lineTo(th.x - Math.cos(heading) * 46, th.y - Math.sin(heading) * 46);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.75;
  deltaWing(ctx, th.x, th.y, heading, 1, '#b9c4cf');
  ctx.globalAlpha = 1;
  // A white ring round every decoy, and the strobe on top.
  ctx.strokeStyle = 'rgba(235,245,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(th.x, th.y, 20, 0, Math.PI * 2);
  ctx.stroke();
  const on = Math.floor(g.t * 10 + th.id) % 3 === 0;
  if (on) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(th.x, th.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(th.x, th.y, 16, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The attack drone exactly as render.ts draws it, so a hidden decoy
 *  matches the real ones in its swarm. */
function drawDroneLike(ctx: CanvasRenderingContext2D, th: Threat, heading: number): void {
  deltaWing(ctx, th.x, th.y, heading, 1, C.drone);
}

/** A two-hit missile with a forked tail: two fins and two exhausts. */
function drawHydra(ctx: CanvasRenderingContext2D, g: Game, th: Threat, heading: number): void {
  const target = th.target === CARRIER_TARGET ? g.map.carrier : g.ships.find((s) => s.id === th.target);
  if (target) {
    ctx.strokeStyle = 'rgba(196,140,255,0.22)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(th.x, th.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Two exhaust trails, splayed: the fork.
  for (const s of [-1, 1]) {
    const a = heading + Math.PI + s * 0.32;
    ctx.strokeStyle = 'rgba(196,140,255,0.45)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(th.x - Math.cos(heading) * 14, th.y - Math.sin(heading) * 14);
    ctx.lineTo(th.x - Math.cos(heading) * 14 + Math.cos(a) * 30, th.y - Math.sin(heading) * 14 + Math.sin(a) * 30);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.rotate(heading);
  ctx.fillStyle = '#b07cff';
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-8, s * 4);
    ctx.lineTo(-20, s * 13);
    ctx.lineTo(-15, s * 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  missile(ctx, th.x, th.y, heading, 30, 7, th.hp > 1 ? '#e9d8ff' : '#f6eaff', '#b07cff');
}

/** Loitering drones: drones in a circle; diving, they turn red. */
function drawLoiter(ctx: CanvasRenderingContext2D, th: Threat, heading: number): void {
  const diving = (th.foe?.state ?? 0) >= 2;
  if (diving) trail(ctx, th.x, th.y, heading, 40, 'rgba(255,90,70,0.5)', 3);
  deltaWing(ctx, th.x, th.y, heading, 0.9, diving ? '#ff7a63' : '#e0a971');
}

/** The Rocket Truck: a red-roofed launcher truck, unlike the grey missile
 *  trucks (it can be shot). While it raises, a ring fills round it: when the
 *  ring closes, the rockets start. */
function drawRocketTruck(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const f = th.foe;
  const st = f?.state ?? 0;
  const R = FOE.rocketTruck;
  let elev = 0;
  if (st === 1) elev = Math.min(1, (f?.t ?? 0) / R.raise);
  else if (st === 2) elev = 1;
  else if (st === 3) elev = 1 - Math.min(1, (f?.t ?? 0) / R.lower);
  if (st === 1) {
    const k = elev;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(th.x, th.y, 38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = k > 0.75 && Math.floor(g.t * 8) % 2 ? '#ffffff' : '#ff4d3d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(th.x, th.y, 38, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.rotate(th.heading);
  ctx.scale(1.25, 1.25);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-21, -5, 46, 18);
  ctx.strokeStyle = 'rgba(255,120,100,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-25, -13, 51, 26, 5);
  ctx.stroke();
  ctx.fillStyle = '#141210';
  for (const wx of [-15, -4, 13]) {
    ctx.fillRect(wx - 3, -11, 7, 3);
    ctx.fillRect(wx - 3, 8, 7, 3);
  }
  ctx.fillStyle = '#5a4a3c';
  ctx.strokeStyle = '#1b1a14';
  ctx.lineWidth = 1.5;
  ctx.fillRect(-22, -8, 32, 16);
  ctx.strokeRect(-22, -8, 32, 16);
  ctx.fillStyle = '#b8402f';
  ctx.beginPath();
  ctx.roundRect(10, -8, 13, 16, 3);
  ctx.fill();
  ctx.stroke();
  // The launcher box: a grid of tubes that tips up as it raises (drawn
  // longer as it lifts, since we look down on it).
  const len = 26 + elev * 10;
  ctx.fillStyle = '#3a3530';
  ctx.fillRect(-20, -7, len * (1 - elev * 0.35), 14);
  ctx.strokeRect(-20, -7, len * (1 - elev * 0.35), 14);
  ctx.fillStyle = elev >= 1 ? '#ff6b4a' : '#1b1a14';
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) ctx.fillRect(-18 + c * 6 + len * (1 - elev * 0.35) - 22, -5 + r * 6, 4, 4);
  ctx.restore();
  hpPips(ctx, th.x, th.y - 40, th.hp, THREATS.rocketTruck.hp);
}

/** A hostile helicopter from above: a dark red body, a tail boom, and a
 *  spinning rotor disc. */
function drawAttackHeli(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  ctx.save();
  ctx.translate(th.x, th.y);
  // Shadow on the water, offset as if from altitude.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(14, 22, 26, 12, th.heading, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(th.heading);
  ctx.fillStyle = '#7f1d1d';
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 2;
  // Tail boom and tail rotor.
  ctx.fillRect(-40, -3, 28, 6);
  ctx.strokeRect(-40, -3, 28, 6);
  ctx.fillRect(-44, -9, 6, 18);
  // Body and stub wings with pods.
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#4a1010';
  ctx.fillRect(-6, -19, 8, 38);
  ctx.fillStyle = '#d9d2c5';
  ctx.fillRect(-5, -21, 6, 5);
  ctx.fillRect(-5, 16, 6, 5);
  ctx.fillStyle = '#93c5fd';
  ctx.beginPath();
  ctx.ellipse(11, 0, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // The rotor: a faint disc and two blades turning.
  ctx.fillStyle = 'rgba(220,220,220,0.12)';
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.fill();
  const a = g.t * 30;
  ctx.strokeStyle = 'rgba(30,30,30,0.85)';
  ctx.lineWidth = 3;
  for (const k of [0, Math.PI / 2]) {
    ctx.beginPath();
    ctx.moveTo(Math.cos(a + k) * 36, Math.sin(a + k) * 36);
    ctx.lineTo(-Math.cos(a + k) * 36, -Math.sin(a + k) * 36);
    ctx.stroke();
  }
  ctx.restore();
  hpPips(ctx, th.x, th.y - 52, th.hp, THREATS.attackHeli.hp);
}

/** Where the helicopter is going to hover, while it flies there. */
function drawHeliSpot(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const f = th.foe!;
  const pulse = 0.5 + 0.5 * Math.sin(g.t * 6);
  ctx.strokeStyle = `rgba(252,165,165,${0.45 + 0.35 * pulse})`;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.arc(f.px, f.py, 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(th.x, th.y);
  ctx.lineTo(f.px, f.py);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(252,165,165,0.8)';
  ctx.beginPath();
  ctx.arc(f.px, f.py, 4, 0, Math.PI * 2);
  ctx.fill();
}

/** A periscope cutting the water: the warning before a sub comes up. */
function drawPeriscope(ctx: CanvasRenderingContext2D, g: Game, x: number, y: number, k: number): void {
  for (let r = 0; r < 3; r++) {
    const u = (g.t * 0.9 + r / 3) % 1;
    ctx.strokeStyle = `rgba(220,240,255,${0.5 * (1 - u)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + u * 34, 5 + u * 14, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#1f2933';
  ctx.fillRect(x - 2, y - 14, 4, 14);
  ctx.fillRect(x - 2, y - 14, 8, 4);
  ctx.fillStyle = `rgba(255,77,61,${0.5 + 0.5 * k})`;
  ctx.beginPath();
  ctx.arc(x + 6, y - 12, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

/** The torpedo sub, up: a dark hull with its tower, and a ring that empties
 *  as its time on top runs out. */
function drawTorpedoSub(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const left = 1 - Math.min(1, (th.foe?.t ?? 0) / FOE.torpedoSub.up);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(th.x, th.y, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#7dd3fc';
  ctx.beginPath();
  ctx.arc(th.x, th.y, 40, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.fillStyle = 'rgba(200,230,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 38, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#0b1117';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 32, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.roundRect(-6, -7, 13, 14, 3);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  hpPips(ctx, th.x, th.y - 30, th.hp, THREATS.torpedoSub.hp);
  void g;
}

/** The torpedo's line on the water: dashed to where it meets its ship (an
 *  X there), fainter beyond. */
function drawTorpedoLine(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const f = th.foe;
  if (!f) return;
  const ex = (f.sx ?? th.x) + Math.cos(th.heading) * (f.along ?? 0);
  const ey = (f.sy ?? th.y) + Math.sin(th.heading) * (f.along ?? 0);
  ctx.setLineDash([10, 9]);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(th.x, th.y);
  ctx.lineTo(f.px, f.py);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(f.px, f.py);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);
  const flash = Math.floor(g.t * 6) % 2 === 0;
  ctx.strokeStyle = flash ? 'rgba(255,77,61,0.95)' : 'rgba(255,77,61,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(f.px - 11, f.py - 11);
  ctx.lineTo(f.px + 11, f.py + 11);
  ctx.moveTo(f.px + 11, f.py - 11);
  ctx.lineTo(f.px - 11, f.py + 11);
  ctx.stroke();
}

/** The torpedo: a dark shape just under the surface with a white wake. */
function drawTorpedo(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const back = 60;
  for (let k = 0; k < 6; k++) {
    const u = k / 6;
    ctx.fillStyle = `rgba(235,245,255,${0.45 * (1 - u)})`;
    ctx.beginPath();
    ctx.arc(th.x - Math.cos(th.heading) * (10 + u * back) + Math.sin(g.t * 20 + k) * 2, th.y - Math.sin(th.heading) * (10 + u * back), 4 + u * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.rotate(th.heading);
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** The Armored Drone: a big drone with a steel plate on its nose. While it
 *  banks, a yellow ring on its tail says: now. */
function drawArmored(ctx: CanvasRenderingContext2D, g: Game, th: Threat, heading: number): void {
  const f = th.foe;
  const plate = f?.n ?? 0;
  const banking = (f?.state ?? 0) === 1;
  deltaWing(ctx, th.x, th.y, th.heading, 1.5, '#8a8f6a');
  void heading;
  if (plate > 0) {
    ctx.save();
    ctx.translate(th.x, th.y);
    ctx.rotate(th.heading);
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(8, 0, 26, -1.0, 1.0);
    ctx.stroke();
    ctx.strokeStyle = `rgba(200,215,230,${0.55 + 0.45 * (plate / FOE.armored.plate)})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(8, 0, 26, -1.0, 1.0);
    ctx.stroke();
    ctx.restore();
  }
  if (banking) {
    const tx = th.x - Math.cos(th.heading) * 18;
    const ty = th.y - Math.sin(th.heading) * 18;
    const on = Math.floor(g.t * 8) % 2 === 0;
    ctx.strokeStyle = on ? '#fde047' : 'rgba(253,224,71,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tx, ty, 16, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Plate (blue) above the body's hits (red).
  if (plate > 0) {
    const w = 66;
    const n = FOE.armored.plate;
    const pw = (w - (n - 1) * 2) / n;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(th.x - w / 2 - 3, th.y - 58, w + 6, 13);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i < plate ? '#bcd3ea' : 'rgba(188,211,234,0.18)';
      ctx.fillRect(th.x - w / 2 + i * (pw + 2), th.y - 55, pw, 7);
    }
  }
  hpPips(ctx, th.x, th.y - 42, th.hp, THREATS.armored.hp);
}

/** The Crossing Wing's plan, while its lines close: each line to the X. */
function drawCrossing(ctx: CanvasRenderingContext2D, g: Game, lead: Threat): void {
  const f = lead.foe!;
  const groups = new Map<string, Threat>();
  for (const t of g.threats) if (t.kind === 'crosser' && t.foe?.link === f.link && t.foe.state === 0 && t.foe.n === 0) groups.set(`${t.foe.sx},${t.foe.sy}`, t);
  ctx.strokeStyle = 'rgba(125,211,192,0.4)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  for (const t of groups.values()) {
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(f.px, f.py);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  const pulse = 0.5 + 0.5 * Math.sin(g.t * 7);
  ctx.strokeStyle = `rgba(125,211,192,${0.6 + 0.4 * pulse})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(f.px - 16, f.py - 16);
  ctx.lineTo(f.px + 16, f.py + 16);
  ctx.moveTo(f.px + 16, f.py - 16);
  ctx.lineTo(f.px - 16, f.py + 16);
  ctx.stroke();
}

/** The Scavenger: a drone with a claw, a line to the pickup it wants, and
 *  what it took hanging under it on the way out. */
function drawScavenger(ctx: CanvasRenderingContext2D, g: Game, th: Threat, heading: number): void {
  const f = th.foe;
  const p = f && f.link >= 0 ? g.pickups.find((o) => o.id === f.link) : undefined;
  if (p) {
    ctx.strokeStyle = 'rgba(216,180,254,0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(th.x, th.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(216,180,254,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
    ctx.stroke();
  }
  deltaWing(ctx, th.x, th.y, heading, 1.05, '#c4b5fd');
  // The claw: two hooks under the nose.
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.rotate(heading);
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 3;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(10, s * 3);
    ctx.lineTo(20, s * 8);
    ctx.lineTo(24, s * 3);
    ctx.stroke();
  }
  if (f?.link === -2) {
    ctx.fillStyle = '#facc15';
    ctx.fillRect(14, -6, 12, 12);
  }
  ctx.restore();
}

/** A ring on the water that fills as its time runs out, with a cross in it. */
function drawTargetCircle(ctx: CanvasRenderingContext2D, g: Game, x: number, y: number, r: number, k: number, rgb: string): void {
  const flash = k > 0.7 && Math.floor(g.t * 10) % 2 === 0;
  ctx.fillStyle = `rgba(${rgb},${0.08 + 0.14 * k})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(${rgb},0.35)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = flash ? '#ffffff' : `rgba(${rgb},0.95)`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.min(1, k) * Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `rgba(${rgb},0.8)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.45, y);
  ctx.lineTo(x + r * 0.45, y);
  ctx.moveTo(x, y - r * 0.45);
  ctx.lineTo(x, y + r * 0.45);
  ctx.stroke();
}

/** The Stealth Strafer: a dark, faceted arrowhead; a muzzle flash while its
 *  guns run. */
function drawStealthJet(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const k = 1.25;
  for (const [dx, dy, fill] of [[26, 40, 'rgba(0,0,0,0.28)'], [0, 0, '#2b2f36']] as const) {
    ctx.save();
    ctx.translate(th.x + dx, th.y + dy);
    ctx.rotate(th.heading);
    ctx.scale(k, k * Math.cos(th.bank ?? 0));
    ctx.fillStyle = fill;
    ctx.strokeStyle = dx ? 'transparent' : '#9aa4b2';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(-14, -28);
    ctx.lineTo(-20, -24);
    ctx.lineTo(-12, -8);
    ctx.lineTo(-24, -10);
    ctx.lineTo(-20, 0);
    ctx.lineTo(-24, 10);
    ctx.lineTo(-12, 8);
    ctx.lineTo(-20, 24);
    ctx.lineTo(-14, 28);
    ctx.closePath();
    ctx.fill();
    if (!dx) {
      ctx.stroke();
      // Facet lines.
      ctx.strokeStyle = 'rgba(154,164,178,0.45)';
      ctx.beginPath();
      ctx.moveTo(30, 0);
      ctx.lineTo(-12, 0);
      ctx.moveTo(10, -9);
      ctx.lineTo(-12, -8);
      ctx.moveTo(10, 9);
      ctx.lineTo(-12, 8);
      ctx.stroke();
      if (th.firing && g.steps % 2 === 0) {
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(34, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  hpPips(ctx, th.x, th.y - 46, th.hp, THREATS.stealthJet.hp);
}

/** The Stealth Bomber: a flying wing (the B-2's shape, the player asked),
 *  its trailing edge a sawtooth. */
function drawStealthBomber(ctx: CanvasRenderingContext2D, th: Threat): void {
  const k = 1.15;
  for (const [dx, dy, fill] of [[30, 48, 'rgba(0,0,0,0.28)'], [0, 0, '#30343b']] as const) {
    ctx.save();
    ctx.translate(th.x + dx, th.y + dy);
    ctx.rotate(th.heading);
    ctx.scale(k, k * Math.cos(th.bank ?? 0));
    ctx.fillStyle = fill;
    ctx.strokeStyle = dx ? 'transparent' : '#a3adba';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-18, -56);
    ctx.lineTo(-26, -50);
    ctx.lineTo(-18, -36);
    ctx.lineTo(-28, -24);
    ctx.lineTo(-18, -12);
    ctx.lineTo(-26, 0);
    ctx.lineTo(-18, 12);
    ctx.lineTo(-28, 24);
    ctx.lineTo(-18, 36);
    ctx.lineTo(-26, 50);
    ctx.lineTo(-18, 56);
    ctx.closePath();
    ctx.fill();
    if (!dx) {
      ctx.stroke();
      ctx.fillStyle = '#4b5563';
      ctx.beginPath();
      ctx.ellipse(4, 0, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  hpPips(ctx, th.x, th.y - 60, th.hp, THREATS.stealthBomber.hp);
}

/** The Dive Bomber (Test Lab round 1: "the perspective should match the
 *  rest of the game"): seen from above like every other aircraft, with its
 *  shadow on the water. It comes in from the top of the screen at its
 *  circle and pitches down into its dive (its length foreshortens, its
 *  shadow closes in under it, it grows a touch as it gets low); it lets go
 *  of its red bomb short of the circle, then pulls up (shadow drawing away)
 *  and banks off. */
function drawDiveBomber(ctx: CanvasRenderingContext2D, th: Threat): void {
  const f = th.foe;
  if (!f) return;
  const D = FOE.diveBomber;
  // Height (1 cruising, low at the release) and how far it is nosed down.
  let alt: number;
  let pitch: number;
  let bank = 0;
  if (f.state === 0) {
    const u = Math.min(1, f.t / D.window);
    alt = 1 - 0.8 * u * u;
    pitch = ease(Math.min(1, u * 1.8));
  } else {
    const v = Math.min(1, f.t / 1.2);
    alt = 0.2 + 0.8 * ease(v);
    pitch = 1 - ease(Math.min(1, f.t / 0.45));
    bank = Math.min(1, f.t / 0.5) * 0.55;
  }
  const k = 1.1 + 0.18 * (1 - alt);
  const fore = 1 - 0.42 * pitch;
  // Its shadow on the water, offset like the other aircraft's, closing in
  // as it dives.
  drawStuka(ctx, th.x + 34 * alt, th.y + 52 * alt, th.heading, k * 0.92, fore, 1, 'rgba(0,0,0,0.28)', false, false);
  // Speed streaks behind it in the dive.
  if (pitch > 0.2) {
    ctx.strokeStyle = `rgba(255,255,255,${0.3 * pitch})`;
    ctx.lineWidth = 2;
    for (const s of [-16, 0, 16]) {
      const bx = th.x - Math.cos(th.heading) * 30 * k - Math.sin(th.heading) * s * k;
      const by = th.y - Math.sin(th.heading) * 30 * k + Math.cos(th.heading) * s * k;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - Math.cos(th.heading) * 34, by - Math.sin(th.heading) * 34);
      ctx.stroke();
    }
  }
  drawStuka(ctx, th.x, th.y, th.heading, k, fore, Math.cos(bank), '#7c2d12', true, f.state === 0);
  hpPips(ctx, th.x, th.y - 44 * k, th.hp, THREATS.diveBomber.hp);
}

/** A gull-winged dive bomber from above, nose along `heading`: `fore`
 *  shortens it front to back (nosed down), `span` narrows the wings (a
 *  bank). `full`: the details (canopy, propeller, its red bomb if `bomb`). */
function drawStuka(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, k: number, fore: number, span: number, fill: string, full: boolean, bomb: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.scale(k * fore, k * span);
  ctx.fillStyle = fill;
  ctx.strokeStyle = full ? '#1b1b1b' : 'transparent';
  ctx.lineWidth = 2;
  // Wings: an inverted gull, bent down at the roots.
  ctx.beginPath();
  ctx.moveTo(8, -4);
  ctx.lineTo(4, -16);
  ctx.lineTo(6, -40);
  ctx.lineTo(-4, -42);
  ctx.lineTo(-8, -18);
  ctx.lineTo(-8, 18);
  ctx.lineTo(-4, 42);
  ctx.lineTo(6, 40);
  ctx.lineTo(4, 16);
  ctx.lineTo(8, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Fuselage and tailplane.
  ctx.beginPath();
  ctx.moveTo(26, 0);
  ctx.lineTo(20, -6);
  ctx.lineTo(-22, -4);
  ctx.lineTo(-30, -14);
  ctx.lineTo(-36, -14);
  ctx.lineTo(-34, 0);
  ctx.lineTo(-36, 14);
  ctx.lineTo(-30, 14);
  ctx.lineTo(-22, 4);
  ctx.lineTo(20, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (full) {
    // Fixed landing-gear spats under the wing roots.
    ctx.fillStyle = '#4a1d0c';
    ctx.fillRect(2, -15, 9, 5);
    ctx.fillRect(2, 10, 9, 5);
    // The canopy.
    ctx.fillStyle = '#9fc4d8';
    ctx.beginPath();
    ctx.ellipse(4, 0, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Its bomb under the belly until it lets go.
    if (bomb) {
      ctx.fillStyle = RED_SHOT;
      ctx.beginPath();
      ctx.ellipse(-2, 0, 7, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // The propeller disc.
    ctx.fillStyle = 'rgba(230,230,230,0.35)';
    ctx.beginPath();
    ctx.ellipse(28, 0, 2.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The Siege Battery (Test Lab round 1): a gun that lives in a hatch on the
 *  shore. Up, it stands out of the open hatch with a long barrel and an
 *  orange ring (a target); rising, it climbs out of the dark (its shadow
 *  growing); down, the hatch is shut (drawHatch). */
function drawSiege(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const f = th.foe;
  const S = FOE.siege;
  const next = g.foe.marks.find((m) => m.link === th.id && m.kind === 'shell');
  const aim = next ? Math.atan2(next.y - th.y, next.x - th.x) : Math.PI / 2;
  const rising = f?.state === 0;
  const e = rising ? ease(Math.min(1, (f?.t ?? 0) / S.rise)) : 1;
  // A target from the moment it starts up: the ring fills as it rises.
  ctx.strokeStyle = 'rgba(255,170,60,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(th.x, th.y, 32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,170,60,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(th.x, th.y, 32, -Math.PI / 2, -Math.PI / 2 + e * Math.PI * 2);
  ctx.stroke();
  drawPit(ctx, th.x, th.y, 1);
  drawSiegeGun(ctx, th.x, th.y, aim, e);
  // About to go back down: the ring blinks.
  if (f?.state === 1 && siegeUp() - f.t < 0.6 && Math.floor(g.t * 10) % 2 === 0) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(th.x, th.y, 32, 0, Math.PI * 2);
    ctx.stroke();
  }
  hpPips(ctx, th.x, th.y - 44, th.hp, THREATS.siege.hp);
}

function ease(u: number): number {
  return u * u * (3 - 2 * u);
}

/** A siege battery's emplacement: a ring of sandbags round a dark pit, its
 *  two hatch doors slid `open` (0 shut, 1 open) apart. */
function drawPit(ctx: CanvasRenderingContext2D, x: number, y: number, open: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#6f6449';
  ctx.strokeStyle = '#1b1a14';
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 23, Math.sin(a) * 23, 6, 4.5, a + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#0b0a08';
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  // The doors: two steel halves sliding apart under the rim.
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.clip();
  const slide = open * 18;
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -18 - slide : slide;
    ctx.fillStyle = '#4d4a42';
    ctx.fillRect(x0, -18, 18, 36);
    ctx.strokeStyle = '#26241f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 + 0.75, -17.25, 16.5, 34.5);
    // Hazard stripes on the meeting edge.
    ctx.fillStyle = '#d6a83a';
    const edge = side < 0 ? x0 + 14 : x0;
    for (let k = -18; k < 18; k += 8) ctx.fillRect(edge, k, 4, 4);
  }
  ctx.restore();
}

/** The gun, `e` of the way up out of its pit (0 down, 1 up). */
function drawSiegeGun(ctx: CanvasRenderingContext2D, x: number, y: number, aim: number, e: number): void {
  if (e <= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.65 * e;
  // Its shadow grows out from under it as it rises.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x + 7 * e, y + 10 * e, 11 + 3 * e, 9 + 2 * e, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(x, y);
  ctx.rotate(aim);
  const k = 0.6 + 0.4 * e;
  ctx.scale(k, k);
  ctx.fillStyle = '#3f3a33';
  ctx.strokeStyle = '#1b1a14';
  ctx.lineWidth = 2;
  const len = 14 + 28 * e;
  ctx.fillRect(-4, -5, len, 10);
  ctx.strokeRect(-4, -5, len, 10);
  ctx.fillStyle = '#2a2622';
  ctx.fillRect(len - 6, -6, 6, 12);
  ctx.fillStyle = '#5b5446';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7a705c';
  ctx.beginPath();
  ctx.arc(-3, -3, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A siege battery's hatch (the gun out of reach): the gun sinking into it
 *  and the doors closing, then shut with a faint marker (and its hits so
 *  far, faint), then the doors opening as it is about to come up. */
function drawHatch(ctx: CanvasRenderingContext2D, g: Game, m: FoeMark): void {
  const S = FOE.siege;
  const close = 0.3;
  let open = 0;
  let gun = 0;
  if (m.lowered && m.t < S.lower) {
    open = 1;
    gun = 1 - ease(m.t / S.lower);
  } else if (m.lowered && m.t < S.lower + close) open = 1 - (m.t - S.lower) / close;
  const coming = !!(m.gun || m.spawn);
  const left = m.dur - m.t;
  if (coming && left < S.open) open = Math.max(open, 1 - left / S.open);
  // Packed up for good: it fades once its doors are shut.
  const fade = coming ? 1 : Math.max(0, Math.min(1, left / 0.3));
  ctx.save();
  ctx.globalAlpha = fade;
  if (open === 0 && gun === 0) {
    // Shut: a faint dashed ring says something is under there.
    ctx.strokeStyle = 'rgba(255,170,60,0.28)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.arc(m.x, m.y, 32, g.t * 0.6, g.t * 0.6 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (coming && left < S.open) {
    // About to rise: the ring brightens.
    const k = 1 - left / S.open;
    ctx.strokeStyle = `rgba(255,170,60,${0.3 + 0.6 * k})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 32, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawPit(ctx, m.x, m.y, open);
  if (gun > 0) drawSiegeGun(ctx, m.x, m.y, Math.PI / 2, gun);
  ctx.restore();
  if (m.gun && fade > 0) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    hpPips(ctx, m.x, m.y - 44, m.gun.hp, THREATS.siege.hp);
    ctx.restore();
  }
}

/** The Spotter: a pale recon plane with long straight wings. */
function drawSpotter(ctx: CanvasRenderingContext2D, th: Threat): void {
  ctx.save();
  ctx.translate(th.x + 22, th.y + 34);
  ctx.rotate(th.heading);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(-20, -4, 40, 8);
  ctx.fillRect(-2, -38, 10, 76);
  ctx.restore();
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.rotate(th.heading);
  ctx.fillStyle = '#cbd5e1';
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-24, -4, 48, 8, 4);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-2, -40, 10, 80, 3);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-24, -12, 6, 24, 2);
  ctx.fill();
  ctx.stroke();
  // The camera pod.
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(16, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  hpPips(ctx, th.x, th.y - 50, th.hp, THREATS.spotter.hp);
}

/** The spotter's beam on its ship, and the bracket round it. */
function drawPaint(ctx: CanvasRenderingContext2D, g: Game, sp: Threat, ship: { x: number; y: number }): void {
  const on = Math.floor(g.t * 6) % 2 === 0;
  ctx.strokeStyle = on ? 'rgba(255,77,61,0.85)' : 'rgba(255,77,61,0.5)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([12, 6]);
  ctx.beginPath();
  ctx.moveTo(sp.x, sp.y);
  ctx.lineTo(ship.x, ship.y);
  ctx.stroke();
  ctx.setLineDash([]);
  const r = 36;
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ff4d3d';
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.beginPath();
    ctx.moveTo(ship.x + sx * r, ship.y + sy * (r - 12));
    ctx.lineTo(ship.x + sx * r, ship.y + sy * r);
    ctx.lineTo(ship.x + sx * (r - 12), ship.y + sy * r);
    ctx.stroke();
  }
}

/** The Repair Tender: a small grey ship with a green cross on deck. */
function drawTender(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.fillStyle = 'rgba(200,230,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(-30, 0, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b7280';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(32, 0);
  ctx.lineTo(18, -11);
  ctx.lineTo(-28, -11);
  ctx.lineTo(-28, 11);
  ctx.lineTo(18, 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(-12, -3, 18, 6);
  ctx.fillRect(-6, -9, 6, 18);
  ctx.restore();
  hpPips(ctx, th.x, th.y - 32, th.hp, THREATS.tender.hp);
  void g;
}

/** The Flak Picket: a small grey warship with a gun fore and aft. */
function drawPicket(ctx: CanvasRenderingContext2D, th: Threat): void {
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.fillStyle = '#52525b';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(34, 0);
  ctx.lineTo(20, -10);
  ctx.lineTo(-30, -10);
  ctx.lineTo(-34, 0);
  ctx.lineTo(-30, 10);
  ctx.lineTo(20, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#27272a';
  for (const x of [-18, 14]) {
    ctx.beginPath();
    ctx.arc(x, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x, -1.5, 12, 3);
  }
  ctx.restore();
  hpPips(ctx, th.x, th.y - 30, th.hp, THREATS.picket.hp);
}

/** The picket's ring, faint, and brighter as it is ready to fire again. */
function drawPicketRing(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const R = FOE.picket.ring;
  const ready = (th.foe?.t ?? 0) >= FOE.picket.every;
  ctx.fillStyle = 'rgba(244,114,182,0.06)';
  ctx.beginPath();
  ctx.arc(th.x, th.y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ready ? 'rgba(244,114,182,0.6)' : 'rgba(244,114,182,0.3)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.arc(th.x, th.y, R, g.t * 0.3, g.t * 0.3 + Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** The Lure Beacon: a red buoy with a light that flashes, and rings. */
function drawLure(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const on = Math.floor(g.t * 5) % 2 === 0;
  for (let r = 0; r < 2; r++) {
    const u = (g.t * 0.8 + r / 2) % 1;
    ctx.strokeStyle = `rgba(253,224,71,${0.5 * (1 - u)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(th.x, th.y, 14 + u * 60, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#dc2626';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(th.x, th.y + 4, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(th.x - 3, th.y - 16, 6, 18);
  ctx.fillStyle = on ? '#fef08a' : '#78716c';
  ctx.beginPath();
  ctx.arc(th.x, th.y - 18, 6, 0, Math.PI * 2);
  ctx.fill();
  if (on) {
    ctx.fillStyle = 'rgba(254,240,138,0.3)';
    ctx.beginPath();
    ctx.arc(th.x, th.y - 18, 16, 0, Math.PI * 2);
    ctx.fill();
  }
  hpPips(ctx, th.x, th.y - 42, th.hp, THREATS.lure.hp);
}

/** The Supply Barge: a flat hull stacked with crates. */
function drawBarge(ctx: CanvasRenderingContext2D, th: Threat): void {
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.fillStyle = '#57534e';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-46, -16, 92, 32, 6);
  ctx.fill();
  ctx.stroke();
  const crate = ['#b45309', '#a16207', '#92400e'];
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = crate[i % 3];
    ctx.fillRect(-38 + (i % 3) * 26, -12 + Math.floor(i / 3) * 13, 22, 11);
    ctx.strokeRect(-38 + (i % 3) * 26, -12 + Math.floor(i / 3) * 13, 22, 11);
  }
  ctx.restore();
  hpPips(ctx, th.x, th.y - 32, th.hp, THREATS.barge.hp);
}

/** While a barge floats, every live launch site wears a +1. */
function drawBargeTags(ctx: CanvasRenderingContext2D, g: Game): void {
  ctx.font = '900 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  g.map.bases.forEach((b, i) => {
    if (!b.kinds.length || b.cove || b.chute || b.generator || g.baseDown[i]) return;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(b.x + 18, b.y - 46, 34, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('+1', b.x + 35, b.y - 27);
  });
}

/** The Volatile Cloud: a yellow-green gas, churning. Over ships, its edge
 *  flashes red: don't fire into it. */
function drawCloud(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const R = FOE.cloud.radius;
  const over = g.ships.some((s) => Math.hypot(s.x - th.x, s.y - th.y) <= R);
  const fade = Math.min(1, (FOE.cloud.life - (th.foe?.t ?? 0)) / 3);
  ctx.save();
  ctx.globalAlpha = Math.max(0.2, fade);
  for (let k = 0; k < 7; k++) {
    const a = k * 0.9 + g.t * 0.3 + th.id;
    const r = R * (0.45 + 0.15 * Math.sin(g.t * 0.7 + k));
    ctx.fillStyle = 'rgba(190,220,90,0.16)';
    ctx.beginPath();
    ctx.arc(th.x + Math.cos(a) * R * 0.4, th.y + Math.sin(a) * R * 0.4, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const flash = over && Math.floor(g.t * 4) % 2 === 0;
  ctx.strokeStyle = flash ? 'rgba(255,77,61,0.9)' : 'rgba(190,220,90,0.55)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(th.x, th.y, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
