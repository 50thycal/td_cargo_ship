# Bot report: Tidewater Flats (`tide`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.4; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=tide --seeds=24 --armory=latest --kits=plan`. Heat map: `tools/v3/map-report/results/tide-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w6 +0.96; doubles on w3 (0.04→0.63), w6 (0.13→1.08) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 1.96 a run (92% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w4 ×0.83 of the no-encounter wave; outside on w4 ×0.83 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 40%, cold early 22%; lane 2: hot early 88%, cold late 1% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 10.6 s → w10 7.6 s (slope -0.28 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.08 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.10 (10), r2 2.80 (10), r3 1.86 (7); tough (every run): 0.88, 2.96, 2.67 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 10.0 lost 1–10, end 9.0; counter 10.2 lost 1–10, end 9.7 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 3 loses 0.63 after 0.04; wave 6 loses 1.08 after 0.13. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 4 sends ×0.83 the no-encounter wave. Encounters should replace launches, not add them.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (2.46 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 25%, middle 36%, late 39%.

## Ships lost per wave

Normal: won 13%, mean end wave 10.0 (14 = won), 5.2 lost in waves 1–10, 1.08 in waves 1–5. Tough: 8.8 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.04 | 0.63 | 0.29 | 0.13 | 1.08 | 0.75 | 1.46 | 1.92 | 2.46 | 0.88 | 2.96 | 2.67 |
| normal, runs that reached it | 0.00 | 0.04 | 0.63 | 0.30 | 0.13 | 1.04 | 0.73 | 1.40 | 1.13 | 1.08 | 1.10 | 2.80 | 1.86 |
| normal, mean over all runs | 0.00 | 0.04 | 0.63 | 0.29 | 0.13 | 1.00 | 0.67 | 1.17 | 0.75 | 0.54 | 0.46 | 1.17 | 0.54 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 23 | 23 | 23 | 22 | 20 | 16 | 12 | 10 | 10 | 7 |

Biggest one-wave step up (tough, waves 2–10): wave 6, +0.96.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.5 | 1.4 | 1.9 | 1.4 | 1.6 | 1.6 | 1.8 | 2.2 | 2.1 | 2.0 | 0.5 | 1.4 | 1.3 |
| kills a minute | 43 | 41 | 48 | 45 | 45 | 43 | 48 | 47 | 52 | 55 | 11 | 22 | 20 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.1 | 3.2 | 2.6 | 2.0 | 2.9 | 3.4 | 4.2 | 4.3 | 3.4 | 4.8 | 3.0 | 4.3 | 4.6 |
| runs with ≥ 1 | 79% | 92% | 88% | 92% | 92% | 96% | 96% | 96% | 96% | 100% | 96% | 96% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 23.3 | 23.7 | 32.5 | 32.6 | 35.5 | 38.5 | 45.8 | 48.0 | 53.6 | 59.1 |
| launches (encounters off) | 22.0 | 26.4 | 36.5 | 39.4 | 38.6 | 43.6 | 47.0 | 48.3 | 58.5 | 67.0 |
| **ratio to encounters off** | 1.06 | 0.90 | 0.89 | **0.83** | 0.92 | 0.88 | 0.97 | 0.99 | 0.92 | 0.88 |
| table × scale | 22 | 30 | 38 | 43 | 45 | 52 | 60 | 66 | 76 | 91 |
| ratio to table × scale | 1.06 | 0.79 | 0.85 | 0.76 | 0.79 | 0.74 | 0.76 | 0.73 | 0.71 | 0.65 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 22% / 5% | 37% / 33% | 40% / 62% | 79.3 | late | early |
| 2 | 1–9 | 88% / 100% | 11% / 0% | 1% / 0% | 3.7 | early | late |
| all | 1–9 | 25% / 7% | 36% / 32% | 39% / 61% | 83.0 | late | early |
| 1 | 1–13 | 18% / 6% | 43% / 39% | 39% / 55% | 132.2 | middle | early |
| 2 | 1–13 | 76% / 40% | 23% / 60% | 2% / 0% | 4.8 | early | late |
| all | 1–13 | 20% / 7% | 42% / 39% | 38% / 54% | 137.0 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.6 | 9.9 | 9.3 | 9.2 | 8.4 | 8.6 | 8.6 | 8.0 | 8.2 | 7.6 | 1.9 | 3.6 | 3.5 |
| launches read | 648 | 657 | 808 | 793 | 861 | 945 | 1062 | 1125 | 1252 | 1373 | 168 | 408 | 455 |

Slope over waves 1–10: -0.28 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.10 | 2.80 | 1.86 |
| runs that reached it | 10 | 10 | 7 |
| tough, every run | 0.88 | 2.96 | 2.67 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 23 | 23 | 23 | 22 | 20 | 16 | 12 | 10 | 10 | 7 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.1** | **0.0** | **0.1** | **0.3** | **0.1** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.2 | 0.2 | 0.0 | 0.1 | 0.2 | 0.1 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.09 | 0.15 | 0.06 | 0.00 | 0.00 | 0.20 | 0.00 |
| runs with no save | 100% | 100% | 96% | 96% | 100% | 96% | 91% | 90% | 88% | 100% | 90% | 70% | 86% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.05 | 0.10 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.06 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.05 | 0.05 | 0.06 | 0.00 | 0.10 | 0.30 | 0.14 |
| tension peak | 0.40 | 0.47 | 0.87 | 0.72 | 0.81 | 1.12 | 0.94 | 1.15 | 1.07 | 1.07 | 1.27 | 1.61 | 2.14 |
| peaks | 0.0 | 0.0 | 0.5 | 0.4 | 0.5 | 1.3 | 0.6 | 0.9 | 1.0 | 1.2 | 1.2 | 2.5 | 1.6 |
| release after a peak (s) | 0.0 | 0.0 | 1.2 | 0.7 | 1.0 | 1.7 | 1.7 | 2.1 | 1.2 | 1.5 | 1.6 | 1.9 | 1.4 |
| hot share | 0% | 0% | 3% | 1% | 2% | 5% | 3% | 5% | 4% | 3% | 8% | 24% | 19% |
| calm share | 95% | 82% | 81% | 86% | 82% | 77% | 81% | 76% | 79% | 83% | 76% | 60% | 71% |
| shape (most runs) | flat 96% | flat 96% | flat 50% | flat 70% | flat 52% | one peak 39% | one peak 50% | one peak 70% | one peak 50% | one peak 50% | one peak 60% | sawtooth 80% | one peak 57% |
| taps follow tension (r) | 0.41 | 0.32 | 0.30 | 0.27 | 0.36 | 0.31 | 0.27 | 0.23 | 0.27 | 0.33 | 0.73 | 0.59 | 0.46 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 172 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, aegis, bomberWing | 13% | 9.7 | 5.3 | 10.2 | 1.13 (8) / 2.38 (8) / 1.33 (6) | 0.0 0.0 0.6 0.3 0.3 1.3 0.5 1.5 2.6 3.0 |
| off-counter | tesla, grapnel, fullSteam | 4% | 9.0 | 5.8 | 10.0 | 0.60 (5) / 3.80 (5) / 1.50 (4) | 0.0 0.0 0.3 0.3 0.6 1.7 0.5 1.7 2.4 2.4 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
