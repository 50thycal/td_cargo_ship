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

TOUGH-STRETCHES

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

COUNTERS

## Loadouts on this map (combo sweep singles)

Each weapon alone, forced at every draft (12 seeds, the player's usual Armory, version 58; `npm run v3:combo-sweep -- --stage=singles --maps=crossing --out=tools/v3/combo-sweep/results/v58-ch4`). Ships lost over all 13 waves:

- **Strong:** **Air Strike 4.7**, the Wild Card 4.8, Thermobaric 5.8, Shield and Gravity Well 5.9, Railgun 6.0, Shrapnel 6.2, Boomerang 6.4.
- **Middling:** Tesla 6.9, the Cadence Gun 7.0, Frigate Escort 7.2, Flak and Supply Run 7.3, Gunship Pair 7.4, Overdrive and Orbital Strike 7.8, Seeker and Drone Screen 8.2, Point Defense 8.4, Scattergun 8.5.
- **Weak:** Full Steam 9.6, Bomber Wing 10.0, Focus Fire, Grapnel and the Charge Lance 10.8, Dual Wield 11.8, the Laser Cutter 35.2. The plain gun 11.8 (won 17%); the bot drafting for itself: 6.7 (won 67%).

DIVERSITY

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

WAVE-NOTES

## The boss plan: the Beacon Line

The Crossing's event was Beacon Strike: a pair of beacons by the lanes twice a round, each calling a shell on the ship nearest it, two swarms of five; it barely touched the bot (0.01–0.02 ships a round). Its spotting beacon is now the Crossing's signature from wave 4, so the player has met it one at a time; the boss under encounter rev 4 is the same idea made a set piece (`CROSSING_BOSS_ROUNDS`, lab only; the event's id stays `beacon-strike`): **the Beacon Line**. Each round **lines of spotters rise at once, spread down the whole water between the two lanes**, the convoys passing either side of them; every spotter of a line is on the same count, so **they mark their ships together** (a fan of dashed lines from the line to both convoys) and **a volley of shells comes off both shores at once**, three volleys a line, until the line is tapped down. Drone swarms come with them, and guided missiles at the ships coming in at both ends.

| Round | Lines | Spotters a line | Spotters | Added |
| --- | --- | --- | --- | --- |
| before (every round) | 2 pairs by the lanes | 2 | 4 | 2 swarms of 5 |
| 1 | 2 (at 0 and 8 s) | 3 | 6 | 3 guided missiles; 2 swarms of 5 |
| 2 | 3 (0, 7, 14 s) | 4 | 12 | 2 guided missiles; 2 swarms of 5 |
| 3 | 3 (0, 6, 12 s) | 5 | 15 | 2 guided missiles; 2 swarms of 6 |

Each spotter four hits, three calls (the first 2.5 s after it is up, every 4.5 s), each ship marked 2 s before. The intro is the shared cards: "Boss round", "Convoy restored", "The boss: Beacon Line", "Round 1 of 3".

How it reads (192 seeds, normal runs that reached it):

| Armory | Before r1 / r2 / r3 | After r1 / r2 / r3 |
| --- | --- | --- |
| usual | 0.01 / 0.02 / 0.00 | **0.38 / 1.08 / 2.47** |
| latest | 0.00 / 0.00 / 0.01 | **1.14 / 3.30 / 2.42** (94, 94, 45 runs) |
| plating | 0.00 / 0.00 / 0.02 | **0.27 / 1.07 / 2.20** |

Rising for the usual and plating Armories; round 3 is at the asked 2.5 for the usual Armory, rounds 1–2 under the asked 1.5 / 2, as on every rebuilt map (the convoy is restored before the boss and the loss limit is six). The latest set (no Quick Reload) is broken by round 2: a line of four spotters it cannot tap down in time calls twelve shells a volley. TOUGH-BOSS

## Bot results, before and after

"Before" is the map card as it was (the base build before the Crossing: today's convoy controls, no encounters, Beacon Strike), read on a copy of that build on the same seeds. "After" is this build. The reads are 192 seeds (900–1091), the record reports' bot and setup (`tools/v3/crossing/final.sh`).

### The headline (192 seeds, normal runs)

| Armory | Won before → after | Waves 1–5 lost | Waves 1–10 lost | Wave 9 | Wave 10 |
| --- | --- | --- | --- | --- | --- |
| **usual** (Quick Reload 5, Damage Control 4, Stockpile 5) | 74% → **59%** | 0.51 → **0.54** | 3.06 → 3.12 | 0.78 → 0.73 | 0.96 → 0.62 |
| latest (Wide Warhead 5, Point Defense 4, Supply Lines 3) | 41% → **10%** | 0.60 → **0.73** | 3.47 → 4.18 | 0.99 → 1.42 | 0.95 → 0.93 |
| plating (Quick Reload 5, Armor Plating 5, Big Magazine 4) | 50% → **60%** | 0.48 → **0.44** | 2.67 → 2.74 | 0.63 → 0.73 | 0.85 → 0.38 |
| none | 0% → 0% | 2.35 → 2.52 | 4.11 → 5.54 | 1.00 → 1.48 | 1.25 → 0.50 |

Normal-run curves, waves 1–10 then the boss rounds (runs that reached each):

| Armory | Before | After |
| --- | --- | --- |
| usual | .01 .02 .05 .18 .25 .14 .38 .48 .78 .96 · boss .01 .02 .00 | .02 .02 .09 .05 .36 .29 .47 .61 .73 .62 · boss .38 1.08 2.47 |
| latest | .00 .02 .11 .23 .24 .36 .60 .77 .99 .95 · boss .00 .00 .01 | .01 .01 .11 .07 .54 .42 .63 .81 1.42 .93 · boss 1.14 3.30 2.42 |
| plating | .00 .01 .08 .15 .25 .28 .44 .54 .63 .85 · boss .00 .00 .02 | .01 .01 .06 .08 .28 .39 .44 .57 .73 .38 · boss .27 1.07 2.20 |

TOUGH-CURVES

REPORTS

### Crossing difficulty (rule `m-difficulty`; the brief: win 50–70%, waves 1–5 0.4–0.8)

- **The usual Armory wins 59%**, in the band (before 74%, a map that never used its two lanes, with no boss). **The plating set 60%**, in the band. **The latest set 10%**, far under it (before 41%): the spotters ask for taps, and the latest set has no Quick Reload; its waves 1–10 cost 4.18 ships and its boss rounds 1.14 / 3.30.
- **Waves 1–5:** 0.54 for the usual Armory, in the asked 0.4–0.8 (before 0.51); plating 0.44, latest 0.73.
- **The climb from wave 4 to 9** rises for the usual Armory from 0.05 to 0.73 (.05 .36 .29 .47 .61 .73).
- **Wave 10** (0.62) is under wave 9 (0.73) on normal runs for the usual Armory: the climax is not the hardest regular wave on this measure (see the tough runs).

## What is not satisfied, or uncertain

UNSATISFIED

## The play log (v58)

`LOG_VERSION` 58, `LOG_REPLAYS` `[58]` (`src/v3/sim/playlog.ts`). The change is lab only, under the encounter layer: the campaign plays as at 57, and a 57 Crossing card log played today's convoy controls and the shared waves (it no longer replays to the same game). The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 58 (`python3 tools/v3/playtest-fixes/pins.py 57 58`, and `tests/v3/scorecard.test.ts`). The Test Lab's "Ready to test" lists the Crossing at v58. The combo sweep's results are in `tools/v3/combo-sweep/results/v58-ch4`.

## Questions for the player

QUESTIONS

## Checks run

CHECKS

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
