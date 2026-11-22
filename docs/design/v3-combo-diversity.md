# V3 combo diversity: are the best kits different on each map?

> 2026-11-20, game version 31 (LOG_VERSION), the "you" bot after the boosts round (BOT_REV 3), your Armory (Quick Reload 5, Damage Control 4, Stockpile 5). Made by `tools/v3/combo-sweep/diversity.ts` and `mix.ts` from the sweep's singles and pairs (`tools/v3/combo-sweep/results/v31`, `v31-ch2`; per-map kits in `v31/diversity.json`). Nothing here was retuned.

You asked: "Main action item here is to see if there is diversity of best combos per the maps. If one combo is the top for all maps, then that suggests our design for the maps and waves are all the same."

## Headline

- **No kit is the best on more than one map.** Each of the seven maps has its own #1 kit, and their top-5 lists barely overlap: a Jaccard of **0.02** between maps (0 = nothing shared, 1 = the same five). On one map, the top 5 read from two halves of its seeds agree at **0.38**, so the maps differ far more than the noise.
- **Three pairs of maps do share a kit near the top:** the Island's #1 is the Behemoth Run's #2 (Point Defense + Supply Run + Shield), the Strait's #1 is Harbor's #3, and the Gauntlet's #1 is Kesh's #2.
- **They agree on the weapons underneath.** **Air Strike** is the best weapon alone on all five chapter 1 maps. **Supply Run** is in a top-5 kit on all seven maps, Point Defense and Air Strike on six. The weapons alone rank much the same from map to map (rank correlation 0.53).
- **So the maps reward different combinations of the same core**, not different first picks. Chapter 2 adds one clear answer of its own: **Shield** is in all five of the Behemoth Run's top kits and three of the Island's.
- **Why:** waves 1–10 throw much the same thing on every map: drones and shells are 60–80% of what shows. Only the boss rounds differ, and they are 3 of 13 waves.

## Each map's top 5 kits

Each map's own 6 best pairs with each third weapon its chapter deals, screened on 6 seeds of that map; that map's 10 best kits again on 16 seeds. Ships lost a run over all 13 waves (± one standard error) and the share won under the normal loss limit. Kits within about 1.5 ships of each other are a tie.

| Map | #1 | #2 | #3 | #4 | #5 |
| --- | --- | --- | --- | --- | --- |
| The Strait | **Air Strike + Gravity Well + Supply Run** 7.1 ±1.0, won 75% | Air Strike + Point Defense + Gravity Well 7.6 | Air Strike + Point Defense + Supply Run 8.9 | Air Strike + Boomerang + Gravity Well 9.1 | Thermobaric + Point Defense + Supply Run 9.2 |
| The Gauntlet | **Air Strike + Scattergun + Point Defense** 7.2 ±0.7, 44% | Scattergun + Gravity Well + Tesla Arc 7.3 | Frigate Escort + Thermobaric + Supply Run 7.4 | Shrapnel + Gravity Well + Railgun 7.6 | Shrapnel + Frigate Escort + Supply Run 7.6 |
| Harbor Mouth | **Point Defense + Drone Screen + Supply Run** 9.8 ±0.7, 50% | Frigate Escort + Scattergun + Gravity Well 10.3 | Air Strike + Gravity Well + Supply Run 10.3 | Frigate Escort + Gravity Well + Railgun 10.6 | Flak + Gravity Well + Supply Run 10.8 |
| The Kesh Hook | **Point Defense + Tesla Arc + Overdrive** 8.3 ±1.1, 50% | Air Strike + Scattergun + Point Defense 8.4 | Air Strike + Thermobaric + Point Defense 8.9 | Tesla Arc + Drone Screen + Supply Run 9.0 | Thermobaric + Tesla Arc + Drone Screen 9.3 |
| Lee of Marrow | **Frigate Escort + Drone Screen + Supply Run** 3.9 ±0.4, 100% | Air Strike + Flak + Supply Run 4.0 | Gravity Well + Railgun + Drone Screen 4.1 | Air Strike + Frigate Escort + Drone Screen 4.2 | Gravity Well + Drone Screen + Supply Run 4.2 |
| The Island (ch. 2) | **Point Defense + Supply Run + Shield** 7.1 ±0.9, 63% | Air Strike + Frigate Escort + Thermobaric 8.1 | Shrapnel + Shield + Full Steam 8.4 | Shrapnel + Point Defense + Shield 8.8 | Air Strike + Frigate Escort + Gravity Well 8.9 |
| The Behemoth Run (ch. 2) | **Boomerang + Supply Run + Shield** 6.3 ±0.4, 88% | Point Defense + Supply Run + Shield 7.8 | Frigate Escort + Supply Run + Shield 7.9 | Flak + Point Defense + Shield 8.0 | Point Defense + Railgun + Shield 8.0 |

The Island and the Behemoth Run were swept with chapter 2's draft (chapter 1's weapons plus the Charge Lance, Gunship Pair, Shield and Full Steam).

## How much the maps overlap

| Measure | Result | Reads as |
| --- | --- | --- |
| Jaccard of the top-5 kits, map against map (mean of 21 pairs of maps) | **0.02** | almost no shared kits |
| The same, one map against itself (two halves of its 16 seeds) | 0.38 | what noise alone allows |
| Pairs of maps sharing any top-5 kit | 3 of 21 (Island–Behemoth, Strait–Harbor, Gauntlet–Kesh; one kit each) | |
| Maps where the same kit is #1 | **1 of 7** for every kit | every map has its own #1 |
| Maps where the same weapon is best alone | **5 of 7** (Air Strike; the Island: Gunship Pair; the Behemoth Run: Frigate Escort) | the first pick is the same |
| Rank correlation of the weapons alone, map against map (mean) | **0.53** | weapons rank much alike |
| Top-10 pairs, chapter 1, ranked on waves 1–10 only / boss rounds only (Jaccard) | 0.12 / 0.12 | pairs at 6 seeds are mostly noise |

Weapons in each map's top-5 kits (how many of the five):

| Weapon | Strait | Gauntlet | Harbor | Kesh | Marrow | Island | Behemoth | Maps |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Supply Run | 3 | 2 | 3 | 1 | 3 | 1 | 3 | **7** |
| Point Defense | 3 | 1 | 1 | 3 | 0 | 2 | 3 | 6 |
| Air Strike | 4 | 1 | 1 | 2 | 2 | 2 | 0 | 6 |
| Gravity Well | 3 | 2 | 4 | 0 | 2 | 1 | 0 | 5 |
| Frigate Escort | 0 | 2 | 2 | 0 | 2 | 2 | 1 | 5 |
| Thermobaric Shell | 1 | 1 | 0 | 2 | 0 | 1 | 0 | 4 |
| Railgun | 0 | 1 | 1 | 0 | 1 | 0 | 1 | 4 |
| Drone Screen | 0 | 0 | 1 | 2 | 4 | 0 | 0 | 3 |
| Scattergun | 0 | 2 | 1 | 1 | 0 | 0 | 0 | 3 |
| Flak Cannon | 0 | 0 | 1 | 0 | 1 | 0 | 1 | 3 |
| Shield (ch. 2) | – | – | – | – | – | 3 | **5** | 2 of 2 |
| Tesla Arc | 0 | 1 | 0 | 3 | 0 | 0 | 0 | 2 |
| Shrapnel Shell | 0 | 2 | 0 | 0 | 0 | 2 | 0 | 2 |
| Boomerang | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 2 |
| Overdrive | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 |
| Full Steam (ch. 2) | – | – | – | – | – | 1 | 0 | 1 |

Some map leans do show: Marrow favours Drone Screen (4 of 5), Kesh Tesla Arc (3 of 5), Harbor Gravity Well (4 of 5), the Strait Air Strike (4 of 5).

