# Bot report: Battery Point (`battery`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.8; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=battery --seeds=24 --armory=latest --kits=plan`. Heat map: `tools/v3/map-report/results/battery-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w5 +0.71; doubles on w5 (0.04→0.75) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 3.83 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w4 ×0.88 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 44%, cold early 23% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.9 s → w10 5.9 s (slope -0.34 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.83 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.00 (10), r2 1.30 (10), r3 1.80 (10); tough (every run): 1.21, 1.29, 2.67 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 7.4 lost 1–10, end 11.0; off-counter 7.7 lost 1–10, end 10.6 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 5 loses 0.75 after 0.04. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.75 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 23%, middle 44%, late 33%.

## Ships lost per wave

Normal: won 25%, mean end wave 10.6 (14 = won), 4.8 lost in waves 1–10, 0.83 in waves 1–5, 0.13 in bonus waves. Tough: 7.1 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 0.04 | 0.75 | 0.71 | 0.92 | 1.33 | 1.54 | 1.75 | 1.21 | 1.29 | 2.67 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 0.04 | 0.75 | 0.54 | 0.87 | 1.14 | 1.32 | 1.18 | 1.00 | 1.30 | 1.80 |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 0.04 | 0.75 | 0.54 | 0.83 | 1.04 | 1.04 | 0.54 | 0.42 | 0.54 | 0.75 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 19 | 11 | 10 | 10 | 10 |

Biggest one-wave step up (tough, waves 2–10): wave 5, +0.71.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.2 | 2.5 | 3.9 | 3.8 | 4.3 | 6.1 | 6.6 | 7.0 | 6.0 | 7.6 | 1.1 | 1.4 | 1.6 |
| runs with ≥ 1 | 13% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 83% | 92% | 83% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 30.0 | 36.5 | 44.5 | 44.5 | 46.6 | 53.3 | 53.1 | 55.8 | 63.5 | 65.5 |
| launches (encounters off) | 29.0 | 36.0 | 44.3 | 50.6 | 51.5 | 57.4 | 56.1 | 58.5 | 66.9 | 72.9 |
| **ratio to encounters off** | 1.03 | 1.01 | 1.00 | 0.88 | 0.90 | 0.93 | 0.95 | 0.95 | 0.95 | 0.90 |
| table × scale | 29 | 38 | 49 | 56 | 58 | 67 | 78 | 85 | 97 | 117 |
| ratio to table × scale | 1.03 | 0.96 | 0.91 | 0.79 | 0.80 | 0.80 | 0.68 | 0.66 | 0.65 | 0.56 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 23% / 13% | 44% / 45% | 33% / 43% | 49.2 | middle | early |
| all | 1–9 | 23% / 13% | 44% / 45% | 33% / 43% | 49.2 | middle | early |
| 1 | 1–13 | 22% / 7% | 49% / 54% | 29% / 39% | 89.9 | middle | early |
| all | 1–13 | 22% / 7% | 49% / 54% | 29% / 39% | 89.9 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.9 | 7.9 | 6.8 | 6.6 | 6.0 | 6.5 | 5.4 | 6.1 | 6.1 | 5.9 | 1.7 | 1.6 | 2.1 |
| launches read | 720 | 875 | 1062 | 1063 | 1113 | 1274 | 1273 | 1334 | 1516 | 1564 | 240 | 262 | 336 |

Slope over waves 1–10: -0.34 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.00 | 1.30 | 1.80 |
| runs that reached it | 10 | 10 | 10 |
| tough, every run | 1.21 | 1.29 | 2.67 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 19 | 11 | 10 | 10 | 10 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.3** | **0.2** | **0.0** | **0.2** | **0.4** | **0.2** | **0.3** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.2 | 0.2 | 0.0 | 0.1 | 0.3 | 0.2 | 0.3 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.09 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.25 | 0.09 | 0.00 | 0.21 | 0.27 | 0.20 | 0.20 | 0.00 |
| runs with no save | 100% | 100% | 100% | 100% | 92% | 79% | 83% | 100% | 79% | 73% | 80% | 70% | 100% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.11 | 0.18 | 0.20 | 0.10 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.09 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.10 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.17 | 0.09 | 0.00 | 0.11 | 0.18 | 0.00 | 0.10 | 0.00 |
| tension peak | 0.17 | 0.32 | 0.67 | 0.50 | 0.75 | 0.82 | 1.00 | 0.83 | 1.32 | 1.16 | 0.10 | 0.10 | 0.14 |
| peaks | 0.0 | 0.0 | 0.3 | 0.1 | 0.4 | 1.0 | 0.9 | 0.6 | 1.1 | 1.0 | 0.0 | 0.0 | 0.0 |
| release after a peak (s) | 0.0 | 0.0 | 0.5 | 0.2 | 0.5 | 1.4 | 1.7 | 0.6 | 1.7 | 1.6 | 0.0 | 0.0 | 0.0 |
| hot share | 0% | 0% | 1% | 0% | 1% | 3% | 4% | 3% | 9% | 3% | 0% | 0% | 0% |
| calm share | 99% | 93% | 87% | 89% | 84% | 76% | 78% | 80% | 72% | 78% | 100% | 100% | 99% |
| shape (most runs) | flat 100% | flat 96% | flat 71% | flat 92% | flat 62% | flat 46% | one peak 43% | flat 55% | one peak 32% | one peak 73% | flat 100% | flat 100% | flat 100% |
| taps follow tension (r) | 0.42 | 0.40 | 0.30 | 0.42 | 0.38 | 0.23 | 0.31 | 0.26 | 0.28 | 0.35 | 0.56 | 0.32 | 0.36 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 69 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | railgun, gunships, thermo | 42% | 11.0 | 4.7 | 7.4 | 0.36 (11) / 1.55 (11) / 1.27 (11) | 0.0 0.0 0.1 0.1 0.5 0.6 1.2 1.2 1.7 2.0 |
| off-counter | seeker, droneScreen, shrapnel | 29% | 10.6 | 5.2 | 7.7 | 0.70 (10) / 1.50 (10) / 2.20 (10) | 0.0 0.0 0.1 0.1 0.5 0.8 1.4 1.2 1.5 2.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
