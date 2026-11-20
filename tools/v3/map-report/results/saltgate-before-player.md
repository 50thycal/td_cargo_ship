# Bot report: Saltgate Canal (`saltgate`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.9; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=saltgate --seeds=24 --armory=player --out=/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/before/player`. Heat map: `/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/before/player/saltgate-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w6 +0.67; doubles on w3 (0.00→0.54), w6 (0.04→0.71) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 3.83 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot early 55%, cold late 20% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.0 s → w10 3.8 s (slope -0.49 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.58 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.36 (11), r2 0.18 (11), r3 0.36 (11); tough (every run): 1.25, 0.79, 1.17 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 3 loses 0.54 after 0.00; wave 6 loses 0.71 after 0.04. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.50 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 55%, middle 25%, late 20%.

## Ships lost per wave

Normal: won 42%, mean end wave 11.3 (14 = won), 4.9 lost in waves 1–10, 0.58 in waves 1–5. Tough: 5.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.54 | 0.00 | 0.04 | 0.71 | 0.54 | 0.96 | 1.21 | 1.50 | 1.25 | 0.79 | 1.17 |
| normal, runs that reached it | 0.00 | 0.00 | 0.54 | 0.00 | 0.04 | 0.71 | 0.54 | 0.92 | 1.35 | 1.41 | 0.36 | 0.18 | 0.36 |
| normal, mean over all runs | 0.00 | 0.00 | 0.54 | 0.00 | 0.04 | 0.71 | 0.54 | 0.92 | 1.13 | 1.00 | 0.17 | 0.08 | 0.17 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 20 | 17 | 11 | 11 | 11 |

Biggest one-wave step up (tough, waves 2–10): wave 6, +0.67.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 0.6 | 4.0 | 3.8 | 4.9 | 5.8 | 5.5 | 5.5 | 6.3 | 7.5 | 1.1 | 1.1 | 0.9 |
| runs with ≥ 1 | 29% | 46% | 96% | 100% | 96% | 100% | 100% | 100% | 96% | 100% | 67% | 63% | 67% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 14.0 | 15.6 | 24.1 | 23.4 | 25.0 | 28.2 | 30.7 | 35.3 | 39.1 | 45.3 |
| launches (encounters off) | 14.0 | 15.6 | 24.1 | 23.4 | 25.0 | 28.2 | 30.7 | 35.3 | 39.1 | 45.3 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 14 | 19 | 25 | 29 | 30 | 33 | 39 | 42 | 48 | 59 |
| ratio to table × scale | 1.00 | 0.82 | 0.96 | 0.81 | 0.83 | 0.85 | 0.79 | 0.84 | 0.82 | 0.77 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 55% / 55% | 25% / 30% | 20% / 15% | 175.3 | early | late |
| all | 1–9 | 55% / 55% | 25% / 30% | 20% / 15% | 175.3 | early | late |
| 1 | 1–13 | 58% / 69% | 24% / 24% | 18% / 7% | 253.2 | early | late |
| all | 1–13 | 58% / 69% | 24% / 24% | 18% / 7% | 253.2 | early | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.0 | 7.0 | 6.0 | 5.4 | 5.2 | 3.7 | 4.2 | 4.1 | 4.1 | 3.8 | 4.2 | 4.2 | 4.4 |
| launches read | 336 | 373 | 579 | 558 | 596 | 674 | 732 | 842 | 935 | 1075 | 440 | 446 | 442 |

Slope over waves 1–10: -0.49 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.36 | 0.18 | 0.36 |
| runs that reached it | 11 | 11 | 11 |
| tough, every run | 1.25 | 0.79 | 1.17 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 20 | 17 | 11 | 11 | 11 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.1** | **0.2** | **0.0** | **0.0** | **0.2** | **0.3** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.1 | 0.2 | 0.0 | 0.0 | 0.1 | 0.2 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.08 | 0.13 | 0.08 | 0.15 | 0.00 | 0.00 | 0.00 | 0.18 |
| runs with no save | 100% | 100% | 100% | 96% | 96% | 92% | 88% | 92% | 85% | 100% | 100% | 82% | 73% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.08 | 0.04 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.15 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.18 | 0.27 |
| tension peak | 0.23 | 0.25 | 0.67 | 0.60 | 0.72 | 0.97 | 0.88 | 1.04 | 1.16 | 1.16 | 1.21 | 0.95 | 1.27 |
| peaks | 0.0 | 0.0 | 0.5 | 0.3 | 0.4 | 1.0 | 0.9 | 1.3 | 1.4 | 1.5 | 1.2 | 0.8 | 1.3 |
| release after a peak (s) | 0.0 | 0.0 | 0.9 | 0.6 | 0.8 | 1.7 | 1.9 | 2.0 | 2.1 | 1.7 | 2.7 | 2.6 | 2.5 |
| hot share | 0% | 0% | 2% | 1% | 1% | 3% | 3% | 6% | 5% | 8% | 9% | 9% | 15% |
| calm share | 96% | 96% | 81% | 83% | 78% | 74% | 73% | 68% | 68% | 65% | 74% | 62% | 59% |
| shape (most runs) | flat 100% | flat 100% | flat 54% | flat 71% | flat 62% | one peak 42% | one peak 46% | one peak 42% | one peak 40% | one peak 47% | one peak 82% | one peak 64% | one peak 73% |
| taps follow tension (r) | 0.40 | 0.40 | 0.40 | 0.45 | 0.37 | 0.41 | 0.38 | 0.38 | 0.37 | 0.37 | 0.67 | 0.59 | 0.47 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 678 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
