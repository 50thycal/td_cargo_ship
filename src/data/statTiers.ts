// Global qualitative stat-tier system. Every player-counter stat is expressed
// as one of five named tiers (Low → Max); THIS file is the single place a tier
// becomes a number. The invariant the whole counter design leans on:
//
//   Two systems using the same tier within the same stat DOMAIN receive the
//   same numerical value.
//
// Domains are deliberately separate where systems are physically different
// ("High" interceptor speed is not "High" gun-tracer speed), and deliberately
// shared where the design demands parity (every interceptor branch draws
// accuracy from the same weaponAccuracy table). Values are anchored to the
// pre-tier game's numbers so the established feel survives the refactor:
// battery interceptors fast but slow to reload, escorts nimble but slower
// rounds, cargo self-defense short-ranged and magazine-limited.
//
// Simulation code must never convert a tier itself — it asks tierValue().
// The final tier→number tables are documented in docs/PLAYER_COUNTERS.md and
// MUST be kept in sync with this file.

export type StatTier = 'low' | 'medium' | 'high' | 'extra' | 'max';

export const TIER_ORDER: readonly StatTier[] = ['low', 'medium', 'high', 'extra', 'max'];

/** True when tier `a` is the same rung or a higher rung than `b`. */
export function tierAtLeast(a: StatTier, b: StatTier): boolean {
  return TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b);
}

/** The higher of two tiers (used when two nodes set the same stat). */
export function maxTier(a: StatTier, b: StatTier): StatTier {
  return tierAtLeast(a, b) ? a : b;
}

type TierTable = Readonly<Record<StatTier, number>>;

/**
 * Tier → number tables, one per stat domain.
 *
 * Naming semantics (read carefully — two domains are magnitude-named):
 *  • Speed/range/accuracy/damage domains: a higher tier is BETTER (bigger or
 *    more accurate).
 *  • reloadSeconds: tiers name reload SPEED, so a higher tier is a SHORTER
 *    duration (High reload = 1.6 s, faster than Medium's 3.2 s).
 *  • fireIntervalSeconds: tiers name firing RATE, so higher tier = shorter
 *    interval between rounds.
 *  • autoFireCooldownSeconds: tiers name the cooldown LENGTH itself, because
 *    the design docs say automation "begins with a Max automatic-fire
 *    cooldown" and improves to Medium — Max here is the LONGEST (worst)
 *    cooldown. This is the one domain where a lower tier is better.
 */
