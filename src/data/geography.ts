// THE WATER A REGION IS FOUGHT IN.
//
// Until now the map was one shape: two straight coastlines from `WORLD` with
// three straight lanes between them, and every system that cared about where
// the land was read those constants directly. That made the strait a property
// of the BUILD rather than of the region, which is the one thing stopping a
// region from being more than a different enemy menu.
//
// A Geography is that shape, made data. It answers, for any x along the map:
// where is each coast, where is the navigable water, where does each lane run,
// where do the enemy's emplacements sit, and where does the player's shore
// battery line run. Regions name one; the sim asks it rather than asking
// `WORLD`.
//
// See docs/design/map-topology.md for what this is FOR — the short version is
// that shore-to-lane distance and channel width are the two numbers that decide
// a fight, and both of them are geography. A coastal gun reaches `y ≤ 1525`
// from the launch line, which is the north lane and nothing else; move the
// shore 400 units south and the same gun — same range, same cost, same
// everything — covers two of them. That is the whole point of this
// module: regions get to be hard in different ways WITHOUT any weapon being
// rebalanced per region, which `regions.ts` forbids and should keep forbidding.
// (The `squeeze` below does exactly that, and its own comment carries the
// before-and-after figures.)
//
// AUTHORING NOTE. Every profile below is a polyline sampled across x, and a
// ONE-POINT polyline is a constant. The default `STRAIT` is authored entirely
// from one-point polylines built out of the existing `WORLD` numbers, so it
// returns exactly the values the hard-coded constants did — not
// approximately, exactly. That is deliberate: this refactor is meant to change
// where the numbers come from and nothing else.

import { COMBAT, WORLD } from './tuning';

export type GeographyId = string;

export interface GeoPoint {
  x: number;
  y: number;
}

/** A LANDMASS INSIDE THE WATER.
 *
 *  The two shore profiles describe where the water ENDS; they cannot describe
 *  land with water on both sides of it, which is the one thing an island is.
 *  So terrain is its own typed feature, and — this is the part that matters —
 *  it is the SAME definition the renderer, the lane builder, the validator,
 *  the hull clamp, boat steering and the torpedo run all read. An island
 *  drawn by the renderer alone would be scenery that ships sail through.
 *
 *  Parametric rather than a free polygon, deliberately. Every profile in this
 *  file is a function of x, and the whole sim asks its questions that way
 *  ("where is the water at this x"). A lens — two edges, thickest amidships,
 *  tapering to a point at each tip — is the shape that answers those questions
 *  with no new machinery, and it is a perfectly good island. A general polygon
 *  would need its own containment and crossing tests and would let an author
 *  draw something the lane builder cannot route around; that is the freehand
 *  editor the design doc explicitly rules out of this pass. */
export interface IslandDef {
  id: string;
  name: string;
  /** Western and eastern tips. The land tapers to nothing at both. */
  fromX: number;
  toX: number;
  /** North-south centre of the landmass. */
  centerY: number;
  /** Half-height amidships — the island is `2 x halfHeight` at its widest. */
  halfHeight: number;
  /** Amplitude of the DRAWN meander around the island's edges, exactly the
   *  role `shoreWave` plays for the coasts. Anything that must stay off the
   *  land has to clear it. */
  wave: number;
}

/** An enemy emplacement site along the hostile shore. */
export interface LaunchSiteDef {
  x: number;
  /** Extra distance inland beyond the geography's `launchInset`, so the sites
   *  are not a perfectly straight rank of identical markers. */
  extraInset?: number;
}

/** The authored shape of a region's water. */
export interface GeographyDef {
  id: GeographyId;
  name: string;
  /** Mean line of the hostile (north) coast, west to east. */
  hostileShore: readonly GeoPoint[];
  /** Mean line of the friendly (south) coast, west to east. */
  friendlyShore: readonly GeoPoint[];
  /** Amplitude of the DRAWN meander either side of each mean line. Anything
   *  that must sit on land, or stay off it, has to clear this. */
  shoreWave: number;
  /** Lane centre lines, ordered NORTH TO SOUTH. Lane 0 is the near lane — the
   *  dangerous one — and that ordering is load-bearing (see `validate`). */
  lanes: readonly (readonly GeoPoint[])[];
  /** How far inland of the hostile shore's mean line the enemy's launch line
   *  runs. Missiles, torpedoes and boats all put to sea from it. */
  launchInset: number;
  /** How far inland of the friendly shore's mean line the player's shore
   *  batteries sit. */
  baseInset: number;
  launchSites: readonly LaunchSiteDef[];
  /** Landmasses inside the navigable water. Absent on every map whose story is
   *  told by its coastlines alone, and absent means absent: an island-free
   *  geography answers every question below exactly as it did before terrain
   *  existed. */
  islands?: readonly IslandDef[];
}

/** A resolved geography: the questions the sim actually asks, answered for any
 *  x along the map. */
export interface Geography {
  readonly id: GeographyId;
  readonly name: string;
  readonly shoreWave: number;
  readonly laneCount: number;
  /** Enemy emplacement sites, resolved against the shore profile. */
  readonly launchSites: readonly GeoPoint[];

  /** Mean line of each coast (the line the drawn meander oscillates around). */
  hostileShoreY(x: number): number;
  friendlyShoreY(x: number): number;

  /** Landmasses inside the water (empty on a map without any). */
  readonly islands: readonly IslandDef[];

  /** THE OUTER EDGES of the navigable water at this x — the shore-to-shore
   *  envelope. Clears the drawn meander, so a hull held between these is off
   *  both beaches at every point along the strait.
   *
   *  On a map WITH an island these are still the outer edges and no longer the
   *  whole story: the water between them is cut into channels. Anything asking
   *  "may this hull be here" must ask `inWater`/`clampWater`, which know about
   *  the land in the middle; these two remain the right question only for the
   *  envelope itself. */
  waterTop(x: number): number;
  waterBottom(x: number): number;

