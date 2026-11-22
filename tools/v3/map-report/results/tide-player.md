# Bot report: Tidewater Flats (`tide`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.4; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=tide --seeds=24 --armory=player --kits=plan`. Heat map: `tools/v3/map-report/results/tide-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.63; doubles on w7 (0.21→0.63), w9 (0.42→1.04) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 2.33 a run (83% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w4 ×0.84 of the no-encounter wave; outside on w4 ×0.84 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 43%, cold early 19%; lane 2: hot early 79%, cold late 0% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 10.6 s → w10 7.5 s (slope -0.28 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.58 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.38 (16), r2 1.69 (16), r3 2.06 (16); tough (every run): 0.54, 1.67, 2.00 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 4.3 lost 1–10, end 11.8; counter 4.8 lost 1–10, end 12.3 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 7 loses 0.63 after 0.21; wave 9 loses 1.04 after 0.42. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 4 sends ×0.84 the no-encounter wave. Encounters should replace launches, not add them.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.25 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 22%, middle 37%, late 41%.

## Ships lost per wave

Normal: won 54%, mean end wave 12.4 (14 = won), 3.7 lost in waves 1–10, 0.58 in waves 1–5. Tough: 4.1 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.38 | 0.04 | 0.17 | 0.21 | 0.63 | 0.42 | 1.04 | 1.25 | 0.54 | 1.67 | 2.00 |
| normal, runs that reached it | 0.00 | 0.00 | 0.38 | 0.04 | 0.17 | 0.21 | 0.63 | 0.42 | 1.00 | 1.00 | 0.38 | 1.69 | 2.06 |
| normal, mean over all runs | 0.00 | 0.00 | 0.38 | 0.04 | 0.17 | 0.21 | 0.63 | 0.42 | 1.00 | 0.83 | 0.25 | 1.13 | 1.38 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 20 | 16 | 16 | 16 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.63.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.8 | 1.5 | 2.1 | 1.7 | 2.0 | 1.9 | 2.0 | 2.2 | 2.7 | 2.2 | 0.5 | 1.7 | 1.6 |
| kills a minute | 41 | 42 | 48 | 45 | 44 | 42 | 47 | 48 | 51 | 53 | 10 | 23 | 20 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.7 | 3.5 | 2.5 | 2.3 | 4.2 | 3.5 | 3.8 | 3.5 | 3.5 | 3.5 | 2.6 | 2.9 | 2.4 |
| runs with ≥ 1 | 88% | 100% | 96% | 83% | 96% | 100% | 96% | 100% | 96% | 100% | 96% | 96% | 92% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 23.3 | 23.7 | 32.5 | 33.0 | 35.5 | 38.5 | 45.2 | 47.8 | 53.9 | 58.9 |
| launches (encounters off) | 22.0 | 26.4 | 36.2 | 39.2 | 39.2 | 43.4 | 46.9 | 49.6 | 58.8 | 66.0 |
| **ratio to encounters off** | 1.06 | 0.90 | 0.90 | **0.84** | 0.91 | 0.89 | 0.96 | 0.96 | 0.92 | 0.89 |
| table × scale | 22 | 30 | 38 | 43 | 45 | 52 | 60 | 66 | 76 | 91 |
| ratio to table × scale | 1.06 | 0.79 | 0.85 | 0.77 | 0.79 | 0.74 | 0.75 | 0.72 | 0.71 | 0.65 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 19% / 11% | 37% / 28% | 43% / 62% | 81.7 | late | early |
| 2 | 1–9 | 79% / 75% | 21% / 25% | 0% / 0% | 4.2 | early | late |
| all | 1–9 | 22% / 14% | 37% / 28% | 41% / 58% | 85.9 | late | early |
| 1 | 1–13 | 14% / 5% | 38% / 26% | 48% / 70% | 143.8 | late | early |
| 2 | 1–13 | 79% / 75% | 21% / 25% | 0% / 0% | 4.5 | early | late |
| all | 1–13 | 16% / 6% | 37% / 26% | 47% / 69% | 148.2 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.6 | 9.7 | 9.5 | 9.3 | 8.3 | 8.7 | 8.7 | 8.1 | 8.1 | 7.5 | 2.0 | 4.0 | 3.5 |
| launches read | 648 | 658 | 806 | 804 | 859 | 945 | 1045 | 1120 | 1261 | 1365 | 168 | 407 | 456 |

Slope over waves 1–10: -0.28 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.38 | 1.69 | 2.06 |
| runs that reached it | 16 | 16 | 16 |
| tough, every run | 0.54 | 1.67 | 2.00 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 20 | 16 | 16 | 16 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.3** | **0.1** | **0.0** | **0.1** | **0.4** |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 | 0.1 | 0.0 | 0.1 | 0.4 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.17 | 0.00 | 0.00 | 0.00 | 0.06 |
| clutch | 0.00 | 0.00 | 0.13 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.21 | 0.05 | 0.00 | 0.06 | 0.25 |
| runs with no save | 100% | 100% | 88% | 100% | 96% | 96% | 92% | 92% | 83% | 85% | 100% | 88% | 69% |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.17 | 0.05 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.13 |
|   kill save | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.08 | 0.04 | 0.08 | 0.05 | 0.00 | 0.00 | 0.31 |
| tension peak | 0.45 | 0.40 | 0.74 | 0.66 | 0.82 | 1.07 | 0.91 | 0.81 | 1.05 | 1.19 | 1.17 | 1.47 | 1.70 |
| peaks | 0.1 | 0.0 | 0.5 | 0.3 | 0.6 | 1.1 | 0.6 | 0.6 | 1.0 | 0.8 | 1.1 | 2.6 | 1.7 |
| release after a peak (s) | 0.2 | 0.0 | 1.0 | 0.6 | 0.8 | 1.8 | 1.9 | 1.3 | 1.2 | 1.6 | 2.2 | 2.2 | 2.1 |
| hot share | 0% | 0% | 2% | 1% | 2% | 4% | 2% | 2% | 5% | 3% | 8% | 19% | 17% |
| calm share | 92% | 87% | 84% | 84% | 81% | 77% | 85% | 79% | 76% | 82% | 73% | 60% | 62% |
| shape (most runs) | flat 87% | flat 100% | flat 54% | flat 75% | one peak 46% | one peak 75% | one peak 46% | flat 50% | one peak 42% | one peak 55% | one peak 88% | sawtooth 63% | sawtooth 63% |
| taps follow tension (r) | 0.39 | 0.38 | 0.39 | 0.29 | 0.39 | 0.38 | 0.26 | 0.28 | 0.33 | 0.34 | 0.72 | 0.51 | 0.59 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 319 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, aegis, bomberWing | 50% | 12.3 | 4.1 | 4.8 | 0.47 (15) / 1.53 (15) / 1.80 (15) | 0.0 0.0 0.4 0.0 0.1 0.3 0.6 0.6 1.0 1.7 |
| off-counter | tesla, grapnel, fullSteam | 25% | 11.8 | 3.8 | 4.3 | 1.07 (15) / 1.67 (15) / 2.40 (15) | 0.0 0.0 0.3 0.1 0.4 0.3 0.7 0.4 1.0 1.1 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
