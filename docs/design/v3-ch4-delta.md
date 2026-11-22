# The Sharra Delta: map card (map rebuild, chapter 4)

**Date:** 2026-11-22. The Delta (`delta`, chapter 4 "Open War", the 17th map and the chapter's second) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), the way the chapter 3 maps were (`docs/design/v3-ch3-battery.md`, `v3-ch3-sowers.md`, `v3-ch3-rigs.md`). Encounter rev 4; play log **v57** (55 and 56 are the chapter 3 notes and the Coves, built alongside).

There is no player run of the Delta to start from. The starting point is the map as it was (the Test Lab card: today's convoy controls, the shared waves, the Escort Run as its boss) and what the player asked of every rebuild: a question of its own and kits of its own, busier early waves ("more drones and easy things to kill", "less is more"), the climb from wave 4 to 9, no single-wave cliff, wave 10 the climax and not a wall, big and distinct boss set pieces, readable on an iPhone in landscape (874×402).

As it was (192 seeds, the usual Armory, the card's own setup): won 55%, waves 1–4 nearly empty (0.01 0.14 0.05 0.06 ships), a climb to a wave 10 of 1.20, and a boss that did nothing (0.01 ships a round). Its one mechanic, the fork's switch, was a free choice: with no reason to send ships anywhere but the branch away from the fire, the south branch (out of every silo's reach) was always the answer.

Code:
- `src/v3/data/encounters.ts`: `DELTA_R4` (ten encounters), the filler for waves 1–6 (`BUSY`), `DELTA_CLIMB`, the aim `'switch'` (`BeatAim`), `MAP_SIGNATURE.delta` (`foe: 'cloud'`, `clouds: 'switch'`), `DELTA_BOSS_ROUNDS` and `MAP_BOSS.delta` (a boss round's `burn`; the boss's name, Burning Delta), `CHAPTER_FOUR_MAPS` (the Coves and the Delta, in `REBUILT_MAPS`), the script's words for an incendiary missile and the switch's aim;
- `src/v3/sim/game.ts`: `switchLane`, `branchMouth` (`FORK_MOUTH`: 270 px down a branch past the buoy), `branchBurning`; `aimBeat` takes `'switch'` (the newest ship bound for the switch's branch); the wave planner aims the signature's incendiaries at the switch; `quieterBranch` counts a burning branch mouth as hot;
- `src/v3/sim/foes.ts`: an Incendiary Missile aimed at the switch flies for the mouth of that branch as it leaves and bursts there;
- `src/v3/sim/events.ts`: the Escort Run under the Delta's boss tuning is the Burning Delta (`burningDelta`, `DELTA_BURN`: lit 2.5 s, then the oil burns); with no boss tuning it plays as it did;
- `src/v3/sim/bot.ts`, `mimic.ts`: the bots see fire on the switch's own branch at once and throw the switch (before: a look at the fork every 10–12 s);
- `src/v3/data/convoy.ts`: `MAP_CONVOY.delta` (flow step 3, the Spread, no command); `src/v3/data/mapPlans.ts`: `MAP_PLANS.delta`; `src/v3/data/lab.ts`: "Ready to test" lists the Delta at v57; `src/v3/sim/playlog.ts`: `LOG_VERSION` 57;
- tools: `tools/v3/delta/` (as `tools/v3/rigs/`): `read.py` with `seeds.ts` (a tuning read on four processes), `budget.ts`, `wave1.ts`, `probe-boss.ts`, `sunk.ts`, `compare.py` (the diversity check against every rebuilt map), and `shared.ts` (what the shared waves send, by kind and base); `tools/v3/combo-sweep/mixwaves.ts` counts the Delta's signature (`cloud`).

Bot reports: `tools/v3/map-report/results/delta-player.md` (the usual Armory: Quick Reload 5, Damage Control 4, Stockpile 5), `delta-latest.md` (Wide Warhead 5, Point Defense 4, Supply Lines 3), `delta-plating.md` (Quick Reload 5, Armor Plating 5, Big Magazine 4), `delta.md` (no Armory); each with a heat map and the counter and off-counter kits. Tuning reads: 192 seeds (900–1091), `python3 tools/v3/delta/read.py --seeds=192 --armory=... [--tough]`. "Before" was read on the base build (#216, log v49) on the same seeds; there are no 24-seed "before" report files this time (to save the bot budget).

## How it is gated (lab vs campaign)

As every rebuild: **lab only, under the encounter layer.** The Test Lab's map card (`?lab=map-delta`) opens on its production setup, policy D with no command, the map's own convoy and the authored encounters rev 4, because the Delta is in `REBUILT_MAPS` (via `CHAPTER_FOUR_MAPS`). The hub card reads "The map's own convoy (no commands) · encounters v1 Original". Everything new reads the run's encounter setup (`signatureOf`, `bossTune`, an encounter's aim), so the campaign, a run with no layer, a rev 3 log and the shared wave (`only: []`) play the Delta exactly as before: the shared waves, the planner's own new enemies and the Escort Run. One change reaches the campaign's bots only: they throw the switch off a burning branch (no human's game changes). The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version.

## The problem

> The river forks three ways at the buoy and its switch sends the next ships north under the enemy bank, middle past the carrier, or south out of reach, but the enemy reads the switch: it fires at the branch the switch is set to, and from wave 4 its incendiaries burst on that branch's mouth, so the safe branch is only safe until you send ships down it.

The fork is the map's one mechanic (rule `m-mechanic`; `data/maps20.ts`): one river from the west (y 400) splits at the buoy (560, 480) into the north branch (up under the enemy bank to y 130), the middle branch (straight on, past the carrier at (1000, 522)) and the south branch (down past your own marsh to y 788). A tap on the buoy sends the next ships down the next branch; ships already past the fork keep theirs.

The question: **which branch for the next ships, and when to throw the switch?** The north is the shortest flights for the enemy (the bank's silos are over it); the middle runs under the island's two silos; the south is out of everyone's reach. Before the rebuild that made the south free. Now the enemy reads the switch: beats aimed `'switch'` go for the newest ship bound for the switch's branch, and the incendiaries (from wave 4) fly for the mouth of that branch and burn there, where the next ships would sail. Shoot the firebomb far out, or throw the switch and send the ships round the fire.

The mechanic is in the waves (rule `g-mechanic`): a beat at the switch's branch in waves 2, 4 and 6–10, incendiaries on the branch mouths in waves 4 and 6–10, two branches burning in wave 9 and 10, and the boss rounds burn the branches themselves.

How it differs from the other rebuilt maps: there the danger is aimed at a place (an island's side, a lock, the guns, a dark bank), a ship (the tanker), a launcher you can remove (the rigs) or drifts (the mines); here it follows the player's own steering.

## Sites and their jobs

Bases are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| North-west silo (base 1) | Over the river (220, 150) | drones, shells | The short flight over the ships coming down the river: a shell at the switch's newest ship (w2), shells at the ships coming in (w4, w5, w9), late drones on wave 1, the raids on the way in (w9, w10, boss). |
| Fork silo (base 2) | Over the fork (560, 175) | guided, supersonic | The fork itself: a guided missile at the ships coming in (w3, w7, w9, w10, boss), a supersonic locked on the switch's newest ship (w7), an incendiary (w9). |
| North bank silo (base 3) | Over the north branch (860, 82) | heavies, shells | Point-blank on the north branch: shells at the ship nearest it (w3, w4, w6, w8), shells at the lead ship (w10), the boss's last shells. |
| Island west silo (base 4) | Between the north and middle branches (1060, 285) | clusters, drones | Both branches it sits between: drones at the lead ship (w1) and the switch's branch (w2), clusters (w5, w6, w8, w10, boss), most incendiaries, and all the filler (the far drone silo). |
| Island east silo (base 5) | Over the delivery end (1430, 272) | guided, heavies, motherships | A guided missile at the lead ship (w5, w8) or the ship nearest it (w6); in the boss, at the switch's branch. |
| Roads, air | The north road, the ridge road, the pop-up road at 1250, the edges | trucks, jets, bombers | The shared waves' own. No sub spots: the delta is too shallow. |

Warning time falls from 8.9 s on wave 1 to 4.6 s on wave 10 (rule `g-warning`, the usual Armory's report).

## The stretches

- **Danger: the middle**, the lanes' middle third: the fork and the branch mouths just past it, where the ships come out of the river under the fork's silo and the fire lands on the branches: 39% of the hull damage in waves 1–9 (the usual Armory's report; per lane, the north and middle branches' middle third 42%, the south branch's early third 48%).
- **Safe: the late third**, the branch ends, spread across three branches: 26% pooled (21–26% by lane). The report flags it (a lane's coldest stretch at 26–28% on the north and middle lanes against a 25% line), as on most rebuilt maps.
- Rule `m-carrier`: the carrier (1000, 522) sits beside the middle branch past the fork, so the danger stretch is also the carrier's closest, as on the Rigs and the Sowers. The plan was the way in (the river) as the danger; the encounters' drones at the ships coming down the river took waves 2–5 out of their band, so they aim elsewhere now.

## The convoy

The map's own convoy (rule `m-convoy`, `m-shape-convoy`): **flow step 3 (a ship every 2.8 s) in a Spread**, one ship at a time across the river, no command. The fork's switch stays what it is, a tap on the buoy: the map's own way to steer.

Why not the campaign's schedule (step 1, Pairs) as the Battery and the Rigs: on the Delta it more than doubled the bot's losses with the encounters off (24 seeds, tough: 13.1 ships lost in waves 1–10 against 4.7 on the card as it was), because the "you" bot plays the campaign at flow 3–4 in a Spread or a Box (its fit to the player's runs), so the shared waves' fire was spread over two to three times as many hulls. Step 3 in a Spread is that habit made the map's shape: heavy traffic down a river delta, never bunched in pairs.

## The signature: fire on the branch

The player's round 9: each map gets a threat of its own in waves 4–10, tied to its identity and its boss. The Delta's identity is the fork; its boss burns the branches. The signature (`MAP_SIGNATURE.delta`, from wave 4):

- **The wave's new enemies come as Incendiary Missiles** (chapter 4's own enemy, `foe: 'cloud'`, `foeShare: 1`), each in place of the enemy the planner drew (so it takes out of the wave what that one would have, rule `w-budget`);
- each flies, slowly (54 px/s, two hits), **for the mouth of the branch the switch is set to as it leaves** (`clouds: 'switch'`, `branchMouth`: 270 px down the branch past the buoy) and bursts there: a fireball 75 px across burns on the water for 7 s, a hit to every hull inside each 2 s;
- shot down, it bursts where it is, usually far from the lane; thrown, the switch sends the next ships down a branch that is not burning.

The encounters add their own (wave 4's one, wave 6's one, two on waves 7, 9 and 10, one on wave 8), each standing in for one of the wave's own (`replaces.extras.cloud`).

How much of waves 4–10 it is (`tools/v3/combo-sweep/mixwaves.ts`, 8 seeds, the "you" bot drafting for itself, tough):

| | Waves 4–10 | Waves 6–10 | Boss rounds |
| --- | --- | --- | --- |
| Share of the threats that show | 4% | 4% | (the boss is the burning oil, not missiles: 0%) |
| Share of the hits it takes to clear them | **6%** | 6% | – |

Far under the asked quarter (the Rigs 9%, the Sowers 19%, the Battery 25%). An incendiary is one slow missile of two hits, and one or two a wave; what it does is not in the hits it takes but in the fire it leaves and the switch it makes the player throw. More of them (three a wave from wave 6) were not tried: every one also burns a branch, and the early tuning showed fire on the branches the fastest way to a cliff for the bot.

## The counters

- **Counter kit: Seeker Pod, Thermobaric Shell, Cadence Gun.** The ships sail in a Spread, one at a time across the river, so the fire comes at single ships one after another and the convoy is seldom bunched for an area weapon to cover: what pays is picking each threat off far out, the Seeker Pod homing on the slow incendiaries before they reach a branch, the Thermobaric Shell's burst on a string as it closes, the Cadence Gun's steady shots.
- **Off-counter kit: Gravity Well, Tesla Arc, Point Defense.** Area and close-in weapons that wait for bunches the Spread rarely makes.
- Chosen on the bots' kit runs (the bot's taste set to each kit, 32 seeds, the usual Armory, four kits tried): Seeker + Thermobaric + Cadence won 84%, Gravity Well + Tesla + Point Defense 66%, Air Strike + Boomerang + Wild Card 59%, Flak + Gunship Pair + Wild Card 56%; the losses in waves 1–10 were alike (3.5–4.1), the boss rounds made the difference. **The forced singles disagree**: alone, the area weapons rank higher (Gravity Well 6.4, Tesla 6.4, Point Defense 6.8) than the counter kit's (Seeker 7.7, Thermobaric 8.1, Cadence 8.6). The first pick (Gravity Well, Tesla, Point Defense from the singles) lost to the other on every Armory's record report, so it was swapped. Every weapon is in chapter 4's draft. A design note for the bots only: nothing in the game nudges the player towards it.

How they compare (bot reports, 24 seeds, the kit as the bot's taste):

| Armory | Kit | Won | Lost in waves 1–10 (normal / tough) | Boss r1 / r2 / r3 (reached) |
| --- | --- | --- | --- | --- |
| usual (Quick Reload, Damage Control, Stockpile) | counter | **92%** | 3.2 / 3.3 | 0.95 / 1.14 / 1.68 |
| | off-counter | 67% | 3.5 / 3.8 | 0.72 / 0.94 / 1.78 |
| latest (Wide Warhead, Point Defense, Supply Lines) | counter | 33% | 3.7 / **3.8** | 0.30 / 1.75 / 3.20 |
| | off-counter | 33% | 3.9 / 5.0 | 0.39 / 1.72 / 3.11 |
| plating (Quick Reload, Armor Plating, Big Magazine) | counter | **79%** | 3.7 / 4.0 | 0.16 / 1.11 / 1.84 |
| | off-counter | 63% | 4.2 / 5.0 | 0.13 / 0.87 / 2.00 |
| none | counter | 0% | 6.0 / **13.9** | – |
| | off-counter | 0% | 5.9 / 18.2 | – |

The counter kit does better or the same with every Armory: 25 and 16 points more won with the usual and plating sets, and 1.2–4.3 fewer ships lost on the tough runs with the latest set and none. Neither is trivial.

## Loadouts on this map (combo sweep singles)

Each weapon alone, forced at every draft (12 seeds, the player's usual Armory, built at version 54 with the same sim as 57; `npm run v3:combo-sweep -- --stage=singles --maps=delta --out=tools/v3/combo-sweep/results/v54-ch4`). Ships lost over all 13 waves:

- **Strong:** Air Strike 6.0, **Wild Card 6.0** (chapter 4's new weapon), Gravity Well 6.4, Tesla Arc 6.4, Flak 6.8, Point Defense 6.8, Drone Screen 6.9.
- **Middling:** Frigate Escort and Scattergun 7.2, Shrapnel 7.4, Shield 7.5, Gunship Pair 7.6, Seeker 7.7, Orbital Strike and Overdrive 7.8, Full Steam 8.0, Railgun and Thermobaric 8.1, Bomber Wing 8.2, Boomerang 8.4.
- **Weak:** Cadence Gun 8.6, Supply Run alone 8.9, Dual Wield 10.6, the Charge Lance, Focus and Grapnel 11.0, the Laser Cutter (it only cuts) 28.2; the plain gun 10.3. The bot drafting for itself: 7.5 (won 67%).

## Diversity: are the Delta's best kits its own?

Swept the chapter 3 way at version 54 (the same sim as 57): singles on 12 seeds, every pair on 6 (27 weapons: chapter 4 adds the Cadence Gun and the Wild Card), the 6 best pairs with every third weapon on 6, the 10 best kits on 16, the usual Armory; compared with the five chapter 2 maps and the five chapter 3 maps from their last sweeps (`python3 tools/v3/delta/compare.py`; results `tools/v3/combo-sweep/results/v54-ch4`).

| | Result |
| --- | --- |
| Top 5 kits | **Air Strike + Orbital Strike + Wild Card** 5.4, Air Strike + Boomerang + Wild Card 5.8, Boomerang + Drone Screen + Wild Card 5.9, Flak Cannon + Gunship Pair + Wild Card 6.2, Air Strike + Frigate Escort + Shield 6.8 |
| Jaccard of the top-5 kits, against the Island / Behemoth / Needle / Archipelago / Saltgate / Battery / Sowers / Rigs / Black Strait / Dreadnought | **0** against all ten |
| The same, the Delta against itself (two halves of its seeds) | 0.43 |
| #1 kit | in no other rebuilt map's top 5 |
| Best weapon alone | Air Strike 6.0 (with the Wild Card, 6.0); also the best single on the Island, the Behemoth and the Archipelago |
| Rank correlation of the weapons alone, against the ten | 0.59 / 0.66 / 0.30 / 0.67 / 0.49 / 0.65 / 0.65 / 0.63 / 0.63 / 0.80 |
| Air Strike | 1st of 27 alone; in three of the five best kits, the #1 among them |

- **All five of the Delta's best kits are its own** (Jaccard 0 against every rebuilt map), but partly for a reason that is not the map's: four of them hold the **Wild Card**, chapter 4's new weapon, which no earlier map's draft deals.
- **Air Strike is over-dominant here** (rule asked: not over-dominant): best alone and in three of the five best kits, the #1 among them. A question for the player below.
- **Its weapons alone rank most like the Dreadnought's** (0.80) and least like the Needle's (0.30).

## Debuts: "New on Open War"

The planner draws chapter 4's new enemies on the Delta's waves 2–10 as on any chapter 4 map; the Delta's own debut slot (the chapter's second map) is the **Bodyguard Ring** (a heavy cruise missile in its ring of guard drones), on wave 2–3, each first sight with its "New on Open War" card (rule `m-debut-tag`, automatic). From wave 4 the signature turns the wave's new enemies into Incendiary Missiles, so the Bodyguard Ring shows only on waves 2–3. If the Coves (chapter 4's first map, v56) debuts all four of chapter 4's enemies as the Battery did chapter 3's, the Delta brings nothing new. The encounters bring nothing from a later chapter.

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated, with filler on waves 1–6 (strings of two or three drones out of the island's west silo, the far drone silo; wave 1 one late string). From wave 3 **most of the shared waves' shells, and from wave 5 their guided missiles, are the encounters'** (`replaces` at the table's count): a few aimed ones come off the map's own sites, drones in strings of two or three, not aimed, in place of the rest, so a wave sends about what the shared one does. `DELTA_CLIMB` sends 0–14% less on waves 1–10, within ±15% (rule `w-budget`). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | Three ways (`delta-three-ways`) | island west, 3 + 3 drones; north-west, 2 drones late | the lead ship |
| 2 | teach | They read the switch (`delta-read-switch`) | north-west, a shell; island west, 4 drones | the newest ship bound for the switch's branch |
| 3 | teach | Under the bank (`delta-under-bank`) | north bank, 2 shells; fork silo, a guided missile; 4 drones | the ship nearest the bank; the ships coming in |
| 4 | combine | Fire on the branch (`delta-fire-branch`) | island west, an incendiary; a shell each off the north-west and north bank silos; 7 drones | the switch's branch mouth; the ships coming in; the ship nearest the bank |
| 5 | combine | Both ends (`delta-both-ends`) | north-west, a shell; island west, a cluster; island east, a guided missile; 9 drones | the ships coming in; the lead ship |
| 6 | combine | The island between (`delta-island`) | island west, a cluster and an incendiary; island east, a guided missile; north bank, a shell; 11 drones | halfway along; the ship nearest the east silo; the switch's branch |
| 7 | escalate | Lock at the fork (`delta-lock-fork`) | fork silo, a supersonic and a guided missile; two incendiaries 7 s apart; 17 drones | the switch's newest ship; the ships coming in; the switch's branch, twice |
| 8 | escalate | Every branch (`delta-every-branch`) | north bank, 2 shells; island west, a cluster and an incendiary; island east, a guided missile; 19 drones | every branch at once |
| 9 | escalate | Fire and the funnel (`delta-funnel`) | two incendiaries 6 s apart; then a raid at the ships coming in (a guided missile, a shell, drones); 18 drones | the switch's branch, then the one it is thrown to; the ships coming in |
| 10 | climax | The delta burns (`delta-burns`), after the wave's own fire and a 6 s calm | two incendiaries; a raid off the north-west, fork and island silos at the ships coming in; 2 shells at the lead ship; 22 drones | the branch mouths; the ships coming in; the lead ship |

Wave 1 loses 0.04–0.05 ships a run on the record report and the 192-seed read with the usual Armory; with no Armory at all the "you" bot loses 0.075 a run (40 seeds, `tools/v3/delta/wave1.ts`), all to drones: wave 1's encounter fires from the island, the far silo, and the north-west silo's drones only once the ships are past it.

**Wave 10, the climax:** after a 6 s calm, two branches catch fire while the raid comes at the ships coming in; the hardest regular wave for the usual Armory (1.08 normal, 1.18 tough), and no step to it doubles the wave before.

## The boss plan: the Burning Delta

The Delta's event was the Escort Run (one heavy cruise missile in three rings of Bodyguard drones, and two swarms), and it cost the bot nothing (0.01 ships a round). The Bodyguard Ring is chapter 4's enemy and the Delta's own debut, so the player meets it as a regular threat on waves 2–3; the boss under encounter rev 4 is new (`DELTA_BOSS_ROUNDS`, lab only; the event's id stays `escort-run`): **the Burning Delta**. Burning oil closes the fork's branches: each burn lights the mouths it will close for 2.5 s first (a red ring and "FIRE" over each mouth), then sets them alight, **the branch the switch is set to first**, then the next in the switch's order, so the convoy funnels into the branch left open; and a raid off every silo comes at the ships bunched on the way in. A ship that sails into the burning mouth takes a hit every 2 s inside it.

| Round | Branches burning | Burn | The raid | Length |
| --- | --- | --- | --- | --- |
| before (every round) | – | – | one heavy in 15 guards, two swarms of 5 | – |
| 1 | 1 | 16 s | 9 drones, 2 guided, a shell | 22 s |
| 2 | 2 | 18 s | 10 drones, a guided missile, a cluster, 2 shells | 24 s |
| 3 | 2, then 2 again 11 s later (the fire moves to the branch that was open) | 12 s each | 11 drones, 2 guided, a cluster, 3 shells | 29 s |

The intro is the shared cards (log v30): "Boss round", "Convoy restored", "The boss: Burning Delta", "Round 1 of 3", then "Round 2 of 3" and "Round 3 of 3". Each round lasts 22–29 s (test, seed 218).

How it reads (192 seeds, normal runs that reached it):

| Armory | Before r1 / r2 / r3 | After r1 / r2 / r3 |
| --- | --- | --- |
| usual | 0.01 / 0.01 / 0.01 | **0.69 / 1.07 / 1.82** |
| latest | 0.00 / 0.00 / 0.00 (44, 44, 36 runs reached it) | **0.31 / 1.69 / 3.27** (121 runs) |
| plating | 0.00 / 0.00 / 0.00 | **0.30 / 0.93 / 1.96** |

Rising for every Armory, under the asked 1.5 / 2 / 2.5 a round for the usual and plating sets, as on every rebuilt map: the convoy is restored before the boss and the loss limit is six, so heavier rounds end the runs that reach them (at 0.91 / 1.91 / 2.42, on an earlier build whose waves were heavier too, the usual Armory won 19%). The latest set's round 3 is over (3.27), the round where the fire moves.

## Bot results, before and after

"Before" is the map card as it was (log v49, the base build): today's convoy controls, no encounters, the Escort Run. "After" is this build. The reads are 192 seeds (900–1091), `python3 tools/v3/delta/read.py --seeds=192 --armory=... [--tough]`; the record reports are 24 seeds (900–923; `npx vite-node tools/v3/map-report/report.ts -- --map=delta --seeds=24 [--armory=player|latest|plating] --kits=plan`).

### The headline (192 seeds, normal runs)

| Armory | Won before → after | Waves 1–5 lost | Waves 1–10 lost | Wave 8 | Wave 10 |
| --- | --- | --- | --- | --- | --- |
| **usual** (Quick Reload 5, Damage Control 4, Stockpile 5) | 55% → **66%** | 0.57 → **0.68** | 3.86 → 3.96 | 0.76 → 0.60 | 1.20 → 1.08 |
| latest (Wide Warhead 5, Point Defense 4, Supply Lines 3) | 15% → **26%** | 0.80 → **0.71** | 4.41 → 4.18 | 1.20 → 0.88 | 1.48 → 0.81 |
| plating (Quick Reload 5, Armor Plating 5, Big Magazine 4) | 25% → **66%** | 0.58 → **0.61** | 3.54 → 3.74 | 0.71 → 0.69 | 1.30 → 0.77 |
| none | 0% → 0% | 2.71 → 2.75 | 4.68 → 5.94 | – | – |

Normal-run curves, waves 1–10 then the boss rounds (runs that reached each):

| Armory | Before | After |
| --- | --- | --- |
| usual | .01 .14 .05 .06 .31 .38 .49 .76 .76 1.20 · boss .01 .01 .01 | .05 .23 .05 .04 .31 .44 .49 .60 .94 1.08 · boss .69 1.07 1.82 |
| latest | .01 .11 .12 .13 .44 .35 .97 1.20 1.18 1.48 · boss .00 .00 .00 | .01 .15 .07 .17 .32 .63 .57 .88 1.04 .81 · boss .31 1.69 3.27 |
| plating | .01 .07 .05 .11 .34 .35 .68 .71 .69 1.30 · boss .00 .00 .00 | .02 .10 .07 .10 .32 .53 .60 .69 .86 .77 · boss .30 .93 1.96 |

Tough-run curves (every seed plays every wave; the cliff check), 192 seeds. Before: usual .01 .14 .05 .06 .31 .40 .52 .82 .85 1.57; latest .01 .11 .12 .17 .51 .53 1.41 2.15 2.74 3.90; plating .01 .07 .05 .11 .34 .39 .78 .95 1.26 2.24. After: usual .05 .23 .05 .04 .32 .45 .51 .67 1.11 1.18; latest .01 .15 .07 .17 .33 .65 .68 1.07 1.62 1.42; plating .02 .10 .07 .10 .32 .55 .69 .94 1.16 1.08. **No step doubles on 192 seeds** for any of the three player Armories (the largest: 1.66× on wave 9 for the usual set, 1.51× for the latest, 1.72× on wave 6 for the plating set; a wave under 0.25 counts as 0.25, as the report counts it).

### The record reports (24 seeds, 900–923)

| | After latest / plating / usual / none |
| --- | --- |
| Won (normal) | 33% / 63% / **79%** / 0% |
| Waves 1–5 lost (normal) | 0.67 / 0.58 / 0.25 / 1.96 |
| Waves 1–10 lost (normal) | 3.7 / 3.6 / 3.8 / 5.9 |
| Boss r1 / r2 / r3 (normal, reached) | 0.17 / 1.78 / 3.11 (18); 0.20 / 1.00 / 2.07 (15); 0.74 / 1.16 / 1.89 (19); – |
| `w-cliff` (tough) | PASS; FLAG (w6 0.33 → 0.71, w9 0.50 → 1.13: 24 seeds; on 192 no step doubles); PASS; PASS |
| `w-early` close calls from w3 | PASS (fewest 1.5–2.4 a run on wave 3) |
| `w-budget` ±15% | **FLAG** (wave 6, ×0.75–0.77 of the wave with no layer; below) |
| `m-stretches` | FLAG (hot middle 41–45% on the north and middle lanes, hot early 43–55% on the south; cold late 21–27%, the north lane's cold early 28% with the usual and plating sets) |
| `g-warning` | PASS: 8.9 → 4.6–4.7 s |
| `w-first` | PASS (0.00–0.04 a run) |

The 24-seed record and the 192-seed reads disagree by up to 13 points on a win rate (usual: 79% against 66%); the larger read is the one to trust.

### Delta difficulty (rule `m-difficulty`; the brief: win 50–70%, waves 1–5 0.4–0.8)

- **The usual Armory wins 66%**, in the band (before 55%, but a flat map with a boss of nothing). **The plating set 66%**, in it too (before 25%). **The latest set 26%**, under it (before 15%; the Battery's 28%, the Rigs' 40%), its round 3 the wall.
- **Waves 1–5:** 0.68 for the usual Armory, 0.61 plating, 0.71 latest: all in the band.
- **The climb from wave 4 to 9** rises for every Armory (usual .04 .31 .44 .49 .60 .94), no single-wave cliff; wave 10 the climax for the usual set (1.08).
- **Early waves are light but not empty:** wave 2 carries the Bodyguard Ring's debut (its heavy is most of wave 2's 0.23), waves 3–4 lose little (0.04–0.05); the filler keeps them busy.
- **The mechanic:** the bots throw the switch off a burning branch at once; the south branch is no longer free (the switch's incendiaries follow it, and the boss burns whichever branch the switch is set to).

## What is not satisfied, or uncertain

- **Air Strike is over-dominant on the Delta**: best weapon alone and in three of the five best kits, the #1 among them. The other best kits lean on the Wild Card, chapter 4's new weapon, which is why the Jaccard against every earlier map is 0.
- **The counter kit comes from the kit runs, not the singles**: forced alone, the off-counter's area weapons rank higher; with the bot's taste set to each kit, Seeker + Thermobaric + Cadence won 84% against 66%. The two measures disagree; the kit runs measure what the rule asks.
- **The bot report's `w-budget` flags wave 6 (×0.75–0.77 of the wave with encounters off)**: the report compares with the wave with no layer, whose new enemies are the planner's own (a Bodyguard Ring and its guards count as several launches), where from wave 4 the signature sends one incendiary in their place. Against the shared wave on the same dice (`tools/v3/delta/budget.ts`) every wave is within ×0.98–1.05.
- **The convoy is the Spread at flow step 3**, not the campaign's step 1 in Pairs: a lever the other rebuilds did not pull, and a big one here (at step 1 in Pairs the encounters-off waves cost the bot more than twice the ships).
- **The latest set's boss round 3 is 3.27 ships** (normal, 121 runs reached it), and it wins 26%. As on the Battery and the Rigs, no single tuning puts all three Armories in 50–70%.
- **The boss is under 1.5 / 2 / 2.5** for the usual Armory (0.69 / 1.07 / 1.82), to keep its win rate in the band.
- **The danger stretch is the carrier's own** (the middle third, past the fork), against rule `m-carrier`, as on the Rigs and the Sowers; and the safe late third takes 26% (the line is 25%).
- **The Bodyguard Ring shows only on waves 2–3** (the signature takes the wave's new enemies from wave 4); and if the Coves debuts every chapter 4 enemy, the Delta brings no debut of its own.
- **The bots throw the switch faster on fire** (`quieterBranch`, `bot.ts`, `mimic.ts`): a bot change that also reaches campaign bot runs on the Delta (no player's game). Whether the player reads the burning branch in time on the phone is the playtest's question.
- **Fire is shared with a later map:** the Tide's boss is the Firestorm (incendiaries from every side). The Delta's boss is burning oil across the branches, not firebombs, but when the Tide is rebuilt the two should stay apart.

## The play log (v57)

`LOG_VERSION` 57, `LOG_REPLAYS` `[57]` (`src/v3/sim/playlog.ts`; 55 and 56 are the chapter 3 notes and the Coves, built alongside). The change is lab only, under the encounter layer: the campaign plays as at the version before for every player (only the bots' switch reacts to fire), and a Delta card log before v57 played today's convoy controls and the shared waves (it no longer replays to the same game). The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 57 (`python3 tools/v3/playtest-fixes/pins.py`, and `tests/v3/scorecard.test.ts`). The Test Lab's "Ready to test" lists the Delta at v57. The combo sweep's results are in `tools/v3/combo-sweep/results/v54-ch4` (swept at 54, the same sim).

## Questions for the player

- **Does the switch feel like a choice now?** The enemy fires at the branch it is set to, and its incendiaries burn that branch's mouth. Recommended: play waves 2, 4, 7 and 9 and say whether you throw the switch because of what you see, or just to dodge. If it feels like chasing, the incendiaries could aim at the branch the most ships are on instead.
- **Can you read the burning branch and its warning on the phone?** A burn is a red ring and "FIRE" over the mouth for 2.5 s, then a fireball 75 px across on the water. Recommended: play the boss; if the warning is missed, it can light longer or add a "BRANCH BURNING" call-out.
- **Air Strike is the Delta's best weapon** (alone and in three of its five best kits). Recommended: leave it for this map (it is one map in five), and look at Air Strike across chapter 4 once the other maps are rebuilt.
- **The convoy in a Spread at flow 3** (heavy traffic, one ship at a time across the river). Recommended: keep; say if it looks too busy on the phone.
- **The boss: the Burning Delta, a new boss on the Escort Run's slot.** The Bodyguard Ring is the Delta's own debut on waves 2–3, so the boss is the fork itself burning. Recommended: keep the name "Burning Delta".
- **The latest Armory set wins 26%** (round 3 of the boss is its wall). Recommended: leave it, as on the Battery and the Rigs; it is the Armory, not the map.

## Checks run

`tsc`; `vitest --exclude '.claude/**'` (81 files, 1903 tests, all pass); `vite build`, then `vite preview` and the e2e scripts `v3.mjs`, `v3-map-cards.mjs`, `v3-encounters.mjs`, `v3-map-lab.mjs`, `v3-convoy.mjs` (all pass); the map-lab baseline replays exactly. Run on the merged base (round 15 notes, log v55).

## Tests

- `tests/v3/encounters.test.ts`:
  - the ten listed, rev 4, v1 only, none at rev 3; `REBUILT_MAPS` has the Delta;
  - the legality check: an Incendiary Missile out of a base on a map whose signature is the incendiary, from its first wave; the budget, warning and replay checks cover the map;
  - the mechanic is in the waves: a beat at the switch's branch in waves 2, 4 and 6–10, incendiaries at the switch in 4 and 6–10;
  - the Burning Delta's rounds: no heavy and no guard, the raid, more branches burning and more of the raid each round, every burn lit 2.5 s first; a rev 3 log and the campaign play the Escort Run; 15–30 s a round (seed 218); the boss's name "Burning Delta" under the layer, "Escort Run" before it; a burn lights the switch's branch mouth, then burns it, the other branches open, and the bots' `quieterBranch` turns away from it;
  - the signature: from wave 4 every new enemy the wave sends is an incendiary aimed at the switch; the campaign and the shared wave aim nothing at the switch; none before wave 4, before rev 4 or on the shared wave; an incendiary at the switch flies for the branch's mouth and bursts there, and thrown, the switch sends the next ships to a branch that is not burning;
  - the filler: waves 1–6, all out of the island's west silo, wave 1 one string.
- `tests/v3/mapRules.test.ts`: no repeats and no gaps; `MAP_PLANS` complete; the boss target is 2; the notes name the silos they fire from.
- `tests/v3/mapCards.test.ts`, `round11.test.ts`, `convoy.test.ts`: the production setup is policy D with the encounters and no command ("The map's own convoy (no commands) · encounters v1 Original"), the convoy flow 3 in a Spread. `tests/v3/round12fixes.test.ts`: wave 1 opens with three, three and two drones, and loses no ship (seeds 11–13, "you" and casual).
- `tests/v3/readyToTest.test.ts`: the new entry. `tests/v3/scorecard.test.ts`: the log is version 57.
- `e2e/v3-map-cards.mjs`: the hub card says so, and the bare link opens the full map. `e2e/v3-encounters.mjs`: the card opens with its encounters and no command, the pause screen's script names "Three ways" and the Burning Delta, and skipped to the boss, a branch burns at its mouth while the raid comes down the river (a shot at one pixel a point: `e2e/shots/v3-encounters/delta-boss.png`).

## What to look for when you play

The river forks three ways at the buoy; tap it to send the next ships north (under the enemy bank), middle (past your carrier) or south (out of reach). The enemy watches where you send them: it fires at that branch, and from wave 4 slow firebombs fly for its mouth and burst there, a fire on the water where the next ships would sail. Shoot them far out, or throw the switch and send the ships round. Wave 9 burns two branches. In the boss rounds burning oil closes the branch the switch is set to (then two, then the fire moves), its mouth marked "FIRE" first, while a raid comes at the ships on the way in. The questions: does the switch feel like a real choice, can you read the burning branches on the phone, and do the three boss rounds rise?

(This section names no weapon to try: the counter kit above is a design note for the bots, never shown in the game or on the hub.)
