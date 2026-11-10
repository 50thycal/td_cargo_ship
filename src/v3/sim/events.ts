// Special event attacks in the sim (data/events.ts holds the table and the
// numbers; docs/design/v3-special-events-build.md says what each one does).
// An event is a wave of its own: wave 11 on a campaign map that has one,
// after its ten normal waves (they stay as they were), and every wave of a
// Test Lab event card. It starts like any wave (its card, then a breather
// as long as a wave's lead-in), then its script launches in place of the
// raid planner. The wave ends as any wave does, once everything it sent is
// dealt with; the event is graded on what it cost (Clean, Held, Broken).
//
// game.ts calls in at: startWave (startEvent), each step (updateEvent), the
// wave's end and a loss (endEvent), a kill (eventFoeDown), a shot (in
// fireAt, the Decoy Storm's count), the drop roll (eventDropWeights) and the
// lab's "Run it again" (rerunEvent). foes.ts reads the run's rules and
// features (the line, the fire's linger) where a foe behaves differently in
// an event. Pure and deterministic like the rest of the sim.

import { EV, EVENT, EVENTS, EVENT_MAPS, EVENT_WAVE, gradeEvent, type EventId, type EventOutcome, type EventRule } from '../data/events';
import { FOE } from '../data/foes';
import { RULES, VIEW, isStructure, type PickupKind, type ThreatKind } from '../data/config';
import type { AbilityId } from '../data/abilities';
import type { Point } from '../data/maps';
import { laneAt, laneLength } from './lanes';
import { foeData, launchFoe, onLand, siegeSpotAt, wetRun } from './foes';
import { CARRIER_TARGET, addFx, addPickup, callCargoPlane, clamp, cue, dist, launchPlane, pathLength, pickBase, shipAhead, spawnThreat, targetable, type Game, type Threat } from './game';

/** One step of an event's script: at `at` s into the event, do `op`
 *  (the event's own), the `k`th of them. */
export interface EventStep {
  at: number;
  op: string;
  k: number;
}

/** An event running. */
export interface EventRun {
  id: EventId;
  wave: number;
  /** The wave clock when it began (a lab rerun begins it again), and
   *  seconds since. */
  t0: number;
  t: number;
  /** The sim step it began on. */
  step: number;
  /** Where things stood as it began: ships lost, the carrier's hull, shots. */
  lost0: number;
  carrier0: number;
  shots0: number;
  /** Shots fired at decoys (the Decoy Storm's count). */
  decoyShots: number;
  /** What its script sent, by kind. */
  sent: Partial<Record<ThreatKind, number>>;
  /** Its script still to run (sorted by `at`). */
  plan: EventStep[];
  /** The script has run out. */
  done: boolean;
  rules: EventRule[];
  /** A line on the water (Afterburner Rush's boost line, Hydra Bloom's
   *  halfway line): its y, and +1 when the threats come down the screen to
   *  it, -1 when up. */
  line?: { y: number; dir: number };
  /** Shield Wall: signals given, and when the last came (event seconds). */
  signals: number;
  signalT: number;
  /** Escort Run's heavy, Repair Yard's mothership (threat id), and the
   *  heavy's own speed. */
  boss: number;
  bossSpeed: number;
  /** Firestorm: how long its fireballs burn. */
  linger?: number;
  /** Shield Wall: the block's ids. */
  block: number[];
  /** Shield Wall: each row's launch point, the ship the block is after,
   *  and the way the block faces (round 6: a row from each point, joining
   *  up on the way). */
  rows?: { x: number; y: number }[];
  ship?: number;
  face?: { x: number; y: number };
  /** Shield Wall: where the rows form up, and whether the block has set
   *  off from there. */
  muster?: { x: number; y: number };
  formed?: boolean;
  /** Wolf Pack: subs surfaced so far, and which of them (by that count)
   *  fires a fast torpedo in its spread. */
  subs: number;
  fastAt: number[];
  /** Bombardment: supply drones' pickups dropped so far (the next in turn). */
  cargo: number;
  /** Fire Mission: the spotters (their side, hits left, the threat flying
   *  their turn now, and whether they've been shot down), and the ship last
   *  painted. */
  crew?: { side: 'left' | 'right' | 'far'; hp: number; id: number; down: boolean }[];
  painted: number;
  /** Fire Mission: walking barrages called. */
  barrages: number;
  /** Repair Yard: the spot the repair ships meet at. */
  yard?: Point;
}

/** An event as it went, for the play log and the result screen. */
export interface EventRecord {
  wave: number;
  id: EventId;
  /** Sim steps it started and ended on, and its seconds. */
  step: number;
  end: number;
  seconds: number;
  sent: Partial<Record<ThreatKind, number>>;
  /** 'rerun': a Test Lab "Run it again" cut it short. */
  outcome: EventOutcome | 'rerun';
  lost: number;
  carrierHit: boolean;
  shots: number;
  /** The Decoy Storm: shots that went at decoys. */
  decoyShots?: number;
  bonus: number;
}

/** The event this run plays, if any: a lab event card's, or (in the
 *  campaign, not Free Play) the map's. */
export function eventFor(g: Game): EventId | null {
  if (g.lab) return g.lab.event ?? null;
  if (g.freePlay) return null;
  return EVENT_MAPS[g.map.id] ?? null;
}

/** The wave that wins the map: the tenth, or the event after it. */
export function lastWave(g: Game): number {
  return RULES.wavesToClear + (!g.lab && eventFor(g) ? 1 : 0);
}

/** Is the wave starting now an event? (Every wave of a lab event card.) */
export function isEventWave(g: Game): boolean {
  const id = eventFor(g);
  if (!id) return false;
  if (g.lab) return true;
  return !g.endless && g.wave === EVENT_WAVE;
}

/** Is the event's script still running (it holds the wave open)? */
export function eventBusy(g: Game): boolean {
  return !!g.event && !g.event.done;
}

export function hasRule(g: Game, r: EventRule): boolean {
  return !!g.event && g.event.rules.includes(r);
}

// ---------------------------------------------------------------------------
// Start, run, end

/** The wave starting now is the event: its card, its script. */
export function startEvent(g: Game): void {
  const id = eventFor(g)!;
  g.queue = [];
  g.raids = [];
  g.raiderQueue = [];
  g.event = newRun(g, id);
  g.events.push({ kind: 'special', id, wave: g.wave });
  cue(g, 'debut.sting', VIEW.width / 2, VIEW.height / 2);
}

