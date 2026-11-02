// Route audit (map visual-check round): sails Frigate Escort on every map at
// every level, in, on station and off again, and checks each hull against the
// land, the carrier and the other frigates. Run: npx tsx tools/v3/route-audit.ts
import { MAPS, MAP_ORDER, type MapId, type Point } from '../../src/v3/data/maps';
import { createGame, step, tap, type Game } from '../../src/v3/sim/game';

const DT = 1 / 60;

export function inPoly(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function onLand(g: Game, p: Point): boolean {
  return g.map.land.some((l) => inPoly(p, l.points));
}

/** Bow, midships and stern of a hull `half` long either side of (x, y). */
export function hullPoints(x: number, y: number, heading: number, half: number): Point[] {
  const c = Math.cos(heading), s = Math.sin(heading);
  return [-1, -0.5, 0, 0.5, 1].map((k) => ({ x: x + c * half * k, y: y + s * half * k }));
}

function quiet(map: MapId): Game {
  const g = createGame(map, 1, 3);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.threats = [];
  return g;
}

/** A hull as a box: centre, heading, half length, half beam. */
export interface Box { x: number; y: number; h: number; L: number; B: number }
function boxPoints(b: Box): Point[] {
  const c = Math.cos(b.h), s = Math.sin(b.h);
  const out: Point[] = [];
  for (const u of [-1, -0.5, 0, 0.5, 1]) for (const v of [-1, 0, 1]) out.push({ x: b.x + c * b.L * u - s * b.B * v, y: b.y + s * b.L * u + c * b.B * v });
  return out;
}
function inBox(p: Point, b: Box): boolean {
  const dx = p.x - b.x, dy = p.y - b.y;
  const c = Math.cos(b.h), s = Math.sin(b.h);
  return Math.abs(dx * c + dy * s) <= b.L && Math.abs(-dx * s + dy * c) <= b.B;
}
export function boxesOverlap(a: Box, b: Box): boolean {
  return boxPoints(a).some((p) => inBox(p, b)) || boxPoints(b).some((p) => inBox(p, a));
}
/** A frigate's hull (drawn -74..78 along, ±12 across), and the carrier's
 *  deck with its rack above it. */
export const frigateBox = (e: { x: number; y: number; heading?: number }): Box => ({ x: e.x, y: e.y, h: e.heading ?? 0, L: 76, B: 13 });
export const carrierBox = (c: Point): Box => ({ x: c.x, y: c.y - 8, h: 0, L: 90, B: 34 });

export interface FrigateIssue { map: MapId; level: number; phase: string; what: string; at: Point }

export function auditFrigates(map: MapId, level: number): { issues: FrigateIssue[]; stations: Point[] } {
  const g = quiet(map);
  g.levels = { frigate: level } as Game['levels'];
  g.slots = ['frigate'];
  g.pickups.push({ id: 99999, kind: 'weapon', weapon: 'frigate', x: 800, y: 450, age: 0 } as Game['pickups'][number]);
  tap(g, 800, 450, 60);
  const issues: FrigateIssue[] = [];
  const seen = new Set<string>();
  const note = (phase: string, what: string, at: Point) => {
    const k = `${phase}:${what}`;
    if (seen.has(k)) return;
    seen.add(k);
    issues.push({ map, level, phase, what, at: { x: Math.round(at.x), y: Math.round(at.y) } });
  };
  const c = g.map.carrier;
  let stations: Point[] = [];
  for (let i = 0; i < 60 * 40 && g.phase === 'wave'; i++) {
    if (i === 60 * 12 && g.weapon) g.weapon.t = 0; // spent: they sail off
    step(g, DT);
    g.threats = [];
    const phase = i < 60 * 12 ? (g.escorts.every((e) => Math.hypot(e.x - e.sx, e.y - e.sy) < 1) ? 'station' : 'in') : 'out';
    if (phase === 'station' && !stations.length) stations = g.escorts.map((e) => ({ x: e.x, y: e.y }));
    for (const e of g.escorts) {
      const visible = e.x > -40 && e.x < 1640 && e.y > -40 && e.y < 940;
      if (!visible) continue;
      const h = (e as { heading?: number }).heading ?? 0;
      if (hullPoints(e.x, e.y, h, 70).some((p) => onLand(g, p))) note(phase, 'hull over land', e);
      if (boxesOverlap(frigateBox(e), carrierBox(c))) note(phase, 'on the carrier', e);
      for (const o of g.escorts) if (o !== e && boxesOverlap(frigateBox(e), frigateBox(o))) note(phase, 'frigates overlap', e);
    }
    if (i > 60 * 12 && !g.escorts.length) break;
  }
  if (g.escorts.length) note('out', 'never left the screen', g.escorts[0]);
  return { issues, stations };
}

if (process.argv[1]?.endsWith('route-audit.ts')) {
  let n = 0;
  for (const map of MAP_ORDER) {
    for (const level of [1, 2, 3]) {
      const { issues } = auditFrigates(map, level);
      for (const i of issues) {
        n++;
        console.log(`${MAPS[map].name.padEnd(24)} L${level} ${i.phase.padEnd(8)} ${i.what} at (${i.at.x}, ${i.at.y})`);
      }
    }
  }
  console.log(`${n} frigate issues`);
}
