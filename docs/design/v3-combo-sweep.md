# V3 combo sweep: weapon loadouts and Armory builds

> Made by `npm run v3:combo-sweep` (tools/v3/combo-sweep/), game version 28 (LOG_VERSION), 2026-11-19. The tables below are written by the tool; the reading at the top is hand-written (tools/v3/combo-sweep/notes.md). The chapter 1 changes coming in LOG_VERSION 29 (Marrow's radar, Kesh's boss, a calm before the boss) will move these numbers: re-run the sweep once they land.

## What the sweep says (read 2026-11-19, game version 28)

You asked: "Are we running bot tests on all possible combination of the weapon load outs?? ... we should do that same with the armory too." This is that sweep: every weapon on its own, every pair, the best pairs with every third weapon, the best and worst triples again on more seeds, and the Armory builds. The "you" bot played about 11,000 runs on the Strait, the Gauntlet, Harbor Mouth, Kesh and Marrow.

**The short version**
- **No kit makes a map trivial.** No weapon set, and no Armory build with it, won a map without losing a ship in most runs. The closest was Kesh with Wide Warhead + Point Defense + Long Loads and the counter kit. On 4 seeds it looked trivial. On 16 seeds it lost 3.1 ships a run, won 94% and was flawless only 1 time in 8.
- **The first weapon matters most. The second and third add little.**
  - The plain gun loses about 17 ships a run over all 13 waves.
  - Any one good weapon roughly halves that, to 8–9.
  - The best pair loses about 6.5 (on 6 seeds a map). The best triple loses 7.6 (confirmed on 12 seeds).
  - The weapons share one gun, so a second weapon splits the gun's time and the drops instead of adding to them.
- **The Armory matters more than the loadout.**
  - With no Armory, the counter kits lose 24 ships a run. With your Armory they lose 10. With the best full build (Wide Warhead + Armor Plating + Long Loads) they lose 5.
  - The best weapon set saves about 10 ships over the plain gun. The best Armory build saves about 19 over no Armory.
- **Best loadouts (12 seeds a map):**
  1. Air Strike + Point Defense + Supply Run
  2. Air Strike + Gravity Well + Supply Run
  3. Flak Cannon + Point Defense + Supply Run
  4. Air Strike + Gravity Well + Drone Screen
  5. Scattergun + Point Defense + Railgun

  Each loses about 7.6–8.1 ships a run and wins 48–63%. The bot drafting for itself loses 9.1 and wins 45%. Supply Run is in 9 of the top 15 triples, Air Strike in 8 and Point Defense in 6.
- **Worst loadouts:**
  - Flak + Tesla + Overdrive
  - Flak + Seeker + Overdrive
  - Scattergun + Supply Run + Overdrive
  - Boomerang + Flak + Overdrive
  - Boomerang + Flak + Point Defense

  Each loses 9.7–11.3 ships. **Overdrive is in four of the five worst.**
- **Synergy.** Almost no set beats what its weapons predict, so "synergy" here means compared with the other sets.
  - **Supply Run is the best partner by far.** It is weak alone (a boost: it fires nothing), but it feeds whatever else you hold. Point Defense + Supply Run and Tesla Arc + Supply Run gain most.
  - **The worst partners** are Seeker Pod + Drone Screen, Flak Cannon + Gravity Well, Railgun + Overdrive, and Gravity Well + Railgun. Each of these pairs does worse than its better weapon alone.
  - **Overdrive and Drone Screen are the weakest partners overall.**

**Overdrive + Scattergun + Supply Run.** The bot does not find this kit strong. Played on 12 seeds a map, it was 18th of the 20 confirmed triples, and in the triples stage it was last of 116.
- It lost 10.9 ships a run and won 32%.
- The bot drafting for itself lost 9.1 and won 45%.
- It was worst on the Strait (15 ships a run) and on Harbor Mouth.

That is the opposite of what you found: it won both runs you played with it, with no boss losses. Overdrive and Supply Run are both boosts, and the bot's weak spot is how it plays boosts and pickups (docs/design/v3-bot-refit.md: you load a Scattergun in the first second of a boss round, and the bot reaches the Supply Run late). So the likely reading is that **you get far more out of this kit than the bot does**, not that the kit is weak. Before anyone tunes it, replay one of your Overdrive + Scattergun + Supply Run logs next to the bot (the `playtest-fidelity` check). The sweep cannot settle it.

**The counter kits (rule `m-kits`).** The rule asks that a map's counter kit does clearly better than other kits. It does not on Harbor Mouth or Kesh.
- Their counter kit (Overdrive + Railgun + Focus) lost 17.0 and 10.3 ships a run.
- The bot drafting for itself lost 12.0 and 7.0 there.
- Focus is a chapter 3 weapon, so the chapter 1 draft never deals it on these maps.

On the Strait, the Gauntlet and Marrow, the counter kit is about level with the bot's own draft.

**The Armory, upgrade by upgrade (each alone at level 5).**
- **Most valuable:** Armor Plating saves about 12–13 ships a run with either kit. Then Damage Control (11–12), Point Defense (6–9), and Proximity Fuse and Wide Warhead (5–8).
- **Least valuable:** Stockpile (about 2), Quick Reload (3–4), Long Loads and Supply Lines (−1 to 4; Supply Lines does worse than nothing when the bot drafts for itself). Your usual build is Quick Reload 5 + Damage Control 4 + Stockpile 5. It uses two of the three weakest upgrades. With the counter kit it loses 10 ships a run, where Wide Warhead + Armor Plating + Long Loads loses 5.

### Proposals for you (nothing here is applied)
1. **Overdrive.** It is the weakest weapon to pair with anything, and it is in four of the five worst triples. First check whether the bot plays it as you do (above). If the bot is right, give Overdrive a stronger level 1 or a longer run.
2. **Seeker Pod and Tesla Arc** are the weakest shooting weapons on their own: about 10–11 ships a run alone, against 8–9 for the best. A small buff to either would widen the good choices.
3. **Harbor Mouth and Kesh need a new counter kit** (rule `m-kits`): one the chapter 1 draft can deal (no Focus) and that beats the bot's own draft. Candidates from the sweep:
   - Harbor Mouth: Point Defense + Railgun + Supply Run, the best there.
   - Kesh: Flak Cannon + Point Defense + Supply Run, which won 92% there.
