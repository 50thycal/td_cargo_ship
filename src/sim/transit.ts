// Real-time transit simulation. Pure data-in / data-out: the UI feeds player
// commands into stepTransit and renders whatever is in TransitState. No DOM,
// no timers, no Math.random — the caller owns the RNG and the fixed timestep.
//
// Player-counter rules (which weapon may engage which threat, what each tier
// means numerically) come from the data layer (counters.ts / statTiers.ts).
// The sim VALIDATES target compatibility centrally in handleCommand and the
// automation loops — an invalid engagement is rejected here, not just greyed
// out in the UI.

import { COMBAT, ENEMY_ECONOMY, NAV, SIM, SURVIVORS, WORLD, WRECKAGE } from '../data/tuning';
import { FORMATIONS, SHIP_CLASSES, SHIP_NAMES } from '../data/defs';
import { canEngage, deriveCounterEffects, LOSS_CAUSE_TO_ENEMY_BRANCH } from '../data/counters';
import { applyCommanderCombatEffects } from '../data/commanderAbilities';
import { activeLegacyIds, applyEscortLegacyEffects } from '../data/escortLegacies';
import { geographyOf } from '../data/regions';
import { targetingSkill } from './evolution';
import { scheduleSpawns, transitTimeLimit } from './convoySchedule';
import { survivorsUnderEscort, wreckageUnderEscort } from './escortOrders';
import type { RNG } from './rng';
import type {
  Aircraft,
  AreaEffect,
  ArtilleryVariant,
  Base,
  BaseModuleId,
  BoatVariant,
  CampaignState,
  CombatEffects,
  CounterRoundStats,
  EnemyInstallation,
  Escort,
  GunShot,
  EscortModuleId,
  EscortPerformance,
  LauncherKind,
  ResearchId,
  RoundPlan,
  SensorFamily,
  Ship,
  ShipClassId,
  SmokeShell,
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
 *  numeric conversion happens in the data layer (deriveCounterEffects), and the
 *  permanent-progression modifiers — Commander Abilities and Escort Legacies —
 *  are applied LAST, centrally, on the locked effect flow:
 *  base → technology/tactics → equipment → commander & legacies → final.
 *
 *  `escortLegacies` takes the ACTIVE legacies only, meaning the ones whose
 *  carrier is still afloat. Nothing downstream needs to know a legacy can be
 *  lost mid-region: the effects are simply re-derived without it. */
export function deriveEffects(
  completedResearch: readonly ResearchId[],
  loadout: { escortModules: readonly EscortModuleId[]; baseModules: readonly BaseModuleId[] },
  commanderAbilities: readonly string[] = [],
  escortLegacies: readonly string[] = [],
): CombatEffects {
  const effects = deriveCounterEffects(completedResearch, {
    escortModules: [...loadout.escortModules],
    baseModules: [...loadout.baseModules],
  });
  applyCommanderCombatEffects(effects, commanderAbilities);
  return applyEscortLegacyEffects(effects, escortLegacies);
}

// ---------------------------------------------------------------------------
// Spawn scheduling & spacing
// ---------------------------------------------------------------------------
// The schedule itself lives in convoySchedule.ts, shared with the enemy
// planner so the fire window always matches the convoy it is shooting at.
// Re-exported here because the UI and tests have always reached for them
// through the sim entry point.
export { convoySpawnSpan, scheduleSpawns, transitTimeLimit } from './convoySchedule';

/** Reference lateral position for escort patrol and ability-effect centers:
 *  the corridor's center lane, where the convoy currently is. */
export function patrolLaneY(t: TransitState): number {
  return t.geo.laneY(Math.floor(t.geo.laneCount / 2), t.anchorX);
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
  warthog: number;
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
    gunRuns: 0,
    gunRunKills: 0,
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
      warthog: { available: t.warthog, used: 0 },
      scan: { available: t.scan, used: 0 },
      sonar: { available: t.sonar, used: 0 },
      smoke: { available: t.smoke, used: 0 },
      reboot: { available: t.reboot, used: 0 },
    },
  };
}

