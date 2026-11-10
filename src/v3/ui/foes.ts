// The enemy build: how the new enemies look (docs/design/v3-enemy-build.md).
// Each one is drawn so its tell reads on a phone: the booster flare, the
// decoys' cooler tint, the forked tail, the launcher's slow raise.

import { THREATS } from '../data/config';
import { FOE } from '../data/foes';
import { CARRIER_TARGET, type Game, type Threat } from '../sim/game';
import type { Point } from '../data/maps';
import { shellAt, siegeUp, type FoeMark } from '../sim/foes';
import { C, deltaWing, hpPips, missile } from './render';

/** Draw a new enemy; false if `th` isn't one of them. */
export function drawFoe(ctx: CanvasRenderingContext2D, g: Game, th: Threat): boolean {
  const heading = Math.atan2(th.vy, th.vx) || th.heading;
  switch (th.kind) {
    case 'sprinter':
      drawSprinter(ctx, g, th, heading);
      return true;
    case 'decoy':
      drawDecoy(ctx, th, heading);
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
    case 'lure':
      drawLure(ctx, g, th);
      return true;
    case 'cloud':
      drawCloud(ctx, g, th, heading);
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

/** Under everything that flies: the trucks' targets, the periscopes, the
 *  torpedo lines. */
export function drawFoeGround(ctx: CanvasRenderingContext2D, g: Game): void {
  for (const m of g.foe.marks) if (m.kind === 'periscope') drawPeriscope(ctx, g, m.x, m.y, m.t / m.dur);
  for (const th of g.threats) if (th.kind === 'torpedo' && !th.dead) drawTorpedoLine(ctx, g, th);
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
  // A Bodyguard Ring's orbit; a Repair Ship's beam as it charges.
  for (const th of g.threats) {
    if (th.dead) continue;
    if (th.kind === 'heavy' && g.threats.some((t) => t.kind === 'guard' && !t.dead && t.foe?.link === th.id)) {
      ctx.strokeStyle = 'rgba(253,230,138,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(th.x, th.y, FOE.bodyguard.orbit, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (th.kind === 'lure') drawLureRing(ctx, g, th);
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
 *  dive bomber's bomb, a siege battery's shells in flight; and an Incendiary
 *  Missile's fireball, drawn over the ships it covers. */
export function drawFoeShots(ctx: CanvasRenderingContext2D, g: Game): void {
  // An Incendiary Missile's fireball burns on the water, over any ship in it.
  for (const m of g.foe.marks) if (m.kind === 'fire') drawFire(ctx, g, m);
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

/** A decoy's body (round 7: "give just a faint color difference
 *  everywhere, instead of the flash on, flash off"): the attack drone's
 *  warm cream (C.drone, #e4dccb) turned a shade cooler, a pale grey with a
 *  hint of blue: the same lightness, its warmth gone (saturation 32% → 10%;
 *  CIE76 ΔE about 11).
 *  Side by side it reads; at a glance in a swarm it is easy to miss. */
export const DECOY_TINT = '#d4dcdc';

/** A decoy: the attack drone's shape, flight and shadow, in DECOY_TINT, the
 *  whole way in. No strobe, ring or trail. */
function drawDecoy(ctx: CanvasRenderingContext2D, th: Threat, heading: number): void {
  deltaWing(ctx, th.x, th.y, heading, 1, DECOY_TINT);
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
  hpPips(ctx, th.x, th.y - 40, th.hp, th.maxHp ?? THREATS.rocketTruck.hp);
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
  hpPips(ctx, th.x, th.y - 52, th.hp, th.maxHp ?? THREATS.attackHeli.hp);
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
  const left = 1 - Math.min(1, (th.foe?.t ?? 0) / (th.foe?.up ?? FOE.torpedoSub.up));
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
  hpPips(ctx, th.x, th.y - 30, th.hp, th.maxHp ?? THREATS.torpedoSub.hp);
  void g;
}

/** The torpedo's line on the water: dashed to where it meets its ship (an
 *  X there), fainter beyond. A fast one (Test Lab round 6's Wolf Pack, and
 *  any sub's from round 7): an amber line in short, quick dashes that run
 *  along it. */
function drawTorpedoLine(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const f = th.foe;
  if (!f) return;
  const fast = !!f.fast;
  const ex = (f.sx ?? th.x) + Math.cos(th.heading) * (f.along ?? 0);
  const ey = (f.sy ?? th.y) + Math.sin(th.heading) * (f.along ?? 0);
  ctx.setLineDash(fast ? [5, 5] : [10, 9]);
  if (fast) ctx.lineDashOffset = -((g.t * 60) % 10);
  ctx.strokeStyle = fast ? 'rgba(255,184,64,0.9)' : 'rgba(255,255,255,0.55)';
  ctx.lineWidth = fast ? 3 : 2;
  ctx.beginPath();
  ctx.moveTo(th.x, th.y);
  ctx.lineTo(f.px, f.py);
  ctx.stroke();
  ctx.strokeStyle = fast ? 'rgba(255,184,64,0.3)' : 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(f.px, f.py);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
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

/** The torpedo: a dark shape just under the surface with a white wake (a
 *  fast one: a longer wake, amber). */
function drawTorpedo(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const fast = !!th.foe?.fast;
  const back = fast ? 110 : 60;
  for (let k = 0; k < 6; k++) {
    const u = k / 6;
    ctx.fillStyle = fast ? `rgba(255,196,96,${0.55 * (1 - u)})` : `rgba(235,245,255,${0.45 * (1 - u)})`;
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

/** The Armored Drone: a big drone with a curved shield on its nose (steel
 *  segments, one per hit it has left, in a cyan field) that flares and
 *  throws sparks when it turns a shot away. The shield covers exactly the arc
 *  the sim checks, so as it banks you see the shield swing off the carrier;
 *  while it banks, its open flank glows yellow and a ring on its tail says:
 *  now. */
function drawArmored(ctx: CanvasRenderingContext2D, g: Game, th: Threat, heading: number): void {
  void heading;
  const f = th.foe;
  const plate = f?.n ?? 0;
  const banking = (f?.state ?? 0) === 1;
  // The arc absorbs() checks: FOE.armored.front degrees either side of the
  // nose (its sim heading, not its velocity).
  const span = (FOE.armored.front * Math.PI) / 180;
  const R = 33;
  // A shot just turned away: absorbs() leaves a 20 px 'block' on its nose
  // (it flies on 20 px or so while that lasts).
  const nx = th.x + Math.cos(th.heading) * 16;
  const ny = th.y + Math.sin(th.heading) * 16;
  const hit = g.fx.find((o) => o.kind === 'block' && o.r === 20 && o.age < o.life && Math.hypot(o.x - nx, o.y - ny) < 34);
  const flare = hit ? 1 - hit.age / hit.life : 0;
  if (banking) {
    // The open flank and tail while it banks: the window.
    const on = Math.floor(g.t * 8) % 2 === 0;
    ctx.fillStyle = on ? 'rgba(253,224,71,0.2)' : 'rgba(253,224,71,0.1)';
    ctx.beginPath();
    ctx.moveTo(th.x, th.y);
    ctx.arc(th.x, th.y, 44, th.heading + span, th.heading + Math.PI * 2 - span);
    ctx.closePath();
    ctx.fill();
    const tx = th.x - Math.cos(th.heading) * 18;
    const ty = th.y - Math.sin(th.heading) * 18;
    ctx.strokeStyle = on ? '#fde047' : 'rgba(253,224,71,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tx, ty, 16, 0, Math.PI * 2);
    ctx.stroke();
  }
  deltaWing(ctx, th.x, th.y, th.heading, 1.5, '#8a8f6a');
  if (plate > 0) {
    ctx.save();
    ctx.translate(th.x, th.y);
    ctx.rotate(th.heading);
    const hum = 0.5 + 0.5 * Math.sin(g.t * 5 + th.id);
    // The field in front of the plate: a soft cyan fan, so which way it
    // faces reads at a glance, even edge-on.
    const outer = R + 16 + flare * 14;
    const fan = ctx.createRadialGradient(0, 0, R - 2, 0, 0, outer);
    fan.addColorStop(0, `rgba(125,211,252,${0.3 + 0.5 * flare})`);
    fan.addColorStop(1, 'rgba(125,211,252,0)');
    ctx.fillStyle = fan;
    ctx.beginPath();
    ctx.arc(0, 0, outer, -span, span);
    ctx.arc(0, 0, R - 2, span, -span, true);
    ctx.closePath();
    ctx.fill();
    // The plate: a dark backing, then one steel segment per hit left; a
    // spent one is a dim gap. The middle holds longest.
    const n = FOE.armored.plate;
    const gap = 0.07;
    const seg = (span * 2 - gap * (n - 1)) / n;
    const lose = Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(b - (n - 1) / 2) - Math.abs(a - (n - 1) / 2) || a - b);
    const spent = new Set(lose.slice(0, n - plate));
    ctx.strokeStyle = 'rgba(15,20,26,0.9)';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.arc(0, 0, R, -span, span);
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const a0 = -span + i * (seg + gap);
      const live = !spent.has(i);
      ctx.strokeStyle = !live ? 'rgba(120,135,150,0.3)' : flare > 0 ? `rgb(${Math.round(190 + 65 * flare)},${Math.round(212 + 43 * flare)},255)` : '#b8c7d6';
      ctx.lineWidth = live ? 7 : 3;
      ctx.beginPath();
      ctx.arc(0, 0, R, a0, a0 + seg);
      ctx.stroke();
      if (!live) continue;
      // A bright outer edge: metal catching the light.
      ctx.strokeStyle = 'rgba(240,248,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, R + 3, a0 + 0.04, a0 + seg - 0.04);
      ctx.stroke();
    }
    // The energy rim ahead of it, humming; fainter as the plate wears.
    ctx.strokeStyle = `rgba(125,211,252,${0.3 + 0.4 * (plate / n) * hum + 0.3 * flare})`;
    ctx.lineWidth = 2 + 3 * flare;
    ctx.beginPath();
    ctx.arc(0, 0, R + 8 + flare * 4, -span * 0.95, span * 0.95);
    ctx.stroke();
    if (flare > 0) {
      // The deflection: a white flash on the plate, sparks thrown off it.
      ctx.fillStyle = `rgba(255,255,255,${0.8 * flare})`;
      ctx.beginPath();
      ctx.arc(R, 0, 5 + 9 * (1 - flare), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,244,200,${flare})`;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      const out = 12 + 26 * (1 - flare);
      for (let s = 0; s < 6; s++) {
        const a = (s - 2.5) * 0.4 + Math.sin(th.id * 3.1 + s) * 0.12;
        const x0 = Math.cos(a) * (R + 4);
        const y0 = Math.sin(a) * (R + 4);
        ctx.beginPath();
        ctx.moveTo(x0 + Math.cos(a) * (out - 10), y0 + Math.sin(a) * (out - 10));
        ctx.lineTo(x0 + Math.cos(a) * out, y0 + Math.sin(a) * out);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
    ctx.restore();
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
  hpPips(ctx, th.x, th.y - 42, th.hp, th.maxHp ?? THREATS.armored.hp);
}

/** The Scavenger: a quadcopter, not a winged drone like the others (the
 *  player: "look different than the other drones"): an amber body, four
 *  spinning rotors and a grabber claw that opens as it closes on a pickup,
 *  a line to the pickup it wants, and what it took hanging in its claw on
 *  the way out. */
function drawScavenger(ctx: CanvasRenderingContext2D, g: Game, th: Threat, heading: number): void {
  const f = th.foe;
  const p = f && f.link >= 0 ? g.pickups.find((o) => o.id === f.link) : undefined;
  if (p) {
    ctx.strokeStyle = 'rgba(251,191,36,0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(th.x, th.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(251,191,36,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (f && f.link === -1 && f.state === 0 && f.sx !== undefined && f.sy !== undefined) {
    // Lurking: a faint amber ring where it circles, waiting.
    ctx.strokeStyle = 'rgba(251,191,36,0.22)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 9]);
    ctx.beginPath();
    ctx.arc(f.sx, f.sy, FOE.scavenger.orbit, g.t * 0.4, g.t * 0.4 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const near = p ? Math.hypot(p.x - th.x, p.y - th.y) : Infinity;
  const open = f?.link === -2 ? 0.15 : near < 120 ? 1 : 0.45 + 0.15 * Math.sin(g.t * 3 + th.id);
  ctx.save();
  // Its shadow on the water, offset as the other aircraft's.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(th.x + 8, th.y + 13, 20, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(th.x, th.y);
  ctx.rotate(heading);
  ctx.scale(1.25, 1.25);
  // The X frame and four rotors, blurring as they spin.
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-14, -14);
  ctx.lineTo(14, 14);
  ctx.moveTo(-14, 14);
  ctx.lineTo(14, -14);
  ctx.stroke();
  for (const [rx, ry] of [[14, 14], [14, -14], [-14, 14], [-14, -14]]) {
    ctx.fillStyle = 'rgba(253,230,138,0.38)';
    ctx.strokeStyle = 'rgba(245,158,11,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(rx, ry, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const a = g.t * 22 + rx * 0.3 + ry;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx - Math.cos(a) * 9, ry - Math.sin(a) * 9);
    ctx.lineTo(rx + Math.cos(a) * 9, ry + Math.sin(a) * 9);
    ctx.stroke();
  }
  // The body: an amber hull with a dark sensor eye.
  ctx.fillStyle = '#f59e0b';
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-9, -8, 18, 16, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#7f1d1d';
  ctx.beginPath();
  ctx.arc(5, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  // The claw: three prongs off the nose, opening as it nears its prize.
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const s of [-1, 0, 1]) {
    const a = s * (0.25 + 0.55 * open);
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(9 + Math.cos(a) * 11, Math.sin(a) * 11);
    ctx.lineTo(9 + Math.cos(a) * 11 + Math.cos(a - s * 0.9) * 7, Math.sin(a) * 11 + Math.sin(a - s * 0.9) * 7);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  if (f?.link === -2) {
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 1.5;
    ctx.fillRect(16, -6, 12, 12);
    ctx.strokeRect(16, -6, 12, 12);
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
  hpPips(ctx, th.x, th.y - 46, th.hp, th.maxHp ?? THREATS.stealthJet.hp);
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
  hpPips(ctx, th.x, th.y - 60, th.hp, th.maxHp ?? THREATS.stealthBomber.hp);
}

/** The Dive Bomber (Test Lab round 1: "the perspective should match the
 *  rest of the game"; round 2: an A-10 Warthog): seen from above like every
 *  other aircraft, with its shadow on the water. It flies in level from off
 *  the screen (round 4) at its circle and pitches down into its dive (its
 *  length foreshortens, its shadow closes in under it, it grows a touch as
 *  it gets low); it lets go
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
    // Level from off the screen (round 4), then the dive.
    const u = Math.max(0, Math.min(1, (f.t - (f.dive?.app ?? 0)) / D.window));
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
  drawWarthog(ctx, th.x + 34 * alt, th.y + 52 * alt, th.heading, k * 0.92, fore, Math.cos(bank), 'rgba(0,0,0,0.28)', false, false);
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
  drawWarthog(ctx, th.x, th.y, th.heading, k, fore, Math.cos(bank), '#8e979f', true, f.state === 0);
  hpPips(ctx, th.x, th.y - 44 * k, th.hp, th.maxHp ?? THREATS.diveBomber.hp);
}

/** An A-10 Warthog from above (Test Lab round 2: "make it faster and an
 *  A-10 Warthog"), nose along `heading`: long, straight wings; a slim
 *  fuselage with the gun's muzzle at the nose; two engine pods high on the
 *  rear fuselage; a straight tailplane with a fin at each end; grey camo.
 *  `fore` shortens it front to back (nosed down), `span` narrows the wings
 *  (a bank). `full`: the details (camo, canopy, engines, its red bomb if
 *  `bomb`); without, a flat silhouette (the shadow). */
function drawWarthog(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, k: number, fore: number, span: number, fill: string, full: boolean, bomb: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.scale(k * fore, k * span);
  ctx.fillStyle = fill;
  ctx.strokeStyle = full ? '#1b1f24' : 'transparent';
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  // Each outline wound the same way round, so the shadow (all of them in
  // one path, filled once) has no darker overlaps.
  const sub = (pts: number[]) => {
    let area = 0;
    for (let i = 0; i < pts.length; i += 2) area += pts[i] * pts[(i + 3) % pts.length] - pts[(i + 2) % pts.length] * pts[i + 1];
    const n = pts.length / 2;
    const at = (j: number) => (area >= 0 ? j : n - 1 - j) * 2;
    ctx.moveTo(pts[at(0)], pts[at(0) + 1]);
    for (let j = 1; j < n; j++) ctx.lineTo(pts[at(j)], pts[at(j) + 1]);
    ctx.closePath();
  };
  const poly = (pts: number[]) => {
    ctx.beginPath();
    sub(pts);
  };
  // Wings: straight and long, a little tapered, the tips turned down.
  const wing = [8, -4, 7, -40, 4, -46, -3, -46, -6, -40, -9, -4, -9, 4, -6, 40, -3, 46, 4, 46, 7, 40, 8, 4];
  // Tailplane: straight, right at the back.
  const tail = [-29, -19, -29, 19, -36, 19, -36, -19];
  // Fuselage: long and slim, a blunt nose.
  const body = [36, -2.5, 33, -4.5, 22, -5.5, 4, -5, -24, -3.5, -38, -2.5, -38, 2.5, -24, 3.5, 4, 5, 22, 5.5, 33, 4.5, 36, 2.5];
  const fin = (s: number) => [-24, s * 17, -26, s * 21, -41, s * 21, -41, s * 17];
  if (!full) {
    ctx.beginPath();
    for (const pts of [wing, tail, body, fin(-1), fin(1)]) sub(pts);
    for (const s of [-1, 1]) {
      ctx.moveTo(-9.5, s * 9);
      ctx.ellipse(-19, s * 9, 9.5, 4.6, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
    return;
  }
  poly(wing);
  ctx.fill();
  ctx.stroke();
  poly(tail);
  ctx.fill();
  ctx.stroke();
  // Its red bomb slung under the belly until it lets go: it shows either
  // side of the slim fuselage.
  if (bomb) {
    ctx.fillStyle = RED_SHOT;
    ctx.beginPath();
    ctx.ellipse(-1, 0, 10, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fill;
  }
  poly(body);
  ctx.fill();
  ctx.stroke();
  // Grey camo: darker patches over the lighter grey.
  ctx.save();
  poly(wing);
  ctx.clip();
  ctx.fillStyle = '#5d6670';
  for (const s of [-1, 1]) {
    for (const [cx, cy, rx, ry, a] of [[2, 15, 7, 4.5, 0.6], [-4, 27, 6, 5, -0.4], [3, 39, 5, 4, 0.3]]) {
      ctx.beginPath();
      ctx.ellipse(cx, s * cy, rx, ry, s * a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.save();
  poly(body);
  ctx.clip();
  ctx.fillStyle = '#5d6670';
  for (const [cx, cy, rx, ry] of [[14, 2, 6, 3.5], [-9, -2, 7, 3.5], [-30, 1, 5, 3]]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Two engine pods high on the rear fuselage, between the wing and the
  // tail: a dark intake at the front, a hot exhaust at the back.
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#7f8892';
    ctx.beginPath();
    ctx.ellipse(-19, s * 9, 9.5, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2a2f36';
    ctx.beginPath();
    ctx.ellipse(-10, s * 9, 1.6, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,170,90,0.75)';
    ctx.beginPath();
    ctx.ellipse(-28.5, s * 9, 1.4, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Twin fins, one at each end of the tailplane (edge on from above).
  ctx.fillStyle = '#4b535c';
  for (const s of [-1, 1]) {
    poly(fin(s));
    ctx.fill();
    ctx.stroke();
  }
  // The canopy, well forward, and the gun's muzzle at the nose.
  ctx.fillStyle = '#a9c9dc';
  ctx.beginPath();
  ctx.ellipse(24, 0, 5.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1b1f24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(35, 0);
  ctx.lineTo(40, 0);
  ctx.stroke();
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
  hpPips(ctx, th.x, th.y - 44, th.hp, th.maxHp ?? THREATS.siege.hp);
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
  hpPips(ctx, th.x, th.y - 50, th.hp, th.maxHp ?? THREATS.spotter.hp);
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

/** The Repair Ship (Test Lab round 4: "can we not call it repair tender
 *  and just like repair ship?"; its id is still `tender`): a small grey
 *  ship with a green cross on deck, bow along its course, a wake behind it
 *  while it sails in. */
function drawTender(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const sp = Math.hypot(th.vx, th.vy);
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.rotate(th.heading);
  if (sp > 5) {
    // A V of white wake off the stern, longer the faster it goes.
    const k = Math.min(1, sp / THREATS.tender.speed);
    ctx.strokeStyle = `rgba(220,240,255,${0.25 + 0.3 * k})`;
    ctx.lineWidth = 3;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-26, s * 9);
      ctx.lineTo(-26 - 50 * k, s * (16 + 14 * k));
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(220,240,255,${0.2 + 0.2 * k})`;
    ctx.beginPath();
    ctx.ellipse(-34 - 10 * k, 0, 14 + 12 * k, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bow wave.
    ctx.strokeStyle = `rgba(220,240,255,${0.3 * k})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(30, 0, 9, -1.1, 1.1);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(200,230,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(-30, 0, 18, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
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
  hpPips(ctx, th.x, th.y - 32, th.hp, th.maxHp ?? THREATS.tender.hp);
  void g;
}

/** The Lure Beacon: a red buoy that rises out of the water (ripples and
 *  spray, its light dark until it's up), then flashes. */
function drawLure(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const f = th.foe;
  const rising = f?.state === 0;
  const k = rising ? Math.min(1, (f?.t ?? 0) / FOE.lure.rise) : 1;
  const ease = 1 - (1 - k) ** 3;
  // Ripples off the hull: fast while it breaks the surface.
  for (let r = 0; r < 3; r++) {
    const u = (g.t * (rising ? 1.6 : 0.6) + r / 3) % 1;
    ctx.strokeStyle = `rgba(200,235,255,${(rising ? 0.55 : 0.25) * (1 - u)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(th.x, th.y + 6, 14 + u * 34, (14 + u * 34) * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const lift = (1 - ease) * 26;
  ctx.save();
  // Half again the old buoy's size, so it reads at a glance.
  ctx.translate(th.x, th.y);
  ctx.scale(1.5, 1.5);
  ctx.translate(-th.x, -th.y);
  // Below the waterline (y + 8) nothing shows: it comes up through it.
  ctx.beginPath();
  ctx.rect(th.x - 40, th.y - 80, 80, 88);
  ctx.clip();
  ctx.translate(0, lift);
  ctx.fillStyle = '#dc2626';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(th.x, th.y + 4, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f5f5f4';
  ctx.fillRect(th.x - 12, th.y + 1, 24, 3);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(th.x - 3, th.y - 16, 6, 18);
  ctx.strokeRect(th.x - 3, th.y - 16, 6, 18);
  const on = !rising && Math.floor(g.t * 5) % 2 === 0;
  ctx.fillStyle = on ? '#fef08a' : '#78716c';
  ctx.beginPath();
  ctx.arc(th.x, th.y - 18, 6, 0, Math.PI * 2);
  ctx.fill();
  if (on) {
    ctx.fillStyle = 'rgba(254,240,138,0.35)';
    ctx.beginPath();
    ctx.arc(th.x, th.y - 18, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (rising) {
    // Water streaming off it as it breaks the surface.
    ctx.fillStyle = `rgba(220,240,255,${0.6 * (1 - k)})`;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.45;
      const d = 14 + 36 * k;
      ctx.beginPath();
      ctx.arc(th.x + Math.cos(a) * d, th.y + 4 + Math.sin(a) * d * 0.8, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  hpPips(ctx, th.x, th.y - 52, th.hp, th.maxHp ?? THREATS.lure.hp);
}

/** The Lure's ring on the water, once it's up: everything a helper aims
 *  at inside it, or any helper inside it, goes for the buoy instead. A
 *  pulse sweeps out to the edge, and a yellow tether runs from it to each
 *  helper drone it has drawn. */
function drawLureRing(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const f = th.foe;
  const R = FOE.lure.radius;
  const k = f?.state === 0 ? Math.min(1, (f.t ?? 0) / FOE.lure.rise) : 1;
  const r = R * (f?.state === 0 ? k * k : 1);
  ctx.fillStyle = `rgba(253,224,71,${0.06 * k})`;
  ctx.beginPath();
  ctx.arc(th.x, th.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(253,224,71,${0.55 * k})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.arc(th.x, th.y, r, -g.t * 0.25, -g.t * 0.25 + Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  if (f?.state === 0) return;
  for (let i = 0; i < 2; i++) {
    const u = (g.t * 0.7 + i / 2) % 1;
    ctx.strokeStyle = `rgba(253,224,71,${0.4 * (1 - u)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(th.x, th.y, 16 + u * (R - 16), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(253,224,71,0.45)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 6]);
  for (const w of g.wings) {
    if (w.target !== th.id) continue;
    ctx.beginPath();
    ctx.moveTo(w.x, w.y);
    ctx.lineTo(th.x, th.y);
    ctx.stroke();
  }
  for (const h of g.hellfires) {
    if (h.target !== th.id) continue;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(th.x, th.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

/** The Incendiary Missile (FoeId `cloud`): a slow, chunky firebomb, dark
 *  red with orange hazard bands and a flame mark, trailing black smoke and
 *  sparks, with a faint line to the ship it's after. */
function drawCloud(ctx: CanvasRenderingContext2D, g: Game, th: Threat, heading: number): void {
  const target = th.target === CARRIER_TARGET ? g.map.carrier : g.ships.find((s) => s.id === th.target);
  if (target) {
    ctx.strokeStyle = 'rgba(255,140,40,0.28)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(th.x, th.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // A thick smoke trail with sparks in it.
  for (let i = 1; i <= 6; i++) {
    const d = 30 + i * 11;
    const wob = Math.sin(g.t * 4 + i) * 2.5;
    const x = th.x - Math.cos(heading) * d - Math.sin(heading) * wob;
    const y = th.y - Math.sin(heading) * d + Math.cos(heading) * wob;
    ctx.fillStyle = `rgba(60,50,45,${0.34 - i * 0.045})`;
    ctx.beginPath();
    ctx.arc(x, y, 4 + i * 1.4, 0, Math.PI * 2);
    ctx.fill();
    if (i % 2) {
      ctx.fillStyle = `rgba(255,180,60,${0.7 - i * 0.1})`;
      ctx.beginPath();
      ctx.arc(x + Math.sin(g.t * 9 + i) * 4, y + Math.cos(g.t * 7 + i) * 4, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // A hot glow round it, pulsing.
  ctx.fillStyle = `rgba(255,110,30,${0.16 + 0.08 * Math.sin(g.t * 5)})`;
  ctx.beginPath();
  ctx.arc(th.x, th.y, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.rotate(heading);
  // Chunky: a third bigger than a guided missile's body.
  ctx.scale(1.35, 1.35);
  // Flame.
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.moveTo(-22, -5);
  ctx.lineTo(-30 - Math.random() * 5, 0);
  ctx.lineTo(-22, 5);
  ctx.fill();
  // Fins.
  ctx.fillStyle = '#3b1d14';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-12, s * 7);
    ctx.lineTo(-24, s * 15);
    ctx.lineTo(-22, s * 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // The body: a fat canister, dark red.
  ctx.fillStyle = '#9a2a14';
  ctx.beginPath();
  ctx.roundRect(-22, -9, 40, 18, 5);
  ctx.fill();
  // Hazard bands at the tail: black on orange.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-22, -9, 10, 18);
  ctx.clip();
  ctx.fillStyle = '#f97316';
  ctx.fillRect(-22, -9, 10, 18);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  for (let x = -30; x < -8; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, 10);
    ctx.lineTo(x + 10, -10);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-22, -9, 40, 18, 5);
  ctx.stroke();
  // The nose: a glowing orange warhead.
  ctx.fillStyle = '#fb923c';
  ctx.beginPath();
  ctx.moveTo(18, -9);
  ctx.quadraticCurveTo(32, 0, 18, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // A flame mark on its side, upright so it reads.
  flameMark(ctx, th.x - Math.cos(heading) * 3, th.y - Math.sin(heading) * 3, 9, '#fde68a');
  hpPips(ctx, th.x, th.y - 38, th.hp, th.maxHp ?? THREATS.cloud.hp);
}

/** A flame: a teardrop with a notch, the fire warning sign. */
function flameMark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = '#111';
  ctx.lineWidth = Math.max(1, r * 0.15);
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.9, y - r * 0.1, x + r * 0.55, y + r * 0.6);
  ctx.quadraticCurveTo(x, y + r * 1.05, x - r * 0.55, y + r * 0.6);
  ctx.quadraticCurveTo(x - r * 0.9, y - r * 0.1, x, y - r);
  ctx.fill();
  ctx.stroke();
}

/** A soft round sprite drawn once and stamped many times (cheaper than a
 *  gradient a blob a frame): a flame's (white-hot core, yellow, orange, a
 *  red edge fading out) or a smoke puff's (soft grey). */
const sprites: Partial<Record<'flame' | 'smoke', HTMLCanvasElement>> = {};
function sprite(kind: 'flame' | 'smoke'): HTMLCanvasElement {
  const have = sprites[kind];
  if (have) return have;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (kind === 'flame') {
    gr.addColorStop(0, 'rgba(255,250,228,1)');
    gr.addColorStop(0.22, 'rgba(255,222,110,0.95)');
    gr.addColorStop(0.5, 'rgba(255,128,32,0.75)');
    gr.addColorStop(0.78, 'rgba(206,52,18,0.32)');
    gr.addColorStop(1, 'rgba(160,30,10,0)');
  } else {
    gr.addColorStop(0, 'rgba(118,112,108,0.9)');
    gr.addColorStop(0.55, 'rgba(96,92,90,0.55)');
    gr.addColorStop(1, 'rgba(80,78,78,0)');
  }
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  sprites[kind] = c;
  return c;
}

/** A fixed pseudo-random number in [0, 1) for a fire's `k`-th piece. */
const fireRand = (id: number, k: number) => {
  const v = Math.sin(id * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/** The way the smoke drifts (and the flames lean): up and to the left, as
 *  a damaged ship's smoke does. */
const WIND = { x: -0.85, y: -0.53 };

/** An Incendiary Missile's fireball (Test Lab round 4: "the animation for
 *  the fire is bad and does not match the theme"), seen from above like
 *  everything else on the water: a burning slick of fuel, dark and ragged at
 *  the edge with a hot glow over it; tongues of flame across it, each
 *  flickering and leaning downwind; sparks and dark smoke drifting off it;
 *  a thin ring at its reach. It flashes out as it bursts, spreads, burns,
 *  and dies down to smoke at the end. A hull inside it takes a hit every
 *  few seconds. */
function drawFire(ctx: CanvasRenderingContext2D, g: Game, m: { id: number; x: number; y: number; t: number; dur: number }): void {
  const R = FOE.cloud.radius;
  const t = g.t;
  const spread = Math.min(1, m.t / 0.4);
  const left = m.dur - m.t;
  // Flames die down over the last 1.8 s; the slick and smoke a little later.
  const burn = Math.max(0, Math.min(spread, left / 1.8));
  const slick = Math.max(0, Math.min(1, m.t / 0.25, left / 1.2));
  if (slick <= 0) return;
  ctx.save();
  // The slick: a dark, ragged pool of burning fuel on the water.
  ctx.globalAlpha = slick;
  ctx.fillStyle = 'rgba(16,10,8,0.55)';
  const edge: Point[] = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2;
    const r = R * (0.84 + 0.14 * fireRand(m.id, k)) * (0.55 + 0.45 * spread);
    edge.push({ x: m.x + Math.cos(a) * r, y: m.y + Math.sin(a) * r });
  }
  // A smooth, wobbly edge: through the midpoints, bending at each point.
  ctx.beginPath();
  edge.forEach((p, k) => {
    const n = edge[(k + 1) % edge.length];
    if (k === 0) ctx.moveTo((p.x + n.x) / 2, (p.y + n.y) / 2);
    else ctx.quadraticCurveTo(p.x, p.y, (p.x + n.x) / 2, (p.y + n.y) / 2);
  });
  ctx.quadraticCurveTo(edge[0].x, edge[0].y, (edge[0].x + edge[1].x) / 2, (edge[0].y + edge[1].y) / 2);
  ctx.closePath();
  ctx.fill();
  // The glow over it, breathing with the flames.
  const pulse = 0.85 + 0.15 * Math.sin(t * 7.3 + m.id) * Math.sin(t * 3.1);
  const glow = ctx.createRadialGradient(m.x, m.y, R * 0.1, m.x, m.y, R * 1.15);
  glow.addColorStop(0, `rgba(255,170,70,${0.6 * burn * pulse})`);
  glow.addColorStop(0.55, `rgba(240,90,30,${0.32 * burn * pulse})`);
  glow.addColorStop(1, 'rgba(200,60,20,0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(m.x, m.y, R * 1.15, 0, Math.PI * 2);
  ctx.fill();
  // Its reach: a thin warm ring (solid, like the game's other danger
  // circles).
  ctx.strokeStyle = `rgba(255,140,60,${0.55 * slick})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(m.x, m.y, R, 0, Math.PI * 2);
  ctx.stroke();
  // Tongues of flame: soft hot blobs stretched downwind, each flickering in
  // length and size on its own beat; added together they burn white where
  // they crowd.
  const flame = sprite('flame');
  const lean = Math.atan2(WIND.y, WIND.x);
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 16; k++) {
    const r = R * 0.72 * Math.sqrt(fireRand(m.id, k + 40)) * (0.5 + 0.5 * spread);
    const a = fireRand(m.id, k + 80) * Math.PI * 2;
    const ph = fireRand(m.id, k + 120) * 10;
    const flick = 0.7 + 0.3 * Math.sin(t * (8 + (k % 4)) + ph) * Math.sin(t * 4.7 + ph * 0.7);
    const size = R * (0.27 + 0.18 * fireRand(m.id, k + 160)) * burn * flick;
    if (size < 1) continue;
    const len = size * (1.5 + 0.7 * Math.max(0, Math.sin(t * 6.1 + ph)));
    ctx.save();
    ctx.translate(m.x + Math.cos(a) * r, m.y + Math.sin(a) * r);
    ctx.rotate(lean);
    ctx.globalAlpha = 0.75;
    // Stretched along the wind, its hot end upwind.
    ctx.drawImage(flame, -size, -size, len + size, size * 2);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  // Sparks flying off downwind.
  for (let k = 0; k < 7; k++) {
    const life = (t * 0.9 + fireRand(m.id, k + 200)) % 1;
    const a = fireRand(m.id, k + 240) * Math.PI * 2;
    const sx = m.x + Math.cos(a) * R * 0.5 + WIND.x * life * 46 + Math.sin(life * 9 + k) * 4;
    const sy = m.y + Math.sin(a) * R * 0.5 + WIND.y * life * 46;
    ctx.fillStyle = `rgba(255,214,120,${0.9 * (1 - life) * burn})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 1.8 + (1 - life), 0, Math.PI * 2);
    ctx.fill();
  }
  // Smoke: dark puffs rising off it and drifting away, growing as they go;
  // they outlast the flames a little.
  const smoke = sprite('smoke');
  const reek = Math.max(0, Math.min(1, m.t / 0.6, left / 1.0));
  for (let k = 0; k < 6; k++) {
    const life = (t * 0.42 + k / 6 + fireRand(m.id, k + 300) * 0.1) % 1;
    const a = fireRand(m.id, k + 340) * Math.PI * 2;
    const ox = m.x + WIND.x * R * 0.3 + Math.cos(a) * R * 0.3;
    const oy = m.y + WIND.y * R * 0.3 + Math.sin(a) * R * 0.3;
    const px = ox + WIND.x * life * R * 1.5;
    const py = oy + WIND.y * life * R * 1.5;
    const s = R * (0.3 + 0.5 * life);
    ctx.globalAlpha = 0.55 * reek * Math.min(1, life * 3) * (1 - life);
    ctx.drawImage(smoke, px - s, py - s, s * 2, s * 2);
  }
  // The burst: a white-hot flash swelling out, and a shock ring.
  if (m.t < 0.5) {
    const f = m.t / 0.5;
    const s = R * (0.8 + 0.9 * f);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 - f;
    ctx.drawImage(flame, m.x - s, m.y - s, s * 2, s * 2);
    ctx.drawImage(flame, m.x - s * 0.6, m.y - s * 0.6, s * 1.2, s * 1.2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `rgba(255,236,200,${0.8 * (1 - f)})`;
    ctx.lineWidth = 4 * (1 - f) + 1;
    ctx.beginPath();
    ctx.arc(m.x, m.y, R * (0.4 + 0.9 * f), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
