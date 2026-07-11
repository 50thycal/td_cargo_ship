// Real-time transit simulation. Pure data-in / data-out: the UI feeds player
// commands into stepTransit and renders whatever is in TransitState. No DOM,
// no timers, no Math.random — the caller owns the RNG and the fixed timestep.

import { COMBAT, NAV, SIM, SPAWN, WORLD } from '../data/tuning';
import { FORMATIONS, SHIP_CLASSES, SHIP_NAMES } from '../data/defs';
import type { RNG } from './rng';
import type {
  Base,
  CampaignState,
  CombatEffects,
  Escort,
  LauncherKind,
  ResearchId,
  RoundPlan,
  Ship,
  ShipClassId,
  TechKey,
  Threat,
  TransitCommand,
  TransitEvent,
  TransitState,
} from './types';

// ---------------------------------------------------------------------------
// Research effects
// ---------------------------------------------------------------------------

export function deriveEffects(research: ReadonlySet<ResearchId>): CombatEffects {
  return {
    interceptHitBonus:
      (research.has('sensors1') ? 0.05 : 0) + (research.has('intercept1') ? 0.1 : 0),
    interceptorSpeedMult: research.has('intercept1') ? 1.3 : 1,
    escortCooldownMult: research.has('intercept2') ? 0.5 : 1,
    baseDetectRadius: research.has('sensors2') ? 120 : 0,
    sonarRadiusMult: research.has('sensors2') ? 1.8 : 1,
    detectLowSig: research.has('sensors3'),
    damageTakenMult: research.has('resilience1') ? 0.75 : 1,
    ecmGuidedHitChance: research.has('ew1') ? 0.08 : COMBAT.ecm.guidedHitChance,
    scanSweeps: research.has('mines1'),
    autoExtinguish: research.has('resilience2'),
    showTargetVectors: research.has('sensors1'),
  };
}

// ---------------------------------------------------------------------------
// Spawn scheduling & spacing
// ---------------------------------------------------------------------------

/** Clamp a lane index into the valid corridor range. */
export function clampLane(lane: number): number {
  return Math.max(0, Math.min(WORLD.lanes.length - 1, lane));
}

/** Reference lateral position for escort patrol and ability-effect centers:
 *  the corridor's center lane. */
export function patrolLaneY(_t: TransitState): number {
  return WORLD.lanes[1];
}

/** Schedule ship entries: ONE ship enters from the left roughly every
 *  SPAWN.interval seconds, round-robin across the lanes. A sparse, steady
 *  stream keeps the map uncluttered. */
