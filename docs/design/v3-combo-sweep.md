# V3 combo sweep: weapon loadouts and Armory builds

> Made by `npm run v3:combo-sweep` (tools/v3/combo-sweep/), game version 29 (LOG_VERSION), 2026-11-19. The tables below are written by the tool; the reading at the top is hand-written (tools/v3/combo-sweep/notes.md). Re-run the sweep after any game change.

## What the sweep says (read 2026-11-19, game version 29)

You asked: "Are we running bot tests on all possible combination of the weapon load outs?? ... we should do that same with the armory too." This is that sweep: every weapon on its own, every pair, the best pairs with every third weapon, the best and worst triples again on more seeds, and the Armory builds. The "you" bot played about 11,000 runs on the Strait, the Gauntlet, Harbor Mouth, Kesh and Marrow. It was first run on game version 28, then run again in full on version 29 (Marrow's slowing radar, Kesh's harder Drone Storm, the calm before every boss). Everything below is version 29.

**The short version**
- **No kit makes a map trivial.**
  - The triples stage flagged one: Shrapnel Shell + Scattergun + Flak Cannon on Marrow (4 seeds: won all, no ship lost in half). On 16 seeds (`tools/v3/combo-sweep/check-one.ts`) it lost 5.6 ships a run, won 81%, and lost no ship in only 2 of 16.
  - The closest Armory build is Wide Warhead + Armor Plating + Supply Lines on Marrow, "nearly" trivial: it won every run but lost 1.5 ships a run.
- **Marrow is now the easiest map and Kesh the hardest.**
  - Bot drafting for itself, over 13 waves: Marrow 6.3 lost and 83% won; Kesh 12.1 lost and 8% won (version 28: Kesh 7.0, Marrow about 8).
  - Marrow's best set (Frigate Escort + Thermobaric Shell + Point Defense) won 12 of 12, losing 3.8.
  - That is the radar slowdown and the Drone Storm working as built. It is also why your replay matters: the bot reads Marrow about twice as hard as you did and the Kesh boss harder than you play it.
- **The first weapon matters most. The second and third add little.**
  - The plain gun loses 18.6 ships a run over all 13 waves.
  - Any one good weapon roughly halves that, to 8.4–9.4.
  - The best confirmed triple loses 7.6.
  - The weapons share one gun, so a second weapon splits the gun's time and the drops instead of adding to them.
- **The Armory matters more than the loadout.**
  - With no Armory, the counter kits lose 24.5 ships a run. With your Armory (Quick Reload 5 + Damage Control 4 + Stockpile 5) they lose 12.7. With the best full build (Wide Warhead + Armor Plating + Stockpile) they lose 6.0.
- **Best loadouts (12 seeds a map):**
  1. Air Strike + Point Defense + Supply Run (7.6)
  2. Air Strike + Flak Cannon + Point Defense (7.8)
  3. Point Defense + Railgun + Supply Run (8.2)
  4. Air Strike + Flak Cannon + Gravity Well (8.2)
  5. Point Defense + Gravity Well + Supply Run (8.4)

  They win 42–62%. The bot drafting for itself loses 10.2 and wins 37%. Air Strike and Point Defense are each in 3 of the top 5.
- **Worst loadouts:**
  - Shrapnel + Scattergun + Overdrive (12.2)
  - Scattergun + Supply Run + Overdrive (11.7)
  - Shrapnel + Scattergun + Boomerang (11.4)
  - Shrapnel + Seeker + Drone Screen (11.3)
- **Synergy.** Every pair falls short of what its weapons predict, so "synergy" here means compared with the other pairs.
  - **Supply Run is the best partner by far.** The ten best-fitting pairs are all something + Supply Run (Frigate Escort, Boomerang, Point Defense and Seeker Pod gain most). It is weak alone (it fires nothing), but it feeds whatever else you hold.
  - **The worst partners** are Boomerang + Seeker Pod, Air Strike + Seeker Pod, Scattergun + Boomerang, and Air Strike + Scattergun.

**Overdrive + Scattergun + Supply Run.** The bot still does not find this kit strong: 19th of the 20 confirmed triples, 11.7 ships a run, 28% won, worst on the Strait (15.4).

That is the opposite of what you found: it won both runs you played with it, with no boss losses. Overdrive and Supply Run are both boosts, and the bot's weak spot is how it plays boosts and pickups (docs/design/v3-bot-refit.md: you load a Scattergun in the first second of a boss round, and the bot reaches the Supply Run late). So the likely reading is that **you get far more out of this kit than the bot does**, not that the kit is weak. Before anyone tunes it, replay one of your Overdrive + Scattergun + Supply Run logs next to the bot (the `playtest-fidelity` check). The sweep cannot settle it.

**The counter kits (rule `m-kits`).** The rule asks that a map's counter kit does clearly better than other kits. It still fails on Harbor Mouth and Kesh.
- Their counter kit (Overdrive + Railgun + Focus) lost 17.3 and 16.8 ships a run.
- The bot drafting for itself lost 13.0 and 12.1 there.
- Focus is a chapter 3 weapon, so the chapter 1 draft never deals it on these maps.

On Marrow the counter kit is level with the bot's own draft (6.3 each).

**The Armory, upgrade by upgrade (each alone at level 5, with the counter kit).**
- **Most valuable:** Armor Plating saves 13.3 ships a run. Then Damage Control (8.8), and Proximity Fuse and the Point Defense upgrade (7.1 each).
- **Least valuable:** Stockpile (2.3), Quick Reload (2.8) and Long Loads (3.9).
- Your usual build uses two of the three weakest. With the counter kit it loses 12.7 ships a run; Wide Warhead + Armor Plating + Stockpile loses 6.0.

