// Special event attacks in the sim (data/events.ts holds the table and the
// numbers; docs/design/v3-special-events-build.md says what each one does,
// docs/design/v3-events-round7.md the round 7 changes).
// An event is a wave of its own:
// - a map's event: after its ten normal waves (they stay as they were).
//   With ENDING.threeRuns on (round 7's experiment) it is three runs, waves
//   11 to 13, back to back, and the convoy and the carrier are restored to
//   full right before the first (restoreConvoy). Off: one run, wave 11.
// - a bonus event: a bonus wave inserted after a set wave on any campaign
//   map, once a run, when its condition holds (BONUS_EVENTS; Siren Field
//   after wave 6 with two passives held). It does not count as one of the
//   map's waves: the wave number stays, and the draft that wave earned
//   comes after it.
// - every wave of a Test Lab event card.
// It starts like any wave (its card, then a breather as long as a wave's
// lead-in), then its script launches in place of the raid planner. The wave
// ends as any wave does, once everything it sent is dealt with; the event
// is graded on what it cost (Clean, Held, Broken).
//
// game.ts calls in at: startWave (startEvent, restoreConvoy), each step
// (updateEvent), the wave's end (endEvent, bonusDue, startBonus) and a loss
// (endEvent), a kill (eventFoeDown), a shot (in fireAt, the Decoy Storm's
// count), the drop roll (eventDropWeights), a ship's speed
// (eventShipScale) and the lab's "Run it again" (rerunEvent). foes.ts reads
// the run's rules and features (the line, the fire's linger) where a foe
// behaves differently in an event. Pure and deterministic like the rest of
// the sim.

import { BONUS_EVENTS, EV, EVENT, EVENTS, EVENT_MAPS, EVENT_WAVE, endingRuns, gradeEvent, worstOutcome, type EventId, type EventOutcome, type EventRule } from '../data/events';
import { ROSTER } from '../data/roster';
import { FOE } from '../data/foes';
import { RULES, VIEW, isStructure, type PickupKind, type ThreatKind } from '../data/config';
import type { AbilityId } from '../data/abilities';
import type { Point } from '../data/maps';
import { laneAt, laneLength } from './lanes';
import { foeData, launchFoe, onLand, siegeSpotAt, wetRun } from './foes';
import { CARRIER_TARGET, addFx, addPickup, callCargoPlane, clamp, cue, dist, launchPlane, pathLength, pickBase, shipAhead, spawnThreat, targetable, type Game, type Ship, type Threat } from './game';

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
  /** A bonus event (inserted on any map), not the map's own. */
  bonus: boolean;
  /** Which run of the map's event this is, of how many (1 of 1 for a bonus
   *  event, a lab card's runs, or the ending with the experiment off). */
  run: number;
  runs: number;
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
  /** An armored block (the Shield Wall, Run the Canal's): its numbers, and
   *  when (event seconds) it set out. */
  blockSpec?: BlockSpec;
  blockT?: number;
  /** A heavy in rings of guards (the Escort Run, Siege of Vey's): its id,
   *  its own speed, and how much each ring stripped speeds it up. */
  escort?: { id: number; speed: number; slow: number; per: number; rings: number };
  /** Undertow: the ships slowed now (ids), for the barrages to fall on. */
  caught?: number[];
}

/** An armored block's numbers (the Shield Wall's, or a finale's smaller
 *  one). */
