# Bot report: Sowers' Reach (`sowers`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.45; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=sowers --seeds=24 --armory=latest --out=tools/v3/map-report/results`. Heat map: `tools/v3/map-report/results/sowers-before-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w7 +1.08; doubles on w4 (0.21→0.54), w7 (1.00→2.08) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 3.63 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 40%, cold early 25% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.3 s → w10 4.4 s (slope -0.55 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.54 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (2), r2 0.50 (2), r3 0.00 (2); tough (every run): 0.50, 0.33, 0.00 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w8, w9 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 4 loses 0.54 after 0.21; wave 7 loses 2.08 after 1.00. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 8, 9. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (4.04 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 25%, middle 40%, late 35%.

## Ships lost per wave

Normal: won 8%, mean end wave 8.4 (14 = won), 5.8 lost in waves 1–10, 1.54 in waves 1–5. Tough: 15.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.21 | 0.54 | 0.71 | 1.00 | 2.08 | 3.00 | 3.33 | 4.04 | 0.50 | 0.33 | 0.00 |
| normal, runs that reached it | 0.00 | 0.08 | 0.21 | 0.54 | 0.71 | 0.83 | 1.57 | 1.89 | 1.14 | 1.50 | 0.00 | 0.50 | 0.00 |
| normal, mean over all runs | 0.00 | 0.08 | 0.21 | 0.54 | 0.71 | 0.83 | 1.38 | 1.42 | 0.33 | 0.25 | 0.00 | 0.04 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 21 | 18 | 7 | 4 | 2 | 2 | 2 |

Biggest one-wave step up (tough, waves 2–10): wave 7, +1.08.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.4 | 1.6 | 1.7 | 1.7 | 2.0 | 1.6 | 1.9 | 2.2 | 2.1 | 1.8 | 0.9 | 1.4 | 1.1 |
| kills a minute | 44 | 42 | 48 | 46 | 46 | 46 | 50 | 46 | 52 | 49 | 24 | 32 | 30 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.2 | 1.1 | 3.6 | 4.0 | 6.0 | 6.7 | 6.9 | 7.7 | 8.8 | 9.6 | 1.4 | 1.8 | 1.5 |
| runs with ≥ 1 | 13% | 71% | 100% | 92% | 100% | 100% | 100% | 100% | 100% | 100% | 71% | 88% | 75% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 25.0 | 30.3 | 38.2 | 39.0 | 41.4 | 43.7 | 49.8 | 52.4 | 59.0 | 66.6 |
| launches (encounters off) | 25.0 | 30.3 | 38.2 | 39.0 | 41.4 | 43.7 | 49.8 | 52.4 | 59.0 | 66.6 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.09 | 0.98 | 0.98 | 0.89 | 0.90 | 0.82 | 0.80 | 0.77 | 0.76 | 0.71 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 25% / 11% | 40% / 41% | 35% / 48% | 70.9 | middle | early |
| all | 1–9 | 25% / 11% | 40% / 41% | 35% / 48% | 70.9 | middle | early |
| 1 | 1–13 | 25% / 13% | 42% / 44% | 32% / 43% | 98.2 | middle | early |
| all | 1–13 | 25% / 13% | 42% / 44% | 32% / 43% | 98.2 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.3 | 8.2 | 7.4 | 6.5 | 6.1 | 5.0 | 4.8 | 4.6 | 4.4 | 4.4 | 1.5 | 1.3 | 1.3 |
| launches read | 552 | 651 | 838 | 839 | 899 | 928 | 1073 | 1115 | 1276 | 1434 | 249 | 251 | 223 |

Slope over waves 1–10: -0.55 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 0.50 | 0.00 |
| runs that reached it | 2 | 2 | 2 |
| tough, every run | 0.50 | 0.33 | 0.00 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 21 | 18 | 7 | 4 | 2 | 2 | 2 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.7** | **0.4** | **0.3** | **0.5** | **0.0** | **0.5** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.5 | 0.3 | 0.2 | 0.3 | 0.0 | 0.3 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.22 | 0.00 | 0.50 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.43 | 0.33 | 0.14 | 0.50 | 0.00 | 0.50 | 0.00 |
| runs with no save | 100% | 100% | 100% | 100% | 96% | 83% | 62% | 72% | 71% | 75% | 100% | 50% | 100% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.24 | 0.06 | 0.29 | 0.50 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.10 | 0.11 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.17 | 0.00 | 0.00 | 0.00 | 0.50 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.33 | 0.06 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.13 | 0.46 | 0.68 | 0.69 | 1.00 | 0.96 | 1.46 | 1.36 | 1.16 | 1.50 | 0.62 | 0.69 | 0.55 |
| peaks | 0.0 | 0.2 | 0.5 | 0.3 | 1.2 | 1.1 | 1.8 | 2.1 | 1.6 | 1.5 | 0.0 | 0.5 | 0.0 |
| release after a peak (s) | 0.0 | 0.3 | 0.5 | 0.9 | 2.0 | 1.4 | 2.3 | 2.1 | 1.7 | 1.8 | 0.0 | 1.0 | 0.0 |
| hot share | 0% | 0% | 2% | 1% | 4% | 4% | 10% | 12% | 10% | 8% | 0% | 3% | 0% |
| calm share | 99% | 90% | 80% | 82% | 72% | 71% | 65% | 61% | 59% | 68% | 83% | 49% | 64% |
| shape (most runs) | flat 100% | flat 83% | flat 67% | flat 67% | one peak 67% | one peak 42% | sawtooth rising 33% | sawtooth 33% | one peak 43% | one peak 50% | flat 100% | one peak 50% | flat 100% |
| taps follow tension (r) | 0.46 | 0.24 | 0.22 | 0.35 | 0.26 | 0.33 | 0.28 | 0.37 | 0.26 | 0.31 | 0.52 | 0.64 | 0.71 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w8, w9. 24 runs, 68 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
