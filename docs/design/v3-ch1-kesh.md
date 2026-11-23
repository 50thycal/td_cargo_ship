# The Kesh Hook: map card (map rebuild, chapter 1)

**Date:** 2026-11-18. The Kesh Hook (`kesh`, chapter 1, the 2nd map) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), after the three reference maps (`docs/design/v3-p4-*.md`). Encounter rev 4; play log v28.

Code:
- `src/v3/data/encounters.ts`: `KESH_R4` (ten encounters), `MAP_BOSS.kesh`, `REBUILT_MAPS`;
- `src/v3/data/mapPlans.ts`: `MAP_PLANS.kesh`;
- `src/v3/data/convoy.ts`: `MAP_CONVOY.kesh` (the map's own convoy, no command);
- `src/v3/sim/game.ts`: two new aims for an encounter's launch, `near` and `mid` (`aimBeat`);
- `src/v3/sim/events.ts`: the Drone Storm reads its rounds from `MAP_BOSS` (`bossRound`).

Bot reports: `tools/v3/map-report/results/kesh.md` (baseline, no Armory) and `kesh-player.md` (the player's Armory), each with its heat map.

## The problem

> Every ship rounds the hook hard against the enemy's outer bank: at the apex of the turn the convoy bunches and passes right under the south silo, where the warning is shortest; once round, it sails out under the carrier's guns.

The hook is a shape, not a mechanic (rule `m-mechanic`: Kesh has none). The maps plan's decision for the bend was "guard the apex where ships turn and bunch".

## Sites and their jobs

Bases and spots are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| South silo (base 1) | Outer bank, under the apex (1150, 805) | drones, shells | The map's signature: the shortest flights on the map, onto the ships in the turn. Wave 1's first look, and the apex in waves 3–6 and 9–10. |
| East silo (base 2) | Outer bank, east of the turn (1510, 560) | drones, guided, supersonic | The long reach: its swarm crosses the whole hook to the ships coming in (w2), its missiles go at the ship in the turn (w6–9) or the ships on the straight (w5), and the lead ship in the climax. |
| North-east silo (base 3) | Outer bank, over the way out (1500, 190) | shells, heavies | Quiet until wave 8, so the way out stays the safe stretch; shells into the turn on wave 8 and at the lead ship in the climax. |
| Sub spot inside the hook (spot 1) | (1075, 300), on the carrier's side of the lane | sub salvos | Fire from inside the turn: w4 and w6, aimed at the apex. |
| Sub spot on the straight (spot 2) | (190, 572) | sub salvos | The shared waves' own only. |
| Coast road, two pop-up roads, the air line | Outer bank; the west edge | trucks, strafers, bombers | The shared waves' own (trucks from w2, strafers from w5, bombers from w7); the jet round the hook in w7. |

Warning time falls from 12.1 s on wave 1 to 3.5 s on wave 10 (−0.91 s a wave, rule `g-warning`).

## The stretches

The bot report cuts the lane into thirds by distance along it (about 1,800 px: the straight, the turn, the way out north).

- **Danger: the middle**, the apex of the turn. It takes 44% of the hull damage in waves 1–9 (both reports).
- **Safe: the late third**, the way out north under the carrier: 24% without the Armory (passes), **26% with the player's Armory (flags, just over the 25% the rule allows)**. See "What is not satisfied".

Two new aims put the encounters' fire on the apex:
- `near`: the ship nearest the launcher as it fires. From the south silo, that is the ship rounding the apex.
- `mid`: the ship nearest halfway along its lane, wherever it is fired from (on Kesh, the start of the turn).

## The convoy

The map's own convoy, no command (rule `m-convoy`): pairs at the reference maps' schedule (`MAP_CONVOY.kesh`: flow 2, pairs). The lane does the shaping: the turn brings every pair past the south silo one after another before it straightens out under the carrier. The map card now opens on policy D with the encounters on, like the reference maps (it opened on today's convoy controls and no encounters).

## The counters

- **Counter kit:** Overdrive, Railgun, Focus. The apex's fire comes from close, at short warning, onto ships bunched in the turn: fast aimed taps meet it, and the Railgun's line runs through the bunch.
- **Off-counter kit:** Air Strike, Seeker Pod, Drone Screen. They fire themselves and spread over the whole hook.

Chosen from six kits on 16 seeds with the player's Armory, during tuning (won, ships lost in waves 1–10, normal runs): aimed 69% and 3.8; blast (Shrapnel, Thermobaric, Flak) 69% and 4.1; Point Defense, Seeker, Drone Screen 62% and 4.4; the Strait's area kit, self-firing and Scattergun-Railgun-Overdrive all 56% and 4.25. On the final report the counter kit does better on every measure, but not by much (table below).

## The debut

None. Every chapter 1 enemy (Sprint Drones, Hydra, Rocket Truck) debuts on the Strait (`debuts()` in `src/v3/data/mapRules.ts`, and `DEBUT_SLOTS[1]` gives Kesh none). Nothing from a later chapter: the encounters send only drones, shells, guided missiles and a strafer, all in the map's table by their waves (`tests/v3/encounters.test.ts`).

## The mechanic

None: the hook is a shape. No encounter aims at a structure (the test checks it).

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated. What an encounter sends comes out of the wave's drones and guided missiles (Harbor Mouth's lesson: never its shells). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | Into the turn (`kesh-first-turn`) | south silo, 3 drones | the ship in the turn |
| 2 | teach | Across the hook (`kesh-long-reach`) | east silo, 5 drones; south silo, 1 shell | the ship coming in (the longest warning); the turn |
| 3 | first stakes | Shells at the apex (`kesh-apex-shells`) | south silo, 2 shells, then 4 drones | the turn; any ship |
| 4 | first stakes | Periscope in the hook (`kesh-hook-periscope`) | sub inside the hook, 3 shells; south silo, 4 drones | the apex from both banks |
| 5 | combine | Front and back (`kesh-two-banks`) | south silo, 5 drones and a shell; east silo, 2 guided | the turn / the ships on the straight |
| 6 | combine | Bunched in the turn (`kesh-bunch`) | south silo, 5 drones and 2 shells; sub inside the hook, 2 shells | the turn, from both banks |
| 7 | escalate | Strafing the hook (`kesh-strafe-the-turn`) | a jet from the west round the hook; south silo, 4 drones; east silo, 2 guided | the lane; the apex |
| 8 | escalate | The whole outer bank (`kesh-outer-bank`) | south, east, north-east in turn: 4 drones, 4 drones, 2 shells | any ship; the apex |
| 9 | escalate | Crossfire in the turn (`kesh-crossfire`) | south silo, 6 drones and 3 shells; east silo, 2 guided | the apex from south and east |
| 10 | climax | Round the hook (`kesh-round-the-hook`), `calm: 5` | south and east swarms; 2 guided and 2 north-east shells at the lead ship; 2 south shells at the turn | the turn and the way out |

Wave 1 loses no ship (both reports; and the round 12 test, "you" and "casual", seeds 11–13).

## The boss plan: the Drone Storm round the hook

The Drone Storm is Kesh's own event: twelve plain drone swarms off the outer bank in turn, no ammo drops. It cost the player and the bot nothing (0 ships in 3 and 18 rounds, `docs/design/v3-bot-refit.md`); with the player's Armory the bot lost 0 / 0.17 / 0.04.

Under encounter rev 4 (`MAP_BOSS.kesh.rounds`, lab only: the campaign plays the event as it was):

| Round | Swarms | Drones (size) | Second half after |
| --- | --- | --- | --- |
| before (every round) | 12 | 30 (2.5) | 7 s |
| 1 | 12 | 33 (2.75) | 6 s |
| 2 | 12 | 36 (3) | 6 s |
| 3 | 12 | 36 (3) | 5.5 s |

Rounds 2 and 3 differ only in timing; round 3 also rises because the ships carry rounds 1–2's damage. The target is a ship a round on the bot's scale (`botTarget: 1`; on Kesh the bot and the player both lost 0 a round, so no bias is known). Each round lasts 15–30 s (test).

## Bot results, before and after (24 seeds, 900–923)

"Before" is the map card as it was: today's convoy controls, no encounters, the event as it was (no kits). "After" is this build. Commands: `npm run v3:map-report -- --map=kesh --seeds=24 --kits=plan [--armory=player]`.

### The player's Armory (the "good player")

| | Before | After |
| --- | --- | --- |
| Won (normal) | 96% | **75%** |
| Mean end wave | 13.8 | 13.2 |
| Ships lost in waves 1–10 (normal) | 0.5 | 3.7 |
| Ships lost in waves 1–5 (normal) | 0.04 | 0.50 |
| Ships lost in a won run, all 13 waves | – | 5.8 (3–10) |
| Boss r1 / r2 / r3 (normal, reached) | 0.00 / 0.17 / 0.04 | 0.60 / 1.30 / 1.26 |
| Boss r1 / r2 / r3 (tough) | 0.00 / 0.17 / 0.04 | 0.63 / 1.17 / 1.50 |
| Tough curve 1–10 | 0 0 0 0 .04 0 0 .13 0 .33 | 0 0 .08 .17 .25 .21 .54 .54 .83 1.17 |
| `w-cliff` | PASS | **FLAG**: w7 0.21 → 0.54 (one sinking over the line) |
| `w-early` close calls from w3 | PASS (fewest w4 1.17) | PASS (fewest w3 1.67) |
| `w-budget` | PASS | PASS (furthest w7 ×0.90) |
| `m-stretches` | **FLAG**: hot early 35%, cold late 31% | **FLAG**: hot middle 44%, cold late 26% |
| `g-warning` | PASS: 14.5 → 3.8 s | PASS: 12.1 → 3.5 s |
| `w-first` | PASS | PASS |
| Kits (won; end wave; lost 1–10 normal / tough) | – | counter 58%, 12.8, 3.8 / 4.1; off-counter 54%, 12.6, 4.0 / 4.3 |

### Baseline (no Armory)

| | Before | After |
| --- | --- | --- |
| Won (normal) | 67% | 4% |
| Ships lost in waves 1–10 (normal) | 2.3 | 5.4 |
| Ships lost in waves 1–5 (normal) | 0.21 | 0.67 |
| Boss r1 / r2 / r3 (tough) | 0.42 / 0.96 / 1.29 | 1.92 / 3.79 / 4.08 |
| Tough curve 1–10 | 0 0 0 0 .21 .04 .33 .13 .63 2.00 | 0 0 .25 .13 .29 .50 1.38 1.58 1.96 2.29 |
| `w-cliff` | **FLAG**: w9, w10 | **FLAG**: w7 0.50 → 1.38 |
| `w-budget` | PASS | PASS |
| `m-stretches` | **FLAG**: cold late 29% | PASS: hot middle 44%, cold late 24% |
| `g-warning`, `w-first`, `w-early` | PASS | PASS |
| Kits (lost 1–10 tough) | – | counter 9.5, off-counter 8.5 |

The baseline is now as hard as the reference maps' (the Strait 4%, Harbor 0%). It stands in for a player with no upgrades; the encounters are lab only, so the campaign's Kesh, where a player arrives with few upgrades, is unchanged.

**Chapter 1 difficulty (rule `m-difficulty`).** With the player's Armory the bot wins 75% (the reference maps: 25–54%), and a won run loses 5.8 ships over the whole map (3–10; waves 1–10 alone, 3.7). That is the top of the 50–75% aimed for, and Kesh is the free-trial map, the easiest of the chapter.

## Fun measures (provisional, `src/v3/sim/funMetrics.ts`)

From `kesh-player.md`:
- **Tension rises from wave 1:** its peak is 0.04, 0.36, 0.54 on waves 1–3, then about 1 from wave 4 (the reference maps are flat on waves 1–3). So the apex bites from wave 3.
- **Saves:** 0.2–0.5 a wave on waves 6–10 (within the provisional 0.3–0.5), none on waves 1–3. In the boss rounds, 0.1 / 0.2 / 0.4 a round, under the "about 1 a round" target: the Drone Storm makes damage more than close calls.

## The play log (v28)

`LOG_VERSION` is 28 (`LOG_REPLAYS` is `[28]`), for Kesh and Marrow together (`src/v3/sim/playlog.ts`). A Kesh or Marrow map card now plays its encounters (rev 4), the new aims and the boss tuning. A v28 Kesh log needs this build: an older one would play its encounters as nothing. All of it is lab only, under the encounter layer. A v27 log played none of it: those maps had no layer, and nothing else changed. The map-lab baseline's twelve runs differed only in their log version, and it was rewritten with `--write`. The version pins in the tests and e2e scripts moved to 28.

## Tests

- `tests/v3/encounters.test.ts`:
  - the ten listed, rev 4, v1 only, none at rev 3;
  - the budget, legality, warning and replay checks now cover Kesh;
  - the south silo's shells go at the ship nearest it;
  - no encounter aims at a structure;
  - the Drone Storm's rounds: 33 / 36 / 36 drones; a rev 3 log and the campaign are unchanged; 15–30 s a round.
- `tests/v3/mapRules.test.ts`:
  - no repeats and no gaps;
  - `MAP_PLANS` complete for every map with encounters.
- `tests/v3/round12fixes.test.ts`: wave 1 is its own encounter, 3 drones, no ship lost.
- `tests/v3/mapCards.test.ts`, `round11.test.ts`, `convoy.test.ts`: the production setup is policy D with the encounters.
- `e2e/v3-map-cards.mjs`:
  - the hub card says so;
  - `?lab=map-kesh` opens the full map with encounters rev 4 and no command.

## What is not satisfied, or uncertain

- **Two flags with the player's Armory.** Both are close to the line, and both moved from run to run while tuning: every change upstream reshuffles the bot's drafts.
  - **The late stretch takes 26% (rule: under 25%).** The late third gets damage that encounters cannot reach: the shared waves' strafers (a quarter of all hull damage on this map) and the Hydras' darts. The aims already put 44% on the apex.
  - I tried moving the west sub spot into the turn (geometry). It made the early third hotter, so I put it back.
  - Over 48 seeds the late third ran 26–29%. Without the Armory it passes (24%).
- **The wave 7 step.** The shared table steps up on wave 7: bombers arrive, and guided missiles go from 2 to 4. With the Armory, wave 7 is one sinking over the cliff line (0.21 → 0.54). Without it, 0.50 → 1.38.
- **Kits.** The counter kit is better on every measure with the Armory, but by little (58% against 54%). With no Armory the off-counter loses less. As on every map, the bot's kit is only its draft taste.
- **Boss rounds 2 and 3** send the same 36 drones; round 3 rises only by timing and by the damage the ships carry in. The bot reads them at 1.3 a round.

## After the playtest (log v29, 2026-11-19)

The player played the Kesh map card (log v28, `v3-20261118105818-35190`; review `tools/v3/map-rules/review-2026-11-19.json`): won, 4 ships lost, fun 4, difficulty "bit easy", boss 3, "keep". Their note: "Overall map was about good difficulty wise but the boss was way too much easy at least for me." Measured on the v28 build it was played on: `tools/v3/bot-fit/results/ch1-playtest-2026-11-19.json` (`tools/v3/bot-fit/playtest.ts`).

### The player against the bot

Ships lost per wave (the review file's `lostByWave` is cumulative; these are per wave):

| | Waves 1–7 | 8 | 9 | 10 | Waves 1–10 | B1 / B2 / B3 |
| --- | --- | --- | --- | --- | --- | --- |
| The player | 0 | 1 | 0 | 2 | 3 | 0 / 0 / 1 |
| The bot on the player's seed, Armory and picks (12 dice) | 0.33 | 0.50 | 0.83 | 0.75 | 3.0 | 0.25 / 1.25 / 1.00 |
| The map card's prediction (24 seeds) | | | | | 3.7 | 0.60 / 1.30 / 1.26 |

Waves 1–10 match (3 against 3.0 on the same seed). The boss rounds read about 2.5× as hard on the bot as for the player (0.83 a round against 0.33), the recorded bias (`docs/design/v3-bot-refit.md`) and then some.

**Fun measures on the player's run** (3 rolls a fork):
- Saves: two, both clutch last-second kills of a drone (wave 10 at 44.4 s, 0.85 s from impact; B2 at 8.3 s, 0.98 s), neither with stakes.
- Tension: flat on waves 1–7 (peaks 0.02–0.67), one peak on waves 8 and 9 (1.0–1.1), a sawtooth on wave 10 (peak 2.04 at 43 s), and the boss rounds hot 24–39% of the time (B2 and B3 pinned).
- **Best moment** (wave 10, 35.7 s) is the wave with the run's highest peak, but not its second: the reading there is 0.0, between a small peak at 33 s and the wave's top at 42–45 s; the save is at 44.4 s. So it matches by wave, a few seconds early by second. The player also wrote that the strip is "still hard to recall what happened, so not a great stat". The other agent's per-wave rating is the better answer.

### Bug: "Frigates are a little jittery on the turn" (step 12067)

Found on the replay: on its way to its station round the hook (wave 5, 45 s), a frigate's bow flicked about 2.5° left and right every step, and it stepped in and out a pixel or two each step. Three causes, on a bent lane only:
- the lane is a polyline: offset 100+ px across it, the frigate's spot jumped at each corner (outside the bend) or doubled back (inside it), and its heading snapped by the corner's angle;
- the track it steers for is sampled every 10 px, and it chased each sample;
- giving way to a hull, it stepped out one step and back onto its track the next.

Fix (`sailLane` in `src/v3/sim/game.ts`): its spot is the lane's averaged over 40 px either side (`escortAt`, the same on a straight); its step across is eased from the last one; once it has stepped out for a hull it holds that offset 0.6 s; and its bow eases onto its aim over 0.1 s (never faster than before). Measured with the convoy sailing and no enemy (`tests/v3/frigateJitter.test.ts`): heading flips 27 / 39 / 71 a minute → about 1 / 1 / 3 (three set-ups), wobble 2.7 / 3.9 / 7.1 → 0.3 / 0.4 / 0.7 °/s. Harbor Mouth's bend improves too (30 → 2 flips a minute); straight lanes are unchanged. `frigateOverlap.test.ts` still passes on every map (no hull overlaps, no land).

### Not a bug: "the nuke should not clear out the players passive weapons" (step 23976)

The Nuke takes only the enemy's threats, launchers, marks and shots (`nuke()` and `nukeFoes`); it never touches frigates, Aegis launchers, Drone Screen drones, Seeker or Gunship units, flak clouds, the Well, the Decoy or anything else of the player's. What the player saw: at wave 8, 55.0 s (step 23913) they grabbed a nuke with one shell left on the board, 0.6 s from a ship. That was the wave's last threat, so the wave ended on that step, and **every wave's end unloads the weapon in hand** (`clearField`): the two frigates (Frigate level 3, loaded) sailed off at once. The note was written a second into wave 9. A test now pins it: mid-wave, a nuke leaves Frigates, Aegis and Gunships loaded and on the water (`tests/v3/nuke.test.ts`).

If the player wants weapons to carry over a wave's end, that is a separate rule change (a question on the hub).

### The boss: harder (log v29)

The Drone Storm sent only drones, and with no ammo drops the player's Aegis and Scattergun ate them. Now shells and guided missiles ride with the swarms, more each round, so round 3 is harder by what it sends (`KESH_BOSS_ROUNDS` in `src/v3/data/encounters.ts`; a shell at the ship nearest its silo, a guided missile at the ship halfway along; `sim/events.ts`):

| Round | Drones (swarms × size) | Second half after | Shells | Guided |
| --- | --- | --- | --- | --- |
| before (v28) | 33 / 36 / 36 (12 × 2.75, 3, 3) | 6 / 6 / 5.5 s | 0 | 0 |
| 1 | 36 (12 × 3) | 6 s | 3 (from 3 s, 4 s apart) | 0 |
| 2 | 36 (12 × 3) | 6 s | 2 (from 3 s, 5 s apart) | 1 (at 7 s) |
| 3 | 42 (14 × 3) | 5.5 s | 3 (from 3 s, 4 s apart) | 3 (from 5 s, 3 s apart) |

`MAP_PLANS.kesh.boss.botTarget` is now 2. Bot, the player's Armory, 24 seeds, `--kits=plan`:

| | v28 | v29 |
| --- | --- | --- |
| Boss r1 / r2 / r3 (normal, reached) | 0.60 / 1.30 / 1.26 (20 / 20 / 19 runs) | **1.20 / 2.35 / 2.73** (20 / 20 / 15) |
| Boss r1 / r2 / r3 (tough) | 0.63 / 1.17 / 1.50 | 1.25 / 2.33 / 5.00 |
| Won (normal) | 75% | **13%** |
| Ships lost in waves 1–10 | 3.7 | 3.8 (unchanged by design) |

Tuned on three tries (r1 / r2 / r3 on the bot): shells 2 / 3 + 2 guided / 4 + 4 guided read 1.35 / 3.50 / 2.75; 2 / 2 + 1 / 3 + 2 read 0.90 / 2.25 / 1.71; the table's reads 1.20 / 2.35 / 2.73, close to the 1.5 / 2 / 2.5 asked. At the bot's 2.5× bias that is about 0.5 / 0.9 / 1.1 for the player, near a ship a round.

**Read this with care:** 1.5 + 2 + 2.5 is the whole loss limit (6) after the restore, so the bot now wins only 13% of normal runs (75% before), well under rule `m-difficulty`'s 50–75%. That is the bot's bias, not the player's expected result, but the player should know the target trades the bot's win rate away.

Without the Armory (baseline): boss tough 1.92 / 3.79 / 4.08 → 2.83 / 4.50 / 6.63, won 4% → 0%; waves 1–10 unchanged (5.4).

Waves 1–10 are as they were (every check reads as before: `w-cliff` FLAG on w7 by one sinking, `m-stretches` FLAG at 26%, the rest PASS). Fun (player Armory): saves a run 0.5 / 0.8 / 0.7 in the boss rounds (0.1 / 0.2 / 0.4 before), tension peaks 1.57 / 2.23 / 3.31, hot 21% / 43% / 51%.

### The boss intro (every map)

See `docs/design/v3-ch1-marrow.md`, "After the playtest": the first boss round now opens 5 s later (`EVENT.bossCalm`), with one banner naming the boss, the rounds to survive and the ships that can still be lost.

### The play log (v29)

`LOG_VERSION` 29, `LOG_REPLAYS` `[29]` (`src/v3/sim/playlog.ts`): the radar (campaign and lab), the Drone Storm (lab, encounter rev 4), the boss calm (every map's three-run ending) and the frigates change the game. The map-lab baseline differed on all 12 runs (state on the runs that reach a boss round or use frigates; the rest by version and content hash) and was rewritten with `--write`; it replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 29. The player's v28 logs no longer replay here; their measures were taken on the v28 build first.

Reports: `tools/v3/map-report/results/kesh.md` and `kesh-player.md`.

## After the v29 replay (log v30, 2026-11-19)

The player replayed Kesh on log v29 (`v3-20261119202157-1083`; review `tools/v3/map-rules/review-2026-11-19-r6.json`): won, ships lost 0 on waves 1–9, 3 on wave 10, boss 1 / 3 / 0 (the harder Drone Storm works: it was 0 / 0 / 1 and "way too easy"; now rated 3, left alone). Fun 3 (was 4), "a bit easy"; waves 3 and 4 rated 1 / 1 / 1 (difficulty, fun, intensity), wave 5 2 / 3 / 2, wave 10 2 / 3 / 2. The read: the total is right, the shape is wrong. Nothing happens for nine waves, then everything lands on wave 10.

### What changed

All lab only (the encounter layer, rev 4 reworked in place):
- **The shared waves' fire moves from the end to the start** (`KESH_CLIMB`, the v1 version's `scale` in `src/v3/data/encounters.ts`): waves 1–10 × 1, 0.9, 1, 1.05, 1.05, 1.08, 1.08, 1.06, 0.93, 0.85. Within ±15% of each wave (rule `w-budget`), never more than the ten (a test checks both).
- **The early encounters sink ships with shells, not drones.** The player's Armory (Point Defense 4) eats drones before they arrive, so a drone swarm makes no tension. Waves 2–9 trade drones for shells at the ship in the turn (`aim: 'near'`), timed to land together:
  - w2: two shells, not one;
  - **w3, the first real threat:** five drones, then three shells from the south silo and two from a sub inside the hook, all on the ship in the turn at once (was two shells then a swarm);
  - w4: three shells from the south silo with the sub's three (was a swarm);
  - w5: four shells (was one); w6: three shells and the sub's two at the same moment;
  - w7: the jet, then two shells, and the two guided missiles later on their own (they came with the swarm);
  - w8: three north-east shells (was two); w9: four shells (was three);
  - **w10, the top of the climb:** the two north-east shells at the lead ship are gone, the east swarm is two drones bigger.

### Before and after (the bot replaying the player's setup)

`tools/v3/bot-fit/curve.ts` (new): the "you" bot mirroring the player's run (same card setup, Armory warhead 5 / Point Defense 4 / drops 3, and the player's draft picks), 24 dice on the player's seed ("mirror") and the same setup on seeds 900–923 ("seeds"). Ships lost per wave over the runs that reached it; tension peak a wave (`src/v3/sim/funMetrics.ts`, no forks); shape: f flat, 1 one peak. Results: `tools/v3/bot-fit/results/ch1-curve-v29.json` (measured on the v29 build) and `ch1-curve-v30.json`.

Ships lost per wave:

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 1–5 | 1–10 | Won |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The player (v29) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 3 | won |
| Mirror, v29 | 0 | 0 | 0 | 0 | .13 | .04 | **1.00** | .50 | .43 | .74 | 0.13 | 2.79 | 88% |
| Mirror, v30 | 0 | 0 | .04 | 0 | 0 | .21 | .21 | .08 | .25 | **.88** | 0.04 | 1.67 | 100% |
| Seeds, v29 | 0 | 0 | 0 | .17 | .13 | .04 | **.50** | .29 | .33 | .74 | 0.29 | 2.17 | 54% |
| Seeds, v30 | 0 | 0 | 0 | 0 | .04 | .13 | .46 | .67 | .52 | .36 | 0.04 | 2.13 | 63% |

Tension peak a wave (shape):

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | First hot wave |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The player (v29) | .05 f | .17 f | .26 f | 1.18 1 | 1.01 1 | .89 1 | .51 f | .49 f | .80 1 | 1.03 s | 4 |
| Mirror, v29 | .04 f | .19 f | .41 f | .98 1 | 1.05 1 | .64 f | 1.04 1 | .83 f | 1.12 1 | 1.31 1 | 4.5 |
| Mirror, v30 | .04 f | .26 f | .62 f | 1.03 1 | 1.17 1 | 1.07 1 | .65 f | .71 f | .92 1 | 1.26 1 | 4.0 |
| Seeds, v29 | .03 f | .18 f | .41 f | .72 f | .66 f | .60 f | .82 1 | .82 f | .93 1 | 1.36 1 | 5.7 |
| Seeds, v30 | .03 f | .28 f | **.94 1** | 1.11 1 | .95 f | .92 1 | .69 f | 1.04 1 | 1.05 1 | 1.39 1 | 3.7 |

The bot report (`npm run v3:map-report -- --map=kesh --seeds=24 --kits=plan --armory=player`; the bot drafts for itself, Armory `PLAYER_ARMORY`):

| | v29 | v30 |
| --- | --- | --- |
| Ships lost per wave 1–10 (normal, reached) | 0 0 .08 .17 .25 .21 .54 .54 .83 1.17 | 0 0 .04 .13 .21 .33 .38 .71 .67 .83 |
| Waves 1–5 / 1–10 | 0.50 / 3.8 | 0.38 / 3.2 |
| Won (normal) | 13% | 21% |
| Tension peak 1–10 | .04 .36 .54 1.02 .79 .91 .80 1.14 1.43 1.72 | .04 .41 **1.22** 1.34 1.03 1.13 .80 1.16 1.24 1.33 |
| Wave 3's shape | flat 79% | **one peak 62%** |
| `w-cliff` | FLAG: w7 0.21 → 0.54 | **PASS** (biggest step w10 +0.42) |
| `m-stretches` | FLAG: cold late 26% | FLAG: cold late 26% |
| `w-budget`, `w-early`, `g-warning`, `w-first` | PASS | PASS (furthest w7 ×0.88) |
| Boss r1 / r2 / r3 (normal, reached) | 1.20 / 2.35 / 2.73 | 0.70 / 2.45 / 2.65 |

Without the Armory (`kesh.md`): won 0% → 0%, waves 1–10 5.4 → 5.5, `w-cliff` FLAG on w7 → FLAG on w6 and w8 (0.63 → 1.92), `m-stretches` PASS (24%).

### What it does, and what it doesn't

- **The first bump comes by wave 3** on the seeds (peak 0.94, one peak in most runs; the bot report 1.22, one peak in 62%). On the player's own seed it reads 0.62: close, not hot. Waves 4–6 are now each a peak; before, waves 5–6 were flat.
- **No cliff.** The wave 7 jump (1.00 on the mirror, the strafer, swarm and missiles together) is gone, and `w-cliff` passes on the bot report for the first time.
- **Waves 1–5 still sink almost nothing** with the player's Armory (0.04 on both mirrors; asked for 0.3–0.6). The early fire is tense but Point Defense 4, Aegis and Scattergun cover it. The bot report, with its own picks and Armory, loses 0.38. Getting the mirror to lose ships early would take more than the ±15% budget allows: it is a question for the player (on the hub) whether early tension without losses is what "make the player act" meant.
- **The mirror on the player's seed is noisy.** Its 24 dice share one draft order, and any change in the waves moves which cards come up. Its waves 6–10 read 0.21, 0.21, 0.08, 0.25, 0.88, with wave 10 more than double wave 9; on 24 other seeds the same setup reads 0.13, 0.46, 0.67, 0.52, 0.36. Pooled (48 runs) it is 0.17, 0.34, 0.38, 0.39, 0.62: a climb with no doubling. Total waves 1–10: 1.67 / 2.13 (2.79 / 2.17 on v29). The player lost 3.

### The boss intro: a sequence of cards (every map)

The player's choice on the hub (`r6-boss-reset`: keep the restore) and their words: "Have it say 'boss round', then 'live reset', then what it is, like 'drone swarm', then 'round one', so each text is like a new card pop up explains all of that in sequence."

- **The cards** (`bossIntroCards` in `src/v3/data/events.ts`; shown by `startBossIntro` / `tickBossIntro` in `src/v3/ui/app.ts`, on the event card in the middle of the field): boss round 1 opens on four cards, one after another, each popping in (`v3-card-pop`, scale 1.6 → 0.94 → 1 in 0.42 s, with a soft tick from the second):
  1. **BOSS ROUND** (red);
  2. **CONVOY RESTORED**, "6 ships can still be lost" (green; with the restore off it reads "2 ships left, can still be lost");
  3. the boss's name, "The boss" above it and its rule chips (e.g. **DRONE STORM**, No ammo drops);
  4. **ROUND 1 OF 3**, "Survive the next 3 rounds".
- Rounds 2 and 3 open on one short card: the boss's name over **ROUND 2 OF 3** (3 s).
- **Timing:** each card holds `EVENT.introCard` (2 s) of game time, so a pause or the speed slider moves the cards with the calm. **The calm is now 6 s** (`EVENT.bossCalm`, 5 s on v29): the breather and the calm are 9 s, the four cards fill 8 s, and the last holds to the first launch.
- The v29 banner ("BOSS: … Survive the next 3 rounds. Convoy restored: …") is gone; the separate CONVOY RESTORED call-out stays folded in.

Screenshots (e2e, the Strait's Afterburner Rush on a phone, 874×402): `docs/design/img/boss-intro/1-boss-round.png`, `2-convoy-restored.png`, `3-the-boss.png`, `4-round-1.png`.

### A fresh verdict sheet on every run

The player, on the Marrow run: "one didn't clear the screen on here and still has my old notes from the previous run". `newVerdictDraft` (`src/v3/ui/lab.ts`) filled the sheet from the card's verdict at this version, so a replay of a card brought back the last run's verdict, tags and note (the Kesh tags "Too easy, Fun" in review r6 were the previous run's). The sheet now starts blank every run; every earlier verdict, this version's too, shows read-only under "Your earlier verdicts" (`earlierEntries`, the newest three).

### The play log (v30)

`LOG_VERSION` 30, `LOG_REPLAYS` `[30]`: Kesh's and Marrow's encounters and wave budgets (lab only) and the 6 s boss calm (every map's three-run ending) change the game. The map-lab baseline differed on all 12 runs (the reference maps' boss rounds open 1 s later, and every run by version) and was rewritten with `--write`; it replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 30. The player's v29 logs no longer replay; their tension and the v29 mirrors were measured on the v29 build first (`ch1-curve-v29.json`).

### Tests

- `tests/v3/encounters.test.ts`: Kesh and Marrow's v1 may carry a wave budget (sum ≤ 10, each within ±15%); the reference maps' v1 still has none; wave 3's apex shells (three from the silo at the ship nearest it, two from the sub).
- `tests/v3/bossIntro.test.ts`: the four cards, their order and text, each held `EVENT.introCard`, the last until the first launch; no restore; rounds 2 and 3 one card.
- `tests/v3/lab.test.ts`: a second run's sheet is blank; the earlier verdict is history.
- `e2e/v3.mjs`: the Strait's round 11 shows the four cards in order, each popping in, nothing launched while they read; rounds 2 and 3 show Round 2 of 3 and Round 3 of 3.
- `e2e/v3-map-cards.mjs`: a second run of the Strait card opens on a blank sheet, the first run's Keep under "Your earlier verdicts".
