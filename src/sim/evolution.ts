// Enemy evolution engine. The enemy runs its own hidden research: it earns
// tech points each round (faster when the player is doing well — a deliberate
// anti-snowball) and allocates them in response to observed player behavior.
// Scripted floors guarantee the designed early-campaign beats regardless of
// play style; fairness caps keep a new capability's first appearance small.

import { EVOLUTION, ROUND1, SIM, SPAWN, WORLD } from '../data/tuning';
import type { RNG } from './rng';
import type {
  CampaignState,
  EvolutionState,
  EvolutionTracks,
  IntelWarning,
  MinePlacement,
  RoundMetrics,
  RoundPlan,
  SpawnEvent,
  TechKey,
} from './types';

export function newEvolution(): EvolutionState {
  return {
    tracks: { saturation: 20, guidance: 0, mines: 0, lowSig: 0 },
    firstSeen: {},
    metrics: [],
    pendingWarnings: [],
  };
}

// ---------------------------------------------------------------------------
// Learning: called once per resolved round, before planning the next one.
// ---------------------------------------------------------------------------

export function evolveEnemy(evo: EvolutionState, metrics: RoundMetrics, rng: RNG): void {
  evo.metrics.push(metrics);

  // --- Earn tech points (the enemy adapts faster against a winning player) --
  let points = EVOLUTION.basePoints + EVOLUTION.pointsPerRound * metrics.round;
  if (metrics.deliveredFraction >= 0.85) points += EVOLUTION.bonusStrongDelivery;
  if (metrics.interceptRate > 0.7) points += EVOLUTION.bonusHighIntercept;
  const baseline = evo.metrics[0]?.valueSent ?? metrics.valueSent;
  if (metrics.valueSent > baseline * 1.3) points += EVOLUTION.bonusRichConvoy;

  // --- Allocation weights, adjusted by what the player has been doing -------
  const weights: EvolutionTracks = { saturation: 1.0, guidance: 0.7, mines: 0.4, lowSig: 0 };

  const recent = evo.metrics.slice(-2);
  const avgIntercept = recent.reduce((a, m) => a + m.interceptRate, 0) / recent.length;
  if (avgIntercept > 0.6) {
    // Player is shooting missiles down reliably: seek guidance and volume.
    weights.guidance += 1.0;
    weights.saturation += 0.4;
  }

  const last3 = evo.metrics.slice(-3);
  const tightRounds = last3.filter((m) => m.formation === 'tight').length;
  if (tightRounds >= 2) {
    // Dense formations invite area-denial weapons.
    weights.mines += 1.0;
  }

  const mineRounds = recent.filter((m) => m.mineDetectRate >= 0);
  if (mineRounds.length > 0 && evo.tracks.mines >= EVOLUTION.minesUnlock) {
    const avgDetect = mineRounds.reduce((a, m) => a + m.mineDetectRate, 0) / mineRounds.length;
    if (avgDetect > 0.5) {
      // Player counters mines: develop low-signature casings.
      weights.lowSig += 2.0;
    }
  }

  const totalWeight = weights.saturation + weights.guidance + weights.mines + weights.lowSig;
  for (const key of Object.keys(weights) as (keyof EvolutionTracks)[]) {
    evo.tracks[key] += (points * weights[key]) / totalWeight;
  }

  // --- Scripted floors keep the early beats on schedule ---------------------
  for (const floor of EVOLUTION.floors) {
    if (metrics.round >= floor.afterRound) {
      evo.tracks[floor.track] = Math.max(evo.tracks[floor.track], floor.value);
    }
  }

  // --- Intelligence warnings about capabilities the player hasn't met yet ---
  evo.pendingWarnings = buildWarnings(evo, rng);
}

const WARNING_TEXTS: Partial<Record<TechKey, string>> = {
  guidedMissile:
    'Signals intercepts suggest the enemy is testing terminal-guidance seekers for its anti-ship missiles.',
  mine: 'Coastal traffic reports unusual enemy small-boat activity consistent with minelaying rehearsals.',
  lowSigMine:
    'Analysts believe the enemy is developing composite mine casings designed to defeat standard sonar.',
};

