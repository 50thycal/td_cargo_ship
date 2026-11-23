# Bot report: Saltgate Canal (`saltgate`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.9; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=saltgate --seeds=24 --out=/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/before/none`. Heat map: `/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/before/none/saltgate-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +7.08; doubles on w3 (0.08→0.63), w5 (0.33→2.25), w8 (3.88→10.96) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 3.25 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot early 57%, cold late 16% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.0 s → w10 3.7 s (slope -0.49 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 2.71 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 – (0), r2 – (0), r3 – (0); tough (every run): 1.58, 1.71, 1.58 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 3 loses 0.63 after 0.08; wave 5 loses 2.25 after 0.33; wave 8 loses 10.96 after 3.88. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (16.17 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 57%, middle 27%, late 16%.

## Ships lost per wave

Normal: won 0%, mean end wave 6.5 (14 = won), 5.7 lost in waves 1–10, 2.71 in waves 1–5. Tough: 50.8 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.63 | 0.33 | 2.25 | 4.29 | 3.88 | 10.96 | 12.21 | 16.17 | 1.58 | 1.71 | 1.58 |
| normal, runs that reached it | 0.00 | 0.08 | 0.63 | 0.33 | 1.67 | 2.32 | 1.90 | 1.50 | – | – | – | – | – |
| normal, mean over all runs | 0.00 | 0.08 | 0.63 | 0.33 | 1.67 | 1.83 | 0.79 | 0.38 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 19 | 10 | 6 | 0 | 0 | 0 | 0 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +7.08.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.5 | 1.0 | 3.5 | 3.3 | 3.8 | 5.0 | 6.2 | 5.7 | 6.8 | 7.5 | 1.2 | 1.0 | 1.3 |
| runs with ≥ 1 | 33% | 67% | 100% | 100% | 96% | 96% | 100% | 100% | 100% | 100% | 79% | 63% | 71% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 14.0 | 16.5 | 23.8 | 23.7 | 25.1 | 28.5 | 32.0 | 37.8 | 39.8 | 47.7 |
| launches (encounters off) | 14.0 | 16.5 | 23.8 | 23.7 | 25.1 | 28.5 | 32.0 | 37.8 | 39.8 | 47.7 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 14 | 19 | 25 | 29 | 30 | 33 | 39 | 42 | 48 | 59 |
| ratio to table × scale | 1.00 | 0.87 | 0.95 | 0.82 | 0.84 | 0.86 | 0.82 | 0.90 | 0.83 | 0.81 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 57% / 40% | 27% / 37% | 16% / 23% | 200.9 | early | late |
| all | 1–9 | 57% / 40% | 27% / 37% | 16% / 23% | 200.9 | early | late |
| 1 | 1–13 | 61% / 45% | 25% / 34% | 15% / 21% | 294.0 | early | late |
| all | 1–13 | 61% / 45% | 25% / 34% | 15% / 21% | 294.0 | early | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.0 | 6.7 | 5.9 | 5.3 | 5.2 | 3.6 | 4.2 | 3.9 | 4.1 | 3.7 | 4.2 | 4.3 | 4.2 |
| launches read | 336 | 392 | 569 | 567 | 596 | 677 | 764 | 898 | 933 | 1138 | 463 | 454 | 466 |

Slope over waves 1–10: -0.49 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | – | – | – |
| runs that reached it | 0 | 0 | 0 |
| tough, every run | 1.58 | 1.71 | 1.58 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 19 | 10 | 6 | 0 | 0 | 0 | 0 | 0 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.1** | **0.0** | **0.2** | **0.3** | **0.2** | – | – | – | – | – |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.3 | 0.0 | 0.2 | 0.2 | 0.2 | – | – | – | – | – |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.30 | 0.17 | – | – | – | – | – |
| clutch | 0.00 | 0.00 | 0.04 | 0.08 | 0.04 | 0.16 | 0.30 | 0.17 | – | – | – | – | – |
| runs with no save | 100% | 100% | 96% | 88% | 96% | 84% | 80% | 83% | – | – | – | – | – |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.11 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.17 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.04 | 0.08 | 0.00 | 0.05 | 0.30 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.24 | 0.29 | 0.72 | 0.72 | 0.95 | 1.16 | 1.57 | 1.00 | – | – | – | – | – |
| peaks | 0.0 | 0.0 | 0.5 | 0.4 | 1.0 | 1.1 | 2.0 | 1.2 | – | – | – | – | – |
| release after a peak (s) | 0.0 | 0.0 | 0.8 | 0.8 | 1.6 | 2.0 | 2.5 | 1.5 | – | – | – | – | – |
| hot share | 0% | 0% | 2% | 1% | 4% | 7% | 11% | 9% | – | – | – | – | – |
| calm share | 95% | 94% | 77% | 78% | 75% | 74% | 64% | 60% | – | – | – | – | – |
| shape (most runs) | flat 100% | flat 96% | flat 67% | flat 62% | one peak 54% | one peak 42% | sawtooth rising 40% | one peak 67% | – | – | – | – | – |
| taps follow tension (r) | 0.46 | 0.44 | 0.41 | 0.41 | 0.37 | 0.38 | 0.30 | 0.37 | – | – | – | – | – |

saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8. 24 runs, 228 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
