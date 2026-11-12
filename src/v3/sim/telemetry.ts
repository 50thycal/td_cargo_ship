// MAP & CONVOY LAB TELEMETRY (docs/design/v3-map-convoy-lab-plan.md, slice 1;
// docs/design/v3-map-lab-slice0-1.md says what was built and measured).
//
// What happened in a run, where and why: every launch, every hit on a hull
// with what dealt it, every pickup from drop to end, every tap and convoy
// command, each ship from sailing to delivery or sinking, and low-rate
// position samples. A sidecar to the play log, never part of it.
//
// The rules it keeps:
// - It only watches. No RNG call, no `g.nextId`, nothing the sim reads back:
//   a game plays the same with it on or off (tests/v3/telemetry.test.ts
//   checks every step of whole runs).
// - Off (`g.tel === null`, the default) it costs one null check per hook.
// - It is a pure function of the build and the play log: replaying a log
//   with telemetry on makes the same sidecar the live run made, so nothing
//   has to be uploaded or stored with the log.
// - Coordinates are world units (VIEW, 1600 x 900), never screen pixels.
// - It checks itself: every step it compares the hull points its hit and
//   heal events add up to with the hulls as they are, and the pickups and
//   threats it was told of with the ones on the water. Anything it was not
//   told of becomes an `audit` event, so a gap shows in every run.
//
// Pure: no DOM, no storage.

import {
  BALLISTIC, BOSS, CARRIER, CARRIER_STRIKE, CLUSTER, DRONE, FASTBOAT, FLOW_STEPS, GUIDED, HEAVY, INTERCEPTOR, LOCK, MINE, MOTHERSHIP, PICKUPS, PLANE, POST, RAID,
  RULES, SHIP, SUB, SUPERSONIC, THREATS, TRUCK, VIEW, VIP, type PickupKind, type ThreatKind,
} from '../data/config';
import { FORMATIONS, type FormationId } from '../data/formations';
import type { CommandId, ConvoyPolicy, Obligation } from '../data/convoy';
import { AB, WEAPON, type AbilityId, type CardId } from '../data/abilities';
import { FOE, FOES, FOE_WAVE, HEAVY_FOES } from '../data/foes';
import { WAVE_TABLE } from '../data/waves';
import type { ArmoryLevels } from '../data/armory';
import type { MapDef, MapId } from '../data/maps';
import { ENDING, EV, EVENT, EVENT_MAPS, EVENT_WAVE, type EventId } from '../data/events';
import type { Game, LaunchOrigin, Pickup, Raider, Ship, TapResult, Tempo, Threat } from './game';
import type { FoeMark } from './foes';
import { lastWave } from './events';

import { laneLength } from './lanes';

/** Bump when an event's fields change meaning or a kind is removed. A
 *  reader must refuse a schema it does not know. */
export const TEL_SCHEMA = 1;

/** How often positions are sampled, in sim steps (60 a second). */
export const TEL_SAMPLING = { ship: 15, threat: 30 } as const;

/** The most events one run keeps (discrete events, then samples). A whole
 *  13-wave run is about 12,000 events and 4,000 samples. Past the cap the
 *  oldest samples go first; discrete events stop and `truncated` is set. */
export const TEL_LIMITS = { events: 150_000, samples: 40_000 } as const;

export type TelMode = 'campaign' | 'freePlay' | 'lab' | 'watch' | 'replay' | 'sim';

/** What kind of stretch of the run an event fell in. A map's event is
 *  `mapEvent` (runs 1 to 3, waves 11 to 13); a bonus wave is `bonusEvent`
 *  (its wave number stays the wave it followed); a Test Lab event card's
 *  wave is `labEvent`. */
export type TelPhaseKind = 'wave' | 'mapEvent' | 'bonusEvent' | 'labEvent';

export interface TelPhase {
  i: number;
  wave: number;
  kind: TelPhaseKind;
  event?: EventId;
  run?: number;
  runs?: number;
  /** First step and game time in it, and (once over) the last. */
  s0: number;
  t0: number;
  s1?: number;
  t1?: number;
  end?: 'cleared' | 'lost' | 'left';
  /** An event's grade, as the game gave it. */
  grade?: 'clean' | 'held' | 'broken';
  /** The run's counters as it began: the denominators. */
  lost0: number;
  delivered0: number;
  carrier0: number;
  afloat0: number;
  flow0: number;
  formation0: FormationId;
}

export interface TelHeader {
  schema: number;
  game: 'v3';
  logVersion: number;
  /** The play log this goes with (its id), and the build that made it. */
  runId: string;
  build: string;
  /** Hash of the map's data (lanes, bases, roads, scale) and of the rules
   *  and numbers the sim plays by (see `contentHash`). */
  mapHash: string;
  contentHash: string;
  map: MapId;
  frame: { w: number; h: number };
  seed: number;
  firstWave: number;
  tempo?: Tempo;
  mode: TelMode;
  /** 'human', or the bot persona's id. */
  player: string;
  input?: { touch: boolean; w: number; h: number; landscape: boolean };
  armory: ArmoryLevels;
  /** Weapon levels held as the run began (a skip-ahead or Free Play start). */
  levels: Partial<Record<AbilityId, number>>;
  /** The hulls and limits this run plays by. */
  rules: { shipHp: number; carrierHp: number; lossLimit: number; vipLoss: number; lastWave: number; eventWave: number; rack: number };
  /** The convoy controls in force: the current five flow steps and four
   *  formations, and where they stood at the start. */
  convoy: { policy: ConvoyPolicy; obligation?: Obligation; rev: number; flow: number; formation: FormationId; flowSteps: number; formations: FormationId[]; commands?: CommandId[] };
  /** A Test Lab run: its card, its length, and the card's version and
   *  test round (the lab's own versioning). */
  lab?: { card: string; length?: string; rev?: number; round?: number };
  freePlay?: boolean;
  sampling: { ship: number; threat: number; dt: number };
}

/** Who was hit: a cargo ship, the carrier, or an allied post. */
export type TelVictim = 's' | 'c' | 'p';

/** What hurt a threat: the gun, a weapon, a helper. */
export type HurtSrc =
  | 'gun' | 'seeker' | 'blast' | 'thermo' | 'shrapnel' | 'scatter' | 'boomerang' | 'railgun' | 'tesla' | 'cutter' | 'grapnel'
  | 'lance' | 'cadence' | 'droneScreen' | 'orbital' | 'gunship' | 'bomberWing' | 'reflect' | 'ram' | 'well' | 'burn' | 'flak'
  | 'airstrike' | 'nuke' | 'frigate' | 'aegis' | 'pointDefense' | 'battery' | 'broadside' | 'other';

