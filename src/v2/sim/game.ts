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
  CARRIER_STRIKE,
  CLUSTER,
  HEAVY,
  MOTHERSHIP,
  SUPERSONIC,
  zeroCounts,
  DEFAULT_FLOW,
  DRONE,
  FLOW_STEPS,
  GUIDED,
  INTERCEPTOR,
  PICKUPS,
  RAID,
  RAID_THEME,
  RULES,
  SHIP,
  THREATS,
  VIEW,
  type RaidTheme,
  type PickupKind,
  type ThreatKind,
} from '../data/config';
import { FORMATIONS, type FormationId } from '../data/formations';
import { MAPS, halfWidthAt, type MapDef, type MapId, type Point } from '../data/maps';
import { UPGRADES, UPGRADE_ORDER, canSwapIn, canTake, stats, type DefenseStats, type Levels, type UpgradeId } from '../data/upgrades';
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
  /** Children (bomblets, mini-drones) are blamed on what spawned them. */
  parent?: ThreatKind;
  /** Mothership: seconds until its next mini-drone. */
  spawnT: number;
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

/** Cumulative totals at the end of each wave (playtest logs diff these). */
export interface WaveRecord {
  wave: number;
  t: number;
  outcome: 'cleared' | 'lost';
  score: number;
  delivered: number;
  lost: number;
  carrierHp: number;
  shots: number;
  kills: Record<ThreatKind, number>;
  sunkBy: Record<ThreatKind, number>;
  taps: TapCounts;
}

export type TapCounts = Record<TapResult, number>;

interface Launch {
  at: number;
  kind: ThreatKind;
  base: number;
}

/** A raid of the current wave: when it starts, its theme, and the bases it
 *  fires from (lit up during the warning). */
