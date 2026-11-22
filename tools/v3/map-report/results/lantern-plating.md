# Bot report: The Black Strait (`lantern`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.45; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=lantern --seeds=24 --armory=plating --kits=plan`. Heat map: `tools/v3/map-report/results/lantern-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.38; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w4 1.54 a run (79% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.86 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 40%, cold early 21% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 12.0 s → w10 5.3 s (slope -0.55 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.04 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.37 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.05 (19), r2 0.32 (19), r3 1.32 (19); tough (every run): 0.13, 0.25, 1.46 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 2.7 lost 1–10, end 13.7; off-counter 4.0 lost 1–10, end 13.2 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (0.96 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 21%, middle 40%, late 39%.

## Ships lost per wave

Normal: won 75%, mean end wave 13.0 (14 = won), 3.3 lost in waves 1–10, 0.37 in waves 1–5. Tough: 3.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.04 | 0.04 | 0.04 | 0.17 | 0.08 | 0.38 | 0.50 | 0.58 | 0.96 | 0.71 | 0.13 | 0.25 | 1.46 |
| normal, runs that reached it | 0.04 | 0.04 | 0.04 | 0.17 | 0.08 | 0.38 | 0.50 | 0.58 | 0.96 | 0.64 | 0.05 | 0.32 | 1.32 |
| normal, mean over all runs | 0.04 | 0.04 | 0.04 | 0.17 | 0.08 | 0.38 | 0.50 | 0.58 | 0.92 | 0.58 | 0.04 | 0.25 | 1.04 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 19 | 19 | 19 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.38.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.1 | 1.7 | 1.8 | 1.8 | 1.8 | 1.6 | 1.9 | 2.0 | 1.9 | 1.6 | 2.0 | 3.3 | 3.5 |
| kills a minute | 52 | 43 | 49 | 44 | 45 | 42 | 41 | 43 | 47 | 42 | 49 | 62 | 54 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 0.6 | 2.0 | 1.5 | 2.3 | 2.5 | 2.2 | 4.4 | 4.1 | 5.2 | 0.3 | 0.4 | 0.1 |
| runs with ≥ 1 | 8% | 38% | 92% | 79% | 83% | 79% | 79% | 100% | 100% | 100% | 29% | 38% | 13% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.3 | 24.7 | 33.2 | 33.4 | 35.7 | 36.2 | 39.9 | 44.8 | 49.1 | 56.2 |
| launches (encounters off) | 23.0 | 26.5 | 35.3 | 37.5 | 40.0 | 41.3 | 45.5 | 48.8 | 55.1 | 65.3 |
| **ratio to encounters off** | 1.05 | 0.93 | 0.94 | 0.89 | 0.89 | 0.88 | 0.88 | 0.92 | 0.89 | 0.86 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.05 | 0.80 | 0.85 | 0.76 | 0.78 | 0.68 | 0.64 | 0.66 | 0.63 | 0.60 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 21% / 4% | 40% / 42% | 39% / 54% | 40.6 | middle | early |
| all | 1–9 | 21% / 4% | 40% / 42% | 39% / 54% | 40.6 | middle | early |
| 1 | 1–13 | 22% / 9% | 37% / 38% | 41% / 52% | 79.3 | late | early |
| all | 1–13 | 22% / 9% | 37% / 38% | 41% / 52% | 79.3 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 12.0 | 9.1 | 7.9 | 7.5 | 7.4 | 5.8 | 6.1 | 5.9 | 6.9 | 5.3 | 6.1 | 5.7 | 5.5 |
| launches read | 672 | 682 | 848 | 834 | 886 | 900 | 952 | 1068 | 1175 | 1347 | 478 | 528 | 550 |

Slope over waves 1–10: -0.55 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.05 | 0.32 | 1.32 |
| runs that reached it | 19 | 19 | 19 |
| tough, every run | 0.13 | 0.25 | 1.46 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 19 | 19 | 19 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.0** | **0.1** | **0.2** | **0.1** | **0.1** | **0.1** | **0.1** | **0.1** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.2 | 0.1 | 0.1 | 0.1 | 0.0 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.08 | 0.04 | 0.05 | 0.05 | 0.05 | 0.05 |
| runs with no save | 100% | 100% | 100% | 96% | 96% | 100% | 92% | 83% | 87% | 86% | 95% | 95% | 95% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.09 | 0.05 | 0.05 | 0.05 | 0.05 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.00 | 0.08 | 0.13 | 0.00 | 0.09 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.19 | 0.31 | 0.83 | 0.46 | 0.63 | 0.68 | 0.72 | 0.89 | 0.77 | 0.83 | 0.35 | 0.46 | 0.64 |
| peaks | 0.0 | 0.0 | 0.5 | 0.1 | 0.5 | 0.4 | 0.7 | 0.9 | 0.7 | 0.7 | 0.0 | 0.0 | 0.2 |
| release after a peak (s) | 0.1 | 0.0 | 1.3 | 0.4 | 0.5 | 0.7 | 1.0 | 1.2 | 0.8 | 1.0 | 0.0 | 0.0 | 0.3 |
| hot share | 0% | 0% | 3% | 0% | 2% | 1% | 2% | 3% | 2% | 2% | 0% | 0% | 1% |
| calm share | 98% | 93% | 87% | 87% | 85% | 80% | 80% | 76% | 80% | 78% | 93% | 80% | 80% |
| shape (most runs) | flat 96% | flat 100% | one peak 54% | flat 87% | flat 67% | flat 67% | flat 50% | flat 38% | flat 61% | flat 50% | flat 100% | flat 100% | flat 79% |
| taps follow tension (r) | 0.40 | 0.36 | 0.29 | 0.47 | 0.40 | 0.34 | 0.44 | 0.31 | 0.34 | 0.42 | 0.44 | 0.45 | 0.34 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 182 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | scatter, gunships, shield | 92% | 13.7 | 2.7 | 2.7 | 0.09 (22) / 0.27 (22) / 0.50 (22) | 0.0 0.0 0.0 0.3 0.1 0.6 0.3 0.5 0.4 0.6 |
| off-counter | seeker, tesla, fullSteam | 83% | 13.2 | 3.5 | 4.0 | 0.05 (20) / 0.05 (20) / 0.80 (20) | 0.0 0.0 0.0 0.2 0.0 0.3 0.7 0.9 0.9 0.9 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
