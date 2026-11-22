# Dreadnought Pass: map card (map rebuild, chapter 3 finale)

**Date:** 2026-11-22. Dreadnought Pass (`dreadnought`, chapter 3 "Dark Water", the 15th map and the chapter's fifth: its finale) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), the way Battery Point (`docs/design/v3-ch3-battery.md`, #210) and Sowers' Reach (`docs/design/v3-ch3-sowers.md`, #213) were. Encounter rev 4; play log **v51** (the Rig Field and the Black Strait were built in parallel as 49 and 50).

There is no player run of the rebuilt-to-be map: the player has not played it since the campaign's early chapter 3 runs. The starting point is the map as it was (the Test Lab card: today's convoy controls, the shared waves, the Dreadnought's passes on waves 3, 6, 9 and 10, and the Fire Mission's spotters as the boss) and what the player asked of every rebuild: a question of its own and kits of its own, busier early waves, the climb from wave 4 to 9 they rated 5/5/5, no single-wave cliff, wave 10 the climax and not a wall, a boss that is a big set piece (this one the biggest of chapter 3) and not an enemy already seen the same way, and readable on an iPhone in landscape (874×402).

As it was, the map was flat for five waves and then a wall: on 192 seeds the usual Armory lost 0.18 ships in waves 1–5 and 1.69 on wave 10 (a step of ×1.8 from wave 9, and ×2.1 on the tough runs), the latest set won 12% (1.58 ships on wave 6, 2.48 on wave 9), and the boss cost nothing (0.1 a round for every Armory): three spotter planes calling barrages from off the map, with no battleship in it.

Code:
- `src/v3/data/encounters.ts`: `DREAD_R4` (ten encounters), the filler for waves 1–6 (`BUSY`, out of the map's one drone silo), `DREAD_CLIMB` (the table as it is), `DreadPass` and `DREAD_PASSES` (each pass's own numbers under the layer) with `dreadPasses`, `MAP_SIGNATURE.dreadnought` (its new `guns`), `DREAD_BOSS_ROUNDS` and `MAP_BOSS.dreadnought` (a boss round's `dread`, `spotters`, `turns`, `spotAt`, `spotEvery`, `swarmAt`, `swarmGap`; the boss's name, "The Dreadnought"), `CHAPTER_THREE_MAPS` (now the Battery, Sowers and the Dreadnought, in `REBUILT_MAPS`), the script's word for spotter planes;
- `src/v3/sim/game.ts`: a pass of the layer's is a launch at its own moment (`launch`, kind `dreadnought`), `launchBoss` takes a pass (hits, speed, its first broadside) and is exported for the boss rounds, `updateBoss` reads the pass (its cadence, its broadside, its aim, a glimpse's turn, a spell heaved to on station, then on at `dash` speed; drones off its deck go for the carrier, its guns at a ship; a broadside is tagged `parent: 'dreadnought'`), and a wave planned again under the layer drops the campaign's pass for its own (`replanWave`);
- `src/v3/sim/foes.ts`: a spotter's call fires from the battleship's hull while it is on the map (`guns`, `dreadGun`); `src/v3/sim/events.ts`: the Fire Mission reads its rounds from `MAP_BOSS` (the battleship, the spotters and their turns, the swarms, the round's own launches); a round's spotter has no guns to call once its battleship is sunk or gone (`dreadAfloat`); with no boss tuning it plays as it did;
- `src/v3/ui/features.ts`: the battleship's health bar reads its own hull (a pass's or a boss round's);
- `src/v3/data/mapPlans.ts`: `MAP_PLANS.dreadnought`; `src/v3/data/convoy.ts`: `MAP_CONVOY.dreadnought` (the campaign's schedule, no command); `src/v3/data/lab.ts`: "Ready to test" at v51; `src/v3/sim/playlog.ts`: `LOG_VERSION` 51;
- tools (`tools/v3/dreadnought/`): `read.py` with `seeds.ts` (a tuning read on four processes), `launches.ts` (the report's wave budget, quickly), `books.ts` (the encounter test's books), `hull.ts` (how often the bot sinks the battleship), `probe-boss.ts`, `budget.ts`, `wave1.ts`, `compare.py` (the diversity check); `tools/v3/combo-sweep/mixwaves.ts` counts the signature (`broadside`: what the battleship fires).

Bot reports: `tools/v3/map-report/results/dreadnought-player.md` (the usual Armory: Quick Reload 5, Damage Control 4, Stockpile 5), `dreadnought-latest.md` (Wide Warhead 5, Point Defense 4, Supply Lines 3), `dreadnought-plating.md` (Quick Reload 5, Armor Plating 5, Big Magazine 4), `dreadnought.md` (no Armory); each with a heat map and the counter and off-counter kits; the map as it was: `dreadnought-before*.md`. Tuning reads: the record report's bot on 192 seeds (900–1091), `python3 tools/v3/dreadnought/read.py --seeds=192 --armory=... [--tough]`; the before reads on the base build's tree, the same tool.

## How it is gated (lab vs campaign)

As every rebuild: **lab only, under the encounter layer.** The Test Lab's map card (`?lab=map-dreadnought`) opens on its production setup, policy D (the map's own convoy, no command) with the authored encounters rev 4, because the map is in `REBUILT_MAPS` (via `CHAPTER_THREE_MAPS`). Everything new reads the run's encounter setup (`dreadPasses`, `signatureOf`, `bossTune`), so the campaign, a run with no layer, a rev 3 log and the shared wave (`only: []`) play the map exactly as before: the battleship as each of waves 3, 6, 9 and 10 starts, 50 hits, two shells and a guided missile every 9 s, and the Fire Mission's three spotters. The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version.

## The problem

> A battleship steams down the deep channel against the convoy, east to west, firing broadsides across the water at the ships, and from wave 4 its spotter planes lay its guns on a ship from over the horizon: fifty hits sink it and silence it for the wave, or each broadside and each spotter can be shot down as it comes, while the rest of the wave keeps firing, most of all at the ships about to deliver in the east, where it comes in.

The question: **sink it, or ride it out?** The battleship is the map's one mechanic (MapDef `boss`): it is on the map for most of a pass wave, 275 px north of the lane, so everything it fires has a short flight. Fifty hits stop every broadside still to come; the same shots spent on the broadsides stop each one as it comes. The bot sinks it on 83% of wave 3's passes, 71% of wave 6's and 42–46% of waves 9 and 10's, and a quarter of the time in each boss round (`tools/v3/dreadnought/hull.ts`, 24 seeds, the usual Armory): a choice that gets harder as the map goes on.

How it differs from the other rebuilt maps: there the danger is a place (an island's side, a lock, the guns, a drifting minefield) or a ship (the tanker); here it is one enemy that moves along the whole map, and the danger moves with it.

## Sites and their jobs

Bases and spots are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| The Dreadnought | The deep channel, y 290, east to west | broadsides | The mechanic: a glimpse on wave 1 (in to x 1150 and back), a full pass on waves 3, 6 and 9, at speed on wave 10 after the calm; the boss. |
| West silo (base 1) | Far shore (350, 70) | drones, shells | The map's one drone silo: every swarm and the filler (long flight); shells at the middle on wave 2. |
| East silo (base 2) | Far shore (1250, 70) | guided, supersonic | Guided missiles at the lead ship (w3–w5, w7, w9) and the middle (w7, w8). |
| Spots 1 and 2 | (300, 410), (1300, 410), between the deep channel and the lane | sub salvos | The shortest flight on the map: spot 2 at the lead ship (w3, w4, w6, w7). |
| Spots 3 and 4 | (200, 742), (1400, 742), off your own shore | sub salvos | Behind the convoy: spot 3 at the ships coming in (w5), spot 4 at the lead ship from the south (w7). |
| East pop-up road | x 1500 | a rocket truck | The lead ship (w8). |
| The edges | | spotter planes, strike jets | The signature's spotters (w4, w6, w8, w9, w10 and the wave's own new enemies); a jet at w5 and w10. |

Warning time falls from 7.1 s on wave 1 to 6.0 s on wave 10 (rule `g-warning`, slope −0.24 s a wave; before: 7.7 to 3.9 s). It falls less than it did because most of wave 10's shells now come from the battleship's broadsides and fewer from the shared wave.

## The stretches

- **Danger: the middle and the east**, nearly level: 41% and 40% of the hull damage in waves 1–9 with the usual Armory, the east 44% and 41% with the latest and plating sets (the record reports). The battleship comes in from the east and its first broadsides fall there; the spotters and the swarms go for the middle.
- **Safe: the early third**, the west: 17–19% (passes, under the 25% line). Before the rebuild it was the east that was coolest (25–28%, flagged).
- Rule `m-carrier` asks that the danger stretch not be the carrier's closest; the carrier sits at (800, 738), under the middle, which is level with the east as the danger. A note for the player (below).

## The convoy

The map's own convoy at the campaign's schedule (`MAP_CONVOY.dreadnought`: flow 1, pairs), no command (rule `m-convoy`: the battleship is fought by shooting, not by sailing). Before, the card played today's convoy controls; it now sails as the Battery and Sowers do.

## The signature: laying the guns

The player's round 9: each map gets a threat of its own in waves 4–10, tied to its identity and its boss. The map's identity is the battleship; its boss, the Fire Mission, is spotter planes. The signature takes both (`MAP_SIGNATURE.dreadnought`, from wave 4):

- **The wave's new enemies are Spotter Planes** (`foe: 'spotter'`, `foeShare: 1`), the Fire Mission's own, in place of what the planner drew (so the wave sends what it would); the encounters add their own (waves 4, 6, 8 twice, 9 and 10);
- **and a spotter's call is the battleship's guns** (`guns`): while the Dreadnought is on the map its shells fire from its hull (a flash there), otherwise from over the horizon as any spotter's. Four hits stop a spotter before its call; once called, the barrage cannot be shot down.

How much of waves 4–10 it is (`mixwaves.ts`, 8 seeds, the "you" bot drafting for itself, tough), counting what the battleship fires (its broadsides and the drones off its deck) with its spotters:

| | Waves 4–10 | Waves 6–10 | Boss rounds |
| --- | --- | --- | --- |
| Share of the threats that show | 34% | 39% | 33% |
| Share of the hits it takes to clear them | **28%** | 29% | 20% |

With the battleship's own hull counted too (50 hits a pass) it is about half of the work (48% at an earlier build of these waves). The spotters alone are a small part (7% of what shows); most of it is the broadsides, on waves 6, 9 and 10.

## The counters

- **Counter kit: Point Defense, Shield, Gunship Pair.** Point Defense round the carrier takes the deck drones and the missiles with a short flight; the Shield takes the hit of the shell that gets through and of a spotter's barrage (which cannot be shot down); the Gunship Pair rides over the convoy and takes a broadside as it comes.
- **Off-counter kit: Seeker Pod, Orbital Strike, Bomber Wing.** The Seeker's long flight is late for a broadside's short one; the Orbital Strike's slow lock spends itself on the battleship's hull (the toughest thing on the board) while the broadsides land; the Bomber Wing silences silos, and the battleship is not one.
- Both from the combo sweep's singles at the final build (Point Defense 4.3, Shield 5.0, Gunship Pair 5.5; Seeker 9.1, Orbital Strike 7.5, Bomber Wing 7.4 ships lost over 13 waves). A design note for the bots only: nothing in the game nudges the player towards it.

How they compare (record reports, 24 seeds, the kit as the bot's taste):

| Armory | Kit | Won | Lost in waves 1–10 (normal / tough) | Boss r1 / r2 / r3 (reached) |
| --- | --- | --- | --- | --- |
| usual | counter | **83%** | 2.3 / 2.3 | 0.61 / 1.78 / 1.87 |
| | off-counter | 67% | 2.8 / 2.8 | 0.73 / 1.23 / 2.05 |
| latest | counter | **79%** | 4.0 / 4.6 | 0.53 / 1.16 / 0.95 |
| | off-counter | 54% | 3.5 / 4.4 | 0.94 / 1.56 / 1.25 |
| plating | counter | **100%** | 1.5 / 1.5 | 0.42 / 1.04 / 1.08 |
| | off-counter | 92% | 2.2 / 2.3 | 0.65 / 1.26 / 0.65 |
| none | counter | 4% | 5.2 / 9.6 | – |
| | off-counter | 0% | 4.9 / 10.3 | – |

The counter kit wins more often with every Armory (16–25 points with the usual and latest sets); with the latest set it loses about as many ships in waves 1–10 (4.6 against 4.4 tough) and fewer in the boss. Neither is trivial.

## Loadouts on this map (combo sweep singles)

Each weapon alone, forced at every draft (12 seeds, the usual Armory, version 51; `npm run v3:combo-sweep -- --stage=singles --maps=dreadnought --out=tools/v3/combo-sweep/results/v51-ch3`). Ships lost over all 13 waves:

- **Strong:** **Point Defense 4.3**, Shield 5.0, Drone Screen 5.3, Air Strike 5.4, Tesla Arc 5.4, Gunship Pair 5.5, Gravity Well 5.6, Thermobaric Shell 6.0.
- **Middling:** Scattergun 6.2, Overdrive 6.3, Boomerang 6.4, Frigate Escort, Shrapnel, Flak, Full Steam and Railgun 6.8, Bomber Wing 7.4, Orbital Strike 7.5.
- **Weak:** Seeker 9.1, Supply Run alone 9.2, Dual Wield 10.0, Focus Fire, Grapnel and the Charge Lance 11.2, the plain gun 12.2, the Laser Cutter 38.1. The bot drafting for itself: 6.9 (won 58%).

## Diversity: are its best kits its own?

Swept the chapter 2 way (singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16), compared with the five chapter 2 maps, the Battery and Sowers' Reach from their last sweeps (`docs/design/v3-combo-diversity.md`, "Dreadnought Pass"; `python3 tools/v3/dreadnought/compare.py`). The Rig Field and the Black Strait were being built at the same time and are not in it.

| | Result |
| --- | --- |
| Top 5 kits | **Point Defense + Gunship Pair + Dual Wield** 4.9, Scattergun + Point Defense + Gunship Pair 4.9, Frigate Escort + Point Defense + Supply Run 5.6, Point Defense + Gunship Pair + Shield 5.8, Frigate Escort + Thermobaric Shell + Shield 5.9 |
| Jaccard of the top-5 kits, against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers | **0 / 0 / 0 / 0 / 0 / 0 / 0** |
| The same, the Dreadnought against itself (two halves of its seeds) | 0.43 |
| #1 kit | in no other rebuilt map's top 5 |
| Best weapon alone | **Point Defense** 4.3 (the best single on no other rebuilt map) |
| Rank correlation of the weapons alone, against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers | 0.45 / 0.63 / 0.43 / 0.36 / 0.42 / 0.65 / 0.72 |
| Air Strike | 4th of 25 alone (5.4); in none of the five best kits |

- **All five of its best kits are its own**, and its best weapon alone is its own: Point Defense (in four of the five best kits), whose interceptors take what the battleship fires with a short flight.
- **Air Strike is not over-dominant**: it is in none of the best kits, the first rebuilt map where that is so.
- **Its weapons alone rank most like Sowers' and the Battery's** (0.72, 0.65), its chapter's other maps; least like the Archipelago's (0.36).

## Debuts

Not applicable: chapter 3's five new enemies all debut on the Battery (rule `m-debut-tag`, "New on Dark Water"). The Dreadnought is the map's own structure, and its first sight keeps the game's own debut card (as before; under the layer it first shows on wave 1's glimpse, not wave 3). The encounters bring nothing from a later chapter (drones, shells, guided missiles, a rocket truck, strike jets, sub salvos and, from the signature's first wave, spotter planes; `tests/v3/encounters.test.ts`). Supersonic missiles, though the east silo lists them, are not in this map's waves and none of the encounters send one.

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated, each with its filler on waves 1–6 (a string of two or three drones off the west silo). Each pass keeps the campaign's waves (3, 6, 9, 10) but its own numbers (`DREAD_PASSES`), and each broadside fires fewer shells than the campaign's (two shells and a guided missile every 9 s) with drones off its deck at the carrier in their place: the broadsides are most of a pass wave's launches, so the wave still sends what the campaign's does (rule `w-budget`, the record report ×0.87–×1.08 of the wave with no layer), but the ships take fewer shells with a short flight.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | Smoke in the east (`dread-smoke`) | the Dreadnought's glimpse (in to x 1150 at 60 px/s, a single shell every 6 s, back out); west silo, 3 drones | the lead ship |
| 2 | teach | Long reach (`dread-long-reach`) | west silo, 2 shells, then 4 drones | the middle; the lead ship |
| 3 | teach | The first pass (`dread-first-pass`) | the full pass (40 hits, 30 px/s; every 9 s a shell and 3 deck drones); spot 2, 2 shells; a guided missile; a swarm of 5 | the lead ship (shells, missile, salvo); the carrier (deck drones) |
| 4 | combine | Spotted (`dread-spotted`) | a spotter from the west; 2 guided missiles; spot 2, 3 shells; swarms of 5 and 4 | the ship it paints; the lead ship; the middle |
| 5 | combine | Both sides (`dread-both-sides`) | spot 3, 3 shells; 2 guided missiles; a strike jet from the east; swarms of 6 and 4 | the ships coming in; the lead ship; the middle |
| 6 | combine | Laying the guns (`dread-gun-laying`) | the pass (45 hits; every 8.5 s a shell and 3 deck drones); a spotter from the east (its shells from the hull); spot 2, 2 shells; swarms of 5 and 5 | the ship it paints; any ship; the lead ship; the rear |
| 7 | escalate | Crossfire (`dread-crossfire`) | spots 2 and 4, 3 shells each at once; a guided missile at the lead ship and 2 at the middle; swarms of 8 and 7 | the lead ship, from both sides; the middle |
| 8 | escalate | Two spotters (`dread-two-spotters`) | spotters from both edges, 3 s apart; a rocket truck down the east road; 3 guided missiles; swarms of 7 and 7 | two painted ships; the lead ship; the middle |
| 9 | escalate | The gunline (`dread-gunline`) | the pass (50 hits; every 9 s a guided missile and 5 deck drones); a spotter from the west; a guided missile; swarms of 5 and 5 | any ship; the carrier; the lead ship; the rear and the middle |
| 10 | climax | Full ahead (`dread-full-ahead`), after the wave's own fire and a 6 s calm | the pass at 45 px/s (50 hits; every 6.5 s a shell, a guided missile and 5 deck drones); a spotter from the east; a strike jet; swarms of 7 and 7 | any ship; the carrier; the lead ship and the ships coming in |

Wave 1 loses no ship on the record reports and on 192 seeds (0.00 with the usual Armory, 0.01 with the latest set).

**Wave 10, the climax:** the hardest regular wave for every player Armory but the plating set's (whose wave 9 is level with it), and not a wall: 0.69 ships for the usual Armory, 0.99 for the latest, 0.49 for the plating set (192 seeds; before 1.69, 2.20, 1.66).

## The boss: the Dreadnought

The map's event was the Fire Mission: three spotter planes taking turns from three sides, each calling a walking barrage of five shells from off the map, and three swarms; every round the same, and nothing in it the player had not met in the waves. The chapter's finale is now **the Dreadnought itself** (`DREAD_BOSS_ROUNDS`, lab only), on the Fire Mission's spotters. In the waves the battleship passes slowly and fires a few things at a time; in the boss it comes to fight:

- it steams in from the east at 60 px/s, **heaves to broadside-on to the convoy** in the middle of the map, and fires a broadside at the lead ship every few seconds;
- its spotters lay its **main guns**: each painted ship takes a walking barrage of five shells **from the battleship's hull**;
- then it goes on west at twice the speed;
- **sink it and it is silent**: its spotters have no guns to call and go (`dreadAfloat`). A big "DREADNOUGHT SUNK" is the round's best moment.

| Round | Hits | On station | Broadside (at the lead ship) | Spotters × turns | Swarms |
| --- | --- | --- | --- | --- | --- |
| before (every round) | – | – | – | 3 × 2 (from off the map) | 3 of 5 |
| 1 | 40 | x 1150, 3 s | a shell and a guided missile, every 8 s | 1 × 1 | 2 of 5 |
| 2 | 50 | x 1050, 4 s | the same, every 6.5 s | 1 × 2 | 3 of 5 |
| 3 | 60 | x 950, 5 s | two shells, every 7 s | 2 × 1 | 4 of 6 |

The name the player reads is "The Dreadnought" (`MAP_BOSS.dreadnought.name`, as Saltgate's Gatecrashers), with the shared intro cards: "Boss round", "Convoy restored", "The boss: The Dreadnought", "Round 1 of 3", then 2 and 3. Each round lasts 26–30 s (the battleship's course sets it; test, seed 218).

How it reads (192 seeds, normal runs that reached it):

| Armory | Before r1 / r2 / r3 | After r1 / r2 / r3 |
| --- | --- | --- |
| usual | 0.09 / 0.09 / 0.10 | **0.86 / 1.41 / 1.77** |
| latest | 0.08 / 0.21 / 0.25 (24 runs reached it) | **0.78 / 1.51 / 1.66** |
| plating | 0.04 / 0.07 / 0.13 | **0.42 / 1.07 / 1.07** |

Rising with the usual and latest sets, level in rounds 2–3 for the plating set; under the asked 1.5 / 2 / 2.5 a round, as on every rebuilt map: the convoy is restored before the boss and the loss limit is six, so rounds at 1.5 / 2 / 2.5 would end about half the runs that reach them. An earlier build at about 1.6 / 2.7 / 1.8 won 15%. On the record reports' 24 seeds the latest set's round 3 (1.33) and the plating set's (0.95) read under their round 2.

## Bot results, before and after

"Before" is the map card as it was (log v48): today's convoy controls, no encounters, the campaign's passes and the Fire Mission. The record reports are 24 seeds (900–923; `npx vite-node tools/v3/map-report/report.ts -- --map=dreadnought --seeds=24 [--armory=player|latest|plating] --kits=plan`); the reads below them 192 seeds (900–1091).

### The headline (192 seeds, normal runs)

| Armory | Won before → after | Waves 1–5 lost | Waves 1–10 lost | Wave 7 | Wave 10 |
| --- | --- | --- | --- | --- | --- |
| **usual** (Quick Reload 5, Damage Control 4, Stockpile 5) | 63% → **66%** | 0.18 → **0.71** | 3.55 → 2.86 | 0.28 → 0.41 | 1.69 → 0.69 |
| latest (Wide Warhead 5, Point Defense 4, Supply Lines 3) | 12% → **68%** | 0.80 → **0.78** | 5.87 → 3.40 | 0.62 → 0.35 | 2.20 → 0.99 |
| plating (Quick Reload 5, Armor Plating 5, Big Magazine 4) | 44% → **89%** | 0.17 → **0.42** | 3.73 → 1.83 | 0.32 → 0.25 | 1.66 → 0.49 |
| none | 0% → 7% | 1.30 → 1.34 | 5.40 → 5.20 | 1.05 → 0.67 | 2.57 → 1.16 |

Normal-run curves, waves 1–10 then the boss rounds (runs that reached each):

| Armory | Before | After |
| --- | --- | --- |
| usual | 0 0 .12 .02 .04 .43 .28 .26 .94 1.69 · boss .09 .09 .10 | 0 .07 .14 .15 .36 .18 .41 .44 .52 .69 · boss .86 1.41 1.77 |
| latest | 0 0 .65 .06 .09 1.58 .62 .93 2.48 2.20 · boss .08 .21 .25 | .01 .04 .28 .12 .33 .36 .35 .44 .72 .99 · boss .78 1.51 1.66 |
| plating | 0 0 .12 .02 .02 .45 .32 .37 1.22 1.66 · boss .04 .07 .13 | 0 .02 .12 .10 .18 .12 .25 .27 .34 .49 · boss .42 1.07 1.07 |

Tough-run curves (every seed plays every wave; the cliff check), after, 192 seeds: usual 0 .07 .14 .15 .36 .22 .43 .51 .59 .84; latest .01 .04 .28 .12 .33 .38 .45 .61 .94 1.39; plating 0 .02 .12 .10 .18 .13 .28 .29 .48 .59. **No step doubles** for any player Armory (the largest: ×1.72 on wave 7 for the usual set, ×1.54 on wave 9 for the latest, ×1.66 on wave 9 for the plating set; a wave under 0.25 counts as 0.25). Before, the usual set's tough wave 10 doubled wave 9 (1.02 → 2.14).

### The record reports (24 seeds, 900–923)

| | Before latest / plating / usual / none | After latest / plating / usual / none |
| --- | --- | --- |
| Won (normal) | 13% / 50% / 79% / – | **71% / 88% / 63%** / 4% |
| Waves 1–5 lost (normal) | 0.67 / 0.00 / 0.13 | 0.58 / 0.33 / 0.46 / 0.92 |
| Boss r1 / r2 / r3 (normal, reached) | 0.00 / 0.33 / 0.33 (3 runs); 0.00 / 0.08 / 0.08; 0.16 / 0.11 / 0.11 | 0.83 / 1.44 / 1.33; 0.59 / 1.36 / 0.95; 0.71 / 1.38 / 2.10 |
| `w-cliff` (tough) | FLAG (w6, w8, w9); FLAG (w9); FLAG (w9) | **PASS; PASS; PASS**; FLAG (w6, no Armory) |
| `w-early` close calls from w3 | PASS | PASS (fewest 1.63–1.92 a run) |
| `w-budget` ±15% | PASS | PASS (furthest ×0.87–×0.92) |
| `m-stretches` | FLAG (cold late 25–28%) | PASS (cold early 17–19%) |
| `g-warning` | PASS: 7.7 → 3.9 s | PASS: 7.1 → 6.0 s |
| `w-first` | PASS | PASS |

### Difficulty (rule `m-difficulty`; the brief: win 50–70%, waves 1–5 0.4–0.8)

- **The usual Armory wins 66%** (63% on the record) and **the latest set 68%** (71%), in the band; **the plating set 89%**, over it, as on the Battery (72%) and Sowers (83%).
- **Waves 1–5:** 0.71 for the usual Armory, 0.78 for the latest set, 0.42 for the plating set, all in the band (before 0.17–0.80, the usual 0.18).
- **The climb from wave 4 to 9** rises for the usual Armory but for wave 6 (.15 .36 .18 .41 .44 .52, then .69): wave 5's two missiles and jet ahead and salvo behind is the busiest of the combine waves, and wave 6's pass is slow. For the latest set it rises every wave but wave 7 (.12 .33 .36 .35 .44 .72, then .99).
- **Wave 10** is the hardest regular wave for the usual and latest sets and no step to it doubles.
- **Busier early waves:** threats on the board 1.5, 1.2, 1.3 and kills a minute 40, 31, 38 on waves 1–3 (before 1.0, 0.8, 1.6 and 28, 21, 35; the usual Armory's record).

## Fun measures (provisional, `src/v3/sim/funMetrics.ts`)

The fun check flags "flat" saves on every wave for every Armory (0.1 a run on waves 1–7, 0.3 in waves 8–10 and the boss), as on the Battery and Sowers and before the rebuild. Close calls from wave 3: 1.6–1.9 a run on the quietest wave, more after.

## What is not satisfied, or uncertain

- **The boss reuses the battleship the player meets in the waves.** The brief says not to reuse an enemy as the boss the way the player has already seen it. The waves' passes are slow and fire a few things; the boss's battleship heaves to and fires on station, its spotters calling its main guns from its hull, and sinking it silences them. Whether that reads as different enough is a question for the player (below).
- **The boss is under 1.5 / 2 / 2.5** (0.42–0.86, 1.07–1.51, 1.07–1.77 a round on 192 seeds) to keep the win rate in the band, as on every rebuilt map; with the plating set rounds 2 and 3 are level, and on the record's 24 seeds the latest and plating sets' round 3 read under round 2.
- **The deck drones go for the carrier.** To keep the wave budget (the campaign's broadsides are two shells and a missile every 9 s) without the shells that made waves 9 and 10 walls, each broadside now fires fewer shells and a flight of drones off the battleship's deck at the carrier. They count in the wave but cannot sink a ship; drones at the ships made waves 9 and 10 cliffs again (1.3–2.7 a wave).
- **The danger stretch is level between the middle and the east** for the usual Armory (41% / 40%), the carrier's stretch being the middle (rule `m-carrier`); the latest and plating sets' danger is the east.
- **The signature is 28% of the work in waves 4–10 only when the battleship's broadsides count with its spotters**; the spotters alone are a small part. With the hull it is about half.
- **The plating set wins 89%**, over the band, as on the Battery and Sowers.
- **Warning time falls less than before** (7.1 → 6.0 s against 7.7 → 3.9 s): the battleship's broadsides replace the shared wave's late shells, and the report's warning reads a broadside's few seconds as the battleship's launch, not as the shells' short flight.
- **The usual Armory's climb dips on wave 6** (0.36 on wave 5, 0.18 on wave 6), within the 192-seed noise of a few hundredths; the cliffs moved with every small change (one more guided missile on wave 5 moved wave 6 by 0.2 for the latest set).
- **No Armory, wave 6 doubles wave 5** on the record (0.46 → 1.38); the no-Armory bot wins 2–7%.
- **Supersonic missiles**: the east silo lists them but the map's waves send none, so the encounters do not either (the encounter test holds a beat to what the map has by its wave).
- **The diversity check leaves out the Rig Field and the Black Strait**, rebuilt in parallel.

## The play log (v51)

`LOG_VERSION` 51, `LOG_REPLAYS` `[51]` (`src/v3/sim/playlog.ts`). The change is lab only, under the encounter layer: the campaign plays as at 48, and a 48 Dreadnought card log played today's convoy and no layer (it no longer replays to the same game). The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly. The version pins in the tests and e2e scripts moved to 51 (`python3 tools/v3/playtest-fixes/pins.py 48 51`, and `tests/v3/scorecard.test.ts`). The Test Lab's "Ready to test" lists Dreadnought Pass at v51. The combo sweep's results are in `tools/v3/combo-sweep/results/v51-ch3`.

## Questions for the player

- **Is the boss different enough from the waves' battleship?** In the waves it passes slowly; in the boss it heaves to broadside-on, its spotters call its main guns from its hull, and sinking it silences them. Recommended: play the three rounds; if it reads as "the same ship again", the next build gives the boss something the waves never have (a second battleship from the west in round 3, or its main guns firing walking barrages on their own once it is on station).
- **Sink it, or ride it out: does it feel like a choice?** The bot sinks it on most early passes and on under half of the late ones. Recommended: keep its hits as they are (40, 45, 50, 50; 40, 50, 60 in the boss) and see which you do.
- **The drones off its deck go for the carrier.** Recommended: keep; they are the "easy things to kill" you asked for and keep the battleship busy on screen without sinking ships. If the carrier feels in danger, they can go for the ships at fewer a broadside.
- **The boss under 1.5 / 2 / 2.5 a round.** Recommended: keep, as on every rebuilt map, and judge it by your own losses.
- **The danger stretch is level between the middle (the carrier's) and the east.** Recommended: keep; the battleship moves, and the danger with it.

## Checks run

`tsc`; `vitest --exclude '.claude/**'`; `vite build`, then `vite preview` and the e2e scripts `v3.mjs`, `v3-map-cards.mjs`, `v3-encounters.mjs`, `v3-map-lab.mjs`, `v3-convoy.mjs`; the map-lab baseline replays exactly. After merging the base with the Rig Field (log v49): `vitest --exclude '.claude/**'` 80 files, 1886 tests, all pass; all five e2e scripts pass; the baseline rewritten at v51 (its version only) and replaying exactly with telemetry on and off.

## Tests

- `tests/v3/encounters.test.ts`:
  - the ten listed, rev 4, v1 only, none at rev 3; `REBUILT_MAPS` has the Dreadnought;
  - the budget, legality (a spotter plane from an edge from the signature's first wave), warning and replay checks cover the map;
  - the mechanic is in the waves: the passes on waves 1, 3, 6, 9 and 10, the spotters on waves 4, 6, 8, 9 and 10;
  - each pass under the layer has its own hits, speed and moment, its broadsides tagged, its guns at the lead ship where it says so and its deck drones at the carrier; the glimpse turns back; the campaign and the shared wave pass as before (50 hits, as the wave starts, untagged);
  - the signature: from wave 4 every new enemy the wave draws is a spotter; their shells fire from the hull while the battleship is on the map; the campaign's from over the horizon;
  - the boss: one battleship a round, heaved to, its broadside at the lead ship, tougher, longer on station, more spotter turns and drones each round; 15–30 s a round; a rev 3 log and the campaign play the Fire Mission with no battleship; the name "The Dreadnought" (the campaign reads "Fire Mission"); sunk, it is silent (no barrage, no spotter);
  - the filler: every one of waves 1–6.
- `tests/v3/mapRules.test.ts`: no repeats and no gaps; `MAP_PLANS` complete; the boss target is 2. `tests/v3/mapCards.test.ts`, `round11.test.ts`, `convoy.test.ts`: the production setup is policy D, no command, the encounters. `tests/v3/scorecard.test.ts`: the log is version 51.
- `e2e/v3-map-cards.mjs`: the hub card and the bare link. `e2e/v3-encounters.mjs`: the card opens with its encounters and no command, the pause screen's script names "The Dreadnought", and skipped to the boss, the battleship heaves to and fires (a shot at one pixel a point: `e2e/shots/v3-encounters/dreadnought-boss.png`).

## What to look for when you play

A battleship steams down the deep channel above the lane, against your ships, firing as it goes. Fifty hits sink it; or shoot down what it fires. From wave 4 spotter planes circle and paint a ship for its guns: shoot the plane before it calls, because the shells that come cannot be stopped. The east, where it comes in, and the middle are where it gets busiest. Wave 10 should be the hardest wave but not a wall. In the boss the battleship itself comes to fight: it stops broadside-on to your convoy, its spotters call its main guns, and sinking it silences them. The questions: does sinking it feel worth it, is the boss the biggest moment of the chapter, and do the three rounds rise?

(This section names no weapon to try: the counter kit above is a design note for the bots, never shown in the game or on the hub.)
