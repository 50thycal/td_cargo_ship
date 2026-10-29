// The three V2 maps. Each one is a single screen: land to draw, enemy launch
// bases, where the carrier is anchored, and the channel(s) the convoy sails.
// Ships ride fixed lanes inside a channel; there is no navigation.

import { VIEW, type ThreatKind, type VectorPlan } from './config';

/** A threat type a map adds on top of the shared wave table: `count` of them
 *  from wave `from`, growing by `growth` per wave after that. */
export interface ThreatExtra {
  kind: ThreatKind;
  from: number;
  count: number;
  growth: number;
}

export type MapId = 'strait' | 'gauntlet' | 'island' | 'archipelago' | 'harbor';

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
}

export interface Channel {
  y: number;
  halfWidth: number;
  /** A funnel: from x = `fromX` the channel narrows linearly to `halfWidth`
   *  at the right edge (never below LANE_FLOOR, so hulls never stack). */
  narrow?: { fromX: number; halfWidth: number };
  /** Spawn groups this channel takes per cycle (default 1): a riskier lane
   *  can carry fewer ships than a safe one. */
  share?: number;
  /** Ships in this channel run this much faster (default 1): a riskier lane
   *  is crossed quickly. */
  speed?: number;
}

/** The order ships take the channels in: each channel `share` times a cycle. */
export function channelCycle(m: { channels: Channel[] }): number[] {
  return m.channels.flatMap((c, i) => Array.from({ length: c.share ?? 1 }, () => i));
}

/** The narrowest a channel may get: Box formation's ±0.34 slots stay 22+ apart. */
export const LANE_FLOOR = 66;

/** The channel's half-width at x (constant unless it funnels). */
export function halfWidthAt(ch: Channel, x: number): number {
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
  /** Round 4: truck roads, open-water spots where submarines surface (clear of
   *  the shipping lanes), and from which wave each attack vector joins. */
  roads: Roads;
  subSpots: Point[];
  /** Lines bombers fly along: open water outside the shipping lanes, so the
   *  aircraft stands out against the sea and its missiles have a way to go. */
  bomberLines: number[];
  vectors: VectorPlan;
}

const W = VIEW.width;
const H = VIEW.height;

/** A wavy coastline from x=0 to x=W, closed off against the top or bottom edge. */
function shore(edge: 'top' | 'bottom', y: number, amp: number, phase: number): Point[] {
  const pts: Point[] = [];
  for (let x = 0; x <= W; x += 50) {
    const wobble =
      Math.sin(x / 210 + phase) * amp + Math.sin(x / 83 + phase * 2.3) * amp * 0.35;
    pts.push({ x, y: Math.round(y + wobble) });
  }
  const capY = edge === 'top' ? 0 : H;
  return [{ x: 0, y: capY }, ...pts, { x: W, y: capY }];
}

/** An island shaped like a lens: thickest amidships, tapering to each tip. */
function lens(x0: number, x1: number, cy: number, half: number): Point[] {
  const top: Point[] = [];
  const bottom: Point[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = x0 + (x1 - x0) * u;
    const h = half * Math.sin(Math.PI * u) ** 0.7;
    const ripple = Math.sin(u * 17) * 6;
    top.push({ x, y: cy - h + ripple });
    bottom.push({ x, y: cy + h - ripple * 0.6 });
  }
  return [...top, ...bottom.reverse()];
}

function islet(cx: number, cy: number, r: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rr = r * (1 + Math.sin(i * 2.1) * 0.12);
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  return pts;
}

/** A wavy line from (x0, y0) to (x1, y1). */
function curve(x0: number, y0: number, x1: number, y1: number, phase: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const x = x0 + (x1 - x0) * u;
    pts.push({ x, y: Math.round(y0 + (y1 - y0) * u + Math.sin(u * 9 + phase) * 10) });
  }
  return pts;
}

/** Round 13: a truck road that follows `path` but swings inland around every
 *  base it would otherwise drive over (`inland` = -1 for a north shore, +1
 *  for a south shore), so trucks keep to the coast and never cross a silo.
 *  The detour is a smooth bump CLEAR px behind the base, REACH px either side. */
const CLEAR = 54;
const REACH = 120;
function bypass(path: Point[], bases: { x: number; y: number }[], inland: -1 | 1): Point[] {
  const at = (x: number): number => {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      if ((x - a.x) * (x - b.x) <= 0 && a.x !== b.x) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    }
    return path[x < path[0].x === path[0].x < path[path.length - 1].x ? 0 : path.length - 1].y;
  };
  const x0 = path[0].x;
  const x1 = path[path.length - 1].x;
  const out: Point[] = [];
  const n = Math.ceil(Math.abs(x1 - x0) / 20);
  for (let k = 0; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n;
    let y = at(x);
    for (const b of bases) {
      const dx = Math.abs(x - b.x);
      if (dx >= REACH) continue;
      // How far the road has to move to sit CLEAR px behind this base.
      const need = -inland * (y - (b.y + inland * CLEAR));
      if (need <= 0) continue;
      const bump = 0.5 + 0.5 * Math.cos((Math.PI * dx) / REACH);
      y += inland * need * bump;
    }
    // Never so far inland that a truck hangs off the screen.
    out.push({ x: Math.round(x), y: Math.round(Math.max(20, Math.min(880, y))) });
  }
  return out;
}

