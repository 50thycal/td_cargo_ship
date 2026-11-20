// The map cards' design plan (map rebuild phase 4; the rules in
// docs/design/v3-map-wave-rules.md): what each rebuilt map is built around.
// Designer data, never shown in the game except where a field says so.
//   - problem: the map's one problem, in one sentence (rule m-dilemma).
//   - counters: the weapons the map's threats favour (rule m-kits): the
//     bots play the map with these as their kit and with `offCounter`, and
//     the counter kit should do clearly better, neither trivially. A design
//     note and a bot report's kit only: never shown to the player, and the
//     draft is not weighted by it (round 8, the player: "we really should
//     not nudge the player with these kits. They should just figure that
//     out alone through play testing"; tests/v3/mapRules.test.ts).
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
  // Chapter 1 (docs/design/v3-ch1-kesh.md): the Kesh Hook, rebuilt to the
  // rules after the reference maps. Its hook is a shape, not a mechanic.
  kesh: {
    problem: 'Every ship rounds the hook hard against the enemy\'s outer bank: at the apex of the turn the convoy bunches and passes right under the south silo, where the warning is shortest; once round, it sails out under the carrier\'s guns.',
    // The apex's fire comes from close, at short warning, onto ships
    // bunched in the turn: fast aimed taps meet it, and the Railgun's line
    // runs through the bunch. Weapons that fire themselves spread their
    // shots over the whole hook (bots, player Armory: docs/design/
    // v3-ch1-kesh.md, Kits).
    counters: ['overdrive', 'railgun', 'focus'],
    offCounter: ['airstrike', 'seeker', 'droneScreen'],
    convoy: 'The map\'s own convoy, no commands: pairs sailing east along the south bank and round the hook to the north edge. The lane does the shaping: the turn brings every pair past the south silo, one after another, before it straightens out under the carrier.',
    stretches: { danger: 'middle', safe: 'late' },
    boss: {
      plan: 'The Drone Storm round the hook: drone swarms off the outer bank in turn and no ammo drops (36, 36, then 42 drones, the second half 6, 6, then 5.5 s after the first), with shells at the ship nearest each shell silo (3, 2, 3) and guided missiles at the ship halfway along (none, 1, then 3); 15-30 s each (encounters rev 4, MAP_BOSS; lab only). Log v29, after the playtest ("the boss was way too easy": 0, 0 and 1 ships lost): the shells and missiles are new, so round 3 is harder by what it sends.',
      // The player lost 0 / 0 / 1 where the bot read 0.6 / 1.3 / 1.3 (the
      // bot reads boss rounds about twice as hard as the player): about
      // 1.5 / 2 / 2.5 on the bot should land the player near 1 a round.
      botTarget: 2,
    },
  },
  // Chapter 1 (docs/design/v3-ch1-marrow.md): Lee of Marrow, its radar
  // tower the map's one mechanic.
  marrow: {
    problem: 'The radar on the island slows every enemy drone and missile over the middle of the lane to about two thirds of its pace (log v29; it used to speed your shots), right where the middle silo fires down on the ships; the enemy goes for the tower, and once it falls it is gone for the run.',
    // The tower wants your taps as much as the ships do: weapons that fire
    // themselves (each ship's Point Defense, the Seeker Pod, the Drone
    // Screen) keep shooting at the stretch under the island, where the radar
    // speeds their shots too, while your hand goes to the tower. Weapons
    // that need your hand (Scattergun, Railgun, Overdrive) do worst (bots,
    // player Armory: docs/design/v3-ch1-marrow.md, Kits).
    counters: ['aegis', 'seeker', 'droneScreen'],
    offCounter: ['scatter', 'railgun', 'overdrive'],
    convoy: 'The map\'s own convoy, no commands: pairs in one wide lane, west to east, under the island and its radar halfway along. The mechanic needs no command: the tower is defended by shooting, not by sailing.',
    stretches: { danger: 'middle', safe: 'early' },
    boss: {
      plan: 'Hydra Bloom at the tower: each round opens with guided missiles at the radar (one, one, then two; at the ship nearest where it stood once it has fallen), then two fans of Hydras from every silo, each Hydra splitting into three, and a drone swarm from round 2; 15-30 s each (encounters rev 4, MAP_BOSS; lab only).',
      botTarget: 1,
    },
  },
  // ---- Chapter 2, The Narrows (docs/design/v3-ch2-island.md,
  // v3-ch2-behemoth.md) ----
  island: {
    problem: 'The enemy island sits between the two lanes: its silos fire on the ships passing it from closer than any shore, with almost no warning, and the fast north lane runs between the island and the far shore, furthest from your carrier.',
    // The island's fire is swarms from point-blank range onto ships
    // bunched beside it, too close for a shot from the carrier to get
    // there first: helpers that fight on their own over the convoy (the
    // Gunship Pair's rockets at the thickest cluster, the Drone Screen) and
    // the Gravity Well, which pulls a swarm off the lane. Slow aimed
    // weapons and the Seeker's long flight are too late at that range
    // (bots, the player's Armory: docs/design/v3-ch2-island.md, Kits).
    // Every weapon is in chapter 2's draft.
    counters: ['well', 'droneScreen', 'gunships'],
    offCounter: ['railgun', 'seeker', 'lance'],
    convoy: 'The map\'s own convoy, no commands: pairs west to east, two groups in three in the wide south lane, the third making a fast run up the narrow north lane between the island and the far shore.',
    stretches: { danger: 'middle', safe: 'late' },
    boss: {
      plan: 'The Gunship Wall off the island: attack helicopters in a line on the island\'s side of the south lane, firing missile pairs in turn, with drone swarms; 3, 4, then 4 tougher helicopters, with shells from the island\'s east silo at the ship beside it and, from round 2, guided missiles from the far shore at the north lane (encounters rev 4, MAP_BOSS; lab only).',
      botTarget: 2,
    },
  },
  behemoth: {
    problem: 'Once a wave the supertanker crawls along the deep lane right under the enemy shore: it takes eight hits but counts as three ships, so the heavies and missiles that go for it pull your gun north while the convoy sails the lane below.',
    // The tanker soaks hits that add up: the Shield (chapter 2's new boost)
    // takes the missiles and drones off every hull for 15 s, the Frigate
    // Escort sails with the convoy, and the Air Strike breaks up what the
    // shore sends at the deep lane. Weapons that fight drones one by one
    // (Scattergun, Tesla, Seeker) leave the heavies and the shells to land
    // (bots, the player's Armory: docs/design/v3-ch2-behemoth.md, Kits).
    counters: ['shield', 'frigate', 'airstrike'],
    offCounter: ['scatter', 'tesla', 'seeker'],
    convoy: 'The map\'s own convoy, no commands: pairs west to east in the main lane, and once a wave the supertanker on its own, slower, in the deep lane under the north shore.',
    stretches: { danger: 'middle', safe: 'early' },
    boss: {
      // Log v33 (round 9, r9-ch2-split): something the Shield doesn't stop.
      plan: 'A strike on the supertanker (log v33): strike jets in pairs down the deep lane at the tanker and over the convoy (10, 12, then 12), which the Shield never stops, a heavy cruise missile at the tanker each round (2 in round 3), and what is left of the Wolf Pack: no sub, then 1, then 2 (encounters rev 4, MAP_BOSS; lab only).',
      botTarget: 2,
    },
  },
  // docs/design/v3-ch2-needle.md
  needle: {
    problem: 'Open water narrows to a gap one hull wide: the convoy closes into single file and queues at the mouth, right between the two enemy headlands, where one cluster, one shell or one wall of armored drones finds ships nose to tail.',
    // The headlands fire from point-blank range onto ships bunched nose to
    // tail, too close for a shot from the carrier to get there first: each
    // ship's own Point Defense, which in a column covers the ship ahead and
    // behind; the Thermobaric Shell's blast, which goes round an armored
    // wall's plates and takes a cluster with what is near it; the Gunship
    // Pair's rockets at the thickest cluster, the queue. The Frigate Escort
    // can't follow the convoy through the Needle (its frigates back out of
    // the narrows), the Seeker Pod's long flight is too late at the mouth,
    // and the Drone Screen fights one drone at a time (forced, 7.3 ships a
    // run against 9.6; bots, the player's Armory: docs/design/
    // v3-ch2-needle.md, Kits). Every weapon is in chapter 2's draft.
    counters: ['aegis', 'thermo', 'gunships'],
    offCounter: ['seeker', 'frigate', 'droneScreen'],
    convoy: 'The map\'s own convoy, no commands: pairs west to east across open water, falling into single file as the lane closes to one hull wide, queueing at the mouth and threading the Needle between the headlands.',
    stretches: { danger: 'late', safe: 'early' },
    boss: {
      plan: 'The Shield Wall at the mouth: one block of armored drones from the north shore at one ship, plates forward, banking together (8, 9, then 10 drones, 4, 3 and 5 wide; the event sends 12 every round), each round with a cluster from the north headland over the queue early and a shell into the Needle late (encounters rev 4, MAP_BOSS; lab only).',
      botTarget: 2,
    },
  },
  // docs/design/v3-ch2-archipelago.md
  archipelago: {
    problem: 'A chain of enemy islets lines the one lane: the islets, the gaps between them, the far shore and the water behind the convoy all fire, so threats come from several directions at once, and the west end, where the ships come in, is the longest reach from your carrier.',
    // Every threat ends on the one lane, from whichever side it came: the
    // Air Strike's jet down that row takes all that converge on it (a
    // mothership's five hits among them), each ship's own Point Defense
    // needs no reach to the far west end, and the Flak Cannon's cloud waits
    // over the lane where they arrive. The Seeker Pod's long flight is too
    // late at the long reach, the Railgun's line takes one direction at a
    // time, and the Drone Screen fights one drone at a time (forced, the
    // combo sweep's singles: docs/design/v3-ch2-archipelago.md, Kits).
    // Every weapon is in chapter 2's draft.
    counters: ['airstrike', 'aegis', 'flak'],
    offCounter: ['seeker', 'railgun', 'droneScreen'],
    convoy: 'The map\'s own convoy, no commands: pairs west to east down one lane under the chain of islets, coming in at the far west end, a long reach from the carrier, and delivering in the east beside it.',
    stretches: { danger: 'early', safe: 'late' },
    boss: {
      plan: 'The Supply Raid from every side: the event\'s cargo runs and scavengers, one weapon in the round\'s first cargo run and supplies only in the second (the event gives one for each weapon held, in both); its drone swarms off the islets (6 of 7, 6 of 9, 6 of 9; the event sends 5 of 6 every round), and the signature with them: 2, 3, then 3 drone motherships off the west islet early in the round, with 3, 4, then 5 shells from the far shore and clusters off the west islet at the ships coming in, and a guided missile from the east islet at the lead ship (encounters rev 4, MAP_BOSS; lab only).',
      botTarget: 2,
    },
  },
  // docs/design/v3-ch2-saltgate.md
  saltgate: {
    problem: 'Two locks stop the convoy: every ship waits still in a chamber while it fills, right under the silos over the locks, so the enemy fires at ships that cannot move, with banks close on both sides and little warning.',
    counters: ['shrapnel', 'aegis', 'thermo'],
    offCounter: ['seeker', 'railgun', 'frigate'],
    convoy: 'The map\'s own convoy, no commands: pairs west to east down the canal; each lock takes what its chamber holds, shuts and fills, so the ships sail in short bursts and wait, bunched and still, at each gate.',
    stretches: { danger: 'late', safe: 'middle' },
    boss: {
      plan: 'Run the Canal, rising: Torpedo Subs as the round opens (2, 3, 3; the event sends 2), a gunship over the far bank by a lock (1, 1, then 2; 4 then 5 hits), a block of armored drones (4, 6, 6; the event sends 4) and drone swarms (2 of 5, 2 of 6, 3 of 6; the event sends 1 of 5), with clusters and guided missiles off the silos over the locks at the ships held in them (encounters rev 4, MAP_BOSS; lab only).',
      botTarget: 2,
    },
  },
};

export function mapPlan(map: MapId): MapPlan | undefined {
  return MAP_PLANS[map];
}
