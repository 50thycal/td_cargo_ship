# The Archipelago: map card (map rebuild, chapter 2)

**Date:** 2026-11-20. The Archipelago (`archipelago`, chapter 2 "The Narrows", the 9th map) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), after the Island, the Behemoth Run and the Needle of Bosk (`docs/design/v3-ch2-island.md`, `v3-ch2-behemoth.md`, `v3-ch2-needle.md`). Encounter rev 4; play log v36.

Code:
- `src/v3/data/encounters.ts`: `ARCHIPELAGO_R4` (ten encounters), `ARCHIPELAGO_BOSS_ROUNDS` and `MAP_BOSS.archipelago`, `MAP_SIGNATURE.archipelago`, `REBUILT_MAPS` (via `CHAPTER_TWO_MAPS`), in the chapter 2 block;
- `src/v3/data/mapPlans.ts`: `MAP_PLANS.archipelago`;
- `src/v3/data/convoy.ts`: `MAP_CONVOY.archipelago` (the map's own convoy, no command);
- `src/v3/sim/game.ts`: a signature may be one of the map's own threat kinds instead of a foe (`MAP_SIGNATURE` `kind`: the motherships) and bring an escort (`escort`: a Scavenger Drone with each), the escort's launch one drone out of the wave's own (the Needle's walls' rule, now one helper, `takeDrone`);
- `src/v3/sim/events.ts`: the Supply Raid reads its rounds from `MAP_BOSS` (its swarms, a round's own launches, `fire`, which may now send a mothership) and how many weapons each cargo run carries (`cargoWeapons`);
- `src/v3/data/lab.ts`: "Ready to test" lists the Archipelago at v36;
- `tools/v3/combo-sweep/mix.ts`, `mixwaves.ts`: the Archipelago among the maps, its signature the motherships and their mini-drones; `tools/v3/map-report/quick.ts`: `--from` (a second half of seeds).

Bot reports: `tools/v3/map-report/results/archipelago.md` (no Armory), `archipelago-player.md` (the player's usual Armory, with fun measures and the heat map) and `archipelago-latest.md` (the player's latest Armory: Wide Warhead 5, Point Defense 4, Supply Lines 3); the map as it was: `archipelago-before*.md`. Tuning reads: the bot as `tools/v3/map-report/quick.ts` plays it, on 48 seeds at a time (900–947 and 948–995).

## The problem

> A chain of enemy islets lines the one lane: the islets, the gaps between them, the far shore and the water behind the convoy all fire, so threats come from several directions at once, and the west end, where the ships come in, is the longest reach from your carrier.

The archipelago is a shape, not a mechanic (rule `m-mechanic`: the Archipelago has none). Three islets sit 250 px north of the lane, each with a silo; two silos stand on the far shore behind them; six sub spots lie in the gaps between the islets, off both ends of the chain and by your own shore behind the convoy. The carrier sits in the east (950, 730), so the ships come in at the end furthest from it.

How it differs from the other chapter 2 maps:
- **The Island:** one fortified island between two lanes, firing point-blank at the ships beside it. Here there are three islets and one lane, and the fire comes from the gaps and from behind as well as from the islets.
- **The Behemoth Run:** one ship to escort. Here no ship matters more than another; the ships in the west, furthest from your guns, do.
- **The Needle of Bosk:** a queue at one place. Here the convoy keeps its spacing; the danger is a direction, not a place in the lane, and it changes from wave to wave.

The maps-plan idea "routes that split and rejoin" is not built: the map keeps its one lane (the rebuild is lab only and changes no map geometry; see "Questions for the player").

## Sites and their jobs

Bases and spots are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| West islet (base 1) | Islet (330, 330) | drones, motherships, clusters | The long reach: swarms at the ships coming in (w1, w3, w5, w7), the cluster over them (w9, w10, every boss round), the signature's motherships (from w4) and the boss's. |
| Middle islet (base 2) | Islet (800, 315) | drones, guided, heavies | Swarms in the middle (w2, w4–10), the guided missile at the ships coming in (w6). |
| East islet (base 3) | Islet (1270, 330) | drones, guided, supersonic | Swarms (w4, w6–10), the guided missile at the lead ship (w5, w10, every boss round). |
| North-west shore (base 4) | Far shore (560, 75) | shells, heavies, motherships | Shells over the islets at the ships coming in (w4, w7, every boss round); the signature's other motherships. |
| North-east shore (base 5) | Far shore (1050, 75) | shells, supersonic, clusters | The shared waves' own. |
| West gap (spot 1) | Between the west and middle islets (565, 335) | sub salvos | Shells through the gap at the ships coming in (w2, w8). |
| East gap (spot 2) | Between the middle and east islets (1035, 335) | sub salvos | Shells through the gap (w8). |
| Off the west end (spot 3) | West of the chain (120, 335) | sub salvos | Shells at the last ships (w5). |
| Off the east end (spot 4) | East of the chain (1500, 335) | sub salvos | The shared waves' own. |
| Behind, west (spot 5) | By your own shore (500, 742) | sub salvos | Shells from behind at the ships coming in (w3, w6, w10). |
| Behind, east (spot 6) | By your own shore (1490, 742) | sub salvos | The shared waves' own. |
| Coast road, cave pop-ups, air lines | The far shore; caves beside each islet's silo; the edges | trucks, strafers, bombers, scavengers | The shared waves' own; the jet from the west (w7); a scavenger from an edge with each mothership (from w4). |

WARNING_LINE

## The stretches

STRETCH_LINES

## The convoy

The map's own convoy, no command (rule `m-convoy`): pairs at the reference maps' schedule (`MAP_CONVOY.archipelago`: flow 2, pairs), west to east down the one lane. The lane does the shaping (rule `m-shape-convoy`): the ships come in at the far west end, under the west islet and a long reach from the carrier, and deliver in the east beside it, so the ships most at risk are always the newest. No command is needed. The map card now opens on policy D with the encounters on (it opened on today's convoy controls and no encounters).

## The signature: drone motherships, each with a scavenger

The player's round 9 (r9-map-signature): each map gets a threat of its own in waves 4–10, tied to its identity and its boss. The Archipelago's blurb has always been "enemy islets with gaps between them, and drone motherships"; its boss is the Supply Raid (cargo runs raining pickups, scavengers locking them, drone swarms). Its signature takes one from each (`MAP_SIGNATURE.archipelago`: from wave 4, every new enemy the wave planner draws is a drone mothership, out of the west islet or the north-west shore, and each comes with a Scavenger Drone in from an edge):

- **A mothership** (5 hits) crawls from the west over the convoy towards the carrier, launching a mini-drone at a ship every 2.6 s as it goes. The drones come at the ships from wherever it is: a launch point that moves, over the lane, from the far west end. It stands in for the drone swarm the enemy it replaces would have taken (the wave planner's rule), so the wave sends no more.
- **A scavenger** (the Supply Raid's own) locks every pickup in its ring until it is shot down, the mothership's drop among them (a mothership drops a pickup 7 times in 10). Its launch is one drone out of the wave's own (rule `w-budget`).

The Scavenger Drone debuts on the Island's wave 5; the Archipelago's own extra motherships (from wave 6, as before) stay. The wave planner draws one new enemy on waves 4–5, two on 6–9 and three on 10, so the signature sends 1, 1, 2, 2, 2, 2 and 3 motherships (wave 6's encounter stands in for the map's own mothership that wave, so the step from 5 to 6 is one mothership, not two).

SIG_TABLE

## The counters

COUNTERS

## Loadouts on this map (combo sweep singles)

SINGLES

## Diversity: are the Archipelago's best kits its own?

DIVERSITY

## The debut

None of its own. The Archipelago's slot is the Scavenger Drone (`mapDebut`), but every chapter 2 enemy already comes in on the Island, one a wave from wave 2 with a light debut wave each (see the Island's card), so no "NEW · The Narrows" banner is due here (the Needle's card says the same). The motherships are a chapter 1 kind (the shared waves' extras here since the 20-map plan). Nothing from a later chapter: the encounters send only drones, shells, guided missiles, clusters and a strafer, all in the map's table by their waves (`tests/v3/encounters.test.ts`).

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated. Every shell the shared wave would send from wave 2 on comes out of the wave, so its submarines carry drones instead of padding their salvos with shells (a sub fills a salvo of 4 whatever it is given: the shells sank most of the bot's ships on the map with its own convoy). The encounters put a few shells back where the map wants them: through the gaps, from behind, over the islets. The wave keeps its own drones to make up the rest (×0.9–1.0 of its launches without the encounters, rule `w-budget`). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | Off the west islet (`archipelago-west-islet`) | west islet, 3 drones | the ships coming in (the long reach) |
| 2 | teach | Through the gap (`archipelago-gap`) | west-gap sub, 2 shells; middle islet, 4 drones | the ships coming in; beside the middle islet; in place of the wave's 2 shells |
| 3 | teach | Islet and periscope (`archipelago-front-back`) | west islet, 5 drones; west sub behind the convoy, 2 shells | both at the ships coming in; in place of the wave's 4 shells |
| 4 | combine | Islet by islet (`archipelago-islet-chain`) | the three islets in turn, 4 drones each; north-west shore, 1 shell | any ship; the ships coming in; in place of the wave's shells (the first mothership and scavenger come with the wave) |
| 5 | combine | Both ends (`archipelago-both-ends`) | sub off the west end, 3 shells; east islet, 1 guided; middle islet 5 and west islet 6 drones | the last ships; the lead ship; the ships coming in; in place of the shells and guided missiles |
| 6 | combine | Behind the convoy (`archipelago-behind`) | west sub behind, 2 shells; west islet, 6 drones; middle islet, 1 guided and 3 drones; east islet, 5 drones | the ships coming in; beside the west islet; any ship; in place of the shells, guided missiles and the map's own mothership |
| 7 | escalate | A jet from the west (`archipelago-strafe`) | a jet from the west; north-west shore, 1 shell; west islet 4, east 4, middle 5 drones | the lane; the ships coming in; in place of the shells and a jet |
| 8 | escalate | Both gaps (`archipelago-both-gaps`) | subs in both gaps, 2 shells each; west 5, middle 5, east 5 drones | the ships coming in; beside the east gap; in place of the shells and a heavy |
| 9 | escalate | A cluster over the west (`archipelago-cluster`) | west islet, 1 cluster and 5 drones; middle islet 5 + 4, east 5 drones | the ships coming in; any ship; in place of the shells, a cluster and a heavy |
| 10 | climax | Run the chain (`archipelago-run`), after the wave's own fire (`at: 1`) | west sub behind, 2 shells; west islet, 1 cluster; middle islet, 5 drones; east islet, 1 guided; four swarms of 4 all wave | the ships coming in; the lead ship; in place of the shells, most guided missiles, a heavy, a cluster, a supersonic and a jet |

Wave 1 loses no ship (all three reports).

## The boss plan: the Supply Raid from every side

The Supply Raid is the map's own event: two cargo runs drop pickups over the lane (8, then 6), three scavengers come in from the sides of the screen after each to lock them, and drone swarms come off the islets. Under encounter rev 4 (`ARCHIPELAGO_BOSS_ROUNDS`, lab only: the campaign plays the event as it was):

| Round | Drone swarms | Motherships (west islet) | Shells (north-west shore) | Clusters (west islet) | Guided (east islet) | Weapons in the cargo |
| --- | --- | --- | --- | --- | --- | --- |
| before (every round) | 5 of 6 | 0 | 0 | 0 | 0 | one for each weapon held, both runs |
| 1 | 6 of 7 | 2 (2, 6 s) | 3 (4, 7, 10 s) | 1 (7 s) | 1 (10 s) | 1 in the first run, none in the second |
| 2 | 6 of 9 | 3 (2, 4.5, 7 s) | 4 (4–11.5 s) | 1 (6 s) | 1 (9 s) | the same |
| 3 | 6 of 10 | 3 (2, 4.5, 7 s) | 5 (4–12 s) | 2 (6, 10 s) | 1 (8 s) | the same |

The shells and clusters go at the ship least far along (aim `rear`: the long reach), the missile at the lead ship, the motherships at the carrier over the convoy, launching mini-drones at the ships as they go. **The cargo carries one weapon a round, not one for each weapon held in both runs:** with the event's own cargo a weapon held at its best (a Shield, an Air Strike) came back twice a round and the round was over for it (the forced singles lost 0.00–0.03 ships a round). With no weapon at all, every weapon ran out and every kit lost about five ships a round, so one weapon, early, is kept. `MAP_PLANS.archipelago.boss.botTarget` is 2 (the brief: about 1.5 / 2 / 2.5 on the bot's scale). Each round lasts 15–30 s (test). The intro cards are the shared ones (log v30), after the convoy is restored: "Boss round", "Convoy restored" (and the ships that can still be lost), "The boss: Supply Raid", "Round 1 of 3", then "Round 2 of 3" and "Round 3 of 3".

## Bot results, before and after (24 seeds, 900–923)

RESULTS

## Fun measures (provisional, `src/v3/sim/funMetrics.ts`)

FUN

## What is not satisfied, or uncertain

UNCERTAIN

## The play log (v36)

PLAYLOG

## Tests

- `tests/v3/encounters.test.ts`:
  - the ten listed, rev 4, v1 only, none at rev 3 (the map with no authored encounters is now Saltgate Canal);
  - the budget, legality, warning and replay checks cover the map;
  - the Supply Raid's rounds: the swarms (count and size), the motherships, shells, clusters and the guided missile each round, rising; motherships and clusters off the west islet, shells and clusters at the ships coming in; the cargo's one weapon; a rev 3 log and the campaign play the event as it was; 15–30 s a round;
  - the signature: from wave 4 each of the wave's new enemies is a mothership out of a base that launches them, each with a scavenger, on top of the map's own motherships; within the wave budget; waves 1–3, the campaign and the shared wave draw their own; the other signatures name a foe and bring no escort.
- `tests/v3/mapRules.test.ts`: no repeats and no gaps; `MAP_PLANS` complete; the boss target is 2.
- `tests/v3/mapCards.test.ts`, `round11.test.ts`, `convoy.test.ts`: the production setup is policy D with the encounters, no command; Saltgate Canal is now the next map with neither.
- `tests/v3/readyToTest.test.ts`: the new entry.
- `e2e/v3-map-cards.mjs`: the hub card says so; `?lab=map-archipelago` opens the full map with encounters rev 4 and no command. `e2e/v3-encounters.mjs`: the map with no authored encounters is now Saltgate Canal.

## What to look for when you play

LOOKFOR

(This section names no weapon to try: the counter kit above is a design note for the bots, never shown in the game or on the hub.)
