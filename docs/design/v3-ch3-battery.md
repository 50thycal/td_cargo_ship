# Battery Point: map card (map rebuild, chapter 3)

**Date:** 2026-11-21. Battery Point (`battery`, chapter 3 "Dark Water", the 11th map and the chapter's first) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), the way chapter 2's five maps were (`docs/design/v3-ch2-island.md`, `v3-ch2-behemoth.md`, `v3-ch2-needle.md`, `v3-ch2-archipelago.md`, `v3-ch2-saltgate.md`). Encounter rev 4; play log **v43**.

The starting point was the player's three fresh runs of the campaign's Battery (log v40, iPhone; `tools/v3/bot-fit/logs/v3-20261120221506-94564.json`, `-222140-94565`, `-222804-94566`):

| Run | Armory | Picks | Result | Ships lost a wave | Ratings |
| --- | --- | --- | --- | --- | --- |
| 1 | Wide Warhead 5, Deck Guns 4, Supply Lines 3 | Dual Wield, Railgun, Flak | lost on wave 7 | 0 0 1 1 1 1 2 (shells and the siege gun) | 1/1/1 on wave 1 to 4/4/4 by wave 4 |
| 2 | the same | Shield ×3, Scattergun, Gunship Pair | lost on wave 6 | 0 0 **4** 0 1 1 (wave 3: three shells and a heavy) | difficulty 5, fun 4: "probably too hard overall, maybe tweak it back a little" |
| 3 | Quick Reload 5, Armor Plating 5, Big Magazine 4 | Orbital ×3, Point Defense ×3, Shrapnel | lost on wave 10 | 0 0 0 0 1 0 0 0 1, then 6 on wave 10 | waves 6–9 5/5/5; fun 5: "one of the best rounds I played ... what helped was changing my loadout" |

What that asked for: keep the map's character (its climb from wave 4 to 9 is the best-rated stretch the player has played, and its early waves were not flat); take out the wave 3 cliff of shells (four ships in one wave with some loadouts); make wave 10 the hardest wave, not a wall; do not make it easy.

Code:
- `src/v3/data/encounters.ts`: `BATTERY_R4` (ten encounters), `BATTERY_CLIMB`, `BATTERY_BOSS_ROUNDS` and `MAP_BOSS.battery`, `MAP_SIGNATURE.battery` (its new `stealth`), `CHAPTER_THREE_MAPS` (in `REBUILT_MAPS`, so the Test Lab's map card plays it as chapter 2's), a boss round's `jets`, `jetAt`, `jetGap`;
- `src/v3/data/mapPlans.ts`: `MAP_PLANS.battery`; `src/v3/data/convoy.ts`: `MAP_CONVOY.battery` (the campaign's own schedule, no command);
- `src/v3/sim/game.ts`: the signature's `stealth` (the wave's strike jets, and an encounter's from wave 4, come as Stealth Strafers); the signature's `heavies: 'post'` aims a truck's heavy too (`updateRaider`); under the layer a launch at a shore gun knocked out on its way goes for the other gun (`ensureTarget`); an encounter's stealth jet keeps the side its beat names;
- `src/v3/sim/events.ts`: the Blackout reads its rounds from `MAP_BOSS` (jets, their start and gap, and the round's own launches, `fire`); with no boss tuning it plays as it did;
- `src/v3/sim/playlog.ts`: `LOG_VERSION` 43; `src/v3/data/lab.ts`: "Ready to test" lists Battery Point at v43;
- tools: `tools/v3/battery/sunk.ts` (what sinks the ships, wave by wave, and how often the guns fall), `budget.ts` (each wave against the shared wave and against no layer), `compare.py` (the diversity check against chapter 2); a third Armory yardstick, `--armory=plating` (`PLATING_ARMORY`, the player's run 3), in `tools/v3/map-report/quick.ts` and `report.ts`; `tools/v3/combo-sweep/mixwaves.ts` counts the Battery's signature.

Bot reports: `tools/v3/map-report/results/battery-player.md` (the player's usual Armory, Quick Reload 5, Damage Control 4, Stockpile 5), `battery-latest.md` (Wide Warhead 5, Deck Guns 4, Supply Lines 3: runs 1 and 2), `battery-plating.md` (Quick Reload 5, Armor Plating 5, Big Magazine 4: run 3), `battery.md` (no Armory); each with a heat map; the map as it was: `battery-before*.md`. Tuning reads: the record report's bot on 192 seeds (900–1091), four processes at a time.

## How it is gated (lab vs campaign)

As every chapter 2 rebuild: **lab only, under the encounter layer.** The Test Lab's map card (`?lab=map-battery`) now opens on its production setup, policy D (the map's own convoy, no command) with the authored encounters rev 4, because the Battery is in `REBUILT_MAPS` (via `CHAPTER_THREE_MAPS`, the chapter 2 pattern). Everything new reads the run's encounter setup (`signatureOf`, `bossTune`, `g.enc`), so the campaign, a run with no layer, a rev 3 log and the shared wave (`only: []`) play the Battery exactly as before: the shared waves, Blackout's eight strafers, and a launch at a fallen gun turning for the nearest ship. The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version.

## The problem

> Two shore guns of your own on the headland cover the east of the lane, where the ships deliver, while they stand: the enemy's shells and heavies go for the guns first, and each one knocked out leaves the ships under it uncovered for twelve seconds, while the middle of the lane, between your carrier and the guns, is covered by neither.

The guns are the map's one mechanic (rule `m-mechanic`; `posts` in `data/maps20.ts`): two allied batteries at (1085, 652) and (1210, 646), reach 330, a shot every 1.3 s each at anything in reach; three hit points, and a gun brought to 0 is out for 12 s, then back whole. The lane runs straight across at y 430; the carrier sits in the west (520, 702), so the west is the carrier's, the east the guns', and the middle (x 530–1070) is the furthest from both.

The mechanic is in the waves (rule `g-mechanic`): every wave from 2 to 10 aims something at the guns (aim `'post'`), so does the signature, and so does every boss round. A shot at the guns is not a shot at a ship, but a gun down is twelve seconds with nothing over the east of the lane, and the heavies that go for the guns are eight hits each.

How it differs from chapter 2's maps: there the fire is aimed at a place in the lane (an island's side, a lock, a queue at a mouth, the west end) or at one ship (the tanker). Here a large part of it is aimed at your own help, and what it costs you is cover, not hulls.

## Sites and their jobs

Bases and spots are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| West silo (base 1) | Far shore (260, 100) | drones, guided, shells | Over the ships coming in: shells at them (w3, w6), swarms at them (w4, w5, w7), at the middle (w8, w9) and at the lead ship (w10); guided missiles at the guns (w7, w8). |
| West-middle silo (base 2) | Far shore (700, 95) | drones, heavies, clusters | Swarms at the middle (w2, w3, w5, w6, w7) and the ships coming in (w8); the heavies that go for the guns (w4, w8, w10, every boss round); the cluster (w9, w10). |
| Across from the guns (base 3) | Far shore (1100, 95) | shells, supersonic, guided | The counter-battery silo: shells at the guns every wave from 2 to 10 but 9, and every boss round; a guided missile at the lead ship (w6), missiles at the guns (w9). |
| East silo (base 4) | Far shore (1450, 100) | drones, heavies, motherships | Drones at the lead ship under the guns (w1, w4, w7), swarms at the guns over the headland (w6–10), a heavy at the guns (w6, boss round 3). |
| Off the far shore, west (spot 1) | (180, 240) | sub salvos | The shared waves' own (from wave 2 they carry drones: the waves' shells are the encounters'). |
| Off the far shore, east (spot 2) | (1440, 240) | sub salvos | Shells at the guns (w8). |
| Behind the convoy, mid-lane (spot 3) | By your own shore (800, 690) | sub salvos | Shells from behind at the ship nearest it, in the middle (w9). |
| Under the headland (spot 4) | By your own shore (1450, 690) | sub salvos | Point-blank at the guns from behind (w5, w9). |
| Coast road, pop-up roads, air | The far shore (roads at x 480, 900, 1290); the edges | trucks, strafers, bombers | The shared waves' trucks (from wave 4 a truck's heavy goes for the guns), the jet from the east (w7), and from wave 4 every jet dark. |

Warning time falls from 9.9 s on wave 1 to 5.9 s on wave 10 (−0.33 s a wave, rule `g-warning`; before: 9.7 to 4.3 s). The shells at the guns from the silo across from them are the shortest warning on the map that isn't a jet; from wave 4 the jets have none (below).

## The stretches

- **Danger: the middle**, between the carrier and the guns: 44–46% of the hull damage in waves 1–9 (every Armory; before: 46–48%). It is covered by neither, and most of the encounters' swarms at ships go for the ship halfway along (aim `'mid'`).
- **Safe: the west**, the early third, under the carrier: 22% of the hull damage (passes, under the 25% line, with every Armory but none: 27%). Before the rebuild it was 25% (the line).
- **The east, under the guns,** is in between: covered while the guns stand. `MAP_PLANS.battery.stretches` says danger middle, safe early.
- The carrier covers the west, the guns the east (rule `m-carrier`: the danger stretch is not the closest); the frigate's station is the west (290, 706).

## The convoy

The map's own convoy at the campaign's own schedule (`MAP_CONVOY.battery`: flow 1, pairs), no command (rule `m-convoy`): the guns are defended by shooting, not by sailing. Flow 1, as Saltgate's, so the map keeps the pace the player rated (flow 2 read the same for the bot: 3.4 against 3.3 ships lost in waves 1–5 on the shared waves).

## The signature: silence the battery

The player's round 9 (r9-map-signature): each map gets a threat of its own in waves 4–10, tied to its identity and its boss. The Battery's blurb has always been "the enemy wants them silenced first"; its boss is the Blackout (night, Stealth Strafers). Its signature takes one from each (`MAP_SIGNATURE.battery`, from wave 4):

- **The wave's heavy cruise missiles go for the shore guns** (`heavies: 'post'`), off a silo or a truck: eight hits to keep the guns firing, or the guns down for twelve seconds. A heavy whose gun is knocked out on its way turns for the other gun while it stands (lab only); with both down, the ship nearest them, as any shot at the guns. A heavy's hit on a gun knocks it out outright. The encounters add their own (waves 4, 6, 8, 10).
- **The wave's strike jets come in dark**, as Stealth Strafers (`stealth`), one for one, with no warning arrow (only their short run-in): the Blackout's own, so the boss's night raiders are met in waves 4–10 first. Strike jets come from wave 3 on this map, so wave 3's is the last with an arrow.

How much of waves 4–10 it is (`tools/v3/combo-sweep/mixwaves.ts`, 4 seeds, the "you" bot drafting for itself, tough; heavies and stealth strafers):

| | Waves 4–10 | Waves 6–10 | Boss rounds |
| --- | --- | --- | --- |
| Share of the threats that show | 7% | 8% | 80% |
| Share of the hits it takes to clear them | **26%** | 27% | 94% |

About a quarter by hits, as asked (chapter 2: 20–25% by the same tool). The shells at the guns are the map's mechanic, not counted as the signature.

## The counters

- **Counter kit: Railgun, Gunship Pair, Thermobaric Shell.** The Railgun's line reaches a heavy all the way in (and a siege gun on the shore); the Gunship Pair fights on its own over the convoy while your hand is on the heavies at the guns; the Thermobaric Shell's blast takes a swarm and what flies with it.
- **Off-counter kit: Seeker Pod, Drone Screen, Shrapnel Shell.** The Seeker's long flight is late for a shell, the Drone Screen fights one drone at a time, and the Shrapnel Shell's burst does little to a heavy.
- Every weapon is in chapter 3's draft. A design note for the bots only: nothing in the game nudges the player towards it.

COUNTERS_TABLE

## Loadouts on this map (combo sweep singles)

SINGLES_TEXT

## Diversity: are the Battery's best kits its own?

DIVERSITY_TEXT

## The debuts: chapter 3's five new enemies, "New on Dark Water"

The Battery is chapter 3's first map, so the wave planner brings the chapter's five new enemies in here, one a wave as the lead of each wave's new enemies (`mapDebut`, `planFoes`; unchanged, as on the Island for chapter 2): the **Stealth Strafer** on wave 2, the **Stealth Bomber** on wave 3, the **Dive Bomber** on wave 4, the **Siege Battery** on wave 5 and the **Spotter Plane** on wave 6. Each announces its chapter the first time it shows (rule `m-debut-tag`, `foeDebutTag`): "New on Dark Water: Stealth Strafer". The encounters bring none of them and nothing from a later chapter (drones, shells, guided missiles, heavies, a cluster and a strafer, all in the map's table by their waves; `tests/v3/encounters.test.ts`), and the rebuild leaves the planner's draws alone (the test checks the new enemies drawn are the shared wave's).