const STRAIT_BASES: BaseDef[] = [
  { x: 260, y: 112, kinds: ['drone', 'supersonic'] },
  { x: 800, y: 100, kinds: ['drone', 'ballistic', 'heavy'] },
  { x: 1340, y: 112, kinds: ['drone', 'guided', 'ballistic', 'supersonic'] },
];
const GAUNTLET_BASES: BaseDef[] = [
  { x: 300, y: 100, kinds: ['drone'] },
  { x: 1100, y: 95, kinds: ['drone', 'ballistic', 'supersonic'] },
  { x: 520, y: 815, kinds: ['drone', 'guided'] },
  { x: 1300, y: 815, kinds: ['ballistic', 'guided', 'heavy'] },
];
const ISLAND_BASES: BaseDef[] = [
  { x: 540, y: 362, kinds: ['drone', 'guided', 'cluster'] },
  { x: 1060, y: 362, kinds: ['drone', 'ballistic'] },
  { x: 300, y: 70, kinds: ['ballistic', 'supersonic', 'heavy'] },
  { x: 800, y: 62, kinds: ['drone', 'ballistic'] },
  { x: 1300, y: 70, kinds: ['guided', 'supersonic', 'cluster'] },
];
const ARCHIPELAGO_BASES: BaseDef[] = [
  { x: 330, y: 330, kinds: ['drone', 'mothership', 'cluster'] },
  { x: 800, y: 315, kinds: ['drone', 'guided', 'heavy'] },
  { x: 1270, y: 330, kinds: ['drone', 'guided', 'supersonic'] },
  { x: 560, y: 75, kinds: ['ballistic', 'heavy', 'mothership'] },
  { x: 1050, y: 75, kinds: ['ballistic', 'supersonic', 'cluster'] },
];
const HARBOR_BASES: BaseDef[] = [
  { x: 300, y: 80, kinds: ['drone', 'ballistic', 'mothership'] },
  { x: 1180, y: 170, kinds: ['drone', 'supersonic', 'cluster'] },
  { x: 1450, y: 210, kinds: ['ballistic', 'guided', 'heavy'] },
  { x: 1300, y: 790, kinds: ['drone', 'guided', 'supersonic'] },
  { x: 1500, y: 740, kinds: ['ballistic', 'heavy', 'cluster'] },
];

