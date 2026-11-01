// The shape of a map (src/v3/data/maps.ts holds the maps themselves). Kept
// apart from the map data so the twenty maps can live in two files without an
// import cycle. Everything added for the 20-map plan
// (docs/design/v3-maps-plan.md) is optional: the original five maps don't set
// any of it and play exactly as before.

import { VIEW, type ThreatKind, type VectorPlan } from './config';

/** A threat type a map adds on top of the shared wave table: `count` of them
 *  from wave `from`, growing by `growth` per wave after that. */
export interface ThreatExtra {
  kind: ThreatKind;
  from: number;
  count: number;
  growth: number;
}

export type MapId =
  | 'strait'
  | 'gauntlet'
  | 'island'
  | 'archipelago'
  | 'harbor'
  | 'kesh'
  | 'marrow'
  | 'behemoth'
  | 'needle'
  | 'saltgate'
  | 'battery'
  | 'sowers'
  | 'rigs'
  | 'lantern'
  | 'dreadnought'
  | 'coves'
  | 'delta'
  | 'crossing'
  | 'tide'
  | 'citadel';

export interface Point {
  x: number;
  y: number;
}

export interface Landmass {
  side: 'enemy' | 'friendly';
  points: Point[];
  /** Drawn as a hill: contour rings rising to a ridge (round 13). */
  hill?: boolean;
}

export interface BaseDef {
  x: number;
  y: number;
  /** Which threats this base can launch. */
  kinds: ThreatKind[];
  /** An oil rig (The Rig Field): the launcher stands in the sea with hit
   *  points; destroyed, it stays down for the rest of the run. */
  rig?: { hp: number };
  /** A shield generator (Citadel of Vey): hit points, launches nothing. */
  generator?: { hp: number };
  /** The Citadel: hit points behind the shield; silenced at 0. */
  core?: { hp: number };
  /** A cove (Smugglers' Coves): fast boats come out of it; drawn as an inlet,
   *  not a silo. */
  cove?: boolean;
  /** A mine chute (Sowers' Reach): drawn as a ramp on the shore. */
  chute?: boolean;
}

export interface Channel {
  /** A straight lane's centre line. For a path lane, the y the lane is known
   *  by (strafers line up on it before they find the convoy). */
  y: number;
  halfWidth: number;
  /** A funnel: from x = `fromX` the channel narrows linearly to `halfWidth`
   *  at the right edge (never below LANE_FLOOR, so hulls never stack). */
  narrow?: { fromX: number; halfWidth: number };
  /** Spawn groups this channel takes per cycle (default 1): a riskier lane
   *  can carry fewer ships than a safe one. 0: it takes none from the cycle
   *  (the supertanker's lane). */
  share?: number;
  /** Ships in this channel run this much faster (default 1): a riskier lane
   *  is crossed quickly. */
  speed?: number;
  /** A path lane: ships follow this polyline from its first point and
   *  deliver off its last. Without one, the lane runs straight along `y`
   *  from x = -40 to x = 1640. */
  path?: Point[];
  /** Half-width stops [x, halfWidth], interpolated by x (instead of
   *  halfWidth/narrow). May drop below LANE_FLOOR: ships then merge into one
   *  file there (The Needle of Bosk). */
  widths?: [number, number][];
  /** Open only at high tide (Tidewater Flats). */
  tide?: boolean;
  /** The supertanker's lane (The Behemoth Run): one tanker a wave sails it. */
  vip?: boolean;
  /** Shown on the water by the lane's entry (e.g. "OUTBOUND →"). */
  label?: string;
}

/** The order ships take the channels in: each channel `share` times a cycle. */
export function channelCycle(m: { channels: Channel[] }): number[] {
  return m.channels.flatMap((c, i) => Array.from({ length: c.share ?? 1 }, () => i));
}

/** The narrowest a channel may get: Box formation's ±0.34 slots stay 22+ apart. */
export const LANE_FLOOR = 66;

