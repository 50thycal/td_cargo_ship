# Bot report: The Gauntlet (`gauntlet`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.75; built 2026-11-18.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=gauntlet --seeds=24 --kits=plan --armory=player --fun-placebo`. Heat map: `tools/v3/map-report/results/gauntlet-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +0.83; doubles on w6 (0.17→0.54) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 3.29 a run (92% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w8 ×0.90 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot early 43%, cold late 23%; lane 2: hot early 48%, cold late 17% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 7.1 s → w10 3.3 s (slope -0.44 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.58 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.67 (12), r2 0.67 (12), r3 1.33 (12); tough (every run): 0.63, 0.75, 1.29 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 5.8 lost 1–10, end 11.3; counter 6.2 lost 1–10, end 11.6 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 6 loses 0.54 after 0.17. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.92 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 46%, middle 35%, late 20%.

## Ships lost per wave

Normal: won 50%, mean end wave 11.7 (14 = won), 4.5 lost in waves 1–10, 0.58 in waves 1–5. Tough: 5.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.33 | 0.08 | 0.17 | 0.54 | 0.79 | 0.58 | 1.08 | 1.92 | 0.63 | 0.75 | 1.29 |
| normal, runs that reached it | 0.00 | 0.00 | 0.33 | 0.08 | 0.17 | 0.54 | 0.79 | 0.46 | 0.91 | 1.72 | 0.67 | 0.67 | 1.33 |
| normal, mean over all runs | 0.00 | 0.00 | 0.33 | 0.08 | 0.17 | 0.54 | 0.79 | 0.46 | 0.83 | 1.29 | 0.33 | 0.33 | 0.67 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 18 | 12 | 12 | 12 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +0.83.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 0.3 | 3.3 | 3.4 | 3.5 | 4.7 | 5.2 | 6.2 | 6.1 | 7.7 | 0.4 | 1.0 | 0.5 |
| runs with ≥ 1 | 33% | 25% | 92% | 92% | 100% | 100% | 100% | 100% | 100% | 100% | 38% | 71% | 42% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 12.0 | 11.5 | 23.5 | 17.6 | 20.5 | 25.1 | 29.5 | 30.7 | 40.4 | 41.3 |
| launches (encounters off) | 12.0 | 11.4 | 22.3 | 17.4 | 20.3 | 26.1 | 32.5 | 34.0 | 40.3 | 44.4 |
| **ratio to encounters off** | 1.00 | 1.01 | 1.05 | 1.01 | 1.01 | 0.96 | 0.91 | 0.90 | 1.00 | 0.93 |
| table × scale | 12 | 16 | 21 | 24 | 25 | 27 | 32 | 36 | 41 | 49 |
| ratio to table × scale | 1.00 | 0.72 | 1.12 | 0.73 | 0.82 | 0.93 | 0.92 | 0.85 | 0.98 | 0.84 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 43% / 64% | 34% / 21% | 23% / 15% | 26.9 | early | late |
| 2 | 1–9 | 48% / 55% | 36% / 28% | 17% / 17% | 30.0 | early | late |
| all | 1–9 | 46% / 59% | 35% / 24% | 20% / 16% | 57.0 | early | late |
| 1 | 1–13 | 36% / 36% | 37% / 35% | 26% / 29% | 53.0 | middle | late |
| 2 | 1–13 | 38% / 36% | 37% / 41% | 24% / 24% | 57.7 | early | late |
| all | 1–13 | 37% / 36% | 37% / 38% | 25% / 27% | 110.7 | early | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.1 | 7.6 | 5.7 | 4.4 | 4.2 | 3.8 | 3.7 | 3.7 | 4.0 | 3.3 | 7.4 | 6.7 | 7.4 |
| launches read | 288 | 275 | 561 | 422 | 491 | 601 | 707 | 734 | 965 | 988 | 264 | 383 | 335 |

Slope over waves 1–10: -0.44 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.67 | 0.67 | 1.33 |
| runs that reached it | 12 | 12 | 12 |
| tough, every run | 0.63 | 0.75 | 1.29 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 18 | 12 | 12 | 12 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.0** | **0.1** | **0.2** | **0.3** | **0.4** | **0.2** | **0.2** | **0.5** | **0.5** | **0.3** |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.0 | 0.1 | 0.1 | 0.3 | 0.3 | 0.1 | 0.2 | 0.3 | 0.4 | 0.2 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.17 | 0.25 | 0.29 | 0.14 | 0.11 | 0.33 | 0.42 | 0.25 |
| runs with no save | 100% | 100% | 92% | 100% | 88% | 83% | 71% | 67% | 86% | 78% | 67% | 67% | 75% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.17 | 0.13 | 0.18 | 0.06 | 0.33 | 0.25 | 0.08 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.13 | 0.00 | 0.11 | 0.08 | 0.17 | 0.17 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.08 | 0.00 | 0.06 | 0.00 | 0.08 | 0.08 |
|   kill save | 0.00 | 0.00 | 0.08 | 0.00 | 0.08 | 0.04 | 0.08 | 0.04 | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 |
| noise floor (placebo) | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.08 | 0.13 | 0.09 | 0.06 | 0.25 | 0.17 | 0.08 |
| tension peak | 0.19 | 0.19 | 0.81 | 0.85 | 0.93 | 1.07 | 1.02 | 1.03 | 1.16 | 1.88 | 0.69 | 0.74 | 0.90 |
| peaks | 0.0 | 0.0 | 0.5 | 0.8 | 0.8 | 0.8 | 0.9 | 1.1 | 1.2 | 1.8 | 0.4 | 0.3 | 0.7 |
| release after a peak (s) | 0.0 | 0.0 | 1.0 | 1.3 | 1.8 | 1.9 | 2.0 | 1.7 | 1.5 | 2.6 | 1.3 | 1.7 | 2.3 |
| hot share | 0% | 0% | 2% | 2% | 3% | 4% | 4% | 5% | 5% | 7% | 5% | 3% | 9% |
| calm share | 97% | 98% | 81% | 84% | 79% | 80% | 75% | 73% | 74% | 71% | 63% | 56% | 62% |
| shape (most runs) | flat 100% | flat 100% | flat 54% | one peak 58% | one peak 67% | one peak 67% | one peak 58% | one peak 46% | one peak 36% | sawtooth rising 44% | flat 58% | flat 67% | one peak 67% |
| taps follow tension (r) | 0.54 | 0.40 | 0.49 | 0.52 | 0.47 | 0.47 | 0.45 | 0.43 | 0.43 | 0.40 | 0.26 | 0.25 | 0.17 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 150 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | shrapnel, thermo, flak | 50% | 11.6 | 5.0 | 6.2 | 0.67 (12) / 0.58 (12) / 0.50 (12) | 0.0 0.0 0.2 0.0 0.2 0.5 0.8 1.0 1.2 2.2 |
| off-counter | aegis, seeker, droneScreen | 33% | 11.3 | 4.8 | 5.8 | 0.80 (10) / 1.30 (10) / 1.30 (10) | 0.0 0.0 0.2 0.1 0.3 0.6 0.7 0.8 1.2 1.8 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
