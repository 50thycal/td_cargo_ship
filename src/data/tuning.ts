// Central gameplay tuning. Every balance number lives here or in the sibling
// data files — never hard-coded inside sim logic — so playtesting iterations
// are config edits, not code changes.

export const WORLD = {
  width: 2000,
  height: 1000,
  /** Ships are delivered once past this x. */
  deliverX: 1940,
  /** Convoy spawns with its lead ships around this x. */
  spawnX: 40,
  /** Y centers of the three transit lanes (north / center / south). */
  lanes: [340, 520, 700],
  /** Hostile shore occupies the top of the map; launch sites sit along it. */
  launchSites: [
    { x: 350, y: 70 },
    { x: 900, y: 55 },
    { x: 1450, y: 70 },
  ],
  /** Friendly shore (bottom): shore batteries launch interceptors from here. */
  baseLine: 920,
} as const;

export const SIM = {
  /** Fixed timestep (seconds). The sim only ever advances in these steps. */
  dt: 1 / 30,
  /** Hard safety cap on transit length (seconds). */
  maxTransitTime: 360,
} as const;

export const SPAWN = {
  /** Delay before the first ship enters. */
  firstDelay: 1.0,
  /** One ship enters from the left roughly every this many seconds. Keeps the
   *  map uncluttered — the stream is sparse and readable. */
  interval: 5.0,
  /** Small +/- jitter so entries aren't a perfect metronome. */
  timeJitter: 0.4,
  /** Persistent per-ship pace variance, +/- this fraction of class speed. */
  speedVariance: 0.05,
} as const;

/**
 * Steering-behavior navigation. Ships integrate a smoothed steering vector
 * (goal + separation + forward collision-avoidance) into an acceleration- and
 * turn-rate-limited motion, so they ease around and wait for one another like
 * real vessels instead of snapping or overlapping.
 */
export const NAV = {
  /** Sense neighbors within this radius. */
  perception: 150,
  /** Clear water (beyond the two hull radii) the separation force protects. */
  sepBuffer: 34,
  sepWeight: 1.9,
  /** Forward distance over which an obstacle ahead is avoided. */
  lookAhead: 135,
  /** Lateral half-width of the "in my path" corridor (added to hull radii). */
  laneBand: 14,
  avoidWeight: 1.7,
  goalWeight: 1.0,
  /** Lateral distance over which the goal pulls a ship back to its lane line
   *  (larger = gentler lane-keeping). */
  lanePull: 70,
  /** Heading may swing at most this many radians/second. */
  maxTurnRate: 1.4,
  /** Speed may change at most this many units/second^2. */
  maxAccel: 22,
  /** Heading is clamped to +/- this from due-east so ships always progress. */
  headingClamp: 1.2,
  /** Fraction of speed shed while turning hardest (eases into avoidance turns). */
  turnSlow: 0.55,
  /** Revealed-mine avoidance corridor + weight. */
  mineBand: 30,
  mineAvoidWeight: 2.6,
  /** Last-resort hull-overlap correction (fraction of overlap per tick). Rarely
   *  triggers once steering is doing its job; guarantees no visual overlap. */
  overlapPush: 0.5,
  /** Escorts. */
  escortSpeed: 50,
  escortArrive: 16,
  escortSepBuffer: 26,
} as const;