function scheduleSpawns(ships: Ship[], rng: RNG): void {
  const order = rng.shuffle(ships.map((_, i) => i));
  const laneCount = WORLD.lanes.length;
  let laneCursor = rng.int(laneCount);
  let t = SPAWN.firstDelay;
  for (const idx of order) {
    const ship = ships[idx];
    ship.spawnTime = Math.max(SPAWN.firstDelay, t + rng.range(-SPAWN.timeJitter, SPAWN.timeJitter));
    ship.laneIndex = laneCursor % laneCount;
    ship.lateralSeed = rng.range(-1, 1);
    ship.speedVariance = rng.range(1 - SPAWN.speedVariance, 1 + SPAWN.speedVariance);
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

export function createTransit(campaign: CampaignState, plan: RoundPlan, rng: RNG): TransitState {
  const effects = deriveEffects(new Set(campaign.completedResearch));
  const names = rng.shuffle([...SHIP_NAMES]);
  let nextId = 1;

  const ships: Ship[] = [];
  const classIds = Object.keys(campaign.composition) as ShipClassId[];
  for (const classId of classIds) {
    const def = SHIP_CLASSES[classId];
    const modules = campaign.classModules[classId] ?? [];
    for (let i = 0; i < campaign.composition[classId]; i++) {
      const maxHp = def.hp + (modules.includes('reinforcedHull') ? 50 : 0);
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
        straggling: false,
      });
    }
  }
  // Individual entry timing/lane/jitter — ships stream in one at a time
  // rather than appearing as a single block.
  scheduleSpawns(ships, rng);

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
  const state: TransitState = {
    time: 0,
    over: false,
    anchorX: WORLD.spawnX,
    formation: campaign.formation,
    ships,
    escorts: [],
    bases: [],
    threats: [],
    interceptors: [],
    ammo: campaign.ammo,
    ecmCharges: campaign.ecmUnlocked ? COMBAT.ecm.chargesPerRound : 0,
    ecmActiveUntil: -1,
    scanCharges: campaign.scanUnlocked ? COMBAT.scan.chargesPerRound : 0,
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
      minesTotal: plan.mines.length,
      minesRevealed: 0,
      minesDetonated: 0,
      minesSwept: 0,
      ammoUsed: 0,
      ecmUsed: 0,
      scanUsed: 0,
      escortsLost: 0,
      launchersDisabled: 0,
    },
    effects,
    baseSpeed: Math.min(
      ...classIds.filter((c) => campaign.composition[c] > 0).map((c) => SHIP_CLASSES[c].speed),
    ),
    nextEntityId: nextId,
    avoidRolls: {},
    debutsSeen: [],
    pendingDamageApplied: pendingApplied,
  };

  for (let i = 0; i < campaign.escorts && i < ESCORT_SLOTS.length; i++) {
    state.escorts.push({
      id: state.nextEntityId++,
      x: WORLD.spawnX + ESCORT_SLOTS[i].dx,
      y: centerLaneY + ESCORT_SLOTS[i].dy,
      slotDx: ESCORT_SLOTS[i].dx,
      slotDy: ESCORT_SLOTS[i].dy,
      cooldown: 0,
      heading: 0,
      hp: COMBAT.escort.hp,
      maxHp: COMBAT.escort.hp,
      alive: true,
      disabledUntil: 0,
      moveTarget: null,
      stationed: false,
    });
  }

  // Shore batteries spread along the friendly (bottom) shore.
  const baseCount = Math.max(0, campaign.bases);
  for (let i = 0; i < baseCount; i++) {
    const frac = baseCount === 1 ? 0.5 : i / (baseCount - 1);
    state.bases.push({
      id: state.nextEntityId++,
      x: 360 + frac * (WORLD.width - 720),
      y: WORLD.baseLine,
      cooldown: 0,
      disabledUntil: 0,
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

function pushEvent(t: TransitState, ev: Omit<TransitEvent, 't'>): void {
  t.events.push({ t: t.time, ...ev });
}

function announceDebut(t: TransitState, key: TechKey): void {
  if (t.debutsSeen.includes(key)) return;
  t.debutsSeen.push(key);
  pushEvent(t, { type: 'techDebut', detail: key });
}

type MissileTarget =
  | { kind: 'ship'; ship: Ship }
  | { kind: 'escort'; escort: Escort };

/** Choose what a missile aims at: mostly cargo ships (weighted by value and
 *  straggler-preference), but escorts are in the pool too — so the enemy will
 *  occasionally single one out. Returns null only if nothing is targetable. */
function pickMissileTarget(
  rng: RNG,
  ships: Ship[],
  escorts: Escort[],
  straggleWeight: number,
): MissileTarget | null {
  const entries: { target: MissileTarget; weight: number }[] = [];
  for (const s of ships) {
    entries.push({
      target: { kind: 'ship', ship: s },
      weight: SHIP_CLASSES[s.classId].value * (s.straggling ? straggleWeight : 1),
    });
  }
  for (const e of escorts) {
    if (!e.alive) continue;
    entries.push({ target: { kind: 'escort', escort: e }, weight: COMBAT.escort.targetWeight });
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

function damageShip(
  t: TransitState,
  ship: Ship,
  amount: number,
  cause: string,
  rng: RNG,
  canIgnite: boolean,
): void {
  if (!ship.alive || ship.delivered) return;
  ship.hp -= amount * t.effects.damageTakenMult;
  pushEvent(t, { type: 'shipHit', shipId: ship.id, shipName: ship.name, cause });
  if (canIgnite && ship.hp > 0 && !ship.modules.includes('fireSuppression')) {
    if (rng.chance(COMBAT.fireChance)) {
      ship.fireSeconds = t.effects.autoExtinguish ? 1 : COMBAT.fireSeconds;
    }
  }
  if (ship.hp <= 0) killShip(t, ship, cause);
}

function killShip(t: TransitState, ship: Ship, cause: string): void {
  if (!ship.alive) return;
  ship.alive = false;
  ship.hp = 0;
  t.stats.lost++;
  pushEvent(t, { type: 'shipLost', shipId: ship.id, shipName: ship.name, cause });
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

/** A hit on an escort: hull damage, a temporary launcher outage, and — if the
 *  hull is gone — destruction (the escort is removed from the fleet). */
function damageEscort(t: TransitState, escort: Escort, amount: number, cause: string): void {
  if (!escort.alive) return;
  escort.hp -= amount * t.effects.damageTakenMult;
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
    t.stats.escortsLost++;
    pushEvent(t, { type: 'shipLost', shipId: escort.id, cause: `escort:${cause}` });
  }
}

/** A hit on a shore battery: it is hardened and not destroyed, but the strike
 *  knocks its launcher offline for a few seconds. */
function disableBase(t: TransitState, base: Base): void {
  const disableUntil = t.time + COMBAT.base.disableSeconds;
  if (disableUntil > base.disabledUntil) {
    base.disabledUntil = disableUntil;
    t.stats.launchersDisabled++;
    pushEvent(t, { type: 'shipHit', shipId: base.id, cause: 'base:missile' });
  }
}

// ---------------------------------------------------------------------------
// Command processing
// ---------------------------------------------------------------------------

function handleCommand(t: TransitState, cmd: TransitCommand, rng: RNG): void {
  switch (cmd.type) {
    case 'intercept': {
      const threat = t.threats.find(
        (th) => th.id === cmd.threatId && th.alive && th.kind !== 'mine',
      );
      if (!threat || threat.claimedByInterceptor) return;
      if (t.ammo <= 0) {
        pushEvent(t, { type: 'launchFailed', detail: 'No interceptors remaining' });
        return;
      }

      // Prefer a ready escort in range (fast reload); fall back to a ready
      // shore battery (unlimited range, slow reload). Nearest of each wins.
      let bestEscort: Escort | null = null;
      let bestEscortDist = Infinity;
      let escortReloading = false;
      for (const escort of t.escorts) {
        if (!escort.alive) continue; // destroyed escorts can't fire
        const d = dist(escort.x, escort.y, threat.x, threat.y);
        if (d > COMBAT.interceptor.range) continue;
        if (escort.cooldown > 0 || t.time < escort.disabledUntil) {
          escortReloading = true; // reloading OR knocked offline by a hit
          continue;
        }
        if (d < bestEscortDist) {
          bestEscort = escort;
          bestEscortDist = d;
        }
      }

      let bestBase: Base | null = null;
      let bestBaseDist = Infinity;
      let baseReloading = false;
      for (const base of t.bases) {
        if (base.cooldown > 0 || t.time < base.disabledUntil) {
          baseReloading = true; // reloading OR knocked offline by a hit
          continue;
        }
        const d = Math.abs(base.x - threat.x); // unlimited range; pick closest by x
        if (d < bestBaseDist) {
          bestBase = base;
          bestBaseDist = d;
        }
      }

      let originX: number;
      let originY: number;
      let launcher: LauncherKind;
      let speed: number;
      if (bestEscort) {
        bestEscort.cooldown = COMBAT.interceptor.cooldown * t.effects.escortCooldownMult;
        originX = bestEscort.x;
        originY = bestEscort.y;
        launcher = 'escort';
        speed = COMBAT.interceptor.speed * t.effects.interceptorSpeedMult;
      } else if (bestBase) {
        bestBase.cooldown = COMBAT.base.reload;
        originX = bestBase.x;
        originY = bestBase.y;
        launcher = 'base';
        speed = COMBAT.base.speed * t.effects.interceptorSpeedMult;
      } else {
        pushEvent(t, {
          type: 'launchFailed',
          detail: escortReloading || baseReloading ? 'All launchers reloading' : 'No launcher available',
        });
        return;
      }

      t.ammo--;
      t.stats.ammoUsed++;
      threat.claimedByInterceptor = true;
      t.interceptors.push({
        id: t.nextEntityId++,
        x: originX,
        y: originY,
        targetThreatId: threat.id,
        speed,
        launcher,
      });
      return;
    }
    case 'ability': {
      if (cmd.ability === 'ecm') {
        // No stacking: a burst must expire before another charge can be spent.
        if (t.ecmCharges <= 0 || t.time < t.ecmActiveUntil) return;
        t.ecmCharges--;
        t.stats.ecmUsed++;
        t.ecmActiveUntil = t.time + COMBAT.ecm.durationSeconds;
        pushEvent(t, { type: 'abilityUsed', detail: 'ecm' });
      } else if (cmd.ability === 'scan') {
        if (t.scanCharges <= 0) return;
        t.scanCharges--;
        t.stats.scanUsed++;
        pushEvent(t, { type: 'abilityUsed', detail: 'scan' });
        const cx = t.anchorX + 220;
        const cy = patrolLaneY(t);
        for (const mine of t.threats) {
          if (mine.kind !== 'mine' || !mine.alive) continue;
          const d = dist(cx, cy, mine.x, mine.y);
          if (!mine.revealed && d <= COMBAT.scan.radius) {
            const canSee =
              !mine.lowSig ||
              t.effects.detectLowSig ||
              rng.chance(COMBAT.scan.lowSigRevealChance);
            if (canSee) revealMine(t, mine);
          }
          if (t.effects.scanSweeps && mine.revealed && mine.alive && d <= COMBAT.scan.sweepRadius) {
            mine.alive = false;
            t.stats.minesSwept++;
            pushEvent(t, { type: 'mineSwept', lowSig: mine.lowSig });
          }
        }
      }
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

function revealMine(t: TransitState, mine: Threat): void {
  if (mine.revealed) return;
  mine.revealed = true;
  t.stats.minesRevealed++;
  pushEvent(t, { type: 'mineRevealed', lowSig: mine.lowSig });
  announceDebut(t, 'mine');
  if (mine.lowSig) announceDebut(t, 'lowSigMine');
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
  const liveEscorts = t.escorts.filter((e) => e.alive);
  while (t.spawnQueue.length > 0 && t.spawnQueue[0].time <= t.time) {
    const spawn = t.spawnQueue.shift()!;
    // Nothing to shoot at (all ships resolved and no escorts afloat) → skip.
    if (pool.length === 0 && liveEscorts.length === 0) continue;
    const site = { x: spawn.siteX, y: WORLD.launchSites[0].y };

    if (spawn.kind === 'missile') {
      // A fraction of unguided missiles streak across to strike a shore battery,
      // knocking it offline rather than hitting the convoy.
      if (t.bases.length > 0 && rng.chance(COMBAT.baseStrikeChance)) {
        const base = rng.pick(t.bases);
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

      const target = pickMissileTarget(rng, pool, liveEscorts, 1);
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
      const target = pickMissileTarget(rng, pool, liveEscorts, COMBAT.straggleTargetWeight);
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
  const ecmActive = t.time < t.ecmActiveUntil;

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

    // Steer around charted (revealed) mines the crew spots in time.
    for (const mine of t.threats) {
      if (mine.kind !== 'mine' || !mine.alive || !mine.revealed) continue;
      const dx = mine.x - ship.x;
      const dy = mine.y - ship.y;
      const along = dx * fx + dy * fy;
      const lat = -dx * fy + dy * fx;
      if (along <= 0 || along > COMBAT.mineAvoidLookahead || Math.abs(lat) > NAV.mineBand) continue;
      const key = `${ship.id}:${mine.id}`;
      if (!(key in t.avoidRolls)) t.avoidRolls[key] = rng.chance(formation.mineAvoidChance);
      if (!t.avoidRolls[key]) continue;
      const urgency = 1 - along / COMBAT.mineAvoidLookahead;
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
    const turnFactor = 1 - NAV.turnSlow * Math.min(1, Math.abs(dh) / (Math.PI / 2));
    const targetSpeed = Math.max(0, speedCap) * turnFactor;
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
      ship.hp -= COMBAT.fireDps * dt * t.effects.damageTakenMult;
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

  // --- Shore batteries (fixed; just reload) ----------------------------------
  for (const base of t.bases) {
    base.cooldown = Math.max(0, base.cooldown - dt);
  }

  // --- Missiles --------------------------------------------------------------
  for (const threat of t.threats) {
    if (!threat.alive || threat.kind === 'mine') continue;

    if (threat.kind === 'guidedMissile' && !ecmActive) {
      // Resolve the current homing point (escort or ship); re-acquire the
      // nearest ship if the original target is gone.
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
        const candidates = activeShips(t);
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
      const hitChance = ecmActive ? t.effects.ecmGuidedHitChance : COMBAT.guided.baseHitChance;
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
            damageShip(t, target, COMBAT.guided.damage, 'guidedMissile', rng, true);
          } else {
            pushEvent(t, { type: 'missileMiss', threatKind: 'guidedMissile' });
          }
        }
      }
    } else if (threat.targetKind === 'base') {
      // A battery strike: detonate on the installation, knocking it offline.
      const base = t.bases.find((b) => b.id === threat.targetEntityId);
      if (base && dist(threat.x, threat.y, base.x, base.y) <= COMBAT.base.hitRadius) {
        threat.alive = false;
        disableBase(t, base);
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
        damageShip(t, struckShip, COMBAT.missile.damage, 'missile', rng, true);
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

  // --- Point defense ----------------------------------------------------------
  for (const ship of activeShips(t)) {
    if (!ship.modules.includes('pointDefense')) continue;
    ship.pdCooldown = Math.max(0, ship.pdCooldown - dt);
    if (ship.pdCooldown > 0) continue;
    let nearest: Threat | null = null;
    let nearestD = Infinity;
    for (const threat of t.threats) {
      if (!threat.alive || threat.kind === 'mine') continue;
      const d = dist(ship.x, ship.y, threat.x, threat.y);
      if (d <= COMBAT.pointDefense.radius && d < nearestD) {
        nearest = threat;
        nearestD = d;
      }
    }
    if (!nearest) continue;
    ship.pdCooldown = COMBAT.pointDefense.cooldown;
    const killChance =
      nearest.kind === 'guidedMissile'
        ? COMBAT.pointDefense.killChanceVsGuided
        : COMBAT.pointDefense.killChanceVsMissile;
    if (rng.chance(killChance)) {
      nearest.alive = false;
      t.stats.pdKills++;
      t.stats.missilesIntercepted++;
      pushEvent(t, { type: 'pdKill', threatKind: nearest.kind });
    }
  }

  // --- Interceptors -------------------------------------------------------------
  for (const interceptor of t.interceptors) {
    const threat = t.threats.find((th) => th.id === interceptor.targetThreatId);
    if (!threat || !threat.alive) {
      interceptor.speed = 0; // marks it for removal below
      continue;
    }
    const d = dist(interceptor.x, interceptor.y, threat.x, threat.y);
    if (d <= 18) {
      threat.claimedByInterceptor = false;
      const targetShip = t.ships.find((s) => s.id === threat.targetShipId);
      let hitChance =
        (threat.kind === 'guidedMissile'
          ? COMBAT.interceptor.hitChanceVsGuided
          : COMBAT.interceptor.hitChanceVsMissile) + t.effects.interceptHitBonus;
      if (targetShip?.modules.includes('missileWarning')) hitChance += 0.1;
      hitChance = Math.min(0.95, hitChance);
      if (rng.chance(hitChance)) {
        threat.alive = false;
        t.stats.playerIntercepts++;
        t.stats.missilesIntercepted++;
        if (interceptor.launcher === 'base') t.stats.baseIntercepts++;
        else t.stats.escortIntercepts++;
        pushEvent(t, { type: 'intercepted', threatKind: threat.kind });
      } else {
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
  for (const mine of t.threats) {
    if (mine.kind !== 'mine' || !mine.alive) continue;

    if (!mine.revealed) {
      for (const ship of activeShips(t)) {
        const hasSonar = ship.modules.includes('mineSonar');
        let radius = hasSonar
          ? COMBAT.mineSonarRadius * t.effects.sonarRadiusMult
          : t.effects.baseDetectRadius;
        if (radius <= 0) continue;
        if (mine.lowSig && !t.effects.detectLowSig) continue;
        if (dist(ship.x, ship.y, mine.x, mine.y) <= radius) {
          revealMine(t, mine);
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

  // --- Housekeeping --------------------------------------------------------------
  t.time += dt;
  const unresolved = t.ships.some((s) => s.alive && !s.delivered);
  if (!unresolved || t.time >= SIM.maxTransitTime) {
    // Any ship still afloat when time expires counts as lost at sea.
    for (const ship of t.ships) {
      if (ship.alive && !ship.delivered) killShip(t, ship, 'timeout');
    }
    t.over = true;
  }
}
