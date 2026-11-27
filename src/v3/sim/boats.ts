// The Coves' attack boats (log v69; data/config.ts BOATS). The speedboat is
// the old fast boat (game.ts steers it onto a ship and rams); the other two
// are driven here:
//   gunboat   locks one cargo ship, runs to a station off its beam, sails
//             with it and shells it every BOATS.gun.every s until it sinks;
//   rocket boat  slow and sturdy, keeps BOATS.rocket.range px off its ship,
//             raises its launcher and fires a salvo of red rockets (the
//             Rocket Truck's, which no interceptor stops), then another.
// Both are `fastboat` threats with `boat` set, so every weapon, helper and
// bot that shoots a fast boat shoots them; nothing here draws a random
// number except the rocket scatter (the foes stream, as a truck's).
//
// Log v72 (the player's Watch run: "boats come outta a cave ... they go
// slightly over land ... they overlap on the cargo ship ... increase the
// range of the enemy ship with guns and rockets"): every boat of a cove
// surfaces at the inner end of its inlet and sails out through the mouth
// before it turns for its ship (enterCove / leaveCove); no boat's hull is
// ever on land (keepWet); a gunboat or a rocket boat is held BOATS.*.keep px
// off every hull (clearShips) and fires from further off (BOATS.gun.stand,
// BOATS.rocket.range). Only the speedboat rams.

import { BOATS, THREATS, VIEW } from '../data/config';
import type { Point } from '../data/maps';
import { onLand, wetRun } from './foes';
import { addFx, angleDiff, clamp, cue, damageShip, dist, shipAhead, targetable, type Game, type Ship, type Threat } from './game';

export type BoatKind = 'gun' | 'rocket';

export interface BoatState {
  /** run: on its way to its station; side: gunboat on station; raise /
   *  fire: rocket boat holding to fire; leave: out of rounds or ships. */
  mode: 'run' | 'side' | 'raise' | 'fire' | 'leave';
  /** The ship it has locked (gunboat) or marked (rocket boat), -1 none. */
  ship: number;
  /** Which beam of the ship the gunboat keeps (+1 / -1; 0 not chosen). */
  side: number;
  /** Seconds in this mode. */
  t: number;
  /** Gunboat: seconds since its last shell. Rocket boat: seconds until it may raise. */
  clock: number;
  /** Rocket boat: salvos fired, the rockets of this one still to go, the
   *  salvo's id, and the station it is making for. */
  n: number;
  left: number;
  salvo: number;
  sx: number;
  sy: number;
  /** Seconds until the station is looked at again. */
  look: number;
  /** For the picture: the last shell's flash (game s). */
  flash: number;
}

/** Make a fast boat a gunboat or a rocket boat: its hull, its pace (the
 *  wave's speed-up kept), its state. */
export function armBoat(th: Threat, kind: BoatKind): void {
  const B = BOATS[kind];
  th.boat = kind;
  th.hp = th.maxHp = B.hp;
  th.speed = (th.speed / THREATS.fastboat.speed) * B.speed;
  th.bs = { mode: 'run', ship: -1, side: 0, t: 0, clock: 0, n: 0, left: 0, salvo: 0, sx: th.x, sy: th.y, look: 0, flash: -9 };
}

/** Log v72: a fast boat launched from a cove surfaces at the inner end of
 *  its inlet, bow to the mouth it will sail out through (th.mouth, cleared
 *  once it is there); the picture rises out of the water meanwhile
 *  (ui/boats.ts, th.cove, th.age). */
export function enterCove(th: Threat, base: { x: number; y: number; inner?: Point; mouth?: Point }): void {
  th.cove = true;
  if (!base.inner || !base.mouth) return;
  th.x = th.sx = base.inner.x;
  th.y = th.sy = base.inner.y;
  th.mouth = { x: base.mouth.x, y: base.mouth.y };
  th.heading = Math.atan2(base.mouth.y - base.inner.y, base.mouth.x - base.inner.x);
}

