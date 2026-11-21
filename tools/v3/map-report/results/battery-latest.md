# Bot report: Battery Point (`battery`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.8; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=battery --seeds=24 --armory=latest --kits=plan`. Heat map: `tools/v3/map-report/results/battery-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.96; doubles on w5 (0.17→0.54), w7 (0.42→1.17) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w5 2.71 a run (92% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w5 ×0.89 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 45%, cold early 24% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.9 s → w10 5.8 s (slope -0.35 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.75 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.78 (9), r2 1.67 (9), r3 2.13 (8); tough (every run): 1.00, 1.71, 2.50 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 6.4 lost 1–10, end 11.4; counter 6.5 lost 1–10, end 11.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 5 loses 0.54 after 0.17; wave 7 loses 1.17 after 0.42. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (2.17 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 24%, middle 45%, late 31%.

## Ships lost per wave

Normal: won 25%, mean end wave 10.6 (14 = won), 5.2 lost in waves 1–10, 0.75 in waves 1–5. Tough: 7.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 0.17 | 0.54 | 0.42 | 1.17 | 1.21 | 2.17 | 1.83 | 1.00 | 1.71 | 2.50 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 0.17 | 0.54 | 0.42 | 1.17 | 0.96 | 1.37 | 1.54 | 0.78 | 1.67 | 2.13 |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 0.17 | 0.54 | 0.42 | 1.17 | 0.92 | 1.08 | 0.83 | 0.29 | 0.63 | 0.71 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 19 | 13 | 9 | 9 | 8 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.96.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.2 | 2.5 | 3.9 | 5.2 | 2.7 | 6.3 | 6.3 | 6.7 | 6.4 | 9.1 | 1.3 | 1.3 | 1.8 |
| runs with ≥ 1 | 13% | 100% | 100% | 96% | 92% | 100% | 100% | 100% | 96% | 100% | 92% | 92% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 30.0 | 36.5 | 44.5 | 48.5 | 46.0 | 53.2 | 52.1 | 55.6 | 62.6 | 66.5 |
| launches (encounters off) | 29.0 | 36.0 | 44.3 | 50.6 | 51.5 | 57.4 | 56.1 | 58.5 | 66.9 | 72.9 |
| **ratio to encounters off** | 1.03 | 1.01 | 1.00 | 0.96 | 0.89 | 0.93 | 0.93 | 0.95 | 0.94 | 0.91 |
| table × scale | 29 | 38 | 49 | 56 | 58 | 67 | 78 | 85 | 97 | 117 |
| ratio to table × scale | 1.03 | 0.96 | 0.91 | 0.87 | 0.79 | 0.79 | 0.67 | 0.65 | 0.65 | 0.57 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 24% / 12% | 45% / 55% | 31% / 33% | 51.7 | middle | early |
| all | 1–9 | 24% / 12% | 45% / 55% | 31% / 33% | 51.7 | middle | early |
| 1 | 1–13 | 24% / 8% | 48% / 59% | 28% / 33% | 94.4 | middle | early |
| all | 1–13 | 24% / 8% | 48% / 59% | 28% / 33% | 94.4 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.9 | 7.9 | 6.8 | 6.7 | 6.1 | 6.5 | 5.4 | 6.2 | 6.0 | 5.8 | 1.7 | 1.6 | 2.0 |
| launches read | 720 | 875 | 1062 | 1156 | 1103 | 1273 | 1243 | 1330 | 1497 | 1589 | 239 | 264 | 336 |

Slope over waves 1–10: -0.35 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.78 | 1.67 | 2.13 |
| runs that reached it | 9 | 9 | 8 |
| tough, every run | 1.00 | 1.71 | 2.50 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 19 | 13 | 9 | 9 | 8 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.3** | **0.1** | **0.2** | **0.3** | **0.1** | **0.3** | **0.5** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.3 | 0.1 | 0.2 | 0.2 | 0.1 | 0.3 | 0.4 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.09 | 0.05 | 0.15 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.08 | 0.21 | 0.09 | 0.05 | 0.08 | 0.11 | 0.22 | 0.38 |
| runs with no save | 100% | 100% | 100% | 100% | 92% | 88% | 71% | 96% | 84% | 77% | 89% | 67% | 63% |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.25 | 0.09 | 0.00 | 0.08 | 0.11 | 0.11 | 0.25 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.11 | 0.13 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.08 | 0.00 | 0.11 | 0.15 | 0.00 | 0.11 | 0.13 |
| tension peak | 0.17 | 0.32 | 0.67 | 0.62 | 0.59 | 0.82 | 1.04 | 0.92 | 1.30 | 1.18 | 0.09 | 0.10 | 0.18 |
| peaks | 0.0 | 0.0 | 0.3 | 0.3 | 0.3 | 1.0 | 1.0 | 0.6 | 1.0 | 1.0 | 0.0 | 0.0 | 0.0 |
| release after a peak (s) | 0.0 | 0.0 | 0.5 | 0.5 | 0.3 | 1.4 | 1.9 | 1.4 | 1.3 | 1.8 | 0.0 | 0.0 | 0.0 |
| hot share | 0% | 0% | 1% | 1% | 1% | 3% | 5% | 4% | 6% | 6% | 0% | 0% | 0% |
| calm share | 99% | 93% | 87% | 84% | 85% | 77% | 76% | 79% | 72% | 77% | 100% | 100% | 98% |
| shape (most runs) | flat 100% | flat 96% | flat 71% | flat 67% | flat 79% | flat 38% | one peak 54% | flat 52% | one peak 37% | one peak 46% | flat 100% | flat 100% | flat 100% |
| taps follow tension (r) | 0.42 | 0.40 | 0.30 | 0.35 | 0.39 | 0.23 | 0.32 | 0.26 | 0.23 | 0.36 | 0.55 | 0.45 | 0.46 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 125 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | railgun, gunships, thermo | 42% | 11.5 | 4.5 | 6.5 | 1.00 (13) / 1.00 (13) / 1.69 (13) | 0.0 0.0 0.1 0.2 0.5 0.4 1.0 1.0 1.6 1.6 |
| off-counter | seeker, droneScreen, shrapnel | 38% | 11.4 | 4.7 | 6.4 | 0.92 (12) / 1.33 (12) / 1.67 (12) | 0.0 0.0 0.1 0.2 0.5 0.4 0.9 0.7 2.0 1.5 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
