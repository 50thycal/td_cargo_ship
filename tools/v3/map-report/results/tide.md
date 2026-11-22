# Bot report: Tidewater Flats (`tide`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.4; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=tide --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/tide-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +1.58; doubles on w5 (0.38→1.17) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 2.54 a run (83% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w5 ×0.88 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 42%, cold early 24%; lane 2: hot middle 41%, cold early 21% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 10.0 s → w10 5.3 s (slope -0.42 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.04 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 2.04 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.50 (2), r2 2.50 (2), r3 3.00 (1); tough (every run): 1.21, 3.54, 3.33 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 13.1 lost 1–10, end 8.1; counter 16.8 lost 1–10, end 7.6 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 5 loses 1.17 after 0.38. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (4.38 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 23%, middle 36%, late 41%.

## Ships lost per wave

Normal: won 4%, mean end wave 7.9 (14 = won), 5.8 lost in waves 1–10, 2.04 in waves 1–5, 0.08 in bonus waves. Tough: 17.2 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.04 | 0.13 | 0.46 | 0.38 | 1.17 | 1.46 | 1.67 | 3.25 | 4.29 | 4.38 | 1.21 | 3.54 | 3.33 |
| normal, runs that reached it | 0.04 | 0.13 | 0.46 | 0.38 | 1.04 | 1.05 | 1.53 | 1.62 | 1.86 | 1.50 | 1.50 | 2.50 | 3.00 |
| normal, mean over all runs | 0.04 | 0.13 | 0.46 | 0.38 | 1.04 | 0.96 | 1.08 | 0.88 | 0.54 | 0.25 | 0.13 | 0.21 | 0.13 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 22 | 17 | 13 | 7 | 4 | 2 | 2 | 1 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +1.58.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.5 | 1.7 | 2.6 | 2.1 | 1.9 | 2.1 | 2.9 | 2.4 | 3.0 | 2.5 | 0.8 | 1.6 | 1.8 |
| kills a minute | 45 | 42 | 48 | 46 | 41 | 43 | 45 | 44 | 43 | 53 | 12 | 20 | 31 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.9 | 2.9 | 3.7 | 2.5 | 3.1 | 3.3 | 4.2 | 5.3 | 4.2 | 4.3 | 3.0 | 4.2 | 4.1 |
| runs with ≥ 1 | 71% | 100% | 96% | 83% | 100% | 96% | 100% | 100% | 100% | 100% | 100% | 100% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 23.3 | 24.7 | 33.6 | 34.8 | 35.2 | 39.2 | 45.4 | 49.4 | 54.4 | 60.0 |
| launches (encounters off) | 22.0 | 26.4 | 36.4 | 39.3 | 39.9 | 44.0 | 47.4 | 50.2 | 59.1 | 67.4 |
| **ratio to encounters off** | 1.06 | 0.94 | 0.92 | 0.88 | 0.88 | 0.89 | 0.96 | 0.98 | 0.92 | 0.89 |
| table × scale | 22 | 30 | 38 | 43 | 45 | 52 | 60 | 66 | 76 | 91 |
| ratio to table × scale | 1.06 | 0.82 | 0.88 | 0.81 | 0.78 | 0.75 | 0.76 | 0.75 | 0.72 | 0.66 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 24% / 13% | 33% / 29% | 42% / 58% | 62.7 | late | early |
| 2 | 1–9 | 21% / 14% | 41% / 44% | 38% / 42% | 31.8 | middle | early |
| all | 1–9 | 23% / 13% | 36% / 34% | 41% / 52% | 94.5 | late | early |
| 1 | 1–13 | 19% / 10% | 36% / 29% | 44% / 61% | 106.9 | late | early |
| 2 | 1–13 | 17% / 10% | 41% / 40% | 41% / 50% | 49.0 | late | early |
| all | 1–13 | 19% / 10% | 38% / 32% | 43% / 57% | 156.0 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.0 | 7.9 | 8.1 | 7.7 | 6.1 | 6.5 | 6.6 | 5.6 | 6.3 | 5.3 | 2.0 | 3.9 | 4.0 |
| launches read | 648 | 680 | 857 | 869 | 878 | 969 | 1083 | 1183 | 1303 | 1433 | 168 | 456 | 504 |

Slope over waves 1–10: -0.42 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.50 | 2.50 | 3.00 |
| runs that reached it | 2 | 2 | 1 |
| tough, every run | 1.21 | 3.54 | 3.33 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 22 | 17 | 13 | 7 | 4 | 2 | 2 | 1 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.5** | **0.4** | **0.3** | **0.5** | **0.5** | **0.5** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.4 | 0.5 | 0.2 | 0.4 | 0.5 | 0.3 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.15 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.04 | 0.00 | 0.04 | 0.00 | 0.08 | 0.00 | 0.29 | 0.23 | 0.29 | 0.25 | 0.50 | 0.00 | 0.00 |
| runs with no save | 96% | 100% | 96% | 96% | 92% | 91% | 71% | 69% | 86% | 75% | 50% | 50% | 100% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.05 | 0.24 | 0.15 | 0.00 | 0.25 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.06 | 0.08 | 0.00 | 0.00 | 0.50 | 0.50 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.06 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.04 | 0.00 | 0.04 | 0.00 | 0.08 | 0.09 | 0.12 | 0.15 | 0.29 | 0.25 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.51 | 0.46 | 1.05 | 0.87 | 1.11 | 1.14 | 1.36 | 1.59 | 1.25 | 2.24 | 1.40 | 1.85 | 2.31 |
| peaks | 0.2 | 0.1 | 0.8 | 0.9 | 0.8 | 1.1 | 0.8 | 1.1 | 1.6 | 1.0 | 2.0 | 2.0 | 3.0 |
| release after a peak (s) | 0.4 | 0.1 | 1.6 | 1.2 | 1.4 | 1.4 | 1.7 | 1.7 | 1.6 | 2.8 | 2.0 | 1.5 | 2.3 |
| hot share | 1% | 0% | 5% | 3% | 4% | 6% | 8% | 10% | 11% | 8% | 20% | 22% | 21% |
| calm share | 86% | 84% | 75% | 80% | 74% | 69% | 67% | 68% | 63% | 61% | 69% | 63% | 61% |
| shape (most runs) | flat 79% | flat 92% | flat 42% | flat 42% | one peak 46% | one peak 41% | one peak 47% | one peak 46% | flat 29% | one peak 100% | sawtooth 100% | sawtooth rising 50% | sawtooth 100% |
| taps follow tension (r) | 0.30 | 0.33 | 0.39 | 0.32 | 0.36 | 0.33 | 0.29 | 0.37 | 0.36 | 0.21 | 0.71 | 0.58 | 0.68 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9. 24 runs, 122 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, aegis, bomberWing | 4% | 7.6 | 5.8 | 16.8 | 1.50 (2) / 2.50 (2) / 3.00 (1) | 0.0 0.1 0.5 0.4 1.3 1.7 1.3 2.9 4.1 4.5 |
| off-counter | tesla, grapnel, fullSteam | 4% | 8.1 | 5.8 | 13.1 | 0.67 (3) / 4.00 (3) / 3.00 (1) | 0.0 0.1 0.7 0.5 1.0 1.5 1.0 2.2 2.6 3.6 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