export interface Raid {
  at: number;
  theme: RaidTheme;
  bases: number[];
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
  raids: Raid[];
  ships: Ship[];
  threats: Threat[];
  interceptors: Interceptor[];
  pickups: Pickup[];
  fx: Fx[];
  events: GameEvent[];
  carrierHp: number;
  ammo: number;
  reloadT: number;
  /** The Shore Battery's own rack (empty until the card is taken). */
  batteryAmmo: number;
  batteryReloadT: number;
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
  /** Ships sunk, by what finished them — the loss screen names the culprit. */
  sunkBy: Record<ThreatKind, number>;
  shots: number;
  seen: Set<ThreatKind>;
  /** True once wave RULES.wavesToClear is beaten (map unlocked). */
  cleared: boolean;
  endless: boolean;
  nextId: number;
  /** Sim steps taken — playtest logs stamp every input with it, so a log
   *  replays exactly. */
  steps: number;
  taps: TapCounts;
  history: WaveRecord[];
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
    raids: [],
    ships: [],
    threats: [],
    interceptors: [],
    pickups: [],
    fx: [],
    events: [],
    carrierHp: CARRIER.hp,
    ammo: s.rack,
    reloadT: 0,
    batteryAmmo: 0,
    batteryReloadT: 0,
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
    kills: zeroCounts(),
    sunkBy: zeroCounts(),
    shots: 0,
    seen: new Set(),
    cleared: false,
    endless: false,
    nextId: 1,
    steps: 0,
    taps: { fire: 0, pickup: 0, dry: 0, empty: 0 },
    history: [],
  };
  // Skipping ahead (playtesting a late wave) also hands over the cards a
  // player would have drafted by then, so the wave plays as it really would.
  for (let w = 1; w < Math.floor(firstWave); w++) {
    g.wave = w;
    openDraft(g);
    const pick = g.offer.find((id) => id !== 'resupply' && canTake(g.levels, id));
    if (pick) {
      g.levels[pick] = (g.levels[pick] ?? 0) + 1;
      g.stats = stats(g.levels);
    }
  }
  g.ammo = g.stats.rack;
  g.batteryAmmo = g.stats.batteryRack;
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
  // Most launches bunch into raids: a few seconds of several bases firing
  // at once, then a short breather. Each raid is one family of threat (a
  // drone swarm, a splash barrage, a guided volley), so each calls for its
  // own answer; a share of drone swarms trickles in between raids.
  const swarms: number[] = [];
  for (let left = spec.drones; left > 0; ) {
    const size = Math.min(left, Math.max(2, spec.swarm - rng.int(2)));
    swarms.push(size);
    left -= size;
  }
  const trickle = Math.round(swarms.length * RAID.trickle);
  // Everything that goes into raids, by family: a drone swarm counts as one unit.
  const units: { kind: ThreatKind; size: number }[] = swarms.slice(trickle).map((size) => ({ kind: 'drone', size }));
  for (let k = 0; k < spec.ballistic; k++) units.push({ kind: 'ballistic', size: 1 });
  for (let k = 0; k < spec.guided; k++) units.push({ kind: 'guided', size: 1 });
  for (const x of g.map.extras) {
    if (g.wave < x.from) continue;
    const n = Math.round(x.count + x.growth * (g.wave - x.from));
    for (let k = 0; k < n; k++) units.push({ kind: x.kind, size: 1 });
  }
  const themes: RaidTheme[] = ['swarm', 'barrage', 'volley'];
  const count = (t: RaidTheme) => units.filter((u) => RAID_THEME[u.kind] === t).length;
  const present = themes.filter((t) => count(t) > 0);
  const total = Math.max(present.length, Math.round(spec.duration / RAID.every));
  // Raids per theme, in proportion to its units (at least one each).
  const per = new Map(present.map((t) => [t, 1]));
  for (let k = present.length; present.length && k < total; k++) {
    const t = present.reduce((a, b) => (count(b) / per.get(b)! > count(a) / per.get(a)! ? b : a));
    per.set(t, per.get(t)! + 1);
  }
  const order = rng.shuffle(present.flatMap((t) => Array.from({ length: per.get(t)! }, () => t)));
  const raids: Raid[] = order.map((theme, k) => ({ at: lead + RAID.warn * 0.4 + (spec.duration * k) / order.length, theme, bases: [] }));
  const cursor = new Map<RaidTheme, number>();
  for (const u of units) {
    const theme = RAID_THEME[u.kind];
    const mine = raids.filter((r) => r.theme === theme);
    const at0 = cursor.get(theme) ?? rng.int(mine.length);
    const raid = mine[at0 % mine.length];
    cursor.set(theme, at0 + 1);
    const base = pickBase(g, u.kind, rng);
    if (!raid.bases.includes(base)) raid.bases.push(base);
    const at = raid.at + rng.range(0, RAID.window);
    for (let d = 0; d < u.size; d++) queue.push({ at: at + d * 0.35, kind: u.kind, base });
  }
  g.raids = raids;
  swarms.slice(0, trickle).forEach((size, k) => {
    const base = pickBase(g, 'drone', rng);
    const at = lead + (spec.duration * (k + 0.5)) / Math.max(1, trickle) + rng.range(-2, 2);
    for (let d = 0; d < size; d++) queue.push({ at: at + d * 0.35, kind: 'drone', base });
  });
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
  const offsets = FORMATIONS[id].offsets;
  // Re-slot every hull, front of the convoy first, so the change is visible
  // right away; the ships glide over to their new lanes. Ships sailing abreast
  // are re-slotted as a row that keeps its top-to-bottom order, so no hull is
  // sent across another's bow.
  const order = [...g.ships].sort((a, b) => b.x - a.x);
  let next = 0;
  for (let i = 0; i < order.length; ) {
    let j = i + 1;
    while (j < order.length && order[i].x - order[j].x < SHIP.minGap / 2) j++;
    const row = order.slice(i, j).sort((a, b) => a.y - b.y);
    const slots = row.map((_, k) => (next + k) % offsets.length).sort((a, b) => offsets[a] - offsets[b]);
    row.forEach((s, k) => (s.slot = slots[k]));
    next += row.length;
    i = j;
  }
  g.spawnCount = 0;
}

