# Bot report: Dreadnought Pass (`dreadnought`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 0.85; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=dreadnought --seeds=24 --armory=plating --out=/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/before/plating`. Heat map: `/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/before/plating/dreadnought-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +1.92; doubles on w9 (0.25→2.17) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 3.67 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 42%, cold late 28% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 7.7 s → w10 3.9 s (slope -0.51 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.00 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (12), r2 0.08 (12), r3 0.08 (12); tough (every run): 0.00, 0.08, 0.13 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 9 loses 2.17 after 0.25. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest late takes 28%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (2.75 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 30%, middle 42%, late 28%.

## Ships lost per wave

Normal: won 50%, mean end wave 11.8 (14 = won), 3.5 lost in waves 1–10, 0.00 in waves 1–5. Tough: 5.8 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.21 | 0.46 | 0.25 | 2.17 | 2.75 | 0.00 | 0.08 | 0.13 |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.21 | 0.46 | 0.22 | 1.65 | 1.20 | 0.00 | 0.08 | 0.08 |
| normal, mean over all runs | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.21 | 0.46 | 0.21 | 1.58 | 1.00 | 0.00 | 0.04 | 0.04 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 20 | 12 | 12 | 12 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +1.92.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.0 | 0.7 | 1.4 | 0.7 | 0.7 | 1.3 | 1.5 | 1.3 | 1.9 | 2.5 | 1.1 | 1.7 | 1.9 |
| kills a minute | 28 | 21 | 34 | 23 | 24 | 33 | 32 | 33 | 41 | 38 | 34 | 40 | 39 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 0.4 | 7.9 | 3.7 | 4.0 | 8.2 | 6.5 | 7.6 | 11.3 | 8.2 | 0.1 | 0.3 | 0.5 |
| runs with ≥ 1 | 0% | 42% | 100% | 100% | 96% | 100% | 100% | 100% | 100% | 100% | 8% | 21% | 25% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 14.0 | 13.6 | 39.1 | 18.8 | 20.4 | 37.8 | 33.0 | 35.5 | 55.5 | 61.0 |
| launches (encounters off) | 14.0 | 13.6 | 39.1 | 18.8 | 20.4 | 37.8 | 33.0 | 35.5 | 55.5 | 61.0 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 14 | 18 | 23 | 26 | 27 | 32 | 36 | 40 | 46 | 55 |
| ratio to table × scale | 1.00 | 0.75 | 1.70 | 0.72 | 0.75 | 1.18 | 0.92 | 0.89 | 1.21 | 1.11 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 30% / 8% | 42% / 43% | 28% / 49% | 76.5 | middle | late |
| all | 1–9 | 30% / 8% | 42% / 43% | 28% / 49% | 76.5 | middle | late |
| 1 | 1–13 | 29% / 8% | 42% / 45% | 29% / 48% | 114.8 | middle | late |
| all | 1–13 | 29% / 8% | 42% / 45% | 29% / 48% | 114.8 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.7 | 9.2 | 5.4 | 5.6 | 4.7 | 3.8 | 4.5 | 4.2 | 3.6 | 3.9 | 7.8 | 7.6 | 7.5 |
| launches read | 336 | 326 | 938 | 452 | 487 | 907 | 790 | 849 | 1324 | 1454 | 447 | 453 | 459 |

Slope over waves 1–10: -0.51 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 0.08 | 0.08 |
| runs that reached it | 12 | 12 | 12 |
| tough, every run | 0.00 | 0.08 | 0.13 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 20 | 12 | 12 | 12 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.0** | **0.0** | **0.3** | **0.7** | **0.0** | **0.1** | **0.1** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.0 | 0.2 | 0.6 | 0.0 | 0.1 | 0.1 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.10 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.13 | 0.35 | 0.00 | 0.00 | 0.00 |
| runs with no save | 100% | 100% | 100% | 100% | 100% | 88% | 96% | 96% | 78% | 60% | 100% | 92% | 92% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.20 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.09 | 0.40 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.05 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.09 | 0.05 | 0.00 | 0.08 | 0.08 |
| tension peak | 0.06 | 0.22 | 1.22 | 0.48 | 0.60 | 1.08 | 1.03 | 1.03 | 1.61 | 1.94 | 0.14 | 0.25 | 0.34 |
| peaks | 0.0 | 0.0 | 2.1 | 0.1 | 0.2 | 1.7 | 1.3 | 1.3 | 3.5 | 3.0 | 0.0 | 0.0 | 0.2 |
| release after a peak (s) | 0.0 | 0.0 | 1.7 | 0.3 | 0.3 | 1.6 | 1.5 | 1.5 | 2.5 | 2.5 | 0.0 | 0.0 | 0.3 |
| hot share | 0% | 0% | 5% | 0% | 1% | 5% | 5% | 4% | 15% | 20% | 0% | 0% | 1% |
| calm share | 100% | 98% | 70% | 90% | 87% | 69% | 69% | 71% | 53% | 50% | 100% | 95% | 93% |
| shape (most runs) | flat 100% | flat 100% | one peak 42% | flat 92% | flat 83% | one peak 38% | sawtooth rising 29% | one peak 39% | sawtooth 65% | sawtooth 45% | flat 100% | flat 100% | flat 83% |
| taps follow tension (r) | 0.66 | 0.24 | 0.11 | 0.35 | 0.44 | 0.22 | 0.36 | 0.31 | 0.16 | 0.16 | 0.38 | 0.36 | 0.25 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9. 24 runs, 956 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
