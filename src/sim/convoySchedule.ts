// When each hull of the convoy enters the strait.
//
// This lives in its own module because TWO systems need it and they must agree.
// The transit sim needs the actual per-ship entry times. The enemy planner
// needs to know how long the convoy will be arriving for, so it can spread a
// round's fire across the whole transit instead of emptying the magazine before
// half the ships are on the map. Keeping the schedule and the span estimate in
// the same file is the only thing that stops the two drifting apart the next
// time somebody retunes SPAWN.

import { SIM, SPAWN, WORLD } from '../data/tuning';
import type { FormationId, Ship } from './types';
import type { RNG } from './rng';

/** Clamp a lane index into the valid corridor range. */
export function clampLane(lane: number): number {
  return Math.max(0, Math.min(WORLD.lanes.length - 1, lane));
}

/** Index of the corridor lane whose center is nearest a world-Y (used to turn a
 *  scan tap into a lane selection). */
export function nearestLane(y: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < WORLD.lanes.length; i++) {
    const d = Math.abs(WORLD.lanes[i] - y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Roughly when the LAST hull of a `shipsOut`-strong convoy enters, for this
 *  formation.
 *
 *  An estimate on purpose: it is computed before the shuffle, so it cannot know
 *  which volley sizes the RNG will pick. It only has to be close, because its
 *  one consumer — the enemy fire window — is spreading events across a span,
 *  not timing them to a hull.
 *
 *  It has to be FORMATION-AWARE, though. A single global figure was fine while
 *  every formation entered at roughly the same rate, but Tight lands three
 *  hulls per wave and Sprint runs them nose to tail, so both finish arriving in
 *  a fraction of the time a Wide stream takes. Estimating them all at the Wide
 *  rate would stretch the enemy's fire window to twice the length of the convoy
 *  it is shooting at, and the same number of missiles spread over twice the
 *  water is half the pressure — a difficulty change nobody asked for, hidden
 *  inside a pacing change. */
export function convoySpawnSpan(shipsOut: number, formation: FormationId): number {
  const gaps = Math.max(0, shipsOut - 1);
  const laneCount = WORLD.lanes.length;
  if (formation === 'sprint') {
    // Volleys of sprintVolleyMin..Max; use the midpoint, since the RNG picks
    // per volley and this is an average over the whole round.
    const volley = (SPAWN.sprintVolleyMin + SPAWN.sprintVolleyMax) / 2;
    const volleys = Math.max(1, Math.ceil(shipsOut / volley));
    const inVolleyGaps = Math.max(0, shipsOut - volleys);
    return (
      SPAWN.firstDelay +
      inVolleyGaps * SPAWN.sprintInterval +
      (volleys - 1) * SPAWN.sprintVolleyGap
    );
  }
  if (formation === 'tight') {
    const waves = Math.max(1, Math.ceil(shipsOut / laneCount));
    return SPAWN.firstDelay + (waves - 1) * SPAWN.tightWaveInterval;
  }
  return SPAWN.firstDelay + gaps * SPAWN.interval;
}

/** How long this round is allowed to run before whatever is still afloat is
 *  written off as lost at sea.
 *
 *  A flat cap cannot express "the convoy needs time to get through", because
 *  how long it needs depends on how many hulls sail and how they are spaced.
 *  Give the convoy its arrival span plus a crossing allowance, and the timeout
 *  goes back to meaning what it should — a convoy that could not fight its way
 *  across — rather than one that was still queueing when the whistle blew. */
export function transitTimeLimit(shipsOut: number, formation: FormationId): number {
  const needed = convoySpawnSpan(shipsOut, formation) + SIM.transitCrossAllowance;
  return Math.max(SIM.minTransitTime, Math.min(SIM.maxTransitTime, needed));
}

/** Schedule ship entries in a pattern that visibly reflects the chosen
 *  formation:
 *   • sprint — single-file volleys: 3-6 ships enter one at a time, nose to
 *     tail, all in ONE lane; then the next volley of 3-6 ships forms up in a
 *     DIFFERENT lane after a longer pause (so the whole round isn't dumped
 *     into a single lane).
 *   • tight  — grouped waves: two or three ships enter TOGETHER, each in a
 *     different lane, then the next wave a while later (a packed convoy).
 *   • wide   — staggered: one ship at a time, alternating across the lanes
 *     (a loose, spread-out stream).
 */
export function scheduleSpawns(ships: Ship[], rng: RNG, formation: FormationId): void {
  const order = rng.shuffle(ships.map((_, i) => i));
  const laneCount = WORLD.lanes.length;
  const setJitter = (ship: Ship): void => {
    ship.lateralSeed = rng.range(-1, 1);
    ship.speedVariance = rng.range(1 - SPAWN.speedVariance, 1 + SPAWN.speedVariance);
  };

  if (formation === 'sprint') {
    let t = SPAWN.firstDelay;
    let i = 0;
    let lastLane = -1;
    while (i < order.length) {
      // Pick a lane different from the previous volley's, so the column
      // visibly relocates instead of refilling the same line all round.
      let lane = rng.int(laneCount);
      if (laneCount > 1) {
        while (lane === lastLane) lane = rng.int(laneCount);
      }
      lastLane = lane;
      const volleySize = Math.min(
        SPAWN.sprintVolleyMin + rng.int(SPAWN.sprintVolleyMax - SPAWN.sprintVolleyMin + 1),
        order.length - i,
      );
      for (let v = 0; v < volleySize; v++) {
        const ship = ships[order[i + v]];
        setJitter(ship);
        ship.laneIndex = lane;
        ship.spawnTime = Math.max(SPAWN.firstDelay, t + rng.range(-SPAWN.timeJitter, SPAWN.timeJitter));
        // Nose-to-tail within the volley; a longer pause after the volley's
        // last ship before the next volley's first ship enters.
        t += v === volleySize - 1 ? SPAWN.sprintVolleyGap : SPAWN.sprintInterval;
      }
      i += volleySize;
    }
    return;
  }

  if (formation === 'tight') {
    let t = SPAWN.firstDelay;
    let i = 0;
    while (i < order.length) {
      const groupSize = Math.min(laneCount, order.length - i);
      // Distinct lanes for this wave, shuffled so groups aren't always 0,1,2.
      const lanes = rng.shuffle([...Array(laneCount).keys()]).slice(0, groupSize);
      for (let g = 0; g < groupSize; g++) {
        const ship = ships[order[i + g]];
        setJitter(ship);
        ship.laneIndex = lanes[g];
        ship.spawnTime = Math.max(SPAWN.firstDelay, t + rng.range(0, SPAWN.tightWaveJitter));
      }
      i += groupSize;
      t += SPAWN.tightWaveInterval;
    }
    return;
  }

  // wide (staggered)
  let laneCursor = rng.int(laneCount);
  let t = SPAWN.firstDelay;
  for (const idx of order) {
    const ship = ships[idx];
    setJitter(ship);
    ship.laneIndex = laneCursor % laneCount;
    ship.spawnTime = Math.max(SPAWN.firstDelay, t + rng.range(-SPAWN.timeJitter, SPAWN.timeJitter));
    laneCursor++;
    t += SPAWN.interval;
  }
}
