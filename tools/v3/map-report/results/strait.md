# Bot report: The Strait (`strait`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.7; built 2026-11-17.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=strait --seeds=24 --kits=aimed,self`. Heat map: `tools/v3/map-report/results/strait-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +1.54; doubles on w6 (0.29→0.79), w8 (0.67→1.58) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 4.83 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×1.12 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 40%, cold early 26% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 9.6 s → w10 3.9 s (slope -0.60 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.33 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.67 (3), r2 1.00 (3), r3 4.33 (3); tough (every run): 1.75, 3.42, 4.58 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | aimed 9.6 lost 1–10, end 9.7; self 10.4 lost 1–10, end 9.0 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 6 loses 0.79 after 0.29; wave 8 loses 1.58 after 0.67. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest early takes 26%): aim waves 1–9 away from it.
- Hardest of waves 1–10 for the bot: wave 10 (4.08 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 26%, middle 40%, late 34%.

## Ships lost per wave

Normal: won 0%, mean end wave 9.6 (14 = won), 5.5 lost in waves 1–10, 0.33 in waves 1–5, 0.04 in bonus waves. Tough: 10.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 0.00 | 0.29 | 0.79 | 0.67 | 1.58 | 2.54 | 4.08 | 1.75 | 3.42 | 4.58 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 0.00 | 0.29 | 0.79 | 0.67 | 1.42 | 1.95 | 1.90 | 0.67 | 1.00 | 4.33 |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 0.00 | 0.29 | 0.79 | 0.67 | 1.42 | 1.54 | 0.79 | 0.08 | 0.13 | 0.54 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 19 | 10 | 3 | 3 | 3 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +1.54.

## Close calls per wave (tough)

A threat that came within 2.0 s of a hull (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.0 | 2.1 | 4.8 | 6.2 | 11.4 | 12.4 | 17.2 | 15.9 | 17.9 | 18.3 | 4.3 | 3.5 | 3.2 |
| runs with ≥ 1 | 83% | 92% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 96% | 83% | 88% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 11.0 | 13.5 | 16.5 | 18.7 | 24.0 | 24.1 | 34.8 | 36.6 | 38.4 | 48.0 |
| launches (encounters off) | 11.0 | 13.7 | 17.3 | 19.6 | 22.0 | 22.0 | 32.0 | 33.1 | 34.3 | 42.7 |
| **ratio to encounters off** | 1.00 | 0.98 | 0.95 | 0.95 | 1.09 | 1.09 | 1.09 | 1.11 | 1.12 | 1.12 |
| table × scale | 11 | 14 | 19 | 23 | 23 | 26 | 31 | 32 | 38 | 45 |
| ratio to table × scale | 1.00 | 0.96 | 0.87 | 0.81 | 1.05 | 0.93 | 1.12 | 1.14 | 1.01 | 1.07 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 26% / 13% | 40% / 44% | 34% / 43% | 53.6 | middle | early |
| all | 1–9 | 26% / 13% | 40% / 44% | 34% / 43% | 53.6 | middle | early |
| 1 | 1–13 | 28% / 14% | 43% / 51% | 29% / 35% | 115.3 | middle | early |
| all | 1–13 | 28% / 14% | 43% / 51% | 29% / 35% | 115.3 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.6 | 7.7 | 6.7 | 5.9 | 4.7 | 4.3 | 4.3 | 4.0 | 3.7 | 3.9 | 10.7 | 10.9 | 10.4 |
| launches read | 264 | 323 | 395 | 448 | 575 | 578 | 830 | 875 | 920 | 1149 | 711 | 719 | 716 |

Slope over waves 1–10: -0.60 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.67 | 1.00 | 4.33 |
| runs that reached it | 3 | 3 | 3 |
| tough, every run | 1.75 | 3.42 | 4.58 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| aimed | overdrive, railgun, focus | 0% | 9.7 | 5.4 | 9.6 | 2.25 (4) / 3.25 (4) / 2.00 (1) | 0.0 0.0 0.0 0.0 0.3 0.4 1.3 1.5 2.6 3.4 |
| self | airstrike, seeker, droneScreen | 0% | 9.0 | 5.6 | 10.4 | 3.00 (2) / 3.00 (1) / 3.00 (1) | 0.0 0.0 0.0 0.0 0.4 0.7 0.8 2.3 1.8 4.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
