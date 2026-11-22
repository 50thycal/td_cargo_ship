# Bot report: Dunmar Crossing (`crossing`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.65; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=crossing --seeds=24 --armory=plating`. Heat map: `tools/v3/map-report/results/crossing-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.29; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w4 3.29 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 42%, cold early 27%; lane 2: hot middle 44%, cold late 22% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 10.1 s → w10 4.1 s (slope -0.60 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.21 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (13), r2 0.00 (13), r3 0.00 (13); tough (every run): 0.00, 0.00, 0.04 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- No safe stretch on lane 1 (coldest early takes 27%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.25 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 30%, middle 43%, late 27%.

## Ships lost per wave

Normal: won 54%, mean end wave 11.5 (14 = won), 2.9 lost in waves 1–10, 0.21 in waves 1–5, 0.04 in bonus waves. Tough: 4.1 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.00 | 0.08 | 0.13 | 0.33 | 0.50 | 0.75 | 1.04 | 1.25 | 0.00 | 0.00 | 0.04 |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 | 0.08 | 0.13 | 0.33 | 0.52 | 0.55 | 0.95 | 0.82 | 0.00 | 0.00 | 0.00 |
| normal, mean over all runs | 0.00 | 0.00 | 0.00 | 0.08 | 0.13 | 0.33 | 0.50 | 0.50 | 0.75 | 0.58 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 19 | 17 | 13 | 13 | 13 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.29.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.5 | 1.2 | 1.7 | 1.7 | 2.1 | 2.0 | 2.3 | 2.1 | 2.3 | 2.5 | 1.4 | 1.6 | 1.5 |
| kills a minute | 46 | 44 | 52 | 50 | 50 | 51 | 52 | 46 | 49 | 58 | 31 | 41 | 43 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 0.7 | 4.8 | 3.3 | 6.1 | 8.0 | 7.9 | 9.0 | 9.2 | 10.2 | 0.7 | 0.9 | 0.8 |
| runs with ≥ 1 | 25% | 42% | 100% | 96% | 100% | 100% | 100% | 100% | 100% | 100% | 42% | 63% | 54% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 26.0 | 30.4 | 43.7 | 44.4 | 47.9 | 52.3 | 54.9 | 54.9 | 62.3 | 71.6 |
| launches (encounters off) | 26.0 | 30.4 | 43.7 | 44.4 | 47.9 | 52.3 | 54.9 | 54.9 | 62.3 | 71.6 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 26 | 34 | 45 | 51 | 52 | 62 | 71 | 78 | 90 | 107 |
| ratio to table × scale | 1.00 | 0.89 | 0.97 | 0.87 | 0.92 | 0.84 | 0.77 | 0.70 | 0.69 | 0.67 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 27% / 10% | 42% / 41% | 31% / 49% | 35.7 | middle | early |
| 2 | 1–9 | 34% / 7% | 44% / 59% | 22% / 34% | 31.7 | middle | late |
| all | 1–9 | 30% / 9% | 43% / 49% | 27% / 43% | 67.4 | middle | late |
| 1 | 1–13 | 27% / 9% | 41% / 46% | 32% / 45% | 47.9 | middle | early |
| 2 | 1–13 | 33% / 16% | 43% / 53% | 23% / 30% | 43.6 | middle | late |
| all | 1–13 | 30% / 12% | 42% / 49% | 28% / 38% | 91.5 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.1 | 8.1 | 6.9 | 6.5 | 5.8 | 5.1 | 5.0 | 4.3 | 4.2 | 4.1 | 6.0 | 5.5 | 5.7 |
| launches read | 624 | 729 | 1047 | 1064 | 1074 | 1248 | 1290 | 1269 | 1470 | 1673 | 358 | 350 | 346 |

Slope over waves 1–10: -0.60 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 |
| runs that reached it | 13 | 13 | 13 |
| tough, every run | 0.00 | 0.00 | 0.04 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 19 | 17 | 13 | 13 | 13 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.1** | **0.0** | **0.1** | **0.4** | **0.0** | **0.0** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.0 | 0.1 | 0.3 | 0.0 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.06 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.04 | 0.05 | 0.05 | 0.24 | 0.00 | 0.00 | 0.00 |
| runs with no save | 100% | 100% | 100% | 96% | 100% | 92% | 87% | 95% | 89% | 82% | 100% | 100% | 100% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.00 | 0.05 | 0.06 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.05 | 0.00 | 0.24 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.04 | 0.00 | 0.05 | 0.06 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.20 | 0.30 | 0.70 | 0.70 | 0.93 | 0.97 | 1.03 | 1.26 | 1.31 | 1.52 | 0.37 | 0.37 | 0.28 |
| peaks | 0.0 | 0.0 | 0.3 | 0.4 | 1.1 | 1.3 | 1.4 | 1.9 | 2.6 | 2.4 | 0.2 | 0.1 | 0.0 |
| release after a peak (s) | 0.0 | 0.0 | 0.4 | 1.1 | 2.0 | 2.0 | 2.1 | 2.1 | 3.0 | 2.0 | 0.2 | 0.2 | 0.0 |
| hot share | 0% | 0% | 1% | 2% | 4% | 5% | 6% | 9% | 11% | 12% | 1% | 0% | 0% |
| calm share | 97% | 94% | 78% | 79% | 67% | 63% | 61% | 57% | 51% | 47% | 91% | 89% | 91% |
| shape (most runs) | flat 100% | flat 96% | flat 71% | flat 62% | flat 38% | one peak 42% | sawtooth 35% | sawtooth 36% | sawtooth 53% | sawtooth rising 41% | flat 85% | flat 92% | flat 100% |
| taps follow tension (r) | 0.40 | 0.36 | 0.34 | 0.29 | 0.31 | 0.34 | 0.34 | 0.37 | 0.37 | 0.35 | 0.54 | 0.41 | 0.34 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 695 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
