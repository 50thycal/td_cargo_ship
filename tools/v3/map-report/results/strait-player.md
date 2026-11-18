# Bot report: The Strait (`strait`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.7; built 2026-11-18.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=strait --seeds=24 --kits=plan --armory=player --fun-placebo`. Heat map: `tools/v3/map-report/results/strait-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.50; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w5 1.71 a run (83% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.91 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 53%, cold early 16% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.6 s → w10 5.1 s (slope -0.54 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.38 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.07 (14), r2 1.86 (14), r3 2.00 (13); tough (every run): 1.46, 1.75, 2.96 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 4.9 lost 1–10, end 12.3; off-counter 5.6 lost 1–10, end 11.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.46 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 16%, middle 31%, late 53%.

## Ships lost per wave

Normal: won 29%, mean end wave 11.9 (14 = won), 4.5 lost in waves 1–10, 0.38 in waves 1–5. Tough: 5.2 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.08 | 0.13 | 0.17 | 0.50 | 0.83 | 0.75 | 1.25 | 1.46 | 1.46 | 1.75 | 2.96 |
| normal, runs that reached it | 0.00 | 0.00 | 0.08 | 0.13 | 0.17 | 0.50 | 0.83 | 0.67 | 1.13 | 1.18 | 1.07 | 1.86 | 2.00 |
| normal, mean over all runs | 0.00 | 0.00 | 0.08 | 0.13 | 0.17 | 0.50 | 0.83 | 0.67 | 1.08 | 1.08 | 0.63 | 1.08 | 1.08 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 14 | 14 | 13 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.50.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 0.3 | 3.3 | 3.3 | 1.7 | 4.0 | 2.8 | 5.0 | 6.0 | 3.8 | 4.0 | 5.3 | 3.8 |
| runs with ≥ 1 | 13% | 33% | 96% | 96% | 83% | 96% | 100% | 100% | 100% | 100% | 71% | 88% | 75% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 11.0 | 13.5 | 16.6 | 19.5 | 21.5 | 20.9 | 31.0 | 32.7 | 33.6 | 38.8 |
| launches (encounters off) | 11.0 | 13.7 | 17.2 | 19.4 | 22.2 | 21.5 | 31.8 | 32.6 | 34.2 | 42.6 |
| **ratio to encounters off** | 1.00 | 0.98 | 0.97 | 1.01 | 0.97 | 0.97 | 0.98 | 1.00 | 0.98 | 0.91 |
| table × scale | 11 | 14 | 19 | 23 | 23 | 26 | 31 | 32 | 38 | 45 |
| ratio to table × scale | 1.00 | 0.96 | 0.87 | 0.85 | 0.93 | 0.80 | 1.00 | 1.02 | 0.88 | 0.86 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 16% / 6% | 31% / 11% | 53% / 83% | 43.2 | late | early |
| all | 1–9 | 16% / 6% | 31% / 11% | 53% / 83% | 43.2 | late | early |
| 1 | 1–13 | 22% / 15% | 36% / 28% | 42% / 57% | 108.4 | late | early |
| all | 1–13 | 22% / 15% | 36% / 28% | 42% / 57% | 108.4 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.6 | 10.6 | 6.5 | 5.5 | 6.9 | 6.3 | 5.3 | 5.6 | 4.3 | 5.1 | 10.8 | 10.6 | 10.4 |
| launches read | 264 | 322 | 398 | 468 | 514 | 499 | 742 | 780 | 803 | 927 | 836 | 1074 | 1194 |

Slope over waves 1–10: -0.54 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.07 | 1.86 | 2.00 |
| runs that reached it | 14 | 14 | 13 |
| tough, every run | 1.46 | 1.75 | 2.96 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 14 | 14 | 13 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.2** | **0.0** | **0.0** | **0.1** | **0.1** | **0.3** | **0.2** | **0.1** | **0.7** | **0.1** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 | 0.2 | 0.1 | 0.5 | 0.1 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.05 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.04 | 0.13 | 0.08 | 0.17 | 0.23 | 0.07 | 0.43 | 0.08 |
| runs with no save | 100% | 100% | 100% | 83% | 100% | 96% | 92% | 92% | 74% | 77% | 86% | 64% | 92% |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.23 | 0.00 | 0.64 | 0.08 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.00 | 0.13 | 0.00 | 0.14 | 0.07 | 0.00 |
| noise floor (placebo) | 0.00 | 0.00 | 0.00 | 0.08 | 0.08 | 0.00 | 0.00 | 0.04 | 0.00 | 0.14 | 0.00 | 0.21 | 0.15 |
| tension peak | 0.24 | 0.21 | 0.58 | 1.13 | 0.68 | 0.91 | 1.07 | 0.97 | 1.32 | 2.01 | 0.99 | 1.04 | 1.43 |
| peaks | 0.0 | 0.0 | 0.3 | 1.0 | 0.3 | 1.0 | 0.7 | 0.9 | 0.9 | 1.0 | 0.8 | 0.7 | 0.9 |
| release after a peak (s) | 0.0 | 0.0 | 0.8 | 2.4 | 0.5 | 1.3 | 1.6 | 1.6 | 3.2 | 2.1 | 2.0 | 2.4 | 3.4 |
| hot share | 0% | 0% | 1% | 8% | 1% | 2% | 3% | 2% | 7% | 4% | 9% | 14% | 24% |
| calm share | 96% | 96% | 86% | 83% | 85% | 80% | 83% | 82% | 78% | 85% | 45% | 44% | 37% |
| shape (most runs) | flat 100% | flat 100% | flat 71% | one peak 96% | flat 75% | one peak 42% | one peak 71% | one peak 62% | one peak 61% | one peak 95% | one peak 64% | flat 43% | pinned 38% |
| taps follow tension (r) | 0.43 | 0.38 | 0.53 | 0.68 | 0.50 | 0.50 | 0.45 | 0.38 | 0.45 | 0.38 | 0.32 | 0.43 | 0.35 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 102 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | flak, shrapnel, droneScreen | 38% | 12.3 | 4.3 | 4.9 | 0.94 (17) / 1.12 (17) / 2.13 (16) | 0.0 0.0 0.1 0.0 0.2 0.3 0.7 0.8 1.4 1.4 |
| off-counter | railgun, airstrike, frigate | 29% | 11.5 | 4.8 | 5.6 | 1.31 (13) / 1.77 (13) / 1.67 (9) | 0.0 0.0 0.0 0.0 0.3 0.5 0.7 0.9 1.6 1.7 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
