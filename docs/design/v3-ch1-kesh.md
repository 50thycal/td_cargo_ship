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
