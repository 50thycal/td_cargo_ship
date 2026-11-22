# Bot report: Tidewater Flats (`tide`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.4; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=tide --seeds=24 --armory=plating --kits=plan`. Heat map: `tools/v3/map-report/results/tide-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +0.54; doubles on w8 (0.29→0.83) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 1.88 a run (88% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w4 ×0.82 of the no-encounter wave; outside on w4 ×0.82 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 40%, cold early 24%; lane 2: hot early 70%, cold late 2% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 10.6 s → w10 7.5 s (slope -0.27 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.33 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.33 (21), r2 1.10 (21), r3 1.14 (21); tough (every run): 0.38, 1.21, 1.29 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 3.4 lost 1–10, end 13.6; counter 4.2 lost 1–10, end 13.3 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 8 loses 0.83 after 0.29. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 4 sends ×0.82 the no-encounter wave. Encounters should replace launches, not add them.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.42 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 26%, middle 36%, late 38%.

## Ships lost per wave

Normal: won 83%, mean end wave 13.3 (14 = won), 2.7 lost in waves 1–10, 0.33 in waves 1–5. Tough: 4.1 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.25 | 0.04 | 0.04 | 0.21 | 0.29 | 0.83 | 1.00 | 1.42 | 0.38 | 1.21 | 1.29 |
| normal, runs that reached it | 0.00 | 0.00 | 0.25 | 0.04 | 0.04 | 0.21 | 0.29 | 0.71 | 0.61 | 0.64 | 0.33 | 1.10 | 1.14 |
| normal, mean over all runs | 0.00 | 0.00 | 0.25 | 0.04 | 0.04 | 0.21 | 0.29 | 0.71 | 0.58 | 0.58 | 0.29 | 0.96 | 1.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 21 | 21 | 21 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +0.54.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.8 | 1.6 | 2.0 | 1.5 | 1.8 | 1.9 | 2.1 | 2.1 | 2.1 | 2.2 | 0.5 | 1.6 | 1.6 |
| kills a minute | 41 | 42 | 48 | 45 | 44 | 42 | 49 | 48 | 53 | 55 | 9 | 25 | 24 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.8 | 3.7 | 2.6 | 1.9 | 3.2 | 3.9 | 4.3 | 4.5 | 3.6 | 4.4 | 2.5 | 2.6 | 3.1 |
| runs with ≥ 1 | 79% | 96% | 88% | 88% | 100% | 100% | 100% | 96% | 92% | 100% | 92% | 88% | 92% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 23.3 | 23.7 | 32.4 | 32.3 | 35.3 | 38.6 | 46.0 | 48.1 | 53.6 | 59.1 |
| launches (encounters off) | 22.0 | 26.4 | 36.3 | 39.4 | 39.0 | 43.8 | 47.3 | 50.5 | 59.2 | 67.8 |
| **ratio to encounters off** | 1.06 | 0.90 | 0.89 | **0.82** | 0.90 | 0.88 | 0.97 | 0.95 | 0.91 | 0.87 |
| table × scale | 22 | 30 | 38 | 43 | 45 | 52 | 60 | 66 | 76 | 91 |
| ratio to table × scale | 1.06 | 0.79 | 0.85 | 0.75 | 0.78 | 0.74 | 0.77 | 0.73 | 0.71 | 0.65 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 24% / 13% | 37% / 36% | 40% / 51% | 46.3 | late | early |
| 2 | 1–9 | 70% / 33% | 28% / 67% | 2% / 0% | 2.3 | early | late |
| all | 1–9 | 26% / 14% | 36% / 38% | 38% / 48% | 48.5 | late | early |
| 1 | 1–13 | 17% / 9% | 36% / 29% | 46% / 63% | 81.9 | late | early |
| 2 | 1–13 | 64% / 25% | 35% / 75% | 2% / 0% | 2.8 | early | late |
| all | 1–13 | 19% / 9% | 36% / 30% | 45% / 61% | 84.7 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.6 | 9.7 | 9.5 | 9.4 | 8.5 | 8.7 | 8.8 | 8.1 | 8.3 | 7.5 | 1.9 | 4.2 | 3.7 |
| launches read | 648 | 658 | 801 | 781 | 855 | 946 | 1066 | 1128 | 1253 | 1366 | 168 | 408 | 456 |

Slope over waves 1–10: -0.27 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.33 | 1.10 | 1.14 |
| runs that reached it | 21 | 21 | 21 |
| tough, every run | 0.38 | 1.21 | 1.29 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 21 | 21 | 21 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.1** | **0.0** | **0.0** | **0.1** | **0.5** |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.1 | 0.0 | 0.0 | 0.1 | 0.4 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.08 | 0.04 | 0.09 | 0.00 | 0.00 | 0.10 | 0.19 |
| runs with no save | 100% | 100% | 92% | 100% | 100% | 100% | 88% | 92% | 87% | 100% | 100% | 86% | 62% |
|   pickup save | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.05 |
|   cover choice | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.10 | 0.10 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.04 | 0.04 | 0.00 | 0.00 | 0.05 | 0.38 |
| tension peak | 0.44 | 0.42 | 0.74 | 0.56 | 0.77 | 0.90 | 0.95 | 0.93 | 0.85 | 1.01 | 1.16 | 1.48 | 1.68 |
| peaks | 0.1 | 0.0 | 0.3 | 0.2 | 0.4 | 0.9 | 0.9 | 0.6 | 0.8 | 0.7 | 1.2 | 2.4 | 1.7 |
| release after a peak (s) | 0.1 | 0.1 | 0.7 | 0.3 | 0.7 | 1.5 | 1.5 | 1.2 | 1.3 | 1.7 | 2.0 | 2.1 | 2.4 |
| hot share | 0% | 0% | 2% | 0% | 2% | 3% | 3% | 3% | 2% | 3% | 7% | 19% | 15% |
| calm share | 91% | 86% | 85% | 87% | 83% | 75% | 81% | 78% | 80% | 82% | 74% | 61% | 62% |
| shape (most runs) | flat 92% | flat 96% | flat 67% | flat 83% | flat 67% | one peak 46% | one peak 62% | one peak 50% | one peak 43% | one peak 50% | one peak 67% | sawtooth 52% | sawtooth 48% |
| taps follow tension (r) | 0.38 | 0.34 | 0.35 | 0.25 | 0.39 | 0.32 | 0.28 | 0.22 | 0.31 | 0.31 | 0.70 | 0.53 | 0.52 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 236 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, aegis, bomberWing | 83% | 13.3 | 2.7 | 4.2 | 0.33 (21) / 1.38 (21) / 1.33 (21) | 0.0 0.0 0.3 0.0 0.0 0.3 0.3 0.8 1.0 1.5 |
| off-counter | tesla, grapnel, fullSteam | 88% | 13.6 | 3.2 | 3.4 | 0.18 (22) / 0.95 (22) / 1.32 (22) | 0.0 0.0 0.3 0.2 0.0 0.2 0.3 0.6 0.7 1.1 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
