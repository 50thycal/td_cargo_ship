# Bot report: Tidewater Flats (`tide`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.4; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=tide --seeds=24 --armory=player --kits=plan`. Heat map: `tools/v3/map-report/results/tide-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +0.54; doubles on w7 (0.17→0.63) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 2.25 a run (79% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w5 ×0.88 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 43%, cold early 25%; lane 2: hot middle 38%, cold early 26% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 10.0 s → w10 5.4 s (slope -0.41 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.71 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.94 (18), r2 1.56 (18), r3 2.06 (16); tough (every run): 0.79, 1.58, 1.92 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 3.3 lost 1–10, end 12.2; counter 3.9 lost 1–10, end 12.0 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 7 loses 0.63 after 0.17. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest early takes 25%), lane 2 (coldest early takes 26%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 8 (1.17 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 25%, middle 33%, late 41%.

## Ships lost per wave

Normal: won 58%, mean end wave 12.3 (14 = won), 3.5 lost in waves 1–10, 0.71 in waves 1–5. Tough: 4.1 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.04 | 0.33 | 0.00 | 0.33 | 0.17 | 0.63 | 1.17 | 1.00 | 0.42 | 0.79 | 1.58 | 1.92 |
| normal, runs that reached it | 0.00 | 0.04 | 0.33 | 0.00 | 0.33 | 0.17 | 0.61 | 1.00 | 0.81 | 0.44 | 0.94 | 1.56 | 2.06 |
| normal, mean over all runs | 0.00 | 0.04 | 0.33 | 0.00 | 0.33 | 0.17 | 0.58 | 0.96 | 0.71 | 0.33 | 0.71 | 1.17 | 1.38 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 21 | 18 | 18 | 18 | 16 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +0.54.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.3 | 1.6 | 2.4 | 1.8 | 1.8 | 2.0 | 2.2 | 2.3 | 2.5 | 2.2 | 0.5 | 1.8 | 1.8 |
| kills a minute | 50 | 43 | 47 | 47 | 44 | 45 | 49 | 48 | 53 | 56 | 9 | 29 | 26 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.8 | 3.1 | 3.1 | 2.3 | 3.8 | 3.2 | 3.0 | 3.6 | 3.3 | 4.7 | 2.1 | 3.5 | 3.0 |
| runs with ≥ 1 | 79% | 100% | 100% | 79% | 100% | 92% | 96% | 96% | 96% | 100% | 96% | 96% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 23.3 | 24.7 | 33.3 | 34.8 | 34.8 | 38.5 | 45.6 | 49.1 | 54.0 | 58.7 |
| launches (encounters off) | 22.0 | 26.4 | 36.5 | 39.3 | 39.5 | 43.1 | 46.7 | 49.1 | 58.0 | 66.0 |
| **ratio to encounters off** | 1.06 | 0.94 | 0.91 | 0.88 | 0.88 | 0.89 | 0.98 | 1.00 | 0.93 | 0.89 |
| table × scale | 22 | 30 | 38 | 43 | 45 | 52 | 60 | 66 | 76 | 91 |
| ratio to table × scale | 1.06 | 0.82 | 0.88 | 0.81 | 0.77 | 0.74 | 0.76 | 0.74 | 0.71 | 0.64 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 25% / 5% | 32% / 25% | 43% / 70% | 49.0 | late | early |
| 2 | 1–9 | 26% / 13% | 38% / 47% | 36% / 41% | 18.6 | middle | early |
| all | 1–9 | 25% / 8% | 33% / 33% | 41% / 59% | 67.7 | late | early |
| 1 | 1–13 | 16% / 2% | 34% / 20% | 50% / 78% | 88.5 | late | early |
| 2 | 1–13 | 16% / 7% | 35% / 30% | 49% / 64% | 32.9 | late | early |
| all | 1–13 | 16% / 3% | 34% / 23% | 50% / 74% | 121.4 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.0 | 7.9 | 8.1 | 8.0 | 6.3 | 6.7 | 6.6 | 5.6 | 6.3 | 5.4 | 2.0 | 4.1 | 4.1 |
| launches read | 648 | 681 | 850 | 868 | 868 | 957 | 1084 | 1170 | 1288 | 1400 | 168 | 456 | 504 |

Slope over waves 1–10: -0.41 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.94 | 1.56 | 2.06 |
| runs that reached it | 18 | 18 | 16 |
| tough, every run | 0.79 | 1.58 | 1.92 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 21 | 18 | 18 | 18 | 16 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.0** | **0.3** | **0.0** | **0.1** | **0.2** | **0.1** | **0.2** | **0.1** | **0.2** | **0.3** |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.0 | 0.3 | 0.0 | 0.1 | 0.1 | 0.1 | 0.2 | 0.1 | 0.2 | 0.3 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.06 | 0.06 |
| clutch | 0.00 | 0.00 | 0.13 | 0.00 | 0.08 | 0.00 | 0.13 | 0.09 | 0.10 | 0.11 | 0.06 | 0.11 | 0.19 |
| runs with no save | 100% | 100% | 88% | 100% | 79% | 100% | 91% | 83% | 86% | 89% | 94% | 83% | 69% |
|   pickup save | 0.00 | 0.00 | 0.13 | 0.00 | 0.08 | 0.00 | 0.04 | 0.04 | 0.05 | 0.06 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.00 | 0.05 | 0.00 | 0.06 | 0.06 | 0.13 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.17 | 0.00 | 0.00 | 0.17 | 0.00 | 0.11 | 0.00 | 0.11 | 0.19 |
| tension peak | 0.45 | 0.39 | 0.87 | 0.60 | 0.83 | 0.92 | 0.86 | 1.14 | 1.14 | 1.30 | 1.15 | 1.37 | 1.75 |
| peaks | 0.1 | 0.1 | 0.4 | 0.2 | 0.4 | 0.8 | 0.8 | 0.7 | 0.9 | 0.9 | 1.1 | 2.3 | 1.9 |
| release after a peak (s) | 0.2 | 0.1 | 1.0 | 0.4 | 0.5 | 1.6 | 1.3 | 1.8 | 2.1 | 2.0 | 1.8 | 2.4 | 2.0 |
| hot share | 0% | 0% | 2% | 0% | 2% | 3% | 2% | 4% | 5% | 3% | 9% | 18% | 18% |
| calm share | 90% | 89% | 78% | 84% | 78% | 78% | 76% | 71% | 75% | 79% | 75% | 59% | 62% |
| shape (most runs) | flat 87% | flat 92% | flat 62% | flat 79% | flat 58% | one peak 65% | one peak 43% | one peak 57% | one peak 52% | one peak 72% | one peak 56% | sawtooth 94% | sawtooth 69% |
| taps follow tension (r) | 0.32 | 0.38 | 0.40 | 0.32 | 0.44 | 0.36 | 0.37 | 0.33 | 0.25 | 0.37 | 0.76 | 0.58 | 0.48 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 560 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, aegis, bomberWing | 46% | 12.0 | 3.6 | 3.9 | 0.94 (18) / 1.83 (18) / 2.50 (14) | 0.0 0.0 0.3 0.0 0.4 0.1 1.0 0.7 0.9 0.5 |
| off-counter | tesla, grapnel, fullSteam | 63% | 12.2 | 2.8 | 3.3 | 0.61 (18) / 1.11 (18) / 1.87 (15) | 0.0 0.0 0.3 0.1 0.6 0.3 0.6 0.3 0.6 0.5 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