/** One step of a boat sailing out of its cove: straight down the inlet to
 *  the mouth at BOATS.cove.out of its pace (slower still while it is
 *  surfacing). True while it is still in the inlet. */
export function leaveCove(th: Threat, dt: number): boolean {
  const m = th.mouth;
  if (!m) return false;
  const rise = Math.min(1, th.age / BOATS.cove.emerge);
  const pace = th.speed * BOATS.cove.out * (0.45 + 0.55 * rise);
  const want = Math.atan2(m.y - th.y, m.x - th.x);
  th.heading += clamp(angleDiff(want, th.heading), -6 * dt, 6 * dt);
  const step = Math.min(pace * dt, dist(th.x, th.y, m.x, m.y));
  th.x += Math.cos(th.heading) * step;
  th.y += Math.sin(th.heading) * step;
  if (dist(th.x, th.y, m.x, m.y) < 6) th.mouth = undefined;
  return !!th.mouth;
}

/** Is the water under a hull's middle clear of the shore all round
 *  (BOATS.cove.margin px each way)? */
export function wetAt(g: Game, x: number, y: number): boolean {
  const m = BOATS.cove.margin;
  return !onLand(g, x, y) && !onLand(g, x + m, y) && !onLand(g, x - m, y) && !onLand(g, x, y + m) && !onLand(g, x, y - m);
}

/** After a boat has moved from (px, py): never on land. A step onto the
 *  shore slides along it (one axis), else is undone and the boat turned to
 *  open water, so no boat of any kind is ever drawn or hit on land. */
export function keepWet(g: Game, th: Threat, px: number, py: number): void {
  if (wetAt(g, th.x, th.y)) return;
  if (wetAt(g, th.x, py)) {
    th.y = py;
    return;
  }
  if (wetAt(g, px, th.y)) {
    th.x = px;
    return;
  }
  th.x = px;
  th.y = py;
  // Stuck against a shore: bear away toward the nearest open water ahead.
  let best = th.heading;
  let bd = Infinity;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    if (!wetAt(g, th.x + Math.cos(a) * 28, th.y + Math.sin(a) * 28)) continue;
    const d = Math.abs(angleDiff(a, th.heading));
    if (d < bd) {
      bd = d;
      best = a;
    }
  }
  th.heading = best;
}

/** `p` pushed out of every cargo ship's `keep` radius (a few passes: the
 *  push off one hull may be onto the next). */
function clearPoint(g: Game, p: Point, keep: number): Point {
  let x = p.x;
  let y = p.y;
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const s of g.ships) {
      const d = dist(x, y, s.x, s.y);
      if (d >= keep) continue;
      const a = d > 0.01 ? Math.atan2(y - s.y, x - s.x) : Math.PI / 2;
      x = s.x + Math.cos(a) * keep;
      y = s.y + Math.sin(a) * keep;
      moved = true;
    }
    if (!moved) break;
  }
  return { x, y };
}

/** Hold a gunboat or a rocket boat off every cargo ship's hull: pushed out
 *  to `keep` px if it would be nearer (it never sits on a ship). */
function clearShips(g: Game, th: Threat, keep: number): void {
  const p = clearPoint(g, th, keep);
  th.x = p.x;
  th.y = p.y;
}

