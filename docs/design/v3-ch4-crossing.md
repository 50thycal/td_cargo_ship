# Dunmar Crossing: map card (map rebuild, chapter 4)

**Date:** 2026-11-22. Dunmar Crossing (`crossing`, chapter 4 "Open War", the 18th map and the chapter's third) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), the way the Coves (`docs/design/v3-ch4-coves.md`, #222) and the Delta (`docs/design/v3-ch4-delta.md`, #223) were. Encounter rev 4; play log **v58**.

There is no player run of the Crossing to start from. The starting point is the map as it was (the Test Lab card: today's convoy controls, the shared waves, Beacon Strike as its boss) and what the player asked of every rebuild: a question of its own and kits of its own, busier early waves ("more drones and easy things to kill", "less is more"), the climb from wave 4 to 9, no single-wave cliff, wave 10 the climax and not a wall, big and distinct boss set pieces, readable on an iPhone in landscape (874×402), anything that can sink a ship warned.

As it was (192 seeds, the usual Armory, the card's own setup): won 74%, waves 1–3 nearly empty (0.01 0.02 0.05 ships), a climb to a wave 10 of 0.96 (tough: wave 9 doubled wave 8), and a boss that did nothing (0.01 / 0.02 / 0.00 ships a round). Its mechanic, two convoys sailing opposite ways, was in the map's shape only: nothing in the waves used it.

Code:
- `src/v3/data/encounters.ts`: `CROSSING_R4` (ten encounters), the filler for waves 1–6 (`BUSY`), `CROSSING_CLIMB`, `SPOTTER` and `BeaconCall` (a spotter beacon's hits and calls), Beat `lane` (aimed at one lane's ships only) and `beacon` (a spotter beacon, rising `{ water: 'cross' }`), the aim `'cross'` (`BeatAim`: the next two ships to pass each other), `MAP_SIGNATURE.crossing` (`foe: 'lure'`, `foeShare: 0.5`, `beacons`), `CROSSING_BOSS_ROUNDS` and `MAP_BOSS.crossing` (a boss round's `line`; the boss's name, Beacon Line), `CHAPTER_FOUR_MAPS` (the Crossing joins the Coves and the Delta), the script's words for a spotter beacon, the crossing and a lane;
- `src/v3/sim/foes.ts`: `crossingPair` (the next outbound and inbound ships to pass each other, and where they meet), `crossingSpot` (where a spotter rises: the water half way between the lanes at the crossing, clear of the carrier and the frigate), `spotterLife`, `spotterCalls` (a spotter marks the ship nearest it `charge` s before each call; at the call a shell is lobbed at that ship from the shell silo nearest it; its calls spent, it sinks back); a Lure Beacon launched as a spotter rises at the crossing with `SPOTTER.hp` hits; `foeEta` reads a spotter as urgent as its next call (the bots see it);
- `src/v3/sim/game.ts`: Launch `beacon`, `called`, `inLane`; Threat `called`; `aimBeat` takes `'cross'` and a lane; the wave planner takes each signature spotter's shells out of the wave's own (one for one: shells, else guided missiles, else drones); `planEncounters` raises a beat's spotter at the crossing (its rising is its warning);
- `src/v3/sim/events.ts`: Beacon Strike under the Crossing's boss tuning is the Beacon Line (`beaconLine`: lines of spotters spread down the water between the lanes, all on one count); `beaconMark` reads a spotter in any wave; the old event's caller leaves spotters alone; with no boss tuning Beacon Strike plays as it did;
- `src/v3/ui/events.ts`: a spotter's mark (the dashed line to its ship and the closing bracket) is drawn in any wave, not only in Beacon Strike;
- `src/v3/data/convoy.ts`: `MAP_CONVOY.crossing` (flow step 3, the Spread, no command); `src/v3/data/mapPlans.ts`: `MAP_PLANS.crossing`; `src/v3/data/lab.ts`: "Ready to test" lists the Crossing at v58; `src/v3/sim/playlog.ts`: `LOG_VERSION` 58;
- tools: `tools/v3/crossing/` (`readall.sh`, `final.sh`, `reports.sh` as the Coves'; `probe.ts`: what the spotters do, wave by wave; `wave1.ts`: wave 1 alone on many seeds, as the wave-1 test plays it; `compare.py`: the diversity check against every rebuilt map); `tools/v3/combo-sweep/mixwaves.ts` counts the Crossing's signature (`spotter`, `called`).

Bot reports: `tools/v3/map-report/results/crossing-player.md` (the usual Armory: Quick Reload 5, Damage Control 4, Stockpile 5), `crossing-latest.md` (Wide Warhead 5, Point Defense 4, Supply Lines 3), `crossing-plating.md` (Quick Reload 5, Armor Plating 5, Big Magazine 4), `crossing.md` (no Armory); each with a heat map and the counter and off-counter kits; the map as it was: `crossing-before*.md` (read on a copy of the base build). Tuning reads: `tools/v3/crossing/final.sh <dir>` (192 seeds, 900–1091, the record reports' bot).

## How it is gated (lab vs campaign)

As every rebuild: **lab only, under the encounter layer.** The Test Lab's map card (`?lab=map-crossing`) opens on its production setup, policy D with no command, the map's own convoy and the authored encounters rev 4, because the Crossing is in `REBUILT_MAPS` (via `CHAPTER_FOUR_MAPS`). The hub card reads "The map's own convoy (no commands) · encounters v1 Original". Everything new reads the run's encounter setup (`signatureOf`, `bossTune`, a beat's own lane and aim), so the campaign, a run with no layer, a rev 3 log and the shared wave (`only: []`) play the Crossing exactly as before: the shared waves, the planner's own plain Lure Beacons and Beacon Strike. The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version.

## The problem

> Two convoys pass each other in the middle of the strait, outbound east under the north shore and inbound west under the south shore, each coming in at the other's exit; from wave 4 spotter beacons rise in the water between the lanes where the next two ships cross and call shells on both, and only your own shots sink them.

The map's shape is its mechanic (rule `m-mechanic`; `data/maps20.ts`): two lanes 274 px apart, the north one (y 318) sailed west to east, the south one (y 592) east to west, so each convoy comes in where the other leaves and every edge of the screen is a front; the enemy holds the whole north shore and the middle of the south shore (x 370–1230), your home ports the two south corners; the carrier sits in the water between the lanes, in the middle (800, 455).

The question: **which lane do you cover, and where the two pass, which ship?** Every wave aims at one lane or the other or at both at once (Beat `lane`), or at the two ships about to pass each other (the aim `'cross'`). From wave 4 the enemy spots for its shells from the water between the lanes: a spotter beacon rises at the crossing (where the next outbound and inbound ships will meet), four hits, marks the ship nearest it (a dashed line and a bracket, 1.6 s before) and calls a shell on it, three times, the ships of both lanes in its reach as they pass. Your helpers inside its ring fire at it in vain (it is a Lure Beacon: only your own shots sink it), so the answer is a tap, and the tap is taken from the lanes.

The mechanic is in every wave (rule `g-mechanic`): a beat at one lane or both in waves 1–10, the crossing aimed at in waves 3, 4, 7, 9 and 10, spotters in waves 4 and 7–10 (the encounters') and in every wave from 4 (the signature's), and the boss is lines of spotters between the lanes.

How it differs from the other rebuilt maps: there the danger is aimed at a place (an island's side, a lock, the guns, a dark bank), a ship (the tanker), a launcher you can remove (the rigs), drifts (the mines), comes from fixed hiding places (the coves) or follows your steering (the Delta's switch); here it comes from both sides at two convoys at once, and its spotter stands between them, where your own helpers cannot help.

## Sites and their jobs

Bases are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| North-west silo (base 1) | (280, 95) | drones, shells, guided | Over the outbound lane's way in: drones at its ships (w1, w3, w6, w8, w10), a shell at the outbound ship halfway along (w2, w4), at the crossing (w3), guided missiles at the outbound ships coming in (w5, w10) and across at the inbound lane (w8); the shell silo nearest most north-lane ships a spotter marks. |
| North-middle silo (base 2) | (800, 90) | heavies, supersonic, clusters | Over the crossing: a cluster at the passing ships (w9, w10), a supersonic at the lead ship (w9). |
| North-east silo (base 3) | (1320, 95) | drones, guided, motherships | Over the inbound lane's way in: drones at the inbound ships (w2, w4, w7, w9, w10), guided missiles at the inbound ships coming in (w5, w8, w10). |
| South-west shore silo (base 4) | (560, 838) | shells, guided | Under the inbound lane: a shell at the inbound ship halfway along (w2), a guided missile at the crossing (w3), across at the outbound lane (w8); the shell silo nearest the south-lane ships a spotter marks. |
| South-east shore silo (base 5) | (1040, 838) | drones, clusters, heavies | Under the inbound lane: clusters at the passing ships (w4, w7, w9). |
| Sub spots 1 and 2 | The two ends of the water between the lanes (200, 455), (1420, 455) | shell salvos | Each by one convoy's way in: salvos at the ships coming in, both ends at once (w6). |
| The water between the lanes | At the crossing (`crossingSpot`) | spotter beacons | The signature's and the encounters' spotters (w4, w7–w10), the Beacon Line. |
| Roads, air | The north road, the south shore road, the pop-ups at 540, 1060 and 800 (south), the edges and the bomber line down the middle | trucks, jets, bombers | The shared waves' own. |

## The stretches

- **Danger: the middle**, where the two convoys pass each other and the spotters rise: 39% of the hull damage in waves 1–9 on the outbound lane and 38% on the inbound (the usual Armory's record report; pooled 39%). Before the rebuild it was the middle too (40% / 43%).
- **Safe: the ends**, each lane's way in or way out: the outbound lane's coldest stretch is its early third (27%), the inbound's its late third (27%). The report flags both (a lane's coldest stretch at 27% against a 25% line), as it flagged the map before (29% / 26%): with every edge of the screen a front, no end of a lane is quiet, and the waves aim some fire at each convoy's way in on purpose (waves 5, 6, 10: "both edges are a front").
- Rule `m-carrier`: the carrier sits in the water between the lanes in the middle (800, 455), so the danger stretch is also the carrier's closest, as on the Rigs, the Sowers and the Delta. The middle is where the map's question is (the crossing), so it stays.

## The convoy

The map's own convoy (rule `m-convoy`, `m-shape-convoy`): **flow step 3 (a ship every 2.8 s) in a Spread**, one ship at a time, alternating between the lanes: heavy two-way traffic, the ships of the two convoys passing each other at the crossing all wave long. No command: the spotters are answered by shooting, not by sailing.

Why not the campaign's schedule (step 1, Pairs), as the Coves: on the Crossing's shared waves (no encounters, 96 seeds, the usual Armory) it won 10% (5.70 ships lost in waves 1–10): the heaviest shared waves of chapter 4 (threat scale 1.65) on half as many hulls per lane. Step 2 in Pairs won 17%, step 2 in a Column 6%, step 1 in a Box 23%, step 2 in a Spread 54%, **step 3 in a Spread 67%** (48 seeds each). The card before the rebuild played today's convoy controls, where the "you" bot sails its campaign habit (step 3–4, a Spread or a Box) and won 74%. A question for the player.

## The signature: spotters at the crossing

The player's round 9: each map gets a threat of its own in waves 4–10, tied to its identity and its boss. The Crossing's identity is the two convoys passing; its boss is lines of spotters between the lanes. The signature (`MAP_SIGNATURE.crossing`, from wave 4):

- **Half the wave's new enemies (rounded up) come as spotter beacons** (chapter 4's own Lure Beacon, `foe: 'lure'`, `foeShare: 0.5`), each in place of the enemy the planner drew (so it takes out of the wave what that one would have, rule `w-budget`), and the shells it calls come out of the wave's own shells, one for one (else its guided missiles, else its drones), so the wave sends no more;
- a spotter (`SPOTTER`) **rises in the water half way between the lanes where the next two ships will pass each other** (`crossingSpot`; clear of the carrier and the frigate), takes **four hits**, and only your own shots count (your helpers in its ring fire at it in vain, as at any Lure Beacon);
- up, it **marks the ship nearest it** 1.6 s before each call (the dashed line and the closing bracket, Beacon Strike's own marks), and at the call **a shell is lobbed at that ship from the shell silo nearest it**: three calls, the first 2 s after it is up, then every 4 s; its calls spent, it sinks back.

The encounters add their own (`beacon` on a beat): one on wave 4, two on wave 7, one on wave 8, two on wave 9, three on wave 10, each taking a launch and three shells out of the wave (`replaces`).

How much of waves 4–10 it is (`tools/v3/combo-sweep/mixwaves.ts`, 8 seeds, the "you" bot drafting for itself, tough):

| | Waves 4–10 | Waves 6–10 | Boss rounds |
| --- | --- | --- | --- |
| Share of the threats that show (spotters and the shells they called) | 7% | 8% | 67% |
| Share of the hits it takes to clear them | **15%** | 16% | 79% |

Under the asked quarter, but twice the Coves' (7%) and the Delta's (6%). Most spotters are tapped down before their second call (`tools/v3/crossing/probe.ts`: the usual Armory's bot sinks most within 2–3 s of rising), so most of the shells a spotter would call never fly: its weight is in the tap it asks for, not in the hits. More spotters a wave (all the wave's new enemies) were not kept: the chapter's other new enemies (the Repair Ship, the Bodyguard Ring, the Incendiary Missile) stay regulars here. A question for the player.

## The counters

- **Counter kit: Thermobaric Shell, Gravity Well, Railgun.** The spotters rise between the lanes and only your own shots sink them; the shells they call and the waves' own fire come at both lanes at once. Weapons you fire that hit hard where you put them answer both: a Thermobaric burst or a Railgun beam through a spotter as it rises, a Gravity Well holding the drones and shells over the water between the lanes.
- **Off-counter kit: Drone Screen, Full Steam, Bomber Wing.** The Drone Screen's drones are helpers (a spotter's ring draws them and they shoot it in vain); Full Steam hurries the convoys through the crossing but not past the spotters; the Bomber Wing silences a silo, not the spotter calling its shells.
- Both chosen from the combo sweep's singles at log v58 (Thermobaric 5.8, Gravity Well 5.9, Railgun 6.0; Drone Screen 8.2, Full Steam 9.6, Bomber Wing 10.0), leaving out the Air Strike (the best alone, 4.7, and in three of the five best kits) and the Wild Card (4.8). Every weapon is in chapter 4's draft. A design note for the bots only: nothing in the game nudges the player towards it.

## Loadouts on this map (combo sweep singles)

Each weapon alone, forced at every draft (12 seeds, the player's usual Armory, version 58; `npm run v3:combo-sweep -- --stage=singles --maps=crossing --out=tools/v3/combo-sweep/results/v58-ch4`). Ships lost over all 13 waves:

- **Strong:** **Air Strike 4.7**, the Wild Card 4.8, Thermobaric 5.8, Shield and Gravity Well 5.9, Railgun 6.0, Shrapnel 6.2, Boomerang 6.4.
- **Middling:** Tesla 6.9, the Cadence Gun 7.0, Frigate Escort 7.2, Flak and Supply Run 7.3, Gunship Pair 7.4, Overdrive and Orbital Strike 7.8, Seeker and Drone Screen 8.2, Point Defense 8.4, Scattergun 8.5.
- **Weak:** Full Steam 9.6, Bomber Wing 10.0, Focus Fire, Grapnel and the Charge Lance 10.8, Dual Wield 11.8, the Laser Cutter 35.2. The plain gun 11.8 (won 17%); the bot drafting for itself: 6.7 (won 67%).

## Diversity: are the Crossing's best kits its own?

Swept the chapter 2 way (singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16), and compared with the five chapter 2 maps, the five chapter 3 maps, the Coves and the Delta from their last sweeps (`docs/design/v3-combo-diversity.md`, "Dunmar Crossing"; `python3 tools/v3/crossing/compare.py`).

| | Result |
| --- | --- |
| Top 5 kits | **Air Strike + Scattergun + Dual Wield** 4.7 (won 81%), Air Strike + Shrapnel Shell + Supply Run 5.2, Boomerang + Gravity Well + Wild Card 5.4, Flak Cannon + Railgun + Supply Run 5.6, Air Strike + Shrapnel Shell + Tesla Arc 5.9 |
| Jaccard of the top-5 kits, against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers / Rigs / Black Strait / Dreadnought / Coves / Delta | **0** against all twelve |
| The same, the Crossing against itself (two halves of its seeds) | 0.43 |
| #1 kit | in no other rebuilt map's top 5 |
| Best weapon alone | **Air Strike** 4.7 (the best single on the Island, the Behemoth, the Archipelago and the Delta too) |
| Rank correlation of the weapons alone, against the same twelve | 0.37 / 0.46 / 0.37 / 0.56 / 0.40 / 0.68 / 0.65 / 0.76 / 0.68 / 0.62 / 0.57 / 0.59 |
| Air Strike + Flak Cannon | **in none of the five best kits** (the Flak Cannon in one, with the Railgun) |

- **All five of the Crossing's best kits are its own.**
- **The Air Strike leads alone and is in three of the five best kits**: a weapon you fire, so it sinks a spotter, which your helpers cannot. The pair the brief asked to keep from the core of every top kit, Air Strike + Flak Cannon, is in none of them.

## Debuts: "New on Open War"

The Coves debut chapter 4's four new enemies (the Repair Ship, the Bodyguard Ring, the Lure Beacon and the Incendiary Missile, waves 2–5); on the Crossing they are regulars, drawn by the planner as any wave's new enemies (`mapDebutsFoe('crossing', …)` is false for all four; the test checks it). The spotter is a Lure Beacon put to a new use, not a new enemy: the encounters bring no other enemy and nothing from a later chapter.

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated, with filler on waves 1–6 (strings of two or three drones out of the north-west and north-east silos, the far shore's two drone silos; wave 1 one late string of two only). `CROSSING_CLIMB` sends 15% less on wave 1 (its shared drones reach the ships coming in at both ends), the shared wave on waves 2–5, and 4–14% less on waves 6–10, within ±15% (rule `w-budget`). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | Two fronts (`crossing-two-fronts`) | north-west silo, 2 drones; north-east silo, 2 drones | the outbound ship halfway along, then the inbound one |
| 2 | teach | Shore to shore (`crossing-shore-to-shore`) | north-west silo, a shell; south-west shore, a shell; north-east silo, 3 drones | each lane's ship halfway along, from its own shore |
| 3 | teach | The meeting (`crossing-meeting`) | north-west silo, a shell; south-west shore, a guided missile; 3 drones | the next two ships to pass each other |
| 4 | combine | Spotter (`crossing-spotter`) | **a spotter** at the crossing; 4 drones; a cluster off the south-east shore; a shell | the ship nearest the spotter at each call; the inbound ships; the passing ships |
| 5 | combine | Both edges (`crossing-both-edges`) | guided missiles off the north-west and north-east silos, 3 s apart; 4 drones | each convoy coming in, at its own end |
| 6 | combine | Periscopes at both ends (`crossing-periscopes`) | subs at both ends of the water between the lanes, 2 shells each; 4 drones | each convoy coming in |
| 7 | escalate | Two spotters (`crossing-two-spotters`) | **two spotters**, 5 s apart; a cluster off the south-east shore; 5 drones | the ships nearest each spotter; the passing ships |
| 8 | escalate | Crossfire (`crossing-crossfire`) | guided missiles across the lanes (the north shore at the inbound ships, the south shore at the outbound); **a spotter**; 5 drones | the far lane from each shore |
| 9 | escalate | Passing fire (`crossing-passing-fire`) | **two spotters**; clusters off both shores; a supersonic | the passing ships; the lead ship |
| 10 | climax | The crossing (`crossing-the-crossing`), after a 6 s calm | **three spotters**, 3 s apart; a cluster; guided missiles at both entries; 12 drones before the calm | the crossing and both fronts |

Wave 1 loses 0.02 ships a run with the usual Armory (192 seeds, normal; 0.00 on the 24-seed record report); with no Armory, as the wave-1 test plays it (`tools/v3/crossing/wave1.ts`, seeds 11–50), the "you" bot loses none and the casual bot 0.08 a run: its shared drones reach the ships coming in at both ends, so the wave sends 15% less and its filler is one late string of two (an early string of three off the north-west silo sank 0.2–0.3 ships a run for the bots with no Armory).

**Wave 10, the climax:** after a 6 s calm, three spotters rise one after another at the crossing while clusters and guided missiles come at the passing ships and both ends. On normal runs it costs the usual Armory 0.57 ships (wave 9: 0.78), on tough runs 0.81 (0.94): **not the hardest regular wave**, wave 9 is (its two spotters and two clusters land on the ships passing). In tuning, wave 10 with both of its drone strings at the ships coming in cost 1.58 ships on 192 tough seeds (twice wave 9, a cliff), with both at the ships halfway along 0.55; the build keeps one of each (0.81). A question for the player.

## The boss plan: the Beacon Line

The Crossing's event was Beacon Strike: a pair of beacons by the lanes twice a round, each calling a shell on the ship nearest it, two swarms of five; it barely touched the bot (0.01–0.02 ships a round). Its spotting beacon is now the Crossing's signature from wave 4, so the player has met it one at a time; the boss under encounter rev 4 is the same idea made a set piece (`CROSSING_BOSS_ROUNDS`, lab only; the event's id stays `beacon-strike`): **the Beacon Line**. Each round **lines of spotters rise at once, spread down the whole water between the two lanes**, the convoys passing either side of them; every spotter of a line is on the same count, so **they mark their ships together** (a fan of dashed lines from the line to both convoys) and **a volley of shells comes off both shores at once**, three volleys a line, until the line is tapped down. Drone swarms come with them, and guided missiles at the ships coming in at both ends.

| Round | Lines | Spotters a line | Spotters | Added |
| --- | --- | --- | --- | --- |
| before (every round) | 2 pairs by the lanes | 2 | 4 | 2 swarms of 5 |
| 1 | 2 (at 0 and 8 s) | 3 | 6 | 3 guided missiles; 2 swarms of 5 |
| 2 | 3 (0, 6, 12 s) | 4 | 12 | 2 guided missiles; 2 swarms of 5 |
| 3 | 3 (0, 6, 12 s) | 5 | 15 | 2 guided missiles; 2 swarms of 6 |

Each spotter four hits, three calls (the first 2.5 s after it is up, every 4.5 s), each ship marked 2 s before. The intro is the shared cards: "Boss round", "Convoy restored", "The boss: Beacon Line", "Round 1 of 3".

How it reads (192 seeds, normal runs that reached it):

| Armory | Before r1 / r2 / r3 | After r1 / r2 / r3 |
| --- | --- | --- |
| usual | 0.01 / 0.02 / 0.00 | **0.52 / 1.35 / 2.20** |
| latest | 0.00 / 0.00 / 0.01 | **1.09 / 2.88 / 3.09** (90, 89, 54 runs) |
| plating | 0.00 / 0.00 / 0.02 | **0.31 / 1.07 / 1.90** |

Rising for every Armory; round 3 is near the asked 2.5 for the usual Armory (2.20 normal, 2.56 tough), rounds 1–2 under the asked 1.5 / 2, as on every rebuilt map (the convoy is restored before the boss and the loss limit is six). The latest set (no Quick Reload) is broken by round 2: a line of four spotters it cannot tap down in time calls twelve shells a volley.

## Bot results, before and after

"Before" is the map card as it was (the base build before the Crossing: today's convoy controls, no encounters, Beacon Strike), read on a copy of that build on the same seeds. "After" is this build. The reads are 192 seeds (900–1091), the record reports' bot and setup (`tools/v3/crossing/final.sh`).

### The headline (192 seeds, normal runs)

| Armory | Won before → after | Waves 1–5 lost | Waves 1–10 lost | Wave 9 | Wave 10 |
| --- | --- | --- | --- | --- | --- |
| **usual** (Quick Reload 5, Damage Control 4, Stockpile 5) | 74% → **53%** | 0.51 → **0.53** | 3.06 → 3.18 | 0.78 → 0.78 | 0.96 → 0.57 |
| latest (Wide Warhead 5, Point Defense 4, Supply Lines 3) | 41% → **8%** | 0.60 → **0.72** | 3.47 → 3.99 | 0.99 → 1.32 | 0.95 → 0.91 |
| plating (Quick Reload 5, Armor Plating 5, Big Magazine 4) | 50% → **58%** | 0.48 → **0.45** | 2.67 → 2.82 | 0.63 → 0.71 | 0.85 → 0.45 |
| none | 0% → 0% | 2.35 → 2.52 | 4.11 → 5.47 | 1.00 → 1.33 | 1.25 → 0.20 |

Normal-run curves, waves 1–10 then the boss rounds (runs that reached each):

| Armory | Before | After |
| --- | --- | --- |
| usual | .01 .02 .05 .18 .25 .14 .38 .48 .78 .96 · boss .01 .02 .00 | .02 .02 .09 .06 .34 .30 .46 .66 .78 .57 · boss .52 1.35 2.20 |
| latest | .00 .02 .11 .23 .24 .36 .60 .77 .99 .95 · boss .00 .00 .01 | .01 .01 .11 .06 .53 .42 .54 .82 1.32 .91 · boss 1.09 2.88 3.09 |
| plating | .00 .01 .08 .15 .25 .28 .44 .54 .63 .85 · boss .00 .00 .02 | .01 .01 .06 .09 .28 .43 .45 .55 .71 .45 · boss .31 1.07 1.90 |

Tough-run curves (every seed plays every wave; the cliff check), 192 seeds. Before: usual .01 .02 .05 .19 .24 .16 .41 .52 .98 1.23 (wave 9 ×1.9 the wave before); latest .00 .02 .11 .26 .32 .45 .88 1.15 1.70 2.46; plating .00 .01 .08 .15 .25 .31 .54 .75 .96 1.48. After: usual .02 .02 .09 .06 .34 .31 .47 .69 .94 .81; latest .01 .01 .11 .06 .55 .52 .78 1.10 2.27 1.55; plating .01 .01 .06 .09 .28 .47 .54 .62 1.01 .74; none (on the build before the last change) .02 .10 .75 .54 1.63 2.18 2.93 2.95 5.59 3.85. **The largest step for the usual Armory: 1.48× on wave 6 to 7** (wave 5's 1.36× from the 0.25 floor; wave 9 1.36×); plating 1.63× (wave 9); **the latest set's wave 9 is 2.06× its wave 8 (1.10 → 2.27): a cliff for that Armory** (its two spotters and two clusters at the passing ships, which a set with no Quick Reload cannot tap down). With no Armory wave 5 is 3.0× wave 4. Boss rounds, tough (with round 2's lines at 0, 7 and 14 s, before they were brought to 0, 6 and 12 s to keep the round under 30 s): usual 0.53 / 1.09 / 2.56, latest 1.18 / 5.15 / 8.08, plating 0.35 / 1.29 / 2.66.

### The record reports (24 seeds, 900–923)

| | Before latest / plating / usual / none | After latest / plating / usual / none |
| --- | --- | --- |
| Won (normal) | 33% / 54% / 83% / 0% | 4% / 38% / **67%** / 0% |
| Waves 1–5 lost (normal) | 0.50 / 0.21 / 0.29 / – | 0.42 / 0.42 / 0.42 / 1.92 |
| Boss r1 / r2 / r3 (normal, reached) | nothing (0–0.1 a round) | 1.36 / 3.55 / 3.25 (11, 11, 4); 0.31 / 1.11 / 2.16 (the 192-seed read; the 24-seed plating report ran with its kits); **0.43 / 0.76 / 2.33** (21); – |
| `w-cliff` (tough) | FLAG (w9, w10) / PASS / FLAG (w9: 0.33 → 1.29) / – | FLAG (w8: 0.33 → 1.33) / FLAG (w8: 0.46 → 0.96) / **PASS** / FLAG (w5, w7); on 192 seeds no player Armory's wave doubles the one before (above) |
| `w-early` close calls from wave 3 | PASS | **PASS** (fewest 2.5–3.5 a run, wave 4) |
| `w-budget` ±15% | PASS | FLAG: wave 10 ×0.73–×0.78 (and wave 5 ×0.83 for the latest set and none) of what flies with the encounters off; counting each spotter's calls as planned, every wave is ×0.87–×1.05 (`tools/v3/crossing/budget.ts`) |
| `m-stretches` | FLAG: coldest 26–33% | FLAG: hot middle 36–42%, coldest (the ends) 26–31% |
| `g-warning` | PASS: 10.1 → 4.1 s | PASS: 9.4 → 4.3–4.4 s |
| `w-first` | PASS | PASS |
| Kits (counter / off-counter), the usual set: won, lost in waves 1–10 (normal), boss | – | 75% / 75%, 3.0 / 2.9, 0.45 0.68 2.36 / 0.41 0.77 2.24 |
| Kits, the plating set | – | 46% / 42%, 3.2 / 3.4, 0.25 1.20 2.70 / 0.16 1.74 2.63 |

The 24-seed record and the 192-seed reads disagree by up to 20 points on a win rate here (usual 67% against 53%); the larger read is the one to trust. (The record reports were run on the build just before the last two changes: the spotter kept clear of the carrier's whole hull, and the Beacon Line's round 2 brought under 30 s; the 192-seed normal reads are on the final build, the tough reads on the build before round 2's change.)

**Busier early waves** (the usual Armory's record): threats on the board at a moment 1.5, 1.9, 2.1 on waves 1–3, kills a minute 43, 51, 55.

**The counters** (rule `m-kits`): with the bot's taste set to them, the counter kit is no better than the off-counter with the usual set (75% both) and a little better with the plating set (46% / 42%, 0.2 fewer ships in waves 1–10, a lighter boss round 2); **not clearly better**. Forced alone (the singles) the gap is wide (5.8–6.0 against 8.2–10.0 ships over the run): the bot drafting to a taste still takes what the draft offers. Neither is trivial.

### Crossing difficulty (rule `m-difficulty`; the brief: win 50–70%, waves 1–5 0.4–0.8)

- **The usual Armory wins 53%**, in the band (before 74%, a map that never used its two lanes, with no boss). **The plating set 58%**, in the band. **The latest set 8%**, far under it (before 41%): the spotters ask for taps, and the latest set has no Quick Reload; its waves 1–10 cost 3.99 ships and its boss rounds 1.09 / 2.88 / 3.09.
- **Waves 1–5:** 0.53 for the usual Armory, in the asked 0.4–0.8 (before 0.51); plating 0.45, latest 0.72.
- **The climb from wave 4 to 9** rises for the usual Armory from 0.06 to 0.78 (.06 .34 .30 .46 .66 .78).
- **Wave 10** (0.57) is under wave 9 (0.78) on normal runs for the usual Armory: the climax is not the hardest regular wave on this measure (see the tough runs).

## What is not satisfied, or uncertain

- **The latest Armory (Wide Warhead 5, Point Defense 4, Supply Lines 3) wins 8%** (before 41%), far under the band: the spotters ask for your own shots, and a line of four or five a round is more than a set with no Quick Reload taps down before it calls (boss rounds 1.09 / 2.88 / 3.09 on normal runs, 1.18 / 5.15 / 8.08 tough), and its wave 9 is 2.06× its wave 8 on tough runs (a cliff for that set). The usual and plating sets win 53% and 58%. No single tuning put all three in the band: a lighter Beacon Line (lines of three, three, four) won the usual set 81% and the latest 15%.
- **The signature is 15% of the hits in waves 4–10**, under the asked quarter (twice the Coves' and the Delta's): most spotters are tapped down before their second call.
- **Wave 10 is not the hardest regular wave** for the usual Armory (0.57 against wave 9's 0.78 normal; 0.81 against 0.94 tough); see "The ten waves".
- **No safe stretch under 25%** on either lane (27% each, the ends); the map was flagged the same before (29% / 26%). Every end of a lane is a front.
- **The danger stretch is the carrier's closest** (rule `m-carrier`): the carrier sits in the middle between the lanes, where the convoys cross.
- **The 24-seed report flags the budget on wave 10 (×0.74 of the no-encounter wave)**: what flies, not what is planned. A spotter's calls come out of the wave's own shells, and a spotter tapped down before it calls never fires them. Counting each spotter's calls as planned (`tools/v3/crossing/budget.ts`, 8 seeds) every wave is ×0.87–×1.05 of the wave with no layer (wave 10 ×0.91).
- **The convoy change.** The card played today's convoy controls before; on the campaign's own schedule (step 1, Pairs) the shared waves won 10%, so the map's own convoy is step 3 in a Spread (as the Delta's).
- **Boss rounds 1–2 under the asked 1.5 / 2** for the usual Armory (0.52 / 1.35), round 3 at 2.20 (2.56 tough), as on every rebuilt map (the loss limit is six).
- **The none Armory's wave 5 is 3.0× its wave 4** on tough runs (0.54 → 1.63): a cliff with no Armory (the player Armories pass).
- **Losses to a spotter's shells are blamed on the shell** (a ballistic missile) in the logs and the end screen's "what sank you", not on the spotter.
- **The 24-seed records and the 192-seed reads disagree** by several points on a win rate; the larger read is the one to trust.

## The play log (v58)

`LOG_VERSION` 58, `LOG_REPLAYS` `[58]` (`src/v3/sim/playlog.ts`). The change is lab only, under the encounter layer: the campaign plays as at 57, and a 57 Crossing card log played today's convoy controls and the shared waves (it no longer replays to the same game). The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 58 (`python3 tools/v3/playtest-fixes/pins.py 57 58`, and `tests/v3/scorecard.test.ts`). The Test Lab's "Ready to test" lists the Crossing at v58. The combo sweep's results are in `tools/v3/combo-sweep/results/v58-ch4`.

## Questions for the player

- **Does a spotter read as "tap it now" on the phone?** It rises between the lanes, draws a dashed line to the ship it marks and a bracket closing on it 1.6 s before each shell. Recommended: play waves 4, 7 and the boss; if the line is lost among the two convoys, make the spotter's ring brighter, not bigger.
- **The boss: the Beacon Line, on Beacon Strike's slot.** The spotting beacon is the map's signature from wave 4, so the boss is lines of them between the lanes, calling together. Recommended: keep the name "Beacon Line"; say if you would rather it kept "Beacon Strike".
- **The convoy: step 3 in a Spread, no command.** On the campaign's own schedule (Pairs, step 1) the Crossing's heavy shared waves won 10%. Recommended: keep it (heavy two-way traffic is the map), as the Delta's.
- **The latest Armory wins 8% here.** The map asks for your own shots (Quick Reload), and the latest set has none. Recommended: leave it; it is the map's question, and the player's usual set wins 53%. If it feels like a wall in play, the Beacon Line's second round can lose a spotter a line.
- **The signature is 15% of the hits in waves 4–10, not 25%: raise it?** Recommended: keep it; the spotter's weight is the tap it asks for. Raising it means every new enemy a spotter from wave 4 (the chapter's other three gone from this map).
- **Wave 10 just under wave 9.** Recommended: play it; if the climax feels flat, wave 10's climb back to 0.92.

## Checks run

`tsc`; `vitest --exclude '.claude/**'` (81 files, 1912 tests: all pass but two on the first full run, both fixed and re-run: wave 8's call-out was one letter under the shortest allowed, and `mapReport.test.ts`'s 20 s time limit was hit while the combo sweep shared the machine; it passes alone); `vite build`, then `vite preview` and the e2e scripts `v3-encounters.mjs`, `v3-map-cards.mjs`, `v3-map-lab.mjs`, `v3-convoy.mjs`, `v3.mjs` (all pass, on the final build); the map-lab baseline replays exactly with telemetry on and off.

## Tests

- `tests/v3/encounters.test.ts`:
  - the ten listed, rev 4, v1 only, none at rev 3; `REBUILT_MAPS` has the Crossing, and `CHAPTER_FOUR_MAPS` is `['coves', 'delta', 'crossing']`;
  - the budget (an encounter's spotter takes a launch and its three shells out of the wave), legality (a spotter rises from the water at the crossing, the signature's own enemy, from its first wave), warning and replay checks cover the map;
  - the signature: from wave 4 half the wave's new enemies are spotters, none before wave 4, before rev 4 or on the shared wave, and the campaign keeps plain Lure Beacons; a spotter's shells come out of the wave's own;
  - the encounters' spotters on waves 4 and 7–10, every wave aimed at a lane or the crossing, and only the Crossing's encounters rise from the water, aim at the crossing or name a lane;
  - a spotter rises between the lanes at the crossing (clear of the carrier), takes `SPOTTER.hp` of your own shots (a helper's does nothing), marks the ship nearest it and calls `SPOTTER.calls` shells, then sinks back; shot down early, it calls no more; `crossingPair` finds an outbound and an inbound ship;
  - the Beacon Line's rounds: so many spotters a round as its lines, shells called, more spotters each round, each ship marked at least 1.5 s before; a rev 3 log and the campaign play Beacon Strike's four beacons; 15–30 s a round; the boss's name "Beacon Line" under the layer, "Beacon Strike" before it;
  - chapter 4's new enemies are regulars here (they debut on the Coves); the encounters bring only the spotters;
  - the filler: waves 1–6.
- `tests/v3/mapRules.test.ts`: no repeats and no gaps; `MAP_PLANS` complete; the boss target is 2.
- `tests/v3/mapCards.test.ts`, `round11.test.ts`, `convoy.test.ts`: the production setup is policy D with the encounters, no command, flow step 3 in a Spread ("The map's own convoy (no commands) · encounters v1 Original"); the Tidewater Flats is the example of a map not yet rebuilt. `tests/v3/round12fixes.test.ts`: wave 1 opens with two strings of two drones, and loses no ship (seeds 11–13, "you" and casual).
- `tests/v3/readyToTest.test.ts`: the new entry. `tests/v3/scorecard.test.ts`: the log is version 58.
- `e2e/v3-map-cards.mjs`: the hub card says so; the bare link opens the full map with its encounters. `e2e/v3-encounters.mjs`: the card opens with its encounters and no command, the pause screen's script names the Beacon Line and the first spotter, and skipped to the boss, a line of spotters between the lanes marks its ships together (a shot at one pixel a point: `e2e/shots/v3-encounters/crossing-boss.png`).

## What to look for when you play

Two convoys at once: the outbound one sails east in the north lane under the north shore, the inbound one west in the south lane past the south shore, each coming in where the other leaves. From wave 4, beacons rise in the water between the lanes where the next two ships will pass: each marks the ship nearest it with a dashed line and calls a shell on it, three times, and only your own shots sink it (your helpers fire at it in vain). In the boss rounds whole lines of them rise between the lanes and call together. The questions: does the beacon read as "tap it now" on the phone, does covering two lanes at once feel like the problem, and do the three boss rounds rise?

(This section names no weapon to try: the counter kit above is a design note for the bots, never shown in the game or on the hub.)
