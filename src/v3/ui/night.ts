// Night: the Black Strait's darkness, its lighthouse and the carrier's lamp,
// and Blackout's night (a special event). Draws only; reads the game and
// mutates nothing in it (log v67: the sea is always dark here, no Star Shell
// lights it; the light is the lighthouse, the carrier's lamp and the flash of
// what is launched or blown up).
//
// The look (the player: "improve the animation and look of the spot light"):
//  - the lighthouse is a real tower on its headland, its lamp room glowing,
//    a lens star turning with the beam;
//  - the beam is a soft cone, a bright core inside a wider haze, brightest at
//    the lamp and fading out at its reach, with glints on the water inside it
//    and a pale footprint where it lands;
//  - the sweep eases at each end, as a lamp turning round on its rail;
//  - the carrier's lamp is a warm pool that breathes, its edge a ring that
//    opens out, so the edge of the light reads;
//  - a threat the beam finds pings once, a ring that opens round it;
//  - what is in the dark is a glow with a short tail along its heading.

import type { Game, Threat } from '../sim/game';
import { reticleVisible } from '../sim/game';

/** The carrier's lamp reaches this far (px): `lit` and the pool agree. */
export const LAMP_REACH = 200;

let dark: HTMLCanvasElement | null = null;
/** Per threat: was it lit last frame, and when did the beam last find it. */
const seen = new Map<number, { lit: boolean; ping: number }>();

