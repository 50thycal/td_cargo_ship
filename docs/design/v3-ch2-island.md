# The Island: map card (map rebuild, chapter 2)

**Date:** 2026-11-19. The Island (`island`, chapter 2 "The Narrows", the 6th map, the chapter's first) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), after chapter 1's Kesh Hook and Lee of Marrow (`docs/design/v3-ch1-kesh.md`, `v3-ch1-marrow.md`) and with the Behemoth Run (`docs/design/v3-ch2-behemoth.md`). Encounter rev 4; play log v31.

Code:
- `src/v3/data/encounters.ts`: `ISLAND_R4` (ten encounters), `ISLAND_BOSS_ROUNDS` and `MAP_BOSS.island`, `REBUILT_MAPS` (via `CHAPTER_TWO_MAPS`), all in one chapter 2 block;
- `src/v3/data/mapPlans.ts`: `MAP_PLANS.island`;
- `src/v3/data/convoy.ts`: `MAP_CONVOY.island` (the map's own convoy, no command);
- `src/v3/sim/game.ts`: `replaces.extras` (`makeRoom`): an encounter may stand in for one of the map's own extras (supersonic, heavy, cluster);
- `src/v3/sim/events.ts`: the Gunship Wall reads its rounds from `MAP_BOSS` (`gunshipRound`), and a round can add launches of its own (`fire`);
- `src/v3/data/foes.ts` and `src/v3/ui/app.ts`: rule `m-debut-tag` for enemies (`foeDebutTag`): a chapter 2 enemy's first banner reads "NEW · The Narrows: Attack helicopter", as the chapter's new weapon cards do.

Bot reports: `tools/v3/map-report/results/island.md` (no Armory), `island-player.md` (the player's usual Armory, with fun measures and the heat map) and `island-latest.md` (the player's latest Armory: Wide Warhead 5, Point Defense 4, Supply Lines 3; new `--armory=latest`). A quick tuning read: `tools/v3/map-report/quick.ts`.

## The problem

> The enemy island sits between the two lanes: its silos fire on the ships passing it from closer than any shore, with almost no warning, and the fast north lane runs between the island and the far shore, furthest from your carrier.

The island is a shape, not a mechanic (rule `m-mechanic`: the Island has none). Its maps-plan idea is "an enemy island in mid-strait, two lanes"; its "first to bring" is caves and tunnels (the island road and the cave pop-ups), which the shared waves' trucks use.

## Sites and their jobs

Bases and spots are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| Island west silo (base 1) | On the island (540, 362) | drones, guided, cluster | The signature: point-blank swarms at the ship beside it (w1, w3, w5, w6, w8, w9, w10). |
| Island east silo (base 2) | On the island (1060, 362) | drones, shells | Point-blank shells (w3, w6) and the second swarm of the crossfire (w2, w4, w7, w8). |
| Far west silo (base 3) | Far (north) shore (300, 70) | shells, supersonic, heavies | The shared waves' own (the map's supersonic and heavies). |
| Far middle silo (base 4) | Far shore (800, 62) | drones, shells | The north lane's swarm (w2, w9), and the long-warning swarms that fill waves 6–10. |
| Far east silo (base 5) | Far shore (1300, 70) | guided, supersonic, cluster | Missiles over the north lane (w5, w7, w9) and at the lead ship (w10). |
| West sub spot (spot 1) | Off the island's west tip, between the lanes (180, 380) | sub salvos | Both lanes in reach (w4). |
| East sub spot (spot 2) | Off the east tip (1430, 380) | sub salvos | The climax (w10). |
| South-west sub spot (spot 3) | Between the south lane and the carrier (300, 748) | sub salvos | Fire from behind the south lane (w6). |
| Roads, cave pop-ups, air lines | The far shore, the island's south flank | trucks, strafers, bombers | The shared waves' own; the jet down the south lane (w7). |

Warning time falls from 7.3 s on wave 1 to 3.1 s on wave 10 (−0.40 s a wave, rule `g-warning`): the shortest warnings of any rebuilt map.

## The stretches

The bot report cuts each lane into thirds along it (lane 1 the south lane, two groups in three; lane 2 the north lane).

- **Danger: the middle**, alongside the island: 42% of the south lane's hull damage and 53% of the north lane's in waves 1–9 (the player's Armory).
- **Safe:** the north lane's way out east (17%, passes). On the south lane the coldest third is the way in (28%), **over the 25% line** (see "What is not satisfied"). `MAP_PLANS.island.stretches` says danger middle, safe late.

## The convoy

The map's own convoy, no command (rule `m-convoy`): pairs at the reference maps' schedule (`MAP_CONVOY.island`: flow 2, pairs), two groups in three in the wide south lane, the third making a fast run (1.5×) up the narrow north lane between the island and the far shore. The map's two lanes do the shaping. The map card now opens on policy D with the encounters on (it opened on today's convoy controls and no encounters).

## The counters

- **Counter kit: Gravity Well, Drone Screen, Gunship Pair.** The island's fire is swarms from point-blank range onto ships bunched beside it, too close for a shot from the carrier to get there first: helpers that fight on their own over the convoy (the Gunship Pair rockets the thickest cluster; the Drone Screen) and the Well, which pulls a swarm off the lane.
- **Off-counter kit: Railgun, Seeker Pod, Charge Lance.** Slow aimed shots and the Seeker's long flight are too late at that range.
- Every weapon is in chapter 2's draft (no Focus). The first pick was Shrapnel, Boomerang and Gunship Pair (8.0 ships a run forced, before the last tuning pass); on the final build those two read 10.8 and 11.5 alone, so the kit moved to the three best fits.

How they compare (the player's Armory):

| | Ships lost, all 13 waves | Won |
| --- | --- | --- |
| Counter kit, forced (combo sweep's `check-one.ts`, 16 seeds) | **9.1** | 50% |
| The bot drafting for itself (combo sweep singles, 12 seeds) | 9.3 | 67% |
| Off-counter kit, forced (16 seeds) | 12.2 | 31% |
| Counter kit as the bot's taste (bot report, 24 seeds) | 4.6 in waves 1–10 | 46% |
| Off-counter kit as taste (bot report) | 6.0 in waves 1–10 | 38% |

The counter kit beats the off-counter kit clearly (3 ships a run fewer) but only matches the bot's own draft, which on this map often lands on the Gunship Pair anyway. Two other three-weapon kits read about the same (Gunship Pair + Shield + Well 9.4; Gunship Pair + Scattergun + Drone Screen 10.1). See "What is not satisfied".

## Loadouts on this map (combo sweep singles)

Each weapon alone, forced at every draft (12 seeds, the player's Armory, game version 31; `npm run v3:combo-sweep -- --stage=singles --maps=island,behemoth`). Ships lost over all 13 waves:

- **Strong:** **Gunship Pair 6.6 (won 92%)**, Gravity Well 8.0, Drone Screen 8.0, Scattergun 8.4, Shield 8.9, Frigate Escort 9.1, Point Defense 9.2; the bot's own draft 9.3.
- **Middling:** Flak 9.4, Air Strike 9.5, Tesla 10.7, Thermobaric 10.8, Shrapnel 10.8, Boomerang 11.5.
- **Weak:** Overdrive 12.1, Railgun 12.2, Full Steam 12.8, Seeker 13.2, Supply Run alone 13.9, Charge Lance 15.8 (plain gun 15.7).
- **The Gunship Pair is the one to watch:** alone it loses 6.6 ships a run and wins 11 runs in 12, the best single on any map swept so far (chapter 1's best single was 8.4). It is not trivial by the sweep's bar (it still loses 6.6 ships), but it is a chapter 2 weapon that answers this map's problem by itself.
- The Charge Lance reads badly because the bot charges it poorly; the Laser Cutter is not measured (the bot can't swipe).

## The debut

**All four of chapter 2's new enemies debut here,** one a wave from wave 2, as the wave planner brings a chapter's enemies in on its first map (`mapDebut`, `planFoes`; `debuts()` lists them): the Attack Helicopter on wave 2, the Torpedo Sub on wave 3, the Armored Drone on wave 4, the Scavenger Drone on wave 5.

**Since log v32 (the player's round 8), each has a light debut wave of its own** (rule `m-enemy`: alone, or with drones only, before it mixes in). Waves 2–5 send nothing but drones around the new enemy: wave 2 gives up its two shells (as before), and waves 3–5 give up every shell, missile and aircraft the shared wave would send (the subs' and trucks' loads with them; `replaces.extras` now takes a strafer or a bomber too) and send swarms in their place. The new enemy is the one new thing on the water. The island's first shell and the periscopes between the lanes now come on wave 6. Test: `tests/v3/mapRules.test.ts` ("a light debut wave on the Island").

Each new enemy says which chapter brought it the first time it shows (rule `m-debut-tag`): "NEW · The Narrows: Attack helicopter". The banner is a first-meeting tip: it shows once per device, and only at Call-outs: All (see "What is not satisfied"). Chapter 1's enemies keep "NEW: …" as before. Nothing from a later chapter: the encounters send only drones, shells, guided missiles and a strafer, all in the map's table by their waves (`tests/v3/encounters.test.ts`).

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated. From wave 6 the encounters send most of the wave's shells as drones instead (shells were the bot's biggest killer on waves 6–10, 2.8 ships a run with the shared waves), and stand in for some of the map's own extras (`replaces.extras`). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | Point-blank (`island-point-blank`) | island west silo, 3 drones | the ship beside the island |
| 2 | teach | From the far shore (`island-far-shore`) | far middle silo, 5 drones; island east silo, 3 drones; the wave's 2 shells taken out | the north lane; beside the island |
| 3 | first stakes | Swarms on both sides (`island-quiet-water`), the Torpedo Sub's debut | island west silo, 5 drones; island east silo, 5 drones; the wave's 4 shells taken out | halfway along; beside the island |
| 4 | first stakes | A swarm for each lane (`island-two-lanes`), the Armored Drone's debut | far middle silo, 5 drones; island east silo, 6 drones; the wave's shells, missile and jet taken out | the north lane; beside the island |
| 5 | combine | Both lanes (`island-both-lanes`), the Scavenger Drone's debut | far middle silo, 5 + 4 drones; island west silo, 5 drones; the wave's shells, bomber and jet taken out | the north lane; halfway along |
| 6 | combine | Front and behind (`island-behind`) | south-west sub, 2 shells; island west 5 drones and east 1 shell; far middle 4 drones | halfway along; beside the island; in place of the first supersonic |
| 7 | escalate | Down the south lane (`island-strafe`) | a jet from the west; island east 4 drones; far east 1 guided; far middle 4 drones | the lane; beside the island; the north lane |
| 8 | escalate | Both silos on the island (`island-crossfire`) | island west 4 drones, then east 3; far middle 3 drones | beside the island; in place of a cluster and a supersonic |
| 9 | escalate | The north gap (`island-north-gap`) | far middle 4 + 3 drones; far east 1 guided; island west 4 drones | the north lane; in place of a cluster and a heavy |
| 10 | climax | Run past the island (`island-run-past`), after the wave's own fire (`at: 1`) | island west 5 drones; far middle 4 + 4 drones; far east 1 guided; east sub, 2 shells | beside the island; the lead ship; halfway along; in place of a supersonic, 2 heavies, a cluster |

Wave 1 loses no ship (all three reports).

## The boss plan: the Gunship Wall off the island

The Gunship Wall is the map's own event: attack helicopters in a line on the island's side of the south lane, firing missile pairs in turn, with drone swarms. Under encounter rev 4 (`ISLAND_BOSS_ROUNDS`, lab only: the campaign plays the event as it was):

| Round | Helicopters (4 hits each) | Drone swarms | Shells from the island's east silo | Guided from the far east silo |
| --- | --- | --- | --- | --- |
| before (every round) | 4 | 3 of 5 | 0 | 0 |
| 1 | 3 | 3 of 5 | 2 (3 s, 7 s) | 1 (6 s) |
| 2 | 4 | 3 of 5 | 3 (3, 6, 9 s) | 1 |
| 3 | 5 | 2 of 5 | 2 | 1 |

The shells go at the ship nearest the silo (beside the island); the missile at the ship nearest the far east silo (the north lane when one is out). `MAP_PLANS.island.boss.botTarget` is 2 (the brief: about 1.5 / 2 / 2.5 on the bot's scale). Each round lasts 15–30 s (test).

## Bot results, before and after (24 seeds, 900–923)

"Before" is the map card as it was: today's convoy controls, no encounters, the event as it was. "After" is this build (log v31). Commands: `npx vite-node tools/v3/map-report/report.ts -- --map=island --seeds=24 --kits=plan [--armory=player | --armory=latest] [--no-fun]`.

### The player's Armory (Quick Reload 5, Damage Control 4, Stockpile 5)

| | Before | After |
| --- | --- | --- |
| Won (normal) | 92% | **50%** |
| Mean end wave | 13.5 | 12.2 |
| Ships lost in waves 1–10 (normal) | 2.4 | 3.9 |
| Ships lost in waves 1–5 (normal) | 0.25 | **0.88** |
| Boss r1 / r2 / r3 (normal, reached) | 0.09 / 0.45 / 0.41 | **1.28 / 1.71 / 1.64** |
| Boss r1 / r2 / r3 (tough) | 0.08 / 0.50 / 0.42 | 1.29 / 2.25 / 1.83 |
| Tough curve 1–10 | 0 0 .25 0 0 .08 .33 .42 .75 .92 | 0 .13 .21 .33 .21 .13 .50 .75 1.21 1.13 |
| `w-cliff` | PASS | PASS (biggest step w9 +0.46) |
| `w-early` close calls from w3 | PASS (fewest w3 3.46) | PASS (fewest w5 4.54) |
| `w-budget` | PASS | PASS (furthest w2 ×0.87) |
| `m-stretches` | **FLAG**: south lane cold late 26% | **FLAG**: south lane cold early 28%; north lane PASS (17%) |
| `g-warning` | PASS: 8.7 → 3.3 s | PASS: 7.3 → 3.1 s |
| `w-first` | PASS | PASS |

### The player's latest Armory (Wide Warhead 5, Point Defense 4, Supply Lines 3)

| | After |
| --- | --- |
| Won (normal) | 50% |
| Ships lost in waves 1–10 / 1–5 (normal) | 4.7 / 0.75 |
| Boss r1 / r2 / r3 (normal, reached) | 0.86 / 1.46 / 1.92 |
| Tough curve 1–10 | 0 .08 .46 .13 .08 .63 .88 1.17 1.17 1.58 |
| Checks | `w-cliff` **FLAG** (w6 0.08 → 0.63), `w-budget` **FLAG** (w2 ×0.85, the wave without its shells), `m-stretches` **FLAG** (south lane cold early 29%); the rest PASS |
| Kits (won; lost 1–10) | counter 42%, 4.5; off-counter 25%, 6.8 |

### Baseline (no Armory)

| | Before | After |
| --- | --- | --- |
| Won (normal) | 21% | 0% |
| Ships lost in waves 1–10 / 1–5 (normal) | 3.9 / 0.33 | 5.7 / 1.87 |
| Boss r1 / r2 / r3 (tough) | 1.08 / 1.08 / 1.50 | 2.88 / 5.42 / 5.04 |
| Tough curve 1–10 | 0 0 .21 0 .13 .17 .63 2.79 2.54 5.21 (11.7) | 0 .13 .38 .92 .63 .54 1.46 2.04 2.42 2.96 (11.5) |
| `w-cliff` | **FLAG** (w7, w8, w10) | **FLAG** (w4, w7) |
| `m-stretches` | **FLAG** | PASS |

As on chapter 1's maps (Kesh 4%, Marrow 0% without the Armory), the baseline stands in for a player with no upgrades; the encounters are lab only.

**For comparison,** the same card on the map's own convoy with no encounters (`quick.ts --no-enc`, 16 seeds, the player's Armory) wins 31% and loses 5.1 ships in waves 1–10: most of the drop from 92% is the production convoy and chapter 2's shared waves, not the encounters. The first encounter draft, aimed hard at the danger stretch, took the bot to 0% (6.0 ships in waves 1–10); the final one is easier than the shared waves.

### Chapter 2 difficulty (rule `m-difficulty`)

With the player's Armory the bot wins 50% (the latest Armory: 50%), the bottom of the 50–70% aimed for, against Kesh's 13% and Marrow's 79% on v29. Waves 1–10 lose 3.9 ships (a step over chapter 1's 3.1–3.75), waves 1–5 0.88 (in the 0.4–0.8 band's top, just over), and the boss rounds read 1.3 / 1.7 / 1.6 on the bot, a little under the 1.5 / 2 / 2.5 asked: with the bot's boss bias on chapter 1 (1.4–2.5×) that is about 0.6–1 a round for the player.

## Fun measures (provisional, `src/v3/sim/funMetrics.ts`)

From `island-player.md`:
- **Tension rises from wave 1:** its peak is 0.24, 0.34, 0.73 on waves 1–3 (the reference maps were flat on waves 1–3), then 0.80–1.11 on waves 4–10 with one peak in most runs from wave 6. Boss rounds 1.44 / 1.63 / 1.65, round 2 pinned in most runs.
- **Close calls** from wave 3: 4.5–8.5 a run on every wave 3–10, in nearly every run.
- **Saves:** 0.1–0.4 a run on waves 7–10, none before (under the provisional 0.3–0.5): the point-blank fire either sinks a ship or is cleared, with little in between. Boss rounds 0.7 / 1.1 / 1.1, around the "about 1 a round" target.

## What is not satisfied, or uncertain

- **The south lane's way in takes 28% of its hull damage (rule: under 25%).** The early third lies west of the island, in reach of the far west silo's shells and supersonic missiles and the west sub spot; the shared waves send that fire, and the encounters already aim away from it (wave 3's swarm moved from `near` to `mid` for this). Without the Armory it passes (24%); the north lane passes in every report.
- **The debut banner shows once per device, at Call-outs: All only.** A player who met chapter 2's enemies in the Test Lab's enemy cards has already seen it, so on the Island card the debut waves come with no banner. A question for the player (hub).
- **The counter kit only matches the bot's own draft** (9.1 against 9.3 ships a run), while clearly beating the off-counter kit; the Gunship Pair alone beats both.
- **Waves 1–5 lose 0.88** (target 0.4–0.8): the Torpedo Sub's and Armored Drone's debuts on waves 3–4.
- **Boss rounds are a little under target and round 3 is not above round 2** on the bot (1.71 / 1.64). Five helicopters read 2.4–3.3 in round 3 during tuning, a cliff after round 2; this is the middle.
- **The bot numbers move a lot with small changes.** One more drone or shell in a wave moved later waves by up to ±0.7 of a ship on the same 24 seeds (the sim is chaotic: the bot's drafts and the wave planner's dice change). 48-seed reads were used to choose between versions.
- **No player data** on chapter 2 maps yet: the bot's bias here is unknown.

## The play log (v31)

`LOG_VERSION` 31, `LOG_REPLAYS` `[31]` (`src/v3/sim/playlog.ts`), shared with the Behemoth Run. The base branch moved to v30 (#178) while this was built and was merged in. All of chapter 2's change is lab only, under the encounter layer: the campaign plays as it did (apart from the debut banner's text, which is UI only), and a v30 Island card log played the shared waves. The map-lab baseline's twelve runs differed only in their log version; it was rewritten with `--write` and replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 31.

## Tests

- `tests/v3/encounters.test.ts`:
  - the ten listed, rev 4, v1 only, none at rev 3;
  - the budget, legality, warning and replay checks cover the map;
  - the Island's wave 8 plans one cluster and one supersonic fewer than the shared wave (`replaces.extras`), and only chapter 2's encounters do that;
  - the Gunship Wall's rounds: the helicopters, swarms, shells and missiles, rising; a rev 3 log and the campaign play the event as it was; 15–30 s a round.
- `tests/v3/foes.test.ts`: `foeDebutTag` (rule `m-debut-tag`).
- `tests/v3/mapRules.test.ts`: no repeats and no gaps; `MAP_PLANS` complete; the boss target is 2.
- `tests/v3/mapCards.test.ts`, `round11.test.ts`, `convoy.test.ts`: the production setup is policy D with the encounters, no command.
- `e2e/v3-map-cards.mjs`: the hub card says so; `?lab=map-island` opens the full map with encounters rev 4 and no command. `e2e/v3-encounters.mjs`: the map with no authored encounters is now the Needle.

## What to look for when you play

The island sits right beside both lanes, and its two silos fire on the ships passing it with almost no warning: the first drones on wave 1, both silos at once on wave 3, a shell and a periscope from wave 6. Your shots come from the carrier, far to the south. A third of the ships take the fast north lane between the island and the far shore: the far shore aims its swarms and missiles there, furthest from your gun. Chapter 2's four new enemies arrive here, one a wave on waves 2–5, each in a wave of its own with nothing else but drones. Tell us whether each new enemy felt like the new thing in its wave, whether waves 1–5 threaten you without a cliff later, and whether the Gunship Wall's three rounds rise.

(Round 8: this section no longer names a weapon to try. The counter kit above is a design note for the bots, never shown in the game or on the hub.)
