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

// ---------------------------------------------------------------------------
// Flight paths: where an aircraft flies along a lane (playtest: "Plane
// turned for the bomber was not smooth").
//
// A bomber flies beside the lane, `lat` off its centre. Offset that far from
// a polyline, the path doubles back on itself on the inside of a sharp bend
// and leaves a gap on the outside, and every corner is a kink. A plane can't
// fly that. Its flight path is the offset path with the doubled-back stretch
// dropped and the corners rounded off, kept in the lane's own distance `d`
// so everything that reads a plane's place along its lane still agrees.

const FLIGHT_STEP = 8;
/** Before the lane's start and past its end (planes enter and leave off screen). */
const FLIGHT_PAD = 400;
/** Rounding: a moving average over this many samples each side, twice. */
const FLIGHT_SMOOTH = 7;

interface FlightPath {
  d0: number;
  xs: Float64Array;
  ys: Float64Array;
}

const flights = new WeakMap<Channel, Map<number, FlightPath>>();

function flightPath(ch: Channel, lat: number): FlightPath {
  let byLat = flights.get(ch);
  if (!byLat) flights.set(ch, (byLat = new Map()));
  const hit = byLat.get(lat);
  if (hit) return hit;
  const d0 = -FLIGHT_PAD;
  const n = Math.ceil((laneLength(ch) + 2 * FLIGHT_PAD) / FLIGHT_STEP) + 1;
  let xs = new Float64Array(n);
  let ys = new Float64Array(n);
  const keep: boolean[] = [];
  let lx = 0;
  let ly = 0;
  for (let i = 0; i < n; i++) {
    const p = laneAt(ch, d0 + i * FLIGHT_STEP, lat);
    xs[i] = p.x;
    ys[i] = p.y;
    // Doubling back (the inside of a bend): this sample is behind the last
    // one kept, measured along the lane's heading here.
    const ok = i === 0 || (p.x - lx) * p.tx + (p.y - ly) * p.ty > 0.5;
    keep.push(ok);
    if (ok) {
      lx = p.x;
      ly = p.y;
    }
  }
  // Dropped samples: spread evenly between the kept ones either side.
  for (let i = 0; i < n; i++) {
    if (keep[i]) continue;
    let a = i - 1;
    while (a > 0 && !keep[a]) a--;
    let b = i + 1;
    while (b < n - 1 && !keep[b]) b++;
    const u = (i - a) / Math.max(1, b - a);
    xs[i] = xs[a] + (xs[b] - xs[a]) * u;
    ys[i] = ys[a] + (ys[b] - ys[a]) * u;
  }
  for (let pass = 0; pass < 2; pass++) {
    const nx = new Float64Array(n);
    const ny = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sx = 0;
      let sy = 0;
      let c = 0;
      for (let k = Math.max(0, i - FLIGHT_SMOOTH); k <= Math.min(n - 1, i + FLIGHT_SMOOTH); k++) {
        sx += xs[k];
        sy += ys[k];
        c++;
      }
      nx[i] = sx / c;
      ny[i] = sy / c;
    }
    xs = nx;
    ys = ny;
  }
  const f = { d0, xs, ys };
  byLat.set(lat, f);
  return f;
}

/** Where a plane flying `lat` off the lane is at lane distance d, and its
 *  heading there: a smooth, loop-free version of laneAt. */
export function flightAt(ch: Channel, d: number, lat: number): LanePose {
  const f = flightPath(ch, lat);
  const n = f.xs.length;
  const u = Math.max(0, Math.min(n - 1.001, (d - f.d0) / FLIGHT_STEP));
  const i = Math.floor(u);
  const k = u - i;
  const x = f.xs[i] + (f.xs[i + 1] - f.xs[i]) * k;
  const y = f.ys[i] + (f.ys[i + 1] - f.ys[i]) * k;
  // Heading from a few samples either side (the path is smooth there).
  const a = Math.max(0, i - 2);
  const b = Math.min(n - 1, i + 3);
  let tx = f.xs[b] - f.xs[a];
  let ty = f.ys[b] - f.ys[a];
  const len = Math.hypot(tx, ty);
  if (len < 1e-6) {
    const p = lanePoint(ch, d);
    tx = p.tx;
    ty = p.ty;
  } else {
    tx /= len;
    ty /= len;
  }
  // Past either end the lane carries straight on: so does the flight.
  if (d - f.d0 < 0 || d - f.d0 > (n - 1) * FLIGHT_STEP) {
    const p = laneAt(ch, d, lat);
    return p;
  }
  return { x, y, tx, ty };
}
