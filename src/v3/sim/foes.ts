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
import { EV } from '../data/events';
import { hydraDartPace, hydraDarts, walkingBarrage } from './events';
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
   *  battery's hatch (the gun hidden under it: no target); a Spotter away
   *  off the screen between its turns (round 8; `gun` is the plane). */
  kind: 'periscope' | 'dive' | 'shell' | 'fire' | 'hatch' | 'recall';
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
  /** A new gun's salvos (Bombardment); a periscope's sub firing this many
   *  seconds after it surfaces, the torpedoes in its spread and which of
   *  them is fast (-1: none) (every sub from round 7; the Wolf Pack's own). */
  salvos?: number;
  fireAt?: number;
  spread?: number;
  fast?: number;
  /** How many of its spread may go for ships of their own (the rest fan out
   *  round the first; all of them when not set, the Wolf Pack's), and the
   *  least angle between two of its headings (rad). */
  aimed?: number;
  fan?: number;
  /** A sub that fires its spread one by one (every sub's from round 8, not
   *  the Wolf Pack's): seconds between its torpedoes. */
  stagger?: number;
  /** A shell's damage when not a siege gun's (the Fire Mission's barrage). */
  dmg?: number;
  /** A shell from a battery off the map (round 8: the Spotter's call, the
   *  Fire Mission's barrage): `far`, and the seconds it is in the air
   *  (FOE.siege.flight when not set). */
  far?: boolean;
  flight?: number;
  /** A dive bomber's circle: the line its plane flies in on (its heading). */
  a?: number;
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
  /** Where it set out from (the torpedo's line, the armored drone's start,
   *  the dive bomber's point off screen). */
  sx?: number;
  sy?: number;
  // ---- Special events (sim/events.ts): how one behaves in an event ----
  /** A Rocket Truck: where along its road it stops, seconds it waits there
   *  before raising, seconds it stands stalled, and its driving speed (out,
   *  and back) times its own. An Attack Helicopter: `wait` is how long after
   *  the wall opens fire its first volley goes. */
  stop?: number;
  wait?: number;
  stall?: number;
  drive?: number;
  back?: number;
  /** An Attack Helicopter: the wave second it may open fire, that it holds
   *  its spot, and its volleys before it leaves. */
  hold?: number;
  stay?: boolean;
  volleys?: number;
  /** A Torpedo Sub: seconds after surfacing it fires, and dives; its
   *  spread (torpedoes) and which of them is fast (-1: none). A torpedo:
   *  `fast`, 1 when it is a fast one. */
  fireAt?: number;
  up?: number;
  spread?: number;
  fast?: number;
  aimed?: number;
  fan?: number;
  /** A sub firing one by one (round 8): seconds between its torpedoes, and
   *  the ships it has fired at so far (ids, in order). */
  stagger?: number;
  aimedAt?: number[];
  /** An Armored Drone in a block: its place in it (px off the block's
   *  aim), and no bank of its own (the block banks together). */
  ox?: number;
  oy?: number;
  nobank?: boolean;
  /** An Armored Drone forming up: the block's muster point (its place is
   *  `ox`, `oy` off it). */
  mx?: number;
  my?: number;
  /** A Spotter: the ship it last painted; `mission`: a Fire Mission
   *  spotter (in, paint, call the barrage, out the way it came). */
  prev?: number;
  mission?: boolean;
  /** Where it leaves to (a Fire Mission spotter, a Supply Raid scavenger:
   *  the way it came). */
  ex?: number;
  ey?: number;
  /** A guard: its orbit, the guards in its ring, and which ring. A Lure
   *  Beacon (an event's own, from round 7): its ring when not the usual one. */
  r?: number;
  of?: number;
  ring?: number;
  /** A Repair Tender: hull it mends, and seconds between; the way it is
   *  skirting a shore that blocks its way (+1 left, -1 right). */
  mend?: number;
  every?: number;
  skirt?: number;
  /** A Lure Beacon (an event's): seconds it stays up, when not the usual. */
  life?: number;
  /** A Beacon Strike beacon (round 8): its seconds up at its next call,
   *  and the ship it has marked for it (-1: none yet). */
  call?: number;
  marked?: number;
  /** A dive bomber's flight in: the length of its dive (px), and the
   *  seconds it flies level before it (from off screen). */
  dive?: { len: number; app: number };
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
/** A foe's state, fresh (for the special events' own launches). */
export const foeData = data;

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
      // A periscope first; the sub itself comes up when it runs out. Round
      // 7: it fires a spread of three to five, and about one sub in four
      // puts a fast one in it (which of them, at random). Round 8: one by
      // one, each at a ship, from water with open water to the lanes.
      const S = FOE.torpedoSub;
      const p = subSpot(g, rng);
      const spread = S.spread[0] + rng.int(S.spread[1] - S.spread[0] + 1);
      const fast = rng.chance(S.fastChance) ? rng.int(spread) : -1;
      g.foe.marks.push({ id: g.nextId++, kind: 'periscope', x: p.x, y: p.y, t: 0, dur: S.warn, fireAt: S.fireAt + S.aim, spread, fast, stagger: S.stagger });
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
      // Its line in is drawn now (Test Lab round 4: it flies in from off
      // screen), so the circle can go where the ship will be when the bomb
      // lands: the circle, the flight in, the bomb's fall.
      const D = FOE.diveBomber;
      const pool = targetable(g);
      const tilt = rng.range(-D.slant, D.slant);
      // No ship on the water yet (a test's first seconds): the lane where
      // the convoy is coming in.
      const ch = g.map.channels[0];
      // A ship a Spotter is painting gets the circle (the enemy pairs,
      // round 8: Spotter + Dive Bombers). The pick is drawn either way, so
      // the rest of the run's draws don't move.
      const pick = pool.length ? rng.pick(pool) : null;
      const ship = (g.foe.paint && pool.find((s) => s.id === g.foe.paint!.ship)) || pick;
      let p: Point = ship ? shipAhead(g, ship, D.mark + D.window + D.fall) : laneAt(ch, laneLength(ch) * 0.3, 0);
      let a = diveLine(p, tilt);
      for (let k = 0; k < 2 && ship; k++) {
        p = shipAhead(g, ship, D.mark + divePath(p, a).app + D.window + D.fall);
        a = diveLine(p, tilt);
      }
      g.foe.marks.push({ id: g.nextId++, kind: 'dive', x: p.x, y: p.y, t: 0, dur: D.mark, a });
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
  return siegeSpotAt(g, sites.length ? rng.pick(sites) : { x: VIEW.width / 2, y: 90 });
}

