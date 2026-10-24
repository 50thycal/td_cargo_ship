// THE WHOLE V2 SIMULATION. Pure and deterministic: no DOM, no timers, no
// Math.random — every random choice comes from the seeded RNG, so a seed plus
// the same inputs replays the same game (tests and the bot sweep rely on it).
//
// The loop: ships flow left→right on fixed lanes; enemy bases launch the
// wave's drones and missiles at them; the player taps threats to fire
// interceptors from the carrier, and taps pickups to collect them. Clear the
// wave → pick 1 of 3 upgrade cards → next wave. Lose at RULES.shipLossLimit
// ships sunk or when the carrier goes down.

import { makeRng, type RNG } from '../../sim/rng';
import {
  BALLISTIC,
  CARRIER,
  DEFAULT_FLOW,
  DRONE,
  FLOW_STEPS,
  GUIDED,
  INTERCEPTOR,
  PICKUPS,
  RULES,
  SHIP,
  THREATS,
  VIEW,
  type PickupKind,
  type ThreatKind,
} from '../data/config';
import { FORMATIONS, type FormationId } from '../data/formations';
import { MAPS, type MapDef, type MapId, type Point } from '../data/maps';
import { UPGRADES, UPGRADE_ORDER, stats, type DefenseStats, type Levels, type UpgradeId } from '../data/upgrades';
import { waveSpec } from '../data/waves';

export const CARRIER_TARGET = -1;

export interface Ship {
  id: number;
  x: number;
  y: number;
  hp: number;
  slot: number;
  channel: number;
  /** Flow multiplier locked in when the ship set sail. */
  mult: number;
}

export interface Threat {
  id: number;
  kind: ThreatKind;
  /** Where it is drawn and where it can be hit (airborne for ballistics). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  speed: number;
  heading: number;
  /** A ship id, or CARRIER_TARGET. */
  target: number;
  age: number;
  phase: number;
  dead: boolean;
  /** Ballistic only: launch point, fixed ground impact point, flight time, apex. */
  sx: number;
  sy: number;
  ix: number;
  iy: number;
  dur: number;
  apex: number;
}

export interface Interceptor {
  id: number;
  x: number;
  y: number;
  target: number | null;
  tx: number;
  ty: number;
  life: number;
}

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  age: number;
}

export type FxKind = 'boom' | 'splash' | 'tracer' | 'launch' | 'burst' | 'text' | 'sink';

export interface Fx {
  kind: FxKind;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  age: number;
  life: number;
  text?: string;
}

export type GameEvent =
  | { kind: 'wave'; wave: number }
  | { kind: 'debut'; threat: ThreatKind }
  | { kind: 'shipLost'; lost: number }
  | { kind: 'carrierHit'; hp: number }
  | { kind: 'pickup'; pickup: PickupKind }
  | { kind: 'dry' };

export type Phase = 'wave' | 'draft' | 'won' | 'lost';

interface Launch {
  at: number;
  kind: ThreatKind;
  base: number;
}

export interface Game {
  map: MapDef;
  seed: number;
  rng: { ships: RNG; threats: RNG; drops: RNG; draft: RNG };
  phase: Phase;
  t: number;
  wave: number;
  waveT: number;
  waveSpeed: number;
  queue: Launch[];
  ships: Ship[];
  threats: Threat[];
  interceptors: Interceptor[];
  pickups: Pickup[];
  fx: Fx[];
  events: GameEvent[];
  carrierHp: number;
  ammo: number;
  reloadT: number;
  overdriveT: number;
  ciwsT: number;
  flow: number;
  formation: FormationId;
  spawnT: number;
  spawnCount: number;
  channelCursor: number;
  levels: Levels;
  stats: DefenseStats;
  offer: UpgradeId[];
  score: number;
  delivered: number;
  lost: number;
  kills: Record<ThreatKind, number>;
  shots: number;
  seen: Set<ThreatKind>;
  /** True once wave RULES.wavesToClear is beaten (map unlocked). */
  cleared: boolean;
  endless: boolean;
  nextId: number;
}

// ---------------------------------------------------------------------------
// Setup

