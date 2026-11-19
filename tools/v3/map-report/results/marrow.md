# Bot report: Lee of Marrow (`marrow`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.95; built 2026-11-19.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=marrow --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/marrow-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w7 +1.21; doubles on w5 (0.08→0.67), w7 (0.29→1.50) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 2.04 a run (92% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w6 ×1.14 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 43%, cold early 25% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 11.4 s → w10 4.0 s (slope -0.83 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.75 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.80 (5), r2 1.80 (5), r3 1.75 (4); tough (every run): 1.79, 2.71, 3.67 | about 1 a round on the bot's scale, rising | normal | INFO |
| `g-mechanic` | Radar tower standing | normal: fell by w5 in 10, by w6 14, by w10 24, in the boss rounds 0, stood to the end 0 (of 24); median w6; tough: fell by w5 in 10, by w6 14, by w10 24, in the boss rounds 0, stood to the end 0 (of 24); median w6 | worth defending: standing past wave 6 in most runs | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 6.4 lost 1–10, end 10.5; counter 8.0 lost 1–10, end 10.0 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 5 loses 0.67 after 0.08; wave 7 loses 1.50 after 0.29. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest early takes 25%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (2.08 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 25%, middle 43%, late 32%.

## Ships lost per wave

Normal: won 8%, mean end wave 9.8 (14 = won), 5.7 lost in waves 1–10, 0.75 in waves 1–5, 0.04 in bonus waves. Tough: 8.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.00 | 0.08 | 0.67 | 0.29 | 1.50 | 1.83 | 2.08 | 1.88 | 1.79 | 2.71 | 3.67 |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 | 0.08 | 0.67 | 0.29 | 1.46 | 1.57 | 1.63 | 1.25 | 1.80 | 1.80 | 1.75 |
| normal, mean over all runs | 0.00 | 0.00 | 0.00 | 0.08 | 0.67 | 0.29 | 1.46 | 1.50 | 1.08 | 0.63 | 0.38 | 0.38 | 0.29 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 16 | 12 | 5 | 5 | 4 |

Biggest one-wave step up (tough, waves 2–10): wave 7, +1.21.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 0.7 | 2.0 | 3.0 | 4.0 | 5.5 | 7.2 | 9.2 | 7.4 | 9.4 | 2.6 | 4.7 | 4.1 |
| runs with ≥ 1 | 0% | 54% | 92% | 88% | 100% | 96% | 100% | 100% | 100% | 100% | 79% | 96% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 16.4 | 25.3 | 31.5 | 23.8 | 33.5 | 28.3 | 37.4 | 40.3 | 44.3 |
| launches (encounters off) | 15.0 | 16.4 | 23.5 | 29.8 | 24.0 | 29.5 | 30.3 | 36.1 | 41.0 | 46.5 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.08 | 1.06 | 0.99 | 1.14 | 0.93 | 1.04 | 0.98 | 0.95 |
| table × scale | 15 | 20 | 26 | 30 | 31 | 36 | 41 | 45 | 52 | 62 |
| ratio to table × scale | 1.00 | 0.82 | 0.97 | 1.05 | 0.77 | 0.93 | 0.69 | 0.83 | 0.77 | 0.71 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 25% / 12% | 43% / 54% | 32% / 34% | 49.3 | middle | early |
| all | 1–9 | 25% / 12% | 43% / 54% | 32% / 34% | 49.3 | middle | early |
| 1 | 1–13 | 26% / 10% | 46% / 60% | 27% / 30% | 102.3 | middle | early |
| all | 1–13 | 26% / 10% | 46% / 60% | 27% / 30% | 102.3 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 11.4 | 9.8 | 7.2 | 6.8 | 4.3 | 4.7 | 3.0 | 3.6 | 4.0 | 4.0 | 7.2 | 6.9 | 6.1 |
| launches read | 360 | 393 | 605 | 749 | 566 | 794 | 679 | 897 | 964 | 1058 | 168 | 288 | 312 |

Slope over waves 1–10: -0.83 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.80 | 1.80 | 1.75 |
| runs that reached it | 5 | 5 | 4 |
| tough, every run | 1.79 | 2.71 | 3.67 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 16 | 12 | 5 | 5 | 4 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.3** | **0.3** | **0.5** | **0.3** | **0.2** | **0.8** | **0.2** | **0.3** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.2 | 0.2 | 0.4 | 0.2 | 0.1 | 0.5 | 0.3 | 0.3 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.17 | 0.00 | 0.00 | 0.25 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.21 | 0.25 | 0.39 | 0.19 | 0.00 | 0.80 | 0.20 | 0.25 |
| runs with no save | 100% | 100% | 100% | 100% | 100% | 79% | 79% | 65% | 81% | 92% | 40% | 80% | 75% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.09 | 0.00 | 0.00 | 0.40 | 0.20 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.09 | 0.13 | 0.08 | 0.20 | 0.00 | 0.25 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.00 | 0.13 | 0.06 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.13 | 0.17 | 0.06 | 0.08 | 0.20 | 0.00 | 0.00 |
| tension peak | 0.05 | 0.27 | 0.76 | 1.25 | 1.20 | 0.99 | 1.14 | 1.34 | 1.42 | 0.93 | 1.22 | 1.16 | 1.93 |
| peaks | 0.0 | 0.0 | 0.5 | 0.8 | 0.9 | 0.8 | 1.2 | 2.1 | 1.8 | 1.3 | 2.2 | 1.2 | 1.0 |
| release after a peak (s) | 0.0 | 0.0 | 0.7 | 1.5 | 1.5 | 2.1 | 1.9 | 1.9 | 2.7 | 1.2 | 2.6 | 3.4 | 2.5 |
| hot share | 0% | 0% | 1% | 4% | 4% | 4% | 6% | 9% | 7% | 5% | 15% | 18% | 33% |
| calm share | 100% | 96% | 83% | 88% | 81% | 79% | 70% | 62% | 60% | 67% | 55% | 45% | 41% |
| shape (most runs) | flat 100% | flat 100% | flat 54% | one peak 75% | one peak 58% | one peak 75% | one peak 50% | sawtooth 39% | sawtooth 44% | flat 42% | sawtooth 80% | one peak 80% | pinned 75% |
| taps follow tension (r) | 0.39 | 0.21 | 0.33 | 0.34 | 0.51 | 0.45 | 0.45 | 0.35 | 0.39 | 0.38 | 0.54 | 0.31 | 0.60 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 141 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, seeker, droneScreen | 4% | 10.0 | 4.8 | 8.0 | 1.86 (7) / 2.43 (7) / 1.83 (6) | 0.0 0.0 0.0 0.0 0.4 0.6 1.1 1.8 2.4 1.7 |
| off-counter | scatter, railgun, overdrive | 8% | 10.5 | 4.8 | 6.4 | 1.88 (8) / 2.13 (8) / 1.86 (7) | 0.0 0.0 0.0 0.1 0.5 0.8 0.5 1.3 1.9 1.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