export type TapResult = 'fire' | 'pickup' | 'dry' | 'empty';

/** A tap at (x, y) in world units, reaching `radius` world units. */
export function tap(g: Game, x: number, y: number, radius: number): TapResult {
  if (g.phase !== 'wave') return 'empty';
  const result = tapResult(g, x, y, radius);
  g.taps[result] += 1;
  return result;
}

function tapResult(g: Game, x: number, y: number, radius: number): TapResult {
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

/** Take a draft card. `replace` swaps a new card in for one you hold when
 *  all slots are full: the replaced card and its levels are gone. */
export function pickUpgrade(g: Game, id: UpgradeId, replace?: UpgradeId): void {
  if (g.phase !== 'draft' || !g.offer.includes(id)) return;
  const swap = replace !== undefined && canSwapIn(g.levels, id) && (g.levels[replace] ?? 0) > 0;
  if (!swap && !canTake(g.levels, id)) return;
  if (swap) delete g.levels[replace];
  if (id === 'resupply') {
    for (const s of g.ships) s.hp = SHIP.hp;
    g.carrierHp = CARRIER.hp;
    g.ammo = g.stats.rack;
    g.batteryAmmo = g.stats.batteryRack;
    startWave(g);
    return;
  }
  const oldRack = g.stats.rack;
  const oldBattery = g.stats.batteryRack;
  g.levels[id] = (g.levels[id] ?? 0) + 1;
  g.stats = stats(g.levels);
  g.ammo = Math.max(0, Math.min(g.stats.rack, g.ammo + (g.stats.rack - oldRack)));
  g.batteryAmmo = Math.min(g.batteryAmmo, g.stats.batteryRack);
  if (id === 'battery') g.batteryAmmo = Math.min(g.stats.batteryRack, g.batteryAmmo + g.stats.batteryRack - oldBattery);
  startWave(g);
}

/** After clearing the map, keep going for score. */
export function continueEndless(g: Game): void {
  if (g.phase !== 'won') return;
  g.endless = true;
  openDraft(g);
}

/** Chance each draft draw comes from the loadout's own (unmaxed) cards. */
const OWNED_DRAW = 0.37;

function openDraft(g: Game): void {
  // Three random cards from everything not yet maxed. With a full loadout, a
  // new card can still be swapped in for one you hold — whether one of your
  // own comes up to level is the luck of the draw — and if nothing can be
  // taken without a swap, Resupply is added so keeping your build is a choice.
  // Each of the three draws favours a card you already hold (OWNED_DRAW), so a
  // loadout levels up in most drafts but not all.
  const open = UPGRADE_ORDER.filter((id) => (g.levels[id] ?? 0) < UPGRADES[id].max);
  const rng = g.rng.draft;
  const mine = rng.shuffle(open.filter((id) => (g.levels[id] ?? 0) > 0));
  const other = rng.shuffle(open.filter((id) => !(g.levels[id] ?? 0)));
  g.offer = [];
  while (g.offer.length < 3 && (mine.length || other.length)) {
    const fromMine = mine.length && (!other.length || rng.chance(OWNED_DRAW));
    g.offer.push((fromMine ? mine : other).shift()!);
  }
  if (!g.offer.some((id) => canTake(g.levels, id))) g.offer.push('resupply');
  g.phase = 'draft';
}

// ---------------------------------------------------------------------------
// The step

export function step(g: Game, dt: number): void {
  if (g.phase !== 'wave') return;
  g.steps += 1;
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
    recordWave(g, 'lost');
    return;
  }
  if (g.queue.length === 0 && g.threats.length === 0) {
    g.score += 200 * g.wave;
    recordWave(g, 'cleared');
    if (!g.endless && g.wave >= RULES.wavesToClear) {
      g.cleared = true;
      g.phase = 'won';
    } else {
      openDraft(g);
    }
  }
}