function newRun(g: Game, id: EventId): EventRun {
  const ev: EventRun = {
    id,
    wave: g.wave,
    t0: g.waveT,
    t: 0,
    step: g.steps,
    lost0: g.lost,
    carrier0: g.carrierHp,
    shots0: g.shots,
    decoyShots: 0,
    sent: {},
    plan: [],
    done: false,
    rules: [...EVENTS[id].rules],
    signals: 0,
    signalT: -9,
    boss: -1,
    bossSpeed: 0,
    block: [],
    subs: 0,
    fastAt: [],
    cargo: 0,
    painted: -1,
    barrages: 0,
  };
  // No convoy on the water yet (a Test Lab card starts straight into its
  // event): the attack waits for the first ships to sail in.
  if (!g.ships.length) ev.t0 += EVENT.convoyWait;
  ev.plan = plan(g, ev).sort((a, b) => a.at - b.at);
  return ev;
}

/** Each step: the script's launches that are due, and what the event does
 *  while it runs. */
export function updateEvent(g: Game): void {
  const ev = g.event;
  if (!ev) return;
  ev.t = Math.max(0, g.waveT - ev.t0);
  while (ev.plan.length && ev.plan[0].at <= ev.t) run(g, ev, ev.plan.shift()!);
  ev.done = ev.plan.length === 0;
  tick(g, ev);
  // Anything left this long after it began flies off: an event never
  // holds a wave open for good.
  if (ev.t > EVENT.breather + EVENT.cap) flush(g);
}

/** The event is over: the wave was cleared, or the map lost in it. Its
 *  grade, its bonus, its record. */
export function endEvent(g: Game, mapLost: boolean): void {
  const ev = g.event;
  if (!ev) return;
  const lost = g.lost - ev.lost0;
  const hit = g.carrierHp < ev.carrier0;
  const outcome = gradeEvent(lost, hit, mapLost);
  const bonus = mapLost ? 0 : EVENT.bonus[outcome];
  g.score += bonus;
  record(g, ev, outcome, bonus);
  g.events.push({ kind: 'specialEnd', id: ev.id, outcome, bonus });
  if (g.lab) {
    const s = g.lab.stats;
    if (outcome === 'clean') s.clean = (s.clean ?? 0) + 1;
    else if (outcome === 'held') s.held = (s.held ?? 0) + 1;
    else s.broken = (s.broken ?? 0) + 1;
  }
  g.event = null;
}

function record(g: Game, ev: EventRun, outcome: EventRecord['outcome'], bonus: number): void {
  g.eventLog.push({
    wave: ev.wave,
    id: ev.id,
    step: ev.step,
    end: g.steps,
    seconds: Math.round(ev.t * 10) / 10,
    sent: { ...ev.sent },
    outcome,
    lost: g.lost - ev.lost0,
    carrierHit: g.carrierHp < ev.carrier0,
    shots: g.shots - ev.shots0,
    ...(ev.id === 'decoy-storm' ? { decoyShots: ev.decoyShots } : {}),
    bonus,
  });
}

/** The Test Lab's "Run it again": what is on the board goes, and the event
 *  starts over (its card and breather first). A recorded command. */
export function rerunEvent(g: Game): void {
  const ev = g.event;
  const id = ev?.id ?? eventFor(g);
  if (!id) return;
  if (ev) record(g, ev, 'rerun', 0);
  flush(g);
  g.queue = [];
  g.raiderQueue = [];
  g.raiders = [];
  g.event = newRun(g, id);
  g.events.push({ kind: 'special', id, wave: g.wave });
  cue(g, 'debut.sting', VIEW.width / 2, VIEW.height / 2);
}

/** Everything the enemy has on the board goes (flies off, sinks): not
 *  kills. Structures stay. */
function flush(g: Game): void {
  for (const t of g.threats) if (!isStructure(t.kind)) t.dead = true;
  g.threats = g.threats.filter((t) => !t.dead);
  g.foe.marks = [];
  g.foe.shots = [];
  g.foe.paint = null;
  g.queue = [];
  if (g.event) {
    g.event.plan = [];
    g.event.done = true;
  }
}

/** A shot at a threat (the Decoy Storm counts the ones at decoys). */
export function eventShotAt(g: Game, th: Threat): void {
  if (g.event && th.kind === 'decoy') g.event.decoyShots += 1;
}

/** The drop table under an event's rules: no ammo (the Decoy Storm), a
 *  star shell in the dark (Blackout); and in every event, no Nuke (Test Lab
 *  round 6: "no nukes for these special events"). */
export function eventDropWeights(g: Game, w: Record<string, number>, starshell: number): void {
  if (!g.event) return;
  w.nuke = 0;
  if (hasRule(g, 'noAmmo')) w.ammo = 0;
  if (hasRule(g, 'night')) w.starshell = Math.max(w.starshell ?? 0, starshell);
}

// ---------------------------------------------------------------------------
// The scripts

const B = EVENT.breather;
const steps = (n: number, at: (k: number) => number, op: string): EventStep[] => Array.from({ length: n }, (_, k) => ({ at: B + at(k), op, k }));

