// Bot personas for headless playtesting.
//
// A persona is a complete playing style: how it fights during transit, what it
// buys in procurement, which draft options it prefers, and how it sails.
// Personas exist to sweep the STRATEGY SPACE — the point is not that any one
// bot plays well, but that between them they exercise the builds a real player
// might try, so the balance report reflects more than a single line of play.
//
// Hard rule: every persona drives the real campaign/transit APIs (buyModule,
// selectDraftOption, stepTransit …). Nothing here reaches into state directly,
// so a bot can only do what a player could — including respecting technology
// gates, slot limits and ammunition. Under the roguelite loop the persona's
// `research` list is its DRAFT PREFERENCE order: the mandatory post-round
// draft is resolved toward it whenever the draft offers something on it.

import {
  buyAmmo,
  buyBase,
  equipBaseModule,
  moduleSpare,
  buyDroneAmmo,
  buyEscort,
  equipEscortModule,
  equipModule,
  fleetHasEscortModule,
  buyPdAmmo,
  buyShip,
  repairCost,
  repairFleet,
  setComposition,
  setFormation,
  buyWarthogSortie,
  buyScanPulse,
  buySmokeCanister,
} from '../../src/sim/campaign';
import {
  dismissEmptyDraft,
  draftOptionResearchId,
  selectDraftOption,
} from '../../src/sim/draft';
import { LOSS_CAUSE_TO_ENEMY_BRANCH } from '../../src/data/counters';
import { BASE_MODULES, ESCORT_MODULES, MODULES } from '../../src/data/defs';
import { COMBAT, COMMANDER, NAV, WORLD } from '../../src/data/tuning';
import { COMMANDER_ABILITIES, loadoutPointsUsed } from '../../src/data/commanderAbilities';
import type {
  DraftOption,
  BaseModuleId,
  CampaignState,
  EscortModuleId,
  FormationId,
  ModuleId,
  ResearchId,
  ShipClassId,
  Threat,
  TransitCommand,
  TransitState,
} from '../../src/sim/types';

// ---------------------------------------------------------------------------
// Procurement intents
// ---------------------------------------------------------------------------

/** One procurement desire, evaluated in priority order each prep phase. The
 *  bot walks its list top to bottom, repeatedly, until nothing is affordable —
 *  so an early cheap intent is satisfied before a later expensive one. */
export type BuyIntent =
  | { kind: 'repair' }
  | { kind: 'base' }
  /** Buy an escort, optionally maintaining a standing screen of `upTo` hulls.
   *  Without `upTo` the bot buys one whenever it happens to be affordable at
   *  this point in the list, which measured badly: escorts are the mobile
   *  interceptor platform, they take 3-5 losses a campaign, and with the intent
   *  sitting BELOW `ship` the bot spent its money replacing merchant hulls
   *  instead. Half the personas peaked at 2-3 escorts and finished at zero,
   *  sailing the endgame with no screen at all — which no human does, and which
   *  made a launcher-throughput shortfall look like a missile-balance problem.
   *  A screen target restores the intent a player actually has: keep the escorts
   *  up FIRST, then grow the convoy behind them. */
  | { kind: 'escort'; upTo?: number }
  | { kind: 'ammo'; upTo: number }
  | { kind: 'droneAmmo'; upTo: number }
  | { kind: 'selfDefenseAmmo'; upTo: number }
  | { kind: 'module'; classId: ShipClassId; moduleId: ModuleId }
  /** Fit the persona's escortDoctrine across the flotilla — escort 1 gets the
   *  first loadout, escort 2 the second, and so on. Replaces a per-module
   *  intent that fitted one fleet-wide template, which could not express a
   *  mixed flotilla at all. */
  | { kind: 'escortFit' }
  | { kind: 'baseModule'; id: BaseModuleId }
  | { kind: 'ability'; id: 'warthog' | 'scan' | 'sonar' | 'smoke' | 'hardened' }
  /** Replace losses. Without `upToCapacity: false` the bot only rebuilds while
   *  the fleet is under convoy capacity — a real player restores the convoy
   *  rather than letting attrition shrink it to nothing. */
  | { kind: 'ship'; classId: ShipClassId; upToCapacity?: boolean };

/** How a persona fights during the transit. */
export interface TransitPolicy {
  /** Interceptor firing:
   *  - `none` — never fires by hand (the AFK control).
   *  - `always` — fires whenever a launcher is ready. Maximal, and NOT what a
   *    human does once automation is researched: it produced an 83% manual
   *    share against a measured 32% in a hand-played log.
   *  - `sparing` — only takes a shot the automation is visibly not going to
   *    take: an unclaimed threat inside `manualTakeoverSeconds` of impact.
   *    This is what makes auto-fire technology worth anything to a bot. */
  intercept: 'none' | 'always' | 'sparing';
  /** Which threat a ready launcher picks. `urgent` favors the missile closest
   *  to its target (most urgent); `nearest` favors the closest to a launcher. */
  targeting: 'nearest' | 'urgent';
  /** Tap charted mines to send minesweeper drones (needs launcher + munitions). */
  sweepMines: boolean;
  /** Place scan pulses over the shipping channel to chart mines. */
  useScan: boolean;
  /** Call the Warthog onto whatever patch of water has the most surface
   *  targets (mines and boats) sitting in it. */
  useWarthog: boolean;
  /** Place defensive smoke over the densest cluster of hulls. */
  useSmoke: boolean;
  /** Fire depth charges at detected torpedoes. */
  useDepthCharges: boolean;
  /** Spend active-sonar charges hunting torpedoes the passive watch missed. */
  useSonar: boolean;
  /** Commit a deck-gun escort to an attack boat by hand. Without this the gun
   *  only ever fires through its automation tactic, which is why the deck-gun
   *  branch has only ever been measured at its floor. */
  engageBoats: boolean;
  /** Fire shore counter-battery at identified artillery positions. Same story
   *  as the deck gun: manual fire was never exercised by any persona. */
  useCounterBattery: boolean;
  /** How far (world units) an escort will leave the convoy screen to work a
   *  wreckage field or a crew in the water. 0 disables recovery entirely.
   *
   *  Recovery is the roguelite's reward loop — recovered wreckage widens the
   *  technology draft from two options to three and skews it toward deeper
   *  nodes — and no persona could reach it before, because none of them ever
   *  issued `moveEscort`. Sweeps recovered 0.2% of wreckage against a human's
   *  81%, so every counter-value number was measured on a narrower tree than a
   *  player actually climbs. */
  recoveryRange: number;
  /** Escorts that stay on the screen no matter what. The real cost of salvage
   *  is the hull that is not screening while it works, and a persona that
   *  sends its whole flotilla away is not making the trade a player makes. */
  screenReserve: number;
  /** Work crews in the water before enemy wreckage when both are reachable.
   *  Wreckage buys technology; a rescue buys back confidence. */
  rescueFirst: boolean;
}

/** Seconds-to-impact inside which a `sparing` policy stops waiting for the
 *  automation and takes the shot itself. */
const MANUAL_TAKEOVER_SECONDS = 7;

