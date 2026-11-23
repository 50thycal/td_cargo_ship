# Bot report: Smugglers' Coves (`coves`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.25; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=coves --seeds=24 --armory=latest`. Heat map: `tools/v3/map-report/results/coves-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +1.96; doubles on w6 (0.13→1.29), w8 (0.54→2.13) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 4.04 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 39%, cold early 25% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 6.4 s → w10 4.7 s (slope -0.38 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.88 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (1), r2 0.00 (1), r3 0.00 (1); tough (every run): 0.00, 0.13, 0.21 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 6 loses 1.29 after 0.13; wave 8 loses 2.13 after 0.54. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (5.38 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 25%, middle 39%, late 36%.

## Ships lost per wave

Normal: won 4%, mean end wave 8.9 (14 = won), 5.8 lost in waves 1–10, 0.88 in waves 1–5, 0.08 in bonus waves. Tough: 14.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.38 | 0.25 | 0.13 | 0.13 | 1.29 | 0.54 | 2.13 | 4.08 | 5.38 | 0.00 | 0.13 | 0.21 |
| normal, runs that reached it | 0.00 | 0.38 | 0.25 | 0.13 | 0.13 | 1.29 | 0.50 | 1.45 | 1.71 | 3.14 | 0.00 | 0.00 | 0.00 |
| normal, mean over all runs | 0.00 | 0.38 | 0.25 | 0.13 | 0.13 | 1.29 | 0.50 | 1.21 | 1.00 | 0.92 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 20 | 14 | 7 | 1 | 1 | 1 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +1.96.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.2 | 1.9 | 1.7 | 1.3 | 1.3 | 2.0 | 1.9 | 2.2 | 2.0 | 3.1 | 4.3 | 4.1 | 3.9 |
| kills a minute | 39 | 34 | 47 | 41 | 41 | 40 | 49 | 46 | 52 | 44 | 34 | 52 | 62 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 1.5 | 4.0 | 5.1 | 6.5 | 5.1 | 8.8 | 8.9 | 9.5 | 10.5 | 1.4 | 1.2 | 1.5 |
| runs with ≥ 1 | 25% | 79% | 96% | 100% | 100% | 96% | 100% | 100% | 100% | 100% | 63% | 75% | 83% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 22.0 | 26.6 | 36.6 | 34.7 | 37.0 | 41.1 | 49.5 | 52.6 | 59.8 | 68.8 |
| launches (encounters off) | 22.0 | 26.6 | 36.6 | 34.7 | 37.0 | 41.1 | 49.5 | 52.6 | 59.8 | 68.8 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 20 | 27 | 34 | 38 | 40 | 47 | 54 | 59 | 68 | 81 |
| ratio to table × scale | 1.10 | 0.98 | 1.08 | 0.91 | 0.92 | 0.87 | 0.92 | 0.89 | 0.88 | 0.85 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 25% / 5% | 39% / 43% | 36% / 53% | 117.0 | middle | early |
| all | 1–9 | 25% / 5% | 39% / 43% | 36% / 53% | 117.0 | middle | early |
| 1 | 1–13 | 27% / 8% | 38% / 40% | 35% / 52% | 167.5 | middle | early |
| all | 1–13 | 27% / 8% | 38% / 40% | 35% / 52% | 167.5 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 6.4 | 8.9 | 8.5 | 6.6 | 5.8 | 5.7 | 5.3 | 4.9 | 5.3 | 4.7 | 7.5 | 7.5 | 7.3 |
| launches read | 528 | 638 | 807 | 829 | 884 | 946 | 1154 | 1256 | 1376 | 1634 | 336 | 336 | 336 |

Slope over waves 1–10: -0.38 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 |
| runs that reached it | 1 | 1 | 1 |
| tough, every run | 0.00 | 0.13 | 0.21 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 20 | 14 | 7 | 1 | 1 | 1 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.3** | **0.4** | **0.7** | **0.0** | **0.0** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 | 0.3 | 0.9 | 0.0 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.05 | 0.07 | 0.57 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.04 | 0.10 | 0.36 | 0.71 | 0.00 | 0.00 | 0.00 |
| runs with no save | 100% | 100% | 100% | 100% | 100% | 88% | 88% | 80% | 64% | 57% | 100% | 100% | 100% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.10 | 0.29 | 0.14 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.29 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.15 | 0.07 | 0.29 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.23 | 0.58 | 0.65 | 0.67 | 0.84 | 1.12 | 1.23 | 1.40 | 1.37 | 1.87 | 0.62 | 0.56 | 0.30 |
| peaks | 0.0 | 0.3 | 0.3 | 0.4 | 0.8 | 1.5 | 1.9 | 2.5 | 1.6 | 2.3 | 0.0 | 0.0 | 0.0 |
| release after a peak (s) | 0.0 | 0.5 | 0.5 | 0.5 | 1.1 | 1.9 | 2.3 | 2.3 | 2.4 | 2.8 | 0.0 | 0.0 | 0.0 |
| hot share | 0% | 1% | 1% | 1% | 2% | 7% | 8% | 12% | 10% | 24% | 0% | 0% | 0% |
| calm share | 96% | 82% | 79% | 79% | 73% | 67% | 61% | 56% | 55% | 46% | 59% | 75% | 94% |
| shape (most runs) | flat 100% | flat 75% | flat 75% | flat 62% | one peak 46% | one peak 33% | sawtooth 38% | sawtooth 40% | one peak 64% | sawtooth rising 43% | flat 100% | flat 100% | flat 100% |
| taps follow tension (r) | 0.53 | 0.24 | 0.24 | 0.26 | 0.39 | 0.30 | 0.29 | 0.29 | 0.28 | 0.30 | 0.38 | 0.43 | 0.56 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9. 24 runs, 344 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
