// The enemy build (docs/design/v3-enemy-build.md): how the new enemies plan
// into waves, come into play, move, and what they do when they die. The
// numbers are in data/foes.ts and data/config.ts (THREATS); this file is the
// behaviour. game.ts calls in at four places: planning a wave (planFoes),
// launching (launchFoe), each step (updateFoe, updateFoeShots) and a kill
// (foeDown).

import type { RNG } from '../../sim/rng';
import { THREATS, VIEW, type ThreatKind } from '../data/config';
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
  damageShip,
  dist,
  pathLength,
  shipAhead,
  spawnThreat,
  targetable,
  type Game,
  type Launch,
  type Threat,
} from './game';

/** Something a foe fires that no interceptor can stop (en-unstoppable: the
 *  source always has a tell and can always be shot). It flies from (sx, sy)
 *  to (tx, ty) in `dur` seconds and lands there. */
export interface FoeShot {
  id: number;
  kind: 'rocket';
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  from: ThreatKind;
}

/** A foe's own state, on its threat. `state` and `t` are its phase and the
 *  seconds in it; the rest is used as each foe needs. */
export interface FoeData {
  state: number;
  t: number;
  /** Rounds left (Rocket Truck), or a slot in its group (Loiter). */
  n: number;
  /** A point it works from: the loiter spot. */
  px: number;
  py: number;
  /** Its group (loiter drones share one). */
  link: number;
  /** A truck's road and how far along it. */
  path?: Point[];
  along?: number;
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
}

/** A run's foes: a map in chapter n sends any from chapters 1 to n, leading
 *  with the chapter's own. Each map of a chapter leads with a different one,
 *  so its first foe (wave 2) is that map's debut. */
export function newFoeState(mapId: MapId, setting: FoeSetting = 'campaign'): FoeState {
  const ch = chapterOf(mapId);
  const st: FoeState = { pool: [], lead: [], cursor: 0, only: null, shots: [] };
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
const OWN_MOVES = new Set<ThreatKind>(['sprinter', 'decoy', 'rocketTruck', 'loiter']);

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
      // same places in the swarm.
      const kinds = rng.shuffle(Array.from({ length: FOE.decoy.size }, (_, k): ThreatKind => (k < FOE.decoy.fakes ? 'decoy' : 'drone')));
      kinds.forEach((kind, k) => {
        const th = spawnThreat(g, kind, at.x + (k - 2.5) * 12, at.y + (k % 2) * 8, 'base');
        if (kind === 'decoy') th.foe = data();
      });
      return;
    }
    case 'hydra': {
      if (!at) return;
      spawnThreat(g, 'hydra', at.x, at.y, 'base');
      return;
    }
    case 'loiter': {
      if (!at) return;
      const spot = loiterSpot(g, rng);
      const link = g.nextId;
      for (let k = 0; k < FOE.loiter.size; k++) {
        const th = spawnThreat(g, 'loiter', at.x + (k - 1.5) * 12, at.y, 'base');
        th.target = CARRIER_TARGET;
        th.foe = data({ px: spot.x, py: spot.y, link, n: k });
      }
      return;
    }
    case 'rocketTruck': {
      const roads = g.map.roads.popups;
      if (!roads.length) return;
      const road = rng.pick(roads);
      const th = spawnThreat(g, 'rocketTruck', road.from.x, road.from.y, 'truck');
      th.target = CARRIER_TARGET;
      th.foe = data({ path: [road.from, road.to], along: 0, n: FOE.rocketTruck.rockets });
      th.heading = Math.atan2(road.to.y - road.from.y, road.to.x - road.from.x);
      return;
    }
    default:
      return;
  }
}

/** Where loitering drones wait: over the edge of a lane, part way along,
 *  clear of every ship for now, with ships still to come to it (of a few
 *  spots tried, the one whose nearest ship upstream is furthest off, so the
 *  wait is a real one). */
function loiterSpot(g: Game, rng: RNG): Point {
  const lane = rng.int(g.map.channels.length);
  const ch = g.map.channels[lane];
  const L = laneLength(ch);
  const side = rng.chance(0.5) ? 1 : -1;
  let best: Point | null = null;
  let bestGap = -Infinity;
  let open: Point | null = null;
  let openD = -Infinity;
  for (let k = 0; k < 8; k++) {
    const d = L * rng.range(0.3, 0.8);
    const p = laneAt(ch, d, side * ch.halfWidth * 0.55);
    const q = { x: clamp(p.x, 80, VIEW.width - 80), y: clamp(p.y, 80, VIEW.height - 80) };
    const nearest = g.ships.reduce((m, s) => Math.min(m, dist(s.x, s.y, q.x, q.y)), Infinity);
    // A crowded lane may have no clear stretch: then the emptiest one.
    if (nearest > openD) {
      openD = nearest;
      open = q;
    }
    if (nearest <= FOE.loiter.trigger + 80) continue;
    const behind = g.ships.filter((s) => s.channel === lane && s.d < d).map((s) => d - s.d);
    const gap = behind.length ? Math.min(...behind) : d;
    if (gap > bestGap) {
      bestGap = gap;
      best = q;
    }
  }
  return best ?? open!;
}

