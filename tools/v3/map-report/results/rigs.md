# Bot report: The Rig Field (`rigs`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.7; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=rigs --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/rigs-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +2.38; doubles on w3 (0.25→1.29) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.79 a run (79% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.81 of the no-encounter wave; outside on w3 ×0.83, w10 ×0.81 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 41%, cold late 24% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 10.8 s → w10 5.7 s (slope -0.48 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 3.75 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 4.00 (1), r2 0.00 (1), r3 2.00 (1); tough (every run): 2.83, 3.25, 4.25 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.3, 8–10 + boss 1.0; flat (under 0.5) w1, w2, w3, w4, w6, w7, w8 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 19.5 lost 1–10, end 6.6; off-counter 21.5 lost 1–10, end 6.2 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 3 loses 1.29 after 0.25. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 3 sends ×0.83 the no-encounter wave; wave 10 sends ×0.81 the no-encounter wave. Encounters should replace launches, not add them.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 6, 7, 8. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 8 (4.75 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 35%, middle 41%, late 24%.

## Ships lost per wave

Normal: won 0%, mean end wave 6.2 (14 = won), 5.7 lost in waves 1–10, 3.75 in waves 1–5, 0.17 in bonus waves. Tough: 22.4 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.25 | 1.29 | 1.33 | 2.33 | 2.50 | 2.38 | 4.75 | 4.58 | 3.00 | 2.83 | 3.25 | 4.25 |
| normal, runs that reached it | 0.00 | 0.25 | 1.13 | 1.23 | 1.50 | 1.60 | 1.44 | 1.40 | 0.50 | 1.00 | 4.00 | 0.00 | 2.00 |
| normal, mean over all runs | 0.00 | 0.25 | 1.13 | 1.13 | 1.25 | 1.00 | 0.54 | 0.29 | 0.04 | 0.04 | 0.17 | 0.00 | 0.08 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 22 | 20 | 15 | 9 | 5 | 2 | 1 | 1 | 1 | 1 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +2.38.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.4 | 2.4 | 2.4 | 2.3 | 2.3 | 2.4 | 2.4 | 2.5 | 1.6 | 1.4 | 0.7 | 0.3 | 2.3 |
| kills a minute | 41 | 41 | 40 | 42 | 42 | 35 | 47 | 38 | 37 | 31 | 0 | 26 | 5 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.1 | 1.7 | 1.8 | 2.8 | 3.0 | 3.8 | 4.3 | 4.9 | 5.9 | 4.6 | 1.6 | 1.5 | 2.8 |
| runs with ≥ 1 | 75% | 92% | 79% | 100% | 92% | 100% | 96% | 96% | 92% | 92% | 67% | 71% | 83% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.5 | 28.5 | 34.5 | 38.5 | 38.1 | 42.0 | 46.7 | 46.3 | 45.8 | 51.8 |
| launches (encounters off) | 27.0 | 29.6 | 41.5 | 40.7 | 44.0 | 48.5 | 49.5 | 52.7 | 51.7 | 64.0 |
| **ratio to encounters off** | 0.91 | 0.96 | **0.83** | 0.95 | 0.87 | 0.87 | 0.94 | 0.88 | 0.89 | **0.81** |
| table × scale | 27 | 35 | 46 | 54 | 55 | 63 | 74 | 79 | 92 | 111 |
| ratio to table × scale | 0.91 | 0.81 | 0.75 | 0.71 | 0.69 | 0.67 | 0.63 | 0.59 | 0.50 | 0.47 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 35% / 24% | 41% / 50% | 24% / 26% | 98.4 | middle | late |
| all | 1–9 | 35% / 24% | 41% / 50% | 24% / 26% | 98.4 | middle | late |
| 1 | 1–13 | 33% / 22% | 48% / 58% | 19% / 20% | 150.8 | middle | late |
| all | 1–13 | 33% / 22% | 48% / 58% | 19% / 20% | 150.8 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.8 | 8.6 | 8.5 | 7.4 | 7.2 | 6.5 | 6.8 | 6.6 | 5.6 | 5.7 | 2.7 | 2.8 | 4.8 |
| launches read | 622 | 770 | 823 | 946 | 909 | 991 | 1090 | 1110 | 1061 | 1218 | 258 | 268 | 461 |

