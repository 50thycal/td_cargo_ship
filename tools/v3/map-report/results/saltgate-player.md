# Bot report: Saltgate Canal (`saltgate`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.9; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=saltgate --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/saltgate-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +0.25; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 1.29 a run (88% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.85 of the no-encounter wave; outside on w10 ×0.85 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 43%, cold early 22% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.1 s → w10 5.2 s (slope -0.25 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.29 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.50 (22), r2 1.91 (22), r3 1.95 (20); tough (every run): 0.58, 1.83, 2.04 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.5; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 1.9 lost 1–10, end 13.5; off-counter 2.5 lost 1–10, end 13.3 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Budget: wave 10 sends ×0.85 the no-encounter wave. Encounters should replace launches, not add them.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 8 (0.42 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 22%, middle 43%, late 35%.

## Ships lost per wave

Normal: won 46%, mean end wave 13.0 (14 = won), 1.6 lost in waves 1–10, 0.29 in waves 1–5. Tough: 1.7 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.04 | 0.04 | 0.08 | 0.13 | 0.25 | 0.17 | 0.42 | 0.38 | 0.21 | 0.58 | 1.83 | 2.04 |
| normal, runs that reached it | 0.00 | 0.04 | 0.04 | 0.08 | 0.13 | 0.25 | 0.17 | 0.42 | 0.35 | 0.14 | 0.50 | 1.91 | 1.95 |
| normal, mean over all runs | 0.00 | 0.04 | 0.04 | 0.08 | 0.13 | 0.25 | 0.17 | 0.42 | 0.33 | 0.13 | 0.46 | 1.75 | 1.63 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 22 | 22 | 20 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +0.25.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 1.6 | 1.3 | 2.2 | 1.5 | 5.5 | 3.9 | 3.0 | 5.5 | 5.3 | 1.9 | 2.0 | 2.9 |
| runs with ≥ 1 | 4% | 88% | 88% | 92% | 79% | 100% | 100% | 96% | 100% | 100% | 75% | 75% | 88% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 15.5 | 23.4 | 22.5 | 24.1 | 23.4 | 29.9 | 31.9 | 37.6 | 39.0 |
| launches (encounters off) | 14.0 | 15.3 | 23.2 | 23.2 | 24.4 | 26.8 | 30.1 | 34.8 | 37.4 | 45.9 |
| **ratio to encounters off** | 1.07 | 1.01 | 1.01 | 0.97 | 0.99 | 0.87 | 0.99 | 0.92 | 1.01 | **0.85** |
| table × scale | 14 | 19 | 25 | 29 | 30 | 33 | 39 | 42 | 48 | 59 |
| ratio to table × scale | 1.07 | 0.81 | 0.94 | 0.78 | 0.80 | 0.71 | 0.77 | 0.76 | 0.78 | 0.66 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 22% / 8% | 43% / 53% | 35% / 39% | 51.6 | middle | early |
| all | 1–9 | 22% / 8% | 43% / 53% | 35% / 39% | 51.6 | middle | early |
| 1 | 1–13 | 20% / 6% | 48% / 74% | 32% / 20% | 85.6 | middle | early |
| all | 1–13 | 20% / 6% | 48% / 74% | 32% / 20% | 85.6 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.1 | 5.9 | 7.3 | 6.5 | 6.7 | 5.4 | 5.7 | 5.7 | 5.4 | 5.2 | 4.6 | 5.0 | 5.1 |
| launches read | 360 | 371 | 562 | 539 | 575 | 558 | 718 | 764 | 899 | 931 | 427 | 495 | 535 |

Slope over waves 1–10: -0.25 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.50 | 1.91 | 1.95 |
| runs that reached it | 22 | 22 | 20 |
| tough, every run | 0.58 | 1.83 | 2.04 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 22 | 22 | 20 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.1** | **0.0** | **0.0** | **0.5** | **1.0** | **1.1** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.2 | 0.1 | 0.1 | 0.0 | 0.0 | 0.7 | 1.4 | 1.5 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.23 | 0.15 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.08 | 0.08 | 0.00 | 0.00 | 0.41 | 0.59 | 0.90 |
| runs with no save | 100% | 96% | 100% | 100% | 100% | 88% | 92% | 88% | 100% | 100% | 50% | 36% | 30% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.04 | 0.08 | 0.00 | 0.00 | 0.18 | 0.23 | 0.45 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.00 | 0.18 | 0.05 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.14 | 0.05 | 0.30 |
|   kill save | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.00 | 0.23 | 0.59 | 0.35 |
| tension peak | 0.13 | 0.32 | 0.34 | 0.44 | 0.45 | 0.75 | 0.57 | 0.57 | 0.72 | 0.55 | 1.16 | 1.76 | 2.07 |
| peaks | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.5 | 0.1 | 0.3 | 0.4 | 0.1 | 0.7 | 1.0 | 1.0 |
| release after a peak (s) | 0.0 | 0.2 | 0.0 | 0.0 | 0.1 | 0.8 | 0.2 | 0.4 | 0.7 | 0.2 | 1.3 | 2.9 | 2.8 |
| hot share | 0% | 0% | 0% | 0% | 0% | 2% | 0% | 1% | 1% | 0% | 8% | 18% | 25% |
| calm share | 100% | 91% | 92% | 88% | 90% | 86% | 84% | 85% | 84% | 87% | 72% | 55% | 55% |
| shape (most runs) | flat 100% | flat 96% | flat 100% | flat 96% | flat 96% | flat 62% | flat 87% | flat 79% | flat 61% | flat 86% | one peak 68% | one peak 86% | one peak 80% |
| taps follow tension (r) | 0.44 | 0.36 | 0.26 | 0.50 | 0.50 | 0.42 | 0.40 | 0.33 | 0.33 | 0.22 | 0.47 | 0.35 | 0.33 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.5; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 252 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, gunships, supplyRun | 54% | 13.5 | 1.9 | 1.9 | 0.92 (24) / 1.67 (24) / 1.88 (24) | 0.0 0.1 0.0 0.0 0.0 0.3 0.2 0.3 0.5 0.5 |
| off-counter | seeker, shield, fullSteam | 58% | 13.3 | 2.4 | 2.5 | 0.70 (23) / 1.78 (23) / 1.68 (22) | 0.0 0.1 0.0 0.1 0.1 0.3 0.1 0.5 1.0 0.4 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
