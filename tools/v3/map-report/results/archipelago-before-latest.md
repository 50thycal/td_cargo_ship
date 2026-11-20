# Bot report: The Archipelago (`archipelago`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.1; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=archipelago --seeds=24 --armory=latest --out=/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/before/latest`. Heat map: `/tmp/claude-0/-home-user-td-cargo-ship/d2acccb4-c5cb-5cb0-a98a-8692ea12c5ee/scratchpad/before/latest/archipelago-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +1.46; doubles on w7 (0.25→0.75), w8 (0.75→1.58) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 3.54 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot early 39%, cold late 27% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 8.6 s → w10 4.0 s (slope -0.45 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.13 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (7), r2 0.00 (7), r3 0.00 (7); tough (every run): 0.04, 0.08, 0.04 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 7 loses 0.75 after 0.25; wave 8 loses 1.58 after 0.75. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest late takes 27%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (3.67 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 39%, middle 34%, late 27%.

## Ships lost per wave

Normal: won 29%, mean end wave 10.4 (14 = won), 4.6 lost in waves 1–10, 0.13 in waves 1–5. Tough: 9.4 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.04 | 0.00 | 0.00 | 0.08 | 0.25 | 0.75 | 1.58 | 3.04 | 3.67 | 0.04 | 0.08 | 0.04 |
| normal, runs that reached it | 0.00 | 0.04 | 0.00 | 0.00 | 0.08 | 0.25 | 0.33 | 1.36 | 2.26 | 1.75 | 0.00 | 0.00 | 0.00 |
| normal, mean over all runs | 0.00 | 0.04 | 0.00 | 0.00 | 0.08 | 0.25 | 0.33 | 1.25 | 1.79 | 0.88 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 19 | 12 | 7 | 7 | 7 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +1.46.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 1.8 | 3.5 | 4.0 | 4.9 | 6.2 | 6.8 | 7.9 | 9.0 | 9.4 | 1.4 | 2.1 | 2.0 |
| runs with ≥ 1 | 25% | 83% | 100% | 100% | 96% | 100% | 100% | 100% | 100% | 100% | 75% | 92% | 75% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 18.0 | 21.0 | 23.1 | 29.6 | 29.3 | 35.5 | 38.4 | 44.5 | 48.7 | 56.2 |
| launches (encounters off) | 18.0 | 21.0 | 23.1 | 29.6 | 29.3 | 35.5 | 38.4 | 44.5 | 48.7 | 56.2 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 18 | 23 | 29 | 35 | 36 | 41 | 48 | 52 | 60 | 72 |
| ratio to table × scale | 1.00 | 0.91 | 0.80 | 0.85 | 0.81 | 0.87 | 0.80 | 0.86 | 0.81 | 0.78 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 39% / 17% | 34% / 48% | 27% / 35% | 100.7 | early | late |
| all | 1–9 | 39% / 17% | 34% / 48% | 27% / 35% | 100.7 | early | late |
| 1 | 1–13 | 38% / 16% | 35% / 48% | 27% / 36% | 138.7 | early | late |
| all | 1–13 | 38% / 16% | 35% / 48% | 27% / 36% | 138.7 | early | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.6 | 6.9 | 5.8 | 4.8 | 4.6 | 4.5 | 3.9 | 4.1 | 3.9 | 4.0 | 6.1 | 5.8 | 6.0 |
| launches read | 432 | 500 | 553 | 705 | 700 | 850 | 918 | 1058 | 1162 | 1342 | 855 | 852 | 855 |

Slope over waves 1–10: -0.45 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 |
| runs that reached it | 7 | 7 | 7 |
| tough, every run | 0.04 | 0.08 | 0.04 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 19 | 12 | 7 | 7 | 7 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.3** | **0.3** | **0.2** | **0.0** | **0.0** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.5 | 0.4 | 0.2 | 0.0 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.11 | 0.08 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.23 | 0.21 | 0.17 | 0.00 | 0.00 | 0.00 |
| runs with no save | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 68% | 74% | 83% | 100% | 100% | 100% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.11 | 0.08 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.16 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.00 | 0.08 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.20 | 0.46 | 0.56 | 0.70 | 0.79 | 1.05 | 0.93 | 1.21 | 1.42 | 1.14 | 0.38 | 0.48 | 0.34 |
| peaks | 0.0 | 0.2 | 0.2 | 0.4 | 0.7 | 1.3 | 1.3 | 1.8 | 2.5 | 2.3 | 0.0 | 0.1 | 0.0 |
| release after a peak (s) | 0.0 | 0.3 | 0.4 | 0.7 | 0.9 | 1.6 | 1.5 | 2.3 | 2.1 | 2.3 | 0.0 | 0.4 | 0.0 |
| hot share | 0% | 1% | 1% | 1% | 2% | 5% | 3% | 7% | 11% | 11% | 0% | 1% | 0% |
| calm share | 97% | 89% | 87% | 82% | 77% | 70% | 70% | 65% | 58% | 61% | 86% | 76% | 86% |
| shape (most runs) | flat 100% | flat 83% | flat 83% | flat 62% | flat 50% | one peak 29% | one peak 46% | sawtooth 36% | sawtooth 37% | sawtooth rising 33% | flat 100% | flat 86% | flat 100% |
| taps follow tension (r) | 0.49 | 0.40 | 0.33 | 0.41 | 0.43 | 0.36 | 0.34 | 0.37 | 0.37 | 0.26 | 0.39 | 0.20 | 0.34 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 271 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
