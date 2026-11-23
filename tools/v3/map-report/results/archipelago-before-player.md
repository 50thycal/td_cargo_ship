# Bot report: The Archipelago (`archipelago`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.1; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=archipelago --seeds=24 --armory=player --out=/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/before/player`. Heat map: `/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/before/player/archipelago-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w7 +0.92; doubles on w7 (0.00→0.92), w9 (0.33→0.79) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 3.75 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 41%, cold late 23% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.6 s → w10 4.0 s (slope -0.44 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.08 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (20), r2 0.05 (20), r3 0.00 (20); tough (every run): 0.00, 0.04, 0.00 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 7 loses 0.92 after 0.00; wave 9 loses 0.79 after 0.33. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.29 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 36%, middle 41%, late 23%.

## Ships lost per wave

Normal: won 83%, mean end wave 13.3 (14 = won), 3.2 lost in waves 1–10, 0.08 in waves 1–5. Tough: 3.4 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.92 | 0.33 | 0.79 | 1.29 | 0.00 | 0.04 | 0.00 |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.92 | 0.33 | 0.75 | 1.23 | 0.00 | 0.05 | 0.00 |
| normal, mean over all runs | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.92 | 0.33 | 0.75 | 1.13 | 0.00 | 0.04 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 20 | 20 | 20 |

Biggest one-wave step up (tough, waves 2–10): wave 7, +0.92.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.6 | 2.1 | 3.8 | 4.5 | 5.4 | 6.6 | 6.8 | 8.3 | 7.9 | 9.9 | 2.0 | 2.0 | 1.9 |
| runs with ≥ 1 | 38% | 92% | 96% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 67% | 79% | 79% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 18.0 | 21.0 | 22.8 | 29.5 | 28.9 | 35.3 | 38.5 | 43.4 | 46.7 | 53.0 |
| launches (encounters off) | 18.0 | 21.0 | 22.8 | 29.5 | 28.9 | 35.3 | 38.5 | 43.4 | 46.7 | 53.0 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 18 | 23 | 29 | 35 | 36 | 41 | 48 | 52 | 60 | 72 |
| ratio to table × scale | 1.00 | 0.91 | 0.78 | 0.84 | 0.80 | 0.86 | 0.80 | 0.83 | 0.78 | 0.74 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 36% / 18% | 41% / 53% | 23% / 29% | 119.8 | middle | late |
| all | 1–9 | 36% / 18% | 41% / 53% | 23% / 29% | 119.8 | middle | late |
| 1 | 1–13 | 35% / 22% | 40% / 52% | 24% / 27% | 163.3 | middle | late |
| all | 1–13 | 35% / 22% | 40% / 52% | 24% / 27% | 163.3 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.6 | 6.8 | 5.8 | 5.0 | 4.7 | 4.7 | 4.1 | 4.0 | 4.0 | 4.0 | 6.0 | 5.9 | 5.9 |
| launches read | 432 | 503 | 545 | 706 | 693 | 848 | 921 | 1037 | 1112 | 1265 | 856 | 857 | 852 |

Slope over waves 1–10: -0.44 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 0.05 | 0.00 |
| runs that reached it | 20 | 20 | 20 |
| tough, every run | 0.00 | 0.04 | 0.00 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 20 | 20 | 20 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.3** | **0.2** | **0.1** | **0.0** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.0 | 0.0 | 0.2 | 0.2 | 0.1 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.04 | 0.17 | 0.18 | 0.05 | 0.00 | 0.00 |
| runs with no save | 100% | 100% | 100% | 96% | 96% | 100% | 100% | 96% | 79% | 82% | 95% | 100% | 100% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.18 | 0.05 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.04 | 0.08 | 0.05 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.22 | 0.52 | 0.53 | 0.70 | 0.78 | 0.88 | 1.11 | 1.05 | 1.27 | 1.47 | 0.37 | 0.41 | 0.42 |
| peaks | 0.0 | 0.1 | 0.3 | 0.5 | 0.5 | 0.9 | 1.6 | 1.6 | 2.0 | 2.4 | 0.1 | 0.1 | 0.1 |
| release after a peak (s) | 0.0 | 0.3 | 0.5 | 1.0 | 1.1 | 1.6 | 2.5 | 1.9 | 2.1 | 3.1 | 0.1 | 0.1 | 0.1 |
| hot share | 0% | 0% | 1% | 2% | 2% | 3% | 6% | 6% | 8% | 10% | 0% | 1% | 0% |
| calm share | 95% | 87% | 87% | 81% | 77% | 73% | 65% | 62% | 64% | 60% | 89% | 82% | 80% |
| shape (most runs) | flat 100% | flat 87% | flat 75% | flat 58% | flat 50% | one peak 46% | one peak 46% | sawtooth 46% | sawtooth 33% | sawtooth 36% | flat 95% | flat 95% | flat 95% |
| taps follow tension (r) | 0.48 | 0.40 | 0.37 | 0.40 | 0.42 | 0.39 | 0.35 | 0.39 | 0.35 | 0.37 | 0.41 | 0.38 | 0.23 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 482 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
