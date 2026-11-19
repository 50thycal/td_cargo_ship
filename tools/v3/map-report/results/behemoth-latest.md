# Bot report: The Behemoth Run (`behemoth`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.15; built 2026-11-19.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=behemoth --seeds=24 --kits=plan --no-fun --no-heat --armory=latest`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +1.42; doubles on w7 (0.29→0.92), w10 (0.79→2.21) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w6 2.96 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.85 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 41%, cold early 24%; lane 2: hot late 44%, cold early 24% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 10.2 s → w10 5.1 s (slope -0.43 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.63 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.33 (15), r2 1.40 (15), r3 1.38 (13); tough (every run): 0.29, 1.67, 1.46 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 5.6 lost 1–10, end 11.9; off-counter 6.8 lost 1–10, end 11.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 7 loses 0.92 after 0.29; wave 10 loses 2.21 after 0.79. Move budget from it to the wave before, or soften its biggest raid.
- Hardest of waves 1–10 for the bot: wave 10 (2.21 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 24%, middle 33%, late 43%.

## Ships lost per wave

Normal: won 46%, mean end wave 11.8 (14 = won), 4.1 lost in waves 1–10, 0.63 in waves 1–5. Tough: 5.8 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.13 | 0.04 | 0.33 | 0.29 | 0.29 | 0.92 | 0.79 | 0.79 | 2.21 | 0.29 | 1.67 | 1.46 |
| normal, runs that reached it | 0.00 | 0.13 | 0.04 | 0.29 | 0.17 | 0.17 | 0.74 | 0.78 | 0.62 | 1.55 | 0.33 | 1.40 | 1.38 |
| normal, mean over all runs | 0.00 | 0.13 | 0.04 | 0.29 | 0.17 | 0.17 | 0.71 | 0.75 | 0.54 | 1.29 | 0.21 | 0.88 | 0.75 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 23 | 21 | 20 | 15 | 15 | 13 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +1.42.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 0.9 | 4.0 | 4.6 | 5.5 | 3.0 | 3.8 | 5.4 | 6.7 | 7.1 | 0.5 | 0.4 | 1.5 |
| runs with ≥ 1 | 0% | 63% | 100% | 96% | 100% | 100% | 96% | 100% | 96% | 96% | 42% | 38% | 92% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 18.0 | 20.4 | 29.0 | 29.0 | 31.9 | 31.9 | 37.4 | 41.6 | 48.0 | 59.5 |
| launches (encounters off) | 18.0 | 20.2 | 28.3 | 29.4 | 31.7 | 35.3 | 43.8 | 47.2 | 52.8 | 65.0 |
| **ratio to encounters off** | 1.00 | 1.01 | 1.02 | 0.99 | 1.01 | 0.91 | 0.85 | 0.88 | 0.91 | 0.91 |
| table × scale | 18 | 24 | 31 | 36 | 37 | 42 | 50 | 54 | 62 | 75 |
| ratio to table × scale | 1.00 | 0.85 | 0.93 | 0.80 | 0.86 | 0.76 | 0.75 | 0.77 | 0.77 | 0.79 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 24% / 0% | 35% / 0% | 41% / 100% | 11.0 | late | early |
| 2 | 1–9 | 24% / 17% | 33% / 23% | 44% / 60% | 40.0 | late | early |
| all | 1–9 | 24% / 16% | 33% / 23% | 43% / 61% | 51.0 | late | early |
| 1 | 1–13 | 25% / 0% | 37% / 27% | 38% / 73% | 19.8 | late | early |
| 2 | 1–13 | 25% / 28% | 28% / 18% | 47% / 55% | 63.5 | late | early |
| all | 1–13 | 25% / 26% | 30% / 18% | 45% / 56% | 83.3 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.2 | 7.9 | 6.4 | 5.7 | 4.7 | 5.2 | 5.7 | 5.1 | 5.2 | 5.1 | 3.9 | 4.0 | 3.9 |
| launches read | 432 | 487 | 692 | 692 | 764 | 761 | 897 | 991 | 1147 | 1422 | 271 | 357 | 436 |

Slope over waves 1–10: -0.43 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.33 | 1.40 | 1.38 |
| runs that reached it | 15 | 15 | 13 |
| tough, every run | 0.29 | 1.67 | 1.46 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | shield, frigate, airstrike | 54% | 11.9 | 4.1 | 5.6 | 0.40 (15) / 1.00 (15) / 1.21 (14) | 0.0 0.1 0.0 0.3 0.4 0.3 0.8 1.2 0.8 1.7 |
| off-counter | scatter, tesla, seeker | 38% | 11.5 | 5.0 | 6.8 | 0.38 (13) / 1.23 (13) / 2.62 (13) | 0.0 0.2 0.0 0.3 0.3 0.3 0.9 1.0 1.3 2.5 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