/** A siege gun's place beside a given site. */
export function siegeSpotAt(g: Game, b: Point): Point {
  void g;
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

/** Where a Torpedo Sub surfaces (round 8): a water spot with a straight
 *  run of open water to some stretch of a lane, so its torpedoes have ships
 *  to go for without crossing land (on Saltgate Canal some of the open
 *  water lies behind the banks). Any water spot if none has. */
export function subSpot(g: Game, rng: RNG): Point {
  const cands = g.map.subSpots.length ? rng.shuffle([...g.map.subSpots]) : Array.from({ length: 6 }, () => waterSpot(g, rng));
  // The spot with the most ships in reach over open water now; with none
  // in reach anywhere (no convoy yet), one that sees a lane.
  const ships = targetable(g);
  let best: Point | undefined;
  let bn = 0;
  for (const p of cands) {
    if (onLand(g, p.x, p.y)) continue;
    const n = ships.filter((s) => torpedoWet(g, p, s)).length;
    if (n > bn) {
      bn = n;
      best = p;
    }
  }
  return best ?? cands.find((p) => !onLand(g, p.x, p.y) && seesLane(g, p)) ?? cands[0];
}

/** Is there a straight run of open water from `p` to the middle of some
 *  lane, along a good part of it (a fifth of its points at least)? */
export function seesLane(g: Game, p: Point): boolean {
  for (const ch of g.map.channels) {
    const L = laneLength(ch);
    let wet = 0;
    for (let k = 1; k < 10; k++) {
      const o = laneAt(ch, (L * k) / 10, 0);
      if (o.x > 0 && o.x < VIEW.width && wetRun(g, p, o)) wet += 1;
    }
    if (wet >= 2) return true;
  }
  return false;
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
export function seaEntry(g: Game, to: Point): Point | null {
  let best: Point | null = null;
  let bl = Infinity;
  for (const side of [-1, 1]) {
    for (const dy of [0, -90, 90, -180, 180, -280, 280]) {
      const from = { x: side < 0 ? -70 : VIEW.width + 70, y: to.y + dy };
      if (from.y < 40 || from.y > VIEW.height - 40) continue;
      const L = dist(from.x, from.y, to.x, to.y);
      if (L >= bl) continue;
      if (wetRun(g, from, to)) {
        bl = L;
        best = from;
      }
    }
  }
  return best;
}

/** Is the straight run from `from` to `to` open water all the way (checked
 *  every 16 px on the screen; off it, the shore can't be under it)? */
export function wetRun(g: Game, from: Point, to: Point): boolean {
  const L = dist(from.x, from.y, to.x, to.y);
  for (let u = 0; u <= L; u += 16) {
    const x = from.x + ((to.x - from.x) * u) / Math.max(L, 1e-6);
    const y = from.y + ((to.y - from.y) * u) / Math.max(L, 1e-6);
    if (x > 0 && x < VIEW.width && onLand(g, x, y)) return false;
  }
  return true;
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
      // same speed), so nothing but its tint tells them apart.
      const at = th.slot ? swarmAim(th, tp, d) : tp;
      th.heading = Math.atan2(at.y - th.y, at.x - th.x) + (d > 80 ? DRONE.weaveAmp * Math.sin(th.age * DRONE.weaveFreq + th.phase) : 0);
      th.x += Math.cos(th.heading) * th.speed * dt;
      th.y += Math.sin(th.heading) * th.speed * dt;
      swarmPart(g, th, dt);
      // Round 7: no strobe; its tint is there all the way in. `state` 1 is
      // when a careful player has told it apart (read): close enough to be
      // looking at the swarm, and not in its first seconds. Nothing draws it.
      if (f.state === 0 && d <= FOE.decoy.readAt && f.t >= FOE.decoy.readAfter) f.state = 1;
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
      const at = f.fireAt ?? S.fireAt;
      if (f.stagger !== undefined && f.spread) {
        // Round 8: one by one, each at a ship (`n`: fired so far).
        while (f.n < f.spread && f.t >= at + f.n * f.stagger) {
          f.state = 1;
          fireAimed(g, th, f, f.n === f.fast);
          f.n += 1;
        }
      } else if (f.state === 0 && f.t >= at) {
        f.state = 1;
        if (f.spread) fireSpread(g, th, f.spread, f.fast ?? -1, f.aimed ?? f.spread, f.fan ?? S.fan);
        else fireTorpedo(g, th);
      }
      if (f.t >= (f.up ?? S.up)) {
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
      // A shore that wasn't there when it was fired (Saltgate's lock gates
      // swing shut across the water): it ends against it, never on it
      // (round 8). Its nose is checked a step ahead.
      const nx = th.x + Math.cos(th.heading) * (th.speed * dt + 3);
      const ny = th.y + Math.sin(th.heading) * (th.speed * dt + 3);
      if (!th.dead && nx > 0 && nx < VIEW.width && ny > 0 && ny < VIEW.height && onLand(g, nx, ny)) {
        th.dead = true;
        addFx(g, 'splash', th.x, th.y, { life: 0.5, r: 16 });
      }
      return;
    }
    case 'armored': {
      retarget(th);
      const A = FOE.armored;
      if (f.mx !== undefined && f.my !== undefined) {
        // A Shield Wall row forming up: to its place at the muster point,
        // then holding there, plates toward its ship, until the block goes.
        const sx = f.mx + (f.ox ?? 0);
        const sy = f.my + (f.oy ?? 0);
        const d0 = dist(th.x, th.y, sx, sy);
        const face = aim(th);
        const want = d0 > 6 ? Math.atan2(sy - th.y, sx - th.x) : Math.atan2(face.y - th.y, face.x - th.x);
        th.heading += clamp(angleDiff(want, th.heading), -4 * dt, 4 * dt);
        const v = Math.min(th.speed * EV['shield-wall'].form, d0 * 3);
        th.x += (d0 > 1e-3 ? (sx - th.x) / d0 : 0) * v * dt;
        th.y += (d0 > 1e-3 ? (sy - th.y) / d0 : 0) * v * dt;
        return;
      }
      const tp0 = aim(th);
      const d = dist(th.x, th.y, tp0.x, tp0.y);
      const total = dist(f.sx ?? th.x, f.sy ?? th.y, tp0.x, tp0.y);
      // In a Shield Wall's block it keeps its place in the block until close.
      const keep = f.ox !== undefined ? clamp((d - 80) / 260, 0, 1) : 0;
      const tp = { x: tp0.x + (f.ox ?? 0) * keep, y: tp0.y + (f.oy ?? 0) * keep };
      // Part way in, it banks through a wide S: its side and tail face the
      // carrier for a moment. (In a block, it banks at the block's signal.)
      if (f.state === 0 && !f.nobank && d <= total * (1 - A.turnAt)) {
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
        // aircraft): in from off the screen (round 4), straight at its
        // circle, level at first, then diving as it comes; its window to be
        // shot. It lets go just short of the circle.
        const at = diveAt(f, th.heading, f.t);
        th.x = at.x;
        th.y = at.y;
        if (at.u >= 1) {
          // Released: the bomb falls on, onto the circle, and nothing stops
          // it now.
          g.foe.shots.push({ id: g.nextId++, kind: 'bomb', x: th.x, y: th.y, sx: th.x, sy: th.y, tx: f.px, ty: f.py, t: 0, dur: D.fall, from: 'diveBomber' });
          cue(g, 'bomber.drop', th.x, th.y);
          f.state = 1;
          f.t = 0;
          f.vx = (f.dive?.len ?? D.run) / D.window;
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
      const R = f.r ?? B.orbit;
      // Outer rings turn slower, every other one the other way round.
      const spin = (f.ring ?? 0) % 2 ? -B.spin * 0.7 : B.spin * (B.orbit / R);
      const a = g.t * spin + (f.n / (f.of ?? B.guards)) * Math.PI * 2;
      th.heading = a + (spin < 0 ? -1 : 1) * (Math.PI / 2);
      th.x = heavy.x + Math.cos(a) * R;
      th.y = heavy.y + Math.sin(a) * R;
      return;
    }
    case 'lure': {
      // Rising out of the water first; it lures only once it's up.
      if (f.state === 0 && f.t >= FOE.lure.rise) {
        f.state = 1;
        f.t = 0;
        cue(g, 'foe.paint', th.x, th.y, { gain: 0.6 });
      }
      if ((f.state === 1 && f.t >= (f.life ?? FOE.lure.life)) || alone(g, th)) leave(g, th);
      return;
    }
    case 'cloud': {
      // Slow and heavy, and it leads its ship (Test Lab round 2: "aim and
      // lead the ship instead of coming through on the back"): it flies at
      // where the ship will be when it gets there, aiming a little off the
      // ship's bow while it is far, so it comes in on the bow or the flank,
      // not up the wake. At the ship it bursts, doing no harm itself (Test
      // Lab round 4): its fireball does it all.
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
  if (g.queue.length || g.raiderQueue.length || g.raiders.length || g.foe.marks.length || (g.event && !g.event.done)) return false;
  return !g.threats.some((t) => t !== th && !t.dead && !SUPPORT.has(t.kind) && !['rig', 'generator', 'citadel'].includes(t.kind));
}

const SUPPORT = new Set<ThreatKind>(['tender', 'lure', 'guard', 'scavenger']);

/** Gone from the water, not a kill. */
function leave(g: Game, th: Threat): void {
  th.dead = true;
  addFx(g, 'spray', th.x, th.y, { life: 0.6, r: 20 });
}

/** The Repair Ship (once the Repair Tender): it sails to its station (n 0, then 1 on station),
 *  and every few seconds a beam charges on the most damaged enemy near it,
 *  then mends it. */
function updateTender(g: Game, th: Threat, f: FoeData, dt: number): void {
  const T = FOE.tender;
  if (alone(g, th)) {
    leave(g, th);
    return;
  }
  sailTender(g, th, f, dt);
  if (f.state === 0 && f.t >= (f.every ?? T.gap)) {
    const full = (t: Threat) => t.maxHp ?? THREATS[t.kind].hp;
    const hurt = g.threats
      .filter((t) => !t.dead && t !== th && t.kind !== 'tender' && dist(t.x, t.y, th.x, th.y) <= T.reach && t.hp < full(t))
      .sort((a, b) => a.hp / full(a) - b.hp / full(b))[0];
    if (!hurt) return;
    f.state = 1;
    f.t = 0;
    f.link = hurt.id;
  } else if (f.state === 1 && f.t >= T.charge) {
    const t = g.threats.find((o) => o.id === f.link && !o.dead);
    if (t && dist(t.x, t.y, th.x, th.y) <= T.reach * 1.3) {
      const mend = f.mend ?? T.mend;
      t.hp = Math.min(t.maxHp ?? THREATS[t.kind].hp, t.hp + mend);
      addFx(g, 'text', t.x, t.y - 34, { life: 0.8, r: 0, text: `+${mend}` });
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
  // Off the screen the shore can't be under it; on it, a step onto land
  // isn't taken. Blocked by a shore, it skirts it: the step turned a little
  // at a time to one side (the same side until it is clear) until it finds
  // water, so it works its way round a headland instead of stopping dead
  // (Test Lab round 6: "a ship stuck that didn't travel at all").
  const wet = (x: number, y: number) => x < 0 || x > VIEW.width || !onLand(g, x, y);
  let mx = vx;
  let my = vy;
  if (!wet(th.x + vx * dt, th.y + vy * dt) && sp > 1e-3) {
    const side = f.skirt ?? (angleDiff(Math.atan2(vy, vx), th.heading) >= 0 ? 1 : -1);
    let found = false;
    for (let k = 1; k <= 6 && !found; k++) {
      for (const sgn of [side, -side]) {
        const a = Math.atan2(vy, vx) + sgn * k * 0.4;
        const tx = Math.cos(a) * Math.max(sp, th.speed * 0.6);
        const ty = Math.sin(a) * Math.max(sp, th.speed * 0.6);
        if (!wet(th.x + tx * dt, th.y + ty * dt)) continue;
        mx = tx;
        my = ty;
        f.skirt = sgn;
        found = true;
        break;
      }
    }
    if (!found) mx = my = 0;
  } else f.skirt = undefined;
  th.x += mx * dt;
  th.y += my * dt;
  const msp = Math.hypot(mx, my);
  if (msp > 8) th.heading += clamp(angleDiff(Math.atan2(my, mx), th.heading), -2 * dt, 2 * dt);
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
  g.foe.marks.push({ id: g.nextId++, kind: 'fire', x: th.x, y: th.y, t: 0, dur: g.event?.linger ?? C.linger, dose: {} });
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
  // A heavy's ring, or (Fire Mission) a Spotter's escort.
  if (th.kind !== 'heavy' && th.kind !== 'spotter') return null;
  const guards = g.threats.filter((t) => t.kind === 'guard' && !t.dead && t.foe?.link === th.id);
  if (!guards.length) return null;
  return guards.sort((a, b) => dist(a.x, a.y, from.x, from.y) - dist(b.x, b.y, from.x, from.y))[0];
}

/** A flashing Lure Beacon a helper at (x, y) goes for: one that is up, and
 *  within the helper's reach or the beacon's own ring of it, or whose ring
 *  holds what the helper was about to aim at. */
export function lureIn(g: Game, x: number, y: number, reach = Infinity, aim?: Point): Threat | undefined {
  const R = FOE.lure.radius;
  // Siren Field: every helper chases the nearest beacon, however far.
  if (g.event?.rules.includes('lureAll')) {
    const up = g.threats.filter((t) => t.kind === 'lure' && !t.dead && (t.foe?.state ?? 1) >= 1);
    return up.sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y))[0];
  }
  // A beacon with its own ring (an event's own) reaches that far, not the usual.
  const ring = (t: Threat) => t.foe?.r ?? R;
  return g.threats.find(
    (t) => t.kind === 'lure' && !t.dead && (t.foe?.state ?? 1) >= 1 && (dist(t.x, t.y, x, y) <= Math.max(reach, ring(t)) || (!!aim && dist(t.x, t.y, aim.x, aim.y) <= ring(t))),
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

/** The Spotter (round 8: every one flies turns, as the Fire Mission's do).
 *  State 0: flying in to its circle; 1: on it, painting a ship from `paint`
 *  s and calling the guns on it at `paint` + `call` s; 2: flying off the
 *  screen the nearer way. Off the screen it is gone from the board (no
 *  target, not a kill) and comes back `away` s later with the hits it took,
 *  to a new circle (updateFoeMarks, a 'recall' mark), for up to `turns`
 *  turns, while the rest of the wave is on. `n`: turns it has called;
 *  `prev`: the ship it painted last. */
function updateSpotter(g: Game, th: Threat, f: FoeData, dt: number): void {
  const P = FOE.spotter;
  if (f.mission) {
    updateMissionSpotter(g, th, f, dt);
    return;
  }
  if (f.state === 2) {
    th.heading += clamp(angleDiff(th.x < VIEW.width / 2 ? Math.PI : 0, th.heading), -1.5 * dt, 1.5 * dt);
    th.x += Math.cos(th.heading) * th.speed * 1.4 * dt;
    th.y += Math.sin(th.heading) * th.speed * 1.4 * dt;
    if (th.x < -120 || th.x > VIEW.width + 120 || th.y < -120 || th.y > VIEW.height + 120) {
      // Off the screen: gone for now (not a kill). It comes back for its
      // next turn if it has one and there is still a fight.
      th.dead = true;
      if (f.n < P.turns && !waveOver(g, th)) g.foe.marks.push({ id: g.nextId++, kind: 'recall', x: th.x, y: th.y, t: 0, dur: P.away, gun: th });
    }
    return;
  }
  // Fly the circle (counter-clockwise), steering for a point ahead on it.
  const a = Math.atan2(th.y - f.py, th.x - f.px) + 0.5;
  steer(th, f.px + Math.cos(a) * P.orbit, f.py + Math.sin(a) * P.orbit, th.speed, 2.2, dt);
  if (f.state === 0) {
    if (dist(th.x, th.y, f.px, f.py) <= P.orbit + 30) {
      f.state = 1;
      f.t = 0;
      f.link = -1;
    }
    return;
  }
  // Paint: the ship nearest its circle that it didn't paint last turn (a
  // new one if that one is gone).
  if (f.t >= P.paint) {
    if (!g.ships.some((s) => s.id === f.link)) {
      const pool = targetable(g);
      const fresh = pool.filter((o) => o.id !== f.prev);
      const s = (fresh.length ? fresh : pool).sort((a2, b) => dist(a2.x, a2.y, f.px, f.py) - dist(b.x, b.y, f.px, f.py))[0];
      f.link = s ? s.id : -1;
    }
    if (f.link >= 0 && g.foe.paint?.ship !== f.link) cue(g, 'foe.paint', th.x, th.y);
    if (f.link >= 0) g.foe.paint = { ship: f.link, by: th.id };
    if (f.t >= P.paint + P.call) {
      // The call: shells from off the map on the painted ship; then off.
      if (f.link >= 0) {
        callShells(g, th, f.link);
        f.prev = f.link;
      }
      f.n += 1;
      f.state = 2;
      f.t = 0;
      if (g.foe.paint?.by === th.id) g.foe.paint = null;
    }
  }
}

/** Is the rest of the wave over (nothing but this and support foes left,
 *  nothing to come)? A Spotter doesn't come back then. */
function waveOver(g: Game, th: Threat): boolean {
  if (g.queue.length || g.raiderQueue.length || g.raiders.length || (g.event && !g.event.done)) return false;
  if (g.foe.marks.some((m) => m.kind !== 'recall' && !(m.kind === 'shell' && m.link === th.id))) return false;
  return !g.threats.some((t) => t !== th && !t.dead && !SUPPORT.has(t.kind) && t.kind !== 'spotter' && !['rig', 'generator', 'citadel'].includes(t.kind));
}

/** A Spotter back for its next turn (round 8): the same plane, with the
 *  hits it took, in from off the nearer side to a new circle. */
function recallSpotter(g: Game, m: FoeMark): void {
  const th = m.gun!;
  const f = th.foe!;
  const c = spotterSpot(g, g.rng.foes);
  const side = c.x < VIEW.width / 2 ? 1 : -1;
  th.x = side > 0 ? -60 : VIEW.width + 60;
  th.y = clamp(c.y, 90, VIEW.height - 90);
  th.heading = side > 0 ? 0 : Math.PI;
  th.dead = false;
  f.state = 0;
  f.t = 0;
  f.px = c.x;
  f.py = c.y;
  f.link = -1;
  g.threats.push(th);
  cue(g, 'bomber.pass', th.x, th.y, { gain: 0.5 });
}

/** The Spotter's call (round 8): `shells` artillery shells from a battery
 *  off the map (beyond the enemy's shore, off the screen), landing round
 *  where the painted ship will be, one after another. Each shows its circle
 *  from the call and comes into sight from the map's edge `flight` s
 *  before it lands; until it is fired, shooting the spotter calls it off. */
export function callShells(g: Game, th: Threat, ship: number): void {
  const P = FOE.spotter;
  const s = g.ships.find((o) => o.id === ship);
  if (!s) return;
  const gun = offMapGun(g, s, g.rng.foes);
  for (let k = 0; k < P.shells; k++) {
    const t = P.mark + k * P.gap;
    const p = shipAhead(g, s, t);
    const q = shipAhead(g, s, t + 0.5);
    const d = dist(p.x, p.y, q.x, q.y);
    const ux = d > 0.5 ? (q.x - p.x) / d : Math.cos(s.heading);
    const uy = d > 0.5 ? (q.y - p.y) / d : Math.sin(s.heading);
    const off = (k - (P.shells - 1) / 2) * P.spread;
    g.foe.marks.push({ id: g.nextId++, kind: 'shell', x: p.x + ux * off, y: p.y + uy * off, t: 0, dur: t, gx: gun.x, gy: gun.y, dmg: P.dmg, link: th.id, flight: P.flight, far: true });
  }
  cue(g, 'notice', th.x, th.y);
}

/** Where an off-map battery fires from (round 8: "an artillery shell
 *  coming in from off the map"): off the screen's edge on the enemy's side
 *  (away from the carrier), up to 260 px either way of the ship it is at. */
export function offMapGun(g: Game, s: Point, rng: RNG): Point {
  const top = g.map.carrier.y > VIEW.height / 2;
  return { x: clamp(s.x + rng.range(-260, 260), -60, VIEW.width + 60), y: top ? -180 : VIEW.height + 180 };
}

/** A Fire Mission spotter's turn (Test Lab round 6's new Fire Mission): in
 *  from off its side of the screen (state 0); from the moment it is on the
 *  screen it paints a ship (state 1, one other than the ship painted last)
 *  while it flies on to its spot and circles there, and `call` s after it
 *  came on it calls the walking barrage; then out the way it came (state
 *  2), gone off the screen (not a kill: it comes back for its next turn). */
function updateMissionSpotter(g: Game, th: Threat, f: FoeData, dt: number): void {
  const P = FOE.spotter;
  const E = EV['fire-mission'];
  if (f.state === 2) {
    steer(th, f.ex ?? -200, f.ey ?? th.y, th.speed * E.fly * 1.2, 2.4, dt);
    if (th.x < -100 || th.x > VIEW.width + 100 || th.y < -100 || th.y > VIEW.height + 100) {
      th.dead = true;
      if (g.foe.paint?.by === th.id) g.foe.paint = null;
    }
    return;
  }
  // To its spot, then a tight circle there.
  const r = P.orbit * 0.55;
  if (f.n === 0 && dist(th.x, th.y, f.px, f.py) > r + 10) steer(th, f.px, f.py, th.speed * E.fly, 3, dt);
  else {
    f.n = 1;
    const a = Math.atan2(th.y - f.py, th.x - f.px) + 0.6;
    steer(th, f.px + Math.cos(a) * r, f.py + Math.sin(a) * r, th.speed, 3, dt);
  }
  if (f.state === 0) {
    if (th.x < 0 || th.x > VIEW.width || th.y < 0 || th.y > VIEW.height) return;
    f.state = 1;
    f.t = 0;
  }
  if (!g.ships.some((s) => s.id === f.link)) {
    const pool = targetable(g);
    const fresh = pool.filter((o) => o.id !== f.prev);
    const s = (fresh.length ? fresh : pool).sort((a2, b) => dist(a2.x, a2.y, f.px, f.py) - dist(b.x, b.y, f.px, f.py))[0];
    f.link = s ? s.id : -1;
    if (s) cue(g, 'foe.paint', th.x, th.y);
  }
  if (f.link >= 0) g.foe.paint = { ship: f.link, by: th.id };
  if (f.t >= E.call) {
    if (f.link >= 0) walkingBarrage(g, th, f.link);
    f.state = 2;
    f.t = 0;
  }
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
  } else if (f.state === 1 && f.t >= H.settle && (f.hold === undefined || g.waveT >= f.hold)) {
    // A Gunship Wall's helicopters open fire together, each in its turn.
    f.state = 2;
    // Its turn comes `wait` s after the wall opens fire (at once if late).
    f.t = H.gap - (f.hold === undefined ? 0 : Math.max(0, f.hold + (f.wait ?? 0) - g.waveT));
    f.link = 0;
  } else if (f.state === 2) {
    if (f.t >= H.gap) {
      f.t = 0;
      f.n += 1;
      f.link += 1;
      for (let k = 0; k < H.pair; k++) heliRocket(g, th, k);
    }
    const volleys = f.volleys ?? H.volleys;
    if (f.t >= H.gap * 0.6 && f.n > 0 && (f.stay ? f.n >= volleys : f.link >= H.perSpot)) {
      if (f.n >= volleys) f.state = 3;
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

/** Where a torpedo fired from `sub` at ship `s` meets it (where the ship
 *  will be when it gets there). */
function torpedoMeet(g: Game, sub: Point, s: Ship, speed: number): Point {
  let p: Point = s;
  let t = dist(sub.x, sub.y, s.x, s.y) / speed;
  for (let k = 0; k < 6; k++) {
    p = shipAhead(g, s, t);
    t = dist(sub.x, sub.y, p.x, p.y) / speed;
  }
  return p;
}

/** A torpedo's speed: its own, a little more with the wave, and a fast
 *  one's. */
function torpedoSpeed(g: Game, fast: boolean): number {
  return THREATS.torpedo.speed * (1 + (g.waveSpeed - 1) * 0.3) * (fast ? FOE.torpedoSub.fastSpeed : 1);
}

/** How far a torpedo can run from `from` on `heading` before a shore (at
 *  most `max`; checked every 2 px on the screen, where the land is: a lock
 *  gate on Saltgate is a thin sliver of land). Round 8: "the subs shoot
 *  torpedoes from water to land". */
export function wetReach(g: Game, from: Point, heading: number, max: number): number {
  const ux = Math.cos(heading);
  const uy = Math.sin(heading);
  // (A little past `max` too: a torpedo runs a step beyond its end before
  // it is gone, and a shore just past it would have its nose in.)
  for (let u = 2; u <= max + 16; u += 2) {
    const x = from.x + ux * u;
    const y = from.y + uy * u;
    if (x > 0 && x < VIEW.width && y > 0 && y < VIEW.height && onLand(g, x, y)) return Math.min(max, Math.max(0, u - 14));
  }
  return max;
}

/** Is the run from `from` to `to` open water all the way, for a torpedo
 *  (finer than a boat's wetRun)? */
export function torpedoWet(g: Game, from: Point, to: Point): boolean {
  const d = dist(from.x, from.y, to.x, to.y);
  return wetReach(g, from, Math.atan2(to.y - from.y, to.x - from.x), d) >= d;
}

/** Launch a torpedo from `sub` toward `p` (its X), `target` the ship it
 *  is at (or the carrier's mark for none), running `run` px past it at
 *  most and never onto land. */
function launchTorpedo(g: Game, sub: Threat, p: Point, target: number, speed: number, fast: boolean, over: number): number {
  const heading = Math.atan2(p.y - sub.y, p.x - sub.x);
  const along = wetReach(g, sub, heading, dist(sub.x, sub.y, p.x, p.y) + over);
  const m = spawnThreat(g, 'torpedo', sub.x, sub.y, 'sub');
  m.speed = speed;
  m.heading = heading;
  m.target = target;
  m.foe = data({ sx: sub.x, sy: sub.y, along, px: p.x, py: p.y, ...(fast ? { fast: 1 } : {}) });
  cue(g, 'foe.torpedo', sub.x, sub.y);
  if (g.event) g.event.sent.torpedo = (g.event.sent.torpedo ?? 0) + 1;
  return heading;
}

/** The ships a torpedo from `sub` can be aimed at: those it meets down a
 *  line of open water (round 8), with where it meets each. */
function torpedoTargets(g: Game, sub: Point, speed: number): { s: Ship; p: Point }[] {
  return targetable(g)
    .map((s) => ({ s, p: torpedoMeet(g, sub, s, speed) }))
    .filter(({ p }) => torpedoWet(g, sub, p));
}

/** The lone torpedo (a sub with no spread): at a ship it can reach over
 *  water, or (`aim`) at this ship or down this heading. Returns its
 *  heading, or null when it had nowhere to go over water (not fired). */
function fireTorpedo(g: Game, sub: Threat, aim?: { ship?: Ship | null; heading?: number }, fast = false): number | null {
  const S = FOE.torpedoSub;
  const speed = torpedoSpeed(g, fast);
  if (aim?.heading !== undefined && !aim.ship) {
    // Down a heading: as far as a torpedo at a ship would run, short of
    // any shore.
    const p = { x: sub.x + Math.cos(aim.heading) * 520, y: sub.y + Math.sin(aim.heading) * 520 };
    return launchTorpedo(g, sub, p, CARRIER_TARGET, speed, fast, S.run);
  }
  if (aim?.ship) {
    const p = torpedoMeet(g, sub, aim.ship, speed);
    return torpedoWet(g, sub, p) ? launchTorpedo(g, sub, p, aim.ship.id, speed, fast, S.run) : null;
  }
  const pool = torpedoTargets(g, sub, speed);
  if (!pool.length) return null;
  const { s, p } = g.rng.foes.pick(pool);
  return launchTorpedo(g, sub, p, s.id, speed, fast, S.run);
}

/** A sub's next torpedo, one by one (round 8): at the ship it has fired at
 *  least at so far, of those it can reach over water (the nearest of those
 *  breaking a tie), so a spread goes round the convoy before it comes back
 *  to a ship. None reachable: that torpedo isn't fired. */
function fireAimed(g: Game, sub: Threat, f: FoeData, fast: boolean): void {
  const pool = torpedoTargets(g, sub, torpedoSpeed(g, fast));
  if (!pool.length) return;
  const used = (f.aimedAt ??= []);
  const times = (id: number) => used.filter((o) => o === id).length;
  const pick = pool.reduce((m, o) => (times(o.s.id) < times(m.s.id) || (times(o.s.id) === times(m.s.id) && dist(o.s.x, o.s.y, sub.x, sub.y) < dist(m.s.x, m.s.y, sub.x, sub.y)) ? o : m));
  used.push(pick.s.id);
  launchTorpedo(g, sub, pick.p, pick.s.id, torpedoSpeed(g, fast), fast, FOE.torpedoSub.run);
}

/** A sub's spread, all at once (the Wolf Pack's, Test Lab round 6: "shoot
 *  multiple torpedoes each in different directions"): `n` torpedoes; the
 *  first `aimed` each at a different ship where one lies on a heading clear
 *  of the others (`fan` rad) down open water, the rest (and any with no
 *  such ship) fanned out round the first, over water; the `fast`th of them
 *  is a fast one. A heading with no open water left to fan onto isn't
 *  fired (round 8: never up a beach). */
function fireSpread(g: Game, sub: Threat, n: number, fast: number, aimed: number, fan: number): void {
  const pool = g.rng.foes.shuffle([...targetable(g)]);
  const gap = (a: number, b: number) => Math.abs(angleDiff(a, b));
  const used: number[] = [];
  for (let k = 0; k < n; k++) {
    // (A hair under `fan`: a heading fanned exactly `fan` off another can
    // come out a rounding error short of it.)
    const clear = (h: number) => used.every((u) => gap(u, h) >= fan - 1e-6);
    const speed = torpedoSpeed(g, k === fast);
    const ship = k < aimed ? pool.find((o) => clear(Math.atan2(o.y - sub.y, o.x - sub.x)) && torpedoWet(g, sub, torpedoMeet(g, sub, o, speed))) : undefined;
    if (ship) {
      pool.splice(pool.indexOf(ship), 1);
      const h = fireTorpedo(g, sub, { ship }, k === fast);
      if (h !== null) used.push(h);
      continue;
    }
    // No ship on a clear heading: fanned out round the first, on the
    // nearest heading clear of the others that runs over water to its mark
    // (round 7: a fan of five off a sub by the shore sent some up the beach).
    const h0 = used[0] ?? Math.atan2(g.map.carrier.y - sub.y, g.map.carrier.x - sub.x);
    const wet = (h: number) => torpedoWet(g, sub, { x: sub.x + Math.cos(h) * 480, y: sub.y + Math.sin(h) * 480 });
    const turn = (j: number) => h0 + (j % 2 ? 1 : -1) * Math.ceil(j / 2) * fan;
    let h = h0;
    for (let j = 1; j <= 8 && !(clear(h) && wet(h)); j++) h = turn(j);
    // Nowhere wet and clear: this one isn't fired.
    if (!(clear(h) && wet(h))) continue;
    const fired = fireTorpedo(g, sub, { heading: h }, k === fast);
    if (fired !== null) used.push(fired);
  }
}

/** The Scavenger (round 8's rework): it takes nothing; it denies. Any
 *  pickup inside its ring is locked (pickupLocked). It goes to the pickup
 *  no other scavenger's ring covers (a weapon first, then the nearest) and
 *  hovers over it while it has a pickup in its ring; with nothing on the
 *  water it lurks over the water off the convoy. It leaves (its ring off)
 *  once the rest of the wave is done, or after `stay` s: then whatever it
 *  locked is free. `state` 1: leaving. */
function updateScavenger(g: Game, th: Threat, f: FoeData, dt: number): void {
  const S = FOE.scavenger;
  if (f.state === 0 && (f.t >= S.stay || alone(g, th))) {
    f.state = 1;
    f.link = -1;
  }
  if (f.state === 1) {
    // Off the top, or (a Supply Raid's, round 6) the way it came.
    steer(th, f.ex ?? th.x, f.ey ?? -120, S.leave, 4, dt);
    if (th.y < -60 || th.y > VIEW.height + 60 || th.x < -60 || th.x > VIEW.width + 60) th.dead = true;
    return;
  }
  // Keep to the pickup it is over while it is there; else the next one no
  // other scavenger covers.
  let p = g.pickups.find((o) => o.id === f.link);
  if (!p) {
    const others = g.threats.filter((t) => t.kind === 'scavenger' && t !== th && !t.dead && t.foe?.state === 0);
    const free = g.pickups.filter((o) => !o.chute && !others.some((t) => dist(t.x, t.y, o.x, o.y) <= S.deny || t.foe?.link === o.id));
    p = free.sort((a, b) => Number(b.kind === 'weapon') - Number(a.kind === 'weapon') || dist(a.x, a.y, th.x, th.y) - dist(b.x, b.y, th.x, th.y))[0];
    f.link = p ? p.id : -1;
  }
  if (!p) {
    // Nothing to deny: it lurks, circling slowly over the water off the
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
  // Over it: a tight circle round it, so its ring sits on the pickup.
  const d = dist(th.x, th.y, p.x, p.y);
  if (d > S.hover * 2) steer(th, p.x, p.y, th.speed, 5, dt);
  else {
    const a = Math.atan2(th.y - p.y, th.x - p.x) + 0.7;
    steer(th, p.x + Math.cos(a) * S.hover, p.y + Math.sin(a) * S.hover, S.hoverSpin * S.hover * 1.6, 6, dt);
  }
  if (d <= S.deny && f.n === 0) {
    // The lock closes: once per pickup it reaches.
    cue(g, 'foe.grab', p.x, p.y, { gain: 0.6 });
    f.n = 1;
  }
  if (d > S.deny) f.n = 0;
}

/** Is this pickup locked by a Scavenger's ring (round 8)? A scavenger on
 *  the screen and not leaving locks every pickup within `deny` px of it. */
export function pickupLocked(g: Game, p: { x: number; y: number }): boolean {
  return g.threats.some((t) => t.kind === 'scavenger' && !t.dead && (t.foe?.state ?? 0) === 0 && t.x > -20 && t.x < VIEW.width + 20 && t.y > -20 && t.y < VIEW.height + 20 && dist(t.x, t.y, p.x, p.y) <= FOE.scavenger.deny);
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

/** A dive bomber's line in at a circle: down the screen, `tilt` rad off
 *  straight down, the other way if that would start its dive off the side
 *  of the screen. */
function diveLine(p: Point, tilt: number): number {
  for (const a of [Math.PI / 2 + tilt, Math.PI / 2 - tilt]) {
    const path = divePath(p, a);
    const x = path.rx - Math.cos(a) * path.len;
    if (x >= 40 && x <= VIEW.width - 40) return a;
  }
  return Math.PI / 2;
}

/** A dive bomber's flight in at circle `p` on heading `a`: where it lets go
 *  (`rx`, `ry`: `short` px before the circle), its dive's length (`run` px
 *  at most, from about `top` px under the screen's top edge, `minRun` at
 *  least), and where it sets off (`sx`, `sy`): back along the line, `off` px
 *  past the screen's edge, so neither the plane nor its shadow is in sight;
 *  `app` the seconds it flies level from there to its dive. */
export function divePath(p: Point, a: number): { sx: number; sy: number; rx: number; ry: number; len: number; app: number } {
  const D = FOE.diveBomber;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const rx = p.x - ux * D.short;
  const ry = p.y - uy * D.short;
  const len = clamp((p.y - D.top) / uy, D.minRun, D.run);
  const toTop = (ry + D.off) / uy;
  const toSide = ux > 1e-6 ? (rx + D.off) / ux : ux < -1e-6 ? (VIEW.width + D.off - rx) / -ux : Infinity;
  const d = Math.max(len, Math.min(toTop, toSide));
  return { sx: rx - ux * d, sy: ry - uy * d, rx, ry, len, app: (d - len) / D.cruise };
}

/** Where a dive bomber is `t` s after it set off (heading `a`): level at
 *  `cruise` px/s from off the screen, then its dive, `window` s, easing from
 *  that speed into its dive's own (never faster than `cruise`); `u` how far
 *  through its dive (1: it lets go). */
export function diveAt(f: FoeData, a: number, t: number): { x: number; y: number; u: number } {
  const D = FOE.diveBomber;
  const { len, app } = f.dive ?? { len: D.run, app: 0 };
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const sx = f.sx ?? f.px;
  const sy = f.sy ?? f.py;
  const d = dist(sx, sy, f.px - ux * D.short, f.py - uy * D.short);
  let s: number;
  let u = 0;
  if (t < app) s = D.cruise * t;
  else {
    u = Math.min(1, (t - app) / D.window);
    // s(u) = u + k·u·(1-u)²: it enters the dive at `cruise` (k), and ends
    // it at the dive's own speed.
    const k = clamp((D.cruise * D.window) / len - 1, 0, 3);
    s = d - len + len * (u + k * u * (1 - u) * (1 - u));
  }
  return { x: sx + ux * s, y: sy + uy * s, u };
}

/** Warnings that come before a foe: the periscope before the sub. */
export function updateFoeMarks(g: Game, dt: number): void {
  if (!g.foe.marks.length) return;
  const live: FoeMark[] = [];
  for (const m of g.foe.marks) {
    m.t += dt;
    if (m.kind === 'fire') fireStep(g, m, dt);
    // A Spotter away between turns doesn't come back once the rest of the
    // wave is over (round 8).
    if (m.kind === 'recall' && (!m.gun || waveOver(g, m.gun))) continue;
    if (m.t < m.dur) {
      live.push(m);
      continue;
    }
    if (m.kind === 'periscope') {
      const th = spawnThreat(g, 'torpedoSub', m.x, m.y, 'sub');
      th.target = CARRIER_TARGET;
      th.heading = 0;
      const S = FOE.torpedoSub;
      // One by one (round 8): up until `after` s past its last torpedo.
      const up = m.fireAt === undefined ? undefined : m.stagger !== undefined ? m.fireAt + ((m.spread ?? 1) - 1) * m.stagger + S.after : m.fireAt + S.up - S.fireAt;
      th.foe = data(m.fireAt !== undefined ? { fireAt: m.fireAt, up, spread: m.spread, fast: m.fast, aimed: m.aimed, fan: m.fan, ...(m.stagger !== undefined ? { stagger: m.stagger, aimedAt: [] } : {}) } : {});
      addFx(g, 'spray', m.x, m.y, { life: 0.7, r: 22 });
    } else if (m.kind === 'dive') {
      // The plane sets off from off the screen (Test Lab round 4: "it
      // should come in off screen like the rest"), on its line in.
      const a = m.a ?? Math.PI / 2;
      const path = divePath(m, a);
      const th = spawnThreat(g, 'diveBomber', path.sx, path.sy, 'air');
      th.target = CARRIER_TARGET;
      th.heading = a;
      th.foe = data({ px: m.x, py: m.y, sx: path.sx, sy: path.sy, dive: { len: path.len, app: path.app } });
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
        th.foe = data({ n: m.salvos ?? FOE.siege.salvos });
      }
    } else if (m.kind === 'recall') recallSpotter(g, m);
    else if (m.kind === 'shell') {
      const S = FOE.siege;
      addFx(g, 'splash', m.x, m.y, { life: 0.9, r: S.radius });
      cue(g, 'impact.splash', m.x, m.y);
      for (const s of [...g.ships]) if (dist(s.x, s.y, m.x, m.y) <= S.radius) damageShip(g, s, m.dmg ?? S.damage, m.dmg !== undefined ? 'spotter' : 'siege');
    }
  }
  g.foe.marks = live;
  // A siege shell leaves the gun a beat before it lands (from then on,
  // killing the gun doesn't stop it).
  for (const m of g.foe.marks) {
    if (m.kind === 'shell' && !m.fired && m.dur - m.t <= (m.flight ?? FOE.siege.flight)) {
      m.fired = true;
      if (m.far) {
        // From off the map: no flash at a gun, the whistle as it comes in
        // (heard at the edge it comes in from).
        cue(g, 'foe.whistle', clamp(m.gx ?? m.x, 0, VIEW.width), clamp(m.gy ?? m.y, 0, VIEW.height), { gain: 0.7 });
        continue;
      }
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
  const end = Math.min(length, f.stop ?? length);
  if (f.state === 0) {
    // A Rocket Convoy truck stands while the wreck ahead blocks the road.
    if ((f.stall ?? 0) > 0) f.stall = Math.max(0, f.stall! - dt);
    else f.along = Math.min(end, (f.along ?? 0) + th.speed * (f.drive ?? 1) * dt);
    if (f.along! >= end) {
      f.state = 1;
      f.t = 0;
      if (!f.wait) cue(g, 'truck.raise', th.x, th.y);
    }
  } else if (f.state === 1) {
    // A convoy truck waits its turn before it raises.
    if ((f.wait ?? 0) > 0) {
      f.wait = Math.max(0, f.wait! - dt);
      f.t = 0;
      if (f.wait === 0) cue(g, 'truck.raise', th.x, th.y);
    } else if (f.t >= R.raise) {
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
    f.along = Math.max(0, (f.along ?? 0) - th.speed * (f.drive ?? 1) * (f.back ?? 1) * dt);
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
export function shellAt(m: FoeMark, back = 0): Point {
  const u = Math.max(0, Math.min(1, 1 - (m.dur - m.t + back) / (m.flight ?? FOE.siege.flight)));
  const gx = m.gx ?? m.x;
  const gy = m.gy ?? m.y;
  // From off the map (round 8) it comes in on a flatter, longer arc.
  const arc = m.far ? SHELL_ARC * 0.5 : SHELL_ARC;
  return { x: gx + (m.x - gx) * u, y: gy + (m.y - gy) * u - 4 * arc * u * (1 - u) };
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
  // So do a Spotter's shells not yet fired (round 8: shot down, its call
  // is off; the Fire Mission's barrage, once called, comes).
  if (th.kind === 'siege' || th.kind === 'spotter') g.foe.marks = g.foe.marks.filter((m) => m.link !== th.id || m.fired);
}

/** The hit that kills a Hydra splits it into darts at the ships nearest it. */
function splitHydra(g: Game, th: Threat): void {
  const near = targetable(g, VIEW.width + 40).sort((a, b) => dist(a.x, a.y, th.x, th.y) - dist(b.x, b.y, th.x, th.y));
  const n = hydraDarts(g, th);
  for (let k = 0; k < n; k++) {
    const t = near.length ? near[k % near.length].id : CARRIER_TARGET;
    const s = near.length ? near[k % near.length] : g.map.carrier;
    const heading = Math.atan2(s.y - th.y, s.x - th.x) + (k - (n - 1) / 2) * FOE.hydra.spread;
    const d = child(g, th, 'dart', t, heading);
    d.hp = THREATS.dart.hp;
    d.speed *= hydraDartPace(g);
    // They fly out of the blast that split it (the gun's own splash would
    // take them with it); a wider blast (Flak, a Wide Warhead) still does.
    d.x += Math.cos(heading) * FOE.hydra.clear;
    d.y += Math.sin(heading) * FOE.hydra.clear;
    g.threats.push(d);
  }
  addFx(g, 'burst', th.x, th.y, { life: 0.4, r: 26 });
  cue(g, 'foe.split', th.x, th.y);
}

/** Has a careful player told this decoy apart by now (its tint, round 7)?
 *  The bots and the broadside leave it alone then. */
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
      if (f.state === 0) return (Math.min(pathLength(f.path!), f.stop ?? Infinity) - (f.along ?? 0)) / (th.speed * (f.drive ?? 1)) + R.raise + (f.stall ?? 0) + (f.wait ?? 0);
      if (f.state === 1) return Math.max(0.2, R.raise - f.t + (f.wait ?? 0));
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
      // One by one (round 8): until its next torpedo, while it has any left.
      if (f && f.stagger !== undefined && f.spread) return f.n < f.spread ? Math.max(0.1, (f.fireAt ?? FOE.torpedoSub.fireAt) + f.n * f.stagger - f.t) : 30;
      return f && f.state === 0 ? Math.max(0.1, (f.fireAt ?? FOE.torpedoSub.fireAt) - f.t) : 30;
    case 'torpedo':
      return f ? dist(th.x, th.y, f.px, f.py) / Math.max(1, th.speed) : null;
    case 'diveBomber':
      return f && f.state === 0 ? Math.max(0.05, (f.dive?.app ?? 0) + FOE.diveBomber.window - f.t) : 30;
    case 'spotter':
      if (!f) return null;
      // Round 8: every turn it calls, so the call to come is what counts;
      // flying off, it is out of reach soon and its call already made.
      if (f.mission) return f.state === 1 && f.n === 0 ? Math.max(0.5, FOE.spotter.paint + FOE.spotter.call - f.t) : 12;
      return f.state === 1 ? Math.max(0.5, FOE.spotter.paint + FOE.spotter.call - f.t) : f.state === 0 ? FOE.spotter.paint + FOE.spotter.call + 2 : 30;
    case 'scavenger': {
      // Round 8: worth a shot as soon as it locks a pickup (a weapon most),
      // and soon when it is on its way to one.
      if (!f || f.state !== 0) return 30;
      const locked = g.pickups.filter((o) => dist(th.x, th.y, o.x, o.y) <= FOE.scavenger.deny);
      if (locked.length) return locked.some((o) => o.kind === 'weapon') ? 1 : 2;
      const p = f.link >= 0 ? g.pickups.find((o) => o.id === f.link) : undefined;
      return p ? 2 + dist(th.x, th.y, p.x, p.y) / th.speed : 12;
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

/** Worth a shot? Not a decoy a careful player has told apart. */
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
