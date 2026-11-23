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

## Round 15 (log v55): rigs count shots, a better tow, busier early waves

Your run of 2026-11-22 (v49, won, fun 5, boss 3, waves 1-3 rated 1, 2 and 1; `tools/v3/bot-fit/logs/v3-20261122040236-18317.json`): "The bringing in of the oil rig was hilarious, keep that and improve that animation a lot", and "make the oil rigs stronger ... it has to basically consume X amount of your ammo to be destroyed". Built (details: `docs/design/v3-playtest-fixes.md`, "Round 15"):

- **Rigs count shots, not damage** (`SHOT_RIGS`, `rigShot`): one a shot whatever its damage (a Railgun round, a warhead, a powered-up shot); a seeker's third a third; an area weapon once a rig a step; a flak cloud or burning row once a rig for its whole life; the Nuke and the golden bomb 3. A rig standing from the start takes **32 shots** (`RIG_SHOTS.rig`; was 40 hits), a relief rig on its tow 10 (was 8), docked 20, a risen boss rig 8. Each rig shows its shots left in a pill over it.
- **Your log, replayed** (`tools/v3/rigs/killtimes.ts`): you had all four rigs down 65 s in. Your Flak clouds did 30-36 of the 40 hits on five of the rigs you sank; by the new count those took 6-11 shots, and now take 32. The plain gun's rigs (40 shots) now take 32: at 40 the bot won 42-45%.
- **The tow-in**, drawn again: a tug with a wheelhouse, a smoking funnel, a bow wave and churn; a sagging tow line; the rig rolling on its legs with its own bow wave and wake; the tug easing off and the line going slack near the station; on docking a splash ring, spray, a dip and settle, and the tug casting off.
- **Early waves:** wave 1 four drones in two late strings (was one string of two; earlier or western strings sank ships for the bots), wave 2 three strings (was two), wave 3 one (none); waves 3-5 a little less of their own; the Rig Barrage's round 1 two volleys (was three), round 2 a little slower.
- **A bug:** a relief rig drawn by the planner could be loaded on a truck and fired at a ship like a missile (since v49). Fixed: a structure is never a truck's load.

| Armory (192 seeds, normal) | v49 won / waves 1-5 | v55 won / waves 1-5 | v55 boss r1 / r2 / r3 |
| --- | --- | --- | --- |
| usual | 64% / 0.82 | **53% / 0.80** | 0.77 / 1.07 / 2.02 |
| latest | 40% / 1.33 | 21% / 1.67 | 0.86 / 1.45 / 1.64 |
| plating | 89% / 0.57 | 85% / 0.60 | 0.26 / 0.49 / 1.01 |

Tough runs, the usual Armory: .01 .07 .24 .24 .38 .73 .67 .72 1.06 1.27, boss .81 1.11 2.16; no step doubles (the largest 1.92x, wave 6). The latest set (Wide Warhead 5) falls furthest: a warhead's damage no longer brings a rig down faster, which is the rule you asked for. The sections below are the v49 build's and stand as they were measured.

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

Warning time falls from 10.8 s on wave 1 to 6.0 s on wave 10 (rule `g-warning`; before: 9.9 to 4.1 s).

## The stretches

- **Danger: the middle**, the open water between the west-middle and east-middle rigs, where the rigs' volleys and swarms meet the ship halfway along: 42% of the hull damage in waves 1–9 (the usual Armory's record report; 34–41% for the other Armories; before: 41%).
- **Safe: the late third**, the east, where the ships deliver under the east rig, a drone launcher: 27% (24% for no Armory, 31–32% for the latest and plating sets): the record report flags it, as it did before (26%). The waves aim the east rig's swarms at the middle from wave 3 and only a shell at the lead ship on waves 6 and 10.
- **The way in, the west** (31%), under the west rigs, takes the point-blank shots at the ships coming in.
- Rule `m-carrier` asks that the danger stretch not be the carrier's closest; here it is (the carrier sits at (900, 742), under the middle), as on the Sowers and as before the rebuild. The plan was the west as the danger (the way in, under the two west rigs); the waves' fire at the ships coming in kept losing the bot more than the middle's (a cluster or shells point-blank on a bunched convoy), and moving it there cost the early waves their band. A question for the player (below).

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

