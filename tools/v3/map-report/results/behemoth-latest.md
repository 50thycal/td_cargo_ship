# Bot report: The Behemoth Run (`behemoth`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.15; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=behemoth --seeds=24 --kits=plan --no-fun --no-heat --armory=latest`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +1.29; doubles on w8 (0.46→1.42), w10 (0.75→2.04) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w7 3.96 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.86 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 43%, cold early 21%; lane 2: hot late 45%, cold early 23% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 10.2 s → w10 5.1 s (slope -0.42 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.58 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.07 (14), r2 2.36 (14), r3 3.00 (10); tough (every run): 2.00, 3.38, 3.67 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 4.7 lost 1–10, end 11.4; off-counter 5.8 lost 1–10, end 10.8 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 8 loses 1.42 after 0.46; wave 10 loses 2.04 after 0.75. Move budget from it to the wave before, or soften its biggest raid.
- Hardest of waves 1–10 for the bot: wave 10 (2.04 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 22%, middle 36%, late 42%.

## Ships lost per wave

Normal: won 13%, mean end wave 11.1 (14 = won), 3.8 lost in waves 1–10, 0.58 in waves 1–5. Tough: 5.8 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.13 | 0.04 | 0.25 | 0.21 | 0.50 | 0.46 | 1.42 | 0.75 | 2.04 | 2.00 | 3.38 | 3.67 |
| normal, runs that reached it | 0.00 | 0.13 | 0.04 | 0.25 | 0.17 | 0.35 | 0.35 | 1.17 | 0.63 | 1.22 | 1.07 | 2.36 | 3.00 |
| normal, mean over all runs | 0.00 | 0.13 | 0.04 | 0.25 | 0.17 | 0.33 | 0.33 | 1.13 | 0.50 | 0.92 | 0.63 | 1.38 | 1.25 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 19 | 18 | 14 | 14 | 10 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +1.29.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 0.9 | 4.0 | 5.1 | 5.8 | 4.3 | 4.0 | 5.5 | 5.4 | 7.0 | 0.1 | 0.3 | 0.2 |
| runs with ≥ 1 | 0% | 63% | 100% | 100% | 100% | 100% | 96% | 100% | 100% | 100% | 8% | 29% | 17% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 18.0 | 20.4 | 29.0 | 29.1 | 31.3 | 31.9 | 37.7 | 43.3 | 47.3 | 60.0 |
| launches (encounters off) | 18.0 | 20.2 | 28.3 | 29.4 | 31.7 | 35.3 | 43.8 | 47.2 | 52.8 | 65.0 |
| **ratio to encounters off** | 1.00 | 1.01 | 1.02 | 0.99 | 0.99 | 0.90 | 0.86 | 0.92 | 0.89 | 0.92 |
| table × scale | 18 | 24 | 31 | 36 | 37 | 42 | 50 | 54 | 62 | 75 |
| ratio to table × scale | 1.00 | 0.85 | 0.93 | 0.81 | 0.85 | 0.76 | 0.75 | 0.80 | 0.76 | 0.80 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 21% / 10% | 43% / 20% | 36% / 70% | 15.1 | middle | early |
| 2 | 1–9 | 23% / 23% | 31% / 25% | 45% / 52% | 27.2 | late | early |
| all | 1–9 | 22% / 21% | 36% / 24% | 42% / 54% | 42.3 | late | early |
| 1 | 1–13 | 28% / 11% | 46% / 57% | 26% / 32% | 32.4 | middle | late |
| 2 | 1–13 | 25% / 14% | 35% / 37% | 40% / 49% | 64.6 | late | early |
| all | 1–13 | 26% / 13% | 39% / 41% | 36% / 46% | 97.0 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.2 | 7.9 | 6.4 | 5.7 | 4.9 | 5.3 | 5.8 | 5.3 | 5.3 | 5.1 | 2.3 | 2.4 | 2.2 |
| launches read | 432 | 487 | 692 | 694 | 751 | 759 | 899 | 1033 | 1126 | 1430 | 209 | 306 | 368 |

Slope over waves 1–10: -0.42 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.07 | 2.36 | 3.00 |
| runs that reached it | 14 | 14 | 10 |
| tough, every run | 2.00 | 3.38 | 3.67 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | shield, frigate, airstrike | 8% | 11.4 | 3.3 | 4.7 | 1.88 (16) / 2.73 (15) / 2.80 (10) | 0.0 0.1 0.0 0.3 0.2 0.4 0.3 1.3 0.4 1.8 |
| off-counter | scatter, tesla, seeker | 13% | 10.8 | 4.0 | 5.8 | 2.21 (14) / 2.82 (11) / 2.71 (7) | 0.0 0.2 0.0 0.3 0.3 0.3 0.8 1.3 1.1 1.4 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