4. **The Supply bay is weak and Armor Plating is strong.**
   - Stockpile, Supply Lines and Long Loads are the three cheapest saves in the Armory, so a Supply card feels like a wasted win.
   - Either lift them (for example Supply Lines' drop chance), or bring Armor Plating down a little: on its own it is worth more than most whole weapons.
5. **Point Defense, Air Strike and Gravity Well** are in most of the best triples, but none of them runs away with it: the best and worst single weapons are only about 3 ships a run apart. Nothing here needs a nerf.
6. **The Laser Cutter could not be tested.** It is a swipe, and the bot only taps, so with it loaded the bot is worse than with the plain gun. The bot needs a swipe before the sweep can judge the Cutter.

### How far to trust it
- The bot is not you. It fits your play well on ordinary waves but is weaker with boosts and fast pickups. That matters most for Overdrive, Supply Run and the boss rounds.
- A forced loadout is the best case: every draft deals the next card of the kit. A real draft is luckier for some kits than others.
- Seeds are few in the middle stages: 6 a map for pairs and 4 for triples. A pair or triple a ship or so apart is a tie. The confirm stage, at 12 seeds, is the one to quote.
- The fun measure here is tension only (rises and calms each second). It barely tells the loadouts apart. "Saves", the measure that forks a run, cannot be read on a forced-draft run: its log does not replay.
- The chapter 1 changes coming in game version 29 will move the Kesh and Marrow numbers. Re-run with `npm run v3:combo-sweep -- --stage=all` once they land.

### What was cut to fit the time
The machine was shared with other sessions, which made it about twice as slow, so the sweep was cut. It took about 65 minutes in all:

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

12 seeds a map. Rank 18 of the 20 triples in the confirm stage by ships lost.

| Map | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves | Synergy (ships a run) | Trivial? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| The Strait | 8% | 0% | 6.2 | 3.08 | **15.4** | -10.1 | no |
| The Gauntlet | 42% | 0% | 6.3 | 0.67 | **8.3** | -2.9 | no |
| Harbor Mouth | 8% | 0% | 9.3 | 1.67 | **14.3** | -9.3 | no |
| The Kesh Hook | 50% | 0% | 5.3 | 0.81 | **7.7** | -5.6 | no |
| Lee of Marrow | 50% | 0% | 4.8 | 1.33 | **8.8** | -6.1 | no |
| **All five** | 32% | 0% | 6.3 | 1.51 | **10.9** | -6.8 |  |
| _Plain gun, all five_ | 7% | 0% | 9.6 | 2.61 | **17.4** |  |  |
| _Bot drafts for itself_ | 45% | 0% | 5.6 | 1.17 | **9.1** |  |  |

## Kits that make a map trivial

None: no weapon set met the bar on any map.

## Best and worst loadouts (confirmed on 12 seeds a map)

The 15 best and 5 worst triples of the triples stage, played again on more seeds, with each map's counter kit (the plan's), the plain gun and the bot drafting for itself for scale. Tension: the danger on the board each second (docs/design/v3-fun-metrics.md), over the waves the run reached: mean peak, share of time "hot", share of waves with a sawtooth shape (rises and releases, the shape we want).

| # | Loadout | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves | Synergy | Tension peak | Hot | Sawtooth waves |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Air Strike + Point Defense + Supply Run | 58% | 0% | 3.7 | 1.30 | **7.6** | -4.4 | 0.93 | 5% | 17% |
| 2 | Air Strike + Gravity Well + Supply Run | 63% | 0% | 3.8 | 1.28 | **7.7** | -4.4 | 0.99 | 6% | 19% |
| 3 | Flak Cannon + Point Defense + Supply Run | 58% | 3% | 4.1 | 1.19 | **7.7** | -4.4 | 0.93 | 5% | 19% |
| 4 | Air Strike + Gravity Well + Drone Screen | 48% | 0% | 4.3 | 1.22 | **8.0** | -5.8 | 1.01 | 6% | 22% |
| 5 | Scattergun + Point Defense + Railgun | 63% | 0% | 4.4 | 1.23 | **8.1** | -5.7 | 0.97 | 6% | 21% |
| 6 | Point Defense + Railgun + Supply Run | 55% | 0% | 4.1 | 1.32 | **8.1** | -4.6 | 0.97 | 6% | 20% |
| 7 | Frigate Escort + Point Defense + Supply Run | 48% | 0% | 4.7 | 1.21 | **8.3** | -5.3 | 0.94 | 5% | 18% |
| 8 | Air Strike + Scattergun + Gravity Well | 53% | 0% | 5.0 | 1.12 | **8.4** | -6.2 | 1.00 | 5% | 22% |
| 9 | Air Strike + Flak Cannon + Supply Run | 47% | 0% | 4.5 | 1.34 | **8.6** | -5.1 | 0.96 | 5% | 18% |
| 10 | Air Strike + Scattergun + Supply Run | 53% | 0% | 4.6 | 1.35 | **8.6** | -5.1 | 0.99 | 5% | 16% |
| 11 | Frigate Escort + Drone Screen + Supply Run | 48% | 0% | 4.8 | 1.31 | **8.7** | -5.4 | 0.97 | 5% | 19% |
| 12 | Air Strike + Thermobaric Shell + Gravity Well | 53% | 0% | 5.0 | 1.26 | **8.8** | -6.6 | 0.97 | 5% | 20% |
| 13 | Air Strike + Gravity Well + Railgun | 50% | 0% | 4.7 | 1.36 | **8.8** | -6.5 | 1.01 | 6% | 22% |
| 14 | Scattergun + Seeker Pod + Point Defense | 55% | 0% | 5.2 | 1.28 | **9.0** | -6.2 | 0.98 | 5% | 21% |
| 15 | Frigate Escort + Thermobaric Shell + Supply Run | 38% | 2% | 4.8 | 1.56 | **9.4** | -6.1 | 0.97 | 5% | 17% |
| 16 | Boomerang + Flak Cannon + Point Defense | 43% | 0% | 5.2 | 1.50 | **9.7** | -7.3 | 0.98 | 5% | 21% |
| 17 | Boomerang + Flak Cannon + Overdrive | 28% | 0% | 6.1 | 1.53 | **10.7** | -7.8 | 0.99 | 5% | 21% |
| 18 | Scattergun + Supply Run + Overdrive | 32% | 0% | 6.3 | 1.51 | **10.9** | -6.8 | 0.96 | 5% | 21% |
| 19 | Flak Cannon + Seeker Pod + Overdrive | 33% | 0% | 6.6 | 1.48 | **11.1** | -7.7 | 0.99 | 5% | 21% |
| 20 | Flak Cannon + Tesla Arc + Overdrive | 30% | 0% | 7.0 | 1.42 | **11.3** | -8.2 | 0.96 | 5% | 23% |
|  | _The map's counter kit_ | 38% | 0% | 6.3 | 1.54 | **10.9** |  | 1.00 | 5% | 22% |
|  | _Plain gun_ | 7% | 0% | 9.6 | 2.61 | **17.4** |  | 1.04 | 5% | 29% |
|  | _Bot drafts for itself_ | 45% | 0% | 5.6 | 1.17 | **9.1** |  | 0.96 | 5% | 20% |

