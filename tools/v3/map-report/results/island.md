# Bot report: The Island (`island`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1; built 2026-11-19.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=island --seeds=24 --kits=plan --no-fun`. Heat map: `tools/v3/map-report/results/island-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w7 +0.92; doubles on w4 (0.38→0.92), w7 (0.54→1.46) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 3.92 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.86 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 48%, cold early 24%; lane 2: hot middle 51%, cold late 19% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 7.3 s → w10 3.1 s (slope -0.39 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.87 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.00 (3), r2 4.67 (3), r3 1.00 (1); tough (every run): 2.88, 5.42, 5.04 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 8.3 lost 1–10, end 9.5; off-counter 14.5 lost 1–10, end 7.7 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 4 loses 0.92 after 0.38; wave 7 loses 1.46 after 0.54. Move budget from it to the wave before, or soften its biggest raid.
- Hardest of waves 1–10 for the bot: wave 10 (2.96 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 26%, middle 49%, late 25%.

## Ships lost per wave

Normal: won 0%, mean end wave 8.7 (14 = won), 5.7 lost in waves 1–10, 1.87 in waves 1–5. Tough: 11.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.13 | 0.38 | 0.92 | 0.63 | 0.54 | 1.46 | 2.04 | 2.42 | 2.96 | 2.88 | 5.42 | 5.04 |
| normal, runs that reached it | 0.00 | 0.13 | 0.38 | 0.92 | 0.48 | 0.41 | 1.05 | 1.72 | 1.54 | 1.29 | 1.00 | 4.67 | 1.00 |
| normal, mean over all runs | 0.00 | 0.13 | 0.38 | 0.92 | 0.46 | 0.38 | 0.96 | 1.29 | 0.83 | 0.38 | 0.13 | 0.58 | 0.04 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 23 | 22 | 22 | 18 | 13 | 7 | 3 | 3 | 1 |

Biggest one-wave step up (tough, waves 2–10): wave 7, +0.92.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.5 | 0.9 | 3.9 | 5.1 | 4.6 | 4.8 | 5.8 | 5.6 | 5.5 | 7.9 | 3.0 | 4.2 | 3.6 |
| runs with ≥ 1 | 29% | 58% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 96% | 100% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 16.0 | 15.1 | 24.3 | 24.6 | 26.5 | 28.3 | 30.6 | 32.9 | 36.3 | 42.6 |
| launches (encounters off) | 16.0 | 17.3 | 24.1 | 24.4 | 25.1 | 29.7 | 33.4 | 36.2 | 42.1 | 49.5 |
| **ratio to encounters off** | 1.00 | 0.87 | 1.01 | 1.01 | 1.05 | 0.95 | 0.92 | 0.91 | 0.86 | 0.86 |
| table × scale | 16 | 21 | 27 | 31 | 32 | 37 | 43 | 47 | 54 | 65 |
| ratio to table × scale | 1.00 | 0.72 | 0.90 | 0.79 | 0.83 | 0.76 | 0.71 | 0.70 | 0.67 | 0.66 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 24% / 14% | 48% / 48% | 29% / 38% | 40.4 | middle | early |
| 2 | 1–9 | 30% / 10% | 51% / 64% | 19% / 26% | 21.0 | middle | late |
| all | 1–9 | 26% / 13% | 49% / 53% | 25% / 34% | 61.4 | middle | late |
| 1 | 1–13 | 31% / 26% | 42% / 42% | 27% / 32% | 87.2 | middle | late |
| 2 | 1–13 | 33% / 20% | 47% / 52% | 20% / 28% | 42.3 | middle | late |
| all | 1–13 | 31% / 24% | 44% / 45% | 25% / 31% | 129.5 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.3 | 5.5 | 5.0 | 4.1 | 3.7 | 3.7 | 3.4 | 3.2 | 3.3 | 3.1 | 3.6 | 3.4 | 2.9 |
| launches read | 384 | 361 | 582 | 590 | 632 | 674 | 735 | 786 | 868 | 1019 | 679 | 843 | 792 |

Slope over waves 1–10: -0.39 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.00 | 4.67 | 1.00 |
| runs that reached it | 3 | 3 | 1 |
| tough, every run | 2.88 | 5.42 | 5.04 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, droneScreen, gunships | 4% | 9.5 | 5.2 | 8.3 | 0.67 (6) / 4.17 (6) / 2.00 (3) | 0.0 0.0 0.2 0.5 0.5 0.6 1.3 1.1 1.5 2.6 |
| off-counter | railgun, seeker, lance | 0% | 7.7 | 5.5 | 14.5 | – (0) / – (0) / – (0) | 0.0 0.1 0.3 0.8 1.1 1.1 2.0 1.9 2.9 4.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
