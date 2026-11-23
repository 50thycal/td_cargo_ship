// Log v62 (Saltgate Canal's Gatecrashers, docs/design/v3-ch2-saltgate.md):
// the Missile Truck parade. The player, after playing the v46 columns: "a
// row of trucks going in a parade from the left to the right across the
// road ... a truck every 1 to 3 seconds randomly and it would just randomly
// fire out a missile without stopping ... and it can have them fire off in
// an elaborate pattern."
//
// Pure helpers, seeded: when the trucks set out (`paradeSpawns`), when each
// pattern of launches (a ParadeBeat) or lone launch (a stray) comes
// (`paradeCalls`), and, as one comes, which of the trucks then on the road
// fire it and when (`layBeat`). A beat is laid on the trucks still driving
// at the moment it starts, front (east) to back, so a truck shot before it
// raises fires nothing and the pattern goes on with the trucks left.

import type { RNG } from '../../sim/rng';
import { paradeBeats, type ParadeBeat, type ParadeRound } from '../data/encounters';

/** A truck on the road as a beat is laid: its id, how far along the road
 *  it is, the wave seconds of the launches it has coming, and how many
 *  missiles it has left that are not yet called for. */
export interface ParadeSlot {
  id: number;
  along: number;
  fires: number[];
  left: number;
}

/** Where the parade can be seen: how far along the road a truck comes on
 *  screen and goes off it, and its speed (px/s). */
export interface ParadeRoad {
  on: number;
  off: number;
  speed: number;
}

/** A launch laid: the truck, the wave second it fires, and the lock its
 *  ship is held at (-1: any). */
export interface ParadeShot {
  id: number;
  at: number;
  lock: number;
}

/** A call in the round: a beat (its index in the round's `beats`) or a
 *  stray (-1), at seconds from the parade's start; the truck raises at
 *  once, so the first launch is `lift` s after the call. */
export interface ParadeCall {
  at: number;
  beat: number;
}

/** Seconds a truck's erector needs between launches: the raise before one
 *  and the rail coming down after the last, with a breath. */
export function paradeSpacing(lift: number, lower: number): number {
  return lift + lower + 0.2;
}

/** When the trucks set out, in seconds from the parade's start: the first
 *  at once, then `gap` s apart (seeded, uniform), until `span`. */
export function paradeSpawns(R: ParadeRound, rng: RNG): number[] {
  const out: number[] = [];
  for (let t = 0; t <= R.span + 1e-9; t += rng.range(R.gap[0], R.gap[1])) out.push(Math.round(t * 1000) / 1000);
  return out;
}

/** The round's calls, in order: each beat (paradeBeats) `lift` s before its `at` (±0.3 s,
 *  seeded), and `strays` lone launches at seeded moments from `lift` s in
 *  to the last beat. */
export function paradeCalls(R: ParadeRound, rng: RNG, lift: number): ParadeCall[] {
  const beats = paradeBeats(R);
  const out: ParadeCall[] = beats.map((b, i) => ({ at: Math.max(0, b.at - lift + rng.range(-0.3, 0.3)), beat: i }));
  const last = Math.max(lift + 1, ...beats.map((b) => b.at));
  for (let j = 0; j < (R.strays ?? 0); j++) out.push({ at: rng.range(1, last - lift), beat: -1 });
  return out.sort((a, b) => a.at - b.at);
}

/** Lay a call on the trucks on the road `now` (wave seconds): the launches
 *  it makes. A truck can take a launch at `at` if it is on screen now (its
 *  raise starts at once or later), still on screen at `at`, has a missile
 *  left, and its other launches are `spacing` apart from it. The column is
 *  ordered front (furthest along) to back. */
export function layBeat(b: ParadeBeat | undefined, now: number, slots: ParadeSlot[], road: ParadeRoad, lift: number, spacing: number, rng: RNG): ParadeShot[] {
  const out: ParadeShot[] = [];
  const can = (s: ParadeSlot, at: number) =>
    s.along >= road.on && s.along + (at - now) * road.speed <= road.off && s.left > 0 && s.fires.every((f) => Math.abs(f - at) >= spacing);
  const add = (s: ParadeSlot, at: number, lock: number) => {
    if (!can(s, at)) return;
    s.fires.push(at);
    s.left -= 1;
    out.push({ id: s.id, at, lock });
  };
  const t0 = now + lift;
  const col = slots.filter((s) => can(s, t0)).sort((x, y) => y.along - x.along);
  if (!col.length) return out;
  if (!b) {
    // A stray: one truck, seeded.
    add(rng.pick(col), t0, -1);
    return out;
  }
  const step = b.step ?? 0.4;
  const lock = (j: number) => (b.aim === 'alternate' ? j % 2 : -1);
  const order = b.from === 'back' ? [...col].reverse() : col;
  switch (b.pattern) {
    case 'ripple': {
      // A run of n trucks side by side, one after another down the column,
      // `step` apart (where the run starts: seeded).
      const n = Math.min(b.n ?? 3, order.length);
      const s = rng.int(order.length - n + 1);
      for (let j = 0; j < n; j++) add(order[s + j], t0 + j * step, lock(j));
      break;
    }
    case 'sync': {
      // n trucks spread down the column, all at once.
      const n = Math.min(b.n ?? 3, order.length);
      for (let j = 0; j < n; j++) add(order[Math.floor(((j + 0.5) * order.length) / n)], t0, lock(j));
      break;
    }
    case 'pairs': {
      // Side-by-side pairs, a pair at once, the next pair `step` on.
      const n = Math.min(b.n ?? 4, order.length);
      for (let j = 0; j < n; j++) add(order[j], t0 + Math.floor(j / 2) * step, lock(Math.floor(j / 2)));
      break;
    }
    case 'sweep':
      // Every truck on the road, one after another down the column.
      order.forEach((s, j) => add(s, t0 + j * step, lock(j)));
      break;
  }
  return out;
}
