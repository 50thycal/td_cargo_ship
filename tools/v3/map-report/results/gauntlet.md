# Bot report: The Gauntlet (`gauntlet`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.75; built 2026-11-17.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=gauntlet --seeds=24 --kits=aimed,self`. Heat map: `tools/v3/map-report/results/gauntlet-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +2.29; doubles on w8 (0.75→3.04) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 6.75 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w3 ×1.05 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot early 40%, cold late 21%; lane 2: hot middle 38%, cold early 31% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 7.1 s → w10 3.3 s (slope -0.50 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.58 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 6.00 (1), r2 – (0), r3 – (0); tough (every run): 4.04, 5.71, 5.33 | about 1 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | aimed 11.3 lost 1–10, end 8.8; self 13.2 lost 1–10, end 8.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 8 loses 3.04 after 0.75. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 2 (coldest early takes 31%): aim waves 1–9 away from it.
- Hardest of waves 1–10 for the bot: wave 10 (3.38 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 35%, middle 38%, late 26%.

## Ships lost per wave

Normal: won 0%, mean end wave 8.7 (14 = won), 5.3 lost in waves 1–10, 0.58 in waves 1–5, 0.04 in bonus waves. Tough: 11.1 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.04 | 0.08 | 0.08 | 0.38 | 0.58 | 0.75 | 3.04 | 2.79 | 3.38 | 4.04 | 5.71 | 5.33 |
| normal, runs that reached it | 0.00 | 0.04 | 0.08 | 0.08 | 0.38 | 0.58 | 0.75 | 2.50 | 1.46 | 1.40 | 6.00 | – | – |
| normal, mean over all runs | 0.00 | 0.04 | 0.08 | 0.08 | 0.38 | 0.58 | 0.75 | 2.29 | 0.79 | 0.29 | 0.25 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 13 | 5 | 1 | 0 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +2.29.

## Close calls per wave (tough)

A threat that came within 2.0 s of a hull (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.8 | 2.0 | 6.8 | 8.5 | 9.5 | 13.7 | 15.3 | 17.4 | 18.5 | 21.3 | 7.0 | 6.3 | 6.2 |
| runs with ≥ 1 | 79% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 12.0 | 11.5 | 23.4 | 17.7 | 20.1 | 26.3 | 32.1 | 34.5 | 38.8 | 42.9 |
| launches (encounters off) | 12.0 | 11.4 | 22.3 | 17.6 | 20.1 | 25.8 | 32.6 | 34.4 | 40.3 | 44.4 |
| **ratio to encounters off** | 1.00 | 1.01 | 1.05 | 1.01 | 1.00 | 1.02 | 0.98 | 1.00 | 0.96 | 0.97 |
| table × scale | 12 | 16 | 21 | 24 | 25 | 27 | 32 | 36 | 41 | 49 |
| ratio to table × scale | 1.00 | 0.72 | 1.12 | 0.74 | 0.80 | 0.97 | 1.00 | 0.96 | 0.95 | 0.88 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 40% / 19% | 39% / 45% | 21% / 36% | 30.6 | early | late |
| 2 | 1–9 | 31% / 18% | 38% / 41% | 32% / 41% | 32.0 | middle | early |
| all | 1–9 | 35% / 18% | 38% / 43% | 26% / 39% | 62.6 | middle | late |
| 1 | 1–13 | 38% / 25% | 39% / 44% | 22% / 31% | 71.3 | middle | late |
| 2 | 1–13 | 34% / 21% | 40% / 48% | 25% / 31% | 70.6 | middle | late |
| all | 1–13 | 36% / 23% | 40% / 46% | 24% / 31% | 141.9 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.1 | 7.9 | 6.7 | 5.0 | 4.2 | 4.4 | 4.1 | 3.5 | 3.8 | 3.3 | 6.8 | 6.8 | 6.5 |
| launches read | 288 | 275 | 560 | 425 | 478 | 628 | 769 | 826 | 928 | 1026 | 552 | 552 | 552 |

Slope over waves 1–10: -0.50 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 6.00 | – | – |
| runs that reached it | 1 | 0 | 0 |
| tough, every run | 4.04 | 5.71 | 5.33 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| aimed | overdrive, railgun, focus | 0% | 8.8 | 5.5 | 11.3 | 0.00 (1) / 6.00 (1) / – (0) | 0.0 0.0 0.0 0.1 0.5 0.7 1.0 2.5 3.4 3.1 |
| self | airstrike, seeker, droneScreen | 0% | 8.5 | 5.4 | 13.2 | 1.00 (1) / 5.00 (1) / – (0) | 0.0 0.0 0.1 0.1 0.5 0.5 1.3 3.0 3.8 3.7 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
