# Bot report: The Behemoth Run (`behemoth`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.15; built 2026-11-19.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=behemoth --seeds=24 --kits=plan --no-fun`. Heat map: `tools/v3/map-report/results/behemoth-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +1.75; doubles on w5 (0.25→1.46), w8 (1.29→3.04) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 4.25 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.86 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 43%, cold early 22%; lane 2: hot middle 43%, cold early 25% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 10.2 s → w10 5.0 s (slope -0.43 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.75 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.00 (3), r2 2.00 (3), r3 4.00 (2); tough (every run): 1.33, 2.58, 3.25 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 13.1 lost 1–10, end 8.8; off-counter 15.3 lost 1–10, end 8.3 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 5 loses 1.46 after 0.25; wave 8 loses 3.04 after 1.29. Move budget from it to the wave before, or soften its biggest raid.
- Hardest of waves 1–10 for the bot: wave 8 (3.04 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 24%, middle 43%, late 33%.

## Ships lost per wave

Normal: won 4%, mean end wave 8.8 (14 = won), 5.7 lost in waves 1–10, 1.75 in waves 1–5. Tough: 13.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.29 | 0.13 | 0.25 | 1.46 | 0.67 | 1.29 | 3.04 | 2.83 | 3.04 | 1.33 | 2.58 | 3.25 |
| normal, runs that reached it | 0.00 | 0.29 | 0.13 | 0.21 | 1.17 | 0.45 | 0.91 | 2.00 | 1.08 | 1.67 | 1.00 | 2.00 | 4.00 |
| normal, mean over all runs | 0.00 | 0.29 | 0.13 | 0.21 | 1.13 | 0.42 | 0.83 | 1.50 | 0.58 | 0.63 | 0.13 | 0.25 | 0.33 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 23 | 22 | 22 | 18 | 13 | 9 | 3 | 3 | 2 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +1.75.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 1.0 | 4.3 | 4.8 | 4.7 | 4.3 | 4.3 | 5.1 | 5.7 | 7.9 | 0.9 | 1.0 | 1.1 |
| runs with ≥ 1 | 21% | 67% | 100% | 100% | 100% | 96% | 100% | 100% | 100% | 100% | 67% | 63% | 71% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 18.0 | 20.4 | 28.6 | 29.1 | 33.1 | 32.8 | 38.2 | 44.2 | 48.4 | 61.2 |
| launches (encounters off) | 18.0 | 19.9 | 28.5 | 29.1 | 32.7 | 34.5 | 44.1 | 48.8 | 53.5 | 64.0 |
| **ratio to encounters off** | 1.00 | 1.03 | 1.00 | 1.00 | 1.01 | 0.95 | 0.86 | 0.91 | 0.90 | 0.96 |
| table × scale | 18 | 24 | 31 | 36 | 37 | 42 | 50 | 54 | 62 | 75 |
| ratio to table × scale | 1.00 | 0.85 | 0.92 | 0.81 | 0.90 | 0.78 | 0.76 | 0.82 | 0.78 | 0.82 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 22% / 0% | 43% / 40% | 35% / 60% | 17.2 | middle | early |
| 2 | 1–9 | 25% / 11% | 43% / 52% | 32% / 37% | 62.6 | middle | early |
| all | 1–9 | 24% / 11% | 43% / 51% | 33% / 39% | 79.8 | middle | early |
| 1 | 1–13 | 27% / 9% | 41% / 28% | 32% / 63% | 27.7 | middle | early |
| 2 | 1–13 | 25% / 20% | 37% / 40% | 38% / 40% | 101.4 | late | early |
| all | 1–13 | 26% / 19% | 38% / 39% | 36% / 42% | 129.1 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.2 | 8.0 | 6.4 | 5.6 | 4.8 | 5.1 | 5.7 | 5.1 | 5.3 | 5.0 | 4.0 | 4.1 | 4.2 |
| launches read | 432 | 485 | 682 | 696 | 793 | 785 | 911 | 1057 | 1155 | 1459 | 294 | 370 | 479 |

Slope over waves 1–10: -0.43 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.00 | 2.00 | 4.00 |
| runs that reached it | 3 | 3 | 2 |
| tough, every run | 1.33 | 2.58 | 3.25 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | shield, frigate, airstrike | 4% | 8.8 | 5.3 | 13.1 | 1.20 (5) / 3.20 (5) / 2.33 (3) | 0.0 0.2 0.1 0.3 1.6 0.8 1.5 2.8 2.9 3.0 |
| off-counter | scatter, tesla, seeker | 4% | 8.3 | 5.3 | 15.3 | 1.50 (2) / 1.50 (2) / 5.00 (1) | 0.0 0.3 0.1 0.3 2.0 1.2 1.6 2.5 3.3 4.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