function recordWave(g: Game, outcome: WaveRecord['outcome']): void {
  g.history.push({
    wave: g.wave,
    t: Math.round(g.t * 10) / 10,
    outcome,
    score: g.score,
    delivered: g.delivered,
    lost: g.lost,
    carrierHp: g.carrierHp,
    shots: g.shots,
    kills: { ...g.kills },
    sunkBy: { ...g.sunkBy },
    taps: { ...g.taps },
  });
}

// ---------------------------------------------------------------------------
// Ships

function spawnGap(g: Game): number {
  return FLOW_STEPS[g.flow].interval * FORMATIONS[g.formation].group;
}

function slotY(g: Game, s: Ship): number {
  const ch = g.map.channels[s.channel];
  const offsets = FORMATIONS[g.formation].offsets;
  return ch.y + offsets[s.slot % offsets.length] * halfWidthAt(ch, s.x);
}

function spawnShips(g: Game, dt: number): void {
  g.spawnT -= dt;
  if (g.spawnT > 0) return;
  const f = FORMATIONS[g.formation];
  const channel = g.channelCursor % g.map.channels.length;
  // Never drop a hull on top of one still waiting at the entry: hold the spawn
  // (it retries next tick) until the entry is clear.
  const ch = g.map.channels[channel];
  const entryBusy = g.ships.some(
    (s) => s.x < -40 + SHIP.minGap + SHIP.easeGap && Math.abs(s.y - ch.y) <= ch.halfWidth + SHIP.laneMatch,
  );
  if (entryBusy) return;
  g.channelCursor++;
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
  // Keep station on the rails: a hull eases off when the one ahead in its lane
  // is too close. This is what turns two ships abreast into a single file when
  // a formation change merges their lanes, instead of stacking them.
  const order = [...g.ships].sort((a, b) => b.x - a.x || a.id - b.id);
  const lane = order.map((s) => slotY(g, s));
  for (let i = 0; i < order.length; i++) {
    const s = order[i];
    let gap = Infinity;
    for (let j = 0; j < i; j++) {
      const o = order[j];
      if (Math.abs(lane[j] - lane[i]) < SHIP.laneMatch || Math.abs(o.y - s.y) < SHIP.laneMatch) {
        gap = Math.min(gap, o.x - s.x);
      }
    }
    const slow = clamp((gap - SHIP.minGap) / SHIP.easeGap, 0, 1);
    s.x += shipSpeed(g) * slow * dt;
    // Only move across into the new lane once that stretch of it is empty.
    const clear = order.every(
      (o, j) => j === i || Math.abs(o.x - s.x) >= SHIP.minGap || Math.abs(o.y - lane[i]) >= SHIP.laneMatch,
    );
    if (clear) s.y += (lane[i] - s.y) * ease;
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

/** The convoy's speed in the current formation. */
export function shipSpeed(g: Game): number {
  return SHIP.speed * FORMATIONS[g.formation].speed;
}

// Bomblets are blamed on the cluster that dropped them.
const SPLASH_WEAPONS: ThreatKind[] = ['ballistic', 'heavy', 'cluster', 'bomblet'];

/** `direct`: the hit was aimed at this ship (formation armour applies);
 *  splash spilling over from a neighbour's hit is not reduced. Spread's
 *  blast cut applies to splash weapons either way. */
function damageShip(g: Game, s: Ship, amount: number, by: ThreatKind, direct = true): void {
  const f = FORMATIONS[g.formation];
  if (f.blastCut > 0 && SPLASH_WEAPONS.includes(by)) amount = Math.max(1, Math.ceil(amount * (1 - f.blastCut)));
  s.hp -= direct ? Math.max(1, amount - f.armor) : amount;
  if (s.hp > 0) return;
  g.ships = g.ships.filter((o) => o !== s);
  g.lost += 1;
  g.sunkBy[by] += 1;
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

/** How much of a wave's speed-up each threat takes (fast ones take less). */
const WAVE_SPEED_SHARE: Record<ThreatKind, number> = {
  drone: 1,
  ballistic: 1,
  guided: GUIDED.waveSpeedShare,
  supersonic: SUPERSONIC.waveSpeedShare,
  heavy: HEAVY.waveSpeedShare,
  cluster: GUIDED.waveSpeedShare,
  mothership: MOTHERSHIP.waveSpeedShare,
  bomblet: 0.5,
  minidrone: 1,
};

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
    speed: def.speed * (1 + (g.waveSpeed - 1) * WAVE_SPEED_SHARE[l.kind]) * g.stats.threatSlow,
    heading: 0,
    target: CARRIER_TARGET,
    age: 0,
    phase: rng.range(0, Math.PI * 2),
    dead: false,
    spawnT: MOTHERSHIP.spawnEvery * 0.5,
    sx: base.x,
    sy: base.y,
    ix: 0,
    iy: 0,
    dur: 1,
    apex: 0,
  };
  const strike = CARRIER_STRIKE[l.kind];
  const goCarrier = l.kind === 'mothership' || (!!strike && g.wave >= strike.from && rng.chance(strike.share));
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
    ix = moving ? t.x + shipSpeed(g) * dur : t.x;
    dur = dist(th.sx, th.sy, ix, t.y) / th.speed;
  }
  th.ix = Math.min(VIEW.width - 20, ix);
  th.iy = t.y;
  th.dur = Math.max(BALLISTIC.minFlight / g.waveSpeed, dur);
  th.apex = Math.min(BALLISTIC.apexMax, BALLISTIC.apexFrac * dist(th.sx, th.sy, th.ix, th.iy));
  // Keep the top of the arc on screen: a missile you can't see can't be tapped.
  let lo = 0;
  let hi = th.apex;
  for (let k = 0; k < 20 && arcTop(th, hi) < BALLISTIC.ceiling; k++) {
    const mid = (lo + hi) / 2;
    if (arcTop(th, mid) < BALLISTIC.ceiling) hi = mid;
    else lo = mid;
    if (hi - lo < 1) hi = lo;
  }
  th.apex = hi;
}

