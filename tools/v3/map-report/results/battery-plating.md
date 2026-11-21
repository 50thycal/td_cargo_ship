# Bot report: Battery Point (`battery`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.8; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=battery --seeds=24 --armory=plating --kits=plan`. Heat map: `tools/v3/map-report/results/battery-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +0.75; doubles on w9 (0.42→0.88) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 3.54 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w4 ×0.87 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 47%, cold early 20% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.9 s → w10 5.6 s (slope -0.35 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.58 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.25 (20), r2 0.65 (20), r3 1.25 (20); tough (every run): 0.21, 0.83, 1.29 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 3.5 lost 1–10, end 13.0; off-counter 3.6 lost 1–10, end 13.0 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 9 loses 0.88 after 0.42. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.63 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 20%, middle 47%, late 33%.

## Ships lost per wave

Normal: won 83%, mean end wave 13.1 (14 = won), 3.5 lost in waves 1–10, 0.58 in waves 1–5. Tough: 4.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 0.17 | 0.38 | 0.21 | 0.33 | 0.42 | 0.88 | 1.63 | 0.21 | 0.83 | 1.29 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 0.17 | 0.38 | 0.17 | 0.35 | 0.39 | 0.78 | 1.41 | 0.25 | 0.65 | 1.25 |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 0.17 | 0.38 | 0.17 | 0.33 | 0.38 | 0.75 | 1.29 | 0.21 | 0.54 | 1.04 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 23 | 22 | 20 | 20 | 20 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +0.75.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.2 | 1.8 | 3.5 | 4.2 | 3.8 | 6.5 | 6.6 | 6.2 | 5.8 | 8.7 | 1.3 | 1.5 | 1.9 |
| runs with ≥ 1 | 17% | 79% | 100% | 100% | 96% | 100% | 100% | 100% | 100% | 100% | 88% | 100% | 88% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 30.0 | 36.5 | 43.9 | 43.8 | 46.4 | 53.5 | 52.6 | 55.9 | 62.8 | 67.5 |
| launches (encounters off) | 29.0 | 36.0 | 45.3 | 50.2 | 50.6 | 57.7 | 56.7 | 61.4 | 67.0 | 75.1 |
| **ratio to encounters off** | 1.03 | 1.01 | 0.97 | 0.87 | 0.92 | 0.93 | 0.93 | 0.91 | 0.94 | 0.90 |
| table × scale | 29 | 38 | 49 | 56 | 58 | 67 | 78 | 85 | 97 | 117 |
| ratio to table × scale | 1.03 | 0.96 | 0.90 | 0.78 | 0.80 | 0.80 | 0.67 | 0.66 | 0.65 | 0.58 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 20% / 9% | 47% / 50% | 33% / 41% | 33.3 | middle | early |
| all | 1–9 | 20% / 9% | 47% / 50% | 33% / 41% | 33.3 | middle | early |
| 1 | 1–13 | 21% / 7% | 50% / 56% | 29% / 38% | 63.7 | middle | early |
| all | 1–13 | 21% / 7% | 50% / 56% | 29% / 38% | 63.7 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.9 | 7.8 | 6.9 | 6.4 | 5.9 | 6.6 | 5.3 | 6.2 | 6.0 | 5.6 | 1.7 | 1.6 | 2.0 |
| launches read | 720 | 872 | 1048 | 1047 | 1111 | 1280 | 1260 | 1333 | 1506 | 1617 | 240 | 264 | 335 |

Slope over waves 1–10: -0.35 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.25 | 0.65 | 1.25 |
| runs that reached it | 20 | 20 | 20 |
| tough, every run | 0.21 | 0.83 | 1.29 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 23 | 22 | 20 | 20 | 20 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.3** | **0.1** | **0.4** | **0.1** | **0.1** | **0.6** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 | 0.1 | 0.3 | 0.1 | 0.1 | 0.5 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.09 | 0.17 | 0.04 | 0.18 | 0.05 | 0.10 | 0.45 |
| runs with no save | 100% | 100% | 100% | 100% | 100% | 91% | 91% | 74% | 91% | 73% | 95% | 90% | 65% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.00 | 0.18 | 0.00 | 0.05 | 0.30 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.04 | 0.05 | 0.00 | 0.00 | 0.05 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.05 | 0.05 | 0.05 | 0.20 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.22 | 0.00 | 0.14 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.19 | 0.22 | 0.63 | 0.53 | 0.62 | 0.94 | 0.87 | 0.75 | 1.14 | 1.32 | 0.09 | 0.09 | 0.13 |
| peaks | 0.0 | 0.0 | 0.3 | 0.2 | 0.5 | 0.7 | 0.7 | 0.5 | 0.9 | 1.2 | 0.0 | 0.0 | 0.0 |
| release after a peak (s) | 0.0 | 0.0 | 0.6 | 0.5 | 0.6 | 1.2 | 1.5 | 1.0 | 2.0 | 3.2 | 0.0 | 0.0 | 0.0 |
| hot share | 0% | 0% | 1% | 1% | 2% | 3% | 3% | 1% | 5% | 6% | 0% | 0% | 0% |
| calm share | 98% | 96% | 88% | 89% | 83% | 77% | 79% | 82% | 75% | 74% | 100% | 100% | 99% |
| shape (most runs) | flat 100% | flat 100% | flat 71% | flat 79% | flat 67% | flat 52% | one peak 52% | one peak 52% | flat 39% | one peak 55% | flat 100% | flat 100% | flat 100% |
| taps follow tension (r) | 0.41 | 0.42 | 0.33 | 0.41 | 0.40 | 0.27 | 0.34 | 0.28 | 0.26 | 0.33 | 0.60 | 0.40 | 0.44 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 101 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | railgun, gunships, thermo | 83% | 13.0 | 3.1 | 3.5 | 0.35 (20) / 0.75 (20) / 0.95 (20) | 0.0 0.0 0.1 0.2 0.4 0.1 0.3 0.4 0.9 1.2 |
| off-counter | seeker, droneScreen, shrapnel | 83% | 13.0 | 3.1 | 3.6 | 0.25 (20) / 0.85 (20) / 0.85 (20) | 0.0 0.0 0.1 0.2 0.4 0.1 0.3 0.3 0.9 1.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