/** `firstWave` > 1 skips ahead (playtesting a late wave via `?wave=N`). */
export function createGame(mapId: MapId, seed: number, firstWave = 1): Game {
  const root = makeRng(seed);
  const s = stats({});
  const g: Game = {
    map: MAPS[mapId],
    seed,
    rng: {
      ships: root.fork('ships'),
      threats: root.fork('threats'),
      drops: root.fork('drops'),
      draft: root.fork('draft'),
    },
    phase: 'wave',
    t: 0,
    wave: 0,
    waveT: 0,
    waveSpeed: 1,
    queue: [],
    ships: [],
    threats: [],
    interceptors: [],
    pickups: [],
    fx: [],
    events: [],
    carrierHp: CARRIER.hp,
    ammo: s.rack,
    reloadT: 0,
    overdriveT: 0,
    ciwsT: 0,
    flow: DEFAULT_FLOW,
    formation: 'pairs',
    spawnT: 0,
    spawnCount: 0,
    channelCursor: 0,
    levels: {},
    stats: s,
    offer: [],
    score: 0,
    delivered: 0,
    lost: 0,
    kills: { drone: 0, ballistic: 0, guided: 0 },
    shots: 0,
    seen: new Set(),
    cleared: false,
    endless: false,
    nextId: 1,
  };
  g.wave = Math.max(0, Math.floor(firstWave) - 1);
  startWave(g);
  return g;
}

function startWave(g: Game): void {
  g.wave += 1;
  g.waveT = 0;
  g.phase = 'wave';
  g.offer = [];
  const spec = waveSpec(g.wave, g.map.threatScale);
  g.waveSpeed = spec.speed;
  const rng = g.rng.threats;
  const lead = RULES.waveLeadIn;
  const queue: Launch[] = [];
  // Launches of each kind are spread evenly across the wave, with jitter.
  const spread = (n: number, each: (at: number) => void) => {
    for (let k = 0; k < n; k++) each(lead + (spec.duration * (k + rng.next())) / n);
  };

  // Drones fly in swarms: one base, a staggered ripple of launches.
  const swarms: number[] = [];
  for (let left = spec.drones; left > 0; ) {
    const size = Math.min(left, Math.max(2, spec.swarm - rng.int(2)));
    swarms.push(size);
    left -= size;
  }
  let i = 0;
  spread(swarms.length, (at) => {
    const base = pickBase(g, 'drone', rng);
    for (let d = 0; d < swarms[i]; d++) queue.push({ at: at + d * 0.35, kind: 'drone', base });
    i++;
  });
  spread(spec.ballistic, (at) =>
    queue.push({ at, kind: 'ballistic', base: pickBase(g, 'ballistic', rng) }),
  );
  spread(spec.guided, (at) =>
    queue.push({ at, kind: 'guided', base: pickBase(g, 'guided', rng) }),
  );
  queue.sort((a, b) => a.at - b.at);
  g.queue = queue;
  g.events.push({ kind: 'wave', wave: g.wave });
}

function pickBase(g: Game, kind: ThreatKind, rng: RNG): number {
  const able = g.map.bases.map((b, i) => (b.kinds.includes(kind) ? i : -1)).filter((i) => i >= 0);
  return able.length ? rng.pick(able) : rng.int(g.map.bases.length);
}

// ---------------------------------------------------------------------------
// Player commands

export function setFlow(g: Game, flow: number): void {
  const next = Math.max(0, Math.min(FLOW_STEPS.length - 1, Math.round(flow)));
  if (next === g.flow) return;
  g.flow = next;
  // Speeding up takes effect now rather than after the old (longer) gap.
  g.spawnT = Math.min(g.spawnT, spawnGap(g));
}

export function setFormation(g: Game, id: FormationId): void {
  if (id === g.formation) return;
  g.formation = id;
  const n = FORMATIONS[id].offsets.length;
  // Re-slot every hull, front of the convoy first, so the change is visible
  // right away; the ships glide over to their new lanes.
  const order = [...g.ships].sort((a, b) => b.x - a.x);
  order.forEach((s, i) => (s.slot = i % n));
  g.spawnCount = 0;
}

export type TapResult = 'fire' | 'pickup' | 'dry' | 'empty';

