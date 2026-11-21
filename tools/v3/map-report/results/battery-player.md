# Bot report: Battery Point (`battery`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.8; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=battery --seeds=24 --armory=player --kits=plan`. Heat map: `tools/v3/map-report/results/battery-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.46; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 3.54 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.88 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 46%, cold early 21% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.9 s → w10 6.0 s (slope -0.32 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.71 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.82 (17), r2 0.47 (17), r3 1.24 (17); tough (every run): 0.67, 0.54, 1.29 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 4.3 lost 1–10, end 12.7; counter 4.5 lost 1–10, end 12.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (1.00 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 21%, middle 46%, late 33%.

## Ships lost per wave

Normal: won 67%, mean end wave 12.6 (14 = won), 3.8 lost in waves 1–10, 0.71 in waves 1–5. Tough: 4.4 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.08 | 0.38 | 0.25 | 0.42 | 0.75 | 0.54 | 1.00 | 1.00 | 0.67 | 0.54 | 1.29 |
| normal, runs that reached it | 0.00 | 0.00 | 0.08 | 0.38 | 0.25 | 0.33 | 0.61 | 0.48 | 0.91 | 0.86 | 0.82 | 0.47 | 1.24 |
| normal, mean over all runs | 0.00 | 0.00 | 0.08 | 0.38 | 0.25 | 0.33 | 0.58 | 0.46 | 0.88 | 0.79 | 0.58 | 0.33 | 0.88 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 22 | 17 | 17 | 17 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.46.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.2 | 1.5 | 3.5 | 5.0 | 4.2 | 5.6 | 6.6 | 6.1 | 6.3 | 8.7 | 1.3 | 1.3 | 2.0 |
| runs with ≥ 1 | 21% | 71% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 83% | 88% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 30.0 | 36.5 | 43.3 | 47.8 | 45.0 | 53.3 | 52.6 | 55.5 | 61.9 | 66.2 |
| launches (encounters off) | 29.0 | 36.0 | 43.8 | 50.4 | 50.6 | 57.4 | 54.1 | 59.3 | 65.8 | 75.0 |
| **ratio to encounters off** | 1.03 | 1.01 | 0.99 | 0.95 | 0.89 | 0.93 | 0.97 | 0.94 | 0.94 | 0.88 |
| table × scale | 29 | 38 | 49 | 56 | 58 | 67 | 78 | 85 | 97 | 117 |
| ratio to table × scale | 1.03 | 0.96 | 0.88 | 0.85 | 0.78 | 0.79 | 0.67 | 0.65 | 0.64 | 0.57 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 21% / 24% | 46% / 48% | 33% / 28% | 57.3 | middle | early |
| all | 1–9 | 21% / 24% | 46% / 48% | 33% / 28% | 57.3 | middle | early |
| 1 | 1–13 | 21% / 14% | 49% / 58% | 30% / 27% | 104.1 | middle | early |
| all | 1–13 | 21% / 14% | 49% / 58% | 30% / 27% | 104.1 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.9 | 7.9 | 6.8 | 6.3 | 6.0 | 6.4 | 5.5 | 6.4 | 6.1 | 6.0 | 1.7 | 1.6 | 2.0 |
| launches read | 720 | 874 | 1035 | 1142 | 1078 | 1275 | 1263 | 1331 | 1485 | 1577 | 240 | 264 | 336 |

Slope over waves 1–10: -0.32 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.82 | 0.47 | 1.24 |
| runs that reached it | 17 | 17 | 17 |
| tough, every run | 0.67 | 0.54 | 1.29 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 22 | 17 | 17 | 17 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.2** | **0.3** | **0.1** | **0.3** | **0.2** | **0.1** | **0.2** | **0.4** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.2 | 0.2 | 0.1 | 0.2 | 0.2 | 0.1 | 0.2 | 0.3 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.17 | 0.17 | 0.04 | 0.26 | 0.09 | 0.12 | 0.18 | 0.29 |
| runs with no save | 100% | 96% | 100% | 96% | 92% | 88% | 87% | 91% | 78% | 77% | 88% | 76% | 82% |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.04 | 0.22 | 0.00 | 0.13 | 0.05 | 0.06 | 0.06 | 0.24 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.05 | 0.06 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.12 | 0.06 |
|   kill save | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.04 | 0.14 | 0.00 | 0.06 | 0.06 |
| tension peak | 0.21 | 0.23 | 0.59 | 0.76 | 0.58 | 0.92 | 0.92 | 0.64 | 1.07 | 1.25 | 0.10 | 0.09 | 0.20 |
| peaks | 0.0 | 0.0 | 0.3 | 0.5 | 0.2 | 0.6 | 0.9 | 0.4 | 0.8 | 0.9 | 0.0 | 0.0 | 0.1 |
| release after a peak (s) | 0.0 | 0.0 | 0.5 | 1.0 | 0.3 | 1.4 | 1.1 | 1.2 | 2.3 | 1.9 | 0.0 | 0.0 | 0.1 |
| hot share | 0% | 0% | 1% | 2% | 1% | 2% | 3% | 1% | 5% | 6% | 0% | 0% | 0% |
| calm share | 97% | 97% | 85% | 83% | 86% | 75% | 77% | 82% | 74% | 73% | 100% | 100% | 96% |
| shape (most runs) | flat 100% | flat 96% | flat 75% | flat 50% | flat 83% | flat 50% | flat 43% | flat 65% | one peak 52% | one peak 77% | flat 100% | flat 100% | flat 94% |
| taps follow tension (r) | 0.46 | 0.37 | 0.38 | 0.32 | 0.49 | 0.25 | 0.34 | 0.27 | 0.36 | 0.38 | 0.56 | 0.42 | 0.36 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 209 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | railgun, gunships, thermo | 67% | 12.5 | 3.9 | 4.5 | 0.94 (17) / 0.53 (17) / 1.18 (17) | 0.0 0.0 0.1 0.3 0.2 0.4 1.0 0.6 0.9 1.0 |
| off-counter | seeker, droneScreen, shrapnel | 67% | 12.7 | 3.6 | 4.3 | 0.72 (18) / 0.56 (18) / 1.50 (18) | 0.0 0.0 0.1 0.3 0.2 0.4 0.8 0.3 1.0 1.1 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
