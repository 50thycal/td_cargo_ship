// Geometry helpers for the V3 maps plan (docs/design/v3-maps-plan.md).
// The first four are copies of the private helpers in src/v3/data/maps.ts, so
// a proposed layout's land can be pasted into maps.ts as it is. The rest are
// new: Catmull-Rom smoothing, offsets along a path (curved banks and lanes),
// and resampling. Nothing here is game code.

import type { Point } from '../../../src/v3/data/maps';

export const W = 1600;
export const H = 900;

/** A wavy coastline from x=0 to x=W, closed off against the top or bottom edge (maps.ts). */
export function shore(edge: 'top' | 'bottom', y: number, amp: number, phase: number): Point[] {
  const pts: Point[] = [];
  for (let x = 0; x <= W; x += 50) {
    const wobble = Math.sin(x / 210 + phase) * amp + Math.sin(x / 83 + phase * 2.3) * amp * 0.35;
    pts.push({ x, y: Math.round(y + wobble) });
  }
  const capY = edge === 'top' ? 0 : H;
  return [{ x: 0, y: capY }, ...pts, { x: W, y: capY }];
}

/** An island shaped like a lens (maps.ts). */
export function lens(x0: number, x1: number, cy: number, half: number): Point[] {
  const top: Point[] = [];
  const bottom: Point[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = x0 + (x1 - x0) * u;
    const h = half * Math.sin(Math.PI * u) ** 0.7;
    const ripple = Math.sin(u * 17) * 6;
    top.push({ x, y: cy - h + ripple });
    bottom.push({ x, y: cy + h - ripple * 0.6 });
  }
  return [...top, ...bottom.reverse()];
}

/** A round islet (maps.ts). */
export function islet(cx: number, cy: number, r: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rr = r * (1 + Math.sin(i * 2.1) * 0.12);
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  return pts;
}

/** A wavy line from (x0, y0) to (x1, y1) (maps.ts). */
export function curve(x0: number, y0: number, x1: number, y1: number, phase: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const x = x0 + (x1 - x0) * u;
    pts.push({ x, y: Math.round(y0 + (y1 - y0) * u + Math.sin(u * 9 + phase) * 10) });
  }
  return pts;
}

/** Round 13's truck-road detour round bases (maps.ts `bypass`). */
const CLEAR = 54;
const REACH = 120;
export function bypass(path: Point[], bases: { x: number; y: number }[], inland: -1 | 1): Point[] {
  const at = (x: number): number => {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      if ((x - a.x) * (x - b.x) <= 0 && a.x !== b.x) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    }
    return path[x < path[0].x === path[0].x < path[path.length - 1].x ? 0 : path.length - 1].y;
  };
  const x0 = path[0].x;
  const x1 = path[path.length - 1].x;
  const out: Point[] = [];
  const n = Math.ceil(Math.abs(x1 - x0) / 20);
  for (let k = 0; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n;
    let y = at(x);
    for (const b of bases) {
      const dx = Math.abs(x - b.x);
      if (dx >= REACH) continue;
      const need = -inland * (y - (b.y + inland * CLEAR));
      if (need <= 0) continue;
      const bump = 0.5 + 0.5 * Math.cos((Math.PI * dx) / REACH);
      y += inland * need * bump;
    }
    out.push({ x: Math.round(x), y: Math.round(Math.max(20, Math.min(880, y))) });
  }
  return out;
}

const r1 = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });

/** A smooth curve through control points (centripetal-ish Catmull-Rom). */
export function smooth(ctrl: Point[], seg = 10): Point[] {
  if (ctrl.length < 3) return ctrl.map(r1);
  const out: Point[] = [];
  const P = (i: number) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      out.push(r1({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      }));
    }
  }
  out.push(r1(ctrl[ctrl.length - 1]));
  return out;
}

/** Points on a circle (degrees, y down: 90 = straight down, 0 = right). */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 24): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push(r1({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }));
  }
  return out;
}

/** A gentle irregularity along a line, so coasts don't look ruled. */
export function rough(pts: Point[], amp: number, phase: number): Point[] {
  return pts.map((p, i) => r1({ x: p.x + Math.sin(i * 1.7 + phase) * amp * 0.5, y: p.y + Math.sin(i * 0.9 + phase * 2) * amp }));
}

/** Unit tangent at each point of a polyline. */
export function tangents(path: Point[]): Point[] {
  return path.map((_, i) => {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  });
}

/** The line `d(i)` to the RIGHT of the direction of travel (negative: left).
 *  Heading east, right is south (y grows down). */
export function offset(path: Point[], d: number | ((i: number, p: Point) => number)): Point[] {
  const t = tangents(path);
  return path.map((p, i) => {
    const k = typeof d === 'number' ? d : d(i, p);
    return r1({ x: p.x - t[i].y * k, y: p.y + t[i].x * k });
  });
}

/** Evenly spaced points along a polyline. */
export function resample(path: Point[], step: number): Point[] {
  const out: Point[] = [path[0]];
  let carry = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let s = step - carry;
    while (s <= len) {
      const u = s / len;
      out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
      s += step;
    }
    carry = len - (s - step);
  }
  const last = path[path.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > step * 0.3) out.push(last);
  return out;
}

export function pathLength(path: Point[]): number {
  let l = 0;
  for (let i = 1; i < path.length; i++) l += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return l;
}
