# Bot report: The Needle of Bosk (`needle`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.95; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=needle --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/needle-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.25; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w4 1.63 a run (83% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w3 ×0.95 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 47%, cold early 12% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.6 s → w10 5.2 s (slope -0.24 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.29 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.50 (22), r2 1.64 (22), r3 2.11 (19); tough (every run): 0.50, 1.75, 2.38 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 2.9 lost 1–10, end 13.2; counter 3.1 lost 1–10, end 13.3 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (0.92 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 12%, middle 41%, late 47%.

## Ships lost per wave

Normal: won 58%, mean end wave 13.2 (14 = won), 2.9 lost in waves 1–10, 0.29 in waves 1–5. Tough: 3.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.08 | 0.08 | 0.04 | 0.29 | 0.38 | 0.46 | 0.71 | 0.92 | 0.50 | 1.75 | 2.38 |
| normal, runs that reached it | 0.00 | 0.08 | 0.08 | 0.08 | 0.04 | 0.29 | 0.38 | 0.46 | 0.63 | 0.87 | 0.50 | 1.64 | 2.11 |
| normal, mean over all runs | 0.00 | 0.08 | 0.08 | 0.08 | 0.04 | 0.29 | 0.38 | 0.46 | 0.63 | 0.83 | 0.46 | 1.50 | 1.67 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 22 | 19 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.25.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 0.9 | 4.4 | 1.6 | 4.0 | 3.8 | 3.0 | 1.7 | 4.4 | 5.9 | 1.5 | 1.7 | 2.3 |
| runs with ≥ 1 | 0% | 58% | 100% | 83% | 96% | 100% | 100% | 83% | 100% | 100% | 71% | 79% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 16.6 | 24.2 | 23.0 | 26.0 | 29.3 | 32.3 | 37.4 | 42.8 | 46.9 |
| launches (encounters off) | 15.0 | 16.6 | 25.5 | 23.3 | 25.2 | 29.3 | 33.8 | 36.9 | 43.0 | 47.3 |
| **ratio to encounters off** | 1.00 | 1.00 | 0.95 | 0.99 | 1.03 | 1.00 | 0.95 | 1.01 | 0.99 | 0.99 |
| table × scale | 15 | 20 | 26 | 30 | 31 | 36 | 41 | 45 | 52 | 62 |
| ratio to table × scale | 1.00 | 0.83 | 0.93 | 0.77 | 0.84 | 0.81 | 0.79 | 0.83 | 0.82 | 0.76 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 12% / 6% | 41% / 37% | 47% / 57% | 44.1 | late | early |
| all | 1–9 | 12% / 6% | 41% / 37% | 47% / 57% | 44.1 | late | early |
| 1 | 1–13 | 9% / 5% | 44% / 50% | 47% / 45% | 88.8 | late | early |
| all | 1–13 | 9% / 5% | 44% / 50% | 47% / 45% | 88.8 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.6 | 6.8 | 5.7 | 6.9 | 4.7 | 5.4 | 5.5 | 6.2 | 5.7 | 5.2 | 5.9 | 5.0 | 4.6 |
| launches read | 360 | 397 | 555 | 548 | 624 | 702 | 773 | 886 | 1021 | 1099 | 217 | 241 | 271 |

Slope over waves 1–10: -0.24 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.50 | 1.64 | 2.11 |
| runs that reached it | 22 | 22 | 19 |
| tough, every run | 0.50 | 1.75 | 2.38 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 22 | 19 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.0** | **0.0** | **0.3** | **0.0** | **0.2** | **0.0** | **0.1** | **0.2** | **0.5** | **0.7** |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.0 | 0.0 | 0.2 | 0.0 | 0.1 | 0.0 | 0.1 | 0.2 | 0.4 | 0.6 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.16 |
| clutch | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.13 | 0.04 | 0.13 | 0.04 | 0.09 | 0.18 | 0.32 | 0.42 |
| runs with no save | 100% | 100% | 92% | 100% | 96% | 75% | 96% | 83% | 96% | 91% | 91% | 59% | 42% |
|   pickup save | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.00 | 0.13 | 0.04 | 0.09 | 0.09 | 0.23 | 0.42 |
|   cover choice | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.08 | 0.04 | 0.00 | 0.00 | 0.00 | 0.05 | 0.05 | 0.05 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.17 | 0.00 | 0.04 | 0.00 | 0.04 | 0.05 | 0.14 | 0.26 |
| tension peak | 0.13 | 0.36 | 0.82 | 0.44 | 0.62 | 0.98 | 0.67 | 0.69 | 0.71 | 0.94 | 1.52 | 2.06 | 2.24 |
| peaks | 0.0 | 0.1 | 0.5 | 0.0 | 0.3 | 0.7 | 0.3 | 0.4 | 0.5 | 0.6 | 1.0 | 1.0 | 1.0 |
| release after a peak (s) | 0.0 | 0.2 | 0.8 | 0.0 | 0.5 | 1.6 | 0.3 | 0.7 | 0.7 | 1.0 | 5.4 | 5.0 | 4.3 |
| hot share | 0% | 0% | 2% | 0% | 1% | 3% | 1% | 1% | 1% | 2% | 24% | 42% | 49% |
| calm share | 99% | 90% | 79% | 92% | 86% | 79% | 82% | 80% | 75% | 76% | 46% | 25% | 26% |
| shape (most runs) | flat 100% | flat 92% | flat 50% | flat 96% | flat 75% | one peak 71% | flat 79% | flat 67% | flat 62% | flat 48% | one peak 55% | pinned 77% | pinned 89% |
| taps follow tension (r) | 0.45 | 0.45 | 0.39 | 0.35 | 0.49 | 0.45 | 0.42 | 0.42 | 0.33 | 0.34 | 0.52 | 0.35 | 0.36 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 156 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, thermo, gunships | 63% | 13.3 | 3.0 | 3.1 | 0.68 (22) / 1.50 (22) / 2.25 (20) | 0.0 0.0 0.2 0.1 0.1 0.4 0.3 0.5 0.6 0.8 |
| off-counter | seeker, frigate, droneScreen | 58% | 13.2 | 2.8 | 2.9 | 0.59 (22) / 1.27 (22) / 2.00 (22) | 0.0 0.0 0.1 0.1 0.2 0.3 0.4 0.4 0.5 1.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
