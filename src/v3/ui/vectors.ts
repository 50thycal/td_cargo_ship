// Drawing for round 4's attack vectors: submarines surfacing in open water,
// missile trucks on the enemy roads, and aircraft coming in from the screen
// edges. The sim says where everything is and what state it is in; this file
// turns that into motion the player can read at a glance — a periscope and
// wake before a sub breaks the surface, dust behind a moving truck and its
// launcher swinging up before it fires, an arrow and a dashed flight line
// before a jet arrives, then its shadow, tracers and water spouts.
//
// The only state kept here is cosmetic (dust puffs), keyed by raider id.

import { PLANE, SUB, TRUCK, VIEW } from '../data/config';
import { type Ally, type Game, type Raider, type Threat } from '../sim/game';

const SUB_HULL = '#26302f';
const SUB_EDGE = '#0c1212';
const TRUCK_CAB = '#7c7150';
const TRUCK_SCALE = 1.3;
const TRUCK_BED = '#5a5236';
const TUBE = '#a39874';
const ROAD = '#6e5845';
const JET = '#8f99a3';
const BOMBER = '#a3a88f';
const ALLY = '#cfe3f7';
/** Aircraft are drawn this much larger than their 1:1 airframe (round 4
 *  frame review: at phone size they read no bigger than a cargo ship). */
const PLANE_SCALE = 1.35;
const WARN_JET = '255,150,70';
const WARN_BOMBER = '255,120,230';

// ---------------------------------------------------------------------------
// Dust behind moving trucks (cosmetic, per frame)

interface Puff {
  x: number;
  y: number;
  t: number;
}

const dust = new Map<number, { puffs: Puff[]; lastX: number; lastY: number; clock: number }>();

function trailDust(r: Raider, now: number): Puff[] {
  let d = dust.get(r.id);
  if (!d) {
    d = { puffs: [], lastX: r.x, lastY: r.y, clock: now };
    dust.set(r.id, d);
  }
  const moved = Math.hypot(r.x - d.lastX, r.y - d.lastY);
  if (moved > 7) {
    // Dust kicks up behind the wheels: behind when driving, in front when
    // reversing (the truck backs into its own dust).
    const back = r.state === 'reverse' ? 1 : -1;
    d.puffs.push({ x: r.x + Math.cos(r.heading) * 22 * back, y: r.y + Math.sin(r.heading) * 22 * back, t: now });
    d.lastX = r.x;
    d.lastY = r.y;
  }
  d.puffs = d.puffs.filter((p) => now - p.t < 0.9);
  return d.puffs;
}

/** Forget trucks that have left (call once per frame). */
function pruneDust(g: Game): void {
  if (dust.size === 0) return;
  const live = new Set(g.raiders.map((r) => r.id));
  for (const id of dust.keys()) if (!live.has(id)) dust.delete(id);
}

// ---------------------------------------------------------------------------
// Entry points (called from render.ts)

const onScreen = (p: { x: number; y: number }): boolean => p.x > 0 && p.x < VIEW.width && p.y > 0 && p.y < VIEW.height;

/** The truck roads (round 13): a dirt track under every route a truck can
 *  drive, so it is clear where they will come from. Drawn with the land. */
export function drawRoads(ctx: CanvasRenderingContext2D, g: Game): void {
  const routes = [...g.map.roads.runners, ...g.map.roads.popups.map((p) => [p.from, p.to])];
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const [width, color] of [
    [24, 'rgba(20,14,10,0.55)'],
    [19, ROAD],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const path of routes) {
      ctx.beginPath();
      path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    }
  }
  // Wheel ruts.
  ctx.strokeStyle = 'rgba(30,22,16,0.35)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([10, 8]);
  for (const path of routes) {
    ctx.beginPath();
    path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.lineCap = 'butt';
}

/** Tunnel mouths (round 13): wherever a truck road starts or ends on screen
 *  it goes into the hillside. Drawn after the trucks, so one coming out is
 *  seen nosing out of the dark and one going in disappears into it. */
