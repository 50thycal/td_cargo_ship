# Bot report: Saltgate Canal (`saltgate`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.9; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=saltgate --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/saltgate-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.42; doubles on w9 (0.25→0.67) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.67 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w5 ×1.19 of the no-encounter wave; outside on w5 ×1.19 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 44%, cold early 18% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.1 s → w10 5.4 s (slope -0.23 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.25 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.59 (22), r2 1.91 (22), r3 2.10 (21); tough (every run): 0.58, 1.92, 2.67 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 2.0 lost 1–10, end 13.5; off-counter 2.8 lost 1–10, end 13.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 9 loses 0.67 after 0.25. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 5 sends ×1.19 the no-encounter wave. Encounters should replace launches, not add them.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (0.71 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 18%, middle 44%, late 37%.

## Ships lost per wave

Normal: won 54%, mean end wave 13.2 (14 = won), 2.1 lost in waves 1–10, 0.25 in waves 1–5. Tough: 2.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.04 | 0.00 | 0.04 | 0.17 | 0.21 | 0.25 | 0.25 | 0.67 | 0.71 | 0.58 | 1.92 | 2.67 |
| normal, runs that reached it | 0.00 | 0.04 | 0.00 | 0.04 | 0.17 | 0.21 | 0.25 | 0.25 | 0.67 | 0.52 | 0.59 | 1.91 | 2.10 |
| normal, mean over all runs | 0.00 | 0.04 | 0.00 | 0.04 | 0.17 | 0.21 | 0.25 | 0.25 | 0.67 | 0.50 | 0.54 | 1.75 | 1.83 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 22 | 21 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.42.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 1.5 | 1.7 | 2.9 | 3.0 | 3.5 | 3.2 | 3.4 | 3.5 | 4.7 | 0.5 | 0.7 | 0.6 |
| runs with ≥ 1 | 4% | 88% | 96% | 79% | 96% | 100% | 100% | 100% | 100% | 96% | 33% | 54% | 46% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 15.5 | 23.4 | 20.8 | 29.1 | 23.3 | 29.8 | 30.8 | 38.3 | 39.3 |
| launches (encounters off) | 14.0 | 15.3 | 23.3 | 23.2 | 24.5 | 27.2 | 30.8 | 34.3 | 37.9 | 44.9 |
| **ratio to encounters off** | 1.07 | 1.01 | 1.01 | 0.89 | **1.19** | 0.85 | 0.97 | 0.90 | 1.01 | 0.88 |
| table × scale | 14 | 19 | 25 | 29 | 30 | 33 | 39 | 42 | 48 | 59 |
| ratio to table × scale | 1.07 | 0.81 | 0.94 | 0.72 | 0.97 | 0.70 | 0.76 | 0.73 | 0.80 | 0.67 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 18% / 10% | 44% / 59% | 37% / 31% | 71.4 | middle | early |
| all | 1–9 | 18% / 10% | 44% / 59% | 37% / 31% | 71.4 | middle | early |
| 1 | 1–13 | 19% / 15% | 47% / 63% | 34% / 22% | 120.3 | middle | early |
| all | 1–13 | 19% / 15% | 47% / 63% | 34% / 22% | 120.3 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.1 | 6.0 | 7.3 | 6.7 | 6.5 | 5.8 | 5.7 | 6.1 | 5.3 | 5.4 | 5.3 | 5.5 | 5.4 |
| launches read | 360 | 371 | 562 | 463 | 698 | 541 | 697 | 705 | 908 | 903 | 288 | 312 | 441 |

Slope over waves 1–10: -0.23 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.59 | 1.91 | 2.10 |
| runs that reached it | 22 | 22 | 21 |
| tough, every run | 0.58 | 1.92 | 2.67 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 22 | 21 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.3** | **0.0** | **0.0** | **0.2** | **0.0** | **0.3** | **0.5** | **0.8** |
| ships saved a run | 0.0 | 0.1 | 0.0 | 0.0 | 0.0 | 0.2 | 0.0 | 0.0 | 0.1 | 0.0 | 0.2 | 0.6 | 0.7 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.10 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.21 | 0.04 | 0.00 | 0.17 | 0.00 | 0.14 | 0.41 | 0.71 |
| runs with no save | 100% | 96% | 100% | 100% | 96% | 79% | 96% | 100% | 88% | 100% | 82% | 55% | 43% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.18 | 0.27 | 0.33 |
|   cover choice | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.13 | 0.00 | 0.00 | 0.08 | 0.00 | 0.05 | 0.09 | 0.24 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.10 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.08 | 0.00 | 0.05 | 0.09 | 0.14 |
| tension peak | 0.13 | 0.31 | 0.32 | 0.48 | 0.67 | 0.73 | 0.57 | 0.69 | 0.82 | 0.58 | 0.38 | 0.61 | 1.19 |
| peaks | 0.0 | 0.0 | 0.0 | 0.0 | 0.3 | 0.3 | 0.2 | 0.4 | 0.6 | 0.2 | 0.0 | 0.2 | 0.9 |
| release after a peak (s) | 0.0 | 0.1 | 0.0 | 0.0 | 0.7 | 0.5 | 0.3 | 0.7 | 0.9 | 0.3 | 0.2 | 0.5 | 2.8 |
| hot share | 0% | 0% | 0% | 0% | 1% | 1% | 0% | 1% | 2% | 0% | 0% | 1% | 11% |
| calm share | 100% | 92% | 91% | 87% | 84% | 88% | 87% | 88% | 80% | 85% | 83% | 64% | 54% |
| shape (most runs) | flat 100% | flat 96% | flat 100% | flat 100% | flat 71% | flat 67% | flat 79% | flat 62% | one peak 50% | flat 83% | flat 95% | flat 77% | one peak 90% |
| taps follow tension (r) | 0.44 | 0.35 | 0.28 | 0.47 | 0.46 | 0.43 | 0.42 | 0.38 | 0.38 | 0.28 | 0.45 | 0.24 | 0.26 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 281 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, gunships, supplyRun | 63% | 13.5 | 2.0 | 2.0 | 0.70 (23) / 1.87 (23) / 1.91 (22) | 0.0 0.0 0.0 0.1 0.3 0.3 0.2 0.3 0.3 0.5 |
| off-counter | seeker, shield, fullSteam | 71% | 13.5 | 2.6 | 2.8 | 0.43 (23) / 1.43 (23) / 2.27 (22) | 0.0 0.0 0.0 0.1 0.3 0.3 0.6 0.4 0.7 0.5 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