### By map

**The Strait** (counter kit: Shrapnel Shell, Flak Cannon, Drone Screen)

|  | Loadout | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves |
| --- | --- | --- | --- | --- | --- | --- |
| best 1 | Flak Cannon + Point Defense + Supply Run | 50% | 8% | 2.9 | 1.83 | **8.4** |
| best 2 | Scattergun + Point Defense + Railgun | 50% | 0% | 3.8 | 1.64 | **8.8** |
| best 3 | Air Strike + Gravity Well + Supply Run | 58% | 0% | 2.8 | 2.00 | **8.8** |
| best 4 | Air Strike + Thermobaric Shell + Gravity Well | 42% | 0% | 4.3 | 1.58 | **9.0** |
| best 5 | Scattergun + Seeker Pod + Point Defense | 50% | 0% | 4.8 | 1.42 | **9.1** |
| worst 3 | Boomerang + Flak Cannon + Point Defense | 8% | 0% | 5.5 | 2.72 | **13.7** |
| worst 2 | Flak Cannon + Tesla Arc + Overdrive | 17% | 0% | 6.5 | 2.50 | **14.0** |
| worst 1 | Scattergun + Supply Run + Overdrive | 8% | 0% | 6.2 | 3.08 | **15.4** |
|  | _The map's counter kit_ | 25% | 0% | 5.3 | 2.03 | **11.3** |
|  | _Plain gun_ | 0% | 0% | 8.3 | 4.69 | **22.4** |
|  | _Bot drafts for itself_ | 25% | 0% | 5.4 | 1.81 | **10.8** |

**The Gauntlet** (counter kit: Shrapnel Shell, Thermobaric Shell, Flak Cannon)

|  | Loadout | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves |
| --- | --- | --- | --- | --- | --- | --- |
| best 1 | Air Strike + Flak Cannon + Supply Run | 75% | 0% | 4.1 | 0.75 | **6.3** |
| best 2 | Air Strike + Gravity Well + Supply Run | 67% | 0% | 4.3 | 0.89 | **6.9** |
| best 3 | Frigate Escort + Point Defense + Supply Run | 50% | 0% | 5.1 | 0.64 | **7.0** |
| best 4 | Air Strike + Point Defense + Supply Run | 50% | 0% | 5.1 | 0.72 | **7.3** |
| best 5 | Frigate Escort + Drone Screen + Supply Run | 50% | 0% | 5.8 | 0.50 | **7.3** |
| worst 3 | Flak Cannon + Seeker Pod + Overdrive | 8% | 0% | 7.8 | 1.06 | **10.9** |
| worst 2 | Flak Cannon + Tesla Arc + Overdrive | 25% | 0% | 8.7 | 0.94 | **11.5** |
| worst 1 | Air Strike + Thermobaric Shell + Gravity Well | 17% | 0% | 7.6 | 1.31 | **11.5** |
|  | _The map's counter kit_ | 42% | 0% | 5.8 | 0.75 | **8.0** |
|  | _Plain gun_ | 0% | 0% | 11.2 | 0.92 | **13.9** |
|  | _Bot drafts for itself_ | 33% | 0% | 6.3 | 0.78 | **8.6** |

**Harbor Mouth** (counter kit: Railgun, Focus, Overdrive)

|  | Loadout | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves |
| --- | --- | --- | --- | --- | --- | --- |
| best 1 | Point Defense + Railgun + Supply Run | 25% | 0% | 4.7 | 1.83 | **10.2** |
| best 2 | Air Strike + Gravity Well + Drone Screen | 17% | 0% | 5.7 | 1.64 | **10.6** |
| best 3 | Air Strike + Point Defense + Supply Run | 33% | 0% | 5.8 | 1.67 | **10.8** |
| best 4 | Air Strike + Gravity Well + Supply Run | 17% | 0% | 5.0 | 2.00 | **11.0** |
| best 5 | Air Strike + Flak Cannon + Supply Run | 17% | 0% | 6.4 | 1.56 | **11.1** |
| worst 3 | Boomerang + Flak Cannon + Overdrive | 0% | 0% | 10.1 | 1.69 | **15.2** |
| worst 2 | Flak Cannon + Tesla Arc + Overdrive | 0% | 0% | 9.4 | 2.03 | **15.5** |
| worst 1 | Flak Cannon + Seeker Pod + Overdrive | 8% | 0% | 9.5 | 2.39 | **16.7** |
|  | _The map's counter kit_ | 0% | 0% | 10.6 | 2.14 | **17.0** |
|  | _Plain gun_ | 0% | 0% | 12.9 | 3.61 | **23.8** |
|  | _Bot drafts for itself_ | 33% | 0% | 7.4 | 1.53 | **12.0** |

