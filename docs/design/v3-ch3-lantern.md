# The Black Strait (the Lantern): map card (map rebuild, chapter 3)

**Date:** 2026-11-22. The Black Strait (`lantern`, "the Lantern", chapter 3 "Dark Water", map 4 of 5, the 14th map) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), the way Battery Point (`docs/design/v3-ch3-battery.md`, #210) and Sowers' Reach (`docs/design/v3-ch3-sowers.md`, #213) were. Encounter rev 4; play log **v50** (the Rigs, built alongside, takes v49).

There is no player run of the Black Strait to start from. The starting point is the map as it was (the Test Lab card: today's convoy controls, the shared waves, the Bombardment as its event) and what the player asked of every rebuild: a question of its own and kits of its own, busier early waves ("more drones and easy things to kill", "less is more"), the climb from wave 4 to 9 they rated 5/5/5, no single-wave cliff, wave 10 the climax and not a wall, a boss with three rising rounds that is a set-piece, and everything readable on an iPhone in landscape (874×402).

As it was, its night was scenery: the lighthouse beam swept the far shore, but no wave used the dark, the hull damage was spread evenly over the lane (no safe stretch: early 30%, middle 39%, late 30%), the boss was trivial (the bot lost 0.06–0.10 ships a round), and wave 8 doubled wave 7. On the card's old setup (today's convoy controls, where the bot opens the flow up and spreads the ships) the bot won 70% with the usual Armory; on the map's own convoy (policy D, which every rebuilt map opens on) its shared waves won 9% at the campaign's flow and 18% at flow 2: the hardest shared waves of any rebuilt map.

Code:
- `src/v3/data/encounters.ts`: `LANTERN_R4` (ten encounters), the filler for waves 1–6 (`BUSY`), `LANTERN_CLIMB`, `MAP_SIGNATURE.lantern` (its new `beside` and `salvos`), `LANTERN_BOSS_ROUNDS` and `MAP_BOSS.lantern` (a boss round's `guns`, `gunGap`, `gunSalvos`, `dark`, `supply`), `CHAPTER_THREE_MAPS` (now the Battery, Sowers and the Black Strait, in `REBUILT_MAPS`), the script's words for siege guns;
- `src/v3/sim/foes.ts`: a siege gun whose launch names a base rises beside it (`siegeSpotAt` takes a side: the wave's own on the side towards the middle, an encounter's on the other) and fires the launch's salvos;
- `src/v3/sim/game.ts`: the signature's siege guns get their dark-bank base in turn and their salvos; an encounter's siege beat from a base passes its salvos;
- `src/v3/sim/events.ts`: the Bombardment reads its rounds from `MAP_BOSS` (its line of guns along the far shore, their gap and salvos, the guns on the dark bank, its supply swarms, the round's own launches); with no boss tuning it plays as it did;
- `src/v3/ui/foes.ts`, `ui/features.ts`, `ui/render.ts`: a siege battery's and a dive bomber's circles are drawn again on top of the night (`drawWarningMarks`), so a warning for something no interceptor can stop never dims (this also helps the Battery's Blackout);
- `src/v3/data/convoy.ts`: `MAP_CONVOY.lantern` (flow 2, Pairs, no command); `src/v3/data/mapPlans.ts`: `MAP_PLANS.lantern`; `src/v3/data/lab.ts`: "Ready to test" lists the Black Strait at v50; `src/v3/sim/playlog.ts`: `LOG_VERSION` 50;
- tools: `tools/v3/lantern/read.py` with `seeds.ts` (a tuning read on four processes), `sunk.ts` (what sinks the ships, wave by wave), `budget.ts` (each wave against the shared wave and no layer), `books.ts` (each encounter by the encounter test's books), `wave1.ts`, `probe-boss.ts` (the boss rounds as the encounter test plays them), `compare.py` (the diversity check); `tools/v3/combo-sweep/mixwaves.ts` counts the signature (`siege`).

Bot reports: `tools/v3/map-report/results/lantern-player.md` (the usual Armory: Quick Reload 5, Damage Control 4, Stockpile 5), `lantern-latest.md` (Wide Warhead 5, Point Defense 4, Supply Lines 3), `lantern-plating.md` (Quick Reload 5, Armor Plating 5, Big Magazine 4), `lantern.md` (no Armory); each with a heat map and the counter and off-counter kits; the map as it was: `lantern-before*.md`. Tuning reads: the record report's bot on 192 seeds (900–1091) (`python3 tools/v3/lantern/read.py --seeds=192 --armory=... [--tough] [--no-enc]`).

## How it is gated (lab vs campaign)

As every rebuild: **lab only, under the encounter layer.** The Test Lab's map card (`?lab=map-lantern`) opens on its production setup, policy D (the map's own convoy, no command) with the authored encounters rev 4, because the Black Strait is in `REBUILT_MAPS` (via `CHAPTER_THREE_MAPS`). The hub card reads "The map's own convoy (no commands) · encounters v1 Original". Everything new reads the run's encounter setup (`signatureOf`, `bossTune`), so the campaign, a run with no layer, a rev 3 log and the shared wave (`only: []`) play the Black Strait exactly as before: the shared waves, siege guns beside any base, and the Bombardment's three hatches. The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version.

## The problem

> Night: a threat is a faint glow until the lighthouse beam, the carrier's lamp or a star shell lights it, and the beam sweeps the far shore and the lane but never the enemy's own bank in the south-east, right behind the ships as they deliver, so the shells, missiles and siege guns from there come out of the dark on the shortest flights on the map.

The night is the map's one mechanic (rule `m-mechanic`; `night` in `data/maps20.ts`): a lighthouse on your own headland (652, 702) sweeps a 16° beam from west to east and back every 8 s, out to 1000 px; the carrier's lamp lights 200 px round it; a Star Shell (a pickup only this map drops) lights everything for 5 s. Everything else is a faint engine glow (still tappable); a shell's landing circle, and now a siege gun's circles, always show.

The beam's arc (−170° to −10°) covers the lane and the far shore, but **the enemy's bank in the south-east (bases at (1150, 835) and (1460, 825), and the sub spot off it at (1260, 650)) is below the lighthouse's horizon and out of the carrier's lamp**: nothing that comes from there is ever lit, and it is 250–350 px from the east of the lane, where the ships deliver. The question: **watch the beam, or watch your back?** The far shore's fire is seen in the sweep and has a long flight; the dark bank's is a glow and a circle, and arrives fast.

The mechanic is in every wave (rule `g-mechanic`; the test checks it): something comes out of the dark bank in all ten waves, a siege gun rises on it in every wave from 4, and the boss's guns line it from round 2.

How it differs from the other rebuilt maps: there the danger is a place the fire is aimed at (an island's side, a lock, the guns, the middle chute's curtain) or a ship (the tanker). Here it is where the fire comes from: behind the convoy, out of the one shore you can't see.

## Sites and their jobs

Bases and spots are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| West silo (base 1) | Far shore (250, 95) | drones, guided | Swarms at the ships coming in and the middle (w2, w4, w6–w10), guided missiles at the middle (w5, w7, w10); a filler drone silo (w1–6). |
| West-middle silo (base 2) | Far shore (650, 90), across from the lighthouse | shells | The lit shells: at the middle (w3, w9) and the ships coming in (w6). |
| East-middle silo (base 3) | Far shore (1050, 95) | clusters | Clusters at the lead ship (w6, w8, w10) and the middle (w9). |
| East silo (base 4) | Far shore (1420, 95) | drones | Swarms at the lead ship (w1, w3, w4, w6, w7, w10) and anywhere; the other filler silo. |
| The dark bank (base 5) | The enemy's bank (1150, 835), behind the east of the lane | shells, guided | Shells at the lead ship from behind (w2, w3, w6, w9), a guided missile (w8); a siege gun beside it (w4, w8, w10, the signature's every other gun, boss rounds 2–3); fire at the lead ship in every boss round. |
| The dark bank's east end (base 6) | (1460, 825) | drones, clusters | Drones at the lead ship from behind (w1, w5); siege guns beside it (w5–w7, w9, the signature's every other gun, boss round 3). |
| Off the dark bank (spot 3) | (1260, 650), south of the lane | sub salvos | A periscope in the dark water at the lead ship (w5, w8). |
| Spots 1 and 2, roads, air | Off the far shore (180, 240), (1460, 240); the two shore roads and pop-ups; the edges | sub salvos, trucks, jets, bombers | The shared waves' own. |

Warning time falls from about 13.6 s on wave 1 to 4–5 s on wave 10 (rule `g-warning`, as before). The dark bank's shells have the shortest flight on the map that isn't a jet.

## The stretches

- **Danger: the east (late third)**, under the dark bank, where the ships deliver: 41% of the hull damage in waves 1–9 for the usual Armory (the plating set's hottest is the middle, 40%).
- **Safe: the west (early third)**, under the beam and furthest from the dark bank: 21–23% (passes, under the 25% line), but 27% for the latest set.
- Before the rebuild there was no safe stretch (early 30%, middle 39%, late 30%).
- The carrier sits in the middle (905, 668), so the danger stretch is not its closest (rule `m-carrier`); the frigate's station is the west (380, 700).

## The convoy

The map's own convoy (`MAP_CONVOY.lantern`): **flow 2, Pairs, no command** (rule `m-convoy`: the night is read and shot, not sailed round). Flow 2, as most of chapter 2's maps (the Island, the Behemoth, the Needle, the Archipelago), not the campaign's step 1 of the Battery and Sowers: at step 1 its shared waves were the hardest of any rebuilt map (the bot won 9% with the usual Armory, encounters off); flow 2 spreads the same fire over more hulls (18%, encounters off; with the encounters at step 1 the build read 24% where flow 2 read 40%). The bot under today's convoy controls opened the flow to step 3–4 and spread the ships, and won 70%: the old card's number is not comparable with any rebuilt map's.

Tried: the Spread formation (three wide, splash halved, slower): fewer ships lost in waves 1–10 but more in the boss and on wave 4; dropped.

## The signature: guns in the dark

The player's round 9 (r9-map-signature): each map gets a threat of its own in waves 4–10, tied to its identity and its boss. The Black Strait's identity is the night; its boss is the Bombardment (Siege Batteries rising out of hatches). The signature takes one from each (`MAP_SIGNATURE.lantern`, from wave 4):

- **The wave's new enemies are Siege Batteries** (`foe: 'siege'`, `foeShare: 1`), the Bombardment's own, each in place of the enemy the planner drew (so the wave sends what it would, rule `w-budget`);
- **and they rise beside the dark bank** (`beside: [4, 5]`, in turn), the one shore the beam never reaches: their circles on the lane show (and now over the night); the gun that fires them is a glow. Five hits while it is up. **One salvo each** (`salvos: 1`; a siege gun's own is three): with three, the signature's guns sank more than any other threat (0.7–1.0 ships a wave on tough runs).

The encounters add their own siege gun beside the dark bank in every wave from 4 to 10 (one salvo, two in none), on the other side of the base from the wave's own so no two share a hatch.

How much of waves 4–10 it is (`tools/v3/combo-sweep/mixwaves.ts`, 8 seeds, the "you" bot drafting for itself, tough; the siege guns, each by its hits once however often it rises):

| | Waves 4–10 | Waves 6–10 | Boss rounds |
| --- | --- | --- | --- |
| Share of the threats that show | 6% | 7% | 19% |
| Share of the hits it takes to clear them | **22%** | 22% | 54% |

A little under the asked quarter (chapter 2: 20–25%; the Battery 25%; Sowers 19%); with one siege gun of the encounters' fewer a wave it was 17%. Its share of the losses is larger than its share of the hits: a siege shell cannot be shot down.

## The counters

- **Counter kit: Scattergun, Gunship Pair, Shield.** The fire from the dark bank arrives close to the ships on short flights, where the Scattergun's burst catches it; the Gunship Pair covers the lane on its own while you watch the beam; the Shield takes the hit of a siege shell no interceptor can stop.
- **Off-counter kit: Seeker Pod, Tesla Arc, Full Steam.** The Seeker's long flight is late for a shell from the dark bank, the Tesla's chain needs strings the scattered fire rarely makes, and Full Steam sails the convoy into the guns' circles faster.
- Both chosen from the combo sweep's singles at log v50 (Scattergun 3.8, Gunship Pair 4.6, Shield 4.7 ships lost over 13 waves; Seeker 11.3, Tesla 13.3, Full Steam 16.1). Air Strike (4.5, second alone) is left out of the counter kit on purpose (below). Every weapon is in chapter 3's draft. A design note for the bots only: nothing in the game nudges the player towards it.

How they compare: the record reports (below, "The counter and off-counter kits"): the counter kit wins more often with every Armory that wins (usual 58% against 50%, latest 50% against 25%, plating 92% against 83%).

## Loadouts on this map (combo sweep singles)

Each weapon alone, forced at every draft (12 seeds, the player's usual Armory, version 50; `npm run v3:combo-sweep -- --stage=singles --maps=lantern --out=tools/v3/combo-sweep/results/v50-ch3`). Ships lost over all 13 waves:

- **Strong:** **Scattergun 3.8**, Air Strike 4.5, Gunship Pair 4.6, Shield 4.7, Orbital Strike 5.0, Shrapnel 5.2, Frigate Escort 5.3, Railgun 5.8.
- **Middling:** Boomerang 6.1, Drone Screen 6.3, Thermobaric Shell 6.5, Gravity Well 6.7, Flak 7.3, Overdrive 8.1.
- **Weak:** Point Defense 10.8, Seeker 11.3, Tesla 13.3, Full Steam 16.1, Supply Run alone 16.3, Bomber Wing 17.3, the plain gun 18.1, Dual Wield 19.0, Charge Lance, Grapnel and Focus Fire 19.3, the Laser Cutter (it only cuts) 53. The bot drafting for itself: 9.9 (won 33%).

## Diversity: are the Black Strait's best kits its own?

Swept the chapter 2 way (singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16) and compared with the five chapter 2 maps, the Battery and Sowers from their last sweeps (`docs/design/v3-combo-diversity.md`, "The Black Strait"; `python3 tools/v3/lantern/compare.py`).

| | Result |
| --- | --- |
| Top 5 kits | **Air Strike + Frigate Escort + Supply Run** 2.9, Air Strike + Gunship Pair + Supply Run 3.1, Air Strike + Drone Screen + Shield 3.5, Air Strike + Railgun + Supply Run 3.6, Air Strike + Scattergun + Flak Cannon 3.6 (±0.5–0.6 each) |
| Jaccard of the top-5 kits, against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers | 0 / 0 / 0 / 0 / **0.11** / **0.11** / 0 |
| The same, against itself (two halves of its seeds) | 0.67 |
| #1 kit | **the Battery's #1** (its #2 is in Saltgate's top 5) |
| Best weapon alone | **Scattergun** 3.8 (the best single on no other rebuilt map) |
| Rank correlation of the weapons alone, against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers | 0.50 / 0.76 / 0.38 / 0.59 / 0.32 / 0.62 / 0.59 |
| Air Strike | 2nd of 25 alone (4.5); in **all five** of the best kits |

- **The best weapon alone is its own** (the Scattergun), and three of its five best kits are its own.
- **It shares two kits**: its #1 is the Battery's #1 (Air Strike + Frigate Escort + Supply Run), its #2 is in Saltgate's top 5. The five are within a standard error of each other, so the order is noise, but the overlap is real.
- **Air Strike is in all five best kits**, the most of any rebuilt map (two to four elsewhere), and second alone: by the kits it is over-dominant here. A question for the player (below).

## Debuts

Not applicable: chapter 3's five new enemies all debut on the Battery (waves 2–6), each with its "New on Dark Water" card. The siege gun the signature brings first showed there (wave 5); a device that meets it first on this card still gets its "New on Dark Water: Siege battery" card (the map card always gives a debut card). The encounters bring nothing from a later chapter (drones, shells, guided missiles, clusters, sub salvos and, from the signature's first wave, siege guns beside the dark bank; `tests/v3/encounters.test.ts`).

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated, each with its filler on waves 1–6 (a string of two or three drones out of the far shore's two drone silos, under the beam). Most of the shared waves' shells come out (they come from the west-middle silo and the dark bank at random); the encounters put a few back where the map wants them (one or two from the dark bank at the lead ship, one or two from the far shore), and the motherships of waves 6–10 come out for drone swarms. `LANTERN_CLIMB` sends 10–14% less on waves 2–10, within ±15% (rule `w-budget`: each wave ×0.86–1.05 of the wave with no layer, `tools/v3/lantern/budget.ts`). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | Glows in the dark (`lantern-first-light`) | east silo, 3 drones; then the dark bank's east end, 2 drones | the lead ship |
| 2 | teach | Shells from behind (`lantern-from-behind`) | the dark bank, 2 shells; west silo, 3 drones | the lead ship; the middle; in place of the wave's shells |
| 3 | teach | Both banks (`lantern-both-banks`) | west-middle 2 shells, then the dark bank 2 shells; east silo, 5 drones | the middle; the lead ship |
| 4 | combine | A gun in the dark (`lantern-gun-in-the-dark`) | a siege gun beside the dark bank; swarms of 4, 3 and 3 | the gun's circles; the ships coming in, the middle, the lead ship; in place of the shells, the cluster and a jet |
| 5 | combine | Periscope in the dark (`lantern-periscope`) | a sub off the dark bank, 2 shells; a guided missile; a siege gun beside the dark bank's east end; swarms of 5 and 4 | the lead ship (salvo, a swarm); the middle (missile) |
| 6 | combine | Front and back (`lantern-front-and-back`) | west-middle 1 shell; the dark bank 1 shell; a cluster; a siege gun; swarms of 4, 4 and 5 (and one of the wave's own shells) | the ships coming in and the lead ship at once; the middle |
| 7 | escalate | Two guns (`lantern-two-guns`) | a siege gun beside the dark bank's east end (with the wave's own two); a guided missile; swarms of 5, 5 and 5 | the guns' circles; the middle; the lead ship |
| 8 | escalate | Dark water (`lantern-dark-water`) | a sub off the dark bank, 2 shells; the dark bank, a guided missile; a cluster; a siege gun; swarms of 6, 5 and 6 | the lead ship (everything from behind); any ship |
| 9 | escalate | Crossfire (`lantern-crossfire`) | west-middle 1 shell; the dark bank 1 shell; a siege gun; a cluster; swarms of 6, 6 and 7 | the middle and the lead ship; the ships coming in |
| 10 | climax | Last light (`lantern-last-light`), after the wave's own fire and a 6 s calm | a siege gun beside the dark bank; a cluster at the lead ship; a guided missile; swarms of 5, 4 and 8 | the lead ship; the middle; the ships coming in |

**Wave 1** loses no ship on the record reports; over 60 seeds (`tools/v3/lantern/wave1.ts`) the casual bot loses 0.17 ships a run on it and the "you" bot 0.05, all to drones (its two drones from the dark bank are the shortest drone flight of any map's wave 1). The Battery's: 0.15 and 0.02.

**Wave 10, the climax:** the hardest regular wave for the usual Armory on the final build (0.96 against wave 9's 0.79), level with wave 9 for the others (the latest set 1.03 against 1.19, tough 2.02 against 1.91; the plating set 0.69 against 0.78); not a wall: no step to it doubles.

## The boss plan: the Bombardment along the shore

The Bombardment is the map's own event: Siege Batteries rising out of hatches beside the bases, with supply swarms whose drones drop pickups. Before: three hatches on the far shore, 3 s apart, two salvos each, and four supply swarms, the same every round (the bot lost 0.06–0.10 ships a round: the guns came up one at a time, each shot before it fired twice).

Under encounter rev 4 (`LANTERN_BOSS_ROUNDS`, lab only) it is a set-piece: **a line of guns along the whole far shore rising one after another, west to east, and from round 2 more on the dark bank behind the ships** (the signature's own place), with fire out of the dark bank at the lead ship.

| Round | Far-shore guns | Their gap | Salvos each | Dark-bank guns | Supply swarms | Fire from the dark bank at the lead ship |
| --- | --- | --- | --- | --- | --- | --- |
| before (every round) | 3 | 3 s | 2 | 0 | 4 | – |
| 1 | 3 | 2.2 s | 2 | 0 | 4 | 1 shell |
| 2 | 3 | 2.2 s | 2 | 1 | 4 | a guided missile, a shell |
| 3 | 4 | 2.2 s | 2 | 2 | 4 | a cluster |

The name stays the event's ("Bombardment"), with the shared intro cards (log v30): "Boss round", "Convoy restored", "The boss: Bombardment", "Round 1 of 3", then "Round 2 of 3" and "Round 3 of 3". Each round lasts 15–30 s (test, seed 225; `tools/v3/lantern/probe-boss.ts`).

How it differs from the signature: the waves' siege guns rise one at a time, a glow on the dark bank, one salvo; the boss is a wall of four to six guns rising in a walk along the shore and then behind you, two salvos each, enough of them up at once that you can't knock each out as it rises.

How it reads (192 seeds, normal runs that reached it):

| Armory | Before r1 / r2 / r3 | After r1 / r2 / r3 |
| --- | --- | --- |
| usual | 0.06 / 0.10 / 0.06 | **0.46 / 0.84 / 1.35** |
| latest | 0.13 / 0.08 / 0.21 | **0.15 / 0.60 / 1.44** |
| plating | 0.02 / 0.01 / 0.09 | **0.11 / 0.28 / 0.77** |

Rising with every Armory (before it was flat and near nothing), under the asked 1.5 / 2 / 2.5 a round as on every rebuilt map: the convoy is restored before the boss and the loss limit is six. Tried: four guns 1.2 s apart in round 1 and five-six later (1.3 / 2.4 / 2.2 for the usual Armory on 96 seeds, won 5% with the first waves); a cluster in round 2 (round 2 1.5, as heavy as round 3); round 3 without its cluster (round 3 0.96, under round 2; won 56%). The usual Armory's win rate moved 48% → 51% for one shell less in round 2 (and 55% once waves 6–7 kept a shell each for the wave budget: the 192-seed reads are noisy by about ±4 points).

## Bot results, before and after

"Before" is the map card as it was (log v48): today's convoy controls, no encounters, the Bombardment as it was (`tools/v3/map-report/results/lantern-before*.md`, 24 seeds; the 192-seed reads were run on the base build). "After" is this build. The record reports are 24 seeds (900–923; `npx vite-node tools/v3/map-report/report.ts -- --map=lantern --seeds=24 [--armory=player|latest|plating] --kits=plan`); the reads are 192 seeds (900–1091).

### The headline (192 seeds, normal runs)

The usual Armory's row is the final build; the latest, plating and no-Armory rows (and every tough curve) one drone earlier in wave 6 (the encounter test's planned budget took one out at the end).

| Armory | Won before → after | Waves 1–5 lost | Waves 1–10 lost | Wave 8 | Wave 10 |
| --- | --- | --- | --- | --- | --- |
| **usual** (Quick Reload 5, Damage Control 4, Stockpile 5) | 70% → **58%** | 0.38 → **0.80** | 3.31 → 3.84 | 0.65 → 0.49 | 1.24 → 0.96 |
| latest (Wide Warhead 5, Point Defense 4, Supply Lines 3) | 20% → **32%** | 0.95 → 1.04 | 5.51 → 5.01 | 1.67 → 1.02 | 1.96 → 1.03 |
| plating (Quick Reload 5, Armor Plating 5, Big Magazine 4) | 48% → **74%** | 0.44 → **0.45** | 3.86 → 3.38 | 0.99 → 0.60 | 1.24 → 0.69 |
| none | 0% → 1% | 2.42 → 2.59 | 5.67 → 5.92 | 2.19 → 1.67 | – |

The usual Armory's "before" is on the old setup (today's controls, where the bot opens the flow to step 3–4 and spreads the ships). On the map's own convoy with no encounters the same bot won 9% (step 1) or 18% (flow 2; waves 1–5 1.13, 1–10 5.68): measured that way, the rebuild takes the usual Armory from 18% to 58%.

Normal-run curves, waves 1–10 then the boss rounds (runs that reached each):

| Armory | Before | After |
| --- | --- | --- |
| usual | 0 .03 .05 .16 .14 .15 .28 .65 .81 1.24 · boss .06 .10 .06 | .02 .10 .07 .25 .36 .46 .63 .49 .79 .96 · boss .46 .84 1.35 |
| latest | 0 .09 .07 .39 .41 .70 .85 1.67 1.68 1.96 · boss .13 .08 .21 | .01 .18 .11 .23 .52 1.04 .90 1.02 1.19 1.03 · boss .15 .60 1.44 |
| plating | 0 .03 .02 .22 .17 .25 .50 .99 1.09 1.24 · boss .02 .01 .09 | .01 .05 .04 .15 .21 .49 .61 .60 .78 .69 · boss .11 .28 .77 |

Tough-run curves (every seed plays every wave; the cliff check), 192 seeds:
- before: usual 0 .03 .05 .16 .15 .15 .30 .82 .89 1.93 (wave 8 2.7× wave 7, wave 10 2.2× wave 9); latest 0 .09 .07 .51 .59 .83 1.48 2.82 3.96 6.32; plating 0 .03 .02 .23 .22 .27 .57 1.37 1.73 2.31 (wave 8 2.4×).
- after: usual .02 .10 .07 .25 .39 .48 .65 .76 1.13 1.11; latest .01 .18 .12 .31 .59 1.17 1.10 1.51 1.91 2.02; plating .01 .05 .04 .15 .21 .50 .70 .73 .92 .90.
- **No step more than doubles** (the largest: 1.98× on wave 6 for the latest set, 1.9× on wave 5; 2.0× on wave 6 for the plating set, .21 counted as .25: on the line; the usual set 1.5× at most). Before, waves 8 and 10 doubled.

### The record reports (24 seeds, 900–923)

| | Before latest / plating / usual / none | After latest / plating / usual / none |
| --- | --- | --- |
| Won (normal) | 25% / 38% / 63% / 0% | **25% / 75% / 58%** / 0% |
| Waves 1–5 lost (normal) | 0.58 / 0.29 / 0.13 / 2.63 | 1.08 / 0.37 / 0.46 / 2.63 |
| Waves 1–10 lost (normal) | 4.8 / 4.2 / 3.5 / 6.1 | 5.4 / 3.3 / 3.5 / 6.0 |
| Boss r1 / r2 / r3 (normal, reached) | ~0.1 a round or less (every Armory) | 0.00 / 0.67 / 1.33 (6 runs); 0.05 / 0.32 / 1.32 (19); 0.50 / 1.06 / 1.56 (18); – |
| `w-cliff` (tough) | FLAG (w6, w8); FLAG (w8); FLAG (w8, w10); FLAG (w4) | FLAG (w5 0.25→0.71, w6 0.71→1.50); PASS; FLAG (w7 0.33→0.79); FLAG (w4, w6): 24 seeds; **on 192 no step more than doubles for the three player Armories** (above; the latest set's w6 1.98×, the plating set's w6 2.0×: on the line) |
| `w-early` close calls from w3 | PASS | PASS (fewest 1.3–1.6 a run, on wave 4) |
| `w-budget` ±15% | PASS | PASS for the three player Armories (furthest ×0.86–0.87); the no-Armory report reads wave 7 at ×0.85, on the line (`tools/v3/lantern/budget.ts`: ×0.88) |
| `m-stretches` | **FLAG**: no safe stretch (hot middle 39–42%, cold late 27–30%) | **PASS** for usual and plating (hot late 41%, cold early 22%; plating hot middle 40%, cold early 21%), none (cold early 23%); FLAG for the latest set (cold early 27%) |
| `g-warning` | PASS: 13.6 → 4.5 s | PASS: 12.0 → 5.3–5.5 s |
| `w-first` | PASS | PASS (0.00–0.08 a run) |

The 24-seed record and the 192-seed reads disagree by a few points on a win rate (usual 58% against 55%, latest 25% against 32%); the larger read is the one to trust.

### The counter and off-counter kits (record reports, the kit as the bot's taste)

| Armory | Kit | Won | Lost in waves 1–10 (normal / tough) | Boss r1 / r2 / r3 (reached) |
| --- | --- | --- | --- | --- |
| usual | counter | **58%** | 3.5 / **3.6** | 0.47 / 0.95 / 1.44 |
| | off-counter | 50% | 4.3 / 5.4 | 0.75 / 0.88 / 1.94 |
| latest | counter | **50%** | 4.8 / **6.2** | 0.08 / 0.58 / 0.75 |
| | off-counter | 25% | 5.5 / 9.5 | 0.00 / 0.33 / 1.50 |
| plating | counter | **92%** | 2.7 / **2.7** | 0.09 / 0.27 / 0.50 |
| | off-counter | 83% | 3.5 / 4.0 | 0.05 / 0.05 / 0.80 |
| none | counter | 0% | 6.0 / 18.0 | – |
| | off-counter | 0% | 6.0 / 18.3 | – |

The counter kit wins more often and loses fewer ships than the off-counter kit with every Armory that wins at all (most clearly with the latest set: 50% against 25%); neither is trivial.


### Black Strait difficulty (rule `m-difficulty`; the brief: win 50–70%, waves 1–5 0.4–0.8)

- **The usual Armory wins 58%** (55–58% over the last three builds), in the band; **the plating set 74%**, over it, as on the Battery (72%) and Sowers (83%); **the latest set 32%**, under it (the Battery's 28%, Sowers' 56%).
- **Waves 1–5:** 0.80 for the usual Armory (the top of the band), 0.45 for the plating set; the latest set 1.04, over.
- **The climb from wave 4 to 9** rises for the usual Armory (.25 .36 .46 .63 .49 .79, then .96 on wave 10): wave 8 dips under wave 7.
- **Wave 10** is the hardest regular wave for the usual Armory on the final build (0.96; tough 1.11 against wave 9's 1.13 one drone earlier): within the noise, waves 9 and 10 are close; not a wall either way.

## What is not satisfied, or uncertain

- **The bot cannot see the night.** The sim has no darkness (it is drawn only): the bot sees every glow as a threat of its kind from the moment it launches. A player reads a glow, not a kind, and the dark bank's shells and guns will be harder for a player than for the bot. Not modelled, as Sowers' mines and Hold were not: a modest "dark reaction" handicap on the bot was considered and left out (no player data to fit it to, and it would make this map's bot numbers incomparable with every other map's).
- **Air Strike leans hard**: in all five best kits and second alone; and the #1 kit is the Battery's #1. Diversity passes for the best weapon alone (the Scattergun is its own) and for three of five kits.
- **The win rates of the three Armories spread wide** (32% / 58% / 74%), as on the Battery: the plating set shrugs off chip damage, the latest set (no Damage Control) does not.
- **The boss is under 1.5 / 2 / 2.5** (0.46 / 0.84 / 1.35 for the usual Armory) to keep the win rate, as on every rebuilt map.
- **Wave 10 is close to wave 9**: above it for the usual Armory on the final build, level with it for the latest and plating sets.
- **The latest set is under the band** (32%), its waves 1–5 over (1.04).
- **Flow 2, not the campaign's step 1**: the convoy sails more ships than the Battery's and Sowers'. It is the chapter 2 maps' flow, but a change from how the campaign plays this map.
- **Wave 1 with the casual bot**: 0.17 ships a run (the two drones out of the dark bank, the shortest drone flight of any wave 1). The record bot loses none.
- **The dark-bank guns sit low on a phone** (y 830–840 of 900): visible at 874×402, but a "NEW" card or an alert in the bottom-right corner can cover them for a few seconds.
- **The convoy before** cannot be compared directly: the old card played today's convoy controls (the bot opened the flow and spread the ships: 70%); every rebuilt map's card plays the map's own convoy.

## The play log (v50)

`LOG_VERSION` 50, `LOG_REPLAYS` `[50]` (`src/v3/sim/playlog.ts`). The change is lab only, under the encounter layer, and the night drawing: the campaign plays as at 48, and a v48 Black Strait card log played today's convoy controls and the shared waves (it no longer replays to the same game). The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly with telemetry on and off. The version pins moved to 50 (`python3 tools/v3/playtest-fixes/pins.py 48 50`, and `tests/v3/scorecard.test.ts`). The Rigs, built alongside, takes v49 and merges first. The Test Lab's "Ready to test" lists the Black Strait at v50. The combo sweep's results are in `tools/v3/combo-sweep/results/v50-ch3`.

## Questions for the player

- **Can you read the dark?** The dark bank's fire is a glow until it lands near the ships, and its siege guns are a glow on the bottom edge. Recommended: play waves 2–5; if the shells from behind feel unfair, the next pass gives the dark bank's launches a flash that lingers a second longer (a lit launch).
- **Air Strike in every best kit.** Recommended: leave it for the after-rollout overpowered pass (round 1's decision: "overpowered combos wait until after the rollout"), and note it if it feels too strong here.
- **Flow 2 on this map.** Recommended: keep it (at the campaign's flow its waves were the hardest of any rebuilt map); say so if the convoy feels crowded.
- **The boss's name: Bombardment (the event's own), or a name of its own ("The Gun Line")?** Recommended: keep Bombardment.
- **The Star Shell** is still only a pickup. Recommended: leave it; if the night is hard to read on the phone, the next pass drops a star shell at the start of each boss round, as the Blackout does.

## Checks run

`tsc`; `vitest --exclude '.claude/**'` (the full suite; see the report for the count); `vite build`, then `vite preview` and the e2e scripts `v3.mjs`, `v3-map-cards.mjs`, `v3-encounters.mjs`, `v3-map-lab.mjs`, `v3-convoy.mjs` (all pass); the map-lab baseline replays exactly.

## Tests

- `tests/v3/encounters.test.ts`:
  - the ten listed, rev 4, v1 only, none at rev 3; `REBUILT_MAPS` has the Black Strait;
  - the budget, books, legality (a siege gun beside a dark-bank base from the signature's first wave), warning and replay checks cover the map;
  - the mechanic is in the waves: the dark bank's bases are out of the beam's arc and the carrier's lamp; something comes out of the dark bank in all ten waves; a siege gun rises there in every wave from 4;
  - the Bombardment's rounds: the guns each round (far shore and dark bank), the fire from the dark bank at the lead ship, rising, the line no further apart; a rev 3 log and the campaign play the event's three hatches and nothing else; 15–30 s a round; the event's name kept; the guns rise west to east along the far shore, then on the dark bank;
  - the signature: from wave 4 every new enemy the wave sends is a siege gun beside the dark bank, in turn, firing one salvo; the campaign's and the shared wave's rise beside any base; the wave and an encounter's guns never share a hatch; within the wave budget;
  - the filler: every one of waves 1–6.
- `tests/v3/mapRules.test.ts`: no repeats and no gaps; `MAP_PLANS` complete; the boss target is 2. `tests/v3/convoy.test.ts`: flow 2, Pairs, no command.
- `tests/v3/mapCards.test.ts`, `round11.test.ts`: the production setup is policy D with no command and the encounters. `tests/v3/round12fixes.test.ts`: wave 1 opens with its two strings of drones and loses no ship (seeds 11–13, "you" and casual).
- `tests/v3/readyToTest.test.ts`: the new entry. `tests/v3/scorecard.test.ts`: the log is version 50.
- `e2e/v3-map-cards.mjs`: the hub card says so. `e2e/v3-encounters.mjs`: the card opens with its encounters and no command, the pause screen's script names its first encounter and the Bombardment, and skipped to the boss, the guns rise and mark the lane (a shot at one pixel a point: `e2e/shots/v3-encounters/lantern-boss.png`).

## What to look for when you play

It's night. Threats are faint glows until the lighthouse beam sweeps over them. Most of the fire comes from the far shore, where the beam finds it, but the enemy's bank in the bottom right, behind your ships as they deliver, is never lit: shells, drones and missiles come out of it on very short flights, and from wave 4 siege guns rise there and mark orange circles on the lane (their shells can't be shot down: hit the gun while it's up, or keep ships out of the circles). The west of the lane is the calmest, the east the hottest. Wave 10 should be the hardest wave but not a wall. In the boss rounds, a line of siege guns rises along the far shore one after another, and from round 2 more rise behind you. The questions: can you read the dark bank in time on the phone, and do the three boss rounds rise?

(This section names no weapon to try: the counter kit above is a design note for the bots, never shown in the game or on the hub.)