/** Highest (smallest y) point of a ballistic arc with the given apex. */
function arcTop(th: Threat, apex: number): number {
  let top = Math.min(th.sy, th.iy);
  for (let i = 1; i < 32; i++) {
    const p = i / 32;
    top = Math.min(top, th.sy + (th.iy - th.sy) * p - 4 * apex * p * (1 - p));
  }
  return top;
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
  } else if (th.kind === 'supersonic' && th.age < SUPERSONIC.arming) {
    // On the rail with its lock line showing: aim, don't move yet.
    ensureTarget(g, th);
    const tp = leadPoint(g, th);
    th.heading = Math.atan2(tp.y - th.y, tp.x - th.x);
  } else {
    ensureTarget(g, th);
    const tp = th.kind === 'supersonic' ? leadPoint(g, th) : targetPos(g, th);
    const d = dist(th.x, th.y, tp.x, tp.y);
    const want = Math.atan2(tp.y - th.y, tp.x - th.x);
    if (th.kind === 'drone' || th.kind === 'minidrone') {
      // Shahed-style: slow and steady with a lazy weave, re-aiming as it goes.
      const weave = DRONE.weaveAmp * Math.sin(th.age * DRONE.weaveFreq + th.phase);
      th.heading = want + (d > 80 ? weave : 0);
    } else if (th.kind === 'mothership') {
      th.heading = want;
    } else {
      const base = STEER[th.kind] ?? GUIDED.turnRate;
      const close = Math.max(0, 1 - d / GUIDED.terminalRange);
      const turn = (base + (th.kind === 'guided' ? GUIDED.terminalTurn * close : 0)) * dt;
      th.heading += clamp(angleDiff(want, th.heading), -turn, turn);
    }
    const boost =
      th.kind === 'guided' && th.age < GUIDED.boost
        ? GUIDED.boostFrom + (1 - GUIDED.boostFrom) * (th.age / GUIDED.boost)
        : 1;
    th.x += Math.cos(th.heading) * th.speed * boost * dt;
    th.y += Math.sin(th.heading) * th.speed * boost * dt;
    if (th.kind === 'mothership') spawnChildren(g, th, dt);
    if (th.kind === 'cluster' && th.target !== CARRIER_TARGET && d < CLUSTER.splitRange) {
      splitCluster(g, th);
    } else {
      checkImpact(g, th);
    }
  }
  th.vx = (th.x - px) / dt;
  th.vy = (th.y - py) / dt;
}

