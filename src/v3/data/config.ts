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

/** Right-rail speed slider. Pure time scale: score is unaffected. Round 8:
 *  small steps up to 2× ("2 should be the max"); the dev playtest mode adds
 *  DEV_SPEED_STEPS on top. */
export const SPEED_STEPS: readonly number[] = [1, 1.25, 1.5, 2];
export const DEFAULT_SPEED = 0;
export const DEV_SPEED_STEPS: readonly number[] = [...SPEED_STEPS, 3, 4];
/** Watch mode (round 9): the bot plays, so it can run far faster than a
 *  person could. */
export const WATCH_SPEED_STEPS: readonly number[] = [1, 2, 3, 4, 6, 10];

export const CARRIER = {
  hp: 12,
  /** Collision ellipse half-axes (the deck is long and thin). */
  halfLength: 86,
  halfBeam: 22,
} as const;

export const INTERCEPTOR = {
  speed: 520,
  rack: 6,
  /** Seconds to reload one round into the rack. */
  reload: 1.35,
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
  // Aircraft (round 4): fly in from a screen edge, can be shot down.
  | 'strafer'
  | 'bomber'
  // Children: spawned by a cluster or a mothership, never launched by a base.
  | 'bomblet'
  | 'minidrone'
  // The 20-map plan. Over the water: a mine adrift on the current (Sowers'
  // Reach), a fast attack boat out of a cove (Smugglers' Coves).
  | 'mine'
  | 'fastboat'
  // Enemy structures with hit points: an oil rig (The Rig Field), a shield
  // generator and the Citadel (Citadel of Vey), the Dreadnought.
  | 'rig'
  | 'generator'
  | 'citadel'
  | 'dreadnought';

/** Enemy structures: you can shoot them, they never strike anything
 *  themselves, and (bar the Dreadnought) a wave can end with them standing. */
export const STRUCTURE_KINDS: ThreatKind[] = ['rig', 'generator', 'citadel', 'dreadnought'];

export function isStructure(kind: ThreatKind): boolean {
  return kind === 'rig' || kind === 'generator' || kind === 'citadel' || kind === 'dreadnought';
}

/** Threats a base launches (children excluded), in the order they debut. */
export const PRIMARY_KINDS: ThreatKind[] = ['drone', 'ballistic', 'guided', 'supersonic', 'heavy', 'cluster', 'mothership', 'strafer', 'bomber'];

export function zeroCounts(): Record<ThreatKind, number> {
  return {
    drone: 0, ballistic: 0, guided: 0, supersonic: 0, heavy: 0, cluster: 0, mothership: 0, strafer: 0, bomber: 0, bomblet: 0, minidrone: 0,
    mine: 0, fastboat: 0, rig: 0, generator: 0, citadel: 0, dreadnought: 0,
  };
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
  // Round 3: 4 hits fell in 2–6 s in the player's run; 8 makes it a real ammo sink.
  // Round 7: what the big one should do — a direct hit sinks any ship (armour
  // or not), takes half the carrier's health, and half the frigate's. The
  // impact code special-cases it; `damage` here is not used for heavies.
  heavy: { speed: 55, hp: 8, damage: 4, dropChance: 0.6, label: 'Heavy cruise missile' },
  /** Splits into bomblets close to its target unless it is hit first. */
  cluster: { speed: 170, hp: 1, damage: 0, dropChance: 0.25, label: 'Cluster missile' },
  /** Drifts at the carrier dropping mini-drones until it is shot down. */
  mothership: { speed: 38, hp: 5, damage: 4, dropChance: 0.7, label: 'Drone mothership' },
  /** Jet on a strafing run along the convoy: guns hit every hull under its line. */
  strafer: { speed: 270, hp: 3, damage: 1, dropChance: 0.6, label: 'Strike jet' },
  /** Slower aircraft that drops guided missiles on the convoy as it passes. */
  bomber: { speed: 175, hp: 3, damage: 0, dropChance: 0.6, label: 'Missile bomber' },
  bomblet: { speed: 260, hp: 1, damage: 1, dropChance: 0.02, label: 'Bomblet' },
  minidrone: { speed: 85, hp: 1, damage: 1, dropChance: 0.03, label: 'Mini-drone' },
  /** Drifts across the lane on the current; a ship that touches it takes 3. */
  mine: { speed: 27, hp: 1, damage: 3, dropChance: 0.08, label: 'Drifting mine' },
  /** Bursts out of a cove and rams a ship; leaves a white wake. */
  fastboat: { speed: 125, hp: 2, damage: 2, dropChance: 0.3, label: 'Fast attack boat' },
  /** Structures: hit points, no warhead. A kill always drops something. */
  rig: { speed: 0, hp: 40, damage: 0, dropChance: 1, label: 'Oil rig' },
  generator: { speed: 0, hp: 10, damage: 0, dropChance: 1, label: 'Shield generator' },
  citadel: { speed: 0, hp: 40, damage: 0, dropChance: 1, label: 'The Citadel' },
  dreadnought: { speed: 24, hp: 60, damage: 0, dropChance: 1, label: 'Dreadnought' },
};

/** The supertanker (The Behemoth Run): its hit points, the ships its loss
 *  counts as (the player's answer: three), from how far into a wave it
 *  sails, and its points multiplier when it comes through. */
// A heavy's direct hit sinks any ship outright, but the tanker takes
// `heavyHit` from one: two heavies, not one, are what sink it.
export const VIP = { hp: 8, loss: 3, after: 5, points: 4, targetShare: 0.3, heavyHit: 4 } as const;

/** Locks (Saltgate Canal): where a hull waits short of a shut gate, and how
 *  long each gate stays open (the fill wait is the map's, 6 s by the
 *  player's answer). */
export const LOCK = { stand: 44, inTime: 8, outTime: 6 } as const;

/** Allied structures: the radar's tracked-shot speed-up and the share of
 *  launches the enemy aims at a structure; a battery's rate of fire and how
 *  long a hit knocks it out. */
export const POST = { radarBoost: 1.5, targetShare: 0.22, batteryGap: 1.3, batteryDown: 12, hitRadius: 30 } as const;

/** Fast attack boats: how hard they turn onto a ship (rad/s). */
export const FASTBOAT = { turnRate: 2.2, hitRadius: 26 } as const;

/** Mines: how near a hull sets one off, and their wobble on the current. */
export const MINE = { hitRadius: 30, wobble: 6 } as const;

/** The Dreadnought: seconds between broadsides, and what each one fires. */
export const BOSS = { firstShot: 6, every: 7, broadside: ['ballistic', 'ballistic', 'guided'] as ThreatKind[] } as const;

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
  /** Damage to the other ships caught in the blast (the target takes full). */
  spill: 1,
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
  /** Off the rail slowly: speed ramps from this fraction to full over `boost` s,
   *  so a launch is seen before it closes. */
  boostFrom: 0.3,
  boost: 1,
  /** Guided missiles take only this share of a wave's speed-up. */
  waveSpeedShare: 0.5,
} as const;

