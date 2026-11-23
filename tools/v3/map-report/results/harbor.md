# Bot report: Harbor Mouth (`harbor`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.6; built 2026-11-18.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=harbor --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/harbor-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +1.58; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 4.13 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w8 ×0.90 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 48%, cold early 22% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 10.7 s → w10 3.8 s (slope -0.53 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.58 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 5.00 (1), r2 0.00 (1), r3 1.00 (1); tough (every run): 2.79, 5.17, 4.54 | about 1 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 15.5 lost 1–10, end 7.8; off-counter 17.4 lost 1–10, end 7.8 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Hardest of waves 1–10 for the bot: wave 10 (5.21 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 22%, middle 48%, late 30%.

## Ships lost per wave

Normal: won 0%, mean end wave 7.9 (14 = won), 5.8 lost in waves 1–10, 1.58 in waves 1–5, 0.13 in bonus waves. Tough: 16.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.04 | 0.42 | 0.46 | 0.67 | 1.33 | 1.75 | 2.25 | 3.83 | 5.21 | 2.79 | 5.17 | 4.54 |
| normal, runs that reached it | 0.00 | 0.04 | 0.42 | 0.46 | 0.67 | 1.39 | 1.50 | 1.69 | 1.50 | 1.33 | 5.00 | 0.00 | 1.00 |
| normal, mean over all runs | 0.00 | 0.04 | 0.42 | 0.46 | 0.67 | 1.33 | 1.38 | 0.92 | 0.38 | 0.17 | 0.21 | 0.00 | 0.04 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 13 | 6 | 3 | 1 | 1 | 1 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +1.58.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 1.5 | 4.1 | 5.1 | 5.2 | 4.7 | 7.0 | 7.1 | 8.1 | 7.8 | 3.6 | 3.0 | 3.0 |
| runs with ≥ 1 | 8% | 88% | 96% | 92% | 96% | 100% | 96% | 100% | 100% | 100% | 92% | 92% | 83% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 10.0 | 14.5 | 12.8 | 18.1 | 25.3 | 26.2 | 34.3 | 33.0 | 36.8 | 43.8 |
| launches (encounters off) | 10.0 | 13.3 | 12.5 | 17.4 | 23.9 | 25.6 | 35.7 | 36.7 | 36.8 | 46.1 |
| **ratio to encounters off** | 1.00 | 1.09 | 1.03 | 1.04 | 1.06 | 1.02 | 0.96 | 0.90 | 1.00 | 0.95 |
| table × scale | 10 | 12 | 16 | 19 | 19 | 22 | 26 | 28 | 32 | 39 |
| ratio to table × scale | 1.00 | 1.21 | 0.80 | 0.95 | 1.33 | 1.19 | 1.32 | 1.18 | 1.15 | 1.12 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 22% / 7% | 48% / 56% | 30% / 36% | 76.4 | middle | early |
| all | 1–9 | 22% / 7% | 48% / 56% | 30% / 36% | 76.4 | middle | early |
| 1 | 1–13 | 23% / 10% | 50% / 62% | 27% / 28% | 156.2 | middle | early |
| all | 1–13 | 23% / 10% | 50% / 62% | 27% / 28% | 156.2 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.7 | 7.5 | 3.5 | 3.2 | 4.3 | 3.6 | 4.5 | 3.5 | 3.5 | 3.8 | 6.3 | 5.8 | 6.6 |
| launches read | 240 | 343 | 307 | 429 | 606 | 624 | 819 | 791 | 881 | 1046 | 599 | 644 | 624 |

Slope over waves 1–10: -0.53 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 5.00 | 0.00 | 1.00 |
| runs that reached it | 1 | 1 | 1 |
| tough, every run | 2.79 | 5.17 | 4.54 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | overdrive, railgun, focus | 0% | 7.8 | 5.8 | 15.5 | 0.00 (1) / 6.00 (1) / – (0) | 0.0 0.0 0.6 0.5 0.9 1.1 2.1 2.5 3.2 4.5 |
| off-counter | airstrike, seeker, droneScreen | 0% | 7.8 | 5.8 | 17.4 | 2.00 (1) / 1.00 (1) / 3.00 (1) | 0.0 0.0 0.5 0.3 0.7 1.1 1.9 3.0 4.5 5.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
