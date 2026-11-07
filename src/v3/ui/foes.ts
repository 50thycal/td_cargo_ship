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
    default:
      return false;
  }
}

/** Under everything that flies: the loiter spots, the trucks' targets. */
export function drawFoeGround(ctx: CanvasRenderingContext2D, g: Game): void {
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

/** Shots no interceptor can stop: the Rocket Truck's rockets. */
export function drawFoeShots(ctx: CanvasRenderingContext2D, g: Game): void {
  for (const s of g.foe.shots) {
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