/** Turn rates (rad/s) for the steering threats. */
const STEER: Partial<Record<ThreatKind, number>> = {
  guided: GUIDED.turnRate,
  supersonic: SUPERSONIC.turnRate,
  heavy: HEAVY.turnRate,
  cluster: CLUSTER.turnRate,
  bomblet: CLUSTER.bombletTurn,
};

/** Where a ship will be when a fast threat reaches it. */
function leadPoint(g: Game, th: Threat): Point {
  const t = targetPos(g, th);
  if (th.target === CARRIER_TARGET) return t;
  const eta = dist(th.x, th.y, t.x, t.y) / th.speed;
  return { x: t.x + shipSpeed(g) * eta, y: t.y };
}

function checkImpact(g: Game, th: Threat): void {
  const dmg = THREATS[th.kind].damage;
  const blame = th.parent ?? th.kind;
  if (th.target === CARRIER_TARGET) {
    if (!onCarrier(g, th.x, th.y)) return;
    th.dead = true;
    damageCarrier(g, dmg);
    addFx(g, 'boom', th.x, th.y, { life: 0.7, r: th.kind === 'heavy' || th.kind === 'mothership' ? 50 : 30 });
    return;
  }
  const s = g.ships.find((o) => o.id === th.target);
  if (!s || dist(th.x, th.y, s.x, s.y) >= SHIP.hitRadius) return;
  th.dead = true;
  if (th.kind === 'heavy') {
    // A heavy warhead also damages everything close by.
    const reach = HEAVY.splash * FORMATIONS[g.formation].splash;
    addFx(g, 'splash', th.x, th.y, { life: 0.9, r: Math.max(reach, 24) });
    for (const o of [...g.ships]) {
      if (o !== s && dist(o.x, o.y, th.x, th.y) <= reach) damageShip(g, o, HEAVY.splashDamage, blame, false);
    }
  } else {
    addFx(g, 'boom', th.x, th.y, { life: 0.7, r: 28 });
  }
  damageShip(g, s, dmg, blame);
}

function child(g: Game, parent: Threat, kind: ThreatKind, target: number, heading: number): Threat {
  return {
    ...parent,
    id: g.nextId++,
    kind,
    parent: parent.kind,
    hp: THREATS[kind].hp,
    speed: THREATS[kind].speed * (1 + (g.waveSpeed - 1) * WAVE_SPEED_SHARE[kind]) * g.stats.threatSlow,
    heading,
    target,
    age: 0,
    dead: false,
    spawnT: 0,
  };
}

/** A cluster that reaches its split range becomes bomblets aimed at the ships
 *  around its target. Hit it before then and none of this happens. */
function splitCluster(g: Game, th: Threat): void {
  th.dead = true;
  const near = targetable(g, VIEW.width + 40)
    .filter((s) => dist(s.x, s.y, th.x, th.y) <= CLUSTER.spread)
    .sort((a, b) => dist(a.x, a.y, th.x, th.y) - dist(b.x, b.y, th.x, th.y));
  const targets = near.length ? near : [];
  for (let k = 0; k < CLUSTER.bomblets; k++) {
    const t = targets.length ? targets[k % targets.length].id : th.target;
    const spreadAngle = th.heading + (k - (CLUSTER.bomblets - 1) / 2) * 0.35;
    g.threats.push(child(g, th, 'bomblet', t, spreadAngle));
  }
  addFx(g, 'burst', th.x, th.y, { life: 0.5, r: 40 });
}