function plan(g: Game, ev: EventRun): EventStep[] {
  switch (ev.id) {
    case 'rush': {
      const E = EV.rush;
      ev.line = lineFrom(g, E.line, true);
      return steps(E.swarms, (k) => k * E.every, 'swarm');
    }
    case 'decoy-storm': {
      const E = EV['decoy-storm'];
      const half = Math.ceil(E.swarms / 2);
      return steps(E.swarms, (k) => (k < half ? k * E.gap : E.second + (k - half) * E.gap), 'decoys');
    }
    case 'hydra-bloom': {
      const E = EV['hydra-bloom'];
      ev.line = lineFrom(g, E.line, false);
      return [...steps(E.fans, (k) => k * E.gap, 'fan'), ...steps(E.swarms, (k) => 3 + k * E.gap, 'swarm')];
    }
    case 'rocket-convoy': {
      // A column down each shore road, the second a little after the first.
      const E = EV['rocket-convoy'];
      return [...steps(E.columns * E.trucks, (k) => Math.floor(k / E.trucks) * E.second + (k % E.trucks) * E.gap, 'truck'), ...steps(E.swarms, (k) => 6 + k * 6, 'swarm')];
    }
    case 'gunship-wall': {
      const E = EV['gunship-wall'];
      return [...steps(E.helis, () => 0, 'heli'), ...steps(E.swarms, (k) => 2 + k * 5, 'swarm')];
    }
    case 'wolf-pack': {
      // Which subs carry a fast torpedo: `fast` of them, in all.
      const E = EV['wolf-pack'];
      const all = E.packs.reduce((a, n) => a + n, 0);
      ev.fastAt = g.rng.foes.shuffle(Array.from({ length: all }, (_, k) => k)).slice(0, E.fast);
      return steps(E.packs.length, (k) => k * E.gap, 'pack');
    }
    case 'shield-wall':
      // The rows set out (run plans each one's start so they join up).
      return steps(1, () => 0, 'block');
    case 'supply-raid': {
      const E = EV['supply-raid'];
      return [
        ...steps(E.drops.length, (k) => E.dropAt[k], 'cargo'),
        ...E.scav.flatMap((n, run) => Array.from({ length: n }, (_, k): EventStep => ({ at: B + E.scavAt[run] + k * E.apart, op: 'scav', k: run * 100 + k }))),
        ...steps(E.swarms, (k) => 3 + k * E.every, 'swarm'),
      ];
    }
    case 'blackout': {
      const E = EV.blackout;
      return [...steps(E.strafers, (k) => k * E.every, 'jet'), ...steps(1, () => E.shellAt, 'shell')];
    }
    case 'carpet-run': {
      const E = EV['carpet-run'];
      return steps(E.passes, (k) => k * E.gap, 'vee');
    }
    case 'dive-circus': {
      // Dives on the beat; a missile pair on every other off-beat.
      const E = EV['dive-circus'];
      return [...steps(E.planes, (k) => k * E.beat, 'dive'), ...steps(E.pairs, (k) => (2 * k + 1.5) * E.beat, 'pair')];
    }
    case 'bombardment': {
      const E = EV.bombardment;
      return [...steps(1, () => 0, 'hatches'), ...steps(E.swarms, (k) => E.from + k * E.every, 'supply')];
    }
    case 'fire-mission': {
      // The spotters take turns: left, right, the far side, and round again.
      const E = EV['fire-mission'];
      const sides = ['left', 'right', 'far'] as const;
      ev.crew = Array.from({ length: E.spotters }, (_, k) => ({ side: sides[k % sides.length], hp: E.hp, id: -1, down: false }));
      return [...steps(E.spotters * E.turns, (k) => k * E.every, 'spot'), ...steps(E.swarms, (k) => 3 + k * 8, 'swarm')];
    }
    case 'repair-yard': {
      const E = EV['repair-yard'];
      return [...steps(1, () => 0, 'yard'), ...steps(E.swarms, (k) => 5 + k * 7, 'swarm')];
    }
    case 'escort-run': {
      const E = EV['escort-run'];
      return [...steps(1, () => 0, 'escort'), ...steps(E.swarms, (k) => 5 + k * 7, 'swarm')];
    }
    case 'siren-field': {
      const E = EV['siren-field'];
      return [...steps(1, () => 0, 'lures'), ...steps(E.swarms, (k) => E.from + k * E.every, 'swarm')];
    }
    case 'firestorm': {
      const E = EV.firestorm;
      ev.linger = E.linger;
      return [...steps(1, () => 0, 'ring'), ...steps(1, () => E.gap, 'ring2')];
    }
  }
}

/** Count what the script sent. */
function sent(ev: EventRun, kind: ThreatKind, n = 1): void {
  ev.sent[kind] = (ev.sent[kind] ?? 0) + n;
}

/** The threats spawned since `id0` (ids only grow). */
function since(g: Game, id0: number, kind?: ThreatKind): Threat[] {
  return g.threats.filter((t) => t.id >= id0 && (!kind || t.kind === kind));
}

/** Live launch bases (not coves, chutes or generators; standing). */
function liveBases(g: Game, kind?: ThreatKind): number[] {
  const all = g.map.bases.map((b, i) => (b.kinds.length > 0 && !b.cove && !b.chute && !b.generator && !g.baseDown[i] ? i : -1)).filter((i) => i >= 0);
  const able = kind ? all.filter((i) => g.map.bases[i].kinds.includes(kind)) : all;
  return able.length ? able : all;
}

/** A line across the water, `share` of the way from the launch bases to
 *  the first lane's near edge (`edge`) or its middle. */
function lineFrom(g: Game, share: number, edge: boolean): { y: number; dir: number } {
  const bs = liveBases(g);
  const by = bs.reduce((a, i) => a + g.map.bases[i].y, 0) / Math.max(1, bs.length);
  const ch = g.map.channels[0];
  const dir = ch.y >= by ? 1 : -1;
  const to = edge ? ch.y - dir * ch.halfWidth : ch.y;
  return { y: by + (to - by) * share, dir };
}

/** A drone swarm out of a base, the usual way (0.35 s apart). `cargo`:
 *  each of its drones shot down drops a pickup (the Bombardment's). */
function swarm(g: Game, ev: EventRun, size: number, cargo = false): void {
  let b = pickBase(g, 'drone', g.rng.foes);
  if (b < 0) b = liveBases(g)[0] ?? -1;
  if (b < 0) return;
  for (let d = 0; d < size; d++) g.queue.push({ at: g.waveT + d * 0.35, kind: 'drone', base: b, ...(cargo ? { cargo } : {}) });
  g.queue.sort((a, c) => a.at - c.at);
  sent(ev, 'drone', size);
}

