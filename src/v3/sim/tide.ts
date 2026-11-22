// THE TIDE (Tidewater Flats): where the tide is at a moment, as a pure
// function of the map and the clocks, so the sim (game.ts), the telemetry
// and the drawing all read the same tide.
//
// Log v59 (the player: "the ships did not navigate off the low tide area,
// make sure that mechanic actually works"). The tide no longer snaps from
// high to low: it falls over TIDE_TURN.fall s before low water and rises
// over TIDE_TURN.rise s after it. The flats lane takes new ships only at
// high water; as soon as the tide starts to fall every ship on the flats
// crosses to the deep channel (game.ts updateShips, TIDE_TURN.cross px/s),
// ahead of the sand, which shows from the shore side up (`sandEdge`), so no
// ship is ever on exposed sand and none is left on it.

import type { Channel, MapDef } from '../data/mapTypes';

export type TidePhase = 'high' | 'falling' | 'low' | 'rising';

/** Seconds the tide takes to fall before low water and to rise after it,
 *  and how fast a ship on the flats crosses to the deep channel as it
 *  falls (px/s: the flats lane to the deep channel, about 290 px, in under
 *  2.5 s, ahead of the sand). */
export const TIDE_TURN = { fall: 4, rise: 3, cross: 120 } as const;

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

/** The flats (a tide lane's band, as drawn): from `top` to `bottom`. */
export function flatsBand(ch: Pick<Channel, 'y' | 'halfWidth'>): { top: number; bottom: number } {
  return { top: ch.y - ch.halfWidth - 50, bottom: ch.y + ch.halfWidth + 50 };
}

/** Where the sand ends at a water level: the water leaves the flats from
 *  the shore side (the bottom of the band) up towards the deep channel as
 *  it falls, and comes back the same way. Sand lies below this y (none at
 *  level 1, the whole band at level 0). */
export function sandEdge(ch: Pick<Channel, 'y' | 'halfWidth'>, level: number): number {
  const { top, bottom } = flatsBand(ch);
  return top + (bottom - top) * Math.max(0, Math.min(1, level));
}
