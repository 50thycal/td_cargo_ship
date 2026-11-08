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
}

/** A warning on the water before a foe shows (a periscope); when it runs
 *  out, the foe comes. */
export interface FoeMark {
  id: number;
  /** A periscope (a torpedo sub to come), a dive bomber's circle, a siege
   *  battery's shell circle. */
  kind: 'periscope' | 'dive' | 'shell';
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
      const gun = siegeSpot(g, rng);
      const th = spawnThreat(g, 'siege', gun.x, gun.y, 'truck');
      th.target = CARRIER_TARGET;
      th.heading = Math.PI / 2;
      th.foe = data({ n: FOE.siege.salvos });
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
      const p = waterSpot(g, rng);
      const th = spawnThreat(g, 'tender', p.x, p.y, 'sub');
      th.target = CARRIER_TARGET;
      th.foe = data({ link: -1 });
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
      const p = waterSpot(g, rng);
      const th = spawnThreat(g, 'lure', p.x, p.y, 'sub');
      th.target = CARRIER_TARGET;
      th.foe = data();
      return;
    }
    case 'cloud': {
      // Off the enemy shore, drifting for a stretch of lane.
      const site = liveSite(g, rng) ?? { x: VIEW.width / 2, y: 80 };
      const ch = rng.pick(g.map.channels);
      const L = laneLength(ch);
      const to = laneAt(ch, L * rng.range(0.3, 0.7), 0);
      const th = spawnThreat(g, 'cloud', site.x, site.y + (site.y < VIEW.height / 2 ? 40 : -40), 'base');
      th.target = CARRIER_TARGET;
      th.foe = data({ px: clamp(to.x, 100, VIEW.width - 100), py: clamp(to.y, 100, VIEW.height - 100) });
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
      const want = Math.atan2(tp.y - th.y, tp.x - th.x);
      th.heading = want + (d > 80 ? DRONE.weaveAmp * Math.sin(th.age * DRONE.weaveFreq + th.phase) : 0);
      th.x += Math.cos(th.heading) * th.speed * dt;
      th.y += Math.sin(th.heading) * th.speed * dt;
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
        // Down out of the sky onto its circle: its window to be shot.
        const u = Math.min(1, f.t / D.window);
        th.x = f.px;
        th.y = f.py - D.high + (D.high - D.low) * u;
        if (u >= 1) {
          // Released: the bomb falls, and nothing stops it now.
          g.foe.shots.push({ id: g.nextId++, kind: 'bomb', x: th.x, y: th.y, sx: th.x, sy: th.y, tx: f.px, ty: f.py, t: 0, dur: D.fall, from: 'diveBomber' });
          cue(g, 'bomber.drop', th.x, th.y);
          f.state = 1;
          f.t = 0;
        }
      } else {
        // Pulls up and away.
        th.y -= 380 * dt;
        th.x += (th.x < VIEW.width / 2 ? -1 : 1) * 120 * dt;
        if (f.t > 0.9) th.dead = true;
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
      updateTender(g, th, f);
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
      // Moored. It gives out after a while, or leaves once the wave has
      // nothing else left in it.
      if (f.t >= FOE.lure.life || alone(g, th)) leave(g, th);
      return;
    }
    case 'cloud': {
      const C = FOE.cloud;
      if (f.state === 9) {
        ignite(g, th);
        return;
      }
      const d = dist(th.x, th.y, f.px, f.py);
      if (d > 4) {
        th.x += ((f.px - th.x) / d) * Math.min(d, th.speed * dt);
        th.y += ((f.py - th.y) / d) * Math.min(d, th.speed * dt);
      } else {
        th.x += C.slow * dt;
        f.px = th.x;
      }
      if (f.t >= C.life || alone(g, th)) {
        // It thins out and is gone.
        th.dead = true;
      }
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

const SUPPORT = new Set<ThreatKind>(['tender', 'lure', 'cloud', 'guard']);

/** Gone from the water, not a kill. */
function leave(g: Game, th: Threat): void {
  th.dead = true;
  addFx(g, 'spray', th.x, th.y, { life: 0.6, r: 20 });
}

/** The Repair Tender: every few seconds, a beam charges on the most damaged
 *  enemy near it, then mends it. */
function updateTender(g: Game, th: Threat, f: FoeData): void {
  const T = FOE.tender;
  if (alone(g, th)) {
    leave(g, th);
    return;
  }
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

/** The Volatile Cloud goes up: every hull under it is hurt, and the carrier
 *  if it's under it too. Over open water, nothing. */
export function ignite(g: Game, th: Threat): void {
  const C = FOE.cloud;
  th.dead = true;
  addFx(g, 'thermo', th.x, th.y, { life: 0.9, r: C.radius });
  cue(g, 'foe.ignite', th.x, th.y);
  for (const s of [...g.ships]) if (dist(s.x, s.y, th.x, th.y) <= C.radius) damageShip(g, s, THREATS.cloud.damage, 'cloud', false);
  const c = g.map.carrier;
  if (dist(c.x, c.y, th.x, th.y) <= C.radius + 40) damageCarrier(g, THREATS.cloud.damage, 'cloud');
}

/** An explosion at (x, y): a Volatile Cloud it is inside goes up (next step,
 *  so one blast can't set off a chain in the middle of another). */
export function sparks(g: Game, x: number, y: number): void {
  for (const t of g.threats) {
    if (t.kind === 'cloud' && !t.dead && t.foe && t.foe.state !== 9 && dist(t.x, t.y, x, y) <= FOE.cloud.radius) t.foe.state = 9;
  }
}

/** A Bodyguard Ring: a shot at the heavy meets one of its guards first. */
export function guardFor(g: Game, th: Threat, from: Point): Threat | null {
  if (th.kind !== 'heavy') return null;
  const guards = g.threats.filter((t) => t.kind === 'guard' && !t.dead && t.foe?.link === th.id);
  if (!guards.length) return null;
  return guards.sort((a, b) => dist(a.x, a.y, from.x, from.y) - dist(b.x, b.y, from.x, from.y))[0];
}

/** A flashing Lure Beacon within reach of a helper: it goes for that. */
export function lureIn(g: Game, x: number, y: number, reach = Infinity): Threat | undefined {
  return g.threats.find((t) => t.kind === 'lure' && !t.dead && dist(t.x, t.y, x, y) <= reach);
}

/** The Siege Battery: set up, then salvos: three circles on the lane where
 *  ships will be, shells fired at them a beat before they land. */
function updateSiege(g: Game, th: Threat, f: FoeData): void {
  const S = FOE.siege;
  if (f.state === 0 && f.t >= S.setup) {
    f.state = 1;
    f.t = S.gap;
  }
  if (f.state === 1 && f.t >= S.gap) {
    if (f.n <= 0) {
      f.state = 2;
      f.t = 0;
      return;
    }
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
  // Out of shells: it packs up (gone, not a kill).
  if (f.state === 2 && f.t >= S.pack && !g.foe.marks.some((m) => m.link === th.id)) th.dead = true;
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
  m.heading = th.heading + side * 0.25;
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
    // Nothing to take: hold up by the enemy shore.
    steer(th, f.px, f.py, th.speed * 0.6, 3, dt);
    if (dist(th.x, th.y, f.px, f.py) < 8) {
      th.x = f.px;
      th.y = f.py;
    }
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

/** Warnings that come before a foe: the periscope before the sub. */
export function updateFoeMarks(g: Game, dt: number): void {
  if (!g.foe.marks.length) return;
  const live: FoeMark[] = [];
  for (const m of g.foe.marks) {
    m.t += dt;
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
      const th = spawnThreat(g, 'diveBomber', m.x, m.y - D.high, 'air');
      th.target = CARRIER_TARGET;
      th.heading = Math.PI / 2;
      th.foe = data({ px: m.x, py: m.y });
      cue(g, 'foe.whistle', m.x, m.y);
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
  if (th.kind === 'spotter') {
    // Its strike is called off; what has launched keeps coming.
    g.queue = g.queue.filter((l) => l.spotter !== th.id);
    if (g.foe.paint?.by === th.id) g.foe.paint = null;
  }
  // A Volatile Cloud shot goes up where it is.
  if (th.kind === 'cloud') ignite(g, th);
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
      return f.state === 0 ? S.setup - f.t + S.mark : f.state === 1 ? S.gap - f.t + S.mark : 30;
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
      return 3;
    case 'cloud': {
      const s = g.ships.reduce((m, o) => Math.min(m, dist(o.x, o.y, th.x, th.y)), Infinity);
      return Math.max(0.5, (s - FOE.cloud.radius) / Math.max(1, th.speed));
    }
    case 'decoy':
      return revealedDecoy(th) ? 30 : null;
    default:
      return null;
  }
}

/** Worth a shot? Not a decoy that has shown itself, and not a Volatile
 *  Cloud over your own ships. */
export function foeWorthShooting(g: Game, th: Threat): boolean {
  if (revealedDecoy(th)) return false;
  if (th.kind === 'cloud') return !g.ships.some((s) => dist(s.x, s.y, th.x, th.y) <= FOE.cloud.radius + 10);
  if (th.kind === 'guard') return false;
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
      return f.n < FOE.rocketTruck.rockets;
    case 'diveBomber':
    case 'torpedoSub':
      return f.state >= 1;
    case 'siege':
      return f.n < FOE.siege.salvos;
    case 'attackHeli':
    case 'spotter':
      return f.n > 0;
    default:
      return false;
  }
}
