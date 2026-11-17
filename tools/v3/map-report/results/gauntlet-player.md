# Bot report: The Gauntlet (`gauntlet`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.75; built 2026-11-17.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=gauntlet --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/gauntlet-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.63; doubles on w6 (0.17→0.54) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 3.29 a run (92% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w8 ×0.90 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot early 45%, cold late 21%; lane 2: hot early 46%, cold late 16% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 7.1 s → w10 3.4 s (slope -0.43 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.58 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.54 (13), r2 0.31 (13), r3 1.23 (13); tough (every run): 0.54, 0.75, 1.50 | about 1 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | counter 5.9 lost 1–10, end 11.4; off-counter 7.3 lost 1–10, end 10.9 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 6 loses 0.54 after 0.17. Move budget from it to the wave before, or soften its biggest raid.
- Hardest of waves 1–10 for the bot: wave 10 (1.83 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 46%, middle 36%, late 19%.

## Ships lost per wave

Normal: won 54%, mean end wave 12.0 (14 = won), 4.5 lost in waves 1–10, 0.58 in waves 1–5. Tough: 5.6 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.33 | 0.08 | 0.17 | 0.54 | 0.75 | 0.63 | 1.25 | 1.83 | 0.54 | 0.75 | 1.50 |
| normal, runs that reached it | 0.00 | 0.00 | 0.33 | 0.08 | 0.17 | 0.54 | 0.75 | 0.50 | 0.83 | 1.55 | 0.54 | 0.31 | 1.23 |
| normal, mean over all runs | 0.00 | 0.00 | 0.33 | 0.08 | 0.17 | 0.54 | 0.75 | 0.50 | 0.79 | 1.29 | 0.29 | 0.17 | 0.67 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 13 | 13 | 13 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.63.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 0.3 | 3.3 | 3.4 | 3.5 | 4.7 | 5.1 | 6.1 | 6.0 | 7.5 | 0.6 | 1.0 | 0.4 |
| runs with ≥ 1 | 33% | 25% | 92% | 92% | 100% | 100% | 100% | 100% | 100% | 100% | 38% | 67% | 42% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 12.0 | 11.5 | 23.5 | 17.6 | 20.5 | 25.1 | 29.5 | 30.5 | 40.2 | 41.5 |
| launches (encounters off) | 12.0 | 11.4 | 22.3 | 17.4 | 20.3 | 26.1 | 32.4 | 33.8 | 39.6 | 43.7 |
| **ratio to encounters off** | 1.00 | 1.01 | 1.05 | 1.01 | 1.01 | 0.96 | 0.91 | 0.90 | 1.01 | 0.95 |
| table × scale | 12 | 16 | 21 | 24 | 25 | 27 | 32 | 36 | 41 | 49 |
| ratio to table × scale | 1.00 | 0.72 | 1.12 | 0.73 | 0.82 | 0.93 | 0.92 | 0.85 | 0.98 | 0.85 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 45% / 65% | 34% / 17% | 21% / 17% | 27.3 | early | late |
| 2 | 1–9 | 46% / 48% | 37% / 39% | 16% / 14% | 29.1 | early | late |
| all | 1–9 | 46% / 57% | 36% / 28% | 19% / 16% | 56.4 | early | late |
| 1 | 1–13 | 35% / 42% | 39% / 32% | 25% / 25% | 54.8 | middle | late |
| 2 | 1–13 | 39% / 33% | 38% / 41% | 23% / 25% | 55.7 | early | late |
| all | 1–13 | 37% / 38% | 39% / 37% | 24% / 25% | 110.5 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.1 | 7.6 | 5.7 | 4.4 | 4.2 | 3.8 | 3.7 | 3.8 | 3.9 | 3.4 | 7.2 | 6.7 | 7.4 |
| launches read | 288 | 275 | 561 | 422 | 491 | 601 | 707 | 728 | 962 | 994 | 264 | 384 | 335 |

Slope over waves 1–10: -0.43 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.54 | 0.31 | 1.23 |
| runs that reached it | 13 | 13 | 13 |
| tough, every run | 0.54 | 0.75 | 1.50 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | shrapnel, thermo, flak | 38% | 11.4 | 4.5 | 5.9 | 0.91 (11) / 1.09 (11) / 1.18 (11) | 0.0 0.0 0.2 0.0 0.2 0.5 0.8 1.1 1.5 1.5 |
| off-counter | aegis, seeker, droneScreen | 29% | 10.9 | 5.3 | 7.3 | 0.57 (7) / 0.14 (7) / 1.29 (7) | 0.0 0.0 0.2 0.1 0.3 0.6 0.7 1.0 1.4 3.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
