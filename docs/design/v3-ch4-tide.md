# Tidewater Flats: map card (map rebuild, chapter 4)

**Date:** 2026-11-22. Tidewater Flats (`tide`, "The Tide", chapter 4 "Open War", the 19th map) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), the way the Coves (`docs/design/v3-ch4-coves.md`, #222) and the Delta (`docs/design/v3-ch4-delta.md`, #223) were. Encounter rev 4; play log **v61** (built as 59 alongside Dunmar Crossing, 58, and the Citadel, 60, which shipped first).

There is no player run of the Tide to start from. The starting point is the map as it was (the Test Lab card: today's convoy controls, the shared waves, the Firestorm as its boss) and what the player asked of every rebuild: a question of its own and kits of its own, busier early waves ("more drones and easy things to kill", "less is more"), the climb from wave 4 to 9, no single-wave cliff, wave 10 the climax and not a wall, big and distinct boss set pieces, readable on an iPhone in landscape (874×402), anything that can sink a ship warned.

As it was (192 seeds, the usual Armory), the Tide was the hardest map of the chapter for the bot: won 16% (the latest set 0%, plating 4%), and its boss, the Firestorm, the hardest round of any map (2.65 ships in round 1). Its tide ran on its own clock across the waves (25 s high, 20 s low), unrelated to anything a wave did, and on the old card it was a hint for the flow slider ("push the ship-flow slider up at high tide").

Code:
- `src/v3/data/encounters.ts`: `TIDE_R4` (ten encounters), `TIDE_EBB` and `TIDE_LOW` (each wave's ebb and low water), `MAP_TIDE` and `tideClock` (the tide's clock a wave, under the layer), `swapIn` (the shells and missiles a wave gives up, as drone strings at the flats), the filler for waves 1–6 (`BUSY`), `TIDE_CLIMB`, the aims `'crowd'` and `'flats'` (`BeatAim`), `MAP_SIGNATURE.tide` (`ebb`, `ebbBase`: the ebb strike), `MAP_FOE_SWAP.tide` (the Repair Ship and the Bodyguard Ring as Lure Beacons), `TIDE_BOSS_ROUNDS` and `MAP_BOSS.tide` (a boss round's `ebb` and `strikes`; the boss's name, Low Water), `CHAPTER_FOUR_MAPS` (the Tide joins the Coves and the Delta);
- `src/v3/sim/tide.ts` (new): `tideAt` (the tide's phase, falling and rising over `TIDE_TURN`, and the water level), `flatsBand`, `sandEdge`;
- `src/v3/sim/game.ts`: Game `ebb` (the wave's low water), `highTide` and `tideNow` (read `tideAt`), `leaveFlats` and Ship `cross` (the ships on the flats cross to the deep channel as the tide falls); `aimBeat` takes `'crowd'` (`crowdShip`, `CROWD_RADIUS`: a ship of the most bunched hulls, each launch a different one of them by its id) and `'flats'` (`flatsShip`); the wave planner holds the signature's clusters for the ebb; Threat `ebb` (launched at the crowd; for the tools' counts);
- `src/v3/sim/events.ts`: the Firestorm under the Tide's boss tuning is Low Water (`lowWater`: the round's own tide, the strikes' silos lit, then the strikes); with no boss tuning it plays as it did;
- `src/v3/sim/telemetry.ts`, `src/v3/ui/render.ts`, `src/v3/ui/features.ts`: the tide's env events, the dimmed flats lane and the gauge read the tide's phase; the sand comes up from the shore with a moving surf line; the gauge sits mid-map between the lanes, larger (28 px; 36 px in gold, "THE TIDE TURNS" and "TIDE GOING OUT");
- `src/v3/data/convoy.ts`: `MAP_CONVOY.tide` (flow step 2, the Box, no command); `src/v3/data/mapPlans.ts`: `MAP_PLANS.tide`; `src/v3/data/lab.ts`: "Ready to test" lists the Tide at v61; `src/v3/sim/playlog.ts`: `LOG_VERSION` 61;
- tools: `tools/v3/tide/` (`readall.sh` and `final.sh`: the tuning reads for every Armory, `tools/v3/rigs/read.py` on the Tide; `reports.sh`: the record reports; `waves.ts`: what each wave plans, by kind and aim; `budget.ts`: each wave's launches against the shared wave; `early.ts`: what sinks the ships in the first waves, high or low water; `convoys.sh`: the read with each flow and formation in turn); `tools/v3/combo-sweep/mixwaves.ts` counts the Tide's signature (`ebbStrike`).

Bot reports: `tools/v3/map-report/results/tide-player.md` (the usual Armory: Quick Reload 5, Damage Control 4, Stockpile 5), `tide-latest.md` (Wide Warhead 5, Point Defense 4, Supply Lines 3), `tide-plating.md` (Quick Reload 5, Armor Plating 5, Big Magazine 4), `tide.md` (no Armory); each with a heat map and the counter and off-counter kits. Tuning reads: 192 seeds (900–1091), `tools/v3/tide/final.sh <dir>`. "Before" was read on this branch before any Tide change (the base, #221 + the Coves; the Tide's card then was the base's), on the same seeds; as on the Delta there are no 24-seed "before" report files.

## How it is gated (lab vs campaign)

As every rebuild: **lab only, under the encounter layer.** The Test Lab's map card (`?lab=map-tide`) opens on its production setup, policy D with no command, the map's own convoy and the authored encounters rev 4, because the Tide is in `REBUILT_MAPS` (via `CHAPTER_FOUR_MAPS`). The hub card reads "The map's own convoy (no commands) · encounters v1 Original". Everything new reads the run's encounter setup (`tideClock`, `signatureOf`, `swapFoe`, `bossTune`, an encounter's aim), so the campaign, a run with no layer, a rev 3 log and the shared wave (`only: []`) play the Tide's waves as before: the tide on its own 45 s clock, the shared waves, the planner's own new enemies and the Firestorm. What the campaign shares with the card is the tide's turn itself (below: the tide falls and rises over a few seconds, the ships cross off the flats as it falls, the sand and the gauge are drawn anew), because that is the mechanic, fixed. The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version.

## The problem

> The flats lane out by your carrier floats only at high tide: when the tide goes out, every new ship crowds into the deep channel under the enemy's guns, and the enemy saves its fire for that crowd, so the tide gauge is the clock you defend by.

The tide is the map's one mechanic (rule `m-mechanic`; `data/maps20.ts`): two lanes, the deep channel (y 282) a short flight under the north shore's four silos, and the flats lane (y 575) out by the carrier (800, 748), a long flight from all of them, open only at high water. A new ship takes the lanes in turn at high water and only the deep channel otherwise; as the tide falls the ships on the flats cross to the deep channel (below).

Before the rebuild the tide ran on its own 45 s clock (25 s high, 20 s low) through the waves, unrelated to what a wave sent. Under the layer it keeps **each wave's own clock** (`MAP_TIDE`): the wave opens on high water, the tide goes out once at the wave's ebb (`TIDE_EBB`, a share of the wave: 0.4–0.5, about 14–35 s in) and the flats stay dry for the wave's low water (`TIDE_LOW`: 9 s on wave 1 rising to 20 s on wave 10), then it floods for the rest of the wave. So the ebb is a moment the waves are written round.

The question: **when is the crowd?** At high water the convoy is spread over two lanes, one far from every silo; at low water every new ship bunches in the deep channel, the newest in the west, under the shore. The waves' fire at the crowd comes at low water (rule `g-mechanic`: in every wave 1–10, beats aimed `'crowd'`, each launch going for a ship of the most bunched hulls); at high water they send drones the long way to the flats (aim `'flats'`). The gauge counts down to the ebb (gold, "THE TIDE TURNS", in its last 5 s), and the ebb is when the shells, the clusters and the supersonics come.

How it differs from the other rebuilt maps: there the danger is aimed at a place (an island's side, a lock, the guns, the night's bank), a ship (the tanker), a launcher you can remove (the rigs), hiding places (the coves), or the player's own steering (the Delta); here it is a moment, read on a clock, and it comes at the ships the clock has bunched.

## The tide turning: the ships leave the flats (the player's note)

The player, on the map as it was: "the map didn't have a great tide animation or work well, the ships did not navigate off the low tide area, so just make sure that mechanic actually works".

**What was broken.** The tide snapped from high water to low in one frame (no animation but a tint and a gauge at the screen's right edge, clipped on a phone), and only *new* ships were kept off the flats lane at low water: a ship already on it sailed on across the dry sand to the end of the lane, under fire, for as long as the low water lasted. With the old 25 s / 20 s clock and a 42 s crossing, most of a low water had ships on the sand. A test of the old code (`leaveFlats` switched off) finds hulls on exposed sand within 18 s of wave 1.

**What changed** (`src/v3/sim/tide.ts`, `game.ts` `leaveFlats` / `updateShips`, `ui/features.ts` `drawTide`; the campaign's own clock too, not only the lab):
- **The tide turns over time.** It falls over 4 s before low water and rises over 3 s after it (`TIDE_TURN`); the water level moves smoothly from 1 to 0 and back, never snapping. The flats lane takes new ships only at high water (not while the tide falls, is out, or is still coming in).
- **The ships leave the flats.** The moment the tide starts to fall, every ship on the flats lane crosses to the deep channel at the same distance along, sailing across at 120 px/s (the 290 px between the lanes in under 2.5 s), and takes its place in the deep channel's formation. None freezes or jitters: it keeps sailing east while it crosses.
- **The water's edge moves.** The water leaves the flats from the shore side up towards the deep channel as it falls, and comes back the same way as it rises: the exposed flats are drawn as sand (ribbed, opaque) up to a line of surf that moves with the water; at low water the whole band reads as land. The crossing ships stay ahead of the sand.
- **You see it coming.** The gauge (mid-map between the lanes, 28 px) counts down at high water and turns gold, "THE TIDE TURNS · N s", 5 s before the tide starts to fall; then "TIDE GOING OUT", "LOW TIDE · flats dry", "TIDE COMING IN".

**Proof.**
- `tests/v3/encounters.test.ts` ("Tidewater Flats (log v61)"): every step of whole bot runs (the card's production setup, waves 1–10 and the three boss rounds, seeds 3, 11 and 29; the campaign's own clock, waves 1–6, seeds 5 and 17): no hull, its whole width, ever overlaps exposed sand; no hull is in the flats band at low water; no hull's progress along its lane stalls for 5 s (300 ticks); and in each run the tide fell, was out and rose for many seconds and ships crossed. The same test fails on the old behaviour. A third test checks the water level never changes by more than one step's share of the turn.
- `e2e/v3-encounters.mjs`: wave 1 played through its ebb at the phone's own size, with shots at high water (ships on both lanes), as the tide goes out (a box crossing from the flats, the sand coming up from the shore) and at low water (the flats dry, no ship on them): `e2e/shots/v3-encounters/tide-high.png`, `tide-falling.png`, `tide-low.png` (and `tide-boss.png`).

## Sites and their jobs

Bases and spots are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| West silo (base 1) | (250, 80), over the way in | drones, guided, shells | Drones the long way to the flats (w1, high water) and at the crowd (w4, w6, w7, w9), the swapped drone strings, shells at the crowd (w2, w3, w5, w8, w10), a guided missile at it (w3). |
| Middle silo (base 2) | (650, 75) | heavies, clusters | The ebb strike: every cluster at the crowd (w4, w6–w10; the signature's own from w5), the boss's clusters. |
| East-middle silo (base 3) | (1000, 80) | supersonic, guided | A supersonic at the flats (w4, w7) and at the crowd (w7, w9), a guided missile at the lead ship (w6) and at the crowd (w8, w10). |
| East silo (base 4) | (1400, 80) | drones, motherships, shells | Drones to the flats (w2–w5, w8, w10), the swapped drone strings, a shell at the crowd (w2 at the flats), at the ships coming in (w6), at the crowd (w8 in the boss), the mothership on the long flight (w9). |
| East sub spot (spot 2) | (1500, 392), between the lanes | shells | The flood: a periscope as the ships spread back over the flats (w5). |
| Roads, air, the west spot | the north road, the pop-up roads at 450 and 1200, the edges | trucks, jets, bombers | The shared waves' own. |

## The stretches

From the record reports (24 seeds; `tools/v3/map-report/results/tide-*.md`), waves 1–9:

- **Danger: the late third, the delivery end**, of the deep channel, where the bunched boxes are as the strikes land: 43% of the deep channel's hull damage (the usual Armory; 38–40% for the other Armories), 40% of all lanes'.
- **Safe: the early third, the way in**: 23% of the deep channel's (22–26%), 26% pooled. The flats lane takes 7% of the hull damage at all (5.5 hull points a run against the deep channel's 77), most of it in its first third as ships come in.
- Rule `m-stretches` passes for the three player Armories (no Armory: the deep channel's early third 26%).

Rule `m-carrier`: the carrier (800, 748) sits by the middle of the flats lane, under neither the danger stretch nor the deep channel.

## The convoy

The map's own convoy (rule `m-convoy`, `m-shape-convoy`): **flow step 2 (a group every 4 s) in a Box, no command.** The tide steers the ships; the fire is answered by shooting.

The Box (three tight abreast: a direct hit does a hit less, splash ×1.8) is the map's shape for its problem: drones and a single missile do little to it, while a shell, a cluster's bomblets or a heavy over a bunched box tear through it, so the crowd at low water is the danger and the high water's spread is the relief. Measured with the rebuilt waves (`tools/v3/tide/convoys.sh`, the usual Armory, 48 seeds tough / 96 normal): Pairs at the campaign's step 1 lost 9.9 ships in waves 1–10 (tough) and won 2–10%; the Box at step 1 7.6 and 23%; the Spread 9.7; Pairs at step 2 9.7; the Box at step 2 won 33% (before the last changes to the waves). A question for the player.

## The signature: the ebb strike

The player's round 9: each map gets a threat of its own in waves 4–10, tied to its identity and its boss. The Tide's identity is the ebb; its boss is Low Water. The signature (`MAP_SIGNATURE.tide`, `ebb` from wave 4):

- at each wave's low water, **so many of the wave's own clusters (then its shells, each as a cluster) fly off the middle silo at the crowd** (one a wave on waves 5, 6 and 9; none on 4, 7, 8 and 10, whose encounters already send one: more made a cliff on wave 7), one for one (rule `w-budget`), 3 s into the low water, the silo lit as a raid's;
- with the encounters' own fire at the crowd at the ebb (shells, clusters, guided missiles, supersonics, drones), aimed `'crowd'`.

How much of waves 4–10 it is (`tools/v3/combo-sweep/mixwaves.ts`, 8 seeds, the "you" bot drafting for itself, tough; everything launched at the crowd counts, `ebbStrike`, a cluster's bomblets with it):

| | Waves 4–10 | Waves 6–10 | Boss rounds |
| --- | --- | --- | --- |
| Share of the threats that show | 14% | 14% | 100% |
| Share of the hits it takes to clear them | **12%** | 12% | 100% |

Under the asked quarter, as on the Coves (7%), the Rigs (9%) and the Sowers (19%): the rest is mostly drones (61%), which is what keeps the waves in the band (below).

## The counters

- **Counter kit: Gravity Well, Point Defense, Bomber Wing.** At the ebb everything converges on one bunch of ships in the deep channel: the weapons that hold the sky over one spot answer it. The Well pulls the converging fire into its core, Point Defense guards the bunched boxes, the Bomber Wing lays its run along the crowded channel.
- **Off-counter kit: Tesla Arc, Grapnel, Full Steam.** The Tesla's chain wants long strings, not a short sharp strike from four silos; the Grapnel takes one threat at a time while the strike lands together; Full Steam sails the convoy faster but the tide still bunches it.
- Both chosen from the combo sweep's singles at log v61 (Gravity Well 4.7, Bomber Wing 4.9, Point Defense 5.4; Tesla 10.0, Grapnel 11.8, Full Steam 8.8), avoiding the Air Strike (6.1 alone, 7th). Every weapon is in chapter 4's draft. A design note for the bots only: nothing in the game nudges the player towards it.

How they compare: the record reports (24 seeds, the kit as the bot's taste), below.

## Loadouts on this map (combo sweep singles)

Each weapon alone, forced at every draft (12 seeds, the player's usual Armory, version 59; `npm run v3:combo-sweep -- --stage=singles --maps=tide --out=tools/v3/combo-sweep/results/v59-ch4`). Ships lost over all 13 waves:

- **Strong:** **Gravity Well 4.7**, Bomber Wing 4.9, Point Defense 5.4, Gunship Pair 5.5, Scattergun 6.0, Air Strike and Drone Screen 6.1, Shrapnel Shell 6.3, Orbital Strike 6.4.
- **Middling:** Flak Cannon 6.8, Frigate Escort 7.1, Cadence Gun 7.2, Railgun 7.3, Thermobaric 7.4, Overdrive 7.5, Seeker 7.8, Shield 8.3.
- **Weak:** Full Steam 8.8, Boomerang and the Wild Card 8.8, Supply Run alone 9.3, Tesla 10.0, Focus Fire, Grapnel and the Charge Lance 11.8, Dual Wield 11.9, the plain gun 13.7, the Laser Cutter (it only cuts) 54.3. The bot drafting for itself: 8.9 (won 42%).

## Diversity: are the Tide's best kits its own?

Swept the chapter 2 way (singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16; `tools/v3/tide/sweep.sh`), and compared with the five chapter 2 maps, the five of chapter 3, the Coves and the Delta from their last sweeps (`docs/design/v3-combo-diversity.md`, "Tidewater Flats"; `python3 tools/v3/tide/compare.py`).

| | Result |
| --- | --- |
| Top 5 kits | **Point Defense + Gunship Pair + Bomber Wing** 4.4 (won 94%), Frigate Escort + Flak Cannon + Gravity Well 4.9, Point Defense + Orbital Strike + Supply Run 5.5, Tesla Arc + Orbital Strike + Supply Run 5.8, Frigate Escort + Flak Cannon + Dual Wield 6.2 |
| Jaccard of the top-5 kits, against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers / Rigs / Black Strait / Dreadnought / Coves / Delta | **0** against all twelve |
| The same, the Tide against itself (two halves of its seeds) | 0.43 |
| #1 kit | in no other rebuilt map's top 5 |
| Best weapon alone | **Gravity Well** 4.7 (the best single on no other rebuilt map) |
| Rank correlation of the weapons alone, against the same twelve | 0.75 / 0.87 / 0.54 / 0.68 / 0.54 / 0.69 / 0.46 / 0.60 / 0.63 / 0.62 / 0.67 / 0.60 |
| Air Strike | 6th of 27 alone (6.1); **in none of the five best kits** |

- **All five of the Tide's best kits are its own**, and its best weapon alone is its own: the Gravity Well.
- **No Air Strike + Flak core** (the brief's worry): the map's natural counter is holding the sky over one bunch of ships, and the Air Strike is in none of its best kits.
- The sweep ran on the build just before the final one (waves 5, 6 and 10 send three drones more to the flats).

## Debuts and the chapter's enemies

The Coves debut chapter 4's four new enemies; on the Tide they are regulars, drawn by the wave planner as on any chapter 4 map. Under the layer two of them come as another (`MAP_FOE_SWAP.tide`, as Saltgate sends no Torpedo Sub): **the Repair Ship and the Bodyguard Ring come as Lure Beacons.** Both bring a heavy cruise missile (the Repair Ship sails in to mend one; the Bodyguard's guard drones ring one), and a heavy's direct hit sinks a ship outright: on the Tide's short flights to the deep channel they cost the usual Armory about 0.15 of a ship a wave in waves 3–10 (tough, 24 seeds) and the bot won 33% with them against 45% without (96 seeds, the build before). The Lure Beacon and the Incendiary Missile come as the planner draws them. A question for the player (below). The encounters bring no new enemy and nothing from a later chapter.

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated, with filler on waves 1–6 (strings of two or three drones out of the west and east silos). From wave 2 the shells, guided missiles and clusters the shared waves would send (past the encounter's own) come as drone strings out of the west and east silos at the flats lane (`swapIn`), the planner's own drones partly with them, so the waves' heavy fire is the encounter's, at the crowd at the ebb. `TIDE_CLIMB` sends 10–14% less on waves 2–10 than the shared wave (rule `w-budget`). No call-out names a site.

| Wave | Role | Encounter (`id`) | Low water | At high water | At the ebb (the crowd) |
| --- | --- | --- | --- | --- | --- |
| 1 | teach | The first ebb (`tide-first-ebb`) | 9 s, at the end of the wave | west silo, 3 drones to the flats | east silo, 3 drones the long way |
| 2 | teach | Far over the flats (`tide-far-flats`) | 11 s | east silo, 3 drones to the flats | west silo, a shell; east silo, a shell (to the flats) |
| 3 | teach | Low water (`tide-low-water`) | 13 s | east silo, 3 drones to the flats | west silo, a guided missile, then a shell |
| 4 | combine | Cluster on the crowd (`tide-ebb-cluster`) | 15 s | east-middle silo, a supersonic; drones to the flats | middle silo, a **cluster**; west silo, 4 drones |
| 5 | combine | The flood (`tide-the-flood`) | 16 s | east silo, 4 drones; **at the flood** a sub off the east between the lanes, 2 shells at the ships nearest it | west silo, a shell; east silo, 3 drones; the signature's cluster |
| 6 | combine | Both lanes (`tide-both-lanes`; "Before the ebb and after") | 16 s | east-middle silo, a guided missile at the lead ship; east silo, 2 shells at the ships coming in | middle silo, a cluster; west silo, 5 drones, then a shell; the signature's cluster |
| 7 | escalate | Fast at the ebb (`tide-supersonic-ebb`) | 17 s | east-middle silo, a supersonic to the flats; east silo, drones | middle silo, a cluster; west silo, 5 drones |
| 8 | escalate | The whole shore (`tide-whole-shore`) | 17 s | east silo, 6 drones to the flats | west silo, 2 shells; middle silo, a cluster; east-middle silo, 2 guided missiles |
| 9 | escalate | Before the ebb (`tide-before-ebb`) | 18 s | east silo, a mothership to the flats (the long flight) | middle silo, a cluster; east-middle silo, a supersonic; west silo, 6 drones; the signature's cluster |
| 10 | climax | Spring low (`tide-spring-low`), after a 6 s calm | 20 s | the wave's own | middle silo, a cluster; west silo, 2 shells; east-middle silo, a guided missile; east silo, 6 drones to the flats |

**Wave 10, the climax:** after a 6 s calm the tide runs out for the longest low water of the waves and the whole shore fires at the crowd; the hardest regular wave for the usual and plating Armories (192 seeds, normal: 1.07 usual, 1.09 latest, 0.81 plating; tough 1.52, 2.67, 1.32), and no step to it doubles the wave before (×1.7 usual).

## The boss plan: Low Water

The Tide's event was the Firestorm: six firebombs at once from every side, three more 9 s later, their fires burning 13 s, every round. It was the hardest boss round of any map for the bot (2.65 ships in round 1 with the usual Armory), and its Incendiary Missile is a regular of chapter 4's waves by now (debuted on the Coves' wave 5, the Delta's signature), so the player has met it as a regular threat. The boss under encounter rev 4 is new (`TIDE_BOSS_ROUNDS`, lab only; the event's id stays `firestorm`): **Low Water**. Each round the tide starts to fall as the round opens, is out 2 s in and stays out (`ebb`: 18, 22, then 26 s), the ships on the flats crossing to the deep channel as it falls, every new ship crowds into the deep channel under the shore, and the whole shore fires at the crowd in **strikes**: every silo listed lights at once (2.5 s, a raid's warning), then fires its own at the crowd together, so the shells, clusters, missiles and drones converge on the bunched boxes.

| Round | Low water | Strikes | What each strike fires |
| --- | --- | --- | --- |
| before (every round) | – | – | 6 firebombs from every side, 3 more 9 s later; fires burn 13 s |
| 1 | 18 s | 2 (6, 13 s) | west 2 shells + middle a cluster; east-middle 2 guided + east 2 shells |
| 2 | 22 s | 3 (5, 12, 18 s) | west 2 shells + middle a cluster + east-middle a supersonic; middle a cluster + east 2 shells + west 2 guided + east-middle a supersonic; west 5 drones + middle a cluster + east-middle a guided |
| 3 | 26 s | 3 (5, 13, 20 s) | all four: west 2 shells, middle a cluster, east-middle 2 guided, east a shell; middle a cluster + east-middle a supersonic + west 4 drones; west 2 guided + east 5 drones |

The intro is the shared cards (log v30): "Boss round", "Convoy restored", "The boss: Low Water", "Round 1 of 3", then "Round 2 of 3" and "Round 3 of 3". Each round lasts 15–30 s (test, seed 219). The map's whole question is in it: the tide is out, the ships are bunched, and the shore fires at the bunch.

How it reads (192 seeds, normal runs that reached it):

| Armory | Before r1 / r2 / r3 | After r1 / r2 / r3 |
| --- | --- | --- |
| usual | 2.65 / 1.88 / 1.77 (130, 116, 77 runs) | **0.72 / 1.31 / 2.02** (133, 133, 123) |
| latest | – (no run reached it) | **0.84 / 2.53 / 1.98** (62, 62, 50) |
| plating | 0.38 / 1.23 / 3.31 (13 runs) | **0.30 / 1.19 / 1.40** (145, 145, 144) |

Rising for the usual and plating Armories (the latest set's round 3 is reached by its stronger runs only; tough, every seed plays every round: 0.95 / 3.01 / 3.18). Under the asked 1.5 / 2 / 2.5 for the usual Armory, as on every rebuilt map: the convoy is restored before the boss and the loss limit is six, so the boss's three rounds share one limit; heavier builds (1.27 / 1.57 / 2.65; after the tide fix 0.57 / 2.14 / 2.04) won 31% and 42%. Tough runs: usual 0.77 / 1.37 / 2.19, plating 0.39 / 1.24 / 1.59.

## Bot results, before and after

"Before" is the map card as it was (the base's: today's convoy controls, no encounters, the tide on its own clock, the Firestorm), read on this branch before any Tide change. "After" is this build. The reads are 192 seeds (900–1091), the record reports' bot and setup (`tools/v3/tide/final.sh`).

### The headline (192 seeds, normal runs)

The final build (the tide's turn fixed, the retune after it, the base merged with Dunmar Crossing). The usual Armory's read is on the merged build; the other three on the build just before the merge (the Crossing's changes do not touch the Tide: the usual set's read is the same, 51% → 50%, on the same seeds).

| Armory | Won before → after | Waves 1–5 lost | Waves 1–10 lost | Wave 8 | Wave 10 |
| --- | --- | --- | --- | --- | --- |
| **usual** (Quick Reload 5, Damage Control 4, Stockpile 5) | 16% → **50%** | 0.59 → **0.87** | 4.16 → 3.46 | 0.74 → 0.56 | 1.30 → 1.07 |
| latest (Wide Warhead 5, Point Defense 4, Supply Lines 3) | 0% → **15%** | 3.43 → **1.76** | 5.98 → 5.17 | 2.07 → 1.19 | 1.00 (1 run) → 1.09 |
| plating (Quick Reload 5, Armor Plating 5, Big Magazine 4) | 4% → **68%** | 1.68 → **0.76** | 5.75 → 3.11 | 1.77 → 0.42 | 1.28 → 0.81 |
| none | 0% → 1% | 5.09 → 2.90 | 5.91 → 5.92 | 1.50 → 1.53 | – → 1.37 |

Normal-run curves, waves 1–10 then the boss rounds (runs that reached each):

| Armory | Before | After |
| --- | --- | --- |
| usual | .01 .01 .24 .22 .10 .40 .47 .74 1.00 1.30 · boss 2.65 1.88 1.77 | .03 .03 .39 .05 .38 .35 .47 .56 .51 1.07 · boss .72 1.31 2.02 |
| latest | .03 .21 1.20 .77 1.42 1.67 1.62 2.07 1.67 1.00 · boss – | .02 .22 .58 .24 .75 .99 .48 1.19 1.29 1.09 · boss .84 2.53 1.98 |
| plating | .02 .07 .46 .42 .73 1.09 1.16 1.77 1.25 1.28 · boss .38 1.23 3.31 | .02 .05 .26 .15 .29 .52 .39 .42 .46 .81 · boss .30 1.19 1.40 |

Tough-run curves (every seed plays every wave; the cliff check), 192 seeds. Before: usual .07 .11 .96 .60 1.33 2.12 2.44 4.44 3.91 5.54 (21.5 ships in waves 1–10); latest .05 .18 1.55 .95 1.10 2.17 1.89 2.83 3.67 4.95; plating .03 .05 .49 .45 .43 .89 .85 1.53 1.51 3.47; none .16 .40 2.38 1.90 1.41 3.81 3.39 3.64 5.64 6.16 (28.9). After: usual .03 .03 .39 .07 .40 .48 .52 .78 .90 1.52 (5.10); latest .02 .22 .61 .35 .95 1.62 .84 2.00 2.33 2.67 (11.6); plating .02 .05 .26 .16 .27 .64 .48 .58 .72 1.32 (4.5); none .05 .20 1.25 .72 1.52 3.12 2.13 3.39 5.09 5.32 (22.8). **The usual Armory's largest step: ×1.7 on wave 10 (0.90 → 1.52), within the line** (wave 3 ×1.6 and wave 5 ×1.6 over the floor of 0.25); plating ×2.4 on wave 6 (0.27 → 0.64), **over the line**; the latest set ×2.4 on wave 8 (0.84 → 2.00), **over the line**.

### The record reports (24 seeds, 900–923)

| | latest / plating / usual / none |
| --- | --- |
| Won (normal) | 13% / 83% / 63% / 0% |
| Waves 1–5 lost (normal) | 1.08 / 0.33 / 0.50 / 2.04 |
| Boss r1 / r2 / r3 (normal, reached) | 1.10 / 2.80 / 1.86 (10, 10, 7); 0.33 / 1.10 / 1.14 (21); 0.71 / 1.06 / 2.31 (17, 17, 16); – |
| `w-cliff` (tough) | FLAG (w3, w6) / FLAG (w8) / **PASS** / FLAG (w3, w5, w6): 24 seeds; on 192 seeds the usual set passes, the latest set doubles on w8, plating on w6 |
| `w-early` close calls from wave 3 | **PASS** for all four (fewest 1.75–2.50 a run, wave 4) |
| `w-budget` ±15% | FLAG on wave 4 (×0.82–0.83) for all four, on the build before wave 4's climb went from ×0.88 to ×0.92 (the final build; the usual set's report re-run on it below) |
| `m-stretches` | **PASS**: hot late 38–43%, cold early 22–24% (deep channel); none: early 26% |
| `g-warning` | PASS: 10.6 s → 7.5 s |
| `w-first` | PASS (0.00; none 0.04) |
| Kits (counter / off-counter): lost in waves 1–10 (tough) | latest 10.2 / 10.0; plating 4.2 / 3.4; usual 4.3 / 3.8; none 18.7 / 20.0 |

**The counters do not do clearly better** (rule `m-kits`, 24 seeds, the kit as the bot's taste): the forced singles rank the Gravity Well, the Bomber Wing and Point Defense the best and the Tesla, the Grapnel and Full Steam among the worst, but with the bot drafting toward them the two kits come out level (the counter a few tenths of a ship worse with the usual and plating sets). Neither is trivial. A question for the player and for the next sweep.

**Busier early waves** (the usual Armory's record): threats on the board at a moment 2.3, 1.6, 2.4 on waves 1–3, kills a minute 50, 43, 47.

### Tide difficulty (rule `m-difficulty`; the brief: win 50–70%, waves 1–5 0.4–0.8)

- **The usual Armory wins 50%**, at the bottom of the band (before 16%: the hardest map of the chapter for the bot). **The latest set 15%**, under it (before 0%); **the plating set 68%**, in it. The tide's fix (ships crossing to the deep channel as it falls) made the map harder by about 10 points for every Armory; the retune after it won back most of it for the usual set.
- **Waves 1–5:** 0.87 for the usual Armory, over the asked 0.8 (before 0.59, but 0.0–0.2 a wave until wave 3); the plating set 0.76, the latest 1.76.
- **The climb from wave 4 to 9** rises for the usual Armory (.05 .38 .35 .47 .56 .51), then wave 10's 1.07; on the tough runs .07 .40 .48 .52 .78 .90, then 1.52.
- **Wave 10** is the hardest regular wave for the usual and plating Armories, and no step to it doubles.

## What is not satisfied, or uncertain

- **The convoy change.** The card played today's convoy controls before; on the map's own convoy (Pairs at the campaign's step 1, as most rebuilt maps) the rebuilt waves won 2–10%. The Tide sails a Box at step 2, which takes a hit less from each direct hit and ×1.8 from splash: it makes the drones nearly harmless and the crowd's shells and clusters the danger, which suits the map's question, but it is a big lever and the player has not seen it here.
- **The Repair Ship and the Bodyguard Ring come as Lure Beacons** on the Tide's waves (their heavies sink a ship outright on the deep channel's short flights): two of chapter 4's four enemies do not show on this map under the layer.
- **The waves are mostly drones** (59% of what shows in waves 4–10): the shared waves' shells, missiles and clusters come as drone strings to the flats, as on the Coves (67%) and the Rigs (72%), to bring a map the bot won 16% of the time into the band.
- **The signature is 12% of the hits in waves 4–10**, under the asked quarter (the Coves 7%, the Rigs 9%, the Sowers 19%): each cluster more at the crowd cost about 0.3 of a ship a wave on the Box, and one more on wave 7 made a cliff.
- **The boss is under the asked 1.5 / 2 / 2.5** for the usual Armory (0.72 / 1.31 / 2.02): heavier builds won 31–42%.
- **The win rate is at the band's floor** (50% for the usual set) after the tide fix; the latest set 15%.
- **Cliffs for the other Armories:** the latest set's wave 8 is ×2.4 its wave 7 and the plating set's wave 6 ×2.4 its wave 5 (floored) on the tough runs; the usual set's climb passes.
- **The combo sweep and the diversity check ran on the build before the tide fix and the retune** (the best kits may have moved; the sweep takes about two hours).
- **Waves 1–5 lose 0.87**, over the asked 0.8; wave 3's low water (a guided missile and a shell at the crowd) is most of it (0.39).
- **The tide's turn changed for the campaign too**: the falling and rising tide, the ships crossing off the flats and the drawing are the mechanic itself (the player's note), so a campaign Tide run plays differently from v57 (its log does not replay).
- **The map-cards e2e fails one check on the base as on this branch**: "the Strait's card (not its debut): no card for an enemy met before" sees "NEW: Helicopter missile" (the forced Attack Helicopter's rockets get their own first-sight card). Not the Tide's; reproduced on a clean build of the base (#223).
- **The 24-seed records and the 192-seed reads disagree** by several points on a win rate; the larger read is the one to trust.

## The play log (v61)

`LOG_VERSION` 61, `LOG_REPLAYS` `[61]` (`src/v3/sim/playlog.ts`). The change is lab only, under the encounter layer: the other maps play as at 60, and a 60 Tide card log played today's convoy controls and the shared waves (it no longer replays to the same game). The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 61 (`python3 tools/v3/playtest-fixes/pins.py 57 59`, then after merging Dunmar Crossing (58) and the Citadel (60) `pins.py 59 61` and `pins.py 60 61`, and `tests/v3/scorecard.test.ts`). The Test Lab's "Ready to test" lists the Tide at v61. The combo sweep's results are in `tools/v3/combo-sweep/results/v59-ch4`.

## Questions for the player

- **Does the tide work now?** The water falls and rises over a few seconds, the sand comes up from the shore with a line of surf, the ships on the flats cross to the deep channel as soon as it starts to fall, and the gauge between the lanes turns gold ("THE TIDE TURNS", then "TIDE GOING OUT") before it does. Recommended: play waves 1, 3 and 8 and watch a box leave the flats; say if the crossing looks too quick or the sand too strong.
- **The convoy: a Box at flow step 2.** It makes drones nearly harmless and the shells and clusters over the crowd the danger, which is the map's question; on Pairs at the campaign's schedule the bot won 2–10%. Recommended: keep the Box; if it feels slow or the boxes look odd, the next build can try Pairs at step 2 with lighter waves.
- **The Repair Ship and the Bodyguard Ring as Lure Beacons on this map.** Their heavies sink a ship outright at the deep channel's range. Recommended: keep the swap; the chapter's enemies all show on the Coves and the Delta.
- **The boss: Low Water, a new boss on the Firestorm's slot.** Recommended: keep the name; it is under the asked 1.5 / 2 / 2.5 to keep the win rate in the band.
- **The signature is 13% of the hits, not 25%.** Recommended: keep it; the ebb's fire at the crowd is the whole wave's turning point already, and more clusters made the climb steeper.

## Checks run

`tsc`; `vitest --exclude '.claude/**'` (81 files, 1921 tests: all pass but one timing check, `tests/v3/mapReport.test.ts` "a quick real report" at 20.7 s against 20 s on a machine shared with two other agents' runs, which passes on its own (13/13); and one table fixed after the run, the map with no encounters yet is the Citadel); `vite build`, then `vite preview` and the e2e scripts `v3-encounters.mjs`, `v3-map-cards.mjs`, `v3-map-lab.mjs`, `v3-convoy.mjs`, `v3.mjs` (all pass on the merged build; `v3-map-cards.mjs`'s check "the Strait's card (not its debut)" failed twice under load before the merge, on a clean build of the base too, and passed after it); the map-lab baseline replays exactly.

## Tests

- `tests/v3/encounters.test.ts` ("Tidewater Flats (log v61)"):
  - the tide's turn (the player's note): every step of whole bot runs, the card (waves 1–10 and the boss, three seeds) and the campaign's clock (waves 1–6, two seeds): no hull on exposed sand, none in the flats at low water, none stalled for 5 s, ships crossed; the water level never jumps;
  - the tide's clock: under the layer each wave's low water is its ebb and `TIDE_LOW`, every crowd-aimed launch leaves at low water; the campaign, a rev 3 log and the shared wave keep the map's clock (no `ebb`);
  - at low water no new ship takes the flats lane; at high water both lanes take ships;
  - `'crowd'` goes for a ship among the most bunched hulls; `'flats'` for a ship on the flats lane;
  - the ebb strike: from wave 4 so many clusters off the middle silo at the crowd as the signature says, none on the shared wave or the campaign;
  - the Repair Ship and the Bodyguard Ring as Lure Beacons, under the layer only;
  - Low Water: the round's own tide, every strike lit first and inside the low water, every launcher carries what it fires, more each round and longer low water; no firebomb; a rev 3 log and the campaign play the Firestorm; 15–30 s a round; the boss's name "Low Water" under the layer, "Firestorm" before it;
  - `REBUILT_MAPS` and `CHAPTER_FOUR_MAPS` (`['coves', 'delta', 'tide']`), the budget, legality, warning and replay checks cover the map.
- `tests/v3/mapRules.test.ts`: no repeats and no gaps; `MAP_PLANS` complete; the boss target is 2. `tests/v3/mapCards.test.ts`, `round11.test.ts`, `convoy.test.ts`: the production setup is policy D with the encounters, no command (flow step 2, the Box). `tests/v3/round12fixes.test.ts`: wave 1 opens with two strings of three drones and loses no ship (seeds 11–13, "you" and casual). `tests/v3/readyToTest.test.ts`: the new entry. `tests/v3/scorecard.test.ts`: the log is version 59.
- `e2e/v3-map-cards.mjs`: the hub card says so. `e2e/v3-encounters.mjs`: the card opens with its encounters, no command and the wave's own tide; wave 1 played through its ebb with shots at high, falling and low tide (`tide-high.png`, `tide-falling.png`, `tide-low.png`), none on the dry flats at low water; the pause screen's script names Low Water and the first ebb; skipped to the boss, the tide is out and a strike is in the air at the crowd (a shot at one pixel a point: `e2e/shots/v3-encounters/tide-boss.png`).

## What to look for when you play

The flats lane by your carrier floats only at high tide. Once a wave the tide goes out: the gauge between the lanes counts down and turns gold just before, the flats dry, and every new ship crowds into the deep channel under the enemy's shore. That is when the shore fires: shells, cluster missiles and fast missiles at the bunched ships. When the tide comes back the ships spread again. In the boss rounds the tide runs out early and stays out, and the whole shore fires at the crowd in strikes, more each round. The questions: can you read the gauge on the phone, does the ebb feel like the moment to watch, and do the three boss rounds rise?

(This section names no weapon to try: the counter kit above is a design note for the bots, never shown in the game or on the hub.)
