# Bot report: Tidewater Flats (`tide`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.4; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=tide --seeds=24 --armory=player --kits=plan`. Heat map: `tools/v3/map-report/results/tide-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.58; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w4 1.75 a run (79% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w4 ×0.83 of the no-encounter wave; outside on w4 ×0.83 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 43%, cold early 23%; lane 2: hot early 77%, cold late 4% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 10.6 s → w10 7.5 s (slope -0.28 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.50 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.71 (17), r2 1.06 (17), r3 2.31 (16); tough (every run): 0.63, 1.21, 2.00 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 3.8 lost 1–10, end 12.2; counter 4.3 lost 1–10, end 12.3 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Budget: wave 4 sends ×0.83 the no-encounter wave. Encounters should replace launches, not add them.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (1.33 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 26%, middle 33%, late 40%.

## Ships lost per wave

Normal: won 63%, mean end wave 12.4 (14 = won), 2.7 lost in waves 1–10, 0.50 in waves 1–5. Tough: 4.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.38 | 0.04 | 0.08 | 0.17 | 0.42 | 0.75 | 1.33 | 1.08 | 0.63 | 1.21 | 2.00 |
| normal, runs that reached it | 0.00 | 0.00 | 0.38 | 0.04 | 0.08 | 0.17 | 0.42 | 0.71 | 0.50 | 0.58 | 0.71 | 1.06 | 2.31 |
| normal, mean over all runs | 0.00 | 0.00 | 0.38 | 0.04 | 0.08 | 0.17 | 0.42 | 0.71 | 0.46 | 0.46 | 0.50 | 0.75 | 1.54 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 19 | 17 | 17 | 16 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.58.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.8 | 1.5 | 2.1 | 1.6 | 1.9 | 1.9 | 1.9 | 2.1 | 2.3 | 2.0 | 0.6 | 1.6 | 1.5 |
| kills a minute | 41 | 42 | 48 | 44 | 44 | 43 | 47 | 46 | 50 | 55 | 6 | 24 | 23 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.7 | 3.5 | 2.5 | 1.8 | 3.3 | 4.0 | 3.8 | 3.5 | 2.7 | 4.5 | 2.1 | 2.3 | 3.2 |
| runs with ≥ 1 | 88% | 100% | 96% | 79% | 88% | 100% | 100% | 96% | 92% | 100% | 92% | 96% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 23.3 | 23.7 | 32.5 | 32.5 | 35.3 | 38.6 | 45.4 | 47.5 | 54.6 | 58.8 |
| launches (encounters off) | 22.0 | 26.4 | 36.2 | 39.2 | 39.2 | 43.4 | 46.9 | 49.6 | 58.8 | 66.0 |
| **ratio to encounters off** | 1.06 | 0.90 | 0.90 | **0.83** | 0.90 | 0.89 | 0.97 | 0.96 | 0.93 | 0.89 |
| table × scale | 22 | 30 | 38 | 43 | 45 | 52 | 60 | 66 | 76 | 91 |
| ratio to table × scale | 1.06 | 0.79 | 0.85 | 0.75 | 0.78 | 0.74 | 0.76 | 0.72 | 0.72 | 0.65 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 23% / 21% | 34% / 26% | 43% / 53% | 76.6 | late | early |
| 2 | 1–9 | 77% / 33% | 19% / 50% | 4% / 17% | 5.5 | early | late |
| all | 1–9 | 26% / 22% | 33% / 28% | 40% / 50% | 82.1 | late | early |
| 1 | 1–13 | 14% / 8% | 35% / 22% | 50% / 70% | 138.9 | late | early |
| 2 | 1–13 | 72% / 29% | 21% / 43% | 8% / 29% | 6.0 | early | late |
| all | 1–13 | 17% / 9% | 35% / 23% | 48% / 69% | 144.9 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.6 | 9.7 | 9.5 | 9.3 | 8.4 | 8.6 | 8.7 | 8.1 | 8.2 | 7.5 | 2.0 | 4.0 | 3.5 |
| launches read | 648 | 658 | 806 | 788 | 859 | 940 | 1051 | 1115 | 1277 | 1363 | 168 | 408 | 454 |

Slope over waves 1–10: -0.28 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.71 | 1.06 | 2.31 |
| runs that reached it | 17 | 17 | 16 |
| tough, every run | 0.63 | 1.21 | 2.00 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 19 | 17 | 17 | 16 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.0** | **0.1** | **0.2** | **0.3** | **0.0** | **0.0** | **0.2** | **0.2** | **0.4** | **0.4** |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.0 | 0.1 | 0.1 | 0.2 | 0.0 | 0.0 | 0.3 | 0.2 | 0.5 | 0.3 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.06 |
| clutch | 0.00 | 0.00 | 0.13 | 0.00 | 0.13 | 0.04 | 0.21 | 0.00 | 0.05 | 0.16 | 0.18 | 0.35 | 0.25 |
| runs with no save | 100% | 100% | 88% | 100% | 92% | 88% | 83% | 96% | 95% | 79% | 88% | 71% | 69% |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.08 | 0.00 | 0.04 | 0.04 | 0.08 | 0.00 | 0.00 | 0.11 | 0.06 | 0.12 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.12 | 0.12 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.06 |
|   kill save | 0.00 | 0.00 | 0.04 | 0.00 | 0.08 | 0.13 | 0.13 | 0.00 | 0.05 | 0.00 | 0.00 | 0.18 | 0.31 |
| tension peak | 0.45 | 0.40 | 0.74 | 0.63 | 0.77 | 1.08 | 0.84 | 0.92 | 1.03 | 1.05 | 1.34 | 1.31 | 1.77 |
| peaks | 0.1 | 0.0 | 0.5 | 0.3 | 0.5 | 1.0 | 0.7 | 0.7 | 0.9 | 0.9 | 1.6 | 2.1 | 1.8 |
| release after a peak (s) | 0.2 | 0.0 | 1.0 | 0.5 | 0.9 | 1.8 | 1.7 | 1.5 | 1.2 | 1.9 | 2.1 | 2.1 | 2.2 |
| hot share | 0% | 0% | 2% | 1% | 2% | 4% | 2% | 3% | 3% | 3% | 12% | 16% | 16% |
| calm share | 92% | 87% | 84% | 86% | 82% | 77% | 84% | 80% | 79% | 83% | 74% | 60% | 65% |
| shape (most runs) | flat 87% | flat 100% | flat 54% | flat 75% | flat 54% | one peak 46% | one peak 62% | one peak 50% | one peak 45% | one peak 63% | sawtooth rising 59% | sawtooth rising 47% | sawtooth 63% |
| taps follow tension (r) | 0.39 | 0.38 | 0.39 | 0.25 | 0.36 | 0.40 | 0.31 | 0.27 | 0.31 | 0.25 | 0.75 | 0.55 | 0.64 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 290 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, aegis, bomberWing | 54% | 12.3 | 3.0 | 4.3 | 0.76 (17) / 1.29 (17) / 2.00 (16) | 0.0 0.0 0.4 0.0 0.1 0.2 0.5 0.9 1.1 1.2 |
| off-counter | tesla, grapnel, fullSteam | 42% | 12.2 | 3.3 | 3.8 | 1.19 (16) / 1.88 (16) / 1.86 (14) | 0.0 0.0 0.3 0.0 0.3 0.2 0.5 0.8 0.5 1.1 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
