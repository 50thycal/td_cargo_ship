# Bot report: Dunmar Crossing (`crossing`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.65; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=crossing --seeds=24 --armory=latest`. Heat map: `tools/v3/map-report/results/crossing-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +1.58; doubles on w9 (0.58→1.54), w10 (1.54→3.13) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 3.08 a run (83% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 34%, cold late 33%; lane 2: hot middle 36%, cold late 29% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 10.1 s → w10 4.1 s (slope -0.60 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.50 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (8), r2 0.00 (8), r3 0.00 (8); tough (every run): 0.00, 0.21, 0.00 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 9 loses 1.54 after 0.58; wave 10 loses 3.13 after 1.54. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest late takes 33%), lane 2 (coldest late takes 29%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (3.13 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 34%, middle 35%, late 31%.

## Ships lost per wave

Normal: won 33%, mean end wave 10.8 (14 = won), 3.8 lost in waves 1–10, 0.50 in waves 1–5, 0.04 in bonus waves. Tough: 6.6 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 0.21 | 0.25 | 0.29 | 0.58 | 0.58 | 1.54 | 3.13 | 0.00 | 0.21 | 0.00 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 0.21 | 0.25 | 0.29 | 0.57 | 0.61 | 1.20 | 1.25 | 0.00 | 0.00 | 0.00 |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 0.21 | 0.25 | 0.29 | 0.54 | 0.58 | 1.00 | 0.83 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 20 | 16 | 8 | 8 | 8 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +1.58.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.1 | 1.1 | 1.5 | 1.4 | 1.6 | 1.6 | 1.8 | 1.9 | 2.0 | 2.4 | 1.2 | 1.6 | 1.5 |
| kills a minute | 47 | 45 | 53 | 53 | 56 | 56 | 56 | 53 | 57 | 59 | 33 | 47 | 41 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 0.6 | 4.6 | 3.1 | 6.0 | 7.9 | 7.6 | 8.7 | 9.1 | 10.0 | 1.1 | 1.1 | 1.1 |
| runs with ≥ 1 | 8% | 42% | 100% | 83% | 100% | 100% | 100% | 100% | 100% | 100% | 58% | 67% | 63% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 26.0 | 30.4 | 43.9 | 44.5 | 48.3 | 52.1 | 55.5 | 54.9 | 62.2 | 71.3 |
| launches (encounters off) | 26.0 | 30.4 | 43.9 | 44.5 | 48.3 | 52.1 | 55.5 | 54.9 | 62.2 | 71.3 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 26 | 34 | 45 | 51 | 52 | 62 | 71 | 78 | 90 | 107 |
| ratio to table × scale | 1.00 | 0.89 | 0.97 | 0.87 | 0.93 | 0.84 | 0.78 | 0.70 | 0.69 | 0.67 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 34% / 16% | 34% / 36% | 33% / 49% | 36.0 | middle | late |
| 2 | 1–9 | 34% / 8% | 36% / 46% | 29% / 46% | 34.8 | middle | late |
| all | 1–9 | 34% / 12% | 35% / 40% | 31% / 48% | 70.9 | middle | late |
| 1 | 1–13 | 32% / 14% | 34% / 44% | 34% / 42% | 53.8 | middle | early |
| 2 | 1–13 | 34% / 13% | 40% / 56% | 26% / 31% | 51.5 | middle | late |
| all | 1–13 | 33% / 13% | 37% / 50% | 30% / 37% | 105.3 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.1 | 8.1 | 6.8 | 6.5 | 5.7 | 5.1 | 4.9 | 4.3 | 4.3 | 4.1 | 5.7 | 5.6 | 5.6 |
| launches read | 624 | 725 | 1049 | 1061 | 1082 | 1245 | 1302 | 1270 | 1466 | 1661 | 351 | 358 | 352 |

Slope over waves 1–10: -0.60 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 |
| runs that reached it | 8 | 8 | 8 |
| tough, every run | 0.00 | 0.21 | 0.00 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 20 | 16 | 8 | 8 | 8 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.1** | **0.1** | **0.0** | **0.0** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.1 | 0.3 | 0.0 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.09 | 0.09 | 0.10 | 0.06 | 0.00 | 0.00 | 0.00 |
| runs with no save | 100% | 100% | 100% | 96% | 96% | 96% | 96% | 91% | 85% | 88% | 100% | 100% | 100% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.09 | 0.04 | 0.05 | 0.06 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.06 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.16 | 0.32 | 0.70 | 0.62 | 0.87 | 0.92 | 1.11 | 1.20 | 1.35 | 1.65 | 0.54 | 0.28 | 0.38 |
| peaks | 0.0 | 0.0 | 0.4 | 0.3 | 0.8 | 0.8 | 1.6 | 1.4 | 1.9 | 2.0 | 0.0 | 0.0 | 0.0 |
| release after a peak (s) | 0.0 | 0.2 | 0.8 | 0.7 | 1.4 | 1.3 | 2.2 | 2.1 | 2.4 | 2.2 | 0.0 | 0.0 | 0.0 |
| hot share | 0% | 0% | 2% | 1% | 3% | 3% | 6% | 7% | 9% | 15% | 0% | 0% | 0% |
| calm share | 99% | 93% | 77% | 82% | 74% | 71% | 66% | 63% | 58% | 49% | 89% | 91% | 87% |
| shape (most runs) | flat 100% | flat 96% | flat 62% | flat 79% | flat 42% | flat 46% | one peak 43% | one peak 39% | one peak 50% | one peak 50% | flat 100% | flat 100% | flat 100% |
| taps follow tension (r) | 0.39 | 0.29 | 0.31 | 0.34 | 0.31 | 0.31 | 0.32 | 0.34 | 0.33 | 0.35 | 0.43 | 0.41 | 0.36 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 680 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
