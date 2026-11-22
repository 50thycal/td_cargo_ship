# Bot report: Smugglers' Coves (`coves`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.25; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=coves --seeds=24 --armory=player --kits=plan`. Heat map: `tools/v3/map-report/results/coves-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w7 +0.42; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 1.04 a run (79% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.75 of the no-encounter wave; outside on w6 ×0.84, w7 ×0.75 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 45%, cold early 18% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 7.7 s → w10 6.4 s (slope -0.25 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.75 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.50 (16), r2 1.25 (16), r3 2.38 (16); tough (every run): 0.63, 1.25, 2.54 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 5.0 lost 1–10, end 12.4; off-counter 5.6 lost 1–10, end 11.6 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Budget: wave 6 sends ×0.84 the no-encounter wave; wave 7 sends ×0.75 the no-encounter wave. Encounters should replace launches, not add them.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (1.08 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 18%, middle 36%, late 45%.

## Ships lost per wave

Normal: won 63%, mean end wave 12.3 (14 = won), 4.2 lost in waves 1–10, 0.75 in waves 1–5. Tough: 5.2 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.25 | 0.13 | 0.04 | 0.33 | 0.42 | 0.83 | 1.04 | 1.08 | 1.08 | 0.63 | 1.25 | 2.54 |
| normal, runs that reached it | 0.00 | 0.25 | 0.13 | 0.04 | 0.33 | 0.42 | 0.83 | 0.87 | 0.62 | 1.00 | 0.50 | 1.25 | 2.38 |
| normal, mean over all runs | 0.00 | 0.25 | 0.13 | 0.04 | 0.33 | 0.42 | 0.83 | 0.83 | 0.54 | 0.79 | 0.33 | 0.83 | 1.58 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 21 | 19 | 16 | 16 | 16 |

Biggest one-wave step up (tough, waves 2–10): wave 7, +0.42.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.0 | 2.2 | 1.9 | 1.7 | 1.9 | 1.7 | 1.7 | 2.3 | 2.1 | 2.7 | 0.7 | 1.4 | 1.1 |
| kills a minute | 52 | 42 | 50 | 42 | 43 | 38 | 37 | 47 | 51 | 55 | 11 | 15 | 8 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 0.9 | 1.0 | 1.3 | 3.7 | 2.9 | 2.3 | 1.9 | 2.5 | 4.0 | 1.2 | 1.2 | 1.2 |
| runs with ≥ 1 | 4% | 71% | 79% | 71% | 100% | 100% | 92% | 75% | 96% | 96% | 71% | 79% | 75% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 23.3 | 25.7 | 32.9 | 33.9 | 36.2 | 34.4 | 36.3 | 48.0 | 53.3 | 67.0 |
| launches (encounters off) | 22.0 | 26.6 | 36.2 | 33.7 | 37.8 | 40.8 | 48.1 | 51.7 | 58.2 | 68.6 |
| **ratio to encounters off** | 1.06 | 0.97 | 0.91 | 1.01 | 0.96 | **0.84** | **0.75** | 0.93 | 0.92 | 0.98 |
| table × scale | 20 | 27 | 34 | 38 | 40 | 47 | 54 | 59 | 68 | 81 |
| ratio to table × scale | 1.16 | 0.95 | 0.97 | 0.89 | 0.91 | 0.73 | 0.67 | 0.81 | 0.78 | 0.83 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 18% / 18% | 36% / 41% | 45% / 40% | 50.4 | late | early |
| all | 1–9 | 18% / 18% | 36% / 41% | 45% / 40% | 50.4 | late | early |
| 1 | 1–13 | 13% / 10% | 47% / 61% | 39% / 29% | 90.1 | middle | early |
| all | 1–13 | 13% / 10% | 47% / 61% | 39% / 29% | 90.1 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.7 | 9.5 | 8.8 | 7.5 | 7.5 | 6.2 | 6.3 | 7.6 | 6.8 | 6.4 | 3.5 | 4.2 | 3.9 |
| launches read | 648 | 706 | 770 | 847 | 905 | 821 | 838 | 1144 | 1223 | 1584 | 168 | 216 | 192 |

Slope over waves 1–10: -0.25 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.50 | 1.25 | 2.38 |
| runs that reached it | 16 | 16 | 16 |
| tough, every run | 0.63 | 1.25 | 2.54 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 21 | 19 | 16 | 16 | 16 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.1** | **0.2** | **0.0** | **0.4** | **0.1** | **0.0** | **0.1** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.1 | 0.0 | 0.2 | 0.0 | 0.0 | 0.1 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.11 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.17 | 0.13 | 0.13 | 0.05 | 0.26 | 0.06 | 0.00 | 0.06 |
| runs with no save | 100% | 100% | 100% | 100% | 96% | 88% | 88% | 87% | 95% | 63% | 94% | 100% | 88% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.04 | 0.09 | 0.00 | 0.11 | 0.06 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.09 | 0.05 | 0.21 | 0.00 | 0.00 | 0.13 |
| tension peak | 0.16 | 0.41 | 0.38 | 0.50 | 0.79 | 0.65 | 0.79 | 0.83 | 0.75 | 1.02 | 0.81 | 0.96 | 1.09 |
| peaks | 0.0 | 0.0 | 0.0 | 0.1 | 0.5 | 0.4 | 0.5 | 0.5 | 0.4 | 1.2 | 0.6 | 0.9 | 1.8 |
| release after a peak (s) | 0.0 | 0.0 | 0.1 | 0.1 | 1.6 | 0.8 | 1.4 | 1.5 | 0.9 | 2.6 | 1.2 | 2.4 | 2.0 |
| hot share | 0% | 0% | 0% | 0% | 2% | 1% | 2% | 3% | 2% | 5% | 3% | 8% | 15% |
| calm share | 99% | 88% | 90% | 88% | 79% | 83% | 82% | 82% | 78% | 71% | 68% | 53% | 60% |
| shape (most runs) | flat 100% | flat 100% | flat 96% | flat 92% | flat 54% | flat 62% | flat 54% | flat 52% | flat 62% | one peak 53% | one peak 63% | one peak 81% | sawtooth 50% |
| taps follow tension (r) | 0.49 | 0.30 | 0.29 | 0.35 | 0.37 | 0.30 | 0.38 | 0.30 | 0.32 | 0.30 | 0.62 | 0.49 | 0.62 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 207 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | orbital, frigate, gunships | 67% | 12.4 | 4.0 | 5.0 | 0.71 (17) / 1.29 (17) / 2.12 (17) | 0.0 0.3 0.1 0.1 0.3 0.6 0.7 1.0 1.3 0.8 |
| off-counter | tesla, fullSteam, seeker | 29% | 11.6 | 4.4 | 5.6 | 1.00 (14) / 1.36 (14) / 2.54 (13) | 0.0 0.2 0.1 0.0 0.3 0.5 0.9 1.2 1.3 1.1 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
