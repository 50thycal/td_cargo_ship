# Bot report: The Black Strait (`lantern`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.45; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=lantern --seeds=24 --armory=player --kits=plan`. Heat map: `tools/v3/map-report/results/lantern-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w7 +0.63; doubles on w7 (0.38→1.00) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 1.63 a run (75% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w6 ×0.85 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 41%, cold early 21% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 12.0 s → w10 5.3 s (slope -0.56 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.46 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.35 (17), r2 1.35 (17), r3 1.63 (16); tough (every run): 0.46, 1.63, 2.13 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 3.7 lost 1–10, end 13.1; off-counter 5.8 lost 1–10, end 12.1 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 7 loses 1.00 after 0.38. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.33 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 21%, middle 38%, late 41%.

## Ships lost per wave

Normal: won 54%, mean end wave 12.3 (14 = won), 4.1 lost in waves 1–10, 0.46 in waves 1–5. Tough: 5.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.13 | 0.00 | 0.21 | 0.13 | 0.38 | 1.00 | 0.83 | 1.00 | 1.33 | 0.46 | 1.63 | 2.13 |
| normal, runs that reached it | 0.00 | 0.13 | 0.00 | 0.21 | 0.13 | 0.38 | 0.83 | 0.74 | 0.90 | 1.10 | 0.35 | 1.35 | 1.63 |
| normal, mean over all runs | 0.00 | 0.13 | 0.00 | 0.21 | 0.13 | 0.38 | 0.83 | 0.71 | 0.79 | 0.92 | 0.25 | 0.96 | 1.08 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 21 | 20 | 17 | 17 | 16 |

Biggest one-wave step up (tough, waves 2–10): wave 7, +0.63.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.2 | 1.8 | 1.8 | 1.9 | 1.8 | 1.7 | 1.9 | 2.0 | 1.8 | 1.8 | 2.2 | 3.6 | 3.3 |
| kills a minute | 52 | 42 | 51 | 44 | 42 | 42 | 39 | 41 | 46 | 40 | 48 | 61 | 57 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 0.8 | 2.0 | 1.6 | 1.8 | 2.5 | 1.8 | 2.8 | 3.6 | 5.8 | 0.2 | 0.5 | 0.5 |
| runs with ≥ 1 | 4% | 46% | 83% | 75% | 83% | 83% | 71% | 96% | 92% | 100% | 21% | 42% | 25% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.3 | 24.7 | 33.0 | 33.3 | 35.1 | 35.0 | 39.3 | 43.9 | 48.6 | 57.0 |
| launches (encounters off) | 23.0 | 26.5 | 35.0 | 36.9 | 40.5 | 41.1 | 45.6 | 49.0 | 54.1 | 65.0 |
| **ratio to encounters off** | 1.05 | 0.93 | 0.94 | 0.90 | 0.87 | 0.85 | 0.86 | 0.90 | 0.90 | 0.88 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.05 | 0.80 | 0.85 | 0.76 | 0.76 | 0.66 | 0.63 | 0.65 | 0.62 | 0.61 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 21% / 11% | 38% / 34% | 41% / 55% | 66.6 | late | early |
| all | 1–9 | 21% / 11% | 38% / 34% | 41% / 55% | 66.6 | late | early |
| 1 | 1–13 | 23% / 19% | 37% / 37% | 40% / 45% | 135.4 | late | early |
| all | 1–13 | 23% / 19% | 37% / 37% | 40% / 45% | 135.4 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 12.0 | 9.1 | 7.9 | 7.6 | 7.4 | 5.8 | 6.2 | 6.0 | 6.9 | 5.3 | 6.1 | 5.6 | 5.4 |
| launches read | 672 | 681 | 842 | 834 | 871 | 873 | 936 | 1048 | 1159 | 1367 | 480 | 523 | 550 |

Slope over waves 1–10: -0.56 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.35 | 1.35 | 1.63 |
| runs that reached it | 17 | 17 | 16 |
| tough, every run | 0.46 | 1.63 | 2.13 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 21 | 20 | 17 | 17 | 16 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.1** | **0.3** | **0.1** | **0.1** | **0.2** | **0.1** | **0.6** | **0.1** | **0.1** | **0.3** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.1 | 0.2 | 0.1 | 0.1 | 0.2 | 0.1 | 0.4 | 0.0 | 0.1 | 0.3 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.10 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.08 | 0.08 | 0.13 | 0.04 | 0.09 | 0.10 | 0.40 | 0.06 | 0.12 | 0.25 |
| runs with no save | 100% | 96% | 96% | 92% | 83% | 88% | 88% | 83% | 90% | 70% | 94% | 88% | 75% |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.08 | 0.04 | 0.05 | 0.15 | 0.06 | 0.12 | 0.25 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.04 | 0.10 | 0.15 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.04 | 0.04 | 0.08 | 0.17 | 0.04 | 0.00 | 0.09 | 0.00 | 0.20 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.19 | 0.35 | 0.79 | 0.50 | 0.71 | 0.67 | 0.70 | 0.87 | 0.83 | 1.02 | 0.33 | 0.55 | 0.60 |
| peaks | 0.0 | 0.0 | 0.6 | 0.1 | 0.5 | 0.3 | 0.4 | 0.6 | 0.7 | 1.1 | 0.0 | 0.2 | 0.2 |
| release after a peak (s) | 0.0 | 0.0 | 1.4 | 0.1 | 1.0 | 0.5 | 0.8 | 0.7 | 1.1 | 1.7 | 0.0 | 0.5 | 0.2 |
| hot share | 0% | 0% | 3% | 0% | 2% | 1% | 1% | 3% | 2% | 4% | 0% | 2% | 1% |
| calm share | 98% | 93% | 87% | 86% | 85% | 81% | 79% | 78% | 80% | 74% | 95% | 74% | 82% |
| shape (most runs) | flat 100% | flat 100% | one peak 62% | flat 92% | flat 50% | flat 75% | flat 62% | flat 61% | flat 48% | one peak 35% | flat 100% | flat 82% | flat 81% |
| taps follow tension (r) | 0.39 | 0.37 | 0.36 | 0.45 | 0.44 | 0.39 | 0.42 | 0.39 | 0.42 | 0.45 | 0.53 | 0.47 | 0.35 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9. 24 runs, 187 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | scatter, gunships, shield | 75% | 13.1 | 3.4 | 3.7 | 0.25 (20) / 0.55 (20) / 1.30 (20) | 0.0 0.1 0.0 0.2 0.1 0.3 0.4 0.6 0.8 1.3 |
| off-counter | seeker, tesla, fullSteam | 58% | 12.1 | 4.5 | 5.8 | 0.27 (15) / 0.40 (15) / 1.47 (15) | 0.0 0.1 0.0 0.2 0.3 0.5 1.0 0.7 1.3 1.8 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
