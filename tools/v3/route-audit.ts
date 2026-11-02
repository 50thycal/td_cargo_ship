// Route audit (map visual-check round): sails Frigate Escort on every map at
// every level, in, on station and off again, and checks each hull against the
// land, the carrier and the other frigates. Run: npx tsx tools/v3/route-audit.ts
declare const process: { argv: string[] };
import { MAPS, MAP_ORDER, type MapId, type Point } from '../../src/v3/data/maps';
import { laneAt, laneHalfWidth, laneLength } from '../../src/v3/sim/lanes';
import { createGame, step, tap, type Game } from '../../src/v3/sim/game';

const DT = 1 / 60;

/** Inside a polygon by the non-zero winding rule: the rule the canvas fills
 *  land with, so a coast that loops back on itself counts as it is drawn. */
export function inPoly(p: Point, poly: Point[]): boolean {
  let wind = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j], b = poly[i];
    const cross = (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y);
    if (a.y <= p.y) {
      if (b.y > p.y && cross > 0) wind++;
    } else if (b.y <= p.y && cross < 0) wind--;
  }
  return wind !== 0;
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

if (process.argv[1]?.endsWith('route-audit.ts') && process.argv[2] !== 'maps') {
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

// ---- Cycle 3: everything else that depends on a map's shape ----

function landSide(m: { land: { side: string; points: Point[] }[] }, p: Point): 'enemy' | 'friendly' | null {
  for (const l of m.land) if (inPoly(p, l.points)) return l.side as 'enemy' | 'friendly';
  return null;
}
const onScreen = (p: Point, pad = 0) => p.x >= -pad && p.x <= 1600 + pad && p.y >= -pad && p.y <= 900 + pad;
function sample(path: Point[], step = 10): Point[] {
  const out: Point[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  out.push(path[path.length - 1]);
  return out;
}

export interface MapIssue { map: MapId; what: string; at?: Point }

export function auditMap(map: MapId): MapIssue[] {
  const m = MAPS[map];
  const g = createGame(map, 1, 1);
  const out: MapIssue[] = [];
  const add = (what: string, at?: Point) => out.push({ map, what, ...(at ? { at: { x: Math.round(at.x), y: Math.round(at.y) } } : {}) });
  const inLane = (p: Point, pad: number) =>
    m.channels.some((ch) => {
      let best = Infinity;
      for (let d = -40; d <= laneLength(ch) + 40; d += 8) {
        const q = laneAt(ch, d, 0);
        const dd = Math.hypot(q.x - p.x, q.y - p.y);
        if (dd < best) best = dd;
        if (dd < laneHalfWidth(ch, d) + pad) return true;
      }
      return false;
    });
  // Truck roads: on enemy land wherever they are on screen, never over a silo.
  m.roads.runners.forEach((road, i) => {
    let wet = 0, friendly = 0, silo: Point | null = null, wetAt: Point | null = null;
    for (const p of sample(road)) {
      if (!onScreen(p, -8)) continue;
      const s = landSide(m, p);
      if (s === null) { wet++; wetAt ??= p; }
      if (s === 'friendly') friendly++;
      for (const b of m.bases) if (!b.rig && !b.cove && Math.hypot(b.x - p.x, b.y - p.y) < 30) silo ??= p;
    }
    if (wet) add(`runner road ${i} in the water (${wet} points)`, wetAt!);
    if (friendly) add(`runner road ${i} on friendly land`);
    if (silo) add(`runner road ${i} drives over a silo`, silo);
  });
  m.roads.popups.forEach((r, i) => {
    let wet: Point | null = null;
    for (const p of sample([r.from, r.to], 6)) if (onScreen(p, -8) && landSide(m, p) === null) wet ??= p;
    if (wet) add(`pop-up road ${i} in the water`, wet);
    // It must reach the shore: water within 90 of where it stops.
    let shore = false;
    for (let a = 0; a < 16 && !shore; a++) for (const rr of [40, 60, 90]) {
      const q = { x: r.to.x + Math.cos((a / 16) * Math.PI * 2) * rr, y: r.to.y + Math.sin((a / 16) * Math.PI * 2) * rr };
      if (onScreen(q) && landSide(m, q) === null) shore = true;
    }
    if (!shore) add(`pop-up road ${i} stops far from the shore`, r.to);
  });
  // Submarines surface on open water, off the lanes, clear of the carrier.
  for (const sp of m.subSpots) {
    for (const p of hullPoints(sp.x, sp.y, 0, 36)) if (landSide(m, p)) { add('sub spot on land', sp); break; }
    if (inLane(sp, 10)) add('sub spot in a shipping lane', sp);
    if (Math.hypot(sp.x - m.carrier.x, sp.y - m.carrier.y) < 140) add('sub spot on the carrier', sp);
  }
  // Bomber lines (maps where bombers fly straight): mostly over water, off
  // the lanes, and not along the screen edge.
  if (!m.channels.some((c) => c.path && c.path.some((p, i) => i && Math.abs(p.y - c.path![i - 1].y) > 0.15 * Math.abs(p.x - c.path![i - 1].x) + 2))) {
    for (const y of m.bomberLines) {
      let land = 0, lane = 0, n = 0;
      for (let x = 40; x <= 1560; x += 20) {
        n++;
        if (landSide(m, { x, y })) land++;
        if (inLane({ x, y }, -20)) lane++;
      }
      if (land / n > 0.35) add(`bomber line y=${y} is ${Math.round((100 * land) / n)}% over land`);
      if (lane / n > 0.25) add(`bomber line y=${y} runs ${Math.round((100 * lane) / n)}% inside a lane`);
      if (y < 70 || y > 830) add(`bomber line y=${y} hugs the screen edge`);
    }
  }
  // The carrier and posts: carrier on water, posts on friendly land.
  for (const p of hullPoints(m.carrier.x, m.carrier.y, 0, 80)) if (landSide(m, p)) { add('carrier hull on land', m.carrier); break; }
  for (const p of m.posts ?? []) if (landSide(m, p) !== 'friendly') add(`${p.kind} not on friendly land`, p);
  // Coves and mine chutes sit at the shore.
  for (const b of m.bases) {
    if (!b.cove && !b.chute) continue;
    let water = false;
    for (let a = 0; a < 16 && !water; a++) for (const rr of [30, 50, 70]) {
      const q = { x: b.x + Math.cos((a / 16) * Math.PI * 2) * rr, y: b.y + Math.sin((a / 16) * Math.PI * 2) * rr };
      if (onScreen(q) && !landSide(m, q)) water = true;
    }
    if (!water) add(`${b.cove ? 'cove' : 'chute'} far from the water`, b);
  }
  // The Dreadnought's track: on water.
  if (m.boss) {
    let wet: Point | null = null;
    for (const p of sample(m.boss.path)) if (onScreen(p) && landSide(m, p)) wet ??= p;
    if (wet) add('dreadnought track over land', wet);
  }
  // Ordinary bases (silos) on enemy land.
  for (const b of m.bases) if (!b.rig && !b.cove && !b.chute && !b.generator && !b.core && landSide(m, b) !== 'enemy') add('silo not on enemy land', b);
  void g;
  return out;
}

if (process.argv[1]?.endsWith('route-audit.ts') && process.argv[2] === 'maps') {
  let n = 0;
  for (const map of MAP_ORDER) for (const i of auditMap(map)) {
    n++;
    console.log(`${MAPS[map].name.padEnd(24)} ${i.what}${i.at ? ` at (${i.at.x}, ${i.at.y})` : ''}`);
  }
  console.log(`${n} map issues`);
}
