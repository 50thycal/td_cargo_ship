# The Sharra Delta: map card (chapter 4, rebuilt as one long river in log v68)

**Date:** 2026-11-24. The Delta (`delta`, chapter 4 "Open War", the 17th map) was brought to the map and wave rules on 2026-11-22 (log v57) as a river that forked three ways with a switch buoy. The player's v65 run (quit on wave 4, nothing lost): *"I don't see the point of the switching lanes. Drop that map design and let's make a map that is just really long for the ships to traverse. It should be triple the distance of the normal length. Do some iterations to find the best design."* This card is the map that answers it. The fork, the switch, the buoy, the incendiaries at the branch mouths and the Burning Delta are gone.

Code:
- `src/v3/data/maps20.ts`: the map (`delta`): one channel, about 4,800 px (`tools/v3/delta/length.ts`: 4,811 px against the other maps' 1,685: 2.86 times), eight silos, the land the river winds round, six pop-up roads, the carrier and frigate in the bay between the middle and south legs;
- `src/v3/data/encounters.ts`: `DELTA_R4` (ten encounters), the filler (`BUSY`), `DELTA_CLIMB`, `MAP_SIGNATURE.delta` (`foe: 'rocketTruck'`, `trucks: 'near'`), `DELTA_BOSS_ROUNDS` and `MAP_BOSS.delta` (the Long Gauntlet: `strikes`, each launch with its own `aim`);
- `src/v3/sim/events.ts`: the Escort Run under the Delta's boss tuning plays the strikes (`lowWater`, the Tide's strike step, now with a per-launch `aim`: before, always the crowd); with no boss tuning it plays as it did;
- `src/v3/data/convoy.ts`: `MAP_CONVOY.delta`; `src/v3/data/mapPlans.ts`: `MAP_PLANS.delta`; `src/v3/data/mapHistory.ts`, `src/v3/data/lab.ts` ("Ready to test"), `src/v3/ui/app.ts` (the map's first-play note);
- tools: `tools/v3/delta/length.ts` (how long each map's lane is), `tools/v3/rigs/read.py` (the tuning read, four processes);
- the fork's own code (`fork`, `switchLane`, `branchMouth`, the bots' switch) stays in the game for any map that has a fork; no map does now.

## How it is gated (lab vs campaign)

The map itself is the same in the Test Lab and in a campaign run (the geometry is shared). The wave layer is as every rebuild: **lab only, under the encounter layer**; a campaign run plays the shared waves on the new river and the Escort Run as its boss (a rev 3 log plays the Escort Run).

## The problem

> One river three times the usual length, winding back on itself twice between marsh islands: the ships are under fire from the day they sail in until they deliver and no stretch is quiet, with a silo over every bend.

The map's one mechanic is its length (rule `m-mechanic`): ships on the north leg are hit first by the north coast, then the island between the first two legs fires on the north and the middle leg at once, then the islets either side of the carrier's bay on the middle and south legs, and the marsh behind the last stretch. The question: **which stretch do you hold, when the whole river is a front?** There is nothing to switch and nothing to steer: it is the shooting, and the carrier's reach.

## The river

Three legs and two bends (`DELTA_PATH`): the ships come in at the west on the north leg (y 190) heading east to the east bend (x 1,360), turn and sail the middle leg (y 450) west to the west bend (x 240), turn and sail the south leg (y 710) east off the screen. The legs wander a few pixels (a river, not a ruler); the bends are 130 px radius; the water is 56 px each side of the lane, a bank 14 px beyond. Between the legs lie an island (the east bend rounds its tip; it joins the west shore), then two islets with the carrier's bay between them (the west bend rounds the west islet's tip; the east islet joins the east shore). 4,811 px of lane: 2.86 times the other maps' 1,685. Ships spend about 2 minutes on it against 40 s.

## Sites and their jobs

