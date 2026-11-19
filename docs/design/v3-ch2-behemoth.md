# The Behemoth Run: map card (map rebuild, chapter 2)

**Date:** 2026-11-19. The Behemoth Run (`behemoth`, chapter 2 "The Narrows", the 7th map) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), after chapter 1's Kesh Hook and Lee of Marrow (`docs/design/v3-ch1-kesh.md`, `v3-ch1-marrow.md`) and with the Island (`docs/design/v3-ch2-island.md`). Encounter rev 4; play log v31.

Code:
- `src/v3/data/encounters.ts`: `BEHEMOTH_R4` (ten encounters), `BEHEMOTH_BOSS_ROUNDS` and `MAP_BOSS.behemoth`, `REBUILT_MAPS` (via `CHAPTER_TWO_MAPS`), in the chapter 2 block;
- `src/v3/data/mapPlans.ts`: `MAP_PLANS.behemoth`;
- `src/v3/data/convoy.ts`: `MAP_CONVOY.behemoth` (the map's own convoy, no command);
- `src/v3/sim/game.ts`: the new aim `vip` (`aimBeat`), and `replaces.extras` (`makeRoom`): an encounter may stand in for one of the map's own extras;
- `src/v3/sim/events.ts`: the Wolf Pack reads its rounds from `MAP_BOSS` (`wolfRound`), and a round can add launches of its own (`fire`, `fireSteps`).

Bot reports: `tools/v3/map-report/results/behemoth.md` (no Armory), `behemoth-player.md` (the player's usual Armory, with fun measures and the heat map) and `behemoth-latest.md` (the player's latest Armory: Wide Warhead 5, Point Defense 4, Supply Lines 3; new `--armory=latest`).

## The problem

> Once a wave the supertanker crawls along the deep lane right under the enemy shore: it takes eight hits but counts as three ships, so the heavies and missiles that go for it pull your gun north while the convoy sails the lane below.

The map's mechanic is the tanker (rule `m-mechanic`): one ship a wave, 8 hit points, a heavy takes 4 of them, sunk it counts as three ships, home it repairs every hull a point and drops a weapon. Its first look is wave 1 and it is the stake in every wave and every boss round (`g-mechanic`).

## Sites and their jobs

Bases and spots are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| West silo (base 1) | North shore (280, 95) | drones, shells | The tanker's first threat (w1-3), and swarms all map long. |
| Middle silo (base 2) | North shore (760, 88) | guided, heavies | The tanker's killer: guided missiles at it (w5, w7, w10, every boss round), its one authored heavy (w9). |
| East silo (base 3) | North shore (1260, 95) | drones, supersonic, heavies | Swarms at the convoy (w2, w4-10). |
| South-east headland (base 4) | Enemy land on your side of the lanes (1430, 810) | shells, guided | Fire from behind the convoy, at the lead ship on its way out (w3, w5, w6, w10, boss rounds 1-3). |
| North-west and north-east sub spots (spots 1, 2) | Between the shore and the deep lane | sub salvos | Shells at the tanker from point-blank range (w4, w8). |
| South-west and south sub spots (spots 3, 4) | Between the convoy's lane and the carrier | sub salvos | Shells behind the convoy (w6, w10). |
| Coast road, pop-ups, air lines | North shore, the south-east road; the edges | trucks, strafers, bombers | The shared waves' own; the jet across both lanes (w7). |

Warning time falls from 10.2 s on wave 1 to 5.1 s on wave 10 (−0.43 s a wave, rule `g-warning`).

## The stretches

The bot report cuts each lane into thirds along it (lane 1 the tanker's, lane 2 the convoy's).

- **Danger: the middle**, under the middle silo and its heavies: 43% of the tanker's hull damage and 40% of the convoy's in waves 1–9 (the player's Armory).
- **Safe: the way in, the west third**: 20% (tanker) and 21% (convoy). Both pass.

## The convoy

The map's own convoy, no command (rule `m-convoy`): pairs at the reference maps' schedule in the main lane (`MAP_CONVOY.behemoth`: flow 2, pairs), and once a wave, 5 s in, the supertanker alone in the deep lane at 0.6 of a ship's speed (about 72 s to cross). The map card now opens on policy D with the encounters on (it opened on today's convoy controls and no encounters).

## The counters

- **Counter kit: Shield, Frigate Escort, Air Strike.** The tanker soaks hits that add up: the Shield (chapter 2's new boost) takes the missiles and drones off every hull for 15 s, the Frigate Escort sails with the ships, and the Air Strike breaks up what the shore sends at the deep lane.
- **Off-counter kit: Scattergun, Tesla Arc, Seeker Pod.** They fight drones one by one and leave the shells and missiles to land.
- Every weapon is in chapter 2's draft (none of chapter 3's, unlike Harbor's and Kesh's Focus).

How they compare (the player's Armory):

| | Ships lost, all 13 waves | Won |
| --- | --- | --- |
| Counter kit, forced (combo sweep's `check-one.ts`, 16 seeds) | **8.9** | 38% |
| The bot drafting for itself (combo sweep singles, 12 seeds) | 12.3 | 42% |
| Off-counter kit, forced (16 seeds) | 16.4 | 0% |
| Counter kit as the bot's taste (bot report, 24 seeds) | 3.8 in waves 1–10 | 42% |
| Off-counter kit as taste (bot report) | 5.1 in waves 1–10 | 29% |

The counter kit loses about 3.4 ships fewer than the bot's own draft and 7.5 fewer than the off-counter kit; it wins about as often as the bot's own draft (it loses fewer ships, but the boss rounds decide the win).

## Loadouts on this map (combo sweep singles)

Each weapon alone, forced at every draft (12 seeds, the player's Armory, game version 31; `npm run v3:combo-sweep -- --stage=singles --maps=island,behemoth`). Ships lost over all 13 waves:

- **Strong:** Frigate Escort 7.8, Shield 8.0, Air Strike 10.3, Drone Screen 10.4, Gravity Well 11.0.
- **Middling:** Boomerang 11.4, Railgun 11.6, Flak 11.7, Shrapnel 11.9; the bot's own draft 12.3; Point Defense 12.5, Scattergun 12.7.
- **Weak:** Thermobaric 13.1, Gunship Pair 13.5, Seeker 14.3, Tesla 15.3, Full Steam 15.9, Overdrive 16.3, Supply Run alone 20.3, Charge Lance 23.9 (plain gun 25.8).
- The Charge Lance reads badly because the bot charges it poorly, not necessarily because it is weak; the Laser Cutter is not measured (the bot can't swipe).
- No single weapon makes the map trivial (the best loses 7.8 ships a run).

## The debut

None of its own. The Behemoth Run's slot is the Torpedo Sub (`mapDebut`), but every chapter 2 enemy already comes in on the Island, one a wave from wave 2 (see the Island's card). The map brings the supertanker, which it has had since the 20-map plan. Nothing from a later chapter: the encounters send only drones, shells, guided missiles, one heavy and a strafer, all in the map's table by their waves (`tests/v3/encounters.test.ts`).

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated. Waves 6–10 send most of their shells as drones instead (the bot loses most of its ships to shells there), and some stand in for the map's own extras (`replaces.extras`). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | The tanker sails (`behemoth-first-tanker`) | west silo, 3 drones | the tanker |
| 2 | teach | A shell for the tanker (`behemoth-tanker-shell`) | west silo, 1 shell; east silo, 4 drones | the tanker; the lead ship |
| 3 | first stakes | From the headland (`behemoth-headland`) | headland, 1 shell; west silo, 4 drones | the lead ship from behind; the tanker |
| 4 | first stakes | Periscope by the deep lane (`behemoth-periscope`) | north-east sub, 2 shells; east silo, 4 drones | the tanker; the lead ship |
| 5 | combine | Tanker or convoy (`behemoth-tanker-or-convoy`) | middle silo, 1 guided; east silo, 5 drones; headland, 1 guided | the tanker / the lead ship |
| 6 | combine | Both sides of the convoy (`behemoth-both-sides`) | headland, 1 guided; south-west sub, 2 shells; west and east swarms | any ship; halfway along; the tanker; in place of 2 cluster missiles |
| 7 | escalate | Strafing the deep lane (`behemoth-strafe`) | a jet from the east; middle silo, 2 guided; two swarms | the tanker; any ship |
| 8 | escalate | A sub by the deep lane (`behemoth-wolves`) | north-west sub, 2 shells; two swarms | the tanker; in place of a cluster and the mothership (the first mothership comes on wave 9) |
| 9 | escalate | A heavy for the tanker (`behemoth-heavies`) | middle silo, 1 heavy; two swarms | the tanker; in place of the wave's two heavies and a cluster |
| 10 | climax | The last run (`behemoth-last-run`), after the wave's own fire (`at: 1`) | middle silo, 1 guided; west swarm; east swarm; headland, 2 guided; south sub, 2 shells | the tanker, the lead ship, halfway along; in place of a heavy and 2 clusters |

Wave 1 loses no ship (all three reports).

## The boss plan: the Wolf Pack by the deep lane

The Wolf Pack is the map's own event: periscopes in two waves of the pack (4 then 3 subs), each sub firing a spread of 2–3 torpedoes, two of them with a fast one. Under encounter rev 4 (`BEHEMOTH_BOSS_ROUNDS`, lab only: the campaign plays the event as it was):

| Round | Subs (packs) | With a fast torpedo | Added launches |
| --- | --- | --- | --- |
| before (every round) | 7 (4 + 3) | 2 | none |
| 1 | 4 (2 + 2) | 1 | 1 guided at the tanker (5 s), 1 guided from the headland at the lead ship (9 s) |
| 2 | 5 (3 + 2) | 1 | the same |
| 3 | 6 (3 + 3) | 2 | 2 guided at the tanker (4 s, 7 s), 1 from the headland at the lead ship |

`MAP_PLANS.behemoth.boss.botTarget` is 2 (the brief: about 1.5 / 2 / 2.5 on the bot's scale). Each round lasts 15–30 s (test).

## Bot results, before and after (24 seeds, 900–923)

"Before" is the map card as it was: today's convoy controls, no encounters, the event as it was. "After" is this build (log v31). Commands: `npx vite-node tools/v3/map-report/report.ts -- --map=behemoth --seeds=24 --kits=plan [--armory=player | --armory=latest] [--no-fun]`.

### The player's Armory (Quick Reload 5, Damage Control 4, Stockpile 5)

| | Before | After |
| --- | --- | --- |
| Won (normal) | 58% | **42%** |
| Mean end wave | 12.8 | 12.4 |
| Ships lost in waves 1–10 (normal) | 2.4 | 3.0 |
| Ships lost in waves 1–5 (normal) | 0.29 | **0.71** |
| Boss r1 / r2 / r3 (normal, reached) | 0.90 / 1.33 / 0.19 | **0.47 / 2.21 / 2.50** |
| Boss r1 / r2 / r3 (tough) | 0.88 / 2.13 / 1.17 | 0.46 / 2.63 / 3.33 |
| Tough curve 1–10 | 0 .17 0 0 .13 .46 .13 .50 .75 1.00 | 0 .13 .08 .21 .29 .21 .42 .67 1.17 .83 |
| `w-cliff` | PASS | PASS (biggest step w9 +0.50) |
| `w-early` close calls from w3 | PASS (fewest w3 2.75) | PASS (fewest w7 3.33) |
| `w-budget` | PASS | PASS (furthest w7 ×0.87) |
| `m-stretches` | **FLAG**: convoy's cold early 28% | PASS: hot middle 43% / 40%, cold early 20% / 21% |
| `g-warning` | PASS: 11.1 → 4.7 s | PASS: 10.2 → 5.1 s |
| `w-first` | PASS | PASS |

### The player's latest Armory (Wide Warhead 5, Point Defense 4, Supply Lines 3)

| | After |
| --- | --- |
| Won (normal) | 46% |
| Ships lost in waves 1–10 / 1–5 (normal) | 4.1 / 0.63 |
| Boss r1 / r2 / r3 (normal, reached) | 0.33 / 1.40 / 1.38 |
| Tough curve 1–10 | 0 .13 .04 .33 .29 .29 .92 .79 .79 2.21 |
| Checks | `w-cliff` **FLAG** (w7 0.29 → 0.92, w10 0.79 → 2.21); the rest PASS |
| Kits (won; lost 1–10) | counter 54%, 5.6; off-counter 38%, 6.8 |

### Baseline (no Armory)

| | Before | After |
| --- | --- | --- |
| Won (normal) | 0% | 4% |
| Ships lost in waves 1–10 / 1–5 (normal) | 5.0 / 0.71 | 5.7 / 1.75 |
| Boss r1 / r2 / r3 (tough) | 2.00 / 1.04 / 2.42 | 1.33 / 2.58 / 3.25 |
| Tough curve 1–10 | 0 .17 .25 .08 .29 1.58 1.04 4.33 4.79 8.63 (21.2 in all) | 0 .29 .13 .25 1.46 .67 1.29 3.04 2.83 3.04 (13.0) |
| `w-cliff` | **FLAG** (w6, w8) | **FLAG** (w5, w8) |
| `m-stretches` | **FLAG** | PASS |

As on chapter 1's maps, the baseline stands in for a player with no upgrades and is far harder; the encounters are lab only.

**For comparison,** the same card on the map's own convoy with no encounters (`tools/v3/map-report/quick.ts --no-enc`, 16 seeds, the player's Armory) wins 19% and loses 5.1 ships in waves 1–10: the shared chapter 2 waves alone are harder for the bot than the rebuilt map. Most of the difference is shells (the bot's biggest killer on waves 6–10, 2.8 ships a run) and the map's cluster missiles, which the encounters trade for drones.

### Chapter 2 difficulty (rule `m-difficulty`)

With the player's Armory the bot wins 42% (46% with the latest Armory): under the 50–70% aimed for. The waves are not why: they lose 3.0 ships in waves 1–10 (Kesh 3.75, Marrow 3.1 on v29), 0.71 in waves 1–5, and 19 of 24 runs reach the boss. The boss rounds are: the tanker counts three ships, so one sunk tanker is most of a round's target, and rounds 2 and 3 read 2.2 and 2.5 on the bot. That is the target the brief set (about 1.5 / 2 / 2.5), and its sum (6) is the loss limit after the restore; the bot can't win most runs at that target. See "What the player needs to decide".

## Fun measures (provisional, `src/v3/sim/funMetrics.ts`)

From `behemoth-player.md`:
- **Tension rises from wave 1:** its peak is 0.10, 0.28, 0.53, 0.73, 0.95 on waves 1–5, then about 1 (0.78–1.14) on waves 6–10. Waves 1–6 are mostly flat in shape (no real peak), waves 7–8 one peak.
- **Saves:** 0.1–0.3 a run on waves 7–10, none on waves 1–6 (under the provisional 0.3–0.5): the tanker's hits take a long time to add up, so few single taps save a ship. Boss rounds 0.3 / 0.5 / 0.8.
- **Close calls** from wave 3: 3.3–7.6 a run on every wave 3–10 (all runs have one on waves 3–6 and 8–10).

## What is not satisfied, or uncertain

- **Win rate under target** (above): 42% against 50–70%, because of the boss target, not the waves.
- **Boss round 1 is light** (0.47 on the bot; tough 0.46): the round opens with an intro calm, and four subs and two missiles rarely reach the tanker. Rounds 2 and 3 carry the boss. Round 1 read 1.1–1.4 at five subs, but then round 2 read 2.6–3.4.
- **The tanker makes the boss rounds lumpy.** A sunk tanker is three ships at once, so a round reads 0 or 3+ on most seeds; across the tuning the same numbers read ±0.8 a round from seed set to seed set.
- **Wave 10 is not the hardest wave for the bot** (0.83 tough, after 1.17 on wave 9): the climax comes after the wave's own fire, when the tanker of that wave is often already home, so its missiles at the tanker fall back to the lead ship. With the latest Armory it is the hardest (2.21, a cliff by that measure).
- **Saves are few** on waves 1–6 (see Fun).
- **The bot's kits are its draft taste.** On the bot report the counter kit wins 42% against 29% off-counter; forced, it loses 8.9 ships a run against the bot's own draft's 12.3.
- **No player data** on chapter 2 maps yet: the bot's bias here is unknown. On chapter 1 the bot read waves 1–10 about as the player played them on Kesh and about twice as hard on Marrow, and boss rounds 1.4–2.5× as hard.

## The play log (v31)

`LOG_VERSION` 31, `LOG_REPLAYS` `[31]` (`src/v3/sim/playlog.ts`), shared with the Island. The base branch moved to v30 (#178, chapter 1's climb and the boss intro) while this was built, and was merged in. All of chapter 2's change is lab only, under the encounter layer: the campaign plays as it did, and a v30 Behemoth card log played the shared waves. The map-lab baseline's twelve runs differed only in their log version; it was rewritten with `--write` and replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 31.

## Tests

- `tests/v3/encounters.test.ts`:
  - the ten listed, rev 4, v1 only, none at rev 3;
  - the budget, legality, warning and replay checks cover the map;
  - a launch aimed `vip` goes at the supertanker while it sails; the tanker is the target in every wave;
  - the Wolf Pack's rounds: the subs, the added missiles (one at least at the tanker each round), rising; a rev 3 log sends the event's own; 15–30 s a round.
- `tests/v3/mapRules.test.ts`: no repeats and no gaps; `MAP_PLANS` complete; the boss target is 2.
- `tests/v3/mapCards.test.ts`, `round11.test.ts`, `convoy.test.ts`: the production setup is policy D with the encounters, no command.
- `e2e/v3-map-cards.mjs`: the hub card says so; `?lab=map-behemoth` opens the full map with encounters rev 4 and no command.

## What to look for when you play

Watch the tanker. It sails from 5 s into every wave in the lane right under the enemy shore, slower than everything else, and most of the map's aimed fire goes for it: a few drones and a shell on waves 1–2, shells from a periscope beside it on wave 4, guided missiles from the middle silo from wave 5, and one heavy on wave 9 that takes half of it in one hit. Losing it costs three ships, bringing it home repairs every ship and drops a weapon. The convoy below is fired on from the north and, from wave 3, from the enemy headland behind it in the south-east. The question to answer: did protecting the tanker feel like a real choice against the convoy, or did you just ignore one of them? In the boss rounds, subs surface in two packs and fire torpedo spreads while missiles go for the tanker; tell us whether round 1 felt too light and rounds 2–3 too swingy (a sunk tanker is three ships at once).
