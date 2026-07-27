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
  /** Wide/staggered pace: one ship enters, alternating lanes, every this many
   *  seconds. Keeps the map uncluttered — the stream is sparse and readable. */
  interval: 5.0,
  /** Sprint pace: within a volley, one ship enters this often (back to back). */
  sprintInterval: 2.8,
  /** Sprint: min/max ships in one single-file volley before the column
   *  relocates to a different lane. */
  sprintVolleyMin: 3,
  sprintVolleyMax: 6,
  /** Sprint: pause after a volley's LAST ship before the next volley's first
   *  ship enters (in the new lane) — longer than the in-volley spacing so the
   *  lane switch reads clearly. */
  sprintVolleyGap: 5.0,
  /** Tight pace: a whole wave (one ship per lane) enters this often. */
  tightWaveInterval: 5.5,
  /** Tiny spread within a Tight wave so the group reads as "together" without
   *  perfectly stacking. */
  tightWaveJitter: 0.25,
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
  guided: {
    speed: 50,
    damage: 46,
    hitRadius: 30,
    turnRate: 1.4,
    baseHitChance: 0.92,
    /** Subtracted from a player weapon's accuracy when the target is a guided
     *  (evading) missile — the enemy node property, not a weapon stat. */
    accuracyPenalty: 0.16,
  },
  mine: { damage: 115, triggerRadius: 30 },
  /** Torpedoes: the UNDERWATER branch (ENEMY_ATTACKS.md). Launched from the
   *  hostile shore, immune to interceptors/ECM/point-defense by design — the
   *  whole point is that every air-defense investment is useless here.
   *  Slower than a missile, so there is time to react IF you can see it. */
  torpedo: {
    speed: 46,
    damage: 90,
    hitRadius: 22,
    /** Homing torpedoes correct toward their target at this rate (rad/s) —
     *  deliberately lazier than a guided missile's 1.4, so a course change can
     *  still shake one. */
    turnRate: 0.7,
    /** Straight and homing torpedoes leave a WAKE: any active hull within this
     *  distance reads it off the water with no equipment at all. A hydrophone
     *  earns its slot by seeing them much further out; the low-signature node
     *  leaves no wake, so unaided crews never see it coming. */
    wakeVisibleRange: 230,
  },
  /** Attack boats: the SURFACE branch (ENEMY_ATTACKS.md). Unlike every other
   *  threat these are persistent, sinkable UNITS, not committed projectiles.
   *  A boat closes with the convoy, commits to one hull, and stays on it until
   *  that hull is gone — so the player is killing the shooter, not the shot,
   *  and a boat left alive keeps earning. That is why they need their own
   *  weapon: interceptors point at the sky and cannot help here at all. */
  attackBoat: {
    /** Faster than any cargo hull so a boat can always close and hold station,
     *  but far slower than a missile — there is time to shoot back. */
    speed: 64,
    /** Standoff it holds once committed. Comfortably inside deck-gun reach
     *  (medium tier 420) so fielding the counter always gets a shot. */
    engageRange: 150,
    /** Contact radius for the boarding grapple. */
    boardRange: 46,
    /** Hull points per variant. Small-arms dies to ~3 medium deck-gun rounds
     *  (12 damage each), matching "sunk by ~3 anti-boat rounds". Rocket and
     *  boarding hulls are tougher AND take half damage until Armor-Piercing is
     *  researched — that node is what keeps them killable. */
    hp: { smallArms: 34, rocket: 46, boarding: 40 },
    /** Damage per second poured into the committed hull. Tuned against the
     *  design's times-to-sink on a 100hp cargo ship: small-arms ~30s,
     *  rocket ~20s. Boarding boats deal no damage — they take the ship. */
    dps: { smallArms: 3.4, rocket: 5, boarding: 0 },
    /** Sustained contact a boarding boat needs before the hull is captured. */
    boardingSeconds: 15,
    /** Pause after a kill before committing to the next hull. This is the main
     *  brake on a single boat: at the design's ~30s per hull an unopposed boat
     *  would otherwise chain-sink five ships in one transit, which no price
     *  could honestly cover. Modelling the reposition as a real gap caps it
     *  nearer three and leaves the player a window to answer.
     *
     *  Measured, not guessed: at 10s a sweep put boats at 43% of all losses
     *  with every build collapsing by round 11, even builds carrying the deck
     *  gun. Two hulls per boat per transit is the ceiling this branch can be
     *  worth at its price. */
    retargetDelay: 20,
    /** Seconds a captured hull takes to steer off toward the hostile shore
     *  before it leaves the board — long enough to read what happened. */
    captureExitSeconds: 6,
  },
  /** Artillery: the SHORE-GUN branch (ENEMY_ATTACKS.md). Direct fire from fixed
   *  emplacements. There is no arc to tap out of the sky, so a shell is not an
   *  interceptable projectile — shells live in their own array rather than in
   *  `threats`, which is what structurally guarantees no weapon can ever be
   *  pointed at one. The answers are counter-battery suppression and simply not
   *  sailing where the guns reach.
   *
   *  RANGE IS THE WHOLE DESIGN. The lanes sit 270 / 450 / 630 from the hostile
   *  shore, so a coastal gun reaches only the near lane and ranging artillery
   *  only the near two. Lane choice is therefore a real decision rather than a
   *  cosmetic one, and it is also where the T2 nearest-to-shore doctrine this
   *  branch grants comes from — the gun's reach IS the doctrine. */
  artillery: {
    /** Direct fire: fast enough that a shell cannot be outrun, slow enough to
     *  read as a tracer crossing the water. */
    shellSpeed: 430,
    range: { coastalGun: 330, ranging: 520, rollingBarrage: 330 },
    /** Per the design's times-to-sink on a 100hp hull: ~8 coastal hits, ~5
     *  ranging hits. A barrage fires coastal-weight shells in bulk. */
    damage: { coastalGun: 13, ranging: 21, rollingBarrage: 13 },
    reload: { coastalGun: 2.2, ranging: 4.2, rollingBarrage: 0.55 },
    /** Shells burst at their aim point and damage what is near it — artillery
     *  is an area weapon, so it never "homes" onto a hull. */
    splashRadius: 46,
    /** Aim scatter at the impact point. Fire is inaccurate by default; that is
     *  what makes holding still, rather than being in the lane at all, the
     *  thing that gets punished. */
    scatter: { coastalGun: 44, ranging: 38, rollingBarrage: 40 },
    /** Ranging artillery WALKS onto a hull that holds its position: every
     *  consecutive shell at the same ship tightens the aim, and changing lane
     *  or falling out of the salvo resets it. Loitering in reach is the
     *  mistake this node exists to punish. */
    walkTightening: 0.72,
    walkMinScatter: 9,
    /** Rolling barrage: a salvo of shells sweeping along one lane, then a long
     *  pause. Readable as a wall of fire moving up the lane. */
    barrageShells: 12,
    barrageInterval: 26,
    /** How far the salvo walks. Kept SHORT relative to the convoy's length so
     *  the twelve rounds concentrate on one stretch of lane — a barrage spread
     *  thin lands eight hits across eight different hulls and kills none of
     *  them, which is what a 340-unit sweep measured. */
    barrageSweep: 190,
  },
  /** Enemy smoke: the CONCEALMENT branch (ENEMY_ATTACKS.md). It deals no damage
   *  at all — it denies the player's eyes, which shrinks the reaction window on
   *  every other branch at once.
   *
   *  The interaction model is the LOCKED soft one: a threat in cloud keeps a
   *  faint bearing marker so the player can still tell something is coming from
   *  over there, but loses its precise tap-target until it clears. Never fully
   *  hidden — that would be too punishing in a tap-to-target game. */
  enemySmoke: {
    radius: 210,
    seconds: 34,
    /** Screening smoke sits over the launch sites, stealing reaction time at
     *  the moment of launch; blinding smoke sits over the convoy itself. */
    screeningOffsetY: 40,
    /** Blinding smoke also degrades missile-warning cues inside it, so the
     *  assisted-targeting the player paid for stops helping in the cloud. */
    warningDegradation: 0.6,
  },
  /** Electronic attack and drones: the SUPPORT branch. Mostly does not sink
   *  ships — it degrades the player's systems. */
  electronic: {
    /** Recon plane: crosses the map and drags interceptor accuracy down for as
     *  long as it is alive. Shooting it down is the counter, and the player has
     *  to be quick because it is only overhead for one crossing. */
    reconSpeed: 92,
    reconAccuracyPenalty: 0.22,
    reconHp: 20,
    /** Disabling drone: flies to one hull and leaves it dead in the water — a
     *  static target for everything else on the board. Shootable en route. */
    droneSpeed: 118,
    droneHp: 14,
    droneDisableSeconds: 30,
    /** Sensor jamming: an ABILITY, not an object. Blacks out mine detection and
     *  cannot be shot down — the one node in the whole design with no counter,
     *  only work-arounds (hardened channels, reboots, routing). Played once at
     *  the round's start so its cost is always visible up front. */
    jammingSeconds: 30,
    jammingStartT: 6,
  },
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
   *  fast reload and being able to move with the convoy, not velocity.
   *  Speed/accuracy/reload are tier-resolved (statTiers + counters); only the
   *  physical launch envelope lives here. */
  interceptor: {
    /** Max launch range from an escort to the target threat. */
    range: 780,
  },
  /** Fixed shore battery: engages any missile on the map (unlimited range),
   *  but reloads far slower than an escort. The player's baseline defense.
   *  A missile strike knocks it offline for disableSeconds and does hull
   *  damage; enough strikes destroy it (hardened, so it takes a lot).
   *  Interceptor speed/accuracy/reload are tier-resolved. */
  base: {
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
  /** Cargo self-defense interceptor module: a per-ship close-in tracer. It is
   *  a limited magazine, NOT a free auto-turret — the per-round magazine,
   *  range and accuracy are tier-resolved; only the between-shot cycle time
   *  lives here (matters once the dual-shot node grants a second round). */
  selfDefense: {
    cooldown: 1.3,
  },
  /** Depth-charge round ballistics (the launcher's range/blast/reload are
   *  tier-resolved). A lobbed area weapon: it flies to the tapped point and
   *  detonates — it never locks on. */
  depthCharge: {
    flightSpeed: 150,
    /** Pattern-salvo: extra charges dropped in a short line, this far apart. */
    patternSpacing: 55,
    patternCount: 3,
  },
  /** ECM plane: flies to a water station, orbits jamming inbound missiles —
   *  any missile that lingers inside the orbit `explodeSeconds` cooks off — then
   *  departs. Charges/radius/duration are tier-resolved (ability paths). */
  ecm: {
    /** Seconds a missile must spend inside the jamming orbit before it explodes. */
    explodeSeconds: 3.2,
    /** Cruise speed of the ECM plane. */
    planeSpeed: 240,
    /** Orbit angular speed (radians/second). */
    orbitRate: 1.1,
    /** Radius the plane flies around the orbit center. */
    orbitRadius: 80,
    /** Water band the orbit center must sit inside (off both shores/launchers). */
    waterYMin: 150,
    waterYMax: 860,
  },
  /** Scan plane: flies down the player-selected lane charting mines in THAT lane
   *  only, then leaves. Charges/reveal radius are tier-resolved; the charted
   *  band scales with the resolved reveal radius. */
  scan: {
    /** Cruise speed of the scan plane across the map. */
    planeSpeed: 520,
    /** Half-width of the lane band the plane can chart at the BASE reveal
     *  radius (scales proportionally with the expanded-coverage path). */
    laneHalfWidth: 95,
    baseRevealRadius: 130,
  },
  /** Minesweeper drone: the player TAPS a charted mine to send a drone from
   *  the nearest escort with a drone launcher. Launch range/speed/reload are
   *  tier-resolved; only the sweep contact distance lives here. */
  sweepDrone: {
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
  /** Point-defense rounds in stock at campaign start (turrets are useless
   *  without them, but the module also has to be researched/bought first). */
  startPdAmmo: 0,
  /** One shore battery to start; no free escort. */
  startBases: 1,
  startEscorts: 0,
  /** Cash earned per point of cargo value delivered. */
  cashPerValue: 4,
  /** Fraction of a lost hull's replacement cost the consortium underwrites.
   *
   *  This is the anti-snowball restoring force on the CASH axis, and without it
   *  there wasn't one. SEESAW.md promises the seesaw returns to center from both
   *  ends, but every mechanism for the losing side acted on something else:
   *  `dampStruggling` trims the ENEMY's budget, and `intelPerLoss` pays research
   *  currency. Neither helps an operator who cannot afford to sail — and that is
   *  what actually ends these campaigns.
   *
   *  A cargo hull earns 40 on delivery and costs 80 to replace, so the fleet
   *  breaks even at a **33% loss rate** and shrinks irreversibly above it: fewer
   *  hulls deliver less, less delivered buys fewer hulls. Traced across a sweep,
   *  every collapse ran the same three rounds — ~700 cash and 20 hulls, then
   *  ~250 and 7, then dead — and nothing in the game pulled back. Underwriting
   *  half the replacement moves break-even to 50%, so losing half a convoy is a
   *  bad round rather than a death sentence.
   *
   *  Self-limiting by construction: it pays in proportion to what the player is
   *  losing, so a player who is winning collects almost nothing. */
  lossInsurance: 0.5,
  ammoCost: 8,
  /** Cash per minesweeper-drone munition, and how many a single purchase buys. */
  droneAmmoCost: 14,
  droneAmmoPerBuy: 3,
  /** Cash per point-defense round, and how many a single purchase buys. */
  pdAmmoCost: 12,
  pdAmmoPerBuy: 3,
  /** Module refits price on OWNED hulls of the class (exploit-proof — see
   *  moduleCost), but a flat per-ship rate would make a late-campaign refit
   *  balloon into many thousands of cash as the fleet grows past 30+ hulls.
   *  Ships up to this count are billed at the full per-ship rate; ships beyond
   *  it are billed at moduleCostTaperRate of that rate, so a big fleet can
   *  still afford SOME upgrades without every refit consuming the whole
   *  treasury. */
  moduleCostSoftCap: 12,
  moduleCostTaperRate: 0.25,
  baseCost: 300,
  maxBases: 4,
  escortCost: 600,
  maxEscorts: 3,
  ecmUnlockCost: 150,
  scanUnlockCost: 150,
  sonarUnlockCost: 160,
  smokeUnlockCost: 160,
  hardenedUnlockCost: 160,
  /** Cash per hp of hull repair. */
  repairCostPerHp: 0.6,
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
  /** Extra confidence lost per hull TAKEN by a boarding party, on top of the
   *  ordinary loss penalty and outside its cap. A captured ship is a worse
   *  outcome than a sunk one — the cargo is in enemy hands rather than on the
   *  seabed — and putting it outside the cap is what stops "absorb the losses
   *  and push through" from answering the boarding node (ENEMY_ATTACKS.md). */
  confidencePerCapture: -7,
  confidenceCaptureCap: -21,
  confidenceQuotaMet: 10,
  confidenceQuotaMissed: -18,
  /** Floor on ordinary confidence lost in ONE round (captures excluded).
   *
   *  A bad round (-5), the loss cap (-12) and a missed quota (-18) all describe
   *  the same disaster and all land together, for -35 against a starting 60.
   *  Two of those ended a campaign from full health with no round in between
   *  where the player could read the danger and answer it — measured, every
   *  collapse in a sweep ran the same three rounds from healthy to dead. The
   *  floor keeps a disaster the worst thing that can happen while leaving rounds
   *  to recover in, which is what makes the seesaw a seesaw rather than a cliff.
   *
   *  Captures sit outside it, as they sit outside the loss cap: absorbing losses
   *  must never become the answer to the boarding node. */
  confidenceRoundFloor: -22,
  /** Quota: value points required per 3-round window. The FIRST window's
   *  target is fixed (startCapacity * quotaPerCapacity); every window after
   *  that is DYNAMIC — sized from the player's own recent output rather than a
   *  flat increment, so it scales with how well the player is actually doing
   *  instead of drifting trivially far behind a growing fleet (too easy) or
   *  outrunning a struggling one (too punishing). See resolveTransit. */
  quotaWindowRounds: 3,
  quotaPerCapacity: 24, // initial window: startCapacity * this
  /** Next window's target = (this window's avg value delivered per round) *
   *  quotaWindowRounds * quotaDifficulty. */
  quotaDifficultyStart: 1.0,
  quotaDifficultyMin: 0.65,
  quotaDifficultyMax: 1.6,
  /** Difficulty ratchets up on an easy clear (big surplus) and down on a miss
   *  (big shortfall) — a standard rubber-band. Each step is scaled by how far
   *  over/under the target the window landed, capped at the constant below. */
  quotaDifficultyUpStep: 0.1,
  quotaDifficultyDownStep: 0.16,
  /** Hard floor so a single bad round can't trivialize the next quota:
   *  pointsNeeded never drops below capacity * this. */
  quotaFloorPerCapacity: 8,
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
  /** Stretch of hostile shore the enemy emplaces artillery along. Kept clear of
   *  the convoy's entry so the first guns are something the player sails toward
   *  and can route around, not an ambush at the start line. */
  gunFieldStartX: 620,
  gunFieldEndX: 1620,
  /** Hard ceiling on the spacing between missile volleys (seconds): fire is
   *  split into enough volleys that no gap in the schedule exceeds this, even
   *  when the volley size is large. Keeps the strait from going quiet. */
  maxVolleyGap: 12,
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

/**
 * The enemy procurement economy (docs/SEESAW.md).
 *
 * The enemy receives war funds each round, must commit them at the start of
 * the round, and scraps whatever it cannot spend — exactly like the player's
 * prep phase. What it BUYS is driven by return on investment per branch, which
 * is what makes the seesaw real: a branch the player counters stops paying,
 * so the enemy pivots to one they haven't.
 *
 * Tune difficulty HERE — `budgetPerRound` is the primary dial — rather than in
 * attack mechanics or unit prices. Prices belong to enemyBranches.ts and are
 * set from measured lethality so the allocator's choice between branches is a
 * real one; this curve is what decides how much of that arsenal it can afford.
 *
 * The two move together. Repricing the catalogue against measured cost-per-kill
 * raised the average price of a kill about 2.3x, which by itself handed the
 * player a much easier game (round-cap completions jumped from a third to two
 * thirds of campaigns). The curve was scaled to match, so the repricing landed
 * as a change of BRANCH BALANCE rather than a change of difficulty.
 */
export const ENEMY_ECONOMY = {
  /** War funds = base + perRound × round, before modifiers.
   *
   *  Scaled again when smoke and electronic attack went from priced-but-dead to
   *  genuinely funded. Seven branches drawing on a budget sized for five makes
   *  every branch poorer, and it showed where it always shows: mines could no
   *  longer afford a low-signature variant out of their escalation fraction in
   *  EITHER arm of the counter test, so the player's counter stopped changing
   *  what the enemy built. Breadth has to be paid for or it is taken out of the
   *  ladders.
   *
   *  Paid for SPARINGLY, though. Raising the curve far enough to restore that
   *  signal by budget alone took round-cap completions from 34 campaigns in 72
   *  down to 15 in 80, and left every build except the two economic ones
   *  unviable. Most of that work is done by escalationPatienceCounteredRounds
   *  instead — the enemy climbs its ladder sooner when the player counters it,
   *  rather than being handed more money to climb with. */
  budgetBase: 50,
  budgetPerRound: 63,
  /** Hard ceiling so a long campaign can't run away. Scales with prices: at the
   *  old 900 this bought ~32 mines, at current prices barely 12. */
  budgetCap: 1200,

  /** Anti-snowball, applied as multipliers to the round's budget. Success arms
   *  the enemy faster; a struggling player gets breathing room. Both ends
   *  matter — the restoring force has to work in both directions. */
  bonusStrongDelivery: 0.12, // player delivered >= 85%
  bonusHighIntercept: 0.1, // player intercepted > 70% of missiles
  dampStruggling: 0.2, // player delivered < 55% -> budget reduced by this

  /** Enemy ordnance scales with the convoy value actually sailing, measured
   *  against the campaign's first convoy. Replaces a one-off "rich convoy"
   *  threshold bonus, which was far too coarse for what it was guarding.
   *
   *  Without proportional scaling the enemy fires roughly the same volume
   *  whatever sails, so growing the convoy simply DILUTES incoming fire.
   *  Measured, going from 6 hulls to 40 took missiles-per-hull from 4.13 to
   *  0.85 and lifted delivery from 63% to 91%. That made convoy size the best
   *  defensive stat in the game — while also being the scoring stat, so buying
   *  hulls beat buying defense on both axes simultaneously. Every build that
   *  spent on defense delivered WORSE than the greed build that spent almost
   *  nothing: defense share and value-per-round were near-perfectly inversely
   *  correlated across nine builds.
   *
   *  With it, a bigger convoy earns more and draws more, which is the trade-off
   *  the choice was always supposed to be. The floor is deliberately shallow —
   *  sailing light should be a smaller target, but never a free pass. */
  convoyScalePerRatio: 1.0,
  convoyScaleMin: -0.5,
  convoyScaleMax: 1.0,
  /** Convoy value the scaling above is measured against — the designed opening
   *  convoy (15 cargo + 3 tankers + 2 freighters = 241).
   *
   *  A FIXED reference, deliberately. Measuring against the campaign's own
   *  first convoy makes the ratio self-cancelling: a player who starts big and
   *  stays big reads as 1.0 forever and never draws the extra ordnance, which
   *  is exactly the build the scaling exists to price. Tried that way first and
   *  it moved missiles-per-hull by 0.02. */
  convoyValueBaseline: 241,

  /** Compounding pressure on a player who keeps walking through untouched.
   *
   *  The flat bonuses above fire readily — strong delivery hit 71% of rounds
   *  across a sweep — but a fixed +12% never moved a build sitting at 94%
   *  delivery. Measured, 56% of ALL rounds finished above 90% delivered while
   *  the healthy band is 60-90%, and the builds that lived in the band were
   *  precisely the ones that died. Survival and being-in-band were
   *  anticorrelated: you dominated or you collapsed, which is the bimodal
   *  distribution SEESAW.md's Balance signal had been failing on for four
   *  slices running.
   *
   *  A streak bonus fixes what a flat one cannot, because it keeps growing
   *  until it bites and then releases the round the player drops back into the
   *  band. It is the mirror of ECONOMY.lossInsurance at the other end of the
   *  seesaw — one scales with how badly the player is losing, this with how
   *  long they have been winning, and both stop the moment the fight is even
   *  again. */
  dominanceFraction: 0.85,
  dominanceStreakStep: 0.06,
  dominanceStreakMax: 0.33,

  /** ROI = result ÷ spend, where result weights a kill far above chip damage
   *  (sinking hulls is the point; scratching paint is not). */
  roiKillWeight: 10,
  roiDamageWeight: 0.04,
  /** A captured ship hurts more than a sunk one (ENEMY_ATTACKS.md), so it is
   *  worth more ROI when the boarding node lands. */
  roiCaptureWeight: 16,
  /** Share of a hit's damage credited to the SUPPORT branch that enabled it.
   *
   *  Smoke and electronic attack deal no damage and take no hulls — their whole
   *  identity is multiplying the other branches. Scored on damage-and-kills
   *  alone they measure exactly zero, the allocator defunds them on the first
   *  settlement, and two of the seven branches become dead content no matter
   *  what they cost. So a hit that landed on a hull the player could not see,
   *  or could not detect, or that was sitting disabled in the water, pays the
   *  branch that arranged it. The credit is an ADDITION, not a transfer: the
   *  branch that actually fired still gets its full result, because both of
   *  them genuinely contributed to that hull being hit. */
  assistShare: 0.35,

  /** How fast allocation chases ROI. Shares are blended toward the ROI-implied
   *  target so a pivot takes 1-2 rounds — visible, not instant. */
  allocationLag: 0.5,
  /** Share of every budget reserved to probe the branch the enemy has leaned
   *  on least, so it keeps hunting for the player's blind spot instead of
   *  converging forever on one line. */
  explorationShare: 0.15,
  /** A branch's share never falls below this while it is open, so nothing is
   *  permanently abandoned (it stays available to become attractive again). */
  minBranchShare: 0.05,
  /** ROI assumed for a branch with no track record yet, so an untried branch
   *  looks worth a first attempt. */
  priorRoi: 1.0,

  /** Fraction of a branch's budget spent on its newest available node, rising
   *  with sustained investment: a branch the player ignores doesn't just
   *  repeat, it deepens. */
  escalationShareBase: 0.25,
  escalationSharePerRound: 0.08,
  escalationShareMax: 0.7,
  /** Extra escalation pressure when the player is hard-countering the branch's
   *  current node (high intercept rate → guided; high mine detection →
   *  low-signature; heard-and-killed torpedoes → wakeless). This is the node
   *  ladder answering the player's counter, so it is applied ON TOP of the
   *  tenure clamp above and gets its own, higher ceiling — otherwise a branch
   *  the enemy has run for several rounds sits at escalationShareMax already
   *  and the counter signal disappears. The ceiling stays below 1 so the base
   *  node keeps supplying volume alongside the expensive variant. */
  counteredEscalationBonus: 0.25,
  escalationShareCounteredMax: 0.9,
  /** Rounds a gated node may sit unbought before the branch buys one outright
   *  from its full allowance instead of from the escalation fraction.
   *
   *  The fraction rounds down to zero units whenever a node costs more than a
   *  whole round's allowance, which is a property of the PRICE, not of the
   *  round — so without this, seven implemented nodes were unreachable across
   *  an entire sweep no matter how long campaigns ran. The patience matters as
   *  much as the rule: firing it immediately makes every branch debut its next
   *  rung the round it gates, which erases the timing difference the player's
   *  counter is supposed to create. These rounds are that window.
   *
   *  This is only the REACHABILITY floor — it guarantees no implemented node is
   *  dead content at any budget. A branch the player is actively countering
   *  does not wait for it: that branch lifts its earmark to its newest variant
   *  every round it can afford one, which is the counter signal proper. Keeping
   *  the two rules separate is what let the ladders open up without handing the
   *  enemy more money, and more money was measured to cost the player two
   *  thirds of its round-cap completions. */
  escalationPatienceRounds: 4,

  /** Scripted debuts guarantee the designed early beats regardless of what the
   *  ROI allocator would otherwise prefer (ENEMY_ATTACKS.md: "first appearances
   *  are capped and warned"). Minimum units fielded on that round. */
  scriptedDebuts: [
    { round: 2, branch: 'missiles', node: 'guided', minUnits: 1 },
    { round: 3, branch: 'mines', node: 'standard', minUnits: 3 },
  ] as const,

  /** An intel warning fires this many rounds before a node's gate opens. */
  warningLeadRounds: 1,
} as const;