### Proposals for you (nothing here is applied)
1. **Overdrive.** It ties Seeker Pod as the weakest shooting-era weapon alone (11.7 ships a run) and is in two of the four worst triples. First check whether the bot plays it as you do (above). If the bot is right, give Overdrive a stronger level 1 or a longer run.
2. **Seeker Pod and Tesla Arc** are the weakest shooting weapons on their own: about 11–12 ships a run alone, against 8.4–9.4 for the best. A small buff to either would widen the good choices.
3. **Harbor Mouth and Kesh need a new counter kit** (rule `m-kits`): one the chapter 1 draft can deal (no Focus) and that beats the bot's own draft. Candidates from the sweep:
   - Harbor Mouth: Point Defense + Railgun + Supply Run, the best there.
   - Kesh: Air Strike + Flak Cannon + Point Defense, the best there on version 29 (7.3 lost, won 58%, where the bot's own draft wins 8%).
4. **The Supply bay is weak and Armor Plating is strong.**
   - Stockpile and Long Loads are two of the three cheapest saves in the Armory, so a Supply card often feels like a wasted win.
   - Either lift them (for example Stockpile's size), or bring Armor Plating down a little: on its own it is worth more than most whole weapons.
5. **Point Defense, Air Strike and Gravity Well** are in most of the best triples, but none of them runs away with it: the best and worst single weapons are only about 3 ships a run apart. Nothing here needs a nerf.
6. **The Laser Cutter could not be tested.** It is a swipe, and the bot only taps, so with it loaded the bot is worse than with the plain gun. The bot needs a swipe before the sweep can judge the Cutter.
7. **Marrow and Kesh after version 29.** Marrow now plays easy for the bot (83% won drafting for itself, above the chapter's 50–75% aim) and Kesh hard (8%). Wait for your replay before touching either: the bot read your Marrow twice as hard as you played it, and boss rounds harder too.

### How far to trust it
- The bot is not you. It fits your play well on ordinary waves but is weaker with boosts and fast pickups. That matters most for Overdrive, Supply Run and the boss rounds.
- A forced loadout is the best case: every draft deals the next card of the kit. A real draft is luckier for some kits than others.
- Seeds are few in the middle stages: 6 a map for pairs and 4 for triples. A pair or triple a ship or so apart is a tie. The confirm stage, at 12 seeds, is the one to quote.
- The fun measure here is tension only (rises and calms each second). It barely tells the loadouts apart. "Saves", the measure that forks a run, cannot be read on a forced-draft run: its log does not replay.
- Re-run with `npm run v3:combo-sweep -- --stage=all` after any game change. The version 29 re-run took 29 minutes on a quieter machine.

### What was cut to fit the time
The first run (version 28) shared the machine with other sessions, which made it about twice as slow, so the sweep was cut. It took about 65 minutes in all; the version 29 re-run used the same cuts:

| Stage | Time | Planned seeds a map | Ran |
|---|---|---|---|
| Singles | 15 min | 12 | 12 |
| Pairs | 17 min | 8 | 6 |
| Triples | 18 min | 15 best pairs, 6 seeds | 10 best pairs, 4 seeds |
| Confirm | 7 min | 24 | 12 |
| Armory | 8 min | 6 | 4 |

The table further down shows the triples at 15 minutes: the stage was restarted from its cache partway through, and the table counts only the second part.

Also left out:
- The Laser Cutter, from the pairs and triples (the bot can't swipe).
- The Armory pairs that share a bay: a run can't equip two upgrades from one bay.
- The Armory pairs and full builds with the bot drafting for itself: these were played with the counter kit only.
- The off-counter kits.
- The "saves" fun measure (see above).

## How the runs were played

- **Maps:** The Strait, The Gauntlet, Harbor Mouth, The Kesh Hook, Lee of Marrow: the three reference maps and chapter 1's two new ones, each on its Test Lab card's production setup (as the bot reports play them).
- **Player:** the "you" bot (fitted to your own play, docs/design/v3-bot-refit.md), with your usual Armory (Quick Reload 5, Damage Control 4, Stockpile 5), except in the Armory section.
- **Weapons:** all 16 weapons the chapter 1 draft deals: Air Strike, Shrapnel Shell, Frigate Escort, Thermobaric Shell, Scattergun, Boomerang, Flak Cannon, Seeker Pod, Point Defense, Gravity Well, Railgun, Tesla Arc, Laser Cutter, Drone Screen, Supply Run, Overdrive. All five maps are chapter 1, so every loadout here is one you can really draft on them; the chapter 2-4 weapons are left out. **The Laser Cutter is not measured:** it is a swipe and the bot only taps, so with it loaded the bot does next to nothing (alone it loses more than twice the plain gun's ships). It is in the singles table to show that, and left out of the pairs and triples.
- **A loadout is forced:** every draft offers only the next card of the loadout: each weapon at level 1 in turn (the slots fill early, as you fill them), then level 2, then level 3 (MAX); after that, Resupply at every draft. So it is the best case for that loadout: a draft that always deals what you want. "Bot drafts for itself" is the bot choosing from the real draft.
- **Every wave is played:** each run goes on past the loss limit to the end of boss round 3, so every loadout is measured on every wave. "Won" is what the normal loss limit (6 ships in waves 1–10, 6 more in the boss rounds) would have made of the same run; it is the same game up to that point.
- **Synergy** compares a set with what its weapons do alone. Each weapon alone cuts the plain gun's losses by some share; if the weapons did not help or hinder each other, a pair would cut by both shares (plain × A's share × B's share). Synergy is the predicted ships lost minus the ships really lost, a run over all 13 waves: **positive = better together**, negative = they get in each other's way. Below about ±1 ship it is within the noise. Because the weapons share one gun, nearly every set falls short of that prediction, so the tables also give **relative synergy**: a set's synergy against the mean of all sets of its size.
- **Trivial** (rule `m-kits`: no kit should win a map without losing a ship): at least half the runs won without losing a ship, or under 1 ship lost a run in all 13 waves. **Nearly trivial**: won 90%+ with under 2 ships lost a run.

Columns: **Won** (under the normal loss limit); **Won, no ship lost**; **Ships lost** in waves 1–10, a boss round (the mean of the three), and over all 13 waves (the main ranking: fewer is better).

## Overdrive + Scattergun + Supply Run (the kit you called "really op")

12 seeds a map. Rank 19 of the 20 triples in the confirm stage by ships lost.

| Map | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves | Synergy (ships a run) | Trivial? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| The Strait | 17% | 0% | 6.2 | 3.08 | **15.4** | -9.4 | no |
| The Gauntlet | 33% | 0% | 6.3 | 0.97 | **9.2** | -3.4 | no |
| Harbor Mouth | 8% | 0% | 9.3 | 1.86 | **14.8** | -10.1 | no |
| The Kesh Hook | 8% | 0% | 5.3 | 2.28 | **12.1** | -6.7 | no |
| Lee of Marrow | 75% | 0% | 4.1 | 0.94 | **6.9** | -5.3 | no |
| **All five** | 28% | 0% | 6.2 | 1.83 | **11.7** | -7.0 |  |
| _Plain gun, all five_ | 5% | 0% | 9.2 | 3.13 | **18.6** |  |  |
| _Bot drafts for itself_ | 37% | 2% | 5.3 | 1.63 | **10.2** |  |  |

## Kits that make a map trivial

Every weapon set that met the bar on a map, from the stage with the most seeds that played it (fewer seeds: more noise; a pair or triple with 6–8 seeds a map is a lead to check, not a verdict).

| Map | Loadout | Stage | Runs | Verdict | Won | Won, no ship lost | Ships lost, all 13 waves |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lee of Marrow | Shrapnel Shell + Scattergun + Flak Cannon | triples | 4 | **trivial** | 100% | 50% | 3.3 |

## Best and worst loadouts (confirmed on 12 seeds a map)

The 15 best and 5 worst triples of the triples stage, played again on more seeds, with each map's counter kit (the plan's), the plain gun and the bot drafting for itself for scale. Tension: the danger on the board each second (docs/design/v3-fun-metrics.md), over the waves the run reached: mean peak, share of time "hot", share of waves with a sawtooth shape (rises and releases, the shape we want).

| # | Loadout | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves | Synergy | Tension peak | Hot | Sawtooth waves |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Air Strike + Point Defense + Supply Run | 55% | 0% | 3.4 | 1.39 | **7.6** | -4.4 | 0.96 | 5% | 17% |
| 2 | Air Strike + Flak Cannon + Point Defense | 62% | 0% | 4.4 | 1.14 | **7.8** | -5.8 | 0.96 | 4% | 18% |
| 3 | Point Defense + Railgun + Supply Run | 58% | 0% | 3.9 | 1.43 | **8.2** | -4.2 | 0.97 | 6% | 20% |
| 4 | Air Strike + Flak Cannon + Gravity Well | 42% | 0% | 4.5 | 1.23 | **8.2** | -6.2 | 0.98 | 5% | 20% |
| 5 | Point Defense + Gravity Well + Supply Run | 52% | 0% | 4.0 | 1.47 | **8.4** | -5.0 | 0.99 | 6% | 19% |
| 6 | Air Strike + Frigate Escort + Supply Run | 55% | 0% | 4.1 | 1.46 | **8.5** | -5.1 | 0.97 | 5% | 15% |
| 7 | Air Strike + Thermobaric Shell + Railgun | 48% | 0% | 4.4 | 1.44 | **8.7** | -6.2 | 0.98 | 5% | 19% |
| 8 | Air Strike + Thermobaric Shell + Flak Cannon | 47% | 0% | 4.2 | 1.55 | **8.9** | -6.7 | 0.99 | 5% | 19% |
| 9 | Flak Cannon + Point Defense + Supply Run | 43% | 2% | 4.2 | 1.61 | **9.0** | -5.5 | 0.95 | 5% | 18% |
| 10 | Air Strike + Scattergun + Gravity Well | 37% | 2% | 4.8 | 1.52 | **9.4** | -7.2 | 1.03 | 6% | 20% |
| 11 | Air Strike + Gravity Well + Railgun | 40% | 2% | 4.5 | 1.64 | **9.4** | -7.0 | 1.02 | 6% | 21% |
| 12 | Air Strike + Thermobaric Shell + Gravity Well | 40% | 0% | 4.9 | 1.51 | **9.4** | -7.3 | 0.99 | 5% | 19% |
| 13 | Frigate Escort + Thermobaric Shell + Point Defense | 40% | 0% | 4.5 | 1.64 | **9.4** | -7.1 | 0.97 | 5% | 20% |
| 14 | Frigate Escort + Point Defense + Supply Run | 38% | 2% | 4.6 | 1.73 | **9.8** | -6.2 | 0.97 | 5% | 18% |
| 15 | Air Strike + Thermobaric Shell + Drone Screen | 33% | 0% | 4.7 | 1.74 | **9.9** | -7.6 | 0.99 | 6% | 22% |
| 16 | Seeker Pod + Point Defense + Supply Run | 37% | 0% | 4.8 | 1.96 | **10.7** | -6.4 | 1.00 | 6% | 22% |
| 17 | Shrapnel Shell + Seeker Pod + Drone Screen | 27% | 0% | 5.9 | 1.82 | **11.3** | -8.0 | 1.03 | 6% | 22% |
| 18 | Shrapnel Shell + Scattergun + Boomerang | 30% | 0% | 5.9 | 1.82 | **11.4** | -8.3 | 1.00 | 5% | 22% |
| 19 | Scattergun + Supply Run + Overdrive | 28% | 0% | 6.2 | 1.83 | **11.7** | -7.0 | 0.99 | 5% | 21% |
| 20 | Shrapnel Shell + Scattergun + Overdrive | 22% | 0% | 6.6 | 1.87 | **12.2** | -8.9 | 1.00 | 5% | 20% |
|  | _The map's counter kit_ | 33% | 0% | 6.2 | 1.91 | **11.9** |  | 1.00 | 5% | 22% |
|  | _Plain gun_ | 5% | 0% | 9.2 | 3.13 | **18.6** |  | 1.05 | 5% | 28% |
|  | _Bot drafts for itself_ | 37% | 2% | 5.3 | 1.63 | **10.2** |  | 0.98 | 5% | 20% |

### By map

**The Strait** (counter kit: Shrapnel Shell, Flak Cannon, Drone Screen)

|  | Loadout | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves |
| --- | --- | --- | --- | --- | --- | --- |
| best 1 | Air Strike + Point Defense + Supply Run | 50% | 0% | 2.0 | 1.94 | **7.8** |
| best 2 | Air Strike + Flak Cannon + Gravity Well | 33% | 0% | 4.2 | 1.33 | **8.2** |
| best 3 | Air Strike + Frigate Escort + Supply Run | 50% | 0% | 3.3 | 1.64 | **8.3** |
| best 4 | Air Strike + Flak Cannon + Point Defense | 58% | 0% | 4.0 | 1.58 | **8.8** |
| best 5 | Point Defense + Gravity Well + Supply Run | 42% | 0% | 3.7 | 1.92 | **9.4** |
| worst 3 | Shrapnel Shell + Scattergun + Boomerang | 8% | 0% | 6.3 | 2.42 | **13.6** |
| worst 2 | Shrapnel Shell + Scattergun + Overdrive | 8% | 0% | 6.2 | 2.58 | **13.9** |
| worst 1 | Scattergun + Supply Run + Overdrive | 17% | 0% | 6.2 | 3.08 | **15.4** |
|  | _The map's counter kit_ | 42% | 0% | 5.3 | 1.92 | **11.0** |
|  | _Plain gun_ | 0% | 0% | 8.3 | 4.58 | **22.1** |
|  | _Bot drafts for itself_ | 33% | 0% | 5.4 | 2.03 | **11.5** |

**The Gauntlet** (counter kit: Shrapnel Shell, Thermobaric Shell, Flak Cannon)

|  | Loadout | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves |
| --- | --- | --- | --- | --- | --- | --- |
| best 1 | Air Strike + Flak Cannon + Point Defense | 75% | 0% | 5.0 | 0.69 | **7.1** |
| best 2 | Air Strike + Point Defense + Supply Run | 50% | 0% | 5.1 | 0.67 | **7.1** |
| best 3 | Air Strike + Thermobaric Shell + Railgun | 67% | 0% | 4.8 | 0.81 | **7.2** |
| best 4 | Air Strike + Flak Cannon + Gravity Well | 50% | 0% | 5.3 | 0.69 | **7.4** |
| best 5 | Frigate Escort + Point Defense + Supply Run | 50% | 0% | 5.1 | 0.78 | **7.4** |
| worst 3 | Shrapnel Shell + Scattergun + Boomerang | 42% | 0% | 6.9 | 0.94 | **9.8** |
| worst 2 | Shrapnel Shell + Scattergun + Overdrive | 17% | 0% | 7.5 | 1.11 | **10.8** |
| worst 1 | Shrapnel Shell + Seeker Pod + Drone Screen | 17% | 0% | 7.4 | 1.19 | **11.0** |
|  | _The map's counter kit_ | 42% | 0% | 5.8 | 0.75 | **8.0** |
|  | _Plain gun_ | 0% | 0% | 11.2 | 0.86 | **13.8** |
|  | _Bot drafts for itself_ | 33% | 0% | 6.3 | 0.69 | **8.3** |

**Harbor Mouth** (counter kit: Railgun, Focus, Overdrive)

|  | Loadout | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves |
| --- | --- | --- | --- | --- | --- | --- |
| best 1 | Point Defense + Railgun + Supply Run | 58% | 0% | 4.7 | 1.53 | **9.3** |
| best 2 | Air Strike + Thermobaric Shell + Railgun | 25% | 0% | 5.6 | 1.53 | **10.2** |
| best 3 | Point Defense + Gravity Well + Supply Run | 42% | 0% | 5.8 | 1.61 | **10.7** |
| best 4 | Air Strike + Thermobaric Shell + Flak Cannon | 42% | 0% | 6.3 | 1.50 | **10.8** |
| best 5 | Air Strike + Frigate Escort + Supply Run | 42% | 0% | 5.8 | 1.69 | **10.9** |
| worst 3 | Scattergun + Supply Run + Overdrive | 8% | 0% | 9.3 | 1.86 | **14.8** |
| worst 2 | Shrapnel Shell + Seeker Pod + Drone Screen | 8% | 0% | 8.9 | 2.03 | **15.0** |
| worst 1 | Shrapnel Shell + Scattergun + Overdrive | 17% | 0% | 10.3 | 1.72 | **15.4** |
|  | _The map's counter kit_ | 0% | 0% | 10.6 | 2.25 | **17.3** |
|  | _Plain gun_ | 0% | 0% | 12.9 | 3.56 | **23.6** |
|  | _Bot drafts for itself_ | 25% | 0% | 7.4 | 1.86 | **13.0** |

**The Kesh Hook** (counter kit: Railgun, Focus, Overdrive)

|  | Loadout | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves |
| --- | --- | --- | --- | --- | --- | --- |
| best 1 | Air Strike + Flak Cannon + Point Defense | 58% | 0% | 3.3 | 1.33 | **7.3** |
| best 2 | Air Strike + Point Defense + Supply Run | 42% | 0% | 2.5 | 1.69 | **7.6** |
| best 3 | Point Defense + Gravity Well + Supply Run | 50% | 0% | 2.8 | 1.81 | **8.3** |
| best 4 | Air Strike + Flak Cannon + Gravity Well | 42% | 0% | 3.4 | 1.78 | **8.8** |
| best 5 | Point Defense + Railgun + Supply Run | 50% | 0% | 3.1 | 1.97 | **9.0** |
| worst 3 | Air Strike + Thermobaric Shell + Drone Screen | 17% | 0% | 3.7 | 2.92 | **12.4** |
| worst 2 | Frigate Escort + Thermobaric Shell + Point Defense | 8% | 0% | 4.3 | 2.75 | **12.6** |
| worst 1 | Shrapnel Shell + Scattergun + Overdrive | 8% | 0% | 4.4 | 3.00 | **13.4** |
|  | _The map's counter kit_ | 0% | 0% | 6.1 | 3.56 | **16.8** |
|  | _Plain gun_ | 0% | 0% | 6.8 | 5.08 | **22.0** |
|  | _Bot drafts for itself_ | 8% | 0% | 4.1 | 2.67 | **12.1** |

**Lee of Marrow** (counter kit: Seeker Pod, Point Defense, Drone Screen)

|  | Loadout | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves |
| --- | --- | --- | --- | --- | --- | --- |
| best 1 | Frigate Escort + Thermobaric Shell + Point Defense | 100% | 0% | 1.9 | 0.61 | **3.8** |
| best 2 | Air Strike + Point Defense + Supply Run | 100% | 0% | 1.7 | 0.81 | **4.1** |
| best 3 | Point Defense + Railgun + Supply Run | 100% | 0% | 1.8 | 0.78 | **4.1** |
| best 4 | Air Strike + Gravity Well + Railgun | 83% | 8% | 2.1 | 0.81 | **4.5** |
| best 5 | Air Strike + Thermobaric Shell + Railgun | 83% | 0% | 2.8 | 0.61 | **4.6** |
| worst 3 | Shrapnel Shell + Scattergun + Boomerang | 75% | 0% | 4.1 | 1.03 | **7.2** |
| worst 2 | Flak Cannon + Point Defense + Supply Run | 67% | 0% | 3.6 | 1.19 | **7.2** |
| worst 1 | Shrapnel Shell + Scattergun + Overdrive | 58% | 0% | 4.6 | 0.92 | **7.3** |
|  | _The map's counter kit_ | 83% | 0% | 3.1 | 1.06 | **6.3** |
|  | _Plain gun_ | 25% | 0% | 6.9 | 1.56 | **11.6** |
|  | _Bot drafts for itself_ | 83% | 8% | 3.6 | 0.89 | **6.3** |

## Each weapon on its own (12 seeds a map)

**Alone**: the weapon levelled to MAX by wave 4, then Resupply at every draft (nothing else held). **First pick**: the weapon levelled to MAX first, then the bot drafts for itself (a realistic run that starts with it). Sorted by ships lost alone.

| Weapon | Alone: won | Alone: lost 1–10 | Alone: boss round | Alone: all 13 | First pick: won | First pick: all 13 | Alone: The Strait | Alone: The Gauntlet | Alone: Harbor Mouth | Alone: The Kesh Hook | Alone: Lee of Marrow |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Air Strike | 48% | 3.8 | 1.54 | **8.4** | 37% | 10.1 | 8.2 | 6.9 | 10.3 | 12.5 | 4.3 |
| Point Defense | 48% | 4.2 | 1.59 | **9.0** | 52% | 8.5 | 10.4 | 6.4 | 12.5 | 10.2 | 5.4 |
| Gravity Well | 45% | 4.5 | 1.55 | **9.2** | 55% | 8.9 | 11.3 | 7.8 | 12.5 | 9.3 | 4.9 |
| Flak Cannon | 42% | 4.4 | 1.60 | **9.2** | 47% | 8.7 | 10.2 | 8.8 | 11.8 | 8.7 | 6.8 |
| Thermobaric Shell | 48% | 4.8 | 1.53 | **9.4** | 53% | 9.3 | 10.7 | 7.8 | 11.7 | 12.0 | 4.9 |
| Scattergun | 42% | 4.6 | 1.61 | **9.4** | 38% | 9.5 | 10.5 | 8.8 | 11.7 | 11.8 | 4.3 |
| Frigate Escort | 45% | 4.3 | 1.78 | **9.7** | 48% | 9.0 | 13.2 | 7.5 | 10.8 | 11.5 | 5.6 |
| Drone Screen | 37% | 4.4 | 1.81 | **9.8** | 43% | 9.8 | 11.2 | 9.4 | 11.9 | 11.3 | 5.4 |
| Shrapnel Shell | 38% | 5.2 | 1.62 | **10.0** | 37% | 10.2 | 12.2 | 7.6 | 13.1 | 11.2 | 6.1 |
| Railgun | 33% | 5.0 | 1.87 | **10.7** | 42% | 9.7 | 10.9 | 8.8 | 12.8 | 14.1 | 6.6 |
| Boomerang | 28% | 5.7 | 1.82 | **11.1** | 43% | 9.5 | 14.0 | 8.8 | 13.8 | 12.8 | 6.3 |
| Tesla Arc | 28% | 6.5 | 1.62 | **11.3** | 30% | 10.3 | 10.3 | 10.3 | 15.2 | 13.4 | 7.3 |
| Seeker Pod | 28% | 5.5 | 2.07 | **11.7** | 33% | 10.5 | 14.3 | 10.8 | 13.2 | 14.4 | 5.8 |
| Overdrive | 30% | 5.7 | 2.01 | **11.7** | 30% | 10.2 | 15.3 | 10.5 | 12.8 | 13.6 | 6.4 |
| Supply Run | 18% | 7.3 | 2.37 | **14.3** | 42% | 10.2 | 18.2 | 11.8 | 17.8 | 16.1 | 7.9 |
| Laser Cutter | 0% | 25.3 | 4.54 | **38.9** | 0% | 23.6 | 39.3 | 29.6 | 51.2 | 42.3 | 31.9 |
| _Plain gun_ | 5% | 9.2 | 3.13 | **18.6** |  |  | 22.1 | 13.8 | 23.6 | 22.0 | 11.6 |
| _Bot drafts for itself_ | 37% | 5.3 | 1.63 | **10.2** |  |  | 11.5 | 8.3 | 13.0 | 12.1 | 6.3 |

## Pairs (105 pairs, 6 seeds a map)

Two weapons, nothing else. Best 10 and worst 5 by ships lost.

| # | Pair | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves | Synergy |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Air Strike + Gravity Well | 63% | 0% | 3.3 | 1.28 | **7.1** | -3.3 |
| 2 | Air Strike + Thermobaric Shell | 53% | 3% | 3.8 | 1.22 | **7.5** | -3.5 |
| 3 | Thermobaric Shell + Point Defense | 63% | 0% | 4.5 | 1.01 | **7.6** | -3.0 |
| 4 | Point Defense + Supply Run | 60% | 3% | 2.9 | 1.62 | **7.8** | -0.5 |
| 5 | Shrapnel Shell + Scattergun | 53% | 0% | 4.6 | 1.08 | **7.8** | -3.5 |
| 6 | Shrapnel Shell + Tesla Arc | 50% | 0% | 3.9 | 1.34 | **8.0** | -2.4 |
| 7 | Air Strike + Frigate Escort | 57% | 0% | 4.0 | 1.38 | **8.1** | -3.9 |
| 8 | Thermobaric Shell + Scattergun | 53% | 0% | 4.6 | 1.18 | **8.2** | -3.8 |
| 9 | Shrapnel Shell + Drone Screen | 50% | 0% | 4.8 | 1.13 | **8.2** | -3.3 |
| 10 | Flak Cannon + Point Defense | 47% | 0% | 4.0 | 1.38 | **8.2** | -3.4 |
| 101 | Boomerang + Overdrive | 30% | 0% | 5.8 | 1.73 | **11.0** | -4.6 |
| 102 | Seeker Pod + Tesla Arc | 30% | 0% | 6.1 | 1.71 | **11.2** | -4.6 |
| 103 | Boomerang + Tesla Arc | 23% | 0% | 5.7 | 1.87 | **11.3** | -5.4 |
| 104 | Supply Run + Overdrive | 27% | 0% | 6.2 | 2.00 | **12.2** | -2.8 |
| 105 | Boomerang + Seeker Pod | 17% | 0% | 5.8 | 2.16 | **12.3** | -5.8 |

### Synergy: pairs

**Every pair falls short of the prediction** (mean synergy -3.9 ships a run). That is expected in this game: the weapons share one gun (a pickup replaces the loaded weapon), so two weapons split the gun's time and the drops instead of adding up, and a run has some losses no weapon prevents. So read synergy against the other pairs: **relative synergy** = a pair's synergy less the mean of all pairs. Positive: these two fit together better than most; negative: worse than most. "Second weapon adds" is the plainest test: ships a run the pair saves over the better of its two weapons alone (negative: the pair does worse than its best weapon alone).

All 13 waves, the mean over the five maps (per map: relative synergy).

|  | Pair | Lost | Best alone | Second weapon adds | Predicted (independent) | Relative synergy | The Strait | The Gauntlet | Harbor Mouth | The Kesh Hook | Lee of Marrow |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best partners | Frigate Escort + Supply Run | 8.3 | 9.9 | +1.6 | 8.1 | **+3.7** | +7.4 | +3.1 | +2.7 | +1.1 | +4.2 |
| best partners | Boomerang + Supply Run | 8.8 | 10.3 | +1.5 | 8.4 | **+3.5** | +5.6 | +1.9 | +2.4 | +3.6 | +4.2 |
| best partners | Point Defense + Supply Run | 7.8 | 9.0 | +1.2 | 7.2 | **+3.4** | +2.4 | +4.0 | +3.7 | +3.8 | +3.1 |
| best partners | Seeker Pod + Supply Run | 9.9 | 11.5 | +1.6 | 9.4 | **+3.4** | +8.6 | +3.2 | +0.7 | +2.2 | +2.2 |
| best partners | Drone Screen + Supply Run | 8.5 | 9.5 | +1.0 | 7.8 | **+3.2** | +5.0 | +4.4 | -0.3 | +2.1 | +4.6 |
| best partners | Tesla Arc + Supply Run | 9.5 | 10.8 | +1.3 | 8.7 | **+3.1** | +2.1 | +3.9 | -0.0 | +6.0 | +3.5 |
| best partners | Railgun + Supply Run | 9.6 | 10.8 | +1.3 | 8.7 | **+3.1** | +3.7 | +1.6 | +1.8 | +4.1 | +4.2 |
| best partners | Shrapnel Shell + Supply Run | 8.8 | 9.4 | +0.6 | 7.6 | **+2.8** | +5.6 | +0.9 | +2.3 | +1.6 | +3.3 |
| best partners | Flak Cannon + Supply Run | 9.2 | 9.7 | +0.5 | 7.9 | **+2.7** | +2.1 | +2.4 | +2.6 | +1.7 | +4.4 |
| best partners | Thermobaric Shell + Supply Run | 8.8 | 9.3 | +0.4 | 7.5 | **+2.5** | +3.0 | +3.0 | +0.6 | +3.4 | +2.7 |
| worst partners | Boomerang + Seeker Pod | 12.3 | 10.3 | -1.9 | 6.5 | **-1.9** | +0.3 | -0.6 | -4.6 | -4.8 | +0.4 |
| worst partners | Air Strike + Seeker Pod | 10.7 | 7.9 | -2.8 | 4.9 | **-1.9** | -0.8 | -1.8 | -5.6 | -3.9 | +2.9 |
| worst partners | Scattergun + Boomerang | 10.4 | 8.6 | -1.8 | 4.8 | **-1.7** | -1.2 | +0.4 | -1.8 | -4.2 | -1.5 |
| worst partners | Air Strike + Scattergun | 9.2 | 7.9 | -1.3 | 3.8 | **-1.6** | -2.5 | +0.3 | -3.0 | -2.9 | +0.3 |
| worst partners | Frigate Escort + Boomerang | 11.0 | 9.9 | -1.1 | 5.6 | **-1.5** | +1.8 | -3.2 | -1.6 | -3.8 | -0.7 |
| worst partners | Boomerang + Tesla Arc | 11.3 | 10.3 | -1.0 | 6.0 | **-1.5** | -2.4 | -1.0 | -0.8 | -2.6 | -0.4 |
| worst partners | Seeker Pod + Gravity Well | 10.7 | 8.7 | -1.9 | 5.4 | **-1.3** | -2.8 | +1.6 | -2.8 | -2.9 | +0.4 |
| worst partners | Boomerang + Gravity Well | 10.1 | 8.7 | -1.4 | 4.9 | **-1.3** | +0.1 | -1.7 | -2.1 | -2.6 | -0.4 |
| worst partners | Thermobaric Shell + Railgun | 10.7 | 9.3 | -1.5 | 5.5 | **-1.3** | -3.8 | -2.5 | -3.0 | +1.7 | +1.0 |
| worst partners | Air Strike + Boomerang | 9.6 | 7.9 | -1.7 | 4.4 | **-1.3** | -4.0 | -1.9 | -3.0 | +0.9 | +1.6 |

Mean relative synergy of each weapon over all its pairs (a good partner, or one that does its job alone):

| Weapon | Mean relative synergy in a pair |
| --- | --- |
| Supply Run | +2.66 |
| Tesla Arc | +0.17 |
| Flak Cannon | +0.13 |
| Thermobaric Shell | +0.09 |
| Shrapnel Shell | +0.03 |
| Overdrive | +0.01 |
| Point Defense | -0.08 |
| Railgun | -0.15 |
| Frigate Escort | -0.18 |
| Gravity Well | -0.29 |
| Drone Screen | -0.36 |
| Air Strike | -0.41 |
| Scattergun | -0.48 |
| Seeker Pod | -0.48 |
| Boomerang | -0.64 |

## Triples (118 triples, 4 seeds a map)

pairs extended: Air Strike + Gravity Well; Air Strike + Thermobaric Shell; Thermobaric Shell + Point Defense; Point Defense + Supply Run; Shrapnel Shell + Scattergun; Shrapnel Shell + Tesla Arc; Air Strike + Frigate Escort; Thermobaric Shell + Scattergun; Shrapnel Shell + Drone Screen; Flak Cannon + Point Defense

| # | Triple | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves | Synergy (vs singles) | Third weapon's own synergy (vs pairs) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Air Strike + Point Defense + Supply Run | 65% | 0% | 3.5 | 1.02 | **6.5** | -3.7 | +3.0 |
| 2 | Air Strike + Flak Cannon + Point Defense | 65% | 0% | 4.1 | 1.07 | **7.3** | -5.4 | +9.4 |
| 3 | Air Strike + Flak Cannon + Gravity Well | 40% | 0% | 4.7 | 0.92 | **7.5** | -5.8 | +9.6 |
| 4 | Air Strike + Frigate Escort + Supply Run | 55% | 0% | 3.8 | 1.25 | **7.5** | -4.5 | +1.1 |
| 5 | Point Defense + Gravity Well + Supply Run | 75% | 0% | 3.9 | 1.25 | **7.6** | -4.8 | +4.4 |
| 6 | Air Strike + Gravity Well + Railgun | 55% | 5% | 3.6 | 1.33 | **7.7** | -5.8 | +12.3 |
| 7 | Point Defense + Railgun + Supply Run | 65% | 0% | 4.0 | 1.27 | **7.8** | -3.7 | +1.1 |
| 8 | Air Strike + Scattergun + Gravity Well | 45% | 0% | 4.0 | 1.25 | **7.8** | -6.2 | +13.7 |
| 9 | Air Strike + Thermobaric Shell + Railgun | 65% | 0% | 4.0 | 1.27 | **7.8** | -5.9 | +13.2 |
| 10 | Air Strike + Thermobaric Shell + Flak Cannon | 60% | 0% | 3.6 | 1.42 | **7.9** | -6.1 | +7.7 |
| 11 | Air Strike + Thermobaric Shell + Drone Screen | 50% | 0% | 4.5 | 1.18 | **8.0** | -6.2 | +10.6 |
| 12 | Flak Cannon + Point Defense + Supply Run | 45% | 0% | 4.0 | 1.33 | **8.1** | -4.2 | +0.0 |
| 13 | Air Strike + Thermobaric Shell + Gravity Well | 45% | 0% | 4.3 | 1.25 | **8.1** | -6.7 | +7.9 |
| 14 | Frigate Escort + Thermobaric Shell + Point Defense | 45% | 0% | 4.2 | 1.32 | **8.1** | -6.2 | +9.7 |
| 15 | Frigate Escort + Point Defense + Supply Run | 50% | 5% | 4.0 | 1.40 | **8.2** | -4.8 | +1.8 |
| … |  |  |  |  |  |  |  |  |
| 114 | Shrapnel Shell + Seeker Pod + Drone Screen | 15% | 0% | 5.9 | 1.97 | **11.8** | -9.1 | +7.1 |
| 115 | Seeker Pod + Point Defense + Supply Run | 35% | 0% | 5.3 | 2.25 | **12.1** | -8.2 | -2.0 |
| 116 | Shrapnel Shell + Scattergun + Boomerang | 25% | 0% | 6.3 | 1.90 | **12.1** | -9.8 | +4.9 |
| 117 | Scattergun + Supply Run + Overdrive | 25% | 0% | 7.1 | 1.88 | **12.8** | -8.4 | +2.4 |
| 118 | Shrapnel Shell + Scattergun + Overdrive | 15% | 0% | 7.8 | 1.77 | **13.1** | -10.5 | +3.7 |

### Synergy: triples

Against the singles: what the three weapons alone predict. Against the pairs: what the three pairs inside it predict, so what is left is what the three do only all together.

Means over the triples: -7.2 against the singles, +7.1 against the pairs. As with the pairs, read each against the mean (relative).

|  | Triple | Lost | Synergy vs singles | Relative | Synergy vs pairs | Relative |
| --- | --- | --- | --- | --- | --- | --- |
| all three together | Air Strike + Frigate Escort + Seeker Pod | 10.1 | -7.8 | -0.6 | +16.5 | **+9.5** |
| all three together | Air Strike + Seeker Pod + Gravity Well | 10.1 | -8.1 | -0.9 | +16.1 | **+9.1** |
| all three together | Air Strike + Frigate Escort + Scattergun | 8.5 | -6.7 | +0.5 | +14.0 | **+6.9** |
| all three together | Air Strike + Scattergun + Gravity Well | 7.8 | -6.2 | +1.0 | +13.7 | **+6.7** |
| all three together | Air Strike + Thermobaric Shell + Railgun | 7.8 | -5.9 | +1.3 | +13.2 | **+6.1** |
| all three together | Air Strike + Frigate Escort + Boomerang | 8.9 | -7.0 | +0.2 | +12.7 | **+5.6** |
| crowded | Seeker Pod + Point Defense + Supply Run | 12.1 | -8.2 | -1.1 | -2.0 | **-9.1** |
| crowded | Shrapnel Shell + Drone Screen + Supply Run | 10.6 | -6.7 | +0.5 | -1.4 | **-8.5** |
| crowded | Shrapnel Shell + Scattergun + Supply Run | 9.8 | -6.3 | +0.9 | -1.2 | **-8.3** |
| crowded | Shrapnel Shell + Tesla Arc + Supply Run | 10.3 | -6.1 | +1.0 | -1.0 | **-8.0** |
| crowded | Thermobaric Shell + Point Defense + Supply Run | 8.6 | -5.5 | +1.6 | -0.4 | **-7.4** |
| crowded | Flak Cannon + Point Defense + Supply Run | 8.1 | -4.2 | +2.9 | +0.0 | **-7.0** |

## The Armory (4 seeds a map)

A run equips one upgrade from each bay (Gun, Hull, Supply), so only builds with at most one upgrade a bay are played: each upgrade alone at level 5, every pair from two bays at level 5 and every full build (one a bay) at level 5 (these two with the counter kit only), and three budgets (your usual three at level 1, at level 3, and as you have them: Quick Reload 5, Damage Control 4, Stockpile 5). Each with the map's counter kit forced (the plan's, docs/design/v3-map-plans) and with the bot drafting for itself.
- Harbor Mouth's counter kit has Focus, which its chapter's draft does not deal; forced in anyway (the kit as the plan names it).
- The Kesh Hook's counter kit has Focus, which its chapter's draft does not deal; forced in anyway (the kit as the plan names it).

### With the map's counter kit

Each upgrade alone at level 5: ships saved a run (all 13 waves) against no Armory, per map. Higher is better.

| Upgrade | Bay | Won | Lost, all 13 | Saved, all five | The Strait | The Gauntlet | Harbor Mouth | The Kesh Hook | Lee of Marrow |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Armor Plating | hull | 40% | 11.3 | **+13.3** | +11.0 | +10.3 | +19.8 | +15.8 | +9.5 |
| Damage Control | hull | 20% | 15.7 | **+8.8** | +3.5 | +6.8 | +13.0 | +10.3 | +10.8 |
| Proximity Fuse | gun | 10% | 17.4 | **+7.1** | +2.5 | +11.0 | +12.0 | +3.0 | +7.3 |
| Point Defense | hull | 5% | 17.4 | **+7.1** | +1.3 | +3.3 | +11.0 | +14.3 | +5.8 |
| Fast Motors | gun | 15% | 19.2 | **+5.3** | +5.5 | +2.3 | +5.8 | +4.8 | +8.3 |
| Deep Magazine | gun | 0% | 19.3 | **+5.2** | +5.5 | +6.3 | +6.0 | +3.5 | +4.8 |
| Wide Warhead | gun | 15% | 19.4 | **+5.1** | +3.5 | +2.8 | -0.8 | +6.5 | +13.3 |
| Supply Lines | supply | 0% | 19.6 | **+4.9** | +5.8 | 0.0 | +13.8 | +3.3 | +1.5 |
| Long Loads | supply | 5% | 20.6 | **+3.9** | +2.0 | -0.5 | +6.8 | +3.8 | +7.8 |
| Quick Reload | gun | 5% | 21.7 | **+2.8** | +3.3 | +0.8 | +2.5 | -1.3 | +8.8 |
| Stockpile | supply | 5% | 22.3 | **+2.3** | +10.5 | +1.0 | -3.5 | -1.5 | +4.8 |
| _No Armory_ |  | 0% | 24.5 |  |  |  |  |  |  |

Full builds (one upgrade a bay, all at level 5): best 8 and worst 3, and the budgets.

|  | Build | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves |
| --- | --- | --- | --- | --- | --- | --- |
| best 1 | Wide Warhead 5 + Armor Plating 5 + Stockpile 5 | 80% | 0% | 3.6 | 0.80 | **6.0** |
| best 2 | Wide Warhead 5 + Armor Plating 5 + Supply Lines 5 | 70% | 0% | 3.9 | 1.02 | **7.0** |
| best 3 | Proximity Fuse 5 + Armor Plating 5 + Stockpile 5 | 60% | 0% | 3.3 | 1.27 | **7.1** |
| best 4 | Wide Warhead 5 + Armor Plating 5 + Long Loads 5 | 50% | 5% | 3.1 | 1.33 | **7.1** |
| best 5 | Quick Reload 5 + Armor Plating 5 + Supply Lines 5 | 65% | 0% | 3.6 | 1.37 | **7.8** |
| best 6 | Proximity Fuse 5 + Damage Control 5 + Supply Lines 5 | 60% | 0% | 3.7 | 1.35 | **7.8** |
| best 7 | Quick Reload 5 + Armor Plating 5 + Stockpile 5 | 65% | 0% | 4.1 | 1.23 | **7.8** |
| best 8 | Proximity Fuse 5 + Armor Plating 5 + Long Loads 5 | 50% | 5% | 3.3 | 1.52 | **7.8** |
| worst 3 | Deep Magazine 5 + Point Defense 5 + Long Loads 5 | 20% | 0% | 4.5 | 2.45 | **11.8** |
| worst 2 | Deep Magazine 5 + Point Defense 5 + Stockpile 5 | 20% | 0% | 7.3 | 1.62 | **12.1** |
| worst 1 | Quick Reload 5 + Point Defense 5 + Stockpile 5 | 20% | 0% | 6.5 | 2.37 | **13.6** |
|  | _No Armory_ | 0% | 0% | 11.8 | 4.22 | **24.5** |
|  | _Quick Reload 1 + Damage Control 1 + Stockpile 1_ | 20% | 0% | 8.7 | 2.90 | **17.4** |
|  | _Quick Reload 3 + Damage Control 3 + Stockpile 3_ | 20% | 0% | 7.4 | 1.88 | **13.1** |
|  | _Quick Reload 5 + Damage Control 4 + Stockpile 5_ | 30% | 0% | 5.8 | 2.32 | **12.7** |

Pairs from two bays at level 5: best 5 of 39: Wide Warhead 5 + Armor Plating 5 (7.3 lost, won 65%); Fast Motors 5 + Armor Plating 5 (8.1 lost, won 45%); Proximity Fuse 5 + Armor Plating 5 (8.4 lost, won 50%); Deep Magazine 5 + Armor Plating 5 (8.9 lost, won 50%); Armor Plating 5 + Stockpile 5 (9.2 lost, won 45%).

Builds that make a map trivial or nearly (counter kit):

| Map | Build | Verdict | Won | Won, no ship lost | Lost, all 13 |
| --- | --- | --- | --- | --- | --- |
| Lee of Marrow | Wide Warhead 5 + Armor Plating 5 + Supply Lines 5 | nearly | 100% | 0% | 1.5 |

### With the bot drafting for itself

Each upgrade alone at level 5: ships saved a run (all 13 waves) against no Armory, per map. Higher is better.

| Upgrade | Bay | Won | Lost, all 13 | Saved, all five | The Strait | The Gauntlet | Harbor Mouth | The Kesh Hook | Lee of Marrow |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Armor Plating | hull | 40% | 11.6 | **+14.6** | +12.5 | +13.8 | +18.0 | +15.5 | +13.5 |
| Damage Control | hull | 30% | 12.9 | **+13.3** | +9.8 | +16.0 | +15.5 | +13.3 | +11.8 |
| Proximity Fuse | gun | 15% | 17.5 | **+8.7** | +4.8 | +10.5 | +8.8 | +8.8 | +10.8 |
| Point Defense | hull | 15% | 17.9 | **+8.3** | 0.0 | +13.0 | +11.0 | +11.8 | +5.5 |
| Wide Warhead | gun | 15% | 19.1 | **+7.1** | +7.5 | +4.0 | +7.0 | +4.5 | +12.5 |
| Fast Motors | gun | 5% | 20.3 | **+5.9** | +3.3 | +8.3 | +7.5 | +3.5 | +7.3 |
| Deep Magazine | gun | 0% | 20.4 | **+5.8** | +1.0 | +7.5 | +6.5 | +7.8 | +6.0 |
| Quick Reload | gun | 0% | 22.4 | **+3.8** | +2.8 | +7.0 | +0.3 | +6.8 | +2.0 |
| Long Loads | supply | 5% | 23.4 | **+2.8** | -3.8 | +4.0 | +7.8 | +2.3 | +4.0 |
| Stockpile | supply | 0% | 23.8 | **+2.4** | +0.3 | +5.3 | +3.8 | +1.5 | +1.5 |
| Supply Lines | supply | 0% | 25.4 | **+0.8** | +2.5 | +2.3 | -3.0 | +1.0 | +1.5 |
| _No Armory_ |  | 0% | 26.2 |  |  |  |  |  |  |

The budgets.

|  | Build | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves |
| --- | --- | --- | --- | --- | --- | --- |
|  | _No Armory_ | 0% | 0% | 13.4 | 4.25 | **26.2** |
|  | _Quick Reload 1 + Damage Control 1 + Stockpile 1_ | 10% | 0% | 8.9 | 3.20 | **18.6** |
|  | _Quick Reload 3 + Damage Control 3 + Stockpile 3_ | 20% | 0% | 7.1 | 2.53 | **14.7** |
|  | _Quick Reload 5 + Damage Control 4 + Stockpile 5_ | 20% | 0% | 6.9 | 2.02 | **12.9** |

Builds that make a map trivial or nearly (own draft):

None.

## Running it again

```
npm run v3:combo-sweep -- --stage=all                 # every stage, then this doc
npm run v3:combo-sweep -- --stage=pairs --seeds=4     # one stage, fewer seeds
npm run v3:combo-sweep -- --stage=report              # this doc from the saved results
```

Stages: `singles`, `pairs`, `triples` (needs pairs), `confirm` (needs triples), `armory`, `report`, `all`. Options: `--seeds=N`, `--maps=a,b`, `--top=N` (pairs carried into triples), `--procs=N`. Each run is cached in `tools/v3/combo-sweep/results/cache/v<LOG_VERSION>.jsonl` (not committed), so a stopped stage resumes and a game change (a new LOG_VERSION) starts afresh.

| Stage | Seeds a map | Runs | Minutes (4 cores) |
| --- | --- | --- | --- |
| singles | 12 | 2040 | 5.2 |
| pairs | 6 | 3150 | 7.7 |
| triples | 4 | 2360 | 6.2 |
| confirm | 12 | 1380 | 4.0 |
| armory | 4 | 2280 | 6.0 |

