# Bot report: Saltgate Canal (`saltgate`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 0.9; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=saltgate --seeds=24 --kits=plan --armory=latest --no-fun`. Heat map: `tools/v3/map-report/results/saltgate-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +0.50; doubles on w8 (0.33→0.83) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w5 0.83 a run (50% of runs have one); under 1 on w5 | ≥ 1 a run on every wave 3–10 | tough | **FLAG** |
| `w-budget` | Wave budgets ±15% | furthest w6 ×0.84 of the no-encounter wave; outside on w6 ×0.84 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 44%, cold early 21% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.1 s → w10 5.2 s (slope -0.24 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.63 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.32 (19), r2 1.05 (19), r3 2.00 (18); tough (every run): 0.54, 1.00, 2.21 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 2.6 lost 1–10, end 13.3; off-counter 4.1 lost 1–10, end 12.8 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 8 loses 0.83 after 0.33. Move budget from it to the wave before, or soften its biggest raid.
- Too few close calls on wave 5 (0.83): give those waves a launch from a near site, or one aimed at the danger stretch.
- Budget: wave 6 sends ×0.84 the no-encounter wave. Encounters should replace launches, not add them.
- Hardest of waves 1–10 for the bot: wave 10 (1.04 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 21%, middle 44%, late 35%.

## Ships lost per wave

Normal: won 63%, mean end wave 12.8 (14 = won), 3.3 lost in waves 1–10, 0.63 in waves 1–5. Tough: 3.9 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.00 | 0.25 | 0.29 | 0.21 | 0.33 | 0.83 | 0.83 | 1.04 | 0.54 | 1.00 | 2.21 |
| normal, runs that reached it | 0.00 | 0.08 | 0.00 | 0.25 | 0.29 | 0.21 | 0.33 | 0.71 | 0.61 | 0.86 | 0.32 | 1.05 | 2.00 |
| normal, mean over all runs | 0.00 | 0.08 | 0.00 | 0.25 | 0.29 | 0.21 | 0.33 | 0.71 | 0.58 | 0.79 | 0.25 | 0.83 | 1.50 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 19 | 19 | 18 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +0.50.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 1.5 | 1.4 | 2.0 | 0.8 | 5.2 | 3.1 | 4.4 | 4.4 | 6.3 | 0.8 | 1.5 | 1.7 |
| runs with ≥ 1 | 8% | 96% | 92% | 92% | 50% | 96% | 96% | 100% | 92% | 100% | 33% | 71% | 63% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 15.0 | 23.3 | 22.7 | 24.0 | 22.9 | 29.9 | 33.2 | 37.0 | 39.5 |
| launches (encounters off) | 14.0 | 15.9 | 23.0 | 23.1 | 25.4 | 27.1 | 30.4 | 35.4 | 39.1 | 44.0 |
| **ratio to encounters off** | 1.07 | 0.94 | 1.01 | 0.98 | 0.94 | **0.84** | 0.98 | 0.94 | 0.95 | 0.90 |
| table × scale | 14 | 19 | 25 | 29 | 30 | 33 | 39 | 42 | 48 | 59 |
| ratio to table × scale | 1.07 | 0.79 | 0.93 | 0.78 | 0.80 | 0.69 | 0.77 | 0.79 | 0.77 | 0.67 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 21% / 9% | 44% / 47% | 35% / 44% | 46.3 | middle | early |
| all | 1–9 | 21% / 9% | 44% / 47% | 35% / 44% | 46.3 | middle | early |
| 1 | 1–13 | 19% / 4% | 49% / 61% | 33% / 35% | 75.5 | middle | early |
| all | 1–13 | 19% / 4% | 49% / 61% | 33% / 35% | 75.5 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.1 | 6.0 | 7.3 | 6.4 | 7.0 | 5.7 | 5.7 | 5.8 | 5.5 | 5.2 | 4.7 | 5.0 | 5.1 |
| launches read | 360 | 352 | 554 | 544 | 575 | 544 | 711 | 792 | 887 | 943 | 430 | 495 | 544 |

Slope over waves 1–10: -0.24 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.32 | 1.05 | 2.00 |
| runs that reached it | 19 | 19 | 18 |
| tough, every run | 0.54 | 1.00 | 2.21 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, gunships, supplyRun | 63% | 13.3 | 2.6 | 2.6 | 0.09 (22) / 1.05 (22) / 2.33 (21) | 0.0 0.1 0.0 0.2 0.2 0.2 0.4 0.5 0.5 0.6 |
| off-counter | seeker, shield, fullSteam | 67% | 12.8 | 3.1 | 4.1 | 0.32 (19) / 0.47 (19) / 1.89 (19) | 0.0 0.0 0.0 0.2 0.3 0.5 0.5 0.5 1.5 0.5 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