function spawnChildren(g: Game, th: Threat, dt: number): void {
  th.spawnT -= dt;
  if (th.spawnT > 0) return;
  th.spawnT += MOTHERSHIP.spawnEvery;
  const pool = targetable(g);
  const t = pool.length ? g.rng.threats.pick(pool).id : CARRIER_TARGET;
  g.threats.push(child(g, th, 'minidrone', t, th.heading + Math.PI / 2));
  addFx(g, 'launch', th.x, th.y, { life: 0.4, r: 12 });
}

function impactBallistic(g: Game, th: Threat): void {
  th.dead = true;
  const dmg = THREATS.ballistic.damage;
  // The formation sets how far the blast reaches other hulls; Spread (0)
  // means only the nearest ship inside the blast is hit.
  const reach = BALLISTIC.splash * FORMATIONS[g.formation].splash;
  addFx(g, 'splash', th.ix, th.iy, { life: 0.9, r: Math.max(reach, BALLISTIC.splash) });
  const inBlast = g.ships
    .map((s) => ({ s, d: dist(s.x, s.y, th.ix, th.iy) }))
    .filter((o) => o.d <= Math.max(reach, BALLISTIC.splash))
    .sort((a, b) => a.d - b.d);
  inBlast.forEach((o, k) => {
    if (k === 0 ? o.d <= BALLISTIC.splash : o.d <= reach) damageShip(g, o.s, dmg, 'ballistic', k === 0);
  });
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

type Launcher = 'carrier' | 'battery';

function launcherPos(g: Game, l: Launcher): Point {
  return l === 'battery' ? g.map.battery : g.map.carrier;
}

/** The nearest launcher that can fire right now, or null if every rack is dry. */
function readyLauncher(g: Game, x: number, y: number): Launcher | null {
  const ready: Launcher[] = [];
  if (g.overdriveT > 0 || g.ammo >= 1) ready.push('carrier');
  if (g.stats.batteryRack > 0 && (g.overdriveT > 0 || g.batteryAmmo >= 1)) ready.push('battery');
  if (!ready.length) return null;
  const d = (l: Launcher) => dist(launcherPos(g, l).x, launcherPos(g, l).y, x, y);
  return ready.sort((a, b) => d(a) - d(b))[0];
}

/** Can a tap fire anything right now? (Bot + UI share this.) */
export function canFire(g: Game): boolean {
  return g.overdriveT > 0 || g.ammo >= 1 || (g.stats.batteryRack > 0 && g.batteryAmmo >= 1);
}

function fireAt(g: Game, th: Threat): boolean {
  const from = readyLauncher(g, th.x, th.y);
  if (!from) {
    g.events.push({ kind: 'dry' });
    return false;
  }
  if (g.overdriveT <= 0) {
    if (from === 'battery') g.batteryAmmo -= 1;
    else g.ammo -= 1;
  }
  g.shots += 1;
  spawnInterceptor(g, th, from);
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
    spawnInterceptor(g, target, from);
  }
  return true;
}

function spawnInterceptor(g: Game, th: Threat, from: Launcher): void {
  const p = launcherPos(g, from);
  g.interceptors.push({
    id: g.nextId++,
    x: p.x,
    y: p.y - 6,
    target: th.id,
    tx: th.x,
    ty: th.y,
    life: 0,
  });
}