/** A tap at (x, y) in world units, reaching `radius` world units. */
export function tap(g: Game, x: number, y: number, radius: number): TapResult {
  if (g.phase !== 'wave') return 'empty';
  let pickup: Pickup | null = null;
  let pd = radius + PICKUPS.radius;
  for (const p of g.pickups) {
    const d = dist(x, y, p.x, p.y);
    if (d < pd) {
      pd = d;
      pickup = p;
    }
  }
  // Prefer a threat that still needs an interceptor, so repeated taps on a
  // swarm spread across it instead of piling onto one drone.
  let threat: Threat | null = null;
  let td = Infinity;
  let fallback: Threat | null = null;
  let fd = Infinity;
  for (const th of g.threats) {
    if (th.dead) continue;
    const d = dist(x, y, th.x, th.y);
    if (d > radius) continue;
    if (d < fd) {
      fd = d;
      fallback = th;
    }
    if (assigned(g, th.id) < th.hp && d < td) {
      td = d;
      threat = th;
    }
  }
  if (!threat) {
    threat = fallback;
    td = fd;
  }
  if (pickup && (!threat || pd <= td)) {
    collect(g, pickup);
    return 'pickup';
  }
  if (!threat) return 'empty';
  return fireAt(g, threat) ? 'fire' : 'dry';
}

export function pickUpgrade(g: Game, id: UpgradeId): void {
  if (g.phase !== 'draft' || !g.offer.includes(id)) return;
  const oldRack = g.stats.rack;
  g.levels[id] = (g.levels[id] ?? 0) + 1;
  g.stats = stats(g.levels);
  g.ammo = Math.min(g.stats.rack, g.ammo + (g.stats.rack - oldRack));
  startWave(g);
}

/** After clearing the map, keep going for score. */
export function continueEndless(g: Game): void {
  if (g.phase !== 'won') return;
  g.endless = true;
  openDraft(g);
}

function openDraft(g: Game): void {
  const open = UPGRADE_ORDER.filter((id) => (g.levels[id] ?? 0) < UPGRADES[id].max);
  g.offer = g.rng.draft.shuffle([...open]).slice(0, 3);
  if (g.offer.length === 0) startWave(g);
  else g.phase = 'draft';
}

// ---------------------------------------------------------------------------
// The step

export function step(g: Game, dt: number): void {
  if (g.phase !== 'wave') return;
  g.t += dt;
  g.waveT += dt;

  spawnShips(g, dt);
  while (g.queue.length && g.queue[0].at <= g.waveT) launch(g, g.queue.shift()!);
  reload(g, dt);
  updateShips(g, dt);
  for (const th of g.threats) if (!th.dead) updateThreat(g, th, dt);
  updateInterceptors(g, dt);
  updateCiws(g, dt);

  g.threats = g.threats.filter((th) => !th.dead);
  for (const p of g.pickups) p.age += dt;
  g.pickups = g.pickups.filter((p) => p.age < PICKUPS.life);
  for (const f of g.fx) f.age += dt;
  g.fx = g.fx.filter((f) => f.age < f.life);

  if (g.lost >= RULES.shipLossLimit || g.carrierHp <= 0) {
    g.phase = 'lost';
    return;
  }
  if (g.queue.length === 0 && g.threats.length === 0) {
    g.score += 200 * g.wave;
    if (!g.endless && g.wave >= RULES.wavesToClear) {
      g.cleared = true;
      g.phase = 'won';
    } else {
      openDraft(g);
    }
  }
}

// ---------------------------------------------------------------------------
// Ships

function spawnGap(g: Game): number {
  return FLOW_STEPS[g.flow].interval * FORMATIONS[g.formation].group;
}

function slotY(g: Game, s: Ship): number {
  const ch = g.map.channels[s.channel];
  const offsets = FORMATIONS[g.formation].offsets;
  return ch.y + offsets[s.slot % offsets.length] * ch.halfWidth;
}

function spawnShips(g: Game, dt: number): void {
  g.spawnT -= dt;
  if (g.spawnT > 0) return;
  const f = FORMATIONS[g.formation];
  const channel = g.channelCursor++ % g.map.channels.length;
  for (let i = 0; i < f.group; i++) {
    const slot = f.group > 1 ? i : g.spawnCount++ % f.offsets.length;
    const ship: Ship = {
      id: g.nextId++,
      x: -40 - g.rng.ships.range(0, 12),
      y: 0,
      hp: SHIP.hp,
      slot,
      channel,
      mult: FLOW_STEPS[g.flow].mult,
    };
    ship.y = slotY(g, ship);
    g.ships.push(ship);
  }
  g.spawnT += spawnGap(g);
}