## Why the core is shared: what each map throws

The threats that showed on screen, as a share of all of them (`mix.ts`, 2 seeds a map):

| Map | Waves 1–10 | Boss rounds |
| --- | --- | --- |
| The Strait | drones 53%, shells 15%, sprinters 8%, guided 8% | sprinters 65%, darts 19%, Hydras 16% |
| The Gauntlet | shells 34%, drones 33%, sprinters 8%, guided 7% | drones 51%, rocket trucks 49% |
| Harbor Mouth | shells 35%, drones 20%, sprinters 7%, bomblets 6% | drones 34%, rocket trucks 22%, sprinters 15%, shells 12%, Hydras 12% |
| The Kesh Hook | shells 44%, drones 27%, sprinters 8%, guided 5% | drones 91% |
| Lee of Marrow | shells 37%, drones 35%, guided 7%, sprinters 7% | darts 50%, Hydras 28%, drones 16% |
| The Island | drones 45%, shells 31%, guided 6% | drones 48%, helicopter rockets 25%, attack helicopters 14% |
| The Behemoth Run | drones 52%, shells 25%, guided 7% | torpedoes 52%, subs 33%, guided 15% |

- **Waves 1–10 ask the same question on every map.** Drones plus shells are 60–80% of what shows, with the same handful of sprinters, guided missiles and strafers. Ten of the 13 waves ask "can you thin a swarm and stop a shell?" Air Strike, Point Defense and Gravity Well answer that best anywhere, and Supply Run keeps any of them loaded. That is why the first pick is the same everywhere.
- **The boss rounds differ** (sprinters on the Strait, rocket trucks on the Gauntlet, a drone storm at Kesh, Hydras at Marrow, helicopters at the Island, torpedoes on the Behemoth Run). That is where the second and third slots change, so the full kits differ.

**Where two maps share a kit:**
- **The Island and the Behemoth Run (Point Defense + Supply Run + Shield).** Shield blocks missiles, drones and boats for 15 s. Both maps' waves 1–10 are the most drone-heavy in the game (45% and 52%), and both boss rounds are a stream of missiles at the ships: helicopter rocket pairs at the Island, torpedo spreads and cruise missiles on the Behemoth Run. A shield over the hulls is the right answer to both, so chapter 2's two maps ask one question: "survive a missile stream".
- **The Strait and Harbor (Air Strike + Gravity Well + Supply Run).** Both open with the most drones in chapter 1's waves (the Strait 53%), and both boss rounds are fast swarms coming in a line (the Strait's sprinters; Harbor's drones and sprinter swarm). A well that pulls a swarm together and a strike that lands on it suit both.
- **The Gauntlet and Kesh (Air Strike + Scattergun + Point Defense).** Both have shell-heavy waves (34% and 44%) and drone boss rounds (the Gauntlet's swarms with the trucks; Kesh's Drone Storm).

## Suggestions (nothing applied)

