# Bot report: Harbor Mouth (`harbor`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.6; built 2026-11-17.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=harbor --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/harbor-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.96; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 4.29 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w2 ×1.09 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 45%, cold early 20% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 10.7 s → w10 3.8 s (slope -0.52 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.08 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.63 (8), r2 1.63 (8), r3 2.43 (7); tough (every run): 1.33, 1.83, 2.38 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 7.0 lost 1–10, end 11.0; off-counter 7.3 lost 1–10, end 10.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Hardest of waves 1–10 for the bot: wave 10 (2.29 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 20%, middle 45%, late 35%.

## Ships lost per wave

Normal: won 17%, mean end wave 10.4 (14 = won), 5.1 lost in waves 1–10, 1.08 in waves 1–5, 0.13 in bonus waves. Tough: 7.7 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.13 | 0.38 | 0.50 | 0.71 | 0.63 | 1.00 | 1.96 | 2.29 | 1.33 | 1.83 | 2.38 |
| normal, runs that reached it | 0.00 | 0.08 | 0.13 | 0.38 | 0.50 | 0.71 | 0.65 | 0.96 | 1.36 | 1.20 | 1.63 | 1.63 | 2.43 |
| normal, mean over all runs | 0.00 | 0.08 | 0.13 | 0.38 | 0.50 | 0.71 | 0.63 | 0.92 | 1.25 | 0.50 | 0.54 | 0.54 | 0.71 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 22 | 10 | 8 | 8 | 7 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.96.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 1.8 | 4.3 | 4.4 | 4.9 | 6.0 | 6.2 | 7.9 | 7.7 | 8.3 | 4.1 | 4.0 | 5.1 |
| runs with ≥ 1 | 4% | 96% | 100% | 100% | 100% | 96% | 100% | 100% | 100% | 100% | 92% | 88% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 10.0 | 14.5 | 13.0 | 18.0 | 25.0 | 25.9 | 34.3 | 33.4 | 36.4 | 43.1 |
| launches (encounters off) | 10.0 | 13.3 | 12.6 | 16.7 | 23.5 | 25.5 | 35.2 | 36.6 | 36.8 | 45.3 |
| **ratio to encounters off** | 1.00 | 1.09 | 1.03 | 1.08 | 1.06 | 1.02 | 0.97 | 0.91 | 0.99 | 0.95 |
| table × scale | 10 | 12 | 16 | 19 | 19 | 22 | 26 | 28 | 32 | 39 |
| ratio to table × scale | 1.00 | 1.21 | 0.81 | 0.95 | 1.32 | 1.18 | 1.32 | 1.19 | 1.14 | 1.10 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 20% / 7% | 45% / 60% | 35% / 33% | 72.8 | middle | early |
| all | 1–9 | 20% / 7% | 45% / 60% | 35% / 33% | 72.8 | middle | early |
| 1 | 1–13 | 18% / 7% | 48% / 63% | 33% / 29% | 142.9 | middle | early |
| all | 1–13 | 18% / 7% | 48% / 63% | 33% / 29% | 142.9 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.7 | 7.5 | 3.5 | 3.3 | 4.5 | 3.7 | 4.6 | 3.6 | 3.6 | 3.8 | 6.3 | 5.9 | 5.6 |
| launches read | 240 | 347 | 312 | 433 | 598 | 618 | 819 | 798 | 871 | 1034 | 595 | 647 | 692 |

Slope over waves 1–10: -0.52 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.63 | 1.63 | 2.43 |
| runs that reached it | 8 | 8 | 7 |
| tough, every run | 1.33 | 1.83 | 2.38 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | overdrive, railgun, focus | 21% | 11.0 | 5.2 | 7.0 | 0.78 (9) / 1.44 (9) / 2.50 (8) | 0.0 0.0 0.1 0.0 0.5 0.3 0.3 1.3 1.8 2.5 |
| off-counter | airstrike, seeker, droneScreen | 8% | 10.5 | 5.4 | 7.3 | 1.17 (6) / 2.50 (6) / 1.50 (6) | 0.0 0.0 0.1 0.4 0.4 0.5 0.5 0.8 1.6 3.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