export const COMBAT = {
  missile: { speed: 60, damage: 34, hitRadius: 30, splashRadius: 55, splashDamage: 14 },
  guided: { speed: 50, damage: 46, hitRadius: 30, turnRate: 1.4, baseHitChance: 0.92 },
  mine: { damage: 115, triggerRadius: 30 },
  /** Chance a missile hit starts a fire (damage over time). */
  fireChance: 0.3,
  fireDps: 3,
  fireSeconds: 6,
  /** Ships below this hp fraction are crippled and slow down. */
  crippleHpFraction: 0.5,
  crippleSpeedMult: 0.55,
  /** Straggler: distance behind formation slot that marks a ship isolated. */
  straggleDistance: 130,
  /** Guided missiles prefer stragglers by this weight factor. */
  straggleTargetWeight: 1.6,
  /** A ship within this distance of the delivery line is treated as already
   *  safe — the enemy won't fire on a hull about to score (a missile could
   *  never arrive in time), so misses aren't wasted chasing delivered ships. */
  deliverSafeMargin: 90,
  /** Enemy target-selection skill ramp: skill = clamp((round - start)/span).
   *  Skill 0 = near-random (value-weighted only); skill 1 = heavily favors
   *  closer and lower-health ships. */
  targetingSkillStartRound: 2,
  targetingSkillSpanRounds: 8,
  /** How strongly full skill weights proximity-to-launch and woundedness. */
  targetingProximityWeight: 1.6,
  targetingWoundedWeight: 1.6,
  /** Escort-launched interceptors: the ship-mounted launcher. Deliberately the
   *  SLOWER of the two interceptor types and shorter-ranged — its edge is a
   *  fast reload and being able to move with the convoy, not velocity. */
  interceptor: {
    speed: 92,
    /** Max launch range from an escort to the target threat. */
    range: 780,
    cooldown: 3.2,
    hitChanceVsMissile: 0.82,
    hitChanceVsGuided: 0.66,
  },
  /** Fixed shore battery: engages any missile on the map (unlimited range),
   *  but reloads far slower than an escort. The player's baseline defense.
   *  A missile strike knocks it offline for disableSeconds and does hull
   *  damage; enough strikes destroy it (hardened, so it takes a lot). */
  base: {
    reload: 4.0,
    /** Shore-battery interceptors are the FAST interceptor type — they start
     *  quicker than escorts and scale hard with interception research. */
    speed: 150,
    hitRadius: 30,
    disableSeconds: 9,
    /** Hull points. Hardened installation — takes many strikes to destroy. */
    hp: 300,
    /** Damage a battery strike does to the installation. */
    strikeDamage: 40,
  },
  /** Escorts are ships at sea: they take hull damage from missiles and mines,
   *  can be destroyed (and are then lost from the fleet), and a hit knocks
   *  their launcher offline for disableSeconds. */
  escort: {
    hp: 130,
    hitRadius: 15,
    disableSeconds: 8,
    /** Missile-target weight vs a cargo ship's cargo value (so escorts are
     *  occasionally, not constantly, singled out). */
    targetWeight: 9,
  },
  /** Fraction of missiles that streak across to strike a shore battery. */
  baseStrikeChance: 0.07,
  /** Point-defense turret module: a per-ship close-in interceptor. It is a
   *  limited magazine, NOT a free auto-turret — each ship gets `magazine` shots
   *  for the whole transit, refilled each round. */
  pointDefense: {
    radius: 95,
    cooldown: 1.3,
    killChanceVsMissile: 0.5,
    killChanceVsGuided: 0.33,
    /** Speed of the point-defense tracer projectile (fast, short range). */
    projectileSpeed: 260,
    /** Shots each point-defense ship may fire per transit. */
    magazine: 1,
  },
  /** ECM plane: flies to a water station, orbits jamming inbound missiles —
   *  any missile that lingers inside the orbit `explodeSeconds` cooks off — then
   *  departs. `stationSeconds` is how long it holds the orbit. */
  ecm: {
    stationSeconds: 9,
    guidedHitChance: 0.2,
    chargesPerRound: 2,
    radius: 300,
    /** Seconds a missile must spend inside the jamming orbit before it explodes. */
    explodeSeconds: 2.5,
    /** Cruise speed of the ECM plane. */
    planeSpeed: 240,
    /** Orbit angular speed (radians/second). */
    orbitRate: 1.1,
    /** Radius the plane flies around the orbit center. */
    orbitRadius: 90,
    /** Water band the orbit center must sit inside (off both shores/launchers). */
    waterYMin: 150,
    waterYMax: 860,
  },
  /** Scan plane: flies down the player-selected lane charting mines in THAT lane
   *  only, then leaves. */
  scan: {
    chargesPerRound: 2,
    lowSigRevealChance: 0.35,
    /** Cruise speed of the scan plane across the map. */
    planeSpeed: 520,
    /** Half-width of the lane band the plane can chart (mines outside are missed). */
    laneHalfWidth: 95,
    /** How far ahead/around the plane it reveals mines as it passes. */
    revealRadius: 130,
  },
  /** Minesweeper drone (unlocked by mine-warfare research): launches from the
   *  nearest escort toward a revealed mine and detonates it. Each launch spends
   *  a purchased drone munition. */
  sweepDrone: {
    speed: 95,
    /** Min seconds between drone launches (whole convoy). */
    cooldown: 4.5,
    /** An escort must be within this range of the mine to send a drone. */
    launchRange: 1100,
    /** Distance at which the drone reaches the mine and sweeps it. */
    sweepRadius: 16,
  },
  mineSonarRadius: 240,
  /** Ships auto-steer around revealed mines within this look-ahead range. A
   *  charted mine is ALWAYS steered around (no dodge roll) — a revealed mine on
   *  the plotted track is a known hazard the helm actively avoids. */
  mineAvoidLookahead: 200,
  mineAvoidOffset: 70,
} as const;