function run(g: Game, ev: EventRun, s: EventStep): void {
  const rng = g.rng.foes;
  const c = g.map.carrier;
  switch (ev.id) {
    case 'rush': {
      const bs = liveBases(g, 'drone');
      const b = bs[s.k % bs.length];
      const id0 = g.nextId;
      launchFoe(g, { at: g.waveT, kind: 'sprinter', base: b }, g.map.bases[b]);
      for (const t of since(g, id0, 'sprinter')) t.speed *= EV.rush.cruise;
      sent(ev, 'sprinter', FOE.sprinter.size);
      return;
    }
    case 'decoy-storm': {
      // Two in three of each swarm fake, and the late strobe as always.
      const E = EV['decoy-storm'];
      const D = FOE.decoy;
      const bs = liveBases(g, 'drone');
      const at = g.map.bases[bs[s.k % bs.length]];
      const kinds = rng.shuffle(Array.from({ length: E.size }, (_, k): ThreatKind => (k < E.fakes ? 'decoy' : 'drone')));
      const mid = (E.size - 1) / 2;
      kinds.forEach((kind, k) => {
        const th = spawnThreat(g, kind, at.x + (k - mid) * D.spread, at.y + (k % 2) * D.stagger, 'base');
        th.slot = (k - mid) * D.slot;
        if (kind === 'decoy') th.foe = foeData();
        sent(ev, kind);
      });
      return;
    }
    case 'hydra-bloom': {
      if (s.op === 'swarm') {
        swarm(g, ev, EV['hydra-bloom'].size);
        return;
      }
      // A fan: one Hydra from each base at once, slow.
      for (const b of liveBases(g)) {
        const id0 = g.nextId;
        launchFoe(g, { at: g.waveT, kind: 'hydra', base: b }, g.map.bases[b]);
        for (const t of since(g, id0, 'hydra')) t.speed *= EV['hydra-bloom'].slow;
        sent(ev, 'hydra');
      }
      return;
    }
    case 'rocket-convoy': {
      // Down the shore road in a column; each stops behind the one ahead.
      const E = EV['rocket-convoy'];
      if (s.op === 'swarm') {
        swarm(g, ev, E.size);
        return;
      }
      // Column `col` takes the map's next shore road (one road: the second
      // column comes down it from the other end).
      const col = Math.floor(s.k / E.trucks);
      const i = s.k % E.trucks;
      const path = roadFor(g, col);
      const L = pathLength(path);
      const th = spawnThreat(g, 'rocketTruck', path[0].x, path[0].y, 'truck');
      th.target = CARRIER_TARGET;
      th.heading = Math.atan2(path[1].y - path[0].y, path[1].x - path[0].x);
      th.hp = th.maxHp = E.hp;
      // The columns raise in turn too: the second one's trucks half a turn
      // after the first's, so their salvos overlap.
      th.foe = foeData({ path, along: 0, n: E.salvos, stop: Math.max(60, L * E.stop - i * E.spacing), wait: i * E.stagger + col * E.stagger * 0.5, drive: E.drive, back: E.back });
      sent(ev, 'rocketTruck');
      return;
    }
    case 'gunship-wall': {
      // In a line off the lane's far side from the carrier, left to right.
      const E = EV['gunship-wall'];
      if (s.op === 'swarm') {
        swarm(g, ev, E.size);
        return;
      }
      const ch = g.map.channels[0];
      const far = ch.y <= c.y ? -1 : 1;
      const y = clamp(ch.y + far * (ch.halfWidth + E.off), 90, VIEW.height - 90);
      const x = VIEW.width * (0.2 + (0.6 * s.k) / Math.max(1, E.helis - 1));
      const side = x < VIEW.width / 2 ? 1 : -1;
      const th = spawnThreat(g, 'attackHeli', side > 0 ? -50 : VIEW.width + 50, y, 'air');
      th.target = CARRIER_TARGET;
      th.heading = side > 0 ? 0 : Math.PI;
      th.hp = th.maxHp = E.hp;
      th.foe = foeData({ px: x, py: y, vx: side * 120, vy: 0, hold: g.waveT + E.hold, stay: true, volleys: E.volleys, wait: s.k * E.turn });
      sent(ev, 'attackHeli');
      return;
    }
    case 'wolf-pack': {
      // Five periscopes together; their subs fire on a stagger, each a
      // spread of two or three torpedoes; one or two subs in the event put
      // a fast one in their spread.
      const E = EV['wolf-pack'];
      const S = FOE.torpedoSub;
      const spots = openWater(g, E.packs[s.k], 150);
      spots.forEach((p, k) => {
        const spread = E.spread[0] + rng.int(E.spread[1] - E.spread[0] + 1);
        const fast = ev.fastAt.includes(ev.subs) ? rng.int(spread) : -1;
        ev.subs += 1;
        g.foe.marks.push({ id: g.nextId++, kind: 'periscope', x: p.x, y: p.y, t: 0, dur: S.warn, fireAt: S.fireAt + E.aim + k * E.stagger, spread, fast, fan: E.fan });
        sent(ev, 'torpedoSub');
      });
      cue(g, 'sub.surface', VIEW.width / 2, VIEW.height / 2, { gain: 0.7 });
      return;
    }
    case 'shield-wall': {
      // One block, plates forward, all at one ship; each row from its own
      // launch point (round 6: "they all come from the same launcher"). The
      // rows fly to a muster point and form up there, then the block sets
      // off as one.
      const E = EV['shield-wall'];
      if (s.op === 'row') {
        shieldRow(g, ev, s.k);
        return;
      }
      const rows = Math.ceil(E.drones / E.cols);
      const pts = shieldPoints(g, rows);
      const pool = targetable(g);
      const ship = pool.length ? pool[Math.floor(pool.length / 2)] : null;
      const tp = ship ?? c;
      const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
      const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      const d = Math.max(1, dist(mx, my, tp.x, tp.y));
      ev.rows = pts;
      ev.ship = ship ? ship.id : CARRIER_TARGET;
      ev.face = { x: (tp.x - mx) / d, y: (tp.y - my) / d };
      ev.muster = { x: clamp(mx + (tp.x - mx) * E.muster, 80, VIEW.width - 80), y: clamp(my + (tp.y - my) * E.muster, 80, VIEW.height - 80) };
      // The furthest row sets out now, the nearer ones in turn, so the rows
      // all reach the muster point together.
      const m = ev.muster;
      const far = Math.max(...pts.map((p) => dist(p.x, p.y, m.x, m.y)));
      const speed = shieldRow(g, ev, pts.findIndex((p) => dist(p.x, p.y, m.x, m.y) === far)) * E.form;
      pts.forEach((p, k) => {
        const lag = (far - dist(p.x, p.y, m.x, m.y)) / Math.max(1, speed);
        if (lag > 0) ev.plan.push({ at: ev.t + lag, op: 'row', k });
      });
      ev.plan.sort((a, b) => a.at - b.at);
      return;
    }
    case 'supply-raid': {
      if (s.op === 'cargo') {
        const n = EV['supply-raid'].drops[s.k];
        const held = g.slots.filter((id) => (g.levels[id] ?? 0) > 0);
        // No Nuke in the cargo (round 6: "no nukes for these special
        // events"): it used to be the first run's third supply crate.
        const fill: PickupKind[] = s.k === 0 ? ['ammo', 'repair', 'repair', 'ammo', 'repair'] : ['ammo', 'repair', 'ammo'];
        const load: { kind: PickupKind; weapon?: AbilityId }[] = [];
        for (let i = 0; load.length < n; i++) {
          // Weapons and supplies taking turns, the weapons first.
          const w = i % 2 === 0 ? held[(i / 2 + s.k) % Math.max(1, held.length)] : undefined;
          if (w && i < held.length * 2) load.push({ kind: 'weapon', weapon: w });
          else load.push({ kind: fill[load.length % fill.length] });
        }
        callCargoPlane(g, load);
      } else if (s.op === 'scav') {
        // From every side of the screen in turn (round 6: "have them come
        // from all side"), each leaving the way it came.
        const side = (s.k % 100) % 4;
        const m = 40;
        const p =
          side === 0 ? { x: -m, y: rng.range(150, VIEW.height - 150) }
          : side === 1 ? { x: VIEW.width + m, y: rng.range(150, VIEW.height - 150) }
          : side === 2 ? { x: rng.range(220, VIEW.width - 220), y: -m }
          : { x: rng.range(220, VIEW.width - 220), y: VIEW.height + m };
        const th = spawnThreat(g, 'scavenger', p.x, p.y, 'air');
        th.target = CARRIER_TARGET;
        th.heading = Math.atan2(VIEW.height / 2 - p.y, VIEW.width / 2 - p.x);
        th.foe = foeData({ link: -1, px: p.x, py: p.y, ex: p.x + Math.sign(p.x - VIEW.width / 2) * (side < 2 ? 80 : 0), ey: p.y + Math.sign(p.y - VIEW.height / 2) * (side >= 2 ? 80 : 0) });
        sent(ev, 'scavenger');
      } else swarm(g, ev, EV['supply-raid'].size);
      return;
    }
    case 'blackout': {
      if (s.op === 'shell') {
        addPickup(g, 'starshell', c.x + rng.range(-170, 170), c.y - 190);
        return;
      }
      launchPlane(g, { at: g.waveT, kind: 'stealthJet', base: -1, side: s.k % 2 ? -1 : 1 });
      sent(ev, 'stealthJet');
      return;
    }
    case 'carpet-run': {
      // Three abreast across the lane, the middle one leading.
      const E = EV['carpet-run'];
      const ch = g.map.channels[0];
      const side = s.k % 2 ? -1 : 1;
      for (const lat of [-1, 0, 1]) {
        const id0 = g.nextId;
        launchPlane(g, { at: g.waveT, kind: 'stealthBomber', base: -1, side, y: ch.y + lat * E.spread * ch.halfWidth });
        for (const t of since(g, id0, 'stealthBomber')) {
          t.hp = t.maxHp = E.hp;
          if (lat !== 0) t.x -= side * E.behind;
        }
        sent(ev, 'stealthBomber');
      }
      return;
    }
    case 'dive-circus': {
      if (s.op === 'pair') {
        // Two guided missiles off two bases, a beat apart.
        const bs = rng.shuffle(liveBases(g, 'guided'));
        for (let k = 0; k < 2 && bs.length; k++) g.queue.push({ at: g.waveT + k * 0.3, kind: 'guided', base: bs[k % bs.length] });
        g.queue.sort((a, b) => a.at - b.at);
        sent(ev, 'guided', 2);
        return;
      }
      launchFoe(g, { at: g.waveT, kind: 'diveBomber', base: -1 });
      sent(ev, 'diveBomber');
      return;
    }
    case 'bombardment': {
      const E = EV.bombardment;
      if (s.op === 'supply') {
        // A supply swarm (round 6: "add in some drones to allow some
        // drops"): every drone of it shot down drops a pickup.
        swarm(g, ev, E.size, true);
        return;
      }
      // Three hatches beside three bases, spread along the shore, opening
      // one after another.
      // On the far shore from the carrier where it has bases enough.
      const all = liveBases(g);
      const far = all.filter((i) => (g.map.bases[i].y < VIEW.height / 2) === (g.map.carrier.y > VIEW.height / 2));
      const bs = (far.length >= E.guns ? far : all).sort((a, b) => g.map.bases[a].x - g.map.bases[b].x);
      const pick = Array.from({ length: Math.min(E.guns, bs.length) }, (_, k) => bs[Math.round((k * (bs.length - 1)) / Math.max(1, E.guns - 1))]);
      [...new Set(pick)].forEach((b, k) => {
        const p = siegeSpotAt(g, g.map.bases[b]);
        g.foe.marks.push({ id: g.nextId++, kind: 'hatch', x: p.x, y: p.y, t: 0, dur: FOE.siege.first + k * E.stagger, spawn: true, salvos: E.salvos });
        sent(ev, 'siege');
      });
      return;
    }
    case 'fire-mission': {
      const E = EV['fire-mission'];
      if (s.op === 'swarm') {
        swarm(g, ev, E.size);
        return;
      }
      // A spotter's turn: in from its own side, unless it was shot down.
      const who = ev.crew![s.k % E.spotters];
      if (who.down) return;
      const { from, at } = spotterRun(g, who.side);
      const sp = spawnThreat(g, 'spotter', from.x, from.y, 'air');
      sp.target = CARRIER_TARGET;
      sp.heading = Math.atan2(at.y - from.y, at.x - from.x);
      sp.maxHp = E.hp;
      sp.hp = who.hp;
      sp.foe = foeData({ px: at.x, py: at.y, link: -1, prev: ev.painted, ex: from.x, ey: from.y, mission: true });
      who.id = sp.id;
      sent(ev, 'spotter');
      return;
    }
    case 'repair-yard': {
      if (s.op === 'swarm') {
        swarm(g, ev, EV['repair-yard'].size);
        return;
      }
      // The mothership out of its base, slow and tough, and three repair
      // ships sailing in from different sides of the screen to one spot on
      // its course (round 6: "come from multiple directions and converge on
      // the same spot"; one used to rise in a closed cove and never move).
      const E = EV['repair-yard'];
      const bs = liveBases(g, 'mothership');
      const bi = bs.reduce((m, i) => (dist(g.map.bases[i].x, g.map.bases[i].y, c.x, c.y) > dist(g.map.bases[m].x, g.map.bases[m].y, c.x, c.y) ? i : m), bs[0]);
      const b = g.map.bases[bi];
      const ms = spawnThreat(g, 'mothership', b.x, b.y, 'base');
      ms.hp = ms.maxHp = E.hp;
      ms.speed *= E.speed;
      ms.target = CARRIER_TARGET;
      ev.boss = ms.id;
      sent(ev, 'mothership');
      const yard = yardSpot(g, b, c);
      ev.yard = yard;
      for (const { from, at } of yardRuns(g, yard, E.tenders)) {
        const th = spawnThreat(g, 'tender', from.x, from.y, 'sub');
        th.target = CARRIER_TARGET;
        th.heading = Math.atan2(at.y - th.y, at.x - th.x);
        th.speed *= E.sail;
        th.foe = foeData({ link: -1, px: at.x, py: at.y, n: dist(from.x, from.y, at.x, at.y) < 2 ? 1 : 0, mend: E.mend, every: E.every });
        sent(ev, 'tender');
      }
      return;
    }
    case 'escort-run': {
      if (s.op === 'swarm') {
        swarm(g, ev, EV['escort-run'].size);
        return;
      }
      // One heavy at the carrier, slow, in three rings of guards.
      const E = EV['escort-run'];
      const bs = liveBases(g, 'heavy');
      const bi = bs.reduce((m, i) => (dist(g.map.bases[i].x, g.map.bases[i].y, c.x, c.y) > dist(g.map.bases[m].x, g.map.bases[m].y, c.x, c.y) ? i : m), bs[0]);
      const b = g.map.bases[bi];
      const hv = spawnThreat(g, 'heavy', b.x, b.y, 'base');
      hv.hp = hv.maxHp = E.hp;
      hv.target = CARRIER_TARGET;
      hv.heading = Math.atan2(c.y - b.y, c.x - b.x);
      ev.boss = hv.id;
      ev.bossSpeed = hv.speed;
      hv.speed = ev.bossSpeed * E.slow;
      sent(ev, 'heavy');
      E.rings.forEach((n, ring) => {
        for (let k = 0; k < n; k++) {
          const t = spawnThreat(g, 'guard', b.x, b.y, 'base');
          t.target = CARRIER_TARGET;
          t.foe = foeData({ link: hv.id, n: k, of: n, r: E.radii[ring], ring });
          sent(ev, 'guard');
        }
      });
      return;
    }
    case 'siren-field': {
      if (s.op === 'swarm') {
        swarm(g, ev, EV['siren-field'].size);
        return;
      }
      for (const p of openWater(g, EV['siren-field'].lures, 140)) {
        const th = spawnThreat(g, 'lure', p.x, p.y, 'sub');
        th.target = CARRIER_TARGET;
        th.foe = foeData();
        sent(ev, 'lure');
      }
      return;
    }
    case 'firestorm': {
      // From every side: each launch base, and both side edges.
      const E = EV.firestorm;
      const n = s.op === 'ring' ? E.first : E.second;
      const from: Point[] = [...liveBases(g).map((i) => g.map.bases[i]), { x: -20, y: clamp(c.y - 260, 120, VIEW.height - 160) }, { x: VIEW.width + 20, y: clamp(c.y - 260, 120, VIEW.height - 160) }];
      const order = rng.shuffle(from.map((_, i) => i));
      for (let k = 0; k < n; k++) {
        const at = from[order[k % order.length]];
        const id0 = g.nextId;
        launchFoe(g, { at: g.waveT, kind: 'cloud', base: -1 }, at);
        for (const t of since(g, id0, 'cloud')) t.speed *= E.slow;
        sent(ev, 'cloud');
      }
      return;
    }
  }
}

