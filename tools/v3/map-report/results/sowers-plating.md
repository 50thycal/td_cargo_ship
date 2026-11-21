# Bot report: Sowers' Reach (`sowers`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.45; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=sowers --seeds=24 --armory=plating --kits=plan`. Heat map: `tools/v3/map-report/results/sowers-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +0.75; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w4 0.71 a run (50% of runs have one); under 1 on w4 | ≥ 1 a run on every wave 3–10 | tough | **FLAG** |
| `w-budget` | Wave budgets ±15% | furthest w5 ×0.90 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 41%, cold early 21% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.8 s → w10 5.2 s (slope -0.40 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.50 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.29 (17), r2 0.35 (17), r3 0.65 (17); tough (every run): 0.25, 0.46, 0.58 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 2.9 lost 1–10, end 13.5; off-counter 3.5 lost 1–10, end 13.2 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Too few close calls on wave 4 (0.71): give those waves a launch from a near site, or one aimed at the danger stretch.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.71 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 21%, middle 38%, late 41%.

## Ships lost per wave

Normal: won 71%, mean end wave 12.7 (14 = won), 3.7 lost in waves 1–10, 0.50 in waves 1–5. Tough: 4.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.13 | 0.13 | 0.04 | 0.21 | 0.17 | 0.33 | 0.67 | 0.96 | 1.71 | 0.25 | 0.46 | 0.58 |
| normal, runs that reached it | 0.00 | 0.13 | 0.13 | 0.04 | 0.21 | 0.17 | 0.33 | 0.67 | 0.78 | 1.41 | 0.29 | 0.35 | 0.65 |
| normal, mean over all runs | 0.00 | 0.13 | 0.13 | 0.04 | 0.21 | 0.17 | 0.33 | 0.67 | 0.75 | 1.29 | 0.21 | 0.25 | 0.46 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 17 | 17 | 17 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +0.75.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.2 | 2.1 | 2.0 | 2.0 | 1.9 | 1.9 | 2.1 | 2.3 | 2.5 | 2.1 | 1.8 | 2.6 | 5.2 |
| kills a minute | 54 | 54 | 51 | 49 | 47 | 51 | 47 | 49 | 52 | 44 | 38 | 53 | 67 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 0.3 | 1.6 | 0.7 | 1.5 | 1.5 | 2.1 | 2.1 | 2.9 | 5.6 | 1.4 | 0.9 | 1.4 |
| runs with ≥ 1 | 13% | 33% | 79% | 50% | 88% | 71% | 83% | 71% | 83% | 100% | 75% | 58% | 71% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.3 | 30.9 | 35.2 | 38.2 | 37.0 | 41.7 | 44.0 | 50.0 | 54.3 | 62.3 |
| launches (encounters off) | 25.0 | 30.0 | 38.3 | 39.2 | 41.0 | 44.3 | 48.6 | 53.1 | 58.4 | 68.0 |
| **ratio to encounters off** | 0.97 | 1.03 | 0.92 | 0.97 | 0.90 | 0.94 | 0.90 | 0.94 | 0.93 | 0.92 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.05 | 1.00 | 0.90 | 0.87 | 0.80 | 0.79 | 0.71 | 0.73 | 0.70 | 0.66 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 21% / 13% | 38% / 43% | 41% / 44% | 24.6 | late | early |
| all | 1–9 | 21% / 13% | 38% / 43% | 41% / 44% | 24.6 | late | early |
| 1 | 1–13 | 17% / 8% | 34% / 36% | 49% / 56% | 43.9 | late | early |
| all | 1–13 | 17% / 8% | 34% / 36% | 49% / 56% | 43.9 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.8 | 8.4 | 7.6 | 7.6 | 7.2 | 5.4 | 6.2 | 5.9 | 5.9 | 5.2 | 1.6 | 1.6 | 1.5 |
| launches read | 600 | 734 | 824 | 816 | 799 | 848 | 886 | 1025 | 1082 | 1275 | 216 | 288 | 312 |

Slope over waves 1–10: -0.40 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.29 | 0.35 | 0.65 |
| runs that reached it | 17 | 17 | 17 |
| tough, every run | 0.25 | 0.46 | 0.58 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 17 | 17 | 17 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.3** | **0.2** | **0.0** | **0.1** | **0.2** | **0.1** | **0.1** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.2 | 0.2 | 0.0 | 0.1 | 0.2 | 0.1 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.17 | 0.00 | 0.05 | 0.24 | 0.00 | 0.06 |
| runs with no save | 100% | 100% | 100% | 100% | 100% | 92% | 83% | 88% | 100% | 86% | 82% | 88% | 94% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.13 | 0.00 | 0.00 | 0.18 | 0.06 | 0.06 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.05 | 0.00 | 0.06 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.06 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.21 | 0.00 | 0.00 | 0.09 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.17 | 0.37 | 0.50 | 0.31 | 0.39 | 0.52 | 0.72 | 0.74 | 0.98 | 1.24 | 0.56 | 0.59 | 0.86 |
| peaks | 0.0 | 0.0 | 0.1 | 0.0 | 0.1 | 0.2 | 0.7 | 0.6 | 1.0 | 1.1 | 0.1 | 0.2 | 0.7 |
| release after a peak (s) | 0.0 | 0.1 | 0.2 | 0.0 | 0.3 | 0.3 | 1.1 | 1.4 | 1.4 | 1.8 | 0.2 | 0.2 | 1.8 |
| hot share | 0% | 0% | 1% | 0% | 0% | 1% | 2% | 3% | 3% | 4% | 0% | 1% | 5% |
| calm share | 99% | 92% | 89% | 94% | 90% | 87% | 82% | 79% | 78% | 76% | 69% | 64% | 54% |
| shape (most runs) | flat 100% | flat 96% | flat 92% | flat 100% | flat 92% | flat 83% | flat 46% | flat 58% | one peak 48% | one peak 45% | flat 88% | flat 82% | one peak 71% |
| taps follow tension (r) | 0.45 | 0.46 | 0.29 | 0.47 | 0.38 | 0.37 | 0.39 | 0.43 | 0.36 | 0.32 | 0.50 | 0.39 | 0.44 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 133 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | tesla, flak, shield | 88% | 13.5 | 2.9 | 2.9 | 0.24 (21) / 0.57 (21) / 0.86 (21) | 0.0 0.0 0.0 0.0 0.1 0.1 0.4 0.6 0.8 0.8 |
| off-counter | seeker, shrapnel, fullSteam | 83% | 13.2 | 3.1 | 3.5 | 0.35 (20) / 0.40 (20) / 0.65 (20) | 0.0 0.0 0.1 0.0 0.3 0.4 0.3 0.5 0.9 1.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
