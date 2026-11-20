# Bot report: The Island (`island`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=island --seeds=24 --kits=plan --no-fun`. Heat map: `tools/v3/map-report/results/island-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +1.04; doubles on w7 (0.75→1.67) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 1.08 a run (54% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w2 ×0.87 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 49%, cold late 25%; lane 2: hot middle 57%, cold late 18% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 7.3 s → w10 2.8 s (slope -0.49 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.83 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 3.67 (3), r2 3.50 (2), r3 – (0); tough (every run): 2.04, 4.83, 3.42 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 9.2 lost 1–10, end 9.1; off-counter 13.9 lost 1–10, end 8.4 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 7 loses 1.67 after 0.75. Move budget from it to the wave before, or soften its biggest raid.
- Hardest of waves 1–10 for the bot: wave 10 (3.33 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 26%, middle 52%, late 22%.

## Ships lost per wave

Normal: won 0%, mean end wave 9.0 (14 = won), 5.5 lost in waves 1–10, 0.83 in waves 1–5. Tough: 11.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.13 | 0.13 | 0.13 | 0.46 | 0.75 | 1.67 | 1.96 | 3.00 | 3.33 | 2.04 | 4.83 | 3.42 |
| normal, runs that reached it | 0.00 | 0.13 | 0.13 | 0.13 | 0.46 | 0.54 | 1.48 | 1.32 | 1.50 | 2.14 | 3.67 | 3.50 | – |
| normal, mean over all runs | 0.00 | 0.13 | 0.13 | 0.13 | 0.46 | 0.54 | 1.42 | 1.21 | 0.88 | 0.63 | 0.46 | 0.29 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 14 | 7 | 3 | 2 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +1.04.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.5 | 0.9 | 2.2 | 1.1 | 1.2 | 4.5 | 6.7 | 5.6 | 5.5 | 7.0 | 2.6 | 3.3 | 2.3 |
| runs with ≥ 1 | 29% | 58% | 79% | 54% | 54% | 100% | 100% | 100% | 100% | 100% | 92% | 96% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 16.0 | 15.1 | 24.7 | 21.9 | 22.0 | 28.3 | 31.8 | 34.3 | 38.2 | 44.3 |
| launches (encounters off) | 16.0 | 17.3 | 24.1 | 24.4 | 25.1 | 29.7 | 33.4 | 36.2 | 42.1 | 49.5 |
| **ratio to encounters off** | 1.00 | 0.87 | 1.02 | 0.90 | 0.88 | 0.95 | 0.95 | 0.95 | 0.91 | 0.89 |
| table × scale | 16 | 21 | 27 | 31 | 32 | 37 | 43 | 47 | 54 | 65 |
| ratio to table × scale | 1.00 | 0.72 | 0.92 | 0.71 | 0.69 | 0.77 | 0.74 | 0.73 | 0.71 | 0.68 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 26% / 17% | 49% / 55% | 25% / 29% | 36.5 | middle | late |
| 2 | 1–9 | 25% / 13% | 57% / 62% | 18% / 24% | 19.8 | middle | late |
| all | 1–9 | 26% / 15% | 52% / 58% | 22% / 27% | 56.3 | middle | late |
| 1 | 1–13 | 31% / 23% | 46% / 50% | 23% / 27% | 77.9 | middle | late |
| 2 | 1–13 | 28% / 16% | 52% / 56% | 20% / 28% | 39.0 | middle | late |
| all | 1–13 | 30% / 20% | 48% / 52% | 22% / 27% | 116.9 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.3 | 5.5 | 5.5 | 5.7 | 5.7 | 3.4 | 2.9 | 3.0 | 3.0 | 2.8 | 3.9 | 3.4 | 3.2 |
| launches read | 384 | 361 | 589 | 521 | 528 | 677 | 763 | 822 | 913 | 1058 | 643 | 815 | 619 |

Slope over waves 1–10: -0.49 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 3.67 | 3.50 | – |
| runs that reached it | 3 | 2 | 0 |
| tough, every run | 2.04 | 4.83 | 3.42 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, droneScreen, gunships | 0% | 9.1 | 5.3 | 9.2 | 4.33 (3) / 5.00 (1) / – (0) | 0.0 0.0 0.0 0.0 0.3 0.5 1.2 2.0 2.0 3.2 |
| off-counter | railgun, seeker, lance | 4% | 8.4 | 5.7 | 13.9 | 0.00 (1) / 0.00 (1) / 5.00 (1) | 0.0 0.1 0.3 0.4 0.4 1.1 2.2 2.5 3.0 3.8 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
