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

  /** THE NAVIGABLE WATER at this x. Clears the drawn meander, so a hull held
   *  between these is in open water at every point along the strait. */
  waterTop(x: number): number;
  waterBottom(x: number): number;

  /** The same band for AIRCRAFT, which are allowed closer to the beach than a
   *  hull is — a strafing run over the surf is fine, a cargo ship on it is not. */
  airWaterTop(x: number): number;
  airWaterBottom(x: number): number;

  /** Centre of a lane at this x. */
  laneY(lane: number, x: number): number;
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

/** How much clear water a HULL keeps off the drawn coastline. */
const hullClearance = COMBAT.shoreClearance;

/** How much an AIRCRAFT keeps. Smaller: a run-in may cross the surf line, and
 *  the A-10's whole job is working the water close to the hostile beach. */
const airClearance = 15;

export function makeGeography(def: GeographyDef): Geography {
  const hostileShoreY = (x: number): number => sample(def.hostileShore, x);
  const friendlyShoreY = (x: number): number => sample(def.friendlyShore, x);
  const launchY = (x: number): number => hostileShoreY(x) - def.launchInset;
  const laneCount = def.lanes.length;

  const launchSites: GeoPoint[] = def.launchSites.map((site) => ({
    x: site.x,
    y: launchY(site.x) - (site.extraInset ?? 0),
  }));

  const laneY = (lane: number, x: number): number =>
    sample(def.lanes[Math.max(0, Math.min(laneCount - 1, lane))], x);

  return {
    id: def.id,
    name: def.name,
    shoreWave: def.shoreWave,
    laneCount,
    launchSites,
    hostileShoreY,
    friendlyShoreY,
    waterTop: (x) => hostileShoreY(x) + def.shoreWave + hullClearance,
    waterBottom: (x) => friendlyShoreY(x) - def.shoreWave - hullClearance,
    airWaterTop: (x) => hostileShoreY(x) + def.shoreWave + airClearance,
    airWaterBottom: (x) => friendlyShoreY(x) - def.shoreWave - airClearance,
    laneY,
    clampLane: (lane) => Math.max(0, Math.min(laneCount - 1, lane)),
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
  opts: { edgeMargin?: number; minSeparation?: number } = {},
  samples = LANE_SAMPLES,
): GeoPoint[][] {
  // Built with more room than the validator demands, for the sampling reason
  // above: a lane laid exactly on the minimum would fail the check it was
  // constructed to pass, which is a maddening thing to debug.
  const edgeMargin = opts.edgeMargin ?? LANE_MARGIN + 30;
  const minSeparation = opts.minSeparation ?? 90;
  const at = (x: number): number[] => {
    const top = sample(hostileShore, x) + shoreWave + hullClearance;
    const out: number[] = [];
    for (let i = 0; i < baseYs.length; i++) {
      const floor = i === 0 ? top + edgeMargin : Math.max(top + edgeMargin, out[i - 1] + minSeparation);
      out.push(Math.max(baseYs[i], floor));
    }
    return out;
  };
  return baseYs.map((_, i) => laneProfile((x) => at(x)[i], samples));
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

  for (let s = 0; s < samples; s++) {
    const x = (WORLD.width * s) / (samples - 1);
    const top = geo.waterTop(x);
    const bottom = geo.waterBottom(x);
    if (bottom - top < LANE_MARGIN * 2) {
      problems.push({ x, message: `navigable water is ${Math.round(bottom - top)} units wide` });
    }
    for (let i = 0; i < geo.laneCount; i++) {
      const y = geo.laneY(i, x);
      if (y < top + LANE_MARGIN || y > bottom - LANE_MARGIN) {
        problems.push({
          x,
          message: `lane ${i} at y=${Math.round(y)} is outside the water (${Math.round(top)}..${Math.round(bottom)}) by more than the ${LANE_MARGIN}-unit margin`,
        });
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
 *  Not yet worn by any region: this exists so the machinery above is exercised
 *  by something that is actually curved, and so the shape Missile Coast wants
 *  is already sitting here, validated, when that region is built.
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

export const GEOGRAPHIES: Record<GeographyId, GeographyDef> = {
  strait: STRAIT,
  squeeze: SQUEEZE,
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