function buildWarnings(evo: EvolutionState, rng: RNG): IntelWarning[] {
  const checks: { key: TechKey; track: keyof EvolutionTracks; unlock: number }[] = [
    { key: 'guidedMissile', track: 'guidance', unlock: EVOLUTION.guidanceUnlock },
    { key: 'mine', track: 'mines', unlock: EVOLUTION.minesUnlock },
    { key: 'lowSigMine', track: 'lowSig', unlock: EVOLUTION.lowSigUnlock },
  ];
  const warnings: IntelWarning[] = [];
  for (const check of checks) {
    if (evo.firstSeen[check.key] !== undefined) continue; // already encountered
    const value = evo.tracks[check.track];
    if (value < check.unlock - EVOLUTION.warningProximity) continue;
    const closeness = Math.min(1, value / check.unlock);
    warnings.push({
      track: check.track,
      text: WARNING_TEXTS[check.key] ?? '',
      confidencePct: Math.round(55 + closeness * 30 + rng.range(0, 10)),
    });
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// Planning: generate everything the enemy will do in the upcoming round.
// ---------------------------------------------------------------------------

export function planRound(campaign: CampaignState, rng: RNG): RoundPlan {
  const round = campaign.round;
  const evo = campaign.evolution;
  const debuts: TechKey[] = [];
  const shipsOut = Object.values(campaign.composition).reduce((a, b) => a + b, 0);

  // Fire window spans the whole transit: from windowStartT until the last ship
  // (which enters at ~shipsOut * spawn interval) has had time to cross. Missiles
  // are spread across this whole span, so there is never a long silent gap at
  // the end while ships are still in the strait.
  const windowEnd = Math.min(
    SIM.maxTransitTime - 20,
    SPAWN.firstDelay + shipsOut * SPAWN.interval + EVOLUTION.windowTailT,
  );

  if (round === 1) {
    // Scripted onboarding: a light unguided probe, spread across the transit.
    return {
      round,
      spawns: scheduleMissiles(ROUND1.missileCount, 1, rng, 'missile', EVOLUTION.windowStartT, windowEnd),
      mines: [],
      debuts: ['missile'],
    };
  }

  const tracks = evo.tracks;

  // Missiles: a controlled TOTAL count (scales with round + saturation doctrine),
  // spread across the full fire window above.
  const missileCount = Math.min(
    EVOLUTION.missileCountCap,
    Math.round(
      EVOLUTION.missileCountBase +
        round * EVOLUTION.missileCountPerRound +
        tracks.saturation * EVOLUTION.missileCountSat,
    ),
  );
  const volleySize = 1 + Math.floor(tracks.saturation / EVOLUTION.volleySatDivisor);

  let guidedCount = 0;
  if (tracks.guidance >= EVOLUTION.guidanceUnlock) {
    const share = Math.min(0.65, 0.2 + (tracks.guidance - EVOLUTION.guidanceUnlock) / 120);
    guidedCount = Math.round(missileCount * share);
    if (evo.firstSeen.guidedMissile === undefined) {
      guidedCount = Math.min(guidedCount, EVOLUTION.firstGuidedCap);
      guidedCount = Math.max(guidedCount, 1); // a debut actually happens
      debuts.push('guidedMissile');
    }
  }
  const basicCount = Math.max(0, missileCount - guidedCount);

  const spawns = [
    ...scheduleMissiles(basicCount, volleySize, rng, 'missile', EVOLUTION.windowStartT, windowEnd),
    ...scheduleMissiles(guidedCount, volleySize, rng, 'guidedMissile', EVOLUTION.windowStartT, windowEnd),
  ];

  // Mines --------------------------------------------------------------------
  const mines: MinePlacement[] = [];
  if (tracks.mines >= EVOLUTION.minesUnlock) {
    let mineCount = Math.min(
      EVOLUTION.mineCap,
      EVOLUTION.mineBase + Math.floor((tracks.mines - EVOLUTION.minesUnlock) / EVOLUTION.mineTrackDivisor),
    );
    if (evo.firstSeen.mine === undefined) {
      mineCount = Math.min(mineCount, EVOLUTION.firstMinefieldCap);
      debuts.push('mine');
    }

    let lowSigCount = 0;
    if (tracks.lowSig >= EVOLUTION.lowSigUnlock) {
      const share = Math.min(0.7, 0.4 + (tracks.lowSig - EVOLUTION.lowSigUnlock) / 150);
      lowSigCount = Math.round(mineCount * share);
      if (evo.firstSeen.lowSigMine === undefined) {
        lowSigCount = Math.min(lowSigCount, EVOLUTION.firstLowSigCap);
        lowSigCount = Math.max(lowSigCount, 1);
        debuts.push('lowSigMine');
      }
    }

    // One cluster for small fields, two for larger ones. The FIRST minefield
    // is always laid in the main shipping channel (the convoy's default lane)
    // so the debut is actually encountered; later fields spread randomly.
    const clusters = mineCount > 6 ? 2 : 1;
    const laneChoices =
      evo.firstSeen.mine === undefined
        ? [1]
        : rng.shuffle([...WORLD.lanes.keys()]).slice(0, clusters);
    for (let i = 0; i < mineCount; i++) {
      const lane = laneChoices[i % clusters];
      const cx = rng.range(850, 1450);
      mines.push({
        x: cx + rng.range(-130, 130),
        y: WORLD.lanes[lane] + rng.range(-75, 75),
        lowSig: i < lowSigCount,
      });
    }
  }

  return { round, spawns, mines, debuts };
}

/** Spread `count` missile launches across [windowStart, windowEnd] in volleys
 *  of the given size, jittered so they never arrive on a metronome. */
function scheduleMissiles(
  count: number,
  volleySize: number,
  rng: RNG,
  kind: 'missile' | 'guidedMissile',
  windowStart: number,
  windowEnd: number,
): SpawnEvent[] {
  const spawns: SpawnEvent[] = [];
  if (count <= 0) return spawns;
  const size = Math.max(1, volleySize);
  let spawned = 0;
  while (spawned < count) {
    const volleyTime = rng.range(windowStart, windowEnd);
    const site = rng.pick(WORLD.launchSites);
    const inVolley = Math.min(size, count - spawned);
    for (let i = 0; i < inVolley; i++) {
      spawns.push({
        time: volleyTime + rng.range(0, 1.4),
        kind,
        siteX: site.x + rng.range(-60, 60),
      });
      spawned++;
    }
  }
  return spawns;
}