export const STAT_TIERS = {
  /** Interceptor missile flight speed (world units/s). Anchors: escort today
   *  = 92 (Medium), shore battery today = 150 (High), battery with legacy
   *  interception research = 225/255 (Extra/Max). */
  interceptorSpeed: { low: 70, medium: 92, high: 150, extra: 225, max: 255 } as TierTable,

  /** Gun/tracer projectile speed (cargo self-defense, flak). Separate domain
   *  from interceptorSpeed — a tracer round is not a missile. Anchor: the
   *  current point-defense tracer = 260 (High). */
  gunProjectileSpeed: { low: 140, medium: 200, high: 260, extra: 330, max: 400 } as TierTable,

  /** Hit probability vs a standard (non-evading) target. SHARED by every
   *  interceptor, self-defense, flak and deck-gun branch: High accuracy means
   *  the same hit chance everywhere. Guided/evading targets apply the enemy
   *  node's penalty on top (see COMBAT.guided.accuracyPenalty). Anchor: the
   *  pre-tier interceptor hit chance 0.82 = High. */
  weaponAccuracy: { low: 0.55, medium: 0.7, high: 0.82, extra: 0.9, max: 0.96 } as TierTable,

  /** Launcher reload duration (seconds); tier names reload SPEED (higher tier
   *  = faster). Shared by every launcher-style weapon. Anchors: shore battery
   *  today = 4.0 (Low), escort today = 3.2 (Medium), escort with legacy
   *  dual-launch research = 1.6 (High). */
  reloadSeconds: { low: 4.0, medium: 3.2, high: 1.6, extra: 1.0, max: 0.6 } as TierTable,

  /** SEPARATE automatic-fire cooldown (seconds) used by automation tactics.
   *  Independent of launcher reload by design. MAGNITUDE-NAMED: Max = longest
   *  cooldown (automation debuts clumsy and improves toward Low). */
  autoFireCooldownSeconds: { low: 2.5, medium: 4.5, high: 7, extra: 9.5, max: 12 } as TierTable,

  /** Rendered projectile size (canvas px radius). Anchors: escort round today
   *  = 3 (Medium), battery round today = 5 (High). */
  visualProjectileSize: { low: 2, medium: 3, high: 5, extra: 6.5, max: 8 } as TierTable,

  /** Mine-detection sonar radius (world units). Anchors: base sonar today
   *  = 240 (Low), with legacy sonar-suite research ≈ 430 (High). */
  mineDetectionRange: { low: 240, medium: 340, high: 430, extra: 520, max: 620 } as TierTable,

  /** Missile-warning receiver radius (world units) — how far out an inbound
   *  missile aimed at the equipped ship is identified and marked. */
  warningRange: { low: 260, medium: 420, high: 700, extra: 1000, max: 1400 } as TierTable,

  /** Cargo-ship module engagement radius (self-defense interceptor, flak).
   *  Deliberately its own SHORT-RANGE domain: "High" here is still last-ditch
   *  range, nothing like an escort's reach. Anchor: point defense today = 95
   *  (Low). */
  cargoModuleRange: { low: 95, medium: 140, high: 190, extra: 240, max: 300 } as TierTable,

  /** Hydrophone / underwater detection radius (world units). */
  underwaterDetectionRange: { low: 200, medium: 300, high: 420, extra: 540, max: 660 } as TierTable,

  /** Thermal/radar smoke-penetrating imaging radius (world units). */
  imagingRange: { low: 220, medium: 330, high: 470, extra: 600, max: 720 } as TierTable,

  /** Minesweeper-drone flight speed. Anchor: today's drone = 95 (Medium). */
  droneSpeed: { low: 70, medium: 95, high: 140, extra: 180, max: 220 } as TierTable,

  /** Minesweeper-drone launch range from an escort. Anchor: today = 240 (Low). */
  droneLaunchRange: { low: 240, medium: 340, high: 450, extra: 560, max: 680 } as TierTable,

  /** Depth-charge throw range from an escort (world units). */
  depthChargeThrowRange: { low: 260, medium: 370, high: 480, extra: 590, max: 700 } as TierTable,

  /** Depth-charge blast radius (world units). */
  blastRadius: { low: 45, medium: 70, high: 105, extra: 140, max: 175 } as TierTable,

  /** Escort deck-gun engagement range (world units). */
  deckGunRange: { low: 300, medium: 420, high: 560, extra: 700, max: 840 } as TierTable,

  /** Deck-gun damage per round (attack boats are persistent HP targets). */
  deckGunDamage: { low: 8, medium: 12, high: 18, extra: 24, max: 30 } as TierTable,

  /** Sustained-fire interval (seconds between rounds) for deck guns / flak
   *  cycling; tier names firing RATE (higher tier = shorter interval). */
  fireIntervalSeconds: { low: 2.4, medium: 1.8, high: 1.2, extra: 0.7, max: 0.45 } as TierTable,

  /** Counter-battery suppression duration applied to an artillery position. */
  suppressionSeconds: { low: 6, medium: 10, high: 16, extra: 22, max: 30 } as TierTable,

  /** Sensor-derived interceptor accuracy assistance (added hit chance when
   *  defending the equipped ship). Anchor: today's missile-warning = +0.10
   *  (Low). */
  detectionAssist: { low: 0.1, medium: 0.14, high: 0.18, extra: 0.22, max: 0.26 } as TierTable,

  /** Reinforced-hull bonus hit points. Anchor: today's module = +50 (Low). */
  hullReinforcement: { low: 50, medium: 80, high: 115, extra: 150, max: 190 } as TierTable,

  /** Compartmentalization incoming-damage reduction (fraction). Anchor: the
   *  legacy fleet-wide research = 25% (Medium). */
  damageReduction: { low: 0.15, medium: 0.25, high: 0.35, extra: 0.45, max: 0.55 } as TierTable,

  /** How long a sensor track persists after contact is lost (seconds) —
   *  active-sonar ping tracks, thermal track persistence. */
  trackPersistenceSeconds: { low: 6, medium: 10, high: 16, extra: 24, max: 32 } as TierTable,

  /** Fraction of a jamming blackout removed by hardened-systems recovery. */
  jammingRecovery: { low: 0.25, medium: 0.4, high: 0.55, extra: 0.7, max: 0.85 } as TierTable,

  /** Multiplier on the enemy boarding-takeover timer (anti-boarding). */
  boardingSlow: { low: 1.35, medium: 1.7, high: 2.1, extra: 2.6, max: 3.2 } as TierTable,
} as const;

export type StatDomain = keyof typeof STAT_TIERS;

/** THE tier→number conversion. Simulation code calls this; it never converts
 *  a tier on its own. */
export function tierValue(domain: StatDomain, tier: StatTier): number {
  return STAT_TIERS[domain][tier];
}
