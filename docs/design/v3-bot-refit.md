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

- **The Strait's and Harbor's boss rounds.** The refit bot loses about 1.2–1.4 ships a round where the player lost none in 15 rounds; the Gauntlet's matches. **RECORDED BIAS: on the Rush and the Breakout the bot reads harder than the player finds them.** Round 1 said the same thing from the player's side ("cost 0 in all six rounds you played"). In phase 4, the bot target for those two maps is **about 2 ships a round on the bot** for the player's "about one".
- **Waves 6–10** read about 1 ship too costly over the whole map against 3.0 for the player, though the twin check matches (3.52 against 3.60). The player's 13 runs are few and include early quits. Treat the bot's waves 6–10 as at most a ship pessimistic.
- **Reaction.** The bot notices a threat sooner than the player (0.47 s against 0.82 s on waves 1–5). Slowing it to the player's reaction made it lose more, so it is compensating for something the ruler does not see. A candidate is where the player waits for a stream of threats to come to them. **RECORDED BIAS: the bot is quicker to the first tap than the player.**
- **Weapon time.** The player keeps a weapon loaded longer: 251 Scattergun taps over the five v24 runs against about 136 for the bot on the same runs.

## For the next phases

- Bot reports and checks (phase 3) play "you" with `PLAYER_ARMORY` and the normal loss limit, and read boss rounds over the runs that reach them.
- To re-check the fit after a game change, re-run `fit.ts`. After new playtests, re-measure the player with `--logs`.