/** Open water for `n` boats, each `apart` px from the others: the map's sub
 *  spots, then points along its bomber lines; clear of land, the lanes'
 *  middles and the carrier. */
function openWater(g: Game, n: number, apart: number): Point[] {
  const c = g.map.carrier;
  const cands: Point[] = [...g.map.subSpots];
  for (const y of g.map.bomberLines) for (let x = 200; x <= VIEW.width - 200; x += 200) cands.push({ x, y });
  const ok = (p: Point) => !onLand(g, p.x, p.y) && dist(p.x, p.y, c.x, c.y) > 170 && p.x > 120 && p.x < VIEW.width - 120 && p.y > 90 && p.y < VIEW.height - 90 && !inLane(g, p);
  const out: Point[] = [];
  for (const p of g.rng.foes.shuffle(cands.filter(ok))) {
    if (out.length >= n) break;
    if (out.every((o) => dist(o.x, o.y, p.x, p.y) >= apart)) out.push(p);
  }
  return out;
}

/** A Rocket Convoy column's road: the map's shore roads in turn (with just
 *  one, every other column drives it from the far end). */
function roadFor(g: Game, col: number): Point[] {
  const runners = g.map.roads.runners;
  if (!runners.length) {
    const r = g.map.roads.popups[col % g.map.roads.popups.length];
    return [r.from, r.to];
  }
  const path = runners[col % runners.length];
  return runners.length === 1 && col % 2 === 1 ? [...path].reverse() : path;
}

