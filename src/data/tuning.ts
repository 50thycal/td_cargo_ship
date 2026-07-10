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
  /** Lane-change lateral speed in units/second. */
  laneChangeSpeed: 45,
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
  /** Minimum along-track gap, expressed as a multiple of the longer ship's
   *  hull length — "about two ship lengths" of clear water between hulls. */
  gapLengths: 2,
  /** Absolute floor so small hulls are never unrealistically close. */
  minGapFloor: 40,
  /** Lateral correction speed (world units/second) ships use to settle onto
   *  their lane target — independent of forward transit speed. */
  lateralCorrectionSpeed: 34,
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
  startCash: 400,
  startIntel: 0,
  startAmmo: 12,
  startEscorts: 1,
  /** Cash earned per point of cargo value delivered. */
  cashPerValue: 4,
  ammoCost: 15,
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
  basePoints: 8,
  pointsPerRound: 2,
  bonusStrongDelivery: 5, // player delivered >= 85%
  bonusHighIntercept: 4, // player intercepted > 70% of missiles
  bonusRichConvoy: 3, // convoy value > 1.3x baseline
  /** Track unlock thresholds. */
  guidanceUnlock: 30,
  minesUnlock: 30,
  lowSigUnlock: 45,
  /** Scripted floors guarantee the designed early beats (track >= floor
   *  after the given round resolves), regardless of player behavior. */
  floors: [
    { afterRound: 2, track: 'guidance', value: 30 }, // guided missiles by R3
    { afterRound: 3, track: 'mines', value: 18 },
    { afterRound: 4, track: 'mines', value: 30 }, // mines by R5 at latest
  ] as const,
  /** Fairness: first-appearance caps. */
  firstGuidedCap: 2,
  firstMinefieldCap: 4,
  firstLowSigCap: 3,
  /** Missile volume: count = base + saturation / divisor. */
  missileBase: 3,
  missileSaturationDivisor: 10,
  missileCap: 18,
  /** Mine volume once unlocked. */
  mineBase: 4,
  mineTrackDivisor: 8,
  mineCap: 12,
  /** Warning when a locked track is within this distance of its unlock. */
  warningProximity: 12,
} as const;

export const ROUND1 = {
  /** Round 1 is a scripted, winnable onboarding: few slow missiles. */
  missileCount: 4,
} as const;
