// The enemy build: how the new enemies look (docs/design/v3-enemy-build.md).
// Each one is drawn so its tell reads on a phone: the booster flare, the
// decoys' strobe, the forked tail, the launcher's slow raise, the circling
// group.

import { THREATS } from '../data/config';
import { FOE } from '../data/foes';
import { CARRIER_TARGET, type Game, type Threat } from '../sim/game';
import { revealedDecoy } from '../sim/foes';
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

/** Shots no interceptor can stop: the Rocket Truck's rockets, a dive
 *  bomber's bomb, a siege battery's shells in flight. */
export function drawFoeShots(ctx: CanvasRenderingContext2D, g: Game): void {
  for (const m of g.foe.marks) {
    if (m.kind !== 'shell' || !m.fired) continue;
    // A shell lobbed from the gun, arcing down onto its circle.
    const u = 1 - (m.dur - m.t) / FOE.siege.flight;
    const gx = m.gx ?? m.x;
    const gy = m.gy ?? m.y;
    const x = gx + (m.x - gx) * u;
    const y = gy + (m.y - gy) * u - 4 * 120 * u * (1 - u);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(gx + (m.x - gx) * u, gy + (m.y - gy) * u, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd08a';
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  for (const s of g.foe.shots) {
    if (s.kind === 'bomb') {
      // Falling: it shrinks toward the water.
      const u = Math.min(1, s.t / s.dur);
      ctx.fillStyle = '#1f2937';
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 9 - 4 * u, 13 - 6 * u, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      continue;
    }
    const a = Math.atan2(s.ty - s.sy, s.tx - s.sx);
    // Where it lands, the moment it's fired: a small red cross on the water.
    ctx.strokeStyle = 'rgba(255,77,61,0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(s.tx - 9, s.ty - 9);
    ctx.lineTo(s.tx + 9, s.ty + 9);
    ctx.moveTo(s.tx + 9, s.ty - 9);
    ctx.lineTo(s.tx - 9, s.ty + 9);
    ctx.stroke();
    // A white-hot streak with a smoke tail back to the truck.
    const back = Math.min(120, Math.hypot(s.x - s.sx, s.y - s.sy));
    const grad = ctx.createLinearGradient(s.x - Math.cos(a) * back, s.y - Math.sin(a) * back, s.x, s.y);
    grad.addColorStop(0, 'rgba(220,210,200,0)');
    grad.addColorStop(1, 'rgba(255,200,140,0.85)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(a) * back, s.y - Math.sin(a) * back);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    missile(ctx, s.x, s.y, a, 16, 4, '#fff4e0', '#ff4d3d');
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

/** The Dive Bomber, dropping onto its circle: it grows as it comes down,
 *  its shadow closing on the circle. */
function drawDiveBomber(ctx: CanvasRenderingContext2D, th: Threat): void {
  const f = th.foe;
  if (!f) return;
  const D = FOE.diveBomber;
  const u = f.state === 0 ? Math.min(1, f.t / D.window) : 1 - Math.min(1, f.t / 0.9);
  const k = 0.75 + 0.6 * u;
  // Shadow: from wide off to right on the circle.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(f.px + (1 - u) * 60, f.py, 26 * k, 10 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  // Speed lines above it.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (const dx of [-14, 0, 14]) {
    ctx.beginPath();
    ctx.moveTo(th.x + dx * k, th.y - 40 * k);
    ctx.lineTo(th.x + dx * k, th.y - 70 * k);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.scale(k, k);
  // Gull wings, seen from above as it noses down at the water.
  ctx.fillStyle = '#7c2d12';
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 22);
  ctx.lineTo(-10, 4);
  ctx.lineTo(-38, -4);
  ctx.lineTo(-36, -12);
  ctx.lineTo(-8, -8);
  ctx.lineTo(-4, -22);
  ctx.lineTo(4, -22);
  ctx.lineTo(8, -8);
  ctx.lineTo(36, -12);
  ctx.lineTo(38, -4);
  ctx.lineTo(10, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fca5a5';
  ctx.beginPath();
  ctx.arc(0, 14, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  hpPips(ctx, th.x, th.y - 40 * k, th.hp, THREATS.diveBomber.hp);
}

/** The Siege Battery: a gun pit of sandbags with a long barrel. */
function drawSiege(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const next = g.foe.marks.find((m) => m.link === th.id);
  const aim = next ? Math.atan2(next.y - th.y, next.x - th.x) : Math.PI / 2;
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.strokeStyle = 'rgba(255,170,60,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#8a7b5a';
  ctx.strokeStyle = '#1b1a14';
  ctx.lineWidth = 2;
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 20, Math.sin(a) * 20, 7, 5, a + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.rotate(aim);
  ctx.fillStyle = '#3f3a33';
  ctx.fillRect(-4, -5, 40, 10);
  ctx.strokeRect(-4, -5, 40, 10);
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  hpPips(ctx, th.x, th.y - 44, th.hp, THREATS.siege.hp);
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