function updateShips(g: Game, dt: number): void {
  const ease = Math.min(1, SHIP.slotEase * dt);
  for (const s of g.ships) {
    s.x += SHIP.speed * dt;
    s.y += (slotY(g, s) - s.y) * ease;
  }
  const arrived = g.ships.filter((s) => s.x > VIEW.width + 40);
  for (const s of arrived) {
    const pts = Math.round(SHIP.points * s.mult);
    g.score += pts;
    g.delivered += 1;
    addFx(g, 'text', VIEW.width - 70, s.y, { life: 1.2, text: `+${pts}` });
  }
  if (arrived.length) g.ships = g.ships.filter((s) => s.x <= VIEW.width + 40);
}

/** Ships the enemy is allowed to aim at: on screen and not about to deliver. */
function targetable(g: Game, maxX = VIEW.width - 90): Ship[] {
  return g.ships.filter((s) => s.x > 30 && s.x < maxX);
}

function damageShip(g: Game, s: Ship, amount: number): void {
  s.hp -= amount;
  if (s.hp > 0) return;
  g.ships = g.ships.filter((o) => o !== s);
  g.lost += 1;
  addFx(g, 'sink', s.x, s.y, { life: 2.2, r: 34 });
  g.events.push({ kind: 'shipLost', lost: g.lost });
}

function damageCarrier(g: Game, amount: number): void {
  g.carrierHp = Math.max(0, g.carrierHp - amount);
  g.events.push({ kind: 'carrierHit', hp: g.carrierHp });
}

function onCarrier(g: Game, x: number, y: number, pad = 0): boolean {
  const c = g.map.carrier;
  const dx = (x - c.x) / (CARRIER.halfLength + pad);
  const dy = (y - c.y) / (CARRIER.halfBeam + pad);
  return dx * dx + dy * dy <= 1;
}

// ---------------------------------------------------------------------------
// Threats

function launch(g: Game, l: Launch): void {
  const base = g.map.bases[l.base];
  const def = THREATS[l.kind];
  const rng = g.rng.threats;
  if (!g.seen.has(l.kind)) {
    g.seen.add(l.kind);
    g.events.push({ kind: 'debut', threat: l.kind });
  }
  const th: Threat = {
    id: g.nextId++,
    kind: l.kind,
    x: base.x,
    y: base.y,
    vx: 0,
    vy: 0,
    hp: def.hp,
    speed: def.speed * g.waveSpeed * g.stats.threatSlow,
    heading: 0,
    target: CARRIER_TARGET,
    age: 0,
    phase: rng.range(0, Math.PI * 2),
    dead: false,
    sx: base.x,
    sy: base.y,
    ix: 0,
    iy: 0,
    dur: 1,
    apex: 0,
  };
  const goCarrier =
    l.kind === 'guided' && g.wave >= GUIDED.carrierFromWave && rng.chance(GUIDED.carrierShare);
  const pool = targetable(g, l.kind === 'ballistic' ? VIEW.width - 320 : undefined);
  if (!goCarrier && pool.length) th.target = rng.pick(pool).id;

  if (l.kind === 'ballistic') aimBallistic(g, th);
  const tp = targetPos(g, th);
  th.heading = Math.atan2(tp.y - th.y, tp.x - th.x);
  g.threats.push(th);
  addFx(g, 'launch', base.x, base.y, { life: 0.6, r: 20 });
}

/** Ballistics commit at launch to the point their ship will have reached. */
function aimBallistic(g: Game, th: Threat): void {
  const t = targetPos(g, th);
  const moving = th.target !== CARRIER_TARGET;
  let ix = t.x;
  let dur = dist(th.sx, th.sy, t.x, t.y) / th.speed;
  for (let k = 0; k < 2; k++) {
    ix = moving ? t.x + SHIP.speed * dur : t.x;
    dur = dist(th.sx, th.sy, ix, t.y) / th.speed;
  }
  th.ix = Math.min(VIEW.width - 20, ix);
  th.iy = t.y;
  th.dur = Math.max(1.4, dur);
  th.apex = Math.min(BALLISTIC.apexMax, BALLISTIC.apexFrac * dist(th.sx, th.sy, th.ix, th.iy));
}

