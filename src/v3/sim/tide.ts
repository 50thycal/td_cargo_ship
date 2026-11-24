// THE TIDE (Tidewater Flats): where the tide is at a moment, as a pure
// function of the map and the clocks, so the sim (game.ts), the telemetry
// and the drawing all read the same tide.
//
// Log v66 (the player: "it should be the whole water moving in and out, and
// slower too", "the ships left in the low tide are just stuck until the next
// high tide", "tide times should last longer"). The whole sea pulls back, not
// a strip of sand growing in: at low water the water is held in the deep
// channel's bed and every other yard between the two shores is dry, the
// carrier's berth too (`seaEdges`, drawn by ui/features.ts). The tide falls
// over TIDE_TURN.fall s and rises over TIDE_TURN.rise s. The flats lane takes
// new ships only at high water; a ship already on it when the water drops
// ground out (`floatPace`): it slows, stops, and stays aground until the
// tide has come back in, and nothing moves it to the deep channel. (Log v61
// to v65 sent every ship on the flats across to the deep channel as the tide
// fell.)

import type { Channel, MapDef } from '../data/mapTypes';

export type TidePhase = 'high' | 'falling' | 'low' | 'rising';

/** Seconds the tide takes to fall before low water and to rise after it
 *  (log v66: 8 and 9 s, from 4 and 3), and the water level on the flats at
 *  which a ship runs aground (`ground`: below it a hull is stopped) and
 *  floats free again (`float`: at or above it a hull sails at full pace). */
export const TIDE_TURN = { fall: 8, rise: 9, ground: 0.3, float: 0.55 } as const;

export interface TideNow {
  phase: TidePhase;
  /** The water over the flats: 1 at high water, 0 at low. */
  level: number;
  /** Seconds to the next turn (Infinity: none this wave). */
  left: number;
  /** The share of this phase left. */
  frac: number;
}

/** The tide now, from the map's own clock (`t`, the run's time) or, under
 *  the encounter layer, the wave's (or the boss round's) low water `ebb`
 *  (from, to: seconds of the wave, `waveT`). A map with no tide: high. */
export function tideAt(map: Pick<MapDef, 'tide'>, t: number, waveT: number, ebb?: [number, number]): TideNow {
  const T = map.tide;
  const { fall, rise } = TIDE_TURN;
  if (!T) return { phase: 'high', level: 1, left: Infinity, frac: 1 };
  if (ebb) {
    const [a, b] = ebb;
    const x = waveT;
    if (x < a - fall) return { phase: 'high', level: 1, left: a - fall - x, frac: (a - fall - x) / Math.max(1, a - fall) };
    if (x < a) return { phase: 'falling', level: (a - x) / fall, left: a - x, frac: (a - x) / fall };
    if (x < b) return { phase: 'low', level: 0, left: b - x, frac: (b - x) / Math.max(1, b - a) };
    if (x < b + rise) return { phase: 'rising', level: (x - b) / rise, left: b + rise - x, frac: (b + rise - x) / rise };
    return { phase: 'high', level: 1, left: Infinity, frac: 1 };
  }
  // The map's clock (a campaign run): `high` s of high water (its first
  // `rise` s the tide still coming in, its last `fall` s going out), then
  // `low` s of low water.
  const cycle = T.high + T.low;
  const c = ((t % cycle) + cycle) % cycle;
  if (c < rise) return { phase: 'rising', level: c / rise, left: rise - c, frac: (rise - c) / rise };
  if (c < T.high - fall) return { phase: 'high', level: 1, left: T.high - fall - c, frac: (T.high - fall - c) / Math.max(1, T.high - fall - rise) };
  if (c < T.high) return { phase: 'falling', level: (T.high - c) / fall, left: T.high - c, frac: (T.high - c) / fall };
  return { phase: 'low', level: 0, left: cycle - c, frac: (cycle - c) / T.low };
}

/** The flats (a tide lane's band, as the gauge sits over it): from `top`
 *  to `bottom`. */
export function flatsBand(ch: Pick<Channel, 'y' | 'halfWidth'>): { top: number; bottom: number } {
  return { top: ch.y - ch.halfWidth - 50, bottom: ch.y + ch.halfWidth + 50 };
}

/** How afloat a hull on the flats is at a water level: 1 afloat (the
 *  water at `float` or over), 0 aground (at `ground` or under), between
 *  them it eases to a stop. (A hull on any other lane is always afloat.) */
export function floatPace(level: number): number {
  const { ground, float } = TIDE_TURN;
  return Math.max(0, Math.min(1, (level - ground) / (float - ground)));
}

/** The water's edges at a level, as y on the map: the sea pulls back from
 *  both shores towards the deep channel's bed as the tide falls, and comes
 *  back the same way. Water lies from `top` to `bottom` and nowhere else;
 *  at level 1 that is the whole map (the shores' own edges cut it), at 0 the
 *  deep channel and `margin` px beside it. */
export function seaEdges(deep: Pick<Channel, 'y' | 'halfWidth'>, level: number, height: number): { top: number; bottom: number } {
  const margin = 34;
  const lowTop = deep.y - deep.halfWidth - margin;
  const lowBottom = deep.y + deep.halfWidth + margin;
  // Smoothed, so the water slows as it gets to either end.
  const k = Math.max(0, Math.min(1, level));
  const e = k * k * (3 - 2 * k);
  return { top: lowTop * (1 - e) - 20 * e, bottom: lowBottom + (height + 20 - lowBottom) * e };
}