**The Kesh Hook** (counter kit: Railgun, Focus, Overdrive)

|  | Loadout | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves |
| --- | --- | --- | --- | --- | --- | --- |
| best 1 | Flak Cannon + Point Defense + Supply Run | 92% | 0% | 2.4 | 0.81 | **4.8** |
| best 2 | Air Strike + Point Defense + Supply Run | 83% | 0% | 2.5 | 0.89 | **5.2** |
| best 3 | Air Strike + Thermobaric Shell + Gravity Well | 83% | 0% | 2.8 | 0.81 | **5.2** |
| best 4 | Scattergun + Seeker Pod + Point Defense | 92% | 0% | 2.9 | 0.81 | **5.3** |
| best 5 | Air Strike + Gravity Well + Supply Run | 92% | 0% | 2.8 | 0.89 | **5.4** |
| worst 3 | Scattergun + Supply Run + Overdrive | 50% | 0% | 5.3 | 0.81 | **7.7** |
| worst 2 | Flak Cannon + Seeker Pod + Overdrive | 58% | 0% | 4.8 | 1.08 | **8.1** |
| worst 1 | Boomerang + Flak Cannon + Overdrive | 58% | 0% | 4.2 | 1.42 | **8.4** |
|  | _The map's counter kit_ | 42% | 0% | 6.1 | 1.42 | **10.3** |
|  | _Plain gun_ | 25% | 0% | 6.8 | 2.36 | **13.8** |
|  | _Bot drafts for itself_ | 67% | 0% | 4.1 | 0.97 | **7.0** |

**Lee of Marrow** (counter kit: Seeker Pod, Point Defense, Drone Screen)

|  | Loadout | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves |
| --- | --- | --- | --- | --- | --- | --- |
| best 1 | Air Strike + Gravity Well + Drone Screen | 92% | 0% | 3.2 | 0.42 | **4.4** |
| best 2 | Frigate Escort + Drone Screen + Supply Run | 92% | 0% | 3.0 | 0.64 | **4.9** |
| best 3 | Flak Cannon + Point Defense + Supply Run | 83% | 0% | 3.3 | 0.75 | **5.5** |
| best 4 | Air Strike + Gravity Well + Railgun | 83% | 0% | 3.2 | 0.78 | **5.5** |
| best 5 | Scattergun + Point Defense + Railgun | 92% | 0% | 2.9 | 0.89 | **5.6** |
| worst 3 | Boomerang + Flak Cannon + Overdrive | 50% | 0% | 4.4 | 1.17 | **7.9** |
| worst 2 | Flak Cannon + Tesla Arc + Overdrive | 42% | 0% | 5.7 | 0.83 | **8.2** |
| worst 1 | Scattergun + Supply Run + Overdrive | 50% | 0% | 4.8 | 1.33 | **8.8** |
|  | _The map's counter kit_ | 83% | 0% | 3.7 | 1.36 | **7.8** |
|  | _Plain gun_ | 8% | 0% | 8.7 | 1.44 | **13.0** |
|  | _Bot drafts for itself_ | 67% | 0% | 4.8 | 0.75 | **7.1** |

## Each weapon on its own (12 seeds a map)

**Alone**: the weapon levelled to MAX by wave 4, then Resupply at every draft (nothing else held). **First pick**: the weapon levelled to MAX first, then the bot drafts for itself (a realistic run that starts with it). Sorted by ships lost alone.

| Weapon | Alone: won | Alone: lost 1–10 | Alone: boss round | Alone: all 13 | First pick: won | First pick: all 13 | Alone: The Strait | Alone: The Gauntlet | Alone: Harbor Mouth | Alone: The Kesh Hook | Alone: Lee of Marrow |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Frigate Escort | 55% | 4.7 | 1.19 | **8.2** | 50% | 8.7 | 10.6 | 7.3 | 11.2 | 6.0 | 6.1 |
| Point Defense | 53% | 4.4 | 1.28 | **8.3** | 60% | 7.8 | 9.1 | 7.1 | 11.6 | 7.0 | 6.5 |
| Gravity Well | 55% | 4.5 | 1.30 | **8.4** | 63% | 8.3 | 10.3 | 7.2 | 12.3 | 7.0 | 5.5 |
| Flak Cannon | 62% | 4.3 | 1.48 | **8.7** | 52% | 8.6 | 11.3 | 9.3 | 11.8 | 4.8 | 6.6 |
| Air Strike | 57% | 4.0 | 1.56 | **8.7** | 47% | 9.5 | 11.7 | 7.6 | 10.9 | 7.1 | 6.4 |
| Drone Screen | 52% | 4.5 | 1.42 | **8.8** | 53% | 9.3 | 10.4 | 8.8 | 12.8 | 6.3 | 5.8 |
| Scattergun | 50% | 5.0 | 1.29 | **8.9** | 37% | 9.6 | 11.6 | 10.2 | 10.6 | 6.1 | 5.9 |
| Thermobaric Shell | 40% | 5.0 | 1.32 | **8.9** | 50% | 8.8 | 10.7 | 8.0 | 11.1 | 7.8 | 7.2 |
| Railgun | 40% | 5.4 | 1.34 | **9.4** | 40% | 9.3 | 10.6 | 8.4 | 12.3 | 8.5 | 7.2 |
| Shrapnel Shell | 45% | 5.3 | 1.39 | **9.5** | 45% | 9.1 | 11.8 | 8.2 | 13.9 | 6.3 | 7.4 |
| Boomerang | 43% | 5.8 | 1.34 | **9.9** | 50% | 9.1 | 9.7 | 9.9 | 14.2 | 7.8 | 7.9 |
| Overdrive | 32% | 6.0 | 1.36 | **10.0** | 43% | 8.9 | 13.0 | 8.5 | 14.3 | 7.3 | 7.1 |
| Tesla Arc | 37% | 6.3 | 1.36 | **10.4** | 35% | 9.9 | 11.9 | 10.9 | 14.8 | 7.2 | 7.3 |
| Seeker Pod | 25% | 5.7 | 1.83 | **11.2** | 40% | 9.7 | 15.2 | 10.8 | 13.9 | 8.8 | 7.5 |
| Supply Run | 23% | 7.6 | 1.96 | **13.5** | 55% | 8.9 | 17.8 | 11.9 | 18.3 | 8.9 | 10.6 |
| Laser Cutter | 0% | 25.4 | 4.07 | **37.6** | 2% | 21.4 | 38.8 | 29.8 | 50.7 | 36.8 | 31.8 |
| _Plain gun_ | 7% | 9.6 | 2.61 | **17.4** |  |  | 22.4 | 13.9 | 23.8 | 13.8 | 13.0 |
| _Bot drafts for itself_ | 45% | 5.6 | 1.17 | **9.1** |  |  | 10.8 | 8.6 | 12.0 | 7.0 | 7.1 |

