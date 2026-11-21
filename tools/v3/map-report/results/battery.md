# Bot report: Battery Point (`battery`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.8; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=battery --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/battery-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w6 +0.92; doubles on w4 (0.29→0.67) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 4.21 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.89 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 45%, cold early 25% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.9 s → w10 5.7 s (slope -0.34 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 2.08 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 – (0), r2 – (0), r3 – (0); tough (every run): 1.17, 2.75, 3.46 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 14.9 lost 1–10, end 7.6; off-counter 16.2 lost 1–10, end 7.4 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 4 loses 0.67 after 0.29. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (3.33 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 25%, middle 45%, late 30%.

## Ships lost per wave

Normal: won 0%, mean end wave 7.5 (14 = won), 6.0 lost in waves 1–10, 2.08 in waves 1–5. Tough: 15.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.29 | 0.67 | 1.21 | 2.13 | 2.42 | 2.21 | 3.00 | 3.33 | 1.17 | 2.75 | 3.46 |
| normal, runs that reached it | 0.00 | 0.00 | 0.29 | 0.67 | 1.13 | 1.52 | 1.59 | 1.67 | 1.38 | 1.33 | – | – | – |
| normal, mean over all runs | 0.00 | 0.00 | 0.29 | 0.67 | 1.13 | 1.33 | 1.13 | 0.83 | 0.46 | 0.17 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 21 | 17 | 12 | 8 | 3 | 0 | 0 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 6, +0.92.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.5 | 2.5 | 4.2 | 5.6 | 5.0 | 6.8 | 7.4 | 7.1 | 6.9 | 8.5 | 1.5 | 1.0 | 2.4 |
| runs with ≥ 1 | 38% | 96% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 92% | 83% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 30.0 | 36.5 | 44.9 | 48.3 | 45.8 | 53.5 | 53.0 | 55.6 | 62.3 | 66.0 |
| launches (encounters off) | 29.0 | 36.0 | 45.0 | 51.3 | 51.5 | 58.0 | 55.5 | 60.8 | 68.2 | 74.5 |
| **ratio to encounters off** | 1.03 | 1.01 | 1.00 | 0.94 | 0.89 | 0.92 | 0.95 | 0.91 | 0.91 | 0.89 |
| table × scale | 29 | 38 | 49 | 56 | 58 | 67 | 78 | 85 | 97 | 117 |
| ratio to table × scale | 1.03 | 0.96 | 0.92 | 0.86 | 0.79 | 0.80 | 0.68 | 0.65 | 0.64 | 0.56 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 25% / 15% | 45% / 49% | 30% / 37% | 78.8 | middle | early |
| all | 1–9 | 25% / 15% | 45% / 49% | 30% / 37% | 78.8 | middle | early |
| 1 | 1–13 | 25% / 9% | 48% / 56% | 27% / 35% | 130.8 | middle | early |
| all | 1–13 | 25% / 9% | 48% / 56% | 27% / 35% | 130.8 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.9 | 7.9 | 6.8 | 6.5 | 6.0 | 6.3 | 5.4 | 6.2 | 6.1 | 5.7 | 1.7 | 1.6 | 2.1 |
| launches read | 720 | 875 | 1074 | 1158 | 1097 | 1282 | 1267 | 1329 | 1494 | 1578 | 240 | 264 | 336 |

Slope over waves 1–10: -0.34 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | – | – | – |
| runs that reached it | 0 | 0 | 0 |
| tough, every run | 1.17 | 2.75 | 3.46 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 21 | 17 | 12 | 8 | 3 | 0 | 0 | 0 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.2** | **0.2** | **0.2** | **0.3** | **0.1** | **0.3** | **0.7** | – | – | – |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.2 | 0.1 | 0.1 | 0.2 | 0.1 | 0.3 | 0.7 | – | – | – |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.06 | 0.00 | 0.13 | 0.33 | – | – | – |
| clutch | 0.00 | 0.00 | 0.08 | 0.17 | 0.13 | 0.05 | 0.29 | 0.08 | 0.25 | 0.33 | – | – | – |
| runs with no save | 100% | 100% | 92% | 83% | 88% | 81% | 71% | 92% | 88% | 67% | – | – | – |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.13 | 0.08 | 0.05 | 0.12 | 0.08 | 0.13 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 | 0.33 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.05 | 0.06 | 0.00 | 0.13 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.05 | 0.12 | 0.00 | 0.00 | 0.33 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.32 | 0.35 | 0.87 | 0.99 | 0.80 | 1.23 | 1.33 | 1.43 | 1.76 | 1.22 | – | – | – |
| peaks | 0.0 | 0.0 | 0.7 | 0.6 | 0.6 | 1.4 | 1.2 | 1.0 | 1.8 | 1.0 | – | – | – |
| release after a peak (s) | 0.1 | 0.1 | 1.2 | 1.3 | 1.4 | 2.1 | 1.6 | 1.8 | 2.9 | 1.3 | – | – | – |
| hot share | 0% | 0% | 4% | 3% | 4% | 8% | 8% | 7% | 12% | 12% | – | – | – |
| calm share | 92% | 89% | 77% | 78% | 74% | 71% | 73% | 75% | 66% | 66% | – | – | – |
| shape (most runs) | flat 96% | flat 96% | flat 46% | one peak 46% | one peak 50% | one peak 38% | one peak 35% | one peak 67% | one peak 38% | one peak 100% | – | – | – |
| taps follow tension (r) | 0.40 | 0.37 | 0.33 | 0.39 | 0.41 | 0.21 | 0.28 | 0.27 | 0.26 | 0.29 | – | – | – |

saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9. 24 runs, 83 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | railgun, gunships, thermo | 0% | 7.6 | 6.0 | 14.9 | – (0) / – (0) / – (0) | 0.0 0.0 0.3 0.7 1.0 1.6 2.5 2.4 2.7 3.7 |
| off-counter | seeker, droneScreen, shrapnel | 0% | 7.4 | 6.0 | 16.2 | – (0) / – (0) / – (0) | 0.0 0.0 0.3 0.7 1.3 1.7 2.1 3.0 4.1 3.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
