# Bot report: Smugglers' Coves (`coves`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.25; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=coves --seeds=24 --armory=plating`. Heat map: `tools/v3/map-report/results/coves-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +1.04; doubles on w8 (0.21→0.63), w10 (0.96→2.00) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 3.58 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 38%, cold early 27% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 6.4 s → w10 4.7 s (slope -0.39 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.46 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (15), r2 0.00 (15), r3 0.00 (15); tough (every run): 0.00, 0.04, 0.00 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 8 loses 0.63 after 0.21; wave 10 loses 2.00 after 0.96. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest early takes 27%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (2.00 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 27%, middle 38%, late 35%.

## Ships lost per wave

Normal: won 63%, mean end wave 12.3 (14 = won), 3.5 lost in waves 1–10, 0.46 in waves 1–5. Tough: 4.7 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.13 | 0.17 | 0.08 | 0.08 | 0.42 | 0.21 | 0.63 | 0.96 | 2.00 | 0.00 | 0.04 | 0.00 |
| normal, runs that reached it | 0.00 | 0.13 | 0.17 | 0.08 | 0.08 | 0.42 | 0.21 | 0.63 | 0.88 | 1.11 | 0.00 | 0.00 | 0.00 |
| normal, mean over all runs | 0.00 | 0.13 | 0.17 | 0.08 | 0.08 | 0.42 | 0.21 | 0.63 | 0.88 | 0.88 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 19 | 15 | 15 | 15 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +1.04.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.4 | 1.6 | 1.8 | 1.5 | 1.5 | 2.0 | 2.0 | 2.3 | 2.4 | 3.0 | 4.1 | 5.6 | 4.8 |
| kills a minute | 39 | 36 | 48 | 40 | 39 | 40 | 48 | 43 | 50 | 52 | 32 | 28 | 38 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 1.6 | 4.0 | 3.6 | 5.7 | 6.0 | 8.1 | 7.7 | 7.5 | 11.0 | 1.8 | 1.3 | 1.1 |
| runs with ≥ 1 | 21% | 83% | 92% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 88% | 71% | 71% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 22.0 | 26.6 | 36.7 | 34.8 | 37.0 | 41.6 | 49.0 | 52.7 | 59.4 | 69.8 |
| launches (encounters off) | 22.0 | 26.6 | 36.7 | 34.8 | 37.0 | 41.6 | 49.0 | 52.7 | 59.4 | 69.8 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 20 | 27 | 34 | 38 | 40 | 47 | 54 | 59 | 68 | 81 |
| ratio to table × scale | 1.10 | 0.98 | 1.08 | 0.92 | 0.93 | 0.88 | 0.91 | 0.89 | 0.87 | 0.86 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 27% / 13% | 38% / 27% | 35% / 61% | 73.5 | middle | early |
| all | 1–9 | 27% / 13% | 38% / 27% | 35% / 61% | 73.5 | middle | early |
| 1 | 1–13 | 27% / 8% | 40% / 36% | 33% / 56% | 109.5 | middle | early |
| all | 1–13 | 27% / 8% | 40% / 36% | 33% / 56% | 109.5 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 6.4 | 8.9 | 8.5 | 6.7 | 5.8 | 5.7 | 5.2 | 4.8 | 5.2 | 4.7 | 7.7 | 7.4 | 7.3 |
| launches read | 528 | 637 | 806 | 833 | 887 | 958 | 1141 | 1257 | 1370 | 1652 | 336 | 336 | 336 |

Slope over waves 1–10: -0.39 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 |
| runs that reached it | 15 | 15 | 15 |
| tough, every run | 0.00 | 0.04 | 0.00 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 19 | 15 | 15 | 15 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.0** | **0.1** | **0.3** | **0.1** | **0.1** | **0.0** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.0 | 0.1 | 0.2 | 0.0 | 0.0 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.00 | 0.04 | 0.17 | 0.00 | 0.07 | 0.00 | 0.00 |
| runs with no save | 100% | 100% | 100% | 100% | 92% | 92% | 96% | 92% | 75% | 95% | 93% | 100% | 100% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.07 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.13 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.08 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.20 | 0.38 | 0.65 | 0.61 | 0.73 | 1.16 | 1.09 | 1.24 | 1.32 | 1.77 | 0.52 | 0.73 | 0.57 |
| peaks | 0.0 | 0.0 | 0.3 | 0.3 | 0.5 | 1.8 | 1.5 | 2.1 | 2.5 | 2.7 | 0.1 | 0.5 | 0.2 |
| release after a peak (s) | 0.0 | 0.0 | 0.5 | 0.4 | 0.8 | 2.3 | 1.9 | 2.4 | 2.4 | 3.0 | 0.2 | 2.0 | 0.5 |
| hot share | 0% | 0% | 1% | 1% | 2% | 6% | 6% | 9% | 10% | 16% | 0% | 5% | 2% |
| calm share | 98% | 88% | 80% | 81% | 74% | 69% | 64% | 56% | 58% | 45% | 69% | 47% | 62% |
| shape (most runs) | flat 100% | flat 96% | flat 67% | flat 79% | flat 58% | sawtooth 42% | sawtooth 38% | sawtooth rising 42% | sawtooth 42% | sawtooth rising 42% | flat 93% | flat 60% | flat 80% |
| taps follow tension (r) | 0.55 | 0.29 | 0.23 | 0.28 | 0.41 | 0.30 | 0.29 | 0.30 | 0.31 | 0.29 | 0.38 | 0.26 | 0.15 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 543 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