/** Which threats go for the carrier instead of a ship, and from which wave.
 *  Playtest round 3: the carrier ended both real runs untouched, so losing
 *  it was never a risk; now missiles start hunting it from wave 3. */
export const CARRIER_STRIKE: Partial<Record<ThreatKind, { from: number; share: number }>> = {
  guided: { from: 3, share: 0.4 },
  ballistic: { from: 4, share: 0.25 },
  heavy: { from: 1, share: 0.4 },
  supersonic: { from: 1, share: 0.3 },
};

/** Waves come in raids: most launches bunch into a few seconds from several
 *  bases at once, with a short breather between, instead of a steady trickle
 *  (round 3: the screen sat empty 33–60% of every wave). */
export const RAID = {
  /** Seconds between raid starts. */
  every: 5,
  /** A raid's launches land within this many seconds of its start. */
  window: 4.5,
  /** Share of drones that still trickle in between raids. */
  trickle: 0.3,
  /** Seconds of warning before a raid: the bases about to fire light up and
   *  the raid's type is called out, so there is time to pick a formation. */
  warn: 2.5,
} as const;

/** Raids have a theme — one family of threat — so each calls for a
 *  different answer (round 3: formations need a reason to switch). */
export type RaidTheme = 'swarm' | 'barrage' | 'volley' | 'strike';

