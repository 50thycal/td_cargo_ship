# Bot report: The Behemoth Run (`behemoth`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.15; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=behemoth --seeds=24 --kits=plan --no-fun --out=/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/pf/report-f`. Heat map: `/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/pf/report-f/behemoth-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +1.58; doubles on w5 (0.25→0.58), w7 (0.79→1.75) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 4.13 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.87 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 36%, cold early 28%; lane 2: hot middle 43%, cold early 22% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 10.2 s → w10 5.0 s (slope -0.43 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.21 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 3.40 (5), r2 2.33 (3), r3 2.50 (2); tough (every run): 3.08, 3.33, 6.21 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 12.4 lost 1–10, end 8.5; off-counter 12.7 lost 1–10, end 8.6 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 5 loses 0.58 after 0.25; wave 7 loses 1.75 after 0.79. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest early takes 28%): aim waves 1–9 away from it.
- Hardest of waves 1–10 for the bot: wave 10 (3.96 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 24%, middle 41%, late 35%.

## Ships lost per wave

Normal: won 4%, mean end wave 8.9 (14 = won), 5.8 lost in waves 1–10, 1.21 in waves 1–5. Tough: 12.6 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.33 | 0.04 | 0.25 | 0.58 | 0.79 | 1.75 | 2.54 | 2.38 | 3.96 | 3.08 | 3.33 | 6.21 |
| normal, runs that reached it | 0.00 | 0.33 | 0.04 | 0.25 | 0.58 | 0.83 | 1.41 | 1.47 | 1.33 | 2.22 | 3.40 | 2.33 | 2.50 |
| normal, mean over all runs | 0.00 | 0.33 | 0.04 | 0.25 | 0.58 | 0.79 | 1.29 | 1.04 | 0.67 | 0.83 | 0.71 | 0.29 | 0.21 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 17 | 12 | 9 | 5 | 3 | 2 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +1.58.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 1.4 | 4.1 | 4.7 | 5.9 | 4.4 | 4.6 | 5.8 | 5.5 | 7.4 | 0.0 | 0.4 | 0.3 |
| runs with ≥ 1 | 21% | 75% | 100% | 96% | 100% | 96% | 96% | 100% | 100% | 100% | 4% | 38% | 25% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 18.0 | 21.5 | 29.0 | 29.0 | 33.2 | 33.8 | 38.5 | 44.7 | 49.0 | 61.8 |
| launches (encounters off) | 18.0 | 21.5 | 29.0 | 29.3 | 32.8 | 36.2 | 44.3 | 49.5 | 54.4 | 67.3 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 0.99 | 1.01 | 0.93 | 0.87 | 0.90 | 0.90 | 0.92 |
| table × scale | 18 | 24 | 31 | 36 | 37 | 42 | 50 | 54 | 62 | 75 |
| ratio to table × scale | 1.00 | 0.90 | 0.94 | 0.80 | 0.90 | 0.80 | 0.77 | 0.83 | 0.79 | 0.82 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 28% / 22% | 36% / 22% | 36% / 56% | 19.5 | late | early |
| 2 | 1–9 | 22% / 23% | 43% / 39% | 35% / 38% | 51.9 | middle | early |
| all | 1–9 | 24% / 23% | 41% / 37% | 35% / 40% | 71.3 | middle | early |
| 1 | 1–13 | 33% / 13% | 40% / 52% | 27% / 34% | 39.5 | middle | late |
| 2 | 1–13 | 26% / 17% | 41% / 43% | 33% / 40% | 104.5 | middle | early |
| all | 1–13 | 28% / 17% | 41% / 44% | 31% / 39% | 144.0 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.2 | 7.6 | 6.7 | 5.8 | 4.6 | 5.0 | 5.7 | 5.2 | 5.4 | 5.0 | 2.2 | 2.4 | 2.2 |
| launches read | 432 | 513 | 696 | 692 | 793 | 808 | 907 | 1065 | 1168 | 1476 | 209 | 298 | 369 |

Slope over waves 1–10: -0.43 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 3.40 | 2.33 | 2.50 |
| runs that reached it | 5 | 3 | 2 |
| tough, every run | 3.08 | 3.33 | 6.21 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | shield, frigate, airstrike | 0% | 8.5 | 5.5 | 12.4 | 4.00 (3) / 6.00 (1) / – (0) | 0.0 0.3 0.0 0.2 0.7 0.7 1.5 2.5 2.5 4.0 |
| off-counter | scatter, tesla, seeker | 8% | 8.6 | 5.8 | 12.7 | 2.25 (4) / 2.00 (3) / 2.00 (2) | 0.0 0.4 0.1 0.5 0.7 1.2 1.3 2.8 2.3 3.4 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
