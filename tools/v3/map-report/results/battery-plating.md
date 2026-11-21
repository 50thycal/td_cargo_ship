# Bot report: Battery Point (`battery`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.8; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=battery --seeds=24 --armory=plating --kits=plan`. Heat map: `tools/v3/map-report/results/battery-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w5 +0.42; doubles on w5 (0.13→0.54) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w5 3.13 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.88 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 47%, cold early 22% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.9 s → w10 5.9 s (slope -0.35 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.71 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.21 (14), r2 1.00 (14), r3 1.00 (14); tough (every run): 0.33, 0.96, 1.08 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 4.4 lost 1–10, end 12.1; off-counter 4.7 lost 1–10, end 11.9 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 5 loses 0.54 after 0.13. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.38 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 22%, middle 47%, late 30%.

## Ships lost per wave

Normal: won 58%, mean end wave 11.8 (14 = won), 3.9 lost in waves 1–10, 0.71 in waves 1–5. Tough: 5.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 0.13 | 0.54 | 0.38 | 0.50 | 0.88 | 1.21 | 1.38 | 0.33 | 0.96 | 1.08 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 0.13 | 0.54 | 0.39 | 0.52 | 0.83 | 1.00 | 0.88 | 0.21 | 1.00 | 1.00 |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 0.13 | 0.54 | 0.38 | 0.50 | 0.79 | 0.88 | 0.63 | 0.13 | 0.58 | 0.58 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 21 | 17 | 14 | 14 | 14 |

Biggest one-wave step up (tough, waves 2–10): wave 5, +0.42.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.2 | 1.8 | 3.5 | 4.1 | 3.1 | 6.1 | 6.4 | 6.6 | 7.0 | 8.7 | 1.5 | 1.1 | 2.0 |
| runs with ≥ 1 | 17% | 79% | 100% | 96% | 96% | 100% | 100% | 96% | 100% | 100% | 92% | 83% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 30.0 | 36.5 | 43.9 | 48.5 | 46.5 | 53.2 | 53.0 | 55.8 | 63.8 | 66.1 |
| launches (encounters off) | 29.0 | 36.0 | 45.3 | 50.2 | 50.6 | 57.7 | 56.7 | 61.4 | 67.0 | 75.1 |
| **ratio to encounters off** | 1.03 | 1.01 | 0.97 | 0.97 | 0.92 | 0.92 | 0.93 | 0.91 | 0.95 | 0.88 |
| table × scale | 29 | 38 | 49 | 56 | 58 | 67 | 78 | 85 | 97 | 117 |
| ratio to table × scale | 1.03 | 0.96 | 0.90 | 0.87 | 0.80 | 0.79 | 0.68 | 0.66 | 0.66 | 0.56 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 22% / 11% | 47% / 52% | 30% / 36% | 37.3 | middle | early |
| all | 1–9 | 22% / 11% | 47% / 52% | 30% / 36% | 37.3 | middle | early |
| 1 | 1–13 | 22% / 7% | 49% / 52% | 29% / 42% | 67.4 | middle | early |
| all | 1–13 | 22% / 7% | 49% / 52% | 29% / 42% | 67.4 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.9 | 7.8 | 6.9 | 6.7 | 6.1 | 6.5 | 5.4 | 6.2 | 5.9 | 5.9 | 1.7 | 1.6 | 2.0 |
| launches read | 720 | 872 | 1048 | 1156 | 1112 | 1272 | 1267 | 1336 | 1527 | 1577 | 240 | 264 | 336 |

Slope over waves 1–10: -0.35 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.21 | 1.00 | 1.00 |
| runs that reached it | 14 | 14 | 14 |
| tough, every run | 0.33 | 0.96 | 1.08 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 21 | 17 | 14 | 14 | 14 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.3** | **0.1** | **0.2** | **0.1** | **0.1** | **0.1** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.2 | 0.1 | 0.2 | 0.0 | 0.0 | 0.1 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.10 | 0.06 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.17 | 0.14 | 0.18 | 0.07 | 0.07 | 0.14 |
| runs with no save | 100% | 100% | 100% | 100% | 100% | 96% | 96% | 74% | 86% | 82% | 93% | 93% | 86% |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.10 | 0.00 | 0.00 | 0.07 | 0.07 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.12 | 0.07 | 0.00 | 0.07 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.13 | 0.05 | 0.12 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.19 | 0.22 | 0.63 | 0.63 | 0.49 | 0.81 | 0.94 | 0.86 | 1.17 | 1.02 | 0.08 | 0.10 | 0.11 |
| peaks | 0.0 | 0.0 | 0.3 | 0.3 | 0.2 | 0.6 | 0.9 | 0.7 | 1.0 | 1.1 | 0.0 | 0.0 | 0.0 |
| release after a peak (s) | 0.0 | 0.0 | 0.6 | 0.8 | 0.3 | 1.4 | 1.7 | 1.0 | 1.6 | 1.6 | 0.0 | 0.0 | 0.0 |
| hot share | 0% | 0% | 1% | 1% | 1% | 2% | 3% | 2% | 5% | 5% | 0% | 0% | 0% |
| calm share | 98% | 96% | 88% | 85% | 86% | 78% | 79% | 77% | 68% | 75% | 100% | 100% | 100% |
| shape (most runs) | flat 100% | flat 100% | flat 71% | flat 71% | flat 87% | flat 52% | one peak 43% | flat 57% | one peak 38% | one peak 41% | flat 100% | flat 100% | flat 100% |
| taps follow tension (r) | 0.41 | 0.42 | 0.33 | 0.35 | 0.44 | 0.25 | 0.33 | 0.25 | 0.28 | 0.34 | 0.66 | 0.48 | 0.44 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 227 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | frigate, railgun, well | 63% | 12.1 | 3.4 | 4.4 | 0.40 (15) / 0.87 (15) / 1.20 (15) | 0.0 0.0 0.1 0.1 0.5 0.3 0.4 0.7 1.2 1.1 |
| off-counter | seeker, scatter, tesla | 58% | 11.9 | 4.0 | 4.7 | 0.29 (14) / 1.14 (14) / 1.14 (14) | 0.0 0.0 0.1 0.1 0.5 0.3 0.6 0.7 1.1 1.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
