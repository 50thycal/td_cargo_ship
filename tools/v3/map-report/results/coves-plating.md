# Bot report: Smugglers' Coves (`coves`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.25; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=coves --seeds=24 --armory=plating --kits=plan`. Heat map: `tools/v3/map-report/results/coves-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.37; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 0.83 a run (50% of runs have one); under 1 on w3 | ≥ 1 a run on every wave 3–10 | tough | **FLAG** |
| `w-budget` | Wave budgets ±15% | furthest w9 ×0.89 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 47%, cold early 21% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 7.7 s → w10 6.4 s (slope -0.24 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.46 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.30 (20), r2 0.95 (20), r3 1.10 (20); tough (every run): 0.50, 1.08, 1.08 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 3.2 lost 1–10, end 13.6; off-counter 3.8 lost 1–10, end 13.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Too few close calls on wave 3 (0.83): give those waves a launch from a near site, or one aimed at the danger stretch.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.04 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 21%, middle 33%, late 47%.

## Ships lost per wave

Normal: won 83%, mean end wave 13.3 (14 = won), 3.0 lost in waves 1–10, 0.46 in waves 1–5. Tough: 3.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.13 | 0.04 | 0.17 | 0.13 | 0.33 | 0.50 | 0.42 | 0.79 | 1.04 | 0.50 | 1.08 | 1.08 |
| normal, runs that reached it | 0.00 | 0.13 | 0.04 | 0.17 | 0.13 | 0.33 | 0.50 | 0.42 | 0.67 | 0.70 | 0.30 | 0.95 | 1.10 |
| normal, mean over all runs | 0.00 | 0.13 | 0.04 | 0.17 | 0.13 | 0.33 | 0.50 | 0.42 | 0.67 | 0.67 | 0.25 | 0.79 | 0.92 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 20 | 20 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.37.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.0 | 2.1 | 2.0 | 1.6 | 1.7 | 1.8 | 1.9 | 2.4 | 2.2 | 2.6 | 0.7 | 1.4 | 1.0 |
| kills a minute | 52 | 42 | 50 | 43 | 43 | 40 | 49 | 47 | 50 | 56 | 11 | 17 | 9 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 1.0 | 0.8 | 1.5 | 3.0 | 2.3 | 2.1 | 2.1 | 2.5 | 4.3 | 1.6 | 1.2 | 1.1 |
| runs with ≥ 1 | 8% | 75% | 50% | 63% | 96% | 88% | 92% | 92% | 92% | 92% | 83% | 63% | 75% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 23.3 | 25.7 | 33.3 | 34.4 | 36.2 | 38.4 | 45.6 | 48.3 | 53.2 | 67.5 |
| launches (encounters off) | 22.0 | 26.6 | 36.7 | 34.5 | 36.9 | 42.0 | 49.2 | 51.3 | 59.7 | 68.6 |
| **ratio to encounters off** | 1.06 | 0.97 | 0.91 | 1.00 | 0.98 | 0.91 | 0.93 | 0.94 | 0.89 | 0.98 |
| table × scale | 20 | 27 | 34 | 38 | 40 | 47 | 54 | 59 | 68 | 81 |
| ratio to table × scale | 1.16 | 0.95 | 0.98 | 0.91 | 0.90 | 0.82 | 0.84 | 0.82 | 0.78 | 0.83 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 21% / 15% | 33% / 38% | 47% / 47% | 29.3 | late | early |
| all | 1–9 | 21% / 15% | 33% / 38% | 47% / 47% | 29.3 | late | early |
| 1 | 1–13 | 13% / 7% | 45% / 50% | 42% / 43% | 54.0 | middle | early |
| all | 1–13 | 13% / 7% | 45% / 50% | 42% / 43% | 54.0 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.7 | 9.3 | 8.8 | 7.6 | 7.6 | 7.0 | 7.0 | 7.4 | 6.7 | 6.4 | 3.3 | 4.2 | 3.9 |
| launches read | 648 | 707 | 776 | 860 | 902 | 914 | 1058 | 1151 | 1220 | 1600 | 168 | 216 | 192 |

Slope over waves 1–10: -0.24 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.30 | 0.95 | 1.10 |
| runs that reached it | 20 | 20 | 20 |
| tough, every run | 0.50 | 1.08 | 1.08 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 20 | 20 |
| **saves a run** | **0.0** | **0.1** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.0** | **0.1** | **0.1** |
| ships saved a run | 0.0 | 0.1 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.0 | 0.1 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.08 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.17 | 0.00 | 0.00 | 0.00 |
| runs with no save | 100% | 92% | 100% | 100% | 100% | 100% | 96% | 96% | 96% | 83% | 100% | 95% | 95% |
|   pickup save | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.04 | 0.00 | 0.05 | 0.05 |
| tension peak | 0.18 | 0.41 | 0.39 | 0.51 | 0.65 | 0.69 | 0.67 | 0.76 | 0.75 | 0.99 | 0.70 | 0.95 | 0.90 |
| peaks | 0.0 | 0.1 | 0.0 | 0.1 | 0.3 | 0.3 | 0.3 | 0.3 | 0.4 | 1.3 | 0.4 | 1.0 | 1.2 |
| release after a peak (s) | 0.0 | 0.2 | 0.1 | 0.2 | 0.8 | 0.6 | 0.5 | 1.1 | 1.1 | 2.2 | 0.8 | 2.3 | 1.5 |
| hot share | 0% | 0% | 0% | 0% | 1% | 1% | 1% | 2% | 1% | 5% | 2% | 8% | 8% |
| calm share | 98% | 91% | 89% | 89% | 83% | 84% | 84% | 81% | 79% | 74% | 67% | 55% | 64% |
| shape (most runs) | flat 100% | flat 87% | flat 96% | flat 92% | flat 75% | flat 75% | flat 71% | flat 67% | flat 58% | one peak 52% | flat 60% | one peak 80% | one peak 50% |
| taps follow tension (r) | 0.48 | 0.33 | 0.24 | 0.33 | 0.31 | 0.34 | 0.32 | 0.32 | 0.26 | 0.28 | 0.63 | 0.59 | 0.75 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 88 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | orbital, frigate, gunships | 92% | 13.6 | 2.8 | 3.2 | 0.32 (22) / 1.14 (22) / 1.27 (22) | 0.0 0.1 0.0 0.1 0.1 0.3 0.4 0.5 0.7 0.9 |
| off-counter | tesla, fullSteam, seeker | 88% | 13.5 | 3.4 | 3.8 | 0.38 (21) / 0.62 (21) / 0.95 (21) | 0.0 0.2 0.0 0.1 0.2 0.4 0.5 0.5 0.8 1.1 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
