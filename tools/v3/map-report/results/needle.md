# Bot report: The Needle of Bosk (`needle`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.95; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=needle --seeds=24 --kits=plan --no-fun`. Heat map: `tools/v3/map-report/results/needle-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w7 +0.71; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w6 1.38 a run (79% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.62 of the no-encounter wave; outside on w5 ×0.76, w6 ×0.67, w7 ×0.62, w8 ×0.63, w9 ×0.64, w10 ×0.65 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 45%, cold early 12% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.6 s → w10 6.1 s (slope -0.23 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.13 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 2.75 (4), r2 2.00 (4), r3 1.25 (4); tough (every run): 1.71, 2.71, 4.00 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 7.8 lost 1–10, end 9.4; off-counter 8.5 lost 1–10, end 9.1 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Budget: wave 5 sends ×0.76 the no-encounter wave; wave 6 sends ×0.67 the no-encounter wave; wave 7 sends ×0.62 the no-encounter wave; wave 8 sends ×0.63 the no-encounter wave; wave 9 sends ×0.64 the no-encounter wave; wave 10 sends ×0.65 the no-encounter wave. Encounters should replace launches, not add them.
- Hardest of waves 1–10 for the bot: wave 10 (2.00 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 12%, middle 43%, late 45%.

## Ships lost per wave

Normal: won 0%, mean end wave 9.3 (14 = won), 5.5 lost in waves 1–10, 1.13 in waves 1–5. Tough: 8.9 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.42 | 0.21 | 0.42 | 0.75 | 1.46 | 1.92 | 1.67 | 2.00 | 1.71 | 2.71 | 4.00 |
| normal, runs that reached it | 0.00 | 0.08 | 0.42 | 0.21 | 0.42 | 0.75 | 1.35 | 1.25 | 1.43 | 1.20 | 2.75 | 2.00 | 1.25 |
| normal, mean over all runs | 0.00 | 0.08 | 0.42 | 0.21 | 0.42 | 0.75 | 1.29 | 1.04 | 0.83 | 0.50 | 0.46 | 0.33 | 0.21 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 14 | 10 | 4 | 4 | 4 |

Biggest one-wave step up (tough, waves 2–10): wave 7, +0.71.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.2 | 1.0 | 3.4 | 3.0 | 3.8 | 1.4 | 2.5 | 1.6 | 3.6 | 3.1 | 1.7 | 1.8 | 2.8 |
| runs with ≥ 1 | 17% | 71% | 96% | 100% | 100% | 79% | 88% | 79% | 96% | 100% | 83% | 83% | 88% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 16.6 | 24.5 | 21.0 | 20.9 | 20.2 | 20.7 | 24.4 | 28.5 | 32.1 |
| launches (encounters off) | 15.0 | 16.6 | 25.4 | 23.6 | 27.5 | 30.1 | 33.4 | 39.0 | 44.2 | 49.4 |
| **ratio to encounters off** | 1.00 | 1.00 | 0.96 | 0.89 | **0.76** | **0.67** | **0.62** | **0.63** | **0.64** | **0.65** |
| table × scale | 15 | 20 | 26 | 30 | 31 | 36 | 41 | 45 | 52 | 62 |
| ratio to table × scale | 1.00 | 0.83 | 0.94 | 0.70 | 0.67 | 0.56 | 0.50 | 0.54 | 0.55 | 0.52 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 12% / 2% | 43% / 38% | 45% / 60% | 55.7 | late | early |
| all | 1–9 | 12% / 2% | 43% / 38% | 45% / 60% | 55.7 | late | early |
| 1 | 1–13 | 9% / 4% | 48% / 47% | 43% / 49% | 103.8 | middle | early |
| all | 1–13 | 9% / 4% | 48% / 47% | 43% / 49% | 103.8 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.6 | 6.8 | 5.8 | 5.7 | 4.5 | 5.7 | 4.9 | 5.5 | 5.2 | 6.1 | 5.6 | 5.1 | 4.7 |
| launches read | 360 | 398 | 562 | 503 | 500 | 481 | 491 | 582 | 680 | 745 | 216 | 241 | 273 |

Slope over waves 1–10: -0.23 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 2.75 | 2.00 | 1.25 |
| runs that reached it | 4 | 4 | 4 |
| tough, every run | 1.71 | 2.71 | 4.00 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, thermo, gunships | 4% | 9.4 | 4.9 | 7.8 | 2.80 (5) / 1.80 (5) / 1.20 (5) | 0.0 0.0 0.4 0.3 0.4 0.8 1.2 1.3 1.3 2.2 |
| off-counter | seeker, tesla, droneScreen | 0% | 9.1 | 5.8 | 8.5 | 3.00 (2) / 1.00 (2) / 2.00 (2) | 0.0 0.0 0.4 0.1 0.4 1.0 1.3 2.1 1.8 1.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
