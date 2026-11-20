# Bot report: The Behemoth Run (`behemoth`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.15; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=behemoth --seeds=24 --kits=plan --no-fun --out=/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/pf/report-b2`. Heat map: `/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/pf/report-b2/behemoth-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +0.96; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w7 3.58 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.86 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 41%, cold early 27%; lane 2: hot middle 41%, cold early 22% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 10.2 s → w10 5.0 s (slope -0.42 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.21 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 3.00 (5), r2 2.00 (3), r3 3.00 (2); tough (every run): 2.54, 3.42, 4.50 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 10.8 lost 1–10, end 9.6; off-counter 11.8 lost 1–10, end 8.9 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- No safe stretch on lane 1 (coldest early takes 27%): aim waves 1–9 away from it.
- Hardest of waves 1–10 for the bot: wave 10 (3.58 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 23%, middle 41%, late 36%.

## Ships lost per wave

Normal: won 4%, mean end wave 9.1 (14 = won), 5.6 lost in waves 1–10, 1.21 in waves 1–5. Tough: 11.9 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.29 | 0.13 | 0.33 | 0.50 | 0.88 | 1.29 | 2.25 | 2.67 | 3.58 | 2.54 | 3.42 | 4.50 |
| normal, runs that reached it | 0.00 | 0.29 | 0.13 | 0.33 | 0.48 | 0.61 | 0.91 | 1.60 | 1.54 | 2.00 | 3.00 | 2.00 | 3.00 |
| normal, mean over all runs | 0.00 | 0.29 | 0.13 | 0.33 | 0.46 | 0.58 | 0.83 | 1.33 | 0.83 | 0.83 | 0.63 | 0.25 | 0.25 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 23 | 23 | 22 | 20 | 13 | 10 | 5 | 3 | 2 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +0.96.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 1.0 | 4.3 | 4.8 | 5.8 | 5.0 | 3.6 | 5.3 | 5.3 | 7.1 | 0.2 | 0.3 | 0.3 |
| runs with ≥ 1 | 21% | 67% | 100% | 96% | 100% | 100% | 96% | 100% | 100% | 100% | 17% | 29% | 29% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 18.0 | 20.4 | 28.6 | 29.1 | 31.4 | 32.7 | 38.1 | 43.8 | 48.3 | 63.0 |
| launches (encounters off) | 18.0 | 19.9 | 28.5 | 29.1 | 32.7 | 34.5 | 44.1 | 48.8 | 53.5 | 64.0 |
| **ratio to encounters off** | 1.00 | 1.03 | 1.00 | 1.00 | 0.96 | 0.95 | 0.86 | 0.90 | 0.90 | 0.98 |
| table × scale | 18 | 24 | 31 | 36 | 37 | 42 | 50 | 54 | 62 | 75 |
| ratio to table × scale | 1.00 | 0.85 | 0.92 | 0.81 | 0.85 | 0.78 | 0.76 | 0.81 | 0.78 | 0.84 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 27% / 0% | 41% / 50% | 31% / 50% | 19.1 | middle | early |
| 2 | 1–9 | 22% / 18% | 41% / 39% | 37% / 44% | 48.0 | middle | early |
| all | 1–9 | 23% / 16% | 41% / 40% | 36% / 44% | 67.1 | middle | early |
| 1 | 1–13 | 32% / 0% | 42% / 63% | 25% / 37% | 38.1 | middle | late |
| 2 | 1–13 | 25% / 14% | 40% / 41% | 36% / 45% | 99.6 | middle | early |
| all | 1–13 | 27% / 12% | 40% / 45% | 33% / 44% | 137.7 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.2 | 8.0 | 6.4 | 5.7 | 4.7 | 5.2 | 5.9 | 5.2 | 5.6 | 5.0 | 2.2 | 2.6 | 2.3 |
| launches read | 432 | 485 | 682 | 696 | 753 | 779 | 904 | 1044 | 1153 | 1509 | 207 | 302 | 373 |

Slope over waves 1–10: -0.42 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 3.00 | 2.00 | 3.00 |
| runs that reached it | 5 | 3 | 2 |
| tough, every run | 2.54 | 3.42 | 4.50 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | shield, frigate, airstrike | 4% | 9.6 | 4.8 | 10.8 | 3.00 (9) / 4.00 (6) / 1.50 (2) | 0.0 0.2 0.1 0.4 0.5 0.8 1.3 1.5 2.4 3.6 |
| off-counter | scatter, tesla, seeker | 4% | 8.9 | 5.0 | 11.8 | 2.20 (5) / 3.25 (4) / 3.00 (1) | 0.0 0.3 0.1 0.5 0.5 0.6 1.7 1.9 3.3 3.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
