# Bot report: Harbor Mouth (`harbor`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.6; built 2026-11-18.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=harbor --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/harbor-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.88; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 4.29 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w2 ×1.09 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 45%, cold early 20% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 10.7 s → w10 3.9 s (slope -0.52 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.92 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.00 (8), r2 2.75 (8), r3 1.14 (7); tough (every run): 1.17, 2.29, 1.46 | about 1 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 6.8 lost 1–10, end 10.8; off-counter 7.2 lost 1–10, end 10.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Hardest of waves 1–10 for the bot: wave 9 (2.13 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 20%, middle 45%, late 35%.

## Ships lost per wave

Normal: won 25%, mean end wave 10.6 (14 = won), 5.1 lost in waves 1–10, 0.92 in waves 1–5. Tough: 7.1 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.13 | 0.29 | 0.42 | 0.58 | 0.63 | 1.25 | 2.13 | 1.58 | 1.17 | 2.29 | 1.46 |
| normal, runs that reached it | 0.00 | 0.08 | 0.13 | 0.29 | 0.42 | 0.58 | 0.65 | 1.13 | 1.48 | 1.00 | 1.00 | 2.75 | 1.14 |
| normal, mean over all runs | 0.00 | 0.08 | 0.13 | 0.29 | 0.42 | 0.58 | 0.63 | 1.08 | 1.29 | 0.63 | 0.33 | 0.92 | 0.33 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 21 | 15 | 8 | 8 | 7 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.88.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 1.8 | 4.3 | 4.5 | 5.0 | 6.2 | 6.9 | 7.7 | 7.5 | 8.7 | 4.0 | 3.9 | 4.6 |
| runs with ≥ 1 | 4% | 96% | 100% | 100% | 100% | 96% | 100% | 100% | 100% | 100% | 96% | 100% | 88% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 10.0 | 14.5 | 13.0 | 18.1 | 25.1 | 26.0 | 34.4 | 32.8 | 36.4 | 43.1 |
| launches (encounters off) | 10.0 | 13.3 | 12.6 | 16.7 | 23.3 | 25.4 | 35.0 | 36.2 | 36.9 | 46.3 |
| **ratio to encounters off** | 1.00 | 1.09 | 1.03 | 1.08 | 1.08 | 1.02 | 0.98 | 0.91 | 0.99 | 0.93 |
| table × scale | 10 | 12 | 16 | 19 | 19 | 22 | 26 | 28 | 32 | 39 |
| ratio to table × scale | 1.00 | 1.21 | 0.81 | 0.95 | 1.32 | 1.18 | 1.32 | 1.17 | 1.14 | 1.10 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 20% / 13% | 45% / 58% | 35% / 30% | 74.3 | middle | early |
| all | 1–9 | 20% / 13% | 45% / 58% | 35% / 30% | 74.3 | middle | early |
| 1 | 1–13 | 20% / 10% | 48% / 62% | 33% / 28% | 140.0 | middle | early |
| all | 1–13 | 20% / 10% | 48% / 62% | 33% / 28% | 140.0 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.7 | 7.5 | 3.5 | 3.3 | 4.5 | 3.6 | 4.5 | 3.6 | 3.6 | 3.9 | 6.2 | 5.8 | 6.3 |
| launches read | 240 | 347 | 312 | 433 | 600 | 621 | 824 | 782 | 866 | 1031 | 596 | 645 | 623 |

Slope over waves 1–10: -0.52 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.00 | 2.75 | 1.14 |
| runs that reached it | 8 | 8 | 7 |
| tough, every run | 1.17 | 2.29 | 1.46 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | overdrive, railgun, focus | 21% | 10.8 | 5.0 | 6.8 | 0.50 (8) / 1.63 (8) / 1.88 (8) | 0.0 0.0 0.1 0.0 0.6 0.3 0.6 1.2 1.8 2.2 |
| off-counter | airstrike, seeker, droneScreen | 13% | 10.5 | 5.3 | 7.2 | 0.29 (7) / 2.71 (7) / 2.83 (6) | 0.0 0.0 0.1 0.3 0.3 0.3 0.8 1.2 2.1 2.1 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
