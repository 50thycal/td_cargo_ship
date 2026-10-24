// Every balance number V2 has. If tuning means touching a file other than
// this one, waves.ts or upgrades.ts, the design has grown a system it
// shouldn't have.

/** The battlefield is one fixed screen. No camera, no world bigger than this. */
export const VIEW = { width: 1600, height: 900 } as const;

export const RULES = {
  /** Lose when this many cargo ships have been sunk. */
  shipLossLimit: 6,
  /** Waves to clear a map (and unlock the next). Endless continues past it. */
  wavesToClear: 10,
  /** Seconds between the wave banner and the first enemy launch. */
  waveLeadIn: 3,
} as const;

export const SHIP = {
  speed: 40,
  hp: 3,
  hitRadius: 26,
  /** How fast a hull eases into a new formation slot (per second, 0..1 lerp). */
  slotEase: 1.6,
  /** Points per delivered ship, before the flow multiplier. */
  points: 100,
  /** Station keeping: bow-to-bow distance a hull holds behind the ship ahead
   *  in its lane, and the extra distance over which it eases back to speed. */
  minGap: 66,
  easeGap: 8,
  /** Two hulls share a lane when their lane centres are closer than this. */
  laneMatch: 18,
} as const;

/** Left-rail flow slider: seconds between ships, and the score multiplier. */
export const FLOW_STEPS = [
  { interval: 8, mult: 1 },
  { interval: 5.5, mult: 1.4 },
  { interval: 4, mult: 1.8 },
  { interval: 2.8, mult: 2.4 },
  { interval: 1.9, mult: 3 },
] as const;
export const DEFAULT_FLOW = 1;

/** Right-rail speed slider. Pure time scale: score is unaffected. */
export const SPEED_STEPS = [0.5, 1, 2, 3] as const;
export const DEFAULT_SPEED = 1;

export const CARRIER = {
  hp: 12,
  /** Collision ellipse half-axes (the deck is long and thin). */
  halfLength: 86,
  halfBeam: 22,
} as const;

export const INTERCEPTOR = {
  speed: 520,
  rack: 5,
  /** Seconds to reload one round into the rack. */
  reload: 1.5,
  /** Contact distance that counts as reaching the target. */
  contact: 14,
  blast: 22,
  /** Interceptors that lose their target fly on and burst after this long. */
  maxLife: 4,
} as const;

export type ThreatKind =
  | 'drone'
  | 'ballistic'
  | 'guided'
  | 'supersonic'
  | 'heavy'
  | 'cluster'
  | 'mothership'
  // Children: spawned by a cluster or a mothership, never launched by a base.
  | 'bomblet'
  | 'minidrone';

/** Threats a base launches (children excluded), in the order they debut. */
export const PRIMARY_KINDS: ThreatKind[] = ['drone', 'ballistic', 'guided', 'supersonic', 'heavy', 'cluster', 'mothership'];

export function zeroCounts(): Record<ThreatKind, number> {
  return { drone: 0, ballistic: 0, guided: 0, supersonic: 0, heavy: 0, cluster: 0, mothership: 0, bomblet: 0, minidrone: 0 };
}

export const THREATS: Record<
  ThreatKind,
  { speed: number; hp: number; damage: number; dropChance: number; label: string }
> = {
  /** Shahed-style one-way attack drone: slow, cheap, comes in swarms. */
  drone: { speed: 70, hp: 1, damage: 1, dropChance: 0.1, label: 'Attack drone' },
  /** Arcing shot at where a ship WILL be; splash damage on impact. */
  ballistic: { speed: 380, hp: 1, damage: 2, dropChance: 0.2, label: 'Ballistic missile' },
  /** Homing missile: re-targets if its ship goes down, takes two hits. */
  guided: { speed: 150, hp: 2, damage: 2, dropChance: 0.3, label: 'Guided missile' },
  /** Locks on visibly, then crosses the screen in about a second. */
  supersonic: { speed: 430, hp: 1, damage: 2, dropChance: 0.25, label: 'Supersonic missile' },
  /** Slow, armoured, big splash: needs four hits. */
  heavy: { speed: 55, hp: 4, damage: 6, dropChance: 0.6, label: 'Heavy cruise missile' },
  /** Splits into bomblets close to its target unless it is hit first. */
  cluster: { speed: 170, hp: 1, damage: 0, dropChance: 0.25, label: 'Cluster missile' },
  /** Drifts at the carrier dropping mini-drones until it is shot down. */
  mothership: { speed: 38, hp: 5, damage: 4, dropChance: 0.7, label: 'Drone mothership' },
  bomblet: { speed: 260, hp: 1, damage: 1, dropChance: 0.02, label: 'Bomblet' },
  minidrone: { speed: 85, hp: 1, damage: 1, dropChance: 0.03, label: 'Mini-drone' },
};

export const SUPERSONIC = {
  /** Seconds it sits on the rail with its lock line showing before launch. */
  arming: 1.1,
  turnRate: 0.9,
  /** Share of a wave's speed-up it takes (it is already fast). */
  waveSpeedShare: 0.3,
} as const;

export const HEAVY = {
  turnRate: 1.2,
  splash: 55,
  splashDamage: 1,
  waveSpeedShare: 0.5,
} as const;

export const CLUSTER = {
  turnRate: 2,
  /** It splits this far from its target. */
  splitRange: 200,
  bomblets: 4,
  /** Bomblets look for ships within this range of the split. */
  spread: 300,
  bombletTurn: 5,
} as const;

export const MOTHERSHIP = {
  /** Seconds between mini-drones. */
  spawnEvery: 2.6,
  waveSpeedShare: 0.5,
} as const;

export const BALLISTIC = {
  splash: 50,
  /** Peak altitude as a fraction of the shot's ground distance (capped). */
  apexFrac: 0.35,
  apexMax: 260,
  /** The arc never climbs above this y, so the whole flight stays tappable. */
  ceiling: 26,
  /** Without radar, the impact reticle shows from this fraction of the flight. */
  reticleFrom: 0.25,
  /** Shortest flight (s) at wave speed ×1; it shrinks as waves speed up. Close
   *  bases would otherwise land a shot faster than a person can react. */
  minFlight: 2.6,
} as const;

export const GUIDED = {
  turnRate: 2.4,
  /** Extra turn rate added as it closes, so it doesn't orbit its target. */
  terminalTurn: 4,
  terminalRange: 200,
  /** From this wave on, some guided missiles go for the carrier instead. */
  carrierFromWave: 6,
  carrierShare: 0.3,
  /** Off the rail slowly: speed ramps from this fraction to full over `boost` s,
   *  so a launch is seen before it closes. */
  boostFrom: 0.3,
  boost: 1,
  /** Guided missiles take only this share of a wave's speed-up. */
  waveSpeedShare: 0.5,
} as const;

export const DRONE = {
  weaveAmp: 0.35,
  weaveFreq: 2.5,
} as const;

export type PickupKind = 'ammo' | 'repair' | 'overdrive' | 'emp';

export const PICKUPS = {
  life: 5,
  radius: 26,
  weights: { ammo: 40, repair: 30, overdrive: 22, emp: 8 } as Record<PickupKind, number>,
  repairHp: 2,
  carrierRepairHp: 3,
  overdriveTime: 5,
} as const;

/** Taps reach this far on screen (CSS px) — converted to world units by the UI. */
export const TAP_RADIUS_PX = 44;
