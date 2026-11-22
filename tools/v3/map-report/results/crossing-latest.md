# Bot report: Dunmar Crossing (`crossing`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.65; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=crossing --seeds=24 --armory=latest`. Heat map: `tools/v3/map-report/results/crossing-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +1.00; doubles on w8 (0.33→1.33) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 3.13 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.74 of the no-encounter wave; outside on w5 ×0.83, w10 ×0.74 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 36%, cold early 31%; lane 2: hot middle 39%, cold late 26% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 9.4 s → w10 4.3 s (slope -0.57 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.42 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.36 (11), r2 3.55 (11), r3 3.25 (4); tough (every run): 1.50, 5.71, 7.63 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 8 loses 1.33 after 0.33. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 5 sends ×0.83 the no-encounter wave; wave 10 sends ×0.74 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest early takes 31%), lane 2 (coldest late takes 26%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (2.04 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 33%, middle 37%, late 29%.

## Ships lost per wave

Normal: won 4%, mean end wave 10.6 (14 = won), 4.1 lost in waves 1–10, 0.42 in waves 1–5, 0.13 in bonus waves. Tough: 5.8 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.04 | 0.00 | 0.00 | 0.38 | 0.29 | 0.33 | 1.33 | 2.04 | 1.38 | 1.50 | 5.71 | 7.63 |
| normal, runs that reached it | 0.00 | 0.04 | 0.00 | 0.00 | 0.38 | 0.29 | 0.25 | 1.13 | 1.62 | 0.94 | 1.36 | 3.55 | 3.25 |
| normal, mean over all runs | 0.00 | 0.04 | 0.00 | 0.00 | 0.38 | 0.29 | 0.25 | 1.08 | 1.42 | 0.63 | 0.63 | 1.63 | 0.54 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 21 | 16 | 11 | 11 | 4 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +1.00.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.2 | 1.5 | 1.7 | 1.4 | 1.4 | 1.8 | 1.7 | 1.8 | 2.0 | 1.6 | 3.2 | 6.7 | 7.8 |
| kills a minute | 45 | 54 | 58 | 50 | 47 | 52 | 50 | 45 | 51 | 39 | 34 | 41 | 36 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.0 | 1.1 | 4.0 | 3.1 | 4.0 | 7.0 | 6.3 | 7.5 | 7.3 | 6.3 | 2.8 | 4.8 | 5.7 |
| runs with ≥ 1 | 67% | 79% | 100% | 100% | 96% | 100% | 100% | 100% | 100% | 100% | 88% | 100% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 22.5 | 31.6 | 42.7 | 39.4 | 39.3 | 49.1 | 47.6 | 49.4 | 55.5 | 53.0 |
| launches (encounters off) | 26.0 | 30.4 | 43.5 | 44.1 | 47.5 | 51.7 | 54.5 | 55.4 | 61.5 | 71.8 |
| **ratio to encounters off** | 0.87 | 1.04 | 0.98 | 0.89 | **0.83** | 0.95 | 0.87 | 0.89 | 0.90 | **0.74** |
| table × scale | 26 | 34 | 45 | 51 | 52 | 62 | 71 | 78 | 90 | 107 |
| ratio to table × scale | 0.87 | 0.93 | 0.95 | 0.77 | 0.76 | 0.79 | 0.67 | 0.63 | 0.62 | 0.50 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 31% / 20% | 36% / 43% | 33% / 37% | 29.5 | middle | early |
| 2 | 1–9 | 35% / 20% | 39% / 46% | 26% / 35% | 28.4 | middle | late |
| all | 1–9 | 33% / 20% | 37% / 44% | 29% / 36% | 57.9 | middle | late |
| 1 | 1–13 | 34% / 24% | 36% / 41% | 31% / 35% | 70.7 | middle | late |
| 2 | 1–13 | 39% / 32% | 36% / 39% | 26% / 29% | 67.9 | early | late |
| all | 1–13 | 36% / 28% | 36% / 40% | 28% / 32% | 138.6 | early | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.4 | 8.2 | 7.1 | 6.9 | 5.6 | 5.1 | 5.2 | 4.1 | 4.3 | 4.3 | 4.4 | 3.6 | 3.5 |
| launches read | 576 | 819 | 1076 | 976 | 977 | 1210 | 1110 | 1176 | 1322 | 1260 | 650 | 1107 | 1363 |

Slope over waves 1–10: -0.57 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.36 | 3.55 | 3.25 |
| runs that reached it | 11 | 11 | 4 |
| tough, every run | 1.50 | 5.71 | 7.63 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 21 | 16 | 11 | 11 | 4 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.1** | **0.2** | **0.3** | **0.1** | **0.0** | **0.4** | **0.3** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.1 | 0.2 | 0.4 | 0.0 | 0.0 | 0.3 | 0.3 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.09 | 0.00 |
| clutch | 0.00 | 0.04 | 0.00 | 0.04 | 0.04 | 0.04 | 0.08 | 0.13 | 0.33 | 0.06 | 0.00 | 0.27 | 0.25 |
| runs with no save | 100% | 96% | 100% | 96% | 92% | 92% | 92% | 78% | 76% | 94% | 100% | 73% | 75% |
|   pickup save | 0.00 | 0.04 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.09 | 0.05 | 0.00 | 0.00 | 0.36 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.10 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.04 | 0.00 | 0.10 | 0.06 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.13 | 0.10 | 0.00 | 0.00 | 0.00 | 0.25 |
| tension peak | 0.27 | 0.34 | 0.68 | 0.54 | 0.76 | 1.03 | 1.11 | 1.46 | 1.42 | 1.21 | 1.55 | 2.64 | 3.53 |
| peaks | 0.0 | 0.1 | 0.3 | 0.1 | 0.5 | 1.1 | 1.2 | 1.7 | 2.0 | 1.1 | 1.0 | 1.8 | 1.3 |
| release after a peak (s) | 0.0 | 0.1 | 0.5 | 0.2 | 0.8 | 1.7 | 1.9 | 2.7 | 2.8 | 1.9 | 2.5 | 4.5 | 1.4 |
| hot share | 0% | 0% | 1% | 0% | 2% | 5% | 5% | 9% | 11% | 7% | 17% | 47% | 39% |
| calm share | 94% | 92% | 79% | 85% | 79% | 67% | 73% | 61% | 60% | 70% | 59% | 32% | 43% |
| shape (most runs) | flat 100% | flat 92% | flat 75% | flat 87% | flat 58% | one peak 38% | one peak 42% | one peak 43% | sawtooth rising 38% | one peak 56% | one peak 36% | pinned 91% | pinned 75% |
| taps follow tension (r) | 0.38 | 0.32 | 0.33 | 0.34 | 0.32 | 0.38 | 0.29 | 0.33 | 0.30 | 0.40 | 0.36 | 0.17 | 0.06 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 553 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
