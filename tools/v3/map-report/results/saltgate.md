# Bot report: Saltgate Canal (`saltgate`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.9; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=saltgate --seeds=24 --kits=plan --no-fun`. Heat map: `tools/v3/map-report/results/saltgate-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w7 +0.83; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 1.17 a run (67% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.88 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 45%, cold early 26% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 8.3 s → w10 4.8 s (slope -0.30 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.38 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 3.00 (2), r2 3.00 (2), r3 – (0); tough (every run): 1.42, 5.13, 5.75 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 10.3 lost 1–10, end 8.7; off-counter 15.0 lost 1–10, end 8.4 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- No safe stretch on lane 1 (coldest early takes 26%): aim waves 1–9 away from it.
- Hardest of waves 1–10 for the bot: wave 10 (3.21 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 26%, middle 45%, late 29%.

## Ships lost per wave

Normal: won 0%, mean end wave 8.7 (14 = won), 5.9 lost in waves 1–10, 1.38 in waves 1–5. Tough: 11.9 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.08 | 0.50 | 0.79 | 0.96 | 1.79 | 1.92 | 2.63 | 3.21 | 1.42 | 5.13 | 5.75 |
| normal, runs that reached it | 0.00 | 0.00 | 0.08 | 0.50 | 0.79 | 0.96 | 1.48 | 1.45 | 1.25 | 1.33 | 3.00 | 3.00 | – |
| normal, mean over all runs | 0.00 | 0.00 | 0.08 | 0.50 | 0.79 | 0.96 | 1.42 | 1.21 | 0.63 | 0.33 | 0.25 | 0.25 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 12 | 6 | 2 | 2 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 7, +0.83.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 2.0 | 1.2 | 1.5 | 1.2 | 4.3 | 3.0 | 4.0 | 4.5 | 5.7 | 2.0 | 3.3 | 4.4 |
| runs with ≥ 1 | 0% | 92% | 67% | 79% | 63% | 100% | 88% | 96% | 96% | 100% | 88% | 100% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 14.0 | 15.5 | 21.7 | 23.0 | 25.4 | 26.3 | 32.0 | 34.5 | 40.4 | 41.6 |
| launches (encounters off) | 14.0 | 17.2 | 23.0 | 23.1 | 25.4 | 27.9 | 31.7 | 36.9 | 39.3 | 47.0 |
| **ratio to encounters off** | 1.00 | 0.90 | 0.94 | 1.00 | 1.00 | 0.94 | 1.01 | 0.94 | 1.03 | 0.88 |
| table × scale | 14 | 19 | 25 | 29 | 30 | 33 | 39 | 42 | 48 | 59 |
| ratio to table × scale | 1.00 | 0.81 | 0.87 | 0.79 | 0.85 | 0.80 | 0.82 | 0.82 | 0.84 | 0.70 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 26% / 25% | 45% / 41% | 29% / 35% | 74.7 | middle | early |
| all | 1–9 | 26% / 25% | 45% / 41% | 29% / 35% | 74.7 | middle | early |
| 1 | 1–13 | 34% / 35% | 41% / 36% | 25% / 29% | 141.7 | middle | late |
| all | 1–13 | 34% / 35% | 41% / 36% | 25% / 29% | 141.7 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.3 | 5.9 | 7.3 | 6.6 | 6.3 | 5.4 | 5.7 | 5.7 | 5.2 | 4.8 | 4.9 | 4.7 | 4.4 |
| launches read | 336 | 370 | 519 | 535 | 602 | 609 | 747 | 788 | 957 | 961 | 609 | 863 | 938 |

Slope over waves 1–10: -0.30 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 3.00 | 3.00 | – |
| runs that reached it | 2 | 2 | 0 |
| tough, every run | 1.42 | 5.13 | 5.75 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, gunships, supplyRun | 0% | 8.7 | 5.5 | 10.3 | 1.00 (3) / 2.67 (3) / 3.50 (2) | 0.0 0.0 0.1 0.5 0.8 1.1 1.0 2.1 2.4 2.3 |
| off-counter | seeker, shield, fullSteam | 4% | 8.4 | 6.1 | 15.0 | 1.00 (1) / 1.00 (1) / 3.00 (1) | 0.0 0.0 0.2 0.6 0.8 1.8 1.7 2.4 3.8 3.8 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
