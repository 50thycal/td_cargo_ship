# Bot report: The Island (`island`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1; built 2026-11-19.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=island --seeds=24 --kits=plan --no-fun --no-heat --armory=latest`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w6 +0.54; doubles on w6 (0.08→0.63) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 3.42 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w2 ×0.85 of the no-encounter wave; outside on w2 ×0.85 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 40%, cold early 29%; lane 2: hot middle 49%, cold early 25% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 7.3 s → w10 3.2 s (slope -0.40 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.75 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.86 (14), r2 1.46 (13), r3 1.92 (12); tough (every run): 1.04, 2.04, 1.96 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 4.5 lost 1–10, end 11.6; off-counter 6.8 lost 1–10, end 10.4 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 6 loses 0.63 after 0.08. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 2 sends ×0.85 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest early takes 29%), lane 2 (coldest early takes 25%): aim waves 1–9 away from it.
- Hardest of waves 1–10 for the bot: wave 10 (1.58 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 28%, middle 44%, late 28%.

## Ships lost per wave

Normal: won 50%, mean end wave 11.7 (14 = won), 4.7 lost in waves 1–10, 0.75 in waves 1–5. Tough: 6.2 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.46 | 0.13 | 0.08 | 0.63 | 0.88 | 1.17 | 1.17 | 1.58 | 1.04 | 2.04 | 1.96 |
| normal, runs that reached it | 0.00 | 0.08 | 0.46 | 0.13 | 0.08 | 0.50 | 0.87 | 1.00 | 0.82 | 1.17 | 0.86 | 1.46 | 1.92 |
| normal, mean over all runs | 0.00 | 0.08 | 0.46 | 0.13 | 0.08 | 0.50 | 0.83 | 0.96 | 0.75 | 0.88 | 0.50 | 0.79 | 0.96 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 22 | 18 | 14 | 13 | 12 |

Biggest one-wave step up (tough, waves 2–10): wave 6, +0.54.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 0.5 | 3.4 | 5.4 | 4.3 | 4.5 | 5.9 | 6.7 | 7.3 | 9.4 | 2.2 | 4.6 | 3.4 |
| runs with ≥ 1 | 25% | 25% | 96% | 100% | 100% | 96% | 100% | 100% | 100% | 100% | 83% | 100% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 16.0 | 14.6 | 24.8 | 24.8 | 25.8 | 27.5 | 30.7 | 32.2 | 36.9 | 43.7 |
| launches (encounters off) | 16.0 | 17.3 | 25.2 | 23.4 | 25.0 | 28.8 | 31.4 | 37.4 | 39.8 | 48.6 |
| **ratio to encounters off** | 1.00 | **0.85** | 0.99 | 1.06 | 1.03 | 0.96 | 0.98 | 0.86 | 0.93 | 0.90 |
| table × scale | 16 | 21 | 27 | 31 | 32 | 37 | 43 | 47 | 54 | 65 |
| ratio to table × scale | 1.00 | 0.70 | 0.92 | 0.80 | 0.81 | 0.74 | 0.71 | 0.68 | 0.68 | 0.67 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 29% / 26% | 40% / 35% | 30% / 39% | 24.2 | middle | early |
| 2 | 1–9 | 25% / 23% | 49% / 41% | 26% / 36% | 15.3 | middle | early |
| all | 1–9 | 28% / 25% | 44% / 37% | 28% / 38% | 39.5 | middle | early |
| 1 | 1–13 | 32% / 26% | 38% / 40% | 30% / 33% | 49.3 | middle | late |
| 2 | 1–13 | 23% / 15% | 50% / 48% | 26% / 37% | 29.4 | middle | early |
| all | 1–13 | 29% / 22% | 43% / 43% | 29% / 35% | 78.7 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.3 | 5.6 | 5.1 | 4.2 | 3.7 | 3.8 | 3.4 | 3.2 | 3.1 | 3.2 | 3.9 | 3.4 | 3.2 |
| launches read | 384 | 349 | 592 | 593 | 613 | 658 | 734 | 767 | 882 | 1041 | 603 | 724 | 608 |

Slope over waves 1–10: -0.40 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.86 | 1.46 | 1.92 |
| runs that reached it | 14 | 13 | 12 |
| tough, every run | 1.04 | 2.04 | 1.96 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, droneScreen, gunships | 42% | 11.6 | 3.8 | 4.5 | 0.40 (15) / 2.13 (15) / 1.38 (13) | 0.0 0.0 0.4 0.0 0.2 0.4 0.8 0.7 0.8 1.2 |
| off-counter | railgun, seeker, lance | 25% | 10.4 | 5.0 | 6.8 | 1.13 (8) / 1.50 (8) / 2.14 (7) | 0.0 0.1 0.5 0.3 0.2 0.6 0.9 1.4 1.2 1.6 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
