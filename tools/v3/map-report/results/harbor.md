# Bot report: Harbor Mouth (`harbor`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.6; built 2026-11-17.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=harbor --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/harbor-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +1.50; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 4.13 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w8 ×0.90 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 49%, cold early 20% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 10.7 s → w10 4.0 s (slope -0.51 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.71 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 – (0), r2 – (0), r3 – (0); tough (every run): 3.46, 4.71, 4.92 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 17.0 lost 1–10, end 7.8; off-counter 18.8 lost 1–10, end 7.8 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Hardest of waves 1–10 for the bot: wave 10 (4.79 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 20%, middle 49%, late 31%.

## Ships lost per wave

Normal: won 0%, mean end wave 7.4 (14 = won), 5.7 lost in waves 1–10, 1.71 in waves 1–5, 0.17 in bonus waves. Tough: 16.7 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.04 | 0.42 | 0.50 | 0.75 | 1.46 | 2.25 | 2.50 | 4.00 | 4.79 | 3.46 | 4.71 | 4.92 |
| normal, runs that reached it | 0.00 | 0.04 | 0.42 | 0.50 | 0.75 | 1.52 | 1.80 | 1.77 | 2.00 | – | – | – | – |
| normal, mean over all runs | 0.00 | 0.04 | 0.42 | 0.50 | 0.75 | 1.46 | 1.50 | 0.96 | 0.08 | 0.00 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 13 | 1 | 0 | 0 | 0 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +1.50.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 1.5 | 4.1 | 4.8 | 4.8 | 5.3 | 5.8 | 5.8 | 7.5 | 8.1 | 2.6 | 2.9 | 6.2 |
| runs with ≥ 1 | 8% | 88% | 96% | 88% | 96% | 100% | 96% | 100% | 100% | 100% | 88% | 92% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 10.0 | 14.5 | 12.8 | 18.1 | 25.1 | 25.8 | 34.2 | 33.3 | 36.7 | 42.3 |
| launches (encounters off) | 10.0 | 13.3 | 12.5 | 17.4 | 24.1 | 25.4 | 36.2 | 37.0 | 37.0 | 45.9 |
| **ratio to encounters off** | 1.00 | 1.09 | 1.03 | 1.04 | 1.04 | 1.02 | 0.94 | 0.90 | 0.99 | 0.92 |
| table × scale | 10 | 12 | 16 | 19 | 19 | 22 | 26 | 28 | 32 | 39 |
| ratio to table × scale | 1.00 | 1.21 | 0.80 | 0.95 | 1.32 | 1.17 | 1.32 | 1.19 | 1.15 | 1.09 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 20% / 9% | 49% / 55% | 31% / 36% | 80.3 | middle | early |
| all | 1–9 | 20% / 9% | 49% / 55% | 31% / 36% | 80.3 | middle | early |
| 1 | 1–13 | 23% / 12% | 50% / 58% | 27% / 30% | 159.5 | middle | early |
| all | 1–13 | 23% / 12% | 50% / 58% | 27% / 30% | 159.5 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.7 | 7.5 | 3.5 | 3.2 | 4.3 | 3.6 | 4.6 | 3.5 | 3.7 | 4.0 | 6.3 | 5.8 | 5.9 |
| launches read | 240 | 343 | 307 | 430 | 603 | 616 | 820 | 797 | 877 | 1012 | 598 | 639 | 694 |

Slope over waves 1–10: -0.51 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | – | – | – |
| runs that reached it | 0 | 0 | 0 |
| tough, every run | 3.46 | 4.71 | 4.92 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | overdrive, railgun, focus | 0% | 7.8 | 6.0 | 17.0 | – (0) / – (0) / – (0) | 0.0 0.0 0.6 0.5 1.2 0.8 2.0 2.7 4.4 4.6 |
| off-counter | airstrike, seeker, droneScreen | 0% | 7.8 | 5.9 | 18.8 | – (0) / – (0) / – (0) | 0.0 0.0 0.5 0.3 1.0 1.1 2.0 2.5 4.9 6.4 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
