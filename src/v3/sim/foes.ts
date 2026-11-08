// The enemy build (docs/design/v3-enemy-build.md): how the new enemies plan
// into waves, come into play, move, and what they do when they die. The
// numbers are in data/foes.ts and data/config.ts (THREATS); this file is the
// behaviour. game.ts calls in at four places: planning a wave (planFoes),
// launching (launchFoe), each step (updateFoe, updateFoeShots) and a kill
// (foeDown).

import type { RNG } from '../../sim/rng';
import { DRONE, THREATS, VIEW, type ThreatKind } from '../data/config';
import { FOE, FOES, FOE_LEAD_SHARE, FOE_OF_KIND, FOE_ORDER, FOES_BUILT, foeCount, foesInChapter, foesUpTo, type FoeId, type FoeSetting } from '../data/foes';
import { MAP_ORDER, chapterOf, type MapId, type Point } from '../data/maps';
import { laneAt, laneLength } from './lanes';
import {
  CARRIER_TARGET,
  addFx,
  alongPath,
  angleDiff,
  child,
  clamp,
  cue,
  damageCarrier,
  damageShip,
  dist,
  pathLength,
  shipAhead,
  spawnThreat,
  swarmAim,
  swarmPart,
  targetable,
  type Game,
  type Launch,
  type Ship,
  type Threat,
} from './game';

/** Something a foe fires that no interceptor can stop (en-unstoppable: the
 *  source always has a tell and can always be shot). It flies from (sx, sy)
 *  to (tx, ty) in `dur` seconds and lands there. */
export interface FoeShot {
  id: number;
  /** A truck's rocket, or a dive bomber's bomb. */
  kind: 'rocket' | 'bomb';
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  from: ThreatKind;
  /** A truck's salvo (its rockets share one hit: the first of them to land
   *  on a hull does it; `spent`, the rest only splash). */
  salvo?: number;
  spent?: boolean;
}

/** A warning on the water before a foe shows (a periscope); when it runs
 *  out, the foe comes. */
export interface FoeMark {
  id: number;
  /** A periscope (a torpedo sub to come), a dive bomber's circle, a siege
   *  battery's shell circle, an Incendiary Missile's fireball burning, a siege
   *  battery's hatch (the gun hidden under it: no target). */
  kind: 'periscope' | 'dive' | 'shell' | 'fire' | 'hatch';
  x: number;
  y: number;
  t: number;
  dur: number;
  /** A shell's gun (its threat id), and where it fires from. */
  link?: number;
  gx?: number;
  gy?: number;
  /** A shell is on its way (no longer stopped by killing the gun). */
  fired?: boolean;
  /** Gas: seconds each hull has been in it toward its next hit (ship id,
   *  -1 the carrier). */
  dose?: Record<number, number>;
  /** A hatch: the lowered gun that comes back up when it runs out (its hits
   *  and salvos kept); `spawn`: a new gun comes up (its first rise); neither:
   *  the gun has packed up and the hatch just closes. */
  gun?: Threat;
  spawn?: boolean;
  /** A hatch the gun has just gone down into (drawn sinking, then the
   *  doors closing). */
  lowered?: boolean;
}

/** A foe's own state, on its threat. `state` and `t` are its phase and the
 *  seconds in it; the rest is used as each foe needs. */
export interface FoeData {
  state: number;
  t: number;
  /** Rounds left (Rocket Truck), or a slot in its group (a guard's place
   *  in the ring). */
  n: number;
  /** A point it works from (a helicopter's spot, a dive bomber's circle). */
  px: number;
  py: number;
  /** Another thing it is tied to (a guard's heavy, a scavenger's pickup). */
  link: number;
  /** A truck's road and how far along it. */
  path?: Point[];
  along?: number;
  /** Its own velocity (the helicopter's flight). */
  vx?: number;
  vy?: number;
  /** A Rocket Truck's salvo in progress: its id, the ship it is at (-1: the
   *  carrier), rockets still to go, and when the next one goes (its `t`). */
  ripple?: { id: number; ship: number; left: number; next: number; spent?: boolean };
  /** Where it set out from (the torpedo's line, the armored drone's start). */
  sx?: number;
  sy?: number;
}

/** The foes a run can meet, and their shots in the air. */
export interface FoeState {
  /** Every foe this run can send. */
  pool: FoeId[];
  /** The chapter's own new ones (each wave leads with one of these). */
  lead: FoeId[];
  cursor: number;
  /** Free Play: one foe on its own. */
  only: FoeId | null;
  shots: FoeShot[];
  marks: FoeMark[];
  /** The ship a Spotter is painting, and which spotter. */
  paint: { ship: number; by: number } | null;
  /** Damage being done now comes from the player's own hand (a tap, a
   *  press, a shot a tap fired): the Lure Beacon takes only that. */
  byTap: boolean;
}

/** A run's foes: a map in chapter n sends any from chapters 1 to n, leading
 *  with the chapter's own. Each map of a chapter leads with a different one,
 *  so its first foe (wave 2) is that map's debut. */
export function newFoeState(mapId: MapId, setting: FoeSetting = 'campaign'): FoeState {
  const ch = chapterOf(mapId);
  const st: FoeState = { pool: [], lead: [], cursor: 0, only: null, shots: [], marks: [], paint: null, byTap: false };
  if (setting === 'none') return st;
  if (setting === 'all') {
    st.pool = [...FOES_BUILT];
    return st;
  }
  if (setting !== 'campaign') {
    st.only = FOES_BUILT.includes(setting) ? setting : null;
    st.pool = st.only ? [st.only] : [];
    return st;
  }
  st.pool = foesUpTo(ch);
  st.lead = foesInChapter(ch);
  st.cursor = Math.max(0, MAP_ORDER.indexOf(mapId)) % 5;
  return st;
}

/** Is this a Free Play setting the game knows? */
export function foeSetting(v: unknown): FoeSetting {
  return v === 'none' || v === 'all' || (typeof v === 'string' && (FOE_ORDER as string[]).includes(v)) ? (v as FoeSetting) : 'campaign';
}

/** The foes a wave brings (each stands in for one of its drone swarms). */
export function planFoes(g: Game, n: number): FoeId[] {
  const st = g.foe;
  if (!st.pool.length) return [];
  const rng = g.rng.foes;
  if (st.only) return Array.from({ length: n + 1 }, () => st.only!);
  const rest = st.pool.filter((id) => !st.lead.includes(id));
  const out: FoeId[] = [];
  for (let k = 0; k < n; k++) {
    const lead = st.lead.length > 0 && (k === 0 || !rest.length || rng.chance(FOE_LEAD_SHARE));
    out.push(lead ? st.lead[st.cursor++ % st.lead.length] : rng.pick(rest));
  }
  return out;
}

export { foeCount };

/** Does this foe come out of a launch base (and light it in the raid
 *  warning)? */
export function fromBase(kind: ThreatKind): boolean {
  const id = FOE_OF_KIND[kind];
  return !!id && FOES[id].from === 'base';
}

export function isFoe(kind: ThreatKind): boolean {
  return !!FOE_OF_KIND[kind];
}

/** Foes whose movement is their own (the missiles among them fly the shared
 *  steering code in game.ts). */
const OWN_MOVES = new Set<ThreatKind>([
  'sprinter', 'decoy', 'rocketTruck',
  'attackHeli', 'torpedoSub', 'torpedo', 'armored', 'scavenger',
  'diveBomber', 'siege', 'spotter',
  'tender', 'guard', 'lure', 'cloud',
]);

export function movesItself(kind: ThreatKind): boolean {
  return OWN_MOVES.has(kind);
}

const data = (o: Partial<FoeData> = {}): FoeData => ({ state: 0, t: 0, n: 0, px: 0, py: 0, link: 0, ...o });

/** A foe comes into play: from a base at (x, y), or from wherever it comes
 *  (a road, a screen edge, open water). */