Slope over waves 1–10: -0.48 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 4.00 | 0.00 | 2.00 |
| runs that reached it | 1 | 1 | 1 |
| tough, every run | 2.83 | 3.25 | 4.25 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 22 | 20 | 15 | 9 | 5 | 2 | 1 | 1 | 1 | 1 |
| **saves a run** | **0.0** | **0.1** | **0.3** | **0.2** | **0.6** | **0.3** | **0.3** | **0.4** | **0.5** | **3.0** | **0.0** | **2.0** | **0.0** |
| ships saved a run | 0.0 | 0.1 | 0.3 | 0.2 | 0.5 | 0.3 | 0.3 | 0.3 | 0.3 | 2.0 | 0.0 | 2.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.15 | 0.13 | 0.22 | 0.00 | 0.50 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.08 | 0.33 | 0.14 | 0.35 | 0.33 | 0.22 | 0.20 | 0.50 | 2.00 | 0.00 | 1.00 | 0.00 |
| runs with no save | 100% | 92% | 88% | 82% | 65% | 73% | 67% | 80% | 50% | 0% | 100% | 0% | 100% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.05 | 0.20 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 1.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.13 | 0.09 | 0.05 | 0.13 | 0.00 | 0.00 | 0.50 | 1.00 | 0.00 | 1.00 | 0.00 |
|   last-second kill | 0.00 | 0.04 | 0.08 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.04 | 0.13 | 0.09 | 0.30 | 0.20 | 0.33 | 0.40 | 0.00 | 2.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.40 | 0.63 | 0.69 | 1.07 | 1.19 | 1.52 | 0.93 | 1.21 | 1.34 | 2.19 | 1.68 | 0.72 | 1.82 |
| peaks | 0.0 | 0.4 | 0.4 | 0.7 | 1.1 | 1.3 | 0.7 | 1.0 | 1.0 | 1.0 | 3.0 | 0.0 | 1.0 |
| release after a peak (s) | 0.1 | 0.6 | 1.1 | 1.6 | 1.9 | 2.5 | 2.0 | 0.5 | 2.5 | 3.0 | 2.3 | 0.0 | 4.0 |
| hot share | 0% | 1% | 2% | 5% | 8% | 12% | 7% | 7% | 9% | 7% | 18% | 0% | 46% |
| calm share | 85% | 80% | 76% | 75% | 72% | 67% | 73% | 66% | 79% | 84% | 64% | 81% | 55% |
| shape (most runs) | flat 96% | flat 71% | flat 62% | flat 45% | one peak 40% | one peak 73% | flat 56% | flat 60% | one peak 100% | one peak 100% | sawtooth 100% | flat 100% | pinned 100% |
| taps follow tension (r) | 0.20 | 0.16 | 0.23 | 0.22 | 0.26 | 0.20 | 0.14 | -0.03 | 0.07 | 0.34 | 0.13 | 0.52 | -0.22 |

saves a run: waves 1–7 0.3, 8–10 + boss 1.0; flat (under 0.5) w1, w2, w3, w4, w6, w7, w8. 24 runs, 72 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | railgun, flak, orbital | 0% | 6.6 | 5.8 | 19.5 | 3.50 (2) / 0.50 (2) / 2.00 (2) | 0.0 0.2 1.2 1.3 2.3 2.7 2.1 3.5 2.8 3.4 |
| off-counter | seeker, shield, tesla | 4% | 6.2 | 5.8 | 21.5 | 2.00 (1) / 1.00 (1) / 2.00 (1) | 0.0 0.3 1.3 1.6 2.3 2.5 3.0 3.4 3.3 3.8 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
