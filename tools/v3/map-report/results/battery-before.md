# Bot report: Battery Point (`battery`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.8; built 2026-11-21.
- Setup: the map card as it was before the rebuild (log v42): today's convoy controls, no encounters.
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=battery --seeds=24 `. Heat map: `(not kept)`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +3.29; doubles on w3 (0.17→1.25), w5 (0.50→1.63) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 5.38 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 46%, cold early 25% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.7 s → w10 4.4 s (slope -0.49 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 3.13 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 – (0), r2 – (0), r3 – (0); tough (every run): 4.21, 7.04, 6.29 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 3 loses 1.25 after 0.17; wave 5 loses 1.63 after 0.50. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (9.17 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 25%, middle 46%, late 29%.

## Ships lost per wave

Normal: won 0%, mean end wave 6.8 (14 = won), 5.7 lost in waves 1–10, 3.13 in waves 1–5. Tough: 27.8 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.17 | 1.25 | 0.50 | 1.63 | 1.88 | 3.00 | 4.38 | 5.88 | 9.17 | 4.21 | 7.04 | 6.29 |
| normal, runs that reached it | 0.00 | 0.17 | 1.25 | 0.46 | 1.30 | 1.05 | 0.92 | 2.44 | 2.67 | – | – | – | – |
| normal, mean over all runs | 0.00 | 0.17 | 1.25 | 0.46 | 1.25 | 0.83 | 0.46 | 0.92 | 0.33 | 0.00 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 23 | 19 | 12 | 9 | 3 | 0 | 0 | 0 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +3.29.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.8 | 3.9 | 5.4 | 6.8 | 7.4 | 9.9 | 8.6 | 10.4 | 10.5 | 13.1 | 0.0 | 0.0 | 0.0 |
| runs with ≥ 1 | 42% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0% | 0% | 0% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 29.0 | 36.0 | 44.8 | 50.6 | 53.0 | 58.2 | 56.0 | 60.6 | 68.3 | 74.9 |
| launches (encounters off) | 29.0 | 36.0 | 44.8 | 50.6 | 53.0 | 58.2 | 56.0 | 60.6 | 68.3 | 74.9 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 29 | 38 | 49 | 56 | 58 | 67 | 78 | 85 | 97 | 117 |
| ratio to table × scale | 1.00 | 0.95 | 0.91 | 0.90 | 0.91 | 0.87 | 0.72 | 0.71 | 0.70 | 0.64 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 25% / 7% | 46% / 49% | 29% / 44% | 186.2 | middle | early |
| all | 1–9 | 25% / 7% | 46% / 49% | 29% / 44% | 186.2 | middle | early |
| 1 | 1–13 | 25% / 7% | 50% / 60% | 25% / 34% | 311.4 | middle | early |
| all | 1–13 | 25% / 7% | 50% / 60% | 25% / 34% | 311.4 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.7 | 7.7 | 6.6 | 6.6 | 5.7 | 5.6 | 5.0 | 4.8 | 5.0 | 4.4 | 0.4 | 0.6 | 0.6 |
| launches read | 696 | 863 | 1072 | 1210 | 1264 | 1395 | 1340 | 1453 | 1631 | 1793 | 192 | 192 | 192 |

Slope over waves 1–10: -0.49 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | – | – | – |
| runs that reached it | 0 | 0 | 0 |
| tough, every run | 4.21 | 7.04 | 6.29 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 23 | 19 | 12 | 9 | 3 | 0 | 0 | 0 | 0 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.0** | **0.1** | **0.4** | **0.1** | **0.0** | **0.3** | – | – | – | – |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.0 | 0.1 | 0.3 | 0.1 | 0.0 | 0.6 | – | – | – | – |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.11 | 0.00 | 0.00 | 0.00 | – | – | – | – |
| clutch | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.21 | 0.08 | 0.00 | 0.33 | – | – | – | – |
| runs with no save | 100% | 100% | 92% | 96% | 91% | 68% | 92% | 100% | 67% | – | – | – | – |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.33 | 0.00 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.16 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.04 | 0.00 | 0.09 | 0.16 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.29 | 0.72 | 1.10 | 0.94 | 1.23 | 1.45 | 1.15 | 1.41 | 1.31 | – | – | – | – |
| peaks | 0.0 | 0.4 | 1.4 | 0.8 | 1.7 | 2.1 | 1.2 | 2.0 | 2.7 | – | – | – | – |
| release after a peak (s) | 0.0 | 1.1 | 2.5 | 1.6 | 2.7 | 2.3 | 2.2 | 2.4 | 1.1 | – | – | – | – |
| hot share | 0% | 2% | 8% | 3% | 10% | 11% | 5% | 11% | 15% | – | – | – | – |
| calm share | 92% | 75% | 60% | 65% | 59% | 54% | 57% | 47% | 58% | – | – | – | – |
| shape (most runs) | flat 100% | flat 58% | one peak 29% | one peak 54% | sawtooth 39% | sawtooth rising 37% | one peak 58% | sawtooth 44% | sawtooth 33% | – | – | – | – |
| taps follow tension (r) | 0.41 | 0.29 | 0.30 | 0.32 | 0.32 | 0.26 | 0.35 | 0.28 | 0.43 | – | – | – | – |

saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9. 24 runs, 184 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
