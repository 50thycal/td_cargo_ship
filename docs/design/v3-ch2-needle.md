# The Needle of Bosk: map card (map rebuild, chapter 2)

**Date:** 2026-11-20. The Needle of Bosk (`needle`, chapter 2 "The Narrows", the 8th map) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), after the Island and the Behemoth Run (`docs/design/v3-ch2-island.md`, `v3-ch2-behemoth.md`) and with their round 9 signature threats. Encounter rev 4; play log v35.

Code:
- `src/v3/data/encounters.ts`: `NEEDLE_R4` (ten encounters), `NEEDLE_BOSS_ROUNDS` and `MAP_BOSS.needle`, `MAP_SIGNATURE.needle`, `REBUILT_MAPS` (via `CHAPTER_TWO_MAPS`), in the chapter 2 block;
- `src/v3/data/mapPlans.ts`: `MAP_PLANS.needle`;
- `src/v3/data/convoy.ts`: `MAP_CONVOY.needle` (the map's own convoy, no command);
- `src/v3/sim/game.ts`: a signature's `block` (the wave planner): each of the wave's new enemies comes as a small wall of armored drones, its extra drones taken out of the wave's own one for one;
- `src/v3/sim/events.ts`: the Shield Wall reads its rounds from `MAP_BOSS` (the block's size and width) and adds a round's own launches (`fire`, as the Gunship Wall and the Wolf Pack do); a boss round's `fire` may now send a cluster;
- `src/v3/data/lab.ts`: "Ready to test" lists the Needle at v35;
- `tools/v3/combo-sweep/mix.ts`, `mixwaves.ts`: the Needle among the maps, its signature the armored drones.

Bot reports: `tools/v3/map-report/results/needle.md` (no Armory), `needle-player.md` (the player's usual Armory, with fun measures and the heat map) and `needle-latest.md` (the player's latest Armory: Wide Warhead 5, Point Defense 4, Supply Lines 3). Tuning reads: the bot as `tools/v3/map-report/quick.ts` plays it, on 48 seeds at a time (900–947 and 948–995).

## The problem

> Open water narrows to a gap one hull wide: the convoy closes into single file and queues at the mouth, right between the two enemy headlands, where one cluster, one shell or one wall of armored drones finds ships nose to tail.

The Needle is a shape, not a mechanic (rule `m-mechanic`: the Needle has none). The lane is 380 px wide in the west, closes from x 480 to 64 px at x 1000, runs one hull wide to x 1240 between the headlands, and opens again to the east. Ships slow and queue at the mouth (the map's own rule, since the 20-map plan). The two headlands carry a silo each, the north one over the gap and the south one on your side of the strait, south of the gap, nearer your carrier than any enemy site on chapter 1's maps.

## Sites and their jobs

Bases and spots are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| West silo (base 1) | North shore (300, 92) | drones, guided | Long-warning swarms over the open water (w2, w4–10), the guided missile at the lead ship (w5). |
| North-shore silo (base 2) | North shore (700, 100) | shells, supersonic | The shared waves' own: shells and supersonic missiles down the funnel. |
| North headland (base 3) | Over the Needle (1120, 290) | clusters, shells | The signature place: the clusters over the queue (w3, w10, every boss round) and shells into the gap (w2, w5, w7, w9, every boss round). |
| South headland (base 4) | Enemy land south of the Needle, on your side (1130, 650) | drones, clusters, heavies | Point-blank swarms at the queue (w1, w3, w5–7, w10), other swarms (w4–6, w8–10) and the heavy (w8). |
| East silo (base 5) | Far shore past the Needle (1490, 88) | guided, supersonic | Missiles at the lead ship on its way out (w6, w10). |
| North-west sub spot (spot 1) | Open water west of the funnel (200, 208) | sub salvos | Shells at the ships still coming in (w4). |
| East sub spot (spot 2) | Past the Needle (1500, 252) | sub salvos | Shells at the lead ship coming out (w9). |
| South-west sub spot (spot 3) | By your own shore (300, 718) | sub salvos | Shells behind the convoy (w6). |
| Coast road, pop-up road, air lines | The north shore; the south headland (1190, 940 → 545); the edges | trucks, strafers, bombers | The shared waves' own; the jet down the column (w7). |

Warning time falls from 8.6 s on wave 1 to 5.2 s on wave 10 (−0.24 s a wave, rule `g-warning`; the shortest is wave 5, 4.7 s, the two headlands at once). It falls less steeply than on the Island and the Behemoth Run: from wave 4 most of the wave's shells come as drones, and a drone from the west silo crosses the open water with a long warning.

## The stretches

The bot report cuts the lane into thirds along it: the open water in the west, the funnel and the mouth in the middle, the Needle and the way out in the east.

- **Danger: the mouth and the Needle**, the middle and late thirds: 41% and 47% of the hull damage in waves 1–9 (the player's Armory). The late third (the Needle itself and the way out under the east silo) is the hottest on two reports of three; the middle (the funnel and the queue at the mouth) on the third. `MAP_PLANS.needle.stretches` says danger late, safe early.
- **Safe: the open water, the west third**: 12% (passes; was 28% on the map as it was, over the 25% line). Only the subs (waves 4 and 6), the west silo's swarms and the climax reach it.

## The convoy

The map's own convoy, no command (rule `m-convoy`): pairs at the reference maps' schedule (`MAP_CONVOY.needle`: flow 2, pairs). The lane does the shaping (rule `m-shape-convoy`): the pairs sail wide over the open water, fall into single file as the funnel closes and queue at the mouth. No command is needed: the queue is the problem, not something to steer. The map card now opens on policy D with the encounters on (it opened on today's convoy controls and no encounters).

## The signature: walls of armored drones

The player's round 9 (r9-map-signature): each map gets a threat of its own in waves 4–10, tied to its identity and its boss. The Needle's boss is the Shield Wall, a block of armored drones flying plates first; its signature is the same enemy in small walls (`MAP_SIGNATURE.needle`: from wave 4, every new enemy the wave planner draws is an armored drone, and each comes as a wall of 2 out of one base). An armored drone is one drone, not a platform, so a wall stands in for a drone swarm as any new enemy does, and its second drone comes out of the wave's own drones (rule `w-budget`: the wave sends no more). The Armored Drone debuts on the Island's wave 4; the Needle starts its walls on wave 4 too, a map later, so it needs no debut wave of its own.

How much of waves 4–10 it is (`tools/v3/combo-sweep/mixwaves.ts`, 4 seeds, the "you" bot drafting for itself, tough):

| | Waves 4–10 | Waves 6–10 | Boss rounds |
| --- | --- | --- | --- |
| Share of the threats that show | 11% | 11% | 59% |
| Share of the hits it takes to clear them, hulls only (an armored drone 2) | 16% | 16% | 74% |
| The same, every plate hit counted (an armored drone 2 + its plate 4) | 36% | 36% | 90% |

The plate takes a shot only from the front, and the walls fly plates first at the convoy, so many of the carrier's shots meet a plate and some (a blast, a helper from the side, a wall banking) go round it: the share by hits lies between the two, about a quarter of waves 4–10 by our estimate, inside the 20–30% asked (the Island's helicopters are 22%, the Behemoth's jets and heavies 20%, by the same tool). By count it is 11%: a wall is two drones where a helicopter is one platform.

## The counters

- **Counter kit: Point Defense, Thermobaric Shell, Gunship Pair.** The headlands fire from point-blank range onto ships bunched nose to tail, too close for a shot from the carrier to get there first. Each ship's own Point Defense, which in a column covers the ship ahead and the ship behind; the Thermobaric Shell's blast, which goes round an armored wall's plates and takes a cluster with what is near it; the Gunship Pair's rockets at the thickest cluster of ships, the queue.
- **Off-counter kit: Seeker Pod, Frigate Escort, Drone Screen.** The Frigate Escort can't follow the convoy through the Needle (its frigates back out of the narrows), the Seeker's long flight is too late at the mouth, and the Drone Screen's drones fight one drone at a time. Alone, each of the three reads well on the last sweep (below): together they cover the open water and leave the queue to the shells and clusters.
- Every weapon is in chapter 2's draft.

How they compare (the player's Armory):

| | Ships lost, all 13 waves | Won |
| --- | --- | --- |
| Counter kit, forced (combo sweep's `check-one.ts`, 16 seeds) | **7.3** ±0.9 | 69% |
| The bot drafting for itself (combo sweep singles, 12 seeds) | 8.0 | 58% |
| Off-counter kit, forced (16 seeds) | 9.6 ±0.8 | 44% |
| Counter kit as the bot's taste (bot report, 24 seeds) | 3.0 in waves 1–10 | 63% |
| Off-counter kit as taste (bot report) | 2.8 in waves 1–10 | 58% |

Forced, the counter kit loses about 2.3 ships fewer than the off-counter kit and wins far more often (69% against 44%), and a little fewer than the bot's own draft (8.0). As the bot's taste (it takes them first when a draft offers them, with whatever else it is dealt) the two read within noise of each other (63% and 58% won): on this map most three-weapon kits read within a ship or two, and the map's best kits (below, "Diversity") are a better guide than a forced counter kit.

## Loadouts on this map (combo sweep singles)

Each weapon alone, forced at every draft (12 seeds, the player's Armory, game version 34, the final build of the Needle before the version moved to 35 at the last merge (the same game); `npm run v3:combo-sweep -- --stage=singles --maps=island,behemoth,needle --out=tools/v3/combo-sweep/results/v34-ch2`). Ships lost over all 13 waves:

- **Strong:** **Shield 5.2**, Drone Screen 6.0 (won 75%), Railgun 6.9, Seeker 7.0, Boomerang 7.3, Frigate Escort 7.4.
- **Middling:** Thermobaric 7.8, Overdrive 7.8, Gunship Pair 7.9; the bot's own draft 8.0; Gravity Well 8.1, Scattergun 8.2, Flak 8.3, Air Strike 8.4, Point Defense 8.5, Tesla 8.5.
- **Weak:** Shrapnel 9.3, Supply Run alone 9.9, Full Steam 11.8, Charge Lance 12.8 (plain gun 10.5).
- **The singles moved a lot between builds.** On an earlier build of these encounters (more shells and clusters at the queue, fewer drones) Point Defense read best alone (5.3) and the Drone Screen, Seeker and Frigate Escort among the weakest (9.5–11.7); on the final build, which sends the wave's shells and most clusters as drones, the helpers that fight drones read well and Point Defense middling. Singles are 12 seeds (a standard error of about a ship): neighbours a ship apart are a tie.
- No single weapon makes the map trivial (the best loses 5.2 ships a run). The Charge Lance reads badly because the bot charges it poorly; the Laser Cutter is not measured (the bot can't swipe).

## Diversity: are the Needle's best kits its own?

The player's rule for this rebuild: the Needle's best kits must differ from the Island's and the Behemoth Run's. All three maps were swept again at v34 (the Armory overhaul changed the player's Armory's Quick Reload and Stockpile since the v33 sweep): singles on 12 seeds, every pair on 6, each map's 6 best pairs with every third weapon on 6, its 10 best kits on 16 (`tools/v3/combo-sweep/diversity.ts`, results in `tools/v3/combo-sweep/results/v34-ch2/`; docs/design/v3-combo-diversity.md, "The Needle of Bosk").

| Map | #1 | #2 | #3 | #4 | #5 |
| --- | --- | --- | --- | --- | --- |
| The Island | **Point Defense + Supply Run + Shield** 6.2 ±0.8, won 81% | Scattergun + Point Defense + Shield 6.9 | Boomerang + Point Defense + Gunship Pair 7.3 | Air Strike + Scattergun + Supply Run 7.4 | Seeker Pod + Gravity Well + Tesla Arc 7.9 |
| The Behemoth Run | **Air Strike + Flak Cannon + Gravity Well** 4.2 ±0.9, won 81% | Air Strike + Boomerang + Gravity Well 4.6 | Air Strike + Flak Cannon + Supply Run 4.8 | Air Strike + Frigate Escort + Supply Run 5.1 | Air Strike + Frigate Escort + Thermobaric Shell 5.6 |
| The Needle of Bosk | **Thermobaric Shell + Boomerang + Gravity Well** 5.9 ±0.7, won 88% | Shrapnel Shell + Flak Cannon + Point Defense 6.7 | Scattergun + Flak Cannon + Supply Run 6.8 | Air Strike + Scattergun + Supply Run 6.8 | Shrapnel Shell + Point Defense + Tesla Arc 6.9 |

| Measure | Result |
| --- | --- |
| Jaccard of the top-5 kits: the Needle against the Island / against the Behemoth Run | **0.11** (one kit shared: Air Strike + Scattergun + Supply Run, #4 on both) / **0** |
| The Island against the Behemoth Run | 0 |
| The same, one map against itself (two halves of its seeds) | 0.43 (the Island) / 0.67 (the Behemoth Run) / 0.43 (the Needle) |
| #1 kit | a different one on each map |
| Best weapon alone | a different one on each map: Railgun (the Island), Frigate Escort (the Behemoth Run), **Shield** (the Needle) |
| Rank correlation of the weapons alone (the Needle against the Island / the Behemoth Run) | 0.59 / 0.67 (the Island against the Behemoth Run 0.49) |

- **The Needle's best kits are its own.** Its #1 kit and its best weapon alone are its own, no kit in its top 5 is the Behemoth Run's, and one is the Island's (#4 on both, Air Strike + Scattergun + Supply Run, a generalist kit), against 0.43 for the same map's two halves of seeds.
- **Its kits lean on area fire.** The Thermobaric Shell, Shrapnel Shell and Flak Cannon are in four of its top 5 (blasts go round an armored wall's plates and burst over the queue); the Island's lean on Point Defense and the Shield, the Behemoth Run's on Air Strike.
- **What it shares:** Point Defense (two of the Needle's, three of the Island's), the Scattergun and Supply Run (two each with the Island), Flak (two each with the Behemoth Run). The Shield is in none of the Needle's top 5 although it is the best weapon alone, as on the Island in round 9: a forced single levels it to MAX (Reflect).
- **The weapons alone rank more alike** between the Needle and the other two (0.59, 0.67) than between those two (0.49): the drones the Needle's encounters send in place of shells make its waves 1–10 more like the chapter's shared waves than its boss is.

## The debut

None of its own. The Needle's slot is the Armored Drone (`mapDebut`), but every chapter 2 enemy already comes in on the Island, one a wave from wave 2 with a light debut wave each (see the Island's card), so no "NEW · The Narrows" banner is due here. Nothing from a later chapter: the encounters send only drones, shells, guided missiles, clusters, one heavy and a strafer, all in the map's table by their waves (`tests/v3/encounters.test.ts`).

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated. From wave 4 the encounters send the wave's shells and most of its clusters as drones instead (shells, clusters and jets sank most of the bot's ships on the map with its own convoy), and stand in for some of the map's own extras (`replaces.extras`). Every shell the shared wave would send from wave 4 on, and most of its clusters, come as drones instead, one for one or more (the wave sends ×0.95–0.98 of its launches without the encounters, rule `w-budget`). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | At the mouth (`needle-the-mouth`) | south headland, 3 drones | the ship at the mouth |
| 2 | teach | Across the open water (`needle-open-water`) | west silo, 4 drones; north headland, 1 shell | the ship least far along; the mouth |
| 3 | teach | The queue (`needle-queue`) | north headland, 1 cluster; south headland, 4 drones | the queue at the mouth; in place of the wave's cluster |
| 4 | combine | Periscope in the open (`needle-periscope`) | north-west sub, 2 shells; south headland, 5 drones; west silo, 6 drones | the ships coming in; any ship; in place of the wave's shells and cluster |
| 5 | combine | Both headlands (`needle-both-headlands`) | north headland, 1 shell; south headland, 4 + 4 + 5 drones; west silo, 1 guided, then 4 drones | the mouth and the Needle; the lead ship; the open water; in place of the wave's shells and 2 clusters |
| 6 | combine | The way out (`needle-way-out`) | south-west sub, 2 shells; south headland, 5 + 5 drones; east silo, 1 guided; west silo, 7 drones | the ships coming in; the queue; the lead ship on its way out; in place of the shells, 2 clusters and the heavy |
| 7 | escalate | Down the column (`needle-strafe`) | a jet from the west; north headland, 1 shell; south headland, 6 drones; west silo, 5 + 4 + 7 drones | the queue in single file; in place of the shells and 2 clusters |
| 8 | escalate | A heavy at the mouth (`needle-heavy`) | south headland, 1 heavy and 4 + 7 drones; west silo, 4 + 5 + 6 drones | any ship, most of them queueing; in place of the wave's heavy, shells, jet, 3 clusters and mothership |
| 9 | escalate | Crossfire in the Needle (`needle-crossfire`) | north headland, 1 shell; south headland, 5 + 6 drones; east sub, 2 shells; west silo, 5 + 5 + 7 drones | the Needle; the lead ship; in place of the shells, 3 clusters, a heavy and a jet |
| 10 | climax | Run the Needle (`needle-run`), after the wave's own fire (`at: 1`) | north headland, 1 cluster; south headland, 4 swarms of 5; east silo, 1 guided; west silo, 3 swarms of 5 | the queue; the lead ship; in place of the shells, most missiles, 2 heavies, 3 clusters, a jet and a bomber |

Wave 1 loses no ship (all three reports).

## The boss plan: the Shield Wall at the mouth

The Shield Wall is the map's own event: armored drones from launch points along the north shore form up into one block at a muster point, then fly at one ship as one, plates forward, banking together twice on the way (their sides open to your shots for a moment). Under encounter rev 4 (`NEEDLE_BOSS_ROUNDS`, lab only: the campaign plays the event as it was):

| Round | Armored drones (wide) | Cluster from the north headland | Shells into the Needle |
| --- | --- | --- | --- |
| before (every round) | 12 (4) | 0 | 0 |
| 1 | 8 (4) | 1 (6 s) | 1 (12 s) |
| 2 | 8 (4) | 1 (5 s) | 2 (9, 12 s) |
| 3 | 9 (3) | 1 (4 s) | 2 (9, 13 s) |

The cluster and the shells go at the ship nearest the north headland (aim `near`): the queue at the mouth and the ship in the Needle. The block goes for the middle ship of the convoy, as before. `MAP_PLANS.needle.boss.botTarget` is 2 (the brief: about 1.5 / 2 / 2.5 on the bot's scale). Each round lasts 15–30 s (test). The intro cards are the shared ones (log v30): "Boss round", "Convoy restored, 6 ships can still be lost", "The boss: Shield Wall", "Round 1 of 3", then "Round 2 of 3" and "Round 3 of 3".

## Bot results, before and after (24 seeds, 900–923)

"Before" is the map card as it was: today's convoy controls, no encounters, the event as it was. "After" is this build (log v35). Commands: `npx vite-node tools/v3/map-report/report.ts -- --map=needle --seeds=24 --kits=plan [--armory=player | --armory=latest] [--no-fun]`.

### The player's Armory (Quick Reload 5, Damage Control 4, Stockpile 5)

| | Before | After |
| --- | --- | --- |
| Won (normal) | 25% | **58%** |
| Mean end wave | 12.3 | 13.2 |
| Ships lost in waves 1–10 (normal) | 3.0 | 2.9 |
| Ships lost in waves 1–5 (normal) | 0.33 | **0.29** |
| Boss r1 / r2 / r3 (normal, reached) | 2.30 / 2.10 / 1.69 | **0.50 / 1.64 / 2.11** |
| Boss r1 / r2 / r3 (tough) | 2.21 / 2.58 / 2.79 | 0.50 / 1.75 / 2.38 |
| Tough curve 1–10 | 0 .04 0 0 .29 .17 .29 .46 .96 1.54 | 0 .08 .08 .08 .04 .29 .38 .46 .71 .92 |
| `w-cliff` | **FLAG** (w9 0.46 → 0.96) | PASS (biggest step w9 +0.25) |
| `w-early` close calls from w3 | PASS (fewest w4 4.25) | PASS (fewest w4 1.63, 83% of runs) |
| `w-budget` | PASS | PASS (furthest w3 ×0.95) |
| `m-stretches` | **FLAG**: cold early 28% | PASS: hot late 47%, middle 41%, cold early 12% |
| `g-warning` | PASS: 9.2 → 3.6 s | PASS: 8.6 → 5.2 s |
| `w-first` | PASS | PASS |

The record report is 24 seeds; the tuning reads on 96 (900–995, `quick.ts`-style): won **53%** (50% and 56% on the two halves), ships lost in waves 1–10 3.16, in waves 1–5 **0.53**, boss rounds 0.8 / 1.55 / 2.1 (normal, reached). The sim is chaotic: one more drone or shell in a wave moved later waves by up to ±0.4 of a ship on the same seeds, so the 96-seed reads chose between versions.

### The player's latest Armory (Wide Warhead 5, Point Defense 4, Supply Lines 3)

| | Before | After |
| --- | --- | --- |
| Won (normal) | 21% | **63%** |
| Ships lost in waves 1–10 / 1–5 (normal) | 5.1 / 0.38 | 4.3 / 0.71 |
| Boss r1 / r2 / r3 (normal, reached) | 0.00 / 0.00 / 0.00 (5 runs) | 0.00 / 0.07 / 0.00 (15 runs) |
| Tough curve 1–10 | 0 0 0 .17 .33 .38 .88 3.21 3.58 4.29 | 0 0 .33 .04 .33 .08 .71 .92 1.38 1.50 |
| Checks | `w-cliff` **FLAG** (w7, w8), `m-stretches` **FLAG** | `w-cliff` **FLAG** (w6 0.08 → w7 0.71); the rest PASS |
| Kits (won; lost 1–10) | | counter 79%, 3.8; off-counter 71%, 4.5 |

**The Wide Warhead breaks the Shield Wall.** With the latest Armory the bot loses almost nothing in the boss rounds, before and after: a wider blast goes round the plates and takes a whole block at once. The boss is a test of the Armory as much as of the kit (see "What is not satisfied").

### Baseline (no Armory)

| | Before | After |
| --- | --- | --- |
| Won (normal) | 0% | 0% |
| Ships lost in waves 1–10 / 1–5 (normal) | 5.1 / 1.08 | 5.5 / 1.17 |
| Boss r1 / r2 / r3 (tough) | 2.50 / 2.67 / 2.33 | 2.13 / 3.25 / 2.88 |
| Tough curve 1–10 | 0 0 .13 .25 .75 .83 2.25 4.83 7.08 7.71 (23.8 in all) | 0 .08 .42 .13 .54 .54 1.46 1.54 2.04 2.42 (9.2) |
| `w-cliff` | **FLAG** (w5, w7, w8) | **FLAG** (w5, w7) |
| `m-stretches` | **FLAG** | PASS |

As on the other maps, the baseline stands in for a player with no upgrades and is far harder; the encounters are lab only.

**For comparison,** the same card on the map's own convoy with no encounters (tough, the player's Armory, 32 seeds) loses 9.1 ships in waves 1–10 and 2.1 / 2.8 / 3.0 in the boss rounds: the map's own convoy (two ships at a time, queueing at the mouth) is far harder for the bot than today's convoy controls on this map, and shells (36 hull points a run), clusters (34) and jets (24) sink most of it, drones only 8. The encounters trade the shells and most clusters for drones. Fewer ships (flow 1) or a column formation did not help (9.6 and 8.8 lost).

### Chapter 2 difficulty (rule `m-difficulty`)

With the player's Armory the bot wins 58% (53% on 96 seeds; the latest Armory 63%): inside the 50–70% asked, the first chapter 2 map to be (the Island read 40%, the Behemoth Run 42% before round 9). Waves 1–10 lose 2.9–3.2 ships (the Island 3.9–4.8, the Behemoth 3.0), waves 1–5 0.29–0.53 (in the 0.4–0.8 band on 96 seeds, under it on the record's 24), and the boss rounds read 0.5 / 1.6 / 2.1 on the bot, rising, under the 1.5 / 2 / 2.5 asked in round 1 (see "What is not satisfied").

## Fun measures (provisional, `src/v3/sim/funMetrics.ts`)

From `needle-player.md`:
- **Tension rises, with a dip on wave 4:** its peak is 0.13, 0.36, 0.82, 0.44, 0.62 on waves 1–5 (wave 3's cluster over the queue is the first real moment), then 0.67–0.98 on waves 6–10 with one peak in most runs on wave 6. Boss rounds 1.5 / 2.1 / 2.2, rounds 2 and 3 pinned in most runs.
- **Close calls** from wave 3: 1.6–5.9 a run on every wave 3–10; wave 4 is the lowest (1.6 a run, 83% of runs), wave 8 next (1.7).
- **Saves:** 0–0.3 a run on waves 1–10 (under the provisional 0.3–0.5), boss rounds 0.2 / 0.5 / 0.7: the drones that replace the shells are cleared, or they hit; few single taps save a ship, as on the Island and the Behemoth Run.

## What is not satisfied, or uncertain

- **Boss round 1 is light and round 2 a little under** (0.5 and 1.6 on the bot against 1.5 and 2; round 3 2.1 against 2.5). The Shield Wall is very sensitive to the block's size: one drone more in round 2 (9 in place of 8) read 1.9–2.2 and took the win rate to 38%; at the asked 1.5 / 2 / 2.5 the three rounds add up to the loss limit after the restore, so the bot could win few runs (the Island's and the Behemoth Run's finding). This build keeps the win rate in its band and the rounds rising. A question for the player (below).
- **The Wide Warhead breaks the boss.** With the latest Armory (Wide Warhead 5) the boss rounds read 0.0–0.1: blasts go round the plates. With the usual Armory they read as above. The boss is the one place on this map where an Armory card decides more than the kit.
- **Waves 1–5 lose 0.29 on the record report** (24 seeds), under the 0.4–0.8 band; 0.53 on 96 seeds. Wave 4 is quiet (its shells come as drones, the walls are new): its close calls are the fewest (1.6 a run).
- **The latest Armory reads a cliff on wave 7** (0.08 → 0.71, tough): wave 6 is very light for it; with the usual Armory wave 7 is 0.38 after 0.29.
- **The counter kit is only a little better as the bot's taste** (63% won against 58%, the bot report), clearly better forced (7.3 ships a run against 9.6, won 69% against 44%; `check-one.ts`, 16 seeds), and no better than the bot's own draft. On this map most three-weapon kits read within a ship or two of each other.
- **The singles and the kits are noisy here.** The best weapon alone moved from Point Defense (5.3, an earlier build) to the Shield (5.2, the final build), and the Drone Screen from among the weakest to second; the forced counter and off-counter kits disagree with the singles of their weapons. 12–16 seeds a kit leave about a ship of noise.
- **The signature is 11% of waves 4–10 by count**, a quarter by the hits it takes (16% counting hulls, 36% counting every plate hit).
- **No player data** on chapter 2 yet (the Island and the Behemoth Run are being playtested): the bot's bias here is unknown. On chapter 1 the bot read boss rounds 1.4–2.5× as hard as the player did.
- **This branch carries the round 9 build** (the signature threats), which was not yet merged into the base when the Needle was built (see "The play log").

## The play log (v35)

`LOG_VERSION` 35, `LOG_REPLAYS` `[35]` (`src/v3/sim/playlog.ts`). The base branch was at v33 (the Armory overhaul, #190) when this started; the round 9 build (the signature threats, `MAP_SIGNATURE`, which the Needle's walls build on) was not merged yet, so it was merged into this branch first. Round 9 then merged into the base as v34 (#192), and the base was merged in again at the end: the Needle is v35. Its change is lab only, under the encounter layer: the campaign plays as it did, and a v34 Needle card log played the map with no encounters (it no longer replays). The bot reports and sweeps were made while the Needle's build was numbered 34 on this branch; the game they played is v35's. The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 35. The Test Lab's "Ready to test" lists the Needle at v35.

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
