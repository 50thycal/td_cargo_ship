# Bot report: The Needle of Bosk (`needle`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.95; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=needle --seeds=24 --kits=plan --no-fun`. Heat map: `tools/v3/map-report/results/needle-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w7 +0.92; doubles on w5 (0.13→0.54), w7 (0.54→1.46) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 2.04 a run (88% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.94 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 45%, cold early 13% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.6 s → w10 5.4 s (slope -0.23 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.17 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.83 (6), r2 2.33 (6), r3 3.67 (3); tough (every run): 2.13, 3.25, 2.88 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 7.4 lost 1–10, end 10.1; off-counter 9.5 lost 1–10, end 9.6 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 5 loses 0.54 after 0.13; wave 7 loses 1.46 after 0.54. Move budget from it to the wave before, or soften its biggest raid.
- Hardest of waves 1–10 for the bot: wave 10 (2.42 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 13%, middle 45%, late 42%.

## Ships lost per wave

Normal: won 0%, mean end wave 9.5 (14 = won), 5.5 lost in waves 1–10, 1.17 in waves 1–5. Tough: 9.2 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.42 | 0.13 | 0.54 | 0.54 | 1.46 | 1.54 | 2.04 | 2.42 | 2.13 | 3.25 | 2.88 |
| normal, runs that reached it | 0.00 | 0.08 | 0.42 | 0.13 | 0.54 | 0.54 | 1.29 | 0.75 | 1.38 | 2.44 | 1.83 | 2.33 | 3.67 |
| normal, mean over all runs | 0.00 | 0.08 | 0.42 | 0.13 | 0.54 | 0.54 | 1.29 | 0.63 | 0.92 | 0.92 | 0.46 | 0.58 | 0.46 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 20 | 16 | 9 | 6 | 6 | 3 |

Biggest one-wave step up (tough, waves 2–10): wave 7, +0.92.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.2 | 1.0 | 3.4 | 2.0 | 3.4 | 3.5 | 2.5 | 2.4 | 4.0 | 4.7 | 2.0 | 1.3 | 1.5 |
| runs with ≥ 1 | 17% | 71% | 96% | 88% | 96% | 100% | 100% | 92% | 100% | 100% | 83% | 83% | 83% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 16.6 | 24.5 | 23.0 | 26.0 | 29.5 | 32.5 | 37.8 | 42.9 | 46.6 |
| launches (encounters off) | 15.0 | 16.6 | 25.4 | 23.6 | 27.5 | 30.1 | 33.4 | 39.0 | 44.2 | 49.4 |
| **ratio to encounters off** | 1.00 | 1.00 | 0.96 | 0.98 | 0.95 | 0.98 | 0.97 | 0.97 | 0.97 | 0.94 |
| table × scale | 15 | 20 | 26 | 30 | 31 | 36 | 41 | 45 | 52 | 62 |
| ratio to table × scale | 1.00 | 0.83 | 0.94 | 0.77 | 0.84 | 0.82 | 0.79 | 0.84 | 0.83 | 0.75 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 13% / 5% | 45% / 39% | 42% / 56% | 58.6 | middle | early |
| all | 1–9 | 13% / 5% | 45% / 39% | 42% / 56% | 58.6 | middle | early |
| 1 | 1–13 | 10% / 4% | 49% / 45% | 41% / 51% | 109.2 | middle | early |
| all | 1–13 | 10% / 4% | 49% / 45% | 41% / 51% | 109.2 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.6 | 6.8 | 5.8 | 6.9 | 4.7 | 5.4 | 5.5 | 6.0 | 5.8 | 5.4 | 5.6 | 4.6 | 4.6 |
| launches read | 360 | 398 | 562 | 548 | 624 | 704 | 776 | 894 | 1025 | 1083 | 216 | 240 | 274 |

Slope over waves 1–10: -0.23 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.83 | 2.33 | 3.67 |
| runs that reached it | 6 | 6 | 3 |
| tough, every run | 2.13 | 3.25 | 2.88 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, thermo, gunships | 4% | 10.1 | 5.0 | 7.4 | 1.14 (7) / 2.43 (7) / 2.50 (6) | 0.0 0.0 0.4 0.1 0.3 0.8 0.8 0.9 1.6 2.5 |
| off-counter | seeker, frigate, droneScreen | 4% | 9.6 | 5.8 | 9.5 | 0.25 (4) / 2.00 (4) / 3.00 (4) | 0.0 0.0 0.3 0.2 0.5 0.7 1.6 1.3 2.1 2.8 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
