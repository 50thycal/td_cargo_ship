// Real-time transit simulation. Pure data-in / data-out: the UI feeds player
// commands into stepTransit and renders whatever is in TransitState. No DOM,
// no timers, no Math.random — the caller owns the RNG and the fixed timestep.
//
// Player-counter rules (which weapon may engage which threat, what each tier
// means numerically) come from the data layer (counters.ts / statTiers.ts).
// The sim VALIDATES target compatibility centrally in handleCommand and the
// automation loops — an invalid engagement is rejected here, not just greyed
// out in the UI.

import { COMBAT, ENEMY_ECONOMY, NAV, SIM, SPAWN, SURVIVORS, WORLD, WRECKAGE } from '../data/tuning';
import { FORMATIONS, SHIP_CLASSES, SHIP_NAMES } from '../data/defs';
import { canEngage, deriveCounterEffects, LOSS_CAUSE_TO_ENEMY_BRANCH } from '../data/counters';
import { applyCommanderCombatEffects } from '../data/commanderAbilities';
import { targetingSkill } from './evolution';
import type { RNG } from './rng';
import type {
  AreaEffect,
  ArtilleryVariant,
  Base,
  BoatVariant,
  CampaignState,
  CombatEffects,
  CounterRoundStats,
  EnemyInstallation,
  Escort,
  EscortModuleId,
  EscortPerformance,
  FormationId,
  LauncherKind,
  ResearchId,
  RoundPlan,
  SensorFamily,
  Ship,
  ShipClassId,
  TechKey,
  Threat,
  ThreatKind,
  TransitCommand,
  TransitEvent,
  TransitState,
} from './types';

// ---------------------------------------------------------------------------
// Research effects
// ---------------------------------------------------------------------------

/** Tier-resolved combat effects for a research set + platform loadout. All
 *  numeric conversion happens in the data layer (deriveCounterEffects), and
 *  Commander Ability modifiers are applied LAST, centrally — the locked
 *  effect flow: base → technology/tactics → equipment → commander → final. */
export function deriveEffects(
  completedResearch: readonly ResearchId[],
  loadout: { escortModules: readonly ('deckGun' | 'mcmDroneLauncher' | 'depthCharges')[]; baseModules: readonly 'counterBattery'[] },
  commanderAbilities: readonly string[] = [],
): CombatEffects {
  const effects = deriveCounterEffects(completedResearch, {
    escortModules: [...loadout.escortModules],
    baseModules: [...loadout.baseModules],
  });
  return applyCommanderCombatEffects(effects, commanderAbilities);
}

// ---------------------------------------------------------------------------
// Spawn scheduling & spacing
// ---------------------------------------------------------------------------

/** Clamp a lane index into the valid corridor range. */
export function clampLane(lane: number): number {
  return Math.max(0, Math.min(WORLD.lanes.length - 1, lane));
}

/** Index of the corridor lane whose center is nearest a world-Y (used to turn a
 *  scan tap into a lane selection). */