export function createTransit(campaign: CampaignState, plan: RoundPlan, rng: RNG): TransitState {
  // The water this round is fought in. Resolved ONCE, here, and carried on the
  // state — every position below is a position on THIS map.
  const geo = geographyOf(campaign.regionId);
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
    activeLegacyIds(campaign.escortUnits),
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
        y: geo.laneY(1, WORLD.spawnX),
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
        giveWayHold: 0,
        giveWayExhausted: false,
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
  scheduleSpawns(ships, rng, campaign.formation, geo.laneCount);

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

  const centerLaneY = geo.laneY(1, WORLD.spawnX);
  // Sorties and pulses are STOCK the player bought, not an allowance research
  // refills each round — what research grants is how many can be held (the
  // capacity), which is enforced at the point of purchase.
  const warthogCharges = god ? 99 : campaign.warthogUnlocked ? campaign.warthogStock : 0;
  const scanCharges = god ? 99 : campaign.scanUnlocked ? campaign.scanStock : 0;
  const sonarCharges = god ? 99 : campaign.sonarUnlocked ? effects.abilities.sonar.charges : 0;
  const smokeCharges = god ? 99 : campaign.smokeUnlocked ? campaign.smokeStock : 0;
  const rebootCharges = god ? 99 : campaign.hardenedUnlocked ? effects.hardened.rebootCharges : 0;

  const state: TransitState = {
    time: 0,
    over: false,
    geo,
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
      barrageY: geo.laneY(0, p.x),
      barrageNextAt: 8,
    })),
    shells: [],
    smokeShells: [],
    smokeBarrage: [],
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
    strafeRuns: [],
    gunShots: [],
    // Sized to the convoy that is actually sailing, so a hull is only ever
    // written off for failing to get across — never for entering last.
    timeLimit: transitTimeLimit(ships.length, campaign.formation, geo.laneCount),
    areaEffects: [],
    escortModules: fleetEscortModules,
    baseModules: [...campaign.baseModules],
    autoFire: { ...campaign.autoFire },
    protectedChannels: campaign.protectedChannels.slice(0, effects.hardened.protectedChannelCount),
    ammo: god ? 9999 : campaign.ammo,
    droneAmmo: god ? 9999 : campaign.droneAmmo,
    pdAmmo: god ? 9999 : campaign.pdAmmo,
    gunAmmo: god ? 9999 : campaign.gunAmmo,
    gunAmmoWarned: false,
    warthogCharges,
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
      warthogKills: 0,
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
      warthogUsed: 0,
      scanUsed: 0,
      escortsLost: 0,
      escortPerformance: {},
      basesLost: 0,
      launchersDisabled: 0,
      counter: newCounterStats({
        warthog: warthogCharges,
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
      waypoints: [],
      stationed: false,
      blockedSeconds: 0,
      steerX: 1,
      steerY: 0,
      passShipId: null,
      passSide: 0,
      passClearSeconds: 0,
      autoCooldown: 0,
      mcmAutoCooldown: 0,
      droneCooldown: 0,
      droneReady: god && droneSorties > 0 ? 99 : droneSorties,
      dcCooldown: 0,
      dcShots: god && dcMagazine > 0 ? 99 : dcMagazine,
      dcAutoCooldown: 0,
      gunCooldown: 0,
      gunTargetId: null,
      pursueBoatId: null,
      lastSpeed: 0,
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
      y: geo.baseY(360 + frac * (WORLD.width - 720)),
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

/** THE NAVIGABLE WATER, as one definition everything afloat shares.
 *
 *  The coastlines meander by the geography's shoreWave, so "north of the
 *  friendly shore line" is not the same as "in the sea" — a hull sitting
 *  exactly on the mean line is aground wherever the coast bulges. The
 *  geography's band clears the wave, so anything held inside it is in open
 *  water at every point along the strait.
 *
 *  Everything here takes an X now, because on a map whose coast bends there is
 *  no single answer to "where is the water". */
function overWater(t: TransitState, x: number, y: number): boolean {
  return y >= t.geo.waterTop(x) && y <= t.geo.waterBottom(x);
}

/** Hold a hull in the water. Ships and escorts steer from forces that know
 *  nothing about the coast, so without this an avoidance shove or an ordered
 *  move could beach them — and a ship on the sand is both nonsense to look at
 *  and unreachable by anything that has to sail to it.
 *
 *  Still a CLAMP, deliberately: on a curved coast a hull is kept off the beach
 *  by its lane curve, which already goes where the water goes, and this stays
 *  what it has always been — the backstop for when steering has been overruled
 *  by an avoidance shove. Bending a coast sharply enough that the clamp is
 *  doing the routing would show up as hulls sliding sideways along the shore;
 *  that is the signal the lane curve is wrong, not that this needs to become a
 *  pathfinder. */
function keepAfloat(t: TransitState, entity: { x: number; y: number }): void {
  entity.y = clamp(entity.y, t.geo.waterTop(entity.x), t.geo.waterBottom(entity.x));
}

/** March from (x, y) along the unit vector (dx, dy) until the point leaves the
 *  world, then keep going by `margin`. The point an aircraft on this bearing
 *  would be at if it had entered from off the map — which is where aircraft
 *  come from, whatever part of the strait the player was pointing at. */
function offMapPoint(
  x: number,
  y: number,
  dx: number,
  dy: number,
  margin: number,
): { x: number; y: number } {
  let t = Infinity;
  if (dx > 1e-6) t = Math.min(t, (WORLD.width - x) / dx);
  else if (dx < -1e-6) t = Math.min(t, -x / dx);
  if (dy > 1e-6) t = Math.min(t, (WORLD.height - y) / dy);
  else if (dy < -1e-6) t = Math.min(t, -y / dy);
  if (!Number.isFinite(t)) t = 0; // no direction at all: stand off where we are
  return { x: x + dx * (t + margin), y: y + dy * (t + margin) };
}

/** Is this aircraft over land? Measured against the same water band the run-in
 *  line itself is validated against, so "run it over open water" and "turn
 *  once you are past the water" agree about where the water is. */
function aircraftOverLand(t: TransitState, x: number, y: number): boolean {
  return y < t.geo.airWaterTop(x) || y > t.geo.airWaterBottom(x);
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
/** The escort a boat would go for when the merchants are out of reach: the
 *  nearest living one. Boats only ever reach this once nothing in the convoy is
 *  worth committing to, so there is no need to rank the screen by value. */
function nearestEngageableEscort(t: TransitState, boat: Threat): Escort | null {
  let best: Escort | null = null;
  let bestD = Infinity;
  for (const e of t.escorts) {
    if (!e.alive) continue;
    const d = dist(boat.x, boat.y, e.x, e.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

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
  // Nothing washes up on the beach. A kill over land — a missile taken down
  // above the hostile shore, a gun run on the coast — used to leave a salvage
  // field sitting inland that no escort could ever reach, so the reward for a
  // good intercept was a marker taunting the player from dry ground.
  if (!overWater(t, threat.x, threat.y)) return;
  // Clamped into open water so a kill near a shore still leaves a field an
  // escort can actually sail to. The x is settled first: on a bending coast
  // the water's edge depends on where along the map you are asking.
  const fieldX = clamp(threat.x, 80, WORLD.width - 80);
  t.wreckage.push({
    id: t.nextEntityId++,
    x: fieldX,
    y: clamp(threat.y, t.geo.waterTop(fieldX), t.geo.waterBottom(fieldX)),
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
  // Same rule as a wreckage field: settle the x, then hold the crew inside the
  // water at THAT x. A hull is always afloat when she goes down, so this never
  // moves anybody today — it is what keeps a crew off the beach once a coast
  // can bend out to meet them.
  const crewX = clamp(ship.x, 80, WORLD.width - 80);
  t.survivors.push({
    id: t.nextEntityId++,
    x: crewX,
    y: clamp(ship.y, t.geo.waterTop(crewX), t.geo.waterBottom(crewX)),
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

/** Top speed an escort answers an order with this transit: the navigation
 *  constant with the Veteran Helm legacy folded in. Read through this rather
 *  than off NAV directly, so the enemy's lead calculation and the cargo
 *  steering's velocity estimate agree with how the escort actually moves. */
function escortSpeedOf(t: TransitState): number {
  return NAV.escortSpeed * t.effects.escortSpeedMult;
}

function damageEscort(t: TransitState, escort: Escort, amount: number, cause: string): void {
  if (!escort.alive) return;
  // Escort legacies ride on top of the fleet-wide damage multiplier: a general
  // reduction for every hit, and a second one that only answers mines.
  const mineMult = cause === 'mine' || cause.startsWith('mine:') ? t.effects.escortMineDamageMult : 1;
  const dealt = amount * t.effects.damageTakenMult * t.effects.escortDamageMult * mineMult;
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
      // Deck guns: sustained fire on a persistent HP target. Selecting a boat
      // is an ORDER, not a range check — an out-of-reach boat sends the
      // nearest gun escort steaming to it, and the escort then shadows the
      // boat inside gun range until it sinks or the player re-tasks the ship.
      // "No deck gun in range" used to be the answer here, which turned the
      // one counter this branch has into a button that mostly said no.
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
      const commit = (escort: Escort) => {
        escort.pursueBoatId = boat.id;
        // Pursuit IS the escort's order now: it replaces any standing
        // destination the same way a fresh move order would.
        escort.moveTarget = null;
        escort.stationed = false;
        if (dist(escort.x, escort.y, boat.x, boat.y) <= t.effects.deckGun.range) {
          escort.gunTargetId = boat.id;
        }
      };
      if (cmd.focus && t.effects.deckGun.focusFire) {
        // Focus fire: every gun escort converges on this boat.
        for (const escort of t.escorts) {
          if (escort.alive && escort.modules.includes('deckGun')) commit(escort);
        }
        pushEvent(t, { type: 'escortTasked', detail: 'All guns on the designated boat' });
        return;
      }
      // Nearest gun escort — preferring one that is NOT mid-recovery or
      // mid-rescue. A pursuit replaces the escort's standing order, and
      // yanking the hull that is holding a survivor area (because it happened
      // to be nearest) abandons work the player explicitly ordered. An idle
      // escort slightly further away is the ship a real officer would send;
      // only when every gun is busy does the nearest busy one get pulled.
      let best: Escort | null = null;
      let bestD = Infinity;
      let bestBusy = true;
      for (const escort of t.escorts) {
        if (!escort.alive || !escort.modules.includes('deckGun')) continue;
        const busy =
          wreckageUnderEscort(t, escort) !== undefined ||
          survivorsUnderEscort(t, escort) !== undefined;
        const d = dist(escort.x, escort.y, boat.x, boat.y);
        if ((bestBusy && !busy) || (busy === bestBusy && d < bestD)) {
          bestD = d;
          best = escort;
          bestBusy = busy;
        }
      }
      if (!best) return;
      commit(best);
      if (bestD > t.effects.deckGun.range) {
        pushEvent(t, { type: 'escortTasked', detail: `${best.name} closing to engage` });
      }
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
      if (cmd.ability === 'warthog') {
        // Sorties STACK. Charges are the only limit: a player holding four can
        // put four jets over the strait at once, on four different bearings.
        //
        // This used to block a second call until the flight on task was clear,
        // which made the charge count a lie — you could hold four and fly one.
        // A two-pass sortie is most of a minute, so "buy more sorties" bought
        // nothing a player could use inside the round they bought it for.
        if (t.warthogCharges <= 0) return;
        // The run-in line, A to B. A tap with no second point is not a run —
        // the caller is required to supply both ends.
        const bx = clamp(cmd.x2 ?? px, 20, WORLD.width - 20);
        const by = clamp(cmd.y2 ?? py, 60, WORLD.height - 60);
        // Both ends must lie over open water — not on a shore launcher (enemy
        // sites up-map, friendly batteries down-map). Reject a run outside the
        // water band so a sortie is never wasted on land.
        const wet = (x: number, y: number): boolean =>
          y >= t.geo.airWaterTop(x) && y <= t.geo.airWaterBottom(x);
        if (!wet(px, py) || !wet(bx, by)) {
          pushEvent(t, { type: 'launchFailed', detail: 'Run the Warthog over open water' });
          return;
        }
        // A line has to have a direction to be a gun run: two points on top of
        // one another give the cone nothing to point along.
        if (Math.hypot(bx - px, by - py) < COMBAT.warthog.minRunLength) {
          pushEvent(t, { type: 'launchFailed', detail: 'Draw a longer run-in line' });
          return;
        }
        t.warthogCharges--;
        t.stats.warthogUsed++;
        t.stats.counter.charges.warthog.used++;
        const runLen = Math.hypot(bx - px, by - py);
        // The jet flies IN from off the map, already established on the
        // bearing — so the run-in is something the player watches arrive
        // rather than an aeroplane that appears where they pointed. The entry
        // point is the bearing projected BACKWARDS to the world boundary and
        // then a margin further out, which is why a short line drawn in the
        // middle of the strait still produces a full-length attack run.
        const ux = (bx - px) / runLen;
        const uy = (by - py) / runLen;
        const entry = offMapPoint(px, py, -ux, -uy, COMBAT.warthog.offMapMargin);
        t.aircraft.push({
          id: t.nextEntityId++,
          role: 'warthog',
          x: entry.x,
          y: entry.y,
          heading: Math.atan2(uy, ux),
          phase: 'onStation',
          laneY: py,
          runAx: px,
          runAy: py,
          runBx: bx,
          runBy: by,
          pass: 0,
          firedThisPass: false,
          stationUntil: 0,
          gunCooldown: 0,
          wetSeen: false,
          landSeconds: 0,
        });
        pushEvent(t, { type: 'abilityUsed', detail: 'warthog' });
      } else if (cmd.ability === 'scan') {
        if (t.scanCharges <= 0) return;
        t.scanCharges--;
        t.stats.scanUsed++;
        t.stats.counter.charges.scan.used++;
        // The tap's Y selects a lane; a scan plane flies the length of that lane
        // charting only the mines within it. Sweeping is done by drones.
        //
        // The LANE is what is selected, not a y: on a map whose lanes curve the
        // plane has to follow the lane it was sent down, so it carries the
        // index and reads its height off the geography as it goes.
        const laneIndex = t.geo.nearestLane(px, py);
        const laneY = t.geo.laneY(laneIndex, -60);
        t.aircraft.push({
          id: t.nextEntityId++,
          role: 'scan',
          x: -60,
          y: laneY,
          heading: 0,
          phase: 'onStation',
          laneIndex,
          laneY,
          // A scan plane flies a lane, not a drawn run — the run-line fields
          // describe that lane so the shape stays one aircraft type.
          runAx: -60,
          runAy: laneY,
          runBx: WORLD.width + 60,
          runBy: t.geo.laneY(laneIndex, WORLD.width + 60),
          pass: 0,
          firedThisPass: false,
          stationUntil: 0,
          gunCooldown: 0,
          // Unused by the scan plane: it flies one lane, straight through,
          // and never turns.
          wetSeen: true,
          landSeconds: 0,
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
        // Defensive smoke: a barrage walked up ONE LANE from the friendly
        // shore, degrading the enemy's targeting for every hull it covers. It
        // destroys nothing and blocks nothing outright.
        //
        // The tap picks a lane, exactly as it does for the scan plane — the
        // convoy is a column strung along a lane, so screening it is a lane
        // decision, not a point one.
        if (t.smokeCharges <= 0) return;
        t.smokeCharges--;
        t.stats.counter.charges.smoke.used++;
        const laneIndex = t.geo.nearestLane(px, py);
        const bar = COMBAT.smokeBarrage;
        const radius = t.effects.abilities.smoke.radius;
        const duration = t.effects.abilities.smoke.duration;
        // Cover the middle of the sailed length; leave both ends open.
        const sailed = WORLD.deliverX - WORLD.spawnX;
        const covered = sailed * bar.laneCoverage;
        const from = WORLD.spawnX + (sailed - covered) / 2;
        const pockets = Math.max(
          2,
          Math.min(bar.maxPockets, Math.round(covered / (radius * bar.pocketSpacingRadii)) + 1),
        );
        for (let i = 0; i < pockets; i++) {
          const f = i / (pockets - 1);
          const px2 = from + covered * f;
          t.smokeBarrage.push({
            // Always west to east, whichever end the player happened to tap:
            // the barrage walks the way the convoy sails — and it follows the
            // lane, so a screen laid down a bending channel stays over it.
            x: px2,
            y: t.geo.laneY(laneIndex, px2),
            at: t.time + bar.walkSeconds * f,
            radius,
            duration,
          });
        }
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
      // stations on arrival depends on `hold`. It also releases any boat
      // pursuit — re-tasking is the one way a pursuit ends early.
      escort.pursueBoatId = null;
      escort.stationed = false;
      // A single destination replaces any route still being steamed. An order
      // is an order: the player pointing somewhere means GO THERE, not "go
      // there after you have finished the last thing I drew".
      escort.waypoints = [];
      escort.moveTarget = {
        x: clamp(cmd.x, 20, WORLD.width - 20),
        y: clamp(cmd.y, 60, WORLD.height - 60),
        hold: cmd.hold,
      };
      pushEvent(t, { type: 'abilityUsed', detail: cmd.hold ? 'stationEscort' : 'moveEscort' });
      return;
    }
    case 'pathEscort': {
      const escort = t.escorts.find((e) => e.id === cmd.escortId && e.alive);
      if (!escort) return;
      const points = cmd.points
        .map((pt) => ({
          x: clamp(pt.x, 20, WORLD.width - 20),
          y: clamp(pt.y, 60, WORLD.height - 60),
        }))
        // Points closer together than the arrival test cannot be steamed to —
        // the escort would count itself arrived at several at once and the
        // route would collapse. Thinning here keeps the drawn curve and drops
        // only the redundancy a finger produces.
        .filter((pt, i, all) => i === 0 || Math.hypot(pt.x - all[i - 1].x, pt.y - all[i - 1].y) > NAV.escortArrive);
      if (points.length === 0) return;
      escort.pursueBoatId = null;
      escort.stationed = false;
      const [first, ...rest] = points;
      // `hold` rides on EVERY leg and is only acted on at the end of the route
      // (see the arrival block). Storing it solely on the final leg looked
      // tidier and lost it: each pop derived the next leg's hold from the
      // current one, which is false for every leg but the last, so the flag
      // was false by the time the route finished and the ship sailed on.
      escort.moveTarget = { x: first.x, y: first.y, hold: cmd.hold };
      escort.waypoints = rest;
      pushEvent(t, { type: 'abilityUsed', detail: 'pathEscort' });
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

/** Record a mine contact. Reveal STATE is recomputed every tick in updateMines;
 *  this is the moment of acquisition — the stat, the event and the debut all
 *  fire on the first fix and never again, so "mines detected" counts mines the
 *  fleet found rather than times a contact was re-acquired. */
function revealMine(t: TransitState, mine: Threat, source: 'mineSonar' | 'scanPulse'): void {
  if (mine.everRevealed) return;
  mine.everRevealed = true;
  t.stats.minesRevealed++;
  t.stats.counter.detections[source]++;
  pushEvent(t, { type: 'mineRevealed', lowSig: mine.lowSig });
  announceDebut(t, 'mine');
  if (mine.lowSig) announceDebut(t, 'lowSigMine');
}

/** Pick what the Warthog shoots on this pass. Boarding parties already on a
 *  hull come first for the same reason the deck gun prioritises them — a
 *  capture cannot be undone, everything else can be survived. After that it is
 *  simply the nearest thing in the strafe radius, because a jet holding a wheel
 *  over one patch of water works that patch, it does not go hunting. */
/** What the gun can reach: a cone off the nose, not a circle round a station.
 *  A target must be AHEAD of the jet (positive along-track) and inside both the
 *  cone's half-angle and its range. */
function pickStrafeTarget(t: TransitState, ac: Aircraft, halfAngle: number): Threat | null {
  const fx = Math.cos(ac.heading);
  const fy = Math.sin(ac.heading);
  let best: Threat | null = null;
  let bestKey = Infinity;
  for (const th of t.threats) {
    if (!th.alive || !canEngage('gunRun', th.kind)) continue;
    // A pilot shoots what the plot is holding. An uncharted mine is a floating
    // object nobody has identified — letting the gun find it made the A-10 a
    // free area sweep that quietly did the sonar's and the scan plane's job for
    // them, and made charting the water pointless. Boats are visible on their
    // own; only mines have to be FOUND.
    if (th.kind === 'mine' && !th.revealed) continue;
    const dx = th.x - ac.x;
    const dy = th.y - ac.y;
    const along = dx * fx + dy * fy;
    if (along <= 0) continue; // behind the wing line: the gun does not point there
    const d = Math.hypot(dx, dy);
    if (d > COMBAT.warthog.coneRange) continue;
    // Angle off the nose. Compared against the cone rather than a lateral band
    // so the reach widens with distance, which is how a fixed gun actually
    // covers ground and makes a long straight run-in worth drawing.
    if (Math.acos(Math.min(1, along / (d || 1))) > halfAngle) continue;
    const boarding = th.boatVariant === 'boarding' && th.engaging ? 0 : 1;
    const key = boarding * 10000 + d;
    if (key < bestKey) {
      bestKey = key;
      best = th;
    }
  }
  return best;
}

/** One 30mm pass. Mines are destroyed outright — a moored charge does not
 *  survive being hit — and boats take hull damage over successive passes. */
function fireGunRun(t: TransitState, ac: Aircraft, target: Threat, rng: RNG): void {
  let killed = false;
  if (target.kind === 'mine') {
    target.alive = false;
    // Destroyed in place before it could touch anything: that is a sweep, the
    // same outcome a drone produces, and it leaves the same salvage.
    t.stats.minesSwept++;
    t.stats.warthogKills++;
    announceDebut(t, 'mine');
    if (target.lowSig) announceDebut(t, 'lowSigMine');
    pushEvent(t, { type: 'mineSwept', lowSig: target.lowSig });
    maybeSpawnWreckage(t, target, rng);
    killed = true;
  } else {
    target.hp = (target.hp ?? 1) - t.effects.warthogDamage;
    if (target.hp <= 0) {
      target.alive = false;
      target.engagedByEscortId = undefined;
      t.stats.boatsSunk++;
      t.stats.warthogKills++;
      pushEvent(t, { type: 'boatSunk', threatKind: target.kind });
      maybeSpawnWreckage(t, target, rng);
      // Sinking a boarding boat throws its party off the hull, exactly as a
      // deck-gun kill does — the progress it had made is lost.
      const boarded = t.ships.find((s) => s.id === target.targetShipId);
      if (boarded) releaseBoarding(t, boarded);
      killed = true;
    }
  }
  t.stats.counter.gunRuns++;
  if (killed) t.stats.counter.gunRunKills++;
  t.strafeRuns.push({
    id: t.nextEntityId++,
    x: ac.x,
    y: ac.y,
    targetX: target.x,
    targetY: target.y,
    killed,
    ttl: COMBAT.warthog.burstSeconds,
  });
}

/** Advance support aircraft: scan planes sweep their lane charting mines in it;
 *  the Warthog flies to a water station, holds a wheel over it making gun runs
 *  on surface targets inside its strafe radius, then breaks off and leaves.
 *  Missiles never touch planes; planes can't be shot down. */
function updateAircraft(t: TransitState, rng: RNG, dt: number): void {
  const scanRadius = t.effects.abilities.scan.radius;
  const laneHalf = COMBAT.scan.laneHalfWidth * (scanRadius / COMBAT.scan.baseRevealRadius);
  // Gun cone half-angle. The Wide Strafe node opens it rather than growing a
  // loiter radius, which no longer exists.
  const strafeHalfAngle =
    COMBAT.warthog.coneHalfAngle *
    (t.effects.abilities.warthog.wide ? COMBAT.warthog.wideConeMult : 1);
  for (const ac of t.aircraft) {
    if (ac.role === 'scan') {
      // Fly the length of the selected lane — FOLLOWING it, not flying the
      // straight line its height happened to be at launch. On a bending lane a
      // plane holding one y would chart the water beside the channel and report
      // it clear, which is worse than not flying at all.
      ac.x += COMBAT.scan.planeSpeed * dt;
      const prevY = ac.y;
      ac.laneY = t.geo.laneY(ac.laneIndex ?? 0, ac.x);
      ac.y = ac.laneY;
      ac.heading = Math.atan2(ac.y - prevY, COMBAT.scan.planeSpeed * dt);
      // Chart mines within THIS lane band as the plane passes over. The fix is
      // good for a limited time — see COMBAT.mineContact.scanHoldSeconds.
      for (const mine of t.threats) {
        if (mine.kind !== 'mine' || !mine.alive) continue;
        // Measured against the lane AT THE MINE, so the band bends with it.
        if (Math.abs(mine.y - t.geo.laneY(ac.laneIndex ?? 0, mine.x)) > laneHalf) continue;
        if (Math.abs(mine.x - ac.x) > scanRadius) continue;
        const canSee = !mine.lowSig || rng.chance(t.effects.scanLowSigChance);
        if (!canSee) continue;
        mine.revealedUntil = Math.max(
          mine.revealedUntil ?? 0,
          t.time + COMBAT.mineContact.scanHoldSeconds,
        );
        revealMine(t, mine, 'scanPulse');
      }
      continue;
    }

    // The Warthog: a strafing run along the BEARING the player drew.
    //
    // The line is a direction, not a route. The jet crosses the whole strait on
    // that bearing, banks round at the near edge of the world and comes back
    // down it the other way. Treating the line as the path made the drawn
    // segment the whole sortie: a short line meant a short attack, so the
    // player was really choosing how long the aircraft stayed useful, which is
    // not a decision anybody wanted to be making with their finger.
    //
    // Phases: `onStation` is a firing pass, `departing` is the banked turn
    // between them. The gun is COLD through the turn — a real one cannot track
    // through 180 degrees of bank, and letting it kill during the turn made the
    // careful run-in irrelevant.
    const step = COMBAT.warthog.planeSpeed * dt;
    const runDx = ac.runBx - ac.runAx;
    const runDy = ac.runBy - ac.runAy;
    const runLen = Math.hypot(runDx, runDy) || 1;
    // The bearing, and the sign the current pass flies it in.
    const bx = runDx / runLen;
    const by = runDy / runLen;
    const dir = ac.pass === 0 ? 1 : -1;
    const ux = bx * dir;
    const uy = by * dir;

    if (ac.phase === 'departing') {
      // After the second pass there is nothing to come back for: fly out and be
      // culled.
      if (ac.pass >= 1) {
        ac.x += Math.cos(ac.heading) * step;
        ac.y += Math.sin(ac.heading) * step;
        continue;
      }
      // The turn between passes: a flown arc, not a snap, so it draws the wide
      // bank a jet actually makes. Started BEFORE the edge of the world so the
      // whole thing happens in view — the player paid for two passes and should
      // get to watch the aeroplane set up the second one.
      //
      // It steers back onto the LINE rather than merely onto the reciprocal
      // heading. A flat 180 leaves you on a parallel track displaced by the
      // turn diameter — measured, 750 units off, which put the return pass
      // clean past everything the first one had lined up. Regaining the track
      // is what a re-attack actually is.
      const lateral = -(ac.x - ac.runAx) * by + (ac.y - ac.runAy) * bx;
      // A point on the line, ahead of us in the RETURN direction: chasing it is
      // what curves the aircraft back on.
      const along = (ac.x - ac.runAx) * bx + (ac.y - ac.runAy) * by;
      const leadAlong = along - COMBAT.warthog.regainLead;
      const aimX = ac.runAx + bx * leadAlong;
      const aimY = ac.runAy + by * leadAlong;
      const want = Math.atan2(aimY - ac.y, aimX - ac.x);
      const swing = COMBAT.warthog.turnRate * dt;
      ac.heading += clamp(angleDiff(want, ac.heading), -swing, swing);
      ac.x += Math.cos(ac.heading) * step;
      ac.y += Math.sin(ac.heading) * step;
      // Rolled out: back on the track and pointing down it. Snap the last few
      // units of lateral error away so the pass runs exactly along the line the
      // player drew; at this tolerance the correction is not visible.
      const reciprocal = Math.atan2(-by, -bx);
      if (
        Math.abs(lateral) < COMBAT.warthog.regainTolerance &&
        Math.abs(angleDiff(reciprocal, ac.heading)) < 0.12
      ) {
        ac.x -= -by * lateral;
        ac.y -= bx * lateral;
        ac.pass = 1;
        ac.firedThisPass = false;
        ac.phase = 'onStation';
        // The return pass gets a fresh water crossing. The jet rolls out over
        // the land it turned above, so without this the "past the water" test
        // would be satisfied the instant the new pass began and it would turn
        // straight back round.
        ac.wetSeen = false;
        ac.landSeconds = 0;
      }
    } else {
      // Flying the pass on the drawn bearing, gun live.
      ac.heading = Math.atan2(uy, ux);
      ac.x += ux * step;
      ac.y += uy * step;
      // One engagement per pass. The jet takes the best target in its cone,
      // guns it, and is done until it comes round again — which is what makes
      // WHERE the line points the decision rather than parking over a crowd.
      ac.gunCooldown = Math.max(0, ac.gunCooldown - dt);
      if (!ac.firedThisPass && ac.gunCooldown <= 0) {
        const target = pickStrafeTarget(t, ac, strafeHalfAngle);
        if (target) {
          ac.firedThisPass = true;
          fireGunRun(t, ac, target, rng);
        }
      }
      // Break off, on a buffer measured in SECONDS of flight rather than units
      // of distance — see COMBAT.warthog.turnBufferSeconds. Two triggers,
      // because a run across the strait and a run along it end in completely
      // different places:
      //
      //   • Over land, having crossed the water first. This is what ends a run
      //     drawn across the strait: the jet clears the far shore, flies on for
      //     the buffer, and banks round over the land — well clear of the
      //     convoy, which is where a turn belongs.
      //   • Within the buffer of the left or right edge of the world. This is
      //     what ends a run drawn ALONG the strait, where there is no land to
      //     cross at all.
      //
      // Direction matters on the edge test. Checking proximity to any edge
      // meant that the moment the jet rolled out of a turn — still inside the
      // margin of the edge it had just turned away from — it immediately broke
      // off again, so the second pass never happened.
      if (aircraftOverLand(t, ac.x, ac.y)) {
        if (ac.wetSeen) ac.landSeconds += dt;
      } else {
        ac.wetSeen = true;
        ac.landSeconds = 0;
      }
      // The player's clearance, plus the room the reversal itself eats going
      // back down the track — see COMBAT.warthog.turnArcRadii. Both expressed
      // as seconds of flight, then converted once.
      const arcSeconds = COMBAT.warthog.turnArcRadii / COMBAT.warthog.turnRate;
      const breakOffSeconds = COMBAT.warthog.turnBufferSeconds + arcSeconds;
      const buffer = COMBAT.warthog.planeSpeed * breakOffSeconds;
      const pastWater = ac.landSeconds >= breakOffSeconds;
      const closingX =
        ux > 0 ? ac.x >= WORLD.width - buffer : ux < 0 ? ac.x <= buffer : false;
      // The top and bottom edges are a pure BACKSTOP — no bearing may ever fly
      // the jet out of the world without turning — and so they use a much
      // tighter margin than the design rule above. Given the same buffer, they
      // fired FIRST on every across-strait run: the map's north and south edges
      // are closer to the water than the land rule's break-off point, so the
      // turn was cut short and rolled out inside the water again, which is the
      // exact fault the arc allowance exists to fix.
      const edge = COMBAT.warthog.offMapMargin;
      const closingY =
        uy > 0 ? ac.y >= WORLD.height - edge : uy < 0 ? ac.y <= edge : false;
      if (pastWater || closingX || closingY) ac.phase = 'departing';
    }
  }
  // Cull finished aircraft: scan planes that flew off the right edge, the
  // Warthog once its second pass has carried it clear of the world.
  t.aircraft = t.aircraft.filter((ac) => {
    if (ac.role === 'scan') return ac.x <= WORLD.width + 80;
    if (ac.pass < 1 || ac.phase !== 'departing') return true;
    const m = COMBAT.warthog.offMapMargin + 40;
    return (
      ac.x > -m && ac.x < WORLD.width + m && ac.y > -m && ac.y < WORLD.height + m
    );
  });
  // Bursts are drawn for a fraction of a second and then gone.
  for (const run of t.strafeRuns) run.ttl -= dt;
  t.strafeRuns = t.strafeRuns.filter((run) => run.ttl > 0);
  for (const shot of t.gunShots) shot.ttl -= dt;
  t.gunShots = t.gunShots.filter((shot) => shot.ttl > 0);
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
    let skippedCovered = false;
    for (const threat of t.threats) {
      if (!threat.alive || !canEngage('interceptor', threat.kind)) continue;
      const d = dist(escort.x, escort.y, threat.x, threat.y);
      if (threat.claimedByInterceptor) {
        // Never double-fire at a missile that already has a kill shot inbound.
        if (fx.autoDedupe && d <= autoRadius) skippedCovered = true;
        continue;
      }
      if (d <= bestD) {
        bestD = d;
        best = threat;
      }
    }
    if (!best) {
      // ONE avoided shot: a ready launcher held its fire this cycle because
      // everything it could reach was already covered. Counting it inside the
      // scan above instead counted evaluations — every candidate, every escort,
      // every tick — which reported 1.9 million "avoided shots" across a sweep
      // and made the one number that prices the dedupe tactics meaningless.
      if (skippedCovered) t.stats.counter.duplicateShotsAvoided++;
      continue;
    }
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
    let skippedCovered = false;
    for (const threat of t.threats) {
      if (!threat.alive || !canEngage('interceptor', threat.kind)) continue;
      if (threat.claimedByInterceptor) {
        // Bases reach the whole map, so any covered missile is one this battery
        // could have fired at.
        if (fx.autoDedupe) skippedCovered = true;
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
    if (!best) {
      // One held shot per ready battery per cycle — see updateEscortAuto.
      if (skippedCovered) t.stats.counter.duplicateShotsAvoided++;
      continue;
    }
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
    // A pursuit order outranks whatever the gun found for itself: the player
    // named this boat, and the escort has sailed here to shoot it. The pin
    // only holds while the boat is genuinely in reach — out of range, the
    // helm (see the pursuit goal in the movement loop) closes the distance
    // and the gun stays free for targets of opportunity on the way.
    if (escort.pursueBoatId !== null) {
      const pursued = boats.find((b) => b.id === escort.pursueBoatId);
      if (pursued && dist(escort.x, escort.y, pursued.x, pursued.y) <= fx.range) {
        if (target && target.id !== pursued.id && target.engagedByEscortId === escort.id) {
          target.engagedByEscortId = undefined;
        }
        escort.gunTargetId = pursued.id;
        target = pursued;
      }
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
    // Every trigger pull draws a bought shell. An empty magazine holds its
    // fire — announced once per dry spell, because the player's mistake was
    // made in preparation and thirty toasts a second will not unmake it.
    if (t.gunAmmo <= 0) {
      if (!t.gunAmmoWarned) {
        t.gunAmmoWarned = true;
        pushEvent(t, { type: 'launchFailed', detail: 'Deck guns out of shells' });
      }
      continue;
    }
    t.gunAmmo--;
    // Fire one round: accuracy roll, then HP damage (boats are persistent
    // sinkable units, never one-tap kills).
    escort.gunCooldown = fx.fireInterval;
    t.stats.counter.deckGunRounds++;
    // The round the player SEES. Pushed before the roll is applied so its
    // muzzle and aim point are the ones the shot was actually taken at, then
    // stamped with the outcome below — the sim stays authoritative and this
    // carries no damage of its own (see GunShot).
    const shot: GunShot = {
      id: t.nextEntityId++,
      x: escort.x,
      y: escort.y,
      targetX: target.x,
      targetY: target.y,
      hit: false,
      killed: false,
      ttl: COMBAT.deckGunShell.flightSeconds,
      ttlTotal: COMBAT.deckGunShell.flightSeconds,
    };
    t.gunShots.push(shot);
    if (rng.chance(fx.accuracy)) {
      shot.hit = true;
      const tough = target.boatVariant === 'rocket' || target.boatVariant === 'boarding';
      const dmg = fx.damage * (tough && !fx.armorPiercing ? 0.5 : 1);
      target.hp = (target.hp ?? 1) - dmg;
      if (target.hp <= 0) {
        shot.killed = true;
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
    let skippedCovered = false;
    for (const threat of t.threats) {
      if (!threat.alive || !canEngage('selfDefense', threat.kind)) continue;
      const d = dist(ship.x, ship.y, threat.x, threat.y);
      if (d > pdRadius) continue;
      let key = d;
      if (fx.coordinated) {
        // Another module already has a likely kill inbound → skip entirely.
        if (threat.reservedByShipId !== undefined && threat.reservedByShipId !== ship.id) {
          skippedCovered = true;
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
    if (!best) {
      // One held shot per loaded mount per cycle — see updateEscortAuto.
      if (skippedCovered) t.stats.counter.duplicateShotsAvoided++;
      continue;
    }
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
    let skippedCovered = false;
    for (const threat of t.threats) {
      if (!threat.alive) continue;
      if (!canEngage('flak', threat.kind, researched)) continue;
      const d = dist(ship.x, ship.y, threat.x, threat.y);
      if (
        fx.deconfliction &&
        t.interceptors.some((i) => i.launcher === 'flak' && i.targetThreatId === threat.id)
      ) {
        if (d <= flakRadius) skippedCovered = true;
        continue;
      }
      if (d <= bestD) {
        bestD = d;
        best = threat;
      }
    }
    if (!best) {
      // One held shot per loaded mount per cycle — see updateEscortAuto.
      if (skippedCovered) t.stats.counter.duplicateShotsAvoided++;
      continue;
    }
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
      // Only hulls with enough of the strait left to be worked over. A boat
      // that commits to a leader spends the whole round chasing a ship that
      // scores anyway, and follows it off the end of the map doing it.
      const candidates = canCommit
        ? targetableShips(t).filter((s) => s.x < WORLD.deliverX - COMBAT.boatCommitMargin)
        : [];
      if (candidates.length === 0) {
        // No hull worth hunting. Before coasting, look for an ESCORT: the
        // screen is a legitimate target in its own right, and going for it is
        // what a real flotilla does when the merchants are out of reach. It
        // also stops boats milling about doing nothing for the back half of a
        // round the player is winning.
        const escort = canCommit ? nearestEngageableEscort(t, boat) : null;
        if (escort) {
          boat.targetEscortId = escort.id;
          boat.stationAngle = rng.range(0, Math.PI * 2);
        } else {
          // Nothing to hunt (or still in the post-kill pause): coast forward and
          // bleed speed rather than freezing mid-water.
          steerBoat(t, boat, boat.x + Math.cos(boat.heading) * 200, boat.y + Math.sin(boat.heading) * 200, fx.speed * 0.45, dt);
          continue;
        }
      } else {
        // Boarding boats hunt the prize — that is the T4 doctrine they grant.
        // Everything else works from the BACK of the convoy forward: the hull
        // with the most water still to cross is the one a boat has time to
        // finish, and starting at the tail keeps the fight where the player can
        // still do something about it.
        const pick =
          variant === 'boarding'
            ? candidates.reduce((best, s) =>
                SHIP_CLASSES[s.classId].value > SHIP_CLASSES[best.classId].value ? s : best,
              )
            : candidates.reduce((best, s) => (s.x < best.x ? s : best));
        boat.targetEscortId = undefined;
        boat.targetShipId = pick.id;
        boat.stationAngle = assignStation(t, boat, pick);
        target = pick;
      }
    }
    // --- Working an escort --------------------------------------------------
    // A boat with no merchant worth chasing goes for the screen instead. Same
    // shape as the hull case — hold a ring, shoot from it — but kept separate
    // because everything below is about a CONVOY hull: boarding parties,
    // station sharing between boats on one ship, give-way, delivery.
    if (target === undefined && boat.targetEscortId !== undefined) {
      const esc = t.escorts.find((e) => e.id === boat.targetEscortId && e.alive);
      if (!esc) {
        boat.targetEscortId = undefined;
        boat.stationAngle = undefined;
        continue;
      }
      const standoff = fx.standoff[variant] ?? fx.standoff.smallArms;
      const ang = boat.stationAngle ?? 0;
      steerBoat(
        t,
        boat,
        esc.x + Math.cos(ang) * standoff,
        esc.y + Math.sin(ang) * standoff,
        fx.speed,
        dt,
      );
      const weaponE = fx.fire[variant];
      const inRange = dist(boat.x, boat.y, esc.x, esc.y) <= standoff * 1.35;
      if (weaponE && inRange && (boat.fireCooldown ?? 0) <= 0) {
        boat.fireCooldown = weaponE.interval;
        fireBoatRound(t, boat, { ...esc, heading: 0, speed: 0 }, variant, weaponE, rng);
      }
      continue;
    }
    if (target === undefined) continue;

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
    ship.y += (t.geo.launchY(ship.x) - ship.y) * Math.min(1, dt * 0.6);
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
  keepAfloat(t, boat);
}

/** Fire one visible round from a boat at its target, leading the hull and
 *  scattering the aim. The round carries the damage; the boat does not. */
function fireBoatRound(
  t: TransitState,
  boat: Threat,
  /** Anything with a position and a course — a merchant or an escort. The round
   *  damages whatever it actually strikes, so this is only the aim point. */
  target: { id: number; x: number; y: number; heading: number; speed: number },
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
    if (!struck) {
      // Escorts are struck by the same rounds. Checked after the merchants so a
      // shot passing through the screen at a hull behind it still favours the
      // hull it was aimed at.
      const hitEscort = t.escorts.find(
        (e) =>
          e.alive &&
          dist(shot.x, shot.y, e.x, e.y) <=
            COMBAT.attackBoat.projectileHitRadius + COMBAT.escort.hitRadius * 0.5,
      );
      if (hitEscort) {
        shot.alive = false;
        t.stats.boatRoundsHit++;
        damageEscort(t, hitEscort, shot.damage, boatCause(shot.variant));
        continue;
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
    // Reach is measured to the lane WHERE THE GUN IS. A lane is a curve now,
    // so "how far is that lane from this gun" only has an answer at some x, and
    // the gun's own x is the one that matters — that is the water it covers.
    const reachable: number[] = [];
    for (let i = 0; i < t.geo.laneCount; i++) {
      const y = t.geo.laneY(i, gun.x);
      if (Math.abs(y - gun.y) <= fx.range.rollingBarrage) reachable.push(y);
    }
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
    const site = rng.pick(t.geo.launchSites);
    if (launch.kind === 'reconPlane') {
      t.stats.reconPlanes++;
      t.threats.push({
        id: t.nextEntityId++,
        kind: 'reconPlane',
        x: -60,
        // Crosses OVER the shipping lanes, not along its own shore. A plane
        // that never comes within flak reach is not shootable in any
        // meaningful sense, and the design calls for a reaction test.
        y: t.geo.laneY(rng.int(t.geo.laneCount), WORLD.width / 2) + rng.range(-60, 60),
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
/** Walk the player's smoke barrage: fire each pocket's round as its turn comes
 *  round, fly the rounds, and burst them into cloud where they land. */
function updateSmokeBarrage(t: TransitState, dt: number): void {
  // Rounds whose turn has come leave the friendly shore directly below their
  // burst point, so the barrage reads as a line of fire marching up the lane
  // rather than a fan from one battery.
  if (t.smokeBarrage.length > 0) {
    const due = t.smokeBarrage.filter((p) => p.at <= t.time);
    if (due.length > 0) {
      t.smokeBarrage = t.smokeBarrage.filter((p) => p.at > t.time);
      for (const pocket of due) {
        t.smokeShells.push({
          id: t.nextEntityId++,
          x: pocket.x,
          y: t.geo.baseY(pocket.x),
          targetX: pocket.x,
          targetY: pocket.y,
          radius: pocket.radius,
          duration: pocket.duration,
        });
      }
    }
  }
  if (t.smokeShells.length === 0) return;
  const step = COMBAT.smokeBarrage.shellSpeed * dt;
  const landed: SmokeShell[] = [];
  for (const shell of t.smokeShells) {
    const dx = shell.targetX - shell.x;
    const dy = shell.targetY - shell.y;
    const d = Math.hypot(dx, dy);
    if (d <= step) {
      shell.x = shell.targetX;
      shell.y = shell.targetY;
      landed.push(shell);
      continue;
    }
    shell.x += (dx / d) * step;
    shell.y += (dy / d) * step;
  }
  for (const shell of landed) {
    t.areaEffects.push({
      id: t.nextEntityId++,
      kind: 'smoke',
      x: shell.x,
      y: shell.y,
      radius: shell.radius,
      until: t.time + shell.duration,
    });
  }
  if (landed.length > 0) {
    const done = new Set(landed.map((s) => s.id));
    t.smokeShells = t.smokeShells.filter((s) => !done.has(s.id));
  }
}

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
    const site = { x: spawn.siteX, y: t.geo.launchY(spawn.siteX) };

    if (spawn.kind === 'torpedo') {
      // The UNDERWATER branch: launched from the shore and run under the
      // surface toward the convoy. Interceptors and close-in defense are
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
        leadSpeed = escortSpeedOf(t);
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
    ship.y = t.geo.laneY(ship.laneIndex, WORLD.spawnX) + ship.lateralSeed * formation.lateralSpread;
    ship.heading = 0;
    ship.speed = SHIP_CLASSES[ship.classId].speed * formation.speedMult * ship.speedVariance;
  }

  // Pre-tick snapshot of every moving hull (ships + escorts) so each ship's
  // steering reads the same world regardless of array order — deterministic.
  const convoyFwd = t.baseSpeed * formation.speedMult;
  const obstacles: {
    id: number;
    x: number;
    y: number;
    r: number;
    spd: number;
    escort: boolean;
    /** Where this hull is heading, so a merchant can tell traffic CROSSING its
     *  track from traffic travelling the same way as it. */
    vx: number;
    vy: number;
  }[] = [];
  for (const s of t.ships) {
    if (!isActive(s)) continue;
    obstacles.push({
      id: s.id,
      x: s.x,
      y: s.y,
      r: SHIP_CLASSES[s.classId].radius,
      spd: s.speed,
      escort: false,
      vx: Math.cos(s.heading) * s.speed,
      vy: Math.sin(s.heading) * s.speed,
    });
  }
  for (const e of t.escorts) {
    if (!e.alive) continue;
    // An escort's velocity is fully determined by its order, so it can be read
    // straight off the order rather than tracked: steaming to a destination,
    // stopped on station, or keeping pace alongside the convoy.
    let evx = convoyFwd;
    let evy = 0;
    if (e.moveTarget) {
      const dx = e.moveTarget.x - e.x;
      const dy = e.moveTarget.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      evx = (dx / d) * escortSpeedOf(t);
      evy = (dy / d) * escortSpeedOf(t);
    } else if (e.stationed) {
      evx = 0;
      evy = 0;
    }
    obstacles.push({
      id: -e.id,
      x: e.x,
      y: e.y,
      r: 12,
      spd: Math.hypot(evx, evy),
      escort: true,
      vx: evx,
      vy: evy,
    });
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
    const laneY = t.geo.laneY(ship.laneIndex, ship.x) + ship.lateralSeed * formation.lateralSpread;
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
    // Give-way: the tightest speed cap any crossing escort asks for, as a
    // fraction of cruise. 1 = nothing in the way, 0 = stop where you are.
    // Always computed, even when this hull has stopped honouring it, because
    // it is also what decides when honouring it may resume.
    let rawGiveWay = 1;

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

      const along = dx * fx + dy * fy;
      const lat = -dx * fy + dy * fx; // signed lateral offset (left positive)

      // An escort CROSSING the track is the stand-on vessel: it is under the
      // player's orders and holds its course, so the merchant answers with the
      // THROTTLE rather than the rudder. Swerving is what used to tear the
      // column apart — one hull leaning away from a passing escort shoved the
      // next, which shoved the next. Slowing does not propagate, and crossing
      // traffic clears the bow within seconds by definition.
      //
      // An escort travelling WITH the convoy is not crossing anything and gets
      // no such courtesy: it drops through to the ordinary logic below, which
      // knows how to overtake or wait behind a slower hull. Giving way to it
      // instead would be a merchant politely stopping behind an escort that
      // never gets out of the way, for the rest of the round.
      if (o.escort) {
        const crossRate = Math.abs(-o.vx * fy + o.vy * fx);
        if (crossRate >= NAV.giveWay.minCrossSpeed) {
          if (
            along > 0 &&
            along < NAV.giveWay.lookAhead &&
            Math.abs(lat) < r + o.r + NAV.giveWay.band
          ) {
            const factor =
              along <= NAV.giveWay.stopDistance
                ? 0
                : (along - NAV.giveWay.stopDistance) /
                  (NAV.giveWay.lookAhead - NAV.giveWay.stopDistance);
            rawGiveWay = Math.min(rawGiveWay, factor);
          }
          // Stand-on vessel: not steered around, not overtaken — unless this
          // hull has already waited longer than any crossing should take, in
          // which case it falls through and treats her as ordinary traffic.
          if (!ship.giveWayExhausted) continue;
        }
      }

      // Forward collision avoidance: another hull within the cone ahead.
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

    // Charted mines. A revealed mine is a KNOWN hazard on the plotted track, so
    // the helm does two things at once, exactly as it would at sea: it puts the
    // rudder over, AND it comes off the throttle — slower means a tighter turn
    // and more time to make it, and a mine close on the bow is worth almost any
    // amount of lost speed. (Uncharted mines are still a detection problem, and
    // a contact that has gone stale is uncharted again.)
    let mineSlow = 1;
    /** How badly this hull currently wants to be somewhere else, 0-1. */
    let mineDanger = 0;
    const mineBerth = r * NAV.mineBerthRadii;
    for (const mine of t.threats) {
      if (mine.kind !== 'mine' || !mine.alive || !mine.revealed) continue;
      const dx = mine.x - ship.x;
      const dy = mine.y - ship.y;
      const along = dx * fx + dy * fy;
      const lat = -dx * fy + dy * fx;

      // Standoff, whatever heading the ship is on. Forward-cone steering alone
      // only reacts to a mine the hull happens to be POINTED at, so a ship
      // could slide past one close enough aboard to look like it had not seen
      // it — and once the mine was abeam, nothing was in the cone at all.
      //
      // The direction matters as much as the force. Shoving a hull straight
      // back from a mine dead ahead just fights its own engine; what a helm
      // actually does is go WIDER. So ahead of the beam the standoff pushes
      // sideways, away from the side the mine is on, and abeam or astern it
      // pushes straight away to open the range.
      const dm = Math.hypot(dx, dy);
      if (dm > 0.001 && dm < mineBerth) {
        const frac = (mineBerth - dm) / mineBerth;
        mineDanger = Math.max(mineDanger, frac);
        const push = frac * (NAV.mineBerthWeight / NAV.sepWeight);
        if (along > 0) {
          const side = lat >= 0 ? -1 : 1;
          sepx += -fy * side * push;
          sepy += fx * side * push;
        } else {
          sepx -= (dx / dm) * push;
          sepy -= (dy / dm) * push;
        }
      }

      // The corridor is as wide as the berth the ship is trying to keep, and
      // that width matters more than it looks. It used to be a narrow fixed
      // band measured in the SHIP's frame, which meant a mine dead ahead fell
      // out of the corridor the moment the ship angled away from it — the
      // avoidance switched itself off at exactly the heading that was working,
      // and the hull settled into a shallow crab that took it past the charge
      // at two ship lengths. Steering has to stay engaged while the ship opens
      // out, or it is not steering, it is twitching.
      const band = Math.max(NAV.mineBand, mineBerth);
      if (along <= 0 || along > COMBAT.mineAvoidLookahead || Math.abs(lat) > band) continue;
      const urgency = 1 - along / COMBAT.mineAvoidLookahead;
      mineDanger = Math.max(mineDanger, urgency);
      // Steer to whichever side gives more room; if dead ahead, pick a side.
      const side = lat >= 0 ? -1 : 1;
      const w = NAV.mineAvoidWeight / NAV.avoidWeight;
      avx += -fy * side * urgency * w;
      avy += fx * side * urgency * w;
      // How much way to take off scales with how urgent the hazard is and how
      // squarely it sits on the bow: a mine well off to one side barely slows
      // the ship at all.
      const centrality = 1 - Math.abs(lat) / NAV.mineBand;
      const severity = urgency * centrality;
      mineSlow = Math.min(mineSlow, 1 - (1 - COMBAT.mineSlowFraction) * severity);
    }

    // Goal: head east, gently pulled toward this ship's lane line. But if a
    // slower hull is in my path, either COMMIT to a clear passing side (and
    // hold speed) or, if boxed in, slow to its pace and wait — like real ships.
    let gx = 1;
    // Lane-keeping yields to a mine. Holding the lane line is a tidiness
    // preference; the mine is the thing that ends the hull, and while the two
    // pulled against each other at roughly equal strength the ship sat on the
    // fence — measured, it crabbed along at a shallow angle and still passed
    // within two ship lengths of the charge. A helm clearing a mine is not
    // simultaneously trying to get back on its track.
    let gy =
      clamp((laneY - ship.y) / NAV.lanePull, -0.9, 0.9) * (1 - clamp(mineDanger * 1.6, 0, 1));
    let speedCap = cruise;
    if (hasBlock) {
      const wantSign = blockLat >= 0 ? -1 : 1; // veer to the side away from it
      if (passSideBlocked(ship.id, wantSign, blockAlong, obstacles, ship.x, ship.y, r, fx, fy)) {
        speedCap = blockSpd; // no room to pass → match pace and wait
      } else {
        gy = wantSign * 0.9; // clear water beside it → commit to the pass
      }
    }
    // Giving way and easing past a mine both cut the cap, and the tighter one
    // wins — never the average, or a hull would creep into something.
    const giveWayFactor = ship.giveWayExhausted ? 1 : rawGiveWay;
    speedCap = Math.min(speedCap, cruise * giveWayFactor, cruise * mineSlow);

    // Courtesy has a limit. If a merchant has been held near a standstill for
    // crossing traffic longer than any real crossing takes, something is wrong
    // with the picture and it stops waiting — it steers around instead. Without
    // this a single unlucky geometry could leave a hull stopped in the water
    // until the round expired, and "lost at sea" would be the game's fault.
    //
    // The clock runs on what the escort is ASKING for, not on the speed that
    // resulted: once a hull has given up, its own speed cap is 1 again, so
    // reading the outcome here would clear the flag on the very next tick and
    // put it straight back into the same stall.
    if (rawGiveWay < 0.2) {
      ship.giveWayHold += dt;
      if (ship.giveWayHold >= NAV.giveWay.maxHoldSeconds) ship.giveWayExhausted = true;
    } else if (rawGiveWay > 0.85) {
      ship.giveWayHold = 0;
      ship.giveWayExhausted = false;
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
    keepAfloat(t, ship);

    // Straggling vs the ship's healthy pace: damage or a jam makes it bait.
    //
    // Measured along the LANE, not along the map. Easting is the right measure
    // of "has she got across yet" and the wrong one for "is she behind": a hull
    // working round a bend covers more water than her easting shows, so judged
    // on easting she reads as a straggler for sailing perfectly. That is not a
    // cosmetic mislabel — a straggler is weighted up as a target, so the enemy
    // would aim harder at a convoy for the crime of being on a curved map.
    // Measured on the first cut of the headlands it flagged a third of all
    // ship-seconds against a quarter on the strait. On a straight lane
    // `laneDistance` returns x, so this is the same arithmetic it always was.
    const healthySpeed = SHIP_CLASSES[ship.classId].speed * formation.speedMult * ship.speedVariance;
    const sailed =
      t.geo.laneDistance(ship.laneIndex, ship.x) - t.geo.laneDistance(ship.laneIndex, WORLD.spawnX);
    const due = Math.max(0, t.time - ship.spawnTime) * healthySpeed;
    ship.straggling = due - sailed > COMBAT.straggleDistance;

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
  // stationed it simply cruises forward at the convoy's pace. (convoyFwd is
  // computed above, where the merchants read it off the obstacle snapshot.)
  //
  // What an escort steers around: merchant hulls AND the other escorts, in one
  // shape. Escorts used to be invisible to each other here — two of them
  // ordered through the same water drove straight through one another and only
  // the last-resort overlap push kept their sprites apart, which reads as a
  // collision, not seamanship. The snapshot is taken before any escort moves
  // this tick so the scan is order-independent.
  const escortObstacles = t.escorts
    .filter((e) => e.alive)
    .map((e) => ({
      id: e.id,
      x: e.x,
      y: e.y,
      heading: e.heading,
      speed: e.lastSpeed,
      radius: COMBAT.escort.hitRadius,
    }));
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
    // Where this escort wants to go, and how fast, before anything is in the
    // way: a destination if it has one, otherwise station-keeping alongside
    // the convoy, otherwise nothing at all.
    let goalX = 0;
    let goalY = 0;
    let speed = 0;
    // How much notice to take of other hulls. On the last stretch to a
    // destination this falls to zero, because several orders — rejoin the
    // convoy, most of all — send the escort AT a ship, and an escort that
    // refuses to go near ships can never carry one out.
    let avoidGain = 1;
    let goalDistBefore = 0;
    // A boat pursuit is a standing order with a moving destination: steam to
    // the boat, take station inside gun range, and shadow it there until it
    // sinks or the player re-tasks the ship. The hold ring sits well inside
    // the gun's reach so ordinary weaving never drops the target out of range.
    if (escort.pursueBoatId !== null) {
      const boat = t.threats.find((th) => th.id === escort.pursueBoatId && th.alive);
      if (!boat) {
        escort.pursueBoatId = null; // boat sunk or gone: resume ordinary duty
      } else {
        const dx = boat.x - escort.x;
        const dy = boat.y - escort.y;
        const d = Math.hypot(dx, dy) || 1;
        const holdAt = t.effects.deckGun.range * 0.7;
        goalX = dx / d;
        goalY = dy / d;
        // Full chase outside the ring, easing to a stop on it — and never
        // backing away: a boat that closes the range is the gun's problem,
        // not the helm's.
        speed = escortSpeedOf(t) * clamp((d - holdAt) / 60, 0, 1);
        avoidGain = clamp((d - NAV.escortArrive) / (2 * NAV.escortArrive), 0, 1);
      }
    }
    if (escort.moveTarget) {
      const dx = escort.moveTarget.x - escort.x;
      const dy = escort.moveTarget.y - escort.y;
      const d = Math.hypot(dx, dy);
      if (d <= NAV.escortArrive) {
        // Arrived. If a drawn route has more to it, the next point simply
        // becomes the destination and the ship carries on — that queue IS the
        // whole path mechanic, and it is why a route inherits every bit of
        // steering behaviour a single move order already had.
        const next = escort.waypoints.shift();
        if (next) {
          escort.moveTarget = { x: next.x, y: next.y, hold: escort.moveTarget.hold };
        } else {
          // End of the line: a hold order stations here, a move order resumes
          // forward with the convoy.
          escort.stationed = escort.moveTarget.hold;
          escort.moveTarget = null;
        }
        escort.blockedSeconds = 0;
      } else {
        goalDistBefore = d;
        goalX = dx / d;
        goalY = dy / d;
        speed = Math.min(escortSpeedOf(t), d / dt);
        avoidGain = clamp((d - NAV.escortArrive) / (2 * NAV.escortArrive), 0, 1);
        // Blocked long enough that there is evidently no way around: part the
        // line instead of circling it forever. Faded in rather than switched,
        // because a binary flip in the middle of a steering loop is a visible
        // twitch — the ship was going one way and is suddenly going another.
        const over = escort.blockedSeconds - NAV.escortAvoidGiveUpSeconds;
        if (over > 0) avoidGain *= clamp(1 - over / NAV.escortAvoidGiveUpFade, 0, 1);
      }
    } else {
      escort.blockedSeconds = 0;
    }
    if (escort.pursueBoatId === null && !escort.moveTarget && !escort.stationed) {
      goalX = 1; // cruise forward with the convoy
      goalY = 0;
      speed = convoyFwd;
    }

    if (speed > 0) {
      // Steer around the convoy rather than through it. A merchant under way
      // gives way (see the give-way rule above), but one stopped dead — jammed
      // by a drone, waiting behind a slower hull, boarded — cannot get out of
      // anybody's way, so the escort has to be the one that alters course.
      let avx = 0;
      let avy = 0;
      let sepx = 0;
      let sepy = 0;
      /** Depth of the deepest bubble overlap found so far — see the separation
       *  block below, which keeps only the strongest push rather than summing. */
      let sepPush = 0;
      const fx = Math.cos(escort.heading);
      const fy = Math.sin(escort.heading);
      // The hull this escort is working its way around, if any: the nearest one
      // in the corridor ahead. Deliberately ONE hull, not a sum over all of
      // them — averaging the "go left" from one ship against the "go right"
      // from the next produces a course that clears neither and changes its
      // mind every tick.
      // The hull already committed to keeps its claim for as long as it is
      // still in the way — it is tracked separately from "whichever is nearest"
      // rather than competing with it. Nearest-wins re-decided the target every
      // tick, so two hulls a few units apart in range traded the commitment
      // back and forth (measured: the target churned 3 → 1 → 3 → 1 on
      // successive ticks, and each swap put the rudder over the other way).
      /** One shape for everything in the water: a merchant hull or another
       *  escort. Escort ids share the entity counter with ships, so the pass
       *  commitment below can hold either without ambiguity. */
      interface SteerObstacle {
        id: number;
        x: number;
        y: number;
        heading: number;
        speed: number;
        radius: number;
      }
      let nearestOb: SteerObstacle | null = null;
      let nearestAlong = Infinity;
      let nearestLat = 0;
      let nearestBand = 0;
      let heldOb: SteerObstacle | null = null;
      let heldAlong = 0;
      let heldLat = 0;
      let heldBand = 0;
      const scanObstacle = (ob: SteerObstacle): void => {
        const or = ob.radius;
        const dx = ob.x - escort.x;
        const dy = ob.y - escort.y;
        const d = Math.hypot(dx, dy);
        if (d <= 0.001 || d > NAV.escortPerception) return;

        // Separation: hold clear water from anything close aboard. The two
        // ships carry bubbles; where those overlap, they ease apart, and the
        // deeper the overlap the harder they do it. The falloff exponent is
        // what makes the wide bubble usable — a linear ramp over this radius
        // would have the escort shouldered off its ordered track by any hull it
        // merely passed near, where a squared one is a nudge at first contact
        // and an emphatic shove close aboard.
        const sepDist = COMBAT.escort.hitRadius + or + NAV.escortSepBuffer;
        if (d < sepDist) {
          const overlap = (sepDist - d) / sepDist;
          const push = Math.pow(overlap, NAV.escortSepFalloff);
          // The DEEPEST overlap wins outright rather than every bubble adding
          // its own vote. Summing them reads fine on paper and shakes the ship
          // in practice: an escort between two hulls gets two nearly opposite
          // pushes, they cancel to a small residual, and the sign of that
          // residual flips as the geometry shifts a few units — measured, a
          // reversal on almost every tick with the passing target and side both
          // perfectly stable. One hull at a time is also what the avoidance
          // corridor above already does, for the same reason.
          if (push > sepPush) {
            sepPush = push;
            sepx = -(dx / d) * push;
            sepy = -(dy / d) * push;
          }
        }

        const along = dx * fx + dy * fy;
        const lat = -dx * fy + dy * fx;
        const band = COMBAT.escort.hitRadius + or + NAV.escortLaneBand;
        // A hull the escort has already committed to passing keeps its claim a
        // little past the edge of the corridor, so a course that is working is
        // not abandoned the instant the geometry says "clear".
        const committed = escort.passShipId === ob.id;
        const reach = committed ? band + NAV.escortPassCommitSlack : band;
        if (along > 0 && along < NAV.escortLookAhead && Math.abs(lat) < reach) {
          if (committed) {
            heldOb = ob;
            heldAlong = along;
            heldLat = lat;
            heldBand = band;
          } else if (along < nearestAlong) {
            nearestOb = ob;
            nearestAlong = along;
            nearestLat = lat;
            nearestBand = band;
          }
        }
      };
      for (const ship of t.ships) {
        if (!isActive(ship)) continue;
        scanObstacle({
          id: ship.id,
          x: ship.x,
          y: ship.y,
          heading: ship.heading,
          speed: ship.speed,
          radius: SHIP_CLASSES[ship.classId].radius,
        });
      }
      // The other escorts, from the tick-start snapshot: navigated around with
      // exactly the merchants' rules — bubble, corridor, pass-astern and all.
      for (const other of escortObstacles) {
        if (other.id !== escort.id) scanObstacle(other);
      }

      // Widened read: the accumulators are written inside scanObstacle, and
      // control-flow analysis cannot see closure assignments — without the
      // cast it narrows them to their initial null and the else-branch below
      // to never.
      const passOb = (heldOb ?? nearestOb) as SteerObstacle | null;
      const passAlong = heldOb ? heldAlong : nearestAlong;
      const passLat = heldOb ? heldLat : nearestLat;
      const passBand = heldOb ? heldBand : nearestBand;

      if (!passOb) {
        // Nothing in the corridor. Let the commitment lapse on a timer rather
        // than immediately: a hull skimming the edge drops out for a tick or
        // two at a time, and tearing the side down each time let it be
        // re-decided the other way on re-entry — a reversal caused by the
        // bookkeeping rather than by the water.
        escort.passClearSeconds += dt;
        if (escort.passClearSeconds >= NAV.escortPassReleaseSeconds) {
          escort.passShipId = null;
          escort.passSide = 0;
        }
      } else {
        escort.passClearSeconds = 0;
        // Which way round? Astern, whenever the hull is actually making way.
        //
        // Crossing ahead of a moving ship is a losing race: she keeps coming,
        // so the escort keeps having to bear away, and the merchant ends up
        // herding it further and further off its track. Cross behind her and
        // she takes herself out of the problem. It is also the rule of the road.
        //
        // A hull stopped in the water has no stern to pass, so that case falls
        // back to plain geometry: go round whichever side she is not on.
        const geoSide = passLat >= 0 ? -1 : 1;
        let side = geoSide;
        if (passOb.speed > NAV.escortSternMinSpeed) {
          // Her stern, expressed as a direction, projected onto the escort's
          // own port-side normal: positive means the stern lies to port.
          const sternLat = -(-Math.cos(passOb.heading)) * fy + -Math.sin(passOb.heading) * fx;
          // Two ships on the same course have no astern-side to speak of (her
          // stern is dead ahead of the escort, not off to one side) — that is
          // overtaking, and geometry decides it.
          if (Math.abs(sternLat) > NAV.escortSternMinLateral) {
            side = sternLat >= 0 ? 1 : -1;
          }
        }
        // ...but only DECIDE while there is no decision in force. Re-deciding
        // every tick as the geometry crosses dead ahead is what made the ship
        // shake; committing and holding is what makes it look like it is being
        // steered.
        if (escort.passShipId !== passOb.id || escort.passSide === 0) {
          escort.passShipId = passOb.id;
          escort.passSide = side;
        }
        // Shaped by the same falloff as separation, and for the same reason.
        // `1 - along/lookAhead` is linear, so doubling the look-ahead would
        // have raised the response at EVERY range rather than starting it
        // earlier — a hull 60 units ahead went from 0.5 to 0.75 without having
        // got any closer. Squaring restores the old strength close aboard
        // (0.56 at that same 60 units) while making first detection out at the
        // new edge of the cone the gentle nudge it should be.
        const urgency = Math.pow(1 - passAlong / NAV.escortLookAhead, NAV.escortSepFalloff);
        // Bearing away harder when she is close aboard laterally as well as
        // close ahead — a hull already half a beam off needs less.
        const centrality = 1 - Math.min(1, Math.abs(passLat) / Math.max(1, passBand));
        const gain = urgency * (0.35 + 0.65 * centrality);
        // Push perpendicular to the BEARING TO THE HULL, not to the escort's
        // own heading.
        //
        // Heading-relative was a feedback loop: the avoidance direction is
        // perpendicular to where the ship is pointing, so every degree of
        // rudder it caused swung the push itself, which called for more rudder.
        // With a merchant manoeuvring alongside it went unstable and the escort
        // slammed stop to stop — measured, 30 reversals at the full turn-rate
        // cap across one crossing, with the committed hull and passing side
        // both perfectly steady the whole time. The bearing to a hull changes
        // slowly and is not something the rudder can chase, so the loop is
        // broken at the source rather than damped afterwards.
        const bdx = passOb.x - escort.x;
        const bdy = passOb.y - escort.y;
        const bd = Math.hypot(bdx, bdy) || 1;
        avx += (-bdy / bd) * escort.passSide * gain;
        avy += (bdx / bd) * escort.passSide * gain;
      }

      const rawX =
        NAV.escortGoalWeight * goalX +
        avoidGain * (NAV.escortAvoidWeight * avx + NAV.escortSepWeight * sepx);
      const rawY =
        NAV.escortGoalWeight * goalY +
        avoidGain * (NAV.escortAvoidWeight * avy + NAV.escortSepWeight * sepy);
      // Filter the steering VECTOR, not the heading. The forces are recomputed
      // from scratch every tick against a world that is itself moving, so the
      // raw vector flickers even when nothing important has changed; sending
      // that to the rudder is what made the escort shake near the convoy.
      const k = 1 - Math.exp(-dt / NAV.escortSteerSmoothing);
      escort.steerX += (rawX - escort.steerX) * k;
      escort.steerY += (rawY - escort.steerY) * k;
      // Turn-rate limited on top, so an order reads as a ship altering course
      // rather than a cursor being dragged.
      //
      // A short steering vector carries no usable direction. Once the escort is
      // on station the goal force is spent, and what is left is a residue of
      // separation forces a hundredth the length of a real steering command —
      // whose ANGLE is then whatever the nearest hull happened to do that tick.
      // Feeding that to atan2 had the ship putting the rudder hard over, full
      // stop to full stop, in answer to nothing: measured, reversals at the
      // 86.7 mrad turn-rate cap with the steering vector down at 0.003 long.
      // Below the threshold there is no reason to turn, so the ship holds what
      // it has — which is also what a real one does.
      const steerMag = Math.hypot(escort.steerX, escort.steerY);
      if (steerMag > NAV.escortSteerDeadband) {
        const desired = Math.atan2(escort.steerY, escort.steerX);
        const dh = angleDiff(desired, escort.heading);
        escort.heading += clamp(dh, -NAV.escortTurnRate * dt, NAV.escortTurnRate * dt);
      }
      const step = speed * dt;
      escort.x += Math.cos(escort.heading) * step;
      escort.y += Math.sin(escort.heading) * step;

      // Did that tick actually get us anywhere? Ground made good, not speed
      // through the water — an escort sliding sideways along a wall of hulls is
      // moving at full speed and arriving never. The counter DECAYS rather than
      // resetting, so a ship that has just fought its way through does not
      // immediately start dodging again and re-block itself.
      if (goalDistBefore > 0 && escort.moveTarget) {
        const after = dist(escort.x, escort.y, escort.moveTarget.x, escort.moveTarget.y);
        const madeGood = goalDistBefore - after;
        escort.blockedSeconds = Math.max(
          0,
          escort.blockedSeconds + (madeGood < step * 0.35 ? dt : -dt),
        );
      }
    } else if (!escort.moveTarget && escort.stationed) {
      // Holding station, bow forward — but come round to it at the same rate
      // any other course change happens. Snapping the heading was a visible pop
      // the instant an escort reached its destination, and the arrival is
      // exactly the moment the player is looking at it.
      const dh = angleDiff(0, escort.heading);
      escort.heading += clamp(dh, -NAV.escortTurnRate * dt, NAV.escortTurnRate * dt);
      escort.steerX = Math.cos(escort.heading);
      escort.steerY = Math.sin(escort.heading);
    }
    escort.x = clamp(escort.x, 20, WORLD.deliverX - 20);
    keepAfloat(t, escort);
    // What the OTHER escorts' stern-passing logic reads next tick.
    escort.lastSpeed = speed;
  }

  // Last-resort overlap correction across all hulls (ships + escorts). Rare
  // once steering is doing its job; guarantees no visual stacking.
  //
  // Between two merchants it is shared evenly. Between a merchant and an
  // escort it is NOT: the escort is under orders and holds its track, and the
  // merchant absorbs almost all of the correction. An even split here is what
  // made an escort crossing the column look like a bowling ball — it was
  // knocked off its ordered course while knocking everything else off theirs.
  const bodies: { o: { x: number; y: number }; r: number; escort: boolean }[] = [];
  for (const s of t.ships) {
    if (isActive(s)) bodies.push({ o: s, r: SHIP_CLASSES[s.classId].radius, escort: false });
  }
  for (const e of t.escorts) if (e.alive) bodies.push({ o: e, r: 12, escort: true });
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
      const overlap = (minDist - d) * NAV.overlapPush;
      // Share of the correction each body takes.
      let aShare = 0.5;
      if (a.escort !== b.escort) aShare = a.escort ? 1 - NAV.escortPushShare : NAV.escortPushShare;
      a.o.x += (dx / d) * overlap * aShare;
      a.o.y += (dy / d) * overlap * aShare;
      b.o.x -= (dx / d) * overlap * (1 - aShare);
      b.o.y -= (dy / d) * overlap * (1 - aShare);
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

    if (threat.kind === 'guidedMissile') {
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
      const hitChance = COMBAT.guided.baseHitChance;
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

  // --- Mines: live contact & proximity triggers -------------------------------
  //
  // A mine is not a thing you find once and cross off. Detection produces a
  // CONTACT, and a contact goes stale:
  //
  //   • sonar — held only while some hull actually has the mine inside its
  //     envelope. Whoever holds it shares it: the whole fleet steers around a
  //     mine one ship can hear, which is the entire value of fitting sonar to
  //     anything. The moment the last hull that could hear it moves on (plus a
  //     few seconds of grace, so a contact on the edge does not strobe), the
  //     plot goes dark again.
  //   • scan plane — a timed fix. Good for half a minute, then gone.
  //
  // So a convoy can sail back into water it already charted and hit a mine it
  // already found. That is the point: detection buys you time and a course
  // change, and CLEARING the mine is the only permanent answer to it.
  const mineDetectionUp = sensorAvailable(t, 'mineDetection');
  for (const mine of t.threats) {
    if (mine.kind !== 'mine' || !mine.alive) continue;

    const detectable = mineDetectionUp && (!mine.lowSig || t.effects.mineSonar.detectLowSig);
    if (detectable) {
      // Nothing hears a mine without a sonar fitted to it. There is exactly one
      // exception and it is a purchased capability, not a freebie: the Shared
      // Sonar Picture node wires the unequipped hulls into the fleet's feed at
      // a much shorter range, and until it is researched fleetDetectRadius is
      // zero. A hull with no sonar and no shared picture is deaf, full stop.
      let heard = false;
      for (const ship of activeShips(t)) {
        const radius = ship.modules.includes('mineSonar')
          ? t.effects.mineSonar.radius
          : t.effects.mineSonar.fleetDetectRadius;
        if (radius > 0 && dist(ship.x, ship.y, mine.x, mine.y) <= radius) {
          heard = true;
          break;
        }
      }
      // Escorts listen too — but only the ones actually carrying a sonar. An
      // escort is a hull like any other: hearing mines is a fit you buy for
      // her, not something a warship does by existing. (Send that one ahead
      // and the water she is in stays charted for as long as she stays in it.)
      if (!heard) {
        for (const escort of t.escorts) {
          if (!escort.alive || !escort.modules.includes('mineSonar')) continue;
          if (dist(escort.x, escort.y, mine.x, mine.y) <= t.effects.mineSonar.radius) {
            heard = true;
            break;
          }
        }
      }
      if (heard) {
        mine.revealedUntil = Math.max(
          mine.revealedUntil ?? 0,
          t.time + COMBAT.mineContact.sonarGraceSeconds,
        );
        revealMine(t, mine, 'mineSonar');
      }
    }
    mine.revealed = t.time < (mine.revealedUntil ?? 0);

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
  updateSmokeBarrage(t, dt);
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
  // Crews still alive in the water hold the round open after the last hull
  // crosses: the convoy being home is not the operation being over while
  // people are still waiting for rescue. Bounded by the survivors' own
  // lifetime (SURVIVORS.lifetimeSeconds), so this never stalls a round —
  // every area resolves to rescued or lost on its own clock.
  const rescuesPending = t.survivors.some((a) => !a.rescued && !a.lost);
  if ((!unresolved && !rescuesPending) || t.time >= t.timeLimit) {
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