## Pairs (105 pairs, 6 seeds a map)

Two weapons, nothing else. Best 10 and worst 5 by ships lost.

| # | Pair | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves | Synergy |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Air Strike + Point Defense | 70% | 0% | 3.8 | 0.90 | **6.5** | -2.5 |
| 2 | Air Strike + Gravity Well | 70% | 0% | 3.5 | 1.10 | **6.8** | -3.4 |
| 3 | Shrapnel Shell + Gravity Well | 60% | 0% | 4.4 | 0.90 | **7.1** | -3.2 |
| 4 | Point Defense + Supply Run | 73% | 0% | 3.2 | 1.30 | **7.1** | -0.2 |
| 5 | Scattergun + Point Defense | 63% | 0% | 3.9 | 1.10 | **7.2** | -2.7 |
| 6 | Flak Cannon + Point Defense | 67% | 0% | 3.9 | 1.14 | **7.4** | -2.8 |
| 7 | Flak Cannon + Overdrive | 67% | 0% | 3.9 | 1.20 | **7.5** | -2.3 |
| 8 | Frigate Escort + Supply Run | 57% | 0% | 3.5 | 1.36 | **7.6** | -1.2 |
| 9 | Air Strike + Supply Run | 60% | 0% | 3.4 | 1.44 | **7.8** | -1.7 |
| 10 | Gravity Well + Drone Screen | 60% | 0% | 3.9 | 1.29 | **7.8** | -4.1 |
| 101 | Tesla Arc + Overdrive | 30% | 0% | 6.1 | 1.53 | **10.7** | -4.4 |
| 102 | Seeker Pod + Tesla Arc | 33% | 0% | 6.9 | 1.36 | **11.0** | -4.1 |
| 103 | Boomerang + Seeker Pod | 27% | 0% | 6.3 | 1.57 | **11.0** | -5.1 |
| 104 | Seeker Pod + Drone Screen | 27% | 0% | 5.5 | 1.94 | **11.4** | -6.1 |
| 105 | Supply Run + Overdrive | 33% | 0% | 6.4 | 1.94 | **12.3** | -4.6 |

### Synergy: pairs

**Every pair falls short of the prediction** (mean synergy -3.9 ships a run). That is expected in this game: the weapons share one gun (a pickup replaces the loaded weapon), so two weapons split the gun's time and the drops instead of adding up, and a run has some losses no weapon prevents. So read synergy against the other pairs: **relative synergy** = a pair's synergy less the mean of all pairs. Positive: these two fit together better than most; negative: worse than most. "Second weapon adds" is the plainest test: ships a run the pair saves over the better of its two weapons alone (negative: the pair does worse than its best weapon alone).

All 13 waves, the mean over the five maps (per map: relative synergy).

