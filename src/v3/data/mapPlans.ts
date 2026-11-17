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
  // The Strait (docs/design/v3-p4-strait.md). It keeps its design (open
  // water, one enemy shore: the player's call, round 1); its waves follow
  // the rules (data/encounters.ts, STRAIT_R4).
  strait: {
    problem: 'Everything comes off the one north shore, and the further east the ships sail the nearer the launchers and the shorter the warning: the ships about to deliver are the ones you have least time to save.',
    // What the waves send: drone and sprint swarms off the shore, Hydras
    // that split into darts, then shells, missiles and swarms converging on
    // the lead ship. Area fire that waits where they converge (a flak cloud,
    // a shrapnel burst) and a screen round the ships answer that; aimed
    // one-at-a-time weapons and a slow strike do not (bots, player Armory:
    // won 42% against 17%, end wave 12.4 against 11.3).
    counters: ['flak', 'shrapnel', 'droneScreen'],
    offCounter: ['railgun', 'airstrike', 'frigate'],
    convoy: 'The map\'s own convoy, no commands: one lane down the middle of open water, ships sailing west to east in a steady line, so the lead ship is always the one in the short-warning east and the rest are still in the long-warning west.',
    stretches: { danger: 'late', safe: 'early' },
    boss: {
      plan: 'The Afterburner Rush: sprint swarms cruising slowly in off the north shore, a Hydra riding behind each; 7, then 9, then 10 of each (6 in every round before), so the rounds rise; 17-29 s each.',
      botTarget: 2,
    },
  },
};

export function mapPlan(map: MapId): MapPlan | undefined {
  return MAP_PLANS[map];
}