**Not built: light debut waves** (the Island's, log v32: drones only around the new enemy on waves 2–5). The player rated these waves 3–4 as they are, unlike chapter 2's flat openings, so they keep their mix; what changed is that each debut wave around the newcomer is lighter where it hurt (wave 3 gives up its heavy, wave 5, the Siege Battery's, its heavy and its first bomber). A question for the player (below).

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated. **Every shell the shared wave would send from wave 2 on comes out of the wave** (so its submarines carry drones instead of padding their salvos to four: that padding, not the table, is what made wave 3 a cliff), and the encounters put shells back where the map wants them: mostly at the guns, a few at the ships (waves 3, 6, 9). From wave 6 swarms at the guns over the headland and missiles at the guns stand in for the rest. The waves keep the shared table's count within the budget (rule `w-budget`: ×0.86–1.03 of the wave with no layer; `BATTERY_CLIMB` sends 5% more on waves 1–2 and 8–12% less on waves 4–10, within ±15%). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | The guns on the headland (`battery-guns`) | east silo, 4 drones | the lead ship, under the guns |
| 2 | teach | Ranging shots (`battery-ranging`) | across from the guns, 2 shells; west-middle, 4 drones | the guns; halfway along; in place of the wave's 4 shells |
| 3 | teach | Between the guns (`battery-gap`) | across from the guns, 2 shells; west silo, 2 shells; west-middle, 5 drones | the guns; the ships coming in; halfway along; in place of the wave's 7 shells (9 with the sub's padding) and its heavy |
| 4 | combine | Silence the guns (`battery-silence`) | west-middle, a heavy; across, 3 shells; east 5 and west 4 drones | the heavy and shells at the guns; the lead ship; the ships coming in; in place of the shells, a guided missile, the wave's heavy and its cluster |
| 5 | combine | Under the headland (`battery-under-headland`) | sub under the headland, 2 shells; west 6 and west-middle 5 drones; across, 2 shells | the guns from behind; the ships coming in; halfway along; in place of the shells, a heavy and the first bomber (the Siege Battery's debut wave) |
| 6 | combine | Guns or ships (`battery-both-ends`) | east, a heavy and 4 + 5 drones; west, 2 shells and 4 drones; across, a guided missile and 2 shells; west-middle, 5 drones | the guns (heavy, shells, two swarms); the ships coming in; the lead ship; halfway along; in place of the shells, 2 guided, a supersonic and the first mothership |
| 7 | escalate | A jet in the dark (`battery-dark-jet`) | a dark jet from the east; across, 3 shells; west, 2 guided; swarms of 5, 5, 5 and 4 | the jet down the lane; shells, missiles and a swarm at the guns; the ships coming in, halfway, the lead ship |
| 8 | escalate | Counter-battery (`battery-counter-battery`) | sub off the east shore, 2 shells; across, 2 shells; west-middle, a heavy; west, 2 guided; swarms of 5, 5, 5 and 4 | shells, heavy, missiles and a swarm at the guns; halfway along, the ships coming in, any ship |
| 9 | escalate | Crossfire (`battery-crossfire`) | subs behind mid-lane and under the headland, 2 shells each; west-middle, a cluster; across, 2 guided; swarms of 5 ×4 | the ship nearest the mid-lane sub; the guns (sub, missiles, a swarm); any ship; halfway along |
| 10 | climax | Last light (`battery-last-light`), after the wave's own fire and a 6 s calm | west-middle, a heavy and a cluster; across, 3 shells; east, 5 + 5 drones; west, 5 drones | heavy, shells and both east swarms at the guns; the cluster at the ships coming in; the lead ship |

Wave 1 loses no ship (every report).

**Wave 3, the cliff:** the shared wave 3 sends 7 shells, and the sub that comes with it fills a salvo to 4, so 9; with the wave's first heavy that is what sank four of the player's ships in run 2. Now it sends 4 shells, two of them at the guns, and its heavy waits for wave 4 (at the guns). The bot's wave 3: 0.43 → 0.12 ships lost (the player's latest Armory, 192 seeds), and no step from wave 2 to 3 doubles any more.

**Wave 10, the climax:** the hardest regular wave with every Armory, and not a wall: 1.65 ships for the latest Armory (1.27–1.84 across the tuning reads), 0.96 with the plating set, 1.39 with the usual one; on the tough runs no step to it doubles the wave before (latest 1.40 → 2.05). In run 3 the player lost six on wave 10 to a drone, a shell, two heavies, a cluster and a bomber: here the heavies of wave 10 go for the guns.

## The boss plan: the Blackout at the guns

The Blackout is the map's own event: night, a star shell dropped at 6 s, and eight Stealth Strafers from alternate sides, 2.4 s apart, every round. Under encounter rev 4 (`BATTERY_BOSS_ROUNDS`, lab only):

| Round | Stealth strafers | Their gap | Shells at the guns (across) | Heavies at the guns |
| --- | --- | --- | --- | --- |
| before (every round) | 8 | 2.4 s | 0 | 0 |
| 1 | 7 | 2.4 s | 2 (1, 2 s) | 1 (3 s, west-middle) |
| 2 | 8 | 2.3 s | 2 | 1 |
| 3 | 9 | 2.2 s | 3 | 2 (3 s west-middle, 7 s east) |

The guns shoot at the jets in the dark; the shells and heavies take them out of the fight first. The name stays the event's ("Blackout": a rising boss of the map's own, as chapter 2's), with the shared intro cards (log v30): "Boss round", "Convoy restored" (and the ships that can still be lost), "The boss: Blackout", "Round 1 of 3", then "Round 2 of 3" and "Round 3 of 3". Each round lasts 15–30 s (test, seed 218).

Tried and dropped: a heavy at the lead ship in rounds 2 and 3 (it sinks a ship whatever its armour: latest Armory 1.0 / 2.5 / 2.1 a round, won 17%), and a cluster over the ships coming in (latest round 2 2.0, won 19%). Both read close to the asked 1.5 / 2 / 2.5 for the latest Armory and far under it for the plating set, and cut the latest Armory's win rate to under 20%.

BOSS_TEXT

## Bot results, before and after

"Before" is the map card as it was (log v42): today's convoy controls, no encounters, the Blackout as it is (`tools/v3/map-report/results/battery-before*.md`, 24 seeds). "After" is this build (log v43). The record reports are 24 seeds (900–923; `npx vite-node tools/v3/map-report/report.ts -- --map=battery --seeds=24 [--armory=player|latest|plating] --kits=plan`); the tuning reads below them are 192 seeds (900–1091), the same bot and setup.

RESULTS_TEXT

## Fun measures (provisional, `src/v3/sim/funMetrics.ts`)

FUN_TEXT

## What is not satisfied, or uncertain

UNCERTAIN_TEXT

## The play log (v43)

`LOG_VERSION` 43, `LOG_REPLAYS` `[43]` (`src/v3/sim/playlog.ts`). The base branch was at v42 (#205). The change is lab only, under the encounter layer: the campaign plays as it did, and a v42 Battery card log played the shared waves (it no longer replays to the same game). The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 43 (`python3 tools/v3/playtest-fixes/pins.py 42 43`, and `tests/v3/scorecard.test.ts`). The Test Lab's "Ready to test" lists Battery Point at v43.

## Questions for the player

QUESTIONS_TEXT

## Tests

- `tests/v3/encounters.test.ts`:
  - the ten listed, rev 4, v1 only, none at rev 3; the map with no authored encounters checked is now the Rigs;
  - the budget, legality, warning and replay checks cover the map; a jet that comes in dark is checked to come, tagged, with no arrow;
  - a shot at the guns goes for the first that stands, then the other, then the ship nearest them; a heavy whose gun falls on its way turns for the other gun under the layer, not in the campaign;
  - the guns are the target in waves 2–10;
  - the Blackout's rounds: the strafers each round (and closer together), the shells and heavies at the guns, rising; a rev 3 log and the campaign play the event's eight strafers and nothing else; 15–30 s a round; the event's name kept;
  - the signature: from wave 4 every heavy goes for the guns and no jet comes with an arrow; a truck's heavy goes for the guns; the new enemies drawn are the shared wave's; the campaign keeps its arrows and its heavies' aim; none before wave 4, before rev 4 or past wave 10.
- `tests/v3/mapRules.test.ts`: no repeats and no gaps; `MAP_PLANS` complete; the boss target is 2.
- `tests/v3/mapCards.test.ts`, `round11.test.ts`, `convoy.test.ts`: the production setup is policy D with the encounters, no command, at the campaign's schedule; the Rigs is now the next map with neither.
- `tests/v3/readyToTest.test.ts`: the new entry. `tests/v3/scorecard.test.ts`: the log is version 43.
- `e2e/v3-map-cards.mjs`: the hub card says so; `?lab=map-battery` opens the full map with encounters rev 4 and no command. `e2e/v3-encounters.mjs`: the card opens with its encounters and its two guns, and the pause screen's script names the Blackout.

## What to look for when you play

Watch your two guns on the headland in the east. They shoot on their own at anything over the east of the lane, where the ships deliver, and from wave 2 the enemy shoots at them: shells from the silo right across from them, from wave 4 a heavy cruise missile crawling in, later periscopes and swarms. A gun that is hit goes down for twelve seconds. The middle of the lane, between your carrier and the guns, is covered by neither. From wave 4 the enemy's jets come in dark, with no warning arrow. Wave 3 should no longer be a wall of shells; wave 10 should be the hardest wave but not a wall. In the boss rounds it is night: stealth strafers come in from both sides while shells and heavies go for the guns first. The questions to answer: do the guns feel worth defending, does the climb from wave 4 to 9 still feel like the Battery you rated 5/5/5, and do the three boss rounds rise?

(This section names no weapon to try: the counter kit above is a design note for the bots, never shown in the game or on the hub.)
