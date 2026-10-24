// The three V2 maps. Each one is a single screen: land to draw, enemy launch
// bases, where the carrier is anchored, and the channel(s) the convoy sails.
// Ships ride fixed lanes inside a channel; there is no navigation.

import { VIEW, type ThreatKind } from './config';

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
}

/** The narrowest a channel may get: Box formation's ±0.34 slots stay 22+ apart. */
export const LANE_FLOOR = 66;

/** The channel's half-width at x (constant unless it funnels). */
export function halfWidthAt(ch: Channel, x: number): number {
  if (!ch.narrow || x <= ch.narrow.fromX) return ch.halfWidth;
  const u = Math.min(1, (x - ch.narrow.fromX) / (VIEW.width - ch.narrow.fromX));
  return Math.max(LANE_FLOOR, ch.halfWidth + (ch.narrow.halfWidth - ch.halfWidth) * u);
}

export interface MapDef {
  id: MapId;
  name: string;
  blurb: string;
  land: Landmass[];
  bases: BaseDef[];
  carrier: Point;
  /** Where the Shore Battery upgrade is emplaced. */
  battery: Point;
  /** Ships alternate between channels, one spawn group at a time. */
  channels: Channel[];
  /** Multiplies every wave's threat counts — the maps get harder in order. */
  threatScale: number;
  /** Threat types this map adds to the shared wave table. */
  extras: ThreatExtra[];
  /** Where wave/new-threat banners sit: open water or friendly shore, clear of
   *  every launch base and shipping lane, so a banner never hides a launch. */
  callout: Point;
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

export const MAPS: Record<MapId, MapDef> = {
  strait: {
    id: 'strait',
    name: 'The Strait',
    blurb: 'Enemy on the north shore. Long warning times. Learn the threats.',
    land: [
      { side: 'enemy', points: shore('top', 160, 16, 0.4) },
      { side: 'friendly', points: shore('bottom', 790, 12, 1.7) },
    ],
    bases: [
      { x: 260, y: 112, kinds: ['drone'] },
      { x: 800, y: 100, kinds: ['drone', 'ballistic'] },
      { x: 1340, y: 112, kinds: ['drone', 'guided', 'ballistic'] },
    ],
    carrier: { x: 800, y: 705 },
    battery: { x: 230, y: 835 },
    channels: [{ y: 470, halfWidth: 150 }],
    threatScale: 1.15,
    extras: [],
    callout: { x: 800, y: 845 },
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
    bases: [
      { x: 300, y: 100, kinds: ['drone'] },
      { x: 1100, y: 95, kinds: ['drone', 'ballistic', 'supersonic'] },
      { x: 520, y: 815, kinds: ['drone', 'guided'] },
      { x: 1300, y: 815, kinds: ['ballistic', 'guided', 'heavy'] },
    ],
    carrier: { x: 800, y: 450 },
    battery: { x: 120, y: 450 },
    channels: [
      { y: 295, halfWidth: 90 },
      { y: 605, halfWidth: 90 },
    ],
    threatScale: 1.2,
    extras: [
      { kind: 'heavy', from: 5, count: 1, growth: 0.17 },
      { kind: 'supersonic', from: 7, count: 1, growth: 0.34 },
    ],
    callout: { x: 430, y: 450 },
  },
  island: {
    id: 'island',
    name: 'The Island',
    blurb: 'The enemy holds the island AND the far shore. Island fire gives you almost no warning.',
    land: [
      { side: 'enemy', points: shore('top', 110, 12, 1.1) },
      { side: 'enemy', points: lens(330, 1270, 360, 95) },
      { side: 'friendly', points: shore('bottom', 805, 10, 2.9) },
    ],
    bases: [
      { x: 540, y: 362, kinds: ['drone', 'guided', 'cluster'] },
      { x: 1060, y: 362, kinds: ['drone', 'ballistic'] },
      { x: 300, y: 70, kinds: ['ballistic', 'supersonic', 'heavy'] },
      { x: 800, y: 62, kinds: ['drone', 'ballistic'] },
      { x: 1300, y: 70, kinds: ['guided', 'supersonic', 'cluster'] },
    ],
    carrier: { x: 800, y: 760 },
    battery: { x: 300, y: 845 },
    channels: [{ y: 600, halfWidth: 100 }],
    threatScale: 1.2,
    extras: [
      { kind: 'supersonic', from: 4, count: 1, growth: 0.17 },
      { kind: 'heavy', from: 5, count: 1, growth: 0.2 },
      { kind: 'cluster', from: 7, count: 1, growth: 0.34 },
    ],
    callout: { x: 800, y: 855 },
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
    bases: [
      { x: 330, y: 330, kinds: ['drone', 'mothership', 'cluster'] },
      { x: 800, y: 315, kinds: ['drone', 'guided', 'heavy'] },
      { x: 1270, y: 330, kinds: ['drone', 'guided', 'supersonic'] },
      { x: 560, y: 75, kinds: ['ballistic', 'heavy', 'mothership'] },
      { x: 1050, y: 75, kinds: ['ballistic', 'supersonic', 'cluster'] },
    ],
    carrier: { x: 950, y: 730 },
    battery: { x: 260, y: 850 },
    channels: [{ y: 575, halfWidth: 100 }],
    threatScale: 1.05,
    extras: [
      { kind: 'mothership', from: 6, count: 1, growth: 0.17 },
      { kind: 'heavy', from: 6, count: 1, growth: 0.17 },
      { kind: 'cluster', from: 7, count: 1, growth: 0.25 },
      { kind: 'supersonic', from: 8, count: 1, growth: 0.25 },
    ],
    callout: { x: 700, y: 855 },
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
    bases: [
      { x: 300, y: 80, kinds: ['drone', 'ballistic', 'mothership'] },
      { x: 1180, y: 170, kinds: ['drone', 'supersonic', 'cluster'] },
      { x: 1450, y: 210, kinds: ['ballistic', 'guided', 'heavy'] },
      { x: 1300, y: 790, kinds: ['drone', 'guided', 'supersonic'] },
      { x: 1500, y: 740, kinds: ['ballistic', 'heavy', 'cluster'] },
    ],
    carrier: { x: 900, y: 690 },
    battery: { x: 1000, y: 835 },
    channels: [{ y: 470, halfWidth: 150, narrow: { fromX: 700, halfWidth: 66 } }],
    threatScale: 1.1,
    extras: [
      { kind: 'supersonic', from: 4, count: 1, growth: 0.2 },
      { kind: 'heavy', from: 5, count: 1, growth: 0.15 },
      { kind: 'cluster', from: 6, count: 1, growth: 0.2 },
      { kind: 'mothership', from: 7, count: 1, growth: 0.15 },
    ],
    callout: { x: 380, y: 855 },
  },
};

export const MAP_ORDER: MapId[] = ['strait', 'gauntlet', 'island', 'harbor', 'archipelago'];
