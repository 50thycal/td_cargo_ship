# Bot report: Harbor Mouth (`harbor`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.6; built 2026-11-17.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=harbor --seeds=24 --kits=aimed,self`. Heat map: `tools/v3/map-report/results/harbor-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +1.92; doubles on w5 (0.29→0.71), w8 (1.38→3.29) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 5.42 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w4 ×0.67 of the no-encounter wave; outside on w4 ×0.67, w5 ×0.76, w6 ×0.67, w7 ×0.75 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 46%, cold early 20% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.2 s → w10 4.2 s (slope -0.42 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.08 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 – (0), r2 – (0), r3 – (0); tough (every run): 1.71, 3.83, 3.13 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | aimed 17.2 lost 1–10, end 7.8; self 19.1 lost 1–10, end 7.9 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 5 loses 0.71 after 0.29; wave 8 loses 3.29 after 1.38. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 4 sends ×0.67 the no-encounter wave; wave 5 sends ×0.76 the no-encounter wave; wave 6 sends ×0.67 the no-encounter wave; wave 7 sends ×0.75 the no-encounter wave. Encounters should replace launches, not add them.
- Hardest of waves 1–10 for the bot: wave 10 (5.42 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 20%, middle 46%, late 34%.

## Ships lost per wave

Normal: won 0%, mean end wave 8.4 (14 = won), 5.8 lost in waves 1–10, 1.08 in waves 1–5, 0.17 in bonus waves. Tough: 16.7 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.08 | 0.29 | 0.71 | 0.88 | 1.38 | 3.29 | 4.63 | 5.42 | 1.71 | 3.83 | 3.13 |
| normal, runs that reached it | 0.00 | 0.00 | 0.08 | 0.29 | 0.71 | 0.88 | 1.38 | 1.95 | 1.75 | 0.67 | – | – | – |
| normal, mean over all runs | 0.00 | 0.00 | 0.08 | 0.29 | 0.71 | 0.88 | 1.38 | 1.79 | 0.58 | 0.08 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 8 | 3 | 0 | 0 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +1.92.

## Close calls per wave (tough)

A threat that came within 2.0 s of a hull (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.5 | 3.3 | 5.4 | 6.4 | 6.7 | 8.8 | 11.0 | 14.6 | 15.6 | 18.7 | 7.0 | 6.8 | 6.3 |
| runs with ≥ 1 | 42% | 96% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 10.0 | 14.7 | 12.9 | 11.7 | 18.2 | 17.1 | 27.3 | 33.8 | 35.3 | 46.3 |
| launches (encounters off) | 10.0 | 13.3 | 12.5 | 17.4 | 24.1 | 25.4 | 36.2 | 37.0 | 37.0 | 45.9 |
| **ratio to encounters off** | 1.00 | 1.11 | 1.03 | **0.67** | **0.76** | **0.67** | **0.75** | 0.91 | 0.95 | 1.01 |
| table × scale | 10 | 12 | 16 | 19 | 19 | 22 | 26 | 28 | 32 | 39 |
| ratio to table × scale | 1.00 | 1.22 | 0.80 | 0.61 | 0.96 | 0.78 | 1.05 | 1.21 | 1.10 | 1.19 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 20% / 9% | 46% / 51% | 34% / 40% | 72.4 | middle | early |
| all | 1–9 | 20% / 9% | 46% / 51% | 34% / 40% | 72.4 | middle | early |
| 1 | 1–13 | 22% / 9% | 45% / 50% | 34% / 40% | 141.8 | middle | early |
| all | 1–13 | 22% / 9% | 45% / 50% | 34% / 40% | 141.8 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.2 | 7.7 | 5.3 | 3.8 | 5.6 | 4.5 | 5.4 | 4.4 | 4.2 | 4.2 | 6.7 | 6.7 | 6.7 |
| launches read | 240 | 348 | 308 | 279 | 436 | 410 | 651 | 810 | 845 | 1106 | 528 | 528 | 527 |

Slope over waves 1–10: -0.42 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | – | – | – |
| runs that reached it | 0 | 0 | 0 |
| tough, every run | 1.71 | 3.83 | 3.13 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| aimed | overdrive, railgun, focus | 0% | 7.8 | 5.8 | 17.2 | – (0) / – (0) / – (0) | 0.0 0.0 0.2 0.4 0.9 1.4 1.6 2.7 4.7 5.2 |
| self | airstrike, seeker, droneScreen | 0% | 7.9 | 5.8 | 19.1 | – (0) / – (0) / – (0) | 0.0 0.1 0.1 0.4 0.9 0.9 2.0 3.3 5.3 6.1 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
