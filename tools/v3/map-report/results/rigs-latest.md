# Bot report: The Rig Field (`rigs`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.7; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=rigs --seeds=24 --armory=latest --kits=plan`. Heat map: `tools/v3/map-report/results/rigs-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +0.54; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 1.08 a run (50% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.62 of the no-encounter wave; outside on w3 ×0.81, w6 ×0.81, w7 ×0.71, w8 ×0.68, w9 ×0.67, w10 ×0.62 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot early 39%, cold middle 29% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 10.8 s → w10 5.0 s (slope -0.55 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 2.00 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.55 (11), r2 1.73 (11), r3 1.73 (11); tough (every run): 1.46, 1.83, 2.58 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 6.2 lost 1–10, end 11.1; off-counter 8.1 lost 1–10, end 10.3 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Budget: wave 3 sends ×0.81 the no-encounter wave; wave 6 sends ×0.81 the no-encounter wave; wave 7 sends ×0.71 the no-encounter wave; wave 8 sends ×0.68 the no-encounter wave; wave 9 sends ×0.67 the no-encounter wave; wave 10 sends ×0.62 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest middle takes 29%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 8 (1.42 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 39%, middle 29%, late 32%.

## Ships lost per wave

Normal: won 17%, mean end wave 10.1 (14 = won), 4.2 lost in waves 1–10, 2.00 in waves 1–5. Tough: 7.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.21 | 0.42 | 0.58 | 0.88 | 1.13 | 0.88 | 1.42 | 1.25 | 0.71 | 1.46 | 1.83 | 2.58 |
| normal, runs that reached it | 0.00 | 0.21 | 0.42 | 0.58 | 0.79 | 0.70 | 0.63 | 0.82 | 0.33 | 0.50 | 1.55 | 1.73 | 1.73 |
| normal, mean over all runs | 0.00 | 0.21 | 0.42 | 0.58 | 0.79 | 0.58 | 0.50 | 0.58 | 0.21 | 0.29 | 0.71 | 0.79 | 0.79 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 20 | 19 | 17 | 15 | 14 | 11 | 11 | 11 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +0.54.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.5 | 1.9 | 1.7 | 1.7 | 1.8 | 1.5 | 1.4 | 1.4 | 1.2 | 1.1 | 0.5 | 0.8 | 1.8 |
| kills a minute | 48 | 45 | 43 | 44 | 46 | 37 | 36 | 35 | 34 | 32 | 14 | 18 | 29 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.5 | 1.2 | 1.1 | 1.7 | 2.4 | 4.4 | 2.8 | 3.4 | 3.9 | 3.9 | 2.3 | 2.8 | 3.6 |
| runs with ≥ 1 | 42% | 79% | 50% | 83% | 75% | 96% | 83% | 88% | 92% | 92% | 88% | 96% | 92% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.5 | 28.3 | 33.3 | 36.0 | 39.5 | 36.3 | 35.1 | 34.0 | 35.9 | 36.9 |
| launches (encounters off) | 27.0 | 30.0 | 40.9 | 38.3 | 41.7 | 44.9 | 49.7 | 50.2 | 53.8 | 59.9 |
| **ratio to encounters off** | 0.91 | 0.95 | **0.81** | 0.94 | 0.95 | **0.81** | **0.71** | **0.68** | **0.67** | **0.62** |
| table × scale | 27 | 35 | 46 | 54 | 55 | 63 | 74 | 79 | 92 | 111 |
| ratio to table × scale | 0.91 | 0.81 | 0.72 | 0.67 | 0.72 | 0.58 | 0.47 | 0.43 | 0.39 | 0.33 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 39% / 25% | 29% / 38% | 32% / 37% | 49.7 | early | middle |
| all | 1–9 | 39% / 25% | 29% / 38% | 32% / 37% | 49.7 | early | middle |
| 1 | 1–13 | 30% / 15% | 44% / 57% | 26% / 28% | 81.2 | middle | late |
| all | 1–13 | 30% / 15% | 44% / 57% | 26% / 28% | 81.2 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.8 | 8.7 | 7.9 | 7.3 | 7.1 | 5.8 | 6.2 | 5.9 | 5.3 | 5.0 | 2.5 | 2.3 | 4.5 |
| launches read | 622 | 768 | 798 | 887 | 939 | 859 | 829 | 810 | 833 | 862 | 196 | 238 | 434 |

