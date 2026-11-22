# The Coves: map card (map rebuild, chapter 4)

**Date:** 2026-11-22. Smugglers' Coves (`coves`, chapter 4 "Open War", the 16th map and the chapter's first) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), the way the Rig Field (`docs/design/v3-ch3-rigs.md`, #216) and the rest of chapter 3 were. It starts chapter 4: its own table, `CHAPTER_FOUR_MAPS`, and chapter 4's four new enemies debut here. Encounter rev 4; play log **v56** (built as v53 alongside the Delta's v54; v55 is round 15's notes on the Sowers and the Rigs, merged first).

There is no player run of the Coves to start from. The starting point is the map as it was (the Test Lab card: today's convoy controls, the shared waves, the Repair Yard as its boss) and what the player asked of every rebuild: a question of its own and kits of its own, busier early waves ("more drones and easy things to kill", "less is more"), the climb from wave 4 to 9, no single-wave cliff, wave 10 the climax and not a wall, big and distinct boss set pieces, readable on an iPhone in landscape (874×402), anything that can sink a ship warned.

As it was (192 seeds, the usual Armory, today's convoy controls), the map was flat for five waves and then a climb to a wave-10 wall (waves 1–5 lost 0.01–0.14 ships each, wave 10 1.25; tough: wave 8 ×4 the wave before), its boss was nothing (0.02–0.03 ships a round), and its mechanic, the coves, was a random fast boat now and then out of a random cove. On the map's own convoy (the production setup every rebuilt map plays: Pairs at the campaign's schedule, no commands) the same shared waves won 6% (48 seeds): today's controls let the bot sail a Box, which takes a hit less from every ram.

Code:
- `src/v3/data/encounters.ts`: `COVES_R4` (ten encounters), the filler for waves 1–6 (`BUSY`), `COVES_CLIMB`, `MAP_SIGNATURE.coves` (`fireShips`: fire ships), `COVES_BOSS_ROUNDS` and `MAP_BOSS.coves` (a boss round's `fleet`; the boss's name, Fire Fleet), Beat `fire`, BossFire `fastboat`, **`CHAPTER_FOUR_MAPS`** (`ChapterFourMap`, the Coves, in `REBUILT_MAPS`);
- `src/v3/data/config.ts`: `FIRESHIP` (a fire ship's hits, speed, its fire's burn, its ram);
- `src/v3/sim/game.ts`: fire ships (Threat, Launch and Unit `fire`, `lightFireShip`; sunk, `damageThreat`, or ramming, `checkImpact`, it bursts into its fireball); the wave planner sends the signature's fire ships out of the coves in turn (`fireShips`), an encounter's beat its `fire`;
- `src/v3/sim/foes.ts`: `burstCloud` takes the fire's `burn` (an Incendiary Missile's fireball, burning less long);
- `src/v3/sim/events.ts`: the Repair Yard under the Coves' boss tuning is the Fire Fleet (`fireFleet`: the cove mouths lit, the sortie, the round's added launches); with no boss tuning it plays as it did;
- `src/v3/ui/features.ts`: a fire ship drawn burning (flames on its deck) with a dashed orange ring the size of the fire it leaves, and its health bar against its own hits;
- `src/v3/data/convoy.ts`: `MAP_CONVOY.coves` (the campaign's schedule, Pairs, no command); `src/v3/data/mapPlans.ts`: `MAP_PLANS.coves`; `src/v3/data/lab.ts`: "Ready to test" lists the Coves at v56; `src/v3/sim/playlog.ts`: `LOG_VERSION` 56;
- tools: `tools/v3/coves/` (`readall.sh`: the tuning read for every Armory, `tools/v3/rigs/read.py` on the Coves; `final.sh`: normal and tough; `reports.sh`: the record reports; `waves.ts`: what each wave plans, fire ships counted; `compare.py`: the diversity check against chapters 2 and 3); `tools/v3/rigs/sunk.ts` takes `--map` now (what sinks the ships, wave by wave); `tools/v3/combo-sweep/mixwaves.ts` counts the Coves' signature (a fire ship).

Bot reports: `tools/v3/map-report/results/coves-player.md` (the usual Armory: Quick Reload 5, Damage Control 4, Stockpile 5), `coves-latest.md` (Wide Warhead 5, Point Defense 4, Supply Lines 3), `coves-plating.md` (Quick Reload 5, Armor Plating 5, Big Magazine 4), `coves.md` (no Armory); each with a heat map and the counter and off-counter kits; the map as it was: `coves-before*.md` (read on a clean copy of the base build). Tuning reads: `tools/v3/coves/final.sh <dir>` (192 seeds, 900–1091, the record reports' bot).

## How it is gated (lab vs campaign)

As every rebuild: **lab only, under the encounter layer.** The Test Lab's map card (`?lab=map-coves`) opens on its production setup, policy D with no command, the map's own convoy at the campaign's schedule (new: before, it opened on today's convoy controls) and the authored encounters rev 4, because the Coves are in `REBUILT_MAPS` (via `CHAPTER_FOUR_MAPS`, chapter 4's own table, self-contained beside `CHAPTER_THREE_MAPS` so the Delta, chapter 4's second, adds itself to it). The hub card reads "The map's own convoy (no commands) · encounters v1 Original". Everything new reads the run's encounter setup (`signatureOf`, `bossTune`), so the campaign, a run with no layer, a rev 3 log and the shared wave (`only: []`) play the Coves exactly as before: the shared waves, plain fast boats, the planner's own new enemies and the Repair Yard. The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version.

## The problem

> Four smugglers' coves hide fast boats two seconds from the lane, three in the enemy's north shore and one in the south shore by the delivery end: a boat takes two hits and rams for two, and from wave 4 fire ships come out of them that burn where they are sunk or ram, so each wants stopping far out, at the cove mouth, not on the lane.

The coves are the map's one mechanic (rule `m-mechanic`; `data/maps20.ts`): the north-west (381, 150), the north-middle (911, 150), the north-east (1401, 150) and the south cove (1238, 820), the only launcher on the ships' own side of the lane, facing the north-east cove across it by the delivery end. A boat out of a cove is at a ship passing its mouth in about two seconds (its white wake the warning), or runs the length of the lane at one further off.

The question: **where do you stop it?** A plain boat anywhere before it rams. A fire ship (from wave 4) far out: sunk at the cove mouth its fire burns harmlessly on the water; sunk on the lane, or ramming, it burns where the next ships sail, a hit to each hull that passes through.

The mechanic is in every wave (rule `g-mechanic`): every wave sends boats out of a cove (waves 1–10), the south cove from wave 3, fire ships from wave 4 (the encounters' on waves 4, 7, 8 and 10, the signature's on every wave from 4 but 6), and the boss rounds are fire ships out of the coves.

How it differs from the other rebuilt maps: there the danger is aimed at a place (an island's side, a lock, the guns, the night's bank), a ship (the tanker) or drifts (the mines), or comes from launchers the player can remove (the rigs); here it comes over the water from fixed hiding places at whatever ship is nearest, and the choice is where to spend the shot, because a fire ship's fire stays where it goes down.

## Sites and their jobs

Bases and spots are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| Far north-west silo (base 1) | (180, 100) | drones, shells | The map's only drone launcher, a long flight: the filler, every wave's swarms, and from wave 5 the drones that stand in for the waves' shells; shells at the ships coming in (w2, w5, w9). |
| North-middle silo (base 2) | (640, 100) | guided, supersonic | A guided missile at the lead ship, a long flight (w3, w10). |
| North-east silo (base 3) | (1150, 100) | heavies, clusters | A cluster at the lead ship (w4) and at the ship halfway along (w7). |
| South-east shore silo (base 4) | (1480, 810) | guided, shells, motherships | A guided missile at the lead ship from the ships' own side (w8). |
| North-west cove (base 5) | (381, 150) | fast boats | Boats down the lane after the lead ship (w2, w8, w10), at the ships coming in (w6). |
| North-middle cove (base 6) | (911, 150) | fast boats | The first fire ship (w4), the fire ship of the north shore (w8), boats at the ship passing (w10). |
| North-east cove (base 7) | (1401, 150) | fast boats | Wave 1's boats, a long run west at the ships coming in; the east's boats and fire ships (w3, w5, w7, w9, w10). |
| South cove (base 8) | (1238, 820) | fast boats | From the ships' own side by the delivery end (w3, w5, w7, w9, w10). |
| Sub spot 2 | Off the north-east cove (1520, 262) | sub salvos | A periscope lobbing shells back up the lane (w6). |
| Roads, other spots, air | The north runner road, the pop-up road at 1550, the near spots, the edges | trucks, subs, jets, bombers | The shared waves' own. |

## The stretches

- **Danger: the late third, the east**, where the north-east cove and the south cove face each other across the lane by the delivery end and the boats come from both sides: 47% of the hull damage in waves 1–9 (the usual Armory's record report; 44–47% for the other player Armories; before: the middle, 41%).
- **Safe: the early third, the west**, the way in, under the far silo's long flight and behind the north-west cove: 19% (21–24% for the other Armories; 25% with none; before: 25%, flagged for two Armories).
- **The middle** (36%) takes the north-middle cove's boats and fire ships at the ship halfway along.
- Rule `m-carrier`: the danger stretch is not the carrier's closest (the carrier sits at (700, 722), under the middle). The waves' first stakes are in the east (wave 3), and from wave 5 every encounter puts something there; the west gets wave 1's long-run boats, wave 6's boat and the shells at the ships coming in.

## The convoy

The map's own convoy at the campaign's schedule (`MAP_CONVOY.coves`: flow 1, Pairs), no command (rule `m-convoy`: the boats are answered by shooting, not by sailing), as every chapter 3 map. Before the rebuild the card played today's convoy controls, where the bot sailed a Box (armour: a ram does one hit, not two) at a higher flow and won 65%; on Pairs the same shared waves won 6%, so the rebuild's waves give up shells and missiles for drones (below). A Box as the map's own shape was tried (rule `m-shape-convoy`): shells and clusters rip through it (splash ×1.8) and the bot won 29% on the shared waves; Pairs it is. A question for the player.

## The signature: fire ships

The player's round 9: each map gets a threat of its own in waves 4–10, tied to its identity and its boss. The Coves' identity is the boats out of the coves; its boss is the Fire Fleet. The signature (`MAP_SIGNATURE.coves`, `fireShips` from wave 4):

- **So many of the wave's own fast boats come out of the coves as fire ships** (1 a wave on waves 4, 5 and 7–9, none on 6, 2 on 10, each in place of one of the wave's own boats left after its encounter took its own: the wave sends no more, rule `w-budget`), the coves in turn, each spread over the wave and its cove lit first;
- **a fire ship** (`FIRESHIP`) is a fast boat set alight: **three hits** (a boat's two, plus one), at 0.8 of a boat's speed, drawn burning with a dashed orange ring the size of the fire it leaves;
- **sunk, it bursts into a fireball where it went down; ramming, it does one hit and bursts there**: an Incendiary Missile's fire (75 px), burning 2.5 s, a hit to a hull 0.7 s after it sails in (about one hit to each ship that passes through). The Nuke puts it out, as an Incendiary Missile's.

The encounters add their own (`fire` on a beat): wave 4's out of the north-middle cove, wave 7's out of the north-east cove, wave 8's out of the north-middle, wave 10's two out of the facing coves.

Not the wave's new enemies (as the Rigs' relief rigs were): chapter 4's four new enemies debut here on waves 2–5, and the signature leaves them alone.

How much of waves 4–10 it is (`tools/v3/combo-sweep/mixwaves.ts`, 8 seeds, the "you" bot drafting for itself, tough; on the build before wave 6's last change):

| | Waves 4–10 | Waves 6–10 | Boss rounds |
| --- | --- | --- | --- |
| Share of the threats that show | 4% | 4% | 75% |
| Share of the hits it takes to clear them | **7%** | 7% | 82% |

Under the asked quarter, as on the Rigs (9%) and the Sowers (19%). With the plain boats (the map's mechanic) a boat of some kind is 11% of what shows in waves 4–10; the rest is mostly drones (67%), which is what kept the waves in the band. A fire ship more a wave (the first build, with one on wave 6 and two on waves 9–10) lifted the climb into a cliff on wave 6. A question for the player.

## The counters

- **Counter kit: Orbital Strike, Frigate Escort, Gunship Pair.** A boat is out of its cove and at a ship in two seconds, usually while the finger is on a drone or a shell: weapons that fire on their own catch it as it leaves the cove mouth, where a fire ship's fire does no harm.
- **Off-counter kit: Tesla Arc, Full Steam, Seeker.** The Tesla's chain wants strings of small things, not lone boats; Full Steam sails the convoy past the coves faster but not out of their reach; Seekers chase what is in the air, not on the water.
- Both chosen from the combo sweep's singles at log v53 (Orbital Strike 6.4, Frigate 6.5, Gunship Pair 7.0; Tesla 9.2, Full Steam 9.5, Seeker 10.0), avoiding the Air Strike (in four of the map's five best kits). Every weapon is in chapter 4's draft. A design note for the bots only: nothing in the game nudges the player towards it.

How they compare: the record reports (24 seeds, the kit as the bot's taste), below.

## Loadouts on this map (combo sweep singles)

Each weapon alone, forced at every draft (12 seeds, the player's usual Armory, version 53; `npm run v3:combo-sweep -- --stage=singles --maps=coves --out=tools/v3/combo-sweep/results/v53-ch4`). Ships lost over all 13 waves:

- **Strong:** **Orbital Strike 6.4**, Air Strike and Frigate Escort 6.5, Gunship Pair 7.0, Boomerang, Scattergun and the Wild Card 7.2.
- **Middling:** Flak and Thermobaric 7.5, Point Defense 7.6, Shrapnel and Gravity Well 7.8, Overdrive 8.1, Drone Screen, Bomber Wing and the Cadence Gun 8.2, Shield 8.4, Railgun 8.9.
- **Weak:** Supply Run alone 9.0, Tesla 9.2, Full Steam 9.5, Seeker 10.0, the plain gun 10.7, Focus Fire, Grapnel and the Charge Lance 13.0, Dual Wield 14.0, the Laser Cutter (it only cuts) 49.3. The bot drafting for itself: 7.5 (won 58%).

## Diversity: are the Coves' best kits their own?

Swept the chapter 2 way (singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16), and compared with the five chapter 2 maps and the five chapter 3 maps from their last sweeps (`docs/design/v3-combo-diversity.md`, "The Coves"; `python3 tools/v3/coves/compare.py`).

| | Result |
| --- | --- |
| Top 5 kits | **Air Strike + Flak Cannon + Gravity Well** 6.1 (won 81%), Air Strike + Shrapnel Shell + Flak Cannon 6.4, Air Strike + Flak Cannon + Orbital Strike 6.5, Air Strike + Flak Cannon + Point Defense 6.8, Shrapnel Shell + Thermobaric Shell + Orbital Strike 7.3 |
| Jaccard of the top-5 kits, against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers / Rigs / Black Strait / Dreadnought | **0 / 0 / 0 / 0 / 0 / 0 / 0 / 0 / 0 / 0** |
| The same, the Coves against itself (two halves of its seeds) | 0.43 |
| #1 kit | in no other rebuilt map's top 5 |
| Best weapon alone | **Orbital Strike** 6.4 (the best single on no other rebuilt map) |
| Rank correlation of the weapons alone, against the same ten | 0.65 / 0.81 / 0.56 / 0.72 / 0.62 / 0.71 / 0.53 / 0.74 / 0.83 / 0.58 |
| Air Strike | 2nd of 27 alone (6.5); **in four of the five best kits**, never the best alone |

- **All five of the Coves' best kits are its own**, and its best weapon alone is its own: the Orbital Strike.
- **Air Strike + Flak Cannon is the core of four of the five best kits.** Air Strike is not the #1 weapon alone, but it is the most common partner here. A question for the player (below).
- The pairs and kits were swept on the build just before the last change (wave 6 without its signature fire ship, two drones fewer); the singles on the final build's predecessor too.

## Debuts: "New on Open War"

The Coves are chapter 4's first map, so the wave planner brings the chapter's four new enemies in here, one a wave as the lead of each wave's new enemies (`mapDebut`, `planFoes`; unchanged, as on the Battery for chapter 3): the **Repair Ship** on wave 2 (it sails in with a heavy cruise missile to mend), the **Bodyguard Ring** on wave 3 (guard drones round a heavy), the **Lure Beacon** on wave 4 and the **Incendiary Missile** on wave 5. Each announces its chapter the first time it shows (rule `m-debut-tag`, `foeDebutTag`): "New on Open War: Repair Ship"; on the Test Lab card always, on the map that debuts it (`mapDebutsFoe`; `tests/v3/encounters.test.ts` checks all four). The fast boat is the map's own threat, from its wave 1 ("NEW: Fast attack boat", a chapter 4 kind by the map that first sends it). The encounters bring none of the new enemies and nothing from a later chapter, and the rebuild leaves the planner's draws alone (the signature takes the wave's boats, not its new enemies).

**Not built: light debut waves.** The Repair Ship's and the Bodyguard's heavies sink a ship outright when they land (most of waves 2–3's losses: 0.2 a run on wave 2 with the usual Armory). They are the chapter's own enemies as the campaign plans them; the encounters keep waves 2–3 light round them instead (two or three boats on a long run, the far silo's drones).

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated, with filler on waves 1–6 (strings of two or three drones out of the far north-west silo, the map's only drone launcher, a long flight). From wave 5 most of the shells the shared waves would send come as drones (`replaces.ballistic` at the table's, drone beats in their place), from wave 6 their clusters, and from wave 7 their guided missiles too; the encounters' own fast boats are the wave's own (`replaces.extras.fastboat`), and their fire ships are some of them. `COVES_CLIMB` sends 0–15% less on waves 2–10 than the shared wave (5% more on wave 5), within ±15% (rule `w-budget`). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | White wake (`coves-white-wake`) | north-east cove, a boat, then another; far silo, 3 drones | the ships coming in (a long run west); the lead ship |
| 2 | teach | Cove by cove (`coves-cove-by-cove`) | north-west cove, a boat; north-east cove, a boat; far silo, a shell and 3 drones | the lead ship (from behind), the ships coming in (from ahead); halfway along |
| 3 | teach | The south cove (`coves-south-cove`) | north-east cove, a boat; south cove, a boat, then another; north-middle silo, a guided missile; 5 drones in place of the shells | the lead ship; halfway along and the ships coming in (from the ships' own side) |
| 4 | combine | Fire ship (`coves-fire-ship`) | north-middle cove, **a fire ship**; north-east silo, a cluster; 10 drones | halfway along; the lead ship |
| 5 | combine | Both ends (`coves-two-ends`) | far silo, 2 shells; north-east and south coves, a boat each; 10 drones | the ships coming in (the shells); the lead ship and halfway along (the boats) |
| 6 | combine | Periscope by the cove (`coves-periscope`) | a sub off the north-east cove, 2 shells; north-west cove, a boat; 17 drones | halfway along (the salvo, lobbed back up the lane); the ships coming in |
| 7 | escalate | Fire from both shores (`coves-crossfire`) | north-east silo, a cluster; **a fire ship** out of the north-east cove and a boat out of the south cove; 28 drones | halfway along; the lead ship from both sides |
| 8 | escalate | The whole north shore (`coves-north-shore`) | all three north coves at once: a boat, **a fire ship** (the middle), a boat; south-east shore, a guided missile; 26 drones | the ship by the middle cove; the lead ship and the ships coming in |
| 9 | escalate | Face to face (`coves-facing`) | north-east and south coves, a boat each at the ships between them, then one each down the lane; far silo, 2 shells; 20 drones | the ships between the facing coves; the ships coming in |
| 10 | climax | Every cove (`coves-every-cove`), after the wave's own fire and a 6 s calm | all four coves at once: **fire ships** out of the north-east and south coves, boats out of the others; north-middle silo, a guided missile; 35 drones | the ships by each cove; the lead ship |

Wave 1 loses 0.01 ships a run with every Armory (192 seeds, normal; 0.03 with none): its two boats come out of the north-east cove on a long run west at the ships coming in, with a white wake to see, and a ship sunk on wave 1 is a rare one already hit by the drones.

**Wave 10, the climax:** after a 6 s calm, every cove empties at once, two of them fire ships; the hardest regular wave for every player Armory (192 seeds, normal: 0.74 usual, 0.97 latest, 0.72 plating; tough 1.27, 2.07, 1.34), and no step to it doubles the wave before.

## The boss plan: the Fire Fleet

The Coves' event was the Repair Yard: a tough drone mothership and three Repair Ships sailing in from three sides to meet on its course, and two swarms of five, every round; it barely touched the bot (0.02–0.03 ships a round). The Repair Ship debuts in the Coves' own wave 2 and comes back as a regular, so the player has met it as a regular threat; the boss under encounter rev 4 is new (`COVES_BOSS_ROUNDS`, lab only; the event's id stays `repair-yard`, as the Rigs' Rig Barrage kept the Dive Circus's): **the Fire Fleet**. Each round sends **sorties of fire ships, one out of every cove listed at once**, the cove mouths lit first (1.5–2 s), all at the one ship nearest halfway along, so the burning boats converge on the clustered convoy from the coves along the shore; what is sunk far out burns off the lane, what reaches the convoy burns in it.

| Round | Coves | Sorties | Apart | Fire ships | Added |
| --- | --- | --- | --- | --- | --- |
| before (every round) | a mothership (16 hits) and 3 Repair Ships, 2 swarms of 5 | – | – | – | – |
| 1 | north-middle, north-east | 2 | 7 s | 4 | 2 boats out of the north-west cove at the ship halfway along; a guided missile off the south-east shore |
| 2 | north-west, north-middle, north-east | 2 | 7 s | 6 | 2 boats out of the south cove at the ships coming in; a guided missile |
| 3 | all four (the south cove too) | 2 | 11 s | 8 | – |

The intro is the shared cards (log v30): "Boss round", "Convoy restored", "The boss: Fire Fleet", "Round 1 of 3", then "Round 2 of 3" and "Round 3 of 3". Each round lasts 15–30 s (test, seed 219).

The map's whole question is in it: where do you stop a fire ship? Every one sunk at the cove mouth is fire off the lane; every one that reaches the convoy is fire in it.

How it reads (192 seeds, normal runs that reached it):

| Armory | Before r1 / r2 / r3 | After r1 / r2 / r3 |
| --- | --- | --- |
| usual | 0.02 / 0.03 / 0.03 | **0.60 / 1.33 / 2.26** |
| latest | 0.10 / 0.10 / 0.19 (21 runs reached it) | **1.11 / 1.91 / 2.06** (70, 70, 66) |
| plating | 0.00 / 0.03 / 0.01 | **0.42 / 0.90 / 1.21** |

Rising with every Armory. Round 3 is near the asked 2.5 for the usual Armory; rounds 1–2 are under the asked 1.5 / 2, as on every rebuilt map: the convoy is restored before the boss and the loss limit is six, so 1.5 / 2 / 2.5 would end most runs that reach it (an earlier build at 0.78 / 1.51 / 2.28 won 52%). Tough runs (every seed plays every round): usual 0.65 / 1.39 / 2.44, latest 1.01 / 1.92 / 2.32, plating 0.41 / 0.92 / 1.24.

## Bot results, before and after

"Before" is the map card as it was (log v52's base build, #214 + the chapter 3 merges): today's convoy controls, no encounters, the Repair Yard (`tools/v3/map-report/results/coves-before*.md`, 24 seeds; and 192 seeds read on a clean copy of the base build). "After" is this build. The reads are 192 seeds (900–1091), the record reports' bot and setup (`tools/v3/coves/final.sh`).

### The headline (192 seeds, normal runs)

| Armory | Won before → after | Waves 1–5 lost | Waves 1–10 lost | Wave 8 | Wave 10 |
| --- | --- | --- | --- | --- | --- |
| **usual** (Quick Reload 5, Damage Control 4, Stockpile 5) | 65% → **57%** | 0.38 → **0.91** | 3.76 → 3.80 | 0.85 → 0.47 | 1.25 → 0.74 |
| latest (Wide Warhead 5, Point Defense 4, Supply Lines 3) | 9% → **22%** | 1.08 → **1.55** | 5.60 → 5.14 | 1.94 → 0.89 | 1.77 → 0.97 |
| plating (Quick Reload 5, Armor Plating 5, Big Magazine 4) | 55% → **77%** | 0.35 → **0.62** | 3.77 → 3.07 | 0.95 → 0.44 | 1.19 → 0.72 |
| none | 1% → 1% | 1.94 → 2.97 | 5.30 → 5.73 | 2.02 → 1.44 | 0.50 → 1.63 |

Normal-run curves, waves 1–10 then the boss rounds (runs that reached each):

| Armory | Before | After |
| --- | --- | --- |
| usual | .01 .14 .13 .03 .07 .55 .31 .85 .76 1.25 · boss .02 .03 .03 | .01 .22 .19 .17 .32 .73 .66 .47 .66 .74 · boss .60 1.33 2.26 |
| latest | .01 .26 .22 .13 .48 1.30 .88 1.94 1.75 1.77 · boss .10 .10 .19 | .01 .42 .18 .39 .58 1.01 .84 .89 1.02 .97 · boss 1.11 1.91 2.06 |
| plating | .00 .07 .09 .05 .14 .52 .41 .95 .87 1.19 · boss .00 .03 .01 | .01 .10 .12 .12 .28 .42 .53 .44 .55 .72 · boss .42 .90 1.21 |

Tough-run curves (every seed plays every wave; the cliff check), 192 seeds. Before: usual .01 .14 .13 .03 .07 .55 .32 1.11 .92 1.80 (wave 6 ×2.2, wave 8 ×3.5 the wave before, a wave under 0.25 counting as 0.25); latest .01 .26 .22 .18 .59 1.83 1.60 3.85 4.59 6.09; plating .00 .07 .09 .05 .14 .53 .53 1.21 1.27 2.37. After: usual .01 .22 .19 .21 .36 .83 .93 .71 .93 1.27; latest .01 .42 .18 .43 .65 1.24 1.29 1.31 1.41 2.07; plating .01 .10 .12 .12 .31 .44 .74 .64 .77 1.34. **The largest step: 2.3× on wave 6 for the usual Armory (0.36 → 0.83), over the line**; latest 1.9× (wave 6), plating 1.7× (waves 7 and 10). Before, three waves doubled for the usual set and the latest set's wave 8 was ×2.4.

### The record reports (24 seeds, 900–923)

| | Before latest / plating / usual / none | After latest / plating / usual / none |
| --- | --- | --- |
| Won (normal) | 4% / 54% (192-seed read) / 83% / 0% | 8% / **83% / 67%** / 4% |
| Waves 1–5 lost (normal) | 0.88 / 0.46 / 0.08 / 1.13 | 1.00 / 0.46 / 0.75 / 2.08 |
| Boss r1 / r2 / r3 (normal, reached) | nothing (0–0.2 a round) | 1.14 / 2.57 / 2.00 (7, 7, 6); 0.30 / 0.95 / 1.10 (20); 0.65 / 1.45 / 2.05 (20); – |
| `w-cliff` (tough) | FLAG (w6, w8) for every Armory but plating (w8, w10) | FLAG (w6: 0.17 → 0.83); **PASS**; **PASS**; FLAG (w5, w6): 24 seeds; on 192 seeds wave 6 is 2.3× wave 5 for the usual set (above) |
| `w-early` close calls from wave 3 | PASS | FLAG (0.96 on w3); FLAG (0.83 on w3); PASS; PASS |
| `w-budget` ±15% | PASS | **PASS** (furthest ×0.86–0.91, wave 9) |
| `m-stretches` | PASS / FLAG (cold early 27%) / PASS / FLAG: hot middle 38–43% | **PASS: hot late 44–47%, cold early 19–24%**; none: hot middle 39%, early 25% |
| `g-warning` | PASS: 6.4 → 4.5–4.7 s | PASS: 7.7 → 6.3–6.4 s |
| `w-first` | PASS | PASS |
| Kits (counter / off-counter): won, lost in waves 1–10 (tough) | – | latest 25% / 13%, 6.9 / 7.2; plating 92% / 88%, 3.2 / 3.8; usual 54% / 54%, 4.5 / 4.8; none 0% / 4%, 14.5 / 15.2 |

The 24-seed record and the 192-seed reads disagree by up to 14 points on a win rate here (latest: 8% against 22%; usual 67% against 57%); the larger read is the one to trust.

**Busier early waves** (the usual Armory's record): threats on the board at a moment 2.0, 2.2, 1.9 on waves 1–3 (before 1.4, 1.6, 1.8), kills a minute 52, 42, 50 (before 38, 36, 46).

**The counters** (rule `m-kits`): the counter kit does better than the off-counter with every Armory on the tough runs (0.3–0.7 fewer ships lost in waves 1–10) and wins more with the latest (25% / 13%) and plating sets (92% / 88%), the same with the usual set (54%); not clearly better on 24 seeds. Neither is trivial.

### Coves difficulty (rule `m-difficulty`; the brief: win 50–70%, waves 1–5 0.4–0.8)

- **The usual Armory wins 57%**, in the band (before 65%, but a flat map with a wave-10 wall and no boss, on today's convoy controls). **The latest set 22%**, under it (before 9%); **the plating set 77%**, over it, as on every chapter 3 map: no single tuning puts the three in 50–70% together. Chapter 4's band is "3–4 tries" for the player (rule `m-difficulty`).
- **Waves 1–5:** 0.91 for the usual Armory (over the asked 0.8; before 0.38), the plating set 0.62, the latest 1.55. Most of waves 2–3's is the debuts' heavies (the Repair Ship's, the Bodyguard's): 0.2 of a ship a run on wave 2.
- **The climb from wave 4 to 9** rises for the usual Armory to wave 6 (.17 .32 .73), then holds at about 0.5–0.7 (.66 .47 .66) to wave 10's 0.74; on the tough runs .21 .36 .83 .93 .71 .93, then 1.27.
- **Wave 10** is the hardest regular wave for the usual and plating Armories, and no step to it doubles.
- **Busier early waves:** see the record reports' threats on the board and kills a minute.

## What is not satisfied, or uncertain

- **The convoy change.** The card played today's convoy controls before, where the bot sails a Box (a ram does one hit, not two) at a higher flow and won 65% on the shared waves; on the map's own convoy (Pairs, the campaign's schedule, as every rebuilt map) the same waves won 6%. The rebuild's waves give up most of their shells (from wave 5), clusters (from 6) and guided missiles (from 7) for drones to come back into the band: late waves are mostly drones (67% of what shows in waves 4–10), as on the Rigs (72%).
- **Waves 1–5 lose 0.91 for the usual Armory**, over the asked 0.4–0.8, most of it the debuts' heavies on waves 2–3 (the Repair Ship sails in with a heavy, the Bodyguard Ring guards one), which the rebuild leaves as the campaign plans them.
- **The cliff check: wave 6 is 2.3× wave 5 on 192 tough seeds** for the usual Armory, over the line (wave 6 is where the shared waves bring the first bomber, the first mothership and two new enemies at once, and where the climb is already at its floor, ×0.88, after the budget check); latest (1.9×) and plating (1.7×) pass. Sensitive: wave 5 5% fuller moved it to 0.59 and wave 6's step to 1.4×, but wave 5's own step from wave 4 to 2.4×. The next build's lever: a lighter debut on wave 6 (the shared wave's two new enemies), not more fire on wave 5.
- **The signature is 7% of the hits in waves 4–10**, under the asked quarter (the Rigs 9%, the Sowers 19%). Each fire ship more a wave cost the climb its shape (a cliff on wave 6).
- **Air Strike + Flak Cannon is in four of the five best kits** (all five are the Coves' own; its best weapon alone, the Orbital Strike, is its own). Nothing changed for it.
- **Close calls from wave 3** (`w-early`) flag for the latest and plating sets on 24 seeds (0.96 and 0.83 a run on wave 3, against ≥ 1): wave 3's boats come from the facing coves 2.5 s apart, and those Armories catch them.
- **Fire ships' losses are blamed on the Incendiary Missile** in the logs and the end screen's "what sank you" (the fire is its fireball, `cloud`), so "Incendiary fire did the most damage" can mean the fire ships on this map.
- **The 24-seed records and the 192-seed reads disagree** by several points on a win rate; the larger read is the one to trust.
- **The pairs and kits of the diversity sweep** were played on the build before the last change (wave 6's signature fire ship and two drones); the singles on that build too.

## The play log (v56)

`LOG_VERSION` 56, `LOG_REPLAYS` `[56]` (`src/v3/sim/playlog.ts`). The change is lab only, under the encounter layer: the campaign plays as at 55, and a 55 Coves card log played today's convoy controls and the shared waves (it no longer replays to the same game). The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 56 (`python3 tools/v3/playtest-fixes/pins.py 52 53`, then, after merging round 15's v55, `pins.py 55 56`, and `tests/v3/scorecard.test.ts`). The Test Lab's "Ready to test" lists the Coves at v56. The combo sweep's results are in `tools/v3/combo-sweep/results/v53-ch4` (swept as v53, the same game as v56 on this map).

## Questions for the player

- **Do the fire ships read, and is "stop it at the cove mouth" the question you feel?** A fire ship burns on its deck and carries a dashed orange ring the size of the fire it leaves; sunk there, the fire stays there. Recommended: play waves 4, 8 and the boss; if the ring reads as clutter on the phone, drop it and keep the flames.
- **The boss: the Fire Fleet, a new boss on the Repair Yard's slot.** The Repair Ship debuts in the Coves' own wave 2, so the boss is fire ships out of the coves at once, converging on the convoy. Recommended: keep the name "Fire Fleet"; say if you would rather it kept "Repair Yard" and its repair ships.
- **The convoy: Pairs at the campaign's schedule, no Box.** Before, today's controls let a Box take a hit less from every ram, and the bot won 65%; as every rebuilt map, the Coves now sail the map's own convoy. Recommended: keep it; a Box as the map's shape was tried and shells rip through it.
- **Air Strike + Flak Cannon in four of the five best kits.** Recommended: leave it for your play; if it feels like the answer, the next build can make the boats come in ones and twos further apart (less for a flak cloud to catch).
- **The signature is 7% of the hits in waves 4–10, not 25%: raise it?** Recommended: keep it; the boats (the mechanic) are in every wave already, and a fire ship more a wave made a cliff.
- **The two Armories again:** the latest set wins 25%, the plating set 82%. Recommended: leave it, as on chapter 3's maps; it is the Armory, not the map.

## Checks run

`tsc`; `vitest --exclude '.claude/**'` (80 files, 1893 tests, all pass, on the build before the last wave 6–7 budget fix; the budget test re-run after it); `vite build`, then `vite preview` and the e2e scripts `v3-encounters.mjs`, `v3-map-cards.mjs`, `v3-map-lab.mjs`, `v3-convoy.mjs`, `v3.mjs` (all pass; run on the build before the wave 6–7 drone counts, which no e2e check reads); the map-lab baseline replays exactly.

## Tests

- `tests/v3/encounters.test.ts`:
  - the ten listed, rev 4, v1 only, none at rev 3; `REBUILT_MAPS` has the Coves, and `CHAPTER_FOUR_MAPS` is `['coves']`;
  - the budget (an encounter's boats come out of the wave's own, one for one: its books count them), legality, warning and replay checks cover the map;
  - the mechanic is in the waves: a beat out of a cove in every wave 1–10, the south cove's in waves 3, 5, 7, 9 and 10, fire ships in waves 4, 7, 8 and 10, and only the Coves' boats out of a cove are ever fire ships;
  - the signature: from wave 4 so many of the wave's own boats come out of the coves as fire ships, none before wave 4, before rev 4 or on the shared wave, and the campaign keeps plain boats;
  - a fire ship takes `FIRESHIP.hp` hits; sunk, it burns where it went down (`FIRESHIP.burn`); the Nuke puts it out; a plain boat leaves no fire; ramming, it does `FIRESHIP.ram` and burns there;
  - the Fire Fleet's rounds: no mothership and no Repair Ship, so many fire ships a round as its coves and sorties (and its boat packs), more coves each round and more fire ships, every cove a cove, each sortie lit first; a rev 3 log and the campaign play the Repair Yard and nothing else; 15–30 s a round; the boss's name "Fire Fleet" under the layer, "Repair Yard" before it;
  - chapter 4's four new enemies debut on the Coves, each "New on Open War", and no encounter brings a new enemy;
  - the filler: waves 1–6.
- `tests/v3/mapRules.test.ts`: no repeats and no gaps; `MAP_PLANS` complete; the boss target is 2; the notes name the coves the boats come out of.
- `tests/v3/mapCards.test.ts`, `round11.test.ts`, `convoy.test.ts`: the production setup is policy D with the encounters, no command, at the campaign's schedule ("The map's own convoy (no commands) · encounters v1 Original"). `tests/v3/round12fixes.test.ts`: wave 1 opens with two boats and three drones, and loses no ship (seeds 11–13, "you" and casual).
- `tests/v3/readyToTest.test.ts`: the new entry. `tests/v3/scorecard.test.ts`: the log is version 56.
- `e2e/v3-map-cards.mjs`: the hub card says so. `e2e/v3-encounters.mjs`: the card opens with its encounters and no command, the pause screen's script names the Fire Fleet and the first fire ship, and skipped to the boss, fire ships come out of the coves at once (a shot at one pixel a point: `e2e/shots/v3-encounters/coves-boss.png`).

## What to look for when you play

Open War starts here. Four smugglers' coves hide fast boats two seconds from your ships: three in the enemy's shore, one in your own by the delivery end. Each boat takes two hits and rams a ship for two; watch the coves for a white wake. From wave 4 some come out as fire ships, burning: three hits, and wherever one is sunk, or rams, it leaves a fire on the water that burns the ships sailing through it. Chapter 4's new enemies debut on waves 2–5. In the boss rounds every cove sends fire ships at once, more coves each round. The questions: can you read a fire ship and its ring on the phone, does stopping it at the cove mouth feel like the answer, and do the three boss rounds rise?

(This section names no weapon to try: the counter kit above is a design note for the bots, never shown in the game or on the hub.)