export function launchFoe(g: Game, l: Launch, at?: Point): void {
  const id = FOE_OF_KIND[l.kind];
  if (!id) return;
  const rng = g.rng.foes;
  switch (id) {
    case 'sprinter': {
      if (!at) return;
      for (let k = 0; k < FOE.sprinter.size; k++) {
        const th = spawnThreat(g, 'sprinter', at.x + (k - 1.5) * 14, at.y, 'base');
        th.foe = data();
      }
      return;
    }
    case 'decoy': {
      if (!at) return;
      // Real drones and decoys, shuffled so the decoys aren't always the
      // same places in the swarm. Spread out (Test Lab round 2: "they are
      // just one large clump"): launched in a wide, staggered line, each
      // keeps its place across the swarm's front until close in.
      const D = FOE.decoy;
      const kinds = rng.shuffle(Array.from({ length: D.size }, (_, k): ThreatKind => (k < D.fakes ? 'decoy' : 'drone')));
      const mid = (D.size - 1) / 2;
      kinds.forEach((kind, k) => {
        const th = spawnThreat(g, kind, at.x + (k - mid) * D.spread, at.y + (k % 2) * D.stagger, 'base');
        th.slot = (k - mid) * D.slot;
        if (kind === 'decoy') th.foe = data();
      });
      return;
    }
    case 'hydra': {
      if (!at) return;
      spawnThreat(g, 'hydra', at.x, at.y, 'base');
      return;
    }
    case 'rocketTruck': {
      const roads = g.map.roads.popups;
      if (!roads.length) return;
      const road = rng.pick(roads);
      const th = spawnThreat(g, 'rocketTruck', road.from.x, road.from.y, 'truck');
      th.target = CARRIER_TARGET;
      th.foe = data({ path: [road.from, road.to], along: 0, n: FOE.rocketTruck.salvos });
      th.heading = Math.atan2(road.to.y - road.from.y, road.to.x - road.from.x);
      return;
    }
    case 'attackHeli': {
      const side = rng.chance(0.5) ? 1 : -1;
      const spot = heliSpot(g, rng);
      const th = spawnThreat(g, 'attackHeli', side > 0 ? -50 : VIEW.width + 50, clamp(spot.y + rng.range(-120, 120), 90, VIEW.height - 90), 'air');
      th.target = CARRIER_TARGET;
      th.heading = side > 0 ? 0 : Math.PI;
      th.foe = data({ px: spot.x, py: spot.y, vx: side * 120, vy: 0 });
      return;
    }
    case 'torpedoSub': {
      // A periscope first; the sub itself comes up when it runs out.
      const p = waterSpot(g, rng);
      g.foe.marks.push({ id: g.nextId++, kind: 'periscope', x: p.x, y: p.y, t: 0, dur: FOE.torpedoSub.warn });
      cue(g, 'sub.surface', p.x, p.y, { gain: 0.5 });
      return;
    }
    case 'armored': {
      if (!at) return;
      const th = spawnThreat(g, 'armored', at.x, at.y, 'base');
      th.foe = data({ n: FOE.armored.plate, sx: at.x, sy: at.y });
      return;
    }
    case 'scavenger': {
      const x = rng.range(200, VIEW.width - 200);
      const th = spawnThreat(g, 'scavenger', x, -30, 'air');
      th.target = CARRIER_TARGET;
      th.heading = Math.PI / 2;
      th.foe = data({ link: -1, px: x, py: rng.range(120, 170) });
      return;
    }
    case 'diveBomber': {
      // The circle first, where a ship is about to be; the plane only at
      // the last moment.
      const D = FOE.diveBomber;
      const pool = targetable(g);
      // No ship on the water yet (a test's first seconds): the lane where
      // the convoy is coming in.
      const ch = g.map.channels[0];
      const p = pool.length ? shipAhead(g, rng.pick(pool), D.lead) : laneAt(ch, laneLength(ch) * 0.3, 0);
      g.foe.marks.push({ id: g.nextId++, kind: 'dive', x: p.x, y: p.y, t: 0, dur: D.mark });
      cue(g, 'supersonic.lock', p.x, p.y, { gain: 0.5 });
      return;
    }
    case 'siege': {
      // A closed hatch on the shore first (Test Lab round 1: "raised up
      // from low ground"); the gun comes up out of it when it opens.
      const gun = siegeSpot(g, rng);
      g.foe.marks.push({ id: g.nextId++, kind: 'hatch', x: gun.x, y: gun.y, t: 0, dur: FOE.siege.first, spawn: true });
      return;
    }
    case 'spotter': {
      const side = rng.chance(0.5) ? 1 : -1;
      const c = spotterSpot(g, rng);
      const th = spawnThreat(g, 'spotter', side > 0 ? -60 : VIEW.width + 60, clamp(c.y, 90, VIEW.height - 90), 'air');
      th.target = CARRIER_TARGET;
      th.heading = side > 0 ? 0 : Math.PI;
      th.foe = data({ px: c.x, py: c.y, link: -1 });
      return;
    }
    case 'tender': {
      // It sails in like any ship: from off a screen edge, over open water,
      // to a station clear of every other boat (the player: "needs to sail
      // in like a normal ship ... checked for collisions").
      const p = boatSpot(g, rng);
      const from = seaEntry(g, p);
      const th = spawnThreat(g, 'tender', from ? from.x : p.x, from ? from.y : p.y, 'sub');
      th.target = CARRIER_TARGET;
      th.heading = Math.atan2(p.y - th.y, p.x - th.x);
      th.foe = data({ link: -1, px: p.x, py: p.y, n: from ? 0 : 1 });
      // It comes with the tough ones it mends: a heavy from a live site.
      const site = liveSite(g, rng);
      if (site) spawnThreat(g, 'heavy', site.x, site.y, 'base');
      return;
    }
    case 'bodyguard': {
      if (!at) return;
      const heavy = spawnThreat(g, 'heavy', at.x, at.y, 'base');
      for (let k = 0; k < FOE.bodyguard.guards; k++) {
        const t = spawnThreat(g, 'guard', at.x, at.y, 'base');
        t.target = CARRIER_TARGET;
        t.foe = data({ link: heavy.id, n: k });
      }
      return;
    }
    case 'lure': {
      // It rises out of the water (state 0), clear of the other boats.
      const p = boatSpot(g, rng);
      const th = spawnThreat(g, 'lure', p.x, p.y, 'sub');
      th.target = CARRIER_TARGET;
      th.foe = data();
      return;
    }
    case 'cloud': {
      // A slow incendiary missile out of a base, at a ship (the player's
      // rework): wherever it bursts, its fireball burns on.
      if (!at) return;
      const th = spawnThreat(g, 'cloud', at.x, at.y, 'base');
      th.foe = data();
      // It picks a ship it can meet bow or beam on (Test Lab round 2): one
      // already past the base would only be caught up its wake, so it goes
      // for the best placed ship instead. It leaves the rail on its lead.
      const s = shipOf(g, th);
      if (s) {
        const front = (o: Ship) => {
          const rx = at.x - o.x;
          const ry = at.y - o.y;
          return (rx * Math.cos(o.heading) + ry * Math.sin(o.heading)) / Math.max(1, Math.hypot(rx, ry));
        };
        if (front(s) < FOE.cloud.astern) {
          const best = targetable(g).reduce<Ship | undefined>((m, o) => (!m || front(o) > front(m) ? o : m), undefined);
          if (best && front(best) > front(s)) th.target = best.id;
        }
        const p = intercept(g, shipOf(g, th)!, th.x, th.y, th.speed, FOE.cloud.bow);
        th.heading = Math.atan2(p.y - th.y, p.x - th.x);
      }
      return;
    }
    default:
      return;
  }
}

/** A live launch site, at random. */
function liveSite(g: Game, rng: RNG): Point | null {
  const sites = g.map.bases.filter((b, i) => b.kinds.length > 0 && !b.cove && !b.chute && !b.generator && !g.baseDown[i]);
  return sites.length ? rng.pick(sites) : null;
}

/** A siege gun's place: on the enemy shore, beside a launch site (not on
 *  top of it). */
function siegeSpot(g: Game, rng: RNG): Point {
  const sites = g.map.bases.filter((b, i) => b.kinds.length > 0 && !b.cove && !b.chute && !g.baseDown[i]);
  const b = sites.length ? rng.pick(sites) : { x: VIEW.width / 2, y: 90 };
  const side = b.x < VIEW.width / 2 ? 1 : -1;
  return { x: clamp(b.x + side * 95, 80, VIEW.width - 80), y: b.y + 6 };
}

/** Open water off the lanes: a submarine spot, or a point on a bomber line
 *  (maps with no sub spots). */
function waterSpot(g: Game, rng: RNG): Point {
  if (g.map.subSpots.length) return rng.pick(g.map.subSpots);
  const y = g.map.bomberLines.length ? rng.pick(g.map.bomberLines) : VIEW.height * 0.3;
  return { x: rng.range(260, VIEW.width - 260), y };
}

/** Boats on the water now or about to be: the convoy, the frigates, the
 *  raiders' subs (up or coming), periscopes, and the enemy's own boats. */
const BOAT_KINDS = new Set<ThreatKind>(['tender', 'lure', 'torpedoSub', 'fastboat', 'dreadnought']);

function boats(g: Game, not?: Threat): Point[] {
  const out: Point[] = [...g.ships, ...g.escorts];
  for (const r of g.raiders) if (r.kind === 'sub') out.push(r);
  for (const sp of g.raiderQueue) if (sp.kind === 'sub' && sp.path.length) out.push(sp.path[0]);
  for (const m of g.foe.marks) if (m.kind === 'periscope') out.push(m);
  for (const t of g.threats) if (t !== not && !t.dead && BOAT_KINDS.has(t.kind)) out.push(t);
  return out;
}

/** Open water for a boat to sit on: a water spot clear of every other boat
 *  (one taken by a sub, a frigate or another of theirs is passed over while
 *  a clear one is left; else the least crowded). */
