# Sowers' Reach: map card (map rebuild, chapter 3)

**Date:** 2026-11-21. Sowers' Reach (`sowers`, chapter 3 "Dark Water", the 12th map and the chapter's second) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), the way Battery Point was (`docs/design/v3-ch3-battery.md`, #210) and chapter 2's five maps before it. Encounter rev 4; play log **v48**.

There is no player run of the rebuilt-to-be Sowers to start from: the player has not played it since the campaign's early chapter 3 runs. The starting point is the map as it was (the Test Lab card: policy D with Hold, the shared waves, the event's own Carpet Run) and what the player asked of every rebuild: a question of its own and kits of its own, busier early waves ("more drones and easy things to kill"), the climb from wave 4 to 9 that they rated 5/5/5 on the Battery, no single-wave cliff, wave 10 the climax and not a wall, and readable on an iPhone in landscape (874×402).

As it was, the bot found it the hardest map of chapter 3 by far (192 seeds: won 15% with the usual Armory, 7% with the latest set, 35% with the plating set), and its mines hardly mattered: the bot shot each one long before a ship reached it (mines sank 0.02–0.04 ships a wave), and what sank ships was the shared waves' shells and clusters (threat scale 1.45, the third highest of any map).

Code:
- `src/v3/data/encounters.ts`: `SOWERS_R4` (ten encounters), the filler for waves 1-6 (`BUSY`), `SOWERS_CLIMB`, `MAP_SIGNATURE.sowers` (its new `sow`), `SOWERS_BOSS_ROUNDS` and `MAP_BOSS.sowers` (a boss round's `vees`, `veeAt`, `veeGap`, `veeHp`, `sow`, and `mine` as a round's launch), `CHAPTER_THREE_MAPS` (now the Battery and Sowers, in `REBUILT_MAPS`, so the Test Lab's map card plays it as chapter 2's), the script's words for mines, clusters and stealth bombers;
- `src/v3/data/config.ts`: `SOW` (where and how often a sowing bomber lays a mine);
- `src/v3/sim/game.ts`: a sowing stealth bomber (Launch and Threat `sow`; `sowMines`, `sowRoute`, `sowAhead`): it flies along the up-current edge of the lane and lays a mine in the water a ship is about to sail through in place of each missile; the wave's new enemies from wave 4 (the signature) and an encounter's stealth bomber sow;
- `src/v3/sim/events.ts`: the Carpet Run reads its rounds from `MAP_BOSS` (its vees, their start, gap and hits, the mines each sows, the round's own launches); with no boss tuning it plays as it did;
- `src/v3/data/mapPlans.ts`: `MAP_PLANS.sowers`; `src/v3/data/convoy.ts`: `MAP_CONVOY.sowers` keeps Hold (its comment says why);
- `src/v3/sim/playlog.ts`: `LOG_VERSION` 48; `src/v3/data/lab.ts`: "Ready to test" lists Sowers' Reach at v48; `src/v3/sim/mapReportPlay.ts`: a report run can take a convoy pilot (who presses Hold);
- tools: `tools/v3/sowers/read.py` with `seeds.ts` (a tuning read on four processes: won, losses per wave and boss round, `--tough`, `--no-enc`, `--pilot=sharp`), `budget.ts` (each wave against the shared wave and no layer, filler at its weight), `wave1.ts` (wave 1 over many seeds for a persona), `probe-boss.ts` (the boss rounds as the encounter test plays them), `compare.py` (the diversity check against chapter 2 and the Battery); `tools/v3/combo-sweep/mixwaves.ts` counts the Sowers' signature (a sown mine apart from a chute's).

Bot reports: `tools/v3/map-report/results/sowers-player.md` (the usual Armory: Quick Reload 5, Damage Control 4, Stockpile 5), `sowers-latest.md` (Wide Warhead 5, Point Defense 4, Supply Lines 3), `sowers-plating.md` (Quick Reload 5, Armor Plating 5, Big Magazine 4), `sowers.md` (no Armory); each with a heat map and the counter and off-counter kits; the map as it was: `sowers-before*.md`. Tuning reads: the record report's bot on 192 seeds (900–1091), four processes at a time (`python3 tools/v3/sowers/read.py --seeds=192 --armory=...`).

## How it is gated (lab vs campaign)

