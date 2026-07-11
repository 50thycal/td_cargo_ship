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
  maxTransitTime: 300,
  /** Seconds of reduced cohesion after a formation change. */
  reformSeconds: 4,
} as const;

export const SPAWN = {
  /** Delay before the very first ship enters the corridor. */
  firstDelay: 1.0,
  /** Nominal delay between two ships entering the SAME lane — this is what
   *  makes spawning scalable: total spawn duration grows linearly with
   *  convoy size (roughly (n / lanes) * perLaneInterval) without any change
   *  to the scheduling logic itself, whether the convoy is 20 ships or 45. */
  perLaneInterval: 3.2,
  /** Random +/- applied on top of the nominal cadence so the stream doesn't
   *  arrive on a metronome. */
  timeJitter: 0.8,
  /** Hard floor on the gap between two ships entering the same lane, even
   *  after jitter — keeps entrances from ever bunching up. */
  minGap: 1.1,
  /** Persistent per-ship pace variance, +/- this fraction of class speed. */
  speedVariance: 0.05,
} as const;

export const SPACING = {
  /** Minimum CLEAR WATER between two hulls, as a multiple of the longer ship's
   *  length — "about two ship lengths." Center-to-center distance adds both
   *  half-lengths on top, so hulls stay visibly separated. */
  gapLengths: 2,
  /** Absolute floor on centre-to-centre spacing for the smallest hulls. */
  minGapFloor: 70,
  /** Max turn rate (radians/second) — how sharply a ship can change heading.
   *  Lane changes are arcs at constant speed, never sideways drift. */
  turnRate: 0.9,
  /** How far ahead (world units) a ship aims when steering toward its lane;
   *  larger = gentler, more anticipatory turns. */
  lookahead: 70,
  /** Lateral band (world units) within which a ship ahead counts as "in my
   *  path" for following / passing decisions. */
  passBand: 46,
  /** Maximum lateral offset a ship will take to overtake a slower one. */
  maxOvertakeOffset: 62,
  /** How fast the overtake offset builds toward / relaxes from its target. */
  overtakeLerp: 2.4,
  /** Follow zone: once a gap opens beyond gapNeeded by this much, the follower
   *  may return to full speed; between the two it matches the leader. */
  followEase: 90,
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
  interceptor: {
    speed: 115,
    /** Max launch range from an escort to the target threat. */
    range: 780,
    cooldown: 3.2,
    hitChanceVsMissile: 0.82,
    hitChanceVsGuided: 0.66,
  },
  /** Fixed shore battery: engages any missile on the map (unlimited range),
   *  but reloads far slower than an escort. The player's baseline defense. */
  base: {
    reload: 4.5,
    speed: 105,
  },
  pointDefense: {
    radius: 95,
    cooldown: 1.3,
    killChanceVsMissile: 0.5,
    killChanceVsGuided: 0.33,
  },
  ecm: { durationSeconds: 9, guidedHitChance: 0.2, chargesPerRound: 2 },
  scan: { radius: 460, sweepRadius: 300, chargesPerRound: 2, lowSigRevealChance: 0.35 },
  mineSonarRadius: 240,
  /** Ships auto-steer around revealed mines within this look-ahead range. */
  mineAvoidLookahead: 130,
  mineAvoidOffset: 70,
} as const;

export const ECONOMY = {
  startCash: 450,
  startIntel: 0,
  startAmmo: 24,
  /** One shore battery to start; no free escort. */
  startBases: 1,
  startEscorts: 0,
  /** Cash earned per point of cargo value delivered. */
  cashPerValue: 4,
  ammoCost: 10,
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
  confidenceGoodRound: 4, // >= 75% delivered
  confidenceBadRound: -5, // < 60% delivered
  confidencePerLoss: -3,
  confidenceLossCap: -15, // max penalty from losses in one round
  confidenceQuotaMet: 10,
  confidenceQuotaMissed: -25,
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
  /** Missiles are NOT capped by a per-round count. The enemy fires at a rate
   *  (missiles/minute) that scales with round and its saturation doctrine, and
   *  keeps firing across a window sized to the convoy — so as long as ships are
   *  in the strait, more missiles come. Volleys still cluster launches. */
  missileBaseRate: 4,
  missileRoundRate: 1.8,
  missileSatRate: 0.08,
  missileRateMax: 20,
  volleySatDivisor: 24,
  windowStartT: 6,
  windowBaseT: 34,
  windowPerShipT: 3.2,
  windowMaxT: 150,
  /** Safety backstop only — far above any intended round volume. */
  spawnHardCap: 180,
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