/** A cheap steady hash in [0, 1): the glints keep their places. */
const hash = (i: number, k: number) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function drawNight(ctx: CanvasRenderingContext2D, g: Game, drawReticle: (th: Threat) => void, drawMarks?: () => void): void {
  const n = g.map.night;
  // Blackout (a special event): night for its length, with no lighthouse.
  if (!n && !nightEvent(g)) return;
  // A Star Shell's flare is gone from the game (log v67); a run replayed from
  // an older log could still have one, and it still lights the sea.
  const flare = g.flareT > 0 ? Math.min(1, g.flareT / 1) : 0;
  const alpha = 0.78 * (1 - flare);
  if (alpha <= 0.02) return;
  const t = g.t;
  if (!dark) dark = document.createElement('canvas');
  if (dark.width !== 1600) {
    dark.width = 1600;
    dark.height = 900;
  }
  const d = dark.getContext('2d')!;
  d.globalCompositeOperation = 'source-over';
  d.clearRect(0, 0, 1600, 900);
  d.fillStyle = `rgba(2,8,16,${alpha})`;
  d.fillRect(0, 0, 1600, 900);
  d.globalCompositeOperation = 'destination-out';
  const hole = (x: number, y: number, r: number, k = 1) => {
    const grad = d.createRadialGradient(x, y, r * 0.2, x, y, r);
    grad.addColorStop(0, `rgba(0,0,0,${k})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = grad;
    d.beginPath();
    d.arc(x, y, r, 0, Math.PI * 2);
    d.fill();
  };
  const beam = n ? beamAngle(g) : 0;
  const w = n ? (n.width * Math.PI) / 180 : 0;
  // The wedge a cone of `half` radians (about the beam) cuts out of the dark,
  // brightest at the lamp and fading to `tail` at its reach.
  const wedge = (c: CanvasRenderingContext2D, half: number, head: number, tail: number) => {
    if (!n) return;
    const grad = c.createRadialGradient(n.light.x, n.light.y, 10, n.light.x, n.light.y, n.reach);
    grad.addColorStop(0, `rgba(0,0,0,${head})`);
    grad.addColorStop(0.7, `rgba(0,0,0,${(head + tail) / 2})`);
    grad.addColorStop(1, `rgba(0,0,0,${tail})`);
    c.fillStyle = grad;
    c.beginPath();
    c.moveTo(n.light.x, n.light.y);
    c.arc(n.light.x, n.light.y, n.reach, beam - half, beam + half);
    c.closePath();
    c.fill();
  };
  if (n) {
    // The haze round the beam, then the beam itself: soft edges that the
    // `lit` cone (the beam's own half-width) sits inside.
    wedge(d, w * 0.95, 0.3, 0);
    wedge(d, w * 0.62, 0.7, 0.18);
    wedge(d, w * 0.5, 1, 0.55);
    hole(n.light.x, n.light.y, 80);
  }
  // The carrier's lamp: a pool that breathes a little.
  const c = g.map.carrier;
  hole(c.x, c.y, 230 + Math.sin(t * 1.7) * 5);
  for (const f of g.fx) if (f.kind === 'launch' || f.kind === 'boom' || f.kind === 'burst') hole(f.x, f.y, 90 + f.r * 2, 1 - f.age / f.life);
  for (const s of g.ships) hole(s.x, s.y, 46, 0.5);
  ctx.drawImage(dark, 0, 0);

  // ---- Light on top of the dark ----
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (n) {
    // A pale haze through the beam, the lamp's glare at its root.
    const haze = ctx.createRadialGradient(n.light.x, n.light.y, 8, n.light.x, n.light.y, n.reach);
    haze.addColorStop(0, 'rgba(255,238,180,0.34)');
    haze.addColorStop(0.35, 'rgba(255,238,180,0.13)');
    haze.addColorStop(1, 'rgba(255,238,180,0)');
    ctx.fillStyle = haze;
    ctx.beginPath();
    ctx.moveTo(n.light.x, n.light.y);
    ctx.arc(n.light.x, n.light.y, n.reach, beam - w * 0.5, beam + w * 0.5);
    ctx.closePath();
    ctx.fill();
    // The core: a thinner, brighter shaft down the middle.
    ctx.fillStyle = haze;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(n.light.x, n.light.y);
    ctx.arc(n.light.x, n.light.y, n.reach, beam - w * 0.16, beam + w * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // Glints on the water inside the beam, drifting out along it.
    for (let i = 0; i < 26; i++) {
      const along = (hash(i, 1) + t * (0.05 + hash(i, 2) * 0.06)) % 1;
      const r = 140 + along * (n.reach - 220);
      const off = (hash(i, 3) - 0.5) * w * 0.8;
      const a = beam + off;
      const tw = 0.5 + 0.5 * Math.sin(t * (3 + hash(i, 4) * 4) + i);
      ctx.fillStyle = `rgba(255,250,220,${0.55 * tw * (1 - along * 0.8)})`;
      ctx.fillRect(n.light.x + Math.cos(a) * r - 3, n.light.y + Math.sin(a) * r - 1, 6 + hash(i, 5) * 6, 2);
    }
    // Where it lands: a pale footprint on the water at its reach.
    const fx = n.light.x + Math.cos(beam) * (n.reach - 40);
    const fy = n.light.y + Math.sin(beam) * (n.reach - 40);
    const foot = ctx.createRadialGradient(fx, fy, 4, fx, fy, 90);
    foot.addColorStop(0, 'rgba(255,238,180,0.16)');
    foot.addColorStop(1, 'rgba(255,238,180,0)');
    ctx.fillStyle = foot;
    ctx.beginPath();
    ctx.arc(fx, fy, 90, 0, Math.PI * 2);
    ctx.fill();
  }
  // The carrier's lamp: a warm pool and its edge, a ring that opens out every
  // 2.4 s (so the edge of the light, where a threat is lit or not, reads).
  const pool = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, LAMP_REACH + 24);
  pool.addColorStop(0, 'rgba(255,214,140,0.16)');
  pool.addColorStop(0.7, 'rgba(255,214,140,0.06)');
  pool.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.arc(c.x, c.y, LAMP_REACH + 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 14]);
  ctx.lineDashOffset = -t * 10;
  ctx.strokeStyle = 'rgba(255,224,160,0.16)';
  ctx.beginPath();
  ctx.arc(c.x, c.y, LAMP_REACH, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  const k = (t % 2.4) / 2.4;
  ctx.strokeStyle = `rgba(255,224,160,${0.2 * (1 - k)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 40 + k * (LAMP_REACH - 40), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  if (n) drawLighthouse(ctx, n.light.x, n.light.y, beam, t);

  // ---- What is in the dark ----
  const now = new Set<number>();
  for (const th of g.threats) {
    if (th.dead) continue;
    now.add(th.id);
    const isLit = lit(g, th.x, th.y);
    const was = seen.get(th.id);
    // The beam finds it: one ping, a ring opening out round it.
    if (isLit && was && !was.lit && n && inBeam(g, th.x, th.y)) seen.set(th.id, { lit: true, ping: t });
    else seen.set(th.id, { lit: isLit, ping: was?.ping ?? -9 });
    const ping = t - (seen.get(th.id)?.ping ?? -9);
    if (ping >= 0 && ping < 0.6) {
      const p = ping / 0.6;
      ctx.strokeStyle = `rgba(255,243,196,${0.8 * (1 - p)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(th.x, th.y, 14 + p * 36, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (isLit) continue;
    // A faint glow where its engine is, a tail along its heading and a slow
    // breath, so it can be found and tapped on a phone.
    const breath = 0.8 + 0.2 * Math.sin(t * 5 + th.id);
    const sp = Math.hypot(th.vx, th.vy);
    if (sp > 1) {
      const ux = th.vx / sp;
      const uy = th.vy / sp;
      ctx.strokeStyle = `rgba(255,170,90,${0.3 * breath})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(th.x - ux * 22, th.y - uy * 22);
      ctx.lineTo(th.x, th.y);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,170,90,${0.55 * breath})`;
    ctx.beginPath();
    ctx.arc(th.x, th.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,170,90,${0.14 * breath})`;
    ctx.beginPath();
    ctx.arc(th.x, th.y, 16, 0, Math.PI * 2);
    ctx.fill();
    if (th.kind === 'ballistic' && reticleVisible(g, th)) drawReticle(th);
  }
  for (const id of seen.keys()) if (!now.has(id)) seen.delete(id);
  // Log v52: a siege battery's and a dive bomber's circles on top of the
  // dark too (their shells and bombs can't be shot down: the circle is the
  // whole warning).
  drawMarks?.();
}

/** The lighthouse on its headland: a banded tower, a gallery, the lamp room
 *  with the lens turning in it, a star of light on the lamp. `x, y` is the
 *  lamp, where the beam starts. */
function drawLighthouse(ctx: CanvasRenderingContext2D, x: number, y: number, beam: number, t: number): void {
  ctx.save();
  // The tower stands below the lamp, on the headland.
  const base = y + 40;
  ctx.fillStyle = '#d9dde0';
  ctx.strokeStyle = 'rgba(7,13,18,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 13, base);
  ctx.lineTo(x - 7, y + 8);
  ctx.lineTo(x + 7, y + 8);
  ctx.lineTo(x + 13, base);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Two red bands.
  ctx.fillStyle = '#c4413a';
  for (const [a, b] of [[0.3, 0.5], [0.72, 0.9]] as const) {
    const ya = base - (base - (y + 8)) * a;
    const yb = base - (base - (y + 8)) * b;
    const wa = 13 - 6 * a;
    const wb = 13 - 6 * b;
    ctx.beginPath();
    ctx.moveTo(x - wa, ya);
    ctx.lineTo(x - wb, yb);
    ctx.lineTo(x + wb, yb);
    ctx.lineTo(x + wa, ya);
    ctx.closePath();
    ctx.fill();
  }
  // The gallery and the lamp room.
  ctx.fillStyle = '#3a4650';
  ctx.fillRect(x - 12, y + 4, 24, 5);
  ctx.fillStyle = 'rgba(255,236,170,0.95)';
  ctx.strokeStyle = 'rgba(7,13,18,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(x - 7, y - 8, 14, 13);
  ctx.fill();
  ctx.stroke();
  // The roof.
  ctx.fillStyle = '#c4413a';
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 8);
  ctx.lineTo(x, y - 20);
  ctx.lineTo(x + 9, y - 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The lens star: rays turning with the beam, a bright heart.
  ctx.globalCompositeOperation = 'lighter';
  const pulse = 0.85 + 0.15 * Math.sin(t * 6);
  const glare = ctx.createRadialGradient(x, y - 2, 1, x, y - 2, 46 * pulse);
  glare.addColorStop(0, 'rgba(255,248,210,0.95)');
  glare.addColorStop(0.25, 'rgba(255,230,150,0.45)');
  glare.addColorStop(1, 'rgba(255,230,150,0)');
  ctx.fillStyle = glare;
  ctx.beginPath();
  ctx.arc(x, y - 2, 46 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,244,200,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const a = beam + (i * Math.PI) / 2;
    const len = i % 2 ? 22 : 38;
    ctx.beginPath();
    ctx.moveTo(x, y - 2);
    ctx.lineTo(x + Math.cos(a) * len * pulse, y - 2 + Math.sin(a) * len * pulse);
    ctx.stroke();
  }
  ctx.restore();
}

/** A special event's night (Blackout). */
export function nightEvent(g: Game): boolean {
  return !!g.event?.rules.includes('night');
}

/** Where the lighthouse beam points now (radians). It sweeps one way and back,
 *  easing a little at each end where the lamp turns round. */
export function beamAngle(g: Game): number {
  const n = g.map.night!;
  const k = (g.t % n.period) / n.period;
  const u = k < 0.5 ? k * 2 : 2 - k * 2;
  const eased = u - Math.sin(u * Math.PI * 2) * 0.05;
  return ((n.a0 + (n.a1 - n.a0) * eased) * Math.PI) / 180;
}

/** Is (x, y) inside the lighthouse beam's cone right now? */
function inBeam(g: Game, x: number, y: number): boolean {
  const n = g.map.night;
  if (!n) return false;
  const a = Math.atan2(y - n.light.y, x - n.light.x);
  let diff = a - beamAngle(g);
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) < ((n.width / 2) * Math.PI) / 180 && Math.hypot(x - n.light.x, y - n.light.y) < n.reach;
}

/** Is (x, y) in light right now? (The sea is dark: no Star Shell lights it
 *  from log v67, but a run replayed from before could still have one up.) */
export function lit(g: Game, x: number, y: number): boolean {
  const n = g.map.night;
  if ((!n && !nightEvent(g)) || g.flareT > 0) return true;
  const c = g.map.carrier;
  if (Math.hypot(x - c.x, y - c.y) < LAMP_REACH) return true;
  return inBeam(g, x, y);
}
