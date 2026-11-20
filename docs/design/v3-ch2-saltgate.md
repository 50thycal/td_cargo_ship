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

Warning time falls from 8.3 s on wave 1 to 5.0 s on wave 10 (−0.28 s a wave, rule `g-warning`), and 4.8–5.0 s in the boss rounds. Wave 1's drones come the long way, over the West Sea from the west shore; from wave 3 the lock silos fire from 200 px, and the shortest warning on the map is a guided missile off the west lock's silo into the chamber below it. Before the rebuild the warning fell further, 9.0 to 3.8 s, because the shared waves' shells and heavies came at the queues from the far silos and the subs.

## The stretches

The bot report cuts the lane into thirds along it: the early third is the West Sea and the queue at lock A's entry gate (the ships wait at x 456, short of the chamber); the middle is lock A's chamber and the Bitter Lake; the late third is lock B and the East Sea.

- **Danger: the middle**, lock A's chamber and the lake: 45% of the hull damage in waves 1–9 (the player's Armory; 41% with the latest Armory, 45% with none). The guided missiles and clusters off the west lock's silo land there, on the ships waiting in the chamber, and the swarms aimed halfway along cross it.
- **Safe: the West Sea**, the early third: 23% of the hull damage (passes, under the 25% line; 24% with the latest Armory; 26% with none, over it). The encounters' swarms from the west shore go at any ship, not the ships coming in, and only wave 9's periscope aims there. It is safe by damage, not by sinkings: 40% of the ships sunk in waves 1–9 sink there (59% over every wave), because the signature's torpedo subs in the West Sea sink the ships queueing for lock A outright.
- `MAP_PLANS.saltgate.stretches` says danger middle, safe early (the map as it was: hot early 55%, cold late 20%: the shared waves' fire found the queue at lock A first).
- The danger stretch is the carrier's own third (the carrier anchors in the lake at x 880; lock A's chamber is 220–380 px west of it, rule `m-carrier` asks for the danger stretch not to be the closest). The reach is short; the warning is what is missing: the silo over the lock is 200 px from the chamber.

## The convoy

