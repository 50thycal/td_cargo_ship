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

- **Danger: the late third, the narrows** under the Citadel, where the ships deliver. TBD
- **Safe: the early third, the wide water of the way in** under the far silo's long flight. TBD
- Rule `m-carrier`: the carrier (720, 752) sits under the middle of the lane, so the danger stretch is not its closest.

## The convoy

The map's own convoy (rule `m-convoy`, `m-shape-convoy`): **the campaign's schedule in a Spread**, no command (`MAP_CONVOY.citadel`). The fortress is fought by shooting it, not by sailing. A Spread because the Citadel's shells and heavies land a breath from its keep: in a Spread splash does half its damage and hits one ship only, so a heavy off the keep costs a hull, not two. On the shared waves (encounters off, 48 seeds, the usual Armory): Pairs won 4%, the Spread 31% (today's convoy controls, the card before: 36% on 192). A question for the player.

## The signature: under the dome

The player's round 9: each map gets a threat of its own in waves 4–10, tied to its identity and its boss. The Citadel's identity is its shield; its boss is the Citadel itself. The signature (`MAP_SIGNATURE.citadel`, `dome` from wave 4):

- **Everything the Citadel fires from wave 4 leaves under its dome**, and so many more of the wave's own guided missiles and shells come off the Citadel (1 a wave on waves 4–6 and 8–10, 2 on wave 7; what is left of them after the wave's encounter took its own, or a guided missile in place of two of the wave's drones), spread over the wave, the keep lit as a raid's base first (rule `w-budget`: the wave sends no more);
- **while the shield stands, a missile inside the dome can't be shot** (`domed`: the player's shots and the helpers' are blocked, a flash where they land; the bots don't waste a shot on it), so it can be stopped only in the last breath between the dome's edge and the narrows, or the generators come down first and the whole flight is open; drawn ringed in the dome's cyan while it can't be shot.

The encounters add their own (`dome` on a beat): wave 4's guided missile, wave 5's, wave 7's two shells, wave 8's and wave 9's guided missiles, wave 10's grand salvo of four.

The signature asks the map's question every wave from 4: open the keep, or let its fire come and catch it at the dome's edge.

How much of waves 4–10 it is: TBD

## The counters

TBD

## Diversity: are the Citadel's best kits its own?

TBD

## Debuts

None: chapter 4's four new enemies (the Repair Ship, the Bodyguard Ring, the Lure Beacon, the Incendiary Missile) debut on the Coves; here they are regulars, as the planner draws them. One change, lab only (`MAP_FOE_SWAP_EARLY`): **on waves 2–5 the planner's Bodyguard Ring comes as a Lure Beacon**, another of chapter 4's own. A Bodyguard's heavy comes off the Citadel itself, a breath from the narrows, behind three guards, and on waves 2–5 it sank a third of a ship a run on its own (waves 1–5 lost 1.16 for the usual Armory on 192 seeds against the asked 0.4–0.8). From wave 6 the Bodyguard comes as drawn. The encounters bring nothing from a later chapter (there is none) and no new enemy.

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated, with filler on waves 1–6 (strings of two or three drones out of the far north-west silo, the map's only drone launcher, a long flight). The encounters take most of the shared waves' shells (the subs' salvos above all) and the map's heavies, clusters and motherships out of the waves (`replaces`), drones off the far silo in their place: a heavy off the Citadel is at the narrows in four seconds with eight hits, and was most of what sank the bot's ships. `CITADEL_CLIMB` sends 8–14% less than the shared wave from wave 2 (within ±15%, rule `w-budget`). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | Under the guns (`citadel-under-the-guns`) | far silo, 3 + 3 + 2 drones, over the whole map past the north generator | the lead ship as it sails into the narrows under the dome; the ships coming in |
| 2 | teach | Three generators (`citadel-generators`) | the Citadel, a shell; north-east silo, a guided missile; far silo, drones past the west islet's generator | the lead ship; halfway along; the ships coming in |
| 3 | teach | Into the narrows (`citadel-narrows`) | the Citadel, a cluster; north-east silo, a guided missile; 6 drones in place of the subs' shells | the lead ship in the narrows; halfway along |
| 4 | combine | Under the dome (`citadel-dome`) | the Citadel, a guided missile **under its dome**; north-east silo, a supersonic; 11 drones | the lead ship in the narrows; the ships coming in; halfway along |
| 5 | combine | Both ends (`citadel-two-ends`) | far silo, 2 shells; the Citadel, a guided missile **under its dome**; north-east silo, a guided missile; 8 drones | the ships coming in; the lead ship; halfway along |
| 6 | combine | Periscope by the carrier (`citadel-periscope`) | a sub by the carrier, a shell; 20 drones | the ships coming in (the safe stretch's turn); the lead ship and halfway along |
| 7 | escalate | The keep's battery (`citadel-keep`) | the Citadel, **2 shells under its dome** and a cluster; north-east silo, a guided missile and a supersonic; 18 drones | the lead ship in the narrows; halfway along; the ships coming in |
| 8 | escalate | Crossfire at the narrows (`citadel-crossfire`) | the Citadel, a guided missile **under its dome**; 22 drones from the far silo | the lead ship in the narrows; halfway along; the ships coming in |
| 9 | escalate | The whole fortress (`citadel-fortress`) | the Citadel, a cluster and a guided missile **under its dome**; north-east silo, a guided missile; far silo, 2 shells and 21 drones | the lead ship and halfway along; the ships coming in |
| 10 | climax | Grand salvo (`citadel-grand-salvo`), after the wave's own fire and a 6 s calm | the Citadel's grand salvo, **4 missiles at once under its dome** (2 guided at the lead ship and halfway along, 2 shells halfway along); north-east silo, 2 supersonics; 26 drones | the narrows; the ships behind |

TBD: wave 1 and wave 10 numbers.

## The boss plan: the Last Stand

TBD

## Bot results, before and after

TBD

## What is not satisfied, or uncertain

TBD

## The play log (v60)

`LOG_VERSION` 60, `LOG_REPLAYS` `[60]` (`src/v3/sim/playlog.ts`). The change is lab only, under the encounter layer: the campaign plays as at 57, and a 57 Citadel card log played today's convoy controls and the shared waves (it no longer replays to the same game). The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly. The version pins in the tests and e2e scripts moved to 60 (`python3 tools/v3/playtest-fixes/pins.py 57 60`, and `tests/v3/scorecard.test.ts`). The Test Lab's "Ready to test" lists the Citadel at v60. The combo sweep's results are in `tools/v3/combo-sweep/results/v60-ch4`.

## Questions for the player

TBD

## Checks run

TBD
