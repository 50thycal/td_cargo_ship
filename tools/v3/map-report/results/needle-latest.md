# Bot report: The Needle of Bosk (`needle`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 0.95; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=needle --seeds=24 --kits=plan --armory=latest --no-fun`. Heat map: `tools/v3/map-report/results/needle-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +0.75; doubles on w6 (0.21→0.58), w8 (0.25→1.00) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w8 1.21 a run (75% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.61 of the no-encounter wave; outside on w5 ×0.78, w6 ×0.70, w7 ×0.61, w8 ×0.63, w9 ×0.66, w10 ×0.65 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 51%, cold early 11% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.6 s → w10 5.8 s (slope -0.24 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.63 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (19), r2 0.00 (19), r3 0.00 (19); tough (every run): 0.00, 0.04, 0.04 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | off-counter 3.5 lost 1–10, end 13.5; counter 3.7 lost 1–10, end 13.2 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 6 loses 0.58 after 0.21; wave 8 loses 1.00 after 0.25. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 5 sends ×0.78 the no-encounter wave; wave 6 sends ×0.70 the no-encounter wave; wave 7 sends ×0.61 the no-encounter wave; wave 8 sends ×0.63 the no-encounter wave; wave 9 sends ×0.66 the no-encounter wave; wave 10 sends ×0.65 the no-encounter wave. Encounters should replace launches, not add them.
- Hardest of waves 1–10 for the bot: wave 8 (1.00 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 11%, middle 38%, late 51%.

## Ships lost per wave

Normal: won 79%, mean end wave 13.0 (14 = won), 3.9 lost in waves 1–10, 0.63 in waves 1–5. Tough: 4.4 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.33 | 0.08 | 0.21 | 0.58 | 0.25 | 1.00 | 1.00 | 0.96 | 0.00 | 0.04 | 0.04 |
| normal, runs that reached it | 0.00 | 0.00 | 0.33 | 0.08 | 0.21 | 0.58 | 0.25 | 1.00 | 0.77 | 0.77 | 0.00 | 0.00 | 0.00 |
| normal, mean over all runs | 0.00 | 0.00 | 0.33 | 0.08 | 0.21 | 0.58 | 0.25 | 1.00 | 0.71 | 0.71 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 22 | 19 | 19 | 19 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +0.75.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 1.0 | 3.5 | 2.3 | 3.9 | 1.7 | 3.4 | 1.2 | 4.1 | 2.7 | 1.2 | 1.2 | 1.1 |
| runs with ≥ 1 | 4% | 67% | 92% | 92% | 100% | 79% | 83% | 75% | 100% | 83% | 79% | 88% | 75% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 16.6 | 24.4 | 20.8 | 20.9 | 20.1 | 20.3 | 24.5 | 28.7 | 31.7 |
| launches (encounters off) | 15.0 | 16.6 | 25.6 | 23.3 | 26.8 | 28.8 | 33.3 | 38.7 | 43.5 | 48.5 |
| **ratio to encounters off** | 1.00 | 1.00 | 0.95 | 0.90 | **0.78** | **0.70** | **0.61** | **0.63** | **0.66** | **0.65** |
| table × scale | 15 | 20 | 26 | 30 | 31 | 36 | 41 | 45 | 52 | 62 |
| ratio to table × scale | 1.00 | 0.83 | 0.94 | 0.69 | 0.67 | 0.56 | 0.49 | 0.54 | 0.55 | 0.51 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 11% / 2% | 38% / 33% | 51% / 65% | 34.3 | late | early |
| all | 1–9 | 11% / 2% | 38% / 33% | 51% / 65% | 34.3 | late | early |
| 1 | 1–13 | 9% / 2% | 36% / 27% | 56% / 71% | 54.4 | late | early |
| all | 1–13 | 9% / 2% | 36% / 27% | 56% / 71% | 54.4 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.6 | 6.8 | 5.7 | 5.6 | 4.4 | 5.5 | 4.9 | 5.5 | 5.1 | 5.8 | 6.0 | 5.4 | 5.7 |
| launches read | 360 | 398 | 558 | 499 | 501 | 480 | 483 | 587 | 687 | 732 | 217 | 240 | 264 |

Slope over waves 1–10: -0.24 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 |
| runs that reached it | 19 | 19 | 19 |
| tough, every run | 0.00 | 0.04 | 0.04 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, thermo, gunships | 79% | 13.2 | 3.6 | 3.7 | 0.00 (19) / 0.00 (19) / 0.00 (19) | 0.0 0.0 0.2 0.0 0.3 0.2 0.3 0.8 0.6 1.3 |
| off-counter | seeker, tesla, droneScreen | 88% | 13.5 | 3.2 | 3.5 | 0.00 (21) / 0.00 (21) / 0.00 (21) | 0.0 0.0 0.2 0.0 0.2 0.4 0.5 0.6 0.9 0.7 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
