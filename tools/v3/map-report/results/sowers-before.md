# Bot report: Sowers' Reach (`sowers`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.45; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=sowers --seeds=24 --out=tools/v3/map-report/results`. (Its heat map was not kept.).

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w7 +2.29; doubles on w3 (0.21→0.58), w7 (1.88→4.17) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 3.63 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 45%, cold late 26% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 9.3 s → w10 4.5 s (slope -0.54 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.04 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 2.88 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 – (0), r2 – (0), r3 – (0); tough (every run): 0.58, 1.21, 1.42 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 3 loses 0.58 after 0.21; wave 7 loses 4.17 after 1.88. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest late takes 26%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (7.13 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 28%, middle 45%, late 26%.

## Ships lost per wave

Normal: won 0%, mean end wave 6.7 (14 = won), 5.7 lost in waves 1–10, 2.88 in waves 1–5, 0.25 in bonus waves. Tough: 27.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.04 | 0.21 | 0.58 | 1.17 | 1.00 | 1.88 | 4.17 | 5.67 | 5.63 | 7.13 | 0.58 | 1.21 | 1.42 |
| normal, runs that reached it | 0.04 | 0.21 | 0.58 | 1.17 | 0.91 | 1.29 | 2.00 | 1.86 | – | – | – | – | – |
| normal, mean over all runs | 0.04 | 0.21 | 0.58 | 1.17 | 0.88 | 1.13 | 1.17 | 0.54 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 23 | 21 | 14 | 7 | 0 | 0 | 0 | 0 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 7, +2.29.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.8 | 2.0 | 2.2 | 1.9 | 2.2 | 2.0 | 2.1 | 2.6 | – | – | – | – | – |
| kills a minute | 42 | 39 | 45 | 43 | 44 | 39 | 43 | 35 | – | – | – | – | – |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.2 | 1.4 | 3.9 | 3.6 | 5.1 | 5.6 | 7.4 | 7.3 | 7.7 | 8.4 | 1.4 | 1.3 | 1.8 |
| runs with ≥ 1 | 13% | 71% | 96% | 96% | 100% | 100% | 100% | 100% | 100% | 100% | 75% | 67% | 75% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 25.0 | 30.3 | 38.1 | 38.6 | 41.5 | 44.1 | 50.2 | 52.5 | 59.3 | 69.4 |
| launches (encounters off) | 25.0 | 30.3 | 38.1 | 38.6 | 41.5 | 44.1 | 50.2 | 52.5 | 59.3 | 69.4 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.09 | 0.98 | 0.98 | 0.88 | 0.90 | 0.83 | 0.81 | 0.77 | 0.76 | 0.74 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 28% / 20% | 45% / 49% | 26% / 31% | 99.8 | middle | late |
| all | 1–9 | 28% / 20% | 45% / 49% | 26% / 31% | 99.8 | middle | late |
| 1 | 1–13 | 30% / 22% | 46% / 51% | 24% / 27% | 147.4 | middle | late |
| all | 1–13 | 30% / 22% | 46% / 51% | 24% / 27% | 147.4 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.3 | 8.2 | 7.3 | 6.8 | 6.2 | 5.0 | 5.1 | 4.5 | 4.4 | 4.5 | 1.5 | 1.3 | 1.3 |
| launches read | 552 | 654 | 838 | 829 | 893 | 941 | 1084 | 1118 | 1282 | 1500 | 263 | 287 | 304 |

Slope over waves 1–10: -0.54 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | – | – | – |
| runs that reached it | 0 | 0 | 0 |
| tough, every run | 0.58 | 1.21 | 1.42 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 23 | 21 | 14 | 7 | 0 | 0 | 0 | 0 | 0 |
| **saves a run** | **0.0** | **0.1** | **0.0** | **0.1** | **0.2** | **0.1** | **0.4** | **0.4** | – | – | – | – | – |
| ships saved a run | 0.0 | 0.1 | 0.0 | 0.1 | 0.2 | 0.1 | 0.3 | 0.3 | – | – | – | – | – |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.21 | 0.14 | – | – | – | – | – |
| clutch | 0.00 | 0.04 | 0.00 | 0.00 | 0.17 | 0.10 | 0.29 | 0.43 | – | – | – | – | – |
| runs with no save | 100% | 92% | 96% | 88% | 83% | 86% | 64% | 57% | – | – | – | – | – |
|   pickup save | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.05 | 0.21 | 0.29 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.04 | 0.09 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.07 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.08 | 0.00 | 0.08 | 0.09 | 0.05 | 0.14 | 0.14 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.17 | 0.64 | 0.92 | 0.69 | 1.09 | 1.21 | 1.73 | 1.29 | – | – | – | – | – |
| peaks | 0.0 | 0.4 | 0.8 | 0.5 | 0.9 | 1.2 | 1.7 | 1.7 | – | – | – | – | – |
| release after a peak (s) | 0.0 | 0.6 | 1.6 | 0.9 | 2.0 | 1.7 | 1.6 | 1.7 | – | – | – | – | – |
| hot share | 0% | 2% | 4% | 2% | 5% | 7% | 14% | 12% | – | – | – | – | – |
| calm share | 98% | 84% | 72% | 80% | 70% | 65% | 59% | 56% | – | – | – | – | – |
| shape (most runs) | flat 100% | flat 71% | one peak 58% | flat 58% | one peak 57% | one peak 57% | one peak 36% | one peak 57% | – | – | – | – | – |
| taps follow tension (r) | 0.44 | 0.25 | 0.27 | 0.29 | 0.29 | 0.34 | 0.31 | 0.35 | – | – | – | – | – |

saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8. 24 runs, 50 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
