# Bot report: The Needle of Bosk (`needle`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.95; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=needle --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/needle-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.58; doubles on w9 (0.29→0.88) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w8 1.38 a run (75% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.59 of the no-encounter wave; outside on w5 ×0.83, w6 ×0.69, w7 ×0.59, w8 ×0.66, w9 ×0.65, w10 ×0.68 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 50%, cold early 10% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.6 s → w10 5.8 s (slope -0.25 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.58 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.50 (20), r2 1.15 (20), r3 1.84 (19); tough (every run): 0.54, 1.13, 2.58 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 4.0 lost 1–10, end 12.8; off-counter 4.0 lost 1–10, end 12.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 9 loses 0.88 after 0.29. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 5 sends ×0.83 the no-encounter wave; wave 6 sends ×0.69 the no-encounter wave; wave 7 sends ×0.59 the no-encounter wave; wave 8 sends ×0.66 the no-encounter wave; wave 9 sends ×0.65 the no-encounter wave; wave 10 sends ×0.68 the no-encounter wave. Encounters should replace launches, not add them.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.04 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 10%, middle 41%, late 50%.

## Ships lost per wave

Normal: won 54%, mean end wave 12.9 (14 = won), 3.4 lost in waves 1–10, 0.58 in waves 1–5. Tough: 3.8 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.08 | 0.08 | 0.33 | 0.50 | 0.46 | 0.29 | 0.88 | 1.04 | 0.54 | 1.13 | 2.58 |
| normal, runs that reached it | 0.00 | 0.08 | 0.08 | 0.08 | 0.33 | 0.50 | 0.46 | 0.29 | 0.67 | 1.00 | 0.50 | 1.15 | 1.84 |
| normal, mean over all runs | 0.00 | 0.08 | 0.08 | 0.08 | 0.33 | 0.50 | 0.46 | 0.29 | 0.67 | 0.92 | 0.42 | 0.96 | 1.46 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 20 | 20 | 19 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.58.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 0.9 | 4.4 | 2.9 | 4.0 | 2.6 | 2.9 | 1.4 | 3.7 | 2.6 | 1.3 | 2.0 | 2.5 |
| runs with ≥ 1 | 0% | 58% | 100% | 88% | 100% | 92% | 100% | 75% | 92% | 88% | 71% | 88% | 88% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 16.6 | 24.2 | 20.6 | 21.0 | 20.0 | 20.1 | 24.2 | 28.0 | 32.0 |
| launches (encounters off) | 15.0 | 16.6 | 25.5 | 23.3 | 25.2 | 29.3 | 33.8 | 36.9 | 43.0 | 47.3 |
| **ratio to encounters off** | 1.00 | 1.00 | 0.95 | 0.89 | **0.83** | **0.69** | **0.59** | **0.66** | **0.65** | **0.68** |
| table × scale | 15 | 20 | 26 | 30 | 31 | 36 | 41 | 45 | 52 | 62 |
| ratio to table × scale | 1.00 | 0.83 | 0.93 | 0.69 | 0.68 | 0.56 | 0.49 | 0.54 | 0.54 | 0.52 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 10% / 5% | 41% / 31% | 50% / 65% | 41.9 | late | early |
| all | 1–9 | 10% / 5% | 41% / 31% | 50% / 65% | 41.9 | late | early |
| 1 | 1–13 | 7% / 7% | 43% / 41% | 50% / 53% | 84.2 | late | early |
| all | 1–13 | 7% / 7% | 43% / 41% | 50% / 53% | 84.2 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.6 | 6.8 | 5.7 | 5.9 | 4.5 | 5.6 | 4.7 | 5.5 | 5.1 | 5.8 | 5.9 | 5.3 | 5.1 |
| launches read | 360 | 397 | 555 | 494 | 503 | 478 | 478 | 579 | 673 | 745 | 216 | 240 | 268 |

Slope over waves 1–10: -0.25 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.50 | 1.15 | 1.84 |
| runs that reached it | 20 | 20 | 19 |
| tough, every run | 0.54 | 1.13 | 2.58 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 20 | 20 | 19 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.0** | **0.3** | **0.2** | **0.1** | **0.2** | **0.1** | **0.0** | **0.4** | **0.9** | **1.0** |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.0 | 0.2 | 0.2 | 0.1 | 0.1 | 0.1 | 0.0 | 0.3 | 0.7 | 0.8 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.08 | 0.00 | 0.08 | 0.21 | 0.08 | 0.13 | 0.00 | 0.00 | 0.20 | 0.50 | 0.68 |
| runs with no save | 100% | 100% | 92% | 100% | 92% | 83% | 88% | 88% | 92% | 100% | 70% | 45% | 37% |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.13 | 0.00 | 0.04 | 0.04 | 0.00 | 0.30 | 0.40 | 0.21 |
|   cover choice | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.04 | 0.08 | 0.00 | 0.00 | 0.00 | 0.05 | 0.21 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.10 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.17 | 0.04 | 0.08 | 0.00 | 0.04 | 0.00 | 0.10 | 0.40 | 0.58 |
| tension peak | 0.13 | 0.36 | 0.82 | 0.60 | 0.79 | 0.85 | 0.61 | 0.67 | 0.93 | 0.82 | 1.57 | 2.09 | 2.63 |
| peaks | 0.0 | 0.1 | 0.5 | 0.2 | 0.5 | 0.6 | 0.2 | 0.3 | 0.6 | 0.6 | 0.8 | 1.0 | 1.1 |
| release after a peak (s) | 0.0 | 0.2 | 0.8 | 0.3 | 0.9 | 1.5 | 0.2 | 0.8 | 0.9 | 1.2 | 4.6 | 5.0 | 3.8 |
| hot share | 0% | 0% | 2% | 1% | 2% | 2% | 0% | 1% | 3% | 1% | 25% | 50% | 57% |
| calm share | 99% | 90% | 79% | 84% | 79% | 82% | 86% | 84% | 80% | 82% | 47% | 23% | 22% |
| shape (most runs) | flat 100% | flat 92% | flat 50% | flat 83% | one peak 50% | one peak 62% | flat 83% | flat 67% | flat 50% | one peak 50% | pinned 55% | pinned 90% | pinned 100% |
| taps follow tension (r) | 0.45 | 0.45 | 0.39 | 0.40 | 0.51 | 0.45 | 0.43 | 0.49 | 0.34 | 0.36 | 0.53 | 0.43 | 0.34 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 190 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, thermo, gunships | 38% | 12.8 | 3.8 | 4.0 | 0.70 (20) / 1.60 (20) / 2.45 (20) | 0.0 0.0 0.2 0.0 0.3 0.5 0.6 0.4 1.0 1.0 |
| off-counter | seeker, frigate, droneScreen | 38% | 12.5 | 3.5 | 4.0 | 0.58 (19) / 1.63 (19) / 2.61 (18) | 0.0 0.0 0.1 0.1 0.3 0.5 0.3 0.5 1.1 1.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