/** The channel's half-width at x (constant unless it funnels). */
export function halfWidthAt(ch: Channel, x: number): number {
  if (ch.widths) {
    const s = ch.widths;
    if (x <= s[0][0]) return s[0][1];
    for (let i = 1; i < s.length; i++) {
      if (x <= s[i][0]) return s[i - 1][1] + ((s[i][1] - s[i - 1][1]) * (x - s[i - 1][0])) / (s[i][0] - s[i - 1][0]);
    }
    return s[s.length - 1][1];
  }
  if (!ch.narrow || x <= ch.narrow.fromX) return ch.halfWidth;
  const u = Math.min(1, (x - ch.narrow.fromX) / (VIEW.width - ch.narrow.fromX));
  return Math.max(LANE_FLOOR, ch.halfWidth + (ch.narrow.halfWidth - ch.halfWidth) * u);
}

/** Enemy roads for missile trucks (round 4). A runner drives a whole path,
 *  stopping to fire; a pop-up drives from `from` (off screen or a bunker) to
 *  `to` at the shore, fires, and reverses back out. */
export interface Roads {
  runners: Point[][];
  popups: { from: Point; to: Point }[];
}

/** An allied structure (the plan's maps 3 and 11). A radar tower's sweep
 *  tracks threats inside `reach` (shots fly faster at them) until the enemy
 *  brings it down for good; a shore battery fires on its own at threats in
 *  reach, and a hit knocks it out for a while. */
export interface PostDef {
  kind: 'radar' | 'battery';
  x: number;
  y: number;
  hp: number;
  reach: number;
}

/** A lock on a lane (Saltgate Canal): the chamber between x0 and x1. */
export interface LockDef {
  x0: number;
  x1: number;
  /** Seconds ships wait in the chamber while it fills. */
  wait: number;
}

/** The Dreadnought (map 15): a battleship that steams along `path` on the
 *  waves listed, firing from its turrets. */
export interface BossDef {
  path: Point[];
  hp: number;
  waves: number[];
}

export interface MapDef {
  id: MapId;
  name: string;
  blurb: string;
  land: Landmass[];
  bases: BaseDef[];
  carrier: Point;
  /** Where the Escort Frigate holds station: open water beside the carrier,
   *  clear of the lanes, sub spots and banners (it sails in from the left). */
  frigate: Point;
  /** Ships alternate between channels, one spawn group at a time. */
  channels: Channel[];
  /** Multiplies every wave's threat counts — the maps get harder in order. */
  threatScale: number;
  /** Threat types this map adds to the shared wave table. */
  extras: ThreatExtra[];
  /** Where wave/new-threat banners sit: open water or friendly shore, clear of
   *  every launch base and shipping lane, so a banner never hides a launch. */
  callout: Point;
  /** Round 14: the strip of shore the notification tray sits on, in world
   *  units: from x0 to x1, its bottom edge at y, clear of the carrier, the
   *  frigate's station and every base. Cards sit side by side along it and
   *  grow upward; `max` cards at once (default 2). */
  alerts: { x0: number; x1: number; y: number; max?: number };
  /** Round 4: truck roads, open-water spots where submarines surface (clear of
   *  the shipping lanes), and from which wave each attack vector joins. */
  roads: Roads;
  subSpots: Point[];
  /** Lines bombers fly along: open water outside the shipping lanes, so the
   *  aircraft stands out against the sea and its missiles have a way to go. */
  bomberLines: number[];
  vectors: VectorPlan;

  // ---- The 20-map plan (all optional) ----
  /** Frigate Escort stations, where lanes aren't straight. */
  escortStations?: Point[];
  /** Allied structures: a radar tower, shore batteries. */
  posts?: PostDef[];
  /** Locks on every lane (Saltgate Canal). */
  locks?: LockDef[];
  /** Drift of mines, world units a second (Sowers' Reach). */
  current?: Point;
  /** Night (The Black Strait): a lighthouse beam sweeps from `light` between
   *  angles a0 and a1 (degrees, y down) every `period` s. */
  night?: { light: Point; a0: number; a1: number; period: number; width: number; reach: number };
  /** The Dreadnought's passes (Dreadnought Pass). */
  boss?: BossDef;
  /** The fork's switch buoy (The Sharra Delta): tapping it sends the next
   *  ships down the next of these lanes. */
  fork?: { x: number; y: number; lanes: number[]; start: number };
  /** The tide (Tidewater Flats): seconds of high water, then of low. */
  tide?: { high: number; low: number };
  /** The Citadel's shield: up while any generator stands. */
  shield?: { x: number; y: number; r: number };
  /** Words painted on the map (lock names, "THE TURN"...). */
  marks?: { x: number; y: number; text: string }[];
}