function pickShip(g: Game, th: Threat): Ship | undefined {
  let best: Ship | undefined;
  let bd = Infinity;
  for (const s of targetable(g, VIEW.width + 40)) {
    const d = dist(th.x, th.y, s.x, s.y);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/** The ship's velocity along its lane (px/s). */
function shipVel(g: Game, s: Ship): Point {
  const p = shipAhead(g, s, 0.5);
  return { x: (p.x - s.x) / 0.5, y: (p.y - s.y) / 0.5 };
}

/** Turn onto `want` at most `rate` rad/s. */
function turn(th: Threat, want: number, rate: number, dt: number): void {
  th.heading += clamp(angleDiff(want, th.heading), -rate * dt, rate * dt);
}

/** Out of rounds or ships: make for the nearer side edge and go. */
function leave(g: Game, th: Threat, dt: number): void {
  const bs = th.bs!;
  bs.mode = 'leave';
  const east = th.x > VIEW.width / 2;
  const want = Math.atan2(0, east ? 1 : -1);
  turn(th, want, 1.4, dt);
  th.x += Math.cos(th.heading) * th.speed * dt;
  th.y += Math.sin(th.heading) * th.speed * dt;
  if (th.x < -90 || th.x > VIEW.width + 90) th.dead = true;
  void g;
}

/** One step of a gunboat or a rocket boat. */
export function updateBoat(g: Game, th: Threat, dt: number): void {
  const bs = th.bs;
  if (!bs) return;
  const px = th.x;
  const py = th.y;
  // Out of its cove first (nothing else until it is through the mouth).
  if (leaveCove(th, dt)) {
    keepWet(g, th, px, py);
    return;
  }
  bs.t += dt;
  if (th.boat === 'gun') gunBoat(g, th, bs, dt);
  else rocketBoat(g, th, bs, dt);
  settle(g, th, px, py);
}

/** Off the hulls (a gunboat or a rocket boat), and on the water: after
 *  whatever moved the boat, its own sailing or a Gravity Well's drag. */
export function settle(g: Game, th: Threat, px: number, py: number): void {
  if (th.boat && th.bs?.mode !== 'leave') clearShips(g, th, th.boat === 'gun' ? BOATS.gun.keep : BOATS.rocket.keep);
  keepWet(g, th, px, py);
}

function gunBoat(g: Game, th: Threat, bs: BoatState, dt: number): void {
  const B = BOATS.gun;
  let s = g.ships.find((o) => o.id === bs.ship);
  if (!s) {
    // The ship the launch named (its aim: the lead ship, the one halfway
    // along...) is the one it locks, if it is afloat; its ship sunk or
    // gone, the nearest one now.
    s = (bs.ship < 0 ? g.ships.find((o) => o.id === th.target) : undefined) ?? pickShip(g, th);
    if (!s) {
      leave(g, th, dt);
      return;
    }
    bs.ship = s.id;
    bs.side = 0;
    bs.mode = 'run';
    bs.t = 0;
    bs.clock = -B.first;
  }
  th.target = s.id;
  const nx = -Math.sin(s.heading);
  const ny = Math.cos(s.heading);
  if (!bs.side) bs.side = (th.x - s.x) * nx + (th.y - s.y) * ny >= 0 ? 1 : -1;
  let sx = s.x + nx * bs.side * B.stand;
  let sy = s.y + ny * bs.side * B.stand;
  if (!wetAt(g, sx, sy)) {
    bs.side = -bs.side;
    sx = s.x + nx * bs.side * B.stand;
    sy = s.y + ny * bs.side * B.stand;
  }
  // A station is clear of every hull (the convoy may sail two abreast): out
  // past the others on its side, not between them.
  const cl = clearPoint(g, { x: sx, y: sy }, B.keep + 8);
  if (wetAt(g, cl.x, cl.y)) {
    sx = cl.x;
    sy = cl.y;
  }
  const v = shipVel(g, s);
  const d = dist(th.x, th.y, sx, sy);
  if (bs.mode === 'run') {
    // Run for where the station will be, hard over onto it.
    const lead = d / Math.max(1, th.speed);
    const want = Math.atan2(sy + v.y * lead - th.y, sx + v.x * lead - th.x);
    turn(th, want, B.turn, dt);
    const slow = 0.55 + 0.45 * Math.max(0, Math.cos(angleDiff(want, th.heading)));
    th.x += Math.cos(th.heading) * th.speed * slow * dt;
    th.y += Math.sin(th.heading) * th.speed * slow * dt;
    if (d < B.close) {
      bs.mode = 'side';
      bs.t = 0;
    }
    return;
  }
  // On station: the ship's own velocity, and a pull onto the station.
  let vx = v.x + (sx - th.x) * 3;
  let vy = v.y + (sy - th.y) * 3;
  const m = Math.hypot(vx, vy);
  const cap = th.speed * 1.15;
  if (m > cap) {
    vx = (vx / m) * cap;
    vy = (vy / m) * cap;
  }
  th.x += vx * dt;
  th.y += vy * dt;
  // The bow comes round to the ship's own course, as it sails with it.
  turn(th, m > 14 ? Math.atan2(vy, vx) : s.heading, B.turn, dt);
  bs.clock += dt;
  if (d < B.hold && bs.clock >= B.every) {
    bs.clock = 0;
    bs.flash = g.t;
    addFx(g, 'tracer', th.x, th.y, { life: 0.2, x2: s.x, y2: s.y });
    addFx(g, 'launch', th.x + Math.cos(th.heading + 0.5 * bs.side) * 10, th.y + Math.sin(th.heading + 0.5 * bs.side) * 10, { life: 0.18, r: 7 });
    addFx(g, 'boom', s.x, s.y, { life: 0.3, r: 11 });
    cue(g, 'frigate.fire', th.x, th.y, { gain: 0.6 });
    damageShip(g, s, B.damage, 'fastboat', true, g.tel?.impact(th.id, s.x, s.y));
  }
}

/** Where a rocket boat would sit to fire at `s`: BOATS.rocket.range from where
 *  the ship will be, on the bearing it is on now, turned round the ship until
 *  it is open water the boat can reach. */
function rocketStation(g: Game, th: Threat, s: Ship): Point | null {
  const R = BOATS.rocket;
  const p = shipAhead(g, s, 2.5);
  const base = Math.atan2(th.y - p.y, th.x - p.x);
  for (const off of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6]) {
    const a = base + off;
    const q = { x: p.x + Math.cos(a) * R.range, y: p.y + Math.sin(a) * R.range };
    if (q.x < 70 || q.x > VIEW.width - 70 || q.y < 60 || q.y > VIEW.height - 70 || !wetAt(g, q.x, q.y)) continue;
    if (wetRun(g, th, q)) return clearPoint(g, q, R.keep + 8);
  }
  return null;
}

function rocketBoat(g: Game, th: Threat, bs: BoatState, dt: number): void {
  const R = BOATS.rocket;
  let s = g.ships.find((o) => o.id === bs.ship);
  if (!s) {
    s = (bs.ship < 0 ? g.ships.find((o) => o.id === th.target) : undefined) ?? pickShip(g, th);
    if (!s || bs.n >= R.salvos) {
      leave(g, th, dt);
      return;
    }
    bs.ship = s.id;
    bs.mode = 'run';
    bs.t = 0;
    bs.look = 0;
    bs.left = 0;
  }
  th.target = s.id;
  if (bs.n >= R.salvos && bs.left <= 0) {
    leave(g, th, dt);
    return;
  }
  const d = dist(th.x, th.y, s.x, s.y);
  if (bs.mode === 'raise') {
    // Holding, its launcher coming up and a red line to the ship.
    th.x += Math.cos(th.heading) * th.speed * 0.15 * dt;
    th.y += Math.sin(th.heading) * th.speed * 0.15 * dt;
    if (bs.t >= R.raise) {
      bs.mode = 'fire';
      bs.t = 0;
      bs.left = R.perSalvo;
      bs.salvo = g.nextId++;
      bs.clock = 0;
    }
    return;
  }
  if (bs.mode === 'fire') {
    bs.clock -= dt;
    if (bs.left > 0 && bs.clock <= 0) {
      fireBoatRocket(g, th, bs, s, R.perSalvo - bs.left);
      bs.left--;
      bs.clock = R.ripple;
    }
    if (bs.left <= 0) {
      bs.n++;
      bs.mode = 'run';
      bs.t = 0;
      bs.clock = R.gap;
    }
    return;
  }
  // Running to its station, and holding its range from the ship.
  bs.clock -= dt;
  bs.look -= dt;
  if (bs.look <= 0) {
    bs.look = 1;
    const q = rocketStation(g, th, s);
    if (q) {
      bs.sx = q.x;
      bs.sy = q.y;
    }
  }
  const to = dist(th.x, th.y, bs.sx, bs.sy);
  if (to > 14) {
    const want = Math.atan2(bs.sy - th.y, bs.sx - th.x);
    turn(th, want, R.turn, dt);
    const slow = 0.4 + 0.6 * Math.max(0, Math.cos(angleDiff(want, th.heading)));
    const k = Math.min(1, to / 40);
    th.x += Math.cos(th.heading) * th.speed * slow * k * dt;
    th.y += Math.sin(th.heading) * th.speed * slow * k * dt;
  }
  if (bs.clock <= 0 && d <= R.range + R.slack && d >= R.range * 0.5) {
    bs.mode = 'raise';
    bs.t = 0;
  }
}

/** The `k`th rocket of a salvo at ship `s`, aimed where it will be when it
 *  lands: the first dead on, the rest spread round it (as a truck's). */
function fireBoatRocket(g: Game, th: Threat, bs: BoatState, s: Ship, k: number): void {
  const R = BOATS.rocket;
  const dur = Math.max(0.35, dist(th.x, th.y, s.x, s.y) / R.rocketSpeed);
  const p = shipAhead(g, s, dur);
  const a = (k / Math.max(1, R.perSalvo - 1)) * Math.PI * 2 + g.rng.foes.range(-0.5, 0.5);
  const off = k === 0 ? 0 : R.spread * g.rng.foes.range(0.6, 1);
  const mx = th.x + Math.cos(th.heading) * 14;
  const my = th.y + Math.sin(th.heading) * 14;
  g.foe.shots.push({ id: g.nextId++, kind: 'rocket', x: mx, y: my, sx: mx, sy: my, tx: p.x + Math.cos(a) * off, ty: p.y + Math.sin(a) * off, t: 0, dur, from: 'fastboat', salvo: bs.salvo, src: th.id });
  addFx(g, 'launch', mx, my, { life: 0.3, r: 8 });
  cue(g, 'truck.fire', mx, my, { gain: k === 0 ? 1 : 0.55 });
}

/** Seconds until a gunboat or a rocket boat does its harm (the bots and the
 *  warnings read it in place of its own run to its ship): the gunboat's
 *  next shell, once it is on station, or its run to it; the rocket boat's
 *  next salvo (its wait, the run into range, the raise and the flight). */
export function boatEta(g: Game, th: Threat): number {
  const bs = th.bs;
  const s = bs && g.ships.find((o) => o.id === bs.ship);
  if (!bs || !s) return 4;
  const d = dist(th.x, th.y, s.x, s.y);
  if (th.boat === 'gun') {
    const B = BOATS.gun;
    if (bs.mode === 'side') return Math.max(0.2, B.every - bs.clock);
    return Math.max(0, d - B.stand) / th.speed + Math.max(0, B.first) * 0.5;
  }
  const R = BOATS.rocket;
  if (bs.mode === 'raise') return Math.max(0.2, R.raise - bs.t) + 0.5;
  if (bs.mode === 'fire') return 0.4;
  return Math.max(Math.max(0, bs.clock), Math.max(0, d - R.range - R.slack) / th.speed) + R.raise + 0.5;
}

/** The ship a rocket boat has marked while its launcher is up (drawn as a
 *  red line, as a truck's). */
export function boatMark(g: Game, th: Threat): Ship | undefined {
  if (th.boat !== 'rocket' || th.bs?.mode !== 'raise') return undefined;
  return g.ships.find((s) => s.id === th.bs!.ship);
}