|  | Pair | Lost | Best alone | Second weapon adds | Predicted (independent) | Relative synergy | The Strait | The Gauntlet | Harbor Mouth | The Kesh Hook | Lee of Marrow |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best partners | Point Defense + Supply Run | 7.1 | 8.8 | +1.7 | 6.9 | **+3.7** | +4.0 | +4.6 | +2.8 | +2.6 | +4.8 |
| best partners | Tesla Arc + Supply Run | 9.4 | 11.1 | +1.7 | 8.7 | **+3.2** | +2.9 | +4.2 | +1.0 | +3.2 | +4.8 |
| best partners | Shrapnel Shell + Supply Run | 7.9 | 8.9 | +1.0 | 7.0 | **+3.0** | +2.7 | +2.7 | +3.3 | +1.2 | +5.0 |
| best partners | Thermobaric Shell + Supply Run | 8.0 | 8.8 | +0.8 | 6.8 | **+2.8** | +2.1 | +2.7 | -0.5 | +2.7 | +6.8 |
| best partners | Frigate Escort + Supply Run | 7.6 | 8.2 | +0.6 | 6.4 | **+2.7** | +0.5 | +3.7 | +4.3 | +1.3 | +3.8 |
| best partners | Flak Cannon + Supply Run | 8.4 | 9.1 | +0.6 | 7.1 | **+2.6** | -0.6 | +3.3 | +3.4 | +1.9 | +5.0 |
| best partners | Scattergun + Supply Run | 8.3 | 8.7 | +0.5 | 6.9 | **+2.5** | +0.6 | +6.1 | +0.2 | +2.1 | +3.7 |
| best partners | Boomerang + Supply Run | 9.0 | 9.7 | +0.6 | 7.6 | **+2.5** | +0.3 | +2.9 | +1.6 | +3.1 | +4.4 |
| best partners | Air Strike + Supply Run | 7.8 | 7.8 | +0.0 | 6.1 | **+2.2** | -1.5 | +2.4 | +1.6 | +3.5 | +5.2 |
| best partners | Gravity Well + Supply Run | 7.9 | 7.5 | -0.3 | 5.8 | **+1.9** | -0.3 | +2.6 | +2.3 | +0.9 | +3.9 |
| worst partners | Seeker Pod + Drone Screen | 11.4 | 8.5 | -2.9 | 5.2 | **-2.2** | -6.3 | -1.0 | -2.6 | -3.5 | +2.4 |
| worst partners | Flak Cannon + Gravity Well | 9.9 | 7.5 | -2.4 | 4.0 | **-2.1** | -4.7 | -0.6 | -2.3 | -1.9 | -0.8 |
| worst partners | Railgun + Overdrive | 10.7 | 9.1 | -1.6 | 5.0 | **-1.8** | -2.2 | -0.2 | -4.3 | -0.7 | -1.3 |
| worst partners | Gravity Well + Railgun | 9.6 | 7.5 | -2.1 | 4.0 | **-1.7** | -6.0 | +0.7 | -3.1 | +1.6 | -1.6 |
| worst partners | Scattergun + Overdrive | 10.5 | 8.7 | -1.8 | 5.0 | **-1.6** | -1.5 | +1.5 | -5.2 | -2.5 | -0.2 |
| worst partners | Point Defense + Drone Screen | 9.7 | 8.5 | -1.2 | 4.3 | **-1.5** | -2.1 | -2.5 | -2.6 | -0.2 | -0.1 |
| worst partners | Point Defense + Overdrive | 10.3 | 8.8 | -1.5 | 4.9 | **-1.5** | -1.4 | -0.6 | -2.3 | -1.7 | -1.4 |
| worst partners | Air Strike + Seeker Pod | 10.2 | 7.8 | -2.4 | 4.8 | **-1.5** | -1.4 | -1.7 | -3.9 | -0.1 | -0.2 |
| worst partners | Gravity Well + Overdrive | 9.6 | 7.5 | -2.1 | 4.2 | **-1.5** | -1.5 | -2.2 | -2.9 | +0.7 | -1.5 |
| worst partners | Frigate Escort + Drone Screen | 9.4 | 8.2 | -1.2 | 4.0 | **-1.5** | -4.0 | -1.0 | -1.0 | -0.7 | -0.5 |

Mean relative synergy of each weapon over all its pairs (a good partner, or one that does its job alone):

| Weapon | Mean relative synergy in a pair |
| --- | --- |
| Supply Run | +2.28 |
| Tesla Arc | +0.69 |
| Point Defense | +0.33 |
| Flak Cannon | +0.23 |
| Shrapnel Shell | +0.05 |
| Scattergun | -0.04 |
| Thermobaric Shell | -0.05 |
| Boomerang | -0.18 |
| Air Strike | -0.20 |
| Railgun | -0.39 |
| Seeker Pod | -0.42 |
| Gravity Well | -0.44 |
| Frigate Escort | -0.50 |
| Drone Screen | -0.66 |
| Overdrive | -0.72 |

## Triples (116 triples, 4 seeds a map)

pairs extended: Air Strike + Point Defense; Air Strike + Gravity Well; Shrapnel Shell + Gravity Well; Point Defense + Supply Run; Scattergun + Point Defense; Flak Cannon + Point Defense; Flak Cannon + Overdrive; Frigate Escort + Supply Run; Air Strike + Supply Run; Gravity Well + Drone Screen

| # | Triple | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves | Synergy (vs singles) | Third weapon's own synergy (vs pairs) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Air Strike + Gravity Well + Supply Run | 65% | 0% | 3.5 | 1.03 | **6.7** | -4.3 | +4.0 |
| 2 | Flak Cannon + Point Defense + Supply Run | 60% | 5% | 4.0 | 0.90 | **6.7** | -3.0 | +0.6 |
| 3 | Air Strike + Point Defense + Supply Run | 60% | 0% | 3.6 | 1.08 | **6.9** | -4.2 | +1.3 |
| 4 | Air Strike + Scattergun + Supply Run | 70% | 0% | 3.9 | 1.03 | **7.0** | -4.4 | +5.6 |
| 5 | Air Strike + Gravity Well + Drone Screen | 70% | 0% | 4.0 | 0.98 | **7.0** | -5.5 | +8.5 |
| 6 | Air Strike + Thermobaric Shell + Gravity Well | 65% | 0% | 4.5 | 0.85 | **7.0** | -5.5 | +10.2 |
| 7 | Air Strike + Gravity Well + Railgun | 65% | 0% | 3.4 | 1.20 | **7.0** | -5.3 | +11.9 |
| 8 | Frigate Escort + Thermobaric Shell + Supply Run | 55% | 5% | 3.7 | 1.10 | **7.0** | -3.8 | +3.4 |
| 9 | Air Strike + Flak Cannon + Supply Run | 55% | 0% | 4.5 | 0.87 | **7.0** | -4.0 | +3.5 |
| 10 | Frigate Escort + Drone Screen + Supply Run | 65% | 0% | 4.2 | 1.02 | **7.3** | -4.0 | +6.6 |
| 11 | Air Strike + Scattergun + Gravity Well | 70% | 0% | 4.3 | 1.02 | **7.3** | -5.9 | +12.8 |
| 12 | Point Defense + Railgun + Supply Run | 60% | 0% | 4.0 | 1.10 | **7.3** | -3.8 | +1.6 |
| 13 | Scattergun + Point Defense + Railgun | 75% | 0% | 4.5 | 0.97 | **7.4** | -5.3 | +10.7 |
| 14 | Scattergun + Seeker Pod + Point Defense | 65% | 0% | 4.5 | 0.98 | **7.4** | -5.2 | +12.0 |
| 15 | Frigate Escort + Point Defense + Supply Run | 60% | 0% | 4.3 | 1.07 | **7.5** | -4.3 | +2.4 |
| … |  |  |  |  |  |  |  |  |
| 112 | Boomerang + Flak Cannon + Point Defense | 40% | 0% | 6.0 | 1.52 | **10.6** | -7.9 | +6.3 |
| 113 | Flak Cannon + Seeker Pod + Overdrive | 35% | 0% | 6.3 | 1.42 | **10.6** | -7.4 | +1.1 |
| 114 | Flak Cannon + Tesla Arc + Overdrive | 30% | 0% | 7.0 | 1.35 | **11.0** | -7.3 | +0.8 |
| 115 | Boomerang + Flak Cannon + Overdrive | 25% | 0% | 6.9 | 1.43 | **11.2** | -8.3 | +2.5 |
| 116 | Scattergun + Supply Run + Overdrive | 30% | 0% | 7.2 | 1.43 | **11.4** | -8.0 | +10.7 |

