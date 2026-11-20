# Bot report: Saltgate Canal (`saltgate`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.9; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=saltgate --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/saltgate-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w6 +0.50; doubles on w6 (0.13→0.63) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.54 a run (83% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.83 of the no-encounter wave; outside on w4 ×1.16, w10 ×0.83 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 46%, cold early 21% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.1 s → w10 5.5 s (slope -0.24 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.46 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.73 (22), r2 1.45 (22), r3 1.91 (22); tough (every run): 0.71, 1.50, 2.29 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 2.3 lost 1–10, end 13.4; off-counter 2.4 lost 1–10, end 13.1 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 6 loses 0.63 after 0.13. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 4 sends ×1.16 the no-encounter wave; wave 10 sends ×0.83 the no-encounter wave. Encounters should replace launches, not add them.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (0.67 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 21%, middle 46%, late 33%.

## Ships lost per wave

Normal: won 67%, mean end wave 13.2 (14 = won), 2.6 lost in waves 1–10, 0.46 in waves 1–5. Tough: 3.1 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.00 | 0.25 | 0.13 | 0.63 | 0.42 | 0.63 | 0.67 | 0.33 | 0.71 | 1.50 | 2.29 |
| normal, runs that reached it | 0.00 | 0.08 | 0.00 | 0.25 | 0.13 | 0.38 | 0.43 | 0.52 | 0.65 | 0.23 | 0.73 | 1.45 | 1.91 |
| normal, mean over all runs | 0.00 | 0.08 | 0.00 | 0.25 | 0.13 | 0.38 | 0.42 | 0.50 | 0.63 | 0.21 | 0.67 | 1.33 | 1.75 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 22 | 22 | 22 | 22 |

Biggest one-wave step up (tough, waves 2–10): wave 6, +0.50.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 1.4 | 1.5 | 2.8 | 2.5 | 3.9 | 2.7 | 2.8 | 4.0 | 4.7 | 0.5 | 0.8 | 1.2 |
| runs with ≥ 1 | 4% | 83% | 83% | 92% | 92% | 96% | 88% | 83% | 100% | 96% | 42% | 50% | 46% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 13.2 | 22.5 | 27.0 | 23.6 | 24.4 | 29.7 | 31.3 | 37.5 | 37.1 |
| launches (encounters off) | 14.0 | 15.3 | 23.3 | 23.2 | 24.5 | 27.2 | 30.8 | 34.3 | 37.9 | 44.9 |
| **ratio to encounters off** | 1.07 | 0.86 | 0.96 | **1.16** | 0.96 | 0.90 | 0.97 | 0.91 | 0.99 | **0.83** |
| table × scale | 14 | 19 | 25 | 29 | 30 | 33 | 39 | 42 | 48 | 59 |
| ratio to table × scale | 1.07 | 0.70 | 0.90 | 0.93 | 0.79 | 0.74 | 0.76 | 0.74 | 0.78 | 0.63 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 21% / 19% | 46% / 48% | 33% / 33% | 74.5 | middle | early |
| all | 1–9 | 21% / 19% | 46% / 48% | 33% / 33% | 74.5 | middle | early |
| 1 | 1–13 | 19% / 14% | 49% / 62% | 32% / 25% | 118.5 | middle | early |
| all | 1–13 | 19% / 14% | 49% / 62% | 32% / 25% | 118.5 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.1 | 6.4 | 7.4 | 6.5 | 5.9 | 5.6 | 5.9 | 6.1 | 5.3 | 5.5 | 5.4 | 5.5 | 5.3 |
| launches read | 360 | 316 | 538 | 629 | 565 | 565 | 692 | 711 | 886 | 844 | 288 | 312 | 469 |

Slope over waves 1–10: -0.24 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.73 | 1.45 | 1.91 |
| runs that reached it | 22 | 22 | 22 |
| tough, every run | 0.71 | 1.50 | 2.29 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 22 | 22 | 22 | 22 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.3** | **0.6** | **1.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.3 | 0.6 | 0.9 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.14 | 0.36 | 0.59 |
| runs with no save | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 96% | 96% | 95% | 73% | 59% | 45% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.18 | 0.27 | 0.55 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.23 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.14 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.05 | 0.09 | 0.14 | 0.23 |
| tension peak | 0.13 | 0.31 | 0.36 | 0.60 | 0.60 | 0.81 | 0.60 | 0.69 | 0.78 | 0.56 | 0.60 | 0.60 | 1.21 |
| peaks | 0.0 | 0.1 | 0.0 | 0.3 | 0.2 | 0.4 | 0.2 | 0.4 | 0.5 | 0.1 | 0.2 | 0.2 | 1.0 |
| release after a peak (s) | 0.0 | 0.0 | 0.0 | 0.4 | 0.3 | 0.7 | 0.3 | 0.5 | 0.8 | 0.1 | 0.8 | 1.0 | 2.8 |
| hot share | 0% | 0% | 0% | 1% | 0% | 2% | 0% | 1% | 1% | 0% | 2% | 3% | 18% |
| calm share | 100% | 89% | 91% | 87% | 85% | 86% | 85% | 85% | 84% | 88% | 76% | 60% | 53% |
| shape (most runs) | flat 100% | flat 96% | flat 100% | flat 75% | flat 83% | flat 67% | flat 83% | flat 65% | flat 52% | flat 91% | flat 82% | flat 82% | one peak 77% |
| taps follow tension (r) | 0.44 | 0.32 | 0.41 | 0.47 | 0.49 | 0.40 | 0.41 | 0.37 | 0.30 | 0.23 | 0.57 | 0.33 | 0.29 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 220 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, gunships, supplyRun | 54% | 13.4 | 2.3 | 2.3 | 0.57 (23) / 1.39 (23) / 2.61 (23) | 0.0 0.0 0.0 0.2 0.2 0.3 0.3 0.4 0.4 0.5 |
| off-counter | seeker, shield, fullSteam | 54% | 13.1 | 2.3 | 2.4 | 0.73 (22) / 1.91 (22) / 1.85 (20) | 0.0 0.1 0.0 0.1 0.3 0.3 0.3 0.3 0.7 0.4 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
