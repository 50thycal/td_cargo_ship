// Central gameplay tuning. Every balance number lives here or in the sibling
// data files — never hard-coded inside sim logic — so playtesting iterations
// are config edits, not code changes.

/**
 * The strait. DOUBLED in both dimensions from 2000x1000.
 *
 * The old world was exactly the shape of a phone in landscape, so the camera's
 * fit-zoom showed all of it and there was nowhere to pan TO — the map was the
 * screen. Twice the water gives the fight somewhere to happen: room to work a
 * flank, room for the convoy to be strung out with parts of it off screen, and
 * a reason for the zoom control to exist. The shores are deeper than a straight
 * doubling as well, so neither coast is a thin strip at the edge of the frame.
 *
 * Note this only produces panning room in combination with the camera's minimum
 * zoom (see camera.ts): a bigger world at a fit-to-window floor is not a bigger
 * map, it is the same map drawn smaller.
 */
export const WORLD = {
  width: 4000,
  height: 3375,
  /** Ships are delivered once past this x. */
  deliverX: 3880,
  /** Convoy spawns with its lead ships around this x. */
  spawnX: 80,
  /** THE COASTLINES.
   *
   *  These exist because the renderer and the sim each used to carry their own
   *  idea of where the land was — the friendly coast was drawn at
   *  `height - 100` while shore batteries were placed at `baseLine`, and the
   *  two agreed only by luck. When the map was resized they stopped agreeing
   *  and the batteries stood 140 units out to sea. One number each, used by
   *  both, so that cannot happen again.
   *
   *  Water runs between them; land is above hostileShoreY and below
   *  friendlyShoreY. Both coasts undulate by +/- shoreWave around these lines,
   *  so anything that must sit ON land needs that much clearance. */
  /** DEEPENED so each shore is about as thick as the strait is wide, rather
   *  than the third of it they were.
   *
   *  This is not scenery. The strait is a horizontal band across the middle of
   *  the screen, so when the camera is on the convoy the top and bottom of the
   *  viewport are exactly where the HUD sits — and with a thin shore, missiles
   *  inbound from the hostile coast spent their first seconds underneath the
   *  status bar. Deep land means there is somewhere to pan to that puts the
   *  launch sites in clear view. The camera is NOT expected to show all of it
   *  at once; it is buffer, and buffer only has to exist to be useful. */
  hostileShoreY: 1125,
  friendlyShoreY: 2250,
  /** Amplitude of the drawn coastline's meander, either side of the lines
   *  above. Anything placed on land must clear it. */
  shoreWave: 45,
  /** Y centers of the three transit lanes (north / center / south), spread
   *  across the water between the two coasts. */
  lanes: [1405, 1685, 1965],
  /** Hostile shore: launch sites sit along it, well inland of the coastline so
   *  they read as emplacements on land rather than rafts. */
  launchSites: [
    { x: 700, y: 985 },
    { x: 1800, y: 955 },
    { x: 2900, y: 985 },
  ],
  /** Friendly shore: shore batteries launch interceptors from here. Inland of
   *  friendlyShoreY by more than shoreWave, so a battery is never in the sea at
   *  any point along the coast. */
  baseLine: 2385,
  /** The world size every hard-coded SPRITE pixel size is authored against.
   *
   *  The renderer draws the world at a base scale and magnifies it with one
   *  canvas transform, so a hull length written as "10 pixels" is really
   *  10 / baseScale world units — which means the base scale decides how big a
   *  ship IS out on the water. When that base was simply "fit the whole world
   *  in the window", growing the world silently grew every sprite with it:
   *  deepening the shores took a third off the fit zoom, every hull swelled
   *  half again in world units while the lanes stayed put, and the convoy
   *  read as oversized ships crammed into a shrunken strait. Anchoring the
   *  base scale to THIS fixed reference instead means land can be added
   *  forever and a ship stays the size a ship has always been. */
  spriteReference: { width: 4000, height: 2250 },
} as const;

export const SIM = {
  /** Fixed timestep (seconds). The sim only ever advances in these steps. */
  dt: 1 / 30,
  /** Absolute backstop on transit length (seconds) — a guard against a round
   *  that can never resolve, not a design lever. The round's REAL limit is
   *  computed from the convoy that is sailing (see transitTimeLimit).
   *
   *  This used to be a flat 360 and it was also the effective limit, because
   *  every convoy finished entering well inside it. Doubling the entry spacing
   *  broke that assumption: a large convoy now spends minutes just arriving,
   *  and a flat cap silently drowned the tail of it — measured, one loss in
   *  five across a sweep became "lost at sea" with nothing having shot at it. */
  maxTransitTime: 1500,
  /** Floor on a round's time limit, so a tiny convoy still gets a real round. */
  minTransitTime: 430,
  /** Time allowed AFTER the last hull enters for the convoy to clear the
   *  strait. The crossing itself is about 90 seconds for the slowest class;
   *  the rest is room for the avoidance, give-way and mine-dodging that a
   *  contested transit actually involves.
   *
   *  SCALED with the world: the strait is twice as wide, so the crossing itself
   *  is about 180 seconds for the slowest class rather than 90. */
  transitCrossAllowance: 350,
} as const;

/** Convoy entry pacing.
 *
 *  Every gap here was doubled from its original value. The convoy used to
 *  arrive faster than a player could read it: hulls entered on top of each
 *  other, and by the time you had worked out which one was in trouble two more
 *  were on the map. Twice the spacing is twice the time to look at each ship
 *  before the next one demands attention. It costs nothing in volume — the same
 *  hulls sail, they just do not all arrive at once — and the enemy's fire window
 *  stretches with the convoy (see convoySpawnSpan), so a longer transit does not
 *  mean a quieter one. */
