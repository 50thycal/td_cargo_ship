# Bot report: The Island (`island`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=island --seeds=24 --kits=plan --no-fun`. Heat map: `tools/v3/map-report/results/island-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +0.92; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w4 1.08 a run (54% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w9 ×0.86 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 51%, cold early 21%; lane 2: hot middle 51%, cold late 24% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 7.3 s → w10 3.1 s (slope -0.45 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.83 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.50 (6), r2 2.83 (6), r3 3.33 (3); tough (every run): 1.71, 4.58, 5.13 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 9.0 lost 1–10, end 9.4; off-counter 11.6 lost 1–10, end 8.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Hardest of waves 1–10 for the bot: wave 8 (2.08 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 22%, middle 51%, late 26%.

## Ships lost per wave

Normal: won 0%, mean end wave 9.5 (14 = won), 4.9 lost in waves 1–10, 0.83 in waves 1–5. Tough: 8.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.13 | 0.13 | 0.13 | 0.46 | 0.79 | 1.17 | 2.08 | 1.58 | 2.04 | 1.71 | 4.58 | 5.13 |
| normal, runs that reached it | 0.00 | 0.13 | 0.13 | 0.13 | 0.46 | 0.63 | 1.09 | 1.50 | 0.62 | 1.55 | 1.50 | 2.83 | 3.33 |
| normal, mean over all runs | 0.00 | 0.13 | 0.13 | 0.13 | 0.46 | 0.63 | 1.04 | 1.38 | 0.33 | 0.71 | 0.38 | 0.71 | 0.42 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 13 | 11 | 6 | 6 | 3 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +0.92.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.5 | 0.9 | 2.2 | 1.1 | 1.2 | 5.3 | 6.2 | 5.5 | 6.5 | 8.9 | 2.7 | 3.5 | 3.4 |
| runs with ≥ 1 | 29% | 58% | 79% | 54% | 54% | 100% | 100% | 100% | 100% | 100% | 88% | 92% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 16.0 | 15.1 | 24.7 | 21.9 | 22.0 | 27.8 | 31.3 | 32.8 | 36.0 | 42.6 |
| launches (encounters off) | 16.0 | 17.3 | 24.1 | 24.4 | 25.1 | 29.7 | 33.4 | 36.2 | 42.1 | 49.5 |
| **ratio to encounters off** | 1.00 | 0.87 | 1.02 | 0.90 | 0.88 | 0.94 | 0.94 | 0.90 | 0.86 | 0.86 |
| table × scale | 16 | 21 | 27 | 31 | 32 | 37 | 43 | 47 | 54 | 65 |
| ratio to table × scale | 1.00 | 0.72 | 0.92 | 0.71 | 0.69 | 0.75 | 0.73 | 0.70 | 0.67 | 0.66 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 21% / 13% | 51% / 49% | 28% / 39% | 30.8 | middle | early |
| 2 | 1–9 | 25% / 12% | 51% / 53% | 24% / 36% | 17.0 | middle | late |
| all | 1–9 | 22% / 12% | 51% / 50% | 26% / 37% | 47.8 | middle | early |
| 1 | 1–13 | 27% / 24% | 47% / 46% | 26% / 30% | 74.3 | middle | late |
| 2 | 1–13 | 29% / 20% | 48% / 52% | 23% / 28% | 36.5 | middle | late |
| all | 1–13 | 28% / 23% | 47% / 48% | 25% / 29% | 110.8 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.3 | 5.5 | 5.5 | 5.7 | 5.7 | 3.7 | 3.4 | 3.2 | 3.2 | 3.1 | 3.8 | 3.4 | 2.9 |
| launches read | 384 | 361 | 589 | 521 | 528 | 667 | 749 | 779 | 864 | 1020 | 616 | 781 | 822 |

Slope over waves 1–10: -0.45 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.50 | 2.83 | 3.33 |
| runs that reached it | 6 | 6 | 3 |
| tough, every run | 1.71 | 4.58 | 5.13 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, droneScreen, gunships | 0% | 9.4 | 5.1 | 9.0 | 2.00 (6) / 4.00 (6) / – (0) | 0.0 0.0 0.0 0.0 0.3 0.4 1.7 1.6 1.9 3.0 |
| off-counter | railgun, seeker, lance | 0% | 8.5 | 5.6 | 11.6 | 5.00 (1) / 1.00 (1) / – (0) | 0.0 0.1 0.3 0.4 0.4 1.1 1.9 1.6 2.6 3.2 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
