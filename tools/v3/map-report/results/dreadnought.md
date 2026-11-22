# Bot report: Dreadnought Pass (`dreadnought`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.85; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=dreadnought --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/dreadnought-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w6 +0.92; doubles on w6 (0.46→1.38) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 1.63 a run (75% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w4 ×0.90 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 43%, cold early 19% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 7.1 s → w10 6.0 s (slope -0.23 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.92 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.00 (4), r2 3.00 (4), r3 2.33 (3); tough (every run): 1.42, 3.21, 4.33 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 9.6 lost 1–10, end 9.5; off-counter 10.3 lost 1–10, end 9.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 6 loses 1.38 after 0.46. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (3.17 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 19%, middle 43%, late 38%.

## Ships lost per wave

Normal: won 4%, mean end wave 8.6 (14 = won), 5.3 lost in waves 1–10, 0.92 in waves 1–5, 0.04 in bonus waves. Tough: 12.4 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.04 | 0.33 | 0.08 | 0.46 | 1.38 | 1.71 | 2.25 | 3.17 | 2.96 | 1.42 | 3.21 | 4.33 |
| normal, runs that reached it | 0.00 | 0.04 | 0.33 | 0.08 | 0.46 | 1.25 | 1.10 | 2.07 | 2.00 | 0.67 | 1.00 | 3.00 | 2.33 |
| normal, mean over all runs | 0.00 | 0.04 | 0.33 | 0.08 | 0.46 | 1.25 | 0.92 | 1.29 | 0.75 | 0.17 | 0.17 | 0.50 | 0.29 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 20 | 15 | 9 | 6 | 4 | 4 | 3 |

Biggest one-wave step up (tough, waves 2–10): wave 6, +0.92.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.4 | 1.2 | 2.3 | 1.1 | 1.2 | 2.6 | 1.9 | 2.1 | 3.3 | 1.7 | 1.4 | 2.8 | 3.1 |
| kills a minute | 35 | 30 | 40 | 31 | 29 | 39 | 31 | 32 | 52 | 35 | 24 | 32 | 40 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.5 | 1.3 | 3.4 | 1.6 | 2.5 | 3.5 | 3.2 | 2.2 | 2.8 | 3.7 | 1.8 | 3.7 | 6.0 |
| runs with ≥ 1 | 88% | 83% | 100% | 75% | 96% | 92% | 96% | 88% | 92% | 96% | 92% | 100% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 14.3 | 14.6 | 41.6 | 17.5 | 21.7 | 43.6 | 33.7 | 33.7 | 60.9 | 68.3 |
| launches (encounters off) | 14.0 | 13.6 | 43.5 | 19.3 | 20.0 | 43.9 | 33.7 | 36.0 | 57.4 | 67.4 |
| **ratio to encounters off** | 1.02 | 1.08 | 0.96 | 0.90 | 1.08 | 0.99 | 1.00 | 0.94 | 1.06 | 1.01 |
| table × scale | 14 | 18 | 23 | 26 | 27 | 32 | 36 | 40 | 46 | 55 |
| ratio to table × scale | 1.02 | 0.81 | 1.81 | 0.67 | 0.80 | 1.36 | 0.94 | 0.84 | 1.32 | 1.24 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 19% / 9% | 43% / 45% | 38% / 46% | 59.2 | middle | early |
| all | 1–9 | 19% / 9% | 43% / 45% | 38% / 46% | 59.2 | middle | early |
| 1 | 1–13 | 21% / 12% | 42% / 43% | 37% / 45% | 114.5 | middle | early |
| all | 1–13 | 21% / 12% | 42% / 43% | 37% / 45% | 114.5 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.1 | 9.9 | 7.3 | 6.6 | 5.7 | 6.0 | 7.0 | 7.1 | 5.8 | 6.0 | 5.3 | 5.0 | 5.2 |
| launches read | 432 | 441 | 1053 | 453 | 554 | 1082 | 804 | 809 | 1453 | 1631 | 404 | 596 | 814 |

Slope over waves 1–10: -0.23 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.00 | 3.00 | 2.33 |
| runs that reached it | 4 | 4 | 3 |
| tough, every run | 1.42 | 3.21 | 4.33 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 20 | 15 | 9 | 6 | 4 | 4 | 3 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.0** | **0.2** | **0.2** | **0.3** | **0.5** | **0.4** | **0.2** | **0.0** | **0.5** | **0.7** |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.0 | 0.2 | 0.1 | 0.2 | 0.4 | 0.3 | 0.2 | 0.0 | 0.5 | 0.6 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.07 | 0.00 | 0.00 | 0.00 | 0.00 | 0.33 |
| clutch | 0.00 | 0.00 | 0.08 | 0.00 | 0.13 | 0.13 | 0.25 | 0.40 | 0.11 | 0.17 | 0.00 | 0.25 | 0.67 |
| runs with no save | 96% | 100% | 88% | 100% | 88% | 83% | 75% | 73% | 67% | 83% | 100% | 50% | 67% |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.08 | 0.10 | 0.13 | 0.00 | 0.17 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.05 | 0.20 | 0.11 | 0.00 | 0.00 | 0.25 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.10 | 0.07 | 0.00 | 0.00 | 0.00 | 0.00 | 0.33 |
|   kill save | 0.04 | 0.00 | 0.08 | 0.00 | 0.13 | 0.04 | 0.00 | 0.07 | 0.33 | 0.00 | 0.00 | 0.25 | 0.33 |
| tension peak | 0.38 | 0.41 | 0.76 | 0.82 | 0.79 | 1.04 | 2.18 | 1.24 | 1.33 | 1.33 | 1.07 | 1.45 | 1.43 |
| peaks | 0.0 | 0.1 | 0.5 | 0.5 | 0.7 | 1.1 | 1.3 | 0.8 | 1.4 | 0.7 | 2.0 | 2.5 | 2.0 |
| release after a peak (s) | 0.0 | 0.2 | 0.9 | 1.2 | 2.1 | 2.2 | 2.8 | 1.5 | 1.9 | 0.5 | 1.5 | 3.8 | 3.1 |
| hot share | 0% | 0% | 2% | 3% | 3% | 4% | 8% | 7% | 8% | 2% | 11% | 19% | 25% |
| calm share | 84% | 94% | 70% | 89% | 84% | 69% | 77% | 81% | 66% | 88% | 72% | 50% | 50% |
| shape (most runs) | flat 100% | flat 92% | flat 62% | one peak 54% | one peak 58% | one peak 54% | one peak 80% | one peak 53% | one peak 44% | flat 50% | sawtooth rising 50% | sawtooth 50% | sawtooth rising 33% |
| taps follow tension (r) | 0.29 | 0.11 | 0.26 | 0.24 | 0.38 | 0.12 | 0.30 | 0.26 | 0.10 | 0.26 | 0.36 | 0.22 | 0.36 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 54 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, shield, gunships | 4% | 9.5 | 5.2 | 9.6 | 1.00 (5) / 3.20 (5) / 2.00 (4) | 0.0 0.0 0.2 0.1 0.4 0.8 0.8 1.8 3.0 2.5 |
| off-counter | seeker, orbital, bomberWing | 0% | 9.5 | 4.9 | 10.3 | 1.17 (6) / 3.33 (6) / 2.25 (4) | 0.0 0.0 0.3 0.2 0.5 0.8 1.0 1.4 3.0 3.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
