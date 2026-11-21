# Bot report: Battery Point (`battery`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.8; built 2026-11-21.
- Setup: the map card as it was before the rebuild (log v42): today's convoy controls, no encounters.
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=battery --seeds=24 --armory=plating `. Heat map: `tools/v3/map-report/results/battery-before-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.83; doubles on w9 (0.67→1.50) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 4.79 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 45%, cold early 24% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.7 s → w10 4.4 s (slope -0.50 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.50 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.82 (11), r2 1.91 (11), r3 0.67 (6); tough (every run): 2.04, 4.79, 3.21 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 9 loses 1.50 after 0.67. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.63 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 24%, middle 45%, late 31%.

## Ships lost per wave

Normal: won 25%, mean end wave 11.0 (14 = won), 4.3 lost in waves 1–10, 0.50 in waves 1–5. Tough: 5.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.21 | 0.08 | 0.21 | 0.50 | 0.75 | 0.67 | 1.50 | 1.63 | 2.04 | 4.79 | 3.21 |
| normal, runs that reached it | 0.00 | 0.00 | 0.21 | 0.08 | 0.21 | 0.50 | 0.67 | 0.55 | 1.32 | 1.24 | 0.82 | 1.91 | 0.67 |
| normal, mean over all runs | 0.00 | 0.00 | 0.21 | 0.08 | 0.21 | 0.50 | 0.67 | 0.50 | 1.21 | 0.88 | 0.38 | 0.88 | 0.17 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 22 | 17 | 11 | 11 | 6 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.83.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 3.5 | 4.8 | 7.0 | 6.8 | 9.4 | 8.3 | 10.8 | 11.2 | 14.0 | 0.0 | 0.0 | 0.0 |
| runs with ≥ 1 | 17% | 100% | 96% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0% | 0% | 0% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 29.0 | 36.0 | 44.4 | 50.5 | 51.8 | 58.5 | 55.9 | 61.6 | 67.8 | 75.6 |
| launches (encounters off) | 29.0 | 36.0 | 44.4 | 50.5 | 51.8 | 58.5 | 55.9 | 61.6 | 67.8 | 75.6 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 29 | 38 | 49 | 56 | 58 | 67 | 78 | 85 | 97 | 117 |
| ratio to table × scale | 1.00 | 0.95 | 0.91 | 0.90 | 0.89 | 0.87 | 0.72 | 0.72 | 0.70 | 0.65 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 24% / 6% | 45% / 48% | 31% / 46% | 87.1 | middle | early |
| all | 1–9 | 24% / 6% | 45% / 48% | 31% / 46% | 87.1 | middle | early |
| 1 | 1–13 | 23% / 3% | 49% / 52% | 28% / 45% | 170.0 | middle | early |
| all | 1–13 | 23% / 3% | 49% / 52% | 28% / 45% | 170.0 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.7 | 7.7 | 6.7 | 6.4 | 5.8 | 5.7 | 4.9 | 4.8 | 4.8 | 4.4 | 0.3 | 0.3 | 0.3 |
| launches read | 696 | 862 | 1061 | 1208 | 1242 | 1399 | 1335 | 1475 | 1621 | 1811 | 192 | 192 | 192 |

Slope over waves 1–10: -0.50 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.82 | 1.91 | 0.67 |
| runs that reached it | 11 | 11 | 6 |
| tough, every run | 2.04 | 4.79 | 3.21 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 22 | 17 | 11 | 11 | 6 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.4** | **0.2** | **0.0** | **0.1** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.3 | 0.2 | 0.0 | 0.1 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.12 | 0.00 | 0.09 | 0.00 |
| clutch | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.23 | 0.12 | 0.00 | 0.09 | 0.00 |
| runs with no save | 100% | 96% | 100% | 96% | 96% | 96% | 96% | 91% | 77% | 82% | 100% | 91% | 100% |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.00 | 0.18 | 0.12 | 0.00 | 0.09 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.12 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.05 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.21 | 0.51 | 0.73 | 0.73 | 0.81 | 1.07 | 1.08 | 1.13 | 1.13 | 1.49 | 0.09 | 0.09 | 0.08 |
| peaks | 0.0 | 0.1 | 0.3 | 0.5 | 0.6 | 1.6 | 1.5 | 2.0 | 2.1 | 2.1 | 0.0 | 0.0 | 0.0 |
| release after a peak (s) | 0.0 | 0.3 | 1.0 | 1.0 | 1.6 | 2.0 | 1.8 | 1.9 | 2.2 | 2.6 | 0.0 | 0.0 | 0.0 |
| hot share | 0% | 0% | 2% | 2% | 2% | 6% | 6% | 6% | 8% | 12% | 0% | 0% | 0% |
| calm share | 97% | 84% | 71% | 75% | 70% | 60% | 62% | 58% | 55% | 52% | 100% | 100% | 100% |
| shape (most runs) | flat 100% | flat 87% | flat 67% | flat 54% | flat 46% | sawtooth rising 33% | sawtooth 29% | sawtooth 41% | sawtooth 36% | sawtooth 35% | flat 100% | flat 100% | flat 100% |
| taps follow tension (r) | 0.45 | 0.34 | 0.28 | 0.32 | 0.31 | 0.29 | 0.36 | 0.30 | 0.36 | 0.33 | 0.51 | 0.39 | 0.38 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 454 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
