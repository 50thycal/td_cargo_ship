# Bot report: The Black Strait (`lantern`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.45; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=lantern --seeds=24 --armory=latest (on the base build, log v48)`. Heat map: `tools/v3/map-report/results/lantern-before-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +2.50; doubles on w6 (0.29→0.67), w8 (1.17→3.67) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 2.63 a run (92% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 40%, cold late 30% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 13.6 s → w10 4.6 s (slope -0.84 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.58 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.17 (6), r2 0.50 (6), r3 0.00 (6); tough (every run): 0.04, 0.21, 0.04 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 6 loses 0.67 after 0.29; wave 8 loses 3.67 after 1.17. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest late takes 30%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (4.96 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 30%, middle 40%, late 30%.

## Ships lost per wave

Normal: won 25%, mean end wave 9.8 (14 = won), 4.8 lost in waves 1–10, 0.58 in waves 1–5. Tough: 14.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.04 | 0.04 | 0.21 | 0.29 | 0.67 | 1.17 | 3.67 | 3.50 | 4.96 | 0.04 | 0.21 | 0.04 |
| normal, runs that reached it | 0.00 | 0.04 | 0.04 | 0.21 | 0.29 | 0.63 | 0.83 | 2.11 | 1.13 | 0.80 | 0.17 | 0.50 | 0.00 |
| normal, mean over all runs | 0.00 | 0.04 | 0.04 | 0.21 | 0.29 | 0.63 | 0.79 | 1.67 | 0.75 | 0.33 | 0.04 | 0.13 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 19 | 16 | 10 | 6 | 6 | 6 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +2.50.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.1 | 1.1 | 1.4 | 1.3 | 1.5 | 1.5 | 1.7 | 1.8 | 1.9 | 1.9 | 1.7 | 2.4 | 2.4 |
| kills a minute | 43 | 39 | 45 | 42 | 44 | 42 | 45 | 43 | 47 | 55 | 48 | 64 | 65 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 0.8 | 2.6 | 2.8 | 4.8 | 6.0 | 7.3 | 7.5 | 8.3 | 9.5 | 0.0 | 0.0 | 0.0 |
| runs with ≥ 1 | 0% | 63% | 92% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0% | 0% | 0% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 23.0 | 26.5 | 35.2 | 37.4 | 40.3 | 41.4 | 46.4 | 49.4 | 53.9 | 65.1 |
| launches (encounters off) | 23.0 | 26.5 | 35.2 | 37.4 | 40.3 | 41.4 | 46.4 | 49.4 | 53.9 | 65.1 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.00 | 0.85 | 0.90 | 0.85 | 0.88 | 0.78 | 0.75 | 0.73 | 0.69 | 0.69 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 30% / 9% | 40% / 49% | 30% / 42% | 125.5 | middle | late |
| all | 1–9 | 30% / 9% | 40% / 49% | 30% / 42% | 125.5 | middle | late |
| 1 | 1–13 | 29% / 12% | 40% / 49% | 31% / 38% | 189.1 | middle | early |
| all | 1–13 | 29% / 12% | 40% / 49% | 31% / 38% | 189.1 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 13.6 | 9.5 | 8.4 | 6.9 | 6.1 | 5.5 | 5.2 | 4.4 | 4.9 | 4.6 | 6.3 | 6.1 | 5.9 |
| launches read | 552 | 635 | 840 | 893 | 967 | 990 | 1103 | 1180 | 1288 | 1560 | 455 | 455 | 456 |

Slope over waves 1–10: -0.84 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.17 | 0.50 | 0.00 |
| runs that reached it | 6 | 6 | 6 |
| tough, every run | 0.04 | 0.21 | 0.04 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 19 | 16 | 10 | 6 | 6 | 6 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.1** | **0.0** | **0.1** | **0.2** | **0.2** | **0.1** | **0.4** | **0.0** | **0.0** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.1 | 0.2 | 0.3 | 0.1 | 0.5 | 0.0 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.11 | 0.13 | 0.40 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.08 | 0.17 | 0.16 | 0.13 | 0.40 | 0.00 | 0.00 | 0.00 |
| runs with no save | 100% | 100% | 100% | 92% | 100% | 96% | 83% | 79% | 94% | 80% | 100% | 100% | 100% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.16 | 0.06 | 0.20 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.10 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.09 | 0.00 | 0.06 | 0.10 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.11 | 0.28 | 0.58 | 0.75 | 1.03 | 1.13 | 1.11 | 1.48 | 1.32 | 1.17 | 0.14 | 0.15 | 0.16 |
| peaks | 0.0 | 0.0 | 0.3 | 0.5 | 1.1 | 1.2 | 1.8 | 2.2 | 2.3 | 2.5 | 0.0 | 0.0 | 0.0 |
| release after a peak (s) | 0.0 | 0.0 | 0.4 | 0.9 | 1.8 | 1.6 | 2.0 | 1.9 | 1.5 | 2.0 | 0.0 | 0.0 | 0.0 |
| hot share | 0% | 0% | 1% | 2% | 5% | 5% | 7% | 9% | 10% | 9% | 0% | 0% | 0% |
| calm share | 100% | 95% | 84% | 83% | 75% | 71% | 69% | 58% | 59% | 58% | 100% | 100% | 99% |
| shape (most runs) | flat 100% | flat 100% | flat 75% | flat 58% | one peak 54% | one peak 42% | one peak 39% | sawtooth 37% | sawtooth 38% | sawtooth 60% | flat 100% | flat 100% | flat 100% |
| taps follow tension (r) | 0.35 | 0.28 | 0.23 | 0.40 | 0.38 | 0.33 | 0.34 | 0.34 | 0.34 | 0.40 | 0.67 | 0.49 | 0.42 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 371 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