| | Waves 4–10 | Waves 6–10 | Boss rounds |
| --- | --- | --- | --- |
| Share of the threats that show | 3% | 3% | (the boss is the rigs themselves: 22% of what shows, with their volleys the rest) |
| Share of the hits it takes to clear them | **9%** | 10% | – |

Under the asked quarter, as on the Sowers (19%). A relief rig is a few big targets, not many small ones, and the bot sinks most of them on the way in. Tried: twelve hits a tow (the usual Armory's win 64% → 53% on 192 seeds). The rigs standing from the start, the map's mechanic, are not counted as the signature.

## The counters

- **Counter kit: Shrapnel Shell, Gravity Well, Flak Cannon.** Everything the rigs fire comes in a short flight and meets at one place: the Shrapnel burst takes a volley as it converges, the Gravity Well pulls it and the swarms off the ships, the Flak cloud sits where the rigs' short flights cross the lane.
- **Off-counter kit: Tesla Arc, Full Steam, Point Defense.** The Tesla's chain wants strings of small things in a line (the Sowers' best), not a volley from four rigs; Full Steam sails the convoy under the rigs faster, not past them; Point Defense waits at the carrier for what comes near it.
- Both chosen from the combo sweep's singles at the final build (Shrapnel 4.8, Gravity Well 5.1, Flak 5.5; Tesla 7.4, Full Steam 8.0, Point Defense 8.5), avoiding a weapon in one of the map's five best kits. Every weapon is in chapter 3's draft. A design note for the bots only: nothing in the game nudges the player towards it.