/** The ship a threat is after, if it is a ship. */
function shipOf(g: Game, th: Threat) {
  return th.target === CARRIER_TARGET ? undefined : g.ships.find((s) => s.id === th.target);
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
          cue(g, 'missile.launch', th.x, th.y, { gain: 0.5 });
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
      steer(th, tp.x, tp.y, th.speed, Infinity, dt);
      th.heading += d > 80 ? weave(th) * dt * 4 : 0;
      if (f.state === 0 && d <= FOE.decoy.revealAt) f.state = 1;
      if (d <= FOE.decoy.fizzle) {
        // At the convoy, a decoy is nothing: a puff and it's gone.
        th.dead = true;
        addFx(g, 'burst', th.x, th.y, { life: 0.4, r: 14 });
      }
      return;
    }
    case 'loiter': {
      const spin = FOE.loiter.spin;
      const slot = (f.n / FOE.loiter.size) * Math.PI * 2;
      if (f.state === 0) {
        // To the spot, then into the circle.
        const a = g.t * spin + slot;
        const ox = f.px + Math.cos(a) * FOE.loiter.orbit;
        const oy = f.py + Math.sin(a) * FOE.loiter.orbit;
        steer(th, ox, oy, th.speed, 4, dt);
        if (dist(th.x, th.y, ox, oy) < 20) {
          f.state = 1;
          f.t = 0;
        }
      } else if (f.state === 1) {
        const a = g.t * spin + slot;
        const ox = f.px + Math.cos(a) * FOE.loiter.orbit;
        const oy = f.py + Math.sin(a) * FOE.loiter.orbit;
        th.heading = Math.atan2(oy - th.y, ox - th.x);
        th.x = ox;
        th.y = oy;
        // They circle a moment first whatever comes (the tell), then dive
        // when a ship is inside the ring, or when they tire of waiting.
        const near = f.t >= FOE.loiter.settle && g.ships.some((s) => dist(s.x, s.y, f.px, f.py) <= FOE.loiter.trigger);
        if (near || f.t >= FOE.loiter.wait) diveGroup(g, f.link, f.px, f.py);
      } else {
        retarget(th);
        const tp = aim(th);
        steer(th, tp.x, tp.y, FOE.loiter.dive, 6, dt);
        hit(th);
      }
      return;
    }
    case 'rocketTruck':
      updateTruck(g, th, f, dt);
      return;
    default:
      return;
  }
}

/** A loitering group dives together, each drone at a different ship (the
 *  nearest ones to the spot). */
function diveGroup(g: Game, link: number, x: number, y: number): void {
  const group = g.threats.filter((t) => t.kind === 'loiter' && !t.dead && t.foe?.link === link && t.foe.state < 2);
  if (!group.length) return;
  const ships = targetable(g, VIEW.width + 40).sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y));
  group.forEach((t, k) => {
    t.foe!.state = 2;
    t.foe!.t = 0;
    t.target = ships.length ? ships[k % ships.length].id : CARRIER_TARGET;
  });
  cue(g, 'drone.launch', x, y);
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
      f.t = 0;
      f.n -= 1;
      fireRocket(g, th);
    }
    if (f.n <= 0 && f.t >= R.gap * 0.5) {
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

/** A rocket at a ship (or the carrier), aimed where it will be. */
function fireRocket(g: Game, th: Threat): void {
  const R = FOE.rocketTruck;
  const rng = g.rng.foes;
  const pool = targetable(g);
  const s = pool.length ? rng.pick(pool) : null;
  const t0 = s ?? g.map.carrier;
  const dur = Math.max(0.35, dist(th.x, th.y, t0.x, t0.y) / R.rocketSpeed);
  const p = s ? shipAhead(g, s, dur) : t0;
  g.foe.shots.push({ id: g.nextId++, kind: 'rocket', x: th.x, y: th.y, sx: th.x, sy: th.y, tx: p.x, ty: p.y, t: 0, dur, from: 'rocketTruck' });
  addFx(g, 'launch', th.x, th.y, { life: 0.4, r: 10 });
  cue(g, 'truck.fire', th.x, th.y);
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
    // A rocket hits the nearest hull within reach of where it lands.
    addFx(g, 'boom', s.tx, s.ty, { life: 0.5, r: 22 });
    cue(g, 'impact.splash', s.tx, s.ty);
    const hull = g.ships
      .map((o) => ({ o, d: dist(o.x, o.y, s.tx, s.ty) }))
      .filter((o) => o.d <= FOE.rocketTruck.hitRadius)
      .sort((a, b) => a.d - b.d)[0];
    if (hull) damageShip(g, hull.o, 1, s.from);
  }
  g.foe.shots = live;
}

/** A foe is killed (not a hit that lands): what that sets off. `quiet` for
 *  the Nuke, which clears the screen instead of splitting things. */
export function foeDown(g: Game, th: Threat, quiet: boolean): void {
  if (th.kind === 'hydra' && !quiet) splitHydra(g, th);
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
  cue(g, 'cluster.split', th.x, th.y);
}

/** Has this decoy shown itself? (Helpers and bots leave it alone then.) */
export function revealedDecoy(th: Threat): boolean {
  return th.kind === 'decoy' && (th.foe?.state ?? 0) >= 1;
}
