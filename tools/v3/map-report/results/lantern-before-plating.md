# Bot report: The Black Strait (`lantern`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.45; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=lantern --seeds=24 --armory=plating (on the base build, log v48)`. Heat map: `tools/v3/map-report/results/lantern-before-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +1.04; doubles on w8 (0.71→1.75) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 3.29 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 41%, cold late 27% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 13.6 s → w10 4.5 s (slope -0.86 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.29 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (9), r2 0.00 (9), r3 0.00 (9); tough (every run): 0.00, 0.08, 0.00 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 8 loses 1.75 after 0.71. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest late takes 27%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (2.58 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 32%, middle 41%, late 27%.

## Ships lost per wave

Normal: won 38%, mean end wave 10.9 (14 = won), 4.2 lost in waves 1–10, 0.29 in waves 1–5. Tough: 8.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.00 | 0.17 | 0.13 | 0.38 | 0.71 | 1.75 | 2.29 | 2.58 | 0.00 | 0.08 | 0.00 |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 | 0.17 | 0.13 | 0.38 | 0.54 | 1.17 | 1.35 | 1.20 | 0.00 | 0.00 | 0.00 |
| normal, mean over all runs | 0.00 | 0.00 | 0.00 | 0.17 | 0.13 | 0.38 | 0.54 | 1.13 | 1.13 | 0.75 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 15 | 9 | 9 | 9 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +1.04.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.5 | 1.3 | 1.6 | 1.6 | 1.7 | 1.6 | 1.8 | 2.0 | 2.2 | 2.4 | 2.0 | 2.5 | 2.9 |
| kills a minute | 42 | 40 | 44 | 42 | 42 | 40 | 42 | 40 | 45 | 48 | 47 | 64 | 60 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 1.0 | 3.3 | 4.6 | 4.7 | 6.4 | 7.6 | 8.2 | 8.4 | 8.3 | 0.0 | 0.0 | 0.0 |
| runs with ≥ 1 | 8% | 67% | 96% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 0% | 0% | 0% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 23.0 | 26.5 | 35.3 | 37.3 | 39.9 | 40.3 | 45.7 | 49.6 | 56.4 | 63.6 |
| launches (encounters off) | 23.0 | 26.5 | 35.3 | 37.3 | 39.9 | 40.3 | 45.7 | 49.6 | 56.4 | 63.6 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.00 | 0.85 | 0.90 | 0.85 | 0.87 | 0.76 | 0.74 | 0.73 | 0.72 | 0.68 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 32% / 8% | 41% / 51% | 27% / 41% | 93.6 | middle | late |
| all | 1–9 | 32% / 8% | 41% / 51% | 27% / 41% | 93.6 | middle | late |
| 1 | 1–13 | 31% / 9% | 39% / 49% | 29% / 42% | 141.0 | middle | late |
| all | 1–13 | 31% / 9% | 39% / 49% | 29% / 42% | 141.0 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 13.6 | 9.4 | 8.5 | 6.8 | 6.1 | 5.5 | 5.0 | 4.3 | 4.6 | 4.5 | 6.4 | 6.2 | 6.0 |
| launches read | 552 | 635 | 844 | 894 | 955 | 964 | 1094 | 1186 | 1345 | 1517 | 456 | 452 | 456 |

Slope over waves 1–10: -0.86 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 |
| runs that reached it | 9 | 9 | 9 |
| tough, every run | 0.00 | 0.08 | 0.00 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 15 | 9 | 9 | 9 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.3** | **0.1** | **0.1** | **0.2** | **0.2** | **0.3** | **0.0** | **0.0** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.2 | 0.1 | 0.1 | 0.2 | 0.2 | 0.3 | 0.0 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.13 | 0.17 | 0.10 | 0.27 | 0.00 | 0.00 | 0.00 |
| runs with no save | 100% | 100% | 100% | 100% | 75% | 92% | 88% | 83% | 80% | 73% | 100% | 100% | 100% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.09 | 0.10 | 0.07 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.00 | 0.13 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.04 | 0.00 | 0.09 | 0.10 | 0.07 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.11 | 0.29 | 0.58 | 0.70 | 0.85 | 0.86 | 1.05 | 1.36 | 1.29 | 1.52 | 0.15 | 0.15 | 0.16 |
| peaks | 0.0 | 0.0 | 0.1 | 0.4 | 0.8 | 1.1 | 1.7 | 2.3 | 2.2 | 2.1 | 0.0 | 0.0 | 0.0 |
| release after a peak (s) | 0.0 | 0.0 | 0.3 | 0.6 | 1.0 | 1.9 | 1.8 | 2.5 | 2.4 | 2.4 | 0.0 | 0.0 | 0.0 |
| hot share | 0% | 0% | 0% | 1% | 3% | 4% | 6% | 10% | 11% | 12% | 0% | 0% | 0% |
| calm share | 100% | 95% | 83% | 79% | 73% | 71% | 67% | 55% | 56% | 55% | 99% | 100% | 99% |
| shape (most runs) | flat 100% | flat 100% | flat 87% | flat 71% | flat 50% | flat 33% | sawtooth 46% | sawtooth rising 48% | sawtooth rising 45% | sawtooth rising 47% | flat 100% | flat 100% | flat 100% |
| taps follow tension (r) | 0.33 | 0.29 | 0.29 | 0.34 | 0.32 | 0.36 | 0.38 | 0.36 | 0.31 | 0.34 | 0.56 | 0.53 | 0.51 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 315 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
