# Bot report: The Rig Field (`rigs`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.7; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=rigs --seeds=24 --armory=latest --out=../beforerep/latest`. Heat map: `../beforerep/latest/rigs-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +3.17; doubles on w5 (0.67→1.42), w8 (1.50→4.67) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 5.17 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 40%, cold late 28% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 9.9 s → w10 4.2 s (slope -0.60 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 2.25 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (3), r2 0.00 (3), r3 0.00 (3); tough (every run): 0.29, 0.29, 0.29 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 5 loses 1.42 after 0.67; wave 8 loses 4.67 after 1.50. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest late takes 28%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 8 (4.67 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 33%, middle 40%, late 28%.

## Ships lost per wave

Normal: won 13%, mean end wave 8.3 (14 = won), 5.7 lost in waves 1–10, 2.25 in waves 1–5, 0.04 in bonus waves. Tough: 17.8 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.46 | 0.67 | 1.42 | 1.25 | 1.50 | 4.67 | 4.17 | 3.54 | 0.29 | 0.29 | 0.29 |
| normal, runs that reached it | 0.00 | 0.08 | 0.46 | 0.67 | 1.04 | 0.90 | 0.53 | 2.33 | 1.38 | 1.50 | 0.00 | 0.00 | 0.00 |
| normal, mean over all runs | 0.00 | 0.08 | 0.46 | 0.67 | 1.04 | 0.79 | 0.38 | 1.46 | 0.46 | 0.38 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 21 | 17 | 15 | 8 | 6 | 3 | 3 | 3 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +3.17.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.5 | 1.6 | 2.0 | 1.7 | 1.7 | 1.8 | 1.6 | 1.9 | 2.0 | 1.8 | 1.5 | 1.6 | 1.6 |
| kills a minute | 46 | 42 | 47 | 44 | 45 | 45 | 47 | 43 | 47 | 51 | 19 | 32 | 29 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.7 | 1.8 | 5.3 | 5.2 | 5.9 | 7.3 | 7.1 | 8.5 | 9.9 | 10.5 | 0.8 | 0.8 | 0.8 |
| runs with ≥ 1 | 38% | 92% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 58% | 63% | 54% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 27.0 | 30.5 | 39.5 | 37.7 | 39.8 | 44.7 | 46.3 | 47.9 | 54.1 | 61.4 |
| launches (encounters off) | 27.0 | 30.5 | 39.5 | 37.7 | 39.8 | 44.7 | 46.3 | 47.9 | 54.1 | 61.4 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 27 | 35 | 46 | 54 | 55 | 63 | 74 | 79 | 92 | 111 |
| ratio to table × scale | 1.00 | 0.87 | 0.86 | 0.70 | 0.72 | 0.71 | 0.63 | 0.61 | 0.59 | 0.55 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 33% / 11% | 40% / 46% | 28% / 43% | 144.0 | middle | late |
| all | 1–9 | 33% / 11% | 40% / 46% | 28% / 43% | 144.0 | middle | late |
| 1 | 1–13 | 31% / 11% | 38% / 45% | 30% / 45% | 195.9 | middle | late |
| all | 1–13 | 31% / 11% | 38% / 45% | 30% / 45% | 195.9 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.9 | 8.4 | 7.4 | 6.5 | 5.8 | 4.9 | 5.0 | 4.6 | 4.3 | 4.2 | 3.5 | 3.5 | 3.5 |
| launches read | 645 | 730 | 946 | 895 | 953 | 1069 | 1106 | 1148 | 1292 | 1462 | 336 | 336 | 336 |

Slope over waves 1–10: -0.60 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 |
| runs that reached it | 3 | 3 | 3 |
| tough, every run | 0.29 | 0.29 | 0.29 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 21 | 17 | 15 | 8 | 6 | 3 | 3 | 3 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.2** | **0.1** | **0.3** | **0.4** | **0.0** | **0.0** | **0.0** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 | 0.1 | 0.2 | 0.4 | 0.0 | 0.0 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.07 | 0.13 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.04 | 0.13 | 0.08 | 0.19 | 0.06 | 0.20 | 0.25 | 0.00 | 0.00 | 0.00 | 0.00 |
| runs with no save | 100% | 100% | 96% | 88% | 92% | 81% | 94% | 80% | 63% | 100% | 100% | 100% | 100% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.05 | 0.06 | 0.13 | 0.13 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.08 | 0.04 | 0.05 | 0.00 | 0.00 | 0.13 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.10 | 0.00 | 0.00 | 0.13 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.20 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.30 | 0.50 | 0.89 | 0.88 | 1.01 | 1.25 | 0.88 | 1.16 | 1.08 | 1.40 | 0.61 | 0.58 | 0.28 |
| peaks | 0.0 | 0.0 | 0.9 | 0.7 | 1.1 | 2.1 | 0.9 | 1.9 | 2.5 | 1.5 | 0.3 | 0.3 | 0.0 |
| release after a peak (s) | 0.0 | 0.1 | 1.8 | 1.3 | 1.5 | 1.8 | 1.5 | 2.0 | 2.1 | 2.6 | 0.3 | 0.7 | 0.0 |
| hot share | 0% | 0% | 4% | 4% | 4% | 10% | 4% | 8% | 11% | 9% | 1% | 1% | 0% |
| calm share | 91% | 86% | 69% | 72% | 68% | 62% | 72% | 64% | 60% | 60% | 72% | 69% | 76% |
| shape (most runs) | flat 100% | flat 96% | one peak 46% | flat 50% | one peak 33% | sawtooth 38% | one peak 41% | one peak 40% | sawtooth 75% | sawtooth 33% | flat 67% | flat 67% | flat 100% |
| taps follow tension (r) | 0.24 | 0.16 | 0.16 | 0.16 | 0.20 | 0.32 | 0.30 | 0.36 | 0.33 | 0.28 | 0.41 | 0.28 | 0.55 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 295 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