/** The Shield Wall's launch points, one a row, along the shore of the
 *  drone base furthest from the carrier: that base, another drone base on
 *  the same shore if there is one near, and launchers set up on the shore
 *  `spread` px either side of it. */
function shieldPoints(g: Game, rows: number): Point[] {
  const E = EV['shield-wall'];
  const c = g.map.carrier;
  const bs = liveBases(g, 'drone').map((i) => g.map.bases[i]);
  const far = bs.reduce((m, b) => (dist(b.x, b.y, c.x, c.y) > dist(m.x, m.y, c.x, c.y) ? b : m), bs[0] ?? { x: VIEW.width / 2, y: 40 });
  const out: Point[] = [{ x: far.x, y: far.y }];
  const near = bs.filter((b) => b !== far && Math.abs(b.y - far.y) < 120 && Math.abs(b.x - far.x) < E.spread * 2.5).sort((a, b) => Math.abs(a.x - far.x) - Math.abs(b.x - far.x));
  for (const b of near) if (out.length < rows) out.push({ x: b.x, y: b.y });
  // Launchers on the shore either side, the side with more room first.
  const first = far.x < VIEW.width / 2 ? 1 : -1;
  for (let k = 1; out.length < rows && k < 8; k++) {
    const dx = (k % 2 ? first : -first) * E.spread * Math.ceil(k / 2);
    const p = { x: far.x + dx, y: far.y };
    if (p.x < 50 || p.x > VIEW.width - 50 || out.some((o) => Math.abs(o.x - p.x) < E.spread * 0.6)) continue;
    out.push(p);
  }
  while (out.length < rows) out.push({ x: far.x, y: far.y });
  return out.sort((a, b) => a.x - b.x);
}

/** One row of the Shield Wall out of its launch point, each drone bound
 *  for its place in the block at the muster point; returns its speed. */
function shieldRow(g: Game, ev: EventRun, row: number): number {
  const E = EV['shield-wall'];
  const p = ev.rows![row];
  const u = ev.face!;
  const m = ev.muster!;
  const rows = ev.rows!.length;
  const ship = g.ships.find((o) => o.id === ev.ship);
  let speed = 0;
  for (let col = 0; col < E.cols && row * E.cols + col < E.drones; col++) {
    const across = (col - (E.cols - 1) / 2) * E.dx;
    const back = (row - (rows - 1) / 2) * E.dy;
    const ox = -u.y * across - u.x * back;
    const oy = u.x * across - u.y * back;
    // The row leaves its point already in line, as it will fly in the block.
    const x = p.x - u.y * across * 0.5;
    const y = p.y + u.x * across * 0.5;
    const th = spawnThreat(g, 'armored', x, y, 'base');
    if (ship) th.target = ship.id;
    th.heading = Math.atan2(m.y + oy - y, m.x + ox - x);
    th.foe = foeData({ n: FOE.armored.plate, sx: x, sy: y, ox, oy, nobank: true, mx: m.x, my: m.y });
    ev.block.push(th.id);
    sent(ev, 'armored');
    speed = th.speed;
  }
  return speed;
}

/** A Fire Mission spotter's run in: off its side of the screen (left,
 *  right, or the far side of the lane from the carrier) to its spot `off`
 *  px off the lane's far edge, on screen. */
