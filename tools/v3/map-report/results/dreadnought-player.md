# Bot report: Dreadnought Pass (`dreadnought`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.85; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=dreadnought --seeds=24 --armory=player --kits=plan`. Heat map: `tools/v3/map-report/results/dreadnought-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +0.33; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w9 1.75 a run (79% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w4 ×0.92 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 41%, cold early 18% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 7.1 s → w10 6.0 s (slope -0.24 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.46 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.71 (21), r2 1.38 (21), r3 2.10 (21); tough (every run): 0.71, 1.33, 2.25 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 2.3 lost 1–10, end 13.7; off-counter 2.8 lost 1–10, end 13.4 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (0.88 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 18%, middle 41%, late 40%.

## Ships lost per wave

Normal: won 63%, mean end wave 13.1 (14 = won), 2.8 lost in waves 1–10, 0.46 in waves 1–5. Tough: 3.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 0.17 | 0.25 | 0.13 | 0.42 | 0.63 | 0.54 | 0.88 | 0.71 | 1.33 | 2.25 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 0.17 | 0.25 | 0.13 | 0.42 | 0.58 | 0.57 | 0.68 | 0.71 | 1.38 | 2.10 |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 0.17 | 0.25 | 0.13 | 0.42 | 0.58 | 0.54 | 0.63 | 0.63 | 1.21 | 1.83 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 21 | 21 | 21 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +0.33.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.4 | 1.1 | 1.9 | 1.2 | 1.1 | 1.8 | 1.6 | 1.7 | 2.9 | 1.9 | 1.4 | 2.1 | 2.9 |
| kills a minute | 35 | 31 | 48 | 30 | 29 | 44 | 32 | 37 | 55 | 39 | 25 | 41 | 53 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.5 | 1.6 | 2.4 | 1.9 | 2.1 | 2.6 | 3.1 | 2.0 | 1.8 | 3.8 | 1.9 | 2.7 | 4.3 |
| runs with ≥ 1 | 96% | 96% | 92% | 88% | 92% | 96% | 96% | 88% | 79% | 96% | 92% | 92% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 14.3 | 14.6 | 34.3 | 17.3 | 21.2 | 39.2 | 32.4 | 33.8 | 58.5 | 62.8 |
| launches (encounters off) | 14.0 | 13.6 | 36.7 | 18.8 | 20.5 | 41.3 | 32.5 | 34.3 | 55.5 | 61.2 |
| **ratio to encounters off** | 1.02 | 1.08 | 0.93 | 0.92 | 1.03 | 0.95 | 1.00 | 0.98 | 1.05 | 1.03 |
| table × scale | 14 | 18 | 23 | 26 | 27 | 32 | 36 | 40 | 46 | 55 |
| ratio to table × scale | 1.02 | 0.81 | 1.49 | 0.67 | 0.78 | 1.23 | 0.90 | 0.84 | 1.27 | 1.14 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 18% / 10% | 41% / 50% | 40% / 40% | 35.5 | middle | early |
| all | 1–9 | 18% / 10% | 41% / 50% | 40% / 40% | 35.5 | middle | early |
| 1 | 1–13 | 19% / 14% | 38% / 31% | 43% / 55% | 75.3 | late | early |
| all | 1–13 | 19% / 14% | 38% / 31% | 43% / 55% | 75.3 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.1 | 10.0 | 7.6 | 6.7 | 5.9 | 6.2 | 7.1 | 7.2 | 5.9 | 6.0 | 5.7 | 5.2 | 5.4 |
| launches read | 431 | 441 | 869 | 451 | 542 | 976 | 775 | 811 | 1401 | 1503 | 398 | 579 | 801 |

Slope over waves 1–10: -0.24 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.71 | 1.38 | 2.10 |
| runs that reached it | 21 | 21 | 21 |
| tough, every run | 0.71 | 1.33 | 2.25 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 21 | 21 | 21 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.0** | **0.2** | **0.3** | **0.1** | **0.5** | **0.1** | **0.3** | **0.6** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.1 | 0.2 | 0.1 | 0.3 | 0.1 | 0.2 | 0.4 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.18 | 0.00 | 0.00 | 0.05 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.08 | 0.21 | 0.04 | 0.32 | 0.14 | 0.19 | 0.38 |
| runs with no save | 100% | 100% | 100% | 96% | 88% | 96% | 83% | 79% | 91% | 68% | 86% | 71% | 62% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.13 | 0.04 | 0.00 | 0.36 | 0.10 | 0.19 | 0.14 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.08 | 0.04 | 0.00 | 0.00 | 0.05 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.04 | 0.09 | 0.05 | 0.00 | 0.19 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.00 | 0.00 | 0.17 | 0.04 | 0.00 | 0.00 | 0.05 | 0.29 |
| tension peak | 0.35 | 0.36 | 0.47 | 0.84 | 0.67 | 0.62 | 1.66 | 0.64 | 0.73 | 0.94 | 0.92 | 1.12 | 1.09 |
| peaks | 0.0 | 0.0 | 0.0 | 0.6 | 0.3 | 0.3 | 1.0 | 0.5 | 0.6 | 0.5 | 1.2 | 1.9 | 2.0 |
| release after a peak (s) | 0.0 | 0.0 | 0.0 | 1.1 | 0.8 | 0.6 | 2.2 | 0.8 | 1.0 | 0.9 | 1.3 | 1.9 | 2.2 |
| hot share | 0% | 0% | 0% | 3% | 2% | 1% | 4% | 1% | 2% | 1% | 6% | 11% | 16% |
| calm share | 86% | 94% | 78% | 89% | 88% | 83% | 86% | 86% | 77% | 87% | 79% | 63% | 56% |
| shape (most runs) | flat 100% | flat 100% | flat 100% | one peak 62% | flat 67% | flat 75% | one peak 87% | flat 62% | flat 61% | one peak 55% | one peak 43% | sawtooth 48% | sawtooth 48% |
| taps follow tension (r) | 0.19 | 0.07 | 0.13 | 0.33 | 0.35 | 0.16 | 0.34 | 0.23 | 0.14 | 0.32 | 0.34 | 0.30 | 0.20 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 99 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, shield, gunships | 83% | 13.7 | 2.3 | 2.3 | 0.61 (23) / 1.78 (23) / 1.87 (23) | 0.0 0.0 0.0 0.1 0.2 0.0 0.3 0.5 0.4 0.7 |
| off-counter | seeker, orbital, bomberWing | 67% | 13.4 | 2.8 | 2.8 | 0.73 (22) / 1.23 (22) / 2.05 (22) | 0.0 0.0 0.1 0.1 0.4 0.1 0.5 0.6 0.4 0.7 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
