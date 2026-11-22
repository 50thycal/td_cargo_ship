# Bot report: Dreadnought Pass (`dreadnought`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 0.85; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=dreadnought --seeds=24 --armory=latest --kits=plan`. Heat map: `tools/v3/map-report/results/dreadnought-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.46; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w4 1.63 a run (83% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w6 ×0.87 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 44%, cold early 17% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 7.1 s → w10 6.0 s (slope -0.22 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.58 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.83 (18), r2 1.44 (18), r3 1.33 (18); tough (every run): 0.92, 1.54, 1.83 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 4.4 lost 1–10, end 12.3; counter 4.6 lost 1–10, end 12.8 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.21 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 17%, middle 38%, late 44%.

## Ships lost per wave

Normal: won 71%, mean end wave 12.7 (14 = won), 3.8 lost in waves 1–10, 0.58 in waves 1–5. Tough: 4.2 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.04 | 0.21 | 0.13 | 0.21 | 0.25 | 0.50 | 0.58 | 1.04 | 1.21 | 0.92 | 1.54 | 1.83 |
| normal, runs that reached it | 0.00 | 0.04 | 0.21 | 0.13 | 0.21 | 0.25 | 0.50 | 0.58 | 1.04 | 1.05 | 0.83 | 1.44 | 1.33 |
| normal, mean over all runs | 0.00 | 0.04 | 0.21 | 0.13 | 0.21 | 0.25 | 0.50 | 0.58 | 1.00 | 0.83 | 0.63 | 1.08 | 1.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 19 | 18 | 18 | 18 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.46.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.1 | 1.0 | 1.7 | 1.0 | 1.0 | 1.6 | 1.5 | 1.5 | 2.6 | 1.6 | 1.2 | 1.9 | 2.8 |
| kills a minute | 36 | 30 | 45 | 31 | 30 | 43 | 35 | 36 | 56 | 41 | 24 | 42 | 59 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.3 | 1.1 | 2.7 | 1.6 | 1.8 | 2.6 | 4.0 | 1.8 | 2.0 | 3.6 | 1.6 | 2.7 | 5.5 |
| runs with ≥ 1 | 75% | 75% | 92% | 83% | 83% | 88% | 100% | 67% | 92% | 100% | 83% | 96% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 14.3 | 14.6 | 40.3 | 17.5 | 21.4 | 36.8 | 33.2 | 32.8 | 57.9 | 62.9 |
| launches (encounters off) | 14.0 | 13.6 | 41.6 | 19.1 | 20.2 | 42.2 | 32.0 | 35.5 | 56.8 | 64.5 |
| **ratio to encounters off** | 1.02 | 1.08 | 0.97 | 0.91 | 1.06 | 0.87 | 1.04 | 0.92 | 1.02 | 0.97 |
| table × scale | 14 | 18 | 23 | 26 | 27 | 32 | 36 | 40 | 46 | 55 |
| ratio to table × scale | 1.02 | 0.81 | 1.75 | 0.67 | 0.79 | 1.15 | 0.92 | 0.82 | 1.26 | 1.14 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 17% / 11% | 38% / 39% | 44% / 49% | 31.8 | late | early |
| all | 1–9 | 17% / 11% | 38% / 39% | 44% / 49% | 31.8 | late | early |
| 1 | 1–13 | 19% / 10% | 34% / 30% | 47% / 60% | 66.6 | late | early |
| all | 1–13 | 19% / 10% | 34% / 30% | 47% / 60% | 66.6 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.1 | 9.8 | 7.4 | 6.8 | 5.8 | 6.3 | 7.1 | 7.3 | 5.9 | 6.0 | 5.5 | 5.1 | 5.5 |
| launches read | 432 | 441 | 1021 | 454 | 547 | 909 | 795 | 782 | 1383 | 1492 | 400 | 590 | 810 |

Slope over waves 1–10: -0.22 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.83 | 1.44 | 1.33 |
| runs that reached it | 18 | 18 | 18 |
| tough, every run | 0.92 | 1.54 | 1.83 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 19 | 18 | 18 | 18 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.1** | **0.0** | **0.1** | **0.1** | **0.1** | **0.3** | **0.3** | **0.1** | **0.1** | **0.4** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.1 | 0.1 | 0.1 | 0.3 | 0.2 | 0.0 | 0.1 | 0.3 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.04 | 0.08 | 0.04 | 0.13 | 0.08 | 0.08 | 0.26 | 0.21 | 0.06 | 0.11 | 0.33 |
| runs with no save | 100% | 100% | 96% | 92% | 96% | 88% | 92% | 96% | 74% | 79% | 94% | 89% | 61% |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.04 | 0.00 | 0.08 | 0.22 | 0.11 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.06 | 0.00 | 0.22 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.08 | 0.00 | 0.00 | 0.13 | 0.16 | 0.00 | 0.11 | 0.17 |
| tension peak | 0.32 | 0.41 | 0.65 | 0.78 | 0.73 | 0.78 | 1.62 | 0.49 | 0.93 | 0.87 | 0.95 | 1.19 | 1.14 |
| peaks | 0.0 | 0.0 | 0.3 | 0.5 | 0.5 | 0.5 | 1.0 | 0.1 | 0.7 | 0.9 | 1.3 | 1.9 | 2.1 |
| release after a peak (s) | 0.0 | 0.1 | 0.4 | 1.3 | 1.5 | 0.8 | 2.2 | 0.5 | 1.2 | 0.9 | 1.3 | 1.6 | 2.4 |
| hot share | 0% | 0% | 1% | 3% | 2% | 2% | 4% | 0% | 4% | 1% | 7% | 11% | 13% |
| calm share | 87% | 94% | 76% | 89% | 87% | 84% | 84% | 89% | 79% | 87% | 79% | 65% | 58% |
| shape (most runs) | flat 100% | flat 96% | flat 75% | flat 50% | one peak 54% | flat 58% | one peak 92% | flat 87% | flat 48% | flat 42% | one peak 44% | sawtooth 56% | sawtooth 44% |
| taps follow tension (r) | 0.31 | 0.08 | 0.25 | 0.30 | 0.34 | 0.16 | 0.30 | 0.22 | 0.20 | 0.30 | 0.40 | 0.36 | 0.25 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 73 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, shield, gunships | 79% | 12.8 | 4.0 | 4.6 | 0.53 (19) / 1.16 (19) / 0.95 (19) | 0.0 0.0 0.3 0.1 0.2 0.3 0.5 1.1 0.8 1.3 |
| off-counter | seeker, orbital, bomberWing | 54% | 12.3 | 3.5 | 4.4 | 0.94 (16) / 1.56 (16) / 1.25 (16) | 0.0 0.0 0.3 0.1 0.5 0.2 0.3 0.7 1.3 1.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