export const MAPS: Record<MapId, MapDef> = {
  strait: {
    id: 'strait',
    name: 'The Strait',
    blurb: 'Enemy on the north shore. Long warning times. Learn the threats.',
    land: [
      { side: 'enemy', points: shore('top', 160, 16, 0.4) },
      { side: 'friendly', points: shore('bottom', 790, 12, 1.7) },
    ],
    bases: STRAIT_BASES,
    carrier: { x: 800, y: 705 },
    frigate: { x: 580, y: 700 },
    channels: [{ y: 470, halfWidth: 150 }],
    threatScale: 1.15,
    // Round 3: careful play lost ~0.5 ships here; a late taste of supersonics
    // and one heavy in the finale tests reaction, not just ammo.
    extras: [
      { kind: 'supersonic', from: 6, count: 1, growth: 0.34 },
      { kind: 'heavy', from: 10, count: 1, growth: 0 },
    ],
    callout: { x: 800, y: 845 },
    roads: {
      runners: [bypass([{ x: -60, y: 124 }, { x: 400, y: 120 }, { x: 800, y: 130 }, { x: 1200, y: 122 }, { x: 1660, y: 124 }], STRAIT_BASES, -1)],
      popups: [
        { from: { x: 540, y: -40 }, to: { x: 540, y: 128 } },
        { from: { x: 1070, y: -40 }, to: { x: 1070, y: 130 } },
        { from: { x: 1520, y: -40 }, to: { x: 1520, y: 124 } },
      ],
    },
    subSpots: [{ x: 420, y: 250 }, { x: 1180, y: 245 }, { x: 1520, y: 250 }, { x: 260, y: 690 }, { x: 1350, y: 700 }, { x: 1100, y: 705 }],
    bomberLines: [240, 672],
    vectors: { trucks: 2, subs: 3, strafers: 5, bombers: 7 },
  },
  gauntlet: {
    id: 'gauntlet',
    name: 'The Gauntlet',
    blurb: 'Enemy on both shores. Your carrier holds the middle; ships pass either side.',
    land: [
      { side: 'enemy', points: shore('top', 150, 14, 2.2) },
      { side: 'enemy', points: shore('bottom', 760, 14, 0.9) },
      { side: 'friendly', points: islet(120, 450, 42) },
    ],
    bases: GAUNTLET_BASES,
    carrier: { x: 800, y: 450 },
    frigate: { x: 1040, y: 455 },
    channels: [
      { y: 295, halfWidth: 90 },
      { y: 605, halfWidth: 90 },
    ],
    threatScale: 1.2,
    extras: [
      { kind: 'heavy', from: 5, count: 1, growth: 0.17 },
      { kind: 'supersonic', from: 7, count: 1, growth: 0.34 },
    ],
    // Bottom of the screen like every other map (round 5: mid-channel sat on
    // the action), between the two south-shore bases.
    callout: { x: 910, y: 865 },
    roads: {
      runners: [
        bypass([{ x: -60, y: 118 }, { x: 800, y: 112 }, { x: 1660, y: 118 }], GAUNTLET_BASES.slice(0, 2), -1),
        bypass([{ x: 1660, y: 800 }, { x: 800, y: 805 }, { x: -60, y: 800 }], GAUNTLET_BASES.slice(2), 1),
      ],
      popups: [
        { from: { x: 700, y: -40 }, to: { x: 700, y: 122 } },
        { from: { x: 1450, y: -40 }, to: { x: 1450, y: 120 } },
        { from: { x: 200, y: 940 }, to: { x: 200, y: 788 } },
        { from: { x: 900, y: 940 }, to: { x: 900, y: 790 } },
      ],
    },
    subSpots: [{ x: 330, y: 450 }, { x: 1300, y: 450 }, { x: 1480, y: 450 }],
    bomberLines: [450],
    vectors: { trucks: 2, subs: 3, strafers: 4, bombers: 6 },
  },
  island: {
    id: 'island',
    name: 'The Island',
    blurb: 'The enemy holds the island AND the far shore. Island fire gives you almost no warning.',
    land: [
      { side: 'enemy', points: shore('top', 110, 12, 1.1) },
      { side: 'enemy', points: lens(330, 1270, 360, 95), hill: true },
      { side: 'friendly', points: shore('bottom', 805, 10, 2.9) },
    ],
    bases: ISLAND_BASES,
    carrier: { x: 800, y: 760 },
    frigate: { x: 560, y: 760 },
    // Round 7: a second lane north of the island (the player: ships only ever
    // took the south). It runs between the far shore and the island, far from
    // the carrier, so it is the risky route: it carries one group in three,
    // and they make a fast run for it.
    channels: [
      { y: 600, halfWidth: 100, share: 2 },
      { y: 190, halfWidth: 66, speed: 1.5 },
    ],
    // Round 13: the player never cleared it (0 of 7 runs), nor did the you-bot
    // (2-3 of 30): a little less fire, and its extra threats come two waves
    // later, so the mid-game (waves 5-8, where it was lost) eases. The you-bot
    // now clears ~30%, the try-hard bot ~60% (docs/design/v2-island-round13.md).
    threatScale: 0.95,
    extras: [
      { kind: 'supersonic', from: 6, count: 1, growth: 0.17 },
      { kind: 'heavy', from: 7, count: 1, growth: 0.2 },
      { kind: 'cluster', from: 8, count: 1, growth: 0.34 },
    ],
    callout: { x: 800, y: 855 },
    roads: {
      runners: [
        bypass([{ x: -60, y: 82 }, { x: 800, y: 78 }, { x: 1660, y: 82 }], ISLAND_BASES.slice(2), -1),
        // Round 13: the island road runs along its south flank, from a tunnel
        // in the west of the hill to one in the east, clear of both bases.
        [
          { x: 492, y: 388 },
          { x: 570, y: 412 },
          { x: 800, y: 426 },
          { x: 1030, y: 412 },
          { x: 1108, y: 388 },
        ],
      ],
      popups: [
        { from: { x: 560, y: -40 }, to: { x: 560, y: 90 } },
        { from: { x: 1060, y: -40 }, to: { x: 1060, y: 90 } },
        // Out of caves in the hillside, across the road, down to the shore.
        { from: { x: 700, y: 376 }, to: { x: 700, y: 444 } },
        { from: { x: 930, y: 376 }, to: { x: 930, y: 446 } },
      ],
    },
    subSpots: [{ x: 180, y: 380 }, { x: 1430, y: 380 }, { x: 300, y: 748 }, { x: 1300, y: 748 }],
    bomberLines: [480, 745],
    vectors: { trucks: 1, subs: 3, strafers: 4, bombers: 5 },
  },
  archipelago: {
    id: 'archipelago',
    name: 'The Archipelago',
    blurb: 'Enemy islets with gaps between them, and drone motherships. The west end is a long reach from the carrier.',
    land: [
      { side: 'enemy', points: shore('top', 120, 12, 0.7) },
      { side: 'enemy', points: islet(330, 330, 62) },
      { side: 'enemy', points: islet(800, 315, 70) },
      { side: 'enemy', points: islet(1270, 330, 58) },
      { side: 'friendly', points: shore('bottom', 805, 12, 2.2) },
    ],
    bases: ARCHIPELAGO_BASES,
    carrier: { x: 950, y: 730 },
    frigate: { x: 1190, y: 735 },
    channels: [{ y: 575, halfWidth: 100 }],
    threatScale: 1.05,
    extras: [
      { kind: 'mothership', from: 6, count: 1, growth: 0.17 },
      { kind: 'heavy', from: 6, count: 1, growth: 0.17 },
      { kind: 'cluster', from: 7, count: 1, growth: 0.25 },
      { kind: 'supersonic', from: 8, count: 1, growth: 0.25 },
    ],
    callout: { x: 700, y: 855 },
    roads: {
      runners: [bypass([{ x: -60, y: 92 }, { x: 800, y: 88 }, { x: 1660, y: 92 }], ARCHIPELAGO_BASES.slice(3), -1)],
      popups: [
        // Round 13: out of a cave beside each islet's silo (they used to
        // start on the silo itself), down to the water.
        { from: { x: 374, y: 346 }, to: { x: 376, y: 386 } },
        { from: { x: 846, y: 332 }, to: { x: 848, y: 378 } },
        { from: { x: 1312, y: 346 }, to: { x: 1314, y: 382 } },
        { from: { x: 300, y: -40 }, to: { x: 300, y: 100 } },
        { from: { x: 1500, y: -40 }, to: { x: 1500, y: 100 } },
      ],
    },
    subSpots: [{ x: 565, y: 335 }, { x: 1035, y: 335 }, { x: 120, y: 335 }, { x: 1500, y: 335 }, { x: 500, y: 742 }, { x: 1490, y: 742 }],
    bomberLines: [205, 745],
    vectors: { trucks: 1, subs: 2, strafers: 3, bombers: 4 },
  },
  harbor: {
    id: 'harbor',
    name: 'Harbor Mouth',
    blurb: 'The channel funnels into the harbour under enemy headlands. The worst of it comes right before delivery.',
    land: [
      { side: 'enemy', points: [{ x: 0, y: 0 }, ...curve(0, 140, 1600, 300, 0.4), { x: 1600, y: 0 }] },
      { side: 'friendly', points: [{ x: 0, y: 900 }, ...curve(0, 800, 1050, 770, 1.6), { x: 1050, y: 900 }] },
      { side: 'enemy', points: [{ x: 1050, y: 900 }, ...curve(1050, 770, 1600, 640, 2.4), { x: 1600, y: 900 }] },
    ],
    bases: HARBOR_BASES,
    carrier: { x: 900, y: 690 },
    frigate: { x: 660, y: 690 },
    channels: [{ y: 470, halfWidth: 150, narrow: { fromX: 700, halfWidth: 66 } }],
    threatScale: 1.0,
    extras: [
      { kind: 'supersonic', from: 4, count: 1, growth: 0.2 },
      { kind: 'heavy', from: 5, count: 1, growth: 0.15 },
      { kind: 'cluster', from: 6, count: 1, growth: 0.2 },
      { kind: 'mothership', from: 7, count: 1, growth: 0.15 },
    ],
    callout: { x: 380, y: 855 },
    roads: {
      runners: [
        bypass([{ x: -60, y: 100 }, { x: 400, y: 140 }, { x: 800, y: 180 }, { x: 1200, y: 222 }, { x: 1660, y: 262 }], HARBOR_BASES.slice(0, 3), -1),
        bypass([{ x: 1660, y: 690 }, { x: 1350, y: 762 }, { x: 1090, y: 822 }], HARBOR_BASES.slice(3), 1),
      ],
      popups: [
        { from: { x: 600, y: -40 }, to: { x: 600, y: 165 } },
        { from: { x: 1000, y: -40 }, to: { x: 1000, y: 214 } },
        { from: { x: 1250, y: 940 }, to: { x: 1250, y: 765 } },
      ],
    },
    subSpots: [{ x: 250, y: 250 }, { x: 1450, y: 345 }, { x: 300, y: 705 }],
    bomberLines: [255, 715],
    vectors: { trucks: 1, subs: 2, strafers: 3, bombers: 4 },
  },
};

export const MAP_ORDER: MapId[] = ['strait', 'gauntlet', 'island', 'harbor', 'archipelago'];
