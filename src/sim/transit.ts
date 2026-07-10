// Real-time transit simulation. Pure data-in / data-out: the UI feeds player
// commands into stepTransit and renders whatever is in TransitState. No DOM,
// no timers, no Math.random — the caller owns the RNG and the fixed timestep.

import { COMBAT, SIM, SPACING, SPAWN, WORLD } from '../data/tuning';
import { FORMATIONS, SHIP_CLASSES, SHIP_NAMES } from '../data/defs';
import type { RNG } from './rng';
import type {
  CampaignState,
  CombatEffects,
  Escort,
  FormationId,
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
function clampLane(lane: number): number {
  return Math.max(0, Math.min(WORLD.lanes.length - 1, lane));
}

/** The lane a ship actually steers toward: its own lane, shifted by the
 *  player's lane-bias command and clamped to the corridor. */
function effectiveLane(ship: Ship, t: TransitState): number {
  return clampLane(ship.laneIndex + t.laneBias);
}

/** Reference lateral position used for escort patrol and ability effect
 *  centers — the corridor's center lane, shifted by the lane-bias command. */
export function patrolLaneY(t: TransitState): number {
  return WORLD.lanes[clampLane(1 + t.laneBias)];
}

/** Minimum along-track gap required between two ships (the one ahead and
 *  the one following), in world units — "about two ship lengths" of clear
 *  water, plus whatever extra buffer the current formation adds. Never
 *  drops below the absolute floor regardless of formation. */
function requiredGap(aheadClass: ShipClassId, followClass: ShipClassId, formation: FormationId): number {
  const lengthAhead = SHIP_CLASSES[aheadClass].length;
  const lengthFollow = SHIP_CLASSES[followClass].length;
  const base = Math.max(SPACING.minGapFloor, Math.max(lengthAhead, lengthFollow) * SPACING.gapLengths);
  return Math.max(SPACING.minGapFloor, base + FORMATIONS[formation].gapBonus);
}

/** Schedule every ship's entry into the corridor: round-robin across lanes
 *  with a randomized order (so classes interleave) and jittered timing.
 *  Total spawn duration grows linearly with convoy size — the same logic
 *  handles a 20-ship or a 45-ship convoy without modification. */
function scheduleSpawns(ships: Ship[], rng: RNG): void {
  const order = rng.shuffle(ships.map((_, i) => i));
  const laneCount = WORLD.lanes.length;
  const lastSpawnInLane = new Array(laneCount).fill(SPAWN.firstDelay - SPAWN.perLaneInterval);
  let laneCursor = rng.int(laneCount);
  for (const idx of order) {
    const ship = ships[idx];
    const lane = laneCursor % laneCount;
    laneCursor++;
    const nominal = lastSpawnInLane[lane] + SPAWN.perLaneInterval;
    const jitter = rng.range(-SPAWN.timeJitter, SPAWN.timeJitter);
    const time = Math.max(SPAWN.firstDelay, lastSpawnInLane[lane] + SPAWN.minGap, nominal + jitter);
    lastSpawnInLane[lane] = time;
    ship.spawnTime = time;
    ship.laneIndex = lane;
    ship.lateralSeed = rng.range(-1, 1);
    ship.speedVariance = rng.range(1 - SPAWN.speedVariance, 1 + SPAWN.speedVariance);
  }
}

const ESCORT_SLOTS = [
  { dx: 70, dy: -120 },
  { dx: -70, dy: 120 },
  { dx: -200, dy: -120 },
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
        avoidDy: 0,
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
    laneBias: 0,
    formation: campaign.formation,
    reforming: 0,
    ships,
    escorts: [],
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
      pdKills: 0,
      minesTotal: plan.mines.length,
      minesRevealed: 0,
      minesDetonated: 0,
      minesSwept: 0,
      ammoUsed: 0,
      ecmUsed: 0,
      scanUsed: 0,
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

function pickWeighted(rng: RNG, ships: Ship[], straggleWeight: number): Ship {
  const weights = ships.map(
    (s) => SHIP_CLASSES[s.classId].value * (s.straggling ? straggleWeight : 1),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < ships.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return ships[i];
  }
  return ships[ships.length - 1];
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
      let best: Escort | null = null;
      let bestDist = Infinity;
      let inRangeButReloading = false;
      for (const escort of t.escorts) {
        const d = dist(escort.x, escort.y, threat.x, threat.y);
        if (d > COMBAT.interceptor.range) continue;
        if (escort.cooldown > 0) {
          inRangeButReloading = true;
          continue;
        }
        if (d < bestDist) {
          best = escort;
          bestDist = d;
        }
      }
      if (!best) {
        pushEvent(t, {
          type: 'launchFailed',
          detail: inRangeButReloading ? 'Launcher reloading' : 'Threat out of range',
        });
        return;
      }
      t.ammo--;
      t.stats.ammoUsed++;
      best.cooldown = COMBAT.interceptor.cooldown * t.effects.escortCooldownMult;
      threat.claimedByInterceptor = true;
      t.interceptors.push({
        id: t.nextEntityId++,
        x: best.x,
        y: best.y,
        targetThreatId: threat.id,
        speed: COMBAT.interceptor.speed * t.effects.interceptorSpeedMult,
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
    case 'formation': {
      if (cmd.formation === t.formation) return;
      t.formation = cmd.formation;
      t.reforming = SIM.reformSeconds;
      // No slot reassignment needed: each ship's lane target already reads
      // the new formation's spread/gap live, so it glides to the new spacing.
      pushEvent(t, { type: 'abilityUsed', detail: `formation:${cmd.formation}` });
      return;
    }
    case 'lane': {
      const max = WORLD.lanes.length - 1;
      const next = Math.max(-max, Math.min(max, t.laneBias + cmd.direction));
      if (next === t.laneBias) return;
      t.laneBias = next;
      pushEvent(t, { type: 'abilityUsed', detail: `lane:${next}` });
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

  // --- Patrol reference (escort/effect positioning only) ---------------------
  const formation = FORMATIONS[t.formation];
  const cohesion = t.reforming > 0 ? 0.8 : 1;
  t.reforming = Math.max(0, t.reforming - dt);
  const patrolSpeed = t.baseSpeed * formation.speedMult * cohesion;
  t.anchorX += patrolSpeed * dt;

  // --- Enemy spawns ----------------------------------------------------------
  const pool = activeShips(t);
  while (t.spawnQueue.length > 0 && t.spawnQueue[0].time <= t.time) {
    const spawn = t.spawnQueue.shift()!;
    if (pool.length === 0) continue;
    const site = { x: spawn.siteX, y: WORLD.launchSites[0].y };
    t.stats.missilesSpawned++;
    if (spawn.kind === 'guidedMissile') announceDebut(t, 'guidedMissile');
    if (spawn.kind === 'missile') {
      const target = pickWeighted(rng, pool, 1);
      // Lead the target: aim where it will be, iterating the flight-time guess.
      const leadSpeed = SHIP_CLASSES[target.classId].speed * formation.speedMult * target.speedVariance;
      let aimX = target.x;
      let aimY = target.y;
      for (let i = 0; i < 2; i++) {
        const flight = dist(site.x, site.y, aimX, aimY) / COMBAT.missile.speed;
        aimX = target.x + leadSpeed * flight;
        aimY = target.y;
      }
      const d = dist(site.x, site.y, aimX, aimY);
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
        revealed: true,
        lowSig: false,
        claimedByInterceptor: false,
      });
    } else {
      const target = pickWeighted(rng, pool, COMBAT.straggleTargetWeight);
      const d = dist(site.x, site.y, target.x, target.y);
      t.threats.push({
        id: t.nextEntityId++,
        kind: 'guidedMissile',
        x: site.x,
        y: site.y,
        vx: ((target.x - site.x) / d) * COMBAT.guided.speed,
        vy: ((target.y - site.y) / d) * COMBAT.guided.speed,
        speed: COMBAT.guided.speed,
        alive: true,
        targetShipId: target.id,
        revealed: true,
        lowSig: false,
        claimedByInterceptor: false,
      });
    }
  }

  // --- Ships -----------------------------------------------------------------
  const ecmActive = t.time < t.ecmActiveUntil;

  // Bring newly-scheduled ships into the world.
  for (const ship of t.ships) {
    if (ship.spawned || t.time < ship.spawnTime) continue;
    ship.spawned = true;
    ship.x = WORLD.spawnX;
    ship.y = WORLD.lanes[effectiveLane(ship, t)] + ship.lateralSeed * formation.lateralSpread;
  }

  // Snapshot pre-tick positions per lane, sorted by progress, so the
  // following-distance governor below is order-independent within this
  // tick (a ship processed later in the array must not "see" another
  // ship's already-updated position from earlier in the same tick).
  const laneSnapshot: { id: number; x: number; classId: ShipClassId }[][] = WORLD.lanes.map(() => []);
  for (const ship of t.ships) {
    if (!isActive(ship)) continue;
    laneSnapshot[effectiveLane(ship, t)].push({ id: ship.id, x: ship.x, classId: ship.classId });
  }

  for (const ship of t.ships) {
    if (!isActive(ship)) continue;

    // Mine avoidance: does the crew spot a revealed mine ahead in time?
    ship.avoidDy *= Math.max(0, 1 - dt * 1.5);
    for (const mine of t.threats) {
      if (mine.kind !== 'mine' || !mine.alive || !mine.revealed) continue;
      const ahead = mine.x - ship.x;
      if (ahead < -20 || ahead > COMBAT.mineAvoidLookahead) continue;
      if (Math.abs(mine.y - ship.y) > 50) continue;
      const key = `${ship.id}:${mine.id}`;
      if (!(key in t.avoidRolls)) {
        t.avoidRolls[key] = rng.chance(formation.mineAvoidChance);
      }
      if (t.avoidRolls[key]) {
        ship.avoidDy = (ship.y <= mine.y ? -1 : 1) * COMBAT.mineAvoidOffset;
      }
    }

    const crippled = ship.hp < ship.maxHp * COMBAT.crippleHpFraction;

    // Forward speed: class pace, formation tempo, this ship's own personal
    // variance (so the stream never moves in perfect lockstep), and a hard
    // cut if crippled.
    let speed = SHIP_CLASSES[ship.classId].speed * formation.speedMult * ship.speedVariance;
    if (crippled) speed *= COMBAT.crippleSpeedMult;
    if (t.reforming > 0) speed *= 0.9;

    // Following-distance governor: never let a ship close within the
    // minimum safe gap of whichever ship is immediately ahead of it in the
    // same lane. This is what guarantees ships never overlap or stack,
    // regardless of spawn timing, crippling, or mine-dodge jitter.
    const lane = effectiveLane(ship, t);
    let ahead: { x: number; classId: ShipClassId } | null = null;
    for (const entry of laneSnapshot[lane]) {
      if (entry.id === ship.id) continue;
      if (entry.x > ship.x && (!ahead || entry.x < ahead.x)) ahead = entry;
    }
    if (ahead) {
      const gapNeeded = requiredGap(ahead.classId, ship.classId, t.formation);
      const gap = ahead.x - ship.x;
      if (gap < gapNeeded) {
        const stopZone = gapNeeded * 0.3;
        const slack = gapNeeded - stopZone;
        const room = Math.max(0, gap - stopZone);
        speed *= slack > 0 ? Math.max(0, Math.min(1, room / slack)) : 0;
      }
    }

    ship.x += speed * dt;

    // Lateral homing toward this ship's lane target (own lane + persistent
    // jitter + any active mine-dodge offset) at a fixed correction speed,
    // independent of forward progress.
    const laneTargetY = WORLD.lanes[lane] + ship.lateralSeed * formation.lateralSpread + ship.avoidDy;
    const dy = laneTargetY - ship.y;
    const lateralStep = SPACING.lateralCorrectionSpeed * dt;
    ship.y += Math.max(-lateralStep, Math.min(lateralStep, dy));
    ship.y = Math.max(60, Math.min(WORLD.height - 60, ship.y));

    // Straggling is measured against THIS ship's own expected pace (class
    // speed * formation tempo * its own variance), so baseline personality
    // never trips it — only genuine damage or being blocked does.
    const nominalSpeed = SHIP_CLASSES[ship.classId].speed * formation.speedMult * ship.speedVariance;
    const nominalX = WORLD.spawnX + Math.max(0, t.time - ship.spawnTime) * nominalSpeed;
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

  // Cross-lane safety net: a true last-resort guarantee that no two ships
  // ever visually overlap, independent of the lane governor above (which
  // only reasons about ships sharing a lane). Cheap at this scale (<=45
  // ships) and only ever nudges ships apart laterally, never touching
  // forward progress.
  const activeNow = activeShips(t);
  for (let i = 0; i < activeNow.length; i++) {
    for (let j = i + 1; j < activeNow.length; j++) {
      const a = activeNow[i];
      const b = activeNow[j];
      if (Math.abs(a.x - b.x) > 60) continue;
      const minDist = (SHIP_CLASSES[a.classId].radius + SHIP_CLASSES[b.classId].radius) * 2.2;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < minDist) {
        const push = (minDist - d) / 2;
        const dir = dy >= 0 ? 1 : -1;
        a.y += dir * push;
        b.y -= dir * push;
      }
    }
  }

  // --- Escorts ---------------------------------------------------------------
  const escortLaneY = patrolLaneY(t);
  for (const escort of t.escorts) {
    escort.cooldown = Math.max(0, escort.cooldown - dt);
    const targetX = t.anchorX + escort.slotDx;
    const targetY = escortLaneY + escort.slotDy;
    const dx = targetX - escort.x;
    const dy = targetY - escort.y;
    const d = Math.hypot(dx, dy);
    const step = 42 * dt;
    if (d <= step) {
      escort.x = targetX;
      escort.y = targetY;
    } else {
      escort.x += (dx / d) * step;
      escort.y += (dy / d) * step;
    }
  }

  // --- Missiles --------------------------------------------------------------
  for (const threat of t.threats) {
    if (!threat.alive || threat.kind === 'mine') continue;

    if (threat.kind === 'guidedMissile' && !ecmActive) {
      let target = t.ships.find((s) => s.id === threat.targetShipId && s.alive && !s.delivered);
      if (!target) {
        const candidates = activeShips(t);
        if (candidates.length > 0) {
          target = candidates.reduce((best, s) =>
            dist(threat.x, threat.y, s.x, s.y) < dist(threat.x, threat.y, best.x, best.y) ? s : best,
          );
          threat.targetShipId = target.id;
        }
      }
      if (target) {
        // Rotate velocity toward the target with a limited turn rate.
        const desired = Math.atan2(target.y - threat.y, target.x - threat.x);
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
      const target = t.ships.find((s) => s.id === threat.targetShipId && s.alive && !s.delivered);
      if (target && dist(threat.x, threat.y, target.x, target.y) <= COMBAT.guided.hitRadius) {
        threat.alive = false;
        const hitChance = ecmActive ? t.effects.ecmGuidedHitChance : COMBAT.guided.baseHitChance;
        if (rng.chance(hitChance)) {
          damageShip(t, target, COMBAT.guided.damage, 'guidedMissile', rng, true);
        } else {
          pushEvent(t, { type: 'missileMiss', threatKind: 'guidedMissile' });
        }
      }
    } else {
      // Unguided: hit the first ship it brushes, else splash at the aim point.
      let struck: Ship | null = null;
      for (const ship of activeShips(t)) {
        if (dist(threat.x, threat.y, ship.x, ship.y) <= COMBAT.missile.hitRadius) {
          struck = ship;
          break;
        }
      }
      if (struck) {
        threat.alive = false;
        damageShip(t, struck, COMBAT.missile.damage, 'missile', rng, true);
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
        pushEvent(t, { type: 'intercepted', threatKind: threat.kind });
      } else {
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