function spotterRun(g: Game, side: 'left' | 'right' | 'far'): { from: Point; at: Point } {
  const E = EV['fire-mission'];
  const c = g.map.carrier;
  const ch = g.map.channels[0];
  const L = laneLength(ch);
  const share = side === 'left' ? 0.22 : side === 'right' ? 0.78 : 0.5;
  const mid = laneAt(ch, L * share, 0);
  // The far side of the lane from the carrier.
  const away = mid.y >= c.y ? 1 : -1;
  let at: Point = laneAt(ch, L * share, away * (ch.halfWidth + E.off));
  if (at.y < 70 || at.y > VIEW.height - 70) at = laneAt(ch, L * share, -away * (ch.halfWidth + E.off));
  at = { x: clamp(at.x, 110, VIEW.width - 110), y: clamp(at.y, 80, VIEW.height - 80) };
  const from =
    side === 'left' ? { x: -80, y: at.y }
    : side === 'right' ? { x: VIEW.width + 80, y: at.y }
    : { x: at.x, y: at.y < VIEW.height / 2 ? -80 : VIEW.height + 80 };
  return { from, at };
}

/** The Fire Mission's walking barrage, called by a spotter on a ship:
 *  `shells` shells down the ship's course from a shore gun, landing one
 *  after another, the middle one where the ship will be. Once called it
 *  comes, whatever happens to the spotter. */
export function walkingBarrage(g: Game, sp: Threat, shipId: number): void {
  const E = EV['fire-mission'];
  const s = g.ships.find((o) => o.id === shipId);
  if (!s) return;
  const sites = liveBases(g);
  const gun = sites.length ? g.map.bases[g.rng.foes.pick(sites)] : { x: sp.x, y: sp.y };
  for (let k = 0; k < E.shells; k++) {
    const t = E.mark + k * E.beat;
    const p = shipAhead(g, s, t);
    const q = shipAhead(g, s, t + 0.5);
    const d = dist(p.x, p.y, q.x, q.y);
    const ux = d > 0.5 ? (q.x - p.x) / d : Math.cos(s.heading);
    const uy = d > 0.5 ? (q.y - p.y) / d : Math.sin(s.heading);
    const off = (k - (E.shells - 1) / 2) * E.walk;
    g.foe.marks.push({ id: g.nextId++, kind: 'shell', x: p.x + ux * off, y: p.y + uy * off, t: 0, dur: t, gx: gun.x, gy: gun.y, dmg: E.dmg });
  }
  if (g.event) {
    g.event.painted = shipId;
    g.event.barrages += 1;
  }
  cue(g, 'notice', sp.x, sp.y);
}

/** The Repair Yard's meeting spot: open water on the mothership's course
 *  (from its base to the carrier), about `meet` of the way along, clear of
 *  land, that ships can sail to from at least two sides. */
function yardSpot(g: Game, from: Point, to: Point): Point {
  const E = EV['repair-yard'];
  const d = Math.max(1, dist(from.x, from.y, to.x, to.y));
  const ux = (to.x - from.x) / d;
  const uy = (to.y - from.y) / d;
  let best: Point = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  let bs = -Infinity;
  for (let k = 0; k <= 11; k++) {
    const u = 0.25 + k * 0.05;
    for (const off of [0, -60, 60, -120, 120, -180, 180]) {
      const p = { x: from.x + (to.x - from.x) * u - uy * off, y: from.y + (to.y - from.y) * u + ux * off };
      if (p.x < 120 || p.x > VIEW.width - 120 || p.y < 100 || p.y > VIEW.height - 100) continue;
      if (!clearWater(g, p, E.ring + 24)) continue;
      const ways = sides(g, p);
      if (ways < 2) continue;
      // Near the middle of its course, near the course, out of the lanes,
      // and reachable from many sides.
      const score = -Math.abs(u - E.meet) * 400 - Math.abs(off) * 0.8 - (inLane(g, p) ? 150 : 0) + Math.min(ways, 4) * 40;
      if (score > bs) {
        bs = score;
        best = p;
      }
    }
  }
  return best;
}

/** Is there open water all round (x, y), `r` px out? */
function clearWater(g: Game, p: Point, r: number): boolean {
  if (onLand(g, p.x, p.y)) return false;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (onLand(g, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r)) return false;
  }
  return true;
}

/** Points off the screen's four edges a boat can sail in from to `to` in a
 *  straight line over open water. */
function entries(g: Game, to: Point): Point[] {
  const out: Point[] = [];
  const m = 70;
  for (let y = 60; y <= VIEW.height - 60; y += 70) for (const x of [-m, VIEW.width + m]) out.push({ x, y });
  for (let x = 80; x <= VIEW.width - 80; x += 90) for (const y of [-m, VIEW.height + m]) out.push({ x, y });
  return out.filter((p) => wetRun(g, p, to));
}

/** How many quarters of the compass (seen from `to`) a boat can sail in
 *  from. */
function sides(g: Game, to: Point): number {
  return new Set(entries(g, to).map((p) => Math.round(Math.atan2(p.y - to.y, p.x - to.x) / (Math.PI / 2)) & 3)).size;
}

/** The Repair Yard's repair ships: each from a different side (as far
 *  round from the others as the water allows, seen from the yard), to its
 *  place in a ring round the spot. With no way in from the screen's edges,
 *  one comes up on the spot itself (never in a closed cove). */
function yardRuns(g: Game, yard: Point, n: number): { from: Point; at: Point }[] {
  const E = EV['repair-yard'];
  const cands = entries(g, yard).sort((a, b) => dist(a.x, a.y, yard.x, yard.y) - dist(b.x, b.y, yard.x, yard.y));
  const bear = (p: Point) => Math.atan2(p.y - yard.y, p.x - yard.x);
  const gap = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  // The nearest first; then each the one furthest round from those picked
  // (a shorter run breaking a near tie).
  const picked: Point[] = cands.length ? [cands[0]] : [];
  while (picked.length < n && picked.length < cands.length) {
    let best = cands[0];
    let bs = -Infinity;
    for (const p of cands) {
      if (picked.includes(p)) continue;
      const spread = Math.min(...picked.map((o) => gap(bear(o), bear(p))));
      const score = Math.min(spread, E.apart * 1.6) - dist(p.x, p.y, yard.x, yard.y) / 2500;
      if (score > bs) {
        bs = score;
        best = p;
      }
    }
    picked.push(best);
  }
  return Array.from({ length: n }, (_, k) => {
    const from = picked[k];
    // Its place in the ring: on the side it came from (spread evenly if
    // it rises on the spot).
    const a = from ? bear(from) : (k / n) * Math.PI * 2;
    let at = { x: yard.x + Math.cos(a) * E.ring, y: yard.y + Math.sin(a) * E.ring };
    if (onLand(g, at.x, at.y) || (from && !wetRun(g, from, at))) at = yard;
    return { from: from ?? at, at };
  });
}

