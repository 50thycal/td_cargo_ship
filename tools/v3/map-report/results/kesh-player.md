# Bot report: The Kesh Hook (`kesh`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.8; built 2026-11-19.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=kesh --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/kesh-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +0.42; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 3.13 a run (88% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.88 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 43%, cold late 26% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 12.1 s → w10 3.7 s (slope -0.84 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.38 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.70 (20), r2 2.45 (20), r3 2.65 (17); tough (every run): 0.63, 2.38, 4.46 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 3.5 lost 1–10, end 12.8; off-counter 4.2 lost 1–10, end 12.2 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- No safe stretch on lane 1 (coldest late takes 26%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.08 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 31%, middle 43%, late 26%.

## Ships lost per wave

Normal: won 21%, mean end wave 12.5 (14 = won), 3.2 lost in waves 1–10, 0.38 in waves 1–5. Tough: 3.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 0.13 | 0.21 | 0.33 | 0.38 | 0.71 | 0.67 | 1.08 | 0.63 | 2.38 | 4.46 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 0.13 | 0.21 | 0.33 | 0.38 | 0.71 | 0.67 | 0.83 | 0.70 | 2.45 | 2.65 |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 0.13 | 0.21 | 0.33 | 0.38 | 0.71 | 0.67 | 0.79 | 0.58 | 2.04 | 1.88 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 20 | 17 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +0.42.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 0.8 | 3.1 | 3.8 | 3.5 | 5.5 | 4.8 | 5.8 | 7.3 | 7.3 | 3.6 | 3.5 | 4.8 |
| runs with ≥ 1 | 0% | 58% | 88% | 96% | 96% | 100% | 100% | 100% | 100% | 100% | 96% | 88% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 13.0 | 15.6 | 21.1 | 22.3 | 24.3 | 24.3 | 26.1 | 32.5 | 32.2 | 39.3 |
| launches (encounters off) | 13.0 | 16.4 | 20.0 | 20.3 | 23.5 | 22.9 | 29.8 | 31.5 | 32.5 | 40.6 |
| **ratio to encounters off** | 1.00 | 0.95 | 1.06 | 1.10 | 1.03 | 1.06 | 0.88 | 1.03 | 0.99 | 0.97 |
| table × scale | 13 | 17 | 22 | 25 | 26 | 30 | 35 | 38 | 43 | 52 |
| ratio to table × scale | 1.00 | 0.92 | 0.96 | 0.89 | 0.93 | 0.81 | 0.75 | 0.86 | 0.75 | 0.76 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 31% / 19% | 43% / 69% | 26% / 12% | 48.2 | middle | late |
| all | 1–9 | 31% / 19% | 43% / 69% | 26% / 12% | 48.2 | middle | late |
| 1 | 1–13 | 23% / 11% | 45% / 55% | 32% / 33% | 104.3 | middle | early |
| all | 1–13 | 23% / 11% | 45% / 55% | 32% / 33% | 104.3 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 12.1 | 10.4 | 4.0 | 4.3 | 4.2 | 2.5 | 3.2 | 3.7 | 2.5 | 3.7 | 5.9 | 5.8 | 5.8 |
| launches read | 312 | 374 | 505 | 534 | 581 | 578 | 626 | 778 | 765 | 937 | 932 | 936 | 1149 |

Slope over waves 1–10: -0.84 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.70 | 2.45 | 2.65 |
| runs that reached it | 20 | 20 | 17 |
| tough, every run | 0.63 | 2.38 | 4.46 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 20 | 17 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.1** | **0.0** | **0.2** | **0.2** | **0.2** | **0.3** | **0.2** | **0.3** | **0.5** | **0.1** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.2 | 0.1 | 0.1 | 0.2 | 0.2 | 0.2 | 0.3 | 0.1 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.06 |
| clutch | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.17 | 0.17 | 0.04 | 0.21 | 0.13 | 0.25 | 0.35 | 0.12 |
| runs with no save | 100% | 100% | 96% | 92% | 100% | 83% | 92% | 79% | 71% | 83% | 80% | 65% | 88% |
|   pickup save | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.08 | 0.13 | 0.04 | 0.25 | 0.13 | 0.10 | 0.10 | 0.12 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.04 | 0.04 | 0.04 | 0.00 | 0.00 | 0.05 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.10 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.04 | 0.00 | 0.13 | 0.00 | 0.04 | 0.15 | 0.20 | 0.00 |
| tension peak | 0.04 | 0.41 | 1.22 | 1.34 | 1.03 | 1.13 | 0.80 | 1.16 | 1.24 | 1.33 | 1.42 | 2.11 | 3.40 |
| peaks | 0.0 | 0.1 | 0.9 | 0.8 | 0.7 | 1.0 | 0.5 | 1.0 | 1.1 | 1.3 | 1.1 | 1.1 | 0.9 |
| release after a peak (s) | 0.0 | 0.1 | 1.7 | 1.7 | 1.6 | 1.5 | 0.9 | 2.0 | 1.9 | 2.4 | 2.6 | 4.6 | 2.2 |
| hot share | 0% | 0% | 5% | 5% | 4% | 3% | 1% | 4% | 5% | 5% | 20% | 40% | 46% |
| calm share | 100% | 94% | 83% | 87% | 83% | 82% | 80% | 79% | 78% | 77% | 52% | 31% | 32% |
| shape (most runs) | flat 100% | flat 92% | one peak 62% | one peak 83% | one peak 58% | one peak 58% | flat 54% | one peak 62% | one peak 58% | one peak 74% | one peak 45% | pinned 75% | pinned 82% |
| taps follow tension (r) | 0.50 | 0.48 | 0.61 | 0.57 | 0.54 | 0.50 | 0.44 | 0.43 | 0.47 | 0.48 | 0.62 | 0.47 | 0.38 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 206 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | overdrive, railgun, focus | 29% | 12.8 | 3.3 | 3.5 | 0.87 (23) / 2.68 (22) / 2.18 (17) | 0.0 0.0 0.0 0.1 0.1 0.2 0.5 0.7 0.6 1.3 |
| off-counter | airstrike, seeker, droneScreen | 21% | 12.2 | 3.4 | 4.2 | 0.67 (18) / 2.72 (18) / 2.27 (15) | 0.0 0.0 0.1 0.1 0.1 0.4 0.5 0.7 0.8 1.6 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
