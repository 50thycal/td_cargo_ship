# Bot report: The Sharra Delta (`delta`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.5; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=delta --seeds=24 --armory=latest --kits=plan`. Heat map: `tools/v3/map-report/results/delta-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.42; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 1.54 a run (75% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w6 ×0.75 of the no-encounter wave; outside on w6 ×0.75 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot early 40%, cold late 25%; lane 2: hot middle 41%, cold late 23%; lane 3: hot early 55%, cold late 21% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.9 s → w10 4.6 s (slope -0.44 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.67 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.17 (18), r2 1.78 (18), r3 3.11 (18); tough (every run): 0.13, 1.79, 3.79 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 3.8 lost 1–10, end 12.8; off-counter 5.0 lost 1–10, end 12.3 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Budget: wave 6 sends ×0.75 the no-encounter wave. Encounters should replace launches, not add them.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (1.29 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 42%, middle 35%, late 23%.

## Ships lost per wave

Normal: won 33%, mean end wave 12.2 (14 = won), 3.7 lost in waves 1–10, 0.67 in waves 1–5, 0.04 in bonus waves. Tough: 5.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.00 | 0.21 | 0.38 | 0.33 | 0.63 | 0.88 | 1.29 | 1.21 | 0.13 | 1.79 | 3.79 |
| normal, runs that reached it | 0.00 | 0.08 | 0.00 | 0.21 | 0.38 | 0.35 | 0.61 | 0.86 | 0.64 | 0.86 | 0.17 | 1.78 | 3.11 |
| normal, mean over all runs | 0.00 | 0.08 | 0.00 | 0.21 | 0.38 | 0.33 | 0.58 | 0.79 | 0.58 | 0.75 | 0.13 | 1.33 | 2.33 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 22 | 22 | 21 | 18 | 18 | 18 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.42.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 0.9 | 1.1 | 0.8 | 0.9 | 1.0 | 1.0 | 1.0 | 1.2 | 1.2 | 1.2 | 0.6 | 0.8 | 0.8 |
| kills a minute | 51 | 50 | 41 | 44 | 47 | 40 | 45 | 46 | 49 | 45 | 22 | 24 | 22 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.4 | 1.5 | 1.5 | 3.2 | 3.6 | 5.5 | 5.0 | 7.0 | 7.1 | 8.5 | 3.1 | 2.7 | 2.6 |
| runs with ≥ 1 | 33% | 96% | 75% | 100% | 92% | 100% | 100% | 100% | 100% | 100% | 96% | 92% | 83% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.5 | 28.7 | 29.9 | 34.3 | 36.3 | 34.1 | 44.1 | 47.3 | 51.2 | 60.6 |
| launches (encounters off) | 24.0 | 30.5 | 34.8 | 39.1 | 41.6 | 45.5 | 44.7 | 50.5 | 57.4 | 68.1 |
| **ratio to encounters off** | 1.02 | 0.94 | 0.86 | 0.88 | 0.87 | **0.75** | 0.99 | 0.93 | 0.89 | 0.89 |
| table × scale | 24 | 32 | 41 | 48 | 49 | 57 | 66 | 71 | 82 | 99 |
| ratio to table × scale | 1.02 | 0.90 | 0.73 | 0.71 | 0.74 | 0.60 | 0.67 | 0.67 | 0.62 | 0.61 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 40% / 36% | 36% / 32% | 25% / 32% | 18.8 | early | late |
| 2 | 1–9 | 35% / 16% | 41% / 46% | 23% / 38% | 26.3 | middle | late |
| 3 | 1–9 | 55% / 58% | 24% / 21% | 21% / 21% | 16.0 | early | late |
| all | 1–9 | 42% / 30% | 35% / 37% | 23% / 33% | 61.0 | early | late |
| 1 | 1–13 | 36% / 32% | 47% / 51% | 17% / 16% | 37.5 | middle | late |
| 2 | 1–13 | 33% / 27% | 50% / 49% | 16% / 24% | 47.5 | middle | late |
| 3 | 1–13 | 43% / 39% | 47% / 55% | 11% / 5% | 41.7 | middle | late |
| all | 1–13 | 37% / 33% | 48% / 52% | 15% / 15% | 126.7 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.9 | 7.9 | 6.7 | 6.2 | 5.5 | 5.2 | 5.5 | 4.7 | 4.8 | 4.6 | 5.2 | 4.8 | 4.2 |
| launches read | 622 | 702 | 756 | 842 | 899 | 849 | 1039 | 1112 | 1203 | 1439 | 288 | 334 | 406 |

Slope over waves 1–10: -0.44 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.17 | 1.78 | 3.11 |
| runs that reached it | 18 | 18 | 18 |
| tough, every run | 0.13 | 1.79 | 3.79 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 22 | 22 | 21 | 18 | 18 | 18 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.1** | **0.1** | **0.0** | **0.0** | **0.1** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.1 | 0.0 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.18 | 0.05 | 0.10 | 0.00 | 0.00 | 0.00 |
| runs with no save | 100% | 96% | 100% | 100% | 100% | 96% | 96% | 91% | 91% | 90% | 100% | 100% | 94% |
|   pickup save | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.14 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.05 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 | 0.06 |
| tension peak | 0.23 | 0.37 | 0.36 | 0.41 | 0.55 | 0.66 | 0.55 | 0.78 | 0.97 | 0.94 | 0.64 | 0.75 | 1.07 |
| peaks | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.3 | 0.3 | 0.7 | 1.0 | 1.0 | 0.2 | 0.6 | 1.2 |
| release after a peak (s) | 0.0 | 0.1 | 0.0 | 0.1 | 0.1 | 0.7 | 0.5 | 0.9 | 1.3 | 1.1 | 0.2 | 0.6 | 1.9 |
| hot share | 0% | 0% | 0% | 1% | 1% | 1% | 1% | 2% | 3% | 4% | 1% | 3% | 10% |
| calm share | 95% | 91% | 93% | 89% | 84% | 83% | 85% | 81% | 81% | 78% | 83% | 71% | 70% |
| shape (most runs) | flat 100% | flat 96% | flat 100% | flat 92% | flat 87% | flat 74% | flat 83% | flat 50% | one peak 41% | one peak 38% | flat 83% | flat 56% | one peak 67% |
| taps follow tension (r) | 0.43 | 0.27 | 0.37 | 0.38 | 0.34 | 0.46 | 0.39 | 0.39 | 0.41 | 0.40 | 0.51 | 0.48 | 0.52 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 359 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | seeker, thermo, cadence | 33% | 12.8 | 3.7 | 3.8 | 0.30 (20) / 1.75 (20) / 3.20 (20) | 0.0 0.1 0.0 0.2 0.3 0.2 0.5 0.9 0.8 0.9 |
| off-counter | well, tesla, aegis | 33% | 12.3 | 3.9 | 5.0 | 0.39 (18) / 1.72 (18) / 3.11 (18) | 0.0 0.1 0.0 0.2 0.5 0.3 0.7 0.9 1.0 1.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
