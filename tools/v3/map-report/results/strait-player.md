# Bot report: The Strait (`strait`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.7; built 2026-11-17.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=strait --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/strait-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +0.67; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w5 1.71 a run (83% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.92 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 53%, cold early 15% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.6 s → w10 5.2 s (slope -0.53 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.38 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.60 (15), r2 1.27 (15), r3 2.23 (13); tough (every run): 1.54, 2.21, 4.38 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 4.3 lost 1–10, end 12.4; off-counter 5.3 lost 1–10, end 11.3 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Hardest of waves 1–10 for the bot: wave 10 (1.58 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 15%, middle 32%, late 53%.

## Ships lost per wave

Normal: won 25%, mean end wave 12.0 (14 = won), 4.4 lost in waves 1–10, 0.38 in waves 1–5. Tough: 4.9 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.08 | 0.13 | 0.17 | 0.46 | 0.88 | 0.67 | 0.92 | 1.58 | 1.54 | 2.21 | 4.38 |
| normal, runs that reached it | 0.00 | 0.00 | 0.08 | 0.13 | 0.17 | 0.46 | 0.88 | 0.58 | 0.87 | 1.35 | 1.60 | 1.27 | 2.23 |
| normal, mean over all runs | 0.00 | 0.00 | 0.08 | 0.13 | 0.17 | 0.46 | 0.88 | 0.58 | 0.83 | 1.29 | 1.00 | 0.79 | 1.21 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 15 | 15 | 13 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +0.67.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 0.3 | 3.3 | 3.3 | 1.7 | 3.8 | 2.9 | 5.0 | 6.3 | 3.5 | 3.3 | 5.3 | 3.3 |
| runs with ≥ 1 | 13% | 33% | 96% | 96% | 83% | 96% | 100% | 100% | 96% | 100% | 75% | 83% | 79% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 11.0 | 13.5 | 16.6 | 19.5 | 21.5 | 20.9 | 31.1 | 32.6 | 33.6 | 38.6 |
| launches (encounters off) | 11.0 | 13.7 | 17.2 | 19.4 | 22.2 | 21.5 | 31.7 | 32.7 | 34.0 | 41.9 |
| **ratio to encounters off** | 1.00 | 0.98 | 0.97 | 1.01 | 0.97 | 0.97 | 0.98 | 1.00 | 0.99 | 0.92 |
| table × scale | 11 | 14 | 19 | 23 | 23 | 26 | 31 | 32 | 38 | 45 |
| ratio to table × scale | 1.00 | 0.96 | 0.87 | 0.85 | 0.93 | 0.80 | 1.00 | 1.02 | 0.88 | 0.86 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 15% / 3% | 32% / 15% | 53% / 82% | 42.5 | late | early |
| all | 1–9 | 15% / 3% | 32% / 15% | 53% / 82% | 42.5 | late | early |
| 1 | 1–13 | 24% / 21% | 35% / 30% | 41% / 49% | 112.1 | late | early |
| all | 1–13 | 24% / 21% | 35% / 30% | 41% / 49% | 112.1 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.6 | 10.6 | 6.5 | 5.5 | 6.9 | 6.3 | 5.3 | 5.7 | 4.4 | 5.2 | 11.1 | 10.8 | 10.5 |
| launches read | 264 | 322 | 398 | 468 | 514 | 499 | 743 | 777 | 804 | 919 | 837 | 1065 | 1191 |

Slope over waves 1–10: -0.53 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.60 | 1.27 | 2.23 |
| runs that reached it | 15 | 15 | 13 |
| tough, every run | 1.54 | 2.21 | 4.38 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | flak, shrapnel, droneScreen | 42% | 12.4 | 4.0 | 4.3 | 1.21 (19) / 1.83 (18) / 2.07 (15) | 0.0 0.0 0.1 0.0 0.2 0.4 0.6 0.8 1.1 1.1 |
| off-counter | railgun, airstrike, frigate | 17% | 11.3 | 4.8 | 5.3 | 1.62 (13) / 1.92 (12) / 3.00 (8) | 0.0 0.0 0.0 0.0 0.3 0.4 0.8 1.0 1.2 1.5 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