Bases are counted from 0 here (the encounter data's own count).

| Site | Where | Fires | Its job |
| --- | --- | --- | --- |
| 0 North-west coast | over the north leg, west | shells, guided | the long flight at the ships coming in (w5 rear, w9) |
| 1 North-middle coast | over the north leg, middle | guided, supersonic | a guided missile at the ships coming in; the supersonic locked on the lead ship, a flight across the whole map (w7) |
| 2 North-east coast | over the north leg, east | heavies, shells | shells at the ship halfway along (w2) or nearest it (w6, w8) |
| 3 Island, west silo | between the north and middle legs | clusters, shells | point-blank on both legs: the danger stretch (w3, w6, w8, w10) |
| 4 Island, east silo | same island, east | guided, heavies, motherships | point-blank, and the guided missile at the nearest ship (w6, w10) |
| 5 East islet | by the carrier's bay, east | drones, clusters | the drone silo: long flights out to the north leg and the ends (w1, w4, w5, w9) |
| 6 West islet | by the carrier's bay, west | drones, guided | the other drone silo, and all the filler (the far drone silo) |
| 7 South-east marsh | behind the south leg's end | guided, shells, supersonics | missiles at the lead ship (w5, w8), the boss's last strikes |
| Roads | pop-up roads to a bank over every leg (six) and two long roads along the coast and the island | Rocket Trucks | the signature: from wave 4 a truck on a bank over a leg |

**Why the drones come from the middle** (found in the iterations below): a drone is the one threat a ship far from the carrier cannot be covered against; the carrier's guns reach 450 px of river in about a second and the ends in two, and a drone from a silo 130 px from the lane is on its ship in a second and a half. Drones off a coast or island silo sank ships; drones off the islets by the bay must fly 400 px or more to the north leg, long enough to shoot.

## The stretches

- **Danger: the island** (the lane's first third and its middle: the north leg east of the first silos and the middle leg under the island): the island's two silos are point-blank on both legs at once, with the shortest flights on the map.
- **Safe: the south leg's east end**, the last stretch, in reach of the carrier and under only the marsh.
- Rule `m-carrier`: the carrier sits in the bay (840, 585) between the middle and south legs: 135 px from the middle leg, 125 from the south, 395 from the north leg at its nearest. The frigate's station is the bay beside it (the old Delta lost frigate value because the river had no room); three escort stations in the bay.

## The convoy

The map's own convoy (rule `m-convoy`): **flow step 1 (a ship every 5.5 s) in Pairs**, no command, so a pair every 11 s, about 24 ships on the river at once (the first build's Spread at step 3 was 40 and more). See the iterations: density did not change the read much, drones aimed at the far ships did.

## The signature: a truck on every bank

From wave 4 the wave's new enemies are Rocket Trucks (`MAP_SIGNATURE.delta`: `foe: 'rocketTruck'`, `foeShare: 1`, `trucks: 'near'`), down the six pop-up roads to the banks over every leg, each firing its salvos at the ship nearest it. It is the length made visible: a river three times as long has a gun on every stretch of it. (Saltgate's trucks are at the locks; these are along a river; the Rocket Truck is chapter 1's enemy, not a later chapter's: rule `m-enemy`.)

## The counters

Seeker, Thermobaric and the Cadence Gun against the Gravity Well, Tesla Arc and Aegis, as the fork's card chose them: single threats at single ships all along the run, never bunched for an area weapon. (Not re-measured on the long river; see "What is not satisfied".)

## The ten waves (v1, encounter rev 4)

| Wave | Encounter | The fire |
| --- | --- | --- |
| 1 | The long river | three strings of drones off the islets at the lead ship and the ship halfway along: a long flight each |
| 2 | Round the bend | a shell at the ship halfway along, one at the lead ship, drones at the ships on the north leg |
| 3 | Between two legs | the island's shells point-blank, a guided missile at the ships coming in |
| 4 | Trucks on the bank | the signature's first truck (with the wave), shells and drones either side |
| 5 | Both ends | a shell at the ships coming in, a cluster and a guided missile at the lead ship: the head and the tail of a convoy 4,800 px long |
| 6 | The island between | the island fires both ways: a cluster, missiles and shells |
| 7 | Down the whole river | a supersonic locked on the lead ship from across the map, missiles, the islet's shells |
| 8 | Every leg | shells, a cluster, missiles and the islet's shells at once: no stretch is quiet |
| 9 | Trucks and a raid | two trucks on the island's legs, a raid at the ships coming in |
| 10 | The long run | after a breath, every silo fires in turn along the river, each at the ships nearest it |

## The boss: the Long Gauntlet

