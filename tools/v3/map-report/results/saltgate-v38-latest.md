# Bot report: Saltgate Canal (`saltgate`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 0.9; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=saltgate --seeds=24 --kits=plan --armory=latest --no-fun`. Heat map: `tools/v3/map-report/results/saltgate-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +1.46; doubles on w8 (0.67→2.13) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.04 a run (67% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.91 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 41%, cold early 24% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.3 s → w10 5.3 s (slope -0.28 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.13 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.00 (10), r2 2.00 (10), r3 1.80 (10); tough (every run): 0.96, 2.79, 3.50 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 5.5 lost 1–10, end 11.2; off-counter 8.0 lost 1–10, end 9.8 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 8 loses 2.13 after 0.67. Move budget from it to the wave before, or soften its biggest raid.
- Hardest of waves 1–10 for the bot: wave 8 (2.13 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 24%, middle 41%, late 35%.

## Ships lost per wave

Normal: won 25%, mean end wave 10.8 (14 = won), 5.3 lost in waves 1–10, 1.13 in waves 1–5. Tough: 7.7 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.08 | 0.38 | 0.67 | 0.67 | 0.67 | 2.13 | 1.58 | 1.54 | 0.96 | 2.79 | 3.50 |
| normal, runs that reached it | 0.00 | 0.00 | 0.08 | 0.38 | 0.67 | 0.58 | 0.39 | 1.65 | 1.39 | 0.93 | 1.00 | 2.00 | 1.80 |
| normal, mean over all runs | 0.00 | 0.00 | 0.08 | 0.38 | 0.67 | 0.58 | 0.38 | 1.58 | 1.04 | 0.58 | 0.42 | 0.83 | 0.75 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 18 | 15 | 10 | 10 | 10 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +1.46.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.2 | 1.9 | 1.0 | 1.5 | 1.3 | 5.6 | 2.2 | 2.7 | 4.0 | 4.7 | 1.6 | 2.8 | 4.0 |
| runs with ≥ 1 | 4% | 92% | 67% | 63% | 71% | 100% | 100% | 88% | 100% | 92% | 83% | 96% | 88% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 14.0 | 14.6 | 21.5 | 23.3 | 25.0 | 26.4 | 31.3 | 34.1 | 40.7 | 41.4 |
| launches (encounters off) | 14.0 | 15.9 | 23.2 | 23.1 | 25.5 | 27.8 | 30.3 | 35.5 | 38.3 | 45.3 |
| **ratio to encounters off** | 1.00 | 0.92 | 0.93 | 1.01 | 0.98 | 0.95 | 1.03 | 0.96 | 1.06 | 0.91 |
| table × scale | 14 | 19 | 25 | 29 | 30 | 33 | 39 | 42 | 48 | 59 |
| ratio to table × scale | 1.00 | 0.77 | 0.86 | 0.80 | 0.83 | 0.80 | 0.80 | 0.81 | 0.85 | 0.70 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 24% / 28% | 41% / 30% | 35% / 42% | 60.5 | middle | early |
| all | 1–9 | 24% / 28% | 41% / 30% | 35% / 42% | 60.5 | middle | early |
| 1 | 1–13 | 30% / 38% | 38% / 27% | 32% / 35% | 112.4 | middle | early |
| all | 1–13 | 30% / 38% | 38% / 27% | 32% / 35% | 112.4 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.3 | 6.2 | 7.4 | 6.6 | 6.6 | 5.5 | 5.9 | 5.7 | 5.2 | 5.3 | 5.0 | 4.9 | 4.6 |
| launches read | 336 | 348 | 512 | 534 | 596 | 610 | 736 | 779 | 964 | 939 | 583 | 834 | 849 |

Slope over waves 1–10: -0.28 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.00 | 2.00 | 1.80 |
| runs that reached it | 10 | 10 | 10 |
| tough, every run | 0.96 | 2.79 | 3.50 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, gunships, supplyRun | 25% | 11.2 | 4.5 | 5.5 | 0.83 (12) / 1.42 (12) / 2.45 (11) | 0.0 0.0 0.1 0.4 0.4 0.6 0.4 1.4 1.2 1.1 |
| off-counter | seeker, shield, fullSteam | 4% | 9.8 | 5.3 | 8.0 | 0.40 (5) / 2.20 (5) / 3.20 (5) | 0.0 0.0 0.1 0.1 0.8 0.8 0.8 2.0 1.8 1.6 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