interface Base {
  /** Sim step, game seconds (3 dp), and the index of its phase. */
  s: number;
  t: number;
  p: number;
}

export type TelEvent = Base &
  (
    | {
        k: 'thr+';
        id: number;
        kind: ThreatKind;
        x: number;
        y: number;
        /** Where it came from: a base (`base` its index), a truck or a sub
         *  (`from` the launcher's id), the air, another threat (`pid`). */
        o: LaunchOrigin | 'structure' | 'seen';
        base?: number;
        from?: number;
        pid?: number;
        /** Its target as it left: a ship's id, -1 the carrier, -2 none,
         *  -10 and below an allied post. */
        tg: number;
        hp: number;
        /** A ballistic's fixed landing point and flight time. */
        ix?: number;
        iy?: number;
        dur?: number;
        /** The raid of the wave it belongs to (index into the raid list). */
        raid?: number;
        paired?: 1;
        cargo?: 1;
        /** The same threat back on the board (a siege gun up from its
         *  hatch, a Spotter back for its next turn). */
        back?: 1;
      }
    | { k: 'thr-'; id: number; kind: ThreatKind; x: number; y: number; why: 'kill' | 'impact' | 'gone' }
    | {
        k: 'hurt';
        id: number;
        kind: ThreatKind;
        x: number;
        y: number;
        /** Hull points actually taken, and what is left. */
        dmg: number;
        left: number;
        by: HurtSrc;
        /** The weapon tagged on the shot, when there was one. */
        w?: AbilityId;
        /** The player's own hand (a tap, a held gesture), not a helper. */
        tap?: 1;
        kill?: 1;
      }
    | {
        k: 'hit';
        /** One number per impact: a blast that hits three hulls is three
         *  events with the same `imp`. */
        imp: number;
        vt: TelVictim;
        /** The ship's id, 0 for the carrier, the post's index. */
        vid: number;
        /** Where the victim was, and where the blow landed. */
        vx: number;
        vy: number;
        x: number;
        y: number;
        by: ThreatKind;
        /** The threat (or its launcher, for a shell or a rocket) that did
         *  it; absent when the sim could not say. */
        src?: number;
        /** The warhead's damage, what was dealt after formation armour and
         *  blast cuts, and the hull points actually removed. */
        amt: number;
        dealt: number;
        hp: number;
        left: number;
        /** Aimed at this hull (1) or splash from a neighbour's hit (0). */
        dir: 0 | 1;
        sunk?: 1;
        /** Stopped: by the Shield, or glancing off Armor Plating. */
        blk?: 'shield' | 'glance';
        /** A ship: its lane, how far along it, and the formation. */
        lane?: number;
        d?: number;
        form?: FormationId;
        vip?: 1;
      }
    | { k: 'heal'; vt: TelVictim; vid: number; hp: number; left: number; why: 'repair' | 'damageControl' | 'resupply' | 'tanker' | 'restore' | 'rebuilt' }
    | { k: 'ship+'; id: number; lane: number; slot: number; x: number; y: number; hp: number; vip?: 1; flow: number; form: FormationId; len: number }
    | { k: 'ship-'; id: number; why: 'delivered' | 'sunk'; x: number; y: number; d: number; lane: number; pts?: number; vip?: 1; by?: ThreatKind }
    | { k: 'pk+'; id: number; kind: PickupKind; w?: AbilityId; x: number; y: number; why: 'drop' | 'plane' | 'tanker' | 'lab' | 'event' | 'seen'; from?: number }
    | { k: 'pk-'; id: number; kind: PickupKind; w?: AbilityId; x: number; y: number; why: 'collected' | 'expired' | 'cleared' | 'gone'; age: number }
    | {
        k: 'tap';
        x: number;
        y: number;
        r: number;
        res: TapResult;
        /** What it went for: a threat's id or a pickup's. */
        thr?: number;
        pk?: number;
        fork?: 1;
        /** The weapon(s) loaded, and the rack before and after. */
        w?: AbilityId;
        w2?: AbilityId;
        a0: number;
        a1: number;
        /** A pickup under the finger that a Scavenger had locked. */
        locked?: 1;
      }
    | {
        k: 'in';
        /** `gesture`: a held weapon's shot (the Grapnel's hook, the Laser
         *  Cutter's swipe, a charged Lance): the game counts it as a tap. */
        what: 'press' | 'move' | 'release' | 'focus' | 'bring' | 'pick' | 'endless' | 'gesture';
        x?: number;
        y?: number;
        r?: number;
        on?: 0 | 1;
        card?: CardId;
        rep?: AbilityId;
        res?: TapResult;
        w?: AbilityId;
        thr?: number;
      }
    | {
        k: 'cmd';
        /** Flow, formation and the fork are today's controls; rush,
         *  disperse, hold and release are the lab's tactical commands
         *  (sim/convoy.ts). */
        what: 'flow' | 'formation' | 'fork' | 'rush' | 'disperse' | 'hold' | 'release';
        /** What was asked for and what stood before (a release: who
         *  ended the Hold, and the groups that were waiting). `ok` 0:
         *  nothing changed, and `why` says: already set (`same`), not this
         *  policy's to give (`policy`, `fixed`), `cooldown`, another
         *  posture running (`busy`), no ship afloat (`none`). */
        req: number | string;
        was: number | string;
        ok: 0 | 1;
        why?: string;
        /** The ships a Rush or a Disperse took hold of. */
        ids?: number[];
        /** Ships afloat it reaches, and seconds to the next sailing. */
        ships: number;
        next: number;
      }
    | { k: 'rdr'; id: number; kind: Raider['kind']; st: Raider['state'] | 'out'; x: number; y: number }
    | { k: 'mark+'; id: number; kind: FoeMark['kind']; x: number; y: number; dur: number; link?: number }
    | { k: 'mark-'; id: number; kind: FoeMark['kind']; x: number; y: number; done: 0 | 1 }
    | { k: 'warn'; what: 'raid' | 'aircraft'; x?: number; y?: number; theme?: string; bases?: number[]; lead: number; raid?: number; kind?: ThreatKind }
    | { k: 'env'; what: 'lock' | 'tide' | 'post' | 'base' | 'flare' | 'shield'; i?: number; st: string | number }
    | { k: 'audit'; what: 'hp' | 'ship' | 'pickup' | 'threat' | 'carrier' | 'post'; id: number; want?: number; got?: number }
  );

