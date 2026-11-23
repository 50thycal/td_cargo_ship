# Bot report: The Island (`island`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=island --seeds=24 --kits=plan --no-fun --out=/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/pf/report-f`. Heat map: `/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/pf/report-f/island-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +1.96; doubles on w3 (0.21→0.83), w6 (0.17→0.96) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 0.96 a run (54% of runs have one); under 1 on w4 | ≥ 1 a run on every wave 3–10 | tough | **FLAG** |
| `w-budget` | Wave budgets ±15% | furthest w4 ×0.89 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 46%, cold early 27%; lane 2: hot middle 55%, cold late 21% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 7.3 s → w10 2.8 s (slope -0.49 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.25 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (1), r2 6.00 (1), r3 – (0); tough (every run): 1.54, 4.67, 4.04 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 10.6 lost 1–10, end 9.1; off-counter 15.4 lost 1–10, end 7.8 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 3 loses 0.83 after 0.21; wave 6 loses 0.96 after 0.17. Move budget from it to the wave before, or soften its biggest raid.
- Too few close calls on wave 4 (0.96): give those waves a launch from a near site, or one aimed at the danger stretch.
- No safe stretch on lane 1 (coldest early takes 27%): aim waves 1–9 away from it.
- Hardest of waves 1–10 for the bot: wave 10 (4.38 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 26%, middle 49%, late 25%.

## Ships lost per wave

Normal: won 0%, mean end wave 8.3 (14 = won), 5.7 lost in waves 1–10, 1.25 in waves 1–5. Tough: 13.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.21 | 0.83 | 0.04 | 0.17 | 0.96 | 1.79 | 2.71 | 2.42 | 4.38 | 1.54 | 4.67 | 4.04 |
| normal, runs that reached it | 0.00 | 0.21 | 0.83 | 0.04 | 0.17 | 0.83 | 1.68 | 1.53 | 1.11 | 1.71 | 0.00 | 6.00 | – |
| normal, mean over all runs | 0.00 | 0.21 | 0.83 | 0.04 | 0.17 | 0.79 | 1.54 | 1.21 | 0.42 | 0.50 | 0.00 | 0.25 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 23 | 23 | 23 | 22 | 19 | 9 | 7 | 1 | 1 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +1.96.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.5 | 1.2 | 1.9 | 1.0 | 1.9 | 6.0 | 7.3 | 6.1 | 6.5 | 7.2 | 2.7 | 3.0 | 3.2 |
| runs with ≥ 1 | 29% | 71% | 79% | 54% | 75% | 100% | 100% | 100% | 96% | 100% | 92% | 100% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 16.0 | 16.5 | 26.4 | 21.8 | 22.2 | 30.9 | 34.6 | 37.4 | 40.1 | 48.0 |
| launches (encounters off) | 16.0 | 18.3 | 26.5 | 24.7 | 25.0 | 31.8 | 32.7 | 37.7 | 42.0 | 51.0 |
| **ratio to encounters off** | 1.00 | 0.90 | 0.99 | 0.89 | 0.89 | 0.97 | 1.06 | 0.99 | 0.95 | 0.94 |
| table × scale | 16 | 21 | 27 | 31 | 32 | 37 | 43 | 47 | 54 | 65 |
| ratio to table × scale | 1.00 | 0.78 | 0.98 | 0.70 | 0.69 | 0.84 | 0.80 | 0.80 | 0.74 | 0.74 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 27% / 17% | 46% / 53% | 27% / 30% | 39.4 | middle | early |
| 2 | 1–9 | 24% / 8% | 55% / 64% | 21% / 28% | 19.3 | middle | late |
| all | 1–9 | 26% / 14% | 49% / 57% | 25% / 30% | 58.6 | middle | late |
| 1 | 1–13 | 31% / 24% | 44% / 49% | 25% / 27% | 85.4 | middle | late |
| 2 | 1–13 | 29% / 18% | 49% / 55% | 22% / 26% | 39.9 | middle | late |
| all | 1–13 | 30% / 22% | 46% / 51% | 24% / 27% | 125.3 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.3 | 5.3 | 5.7 | 5.6 | 5.7 | 3.4 | 2.9 | 3.0 | 3.0 | 2.8 | 4.3 | 4.0 | 3.9 |
| launches read | 384 | 392 | 632 | 519 | 530 | 739 | 829 | 895 | 959 | 1143 | 623 | 780 | 718 |

Slope over waves 1–10: -0.49 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 6.00 | – |
| runs that reached it | 1 | 1 | 0 |
| tough, every run | 1.54 | 4.67 | 4.04 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, droneScreen, gunships | 4% | 9.1 | 5.5 | 10.6 | 1.00 (3) / 2.67 (3) / 2.00 (2) | 0.0 0.1 0.5 0.0 0.3 0.3 1.8 2.3 1.8 3.5 |
| off-counter | railgun, seeker, lance | 0% | 7.8 | 6.0 | 15.4 | – (0) / – (0) / – (0) | 0.0 0.4 0.8 0.3 0.2 1.3 2.2 2.8 3.2 4.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