export const SPAWN = {
  /** Delay before the first ship enters. */
  firstDelay: 1.0,
  /** Wide/staggered pace: one ship enters, alternating lanes, every this many
   *  seconds. Keeps the map uncluttered — the stream is sparse and readable. */
  interval: 10.0,
  /** Sprint pace: within a volley, one ship enters this often (back to back). */
  sprintInterval: 5.6,
  /** Sprint: min/max ships in one single-file volley before the column
   *  relocates to a different lane. */
  sprintVolleyMin: 3,
  sprintVolleyMax: 6,
  /** Sprint: pause after a volley's LAST ship before the next volley's first
   *  ship enters (in the new lane) — longer than the in-volley spacing so the
   *  lane switch reads clearly. */
  sprintVolleyGap: 10.0,
  /** Tight pace: a whole wave (one ship per lane) enters this often. */
  tightWaveInterval: 11.0,
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
  /** Clear water a hull tries to keep around a CHARTED mine, in hull radii.
   *
   *  The forward-cone steering above only reacts to a mine the ship is pointed
   *  at, which meant a hull could pass one close enough aboard to look like it
   *  had not noticed. This is a standoff instead: any charted mine inside this
   *  distance pushes the hull directly away from it, whatever heading it is on,
   *  so the ship opens the range rather than merely missing.
   *
   *  Eight radii is roughly four ship lengths of clearance — 88 units for a
   *  cargo hull, 112 for a tanker. */
  mineBerthRadii: 8,
  /** Strength of that standoff, relative to ordinary neighbour separation. A
   *  mine is not a ship you are politely giving room to; it is the thing that
   *  ends the hull. */
  mineBerthWeight: 2.2,
  /** Last-resort hull-overlap correction (fraction of overlap per tick). Rarely
   *  triggers once steering is doing its job; guarantees no visual overlap. */
  overlapPush: 0.5,
  /** Share of a ship↔escort overlap correction the CARGO HULL absorbs (the
   *  escort takes the remainder). An escort under orders is the stand-on
   *  vessel: it holds the track the player gave it, and the merchant gets out
   *  of the way. At 1.0 the escort is never deflected at all. */
  escortPushShare: 0.9,
  /** Escorts.
   *
   *  An escort steers, it does not teleport along a ruler. It used to run the
   *  straight line from where it was to where it was told to go, which meant a
   *  merchant sitting on that line got shouldered aside — the convoy giving way
   *  fixed the case where the merchant was under way and could take the way
   *  off, but a hull stopped dead in the water cannot get out of anybody's way.
   *  So the escort does the getting out of the way: same shape of steering the
   *  merchants use, goal plus avoidance plus separation, through a turn-rate
   *  limit so the course change reads as a ship altering course. */
  escortSpeed: 50,
  escortArrive: 16,
  /** How far an escort considers merchant hulls at all.
   *
   *  Separate from the merchants' own `perception` (150) on purpose. The escort
   *  now looks 240 units ahead and holds a ~102-unit bubble, and a neighbour
   *  loop that culled at 150 would have thrown away the far half of both before
   *  the steering ever saw it — the widened numbers would have quietly done
   *  nothing. Raising the shared constant instead would have pulled every
   *  merchant into considering far more neighbours than its formation-keeping
   *  needs, which is both slower and a change to convoy behaviour nobody asked
   *  for. */
  escortPerception: 280,
  /** Clear water an escort holds around a merchant hull, on top of the two
   *  hull radii — the "bubble" the two ships keep between them.
   *
   *  WIDENED from 26, which put the bubble at 15 + 11 + 26 = 52 units against a
   *  cargo hull, barely more than two hull radii. An escort only began to react
   *  once it was already close aboard, so the correction it then had to make
   *  was a hard one, and it read as a ship noticing a merchant late rather than
   *  keeping out of her way. At 76 the bubble is ~102 units, about twice the
   *  old one: the two ships start easing apart while there is still room to do
   *  it gently. Paired with the squared falloff in the steering loop, which is
   *  what keeps a wider bubble from turning into a mushy one — see
   *  escortSepFalloff. */
  escortSepBuffer: 76,
  /** How sharply the separation force builds as the bubbles overlap.
   *
   *  1 is the old linear ramp: at the edge of the bubble it is already pushing
   *  meaningfully, which across a bubble this wide would have the escort
   *  drifting off its ordered track any time it came near the convoy at all.
   *  Squaring it makes first contact between the bubbles a nudge and deep
   *  overlap an emphatic shove — the response gets more severe the closer they
   *  get, rather than being uniformly assertive across the whole radius. */
  escortSepFalloff: 2,
  /** Forward distance over which an escort watches for a hull in its way.
   *
   *  DOUBLED from 120 alongside the bubble above: the point of seeing further
   *  is to start the alteration of course earlier, and a standoff distance the
   *  escort cannot see far enough to plan for just becomes a late shove. */
  escortLookAhead: 240,
  /** Lateral half-width of the escort's "in my way" corridor, added to hull
   *  radii. Widened less than the look-ahead was: this decides which hulls
   *  count as obstacles at all, and opening it too far has the escort altering
   *  course for merchants it was always going to pass clear of. */
  escortLaneBand: 30,
  escortGoalWeight: 1.0,
  escortAvoidWeight: 2.0,
  escortSepWeight: 1.6,
  /** Escort heading may swing at most this many radians/second. Quicker than a
   *  loaded merchant's 1.4 — it is a warship, and the player expects an order
   *  to be obeyed promptly — but not instant. */
  escortTurnRate: 2.6,
  /** Seconds of making no real progress toward its destination before an escort
   *  stops going around and starts nosing through.
   *
   *  Going around is right when there is a way around. A packed column with no
   *  gap in it has none, and an escort that would rather circle forever than
   *  push between two merchants is an escort that never carries out its order —
   *  which is worse than a bit of shouldering. Separation still applies, so it
   *  parts the line rather than driving over it. */
  escortAvoidGiveUpSeconds: 3.5,
  /** Seconds over which that override fades in, rather than snapping on at the
   *  threshold. A binary switch in the middle of a steering loop is a visible
   *  twitch — the escort was going one way and is suddenly going another. */
  escortAvoidGiveUpFade: 0.8,
  /** Passing astern.
   *
   *  An escort always goes round the STERN of a merchant that is making way.
   *  Crossing ahead of a moving ship is a losing race: she keeps coming, so the
   *  escort keeps having to bear away, and the merchant ends up herding it
   *  further and further off its track. Cross behind her and she takes herself
   *  out of the problem. It is also the rule of the road.
   *
   *  Below this speed a merchant counts as stopped — she has no stern to pass,
   *  and the side is chosen on plain geometry instead. */
  escortSternMinSpeed: 3,
  /** How squarely the stern has to lie to one side before that side is taken.
   *  Two ships on the same course have no astern-side at all (the stern is
   *  dead ahead of the escort or dead behind it), and forcing a choice there
   *  would be arbitrary — that is an overtaking situation, not a crossing one,
   *  so geometry decides. */
  escortSternMinLateral: 0.15,
  /** Seconds of smoothing on an escort's steering vector.
   *
   *  Steering forces are computed fresh every tick from a world that is itself
   *  moving, so the raw vector flickers — a hull crosses in or out of the
   *  corridor, a merchant gives way and stops, a passing side is re-evaluated.
   *  Feeding that straight to the rudder made the escort visibly shake when it
   *  got close to the convoy. Filtering the vector (rather than the heading)
   *  keeps the ship committed to a course for long enough to look like it meant
   *  it, and still lets a real change through inside half a second. */
  escortSteerSmoothing: 0.35,
  /** Minimum length of the smoothed steering vector that counts as a steering
   *  COMMAND. Below it the escort holds its heading.
   *
   *  A real command is order-of-1 long (the goal term alone is weighted 1.0).
   *  What this rejects is the residue left once the escort is on station and
   *  the goal force is spent — a hundredth of that, pointing wherever the
   *  nearest hull last moved. Direction is meaningless at that magnitude, and
   *  atan2 does not care: it returns an angle just as confidently for a vector
   *  0.003 long, and the ship chases it at full rudder. */
  escortSteerDeadband: 0.25,
  /** Once an escort has committed to passing a particular hull on a particular
   *  side, it holds that choice until the hull is this far outside the corridor
   *  it was avoiding — the hysteresis that stops the side flipping every tick
   *  as the geometry crosses dead ahead. */
  escortPassCommitSlack: 40,
  /** Seconds a passing commitment survives with nothing in the corridor before
   *  it is released.
   *
   *  The commitment used to be torn down the first tick the corridor came up
   *  empty. A hull skimming the edge of it drops out for a tick or two at a
   *  time, so the side was re-decided on every re-entry and could come back the
   *  other way — a rudder reversal produced by bookkeeping rather than by
   *  anything in the water. Long enough to ride out that flicker, short enough
   *  that a hull genuinely left behind stops steering the ship. */
  escortPassReleaseSeconds: 0.6,
  /** Give-way to a crossing escort.
   *
   *  An escort cutting through the column used to be a bulldozer: it drove
   *  straight down the line and every hull it touched got shoved sideways into
   *  its neighbours, which shoved THEIRS, and the convoy came apart. Real
   *  merchants do the opposite of shoving — they take the way off and let the
   *  warship pass. So a cargo hull with an escort in its path slows, down to a
   *  dead stop if the escort is close aboard, and picks up again the moment the
   *  water ahead is clear. */
  giveWay: {
    /** Forward distance over which a crossing escort is watched for. */
    lookAhead: 150,
    /** Lateral half-width of the "she's in my way" corridor (added to hull
     *  radii), wider than the ordinary avoidance band because the response is
     *  throttle rather than rudder — better to slow early for a near miss than
     *  to swerve late. */
    band: 34,
    /** Inside this range the merchant stops outright rather than creeping. */
    stopDistance: 62,
    /** How fast an escort must be moving ACROSS a merchant's track before this
     *  rule applies at all.
     *
     *  This threshold is what stops give-way turning into deadlock. An escort
     *  keeping station alongside the convoy is travelling the same way as the
     *  merchants, not across them: it never clears their bow, so a merchant
     *  that gave way to it would sit there until the round ended. Below this
     *  rate the escort is just another hull in the water and the ordinary
     *  overtake-or-wait logic handles it, which is the logic that knows how to
     *  go around something. */
    minCrossSpeed: 12,
    /** Absolute ceiling on how long one merchant will hold for crossing traffic
     *  before it gives up and steers around instead. Give-way is a courtesy,
     *  not a reason to never reach the far shore. */
    maxHoldSeconds: 8,
  },
} as const;