export const RAID_THEME: Record<ThreatKind, RaidTheme> = {
  drone: 'swarm',
  minidrone: 'swarm',
  mothership: 'swarm',
  mine: 'swarm',
  fastboat: 'swarm',
  rig: 'volley',
  generator: 'volley',
  citadel: 'volley',
  dreadnought: 'volley',
  ballistic: 'barrage',
  heavy: 'barrage',
  cluster: 'barrage',
  bomblet: 'barrage',
  guided: 'volley',
  supersonic: 'volley',
  bomber: 'volley',
  strafer: 'strike',
};

// ---- Round 4: attack vectors beyond the fixed bases -----------------------

/** A submarine surfaces in open water (periscope and wake first), fires a
 *  salvo, and dives. It is a launcher, not a target. */
export const SUB = {
  /** Periscope and wake before it breaks the surface. */
  warn: 2,
  surface: 0.8,
  /** Seconds between launches in a salvo. */
  gap: 0.75,
  dive: 1,
  /** A ballistic salvo is this long, back to back. */
  salvo: 4,
} as const;

/** Aircraft come in from a screen edge after an arrow warns of them. */
export const PLANE = {
  warn: 2.2,
  /** A strafing run's guns hit every hull within this distance of its line. */
  band: 60,
  /** Gun impacts walk this far ahead of the jet. */
  gunLead: 70,
  /** A bomber drops this many guided missiles on its pass, one every
   *  `dropEvery` s, starting when a hull is within `dropReach` ahead of it.
   *  It flies one of the map's `bomberLines` (open water off the lanes), and
   *  its air-launched missiles are light (one hit): round 4's first runs had
   *  them start on top of the ships and they sank ~2.8 ships a game. */
  bombs: 2,
  /** Run-in: no drops until a bomber is this far onto the screen (≈2.3 s to
   *  shoot it down first), and no strafing until a jet is this far in. Ships
   *  enter at the left edge, so without it a plane from the left had targets
   *  under it the moment it appeared. */
  bomberRunIn: 400,
  strafeRunIn: 250,
  dropEvery: 1.2,
  dropReach: 280,
} as const;

/** Missile trucks drive on enemy land: pop-ups drive to the shore, fire and
 *  reverse out; runners drive the whole shore road, stopping to fire. */
export const TRUCK = {
  speed: 75,
  runnerSpeed: 110,
  raise: 0.6,
  lower: 0.45,
  /** Seconds between launches while the launcher is up. */
  gap: 0.45,
} as const;

/** From which wave each vector joins a map, and how many per wave. */
export interface VectorPlan {
  trucks: number;
  subs: number;
  strafers: number;
  bombers: number;
}

export const DRONE = {
  weaveAmp: 0.35,
  weaveFreq: 2.5,
} as const;

// V3: EMP and Strike Package are no longer power-ups (Strike came back as
// the Air Strike weapon, data/abilities.ts). A 'weapon' pickup
// loads one of the weapons you hold into the gun (which one is on the pickup).
// 'starshell' (the 20-map plan, The Black Strait only): lights the dark sea.
export type PowerKind = 'ammo' | 'repair' | 'overdrive' | 'timewarp' | 'shield' | 'steam' | 'starshell';
export type PickupKind = PowerKind | 'weapon';

export const PICKUP_KINDS: PowerKind[] = ['ammo', 'repair', 'overdrive', 'timewarp', 'shield', 'steam', 'starshell'];

export const PICKUPS = {
  life: 5,
  radius: 26,
  // Round 5: repair 30 → 20 ("a little OP": 15 repairs in two games). V3:
  // EMP (8) and Strike (7) are gone, the rest keep their weights.
  weights: { ammo: 40, repair: 20, overdrive: 22, timewarp: 9, shield: 8, steam: 9, starshell: 0 } as Record<PowerKind, number>,
  /** A Star Shell's weight on a night map, and how long its light lasts. */
  starshellWeight: 16,
  starshellTime: 6,
  repairHp: 2,
  carrierRepairHp: 2,
  overdriveTime: 5,
  /** Time Warp: threats move at this share of their speed. */
  warpTime: 4,
  warpScale: 0.4,
  /** Shield: ships and carrier take no damage. */
  shieldTime: 5,
  /** Full Steam: the convoy moves this much faster. */
  steamTime: 5,
  steamMult: 1.6,
} as const;

/** Taps reach this far on screen (CSS px) — converted to world units by the UI. */
export const TAP_RADIUS_PX = 44;