### Synergy: triples

Against the singles: what the three weapons alone predict. Against the pairs: what the three pairs inside it predict, so what is left is what the three do only all together.

Means over the triples: -6.2 against the singles, +6.0 against the pairs. As with the pairs, read each against the mean (relative).

|  | Triple | Lost | Synergy vs singles | Relative | Synergy vs pairs | Relative |
| --- | --- | --- | --- | --- | --- | --- |
| all three together | Scattergun + Point Defense + Overdrive | 8.9 | -6.7 | -0.5 | +15.1 | **+9.2** |
| all three together | Gravity Well + Railgun + Drone Screen | 8.3 | -6.3 | -0.1 | +14.2 | **+8.2** |
| all three together | Air Strike + Scattergun + Gravity Well | 7.3 | -5.9 | +0.3 | +12.8 | **+6.8** |
| all three together | Air Strike + Shrapnel Shell + Point Defense | 7.8 | -6.2 | +0.0 | +12.4 | **+6.4** |
| all three together | Frigate Escort + Supply Run + Overdrive | 9.3 | -5.8 | +0.5 | +12.3 | **+6.3** |
| all three together | Scattergun + Seeker Pod + Point Defense | 7.4 | -5.2 | +1.1 | +12.0 | **+6.0** |
| crowded | Point Defense + Tesla Arc + Supply Run | 8.7 | -4.3 | +2.0 | -1.4 | **-7.4** |
| crowded | Flak Cannon + Point Defense + Tesla Arc | 8.8 | -5.6 | +0.7 | -0.4 | **-6.3** |
| crowded | Flak Cannon + Supply Run + Overdrive | 10.0 | -5.8 | +0.5 | -0.0 | **-6.0** |
| crowded | Scattergun + Point Defense + Supply Run | 9.7 | -6.6 | -0.4 | +0.5 | **-5.5** |
| crowded | Flak Cannon + Point Defense + Supply Run | 6.7 | -3.0 | +3.3 | +0.6 | **-5.3** |
| crowded | Shrapnel Shell + Gravity Well + Supply Run | 9.0 | -6.2 | +0.0 | +0.7 | **-5.3** |

## The Armory (4 seeds a map)

A run equips one upgrade from each bay (Gun, Hull, Supply), so only builds with at most one upgrade a bay are played: each upgrade alone at level 5, every pair from two bays at level 5 and every full build (one a bay) at level 5 (these two with the counter kit only), and three budgets (your usual three at level 1, at level 3, and as you have them: Quick Reload 5, Damage Control 4, Stockpile 5). Each with the map's counter kit forced (the plan's, docs/design/v3-map-plans) and with the bot drafting for itself.
- Harbor Mouth's counter kit has Focus, which its chapter's draft does not deal; forced in anyway (the kit as the plan names it).
- The Kesh Hook's counter kit has Focus, which its chapter's draft does not deal; forced in anyway (the kit as the plan names it).

### With the map's counter kit

Each upgrade alone at level 5: ships saved a run (all 13 waves) against no Armory, per map. Higher is better.

| Upgrade | Bay | Won | Lost, all 13 | Saved, all five | The Strait | The Gauntlet | Harbor Mouth | The Kesh Hook | Lee of Marrow |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Armor Plating | hull | 25% | 11.7 | **+12.8** | +12.3 | +10.5 | +14.5 | +15.8 | +11.0 |
| Damage Control | hull | 5% | 13.6 | **+10.8** | +11.0 | +8.5 | +11.0 | +12.3 | +11.5 |
| Point Defense | hull | 10% | 15.3 | **+9.1** | +2.0 | +7.5 | +13.3 | +17.0 | +5.8 |
| Wide Warhead | gun | 10% | 16.6 | **+7.9** | +12.8 | +5.8 | -3.5 | +10.3 | +14.3 |
| Proximity Fuse | gun | 25% | 17.4 | **+7.1** | -0.8 | +11.3 | +12.0 | +3.0 | +10.0 |
| Deep Magazine | gun | 5% | 18.9 | **+5.6** | +5.5 | +4.3 | +6.8 | +6.5 | +5.0 |
| Fast Motors | gun | 5% | 19.8 | **+4.6** | +4.5 | +5.5 | +2.5 | +6.0 | +4.8 |
| Long Loads | supply | 5% | 20.4 | **+4.0** | +0.3 | +5.0 | +4.8 | +2.3 | +7.8 |
| Supply Lines | supply | 0% | 20.4 | **+4.0** | +7.0 | +2.0 | +6.8 | +6.0 | -1.8 |
| Quick Reload | gun | 0% | 21.4 | **+3.0** | +1.5 | +2.8 | +6.3 | +2.0 | +2.5 |
| Stockpile | supply | 0% | 22.1 | **+2.3** | +4.0 | +2.8 | +0.3 | +3.5 | +1.0 |
| _No Armory_ |  | 0% | 24.4 |  |  |  |  |  |  |

Full builds (one upgrade a bay, all at level 5): best 8 and worst 3, and the budgets.