/** Position samples: `v` is flat, [id, x, y] for each ship afloat or each
 *  moving threat, to a tenth of a world unit. (Whole units were measured
 *  first: on Harbor Mouth, where a lane runs along a 50-unit grid line,
 *  rounding moved up to a third of a cell's ship-seconds into its
 *  neighbour.) A ship's hull at any moment is its `ship+` hull less its
 *  hits plus its heals. */
export interface TelSample extends Base {
  k: 'ship@' | 'thr@';
  v: number[];
}

/** The ledger: what the events add up to, kept as they are written. */
export interface TelTotals {
  spawned: number;
  kills: number;
  hits: number;
  blocked: number;
  /** Hull points removed, by victim. */
  hpShip: number;
  hpCarrier: number;
  hpPost: number;
  healed: number;
  sailed: number;
  sunk: number;
  /** Losses as the game counts them (a supertanker counts VIP.loss). */
  lost: number;
  delivered: number;
  pickups: { spawned: number; collected: number; expired: number; cleared: number; gone: number };
  taps: Record<TapResult, number>;
  commands: number;
  /** Things the sim did that no hook told of (0 in a healthy build). */
  audits: number;
}

export interface TelemetrySidecar {
  header: TelHeader;
  phases: TelPhase[];
  events: TelEvent[];
  samples: TelSample[];
  totals: TelTotals;
  /** Steps and seconds covered, and whether a cap cut anything. */
  steps: number;
  seconds: number;
  truncated: boolean;
  droppedSamples: number;
}

/** One impact, shared by every hull it hits. */
export interface TelImpact {
  imp: number;
  src?: number;
  x: number;
  y: number;
}

