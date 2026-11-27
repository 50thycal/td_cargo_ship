// A big ship's end: the Dreadnought sinking. Draws only, from the 'wreck'
// effect (sim/game.ts structureDown); reads nothing of the game.
//
// Log v74 (the player, after the Dreadnought: "make an animation of the ship
// sinking so it is more satisfying for the player"). About 3 s: secondary
// explosions walk down the hull, it lists and burns under black smoke, breaks
// in two at the waist (fire in the gap), the stern goes first, the bow rears
// and follows, the sea closing over the decks, and it is gone in a splash, a
// ring of foam and a boil of bubbles over an oil slick. `Fx.size` scales it,
// so a smaller large ship can use the same wreck.

import { TURRET } from '../data/config';
import type { Fx } from '../sim/game';
import { hullPath } from './dread';

const HALF = TURRET.len / 2;
const BEAM = TURRET.beam / 2;
const RIM = '#ff7d62';
const SEA = '8,32,50';
/** Where the hull breaks: between the conning tower and the silo. */
const CUT = -38;
/** Where the fires burn, in the hull's frame. */
const FIRES: readonly (readonly [number, number])[] = [[HALF - 70, 8], [60, -10], [-10, 12], [-70, -6], [-125, 8]];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (u: number, a: number, b: number) => {
  const x = clamp01((u - a) / (b - a));
  return x * x * (3 - 2 * x);
};
/** A repeatable pseudo-random 0..1 for item `i` of stream `n`. */
const rnd = (i: number, n: number) => {
  const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

export function drawSinking(ctx: CanvasRenderingContext2D, f: Fx): void {
  const u = f.age / f.life;
  const k = f.size ?? 1;
  const head = f.rot ?? 0;
  const face = Math.cos(head) >= 0 ? 1 : -1;
  const ang = face > 0 ? head : Math.PI - head;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  // A point of the hull's frame, on the field.
  const wp = (lx: number, ly: number) => ({ x: f.x + face * k * (lx * ca - ly * sa), y: f.y + k * (lx * sa + ly * ca) });
  const list = ease(u, 0, 0.42);
  const split = ease(u, 0.26, 0.62);
  const slipS = ease(u, 0.4, 0.86);
  const slipB = ease(u, 0.52, 0.97);
  const gone = 1 - ease(u, 0.93, 1);
  const fire = ease(u, 0, 0.1) * (1 - ease(u, 0.62, 0.9));

  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(face * k, k);
  ctx.rotate(ang);

  // The oil slick spreading under it.
  ctx.fillStyle = `rgba(10,8,8,${0.3 * ease(u, 0.25, 0.7) * gone})`;
  ctx.beginPath();
  ctx.ellipse(-10, 0, HALF * (0.85 + 0.35 * u), BEAM * (1.1 + 0.7 * u), 0, 0, Math.PI * 2);
  ctx.fill();

  // The two halves, the stern then the bow: each pivots at the break.
  for (const bow of [false, true]) {
    const slip = bow ? slipB : slipS;
    ctx.save();
    ctx.globalAlpha = gone;
    ctx.translate(0, BEAM * 0.18 * list);
    ctx.scale(1 - 0.1 * slip, (1 - 0.3 * list) * (1 - 0.08 * slip));
    ctx.translate(CUT + (bow ? 38 : -46) * split, (bow ? -8 : 10) * split);
    ctx.rotate((bow ? 0.17 : -0.21) * split);
    ctx.translate(-CUT, 0);
    ctx.beginPath();
    if (bow) ctx.rect(CUT, -BEAM - 30, HALF + 60 - CUT, BEAM * 2 + 60);
    else ctx.rect(-HALF - 60, -BEAM - 30, HALF + 60 + CUT, BEAM * 2 + 60);
    ctx.clip();
    // The hull, and its deck.
    hullPath(ctx);
    const steel = ctx.createLinearGradient(0, -BEAM, 0, BEAM);
    steel.addColorStop(0, '#4a3531');
    steel.addColorStop(0.5, '#68514b');
    steel.addColorStop(1, '#3e2b28');
    ctx.fillStyle = steel;
    ctx.fill();
    ctx.strokeStyle = RIM;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.save();
    ctx.scale(0.93, 0.8);
    hullPath(ctx);
    ctx.fillStyle = '#7d6a64';
    ctx.fill();
    ctx.restore();
    // Scorch spreading over the deck, and the bilge showing on the low side
    // as she lists.
    ctx.save();
    hullPath(ctx);
    ctx.clip();
    ctx.fillStyle = `rgba(20,10,8,${0.5 * ease(u, 0.05, 0.35)})`;
    ctx.fillRect(-HALF, -BEAM, HALF * 2, BEAM * 2);
    ctx.fillStyle = `rgba(38,16,12,${0.9 * list})`;
    ctx.fillRect(-HALF, BEAM * 0.55, HALF * 2, BEAM);
    ctx.restore();
    ctx.strokeStyle = 'rgba(40,26,23,0.35)';
    ctx.lineWidth = 1.5;
    for (let x = -HALF + 30; x < HALF - 40; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, -BEAM * 0.72);
      ctx.lineTo(x, BEAM * 0.72);
      ctx.stroke();
    }
    // Turret rings, the silo and the tower: dead, dark.
    ctx.fillStyle = '#241a17';
    ctx.strokeStyle = 'rgba(255,125,98,0.6)';
    ctx.lineWidth = 3;
    for (const x of TURRET.slots) {
      ctx.beginPath();
      ctx.arc(x, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.roundRect(TURRET.silo - 24, -19, 48, 38, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#58443f';
    ctx.strokeStyle = RIM;
    ctx.beginPath();
    ctx.roundRect(-34, -15, 52, 30, 7);
    ctx.fill();
    ctx.stroke();
    // Flames on the deck, flickering.
    for (let i = 0; i < FIRES.length; i++) {
      const [fx, fy] = FIRES[i];
      if (fx > CUT !== bow || fire <= 0) continue;
      const fl = 0.65 + 0.35 * Math.sin(u * 90 + i * 2.1);
      const r = (14 + 12 * rnd(i, 1)) * fire * (0.8 + 0.4 * fl);
      const gl = ctx.createRadialGradient(fx, fy, 1, fx, fy, r * 1.8);
      gl.addColorStop(0, `rgba(255,236,150,${0.95 * fire})`);
      gl.addColorStop(0.4, `rgba(255,140,50,${0.8 * fire})`);
      gl.addColorStop(1, 'rgba(200,50,20,0)');
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.arc(fx, fy, r * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // The sea closing over her: from the broken end for the bow, from the
    // stern for the stern.
    if (slip > 0) {
      const a = bow ? CUT : -HALF - 40;
      const b = bow ? HALF + 40 : CUT;
      const reach = Math.min(1, slip * 1.15);
      const front = bow ? a + (b - a) * reach : b - (b - a) * reach;
      const w = ctx.createLinearGradient(front, 0, bow ? front - 70 : front + 70, 0);
      w.addColorStop(0, `rgba(${SEA},0)`);
      w.addColorStop(1, `rgba(${SEA},0.96)`);
      ctx.fillStyle = w;
      ctx.fillRect(-HALF - 60, -BEAM - 30, HALF * 2 + 120, BEAM * 2 + 60);
      // The edge of it: a line of foam.
      ctx.strokeStyle = `rgba(235,248,255,${0.7 * (1 - slip * 0.5)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(front, -BEAM);
      ctx.bezierCurveTo(front + 8, -BEAM * 0.4, front - 8, BEAM * 0.4, front, BEAM);
      ctx.stroke();
    }
    ctx.restore();
  }

  // The break: fire and steam in the gap.
  if (split > 0) {
    const flick = 0.7 + 0.3 * Math.sin(u * 80);
    const gap = ctx.createRadialGradient(CUT, 0, 2, CUT, 0, 46);
    gap.addColorStop(0, `rgba(255,220,120,${0.9 * split * (1 - slipS) * flick})`);
    gap.addColorStop(0.5, `rgba(255,110,40,${0.5 * split * (1 - slipS)})`);
    gap.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = gap;
    ctx.beginPath();
    ctx.arc(CUT, 0, 46, 0, Math.PI * 2);
    ctx.fill();
  }

  // The first blasts, one after another down the hull.
  for (let i = 0; i < FIRES.length; i++) {
    const s = (u - i * 0.028) / 0.13;
    if (s < 0 || s > 1) continue;
    const [bx, by] = FIRES[(i * 2) % FIRES.length];
    const r = 26 + 54 * s;
    const bl = ctx.createRadialGradient(bx, by, 2, bx, by, r);
    bl.addColorStop(0, `rgba(255,252,225,${1 - s})`);
    bl.addColorStop(0.4, `rgba(255,170,70,${0.85 * (1 - s)})`);
    bl.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = bl;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // The foam and the bubbles where she went down.
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const v = (u - 0.42 - i * 0.12) / 0.5;
    if (v < 0 || v > 1) continue;
    ctx.strokeStyle = `rgba(235,248,255,${0.6 * (1 - v)})`;
    ctx.beginPath();
    ctx.ellipse(-10, 0, HALF * (0.55 + 0.55 * v), BEAM * (0.9 + 1.4 * v), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.lineWidth = 2;
  for (let i = 0; i < 22; i++) {
    const v = (u - (0.5 + 0.36 * rnd(i, 3))) / 0.22;
    if (v < 0 || v > 1) continue;
    const bx = -HALF * 0.9 + HALF * 1.8 * rnd(i, 1);
    const by = (rnd(i, 2) - 0.5) * BEAM * 1.7 - v * 12;
    ctx.strokeStyle = `rgba(225,245,255,${0.85 * (1 - v)})`;
    ctx.beginPath();
    ctx.arc(bx, by, (2.5 + 4 * rnd(i, 4)) * (1 + v * 0.6), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Smoke, straight up the field from the fires (it does not turn with the
  // hull), thick and black at first.
  const smokeA = ease(u, 0.02, 0.2) * (1 - ease(u, 0.78, 1));
  if (smokeA > 0) {
    FIRES.forEach(([fx, fy], i) => {
      const o = wp(fx, fy);
      for (let j = 0; j < 5; j++) {
        const v = (j / 5 + u * 1.8 + i * 0.17) % 1;
        ctx.fillStyle = `rgba(44,40,40,${0.6 * (1 - v) * smokeA})`;
        ctx.beginPath();
        ctx.arc(o.x - v * 46 * k + Math.sin(v * 5 + i) * 6, o.y - v * 120 * k, (9 + v * 30) * k, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  // The splashes: the stern as it goes, the bow's the last of her.
  const splash = (lx: number, a: number, b: number, big: number) => {
    const s = (u - a) / (b - a);
    if (s < 0 || s > 1) return;
    const o = wp(lx, 0);
    ctx.strokeStyle = `rgba(255,255,255,${0.85 * (1 - s)})`;
    ctx.lineWidth = 5 * (1 - s) + 1;
    ctx.beginPath();
    ctx.ellipse(o.x, o.y, (22 + 78 * s) * big * k, (16 + 56 * s) * big * k, 0, 0, Math.PI * 2);
    ctx.stroke();
    // A plume rising and falling, and the drops thrown out.
    const rise = Math.sin(Math.min(1, s * 1.4) * Math.PI);
    ctx.fillStyle = `rgba(240,250,255,${0.8 * (1 - s)})`;
    ctx.beginPath();
    ctx.ellipse(o.x, o.y - rise * 34 * big * k, 14 * big * k * (1 - s * 0.5), (10 + 40 * rise) * big * k, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 14; i++) {
      const a2 = (i / 14) * Math.PI * 2 + rnd(i, 7);
      const d = s * (46 + 50 * rnd(i, 8)) * big * k;
      ctx.fillStyle = `rgba(245,252,255,${0.9 * (1 - s)})`;
      ctx.beginPath();
      ctx.arc(o.x + Math.cos(a2) * d, o.y + Math.sin(a2) * d * 0.7 - Math.sin(s * Math.PI) * 30 * big * k, (3.5 - 2 * s) * k, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  splash(-HALF * 0.55, 0.6, 0.88, 0.8);
  splash(HALF * 0.25, 0.8, 1, 1.15);
}