export interface Persona {
  name: string;
  /** One-line description for the report. */
  desc: string;
  /** Default formation, and the fallback when `adaptFormation` has nothing to
   *  go on (round 1, or a round that cost nothing). */
  formation: FormationId;
  /** Re-pick the formation each prep phase from what the last round did, the
   *  way a player reads their own after-action report. A fixed formation is a
   *  persona that never touches a free per-round lever — measured: zero
   *  formation changes across a whole sweep against three in nine hand-played
   *  rounds. */
  adaptFormation?: boolean;
  /** Commander Ability loadout this build commissions with. Bounded by
   *  COMMANDER.abilitySlots and COMMANDER.loadoutPoints, and validated at
   *  startup — an illegal loadout is a persona bug, not something to silently
   *  truncate. Empty means a bare commander, which no real run has. */
  commander?: string[];
  /** Research priority order; the first affordable+available entry is started. */
  research: ResearchId[];
  buys: BuyIntent[];
  /** Loadout wanted for each escort by position: index 0 is the first escort
   *  hired, index 1 the second. A persona that names the same module in every
   *  entry builds a specialised flotilla (three gun boats); one that varies
   *  them builds a balanced one. Escorts past the end of the list stay bare. */
  escortDoctrine?: EscortModuleId[][];
  transit: TransitPolicy;
  /** Cash kept in reserve (never spent by the buy loop), so a persona can be
   *  made deliberately stingy. */
  reserve?: number;
}

// ---------------------------------------------------------------------------
// Procurement execution
// ---------------------------------------------------------------------------

/** Attempt one intent. Returns true if cash actually moved (so the caller can
 *  loop until the whole list stops making progress). */
function tryBuy(c: CampaignState, intent: BuyIntent, reserve: number, persona: Persona): boolean {
  const spendable = c.cash - reserve;
  // Fitting equipment costs nothing — the draft already paid for it — so those
  // intents are never gated on cash the way purchases are.
  const free = intent.kind === 'module' || intent.kind === 'escortFit' || intent.kind === 'baseModule';
  if (spendable <= 0 && intent.kind !== 'repair' && !free) return false;
  switch (intent.kind) {
    case 'repair':
      return repairCost(c) > 0 && repairFleet(c);
    case 'base':
      return buyBase(c);
    case 'escort':
      return (intent.upTo === undefined || c.escortUnits.length < intent.upTo) && buyEscort(c);
    case 'ammo':
      return c.ammo < intent.upTo && buyAmmo(c, 5);
    // Consumables are gated on owning the thing that fires them — a real
    // player doesn't stockpile drone munitions with no launcher fitted, and
    // letting a bot do it would quietly distort the economy signal.
    case 'droneAmmo':
      return (
        fleetHasEscortModule(c, 'mcmDroneLauncher') &&
        c.droneAmmo < intent.upTo &&
        buyDroneAmmo(c)
      );
    case 'selfDefenseAmmo':
      return (
        Object.values(c.classModules).some((mods) => mods.includes('selfDefense')) &&
        c.pdAmmo < intent.upTo &&
        buyPdAmmo(c)
      );
    case 'module':
      return equipModule(c, intent.classId, intent.moduleId);
    case 'escortFit': {
      // Walk the doctrine in order and fit the first thing that is affordable,
      // researched and has a free slot on that escort. One purchase per call so
      // the caller's loop keeps interleaving with the rest of the shopping list.
      const doctrine = persona.escortDoctrine ?? [];
      for (let i = 0; i < c.escortUnits.length; i++) {
        const want = doctrine[i] ?? [];
        for (const moduleId of want) {
          if (equipEscortModule(c, c.escortUnits[i].id, moduleId)) return true;
        }
      }
      return false;
    }
    case 'baseModule':
      return equipBaseModule(c, intent.id);
    case 'ability':
      // The capabilities themselves are in hand from round one; what is bought
      // is their ordnance. A bot that never topped up would fly exactly the
      // starting allowance all run and the sweep would stop measuring these
      // branches at all.
      switch (intent.id) {
        case 'warthog':
          return buyWarthogSortie(c);
        case 'scan':
          return buyScanPulse(c);
        case 'smoke':
          return buySmokeCanister(c);
        case 'sonar':
        case 'hardened':
          return false; // no consumable to buy
      }
      return false;
    case 'ship': {
      if (intent.upToCapacity !== false) {
        const fleet = Object.values(c.fleet).reduce((a, b) => a + b, 0);
        if (fleet >= c.capacity) return false;
      }
      return buyShip(c, intent.classId);
    }
  }
}

/** Send everything the fleet can spare, up to capacity. Composition only ever
 *  shrinks on its own (resolveTransit clamps it to surviving hulls), so a bot
 *  that never re-assigns would sail a smaller and smaller convoy until it had
 *  nothing left — an artifact of the harness, not a real playstyle. */
function fillConvoy(c: CampaignState): void {
  for (const classId of Object.keys(c.fleet) as ShipClassId[]) {
    setComposition(c, classId, c.fleet[classId]);
  }
}

/** Pick this round's formation from what the last one cost, the way a player
 *  reads their own after-action report and changes one thing.
 *
 *  The mapping is the formation table's own trade-offs (src/data/defs.ts), not
 *  a guess: `tight` buys +8% intercept accuracy and 1.3x defensive reach at the
 *  price of blast chaining, so it answers missiles; `wide` cuts collateral to
 *  0.35x and kills chaining outright, so it answers mines and anything that
 *  detonates among hulls; `sprint` is 1.22x pace with middling coverage, which
 *  is what a clean round earns you. */
function adaptiveFormation(c: CampaignState, persona: Persona): FormationId {
  const last = c.telemetry[c.telemetry.length - 1];
  if (!last) return persona.formation;

  // A round that cost nothing says the screen is winning: spend the surplus on
  // speed rather than holding a defensive posture against nothing.
  if (last.lost === 0 && last.deliveredPct >= 95) return 'sprint';

  const perBranch: Record<string, number> = {};
  for (const loss of last.losses) {
    const branch = LOSS_CAUSE_TO_ENEMY_BRANCH[loss.cause.replace(/^(escort|base):/, '')] ?? 'unknown';
    perBranch[branch] = (perBranch[branch] ?? 0) + 1;
  }
  const top = Object.entries(perBranch).sort((a, b) => b[1] - a[1])[0]?.[0];
  // Mines and boats do their damage IN AMONG the hulls, where sea room is the
  // mitigation. Missiles are shot down on the way in, where reach and accuracy
  // are. Anything else: hold the persona's own doctrine.
  if (top === 'mines' || top === 'attackBoats' || top === 'artillery') return 'wide';
  if (top === 'missiles') return 'tight';
  return persona.formation;
}

/** Run a persona's whole procurement phase: formation, then the buy list until
 *  it stops making progress. */