export const ECONOMY = {
  startCash: 450,
  startIntel: 0,
  startAmmo: 28,
  /** No drone munitions until the player buys them (and researches drones). */
  startDroneAmmo: 0,
  /** One shore battery to start; no free escort. */
  startBases: 1,
  startEscorts: 0,
  /** Cash earned per point of cargo value delivered. */
  cashPerValue: 4,
  ammoCost: 8,
  /** Cash per minesweeper-drone munition, and how many a single purchase buys. */
  droneAmmoCost: 14,
  droneAmmoPerBuy: 3,
  baseCost: 300,
  maxBases: 4,
  escortCost: 600,
  maxEscorts: 3,
  ecmUnlockCost: 150,
  scanUnlockCost: 150,
  /** Cash per hp of hull repair. */
  repairCostPerHp: 0.8,
  /** Intel income. */
  intelPerRound: 4,
  intelPerLoss: 6,
  intelPerIntercept: 1,
  intelPerDiscovery: 12,
  intelMaxPerRound: 60,
} as const;

export const CAMPAIGN = {
  startCapacity: 20,
  maxCapacity: 45,
  capacityStep: 5,
  /** Delivered-fraction threshold that counts as a "strong" round. */
  strongRoundFraction: 0.85,
  /** Consecutive strong rounds needed to grow capacity. */
  strongRoundsForGrowth: 2,
  startConfidence: 60,
  maxConfidence: 100,
  /** Confidence deltas. */
  confidenceGreatRound: 8, // >= 90% delivered
  confidenceGoodRound: 5, // >= 75% delivered
  confidenceBadRound: -5, // < 60% delivered
  confidencePerLoss: -3,
  confidenceLossCap: -12, // max penalty from losses in one round
  confidenceQuotaMet: 10,
  confidenceQuotaMissed: -18,
  /** Quota: value points required per 3-round window. The requirement starts
   *  from the initial capacity and ramps gently per window, deliberately NOT
   *  tracking capacity growth — larger convoys are opportunity, not obligation. */
  quotaWindowRounds: 3,
  quotaPerCapacity: 24, // initial window: startCapacity * this
  quotaGrowthPerWindow: 40,
  /** Score weights. */
  scorePerValue: 1,
  scorePerRound: 40,
  scorePerIntercept: 3,
} as const;

export const EVOLUTION = {
  /** Enemy tech points earned per round: base + perRound * round. */
  basePoints: 10,
  pointsPerRound: 4,
  bonusStrongDelivery: 6, // player delivered >= 85%
  bonusHighIntercept: 5, // player intercepted > 70% of missiles
  bonusRichConvoy: 4, // convoy value > 1.3x baseline
  /** Track unlock thresholds. */
  guidanceUnlock: 25,
  minesUnlock: 40,
  lowSigUnlock: 60,
  /** Scripted floors guarantee the designed beats (track >= floor after the
   *  given round resolves). Compressed so the ramp bites by round 2-3:
   *  guided missiles debut round 2, mines round 3. */
  floors: [
    { afterRound: 1, track: 'guidance', value: 25 }, // guided by R2
    { afterRound: 2, track: 'mines', value: 40 }, // mines by R3
    { afterRound: 3, track: 'mines', value: 48 },
  ] as const,
  /** Fairness: first-appearance caps. */
  firstGuidedCap: 3,
  firstMinefieldCap: 4,
  firstLowSigCap: 3,
  /** Missile VOLUME is a controlled total count (scales with round + doctrine),
   *  but it is spread across the WHOLE transit — from windowStartT until the
   *  last ship is expected to clear — so the enemy keeps firing to the end and
   *  there are no long silent gaps. Volleys still cluster launches. */
  missileCountBase: 5,
  missileCountPerRound: 2,
  missileCountSat: 0.18,
  missileCountCap: 46,
  volleySatDivisor: 24,
  windowStartT: 6,
  /** Extra seconds after the last ship enters, so fire covers it crossing. */
  windowTailT: 60,
  /** Mine volume once unlocked. */
  mineBase: 3,
  mineTrackDivisor: 10,
  mineCap: 10,
  /** Warning when a locked track is within this distance of its unlock. */
  warningProximity: 12,
} as const;

export const ROUND1 = {
  /** Round 1 is a scripted, winnable onboarding: a light unguided probe. */
  missileCount: 6,
} as const;
