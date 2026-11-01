// Lanes as paths (the 20-map plan's path lanes). A ship sits at a distance
// `d` along its lane's centre line and an offset `lat` across it (positive to
// the right of the way it sails; heading east, that is south). A lane without
// a path runs straight along its y from x = -40 to x = 1640, so there d is
// x + 40 and lat is y − lane y: exactly the old straight channels.

import { halfWidthAt, type Channel, type Point } from '../data/maps';

interface LaneGeo {
  pts: Point[];
  /** Distance along the path at each point. */
  cum: number[];
  length: number;
}

const cache = new WeakMap<Channel, LaneGeo>();

function geo(ch: Channel): LaneGeo {
  let g = cache.get(ch);
  if (g) return g;
  const pts = ch.path ?? [
    { x: -40, y: ch.y },
    { x: 1640, y: ch.y },
  ];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  g = { pts, cum, length: cum[cum.length - 1] };
  cache.set(ch, g);
  return g;
}

export function laneLength(ch: Channel): number {
  return geo(ch).length;
}

export interface LanePose {
  x: number;
  y: number;
  /** Unit tangent (the way ships sail). */
  tx: number;
  ty: number;
}

/** The point `d` along the lane and its heading. Before the start and past
 *  the end it carries on along the first and last stretch. */
export function lanePoint(ch: Channel, d: number): LanePose {
  const { pts, cum, length } = geo(ch);
  let i = 1;
  if (d >= length) i = pts.length - 1;
  else if (d > 0) while (i < pts.length - 1 && cum[i] < d) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const tx = (b.x - a.x) / seg;
  const ty = (b.y - a.y) / seg;
  const u = d - cum[i - 1];
  return { x: a.x + tx * u, y: a.y + ty * u, tx, ty };
}

/** A position `lat` across the lane at distance d. */
export function laneAt(ch: Channel, d: number, lat: number): LanePose {
  const p = lanePoint(ch, d);
  return { x: p.x - p.ty * lat, y: p.y + p.tx * lat, tx: p.tx, ty: p.ty };
}

/** The lane's half-width at distance d (widths and funnels go by x). */
export function laneHalfWidth(ch: Channel, d: number): number {
  return halfWidthAt(ch, lanePoint(ch, d).x);
}

/** Distance along the lane where it first reaches x (lanes that cross x),
 *  else null. Locks and stations are placed by x. */
export function laneDAtX(ch: Channel, x: number): number | null {
  const { pts, cum } = geo(ch);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if ((x - a.x) * (x - b.x) <= 0 && a.x !== b.x) return cum[i - 1] + ((cum[i] - cum[i - 1]) * (x - a.x)) / (b.x - a.x);
  }
  return null;
}

/** The lane's centre y where it crosses x (its own y if it doesn't). */
export function laneYAtX(ch: Channel, x: number): number {
  const d = laneDAtX(ch, x);
  return d === null ? ch.y : lanePoint(ch, d).y;
}

/** Points along the centre line every `step` (for drawing), with the
 *  half-width at each. */
export function laneSamples(ch: Channel, step: number): { p: LanePose; hw: number }[] {
  const L = laneLength(ch);
  const out: { p: LanePose; hw: number }[] = [];
  const n = Math.max(2, Math.ceil(L / step));
  for (let k = 0; k <= n; k++) {
    const p = lanePoint(ch, (L * k) / n);
    out.push({ p, hw: halfWidthAt(ch, p.x) });
  }
  return out;
}