export function procure(c: CampaignState, persona: Persona): void {
  setFormation(c, persona.adaptFormation ? adaptiveFormation(c, persona) : persona.formation);
  const reserve = persona.reserve ?? 0;
  // Loop the list: satisfying a cheap intent may free a later one to matter,
  // and quantity intents (ammo up to N) need repeating.
  let progressed = true;
  let guard = 0;
  while (progressed && guard++ < 200) {
    progressed = false;
    for (const intent of persona.buys) {
      if (tryBuy(c, intent, reserve, persona)) progressed = true;
    }
  }
  fitSpareEquipment(c);
  fillConvoy(c);
}

/** Bolt on anything sitting in the locker with somewhere legal to go.
 *
 *  A persona's buy list names the fits its DOCTRINE wants, which was the whole
 *  story when equipment was bought: you only ever owned what you chose. Under
 *  the draft economy units arrive whether or not they were asked for, and a bot
 *  that only ever fitted its shopping list left them in the locker — 3.6 units
 *  drafted per campaign against 0.6 fitted, which is not a playstyle, it is the
 *  harness failing to play. Nobody drafts a deck gun and forgets to bolt it on.
 *
 *  Doctrine still comes first: this runs AFTER the buy list, so a persona's
 *  preferred escort fits claim their slots before the leftovers do. */
function fitSpareEquipment(c: CampaignState): void {
  let progressed = true;
  let guard = 0;
  while (progressed && guard++ < 100) {
    progressed = false;
    for (const moduleId of Object.keys(ESCORT_MODULES) as EscortModuleId[]) {
      if (moduleSpare(c, 'escort', moduleId) <= 0) continue;
      for (const unit of c.escortUnits) {
        if (equipEscortModule(c, unit.id, moduleId)) {
          progressed = true;
          break;
        }
      }
    }
    for (const moduleId of Object.keys(MODULES) as ModuleId[]) {
      if (moduleSpare(c, 'cargo', moduleId) <= 0) continue;
      for (const classId of Object.keys(c.classModules) as ShipClassId[]) {
        if (equipModule(c, classId, moduleId)) {
          progressed = true;
          break;
        }
      }
    }
    for (const moduleId of Object.keys(BASE_MODULES) as BaseModuleId[]) {
      if (moduleSpare(c, 'base', moduleId) > 0 && equipBaseModule(c, moduleId)) progressed = true;
    }
  }
}

/** Resolve the pending technology draft the way this persona would: take the
 *  offered option it ranks highest in its research-preference list, or the
 *  first option when nothing it wanted was offered (the draft is mandatory).
 *  Returns the pick, or null when no draft was pending. */
export function research(c: CampaignState, persona: Persona): DraftOption | null {
  const draft = c.pendingDraft;
  if (!draft) return null;
  if (draft.options.length === 0) {
    dismissEmptyDraft(c);
    return null;
  }
  // A persona's preference list is written in RESEARCH ids, and a module option
  // is matched by the research its first unit delivers — so every doctrine list
  // in this file kept working when equipment stopped being bought and started
  // being drafted. Ordnance matches nothing by name and is only ever the
  // fallback, which is exactly its role in the draft too.
  const preferred = persona.research
    .map((id) => draft.options.find((o) => draftOptionResearchId(o) === id))
    .find((o): o is DraftOption => o !== undefined);
  const pick = preferred ?? draft.options[0];
  return selectDraftOption(c, pick) ? pick : null;
}

