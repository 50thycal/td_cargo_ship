# Bot report: Saltgate Canal (`saltgate`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.9; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=saltgate --seeds=24 --kits=plan --no-fun`. Heat map: `tools/v3/map-report/results/saltgate-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.92; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w5 0.83 a run (63% of runs have one); under 1 on w5 | ≥ 1 a run on every wave 3–10 | tough | **FLAG** |
| `w-budget` | Wave budgets ±15% | furthest w6 ×0.83 of the no-encounter wave; outside on w2 ×0.85, w6 ×0.83 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 43%, cold early 19% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.1 s → w10 5.0 s (slope -0.27 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.38 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.80 (5), r2 3.00 (5), r3 2.67 (3); tough (every run): 1.38, 2.46, 2.71 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 5.9 lost 1–10, end 10.6; off-counter 12.4 lost 1–10, end 8.3 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Too few close calls on wave 5 (0.83): give those waves a launch from a near site, or one aimed at the danger stretch.
- Budget: wave 2 sends ×0.85 the no-encounter wave; wave 6 sends ×0.83 the no-encounter wave. Encounters should replace launches, not add them.
- Hardest of waves 1–10 for the bot: wave 10 (2.63 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 19%, middle 43%, late 38%.

## Ships lost per wave

Normal: won 0%, mean end wave 9.4 (14 = won), 5.5 lost in waves 1–10, 1.38 in waves 1–5. Tough: 10.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.17 | 0.17 | 0.46 | 0.58 | 1.00 | 1.08 | 1.50 | 2.42 | 2.63 | 1.38 | 2.46 | 2.71 |
| normal, runs that reached it | 0.00 | 0.17 | 0.17 | 0.46 | 0.58 | 0.92 | 0.87 | 0.84 | 1.94 | 0.90 | 1.80 | 3.00 | 2.67 |
| normal, mean over all runs | 0.00 | 0.17 | 0.17 | 0.46 | 0.58 | 0.92 | 0.83 | 0.67 | 1.29 | 0.38 | 0.38 | 0.63 | 0.33 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 19 | 16 | 10 | 5 | 5 | 3 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.92.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 1.1 | 1.5 | 2.0 | 0.8 | 4.4 | 2.8 | 3.5 | 4.0 | 4.7 | 1.3 | 2.0 | 2.3 |
| runs with ≥ 1 | 4% | 79% | 92% | 92% | 63% | 100% | 96% | 96% | 96% | 92% | 50% | 75% | 79% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 14.5 | 23.4 | 22.6 | 24.0 | 22.9 | 30.2 | 33.2 | 38.0 | 39.6 |
| launches (encounters off) | 14.0 | 17.2 | 23.0 | 23.2 | 24.9 | 27.5 | 31.2 | 37.7 | 38.4 | 45.9 |
| **ratio to encounters off** | 1.07 | **0.85** | 1.02 | 0.97 | 0.96 | **0.83** | 0.97 | 0.88 | 0.99 | 0.86 |
| table × scale | 14 | 19 | 25 | 29 | 30 | 33 | 39 | 42 | 48 | 59 |
| ratio to table × scale | 1.07 | 0.77 | 0.94 | 0.78 | 0.80 | 0.69 | 0.77 | 0.79 | 0.79 | 0.67 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 19% / 8% | 43% / 39% | 38% / 53% | 69.2 | middle | early |
| all | 1–9 | 19% / 8% | 43% / 39% | 38% / 53% | 69.2 | middle | early |
| 1 | 1–13 | 20% / 10% | 49% / 57% | 32% / 33% | 111.2 | middle | early |
| all | 1–13 | 20% / 10% | 49% / 57% | 32% / 33% | 111.2 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.1 | 6.1 | 7.1 | 6.5 | 7.1 | 5.5 | 5.8 | 5.8 | 5.2 | 5.0 | 4.9 | 5.0 | 5.2 |
| launches read | 360 | 349 | 561 | 541 | 575 | 547 | 719 | 789 | 908 | 948 | 415 | 516 | 547 |

Slope over waves 1–10: -0.27 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.80 | 3.00 | 2.67 |
| runs that reached it | 5 | 5 | 3 |
| tough, every run | 1.38 | 2.46 | 2.71 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, gunships, supplyRun | 17% | 10.6 | 4.3 | 5.9 | 1.42 (12) / 2.75 (12) / 2.00 (9) | 0.0 0.0 0.1 0.5 0.3 0.7 0.7 0.8 1.8 1.1 |
| off-counter | seeker, shield, fullSteam | 4% | 8.3 | 5.7 | 12.4 | 0.00 (1) / 4.00 (1) / 0.00 (1) | 0.0 0.2 0.1 0.3 0.8 1.0 1.5 2.8 3.8 1.9 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
