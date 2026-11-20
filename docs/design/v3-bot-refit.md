# V3 bot refit: bots that play like the player (map rebuild phase 2)

The map rebuild tunes maps with bots and heat maps before the player plays them (the hub's plan, "Bots and heat maps decide"). That only works if the "you" bot loses ships where and as often as the player does. Round 12's bot did not: it was quoted at 12–18 ships lost over the three boss rounds where the player lost 0–4. This round measures the player and the bot with one ruler, finds the gaps and refits the bot.

## The ruler: `tools/v3/bot-fit/`

- **`measure.ts`** reads one play log, a person's or a bot's, and turns it into one set of numbers. Most of it comes from what the log records on its own, so it works on logs this build no longer replays:
  - ships lost per wave, shots, kills;
  - tap results (fire, dry rack, nothing there, pickup);
  - tap rhythm (bursts, gaps, rests, in real seconds over the speed slider);
  - weapon pickups, the cards drafted, what sank the ships.

  The **eyes** come from replaying the log, on the waves that still replay exactly, and read on waves 1–5 on both sides (`EYES_TO`):
  - reaction from a threat showing to the first tap at it;
  - whether a tap went to the most urgent threat;
  - seconds to impact at the tap;
  - which threats got no tap;
  - how long a pickup sat before its tap.
- **`fit.ts`** has three modes:
  - `--logs=<dir>` measures the player's logs into **`player.json`**. That file holds the 13 map-card runs (logs v21–24) and 5 campaign runs (Strait, Kesh, Saltgate ×2, Battery), each run that reached wave 5. With each run it keeps how the run was set up: seed, Armory upgrades, Test Lab card setup, draft picks. Later sessions need no download.
  - **Calibration (the default).** Each of the player's runs is mirrored by each bot, 6 dice a run. The mirror copies:
    - the same map, map card or campaign;
    - the same seed;
    - **the same Armory upgrades the player had on**;
    - the same card setup;
    - the same draft picks whenever they are offered (`--own-picks` lets the bot draft for itself).

    The bot is fitted on the player's own setup: this is the table below.
  - `--cards` plays the reference cards' production setup today on fresh seeds, with the player's usual Armory (`PLAYER_ARMORY`: Quick Reload 5, Damage Control 4, Stockpile 5) or `--armory=none`.

  `--json` saves the table: `results/calibration-2026-11-17.json` (calibration) and `results/fit-2026-11-17.json` (cards).

```
npx vite-node tools/v3/bot-fit/fit.ts -- --logs=<dir of logs>     # re-measure the player
npx vite-node tools/v3/bot-fit/fit.ts -- --personas=you-r12,you   # calibration
npx vite-node tools/v3/bot-fit/fit.ts -- --cards --seeds=32       # the cards today
```

**Two settings, kept apart:**
- **Calibration** uses the player's upgrades, so the bot is measured against the player in the player's own setup.
- **Map testing** (the map lab, `versions.ts`, the reports of phase 3) plays the baseline: "you" with **no Armory upgrades**. `versions.ts --armory=player` adds the player's upgrades, to read a map as the player will meet it.

## What was wrong

1. **Setup, not skill.** Round 12 compared an empty-Armory bot with a player at Quick Reload 5, Damage Control 2–4 and Stockpile 4–5 (every log since round 11). Its boss figure also came from "tough" runs: the bot kept playing after six ships were lost, so its worst runs filled the boss rounds. Calibration now copies each run's own upgrades and plays to the normal loss limit.
2. **Speed.** Round 12's bot played at 1.1× and rushed one wave in five at 1.4×. The player plays at 1× and is above 1× about a sixth of the time. At 1×, waves 1–5 match.
3. **Pickups, the big one.** The player's hands and eyes were already matched: tap rate, burst length, rests, accuracy and which threat a tap goes for are all within a few points. The difference was the pickups.
   - The player grabs pickups **faster as the stakes rise**: about 1.6 s after a drop in waves 1–5, about 1 s in waves 6–10, and 0.35–0.8 s in the boss rounds (a Supply Run in 0.6–0.8 s).
   - The bot only looked at pickups between bursts, so it went the other way: 1 s, 1.3 s, then 1.6–2.5 s in the boss rounds.
   - This was found on the player's own Strait v2 run, replayed on the build it was played on (v24) next to the bot on the same seed and the same draft picks. The player loaded a Scattergun in the first second of boss round 1 and killed all 24 sprinters, losing nothing. The bot reached the Supply Run 2.6–6 s late, its supply plane landed as the round ended, and it fought with the plain gun and lost 2–5 ships.
4. Smaller habits: the player passes over threats already covered more often, keeps a burst going after a kill, and waits for the reload a little more.

## The refit: `src/v3/sim/mimic.ts`

`YOU` is refit; round 12's is kept as `YOU_R12` (`you-r12`) to compare against. Over round 12:

| Knob | Round 12 | Refit |
|---|---|---|
| Game speed | 1.1× | 1× |
| Rushes | 1 wave in 5 at 1.4× | about 1 in 7 at 1.5× |
| Pickups | between bursts only | `grab`: each pickup is noticed a log-normal 1.5 s after it drops (×0.65 in waves 6–10, ×0.4 in the boss rounds), then gets the next tap, even mid-burst |
| Pass over a covered threat | 0.3 | 0.7 |
| Hop to the next threat after a shot | 0.15 | 0.4 (reach 140 px) |
| Stop a burst on a kill | 0.25 | 0.1 |
| Wait for the reload | 0.5 | 0.7 (a dry tap ends a burst 0.3) |

**New knobs:**
- `grab`, as in the table.
- `fresh`: the chance of taking a new weapon over levelling one, while a slot is free. Fitted to the player at 0.45, but it changed nothing measurable, so "you" leaves it off.

The other personas build on the new `YOU`. Casual grabs 1.6× slower; Novice keeps the old pickup habit.

The map-lab baseline and the test scenarios play round 12's bots, frozen (`YOU_R12`, `TRYHARD_R12`), so a refit never moves them: they check replays, not the bots.

## The fit

**Calibration.** All 18 of the player's runs, each mirrored 6×: same map, seed, Armory upgrades, setup and draft picks.

| | You | Round 12 bot | Refit bot |
|---|---|---|---|
| Ships lost, waves 1–5 | 0.50 | 1.19 | **0.69** |
| Runs with no loss by wave 5 | 61% | 41% | **57%** |
| Ships lost, waves 6–10 | 3.28 | 4.24 | **3.58** |
| Ships lost a boss round | 0.52 | 1.37 | **1.03** |
| Taps a second | 1.16 | 1.24 | 1.12 |
| Kills a shot | 0.65 | 0.59 | 0.69 |
| Weapon pickups a minute | 2.41 | 2.14 | 2.43 |

By map, ships lost a boss round:

| Map | You | Refit bot | Rounds |
|---|---|---|---|
| The Strait | 0.17 | 1.11 | 12 / 74 |
| The Gauntlet | 1.56 | 1.84 | 9 / 25 |
| Harbor Mouth | 0.00 | 0.33 | 6 / 3 |
| Kesh | 0.00 | 0.00 | 3 / 18 |
| Saltgate | 0.33 | 0.67 | 3 / 18 |

**The cards today.** The player's 13 map-card runs against 32 seeds a map of each bot. Same cards, same Armory, normal loss limit. Boss rounds are counted for the runs that reached them.

| | You | Round 12 bot | Refit bot |
|---|---|---|---|
| Ships lost, waves 1–5 | 0.54 | 0.83 | **0.47** |
| Runs with no loss by wave 5 | 62% | 43% | **61%** |
| Ships lost, waves 6–10 | 3.00 | 4.70 | **4.10** |
| Ships lost a boss round | 0.63 | 2.13 | **1.35** |
| Boss rounds reached (of 3 a run) | — | 0.5 | **1.5** |
| Taps a second | 1.15 | 1.21 | 1.12 |
| Taps a burst | 2.38 | 2.55 | 2.42 |
| Rest between bursts (median s) | 0.97 | 1.00 | 1.02 |
| Taps that fire / on nothing / on an empty rack | 0.68 / 0.08 / 0.08 | 0.70 / 0.09 / 0.08 | 0.68 / 0.08 / 0.07 |
| Kills a shot | 0.62 | 0.58 | 0.68 |
| Reaction, median (s, waves 1–5) | 0.82 | 0.47 | 0.47 |
| Pickup taps a minute | 11.2 | 9.4 | 11.9 |
| Weapon pickups a minute | 2.55 | 1.99 | 2.26 |
| Time above 1× | 16% | 100% | 10% |

**Boss rounds by map** (ships a round):

| Map | You | Round 12 bot | Refit bot |
|---|---|---|---|
| The Strait | 0.11 (9 rounds) | 2.24 | 1.20 |
| The Gauntlet | 1.56 (9) | 2.29 | **1.53** |
| Harbor Mouth | 0.00 (6) | 1.17 | 1.41 |

**Twin check.** The bot on the player's own five v24 runs: same seeds, same card setup, the player's draft picks where offered, 8 dice each, on the v24 build where those logs replay exactly.

| | Waves 1–5 | Waves 6–10 | Boss round |
|---|---|---|---|
| You | 0.80 | 3.60 | 0.44 |
| Round 12 bot | 1.10 | 4.75 | 1.42 |
| Refit bot | 0.78 | 3.52 | 1.28 |

The game changes since v24 (round 13) were checked the same way. They are not why the bot loses more: on the v24 build it lost the same as now.

## What is still off (recorded biases)

**Re-checked 2026-11-18** with the player's three v26 runs added (the playtest of the three rebuilt maps; 21 runs in all, 16 map cards and 5 campaign). The calibration was run on the v26 build those runs were played on, 6 dice a run: `results/calibration-2026-11-18.json` (the same run on the v27 build, after the supersonic and Harbor changes, is `calibration-2026-11-18-v27.json`).

| | You | Round 12 bot | Refit bot | Refit bot, 2026-11-17 (18 runs) |
|---|---|---|---|---|
| Ships lost, waves 1–5 | 0.48 | 1.13 | **0.63** | 0.69 (you 0.50) |
| Runs with no loss by wave 5 | 62% | 43% | **60%** | 57% (you 61%) |
| Ships lost, waves 6–10 | 3.43 | 4.36 | **3.76** | 3.58 (you 3.28) |
| Ships lost a boss round | 0.62 | 1.68 | **1.25** | 1.03 (you 0.52) |
| Taps a second | 1.18 | 1.25 | 1.13 | 1.12 |
| Kills a shot | 0.63 | 0.58 | 0.69 | 0.69 |
| Weapon pickups a minute | 2.45 | 2.19 | 2.58 | 2.43 |

**The "you" bot still fits.** Its hands, aim and pickups are within a few points of the player's, as before. It reads waves 1–5 about 1.3× the player (0.63 against 0.48), waves 6–10 about a third of a ship high (3.76 against 3.43), and the boss rounds about 2× (1.25 against 0.62), the same ratio as on 2026-11-17 (1.03 against 0.52). No knob was retuned: three new runs are too few, and the gap did not move.

**Boss rounds by map** (ships lost a boss round; rounds played in brackets):

| Map | You, all runs | Refit bot, all runs | You, the three new runs | Refit bot, the new runs (12 dice) |
|---|---|---|---|---|
| The Strait | 0.17 (12) | 1.71 (76) | – (lost on wave 10) | 1.45 (22) |
| The Gauntlet | 1.25 (12) | 1.04 (27) | 0.33 (3) | 1.00 (3) |
| Harbor Mouth | 0.67 (9) | 1.58 (12) | 2.00 (3) | 1.90 (20) |
| Kesh | 0.00 (3) | 0.00 (18) | – | – |
| Saltgate | 0.33 (3) | 0.67 (18) | – | – |

What each map's bias is now, in plain numbers:

- **The Strait: the bot reads its boss rounds about 1.5 ships a round too hard.** The player lost 0.17 a round over 12 rounds (none since the rebuild: the playtest ended on wave 10). The bot loses 1.71. **RECORDED BIAS, unchanged.**
- **The Gauntlet: about 0.7 a round too hard on the rebuilt map.** On the new run the player lost 0, 0 and 1 (0.33 a round) where the bot loses about 1.0 a round. Over all the Gauntlet runs the two are close (1.25 against 1.04), because the player's older runs lost more. Only 3 bot rounds back the new figure (most mirrors lose before the boss), so read it as "the rebuilt Rocket Convoy reads about 3× too hard on the bot", not as a firm number. **RECORDED BIAS, new.**
- **Harbor Mouth: no bias on the rebuilt map.** The player lost 2, 0 and 4 (2.0 a round) and the bot loses 1.9 on the same seed, Armory and picks. Phase 4 assumed the bot reads Harbor's Breakout twice as hard and set its boss target at 2 a round on the bot; that assumption no longer holds. Harbor's target is now **1 a round on the bot** (`MAP_PLANS.harbor.boss.botTarget`), and round 3 was softened (log v27, `docs/design/v3-p4-harbor.md`, "After the playtest"). Over all runs the bot still reads 0.9 a round high, from the six old rounds the player lost nothing in.
- **Kesh and Saltgate:** one and two old runs only; nothing new.

The other recorded biases (from 2026-11-17):

- **Waves 6–10** read about 1 ship too costly over the whole map against 3.0 for the player, though the twin check matches (3.52 against 3.60). The player's 13 runs are few and include early quits. Treat the bot's waves 6–10 as at most a ship pessimistic.
- **Reaction.** The bot notices a threat sooner than the player (0.47 s against 0.82 s on waves 1–5). Slowing it to the player's reaction made it lose more, so it is compensating for something the ruler does not see. A candidate is where the player waits for a stream of threats to come to them. **RECORDED BIAS: the bot is quicker to the first tap than the player.**
- **Weapon time.** The player keeps a weapon loaded longer: 251 Scattergun taps over the five v24 runs against about 136 for the bot on the same runs.

## For the next phases

- Bot reports and checks (phase 3) play "you" with `PLAYER_ARMORY` and the normal loss limit, and read boss rounds over the runs that reach them.
- To re-check the fit after a game change, re-run `fit.ts`. After new playtests, re-measure the player with `--logs`.

**Re-checked 2026-11-19** with the chapter 1 playtest (Kesh and Marrow map cards, a Battery campaign run; log v28). `fit.ts --logs` now adds new runs to `player.json` and keeps the earlier ones as measured (`--remeasure`, `--fresh`), and takes every map card (it read only the three reference maps' before). 24 runs, 18 map cards. On the player's own seed, Armory and picks (12 dice; `results/ch1-playtest-2026-11-19.json`):

| | Waves 1–10, you / bot | Boss r1 / r2 / r3, you / bot |
| --- | --- | --- |
| Kesh | 3 / 3.0 | 0 / 0 / 1 against 0.25 / 1.25 / 1.00 |
| Marrow | 2 / 4.25 | 1 / 0 / 1 against 0.29 / 1.00 / 1.71 |

Kesh's waves match; its boss reads about 2.5× too hard on the bot. Marrow reads about 2× too hard in waves 1–10 and 1.4× in the boss rounds. **RECORDED BIAS, new: the bot reads Marrow's waves 1–10 about twice as hard as the player (one run).**

## Boosts (2026-11-20)

The combo sweep rated Overdrive among the weakest weapons, yet the player won both runs they played with Overdrive + Scattergun + Supply Run and lost nothing in their boss rounds. The suspicion was that the bot fires boosts and grabs pickups late. This round measured it.

**How.** A boost starts the moment its pickup is tapped, so "firing" a boost is taking its pickup. `tools/v3/bot-fit/boosts.ts` replays a log and lists every weapon pickup: when it dropped and was taken, the board at both moments (threats on screen, threats under 3 s from impact, a danger reading against the wave's own peak), the stakes (boss round, losses left), the rack, and how the boost was spent (seconds it ran, whether the wave's end cut it short, taps and shots inside it). It ran on the player's five boost runs that still have raw logs (Overdrive: Gauntlet v26, Marrow v28; Supply Run: Strait v26, Harbor v26, Kesh v29), each replayed on the build it was played on (all 13 waves exact, Strait 10), against 8 mirrors each on the same build (same seed, Armory, card setup and picks). `mimic.ts` has not changed since v26, so the new bot was dropped into those builds as is. Totals: `results/boosts-2026-11-20.json`.

**What the player does, and what the bot did** (phase 2 fit, now `you-p2`):

| Overdrive | You | Bot before | Bot after |
| --- | --- | --- | --- |
| Taken (of 15 / 98 / 88 dropped) | 14 | 95 | 84 |
| Drop to take, median s | 2.1 | 1.0 | 1.5 |
| Threats under 3 s from impact at the take | 0.86 | 1.59 | 0.68 |
| Takes with nothing under 2 s from impact | 57% | 41% | 75% |
| Shots a second while it runs | **1.38** | 0.95 | **1.41** |
| … against the run's usual rate | **1.82×** | 1.25× | **1.82×** |
| Taps a second while it runs, against usual | 1.48× | 1.11× | 1.65× |
| Cut short by the wave's end | 36% | 46% | 46% |

| Supply Run | You | Bot (before and after) |
| --- | --- | --- |
| Drop to take, median s | 1.7 | 0.9 |
| Threats under 3 s at the take | 1.04 | 1.02 |
| Taps a second while it runs, against usual | 1.06× | 1.60× |
| Kills a second while it runs | 0.68 | 0.94 |

1. **The bot was not late. It was early.** Since the phase 2 refit (`grab`) it takes every pickup, boosts included, about twice as fast as the player does now (weapons 1.0 s against 1.7 s; Overdrive 1.0 s against 2.1 s). The old finding (the bot reaching a Supply Run 2.6–6 s late) is fixed and over-fixed.
2. **The player takes Overdrive in a lull.** They do not break off from a threat about to land to tap it: at the take, under one threat is within 3 s of impact (0.86), where the bot broke off mid-fight (1.59). For Supply Run the player and the bot took it on the same board (1.04 and 1.02).
3. **The big one: under Overdrive the player shoots far more.** Free rounds turn them loose: 1.82× their usual shots a second, where the bot fired only 1.25× (it kept passing over covered threats, resting between bursts and keeping its bursts short as if rounds still cost). Kills a second inside Overdrive are about the same on both sides, so the extra shots go into threats the bot let through.
4. Supply Run: the bot already got more out of it than the player (it taps every crate), so nothing changed there. A first version made every boost wait for a lull; Supply Run then lost about a ship a run more in the sweep (crates came late) and Shield about 1.4 (a Shield is wanted while missiles are in the air), with no evidence from the player for either. So only Overdrive waits (`lull`).
5. Stakes and the rack: no clear habit. The player took Overdrive with the rack a little lower than the bot (0.62 against 0.73; 0.17 in the two boss-round takes), and with about as many losses left. Too few takes to fit.

**The change** (`src/v3/sim/mimic.ts`, a new knob `boosts`; `you` has it, `you-p2` is phase 2 unchanged to compare against, and the other personas inherit it from `you`):

| Knob | Value | What it does |
| --- | --- | --- |
| `lull` | Overdrive | The boosts that wait for a lull. |
| `calm` | 2 s | A noticed Overdrive pickup waits until no threat the bot has seen is under 2 s from impact… |
| `wait` | 3 s | …or until it has waited 3 s more. |
| `rest` | 0.45 | Under Overdrive, rests between bursts × 0.45. |
| `burst` | +1 | Under Overdrive, one more tap a burst. |
| `cover` | 0.3 | Under Overdrive, passes over a covered threat 0.3× as often (a spare shot costs nothing). |

`BOT_REV` (3) in `mimic.ts` names the bot's revision; the combo sweep keys its cache on it.

**Fit, all 26 of the player's runs** (calibration on today's build, v31, 6 dice a run; `results/calibration-2026-11-20-boosts.json`). No number moved more than the dice do:

| | You | Bot before (`you-p2`) | Bot after (`you`) |
| --- | --- | --- | --- |
| Ships lost, waves 1–5 | 0.42 | 0.65 | 0.68 |
| Runs with no loss by wave 5 | 65% | 62% | 59% |
| Ships lost, waves 6–10 | 3.50 | 3.70 | 3.68 |
| Ships lost a boss round | 0.65 | 1.06 | 1.04 |
| Taps a second | 1.13 | 1.14 | 1.18 |
| Kills a shot | 0.69 | 0.75 | 0.72 |
| Weapon pickups a minute | 2.60 | 2.86 | 2.82 |

So the change does not close the boss-round gap (the bot still loses about 1.6× the player's ships there): that gap is not about boosts. On the player's 14 boost runs alone (first version, every boost waiting) it was the same: boss 1.14 before, 1.25 after, against the player's 0.67.

**Still off (recorded biases).**
- **RECORDED BIAS, new: the bot grabs pickups faster than the player**, about 1.25 s from a drop against the player's 1.6–2.0 s (weapons, ammo, repairs). It leans toward the bot doing better with pickups than the player. Slowing it was not tried: the bot already loses more than the player in waves 1–5 and the boss rounds, and a slower grab would widen that.
- The bot takes Overdrive in a lull more strictly than the player (75% of Overdrive takes with nothing under 2 s, against the player's 57%), and taps a little more under Overdrive (1.65× against 1.48×); its shots match.
