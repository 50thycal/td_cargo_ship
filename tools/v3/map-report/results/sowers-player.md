# Bot report: Sowers' Reach (`sowers`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.45; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=sowers --seeds=24 --armory=player --kits=plan`. Heat map: `tools/v3/map-report/results/sowers-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +1.00; doubles on w8 (0.25→1.13), w10 (0.88→1.88) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 1.08 a run (58% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.89 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 43%, cold early 19% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.8 s → w10 5.1 s (slope -0.41 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.63 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.93 (14), r2 0.71 (14), r3 1.71 (14); tough (every run): 0.75, 1.00, 1.38 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 5.0 lost 1–10, end 12.3; off-counter 5.2 lost 1–10, end 11.9 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 8 loses 1.13 after 0.25; wave 10 loses 1.88 after 0.88. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.88 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 19%, middle 38%, late 43%.

## Ships lost per wave

Normal: won 58%, mean end wave 12.0 (14 = won), 4.4 lost in waves 1–10, 0.63 in waves 1–5. Tough: 5.2 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.17 | 0.21 | 0.17 | 0.46 | 0.25 | 1.13 | 0.88 | 1.88 | 0.75 | 1.00 | 1.38 |
| normal, runs that reached it | 0.00 | 0.08 | 0.17 | 0.21 | 0.17 | 0.38 | 0.26 | 1.17 | 0.86 | 1.43 | 0.93 | 0.71 | 1.71 |
| normal, mean over all runs | 0.00 | 0.08 | 0.17 | 0.21 | 0.17 | 0.38 | 0.25 | 1.13 | 0.79 | 1.25 | 0.54 | 0.42 | 1.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 22 | 21 | 14 | 14 | 14 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +1.00.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.1 | 2.3 | 2.0 | 2.0 | 2.1 | 2.4 | 2.0 | 2.5 | 2.6 | 2.2 | 2.9 | 3.7 | 6.4 |
| kills a minute | 54 | 53 | 51 | 48 | 48 | 49 | 47 | 49 | 52 | 45 | 39 | 59 | 64 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 1.0 | 1.8 | 1.1 | 1.5 | 1.9 | 3.4 | 2.5 | 4.2 | 5.6 | 1.1 | 1.2 | 1.2 |
| runs with ≥ 1 | 4% | 58% | 92% | 58% | 92% | 75% | 92% | 96% | 100% | 96% | 63% | 75% | 63% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.3 | 31.3 | 34.8 | 38.5 | 37.5 | 42.2 | 43.5 | 49.5 | 53.4 | 63.0 |
| launches (encounters off) | 25.0 | 29.8 | 38.0 | 37.6 | 40.3 | 43.4 | 49.1 | 52.7 | 57.8 | 67.2 |
| **ratio to encounters off** | 0.97 | 1.05 | 0.92 | 1.02 | 0.93 | 0.97 | 0.89 | 0.94 | 0.92 | 0.94 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.05 | 1.01 | 0.89 | 0.87 | 0.82 | 0.80 | 0.70 | 0.73 | 0.68 | 0.67 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 19% / 13% | 38% / 41% | 43% / 46% | 41.2 | late | early |
| all | 1–9 | 19% / 13% | 38% / 41% | 43% / 46% | 41.2 | late | early |
| 1 | 1–13 | 17% / 16% | 37% / 40% | 45% / 45% | 74.0 | late | early |
| all | 1–13 | 17% / 16% | 37% / 40% | 45% / 45% | 74.0 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.8 | 8.3 | 7.7 | 7.6 | 7.2 | 5.6 | 6.1 | 5.9 | 5.6 | 5.1 | 1.7 | 1.6 | 1.6 |
| launches read | 600 | 743 | 818 | 811 | 812 | 844 | 887 | 1011 | 1088 | 1290 | 216 | 288 | 312 |

Slope over waves 1–10: -0.41 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.93 | 0.71 | 1.71 |
| runs that reached it | 14 | 14 | 14 |
| tough, every run | 0.75 | 1.00 | 1.38 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 22 | 21 | 14 | 14 | 14 |
| **saves a run** | **0.0** | **0.1** | **0.0** | **0.2** | **0.1** | **0.1** | **0.2** | **0.4** | **0.5** | **0.4** | **0.1** | **0.4** | **0.4** |
| ships saved a run | 0.0 | 0.1 | 0.0 | 0.1 | 0.1 | 0.1 | 0.2 | 0.4 | 0.5 | 0.3 | 0.1 | 0.3 | 0.3 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.19 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.08 | 0.00 | 0.08 | 0.04 | 0.04 | 0.13 | 0.26 | 0.41 | 0.33 | 0.07 | 0.14 | 0.21 |
| runs with no save | 96% | 88% | 100% | 88% | 88% | 92% | 91% | 70% | 55% | 71% | 86% | 79% | 57% |
|   pickup save | 0.00 | 0.08 | 0.00 | 0.08 | 0.00 | 0.04 | 0.09 | 0.17 | 0.36 | 0.14 | 0.14 | 0.29 | 0.21 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.00 | 0.14 | 0.00 | 0.00 | 0.07 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.13 | 0.00 | 0.14 | 0.05 | 0.00 | 0.07 | 0.14 |
|   kill save | 0.04 | 0.04 | 0.00 | 0.04 | 0.08 | 0.04 | 0.00 | 0.13 | 0.05 | 0.10 | 0.00 | 0.07 | 0.00 |
| tension peak | 0.15 | 0.47 | 0.50 | 0.33 | 0.42 | 0.58 | 0.67 | 0.88 | 0.93 | 1.29 | 0.73 | 0.70 | 0.95 |
| peaks | 0.0 | 0.2 | 0.0 | 0.1 | 0.0 | 0.2 | 0.4 | 0.7 | 0.9 | 1.2 | 0.5 | 0.4 | 0.9 |
| release after a peak (s) | 0.0 | 0.4 | 0.1 | 0.3 | 0.1 | 0.3 | 1.1 | 1.2 | 1.7 | 2.3 | 0.9 | 0.6 | 2.6 |
| hot share | 0% | 1% | 0% | 0% | 0% | 1% | 2% | 3% | 4% | 5% | 2% | 2% | 3% |
| calm share | 99% | 90% | 90% | 94% | 88% | 83% | 83% | 77% | 75% | 74% | 70% | 58% | 51% |
| shape (most runs) | flat 100% | flat 83% | flat 96% | flat 92% | flat 96% | flat 83% | flat 65% | flat 43% | one peak 45% | one peak 48% | one peak 50% | flat 64% | one peak 93% |
| taps follow tension (r) | 0.44 | 0.43 | 0.28 | 0.47 | 0.38 | 0.40 | 0.40 | 0.41 | 0.40 | 0.37 | 0.42 | 0.37 | 0.27 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w10. 24 runs, 185 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | tesla, flak, shield | 58% | 12.3 | 4.4 | 5.0 | 0.60 (15) / 1.27 (15) / 1.60 (15) | 0.0 0.1 0.2 0.2 0.2 0.3 0.3 0.9 1.2 1.8 |
| off-counter | seeker, shrapnel, fullSteam | 46% | 11.9 | 4.3 | 5.2 | 0.86 (14) / 0.93 (14) / 1.93 (14) | 0.0 0.0 0.1 0.2 0.3 0.5 0.5 0.8 0.9 1.8 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
