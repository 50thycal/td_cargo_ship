# Bot report: Saltgate Canal (`saltgate`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.9; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=saltgate --seeds=24 --kits=plan --no-fun`. Heat map: `tools/v3/map-report/results/saltgate-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w4 +0.67; doubles on w4 (0.13→0.79) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 2.00 a run (92% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w2 ×0.85 of the no-encounter wave; outside on w2 ×0.85 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 45%, cold early 19% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.1 s → w10 5.2 s (slope -0.25 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.79 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.00 (1), r2 3.00 (1), r3 0.00 (1); tough (every run): 1.38, 2.83, 3.04 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 11.3 lost 1–10, end 8.5; off-counter 16.0 lost 1–10, end 7.2 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 4 loses 0.79 after 0.13. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 2 sends ×0.85 the no-encounter wave. Encounters should replace launches, not add them.
- Hardest of waves 1–10 for the bot: wave 9 (2.75 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 19%, middle 45%, late 36%.

## Ships lost per wave

Normal: won 4%, mean end wave 8.5 (14 = won), 5.9 lost in waves 1–10, 1.79 in waves 1–5. Tough: 12.2 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.13 | 0.13 | 0.79 | 0.92 | 1.17 | 1.63 | 2.25 | 2.75 | 2.42 | 1.38 | 2.83 | 3.04 |
| normal, runs that reached it | 0.00 | 0.13 | 0.13 | 0.79 | 0.78 | 0.81 | 0.95 | 1.56 | 1.71 | 1.50 | 1.00 | 3.00 | 0.00 |
| normal, mean over all runs | 0.00 | 0.13 | 0.13 | 0.79 | 0.75 | 0.71 | 0.83 | 1.04 | 1.00 | 0.50 | 0.04 | 0.13 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 23 | 21 | 21 | 16 | 14 | 8 | 1 | 1 | 1 |

Biggest one-wave step up (tough, waves 2–10): wave 4, +0.67.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 1.2 | 2.0 | 2.2 | 2.8 | 4.9 | 2.7 | 2.5 | 4.8 | 5.3 | 0.1 | 0.3 | 0.8 |
| runs with ≥ 1 | 4% | 83% | 92% | 88% | 96% | 92% | 83% | 83% | 100% | 100% | 8% | 25% | 42% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 14.6 | 23.4 | 20.7 | 28.8 | 23.8 | 30.2 | 32.0 | 38.3 | 40.8 |
| launches (encounters off) | 14.0 | 17.2 | 23.0 | 23.1 | 25.4 | 27.9 | 31.7 | 36.9 | 39.3 | 47.0 |
| **ratio to encounters off** | 1.07 | **0.85** | 1.01 | 0.89 | 1.13 | 0.86 | 0.95 | 0.87 | 0.98 | 0.87 |
| table × scale | 14 | 19 | 25 | 29 | 30 | 33 | 39 | 42 | 48 | 59 |
| ratio to table × scale | 1.07 | 0.77 | 0.94 | 0.71 | 0.96 | 0.72 | 0.77 | 0.76 | 0.80 | 0.69 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 19% / 9% | 45% / 43% | 36% / 48% | 82.1 | middle | early |
| all | 1–9 | 19% / 9% | 45% / 43% | 36% / 48% | 82.1 | middle | early |
| 1 | 1–13 | 20% / 13% | 48% / 53% | 31% / 34% | 130.8 | middle | early |
| all | 1–13 | 20% / 13% | 48% / 53% | 31% / 34% | 130.8 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.1 | 6.2 | 7.1 | 6.7 | 6.5 | 5.7 | 5.7 | 6.2 | 5.3 | 5.2 | 5.3 | 5.6 | 5.6 |
| launches read | 360 | 351 | 560 | 454 | 691 | 551 | 705 | 732 | 908 | 933 | 288 | 312 | 439 |

Slope over waves 1–10: -0.25 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.00 | 3.00 | 0.00 |
| runs that reached it | 1 | 1 | 1 |
| tough, every run | 1.38 | 2.83 | 3.04 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, gunships, supplyRun | 4% | 8.5 | 5.8 | 11.3 | 0.00 (3) / 1.33 (3) / 3.00 (3) | 0.0 0.0 0.0 0.5 1.1 1.5 1.0 2.6 2.5 2.0 |
| off-counter | seeker, shield, fullSteam | 0% | 7.2 | 5.8 | 16.0 | – (0) / – (0) / – (0) | 0.0 0.1 0.2 0.9 2.0 1.5 1.4 3.3 4.1 2.5 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
