# Bot report: Saltgate Canal (`saltgate`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.9; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=saltgate --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/saltgate-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +0.46; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 1.29 a run (75% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w3 ×0.91 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 45%, cold early 23% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.3 s → w10 5.0 s (slope -0.28 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.50 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.85 (20), r2 1.50 (20), r3 1.56 (18); tough (every run): 0.96, 1.46, 2.04 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 3.3 lost 1–10, end 13.1; off-counter 4.3 lost 1–10, end 12.8 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.08 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 23%, middle 45%, late 32%.

## Ships lost per wave

Normal: won 58%, mean end wave 13.0 (14 = won), 3.3 lost in waves 1–10, 0.50 in waves 1–5. Tough: 3.6 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.17 | 0.21 | 0.13 | 0.50 | 0.33 | 0.54 | 0.63 | 1.08 | 0.96 | 1.46 | 2.04 |
| normal, runs that reached it | 0.00 | 0.00 | 0.17 | 0.21 | 0.13 | 0.50 | 0.33 | 0.54 | 0.63 | 0.78 | 0.85 | 1.50 | 1.56 |
| normal, mean over all runs | 0.00 | 0.00 | 0.17 | 0.21 | 0.13 | 0.50 | 0.33 | 0.54 | 0.63 | 0.75 | 0.71 | 1.25 | 1.17 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 20 | 18 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +0.46.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 2.0 | 1.3 | 1.9 | 1.5 | 3.7 | 2.9 | 4.1 | 3.4 | 5.2 | 1.2 | 1.9 | 3.5 |
| runs with ≥ 1 | 4% | 92% | 75% | 63% | 71% | 96% | 96% | 96% | 92% | 100% | 79% | 79% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 14.0 | 15.2 | 21.1 | 23.1 | 25.2 | 26.1 | 31.5 | 34.8 | 40.0 | 41.8 |
| launches (encounters off) | 14.0 | 15.3 | 23.3 | 23.2 | 24.5 | 27.2 | 30.8 | 34.3 | 37.9 | 44.9 |
| **ratio to encounters off** | 1.00 | 0.99 | 0.91 | 1.00 | 1.03 | 0.96 | 1.02 | 1.01 | 1.05 | 0.93 |
| table × scale | 14 | 19 | 25 | 29 | 30 | 33 | 39 | 42 | 48 | 59 |
| ratio to table × scale | 1.00 | 0.80 | 0.84 | 0.80 | 0.84 | 0.79 | 0.81 | 0.83 | 0.83 | 0.71 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 23% / 40% | 45% / 32% | 32% / 28% | 71.2 | middle | early |
| all | 1–9 | 23% / 40% | 45% / 32% | 32% / 28% | 71.2 | middle | early |
| 1 | 1–13 | 29% / 59% | 41% / 22% | 30% / 20% | 128.8 | middle | early |
| all | 1–13 | 29% / 59% | 41% / 22% | 30% / 20% | 128.8 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.3 | 6.0 | 7.5 | 6.6 | 6.5 | 5.4 | 5.9 | 5.7 | 5.3 | 5.0 | 4.9 | 5.0 | 4.8 |
| launches read | 336 | 365 | 507 | 533 | 604 | 598 | 733 | 803 | 947 | 966 | 607 | 786 | 846 |

Slope over waves 1–10: -0.28 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.85 | 1.50 | 1.56 |
| runs that reached it | 20 | 20 | 18 |
| tough, every run | 0.96 | 1.46 | 2.04 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 20 | 18 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.2** | **0.1** | **0.0** | **0.1** | **0.3** | **0.3** | **0.4** | **0.8** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.2 | 0.1 | 0.0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.7 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.11 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.13 | 0.08 | 0.00 | 0.04 | 0.22 | 0.10 | 0.15 | 0.33 |
| runs with no save | 100% | 100% | 100% | 100% | 88% | 88% | 96% | 100% | 92% | 74% | 65% | 75% | 44% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.00 | 0.04 | 0.04 | 0.20 | 0.00 | 0.28 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.20 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.13 | 0.04 | 0.00 | 0.04 | 0.22 | 0.15 | 0.20 | 0.56 |
| tension peak | 0.19 | 0.36 | 0.39 | 0.53 | 0.51 | 0.77 | 0.57 | 0.73 | 0.79 | 0.70 | 1.23 | 1.23 | 1.41 |
| peaks | 0.0 | 0.1 | 0.0 | 0.0 | 0.0 | 0.5 | 0.1 | 0.4 | 0.5 | 0.4 | 1.1 | 1.1 | 1.3 |
| release after a peak (s) | 0.0 | 0.3 | 0.0 | 0.0 | 0.0 | 0.8 | 0.3 | 0.8 | 0.9 | 0.3 | 2.9 | 3.7 | 3.0 |
| hot share | 0% | 0% | 0% | 0% | 0% | 1% | 0% | 1% | 1% | 1% | 9% | 18% | 18% |
| calm share | 97% | 90% | 91% | 88% | 86% | 85% | 85% | 82% | 82% | 80% | 73% | 53% | 45% |
| shape (most runs) | flat 100% | flat 92% | flat 100% | flat 100% | flat 96% | flat 50% | flat 87% | flat 62% | flat 58% | flat 70% | one peak 75% | one peak 75% | one peak 61% |
| taps follow tension (r) | 0.51 | 0.50 | 0.40 | 0.50 | 0.54 | 0.47 | 0.46 | 0.37 | 0.36 | 0.32 | 0.62 | 0.46 | 0.40 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 239 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, gunships, supplyRun | 63% | 13.1 | 3.2 | 3.3 | 0.95 (21) / 1.67 (21) / 1.21 (19) | 0.0 0.0 0.2 0.2 0.1 0.5 0.5 0.6 0.5 0.9 |
| off-counter | seeker, shield, fullSteam | 58% | 12.8 | 3.7 | 4.3 | 1.20 (20) / 1.40 (20) / 1.53 (19) | 0.0 0.0 0.2 0.2 0.2 0.5 0.4 1.1 0.7 1.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
