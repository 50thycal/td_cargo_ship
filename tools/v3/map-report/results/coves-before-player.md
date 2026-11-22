# Bot report: Smugglers' Coves (`coves`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.25; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=coves --seeds=24 --armory=player`. Heat map: `tools/v3/map-report/results/coves-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +0.75; doubles on w6 (0.04→0.67), w8 (0.21→0.75) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 3.75 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 41%, cold early 25% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 6.4 s → w10 4.7 s (slope -0.39 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.08 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (20), r2 0.00 (20), r3 0.00 (20); tough (every run): 0.00, 0.00, 0.00 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 6 loses 0.67 after 0.04; wave 8 loses 0.75 after 0.21. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.58 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 25%, middle 41%, late 34%.

## Ships lost per wave

Normal: won 83%, mean end wave 13.2 (14 = won), 3.2 lost in waves 1–10, 0.08 in waves 1–5. Tough: 4.1 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.67 | 0.21 | 0.75 | 0.83 | 1.58 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.67 | 0.21 | 0.67 | 0.78 | 0.86 | 0.00 | 0.00 | 0.00 |
| normal, mean over all runs | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.67 | 0.21 | 0.67 | 0.75 | 0.79 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 20 | 20 | 20 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +0.75.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.4 | 1.6 | 1.8 | 1.5 | 1.6 | 1.9 | 2.2 | 2.4 | 2.9 | 3.1 | 4.0 | 5.7 | 5.3 |
| kills a minute | 38 | 36 | 46 | 39 | 39 | 40 | 45 | 43 | 51 | 50 | 32 | 31 | 30 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 1.3 | 3.8 | 4.3 | 6.0 | 5.2 | 8.0 | 9.8 | 8.8 | 9.0 | 1.3 | 1.8 | 1.3 |
| runs with ≥ 1 | 29% | 75% | 100% | 100% | 96% | 100% | 100% | 100% | 100% | 100% | 83% | 88% | 63% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 22.0 | 26.6 | 36.1 | 34.1 | 36.9 | 41.8 | 48.9 | 51.0 | 59.5 | 69.2 |
| launches (encounters off) | 22.0 | 26.6 | 36.1 | 34.1 | 36.9 | 41.8 | 48.9 | 51.0 | 59.5 | 69.2 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 20 | 27 | 34 | 38 | 40 | 47 | 54 | 59 | 68 | 81 |
| ratio to table × scale | 1.10 | 0.98 | 1.06 | 0.90 | 0.92 | 0.89 | 0.91 | 0.86 | 0.87 | 0.85 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 25% / 15% | 41% / 44% | 34% / 41% | 138.2 | middle | early |
| all | 1–9 | 25% / 15% | 41% / 44% | 34% / 41% | 138.2 | middle | early |
| 1 | 1–13 | 26% / 15% | 41% / 43% | 34% / 41% | 205.6 | middle | early |
| all | 1–13 | 26% / 15% | 41% / 43% | 34% / 41% | 205.6 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 6.4 | 8.9 | 8.4 | 6.7 | 5.9 | 5.7 | 5.2 | 4.9 | 5.1 | 4.7 | 7.5 | 7.2 | 7.2 |
| launches read | 528 | 637 | 794 | 818 | 886 | 964 | 1140 | 1216 | 1366 | 1641 | 336 | 336 | 336 |

Slope over waves 1–10: -0.39 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 |
| runs that reached it | 20 | 20 | 20 |
| tough, every run | 0.00 | 0.00 | 0.00 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 20 | 20 | 20 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.0** | **0.0** | **0.0** | **0.1** | **0.2** | **0.2** | **0.1** | **0.0** | **0.0** | **0.1** |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.0 | 0.0 | 0.0 | 0.1 | 0.2 | 0.2 | 0.1 | 0.0 | 0.0 | 0.1 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.08 | 0.17 | 0.09 | 0.09 | 0.00 | 0.00 | 0.05 |
| runs with no save | 100% | 100% | 88% | 100% | 100% | 100% | 88% | 88% | 83% | 91% | 100% | 100% | 95% |
|   pickup save | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.09 | 0.05 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.04 | 0.05 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 |
|   kill save | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.00 | 0.13 | 0.04 | 0.09 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.24 | 0.42 | 0.59 | 0.62 | 0.91 | 1.07 | 1.04 | 1.26 | 1.38 | 1.55 | 0.53 | 0.68 | 0.67 |
| peaks | 0.0 | 0.1 | 0.2 | 0.3 | 0.9 | 1.3 | 1.5 | 2.0 | 2.6 | 2.9 | 0.3 | 0.3 | 0.5 |
| release after a peak (s) | 0.0 | 0.2 | 0.3 | 0.4 | 1.5 | 2.0 | 2.1 | 2.7 | 2.6 | 3.0 | 0.8 | 1.1 | 1.6 |
| hot share | 0% | 0% | 0% | 1% | 2% | 4% | 6% | 7% | 12% | 13% | 1% | 2% | 4% |
| calm share | 96% | 87% | 81% | 79% | 71% | 69% | 59% | 58% | 56% | 49% | 73% | 49% | 55% |
| shape (most runs) | flat 100% | flat 92% | flat 83% | flat 79% | one peak 62% | one peak 50% | sawtooth 33% | sawtooth 46% | sawtooth 61% | sawtooth 59% | flat 75% | flat 65% | flat 60% |
| taps follow tension (r) | 0.47 | 0.30 | 0.19 | 0.33 | 0.38 | 0.29 | 0.35 | 0.35 | 0.31 | 0.33 | 0.46 | 0.22 | 0.32 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 645 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