function reload(g: Game, dt: number): void {
  const rb = g.stats.batteryRack;
  if (g.overdriveT > 0) {
    g.overdriveT -= dt;
    g.ammo = g.stats.rack;
    g.batteryAmmo = rb;
    g.reloadT = g.batteryReloadT = 0;
    return;
  }
  // Both racks reload in parallel at the same rate.
  const refill = (ammo: number, t: number, cap: number): [number, number] => {
    if (ammo >= cap) return [cap, 0];
    t += dt;
    while (t >= g.stats.reload && ammo < cap) {
      t -= g.stats.reload;
      ammo += 1;
    }
    return [ammo, ammo >= cap ? 0 : t];
  };
  [g.ammo, g.reloadT] = refill(g.ammo, g.reloadT, g.stats.rack);
  [g.batteryAmmo, g.batteryReloadT] = refill(g.batteryAmmo, g.batteryReloadT, rb);
}

const RETARGET_RANGE = 450;

function updateInterceptors(g: Game, dt: number): void {
  const speed = g.stats.interceptorSpeed;
  const live: Interceptor[] = [];
  for (const it of g.interceptors) {
    it.life += dt;
    let th = it.target === null ? undefined : g.threats.find((o) => o.id === it.target && !o.dead);
    if (!th && it.target !== null) {
      it.target = null;
      if (g.stats.retarget) {
        // Prefer the nearest threat nobody is covering yet; a covered one
        // counts as if it were further away.
        let bd = Infinity;
        for (const o of g.threats) {
          if (o.dead) continue;
          const d = dist(it.x, it.y, o.x, o.y) + (assigned(g, o.id) >= o.hp ? 250 : 0);
          if (d < bd && d < RETARGET_RANGE) {
            bd = d;
            th = o;
          }
        }
        if (th) it.target = th.id;
      }
    }
    // Auto-Retarget L2: an extra interceptor on a target that is already
    // covered peels off to the nearest threat nobody is covering.
    if (th && g.stats.retarget >= 2 && assigned(g, th.id) > th.hp) {
      let bd = RETARGET_RANGE;
      let alt: Threat | undefined;
      for (const o of g.threats) {
        if (o.dead || o === th || assigned(g, o.id) >= o.hp) continue;
        const d = dist(it.x, it.y, o.x, o.y);
        if (d < bd) {
          bd = d;
          alt = o;
        }
      }
      if (alt) {
        th = alt;
        it.target = alt.id;
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
  // A last-ditch gun: it takes whatever is closest to the carrier inside its
  // reach, threats aimed at the carrier first (round 3: at long range and
  // fast fire it out-shot the player 47 to 5 in a wave).
  const c = g.map.carrier;
  let best: Threat | null = null;
  let bd = Infinity;
  for (const th of g.threats) {
    if (th.dead) continue;
    const d = dist(c.x, c.y, th.x, th.y);
    if (d > g.stats.ciwsRange) continue;
    const score = d - (th.target === CARRIER_TARGET ? g.stats.ciwsRange : 0);
    if (score < bd) {
      bd = score;
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
      g.batteryAmmo = g.stats.batteryRack;
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
/** The raid about to start, while its warning is up (null otherwise), with
 *  how far through the warning we are (0 → 1). */
export function raidWarning(g: Game): { raid: Raid; p: number } | null {
  if (g.phase !== 'wave') return null;
  for (const raid of g.raids) {
    const ahead = raid.at - g.waveT;
    if (ahead > 0 && ahead <= RAID.warn) return { raid, p: 1 - ahead / RAID.warn };
  }
  return null;
}

export function reticleVisible(g: Game, th: Threat): boolean {
  return g.stats.radarReticle || th.age / th.dur >= BALLISTIC.reticleFrom;
}

/** Seconds until a threat reaches what it is aimed at (bot + UI warnings). */
export function timeToImpact(g: Game, th: Threat): number {
  if (th.kind === 'ballistic') return Math.max(0, th.dur - th.age);
  const t = targetPos(g, th);
  const arming = th.kind === 'supersonic' ? Math.max(0, SUPERSONIC.arming - th.age) : 0;
  return arming + dist(th.x, th.y, t.x, t.y) / th.speed;
}
