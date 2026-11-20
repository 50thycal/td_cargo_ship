# Bot report: The Archipelago (`archipelago`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.1; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=archipelago --seeds=24 --out=/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/before/none`. Heat map: `/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/before/none/archipelago-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +2.29; doubles on w6 (0.46→1.04), w7 (1.04→2.71) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 3.79 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 40%, cold late 26% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 8.6 s → w10 4.0 s (slope -0.45 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.79 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 – (0), r2 – (0), r3 – (0); tough (every run): 0.00, 0.13, 0.08 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.6; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w9 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 6 loses 1.04 after 0.46; wave 7 loses 2.71 after 1.04. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest late takes 26%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 9. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (6.92 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 34%, middle 40%, late 26%.

## Ships lost per wave

Normal: won 0%, mean end wave 7.8 (14 = won), 5.6 lost in waves 1–10, 0.79 in waves 1–5. Tough: 22.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 0.38 | 0.46 | 1.04 | 2.71 | 5.00 | 6.00 | 6.92 | 0.00 | 0.13 | 0.08 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 0.38 | 0.38 | 1.04 | 1.91 | 2.27 | 2.50 | 3.00 | – | – | – |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 0.38 | 0.38 | 1.00 | 1.83 | 1.42 | 0.42 | 0.13 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 15 | 4 | 1 | 0 | 0 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +2.29.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.5 | 2.3 | 3.8 | 4.4 | 4.8 | 6.3 | 6.5 | 6.8 | 7.5 | 8.2 | 1.2 | 2.0 | 1.6 |
| runs with ≥ 1 | 38% | 83% | 100% | 100% | 100% | 100% | 96% | 100% | 100% | 100% | 58% | 75% | 83% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 18.0 | 21.0 | 24.0 | 30.8 | 29.4 | 36.1 | 39.5 | 45.5 | 47.4 | 57.5 |
| launches (encounters off) | 18.0 | 21.0 | 24.0 | 30.8 | 29.4 | 36.1 | 39.5 | 45.5 | 47.4 | 57.5 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 18 | 23 | 29 | 35 | 36 | 41 | 48 | 52 | 60 | 72 |
| ratio to table × scale | 1.00 | 0.91 | 0.83 | 0.88 | 0.82 | 0.88 | 0.82 | 0.88 | 0.79 | 0.80 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 34% / 14% | 40% / 42% | 26% / 43% | 147.4 | middle | late |
| all | 1–9 | 34% / 14% | 40% / 42% | 26% / 43% | 147.4 | middle | late |
| 1 | 1–13 | 34% / 15% | 39% / 45% | 26% / 41% | 199.6 | middle | late |
| all | 1–13 | 34% / 15% | 39% / 45% | 26% / 41% | 199.6 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.6 | 6.9 | 5.7 | 4.9 | 4.7 | 4.5 | 3.9 | 4.0 | 3.9 | 4.0 | 6.2 | 5.9 | 6.1 |
| launches read | 432 | 501 | 576 | 734 | 702 | 864 | 945 | 1091 | 1134 | 1374 | 852 | 854 | 843 |

Slope over waves 1–10: -0.45 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | – | – | – |
| runs that reached it | 0 | 0 | 0 |
| tough, every run | 0.00 | 0.13 | 0.08 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 15 | 4 | 1 | 0 | 0 | 0 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.2** | **0.8** | **0.0** | **1.0** | – | – | – |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.2 | 0.3 | 0.7 | 0.0 | 1.0 | – | – | – |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.07 | 0.00 | 1.00 | – | – | – |
| clutch | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.17 | 0.13 | 0.53 | 0.00 | 1.00 | – | – | – |
| runs with no save | 100% | 100% | 100% | 96% | 96% | 78% | 83% | 67% | 100% | 0% | – | – | – |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.09 | 0.27 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.20 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.27 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.17 | 0.04 | 0.07 | 0.00 | 1.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.25 | 0.54 | 0.75 | 0.93 | 0.88 | 1.15 | 1.41 | 1.64 | 1.64 | 2.27 | – | – | – |
| peaks | 0.0 | 0.1 | 0.4 | 0.8 | 0.9 | 2.0 | 2.0 | 1.8 | 1.3 | 2.0 | – | – | – |
| release after a peak (s) | 0.1 | 0.3 | 0.6 | 1.6 | 1.3 | 2.5 | 2.3 | 2.3 | 2.3 | 3.0 | – | – | – |
| hot share | 0% | 1% | 2% | 3% | 4% | 8% | 13% | 16% | 19% | 30% | – | – | – |
| calm share | 95% | 86% | 82% | 73% | 73% | 64% | 60% | 51% | 49% | 37% | – | – | – |
| shape (most runs) | flat 96% | flat 87% | flat 62% | flat 42% | flat 38% | sawtooth 43% | sawtooth 30% | one peak 40% | one peak 50% | pinned 100% | – | – | – |
| taps follow tension (r) | 0.48 | 0.39 | 0.34 | 0.40 | 0.42 | 0.38 | 0.34 | 0.37 | 0.39 | 0.23 | – | – | – |

saves a run: waves 1–7 0.1, 8–10 + boss 0.6; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w9. 24 runs, 197 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