// ---------------------------------------------------------------------------
// Transit play
// ---------------------------------------------------------------------------

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function clampNum(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Is any interceptor launcher ready to fire right now? Checked before issuing
 *  an intercept so bots don't spam commands the sim would just reject. */
function anyLauncherReady(t: TransitState): boolean {
  if (t.ammo <= 0) return false;
  const baseReady = t.bases.some((b) => b.alive && b.cooldown <= 0 && t.time >= b.disabledUntil);
  const escortReady = t.escorts.some(
    (e) => e.alive && e.cooldown <= 0 && t.time >= e.disabledUntil,
  );
  return baseReady || escortReady;
}

/** Rough seconds until a missile reaches whatever it is aimed at. */
function timeToImpact(t: TransitState, threat: Threat): number {
  let tx = threat.targetX;
  let ty = threat.targetY;
  if (threat.kind === 'guidedMissile') {
    const ship = t.ships.find((s) => s.id === threat.targetShipId && s.alive && !s.delivered);
    if (ship) {
      tx = ship.x;
      ty = ship.y;
    }
  }
  if (tx === undefined || ty === undefined) return 999;
  return dist(threat.x, threat.y, tx, ty) / Math.max(1, threat.speed);
}

/** Centroid of the live convoy — where placed abilities are most useful. */
function convoyCenter(t: TransitState): { x: number; y: number; count: number } {
  const live = t.ships.filter((s) => s.spawned && s.alive && !s.delivered);
  if (live.length === 0) return { x: WORLD.width / 2, y: WORLD.lanes[1], count: 0 };
  const x = live.reduce((sum, s) => sum + s.x, 0) / live.length;
  const y = live.reduce((sum, s) => sum + s.y, 0) / live.length;
  return { x, y, count: live.length };
}

/** What an escort has been detached to do, so the bot issues each order ONCE
 *  and knows when the job is finished. Re-issuing `moveEscort` every tick would
 *  clear `stationed` on arrival and leave the escort circling its own
 *  destination forever, never working the field it was sent to. */
interface EscortJob {
  kind: 'wreckage' | 'survivors';
  targetId: number;
  /** True once the recall order has been sent, so it is not sent every tick. */
  recalled: boolean;
}

/** Per-transit scratch state for a persona's ability pacing and escort jobs. */
export interface TransitMemory {
  lastScanT: number;
  lastWarthogT: number;
  lastSmokeT: number;
  lastSonarT: number;
  /** Escort id → the recovery job it is currently detached on. */
  jobs: Map<number, EscortJob>;
}

export function newTransitMemory(): TransitMemory {
  return {
    lastScanT: -99,
    lastWarthogT: -99,
    lastSmokeT: -99,
    lastSonarT: -99,
    jobs: new Map(),
  };
}

/** Can an escort at (x,y) reach this job and finish it before it sinks?
 *
 *  Sending a hull on a trip it cannot complete is worse than not sending it:
 *  the escort is off the screen for the whole transit AND the field expires
 *  anyway. Transit time is `distance / escortSpeed`; the work itself is the
 *  field's own `required` seconds, discounted by nothing — a lone escort works
 *  at the base rate. */
function reachableInTime(
  t: TransitState,
  from: { x: number; y: number },
  job: { x: number; y: number; required: number; progress: number; expiresAt: number },
): boolean {
  const travel = dist(from.x, from.y, job.x, job.y) / NAV.escortSpeed;
  const work = Math.max(0, job.required - job.progress);
  return t.time + travel + work <= job.expiresAt;
}

/** Decide this tick's commands. Pure w.r.t. the sim — it only reads state. */
export function decideCommands(
  t: TransitState,
  persona: Persona,
  mem: TransitMemory,
): TransitCommand[] {
  const cmds: TransitCommand[] = [];
  const p = persona.transit;

  // --- Interceptors --------------------------------------------------------
  // One launch attempt per ready window: pick an unclaimed missile so shots
  // aren't stacked on a threat that already has a kill inbound.
  if (p.intercept !== 'none' && anyLauncherReady(t)) {
    let best: Threat | null = null;
    let bestKey = Infinity;
    for (const threat of t.threats) {
      if (!threat.alive) continue;
      if (threat.kind !== 'missile' && threat.kind !== 'guidedMissile') continue;
      if (threat.claimedByInterceptor) continue;
      // `sparing`: leave the shot to the automation until the threat is close
      // enough to impact that waiting any longer loses the hull. A bot that
      // hand-fires everything makes every auto-fire node in the tree worthless
      // to it, which is exactly backwards from how a human plays once they hold
      // localAuto/strategicAuto.
      if (p.intercept === 'sparing' && timeToImpact(t, threat) > MANUAL_TAKEOVER_SECONDS) continue;
      const key =
        p.targeting === 'urgent'
          ? timeToImpact(t, threat)
          : Math.min(
              ...[
                ...t.bases.filter((b) => b.alive).map((b) => dist(b.x, b.y, threat.x, threat.y)),
                ...t.escorts.filter((e) => e.alive).map((e) => dist(e.x, e.y, threat.x, threat.y)),
                Infinity,
              ],
            );
      if (key < bestKey) {
        bestKey = key;
        best = threat;
      }
    }
    if (best) cmds.push({ type: 'intercept', threatId: best.id });
  }

  // --- Deck guns -----------------------------------------------------------
  // Commit a gun escort to a boat that no gun is already on. The sim's model is
  // COMMITMENT — the gun stays until the boat sinks or leaves range — so the
  // only thing to avoid is re-tasking a gun that is already working.
  if (p.engageBoats && t.escorts.some((e) => e.alive && e.modules.includes('deckGun'))) {
    const engaged = new Set(
      t.escorts.filter((e) => e.alive && e.gunTargetId !== null).map((e) => e.gunTargetId),
    );
    let target: Threat | null = null;
    let bestD = Infinity;
    for (const boat of t.threats) {
      if (boat.kind !== 'attackBoat' || !boat.alive || engaged.has(boat.id)) continue;
      const d = Math.min(
        ...t.escorts
          .filter((e) => e.alive && e.modules.includes('deckGun'))
          .map((e) => dist(e.x, e.y, boat.x, boat.y)),
        Infinity,
      );
      if (d <= t.effects.deckGun.range && d < bestD) {
        bestD = d;
        target = boat;
      }
    }
    // Focus fire once it is researched: a boarding party that reaches a hull
    // takes the ship outright, so a boat close to the convoy is worth every gun
    // that can reach it.
    if (target) {
      const closeToConvoy = t.ships.some(
        (s) => s.alive && !s.delivered && dist(s.x, s.y, target!.x, target!.y) < 160,
      );
      cmds.push({
        type: 'engageBoat',
        threatId: target.id,
        focus: closeToConvoy && t.effects.deckGun.focusFire,
      });
    }
  }

  // --- Counter-battery -----------------------------------------------------
  // Fire at an identified artillery POSITION, never at a shell. Gated on a
  // base actually being ready so the bot is not spamming rejected commands.
  if (p.useCounterBattery && t.baseModules.includes('counterBattery')) {
    const ready = t.bases.some(
      (b) => b.alive && b.cbCooldown <= 0 && t.time >= b.disabledUntil,
    );
    if (ready) {
      const pos = t.installations.find(
        (i) =>
          !i.destroyed &&
          t.time >= i.suppressedUntil &&
          (i.variant !== 'ranging' || t.effects.counterBattery.canEngageRanging),
      );
      if (pos) cmds.push({ type: 'counterBattery', installationId: pos.id });
    }
  }

  // --- Recovery & rescue ---------------------------------------------------
  // The roguelite reward loop, and the only place a persona spends escort TIME
  // rather than money. Two rules make this a real trade rather than free value:
  // the screen keeps `screenReserve` hulls no matter what, and a job is only
  // taken if the escort can finish it before the field sinks.
  if (p.recoveryRange > 0 && t.escorts.some((e) => e.alive)) {
    const center = convoyCenter(t);
    // Retire finished or impossible jobs first, and recall the hull.
    for (const [escortId, job] of mem.jobs) {
      const escort = t.escorts.find((e) => e.id === escortId);
      const done =
        !escort ||
        !escort.alive ||
        (job.kind === 'wreckage'
          ? !t.wreckage.some((f) => f.id === job.targetId && !f.recovered && !f.expired)
          : !t.survivors.some((a) => a.id === job.targetId && !a.rescued && !a.lost));
      if (!done) continue;
      mem.jobs.delete(escortId);
      // Rejoin: hold=false so the escort resumes cruising with the convoy on
      // arrival instead of parking in empty water where it screens nothing.
      if (escort?.alive && !job.recalled) {
        cmds.push({ type: 'moveEscort', escortId, x: center.x, y: center.y, hold: false });
      }
    }

    const free = t.escorts.filter((e) => e.alive && !mem.jobs.has(e.id));
    const detachable = t.escorts.filter((e) => e.alive).length - p.screenReserve;
    if (free.length > 0 && mem.jobs.size < detachable) {
      const claimed = new Set([...mem.jobs.values()].map((j) => `${j.kind}:${j.targetId}`));
      type Candidate = { kind: 'wreckage' | 'survivors'; id: number; x: number; y: number; required: number; progress: number; expiresAt: number };
      const candidates: Candidate[] = [
        ...t.wreckage
          .filter((f) => !f.recovered && !f.expired && !claimed.has(`wreckage:${f.id}`))
          .map((f) => ({ kind: 'wreckage' as const, id: f.id, x: f.x, y: f.y, required: f.required, progress: f.progress, expiresAt: f.expiresAt })),
        ...t.survivors
          .filter((a) => !a.rescued && !a.lost && !claimed.has(`survivors:${a.id}`))
          .map((a) => ({ kind: 'survivors' as const, id: a.id, x: a.x, y: a.y, required: a.required, progress: a.progress, expiresAt: a.expiresAt })),
      ];
      // Nearest reachable job for the nearest free escort. A crew in the water
      // outranks a wreck at the same distance when the persona says so — the
      // two buy different currencies (confidence vs draft breadth).
      let bestEscort: number | null = null;
      let bestJob: Candidate | null = null;
      let bestScore = Infinity;
      for (const escort of free) {
        for (const job of candidates) {
          const d = dist(escort.x, escort.y, job.x, job.y);
          if (d > p.recoveryRange) continue;
          if (!reachableInTime(t, escort, job)) continue;
          const score = p.rescueFirst && job.kind === 'survivors' ? d * 0.5 : d;
          if (score < bestScore) {
            bestScore = score;
            bestEscort = escort.id;
            bestJob = job;
          }
        }
      }
      if (bestEscort !== null && bestJob) {
        mem.jobs.set(bestEscort, { kind: bestJob.kind, targetId: bestJob.id, recalled: false });
        // hold=true: the escort has to SIT inside the radius to work the field,
        // and progress resets completely the moment nothing is working it.
        cmds.push({ type: 'moveEscort', escortId: bestEscort, x: bestJob.x, y: bestJob.y, hold: true });
      }
    }
  }

  // --- Minesweeping --------------------------------------------------------
  // Only revealed mines with no drone already inbound; the sim enforces range
  // and munitions, so a rejected tap is harmless but we avoid the obvious ones.
  if (p.sweepMines && t.effects.sweepDrones && t.droneAmmo > 0) {
    for (const mine of t.threats) {
      if (mine.kind !== 'mine' || !mine.alive || !mine.revealed) continue;
      if (t.drones.some((d) => d.targetMineId === mine.id)) continue;
      const inRange = t.escorts.some(
        (e) => e.alive && e.droneReady > 0 && dist(e.x, e.y, mine.x, mine.y) <= t.effects.mcm.launchRange,
      );
      if (!inRange) continue;
      cmds.push({ type: 'sweepMine', threatId: mine.id });
      break; // one per tick keeps munition use deliberate
    }
  }

  // --- Depth charges -------------------------------------------------------
  // Aims at a DETECTED torpedo's position (an area attack at a water point).
  // Only the escorts actually fitted with racks can drop, so the readiness check
  // below is the whole gate — a fleet-wide "do we have depth charges" question
  // no longer has an answer.
  if (p.useDepthCharges) {
    const torpedo = t.threats.find((th) => th.kind === 'torpedo' && th.alive && th.revealed);
    if (torpedo) {
      const ready = t.escorts.some(
        (e) =>
          e.alive &&
          e.modules.includes('depthCharges') &&
          e.dcShots > 0 &&
          e.dcCooldown <= 0 &&
          dist(e.x, e.y, torpedo.x, torpedo.y) <= t.effects.depthCharge.throwRange,
      );
      if (ready) cmds.push({ type: 'depthCharge', x: torpedo.x, y: torpedo.y });
    }
  }

  // --- Placed abilities ----------------------------------------------------
  const center = convoyCenter(t);

  // Scan: sweep the lane the convoy is actually using, spaced out over the run.
  if (p.useScan && t.scanCharges > 0 && t.time > 20 && t.time - mem.lastScanT > 35) {
    cmds.push({ type: 'ability', ability: 'scan', x: center.x, y: center.y });
    mem.lastScanT = t.time;
  }

  // Active sonar: the only way to find a torpedo the passive watch cannot
  // hear. Ping ahead of the convoy — behind it is water already crossed — and
  // only once torpedoes are known to be a threat this round, since charges are
  // few. Nothing detected yet is exactly when a ping is worth spending.
  if (
    p.useSonar &&
    t.sonarCharges > 0 &&
    t.stats.torpedoesLaunched > t.stats.torpedoesDetected &&
    t.time - mem.lastSonarT > 18
  ) {
    cmds.push({ type: 'ability', ability: 'sonar', x: center.x + 260, y: center.y });
    mem.lastSonarT = t.time;
  }

  // Warthog: draw the run-in line through the best string of surface targets
  // ahead of the convoy. The jet takes one target on the way out and one on the
  // way back, so the bot wants targets STRUNG OUT along a line rather than
  // bunched in a blob — a pair it can line up beats a cluster it cannot.
  if (
    p.useWarthog &&
    t.warthogCharges > 0 &&
    t.time >= t.warthogActiveUntil &&
    t.time - mem.lastWarthogT > 20
  ) {
    const surface = t.threats.filter(
      (th) =>
        th.alive &&
        (th.kind === 'mine' || th.kind === 'attackBoat') &&
        // Only water ahead of the convoy is worth a sortie — behind it,
        // whatever is there has already been sailed past.
        th.x >= center.x - 120 &&
        th.y >= COMBAT.warthog.waterYMin &&
        th.y <= COMBAT.warthog.waterYMax,
    );
    // Best PAIR: the two targets whose separation makes the longest legal run.
    // The line through them is the run, extended a little past both so each is
    // comfortably inside the gun cone rather than sitting on the endpoint.
    let bestA: { x: number; y: number } | null = null;
    let bestB: { x: number; y: number } | null = null;
    let bestScore = 0;
    for (let i = 0; i < surface.length; i++) {
      for (let j = i + 1; j < surface.length; j++) {
        const a = surface[i];
        const b = surface[j];
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < COMBAT.warthog.minRunLength || d > COMBAT.warthog.coneRange * 2) continue;
        // Prefer pairs with other targets near the line between them.
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const near = surface.filter((o) => dist(o.x, o.y, midX, midY) < d).length;
        if (near > bestScore) {
          bestScore = near;
          bestA = { x: a.x, y: a.y };
          bestB = { x: b.x, y: b.y };
        }
      }
    }
    // No pair lines up? A single target is still worth a run — draw the line
    // straight down the convoy's axis through it, which is what a player does
    // and which keeps a bought sortie from sitting on the apron all round.
    if (!bestA && surface.length > 0) {
      const lone = surface.reduce((best, th) => (th.x < best.x ? th : best), surface[0]);
      const y = clampNum(lone.y, COMBAT.warthog.waterYMin, COMBAT.warthog.waterYMax);
      bestA = { x: lone.x - COMBAT.warthog.minRunLength, y };
      bestB = { x: lone.x + COMBAT.warthog.minRunLength * 1.5, y };
      bestScore = 2;
    }
    if (bestA && bestB && bestScore >= 2) {
      const ux = (bestB.x - bestA.x) / dist(bestA.x, bestA.y, bestB.x, bestB.y);
      const uy = (bestB.y - bestA.y) / dist(bestA.x, bestA.y, bestB.x, bestB.y);
      const pad = 60;
      cmds.push({
        type: 'ability',
        ability: 'warthog',
        x: bestA.x - ux * pad,
        y: clampNum(bestA.y - uy * pad, COMBAT.warthog.waterYMin, COMBAT.warthog.waterYMax),
        x2: bestB.x + ux * pad,
        y2: clampNum(bestB.y + uy * pad, COMBAT.warthog.waterYMin, COMBAT.warthog.waterYMax),
      });
      mem.lastWarthogT = t.time;
    }
  }

  // Smoke: lay it over the convoy while it is genuinely under threat.
  if (p.useSmoke && t.smokeCharges > 0 && t.time - mem.lastSmokeT > 30 && center.count >= 3) {
    const inbound = t.threats.filter(
      (th) => th.alive && (th.kind === 'missile' || th.kind === 'guidedMissile'),
    ).length;
    if (inbound >= 3) {
      cmds.push({ type: 'ability', ability: 'smoke', x: center.x, y: center.y });
      mem.lastSmokeT = t.time;
    }
  }

  return cmds;
}

