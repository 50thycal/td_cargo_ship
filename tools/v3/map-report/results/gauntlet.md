# Bot report: The Gauntlet (`gauntlet`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.75; built 2026-11-17.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=gauntlet --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/gauntlet-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.75; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w5 2.83 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w8 ×0.91 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot early 44%, cold late 16%; lane 2: hot middle 40%, cold late 20% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 7.1 s → w10 3.2 s (slope -0.45 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.13 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.50 (2), r2 0.50 (2), r3 3.50 (2); tough (every run): 1.42, 2.75, 2.88 | about 1 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | off-counter 12.9 lost 1–10, end 8.1; counter 14.4 lost 1–10, end 8.2 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Hardest of waves 1–10 for the bot: wave 10 (3.63 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 42%, middle 40%, late 18%.

## Ships lost per wave

Normal: won 4%, mean end wave 8.3 (14 = won), 5.2 lost in waves 1–10, 1.13 in waves 1–5. Tough: 13.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.17 | 0.33 | 0.63 | 1.13 | 1.67 | 2.33 | 3.08 | 3.63 | 1.42 | 2.75 | 2.88 |
| normal, runs that reached it | 0.00 | 0.00 | 0.17 | 0.33 | 0.63 | 1.00 | 1.50 | 1.53 | 1.83 | 1.50 | 0.50 | 0.50 | 3.50 |
| normal, mean over all runs | 0.00 | 0.00 | 0.17 | 0.33 | 0.63 | 1.00 | 1.38 | 1.08 | 0.46 | 0.13 | 0.04 | 0.04 | 0.29 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 17 | 6 | 2 | 2 | 2 | 2 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.75.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 0.3 | 3.0 | 3.5 | 2.8 | 4.6 | 5.5 | 5.5 | 8.2 | 7.5 | 0.4 | 0.5 | 0.4 |
| runs with ≥ 1 | 25% | 25% | 88% | 96% | 96% | 96% | 100% | 100% | 100% | 100% | 29% | 38% | 21% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 12.0 | 11.5 | 23.3 | 17.5 | 20.1 | 25.6 | 30.6 | 31.4 | 40.8 | 42.5 |
| launches (encounters off) | 12.0 | 11.4 | 22.3 | 17.6 | 20.1 | 25.8 | 32.6 | 34.4 | 40.3 | 44.4 |
| **ratio to encounters off** | 1.00 | 1.01 | 1.04 | 0.99 | 1.00 | 0.99 | 0.94 | 0.91 | 1.01 | 0.96 |
| table × scale | 12 | 16 | 21 | 24 | 25 | 27 | 32 | 36 | 41 | 49 |
| ratio to table × scale | 1.00 | 0.72 | 1.11 | 0.73 | 0.81 | 0.95 | 0.96 | 0.87 | 1.00 | 0.87 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 44% / 30% | 40% / 54% | 16% / 16% | 34.5 | early | late |
| 2 | 1–9 | 40% / 33% | 40% / 46% | 20% / 20% | 33.1 | middle | late |
| all | 1–9 | 42% / 32% | 40% / 50% | 18% / 18% | 67.5 | early | late |
| 1 | 1–13 | 39% / 26% | 40% / 48% | 21% / 26% | 63.9 | middle | late |
| 2 | 1–13 | 35% / 24% | 41% / 45% | 24% / 31% | 63.5 | middle | late |
| all | 1–13 | 37% / 25% | 40% / 46% | 23% / 29% | 127.4 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.1 | 7.6 | 5.6 | 4.5 | 4.2 | 3.7 | 3.6 | 3.7 | 3.9 | 3.2 | 7.3 | 6.7 | 7.3 |
| launches read | 288 | 276 | 558 | 419 | 482 | 610 | 731 | 752 | 978 | 1020 | 264 | 382 | 336 |

Slope over waves 1–10: -0.45 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.50 | 0.50 | 3.50 |
| runs that reached it | 2 | 2 | 2 |
| tough, every run | 1.42 | 2.75 | 2.88 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | shrapnel, thermo, flak | 0% | 8.2 | 5.7 | 14.4 | 3.00 (1) / 3.00 (1) / – (0) | 0.0 0.0 0.1 0.3 0.6 1.3 1.7 3.0 3.8 3.6 |
| off-counter | aegis, seeker, droneScreen | 4% | 8.1 | 5.4 | 12.9 | 0.00 (1) / 0.00 (1) / 3.00 (1) | 0.0 0.0 0.4 0.4 0.8 1.2 1.7 2.6 3.0 2.8 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
