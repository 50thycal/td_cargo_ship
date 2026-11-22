# Bot report: The Rig Field (`rigs`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.7; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=rigs --seeds=24 --armory=plating --out=../beforerep/plating`. Heat map: `../beforerep/plating/rigs-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +0.96; doubles on w7 (0.25→1.13) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 5.04 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 41%, cold late 25% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 9.9 s → w10 4.1 s (slope -0.63 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.21 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.09 (11), r2 0.36 (11), r3 0.18 (11); tough (every run): 0.04, 0.25, 0.13 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 7 loses 1.13 after 0.25. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest late takes 25%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (2.67 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 33%, middle 41%, late 25%.

## Ships lost per wave

Normal: won 46%, mean end wave 11.1 (14 = won), 4.0 lost in waves 1–10, 0.21 in waves 1–5. Tough: 8.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.00 | 0.17 | 0.04 | 0.25 | 1.13 | 2.08 | 1.96 | 2.67 | 0.04 | 0.25 | 0.13 |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 | 0.17 | 0.04 | 0.25 | 0.92 | 1.09 | 1.06 | 1.27 | 0.09 | 0.36 | 0.18 |
| normal, mean over all runs | 0.00 | 0.00 | 0.00 | 0.17 | 0.04 | 0.25 | 0.92 | 1.04 | 0.75 | 0.79 | 0.04 | 0.17 | 0.08 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 17 | 15 | 11 | 11 | 11 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +0.96.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.8 | 1.3 | 1.7 | 1.6 | 1.6 | 1.8 | 2.2 | 1.9 | 2.1 | 2.4 | 1.4 | 1.8 | 1.6 |
| kills a minute | 46 | 42 | 48 | 46 | 44 | 44 | 44 | 44 | 45 | 50 | 20 | 27 | 28 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.9 | 1.3 | 5.8 | 5.0 | 6.2 | 6.8 | 7.5 | 8.3 | 8.6 | 10.1 | 0.8 | 0.7 | 0.6 |
| runs with ≥ 1 | 50% | 83% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 58% | 54% | 46% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 27.0 | 28.9 | 37.7 | 38.7 | 37.8 | 45.1 | 50.0 | 50.8 | 53.1 | 62.7 |
| launches (encounters off) | 27.0 | 28.9 | 37.7 | 38.7 | 37.8 | 45.1 | 50.0 | 50.8 | 53.1 | 62.7 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 27 | 35 | 46 | 54 | 55 | 63 | 74 | 79 | 92 | 111 |
| ratio to table × scale | 1.00 | 0.83 | 0.82 | 0.72 | 0.69 | 0.72 | 0.68 | 0.64 | 0.58 | 0.56 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 33% / 13% | 41% / 50% | 25% / 37% | 86.8 | middle | late |
| all | 1–9 | 33% / 13% | 41% / 50% | 25% / 37% | 86.8 | middle | late |
| 1 | 1–13 | 33% / 14% | 40% / 48% | 27% / 38% | 123.5 | middle | late |
| all | 1–13 | 33% / 14% | 40% / 48% | 27% / 38% | 123.5 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.9 | 8.6 | 7.5 | 6.5 | 5.6 | 5.2 | 5.0 | 4.5 | 4.1 | 4.1 | 3.5 | 3.5 | 3.4 |
| launches read | 646 | 681 | 900 | 922 | 905 | 1072 | 1197 | 1213 | 1270 | 1500 | 336 | 336 | 335 |

Slope over waves 1–10: -0.63 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.09 | 0.36 | 0.18 |
| runs that reached it | 11 | 11 | 11 |
| tough, every run | 0.04 | 0.25 | 0.13 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 17 | 15 | 11 | 11 | 11 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.3** | **0.1** | **0.4** | **0.1** | **0.0** | **0.1** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.3 | 0.1 | 0.3 | 0.1 | 0.0 | 0.1 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.06 | 0.07 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.08 | 0.09 | 0.12 | 0.07 | 0.00 | 0.09 | 0.00 |
| runs with no save | 100% | 100% | 96% | 96% | 100% | 92% | 79% | 87% | 82% | 87% | 100% | 91% | 100% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.00 | 0.00 | 0.07 | 0.00 | 0.09 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.17 | 0.09 | 0.12 | 0.07 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.12 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.04 | 0.04 | 0.18 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.33 | 0.36 | 0.85 | 0.65 | 0.73 | 0.98 | 1.14 | 1.25 | 1.20 | 1.34 | 0.48 | 0.60 | 0.49 |
| peaks | 0.0 | 0.0 | 0.7 | 0.3 | 0.5 | 0.9 | 1.5 | 1.7 | 2.4 | 2.5 | 0.0 | 0.2 | 0.0 |
| release after a peak (s) | 0.0 | 0.0 | 1.2 | 0.4 | 0.7 | 1.6 | 2.4 | 2.0 | 2.4 | 2.2 | 0.0 | 0.5 | 0.0 |
| hot share | 0% | 0% | 3% | 1% | 2% | 4% | 8% | 7% | 10% | 13% | 0% | 1% | 0% |
| calm share | 91% | 92% | 74% | 77% | 75% | 67% | 61% | 62% | 55% | 52% | 78% | 66% | 73% |
| shape (most runs) | flat 100% | flat 100% | one peak 46% | flat 79% | flat 62% | one peak 42% | sawtooth 42% | one peak 39% | sawtooth 71% | sawtooth 40% | flat 100% | flat 82% | flat 100% |
| taps follow tension (r) | 0.10 | 0.05 | 0.12 | 0.18 | 0.24 | 0.31 | 0.35 | 0.33 | 0.34 | 0.37 | 0.47 | 0.28 | 0.29 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 580 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
