# Bot report: The Needle of Bosk (`needle`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 0.95; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=needle --seeds=24 --kits=plan --armory=latest --no-fun`. Heat map: `tools/v3/map-report/results/needle-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w7 +0.63; doubles on w7 (0.08→0.71) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 1.13 a run (79% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w3 ×0.95 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 49%, cold early 13% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.6 s → w10 5.3 s (slope -0.23 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.71 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (15), r2 0.07 (15), r3 0.00 (15); tough (every run): 0.00, 0.04, 0.08 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 3.8 lost 1–10, end 13.0; off-counter 4.5 lost 1–10, end 12.6 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 7 loses 0.71 after 0.08. Move budget from it to the wave before, or soften its biggest raid.
- Hardest of waves 1–10 for the bot: wave 10 (1.50 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 13%, middle 38%, late 49%.

## Ships lost per wave

Normal: won 63%, mean end wave 12.3 (14 = won), 4.3 lost in waves 1–10, 0.71 in waves 1–5. Tough: 5.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.33 | 0.04 | 0.33 | 0.08 | 0.71 | 0.92 | 1.38 | 1.50 | 0.00 | 0.04 | 0.08 |
| normal, runs that reached it | 0.00 | 0.00 | 0.33 | 0.04 | 0.33 | 0.08 | 0.71 | 0.88 | 1.17 | 0.95 | 0.00 | 0.07 | 0.00 |
| normal, mean over all runs | 0.00 | 0.00 | 0.33 | 0.04 | 0.33 | 0.08 | 0.71 | 0.88 | 1.13 | 0.75 | 0.00 | 0.04 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 19 | 15 | 15 | 15 |

Biggest one-wave step up (tough, waves 2–10): wave 7, +0.63.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 1.0 | 3.5 | 1.1 | 2.4 | 2.8 | 2.3 | 1.5 | 3.0 | 4.7 | 1.6 | 1.7 | 1.6 |
| runs with ≥ 1 | 4% | 67% | 92% | 79% | 88% | 92% | 92% | 71% | 96% | 100% | 92% | 100% | 88% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 16.6 | 24.4 | 23.0 | 26.0 | 28.9 | 32.1 | 37.6 | 42.5 | 46.6 |
| launches (encounters off) | 15.0 | 16.6 | 25.6 | 23.3 | 26.8 | 28.8 | 33.3 | 38.7 | 43.5 | 48.5 |
| **ratio to encounters off** | 1.00 | 1.00 | 0.95 | 0.99 | 0.97 | 1.00 | 0.97 | 0.97 | 0.98 | 0.96 |
| table × scale | 15 | 20 | 26 | 30 | 31 | 36 | 41 | 45 | 52 | 62 |
| ratio to table × scale | 1.00 | 0.83 | 0.94 | 0.77 | 0.84 | 0.80 | 0.78 | 0.84 | 0.82 | 0.75 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 13% / 8% | 38% / 31% | 49% / 62% | 40.8 | late | early |
| all | 1–9 | 13% / 8% | 38% / 31% | 49% / 62% | 40.8 | late | early |
| 1 | 1–13 | 10% / 6% | 35% / 26% | 55% / 68% | 62.9 | late | early |
| all | 1–13 | 10% / 6% | 35% / 26% | 55% / 68% | 62.9 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.6 | 6.8 | 5.7 | 6.9 | 4.7 | 5.4 | 5.4 | 6.2 | 5.9 | 5.3 | 5.6 | 5.2 | 4.9 |
| launches read | 360 | 398 | 558 | 550 | 620 | 683 | 768 | 897 | 1014 | 1090 | 216 | 241 | 266 |

Slope over waves 1–10: -0.23 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 0.07 | 0.00 |
| runs that reached it | 15 | 15 | 15 |
| tough, every run | 0.00 | 0.04 | 0.08 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, thermo, gunships | 79% | 13.0 | 3.3 | 3.8 | 0.00 (19) / 0.11 (19) / 0.11 (19) | 0.0 0.0 0.2 0.0 0.2 0.2 0.5 0.5 1.1 1.0 |
| off-counter | seeker, frigate, droneScreen | 71% | 12.6 | 3.7 | 4.5 | 0.00 (17) / 0.06 (17) / 0.00 (17) | 0.0 0.0 0.2 0.0 0.3 0.1 0.5 0.7 1.5 1.1 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
