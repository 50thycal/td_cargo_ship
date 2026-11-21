# Bot report: Sowers' Reach (`sowers`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.45; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=sowers --seeds=24 --armory=plating --out=tools/v3/map-report/results`. Heat map: `tools/v3/map-report/results/sowers-before-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +1.17; doubles on w6 (0.21→0.58), w7 (0.58→1.25) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 4.08 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 46%, cold early 20% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.3 s → w10 4.5 s (slope -0.54 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.71 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.00 (6), r2 0.00 (6), r3 0.00 (6); tough (every run): 0.54, 0.42, 0.38 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 6 loses 0.58 after 0.21; wave 7 loses 1.25 after 0.58. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (2.79 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 20%, middle 46%, late 34%.

## Ships lost per wave

Normal: won 25%, mean end wave 10.0 (14 = won), 5.4 lost in waves 1–10, 0.71 in waves 1–5. Tough: 8.6 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.13 | 0.38 | 0.21 | 0.58 | 1.25 | 1.63 | 1.63 | 2.79 | 0.54 | 0.42 | 0.38 |
| normal, runs that reached it | 0.00 | 0.00 | 0.13 | 0.38 | 0.21 | 0.58 | 1.25 | 1.23 | 1.60 | 1.55 | 1.00 | 0.00 | 0.00 |
| normal, mean over all runs | 0.00 | 0.00 | 0.13 | 0.38 | 0.21 | 0.58 | 1.25 | 1.13 | 1.00 | 0.71 | 0.25 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 15 | 11 | 6 | 6 | 6 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +1.17.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.7 | 1.6 | 1.8 | 1.7 | 1.8 | 1.9 | 2.1 | 2.2 | 2.3 | 2.4 | 1.3 | 1.2 | 1.2 |
| kills a minute | 43 | 42 | 49 | 45 | 46 | 44 | 47 | 44 | 47 | 50 | 18 | 25 | 27 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.2 | 1.3 | 4.2 | 4.1 | 4.9 | 6.6 | 6.0 | 7.3 | 7.2 | 8.4 | 0.8 | 1.0 | 1.3 |
| runs with ≥ 1 | 17% | 88% | 100% | 100% | 100% | 96% | 100% | 100% | 100% | 100% | 58% | 63% | 83% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 25.0 | 30.0 | 38.3 | 39.2 | 41.0 | 44.3 | 48.6 | 53.1 | 58.4 | 68.0 |
| launches (encounters off) | 25.0 | 30.0 | 38.3 | 39.2 | 41.0 | 44.3 | 48.6 | 53.1 | 58.4 | 68.0 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.09 | 0.97 | 0.98 | 0.89 | 0.89 | 0.83 | 0.78 | 0.78 | 0.75 | 0.72 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 20% / 6% | 46% / 52% | 34% / 42% | 48.9 | middle | early |
| all | 1–9 | 20% / 6% | 46% / 52% | 34% / 42% | 48.9 | middle | early |
| 1 | 1–13 | 21% / 10% | 50% / 55% | 29% / 35% | 72.9 | middle | early |
| all | 1–13 | 21% / 10% | 50% / 55% | 29% / 35% | 72.9 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.3 | 8.4 | 7.2 | 6.6 | 6.0 | 5.0 | 5.0 | 4.6 | 4.5 | 4.5 | 1.5 | 1.3 | 1.2 |
| launches read | 552 | 645 | 847 | 842 | 888 | 941 | 1044 | 1131 | 1256 | 1469 | 247 | 249 | 262 |

Slope over waves 1–10: -0.54 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.00 | 0.00 | 0.00 |
| runs that reached it | 6 | 6 | 6 |
| tough, every run | 0.54 | 0.42 | 0.38 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 15 | 11 | 6 | 6 | 6 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.3** | **0.2** | **0.1** | **0.9** | **0.2** | **0.0** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.3 | 0.2 | 0.1 | 0.7 | 0.1 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.05 | 0.00 | 0.18 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.08 | 0.21 | 0.09 | 0.13 | 0.45 | 0.17 | 0.00 | 0.00 |
| runs with no save | 100% | 96% | 100% | 96% | 100% | 92% | 75% | 77% | 87% | 55% | 83% | 100% | 100% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.09 | 0.07 | 0.45 | 0.17 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.13 | 0.00 | 0.07 | 0.09 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.17 | 0.14 | 0.00 | 0.27 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.14 | 0.39 | 0.62 | 0.62 | 0.84 | 0.96 | 1.18 | 1.22 | 1.28 | 1.66 | 1.17 | 0.67 | 0.62 |
| peaks | 0.0 | 0.0 | 0.3 | 0.3 | 0.9 | 0.8 | 1.5 | 1.5 | 1.5 | 2.0 | 0.8 | 0.2 | 0.5 |
| release after a peak (s) | 0.0 | 0.1 | 0.6 | 0.9 | 1.2 | 1.4 | 2.0 | 2.2 | 1.9 | 2.4 | 1.8 | 0.2 | 0.7 |
| hot share | 0% | 0% | 1% | 1% | 2% | 3% | 8% | 8% | 9% | 17% | 5% | 2% | 3% |
| calm share | 99% | 91% | 80% | 82% | 76% | 72% | 66% | 62% | 60% | 58% | 71% | 75% | 73% |
| shape (most runs) | flat 100% | flat 96% | flat 75% | flat 75% | one peak 46% | flat 42% | sawtooth 33% | one peak 45% | one peak 27% | one peak 36% | one peak 83% | flat 83% | one peak 50% |
| taps follow tension (r) | 0.46 | 0.30 | 0.24 | 0.31 | 0.24 | 0.33 | 0.32 | 0.32 | 0.23 | 0.44 | 0.52 | 0.61 | 0.60 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9. 24 runs, 88 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
