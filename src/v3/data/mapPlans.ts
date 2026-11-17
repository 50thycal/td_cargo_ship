// The map cards' design plan (map rebuild phase 4; the rules in
// docs/design/v3-map-wave-rules.md): what each rebuilt map is built around.
// Designer data, never shown in the game except where a field says so.
//   - problem: the map's one problem, in one sentence (rule m-dilemma).
//   - counters: the weapons the map's threats favour (rule m-kits): the
//     bots play the map with these as their kit and with `offCounter`, and
//     the counter kit should do clearly better, neither trivially.
//   - convoy: how ships come and why (rule m-shape-convoy).
//   - stretches: the danger stretch and the safe stretch, by third of the
//     lane ('early' | 'middle' | 'late'), as the bot report measures them.
//   - boss: the plan for the three boss rounds, and the target on the bot's
//     scale (ships a round; docs/design/v3-bot-refit.md: the Strait's and
//     Harbor's boss rounds read about twice as hard to the bot).

import type { AbilityId } from './abilities';
import type { MapId } from './maps';

export type Stretch = 'early' | 'middle' | 'late';

export interface MapPlan {
  problem: string;
  counters: AbilityId[];
  offCounter: AbilityId[];
  convoy: string;
  stretches: { danger: Stretch; safe: Stretch };
  boss: { plan: string; botTarget: number };
}

/** Filled in map by map as each is rebuilt (phase 4: the three reference
 *  maps first). */
export const MAP_PLANS: Partial<Record<MapId, MapPlan>> = {
  // docs/design/v3-p4-harbor.md
  harbor: {
    problem: 'Every ship has to pass the neck, where the lane closes and the convoy bunches up under both headlands, just before delivery.',
    // The neck's fire comes at short warning onto one spot: sub salvos off
    // the narrows, shells from the mouth, swarms from both headlands, a
    // missile at the ship about to deliver. Fast aimed taps meet it, and the
    // Railgun's line down the funnel takes what converges there. Weapons
    // that fire themselves spread their shots over the whole board.
    counters: ['overdrive', 'railgun', 'focus'],
    offCounter: ['airstrike', 'seeker', 'droneScreen'],
    convoy: 'Wide apart on the open water (2.2 times the slots), closing up into single file at the neck from x 700 (round 11): the open water forgives, the neck does not.',
    stretches: { danger: 'middle', safe: 'early' },
    boss: {
      plan: 'The Breakout as it was (swarms, a sprint swarm, rocket trucks down both shore roads, a Hydra fan), plus submarine salvos into the neck, one more salvo or Hydra each round: round 1 one salvo of 3, round 2 two salvos (3 and 2), round 3 two of 3 and a fan of 4 Hydras (encounters rev 4, MAP_BOSS).',
      botTarget: 2,
    },
  },
};

export function mapPlan(map: MapId): MapPlan | undefined {
  return MAP_PLANS[map];
}
