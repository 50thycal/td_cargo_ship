# Bot report: Dunmar Crossing (`crossing`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.65; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=crossing --seeds=24`. Heat map: `tools/v3/map-report/results/crossing-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +2.83; doubles on w4 (0.29→0.79), w7 (0.92→2.08) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 3.29 a run (88% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 40%, cold late 26%; lane 2: hot middle 44%, cold late 23% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 10.1 s → w10 4.0 s (slope -0.61 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 2.29 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 – (0), r2 – (0), r3 – (0); tough (every run): 0.21, 0.00, 0.00 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.0; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 4 loses 0.79 after 0.29; wave 7 loses 2.08 after 0.92. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest late takes 26%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Fun (provisional): waves 8–10 and the boss rounds have no more saves than waves 1–7. The big moments should come late.
- Hardest of waves 1–10 for the bot: wave 10 (7.25 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 34%, middle 42%, late 24%.

## Ships lost per wave

Normal: won 0%, mean end wave 6.9 (14 = won), 4.3 lost in waves 1–10, 2.29 in waves 1–5, 0.13 in bonus waves. Tough: 23.9 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.29 | 0.79 | 1.38 | 0.92 | 2.08 | 4.17 | 7.00 | 7.25 | 0.21 | 0.00 | 0.00 |
| normal, runs that reached it | 0.00 | 0.00 | 0.29 | 0.79 | 1.21 | 0.62 | 1.27 | 1.50 | 1.50 | – | – | – | – |
| normal, mean over all runs | 0.00 | 0.00 | 0.29 | 0.79 | 1.21 | 0.54 | 0.79 | 0.38 | 0.25 | 0.00 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 21 | 15 | 6 | 4 | 0 | 0 | 0 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +2.83.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.6 | 1.3 | 2.1 | 2.1 | 2.3 | 2.3 | 2.7 | 1.9 | 2.6 | – | – | – | – |
| kills a minute | 44 | 44 | 50 | 46 | 49 | 48 | 46 | 42 | 32 | – | – | – | – |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.5 | 1.0 | 5.1 | 3.3 | 5.3 | 6.4 | 8.2 | 7.2 | 9.5 | 10.8 | 1.0 | 1.1 | 0.7 |
| runs with ≥ 1 | 42% | 54% | 100% | 88% | 100% | 100% | 100% | 100% | 100% | 100% | 50% | 63% | 46% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 26.0 | 30.4 | 43.9 | 44.7 | 48.4 | 52.7 | 56.0 | 55.0 | 62.8 | 73.5 |
| launches (encounters off) | 26.0 | 30.4 | 43.9 | 44.7 | 48.4 | 52.7 | 56.0 | 55.0 | 62.8 | 73.5 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 26 | 34 | 45 | 51 | 52 | 62 | 71 | 78 | 90 | 107 |
| ratio to table × scale | 1.00 | 0.89 | 0.97 | 0.88 | 0.93 | 0.85 | 0.79 | 0.71 | 0.70 | 0.69 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 34% / 14% | 40% / 48% | 26% / 38% | 79.4 | middle | late |
| 2 | 1–9 | 33% / 15% | 44% / 52% | 23% / 33% | 80.7 | middle | late |
| all | 1–9 | 34% / 15% | 42% / 50% | 24% / 36% | 160.1 | middle | late |
| 1 | 1–13 | 33% / 12% | 40% / 49% | 26% / 38% | 104.6 | middle | late |
| 2 | 1–13 | 33% / 12% | 44% / 53% | 23% / 35% | 104.0 | middle | late |
| all | 1–13 | 33% / 12% | 42% / 51% | 25% / 36% | 208.6 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.1 | 8.1 | 7.0 | 6.4 | 5.8 | 5.0 | 5.0 | 4.3 | 4.3 | 4.0 | 5.8 | 5.6 | 5.9 |
| launches read | 624 | 729 | 1052 | 1071 | 1086 | 1260 | 1315 | 1274 | 1488 | 1716 | 359 | 347 | 343 |

Slope over waves 1–10: -0.61 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | – | – | – |
| runs that reached it | 0 | 0 | 0 |
| tough, every run | 0.21 | 0.00 | 0.00 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 21 | 15 | 6 | 4 | 0 | 0 | 0 | 0 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.1** | **0.0** | **0.0** | **0.3** | **0.0** | **0.0** | – | – | – | – |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.2 | 0.0 | 0.0 | 0.3 | 0.0 | 0.0 | – | – | – | – |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | – | – | – | – |
| clutch | 0.00 | 0.00 | 0.08 | 0.08 | 0.04 | 0.05 | 0.20 | 0.00 | 0.00 | – | – | – | – |
| runs with no save | 100% | 100% | 92% | 92% | 96% | 95% | 73% | 100% | 100% | – | – | – | – |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.05 | 0.07 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.07 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.07 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.07 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.26 | 0.40 | 0.93 | 0.88 | 1.18 | 1.48 | 1.53 | 1.54 | 1.42 | – | – | – | – |
| peaks | 0.0 | 0.1 | 1.2 | 1.2 | 1.4 | 2.7 | 1.9 | 1.0 | 2.0 | – | – | – | – |
| release after a peak (s) | 0.0 | 0.1 | 1.7 | 1.5 | 2.4 | 2.3 | 2.4 | 2.2 | 1.7 | – | – | – | – |
| hot share | 0% | 0% | 5% | 5% | 9% | 12% | 15% | 11% | 27% | – | – | – | – |
| calm share | 95% | 92% | 67% | 68% | 62% | 50% | 50% | 54% | 50% | – | – | – | – |
| shape (most runs) | flat 100% | flat 92% | one peak 42% | one peak 38% | one peak 38% | sawtooth rising 48% | one peak 27% | one peak 67% | sawtooth rising 50% | – | – | – | – |
| taps follow tension (r) | 0.37 | 0.35 | 0.35 | 0.33 | 0.36 | 0.31 | 0.31 | 0.39 | 0.57 | – | – | – | – |

saves a run: waves 1–7 0.1, 8–10 + boss 0.0; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9. 24 runs, 405 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
