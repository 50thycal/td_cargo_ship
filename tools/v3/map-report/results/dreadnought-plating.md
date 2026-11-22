# Bot report: Dreadnought Pass (`dreadnought`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 0.85; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=dreadnought --seeds=24 --armory=plating --kits=plan`. Heat map: `tools/v3/map-report/results/dreadnought-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.25; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w9 1.92 a run (88% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w3 ×0.91 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 41%, cold early 19% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 7.1 s → w10 6.1 s (slope -0.23 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.33 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.59 (22), r2 1.36 (22), r3 0.95 (22); tough (every run): 0.58, 1.54, 1.21 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 1.5 lost 1–10, end 14.0; off-counter 2.3 lost 1–10, end 13.7 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (0.50 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 19%, middle 40%, late 41%.

## Ships lost per wave

Normal: won 88%, mean end wave 13.5 (14 = won), 1.7 lost in waves 1–10, 0.33 in waves 1–5. Tough: 1.8 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 0.04 | 0.25 | 0.13 | 0.33 | 0.25 | 0.50 | 0.29 | 0.58 | 1.54 | 1.21 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 0.04 | 0.25 | 0.13 | 0.33 | 0.26 | 0.39 | 0.30 | 0.59 | 1.36 | 0.95 |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 0.04 | 0.25 | 0.13 | 0.33 | 0.25 | 0.38 | 0.29 | 0.54 | 1.25 | 0.88 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 22 | 22 | 22 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.25.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.3 | 1.1 | 1.8 | 1.1 | 1.1 | 1.9 | 1.5 | 1.7 | 2.6 | 1.7 | 1.2 | 2.1 | 2.8 |
| kills a minute | 35 | 31 | 47 | 31 | 28 | 43 | 33 | 36 | 54 | 40 | 23 | 38 | 56 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.6 | 1.2 | 2.6 | 2.1 | 2.5 | 2.9 | 3.0 | 2.3 | 1.9 | 3.4 | 1.3 | 2.1 | 5.0 |
| runs with ≥ 1 | 92% | 79% | 92% | 83% | 92% | 96% | 100% | 83% | 88% | 92% | 75% | 88% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 14.3 | 14.6 | 36.7 | 17.6 | 21.3 | 38.8 | 33.1 | 33.9 | 56.3 | 62.8 |
| launches (encounters off) | 14.0 | 13.6 | 40.3 | 19.2 | 19.8 | 39.5 | 32.5 | 35.6 | 55.6 | 62.3 |
| **ratio to encounters off** | 1.02 | 1.08 | 0.91 | 0.92 | 1.07 | 0.98 | 1.02 | 0.95 | 1.01 | 1.01 |
| table × scale | 14 | 18 | 23 | 26 | 27 | 32 | 36 | 40 | 46 | 55 |
| ratio to table × scale | 1.02 | 0.81 | 1.60 | 0.68 | 0.79 | 1.21 | 0.92 | 0.85 | 1.22 | 1.14 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 19% / 3% | 40% / 41% | 41% / 57% | 24.2 | late | early |
| all | 1–9 | 19% / 3% | 40% / 41% | 41% / 57% | 24.2 | late | early |
| 1 | 1–13 | 18% / 6% | 38% / 30% | 44% / 65% | 48.3 | late | early |
| all | 1–13 | 18% / 6% | 38% / 30% | 44% / 65% | 48.3 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.1 | 10.0 | 7.5 | 6.9 | 5.7 | 6.3 | 7.2 | 7.3 | 5.9 | 6.1 | 5.5 | 5.1 | 5.4 |
| launches read | 432 | 440 | 933 | 457 | 544 | 950 | 790 | 809 | 1349 | 1506 | 401 | 585 | 812 |

Slope over waves 1–10: -0.23 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.59 | 1.36 | 0.95 |
| runs that reached it | 22 | 22 | 22 |
| tough, every run | 0.58 | 1.54 | 1.21 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 22 | 22 | 22 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.0** | **0.3** | **0.1** | **0.0** | **0.2** | **0.1** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.2 | 0.1 | 0.0 | 0.2 | 0.1 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.00 | 0.17 | 0.09 | 0.00 | 0.09 | 0.00 |
| runs with no save | 100% | 100% | 100% | 100% | 96% | 96% | 88% | 96% | 78% | 91% | 100% | 86% | 95% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.09 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.17 | 0.09 | 0.00 | 0.14 | 0.09 |
| tension peak | 0.32 | 0.35 | 0.51 | 0.81 | 0.73 | 0.70 | 1.67 | 0.68 | 0.79 | 1.01 | 0.87 | 1.13 | 1.02 |
| peaks | 0.0 | 0.0 | 0.1 | 0.6 | 0.6 | 0.3 | 1.0 | 0.4 | 0.7 | 0.7 | 1.2 | 2.1 | 2.0 |
| release after a peak (s) | 0.0 | 0.0 | 0.1 | 1.2 | 1.4 | 0.7 | 2.3 | 1.2 | 1.1 | 0.9 | 1.1 | 1.9 | 1.8 |
| hot share | 0% | 0% | 0% | 3% | 3% | 1% | 5% | 1% | 3% | 2% | 5% | 11% | 12% |
| calm share | 89% | 95% | 79% | 90% | 85% | 83% | 86% | 88% | 77% | 87% | 82% | 65% | 61% |
| shape (most runs) | flat 100% | flat 100% | flat 92% | one peak 58% | one peak 50% | flat 67% | one peak 87% | flat 57% | flat 52% | flat 57% | one peak 50% | sawtooth 55% | sawtooth 45% |
| taps follow tension (r) | 0.21 | 0.13 | 0.18 | 0.27 | 0.38 | 0.17 | 0.30 | 0.26 | 0.12 | 0.29 | 0.38 | 0.32 | 0.30 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 78 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, shield, gunships | 100% | 14.0 | 1.5 | 1.5 | 0.42 (24) / 1.04 (24) / 1.08 (24) | 0.0 0.0 0.0 0.1 0.1 0.1 0.3 0.3 0.3 0.4 |
| off-counter | seeker, orbital, bomberWing | 92% | 13.7 | 2.2 | 2.3 | 0.65 (23) / 1.26 (23) / 0.65 (23) | 0.0 0.0 0.0 0.1 0.2 0.0 0.5 0.3 0.8 0.4 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