As every rebuild: **lab only, under the encounter layer.** The Test Lab's map card (`?lab=map-sowers`) opens on its production setup, policy D with Hold (as before) and now the authored encounters rev 4, because Sowers is in `REBUILT_MAPS` (via `CHAPTER_THREE_MAPS`). The hub card reads "Commands: Hold · encounters v1 Original". Everything new reads the run's encounter setup (`signatureOf`, `bossTune`, a launch's `sow`), so the campaign, a run with no layer, a rev 3 log and the shared wave (`only: []`) play Sowers exactly as before: the shared waves, the planner's own new enemies (a stealth bomber drops its three missiles) and the Carpet Run's two vees of missile-dropping bombers. The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version.

## The problem

> Mines drift down across the lane on the current, from three chutes on the far shore and from stealth bombers that sow them just ahead of the ships: a ship cannot steer round one and one sinks it, so each must be shot or waited out with Hold, while the shells, missiles and swarms keep coming, most of all at the middle of the lane, where the middle chute's curtains cross and a held convoy sits still.

The mines are the map's one mechanic (rule `m-mechanic`; `data/maps20.ts`): three chutes on the enemy shore (west 430, middle 880, east 1270, y 170) drop them; a mine drifts on the current (7, 26 px/s: south and a little east), takes about 8 s to reach the lane (y 480, half-width 125) and about 10 s to cross it; one hit clears it; a hull it touches takes 3 damage, a whole ship. Hold, the map's one command (rule `m-convoy`: the mines need one), stops every ship for up to 6 s (12 s to come back) so a string can drift through.

The question: **shoot the mine, or hold the ships?** A mine is the easiest shot in the game, but every one in a ship's way must go, and they come while the shells and missiles do; Hold costs no shot but the ships sit still under the rest of the wave (wave 5 is built on that). From wave 4 the mines come from the air too, sown just ahead of the ships by a stealth bomber that takes six hits to stop: the shortest warning on the map.

The mechanic is in every wave (rule `g-mechanic`): the chutes in waves 1-7, 9 and 10, a sowing bomber in waves 4, 8 and 10 (and every wave's own new enemies from wave 4), and the boss rounds.

How it differs from the other rebuilt maps: there the danger is aimed at a place (an island's side, a lock, the guns) or a ship (the tanker); here it drifts. Nothing in it is aimed: a mine goes where the current takes it, and the convoy sails into it.

## Sites and their jobs

Bases and spots are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| West silo (base 1) | Far shore (220, 100) | drones, shells | The long reach: the drones at the lead ship on wave 1, swarms at the middle, the ships coming in and anywhere (w2, w4-w10), shells at the middle (w5, where a held convoy sits); a far drone silo of the filler (w1-6). |
| West-middle silo (base 2) | Far shore (650, 95) | guided, supersonic | A guided missile at the lead ship (w5) and at the middle (w7, w9). |
| East-middle silo (base 3) | Far shore (1100, 95) | drones, heavies | Swarms at the lead ship (w3, w4, w6, w8) and anywhere (w5, w7, w9, w10); the other far drone silo of the filler. |
| East silo (base 4) | Far shore (1480, 100) | clusters, shells | Shells at the lead ship (w3, w4, w6, w10 and every boss round), clusters (w9 at the middle, w10 at the lead ship). |
| South-east bank (base 5) | The enemy's bank by the east end (1450, 805) | guided, clusters | The shared waves' own, short flight to the east of the lane; a guided missile at the lead ship in every boss round. |
| Chutes (bases 6-8) | Far shore, west 430, middle 880, east 1270 | mines | The mechanic: the east chute ahead of the lead ship (w1, w3, w7, w10), the middle chute's curtain under the carrier (w2, w5), the west chute over the ships coming in (w4), two (w6) or all three at once (w9); 3, 3, then 6 mines in the boss rounds. |
| Off the far shore, east (spot 2) | (1500, 262) | sub salvos | A periscope at the lead ship while the east chute's mines cross its water (w7). |
| Spots 1 and 3, roads, air | (160, 262), (300, 722); the far shore's two pop-up roads; the edges | sub salvos, trucks, jets, bombers | The shared waves' own; from wave 4 the stealth bombers that sow (along the up-current edge of the lane: w4, w8, w10, the wave's own new enemies, the boss's vees). |

Warning time falls from 8.8 s on wave 1 to 5.1–5.3 s on wave 10 (−0.4 s a wave, rule `g-warning`; before: 9.3 to 4.4 s). A sown mine has the shortest warning on the map: it goes down 110–340 px ahead of a ship, 3–8 s before the ship reaches it.

## The stretches

- **Danger: the middle**, under the middle chute and the carrier: 42–46% of the hull damage in waves 1–9 (every Armory; before: 40–41%). The middle chute's curtains cross there, a held convoy sits there, and the swarms and missiles at the ship halfway along go there.
- **Safe: the early third**, the west: 18–23% (passes, under the 25% line). Before the rebuild it was 24–25% (the line).
- **The east** is in between (31–38%): the east chute's mines and the shells at the lead ship.
- Rule `m-carrier` asks that the danger stretch not be the carrier's closest; here it is (the carrier sits at (760, 718), under the middle), as it was before the rebuild. A question for the player (below).

## The convoy

The map's own convoy at the campaign's schedule (`MAP_CONVOY.sowers`: flow 1, pairs), with **Hold**, the map's one command and the only one left in the game (rule `m-convoy`: "a map gets a command only if its mechanic needs one (like Hold on Sowers' Reach)"). Unchanged by the rebuild.

What Hold is worth, on the bot (192 seeds, the usual Armory; `--pilot=sharp`: the convoy pilot holds when a raid opens or mines cross a ship's bow, `sim/convoyPilot.ts`): **before the rebuild Hold helped** (won 15% → 24%); **after it, it costs** (59% → 51%): the waves now fire at the ships sitting still (wave 5 by design) and the sown mines come ahead of a moving convoy anyway. The bot's Hold is crude (it reads the whole board and holds at every chance); the player's will be better judged. A question for the player (below).

## The signature: sown

The player's round 9 (r9-map-signature): each map gets a threat of its own in waves 4–10, tied to its identity and its boss. Sowers' identity is the mines; its boss is the Carpet Run (vees of Stealth Bombers across the lane). The signature takes one from each (`MAP_SIGNATURE.sowers`, from wave 4):

- **The wave's new enemies are Stealth Bombers** (`foe: 'stealthBomber'`, `foeShare: 1`), the Carpet Run's own, each in place of the enemy the planner drew (so the wave sends what it would, rule `w-budget`);
- **and every stealth bomber sows** (`sow: 3`): it flies along the up-current edge of the lane (`SOW.line`: 0.6 of the half-width north of the middle) and, in place of each of its missiles, lays a mine in the water a ship is about to sail through (110–340 px ahead of it, one every 0.55 s, `SOW`), so the mine drifts across the ship's path. Six hits stop the bomber before it sows; one stops each mine.

The encounters add their own (wave 4's from the east, wave 8's two, wave 10's), each standing in for one of the wave's own in waves 8 and 10 (`replaces.extras.stealthBomber`) so those waves do not pile up four.

How much of waves 4–10 it is (`tools/v3/combo-sweep/mixwaves.ts`, 8 seeds, the "you" bot drafting for itself, tough; stealth bombers and the mines they sow):

| | Waves 4–10 | Waves 6–10 | Boss rounds |
| --- | --- | --- | --- |
| Share of the threats that show | 8% | 8% | 71% |
| Share of the hits it takes to clear them | **19%** | 19% | 79% |

A little under the asked quarter (chapter 2: 20–25% by the same tool; the Battery 25%). Raising it costs win rate one for one: every wave 4-10 already sends a sower for each new enemy it draws (one a wave, two from wave 6, three on wave 10), and a sower shot down early sows little (about 1.3 mines each). Tried: sowing faster and further (`SOW` every 0.45 s, to 380 px: 20%, the usual Armory's win 69% → 62%), a fourth mine each (21%, about the same losses), and leaving wave 8's own sowers in (21%, but wave 8 then doubled wave 7 for two Armories). The chutes' own mines, the map's mechanic, are not counted as the signature (they are 10% of what shows in waves 4-10).

## The counters

- **Counter kit: Tesla Arc, Flak Cannon, Shield.** The Tesla's chain jumps along a string of mines and the swarm beside it in one shot; the Flak cloud waits where a curtain crosses the lane; the Shield takes the hit of the mine that gets through (it never stops a jet, but there are few here).
- **Off-counter kit: Seeker Pod, Shrapnel Shell, Full Steam.** The Seeker's long flight is late for a mine sown just ahead of a ship, the Shrapnel burst needs a bunch the drifting strings rarely make, and Full Steam sails the convoy into the mines faster.
- Both chosen from the combo sweep's singles at the final build (Tesla 4.7, Flak 5.8, Shield 5.8 ships lost over 13 waves; Seeker 7.7, Shrapnel 7.8, Full Steam 13.2). The Tesla Arc is the Battery's off-counter: the two maps of chapter 3 want different weapons. Every weapon is in chapter 3's draft. A design note for the bots only: nothing in the game nudges the player towards it.

How they compare (bot reports, 24 seeds, the kit as the bot's taste):

| Armory | Kit | Won | Lost in waves 1–10 (normal / tough) | Boss r1 / r2 / r3 (reached) |
| --- | --- | --- | --- | --- |
| usual (Quick Reload, Damage Control, Stockpile) | counter | 58% | 3.4 / **3.8** | 0.56 / 1.22 / 2.17 |
| | off-counter | 63% | 3.7 / 4.8 | 0.72 / 1.11 / 2.29 |
| latest (Wide Warhead, Point Defense, Supply Lines) | counter | **58%** | 4.3 / **5.5** | 0.86 / 0.71 / 1.00 |
| | off-counter | 33% | 4.6 / 7.3 | 0.89 / 1.00 / 1.44 |
| plating (Quick Reload, Armor Plating, Big Magazine) | counter | 83% | 2.5 / **2.5** | 0.68 / 0.73 / 1.24 |
| | off-counter | 83% | 3.0 / 4.0 | 0.60 / 0.55 / 1.05 |
| none | counter | 0% | 6.0 / 19.4 | – |
| | off-counter | 4% | 6.0 / 19.8 | – |

The counter kit loses fewer ships with every Armory (most clearly on the tough runs: 1.0–1.8 fewer), and wins far more often with the latest set; with the usual Armory the two win rates are within the 24-seed noise (±10 points), the off-counter a little ahead. Neither is trivial.

## Loadouts on this map (combo sweep singles)

Each weapon alone, forced at every draft (12 seeds, the player's usual Armory, version 48; `npm run v3:combo-sweep -- --stage=singles --maps=sowers --out=tools/v3/combo-sweep/results/v48-ch3`). Ships lost over all 13 waves:

- **Strong:** **Tesla Arc 4.7**, Flak 5.8, Shield 5.8, Boomerang 5.9, Gravity Well 5.9, Railgun 6.1, Scattergun 6.3, Drone Screen 6.3.
- **Middling:** Gunship Pair and Thermobaric Shell 6.5, Point Defense and Frigate Escort 6.7, Overdrive 7.1, Air Strike and Orbital Strike 7.2, Bomber Wing 7.3, Seeker 7.7, Shrapnel 7.8.
- **Weak:** Focus Fire, Grapnel and the Charge Lance 10.3, Supply Run alone 10.8, the plain gun 11.9, Full Steam 13.2, Dual Wield 13.9, the Laser Cutter (it only cuts) 59. The bot drafting for itself: 9.0 (won 42%).

## Diversity: are Sowers' best kits its own?

The player's rule for each rebuild: its best kits and its best weapon alone must differ from the other maps', and Air Strike should not be over-dominant. Sowers was swept the chapter 2 way (singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16), and compared with the five chapter 2 maps and the Battery from their last sweeps (`docs/design/v3-combo-diversity.md`, "Sowers' Reach"; `python3 tools/v3/sowers/compare.py`).

| | Result |
| --- | --- |
| Top 5 kits | **Air Strike + Gravity Well + Supply Run** 5.4, Frigate Escort + Supply Run + Shield 5.4, Shrapnel Shell + Railgun + Gunship Pair 5.5, Air Strike + Scattergun + Supply Run 5.6, Air Strike + Gunship Pair + Shield 6.1 |
| Jaccard of the top-5 kits, against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery | **0 / 0 / 0 / 0 / 0 / 0** |
| The same, Sowers against itself (two halves of its seeds) | 0.43 |
| #1 kit | in no chapter 2 or chapter 3 map's top 5 (the same three weapons are the Strait's #1 in the chapter 1 sweep, v31) |
| Best weapon alone | **Tesla Arc** 4.7 (the best single on no other map; the Battery's off-counter) |
| Rank correlation of the weapons alone, against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery | 0.27 / 0.38 / 0.41 / 0.45 / 0.30 / 0.67 |
| Air Strike | 14th of 25 alone (7.2); in three of the five best kits (with Supply Run or Shield), never at the top alone |

- **All five of Sowers' best kits are its own**, and its best weapon alone is its own: the Tesla Arc, whose chain jumps along a string of mines.
- **Air Strike is not over-dominant** alone (14th); it is in three of the five best kits, as on most maps (chapter 2's top kits lean on it with Supply Run too).
- **Its weapons alone rank least like chapter 2's** of any rebuilt map (0.27–0.45); most like the Battery's (0.67), its chapter's other map.

## Debuts: "New on Dark Water"

Not applicable on this map: chapter 3's five new enemies (Stealth Strafer, Stealth Bomber, Dive Bomber, Siege Battery, Spotter Plane) all debut on the Battery, the chapter's first map, waves 2–6, each with its "New on Dark Water" card (rule `m-debut-tag`). The drifting mine first shows here (wave 1), but it is a map's kind, not a new enemy, so it has no tag (`foeDebutTag`; the campaign's own first sight is as it was). The planner's draws on Sowers' waves 2–3 (a dive bomber each) are the shared wave's; from wave 4 the signature makes them stealth bombers. The encounters bring nothing from a later chapter (`tests/v3/encounters.test.ts`: mines, drones, shells, guided missiles, clusters and, from the signature's first wave, a stealth bomber).

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated, each with its filler on waves 1–6 (busier early waves, log v47: a string of two or three drones out of the far drone silos, the west and the east-middle, two strings on waves 1–2; 384 seeds, filler on against off, won 45% against 44%). **Nearly every shell the shared waves would send comes out of them** (the encounters take them, `replaces.ballistic` at or over the table's), and the encounters send mines, drones and a few shells at the lead ship in their place: what showed in waves 4–10 was 23% shells before, 2% after; drones 39% → 60%. `SOWERS_CLIMB` sends 5–12% less on waves 2–10, within ±15% (rule `w-budget`; the record report's furthest wave ×0.89–0.91 of the wave with no layer). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | Mines on the current (`sowers-current`) | east chute, 3 mines; west silo, 3 drones | the lead ship's water in the east; the lead ship |
| 2 | teach | Clear a gap (`sowers-gap`) | middle chute, 4 mines (a curtain); west silo, 3 drones | the middle, under the carrier; any ship; in place of the wave's mines and shells |
| 3 | teach | While they cross (`sowers-crossing`) | east chute, 3 mines; east silo, 2 shells 7 s later; east-middle, 5 drones | the lead ship and its water: a mine and a shell in the same seconds |
| 4 | combine | Sown ahead (`sowers-sown`) | a sowing stealth bomber from the east; west chute, 2 mines; a shell from the east silo; swarms of 5 and 4 | the water ahead of each ship it passes; the ships coming in; the middle; the lead ship |
| 5 | combine | Hold or sail (`sowers-hold`) | middle chute, 3 mines; west silo, 2 shells 8 s later; a guided missile; swarms of 5 and 4 | the curtain and the shells at the middle, where a held convoy sits; the missile at the lead ship |
| 6 | combine | Two fields (`sowers-two-fields`) | west and east chutes, 3 mines each; swarms of 6, 5 and 3; a shell from the east silo | both ends at once: the ships coming in and the lead ship |
| 7 | escalate | Periscope in the field (`sowers-periscope`) | east chute, 3 mines; a sub off the east shore, 2 shells; a guided missile; swarms of 8 and 6 | the salvo and the mines at the lead ship; the missile at the middle |
| 8 | escalate | Carpet (`sowers-carpet`) | two sowing stealth bombers, from the west, then 10 s later from the east; swarms of 7, 6 and 5 | the water ahead of the ships; in place of the wave's own two sowers, its shells, a missile and a cluster |
| 9 | escalate | The whole reach (`sowers-whole-reach`) | all three chutes, 2 mines each; a cluster from the east silo; a guided missile; swarms of 7 and 8 | the whole lane; the middle |
| 10 | climax | The last sowing (`sowers-last-sowing`), after the wave's own fire and a 6 s calm | a sowing stealth bomber from the east; east chute, 3 mines; a cluster and a shell from the east silo; swarms of 6 and 6 | the lead ship and its water; the ships coming in; any ship |

Wave 1 loses no ship on the record reports; over 60 seeds (`tools/v3/sowers/wave1.ts`) the casual bot loses 0.03 ships a run on it and the "you" bot 0.05 (the Battery's: 0.15 and 0.02), all to drones (its three drones at the lead ship come off the far west silo: off the east-middle one, a short flight, the casual bot lost 0.23).

**Wave 10, the climax:** the hardest regular wave with every Armory and not a wall: 0.95 ships for the usual Armory, 1.08 for the latest set, 0.73 for the plating set (192 seeds; before 1.50–1.72); on the tough runs no step to it doubles the wave before.

## The boss plan: the Carpet Run sowing

The Carpet Run is the map's own event: vees of three Stealth Bombers across the lane, one in the middle and two on its flanks, from alternate sides. Under encounter rev 4 (`SOWERS_BOSS_ROUNDS`, lab only), the map's signature is in it: each bomber sows a carpet of mines just ahead of the convoy in place of its missiles, while the chutes drop more and the silos fire at the lead ship.

| Round | Vees of 3 | Their gap | Hits each | Mines each sows | Chute mines | Shells (east silo) | Guided (south-east bank) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| before (every round) | 2 | 11 s | 3 | none (3 guided missiles at the ships) | 0 | 0 | 0 |
| 1 | 2 | 8 s | 3 | 3 | 3 (middle) | 3 | 1 |
| 2 | 3 | 8 s | 3 | 3 | 3 (east) | 3 | 1 |
| 3 | 3 | 7 s | 3 | 3 | 6 (west and east) | 3 | 2 |

The name stays the event's ("Carpet Run": a carpet of mines now), with the shared intro cards (log v30): "Boss round", "Convoy restored" (and the ships that can still be lost), "The boss: Carpet Run", "Round 1 of 3", then "Round 2 of 3" and "Round 3 of 3". Each round lasts 15–30 s (test, seed 220; of 22 rounds probed with `tools/v3/sowers/probe-boss.ts`, one ran 34 s).

How it reads (192 seeds, normal runs that reached it):

| Armory | Before r1 / r2 / r3 | After r1 / r2 / r3 |
| --- | --- | --- |
| usual | 0.90 / 0.69 / 0.97 | **0.77 / 1.21 / 1.93** |
| latest | 0.21 / 0.14 / 0.07 (14 runs reached it) | **0.79 / 0.91 / 1.51** |
| plating | 0.40 / 0.21 / 0.22 | **0.56 / 0.75 / 1.06** |

Rising with every Armory (before, round 3 was no harder than round 1), under the asked 1.5 / 2 / 2.5 a round as on the Battery and chapter 2: the convoy is restored before the boss and the loss limit is six, so rounds at 1.5 / 2 / 2.5 would end about half the runs that reach them. Tried: a second guided missile in round 2 (0.77 / 1.57 / 1.65, the usual Armory won 55% on 384 seeds).

## Bot results, before and after

"Before" is the map card as it was (log v47): policy D with Hold, no encounters, the Carpet Run as it was (`tools/v3/map-report/results/sowers-before*.md`, 24 seeds; and `--no-enc` on 192, the same game). "After" is this build. The record reports are 24 seeds (900–923; `npx vite-node tools/v3/map-report/report.ts -- --map=sowers --seeds=24 [--armory=player|latest|plating] --kits=plan`); the reads below them are 192 seeds (900–1091), the same bot and setup (`python3 tools/v3/sowers/read.py --seeds=192 --armory=... [--no-enc] [--tough]`).

### The headline (192 seeds, normal runs)

| Armory | Won before → after | Waves 1–5 lost | Waves 1–10 lost | Wave 7 | Wave 10 |
| --- | --- | --- | --- | --- | --- |
| **usual** (Quick Reload 5, Damage Control 4, Stockpile 5) | 15% → **59%** | 1.05 → **0.72** | 5.60 → 3.49 | 1.22 → 0.42 | 1.68 → 0.95 |
| latest (Wide Warhead 5, Point Defense 4, Supply Lines 3) | 7% → **56%** | 1.56 → **0.90** | 5.82 → 3.98 | 1.36 → 0.46 | 1.72 → 1.08 |
| plating (Quick Reload 5, Armor Plating 5, Big Magazine 4) | 35% → **83%** | 0.77 → **0.47** | 5.06 → 2.51 | 0.87 → 0.30 | 1.50 → 0.73 |
| none | 0% → 3% | 2.93 → 2.51 | 5.85 → 5.85 | 1.93 → 1.10 | – |

Normal-run curves, waves 1–10 then the boss rounds (runs that reached each):

| Armory | Before | After |
| --- | --- | --- |
| usual | 0 .17 .19 .34 .37 .68 1.22 1.36 1.39 1.68 · boss .90 .69 .97 | .01 .15 .24 .20 .14 .29 .42 .64 .75 .95 · boss .77 1.21 1.93 |
| latest | 0 .21 .23 .55 .61 .84 1.36 2.07 1.32 1.72 · boss .21 .14 .07 | 0 .14 .21 .25 .32 .37 .46 .97 .71 1.08 · boss .79 .91 1.51 |
| plating | 0 .08 .17 .25 .26 .47 .87 1.29 1.14 1.50 · boss .40 .21 .22 | 0 .09 .12 .12 .14 .19 .30 .37 .61 .73 · boss .56 .75 1.06 |

Tough-run curves (every seed plays every wave; the cliff check), after, 192 seeds: usual .01 .15 .29 .32 .17 .35 .52 .76 .97 1.30; latest 0 .14 .23 .38 .41 .53 .68 1.22 1.52 1.99; plating 0 .09 .14 .12 .18 .26 .41 .45 .84 .97. **No step doubles** (the largest: 1.49× on wave 7 for the usual set, 1.79× on wave 8 for the latest, 1.87× on wave 9 for the plating set; a wave under 0.25 counts as 0.25, as the report counts it).

### The record reports (24 seeds, 900–923)

| | Before latest / plating / usual / none | After latest / plating / usual / none |
| --- | --- | --- |
| Won (normal) | 8% / 25% / 17% / 0% | **50% / 83% / 54%** / 4% |
| Waves 1–5 lost (normal) | 1.54 / 0.71 / 1.13 / 2.88 | 1.08 / 0.50 / 0.50 / 2.75 |
| Waves 1–10 lost (normal) | 5.8 / 5.4 / 5.3 / 5.7 | 4.3 / 2.7 / 3.3 / 5.8 |
| Boss r1 / r2 / r3 (normal, reached) | 0.00 / 0.50 / 0.00 (2 runs); 2.17 / 0.25 / 1.00 (6, 4, 4); 1.00 / 0.00 / 0.00 (6); – | 0.58 / 0.50 / 1.25 (12); 0.71 / 0.81 / 1.15 (21); 0.75 / 1.06 / 1.75 (16); – |
| `w-cliff` (tough) | FLAG (w4, w7); FLAG (w7); FLAG (w6, w7); FLAG (w3, w7) | PASS; PASS; FLAG (w9: 0.42 → 1.33); PASS: 24 seeds; **PASS on 192 for all three** |
| `w-early` close calls from w3 | PASS | PASS (fewest 1.25–1.50 a run, on wave 4, for the three player Armories) |
| `w-budget` ±15% | PASS | PASS (furthest ×0.89–0.91) |
| `m-stretches` | PASS (hot middle 40–41%, cold early 24–25%) | PASS (hot middle 42–46%, cold early 18–23%) |
| `g-warning` | PASS: 9.3 → 4.4 s | PASS: 8.8 → 5.1–5.3 s |
| `w-first` | PASS | PASS |

The 24-seed record and the 192-seed reads disagree by up to 6 points on a win rate here (the Battery's: 14); the larger read is the one to trust.

### Sowers difficulty (rule `m-difficulty`; the brief: win 50–70%, waves 1–5 0.4–0.8)

- **The usual Armory wins 59%** (54% on the record), in the band; **the latest set 56%** (50%), in the band (on the Battery it won 28%); **the plating set 83%**, over it, as on the Battery (72%): Armor Plating keeps ships afloat through chip damage, and here a mine is the only thing that sinks a plated ship in one touch.
- **Waves 1–5:** 0.72 for the usual Armory and 0.47 for the plating set, in the band; the latest set 0.90 on 192 seeds (1.08 on the record), a little over.
- **The climb from wave 4 to 9** rises every wave for the usual Armory (.20 .14 .29 .42 .64 .75, then .95 on wave 10); waves 4 and 5 are the flattest (a sower and two swarms, a curtain and two shells).
- **Wave 10** is the hardest regular wave for every Armory and no step to it doubles.
- **Busier early waves:** threats on the board at a moment 2.1, 2.3, 2.0 on waves 1–3 (before 1.7, 1.6, 1.8), kills a minute 54, 53, 51 (before 43, 41, 49), the usual Armory.

## Fun measures (provisional, `src/v3/sim/funMetrics.ts`)

From `sowers-player.md` (the usual Armory):
- **Tension climbs:** its peak is 0.15, 0.47, 0.50, 0.35, 0.50 on waves 1–5, then 0.56, 0.60, 0.69, 1.06, 1.06 on waves 6–10, and 0.85–0.96 in the boss rounds (the mines count as no danger on this measure: a mine has no target, so it is no threat to a hull until it touches one; the sown ones read the same).
- **Close calls** from wave 3: 1.3–2.1 a run on the quietest wave (wave 4), more after.
- **Saves:** 0–0.3 a run on waves 1–10, 0.4–0.6 in the boss rounds; the fun check flags "flat" saves on most waves for every Armory, as on the Battery and before the rebuild.

## What is not satisfied, or uncertain

- **The signature is 19% of the hits in waves 4–10**, under the asked quarter (chapter 2's 20–25%, the Battery's 25%). Every way tried to raise it cost win rate about one for one (above).
- **The danger stretch is the carrier's own**: the middle, under the middle chute and the carrier (42–46%), against rule `m-carrier` ("the danger stretch is not the closest"); before the rebuild it was the middle too (40–41%). The waves tried the east (the lead ship's) as the danger for most of the tuning (late 38–46% on the record), but a cluster and a missile at the middle in waves 7 and 9 were what took the cliffs out.
- **Hold now costs the bot** (59% → 51% with the sharp pilot, which holds at every raid and every mine near a bow); before it helped (15% → 24%). The waves fire at a held convoy on purpose (wave 5), and a sown mine comes ahead of a held ship as well. The bot holds badly; whether a player's Hold is worth it is the map's open question.
- **The two Armories again:** the plating set wins 83%, the latest 56%, the usual 59% (192 seeds). As on the Battery, no single tuning puts the plating set in 50–70% without the others falling under it.
- **The boss is under 1.5 / 2 / 2.5** (0.56–0.79, 0.75–1.21, 1.06–1.93 a round on 192 seeds) to keep the win rate, as on every rebuilt map.
- **The 24-seed cliff check flags** wave 9 for the usual Armory (0.42 → 1.33); on 192 seeds no step doubles for any of the three player Armories. The cliffs moved with every small change while tuning (the sim is chaotic: one shell more on wave 4 moved wave 7 by 0.1); the final build was checked on 192 tough seeds for all three.
- **The record's counter kit wins no more than the off-counter with the usual Armory** (58% against 63% on 24 seeds), though it loses fewer ships; with the latest set it wins 58% against 33%.
- **Waves 1–5 for the latest set: 0.90** (192 seeds), over the 0.8 asked; the usual Armory's 0.72.
- **Its #1 kit is the Strait's #1 of the chapter 1 sweep** (Air Strike + Gravity Well + Supply Run, v31, another chapter's draft); against chapters 2 and 3 all five of its best kits are its own.
- **No light debut waves**, as on the Battery: nothing debuts here.
- **Mines and Hold are the bot's blind spots:** the bot sees every mine from the moment it drops and never misses an easy shot, so mines sink fewer ships for it than they will for a player (before the rebuild 0.02–0.04 a wave; now 0.1–0.5 on waves 4–10, mostly the sown ones); a player's waves 1–5 may well read harder than the bot's.

## The play log (v48)

`LOG_VERSION` 48, `LOG_REPLAYS` `[48]` (`src/v3/sim/playlog.ts`). The change is lab only, under the encounter layer: the campaign plays as at 47, and a 47 Sowers card log played the shared waves (it no longer replays to the same game). The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 48 (`python3 tools/v3/playtest-fixes/pins.py 47 48`, and `tests/v3/scorecard.test.ts`). The Test Lab's "Ready to test" lists Sowers' Reach at v48. The combo sweep's results are in `tools/v3/combo-sweep/results/v48-ch3`.

## Questions for the player

- **Shoot or hold: is Hold worth pressing now?** The bot does worse with it than without (it holds at every chance and the waves fire at a still convoy). Recommended: play it with Hold as you like; if you never press it, say so, and the next build either makes Hold cheaper (a shorter cooldown) or drops it and gives the map no command.
- **The sown mines: readable on the phone?** A stealth bomber has no warning arrow and its mines go down 3–8 s ahead of a ship. Recommended: play waves 4 and 8; if the mines feel unfair, the sower's first mine can wait until it is further in (`SOW.near`, now 110 px).
- **The signature at 19% of the work, not 25%: raise it?** Recommended: keep it; raising it costs win rate one for one, and the boss rounds are almost all sowing (79%).
- **The danger stretch is under the carrier (the middle).** Recommended: keep: the middle chute's curtains and a held convoy make the middle the place to watch, and the carrier helps there; moving the danger east took two cliffs with it.
- **The boss's name: Carpet Run (the event's own), or a name of its own like Saltgate's Gatecrashers ("The Sowing")?** Recommended: keep Carpet Run: it is literally a carpet of mines now.

## Tests

- `tests/v3/encounters.test.ts`:
  - the ten listed, rev 4, v1 only, none at rev 3; `REBUILT_MAPS` has Sowers;
  - the budget, legality (a stealth bomber from an edge from the signature's first wave), warning and replay checks cover the map; mines come only from the chutes;
  - the mechanic is in the waves: mines in waves 1–7, 9 and 10, a sowing bomber in 4, 8 and 10;
  - the Carpet Run's rounds: the vees each round (and no further apart), every bomber sowing, the chute mines, the fire at the lead ship, rising; a rev 3 log and the campaign play the event's two vees of missile-droppers and nothing else; 15–30 s a round; the event's name kept;
  - the signature: from wave 4 every new enemy the wave sends is a sowing stealth bomber, the campaign and the shared wave keep the planner's own; none before wave 4, before rev 4 or on the shared wave;
  - a sowing bomber lays its mines off the up-current edge of the lane, 110–340 px ahead of a ship, and fires no missile; the campaign's stealth bombers lay none;
  - the filler: every one of waves 1–6.
- `tests/v3/mapRules.test.ts`: no repeats and no gaps; `MAP_PLANS` complete; the boss target is 2.
- `tests/v3/mapCards.test.ts`, `round11.test.ts`: the production setup is policy D with Hold and the encounters ("Commands: Hold · encounters v1 Original"); Sowers' encounters may name Hold (its own command). `tests/v3/round12fixes.test.ts`: wave 1 opens with the east chute's three mines and three drones and loses no ship (seeds 11–13, "you" and casual).
- `tests/v3/readyToTest.test.ts`: the new entry. `tests/v3/scorecard.test.ts`: the log is version 48.
- `e2e/v3-map-cards.mjs`: the hub card says so; `?lab=map-sowers` opens the full map with Hold and encounters rev 4. `e2e/v3-encounters.mjs`: the card opens with its encounters and Hold, the pause screen's script names the Carpet Run, and skipped to the boss, the vees sow mines (a shot at one pixel a point: `e2e/shots/v3-encounters/sowers-boss.png`).

## What to look for when you play

Mines drift down across the lane from three chutes on the far shore. A ship can't steer round one, and one sinks it: shoot it (one tap) or press Hold to stop every ship and let it drift past, while the rest of the wave keeps firing at ships that are now sitting still. From wave 4 a dark bomber flies along the top of the lane and drops mines right in front of your ships: shoot the bomber before it sows, or the mines after. The middle of the lane, under the middle chute, is where it gets busiest. Wave 10 should be the hardest wave but not a wall. In the boss rounds, vees of three bombers sow a carpet of mines ahead of the convoy, more each round. The questions to answer: is Hold worth pressing, can you read the sown mines in time on the phone, and do the three boss rounds rise?

(This section names no weapon to try: the counter kit above is a design note for the bots, never shown in the game or on the hub.)