// ---------------------------------------------------------------------------
// The personas
// ---------------------------------------------------------------------------

/** How far off the screen a working flotilla will send a hull. Sized from the
 *  mechanics rather than picked: an escort makes NAV.escortSpeed units/second
 *  and a wreckage field lives WRECKAGE.lifetimeSeconds, so a field much beyond
 *  this cannot be reached AND worked before it sinks. `reachableInTime` is the
 *  real gate; this is the cheap first filter. */
const RECOVERY_RANGE = 900;

const FIGHTER: TransitPolicy = {
  intercept: 'always',
  targeting: 'urgent',
  sweepMines: true,
  useScan: true,
  useWarthog: true,
  useSmoke: true,
  useDepthCharges: true,
  useSonar: true,
  engageBoats: true,
  useCounterBattery: true,
  recoveryRange: RECOVERY_RANGE,
  // One hull always stays with the convoy. A flotilla that salvages with
  // everything it has is not making the trade a player makes — and with a
  // single escort it would leave the convoy completely unscreened.
  screenReserve: 1,
  rescueFirst: false,
};

const PASSIVE: TransitPolicy = {
  intercept: 'none',
  targeting: 'nearest',
  sweepMines: false,
  useScan: false,
  useWarthog: false,
  useSmoke: false,
  useDepthCharges: false,
  useSonar: false,
  engageBoats: false,
  useCounterBattery: false,
  recoveryRange: 0,
  screenReserve: 0,
  rescueFirst: false,
};