The map's own convoy, no command (rule `m-convoy`): pairs at the campaign's own schedule (`MAP_CONVOY.saltgate`: flow 1, pairs, as Sowers' Reach; the other chapter 2 maps sail flow 2). The locks do the shaping (rule `m-shape-convoy`): each chamber takes what it holds, shuts and fills, so the ships sail in short bursts and wait, bunched and still, at each gate. At flow 2 more ships stood queued at the gates at once: on the same early build of the encounters the bot lost about as many ships in waves 1–10 (5.0 against 4.9) but far more in the boss rounds (2.0 / 1.9 / 2.3 against 0.8 / 1.0 / 2.3 a round) and won 6% of 48 runs against 31%: the canal sets the pace, so the schedule is the campaign's. No command: the gates hold the ships already. The map card now opens on policy D with the encounters on (it opened on today's convoy controls and no encounters).

## The signature: a strike on the locks

The player's round 9 (r9-map-signature): each map gets a threat of its own in waves 4–10, tied to its identity and its boss. Saltgate's boss is Run the Canal, chapter 2's finale: Torpedo Subs as the convoy comes in, a gunship over the far bank by a lock, then a block of armored drones. Three of its four enemies are already other maps' signatures (the Island's helicopters, the Needle's armored walls; the Archipelago's scavengers); the Torpedo Sub is the one left, and the canal's own. Its signature (`MAP_SIGNATURE.saltgate`, from wave 4) is a strike on the locks, in two parts:

- **Torpedo Subs** for half the wave's new enemies (rounded up: one on waves 4–9, two on wave 10), the wave planner's rule (each stands in for a drone swarm and a missile, so the wave sends no more, rule `w-budget`). Each comes up in the West or East Sea, under water and out of reach, and fires its two slow torpedoes one by one at the ships it can reach over water: the queue for lock A and the ships leaving lock B. Only the torpedoes can be shot. All the new enemies as subs was too many: a torpedo sinks a cargo ship (3 damage, 3 hull), and with every new enemy a sub the bot lost 0.75–0.94 ships a wave to them on waves 6–10 and won 0–2%.
- **The wave's own cluster missiles** go for the ship held at the lock nearest their launcher (aim `'lock'`), off a silo or a truck: they split over a full chamber. The encounters' clusters do the same, and so do the boss rounds'.

How much of waves 4–10 it is (`tools/v3/combo-sweep/mixwaves.ts`, 4 seeds, the "you" bot drafting for itself, tough; subs with their torpedoes, clusters with their bomblets):

| | Waves 4–10 | Waves 6–10 | Boss rounds |
| --- | --- | --- | --- |
| Share of the threats that show | 24% | 26% | 38% |
| Share of the hits it takes to clear them | **23%** | 23% | 27% |

About a fifth to a quarter by hits (the Island's helicopters 22%, the Behemoth's jets and heavies 20%, the Needle's walls about a quarter, the Archipelago's motherships 25%, by the same tool). The torpedo subs alone are 10% by hits, and that counts a sub's 3 hit points though nothing can hit it.

## The counters

- **Counter kit: Point Defense, Gunship Pair, Supply Run.** The fire comes point-blank off the lock silos and from the seas at ships that cannot move: each ship's own Point Defense needs no warning and no reach; the Gunship Pair's rockets go for the thickest bunch of ships, a full chamber; Supply Run keeps the rack full through the long waits at the gates.
- **Off-counter kit: Seeker Pod, Shield, Full Steam.** The Seeker's long flight is too late for a silo 200 px from its target; the Shield breaks after its 1–3 hits, and a cluster over a full chamber spends them at once; Full Steam hurries the ships only between the gates (they spend most of the crossing waiting at them).
- Every weapon is in chapter 2's draft.

How they compare (the player's Armory):

| | Ships lost, all 13 waves | Won |
| --- | --- | --- |
| Counter kit, forced (combo sweep's `check-one.ts`, 16 seeds) | **6.6** ±0.6 | 75% |
| Off-counter kit, forced (16 seeds) | 10.3 ±1.0 | 38% |
| The bot drafting for itself (combo sweep singles, 12 seeds) | see "Loadouts" | |
| Counter kit as the bot's taste (bot report, 24 seeds) | 3.2 in waves 1–10 (3.3 tough) | 63% |
| Off-counter kit as taste (bot report) | 3.7 in waves 1–10 (4.3 tough) | 58% |
| With the latest Armory, as taste: counter / off-counter | 4.5 / 5.3 in waves 1–10 | 25% / 4% |

Forced, the counter kit loses 3.7 ships fewer and wins twice as often. As the bot's taste the gap is smaller (63% against 58%; a ship fewer on the tough runs). Two kits tried first: Point Defense + Railgun + Scattergun against Thermobaric Shell + Tesla Arc + Full Steam read 7.7 against 8.6 forced but won 56% against 63%, so they were not used. Full Steam is in the map's best kit below (with Air Strike and the Gunship Pair): it is weak alone (9.1) and the off-counter kit as a whole is clearly worse, but it is not useless here.

## Loadouts on this map (combo sweep singles)

Each weapon alone, forced at every draft (12 seeds, the player's Armory, game version 38; `npm run v3:combo-sweep -- --stage=singles --maps=saltgate --out=tools/v3/combo-sweep/results/v38-ch2`). Ships lost over all 13 waves:

- **Strong:** **Point Defense 5.8**, Scattergun 6.0, Air Strike 6.3, Frigate Escort 6.8, Drone Screen 6.9.
- **Middling:** Thermobaric 7.5, Railgun 7.8, Gravity Well, Gunship Pair and Overdrive 8.3, Shrapnel 8.4, Shield 8.7, Full Steam 9.1, Boomerang 9.3, Tesla 9.5, Flak 9.6.
- **Weak:** Seeker Pod 10.6, Supply Run alone 11.6, the Charge Lance (the bot charges it poorly) and the Laser Cutter (the bot can't swipe).
- Singles are 12 seeds (a standard error of about a ship): Point Defense, the Scattergun and Air Strike are a tie at the top. On an earlier build of these encounters (before the swarms stopped aiming at the ships coming in, and before the boss's third sub) the order was Point Defense 5.8, then the Railgun and Scattergun 6.5, Air Strike 6.8.

## Diversity: are Saltgate's best kits its own?

The player's rule for this rebuild: Saltgate's best kits and its best weapon alone must differ from the other four chapter 2 maps', and Air Strike, already the best single on three of them, should not become a fourth's. Saltgate was swept at version 38 the same way the others were at 37: singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16 (`tools/v3/combo-sweep/diversity.ts`, results in `tools/v3/combo-sweep/results/v38-ch2/`; docs/design/v3-combo-diversity.md, "Saltgate Canal"). The other four maps play the same game at 38 as at 37 (this build changes nothing of theirs), so they are compared from their version 37 sweep (`results/v37-ch2/`).

| Map | #1 | #2 | #3 | #4 | #5 |
| --- | --- | --- | --- | --- | --- |
| The Island (v37) | **Air Strike + Thermobaric Shell + Point Defense** 6.6 | Air Strike + Point Defense + Gunship Pair 7.8 | Flak Cannon + Drone Screen + Gunship Pair 8.4 | Air Strike + Point Defense + Drone Screen 8.4 | Railgun + Tesla Arc + Overdrive 8.6 |
| The Behemoth Run (v37) | **Air Strike + Drone Screen + Supply Run** 4.0 | Air Strike + Drone Screen + Full Steam 4.7 | Frigate Escort + Gravity Well + Shield 5.2 | Air Strike + Gravity Well + Drone Screen 5.6 | Thermobaric Shell + Flak Cannon + Full Steam 5.9 |
| The Needle of Bosk (v37) | **Scattergun + Railgun + Supply Run** 5.3 | Shrapnel Shell + Gravity Well + Gunship Pair 6.2 | Shrapnel Shell + Railgun + Supply Run 6.9 | Shrapnel Shell + Flak Cannon + Gunship Pair 7.3 | Gravity Well + Railgun + Supply Run 7.3 |
| The Archipelago (v37) | **Air Strike + Shrapnel Shell + Gravity Well** 3.2 | Air Strike + Frigate Escort + Gunship Pair 3.6 | Air Strike + Shrapnel Shell + Overdrive 3.8 | Air Strike + Overdrive + Full Steam 3.8 | Air Strike + Frigate Escort + Seeker Pod 3.9 |
| **Saltgate Canal (v38)** | **Air Strike + Gunship Pair + Full Steam** 5.6 ±0.7, won 81% | Air Strike + Thermobaric Shell + Point Defense 6.0 | Frigate Escort + Point Defense + Supply Run 6.3 | Air Strike + Flak Cannon + Point Defense 7.1 | Air Strike + Frigate Escort + Thermobaric Shell 7.3 |

| Measure | Result |
| --- | --- |
| Jaccard of the top-5 kits, Saltgate against the Island / the Behemoth Run / the Needle / the Archipelago | **0.11** (one kit shared: Air Strike + Thermobaric Shell + Point Defense, the Island's #1 and Saltgate's #2) / **0** / **0** / **0** |
| The same, Saltgate against itself (two halves of its seeds) | 0.67 |
| #1 kit | its own (no other map's top 5 has it) |
| Best weapon alone | **Point Defense** 5.8 (Scattergun 6.0, Air Strike 6.3 next); the Island, the Behemoth Run and the Archipelago: Air Strike; the Needle: the Gunship Pair |
| Rank correlation of the weapons alone, Saltgate against the Island / the Behemoth Run / the Needle / the Archipelago | 0.70 / 0.84 / 0.35 / 0.60 |

- **Saltgate's kits are its own, but for one:** its #1 kit is no other map's, and four of its five are its own. Its #2 is the Island's #1 (Air Strike + Thermobaric Shell + Point Defense): both maps have silos point-blank over the ships, and Point Defense answers both. Against the noise (0.67 for Saltgate against itself) one shared kit of five is small; the Needle had the same overlap with the Island (0.11) when it was built.
- **Its best weapon alone is not Air Strike:** Point Defense, by half a ship over the Scattergun and a ship over Air Strike, which is a tie on 12 seeds. Air Strike is in four of the five best kits, as on the Archipelago and the Behemoth Run.
- **The weapons alone rank much as on the Behemoth Run** (0.84): both maps hold their ships still or slow under fire, and the same aimed and point-blank weapons lead.

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

Wave 1 loses no ship (all three reports).

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

"Before" is the map card as it was: today's convoy controls, no encounters, the event as it was, at game version 37 (`tools/v3/map-report/results/saltgate-before*.md`). "After" is this build (log v38). Commands: `npx vite-node tools/v3/map-report/report.ts -- --map=saltgate --seeds=24 --kits=plan [--armory=player | --armory=latest] [--no-fun]`.

### The player's Armory (Quick Reload 5, Damage Control 4, Stockpile 5)

| | Before | After |
| --- | --- | --- |
| Won (normal) | 42% | **58%** |
| Mean end wave | 11.3 | 13.0 |
| Ships lost in waves 1–10 (normal) | 4.9 | 3.3 |
| Ships lost in waves 1–5 (normal) | 0.58 | **0.50** |
| Boss r1 / r2 / r3 (normal, reached) | 0.36 / 0.18 / 0.36 (11 runs) | **0.85 / 1.50 / 1.56** (20, 20, 18) |
| Boss r1 / r2 / r3 (tough) | 1.25 / 0.79 / 1.17 | 0.96 / 1.46 / 2.04 |
| Tough curve 1–10 | 0 0 .54 0 .04 .71 .54 .96 1.21 1.50 | 0 0 .17 .21 .13 .50 .33 .54 .63 1.08 |
| `w-cliff` | **FLAG** (w3 0 → 0.54, w6 0.04 → 0.71) | PASS (biggest step w10 +0.46) |
| `w-early` close calls from w3 | PASS (fewest w4 3.83) | PASS (fewest w3 1.29, 75% of runs) |
| `w-budget` | PASS | PASS (furthest w3 ×0.91) |
| `m-stretches` | PASS (hot early 55%, cold late 20%) | PASS: hot middle 45%, cold early 23% |
| `g-warning` | PASS: 9.0 → 3.8 s | PASS: 8.3 → 5.0 s |
| `w-first` | PASS | PASS |

The record report is 24 seeds; the tuning reads on 96 (900–995, `quick.ts`): won **55%** (56% and 54% on the two halves), ships lost in waves 1–10 3.4, in waves 1–5 **0.53**, boss rounds **0.95 / 1.54 / 1.78** (normal, reached). The sim is chaotic: moving one swarm's aim moved later waves and the boss by up to ±0.4 of a ship on the same seeds.

### The player's latest Armory (Wide Warhead 5, Point Defense 4, Supply Lines 3)

| | Before | After |
| --- | --- | --- |
| Won (normal) | 0% | **25%** |
| Ships lost in waves 1–10 / 1–5 (normal) | 6.4 / 1.38 | 5.3 / 1.13 |
| Boss r1 / r2 / r3 (normal, reached) | 4.00 / 1.00 / 1.00 (1 run) | 1.00 / 2.00 / 1.80 (10 runs) |
| Boss r1 / r2 / r3 (tough) | 0.79 / 0.67 / 0.92 | 0.96 / 2.79 / 3.50 |
| Tough curve 1–10 | 0 0 .50 .13 .79 1.17 2.71 4.33 8.83 8.79 (27.3) | 0 0 .08 .38 .67 .67 .67 2.13 1.58 1.54 (7.7) |
| Checks | `w-cliff` **FLAG** (w5, w7, w9) | `w-cliff` **FLAG** (w7 0.67 → w8 2.13); the rest PASS |
| Kits (won; lost 1–10) | | counter 25%, 4.5; off-counter 4%, 5.3 |

### Baseline (no Armory)

| | Before | After |
| --- | --- | --- |
| Won (normal) | 0% | 0% |
| Ships lost in waves 1–10 / 1–5 (normal) | 5.7 / 2.71 | 5.9 / 1.38 |
| Boss r1 / r2 / r3 (tough) | 1.58 / 1.71 / 1.58 | 1.42 / 5.13 / 5.75 |
| Tough curve 1–10 | 0 .08 .63 .33 2.25 4.29 3.88 10.96 12.21 16.17 (50.8) | 0 0 .08 .50 .79 .96 1.79 1.92 2.63 3.21 (11.9) |
| `w-cliff` | **FLAG** (w3, w5, w8) | PASS |
| `m-stretches` | PASS (hot early 57%, cold late 16%) | **FLAG** (hot middle 45%, cold early 26%) |

As on the other maps, the baseline stands in for a player with no upgrades and is far harder; the encounters are lab only. Without an Armory the map as it was collapsed from wave 5 (50.8 ships lost on the tough runs over waves 1–10, against 11.9 now): its shells and heavies landed on ships held still at the locks.

### Chapter 2 difficulty (rule `m-difficulty`)

With the player's Armory the bot wins 58% on the record's 24 seeds and 55% on 96, inside the 50–70% asked; waves 1–5 lose 0.50–0.53 (in the 0.4–0.8 band), waves 1–10 3.3–3.4 (the lowest of chapter 2: the Archipelago 3.9–4.3), and the boss rounds read 0.85–0.95 / 1.50–1.54 / 1.56–1.78 (normal, reached) and 0.96 / 1.46 / 2.04 on the tough runs: rising, the chapter's toughest third round, under the asked 1.5 / 2 / 2.5 in rounds 1 and 3. With the latest Armory the bot wins 25% (0% before).

## Fun measures (provisional, `src/v3/sim/funMetrics.ts`)

From `saltgate-player.md`:
- **Tension climbs slowly:** its peak is 0.19, 0.36, 0.39, 0.53, 0.51 on waves 1–5, 0.57–0.79 on waves 6–10, flat in most runs before wave 6 (one peak in half the runs from wave 6). Boss rounds 1.23 / 1.23 / 1.41, one peak in most runs: the boss is where the map gets tense.
- **Close calls** from wave 2: 1.3–5.2 a run on every wave 3–10; wave 3 is the lowest (1.3, 75% of runs).
- **Saves:** 0–0.3 a run on waves 1–10, 0.3 / 0.4 / 0.8 in the boss rounds (the fun check flags it, as on every chapter 2 map).
- Waves 1–5 read flatter than the Archipelago's (its wave 5 peak 1.01).

## What is not satisfied, or uncertain

- **The latest Armory reads hard here:** the bot wins 25% (0% before), loses 1.13 ships in waves 1–5 and flags a cliff at wave 8 (two clusters over the locks and the wave's subs). It has no Damage Control, which may matter more on a map where ships sit under fire (not measured). The targets are set on the usual Armory.
- **One of the five best kits is the Island's #1** (Air Strike + Thermobaric Shell + Point Defense, Saltgate's #2). The other four and the #1 are Saltgate's own; the best single is not Air Strike (Point Defense), but Air Strike is in four of the five best kits and only a ship behind Point Defense alone.
- **The signature is two things.** The torpedo subs alone were 10% of waves 4–10 by hits (on an earlier build), and as every new enemy they were too deadly for the bot (a torpedo sinks a cargo ship). With the wave's clusters aimed at the locks it is 23%. If you'd rather a single-threat signature, the subs alone at a fifth of the hits would need a sub that fires more, slower torpedoes, or fewer of the wave's other launches.
- **The safe stretch is safe by damage, not by sinkings:** the West Sea takes 23% of the hull damage but 40% of the sinkings in waves 1–9: the torpedo subs there sink the ships queueing for lock A.
- **The danger stretch is the carrier's own third** (lock A's chamber and the lake), against rule `m-carrier`'s letter: the problem is warning, not reach.
- **The convoy sails the campaign's schedule (flow 1)**, not the other chapter 2 maps' flow 2: at flow 2 the queues at the gates made the boss much harder for the bot.
- **The boss is under the asked 1.5 / 2 / 2.5 in rounds 1 and 3 on normal runs** (0.95 / 1.54 / 1.78 on 96 seeds), and rounds can run a little over 30 s for a bot with no weapon (the tryhard bot, starting at the boss: 31–36 s on 3 of 16 seeds; 24–25 s on the test's seed). The subs are most of its teeth; their torpedoes are the thing to shoot.
- **Wave 7 aims nothing at a lock:** its jet flies down the canal's line of held ships, and its cluster was dropped to take out a cliff (0.29 → 0.88).
- **The map's threat scale is 0.9**, the lowest in chapter 2 (the Archipelago 1.1): the rebuild keeps it (it is the campaign's), so its waves send fewer launches than its neighbours; the locks make up the difference.
- **No player data** on Saltgate since the locks were fixed (the player's note "the gates for the canal did not work"). On chapter 1 the bot read boss rounds 1.4–2.5× as hard as the player did.

## The play log (v38)

`LOG_VERSION` 38, `LOG_REPLAYS` `[38]` (`src/v3/sim/playlog.ts`). The base branch was at v37 (the Archipelago, #197). Its change is lab only, under the encounter layer: the campaign plays as it did, and a v37 Saltgate card log played the map on today's convoy controls with no encounters (it no longer replays). The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 38. The Test Lab's "Ready to test" lists Saltgate Canal at v38. The other four chapter 2 maps play the same game at v38 as at v37 (every change here is keyed to Saltgate's data: the `'lock'` aim, the `clusters` signature, Run the Canal's rounds).

## Questions for the player

- **The signature is torpedo subs (half the new enemies) and the wave's clusters aimed at the locks. Keep both, or subs only?** Recommended: keep both; subs alone are a tenth of the hits and, as every new enemy, sank too many ships for the bot.
- **Air Strike + Thermobaric Shell + Point Defense is a best kit on both Saltgate (#2) and the Island (#1). Accept one shared kit of five?** Recommended: accept; the #1 kit and the best single are Saltgate's own, and the overlap is under the noise.
- **Saltgate's convoy sails the campaign's schedule (flow 1), the other chapter 2 maps' flow 2. Keep it?** Recommended: keep; the locks already bunch the ships, and at flow 2 the boss was much harder.
- **Boss rounds under the asked 1.5 / 2 / 2.5 in rounds 1 and 3 (0.95 / 1.54 / 1.78), with the bot winning 55%: keep, or raise them and accept fewer wins?** Recommended: keep, and judge from your play.

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

Watch the gates. The ships sail into a lock, the gate shuts behind them and they sit still while it fills (the gate light and the countdown say how long), right under a silo on the enemy bank. Wave 1 sends a few drones over the West Sea at the first ships waiting in the west lock; wave 2 a shell into the chamber; from wave 3 the silo over the west lock fires a missile straight down into it, with almost no warning. From wave 4 a periscope comes up in the sea at one end of the canal each wave (two on wave 10): the sub is out of reach, so shoot its two slow torpedoes before they reach the ships queueing at the gate. The wave's cluster missiles go for the ships in a chamber and split over them. The Bitter Lake by your carrier is quiet except when a missile or a swarm finds the chamber at its west end. In the boss rounds Run the Canal comes in its three phases, three subs as the round opens, a gunship over the far bank, then a block of armored drones, with clusters over the locks; the third round has two gunships, one over each lock. The question to answer: did the locks feel like the problem, ships you could not move sitting under fire, and was there time to answer a missile from the silo right over the chamber?

(This section names no weapon to try: the counter kit above is a design note for the bots, never shown in the game or on the hub.)
