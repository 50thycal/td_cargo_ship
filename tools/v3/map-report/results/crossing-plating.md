# Bot report: Dunmar Crossing (`crossing`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.65; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=crossing --seeds=24 --armory=plating`. Heat map: `tools/v3/map-report/results/crossing-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +0.50; doubles on w8 (0.46→0.96) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 3.50 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.73 of the no-encounter wave; outside on w10 ×0.73 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 40%, cold early 28%; lane 2: hot middle 40%, cold late 29% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 9.4 s → w10 4.3 s (slope -0.56 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.33 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.37 (19), r2 1.32 (19), r3 2.28 (18); tough (every run): 0.46, 1.63, 2.58 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 8 loses 0.96 after 0.46. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 10 sends ×0.73 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest early takes 28%), lane 2 (coldest late takes 29%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 8 (0.96 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 30%, middle 40%, late 31%.

## Ships lost per wave

Normal: won 54%, mean end wave 12.5 (14 = won), 2.8 lost in waves 1–10, 0.33 in waves 1–5. Tough: 3.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 0.08 | 0.21 | 0.38 | 0.46 | 0.96 | 0.71 | 0.71 | 0.46 | 1.63 | 2.58 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 0.08 | 0.21 | 0.38 | 0.46 | 0.96 | 0.50 | 0.35 | 0.37 | 1.32 | 2.28 |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 0.08 | 0.21 | 0.38 | 0.46 | 0.92 | 0.42 | 0.29 | 0.29 | 1.04 | 1.71 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 20 | 19 | 19 | 18 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +0.50.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.5 | 1.7 | 2.0 | 1.7 | 1.8 | 2.0 | 2.1 | 2.1 | 2.1 | 1.6 | 3.2 | 5.8 | 8.4 |
| kills a minute | 44 | 53 | 56 | 50 | 46 | 48 | 47 | 41 | 47 | 39 | 34 | 51 | 46 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.4 | 1.4 | 4.6 | 3.5 | 5.5 | 6.1 | 5.4 | 7.2 | 7.5 | 5.7 | 2.5 | 3.1 | 3.6 |
| runs with ≥ 1 | 83% | 83% | 100% | 96% | 100% | 100% | 100% | 96% | 100% | 100% | 96% | 96% | 92% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 22.5 | 31.6 | 42.8 | 39.5 | 40.5 | 48.8 | 48.0 | 49.2 | 54.4 | 52.1 |
| launches (encounters off) | 26.0 | 30.4 | 43.7 | 44.8 | 47.4 | 52.1 | 55.1 | 54.4 | 62.0 | 71.7 |
| **ratio to encounters off** | 0.87 | 1.04 | 0.98 | 0.88 | 0.86 | 0.94 | 0.87 | 0.90 | 0.88 | **0.73** |
| table × scale | 26 | 34 | 45 | 51 | 52 | 62 | 71 | 78 | 90 | 107 |
| ratio to table × scale | 0.87 | 0.93 | 0.95 | 0.77 | 0.78 | 0.79 | 0.68 | 0.63 | 0.60 | 0.49 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 28% / 3% | 40% / 59% | 33% / 38% | 24.3 | middle | early |
| 2 | 1–9 | 31% / 17% | 40% / 36% | 29% / 47% | 24.6 | middle | late |
| all | 1–9 | 30% / 10% | 40% / 47% | 31% / 43% | 49.0 | middle | early |
| 1 | 1–13 | 31% / 17% | 35% / 38% | 33% / 45% | 46.6 | middle | early |
| 2 | 1–13 | 34% / 26% | 35% / 38% | 31% / 36% | 47.0 | middle | late |
| all | 1–13 | 33% / 22% | 35% / 38% | 32% / 40% | 93.7 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.4 | 8.2 | 6.9 | 6.9 | 5.4 | 5.1 | 5.2 | 4.1 | 4.4 | 4.3 | 4.4 | 4.0 | 3.6 |
| launches read | 576 | 823 | 1075 | 976 | 1008 | 1200 | 1129 | 1171 | 1298 | 1235 | 625 | 912 | 1270 |

Slope over waves 1–10: -0.56 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.37 | 1.32 | 2.28 |
| runs that reached it | 19 | 19 | 18 |
| tough, every run | 0.46 | 1.63 | 2.58 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 20 | 19 | 19 | 18 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.1** | **0.2** | **0.2** | **0.3** | **0.1** | **0.0** | **0.2** | **0.6** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.1 | 0.2 | 0.2 | 0.1 | 0.0 | 0.1 | 0.4 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.04 | 0.08 | 0.17 | 0.20 | 0.05 | 0.00 | 0.11 | 0.44 |
| runs with no save | 100% | 100% | 100% | 100% | 88% | 92% | 83% | 87% | 80% | 90% | 100% | 84% | 56% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.05 | 0.05 | 0.00 | 0.00 | 0.28 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.05 | 0.06 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.04 | 0.05 | 0.00 | 0.00 | 0.00 | 0.17 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.00 | 0.17 | 0.04 | 0.10 | 0.05 | 0.00 | 0.11 | 0.06 |
| tension peak | 0.32 | 0.34 | 0.72 | 0.62 | 0.82 | 1.02 | 1.05 | 1.26 | 1.29 | 1.06 | 1.45 | 1.86 | 2.99 |
| peaks | 0.0 | 0.0 | 0.5 | 0.4 | 0.8 | 1.3 | 1.3 | 2.0 | 1.6 | 0.8 | 1.6 | 2.0 | 1.7 |
| release after a peak (s) | 0.0 | 0.0 | 1.1 | 0.7 | 1.2 | 1.9 | 1.7 | 2.5 | 3.0 | 1.6 | 1.8 | 3.3 | 3.9 |
| hot share | 0% | 0% | 2% | 1% | 3% | 5% | 5% | 10% | 7% | 3% | 12% | 34% | 50% |
| calm share | 92% | 92% | 77% | 84% | 70% | 66% | 67% | 59% | 61% | 74% | 56% | 39% | 32% |
| shape (most runs) | flat 96% | flat 100% | flat 58% | flat 71% | flat 46% | one peak 38% | sawtooth 38% | one peak 43% | one peak 45% | one peak 45% | sawtooth 47% | pinned 58% | pinned 89% |
| taps follow tension (r) | 0.37 | 0.35 | 0.37 | 0.28 | 0.43 | 0.31 | 0.30 | 0.34 | 0.30 | 0.34 | 0.39 | 0.25 | 0.22 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 724 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
