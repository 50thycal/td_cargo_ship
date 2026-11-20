# Bot report: Saltgate Canal (`saltgate`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.9; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=saltgate --seeds=24 --kits=plan --no-fun`. Heat map: `tools/v3/map-report/results/saltgate-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w4 +1.00; doubles on w4 (0.04→1.04) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.46 a run (75% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w2 ×0.74 of the no-encounter wave; outside on w2 ×0.74, w4 ×1.15, w10 ×0.80 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 47%, cold early 21% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.1 s → w10 5.4 s (slope -0.25 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 2.08 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (3), r2 1.00 (3), r3 2.33 (3); tough (every run): 1.92, 2.54, 3.38 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 10.1 lost 1–10, end 8.8; off-counter 16.5 lost 1–10, end 7.2 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 4 loses 1.04 after 0.04. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 2 sends ×0.74 the no-encounter wave; wave 4 sends ×1.15 the no-encounter wave; wave 10 sends ×0.80 the no-encounter wave. Encounters should replace launches, not add them.
- Hardest of waves 1–10 for the bot: wave 9 (2.88 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 21%, middle 47%, late 33%.

## Ships lost per wave

Normal: won 13%, mean end wave 8.4 (14 = won), 5.5 lost in waves 1–10, 2.08 in waves 1–5. Tough: 13.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.21 | 0.04 | 1.04 | 1.13 | 1.63 | 1.63 | 2.25 | 2.88 | 2.21 | 1.92 | 2.54 | 3.38 |
| normal, runs that reached it | 0.00 | 0.21 | 0.04 | 0.96 | 0.91 | 1.32 | 1.00 | 1.29 | 1.40 | 0.40 | 0.00 | 1.00 | 2.33 |
| normal, mean over all runs | 0.00 | 0.21 | 0.04 | 0.96 | 0.88 | 1.21 | 0.83 | 0.75 | 0.58 | 0.08 | 0.00 | 0.13 | 0.29 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 23 | 22 | 20 | 14 | 10 | 5 | 3 | 3 | 3 |

Biggest one-wave step up (tough, waves 2–10): wave 4, +1.00.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 1.3 | 1.5 | 2.2 | 2.9 | 3.5 | 2.5 | 3.0 | 3.3 | 3.8 | 0.4 | 0.5 | 1.3 |
| runs with ≥ 1 | 4% | 79% | 75% | 83% | 96% | 100% | 96% | 96% | 96% | 88% | 38% | 38% | 67% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 12.8 | 22.3 | 26.7 | 23.8 | 24.6 | 30.0 | 31.6 | 37.8 | 37.5 |
| launches (encounters off) | 14.0 | 17.2 | 23.0 | 23.1 | 25.4 | 27.9 | 31.7 | 36.9 | 39.3 | 47.0 |
| **ratio to encounters off** | 1.07 | **0.74** | 0.97 | **1.15** | 0.94 | 0.88 | 0.95 | 0.86 | 0.96 | **0.80** |
| table × scale | 14 | 19 | 25 | 29 | 30 | 33 | 39 | 42 | 48 | 59 |
| ratio to table × scale | 1.07 | 0.67 | 0.89 | 0.92 | 0.79 | 0.74 | 0.77 | 0.75 | 0.79 | 0.64 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 21% / 7% | 47% / 47% | 33% / 46% | 83.7 | middle | early |
| all | 1–9 | 21% / 7% | 47% / 47% | 33% / 46% | 83.7 | middle | early |
| 1 | 1–13 | 23% / 13% | 50% / 55% | 27% / 32% | 133.8 | middle | early |
| all | 1–13 | 23% / 13% | 50% / 55% | 27% / 32% | 133.8 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.1 | 6.5 | 7.6 | 6.4 | 5.8 | 5.6 | 5.8 | 6.1 | 5.4 | 5.4 | 5.2 | 5.6 | 5.4 |
| launches read | 360 | 305 | 534 | 619 | 572 | 566 | 704 | 719 | 900 | 848 | 288 | 312 | 471 |

Slope over waves 1–10: -0.25 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 1.00 | 2.33 |
| runs that reached it | 3 | 3 | 3 |
| tough, every run | 1.92 | 2.54 | 3.38 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, gunships, supplyRun | 8% | 8.8 | 5.5 | 10.1 | 1.33 (6) / 2.17 (6) / 1.50 (6) | 0.0 0.0 0.0 1.0 0.9 1.1 1.5 1.3 2.3 2.0 |
| off-counter | seeker, shield, fullSteam | 0% | 7.2 | 6.0 | 16.5 | – (0) / – (0) / – (0) | 0.0 0.2 0.0 1.4 1.7 1.9 1.3 3.5 4.7 1.9 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
