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
  buyBaseModule,
  buyDroneAmmo,
  buyEscort,
  buyEscortModule,
  buyModule,
  fleetHasEscortModule,
  buyPdAmmo,
  buyShip,
  repairCost,
  repairFleet,
  setComposition,
  setFormation,
  unlockWarthog,
  unlockHardened,
  unlockScan,
  unlockSmoke,
  unlockSonar,
} from '../../src/sim/campaign';
import { dismissEmptyDraft, selectDraftOption } from '../../src/sim/draft';
import { WORLD } from '../../src/data/tuning';
import type {
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
  /** Interceptor firing: none, or engage whenever a launcher is ready. */
  intercept: 'none' | 'always';
  /** Which threat a ready launcher picks. `leaders` favors the missile closest
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
}

export interface Persona {
  name: string;
  /** One-line description for the report. */
  desc: string;
  formation: FormationId;
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
  if (spendable <= 0 && intent.kind !== 'repair') return false;
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
      return buyModule(c, intent.classId, intent.moduleId);
    case 'escortFit': {
      // Walk the doctrine in order and fit the first thing that is affordable,
      // researched and has a free slot on that escort. One purchase per call so
      // the caller's loop keeps interleaving with the rest of the shopping list.
      const doctrine = persona.escortDoctrine ?? [];
      for (let i = 0; i < c.escortUnits.length; i++) {
        const want = doctrine[i] ?? [];
        for (const moduleId of want) {
          if (buyEscortModule(c, c.escortUnits[i].id, moduleId)) return true;
        }
      }
      return false;
    }
    case 'baseModule':
      return buyBaseModule(c, intent.id);
    case 'ability':
      switch (intent.id) {
        case 'warthog':
          return unlockWarthog(c);
        case 'scan':
          return unlockScan(c);
        case 'sonar':
          return unlockSonar(c);
        case 'smoke':
          return unlockSmoke(c);
        case 'hardened':
          return unlockHardened(c);
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

/** Run a persona's whole procurement phase: formation, then the buy list until
 *  it stops making progress. */
export function procure(c: CampaignState, persona: Persona): void {
  setFormation(c, persona.formation);
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
  fillConvoy(c);
}

/** Resolve the pending technology draft the way this persona would: take the
 *  offered option it ranks highest in its research-preference list, or the
 *  first option when nothing it wanted was offered (the draft is mandatory).
 *  Returns the pick, or null when no draft was pending. */
export function research(c: CampaignState, persona: Persona): ResearchId | null {
  const draft = c.pendingDraft;
  if (!draft) return null;
  if (draft.options.length === 0) {
    dismissEmptyDraft(c);
    return null;
  }
  const preferred = persona.research.find((id) => draft.options.includes(id));
  const pick = preferred ?? draft.options[0];
  return selectDraftOption(c, pick) ? pick : null;
}

// ---------------------------------------------------------------------------
// Transit play
// ---------------------------------------------------------------------------

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
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

/** Per-transit scratch state for a persona's ability pacing. */
export interface TransitMemory {
  lastScanT: number;
  lastWarthogT: number;
  lastSmokeT: number;
  lastSonarT: number;
}

export function newTransitMemory(): TransitMemory {
  return { lastScanT: -99, lastWarthogT: -99, lastSmokeT: -99, lastSonarT: -99 };
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
  if (p.intercept === 'always' && anyLauncherReady(t)) {
    let best: Threat | null = null;
    let bestKey = Infinity;
    for (const threat of t.threats) {
      if (!threat.alive) continue;
      if (threat.kind !== 'missile' && threat.kind !== 'guidedMissile') continue;
      if (threat.claimedByInterceptor) continue;
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

  // Warthog: send it wherever the most surface targets are clustered ahead of
  // the convoy. A sortie is worth spending once there is more than one thing in
  // the wheel — it kills mines outright and grinds boats down over passes.
  if (
    p.useWarthog &&
    t.warthogCharges > 0 &&
    t.time >= t.warthogActiveUntil &&
    t.time - mem.lastWarthogT > 20
  ) {
    const surface = t.threats.filter(
      (th) => th.alive && (th.kind === 'mine' || th.kind === 'attackBoat'),
    );
    let bestX = 0;
    let bestY = 0;
    let bestCount = 0;
    for (const th of surface) {
      // Only water ahead of the convoy is worth a sortie — behind it, whatever
      // is there has already been sailed past.
      if (th.x < center.x - 120) continue;
      const near = surface.filter((o) => dist(o.x, o.y, th.x, th.y) < 200).length;
      if (near > bestCount) {
        bestCount = near;
        bestX = th.x;
        bestY = th.y;
      }
    }
    if (bestCount >= 2) {
      cmds.push({ type: 'ability', ability: 'warthog', x: bestX, y: bestY });
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

const FIGHTER: TransitPolicy = {
  intercept: 'always',
  targeting: 'urgent',
  sweepMines: true,
  useScan: true,
  useWarthog: true,
  useSmoke: true,
  useDepthCharges: true,
  useSonar: true,
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
};

export const PERSONAS: Persona[] = [
  {
    name: 'balanced',
    desc: 'Generalist: one answer to every branch before depth in any of them.',
    formation: 'tight',
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
    name: 'afk',
    desc: 'Control case: buys nothing, fires nothing. The floor any real build must beat.',
    formation: 'tight',
    research: [],
    buys: [],
    transit: PASSIVE,
  },
];

export function personaByName(name: string): Persona | undefined {
  return PERSONAS.find((p) => p.name === name);
}
