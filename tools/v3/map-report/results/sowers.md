# Bot report: Sowers' Reach (`sowers`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.45; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=sowers --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/sowers-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +1.58; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 2.08 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.89 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 46%, cold early 23% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.8 s → w10 5.2 s (slope -0.39 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.04 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 2.75 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.00 (1), r2 1.00 (1), r3 2.00 (1); tough (every run): 1.63, 1.50, 2.29 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.2, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w8, w9 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 19.4 lost 1–10, end 7.4; off-counter 19.8 lost 1–10, end 7.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 8, 9. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Fun (provisional): waves 8–10 and the boss rounds have no more saves than waves 1–7. The big moments should come late.
- Hardest of waves 1–10 for the bot: wave 10 (5.79 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 23%, middle 46%, late 31%.

## Ships lost per wave

Normal: won 4%, mean end wave 7.5 (14 = won), 5.8 lost in waves 1–10, 2.75 in waves 1–5, 0.08 in bonus waves. Tough: 21.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.04 | 0.42 | 0.54 | 1.00 | 1.33 | 1.92 | 2.50 | 3.58 | 4.21 | 5.79 | 1.63 | 1.50 | 2.29 |
| normal, runs that reached it | 0.04 | 0.42 | 0.54 | 0.88 | 0.95 | 1.05 | 1.47 | 1.08 | 1.71 | 1.67 | 1.00 | 1.00 | 2.00 |
| normal, mean over all runs | 0.04 | 0.42 | 0.54 | 0.88 | 0.88 | 0.88 | 0.92 | 0.58 | 0.50 | 0.21 | 0.04 | 0.04 | 0.08 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 22 | 20 | 15 | 13 | 7 | 3 | 1 | 1 | 1 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +1.58.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.8 | 2.7 | 2.4 | 3.0 | 2.4 | 3.0 | 2.8 | 2.7 | 3.0 | 2.4 | 3.8 | 3.8 | 7.2 |
| kills a minute | 49 | 47 | 50 | 46 | 45 | 46 | 43 | 45 | 51 | 37 | 51 | 53 | 65 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.7 | 0.9 | 2.1 | 2.3 | 2.8 | 3.3 | 3.2 | 4.0 | 4.8 | 5.4 | 1.0 | 1.5 | 1.1 |
| runs with ≥ 1 | 46% | 54% | 100% | 71% | 92% | 100% | 96% | 96% | 92% | 100% | 58% | 75% | 71% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.3 | 31.4 | 35.1 | 40.7 | 39.2 | 43.2 | 44.7 | 50.3 | 55.3 | 63.5 |
| launches (encounters off) | 25.0 | 30.3 | 38.1 | 38.6 | 41.5 | 44.1 | 50.2 | 52.5 | 59.3 | 69.4 |
| **ratio to encounters off** | 0.97 | 1.04 | 0.92 | 1.06 | 0.94 | 0.98 | 0.89 | 0.96 | 0.93 | 0.91 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.05 | 1.01 | 0.90 | 0.93 | 0.85 | 0.82 | 0.72 | 0.74 | 0.71 | 0.68 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 23% / 14% | 46% / 49% | 31% / 37% | 78.4 | middle | early |
| all | 1–9 | 23% / 14% | 46% / 49% | 31% / 37% | 78.4 | middle | early |
| 1 | 1–13 | 21% / 14% | 44% / 49% | 34% / 37% | 124.4 | middle | early |
| all | 1–13 | 21% / 14% | 44% / 49% | 34% / 37% | 124.4 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.8 | 8.4 | 7.9 | 7.2 | 7.1 | 5.3 | 6.2 | 6.0 | 5.9 | 5.2 | 1.8 | 1.6 | 1.6 |
| launches read | 600 | 746 | 818 | 831 | 832 | 852 | 880 | 1036 | 1092 | 1278 | 240 | 312 | 336 |

Slope over waves 1–10: -0.39 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.00 | 1.00 | 2.00 |
| runs that reached it | 1 | 1 | 1 |
| tough, every run | 1.63 | 1.50 | 2.29 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 22 | 20 | 15 | 13 | 7 | 3 | 1 | 1 | 1 |
| **saves a run** | **0.0** | **0.2** | **0.1** | **0.3** | **0.1** | **0.3** | **0.7** | **0.4** | **0.1** | **0.7** | **0.0** | **0.0** | **0.0** |
| ships saved a run | 0.0 | 0.2 | 0.1 | 0.2 | 0.1 | 0.2 | 0.6 | 0.3 | 0.1 | 0.4 | 0.0 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.07 | 0.15 | 0.00 | 0.33 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.21 | 0.08 | 0.21 | 0.09 | 0.15 | 0.47 | 0.23 | 0.00 | 0.67 | 0.00 | 0.00 | 0.00 |
| runs with no save | 100% | 79% | 96% | 88% | 95% | 75% | 47% | 69% | 86% | 33% | 100% | 100% | 100% |
|   pickup save | 0.00 | 0.13 | 0.00 | 0.04 | 0.05 | 0.05 | 0.20 | 0.08 | 0.14 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.04 | 0.00 | 0.08 | 0.00 | 0.10 | 0.07 | 0.00 | 0.00 | 0.33 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.07 | 0.15 | 0.00 | 0.33 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.04 | 0.04 | 0.13 | 0.05 | 0.10 | 0.40 | 0.15 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.31 | 0.63 | 0.76 | 0.72 | 0.77 | 0.79 | 1.05 | 1.67 | 0.99 | 1.62 | 1.39 | 1.15 | 0.95 |
| peaks | 0.1 | 0.4 | 0.5 | 0.4 | 0.5 | 0.7 | 1.1 | 1.0 | 0.9 | 1.0 | 1.0 | 1.0 | 2.0 |
| release after a peak (s) | 0.1 | 0.9 | 0.8 | 1.2 | 1.4 | 0.9 | 1.5 | 1.2 | 1.5 | 3.0 | 2.0 | 3.0 | 1.5 |
| hot share | 0% | 2% | 3% | 3% | 3% | 4% | 7% | 7% | 5% | 6% | 8% | 9% | 8% |
| calm share | 93% | 82% | 82% | 77% | 80% | 69% | 70% | 70% | 71% | 76% | 56% | 46% | 42% |
| shape (most runs) | flat 92% | flat 67% | flat 58% | flat 67% | flat 50% | flat 55% | flat 33% | one peak 46% | one peak 57% | one peak 100% | one peak 100% | one peak 100% | sawtooth 100% |
| taps follow tension (r) | 0.32 | 0.38 | 0.29 | 0.35 | 0.29 | 0.37 | 0.39 | 0.40 | 0.45 | 0.32 | 0.47 | 0.63 | 0.09 |

saves a run: waves 1–7 0.2, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w8, w9. 24 runs, 72 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | tesla, flak, shield | 0% | 7.4 | 6.0 | 19.4 | – (0) / – (0) / – (0) | 0.0 0.4 0.5 1.3 1.0 1.6 2.2 3.5 3.3 5.6 |
| off-counter | seeker, shrapnel, fullSteam | 4% | 7.5 | 6.0 | 19.8 | 0.00 (1) / 2.00 (1) / 1.00 (1) | 0.0 0.4 0.5 1.0 1.3 1.8 1.8 4.2 4.7 4.1 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