function targetPos(g: Game, th: Threat): Point {
  if (th.target !== CARRIER_TARGET) {
    const s = g.ships.find((o) => o.id === th.target);
    if (s) return s;
  }
  return g.map.carrier;
}

/** Drones and guided missiles find a new ship when theirs is gone. */
function ensureTarget(g: Game, th: Threat): void {
  if (th.target === CARRIER_TARGET) return;
  if (g.ships.some((s) => s.id === th.target)) return;
  let best: Ship | null = null;
  let bd = Infinity;
  for (const s of targetable(g, VIEW.width + 40)) {
    const d = dist(th.x, th.y, s.x, s.y);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  th.target = best ? best.id : CARRIER_TARGET;
}

function updateThreat(g: Game, th: Threat, dt: number): void {
  th.age += dt;
  const px = th.x;
  const py = th.y;
  if (th.kind === 'ballistic') {
    const p = Math.min(1, th.age / th.dur);
    th.x = th.sx + (th.ix - th.sx) * p;
    th.y = th.sy + (th.iy - th.sy) * p - 4 * th.apex * p * (1 - p);
    if (p >= 1) impactBallistic(g, th);
  } else {
    ensureTarget(g, th);
    const tp = targetPos(g, th);
    const d = dist(th.x, th.y, tp.x, tp.y);
    const want = Math.atan2(tp.y - th.y, tp.x - th.x);
    if (th.kind === 'drone') {
      // Shahed-style: slow and steady with a lazy weave, re-aiming as it goes.
      const weave = DRONE.weaveAmp * Math.sin(th.age * DRONE.weaveFreq + th.phase);
      th.heading = want + (d > 80 ? weave : 0);
    } else {
      const close = Math.max(0, 1 - d / GUIDED.terminalRange);
      const turn = (GUIDED.turnRate + GUIDED.terminalTurn * close) * dt;
      th.heading += clamp(angleDiff(want, th.heading), -turn, turn);
    }
    th.x += Math.cos(th.heading) * th.speed * dt;
    th.y += Math.sin(th.heading) * th.speed * dt;
    const dmg = THREATS[th.kind].damage;
    if (th.target === CARRIER_TARGET) {
      if (onCarrier(g, th.x, th.y)) {
        th.dead = true;
        damageCarrier(g, dmg);
        addFx(g, 'boom', th.x, th.y, { life: 0.7, r: 30 });
      }
    } else {
      const s = g.ships.find((o) => o.id === th.target);
      if (s && dist(th.x, th.y, s.x, s.y) < SHIP.hitRadius) {
        th.dead = true;
        addFx(g, 'boom', th.x, th.y, { life: 0.7, r: 28 });
        damageShip(g, s, dmg);
      }
    }
  }
  th.vx = (th.x - px) / dt;
  th.vy = (th.y - py) / dt;
}

function impactBallistic(g: Game, th: Threat): void {
  th.dead = true;
  const dmg = THREATS.ballistic.damage;
  addFx(g, 'splash', th.ix, th.iy, { life: 0.9, r: BALLISTIC.splash });
  for (const s of [...g.ships]) {
    if (dist(s.x, s.y, th.ix, th.iy) <= BALLISTIC.splash) damageShip(g, s, dmg);
  }
  if (onCarrier(g, th.ix, th.iy, BALLISTIC.splash * 0.5)) damageCarrier(g, dmg);
}

/** Where a threat will be `ahead` seconds from now. */
function predict(th: Threat, ahead: number): Point {
  if (th.kind === 'ballistic') {
    const p = Math.min(1, (th.age + ahead) / th.dur);
    return {
      x: th.sx + (th.ix - th.sx) * p,
      y: th.sy + (th.iy - th.sy) * p - 4 * th.apex * p * (1 - p),
    };
  }
  return { x: th.x + th.vx * ahead, y: th.y + th.vy * ahead };
}

function damageThreat(g: Game, th: Threat, amount: number, drops = true): void {
  if (th.dead) return;
  th.hp -= amount;
  if (th.hp > 0) return;
  th.dead = true;
  g.kills[th.kind] += 1;
  addFx(g, 'boom', th.x, th.y, { life: 0.55, r: th.kind === 'drone' ? 18 : 26 });
  if (drops && g.rng.drops.chance(THREATS[th.kind].dropChance)) dropPickup(g, th.x, th.y);
  if (g.stats.chainRadius > 0) {
    addFx(g, 'burst', th.x, th.y, { life: 0.4, r: g.stats.chainRadius });
    blast(g, th.x, th.y, g.stats.chainRadius, th.id);
  }
}

function blast(g: Game, x: number, y: number, radius: number, exceptId: number): void {
  for (const o of g.threats) {
    if (o.dead || o.id === exceptId) continue;
    if (dist(x, y, o.x, o.y) <= radius) damageThreat(g, o, 1);
  }
}

// ---------------------------------------------------------------------------
// Interceptors

function assigned(g: Game, threatId: number): number {
  let n = 0;
  for (const i of g.interceptors) if (i.target === threatId) n++;
  return n;
}

function launcherFor(g: Game, x: number, y: number): Point {
  const c = g.map.carrier;
  if (!g.stats.battery) return c;
  const b = g.map.battery;
  return dist(b.x, b.y, x, y) < dist(c.x, c.y, x, y) ? b : c;
}

function fireAt(g: Game, th: Threat): boolean {
  if (g.overdriveT <= 0) {
    if (g.ammo < 1) {
      g.events.push({ kind: 'dry' });
      return false;
    }
    g.ammo -= 1;
  }
  g.shots += 1;
  spawnInterceptor(g, th);
  // Free extras (Twin Launch) go to the tapped threat if it can still use
  // them, otherwise to its nearest neighbour that needs one.
  for (let k = 0; k < g.stats.freeExtras; k++) {
    let target = th;
    if (assigned(g, th.id) >= th.hp) {
      let bd = 300;
      for (const o of g.threats) {
        if (o.dead || o === th || assigned(g, o.id) >= o.hp) continue;
        const d = dist(th.x, th.y, o.x, o.y);
        if (d < bd) {
          bd = d;
          target = o;
        }
      }
    }
    spawnInterceptor(g, target);
  }
  return true;
}

function spawnInterceptor(g: Game, th: Threat): void {
  const from = launcherFor(g, th.x, th.y);
  g.interceptors.push({
    id: g.nextId++,
    x: from.x,
    y: from.y - 6,
    target: th.id,
    tx: th.x,
    ty: th.y,
    life: 0,
  });
}

function reload(g: Game, dt: number): void {
  if (g.overdriveT > 0) {
    g.overdriveT -= dt;
    g.ammo = g.stats.rack;
    g.reloadT = 0;
    return;
  }
  if (g.ammo >= g.stats.rack) {
    g.reloadT = 0;
    return;
  }
  g.reloadT += dt;
  while (g.reloadT >= g.stats.reload && g.ammo < g.stats.rack) {
    g.reloadT -= g.stats.reload;
    g.ammo += 1;
  }
}

function updateInterceptors(g: Game, dt: number): void {
  const speed = g.stats.interceptorSpeed;
  const live: Interceptor[] = [];
  for (const it of g.interceptors) {
    it.life += dt;
    let th = it.target === null ? undefined : g.threats.find((o) => o.id === it.target && !o.dead);
    if (!th && it.target !== null) {
      it.target = null;
      if (g.stats.retarget) {
        let bd = 260;
        for (const o of g.threats) {
          if (o.dead) continue;
          const d = dist(it.x, it.y, o.x, o.y);
          if (d < bd) {
            bd = d;
            th = o;
          }
        }
        if (th) it.target = th.id;
      }
    }
    if (th) {
      // Lead the target: aim where it will be when we get there.
      let aim: Point = th;
      for (let k = 0; k < 2; k++) aim = predict(th, dist(it.x, it.y, aim.x, aim.y) / speed);
      it.tx = aim.x;
      it.ty = aim.y;
    }
    const d = dist(it.x, it.y, it.tx, it.ty);
    const stepLen = speed * dt;
    if (d <= stepLen + INTERCEPTOR.contact || it.life > INTERCEPTOR.maxLife) {
      const bx = th ? th.x : it.tx;
      const by = th ? th.y : it.ty;
      addFx(g, 'burst', bx, by, { life: 0.35, r: g.stats.blast });
      if (th) damageThreat(g, th, 1);
      blast(g, bx, by, g.stats.blast, th ? th.id : -1);
      continue;
    }
    it.x += ((it.tx - it.x) / d) * stepLen;
    it.y += ((it.ty - it.y) / d) * stepLen;
    live.push(it);
  }
  g.interceptors = live;
}

function updateCiws(g: Game, dt: number): void {
  if (g.stats.ciwsRange <= 0) return;
  g.ciwsT -= dt;
  if (g.ciwsT > 0) return;
  const c = g.map.carrier;
  let best: Threat | null = null;
  let bd = g.stats.ciwsRange;
  for (const th of g.threats) {
    if (th.dead) continue;
    const d = dist(c.x, c.y, th.x, th.y);
    if (d < bd) {
      bd = d;
      best = th;
    }
  }
  if (!best) {
    g.ciwsT = 0;
    return;
  }
  addFx(g, 'tracer', c.x + 40, c.y - 10, { x2: best.x, y2: best.y, life: 0.15 });
  damageThreat(g, best, 1);
  g.ciwsT = g.stats.ciwsCooldown;
}

// ---------------------------------------------------------------------------
// Pickups

function dropPickup(g: Game, x: number, y: number): void {
  const w = PICKUPS.weights;
  let roll = g.rng.drops.next() * (w.ammo + w.repair + w.overdrive + w.emp);
  let kind: PickupKind = 'ammo';
  for (const k of ['ammo', 'repair', 'overdrive', 'emp'] as PickupKind[]) {
    roll -= w[k];
    if (roll < 0) {
      kind = k;
      break;
    }
  }
  g.pickups.push({
    id: g.nextId++,
    kind,
    x: clamp(x, 40, VIEW.width - 40),
    y: clamp(y, 60, VIEW.height - 60),
    age: 0,
  });
}

const PICKUP_TEXT: Record<PickupKind, string> = {
  ammo: 'RACK FULL',
  repair: 'REPAIRED',
  overdrive: 'OVERDRIVE',
  emp: 'EMP!',
};

function collect(g: Game, p: Pickup): void {
  g.pickups = g.pickups.filter((o) => o !== p);
  g.events.push({ kind: 'pickup', pickup: p.kind });
  addFx(g, 'text', p.x, p.y - 20, { life: 1.1, text: PICKUP_TEXT[p.kind] });
  switch (p.kind) {
    case 'ammo':
      g.ammo = g.stats.rack;
      break;
    case 'repair': {
      const hurt = g.ships.filter((s) => s.hp < SHIP.hp).sort((a, b) => a.hp - b.hp)[0];
      if (hurt) hurt.hp = Math.min(SHIP.hp, hurt.hp + PICKUPS.repairHp);
      else g.carrierHp = Math.min(CARRIER.hp, g.carrierHp + PICKUPS.carrierRepairHp);
      break;
    }
    case 'overdrive':
      g.overdriveT = PICKUPS.overdriveTime;
      break;
    case 'emp':
      for (const th of g.threats) if (th.kind === 'drone') damageThreat(g, th, 99, false);
      addFx(g, 'burst', p.x, p.y, { life: 0.8, r: 900 });
      break;
  }
}

// ---------------------------------------------------------------------------
// Helpers

function addFx(
  g: Game,
  kind: FxKind,
  x: number,
  y: number,
  o: { life: number; r?: number; x2?: number; y2?: number; text?: string },
): void {
  g.fx.push({ kind, x, y, x2: o.x2 ?? x, y2: o.y2 ?? y, r: o.r ?? 0, age: 0, life: o.life, text: o.text });
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Is the ballistic's impact reticle visible yet? (Renderer + bot share this.) */
export function reticleVisible(g: Game, th: Threat): boolean {
  return g.stats.radarReticle || th.age / th.dur >= BALLISTIC.reticleFrom;
}

/** Seconds until a threat reaches what it is aimed at (bot + UI warnings). */
export function timeToImpact(g: Game, th: Threat): number {
  if (th.kind === 'ballistic') return Math.max(0, th.dur - th.age);
  const t = targetPos(g, th);
  return dist(th.x, th.y, t.x, t.y) / th.speed;
}
