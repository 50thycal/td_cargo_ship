# Bot report: The Archipelago (`archipelago`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.1; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=archipelago --seeds=24 --kits=plan --armory=latest --no-fun`. Heat map: `tools/v3/map-report/results/archipelago-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w7 +0.83; doubles on w7 (0.13→0.96) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.46 a run (75% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.87 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot early 48%, cold late 22% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.3 s → w10 5.8 s (slope -0.18 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.75 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.47 (15), r2 1.13 (15), r3 1.71 (14); tough (every run): 0.92, 2.13, 2.42 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | off-counter 5.7 lost 1–10, end 11.5; counter 6.0 lost 1–10, end 11.6 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 7 loses 0.96 after 0.13. Move budget from it to the wave before, or soften its biggest raid.
- Hardest of waves 1–10 for the bot: wave 8 (1.58 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 48%, middle 30%, late 22%.

## Ships lost per wave

Normal: won 46%, mean end wave 11.9 (14 = won), 4.3 lost in waves 1–10, 0.75 in waves 1–5. Tough: 5.6 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 0.21 | 0.50 | 0.13 | 0.96 | 1.58 | 0.96 | 1.25 | 0.92 | 2.13 | 2.42 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 0.21 | 0.50 | 0.13 | 0.50 | 1.30 | 0.90 | 1.11 | 0.47 | 1.13 | 1.71 |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 0.21 | 0.50 | 0.13 | 0.50 | 1.25 | 0.79 | 0.83 | 0.29 | 0.71 | 1.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 21 | 18 | 15 | 15 | 14 |

Biggest one-wave step up (tough, waves 2–10): wave 7, +0.83.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 1.3 | 1.5 | 2.3 | 3.7 | 3.0 | 3.9 | 5.1 | 4.3 | 5.8 | 6.0 | 7.9 | 7.3 |
| runs with ≥ 1 | 8% | 75% | 75% | 83% | 96% | 96% | 88% | 100% | 96% | 100% | 100% | 100% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 18.0 | 19.4 | 23.9 | 31.2 | 31.8 | 37.8 | 34.5 | 42.3 | 46.3 | 53.4 |
| launches (encounters off) | 18.0 | 21.0 | 24.0 | 32.3 | 29.6 | 35.7 | 39.5 | 45.7 | 51.0 | 55.7 |
| **ratio to encounters off** | 1.00 | 0.92 | 0.99 | 0.97 | 1.07 | 1.06 | 0.87 | 0.93 | 0.91 | 0.96 |
| table × scale | 18 | 23 | 29 | 35 | 36 | 41 | 48 | 52 | 60 | 72 |
| ratio to table × scale | 1.00 | 0.84 | 0.82 | 0.89 | 0.88 | 0.92 | 0.72 | 0.81 | 0.77 | 0.74 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 48% / 38% | 30% / 40% | 22% / 22% | 39.9 | early | late |
| all | 1–9 | 48% / 38% | 30% / 40% | 22% / 22% | 39.9 | early | late |
| 1 | 1–13 | 53% / 52% | 25% / 29% | 22% / 19% | 87.2 | early | late |
| all | 1–13 | 53% / 52% | 25% / 29% | 22% / 19% | 87.2 | early | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.3 | 6.5 | 5.6 | 6.8 | 5.7 | 6.0 | 5.9 | 5.6 | 6.0 | 5.8 | 6.0 | 5.6 | 5.4 |
| launches read | 432 | 464 | 569 | 732 | 749 | 894 | 820 | 1007 | 1107 | 1273 | 1294 | 1635 | 1652 |

Slope over waves 1–10: -0.18 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.47 | 1.13 | 1.71 |
| runs that reached it | 15 | 15 | 14 |
| tough, every run | 0.92 | 2.13 | 2.42 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | airstrike, aegis, flak | 46% | 11.6 | 4.2 | 6.0 | 0.54 (13) / 1.15 (13) / 1.33 (12) | 0.0 0.0 0.0 0.2 0.5 0.1 1.0 1.7 1.4 1.1 |
| off-counter | seeker, railgun, droneScreen | 33% | 11.5 | 4.5 | 5.7 | 1.00 (12) / 1.42 (12) / 1.27 (11) | 0.0 0.0 0.0 0.2 0.5 0.3 0.4 1.6 1.2 1.5 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
