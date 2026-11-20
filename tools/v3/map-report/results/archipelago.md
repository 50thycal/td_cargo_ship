# Bot report: The Archipelago (`archipelago`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.1; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=archipelago --seeds=24 --kits=plan --no-fun`. Heat map: `tools/v3/map-report/results/archipelago-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +2.04; doubles on w4 (0.17→0.63) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.58 a run (88% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.86 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot early 40%, cold late 21% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.3 s → w10 5.7 s (slope -0.17 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.83 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.00 (1), r2 4.00 (1), r3 1.00 (1); tough (every run): 1.42, 3.42, 3.54 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 18.4 lost 1–10, end 7.7; off-counter 19.3 lost 1–10, end 7.6 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 4 loses 0.63 after 0.17. Move budget from it to the wave before, or soften its biggest raid.
- Hardest of waves 1–10 for the bot: wave 9 (4.83 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 40%, middle 38%, late 21%.

## Ships lost per wave

Normal: won 0%, mean end wave 7.8 (14 = won), 6.0 lost in waves 1–10, 1.83 in waves 1–5. Tough: 18.6 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.17 | 0.63 | 1.08 | 1.79 | 2.08 | 4.13 | 4.83 | 3.92 | 1.42 | 3.42 | 3.54 |
| normal, runs that reached it | 0.00 | 0.00 | 0.17 | 0.63 | 1.04 | 1.27 | 1.45 | 1.69 | 2.33 | 2.00 | 1.00 | 4.00 | 1.00 |
| normal, mean over all runs | 0.00 | 0.00 | 0.17 | 0.63 | 1.04 | 1.17 | 1.21 | 0.92 | 0.58 | 0.25 | 0.04 | 0.17 | 0.04 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 22 | 20 | 13 | 6 | 3 | 1 | 1 | 1 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +2.04.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.5 | 1.4 | 1.6 | 2.2 | 3.6 | 3.9 | 4.0 | 6.2 | 4.8 | 6.7 | 5.4 | 7.6 | 8.5 |
| runs with ≥ 1 | 42% | 75% | 88% | 92% | 88% | 100% | 96% | 100% | 100% | 100% | 100% | 100% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 18.0 | 19.4 | 25.1 | 31.0 | 31.7 | 38.1 | 35.0 | 42.5 | 45.5 | 54.0 |
| launches (encounters off) | 18.0 | 21.0 | 24.2 | 31.6 | 29.7 | 36.8 | 40.9 | 44.9 | 52.1 | 59.0 |
| **ratio to encounters off** | 1.00 | 0.92 | 1.04 | 0.98 | 1.07 | 1.04 | 0.86 | 0.95 | 0.87 | 0.92 |
| table × scale | 18 | 23 | 29 | 35 | 36 | 41 | 48 | 52 | 60 | 72 |
| ratio to table × scale | 1.00 | 0.84 | 0.86 | 0.89 | 0.88 | 0.93 | 0.73 | 0.82 | 0.76 | 0.75 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 40% / 30% | 38% / 47% | 21% / 23% | 86.0 | early | late |
| all | 1–9 | 40% / 30% | 38% / 47% | 21% / 23% | 86.0 | early | late |
| 1 | 1–13 | 45% / 38% | 34% / 42% | 21% / 21% | 151.7 | early | late |
| all | 1–13 | 45% / 38% | 34% / 42% | 21% / 21% | 151.7 | early | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.3 | 6.5 | 5.4 | 6.9 | 5.7 | 6.1 | 5.9 | 5.6 | 6.0 | 5.7 | 6.0 | 5.6 | 5.4 |
| launches read | 432 | 466 | 601 | 738 | 755 | 903 | 837 | 1020 | 1086 | 1293 | 1302 | 1641 | 1810 |

Slope over waves 1–10: -0.17 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.00 | 4.00 | 1.00 |
| runs that reached it | 1 | 1 | 1 |
| tough, every run | 1.42 | 3.42 | 3.54 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | airstrike, aegis, flak | 0% | 7.7 | 6.0 | 18.4 | 1.00 (1) / 4.00 (1) / 1.00 (1) | 0.0 0.0 0.2 0.7 1.1 1.9 2.1 4.2 4.4 3.9 |
| off-counter | seeker, railgun, droneScreen | 4% | 7.6 | 5.8 | 19.3 | 0.00 (1) / 0.00 (1) / 0.00 (1) | 0.0 0.0 0.2 0.5 1.1 2.0 2.5 4.0 5.0 3.9 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