export const COMBAT = {
  /** Clear water kept between any hull and the coastline, on top of the shore's
   *  meander. Ships look wrong nosed right up against the beach even when they
   *  are technically afloat. */
  shoreClearance: 26,
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
   *  hostile shore, immune to interceptors and point-defense by design — the
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
    /** MAX speed.
     *
     *  SLOWED from 64. It only needs to beat the fastest merchant (a freighter
     *  at 34) by enough to close and hold station; at 64 it was nearly twice
     *  that and read as a speedboat tearing across the strait rather than a
     *  craft working a convoy. A boat that crosses the screen in a couple of
     *  seconds also gives the player almost no run-in to shoot at, which is
     *  exactly what the physical-navigation rework was for. 42 is a quarter
     *  clear of the fastest hull — still able to run one down and take station,
     *  but on the same order as the ships it is hunting. */
    speed: 42,
    /** Acceleration limit (units/s²) and turn-rate limit (radians/s).
     *
     *  These two are what make a boat read as a BOAT. The old model set the
     *  velocity vector straight at the target every tick and then lerped the
     *  boat's position onto the hull once inside range, so a boat effectively
     *  teleported alongside and the player never got a run-in to react to.
     *  Physical motion means an approach has a visible track, a commitment,
     *  and a turn radius — and it means a boat that picks a new target has to
     *  actually sail there. */
    accel: 34,
    turnRate: 1.9,
    /** Where a committed boat HOLDS, per variant: the radius of the ring it
     *  keeps around its target. Gun boats stand off and shoot; a boarding boat
     *  has to make physical contact, so its ring sits just inside grapple
     *  range. Nothing may ever sit on top of a hull — see hullBuffer. */
    standoff: { smallArms: 118, rocket: 158, boarding: 34 },
    /** Hard floor on how close a boat may come to the hull it is working,
     *  as a fraction of its standoff ring. Below this it is pushed back out,
     *  so "alongside" never degenerates into "inside". */
    hullBuffer: 0.55,
    /** Clear water a boat keeps from other boats, and how hard it steers to
     *  hold it — several boats on one hull spread around it instead of
     *  stacking into a single sprite. */
    separation: 52,
    separationWeight: 1.7,
    /** Minimum angular spacing (radians) between two boats stationed on the
     *  same hull when their stations are assigned. */
    stationSpacing: 0.9,
    /** Max range at which a gun boat opens fire. Comfortably inside deck-gun
     *  reach (medium tier 420) so fielding the counter always gets a shot. */
    engageRange: 190,
    /** Contact radius for the boarding grapple. */
    boardRange: 46,
    /** Boat weapons: every point of cargo damage this branch deals now arrives
     *  as a VISIBLE projectile that flies from the boat to the hull, rather
     *  than as an invisible damage-per-second stream applied because the boat
     *  was nearby. A player who loses a ship to boats should have watched the
     *  rounds cross the water first.
     *
     *  Effective DPS is deliberately BELOW the old contact-damage figures
     *  (small arms 4.4 → ~3.5, rocket 6.5 → ~5.0) and lower again in practice,
     *  because rounds now have flight time and can miss a maneuvering hull.
     *  That is the temporary lethality reduction the movement rework asks for:
     *  re-measure and re-raise once the new approach model has been played. */
    fire: {
      smallArms: { interval: 0.85, damage: 3.0, speed: 330, spread: 10, size: 2 },
      rocket: { interval: 2.4, damage: 12, speed: 215, spread: 17, size: 3.4 },
    } as Record<string, { interval: number; damage: number; speed: number; spread: number; size: number }>,
    /** How close a boat round must pass to a hull to strike it. */
    projectileHitRadius: 13,
    /** Seconds a round stays in the water after overshooting its aim point
     *  before it is culled (keeps a visible miss on screen for a beat). */
    projectileOvershoot: 0.35,
    /** Hull points per variant. Small-arms dies to ~3 medium deck-gun rounds
     *  (12 damage each), matching "sunk by ~3 anti-boat rounds". Rocket and
     *  boarding hulls are tougher AND take half damage until Armor-Piercing is
     *  researched — that node is what keeps them killable. */
    hp: { smallArms: 34, rocket: 46, boarding: 40 },
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
     *  worth at its price.
     *
     *  DPS was later raised ~30% (3.4/5 -> 4.4/6.5) to make the branch a real
     *  share of the damage rather than a rounding error. A counter for 9% of
     *  your losses cannot pay however cheap it is, and the deck gun measured at
     *  -2.4% worth because of it. Boats now take 11% of losses and the branch
     *  still prices out at 8.6 cost-per-result, in line with mines at 8.8. */
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
   *  RANGE IS THE WHOLE DESIGN. The lanes sit 420 / 700 / 980 from the hostile
   *  shore, so a coastal gun reaches only the near lane and ranging artillery
   *  only the near two. Lane choice is therefore a real decision rather than a
   *  cosmetic one, and it is also where the T2 nearest-to-shore doctrine this
   *  branch grants comes from — the gun's reach IS the doctrine.
   *
   *  RE-DERIVED when the strait was doubled. These are not scaled numbers, they
   *  are the ladder rebuilt against the new lane offsets: every one has to sit
   *  in the gap between two lanes, and the gaps moved. Scaling them by 2 would
   *  have been close enough to look right and wrong at the edges, which for a
   *  branch whose entire identity is reach is the one thing that must not
   *  happen. */
  artillery: {
    /** Direct fire: fast enough that a shell cannot be outrun, slow enough to
     *  read as a tracer crossing the water. */
    shellSpeed: 430,
    range: { coastalGun: 540, ranging: 830, rollingBarrage: 540 },
    /** Per the design's times-to-sink on a 100hp hull: ~6 coastal hits, ~4
     *  ranging hits. A barrage fires coastal-weight shells in bulk.
     *
     *  Raised ~30% (13/21 -> 17/27) for the same reason as attack-boat DPS: at
     *  7% of all losses, counter-battery could not pay whatever it cost, and
     *  measured at -5.0% worth. Artillery was REPRICED upward to match the new
     *  lethality (180/285/400 -> 234/370/520) — at the old prices it became the
     *  best buy in the catalogue at 5.7 cost-per-result against a 7-9 pack, and
     *  the locked doctrine in enemyBranches.ts is that the allocator's choice
     *  has to stay honest. */
    damage: { coastalGun: 17, ranging: 27, rollingBarrage: 17 },
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
  /** How far from the delivery line a hull has to be before an ATTACK BOAT
   *  will commit to it.
   *
   *  Much deeper than deliverSafeMargin, and for a different reason. A missile
   *  is discounted from chasing a nearly-home ship because it could not arrive
   *  in time; a boat has to sail there, take station and then work the hull
   *  over several bursts, so it needs far more of the map left to do it in.
   *  Without this the boats chased the leaders — the hulls closest to scoring
   *  and therefore usually the ones nearest the front of the convoy — and
   *  followed them clean off the end of the map for nothing. */
  boatCommitMargin: 520,
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
  /** A-10 Warthog: flies to a water station, holds a wheel over it, and makes
   *  30mm gun runs on everything hostile it can see on or in the surface —
   *  mines and attack boats. It is a hard, visible, area answer, not a
   *  probability modifier: every pass either kills something or misses in
   *  plain sight. Charges/strafe radius/loiter are tier-resolved (ability
   *  paths); the ballistics live here. */
  warthog: {
    /** Cruise speed of the jet. RAISED a quarter from 240: it is a strike
     *  aircraft crossing a strait, and at the old speed the run-in read as a
     *  cruise rather than an attack. */
    planeSpeed: 300,
    /** Half-angle (radians) of the gun cone ahead of the nose.
     *
     *  The jet used to hold a wheel over a point and shoot anything inside a
     *  circle drawn round it, which is a loiter, not a gun run: direction meant
     *  nothing and the player's only input was where to park it. Targets are
     *  now taken from a cone off the nose, so the LINE the player draws is the
     *  weapon — what lies along it gets strafed, what sits off to the side does
     *  not, and lining the run up is the skill. */
    coneHalfAngle: 0.42,
    /** Multiplier on that half-angle with the Wide Strafe Pattern node. */
    wideConeMult: 1.7,
    /** How far ahead of the nose the gun reaches. */
    coneRange: 300,
    /** Distance beyond the map edge the jet enters from, so the run-in starts
     *  off screen and the aircraft arrives already established on its bearing.
     *
     *  Measured from the WORLD BOUNDARY, not from the drawn line. It used to be
     *  measured back from the line's near end, which meant a line drawn in the
     *  middle of the strait put the aeroplane 220 units before it — still well
     *  inside the map, so the jet simply appeared out of nothing a moment
     *  before it started shooting. An aircraft that materialises where the
     *  player pointed is a cursor, not an aircraft: it now flies in from off
     *  the map along the bearing, however short the drawn line was. */
    offMapMargin: 220,
    /** How fast the jet swings its nose through the turn between passes
     *  (radians/second). Slow enough to draw a banked arc rather than a
     *  pirouette — the turn is a piece of the aesthetic, not just a state
     *  change. DOUBLED from 0.8, which halves the turn radius (v/ω, 375 →
     *  ~188 units at 300 units/s): the old arc swung so wide the jet spent
     *  longer wandering back than attacking, and read as lost rather than
     *  re-attacking. */
    turnRate: 1.6,
    /** How far ahead along the track the turning jet aims when regaining it.
     *  Short and it cuts the corner and overshoots; long and the arc unwinds
     *  into a lazy drift back rather than reading as a turn. Re-derived with
     *  the tighter turn: scales with the turn radius, so it halves too. */
    regainLead: 125,
    /** Lateral error at which the aircraft counts as back on the line. */
    regainTolerance: 40,
    /** When the jet breaks off to turn, expressed in SECONDS of flight rather
     *  than in units of distance — one buffer, measured two ways, so the break
     *  happens at the same point in the run whichever way the player drew it:
     *
     *    • it has been over LAND this long (having crossed the water first), or
     *    • it is this long from the left or right edge of the world.
     *
     *  A distance margin could not do this job. The strait runs east-west, so a
     *  run drawn across it ends over land and a run drawn along it ends at the
     *  map's edge — two completely different geometries that a single distance
     *  measures inconsistently. Time-to-the-boundary is the thing the player
     *  actually perceives, and it reads the same on both. */
    turnBufferSeconds: 0.5,
    /** Room the REVERSAL itself needs, in turn radii, on top of that buffer.
     *
     *  A turn is not free in the along-track direction. The jet reverses onto
     *  the line rather than merely onto the reciprocal heading (a flat 180
     *  rolls out a full diameter off to one side and the return pass misses
     *  everything), and buying that lateral correction costs distance BACK
     *  along the track. Measured, about three turn radii of it.
     *
     *  Left unaccounted for, the whole of that cost is taken out of the far end
     *  of the player's line: breaking off 0.5s past the shore rolled the jet
     *  out ~380 units INSIDE the water, and the return pass simply skipped that
     *  stretch — measured, a mine sitting in it survived a sortie that flew
     *  directly over it twice. Adding the arc's own footprint to the break-off
     *  point puts the roll-out back at the buffer, so the second pass covers
     *  the same water the first one did.
     *
     *  3.4, not the 3.0 the arc itself measures, so the roll-out lands just
     *  OUTSIDE the water rather than 60 units inside it: the return pass should
     *  be established on the line before it reaches the fighting area, not
     *  within it. */
    turnArcRadii: 3.4,
    /** Shortest run-in line that counts as a gun run. Two points on top of one
     *  another give the cone no direction to point along, so a stray tap can
     *  never burn a sortie on a zero-length run. */
    minRunLength: 90,
    /** Rounds drawn in the burst streak for one engagement. A 30mm rotary
     *  cannon fires far more than this in a second; what matters is that the
     *  player sees a STREAM of tracer rather than a single line, so the pass
     *  reads as gunfire. */
    burstRounds: 14,
    /** Seconds between gun runs while on station. */
    fireInterval: 1.15,
    /** Damage one burst does to an attack boat. Mines are destroyed outright —
     *  a moored charge does not survive being hit by 30mm. */
    damage: 26,
    /** Tank-buster rounds (paid node) multiply the burst. */
    tankBusterMult: 2.0,
    /** How long a burst stays drawn on the water, in seconds. Purely visual —
     *  the damage lands the instant the burst is fired. */
    burstSeconds: 0.32,
    /** Water band the station center must sit inside (off both shores/launchers). */
    waterYMin: 1185,
    waterYMax: 2190,
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
  /** A hull with a charted mine close ahead does not simply lean on the rudder:
   *  it comes off the throttle, because the slower it is going the tighter it
   *  can turn out of the way. Speed is capped to this fraction of cruise at the
   *  worst case (mine dead ahead, right on the bow) and eases back to full as
   *  the mine falls astern or off to one side. */
  mineSlowFraction: 0.45,
  /** Detection is a CONTACT, not a permanent chart mark. Everything below is
   *  how long a contact survives once the thing that made it stops looking. */
  mineContact: {
    /** A scan-plane pass hands the fleet a fix good for this long. After that
     *  the mine drifts back off the plot and the convoy is blind to it again —
     *  clearing the water is the only permanent answer to a mine. */
    scanHoldSeconds: 30,
    /** A sonar contact is live only while a hull is actually holding it. This
     *  much grace is allowed after the mine leaves the last hull's range, so a
     *  contact at the very edge of the envelope does not strobe on and off. */
    sonarGraceSeconds: 3,
    /** A contact inside its last seconds is drawn fading, so losing it is
     *  something the player watches happen rather than discovers afterwards. */
    fadeSeconds: 6,
  },
} as const;

export const ECONOMY = {
  startCash: 450,
  startAmmo: 28,
  /** No drone munitions until the player buys them (and researches drones). */
  startDroneAmmo: 0,
  /** Point-defense rounds in stock at campaign start (turrets are useless
   *  without them, but the module also has to be researched/bought first). */
  startPdAmmo: 0,
  /** One shore battery to start; no free escort. */
  startBases: 1,
  startEscorts: 0,
  /** Cash earned per point of cargo value delivered. The ONLY source of round
   *  income — see resolveTransit. */
  cashPerValue: 4,
  ammoCost: 8,
  /** Cash per minesweeper-drone munition, and how many a single purchase buys. */
  droneAmmoCost: 14,
  droneAmmoPerBuy: 3,
  /** Cash per point-defense round, and how many a single purchase buys. */
  pdAmmoCost: 12,
  pdAmmoPerBuy: 3,
  baseCost: 300,
  maxBases: 4,
  escortCost: 600,
  maxEscorts: 3,
  /** Per-use cost of an A-10 sortie, a scan pulse and a smoke canister.
   *
   *  The CAPABILITIES are free and present from round one — commissioning them
   *  used to cost 150-160 each, which was the same IOU the module economy has
   *  now shed: the technology said you had an A-10 and the bank said you did
   *  not. What you buy is the ORDNANCE, every round, and that is the decision
   *  worth keeping: an ability that refilled for free would be a question about
   *  timing and never about cost.
   *
   *  Priced against what they do. A sortie is two firing passes at 26 damage
   *  and kills mines outright, so it sits near an escort's magazine refill; a
   *  scan pulse charts one lane, which is cheaper and more situational; a smoke
   *  cloud protects a cluster of hulls for a while, between the two. */
  warthogSortieCost: 95,
  scanPulseCost: 55,
  smokeCanisterCost: 70,
  /** Deck-gun shells: cash per round, and how many one purchase buys. The gun
   *  is no longer free to fire — a magazine is bought in Preparation like the
   *  interceptor stock. Priced against work done: at quarter damage a
   *  small-arms boat takes roughly 15 hits to sink, so a kill runs ~$40 of
   *  shells — between an interceptor kill (~$13 for a far cheaper threat) and
   *  an A-10 sortie ($95 for two engagements). Unused shells carry over. */
  gunShellCost: 2,
  gunShellsPerBuy: 12,
  /** Cash per hp of hull repair. */
  repairCostPerHp: 0.6,
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
  /** Confidence deltas.
   *
   *  Confidence follows the SHARE of the convoy that arrives, not the COUNT
   *  that does not. The first build rewarded a delivered *fraction* with a flat
   *  bonus (max +8) and punished each lost *hull* (-3, capped -12), which
   *  scaled the two halves differently — so the same performance cost more
   *  confidence the bigger the convoy got. Measured over 88 campaigns, at an
   *  identical 80-90% delivery a sub-20-hull convoy averaged -3.6 confidence
   *  and a 28+ hull convoy -12.1. Capacity is both the progression and the
   *  scoring stat, so the player was punished for advancing, and every delivery
   *  band below 90% bled confidence: -9.4 at 80-90%, -20.0 at 70-75%. SEESAW.md
   *  calls 60-90% the HEALTHY band; the game made all of it terminal and
   *  demanded ~90%+ forever, which is the "pinned at 100%" state the north star
   *  explicitly rejects. Every campaign in the sweep died of it.
   *
   *  A single rate-based curve fixes both halves at once: it is size-neutral by
   *  construction, and its break-even sits inside the healthy band. */
  /** Delivered fraction that leaves confidence unchanged. Below it the round
   *  costs confidence, above it the round earns some. Sits inside SEESAW.md's
   *  60-90% healthy band, near the top — holding station should take a good
   *  round, but not a perfect one. */
  confidenceBreakEven: 0.78,
  /** Confidence per unit of delivered fraction away from break-even. At 100%
   *  delivered this reaches the ceiling below; at ~8% it reaches the floor. */
  confidenceDeliverySwing: 36,
  /** Ceiling on what one round's delivery can earn (hit at 100% delivered),
   *  and floor on what it can cost. The floor is deliberately wider than the
   *  ceiling: a disaster should outweigh a triumph, and confidenceRoundFloor
   *  still bounds the round as a whole. */
  confidenceDeliveryCeiling: 8,
  confidenceDeliveryFloor: -25,
  /** Extra confidence lost per hull TAKEN by a boarding party, on top of the
   *  ordinary loss penalty and outside its cap. A captured ship is a worse
   *  outcome than a sunk one — the cargo is in enemy hands rather than on the
   *  seabed — and putting it outside the cap is what stops "absorb the losses
   *  and push through" from answering the boarding node (ENEMY_ATTACKS.md). */
  confidencePerCapture: -7,
  confidenceCaptureCap: -21,
  confidenceQuotaMet: 10,
  /** Extra confidence lost per civilian crew left in the water (a survivor
   *  area that was never rescued). Rescue prevents the penalty entirely —
   *  that is the whole tactical bargain of diverting an escort to them.
   *
   *  RESCALED from -4 when every sinking began leaving a crew. At -4 it was
   *  priced against a ~55% spawn chance (an expected -2.2 per sinking); once
   *  every loss reliably produced one, the same number nearly doubled the real
   *  drag and measurably broke the game — a sweep that finished 8 of 9
   *  campaigns at the round cap beforehand collapsed 7 of 9 on confidence
   *  afterwards. Halving it restores the intended pressure while keeping the
   *  beat on every loss.
   *
   *  RATE-SCALED for the same reason the delivery term is (see above): as a
   *  per-crew count it carried the identical convoy-size flaw, adding roughly
   *  -5 to a big convoy's round against -2.6 to a small one at equal
   *  performance. Expressed against the convoy sailed, abandoning a quarter of
   *  your crews costs the same wherever the fleet has grown to. */
  confidenceCrewLostRate: -20,
  /** Confidence RECOVERED per crew brought home. Deliberately smaller than
   *  the abandonment penalty: bringing the crew back does not undo losing the
   *  ship, but visibly rewards the diversion — and gives a player having a
   *  terrible round something they can still do about it. Credited OUTSIDE
   *  confidenceRoundFloor (see resolveTransit) so a disaster round cannot
   *  swallow it, which is exactly the round it matters most in. Rescue is the
   *  only way confidence moves upward inside a round other than delivering. */
  confidencePerCrewRescued: 1,
  /** Ceiling on the rescue credit in one round. The abandonment penalty above
   *  is now rate-scaled while this credit stays per-crew — deliberately, so a
   *  diversion pays a predictable, legible amount — but without a ceiling a
   *  catastrophic round on a large convoy could bank more confidence from
   *  rescues than the sinkings cost, making a disaster profitable. */
  confidenceRescueCap: 8,
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
  /** Share of the sailing convoy's cargo value the consortium expects to arrive.
   *  Next window's target = convoy value * quotaWindowRounds * this *
   *  quotaDifficulty — a fraction of what the fleet CAN carry, rather than a
   *  multiple of what the last window happened to deliver.
   *
   *  Sizing from delivery punished the player twice over: it asked more of
   *  someone who had been defending well, and it made any purchase that traded
   *  convoy size for convoy quality miss a target set by the larger convoy they
   *  used to sail. Measured, the quota-miss rate tracked convoy size almost
   *  exactly — 28% for a build sailing 29.4 hulls of 30.4 capacity, 39% at
   *  24.6, 60% at 19.7 — so equipping the convoy was structurally punished
   *  however cheap the equipment was. Halving every module price made those
   *  builds worse rather than better, which is what pointed here.
   *
   *  LOWERED from 0.84 for the roguelite rules (PROVISIONAL): a missed quota
   *  now ENDS the regional run instead of costing 18 confidence, so the same
   *  bar carries far higher stakes. At 0.84 a healthy defended fleet missed a
   *  window by 3% and lost the run outright — the failure system should catch
   *  a player who stops running a real shipping operation, not one having an
   *  ordinary attritional stretch. Tune with the playable slice. */
  quotaDeliveryFraction: 0.7,
  quotaDifficultyStart: 1.0,
  quotaDifficultyMin: 0.65,
  /** Ceiling on the ratchet — LOWERED from 1.6, which was arithmetic the game
   *  could not honour: the window demands fraction × difficulty of the SAILED
   *  convoy value, so 1.6 asked for 112% of what was put to sea and even the
   *  1.3s reachable mid-run asked for more than the healthy delivery band's
   *  ceiling. Measured after the enemy-budget raise: six of twelve personas
   *  quota-failed at 80-84% DELIVERED — killed by the bookkeeping while
   *  fighting well — and with region completion now waiting for the open
   *  window, that unwinnable bar was the last thing every extended run met.
   *  1.15 tops the demand out at ~80.5% of sailed value: a real bar a sloppy
   *  run misses and a defended one clears. */
  quotaDifficultyMax: 1.15,
  /** Difficulty ratchets up on an easy clear (big surplus) — scaled by how far
   *  over the target the window landed, capped at this step. Halved alongside
   *  the ceiling so the ratchet arrives over a campaign, not by window three.
   *  There is no downward ratchet any more: under the roguelite rules a missed
   *  quota ends the regional run outright rather than easing the next window. */
  quotaDifficultyUpStep: 0.05,
  /** Hard floor so a single bad round can't trivialize the next quota:
   *  pointsNeeded never drops below capacity * this. */
  quotaFloorPerCapacity: 8,
  /** Score weights. */
  scorePerValue: 1,
  scorePerRound: 40,
  scorePerIntercept: 3,
} as const;

/**
 * Wreckage recovery — the roguelite loop's technology faucet.
 *
 * Destroyed PHYSICAL enemy threats may leave a recoverable field; recovering
 * one requires committing escort time inside it, and what was recovered
 * weights the post-round technology draft. Every number here is PROVISIONAL —
 * the design doc defers all recovery balance to playtesting on the working
 * slice. Tune freely; nothing in the sim hard-codes these.
 */
export const WRECKAGE = {
  /** Chance a player-destroyed threat leaves wreckage, by threat kind. Mines
   *  that detonate against a hull spent themselves — only SWEPT mines are
   *  recoverable, which is priced into the mine entry here. */
  dropChance: {
    missile: 0.22,
    guidedMissile: 0.32,
    mine: 0.38,
    torpedo: 0.38,
    attackBoat: 0.55,
    reconPlane: 0.45,
    disablingDrone: 0.45,
  } as Record<string, number>,
  /** Radius (world units) an escort must hold inside to work the field. */
  radius: 100,
  /** Escort-seconds of work one escort needs to recover a field. */
  recoverSeconds: 12,
  /** Each escort beyond the first adds this fraction of the base rate —
   *  two escorts work at 1.6x, three at 2.2x. */
  extraEscortRate: 0.6,
  /** Seconds a field stays recoverable before sinking for good. */
  lifetimeSeconds: 55,
} as const;

/** Survivor rescue: a sunk civilian hull leaves her crew in the water. Same
 *  positional recovery mechanics as wreckage; an unrescued crew costs extra
 *  confidence (CAMPAIGN.confidencePerCrewLost) and a rescue earns some back
 *  (CAMPAIGN.confidencePerCrewRescued). All PROVISIONAL.
 *
 *  EVERY ordinary sinking generates survivors. It used to be a coin flip,
 *  which made the beat feel arbitrary — sometimes a sinking mattered
 *  emotionally and sometimes it silently didn't, with nothing on screen
 *  explaining the difference. A crew in the water every time makes each loss
 *  land, and gives escorts a standing responsibility beyond shooting things
 *  down. The exceptions are narrow and deliberate: see spawnSurvivors. */
export const SURVIVORS = {
  radius: 100,
  rescueSeconds: 10,
  extraEscortRate: 0.6,
  /** How long a crew stays afloat and reachable. This is the real difficulty
   *  dial now that every sinking spawns one: it decides how many rescues a
   *  flotilla can physically service in a bad round, and therefore how much
   *  the choice between convoy defense, salvage and rescue actually costs. */
  lifetimeSeconds: 60,
} as const;

/**
 * The mandatory post-round technology draft (replaces paid research).
 *
 * Breadth scales with recovered wreckage; WEIGHTING reads the run as a whole.
 * Wreckage alone was too narrow a signal — a player who was mined for three
 * rounds running but never had an escort to spare for salvage could go the
 * whole run without ever being offered a mine counter, which is a draft-RNG
 * loss rather than a played one. So the pool now also weighs what each enemy
 * branch has actually been doing (appearances, damage, kills), whether the
 * player already holds an answer to it, and how recently each entry was last
 * put on the table.
 *
 * Randomness is preserved deliberately — the draft still rolls, still offers
 * imperfect options, and is never guaranteed to hand over the ideal counter.
 * The pity rule below only guarantees a PATH exists. All PROVISIONAL.
 */
export const DRAFT = {
  /** Options always offered after a successfully completed round.
   *
   *  RAISED from 2. With more than one pick available a two-card table stops
   *  being a choice the moment the second pick lands — the player takes both
   *  and there was nothing to decide. The table has to stay wider than the
   *  number of picks or the draft is just a delivery. */
  baseChoices: 3,
  /** Extra options offered per EXTRA pick earned, so a bigger draft is still a
   *  choice rather than a hand-out: two picks see five cards, three see seven. */
  choicesPerExtraPick: 2,
  /** PICKS. Recovery buys them: every this many wreckage units recovered that
   *  round earns one more option the player may take, up to maxPicks.
   *
   *  This is what recovery is FOR. It used to buy a wider table and slightly
   *  better weighting, which is a real but nearly invisible reward — a third
   *  card the player did not take is worth nothing to them. Turning salvage
   *  into a second technology is a reward you can feel. */
  unitsPerExtraPick: 3,
  basePicks: 1,
  maxPicks: 3,
  /** Chance of a THIRD option per wreckage unit recovered that round —
   *  recovery beyond ~3 units guarantees the wide draft. */
  thirdChoicePerUnit: 0.34,
  /** Extra draft weight per recovered unit applied to entries in branches
   *  that counter the recovered threat's family. */
  branchWeightPerUnit: 1.25,
  /** Recovered units beyond this start improving option QUALITY: deeper
   *  entries in a branch gain weight, so strong recovery rounds skew the
   *  draft toward later, stronger tech instead of entry nodes. */
  qualityThreshold: 3,
  /** Depth weight per excess unit (scaled by how deep the entry sits). */
  depthWeightPerUnit: 0.3,
  /** Weight multiplier on remaining same-branch entries after one is drawn,
   *  so a draft leans toward offering distinct branches. */
  sameBranchRepeatMult: 0.35,
  /** How sub-linearly a branch banks the pressure of the several enemy
   *  families it claims to counter: summed pressure ÷ liveFamilies^this.
   *  0 = full credit for every family (the old compounding behaviour),
   *  1 = pure average. 0.5 keeps breadth worth something without letting a
   *  branch that splits one sortie between two threats outbid the specialist
   *  that removes one of them. */
  breadthDampingExponent: 0.5,

  // --- Threat-pressure weighting -------------------------------------------
  /** Weight added per round a countered branch has been ENCOUNTERED. */
  pressurePerEncounter: 0.5,
  /** Weight added per hull that branch has sunk or taken. */
  pressurePerKill: 1.4,
  /** Weight added per point of hull damage it has dealt. */
  pressurePerDamage: 0.004,
  /** Ceiling on the raw pressure weight one branch can contribute, so a
   *  single dominant threat cannot crowd every other option off the table. */
  pressureCap: 7,
  /** Pressure decays with staleness: a branch not seen for this many rounds
   *  contributes nothing, scaling linearly in between. Answering a threat
   *  that has stopped appearing is not urgent. */
  pressureMemoryRounds: 4,
  /** Multiplier applied to an entry whose branch answers a threat the player
   *  is not actually stopping. Scaled by the COVERAGE GAP (1 - coverage), so a
   *  wide-open threat gets the full multiplier, a mostly-handled one gets
   *  almost none, and the two ends are joined by a smooth line rather than the
   *  boolean cliff that used to declare a threat solved the moment any tech
   *  nominally pointed at it. */
  coverageGapMult: 2.4,
  /** Multiplier applied to a branch's ENTRY node specifically, scaled by the
   *  same gap — the basic counter should surface before its upgrades. */
  entryNodeMult: 1.8,
  /** Multiplier applied to an entry offered within the last `offerCooldown`
   *  drafts, so a declined option steps aside for something else. */
  recentlyOfferedMult: 0.3,
  offerCooldownRounds: 2,

  // --- Coverage measurement ------------------------------------------------
  /** Smoothing on the per-branch coverage ratio: how much of a round's
   *  measurement replaces the running value. High enough that a bad round
   *  registers immediately, low enough that one lucky transit does not read as
   *  a solved threat. */
  coverageSmoothing: 0.55,
  /** Coverage at or above which a branch counts as genuinely handled — the
   *  counter slot stops competing for it and its entries lose the gap bonus. */
  coverageAnsweredAt: 0.8,
  /** Coverage credited to a branch that fielded nothing measurable this round
   *  while the player holds a real (attack/mitigate) counter for it. Keeps an
   *  idle branch from reading as a crisis without declaring it solved. */
  coverageIdleWithCounter: 0.6,
  /** Credit for a mine that was REVEALED and steered around rather than
   *  destroyed. The hull survived, so it is not nothing; the minefield is
   *  still there, so it is not a sweep. */
  coverageRevealCredit: 0.5,

  // --- The counter slot ----------------------------------------------------
  //  Replaces the old pity rule. Pity was a probabilistic backstop with a
  //  narrow timing window and a boolean off-switch; the counter slot is
  //  structural — one seat at every table belongs to the worst-covered live
  //  threat, so a player can never again go a whole run without being shown an
  //  answer to what is killing them.
  /** Minimum coverage deficit (pressure × gap) before a family may claim the
   *  counter slot. Below it the slot falls through to the open pool. */
  counterSlotMinDeficit: 0.4,
  /** Weight multiplier inside the counter slot for a branch that can actually
   *  REMOVE the threat (role attack/mitigate) over one that only detects it.
   *  Seeing a mine is not sweeping a mine. */
  counterSlotAttackMult: 3,
  /** Weight multiplier inside the counter slot for the entry node of a branch
   *  the player has nothing from yet — a new tool beats a fifth upgrade to the
   *  tool that is already failing. */
  counterSlotNewBranchMult: 2.5,
  /** Weight multiplier inside the counter slot for an entry shown in the last
   *  `offerCooldownRounds` drafts. Softer than the open pool's: the guarantee
   *  matters more than the variety. */
  counterSlotRecentMult: 0.5,

  // --- Reward categories ---------------------------------------------------
  //  A draft can hand over four different kinds of thing, and they are not
  //  interchangeable. A MODULE is a new capability; an UPGRADE improves every
  //  copy of one the fleet already has; an ASSET changes the fleet's shape;
  //  ORDNANCE is a one-off crate of consumables. Left unweighted the module
  //  would win every table — a thing you cannot do yet always reads better than
  //  a thing you can do slightly better — so the pool is biased back toward
  //  upgrades and the module's advantage is spent where it belongs: answering
  //  a threat that is actually getting through.
  /** Base weight multiplier per category in the OPEN (development) pool. */
  categoryWeight: {
    upgrade: 1,
    module: 0.75,
    asset: 0.9,
    ordnance: 0.28,
  } as Record<string, number>,
  /** A cargo module unit fits an entire ship CLASS — roughly fifteen hulls for
   *  one card, against one hull for an escort unit. Same card, very different
   *  gift, so the class-wide one is drawn meaningfully less often. */
  cargoModuleRarity: 0.5,
  /** Units of one cargo module type the player may hold: one per ship class. */
  cargoModuleCap: 3,
  /** Units of one escort module type: one per escort the flotilla can field. */
  escortModuleCap: 3,
  /** Units of one base module type (the battery loadout is a shared template
   *  with a single slot, so a second unit could never be fitted). */
  baseModuleCap: 1,
  /** Ordnance never claims the counter slot — a crate of shells is not an
   *  answer to a threat — and is held out of the pool entirely until the run
   *  has something it would actually resupply. */
  ordnanceMinRound: 3,
  /** Share of the table ordnance takes when there is plenty else on offer.
   *  Low on purpose: with a full catalogue in front of them, a crate of shells
   *  should almost never be the interesting card. */
  ordnanceShare: 0.05,
  /** Extra share it claims as the alternatives run out, scaled by how far the
   *  pool has thinned below `ordnanceRichPool`. This is the whole point of the
   *  category — when everything worth having is already drafted or capped, the
   *  draft should offer something real rather than a card the player resents.
   *  A near-empty pool hands ordnance most of the table. */
  ordnanceScarcityShare: 0.5,
  /** Non-ordnance options that count as "plenty else on offer". */
  ordnanceRichPool: 12,

  /** Share of the run's TOTAL live danger that a branch countering nothing in
   *  particular — reinforced hull, compartmentalization — banks as weight.
   *
   *  Everything else in this block prices a reward against the family it
   *  answers, which left generic survivability with no signal at all: a hull
   *  fit scored a flat 1 against 5-30 for a counter under pressure, and a
   *  192-campaign sweep drafted Reinforced Hull ONCE and Compartmentalization
   *  never. What makes armour relevant is not any one threat, it is being hurt
   *  at all, so it prices on the sum of what is getting through. Below 1
   *  because a specific answer should still beat a general one. */
  survivabilityShare: 0.55,
} as const;

/** Commander progression: the permanent layer. PROVISIONAL numbers. */
export const COMMANDER = {
  /** Equipped ability slots (design working model: 2-3 initially). */
  abilitySlots: 3,
  /** Total loadout point budget across equipped abilities. */
  loadoutPoints: 25,
  /** Commander XP earned per round survived when a run ends — losses still
   *  feed permanent progression, which is what makes them feel productive. */
  xpPerRound: 5,
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
  /** Extra seconds after the last ship enters, so fire covers it crossing.
   *
   *  RAISED with the strait. The crossing itself went from about 90 seconds to
   *  about 180 when the map doubled, and this tail did not — so a round's fire
   *  finished while the back half of the convoy was still in open water, and
   *  the last stretch of every transit went silent. Measured before the change,
   *  118 seconds of nothing at all with four or more hulls still at sea.
   *
   *  RAISED AGAIN from 150, which was still short of its own arithmetic: the
   *  slowest healthy crossing is ~180 seconds, and a hull slowed by charted
   *  mines or give-way takes 200-260. The shortfall hid whenever the round's
   *  mix included boats (persistent units occupy the tail on their own) and
   *  surfaced the moment a seed rolled a pure-missile round: measured, a 36s
   *  silence with four hulls still crossing. 210 covers the honest crossing
   *  plus ordinary slow-downs; a crippled straggler beyond that is accepted. */
  windowTailT: 210,
  /** Stretch of hostile shore the enemy emplaces artillery along. Kept clear of
   *  the convoy's entry so the first guns are something the player sails toward
   *  and can route around, not an ambush at the start line. */
  gunFieldStartX: 1240,
  gunFieldEndX: 3240,
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
  budgetBase: 55,
  budgetPerRound: 67,
  /** Hard ceiling so a long campaign can't run away. Scales with prices: at the
   *  old 900 this bought ~32 mines, at current prices barely 12.
   *
   *  RAISED with budgetPerRound (63 → 67) after hand-play and the sweep agreed
   *  the fight had gone soft: a played 10-round campaign hit the old 1200 cap
   *  on round 8 and sat there — three flat rounds of pressure against a player
   *  economy that kept compounding — while 8 of 11 sweep personas were
   *  finishing at 100% round-cap completion. The player called it: "I could
   *  speed through the round and not do anything and still get to the final
   *  round." The cap exists to stop runaways, not to be the operating point of
   *  every endgame.
   *
   *  BRACKETED, per this file's own rule. The first arm (72 / 1550) overshot:
   *  measured, mid-breadth builds entered an attrition spiral — convoy value
   *  sailed fell 241 → 100 across eight rounds while per-round delivery still
   *  read 75-90% — and died of the shrinking fleet, not of any one round.
   *  This midpoint holds the late game under real pressure without tipping
   *  hull replacement past its break-even. */
  budgetCap: 1350,

  /** Anti-snowball, applied as multipliers to the round's budget. Success arms
   *  the enemy faster; a struggling player gets breathing room. Both ends
   *  matter — the restoring force has to work in both directions. */
  bonusStrongDelivery: 0.12, // player delivered >= 85%
  bonusHighIntercept: 0.1, // player intercepted > 70% of missiles
  dampStruggling: 0.2, // player delivered below the threshold -> budget cut by this
  /** Delivered fraction under which the player counts as STRUGGLING and the
   *  enemy's budget growth is damped.
   *
   *  RAISED from 0.55. The damp is the seesaw's restoring force on the player's
   *  end, and at 0.55 it was calibrated below the band where campaigns actually
   *  died: across 88 campaigns the median delivery over a campaign's final
   *  three rounds was 62%, and only 8.9% of all rounds ever fell under 55%. The
   *  brake existed but the car never reached the speed that applied it. 0.68
   *  sits just under confidenceBreakEven (0.78), so it engages once a player is
   *  genuinely losing ground rather than merely having an ordinary hard round. */
  strugglingDelivery: 0.68,

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
   *  band. It is the enemy-side half of the seesaw's restoring force: it scales
   *  with how long the player has been winning and stops the moment the fight
   *  is even again. (The player-side half is no longer a cash rebate — it is
   *  the affordable replacement hull; see SHIP_CLASSES.replaceCost.) */
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
