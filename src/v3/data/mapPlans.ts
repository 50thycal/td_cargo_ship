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
    // The fire comes point-blank off the lock silos and from the seas at
    // ships that cannot move: each ship's own Point Defense needs no warning
    // and no reach, the Gunship Pair's rockets go for the thickest bunch of
    // ships (a full chamber), and Supply Run keeps the rack full through the
    // long waits at the gates. The Seeker Pod's long flight is too late for
    // a silo 200 px from its target, the Shield breaks after its few hits on
    // a chamber that takes a cluster's bomblets at once, and Full Steam
    // cannot hurry a ship through a shut gate (forced, 16 seeds: 6.6 ships
    // lost against 10.3; docs/design/v3-ch2-saltgate.md, The counters).
    // Every weapon is in chapter 2's draft.
    counters: ['aegis', 'gunships', 'supplyRun'],
    offCounter: ['seeker', 'shield', 'fullSteam'],
    convoy: 'The map\'s own convoy, no commands: pairs west to east down the canal at the campaign\'s own schedule; each lock takes what its chamber holds, shuts and fills, so the ships sail in short bursts and wait, bunched and still, at each gate.',
    stretches: { danger: 'middle', safe: 'early' },
    boss: {
      plan: 'The Gatecrashers (log v42, the player\'s answer: lots of trucks), rising: columns of Rocket Trucks (4 hits each, in at 2.2 × a truck\'s speed) down to the banks by the locks, each salvo at a ship held at the lock nearest the truck and marked first; round 1 a column of 8 on the enemy\'s bank by the west lock (2 salvos each), round 2 4 there and 4 on your own bank (2 each), round 3 a charge of 13 at both locks and both banks (1 salvo each; the last truck of each north column fires a cluster over the chamber); a drone swarm of 5 each round. A wreck stalls the trucks behind it. In place of Run the Canal\'s subs, gunships and block (encounters rev 4, MAP_BOSS; lab only: the campaign plays Run the Canal).',
      botTarget: 2,
    },
  },
  // ---- Chapter 3, Dark Water (docs/design/v3-ch3-battery.md) ----
  battery: {
    problem: 'Two shore guns of your own on the headland cover the east of the lane, where the ships deliver, while they stand: the enemy\'s shells and heavies go for the guns first, and each one knocked out leaves the ships under it uncovered for twelve seconds, while the middle of the lane, between your carrier and the guns, is covered by neither.',
    // The fire is heavies at the guns (eight hits each, slow), shells at
    // them and at the ships, siege guns, and swarms at the middle of the
    // lane, which neither the carrier nor the guns cover. The Frigate
    // Escort's frigates sail with the convoy through that middle; the
    // Railgun's line reaches a heavy all the way in and a siege gun on the
    // shore; the Gravity Well pulls a swarm off the lane before it gets
    // there. The Seeker Pod's long flight is late for a shell, the
    // Scattergun and the Tesla Arc fight at short range what comes at the
    // middle from far (forced, the combo sweep's singles: Frigate Escort
    // 4.8, Gravity Well 5.6, Railgun 5.8 against Seeker 9.0, Scattergun 9.2,
    // Tesla 8.3; docs/design/v3-ch3-battery.md, The counters). Every weapon
    // is in chapter 3's draft.
    counters: ['frigate', 'railgun', 'well'],
    offCounter: ['seeker', 'scatter', 'tesla'],
    convoy: 'The map\'s own convoy at the campaign\'s schedule, no commands: pairs west to east down one lane, past the carrier in the west, through the open middle and under the shore guns on the headland to deliver in the east.',
    stretches: { danger: 'middle', safe: 'early' },
    boss: {
      plan: 'The Blackout at the guns: night, stealth strafers from alternate sides (7, 8, then 9, 2.4, 2.3 and 2.2 s apart; the event sends 8, 2.4 s apart, every round), with shells from the silo across from the headland (2, 2, then 3) and a heavy cruise missile (1, 1, then 2) at your shore guns each round, so the guns that shoot at the jets are the first target (encounters rev 4, MAP_BOSS; lab only). Rising below the asked 1.5 / 2 / 2.5 a round on the bot, as on chapter 2\'s maps, to keep the win rate up.',
      botTarget: 2,
    },
  },
  // docs/design/v3-ch3-sowers.md
  sowers: {
    problem: 'Mines drift down across the lane on the current, from three chutes on the far shore and from stealth bombers that sow them just ahead of the ships: a ship cannot steer round one and one sinks it, so each must be shot or waited out with Hold, while the shells, missiles and swarms keep coming, most of all at the middle of the lane, where the middle chute\'s curtains cross and a held convoy sits still.',
    // The fire is mines in strings and curtains across the lane (one hit
    // each, but every one in a ship's way must go), sown by stealth bombers
    // just ahead of the ships, and swarms and clusters at the lead ship in
    // the east. The Tesla Arc's chain jumps along a string of mines and the
    // swarm beside it in one shot, the Flak Cannon's cloud waits where a
    // curtain crosses the lane, and the Shield takes the hit of the mine
    // that gets through. The Seeker Pod's long flight is late for a mine
    // sown just ahead of a ship, the Shrapnel Shell's burst needs a bunch
    // the drifting strings rarely make, and Full Steam sails the convoy into
    // the mines faster (forced, the combo sweep's singles at log v48: Tesla
    // 4.7, Flak 5.8, Shield 5.8 against Seeker 7.7, Shrapnel 7.8, Full Steam
    // 13.2; docs/design/v3-ch3-sowers.md, The counters). Every weapon is in
    // chapter 3's draft.
    counters: ['tesla', 'flak', 'shield'],
    offCounter: ['seeker', 'shrapnel', 'fullSteam'],
    convoy: 'The map\'s own convoy at the campaign\'s schedule, with Hold, the map\'s one command (rule m-convoy: the mines need it): pairs west to east down one lane under the three chutes, past the carrier in the middle, delivering in the east under the silos over the east end; Hold stops every ship for up to 6 s so a string of mines can drift through, at the cost of sitting still under the rest of the wave.',
    stretches: { danger: 'middle', safe: 'early' },
    boss: {
      plan: 'The Carpet Run sowing: vees of three stealth bombers across the lane (2, 3, then 3; 8, 8 and 7 s apart; 3 hits each), each sowing 3 mines just ahead of the convoy in place of its missiles (the event sends 2 vees, 11 s apart, dropping guided missiles, every round), with mines off the chutes (3, 3, then 6), 3 shells from the east silo and guided missiles from the enemy\'s bank in the south-east (1, 1, then 2) at the lead ship (encounters rev 4, MAP_BOSS; lab only). Rising below the asked 1.5 / 2 / 2.5 a round on the bot, as on the Battery, to keep the win rate up.',
      botTarget: 2,
    },
  },
  // docs/design/v3-ch3-rigs.md
  rigs: {
    problem: 'Four enemy oil rigs stand in the sea just above the lane and fire at the ships from point-blank, the shortest flights on the map: each takes forty hits and one brought down stays down (its fire moves to the far shore, a long flight), but every shot at a rig is one not at a missile, and from wave 4 the enemy tows relief rigs in to stand where one fell.',
    // The fire is point-blank missiles, shells and clusters off the rigs
    // over the lane, swarms off the two drone rigs, relief rigs on tows (8
    // hits on the way in) and, in the boss, every rig standing firing its
    // volley together at one ship. Everything the rigs fire comes in a short
    // flight and meets at one place: the Shrapnel Shell's burst takes a
    // volley as it converges, the Gravity Well pulls it and the swarms off
    // the ships, and the Flak Cannon's cloud sits where the rigs' short
    // flights cross the lane. The Tesla Arc's chain wants strings of small
    // things in a line, not a volley from four rigs, Point Defense waits at
    // the carrier for what comes near it, and Full Steam sails the convoy
    // under the rigs faster, not past them (forced, the combo sweep's
    // singles at log v49: Shrapnel 4.8, Gravity Well 5.1, Flak 5.5 against
    // Tesla 7.4, Full Steam 8.0, Point Defense 8.5;
    // docs/design/v3-ch3-rigs.md, The counters). Every weapon is in chapter
    // 3's draft.
    counters: ['shrapnel', 'well', 'flak'],
    offCounter: ['tesla', 'fullSteam', 'aegis'],
    convoy: 'The map\'s own convoy at the campaign\'s schedule, no commands: pairs west to east down one lane under the four rigs, past the carrier in the middle, delivering in the east; the rigs are answered by shooting, not by sailing.',
    stretches: { danger: 'middle', safe: 'late' },
    boss: {
      plan: 'The Rig Barrage (in place of the Dive Circus: the Dive Bomber is a regular of the Battery\'s waves by now): as each round opens, the downed rigs rise again (the middle two first, then the west and the east) until 2, 3, then 4 stand, 8 hits each (a rig still standing keeps its own), and every rig standing fires its volley together at the ship halfway along, its deck lit 1.5 s first: a guided missile off each missile rig, two shells off the west-middle rig, four drones off the east rig, converging on the convoy; 3 volleys a round, 6.5, 7 and 8 s apart. A rig brought down fires no more (encounters rev 4, MAP_BOSS; lab only: the campaign plays the Dive Circus). Rising below the asked 1.5 / 2 / 2.5 a round on the bot, as on the Battery and the Sowers, to keep the win rate up.',
      botTarget: 2,
    },
  },
  // docs/design/v3-ch3-dreadnought.md
  dreadnought: {
    problem: 'A battleship steams down the deep channel against the convoy, east to west, firing broadsides across the water at the ships, and from wave 4 its spotter planes lay its guns on a ship from over the horizon: fifty hits sink it and silence it for the wave, or each broadside and each spotter can be shot down as it comes, while the rest of the wave keeps firing, most of all at the ships about to deliver in the east, where it comes in.',
    // The fire is broadsides with a short flight across the deep channel
    // (a shell or a guided missile at a ship, drones off its deck at the
    // carrier), spotter planes painting a ship for a barrage that cannot be
    // shot down, and swarms off the one far drone silo. Point Defense round
    // the carrier takes the deck drones and the missiles with a short
    // flight, the Shield takes the hit of the shell that gets through and of
    // a spotter's barrage, and the Gunship Pair rides over the convoy and
    // takes a broadside as it comes. The Seeker Pod's long flight is late
    // for a broadside's short one, the Orbital Strike's slow lock spends
    // itself on the battleship's hull (the toughest thing on the board)
    // while the broadsides land, and the Bomber Wing silences silos, not the
    // battleship (forced, the combo sweep's singles at log v51: Point
    // Defense 4.3, Shield 5.0, Gunship Pair 5.5 against Seeker 9.1, Orbital
    // Strike 7.5, Bomber Wing 7.4; docs/design/v3-ch3-dreadnought.md, The
    // counters). Every weapon is in chapter 3's draft.
    counters: ['aegis', 'shield', 'gunships'],
    offCounter: ['seeker', 'orbital', 'bomberWing'],
    convoy: 'The map\'s own convoy at the campaign\'s schedule, no command (rule m-convoy: the battleship is fought by shooting, not by sailing): pairs west to east down the one lane, past the carrier in the middle, delivering in the east, where the Dreadnought comes in and its first broadsides fall.',
    stretches: { danger: 'late', safe: 'early' },
    boss: {
      plan: 'The Dreadnought itself, on the Fire Mission\'s spotters: each round it steams in from the east at speed, heaves to broadside-on to the convoy (3, 4, then 5 s), firing a broadside at the lead ship every 8, 6.5, then 7 s (a shell and a guided missile, the same, then two shells), and goes on west at twice the speed; its spotters (one for one turn, one for two, then two) call walking barrages from its hull, and sunk, it is silent and its spotters go; 40, 50, then 60 hits; 2, 3, then 4 swarms (encounters rev 4, MAP_BOSS; lab only; the Fire Mission before: 3 spotters calling barrages from off the map, 3 swarms, every round). Rising below the asked 1.5 / 2 / 2.5 a round on the bot, as on every rebuilt map, to keep the win rate up.',
      botTarget: 2,
    },
  },
  // docs/design/v3-ch3-lantern.md
  lantern: {
    problem: 'Night: a threat is a faint glow until the lighthouse beam, the carrier\'s lamp or a star shell lights it, and the beam sweeps the far shore and the lane but never the enemy\'s own bank in the south-east, right behind the ships as they deliver, so the shells, missiles and siege guns from there come out of the dark on the shortest flights on the map.',
    // The fire comes out of the dark bank behind the ships on the shortest
    // flights on the map (shells, missiles, clusters, swarms), with siege
    // guns rising there whose shells no interceptor can stop. The
    // Scattergun's burst catches what arrives close to the ships, the
    // Gunship Pair covers the lane on its own, and the Shield takes the hit
    // of a siege shell that can't be shot down. The Seeker Pod's long
    // flight is late for a shell from the dark bank, the Tesla Arc's chain
    // needs strings the scattered fire rarely makes, and Full Steam sails
    // the convoy into the guns' circles (forced, the combo sweep's singles
    // at log v50, the build number before it shipped as v52: Scattergun 3.8, Gunship Pair 4.6, Shield 4.7 against
    // Seeker 11.3, Tesla 13.3, Full Steam 16.1; docs/design/
    // v3-ch3-lantern.md, The counters). Every weapon is in chapter 3's draft.
    counters: ['scatter', 'gunships', 'shield'],
    offCounter: ['seeker', 'tesla', 'fullSteam'],
    convoy: 'The map\'s own convoy at flow 2 (as most of chapter 2\'s maps), no commands: pairs west to east down one lane under the lighthouse beam, past the carrier\'s lamp in the middle, delivering in the east with the enemy\'s dark bank right behind them.',
    stretches: { danger: 'late', safe: 'early' },
    boss: {
      plan: 'The Bombardment along the shore: a line of siege guns rising out of their hatches along the far shore one after another, west to east (3, 3, then 4; 2.2 s apart; two salvos each), from round 2 more on the enemy\'s dark bank behind the ships (1, then 2), with shells, a guided missile and a cluster out of the dark bank at the lead ship and four supply swarms a round (the event sends 3 guns 3 s apart and 4 supply swarms, every round; encounters rev 4, MAP_BOSS; lab only). Rising below the asked 1.5 / 2 / 2.5 a round on the bot, as on the Battery and Sowers\' Reach, to keep the win rate up.',
      botTarget: 2,
    },
  },
  // docs/design/v3-ch4-coves.md (chapter 4, Open War: its first map)
  coves: {
    problem: 'Four smugglers\' coves hide fast boats two seconds from the lane, three in the enemy\'s north shore and one in the south shore by the delivery end: a boat takes two hits and rams for two, and from wave 4 fire ships come out of them that burn where they are sunk or ram, so each wants stopping far out, at the cove mouth, not on the lane.',
    // The fire is boats out of the coves (two seconds from the lane, at the
    // ship passing a cove mouth or along the lane), fire ships among them,
    // drones off the one far silo, and, in the boss, fire ships out of every
    // cove at once. Weapons that fire on their own catch a boat as it
    // leaves its cove, while the finger is on something else: the Orbital
    // Strike, the Frigate Escort on the lane and the Gunship Pair. Seekers
    // chase what is already in the air, Full Steam sails the convoy past
    // the coves faster but not out of their reach, and the Tesla Arc's
    // chain wants strings of small things, not lone boats (forced, the
    // combo sweep's singles at log v53: Orbital 6.4, Frigate 6.5, Gunship
    // Pair 7.0 against Tesla 9.2, Full Steam 9.5, Seeker 10.0;
    // docs/design/v3-ch4-coves.md, The counters). Every weapon is in
    // chapter 4's draft.
    counters: ['orbital', 'frigate', 'gunships'],
    offCounter: ['tesla', 'fullSteam', 'seeker'],
    convoy: 'The map\'s own convoy at the campaign\'s schedule, no commands: pairs west to east down one lane under the three north coves, past the carrier in the middle, delivering in the east between the north-east cove and the south cove; the boats are answered by shooting, not by sailing.',
    stretches: { danger: 'late', safe: 'early' },
    boss: {
      plan: 'The Fire Fleet (in place of the Repair Yard: the Repair Ship debuts in the Coves\' wave 2 and is a regular from then): sorties of fire ships, one out of every cove listed at once, all at the ship nearest halfway along, the cove mouths lit first: two coves in round 1, three in round 2, all four in round 3, two sorties a round, with a pack of fast boats and a guided missile in rounds 1 and 2. A fire ship takes three hits; sunk or ramming, it burns on the water (encounters rev 4, MAP_BOSS; lab only: the campaign plays the Repair Yard). Rising, below the asked 1.5 / 2 / 2.5 a round on the bot in the first two rounds, as on every rebuilt map, to keep the win rate up.',
      botTarget: 2,
    },
  },
  // docs/design/v3-ch4-delta.md
  delta: {
    problem: 'The river forks three ways at the buoy and its switch sends the next ships north under the enemy bank, middle past the carrier, or south out of reach, but the enemy reads the switch: it fires at the branch the switch is set to, and from wave 4 its incendiaries burst on that branch\'s mouth, so the safe branch is only safe until you send ships down it.',
    // The fire is threats at single ships, one after another: drones down
    // the river and at the fork, short flights off the north bank and the
    // island, incendiaries at the switch's branch and, in the boss, a raid
    // off every silo. The ships sail in a Spread, one at a time across the
    // river, so they are seldom bunched for an area weapon to cover: what
    // pays is picking each threat off far out, the Seeker Pod homing on the
    // slow incendiaries before they reach a branch, the Thermobaric Shell's
    // burst on a string as it closes, the Cadence Gun's steady shots. The
    // area weapons (Gravity Well, Tesla Arc, Point Defense at the carrier)
    // wait for bunches the convoy rarely makes. Chosen on the bots' kit
    // runs (the bot's taste set to the kit, 32 seeds, the usual Armory:
    // won 84% against 66%), not the forced singles, which rank the area
    // weapons higher (Gravity Well 6.4, Tesla 6.4, Point Defense 6.8
    // against Seeker 7.7, Thermobaric 8.1, Cadence 8.6; docs/design/
    // v3-ch4-delta.md, The counters). Every weapon is in chapter 4's draft.
    counters: ['seeker', 'thermo', 'cadence'],
    offCounter: ['well', 'tesla', 'aegis'],
    convoy: 'The map\'s own convoy, no commands: heavy river traffic (flow step 3) in a Spread, one ship at a time across the river (the player\'s own habit in the campaign), down to the fork, where the switch (a tap on its buoy) sends the next ships down one of three branches; the ships bunch in the river and at the fork, and spread out across the branches.',
    stretches: { danger: 'middle', safe: 'late' },
    boss: {
      plan: 'The Burning Delta (in place of the Escort Run: the Bodyguard Ring is a regular of chapter 4\'s waves, and the Delta\'s own debut): burning oil closes branches of the fork, the one the switch is set to first, its mouth lit 2.5 s before, so the convoy funnels into the branch left open, while a raid off every silo comes at the ships bunched on the way in. Round 1: one branch burns; round 2: two; round 3: two, then the fire moves to the branch that was open. Encounters rev 4, MAP_BOSS; lab only: the campaign plays the Escort Run.',
      botTarget: 2,
    },
  },
  // docs/design/v3-ch4-tide.md (chapter 4, Open War)
  tide: {
    problem: 'The flats lane out by your carrier floats only at high tide: when the tide goes out, every new ship crowds into the deep channel under the enemy\'s guns, and the enemy saves its fire for that crowd, so the tide gauge is the clock you defend by.',
    // What the waves send: drones over the long flight to the flats lane at
    // high water, then at the ebb shells, cluster missiles, guided missiles
    // and supersonics at the crowd in the deep channel, a short flight from
    // the north shore's four silos. Splash weapons at bunched ships: the
    // counters are the weapons that stop a missile as it lifts or burst
    // over the crowd's sky (see docs/design/v3-ch4-tide.md, The counters,
    // for the sweep's numbers). Every weapon is in chapter 4's draft.
    counters: ['aegis', 'flak', 'shrapnel'],
    offCounter: ['grapnel', 'fullSteam', 'gunships'],
    convoy: 'The map\'s own convoy at the campaign\'s schedule, no commands: pairs west to east, over the flats lane by the carrier and the deep channel under the shore at high water, all of them in the deep channel at low water; the tide steers the ships, and the fire is answered by shooting.',
    stretches: { danger: 'early', safe: 'late' },
    boss: {
      plan: 'Low Water (in place of the Firestorm: the Incendiary Missile is a regular of chapter 4\'s waves): each round the tide runs out early and stays out, every ship crowds into the deep channel, and the whole north shore fires at the crowd at once, strike after strike, its silos lit first: two strikes in round 1, three in rounds 2 and 3, more silos and longer low water each round (encounters rev 4, MAP_BOSS; lab only: the campaign plays the Firestorm). Rising, below the asked 1.5 / 2 / 2.5 a round where the loss limit needs it, as on every rebuilt map.',
      botTarget: 2,
    },
  },
};

export function mapPlan(map: MapId): MapPlan | undefined {
  return MAP_PLANS[map];
}
