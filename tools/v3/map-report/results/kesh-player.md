# Bot report: The Kesh Hook (`kesh`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.8; built 2026-11-18.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=kesh --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/kesh-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +0.33; doubles on w7 (0.21→0.54) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.67 a run (75% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.90 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 44%, cold late 26% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 12.1 s → w10 3.5 s (slope -0.91 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.50 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.60 (20), r2 1.30 (20), r3 1.26 (19); tough (every run): 0.63, 1.17, 1.50 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 4.1 lost 1–10, end 12.8; off-counter 4.3 lost 1–10, end 12.6 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 7 loses 0.54 after 0.21. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest late takes 26%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.17 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 30%, middle 44%, late 26%.

## Ships lost per wave

Normal: won 75%, mean end wave 13.2 (14 = won), 3.7 lost in waves 1–10, 0.50 in waves 1–5. Tough: 3.8 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.08 | 0.17 | 0.25 | 0.21 | 0.54 | 0.54 | 0.83 | 1.17 | 0.63 | 1.17 | 1.50 |
| normal, runs that reached it | 0.00 | 0.00 | 0.08 | 0.17 | 0.25 | 0.21 | 0.54 | 0.54 | 0.83 | 1.09 | 0.60 | 1.30 | 1.26 |
| normal, mean over all runs | 0.00 | 0.00 | 0.08 | 0.17 | 0.25 | 0.21 | 0.54 | 0.54 | 0.83 | 1.04 | 0.50 | 1.08 | 1.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 20 | 19 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +0.33.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 0.5 | 1.7 | 2.9 | 3.4 | 6.7 | 4.5 | 5.9 | 8.2 | 7.7 | 2.8 | 2.8 | 2.8 |
| runs with ≥ 1 | 0% | 38% | 75% | 96% | 92% | 100% | 100% | 100% | 100% | 100% | 100% | 88% | 88% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 13.0 | 16.6 | 20.5 | 21.3 | 23.8 | 24.6 | 26.8 | 33.7 | 32.6 | 41.0 |
| launches (encounters off) | 13.0 | 16.4 | 20.0 | 20.3 | 23.5 | 22.9 | 29.8 | 31.5 | 32.5 | 40.6 |
| **ratio to encounters off** | 1.00 | 1.01 | 1.02 | 1.05 | 1.01 | 1.07 | 0.90 | 1.07 | 1.00 | 1.01 |
| table × scale | 13 | 17 | 22 | 25 | 26 | 30 | 35 | 38 | 43 | 52 |
| ratio to table × scale | 1.00 | 0.98 | 0.93 | 0.85 | 0.91 | 0.82 | 0.76 | 0.89 | 0.76 | 0.79 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 30% / 6% | 44% / 78% | 26% / 16% | 53.5 | middle | late |
| all | 1–9 | 30% / 6% | 44% / 78% | 26% / 16% | 53.5 | middle | late |
| 1 | 1–13 | 24% / 7% | 44% / 52% | 32% / 41% | 103.6 | middle | early |
| all | 1–13 | 24% / 7% | 44% / 52% | 32% / 41% | 103.6 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 12.1 | 10.8 | 5.8 | 4.2 | 4.1 | 2.4 | 3.6 | 3.8 | 2.5 | 3.5 | 6.2 | 6.0 | 6.2 |
| launches read | 312 | 397 | 489 | 507 | 567 | 591 | 639 | 806 | 780 | 977 | 790 | 861 | 856 |

Slope over waves 1–10: -0.91 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.60 | 1.30 | 1.26 |
| runs that reached it | 20 | 20 | 19 |
| tough, every run | 0.63 | 1.17 | 1.50 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 20 | 19 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.2** | **0.0** | **0.3** | **0.2** | **0.3** | **0.2** | **0.5** | **0.1** | **0.2** | **0.4** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.2 | 0.1 | 0.2 | 0.2 | 0.4 | 0.1 | 0.2 | 0.3 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.11 |
| clutch | 0.00 | 0.00 | 0.00 | 0.13 | 0.04 | 0.25 | 0.13 | 0.25 | 0.08 | 0.30 | 0.05 | 0.20 | 0.32 |
| runs with no save | 100% | 100% | 100% | 83% | 96% | 88% | 83% | 75% | 79% | 65% | 90% | 80% | 74% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.08 | 0.08 | 0.13 | 0.22 | 0.05 | 0.05 | 0.05 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.10 | 0.05 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.21 | 0.04 | 0.04 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.04 | 0.13 | 0.08 | 0.17 | 0.10 | 0.05 | 0.26 |
| tension peak | 0.04 | 0.36 | 0.54 | 1.02 | 0.79 | 0.91 | 0.80 | 1.14 | 1.43 | 1.72 | 1.16 | 1.53 | 1.45 |
| peaks | 0.0 | 0.1 | 0.2 | 0.9 | 0.8 | 0.5 | 0.6 | 1.1 | 0.9 | 1.1 | 0.8 | 0.8 | 0.7 |
| release after a peak (s) | 0.0 | 0.1 | 0.5 | 1.6 | 1.1 | 0.7 | 0.9 | 1.6 | 2.3 | 2.3 | 3.4 | 3.3 | 2.8 |
| hot share | 0% | 0% | 1% | 4% | 3% | 2% | 2% | 4% | 4% | 6% | 22% | 31% | 28% |
| calm share | 100% | 94% | 86% | 85% | 84% | 78% | 80% | 79% | 75% | 75% | 38% | 36% | 40% |
| shape (most runs) | flat 100% | flat 92% | flat 79% | one peak 71% | flat 46% | flat 58% | flat 50% | one peak 42% | one peak 62% | one peak 74% | one peak 40% | pinned 60% | pinned 58% |
| taps follow tension (r) | 0.50 | 0.43 | 0.39 | 0.54 | 0.46 | 0.47 | 0.51 | 0.47 | 0.45 | 0.44 | 0.50 | 0.43 | 0.49 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 178 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | overdrive, railgun, focus | 58% | 12.8 | 3.8 | 4.1 | 0.39 (18) / 1.56 (18) / 1.56 (18) | 0.0 0.0 0.1 0.3 0.4 0.2 0.5 0.4 0.6 1.8 |
| off-counter | airstrike, seeker, droneScreen | 54% | 12.6 | 4.0 | 4.3 | 0.65 (17) / 1.53 (17) / 1.00 (17) | 0.0 0.0 0.1 0.2 0.2 0.3 0.5 0.7 1.1 1.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