Slope over waves 1–10: -0.55 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.55 | 1.73 | 1.73 |
| runs that reached it | 11 | 11 | 11 |
| tough, every run | 1.46 | 1.83 | 2.58 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 20 | 19 | 17 | 15 | 14 | 11 | 11 | 11 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.2** | **0.2** | **0.2** | **0.2** | **0.1** | **0.2** | **0.1** | **0.2** | **0.6** | **0.1** |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.2 | 0.1 | 0.1 | 0.1 | 0.1 | 0.2 | 0.1 | 0.2 | 0.5 | 0.1 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.15 | 0.00 | 0.06 | 0.00 | 0.00 | 0.00 | 0.18 | 0.09 |
| clutch | 0.00 | 0.00 | 0.13 | 0.21 | 0.17 | 0.20 | 0.11 | 0.06 | 0.13 | 0.07 | 0.18 | 0.55 | 0.00 |
| runs with no save | 100% | 100% | 92% | 79% | 88% | 85% | 84% | 94% | 80% | 93% | 82% | 55% | 91% |
|   pickup save | 0.00 | 0.00 | 0.04 | 0.08 | 0.04 | 0.00 | 0.11 | 0.06 | 0.00 | 0.00 | 0.00 | 0.18 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.10 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.09 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.05 | 0.00 | 0.00 | 0.07 | 0.00 | 0.09 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.04 | 0.13 | 0.08 | 0.05 | 0.05 | 0.06 | 0.13 | 0.07 | 0.00 | 0.36 | 0.09 |
| tension peak | 0.26 | 0.46 | 0.55 | 0.69 | 0.86 | 0.97 | 0.81 | 0.85 | 0.94 | 0.83 | 1.27 | 1.42 | 1.85 |
| peaks | 0.0 | 0.1 | 0.3 | 0.6 | 0.8 | 0.9 | 0.6 | 0.5 | 0.5 | 0.6 | 1.7 | 1.7 | 1.5 |
| release after a peak (s) | 0.0 | 0.3 | 0.5 | 1.0 | 0.8 | 1.4 | 0.9 | 0.6 | 0.6 | 1.1 | 1.5 | 1.5 | 1.4 |
| hot share | 0% | 0% | 1% | 3% | 4% | 4% | 3% | 3% | 2% | 3% | 13% | 14% | 27% |
| calm share | 94% | 87% | 86% | 83% | 81% | 77% | 80% | 82% | 84% | 80% | 78% | 57% | 64% |
| shape (most runs) | flat 100% | flat 92% | flat 79% | flat 54% | flat 54% | one peak 40% | flat 53% | flat 59% | flat 67% | flat 57% | one peak 64% | sawtooth 45% | pinned 55% |
| taps follow tension (r) | 0.18 | 0.17 | 0.23 | 0.25 | 0.30 | 0.20 | 0.21 | 0.24 | 0.26 | 0.29 | 0.15 | 0.12 | -0.01 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 85 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | railgun, flak, orbital | 42% | 11.1 | 3.7 | 6.2 | 0.67 (15) / 1.80 (15) / 1.60 (15) | 0.0 0.2 0.2 0.6 1.0 0.9 0.7 1.0 0.8 0.8 |
| off-counter | seeker, gunships, frigate | 33% | 10.3 | 4.1 | 8.1 | 1.00 (12) / 1.83 (12) / 1.17 (12) | 0.0 0.3 0.5 0.6 0.7 1.0 1.0 1.1 1.8 1.2 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
