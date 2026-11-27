// Trucks keep off each other (log v73; docs/design/v3-playtest-fixes.md,
// "Trucks that overlap"). Every truck that drives a road (a pop-up, a
// runner, a Rocket Truck, in a wave or an event) moves through `driveStep`:
// where the body it would have next step would sink into another truck, it
//
//   1. takes the lane beside the road instead (a lateral offset of one
//      truck's width and a little air, on whichever side is land, centre
//      first; it slides across at LANES.speed), or
//   2. waits where it is, if neither lane is clear (a pop-up behind another
//      at the end of its road, a runner at a pop-up's stop), for at most
//      LANES.holdMax s.
//
// And a truck is not put on its road (`startClear`) while another stands at
// its start: a wave's pop-up tries the map's other roads first (the player:
// "just have the other truck come in from a different way"), then waits.
//
// No dice: the order of the tries is fixed (the centre, the lane it is in,
// then the one on the road's left and the one on its right), so a run plays
// the same every time and the replay is exact.
//
// `LANES.on` is the switch the audit and the tests flip to read the game
// without it.

import { alongPath } from './game';
import { onLand } from './foes';
import type { Game } from './game';
import { RAIDER_SCALE, ROCKET_SCALE, TRUCK_BODY, TRUCK_GAP, groundBodies, onScreen, overlapDepth, truckBody, truckClear } from './overlap';
import type { Point } from '../data/mapTypes';

export const LANES = {
  /** Trucks keep off each other (log v73). The tests turn it off. */
  on: true,
  /** px/s a truck slides across to the lane beside its road. */
  speed: 90,
  /** The longest a truck waits for the way to clear (s); after that it goes on. */
  holdMax: 10,
};
/** A truck that could not be put on its road waits this long (s) and tries again. */
export const TRUCK_RETRY = 0.25;

/** Where a truck is across its road, and how long it has waited. */
export interface Lane {
  lat?: number;
  held?: number;
}

/** The lane's offset: a body's width and a little air. */
export function laneWidth(scale: number): number {
  return TRUCK_BODY.beam * 2 * scale + TRUCK_GAP + 2;
}

/** A pose on a road: `dist` along it, `lat` px to the left of its heading. */
export function roadPose(path: Point[], dist: number, lat: number): { x: number; y: number; heading: number } {
  const p = alongPath(path, dist);
  return { x: p.x - Math.sin(p.heading) * lat, y: p.y + Math.cos(p.heading) * lat, heading: p.heading };
}

const approach = (from: number, to: number, by: number): number => (to > from ? Math.min(to, from + by) : Math.max(to, from - by));

/** One step of a truck along its road, from `dist` to the `want` it would
 *  drive to. Returns the distance it gets to, and sets `lane`. `scale` is
 *  the body it is drawn with (RAIDER_SCALE, ROCKET_SCALE). */
export function driveStep(g: Game, id: number, kind: string, path: Point[], dist: number, want: number, lane: Lane, scale: number, dt: number): number {
  const lat0 = lane.lat ?? 0;
  if (!LANES.on || (want === dist && lat0 === 0)) return want;
  // A truck already sunk into another one that is younger (it came on
  // behind, or the wait ran out on it) does not wait for it: it goes on, and
  // clear. One sunk into an older truck waits for that one to move on.
  const now = roadPose(path, dist, lat0);
  const nowBody = truckBody(id, kind, now.x, now.y, now.heading, scale);
  const others = groundBodies(g, false, false).filter((b) => b.id !== id && (b.id < id || overlapDepth(nowBody, b) === 0));
  const W = laneWidth(scale);
  // The centre first, then the lane it is in, then the lanes beside the road.
  const tries = [...new Set([0, lat0, W, -W])];
  const clearAt = (d: number, lat: number): boolean => {
    const at = roadPose(path, d, lat);
    return truckClear(truckBody(id, kind, at.x, at.y, at.heading, scale), others);
  };
  for (const c of tries) {
    // The lane it is heading for must be clear where it is going, or it
    // slides into a blocked lane.
    if (c !== 0 && !laneOk(g, path, want, c)) continue;
    if (!clearAt(want, c)) continue;
    const lat = approach(lat0, c, LANES.speed * dt);
    // Crossing over: on along the road once the way is clear, else sliding
    // across where it stands.
    if (lat === c || clearAt(want, lat)) {
      lane.lat = lat === 0 ? undefined : lat;
      lane.held = undefined;
      return want;
    }
    if (clearAt(dist, lat)) {
      lane.lat = lat === 0 ? undefined : lat;
      lane.held = undefined;
      return dist;
    }
  }
  // Nowhere to go: wait (and, when the wait has run out, go on regardless).
  lane.held = (lane.held ?? 0) + dt;
  if (lane.held < LANES.holdMax) return dist;
  lane.lat = approach(lat0, 0, LANES.speed * dt) || undefined;
  return want;
}

/** Is the lane `lat` px beside the road at `dist` on land, on screen? */
function laneOk(g: Game, path: Point[], dist: number, lat: number): boolean {
  const here = roadPose(path, dist, lat);
  return onScreen(here, -20) && onLand(g, here.x, here.y);
}

/** Is the start of this road clear of every truck (so a truck coming on can
 *  be put there, drawn or not, without sinking into another)? */
export function startClear(g: Game, path: Point[], rocket: boolean): boolean {
  if (!LANES.on) return true;
  const p = roadPose(path, 0, 0);
  const scale = rocket ? ROCKET_SCALE : RAIDER_SCALE;
  return truckClear(truckBody(-1, 'start', p.x, p.y, p.heading, scale), groundBodies(g, false, false));
}

export { RAIDER_SCALE, ROCKET_SCALE };
