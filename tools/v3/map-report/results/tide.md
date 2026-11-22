# Bot report: Tidewater Flats (`tide`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.4; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=tide --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/tide-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +1.92; doubles on w3 (0.08→0.83), w5 (0.29→1.00), w6 (1.00→2.79) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 2.50 a run (88% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w4 ×0.82 of the no-encounter wave; outside on w4 ×0.82 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 38%, cold early 26%; lane 2: hot early 69%, cold late 0% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 10.6 s → w10 7.5 s (slope -0.30 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.04 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 2.04 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.00 (1), r2 5.00 (1), r3 – (0); tough (every run): 1.08, 3.83, 4.17 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.0; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 18.7 lost 1–10, end 7.3; off-counter 20.0 lost 1–10, end 7.2 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 3 loses 0.83 after 0.08; wave 5 loses 1.00 after 0.29; wave 6 loses 2.79 after 1.00. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 4 sends ×0.82 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest early takes 26%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Fun (provisional): waves 8–10 and the boss rounds have no more saves than waves 1–7. The big moments should come late.
- Hardest of waves 1–10 for the bot: wave 10 (5.58 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 28%, middle 36%, late 36%.

## Ships lost per wave

Normal: won 0%, mean end wave 7.2 (14 = won), 5.8 lost in waves 1–10, 2.04 in waves 1–5, 0.04 in bonus waves. Tough: 18.8 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.04 | 0.08 | 0.83 | 0.29 | 1.00 | 2.79 | 1.58 | 2.96 | 3.67 | 5.58 | 1.08 | 3.83 | 4.17 |
| normal, runs that reached it | 0.04 | 0.08 | 0.83 | 0.25 | 0.87 | 1.87 | 1.38 | 2.11 | 0.75 | 2.00 | 1.00 | 5.00 | – |
| normal, mean over all runs | 0.04 | 0.08 | 0.83 | 0.25 | 0.83 | 1.79 | 0.75 | 0.79 | 0.13 | 0.25 | 0.04 | 0.21 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 23 | 23 | 13 | 9 | 4 | 3 | 1 | 1 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +1.92.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.0 | 1.7 | 2.3 | 1.7 | 1.9 | 2.1 | 3.0 | 3.0 | 2.1 | 2.3 | 0.7 | 1.2 | – |
| kills a minute | 41 | 40 | 45 | 44 | 43 | 40 | 44 | 42 | 46 | 50 | 5 | 0 | – |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 2.1 | 3.1 | 3.4 | 2.5 | 3.2 | 4.3 | 4.0 | 4.1 | 4.2 | 5.4 | 2.8 | 3.2 | 3.1 |
| runs with ≥ 1 | 75% | 100% | 96% | 88% | 100% | 100% | 100% | 100% | 96% | 96% | 96% | 88% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 23.3 | 23.7 | 32.4 | 32.4 | 35.4 | 39.4 | 45.6 | 48.3 | 54.4 | 59.6 |
| launches (encounters off) | 22.0 | 26.4 | 36.5 | 39.6 | 39.4 | 44.6 | 47.5 | 49.9 | 59.9 | 67.9 |
| **ratio to encounters off** | 1.06 | 0.90 | 0.89 | **0.82** | 0.90 | 0.88 | 0.96 | 0.97 | 0.91 | 0.88 |
| table × scale | 22 | 30 | 38 | 43 | 45 | 52 | 60 | 66 | 76 | 91 |
| ratio to table × scale | 1.06 | 0.79 | 0.85 | 0.75 | 0.79 | 0.76 | 0.76 | 0.73 | 0.72 | 0.65 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 26% / 16% | 36% / 37% | 38% / 46% | 99.9 | late | early |
| 2 | 1–9 | 69% / 44% | 31% / 56% | 0% / 0% | 6.1 | early | late |
| all | 1–9 | 28% / 18% | 36% / 38% | 36% / 44% | 106.0 | middle | early |
| 1 | 1–13 | 21% / 13% | 40% / 36% | 39% / 51% | 169.0 | middle | early |
| 2 | 1–13 | 64% / 45% | 33% / 55% | 3% / 0% | 7.0 | early | late |
| all | 1–13 | 22% / 14% | 40% / 37% | 38% / 49% | 175.9 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.6 | 9.6 | 9.4 | 9.2 | 8.3 | 8.4 | 8.6 | 7.9 | 7.9 | 7.5 | 1.9 | 3.5 | 3.5 |
| launches read | 648 | 657 | 806 | 783 | 861 | 963 | 1056 | 1137 | 1257 | 1390 | 168 | 408 | 456 |

Slope over waves 1–10: -0.30 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.00 | 5.00 | – |
| runs that reached it | 1 | 1 | 0 |
| tough, every run | 1.08 | 3.83 | 4.17 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 23 | 23 | 13 | 9 | 4 | 3 | 1 | 1 | 0 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.1** | **0.1** | **0.1** | **0.2** | **0.1** | **0.0** | **0.0** | **0.0** | **0.0** | – |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.2 | 0.1 | 0.1 | 0.2 | 0.1 | 0.0 | 0.0 | 0.0 | 0.0 | – |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | – |
| clutch | 0.00 | 0.00 | 0.08 | 0.13 | 0.13 | 0.09 | 0.08 | 0.11 | 0.00 | 0.00 | 0.00 | 0.00 | – |
| runs with no save | 100% | 100% | 92% | 88% | 87% | 87% | 77% | 89% | 100% | 100% | 100% | 100% | – |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.11 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.08 | 0.08 | 0.00 | 0.09 | 0.23 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.51 | 0.51 | 1.04 | 0.79 | 0.99 | 1.49 | 1.21 | 1.63 | 1.42 | 1.07 | 1.68 | 2.12 | – |
| peaks | 0.2 | 0.1 | 0.8 | 0.6 | 0.8 | 1.4 | 1.3 | 1.3 | 1.5 | 1.7 | 1.0 | 2.0 | – |
| release after a peak (s) | 0.4 | 0.3 | 1.6 | 1.0 | 1.0 | 2.3 | 2.5 | 2.4 | 2.1 | 1.3 | 3.0 | 2.0 | – |
| hot share | 1% | 1% | 5% | 2% | 4% | 11% | 6% | 12% | 8% | 5% | 12% | 29% | – |
| calm share | 89% | 81% | 79% | 83% | 76% | 68% | 74% | 66% | 73% | 72% | 65% | 65% | – |
| shape (most runs) | flat 79% | flat 87% | one peak 58% | one peak 50% | one peak 48% | one peak 39% | one peak 54% | sawtooth rising 33% | one peak 50% | one peak 33% | one peak 100% | sawtooth rising 100% | – |
| taps follow tension (r) | 0.35 | 0.43 | 0.32 | 0.24 | 0.36 | 0.38 | 0.28 | 0.28 | 0.38 | 0.14 | 0.94 | 0.21 | – |

saves a run: waves 1–7 0.1, 8–10 + boss 0.0; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 133 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, aegis, bomberWing | 0% | 7.3 | 5.8 | 18.7 | 1.00 (1) / 5.00 (1) / – (0) | 0.0 0.1 0.8 0.3 0.9 2.2 1.6 3.0 4.8 4.9 |
| off-counter | tesla, grapnel, fullSteam | 0% | 7.2 | 6.1 | 20.0 | – (0) / – (0) / – (0) | 0.0 0.1 0.8 0.6 1.1 2.7 1.3 3.0 4.2 6.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
