# Bot report: Saltgate Canal (`saltgate`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 0.9; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=saltgate --seeds=24 --kits=plan --armory=latest --no-fun`. Heat map: `tools/v3/map-report/results/saltgate-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w4 +1.04; doubles on w4 (0.04→1.08), w8 (0.38→1.33) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.21 a run (83% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w6 ×0.84 of the no-encounter wave; outside on w6 ×0.84 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 41%, cold early 21% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.1 s → w10 5.4 s (slope -0.23 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.71 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.36 (14), r2 1.07 (14), r3 1.46 (13); tough (every run): 0.46, 0.92, 1.54 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 3.9 lost 1–10, end 12.7; off-counter 7.0 lost 1–10, end 11.0 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 4 loses 1.08 after 0.04; wave 8 loses 1.33 after 0.38. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 6 sends ×0.84 the no-encounter wave. Encounters should replace launches, not add them.
- Hardest of waves 1–10 for the bot: wave 8 (1.33 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 21%, middle 41%, late 37%.

## Ships lost per wave

Normal: won 50%, mean end wave 11.5 (14 = won), 4.6 lost in waves 1–10, 1.71 in waves 1–5. Tough: 7.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 1.08 | 0.88 | 0.71 | 0.38 | 1.33 | 1.29 | 1.25 | 0.46 | 0.92 | 1.54 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 1.04 | 0.65 | 0.52 | 0.30 | 0.91 | 1.00 | 0.67 | 0.36 | 1.07 | 1.46 |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 1.04 | 0.63 | 0.50 | 0.29 | 0.83 | 0.79 | 0.50 | 0.21 | 0.63 | 0.79 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 22 | 19 | 18 | 14 | 14 | 13 |

Biggest one-wave step up (tough, waves 2–10): wave 4, +1.04.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 1.4 | 1.2 | 1.8 | 2.5 | 5.1 | 3.1 | 3.3 | 4.4 | 4.4 | 0.3 | 0.4 | 1.6 |
| runs with ≥ 1 | 8% | 96% | 83% | 79% | 96% | 100% | 92% | 92% | 96% | 88% | 17% | 42% | 63% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 15.0 | 23.3 | 20.7 | 29.0 | 23.3 | 29.9 | 31.1 | 38.3 | 39.1 |
| launches (encounters off) | 14.0 | 15.9 | 23.2 | 23.1 | 25.5 | 27.8 | 30.3 | 35.5 | 38.3 | 45.3 |
| **ratio to encounters off** | 1.07 | 0.94 | 1.00 | 0.90 | 1.14 | **0.84** | 0.99 | 0.88 | 1.00 | 0.86 |
| table × scale | 14 | 19 | 25 | 29 | 30 | 33 | 39 | 42 | 48 | 59 |
| ratio to table × scale | 1.07 | 0.79 | 0.93 | 0.71 | 0.97 | 0.70 | 0.77 | 0.74 | 0.80 | 0.66 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 21% / 10% | 41% / 32% | 37% / 58% | 64.5 | middle | early |
| all | 1–9 | 21% / 10% | 41% / 32% | 37% / 58% | 64.5 | middle | early |
| 1 | 1–13 | 21% / 11% | 44% / 43% | 35% / 46% | 96.7 | middle | early |
| all | 1–13 | 21% / 11% | 44% / 43% | 35% / 46% | 96.7 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.1 | 6.2 | 7.3 | 6.3 | 6.2 | 5.9 | 5.8 | 6.2 | 5.4 | 5.4 | 5.4 | 5.6 | 5.5 |
| launches read | 360 | 353 | 557 | 469 | 694 | 531 | 696 | 711 | 908 | 885 | 288 | 312 | 441 |

Slope over waves 1–10: -0.23 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.36 | 1.07 | 1.46 |
| runs that reached it | 14 | 14 | 13 |
| tough, every run | 0.46 | 0.92 | 1.54 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, gunships, supplyRun | 67% | 12.7 | 3.8 | 3.9 | 0.47 (19) / 0.95 (19) / 1.67 (18) | 0.0 0.0 0.0 0.4 0.7 0.8 0.6 0.4 0.7 0.4 |
| off-counter | seeker, shield, fullSteam | 33% | 11.0 | 4.9 | 7.0 | 0.18 (11) / 1.45 (11) / 2.18 (11) | 0.0 0.0 0.0 1.0 0.9 0.8 0.8 0.7 1.3 1.5 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
