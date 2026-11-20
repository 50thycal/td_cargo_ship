# Bot report: Saltgate Canal (`saltgate`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 0.9; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=saltgate --seeds=24 --armory=latest --out=/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/before/latest`. Heat map: `/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/before/latest/saltgate-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +4.50; doubles on w5 (0.13→0.79), w7 (1.17→2.71), w9 (4.33→8.83) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 3.17 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot early 57%, cold late 19% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.0 s → w10 3.8 s (slope -0.50 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.38 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 4.00 (1), r2 1.00 (1), r3 1.00 (1); tough (every run): 0.79, 0.67, 0.92 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.0; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 5 loses 0.79 after 0.13; wave 7 loses 2.71 after 1.17; wave 9 loses 8.83 after 4.33. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Fun (provisional): waves 8–10 and the boss rounds have no more saves than waves 1–7. The big moments should come late.
- Hardest of waves 1–10 for the bot: wave 9 (8.83 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 57%, middle 24%, late 19%.

## Ships lost per wave

Normal: won 0%, mean end wave 7.9 (14 = won), 6.4 lost in waves 1–10, 1.38 in waves 1–5. Tough: 27.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.50 | 0.13 | 0.79 | 1.17 | 2.71 | 4.33 | 8.83 | 8.79 | 0.79 | 0.67 | 0.92 |
| normal, runs that reached it | 0.00 | 0.00 | 0.50 | 0.13 | 0.75 | 1.00 | 2.25 | 2.13 | 2.83 | 1.00 | 4.00 | 1.00 | 1.00 |
| normal, mean over all runs | 0.00 | 0.00 | 0.50 | 0.13 | 0.75 | 0.96 | 1.88 | 1.42 | 0.71 | 0.04 | 0.17 | 0.04 | 0.04 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 16 | 6 | 1 | 1 | 1 | 1 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +4.50.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.2 | 0.8 | 3.2 | 3.8 | 4.4 | 5.8 | 6.3 | 6.5 | 6.1 | 7.4 | 1.2 | 1.1 | 1.3 |
| runs with ≥ 1 | 17% | 50% | 96% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 75% | 58% | 67% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 14.0 | 15.7 | 24.2 | 23.5 | 25.1 | 28.4 | 31.1 | 36.5 | 38.6 | 45.6 |
| launches (encounters off) | 14.0 | 15.7 | 24.2 | 23.5 | 25.1 | 28.4 | 31.1 | 36.5 | 38.6 | 45.6 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 14 | 19 | 25 | 29 | 30 | 33 | 39 | 42 | 48 | 59 |
| ratio to table × scale | 1.00 | 0.83 | 0.97 | 0.81 | 0.84 | 0.86 | 0.80 | 0.87 | 0.80 | 0.77 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 57% / 35% | 24% / 41% | 19% / 24% | 148.3 | early | late |
| all | 1–9 | 57% / 35% | 24% / 41% | 19% / 24% | 148.3 | early | late |
| 1 | 1–13 | 60% / 43% | 23% / 37% | 17% / 20% | 203.3 | early | late |
| all | 1–13 | 60% / 43% | 23% / 37% | 17% / 20% | 203.3 | early | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.0 | 6.9 | 6.1 | 5.4 | 5.2 | 3.7 | 4.2 | 4.0 | 4.2 | 3.8 | 4.2 | 4.3 | 4.2 |
| launches read | 336 | 374 | 580 | 558 | 592 | 680 | 743 | 868 | 920 | 1082 | 436 | 442 | 454 |

Slope over waves 1–10: -0.50 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 4.00 | 1.00 | 1.00 |
| runs that reached it | 1 | 1 | 1 |
| tough, every run | 0.79 | 0.67 | 0.92 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 16 | 6 | 1 | 1 | 1 | 1 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.2** | **0.1** | **0.2** | **0.0** | **0.0** | **0.0** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.3 | 0.3 | 0.3 | 0.2 | 0.0 | 0.0 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.05 | 0.06 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.13 | 0.10 | 0.13 | 0.17 | 0.00 | 0.00 | 0.00 | 0.00 |
| runs with no save | 100% | 100% | 96% | 100% | 100% | 83% | 85% | 88% | 83% | 100% | 100% | 100% | 100% |
|   pickup save | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.05 | 0.06 | 0.17 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.15 | 0.06 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.20 | 0.26 | 0.68 | 0.64 | 0.84 | 0.88 | 1.08 | 1.18 | 0.81 | 0.69 | 1.40 | 0.83 | 0.99 |
| peaks | 0.0 | 0.0 | 0.3 | 0.3 | 0.7 | 0.7 | 1.7 | 1.3 | 1.0 | 0.0 | 1.0 | 1.0 | 1.0 |
| release after a peak (s) | 0.0 | 0.0 | 0.6 | 0.4 | 1.2 | 0.7 | 1.4 | 1.4 | 0.7 | 0.0 | 4.0 | 2.0 | 1.0 |
| hot share | 0% | 0% | 1% | 1% | 2% | 3% | 6% | 5% | 4% | 0% | 10% | 4% | 18% |
| calm share | 98% | 96% | 81% | 84% | 78% | 75% | 72% | 73% | 68% | 74% | 70% | 76% | 73% |
| shape (most runs) | flat 100% | flat 100% | flat 71% | flat 79% | flat 50% | flat 61% | sawtooth 30% | one peak 38% | flat 50% | flat 100% | one peak 100% | one peak 100% | one peak 100% |
| taps follow tension (r) | 0.50 | 0.40 | 0.44 | 0.38 | 0.38 | 0.44 | 0.36 | 0.33 | 0.54 | 0.07 | 0.63 | 0.75 | 0.76 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.0; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 313 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
