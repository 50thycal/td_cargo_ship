# The Needle of Bosk: map card (map rebuild, chapter 2)

**Date:** 2026-11-20. The Needle of Bosk (`needle`, chapter 2 "The Narrows", the 8th map) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), after the Island and the Behemoth Run (`docs/design/v3-ch2-island.md`, `v3-ch2-behemoth.md`) and with their round 9 signature threats. Encounter rev 4; play log v34.

Code:
- `src/v3/data/encounters.ts`: `NEEDLE_R4` (ten encounters), `NEEDLE_BOSS_ROUNDS` and `MAP_BOSS.needle`, `MAP_SIGNATURE.needle`, `NEEDLE_EASE` (the version's wave scale), `REBUILT_MAPS` (via `CHAPTER_TWO_MAPS`), in the chapter 2 block;
- `src/v3/data/mapPlans.ts`: `MAP_PLANS.needle`;
- `src/v3/data/convoy.ts`: `MAP_CONVOY.needle` (the map's own convoy, no command);
- `src/v3/sim/game.ts`: a signature's `block` (the wave planner): each of the wave's new enemies comes as a small wall of armored drones, its extra drones taken out of the wave's own one for one;
- `src/v3/sim/events.ts`: the Shield Wall reads its rounds from `MAP_BOSS` (the block's size and width) and adds a round's own launches (`fire`, as the Gunship Wall and the Wolf Pack do); a boss round's `fire` may now send a cluster;
- `src/v3/data/lab.ts`: "Ready to test" lists the Needle at v34;
- `tools/v3/combo-sweep/mix.ts`, `mixwaves.ts`: the Needle among the maps, its signature the armored drones.

Bot reports: `tools/v3/map-report/results/needle.md` (no Armory), `needle-player.md` (the player's usual Armory, with fun measures and the heat map) and `needle-latest.md` (the player's latest Armory: Wide Warhead 5, Point Defense 4, Supply Lines 3). Tuning reads with `tools/v3/map-report/quick.ts` (48 seeds).

## The problem

> Open water narrows to a gap one hull wide: the convoy closes into single file and queues at the mouth, right between the two enemy headlands, where one cluster, one shell or one wall of armored drones finds ships nose to tail.

The Needle is a shape, not a mechanic (rule `m-mechanic`: the Needle has none). The lane is 380 px wide in the west, closes from x 480 to 64 px at x 1000, runs one hull wide to x 1240 between the headlands, and opens again to the east. Ships slow and queue at the mouth (the map's own rule, since the 20-map plan). The two headlands carry a silo each, the north one over the gap and the south one on your side of the strait, south of the gap, nearer your carrier than any enemy site on chapter 1's maps.

## Sites and their jobs

Bases and spots are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| West silo (base 1) | North shore (300, 92) | drones, guided | Long-warning swarms over the open water (w2, w5–10), the guided missile at the lead ship (w5). |
| North-shore silo (base 2) | North shore (700, 100) | shells, supersonic | The shared waves' own: shells and supersonic missiles down the funnel. |
| North headland (base 3) | Over the Needle (1120, 290) | clusters, shells | The signature place: the clusters over the queue (w3, w10, every boss round) and shells into the gap (w2, w5, w7–9, every boss round). |
| South headland (base 4) | Enemy land south of the Needle, on your side (1130, 650) | drones, clusters, heavies | Point-blank swarms at the mouth (w1, w3, w5, w7, w9), swarms (w4, w6, w8, w10) and the heavy (w8). |
| East silo (base 5) | Far shore past the Needle (1490, 88) | guided, supersonic | Missiles at the lead ship on its way out (w6, w10). |
| North-west sub spot (spot 1) | Open water west of the funnel (200, 208) | sub salvos | Shells at the ships still coming in (w4). |
| East sub spot (spot 2) | Past the Needle (1500, 252) | sub salvos | Shells at the lead ship coming out (w9). |
| South-west sub spot (spot 3) | By your own shore (300, 718) | sub salvos | Shells behind the convoy (w6). |
| Coast road, pop-up road, air lines | The north shore; the south headland (1190, 940 → 545); the edges | trucks, strafers, bombers | The shared waves' own; the jet down the column (w7). |

WARNING_LINE

## The stretches

The bot report cuts the lane into thirds along it: the open water in the west, the funnel and the mouth in the middle, the Needle and the way out in the east.

STRETCH_LINES

## The convoy

The map's own convoy, no command (rule `m-convoy`): pairs at the reference maps' schedule (`MAP_CONVOY.needle`: flow 2, pairs). The lane does the shaping (rule `m-shape-convoy`): the pairs sail wide over the open water, fall into single file as the funnel closes and queue at the mouth. No command is needed: the queue is the problem, not something to steer. The map card now opens on policy D with the encounters on (it opened on today's convoy controls and no encounters).

## The signature: walls of armored drones

The player's round 9 (r9-map-signature): each map gets a threat of its own in waves 4–10, tied to its identity and its boss. The Needle's boss is the Shield Wall, a block of armored drones flying plates first; its signature is the same enemy in small walls (`MAP_SIGNATURE.needle`: from wave 4, every new enemy the wave planner draws is an armored drone, and each comes as a wall of 2 out of one base). An armored drone is one drone, not a platform, so a wall stands in for a drone swarm as any new enemy does, and its second drone comes out of the wave's own drones (rule `w-budget`: the wave sends no more). The Armored Drone debuts on the Island's wave 4; the Needle starts its walls on wave 4 too, a map later, so it needs no debut wave of its own.

SIGNATURE_LINES

## The counters

- **Counter kit: Point Defense, Thermobaric Shell, Gunship Pair.** The headlands fire from point-blank range onto ships bunched nose to tail, too close for a shot from the carrier to get there first. Each ship's own Point Defense, which in a column covers the ship ahead and the ship behind; the Thermobaric Shell's blast, which goes round an armored wall's plates and takes a cluster with what is near it; the Gunship Pair's rockets at the thickest cluster of ships, the queue.
- **Off-counter kit: Seeker Pod, Frigate Escort, Drone Screen.** The Frigate Escort can't follow the convoy through the Needle (its frigates back out of the narrows), the Seeker's long flight is too late at the mouth, and the Drone Screen is the weakest helper on this map.
- Every weapon is in chapter 2's draft.

How they compare (the player's Armory):

| | Ships lost, all 13 waves | Won |
| --- | --- | --- |
| Counter kit, forced (combo sweep's `check-one.ts`, 16 seeds) | **7.8** ±0.7 | 56% |
| The bot drafting for itself (combo sweep singles, 12 seeds) | 7.6 | 58% |
| Off-counter kit, forced (16 seeds) | 9.7 ±1.1 | 44% |
| Counter kit as the bot's taste (bot report, 24 seeds) | KIT_COUNTER | |
| Off-counter kit as taste (bot report) | KIT_OFF | |

The counter kit loses about 1.9 ships fewer than the off-counter kit and wins more often, but only matches the bot's own draft, as on the Island. Two other kits read about the same forced (Point Defense + Shield + Gunship Pair 7.3; Point Defense + Thermobaric + Shield 8.8), and an earlier off-counter pick (Seeker, Tesla Arc, Drone Screen) read 8.9: on this map the differences between three-weapon kits are within a ship or two, and the map's best kits (below, "Diversity") are a better guide than a forced counter kit.

## Loadouts on this map (combo sweep singles)

Each weapon alone, forced at every draft (12 seeds, the player's Armory, game version 34; `npm run v3:combo-sweep -- --stage=singles --maps=island,behemoth,needle --out=tools/v3/combo-sweep/results/v34-ch2`). Ships lost over all 13 waves:

- **Strong:** **Point Defense 5.3 (won 83%)**, Shield 6.0, Gunship Pair 6.5, Thermobaric 6.8, Railgun 6.8, Scattergun 7.1, Shrapnel 7.3.
- **Middling:** Air Strike 7.6; the bot's own draft 7.6; Gravity Well 7.8, Flak 8.0, Boomerang 8.1, Overdrive 8.3.
- **Weak:** Drone Screen 9.5, Tesla 9.5, Frigate Escort 9.5, Supply Run alone 10.8, Seeker 11.7, Full Steam 12.3, Charge Lance 12.4 (plain gun 12.8).
- **Point Defense is the one to watch:** alone it loses 5.3 ships a run and wins 10 runs in 12. It is not trivial by the sweep's bar (it still loses 5.3), and it is the map's answer by design (every ship in the column covers its neighbours), but it is the best single on any chapter 2 map at v34 (the Island's best is the Railgun 6.0, the Behemoth's the Frigate Escort 6.4).
- The Charge Lance reads badly because the bot charges it poorly; the Laser Cutter is not measured (the bot can't swipe).

## Diversity: are the Needle's best kits its own?

The player's rule for this rebuild: the Needle's best kits must differ from the Island's and the Behemoth Run's. All three maps were swept again at v34 (the Armory overhaul changed the player's Armory's Quick Reload and Stockpile since the v33 sweep): singles on 12 seeds, every pair on 6, each map's 6 best pairs with every third weapon on 6, its 10 best kits on 16 (`tools/v3/combo-sweep/diversity.ts`, results in `tools/v3/combo-sweep/results/v34-ch2/`; docs/design/v3-combo-diversity.md, "The Needle of Bosk").

| Map | #1 | #2 | #3 | #4 | #5 |
| --- | --- | --- | --- | --- | --- |
| The Island | **Point Defense + Supply Run + Shield** 6.2 ±0.8, won 81% | Scattergun + Point Defense + Shield 6.9 | Boomerang + Point Defense + Gunship Pair 7.3 | Air Strike + Scattergun + Supply Run 7.4 | Seeker Pod + Gravity Well + Tesla Arc 7.9 |
| The Behemoth Run | **Air Strike + Flak Cannon + Gravity Well** 4.2 ±0.9, won 81% | Air Strike + Boomerang + Gravity Well 4.6 | Air Strike + Flak Cannon + Supply Run 4.8 | Air Strike + Frigate Escort + Supply Run 5.1 | Air Strike + Frigate Escort + Thermobaric Shell 5.6 |
| The Needle of Bosk | **Boomerang + Flak Cannon + Point Defense** 5.8 ±0.6, won 81% | Air Strike + Thermobaric Shell + Shield 5.8 | Gravity Well + Railgun + Shield 6.3 | Air Strike + Supply Run + Shield 6.4 | Scattergun + Boomerang + Flak Cannon 6.5 |

| Measure | Result |
| --- | --- |
| Jaccard of the top-5 kits, map against map (all three pairs) | **0** (no kit shared) |
| The same, one map against itself (two halves of its seeds) | 0.43 / 0.67 / 0.43 |
| #1 kit | a different one on each map |
| Best weapon alone | a different one on each map: Railgun (the Island), Frigate Escort (the Behemoth Run), **Point Defense** (the Needle) |
| Rank correlation of the weapons alone (Needle against the Island / the Behemoth Run) | 0.44 / 0.59 |

- **The Needle's best kits are its own.** No kit in its top 5 is in the Island's or the Behemoth Run's, its #1 kit and its best weapon alone are its own, and its weapons alone rank about as differently from the other two as they do from each other.
- **Weapons it shares:** the Shield is in three of the Needle's top 5 and two of the Island's (none of the Behemoth Run's, since round 9's jets); Point Defense in one of the Needle's and three of the Island's; Flak in two of the Needle's and two of the Behemoth Run's; Air Strike in two of the Needle's and all five of the Behemoth Run's. The kits differ; their parts overlap, as on every map so far.

SIGNATURE_SHARE

## The debut

None of its own. The Needle's slot is the Armored Drone (`mapDebut`), but every chapter 2 enemy already comes in on the Island, one a wave from wave 2 with a light debut wave each (see the Island's card), so no "NEW · The Narrows" banner is due here. Nothing from a later chapter: the encounters send only drones, shells, guided missiles, clusters, one heavy and a strafer, all in the map's table by their waves (`tests/v3/encounters.test.ts`).

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated. From wave 4 the encounters send most of the wave's shells and clusters as drones instead (shells, clusters and jets sank most of the bot's ships on the map as it was), and stand in for some of the map's own extras (`replaces.extras`). Waves 6–10 send a little less of their shared wave (`NEEDLE_EASE`: 0.92, 0.9, 0.93, 0.9, 0.85; within ±15%, rule `w-budget`). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | At the mouth (`needle-the-mouth`) | south headland, 3 drones | the ship at the mouth |
| 2 | teach | Across the open water (`needle-open-water`) | west silo, 4 drones; north headland, 1 shell | the ship least far along; the mouth |
| 3 | teach | The queue (`needle-queue`) | north headland, 1 cluster; south headland, 4 drones | the queue at the mouth; in place of the wave's cluster |
| 4 | combine | Periscope in the open (`needle-periscope`) | north-west sub, 2 shells; south headland, 5 drones | the ships coming in; any ship; in place of the wave's cluster |
| 5 | combine | Both headlands (`needle-both-headlands`) | north headland, 1 shell; south headland, 4 drones; west silo, 1 guided, then 4 drones | the mouth and the Needle; the lead ship; in place of the wave's 2 clusters |
| 6 | combine | The way out (`needle-way-out`) | south-west sub, 2 shells; south headland, 5 drones; east silo, 1 guided; west silo, 4 drones | the ships coming in; the lead ship on its way out; in place of 2 clusters |
| 7 | escalate | Down the column (`needle-strafe`) | a jet from the west; north headland, 1 shell; west silo, 5 drones; south headland, 4 drones | the queue in single file; in place of a cluster |
| 8 | escalate | A heavy at the mouth (`needle-heavy`) | south headland, 1 heavy and 4 drones; north headland, 1 shell; west silo, 4 + 4 drones | the Needle and the mouth; in place of the wave's heavy, jet, 3 clusters and mothership |
| 9 | escalate | Crossfire in the Needle (`needle-crossfire`) | north headland, 1 shell; south headland, 5 drones; east sub, 2 shells; west silo, 5 + 5 drones | the Needle; the lead ship; in place of 3 clusters, a heavy and a jet |
| 10 | climax | Run the Needle (`needle-run`), after the wave's own fire (`at: 1`) | north headland, 1 cluster; south headland, 5 + 5 drones; east silo, 1 guided; west silo, 5 + 5 drones | the queue; the lead ship; in place of 2 heavies, 3 clusters, a jet and a bomber |

WAVE1_LINE

## The boss plan: the Shield Wall at the mouth

The Shield Wall is the map's own event: armored drones from launch points along the north shore form up into one block at a muster point, then fly at one ship as one, plates forward, banking together twice on the way (their sides open to your shots for a moment). Under encounter rev 4 (`NEEDLE_BOSS_ROUNDS`, lab only: the campaign plays the event as it was):

| Round | Armored drones (wide) | Cluster from the north headland | Shell into the Needle |
| --- | --- | --- | --- |
| before (every round) | 12 (4) | 0 | 0 |
| 1 | 8 (4) | 1 (6 s) | 1 (12 s) |
| 2 | 9 (3) | 1 (5 s) | 1 (12 s) |
| 3 | 10 (5) | 1 (4 s) | 1 (13 s) |

The cluster and the shell go at the ship nearest the north headland (aim `near`): the queue at the mouth. The block goes for the middle ship of the convoy, as before. `MAP_PLANS.needle.boss.botTarget` is 2 (the brief: about 1.5 / 2 / 2.5 on the bot's scale). Each round lasts 15–30 s (test). The intro cards are the shared ones (log v30): "Boss round", "Convoy restored, 6 ships can still be lost", "The boss: Shield Wall", "Round 1 of 3", then "Round 2 of 3" and "Round 3 of 3".

## Bot results, before and after (24 seeds, 900–923)

"Before" is the map card as it was: today's convoy controls, no encounters, the event as it was. "After" is this build (log v34). Commands: `npx vite-node tools/v3/map-report/report.ts -- --map=needle --seeds=24 --kits=plan [--armory=player | --armory=latest] [--no-fun]`.

RESULTS_SECTION

## Fun measures (provisional, `src/v3/sim/funMetrics.ts`)

FUN_SECTION

## What is not satisfied, or uncertain

UNCERTAIN_SECTION

## The play log (v34)

`LOG_VERSION` 34, `LOG_REPLAYS` `[34]` (`src/v3/sim/playlog.ts`). The base branch was at v33 (the Armory overhaul, #190) when this started. The round 9 build (the signature threats, the Behemoth's jet strike, Overdrive's 18 s; `claude/v3-r9-build`, log v33 on its own branch) was not yet merged into the base, and the Needle's signature builds on it (`MAP_SIGNATURE`), so it was merged into this branch first, and both share v34. The Needle's change is lab only, under the encounter layer: the campaign plays as it did, and a v33 Needle card log played the map with no encounters. The map-lab baseline (the Strait, the Gauntlet and Harbor) was rewritten with `--write` and replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 34. The Test Lab's "Ready to test" lists the Needle at v34 (and the Island and the Behemoth Run's round 9 builds at v34, the version they ship in on this branch).

## Tests

- `tests/v3/encounters.test.ts`:
  - the ten listed, rev 4, v1 only, none at rev 3 (the map with no authored encounters is now the Archipelago);
  - the budget, legality, warning and replay checks cover the map;
  - the Shield Wall's rounds: the block's size, the clusters and the shells, rising; all aimed at the queue from the headlands; a rev 3 log and the campaign play the event as it was; 15–30 s a round;
  - the signature: from wave 4 each of the wave's new enemies is a wall of 2 armored drones out of one base, the wave no bigger than the shared wave; waves 1–3, the campaign and the shared wave draw their own; the Island's signature stays one enemy each.
- `tests/v3/mapRules.test.ts`: no repeats and no gaps; `MAP_PLANS` complete; the boss target is 2.
- `tests/v3/mapCards.test.ts`, `round11.test.ts`, `convoy.test.ts`: the production setup is policy D with the encounters, no command.
- `tests/v3/readyToTest.test.ts`: the new entry.
- `e2e/v3-map-cards.mjs`: the hub card says so; `?lab=map-needle` opens the full map with encounters rev 4 and no command. `e2e/v3-encounters.mjs`: the map with no authored encounters is now the Archipelago.

## What to look for when you play

Watch the mouth. The ships sail wide over the open water in the west, then the funnel closes them into single file and they slow and queue at the mouth, right between the two enemy headlands: the south one is on your side of the strait, nearer your carrier than any enemy site so far. Wave 1 sends a few drones off the south headland at the queue; wave 3 the first cluster over it from the north headland. From wave 4 small walls of armored drones come in every wave, two at a time, plates first, as the boss's Shield Wall does in one big block; on wave 7 a jet strafes the column end to end; on wave 8 a heavy comes from the south headland's short range. The open water in the west is the safe part: only a sub (waves 4 and 6) and the climax reach it. The question to answer: did the queue at the mouth feel like the place to defend, and did the armored walls feel like the Shield Wall arriving early, or like more of the same drones? In the boss rounds one block of armored drones flies at one ship plates first and banks twice on the way; a cluster comes over the queue early in each round and a shell late. Tell us whether round 1 feels too light and whether the three rise.

(This section names no weapon to try: the counter kit above is a design note for the bots, never shown in the game or on the hub.)
