# Bot report: Lee of Marrow (`marrow`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.95; built 2026-11-18.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=marrow --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/marrow-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.92; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 3.25 a run (92% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w5 ×1.11 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 53%, cold early 22% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.4 s → w10 3.7 s (slope -0.57 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.00 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 2.00 (4), r2 2.50 (4), r3 3.00 (2); tough (every run): 2.00, 2.92, 3.67 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 9.3 lost 1–10, end 9.2; counter 9.6 lost 1–10, end 9.6 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (2.88 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 22%, middle 53%, late 26%.

## Ships lost per wave

Normal: won 0%, mean end wave 9.0 (14 = won), 5.5 lost in waves 1–10, 1.00 in waves 1–5, 0.08 in bonus waves. Tough: 10.1 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 0.38 | 0.63 | 0.92 | 1.25 | 1.54 | 2.46 | 2.88 | 2.00 | 2.92 | 3.67 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 0.38 | 0.58 | 0.87 | 1.14 | 1.44 | 1.56 | 1.38 | 2.00 | 2.50 | 3.00 |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 0.38 | 0.58 | 0.83 | 1.04 | 1.08 | 1.04 | 0.46 | 0.33 | 0.42 | 0.25 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 18 | 16 | 8 | 4 | 4 | 2 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.92.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 1.5 | 3.3 | 5.1 | 4.9 | 6.7 | 7.6 | 9.8 | 8.6 | 10.1 | 2.8 | 3.7 | 2.9 |
| runs with ≥ 1 | 0% | 71% | 92% | 96% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 92% | 92% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 16.4 | 24.3 | 31.0 | 25.8 | 32.0 | 28.9 | 37.5 | 40.5 | 47.4 |
| launches (encounters off) | 15.0 | 16.4 | 23.5 | 29.8 | 23.3 | 29.8 | 30.8 | 35.8 | 40.9 | 45.7 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.03 | 1.04 | 1.11 | 1.07 | 0.94 | 1.05 | 0.99 | 1.04 |
| table × scale | 15 | 20 | 26 | 30 | 31 | 36 | 41 | 45 | 52 | 62 |
| ratio to table × scale | 1.00 | 0.82 | 0.93 | 1.03 | 0.83 | 0.89 | 0.71 | 0.83 | 0.78 | 0.76 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 22% / 8% | 53% / 63% | 26% / 29% | 54.1 | middle | early |
| all | 1–9 | 22% / 8% | 53% / 63% | 26% / 29% | 54.1 | middle | early |
| 1 | 1–13 | 24% / 8% | 52% / 65% | 24% / 27% | 110.6 | middle | early |
| all | 1–13 | 24% / 8% | 52% / 65% | 24% / 27% | 110.6 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.4 | 8.4 | 6.1 | 5.4 | 4.4 | 4.4 | 2.8 | 3.5 | 3.8 | 3.7 | 7.2 | 6.6 | 6.1 |
| launches read | 360 | 390 | 581 | 736 | 614 | 756 | 694 | 901 | 966 | 1132 | 168 | 288 | 312 |

Slope over waves 1–10: -0.57 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 2.00 | 2.50 | 3.00 |
| runs that reached it | 4 | 4 | 2 |
| tough, every run | 2.00 | 2.92 | 3.67 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 18 | 16 | 8 | 4 | 4 | 2 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.2** | **0.0** | **0.7** | **0.1** | **0.3** | **0.3** | **0.5** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 | 0.0 | 0.5 | 0.1 | 0.2 | 0.3 | 0.3 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.00 | 0.06 | 0.13 | 0.00 | 0.25 | 0.50 |
| clutch | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.09 | 0.18 | 0.00 | 0.63 | 0.13 | 0.25 | 0.00 | 0.00 |
| runs with no save | 100% | 100% | 100% | 96% | 92% | 87% | 82% | 100% | 63% | 88% | 75% | 75% | 50% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.13 | 0.25 | 0.00 | 0.50 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.25 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.09 | 0.00 | 0.00 | 0.13 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.14 | 0.00 | 0.19 | 0.00 | 0.00 | 0.25 | 0.00 |
| tension peak | 0.06 | 0.31 | 0.60 | 0.79 | 0.81 | 0.96 | 1.26 | 1.32 | 1.29 | 1.32 | 1.44 | 2.04 | 2.08 |
| peaks | 0.0 | 0.0 | 0.2 | 0.4 | 0.6 | 1.0 | 1.1 | 2.4 | 1.7 | 2.3 | 2.0 | 1.8 | 1.5 |
| release after a peak (s) | 0.0 | 0.0 | 0.3 | 1.2 | 0.9 | 2.4 | 2.1 | 2.1 | 2.6 | 2.3 | 2.9 | 3.8 | 3.0 |
| hot share | 0% | 0% | 1% | 3% | 3% | 5% | 7% | 9% | 8% | 7% | 28% | 24% | 41% |
| calm share | 100% | 95% | 86% | 79% | 78% | 74% | 70% | 65% | 64% | 63% | 37% | 25% | 24% |
| shape (most runs) | flat 100% | flat 100% | flat 83% | flat 62% | flat 54% | one peak 61% | one peak 50% | sawtooth 61% | one peak 44% | sawtooth rising 50% | pinned 50% | sawtooth 50% | pinned 100% |
| taps follow tension (r) | 0.62 | 0.30 | 0.36 | 0.43 | 0.43 | 0.42 | 0.38 | 0.41 | 0.43 | 0.40 | 0.42 | 0.31 | 0.34 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w10. 24 runs, 92 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, seeker, droneScreen | 0% | 9.6 | 5.3 | 9.6 | 1.40 (5) / 2.00 (5) / 2.60 (5) | 0.0 0.0 0.0 0.3 0.5 0.8 1.3 1.1 2.4 3.3 |
| off-counter | scatter, railgun, overdrive | 4% | 9.2 | 5.5 | 9.3 | 0.33 (3) / 1.33 (3) / 3.00 (3) | 0.0 0.0 0.0 0.1 0.6 1.1 1.5 1.5 1.9 2.5 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
