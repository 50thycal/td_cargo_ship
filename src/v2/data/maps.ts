// The three V2 maps. Each one is a single screen: land to draw, enemy launch
// bases, where the carrier is anchored, and the channel(s) the convoy sails.
// Ships ride fixed lanes inside a channel; there is no navigation.

import { VIEW, type ThreatKind } from './config';

export type MapId = 'strait' | 'gauntlet' | 'island';

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
      { x: 1100, y: 95, kinds: ['drone', 'ballistic'] },
      { x: 520, y: 815, kinds: ['drone', 'guided'] },
      { x: 1300, y: 815, kinds: ['ballistic', 'guided'] },
    ],
    carrier: { x: 800, y: 450 },
    battery: { x: 120, y: 450 },
    channels: [
      { y: 295, halfWidth: 90 },
      { y: 605, halfWidth: 90 },
    ],
    threatScale: 1.35,
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
      { x: 540, y: 362, kinds: ['drone', 'guided'] },
      { x: 1060, y: 362, kinds: ['drone', 'ballistic'] },
      { x: 300, y: 70, kinds: ['ballistic'] },
      { x: 800, y: 62, kinds: ['drone', 'ballistic'] },
      { x: 1300, y: 70, kinds: ['guided'] },
    ],
    carrier: { x: 800, y: 760 },
    battery: { x: 300, y: 845 },
    channels: [{ y: 600, halfWidth: 100 }],
    threatScale: 1.55,
    callout: { x: 800, y: 855 },
  },
};

export const MAP_ORDER: MapId[] = ['strait', 'gauntlet', 'island'];
