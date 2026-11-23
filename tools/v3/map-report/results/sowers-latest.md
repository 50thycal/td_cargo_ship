# Bot report: Sowers' Reach (`sowers`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.45; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=sowers --seeds=24 --armory=latest --kits=plan`. Heat map: `tools/v3/map-report/results/sowers-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.63; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w4 1.25 a run (83% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.89 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 42%, cold early 21% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.8 s → w10 5.2 s (slope -0.39 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.08 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.58 (12), r2 0.50 (12), r3 1.25 (12); tough (every run): 0.88, 0.63, 1.71 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 5.5 lost 1–10, end 12.1; off-counter 7.3 lost 1–10, end 10.7 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.79 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 21%, middle 42%, late 37%.

## Ships lost per wave

Normal: won 50%, mean end wave 11.3 (14 = won), 4.3 lost in waves 1–10, 1.08 in waves 1–5, 0.17 in bonus waves. Tough: 7.2 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.17 | 0.21 | 0.33 | 0.38 | 0.71 | 0.71 | 1.13 | 1.75 | 1.79 | 0.88 | 0.63 | 1.71 |
| normal, runs that reached it | 0.00 | 0.17 | 0.21 | 0.33 | 0.38 | 0.58 | 0.35 | 1.00 | 0.89 | 1.00 | 0.58 | 0.50 | 1.25 |
| normal, mean over all runs | 0.00 | 0.17 | 0.21 | 0.33 | 0.38 | 0.58 | 0.33 | 0.92 | 0.71 | 0.63 | 0.29 | 0.25 | 0.63 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 19 | 15 | 12 | 12 | 12 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.63.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.8 | 2.2 | 1.8 | 2.0 | 1.9 | 2.1 | 2.1 | 2.4 | 2.3 | 1.7 | 1.8 | 2.5 | 4.3 |
| kills a minute | 54 | 52 | 51 | 49 | 48 | 51 | 48 | 49 | 54 | 47 | 41 | 56 | 71 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 0.8 | 2.2 | 1.3 | 2.5 | 2.3 | 2.4 | 3.3 | 3.5 | 5.3 | 1.3 | 1.5 | 1.0 |
| runs with ≥ 1 | 4% | 50% | 96% | 83% | 92% | 88% | 92% | 100% | 96% | 96% | 58% | 79% | 54% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.3 | 31.3 | 34.8 | 39.3 | 38.0 | 42.7 | 44.3 | 50.3 | 54.4 | 61.5 |
| launches (encounters off) | 25.0 | 30.3 | 38.2 | 39.0 | 41.4 | 43.7 | 49.8 | 52.4 | 59.0 | 66.6 |
| **ratio to encounters off** | 0.97 | 1.03 | 0.91 | 1.01 | 0.92 | 0.98 | 0.89 | 0.96 | 0.92 | 0.92 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.05 | 1.01 | 0.89 | 0.89 | 0.83 | 0.81 | 0.72 | 0.74 | 0.70 | 0.65 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 21% / 16% | 42% / 44% | 37% / 40% | 39.8 | middle | early |
| all | 1–9 | 21% / 16% | 42% / 44% | 37% / 40% | 39.8 | middle | early |
| 1 | 1–13 | 17% / 14% | 35% / 33% | 48% / 53% | 67.6 | late | early |
| all | 1–13 | 17% / 14% | 35% / 33% | 48% / 53% | 67.6 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.8 | 8.4 | 7.8 | 7.3 | 7.1 | 5.4 | 6.3 | 5.9 | 5.8 | 5.2 | 1.7 | 1.6 | 1.6 |
| launches read | 600 | 745 | 817 | 832 | 818 | 846 | 877 | 1049 | 1083 | 1259 | 240 | 310 | 336 |

Slope over waves 1–10: -0.39 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.58 | 0.50 | 1.25 |
| runs that reached it | 12 | 12 | 12 |
| tough, every run | 0.88 | 0.63 | 1.71 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 19 | 15 | 12 | 12 | 12 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.0** | **0.4** | **0.1** | **0.5** | **0.2** | **0.3** | **0.3** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.4 | 0.1 | 0.4 | 0.1 | 0.3 | 0.3 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.08 | 0.04 | 0.32 | 0.11 | 0.40 | 0.17 | 0.25 | 0.25 |
| runs with no save | 100% | 96% | 100% | 100% | 96% | 88% | 96% | 77% | 89% | 60% | 83% | 83% | 67% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.23 | 0.00 | 0.20 | 0.08 | 0.17 | 0.17 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.05 | 0.05 | 0.07 | 0.00 | 0.08 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.07 | 0.08 | 0.08 | 0.08 |
|   kill save | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.09 | 0.05 | 0.13 | 0.00 | 0.00 | 0.08 |
| tension peak | 0.14 | 0.43 | 0.60 | 0.51 | 0.54 | 0.77 | 0.69 | 0.97 | 1.00 | 0.98 | 0.75 | 0.75 | 0.90 |
| peaks | 0.0 | 0.1 | 0.3 | 0.1 | 0.2 | 0.5 | 0.3 | 1.1 | 0.7 | 1.1 | 0.6 | 0.6 | 0.8 |
| release after a peak (s) | 0.0 | 0.2 | 0.4 | 0.4 | 0.2 | 0.9 | 0.5 | 2.1 | 1.3 | 2.3 | 1.1 | 1.2 | 3.1 |
| hot share | 0% | 1% | 1% | 0% | 1% | 3% | 2% | 5% | 4% | 4% | 3% | 3% | 5% |
| calm share | 99% | 89% | 88% | 89% | 86% | 82% | 81% | 75% | 76% | 80% | 68% | 61% | 45% |
| shape (most runs) | flat 100% | flat 92% | flat 71% | flat 87% | flat 87% | flat 58% | flat 78% | one peak 50% | one peak 47% | one peak 40% | flat 50% | one peak 58% | one peak 83% |
| taps follow tension (r) | 0.37 | 0.39 | 0.28 | 0.34 | 0.34 | 0.36 | 0.35 | 0.35 | 0.33 | 0.40 | 0.41 | 0.32 | 0.32 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 105 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | tesla, flak, shield | 58% | 12.1 | 4.3 | 5.5 | 0.86 (14) / 0.71 (14) / 1.00 (14) | 0.0 0.1 0.1 0.3 0.3 0.4 0.2 0.9 1.4 1.8 |
| off-counter | seeker, shrapnel, fullSteam | 33% | 10.7 | 4.6 | 7.3 | 0.89 (9) / 1.00 (9) / 1.44 (9) | 0.0 0.2 0.2 0.2 0.3 0.9 0.9 0.9 1.7 2.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