The Escort Run (one heavy in three rings of Bodyguard drones) became the Burning Delta in log v57 (oil across the fork's branches). With no fork the boss is the river itself: **the whole shore fires down the river, silo after silo, west to east along the run**, each strike's silos lit 2.5 s before it fires (the same ring and cue as the Tide's) and each launch at the ships nearest its silo, so the fire runs the length of the convoy like a fuse and every stretch has its moment, with a raid off the islets at the lead ship and the ship halfway along.

| Round | Strikes | Launches in them | The raid |
| --- | --- | --- | --- |
| before (log v57) | burning oil on one, two, two branches | | 9-11 drones, 1-2 guided, a shell |
| 1 | 4 (at 3, 9, 15, 21 s) | 11 | 8 drones |
| 2 | 4 (at 3, 8, 13, 18 s) | 12 | 8 drones, a guided missile |
| 3 | 5 (at 3, 8, 13, 18, 23 s) | 17 | 9 drones, a guided missile |

Each round lasts 22-27 s (test seed 220: held, clean, held). The strikes run west to east: the north-west coast and the island first, the islets and the marsh last, the same order the ships take the river in.

## Iterations: finding the design

The brief (the player's words, and the rules): about three times the usual length, a clear signature built on the length, a boss that suits it; win rate 50-70% for the "you" bot with the usual Armory (`tools/v3/rigs/read.py --map=delta --armory=player`), no cliffs, warning time. Before: the fork's Delta won **73%** (96 seeds; waves 1-10 lost 3.80, boss 0.73 / 0.85 / 2.07).

| # | Design | Won | Waves 1-10 lost | What it showed |
| --- | --- | --- | --- | --- |
| 1 | One serpentine, three legs (x -60 to 1,660, 2.90x), the old Spread at flow 3, ten encounters built on the island and coast silos, `near` aims, boss strikes of two to three silos | **0%** (48) | 5.81 | wave 1 lost 1.29 and the first boss round 3.25: every silo is within 130 px of a lane, so every `near` shot was a second and a half |
| 2 | The same, encounter aims moved to the far ships (`lead`, `mid`), the boss lightened | 3% (32) | 4.84 | waves 1-5 fine, waves 6-10 and the boss still 0.6-1.4: 27 of the 36 ships sunk (`sunk.ts`) were sunk by drones |
| 3 | Flow 1 in Pairs: fewer ships on the river (24 against 40) | 0% (24) | 5.33 | worse: the density was not it |
| (diagnosis) | where the ships were sunk | | | 24 of 36 sunk ships were 500 to 900 px from the carrier: an interceptor flies 520 px/s, so a drone off a silo 130 px from a ship at the river's end can't be stopped |
| 4 | Design B: the legs pulled in to x 240-1,360 (2.86x), the drone silos moved off the coast and the island's ends and the coast silos made shell and missile silos only | 38% (24) | 4.25 | waves 2-9 under 0.7; wave 1 still 0.38 and the third boss round 3.19 |
| 5 | Encounter aims at the far ships in waves 1-3 and 9, the climb eased from wave 7 (0.82 to 0.74), the boss rounds rebalanced (more in round 1, fewer in 3) | 59% (32) | 4.62 | in band; wave 1 0.25 and wave 10 1.20 (a cliff) |
| 6 | The drone silos are the islets by the carrier's bay (460 px from the carrier, 400+ px from the north leg) and the filler with them; the island's and the coast's silos fire shells, clusters and missiles only | 44% (32) | 4.06 | waves 1-8 now 0.06-0.62 (wave 1 was 0.25); wave 9 1.03 and the boss rounds 1.15 / 1.75 / 1.80 too heavy |
| 7 | Wave 9 one shell fewer, the climb eased again (waves 9-10 to 0.70 / 0.66), the boss rounds lighter (round 1: a string of drones in place of a shell pair, rounds 1-2 one shell less) | **59%** (32) | 3.62 | in band: 0.06 0.22 0.06 0.19 0.34 0.19 0.62 0.32 0.61 1.10 over waves 1-10; boss 1.31 / 1.38 / 1.58 |

## Bot results, before and after

The rest of this table and the report are in the pull request (numbers move run to run: 32 seeds is plus or minus 9 points).

## What is not satisfied, or uncertain

- The counters (Seeker, Thermobaric, Cadence) were chosen on the fork's runs and not re-measured on the long river.
- Wave 10 is a step up from wave 9 (the climax).
- The drone silos in the bay mean a drone off the islets is point-blank on the middle and south legs; the carrier covers those.

## The play log (v68)

`LOG_VERSION` 68, `LOG_REPLAYS` `[68]`. A Delta card log before 68 no longer replays to the same game (a different river); the other maps play as they did.

## Questions for the player

- **Is it long enough, and does it read?** The river is 2.86 times the usual length on one screen, three legs and two bends. Recommended: keep it; if the north leg is too far from the carrier, the next step is a fourth silo and a frigate on the north leg.
- **The signature: a Rocket Truck on every bank.** Recommended: play waves 4 and 9; if the trucks are noise, the length alone is the map.
- **The boss: the Long Gauntlet.** Recommended: keep the name.

## What to look for when you play

Whether the ships feel exposed all the way; whether the carrier's bay reads as home; whether the island is the danger and the last stretch the rest; whether the Long Gauntlet reads as fire running down the river.
