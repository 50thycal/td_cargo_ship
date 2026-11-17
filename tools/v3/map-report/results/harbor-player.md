# Bot report: Harbor Mouth (`harbor`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.6; built 2026-11-17.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=harbor --seeds=24 --kits=aimed,self --armory=player`. Heat map: `tools/v3/map-report/results/harbor-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +0.79; doubles on w8 (0.75→1.54) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 5.50 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w6 ×0.67 of the no-encounter wave; outside on w4 ×0.72, w5 ×0.78, w6 ×0.67, w7 ×0.77 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 47%, cold early 16% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.2 s → w10 4.0 s (slope -0.45 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.67 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.43 (7), r2 1.86 (7), r3 1.71 (7); tough (every run): 0.83, 1.04, 1.08 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | aimed 9.0 lost 1–10, end 9.7; self 9.7 lost 1–10, end 9.3 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 8 loses 1.54 after 0.75. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 4 sends ×0.72 the no-encounter wave; wave 5 sends ×0.78 the no-encounter wave; wave 6 sends ×0.67 the no-encounter wave; wave 7 sends ×0.77 the no-encounter wave. Encounters should replace launches, not add them.
- Hardest of waves 1–10 for the bot: wave 10 (2.67 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 16%, middle 47%, late 38%.

## Ships lost per wave

Normal: won 29%, mean end wave 10.6 (14 = won), 5.5 lost in waves 1–10, 0.67 in waves 1–5, 0.04 in bonus waves. Tough: 8.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.00 | 0.21 | 0.46 | 0.50 | 0.75 | 1.54 | 2.21 | 2.67 | 0.83 | 1.04 | 1.08 |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 | 0.21 | 0.46 | 0.50 | 0.75 | 1.54 | 1.41 | 1.42 | 0.43 | 1.86 | 1.71 |
| normal, mean over all runs | 0.00 | 0.00 | 0.00 | 0.21 | 0.46 | 0.50 | 0.75 | 1.54 | 1.29 | 0.71 | 0.13 | 0.54 | 0.50 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 12 | 7 | 7 | 7 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +0.79.

## Close calls per wave (tough)

A threat that came within 2.0 s of a hull (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.5 | 3.5 | 5.5 | 6.4 | 7.2 | 9.0 | 11.0 | 15.5 | 17.4 | 20.0 | 6.2 | 7.1 | 7.4 |
| runs with ≥ 1 | 38% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 10.0 | 14.7 | 12.8 | 12.0 | 18.4 | 17.0 | 27.1 | 33.8 | 34.5 | 46.1 |
| launches (encounters off) | 10.0 | 13.3 | 12.6 | 16.7 | 23.5 | 25.5 | 35.2 | 36.6 | 36.8 | 45.3 |
| **ratio to encounters off** | 1.00 | 1.11 | 1.01 | **0.72** | **0.78** | **0.67** | **0.77** | 0.92 | 0.94 | 1.02 |
| table × scale | 10 | 12 | 16 | 19 | 19 | 22 | 26 | 28 | 32 | 39 |
| ratio to table × scale | 1.00 | 1.22 | 0.80 | 0.63 | 0.97 | 0.77 | 1.04 | 1.21 | 1.08 | 1.18 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 16% / 6% | 47% / 59% | 38% / 35% | 67.3 | middle | early |
| all | 1–9 | 16% / 6% | 47% / 59% | 38% / 35% | 67.3 | middle | early |
| 1 | 1–13 | 18% / 9% | 45% / 55% | 37% / 35% | 126.3 | middle | early |
| all | 1–13 | 18% / 9% | 45% / 55% | 37% / 35% | 126.3 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.2 | 7.7 | 5.3 | 3.8 | 5.3 | 4.4 | 5.5 | 4.2 | 3.9 | 4.0 | 7.0 | 6.7 | 6.6 |
| launches read | 240 | 348 | 306 | 289 | 440 | 406 | 644 | 811 | 825 | 1099 | 526 | 528 | 527 |

Slope over waves 1–10: -0.45 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.43 | 1.86 | 1.71 |
| runs that reached it | 7 | 7 | 7 |
| tough, every run | 0.83 | 1.04 | 1.08 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| aimed | overdrive, railgun, focus | 13% | 9.7 | 5.7 | 9.0 | 0.67 (3) / 2.00 (3) / 1.00 (3) | 0.0 0.0 0.0 0.3 0.4 0.4 0.8 1.9 2.4 2.9 |
| self | airstrike, seeker, droneScreen | 4% | 9.3 | 5.9 | 9.7 | 0.00 (1) / 1.00 (1) / 0.00 (1) | 0.0 0.0 0.0 0.3 0.4 0.6 1.0 1.8 2.8 2.8 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
