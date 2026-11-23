# Bot report: The Kesh Hook (`kesh`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.8; built 2026-11-19.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=kesh --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/kesh-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +1.29; doubles on w6 (0.29→0.63), w8 (0.63→1.92) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 2.83 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.89 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 44%, cold late 24% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 12.1 s → w10 3.7 s (slope -0.82 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.00 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.00 (3), r2 5.00 (3), r3 – (0); tough (every run): 2.63, 6.04, 4.63 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 7.2 lost 1–10, end 9.4; off-counter 8.1 lost 1–10, end 9.3 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 6 loses 0.63 after 0.29; wave 8 loses 1.92 after 0.63. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (3.08 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 32%, middle 44%, late 24%.

## Ships lost per wave

Normal: won 0%, mean end wave 9.4 (14 = won), 5.5 lost in waves 1–10, 1.00 in waves 1–5, 0.04 in bonus waves. Tough: 9.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.50 | 0.21 | 0.29 | 0.63 | 0.63 | 1.92 | 2.00 | 3.08 | 2.63 | 6.04 | 4.63 |
| normal, runs that reached it | 0.00 | 0.00 | 0.50 | 0.21 | 0.29 | 0.63 | 0.54 | 1.78 | 1.42 | 1.44 | 1.00 | 5.00 | – |
| normal, mean over all runs | 0.00 | 0.00 | 0.50 | 0.21 | 0.29 | 0.63 | 0.54 | 1.71 | 1.13 | 0.54 | 0.13 | 0.63 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 19 | 9 | 3 | 3 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +1.29.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 0.9 | 2.8 | 3.0 | 4.3 | 5.0 | 5.6 | 6.4 | 8.0 | 6.9 | 4.0 | 3.3 | 4.3 |
| runs with ≥ 1 | 0% | 58% | 96% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 96% | 100% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 13.0 | 15.6 | 21.3 | 22.1 | 24.9 | 24.9 | 26.4 | 33.3 | 32.5 | 39.8 |
| launches (encounters off) | 13.0 | 16.4 | 20.0 | 20.2 | 23.4 | 23.3 | 29.8 | 32.3 | 33.1 | 41.2 |
| **ratio to encounters off** | 1.00 | 0.95 | 1.06 | 1.10 | 1.06 | 1.07 | 0.89 | 1.03 | 0.98 | 0.97 |
| table × scale | 13 | 17 | 22 | 25 | 26 | 30 | 35 | 38 | 43 | 52 |
| ratio to table × scale | 1.00 | 0.92 | 0.97 | 0.89 | 0.96 | 0.83 | 0.75 | 0.88 | 0.75 | 0.77 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 32% / 14% | 44% / 57% | 24% / 28% | 57.9 | middle | late |
| all | 1–9 | 32% / 14% | 44% / 57% | 24% / 28% | 57.9 | middle | late |
| 1 | 1–13 | 27% / 15% | 46% / 55% | 26% / 30% | 125.4 | middle | late |
| all | 1–13 | 27% / 15% | 46% / 55% | 26% / 30% | 125.4 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 12.1 | 10.3 | 4.0 | 4.2 | 4.0 | 2.5 | 3.4 | 3.7 | 2.4 | 3.7 | 5.9 | 6.3 | 6.8 |
| launches read | 312 | 375 | 511 | 529 | 596 | 595 | 632 | 796 | 777 | 954 | 932 | 933 | 1147 |

Slope over waves 1–10: -0.82 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.00 | 5.00 | – |
| runs that reached it | 3 | 3 | 0 |
| tough, every run | 2.63 | 6.04 | 4.63 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 19 | 9 | 3 | 3 | 0 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.0** | **0.2** | **0.2** | **0.5** | **0.4** | **0.4** | **0.1** | **0.0** | **0.3** | – |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.0 | 0.1 | 0.1 | 0.4 | 0.3 | 0.3 | 0.1 | 0.0 | 0.2 | – |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.17 | 0.11 | 0.11 | 0.00 | 0.00 | – |
| clutch | 0.00 | 0.00 | 0.04 | 0.00 | 0.08 | 0.08 | 0.33 | 0.22 | 0.21 | 0.11 | 0.00 | 0.33 | – |
| runs with no save | 100% | 100% | 88% | 100% | 83% | 88% | 58% | 61% | 68% | 89% | 100% | 67% | – |
|   pickup save | 0.00 | 0.00 | 0.04 | 0.00 | 0.08 | 0.04 | 0.00 | 0.09 | 0.05 | 0.11 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.17 | 0.09 | 0.11 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.13 | 0.04 | 0.11 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.04 | 0.00 | 0.08 | 0.04 | 0.17 | 0.22 | 0.16 | 0.00 | 0.00 | 0.33 | 0.00 |
| tension peak | 0.05 | 0.49 | 1.73 | 1.54 | 1.30 | 1.31 | 0.88 | 1.37 | 1.34 | 1.84 | 1.27 | 2.90 | – |
| peaks | 0.0 | 0.1 | 1.1 | 1.0 | 1.0 | 1.2 | 0.8 | 1.3 | 0.8 | 1.8 | 1.3 | 1.0 | – |
| release after a peak (s) | 0.0 | 0.3 | 2.7 | 1.9 | 2.0 | 1.8 | 1.1 | 2.0 | 2.7 | 1.8 | 2.7 | 4.0 | – |
| hot share | 0% | 1% | 7% | 5% | 5% | 5% | 2% | 6% | 5% | 8% | 17% | 63% | – |
| calm share | 100% | 90% | 80% | 88% | 78% | 79% | 80% | 72% | 73% | 75% | 53% | 26% | – |
| shape (most runs) | flat 100% | flat 87% | one peak 83% | one peak 79% | one peak 62% | one peak 50% | flat 46% | one peak 48% | one peak 53% | one peak 56% | one peak 67% | pinned 100% | – |
| taps follow tension (r) | 0.47 | 0.44 | 0.57 | 0.52 | 0.53 | 0.46 | 0.43 | 0.41 | 0.48 | 0.42 | 0.56 | 0.37 | – |

saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 131 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | overdrive, railgun, focus | 0% | 9.4 | 5.1 | 7.2 | 3.86 (7) / 3.50 (4) / 1.00 (1) | 0.0 0.0 0.4 0.1 0.2 1.1 1.1 1.4 1.3 1.6 |
| off-counter | airstrike, seeker, droneScreen | 0% | 9.3 | 5.5 | 8.1 | 2.25 (4) / 3.75 (4) / – (0) | 0.0 0.0 0.5 0.1 0.3 0.9 1.0 1.5 1.8 2.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
