# Bot report: The Strait (`strait`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.7; built 2026-11-17.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=strait --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/strait-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.58; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w5 1.83 a run (92% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.90 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 53%, cold early 15% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.6 s → w10 5.4 s (slope -0.52 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.54 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 3.20 (10), r2 3.14 (7), r3 5.00 (1); tough (every run): 3.67, 5.29, 5.21 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 7.6 lost 1–10, end 10.0; off-counter 7.6 lost 1–10, end 9.7 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Hardest of waves 1–10 for the bot: wave 10 (2.08 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 15%, middle 32%, late 53%.

## Ships lost per wave

Normal: won 4%, mean end wave 10.2 (14 = won), 5.2 lost in waves 1–10, 0.54 in waves 1–5, 0.13 in bonus waves. Tough: 7.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.00 | 0.21 | 0.33 | 0.58 | 1.08 | 1.21 | 1.79 | 2.08 | 3.67 | 5.29 | 5.21 |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 | 0.21 | 0.33 | 0.48 | 1.09 | 1.26 | 1.41 | 1.00 | 3.20 | 3.14 | 5.00 |
| normal, mean over all runs | 0.00 | 0.00 | 0.00 | 0.21 | 0.33 | 0.46 | 1.04 | 1.21 | 1.29 | 0.63 | 1.33 | 0.92 | 0.21 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 22 | 15 | 10 | 7 | 1 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.58.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 0.5 | 2.9 | 3.4 | 1.8 | 4.6 | 3.1 | 4.1 | 6.1 | 4.5 | 4.2 | 3.8 | 4.8 |
| runs with ≥ 1 | 8% | 50% | 92% | 92% | 92% | 96% | 100% | 100% | 100% | 92% | 88% | 71% | 92% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 11.0 | 13.5 | 16.6 | 19.5 | 21.4 | 21.0 | 31.0 | 32.7 | 34.0 | 38.6 |
| launches (encounters off) | 11.0 | 13.7 | 17.3 | 19.6 | 22.0 | 22.0 | 32.0 | 33.1 | 34.3 | 42.7 |
| **ratio to encounters off** | 1.00 | 0.98 | 0.96 | 1.00 | 0.98 | 0.95 | 0.97 | 0.99 | 0.99 | 0.90 |
| table × scale | 11 | 14 | 19 | 23 | 23 | 26 | 31 | 32 | 38 | 45 |
| ratio to table × scale | 1.00 | 0.96 | 0.87 | 0.85 | 0.93 | 0.81 | 1.00 | 1.02 | 0.89 | 0.86 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 15% / 2% | 32% / 20% | 53% / 78% | 47.0 | late | early |
| all | 1–9 | 15% / 2% | 32% / 20% | 53% / 78% | 47.0 | late | early |
| 1 | 1–13 | 28% / 22% | 35% / 37% | 37% / 41% | 115.8 | late | early |
| all | 1–13 | 28% / 22% | 35% / 37% | 37% / 41% | 115.8 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.6 | 10.6 | 6.5 | 5.6 | 6.9 | 6.3 | 5.4 | 5.8 | 4.3 | 5.4 | 11.0 | 10.5 | 10.4 |
| launches read | 264 | 320 | 398 | 469 | 509 | 498 | 741 | 778 | 809 | 924 | 840 | 1073 | 1193 |

Slope over waves 1–10: -0.52 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 3.20 | 3.14 | 5.00 |
| runs that reached it | 10 | 7 | 1 |
| tough, every run | 3.67 | 5.29 | 5.21 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | flak, shrapnel, droneScreen | 4% | 10.0 | 5.7 | 7.6 | 2.33 (6) / 3.00 (5) / 1.50 (2) | 0.0 0.0 0.0 0.3 0.5 0.7 0.7 1.3 1.9 2.3 |
| off-counter | railgun, airstrike, frigate | 0% | 9.7 | 5.7 | 7.6 | 4.20 (5) / 2.67 (3) / 1.00 (1) | 0.0 0.0 0.0 0.3 0.5 0.8 0.8 1.2 2.1 2.1 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
