# Bot report: Saltgate Canal (`saltgate`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 0.9; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=saltgate --seeds=24 --kits=plan --armory=latest --no-fun`. Heat map: `tools/v3/map-report/results/saltgate-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.63; doubles on w5 (0.38→0.92) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.50 a run (79% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.82 of the no-encounter wave; outside on w2 ×0.83, w4 ×1.17, w10 ×0.82 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 42%, cold early 23% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.1 s → w10 5.3 s (slope -0.26 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.38 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.33 (12), r2 1.17 (12), r3 1.73 (11); tough (every run): 0.42, 1.29, 1.67 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 4.0 lost 1–10, end 12.3; off-counter 6.8 lost 1–10, end 10.6 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 5 loses 0.92 after 0.38. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 2 sends ×0.83 the no-encounter wave; wave 4 sends ×1.17 the no-encounter wave; wave 10 sends ×0.82 the no-encounter wave. Encounters should replace launches, not add them.
- Hardest of waves 1–10 for the bot: wave 9 (1.67 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 23%, middle 42%, late 35%.

## Ships lost per wave

Normal: won 38%, mean end wave 10.8 (14 = won), 4.8 lost in waves 1–10, 1.38 in waves 1–5. Tough: 7.1 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.04 | 0.38 | 0.92 | 1.13 | 0.58 | 1.04 | 1.67 | 1.29 | 0.42 | 1.29 | 1.67 |
| normal, runs that reached it | 0.00 | 0.08 | 0.04 | 0.38 | 0.88 | 1.00 | 0.38 | 1.05 | 0.95 | 0.86 | 0.33 | 1.17 | 1.73 |
| normal, mean over all runs | 0.00 | 0.08 | 0.04 | 0.38 | 0.88 | 0.96 | 0.33 | 0.83 | 0.75 | 0.50 | 0.17 | 0.58 | 0.79 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 21 | 19 | 19 | 14 | 12 | 12 | 11 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.63.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 1.4 | 1.5 | 2.6 | 2.5 | 4.6 | 2.8 | 2.8 | 4.4 | 3.8 | 0.4 | 0.7 | 1.1 |
| runs with ≥ 1 | 8% | 83% | 79% | 83% | 100% | 100% | 83% | 88% | 100% | 92% | 38% | 42% | 46% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 13.1 | 22.3 | 27.0 | 24.0 | 24.6 | 29.7 | 31.3 | 37.5 | 37.1 |
| launches (encounters off) | 14.0 | 15.9 | 23.2 | 23.1 | 25.5 | 27.8 | 30.3 | 35.5 | 38.3 | 45.3 |
| **ratio to encounters off** | 1.07 | **0.83** | 0.96 | **1.17** | 0.94 | 0.88 | 0.98 | 0.88 | 0.98 | **0.82** |
| table × scale | 14 | 19 | 25 | 29 | 30 | 33 | 39 | 42 | 48 | 59 |
| ratio to table × scale | 1.07 | 0.69 | 0.89 | 0.93 | 0.80 | 0.74 | 0.76 | 0.74 | 0.78 | 0.63 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 23% / 9% | 42% / 41% | 35% / 51% | 61.5 | middle | early |
| all | 1–9 | 23% / 9% | 42% / 41% | 35% / 51% | 61.5 | middle | early |
| 1 | 1–13 | 23% / 11% | 44% / 46% | 33% / 43% | 96.7 | middle | early |
| all | 1–13 | 23% / 11% | 44% / 46% | 33% / 43% | 96.7 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.1 | 6.4 | 7.6 | 6.6 | 5.9 | 5.5 | 5.9 | 5.8 | 5.5 | 5.3 | 5.3 | 5.6 | 5.6 |
| launches read | 360 | 311 | 532 | 626 | 575 | 570 | 695 | 706 | 890 | 852 | 288 | 312 | 465 |

Slope over waves 1–10: -0.26 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.33 | 1.17 | 1.73 |
| runs that reached it | 12 | 12 | 11 |
| tough, every run | 0.42 | 1.29 | 1.67 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, gunships, supplyRun | 42% | 12.3 | 3.6 | 4.0 | 0.78 (18) / 1.50 (18) / 2.06 (18) | 0.0 0.0 0.0 0.2 0.3 1.0 0.3 0.8 0.5 0.9 |
| off-counter | seeker, shield, fullSteam | 29% | 10.6 | 4.9 | 6.8 | 1.00 (11) / 2.00 (11) / 1.11 (9) | 0.0 0.1 0.0 0.5 0.8 1.2 0.5 1.4 1.2 1.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
