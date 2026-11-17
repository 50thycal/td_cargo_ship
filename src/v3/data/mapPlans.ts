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
  // The map card: docs/design/v3-p4-gauntlet.md.
  gauntlet: {
    problem: 'Enemy on both shores and one carrier between them: whichever shore you turn to, the other one fires at the ships coming in.',
    // The waves send swarms off both west silos at once onto the way in
    // (area weapons take a whole one in a shot), and the boss brings
    // armoured trucks with swarms for company. Measured with the bots
    // (docs/design/v3-p4-gauntlet.md, Kits): the best of seven kits, with
    // the player's Armory and without.
    counters: ['shrapnel', 'thermo', 'flak'],
    // Weapons that fire themselves: they cover the shore you are not
    // looking at, but spread their fire where the way in needs it massed
    // (the worst of the seven).
    offCounter: ['aegis', 'seeker', 'droneScreen'],
    convoy: 'Two lines of ships, one each side of the carrier, sailing west to east on their own (no commands): the shores are the problem, so the convoy stays simple and every ship passes both west silos on the way in.',
    stretches: { danger: 'early', safe: 'late' },
    boss: {
      plan: 'The Rocket Convoy: a column of armoured rocket trucks down each shore road with drone swarms for company, built up round by round (round 1: three trucks a column and one swarm of five; round 2: three trucks and two swarms of five; round 3: four trucks and two swarms of three), 15-30 s each.',
      botTarget: 1,
    },
  },
};

export function mapPlan(map: MapId): MapPlan | undefined {
  return MAP_PLANS[map];
}