function boatSpot(g: Game, rng: RNG): Point {
  const all = g.map.subSpots.length ? rng.shuffle([...g.map.subSpots]) : Array.from({ length: 6 }, () => waterSpot(g, rng));
  // Out from the screen's side edges, where it can be seen and tapped.
  const inner = all.filter((p) => p.x > 160 && p.x < VIEW.width - 160);
  const cands = [...inner, ...all.filter((p) => !inner.includes(p))];
  const others = [...boats(g), ...g.threats.filter((t) => !t.dead && t.kind === 'tender' && t.foe).map((t) => ({ x: t.foe!.px, y: t.foe!.py }))];
  let best = cands[0];
  let bd = -1;
  for (const p of cands) {
    if (onLand(g, p.x, p.y)) continue;
    const d = others.reduce((m, o) => Math.min(m, dist(o.x, o.y, p.x, p.y)), Infinity);
    // Clear enough is enough: the first clear one (shuffled) keeps the
    // choice varied.
    if (d >= FOE.tender.clear) return p;
    if (d > bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

/** Is (x, y) on land? (Even-odd over the map's landmasses.) */
export function onLand(g: Game, x: number, y: number): boolean {
  for (const l of g.map.land) {
    const pts = l.points;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i];
      const b = pts[j];
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

/** Where a boat bound for `to` comes on: off a side edge, the shortest
 *  straight run to it that stays on open water all the way. Null if none
 *  does (it then rises where it is). */
function seaEntry(g: Game, to: Point): Point | null {
  let best: Point | null = null;
  let bl = Infinity;
  for (const side of [-1, 1]) {
    for (const dy of [0, -90, 90, -180, 180, -280, 280]) {
      const from = { x: side < 0 ? -70 : VIEW.width + 70, y: to.y + dy };
      if (from.y < 40 || from.y > VIEW.height - 40) continue;
      const L = dist(from.x, from.y, to.x, to.y);
      if (L >= bl) continue;
      let wet = true;
      for (let u = 0; u <= L && wet; u += 16) {
        const x = from.x + ((to.x - from.x) * u) / L;
        const y = from.y + ((to.y - from.y) * u) / L;
        if (x > 0 && x < VIEW.width && onLand(g, x, y)) wet = false;
      }
      if (wet) {
        bl = L;
        best = from;
      }
    }
  }
  return best;
}

/** Where a helicopter hovers: beside a lane, part way along, on screen. */
function heliSpot(g: Game, rng: RNG, not?: Point, off: number = FOE.attackHeli.off): Point {
  let best: Point = { x: VIEW.width / 2, y: VIEW.height / 2 };
  let bd = -1;
  for (let k = 0; k < 6; k++) {
    const ch = rng.pick(g.map.channels);
    const L = laneLength(ch);
    const p = laneAt(ch, L * rng.range(0.25, 0.75), (rng.chance(0.5) ? 1 : -1) * (ch.halfWidth + off));
    const q = { x: clamp(p.x, 120, VIEW.width - 120), y: clamp(p.y, 90, VIEW.height - 90) };
    // Away from the carrier, and a fresh place when it moves.
    const d = Math.min(dist(q.x, q.y, g.map.carrier.x, g.map.carrier.y), not ? dist(q.x, q.y, not.x, not.y) * 1.5 : Infinity);
    if (d > bd) {
      bd = d;
      best = q;
    }
  }
  return best;
}

/** The ship a threat is after, if it is a ship. */
function shipOf(g: Game, th: Threat) {
  return th.target === CARRIER_TARGET ? undefined : g.ships.find((s) => s.id === th.target);
}

/** Where a missile at (x, y) flying `v` px/s meets a ship sailing its lane
 *  (`bow` px off its bow): the time to go from the ship's speed along the
 *  lane (the straight-line solution), then refined on the lane itself (for a
 *  bend) a few times. Capped at `FOE.cloud.horizon` s ahead. */
export function intercept(g: Game, s: Ship, x: number, y: number, v: number, bow = 0): Point {
  const H = FOE.cloud.horizon;
  const p0 = shipAhead(g, s, 0, bow);
  const p1 = shipAhead(g, s, 1, bow);
  const vx = p1.x - p0.x;
  const vy = p1.y - p0.y;
  const dx = p0.x - x;
  const dy = p0.y - y;
  // |p0 + V t - (x, y)| = v t: (|V|² - v²) t² + 2 (D·V) t + |D|² = 0.
  const a = vx * vx + vy * vy - v * v;
  const b = 2 * (dx * vx + dy * vy);
  const c = dx * dx + dy * dy;
  let t = Math.sqrt(c) / Math.max(1, v);
  if (a < -1e-6) t = (-b - Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
  t = clamp(t, 0, H);
  for (let k = 0; k < 3; k++) {
    const p = shipAhead(g, s, t, bow);
    t = Math.min(H, dist(x, y, p.x, p.y) / Math.max(1, v));
  }
  return shipAhead(g, s, t, bow);
}

/** Turn toward (x, y) at most `turn` rad/s and fly on at `speed`. */
function steer(th: Threat, x: number, y: number, speed: number, turn: number, dt: number): void {
  const want = Math.atan2(y - th.y, x - th.x);
  th.heading += turn === Infinity ? angleDiff(want, th.heading) : clamp(angleDiff(want, th.heading), -turn * dt, turn * dt);
  th.x += Math.cos(th.heading) * speed * dt;
  th.y += Math.sin(th.heading) * speed * dt;
}

/** A drone's lazy weave on the way in (as the attack drone's). */
function weave(th: Threat): number {
  return 0.35 * Math.sin(th.age * 2.5 + th.phase);
}

/** One step of a foe that moves itself. `aim(th)` is where its target is;
 *  `hit(th)` checks it against its target the way every threat does. */
export function updateFoe(g: Game, th: Threat, dt: number, aim: (th: Threat) => Point, hit: (th: Threat) => void, retarget: (th: Threat) => void): void {
  const f = (th.foe ??= data());
  f.t += dt;
  switch (th.kind) {
    case 'sprinter': {
      retarget(th);
      const tp = aim(th);
      const d = dist(th.x, th.y, tp.x, tp.y);
      if (f.state === 0) {
        steer(th, tp.x, tp.y, th.speed, Infinity, dt);
        th.heading += d > 80 ? weave(th) * dt * 4 : 0;
        if (d <= FOE.sprinter.boostAt) {
          f.state = 1;
          f.t = 0;
          cue(g, 'foe.flare', th.x, th.y);
        }
      } else if (f.state === 1) {
        // The flare: it all but stops, nose on, booster lit.
        steer(th, tp.x, tp.y, th.speed * 0.3, Infinity, dt);
        if (f.t >= FOE.sprinter.flare) {
          f.state = 2;
          f.t = 0;
        }
      } else {
        const s = shipOf(g, th);
        const lead = s ? shipAhead(g, s, d / FOE.sprinter.sprint) : tp;
        steer(th, lead.x, lead.y, FOE.sprinter.sprint, 6, dt);
      }
      hit(th);
      return;
    }
    case 'decoy': {
      retarget(th);
      const tp = aim(th);
      const d = dist(th.x, th.y, tp.x, tp.y);
      // Flown exactly as game.ts flies the attack drone (the same weave, the
      // same speed), so nothing but the late strobe tells them apart.
      const at = th.slot ? swarmAim(th, tp, d) : tp;
      th.heading = Math.atan2(at.y - th.y, at.x - th.x) + (d > 80 ? DRONE.weaveAmp * Math.sin(th.age * DRONE.weaveFreq + th.phase) : 0);
      th.x += Math.cos(th.heading) * th.speed * dt;
      th.y += Math.sin(th.heading) * th.speed * dt;
      swarmPart(g, th, dt);
      // The tell comes late (Test Lab round 1: "way too obvious" when they
      // strobed from launch): close in, and not in the first seconds.
      if (f.state === 0 && d <= FOE.decoy.revealAt && f.t >= FOE.decoy.revealAfter) f.state = 1;
      if (d <= FOE.decoy.fizzle) {
        // At the convoy, a decoy is nothing: a puff and it's gone.
        th.dead = true;
        addFx(g, 'burst', th.x, th.y, { life: 0.4, r: 14 });
      }
      return;
    }
    case 'rocketTruck':
      updateTruck(g, th, f, dt);
      return;
    case 'attackHeli':
      updateHeli(g, th, f, dt);
      return;
    case 'torpedoSub': {
      const S = FOE.torpedoSub;
      if (f.state === 0 && f.t >= S.fireAt) {
        f.state = 1;
        fireTorpedo(g, th);
      }
      if (f.t >= S.up) {
        // It dives: gone from reach, not a kill.
        th.dead = true;
        addFx(g, 'spray', th.x, th.y, { life: 0.6, r: 18 });
        cue(g, 'sub.dive', th.x, th.y);
      }
      return;
    }
    case 'torpedo': {
      // Straight down its line; anything in the way is hit.
      th.x += Math.cos(th.heading) * th.speed * dt;
      th.y += Math.sin(th.heading) * th.speed * dt;
      const hull = g.ships.find((s) => dist(s.x, s.y, th.x, th.y) <= FOE.torpedoSub.hitRadius);
      if (hull) {
        th.dead = true;
        addFx(g, 'splash', th.x, th.y, { life: 0.8, r: 34 });
        cue(g, 'impact.splash', th.x, th.y);
        damageShip(g, hull, THREATS.torpedo.damage, 'torpedoSub');
        return;
      }
      if (dist(th.x, th.y, f.sx ?? th.x, f.sy ?? th.y) >= (f.along ?? 0)) th.dead = true;
      return;
    }
    case 'armored': {
      retarget(th);
      const A = FOE.armored;
      const tp = aim(th);
      const d = dist(th.x, th.y, tp.x, tp.y);
      const total = dist(f.sx ?? th.x, f.sy ?? th.y, tp.x, tp.y);
      // Part way in, it banks through a wide S: its side and tail face the
      // carrier for a moment.
      if (f.state === 0 && d <= total * (1 - A.turnAt)) {
        f.state = 1;
        f.t = 0;
      }
      let off = 0;
      if (f.state === 1) {
        const u = f.t / A.turn;
        off = A.swing * Math.sin(Math.PI * Math.min(1, u)) * (th.id % 2 ? 1 : -1);
        if (u >= 1) f.state = 2;
      }
      const want = Math.atan2(tp.y - th.y, tp.x - th.x) + off;
      th.heading += clamp(angleDiff(want, th.heading), -4 * dt, 4 * dt);
      th.x += Math.cos(th.heading) * th.speed * dt;
      th.y += Math.sin(th.heading) * th.speed * dt;
      hit(th);
      return;
    }
    case 'scavenger':
      updateScavenger(g, th, f, dt);
      return;
    case 'diveBomber': {
      const D = FOE.diveBomber;
      if (f.state === 0) {
        // Its run (Test Lab round 1: seen from above like every other
        // aircraft): in from the top of the screen, straight at its circle,
        // diving as it comes; its window to be shot. It lets go just short
        // of the circle.
        const u = Math.min(1, f.t / D.window);
        const rx = f.px - Math.cos(th.heading) * D.short;
        const ry = f.py - Math.sin(th.heading) * D.short;
        th.x = f.sx! + (rx - f.sx!) * u;
        th.y = f.sy! + (ry - f.sy!) * u;
        if (u >= 1) {
          // Released: the bomb falls on, onto the circle, and nothing stops
          // it now.
          g.foe.shots.push({ id: g.nextId++, kind: 'bomb', x: th.x, y: th.y, sx: th.x, sy: th.y, tx: f.px, ty: f.py, t: 0, dur: D.fall, from: 'diveBomber' });
          cue(g, 'bomber.drop', th.x, th.y);
          f.state = 1;
          f.t = 0;
          f.vx = dist(f.sx!, f.sy!, rx, ry) / D.window;
        }
      } else {
        // Pulls up and away: on past the circle, climbing, banking off to
        // the nearer side of the screen.
        const side = th.x < VIEW.width / 2 ? Math.PI : 0;
        th.heading += clamp(angleDiff(side, th.heading), -D.bank * dt, D.bank * dt);
        f.vx = Math.min(D.exit, (f.vx ?? 200) + 500 * dt);
        th.x += Math.cos(th.heading) * f.vx * dt;
        th.y += Math.sin(th.heading) * f.vx * dt;
        const off = th.x < -90 || th.x > VIEW.width + 90 || th.y < -90 || th.y > VIEW.height + 90;
        if (off || f.t > 4) th.dead = true;
      }
      return;
    }
    case 'siege':
      updateSiege(g, th, f);
      return;
    case 'spotter':
      updateSpotter(g, th, f, dt);
      return;
    case 'tender':
      updateTender(g, th, f, dt);
      return;
    case 'guard': {
      const heavy = g.threats.find((t) => t.id === f.link && !t.dead);
      if (!heavy) {
        // Its heavy is gone: it drops away (not a kill).
        th.dead = true;
        addFx(g, 'burst', th.x, th.y, { life: 0.3, r: 10 });
        return;
      }
      const B = FOE.bodyguard;
      const a = g.t * B.spin + (f.n / B.guards) * Math.PI * 2;
      th.heading = a + Math.PI / 2;
      th.x = heavy.x + Math.cos(a) * B.orbit;
      th.y = heavy.y + Math.sin(a) * B.orbit;
      return;
    }
    case 'lure': {
      // Rising out of the water first; it lures only once it's up.
      if (f.state === 0 && f.t >= FOE.lure.rise) {
        f.state = 1;
        f.t = 0;
        cue(g, 'foe.paint', th.x, th.y, { gain: 0.6 });
      }
      if ((f.state === 1 && f.t >= FOE.lure.life) || alone(g, th)) leave(g, th);
      return;
    }
    case 'cloud': {
      // Slow and heavy, and it leads its ship (Test Lab round 2: "aim and
      // lead the ship instead of coming through on the back"): it flies at
      // where the ship will be when it gets there, aiming a little off the
      // ship's bow while it is far, so it comes in on the bow or the flank,
      // not up the wake. At the ship it hits (one hit) and bursts; the
      // fireball does the rest.
      retarget(th);
      const C = FOE.cloud;
      const s = shipOf(g, th);
      const tp = aim(th);
      const d = dist(th.x, th.y, tp.x, tp.y);
      const p = s ? intercept(g, s, th.x, th.y, th.speed, clamp((d - C.bowFrom) * 0.5, 0, C.bow)) : tp;
      steer(th, p.x, p.y, th.speed, C.turn * (d < C.close ? 3 : 1), dt);
      hit(th);
      if (th.dead) burstCloud(g, th);
      return;
    }
    default:
      return;
  }
}

/** Support foes that only matter while there is a fight: is this one all
 *  that's left of the wave? */
function alone(g: Game, th: Threat): boolean {
  if (g.queue.length || g.raiderQueue.length || g.raiders.length || g.foe.marks.length) return false;
  return !g.threats.some((t) => t !== th && !t.dead && !SUPPORT.has(t.kind) && !['rig', 'generator', 'citadel'].includes(t.kind));
}

const SUPPORT = new Set<ThreatKind>(['tender', 'lure', 'guard']);

/** Gone from the water, not a kill. */
function leave(g: Game, th: Threat): void {
  th.dead = true;
  addFx(g, 'spray', th.x, th.y, { life: 0.6, r: 20 });
}

/** The Repair Tender: it sails to its station (n 0, then 1 on station),
 *  and every few seconds a beam charges on the most damaged enemy near it,
 *  then mends it. */
function updateTender(g: Game, th: Threat, f: FoeData, dt: number): void {
  const T = FOE.tender;
  if (alone(g, th)) {
    leave(g, th);
    return;
  }
  sailTender(g, th, f, dt);
  if (f.state === 0 && f.t >= T.gap) {
    const hurt = g.threats
      .filter((t) => !t.dead && t !== th && t.kind !== 'tender' && dist(t.x, t.y, th.x, th.y) <= T.reach && t.hp < THREATS[t.kind].hp)
      .sort((a, b) => a.hp / THREATS[a.kind].hp - b.hp / THREATS[b.kind].hp)[0];
    if (!hurt) return;
    f.state = 1;
    f.t = 0;
    f.link = hurt.id;
  } else if (f.state === 1 && f.t >= T.charge) {
    const t = g.threats.find((o) => o.id === f.link && !o.dead);
    if (t && dist(t.x, t.y, th.x, th.y) <= T.reach * 1.3) {
      t.hp = Math.min(THREATS[t.kind].hp, t.hp + T.mend);
      addFx(g, 'text', t.x, t.y - 34, { life: 0.8, r: 0, text: `+${T.mend}` });
      cue(g, 'foe.mend', t.x, t.y);
    }
    f.state = 0;
    f.t = 0;
    f.link = -1;
  }
}

/** The tender's helm: toward its station, easing in, giving way to any boat
 *  near it (pushed off, and slowed when one is right ahead: ships have right
 *  of way), and never onto land. */
function sailTender(g: Game, th: Threat, f: FoeData, dt: number): void {
  const T = FOE.tender;
  const dx = f.px - th.x;
  const dy = f.py - th.y;
  const d = Math.hypot(dx, dy);
  const want = Math.min(th.speed, d * 0.8 + 6);
  let vx = d > 1 ? (dx / d) * want : 0;
  let vy = d > 1 ? (dy / d) * want : 0;
  for (const o of boats(g, th)) {
    const ox = th.x - o.x;
    const oy = th.y - o.y;
    const od = Math.hypot(ox, oy);
    if (od >= T.keep || od < 1e-3) continue;
    const ahead = d > 1 && (-ox * dx - oy * dy) / (od * d) > 0.6;
    if (ahead) {
      vx *= 0.35;
      vy *= 0.35;
    }
    const push = (1 - od / T.keep) * th.speed * 1.4;
    vx += (ox / od) * push;
    vy += (oy / od) * push;
  }
  const sp = Math.hypot(vx, vy);
  if (sp > th.speed) {
    vx *= th.speed / sp;
    vy *= th.speed / sp;
  }
  const nx = th.x + vx * dt;
  const ny = th.y + vy * dt;
  // Off the screen the shore can't be under it; on it, a step onto land
  // isn't taken.
  if (nx < 0 || nx > VIEW.width || !onLand(g, nx, ny)) {
    th.x = nx;
    th.y = ny;
  }
  if (sp > 8) th.heading += clamp(angleDiff(Math.atan2(vy, vx), th.heading), -2 * dt, 2 * dt);
  if (f.n === 0 && d < 10) f.n = 1;
}

/** An Incendiary Missile bursts (shot down, or at its ship): its fireball
 *  burns where it burst. Its `n` says whether a hull was already near (for
 *  the Test Lab's "stopped before harm"). */
export function burstCloud(g: Game, th: Threat): void {
  const C = FOE.cloud;
  const f = (th.foe ??= data());
  if (f.state === 9) return;
  f.state = 9;
  f.n = g.ships.some((s) => dist(s.x, s.y, th.x, th.y) <= C.radius * 2) ? 1 : 0;
  g.foe.marks.push({ id: g.nextId++, kind: 'fire', x: th.x, y: th.y, t: 0, dur: C.linger, dose: {} });
  addFx(g, 'burst', th.x, th.y, { life: 0.6, r: C.radius * 0.8 });
  cue(g, 'foe.ignite', th.x, th.y);
}

/** A fireball on the water: a hull inside takes a hit `first` s in, then one every
 *  `tick` s while it stays (the carrier too, if it's under it). */
function fireStep(g: Game, m: FoeMark, dt: number): void {
  const C = FOE.cloud;
  const dose = (m.dose ??= {});
  const take = (key: number, inside: boolean): boolean => {
    if (!inside) {
      delete dose[key];
      return false;
    }
    dose[key] = (dose[key] ?? C.tick - C.first) + dt;
    if (dose[key] < C.tick) return false;
    dose[key] -= C.tick;
    return true;
  };
  for (const s of [...g.ships]) {
    if (take(s.id, dist(s.x, s.y, m.x, m.y) <= C.radius)) damageShip(g, s, THREATS.cloud.damage, 'cloud', false);
  }
  const c = g.map.carrier;
  if (take(-1, dist(c.x, c.y, m.x, m.y) <= C.radius + 40)) damageCarrier(g, THREATS.cloud.damage, 'cloud');
}

/** A Bodyguard Ring: a shot at the heavy meets one of its guards first. */
export function guardFor(g: Game, th: Threat, from: Point): Threat | null {
  if (th.kind !== 'heavy') return null;
  const guards = g.threats.filter((t) => t.kind === 'guard' && !t.dead && t.foe?.link === th.id);
  if (!guards.length) return null;
  return guards.sort((a, b) => dist(a.x, a.y, from.x, from.y) - dist(b.x, b.y, from.x, from.y))[0];
}

/** A flashing Lure Beacon a helper at (x, y) goes for: one that is up, and
 *  within the helper's reach or the beacon's own ring of it, or whose ring
 *  holds what the helper was about to aim at. */
export function lureIn(g: Game, x: number, y: number, reach = Infinity, aim?: Point): Threat | undefined {
  const R = FOE.lure.radius;
  return g.threats.find(
    (t) => t.kind === 'lure' && !t.dead && (t.foe?.state ?? 1) >= 1 && (dist(t.x, t.y, x, y) <= Math.max(reach, R) || (!!aim && dist(t.x, t.y, aim.x, aim.y) <= R)),
  );
}

/** A helper's pick, unless a Lure Beacon draws it away: the beacon first. */
export function lured(g: Game, x: number, y: number, reach: number, pick: Threat | undefined): Threat | undefined {
  return lureIn(g, x, y, reach, pick) ?? pick;
}

/** The Siege Battery (Test Lab round 1: "raised up from low ground ... it
 *  just has a vulnerable spot once it's up"). It lives in a hatch on the
 *  enemy shore. Up: the gun rises out of it (`rise`, the tell), marks its
 *  circles on the lane where ships will be, and stays up until its shells
 *  have left the gun (and `hold`). Then it goes back down: off the board
 *  (no taps, no blasts, no helpers) for `down`, and rises again. Its hits
 *  and salvos carry over. After the last salvo it goes down for good (gone,
 *  not a kill). */
function updateSiege(g: Game, th: Threat, f: FoeData): void {
  const S = FOE.siege;
  if (f.state === 0 && f.t >= S.rise) {
    f.state = 1;
    f.t = 0;
    f.n -= 1;
    const pool = g.rng.foes.shuffle(targetable(g));
    for (let k = 0; k < Math.min(S.shells, Math.max(1, pool.length)); k++) {
      const s = pool[k];
      const p = s ? shipAhead(g, s, S.mark) : { x: g.map.carrier.x + (k - 1) * 70, y: g.map.carrier.y };
      g.foe.marks.push({ id: g.nextId++, kind: 'shell', x: p.x, y: p.y, t: 0, dur: S.mark, link: th.id, gx: th.x, gy: th.y });
    }
    cue(g, 'truck.raise', th.x, th.y);
  }
  if (f.state === 1 && f.t >= siegeUp()) {
    // Down into its hatch: no longer a threat on the board until it comes
    // back up (updateFoeMarks puts the same gun back).
    th.dead = true;
    const more = f.n > 0;
    g.foe.marks.push({ id: g.nextId++, kind: 'hatch', x: th.x, y: th.y, t: 0, dur: more ? S.down : S.lower + 0.4, lowered: true, ...(more ? { gun: th } : {}) });
    cue(g, 'sub.dive', th.x, th.y, { gain: 0.5 });
  }
}

/** How long a siege gun stays up after marking its circles: until its
 *  shells have left the gun, and a beat. */
export function siegeUp(): number {
  return FOE.siege.mark - FOE.siege.flight + FOE.siege.hold;
}

/** Is a siege gun about to go down (a shot at it now finds an empty hatch)? */
function siegeLowering(th: Threat): boolean {
  const f = th.foe;
  return !!f && f.state === 1 && siegeUp() - f.t < 0.35;
}

/** Where a Spotter circles: FOE.spotter.off past a lane's edge, part way
 *  along, with its whole circle on screen. Of a few tries, the one that
 *  keeps its stand-off from every lane best (a spot squeezed against the
 *  screen's edge, or over another lane, stands in closer), then the one
 *  furthest from the carrier. Test Lab round 1: "spot from a little
 *  further"; the helicopter's spot, which it used to share, sat it a lane's
 *  width closer on maps with a lane near the top. */
function spotterSpot(g: Game, rng: RNG): Point {
  const P = FOE.spotter;
  const lo = { x: P.orbit + P.edge, y: P.orbit + P.edge };
  const hi = { x: VIEW.width - lo.x, y: VIEW.height - lo.y };
  let best: Point = { x: VIEW.width / 2, y: lo.y };
  let bs = -Infinity;
  for (let k = 0; k < 8; k++) {
    const ch = rng.pick(g.map.channels);
    const L = laneLength(ch);
    const d = L * rng.range(0.25, 0.75);
    const p = laneAt(ch, d, (rng.chance(0.5) ? 1 : -1) * (ch.halfWidth + P.off));
    const q = { x: clamp(p.x, lo.x, hi.x), y: clamp(p.y, lo.y, hi.y) };
    // The far side of the lane from the carrier (on its side, the carrier's
    // gun and the allied batteries have it).
    const o = laneAt(ch, d, 0);
    const near = (p.x - o.x) * (g.map.carrier.x - o.x) + (p.y - o.y) * (g.map.carrier.y - o.y) > 0;
    // How far it stands off the nearest lane's edge.
    let gap = Infinity;
    for (const c of g.map.channels) {
      const n = Math.ceil(laneLength(c) / 30);
      for (let i = 0; i <= n; i++) {
        const o = laneAt(c, (laneLength(c) * i) / n, 0);
        gap = Math.min(gap, dist(o.x, o.y, q.x, q.y) - c.halfWidth);
      }
    }
    const score = Math.min(gap, P.off) + 0.25 * dist(q.x, q.y, g.map.carrier.x, g.map.carrier.y) - (near ? 150 : 0);
    if (score > bs) {
      bs = score;
      best = q;
    }
  }
  return best;
}

/** The Spotter: out to its circle beside the convoy, paint a ship, call a
 *  strike on it, and leave after a while. */
function updateSpotter(g: Game, th: Threat, f: FoeData, dt: number): void {
  const P = FOE.spotter;
  if (f.state === 2) {
    th.heading += clamp(angleDiff(th.x < VIEW.width / 2 ? Math.PI : 0, th.heading), -1.5 * dt, 1.5 * dt);
    th.x += Math.cos(th.heading) * th.speed * 1.4 * dt;
    th.y += Math.sin(th.heading) * th.speed * 1.4 * dt;
    if (th.x < -120 || th.x > VIEW.width + 120) th.dead = true;
    return;
  }
  // Fly the circle (counter-clockwise), steering for a point ahead on it.
  const a = Math.atan2(th.y - f.py, th.x - f.px) + 0.5;
  steer(th, f.px + Math.cos(a) * P.orbit, f.py + Math.sin(a) * P.orbit, th.speed, 2.2, dt);
  if (f.state === 0) {
    if (dist(th.x, th.y, f.px, f.py) <= P.orbit + 30) {
      f.state = 1;
      f.t = 0;
    }
    return;
  }
  if (f.t >= P.stay) {
    f.state = 2;
    if (g.foe.paint?.by === th.id) g.foe.paint = null;
    return;
  }
  // Paint: the ship nearest its circle (a new one if that one is gone).
  if (f.t >= P.paint) {
    if (!g.ships.some((s) => s.id === f.link)) {
      const s = targetable(g).sort((a2, b) => dist(a2.x, a2.y, f.px, f.py) - dist(b.x, b.y, f.px, f.py))[0];
      f.link = s ? s.id : -1;
      f.n = 0;
    }
    if (f.link >= 0 && g.foe.paint?.ship !== f.link) cue(g, 'foe.paint', th.x, th.y);
    if (f.link >= 0) g.foe.paint = { ship: f.link, by: th.id };
    // The strike it calls: missiles from the bases at that ship, cancelled
    // if the spotter is shot down first.
    if (f.link >= 0 && f.n === 0 && f.t >= P.paint + P.call) {
      f.n = 1;
      callStrike(g, th, f.link);
    }
  }
}

/** The Spotter's strike: three ballistics from the live launch sites, a
 *  moment apart, at the painted ship. */
function callStrike(g: Game, th: Threat, ship: number): void {
  const P = FOE.spotter;
  const sites = g.map.bases.map((b, i) => i).filter((i) => g.map.bases[i].kinds.length > 0 && !g.map.bases[i].cove && !g.map.bases[i].chute && !g.map.bases[i].generator && !g.baseDown[i]);
  if (!sites.length) return;
  for (let k = 0; k < P.strike; k++) {
    g.queue.push({ at: g.waveT + 1 + k * P.strikeGap, kind: 'ballistic', base: g.rng.foes.pick(sites), target: ship, spotter: th.id });
  }
  g.queue.sort((a, b) => a.at - b.at);
  cue(g, 'notice', th.x, th.y);
}

/** While a Spotter paints a ship, most new launches go for it. */
export function paintTarget(g: Game, th: Threat): void {
  const p = g.foe.paint;
  if (!p || th.target === CARRIER_TARGET || th.target < 0 || !g.ships.some((s) => s.id === p.ship)) return;
  if (g.rng.foes.chance(FOE.spotter.share)) th.target = p.ship;
}

/** The Attack Helicopter: fly to a spot beside the lane (marked as it
 *  comes), settle, fire missile pairs, move on after two, leave after six. */
function updateHeli(g: Game, th: Threat, f: FoeData, dt: number): void {
  const H = FOE.attackHeli;
  const max = th.speed;
  let wx = f.px;
  let wy = f.py;
  if (f.state === 3) {
    // Leaving: off the nearer side.
    wx = th.x < VIEW.width / 2 ? -200 : VIEW.width + 200;
    wy = th.y;
  }
  // Arrive: full speed far off, easing into the hover.
  const dx = wx - th.x;
  const dy = wy - th.y;
  const d = Math.hypot(dx, dy);
  const want = Math.min(max, d * 1.6);
  const tvx = d > 1 ? (dx / d) * want : 0;
  const tvy = d > 1 ? (dy / d) * want : 0;
  const ax = clamp(tvx - (f.vx ?? 0), -H.accel * dt, H.accel * dt);
  const ay = clamp(tvy - (f.vy ?? 0), -H.accel * dt, H.accel * dt);
  f.vx = (f.vx ?? 0) + ax;
  f.vy = (f.vy ?? 0) + ay;
  th.x += f.vx * dt;
  th.y += f.vy * dt;
  const sp = Math.hypot(f.vx, f.vy);
  // Nose: along its path while it flies, at the convoy while it hovers.
  const ship = targetable(g)[0];
  const face = sp > 40 ? Math.atan2(f.vy, f.vx) : ship ? Math.atan2(ship.y - th.y, ship.x - th.x) : th.heading;
  th.heading += clamp(angleDiff(face, th.heading), -3 * dt, 3 * dt);
  if (f.state === 0 && d < 12 && sp < 30) {
    f.state = 1;
    f.t = 0;
  } else if (f.state === 1 && f.t >= H.settle) {
    f.state = 2;
    f.t = H.gap;
    f.link = 0;
  } else if (f.state === 2) {
    if (f.t >= H.gap) {
      f.t = 0;
      f.n += 1;
      f.link += 1;
      for (let k = 0; k < H.pair; k++) heliRocket(g, th, k);
    }
    if (f.t >= H.gap * 0.6 && f.link >= H.perSpot) {
      if (f.n >= H.volleys) f.state = 3;
      else {
        const next = heliSpot(g, g.rng.foes, { x: f.px, y: f.py });
        f.px = next.x;
        f.py = next.y;
        f.state = 0;
      }
      f.t = 0;
    }
  } else if (f.state === 3 && (th.x < -120 || th.x > VIEW.width + 120)) {
    th.dead = true;
  }
}

/** One of a helicopter's pair: a small missile at a ship (one hit). */
function heliRocket(g: Game, th: Threat, k: number): void {
  const side = k % 2 ? 1 : -1;
  const x = th.x + Math.cos(th.heading + side * Math.PI / 2) * 14;
  const y = th.y + Math.sin(th.heading + side * Math.PI / 2) * 14;
  const m = spawnThreat(g, 'heliRocket', x, y, 'air');
  m.parent = 'attackHeli';
  // Off the rail pointed at its own ship (spawnThreat aims it), splayed a
  // little: launched along the helicopter's nose, one at a ship behind it
  // used to loop round first (Test Lab round 1).
  m.heading += side * 0.2;
  g.origins.air -= 1;
  g.origins.child += 1;
}

/** The torpedo: down a straight line to where its ship will be, and on past
 *  it; the line is drawn. */
function fireTorpedo(g: Game, sub: Threat): void {
  const S = FOE.torpedoSub;
  const speed = THREATS.torpedo.speed * (1 + (g.waveSpeed - 1) * 0.3);
  const pool = targetable(g);
  const s = pool.length ? g.rng.foes.pick(pool) : null;
  let p: Point = s ?? g.map.carrier;
  if (s) {
    // Where the ship will be when the torpedo gets there.
    let t = dist(sub.x, sub.y, s.x, s.y) / speed;
    for (let k = 0; k < 6; k++) {
      p = shipAhead(g, s, t);
      t = dist(sub.x, sub.y, p.x, p.y) / speed;
    }
  }
  const run = dist(sub.x, sub.y, p.x, p.y) + S.run;
  const m = spawnThreat(g, 'torpedo', sub.x, sub.y, 'sub');
  m.speed = speed;
  m.heading = Math.atan2(p.y - sub.y, p.x - sub.x);
  m.target = s ? s.id : CARRIER_TARGET;
  m.foe = data({ sx: sub.x, sy: sub.y, along: run, px: p.x, py: p.y });
  cue(g, 'foe.torpedo', sub.x, sub.y);
}

/** The Scavenger: to the nearest pickup no other is after; grab it (it is
 *  gone) and off the top. With nothing on the water, wait up there. */
function updateScavenger(g: Game, th: Threat, f: FoeData, dt: number): void {
  const S = FOE.scavenger;
  if (f.state === 1 || (f.state === 0 && f.t >= S.wait && f.link < 0)) {
    f.state = 1;
    steer(th, th.x, -120, S.leave, 4, dt);
    if (th.y < -60) th.dead = true;
    return;
  }
  let p = g.pickups.find((o) => o.id === f.link);
  if (!p) {
    const claimed = new Set(g.threats.filter((t) => t.kind === 'scavenger' && t !== th && !t.dead).map((t) => t.foe?.link));
    p = g.pickups.filter((o) => !claimed.has(o.id)).sort((a, b) => dist(a.x, a.y, th.x, th.y) - dist(b.x, b.y, th.x, th.y))[0];
    f.link = p ? p.id : -1;
  }
  if (!p) {
    // Nothing to take: it lurks, circling slowly over the water off the
    // convoy where the pickups fall (the player: "it should circle and
    // lurk", not sit on the shore). The circle drifts with the convoy.
    const c = lurkSpot(g);
    const k = Math.min(1, dt * 0.6);
    f.sx = f.sx === undefined ? c.x : f.sx + (c.x - f.sx) * k;
    f.sy = f.sy === undefined ? c.y : f.sy + (c.y - f.sy) * k;
    const a = Math.atan2(th.y - f.sy, th.x - f.sx) + 0.5;
    steer(th, f.sx + Math.cos(a) * S.orbit, f.sy + Math.sin(a) * S.orbit, S.spin * S.orbit, 2.6, dt);
    return;
  }
  steer(th, p.x, p.y, th.speed, 5, dt);
  if (dist(th.x, th.y, p.x, p.y) <= S.grab) {
    // Taken: the pickup is gone for good (the player's note).
    g.pickups = g.pickups.filter((o) => o !== p);
    addFx(g, 'burst', p.x, p.y, { life: 0.4, r: 20 });
    cue(g, 'foe.grab', p.x, p.y);
    f.state = 1;
    f.link = -2;
  }
}

/** Where a Scavenger circles while it waits: over open water `above` px off
 *  the convoy's middle (either side, whichever is water and on screen), or
 *  over the lane if there is no convoy yet. */
function lurkSpot(g: Game): Point {
  const S = FOE.scavenger;
  const ch = g.map.channels[0];
  const mid = g.ships.length
    ? { x: g.ships.reduce((a, s) => a + s.x, 0) / g.ships.length, y: g.ships.reduce((a, s) => a + s.y, 0) / g.ships.length }
    : laneAt(ch, laneLength(ch) * 0.5, 0);
  const x = clamp(mid.x, 160, VIEW.width - 160);
  for (const dy of [-S.above, S.above, -S.above * 0.5, S.above * 0.5]) {
    const y = mid.y + dy;
    if (y > 120 && y < VIEW.height - 140 && !onLand(g, x, y)) return { x, y };
  }
  return { x, y: clamp(mid.y, 120, VIEW.height - 140) };
}

/** Warnings that come before a foe: the periscope before the sub. */
export function updateFoeMarks(g: Game, dt: number): void {
  if (!g.foe.marks.length) return;
  const live: FoeMark[] = [];
  for (const m of g.foe.marks) {
    m.t += dt;
    if (m.kind === 'fire') fireStep(g, m, dt);
    if (m.t < m.dur) {
      live.push(m);
      continue;
    }
    if (m.kind === 'periscope') {
      const th = spawnThreat(g, 'torpedoSub', m.x, m.y, 'sub');
      th.target = CARRIER_TARGET;
      th.heading = 0;
      th.foe = data();
      addFx(g, 'spray', m.x, m.y, { life: 0.7, r: 22 });
    } else if (m.kind === 'dive') {
      const D = FOE.diveBomber;
      // Its run starts near the top of the screen, `run` px short of the
      // circle (less when the circle is high up), coming down at a slant.
      let a = Math.PI / 2 + g.rng.foes.range(-D.slant, D.slant);
      const L = Math.max(D.minRun, Math.min(D.run, (m.y - D.top) / Math.sin(a)));
      const sx = clamp(m.x - Math.cos(a) * L, 40, VIEW.width - 40);
      const sy = m.y - Math.sin(a) * L;
      a = Math.atan2(m.y - sy, m.x - sx);
      const th = spawnThreat(g, 'diveBomber', sx, sy, 'air');
      th.target = CARRIER_TARGET;
      th.heading = a;
      th.foe = data({ px: m.x, py: m.y, sx, sy });
      cue(g, 'foe.whistle', m.x, m.y);
    } else if (m.kind === 'hatch') {
      // The hatch opens and the gun comes up: the same gun (its hits and
      // salvos kept), or a new one on its first rise.
      if (m.gun) {
        const th = m.gun;
        th.dead = false;
        th.foe = { ...(th.foe ?? data()), state: 0, t: 0 };
        g.threats.push(th);
        cue(g, 'truck.raise', th.x, th.y, { gain: 0.6 });
      } else if (m.spawn) {
        const th = spawnThreat(g, 'siege', m.x, m.y, 'truck');
        th.target = CARRIER_TARGET;
        th.heading = Math.PI / 2;
        th.foe = data({ n: FOE.siege.salvos });
      }
    } else if (m.kind === 'shell') {
      const S = FOE.siege;
      addFx(g, 'splash', m.x, m.y, { life: 0.9, r: S.radius });
      cue(g, 'impact.splash', m.x, m.y);
      for (const s of [...g.ships]) if (dist(s.x, s.y, m.x, m.y) <= S.radius) damageShip(g, s, S.damage, 'siege');
    }
  }
  g.foe.marks = live;
  // A siege shell leaves the gun a beat before it lands (from then on,
  // killing the gun doesn't stop it).
  for (const m of g.foe.marks) {
    if (m.kind === 'shell' && !m.fired && m.dur - m.t <= FOE.siege.flight) {
      m.fired = true;
      addFx(g, 'launch', m.gx ?? m.x, m.gy ?? m.y, { life: 0.4, r: 14 });
      cue(g, 'foe.shell', m.gx ?? m.x, m.gy ?? m.y);
    }
  }
}

/** Does something on this foe take the shot instead (the Armored Drone's
 *  plate, hit from the front)? Then the shot is spent on that. */
export function absorbs(g: Game, th: Threat, from: Point, amount: number): boolean {
  if (th.kind !== 'armored' || !th.foe || th.foe.n <= 0) return false;
  // From the front: the shot comes in within the plate's arc of its nose.
  const a = Math.atan2(from.y - th.y, from.x - th.x);
  if (Math.abs(angleDiff(a, th.heading)) > (FOE.armored.front * Math.PI) / 180) return false;
  th.foe.n = Math.max(0, th.foe.n - amount);
  addFx(g, 'block', th.x + Math.cos(th.heading) * 16, th.y + Math.sin(th.heading) * 16, { life: 0.35, r: 20 });
  cue(g, 'foe.plate', th.x, th.y);
  return true;
}

/** Is a foe in play, or still to come, that should hold the wave open? */
export function foesBusy(g: Game): boolean {
  return g.foe.shots.length > 0 || g.foe.marks.length > 0;
}

/** The Rocket Truck: drive to the shore, raise the launcher slowly (the
 *  tell), fire its rockets one by one, lower and drive back. */
function updateTruck(g: Game, th: Threat, f: FoeData, dt: number): void {
  const R = FOE.rocketTruck;
  const path = f.path!;
  const length = pathLength(path);
  if (f.state === 0) {
    f.along = Math.min(length, (f.along ?? 0) + th.speed * dt);
    if (f.along >= length) {
      f.state = 1;
      f.t = 0;
      cue(g, 'truck.raise', th.x, th.y);
    }
  } else if (f.state === 1) {
    if (f.t >= R.raise) {
      f.state = 2;
      f.t = R.gap;
    }
  } else if (f.state === 2) {
    if (f.t >= R.gap && f.n > 0) {
      // A salvo (Test Lab round 1: "make it launch like five rockets at a
      // time ... a lot less damage"): one ship, a ripple of small rockets.
      f.t = 0;
      f.n -= 1;
      const pool = targetable(g);
      const s = pool.length ? g.rng.foes.pick(pool) : null;
      f.ripple = { id: g.nextId++, ship: s ? s.id : -1, left: R.perSalvo, next: 0 };
    }
    const r = f.ripple;
    while (r && r.left > 0 && f.t >= r.next) {
      fireRocket(g, th, r, R.perSalvo - r.left);
      r.left -= 1;
      r.next += R.ripple;
    }
    if (f.n <= 0 && (!r || r.left <= 0) && f.t >= R.gap * 0.5) {
      f.state = 3;
      f.t = 0;
    }
  } else if (f.state === 3) {
    if (f.t >= R.lower) {
      f.state = 4;
      f.t = 0;
    }
  } else {
    f.along = Math.max(0, (f.along ?? 0) - th.speed * dt);
    // Back off the shore and gone (not a kill).
    if (f.along <= 0) th.dead = true;
  }
  const p = alongPath(path, f.along ?? 0);
  th.x = p.x;
  th.y = p.y;
  th.heading = p.heading + (f.state === 4 ? Math.PI : 0);
}

/** The `k`th rocket of a salvo at its ship (or the carrier), aimed where the
 *  ship will be when it lands: the first dead on, the rest spread round it
 *  (`spread`), so the salvo lands as a cluster on and around the hull. */
function fireRocket(g: Game, th: Threat, r: NonNullable<FoeData['ripple']>, k: number): void {
  const R = FOE.rocketTruck;
  const s = r.ship >= 0 ? g.ships.find((o) => o.id === r.ship) : undefined;
  const t0 = s ?? g.map.carrier;
  const dur = Math.max(0.35, dist(th.x, th.y, t0.x, t0.y) / R.rocketSpeed);
  const p = s ? shipAhead(g, s, dur) : t0;
  const a = (k / Math.max(1, R.perSalvo - 1)) * Math.PI * 2 + g.rng.foes.range(-0.5, 0.5);
  const off = k === 0 ? 0 : R.spread * g.rng.foes.range(0.6, 1);
  const tx = p.x + Math.cos(a) * off;
  const ty = p.y + Math.sin(a) * off;
  g.foe.shots.push({ id: g.nextId++, kind: 'rocket', x: th.x, y: th.y, sx: th.x, sy: th.y, tx, ty, t: 0, dur, from: 'rocketTruck', salvo: r.id, ...(r.spent ? { spent: true } : {}) });
  addFx(g, 'launch', th.x, th.y, { life: 0.3, r: 8 });
  cue(g, 'truck.fire', th.x, th.y, { gain: k === 0 ? 1 : 0.55 });
}

/** Shots no interceptor can stop: they fly and land. */
export function updateFoeShots(g: Game, dt: number): void {
  if (!g.foe.shots.length) return;
  const live: FoeShot[] = [];
  for (const s of g.foe.shots) {
    s.t += dt;
    const p = Math.min(1, s.t / s.dur);
    s.x = s.sx + (s.tx - s.sx) * p;
    s.y = s.sy + (s.ty - s.sy) * p;
    if (p < 1) {
      live.push(s);
      continue;
    }
    if (s.kind === 'bomb') {
      // The dive bomber's bomb: full on the hull in the circle, a little
      // round it.
      const D = FOE.diveBomber;
      addFx(g, 'splash', s.tx, s.ty, { life: 1, r: D.splash });
      cue(g, 'impact.splash', s.tx, s.ty);
      const near = g.ships.map((o) => ({ o, d: dist(o.x, o.y, s.tx, s.ty) })).filter((o) => o.d <= D.splash).sort((a, b) => a.d - b.d);
      near.forEach((o, k) => damageShip(g, o.o, k === 0 && o.d <= D.hit ? THREATS.diveBomber.damage : D.splashDamage, 'diveBomber', k === 0));
      continue;
    }
    // A rocket hits the nearest hull within reach of where it lands. A
    // salvo hits once: the first of its rockets on a hull does it, the
    // rest of the salvo only splash.
    addFx(g, 'boom', s.tx, s.ty, { life: 0.4, r: 16 });
    cue(g, 'impact.splash', s.tx, s.ty, { gain: s.salvo !== undefined ? 0.6 : 1 });
    if (s.spent) continue;
    const hull = g.ships
      .map((o) => ({ o, d: dist(o.x, o.y, s.tx, s.ty) }))
      .filter((o) => o.d <= FOE.rocketTruck.hitRadius)
      .sort((a, b) => a.d - b.d)[0];
    if (!hull) continue;
    damageShip(g, hull.o, 1, s.from);
    if (s.salvo !== undefined) spendSalvo(g, s.salvo);
  }
  g.foe.shots = live;
}

/** How high a siege shell's arc rises, at its top (px, as drawn). */
export const SHELL_ARC = 120;

/** Where a fired siege shell is on its arc from the gun to its circle. */
export function shellAt(m: FoeMark): Point {
  const u = Math.max(0, Math.min(1, 1 - (m.dur - m.t) / FOE.siege.flight));
  const gx = m.gx ?? m.x;
  const gy = m.gy ?? m.y;
  return { x: gx + (m.x - gx) * u, y: gy + (m.y - gy) * u - 4 * SHELL_ARC * u * (1 - u) };
}

/** Everything in the air that no interceptor can stop, where it is now:
 *  the Rocket Truck's rockets, the Dive Bomber's bomb, the Siege Battery's
 *  shells in flight. Test Lab round 1: these are all drawn red ("red
 *  projectiles you just cannot intercept"). */
export function redShots(g: Game): Point[] {
  const out: Point[] = g.foe.shots.map((s) => ({ x: s.x, y: s.y }));
  for (const m of g.foe.marks) if (m.kind === 'shell' && m.fired) out.push(shellAt(m));
  return out;
}

/** A tap at (x, y) that found a red shot and nothing it could shoot: the
 *  game says so under the finger ("cannot intercept", the player's note). */
export function tappedRedShot(g: Game, x: number, y: number, r: number): boolean {
  if (g.threats.some((t) => !t.dead && dist(t.x, t.y, x, y) <= r)) return false;
  return redShots(g).some((p) => dist(p.x, p.y, x, y) <= r);
}

/** The Nuke and the new enemies (Test Lab round 1: "it should blow up
 *  everything on the screen"): a siege gun down in its hatch is brought up
 *  to be caught with the rest (game.ts's nuke kills every threat on the
 *  screen next), and every warning and shot on the water is gone: a sub
 *  still at periscope depth, a dive bomber's circle, a siege battery's
 *  circles and shells, the rockets and bombs in the air. */
export function nukeFoes(g: Game): void {
  for (const m of g.foe.marks) {
    if (m.kind === 'hatch' && m.gun) {
      m.gun.dead = false;
      g.threats.push(m.gun);
    }
    if (m.kind === 'periscope') addFx(g, 'sink', m.x, m.y, { life: 1.6, r: 26 });
  }
  g.foe.marks = [];
  g.foe.shots = [];
}

/** A truck's salvo has done its hit: its other rockets, in the air or
 *  still to go, only splash. */
function spendSalvo(g: Game, id: number): void {
  for (const o of g.foe.shots) if (o.salvo === id) o.spent = true;
  for (const t of g.threats) if (t.kind === 'rocketTruck' && t.foe?.ripple?.id === id) t.foe.ripple.spent = true;
}

/** A foe is killed (not a hit that lands): what that sets off. `quiet` for
 *  the Nuke, which clears the screen instead of splitting things. */
export function foeDown(g: Game, th: Threat, quiet: boolean): void {
  if (th.kind === 'hydra' && !quiet) splitHydra(g, th);
  if (th.kind === 'spotter') {
    // Its strike is called off; what has launched keeps coming.
    g.queue = g.queue.filter((l) => l.spotter !== th.id);
    if (g.foe.paint?.by === th.id) g.foe.paint = null;
  }
  // An Incendiary Missile shot down bursts where it is: its fireball burns
  // there (the Nuke takes it out with no fire, and puts out any burning).
  if (th.kind === 'cloud' && !quiet) burstCloud(g, th);
  // A siege gun's circles that haven't fired yet go with it.
  if (th.kind === 'siege') g.foe.marks = g.foe.marks.filter((m) => m.link !== th.id || m.fired);
}

/** The hit that kills a Hydra splits it into darts at the ships nearest it. */
function splitHydra(g: Game, th: Threat): void {
  const near = targetable(g, VIEW.width + 40).sort((a, b) => dist(a.x, a.y, th.x, th.y) - dist(b.x, b.y, th.x, th.y));
  const n = FOE.hydra.darts;
  for (let k = 0; k < n; k++) {
    const t = near.length ? near[k % near.length].id : CARRIER_TARGET;
    const s = near.length ? near[k % near.length] : g.map.carrier;
    const heading = Math.atan2(s.y - th.y, s.x - th.x) + (k - (n - 1) / 2) * FOE.hydra.spread;
    const d = child(g, th, 'dart', t, heading);
    d.hp = THREATS.dart.hp;
    // They fly out of the blast that split it (the gun's own splash would
    // take them with it); a wider blast (Flak, a Wide Warhead) still does.
    d.x += Math.cos(heading) * FOE.hydra.clear;
    d.y += Math.sin(heading) * FOE.hydra.clear;
    g.threats.push(d);
  }
  addFx(g, 'burst', th.x, th.y, { life: 0.4, r: 26 });
  cue(g, 'foe.split', th.x, th.y);
}

/** Has this decoy shown itself? (Helpers and bots leave it alone then.) */
export function revealedDecoy(th: Threat): boolean {
  return th.kind === 'decoy' && (th.foe?.state ?? 0) >= 1;
}

/** Seconds until a new enemy does harm (what the bots and helpers rank
 *  threats by), or null to use the usual distance over speed. */
export function foeEta(g: Game, th: Threat): number | null {
  const f = th.foe;
  switch (th.kind) {
    case 'rocketTruck': {
      if (!f) return null;
      const R = FOE.rocketTruck;
      if (f.state === 0) return (pathLength(f.path!) - (f.along ?? 0)) / th.speed + R.raise;
      if (f.state === 1) return Math.max(0.2, R.raise - f.t);
      return f.state === 2 ? 0.4 : 30;
    }
    case 'siege': {
      if (!f) return null;
      const S = FOE.siege;
      const due = g.foe.marks.filter((m) => m.link === th.id && !m.fired).map((m) => m.dur - m.t - S.flight);
      if (due.length) return Math.max(0.1, Math.min(...due));
      // Rising: its circles come at the top and its shells leave after
      // them. Up with its shells gone, it is about to go down.
      return f.state === 0 ? S.rise - f.t + S.mark - S.flight : 30;
    }
    case 'attackHeli':
      if (!f) return null;
      return f.state === 2 ? Math.max(0.2, FOE.attackHeli.gap - f.t) : f.state === 3 ? 30 : 3;
    case 'torpedoSub':
      return f && f.state === 0 ? Math.max(0.1, FOE.torpedoSub.fireAt - f.t) : 30;
    case 'torpedo':
      return f ? dist(th.x, th.y, f.px, f.py) / Math.max(1, th.speed) : null;
    case 'diveBomber':
      return f && f.state === 0 ? Math.max(0.05, FOE.diveBomber.window - f.t) : 30;
    case 'spotter':
      if (!f) return null;
      return f.state === 1 && f.n === 0 ? Math.max(0.5, FOE.spotter.paint + FOE.spotter.call - f.t) : 12;
    case 'scavenger': {
      const p = f && f.link >= 0 ? g.pickups.find((o) => o.id === f.link) : undefined;
      return p ? dist(th.x, th.y, p.x, p.y) / th.speed : 12;
    }
    case 'guard':
      return 30;
    case 'tender':
      return 5;
    case 'lure':
      return f && f.state === 0 ? 6 : 3;
    case 'cloud': {
      // Not when it hits, but how long it can still be shot down with its
      // fireball clear of the convoy (two radii off the nearest hull), at half
      // weight: the answer is to kill it early.
      const s = g.ships.reduce((m, o) => Math.min(m, dist(o.x, o.y, th.x, th.y)), Infinity);
      return Math.max(0.3, ((s - FOE.cloud.radius * 2) / Math.max(1, th.speed)) * 0.5);
    }
    case 'decoy':
      return revealedDecoy(th) ? 30 : null;
    default:
      return null;
  }
}

/** Worth a shot? Not a decoy that has shown itself. */
export function foeWorthShooting(g: Game, th: Threat): boolean {
  void g;
  if (revealedDecoy(th)) return false;
  if (th.kind === 'guard') return false;
  // A siege gun about to go down: a shot now gets there to a shut hatch.
  if (th.kind === 'siege' && siegeLowering(th)) return false;
  return true;
}

/** Had this foe already done its harm when it was killed (fired its rockets,
 *  dropped its bomb, loosed its torpedo)? For the Test Lab's "stopped before
 *  harm". Anything that strikes by hitting a hull hadn't, if it was shot. */
export function foeHarmed(th: Threat): boolean {
  const f = th.foe;
  if (!f) return false;
  switch (th.kind) {
    case 'rocketTruck':
      return f.n < FOE.rocketTruck.salvos;
    case 'diveBomber':
    case 'torpedoSub':
      return f.state >= 1;
    case 'siege':
      return f.n < FOE.siege.salvos;
    case 'attackHeli':
    case 'spotter':
      return f.n > 0;
    case 'cloud':
      // Burst with a hull close by: its fireball was already on the convoy.
      return f.n > 0;
    default:
      return false;
  }
}