How they compare (bot reports, 24 seeds, the kit as the bot's taste):

| Armory | Kit | Won | Lost in waves 1–10 (normal / tough) | Boss r1 / r2 / r3 (reached) |
| --- | --- | --- | --- | --- |
| usual (Quick Reload, Damage Control, Stockpile) | counter | **71%** | 3.1 / 3.5 | 0.52 / 1.43 / 2.19 |
| | off-counter | 63% | 3.1 / 3.5 | 0.90 / 1.38 / 1.65 |
| latest (Wide Warhead, Point Defense, Supply Lines) | counter | 42% | 4.3 / **6.0** | 1.00 / 1.36 / 1.79 |
| | off-counter | 42% | 4.3 / 6.9 | 1.00 / 1.71 / 1.93 |
| plating (Quick Reload, Armor Plating, Big Magazine) | counter | **92%** | 2.0 / 2.8 | 0.27 / 0.68 / 0.68 |
| | off-counter | 83% | 2.2 / 2.9 | 0.40 / 0.75 / 0.75 |
| none | counter | 0% | 5.8 / 20.0 | – |
| | off-counter | 0% | 5.7 / 20.8 | – |

The counter kit does better or the same with every Armory (it wins 8–9 points more with the usual and plating sets, and loses 0.9 fewer ships on the tough runs with the latest set), but not clearly better: on 24 seeds the gaps are within the noise. Neither is trivial.

## Loadouts on this map (combo sweep singles)

Each weapon alone, forced at every draft (12 seeds, the player's usual Armory, version 49; `npm run v3:combo-sweep -- --stage=singles --maps=rigs --out=tools/v3/combo-sweep/results/v49-ch3`). Ships lost over all 13 waves:

- **Strong:** **Shrapnel Shell 4.8**, Gravity Well 5.1, Flak 5.5, Thermobaric 5.8, Air Strike 5.9, Scattergun 6.1, Overdrive 6.2, Boomerang 6.3.
- **Middling:** Gunship Pair and Orbital Strike 6.5, Seeker 6.6, Frigate Escort and Railgun 6.9, Shield 7.3, Tesla 7.4, Drone Screen 7.7.
- **Weak:** Full Steam 8.0, Point Defense 8.5, Supply Run alone 9.6, Bomber Wing 9.8, Focus Fire, Grapnel and the Charge Lance 11.9, the plain gun 15.0, Dual Wield 16.0, the Laser Cutter (it only cuts) 66.6. The bot drafting for itself: 9.8 (won 58%).
- The singles moved between the builds swept while tuning (12 seeds: Railgun 5.5 on an early build, 6.9 on the final one), so the order of the top few is noise; the counter kit is from the final build.

## Diversity: are the Rigs' best kits their own?

The player's rule for each rebuild: its best kits and its best weapon alone must differ from the other maps', and Air Strike should not be over-dominant. The Rigs were swept the chapter 2 way (singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16), and compared with the five chapter 2 maps, the Battery and the Sowers from their last sweeps (`docs/design/v3-combo-diversity.md`, "The Rig Field"; `python3 tools/v3/rigs/compare.py`).

| | Result |
| --- | --- |
| Top 5 kits | **Gravity Well + Drone Screen + Gunship Pair** 5.1, Shrapnel Shell + Flak Cannon + Shield 5.4, Shrapnel Shell + Thermobaric Shell + Supply Run 5.5, Air Strike + Boomerang + Orbital Strike 5.7, Air Strike + Orbital Strike + Overdrive 5.9 |
| Jaccard of the top-5 kits, against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers | **0 / 0 / 0 / 0 / 0 / 0 / 0** |
| The same, the Rigs against itself (two halves of its seeds) | 0.67 |
| #1 kit | in no chapter 2 or chapter 3 map's top 5 |
| Best weapon alone | **Shrapnel Shell** 4.8 (the best single on no other rebuilt map) |
| Rank correlation of the weapons alone, against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers | 0.43 / 0.51 / 0.49 / 0.77 / 0.44 / 0.60 / 0.58 |
| Air Strike | 5th of 25 alone (5.9); in two of the five best kits, never the #1 |

- **All five of the Rigs' best kits are its own**, and its best weapon alone is its own: the Shrapnel Shell, whose burst takes a volley as it converges.
- **Air Strike is not over-dominant** (fifth alone, in two of five kits).
- **Its weapons alone rank most like the Archipelago's** (0.77: launchers close over the lanes there too), least like the Island's and Saltgate's.

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

Wave 1 loses no ship on the record reports with any Armory. With no Armory at all (60 seeds, `tools/v3/rigs/wave1.ts`) the casual bot loses 0.12 ships a run on it and the "you" bot 0.13, all to drones (before the rebuild, the casual bot 0.18 on 40 seeds): the drone rigs are the only drone launchers and stand a short flight from the lane, so wave 1 sends a little less (`RIGS_CLIMB` ×0.9), its first drones come off the east rig at the lead ship and the west rig's only once the convoy is past it, and its filler is one late string off the east rig.

**Wave 10, the climax:** after a 6 s calm, two relief rigs come in at once while the rigs fire at the way in; with wave 9, the hardest regular waves for every Armory (192 seeds, normal: 0.73 for the usual Armory, 0.85 latest, 0.46 plating; before 1.16–1.59), and no step to it doubles the wave before.

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

| Armory | Before r1 / r2 / r3 | After r1 / r2 / r3 |
| --- | --- | --- |
| usual | 0.18 / 0.11 / 0.15 | **1.01 / 1.32 / 1.87** |
| latest | 0.36 / 0.46 / 0.57 (28 runs reached it) | **1.17 / 1.76 / 1.49** (117, 117, 102) |
| plating | 0.03 / 0.12 / 0.13 | **0.35 / 0.45 / 1.06** |

Rising for the usual and plating Armories, under the asked 1.5 / 2 / 2.5 a round as on every rebuilt map: the convoy is restored before the boss and the loss limit is six, so rounds at 1.5 / 2 / 2.5 would end about half the runs that reach them (at 0.95 / 1.38 / 2.07, an earlier build, the usual Armory won 50%). With the latest set round 3 reads lower than round 2 among the runs that reach it (the runs that lose in round 2 are the weak ones); on the tough runs, where every seed plays every round, it rises: 1.27 / 1.86 / 2.04.

## Bot results, before and after

"Before" is the map card as it was (log v48): today's convoy controls, no encounters, the Dive Circus (`tools/v3/map-report/results/rigs-before*.md`, 24 seeds; and 192 seeds on the base build). "After" is this build. The record reports are 24 seeds (900–923; `npx vite-node tools/v3/map-report/report.ts -- --map=rigs --seeds=24 [--armory=player|latest|plating] --kits=plan`); the reads below are 192 seeds (900–1091), the same bot and setup (`python3 tools/v3/rigs/read.py --seeds=192 --armory=... [--tough]`).

### The headline (192 seeds, normal runs)

| Armory | Won before → after | Waves 1–5 lost | Waves 1–10 lost | Wave 8 | Wave 10 |
| --- | --- | --- | --- | --- | --- |
| **usual** (Quick Reload 5, Damage Control 4, Stockpile 5) | 59% → **64%** | 0.31 → **0.82** | 3.74 → 3.08 | 1.41 → 0.39 | 1.32 → 0.73 |
| latest (Wide Warhead 5, Point Defense 4, Supply Lines 3) | 15% → **40%** | 2.21 → **1.33** | 5.69 → 4.14 | 2.16 → 0.64 | 1.59 → 0.85 |
| plating (Quick Reload 5, Armor Plating 5, Big Magazine 4) | 57% → **89%** | 0.60 → **0.57** | 3.84 → 2.15 | 1.02 → 0.40 | 1.16 → 0.46 |
| none | 1% → 1% | 4.00 → 3.94 | 5.84 → 5.88 | 1.59 → 1.34 | 1.88 → 1.36 |

Normal-run curves, waves 1–10 then the boss rounds (runs that reached each):

| Armory | Before | After |
| --- | --- | --- |
| usual | .02 .01 .11 .01 .16 .16 .21 1.41 .83 1.32 · boss .18 .11 .15 | .01 .11 .27 .16 .29 .33 .31 .39 .72 .73 · boss 1.01 1.32 1.87 |
| latest | .01 .06 .52 .39 1.27 .70 .84 2.16 1.09 1.59 · boss .36 .46 .57 | .01 .13 .46 .40 .36 .57 .53 .64 .84 .85 · boss 1.17 1.76 1.49 |
| plating | .01 .01 .12 .16 .31 .31 .46 1.02 .89 1.16 · boss .03 .12 .13 | .01 .07 .16 .12 .22 .20 .15 .40 .48 .46 · boss .35 .45 1.06 |

Tough-run curves (every seed plays every wave; the cliff check), 192 seeds. Before: usual .02 .01 .11 .01 .16 .16 .20 1.87 .97 2.01 (wave 8 ×7.5 the wave before); latest .01 .06 .52 .54 2.05 1.20 1.71 5.18 3.69 5.08; plating .01 .01 .12 .17 .33 .32 .55 1.62 1.44 2.09. After: usual .01 .11 .29 .22 .39 .42 .43 .52 .97 .82; latest .01 .13 .47 .48 .43 .77 .82 .97 1.18 1.23; plating .01 .07 .16 .13 .25 .29 .32 .50 .62 .56. **No step doubles on 192 seeds** for any of the three player Armories (the largest: 1.87× on wave 9 for the usual set, 1.79× on wave 6 for the latest, 1.6× on wave 8 for the plating set; a wave under 0.25 counts as 0.25, as the report counts it).

### The record reports (24 seeds, 900–923)

| | Before latest / plating / usual / none | After latest / plating / usual / none |
| --- | --- | --- |
| Won (normal) | 13% / 46% / 63% / 0% | **29% / 92% / 63%** / 0% |
| Waves 1–5 lost (normal) | 2.25 / 0.21 / 0.29 / 3.96 | 1.17 / 0.88 / 0.63 / 3.75 |
| Waves 1–10 lost (normal) | 5.7 / 4.0 / 3.2 / 6.1 | 4.9 / 2.3 / 3.4 / 5.7 |
| Boss r1 / r2 / r3 (normal, reached) | 0 / 0 / 0 (3 runs); 0.09 / 0.36 / 0.18 (11); 0.27 / 0.07 / 0.20 (15); – | 1.60 / 1.70 / 1.22 (10, 10, 9); 0.41 / 0.77 / 1.18 (22); 0.85 / 1.55 / 1.95 (20, 20, 19); – |
| `w-cliff` (tough) | FLAG (w5, w8); FLAG (w7); FLAG (w8: 0.04 → 1.33); FLAG (w3, w5, w8) | FLAG (w6: 0.33 → 0.71); FLAG (w5: 0.13 → 0.54); FLAG (w9: 0.50 → 1.25); FLAG (w3): 24 seeds; **no step doubles on 192 for the three player Armories** |
| `w-early` close calls from w3 | PASS | PASS; FLAG (plating, 0.88 on w3); PASS; PASS |
| `w-budget` ±15% | PASS | **FLAG** (furthest ×0.81–0.84, waves 3, 9 and 10; below) |
| `m-stretches` | FLAG (cold late 25–28%); PASS for none | FLAG (hot middle 34–42%, cold late 27–31%; plating cold early 26%); PASS for none (24%) |
| `g-warning` | PASS: 9.9 → 4.1 s | PASS: 10.8 → 5.7–6.0 s |
| `w-first` | PASS | PASS |

The 24-seed record and the 192-seed reads disagree by up to 11 points on a win rate here (latest: 29% against 40%); the larger read is the one to trust.

### Rigs difficulty (rule `m-difficulty`; the brief: win 50–70%, waves 1–5 0.4–0.8)

- **The usual Armory wins 64%**, in the band (before 59%, but a flat map with a wave-8 cliff and no boss). **The latest set 40%**, under it (before 15%; the Battery's 28%, the Sowers' 56%); **the plating set 89%**, over it, as on the Battery (72%) and the Sowers (83%): no single tuning puts the three in 50–70% together.
- **Waves 1–5:** 0.82 for the usual Armory (a little over 0.8; before 0.31) and 0.57 for the plating set; the latest set 1.33 (before 2.21).
- **The climb from wave 4 to 9** rises for the usual Armory (.16 .29 .33 .31 .39 .72, then .73 on wave 10), wave 7 a step down (.31) and wave 9 the steepest step (×1.9).
- **Wave 10** is about as hard as wave 9 with every Armory (the climax is the two of them), and no step to it doubles.
- **Busier early waves:** threats on the board at a moment 1.9, 1.8, 1.8 on waves 1–3 (before 1.8, 1.6, 1.7), kills a minute 46, 46, 45 (before 45, 41, 43), the usual Armory (record reports).
- **The mechanic:** the bot brings the rigs down as before (24 seeds: 0.7 down at the start of wave 3, 2.8 by wave 5, 3.8 by wave 6; relief rigs stand some back up, 3.6–4.0 down from wave 7); what changed is that the waves' fire, shells and missiles above all, is the rigs' (or the far shore's once a rig is down), so the rigs matter all map long.

## What is not satisfied, or uncertain

- **The bot report's `w-budget` flags waves 9–10 (and 3 for two Armories): ×0.81–0.84 of the wave with encounters off.** The report counts launches, and a relief rig is not one (it is a structure on the water), while the enemy it stands in for (a new enemy from the planner) was about five launches; waves 9 and 10 carry the most relief rigs. As planned, every wave is within ±15% of the shared wave on the same dice (`tools/v3/rigs/budget.ts`: ×0.91–1.04) and the encounter test's budget check passes. Counting a tow as the swarm and missile it stands in for, the report's waves would be within the band.
- **The signature is 9% of the hits in waves 4–10**, under the asked quarter (the Sowers 19%, the Battery 25%). A relief rig is one big target and the bot sinks most of them on the way in (and from wave 6 every station but one is usually down, so it rarely mends a rig). Twelve hits a tow, on an earlier build, cost the usual Armory's win 64% → 53%.
- **The danger stretch is the carrier's own**, the middle (42%), against rule `m-carrier`, as on the Sowers and before the rebuild (41%); and the late third, the safe one, takes 27% (the line is 25%; before 26%). The first plan had the way in as the danger; it took the early waves out of their band.
- **The bot brings the rigs down early, as before** (all but one down by wave 6 on most seeds). The rebuild makes that a smaller win than it was: a rig down moves its fire to the far shore (the planner's 75% and, since v49, every encounter launch), it does not remove it. Whether a player spends forty hits on a rig at all is the map's open question, and the bot cannot answer it.
- **The two Armories again:** the usual set wins 64%, the latest 40%, the plating 89% (192 seeds). As on the Battery and the Sowers, no single tuning puts all three in 50–70%.
- **Waves 1–5 for the usual Armory: 0.82** (192 seeds; 0.63 on the record), a hair over the asked 0.8; the latest set 1.33.
- **The boss is under 1.5 / 2 / 2.5** (1.01 / 1.32 / 1.87 for the usual Armory) to keep the win rate, as on every rebuilt map; with the latest set round 3 reads lower than round 2 among the runs that reach it (it rises on the tough runs).
- **The 24-seed cliff check flags** one wave for every Armory; on 192 tough seeds no step doubles for the three player Armories. The sim is chaotic here as on the Sowers: moving one cluster on wave 5 moved wave 9 by 0.3.
- **The counter kit is not clearly better** than the off-counter on 24 seeds (better or equal with every Armory, within the noise), and the singles moved between builds (Railgun 5.5 → 6.9 on 12 seeds).
- **Late waves are mostly drones.** From wave 7 the shared waves' guided missiles, and from wave 3 their shells, come only off the rigs (or the far shore): what showed in waves 4–10 is 72% drones (the Sowers' 60%). It is what kept the late waves off a cliff, and it is the player's "more drones and easy things to kill"; but the late waves' danger is now the rigs' fire, the aircraft and the extras (clusters, supersonic, motherships).
- **The dive bombers are gone from the Rigs' boss** (the Dive Circus's own) under the layer; the campaign keeps the Dive Circus.

## The play log (v49)

`LOG_VERSION` 49, `LOG_REPLAYS` `[49]` (`src/v3/sim/playlog.ts`). The change is lab only, under the encounter layer: the campaign plays as at 48, and a 48 Rig Field card log played today's convoy controls and the shared waves (it no longer replays to the same game). The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 49 (`python3 tools/v3/playtest-fixes/pins.py 48 49`, and `tests/v3/scorecard.test.ts`). The Test Lab's "Ready to test" lists the Rig Field at v49. The combo sweep's results are in `tools/v3/combo-sweep/results/v49-ch3`.

## Questions for the player

- **Are the rigs worth the shots?** The bot shoots a rig whenever the sky is clear and has all four down by wave 6; a rig brought down moves its fire to the far shore (more warning), it does not take it away. Recommended: play it and say whether bringing one down felt worth forty hits. If not, the next build can make a downed rig's fire lighter (half its launches lost, not a quarter) rather than only further away.
- **Can you read the relief rigs and the volleys on the phone?** A relief rig is a rig on a tow line behind a tug, with a wake; a boss volley is every rig's deck lit 1.5 s before it fires. Recommended: play waves 4, 8 and the boss; if the tow reads as scenery, it can carry a "RIG UNDER TOW" call-out on its first run.
- **The signature is 9% of the hits in waves 4–10, not 25%: raise it?** A relief rig is a few big targets, and the bot sinks most of them on the way in; twelve hits a tow cost the usual Armory's win 64% → 53%. Recommended: keep it; the rigs (the mechanic) and their fire are most of every wave already.
- **The danger stretch is the middle, under the carrier.** Recommended: keep: the rigs' fire meets there, and moving it to the way in cost the early waves their band.
- **The boss: the Rig Barrage, a new boss on the Dive Circus's slot.** The Dive Bomber is a regular of the Battery's waves, so the boss is the rigs rising out of the sea and firing together at the middle of the convoy. Recommended: keep the name "Rig Barrage"; say if you would rather it kept "Dive Circus" and its dive bombers.
- **The two Armories again:** the latest set wins 40%, the plating set 89%. Recommended: leave it, as on the Battery and the Sowers; it is the Armory, not the map.

## Checks run

`tsc`; `vitest --exclude '.claude/**'` (80 files, 1882 tests, all pass); `vite build`, then `vite preview` and the e2e scripts `v3.mjs`, `v3-map-cards.mjs`, `v3-encounters.mjs`, `v3-map-lab.mjs`, `v3-convoy.mjs` (all pass; `v3-map-cards.mjs` failed once under a heavy machine load on an unrelated timing check, the Strait's helicopter-missile card, and passed on the rerun); the map-lab baseline replays exactly.

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
