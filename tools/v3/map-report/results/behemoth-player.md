# Bot report: The Behemoth Run (`behemoth`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.15; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=behemoth --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/behemoth-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +0.75; doubles on w6 (0.17→0.54) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 3.54 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.88 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 46%, cold early 21%; lane 2: hot late 44%, cold early 18% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 10.2 s → w10 5.2 s (slope -0.42 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.54 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.39 (18), r2 0.72 (18), r3 2.00 (18); tough (every run): 0.67, 1.00, 2.08 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 5.0 lost 1–10, end 12.5; off-counter 5.5 lost 1–10, end 12.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 6 loses 0.54 after 0.17. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.54 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 19%, middle 41%, late 41%.

## Ships lost per wave

Normal: won 54%, mean end wave 12.4 (14 = won), 3.8 lost in waves 1–10, 0.54 in waves 1–5. Tough: 5.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.13 | 0.08 | 0.17 | 0.17 | 0.54 | 0.71 | 1.33 | 0.79 | 1.54 | 0.67 | 1.00 | 2.08 |
| normal, runs that reached it | 0.00 | 0.13 | 0.08 | 0.17 | 0.17 | 0.21 | 0.39 | 1.22 | 0.52 | 1.25 | 0.39 | 0.72 | 2.00 |
| normal, mean over all runs | 0.00 | 0.13 | 0.08 | 0.17 | 0.17 | 0.21 | 0.38 | 1.17 | 0.46 | 1.04 | 0.29 | 0.54 | 1.50 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 21 | 20 | 18 | 18 | 18 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +0.75.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 1.0 | 3.5 | 4.6 | 6.1 | 5.1 | 3.6 | 5.0 | 5.5 | 6.5 | 0.1 | 0.5 | 0.3 |
| runs with ≥ 1 | 8% | 67% | 100% | 100% | 100% | 96% | 92% | 100% | 100% | 100% | 8% | 38% | 25% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 18.0 | 20.1 | 28.4 | 29.2 | 31.8 | 32.1 | 37.8 | 43.4 | 48.7 | 58.9 |
| launches (encounters off) | 18.0 | 19.9 | 28.7 | 29.8 | 31.9 | 34.1 | 43.0 | 47.0 | 52.1 | 62.5 |
| **ratio to encounters off** | 1.00 | 1.01 | 0.99 | 0.98 | 1.00 | 0.94 | 0.88 | 0.92 | 0.93 | 0.94 |
| table × scale | 18 | 24 | 31 | 36 | 37 | 42 | 50 | 54 | 62 | 75 |
| ratio to table × scale | 1.00 | 0.84 | 0.92 | 0.81 | 0.86 | 0.76 | 0.76 | 0.80 | 0.79 | 0.79 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 21% / 8% | 46% / 42% | 33% / 50% | 17.0 | middle | early |
| 2 | 1–9 | 18% / 17% | 38% / 28% | 44% / 55% | 37.2 | late | early |
| all | 1–9 | 19% / 16% | 41% / 30% | 41% / 54% | 54.2 | middle | early |
| 1 | 1–13 | 26% / 13% | 42% / 42% | 32% / 45% | 32.0 | middle | early |
| 2 | 1–13 | 20% / 16% | 41% / 31% | 39% / 52% | 79.7 | middle | early |
| all | 1–13 | 22% / 16% | 41% / 33% | 37% / 51% | 111.7 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.2 | 8.0 | 6.5 | 5.7 | 4.6 | 5.2 | 5.9 | 5.2 | 5.3 | 5.2 | 2.3 | 2.5 | 2.3 |
| launches read | 432 | 479 | 680 | 696 | 759 | 766 | 897 | 1032 | 1164 | 1396 | 212 | 310 | 371 |

Slope over waves 1–10: -0.42 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.39 | 0.72 | 2.00 |
| runs that reached it | 18 | 18 | 18 |
| tough, every run | 0.67 | 1.00 | 2.08 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 21 | 20 | 18 | 18 | 18 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.0** | **0.3** | **0.4** | **0.1** | **0.0** | **0.2** | **0.3** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.2 | 0.3 | 0.1 | 0.0 | 0.1 | 0.4 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.00 | 0.00 | 0.00 | 0.00 | 0.11 |
| clutch | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.22 | 0.38 | 0.10 | 0.00 | 0.06 | 0.33 |
| runs with no save | 100% | 96% | 100% | 100% | 100% | 92% | 96% | 83% | 62% | 90% | 100% | 83% | 78% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.22 | 0.10 | 0.10 | 0.00 | 0.00 | 0.11 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.14 | 0.00 | 0.00 | 0.00 | 0.11 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.14 | 0.00 | 0.00 | 0.17 | 0.06 |
|   kill save | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.05 | 0.00 | 0.00 | 0.00 | 0.06 |
| tension peak | 0.10 | 0.28 | 0.53 | 0.73 | 0.87 | 0.70 | 0.83 | 1.05 | 1.15 | 1.32 | 0.23 | 0.47 | 0.59 |
| peaks | 0.0 | 0.1 | 0.1 | 0.5 | 0.7 | 0.5 | 0.7 | 1.0 | 1.3 | 1.7 | 0.0 | 0.1 | 0.2 |
| release after a peak (s) | 0.0 | 0.1 | 0.4 | 0.7 | 1.4 | 0.6 | 1.0 | 2.3 | 2.8 | 1.9 | 0.0 | 0.1 | 0.4 |
| hot share | 0% | 0% | 1% | 2% | 3% | 2% | 2% | 5% | 7% | 5% | 0% | 0% | 3% |
| calm share | 100% | 95% | 85% | 80% | 75% | 81% | 82% | 74% | 72% | 74% | 97% | 90% | 80% |
| shape (most runs) | flat 100% | flat 96% | flat 87% | flat 58% | one peak 46% | flat 58% | flat 52% | one peak 57% | one peak 43% | one peak 40% | flat 100% | flat 89% | flat 83% |
| taps follow tension (r) | 0.44 | 0.42 | 0.28 | 0.35 | 0.40 | 0.38 | 0.33 | 0.33 | 0.35 | 0.35 | 0.50 | 0.29 | 0.28 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 271 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | shield, frigate, airstrike | 50% | 12.5 | 3.5 | 5.0 | 0.74 (19) / 0.89 (19) / 1.83 (18) | 0.0 0.1 0.1 0.2 0.1 0.5 0.5 1.0 1.3 1.3 |
| off-counter | scatter, tesla, seeker | 50% | 12.5 | 3.5 | 5.5 | 0.61 (18) / 1.44 (18) / 1.50 (18) | 0.0 0.1 0.1 0.1 0.2 0.6 0.9 0.8 0.9 1.9 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
