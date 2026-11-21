# Bot report: Sowers' Reach (`sowers`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.45; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=sowers --seeds=24 --armory=player --kits=plan`. Heat map: `tools/v3/map-report/results/sowers-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.92; doubles on w9 (0.42→1.33) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 1.50 a run (92% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.90 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 46%, cold early 18% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.8 s → w10 5.1 s (slope -0.39 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.50 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.75 (16), r2 1.06 (16), r3 1.75 (16); tough (every run): 0.75, 1.33, 2.04 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 3.8 lost 1–10, end 12.6; off-counter 4.8 lost 1–10, end 12.4 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 9 loses 1.33 after 0.42. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (1.33 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 18%, middle 46%, late 35%.

## Ships lost per wave

Normal: won 54%, mean end wave 12.2 (14 = won), 3.3 lost in waves 1–10, 0.50 in waves 1–5, 0.08 in bonus waves. Tough: 4.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.17 | 0.08 | 0.17 | 0.46 | 0.38 | 0.42 | 1.33 | 1.17 | 0.75 | 1.33 | 2.04 |
| normal, runs that reached it | 0.00 | 0.08 | 0.17 | 0.08 | 0.17 | 0.46 | 0.39 | 0.43 | 1.04 | 0.68 | 0.75 | 1.06 | 1.75 |
| normal, mean over all runs | 0.00 | 0.08 | 0.17 | 0.08 | 0.17 | 0.46 | 0.38 | 0.42 | 1.00 | 0.54 | 0.50 | 0.71 | 1.17 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 19 | 16 | 16 | 16 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.92.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.1 | 2.3 | 2.0 | 1.9 | 2.0 | 2.5 | 2.1 | 2.3 | 2.9 | 2.0 | 3.2 | 3.7 | 6.1 |
| kills a minute | 54 | 53 | 51 | 50 | 49 | 53 | 47 | 49 | 49 | 47 | 44 | 57 | 63 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 1.0 | 1.8 | 1.5 | 2.4 | 1.8 | 2.7 | 2.4 | 3.2 | 5.5 | 1.4 | 1.0 | 0.8 |
| runs with ≥ 1 | 4% | 58% | 92% | 92% | 92% | 71% | 92% | 83% | 83% | 96% | 63% | 54% | 50% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.3 | 31.3 | 34.8 | 39.5 | 38.0 | 43.3 | 44.0 | 47.7 | 53.7 | 61.7 |
| launches (encounters off) | 25.0 | 29.8 | 38.0 | 37.6 | 40.3 | 43.4 | 49.1 | 52.7 | 57.8 | 67.2 |
| **ratio to encounters off** | 0.97 | 1.05 | 0.92 | 1.05 | 0.94 | 1.00 | 0.90 | 0.91 | 0.93 | 0.92 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.05 | 1.01 | 0.89 | 0.90 | 0.83 | 0.82 | 0.71 | 0.70 | 0.69 | 0.66 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 18% / 18% | 46% / 55% | 35% / 27% | 39.7 | middle | early |
| all | 1–9 | 18% / 18% | 46% / 55% | 35% / 27% | 39.7 | middle | early |
| 1 | 1–13 | 17% / 14% | 38% / 39% | 45% / 46% | 72.8 | late | early |
| all | 1–13 | 17% / 14% | 38% / 39% | 45% / 46% | 72.8 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.8 | 8.3 | 7.7 | 7.2 | 7.3 | 5.4 | 6.3 | 6.0 | 5.8 | 5.1 | 1.7 | 1.6 | 1.6 |
| launches read | 600 | 743 | 818 | 832 | 825 | 851 | 869 | 1022 | 1094 | 1250 | 240 | 312 | 336 |

Slope over waves 1–10: -0.39 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.75 | 1.06 | 1.75 |
| runs that reached it | 16 | 16 | 16 |
| tough, every run | 0.75 | 1.33 | 2.04 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 19 | 16 | 16 | 16 |
| **saves a run** | **0.0** | **0.1** | **0.0** | **0.1** | **0.0** | **0.2** | **0.0** | **0.2** | **0.3** | **0.2** | **0.4** | **0.5** | **0.6** |
| ships saved a run | 0.0 | 0.1 | 0.0 | 0.1 | 0.0 | 0.1 | 0.0 | 0.1 | 0.2 | 0.2 | 0.3 | 0.3 | 0.4 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.06 |
| clutch | 0.00 | 0.08 | 0.00 | 0.08 | 0.00 | 0.08 | 0.00 | 0.09 | 0.13 | 0.16 | 0.31 | 0.44 | 0.50 |
| runs with no save | 96% | 88% | 100% | 92% | 100% | 83% | 96% | 87% | 74% | 84% | 75% | 69% | 56% |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.08 | 0.00 | 0.04 | 0.00 | 0.08 | 0.00 | 0.09 | 0.13 | 0.05 | 0.38 | 0.19 | 0.50 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.11 | 0.00 | 0.13 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.00 | 0.06 | 0.13 | 0.06 |
|   kill save | 0.04 | 0.04 | 0.00 | 0.04 | 0.00 | 0.04 | 0.04 | 0.04 | 0.04 | 0.05 | 0.00 | 0.06 | 0.00 |
| tension peak | 0.15 | 0.47 | 0.50 | 0.35 | 0.50 | 0.56 | 0.60 | 0.69 | 1.06 | 1.06 | 0.85 | 0.81 | 0.96 |
| peaks | 0.0 | 0.2 | 0.0 | 0.0 | 0.1 | 0.3 | 0.3 | 0.4 | 0.9 | 1.1 | 0.6 | 0.7 | 1.1 |
| release after a peak (s) | 0.0 | 0.4 | 0.1 | 0.0 | 0.1 | 0.9 | 0.6 | 0.8 | 1.5 | 2.3 | 1.2 | 1.4 | 3.7 |
| hot share | 0% | 1% | 0% | 0% | 0% | 1% | 1% | 2% | 5% | 3% | 3% | 3% | 8% |
| calm share | 99% | 90% | 90% | 92% | 87% | 83% | 80% | 80% | 72% | 78% | 63% | 56% | 47% |
| shape (most runs) | flat 100% | flat 83% | flat 96% | flat 100% | flat 92% | flat 71% | flat 83% | flat 65% | one peak 57% | one peak 58% | one peak 56% | one peak 56% | one peak 88% |
| taps follow tension (r) | 0.44 | 0.43 | 0.28 | 0.44 | 0.37 | 0.40 | 0.39 | 0.44 | 0.40 | 0.39 | 0.41 | 0.22 | 0.27 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 183 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | tesla, flak, shield | 58% | 12.6 | 3.4 | 3.8 | 0.56 (18) / 1.22 (18) / 2.17 (18) | 0.0 0.1 0.2 0.1 0.1 0.6 0.2 0.7 0.8 1.1 |
| off-counter | seeker, shrapnel, fullSteam | 63% | 12.4 | 3.7 | 4.8 | 0.72 (18) / 1.11 (18) / 2.29 (17) | 0.0 0.0 0.1 0.1 0.2 0.5 0.7 0.8 1.6 0.8 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