To make the maps ask different questions, change waves 1–10, not only the bosses:
1. **Give each map one signature threat in waves 1–10,** at 20–30% of what shows from waves 4–5 on: the boss round's own kind arriving early. For example rocket trucks on the Gauntlet's shore roads, torpedoes and subs on the Behemoth Run, helicopters at the Island, Hydras at Marrow. Today those threats are 0–2% of waves 1–10.
2. **Split chapter 2's two maps.** Today both end in a missile stream that Shield answers. One of them should end in something Shield does not stop: the Behemoth Run's supertanker problem could be about the heavies that go for it (Railgun, Frigate Escort), and the Island's about the close silos with no warning (Point Defense, Gravity Well).
3. **Thin the shared drone-and-shell base where a map's problem is something else.** Kesh and the Gauntlet both lean on shells (34–44%), the Strait and Harbor on drones and swarms. A map whose problem is the neck (Harbor) or the hook (Kesh) could swap part of that base for what the problem needs.
4. **A check for rule `m-kits`.** Today it asks that a map's counter kit beats the bot's own draft. A second check could ask that no two maps of a chapter share a top-3 kit (chapter 2 fails it today: the Island's #1 is the Behemoth Run's #2), and that the best weapon alone is not the same on every map of a chapter (chapter 1 fails it: Air Strike on all five).
5. **Air Strike is the one weapon everywhere** in chapter 1: best alone by about 2 ships a run (7.0 against 8.8 for Point Defense next). If one weapon should not be the answer to every map, this is the one to look at. That is a design call, not a balance emergency.

## How far to trust it

- This is the "you" bot, not you. It plays your rhythm and aim and now your Overdrive, but reads the boss rounds harder than you do (docs/design/v3-bot-refit.md).
- Loadouts are forced: every draft deals the next card of the kit, which is the best case for a kit.
- The top 10 got 16 seeds a map. A kit's standard error is about 0.4–1.1 ships, so neighbours in a top 5 are often a tie. What shows the lists really differ is 0.02 between maps against 0.38 within a map.
- Each map's triples come from its own 6 best pairs (6 seeds). A kit whose pairs all ranked below that on the map was not tried.
- The Laser Cutter is left out because the bot cannot swipe. The Charge Lance is tapped but never charged, so it is undersold.
- An earlier pass (bot revision 2, where every boost waited for a lull) undersold Shield and Supply Run. It gave the same headline (Jaccard 0.02, Air Strike first alone on five maps) with Shield in fewer chapter 2 kits.

```
npm run v3:combo-sweep -- --stage=singles --out=tools/v3/combo-sweep/results/v31
npm run v3:combo-sweep -- --stage=pairs --out=tools/v3/combo-sweep/results/v31
npm run v3:combo-sweep -- --stage=singles --maps=island,behemoth --out=tools/v3/combo-sweep/results/v31-ch2
npm run v3:combo-sweep -- --stage=pairs --maps=island,behemoth --out=tools/v3/combo-sweep/results/v31-ch2
npx vite-node tools/v3/combo-sweep/diversity.ts -- --dirs=tools/v3/combo-sweep/results/v31,tools/v3/combo-sweep/results/v31-ch2 --json=tools/v3/combo-sweep/results/v31/diversity.json
npx vite-node tools/v3/combo-sweep/mix.ts -- --seeds=2
```

## Round 9: chapter 2 after the signature threats and the new Behemoth boss (game version 33)

> 2026-11-20. The player chose r9-map-signature (a signature threat per map, chapter 2 first), r9-ch2-split (the Behemoth Run's boss becomes something the Shield doesn't stop) and r9-overdrive-buff. Same method as above, chapter 2 only: the "you" bot (BOT_REV 3), your Armory, singles on 12 seeds, every pair on 6, each map's 6 best pairs with every third weapon on 6, its 10 best kits on 16. "Before" is game version 32 (the build you are playtesting), run again the same way; "after" is version 33. Results: `tools/v3/combo-sweep/results/v32-ch2`, `v33-ch2`.

What changed (docs/design/v3-ch2-island.md and v3-ch2-behemoth.md, "After round 9"):
- **The Island:** from wave 6 the wave's new enemies are all attack helicopters, the Gunship Wall's own (`MAP_SIGNATURE`). The debut waves 2–5 are as they were.
- **The Behemoth Run:** from wave 4 the wave's jets strafe the supertanker's lane and its heavies go for the tanker. The boss rounds are now a strike on the tanker led by strike jets (8, 9, then 11 a round), which the Shield never stops, with a heavy at the tanker and at most one sub. (The Shield blocks heavies as it blocks every missile, so heavies alone, the example you gave, would not have split the kit.)

### Each map's top 5 kits

| Map | #1 | #2 | #3 | #4 | #5 |
| --- | --- | --- | --- | --- | --- |
| The Island, before | **Point Defense + Supply Run + Shield** 6.5 ±0.8, won 75% | Scattergun + Boomerang + Shield 7.4 | Point Defense + Drone Screen + Shield 8.1 | Point Defense + Tesla Arc + Shield 8.1 | Point Defense + Overdrive + Shield 8.4 |
| The Island, after | **Point Defense + Supply Run + Overdrive** 7.6 ±0.7, 56% | Gunship Pair + Supply Run + Shield 7.7 | Air Strike + Shrapnel + Shield 8.2 | Air Strike + Shrapnel + Tesla Arc 8.4 | Shrapnel + Gravity Well + Railgun 8.9 |
| The Behemoth Run, before | **Boomerang + Supply Run + Shield** 6.3 ±0.4, 88% | Point Defense + Supply Run + Shield 7.8 | Frigate Escort + Supply Run + Shield 7.9 | Flak + Point Defense + Shield 8.0 | Point Defense + Railgun + Shield 8.0 |
| The Behemoth Run, after | **Flak + Gravity Well + Drone Screen** 5.2 ±1.1, 75% | Gravity Well + Railgun + Supply Run 5.9 | Shrapnel + Frigate Escort + Supply Run 6.3 | Railgun + Drone Screen + Full Steam 6.3 | Gravity Well + Railgun + Drone Screen 6.4 |

Ships lost a run over all 13 waves (± one standard error, 16 seeds), and the share won.

### Overlap and the first pick

| Measure | Before (v32) | After (v33) |
| --- | --- | --- |
| Jaccard of the top-5 kits, the Island against the Behemoth Run | 0.11 (one shared kit: Point Defense + Supply Run + Shield, the Island's #1 and the Behemoth's #2) | **0** (no kit shared) |
| The same, one map against itself (two halves of its seeds) | 0.25 / 0.43 | 0.25 / 0.43 |
| Shield in the top-5 kits, the Island / the Behemoth Run | **5 / 5** | 2 / **0** |
| Best weapon alone, the Island / the Behemoth Run | Point Defense 7.0 / Frigate Escort 7.8 | **Shield 6.3 / Shield 7.3** |
| Air Strike alone: rank, the Island / the Behemoth Run | #5 (8.6) / #3 (10.3) | **#2 (7.1) / #2 (7.8)** |
| Rank correlation of the weapons alone between the two maps | 0.63 | 0.68 |

What shows (`mix.ts`, 2 seeds a map; `mixwaves.ts`, 4 seeds, for the signature's share):

| Map | Waves 1–10, before | Waves 1–10, after | Boss rounds, before | Boss rounds, after |
| --- | --- | --- | --- | --- |
| The Island | drones 57%, shells 20%, guided 5% | drones 57%, shells 20%, helicopters 4% and their missiles 3% | drones 46%, helicopter missiles 29%, helicopters 14% | drones 54%, helicopters 16%, their missiles 16% |
| The Behemoth Run | drones 52%, shells 25%, guided 7% | drones 51%, shells 23%, guided 6% (its jets and heavies now at the tanker) | torpedoes 52%, subs 33%, guided 15% | **jets 75%**, torpedoes 9%, heavies 8%, subs 5% |

The signature's share of waves 4–10: the Island 1% → 8% of what shows (5% → 22% of the hits it takes to clear them); the Behemoth Run 6% → 6% (19% → 19% by hits: the jets and heavies were already there; they now go for the tanker).

### Reading

- **The two chapter 2 maps no longer share a kit.** Their top 5s have nothing in common (Jaccard 0, was 0.11), and the Shield, in all ten top kits before, is in none of the Behemoth Run's and two of the Island's. The Behemoth's best kits now fight aircraft and heavies (Flak, Gravity Well, Drone Screen, Railgun); the Island's mix area fire and helpers (Shrapnel, Air Strike, Point Defense, the Gunship Pair).
- **Air Strike is not #1 alone on either map, but it climbed to #2 on both.** The best weapon alone is the Shield on both maps now (6.3 and 7.3; it was 4th and 2nd). A forced single levels to MAX (18 s and Reflect, which bounces blocked missiles back), and the helicopters' missile pairs and the heavies are missiles: alone, it still covers most of what both maps send. In a kit it no longer leads.
- **So the first pick is the same on both maps again** (the Shield), while the kits differ. If one weapon should not be the first pick everywhere in chapter 2, the Shield is the one to look at, not the maps: it blocks everything but a jet. A question for the player (hub).
- **By count, the signature is under the 20–30% asked** (8% and 6% of what shows in waves 4–10): helicopters, heavies and jets are few big threats, and more of them would need more of each wave taken out than the ±15% budget allows. By the hits it takes to clear them they are about a fifth to a quarter of waves 4–10. A question for the player (hub): which measure did you mean?

### How far to trust it

- As above: the "you" bot, forced loadouts, 16 seeds for the top 10 (standard errors 0.4–1.1, so neighbours in a top 5 tie), and only kits whose pairs made the map's top 6.
- The singles are 12 seeds (standard errors about 0.5–1): the Shield's lead over Air Strike alone is 0.5–0.8 of a ship, inside two standard errors.
- The Behemoth Run's boss reads very differently by Armory (docs/design/v3-ch2-behemoth.md): this sweep is your usual Armory, which mends hulls; with your latest Armory the jets do far more.

```
npm run v3:combo-sweep -- --stage=singles --maps=island,behemoth --out=tools/v3/combo-sweep/results/v33-ch2
npm run v3:combo-sweep -- --stage=pairs --maps=island,behemoth --out=tools/v3/combo-sweep/results/v33-ch2
npx vite-node tools/v3/combo-sweep/diversity.ts -- --dirs=tools/v3/combo-sweep/results/v33-ch2 --maps=island,behemoth --json=tools/v3/combo-sweep/results/v33-ch2/diversity.json
npx vite-node tools/v3/combo-sweep/mix.ts -- --seeds=2 --maps=island,behemoth
npx vite-node tools/v3/combo-sweep/mixwaves.ts -- --seeds=4
```

## The Needle of Bosk: chapter 2's third map (game version 34)

> 2026-11-20. The Needle of Bosk rebuilt to the map rules (docs/design/v3-ch2-needle.md), with a signature threat of its own: small walls of armored drones from wave 4, the Shield Wall boss's own enemy. The player's rule for it: its best kits must differ from the Island's and the Behemoth Run's. All three chapter 2 maps swept again at version 34 (the Armory overhaul changed the player's Armory's Quick Reload and Stockpile since the v33 sweep above), the same way: singles on 12 seeds, every pair on 6, each map's 6 best pairs with every third weapon on 6, its 10 best kits on 16. Results: `tools/v3/combo-sweep/results/v34-ch2`.

| Map | #1 | #2 | #3 | #4 | #5 |
| --- | --- | --- | --- | --- | --- |
| The Island | **Point Defense + Supply Run + Shield** 6.2 ±0.8, won 81% | Scattergun + Point Defense + Shield 6.9 | Boomerang + Point Defense + Gunship Pair 7.3 | Air Strike + Scattergun + Supply Run 7.4 | Seeker Pod + Gravity Well + Tesla Arc 7.9 |
| The Behemoth Run | **Air Strike + Flak Cannon + Gravity Well** 4.2 ±0.9, won 81% | Air Strike + Boomerang + Gravity Well 4.6 | Air Strike + Flak Cannon + Supply Run 4.8 | Air Strike + Frigate Escort + Supply Run 5.1 | Air Strike + Frigate Escort + Thermobaric Shell 5.6 |
| The Needle of Bosk | **Thermobaric Shell + Boomerang + Gravity Well** 5.9 ±0.7, won 88% | Shrapnel Shell + Flak Cannon + Point Defense 6.7 | Scattergun + Flak Cannon + Supply Run 6.8 | Air Strike + Scattergun + Supply Run 6.8 | Shrapnel Shell + Point Defense + Tesla Arc 6.9 |

| Measure | Result |
| --- | --- |
| Jaccard of the top-5 kits: Needle–Island / Needle–Behemoth / Island–Behemoth | **0.11** / **0** / 0 (mean 0.04) |
| The same, one map against itself (two halves of its seeds) | 0.43 / 0.67 / 0.43 (mean 0.51) |
| #1 kit | a different one on each map |
| Best weapon alone | Railgun (the Island), Frigate Escort (the Behemoth Run), Shield (the Needle) |
| Rank correlation of the weapons alone: Needle–Island / Needle–Behemoth / Island–Behemoth | 0.59 / 0.67 / 0.49 |

The signature's share of waves 4–10 (`mixwaves.ts`, 4 seeds; an armored drone's plate now counted with its hull, up to 4 hits from the front): 11% of what shows, 16% of the hits counting hulls only, 36% counting every plate hit; the plate takes only shots from the front, so about a quarter in play. The boss rounds: armored drones 59% of what shows.

### Reading

- **The Needle's kits are its own.** Its #1 kit and its best weapon alone are its own; it shares no top-5 kit with the Behemoth Run and one with the Island (#4 on both: Air Strike + Scattergun + Supply Run, a generalist kit). The Island and the Behemoth Run still share none at version 34.
- **Its kits lean on area fire:** the Thermobaric Shell, Shrapnel Shell and Flak Cannon are in four of its top 5. Blasts go round an armored wall's plates and burst over the queue at the mouth.
- **The Shield is the best weapon alone on the Needle and in none of its top kits,** as on the Island in round 9: a forced single levels it to MAX (Reflect). In a kit it doesn't lead.
- **The weapons alone rank more alike between the Needle and the other two** (0.59, 0.67) than between those two (0.49): the Needle's encounters send most of its waves' shells and clusters as drones (to keep the bot's losses in the asked range without cutting the wave budget), so its waves 1–10 look more like the chapter's shared waves; its signature walls and its boss are what set it apart.
- **Noisy:** the Needle's singles changed a lot between two builds of its encounters (Point Defense best alone at 5.3 on the earlier build, 8.5 on the final), and neighbours in a top 5 tie.

```
npm run v3:combo-sweep -- --stage=singles --maps=island,behemoth,needle --out=tools/v3/combo-sweep/results/v34-ch2
npm run v3:combo-sweep -- --stage=pairs --maps=island,behemoth,needle --out=tools/v3/combo-sweep/results/v34-ch2
npx vite-node tools/v3/combo-sweep/diversity.ts -- --dirs=tools/v3/combo-sweep/results/v34-ch2 --maps=island,behemoth,needle --json=tools/v3/combo-sweep/results/v34-ch2/diversity.json
npx vite-node tools/v3/combo-sweep/mixwaves.ts -- --seeds=4
```

## The Archipelago: chapter 2's fourth map (game version 37, with the playtest fixes)

> 2026-11-20. The Archipelago rebuilt to the map rules (docs/design/v3-ch2-archipelago.md), with a signature threat of its own: drone motherships, each with a scavenger, from wave 4. The player's rule: its best kits and best weapon alone must differ from the other three chapter 2 maps'. The playtest fixes (log v36: the Shield breaks after hits, the helicopter, the torpedo sub, the Scavenger) change every map, so all four were swept again at version 37, the same way: singles on 12 seeds, every pair on 6, each map's 6 best pairs with every third weapon on 6, its 10 best kits on 16. Results: `tools/v3/combo-sweep/results/v37-ch2`.

| Map | #1 | #2 | #3 | #4 | #5 |
| --- | --- | --- | --- | --- | --- |
| The Island | **Air Strike + Thermobaric Shell + Point Defense** 6.6 | Air Strike + Point Defense + Gunship Pair 7.8 | Flak Cannon + Drone Screen + Gunship Pair 8.4 | Air Strike + Point Defense + Drone Screen 8.4 | Railgun + Tesla Arc + Overdrive 8.6 |
| The Behemoth Run | **Air Strike + Drone Screen + Supply Run** 4.0 | Air Strike + Drone Screen + Full Steam 4.7 | Frigate Escort + Gravity Well + Shield 5.3 | Air Strike + Gravity Well + Drone Screen 5.6 | Thermobaric Shell + Flak Cannon + Full Steam 5.9 |
| The Needle of Bosk | **Scattergun + Railgun + Supply Run** 5.3 | Shrapnel Shell + Gravity Well + Gunship Pair 6.2 | Shrapnel Shell + Railgun + Supply Run 6.9 | Shrapnel Shell + Flak Cannon + Gunship Pair 7.3 | Gravity Well + Railgun + Supply Run 7.3 |
| The Archipelago | **Air Strike + Shrapnel Shell + Gravity Well** 3.3 | Air Strike + Frigate Escort + Gunship Pair 3.6 | Air Strike + Shrapnel Shell + Overdrive 3.8 | Air Strike + Overdrive + Full Steam 3.8 | Air Strike + Frigate Escort + Seeker Pod 3.9 |

| Measure | Result |
| --- | --- |
| Jaccard of the top-5 kits, every pair of the four maps | **0** |
| The same, one map against itself (two halves of its seeds) | 0.25 / 0.25 / 0.25 / 0.43 |
| #1 kit | a different one on each map |
| Best weapon alone | **Air Strike on the Island (tied), the Behemoth Run and the Archipelago**; the Gunship Pair on the Needle |
| Rank correlation of the weapons alone, the Archipelago against the Island / Behemoth / Needle | 0.73 / 0.71 / 0.20 |

### Reading

- **Every map's kits are its own** at version 37: no top-5 kit is shared between any two of the four maps.
- **The best weapon alone is not:** with the Shield breaking after hits, the Air Strike is the best single on three maps of four. The Archipelago's is the lowest loss (3.7 ships; Gravity Well 4.0 next): it is one lane, and every threat ends on that row. The rule fails for the Archipelago's best single; it is a weapon question across the chapter (docs/design/v3-ch2-archipelago.md, "Questions for the player").
- **Before the fixes** (version 36, the Archipelago's singles only) the Shield (2.2) and the Air Strike (2.4) led the Archipelago level, the Shield clashing with the Needle's best single at the time.

```
npm run v3:combo-sweep -- --stage=singles --maps=island,behemoth,needle,archipelago --out=tools/v3/combo-sweep/results/v37-ch2
npm run v3:combo-sweep -- --stage=pairs --maps=island,behemoth,needle,archipelago --out=tools/v3/combo-sweep/results/v37-ch2
npx vite-node tools/v3/combo-sweep/diversity.ts -- --dirs=tools/v3/combo-sweep/results/v37-ch2 --maps=island,behemoth,needle,archipelago --json=tools/v3/combo-sweep/results/v37-ch2/diversity.json
npx vite-node tools/v3/combo-sweep/mixwaves.ts -- --maps=archipelago --seeds=4
```

## The Coves: chapter 4's first map (game version 56; swept at 53)

> 2026-11-22. The Coves rebuilt to the map rules (docs/design/v3-ch4-coves.md): fast boats out of four coves two seconds from the lane, and its signature is "fire ships" (from wave 4 some of the wave's boats come out of the coves set alight: three hits, and where one is sunk or rams, its fireball burns on the water); from wave 5 most of the waves' shells, and from wave 7 their guided missiles, come as drones. The question, as for each rebuild: are its best kits and its best weapon alone its own, and is Air Strike over-dominant? Swept the same way at version 53, with chapter 4's draft (27 weapons, the Wild Card and the Cadence Gun new): singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16, the player's usual Armory. (The pairs and kits were swept on the build just before the final one, whose wave 6 sends no signature fire ship and two drones fewer.) The other maps are read from their last sweeps (`results/v37-ch2`, Saltgate `results/v42-ch2`, the Battery `results/v43-ch3`, the Sowers `results/v48-ch3`, the Rigs `results/v49-ch3`, the Black Strait `results/v50-ch3`, the Dreadnought `results/v51-ch3`). Results: `tools/v3/combo-sweep/results/v53-ch4`; the comparison: `python3 tools/v3/coves/compare.py`.

| Map | #1 | #2 | #3 | #4 | #5 |
| --- | --- | --- | --- | --- | --- |
| The Coves (v53) | **Air Strike + Flak Cannon + Gravity Well** 6.1, won 81% | Air Strike + Shrapnel Shell + Flak Cannon 6.4 | Air Strike + Flak Cannon + Orbital Strike 6.5 | Air Strike + Flak Cannon + Point Defense 6.8 | Shrapnel Shell + Thermobaric Shell + Orbital Strike 7.3 |

| Measure | Result |
| --- | --- |
| Jaccard of the top-5 kits, the Coves against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers / Rigs / Black Strait / Dreadnought | **0 / 0 / 0 / 0 / 0 / 0 / 0 / 0 / 0 / 0** |
| The same, the Coves against itself (two halves of its seeds) | 0.43 |
| #1 kit | in no other rebuilt map's top 5 |
| Best weapon alone | **Orbital Strike** 6.4 (Air Strike and Frigate Escort 6.5, Gunship Pair 7.0): the best single on no other rebuilt map |
| Rank correlation of the weapons alone, against the same ten | 0.65 / 0.81 / 0.56 / 0.72 / 0.62 / 0.71 / 0.53 / 0.74 / 0.83 / 0.58 |
| Air Strike | 2nd of 27 alone (6.5); in **four** of the five best kits, never alone the #1 |
| The bot drafting for itself; the plain gun | 7.5 lost, won 58%; 10.7, won 17% |

### Reading

- **All five of the Coves' best kits are its own**, and its best weapon alone is its own: the Orbital Strike, which (with the Frigate Escort and the Gunship Pair, the next best alone) fires on its own while the finger is on something else, and catches a boat as it leaves its cove.
- **But Air Strike + Flak Cannon is the core of four of the five best kits.** The flak cloud sits where the boats and the far silo's drones cross the lane, and the Air Strike clears a cove mouth and the lane under it at once. Air Strike is not the best weapon alone (2nd, tied with the Frigate), but it is the most common partner here, more than on any rebuilt map since the Archipelago. A question for the player on the map card; nothing changed for it.
- **Its weapons alone rank most like the Black Strait's and the Behemoth's** (0.83, 0.81), least like the Sowers' (0.53).

```
npm run v3:combo-sweep -- --stage=singles --maps=coves --out=tools/v3/combo-sweep/results/v53-ch4 --procs=2
npm run v3:combo-sweep -- --stage=pairs --maps=coves --out=tools/v3/combo-sweep/results/v53-ch4 --procs=2
npx vite-node tools/v3/combo-sweep/diversity.ts -- --dirs=tools/v3/combo-sweep/results/v53-ch4 --maps=coves --top=6 --seeds=6 --confirm=10 --confirm-seeds=16 --json=tools/v3/combo-sweep/results/v53-ch4/diversity.json
python3 tools/v3/coves/compare.py
npx vite-node tools/v3/combo-sweep/mixwaves.ts -- --maps=coves --seeds=8
```

## The Black Strait (the Lantern): chapter 3's fourth map (game version 52; swept at 50)

> 2026-11-21. The Black Strait rebuilt to the map rules (docs/design/v3-ch3-lantern.md): night, and the fire comes out of the enemy's dark bank behind the ships, the one shore the lighthouse beam never sweeps; its signature is "guns in the dark" (from wave 4 the wave's new enemies are Siege Batteries rising beside that bank, one salvo each), and its convoy sails at flow 2. Swept the same way at version 50, with chapter 3's draft (25 weapons): singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16, the player's usual Armory. The other maps are read from their last sweeps (`results/v37-ch2`, Saltgate `results/v42-ch2`, the Battery `results/v43-ch3`, Sowers `results/v48-ch3`, the Rig Field `results/v49-ch3`, Dreadnought Pass `results/v51-ch3`). Results: `tools/v3/combo-sweep/results/v50-ch3`; the comparison: `python3 tools/v3/lantern/compare.py`. (Boss rounds 1 and 3 were made a shell lighter after the sweep; the waves are the swept ones.)

| Map | #1 | #2 | #3 | #4 | #5 |
| --- | --- | --- | --- | --- | --- |
| The Black Strait (v50) | **Air Strike + Frigate Escort + Supply Run** 2.9 ±0.6, won 100% | Air Strike + Gunship Pair + Supply Run 3.1 | Air Strike + Drone Screen + Shield 3.5 | Air Strike + Railgun + Supply Run 3.6 | Air Strike + Scattergun + Flak Cannon 3.6 |

| Measure | Result |
| --- | --- |
| Jaccard of the top-5 kits, the Black Strait against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers / Rig Field / Dreadnought | 0 / 0 / 0 / 0 / **0.11** / **0.11** / 0 / 0 / 0 (its #1 is the Battery's #1; its #2 is in Saltgate's top 5) |
| The same, against itself (two halves of its seeds) | 0.67 |
| #1 kit | **not its own**: the Battery's #1 |
| Best weapon alone | **Scattergun** 3.8 (Air Strike 4.5, Gunship Pair 4.6, Shield 4.7, Orbital Strike 5.0): the best single on no other rebuilt map |
| Rank correlation of the weapons alone, against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers / Rig Field / Dreadnought | 0.50 / 0.76 / 0.38 / 0.59 / 0.32 / 0.62 / 0.59 / 0.75 / 0.67 |
| Air Strike | second alone (4.5); in **all five** of the best kits |
| The bot drafting for itself; the plain gun | 9.9 lost, won 33%; 18.1, won 0% |

### Reading

- **Its best weapon alone is its own: the Scattergun** (3.8), the best single on no other rebuilt map: the fire from the dark bank arrives close to the ships on short flights, where a short-range burst catches it.
- **Its best kits are not all its own**: three of the five are, but its #1 (Air Strike + Frigate Escort + Supply Run) is the Battery's #1 and its #2 is in Saltgate's top 5 (Jaccard 0.11 against each). The five are within about a standard error of each other (2.9–3.6, ±0.5–0.6), so the order is noise; the self-split agreement (0.67) is the highest of the chapter, so the set itself is fairly stable.
- **Air Strike leans hard here**: second alone and in all five best kits, the most of any rebuilt map (chapter 2 and the other chapter 3 maps: two to four of five). The rule says Air Strike should not be over-dominant; by the kits it is on this map. A question for the player (docs/design/v3-ch3-lantern.md).

```
npm run v3:combo-sweep -- --stage=singles --maps=lantern --out=tools/v3/combo-sweep/results/v50-ch3
npm run v3:combo-sweep -- --stage=pairs --maps=lantern --out=tools/v3/combo-sweep/results/v50-ch3
npx vite-node tools/v3/combo-sweep/diversity.ts -- --dirs=tools/v3/combo-sweep/results/v50-ch3 --maps=lantern --json=tools/v3/combo-sweep/results/v50-ch3/diversity.json
python3 tools/v3/lantern/compare.py
npx vite-node tools/v3/combo-sweep/mixwaves.ts -- --maps=lantern --seeds=8
```

## Dreadnought Pass: chapter 3's finale (game version 51)

> 2026-11-22. Dreadnought Pass rebuilt to the map rules (docs/design/v3-ch3-dreadnought.md): its signature is "laying the guns" (from wave 4 the wave's new enemies are Spotter Planes, whose calls are the battleship's guns), its battleship's passes each have their own numbers, and its boss is the Dreadnought itself. Swept the same way at version 51, with chapter 3's draft (25 weapons): singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16, the player's usual Armory. The chapter 2 maps, the Battery and Sowers' Reach are read from their last sweeps (`results/v37-ch2`, Saltgate `results/v42-ch2`, the Battery `results/v43-ch3`, Sowers `results/v48-ch3`); the Rig Field and the Black Strait, rebuilt at the same time, are not in it. Results: `tools/v3/combo-sweep/results/v51-ch3`; the comparison: `python3 tools/v3/dreadnought/compare.py`.

| Map | #1 | #2 | #3 | #4 | #5 |
| --- | --- | --- | --- | --- | --- |
| Dreadnought Pass (v51) | **Point Defense + Gunship Pair + Dual Wield** 4.9 | Scattergun + Point Defense + Gunship Pair 4.9 | Frigate Escort + Point Defense + Supply Run 5.6 | Point Defense + Gunship Pair + Shield 5.8 | Frigate Escort + Thermobaric Shell + Shield 5.9 |

| Measure | Result |
| --- | --- |
| Jaccard of the top-5 kits, the Dreadnought against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers | **0 / 0 / 0 / 0 / 0 / 0 / 0** |
| The same, the Dreadnought against itself (two halves of its seeds) | 0.43 |
| #1 kit | in no other rebuilt map's top 5 |
| Best weapon alone | **Point Defense** 4.3 (Shield 5.0, Drone Screen 5.3, Air Strike 5.4, Tesla Arc 5.4) |
| Rank correlation of the weapons alone, against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers | 0.45 / 0.63 / 0.43 / 0.36 / 0.42 / 0.65 / 0.72 |
| The bot drafting for itself; the plain gun | 6.9 lost, won 58%; 12.2, won 8% |

### Reading

- **All five of its best kits are its own** (Jaccard 0 against all seven), and four of them hold Point Defense, whose interceptors take what the battleship fires with a short flight.
- **Its best weapon alone is its own: Point Defense** (4.3), the best single on no other rebuilt map.
- **Air Strike is in none of its five best kits** (4th alone), the first rebuilt map where that is so.
- **Its weapons alone rank most like its chapter's other maps** (Sowers 0.72, the Battery 0.65).

```
npm run v3:combo-sweep -- --stage=singles --maps=dreadnought --out=tools/v3/combo-sweep/results/v51-ch3
npm run v3:combo-sweep -- --stage=pairs --maps=dreadnought --out=tools/v3/combo-sweep/results/v51-ch3
npx vite-node tools/v3/combo-sweep/diversity.ts -- --dirs=tools/v3/combo-sweep/results/v51-ch3 --maps=dreadnought --json=tools/v3/combo-sweep/results/v51-ch3/diversity.json
python3 tools/v3/dreadnought/compare.py
npx vite-node tools/v3/combo-sweep/mixwaves.ts -- --maps=dreadnought --seeds=8
## The Rig Field: chapter 3's third map (game version 49)

> 2026-11-22. The Rig Field rebuilt to the map rules (docs/design/v3-ch3-rigs.md): four rigs in the sea fire at the ships from point-blank, one brought down stays down (its fire moves to the far shore), and its signature is "relief rigs" (from wave 4 the wave's new enemies come as relief rigs towed in to stand where one fell); from wave 3 the waves' shells, and from wave 7 their guided missiles, come off the rigs or as drones. The question, as for each rebuild: are its best kits and its best weapon alone its own, and is Air Strike over-dominant? Swept the same way at version 49, with chapter 3's draft (25 weapons): singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16, the player's usual Armory. The other maps are read from their last sweeps (`results/v37-ch2`, Saltgate `results/v42-ch2`, the Battery `results/v43-ch3`, the Sowers `results/v48-ch3`). Results: `tools/v3/combo-sweep/results/v49-ch3`; the comparison: `python3 tools/v3/rigs/compare.py`.

| Map | #1 | #2 | #3 | #4 | #5 |
| --- | --- | --- | --- | --- | --- |
| The Rig Field (v49) | **Gravity Well + Drone Screen + Gunship Pair** 5.1 ±0.5, won 88% | Shrapnel Shell + Flak Cannon + Shield 5.4 | Shrapnel Shell + Thermobaric Shell + Supply Run 5.5 | Air Strike + Boomerang + Orbital Strike 5.7 | Air Strike + Orbital Strike + Overdrive 5.9 |

| Measure | Result |
| --- | --- |
| Jaccard of the top-5 kits, the Rigs against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers | **0 / 0 / 0 / 0 / 0 / 0 / 0** |
| The same, the Rigs against itself (two halves of its seeds) | 0.67 |
| #1 kit | in no chapter 2 or chapter 3 map's top 5 |
| Best weapon alone | **Shrapnel Shell** 4.8 (Gravity Well 5.1, Flak 5.5, Thermobaric 5.8, Air Strike 5.9: fifth) |
| Rank correlation of the weapons alone, the Rigs against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers | 0.43 / 0.51 / 0.49 / 0.77 / 0.44 / 0.60 / 0.58 |
| The bot drafting for itself; the plain gun | 9.8 lost, won 58%; 15.0, won 0% |

### Reading

- **All five of the Rigs' best kits are its own** (Jaccard 0 against all seven rebuilt maps), within about a standard error of each other (5.1–5.9, ±0.5–0.6).
- **Its best weapon alone is its own: the Shrapnel Shell** (4.8), the best single on no other rebuilt map: its burst takes a volley off the rigs as it converges.
- **Air Strike is not over-dominant**: fifth alone (5.9), in two of the five best kits, never the #1.
- **The weapons alone rank most like the Archipelago's** (0.77, another map of launchers close over the lanes) and least like the Island's and Saltgate's (0.43–0.44).
- The singles moved between builds while tuning (Railgun 5.5 on one build, 6.9 on the final one; 12 seeds), so the order of the top few weapons alone is noise; that the top 5 kits are the Rigs' own held on every build swept.

```
npm run v3:combo-sweep -- --stage=singles --maps=rigs --out=tools/v3/combo-sweep/results/v49-ch3
npm run v3:combo-sweep -- --stage=pairs --maps=rigs --out=tools/v3/combo-sweep/results/v49-ch3
npx vite-node tools/v3/combo-sweep/diversity.ts -- --dirs=tools/v3/combo-sweep/results/v49-ch3 --maps=rigs --json=tools/v3/combo-sweep/results/v49-ch3/diversity.json
python3 tools/v3/rigs/compare.py
npx vite-node tools/v3/combo-sweep/mixwaves.ts -- --maps=rigs --seeds=8
```

## Sowers' Reach: chapter 3's second map (game version 48)

> 2026-11-21. Sowers' Reach rebuilt to the map rules (docs/design/v3-ch3-sowers.md): its signature is "sown" (from wave 4 the wave's new enemies are Stealth Bombers, the Carpet Run's own, and every stealth bomber sows mines just ahead of the ships in place of its missiles), and nearly every shell of its shared waves is gone (mines and drones in their place). The question, as for each rebuild: are its best kits and its best weapon alone its own, and is Air Strike over-dominant? Swept the same way at version 48, with chapter 3's draft (25 weapons): singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16, the player's usual Armory. The chapter 2 maps and the Battery are read from their last sweeps (`results/v37-ch2`, Saltgate `results/v42-ch2`, the Battery `results/v43-ch3`). Results: `tools/v3/combo-sweep/results/v48-ch3`; the comparison: `python3 tools/v3/sowers/compare.py`.

| Map | #1 | #2 | #3 | #4 | #5 |
| --- | --- | --- | --- | --- | --- |
| Sowers' Reach (v48) | **Air Strike + Gravity Well + Supply Run** 5.4 ±0.6, won 94% | Frigate Escort + Supply Run + Shield 5.4 | Shrapnel Shell + Railgun + Gunship Pair 5.5 | Air Strike + Scattergun + Supply Run 5.6 | Air Strike + Gunship Pair + Shield 6.1 |

| Measure | Result |
| --- | --- |
| Jaccard of the top-5 kits, Sowers against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery | **0 / 0 / 0 / 0 / 0 / 0** |
| The same, Sowers against itself (two halves of its seeds) | 0.43 |
| #1 kit | in no chapter 2 or chapter 3 map's top 5 (it is the Strait's #1 of the v31 sweep, chapter 1) |
| Best weapon alone | **Tesla Arc** 4.7 (Flak 5.8, Shield 5.8, Boomerang 5.9, Gravity Well 5.9; Air Strike 7.2: 14th) |
| Rank correlation of the weapons alone, Sowers against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery | 0.27 / 0.38 / 0.41 / 0.45 / 0.30 / 0.67 |
| The bot drafting for itself; the plain gun | 9.0 lost, won 42%; 11.9, won 17% |

### Reading

- **All five of Sowers' best kits are its own** among chapters 2 and 3 (Jaccard 0 against all six), within about a standard error of each other (5.4–6.1, ±0.6), so their order is noise. Its #1 is the same three weapons as the Strait's #1 in the chapter 1 sweep (v31): an older build and another chapter's draft.
- **Its best weapon alone is its own: the Tesla Arc** (4.7), the best single on no other rebuilt map and the Battery's off-counter: its chain jumps along a string of mines and the swarm beside it.
- **Air Strike is not over-dominant alone** (14th), but it is in three of the five best kits (with Supply Run twice and Shield once), as on most maps.
- **The weapons alone rank least like chapter 2's of any rebuilt map** (0.27–0.45), and most like the Battery's (0.67).

```
npm run v3:combo-sweep -- --stage=singles --maps=sowers --out=tools/v3/combo-sweep/results/v48-ch3
npm run v3:combo-sweep -- --stage=pairs --maps=sowers --out=tools/v3/combo-sweep/results/v48-ch3
npx vite-node tools/v3/combo-sweep/diversity.ts -- --dirs=tools/v3/combo-sweep/results/v48-ch3 --maps=sowers --json=tools/v3/combo-sweep/results/v48-ch3/diversity.json
python3 tools/v3/sowers/compare.py
npx vite-node tools/v3/combo-sweep/mixwaves.ts -- --maps=sowers --seeds=8
```

## Battery Point: chapter 3's first map (game version 43)

> 2026-11-21. Battery Point rebuilt to the map rules (docs/design/v3-ch3-battery.md): its signature is "silence the battery" (the wave's heavy cruise missiles at your two shore guns, the wave's strike jets as Stealth Strafers) from wave 4, and most of its shells go for the guns. The question, as for each chapter 2 map: are its best kits and its best weapon alone its own, and is Air Strike over-dominant? Swept the same way at version 43, with chapter 3's draft (25 weapons: chapter 2's and Grapnel, Bomber Wing, Orbital Strike, Dual Wield, Focus Fire): singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16, the player's usual Armory. The chapter 2 maps are read from their last sweeps (`results/v37-ch2`, Saltgate `results/v42-ch2`; the build changes nothing of theirs). Results: `tools/v3/combo-sweep/results/v43-ch3`; the comparison: `python3 tools/v3/battery/compare.py`.

| Map | #1 | #2 | #3 | #4 | #5 |
| --- | --- | --- | --- | --- | --- |
| Battery Point (v43) | **Air Strike + Frigate Escort + Supply Run** 5.1 ±0.6, won 94% | Thermobaric Shell + Flak Cannon + Gravity Well 5.4 | Air Strike + Drone Screen + Supply Run 5.8 | Railgun + Orbital Strike + Supply Run 5.9 | Air Strike + Orbital Strike + Supply Run 6.0 |

| Measure | Result |
| --- | --- |
| Jaccard of the top-5 kits, the Battery against the Island / Behemoth / Needle / Archipelago / Saltgate | 0 / **0.11** / 0 / 0 / 0 (Air Strike + Drone Screen + Supply Run: the Battery's #3, the Behemoth's #1) |
| The same, the Battery against itself (two halves of its seeds) | 0.43 |
| #1 kit | its own (in no other map's top 5) |
| Best weapon alone | **Frigate Escort** 4.8 (Gravity Well 5.6, Railgun 5.8, Drone Screen 5.8, Flak 5.9; Air Strike 6.1: eighth) |
| Rank correlation of the weapons alone (the 20 both drafts deal), the Battery against the Island / Behemoth / Needle / Archipelago / Saltgate | 0.73 / 0.76 / 0.61 / 0.57 / 0.48 |
| Chapter 3's new weapons | Orbital Strike in two of the top 5 kits; alone, Orbital Strike 6.4, Bomber Wing 7.6, Focus Fire and Grapnel 10.8, Dual Wield 13.1 |
| The bot drafting for itself; the plain gun | 6.8 lost, won 67%; 12.8, won 8% |

### Reading

- **Four of the Battery's five best kits are its own, and its #1 is its own;** its #3 is the Behemoth Run's #1 (Air Strike + Drone Screen + Supply Run). The five are within about a standard error of each other (5.1–6.0, ±0.5–0.9), so their order is noise.
- **Its best weapon alone is its own: the Frigate Escort** (4.8), the best single on no chapter 2 map (those are Air Strike ×3, the Gunship Pair, the Thermobaric Shell). Its frigates sail with the convoy through the middle, the stretch neither the carrier nor the guns cover.
- **Air Strike is not over-dominant:** eighth alone (6.1, against 3.7–6.8 on chapter 2's maps), in three of the five best kits (with Supply Run each time, the pair chapter 2 leans on too). A chapter-wide Air Strike look (the Archipelago's open question) would cover it.
- **The sweep is fragile to small changes:** two builds a wave-5 tweak apart read #1 Frigate Escort + Boomerang + Railgun (Jaccard 0 everywhere, Air Strike in 2 of 5) and Air Strike + Gunship Pair + Supply Run (Saltgate's #2; Air Strike in 4 of 5, Gunship Pair best alone). In all three reads no other map's #1 kit is in the Battery's top 5 and Air Strike is never the best single.

```
npm run v3:combo-sweep -- --stage=singles --maps=battery --out=tools/v3/combo-sweep/results/v43-ch3
npm run v3:combo-sweep -- --stage=pairs --maps=battery --out=tools/v3/combo-sweep/results/v43-ch3
npx vite-node tools/v3/combo-sweep/diversity.ts -- --dirs=tools/v3/combo-sweep/results/v43-ch3 --maps=battery --json=tools/v3/combo-sweep/results/v43-ch3/diversity.json
python3 tools/v3/battery/compare.py
npx vite-node tools/v3/combo-sweep/mixwaves.ts -- --maps=battery --seeds=4
```

## Saltgate Canal at game version 42: the trucks

> 2026-11-20. The player's answer to the v38 card made Saltgate's boss a truck assault (the Gatecrashers) and its signature "the trucks come to the locks" (Rocket Trucks for half the wave's new enemies from wave 4, the wave's clusters at the locks; no Torpedo Sub on the map; docs/design/v3-ch2-saltgate.md, "Log v42"). Swept again the same way at version 42 (on top of v41's cluster climb and sub sites): singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16. The other four maps are read from `results/v37-ch2` as at v38 (not re-swept at v41). Results: `tools/v3/combo-sweep/results/v42-ch2`; the comparison: `python3 tools/v3/saltgate/compare.py`.

| Map | #1 | #2 | #3 | #4 | #5 |
| --- | --- | --- | --- | --- | --- |
| Saltgate Canal (v42) | **Air Strike + Boomerang + Tesla Arc** 5.1 ±0.7, won 88% | Air Strike + Gunship Pair + Supply Run 5.2 | Shrapnel Shell + Thermobaric Shell + Railgun 5.4 | Air Strike + Boomerang + Railgun 5.8 | Air Strike + Scattergun + Railgun 5.9 |

| Measure | v42 | v38 |
| --- | --- | --- |
| Jaccard of the top-5 kits, Saltgate against the Island / Behemoth / Needle / Archipelago | **0 / 0 / 0 / 0** | 0.11 / 0 / 0 / 0 |
| The same, Saltgate against itself (two halves of its seeds) | 0.25 | 0.67 |
| #1 kit | its own | its own |
| Best weapon alone | **Thermobaric Shell** 4.8 (Gravity Well 5.0, Frigate Escort 5.1, Point Defense 5.7, Air Strike 5.9) | Point Defense 5.8 |
| Rank correlation of the weapons alone, Saltgate against the Island / Behemoth / Needle / Archipelago | 0.43 / 0.58 / 0.49 / 0.57 | 0.70 / 0.84 / 0.35 / 0.60 |

### Reading

- **All five of Saltgate's best kits are its own** (the v38 overlap with the Island's #1 is gone), and its best weapon alone is neither Air Strike nor the v38 Point Defense: Thermobaric Shell, an area weapon that catches a truck column on the road.
- **Air Strike is still in four of its five best kits**, and fifth alone: it stays the best single on three maps of five, not four.
- **The weapons alone rank less like the other maps' than at v38** (0.43–0.58 against 0.35–0.84).
- **The halves agree less** (0.25): Saltgate's top kits are within a standard error of each other, so their order is noise; that none is another map's is not.

```
npm run v3:combo-sweep -- --stage=singles --maps=saltgate --out=tools/v3/combo-sweep/results/v42-ch2
npm run v3:combo-sweep -- --stage=pairs --maps=saltgate --out=tools/v3/combo-sweep/results/v42-ch2
npx vite-node tools/v3/combo-sweep/diversity.ts -- --dirs=tools/v3/combo-sweep/results/v42-ch2 --maps=saltgate --json=tools/v3/combo-sweep/results/v42-ch2/diversity.json
python3 tools/v3/saltgate/compare.py
npx vite-node tools/v3/combo-sweep/mixwaves.ts -- --maps=saltgate --seeds=4
```

## Saltgate Canal: chapter 2's fifth map (game version 38) (before log v42's trucks)

> 2026-11-20. Saltgate Canal rebuilt to the map rules (docs/design/v3-ch2-saltgate.md), with a signature of its own: a strike on the locks (torpedo subs for half the wave's new enemies, and the wave's clusters at the ships held in a lock) from wave 4. The player's rule: its best kits and best weapon alone must differ from the other four chapter 2 maps', and Air Strike, the best single on three of them, should not become a fourth's. Saltgate was swept at version 38 the same way: singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16. The other four maps play the same game at 38 as at 37 (the build changes nothing of theirs), so they are read from `results/v37-ch2`. Results: `tools/v3/combo-sweep/results/v38-ch2`.

| Map | #1 | #2 | #3 | #4 | #5 |
| --- | --- | --- | --- | --- | --- |
| The Island (v37) | **Air Strike + Thermobaric Shell + Point Defense** 6.6 | Air Strike + Point Defense + Gunship Pair 7.8 | Flak Cannon + Drone Screen + Gunship Pair 8.4 | Air Strike + Point Defense + Drone Screen 8.4 | Railgun + Tesla Arc + Overdrive 8.6 |
| The Behemoth Run (v37) | **Air Strike + Drone Screen + Supply Run** 4.0 | Air Strike + Drone Screen + Full Steam 4.7 | Frigate Escort + Gravity Well + Shield 5.2 | Air Strike + Gravity Well + Drone Screen 5.6 | Thermobaric Shell + Flak Cannon + Full Steam 5.9 |
| The Needle of Bosk (v37) | **Scattergun + Railgun + Supply Run** 5.3 | Shrapnel Shell + Gravity Well + Gunship Pair 6.2 | Shrapnel Shell + Railgun + Supply Run 6.9 | Shrapnel Shell + Flak Cannon + Gunship Pair 7.3 | Gravity Well + Railgun + Supply Run 7.3 |
| The Archipelago (v37) | **Air Strike + Shrapnel Shell + Gravity Well** 3.2 | Air Strike + Frigate Escort + Gunship Pair 3.6 | Air Strike + Shrapnel Shell + Overdrive 3.8 | Air Strike + Overdrive + Full Steam 3.8 | Air Strike + Frigate Escort + Seeker Pod 3.9 |
| Saltgate Canal (v38) | **Air Strike + Gunship Pair + Full Steam** 5.6 ±0.7, won 81% | Air Strike + Thermobaric Shell + Point Defense 6.0 | Frigate Escort + Point Defense + Supply Run 6.3 | Air Strike + Flak Cannon + Point Defense 7.1 | Air Strike + Frigate Escort + Thermobaric Shell 7.3 |

| Measure | Result |
| --- | --- |
| Jaccard of the top-5 kits, Saltgate against the Island / Behemoth / Needle / Archipelago | **0.11** (Air Strike + Thermobaric Shell + Point Defense: the Island's #1, Saltgate's #2) / 0 / 0 / 0 |
| The same, Saltgate against itself (two halves of its seeds) | 0.67 |
| #1 kit | its own |
| Best weapon alone | **Point Defense** 5.8 (Scattergun 6.0, Air Strike 6.3); Air Strike on the Island, the Behemoth Run and the Archipelago, the Gunship Pair on the Needle |
| Rank correlation of the weapons alone, Saltgate against the Island / Behemoth / Needle / Archipelago | 0.70 / 0.84 / 0.35 / 0.60 |

### Reading

- **Saltgate's kits are its own but for one:** its #1 kit is no other map's; its #2 is the Island's #1. Both maps fire point-blank at ships from silos close over them, and Point Defense answers both.
- **Its best weapon alone is Point Defense, not Air Strike**, so Air Strike stays the best single on three maps of five. The top three singles are a tie on 12 seeds (5.8 / 6.0 / 6.3), and Air Strike is in four of Saltgate's five best kits.
- **An earlier build** (the swarms still aimed at the ships coming in, the boss's first round with two subs) read Point Defense best alone too (5.8, then the Railgun and Scattergun 6.5, Air Strike 6.8), and also shared one kit with the Island (Air Strike + Point Defense + Gunship Pair, the Island's #2, then Saltgate's #1).

```
npm run v3:combo-sweep -- --stage=singles --maps=saltgate --out=tools/v3/combo-sweep/results/v38-ch2
npm run v3:combo-sweep -- --stage=pairs --maps=saltgate --out=tools/v3/combo-sweep/results/v38-ch2
npx vite-node tools/v3/combo-sweep/diversity.ts -- --dirs=tools/v3/combo-sweep/results/v38-ch2 --maps=saltgate --json=tools/v3/combo-sweep/results/v38-ch2/diversity.json
npx vite-node tools/v3/combo-sweep/mixwaves.ts -- --maps=saltgate --seeds=4
```