export function drawTunnels(ctx: CanvasRenderingContext2D, g: Game): void {
  for (const m of tunnelMouths(g)) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.facing);
    // The hillside the road runs into, then the dark mouth facing the road.
    ctx.fillStyle = '#4d3a2f';
    ctx.beginPath();
    ctx.ellipse(-12, 0, 18, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#0a0705';
    ctx.beginPath();
    ctx.ellipse(-2, 0, 9, 15, 0, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-14, 15);
    ctx.lineTo(-14, -15);
    ctx.closePath();
    ctx.fill();
    // A stone arch around it.
    ctx.strokeStyle = '#9b8468';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 10, 17, 0, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** Every on-screen road end, facing out along the road. */
function tunnelMouths(g: Game): { x: number; y: number; facing: number }[] {
  const out: { x: number; y: number; facing: number }[] = [];
  const face = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.atan2(q.y - p.y, q.x - p.x);
  for (const path of g.map.roads.runners) {
    const a = path[0];
    const z = path[path.length - 1];
    if (onScreen(a)) out.push({ ...a, facing: face(a, path[1]) });
    if (onScreen(z)) out.push({ ...z, facing: face(z, path[path.length - 2]) });
  }
  for (const p of g.map.roads.popups) if (onScreen(p.from)) out.push({ ...p.from, facing: face(p.from, p.to) });
  return out;
}

/** Submarines and trucks: drawn after the land and before the ships. */
export function drawRaiders(ctx: CanvasRenderingContext2D, g: Game): void {
  pruneDust(g);
  for (const r of g.raiders) {
    if (r.kind === 'sub') drawSub(ctx, g, r);
    else drawTruck(ctx, g, r);
  }
}

/** Arrows at the entry edge and the dashed flight line, while an aircraft is
 *  on its way (PLANE.warn seconds ahead). */
export function drawPlaneWarnings(ctx: CanvasRenderingContext2D, g: Game): void {
  if (g.phase !== 'wave') return;
  const warn = PLANE.warn;
  for (const l of g.queue) {
    const ahead = l.at - g.waveT;
    if (ahead > warn) break;
    if ((l.kind !== 'strafer' && l.kind !== 'bomber') || l.y === undefined) continue;
    const side = l.side ?? 1;
    const p = 1 - ahead / warn;
    const col = l.kind === 'strafer' ? WARN_JET : WARN_BOMBER;
    const flash = 0.55 + 0.45 * Math.sin(g.t * 16);
    // The line it will fly: which lane is about to be strafed.
    ctx.save();
    ctx.strokeStyle = `rgba(${col},${l.kind === 'strafer' ? 0.1 + 0.18 * p : 0.3 + 0.4 * p})`;
    ctx.lineWidth = l.kind === 'strafer' ? PLANE.band * 2 * (0.25 + 0.75 * p) : 3;
    ctx.setLineDash(l.kind === 'strafer' ? [] : [14, 12]);
    ctx.beginPath();
    ctx.moveTo(0, l.y);
    ctx.lineTo(VIEW.width, l.y);
    ctx.stroke();
    if (l.kind === 'strafer') {
      // The band's edges, dashed: every hull between them will be hit.
      ctx.strokeStyle = `rgba(${col},${0.4 + 0.4 * p})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 10]);
      ctx.lineDashOffset = -g.t * 120 * side;
      const half = PLANE.band * (0.25 + 0.75 * p);
      for (const dy of [-half, half]) {
        ctx.beginPath();
        ctx.moveTo(0, l.y + dy);
        ctx.lineTo(VIEW.width, l.y + dy);
        ctx.stroke();
      }
    }
    ctx.restore();
    // Chevrons at the edge it comes in from, sliding inward.
    const ex = side > 0 ? 14 : VIEW.width - 14;
    ctx.save();
    ctx.translate(ex, l.y);
    ctx.scale(side, 1);
    for (let k = 0; k < 3; k++) {
      const off = ((g.t * 60 + k * 18) % 54) - 6;
      ctx.fillStyle = `rgba(${col},${flash * (1 - off / 60)})`;
      ctx.beginPath();
      ctx.moveTo(off, -16);
      ctx.lineTo(off + 16, 0);
      ctx.lineTo(off, 16);
      ctx.lineTo(off + 6, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // Label just inside the edge.
    ctx.save();
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.textAlign = side > 0 ? 'left' : 'right';
    ctx.fillStyle = `rgba(${col},${0.6 + 0.4 * flash})`;
    ctx.fillText(l.kind === 'strafer' ? '✈ STRAFING RUN' : '✈ BOMBER', side > 0 ? 78 : VIEW.width - 78, l.y - 24);
    ctx.restore();
  }
}

/** Aircraft (threats 'strafer' and 'bomber'): shadow on the water, contrails,
 *  the airframe, and a strafing jet's guns. */
export function drawPlane(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const side = th.side ?? 1;
  const heading = side > 0 ? 0 : Math.PI;
  const big = th.kind === 'bomber';
  // Shadow far below: sells the altitude.
  ctx.save();
  ctx.translate(th.x + 30, th.y + 50);
  ctx.rotate(heading);
  ctx.scale(PLANE_SCALE * 0.9, PLANE_SCALE * 0.9);
  ctx.globalAlpha = 0.3;
  airframe(ctx, big, '#000', '#000');
  ctx.restore();
  // Contrails from the wingtips.
  ctx.save();
  const span = (big ? 34 : 20) * PLANE_SCALE;
  for (const s of [-1, 1]) {
    const grad = ctx.createLinearGradient(th.x, 0, th.x - side * 170, 0);
    grad.addColorStop(0, 'rgba(235,240,245,0.55)');
    grad.addColorStop(1, 'rgba(235,240,245,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(th.x - side * 8, th.y + s * span);
    ctx.lineTo(th.x - side * 170, th.y + s * span);
    ctx.stroke();
  }
  ctx.restore();
  // Guns: muzzle flash, tracer streams to where the rounds land.
  if (th.kind === 'strafer' && th.firing) {
    const gx = th.x + side * PLANE.gunLead;
    const nose = th.x + side * 26 * PLANE_SCALE;
    const flick = Math.floor(g.t * 30) % 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,224,120,0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 9]);
    ctx.lineDashOffset = -g.t * 400 * side;
    for (const dy of [-6, 6]) {
      ctx.beginPath();
      ctx.moveTo(nose, th.y + dy);
      ctx.lineTo(gx, th.y + dy * 4);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = flick ? 'rgba(255,240,170,0.95)' : 'rgba(255,190,90,0.9)';
    star(ctx, nose + side * 4, th.y, flick ? 9 : 6);
    ctx.restore();
  }
  // The airframe, with an engine glow that flickers.
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.rotate(heading);
  ctx.scale(PLANE_SCALE, PLANE_SCALE);
  const glow = 0.6 + 0.4 * Math.sin(g.t * 40 + th.id);
  ctx.fillStyle = `rgba(255,170,80,${glow})`;
  ctx.beginPath();
  ctx.arc(big ? -34 : -27, 0, big ? 5 : 4.5, 0, Math.PI * 2);
  ctx.fill();
  airframe(ctx, big, big ? BOMBER : JET, '#f2f4f6');
  ctx.restore();
}

/** A friendly Air Strike jet: pale blue with blue roundels, low over the
 *  water (a short shadow), the band it is sweeping lit faintly ahead of it,
 *  and its guns flashing while it is hitting something. Drawn in the jet's
 *  own frame, so it can fly any line the player swiped. */
export function drawAlly(ctx: CanvasRenderingContext2D, g: Game, a: Ally): void {
  const lead = 260;
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(Math.atan2(a.dy, a.dx));
  const sweep = ctx.createLinearGradient(0, 0, lead, 0);
  sweep.addColorStop(0, a.knock ? 'rgba(251,146,60,0.25)' : 'rgba(96,165,250,0.22)');
  sweep.addColorStop(1, 'rgba(96,165,250,0)');
  ctx.fillStyle = sweep;
  ctx.fillRect(0, -a.band, lead, a.band * 2);
  ctx.strokeStyle = 'rgba(147,197,253,0.5)';
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 2;
  for (const dy of [-a.band, a.band]) {
    ctx.beginPath();
    ctx.moveTo(0, dy);
    ctx.lineTo(lead, dy);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Contrail behind.
  const trail = ctx.createLinearGradient(0, 0, -220, 0);
  trail.addColorStop(0, 'rgba(235,245,255,0.7)');
  trail.addColorStop(1, 'rgba(235,245,255,0)');
  ctx.strokeStyle = trail;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-220, 0);
  ctx.stroke();
  ctx.restore();
  // Shadow, then the jet.
  for (const shadow of [true, false]) {
    ctx.save();
    ctx.translate(a.x + (shadow ? 14 : 0), a.y + (shadow ? 22 : 0));
    ctx.rotate(Math.atan2(a.dy, a.dx));
    ctx.scale(PLANE_SCALE * 1.1, PLANE_SCALE * 1.1);
    if (shadow) {
      ctx.globalAlpha = 0.3;
      airframe(ctx, false, '#000', '#000');
    } else {
      airframe(ctx, false, ALLY, '#ffffff', '#2563eb');
    }
    ctx.restore();
  }
  if (g.t - a.firedT < 0.15) {
    ctx.fillStyle = 'rgba(255,240,170,0.95)';
    star(ctx, a.x + a.dx * 40, a.y + a.dy * 40, 10);
  }
}

// ---------------------------------------------------------------------------
// Submarine

function drawSub(ctx: CanvasRenderingContext2D, g: Game, r: Raider): void {
  const { x, y } = r;
  // How much of the hull is above water (0..1), and the phase's progress.
  let up = 0;
  let p = 0;
  if (r.state === 'warn') p = r.t / SUB.warn;
  else if (r.state === 'surface') {
    p = r.t / SUB.surface;
    up = easeOut(p);
  } else if (r.state === 'fire') up = 1;
  else if (r.state === 'dive') {
    p = r.t / SUB.dive;
    up = 1 - easeIn(p);
  }
  // Rings spreading from the spot the whole time it is near the surface.
  for (let k = 0; k < 3; k++) {
    const u = (g.t * 0.9 + k / 3) % 1;
    ctx.strokeStyle = `rgba(200,230,240,${0.35 * (1 - u)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, 30 + u * 70, 12 + u * 28, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (r.state === 'warn') {
    // Where it will come up: a red dashed ring that tightens and brightens.
    ctx.save();
    ctx.strokeStyle = `rgba(255,77,61,${0.25 + 0.55 * p})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = -g.t * 30;
    ctx.beginPath();
    ctx.ellipse(x, y, 74 - 16 * p, 30 - 6 * p, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // A dark shape rising under the water.
    ctx.fillStyle = `rgba(3,10,14,${0.2 + 0.45 * p})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 40 + 14 * p, 9 + 4 * p, 0, 0, Math.PI * 2);
    ctx.fill();
    // The periscope cutting through, a foam feather and V-wake behind it.
    const px = x - 40 + 48 * p;
    ctx.strokeStyle = 'rgba(240,248,252,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(px - 46, y - 16);
    ctx.lineTo(px - 2, y);
    ctx.lineTo(px - 46, y + 16);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(px + 2, y, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10181a';
    ctx.fillRect(px - 2.5, y - 16, 5, 15);
    ctx.fillStyle = Math.floor(g.t * 6) % 2 ? '#ff4d3d' : '#ffb0a8';
    ctx.fillRect(px - 3, y - 19, 6, 5);
    return;
  }
  // Foam around the hull as it breaks the surface, and again as it goes down.
  if (r.state === 'surface' || r.state === 'dive') {
    ctx.fillStyle = `rgba(235,245,250,${0.55 * (1 - Math.abs(up - 0.5) * 1.2)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 64, 20, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = Math.max(0, up);
  ctx.scale(0.85 + 0.15 * up, 0.85 + 0.15 * up);
  // Hull.
  ctx.fillStyle = SUB_HULL;
  ctx.strokeStyle = SUB_EDGE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 50, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3a4746';
  ctx.fillRect(-36, -2, 72, 4);
  // Sail (conning tower) toward the bow.
  ctx.fillStyle = '#1e2727';
  ctx.beginPath();
  ctx.roundRect(8, -6, 20, 12, 4);
  ctx.fill();
  ctx.stroke();
  // Missile hatches aft of the sail: open and glowing while it fires.
  for (let k = 0; k < 4; k++) {
    const hx = -30 + k * 9;
    ctx.fillStyle = r.state === 'fire' ? (k === (Math.floor(g.t * 6) % 4) ? '#ffb347' : '#5b2a1c') : '#151c1c';
    ctx.fillRect(hx - 3, -3.5, 6, 7);
  }
  ctx.restore();
  // Water sheeting off as it rises: white streaks along the hull.
  if (r.state === 'surface') {
    ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - p)})`;
    ctx.lineWidth = 2;
    for (const dy of [-13, 13]) {
      ctx.beginPath();
      ctx.moveTo(x - 46, y + dy);
      ctx.lineTo(x + 46, y + dy);
      ctx.stroke();
    }
  }
  if (r.state === 'dive') {
    // Bubbles as it goes down.
    for (let k = 0; k < 6; k++) {
      const a = k * 1.7 + g.t * 3;
      ctx.fillStyle = `rgba(230,245,250,${0.6 * (1 - p)})`;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 40 * p, y + Math.sin(a) * 14 * p, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------------
// Missile truck

function drawTruck(ctx: CanvasRenderingContext2D, g: Game, r: Raider): void {
  for (const puff of trailDust(r, g.t)) {
    const u = (g.t - puff.t) / 0.9;
    ctx.fillStyle = `rgba(190,165,120,${0.35 * (1 - u)})`;
    ctx.beginPath();
    ctx.arc(puff.x, puff.y, 6 + u * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  // Launcher elevation 0..1 through raise / fire / lower.
  let elev = 0;
  if (r.state === 'raise') elev = easeOut(Math.min(1, r.t / TRUCK.raise));
  else if (r.state === 'fire') elev = 1;
  else if (r.state === 'lower') elev = 1 - easeIn(Math.min(1, r.t / TRUCK.lower));
  // Out of a tunnel it fades up from the dark; into one, it fades away.
  let fade = 1;
  if (onScreen(r.path[0])) fade = Math.min(fade, r.dist / 22);
  if (r.kind === 'runner' && onScreen(r.path[r.path.length - 1])) fade = Math.min(fade, (r.length - r.dist) / 22);
  fade = Math.max(0, Math.min(1, fade));
  if (fade <= 0) return;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(r.x, r.y);
  ctx.rotate(r.heading);
  ctx.scale(TRUCK_SCALE, TRUCK_SCALE);
  // Shadow, a pale halo so it stands off the dark ground, wheels, bed, cab.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-22, -6, 46, 18);
  ctx.strokeStyle = 'rgba(240,228,190,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-25, -13, 51, 26, 5);
  ctx.stroke();
  ctx.fillStyle = '#151311';
  const roll = r.state === 'drive' || r.state === 'reverse' ? Math.floor(g.t * 14) % 2 : 0;
  for (const wx of [-15, -4, 13]) {
    ctx.fillRect(wx - 3 + roll, -11, 7, 3);
    ctx.fillRect(wx - 3 + roll, 8, 7, 3);
  }
  ctx.fillStyle = TRUCK_BED;
  ctx.strokeStyle = '#1b1a14';
  ctx.lineWidth = 1.5;
  ctx.fillRect(-22, -8, 32, 16);
  ctx.strokeRect(-22, -8, 32, 16);
  ctx.fillStyle = TRUCK_CAB;
  ctx.beginPath();
  ctx.roundRect(10, -8, 13, 16, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2b3a44';
  ctx.fillRect(18, -6, 4, 12);
  // Headlights forward; reversing lights aft while it backs out.
  ctx.fillStyle = 'rgba(255,240,190,0.9)';
  ctx.fillRect(22, -7, 2, 3);
  ctx.fillRect(22, 4, 2, 3);
  if (r.state === 'reverse') {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(-24, -7, 2, 3);
    ctx.fillRect(-24, 4, 2, 3);
  }
  // Launcher lying on the bed while it drives.
  if (elev < 0.05) {
    ctx.fillStyle = TUBE;
    ctx.strokeStyle = '#2a271c';
    ctx.beginPath();
    ctx.roundRect(-20, -3.5, 30, 7, 2);
    ctx.fill();
    ctx.stroke();
  }
  if (elev > 0.6) {
    // Raised: a red beacon blinks — this truck is about to fire.
    const blink = Math.floor(g.t * 8) % 2 === 0;
    ctx.fillStyle = blink ? '#ff4d3d' : '#7a1f17';
    ctx.beginPath();
    ctx.arc(14, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (elev >= 0.05) {
    // Raised, it stands up off the bed: drawn upright in screen space (a 3/4
    // view) with its shadow thrown across the ground, so the swing up from
    // lying flat to firing reads clearly from above.
    const back = 14 * TRUCK_SCALE;
    const pivot = { x: r.x - Math.cos(r.heading) * back, y: r.y - Math.sin(r.heading) * back };
    const h = 36 * elev;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.save();
    ctx.translate(pivot.x, pivot.y);
    ctx.rotate(0.6);
    ctx.fillRect(0, -3, h * 1.3, 6);
    ctx.restore();
    ctx.fillStyle = TUBE;
    ctx.strokeStyle = '#2a271c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(pivot.x - 4, pivot.y - h, 8, h + 2, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d9cfa8';
    ctx.fillRect(pivot.x - 4, pivot.y - h, 8, 3);
  }
  if (elev > 0.6) {
    // A ring around a raised launcher, like the bases' warning ring.
    ctx.strokeStyle = `rgba(255,77,61,${0.35 + 0.35 * Math.sin(g.t * 14)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 36, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Shapes

/** A jet (swept wings) or a bomber (straight wings, two engines), nose +x. */
function airframe(ctx: CanvasRenderingContext2D, big: boolean, fill: string, edge: string, roundel = '#d94a3a'): void {
  ctx.fillStyle = fill;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (big) {
    // Fuselage
    ctx.moveTo(34, 0);
    ctx.quadraticCurveTo(30, -6, 18, -6);
    ctx.lineTo(-30, -5);
    ctx.lineTo(-34, 0);
    ctx.lineTo(-30, 5);
    ctx.lineTo(18, 6);
    ctx.quadraticCurveTo(30, 6, 34, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Straight wings and tailplane
    ctx.beginPath();
    ctx.moveTo(8, -5);
    ctx.lineTo(-2, -36);
    ctx.lineTo(-12, -36);
    ctx.lineTo(-8, -5);
    ctx.moveTo(8, 5);
    ctx.lineTo(-2, 36);
    ctx.lineTo(-12, 36);
    ctx.lineTo(-8, 5);
    ctx.moveTo(-24, -4);
    ctx.lineTo(-32, -15);
    ctx.lineTo(-36, -15);
    ctx.lineTo(-32, -4);
    ctx.moveTo(-24, 4);
    ctx.lineTo(-32, 15);
    ctx.lineTo(-36, 15);
    ctx.lineTo(-32, 4);
    ctx.fill();
    ctx.stroke();
    // Engine pods
    ctx.fillStyle = edge === '#000' ? '#000' : '#5a5e4e';
    for (const ey of [-20, 20]) {
      ctx.beginPath();
      ctx.roundRect(-4, ey - 3.5, 14, 7, 3);
      ctx.fill();
    }
  } else {
    ctx.moveTo(28, 0);
    ctx.lineTo(10, -4);
    ctx.lineTo(-2, -4);
    ctx.lineTo(-16, -22);
    ctx.lineTo(-22, -22);
    ctx.lineTo(-14, -4);
    ctx.lineTo(-22, -4);
    ctx.lineTo(-28, -11);
    ctx.lineTo(-31, -11);
    ctx.lineTo(-28, 0);
    ctx.lineTo(-31, 11);
    ctx.lineTo(-28, 11);
    ctx.lineTo(-22, 4);
    ctx.lineTo(-14, 4);
    ctx.lineTo(-22, 22);
    ctx.lineTo(-16, 22);
    ctx.lineTo(-2, 4);
    ctx.lineTo(10, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (edge !== '#000') {
    // Canopy and roundels (red: enemy, blue: friendly).
    ctx.fillStyle = '#9fd3ef';
    ctx.beginPath();
    ctx.ellipse(big ? 24 : 14, 0, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = roundel;
    for (const wy of big ? [-28, 28] : [-14, 14]) {
      ctx.beginPath();
      ctx.arc(big ? -6 : -12, wy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const rr = k % 2 ? r * 0.4 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function easeOut(u: number): number {
  return 1 - (1 - u) * (1 - u);
}

function easeIn(u: number): number {
  return u * u;
}
