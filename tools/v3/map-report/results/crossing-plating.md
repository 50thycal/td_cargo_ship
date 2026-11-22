# Bot report: Dunmar Crossing (`crossing`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.65; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=crossing --seeds=24 --armory=plating --kits=plan`. Heat map: `tools/v3/map-report/results/crossing-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +0.25; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w4 3.17 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.72 of the no-encounter wave; outside on w10 ×0.72 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 39%, cold early 26%; lane 2: hot middle 41%, cold early 28% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 9.4 s → w10 4.4 s (slope -0.56 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.42 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.32 (19), r2 1.47 (19), r3 2.83 (18); tough (every run): 0.38, 1.63, 3.67 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 3.7 lost 1–10, end 12.8; off-counter 4.0 lost 1–10, end 12.6 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Budget: wave 10 sends ×0.72 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest early takes 26%), lane 2 (coldest early takes 28%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (1.00 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 27%, middle 40%, late 32%.

## Ships lost per wave

Normal: won 38%, mean end wave 12.4 (14 = won), 3.1 lost in waves 1–10, 0.42 in waves 1–5. Tough: 3.6 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 0.08 | 0.29 | 0.42 | 0.54 | 0.79 | 1.00 | 0.46 | 0.38 | 1.63 | 3.67 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 0.08 | 0.29 | 0.42 | 0.54 | 0.83 | 0.73 | 0.30 | 0.32 | 1.47 | 2.83 |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 0.08 | 0.29 | 0.42 | 0.54 | 0.79 | 0.67 | 0.25 | 0.25 | 1.17 | 2.13 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 20 | 19 | 19 | 18 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +0.25.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.5 | 1.7 | 2.0 | 1.7 | 1.9 | 2.0 | 2.1 | 2.1 | 2.1 | 1.6 | 3.1 | 6.1 | 8.5 |
| kills a minute | 44 | 53 | 56 | 49 | 46 | 49 | 46 | 41 | 45 | 38 | 36 | 43 | 49 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.4 | 1.4 | 4.6 | 3.2 | 5.6 | 6.0 | 5.3 | 7.4 | 7.4 | 5.8 | 3.0 | 2.9 | 3.2 |
| runs with ≥ 1 | 83% | 83% | 100% | 96% | 100% | 100% | 100% | 100% | 100% | 100% | 92% | 96% | 88% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 22.5 | 31.6 | 42.8 | 39.7 | 41.0 | 49.2 | 48.1 | 48.3 | 54.5 | 52.0 |
| launches (encounters off) | 26.0 | 30.4 | 43.7 | 44.8 | 47.4 | 52.1 | 55.1 | 54.4 | 62.0 | 71.7 |
| **ratio to encounters off** | 0.87 | 1.04 | 0.98 | 0.88 | 0.87 | 0.94 | 0.87 | 0.89 | 0.88 | **0.72** |
| table × scale | 26 | 34 | 45 | 51 | 52 | 62 | 71 | 78 | 90 | 107 |
| ratio to table × scale | 0.87 | 0.93 | 0.95 | 0.78 | 0.79 | 0.79 | 0.68 | 0.62 | 0.61 | 0.49 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 26% / 9% | 39% / 53% | 35% / 38% | 26.0 | middle | early |
| 2 | 1–9 | 28% / 17% | 41% / 40% | 30% / 43% | 25.6 | middle | early |
| all | 1–9 | 27% / 13% | 40% / 46% | 32% / 41% | 51.6 | middle | early |
| 1 | 1–13 | 29% / 19% | 34% / 33% | 37% / 48% | 50.5 | late | early |
| 2 | 1–13 | 32% / 27% | 36% / 31% | 33% / 42% | 47.3 | middle | early |
| all | 1–13 | 30% / 22% | 35% / 32% | 35% / 45% | 97.8 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.4 | 8.2 | 6.9 | 6.9 | 5.4 | 5.1 | 5.2 | 4.0 | 4.3 | 4.4 | 4.3 | 3.7 | 3.6 |
| launches read | 576 | 823 | 1075 | 980 | 1018 | 1210 | 1132 | 1148 | 1298 | 1234 | 639 | 1013 | 1283 |

Slope over waves 1–10: -0.56 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.32 | 1.47 | 2.83 |
| runs that reached it | 19 | 19 | 18 |
| tough, every run | 0.38 | 1.63 | 3.67 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 20 | 19 | 19 | 18 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.1** | **0.2** | **0.2** | **0.2** | **0.1** | **0.0** | **0.2** | **0.4** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.1 | 0.2 | 0.2 | 0.1 | 0.0 | 0.2 | 0.3 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.06 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.04 | 0.08 | 0.13 | 0.09 | 0.05 | 0.00 | 0.11 | 0.22 |
| runs with no save | 100% | 100% | 100% | 100% | 88% | 92% | 83% | 83% | 82% | 90% | 100% | 79% | 72% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.05 | 0.05 | 0.00 | 0.11 | 0.11 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.05 | 0.06 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.11 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.00 | 0.17 | 0.13 | 0.09 | 0.05 | 0.00 | 0.05 | 0.11 |
| tension peak | 0.32 | 0.34 | 0.72 | 0.63 | 0.85 | 1.03 | 1.15 | 1.34 | 1.38 | 0.96 | 1.35 | 2.12 | 3.05 |
| peaks | 0.0 | 0.0 | 0.5 | 0.4 | 0.9 | 1.3 | 1.4 | 1.8 | 1.6 | 0.6 | 1.4 | 1.8 | 1.4 |
| release after a peak (s) | 0.0 | 0.0 | 1.1 | 0.6 | 1.3 | 1.9 | 2.3 | 2.8 | 3.3 | 1.9 | 2.1 | 4.0 | 4.6 |
| hot share | 0% | 0% | 2% | 1% | 4% | 5% | 5% | 10% | 9% | 3% | 12% | 40% | 50% |
| calm share | 92% | 92% | 77% | 84% | 68% | 66% | 66% | 61% | 60% | 74% | 58% | 35% | 31% |
| shape (most runs) | flat 96% | flat 100% | flat 58% | flat 71% | flat 42% | one peak 33% | one peak 38% | sawtooth 35% | one peak 36% | one peak 50% | one peak 47% | pinned 79% | pinned 89% |
| taps follow tension (r) | 0.37 | 0.35 | 0.37 | 0.28 | 0.41 | 0.31 | 0.34 | 0.36 | 0.32 | 0.35 | 0.43 | 0.21 | 0.20 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 511 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | thermo, well, railgun | 46% | 12.8 | 3.2 | 3.7 | 0.25 (20) / 1.20 (20) / 2.70 (20) | 0.0 0.0 0.0 0.1 0.3 0.3 0.5 0.8 1.1 0.5 |
| off-counter | droneScreen, fullSteam, bomberWing | 42% | 12.6 | 3.4 | 4.0 | 0.16 (19) / 1.74 (19) / 2.63 (19) | 0.0 0.0 0.1 0.0 0.4 0.3 0.5 0.8 1.4 0.5 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
