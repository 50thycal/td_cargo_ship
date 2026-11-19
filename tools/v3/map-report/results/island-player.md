# Bot report: The Island (`island`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1; built 2026-11-19.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=island --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/island-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.46; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w5 4.54 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w2 ×0.87 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 42%, cold early 28%; lane 2: hot middle 53%, cold late 17% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 7.3 s → w10 3.1 s (slope -0.40 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.88 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.28 (18), r2 1.71 (17), r3 1.64 (14); tough (every run): 1.29, 2.25, 1.83 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.6; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 4.6 lost 1–10, end 12.1; off-counter 6.0 lost 1–10, end 11.7 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- No safe stretch on lane 1 (coldest early takes 28%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (1.21 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 29%, middle 46%, late 25%.

## Ships lost per wave

Normal: won 50%, mean end wave 12.2 (14 = won), 3.9 lost in waves 1–10, 0.88 in waves 1–5. Tough: 4.6 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.13 | 0.21 | 0.33 | 0.21 | 0.13 | 0.50 | 0.75 | 1.21 | 1.13 | 1.29 | 2.25 | 1.83 |
| normal, runs that reached it | 0.00 | 0.13 | 0.21 | 0.33 | 0.22 | 0.13 | 0.43 | 0.74 | 1.13 | 0.80 | 1.28 | 1.71 | 1.64 |
| normal, mean over all runs | 0.00 | 0.13 | 0.21 | 0.33 | 0.21 | 0.13 | 0.42 | 0.71 | 1.08 | 0.67 | 0.96 | 1.21 | 0.96 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 23 | 23 | 20 | 18 | 17 | 14 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.46.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.4 | 0.8 | 4.7 | 5.0 | 4.5 | 5.1 | 6.2 | 5.5 | 6.7 | 8.5 | 2.7 | 3.0 | 3.4 |
| runs with ≥ 1 | 38% | 46% | 100% | 96% | 96% | 96% | 100% | 100% | 100% | 100% | 96% | 92% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 16.0 | 14.8 | 24.1 | 24.4 | 25.8 | 27.0 | 30.4 | 32.0 | 36.9 | 42.2 |
| launches (encounters off) | 16.0 | 16.9 | 24.9 | 24.0 | 25.1 | 30.7 | 31.7 | 36.3 | 41.1 | 48.2 |
| **ratio to encounters off** | 1.00 | 0.87 | 0.97 | 1.02 | 1.03 | 0.88 | 0.96 | 0.88 | 0.90 | 0.88 |
| table × scale | 16 | 21 | 27 | 31 | 32 | 37 | 43 | 47 | 54 | 65 |
| ratio to table × scale | 1.00 | 0.70 | 0.89 | 0.79 | 0.81 | 0.73 | 0.71 | 0.68 | 0.68 | 0.65 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 28% / 22% | 42% / 41% | 30% / 36% | 31.5 | middle | early |
| 2 | 1–9 | 30% / 24% | 53% / 72% | 17% / 4% | 16.9 | middle | late |
| all | 1–9 | 29% / 23% | 46% / 51% | 25% / 27% | 48.4 | middle | late |
| 1 | 1–13 | 27% / 17% | 44% / 50% | 29% / 34% | 71.2 | middle | early |
| 2 | 1–13 | 29% / 25% | 51% / 57% | 20% / 18% | 34.9 | middle | late |
| all | 1–13 | 28% / 19% | 46% / 52% | 26% / 29% | 106.1 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.3 | 5.6 | 5.0 | 4.2 | 3.7 | 3.7 | 3.4 | 3.3 | 3.2 | 3.1 | 3.7 | 3.3 | 3.1 |
| launches read | 384 | 355 | 578 | 585 | 617 | 647 | 727 | 765 | 885 | 1002 | 632 | 767 | 665 |

Slope over waves 1–10: -0.40 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.28 | 1.71 | 1.64 |
| runs that reached it | 18 | 17 | 14 |
| tough, every run | 1.29 | 2.25 | 1.83 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 23 | 23 | 20 | 18 | 17 | 14 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.0** | **0.2** | **0.2** | **0.2** | **0.4** | **0.7** | **1.1** | **1.1** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.1 | 0.1 | 0.1 | 0.3 | 0.6 | 1.2 | 1.1 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.06 | 0.36 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.04 | 0.17 | 0.13 | 0.13 | 0.25 | 0.50 | 0.47 | 0.57 |
| runs with no save | 100% | 100% | 100% | 96% | 91% | 96% | 83% | 83% | 78% | 65% | 67% | 41% | 43% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.09 | 0.04 | 0.09 | 0.10 | 0.28 | 0.47 | 0.43 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.00 | 0.10 | 0.06 | 0.29 | 0.21 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.09 | 0.00 | 0.05 | 0.11 | 0.00 | 0.07 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.04 | 0.13 | 0.15 | 0.22 | 0.35 | 0.43 |
| tension peak | 0.24 | 0.34 | 0.73 | 0.80 | 0.87 | 0.89 | 0.96 | 0.99 | 1.11 | 1.09 | 1.44 | 1.63 | 1.65 |
| peaks | 0.0 | 0.0 | 0.5 | 0.6 | 0.7 | 0.8 | 1.0 | 1.1 | 1.4 | 1.3 | 1.1 | 1.3 | 1.1 |
| release after a peak (s) | 0.0 | 0.3 | 1.0 | 1.1 | 1.1 | 1.3 | 1.4 | 2.0 | 2.5 | 1.7 | 4.3 | 4.3 | 5.0 |
| hot share | 0% | 1% | 2% | 2% | 3% | 2% | 3% | 3% | 6% | 4% | 19% | 34% | 26% |
| calm share | 95% | 92% | 80% | 77% | 77% | 81% | 73% | 76% | 71% | 74% | 61% | 40% | 38% |
| shape (most runs) | flat 100% | flat 96% | flat 58% | flat 46% | flat 48% | one peak 61% | one peak 39% | one peak 61% | one peak 48% | one peak 40% | one peak 61% | pinned 65% | one peak 57% |
| taps follow tension (r) | 0.46 | 0.48 | 0.37 | 0.38 | 0.50 | 0.46 | 0.45 | 0.34 | 0.44 | 0.44 | 0.48 | 0.28 | 0.39 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.6; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 136 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, droneScreen, gunships | 46% | 12.1 | 4.1 | 4.6 | 1.13 (16) / 1.53 (15) / 1.07 (14) | 0.0 0.0 0.1 0.1 0.3 0.4 0.8 0.6 1.2 1.0 |
| off-counter | railgun, seeker, lance | 38% | 11.7 | 4.5 | 6.0 | 1.19 (16) / 1.44 (16) / 1.80 (15) | 0.0 0.1 0.3 0.3 0.4 0.4 0.8 1.0 0.9 1.7 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