|  | Build | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves |
| --- | --- | --- | --- | --- | --- | --- |
| best 1 | Wide Warhead 5 + Armor Plating 5 + Long Loads 5 | 85% | 0% | 3.0 | 0.67 | **5.0** |
| best 2 | Wide Warhead 5 + Armor Plating 5 + Stockpile 5 | 70% | 0% | 3.5 | 0.82 | **6.0** |
| best 3 | Proximity Fuse 5 + Armor Plating 5 + Stockpile 5 | 75% | 0% | 3.5 | 0.87 | **6.2** |
| best 4 | Wide Warhead 5 + Armor Plating 5 + Supply Lines 5 | 70% | 0% | 4.2 | 0.72 | **6.3** |
| best 5 | Proximity Fuse 5 + Damage Control 5 + Supply Lines 5 | 75% | 0% | 3.4 | 1.08 | **6.6** |
| best 6 | Fast Motors 5 + Armor Plating 5 + Supply Lines 5 | 55% | 0% | 3.1 | 1.17 | **6.7** |
| best 7 | Quick Reload 5 + Armor Plating 5 + Supply Lines 5 | 75% | 0% | 3.5 | 1.05 | **6.7** |
| best 8 | Wide Warhead 5 + Damage Control 5 + Supply Lines 5 | 65% | 0% | 4.8 | 0.65 | **6.8** |
| worst 3 | Quick Reload 5 + Point Defense 5 + Long Loads 5 | 35% | 0% | 5.5 | 1.88 | **11.2** |
| worst 2 | Deep Magazine 5 + Point Defense 5 + Stockpile 5 | 30% | 0% | 7.5 | 1.37 | **11.7** |
| worst 1 | Quick Reload 5 + Point Defense 5 + Stockpile 5 | 20% | 0% | 6.5 | 2.18 | **13.0** |
|  | _No Armory_ | 0% | 0% | 12.1 | 4.13 | **24.4** |
|  | _Quick Reload 1 + Damage Control 1 + Stockpile 1_ | 15% | 0% | 8.4 | 2.55 | **16.1** |
|  | _Quick Reload 3 + Damage Control 3 + Stockpile 3_ | 20% | 0% | 7.3 | 2.12 | **13.7** |
|  | _Quick Reload 5 + Damage Control 4 + Stockpile 5_ | 50% | 0% | 6.0 | 1.33 | **10.0** |

Pairs from two bays at level 5: best 5 of 39: Wide Warhead 5 + Armor Plating 5 (7.3 lost, won 65%); Fast Motors 5 + Armor Plating 5 (7.8 lost, won 55%); Armor Plating 5 + Supply Lines 5 (8.2 lost, won 60%); Deep Magazine 5 + Damage Control 5 (8.5 lost, won 45%); Proximity Fuse 5 + Armor Plating 5 (8.5 lost, won 45%).

Builds that make a map trivial or nearly (counter kit):

| Map | Build | Verdict | Won | Won, no ship lost | Lost, all 13 |
| --- | --- | --- | --- | --- | --- |
| The Kesh Hook | Wide Warhead 5 + Point Defense 5 + Long Loads 5 | **trivial** | 100% | 50% | 1.3 |

### With the bot drafting for itself

Each upgrade alone at level 5: ships saved a run (all 13 waves) against no Armory, per map. Higher is better.

| Upgrade | Bay | Won | Lost, all 13 | Saved, all five | The Strait | The Gauntlet | Harbor Mouth | The Kesh Hook | Lee of Marrow |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Armor Plating | hull | 30% | 12.0 | **+12.5** | +8.5 | +12.5 | +13.0 | +15.0 | +13.5 |
| Damage Control | hull | 40% | 12.8 | **+11.7** | +4.3 | +13.8 | +8.3 | +15.5 | +16.5 |
| Proximity Fuse | gun | 10% | 17.9 | **+6.6** | +2.3 | +12.3 | +4.3 | +5.0 | +9.3 |
| Point Defense | hull | 10% | 18.2 | **+6.3** | -6.8 | +10.3 | +7.3 | +13.8 | +7.0 |
| Deep Magazine | gun | 5% | 19.3 | **+5.3** | +2.8 | +4.5 | +3.3 | +10.3 | +5.5 |
| Fast Motors | gun | 5% | 19.4 | **+5.1** | -0.5 | +4.5 | +7.0 | +5.8 | +8.8 |
| Wide Warhead | gun | 10% | 19.4 | **+5.1** | 0.0 | +4.0 | -1.0 | +6.3 | +16.0 |
| Quick Reload | gun | 5% | 20.1 | **+4.4** | -2.0 | +7.8 | +1.8 | +9.8 | +4.8 |
| Stockpile | supply | 5% | 22.6 | **+1.9** | -0.5 | +1.0 | +4.3 | +2.3 | +2.5 |
| Long Loads | supply | 0% | 23.7 | **+0.8** | -9.8 | +2.8 | -2.0 | +4.5 | +8.5 |
| Supply Lines | supply | 0% | 25.6 | **-1.1** | -4.5 | +0.8 | -7.3 | +2.3 | +3.0 |
| _No Armory_ |  | 0% | 24.5 |  |  |  |  |  |  |

The budgets.

|  | Build | Won | Won, no ship lost | Ships lost, waves 1–10 | Ships lost a boss round | Ships lost, all 13 waves |
| --- | --- | --- | --- | --- | --- | --- |
|  | _No Armory_ | 0% | 0% | 14.1 | 3.47 | **24.5** |
|  | _Quick Reload 1 + Damage Control 1 + Stockpile 1_ | 10% | 0% | 9.3 | 3.02 | **18.3** |
|  | _Quick Reload 3 + Damage Control 3 + Stockpile 3_ | 40% | 0% | 7.5 | 2.02 | **13.6** |
|  | _Quick Reload 5 + Damage Control 4 + Stockpile 5_ | 35% | 0% | 6.8 | 1.23 | **10.6** |

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
| singles | 12 | 2040 | 14.8 |
| pairs | 6 | 3150 | 17.5 |
| triples | 4 | 2320 | 15.3 |
| confirm | 12 | 1380 | 6.8 |
| armory | 4 | 2280 | 7.9 |

