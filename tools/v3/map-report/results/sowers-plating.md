# Bot report: Sowers' Reach (`sowers`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.45; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=sowers --seeds=24 --armory=plating --kits=plan`. Heat map: `tools/v3/map-report/results/sowers-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.29; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w4 1.33 a run (83% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w9 ×0.90 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 44%, cold early 20% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.8 s → w10 5.3 s (slope -0.38 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.50 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.71 (21), r2 0.81 (21), r3 1.15 (20); tough (every run): 0.71, 0.71, 1.25 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 2.5 lost 1–10, end 13.5; off-counter 4.0 lost 1–10, end 13.1 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (0.75 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 20%, middle 44%, late 36%.

## Ships lost per wave

Normal: won 83%, mean end wave 13.2 (14 = won), 2.7 lost in waves 1–10, 0.50 in waves 1–5. Tough: 3.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.13 | 0.13 | 0.00 | 0.25 | 0.50 | 0.67 | 0.46 | 0.75 | 0.58 | 0.71 | 0.71 | 1.25 |
| normal, runs that reached it | 0.00 | 0.13 | 0.13 | 0.00 | 0.25 | 0.17 | 0.52 | 0.39 | 0.78 | 0.43 | 0.71 | 0.81 | 1.15 |
| normal, mean over all runs | 0.00 | 0.13 | 0.13 | 0.00 | 0.25 | 0.17 | 0.50 | 0.38 | 0.75 | 0.38 | 0.63 | 0.71 | 0.96 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 21 | 21 | 21 | 20 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.29.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.2 | 2.1 | 2.0 | 2.0 | 1.9 | 1.9 | 2.3 | 2.1 | 2.5 | 2.0 | 3.0 | 4.2 | 5.6 |
| kills a minute | 54 | 54 | 51 | 51 | 49 | 51 | 46 | 49 | 50 | 47 | 44 | 55 | 68 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 0.3 | 1.6 | 1.3 | 1.8 | 1.3 | 2.9 | 2.1 | 2.8 | 4.6 | 1.7 | 1.5 | 1.1 |
| runs with ≥ 1 | 13% | 33% | 79% | 83% | 92% | 67% | 92% | 71% | 92% | 100% | 83% | 83% | 79% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.3 | 30.9 | 35.2 | 39.2 | 37.8 | 41.9 | 44.8 | 47.8 | 52.5 | 61.7 |
| launches (encounters off) | 25.0 | 30.0 | 38.3 | 39.2 | 41.0 | 44.3 | 48.6 | 53.1 | 58.4 | 68.0 |
| **ratio to encounters off** | 0.97 | 1.03 | 0.92 | 1.00 | 0.92 | 0.95 | 0.92 | 0.90 | 0.90 | 0.91 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.05 | 1.00 | 0.90 | 0.89 | 0.82 | 0.79 | 0.72 | 0.70 | 0.67 | 0.66 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 20% / 9% | 44% / 54% | 36% / 38% | 25.4 | middle | early |
| all | 1–9 | 20% / 9% | 44% / 54% | 36% / 38% | 25.4 | middle | early |
| 1 | 1–13 | 17% / 12% | 39% / 41% | 44% / 47% | 45.5 | late | early |
| all | 1–13 | 17% / 12% | 39% / 41% | 44% / 47% | 45.5 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.8 | 8.4 | 7.6 | 7.2 | 7.2 | 5.5 | 6.2 | 5.9 | 5.9 | 5.3 | 1.7 | 1.6 | 1.6 |
| launches read | 600 | 734 | 824 | 836 | 818 | 846 | 893 | 1009 | 1057 | 1256 | 240 | 311 | 336 |

Slope over waves 1–10: -0.38 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.71 | 0.81 | 1.15 |
| runs that reached it | 21 | 21 | 20 |
| tough, every run | 0.71 | 0.71 | 1.25 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 21 | 21 | 21 | 20 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.1** | **0.1** | **0.2** | **0.1** | **0.1** | **0.3** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.2 | 0.1 | 0.1 | 0.2 | 0.1 | 0.1 | 0.2 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.13 | 0.04 | 0.09 | 0.05 | 0.10 | 0.00 | 0.25 |
| runs with no save | 100% | 100% | 100% | 96% | 100% | 100% | 87% | 91% | 87% | 76% | 90% | 90% | 80% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.00 | 0.00 | 0.10 | 0.05 | 0.05 | 0.15 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.00 | 0.09 | 0.10 | 0.00 | 0.00 | 0.15 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.05 | 0.05 | 0.00 | 0.00 |
| tension peak | 0.17 | 0.37 | 0.50 | 0.36 | 0.49 | 0.52 | 0.76 | 0.64 | 0.83 | 0.85 | 0.77 | 0.80 | 0.88 |
| peaks | 0.0 | 0.0 | 0.1 | 0.0 | 0.0 | 0.0 | 0.7 | 0.3 | 0.7 | 0.7 | 0.5 | 0.6 | 0.8 |
| release after a peak (s) | 0.0 | 0.1 | 0.2 | 0.0 | 0.2 | 0.1 | 1.0 | 0.7 | 1.2 | 2.2 | 1.1 | 1.3 | 2.9 |
| hot share | 0% | 0% | 1% | 0% | 1% | 1% | 3% | 2% | 3% | 3% | 3% | 4% | 5% |
| calm share | 99% | 92% | 89% | 91% | 90% | 87% | 77% | 82% | 77% | 80% | 65% | 56% | 47% |
| shape (most runs) | flat 100% | flat 96% | flat 92% | flat 100% | flat 96% | flat 96% | flat 61% | flat 74% | flat 52% | flat 43% | flat 52% | one peak 52% | one peak 55% |
| taps follow tension (r) | 0.45 | 0.46 | 0.29 | 0.44 | 0.32 | 0.42 | 0.40 | 0.38 | 0.37 | 0.35 | 0.42 | 0.28 | 0.33 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 154 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | tesla, flak, shield | 83% | 13.5 | 2.5 | 2.5 | 0.68 (22) / 0.73 (22) / 1.24 (21) | 0.0 0.0 0.0 0.0 0.0 0.2 0.4 0.6 0.6 0.6 |
| off-counter | seeker, shrapnel, fullSteam | 83% | 13.1 | 3.0 | 4.0 | 0.60 (20) / 0.55 (20) / 1.05 (20) | 0.0 0.0 0.1 0.0 0.2 0.5 0.5 0.9 0.5 1.2 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
