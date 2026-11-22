# The Rig Field: map card (map rebuild, chapter 3)

**Date:** 2026-11-22. The Rig Field (`rigs`, chapter 3 "Dark Water", the 13th map and the chapter's third) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), the way Battery Point (`docs/design/v3-ch3-battery.md`, #210) and Sowers' Reach (`docs/design/v3-ch3-sowers.md`, #213) were. Encounter rev 4; play log **v49**.

There is no player run of the Rig Field to start from. The starting point is the map as it was (the Test Lab card: today's convoy controls, the shared waves, the Dive Circus as its boss) and what the player asked of every rebuild: a question of its own and kits of its own, busier early waves ("more drones and easy things to kill", "less is more"), the climb from wave 4 to 9, no single-wave cliff, wave 10 the climax and not a wall, big and distinct boss set pieces, readable on an iPhone in landscape (874×402).

As it was, the map was flat for seven waves and then a cliff (192 seeds, the usual Armory: waves 1–7 lost 0.01–0.21 ships each, wave 8 1.41), its boss was nothing (0.11–0.18 ships a round), and its mechanic was over by wave 6: the bot shot every rig down whenever the sky was clear (on 12 seeds, 2 of 4 rigs down by wave 4, all four by wave 7), and from then the map was two far silos on the shore.

Code:
- `src/v3/data/encounters.ts`: `RIGS_R4` (ten encounters), the filler for waves 1–2 and 4–6 (`BUSY`), `RIGS_CLIMB`, `MAP_SIGNATURE.rigs` (`kind: 'rig'`: relief rigs), `RIGS_BOSS_ROUNDS` and `MAP_BOSS.rigs` (a boss round's `rigs`, `rigHp`, `barrage`; the boss's name, Rig Barrage), `CHAPTER_THREE_MAPS` (the Battery, the Sowers and the Rigs, in `REBUILT_MAPS`), the script's words for a relief rig;
- `src/v3/data/config.ts`: `TOW` (a relief rig's hits, speed, what it brings when it docks, its rack);
- `src/v3/sim/game.ts`: relief rigs (`towRig`, `updateTow`, `dockRig`; Threat `tow` and `rack`, Launch `tow`), `raiseRig` (the boss), `rigStations`, `rigAt`, `rigStandIn` (an encounter's launch off a rig brought down comes from the far shore instead); the wave planner sends the signature's relief rigs; the bots count a rig on its tow, and in the Rig Barrage every rig, as a threat to shoot (`worthShooting`);
- `src/v3/sim/events.ts`: the Dive Circus under the Rigs' boss tuning is the Rig Barrage (`rigBarrage`: rise, light, volley); with no boss tuning it plays as it did;
- `src/v3/ui/features.ts`: a relief rig drawn on its tow (a tug ahead on a line, a wake behind), and every rig's health bar against its own full hits;
- `src/v3/data/convoy.ts`: `MAP_CONVOY.rigs` (the campaign's schedule, no command); `src/v3/data/mapPlans.ts`: `MAP_PLANS.rigs`; `src/v3/data/lab.ts`: "Ready to test" lists the Rig Field at v49; `src/v3/sim/playlog.ts`: `LOG_VERSION` 49;
- tools: `tools/v3/rigs/` (as `tools/v3/sowers/`): `read.py` with `seeds.ts` (a tuning read on four processes), `budget.ts`, `wave1.ts`, `probe-boss.ts`, `compare.py` (the diversity check against chapter 2, the Battery and the Sowers), and two of its own: `rigsdown.ts` (how many rigs stand at the start of each wave) and `sunk.ts` (what sinks the ships, wave by wave); `tools/v3/combo-sweep/mixwaves.ts` counts the Rigs' signature (a rig on its tow, and its rack).

Bot reports: `tools/v3/map-report/results/rigs-player.md` (the usual Armory: Quick Reload 5, Damage Control 4, Stockpile 5), `rigs-latest.md` (Wide Warhead 5, Point Defense 4, Supply Lines 3), `rigs-plating.md` (Quick Reload 5, Armor Plating 5, Big Magazine 4), `rigs.md` (no Armory); each with a heat map and the counter and off-counter kits; the map as it was: `rigs-before*.md`. Tuning reads: the record report's bot on 192 seeds (900–1091), `python3 tools/v3/rigs/read.py --seeds=192 --armory=... [--tough]`. "Before" on 192 seeds was read on the base build (#214).

## How it is gated (lab vs campaign)

As every rebuild: **lab only, under the encounter layer.** The Test Lab's map card (`?lab=map-rigs`) opens on its production setup, policy D with no command, the map's own convoy at the campaign's schedule (new: before, it opened on today's convoy controls) and the authored encounters rev 4, because the Rigs are in `REBUILT_MAPS` (via `CHAPTER_THREE_MAPS`). The hub card reads "The map's own convoy (no commands) · encounters v1 Original". Everything new reads the run's encounter setup (`signatureOf`, `bossTune`), so the campaign, a run with no layer, a rev 3 log and the shared wave (`only: []`) play the Rig Field exactly as before: the shared waves, the planner's own new enemies and the Dive Circus. The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version.

## The problem

> Four enemy oil rigs stand in the sea just above the lane and fire at the ships from point-blank, the shortest flights on the map: each takes forty hits and one brought down stays down (its fire moves to the far shore, a long flight), but every shot at a rig is one not at a missile, and from wave 4 the enemy tows relief rigs in to stand where one fell.

The rigs are the map's one mechanic (rule `m-mechanic`; `data/maps20.ts`): west (300, 298; drones, guided), west-middle (690, 270; clusters, shells), east-middle (1080, 298; supersonic, guided), east (1440, 270; drones, motherships); forty hits each. A rig brought down stays down: three quarters of the wave's own launches that would have come off it come off a launcher still standing (in practice one of the two far-shore silos, (500, 68) and (1250, 68), a long flight), the rest are lost; and since v49 an encounter's launch off it comes off the far-shore silo nearest it (`rigStandIn`). So bringing a rig down does not make the waves smaller: it makes their fire come from further away, with more warning.

The question: **forty hits on a rig now, for warning later, or every shot at what is coming?** The rigs' own fire is the fastest on the map (a guided missile off the west rig is over the lane in about a second and a half), and from wave 4 the answer is contested: a relief rig under tow (eight hits) sails in along the rig line to stand where a rig fell, with twenty hits, its rack loaded.

The mechanic is in every wave (rule `g-mechanic`): every wave fires from at least one rig (waves 1–10), the relief rigs come in waves 4, 7, 8 and 10 (and as every wave's own new enemies from wave 4), wave 9 fires all four at once, and the boss rounds are the rigs.

How it differs from the other rebuilt maps: there the danger is aimed at a place (an island's side, a lock, the guns), a ship (the tanker) or drifts (the mines); here it comes from launchers the player can remove, and the choice is when to spend the shots.

## Sites and their jobs

Bases and spots are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| West rig (base 1) | In the sea over the way in (300, 298) | drones, guided | Point-blank over the ships coming in: a guided missile (w3, w9), swarms at the way in (w2, w4, w6, w10) and anywhere (w5, w7–w9); the filler's drones. |
| West-middle rig (base 2) | In the sea (690, 270) | clusters, shells | The rig of the map's question: a shell (w2), a cluster then a shell at the middle (w5), a cluster at the ships coming in (w7), shells in the whole field's volley (w9) and at the way in (w10). |
| East-middle rig (base 3) | In the sea (1080, 298) | supersonic, guided | A supersonic locked on the ship halfway along (w7), a guided missile in the whole field's volley (w9). |
| East rig (base 4) | In the sea over the delivery end (1440, 270) | drones, motherships | Drones at the lead ship on wave 1, then swarms at the ship halfway along (w3–w6, w9) and anywhere (w7, w8, w10); the filler's other drone launcher. |
| Far-shore silos (bases 5–6) | (500, 68), (1250, 68) | shells, heavies | The long flight: shells at the ships coming in (w4) and at the lead ship (w6, w10); every rig's fire once it is down. |
| Sub spot 1 | Between the west rigs and the lane (500, 405) | sub salvos | A periscope at the ships coming in (w6). |
| The edges | West and east, along the rig line | relief rigs | From wave 4: the signature, towed in to a downed station. |
| Roads, other spots, air | The shore road, the pop-up road at 880, the near spots, the edges | trucks, subs, jets, bombers | The shared waves' own. |

Warning time falls from 10.8 s on wave 1 to WARNEND on wave 10 (rule `g-warning`; before: 9.9 to 4.1 s).

## The stretches

STRETCHES

## The convoy

The map's own convoy at the campaign's schedule (`MAP_CONVOY.rigs`: flow 1, pairs), no command (rule `m-convoy`: the rigs are answered by shooting, not by sailing). Before the rebuild the card played today's convoy controls; the convoy is the Battery's and the Sowers'.

## The signature: relief rigs

The player's round 9: each map gets a threat of its own in waves 4–10, tied to its identity and its boss. The Rigs' identity is the rigs; its boss is the rigs risen again. The signature (`MAP_SIGNATURE.rigs`, from wave 4) is the rigs coming back:

- **The wave's new enemies come as relief rigs** (`kind: 'rig'`, `foeShare: 1`), each in place of the enemy the planner drew (so it takes out of the wave what that one would have, rule `w-budget`);
- a relief rig is towed in from the edge nearer its station, along the rig line (48 px/s: 7–13 s on the water), **eight hits to sink on the way** (`TOW`), with a tug ahead of it on a line and a wake behind;
- it makes for a **downed station** (one no other tow is making for, the one nearest the ship least far along); docked, it **stands there with twenty hits** and the station launches again ("RIG RAISED"). With no station down it **mends the most damaged rig standing** by twenty hits ("RIG MENDED");
- either way it comes loaded: **one guided missile off the station at the ship nearest it**, 1.5 s after it docks, its deck lit first.

Sunk on its way in, a relief rig drops nothing ("TOW SUNK"). The encounters add their own (wave 4's from the west, wave 7's from the east, wave 8's two, wave 10's two), each standing in for one of the wave's own (`replaces.extras.rig`).

How much of waves 4–10 it is (`tools/v3/combo-sweep/mixwaves.ts`, 8 seeds, the "you" bot drafting for itself, tough; a rig on its tow and its rack):

SIGSHARE

Under the asked quarter, as on the Sowers (19%). A relief rig is a few big targets, not many small ones, and the bot sinks most of them on the way in. Tried: twelve hits a tow (the usual Armory's win 64% → 53% on 192 seeds). The rigs standing from the start, the map's mechanic, are not counted as the signature.

## The counters

COUNTERS

## Loadouts on this map (combo sweep singles)

SINGLES

## Diversity: are the Rigs' best kits their own?

DIVERSITY

## Debuts: "New on Dark Water"

Not applicable here: chapter 3's five new enemies all debut on the Battery, waves 2–6, each with its "New on Dark Water" card (rule `m-debut-tag`). A relief rig is a rig, the map's own structure, standing from its wave 1 (its tests treat it as the map's own, `tests/v3/mapRules.test.ts`). The planner's draws on the Rigs' waves 2–3 (a siege battery or a dive bomber) are the shared wave's; from wave 4 the signature makes them relief rigs. The encounters bring nothing from a later chapter.

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated, with filler on waves 1–2 and 4–6 (a string of two or three drones out of the two drone rigs; wave 1 one late string out of the east rig only, wave 3 none: the drone rigs are a short flight from the lane, and the wave's own drones already cost the no-Armory bots on wave 1). From wave 3 **every shell the shared waves would send comes out of them** (the encounters take them, `replaces.ballistic` at the table's), and from wave 7 **every guided missile too**: what a wave sends of those comes off the rigs (or the far shore, for a rig that is down); the encounters send drones in their place, so a wave sends about what the shared one does. `RIGS_CLIMB` sends 4–14% less on waves 1–10, within ±15% (rule `w-budget`). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | Point-blank (`rigs-point-blank`) | east rig, 3 drones; west rig, 2 drones | the lead ship |
| 2 | teach | Bring one down (`rigs-bring-down`) | west-middle rig, a shell; west rig, 4 drones | the ship halfway along |
| 3 | teach | Under the rigs (`rigs-under`) | west rig, a guided missile; east rig, 4 drones | the ship halfway along |
| 4 | combine | The relief tow (`rigs-relief`) | a relief rig from the west; far-shore west silo, a shell; swarms of 4, 4 and 3 off the drone rigs | a downed station; the ships coming in; the middle |
| 5 | combine | Rig or volley (`rigs-rig-or-volley`) | west-middle rig, a cluster then a shell 7 s later; swarms of 5 and 5 | the ship halfway along |
| 6 | combine | Periscope among the rigs (`rigs-periscope`) | a sub between the west rigs and the lane, 2 shells; far-shore east silo, a shell; swarms of 6 and 5 | the ships coming in (the salvo); the lead ship (the far shell): both ends |
| 7 | escalate | Lock from the rig (`rigs-supersonic`) | east-middle rig, a supersonic; west-middle rig, a cluster; a relief rig from the east; swarms of 7, 6, 6 and 5 | the middle; the ships coming in; a downed station |
| 8 | escalate | Two tows (`rigs-two-tows`) | relief rigs from the west and 5 s later the east; swarms of 7, 6, 7 and 7 | two downed stations; any ship |
| 9 | escalate | The whole field (`rigs-whole-field`) | all four rigs at once: a guided missile off the west and east-middle, a shell off the west-middle, 4 drones off the east; swarms of 7, 5 and 5 | the ship halfway along (the volley converges) |
| 10 | climax | The last relief (`rigs-last-tow`), after the wave's own fire and a 6 s calm | relief rigs from the west and 3 s later the east; west-middle rig, a shell; far-shore east silo, a shell; swarms of 6, 6, 6, 5 and 5 | the ships coming in; two downed stations; the lead ship; any ship |

WAVE1

WAVE10

## The boss plan: the Rig Barrage

The Rigs' event was the Dive Circus: eight dive bombers on a 2.3 s beat and three pairs of guided missiles, every round, and it barely touched the bot (0.11–0.18 ships a round). The Dive Bomber is a regular of the Battery's waves by now, so the player has met it as a regular threat; the boss under encounter rev 4 is new (`RIGS_BOSS_ROUNDS`, lab only; the event's id stays `dive-circus`, as Saltgate's Gatecrashers kept Run the Canal's): **the Rig Barrage**. As each round opens the downed rigs **rise again** out of the sea (the middle two first, then the west and the east) until so many stand, eight hits each (a rig still standing keeps its own, up to forty); then **every rig standing fires its volley together** at the one ship nearest halfway along, its deck lit 1.5 s first: a guided missile off each missile rig, two shells off the west-middle rig, four drones off the east rig, all converging on the clustered convoy. A rig brought down fires no more volleys; in the Rig Barrage the bot shoots a rig as it would a missile.

| Round | Rigs standing (at least) | Hits a risen rig | Volleys | Apart |
| --- | --- | --- | --- | --- |
| before (every round) | 8 dive bombers on a 2.3 s beat, 3 guided pairs | – | – | – |
| 1 | 2 | 8 | 3 | 6.5 s |
| 2 | 3 | 8 | 3 | 7 s |
| 3 | 4 | 8 | 3 | 8 s |

The intro is the shared cards (log v30): "Boss round", "Convoy restored", "The boss: Rig Barrage", "Round 1 of 3", then "Round 2 of 3" and "Round 3 of 3". Each round lasts 15–30 s (test, seed 219).

The map's whole question is in it: a player who brought the rigs down early meets two, three, then four risen rigs of eight hits; a player who never did meets four rigs of forty from round 1.

How it reads (192 seeds, normal runs that reached it):

BOSSTABLE

## Bot results, before and after

"Before" is the map card as it was (log v48): today's convoy controls, no encounters, the Dive Circus (`tools/v3/map-report/results/rigs-before*.md`, 24 seeds; and 192 seeds on the base build). "After" is this build. The record reports are 24 seeds (900–923; `npx vite-node tools/v3/map-report/report.ts -- --map=rigs --seeds=24 [--armory=player|latest|plating] --kits=plan`); the reads below are 192 seeds (900–1091), the same bot and setup (`python3 tools/v3/rigs/read.py --seeds=192 --armory=... [--tough]`).

### The headline (192 seeds, normal runs)

HEADLINE

### The record reports (24 seeds, 900–923)

RECORD

### Rigs difficulty (rule `m-difficulty`; the brief: win 50–70%, waves 1–5 0.4–0.8)

DIFFICULTY

## What is not satisfied, or uncertain

UNCERTAIN

## The play log (v49)

`LOG_VERSION` 49, `LOG_REPLAYS` `[49]` (`src/v3/sim/playlog.ts`). The change is lab only, under the encounter layer: the campaign plays as at 48, and a 48 Rig Field card log played today's convoy controls and the shared waves (it no longer replays to the same game). The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 49 (`python3 tools/v3/playtest-fixes/pins.py 48 49`, and `tests/v3/scorecard.test.ts`). The Test Lab's "Ready to test" lists the Rig Field at v49. The combo sweep's results are in `tools/v3/combo-sweep/results/v49-ch3`.

## Questions for the player

QUESTIONS

## Checks run

CHECKS

## Tests

- `tests/v3/encounters.test.ts`:
  - the ten listed, rev 4, v1 only, none at rev 3; `REBUILT_MAPS` has the Rigs; the map with no authored encounters checked is now the Lantern;
  - the budget, legality (a relief rig from an edge, from the signature's first wave, on a map with rigs), warning and replay checks cover the map; a relief rig is not counted as a launch (it is a structure on the water: its tow is its warning);
  - the mechanic is in the waves: a beat off a rig in every wave 1–10, relief rigs in waves 4, 7, 8 and 10;
  - the Rig Barrage's rounds: no dive bomber, the rigs' volleys, more rigs each round and more fire; a rev 3 log and the campaign play the Dive Circus and nothing else; 15–30 s a round; the boss's name "Rig Barrage" under the layer, "Dive Circus" before it; a round raises the downed rigs (the middle two first) until so many stand and a standing rig keeps its hits;
  - the signature: from wave 4 every new enemy the wave sends is a relief rig, the campaign and the shared wave keep the planner's own; none before wave 4, before rev 4 or on the shared wave;
  - a relief rig sails in along the rig line to a downed station and stands there again with `TOW.dock` hits and fires its rack; with none down it mends the most damaged rig; sunk on the way, it drops nothing and the station stays down;
  - the filler: waves 1–2 and 4–6, wave 1 one string.
- `tests/v3/mapRules.test.ts`: no repeats and no gaps; `MAP_PLANS` complete; the boss target is 2; the notes name the rigs they fire from; a relief rig is the map's own structure (its chapter is the map's).
- `tests/v3/mapCards.test.ts`, `round11.test.ts`, `convoy.test.ts`: the production setup is policy D with the encounters, no command, at the campaign's schedule ("The map's own convoy (no commands) · encounters v1 Original"); the Lantern is now the next map with neither. `tests/v3/round12fixes.test.ts`: wave 1 opens with three drones off the east rig and two off the west, and loses no ship (seeds 11–13, "you" and casual).
- `tests/v3/readyToTest.test.ts`: the new entry. `tests/v3/scorecard.test.ts`: the log is version 49.
- `e2e/v3-map-cards.mjs`: the hub card says so. `e2e/v3-encounters.mjs`: the card opens with its encounters and no command, the pause screen's script names the Rig Barrage, and skipped to the boss, the rigs risen again fire their volleys together (a shot at one pixel a point: `e2e/shots/v3-encounters/rigs-boss.png`).

## What to look for when you play

Four enemy oil rigs stand in the sea right above the lane and fire at your ships from close range: missiles, shells, clusters and drones with hardly any warning. Each rig takes forty hits; one you bring down stays down, and what it would have fired comes from the far shore instead, with much more warning. From wave 4 a tug tows a relief rig in along the rigs to stand where one fell: sink it on the way (eight hits) or it stands again and fires as it docks. Wave 9 fires every rig at once. In the boss rounds the downed rigs rise out of the sea and every rig fires a volley together at the middle of the convoy, more rigs each round. The questions: is bringing a rig down worth the shots, can you read the tows and the volleys on the phone, and do the three boss rounds rise?

(This section names no weapon to try: the counter kit above is a design note for the bots, never shown in the game or on the hub.)