export interface TelMeta {
  runId: string;
  build: string;
  logVersion: number;
  firstWave: number;
  mode: TelMode;
  player: string;
  input?: TelHeader['input'];
  lab?: TelHeader['lab'];
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** FNV-1a over a string, as 8 hex digits. */
export function hashText(text: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** A map's data as one hash: its lanes, bases, roads, posts, scale and
 *  extras. A changed map makes a new hash, so two runs are only compared
 *  on the same water. */
export function mapHash(map: MapDef): string {
  return hashText(JSON.stringify(map));
}

let content = '';

/** The rules and numbers the sim plays by, as one hash: the data tables
 *  (threats, ships, flow, formations, raids, pickups, the new enemies, the
 *  events, the weapons, the wave table). Code is not in it: the build id
 *  and the baseline's digests cover that. */
export function contentHash(): string {
  if (!content) {
    content = hashText(
      JSON.stringify([
        RULES, SHIP, FLOW_STEPS, CARRIER, INTERCEPTOR, THREATS, VIP, LOCK, POST, FASTBOAT, MINE, BOSS, SUPERSONIC, HEAVY, CLUSTER, MOTHERSHIP, BALLISTIC, GUIDED,
        CARRIER_STRIKE, RAID, SUB, PLANE, TRUCK, DRONE, PICKUPS, FORMATIONS, FOE, FOES, FOE_WAVE, HEAVY_FOES, EV, EVENT, ENDING, EVENT_MAPS, AB, WEAPON, WAVE_TABLE,
      ]),
    );
  }
  return content;
}

/** Starts telemetry on a game (before its first step). */
export function attachTelemetry(g: Game, meta: TelMeta): Telemetry {
  const tel = new Telemetry(g, meta, contentHash());
  g.tel = tel;
  return tel;
}

export class Telemetry {
  readonly header: TelHeader;
  readonly phases: TelPhase[] = [];
  readonly events: TelEvent[] = [];
  samples: TelSample[] = [];
  readonly totals: TelTotals;
  truncated = false;
  droppedSamples = 0;

  private phase = -1;
  private phaseKey = '';
  private impacts = 0;
  /** Threats told of and still on the board (id → last place), every id
   *  ever told of, and those whose end was already written this step. */
  private live = new Map<number, { kind: ThreatKind; x: number; y: number }>();
  private known = new Set<number>();
  private ended = new Set<number>();
  /** Threats that landed a blow this step (they end as 'impact'). */
  private struck = new Set<number>();
  /** Spawn events still to be finished at the end of the step (the sim
   *  sets a new threat's target and launcher right after making it). */
  private fresh: [Extract<TelEvent, { k: 'thr+' }>, Threat][] = [];
  /** Ships: last hull points, and hull points hits and heals have moved
   *  since the last check. */
  private hull = new Map<number, number>();
  private moved = new Map<number, number>();
  private shipPos = new Map<number, { x: number; y: number; d: number; lane: number; vip: boolean }>();
  private carrier: number;
  private carrierMoved = 0;
  private posts: number[];
  private postMoved: number[];
  /** Pickups told of and still on the water. */
  private pk = new Map<number, { kind: PickupKind; w?: AbilityId; x: number; y: number; age: number }>();
  private pkEnded = new Set<number>();
  private raiders = new Map<number, Raider['state']>();
  private marks = new Map<number, { kind: FoeMark['kind']; x: number; y: number; dur: number; t: number }>();
  private raidsWarned = new Set<number>();
  private env: { locks: string[]; tide: boolean; posts: string[]; bases: boolean[]; flare: boolean; shield: boolean };
  /** The tap being worked out (the sim fills it in as it decides). */
  private tapCtx: { thr?: number; pk?: number; fork?: 1; locked?: 1 } | null = null;

  constructor(g: Game, meta: TelMeta, content: string) {
    this.header = {
      schema: TEL_SCHEMA,
      game: 'v3',
      logVersion: meta.logVersion,
      runId: meta.runId,
      build: meta.build,
      mapHash: mapHash(g.map),
      contentHash: content,
      map: g.map.id,
      frame: { w: VIEW.width, h: VIEW.height },
      seed: g.seed,
      firstWave: meta.firstWave,
      ...(g.tempo.waveLen !== 1 || g.tempo.stride !== 1 ? { tempo: { ...g.tempo } } : {}),
      mode: meta.mode,
      player: meta.player,
      ...(meta.input ? { input: meta.input } : {}),
      armory: { ...g.armory },
      levels: { ...g.levels },
      rules: { shipHp: g.stats.shipHp, carrierHp: g.stats.carrierHp, lossLimit: g.tempo.lossLimit, vipLoss: VIP.loss, lastWave: lastWave(g), eventWave: EVENT_WAVE, rack: g.stats.rack },
      convoy: {
        policy: g.convoy?.setup.policy ?? 'current',
        ...(g.convoy ? { obligation: g.convoy.setup.obligation, commands: g.convoy.setup.policy === 'tactical' ? [...g.convoy.def.commands] : [] } : {}),
        rev: g.convoy?.setup.rev ?? 1,
        flow: g.flow,
        formation: g.formation,
        flowSteps: FLOW_STEPS.length,
        formations: Object.keys(FORMATIONS) as FormationId[],
      },
      ...(meta.lab ? { lab: meta.lab } : {}),
      ...(g.freePlay ? { freePlay: true } : {}),
      sampling: { ship: TEL_SAMPLING.ship, threat: TEL_SAMPLING.threat, dt: 1 / 60 },
    };
    this.totals = {
      spawned: 0, kills: 0, hits: 0, blocked: 0, hpShip: 0, hpCarrier: 0, hpPost: 0, healed: 0, sailed: 0, sunk: 0, lost: 0, delivered: 0,
      pickups: { spawned: 0, collected: 0, expired: 0, cleared: 0, gone: 0 },
      taps: { fire: 0, pickup: 0, dry: 0, empty: 0 },
      commands: 0,
      audits: 0,
    };
    this.carrier = g.carrierHp;
    this.posts = g.posts.map((p) => p.hp);
    this.postMoved = g.posts.map(() => 0);
    this.env = {
      locks: g.lockState.map((l) => l.phase),
      tide: tideIn(g),
      posts: g.posts.map(postState),
      bases: [...g.baseDown],
      flare: g.flareT > 0,
      shield: g.shieldT > 0,
    };
    this.sync(g);
    // What already stands as the run begins: rigs, generators, the Citadel.
    for (const th of g.threats) this.see(g, th, 'structure');
    for (const s of g.ships) this.shipIn(g, s);
    for (const p of g.pickups) this.pickupIn(g, p, 'seen');
  }

  // -------------------------------------------------------------------------
  // The stream

  private base(g: Game): Base {
    return { s: g.steps, t: r3(g.t), p: this.phase };
  }

  private push(e: TelEvent): void {
    if (this.events.length >= TEL_LIMITS.events) {
      this.truncated = true;
      return;
    }
    this.events.push(e);
  }

  private audit(g: Game, what: Extract<TelEvent, { k: 'audit' }>['what'], id: number, want?: number, got?: number): void {
    this.totals.audits += 1;
    this.push({ ...this.base(g), k: 'audit', what, id, ...(want !== undefined ? { want: r3(want) } : {}), ...(got !== undefined ? { got: r3(got) } : {}) });
  }

  /** The stretch of the run in play now: a new one when the wave, the
   *  event or its run changes. */
  private sync(g: Game): void {
    // Between waves (a draft, the result) nothing new begins.
    if (g.phase !== 'wave') return;
    const ev = g.event;
    const key = `${g.wave}|${ev ? `${ev.id}|${ev.run}|${ev.bonus ? 1 : 0}|${ev.step}` : ''}`;
    if (key === this.phaseKey) return;
    this.close(g, 'cleared');
    this.phaseKey = key;
    this.phase = this.phases.length;
    const kind: TelPhaseKind = !ev ? 'wave' : g.lab ? 'labEvent' : ev.bonus ? 'bonusEvent' : 'mapEvent';
    this.phases.push({
      i: this.phase,
      wave: g.wave,
      kind,
      ...(ev ? { event: ev.id, run: ev.run, runs: ev.runs } : {}),
      s0: g.steps,
      t0: r3(g.t),
      lost0: g.lost,
      delivered0: g.delivered,
      carrier0: g.carrierHp,
      afloat0: g.ships.length,
      flow0: g.flow,
      formation0: g.formation,
    });
    this.raidsWarned.clear();
  }

  private close(g: Game, end: NonNullable<TelPhase['end']>): void {
    const ph = this.phases[this.phase];
    if (!ph || ph.end) return;
    ph.s1 = g.steps;
    ph.t1 = r3(g.t);
    ph.end = end;
    // An event's grade, from the run's own record of it.
    const rec = ph.event ? g.eventLog.find((e) => e.id === ph.event && e.step <= ph.s0 + 1 && e.end >= ph.s0 && e.wave === ph.wave && e.outcome !== 'rerun' && (e.run ?? 1) === (ph.run ?? 1)) : undefined;
    if (rec && rec.outcome !== 'rerun') ph.grade = rec.outcome;
  }

  // -------------------------------------------------------------------------
  // The step (game.ts calls `before` and `after` round each one)

  before(g: Game): void {
    this.sync(g);
    this.check(g);
  }

  after(g: Game): void {
    // A new threat's target and launcher are set right after it is made:
    // read them now.
    for (const [e, th] of this.fresh) {
      e.tg = th.target;
      e.hp = th.hp;
      const from = th.src ?? th.from;
      if (from !== undefined) e.from = from;
      if (th.paired) e.paired = 1;
      if (th.cargo) e.cargo = 1;
      if (th.kind === 'ballistic') {
        e.ix = r1(th.ix);
        e.iy = r1(th.iy);
        e.dur = r3(th.dur);
      }
    }
    this.fresh.length = 0;
    this.scan(g);
    this.check(g);
    this.watch(g);
    this.sample(g);
    this.struck.clear();
    this.ended.clear();
    this.pkEnded.clear();
    if (g.phase !== 'wave') this.close(g, g.phase === 'lost' ? 'lost' : 'cleared');
    else this.sync(g);
  }

  /** The run was left (a quit, the app closed): the open phase ends here. */
  leave(g: Game): void {
    this.close(g, 'left');
  }

  /** Threats, pickups, raiders and warnings on the board against what the
   *  hooks told of. */
  private scan(g: Game): void {
    const now = new Set<number>();
    for (const th of g.threats) {
      if (th.dead) continue;
      now.add(th.id);
      const l = this.live.get(th.id);
      if (l) {
        l.x = th.x;
        l.y = th.y;
      } else this.see(g, th, 'seen');
    }
    for (const [id, l] of this.live) {
      if (now.has(id)) continue;
      this.live.delete(id);
      if (this.ended.has(id)) continue;
      this.push({ ...this.base(g), k: 'thr-', id, kind: l.kind, x: r1(l.x), y: r1(l.y), why: this.struck.has(id) ? 'impact' : 'gone' });
    }
    const pks = new Set<number>();
    for (const p of g.pickups) {
      pks.add(p.id);
      const k = this.pk.get(p.id);
      if (k) {
        k.x = p.x;
        k.y = p.y;
        k.age = p.age;
      } else this.pickupIn(g, p, 'seen');
    }
    for (const [id, k] of this.pk) {
      if (pks.has(id)) continue;
      this.pk.delete(id);
      if (this.pkEnded.has(id)) continue;
      this.totals.pickups.gone += 1;
      this.totals.audits += 1;
      this.push({ ...this.base(g), k: 'pk-', id, kind: k.kind, ...(k.w ? { w: k.w } : {}), x: r1(k.x), y: r1(k.y), why: 'gone', age: r3(k.age) });
    }
    for (const r of g.raiders) {
      if (this.raiders.get(r.id) === r.state) continue;
      this.raiders.set(r.id, r.state);
      this.push({ ...this.base(g), k: 'rdr', id: r.id, kind: r.kind, st: r.state, x: r1(r.x), y: r1(r.y) });
    }
    if (this.raiders.size > g.raiders.length) {
      const up = new Set(g.raiders.map((r) => r.id));
      for (const id of [...this.raiders.keys()]) if (!up.has(id)) this.raiders.delete(id);
    }
    const marks = new Set<number>();
    for (const m of g.foe.marks) {
      marks.add(m.id);
      const k = this.marks.get(m.id);
      if (k) k.t = m.t;
      else {
        this.marks.set(m.id, { kind: m.kind, x: m.x, y: m.y, dur: m.dur, t: m.t });
        const link = m.link ?? m.src;
        this.push({ ...this.base(g), k: 'mark+', id: m.id, kind: m.kind, x: r1(m.x), y: r1(m.y), dur: r3(m.dur), ...(link !== undefined ? { link } : {}) });
      }
    }
    for (const [id, k] of this.marks) {
      if (marks.has(id)) continue;
      this.marks.delete(id);
      // Ran its time (it fired, landed, came up) or was taken off early.
      this.push({ ...this.base(g), k: 'mark-', id, kind: k.kind, x: r1(k.x), y: r1(k.y), done: k.t + 2 / 60 >= k.dur ? 1 : 0 });
    }
  }

  /** Hull points: what the hit and heal events moved against the hulls as
   *  they are. */
  private check(g: Game): void {
    const afloat = new Set<number>();
    for (const s of g.ships) {
      afloat.add(s.id);
      const was = this.hull.get(s.id);
      if (was === undefined) {
        // A ship no hook told of.
        this.audit(g, 'ship', s.id);
        this.shipIn(g, s);
        continue;
      }
      const want = was + (this.moved.get(s.id) ?? 0);
      if (Math.abs(want - s.hp) > 1e-6) this.audit(g, 'hp', s.id, want, s.hp);
      this.hull.set(s.id, s.hp);
      const pos = this.shipPos.get(s.id)!;
      pos.x = s.x;
      pos.y = s.y;
      pos.d = s.d;
    }
    for (const id of [...this.hull.keys()]) {
      if (afloat.has(id)) continue;
      // Gone with no sinking or delivery written.
      this.audit(g, 'ship', id);
      this.hull.delete(id);
      this.shipPos.delete(id);
    }
    this.moved.clear();
    if (Math.abs(this.carrier + this.carrierMoved - g.carrierHp) > 1e-6) this.audit(g, 'carrier', 0, this.carrier + this.carrierMoved, g.carrierHp);
    this.carrier = g.carrierHp;
    this.carrierMoved = 0;
    g.posts.forEach((p, i) => {
      if (Math.abs(this.posts[i] + this.postMoved[i] - p.hp) > 1e-6) this.audit(g, 'post', i, this.posts[i] + this.postMoved[i], p.hp);
      this.posts[i] = p.hp;
      this.postMoved[i] = 0;
    });
  }

  /** The map's own mechanics and the warnings on screen. */
  private watch(g: Game): void {
    const e = this.env;
    g.lockState.forEach((l, i) => {
      if (e.locks[i] === l.phase) return;
      e.locks[i] = l.phase;
      this.push({ ...this.base(g), k: 'env', what: 'lock', i, st: l.phase });
    });
    const tide = tideIn(g);
    if (tide !== e.tide) {
      e.tide = tide;
      this.push({ ...this.base(g), k: 'env', what: 'tide', st: tide ? 'high' : 'low' });
    }
    g.posts.forEach((p, i) => {
      const st = postState(p);
      if (e.posts[i] === st) return;
      e.posts[i] = st;
      this.push({ ...this.base(g), k: 'env', what: 'post', i, st });
    });
    g.baseDown.forEach((down, i) => {
      if (e.bases[i] === down) return;
      e.bases[i] = down;
      this.push({ ...this.base(g), k: 'env', what: 'base', i, st: down ? 'down' : 'up' });
    });
    const flare = g.flareT > 0;
    if (flare !== e.flare) {
      e.flare = flare;
      this.push({ ...this.base(g), k: 'env', what: 'flare', st: flare ? 'on' : 'off' });
    }
    const shield = g.shieldT > 0;
    if (shield !== e.shield) {
      e.shield = shield;
      this.push({ ...this.base(g), k: 'env', what: 'shield', st: shield ? 'on' : 'off' });
    }
    // A raid's warning goes up RAID.warn s before it starts.
    if (g.phase === 'wave') {
      g.raids.forEach((raid, i) => {
        if (this.raidsWarned.has(i) || raid.at - g.waveT > RAID.warn) return;
        this.raidsWarned.add(i);
        this.push({ ...this.base(g), k: 'warn', what: 'raid', raid: i, theme: raid.theme, bases: [...raid.bases], lead: r3(Math.max(0, raid.at - g.waveT)) });
      });
    }
  }

  private sample(g: Game): void {
    const ship = g.steps % TEL_SAMPLING.ship === 0 && g.ships.length > 0;
    const thr = g.steps % TEL_SAMPLING.threat === 0 && g.threats.length > 0;
    if (!ship && !thr) return;
    if (ship) {
      const v: number[] = [];
      for (const s of g.ships) v.push(s.id, r1(s.x), r1(s.y));
      this.samples.push({ ...this.base(g), k: 'ship@', v });
    }
    if (thr) {
      const v: number[] = [];
      for (const th of g.threats) if (!th.dead && th.speed > 0) v.push(th.id, r1(th.x), r1(th.y));
      if (v.length) this.samples.push({ ...this.base(g), k: 'thr@', v });
    }
    if (this.samples.length > TEL_LIMITS.samples) {
      const cut = this.samples.length - TEL_LIMITS.samples;
      this.samples = this.samples.slice(cut);
      this.droppedSamples += cut;
    }
  }

  // -------------------------------------------------------------------------
  // Threats

  /** A threat leaves a launcher (`spawnThreat`), or splits off another
   *  (`child`). */
  spawn(g: Game, th: Threat, origin: LaunchOrigin | 'structure', parent?: Threat): void {
    this.see(g, th, origin, parent);
  }

  private see(g: Game, th: Threat, o: Extract<TelEvent, { k: 'thr+' }>['o'], parent?: Threat): void {
    if (this.live.has(th.id)) return;
    const back = this.known.has(th.id);
    this.known.add(th.id);
    this.live.set(th.id, { kind: th.kind, x: th.x, y: th.y });
    if (!back) this.totals.spawned += 1;
    let base: number | undefined = th.base;
    if (base === undefined && o === 'base') {
      const i = g.map.bases.findIndex((b) => b.x === th.x && b.y === th.y);
      if (i >= 0) base = i;
    }
    let raid: number | undefined;
    if (!g.event && o !== 'child' && o !== 'structure') {
      for (let i = 0; i < g.raids.length; i++) if (g.raids[i].at <= g.waveT + 0.01) raid = i;
    }
    const from = th.src ?? th.from;
    const e: Extract<TelEvent, { k: 'thr+' }> = {
      ...this.base(g),
      k: 'thr+',
      id: th.id,
      kind: th.kind,
      x: r1(th.x),
      y: r1(th.y),
      o,
      ...(base !== undefined ? { base } : {}),
      ...(from !== undefined ? { from } : {}),
      ...(parent ? { pid: parent.id } : {}),
      tg: th.target,
      hp: th.hp,
      ...(raid !== undefined ? { raid } : {}),
      ...(back ? { back: 1 as const } : {}),
    };
    this.push(e);
    if (o !== 'seen') this.fresh.push([e, th]);
    else if (o === 'seen' && !back) {
      // On the board with no launch told of: a gap in the hooks.
      this.audit(g, 'threat', th.id);
    }
  }

  /** A threat took damage (`damageThreat`, after the hull points came off). */
  hurt(g: Game, th: Threat, before: number, by: HurtSrc, weapon?: AbilityId): void {
    const left = Math.max(0, th.hp);
    const kill = th.dead;
    if (kill) {
      this.totals.kills += 1;
      this.ended.add(th.id);
    }
    this.push({
      ...this.base(g),
      k: 'hurt',
      id: th.id,
      kind: th.kind,
      x: r1(th.x),
      y: r1(th.y),
      dmg: r3(before - left),
      left: r3(left),
      by,
      ...(weapon ? { w: weapon } : {}),
      ...(g.foe.byTap ? { tap: 1 as const } : {}),
      ...(kill ? { kill: 1 as const } : {}),
    });
    if (kill) this.push({ ...this.base(g), k: 'thr-', id: th.id, kind: th.kind, x: r1(th.x), y: r1(th.y), why: 'kill' });
  }

  // -------------------------------------------------------------------------
  // Hulls

  /** One blow lands at (x, y), dealt by `src` (a threat, or the launcher
   *  of a shell or a rocket): every hull it hits shares the impact. */
  impact(src: number | undefined, x: number, y: number): TelImpact {
    if (src !== undefined) this.struck.add(src);
    return { imp: ++this.impacts, ...(src !== undefined ? { src } : {}), x, y };
  }

  private hitBase(g: Game, imp: TelImpact | undefined, vt: TelVictim, vid: number, vx: number, vy: number, by: ThreatKind) {
    const at = imp ?? this.impact(undefined, vx, vy);
    return { ...this.base(g), k: 'hit' as const, imp: at.imp, vt, vid, vx: r1(vx), vy: r1(vy), x: r1(at.x), y: r1(at.y), by, ...(at.src !== undefined ? { src: at.src } : {}) };
  }

  private shipFields(g: Game, s: Ship) {
    return { lane: s.channel, d: r1(s.d), form: g.formation, ...(s.vip ? { vip: 1 as const } : {}) };
  }

  /** A hit on a ship (`damageShip`, after the hull points came off).
   *  `before` is its hull as the blow landed. */
  shipHit(g: Game, s: Ship, amt: number, dealt: number, before: number, by: ThreatKind, direct: boolean, imp?: TelImpact): void {
    const hp = before - Math.max(0, s.hp);
    const sunk = s.hp <= 0;
    this.totals.hits += 1;
    this.totals.hpShip += hp;
    this.moved.set(s.id, (this.moved.get(s.id) ?? 0) - dealt);
    this.push({
      ...this.hitBase(g, imp, 's', s.id, s.x, s.y, by),
      amt,
      dealt,
      hp: r3(hp),
      left: r3(Math.max(0, s.hp)),
      dir: direct ? 1 : 0,
      ...(sunk ? { sunk: 1 as const } : {}),
      ...this.shipFields(g, s),
    });
    if (!sunk) return;
    this.totals.sunk += 1;
    this.totals.lost += s.vip ? VIP.loss : 1;
    this.hull.delete(s.id);
    this.moved.delete(s.id);
    this.shipPos.delete(s.id);
    this.push({ ...this.base(g), k: 'ship-', id: s.id, why: 'sunk', x: r1(s.x), y: r1(s.y), d: r1(s.d), lane: s.channel, by, ...(s.vip ? { vip: 1 as const } : {}) });
  }

  /** A blow that took nothing: the Shield stopped it, or it glanced off. */
  shipBlocked(g: Game, s: Ship, amt: number, by: ThreatKind, direct: boolean, how: 'shield' | 'glance', imp?: TelImpact): void {
    this.totals.blocked += 1;
    this.push({ ...this.hitBase(g, imp, 's', s.id, s.x, s.y, by), amt, dealt: 0, hp: 0, left: s.hp, dir: direct ? 1 : 0, blk: how, ...this.shipFields(g, s) });
  }

  carrierHit(g: Game, amt: number, before: number, by: ThreatKind, imp?: TelImpact, how?: 'shield' | 'glance'): void {
    const c = g.map.carrier;
    const hp = how ? 0 : before - g.carrierHp;
    if (how) this.totals.blocked += 1;
    else {
      this.totals.hits += 1;
      this.totals.hpCarrier += hp;
      this.carrierMoved -= hp;
    }
    this.push({ ...this.hitBase(g, imp, 'c', 0, c.x, c.y, by), amt, dealt: how ? 0 : amt, hp: r3(hp), left: g.carrierHp, dir: 1, ...(how ? { blk: how } : {}) });
  }

  postHit(g: Game, i: number, amt: number, before: number, by: ThreatKind, imp?: TelImpact, how?: 'shield'): void {
    const def = g.map.posts![i];
    const left = Math.max(0, g.posts[i].hp);
    const hp = how ? 0 : before - left;
    if (how) this.totals.blocked += 1;
    else {
      this.totals.hits += 1;
      this.totals.hpPost += hp;
      this.postMoved[i] -= hp;
    }
    this.push({ ...this.hitBase(g, imp, 'p', i, def.x, def.y, by), amt, dealt: how ? 0 : amt, hp: r3(hp), left, dir: 1, ...(how ? { blk: how } : {}), ...(!how && left <= 0 ? { sunk: 1 as const } : {}) });
  }

  /** Hull points put back: `hp` of them, on a ship, the carrier or a post. */
  heal(g: Game, vt: TelVictim, vid: number, hp: number, left: number, why: Extract<TelEvent, { k: 'heal' }>['why']): void {
    // (A Resupply card sets a supertanker's bigger hull DOWN to a cargo
    // ship's: a negative heal, so the hull still adds up.)
    if (hp === 0) return;
    this.totals.healed += hp;
    if (vt === 's') this.moved.set(vid, (this.moved.get(vid) ?? 0) + hp);
    else if (vt === 'c') this.carrierMoved += hp;
    else this.postMoved[vid] += hp;
    this.push({ ...this.base(g), k: 'heal', vt, vid, hp: r3(hp), left: r3(left), why });
  }

  /** Every ship afloat and the carrier set to `to` hull points or more
   *  (a Resupply card, the restore before the ending): call before they
   *  are, with what each will be. */
  healAll(g: Game, shipHp: (s: Ship) => number, carrierHp: number, why: 'resupply' | 'restore'): void {
    for (const s of g.ships) this.heal(g, 's', s.id, shipHp(s) - s.hp, shipHp(s), why);
    this.heal(g, 'c', 0, carrierHp - g.carrierHp, carrierHp, why);
  }

  // -------------------------------------------------------------------------
  // Ships

  shipIn(g: Game, s: Ship): void {
    if (this.hull.has(s.id)) return;
    this.hull.set(s.id, s.hp);
    this.shipPos.set(s.id, { x: s.x, y: s.y, d: s.d, lane: s.channel, vip: !!s.vip });
    this.totals.sailed += 1;
    this.push({
      ...this.base(g), k: 'ship+', id: s.id, lane: s.channel, slot: s.slot, x: r1(s.x), y: r1(s.y), hp: s.hp,
      ...(s.vip ? { vip: 1 as const } : {}), flow: g.flow, form: g.formation, len: r1(laneLength(g.map.channels[s.channel])),
    });
  }

  /** A supertanker is a ship made, then given its hull: tell of the change. */
  shipHull(s: Ship): void {
    if (this.hull.has(s.id)) this.hull.set(s.id, s.hp);
  }

  shipDelivered(g: Game, s: Ship, pts: number): void {
    this.totals.delivered += 1;
    this.hull.delete(s.id);
    this.moved.delete(s.id);
    this.shipPos.delete(s.id);
    this.push({ ...this.base(g), k: 'ship-', id: s.id, why: 'delivered', x: r1(s.x), y: r1(s.y), d: r1(s.d), lane: s.channel, pts, ...(s.vip ? { vip: 1 as const } : {}) });
  }

  // -------------------------------------------------------------------------
  // Pickups

  pickupIn(g: Game, p: Pickup, why: Extract<TelEvent, { k: 'pk+' }>['why'], from?: number): void {
    if (this.pk.has(p.id)) return;
    this.pk.set(p.id, { kind: p.kind, ...(p.weapon ? { w: p.weapon } : {}), x: p.x, y: p.y, age: p.age });
    this.totals.pickups.spawned += 1;
    if (why === 'seen') this.totals.audits += 1;
    this.push({ ...this.base(g), k: 'pk+', id: p.id, kind: p.kind, ...(p.weapon ? { w: p.weapon } : {}), x: r1(p.x), y: r1(p.y), why, ...(from !== undefined ? { from } : {}) });
  }

  pickupOut(g: Game, p: Pickup, why: 'collected' | 'expired' | 'cleared'): void {
    if (!this.pk.has(p.id)) this.pickupIn(g, p, 'seen');
    this.pk.delete(p.id);
    this.pkEnded.add(p.id);
    this.totals.pickups[why] += 1;
    if (why === 'collected' && this.tapCtx) this.tapCtx.pk = p.id;
    this.push({ ...this.base(g), k: 'pk-', id: p.id, kind: p.kind, ...(p.weapon ? { w: p.weapon } : {}), x: r1(p.x), y: r1(p.y), why, age: r3(p.age) });
  }

  // -------------------------------------------------------------------------
  // The player's hand

  /** A tap is being worked out: the sim says what it went for as it finds
   *  out (`tapOn`), and how it ended (`tapEnd`). */
  tapStart(): void {
    this.tapCtx = {};
  }

  tapOn(what: { thr?: number; fork?: 1; locked?: 1 }): void {
    if (this.tapCtx) Object.assign(this.tapCtx, what);
  }

  tapEnd(g: Game, x: number, y: number, r: number, res: TapResult, ammo0: number, w?: AbilityId, w2?: AbilityId): void {
    const c = this.tapCtx ?? {};
    this.tapCtx = null;
    this.totals.taps[res] += 1;
    // A pickup or the fork took the tap: the threat under it was not shot.
    const thr = res === 'pickup' ? undefined : c.thr;
    this.push({
      ...this.base(g), k: 'tap', x, y, r, res,
      ...(thr !== undefined ? { thr } : {}),
      ...(c.pk !== undefined ? { pk: c.pk } : {}),
      ...(c.fork ? { fork: 1 as const } : {}),
      ...(w ? { w } : {}),
      ...(w2 ? { w2 } : {}),
      a0: r3(ammo0),
      a1: r3(g.ammo),
      ...(c.locked ? { locked: 1 as const } : {}),
    });
  }

  input(g: Game, what: Extract<TelEvent, { k: 'in' }>['what'], f: Omit<Extract<TelEvent, { k: 'in' }>, keyof Base | 'k' | 'what'> = {}): void {
    this.sync(g);
    this.push({ ...this.base(g), k: 'in', what, ...f });
  }

  /** A gesture weapon's shot went off (or found the rack empty): the game
   *  counts it with the taps. */
  gesture(g: Game, res: 'fire' | 'dry', x: number, y: number, w: AbilityId, thr?: number): void {
    this.totals.taps[res] += 1;
    this.push({ ...this.base(g), k: 'in', what: 'gesture', x: r1(x), y: r1(y), res, w, ...(thr !== undefined ? { thr } : {}) });
  }

  /** A convoy command: what was asked, what stood, and whether anything
   *  changed. */
  command(g: Game, what: Extract<TelEvent, { k: 'cmd' }>['what'], req: number | string, was: number | string, ok: boolean, why?: string, ids?: number[]): void {
    this.sync(g);
    this.totals.commands += 1;
    this.push({
      ...this.base(g), k: 'cmd', what, req, was, ok: ok ? 1 : 0, ...(ok ? {} : { why: why ?? 'same' }), ...(ids ? { ids } : {}),
      ships: g.ships.filter((s) => !s.vip).length,
      next: r3(Math.max(0, g.spawnT)),
    });
  }

  /** An aircraft's warning arrow goes up. */
  warnAircraft(g: Game, kind: ThreatKind, x: number, y: number, lead: number): void {
    this.push({ ...this.base(g), k: 'warn', what: 'aircraft', kind, x: r1(x), y: r1(y), lead: r3(lead) });
  }

  // -------------------------------------------------------------------------
  // Out

  /** The run so far as a sidecar (a copy: later events don't leak in). */
  sidecar(g: Game): TelemetrySidecar {
    return {
      header: this.header,
      phases: this.phases.map((p) => ({ ...p })),
      events: this.events.slice(),
      samples: this.samples.slice(),
      totals: { ...this.totals, pickups: { ...this.totals.pickups }, taps: { ...this.totals.taps } },
      steps: g.steps,
      seconds: r3(g.t),
      truncated: this.truncated,
      droppedSamples: this.droppedSamples,
    };
  }
}

function tideIn(g: Game): boolean {
  const t = g.map.tide;
  return !t || g.t % (t.high + t.low) < t.high;
}

function postState(p: { hp: number; downT: number; lost: boolean }): string {
  return p.lost ? 'lost' : p.downT > 0 ? 'down' : 'up';
}

// ---------------------------------------------------------------------------
// Reading a sidecar

/** A sidecar's events and samples as one hash: two runs that made the same
 *  one did the same things at the same steps. */
export function sidecarDigest(sc: TelemetrySidecar): string {
  return hashText(JSON.stringify([sc.phases, sc.events, sc.samples, sc.totals]));
}

/** Pickups still on the water as the sidecar ends. */
export function pickupsOpen(sc: TelemetrySidecar): number {
  const p = sc.totals.pickups;
  return p.spawned - p.collected - p.expired - p.cleared - p.gone;
}

/** Does the sidecar add up to the game it watched? Every line is something
 *  that does not: none in a healthy build. */
export function reconcile(sc: TelemetrySidecar, g: Game): string[] {
  const out: string[] = [];
  const t = sc.totals;
  const eq = (name: string, a: number, b: number) => {
    if (Math.abs(a - b) > 1e-6) out.push(`${name}: telemetry ${a}, game ${b}`);
  };
  eq('ships lost', t.lost, g.lost);
  eq('ships delivered', t.delivered, g.delivered);
  eq('ships sunk (sunkBy)', t.sunk, Object.values(g.sunkBy).reduce((a, b) => a + b, 0));
  eq('kills', t.kills, Object.values(g.kills).reduce((a, b) => a + b, 0));
  eq('ships afloat', t.sailed - t.sunk - t.delivered, g.ships.length);
  // Every launch the game counted (`origins`: one per threat a launcher
  // sent) has its event; splits and structures are not launches.
  const launched = sc.events.filter((e) => e.k === 'thr+' && !e.back && e.pid === undefined && e.o !== 'structure' && e.o !== 'seen').length;
  if (!sc.truncated) eq('launches', launched, Object.values(g.origins).reduce((a, b) => a + b, 0));
  for (const k of ['fire', 'pickup', 'dry', 'empty'] as const) eq(`taps (${k})`, t.taps[k], g.taps[k]);
  eq('pickups on the water', pickupsOpen(sc), g.pickups.length);
  eq('audits', t.audits, 0);
  // The events themselves against the ledger kept as they were written.
  let hpShip = 0;
  let hpCarrier = 0;
  let carrierHealed = 0;
  let sunk = 0;
  let delivered = 0;
  const byKind: Partial<Record<ThreatKind, number>> = {};
  const carrierBy: Partial<Record<ThreatKind, number>> = {};
  const sunkBy: Partial<Record<ThreatKind, number>> = {};
  const pk = { spawned: 0, collected: 0, expired: 0, cleared: 0, gone: 0 };
  for (const e of sc.events) {
    if (e.k === 'hit' && !e.blk) {
      if (e.vt === 's') hpShip += e.hp;
      else if (e.vt === 'c') {
        hpCarrier += e.hp;
        // The game's own tally (`carrierDamageBy`) counts the warhead, not
        // the hull it removed: the blow that sinks the carrier counts in
        // full there. `dealt` is that number; `hp` is the hull.
        carrierBy[e.by] = (carrierBy[e.by] ?? 0) + e.dealt;
      }
      if (e.vt === 's' && e.sunk) sunkBy[e.by] = (sunkBy[e.by] ?? 0) + 1;
    } else if (e.k === 'ship-') {
      if (e.why === 'sunk') sunk += 1;
      else delivered += 1;
    } else if (e.k === 'heal' && e.vt === 'c') carrierHealed += e.hp;
    else if (e.k === 'hurt' && e.kill) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
    else if (e.k === 'pk+') pk.spawned += 1;
    else if (e.k === 'pk-') pk[e.why] += 1;
  }
  if (!sc.truncated) {
    eq('events: ship hull points', hpShip, t.hpShip);
    eq('events: carrier hull points', hpCarrier, t.hpCarrier);
    eq('carrier hull', sc.header.rules.carrierHp - hpCarrier + carrierHealed, g.carrierHp);
    eq('events: sinkings', sunk, t.sunk);
    eq('events: deliveries', delivered, t.delivered);
    for (const k of Object.keys(pk) as (keyof typeof pk)[]) eq(`events: pickups ${k}`, pk[k], t.pickups[k]);
    for (const kind of Object.keys(g.kills) as ThreatKind[]) {
      eq(`kills of ${kind}`, byKind[kind] ?? 0, g.kills[kind]);
      eq(`sunk by ${kind}`, sunkBy[kind] ?? 0, g.sunkBy[kind]);
      eq(`carrier damage by ${kind}`, carrierBy[kind] ?? 0, g.carrierDamageBy[kind]);
    }
  }
  return out;
}
