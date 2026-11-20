# The Archipelago: map card (map rebuild, chapter 2)

**Date:** 2026-11-20. The Archipelago (`archipelago`, chapter 2 "The Narrows", the 9th map) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), after the Island, the Behemoth Run and the Needle of Bosk (`docs/design/v3-ch2-island.md`, `v3-ch2-behemoth.md`, `v3-ch2-needle.md`). Encounter rev 4; play log v37 (on top of the playtest fixes, v36).

Code:
- `src/v3/data/encounters.ts`: `ARCHIPELAGO_R4` (ten encounters), `ARCHIPELAGO_BOSS_ROUNDS` and `MAP_BOSS.archipelago`, `MAP_SIGNATURE.archipelago`, `REBUILT_MAPS` (via `CHAPTER_TWO_MAPS`), in the chapter 2 block;
- `src/v3/data/mapPlans.ts`: `MAP_PLANS.archipelago`;
- `src/v3/data/convoy.ts`: `MAP_CONVOY.archipelago` (the map's own convoy, no command);
- `src/v3/sim/game.ts`: a signature may be one of the map's own threat kinds instead of a foe (`MAP_SIGNATURE` `kind`: the motherships) and bring an escort (`escort`: a Scavenger Drone with each), the escort's launch one drone out of the wave's own (the Needle's walls' rule, now one helper, `takeDrone`);
- `src/v3/sim/events.ts`: the Supply Raid reads its rounds from `MAP_BOSS` (its swarms, a round's own launches, `fire`, which may now send a mothership) and how many weapons each cargo run carries (`cargoWeapons`);
- `src/v3/data/lab.ts`: "Ready to test" lists the Archipelago at v37;
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

Warning time falls from 8.3 s on wave 1 to 5.7 s on wave 10 (−0.18 s a wave, rule `g-warning`). The islets are close to the lane, but most of the waves' fire is drones (the shells come out of the waves, below), and a drone from an islet still takes a few seconds to cross.

## The stretches

The bot report cuts the lane into thirds along it: the west end where the ships come in (under the west islet, the long reach), the middle (under the middle islet and the gaps), and the east end (beside the carrier and the frigate).

- **Danger: the west end**, the early third: 41% of the hull damage in waves 1–9 (the player's Armory; 48% with the latest Armory, 40% with none). The shells, the clusters and most of the west islet's swarms go at the ship least far along (aim `rear`), and the motherships come from there.
- **Safe: the east end**, the late third, by the carrier: 22% (passes, under the 25% line). `MAP_PLANS.archipelago.stretches` says danger early, safe late (the map as it was: hot middle 41%, cold late 23%).

## The convoy

The map's own convoy, no command (rule `m-convoy`): pairs at the reference maps' schedule (`MAP_CONVOY.archipelago`: flow 2, pairs), west to east down the one lane. The lane does the shaping (rule `m-shape-convoy`): the ships come in at the far west end, under the west islet and a long reach from the carrier, and deliver in the east beside it, so the ships most at risk are always the newest. No command is needed. The map card now opens on policy D with the encounters on (it opened on today's convoy controls and no encounters).

## The signature: drone motherships, each with a scavenger

The player's round 9 (r9-map-signature): each map gets a threat of its own in waves 4–10, tied to its identity and its boss. The Archipelago's blurb has always been "enemy islets with gaps between them, and drone motherships"; its boss is the Supply Raid (cargo runs raining pickups, scavengers locking them, drone swarms). Its signature takes one from each (`MAP_SIGNATURE.archipelago`: from wave 4, every new enemy the wave planner draws is a drone mothership, out of the west islet or the north-west shore, and each comes with a Scavenger Drone in from an edge):

- **A mothership** (5 hits) crawls from the west over the convoy towards the carrier, launching a mini-drone at a ship every 2.6 s as it goes. The drones come at the ships from wherever it is: a launch point that moves, over the lane, from the far west end. It stands in for the drone swarm the enemy it replaces would have taken (the wave planner's rule), so the wave sends no more.
- **A scavenger** (the Supply Raid's own) locks every pickup in its ring until it is shot down, the mothership's drop among them (a mothership drops a pickup 7 times in 10). Its launch is one drone out of the wave's own (rule `w-budget`).

The Scavenger Drone debuts on the Island's wave 5; the Archipelago's own extra motherships (from wave 6, as before) stay. The wave planner draws one new enemy on waves 4–5, two on 6–9 and three on 10, so the signature sends 1, 1, 2, 2, 2, 2 and 3 motherships (wave 6's encounter stands in for the map's own mothership that wave, so the step from 5 to 6 is one mothership, not two).

How much of waves 4–10 it is (`tools/v3/combo-sweep/mixwaves.ts`, 4 seeds, the "you" bot drafting for itself, tough; motherships with their mini-drones):

| | Waves 4–10 | Waves 6–10 | Boss rounds |
| --- | --- | --- | --- |
| Share of the threats that show | 15% | 17% | 7% |
| Share of the hits it takes to clear them | **25%** | 27% | 16% |

About a quarter by hits, as asked (the Island's helicopters 22%, the Behemoth's jets and heavies 20%, the Needle's walls about a quarter, by the same tool). The scavengers are not counted (another 4–5% of what shows, 3 hits each since the playtest fixes).

## The counters

- **Counter kit: Air Strike, Point Defense, Flak Cannon.** Every threat ends on the one lane, whichever side it came from: the Air Strike's jet down that row takes all that converge on it (a mothership's five hits among them), each ship's own Point Defense needs no reach to the far west end, and the Flak Cannon's cloud waits over the lane where they arrive.
- **Off-counter kit: Seeker Pod, Railgun, Drone Screen.** The Seeker's long flight is too late at the long reach, the Railgun's line takes one direction at a time, and the Drone Screen fights one drone at a time.
- Every weapon is in chapter 2's draft.

How they compare (the player's Armory, bot report, 24 seeds, the kit as the bot's taste):

| | Won | Lost in waves 1–10 (normal) | Boss r1 / r2 / r3 (reached) |
| --- | --- | --- | --- |
| Counter kit | **46%** | 3.7 | 1.15 / 0.36 / 1.27 |
| Off-counter kit | 29% | 3.7 | 2.14 / 1.42 / 2.00 |
| The bot's own draft (the record) | 50% | 4.3 | 1.07 / 0.33 / 1.33 |

The counter kit wins clearly more often than the off-counter kit (46% against 29%) and loses fewer ships in the boss rounds; in waves 1–10 they lose the same. With the latest Armory: 38% against 29%.

## Loadouts on this map (combo sweep singles)

Each weapon alone, forced at every draft (12 seeds, the player's Armory, game version 37, with the playtest fixes; `npm run v3:combo-sweep -- --stage=singles --maps=island,behemoth,needle,archipelago --out=tools/v3/combo-sweep/results/v37-ch2`). Ships lost over all 13 waves:

- **Strong:** **Air Strike 3.3** (won 92%), Gravity Well 4.7, Flak 5.8, Scattergun 6.0.
- **Middling:** Point Defense 7.1, Gunship Pair 7.2, and the rest of the draft.
- **Weak:** the long-reach and one-at-a-time weapons (Seeker Pod, Drone Screen, Boomerang, Railgun), Supply Run alone, the Charge Lance (the bot charges it poorly) and the plain gun.
- **The Supply Raid flatters a forced single.** Its cargo hands back the weapon held, at its best: before this build a forced Shield or Air Strike lost 0.00–0.03 ships a round in the boss. The rounds now carry one weapon each (in the first cargo run; the event gives one for each weapon held, in both runs); a forced Air Strike still loses only 0.36 a round. With no weapon at all every weapon ran out and every kit lost about five ships a round, so that was not an option.
- Before the playtest fixes (game version 36) the Shield was best alone here (2.2), level with Air Strike (2.4); a Shield that breaks after 3 hits fell out of the lead on every chapter 2 map.

## Diversity: are the Archipelago's best kits its own?

The player's rule for this rebuild: the Archipelago's best kits and its best weapon alone must differ from the other three chapter 2 maps'. All four maps were swept again at version 37 (the playtest fixes change the Shield, the helicopter, the torpedo sub and the Scavenger on every map): singles on 12 seeds, every pair on 6, each map's 6 best pairs with every third weapon on 6, its 10 best kits on 16 (`tools/v3/combo-sweep/diversity.ts`, results in `tools/v3/combo-sweep/results/v37-ch2/`; docs/design/v3-combo-diversity.md, "The Archipelago").

| Map | #1 | #2 | #3 | #4 | #5 |
| --- | --- | --- | --- | --- | --- |
| The Island | **Air Strike + Thermobaric Shell + Point Defense** 6.6 ±0.7 | Air Strike + Point Defense + Gunship Pair 7.8 | Flak Cannon + Drone Screen + Gunship Pair 8.4 | Air Strike + Point Defense + Drone Screen 8.4 | Railgun + Tesla Arc + Overdrive 8.6 |
| The Behemoth Run | **Air Strike + Drone Screen + Supply Run** 4.0 ±0.5 | Air Strike + Drone Screen + Full Steam 4.7 | Frigate Escort + Gravity Well + Shield 5.3 | Air Strike + Gravity Well + Drone Screen 5.6 | Thermobaric Shell + Flak Cannon + Full Steam 5.9 |
| The Needle of Bosk | **Scattergun + Railgun + Supply Run** 5.3 ±0.8 | Shrapnel Shell + Gravity Well + Gunship Pair 6.2 | Shrapnel Shell + Railgun + Supply Run 6.9 | Shrapnel Shell + Flak Cannon + Gunship Pair 7.3 | Gravity Well + Railgun + Supply Run 7.3 |
| The Archipelago | **Air Strike + Gunship Pair + Shield** 3.4 ±0.5, won 94% | Air Strike + Railgun + Gunship Pair 3.6 | Air Strike + Gravity Well + Supply Run 3.9 | Air Strike + Gunship Pair + Supply Run 4.0 | Air Strike + Frigate Escort + Gunship Pair 4.2 |

| Measure | Result |
| --- | --- |
| Jaccard of the top-5 kits, every pair of maps | **0** (no kit shared) |
| The same, one map against itself (two halves of its seeds) | 0.25 / 0.25 / 0.25 / 0.43 (the Archipelago) |
| #1 kit | a different one on each map |
| Best weapon alone | **Air Strike on three maps of four** (the Island, tied with the Gunship Pair and Point Defense at 6.8; the Behemoth Run 6.8; the Archipelago 3.3); the Needle: the Gunship Pair |
| Rank correlation of the weapons alone, the Archipelago against the Island / the Behemoth Run / the Needle | 0.81 / 0.81 / 0.35 |

- **The Archipelago's kits are its own:** no top-5 kit is another map's, and its #1 kit is its own.
- **Its best weapon alone is not: Air Strike, as on the Island and the Behemoth Run.** This fails the player's rule. It is a chapter 2 weapon finding more than a map one: once the playtest fixes made the Shield break, the Air Strike became the best weapon alone on three of the four maps. It is strongest here (3.3 ships against 6.8 elsewhere) because the Archipelago is one lane: every threat, from whichever islet, gap or side, ends on the same row, and the Air Strike's jet takes the row. All five of the map's best kits hold it. See "Questions for the player".

## The debut

None of its own. The Archipelago's slot is the Scavenger Drone (`mapDebut`), but every chapter 2 enemy already comes in on the Island, one a wave from wave 2 with a light debut wave each (see the Island's card), so no "NEW · The Narrows" banner is due here (the Needle's card says the same). The motherships are a chapter 1 kind (the shared waves' extras here since the 20-map plan). Nothing from a later chapter: the encounters send only drones, shells, guided missiles, clusters and a strafer, all in the map's table by their waves (`tests/v3/encounters.test.ts`).

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated. Every shell the shared wave would send from wave 2 on comes out of the wave, so its submarines carry drones instead of padding their salvos with shells (a sub fills a salvo of 4 whatever it is given: the shells sank most of the bot's ships on the map with its own convoy). The encounters put a few shells back where the map wants them: through the gaps, from behind, over the islets. The wave keeps its own drones to make up the rest (×0.86–1.0 of its launches without the encounters on the record report, rule `w-budget`; from wave 8 a swarm or two goes at the ship halfway along to keep the budget). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | Off the west islet (`archipelago-west-islet`) | west islet, 3 drones | the ships coming in (the long reach) |
| 2 | teach | Through the gap (`archipelago-gap`) | west-gap sub, 2 shells; middle islet, 4 drones | the ships coming in; beside the middle islet; in place of the wave's 2 shells |
| 3 | teach | Islet and periscope (`archipelago-front-back`) | west islet, 5 drones; west sub behind the convoy, 2 shells | both at the ships coming in; in place of the wave's 4 shells |
| 4 | combine | Islet by islet (`archipelago-islet-chain`) | the three islets in turn, 4 drones each; north-west shore, 1 shell | any ship; the ships coming in; in place of the wave's shells (the first mothership and scavenger come with the wave) |
| 5 | combine | Both ends (`archipelago-both-ends`) | sub off the west end, 3 shells; east islet, 1 guided; middle islet 5 and west islet 6 drones | the last ships; the lead ship; the ships coming in; in place of the shells and guided missiles |
| 6 | combine | Behind the convoy (`archipelago-behind`) | west sub behind, 2 shells; west islet, 6 drones; middle islet, 1 guided and 5 drones; east islet, 5 drones | the ships coming in; beside the west islet; any ship; in place of the shells, guided missiles and the map's own mothership |
| 7 | escalate | A jet from the west (`archipelago-strafe`) | a jet from the west; north-west shore, 1 shell; west islet 5, east 4, middle 4 drones | the lane; the ships coming in; beside the west islet; in place of the shells and a jet |
| 8 | escalate | Both gaps (`archipelago-both-gaps`) | subs in both gaps, 2 shells each; west 4, middle 4, east 4 + 4 drones | the ships coming in; beside the east gap; halfway along; in place of the shells and a heavy |
| 9 | escalate | A cluster off the islet (`archipelago-cluster`) | west islet, 1 cluster and 5 drones; middle islet 4, east 4 + 5 drones | any ship; halfway along; in place of the shells, a cluster and a heavy |
| 10 | climax | Run the chain (`archipelago-run`), after the wave's own fire (`at: 1`) | west islet, 1 cluster; middle islet, 5 drones; east islet, 1 guided; four swarms of 3 and two of 4 all wave | the ships coming in; the lead ship; halfway along; in place of the shells, most guided missiles, a heavy, a cluster, a supersonic and a jet |

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

"Before" is the map card as it was: today's convoy controls, no encounters, the event as it was, at game version 36 before the playtest fixes (`tools/v3/map-report/results/archipelago-before*.md`). "After" is this build (log v37, with the playtest fixes). Commands: `npx vite-node tools/v3/map-report/report.ts -- --map=archipelago --seeds=24 --kits=plan [--armory=player | --armory=latest] [--no-fun]`.

### The player's Armory (Quick Reload 5, Damage Control 4, Stockpile 5)

| | Before | After |
| --- | --- | --- |
| Won (normal) | 83% | **50%** |
| Mean end wave | 13.3 | 11.6 |
| Ships lost in waves 1–10 (normal) | 3.2 | 4.3 |
| Ships lost in waves 1–5 (normal) | 0.08 | **0.46** |
| Boss r1 / r2 / r3 (normal, reached) | 0.00 / 0.05 / 0.00 | **1.07 / 0.33 / 1.33** |
| Boss r1 / r2 / r3 (tough) | 0.00 / 0.04 / 0.00 | 1.63 / 1.17 / 2.33 |
| Tough curve 1–10 | 0 0 0 .08 0 0 .92 .33 .79 1.29 | 0 0 .21 0 .25 .58 .92 .96 1.42 .96 |
| `w-cliff` | **FLAG** (w7 0 → 0.92, w9) | **FLAG**, marginal (w6 0.25 → 0.58; the biggest step w9 +0.46) |
| `w-early` close calls from w3 | PASS | PASS (fewest w3 1.7, 83% of runs) |
| `w-budget` | PASS | PASS (furthest w7 ×0.90) |
| `m-stretches` | PASS (hot middle 41%, cold late 23%) | PASS: hot early 41%, cold late 22% |
| `g-warning` | PASS: 8.6 → 4.0 s | PASS: 8.3 → 5.7 s |
| `w-first` | PASS | PASS |

The record report is 24 seeds; the tuning reads on 96 (900–995, `quick.ts`): won **52%** (46% and 58% on the two halves), ships lost in waves 1–10 3.9, in waves 1–5 **0.65**, boss rounds **0.6 / 0.7 / 1.6** (normal, reached), 1.8 / 1.6 / 2.7 (tough). The sim is chaotic: one more swarm in a wave moved later waves and the boss by up to ±0.4 of a ship on the same seeds, and the record's 24 seeds read round 2 lighter than round 1 where the 96 read them rising.

### The player's latest Armory (Wide Warhead 5, Point Defense 4, Supply Lines 3)

| | Before | After |
| --- | --- | --- |
| Won (normal) | 29% | **50%** |
| Ships lost in waves 1–10 / 1–5 (normal) | 4.6 / 0.13 | 4.3 / 0.75 |
| Boss r1 / r2 / r3 (normal, reached) | 0.00 / 0.00 / 0.00 (7 runs) | **0.47 / 1.00 / 1.36** |
| Boss r1 / r2 / r3 (tough) | 0.04 / 0.08 / 0.04 | 1.21 / 1.50 / 2.13 |
| Tough curve 1–10 | 0 .04 0 0 .08 .25 .75 1.58 3.04 3.67 | 0 0 .04 .21 .50 .13 .96 1.58 .96 1.25 |
| Checks | `w-cliff` **FLAG** (w7, w8) | `w-cliff` **FLAG** (w6 0.13 → w7 0.96); the rest PASS |
| Kits (won; lost 1–10) | | counter 38%, 4.2; off-counter 29%, 4.5 |

### Baseline (no Armory)

| | Before | After |
| --- | --- | --- |
| Won (normal) | 0% | 0% |
| Ships lost in waves 1–10 / 1–5 (normal) | 5.6 / 0.79 | 6.0 / 1.83 |
| Boss r1 / r2 / r3 (tough) | 0.00 / 0.13 / 0.08 | 1.42 / 3.42 / 3.54 |
| Tough curve 1–10 | 0 0 .04 .38 .46 1.04 2.71 5.00 6.00 6.92 (22.5) | 0 0 .17 .63 1.08 1.79 2.08 4.13 4.83 3.92 (18.6) |
| `w-cliff` | **FLAG** (w6, w7) | **FLAG** (w4, w8) |

As on the other maps, the baseline stands in for a player with no upgrades and is far harder; the encounters are lab only.

**For comparison,** the same card on the map's own convoy with no encounters (version 36, the player's Armory, 24 seeds) won 38% and lost 4.8 ships in waves 1–10 (7.3 tough) and 0.1 a boss round; shells (sub salvos of 4) sank most of it.

### Chapter 2 difficulty (rule `m-difficulty`)

With the player's Armory the bot wins 50% on the record (52% on 96 seeds; the latest Armory 50%): inside the 50–70% asked, at its low end. Waves 1–5 lose 0.46–0.65 (in the 0.4–0.8 band), waves 1–10 3.9–4.3, and the boss rounds read 0.6 / 0.7 / 1.6 on the bot (normal, 96 seeds), under the 1.5 / 2 / 2.5 asked, as on the other chapter 2 maps; on the tough runs, which play every round, 1.6–1.8 / 1.2–1.6 / 2.3–2.7.

## Fun measures (provisional, `src/v3/sim/funMetrics.ts`)

From `archipelago-player.md`:
- **Tension climbs to wave 5 and holds:** its peak is 0.25, 0.41, 0.69, 0.48, 1.01 on waves 1–5 (wave 3's drones and shells at the west end are the first real moment; wave 4 dips), then 0.94–1.14 on waves 6–10, one peak in most runs. Boss rounds 1.06 / 0.94 / 1.26.
- **Close calls** from wave 3: 1.7–5.8 a run on every wave 3–10; wave 3 is the lowest (1.7, 83% of runs).
- **Saves:** 0–0.5 a run on waves 1–10 (0.5 on waves 7, 9 and 10), 0.1–0.2 in the boss rounds.

## What is not satisfied, or uncertain

- **Air Strike is the best weapon alone here, as on the Island and the Behemoth Run** (version 37). This fails the player's diversity rule for the best single (the kits pass). It became so when the playtest fixes made the Shield break; on version 36 the Shield and Air Strike were level here and the Shield was the Needle's best. A question for the player (below).
- **The Supply Raid hinges on its cargo.** Held weapons run out, and the cargo is where they come back: with none, every kit lost about five ships a round; with the event's own (one for each weapon held, in both runs) a forced Shield or Air Strike lost none. One weapon a round, in the first run, is the middle way chosen; a forced kit at its best still breaks the boss (the best kits lose 0.02–0.5 ships a round there).
- **The boss is under the asked 1.5 / 2 / 2.5 on normal runs** (0.6 / 0.7 / 1.6 on 96 seeds) and round 2 is not clearly above round 1; on the tough runs it reads 1.6–1.8 / 1.2–1.6 / 2.3–2.7. More would take the win rate under 50% (it reads 50–52% now).
- **`w-cliff` flags on wave 6** in the record (0.25 → 0.58, the line at 0.5) and with the latest Armory (0.13 → 0.96 on wave 7). The 96-seed reads climbed without a doubling (tough 0.46 / 0.52 / 0.94 / 1.00 on waves 5–8); 24 seeds are noisy here.
- **Scavengers escort the motherships:** with three hits each since the playtest fixes they take shots, and they lock pickups the bot would grab. The bot's waves 6–10 got about half a ship harder with them; a player who shoots them first may feel it less, or more.
- **The win rate is at the bottom of the band** (50% on the record, 52% on 96 seeds).
- **"Routes that split and rejoin" are not built.** The map keeps its one lane; changing its geometry would change the campaign map too.
- **No player data** on chapter 2's later maps yet: the bot's bias here is unknown. On chapter 1 the bot read boss rounds 1.4–2.5× as hard as the player did.
- **This branch carries the playtest fixes** (PR #195, not yet in the base when this was built; see "The play log").

## The play log (v37)

`LOG_VERSION` 37, `LOG_REPLAYS` `[37]` (`src/v3/sim/playlog.ts`). The base branch was at v35 (the Needle, #193) when this started, and the Archipelago was built as 36. The playtest fixes (`claude/v3-playtest-fixes`, log v36: the Shield breaks after hits, the helicopter, the torpedo sub, the Scavenger) were about to land first, so they were merged into this branch and the Archipelago moved to 37; the final tuning, the bot reports and the chapter 2 sweep were made on top of them. Its change is lab only, under the encounter layer: the campaign plays as it did, and a v36 Archipelago card log played the map with no encounters (it no longer replays). The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 37. The Test Lab's "Ready to test" lists the Archipelago at v37.

## Questions for the player

- **Air Strike is the best weapon alone on the Archipelago, the Island and the Behemoth Run (after the Shield fix). What now?** Recommended: a chapter-wide look at the Air Strike (a weapon pass, not this map), then sweep chapter 2 again. Other options: give the Archipelago fire that does not end on the lane's row (a map change, harder to keep readable), or accept a shared best single where the kits differ.
- **The Supply Raid's cargo: one weapon a round, in the first cargo run (built), or the event's own (one per weapon held, both runs)?** Recommended: one a round, as built; with the event's own, a weapon held at its best ends the boss.
- **Boss rounds under the asked 1.5 / 2 / 2.5 on normal runs (0.6 / 0.7 / 1.6), to keep the bot's win rate at 50%: keep, or raise them and accept fewer wins?** Recommended: keep, and judge from your play (on chapter 1 the bot read boss rounds harder than you did).
- **A second route that splits round the middle islet and rejoins: worth a map change later?** Recommended: not now; it changes the campaign map and the Island already has two lanes.

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

Watch the west end. The ships come in at the far west, under the west islet and as far from your carrier as the lane goes, and sail east to deliver beside it. Wave 1 sends a few drones off the west islet at them; wave 2 a periscope in the gap between the islets; wave 3 drones from the islet and shells from behind at once. From wave 4 a drone mothership comes off the west islets each wave (two from wave 6, three on wave 10): it crawls over the convoy towards your carrier, launching small drones as it goes, and a scavenger comes in from an edge with it to lock the pickups in its ring. The east end by your carrier is the safe part. The question to answer: did the threats feel like they came from several directions, the islets, the gaps, behind and the motherships overhead, and did the west end feel like the place to defend? In the boss rounds the Supply Raid drops cargo over the lane while scavengers come for it, swarms come off the islets, and motherships, shells and a cluster go for the ships coming in; the cargo carries one weapon a round now, not one for each you hold. Tell us whether the boss feels like a scramble or a chore, and whether the three rounds rise.

(This section names no weapon to try: the counter kit above is a design note for the bots, never shown in the game or on the hub.)
