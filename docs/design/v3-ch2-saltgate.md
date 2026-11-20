# Saltgate Canal: map card (map rebuild, chapter 2)

**Date:** 2026-11-20. Saltgate Canal (`saltgate`, chapter 2 "The Narrows", the 10th map and the chapter's last) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), after the Island, the Behemoth Run, the Needle of Bosk and the Archipelago (`docs/design/v3-ch2-island.md`, `v3-ch2-behemoth.md`, `v3-ch2-needle.md`, `v3-ch2-archipelago.md`). Encounter rev 4; play log v38.

Code:
- `src/v3/data/encounters.ts`: `SALTGATE_R4` (ten encounters), a new aim `'lock'`, `SALTGATE_BOSS_ROUNDS` and `MAP_BOSS.saltgate`, `MAP_SIGNATURE.saltgate` (its new `clusters`), `REBUILT_MAPS` (via `CHAPTER_TWO_MAPS`), in the chapter 2 block; a boss round's `subs`;
- `src/v3/data/mapPlans.ts`: `MAP_PLANS.saltgate`;
- `src/v3/data/convoy.ts`: `MAP_CONVOY.saltgate` (the map's own convoy at the campaign's own schedule, no command);
- `src/v3/sim/game.ts`: `aimBeat` reads `'lock'` (`atLock`: a ship in a lock's chamber or queued within 120 px of its entry gate); the signature's `clusters` aim the wave's own cluster missiles, off a silo (the wave planner) or a truck (`updateRaider`);
- `src/v3/sim/events.ts`: Run the Canal reads its rounds from `MAP_BOSS` (`canalRound`: subs, helicopters and their hits, the block, the swarms) and adds a round's own launches (`fire`, as the other chapter 2 bosses do); with no boss tuning it plays as it did;
- `src/v3/data/lab.ts`: "Ready to test" lists Saltgate Canal at v38;
- `tools/v3/combo-sweep/mix.ts`, `mixwaves.ts`: Saltgate among the maps, its signature the torpedo subs with their torpedoes and the clusters with their bomblets.

Bot reports: `tools/v3/map-report/results/saltgate.md` (no Armory), `saltgate-player.md` (the player's usual Armory, with fun measures and the heat map) and `saltgate-latest.md` (the player's latest Armory: Wide Warhead 5, Point Defense 4, Supply Lines 3); the map as it was: `saltgate-before*.md`. Tuning reads: the bot as `tools/v3/map-report/quick.ts` plays it, on 48 seeds at a time (900–947 and 948–995).

## The problem

> Two locks stop the convoy: every ship waits still in a chamber while it fills, right under the silos over the locks, so the enemy fires at ships that cannot move, with banks close on both sides and little warning.

Saltgate is the chapter's one map with a mechanic (rule `m-mechanic`): the locks. The canal runs west to east from the West Sea through lock A (the chamber from x 500 to 660), across the Bitter Lake where the carrier anchors (880, 662), through lock B (1140 to 1300) and out into the East Sea. A lock takes what its chamber holds, shuts its entry gate, fills for 6 s and opens its exit; the ships behind wait at the shut gate (`docs/design/v3-saltgate-locks.md`; a full cycle is about 19 s). A ship spends most of its crossing still: in a chamber, or queued at a gate. The silos over each lock stand 200 px from the chamber, on the enemy bank, and your own bank closes in 70 px south of the lane along both locks.

How it differs from the other chapter 2 maps:
- **The Island:** a fortified island beside two lanes; the ships keep moving past it. Here the ships stop, at two set places, on a timer you can read from the gate lights.
- **The Behemoth Run:** one slow ship to escort. Here every ship is slow at the same two places, and none matters more than another.
- **The Needle of Bosk:** a queue at one mouth, nose to tail, because the water narrows. Here the ships stop because a gate is shut, twice, and the danger is the time they sit there (and the silos built over it), not the shape of the water.
- **The Archipelago:** fire from many islets and directions at a lane that keeps moving. Here the fire is mostly from two places, the silos over the locks, at ships that cannot move, with the shortest warning in the chapter.

The mechanic is in the waves (rule `g-mechanic`): nine encounters of ten aim something at a ship held at a lock (`'lock'`; wave 7's jet flies down the canal's line of held ships instead), and so do the signature's clusters and every boss round's added fire.

## Sites and their jobs

Bases and spots are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| West shore (base 1) | Enemy shore (220, 150) | drones, shells | The long reach over the West Sea: the first drones at the west lock (w1), the shell into the chamber (w2), swarms at the ships coming in (w3–10). |
| West lock silo (base 2) | Over lock A (580, 240) | guided, clusters | Point-blank at the west lock: the guided missile (w3, w5, w9), the cluster over the chamber (w4, w7, w8, w10, every boss round). |
| Lake silo (base 3) | North of the Bitter Lake (900, 150) | heavies, supersonic | The shared waves' own (the encounters take the heavy out of waves 5, 6, 8, 9 and 10). |
| East lock silo (base 4) | Over lock B (1220, 240) | drones, clusters | Swarms all map (w2–10), the cluster over the east chamber (w8, w10). |
| East shore (base 5) | Enemy shore (1460, 150) | shells, guided | The guided missile at the east lock in boss rounds 1 and 2; the shared waves' own. |
| West Sea (spot 1) | (200, 610) | sub salvos, torpedo subs | The signature's torpedo subs, at the ships queueing for lock A; shells at the ships coming in (w9). |
| East Sea (spot 2) | (1480, 610) | sub salvos, torpedo subs | The signature's torpedo subs, at the ships leaving lock B; shells into lock B (w6). |
| Coast road, pop-up roads, air line | The enemy shore; caves by each lock's exit (690 and 1330, down to the bank); y 610 | trucks, strafers, bombers | The shared waves' own; the jet down the canal from the west (w7); a truck's clusters go for the locks too (the signature). |

WARNING_LINE

## The stretches

STRETCH_LINES

## The convoy

The map's own convoy, no command (rule `m-convoy`): pairs at the campaign's own schedule (`MAP_CONVOY.saltgate`: flow 1, pairs, as Sowers' Reach; the other chapter 2 maps sail flow 2). The locks do the shaping (rule `m-shape-convoy`): each chamber takes what it holds, shuts and fills, so the ships sail in short bursts and wait, bunched and still, at each gate. At flow 2 more ships stood queued at the gates at once: on the same early build of the encounters the bot lost about as many ships in waves 1–10 (5.0 against 4.9) but far more in the boss rounds (2.0 / 1.9 / 2.3 against 0.8 / 1.0 / 2.3 a round) and won 6% of 48 runs against 31%: the canal sets the pace, so the schedule is the campaign's. No command: the gates hold the ships already. The map card now opens on policy D with the encounters on (it opened on today's convoy controls and no encounters).

## The signature: a strike on the locks

The player's round 9 (r9-map-signature): each map gets a threat of its own in waves 4–10, tied to its identity and its boss. Saltgate's boss is Run the Canal, chapter 2's finale: Torpedo Subs as the convoy comes in, a gunship over the far bank by a lock, then a block of armored drones. Three of its four enemies are already other maps' signatures (the Island's helicopters, the Needle's armored walls; the Archipelago's scavengers); the Torpedo Sub is the one left, and the canal's own. Its signature (`MAP_SIGNATURE.saltgate`, from wave 4) is a strike on the locks, in two parts:

- **Torpedo Subs** for half the wave's new enemies (rounded up: one on waves 4–9, two on wave 10), the wave planner's rule (each stands in for a drone swarm and a missile, so the wave sends no more, rule `w-budget`). Each comes up in the West or East Sea, under water and out of reach, and fires its two slow torpedoes one by one at the ships it can reach over water: the queue for lock A and the ships leaving lock B. Only the torpedoes can be shot. All the new enemies as subs was too many: a torpedo sinks a cargo ship (3 damage, 3 hull), and with every new enemy a sub the bot lost 0.75–0.94 ships a wave to them on waves 6–10 and won 0–2%.
- **The wave's own cluster missiles** go for the ship held at the lock nearest their launcher (aim `'lock'`), off a silo or a truck: they split over a full chamber. The encounters' clusters do the same, and so do the boss rounds'.

How much of waves 4–10 it is (`tools/v3/combo-sweep/mixwaves.ts`, 4 seeds, the "you" bot drafting for itself, tough; subs with their torpedoes, clusters with their bomblets):

MIX_TABLE

About a fifth to a quarter by hits (the Island's helicopters 22%, the Behemoth's jets and heavies 20%, the Needle's walls about a quarter, the Archipelago's motherships 25%, by the same tool). The torpedo subs alone are 10% by hits, and that counts a sub's 3 hit points though nothing can hit it.

## The counters

COUNTERS

## Loadouts on this map (combo sweep singles)

SINGLES

## Diversity: are Saltgate's best kits its own?

DIVERSITY

## The debut

None of its own. Saltgate's slot is the Torpedo Sub (`mapDebut`): the planner draws one on waves 2 and 3 here, as before, but every chapter 2 enemy already comes in on the Island, one a wave from wave 2 with a light debut wave each (see the Island's card), so no "NEW · The Narrows" banner is due here (the Needle's and the Archipelago's cards say the same). Nothing from a later chapter: the encounters send only drones, shells, guided missiles, clusters and a strafer, all in the map's table by their waves (`tests/v3/encounters.test.ts`).

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated. Every shell the shared wave would send from wave 2 on comes out of the wave (a sub fills a salvo of 4 whatever it is given, and shells land where they are aimed on a ship that cannot move), so its submarines carry drones instead; the encounters put back a shell or two where the map wants them. From wave 5 they also take out the wave's heavy (4 damage: it sinks a cargo ship) and some of its clusters, and send drones in their place. The wave keeps its launches (×0.91–1.04 of the shared wave, planned on 8 seeds; rule `w-budget`). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | At the first lock (`saltgate-first-lock`) | west shore, 3 drones | the ship held at the west lock |
| 2 | teach | Shells into the chamber (`saltgate-chamber`) | west shore, 1 shell; east lock silo, 4 drones | the west lock; any ship; in place of the wave's 2 shells |
| 3 | teach | Both locks (`saltgate-both-locks`) | west lock silo, 1 guided; east lock silo 4 and west shore 4 drones | the ship in the west lock, point-blank; any ship; in place of the shells and the guided missile |
| 4 | combine | A cluster over the chamber (`saltgate-cluster`) | west lock silo, 1 cluster; west shore 4 and east lock silo 4 drones | the west lock; any ship; in place of the shells and the cluster (the first torpedo sub comes with the wave) |
| 5 | combine | Two gates (`saltgate-two-gates`) | west lock silo, 1 guided; east lock silo 5 and west shore 5 + 5 drones | the west lock; any ship; in place of the shells, guided missiles, the heavy and a cluster |
| 6 | combine | A periscope off the gate (`saltgate-periscope`) | East Sea sub, 3 shells; west shore 5 + 3 and east lock silo 5 drones | the east lock; any ship; in place of the shells, guided missiles and the heavy |
| 7 | escalate | Down the canal (`saltgate-strafe`) | a jet from the west; east lock silo 5 + 5 and west shore 5 drones | the canal, every held ship in a line; any ship; in place of the shells, a cluster and a jet |
| 8 | escalate | Both chambers (`saltgate-both-chambers`) | a cluster off each lock silo, 6 s apart; west shore 5 + 4 + 3 and east lock silo 4 drones | both locks; halfway along; any ship; in place of the shells, both clusters, the heavy and a jet |
| 9 | escalate | Gate by gate (`saltgate-gate-by-gate`) | west lock silo, 1 guided; West Sea sub, 3 shells; east lock silo 4 + 5 + 5 and west shore 5 drones | the west lock; the ships coming in; halfway along; in place of the shells, guided missiles, a cluster and the heavy |
| 10 | climax | Through both locks (`saltgate-climax`), the clusters after the wave's own fire (`at: 1`) | a cluster off each lock silo, 4 s apart; five swarms of 4 all wave | both locks; halfway along; any ship; in place of the shells, most guided missiles, the heavy, the clusters, a supersonic and a jet |

WAVE1_LINE

## The boss plan: Run the Canal, rising

Run the Canal is the map's own event and chapter 2's finale, in three phases one after another (round 8, cut down): Torpedo Subs as the round opens (three torpedoes each, one by one), an attack helicopter over the far bank by a lock from 9 s, a block of armored drones from the enemy shore from 19 s banking together twice, and a drone swarm. Under encounter rev 4 (`SALTGATE_BOSS_ROUNDS`, lab only: the campaign plays the event as it was):

| Round | Torpedo subs | Helicopters (hits) | Armored drones (wide) | Drone swarms | Clusters (lock silos) | Guided (east shore) |
| --- | --- | --- | --- | --- | --- | --- |
| before (every round) | 2 | 1 (4) | 4 (2) | 1 of 5 | 0 | 0 |
| 1 | 3 | 1 (4) | 4 (2) | 2 of 5 | 1, west (6 s) | 1 (9 s) |
| 2 | 3 | 1 (5) | 6 (3) | 3 of 5 | 1, west (5 s) | 1 (8 s) |
| 3 | 3 | 2 (5), one over each lock, 6 s apart | 6 (3) | 3 of 5 | 2, west (4 s) and east (12 s) | 0 |

The clusters and the guided missiles go at the ship held at the lock nearest their silo (aim `'lock'`). `MAP_PLANS.saltgate.boss.botTarget` is 2 (the brief: about 1.5 / 2 / 2.5 on the bot's scale; as the chapter's last map it may be the chapter's toughest). Each round lasts 15–30 s (test, seed 208: 24, 24 and 25 s). The intro cards are the shared ones (log v30), after the convoy is restored: "Boss round", "Convoy restored" (and the ships that can still be lost), "The boss: Run the Canal", "Round 1 of 3", then "Round 2 of 3" and "Round 3 of 3".

The subs are most of the boss's teeth: with the event as it was, its two subs alone sank 1.2–1.8 ships a round on the bot's tough runs (the player's Armory, 12 seeds), the rest of the round 0.2–0.5. A guided missile in round 3 off the silo over the west lock (200 px, almost no warning) sank 0.8 a round by itself on an early build and was cut; a third sub in round 1 (the event's own two before) lifted it from about 0.6 to 0.95 a round on 96 seeds.

## Bot results, before and after (24 seeds, 900–923)

RESULTS

## Fun measures (provisional, `src/v3/sim/funMetrics.ts`)

FUN

## What is not satisfied, or uncertain

UNCERTAIN

## The play log (v38)

`LOG_VERSION` 38, `LOG_REPLAYS` `[38]` (`src/v3/sim/playlog.ts`). The base branch was at v37 (the Archipelago, #197). Its change is lab only, under the encounter layer: the campaign plays as it did, and a v37 Saltgate card log played the map on today's convoy controls with no encounters (it no longer replays). The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 38. The Test Lab's "Ready to test" lists Saltgate Canal at v38. The other four chapter 2 maps play the same game at v38 as at v37 (every change here is keyed to Saltgate's data: the `'lock'` aim, the `clusters` signature, Run the Canal's rounds).

## Questions for the player

QUESTIONS

## Tests

- `tests/v3/encounters.test.ts`:
  - the ten listed, rev 4, v1 only, none at rev 3 (the map with no authored encounters is now Battery Point, chapter 3);
  - the budget, legality, warning and replay checks cover the map;
  - the `'lock'` aim: the west lock silo's missile goes for a ship held at the west lock, the nearest to the silo; with no ship held, the ship nearest the launcher; every wave but wave 7 aims at a lock; no other map uses the aim;
  - Run the Canal's rounds: the subs, helicopters, armored drones, swarms, clusters and guided missiles each round as `MAP_BOSS` says, rising, every added launch from a base that fires it, at a lock; a rev 3 log and the campaign play the event as it was; 15–30 s a round;
  - the signature: from wave 4 at least half the wave's new enemies are torpedo subs and its own clusters off a silo are aimed at the locks; played, every cluster of the wave's own (silo or truck) goes for a held ship; within the wave budget; waves 1–3, the campaign and the shared wave as they were; the other signatures leave the clusters alone.
- `tests/v3/mapRules.test.ts`: no repeats and no gaps; `MAP_PLANS` complete; the boss target is 2.
- `tests/v3/mapCards.test.ts`, `round11.test.ts`, `convoy.test.ts`: the production setup is policy D with the encounters, no command, at the campaign's schedule; Battery Point is now the next map with neither.
- `tests/v3/saltgateLocks.test.ts`, `convoyFlow.test.ts`, `maps20.test.ts` (unchanged): the locks never jam at any flow, and the frigates never pass a gate.
- `e2e/v3-map-cards.mjs`: the hub card says so; `?lab=map-saltgate` opens the full map with encounters rev 4 and no command. `e2e/v3-encounters.mjs`: the map with no authored encounters is now Battery Point.

## What to look for when you play

LOOK
