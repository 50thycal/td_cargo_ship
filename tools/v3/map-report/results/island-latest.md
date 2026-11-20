# Bot report: The Island (`island`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=island --seeds=24 --kits=plan --no-fun --no-heat --armory=latest`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +0.79; doubles on w7 (0.17→0.83) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 0.83 a run (46% of runs have one); under 1 on w4 | ≥ 1 a run on every wave 3–10 | tough | **FLAG** |
| `w-budget` | Wave budgets ±15% | furthest w2 ×0.85 of the no-encounter wave; outside on w2 ×0.85 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 46%, cold early 25%; lane 2: hot middle 53%, cold late 22% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 7.3 s → w10 2.8 s (slope -0.49 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.42 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.37 (19), r2 2.05 (19), r3 1.37 (19); tough (every run): 0.75, 1.92, 1.88 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 3.3 lost 1–10, end 12.6; off-counter 6.2 lost 1–10, end 11.4 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 7 loses 0.83 after 0.17. Move budget from it to the wave before, or soften its biggest raid.
- Too few close calls on wave 4 (0.83): give those waves a launch from a near site, or one aimed at the danger stretch.
- Budget: wave 2 sends ×0.85 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest early takes 25%): aim waves 1–9 away from it.
- Hardest of waves 1–10 for the bot: wave 10 (1.58 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 25%, middle 49%, late 26%.

## Ships lost per wave

Normal: won 54%, mean end wave 12.5 (14 = won), 3.5 lost in waves 1–10, 0.42 in waves 1–5. Tough: 5.1 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.29 | 0.04 | 0.04 | 0.17 | 0.83 | 1.25 | 0.79 | 1.58 | 0.75 | 1.92 | 1.88 |
| normal, runs that reached it | 0.00 | 0.08 | 0.29 | 0.04 | 0.00 | 0.17 | 0.78 | 0.91 | 0.73 | 0.79 | 0.37 | 2.05 | 1.37 |
| normal, mean over all runs | 0.00 | 0.08 | 0.29 | 0.04 | 0.00 | 0.17 | 0.75 | 0.88 | 0.67 | 0.63 | 0.29 | 1.63 | 1.08 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 23 | 22 | 19 | 19 | 19 | 19 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +0.79.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 0.5 | 1.5 | 0.8 | 2.0 | 5.1 | 6.5 | 5.7 | 6.4 | 8.8 | 2.7 | 4.4 | 3.8 |
| runs with ≥ 1 | 25% | 25% | 75% | 46% | 63% | 100% | 100% | 100% | 100% | 100% | 88% | 96% | 92% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 16.0 | 14.6 | 25.1 | 21.9 | 22.0 | 26.6 | 30.8 | 33.2 | 35.8 | 42.6 |
| launches (encounters off) | 16.0 | 17.3 | 25.2 | 23.4 | 25.0 | 28.8 | 31.4 | 37.4 | 39.8 | 48.6 |
| **ratio to encounters off** | 1.00 | **0.85** | 1.00 | 0.94 | 0.88 | 0.92 | 0.98 | 0.89 | 0.90 | 0.88 |
| table × scale | 16 | 21 | 27 | 31 | 32 | 37 | 43 | 47 | 54 | 65 |
| ratio to table × scale | 1.00 | 0.70 | 0.93 | 0.71 | 0.69 | 0.72 | 0.72 | 0.71 | 0.66 | 0.66 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 25% / 19% | 46% / 40% | 29% / 42% | 19.3 | middle | early |
| 2 | 1–9 | 25% / 17% | 53% / 63% | 22% / 20% | 14.7 | middle | late |
| all | 1–9 | 25% / 18% | 49% / 51% | 26% / 31% | 34.0 | middle | early |
| 1 | 1–13 | 26% / 12% | 43% / 44% | 31% / 43% | 42.1 | middle | early |
| 2 | 1–13 | 25% / 16% | 51% / 58% | 24% / 26% | 28.8 | middle | late |
| all | 1–13 | 25% / 14% | 46% / 50% | 28% / 36% | 70.8 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.3 | 5.6 | 5.8 | 5.6 | 5.6 | 3.5 | 2.9 | 3.0 | 3.1 | 2.8 | 3.9 | 3.5 | 3.2 |
| launches read | 384 | 349 | 600 | 524 | 526 | 636 | 738 | 794 | 857 | 1018 | 569 | 734 | 598 |

Slope over waves 1–10: -0.49 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.37 | 2.05 | 1.37 |
| runs that reached it | 19 | 19 | 19 |
| tough, every run | 0.75 | 1.92 | 1.88 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, droneScreen, gunships | 50% | 12.6 | 3.1 | 3.3 | 0.30 (20) / 2.15 (20) / 1.69 (16) | 0.0 0.0 0.0 0.0 0.0 0.0 0.7 0.9 0.7 1.0 |
| off-counter | railgun, seeker, lance | 33% | 11.4 | 4.6 | 6.2 | 0.69 (13) / 1.62 (13) / 1.67 (12) | 0.0 0.1 0.3 0.0 0.1 0.2 0.9 1.5 0.9 2.2 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
