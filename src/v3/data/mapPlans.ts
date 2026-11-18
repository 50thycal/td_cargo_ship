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
      plan: 'The Breakout as it was (swarms, a sprint swarm, rocket trucks down both shore roads, a Hydra fan), plus submarine salvos into the neck: round 1 one salvo of 3, round 2 two salvos (3 and 2), round 3 one salvo of 3 and a fan of 4 Hydras (encounters rev 4, MAP_BOSS; round 3 softened after the playtest, log v27). The bot predicts these rounds about as the player meets them (playtest: bot 1.9 a round, player 2.0), so the target is a ship a round, not two.',
      botTarget: 1,
    },
  },
};

export function mapPlan(map: MapId): MapPlan | undefined {
  return MAP_PLANS[map];
}
