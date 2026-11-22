# Bot report: The Rig Field (`rigs`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.7; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=rigs --seeds=24 --armory=player --kits=plan`. Heat map: `tools/v3/map-report/results/rigs-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +0.37; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 1.25 a run (58% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w9 ×0.60 of the no-encounter wave; outside on w5 ×0.81, w6 ×0.74, w7 ×0.61, w8 ×0.64, w9 ×0.60, w10 ×0.63 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot early 35%, cold late 31% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 10.8 s → w10 5.3 s (slope -0.50 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.38 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.19 (21), r2 1.38 (21), r3 2.00 (20); tough (every run): 1.08, 1.33, 2.00 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 1.9 lost 1–10, end 13.6; off-counter 2.2 lost 1–10, end 13.6 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Budget: wave 5 sends ×0.81 the no-encounter wave; wave 6 sends ×0.74 the no-encounter wave; wave 7 sends ×0.61 the no-encounter wave; wave 8 sends ×0.64 the no-encounter wave; wave 9 sends ×0.60 the no-encounter wave; wave 10 sends ×0.63 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest late takes 31%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.08 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 35%, middle 34%, late 31%.

## Ships lost per wave

Normal: won 63%, mean end wave 13.1 (14 = won), 2.9 lost in waves 1–10, 0.38 in waves 1–5. Tough: 3.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.08 | 0.00 | 0.21 | 0.25 | 0.17 | 0.38 | 0.71 | 1.08 | 1.08 | 1.33 | 2.00 |
| normal, runs that reached it | 0.00 | 0.08 | 0.08 | 0.00 | 0.21 | 0.25 | 0.17 | 0.38 | 0.71 | 1.09 | 1.19 | 1.38 | 2.00 |
| normal, mean over all runs | 0.00 | 0.08 | 0.08 | 0.00 | 0.21 | 0.25 | 0.17 | 0.38 | 0.71 | 1.00 | 1.04 | 1.21 | 1.67 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 21 | 21 | 20 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +0.37.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.9 | 1.7 | 1.6 | 1.4 | 1.3 | 1.3 | 1.1 | 1.4 | 1.7 | 1.4 | 0.4 | 0.6 | 1.6 |
| kills a minute | 46 | 44 | 41 | 41 | 40 | 33 | 33 | 34 | 30 | 29 | 11 | 17 | 33 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.6 | 1.1 | 1.3 | 1.7 | 1.8 | 2.9 | 2.0 | 1.8 | 2.5 | 3.4 | 1.5 | 1.8 | 2.8 |
| runs with ≥ 1 | 42% | 63% | 58% | 75% | 67% | 100% | 75% | 79% | 88% | 96% | 79% | 88% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.5 | 26.6 | 30.0 | 30.6 | 30.7 | 31.6 | 29.0 | 30.5 | 32.0 | 36.9 |
| launches (encounters off) | 27.0 | 27.9 | 35.2 | 34.6 | 37.7 | 42.9 | 48.0 | 47.9 | 53.3 | 58.8 |
| **ratio to encounters off** | 0.91 | 0.95 | 0.85 | 0.88 | **0.81** | **0.74** | **0.61** | **0.64** | **0.60** | **0.63** |
| table × scale | 27 | 35 | 46 | 54 | 55 | 63 | 74 | 79 | 92 | 111 |
| ratio to table × scale | 0.91 | 0.76 | 0.65 | 0.57 | 0.56 | 0.50 | 0.39 | 0.39 | 0.35 | 0.33 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 35% / 27% | 34% / 40% | 31% / 33% | 37.8 | early | late |
| all | 1–9 | 35% / 27% | 34% / 40% | 31% / 33% | 37.8 | early | late |
| 1 | 1–13 | 25% / 10% | 48% / 67% | 26% / 23% | 70.8 | middle | early |
| all | 1–13 | 25% / 10% | 48% / 67% | 26% / 23% | 70.8 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.8 | 8.6 | 8.0 | 7.3 | 7.1 | 6.2 | 6.4 | 6.3 | 5.7 | 5.3 | 1.8 | 2.1 | 4.3 |
| launches read | 622 | 714 | 717 | 746 | 715 | 730 | 684 | 732 | 744 | 872 | 131 | 160 | 359 |

Slope over waves 1–10: -0.50 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.19 | 1.38 | 2.00 |
| runs that reached it | 21 | 21 | 20 |
| tough, every run | 1.08 | 1.33 | 2.00 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 21 | 21 | 20 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.1** | **0.1** | **0.1** | **0.0** | **0.1** | **0.1** | **0.2** | **0.2** | **0.4** | **0.1** |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.1 | 0.1 | 0.1 | 0.0 | 0.1 | 0.1 | 0.2 | 0.1 | 0.3 | 0.1 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 |
| clutch | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.00 | 0.00 | 0.04 | 0.00 | 0.14 | 0.05 | 0.33 | 0.05 |
| runs with no save | 100% | 100% | 96% | 88% | 88% | 92% | 100% | 92% | 92% | 77% | 81% | 67% | 95% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.14 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.00 | 0.05 | 0.05 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.14 | 0.10 | 0.10 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.08 | 0.13 | 0.08 | 0.04 | 0.00 | 0.04 | 0.08 | 0.05 | 0.05 | 0.10 | 0.05 |
| tension peak | 0.28 | 0.36 | 0.40 | 0.45 | 0.44 | 0.66 | 0.44 | 0.53 | 0.76 | 0.97 | 1.07 | 1.17 | 1.61 |
| peaks | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 | 0.4 | 0.1 | 0.2 | 0.4 | 0.6 | 1.4 | 1.3 | 1.6 |
| release after a peak (s) | 0.0 | 0.1 | 0.3 | 0.3 | 0.5 | 0.8 | 0.2 | 0.3 | 0.9 | 1.4 | 1.0 | 1.3 | 2.4 |
| hot share | 0% | 0% | 1% | 0% | 1% | 1% | 0% | 0% | 2% | 3% | 10% | 11% | 21% |
| calm share | 93% | 91% | 90% | 91% | 92% | 84% | 90% | 85% | 80% | 78% | 82% | 68% | 66% |
| shape (most runs) | flat 100% | flat 96% | flat 87% | flat 87% | flat 83% | flat 58% | flat 87% | flat 87% | flat 71% | flat 50% | one peak 43% | one peak 52% | one peak 45% |
| taps follow tension (r) | 0.08 | 0.07 | 0.18 | 0.22 | 0.27 | 0.20 | 0.23 | 0.29 | 0.24 | 0.22 | 0.24 | 0.21 | 0.20 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 248 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | railgun, flak, orbital | 67% | 13.6 | 1.9 | 1.9 | 1.04 (24) / 1.63 (24) / 1.74 (23) | 0.0 0.1 0.0 0.1 0.0 0.1 0.2 0.3 0.4 0.7 |
| off-counter | seeker, gunships, frigate | 75% | 13.6 | 2.2 | 2.2 | 0.78 (23) / 1.30 (23) / 1.78 (23) | 0.0 0.1 0.1 0.0 0.2 0.1 0.1 0.3 0.5 0.8 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
