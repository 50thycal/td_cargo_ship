# Bot report: Dunmar Crossing (`crossing`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.65; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=crossing --seeds=24 --armory=player --kits=plan`. Heat map: `tools/v3/map-report/results/crossing-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w7 +0.29; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w4 2.50 a run (92% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.74 of the no-encounter wave; outside on w10 ×0.74 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 39%, cold early 27%; lane 2: hot middle 38%, cold late 27% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 9.4 s → w10 4.4 s (slope -0.57 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.42 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.43 (21), r2 0.76 (21), r3 2.33 (21); tough (every run): 0.46, 0.75, 2.79 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 3.0 lost 1–10, end 13.4; counter 3.1 lost 1–10, end 13.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Budget: wave 10 sends ×0.74 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest early takes 27%), lane 2 (coldest late takes 27%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (0.79 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 30%, middle 39%, late 31%.

## Ships lost per wave

Normal: won 67%, mean end wave 13.2 (14 = won), 2.8 lost in waves 1–10, 0.42 in waves 1–5. Tough: 2.9 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.04 | 0.13 | 0.00 | 0.25 | 0.13 | 0.42 | 0.58 | 0.79 | 0.54 | 0.46 | 0.75 | 2.79 |
| normal, runs that reached it | 0.00 | 0.04 | 0.13 | 0.00 | 0.25 | 0.13 | 0.42 | 0.58 | 0.75 | 0.50 | 0.43 | 0.76 | 2.33 |
| normal, mean over all runs | 0.00 | 0.04 | 0.13 | 0.00 | 0.25 | 0.13 | 0.42 | 0.58 | 0.75 | 0.46 | 0.38 | 0.67 | 2.04 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 21 | 21 | 21 |

Biggest one-wave step up (tough, waves 2–10): wave 7, +0.29.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.5 | 1.9 | 2.1 | 1.6 | 1.8 | 2.0 | 2.2 | 2.1 | 2.1 | 1.6 | 2.9 | 6.0 | 8.5 |
| kills a minute | 43 | 51 | 55 | 46 | 44 | 51 | 44 | 41 | 46 | 37 | 36 | 48 | 42 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.2 | 1.2 | 4.3 | 2.5 | 5.1 | 6.5 | 5.2 | 7.4 | 7.3 | 5.5 | 2.5 | 3.4 | 4.3 |
| runs with ≥ 1 | 71% | 71% | 100% | 92% | 100% | 100% | 100% | 100% | 100% | 100% | 92% | 100% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 22.5 | 31.6 | 42.5 | 38.1 | 39.2 | 49.1 | 47.0 | 48.1 | 53.2 | 51.8 |
| launches (encounters off) | 26.0 | 30.4 | 43.5 | 44.6 | 46.0 | 51.5 | 54.5 | 54.4 | 61.1 | 70.0 |
| **ratio to encounters off** | 0.87 | 1.04 | 0.98 | 0.85 | 0.85 | 0.95 | 0.86 | 0.88 | 0.87 | **0.74** |
| table × scale | 26 | 34 | 45 | 51 | 52 | 62 | 71 | 78 | 90 | 107 |
| ratio to table × scale | 0.87 | 0.93 | 0.95 | 0.75 | 0.75 | 0.79 | 0.66 | 0.62 | 0.59 | 0.48 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 27% / 9% | 39% / 51% | 35% / 40% | 42.2 | middle | early |
| 2 | 1–9 | 34% / 33% | 38% / 38% | 27% / 29% | 39.7 | middle | late |
| all | 1–9 | 30% / 18% | 39% / 46% | 31% / 36% | 81.9 | middle | early |
| 1 | 1–13 | 30% / 27% | 34% / 38% | 36% / 35% | 83.0 | late | early |
| 2 | 1–13 | 35% / 51% | 35% / 23% | 31% / 26% | 76.5 | early | late |
| all | 1–13 | 32% / 38% | 34% / 31% | 33% / 31% | 159.5 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.4 | 8.3 | 7.0 | 6.9 | 5.6 | 5.0 | 5.1 | 4.0 | 4.5 | 4.4 | 4.5 | 3.9 | 3.6 |
| launches read | 576 | 823 | 1073 | 947 | 975 | 1213 | 1104 | 1148 | 1268 | 1233 | 604 | 963 | 1306 |

Slope over waves 1–10: -0.57 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.43 | 0.76 | 2.33 |
| runs that reached it | 21 | 21 | 21 |
| tough, every run | 0.46 | 0.75 | 2.79 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 21 | 21 | 21 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.2** | **0.2** | **0.0** | **0.2** | **0.3** | **0.5** | **0.9** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.1 | 0.2 | 0.0 | 0.2 | 0.2 | 0.4 | 0.7 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.17 | 0.21 | 0.04 | 0.14 | 0.29 | 0.38 | 0.62 |
| runs with no save | 96% | 100% | 96% | 100% | 92% | 88% | 83% | 79% | 96% | 82% | 71% | 71% | 48% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.08 | 0.08 | 0.00 | 0.09 | 0.19 | 0.24 | 0.52 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.04 | 0.04 | 0.00 | 0.05 | 0.00 | 0.05 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.05 | 0.10 | 0.05 | 0.00 |
|   kill save | 0.04 | 0.00 | 0.04 | 0.00 | 0.04 | 0.04 | 0.00 | 0.04 | 0.00 | 0.05 | 0.00 | 0.19 | 0.29 |
| tension peak | 0.35 | 0.40 | 0.80 | 0.65 | 0.91 | 1.08 | 1.05 | 1.28 | 1.14 | 0.87 | 1.18 | 2.01 | 2.99 |
| peaks | 0.0 | 0.1 | 0.5 | 0.3 | 0.8 | 1.2 | 1.2 | 1.9 | 1.5 | 0.7 | 1.7 | 1.9 | 2.1 |
| release after a peak (s) | 0.0 | 0.1 | 0.9 | 0.6 | 1.3 | 2.0 | 1.9 | 2.5 | 2.1 | 1.0 | 2.0 | 4.4 | 4.7 |
| hot share | 0% | 0% | 2% | 1% | 3% | 5% | 5% | 8% | 7% | 2% | 10% | 38% | 51% |
| calm share | 91% | 89% | 75% | 83% | 71% | 67% | 69% | 60% | 61% | 74% | 61% | 34% | 30% |
| shape (most runs) | flat 96% | flat 92% | flat 54% | flat 75% | one peak 50% | one peak 50% | sawtooth 29% | one peak 38% | sawtooth 38% | flat 50% | one peak 33% | pinned 76% | pinned 95% |
| taps follow tension (r) | 0.36 | 0.31 | 0.35 | 0.33 | 0.35 | 0.35 | 0.38 | 0.36 | 0.31 | 0.32 | 0.43 | 0.28 | 0.27 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 1276 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | thermo, well, railgun | 75% | 13.5 | 3.0 | 3.1 | 0.45 (22) / 0.68 (22) / 2.36 (22) | 0.0 0.0 0.1 0.0 0.3 0.2 0.5 0.8 0.8 0.6 |
| off-counter | droneScreen, fullSteam, bomberWing | 75% | 13.4 | 2.9 | 3.0 | 0.41 (22) / 0.77 (22) / 2.24 (21) | 0.0 0.0 0.1 0.1 0.3 0.2 0.3 0.7 0.8 0.5 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
