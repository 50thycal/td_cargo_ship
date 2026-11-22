# Bot report: Dunmar Crossing (`crossing`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.65; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=crossing --seeds=24`. Heat map: `tools/v3/map-report/results/crossing-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w7 +1.67; doubles on w5 (0.42→0.96), w7 (1.29→2.96) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 3.21 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.78 of the no-encounter wave; outside on w5 ×0.83, w10 ×0.78 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 42%, cold early 26%; lane 2: hot middle 42%, cold late 28% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 9.4 s → w10 4.3 s (slope -0.58 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.92 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 – (0), r2 – (0), r3 – (0); tough (every run): 2.17, 7.96, 9.08 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.2, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 5 loses 0.96 after 0.42; wave 7 loses 2.96 after 1.29. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 5 sends ×0.83 the no-encounter wave; wave 10 sends ×0.78 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest early takes 26%), lane 2 (coldest late takes 28%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Fun (provisional): waves 8–10 and the boss rounds have no more saves than waves 1–7. The big moments should come late.
- Hardest of waves 1–10 for the bot: wave 9 (3.92 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 28%, middle 42%, late 30%.

## Ships lost per wave

Normal: won 0%, mean end wave 7.6 (14 = won), 5.8 lost in waves 1–10, 1.92 in waves 1–5, 0.04 in bonus waves. Tough: 15.6 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.04 | 0.50 | 0.42 | 0.96 | 1.29 | 2.96 | 2.71 | 3.92 | 2.79 | 2.17 | 7.96 | 9.08 |
| normal, runs that reached it | 0.00 | 0.04 | 0.50 | 0.42 | 0.96 | 1.26 | 1.80 | 1.36 | 2.17 | 0.00 | – | – | – |
| normal, mean over all runs | 0.00 | 0.04 | 0.50 | 0.42 | 0.96 | 1.21 | 1.50 | 0.63 | 0.54 | 0.00 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 11 | 6 | 2 | 0 | 0 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 7, +1.67.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.6 | 2.0 | 2.4 | 2.1 | 1.9 | 2.6 | 2.6 | 2.1 | 2.6 | 2.4 | – | – | – |
| kills a minute | 41 | 49 | 52 | 45 | 42 | 47 | 37 | 37 | 38 | 15 | – | – | – |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.5 | 1.5 | 5.2 | 3.2 | 5.0 | 6.8 | 6.3 | 6.8 | 8.9 | 6.3 | 2.3 | 3.5 | 4.0 |
| runs with ≥ 1 | 83% | 79% | 100% | 96% | 96% | 100% | 100% | 100% | 100% | 100% | 92% | 96% | 88% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 22.5 | 31.6 | 42.8 | 40.4 | 40.7 | 50.8 | 50.5 | 49.2 | 56.8 | 54.8 |
| launches (encounters off) | 26.0 | 30.4 | 43.8 | 44.3 | 49.0 | 52.8 | 55.7 | 55.3 | 62.8 | 70.8 |
| **ratio to encounters off** | 0.87 | 1.04 | 0.98 | 0.91 | **0.83** | 0.96 | 0.91 | 0.89 | 0.90 | **0.78** |
| table × scale | 26 | 34 | 45 | 51 | 52 | 62 | 71 | 78 | 90 | 107 |
| ratio to table × scale | 0.87 | 0.93 | 0.95 | 0.79 | 0.78 | 0.82 | 0.71 | 0.63 | 0.63 | 0.51 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 26% / 13% | 42% / 41% | 32% / 47% | 55.5 | middle | early |
| 2 | 1–9 | 30% / 13% | 42% / 51% | 28% / 35% | 54.4 | middle | late |
| all | 1–9 | 28% / 13% | 42% / 46% | 30% / 41% | 109.9 | middle | early |
| 1 | 1–13 | 32% / 24% | 39% / 39% | 30% / 37% | 106.4 | middle | late |
| 2 | 1–13 | 35% / 27% | 40% / 46% | 25% / 27% | 103.2 | middle | late |
| all | 1–13 | 33% / 25% | 39% / 42% | 27% / 32% | 209.6 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.4 | 8.6 | 6.9 | 6.8 | 5.4 | 5.1 | 4.8 | 4.1 | 4.3 | 4.3 | 4.1 | 3.5 | 3.5 |
| launches read | 576 | 824 | 1080 | 1005 | 1009 | 1254 | 1188 | 1173 | 1355 | 1301 | 687 | 1171 | 1394 |

Slope over waves 1–10: -0.58 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | – | – | – |
| runs that reached it | 0 | 0 | 0 |
| tough, every run | 2.17 | 7.96 | 9.08 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 11 | 6 | 2 | 0 | 0 | 0 |
| **saves a run** | **0.0** | **0.0** | **0.2** | **0.1** | **0.5** | **0.4** | **0.3** | **0.2** | **0.3** | **0.0** | – | – | – |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.1 | 0.3 | 0.3 | 0.2 | 0.2 | 0.3 | 0.0 | – | – | – |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.10 | 0.00 | 0.00 | 0.00 | – | – | – |
| clutch | 0.00 | 0.00 | 0.13 | 0.08 | 0.29 | 0.22 | 0.15 | 0.09 | 0.33 | 0.00 | – | – | – |
| runs with no save | 100% | 100% | 83% | 92% | 63% | 61% | 75% | 82% | 67% | 100% | – | – | – |
|   pickup save | 0.00 | 0.00 | 0.08 | 0.04 | 0.08 | 0.09 | 0.10 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.09 | 0.00 | 0.00 | 0.17 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.05 | 0.09 | 0.17 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.08 | 0.04 | 0.25 | 0.22 | 0.10 | 0.09 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.37 | 0.44 | 1.12 | 0.92 | 1.22 | 1.59 | 1.82 | 1.68 | 2.72 | 2.22 | – | – | – |
| peaks | 0.0 | 0.1 | 1.1 | 0.7 | 1.3 | 1.8 | 2.3 | 1.5 | 2.2 | 1.5 | – | – | – |
| release after a peak (s) | 0.0 | 0.1 | 2.9 | 1.3 | 2.2 | 2.4 | 3.0 | 3.6 | 2.4 | 1.5 | – | – | – |
| hot share | 0% | 0% | 7% | 3% | 7% | 11% | 17% | 15% | 18% | 28% | – | – | – |
| calm share | 90% | 84% | 66% | 72% | 65% | 55% | 56% | 60% | 47% | 53% | – | – | – |
| shape (most runs) | flat 96% | flat 92% | one peak 71% | flat 50% | one peak 42% | sawtooth rising 43% | sawtooth 35% | one peak 55% | one peak 50% | pinned 50% | – | – | – |
| taps follow tension (r) | 0.34 | 0.32 | 0.35 | 0.33 | 0.36 | 0.35 | 0.34 | 0.22 | 0.25 | 0.42 | – | – | – |

saves a run: waves 1–7 0.2, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w6, w7, w8, w9, w10. 24 runs, 382 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