  /** The navigable channels at this x, north to south. One interval on an
   *  open map; one per gap either side of the land where an island bites. */
  channels(x: number): { top: number; bottom: number }[];

  /** Is this point navigable water for a SURFACE unit — inside the envelope
   *  and not on an island? */
  inWater(x: number, y: number): boolean;

  /** Is this point LAND — either shore, or an island? Measured against the
   *  DRAWN edges rather than the navigable ones, so this answers "is it
   *  aground", not "is it too close". */
  isLand(x: number, y: number): boolean;

  /** Hold a surface point in navigable water, keeping it in the channel it is
   *  already in (or nearest to). The island-aware replacement for clamping
   *  between `waterTop` and `waterBottom`. */
  clampWater(x: number, y: number): number;

  /** Does the straight segment from A to B pass over land? What a torpedo run
   *  and a lane check both need, and the reason an island shelters the water
   *  behind it rather than merely decorating it. */
  crossesLand(ax: number, ay: number, bx: number, by: number): boolean;

  /** The same band for AIRCRAFT, which are allowed closer to the beach than a
   *  hull is — a strafing run over the surf is fine, a cargo ship on it is not. */
  airWaterTop(x: number): number;
  airWaterBottom(x: number): number;

  /** Centre of a lane at this x. */
  laneY(lane: number, x: number): number;
  /** Distance travelled ALONG a lane, from the western edge of the map to x.
   *
   *  Progress is measured in x everywhere else in the sim, which is right for
   *  "has she crossed the line yet" and wrong for "is she behind schedule": a
   *  hull following a bend covers more water than her easting suggests, and
   *  judged on easting alone she reads as a straggler for sailing normally.
   *  On a straight lane this returns x, exactly. */
  laneDistance(lane: number, x: number): number;
  clampLane(lane: number): number;
  /** Index of the lane running nearest this point — how a tap becomes a lane. */
  nearestLane(x: number, y: number): number;