export function nearestLane(y: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < WORLD.lanes.length; i++) {
    const d = Math.abs(WORLD.lanes[i] - y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Reference lateral position for escort patrol and ability-effect centers:
 *  the corridor's center lane. */
export function patrolLaneY(_t: TransitState): number {
  return WORLD.lanes[1];
}

/** Schedule ship entries in a pattern that visibly reflects the chosen
 *  formation:
 *   • sprint — single-file volleys: 3-6 ships enter one at a time, nose to
 *     tail, all in ONE lane; then the next volley of 3-6 ships forms up in a
 *     DIFFERENT lane after a longer pause (so the whole round isn't dumped
 *     into a single lane).
 *   • tight  — grouped waves: two or three ships enter TOGETHER, each in a
 *     different lane, then the next wave a while later (a packed convoy).
 *   • wide   — staggered: one ship at a time, alternating across the lanes
 *     (a loose, spread-out stream).
 */
function scheduleSpawns(ships: Ship[], rng: RNG, formation: FormationId): void {
  const order = rng.shuffle(ships.map((_, i) => i));
  const laneCount = WORLD.lanes.length;
  const setJitter = (ship: Ship): void => {
    ship.lateralSeed = rng.range(-1, 1);
    ship.speedVariance = rng.range(1 - SPAWN.speedVariance, 1 + SPAWN.speedVariance);
  };

  if (formation === 'sprint') {
    let t = SPAWN.firstDelay;
    let i = 0;
    let lastLane = -1;
    while (i < order.length) {
      // Pick a lane different from the previous volley's, so the column
      // visibly relocates instead of refilling the same line all round.
      let lane = rng.int(laneCount);
      if (laneCount > 1) {
        while (lane === lastLane) lane = rng.int(laneCount);
      }
      lastLane = lane;
      const volleySize = Math.min(
        SPAWN.sprintVolleyMin + rng.int(SPAWN.sprintVolleyMax - SPAWN.sprintVolleyMin + 1),
        order.length - i,
      );
      for (let v = 0; v < volleySize; v++) {
        const ship = ships[order[i + v]];
        setJitter(ship);
        ship.laneIndex = lane;
        ship.spawnTime = Math.max(SPAWN.firstDelay, t + rng.range(-SPAWN.timeJitter, SPAWN.timeJitter));
        // Nose-to-tail within the volley; a longer pause after the volley's
        // last ship before the next volley's first ship enters.
        t += v === volleySize - 1 ? SPAWN.sprintVolleyGap : SPAWN.sprintInterval;
      }
      i += volleySize;
    }
    return;
  }

  if (formation === 'tight') {
    let t = SPAWN.firstDelay;
    let i = 0;
    while (i < order.length) {
      const groupSize = Math.min(laneCount, order.length - i);
      // Distinct lanes for this wave, shuffled so groups aren't always 0,1,2.
      const lanes = rng.shuffle([...Array(laneCount).keys()]).slice(0, groupSize);
      for (let g = 0; g < groupSize; g++) {
        const ship = ships[order[i + g]];
        setJitter(ship);
        ship.laneIndex = lanes[g];
        ship.spawnTime = Math.max(SPAWN.firstDelay, t + rng.range(0, SPAWN.tightWaveJitter));
      }
      i += groupSize;
      t += SPAWN.tightWaveInterval;
    }
    return;
  }

  // wide (staggered)
  let laneCursor = rng.int(laneCount);
  let t = SPAWN.firstDelay;
  for (const idx of order) {
    const ship = ships[idx];
    setJitter(ship);
    ship.laneIndex = laneCursor % laneCount;
    ship.spawnTime = Math.max(SPAWN.firstDelay, t + rng.range(-SPAWN.timeJitter, SPAWN.timeJitter));
    laneCursor++;
    t += SPAWN.interval;
  }
}

const ESCORT_SLOTS = [
  { dx: 60, dy: -110 },
  { dx: -40, dy: 110 },
  { dx: 30, dy: 0 },
];

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

function newCounterStats(t: {
  ecm: number;
  scan: number;
  sonar: number;
  smoke: number;
  reboot: number;
}): CounterRoundStats {
  return {
    manualShots: 0,
    autoShots: 0,
    manualIntercepts: 0,
    autoIntercepts: 0,
    duplicateShotsAvoided: 0,
    duplicateShots: 0,
    selfDefenseShots: 0,
    selfDefenseKills: 0,
    droneLaunches: 0,
    droneKills: 0,
    depthChargesDropped: 0,
    depthChargeKills: 0,
    deckGunRounds: 0,
    deckGunKills: 0,
    counterBatteryShots: 0,
    counterBatterySuppressions: 0,
    flakShots: 0,
    flakKills: 0,
    detections: {
      mineSonar: 0,
      hydrophone: 0,
      scanPulse: 0,
      activeSonar: 0,
      thermal: 0,
      missileWarning: 0,
    },
    damagePrevented: {
      compartmentalization: 0,
      reinforcedHull: 0,
      fireSuppression: 0,
    },
    boardingAttempts: 0,
    boardingInterrupted: 0,
    boardingCaptures: 0,
    jammingSeconds: 0,
    jammingMitigatedSeconds: 0,
    charges: {
      ecm: { available: t.ecm, used: 0 },
      scan: { available: t.scan, used: 0 },
      sonar: { available: t.sonar, used: 0 },
      smoke: { available: t.smoke, used: 0 },
      reboot: { available: t.reboot, used: 0 },
    },
  };
}

export function createTransit(campaign: CampaignState, plan: RoundPlan, rng: RNG): TransitState {
  // Research TIERS stay fleet-wide — a better depth-charge doctrine improves
  // every launcher the player owns. Only the question "does this hull carry
  // the hardware" is per escort, and that is answered off the escort itself.
  // The union here is what the tier derivation needs: whether the capability
  // exists in the flotilla at all.
  const fleetEscortModules = [
    ...new Set(campaign.escortUnits.flatMap((u) => u.modules)),
  ] as EscortModuleId[];
  const effects = deriveEffects(
    campaign.completedResearch,
    {
      escortModules: fleetEscortModules,
      baseModules: campaign.baseModules,
    },
    campaign.commanderAbilities ?? [],
  );
  // Dev god mode: hulls shrug off all damage this transit.
  if (campaign.godMode) effects.damageTakenMult = 0;
  const god = !!campaign.godMode;
  const names = rng.shuffle([...SHIP_NAMES]);
  let nextId = 1;

  const ships: Ship[] = [];
  const classIds = Object.keys(campaign.composition) as ShipClassId[];
  for (const classId of classIds) {
    const def = SHIP_CLASSES[classId];
    const modules = campaign.classModules[classId] ?? [];
    for (let i = 0; i < campaign.composition[classId]; i++) {
      const maxHp = def.hp + (modules.includes('reinforcedHull') ? effects.hullBonusHp : 0);
      ships.push({
        id: nextId++,
        name: names[(ships.length) % names.length],
        classId,
        x: WORLD.spawnX,
        y: WORLD.lanes[1],
        hp: maxHp,
        maxHp,
        alive: true,
        delivered: false,
        modules: [...modules],
        spawnTime: 0,
        spawned: false,
        laneIndex: 1,
        lateralSeed: 0,
        speedVariance: 1,
        heading: 0,
        speed: 0,
        fireSeconds: 0,
        pdCooldown: 0,
        pdShots: modules.includes('selfDefense') ? effects.selfDefense.magazine : 0,
        flakShots: modules.includes('flak') ? effects.flak.magazine : 0,
        flakCooldown: 0,
        smokeGraceUntil: 0,
        straggling: false,
        damageByBranch: {},
        boardingSeconds: 0,
        boardingLockUntil: 0,
        lockdownUsed: false,
        rejectionUsed: false,
        captured: false,
        captureExitAt: 0,
        disabledUntil: 0,
      });
    }
  }
  // Individual entry timing/lane/jitter — ships stream in one at a time
  // rather than appearing as a single block.
  scheduleSpawns(ships, rng, campaign.formation);

  // Unrepaired damage from previous rounds shows up on this convoy. Whatever
  // does not fit (capped at 40% of each hull) stays in the campaign pool —
  // resolveTransit uses pendingDamageApplied to conserve the remainder.
  let pending = campaign.pendingDamage;
  let pendingApplied = 0;
  for (const ship of ships) {
    if (pending <= 0) break;
    const applied = Math.min(pending, Math.floor(ship.maxHp * 0.4));
    ship.hp -= applied;
    pending -= applied;
    pendingApplied += applied;
  }

  const centerLaneY = WORLD.lanes[1];
  const ecmCharges = god ? 99 : campaign.ecmUnlocked ? effects.abilities.ecm.charges : 0;
  const scanCharges = god ? 99 : campaign.scanUnlocked ? effects.abilities.scan.charges : 0;
  const sonarCharges = god ? 99 : campaign.sonarUnlocked ? effects.abilities.sonar.charges : 0;
  const smokeCharges = god ? 99 : campaign.smokeUnlocked ? effects.abilities.smoke.charges : 0;
  const rebootCharges = god ? 99 : campaign.hardenedUnlocked ? effects.hardened.rebootCharges : 0;

  const state: TransitState = {
    time: 0,
    over: false,
    anchorX: WORLD.spawnX,
    formation: campaign.formation,
    ships,
    escorts: [],
    bases: [],
    threats: [],
    installations: plan.installations.map((p) => ({
      id: nextId++,
      kind: 'artillery' as const,
      x: p.x,
      y: p.y,
      variant: p.variant,
      suppressedUntil: 0,
      strikes: 0,
      destroyed: false,
      // Guns open up after a short lay-in rather than the instant the round
      // starts, so the first shells are a beat the player can read.
      cooldown: COMBAT.artillery.reload[p.variant] * 1.5,
      walkShots: 0,
      barrageLeft: 0,
      barrageFromX: p.x,
      barrageY: WORLD.lanes[0],
      barrageNextAt: 8,
    })),
    shells: [],
    boatShots: [],
    wreckage: [],
    survivors: [],
    smokeQueue: [...plan.smoke].sort((a, b) => a.time - b.time),
    eaQueue: buildEaQueue(plan),
    pendingJamming: plan.electronic.jamming,
    interceptors: [],
    drones: [],
    depthChargeShots: [],
    aircraft: [],
    areaEffects: [],
    escortModules: fleetEscortModules,
    baseModules: [...campaign.baseModules],
    autoFire: { ...campaign.autoFire },
    protectedChannels: campaign.protectedChannels.slice(0, effects.hardened.protectedChannelCount),
    ammo: god ? 9999 : campaign.ammo,
    droneAmmo: god ? 9999 : campaign.droneAmmo,
    pdAmmo: god ? 9999 : campaign.pdAmmo,
    ecmCharges,
    ecmActiveUntil: -1,
    ecmCenterX: 0,
    ecmCenterY: 0,
    scanCharges,
    sonarCharges,
    smokeCharges,
    rebootCharges,
    jammingSeconds: 0,
    // How sharply the enemy aims comes from its Targeting Doctrine rung, which
    // it unlocks by FIELDING branches — a broader arsenal aims smarter, not
    // just louder (ENEMY_ATTACKS.md). Early campaigns still ramp, because the
    // enemy has only reached the low rungs by then.
    enemyTargetingSkill: targetingSkill(campaign.evolution.economy),
    spawnQueue: [...plan.spawns].sort((a, b) => a.time - b.time),
    events: [],
    stats: {
      launched: ships.length,
      delivered: 0,
      lost: 0,
      valueSent: ships.reduce((sum, s) => sum + SHIP_CLASSES[s.classId].value, 0),
      valueDelivered: 0,
      missilesSpawned: 0,
      missilesIntercepted: 0,
      playerIntercepts: 0,
      baseIntercepts: 0,
      escortIntercepts: 0,
      interceptMisses: 0,
      pdKills: 0,
      ecmKills: 0,
      minesTotal: plan.mines.length,
      minesRevealed: 0,
      minesDetonated: 0,
      minesSwept: 0,
      torpedoesLaunched: 0,
      torpedoesDetected: 0,
      torpedoesHit: 0,
      torpedoesDestroyed: 0,
      boatsLaunched: 0,
      boatsSunk: 0,
      boatKills: 0,
      boatRoundsFired: 0,
      boatRoundsHit: 0,
      shipsCaptured: 0,
      shellsFired: 0,
      shellHits: 0,
      batteriesDestroyed: 0,
      smokeCloudsLaid: 0,
      concealedSeconds: 0,
      reconPlanes: 0,
      disablingDrones: 0,
      aircraftDowned: 0,
      shipDisabledSeconds: 0,
      ammoUsed: 0,
      ecmUsed: 0,
      scanUsed: 0,
      escortsLost: 0,
      escortPerformance: {},
      basesLost: 0,
      launchersDisabled: 0,
      counter: newCounterStats({
        ecm: ecmCharges,
        scan: scanCharges,
        sonar: sonarCharges,
        smoke: smokeCharges,
        reboot: rebootCharges,
      }),
      enemyBranch: {},
      wreckageSpawned: 0,
      wreckageRecovered: 0,
      wreckageExpired: 0,
      wreckageByBranch: {},
      recoveryEscortSeconds: 0,
      survivorsSpawned: 0,
      survivorsRescued: 0,
      survivorsLost: 0,
    },
    effects,
    baseSpeed: Math.min(
      ...classIds.filter((c) => campaign.composition[c] > 0).map((c) => SHIP_CLASSES[c].speed),
    ),
    nextEntityId: nextId,
    debutsSeen: [],
    pendingDamageApplied: pendingApplied,
  };

  // Escorts carry unrepaired damage between rounds (distributed across them),
  // just like cargo hulls — the player repairs them in procurement.
  // One sim escort per commissioned unit, each sailing with ITS OWN name,
  // loadout and carried damage. Magazines are sized from that escort's own
  // fit: a hull with no depth-charge launcher puts to sea with no depth
  // charges, rather than inheriting a fleet-wide magazine.
  const sailingUnits = campaign.escortUnits.slice(0, ESCORT_SLOTS.length);
  for (let i = 0; i < sailingUnits.length; i++) {
    const unit = sailingUnits[i];
    const carried = Math.min(unit.damage, COMBAT.escort.hp * 0.6);
    const dcMagazine = unit.modules.includes('depthCharges') ? effects.depthCharge.magazine : 0;
    const droneSorties = unit.modules.includes('mcmDroneLauncher')
      ? effects.mcm.dualSortie
        ? 2
        : 1
      : 0;
    state.escorts.push({
      id: state.nextEntityId++,
      unitId: unit.id,
      name: unit.name,
      modules: [...unit.modules],
      x: WORLD.spawnX + ESCORT_SLOTS[i].dx,
      y: centerLaneY + ESCORT_SLOTS[i].dy,
      slotDx: ESCORT_SLOTS[i].dx,
      slotDy: ESCORT_SLOTS[i].dy,
      cooldown: 0,
      heading: 0,
      hp: COMBAT.escort.hp - carried,
      maxHp: COMBAT.escort.hp,
      alive: true,
      disabledUntil: 0,
      moveTarget: null,
      stationed: false,
      autoCooldown: 0,
      mcmAutoCooldown: 0,
      droneCooldown: 0,
      droneReady: god && droneSorties > 0 ? 99 : droneSorties,
      dcCooldown: 0,
      dcShots: god && dcMagazine > 0 ? 99 : dcMagazine,
      dcAutoCooldown: 0,
      gunCooldown: 0,
      gunTargetId: null,
    });
    state.stats.escortPerformance[unit.id] = {
      id: unit.id,
      name: unit.name,
      modules: [...unit.modules],
      intercepts: 0,
      boatKills: 0,
      torpedoKills: 0,
      minesSwept: 0,
      damageTaken: 0,
      lost: false,
    };
  }

  // Shore batteries spread along the friendly (bottom) shore. They too carry
  // unrepaired damage between rounds.
  const baseCount = Math.max(0, campaign.bases);
  let basePending = campaign.baseDamage;
  for (let i = 0; i < baseCount; i++) {
    const frac = baseCount === 1 ? 0.5 : i / (baseCount - 1);
    const share = baseCount > 0 ? Math.min(basePending, COMBAT.base.hp * 0.6) : 0;
    basePending -= share;
    state.bases.push({
      id: state.nextEntityId++,
      x: 360 + frac * (WORLD.width - 720),
      y: WORLD.baseLine,
      cooldown: 0,
      hp: COMBAT.base.hp - share,
      maxHp: COMBAT.base.hp,
      alive: true,
      disabledUntil: 0,
      autoCooldown: 0,
      cbCooldown: 0,
      cbAutoCooldown: 0,
    });
  }

  for (const mine of plan.mines) {
    state.threats.push({
      id: state.nextEntityId++,
      kind: 'mine',
      x: mine.x,
      y: mine.y,
      vx: 0,
      vy: 0,
      speed: 0,
      alive: true,
      revealed: false,
      lowSig: mine.lowSig,
      claimedByInterceptor: false,
    });
  }

  return state;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** Is a point currently inside a deployed ECM plane's jamming orbit? Missiles
 *  there are scrambled and, if they linger, cook off. */
function jammingAt(t: TransitState, x: number, y: number): boolean {
  for (const ac of t.aircraft) {
    if (ac.role !== 'ecm' || ac.phase !== 'onStation') continue;
    if (dist(x, y, ac.centerX, ac.centerY) <= t.effects.abilities.ecm.radius) return true;
  }
  return false;
}

/** Is a point inside an active player smoke cloud? */
function inPlayerSmoke(t: TransitState, x: number, y: number): boolean {
  for (const fx of t.areaEffects) {
    if (fx.kind !== 'smoke' || t.time >= fx.until) continue;
    if (dist(x, y, fx.x, fx.y) <= fx.radius) return true;
  }
  return false;
}

/** Enemy smoke covering a point, if any.
 *
 *  Thermal/radar imaging is the see-through counter, and it is deliberately
 *  LOCAL rather than a global switch: an equipped hull burns through the cloud
 *  within its own range, so the module has to be carried near the trouble to be
 *  worth anything. Blinding smoke is thicker and needs the Blinding-Smoke
 *  Resistance node on top of the base module. */
function enemySmokeAt(t: TransitState, x: number, y: number): AreaEffect | null {
  for (const fx of t.areaEffects) {
    if (fx.kind !== 'enemySmoke' || t.time >= fx.until) continue;
    if (dist(x, y, fx.x, fx.y) > fx.radius) continue;
    if (fx.blinding && !t.effects.thermal.blindingResistance) return fx;
    const seen = activeShips(t).some(
      (s) => s.modules.includes('thermalImaging') && dist(s.x, s.y, x, y) <= t.effects.thermal.range,
    );
    if (!seen) return fx;
  }
  return null;
}

/** Is an enemy recon plane airborne right now? While one is, every launcher's
 *  accuracy is degraded (COMBAT.electronic.reconAccuracyPenalty), which is both
 *  the reason to shoot it and the reason its branch earns. */
function reconOverhead(t: TransitState): boolean {
  return t.threats.some((th) => th.alive && th.kind === 'reconPlane');
}

/** Mark every threat sitting in enemy smoke as concealed.
 *
 *  The LOCKED soft model: a concealed threat keeps a faint bearing marker so
 *  the player can still tell something is coming from over there, but loses its
 *  precise tap-target until it clears. It is never removed from the sim — the
 *  missile is still flying and will still hit; the player just cannot point at
 *  it. Fully hiding it would be too punishing in a tap-to-target game. */
function updateConcealment(t: TransitState, dt: number): void {
  for (const threat of t.threats) {
    if (!threat.alive) {
      threat.concealed = false;
      continue;
    }
    const cloud = enemySmokeAt(t, threat.x, threat.y);
    threat.concealed = cloud !== null;
    if (cloud) {
      threat.wasConcealed = true;
      t.stats.concealedSeconds += dt;
    }
  }
}

/** Is a sensor family functional right now? Enemy sensor jamming blacks out
 *  detection except for hardened protected channels (jamming itself is an
 *  enemy ability with no shootable object — see ENEMY_ATTACKS.md). */
function sensorAvailable(t: TransitState, family: SensorFamily): boolean {
  return t.jammingSeconds <= 0 || t.protectedChannels.includes(family);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Shortest signed angle difference a - b, wrapped to [-pi, pi]. */
function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Is the lateral lane a ship wants to slide into (to overtake) occupied by
 *  another hull? Used to decide whether to commit to a pass or slow and wait. */
function passSideBlocked(
  shipId: number,
  wantSign: number,
  alongLimit: number,
  obstacles: { id: number; x: number; y: number; r: number }[],
  x: number,
  y: number,
  r: number,
  fx: number,
  fy: number,
): boolean {
  for (const o of obstacles) {
    if (o.id === shipId) continue;
    const dx = o.x - x;
    const dy = o.y - y;
    const along = dx * fx + dy * fy;
    const lat = -dx * fy + dy * fx;
    if (along < -15 || along > alongLimit + 70) continue;
    if (Math.sign(lat) === wantSign && Math.abs(lat) > 3 && Math.abs(lat) < r + o.r + NAV.laneBand + 40) {
      return true;
    }
  }
  return false;
}

function isActive(s: Ship): boolean {
  return s.spawned && s.alive && !s.delivered;
}

function activeShips(t: TransitState): Ship[] {
  return t.ships.filter(isActive);
}

/** Ships the enemy may fire on: active hulls that have NOT already effectively
 *  scored. A hull within deliverSafeMargin of the line will cross before any
 *  missile could reach it, so targeting it just wastes a missile on a delivered
 *  ship — the enemy skips it. */
function targetableShips(t: TransitState): Ship[] {
  const cutoff = WORLD.deliverX - COMBAT.deliverSafeMargin;
  return t.ships.filter((s) => isActive(s) && s.x < cutoff);
}

function pushEvent(t: TransitState, ev: Omit<TransitEvent, 't'>): void {
  t.events.push({ t: t.time, ...ev });
}

function announceDebut(t: TransitState, key: TechKey): void {
  if (t.debutsSeen.includes(key)) return;
  t.debutsSeen.push(key);
  pushEvent(t, { type: 'techDebut', detail: key });
}

/** Torpedo debuts. Called wherever the player learns a torpedo exists — on
 *  detection, or on impact if it was never found. A revealed weapon shows what
 *  it is: a homing run visibly tracks, a wakeless one is identified by what it
 *  did NOT leave behind. */
function announceTorpedo(t: TransitState, threat: Threat): void {
  announceDebut(t, 'torpedo');
  if (threat.homing) announceDebut(t, 'homingTorpedo');
  if (threat.lowSig) announceDebut(t, 'lowSigTorpedo');
}

/** Attack-boat debuts. Boats are surface craft in plain sight, so the player
 *  learns what they are facing the moment one puts to sea — no detection
 *  gate, unlike the underwater branch. */
function announceBoat(t: TransitState, variant: BoatVariant): void {
  announceDebut(t, 'attackBoat');
  if (variant === 'rocket') announceDebut(t, 'rocketBoat');
  if (variant === 'boarding') announceDebut(t, 'boardingBoat');
}

/** Rough seconds until a missile reaches whatever it is aimed at (used by the
 *  responsive-auto and coordinated-fire prioritizations). */
function timeToImpact(t: TransitState, threat: Threat): number {
  let tx: number | undefined;
  let ty: number | undefined;
  if (threat.targetKind === 'escort') {
    const esc = t.escorts.find((e) => e.id === threat.targetEntityId && e.alive);
    if (esc) {
      tx = esc.x;
      ty = esc.y;
    }
  } else if (threat.kind === 'guidedMissile') {
    const ship = t.ships.find((s) => s.id === threat.targetShipId && s.alive && !s.delivered);
    if (ship) {
      tx = ship.x;
      ty = ship.y;
    }
  }
  if (tx === undefined) {
    tx = threat.targetX;
    ty = threat.targetY;
  }
  if (tx === undefined || ty === undefined) return 999;
  return dist(threat.x, threat.y, tx, ty) / Math.max(1, threat.speed);
}

type MissileTarget =
  | { kind: 'ship'; ship: Ship }
  | { kind: 'escort'; escort: Escort };

/** Skill-scaled weight bump for how appealing a target is: closer to the firing
 *  site and more wounded targets get favored as the enemy grows more competent
 *  over the campaign. At skill 0 this returns 1 (pure value/straggler weighting,
 *  the near-random early behavior). Player smoke DEGRADES this: a ship inside a
 *  defensive cloud is targeted with a less sophisticated preference (one
 *  doctrine tier less; a full reset when dense). */
function targetingBias(
  t: TransitState,
  x: number,
  y: number,
  hpFrac: number,
  siteX: number,
  siteY: number,
): number {
  let skill = t.enemyTargetingSkill;
  if (skill <= 0) return 1;
  if (t.effects.smokeDegradation > 0 && inPlayerSmoke(t, x, y)) {
    skill *= 1 - t.effects.smokeDegradation;
  }
  if (skill <= 0) return 1;
  const proximity = clamp(1 - dist(x, y, siteX, siteY) / WORLD.width, 0, 1);
  const wounded = clamp(1 - hpFrac, 0, 1);
  return (
    1 +
    skill *
      (proximity * COMBAT.targetingProximityWeight + wounded * COMBAT.targetingWoundedWeight)
  );
}

/** Choose what a missile aims at: mostly cargo ships (weighted by value and
 *  straggler-preference), but escorts are in the pool too — so the enemy will
 *  occasionally single one out. As the campaign progresses the enemy also
 *  favors closer and lower-health targets (see targetingBias). Returns null only
 *  if nothing is targetable. */
function pickMissileTarget(
  t: TransitState,
  rng: RNG,
  ships: Ship[],
  escorts: Escort[],
  straggleWeight: number,
  siteX: number,
  siteY: number,
): MissileTarget | null {
  const entries: { target: MissileTarget; weight: number }[] = [];
  for (const s of ships) {
    const base = SHIP_CLASSES[s.classId].value * (s.straggling ? straggleWeight : 1);
    entries.push({
      target: { kind: 'ship', ship: s },
      weight: base * targetingBias(t, s.x, s.y, s.hp / s.maxHp, siteX, siteY),
    });
  }
  for (const e of escorts) {
    if (!e.alive) continue;
    entries.push({
      target: { kind: 'escort', escort: e },
      weight: COMBAT.escort.targetWeight * targetingBias(t, e.x, e.y, e.hp / e.maxHp, siteX, siteY),
    });
  }
  if (entries.length === 0) return null;
  const total = entries.reduce((a, e) => a + e.weight, 0);
  let roll = rng.next() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll <= 0) return e.target;
  }
  return entries[entries.length - 1].target;
}

/** Credit an enemy BRANCH with what its attack just achieved. The enemy's
 *  procurement economy divides this by what it spent to get ROI, which is what
 *  makes it pivot away from attacks the player has countered. Causes that are
 *  not a branch's doing (a tanker's secondary blast, a ship lost at sea) map to
 *  'collateral'/'attrition' and are deliberately not credited to anyone. */
function creditEnemyBranch(
  t: TransitState,
  cause: string,
  damage: number,
  killed: boolean,
): void {
  const branch = branchOf(cause);
  if (!branch) return;
  const entry = (t.stats.enemyBranch[branch] ??= { damage: 0, kills: 0 });
  entry.damage += damage;
  if (killed) entry.kills++;
}

/** The enemy branch behind a loss cause, or null when it belongs to nobody
 *  (a tanker's secondary blast, a ship lost at sea). */
function branchOf(cause: string): string | null {
  const bare = cause.replace(/^(escort|base):/, '');
  const branch = LOSS_CAUSE_TO_ENEMY_BRANCH[bare];
  if (!branch || branch === 'collateral' || branch === 'attrition') return null;
  return branch;
}

/** Split a kill across the branches that actually did the damage.
 *
 *  Kill credit used to go entirely to whichever attack landed the final blow,
 *  which quietly decided the whole economy: a mine does 115 to a 100hp hull and
 *  therefore almost always finishes, while a 34-damage missile almost never
 *  does. Missiles measured at ~1200 budget per kill against a mine's ~70, not
 *  because they achieved nothing — a third of them got through and they dealt
 *  50k damage across a sweep — but because something else was always credited
 *  with the hull they had softened. The allocator read that as "missiles do not
 *  work" and it was an artifact of the scoring, not the sim. */
function creditKillShare(t: TransitState, ship: Ship, finisher: string): void {
  const tally = { ...ship.damageByBranch };
  // The finishing blow counts even if it dealt no tracked damage (a capture).
  const finishBranch = branchOf(finisher);
  if (finishBranch && !(finishBranch in tally)) tally[finishBranch] = 0;
  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  if (total <= 0) {
    // No damage tracked (capture, or a one-shot that bypassed the tally):
    // the finisher takes the whole kill.
    if (finishBranch) {
      const entry = (t.stats.enemyBranch[finishBranch] ??= { damage: 0, kills: 0 });
      entry.kills += 1;
    }
    return;
  }
  for (const [branch, dealt] of Object.entries(tally)) {
    if (dealt <= 0) continue;
    const entry = (t.stats.enemyBranch[branch] ??= { damage: 0, kills: 0 });
    entry.kills += dealt / total;
  }
}

function damageShip(
  t: TransitState,
  ship: Ship,
  amount: number,
  cause: string,
  rng: RNG,
  canIgnite: boolean,
  /** The threat that dealt this, when there is one. Only used to work out
   *  whether a support branch enabled the hit — a missile the player never got
   *  a clean look at pays the smoke that hid it. */
  source?: Threat,
): void {
  if (!ship.alive || ship.delivered) return;
  let dealt = amount * t.effects.damageTakenMult;
  // Compartmentalization: equipped hulls shed a fraction AFTER the hit lands.
  // Never touches detection or interception.
  if (ship.modules.includes('compartmentalization') && t.effects.compartmentReduction > 0) {
    const prevented = dealt * t.effects.compartmentReduction;
    dealt -= prevented;
    t.stats.counter.damagePrevented.compartmentalization += prevented;
  }
  ship.hp -= dealt;
  creditEnemyBranch(t, cause, dealt, false);
  // Remember who wore this hull down, so the kill can be split fairly later.
  const branch = branchOf(cause);
  if (branch) ship.damageByBranch[branch] = (ship.damageByBranch[branch] ?? 0) + dealt;
  creditAssist(t, ship, dealt, source);
  pushEvent(t, { type: 'shipHit', shipId: ship.id, shipName: ship.name, cause });
  if (canIgnite && ship.hp > 0) {
    const fs = ship.modules.includes('fireSuppression');
    const fx = t.effects.fire;
    if (!(fs && fx.immune)) {
      if (rng.chance(COMBAT.fireChance)) {
        let seconds: number = COMBAT.fireSeconds;
        if (fs) {
          seconds = t.effects.autoExtinguish ? 1 : COMBAT.fireSeconds * fx.durationMult;
          t.stats.counter.damagePrevented.fireSuppression +=
            (COMBAT.fireSeconds - seconds) * COMBAT.fireDps;
        } else if (t.effects.autoExtinguish) {
          seconds = 1;
        }
        ship.fireSeconds = seconds;
      }
    } else {
      t.stats.counter.damagePrevented.fireSuppression += COMBAT.fireChance * COMBAT.fireSeconds * COMBAT.fireDps;
    }
  }
  if (ship.hp <= 0) killShip(t, ship, cause);
}

/** Bonus splash from a DIRECT hit into hulls packed alongside — the cost of a
 *  tight formation. Radius is set by the formation (0 = isolated hits). Does not
 *  ignite fires and never touches the ship that took the direct hit. */
function chainSplash(t: TransitState, x: number, y: number, exceptId: number, rng: RNG): void {
  const radius = FORMATIONS[t.formation].chainSplashRadius;
  if (radius <= 0) return;
  for (const other of activeShips(t)) {
    if (other.id === exceptId) continue;
    if (dist(x, y, other.x, other.y) <= radius) {
      damageShip(t, other, COMBAT.missile.splashDamage, 'chain', rng, false);
    }
  }
}

/** Causes that do NOT leave a crew in the water. Both are structural, not
 *  random: a captured hull sails away with her people aboard, and a timeout
 *  loss resolves as the transit ends, leaving no round in which to rescue. */
const NO_SURVIVOR_CAUSES = new Set(['captured', 'timeout']);

function killShip(t: TransitState, ship: Ship, cause: string): void {
  if (!ship.alive) return;
  ship.alive = false;
  ship.hp = 0;
  t.stats.lost++;
  creditKillShare(t, ship, cause);
  pushEvent(t, { type: 'shipLost', shipId: ship.id, shipName: ship.name, cause });
  // Every ordinary sinking puts a crew in the water — no roll, and no
  // dependence on whether the caller happened to have an RNG to hand. That
  // optional-rng threading was itself a source of the inconsistency: a hull
  // sunk by boat gunfire silently never spawned survivors at all.
  if (!NO_SURVIVOR_CAUSES.has(cause)) spawnSurvivors(t, ship);
  const def = SHIP_CLASSES[ship.classId];
  if (def.explodes) {
    const radius = def.explodes.radius * FORMATIONS[t.formation].collateralMult;
    for (const other of activeShips(t)) {
      if (other.id === ship.id) continue;
      if (dist(ship.x, ship.y, other.x, other.y) <= radius) {
        // Explosion damage does not chain-ignite further explosions' fires.
        other.hp -= def.explodes.damage * t.effects.damageTakenMult;
        pushEvent(t, { type: 'shipHit', shipId: other.id, shipName: other.name, cause: 'explosion' });
        if (other.hp <= 0) killShip(t, other, 'explosion');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Wreckage recovery & crew rescue — the roguelite loop's tactical layer
// ---------------------------------------------------------------------------

/** Threat kind → the enemy branch family its wreckage teaches about. */
const WRECKAGE_BRANCH: Partial<Record<ThreatKind, string>> = {
  missile: 'missiles',
  guidedMissile: 'missiles',
  mine: 'mines',
  torpedo: 'torpedoes',
  attackBoat: 'attackBoats',
  reconPlane: 'electronic',
  disablingDrone: 'electronic',
};

/** Roll for a recoverable wreckage field where a PLAYER-DESTROYED physical
 *  threat died. Threats that expend themselves (a mine detonating against a
 *  hull, a missile striking home) leave nothing — only kills call this. */
function maybeSpawnWreckage(t: TransitState, threat: Threat, rng: RNG): void {
  const branch = WRECKAGE_BRANCH[threat.kind];
  const chance = WRECKAGE.dropChance[threat.kind] ?? 0;
  if (!branch || chance <= 0 || !rng.chance(chance)) return;
  t.wreckage.push({
    id: t.nextEntityId++,
    // Clamped into open water so a kill near a shore still leaves a field an
    // escort can actually sail to.
    x: clamp(threat.x, 80, WORLD.width - 80),
    y: clamp(threat.y, 160, WORLD.baseLine - 60),
    branch,
    threatKind: threat.kind,
    required: WRECKAGE.recoverSeconds,
    progress: 0,
    expiresAt: t.time + WRECKAGE.lifetimeSeconds,
    recovered: false,
    expired: false,
  });
  t.stats.wreckageSpawned++;
  pushEvent(t, { type: 'wreckageSpawned', threatKind: threat.kind });
}

/** Put this hull's crew in the water where she went down.
 *
 *  EVERY ordinary sinking spawns survivors — no roll. A coin flip made the
 *  beat arbitrary: two identical losses, one with a crew to save and one
 *  without, and nothing on screen to explain the difference. Now a sinking
 *  always leaves someone to go back for, which is what gives the loss weight
 *  and gives escorts a standing job beyond intercepting.
 *
 *  The exceptions are narrow and both structural rather than random:
 *   • CAPTURED hulls — the enemy sails away with the crew aboard; there is
 *     nobody in the water to recover.
 *   • TIMEOUT losses — these resolve as the transit ends, so there would be
 *     no round left in which to attempt the rescue.
 *  Both are enforced by the caller (killShip), which simply does not call
 *  this for those causes. */
function spawnSurvivors(t: TransitState, ship: Ship): void {
  t.survivors.push({
    id: t.nextEntityId++,
    x: clamp(ship.x, 80, WORLD.width - 80),
    y: clamp(ship.y, 160, WORLD.baseLine - 60),
    shipName: ship.name,
    required: SURVIVORS.rescueSeconds,
    progress: 0,
    expiresAt: t.time + SURVIVORS.lifetimeSeconds,
    rescued: false,
    lost: false,
  });
  t.stats.survivorsSpawned++;
  pushEvent(t, { type: 'survivorsSpawned', shipName: ship.name });
}

/** Advance every active recovery area: positional, multi-escort, all-or-
 *  nothing. Progress accrues while at least one live escort holds inside the
 *  area; each extra escort adds a fraction of the base rate; and the moment
 *  NO escort remains, progress resets to zero — touch-and-go preserves
 *  nothing, recovery means committing escort time under fire. */
function updateRecoveryFields(t: TransitState, dt: number): void {
  const liveEscorts = t.escorts.filter((e) => e.alive);
  const workDone = (x: number, y: number, radius: number, extraRate: number): number => {
    let crews = 0;
    for (const escort of liveEscorts) {
      if (dist(escort.x, escort.y, x, y) <= radius) crews++;
    }
    if (crews === 0) return 0;
    t.stats.recoveryEscortSeconds += crews * dt;
    return dt * (1 + (crews - 1) * extraRate);
  };

  for (const field of t.wreckage) {
    if (field.recovered || field.expired) continue;
    if (t.time >= field.expiresAt) {
      field.expired = true;
      t.stats.wreckageExpired++;
      pushEvent(t, { type: 'wreckageExpired', threatKind: field.threatKind });
      continue;
    }
    const step = workDone(field.x, field.y, WRECKAGE.radius, WRECKAGE.extraEscortRate);
    if (step <= 0) {
      field.progress = 0; // every escort left → the field resets completely
      continue;
    }
    field.progress += step * t.effects.recovery.wreckageRateMult;
    if (field.progress >= field.required) {
      field.recovered = true;
      t.stats.wreckageRecovered++;
      t.stats.wreckageByBranch[field.branch] = (t.stats.wreckageByBranch[field.branch] ?? 0) + 1;
      pushEvent(t, { type: 'wreckageRecovered', threatKind: field.threatKind });
    }
  }

  for (const area of t.survivors) {
    if (area.rescued || area.lost) continue;
    if (t.time >= area.expiresAt) {
      area.lost = true;
      t.stats.survivorsLost++;
      pushEvent(t, { type: 'survivorsLost', shipName: area.shipName });
      continue;
    }
    const step = workDone(area.x, area.y, SURVIVORS.radius, SURVIVORS.extraEscortRate);
    if (step <= 0) {
      area.progress = 0;
      continue;
    }
    area.progress += step * t.effects.recovery.rescueRateMult;
    if (area.progress >= area.required) {
      area.rescued = true;
      t.stats.survivorsRescued++;
      pushEvent(t, { type: 'survivorsRescued', shipName: area.shipName });
    }
  }
}

/** This escort's performance row, created on demand so an escort that somehow
 *  acts before its row exists still gets credited rather than throwing. */
function escortPerf(t: TransitState, escort: Escort): EscortPerformance {
  return (t.stats.escortPerformance[escort.unitId] ??= {
    id: escort.unitId,
    name: escort.name,
    modules: [...escort.modules],
    intercepts: 0,
    boatKills: 0,
    torpedoKills: 0,
    minesSwept: 0,
    damageTaken: 0,
    lost: false,
  });
}

function damageEscort(t: TransitState, escort: Escort, amount: number, cause: string): void {
  if (!escort.alive) return;
  const dealt = amount * t.effects.damageTakenMult;
  escort.hp -= dealt;
  escortPerf(t, escort).damageTaken += dealt;
  creditEnemyBranch(t, cause, dealt, false);
  const disableUntil = t.time + COMBAT.escort.disableSeconds;
  if (disableUntil > escort.disabledUntil) {
    escort.disabledUntil = disableUntil;
    t.stats.launchersDisabled++;
    pushEvent(t, { type: 'shipHit', shipId: escort.id, cause: `escort:${cause}` });
  }
  if (escort.hp <= 0) {
    escort.hp = 0;
    escort.alive = false;
    escort.moveTarget = null;
    escort.gunTargetId = null;
    creditEnemyBranch(t, cause, 0, true);
    t.stats.escortsLost++;
    escortPerf(t, escort).lost = true;
    // Named, so the loss reads as a specific ship going down rather than an
    // anonymous escort slot decrementing.
    pushEvent(t, { type: 'shipLost', shipId: escort.id, shipName: escort.name, cause: `escort:${cause}` });
  }
}

/** A hit on a shore battery: hull damage plus a temporary launcher outage. A
 *  hardened installation takes many strikes, but enough of them destroy it. */
function damageBase(t: TransitState, base: Base): void {
  if (!base.alive) return;
  base.hp -= COMBAT.base.strikeDamage * t.effects.damageTakenMult;
  const disableUntil = t.time + COMBAT.base.disableSeconds;
  if (disableUntil > base.disabledUntil) {
    base.disabledUntil = disableUntil;
    t.stats.launchersDisabled++;
    pushEvent(t, { type: 'shipHit', shipId: base.id, cause: 'base:missile' });
  }
  if (base.hp <= 0) {
    base.hp = 0;
    base.alive = false;
    t.stats.basesLost++;
    pushEvent(t, { type: 'shipLost', shipId: base.id, cause: 'base:missile' });
  }
}

// ---------------------------------------------------------------------------
// Interceptor launching (shared by taps and automation)
// ---------------------------------------------------------------------------

/** Fire an interceptor from a specific launcher at a threat. Assumes validity
 *  (ready launcher, in-range, engageable kind) was checked by the caller. */
function fireInterceptor(
  t: TransitState,
  threat: Threat,
  from: { kind: 'escort'; escort: Escort } | { kind: 'base'; base: Base },
  auto: boolean,
): void {
  let originX: number;
  let originY: number;
  let launcher: LauncherKind;
  let speed: number;
  let size: number;
  let ownerUnitId: number | undefined;
  if (from.kind === 'escort') {
    from.escort.cooldown = t.effects.escort.reload;
    originX = from.escort.x;
    originY = from.escort.y;
    launcher = 'escort';
    ownerUnitId = from.escort.unitId;
    speed = t.effects.escort.speed;
    size = t.effects.escort.projectileSize;
  } else {
    from.base.cooldown = t.effects.base.reload;
    originX = from.base.x;
    originY = from.base.y;
    launcher = 'base';
    speed = t.effects.base.speed;
    size = t.effects.base.projectileSize;
  }
  t.ammo--;
  t.stats.ammoUsed++;
  if (threat.claimedByInterceptor) t.stats.counter.duplicateShots++;
  threat.claimedByInterceptor = true;
  if (auto) t.stats.counter.autoShots++;
  else t.stats.counter.manualShots++;
  t.interceptors.push({
    id: t.nextEntityId++,
    x: originX,
    y: originY,
    targetThreatId: threat.id,
    speed,
    launcher,
    ownerUnitId,
    auto,
    size,
  });
}

// ---------------------------------------------------------------------------
// Command processing
// ---------------------------------------------------------------------------

function handleCommand(t: TransitState, cmd: TransitCommand, rng: RNG): void {
  switch (cmd.type) {
    case 'intercept': {
      const threat = t.threats.find((th) => th.id === cmd.threatId && th.alive);
      // Multiple interceptors MAY be sent at one missile — no claimed guard.
      if (!threat) return;
      // CENTRAL target-compatibility rule: interceptors engage missiles, and
      // nothing else — not torpedoes, mines, boats, aircraft or positions.
      if (!canEngage('interceptor', threat.kind)) {
        pushEvent(t, {
          type: 'launchFailed',
          detail: `Interceptors cannot engage ${threat.kind}`,
        });
        return;
      }
      // Enemy smoke: the threat is still there and still coming, but there is
      // no precise target to hand a launcher. This is the whole branch — it
      // steals the reaction window rather than the shot.
      if (threat.concealed) {
        pushEvent(t, { type: 'launchFailed', detail: 'No firing solution — target is in smoke' });
        return;
      }
      if (t.ammo <= 0) {
        pushEvent(t, { type: 'launchFailed', detail: 'No interceptors remaining' });
        return;
      }

      // Fire from the NEAREST ready launcher — escort or shore battery alike,
      // compared by true distance to the threat. Escorts have a max range;
      // batteries have unlimited range but reload slowly.
      let bestEscort: Escort | null = null;
      let bestBase: Base | null = null;
      let bestDist = Infinity;
      let anyReloading = false;
      // Formation shapes defensive reach: a Tight column overlaps escort fire,
      // a Wide one stretches it thin.
      const escortRange = COMBAT.interceptor.range * FORMATIONS[t.formation].defenseRangeMult;
      for (const escort of t.escorts) {
        if (!escort.alive) continue; // destroyed escorts can't fire
        const d = dist(escort.x, escort.y, threat.x, threat.y);
        if (d > escortRange) continue;
        if (escort.cooldown > 0 || t.time < escort.disabledUntil) {
          anyReloading = true; // reloading OR knocked offline by a hit
          continue;
        }
        if (d < bestDist) {
          bestDist = d;
          bestEscort = escort;
          bestBase = null;
        }
      }
      for (const base of t.bases) {
        if (!base.alive) continue; // destroyed batteries can't fire
        if (base.cooldown > 0 || t.time < base.disabledUntil) {
          anyReloading = true;
          continue;
        }
        const d = dist(base.x, base.y, threat.x, threat.y);
        if (d < bestDist) {
          bestDist = d;
          bestBase = base;
          bestEscort = null;
        }
      }

      if (bestEscort) {
        fireInterceptor(t, threat, { kind: 'escort', escort: bestEscort }, false);
      } else if (bestBase) {
        fireInterceptor(t, threat, { kind: 'base', base: bestBase }, false);
      } else {
        pushEvent(t, {
          type: 'launchFailed',
          detail: anyReloading ? 'All launchers reloading' : 'No launcher available',
        });
      }
      return;
    }
    case 'sweepMine': {
      // Player-directed minesweeper: tap a charted mine to send a drone from the
      // nearest in-range escort. Requires the escort drone-launcher module and
      // the branch's base research (effects.sweepDrones covers both), plus a
      // munition. A drone can NEVER be sent at an unrevealed mine — detection
      // and clearing stay separate capabilities.
      if (!t.effects.sweepDrones) {
        pushEvent(t, { type: 'launchFailed', detail: 'Minesweeper drones not available' });
        return;
      }
      const mine = t.threats.find((m) => m.id === cmd.threatId && m.alive);
      if (!mine) return;
      if (!canEngage('mcmDrone', mine.kind)) {
        pushEvent(t, { type: 'launchFailed', detail: `Drones cannot engage ${mine.kind}` });
        return;
      }
      if (!mine.revealed) {
        pushEvent(t, { type: 'launchFailed', detail: 'Mine not detected — nothing to aim at' });
        return;
      }
      launchSweepDrone(t, mine, false);
      return;
    }
    case 'depthCharge': {
      // Depth charges are lobbed AREA weapons: the player taps a point in the
      // water, never a torpedo sprite. The blast destroys torpedoes only.
      if (!t.escorts.some((e) => e.alive && e.modules.includes('depthCharges'))) {
        pushEvent(t, { type: 'launchFailed', detail: 'No escort carries a depth-charge launcher' });
        return;
      }
      const px = clamp(cmd.x, 20, WORLD.width - 20);
      const py = clamp(cmd.y, 60, WORLD.height - 60);
      // Nearest-ready launcher able to reach the point.
      let best: Escort | null = null;
      let bestD = t.effects.depthCharge.throwRange;
      let anyReloading = false;
      for (const escort of t.escorts) {
        if (!escort.alive || t.time < escort.disabledUntil) continue;
        // Only a hull that actually carries a launcher can drop.
        if (!escort.modules.includes('depthCharges')) continue;
        const d = dist(escort.x, escort.y, px, py);
        if (d > t.effects.depthCharge.throwRange) continue;
        if (escort.dcShots <= 0 || escort.dcCooldown > 0) {
          anyReloading = true;
          continue;
        }
        if (d <= bestD) {
          bestD = d;
          best = escort;
        }
      }
      if (!best) {
        pushEvent(t, {
          type: 'launchFailed',
          detail: anyReloading ? 'Depth-charge launchers cycling or empty' : 'No escort in throw range of that point',
        });
        return;
      }
      dropDepthCharges(t, best, px, py);
      return;
    }
    case 'engageBoat': {
      // Deck guns: sustained fire on a persistent HP target. The commitment
      // model — the gun stays on the boat until it sinks, leaves range, the
      // escort dies, or the player re-tasks it.
      if (!t.escorts.some((e) => e.alive && e.modules.includes('deckGun'))) {
        pushEvent(t, { type: 'launchFailed', detail: 'No escort carries a deck gun' });
        return;
      }
      const boat = t.threats.find((th) => th.id === cmd.threatId && th.alive);
      if (!boat) return;
      if (!canEngage('deckGun', boat.kind)) {
        pushEvent(t, { type: 'launchFailed', detail: `Deck guns cannot engage ${boat.kind}` });
        return;
      }
      // A gun escort is one that CARRIES a gun — a depth-charge escort sitting
      // right next to the boat cannot shoot at it.
      const inRange = (e: Escort) =>
        e.modules.includes('deckGun') && dist(e.x, e.y, boat.x, boat.y) <= t.effects.deckGun.range;
      if (cmd.focus && t.effects.deckGun.focusFire) {
        // Focus fire: every gun escort that can reach commits to this boat.
        let committed = 0;
        for (const escort of t.escorts) {
          if (!escort.alive || !inRange(escort)) continue;
          escort.gunTargetId = boat.id;
          committed++;
        }
        if (committed === 0) pushEvent(t, { type: 'launchFailed', detail: 'No deck gun in range of that boat' });
        return;
      }
      let best: Escort | null = null;
      let bestD = Infinity;
      for (const escort of t.escorts) {
        if (!escort.alive || !inRange(escort)) continue;
        const d = dist(escort.x, escort.y, boat.x, boat.y);
        if (d < bestD) {
          bestD = d;
          best = escort;
        }
      }
      if (!best) {
        pushEvent(t, { type: 'launchFailed', detail: 'No deck gun in range of that boat' });
        return;
      }
      best.gunTargetId = boat.id;
      return;
    }
    case 'counterBattery': {
      // Counter-battery fires at identified artillery POSITIONS — never at
      // shells in flight, threats, or any mobile unit (those ids simply do not
      // exist in the installations list).
      if (!t.baseModules.includes('counterBattery')) {
        pushEvent(t, { type: 'launchFailed', detail: 'No base carries a counter-battery system' });
        return;
      }
      const pos = t.installations.find((i) => i.id === cmd.installationId && !i.destroyed);
      if (!pos) {
        pushEvent(t, { type: 'launchFailed', detail: 'No identified artillery position there' });
        return;
      }
      if (pos.variant === 'ranging' && !t.effects.counterBattery.canEngageRanging) {
        pushEvent(t, {
          type: 'launchFailed',
          detail: 'Ranging artillery is beyond this fire control — research Extended-Range Fire Control',
        });
        return;
      }
      fireCounterBattery(t, pos, rng, false);
      return;
    }
    case 'ability': {
      const px = clamp(cmd.x, 20, WORLD.width - 20);
      const py = clamp(cmd.y, 60, WORLD.height - 60);
      if (cmd.ability === 'ecm') {
        // No stacking: a deployed plane must clear before another can be called.
        if (t.ecmCharges <= 0 || t.time < t.ecmActiveUntil) return;
        // The jamming orbit must sit over open water — not on a shore launcher
        // (enemy launch sites up-map, friendly batteries down-map). Reject a
        // placement outside the water band so a charge is never wasted on land.
        if (py < COMBAT.ecm.waterYMin || py > COMBAT.ecm.waterYMax) {
          pushEvent(t, { type: 'launchFailed', detail: 'Deploy ECM over open water' });
          return;
        }
        t.ecmCharges--;
        t.stats.ecmUsed++;
        t.stats.counter.charges.ecm.used++;
        // Total deployment: fly-in + on-station orbit + fly-out. Blocks a second
        // ECM until the plane is clear, and centers the future jamming orbit.
        t.ecmActiveUntil = t.time + t.effects.abilities.ecm.duration + 12;
        t.ecmCenterX = px;
        t.ecmCenterY = py;
        // ECM plane enters from the friendly (bottom) shore and heads to station.
        t.aircraft.push({
          id: t.nextEntityId++,
          role: 'ecm',
          x: px,
          y: WORLD.height + 40,
          heading: -Math.PI / 2,
          phase: 'inbound',
          laneY: py,
          centerX: px,
          centerY: py,
          orbitAngle: 0,
          stationUntil: 0,
        });
        pushEvent(t, { type: 'abilityUsed', detail: 'ecm' });
      } else if (cmd.ability === 'scan') {
        if (t.scanCharges <= 0) return;
        t.scanCharges--;
        t.stats.scanUsed++;
        t.stats.counter.charges.scan.used++;
        // The tap's Y selects a lane; a scan plane flies the length of that lane
        // charting only the mines within it. Sweeping is done by drones.
        const laneY = WORLD.lanes[nearestLane(py)];
        t.aircraft.push({
          id: t.nextEntityId++,
          role: 'scan',
          x: -60,
          y: laneY,
          heading: 0,
          phase: 'onStation',
          laneY,
          centerX: 0,
          centerY: laneY,
          orbitAngle: 0,
          stationUntil: 0,
        });
        pushEvent(t, { type: 'abilityUsed', detail: 'scan' });
      } else if (cmd.ability === 'sonar') {
        // Active sonar ping: a placed area that reveals torpedoes (and only
        // torpedoes — it operates purely in the underwater domain).
        if (t.sonarCharges <= 0) return;
        t.sonarCharges--;
        t.stats.counter.charges.sonar.used++;
        const fx: AreaEffect = {
          id: t.nextEntityId++,
          kind: 'sonar',
          x: px,
          y: py,
          radius: t.effects.abilities.sonar.radius,
          until: t.time + t.effects.abilities.sonar.duration + t.effects.abilities.sonar.persistence,
        };
        t.areaEffects.push(fx);
        revealTorpedoesInPing(t, fx);
        pushEvent(t, { type: 'abilityUsed', detail: 'sonar' });
      } else if (cmd.ability === 'smoke') {
        // Defensive smoke: degrades the enemy's targeting preference for
        // ships inside. It destroys nothing and blocks nothing outright.
        if (t.smokeCharges <= 0) return;
        t.smokeCharges--;
        t.stats.counter.charges.smoke.used++;
        t.areaEffects.push({
          id: t.nextEntityId++,
          kind: 'smoke',
          x: px,
          y: py,
          radius: t.effects.abilities.smoke.radius,
          until: t.time + t.effects.abilities.smoke.duration,
        });
        pushEvent(t, { type: 'abilityUsed', detail: 'smoke' });
      }
      return;
    }
    case 'reboot': {
      // Hardened systems: shorten an active jamming blackout. Jamming itself
      // is never shootable — this is the sanctioned work-around.
      if (t.rebootCharges <= 0) return;
      if (t.jammingSeconds <= 0) {
        pushEvent(t, { type: 'launchFailed', detail: 'No jamming to recover from' });
        return;
      }
      t.rebootCharges--;
      t.stats.counter.charges.reboot.used++;
      const removed = t.jammingSeconds * t.effects.hardened.recovery;
      t.jammingSeconds = Math.max(0, t.jammingSeconds - removed);
      t.stats.counter.jammingMitigatedSeconds += removed;
      pushEvent(t, { type: 'abilityUsed', detail: 'reboot' });
      return;
    }
    case 'toggleAuto': {
      // Turning automation off NEVER disables manual fire — manual paths above
      // don't consult these switches.
      t.autoFire[cmd.system] = cmd.enabled;
      return;
    }
    case 'moveEscort': {
      const escort = t.escorts.find((e) => e.id === cmd.escortId && e.alive);
      if (!escort) return;
      // A fresh order (tap or hold) puts the escort back under way; whether it
      // stations on arrival depends on `hold`.
      escort.stationed = false;
      escort.moveTarget = {
        x: clamp(cmd.x, 20, WORLD.width - 20),
        y: clamp(cmd.y, 60, WORLD.height - 60),
        hold: cmd.hold,
      };
      pushEvent(t, { type: 'abilityUsed', detail: cmd.hold ? 'stationEscort' : 'moveEscort' });
      return;
    }
  }
}

/** Launch a minesweeper drone at a revealed mine from the nearest escort with
 *  launcher capacity. Shared by the tap command and automatic clearance. */
function launchSweepDrone(t: TransitState, mine: Threat, auto: boolean): void {
  // One drone per mine is enough — ignore a repeat launch on a mine already
  // being swept so munitions aren't wasted.
  if (t.drones.some((dr) => dr.targetMineId === mine.id)) {
    if (auto) t.stats.counter.duplicateShotsAvoided++;
    return;
  }
  if (t.droneAmmo <= 0) {
    if (!auto) pushEvent(t, { type: 'launchFailed', detail: 'No drone munitions remaining' });
    return;
  }
  // Nearest alive escort with a ready launcher within launch range of the mine.
  let bestEscort: Escort | null = null;
  let bestD: number = t.effects.mcm.launchRange;
  for (const escort of t.escorts) {
    if (!escort.modules.includes('mcmDroneLauncher')) continue;
    if (!escort.alive || escort.droneReady <= 0) continue;
    const d = dist(escort.x, escort.y, mine.x, mine.y);
    if (d <= bestD) {
      bestD = d;
      bestEscort = escort;
    }
  }
  if (!bestEscort) {
    if (!auto) pushEvent(t, { type: 'launchFailed', detail: 'No escort in drone range of that mine' });
    return;
  }
  bestEscort.droneReady--;
  if (bestEscort.droneReady <= 0) bestEscort.droneCooldown = t.effects.mcm.reload;
  t.droneAmmo--;
  t.stats.counter.droneLaunches++;
  if (auto) t.stats.counter.autoShots++;
  else t.stats.counter.manualShots++;
  t.drones.push({
    id: t.nextEntityId++,
    x: bestEscort.x,
    y: bestEscort.y,
    targetMineId: mine.id,
    ownerUnitId: bestEscort.unitId,
    speed: t.effects.mcm.droneSpeed,
    tracking: t.effects.mcm.movingTarget,
  });
}

/** Lob one depth charge (or a pattern salvo) from an escort at a water point. */
function dropDepthCharges(t: TransitState, escort: Escort, px: number, py: number): void {
  escort.dcShots--;
  escort.dcCooldown = t.effects.depthCharge.reload;
  const blast = t.effects.depthCharge.blastRadius;
  const points: { x: number; y: number }[] = [{ x: px, y: py }];
  if (t.effects.depthCharge.patternSalvo) {
    // A short line of charges along the throw direction, centered on the tap.
    const d = dist(escort.x, escort.y, px, py) || 1;
    const ux = (px - escort.x) / d;
    const uy = (py - escort.y) / d;
    const half = Math.floor(COMBAT.depthCharge.patternCount / 2);
    points.length = 0;
    for (let i = -half; i <= half; i++) {
      points.push({
        x: px + ux * i * COMBAT.depthCharge.patternSpacing,
        y: py + uy * i * COMBAT.depthCharge.patternSpacing,
      });
    }
  }
  for (const p of points) {
    t.depthChargeShots.push({
      id: t.nextEntityId++,
      ownerUnitId: escort.unitId,
      x: escort.x,
      y: escort.y,
      targetX: clamp(p.x, 20, WORLD.width - 20),
      targetY: clamp(p.y, 60, WORLD.height - 60),
      speed: COMBAT.depthCharge.flightSpeed,
      blastRadius: blast,
      detonated: false,
    });
  }
  t.stats.counter.depthChargesDropped += points.length;
}

/** One counter-battery fire mission at an artillery position. */
function fireCounterBattery(
  t: TransitState,
  pos: { suppressedUntil: number; strikes: number; destroyed: boolean; id: number },
  rng: RNG,
  auto: boolean,
): void {
  // Nearest ready base with the module (all bases share the loadout template).
  let best: Base | null = null;
  for (const base of t.bases) {
    if (!base.alive || t.time < base.disabledUntil || base.cbCooldown > 0) continue;
    best = base;
    break;
  }
  if (!best) {
    if (!auto) pushEvent(t, { type: 'launchFailed', detail: 'Counter-battery reloading' });
    return;
  }
  best.cbCooldown = t.effects.counterBattery.reload;
  t.stats.counter.counterBatteryShots++;
  if (auto) t.stats.counter.autoShots++;
  else t.stats.counter.manualShots++;
  if (rng.chance(t.effects.counterBattery.accuracy)) {
    pos.suppressedUntil = Math.max(
      pos.suppressedUntil,
      t.time + t.effects.counterBattery.suppressionSeconds,
    );
    pos.strikes++;
    t.stats.counter.counterBatterySuppressions++;
    pushEvent(t, { type: 'suppressed', detail: `installation:${pos.id}` });
    if (t.effects.counterBattery.coordinatedStrike && pos.strikes >= 3) {
      pos.destroyed = true;
      t.stats.batteriesDestroyed++;
      pushEvent(t, { type: 'suppressed', detail: `destroyed:${pos.id}` });
    }
  }
}

/** Sonar ping reveal: torpedoes (and only torpedoes) inside the ping area. */
function revealTorpedoesInPing(t: TransitState, fx: AreaEffect): void {
  for (const threat of t.threats) {
    if (threat.kind !== 'torpedo' || !threat.alive || threat.revealed) continue;
    if (threat.lowSig && !t.effects.abilities.sonar.unlockedLowSig) continue;
    if (dist(threat.x, threat.y, fx.x, fx.y) <= fx.radius) {
      threat.revealed = true;
      t.stats.torpedoesDetected++;
      t.stats.counter.detections.activeSonar++;
      pushEvent(t, { type: 'torpedoDetected', lowSig: threat.lowSig, detail: 'activeSonar' });
      announceTorpedo(t, threat);
    }
  }
}

function revealMine(t: TransitState, mine: Threat, source: 'mineSonar' | 'scanPulse'): void {
  if (mine.revealed) return;
  mine.revealed = true;
  t.stats.minesRevealed++;
  t.stats.counter.detections[source]++;
  pushEvent(t, { type: 'mineRevealed', lowSig: mine.lowSig });
  announceDebut(t, 'mine');
  if (mine.lowSig) announceDebut(t, 'lowSigMine');
}

/** Advance support aircraft: scan planes sweep their lane charting mines in it;
 *  ECM planes fly to a water station, orbit (jamming resolves in the missile
 *  loop via jammingAt), then break off and leave. Missiles never touch planes;
 *  planes can't be shot down. */
function updateAircraft(t: TransitState, rng: RNG, dt: number): void {
  const scanRadius = t.effects.abilities.scan.radius;
  const laneHalf = COMBAT.scan.laneHalfWidth * (scanRadius / COMBAT.scan.baseRevealRadius);
  for (const ac of t.aircraft) {
    if (ac.role === 'scan') {
      // Fly straight across the map along the selected lane.
      ac.x += COMBAT.scan.planeSpeed * dt;
      ac.y = ac.laneY;
      ac.heading = 0;
      // Chart un-revealed mines within THIS lane band as the plane passes over.
      for (const mine of t.threats) {
        if (mine.kind !== 'mine' || !mine.alive || mine.revealed) continue;
        if (Math.abs(mine.y - ac.laneY) > laneHalf) continue; // other lane
        if (Math.abs(mine.x - ac.x) > scanRadius) continue;
        const canSee = !mine.lowSig || rng.chance(t.effects.scanLowSigChance);
        if (canSee) revealMine(t, mine, 'scanPulse');
      }
      continue;
    }

    // ECM plane.
    if (ac.phase === 'inbound') {
      const dx = ac.centerX - ac.x;
      const dy = ac.centerY + COMBAT.ecm.orbitRadius - ac.y; // arrive at orbit edge
      const d = Math.hypot(dx, dy) || 1;
      const step = COMBAT.ecm.planeSpeed * dt;
      if (d <= step) {
        ac.phase = 'onStation';
        ac.stationUntil = t.time + t.effects.abilities.ecm.duration;
        ac.orbitAngle = Math.PI / 2;
      } else {
        ac.x += (dx / d) * step;
        ac.y += (dy / d) * step;
        ac.heading = Math.atan2(dy, dx);
      }
    } else if (ac.phase === 'onStation') {
      ac.orbitAngle += COMBAT.ecm.orbitRate * dt;
      const prevX = ac.x;
      const prevY = ac.y;
      ac.x = ac.centerX + Math.cos(ac.orbitAngle) * COMBAT.ecm.orbitRadius;
      ac.y = ac.centerY + Math.sin(ac.orbitAngle) * COMBAT.ecm.orbitRadius;
      ac.heading = Math.atan2(ac.y - prevY, ac.x - prevX);
      if (t.time >= ac.stationUntil) ac.phase = 'departing';
    } else {
      // Depart off the bottom of the map, then get culled below.
      ac.y += COMBAT.ecm.planeSpeed * dt;
      ac.heading = Math.PI / 2;
    }
  }
  // Cull finished aircraft: scan planes that flew off the right edge, ECM planes
  // that have left the bottom of the world.
  t.aircraft = t.aircraft.filter((ac) =>
    ac.role === 'scan' ? ac.x <= WORLD.width + 80 : ac.y <= WORLD.height + 80,
  );
}

// ---------------------------------------------------------------------------
// Automation tactics (each gated on research + the player's toggle; manual
// fire never consults these switches)
// ---------------------------------------------------------------------------

/** Escort local automatic engagement: fire at a missile entering the escort's
 *  automatic-defense radius, on a SEPARATE automatic-fire cooldown. */
function updateEscortAuto(t: TransitState): void {
  const fx = t.effects.escort;
  if (!fx.autoUnlocked || !t.autoFire.escortInterceptor) return;
  if (t.ammo <= 0) return;
  const rangeMult = FORMATIONS[t.formation].defenseRangeMult;
  const autoRadius = fx.autoRadius * rangeMult;
  for (const escort of t.escorts) {
    if (!escort.alive || escort.cooldown > 0 || t.time < escort.disabledUntil) continue;
    if (escort.autoCooldown > 0) continue;
    if (t.ammo <= 0) return;
    let best: Threat | null = null;
    let bestD = autoRadius;
    for (const threat of t.threats) {
      if (!threat.alive || !canEngage('interceptor', threat.kind)) continue;
      if (threat.claimedByInterceptor) {
        // Never double-fire at a missile that already has a kill shot inbound.
        if (fx.autoDedupe) t.stats.counter.duplicateShotsAvoided++;
        continue;
      }
      const d = dist(escort.x, escort.y, threat.x, threat.y);
      if (d <= bestD) {
        bestD = d;
        best = threat;
      }
    }
    if (!best) continue;
    fireInterceptor(t, best, { kind: 'escort', escort }, true);
    escort.autoCooldown = fx.autoCooldown;
  }
}

/** Shore-base strategic automatic engagement: any missile on the map, on a
 *  separate automatic-fire cooldown; the responsive tactic prioritizes the
 *  shortest time-to-impact and skips already-covered threats. */
function updateBaseAuto(t: TransitState): void {
  const fx = t.effects.base;
  if (!fx.autoUnlocked || !t.autoFire.baseInterceptor) return;
  if (t.ammo <= 0) return;
  for (const base of t.bases) {
    if (!base.alive || base.cooldown > 0 || t.time < base.disabledUntil) continue;
    if (base.autoCooldown > 0) continue;
    if (t.ammo <= 0) return;
    let best: Threat | null = null;
    let bestKey = Infinity;
    for (const threat of t.threats) {
      if (!threat.alive || !canEngage('interceptor', threat.kind)) continue;
      if (threat.claimedByInterceptor) {
        if (fx.autoDedupe) t.stats.counter.duplicateShotsAvoided++;
        continue;
      }
      const key = fx.autoPrioritizeTti
        ? timeToImpact(t, threat)
        : dist(base.x, base.y, threat.x, threat.y);
      if (key < bestKey) {
        bestKey = key;
        best = threat;
      }
    }
    if (!best) continue;
    fireInterceptor(t, best, { kind: 'base', base }, true);
    base.autoCooldown = fx.autoCooldown;
  }
}

/** Automatic mine clearance: an escort launches a drone at a revealed mine
 *  entering its defensive zone, on a separate Max automatic-fire cooldown. */
function updateMcmAuto(t: TransitState): void {
  const fx = t.effects.mcm;
  if (!t.effects.sweepDrones || !fx.autoUnlocked || !t.autoFire.mcmDrones) return;
  if (t.droneAmmo <= 0) return;
  for (const escort of t.escorts) {
    if (!escort.modules.includes('mcmDroneLauncher')) continue;
    if (!escort.alive || escort.droneReady <= 0 || escort.mcmAutoCooldown > 0) continue;
    let best: Threat | null = null;
    let bestD = fx.autoRadius;
    for (const mine of t.threats) {
      if (mine.kind !== 'mine' || !mine.alive || !mine.revealed) continue;
      if (t.drones.some((dr) => dr.targetMineId === mine.id)) continue;
      const d = dist(escort.x, escort.y, mine.x, mine.y);
      if (d <= bestD) {
        bestD = d;
        best = mine;
      }
    }
    if (!best) continue;
    launchSweepDrone(t, best, true);
    escort.mcmAutoCooldown = fx.autoCooldown;
  }
}

/** Automatic emergency depth-charge drop when a DETECTED torpedo enters an
 *  escort's emergency radius. Undetected torpedoes never trigger it —
 *  detection and attack stay separate capabilities. */
function updateDepthChargeAuto(t: TransitState): void {
  const fx = t.effects.depthCharge;
  if (!fx.autoUnlocked || !t.autoFire.depthCharges) return;
  for (const escort of t.escorts) {
    if (!escort.modules.includes('depthCharges')) continue;
    if (!escort.alive || escort.dcShots <= 0 || escort.dcCooldown > 0) continue;
    if (escort.dcAutoCooldown > 0 || t.time < escort.disabledUntil) continue;
    for (const threat of t.threats) {
      if (!threat.alive || !canEngage('depthCharge', threat.kind) || !threat.revealed) continue;
      const d = dist(escort.x, escort.y, threat.x, threat.y);
      if (d > fx.autoRadius) continue;
      // Lead the running torpedo: aim where it will be when the charge lands.
      const flight = d / COMBAT.depthCharge.flightSpeed;
      dropDepthCharges(t, escort, threat.x + threat.vx * flight, threat.y + threat.vy * flight);
      escort.dcAutoCooldown = fx.autoCooldown;
      break;
    }
  }
}

/** Automatic return fire: counter-battery targets active (un-suppressed)
 *  artillery positions on its own, on a separate automatic-fire cooldown. */
function updateCounterBatteryAuto(t: TransitState, rng: RNG): void {
  const fx = t.effects.counterBattery;
  if (!t.baseModules.includes('counterBattery')) return;
  if (!fx.autoUnlocked || !t.autoFire.counterBattery) return;
  for (const base of t.bases) {
    if (!base.alive || base.cbCooldown > 0 || base.cbAutoCooldown > 0) continue;
    if (t.time < base.disabledUntil) continue;
    const target = t.installations.find(
      (p) =>
        !p.destroyed &&
        p.suppressedUntil <= t.time &&
        (p.variant !== 'ranging' || fx.canEngageRanging),
    );
    if (!target) return;
    fireCounterBattery(t, target, rng, true);
    base.cbAutoCooldown = fx.autoCooldown;
  }
}

/** Deck guns: sustain fire on committed boats; auto-acquisition and the
 *  focus/distributed/layered allocation tactics live here. */
function updateDeckGuns(t: TransitState, rng: RNG, dt: number): void {
  const fx = t.effects.deckGun;
  const boats = t.threats.filter((th) => th.alive && canEngage('deckGun', th.kind));
  for (const escort of t.escorts) {
    // Per escort, not per fleet: only hulls with a gun fitted take part, so a
    // flotilla with one gun boat brings one gun to the fight.
    if (!escort.modules.includes('deckGun')) continue;
    if (!escort.alive) {
      continue;
    }
    escort.gunCooldown = Math.max(0, escort.gunCooldown - dt);
    // Validate the current commitment: boat sunk / out of range → disengage.
    let target = escort.gunTargetId !== null
      ? boats.find((b) => b.id === escort.gunTargetId)
      : undefined;
    if (target && dist(escort.x, escort.y, target.x, target.y) > fx.range) target = undefined;
    if (!target) {
      if (escort.gunTargetId !== null) {
        const old = t.threats.find((b) => b.id === escort.gunTargetId);
        if (old && old.engagedByEscortId === escort.id) old.engagedByEscortId = undefined;
      }
      escort.gunTargetId = null;
    }
    // Auto-acquisition (nearest valid boat), respecting distributed fire.
    if (!target && fx.autoNearest && t.autoFire.deckGun) {
      let candidates = boats.filter((b) => dist(escort.x, escort.y, b.x, b.y) <= fx.range);
      // Automatic Threat Priority: a boarding party already on a hull outranks
      // every other boat in reach. A capture is unrecoverable; a few more
      // seconds of gunfire from a small-arms boat is not.
      if (t.effects.antiBoarding.autoPriority) {
        const attached = candidates.filter((b) => b.boatVariant === 'boarding' && b.engaging);
        if (attached.length > 0) candidates = attached;
      }
      let pool = candidates;
      if (fx.distributedFire) {
        // Avoid overkill: prefer boats no other gun is already working on.
        const free = candidates.filter(
          (b) => b.engagedByEscortId === undefined || b.engagedByEscortId === escort.id,
        );
        if (free.length > 0) pool = free;
      }
      if (pool.length > 0) {
        let key: (b: Threat) => number = (b) => dist(escort.x, escort.y, b.x, b.y);
        if (fx.layeredFire) {
          // Near escorts take boats already closing with the convoy (closest
          // to a cargo hull); far escorts take approachers. Allocation only.
          const shipsNow = activeShips(t);
          const distToConvoy = (x: number, y: number): number =>
            shipsNow.length === 0
              ? 9999
              : Math.min(...shipsNow.map((s) => dist(s.x, s.y, x, y)));
          const escortNear = distToConvoy(escort.x, escort.y) < 300;
          key = (b) => (escortNear ? distToConvoy(b.x, b.y) : -distToConvoy(b.x, b.y));
        }
        let best = pool[0];
        let bestKey = key(pool[0]);
        for (const b of pool) {
          const k = key(b);
          if (k < bestKey) {
            bestKey = k;
            best = b;
          }
        }
        escort.gunTargetId = best.id;
        target = best;
      }
    }
    if (!target) continue;
    if (target.engagedByEscortId === undefined) target.engagedByEscortId = escort.id;
    if (escort.gunCooldown > 0 || t.time < escort.disabledUntil) continue;
    // Fire one round: accuracy roll, then HP damage (boats are persistent
    // sinkable units, never one-tap kills).
    escort.gunCooldown = fx.fireInterval;
    t.stats.counter.deckGunRounds++;
    if (rng.chance(fx.accuracy)) {
      const tough = target.boatVariant === 'rocket' || target.boatVariant === 'boarding';
      const dmg = fx.damage * (tough && !fx.armorPiercing ? 0.5 : 1);
      target.hp = (target.hp ?? 1) - dmg;
      if (target.hp <= 0) {
        target.alive = false;
        target.engagedByEscortId = undefined;
        t.stats.counter.deckGunKills++;
        t.stats.boatsSunk++;
        escortPerf(t, escort).boatKills++;
        pushEvent(t, { type: 'boatSunk', threatKind: target.kind });
        maybeSpawnWreckage(t, target, rng);
        // Sinking a boarding boat throws its party off the hull. The progress
        // it had made is lost — that is what makes shooting the boat the
        // answer, rather than merely a way to stop the clock where it stands.
        const boarded = t.ships.find((s) => s.id === target.targetShipId);
        if (boarded) releaseBoarding(t, boarded);
      }
    }
  }
}

/** Cargo self-defense interceptor: automatic, magazine-limited, short-range.
 *  The coordinated-fire tactic reserves targets, avoids double shots, and
 *  prioritizes missiles hunting the module's own ship then lowest TTI. */
function updateSelfDefense(t: TransitState, dt: number): void {
  const fx = t.effects.selfDefense;
  const pdRadius = fx.range * FORMATIONS[t.formation].defenseRangeMult;
  for (const ship of activeShips(t)) {
    if (!ship.modules.includes('selfDefense')) continue;
    ship.pdCooldown = Math.max(0, ship.pdCooldown - dt);
    if (ship.pdCooldown > 0 || ship.pdShots <= 0 || t.pdAmmo <= 0) continue;
    let best: Threat | null = null;
    let bestKey = Infinity;
    for (const threat of t.threats) {
      if (!threat.alive || !canEngage('selfDefense', threat.kind)) continue;
      const d = dist(ship.x, ship.y, threat.x, threat.y);
      if (d > pdRadius) continue;
      let key = d;
      if (fx.coordinated) {
        // Another module already has a likely kill inbound → skip entirely.
        if (threat.reservedByShipId !== undefined && threat.reservedByShipId !== ship.id) {
          t.stats.counter.duplicateShotsAvoided++;
          continue;
        }
        // Prioritize missiles hunting THIS hull, then lowest time-to-impact.
        const own = threat.targetShipId === ship.id ? 0 : 1;
        key = own * 1000 + timeToImpact(t, threat);
      }
      if (key < bestKey) {
        bestKey = key;
        best = threat;
      }
    }
    if (!best) continue;
    ship.pdCooldown = COMBAT.selfDefense.cooldown;
    ship.pdShots--;
    t.pdAmmo--;
    t.stats.counter.selfDefenseShots++;
    if (fx.coordinated) best.reservedByShipId = ship.id;
    const killChance =
      best.kind === 'guidedMissile'
        ? Math.max(0.05, fx.accuracy - COMBAT.guided.accuracyPenalty)
        : fx.accuracy;
    t.interceptors.push({
      id: t.nextEntityId++,
      x: ship.x,
      y: ship.y,
      targetThreatId: best.id,
      speed: fx.projectileSpeed,
      launcher: 'pd',
      hitChance: killChance,
      auto: true,
      size: fx.projectileSize,
    });
  }
}

/** Anti-air flak: automatically engages enemy aircraft (recon planes; drones
 *  with proximity fuses) entering its arc. It can never engage missiles —
 *  canEngage rejects them, keeping the module separate from self-defense. */
function updateFlak(t: TransitState, dt: number): void {
  const fx = t.effects.flak;
  const flakRadius = fx.range * FORMATIONS[t.formation].defenseRangeMult;
  const researched = fx.proximityFuse ? new Set(['flak.proximityFuse']) : new Set<string>();
  for (const ship of activeShips(t)) {
    if (!ship.modules.includes('flak')) continue;
    ship.flakCooldown = Math.max(0, ship.flakCooldown - dt);
    if (ship.flakCooldown > 0 || ship.flakShots <= 0) continue;
    let best: Threat | null = null;
    let bestD = flakRadius;
    for (const threat of t.threats) {
      if (!threat.alive) continue;
      if (!canEngage('flak', threat.kind, researched)) continue;
      if (
        fx.deconfliction &&
        t.interceptors.some((i) => i.launcher === 'flak' && i.targetThreatId === threat.id)
      ) {
        t.stats.counter.duplicateShotsAvoided++;
        continue;
      }
      const d = dist(ship.x, ship.y, threat.x, threat.y);
      if (d <= bestD) {
        bestD = d;
        best = threat;
      }
    }
    if (!best) continue;
    ship.flakCooldown = fx.reload;
    ship.flakShots--;
    t.stats.counter.flakShots++;
    t.interceptors.push({
      id: t.nextEntityId++,
      x: ship.x,
      y: ship.y,
      targetThreatId: best.id,
      speed: fx.projectileSpeed,
      launcher: 'flak',
      hitChance: fx.accuracy,
      auto: true,
      size: t.effects.selfDefense.projectileSize,
    });
  }
}

/** Pick the bearing off `target` this boat will hold station on, spaced away
 *  from the boats already working that hull so several attackers surround a
 *  ship instead of stacking into one sprite. Deterministic: it starts from the
 *  boat's own approach bearing and steps around until the ring is clear. */
function assignStation(t: TransitState, boat: Threat, target: Ship): number {
  const taken: number[] = [];
  for (const other of t.threats) {
    if (other === boat || other.kind !== 'attackBoat' || !other.alive) continue;
    if (other.targetShipId !== target.id || other.stationAngle === undefined) continue;
    taken.push(other.stationAngle);
  }
  const approach = Math.atan2(boat.y - target.y, boat.x - target.x);
  const clear = (angle: number): boolean =>
    taken.every((a) => Math.abs(angleDiff(angle, a)) >= COMBAT.attackBoat.stationSpacing);
  if (clear(approach)) return approach;
  // Step around the hull in both directions from the approach bearing and take
  // the first clear berth — the boat drives to the near side of the free water.
  for (let step = 1; step <= 12; step++) {
    const delta = step * COMBAT.attackBoat.stationSpacing;
    if (clear(approach + delta)) return approach + delta;
    if (clear(approach - delta)) return approach - delta;
  }
  return approach;
}

/** Attack boats: the surface branch. A boat is a persistent unit and a
 *  physical one — it accelerates, turns under a rate limit, navigates around
 *  its sisters, and holds a standoff ring beside the hull it is working rather
 *  than sitting on top of it. Everything it does to a cargo ship is delivered
 *  by a visible round (updateBoatShots), never by proximity.
 *
 *  Killing the boat is still the only way to stop it, and only the deck gun
 *  can — but now the player gets a readable run-in to do it in. */
function updateAttackBoats(t: TransitState, rng: RNG, dt: number): void {
  const fx = COMBAT.attackBoat;
  for (const boat of t.threats) {
    if (boat.kind !== 'attackBoat' || !boat.alive) continue;
    const variant = boat.boatVariant ?? 'smallArms';
    boat.fireCooldown = Math.max(0, (boat.fireCooldown ?? 0) - dt);
    if (boat.heading === undefined) boat.heading = Math.atan2(boat.vy, boat.vx);

    // --- Target acquisition -------------------------------------------------
    // Re-acquire when the committed hull is gone, delivered or taken. Boats
    // pick their target on arrival, not at launch, so a long run-in never
    // wastes them on a ship that has since scored. A boat that loses its
    // target visibly SAILS to the next one — it keeps its momentum and turns.
    let target = t.ships.find((s) => s.id === boat.targetShipId);
    if (!target || !target.alive || target.delivered || target.captured) {
      if (target) releaseBoarding(t, target);
      boat.targetShipId = undefined;
      boat.stationAngle = undefined;
      boat.engaging = false;
      target = undefined;
    }
    if (!target) {
      const canCommit = t.time >= (boat.retargetAt ?? 0);
      const candidates = canCommit ? targetableShips(t) : [];
      if (candidates.length === 0) {
        // Nothing to hunt (or still in the post-kill pause): coast forward and
        // bleed speed rather than freezing mid-water.
        steerBoat(t, boat, boat.x + Math.cos(boat.heading) * 200, boat.y + Math.sin(boat.heading) * 200, fx.speed * 0.45, dt);
        continue;
      }
      // Boarding boats hunt the prize — that is the T4 doctrine they grant.
      const pick =
        variant === 'boarding'
          ? candidates.reduce((best, s) =>
              SHIP_CLASSES[s.classId].value > SHIP_CLASSES[best.classId].value ? s : best,
            )
          : candidates.reduce((best, s) =>
              dist(boat.x, boat.y, s.x, s.y) < dist(boat.x, boat.y, best.x, best.y) ? s : best,
            );
      boat.targetShipId = pick.id;
      boat.stationAngle = assignStation(t, boat, pick);
      target = pick;
    }
    if (boat.stationAngle === undefined) boat.stationAngle = assignStation(t, boat, target);

    // --- Station keeping ----------------------------------------------------
    // The boat steers for a point ON THE RING around its target, never for the
    // hull itself. That single change is what stops a boat converging onto the
    // ship: the goal it chases is already the standoff distance away.
    const standoff = fx.standoff[variant] ?? fx.standoff.smallArms;
    const stationX = target.x + Math.cos(boat.stationAngle) * standoff;
    const stationY = target.y + Math.sin(boat.stationAngle) * standoff;
    const toStation = dist(boat.x, boat.y, stationX, stationY);
    // Where this tick started, so the total displacement can be held to what a
    // boat could actually cover — steering plus buffer correction combined.
    const fromX = boat.x;
    const fromY = boat.y;
    // Match the hull's pace once on station, so a boat alongside drifts with
    // the convoy instead of oscillating past it — but never sprint-close: the
    // approach speed tapers with the distance still to run.
    const desiredSpeed = Math.min(fx.speed, target.speed + toStation * 1.6);
    steerBoat(t, boat, stationX, stationY, desiredSpeed, dt);

    // Buffer: a boat is pushed back out if it ends up inside the hull's
    // personal space — but only ever by as far as it could physically move in
    // a tick. A hard snap to the ring would be a teleport in its own right,
    // which is precisely the thing this rework exists to remove; the steering
    // above is already aiming at the ring, so a bounded nudge closes the gap
    // within a few frames. The only way in here at all is committing to a new
    // hull that is already close, which is a legitimate transient.
    const minDist = Math.max(
      standoff * fx.hullBuffer,
      SHIP_CLASSES[target.classId].radius + COMBAT.escort.hitRadius,
    );
    const dHull = dist(boat.x, boat.y, target.x, target.y);
    if (dHull < minDist) {
      const nx = dHull > 0.001 ? (boat.x - target.x) / dHull : Math.cos(boat.stationAngle);
      const ny = dHull > 0.001 ? (boat.y - target.y) / dHull : Math.sin(boat.stationAngle);
      const push = Math.min(minDist - dHull, fx.speed * dt);
      boat.x += nx * push;
      boat.y += ny * push;
    }
    // Absolute invariant: however the steering and the buffer combined, a boat
    // never covers more ground in one tick than its own speed allows. This is
    // the guarantee the whole rework rests on — nothing about a boat's motion
    // is ever a jump the player could not have watched happen.
    const moved = dist(fromX, fromY, boat.x, boat.y);
    const limit = fx.speed * dt;
    if (moved > limit) {
      boat.x = fromX + ((boat.x - fromX) / moved) * limit;
      boat.y = fromY + ((boat.y - fromY) / moved) * limit;
    }

    const range = variant === 'boarding' ? fx.boardRange : fx.engageRange;
    const engaged = dist(boat.x, boat.y, target.x, target.y) <= range;
    boat.engaging = engaged;
    if (!engaged) continue;

    if (variant === 'boarding') {
      advanceBoarding(t, boat, target, dt);
      continue;
    }

    // --- Gunnery ------------------------------------------------------------
    // Damage leaves the boat as a round that has to cross the water. Nothing
    // here touches the target's hp — updateBoatShots does, on impact.
    const weapon = fx.fire[variant];
    if (!weapon || (boat.fireCooldown ?? 0) > 0) continue;
    boat.fireCooldown = weapon.interval;
    fireBoatRound(t, boat, target, variant, weapon, rng);
  }

  // Captured hulls steer off toward the hostile shore under their prize crew.
  // They are already out of the game; this is purely so the player can watch it
  // happen instead of a ship blinking out.
  for (const ship of t.ships) {
    if (!ship.captured || t.time >= ship.captureExitAt) continue;
    ship.y += (WORLD.launchSites[0].y - ship.y) * Math.min(1, dt * 0.6);
    ship.x -= 20 * dt;
  }
}

/** Move one boat toward a goal point under acceleration, turn-rate and
 *  boat-to-boat separation limits.
 *
 *  This is the whole difference between the old model and this one. Before,
 *  a boat set its velocity straight at its target every tick and then had its
 *  POSITION lerped onto the hull once inside range — so it could reverse
 *  course instantly and effectively teleported alongside. Here it has a
 *  heading it can only swing so fast and a speed it can only change so
 *  quickly, which gives every approach a track the player can read and react
 *  to. Losing a ship should be a failure to answer, never a surprise. */
function steerBoat(
  t: TransitState,
  boat: Threat,
  goalX: number,
  goalY: number,
  desiredSpeed: number,
  dt: number,
): void {
  const fx = COMBAT.attackBoat;
  let gx = goalX - boat.x;
  let gy = goalY - boat.y;
  const gd = Math.hypot(gx, gy) || 1;
  gx /= gd;
  gy /= gd;

  // Separation: steer away from other boats crowding this one, so a group
  // converging on the same convoy spreads out instead of merging.
  let sx = 0;
  let sy = 0;
  for (const other of t.threats) {
    if (other === boat || other.kind !== 'attackBoat' || !other.alive) continue;
    const dx = boat.x - other.x;
    const dy = boat.y - other.y;
    const d = Math.hypot(dx, dy);
    if (d <= 0.001 || d >= fx.separation) continue;
    const push = (fx.separation - d) / fx.separation;
    sx += (dx / d) * push;
    sy += (dy / d) * push;
  }

  const vx = gx + sx * fx.separationWeight;
  const vy = gy + sy * fx.separationWeight;
  const desiredHeading = Math.atan2(vy, vx);
  const heading = boat.heading ?? desiredHeading;
  const turn = clamp(angleDiff(desiredHeading, heading), -fx.turnRate * dt, fx.turnRate * dt);
  boat.heading = heading + turn;

  // Speed eases toward the request, and a boat hauling its wheel over sheds
  // pace the way a real hull does — which is what makes a hard turn cost it
  // something rather than being free.
  const turnPenalty = 1 - 0.45 * Math.min(1, Math.abs(angleDiff(desiredHeading, boat.heading)) / (Math.PI / 2));
  const wanted = Math.max(0, desiredSpeed) * turnPenalty;
  const current = boat.speed ?? 0;
  boat.speed = current + clamp(wanted - current, -fx.accel * dt, fx.accel * dt);
  boat.vx = Math.cos(boat.heading) * boat.speed;
  boat.vy = Math.sin(boat.heading) * boat.speed;
  boat.x += boat.vx * dt;
  boat.y += boat.vy * dt;
  boat.y = clamp(boat.y, 40, WORLD.height - 40);
}

/** Fire one visible round from a boat at its target, leading the hull and
 *  scattering the aim. The round carries the damage; the boat does not. */
function fireBoatRound(
  t: TransitState,
  boat: Threat,
  target: Ship,
  variant: BoatVariant,
  weapon: { interval: number; damage: number; speed: number; spread: number; size: number },
  rng: RNG,
): void {
  // Lead the target: aim where she will be when the round arrives, so a boat
  // shooting at a moving hull is not systematically shooting behind it.
  const flight = dist(boat.x, boat.y, target.x, target.y) / weapon.speed;
  const aimX = target.x + Math.cos(target.heading) * target.speed * flight + rng.range(-weapon.spread, weapon.spread);
  const aimY = target.y + Math.sin(target.heading) * target.speed * flight + rng.range(-weapon.spread, weapon.spread);
  const d = dist(boat.x, boat.y, aimX, aimY) || 1;
  t.stats.boatRoundsFired++;
  t.boatShots.push({
    id: t.nextEntityId++,
    ownerBoatId: boat.id,
    targetShipId: target.id,
    variant,
    x: boat.x,
    y: boat.y,
    vx: ((aimX - boat.x) / d) * weapon.speed,
    vy: ((aimY - boat.y) / d) * weapon.speed,
    targetX: aimX,
    targetY: aimY,
    damage: weapon.damage,
    size: weapon.size,
    alive: true,
    expireIn: COMBAT.attackBoat.projectileOvershoot,
  });
}

/** Fly every boat round, and resolve what it strikes.
 *
 *  Damage goes through damageShip like any other hit, which is what earns it
 *  the whole existing machinery: branch credit, the per-hull tally that splits
 *  a kill fairly, fire ignition, and — because killShip now receives the rng —
 *  survivors in the water when the hull goes down. */
function updateBoatShots(t: TransitState, rng: RNG, dt: number): void {
  for (const shot of t.boatShots) {
    if (!shot.alive) continue;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;

    let struck: Ship | null = null;
    for (const ship of activeShips(t)) {
      const radius = COMBAT.attackBoat.projectileHitRadius + SHIP_CLASSES[ship.classId].radius * 0.5;
      if (dist(shot.x, shot.y, ship.x, ship.y) <= radius) {
        struck = ship;
        break;
      }
    }
    if (struck) {
      shot.alive = false;
      t.stats.boatRoundsHit++;
      const wasAlive = struck.alive;
      const boat = t.threats.find((b) => b.id === shot.ownerBoatId);
      damageShip(t, struck, shot.damage, boatCause(shot.variant), rng, shot.variant === 'rocket');
      if (wasAlive && !struck.alive) {
        t.stats.boatKills++;
        // The boat that finished her stands off and picks a new hull after the
        // reposition pause, exactly as before.
        if (boat) {
          boat.targetShipId = undefined;
          boat.stationAngle = undefined;
          boat.engaging = false;
          boat.retargetAt = t.time + COMBAT.attackBoat.retargetDelay;
        }
      }
      continue;
    }

    // Past its aim point and hit nothing: a visible miss. It runs on for a
    // moment so the player can see the round go wide.
    const overshot =
      (shot.x - shot.targetX) * shot.vx + (shot.y - shot.targetY) * shot.vy > 0;
    if (overshot) {
      shot.expireIn -= dt;
      if (shot.expireIn <= 0) shot.alive = false;
    }
    if (
      shot.x < -60 || shot.x > WORLD.width + 60 ||
      shot.y < -60 || shot.y > WORLD.height + 60
    ) {
      shot.alive = false;
    }
  }
  t.boatShots = t.boatShots.filter((s) => s.alive);
}

/** Loss cause naming the boat node responsible, so the AAR can be specific. */
function boatCause(variant: BoatVariant): string {
  return variant === 'rocket' ? 'rocketBoat' : variant === 'boarding' ? 'captured' : 'attackBoat';
}

/** Drop a half-finished boarding. Progress is LOST, not paused — driving the
 *  boat off has to be worth something, or the counter is just a delay. */
function releaseBoarding(t: TransitState, ship: Ship): void {
  if (ship.boardingSeconds <= 0) return;
  ship.boardingSeconds = 0;
  t.stats.counter.boardingInterrupted++;
  pushEvent(t, { type: 'boardingRepelled', shipId: ship.id, shipName: ship.name });
}

/** Boarding: the capture clock, and every anti-boarding node that fights it. */
function advanceBoarding(t: TransitState, boat: Threat, ship: Ship, dt: number): void {
  const fx = t.effects.antiBoarding;
  const equipped = fx.equippedEffect && ship.modules.includes('antiBoarding');
  if (ship.boardingSeconds <= 0) {
    t.stats.counter.boardingAttempts++;
    pushEvent(t, { type: 'boardingStarted', shipId: ship.id, shipName: ship.name });
  }

  // Citadel Lockdown: one free freeze partway through the takeover.
  const needed = COMBAT.attackBoat.boardingSeconds;
  if (equipped && fx.lockdown && !ship.lockdownUsed && ship.boardingSeconds >= needed * 0.5) {
    ship.lockdownUsed = true;
    ship.boardingLockUntil = t.time + 4;
  }
  if (t.time < ship.boardingLockUntil) return;

  // Counter-Boarding Team: while the boat is under deck-gun fire the crew is
  // pushing them back off, not merely holding. This is the node that rewards
  // actually shooting at the thing rather than buying armour and waiting.
  if (equipped && fx.counterTeam && boat.engagedByEscortId !== undefined) {
    ship.boardingSeconds = Math.max(0, ship.boardingSeconds - dt);
    return;
  }

  ship.boardingSeconds += dt / (equipped ? fx.slowMult : 1);

  // Emergency Rejection: one almost-complete capture per hull is thrown back.
  // It buys time — the boat is untouched and will simply start again.
  if (equipped && fx.emergencyRejection && !ship.rejectionUsed && ship.boardingSeconds >= needed * 0.9) {
    ship.rejectionUsed = true;
    ship.boardingSeconds = 0;
    t.stats.counter.boardingInterrupted++;
    pushEvent(t, { type: 'boardingRepelled', shipId: ship.id, shipName: ship.name, detail: 'rejection' });
    return;
  }

  if (ship.boardingSeconds >= needed) {
    captureShip(t, ship);
    boat.targetShipId = undefined;
    boat.engaging = false;
    boat.retargetAt = t.time + COMBAT.attackBoat.retargetDelay;
  }
}

/** A hull taken by a boarding party. Counted as a loss like a sinking, but
 *  flagged so the AAR and the confidence penalty can treat it as the worse
 *  outcome it is — the cargo is in enemy hands, not on the seabed. */
function captureShip(t: TransitState, ship: Ship): void {
  if (!ship.alive) return;
  ship.captured = true;
  ship.captureExitAt = t.time + COMBAT.attackBoat.captureExitSeconds;
  t.stats.shipsCaptured++;
  t.stats.counter.boardingCaptures++;
  killShip(t, ship, 'captured');
}

/** Artillery: fixed shore guns firing direct across the near water.
 *
 *  The whole branch hinges on RANGE. A gun engages only what falls inside its
 *  reach, which for a coastal gun is the near lane and nothing else, so routing
 *  the convoy wide is a real and complete answer — and hugging the near lane is
 *  a real and expensive mistake. Suppression from counter-battery silences a
 *  gun for a while; enough focused strikes remove it for the round. */
function updateArtillery(t: TransitState, rng: RNG, dt: number): void {
  const fx = COMBAT.artillery;
  for (const gun of t.installations) {
    if (gun.destroyed) continue;
    gun.cooldown -= dt;
    if (t.time < gun.suppressedUntil) {
      // A suppressed crew is off the gun, not merely pausing: it loses the
      // ranging solution it had been building, and a barrage in progress is
      // broken up rather than resumed where it left off.
      gun.walkShots = 0;
      gun.walkTargetShipId = undefined;
      if (t.effects.counterBattery.barrageDisruption) gun.barrageLeft = 0;
      continue;
    }

    if (gun.variant === 'rollingBarrage') {
      updateBarrage(t, gun, rng);
      continue;
    }
    if (gun.cooldown > 0) continue;

    // Only hulls genuinely inside the gun's reach are candidates. This is the
    // near-lane rule and it is enforced here rather than by any aiming code.
    const range = fx.range[gun.variant];
    const inReach = activeShips(t).filter((s) => dist(gun.x, gun.y, s.x, s.y) <= range);
    if (inReach.length === 0) {
      gun.walkShots = 0;
      gun.walkTargetShipId = undefined;
      continue;
    }
    // T2 doctrine, expressed as geometry rather than a rule: the gun shoots at
    // what is closest to its own shore.
    const target = inReach.reduce((best, s) =>
      dist(gun.x, gun.y, s.x, s.y) < dist(gun.x, gun.y, best.x, best.y) ? s : best,
    );

    // Ranging artillery WALKS its fire in: consecutive shells at the same hull
    // tighten the aim, and the solution is lost the moment that hull is no
    // longer the one being shot at. Holding position in reach is the mistake.
    let scatter: number = fx.scatter[gun.variant];
    if (gun.variant === 'ranging') {
      if (gun.walkTargetShipId === target.id) gun.walkShots++;
      else {
        gun.walkTargetShipId = target.id;
        gun.walkShots = 0;
      }
      scatter = Math.max(fx.walkMinScatter, scatter * fx.walkTightening ** gun.walkShots);
    }

    gun.cooldown = fx.reload[gun.variant];
    fireShell(t, gun, target.x + rng.range(-scatter, scatter), target.y + rng.range(-scatter, scatter));
  }
}

/** A rolling barrage: a salvo of shells sweeping along one lane, then a pause.
 *  It is aimed at WATER, not at a ship — the point is a wall of fire moving up
 *  a lane that the convoy has to not be in. */
function updateBarrage(t: TransitState, gun: EnemyInstallation, rng: RNG): void {
  const fx = COMBAT.artillery;
  if (gun.barrageLeft <= 0) {
    if (t.time < gun.barrageNextAt) return;
    // Pick the lane inside reach carrying the most hulls — a barrage is worth
    // firing at the water the convoy is actually using.
    const reachable = WORLD.lanes.filter((laneY) => Math.abs(laneY - gun.y) <= fx.range.rollingBarrage);
    if (reachable.length === 0) {
      gun.barrageNextAt = t.time + fx.barrageInterval;
      return;
    }
    const ships = activeShips(t);
    const laneY = reachable.reduce((best, laneY) => {
      const count = (y: number): number => ships.filter((s) => Math.abs(s.y - y) < 90).length;
      return count(laneY) > count(best) ? laneY : best;
    });
    gun.barrageY = laneY;
    // A rolling barrage WALKS AHEAD of an advancing target — that is the whole
    // point of the name. Anchoring the sweep to the gun instead put shells on
    // water the convoy had already crossed: 60 shells and no kills in testing.
    // Start it just ahead of the leading hull in the lane and sweep forward, so
    // the convoy sails into successive rounds rather than out of them.
    const inLane = ships.filter(
      (s) => Math.abs(s.y - laneY) < 90 && dist(gun.x, gun.y, s.x, s.y) <= fx.range.rollingBarrage,
    );
    const leadX = inLane.length > 0 ? Math.max(...inLane.map((s) => s.x)) : gun.x;
    gun.barrageFromX = leadX + 40 + rng.range(-25, 25);
    gun.barrageLeft = fx.barrageShells;
    gun.cooldown = 0;
  }
  if (gun.cooldown > 0) return;
  const fired = fx.barrageShells - gun.barrageLeft;
  const step = fx.barrageSweep / Math.max(1, fx.barrageShells - 1);
  const aimX = gun.barrageFromX + fired * step;
  const s = fx.scatter.rollingBarrage;
  gun.barrageLeft--;
  gun.cooldown = fx.reload.rollingBarrage;
  if (gun.barrageLeft <= 0) gun.barrageNextAt = t.time + fx.barrageInterval;
  fireShell(t, gun, aimX + rng.range(-s * 0.3, s * 0.3), gun.barrageY + rng.range(-s * 0.4, s * 0.4));
}

/** Put one shell in the air toward an impact point. */
function fireShell(t: TransitState, gun: EnemyInstallation, aimX: number, aimY: number): void {
  const fx = COMBAT.artillery;
  const d = dist(gun.x, gun.y, aimX, aimY) || 1;
  t.stats.shellsFired++;
  t.shells.push({
    id: t.nextEntityId++,
    x: gun.x,
    y: gun.y,
    vx: ((aimX - gun.x) / d) * fx.shellSpeed,
    vy: ((aimY - gun.y) / d) * fx.shellSpeed,
    targetX: aimX,
    targetY: aimY,
    damage: fx.damage[gun.variant],
    variant: gun.variant,
    alive: true,
  });
  announceArtillery(t, gun.variant);
}

/** Shells in flight. A shell bursts at its aim point and damages what is near
 *  it — an area weapon, so it never homes and never "misses" a hull it was
 *  never aimed at. Nothing in the game can shoot one down. */
function updateShells(t: TransitState, rng: RNG, dt: number): void {
  const fx = COMBAT.artillery;
  for (const shell of t.shells) {
    if (!shell.alive) continue;
    const remaining = dist(shell.x, shell.y, shell.targetX, shell.targetY);
    const step = Math.hypot(shell.vx, shell.vy) * dt;
    if (remaining > step) {
      shell.x += shell.vx * dt;
      shell.y += shell.vy * dt;
      continue;
    }
    shell.x = shell.targetX;
    shell.y = shell.targetY;
    shell.alive = false;
    let hit = false;
    for (const ship of activeShips(t)) {
      if (dist(shell.x, shell.y, ship.x, ship.y) > fx.splashRadius) continue;
      hit = true;
      damageShip(t, ship, shell.damage, artilleryCause(shell.variant), rng, true);
    }
    for (const escort of t.escorts) {
      if (!escort.alive) continue;
      if (dist(shell.x, shell.y, escort.x, escort.y) > fx.splashRadius) continue;
      hit = true;
      damageEscort(t, escort, shell.damage, `escort:${artilleryCause(shell.variant)}`);
    }
    if (hit) t.stats.shellHits++;
  }
  t.shells = t.shells.filter((s) => s.alive);
}

/** Loss cause naming the artillery node responsible. */
function artilleryCause(variant: ArtilleryVariant): string {
  return variant === 'ranging'
    ? 'rangingArtillery'
    : variant === 'rollingBarrage'
      ? 'rollingBarrage'
      : 'artillery';
}

/** Artillery debuts. Guns are emplacements in plain sight on the far shore, so
 *  the player learns what they face the first time one opens up. */
function announceArtillery(t: TransitState, variant: ArtilleryVariant): void {
  announceDebut(t, 'artillery');
  if (variant === 'ranging') announceDebut(t, 'rangingArtillery');
  if (variant === 'rollingBarrage') announceDebut(t, 'rollingBarrage');
}

/** Schedule the round's recon planes and drones across the fire window. Both
 *  are launched rather than placed, so they get times the way missiles do. */
function buildEaQueue(plan: RoundPlan): { time: number; kind: 'reconPlane' | 'disablingDrone' }[] {
  const out: { time: number; kind: 'reconPlane' | 'disablingDrone' }[] = [];
  const total = plan.electronic.reconPlanes + plan.electronic.disablingDrones;
  if (total === 0) return out;
  const start = 10;
  const span = 90;
  for (let i = 0; i < total; i++) {
    out.push({
      time: start + (span * (i + 0.4)) / (total + 0.8),
      kind: i < plan.electronic.reconPlanes ? 'reconPlane' : 'disablingDrone',
    });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Lay the enemy's scheduled smoke. Screening clouds have a fixed position over
 *  the launch sites; blinding clouds resolve their center when they go up, over
 *  wherever the convoy actually is, so they always land on ships. */
function updateEnemySmoke(t: TransitState): void {
  while (t.smokeQueue.length > 0 && t.smokeQueue[0].time <= t.time) {
    const plan = t.smokeQueue.shift()!;
    let x = plan.x ?? 0;
    let y = plan.y ?? 0;
    if (plan.variant === 'blinding') {
      const ships = activeShips(t);
      if (ships.length === 0) continue; // nothing to blind; the charge is wasted
      x = ships.reduce((a, s) => a + s.x, 0) / ships.length;
      y = ships.reduce((a, s) => a + s.y, 0) / ships.length;
    }
    t.stats.smokeCloudsLaid++;
    t.areaEffects.push({
      id: t.nextEntityId++,
      kind: 'enemySmoke',
      x,
      y,
      radius: COMBAT.enemySmoke.radius,
      until: t.time + COMBAT.enemySmoke.seconds,
      blinding: plan.variant === 'blinding',
    });
    announceDebut(t, plan.variant === 'blinding' ? 'blindingSmoke' : 'screeningSmoke');
    pushEvent(t, { type: 'enemySmoke', detail: plan.variant });
  }
}

/** Electronic attack: recon planes, disabling drones and sensor jamming.
 *
 *  Two of the three are objects the player can shoot; the third deliberately is
 *  not. ENEMY_ATTACKS.md allows exactly one node in the whole design with no
 *  counter, and this is it — the work-arounds are hardened channels, emergency
 *  reboots, and simply not relying on detection for thirty seconds. */
function updateElectronic(t: TransitState, rng: RNG, dt: number): void {
  const fx = COMBAT.electronic;

  // Sensor jamming fires once, at the round's start, so its cost is visible up
  // front rather than sprung late.
  if (t.pendingJamming > 0 && t.time >= fx.jammingStartT) {
    t.pendingJamming--;
    t.jammingSeconds = Math.max(t.jammingSeconds, fx.jammingSeconds);
    announceDebut(t, 'sensorJamming');
    pushEvent(t, { type: 'jammingStarted' });
  }

  // Recon planes and drones launch from the hostile shore.
  while (t.eaQueue.length > 0 && t.eaQueue[0].time <= t.time) {
    const launch = t.eaQueue.shift()!;
    const site = rng.pick(WORLD.launchSites);
    if (launch.kind === 'reconPlane') {
      t.stats.reconPlanes++;
      t.threats.push({
        id: t.nextEntityId++,
        kind: 'reconPlane',
        x: -60,
        // Crosses OVER the shipping lanes, not along its own shore. A plane
        // that never comes within flak reach is not shootable in any
        // meaningful sense, and the design calls for a reaction test.
        y: rng.pick(WORLD.lanes) + rng.range(-60, 60),
        vx: fx.reconSpeed,
        vy: 0,
        speed: fx.reconSpeed,
        alive: true,
        revealed: true,
        lowSig: false,
        claimedByInterceptor: false,
        hp: fx.reconHp,
        maxHp: fx.reconHp,
      });
      announceDebut(t, 'reconPlane');
      continue;
    }
    const target = rng.pick(targetableShips(t) as Ship[]);
    if (!target) continue;
    t.stats.disablingDrones++;
    t.threats.push({
      id: t.nextEntityId++,
      kind: 'disablingDrone',
      x: site.x,
      y: site.y,
      vx: 0,
      vy: 0,
      speed: fx.droneSpeed,
      alive: true,
      revealed: true,
      lowSig: false,
      claimedByInterceptor: false,
      hp: fx.droneHp,
      maxHp: fx.droneHp,
      targetKind: 'ship',
      targetShipId: target.id,
    });
    announceDebut(t, 'disablingDrone');
  }

  // Movement.
  for (const threat of t.threats) {
    if (!threat.alive) continue;
    if (threat.kind === 'reconPlane') {
      // Straight across the map. It is only overhead for one crossing, which is
      // what makes shooting it down a reaction test rather than a formality.
      threat.x += threat.vx * dt;
      if (threat.x > WORLD.width + 80) threat.alive = false;
      continue;
    }
    if (threat.kind !== 'disablingDrone') continue;
    const ship = t.ships.find((s) => s.id === threat.targetShipId && s.alive && !s.delivered);
    if (!ship) {
      threat.alive = false; // its one target is gone; a single-use weapon wasted
      continue;
    }
    const d = dist(threat.x, threat.y, ship.x, ship.y) || 1;
    if (d > 18) {
      threat.vx = ((ship.x - threat.x) / d) * threat.speed;
      threat.vy = ((ship.y - threat.y) / d) * threat.speed;
      threat.x += threat.vx * dt;
      threat.y += threat.vy * dt;
      continue;
    }
    // Arrived: the hull goes dead in the water. It keeps its cargo and its hull
    // — this branch does not sink anything — but it is now a static target.
    threat.alive = false;
    ship.disabledUntil = Math.max(ship.disabledUntil, t.time + fx.droneDisableSeconds);
    pushEvent(t, { type: 'shipDisabled', shipId: ship.id, shipName: ship.name });
  }

  // A disabled hull is a sitting target, and the branch that put it there earns
  // from everything that lands on it while it cannot move.
  for (const ship of activeShips(t)) {
    if (t.time < ship.disabledUntil) t.stats.shipDisabledSeconds += dt;
  }
}

/** Credit a SUPPORT branch for damage it enabled but did not deal.
 *
 *  Smoke and electronic attack take no hulls of their own. Without this they
 *  score exactly zero, the allocator defunds them on the first settlement, and
 *  two of seven branches are dead content at any price. The credit is an
 *  addition rather than a transfer — the branch that fired still gets its full
 *  result, because both of them genuinely contributed. */
function creditAssist(t: TransitState, ship: Ship, dealt: number, source?: Threat): void {
  const share = ENEMY_ECONOMY.assistShare;
  const pay = (branch: 'smoke' | 'electronic'): void => {
    const entry = (t.stats.enemyBranch[branch] ??= { damage: 0, kills: 0 });
    entry.damage += dealt * share;
    ship.damageByBranch[branch] = (ship.damageByBranch[branch] ?? 0) + dealt * share;
  };
  // Hit while the hull was sitting disabled, while detection was blacked out,
  // or while a recon plane was overhead suppressing every interceptor's
  // accuracy — that last one is why the branch's cheapest node is worth
  // anything at all, and why shooting the plane down pays: kill it early and
  // the branch stops earning for the rest of the round.
  if (t.time < ship.disabledUntil || t.jammingSeconds > 0 || reconOverhead(t)) pay('electronic');
  // Hit by something the player never got a clean look at — either the hull
  // was under a blinding cloud, or the weapon itself came out of a screening
  // one and could not be pointed at on the way in.
  if (source?.wasConcealed || enemySmokeAt(t, ship.x, ship.y) !== null) pay('smoke');
}

/** Passive torpedo detection (hydrophone modules) — bearing contacts. */
function updateTorpedoDetection(t: TransitState): void {
  if (!sensorAvailable(t, 'torpedoDetection')) return;
  const fx = t.effects.hydrophone;
  for (const threat of t.threats) {
    if (threat.kind !== 'torpedo' || !threat.alive || threat.revealed) continue;
    if (threat.lowSig && !fx.detectLowSig) continue;
    for (const ship of activeShips(t)) {
      if (!ship.modules.includes('hydrophone')) continue;
      if (dist(ship.x, ship.y, threat.x, threat.y) <= fx.range) {
        threat.revealed = true;
        t.stats.torpedoesDetected++;
        t.stats.counter.detections.hydrophone++;
        pushEvent(t, { type: 'torpedoDetected', lowSig: threat.lowSig, detail: 'hydrophone' });
        announceTorpedo(t, threat);
        break;
      }
    }
  }
}

/** Expire placed area effects; sonar pings keep revealing torpedoes that run
 *  into them; smoke refreshes the track-breaking grace on ships inside. */
function updateAreaEffects(t: TransitState): void {
  for (const fx of t.areaEffects) {
    if (t.time >= fx.until) continue;
    if (fx.kind === 'sonar') {
      revealTorpedoesInPing(t, fx);
    } else if (fx.kind === 'smoke' && t.effects.smokeTrackBreakSeconds > 0) {
      for (const ship of activeShips(t)) {
        if (dist(ship.x, ship.y, fx.x, fx.y) <= fx.radius) {
          ship.smokeGraceUntil = t.time + t.effects.smokeTrackBreakSeconds;
        }
      }
    }
  }
  t.areaEffects = t.areaEffects.filter((fx) => t.time < fx.until);
}

/** Depth-charge rounds fly to their point and detonate. The blast destroys
 *  torpedoes ONLY — the compatibility rule, enforced at the moment of effect. */
function updateDepthChargeShots(t: TransitState, rng: RNG, dt: number): void {
  for (const shot of t.depthChargeShots) {
    if (shot.detonated) continue;
    const d = dist(shot.x, shot.y, shot.targetX, shot.targetY);
    const step = shot.speed * dt;
    if (d <= step) {
      shot.x = shot.targetX;
      shot.y = shot.targetY;
      shot.detonated = true;
      for (const threat of t.threats) {
        if (!threat.alive || !canEngage('depthCharge', threat.kind)) continue;
        if (dist(shot.x, shot.y, threat.x, threat.y) <= shot.blastRadius) {
          threat.alive = false;
          t.stats.torpedoesDestroyed++;
          t.stats.counter.depthChargeKills++;
          const dropper = t.stats.escortPerformance[shot.ownerUnitId];
          if (dropper) dropper.torpedoKills++;
          pushEvent(t, { type: 'depthChargeKill', threatKind: threat.kind, lowSig: threat.lowSig });
          maybeSpawnWreckage(t, threat, rng);
        }
      }
    } else {
      shot.x += ((shot.targetX - shot.x) / d) * step;
      shot.y += ((shot.targetY - shot.y) / d) * step;
    }
  }
  // Keep detonated shots one extra tick for the renderer, then cull.
  t.depthChargeShots = t.depthChargeShots.filter((s) => !s.detonated || s.speed > 0);
  for (const s of t.depthChargeShots) if (s.detonated) s.speed = 0;
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

export function stepTransit(t: TransitState, commands: TransitCommand[], rng: RNG): void {
  if (t.over) return;
  const dt = SIM.dt;

  for (const cmd of commands) handleCommand(t, cmd, rng);

  // --- Reference progress point (escort default station + effect centers) ----
  const formation = FORMATIONS[t.formation];
  t.anchorX += t.baseSpeed * formation.speedMult * dt;

  // --- Enemy spawns ----------------------------------------------------------
  const pool = activeShips(t);
  // Only hulls that haven't effectively scored are worth a missile.
  const targetPool = targetableShips(t);
  const liveEscorts = t.escorts.filter((e) => e.alive);
  const liveBases = t.bases.filter((b) => b.alive);
  while (t.spawnQueue.length > 0 && t.spawnQueue[0].time <= t.time) {
    const spawn = t.spawnQueue.shift()!;
    // Nothing to shoot at (all ships resolved and no escorts afloat) → skip.
    if (pool.length === 0 && liveEscorts.length === 0) continue;
    const site = { x: spawn.siteX, y: WORLD.launchSites[0].y };

    if (spawn.kind === 'torpedo') {
      // The UNDERWATER branch: launched from the shore and run under the
      // surface toward the convoy. Interceptors, ECM and close-in defense are
      // all useless here by design — the counter is detection + depth charges.
      const target = pickMissileTarget(t, rng, targetPool, [], 1, site.x, site.y);
      if (!target) continue;
      t.stats.torpedoesLaunched++;
      const tx = target.kind === 'ship' ? target.ship.x : target.escort.x;
      const ty = target.kind === 'ship' ? target.ship.y : target.escort.y;
      const d = dist(site.x, site.y, tx, ty) || 1;
      t.threats.push({
        id: t.nextEntityId++,
        kind: 'torpedo',
        x: site.x,
        y: site.y,
        vx: ((tx - site.x) / d) * COMBAT.torpedo.speed,
        vy: ((ty - site.y) / d) * COMBAT.torpedo.speed,
        speed: COMBAT.torpedo.speed,
        alive: true,
        targetKind: target.kind === 'ship' ? 'ship' : 'escort',
        targetShipId: target.kind === 'ship' ? target.ship.id : undefined,
        targetEntityId: target.kind === 'escort' ? target.escort.id : undefined,
        // A wake-leaving torpedo is only spotted once something is close
        // enough to read the water (or a hydrophone hears it first).
        revealed: false,
        lowSig: !!spawn.lowSig,
        homing: !!spawn.homing,
        claimedByInterceptor: false,
      });
      continue;
    }

    if (spawn.kind === 'attackBoat') {
      // The SURFACE branch: a persistent unit, not a projectile. It puts to sea
      // from the shore and picks its first hull on arrival rather than at
      // launch — a boat that takes 20 seconds to close should be hunting what
      // is actually in front of it, not a ship that has since been delivered.
      const variant = spawn.boatVariant ?? 'smallArms';
      t.stats.boatsLaunched++;
      const maxHp = COMBAT.attackBoat.hp[variant];
      t.threats.push({
        id: t.nextEntityId++,
        kind: 'attackBoat',
        x: site.x,
        y: site.y,
        vx: 0,
        vy: 0,
        // Current speed, not a constant: she works up to her cruise.
        speed: COMBAT.attackBoat.speed * 0.4,
        alive: true,
        // Boats are surface craft in plain sight — nothing to detect.
        revealed: true,
        lowSig: false,
        claimedByInterceptor: false,
        hp: maxHp,
        maxHp,
        boatVariant: variant,
        engaging: false,
        // Puts to sea already under way, pointed at the water it has to cross,
        // and builds up to its cruise from there.
        heading: Math.PI / 2,
        fireCooldown: 0,
      });
      announceBoat(t, variant);
      continue;
    }

    if (spawn.kind === 'missile') {
      // A fraction of unguided missiles streak across to strike a shore battery,
      // damaging it and knocking it offline rather than hitting the convoy.
      if (liveBases.length > 0 && rng.chance(COMBAT.baseStrikeChance)) {
        const base = rng.pick(liveBases);
        const d = dist(site.x, site.y, base.x, base.y) || 1;
        t.stats.missilesSpawned++;
        t.threats.push({
          id: t.nextEntityId++,
          kind: 'missile',
          x: site.x,
          y: site.y,
          vx: ((base.x - site.x) / d) * COMBAT.missile.speed,
          vy: ((base.y - site.y) / d) * COMBAT.missile.speed,
          speed: COMBAT.missile.speed,
          alive: true,
          targetX: base.x,
          targetY: base.y,
          targetKind: 'base',
          targetEntityId: base.id,
          revealed: true,
          lowSig: false,
          claimedByInterceptor: false,
        });
        continue;
      }

      const target = pickMissileTarget(t, rng, targetPool, liveEscorts, 1, site.x, site.y);
      if (!target) continue;
      t.stats.missilesSpawned++;
      // Lead the target: aim where it will be, iterating the flight-time guess.
      let tx: number;
      let ty: number;
      let leadSpeed: number;
      if (target.kind === 'ship') {
        tx = target.ship.x;
        ty = target.ship.y;
        leadSpeed = SHIP_CLASSES[target.ship.classId].speed * formation.speedMult * target.ship.speedVariance;
      } else {
        tx = target.escort.x;
        ty = target.escort.y;
        leadSpeed = NAV.escortSpeed;
      }
      let aimX = tx;
      let aimY = ty;
      for (let i = 0; i < 2; i++) {
        const flight = dist(site.x, site.y, aimX, aimY) / COMBAT.missile.speed;
        aimX = tx + leadSpeed * flight;
        aimY = ty;
      }
      const d = dist(site.x, site.y, aimX, aimY) || 1;
      t.threats.push({
        id: t.nextEntityId++,
        kind: 'missile',
        x: site.x,
        y: site.y,
        vx: ((aimX - site.x) / d) * COMBAT.missile.speed,
        vy: ((aimY - site.y) / d) * COMBAT.missile.speed,
        speed: COMBAT.missile.speed,
        alive: true,
        targetX: aimX,
        targetY: aimY,
        targetKind: target.kind,
        targetEntityId: target.kind === 'escort' ? target.escort.id : undefined,
        revealed: true,
        lowSig: false,
        claimedByInterceptor: false,
      });
    } else {
      const target = pickMissileTarget(
        t,
        rng,
        targetPool,
        liveEscorts,
        COMBAT.straggleTargetWeight,
        site.x,
        site.y,
      );
      if (!target) continue;
      t.stats.missilesSpawned++;
      announceDebut(t, 'guidedMissile');
      const tx = target.kind === 'ship' ? target.ship.x : target.escort.x;
      const ty = target.kind === 'ship' ? target.ship.y : target.escort.y;
      const d = dist(site.x, site.y, tx, ty) || 1;
      t.threats.push({
        id: t.nextEntityId++,
        kind: 'guidedMissile',
        x: site.x,
        y: site.y,
        vx: ((tx - site.x) / d) * COMBAT.guided.speed,
        vy: ((ty - site.y) / d) * COMBAT.guided.speed,
        speed: COMBAT.guided.speed,
        alive: true,
        targetKind: target.kind,
        targetShipId: target.kind === 'ship' ? target.ship.id : undefined,
        targetEntityId: target.kind === 'escort' ? target.escort.id : undefined,
        revealed: true,
        lowSig: false,
        claimedByInterceptor: false,
      });
    }
  }

  // --- Ships: steering-behavior navigation -----------------------------------
  // Each ship integrates a smoothed steering vector — head east and hold its
  // lane (goal), keep clear water from neighbors (separation), and turn/slow to
  // avoid whatever is ahead (collision avoidance) — through acceleration- and
  // turn-rate-limited motion. The result: ships ease around and wait for one
  // another like real vessels, and never permanently overlap.

  // Bring newly-scheduled ships into the world, already under way.
  for (const ship of t.ships) {
    if (ship.spawned || t.time < ship.spawnTime) continue;
    ship.spawned = true;
    ship.x = WORLD.spawnX;
    ship.y = WORLD.lanes[clampLane(ship.laneIndex)] + ship.lateralSeed * formation.lateralSpread;
    ship.heading = 0;
    ship.speed = SHIP_CLASSES[ship.classId].speed * formation.speedMult * ship.speedVariance;
  }

  // Pre-tick snapshot of every moving hull (ships + escorts) so each ship's
  // steering reads the same world regardless of array order — deterministic.
  const obstacles: { id: number; x: number; y: number; r: number; spd: number }[] = [];
  for (const s of t.ships) {
    if (!isActive(s)) continue;
    obstacles.push({ id: s.id, x: s.x, y: s.y, r: SHIP_CLASSES[s.classId].radius, spd: s.speed });
  }
  for (const e of t.escorts) {
    if (!e.alive) continue;
    obstacles.push({ id: -e.id, x: e.x, y: e.y, r: 12, spd: NAV.escortSpeed });
  }
  const sepBonus = formation.gapBonus;

  for (const ship of t.ships) {
    if (!isActive(ship)) continue;

    const crippled = ship.hp < ship.maxHp * COMBAT.crippleHpFraction;
    const r = SHIP_CLASSES[ship.classId].radius;
    const cruise =
      SHIP_CLASSES[ship.classId].speed *
      formation.speedMult *
      ship.speedVariance *
      (crippled ? COMBAT.crippleSpeedMult : 1);
    const laneY = WORLD.lanes[clampLane(ship.laneIndex)] + ship.lateralSeed * formation.lateralSpread;
    const fx = Math.cos(ship.heading);
    const fy = Math.sin(ship.heading);

    let sepx = 0;
    let sepy = 0;
    let avx = 0;
    let avy = 0;
    // Track the nearest SLOWER hull sitting in my path (my overtake target).
    let blockAlong = Infinity;
    let blockLat = 0;
    let blockSpd = 0;
    let hasBlock = false;

    for (const o of obstacles) {
      if (o.id === ship.id) continue;
      const dx = o.x - ship.x;
      const dy = o.y - ship.y;
      const d = Math.hypot(dx, dy);
      if (d <= 0.001 || d > NAV.perception) continue;
      const nx = dx / d;
      const ny = dy / d;

      // Separation: repel from anything inside the clear-water bubble.
      const sepDist = r + o.r + NAV.sepBuffer + sepBonus;
      if (d < sepDist) {
        const push = (sepDist - d) / sepDist;
        sepx -= nx * push;
        sepy -= ny * push;
      }

      // Forward collision avoidance: obstacle within the cone ahead.
      const along = dx * fx + dy * fy;
      const lat = -dx * fy + dy * fx; // signed lateral offset (left positive)
      if (along > 0 && along < NAV.lookAhead && Math.abs(lat) < r + o.r + NAV.laneBand) {
        const urgency = 1 - along / NAV.lookAhead;
        const side = lat >= 0 ? -1 : 1; // steer to the side opposite the obstacle
        avx += -fy * side * urgency;
        avy += fx * side * urgency;
        if (o.spd < cruise - 0.5 && along < blockAlong) {
          blockAlong = along;
          blockLat = lat;
          blockSpd = o.spd;
          hasBlock = true;
        }
      }
    }

    // Steer around charted (revealed) mines. A revealed mine is a KNOWN hazard
    // on the plotted track — the helm always attempts to clear it rather than
    // gambling on a dodge roll, so a mine spotted by sensors or a scan plane is
    // not blundered into. (Uncharted mines are still a detection problem.)
    for (const mine of t.threats) {
      if (mine.kind !== 'mine' || !mine.alive || !mine.revealed) continue;
      const dx = mine.x - ship.x;
      const dy = mine.y - ship.y;
      const along = dx * fx + dy * fy;
      const lat = -dx * fy + dy * fx;
      if (along <= 0 || along > COMBAT.mineAvoidLookahead || Math.abs(lat) > NAV.mineBand) continue;
      const urgency = 1 - along / COMBAT.mineAvoidLookahead;
      // Steer to whichever side gives more room; if dead ahead, pick a side.
      const side = lat >= 0 ? -1 : 1;
      const w = NAV.mineAvoidWeight / NAV.avoidWeight;
      avx += -fy * side * urgency * w;
      avy += fx * side * urgency * w;
    }

    // Goal: head east, gently pulled toward this ship's lane line. But if a
    // slower hull is in my path, either COMMIT to a clear passing side (and
    // hold speed) or, if boxed in, slow to its pace and wait — like real ships.
    let gx = 1;
    let gy = clamp((laneY - ship.y) / NAV.lanePull, -0.9, 0.9);
    let speedCap = cruise;
    if (hasBlock) {
      const wantSign = blockLat >= 0 ? -1 : 1; // veer to the side away from it
      if (passSideBlocked(ship.id, wantSign, blockAlong, obstacles, ship.x, ship.y, r, fx, fy)) {
        speedCap = blockSpd; // no room to pass → match pace and wait
      } else {
        gy = wantSign * 0.9; // clear water beside it → commit to the pass
      }
    }
    const gl = Math.hypot(gx, gy) || 1;
    gx /= gl;
    gy /= gl;

    // Blend and turn toward the steering vector (turn-rate limited).
    const vx = NAV.goalWeight * gx + NAV.sepWeight * sepx + NAV.avoidWeight * avx;
    const vy = NAV.goalWeight * gy + NAV.sepWeight * sepy + NAV.avoidWeight * avy;
    const desiredHeading = Math.atan2(vy, vx);
    const dh = angleDiff(desiredHeading, ship.heading);
    ship.heading = clamp(
      ship.heading + clamp(dh, -NAV.maxTurnRate * dt, NAV.maxTurnRate * dt),
      -NAV.headingClamp,
      NAV.headingClamp,
    );

    // Speed eases toward the cap, shedding some pace while turning hardest.
    // A hull a disabling drone has reached is dead in the water: it coasts to a
    // stop and sits there, cargo intact, as a static target for everything else.
    const disabled = t.time < ship.disabledUntil;
    const turnFactor = 1 - NAV.turnSlow * Math.min(1, Math.abs(dh) / (Math.PI / 2));
    const targetSpeed = disabled ? 0 : Math.max(0, speedCap) * turnFactor;
    ship.speed += clamp(targetSpeed - ship.speed, -NAV.maxAccel * dt, NAV.maxAccel * dt);
    ship.speed = Math.max(0, ship.speed);

    ship.x += Math.cos(ship.heading) * ship.speed * dt;
    ship.y += Math.sin(ship.heading) * ship.speed * dt;
    ship.y = clamp(ship.y, 60, WORLD.height - 60);

    // Straggling vs the ship's healthy pace: damage or a jam makes it bait.
    const healthySpeed = SHIP_CLASSES[ship.classId].speed * formation.speedMult * ship.speedVariance;
    const nominalX = WORLD.spawnX + Math.max(0, t.time - ship.spawnTime) * healthySpeed;
    ship.straggling = nominalX - ship.x > COMBAT.straggleDistance;

    // Fire damage over time.
    if (ship.fireSeconds > 0) {
      ship.fireSeconds -= dt;
      const burn = COMBAT.fireDps * dt * t.effects.damageTakenMult;
      ship.hp -= burn;
      // Fires are started by missile hits, so the burn belongs to that branch
      // too — otherwise a hull that burns down credits nobody.
      creditEnemyBranch(t, 'fire', burn, false);
      ship.damageByBranch.missiles = (ship.damageByBranch.missiles ?? 0) + burn;
      if (ship.hp <= 0) killShip(t, ship, 'fire');
      if (!ship.alive) continue;
    }

    // Delivery.
    if (ship.x >= WORLD.deliverX) {
      ship.delivered = true;
      t.stats.delivered++;
      t.stats.valueDelivered += SHIP_CLASSES[ship.classId].value;
      pushEvent(t, { type: 'delivered', shipId: ship.id, shipName: ship.name });
    }
  }

  // --- Escorts ---------------------------------------------------------------
  // An escort steams to its player-set destination and then either resumes
  // cruising forward with the convoy (a quick tap order) or stays stationed
  // there holding position (a long-hold order). With no order and not
  // stationed it simply cruises forward at the convoy's pace.
  const convoyFwd = t.baseSpeed * formation.speedMult;
  for (const escort of t.escorts) {
    if (!escort.alive) continue;
    escort.cooldown = Math.max(0, escort.cooldown - dt);
    // The automatic-fire cooldowns tick independently of the launcher reload.
    escort.autoCooldown = Math.max(0, escort.autoCooldown - dt);
    escort.mcmAutoCooldown = Math.max(0, escort.mcmAutoCooldown - dt);
    escort.dcCooldown = Math.max(0, escort.dcCooldown - dt);
    escort.dcAutoCooldown = Math.max(0, escort.dcAutoCooldown - dt);
    if (escort.droneReady <= 0) {
      escort.droneCooldown = Math.max(0, escort.droneCooldown - dt);
      if (escort.droneCooldown <= 0 && escort.modules.includes('mcmDroneLauncher')) {
        escort.droneReady = t.effects.mcm.dualSortie ? 2 : 1;
      }
    }
    if (escort.moveTarget) {
      const dx = escort.moveTarget.x - escort.x;
      const dy = escort.moveTarget.y - escort.y;
      const d = Math.hypot(dx, dy);
      if (d <= NAV.escortArrive) {
        // Arrived: a hold order stations it here; a move order resumes forward.
        escort.stationed = escort.moveTarget.hold;
        escort.moveTarget = null;
      } else {
        const step = Math.min(NAV.escortSpeed * dt, d);
        escort.x += (dx / d) * step;
        escort.y += (dy / d) * step;
        escort.heading = Math.atan2(dy, dx);
      }
    }
    if (!escort.moveTarget && !escort.stationed) {
      escort.x += convoyFwd * dt; // cruise forward with the convoy
      escort.heading = 0;
    }
    escort.x = clamp(escort.x, 20, WORLD.deliverX - 20);
    escort.y = clamp(escort.y, 60, WORLD.height - 60);
  }

  // Last-resort overlap correction across all hulls (ships + escorts). Rare
  // once steering is doing its job; guarantees no visual stacking.
  const bodies: { o: { x: number; y: number }; r: number }[] = [];
  for (const s of t.ships) if (isActive(s)) bodies.push({ o: s, r: SHIP_CLASSES[s.classId].radius });
  for (const e of t.escorts) if (e.alive) bodies.push({ o: e, r: 12 });
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      let dx = a.o.x - b.o.x;
      let dy = a.o.y - b.o.y;
      let d = Math.hypot(dx, dy);
      const minDist = a.r + b.r + 4;
      if (d >= minDist) continue;
      if (d < 0.001) {
        dx = 0;
        dy = 1;
        d = 1;
      }
      const push = (minDist - d) * NAV.overlapPush * 0.5;
      a.o.x += (dx / d) * push;
      a.o.y += (dy / d) * push;
      b.o.x -= (dx / d) * push;
      b.o.y -= (dy / d) * push;
    }
  }

  // --- Shore batteries (fixed; reload + independent auto/CB cooldowns) -------
  for (const base of t.bases) {
    base.cooldown = Math.max(0, base.cooldown - dt);
    base.autoCooldown = Math.max(0, base.autoCooldown - dt);
    base.cbCooldown = Math.max(0, base.cbCooldown - dt);
    base.cbAutoCooldown = Math.max(0, base.cbAutoCooldown - dt);
  }

  // --- Automation tactics ----------------------------------------------------
  updateEscortAuto(t);
  updateBaseAuto(t);
  updateMcmAuto(t);
  updateDepthChargeAuto(t);
  updateCounterBatteryAuto(t, rng);
  updateDeckGuns(t, rng, dt);

  // --- Missiles --------------------------------------------------------------
  for (const threat of t.threats) {
    if (!threat.alive) continue;
    if (threat.kind !== 'missile' && threat.kind !== 'guidedMissile') continue;

    // Inside a deployed ECM jamming orbit a missile's seeker is scrambled, and
    // if it lingers there its guidance cooks off and it explodes harmlessly.
    const scrambled = jammingAt(t, threat.x, threat.y);
    if (scrambled) {
      threat.jamSeconds = (threat.jamSeconds ?? 0) + dt;
      if (threat.jamSeconds >= COMBAT.ecm.explodeSeconds) {
        threat.alive = false;
        t.stats.missilesIntercepted++;
        t.stats.ecmKills++;
        pushEvent(t, { type: 'intercepted', threatKind: threat.kind, detail: 'ecm' });
        // A cooked-off seeker still leaves a physical airframe in the water.
        maybeSpawnWreckage(t, threat, rng);
        continue;
      }
    }
    if (threat.kind === 'guidedMissile' && !scrambled) {
      // Resolve the current homing point (escort or ship); re-acquire the
      // nearest ship if the original target is gone. Track-breaking smoke
      // keeps recently-cloaked ships out of the re-acquisition pool.
      let tgtX: number | undefined;
      let tgtY: number | undefined;
      if (threat.targetKind === 'escort') {
        const esc = t.escorts.find((e) => e.id === threat.targetEntityId && e.alive);
        if (esc) {
          tgtX = esc.x;
          tgtY = esc.y;
        }
      } else {
        const ship = t.ships.find((s) => s.id === threat.targetShipId && s.alive && !s.delivered);
        if (ship) {
          tgtX = ship.x;
          tgtY = ship.y;
        }
      }
      if (tgtX === undefined) {
        let candidates = targetableShips(t);
        if (t.effects.smokeTrackBreakSeconds > 0) {
          const unbroken = candidates.filter((s) => s.smokeGraceUntil <= t.time);
          if (unbroken.length > 0) candidates = unbroken;
        }
        if (candidates.length > 0) {
          const nearest = candidates.reduce((best, s) =>
            dist(threat.x, threat.y, s.x, s.y) < dist(threat.x, threat.y, best.x, best.y) ? s : best,
          );
          threat.targetKind = 'ship';
          threat.targetShipId = nearest.id;
          threat.targetEntityId = undefined;
          tgtX = nearest.x;
          tgtY = nearest.y;
        }
      }
      if (tgtX !== undefined && tgtY !== undefined) {
        // Rotate velocity toward the target with a limited turn rate.
        const desired = Math.atan2(tgtY - threat.y, tgtX - threat.x);
        const current = Math.atan2(threat.vy, threat.vx);
        let delta = desired - current;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta < -Math.PI) delta += 2 * Math.PI;
        const maxTurn = COMBAT.guided.turnRate * dt;
        const angle = current + Math.max(-maxTurn, Math.min(maxTurn, delta));
        threat.vx = Math.cos(angle) * threat.speed;
        threat.vy = Math.sin(angle) * threat.speed;
      }
    }

    threat.x += threat.vx * dt;
    threat.y += threat.vy * dt;

    // Terminal resolution.
    if (threat.kind === 'guidedMissile') {
      const hitChance = scrambled ? t.effects.ecmGuidedHitChance : COMBAT.guided.baseHitChance;
      if (threat.targetKind === 'escort') {
        const esc = t.escorts.find((e) => e.id === threat.targetEntityId && e.alive);
        if (esc && dist(threat.x, threat.y, esc.x, esc.y) <= COMBAT.guided.hitRadius) {
          threat.alive = false;
          if (rng.chance(hitChance)) damageEscort(t, esc, COMBAT.guided.damage, 'guidedMissile');
          else pushEvent(t, { type: 'missileMiss', threatKind: 'guidedMissile' });
        }
      } else {
        const target = t.ships.find((s) => s.id === threat.targetShipId && s.alive && !s.delivered);
        if (target && dist(threat.x, threat.y, target.x, target.y) <= COMBAT.guided.hitRadius) {
          threat.alive = false;
          if (rng.chance(hitChance)) {
            const hx = target.x;
            const hy = target.y;
            const hid = target.id;
            damageShip(t, target, COMBAT.guided.damage, 'guidedMissile', rng, true, threat);
            chainSplash(t, hx, hy, hid, rng); // bunched hulls share the blast (Tight)
          } else {
            pushEvent(t, { type: 'missileMiss', threatKind: 'guidedMissile' });
          }
        }
      }
    } else if (threat.targetKind === 'base') {
      // A battery strike: detonate on the installation, knocking it offline.
      const base = t.bases.find((b) => b.id === threat.targetEntityId && b.alive);
      if (base && dist(threat.x, threat.y, base.x, base.y) <= COMBAT.base.hitRadius) {
        threat.alive = false;
        damageBase(t, base);
      } else if (
        threat.targetX !== undefined &&
        threat.targetY !== undefined &&
        dist(threat.x, threat.y, threat.targetX, threat.targetY) <= threat.speed * dt
      ) {
        threat.alive = false;
        pushEvent(t, { type: 'missileMiss', threatKind: 'missile' });
      }
    } else {
      // Unguided convoy-bound: hit the first hull (ship OR escort) it brushes,
      // else splash at the aim point.
      let struckShip: Ship | null = null;
      for (const ship of activeShips(t)) {
        if (dist(threat.x, threat.y, ship.x, ship.y) <= COMBAT.missile.hitRadius) {
          struckShip = ship;
          break;
        }
      }
      let struckEscort: Escort | null = null;
      if (!struckShip) {
        for (const esc of t.escorts) {
          if (!esc.alive) continue;
          if (dist(threat.x, threat.y, esc.x, esc.y) <= COMBAT.missile.hitRadius + COMBAT.escort.hitRadius) {
            struckEscort = esc;
            break;
          }
        }
      }
      if (struckShip) {
        threat.alive = false;
        const hx = struckShip.x;
        const hy = struckShip.y;
        const hid = struckShip.id;
        damageShip(t, struckShip, COMBAT.missile.damage, 'missile', rng, true, threat);
        chainSplash(t, hx, hy, hid, rng); // bunched hulls share the blast (Tight)
      } else if (struckEscort) {
        threat.alive = false;
        damageEscort(t, struckEscort, COMBAT.missile.damage, 'missile');
      } else if (
        threat.targetX !== undefined &&
        threat.targetY !== undefined &&
        dist(threat.x, threat.y, threat.targetX, threat.targetY) <= threat.speed * dt
      ) {
        threat.alive = false;
        let splashed = false;
        // Dispersed formations shrink the effective blast footprint — this is
        // half of the tight-vs-wide tradeoff the formation tooltips promise.
        const splashRadius =
          COMBAT.missile.splashRadius * FORMATIONS[t.formation].collateralMult;
        for (const ship of activeShips(t)) {
          if (dist(threat.x, threat.y, ship.x, ship.y) <= splashRadius) {
            damageShip(t, ship, COMBAT.missile.splashDamage, 'missile', rng, false);
            splashed = true;
          }
        }
        for (const esc of t.escorts) {
          if (!esc.alive) continue;
          if (dist(threat.x, threat.y, esc.x, esc.y) <= splashRadius) {
            damageEscort(t, esc, COMBAT.missile.splashDamage, 'missile');
            splashed = true;
          }
        }
        if (!splashed) pushEvent(t, { type: 'missileMiss', threatKind: 'missile' });
      }
    }

    // Off-map cleanup.
    if (
      threat.alive &&
      (threat.x < -100 || threat.x > WORLD.width + 100 || threat.y < -100 || threat.y > WORLD.height + 100)
    ) {
      threat.alive = false;
      pushEvent(t, { type: 'missileMiss', threatKind: threat.kind });
    }
  }

  // --- Torpedoes -------------------------------------------------------------
  // Run under the surface toward the convoy. The homing node corrects course;
  // the straight node does not. Nothing in the air-defense stack touches them.
  for (const threat of t.threats) {
    if (threat.kind !== 'torpedo' || !threat.alive) continue;

    // Homing torpedoes re-aim, re-acquiring if their target is gone.
    if (threat.homing) {
      let tgtX: number | undefined;
      let tgtY: number | undefined;
      if (threat.targetKind === 'escort') {
        const esc = t.escorts.find((e) => e.id === threat.targetEntityId && e.alive);
        if (esc) {
          tgtX = esc.x;
          tgtY = esc.y;
        }
      } else {
        const ship = t.ships.find((sh) => sh.id === threat.targetShipId && sh.alive && !sh.delivered);
        if (ship) {
          tgtX = ship.x;
          tgtY = ship.y;
        }
      }
      if (tgtX === undefined) {
        const candidates = targetableShips(t);
        if (candidates.length > 0) {
          const nearest = candidates.reduce((best, sh) =>
            dist(threat.x, threat.y, sh.x, sh.y) < dist(threat.x, threat.y, best.x, best.y) ? sh : best,
          );
          threat.targetKind = 'ship';
          threat.targetShipId = nearest.id;
          threat.targetEntityId = undefined;
          tgtX = nearest.x;
          tgtY = nearest.y;
        }
      }
      if (tgtX !== undefined && tgtY !== undefined) {
        const desired = Math.atan2(tgtY - threat.y, tgtX - threat.x);
        const current = Math.atan2(threat.vy, threat.vx);
        const maxTurn = COMBAT.torpedo.turnRate * dt;
        const angle = current + clamp(angleDiff(desired, current), -maxTurn, maxTurn);
        threat.vx = Math.cos(angle) * threat.speed;
        threat.vy = Math.sin(angle) * threat.speed;
      }
    }

    threat.x += threat.vx * dt;
    threat.y += threat.vy * dt;

    // WAKE: a straight or homing torpedo leaves a trail any nearby hull can
    // read off the water with no equipment. The low-signature node leaves
    // none, so it stays invisible until an active sensor finds it — that is
    // the entire reason to buy a hydrophone upgrade or an active sonar ping.
    if (!threat.revealed && !threat.lowSig) {
      for (const ship of activeShips(t)) {
        if (dist(ship.x, ship.y, threat.x, threat.y) <= COMBAT.torpedo.wakeVisibleRange) {
          threat.revealed = true;
          t.stats.torpedoesDetected++;
          pushEvent(t, { type: 'torpedoDetected', lowSig: false, detail: 'wake' });
          announceTorpedo(t, threat);
          break;
        }
      }
    }

    // Terminal: the first hull it brushes takes the hit. The cause names the
    // node that fired so the AAR can explain what the player actually faced.
    const cause = threat.lowSig ? 'lowSigTorpedo' : threat.homing ? 'homingTorpedo' : 'torpedo';
    let struck: Ship | null = null;
    for (const ship of activeShips(t)) {
      if (dist(threat.x, threat.y, ship.x, ship.y) <= COMBAT.torpedo.hitRadius) {
        struck = ship;
        break;
      }
    }
    if (struck) {
      threat.alive = false;
      t.stats.torpedoesHit++;
      announceTorpedo(t, threat);
      damageShip(t, struck, COMBAT.torpedo.damage, cause, rng, false, threat);
      continue;
    }
    let struckEscort: Escort | null = null;
    for (const esc of t.escorts) {
      if (!esc.alive) continue;
      if (dist(threat.x, threat.y, esc.x, esc.y) <= COMBAT.torpedo.hitRadius + COMBAT.escort.hitRadius) {
        struckEscort = esc;
        break;
      }
    }
    if (struckEscort) {
      threat.alive = false;
      t.stats.torpedoesHit++;
      announceTorpedo(t, threat);
      damageEscort(t, struckEscort, COMBAT.torpedo.damage, cause);
      continue;
    }

    if (
      threat.x < -100 || threat.x > WORLD.width + 100 ||
      threat.y < -100 || threat.y > WORLD.height + 100
    ) {
      threat.alive = false;
    }
  }

  updateAttackBoats(t, rng, dt);
  updateBoatShots(t, rng, dt);
  updateArtillery(t, rng, dt);
  updateShells(t, rng, dt);
  updateEnemySmoke(t);
  updateElectronic(t, rng, dt);
  updateConcealment(t, dt);

  // --- Cargo-module systems ---------------------------------------------------
  updateSelfDefense(t, dt);
  updateFlak(t, dt);
  updateTorpedoDetection(t);

  // --- Interceptors (player launches + self-defense/flak tracers) -------------
  for (const interceptor of t.interceptors) {
    const threat = t.threats.find((th) => th.id === interceptor.targetThreatId);
    if (!threat || !threat.alive) {
      interceptor.speed = 0; // marks it for removal below
      continue;
    }
    const d = dist(interceptor.x, interceptor.y, threat.x, threat.y);
    if (d <= 18) {
      const isPd = interceptor.launcher === 'pd';
      const isFlak = interceptor.launcher === 'flak';
      let hitChance: number;
      if (interceptor.hitChance !== undefined) {
        hitChance = interceptor.hitChance; // self-defense/flak carry their own roll
      } else {
        hitChance =
          (interceptor.launcher === 'base' ? t.effects.base.accuracy : t.effects.escort.accuracy) +
          // A concentrated column's overlapping fire is more accurate.
          FORMATIONS[t.formation].interceptAccuracy;
        // Missile-warning assistance: full when defending the equipped ship,
        // half via the networked node when defending anyone nearby.
        if (sensorAvailable(t, 'missileWarning')) {
          const targetShip = t.ships.find((s) => s.id === threat.targetShipId);
          if (targetShip?.modules.includes('missileWarning')) {
            hitChance += t.effects.missileWarning.assist;
          } else if (t.effects.missileWarning.networked) {
            const near = t.ships.some(
              (s) =>
                isActive(s) &&
                s.modules.includes('missileWarning') &&
                dist(s.x, s.y, threat.x, threat.y) <= t.effects.missileWarning.range,
            );
            if (near) hitChance += t.effects.missileWarning.assist / 2;
          }
        }
        // Blinding smoke degrades the missile-warning cues inside it, so the
        // assisted targeting the player paid for stops helping in the cloud.
        const cloud = enemySmokeAt(t, threat.x, threat.y);
        if (cloud?.blinding) hitChance -= t.effects.missileWarning.assist * COMBAT.enemySmoke.warningDegradation;
        // A recon plane overhead drags every launcher's accuracy down for as
        // long as it is alive — which is exactly why it is worth shooting.
        if (reconOverhead(t)) hitChance -= COMBAT.electronic.reconAccuracyPenalty;
        // The guided node's evasion penalty (an enemy property, not a stat).
        if (threat.kind === 'guidedMissile') hitChance -= COMBAT.guided.accuracyPenalty;
        hitChance = Math.max(0.05, Math.min(0.95, hitChance));
      }
      if (rng.chance(hitChance)) {
        threat.alive = false;
        // Every interceptor kill is a player-destroyed physical threat —
        // missiles and aircraft alike may leave recoverable wreckage.
        maybeSpawnWreckage(t, threat, rng);
        if (isFlak) {
          t.stats.counter.flakKills++;
          if (threat.kind === 'reconPlane' || threat.kind === 'disablingDrone') {
            t.stats.aircraftDowned++;
          }
          pushEvent(t, { type: 'flakKill', threatKind: threat.kind });
        } else {
          t.stats.missilesIntercepted++;
          if (isPd) {
            t.stats.pdKills++;
            t.stats.counter.selfDefenseKills++;
            pushEvent(t, { type: 'pdKill', threatKind: threat.kind });
          } else {
            t.stats.playerIntercepts++;
            if (interceptor.ownerUnitId !== undefined) {
              const shooter = t.stats.escortPerformance[interceptor.ownerUnitId];
              if (shooter) shooter.intercepts++;
            }
            if (interceptor.auto) t.stats.counter.autoIntercepts++;
            else t.stats.counter.manualIntercepts++;
            if (interceptor.launcher === 'base') t.stats.baseIntercepts++;
            else t.stats.escortIntercepts++;
            pushEvent(t, { type: 'intercepted', threatKind: threat.kind });
          }
        }
      } else if (!isPd && !isFlak) {
        // Only player launches report a miss; tracers fire constantly.
        t.stats.interceptMisses++;
        pushEvent(t, { type: 'interceptMiss', threatKind: threat.kind });
      }
      interceptor.speed = 0;
      continue;
    }
    const step = interceptor.speed * dt;
    interceptor.x += ((threat.x - interceptor.x) / d) * step;
    interceptor.y += ((threat.y - interceptor.y) / d) * step;
  }
  t.interceptors = t.interceptors.filter((i) => i.speed > 0);

  // --- Mines: passive detection & proximity triggers ---------------------------
  const mineDetectionUp = sensorAvailable(t, 'mineDetection');
  for (const mine of t.threats) {
    if (mine.kind !== 'mine' || !mine.alive) continue;

    if (!mine.revealed && mineDetectionUp) {
      for (const ship of activeShips(t)) {
        const hasSonar = ship.modules.includes('mineSonar');
        const radius = hasSonar
          ? t.effects.mineSonar.radius
          : t.effects.mineSonar.fleetDetectRadius;
        if (radius <= 0) continue;
        if (mine.lowSig && !t.effects.mineSonar.detectLowSig) continue;
        if (dist(ship.x, ship.y, mine.x, mine.y) <= radius) {
          revealMine(t, mine, 'mineSonar');
          break;
        }
      }
    }

    if (!mine.alive) continue;
    for (const ship of activeShips(t)) {
      const triggerRadius = COMBAT.mine.triggerRadius + SHIP_CLASSES[ship.classId].radius;
      if (dist(ship.x, ship.y, mine.x, mine.y) <= triggerRadius) {
        mine.alive = false;
        t.stats.minesDetonated++;
        announceDebut(t, 'mine');
        if (mine.lowSig) announceDebut(t, 'lowSigMine');
        pushEvent(t, { type: 'mineDetonated', lowSig: mine.lowSig });
        // Forensics must be honest: a charted mine the helm failed to clear is
        // a maneuvering failure, not a detection failure.
        const cause = mine.revealed ? 'chartedMine' : mine.lowSig ? 'lowSigMine' : 'mine';
        damageShip(t, ship, COMBAT.mine.damage, cause, rng, false);
        break;
      }
    }

    // Escorts steam into mines too — no limitations.
    if (!mine.alive) continue;
    for (const escort of t.escorts) {
      if (!escort.alive) continue;
      const triggerRadius = COMBAT.mine.triggerRadius + COMBAT.escort.hitRadius;
      if (dist(escort.x, escort.y, mine.x, mine.y) <= triggerRadius) {
        mine.alive = false;
        t.stats.minesDetonated++;
        announceDebut(t, 'mine');
        if (mine.lowSig) announceDebut(t, 'lowSigMine');
        pushEvent(t, { type: 'mineDetonated', lowSig: mine.lowSig });
        damageEscort(t, escort, COMBAT.mine.damage, 'mine');
        break;
      }
    }
  }

  // --- Minesweeper drones ------------------------------------------------------
  // Drones are launched by the sweepMine command or automatic clearance: here we
  // only fly the in-flight ones out to their target mine and detonate it.
  for (const drone of t.drones) {
    const mine = t.threats.find((m) => m.id === drone.targetMineId);
    if (!mine || !mine.alive) {
      drone.speed = 0; // target already gone
      continue;
    }
    const d = dist(drone.x, drone.y, mine.x, mine.y);
    if (d <= COMBAT.sweepDrone.sweepRadius) {
      mine.alive = false;
      t.stats.minesSwept++;
      t.stats.counter.droneKills++;
      const launcher = t.stats.escortPerformance[drone.ownerUnitId];
      if (launcher) launcher.minesSwept++;
      pushEvent(t, { type: 'mineSwept', lowSig: mine.lowSig });
      // A swept mine is disarmed, not detonated — prime salvage.
      maybeSpawnWreckage(t, mine, rng);
      drone.speed = 0;
      continue;
    }
    const step = drone.speed * dt;
    drone.x += ((mine.x - drone.x) / d) * step;
    drone.y += ((mine.y - drone.y) / d) * step;
  }
  t.drones = t.drones.filter((dr) => dr.speed > 0);

  // --- Depth charges, placed areas, support aircraft --------------------------
  updateDepthChargeShots(t, rng, dt);
  updateAreaEffects(t);
  updateAircraft(t, rng, dt);

  // --- Wreckage recovery & crew rescue ----------------------------------------
  updateRecoveryFields(t, dt);

  // --- Housekeeping --------------------------------------------------------------
  if (t.jammingSeconds > 0) {
    t.stats.counter.jammingSeconds += Math.min(dt, t.jammingSeconds);
    t.jammingSeconds = Math.max(0, t.jammingSeconds - dt);
  }
  t.time += dt;
  const unresolved = t.ships.some((s) => s.alive && !s.delivered);
  if (!unresolved || t.time >= SIM.maxTransitTime) {
    // Any ship still afloat when time expires counts as lost at sea.
    for (const ship of t.ships) {
      if (ship.alive && !ship.delivered) killShip(t, ship, 'timeout');
    }
    // The convoy has cleared the strait: whatever is still in the water is
    // not coming home. Unfinished wreckage is abandoned; crews still waiting
    // are lost — and will cost confidence when the round resolves.
    for (const field of t.wreckage) {
      if (field.recovered || field.expired) continue;
      field.expired = true;
      t.stats.wreckageExpired++;
      pushEvent(t, { type: 'wreckageExpired', threatKind: field.threatKind });
    }
    for (const area of t.survivors) {
      if (area.rescued || area.lost) continue;
      area.lost = true;
      t.stats.survivorsLost++;
      pushEvent(t, { type: 'survivorsLost', shipName: area.shipName });
    }
    t.over = true;
  }
}