export interface BlockSpec {
  drones: number;
  cols: number;
  dx: number;
  dy: number;
  banks: readonly number[];
  spread: number;
  muster: number;
  form: number;
  wait: number;
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
  /** A bonus event (absent: the map's own, or a lab card's). */
  kind?: 'bonus';
  /** The ending's run, of how many (absent: one run). */
  run?: number;
  runs?: number;
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

/** The wave that wins the map: the tenth, or the last run of its event
 *  (the 13th with the three-run ending, the 11th without). */
export function lastWave(g: Game): number {
  return RULES.wavesToClear + (!g.lab && eventFor(g) ? endingRuns() : 0);
}

/** Is the wave starting now an event? (Every wave of a lab event card; in
 *  the campaign, each run of the map's event.) */
export function isEventWave(g: Game): boolean {
  const id = eventFor(g);
  if (!id) return false;
  if (g.lab) return true;
  return !g.endless && g.wave >= EVENT_WAVE && g.wave <= lastWave(g);
}

/** Which run of the map's event a campaign wave is (1 for wave 11). */
function runOf(g: Game): number {
  return g.lab ? 1 : g.wave - EVENT_WAVE + 1;
}

/** The campaign's next run of the map's event follows straight on, with no
 *  draft between (the three-run ending). */
export function nextRunDue(g: Game): boolean {
  return !g.lab && !g.endless && !!eventFor(g) && g.wave >= EVENT_WAVE && g.wave < lastWave(g);
}

/** The run's passive weapons held (roster.ts's passives, level 1 or more). */
export function passivesHeld(g: Game): AbilityId[] {
  return g.slots.filter((id) => (g.levels[id] ?? 0) > 0 && ROSTER[id]?.cat === 'passive');
}

/** A bonus event due as the wave just cleared ends: in the campaign (not
 *  Free Play, the lab or endless), on any map, once a run, after its wave,
 *  when its condition holds. */
export function bonusDue(g: Game): EventId | null {
  if (g.lab || g.freePlay || g.endless) return null;
  const held = g.slots.filter((id) => (g.levels[id] ?? 0) > 0);
  const ctx = { map: g.map.id, wave: g.wave, held, passives: passivesHeld(g).length };
  for (const b of BONUS_EVENTS) if (b.after === g.wave && !g.bonusDone.includes(b.id) && b.when(ctx)) return b.id;
  return null;
}

/** The bonus wave starts, straight after the wave it follows (that wave's
 *  draft comes after it). Its number stays that wave's. */
export function startBonus(g: Game, id: EventId): void {
  g.bonusDone.push(id);
  g.waveT = 0;
  g.phase = 'wave';
  g.offer = [];
  startEvent(g, id);
  cue(g, 'wave.start', VIEW.width / 2, VIEW.height / 2);
}

/** Round 7's experiment: right before the ending's first run, the convoy
 *  and the carrier are restored to full. The ships lost so far stop
 *  counting against the run's limit (they stay in its tally), every ship
 *  afloat is mended, and the carrier's hull is full. */
export function restoreConvoy(g: Game): void {
  g.lossBase = g.lost;
  g.carrierHp = Math.max(g.carrierHp, g.stats.carrierHp);
  for (const s of g.ships) s.hp = Math.max(s.hp, g.stats.shipHp);
  g.events.push({ kind: 'restore' });
  cue(g, 'tanker.home', g.map.carrier.x, g.map.carrier.y);
}

/** The three-run ending as a whole, so far: its worst run. */
export function endingOutcome(g: Game): EventOutcome | null {
  const runs = g.eventLog.filter((e) => e.kind !== 'bonus' && e.outcome !== 'rerun' && e.runs !== undefined && e.runs > 1);
  return worstOutcome(runs.map((e) => e.outcome as EventOutcome));
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

/** The wave starting now is the event (the map's, a lab card's, or the
 *  bonus `id`): its card, its script. */
export function startEvent(g: Game, id: EventId = eventFor(g)!): void {
  g.queue = [];
  g.raids = [];
  g.raiderQueue = [];
  g.event = newRun(g, id);
  g.events.push(cardEvent(g.event));
  cue(g, 'debut.sting', VIEW.width / 2, VIEW.height / 2);
}

/** The card's event: the event, its wave, a bonus, and the run. */
function cardEvent(ev: EventRun): Extract<Game['events'][number], { kind: 'special' }> {
  return { kind: 'special', id: ev.id, wave: ev.wave, ...(ev.bonus ? { bonus: true } : {}), ...(ev.runs > 1 ? { run: ev.run, runs: ev.runs } : {}) };
}

function newRun(g: Game, id: EventId): EventRun {
  const bonus = EVENTS[id].kind === 'bonus';
  const runs = bonus || g.lab ? 1 : endingRuns();
  const ev: EventRun = {
    id,
    wave: g.wave,
    bonus,
    run: runs > 1 ? clamp(runOf(g), 1, runs) : 1,
    runs,
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
  g.events.push({ kind: 'specialEnd', id: ev.id, outcome, bonus, ...(ev.bonus ? { bonusEvent: true } : {}), ...(ev.runs > 1 ? { run: ev.run, runs: ev.runs } : {}) });
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
    ...(ev.bonus ? { kind: 'bonus' as const } : {}),
    ...(ev.runs > 1 ? { run: ev.run, runs: ev.runs } : {}),
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
  g.events.push(cardEvent(g.event));
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

/** The Breakout's opening: no ammo drops until its Hydras come. */
function openingDry(g: Game): boolean {
  return hasRule(g, 'noAmmoOpening') && g.event!.id === 'breakout' && g.event!.t < EVENT.breather + EV.breakout.open;
}

/** Undertow: a ship inside an up beacon's ring sails at `slow` of its
 *  speed (1 otherwise, and in every other event). */
export function eventShipScale(g: Game, s: Ship): number {
  if (!g.event || !hasRule(g, 'undertow')) return 1;
  return caughtBy(g, s) ? EV.undertow.slow : 1;
}

/** The beacon (up, standing) whose ring holds this ship, if any. */
export function caughtBy(g: Game, s: { x: number; y: number }): Threat | undefined {
  return g.threats.find((t) => t.kind === 'lure' && !t.dead && (t.foe?.state ?? 0) >= 1 && t.foe?.r !== undefined && dist(t.x, t.y, s.x, s.y) <= t.foe.r);
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
  if (hasRule(g, 'noAmmo') || openingDry(g)) w.ammo = 0;
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
    case 'breakout': {
      // The opening (decoy swarms, sprint swarms among them, no ammo drops),
      // then a Hydra fan, then trucks down the shore road.
      const E = EV.breakout;
      return [
        ...steps(E.decoys, (k) => k * E.gap, 'decoys'),
        ...steps(E.sprintAt.length, (k) => E.sprintAt[k], 'sprint'),
        ...steps(E.fan, (k) => E.fanAt + k * E.fanGap, 'fan'),
        ...steps(E.roads * E.trucks, (k) => E.truckAt + Math.floor(k / E.trucks) * 1.5 + (k % E.trucks) * E.gapT, 'truck'),
      ];
    }
    case 'run-the-canal': {
      // A pack as the convoy comes in, gunships over the banks, thieves,
      // then an armored block.
      const E = EV['run-the-canal'];
      return [
        ...steps(1, () => 0, 'pack'),
        ...steps(E.helis, () => E.heliAt, 'heli'),
        ...steps(E.scav, (k) => E.scavAt + k * 0.7, 'scav'),
        ...steps(1, () => E.blockAt, 'block'),
        ...steps(E.swarms, (k) => 4 + k * 8, 'swarm'),
      ];
    }
    case 'undertow': {
      // Pairs of beacons by the lanes; barrages on the ships they hold.
      const E = EV.undertow;
      return [
        ...steps(E.at.length, (k) => E.at[k], 'beacons'),
        ...steps(E.barrages, (k) => E.from + k * E.every, 'barrage'),
        ...steps(E.swarms, (k) => 2 + k * 6, 'swarm'),
      ];
    }
    case 'siege-of-vey': {
      // The Repair Yard on the Citadel, then a guarded heavy and beacons,
      // then firebombs from every side.
      const E = EV['siege-of-vey'];
      ev.linger = E.linger;
      return [
        ...steps(1, () => 0, 'yard'),
        ...steps(1, () => E.escortAt, 'escort'),
        ...steps(1, () => E.escortAt + 1, 'lures'),
        ...steps(1, () => E.fireAt, 'ring'),
        ...steps(E.swarms, (k) => 4 + k * 9, 'swarm'),
      ];
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
        g.foe.marks.push({ id: g.nextId++, kind: 'periscope', x: p.x, y: p.y, t: 0, dur: S.warn, fireAt: S.fireAt + E.aim + k * E.stagger, spread, fast });
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
      if (s.op === 'row') shieldRow(g, ev, s.k);
      else armoredBlock(g, ev, EV['shield-wall']);
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
      const bs = liveBases(g, 'mothership');
      const bi = bs.reduce((m, i) => (dist(g.map.bases[i].x, g.map.bases[i].y, c.x, c.y) > dist(g.map.bases[m].x, g.map.bases[m].y, c.x, c.y) ? i : m), bs[0]);
      repairYard(g, ev, g.map.bases[bi], EV['repair-yard']);
      return;
    }
    case 'escort-run': {
      if (s.op === 'swarm') {
        swarm(g, ev, EV['escort-run'].size);
        return;
      }
      // One heavy at the carrier, slow, in three rings of guards.
      const bs = liveBases(g, 'heavy');
      const bi = bs.reduce((m, i) => (dist(g.map.bases[i].x, g.map.bases[i].y, c.x, c.y) > dist(g.map.bases[m].x, g.map.bases[m].y, c.x, c.y) ? i : m), bs[0]);
      const hv = escortHeavy(g, ev, g.map.bases[bi], EV['escort-run']);
      ev.boss = hv.id;
      ev.bossSpeed = ev.escort!.speed;
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
      firebombs(g, ev, n, E.slow);
      return;
    }
    case 'breakout': {
      const E = EV.breakout;
      if (s.op === 'decoys') {
        // A decoy swarm out of the next drone base, most of it fake.
        const bs = liveBases(g, 'drone');
        decoySwarm(g, ev, g.map.bases[bs[s.k % bs.length]], E.size, E.fakes);
      } else if (s.op === 'sprint') {
        const bs = liveBases(g, 'drone');
        const b = bs[(s.k + 1) % bs.length];
        launchFoe(g, { at: g.waveT, kind: 'sprinter', base: b }, g.map.bases[b]);
        sent(ev, 'sprinter', FOE.sprinter.size);
      } else if (s.op === 'fan') {
        // The fan: a Hydra out of each of the bases furthest from the
        // carrier in turn, a beat apart.
        const bs = [...liveBases(g)].sort((a, b) => dist(g.map.bases[b].x, g.map.bases[b].y, c.x, c.y) - dist(g.map.bases[a].x, g.map.bases[a].y, c.x, c.y));
        const b = bs[s.k % bs.length];
        const id0 = g.nextId;
        launchFoe(g, { at: g.waveT, kind: 'hydra', base: b }, g.map.bases[b]);
        for (const t of since(g, id0, 'hydra')) t.speed *= E.slow;
        sent(ev, 'hydra');
      } else truck(g, ev, Math.floor(s.k / E.trucks), s.k % E.trucks, E);
      return;
    }
    case 'run-the-canal': {
      const E = EV['run-the-canal'];
      if (s.op === 'pack') {
        // A pack of periscopes, each sub a spread, on a stagger.
        const S = FOE.torpedoSub;
        openWater(g, E.subs, 150).forEach((p, k) => {
          g.foe.marks.push({ id: g.nextId++, kind: 'periscope', x: p.x, y: p.y, t: 0, dur: S.warn, fireAt: S.fireAt + E.aim + k * E.stagger, spread: E.spread, fast: -1 });
          sent(ev, 'torpedoSub');
        });
        cue(g, 'sub.surface', VIEW.width / 2, VIEW.height / 2, { gain: 0.7 });
      } else if (s.op === 'heli') {
        // Over the far bank by each lock (or spread across the screen
        // without locks), firing in turn.
        const locks = g.map.locks ?? [];
        const x = locks.length ? (locks[s.k % locks.length].x0 + locks[s.k % locks.length].x1) / 2 : VIEW.width * (0.3 + (0.4 * s.k) / Math.max(1, E.helis - 1));
        heliOnStation(g, ev, x, s.k, E);
      } else if (s.op === 'scav') scavenger(g, ev, s.k);
      else if (s.op === 'block') armoredBlock(g, ev, { ...EV['shield-wall'], drones: E.drones, cols: E.cols, banks: E.banks });
      else if (s.op === 'row') shieldRow(g, ev, s.k);
      else swarm(g, ev, E.size);
      return;
    }
    case 'undertow': {
      const E = EV.undertow;
      if (s.op === 'beacons') undertowBeacons(g, ev, s.k);
      else if (s.op === 'barrage') {
        // Shells from the shore at the ships the rings hold; with none held,
        // a lone shell at any ship.
        const held = g.ships.filter((o) => caughtBy(g, o));
        const pool = held.length ? held : targetable(g);
        const bs = rng.shuffle(liveBases(g, 'ballistic'));
        const n = held.length ? E.shells : E.loose;
        for (let k = 0; k < n && pool.length && bs.length; k++) {
          g.queue.push({ at: g.waveT + k * 0.35, kind: 'ballistic', base: bs[k % bs.length], target: pool[k % pool.length].id });
          sent(ev, 'ballistic');
        }
        g.queue.sort((a, b) => a.at - b.at);
      } else swarm(g, ev, E.size);
      return;
    }
    case 'siege-of-vey': {
      const E = EV['siege-of-vey'];
      // The Citadel, or (shot down already) the base furthest from the
      // carrier.
      const core = g.map.bases.findIndex((b, i) => !!b.core && !g.baseDown[i]);
      const far = liveBases(g).reduce((m, i) => (dist(g.map.bases[i].x, g.map.bases[i].y, c.x, c.y) > dist(g.map.bases[m].x, g.map.bases[m].y, c.x, c.y) ? i : m), liveBases(g)[0]);
      const home = g.map.bases[core >= 0 ? core : far];
      if (s.op === 'yard') repairYard(g, ev, home, E);
      else if (s.op === 'escort') escortHeavy(g, ev, home, { hp: E.heavyHp, rings: E.rings, radii: E.radii, slow: E.slow, per: E.per });
      else if (s.op === 'lures') {
        for (const p of openWater(g, E.lures, 200)) {
          const th = spawnThreat(g, 'lure', p.x, p.y, 'sub');
          th.target = CARRIER_TARGET;
          th.foe = foeData();
          sent(ev, 'lure');
        }
      } else if (s.op === 'ring') firebombs(g, ev, E.fire, E.fslow);
      else swarm(g, ev, E.size);
      return;
    }
  }
}

/** Firebombs from every side: each launch base and both side edges of the
 *  screen, at `slow` of their speed. */
function firebombs(g: Game, ev: EventRun, n: number, slow: number): void {
  const c = g.map.carrier;
  const from: Point[] = [...liveBases(g).map((i) => g.map.bases[i]), { x: -20, y: clamp(c.y - 260, 120, VIEW.height - 160) }, { x: VIEW.width + 20, y: clamp(c.y - 260, 120, VIEW.height - 160) }];
  const order = g.rng.foes.shuffle(from.map((_, i) => i));
  for (let k = 0; k < n; k++) {
    const at = from[order[k % order.length]];
    const id0 = g.nextId;
    launchFoe(g, { at: g.waveT, kind: 'cloud', base: -1 }, at);
    for (const t of since(g, id0, 'cloud')) t.speed *= slow;
    sent(ev, 'cloud');
  }
}

/** A decoy swarm of `size` out of `at`, `fakes` of it fake, with the late
 *  strobe as always. */
function decoySwarm(g: Game, ev: EventRun, at: Point, size: number, fakes: number): void {
  const D = FOE.decoy;
  const kinds = g.rng.foes.shuffle(Array.from({ length: size }, (_, k): ThreatKind => (k < fakes ? 'decoy' : 'drone')));
  const mid = (size - 1) / 2;
  kinds.forEach((kind, k) => {
    const th = spawnThreat(g, kind, at.x + (k - mid) * D.spread, at.y + (k % 2) * D.stagger, 'base');
    th.slot = (k - mid) * D.slot;
    if (kind === 'decoy') th.foe = foeData();
    sent(ev, kind);
  });
}

/** A rocket truck down a shore road in a column (`col`: which road, `i`:
 *  its place), stopping behind the one ahead and raising after it. */
function truck(g: Game, ev: EventRun, col: number, i: number, E: { trucks: number; stop: number; spacing: number; stagger: number; salvos: number; hp: number; drive: number; back: number }): void {
  const path = roadFor(g, col);
  const L = pathLength(path);
  const th = spawnThreat(g, 'rocketTruck', path[0].x, path[0].y, 'truck');
  th.target = CARRIER_TARGET;
  th.heading = Math.atan2(path[1].y - path[0].y, path[1].x - path[0].x);
  th.hp = th.maxHp = E.hp;
  th.foe = foeData({ path, along: 0, n: E.salvos, stop: Math.max(60, L * E.stop - i * E.spacing), wait: i * E.stagger + col * E.stagger * 0.5, drive: E.drive, back: E.back });
  sent(ev, 'rocketTruck');
}

/** An attack helicopter flown in from the nearer side to hold at `x` over
 *  the lane's far side, opening fire `hold` s after it is called, the `k`th
 *  `turn` s after the first. */
function heliOnStation(g: Game, ev: EventRun, x: number, k: number, E: { hp: number; volleys: number; hold: number; turn: number }): void {
  const c = g.map.carrier;
  const ch = g.map.channels[0];
  const far = ch.y <= c.y ? -1 : 1;
  const y = clamp(ch.y + far * (ch.halfWidth + 95), 90, VIEW.height - 90);
  const side = x < VIEW.width / 2 ? 1 : -1;
  const th = spawnThreat(g, 'attackHeli', side > 0 ? -50 : VIEW.width + 50, y, 'air');
  th.target = CARRIER_TARGET;
  th.heading = side > 0 ? 0 : Math.PI;
  th.hp = th.maxHp = E.hp;
  th.foe = foeData({ px: x, py: y, vx: side * 120, vy: 0, hold: g.waveT + E.hold, stay: true, volleys: E.volleys, wait: k * E.turn });
  sent(ev, 'attackHeli');
}

/** A scavenger in from the `k`th side of the screen in turn (left, right,
 *  top, bottom), leaving the way it came. */
function scavenger(g: Game, ev: EventRun, k: number): void {
  const rng = g.rng.foes;
  const side = k % 4;
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
}

/** An armored block (`B`): rows from launch points along the far shore,
 *  forming up at a muster point, then flying at one ship as one. */
function armoredBlock(g: Game, ev: EventRun, B: BlockSpec): void {
  const c = g.map.carrier;
  ev.blockSpec = B;
  ev.blockT = ev.t;
  const rows = Math.ceil(B.drones / B.cols);
  const pts = shieldPoints(g, rows, B.spread);
  const pool = targetable(g);
  const ship = pool.length ? pool[Math.floor(pool.length / 2)] : null;
  const tp = ship ?? c;
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const d = Math.max(1, dist(mx, my, tp.x, tp.y));
  ev.rows = pts;
  ev.ship = ship ? ship.id : CARRIER_TARGET;
  ev.face = { x: (tp.x - mx) / d, y: (tp.y - my) / d };
  ev.muster = { x: clamp(mx + (tp.x - mx) * B.muster, 80, VIEW.width - 80), y: clamp(my + (tp.y - my) * B.muster, 80, VIEW.height - 80) };
  // The furthest row sets out now, the nearer ones in turn, so the rows
  // all reach the muster point together.
  const m = ev.muster;
  const far = Math.max(...pts.map((p) => dist(p.x, p.y, m.x, m.y)));
  const speed = shieldRow(g, ev, pts.findIndex((p) => dist(p.x, p.y, m.x, m.y) === far)) * B.form;
  pts.forEach((p, k) => {
    const lag = (far - dist(p.x, p.y, m.x, m.y)) / Math.max(1, speed);
    if (lag > 0) ev.plan.push({ at: ev.t + lag, op: 'row', k });
  });
  ev.plan.sort((a, b) => a.at - b.at);
}

/** A tough mothership out of `b` at the carrier, and repair ships sailing
 *  in from different sides to meet on its course (the Repair Yard; Siege of
 *  Vey's by the Citadel). */
function repairYard(g: Game, ev: EventRun, b: Point, E: { hp: number; speed: number; tenders: number; mend: number; every: number; sail: number; meet: number; ring: number; apart: number }): void {
  const c = g.map.carrier;
  const ms = spawnThreat(g, 'mothership', b.x, b.y, 'base');
  ms.hp = ms.maxHp = E.hp;
  ms.speed *= E.speed;
  ms.target = CARRIER_TARGET;
  ev.boss = ms.id;
  sent(ev, 'mothership');
  const yard = yardSpot(g, b, c, E.meet, E.ring);
  ev.yard = yard;
  for (const { from, at } of yardRuns(g, yard, E.tenders, E.ring, E.apart)) {
    const th = spawnThreat(g, 'tender', from.x, from.y, 'sub');
    th.target = CARRIER_TARGET;
    th.heading = Math.atan2(at.y - th.y, at.x - th.x);
    th.speed *= E.sail;
    th.foe = foeData({ link: -1, px: at.x, py: at.y, n: dist(from.x, from.y, at.x, at.y) < 2 ? 1 : 0, mend: E.mend, every: E.every });
    sent(ev, 'tender');
  }
}

/** A heavy at the carrier out of `b`, slow, in rings of guards (each ring
 *  stripped speeds it up). */
function escortHeavy(g: Game, ev: EventRun, b: Point, E: { hp: number; rings: readonly number[]; radii: readonly number[]; slow: number; per: number }): Threat {
  const c = g.map.carrier;
  const hv = spawnThreat(g, 'heavy', b.x, b.y, 'base');
  hv.hp = hv.maxHp = E.hp;
  hv.target = CARRIER_TARGET;
  hv.heading = Math.atan2(c.y - b.y, c.x - b.x);
  ev.escort = { id: hv.id, speed: hv.speed, slow: E.slow, per: E.per, rings: E.rings.length };
  hv.speed = hv.speed * E.slow;
  sent(ev, 'heavy');
  E.rings.forEach((n, ring) => {
    for (let k = 0; k < n; k++) {
      const t = spawnThreat(g, 'guard', b.x, b.y, 'base');
      t.target = CARRIER_TARGET;
      t.foe = foeData({ link: hv.id, n: k, of: n, r: E.radii[ring], ring });
      sent(ev, 'guard');
    }
  });
  return hv;
}

/** Undertow: a pair of beacons, one by each lane (a map with one lane: two
 *  along it), rising just off the lane's enemy-side edge ahead of the
 *  ships in it, each with its ring. */
function undertowBeacons(g: Game, ev: EventRun, k: number): void {
  const E = EV.undertow;
  const c = g.map.carrier;
  const lanes = g.map.channels.length > 1 ? g.map.channels.slice(0, 2) : [g.map.channels[0], g.map.channels[0]];
  lanes.forEach((ch, i) => {
    const L = laneLength(ch);
    // Ahead of the middle of that lane's convoy (`lead` px on from its
    // middle ship), so ships sail into the ring; with no ships in the lane,
    // `ahead` of the way along it.
    const lane = g.map.channels.indexOf(ch);
    const afloat = g.ships.filter((s) => s.channel === lane && s.d > 0).sort((a, b) => a.d - b.d);
    const mid = afloat[Math.floor(afloat.length / 2)];
    const at = mid ? clamp(mid.d + E.lead, L * 0.15, L * 0.85) : L * (E.ahead[k % E.ahead.length] + (lanes[0] === lanes[1] ? i * 0.2 : 0));
    // The side away from the carrier (the enemy's side of the lane), unless
    // that is land or off the screen.
    const sidesOf = [1, -1].map((sg) => laneAt(ch, at, sg * (ch.halfWidth + E.off)));
    const ok = (q: Point) => !onLand(g, q.x, q.y) && q.y >= 60 && q.y <= VIEW.height - 60;
    sidesOf.sort((a, b) => Number(ok(b)) - Number(ok(a)) || dist(b.x, b.y, c.x, c.y) - dist(a.x, a.y, c.x, c.y));
    const p = sidesOf[0];
    const th = spawnThreat(g, 'lure', clamp(p.x, 60, VIEW.width - 60), clamp(p.y, 60, VIEW.height - 60), 'sub');
    th.target = CARRIER_TARGET;
    th.foe = foeData({ r: E.ring, life: E.life });
    sent(ev, 'lure');
  });
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
function shieldPoints(g: Game, rows: number, spread: number): Point[] {
  const E = { spread };
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
  const E = ev.blockSpec ?? EV['shield-wall'];
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
function yardSpot(g: Game, from: Point, to: Point, meet: number, ring: number): Point {
  const E = { meet, ring };
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
function yardRuns(g: Game, yard: Point, n: number, ring: number, apart: number): { from: Point; at: Point }[] {
  const E = { ring, apart };
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
    case 'shield-wall':
    case 'run-the-canal': {
      // The block banks together at each signal (a horn and a flash).
      const E = ev.blockSpec;
      if (!E) return;
      const block = g.threats.filter((t) => !t.dead && ev.block.includes(t.id));
      if (!block.length) return;
      if (!ev.formed) {
        // Formed up (every drone in its place at the muster point), or
        // waited long enough: the block sets off, as one.
        const m = ev.muster!;
        const placed = block.every((t) => dist(t.x, t.y, m.x + (t.foe!.ox ?? 0), m.y + (t.foe!.oy ?? 0)) <= 14);
        if (!placed && ev.t < (ev.blockT ?? EVENT.breather) + E.wait) return;
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
    case 'escort-run':
    case 'siege-of-vey': {
      // Each ring stripped, the heavy goes faster.
      const E = ev.escort;
      if (!E) return;
      const hv = g.threats.find((t) => t.id === E.id && !t.dead);
      if (!hv) return;
      const left = new Set(g.threats.filter((t) => !t.dead && t.kind === 'guard' && t.foe?.link === hv.id).map((t) => t.foe!.ring ?? 0));
      hv.speed = E.speed * (E.slow + E.per * (E.rings - left.size));
      return;
    }
    case 'undertow': {
      // Which ships the rings hold (the barrages' targets, and the
      // renderer's drag ripples).
      ev.caught = g.ships.filter((s) => caughtBy(g, s)).map((s) => s.id);
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
  if ((ev.id !== 'rocket-convoy' && ev.id !== 'breakout') || th.kind !== 'rocketTruck') return;
  const E = ev.id === 'breakout' ? EV.breakout : EV['rocket-convoy'];
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