  /** The enemy's launch line, and the player's shore-battery line. */
  launchY(x: number): number;
  baseY(x: number): number;
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

/** Sample a profile at x.
 *
 *  SMOOTHSTEP between control points rather than straight linear interpolation.
 *  A coastline built from linear segments has visible corners, and a lane built
 *  from them hands the steering loop an abrupt change of slope at every control
 *  point — a hull would flick its helm crossing one. Smoothstep is flat at each
 *  control point and eases between them, so a bulge can be authored as three
 *  points ("baseline, peak, baseline") and come out as a curve.
 *
 *  TWO EXACTNESS GUARANTEES, both relied on by the default STRAIT:
 *   • a one-point profile returns that point's y with no arithmetic at all;
 *   • a segment whose ends share a y returns that y, likewise untouched.
 *  So a flat geography is bit-for-bit the constant it replaced, and this
 *  refactor cannot move a hull by a floating-point hair. */
function sample(points: readonly GeoPoint[], x: number): number {
  const n = points.length;
  if (n === 1) return points[0].y;
  if (x <= points[0].x) return points[0].y;
  if (x >= points[n - 1].x) return points[n - 1].y;
  let i = 0;
  while (i < n - 2 && x > points[i + 1].x) i++;
  const a = points[i];
  const b = points[i + 1];
  if (a.y === b.y) return a.y;
  const span = b.x - a.x;
  if (span <= 0) return b.y;
  const t = (x - a.x) / span;
  return a.y + (b.y - a.y) * (t * t * (3 - 2 * t));
}

/** A profile that is the same everywhere. */
export function flat(y: number): readonly GeoPoint[] {
  return [{ x: 0, y }];
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

function clampTo(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** How much clear water a HULL keeps off the drawn coastline. */
const hullClearance = COMBAT.shoreClearance;

/** How much an AIRCRAFT keeps. Smaller: a run-in may cross the surf line, and
 *  the A-10's whole job is working the water close to the hostile beach. */
const airClearance = 15;

/** Half-height of an island at x: a lens, thickest amidships and tapering to a
 *  point at each tip. Zero outside its span. */
export function islandHalfHeight(island: IslandDef, x: number): number {
  const halfLen = (island.toX - island.fromX) / 2;
  if (halfLen <= 0) return 0;
  const u = (x - (island.fromX + halfLen)) / halfLen;
  if (u <= -1 || u >= 1) return 0;
  return island.halfHeight * Math.sqrt(1 - u * u);
}

export function makeGeography(def: GeographyDef): Geography {
  const hostileShoreY = (x: number): number => sample(def.hostileShore, x);
  const friendlyShoreY = (x: number): number => sample(def.friendlyShore, x);
  const launchY = (x: number): number => hostileShoreY(x) - def.launchInset;
  const laneCount = def.lanes.length;

  const launchSites: GeoPoint[] = def.launchSites.map((site) => ({
    x: site.x,
    y: launchY(site.x) - (site.extraInset ?? 0),
  }));

  const clampLane = (lane: number): number => Math.max(0, Math.min(laneCount - 1, lane));
  const laneY = (lane: number, x: number): number => sample(def.lanes[clampLane(lane)], x);

  // Cumulative distance ALONG each lane, tabulated once. A straight lane's
  // table is 0, step, 2*step, ... so the lookup below returns x untouched and
  // nothing that reads it can tell this was ever added.
  const ARC_STEPS = 200;
  const arcStep = WORLD.width / ARC_STEPS;
  const arcs: number[][] = def.lanes.map((_, lane) => {
    const table = [0];
    for (let i = 1; i <= ARC_STEPS; i++) {
      const x0 = arcStep * (i - 1);
      const x1 = arcStep * i;
      const dy = laneY(lane, x1) - laneY(lane, x0);
      table.push(table[i - 1] + (dy === 0 ? arcStep : Math.hypot(arcStep, dy)));
    }
    return table;
  });
  const laneDistance = (lane: number, x: number): number => {
    const table = arcs[clampLane(lane)];
    if (x <= 0) return x;
    if (x >= WORLD.width) return table[ARC_STEPS] + (x - WORLD.width);
    const i = Math.min(ARC_STEPS - 1, Math.floor(x / arcStep));
    const t = (x - arcStep * i) / arcStep;
    return table[i] + (table[i + 1] - table[i]) * t;
  };

  const islands = def.islands ?? [];

  const waterTop = (x: number): number => hostileShoreY(x) + def.shoreWave + hullClearance;
  const waterBottom = (x: number): number => friendlyShoreY(x) - def.shoreWave - hullClearance;

  /** The water an island DENIES at this x: its drawn extent plus the clearance
   *  a hull keeps off any beach. Null where the island is not. */
  const islandBlock = (island: IslandDef, x: number): { top: number; bottom: number } | null => {
    const h = islandHalfHeight(island, x);
    if (h <= 0) return null;
    return {
      top: island.centerY - h - island.wave - hullClearance,
      bottom: island.centerY + h + island.wave + hullClearance,
    };
  };

  /** Cut the envelope into channels. On a map with no islands this returns the
   *  envelope itself, allocation and all — so an island-free geography answers
   *  exactly what it always did. */
  const channels = (x: number): { top: number; bottom: number }[] => {
    const top = waterTop(x);
    const bottom = waterBottom(x);
    if (islands.length === 0) return [{ top, bottom }];
    const blocks = islands
      .map((i) => islandBlock(i, x))
      .filter((b): b is { top: number; bottom: number } => b !== null)
      .sort((a, b) => a.top - b.top);
    if (blocks.length === 0) return [{ top, bottom }];
    const out: { top: number; bottom: number }[] = [];
    let cursor = top;
    for (const block of blocks) {
      if (block.top > cursor) out.push({ top: cursor, bottom: Math.min(block.top, bottom) });
      cursor = Math.max(cursor, block.bottom);
    }
    if (cursor < bottom) out.push({ top: cursor, bottom });
    // A channel narrower than a hull is not a channel. Dropping it here means
    // "nearest channel" can never pick a gap nothing fits through.
    return out.filter((c) => c.bottom - c.top >= hullClearance * 2);
  };

  return {
    id: def.id,
    name: def.name,
    shoreWave: def.shoreWave,
    laneCount,
    launchSites,
    islands,
    hostileShoreY,
    friendlyShoreY,
    waterTop,
    waterBottom,
    channels,
    inWater: (x, y) => channels(x).some((c) => y >= c.top && y <= c.bottom),
    isLand: (x, y) => {
      if (y <= hostileShoreY(x) + def.shoreWave) return true;
      if (y >= friendlyShoreY(x) - def.shoreWave) return true;
      return islands.some((island) => {
        const h = islandHalfHeight(island, x);
        return h > 0 && Math.abs(y - island.centerY) <= h + island.wave;
      });
    },
    clampWater: (x, y) => {
      const cs = channels(x);
      if (cs.length === 0) return clampTo(y, waterTop(x), waterBottom(x));
      // The channel this point is ALREADY in wins outright — a hull nudged
      // against the island must not be flicked to the far side of it.
      for (const c of cs) if (y >= c.top && y <= c.bottom) return y;
      let best = cs[0];
      let bestD = Infinity;
      for (const c of cs) {
        const d = y < c.top ? c.top - y : y - c.bottom;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      return clampTo(y, best.top, best.bottom);
    },
    crossesLand: (ax, ay, bx, by) => {
      const len = Math.hypot(bx - ax, by - ay);
      // Sampled, at a spacing well inside the smallest feature a geography can
      // author. A tip taper is the thinnest thing on the map and it is still
      // tens of units across; 8 cannot step over one.
      const steps = Math.max(2, Math.ceil(len / 8));
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const x = ax + (bx - ax) * f;
        const y = ay + (by - ay) * f;
        if (y <= hostileShoreY(x) + def.shoreWave) return true;
        if (y >= friendlyShoreY(x) - def.shoreWave) return true;
        for (const island of islands) {
          const h = islandHalfHeight(island, x);
          if (h > 0 && Math.abs(y - island.centerY) <= h + island.wave) return true;
        }
      }
      return false;
    },
    airWaterTop: (x) => hostileShoreY(x) + def.shoreWave + airClearance,
    airWaterBottom: (x) => friendlyShoreY(x) - def.shoreWave - airClearance,
    laneY,
    laneDistance,
    clampLane,
    nearestLane: (x, y) => {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < laneCount; i++) {
        const d = Math.abs(laneY(i, x) - y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    },
    launchY,
    baseY: (x) => friendlyShoreY(x) + def.baseInset,
  };
}

// ---------------------------------------------------------------------------
// Authoring helpers
// ---------------------------------------------------------------------------

// Two ways to lay lanes on curved water. They are NOT interchangeable, and
// which one a region picks is a design decision, not a formatting one.
//
//   lanesAcross  — the lanes hold their PROPORTIONS. Where the water narrows
//                  they all close up together, keeping their spacing even.
//   lanesPressed — the lanes hold their POSITIONS, and give ground only where
//                  the land actually reaches them.
//
// The difference is large enough to decide whether a region is interesting.
// Spread proportionally across a coast that bulges 400 units, the near lane and
// the centre lane BOTH slide away from the gun line as the water narrows, and a
// bulge that ought to be terrifying gives back most of what it took: measured
// on the squeeze, the centre lane's warning fell from 11.7 s only to 8.3 s.
// Pressed, the near lane is shoved into the middle of the channel and the
// centre lane has to give way to it, so the two crowd together in exactly the
// water the guns cover — 11.7 s down to 6.5 s on the centre lane, and 7.0 s
// down to 5.0 s on the near one. Same coastline; the lane rule is what decides
// whether the geography bites.
//
// Rule of thumb: `lanesPressed` for a map whose story is LAND CLOSING IN
// (the squeeze, a headland, a narrows), `lanesAcross` for one whose story is
// the shape of the water itself (open sea, a diagonal drift).

/** THE STEEPEST A LANE MAY BEND.
 *
 *  Not a taste call — it is what the steering can physically follow. A hull's
 *  lane-keeping goal is `clamp((laneY - y) / NAV.lanePull, -0.9, 0.9)` against
 *  a forward component of 1, so however far off her line she gets, the goal
 *  direction saturates at 0.9 lateral per 1 forward: about 42 degrees. Author a
 *  lane steeper than that and it simply outruns the hulls on it — measured on
 *  a first cut of the headlands, whose lane touched 56 degrees, the convoy
 *  trailed its own lane line by 228 units and clipped the beach.
 *
 *  Applied to the SAMPLED profile, which is not the same as the finished curve:
 *  smoothstep between two samples peaks at 1.5x the slope of the straight line
 *  joining them, so the limit here comes out about half again as steep on the
 *  water. 0.4 sampled is therefore ~0.6 (31 degrees) real, which leaves room
 *  for the separation and avoidance forces the goal is blended with — what a
 *  hull is spending the rest of its helm on in traffic. Set it to 0.6 and the
 *  real curve lands at 0.888, exactly the saturation point, with nothing spare. */
const MAX_LANE_SLOPE = 0.4;

/** How densely a computed lane is sampled.
 *
 *  A sampled curve cannot track a continuous one exactly: the profile eases
 *  between its samples, so where the true rule is convex the lane cuts the
 *  corner slightly. At the 125-unit spacing this started out at, the squeeze's
 *  near lane cut about ten units off the shore's curve and the validator
 *  rightly failed it. The error falls with the square of the spacing, so 50
 *  units puts it comfortably under two. */
const LANE_SAMPLES = 81;

/** Sample a lane rule at `samples` evenly spaced x, producing an ordinary
 *  profile — so a computed lane costs no more to evaluate than a drawn one. */
function laneProfile(rule: (x: number) => number, samples: number): GeoPoint[] {
  const points: GeoPoint[] = [];
  for (let i = 0; i < samples; i++) {
    const x = (WORLD.width * i) / (samples - 1);
    points.push({ x, y: rule(x) });
  }
  return points;
}

/** Lanes spread ACROSS the navigable water, holding their proportions.
 *
 *  `fractions` are positions across the band (0 = hard against the hostile
 *  side, 1 = hard against the friendly side), ascending. Lanes bend with the
 *  water and close up where it narrows, which makes crossing and running
 *  aground structurally impossible rather than merely validated against. */
export function lanesAcross(
  hostileShore: readonly GeoPoint[],
  friendlyShore: readonly GeoPoint[],
  shoreWave: number,
  fractions: readonly number[],
  samples = LANE_SAMPLES,
): GeoPoint[][] {
  return fractions.map((frac) =>
    laneProfile((x) => {
      const top = sample(hostileShore, x) + shoreWave + hullClearance;
      const bottom = sample(friendlyShore, x) - shoreWave - hullClearance;
      return top + (bottom - top) * frac;
    }, samples),
  );
}

/** Lanes that HOLD STATION and yield only to the land.
 *
 *  Each lane runs at its given y until the water's edge reaches it, then is
 *  pushed just far enough clear — and each lane below is pushed clear of the
 *  one above it in turn, so a lane driven off the coast crowds its neighbour
 *  instead of crossing it. Where the coast is straight, every lane sits exactly
 *  on its authored y, untouched: a pressed map is the strait wherever the land
 *  is not doing anything. */
export function lanesPressed(
  hostileShore: readonly GeoPoint[],
  friendlyShore: readonly GeoPoint[],
  shoreWave: number,
  baseYs: readonly number[],
  opts: { edgeMargin?: number; minSeparation?: number; maxSlope?: number } = {},
  samples = LANE_SAMPLES,
): GeoPoint[][] {
  // Built with more room than the validator demands, for the sampling reason
  // above: a lane laid exactly on the minimum would fail the check it was
  // constructed to pass, which is a maddening thing to debug.
  const edgeMargin = opts.edgeMargin ?? LANE_MARGIN + 30;
  const minSeparation = opts.minSeparation ?? 90;

  // The FLOOR is smoothed, not the finished lanes.
  //
  // Smoothing each lane on its own would let one lane anticipate a climb that
  // its neighbour does not, and two lanes moving on different schedules is how
  // lanes cross. Doing it to the floor instead means every lane below inherits
  // an already-gentle shape through the `max` cascade, and the cascade is what
  // guarantees the ordering. Both passes only ever push the floor SOUTH, away
  // from the hostile shore, so a smoothed floor is never less safe than the raw
  // one — it just starts giving way sooner.
  const xs: number[] = [];
  const floor: number[] = [];
  for (let i = 0; i < samples; i++) {
    const x = (WORLD.width * i) / (samples - 1);
    xs.push(x);
    floor.push(sample(hostileShore, x) + shoreWave + hullClearance + edgeMargin);
  }
  const maxSlope = opts.maxSlope ?? MAX_LANE_SLOPE;
  // Backwards: start bearing away early enough to be clear when the land
  // arrives. Forwards: come back in no faster than a hull can steer.
  for (let i = samples - 2; i >= 0; i--) {
    floor[i] = Math.max(floor[i], floor[i + 1] - maxSlope * (xs[i + 1] - xs[i]));
  }
  for (let i = 1; i < samples; i++) {
    floor[i] = Math.max(floor[i], floor[i - 1] - maxSlope * (xs[i] - xs[i - 1]));
  }

  const lanes: GeoPoint[][] = baseYs.map(() => []);
  for (let s = 0; s < samples; s++) {
    let prev = -Infinity;
    for (let i = 0; i < baseYs.length; i++) {
      const limit = i === 0 ? floor[s] : Math.max(floor[s], prev + minSeparation);
      const y = Math.max(baseYs[i], limit);
      lanes[i].push({ x: xs[s], y });
      prev = y;
    }
  }
  return lanes;
}

/** Lanes routed AROUND an island, some passing north of it and some south.
 *
 *  The third lane rule, and the one terrain needs. `lanesAcross` and
 *  `lanesPressed` both assume the water at any x is a single band, so both
 *  would happily lay a lane straight over an island — the band is still there,
 *  the land is simply in the middle of it.
 *
 *  Each lane is assigned a SIDE, and the side it is given is the side it keeps
 *  for the whole crossing: north lanes are held above the island (their ceiling
 *  comes down as the land rises), south lanes below it (their floor comes up),
 *  and the two groups can no more swap than they can cross. That is the region
 *  this builds — a channel a hull commits to at the western tip and cannot
 *  leave until the eastern one.
 *
 *  Ceilings and floors are slope-limited the same way `lanesPressed` limits
 *  its floor, and for the same reason: a lane is only worth authoring if a hull
 *  can actually follow it, so the bend has to begin far enough west of the land
 *  to be finished before the land arrives. Smoothing the CONSTRAINT rather than
 *  the finished lane keeps the cascade that guarantees lanes never cross. */
export function lanesAroundIsland(
  hostileShore: readonly GeoPoint[],
  friendlyShore: readonly GeoPoint[],
  shoreWave: number,
  baseYs: readonly number[],
  islands: readonly IslandDef[],
  /** One entry per lane, north to south. Every 'north' must precede every
   *  'south' — a north lane below a south one is two crossed lanes. */
  sides: readonly ('north' | 'south')[],
  opts: { edgeMargin?: number; minSeparation?: number; maxSlope?: number } = {},
  samples = LANE_SAMPLES,
): GeoPoint[][] {
  if (sides.length !== baseYs.length) {
    throw new Error('lanesAroundIsland: one side per lane');
  }
  const firstSouth = sides.indexOf('south');
  const northCount = firstSouth === -1 ? sides.length : firstSouth;
  if (sides.slice(northCount).some((s) => s !== 'south')) {
    throw new Error('lanesAroundIsland: every north lane must precede every south lane');
  }
  const edgeMargin = opts.edgeMargin ?? LANE_MARGIN + 30;
  const minSeparation = opts.minSeparation ?? 90;
  const maxSlope = opts.maxSlope ?? MAX_LANE_SLOPE;

  const xs: number[] = [];
  const outerTop: number[] = [];
  const outerBottom: number[] = [];
  /** How far south a north lane may go, and how far north a south lane may. */
  const ceiling: number[] = [];
  const floor: number[] = [];
  for (let i = 0; i < samples; i++) {
    const x = (WORLD.width * i) / (samples - 1);
    xs.push(x);
    const top = sample(hostileShore, x) + shoreWave + hullClearance;
    const bottom = sample(friendlyShore, x) - shoreWave - hullClearance;
    outerTop.push(top + edgeMargin);
    outerBottom.push(bottom - edgeMargin);
    let ceil = bottom - edgeMargin;
    let flr = top + edgeMargin;
    for (const island of islands) {
      const h = islandHalfHeight(island, x);
      if (h <= 0) continue;
      const landTop = island.centerY - h - island.wave - hullClearance;
      const landBottom = island.centerY + h + island.wave + hullClearance;
      ceil = Math.min(ceil, landTop - edgeMargin);
      flr = Math.max(flr, landBottom + edgeMargin);
    }
    ceiling.push(ceil);
    floor.push(flr);
  }
  // Both passes only ever make the constraint TIGHTER, so a smoothed limit is
  // never less safe than the raw one — it just starts giving way sooner.
  for (let i = samples - 2; i >= 0; i--) {
    const dx = xs[i + 1] - xs[i];
    ceiling[i] = Math.min(ceiling[i], ceiling[i + 1] + maxSlope * dx);
    floor[i] = Math.max(floor[i], floor[i + 1] - maxSlope * dx);
  }
  for (let i = 1; i < samples; i++) {
    const dx = xs[i] - xs[i - 1];
    ceiling[i] = Math.min(ceiling[i], ceiling[i - 1] + maxSlope * dx);
    floor[i] = Math.max(floor[i], floor[i - 1] - maxSlope * dx);
  }

  const lanes: GeoPoint[][] = baseYs.map(() => []);
  for (let s = 0; s < samples; s++) {
    // North group, built from the lane CLOSEST to the island upward, so the
    // one the land actually pushes is the one that moves and its neighbours
    // give way to it in turn.
    let limit = ceiling[s];
    for (let i = northCount - 1; i >= 0; i--) {
      const y = Math.max(outerTop[s], Math.min(baseYs[i], limit));
      lanes[i].push({ x: xs[s], y });
      limit = y - minSeparation;
    }
    // South group, built from the island outward, exactly as `lanesPressed`
    // builds from the shore outward.
    let prev = floor[s] - minSeparation;
    for (let i = northCount; i < baseYs.length; i++) {
      const lo = Math.max(floor[s], prev + minSeparation);
      const y = Math.min(outerBottom[s], Math.max(baseYs[i], lo));
      lanes[i].push({ x: xs[s], y });
      prev = y;
    }
  }
  return lanes;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** How much clear water a lane centre must keep off the water's edge. A lane
 *  line ON the edge is a lane whose hulls are aground the moment the formation
 *  spreads them. */
const LANE_MARGIN = 90;

export interface GeographyProblem {
  x: number;
  message: string;
}

/** Check a geography against the invariants the sim quietly assumes.
 *
 *  These are assumptions, not preferences. `nearestLane`, the rolling-barrage
 *  lane pick and the artillery reach test all read lane ORDER as meaning
 *  "distance from the hostile shore", and every hull is held in the water by a
 *  clamp rather than by steering — so a lane that wanders out of the band does
 *  not produce a ship going aground, it produces a ship being shoved sideways
 *  by an invisible hand. Both failures are silent at run time and obvious here,
 *  which is the whole reason this exists. Regions are checked by test. */
export function validateGeography(def: GeographyDef, samples = 81): GeographyProblem[] {
  const problems: GeographyProblem[] = [];
  const geo = makeGeography(def);
  if (def.lanes.length === 0) {
    problems.push({ x: 0, message: 'geography has no lanes' });
    return problems;
  }
  for (const [i, lane] of def.lanes.entries()) {
    if (lane.length === 0) problems.push({ x: 0, message: `lane ${i} has no points` });
  }
  if (problems.length > 0) return problems;

  // Islands must be ISLANDS: land with navigable water on both sides of it. An
  // island merged into a shore is a headland, and should be authored as one —
  // the lane builder and the channel split both assume a gap either side.
  for (const island of def.islands ?? []) {
    if (island.toX <= island.fromX) {
      problems.push({ x: island.fromX, message: `island ${island.id} has no length` });
      continue;
    }
    if (island.halfHeight <= 0) {
      problems.push({ x: island.fromX, message: `island ${island.id} has no height` });
      continue;
    }
    const steps = 41;
    for (let i = 0; i <= steps; i++) {
      const x = island.fromX + ((island.toX - island.fromX) * i) / steps;
      const h = islandHalfHeight(island, x);
      if (h <= 0) continue;
      const landTop = island.centerY - h - island.wave - hullClearance;
      const landBottom = island.centerY + h + island.wave + hullClearance;
      if (landTop - geo.waterTop(x) < LANE_MARGIN * 2) {
        problems.push({
          x,
          message: `island ${island.id} leaves only ${Math.round(landTop - geo.waterTop(x))} units between it and the hostile shore`,
        });
        break;
      }
      if (geo.waterBottom(x) - landBottom < LANE_MARGIN * 2) {
        problems.push({
          x,
          message: `island ${island.id} leaves only ${Math.round(geo.waterBottom(x) - landBottom)} units between it and the friendly shore`,
        });
        break;
      }
    }
  }

  // Which channel each lane started in. A lane may bend as much as the water
  // asks, but it may never change SIDES — a hull committed to one passage at
  // the western tip cannot be re-routed through the land halfway across.
  const laneChannel: (number | null)[] = [];

  for (let s = 0; s < samples; s++) {
    const x = (WORLD.width * s) / (samples - 1);
    const top = geo.waterTop(x);
    const bottom = geo.waterBottom(x);
    if (bottom - top < LANE_MARGIN * 2) {
      problems.push({ x, message: `navigable water is ${Math.round(bottom - top)} units wide` });
    }
    const channels = geo.channels(x);
    for (let i = 0; i < geo.laneCount; i++) {
      const y = geo.laneY(i, x);
      if (y < top + LANE_MARGIN || y > bottom - LANE_MARGIN) {
        problems.push({
          x,
          message: `lane ${i} at y=${Math.round(y)} is outside the water (${Math.round(top)}..${Math.round(bottom)}) by more than the ${LANE_MARGIN}-unit margin`,
        });
      }
      // A lane over land is the failure terrain introduces, and it is silent at
      // run time: the hull clamp would simply shove the convoy sideways along
      // the beach for the length of the island.
      const inChannel = channels.findIndex(
        (c) => y >= c.top + LANE_MARGIN && y <= c.bottom - LANE_MARGIN,
      );
      if (channels.length > 1 && inChannel === -1) {
        problems.push({
          x,
          message: `lane ${i} at y=${Math.round(y)} is on land or within ${LANE_MARGIN} units of it (channels: ${channels.map((c) => `${Math.round(c.top)}..${Math.round(c.bottom)}`).join(', ')})`,
        });
      }
      // Channel INDEX is only meaningful where the island actually splits the
      // water; off the ends of it there is one channel and every lane is in it.
      if (channels.length > 1 && inChannel !== -1) {
        if (laneChannel[i] === undefined || laneChannel[i] === null) laneChannel[i] = inChannel;
        else if (laneChannel[i] !== inChannel) {
          problems.push({
            x,
            message: `lane ${i} has changed channel (was ${laneChannel[i]}, now ${inChannel}) — a lane may bend, never cross the land`,
          });
          laneChannel[i] = inChannel;
        }
      }
      // Lanes may weave; they may never cross. See docs/design/map-topology.md
      // — crossing tracks also mean head-on convoy traffic in a narrow channel,
      // which the give-way model has no rule for.
      if (i > 0 && y <= geo.laneY(i - 1, x)) {
        problems.push({ x, message: `lane ${i} has crossed lane ${i - 1}` });
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// The geographies
// ---------------------------------------------------------------------------

/** THE STRAIT — the default map, and the shape every existing region is fought
 *  on. Authored from the `WORLD` constants rather than copying them, so there
 *  is still exactly one place the default map's numbers live. */
export const STRAIT: GeographyDef = {
  id: 'strait',
  name: 'The Strait',
  hostileShore: flat(WORLD.hostileShoreY),
  friendlyShore: flat(WORLD.friendlyShoreY),
  shoreWave: WORLD.shoreWave,
  lanes: WORLD.lanes.map((y) => flat(y)),
  // 1125 − 140 = 985, the y every launch has always used.
  launchInset: 140,
  // 2250 + 135 = 2385, the shore-battery line.
  baseInset: 135,
  launchSites: [{ x: 700 }, { x: 1800, extraInset: 30 }, { x: 2900 }],
};

/** THE SQUEEZE — the hostile coast bulges into the shipping lane across the
 *  middle third of the map, and the lanes close up and bend south with it.
 *
 *  Worn by MISSILE COAST. The bulge is a PEAK, not a plateau — it ramps up
 *  over 750 units, tops out, and ramps back down — so the danger arrives, is
 *  survived, and is left behind. Every transit has a recognisable moment in
 *  the middle, which is the whole thing a straight strait cannot give you.
 *
 *  What the bulge DOES, with no weapon touched. At the peak the launch line
 *  sits 400 units further south, and the near lane — with the coast where it
 *  used to be — is shoved into the middle of the channel, crowding the centre
 *  lane ahead of it:
 *
 *    warning before a missile arrives      near lane   centre lane
 *      out west (the strait, unchanged)       7.0 s       11.7 s
 *      in the alley                           5.5 s        7.0 s
 *
 *    lanes a shore gun can reach            coastal      ranging
 *      out west                                  1            2
 *      in the alley                              2            3
 *
 *  Danger stops being evenly distributed along the map, which is the single
 *  thing the straight strait cannot express — and every number above moved
 *  because the coastline did, not because anything was rebalanced. */
const SQUEEZE_HOSTILE: GeoPoint[] = [
  { x: 0, y: WORLD.hostileShoreY },
  { x: 1250, y: WORLD.hostileShoreY },
  { x: 2000, y: WORLD.hostileShoreY + 400 },
  { x: 2750, y: WORLD.hostileShoreY },
  { x: WORLD.width, y: WORLD.hostileShoreY },
];

const SQUEEZE_FRIENDLY: GeoPoint[] = [{ x: 0, y: WORLD.friendlyShoreY }];

export const SQUEEZE: GeographyDef = {
  id: 'squeeze',
  name: 'The Squeeze',
  hostileShore: SQUEEZE_HOSTILE,
  friendlyShore: SQUEEZE_FRIENDLY,
  shoreWave: WORLD.shoreWave,
  // The strait's own three lanes, holding station and giving ground only to
  // the bulge — so outside the middle third this map IS the strait, lane for
  // lane, and inside it the near lane is pressed into the centre one.
  lanes: lanesPressed(SQUEEZE_HOSTILE, SQUEEZE_FRIENDLY, WORLD.shoreWave, WORLD.lanes),
  launchInset: 140,
  baseInset: 135,
  // Sites ride the shore profile, so the middle one is carried south with the
  // bulge and is the one that hurts.
  launchSites: [{ x: 700 }, { x: 2000, extraInset: 30 }, { x: 3300 }],
};

/** THE HEADLANDS — a hostile peninsula the convoy has to sail the length of.
 *
 *  The squeeze's amplitude, held for two-thirds of the crossing instead of
 *  spiked in the middle, and that difference is the whole region. A peak is a
 *  moment: you take the hits and you are past it. A plateau is a passage —
 *  there is no stretch of water where the guns are not on you, so "wait it
 *  out" is not an answer and suppressing the shore is.
 *
 *  Sized to what the artillery branch can actually reach, since that is the
 *  branch this region exists to give a home to. Coastal and barrage guns
 *  reach 540; ranging guns reach 830. Because a pressed lane and the launch
 *  line BOTH ride the shore, the near lane sits a constant 331 units off the
 *  guns however deep the intrusion is — so what the depth actually buys is the
 *  far lanes:
 *
 *    lanes a shore gun can reach          coastal (540)   ranging (830)
 *      the strait                              1               2
 *      the headlands                           2               3
 *
 *    warning before a missile arrives     near   centre   far
 *      the strait                         7.0s    11.7s   16.3s
 *      the headlands                      5.5s     8.0s   10.5s
 *
 *  Note what is NOT here: coastal guns reaching all three lanes. The geometry
 *  forbids it and it is worth writing down why. The gun sits 211 units above
 *  the water's edge (140 inland, plus the meander and the hull clearance), so
 *  reaching a far lane 540 away means the whole navigable channel is under
 *  330 units deep — and three lanes will not fit in that with enough water
 *  between them to sail. Crowding the lanes to make them fit produces a
 *  traffic jam, not a battle: a Wide convoy spreads 42 units either side of
 *  its lane line, so lanes closer than about 150 apart put hulls inside each
 *  other's separation bubble for the length of the plateau. Two lanes under
 *  the coastal guns and all three under the ranging guns is what the numbers
 *  actually support, and it still makes the round-8 ranging debut the moment
 *  the last safe water disappears. */
const HEADLANDS_INTRUSION = 400;

const HEADLANDS_HOSTILE: GeoPoint[] = [
  { x: 0, y: WORLD.hostileShoreY },
  { x: 500, y: WORLD.hostileShoreY },
  // The COASTLINE may be as abrupt as it likes — headlands are. What the hulls
  // follow is the lane, and `lanesPressed` holds that to MAX_LANE_SLOPE
  // whatever the land does, bearing away early rather than turning hard late.
  { x: 1100, y: WORLD.hostileShoreY + HEADLANDS_INTRUSION },
  { x: 3100, y: WORLD.hostileShoreY + HEADLANDS_INTRUSION },
  { x: 3700, y: WORLD.hostileShoreY },
  { x: WORLD.width, y: WORLD.hostileShoreY },
];

const HEADLANDS_FRIENDLY: GeoPoint[] = [{ x: 0, y: WORLD.friendlyShoreY }];

export const HEADLANDS: GeographyDef = {
  id: 'headlands',
  name: 'The Headlands',
  hostileShore: HEADLANDS_HOSTILE,
  friendlyShore: HEADLANDS_FRIENDLY,
  shoreWave: WORLD.shoreWave,
  // WIDER lane separation than the squeeze's default. The squeeze crowds its
  // lanes on purpose and gets away with it because the crowding lasts a few
  // seconds; hold the same crowding for two-thirds of the map and the convoy
  // spends the passage giving way to itself instead of fighting.
  lanes: lanesPressed(HEADLANDS_HOSTILE, HEADLANDS_FRIENDLY, WORLD.shoreWave, WORLD.lanes, {
    minSeparation: 150,
  }),
  launchInset: 140,
  baseInset: 135,
  // All three sites on the plateau, and spread across it: the emplacements ARE
  // the peninsula, and a convoy should never be able to point at one stretch
  // of coast and call the rest of it quiet.
  launchSites: [{ x: 1300 }, { x: 2200, extraInset: 30 }, { x: 3000 }],
};

/** THE ISLAND CHANNEL — a rock in the middle of the strait, and the first map
 *  whose defining feature is not a coastline.
 *
 *  Straight shores on purpose. The squeeze and the headlands are both about
 *  land LEANING IN from the side, and a third variation on that theme would be
 *  a different amount of the same idea. What an island adds instead is water
 *  the convoy cannot cross: for 1400 units the strait is two passages, and a
 *  hull is in one of them or the other.
 *
 *  What it does, measured, with no weapon touched:
 *
 *    amidships (x = 2000)              north channel   south channel
 *      navigable width                     288             343
 *      lanes carried                         1               2
 *      shore torpedo runs blocked            0%             92%
 *
 *  The two passages are not two versions of the same water. The NORTHERN one
 *  is roomy — one lane in 288 units, more room per hull than the strait gives
 *  anybody — and completely exposed: every straight run from the hostile shore
 *  reaches it. The SOUTHERN one is sheltered, the rock blocking 86-92% of
 *  shore-launched runs at the lanes abreast of it, and pays for that by putting
 *  two lanes into 343 units and adding 88 units to the crossing.
 *
 *  So the region asks one question the other three cannot: where do you put
 *  your hulls, knowing you cannot change your mind halfway? Mines and boats
 *  are what punish the answer, because both are laid ON a lane and neither can
 *  be dodged sideways when the sideways is a rock. That is also why the lane
 *  rule below assigns SIDES rather than positions — a channel is a commitment,
 *  and `validateGeography` enforces that no lane quietly changes its mind.
 *
 *  The centre lane is the one displaced: it bears 251 units south to clear the
 *  rock and shoves lane 2 down 101 to make room, while the near lane gives up
 *  21. The convoy's own middle is what visibly splits, which is the whole
 *  reason to put the island on the centre line rather than tucked against a
 *  shore where it would be scenery. Both bends are inside what a hull can
 *  steer: the steepest realised lane slope is 0.59 lateral per 1 forward
 *  against the 0.9 the steering saturates at. */
const ISLAND_CHANNEL_ISLAND: IslandDef = {
  id: 'midChannelIsland',
  name: 'The Rock',
  fromX: 1300,
  toX: 2700,
  centerY: 1660,
  halfHeight: 120,
  wave: 30,
};

const ISLAND_CHANNEL_HOSTILE: GeoPoint[] = [{ x: 0, y: WORLD.hostileShoreY }];
const ISLAND_CHANNEL_FRIENDLY: GeoPoint[] = [{ x: 0, y: WORLD.friendlyShoreY }];

export const ISLAND_CHANNEL: GeographyDef = {
  id: 'islandChannel',
  name: 'The Island Channel',
  hostileShore: ISLAND_CHANNEL_HOSTILE,
  friendlyShore: ISLAND_CHANNEL_FRIENDLY,
  shoreWave: WORLD.shoreWave,
  islands: [ISLAND_CHANNEL_ISLAND],
  // Lane 0 takes the northern passage alone; lanes 1 and 2 share the southern
  // one. The centre lane is the one the island actually displaces, and it is
  // the lane the convoy's middle sails in — so the split is something the
  // player watches happen to their own column, not a detail of the coastline.
  lanes: lanesAroundIsland(
    ISLAND_CHANNEL_HOSTILE,
    ISLAND_CHANNEL_FRIENDLY,
    WORLD.shoreWave,
    WORLD.lanes,
    [ISLAND_CHANNEL_ISLAND],
    ['north', 'south', 'south'],
    { edgeMargin: 100, minSeparation: 130 },
  ),
  launchInset: 140,
  baseInset: 135,
  // Spread so that no one site owns the island: the western and eastern sites
  // shoot past its tips into both channels, the middle one is the one the rock
  // stands in front of.
  launchSites: [{ x: 700 }, { x: 2000, extraInset: 30 }, { x: 3300 }],
};

export const GEOGRAPHIES: Record<GeographyId, GeographyDef> = {
  strait: STRAIT,
  squeeze: SQUEEZE,
  headlands: HEADLANDS,
  islandChannel: ISLAND_CHANNEL,
};

const resolved = new Map<GeographyId, Geography>();

/** The resolved geography for an id, built once and shared. Unknown ids fall
 *  back to the strait rather than throwing — a region with a typo in it should
 *  be playable and obviously wrong, not a crash on the loading screen. */
export function geography(id: GeographyId): Geography {
  // An unknown id resolves to the strait ITSELF, not to a second copy of it.
  // Identity matters: the sim, the renderer and the order resolver all have to
  // be looking at the same map, and a typo that quietly minted a private
  // duplicate would be the hardest possible version of that bug to see.
  const def = GEOGRAPHIES[id];
  if (!def) return geography('strait');
  let geo = resolved.get(id);
  if (!geo) {
    geo = makeGeography(def);
    resolved.set(id, geo);
  }
  return geo;
}
