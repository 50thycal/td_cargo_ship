# Bot report: Battery Point (`battery`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.8; built 2026-11-21.
- Setup: the map card as it was before the rebuild (log v42): today's convoy controls, no encounters.
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=battery --seeds=24 --armory=latest `. Heat map: `tools/v3/map-report/results/battery-before-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +1.71; doubles on w5 (0.54→1.17) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 5.71 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 48%, cold early 25% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.7 s → w10 4.3 s (slope -0.50 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 2.00 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (2), r2 0.50 (2), r3 0.00 (2); tough (every run): 2.75, 4.42, 5.96 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 5 loses 1.17 after 0.54. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (4.71 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 25%, middle 48%, late 27%.

## Ships lost per wave

Normal: won 8%, mean end wave 7.9 (14 = won), 5.8 lost in waves 1–10, 2.00 in waves 1–5, 0.13 in bonus waves. Tough: 18.7 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.33 | 0.54 | 1.17 | 2.04 | 2.75 | 3.00 | 4.71 | 4.08 | 2.75 | 4.42 | 5.96 |
| normal, runs that reached it | 0.00 | 0.08 | 0.33 | 0.54 | 1.04 | 1.30 | 1.24 | 1.55 | 3.00 | 0.75 | 0.00 | 0.50 | 0.00 |
| normal, mean over all runs | 0.00 | 0.08 | 0.33 | 0.54 | 1.04 | 1.25 | 0.88 | 0.71 | 0.88 | 0.13 | 0.00 | 0.04 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 17 | 11 | 7 | 4 | 2 | 2 | 2 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +1.71.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 3.6 | 5.7 | 6.3 | 7.6 | 9.0 | 8.5 | 11.5 | 11.2 | 14.3 | 0.0 | 0.0 | 0.0 |
| runs with ≥ 1 | 4% | 96% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0% | 0% | 0% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 29.0 | 36.0 | 44.7 | 50.7 | 51.8 | 56.7 | 55.0 | 60.8 | 66.3 | 74.5 |
| launches (encounters off) | 29.0 | 36.0 | 44.7 | 50.7 | 51.8 | 56.7 | 55.0 | 60.8 | 66.3 | 74.5 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 29 | 38 | 49 | 56 | 58 | 67 | 78 | 85 | 97 | 117 |
| ratio to table × scale | 1.00 | 0.95 | 0.91 | 0.90 | 0.89 | 0.85 | 0.71 | 0.72 | 0.68 | 0.64 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 25% / 7% | 48% / 49% | 27% / 44% | 158.2 | middle | early |
| all | 1–9 | 25% / 7% | 48% / 49% | 27% / 44% | 158.2 | middle | early |
| 1 | 1–13 | 24% / 5% | 50% / 54% | 26% / 41% | 259.4 | middle | early |
| all | 1–13 | 24% / 5% | 50% / 54% | 26% / 41% | 259.4 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.7 | 7.6 | 6.7 | 6.3 | 5.8 | 5.5 | 4.9 | 4.8 | 4.9 | 4.3 | 0.3 | 0.4 | 0.5 |
| launches read | 695 | 863 | 1068 | 1210 | 1238 | 1361 | 1312 | 1449 | 1587 | 1782 | 192 | 192 | 192 |

Slope over waves 1–10: -0.50 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 0.50 | 0.00 |
| runs that reached it | 2 | 2 | 2 |
| tough, every run | 2.75 | 4.42 | 5.96 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 23 | 17 | 11 | 7 | 4 | 2 | 2 | 2 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.1** | **0.2** | **0.3** | **0.0** | **0.1** | **0.3** | **0.0** | **0.0** | **0.0** | **0.5** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 | 0.0 | 0.1 | 0.3 | 0.0 | 0.0 | 0.0 | 0.3 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.09 | 0.00 | 0.00 | 0.29 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.04 | 0.08 | 0.13 | 0.26 | 0.00 | 0.09 | 0.29 | 0.00 | 0.00 | 0.00 | 0.50 |
| runs with no save | 100% | 100% | 96% | 92% | 88% | 74% | 100% | 91% | 71% | 100% | 100% | 100% | 50% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.00 | 0.09 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.00 | 0.00 | 0.14 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.04 | 0.00 | 0.00 | 0.14 | 0.00 | 0.00 | 0.00 | 0.50 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.09 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.17 | 0.56 | 0.94 | 0.76 | 1.02 | 1.26 | 1.01 | 1.40 | 1.24 | 1.43 | 0.07 | 0.07 | 0.10 |
| peaks | 0.0 | 0.2 | 0.8 | 0.6 | 1.4 | 1.7 | 1.4 | 1.8 | 2.7 | 2.3 | 0.0 | 0.0 | 0.0 |
| release after a peak (s) | 0.0 | 0.5 | 1.7 | 1.2 | 1.9 | 1.9 | 1.2 | 2.7 | 2.6 | 1.9 | 0.0 | 0.0 | 0.0 |
| hot share | 0% | 1% | 4% | 2% | 6% | 8% | 4% | 12% | 11% | 17% | 0% | 0% | 0% |
| calm share | 98% | 82% | 66% | 73% | 63% | 61% | 62% | 55% | 59% | 51% | 100% | 100% | 100% |
| shape (most runs) | flat 100% | flat 79% | one peak 46% | flat 50% | sawtooth 42% | one peak 39% | one peak 47% | one peak 45% | sawtooth 86% | sawtooth 75% | flat 100% | flat 100% | flat 100% |
| taps follow tension (r) | 0.48 | 0.27 | 0.30 | 0.30 | 0.33 | 0.24 | 0.27 | 0.32 | 0.35 | 0.43 | 0.50 | 0.50 | 0.27 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 237 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