export const PERSONAS: Persona[] = [
  {
    name: 'balanced',
    desc: 'Generalist: one answer to every branch before depth in any of them.',
    formation: 'tight',
    commander: ['salvageTeams', 'rescueDoctrine', 'quartermaster'],
    adaptFormation: true,
    // BREADTH FIRST, and deliberately so. Research runs one project at a time
    // and a campaign completes roughly thirteen of them, so a list ordered by
    // depth never reaches its tail: the previous ordering front-loaded missile
    // and mine upgrades and NEVER researched deck guns or counter-battery in
    // any campaign. That made "balanced" a missile/mine specialist wearing a
    // generalist's name, and every sweep that used it was quietly measuring
    // narrow coverage. Ablating deck guns or counter-battery from it changed
    // the score by exactly zero, which is what gave the mis-specification away.
    //
    // One base node per enemy branch comes first; depth is what the tail is
    // for, and reaching the tail is a bonus rather than the plan.
    research: [
      'escortInterceptor.precisionGuidance', // missiles
      'mineSonar.base', // mines
      'deckGun.base', // attack boats
      'hydrophone.base', // torpedoes
      'counterBattery.base', // artillery
      'mcmDrones.base', // mines — the counter, not just the detection
      'depthCharges.base', // torpedoes — likewise
      'missileWarning.base',
      'compartmentalization.low',
      'flak.base', // electronic attack / drones
      'deckGun.autoNearest',
      'counterBattery.autoReturnFire',
      'thermalImaging.base', // smoke
      // Depth from here — anything reached is a bonus, not the plan.
      'mineSonar.improvedRange',
      'baseInterceptor.extendedBurn',
      'escortInterceptor.rapidReload',
      'missileWarning.targetVector',
      'baseInterceptor.strategicAuto',
      'mineSonar.compositeSignature',
      'selfDefense.base',
      'escortInterceptor.localAuto',
      'logistics.expandedBerthing',
    ],
    buys: [
      { kind: 'repair' },
      { kind: 'ammo', upTo: 30 },
      { kind: 'escort', upTo: 3 },
      { kind: 'ship', classId: 'cargo' },
      { kind: 'ability', id: 'scan' },
      { kind: 'base' },
      { kind: 'escortFit' },
      { kind: 'baseModule', id: 'counterBattery' },
      { kind: 'droneAmmo', upTo: 6 },
      { kind: 'module', classId: 'cargo', moduleId: 'mineSonar' },
      { kind: 'module', classId: 'cargo', moduleId: 'hydrophone' },
      { kind: 'module', classId: 'cargo', moduleId: 'reinforcedHull' },
      { kind: 'module', classId: 'tanker', moduleId: 'reinforcedHull' },
      { kind: 'ability', id: 'warthog' },
      { kind: 'ammo', upTo: 45 },
    ],
    escortDoctrine: [
      // A generalist flotilla: one of each role rather than three of one.
      ['deckGun'],
      ['depthCharges'],
      ['mcmDroneLauncher'],
    ],
    transit: FIGHTER,
  },
  {
    name: 'turtle',
    desc: 'Survivability-first: hull, compartmentalization and fire suppression before firepower.',
    formation: 'wide',
    commander: ['shipwright', 'rescueDoctrine', 'salvageTeams'],
    adaptFormation: true,
    research: [
      'compartmentalization.low',
      'compartmentalization.medium',
      'reinforcedHull.medium',
      'fireSuppression.automatic',
      'reinforcedHull.high',
      'compartmentalization.high',
      'escortInterceptor.precisionGuidance',
      'mineSonar.base',
      'logistics.expandedBerthing',
      'antiBoarding.base',
      'antiBoarding.reinforcedAccess',
      'reinforcedHull.extra',
    ],
    buys: [
      { kind: 'repair' },
      { kind: 'ammo', upTo: 22 },
      { kind: 'module', classId: 'cargo', moduleId: 'antiBoarding' },
      { kind: 'ship', classId: 'cargo' },
      { kind: 'module', classId: 'cargo', moduleId: 'reinforcedHull' },
      { kind: 'module', classId: 'cargo', moduleId: 'compartmentalization' },
      { kind: 'module', classId: 'tanker', moduleId: 'reinforcedHull' },
      { kind: 'module', classId: 'tanker', moduleId: 'compartmentalization' },
      { kind: 'module', classId: 'freighter', moduleId: 'reinforcedHull' },
      { kind: 'base' },
      { kind: 'ammo', upTo: 35 },
    ],
    transit: FIGHTER,
  },
  {
    name: 'interceptor-rush',
    desc: 'All-in on missile defense: launchers, ammunition and interceptor research; ignores mines.',
    formation: 'tight',
    commander: ['steadyHands', 'quartermaster', 'rescueDoctrine'],
    research: [
      'escortInterceptor.precisionGuidance',
      'baseInterceptor.extendedBurn',
      'escortInterceptor.rapidReload',
      'baseInterceptor.advancedTracking',
      'escortInterceptor.advancedSeeker',
      'baseInterceptor.maxVelocity',
      'baseInterceptor.strategicAuto',
      'escortInterceptor.localAuto',
      'baseInterceptor.improvedLaunchCycle',
      'escortInterceptor.expandedAuto',
      'baseInterceptor.responsiveAuto',
    ],
    buys: [
      { kind: 'repair' },
      { kind: 'ammo', upTo: 40 },
      { kind: 'escort', upTo: 4 },
      { kind: 'ship', classId: 'cargo' },
      { kind: 'base' },
      { kind: 'ammo', upTo: 70 },
      { kind: 'ability', id: 'warthog' },
    ],
    transit: FIGHTER,
  },
  {
    name: 'sensor-net',
    desc: 'Detection-first: warning receivers, sonar and scan pulses before shooters.',
    formation: 'wide',
    commander: ['salvageTeams', 'rescueDoctrine', 'quartermaster'],
    adaptFormation: true,
    research: [
      'missileWarning.base',
      'mineSonar.base',
      'missileWarning.targetVector',
      'mineSonar.improvedRange',
      'missileWarning.longRange',
      'mineSonar.compositeSignature',
      'missileWarning.precisionTrack',
      'mineSonar.sharedPicture',
      'mcmDrones.base',
      'scanPulse.compositeScan',
      'deckGun.base',
      'deckGun.autoNearest',
      'escortInterceptor.precisionGuidance',
    ],
    buys: [
      { kind: 'repair' },
      { kind: 'ammo', upTo: 25 },
      { kind: 'escort', upTo: 2 },
      { kind: 'ship', classId: 'cargo' },
      { kind: 'ability', id: 'scan' },
      { kind: 'module', classId: 'cargo', moduleId: 'missileWarning' },
      { kind: 'module', classId: 'cargo', moduleId: 'mineSonar' },
      { kind: 'module', classId: 'tanker', moduleId: 'missileWarning' },
      { kind: 'module', classId: 'tanker', moduleId: 'mineSonar' },
      { kind: 'base' },
      { kind: 'escortFit' },
      { kind: 'droneAmmo', upTo: 9 },
      { kind: 'ammo', upTo: 40 },
    ],
    escortDoctrine: [
      ['mcmDroneLauncher'],
      ['deckGun'],
      ['mcmDroneLauncher'],
    ],
    transit: FIGHTER,
  },
  {
    name: 'mine-warfare',
    desc: 'Mine specialist: sonar + scan + drone launchers, minimal missile investment.',
    formation: 'wide',
    commander: ['salvageTeams', 'quartermaster', 'shipwright'],
    research: [
      'mineSonar.base',
      'mcmDrones.base',
      'mineSonar.improvedRange',
      'mcmDrones.extendedLink',
      'mineSonar.compositeSignature',
      'mcmDrones.improvedSortie',
      'mcmDrones.riskDesignator',
      'mineSonar.longRange',
      'mcmDrones.dualSortie',
      'scanPulse.compositeScan',
      'mcmDrones.localAuto',
    ],
    buys: [
      { kind: 'repair' },
      { kind: 'ammo', upTo: 20 },
      { kind: 'escort', upTo: 3 },
      { kind: 'ship', classId: 'cargo' },
      { kind: 'ability', id: 'scan' },
      { kind: 'escortFit' },
      { kind: 'droneAmmo', upTo: 12 },
      { kind: 'module', classId: 'cargo', moduleId: 'mineSonar' },
      { kind: 'module', classId: 'tanker', moduleId: 'mineSonar' },
      { kind: 'base' },
      { kind: 'ammo', upTo: 32 },
    ],
    escortDoctrine: [
      ['mcmDroneLauncher'],
      ['mcmDroneLauncher'],
      ['mcmDroneLauncher'],
    ],
    transit: FIGHTER,
  },
  {
    name: 'asw',
    desc: 'Underwater specialist: hydrophone watch, depth charges and sonar pings — no answer to anything airborne.',
    formation: 'wide',
    commander: ['salvageTeams', 'rescueDoctrine', 'shipwright'],
    research: [
      'hydrophone.base',
      'depthCharges.base',
      'hydrophone.longRange',
      'depthCharges.improvedReload',
      'depthCharges.localAutoDrop',
      'activeSonar.base',
      'hydrophone.lowSigProcessing',
      'depthCharges.expandedPattern',
      'activeSonar.lowSigReturn',
      'depthCharges.extendedThrow',
      'hydrophone.projectedPath',
      'depthCharges.dualRack',
      'activeSonar.extraCharge',
      'depthCharges.leadSolution',
      'hydrophone.sharedPicture',
    ],
    buys: [
      { kind: 'repair' },
      { kind: 'ammo', upTo: 18 },
      { kind: 'escort' },
      { kind: 'escortFit' },
      { kind: 'module', classId: 'cargo', moduleId: 'hydrophone' },
      { kind: 'module', classId: 'tanker', moduleId: 'hydrophone' },
      { kind: 'ability', id: 'sonar' },
      { kind: 'module', classId: 'freighter', moduleId: 'hydrophone' },
      { kind: 'ship', classId: 'cargo' },
      { kind: 'base' },
      { kind: 'ammo', upTo: 30 },
    ],
    escortDoctrine: [
      ['depthCharges'],
      ['depthCharges'],
      ['depthCharges'],
    ],
    transit: FIGHTER,
  },
  {
    name: 'gunboat',
    desc: 'Anti-surface specialist: escort deck guns and anti-boarding drills — no answer to anything it cannot shoot flat.',
    formation: 'tight',
    commander: ['shipwright', 'quartermaster', 'salvageTeams'],
    research: [
      'deckGun.base',
      'deckGun.autoNearest',
      'antiBoarding.base',
      'deckGun.rapidFeed',
      'deckGun.armorPiercing',
      'antiBoarding.reinforcedAccess',
      'deckGun.stabilizedMount',
      'antiBoarding.autoPriority',
      'deckGun.longRangeFireControl',
      'antiBoarding.citadelLockdown',
      'deckGun.heavyAutocannon',
      'deckGun.focusFire',
      'antiBoarding.counterTeam',
      'deckGun.distributedFire',
    ],
    buys: [
      { kind: 'repair' },
      { kind: 'ammo', upTo: 18 },
      { kind: 'escort' },
      { kind: 'escortFit' },
      { kind: 'module', classId: 'cargo', moduleId: 'antiBoarding' },
      { kind: 'module', classId: 'tanker', moduleId: 'antiBoarding' },
      { kind: 'escort' },
      { kind: 'ship', classId: 'cargo' },
      { kind: 'base' },
      { kind: 'ammo', upTo: 30 },
    ],
    escortDoctrine: [
      // Specialised hard: every escort is a gun boat, which the old shared
      // template could express but only by making ALL escorts identical.
      ['deckGun'],
      ['deckGun'],
      ['deckGun'],
    ],
    transit: FIGHTER,
  },
  {
    name: 'shore-battery',
    desc: 'Counter-battery specialist: silences artillery from the friendly shore, and sails wide of the guns.',
    formation: 'wide',
    commander: ['steadyHands', 'quartermaster', 'rescueDoctrine'],
    research: [
      'counterBattery.base',
      'counterBattery.autoReturnFire',
      'counterBattery.extendedRange',
      'counterBattery.rapidCounterFire',
      'counterBattery.coordinatedStrike',
      'counterBattery.sustainedSuppression',
      'counterBattery.barrageDisruption',
      'counterBattery.responsiveCounterFire',
      'escortInterceptor.precisionGuidance',
      'counterBattery.focusSuppression',
    ],
    buys: [
      { kind: 'repair' },
      { kind: 'ammo', upTo: 20 },
      { kind: 'base' },
      { kind: 'baseModule', id: 'counterBattery' },
      { kind: 'base' },
      { kind: 'escort', upTo: 2 },
      { kind: 'ship', classId: 'cargo' },
      { kind: 'ammo', upTo: 34 },
    ],
    transit: FIGHTER,
  },
  {
    // The mirror of `economist`, and it exists to settle a specific question.
    // Six counter branches were researched and then NEVER bought by any build,
    // which has two very different explanations: the equipment is overpriced,
    // or the bots simply fill the convoy to capacity before they ever reach it
    // in the list. Those need different fixes, so one build has to try the
    // other order. Same research and same kit as `balanced` — only the
    // PRIORITY differs: equip the convoy before enlarging it.
    name: 'technologist',
    desc: 'Equips the convoy before it enlarges it — the mirror of economist.',
    formation: 'tight',
    commander: ['salvageTeams', 'rescueDoctrine', 'quartermaster'],
    adaptFormation: true,
    research: [
      'escortInterceptor.precisionGuidance',
      'mineSonar.base',
      'selfDefense.base',
      'missileWarning.base',
      'deckGun.base',
      'hydrophone.base',
      'depthCharges.base',
      'counterBattery.base',
      'mcmDrones.base',
      'compartmentalization.low',
      'flak.base',
      'thermalImaging.base',
      'deckGun.autoNearest',
    ],
    buys: [
      { kind: 'repair' },
      { kind: 'ammo', upTo: 30 },
      // No hull purchase up here at all. The campaign already starts with a
      // convoy that can sail, and this build's whole point is to equip that
      // convoy before enlarging it — the growth intent sits at the bottom of
      // the list instead. (Note `upToCapacity: false` would be the WRONG way to
      // express "just a few": it removes the capacity ceiling rather than
      // lowering it, so the bot buys hulls without limit and never reaches its
      // own modules. That misread made the first run of this comparison
      // measure the opposite of what it claimed.)
      { kind: 'ability', id: 'scan' },
      { kind: 'base' },
      { kind: 'escort' },
      { kind: 'module', classId: 'cargo', moduleId: 'selfDefense' },
      { kind: 'module', classId: 'cargo', moduleId: 'missileWarning' },
      { kind: 'module', classId: 'cargo', moduleId: 'mineSonar' },
      { kind: 'module', classId: 'cargo', moduleId: 'compartmentalization' },
      { kind: 'escortFit' },
      { kind: 'baseModule', id: 'counterBattery' },
      { kind: 'ability', id: 'warthog' },
      { kind: 'selfDefenseAmmo', upTo: 9 },
      { kind: 'droneAmmo', upTo: 6 },
      // Only now does the convoy grow.
      { kind: 'ship', classId: 'cargo' },
      { kind: 'ammo', upTo: 45 },
    ],
    escortDoctrine: [
      ['deckGun', 'depthCharges'],
      ['mcmDroneLauncher', 'deckGun'],
      ['depthCharges', 'mcmDroneLauncher'],
    ],
    transit: FIGHTER,
  },
  {
    name: 'economist',
    desc: 'Greed test: buys hulls and capacity, minimal defense — should be punished if pressure is real.',
    formation: 'sprint',
    commander: ['warChest', 'shipwright', 'quartermaster'],
    research: [
      'logistics.expandedBerthing',
      'escortInterceptor.precisionGuidance',
      'compartmentalization.low',
      'mineSonar.base',
    ],
    buys: [
      { kind: 'repair' },
      { kind: 'ammo', upTo: 18 },
      { kind: 'ship', classId: 'tanker' },
      { kind: 'ship', classId: 'cargo' },
      { kind: 'base' },
    ],
    transit: FIGHTER,
  },
  {
    // Modelled directly on a hand-played pirateNarrows run (see
    // docs/PLAYTEST_FIDELITY.md). It exists because every other persona
    // hand-fires its launchers — an 83% manual share against the 32% that log
    // measured — which makes every auto-fire node in the tree worthless to the
    // sweep. This build drafts automation first and then only takes the shots
    // the automation misses, which is how a human actually plays once they hold
    // localAuto and strategicAuto.
    name: 'automation',
    desc: 'Drafts auto-fire first and lets it work: hand-fires only what the automation would miss.',
    formation: 'tight',
    commander: ['steadyHands', 'salvageTeams'],
    adaptFormation: true,
    research: [
      'escortInterceptor.localAuto',
      'baseInterceptor.strategicAuto',
      'escortInterceptor.highVelocityMotor',
      'escortInterceptor.precisionGuidance',
      'baseInterceptor.improvedLaunchCycle',
      'escortInterceptor.expandedAuto',
      'baseInterceptor.responsiveAuto',
      'warthog.extendedLoiter',
      'warthog.tankBuster',
      'deckGun.base',
      'deckGun.autoNearest',
      'antiBoarding.base',
      'reinforcedHull.medium',
    ],
    buys: [
      { kind: 'repair' },
      { kind: 'ammo', upTo: 35 },
      { kind: 'escort', upTo: 2 },
      { kind: 'base' },
      { kind: 'ability', id: 'scan' },
      { kind: 'ability', id: 'warthog' },
      { kind: 'ship', classId: 'cargo' },
      { kind: 'escortFit' },
      // The hand-played run put reinforced hull on all three classes and spent
      // more on it than on any weapon — mitigation across the whole convoy
      // rather than depth in one counter.
      { kind: 'module', classId: 'cargo', moduleId: 'reinforcedHull' },
      { kind: 'module', classId: 'tanker', moduleId: 'reinforcedHull' },
      { kind: 'module', classId: 'freighter', moduleId: 'reinforcedHull' },
      { kind: 'module', classId: 'cargo', moduleId: 'antiBoarding' },
      { kind: 'ammo', upTo: 50 },
    ],
    escortDoctrine: [['deckGun'], ['deckGun']],
    transit: { ...FIGHTER, intercept: 'sparing' },
  },
  {
    name: 'afk',
    desc: 'Control case: buys nothing, fires nothing. The floor any real build must beat.',
    formation: 'tight',
    commander: [],
    research: [],
    buys: [],
    transit: PASSIVE,
  },
];

export function personaByName(name: string): Persona | undefined {
  return PERSONAS.find((p) => p.name === name);
}

/** Why this persona's Commander loadout is illegal, or null when it is fine.
 *
 *  Checked rather than clamped on purpose. A loadout that silently loses its
 *  third ability because it went a point over budget would make a persona quietly
 *  different from what it says it is — which is exactly the class of bug the
 *  fidelity work exists to catch, and it would be embarrassing to introduce one
 *  while closing them. */
export function commanderLoadoutError(persona: Persona): string | null {
  const ids = persona.commander ?? [];
  const unknown = ids.filter((id) => !COMMANDER_ABILITIES[id]);
  if (unknown.length > 0) return `unknown Commander Ability: ${unknown.join(', ')}`;
  if (new Set(ids).size !== ids.length) return 'duplicate Commander Ability';
  if (ids.length > COMMANDER.abilitySlots) {
    return `${ids.length} abilities exceeds ${COMMANDER.abilitySlots} slots`;
  }
  const points = loadoutPointsUsed(ids);
  if (points > COMMANDER.loadoutPoints) {
    return `${points} loadout points exceeds the ${COMMANDER.loadoutPoints} budget`;
  }
  return null;
}
