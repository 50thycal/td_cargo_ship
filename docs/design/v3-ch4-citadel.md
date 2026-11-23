# The Citadel of Vey: map card (map rebuild, chapter 4, the game's last map)

**Date:** 2026-11-22. The Citadel of Vey (`citadel`, chapter 4 "Open War", the 20th map: the chapter's and the game's last) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), the way the Coves (`docs/design/v3-ch4-coves.md`) and the Delta (`docs/design/v3-ch4-delta.md`) were. Encounter rev 4; play log **v60** (57 is the Delta, merged; 58 and 59 are Dunmar Crossing and the Tide, built alongside).

There is no player run of the Citadel to start from. The starting point is the map as it was (the Test Lab card: today's convoy controls, the shared waves, the Siege of Vey as its boss) and what the player asked of every rebuild: a question of its own and kits of its own, busier early waves ("more drones and easy things to kill", "less is more"), the climb from wave 4 to 9, no single-wave cliff, wave 10 the climax and not a wall, big and distinct boss set pieces, readable on an iPhone in landscape (874×402), anything that can sink a ship warned. And, the game's finale: a climax of all four chapters.

As it was (192 seeds, the usual Armory, the card's own setup): won 36%, a quiet start (waves 1–5 lost 0.63), a climb to a wave 10 of 1.18, and a boss that fell instead of rising (1.51 / 1.19 / 1.16). Its mechanic, the shield and its three generators, was a one-off: the bot had the three generators down in 94% of runs by the end of wave 2 and the Citadel silenced by wave 4 in every run (16 seeds, `tools/v3/citadel/down.ts` on the base build), so from wave 4 the map was a plain funnel with the fortress a wreck.

Code:
- `src/v3/data/encounters.ts`: `CITADEL_R4` (ten encounters), the filler for waves 1–6 (`BUSY`), `CITADEL_CLIMB`, Beat `dome`, `MAP_SIGNATURE.citadel` (`dome`: from wave 4), `SHIELD_RISES` and `shieldRisesOn`, `SHOT_RIGS` (the Citadel's generators and keep count shots too), `MAP_FOE_SWAP_EARLY` (on waves 2–5 the Bodyguard Ring comes as a Lure Beacon), `CITADEL_BOSS_ROUNDS` and `MAP_BOSS.citadel` (a boss round's `citadel`; the boss's name, The Last Stand), `CHAPTER_FOUR_MAPS` (the Coves, the Delta and the Citadel, in `REBUILT_MAPS`);
- `src/v3/data/config.ts`: `CITADEL` (a generator's shots, the Citadel's);
- `src/v3/sim/game.ts`: `raiseShield` (the shield rises at each wave's start: a generator brought down stands again, a silenced Citadel is manned again), `shieldRises`, `domed` (a launch under the dome can't be shot inside it while the shield stands; `damageThreat`, `worthShooting`), the signature's planning (`startWave`: so many of the wave's own guided missiles and shells, or a guided missile for two drones, off the Citadel under its dome; from wave 4 everything the keep fires leaves under it), `rigStandIn` (a silenced Citadel's fire comes off the far silo nearest it), shot counting for the generators and the Citadel (`rigShot`);
- `src/v3/sim/events.ts`: the Siege of Vey under the Citadel's boss tuning is the Last Stand (`lastStand`: the shield raised, the keep lit 2.5 s, the grand salvo under the dome); with no boss tuning it plays as it did;
- `src/v3/ui/features.ts`, `render.ts`: the generators and the Citadel show the shots left in a pill (the Rig Field's), and fire under the dome is ringed in the dome's cyan while it can't be shot;
- `src/v3/data/convoy.ts`: `MAP_CONVOY.citadel` (the campaign's schedule, a Spread, no command); `src/v3/data/mapPlans.ts`: `MAP_PLANS.citadel`; `src/v3/data/lab.ts`: "Ready to test" lists the Citadel at v60; `src/v3/sim/playlog.ts`: `LOG_VERSION` 60;
- tools: `tools/v3/citadel/` (`readall.sh` and `final.sh`: the tuning reads for every Armory, `tools/v3/rigs/read.py` on the Citadel; `tune.sh`: the usual Armory, tough then normal; `reports.sh`: the record reports; `waves.ts`: what each wave plans; `down.ts`: generators down and the Citadel silenced, wave by wave; `dome.ts`: the signature as played; `probe-boss.ts`: the boss test's seed; `compare.py`: the diversity check against every rebuilt map); `tools/v3/combo-sweep/mixwaves.ts` counts the signature (`domeFire`).

Bot reports: `tools/v3/map-report/results/citadel-player.md` (the usual Armory: Quick Reload 5, Damage Control 4, Stockpile 5), `citadel-latest.md` (Wide Warhead 5, Point Defense 4, Supply Lines 3), `citadel-plating.md` (Quick Reload 5, Armor Plating 5, Big Magazine 4), `citadel.md` (no Armory); each with a heat map and the counter and off-counter kits. Tuning reads: 192 seeds (900–1091), `tools/v3/citadel/final.sh <dir>`. "Before" was read on a clean copy of the base build (#222, log v56; the Delta's merge changed nothing on this map) on the same seeds; no 24-seed "before" report files (to save the bot budget, as on the Delta).

## How it is gated (lab vs campaign)

As every rebuild: **lab only, under the encounter layer.** The Test Lab's map card (`?lab=map-citadel`) opens on its production setup, policy D with no command, the map's own convoy and the authored encounters rev 4, because the Citadel is in `REBUILT_MAPS` (via `CHAPTER_FOUR_MAPS`). The hub card reads "The map's own convoy (no commands) · encounters v1 Original". Everything new reads the run's encounter setup (`signatureOf`, `bossTune`, `shieldRisesOn`, `shotRigsOn`, `swapFoe`), so the campaign, a run with no layer, a rev 3 log and the shared wave (`only: []`) play the Citadel exactly as before: the shared waves, ten hits a generator and forty the Citadel (brought down, they stay down), the planner's own new enemies and the Siege of Vey. The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version.

## The problem

> The Citadel of Vey stands over the harbour narrows where the ships deliver, its fire the shortest on the map, behind a shield that rises again every wave on three generators spread round the map; from wave 4 it fires under its dome, where nothing can be shot while the shield stands: three generators, three shots each, to open its fire to your guns, then fourteen on the Citadel to silence it for the wave, or every shot on what is coming?

The shield is the map's one mechanic (rule `m-mechanic`; `data/maps20.ts`): the Citadel on its island (1250, 300), a dome 175 px round it that reaches down to the narrows, where the lane closes from x 900 to the delivery end; three generators feed it, spread round the map far from each other: the west islet (450, 300), over the way in; the north shore (850, 82), the furthest from the lane; the south-east shore (1460, 812), by the delivery end. While any one stands, the Citadel can't be hurt.

What the rebuild changes (lab only):
- **The shield rises again every wave** (`SHIELD_RISES`): at each wave's start, a generator brought down stands again and a silenced Citadel is manned again. Before, brought down they stayed down, and the bot had the map's question answered by wave 4.
- **They count shots, not damage** (the Rig Field's v55 rule, `SHOT_RIGS`): a generator takes **3 shots**, the Citadel **14** (only once the shield is down), whatever each shot does; an area weapon counts once a structure a step. The Air Strike's bombs, a flak cloud or a powered-up shot don't shred them: dropping the shield is nine of the player's own taps, wherever the generators are.
- **Silenced, the Citadel's fire moves to the far silos** for the rest of the wave (`rigStandIn`): the north-west (250, 72) and the north-east (1500, 78), long flights with warning, as the Rig Field's downed rigs.
- **From wave 4 its fire is under the dome** (the signature, below).

The question: **every wave, is it worth nine shots (and fourteen more) to open the keep?** Dropping the shield makes its fire shootable from the keep, and lets you silence it; every shot at a generator is one not at the drones coming down the map.

The mechanic is in every wave (rule `g-mechanic`): the shield stands at the start of every wave (waves 1–10), the Citadel fires in waves 2–10, its fire is under the dome from wave 4, and the boss is the Citadel itself.

How it differs from the other rebuilt maps: the Coves' danger comes out of hiding places at the nearest ship, the Delta's follows the player's own steering, the Rig Field's launchers stay down once brought down (and are towed back in); here the one launcher that matters is shielded, the shield comes back every wave, and the choice is whether to spend the wave's quiet on opening it.

## Sites and their jobs

Bases are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| The Citadel (base 1) | Its island (1250, 300), over the narrows | shells, heavies, supersonics, guided, clusters, motherships | The shortest flights on the map, at the ships in the narrows: a shell (w2), a cluster (w3, w7, w9), every one of its launches under the dome from wave 4 (the signature, w4–w10), the grand salvo (w10, the boss). |
| West islet generator (base 2) | (450, 300), over the way in | – | One of the three: in view of the ships coming in, the nearest to the carrier. |
| North generator (base 3) | (850, 82), the north shore | – | The furthest from the lane: the drones off the far silo fly past it to the narrows (w1). |
| South-east generator (base 4) | (1460, 812), by the delivery end | – | On the ships' own side of the narrows, below the lane. |
| Far north-west silo (base 5) | (250, 72) | drones, shells | The map's only drone launcher, the longest flight: the filler, every wave's drone strings, shells at the ships coming in (w5, w9); a silenced Citadel's stand-in. |
| North-east silo (base 6) | (1500, 78) | supersonic, guided | A guided missile at the ship halfway along (w2, w3, w5) or the ships coming in (w7), supersonics (w4, w7, w10, boss); a silenced Citadel's stand-in. |
| Sub spots, roads, air | Off the west islet, the middle, by the carrier (300, 752); the north shore road, the south-east road, the island's pop-ups; the edges | sub salvos, trucks, jets, bombers | A periscope by the carrier (w6); the shared waves' own. |

## The stretches

- **Danger: the late third, the narrows** under the Citadel, where the ships deliver: 47% of the hull damage in waves 1–9 (the usual Armory's record report; 46–52% for the other player Armories).
- **Safe: the early third, the wide water of the way in** under the far silo's long flight: 21% (18–20% for the other player Armories; 27% with none, flagged).
- **The middle** (32%) takes the drones at the ship halfway along and the periscope's wave.
- Rule `m-carrier`: the carrier (720, 752) sits under the middle of the lane, so the danger stretch is not its closest.

## The convoy

The map's own convoy (rule `m-convoy`, `m-shape-convoy`): **the campaign's schedule in a Spread**, no command (`MAP_CONVOY.citadel`). The fortress is fought by shooting it, not by sailing. A Spread because the Citadel's shells and heavies land a breath from its keep: in a Spread splash does half its damage and hits one ship only, so a heavy off the keep costs a hull, not two. On the shared waves (encounters off, 48 seeds, the usual Armory): Pairs won 4%, the Spread 31% (today's convoy controls, the card before: 36% on 192). A question for the player.

## The signature: under the dome

The player's round 9: each map gets a threat of its own in waves 4–10, tied to its identity and its boss. The Citadel's identity is its shield; its boss is the Citadel itself. The signature (`MAP_SIGNATURE.citadel`, `dome` from wave 4):

- **Everything the Citadel fires from wave 4 leaves under its dome**, and so many more of the wave's own guided missiles and shells come off the Citadel (1 a wave on waves 4–6 and 8–10, 2 on wave 7; what is left of them after the wave's encounter took its own, or a guided missile in place of two of the wave's drones), spread over the wave, the keep lit as a raid's base first (rule `w-budget`: the wave sends no more);
- **while the shield stands, a missile inside the dome can't be shot** (`domed`: the player's shots and the helpers' are blocked, a flash where they land; the bots don't waste a shot on it), so it can be stopped only in the last breath between the dome's edge and the narrows, or the generators come down first and the whole flight is open; drawn ringed in the dome's cyan while it can't be shot.

The encounters add their own (`dome` on a beat): wave 4's guided missile, wave 5's, wave 7's two shells, wave 8's and wave 9's guided missiles, wave 10's grand salvo of four.

The signature asks the map's question every wave from 4: open the keep, or let its fire come and catch it at the dome's edge.

How much of waves 4–10 it is (`tools/v3/combo-sweep/mixwaves.ts`, 8 seeds, the "you" bot drafting for itself, tough):

| | Waves 4–10 | Waves 6–10 | Boss rounds |
| --- | --- | --- | --- |
| Share of the threats that show | 6% | 6% | 46% |
| Share of the hits it takes to clear them | **6%** | 6% | 31% |

Far under the asked quarter (the Coves 7%, the Rigs 9%, the Sowers 19%): the bot silences the Citadel in most waves (above), so the keep's fire comes off the far silos instead, and most of what shows in waves 4–10 is drones (56%). Counted as fire under the dome is only what leaves the keep under it; the generators and the Citadel themselves (11% of what shows) are the mechanic. A first build that put only so many of the wave's own missiles under the dome read 3%; making everything the keep fires from wave 4 dome fire doubled it at the same win rate. A question for the player.

## The counters

- **Counter kit: Gunship Pair, Point Defense, Flak Cannon.** The Citadel's fire lands a breath from its keep and from wave 4 is shielded under its dome, and the shield rises every wave, so the player's own taps are wanted on the generators and the keep: what pays is fire that works on its own while the finger is there: the Gunship Pair over the lane, Point Defense round the carrier, the Flak Cannon's clouds waiting where the drones converge.
- **Off-counter kit: Thermobaric Shell, Seeker Pod, Tesla Arc.** The Thermobaric and the Seekers want the finger on what is in the air; the Tesla's chain wants strings the dome and the long flight break up.
- Both chosen from the combo sweep's singles at log v60 (Gunship Pair 5.8, Flak 6.9, Point Defense 6.9; Thermobaric 9.2, Seeker 9.3, Tesla 9.7), leaving the Air Strike (the best alone) out of both. Every weapon is in chapter 4's draft. A design note for the bots only: nothing in the game nudges the player towards it.

## Loadouts on this map (combo sweep singles)

Each weapon alone, forced at every draft (12 seeds, the player's usual Armory, version 60; `npm run v3:combo-sweep -- --stage=singles --maps=citadel --out=tools/v3/combo-sweep/results/v60-ch4`). Ships lost over all 13 waves:

- **Strong:** **Air Strike 5.7**, Gunship Pair 5.8, Orbital Strike 6.5, Flak Cannon and Point Defense 6.9, Gravity Well and Drone Screen 7.2, the Wild Card 7.4.
- **Middling:** Cadence Gun 7.7, Frigate Escort 7.8, Boomerang and Overdrive 7.9, Shrapnel 8.0, Railgun 8.4, Scattergun 8.5, Shield 8.7.
- **Weak:** Thermobaric 9.2, Seeker 9.3, Tesla 9.7, Bomber Wing 10.5, Supply Run alone 12.2, the plain gun 13.2, Focus Fire, Grapnel and the Charge Lance 14.3, Full Steam 14.9, Dual Wield 15.2, the Laser Cutter 47.2. The bot drafting for itself: 6.7 (won 83%).

## Diversity: are the Citadel's best kits its own?

Swept the chapter 2 way (singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16), and compared with the five chapter 2 maps, the five of chapter 3 and chapter 4's Coves and Delta from their last sweeps (`docs/design/v3-combo-diversity.md`, "The Citadel"; `python3 tools/v3/citadel/compare.py`). Swept on the build before the last three changes (waves 2, 5–9 and the Bodyguard's swap through wave 6: a few drones and missiles), which move the kits' numbers a little, not the weapons' order.

| | Result |
| --- | --- |
| Top 5 kits | **Air Strike + Gunship Pair + Supply Run** 5.4 (won 94%), Air Strike + Frigate Escort + Gunship Pair 6.8, Air Strike + Gunship Pair + Dual Wield 6.9, Gravity Well + Gunship Pair + Orbital Strike 6.9, Air Strike + Gunship Pair + Shield 6.9 |
| Jaccard of the top-5 kits, against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers / Rigs / Black Strait / Dreadnought / Coves / Delta | 0 / 0 / 0 / **0.11** / **0.11** / 0 / **0.11** / 0 / **0.11** / 0 / 0 / 0 |
| The same, the Citadel against itself (two halves of its seeds) | 0.25 |
| #1 kit | **also in the Saltgate's and the Black Strait's top 5** |
| Best weapon alone | **Air Strike** 5.7 (as on the Island, the Behemoth, the Archipelago and the Delta) |
| Rank correlation of the weapons alone, against the same twelve | 0.72 / 0.84 / 0.65 / 0.60 / 0.49 / 0.82 / 0.61 / 0.70 / 0.77 / 0.66 / 0.84 / 0.70 |
| Air Strike | **1st of 27 alone; in four of the five best kits** |

- **The Gunship Pair is in all five of the best kits**, the Citadel's own mark: it fires on its own over the lane while the player's taps go on the generators. Gravity Well + Gunship Pair + Orbital Strike (the #4) is in no other map's top 5.
- **But the Air Strike leads here**: the best weapon alone and in four of the five best kits; three of the five are in another map's top 5 (one map each: the Archipelago, Saltgate, the Sowers, the Black Strait), so the Citadel is less its own than the Coves or the Delta (0 against all). The dome does not counter it: the Air Strike's work is the drones on the long flight, outside the dome. A question for the player (below).

## Debuts

None: chapter 4's four new enemies (the Repair Ship, the Bodyguard Ring, the Lure Beacon, the Incendiary Missile) debut on the Coves; here they are regulars, as the planner draws them. One change, lab only (`MAP_FOE_SWAP_EARLY`): **on waves 2–5 the planner's Bodyguard Ring comes as a Lure Beacon**, another of chapter 4's own. A Bodyguard's heavy comes off the Citadel itself, a breath from the narrows, behind three guards, and on waves 2–5 it sank a third of a ship a run on its own (waves 1–5 lost 1.16 for the usual Armory on 192 seeds against the asked 0.4–0.8). From wave 6 the Bodyguard comes as drawn. The encounters bring nothing from a later chapter (there is none) and no new enemy.

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated, with filler on waves 1–6 (strings of two or three drones out of the far north-west silo, the map's only drone launcher, a long flight). The encounters take most of the shared waves' shells (the subs' salvos above all) and the map's heavies, clusters and motherships out of the waves (`replaces`), drones off the far silo in their place: a heavy off the Citadel is at the narrows in four seconds with eight hits, and was most of what sank the bot's ships. `CITADEL_CLIMB` sends 8–14% less than the shared wave from wave 2 (within ±15%, rule `w-budget`). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | Under the guns (`citadel-under-the-guns`) | far silo, 3 + 3 + 2 drones, over the whole map past the north generator | the lead ship as it sails into the narrows under the dome; the ships coming in |
| 2 | teach | Three generators (`citadel-generators`) | the Citadel, a shell; far silo, a shell and drones past the west islet's generator | the lead ship (a short flight); halfway along (a long one); the ships coming in |
| 3 | teach | Into the narrows (`citadel-narrows`) | the Citadel, a cluster; north-east silo, a guided missile; 6 drones in place of the subs' shells | the lead ship in the narrows; halfway along |
| 4 | combine | Under the dome (`citadel-dome`) | the Citadel, a guided missile **under its dome**; north-east silo, a supersonic; 11 drones | the lead ship in the narrows; the ships coming in; halfway along |
| 5 | combine | Both ends (`citadel-two-ends`) | far silo, 2 shells; the Citadel, a guided missile **under its dome**; north-east silo, a guided missile; 8 drones | the ships coming in; the lead ship; halfway along |
| 6 | combine | Periscope by the carrier (`citadel-periscope`) | a sub by the carrier, a shell; 20 drones (the wave's own guided missiles, heavy, cluster and mothership come as drones) | the ships coming in (the safe stretch's turn); the lead ship and halfway along |
| 7 | escalate | The keep's battery (`citadel-keep`) | the Citadel, **2 shells under its dome** and a cluster; north-east silo, a guided missile; 18 drones | the lead ship in the narrows; halfway along; the ships coming in |
| 8 | escalate | Crossfire at the narrows (`citadel-crossfire`) | the Citadel, a guided missile **under its dome**; 22 drones from the far silo | the lead ship in the narrows; halfway along; the ships coming in |
| 9 | escalate | The whole fortress (`citadel-fortress`) | the Citadel, a cluster and a guided missile **under its dome**; north-east silo, a guided missile; far silo, 2 shells and 21 drones | the lead ship and halfway along; the ships coming in |
| 10 | climax | Grand salvo (`citadel-grand-salvo`), after the wave's own fire and a 6 s calm | the Citadel's grand salvo, **4 missiles at once under its dome** (2 guided at the lead ship and halfway along, 2 shells halfway along); north-east silo, 2 supersonics; 26 drones | the narrows; the ships behind |

Wave 1 loses 0.03 ships a run with the usual Armory (192 seeds; 0.01–0.05 with the others): its drones fly the length of the map, the longest flight there is.

**Wave 10, the climax:** after a 6 s calm, the grand salvo; the hardest regular wave for the usual and plating Armories on the tough runs (192 seeds: usual 1.51, plating 1.06; latest 2.16, its wave 9 2.20), and no step to it doubles the wave before (×1.24 usual).

`CITADEL_CLIMB`: 1, 0.9, 0.9, 0.88, 0.88, 0.86, 0.92, 0.86, 0.88, 0.9 of the shared wave's drones and missiles; the waves as planned are ×0.88–1.06 of the shared wave on the same dice (`tools/v3/rigs/budget.ts --map=citadel`).

## The boss plan: the Last Stand

The Citadel's event was the Siege of Vey: a Repair Yard on the Citadel (a mothership and three Repair Ships), a guarded heavy and Lure Beacons, then firebombs from every side, every round: chapter 4's four new enemies, all of them regulars by the game's last map. It cost the bot about a ship and a half a round, falling (1.51 / 1.19 / 1.16). The boss under encounter rev 4 is new (`CITADEL_BOSS_ROUNDS`, lab only; the event's id stays `siege-of-vey`): **the Last Stand**, the Citadel itself.

Each round opens with **the shield raised** (every generator stands again, its shots the round's own) and **the Citadel manned** (its shots the round's own). Then **grand salvos**: the keep lit 2.5 s ("GRAND SALVO" over it, the raid warning's sound), then three missiles off it at once, under the dome, at the lead ship in the narrows, converging on it. While the shield stands they can't be shot until they leave the dome; with it down they can be shot from the keep, and **the Citadel silenced fires no more salvos that round**. Round by round more salvos, closer together, tougher generators, more guided missiles in the salvo, and more fire round them off the far silos and the edges (drones at the ships coming in, supersonics halfway along, strike jets).

| Round | Generators | Citadel | Salvos | Apart | A salvo | Added |
| --- | --- | --- | --- | --- | --- | --- |
| before (every round) | – | – | – | – | – | a Repair Yard (a mothership, 3 Repair Ships), a guarded heavy, 2 Lure Beacons, 5 firebombs, 2 swarms |
| 1 | 3 shots | 12 | 2, from 6 s | 8 s | a guided missile, 2 shells | 2 drones; a supersonic |
| 2 | 4 | 14 | 3, from 5 s | 7 s | a guided missile, 2 shells | 3 drones; 2 supersonics; 2 strike jets |
| 3 | 4 | 16 | 3, from 5 s | 7 s | 2 guided missiles, a shell | 4 drones; 2 supersonics; 2 strike jets |

The intro is the shared cards (log v30): "Boss round", "Convoy restored", "The boss: The Last Stand", "Round 1 of 3", then "Round 2 of 3" and "Round 3 of 3". Each round lasts 18–24 s (the tryhard bot, seed 230).

The whole map is in it, at its biggest: the shield, the generators, the keep, its fire under the dome converging on the ships in the narrows. As the finale of all four chapters it is the one boss that is a place rather than a ship or a squadron; the Dreadnought (chapter 3's finale) was the closest, a battleship sailing a pass, and the Rig Barrage's rigs rose and fired volleys; here a fortress that can't be sunk is silenced round by round.

How it reads (192 seeds, normal runs that reached it; tough runs in brackets):

| Armory | Before r1 / r2 / r3 | After r1 / r2 / r3 |
| --- | --- | --- |
| usual | 1.51 / 1.19 / 1.16 (tough 1.65 / 1.30 / 1.54) | **0.34 / 1.22 / 2.35** (tough 0.46 / 1.28 / 2.45) |
| latest | 2.12 / 2.33 / 1.70 (16, 15, 10 runs reached it) | **0.48 / 2.24 / 2.58** (54 runs; tough 0.68 / 2.25 / 3.78) |
| plating | 1.05 / 1.41 / 1.07 | **0.18 / 0.98 / 1.74** (tough 0.19 / 0.96 / 1.83) |

Rising with every Armory, round 3 near the asked 2.5 for the usual Armory; round 1 under the asked 1.5 and round 2 under the asked 2, as on every rebuilt map, to keep the win rate in the band (a build with round 1 at 1.42, its salvo two guided missiles and a shell, won 54% on 96 seeds against 61%).

## Bot results, before and after

"Before" is the map card as it was (log v56's base build, #222; the Delta's and the Crossing's merges change nothing on this map): today's convoy controls, no encounters, the Siege of Vey, ten hits a generator and forty the Citadel. "After" is this build. The reads are 192 seeds (900–1091), the record reports' bot and setup (`tools/v3/citadel/final.sh`).

### The headline (192 seeds, normal runs)

| Armory | Won before → after | Waves 1–5 lost | Waves 1–10 lost | Wave 8 | Wave 10 |
| --- | --- | --- | --- | --- | --- |
| **usual** (Quick Reload 5, Damage Control 4, Stockpile 5) | 36% → **49%** | 0.63 → **0.84** | 4.25 → 4.42 | 0.99 → 0.93 | 1.18 → 0.98 |
| latest (Wide Warhead 5, Point Defense 4, Supply Lines 3) | 3% → **11%** | 1.48 → **1.61** | 5.64 → 5.32 | 1.84 → 1.08 | 1.73 → 1.18 |
| plating (Quick Reload 5, Armor Plating 5, Big Magazine 4) | 28% → **72%** | 0.51 → **0.63** | 3.91 → 3.27 | 1.21 → 0.54 | 1.09 → 0.75 |
| none | 0% → 0% | 2.81 → 3.00 | 4.64 → 5.72 | 1.97 → 1.76 | – → 2.00 |

Normal-run curves, waves 1–10 then the boss rounds (runs that reached each):

| Armory | Before | After |
| --- | --- | --- |
| usual | .00 .18 .17 .06 .22 .58 .60 .99 .95 1.18 · boss 1.51 1.19 1.16 | .03 .22 .12 .10 .35 .49 .69 .93 .95 .98 · boss .34 1.22 2.35 |
| latest | .00 .25 .37 .37 .51 .99 1.23 1.84 1.68 1.73 · boss 2.12 2.33 1.70 | .02 .30 .32 .26 .74 .88 .82 1.08 1.18 1.18 · boss .48 2.24 2.58 |
| plating | .00 .09 .09 .09 .23 .46 .63 1.21 .89 1.09 · boss 1.05 1.41 1.07 | .01 .11 .08 .15 .28 .41 .58 .54 .63 .75 · boss .18 .98 1.74 |

Tough-run curves (every seed plays every wave; the cliff check), 192 seeds. Before (usual): .00 .18 .17 .06 .22 .61 .69 1.36 1.33 1.97 (wave 6 ×2.4 wave 5, a wave under 0.25 counting as 0.25; wave 8 ×2.0). After: usual .03 .22 .12 .10 .37 .54 .81 1.21 1.22 1.51 (**the largest step ×1.5, on waves 5 and 8: no cliff**); latest .02 .30 .32 .27 .83 1.08 1.18 1.62 2.20 2.16 (**wave 5 ×3.1 wave 4: over the line**); plating .01 .11 .08 .16 .31 .43 .68 .69 .92 1.06 (×1.6 at most).

How the mechanic plays for the bot (`tools/v3/citadel/down.ts`, 12 seeds; `dome.ts`): it brings the shield down in every wave from wave 3 (92% of waves 1–2; the shield stands 12–33% of a wave), and **silences the Citadel in 75–100% of waves 2–10** (its idle shots: nine on the generators, fourteen on the keep), so much of the signature's fire leaves the far silos instead; in the boss rounds it silences the Citadel in all of round 1's runs but only a third of round 2's and a fifth of round 3's. On the base build it had the shield down for good by wave 2 and the Citadel a wreck by wave 4: now the question comes back every wave, but the bot answers it the same way almost every time. A question for the player (below).

### The record reports (24 seeds, 900–923)

| | latest / plating / usual / none |
| --- | --- |
| Won (normal) | 0% / 83% / 63% / 0% (the 192-seed reads: 11% / 72% / 49% / 0%) |
| Waves 1–5 lost (normal) | 1.08 / 0.25 / 0.75 / 2.25 |
| Boss r1 / r2 / r3 | see the 192-seed table above |
| `w-cliff` (tough) | FLAG (w6) / FLAG (w8) / FLAG (w8: 0.33 → 1.00) / FLAG (w5): on 24 seeds; on 192 tough seeds the usual and plating sets' largest step is ×1.5–1.6, the latest set's wave 5 ×3.1 |
| `w-early` close calls from wave 3 | PASS / FLAG (0.83 on w4) / FLAG (0.63 on w4) / PASS |
| `w-budget` ±15% | FLAG (w4 ×0.85, the line) / PASS / **PASS** (furthest ×0.85) / FLAG (w3 ×0.85) |
| `m-stretches` | PASS: hot late 46–52%, cold early 18–21%; none: cold early 27% |
| `g-warning` | PASS: 8.0 → 5.9–6.1 s |
| `w-first` | PASS (0.00) |
| Kits (counter / off-counter): lost in waves 1–10 (tough) | latest 8.4 / 8.6; plating 3.2 / 3.1; usual 4.5 / 4.7; none 17.8 / 18.6 |

The 24-seed records and the 192-seed reads disagree by up to 14 points on a win rate (the usual set 63% against 49%); the larger read is the one to trust.

**Busier early waves** (the usual Armory's record): threats on the board at a moment 1.9, 2.1, 1.6 on waves 1–3, kills a minute 53, 45, 46.

**The counters** (rule `m-kits`): the counter kit loses 0.2 fewer ships in waves 1–10 than the off-counter with the usual and latest sets and the same with the plating set (24 seeds, tough): not clearly better. Neither is trivial.

### Citadel difficulty (rule `m-difficulty`; the brief: win 50–70%, waves 1–5 0.4–0.8)

- **The usual Armory wins 49%** on 192 seeds, a point under the band (64% on the build before the last change, which gave waves 5, 8 and 9 the drones the budget check asked for); before 36%. **The latest set 11%** (before 3%), **the plating set 72%** (before 28%): no single tuning puts the three in 50–70% together, as on every chapter 3 and 4 map. Chapter 4's band is "3–4 tries" for the player.
- **Waves 1–5: 0.84** for the usual Armory (the asked 0.4–0.8; before 0.63), the plating set 0.63, the latest 1.61.
- **The climb from wave 4 to 9** rises every wave for the usual Armory (.10 .35 .49 .69 .93 .95), to wave 10's 0.98; on the tough runs .10 .37 .54 .81 1.21 1.22, then 1.51.
- **Wave 10** is the hardest regular wave (tough) for the usual and plating Armories; no step to it doubles.

## What is not satisfied, or uncertain

- **The usual Armory wins 49%, a point under the band** (192 seeds; 64% on the build before the last change). The last change filled waves 5, 8 and 9 to the budget check's line with drones; the lever, if the player wants it back in the band: round 3 of the boss a salvo fewer, or those drones on the ships coming in only.
- **Waves 1–5 lose 0.84** for the usual Armory, just over the asked 0.8; most of it is the planner's chapter 4 heavies (a Repair Ship's) and the keep's short flights on waves 2–3. The Bodyguard Ring's heavy off the keep was a third of a ship on its own on waves 2–5 and a cliff on wave 6; it comes as a Lure Beacon through wave 6 (`MAP_FOE_SWAP_EARLY`).
- **The bot answers the map's question the same way almost every wave**: it drops the shield and silences the Citadel in 75–100% of waves 2–10 with its idle shots (nine on the generators, fourteen on the keep). The question is asked every wave now (before, once, by wave 4), but for the bot the answer is always yes. A player may find it harder (the generators are far apart); if not, the lever is more shots on the keep.
- **The signature is 6% of the hits in waves 4–10**, far under the asked quarter, for the same reason: the silenced keep's fire comes off the far silos. In the boss it is 31%.
- **Air Strike leads**: the best weapon alone and in four of the five best kits; three of the five best kits are in one other map's top 5 each. The dome does not counter it (its work is the drones on the long flight). The Gunship Pair, in all five best kits, is the Citadel's own mark.
- **The counter kit is not clearly better** than the off-counter (0.2 ships in waves 1–10 on 24 seeds).
- **The latest Armory's wave 5 is 3.1× its wave 4** on tough runs (the cliff line), and it wins 11%: as on the Coves and the Delta, it is the Armory, not the map.
- **Boss rounds 1–2 under the asked 1.5 / 2** (0.34 / 1.22), round 3 near the asked 2.5 (2.35), to protect the win rate, as on every rebuilt map.
- **Close calls** (24 seeds): under one a run on wave 4 for the usual and plating sets (0.63, 0.83).
- **The diversity sweep** was played on the build before the last three changes (waves 2, 5–9, the Bodyguard's swap), a few drones and missiles; the kits' order, not their numbers, is what it reads.
- **Fire under the dome reads as a cyan ring** that spins round the missile while it can't be shot; whether it reads on the phone at 874×402 is for the player (the boss screenshot shows it).

## The play log (v60)

`LOG_VERSION` 60, `LOG_REPLAYS` `[60]` (`src/v3/sim/playlog.ts`). The change is lab only, under the encounter layer: the campaign plays as at 57, and a 57 Citadel card log played today's convoy controls and the shared waves (it no longer replays to the same game). The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly. The version pins in the tests and e2e scripts moved to 60 (`python3 tools/v3/playtest-fixes/pins.py 57 60`, and `tests/v3/scorecard.test.ts`). The Test Lab's "Ready to test" lists the Citadel at v60. The combo sweep's results are in `tools/v3/combo-sweep/results/v60-ch4`.

## Questions for the player

- **Does "break the shield every wave" feel like the finale's question?** The shield rises again every wave; nine shots drop it, fourteen more silence the keep for the wave. Recommended: play waves 4, 7 and the boss; if breaking it every wave feels like a chore, the next build can raise it every other wave instead.
- **The boss: the Last Stand, the Citadel itself, on the Siege of Vey's slot.** The Siege's four enemies are chapter 4's regulars by the last map; the boss is the fortress firing grand salvos under its dome. Recommended: keep it and the name.
- **The convoy: a Spread at the campaign's schedule**, so a heavy or a shell off the keep costs one hull, not two (Pairs won 4% on the shared waves). Recommended: keep it.
- **The signature is 6% of the hits in waves 4–10, not 25%.** Recommended: keep it as is for your play; if the dome fire feels absent, the lever is a tougher keep (more shots to silence), not more missiles.
- **Air Strike leads the best kits here too.** Recommended: leave it for your play; a natural counter the map could grow is the dome blocking an Air Strike's run that crosses it.
- **The Bodyguard Ring as a Lure Beacon on waves 2–6** (its heavy came off the keep a breath from the narrows). Recommended: keep it.
- **The two Armories again:** the latest set wins 11%, the plating set 72%. Recommended: leave it; it is the Armory, not the map.

## Checks run

On the merged base (Dunmar Crossing's #224, log v58), the Citadel at v60:
- `npx tsc --noEmit`: clean.
- `npx vitest run --exclude '.claude/**'`: 82 files, 1920 tests passed (including `tests/v3/citadel.test.ts`: the shield and the shots, the shield rising, the silenced keep's stand-in, the signature, the dome, the early swap, the Last Stand on seed 230).
- `npm run build`, `vite preview` on port 4862, then `e2e/v3.mjs`, `v3-map-cards.mjs`, `v3-encounters.mjs` (the Citadel's card, script and the Last Stand shot: `e2e/shots/v3-encounters/citadel-boss.png`), `v3-map-lab.mjs`, `v3-convoy.mjs`: all passed, on the merged build (the merge plays the Citadel's games exactly as before, seed for seed).
- `npm run v3:map-lab -- baseline --write`: every baseline run replays exactly, with telemetry on and off (only the version changed).
- `python3 tools/v3/playtest-fixes/pins.py 57 60` (and 58 60 after the merge: nothing left at 58), `tests/v3/scorecard.test.ts` at 60.
