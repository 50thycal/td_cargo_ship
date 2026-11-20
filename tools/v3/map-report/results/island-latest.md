# Bot report: The Island (`island`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=island --seeds=24 --kits=plan --no-fun --no-heat --armory=latest`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w7 +0.58; doubles on w7 (0.38→0.96) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 0.83 a run (46% of runs have one); under 1 on w4 | ≥ 1 a run on every wave 3–10 | tough | **FLAG** |
| `w-budget` | Wave budgets ±15% | furthest w2 ×0.85 of the no-encounter wave; outside on w2 ×0.85 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 44%, cold late 27%; lane 2: hot middle 52%, cold late 22% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 7.3 s → w10 3.2 s (slope -0.45 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.42 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.44 (16), r2 1.69 (16), r3 1.75 (16); tough (every run): 0.71, 2.63, 2.00 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 3.6 lost 1–10, end 12.6; off-counter 6.1 lost 1–10, end 11.7 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 7 loses 0.96 after 0.38. Move budget from it to the wave before, or soften its biggest raid.
- Too few close calls on wave 4 (0.83): give those waves a launch from a near site, or one aimed at the danger stretch.
- Budget: wave 2 sends ×0.85 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest late takes 27%): aim waves 1–9 away from it.
- Hardest of waves 1–10 for the bot: wave 10 (1.25 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 28%, middle 47%, late 25%.

## Ships lost per wave

Normal: won 42%, mean end wave 12.0 (14 = won), 3.8 lost in waves 1–10, 0.42 in waves 1–5. Tough: 5.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.29 | 0.04 | 0.04 | 0.38 | 0.96 | 1.08 | 1.17 | 1.25 | 0.71 | 2.63 | 2.00 |
| normal, runs that reached it | 0.00 | 0.08 | 0.29 | 0.04 | 0.00 | 0.39 | 0.83 | 0.77 | 0.82 | 0.95 | 0.44 | 1.69 | 1.75 |
| normal, mean over all runs | 0.00 | 0.08 | 0.29 | 0.04 | 0.00 | 0.38 | 0.79 | 0.71 | 0.75 | 0.79 | 0.29 | 1.13 | 1.17 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 22 | 22 | 20 | 16 | 16 | 16 |

Biggest one-wave step up (tough, waves 2–10): wave 7, +0.58.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 0.5 | 1.5 | 0.8 | 2.0 | 4.8 | 6.3 | 6.7 | 6.6 | 7.9 | 2.9 | 4.3 | 4.0 |
| runs with ≥ 1 | 25% | 25% | 75% | 46% | 63% | 100% | 100% | 96% | 100% | 100% | 88% | 92% | 92% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 16.0 | 14.6 | 25.1 | 21.9 | 22.0 | 26.6 | 30.9 | 32.1 | 36.0 | 42.5 |
| launches (encounters off) | 16.0 | 17.3 | 25.2 | 23.4 | 25.0 | 28.8 | 31.4 | 37.4 | 39.8 | 48.6 |
| **ratio to encounters off** | 1.00 | **0.85** | 1.00 | 0.94 | 0.88 | 0.92 | 0.98 | 0.86 | 0.90 | 0.87 |
| table × scale | 16 | 21 | 27 | 31 | 32 | 37 | 43 | 47 | 54 | 65 |
| ratio to table × scale | 1.00 | 0.70 | 0.93 | 0.71 | 0.69 | 0.72 | 0.72 | 0.68 | 0.67 | 0.65 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 29% / 18% | 44% / 40% | 27% / 42% | 17.5 | middle | late |
| 2 | 1–9 | 27% / 18% | 52% / 50% | 22% / 33% | 13.1 | middle | late |
| all | 1–9 | 28% / 18% | 47% / 44% | 25% / 38% | 30.6 | middle | late |
| 1 | 1–13 | 26% / 13% | 43% / 50% | 31% / 37% | 42.3 | middle | early |
| 2 | 1–13 | 29% / 15% | 49% / 53% | 23% / 31% | 26.7 | middle | late |
| all | 1–13 | 27% / 14% | 45% / 51% | 28% / 35% | 69.0 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.3 | 5.6 | 5.8 | 5.6 | 5.6 | 3.7 | 3.4 | 3.2 | 3.3 | 3.2 | 3.8 | 3.3 | 3.2 |
| launches read | 384 | 349 | 600 | 524 | 526 | 634 | 738 | 767 | 861 | 1014 | 590 | 734 | 624 |

Slope over waves 1–10: -0.45 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.44 | 1.69 | 1.75 |
| runs that reached it | 16 | 16 | 16 |
| tough, every run | 0.71 | 2.63 | 2.00 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, droneScreen, gunships | 54% | 12.6 | 3.4 | 3.6 | 0.35 (17) / 1.35 (17) / 1.35 (17) | 0.0 0.0 0.0 0.0 0.0 0.1 0.7 0.6 1.0 1.2 |
| off-counter | railgun, seeker, lance | 33% | 11.7 | 4.4 | 6.1 | 0.33 (15) / 1.93 (15) / 1.23 (13) | 0.0 0.1 0.3 0.0 0.1 0.4 0.9 1.4 1.2 1.7 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