/** Is (x, y) inside a lane? */
function inLane(g: Game, p: Point): boolean {
  for (const ch of g.map.channels) {
    const L = laneLength(ch);
    for (let d = 0; d <= L; d += 40) {
      const o = laneAt(ch, d, 0);
      if (dist(o.x, o.y, p.x, p.y) < ch.halfWidth * 0.9) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// While it runs

function tick(g: Game, ev: EventRun): void {
  switch (ev.id) {
    case 'rush': {
      // The first sprinter over the line sets them all off.
      const line = ev.line!;
      const cruising = g.threats.filter((t) => !t.dead && t.kind === 'sprinter' && t.foe && t.foe.state === 0);
      if (cruising.some((t) => (t.y - line.y) * line.dir >= 0)) {
        for (const t of cruising) {
          t.foe!.state = 1;
          t.foe!.t = 0;
        }
        const lead = cruising[0];
        cue(g, 'foe.flare', lead.x, lead.y, { gain: 1 });
      }
      return;
    }
    case 'shield-wall': {
      // The block banks together at each signal (a horn and a flash).
      const E = EV['shield-wall'];
      const block = g.threats.filter((t) => !t.dead && ev.block.includes(t.id));
      if (!block.length) return;
      if (!ev.formed) {
        // Formed up (every drone in its place at the muster point), or
        // waited long enough: the block sets off, as one.
        const m = ev.muster!;
        const placed = block.every((t) => dist(t.x, t.y, m.x + (t.foe!.ox ?? 0), m.y + (t.foe!.oy ?? 0)) <= 14);
        if (!placed && ev.t < EVENT.breather + E.wait) return;
        if (ev.plan.some((p) => p.op === 'row')) return;
        ev.formed = true;
        for (const t of block) {
          const f = t.foe!;
          f.mx = undefined;
          f.my = undefined;
        }
        cue(g, 'foe.flare', m.x, m.y, { gain: 0.6 });
        return;
      }
      if (ev.signals >= E.banks.length) return;
      const way = block.reduce((a, t) => {
        const f = t.foe!;
        const total = Math.max(1, dist(f.sx ?? t.x, f.sy ?? t.y, t.x, t.y) + distToTarget(g, t));
        return a + dist(f.sx ?? t.x, f.sy ?? t.y, t.x, t.y) / total;
      }, 0) / block.length;
      if (way < E.banks[ev.signals]) return;
      ev.signals += 1;
      ev.signalT = ev.t;
      for (const t of block) {
        t.foe!.state = 1;
        t.foe!.t = 0;
      }
      const cx = block.reduce((a, t) => a + t.x, 0) / block.length;
      const cy = block.reduce((a, t) => a + t.y, 0) / block.length;
      addFx(g, 'burst', cx, cy, { life: 0.5, r: 110 });
      cue(g, 'foe.flare', cx, cy, { gain: 1 });
      return;
    }
    case 'fire-mission': {
      // A spotter keeps the hits it took between its turns.
      for (const who of ev.crew ?? []) {
        const sp = g.threats.find((t) => t.id === who.id && !t.dead);
        if (sp) who.hp = sp.hp;
      }
      return;
    }
    case 'escort-run': {
      // Each ring stripped, the heavy goes faster.
      const E = EV['escort-run'];
      const hv = g.threats.find((t) => t.id === ev.boss && !t.dead);
      if (!hv) return;
      const left = new Set(g.threats.filter((t) => !t.dead && t.kind === 'guard' && t.foe?.link === hv.id).map((t) => t.foe!.ring ?? 0));
      hv.speed = ev.bossSpeed * (E.slow + E.per * (E.rings.length - left.size));
      return;
    }
  }
}

function distToTarget(g: Game, t: Threat): number {
  const s = t.target === CARRIER_TARGET ? g.map.carrier : g.ships.find((o) => o.id === t.target) ?? g.map.carrier;
  return dist(t.x, t.y, s.x, s.y);
}

/** A kill in an event: the Rocket Convoy's column stalls behind a wreck; a
 *  Fire Mission spotter shot down is out of the mission (its turns go). */
export function eventFoeDown(g: Game, th: Threat): void {
  const ev = g.event;
  if (!ev) return;
  if (ev.id === 'fire-mission' && th.kind === 'spotter') {
    const who = ev.crew?.find((o) => o.id === th.id);
    if (who) {
      who.down = true;
      who.hp = 0;
    }
    return;
  }
  if (ev.id !== 'rocket-convoy' || th.kind !== 'rocketTruck') return;
  const E = EV['rocket-convoy'];
  const at = th.foe?.along ?? 0;
  for (const t of g.threats) {
    const f = t.foe;
    // Only the trucks behind it on its own road.
    if (t.dead || t === th || t.kind !== 'rocketTruck' || !f || f.path !== th.foe?.path || (f.along ?? 0) >= at) continue;
    if (f.state === 0) f.stall = Math.max(f.stall ?? 0, E.stall);
    else if (f.state === 1 && (f.wait ?? 0) > 0) f.wait = (f.wait ?? 0) + E.stall * 0.75;
  }
  addFx(g, 'text', th.x, th.y - 30, { life: 1, r: 0, text: 'STALLED' });
}

/** A Bombardment supply drone shot down: the pickup it drops (the next in
 *  turn: a repair, ammo, one of your weapons, a repair, …). Never a Nuke. */
export function eventCargo(g: Game): { kind: PickupKind; weapon?: AbilityId } {
  const ev = g.event;
  const E = EV.bombardment;
  const kind = E.cargo[(ev?.cargo ?? 0) % E.cargo.length];
  if (ev) ev.cargo += 1;
  const held = g.slots.filter((id) => (g.levels[id] ?? 0) > 0);
  if (kind === 'weapon') return held.length ? { kind: 'weapon', weapon: g.rng.drops.pick(held) } : { kind: 'ammo' };
  if (kind === 'ammo' && hasRule(g, 'noAmmo')) return { kind: 'repair' };
  return { kind };
}

/** A Hydra killed in an event: how many darts it splits into (Hydra Bloom:
 *  none before the line, three past it). */
export function hydraDarts(g: Game, th: Threat): number {
  const ev = g.event;
  if (!ev || ev.id !== 'hydra-bloom' || !ev.line) return FOE.hydra.darts;
  return (th.y - ev.line.y) * ev.line.dir >= 0 ? EV['hydra-bloom'].darts : 0;
}
