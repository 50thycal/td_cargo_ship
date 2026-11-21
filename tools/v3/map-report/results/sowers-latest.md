# Bot report: Sowers' Reach (`sowers`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.45; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=sowers --seeds=24 --armory=latest --kits=plan`. Heat map: `tools/v3/map-report/results/sowers-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.96; doubles on w8 (0.38→1.17) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 0.92 a run (46% of runs have one); under 1 on w4 | ≥ 1 a run on every wave 3–10 | tough | **FLAG** |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.90 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 41%, cold early 21% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.8 s → w10 5.0 s (slope -0.41 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.58 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.67 (15), r2 1.13 (15), r3 1.13 (15); tough (every run): 0.63, 0.83, 1.17 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 5.8 lost 1–10, end 12.0; off-counter 7.2 lost 1–10, end 11.1 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 8 loses 1.17 after 0.38. Move budget from it to the wave before, or soften its biggest raid.
- Too few close calls on wave 4 (0.92): give those waves a launch from a near site, or one aimed at the danger stretch.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (2.13 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 21%, middle 38%, late 41%.

## Ships lost per wave

Normal: won 63%, mean end wave 12.0 (14 = won), 4.2 lost in waves 1–10, 0.58 in waves 1–5, 0.13 in bonus waves. Tough: 6.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.17 | 0.21 | 0.13 | 0.08 | 0.46 | 0.38 | 1.17 | 2.13 | 1.54 | 0.63 | 0.83 | 1.17 |
| normal, runs that reached it | 0.00 | 0.17 | 0.21 | 0.13 | 0.08 | 0.42 | 0.39 | 1.04 | 1.25 | 1.00 | 0.67 | 1.13 | 1.13 |
| normal, mean over all runs | 0.00 | 0.17 | 0.21 | 0.13 | 0.08 | 0.42 | 0.38 | 1.00 | 1.04 | 0.75 | 0.42 | 0.71 | 0.71 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 20 | 18 | 15 | 15 | 15 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.96.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.8 | 2.2 | 1.8 | 2.0 | 1.7 | 2.1 | 2.1 | 2.5 | 2.6 | 1.7 | 1.8 | 3.1 | 4.4 |
| kills a minute | 54 | 52 | 51 | 48 | 49 | 51 | 48 | 53 | 55 | 48 | 40 | 56 | 66 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 0.8 | 2.2 | 0.9 | 1.3 | 1.7 | 3.0 | 3.0 | 4.9 | 4.9 | 1.2 | 1.2 | 1.3 |
| runs with ≥ 1 | 4% | 50% | 96% | 46% | 75% | 92% | 88% | 88% | 100% | 100% | 71% | 75% | 71% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.3 | 31.3 | 34.8 | 38.3 | 37.5 | 42.7 | 44.6 | 50.9 | 55.2 | 61.6 |
| launches (encounters off) | 25.0 | 30.3 | 38.2 | 39.0 | 41.4 | 43.7 | 49.8 | 52.4 | 59.0 | 66.6 |
| **ratio to encounters off** | 0.97 | 1.03 | 0.91 | 0.98 | 0.91 | 0.98 | 0.90 | 0.97 | 0.93 | 0.92 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.05 | 1.01 | 0.89 | 0.87 | 0.81 | 0.81 | 0.72 | 0.75 | 0.71 | 0.66 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 21% / 14% | 38% / 37% | 41% / 49% | 38.9 | late | early |
| all | 1–9 | 21% / 14% | 38% / 37% | 41% / 49% | 38.9 | late | early |
| 1 | 1–13 | 17% / 12% | 34% / 31% | 49% / 57% | 63.7 | late | early |
| all | 1–13 | 17% / 12% | 34% / 31% | 49% / 57% | 63.7 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.8 | 8.4 | 7.8 | 7.6 | 7.2 | 5.5 | 6.4 | 5.8 | 5.8 | 5.0 | 1.5 | 1.7 | 1.6 |
| launches read | 600 | 745 | 817 | 802 | 810 | 855 | 886 | 1016 | 1099 | 1272 | 216 | 288 | 312 |

Slope over waves 1–10: -0.41 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.67 | 1.13 | 1.13 |
| runs that reached it | 15 | 15 | 15 |
| tough, every run | 0.63 | 0.83 | 1.17 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 20 | 18 | 15 | 15 | 15 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.4** | **0.1** | **0.6** | **0.2** | **0.4** | **0.6** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.3 | 0.1 | 0.5 | 0.2 | 0.3 | 0.4 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.00 | 0.11 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.04 | 0.09 | 0.17 | 0.10 | 0.33 | 0.13 | 0.20 | 0.47 |
| runs with no save | 100% | 96% | 100% | 100% | 100% | 96% | 91% | 70% | 95% | 61% | 80% | 67% | 40% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.09 | 0.17 | 0.05 | 0.28 | 0.13 | 0.20 | 0.27 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.13 | 0.00 | 0.11 | 0.07 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.07 | 0.13 |
|   kill save | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.05 | 0.17 | 0.00 | 0.13 | 0.20 |
| tension peak | 0.14 | 0.43 | 0.60 | 0.35 | 0.35 | 0.72 | 0.79 | 0.93 | 1.07 | 1.15 | 0.69 | 0.74 | 0.94 |
| peaks | 0.0 | 0.1 | 0.3 | 0.0 | 0.0 | 0.5 | 0.7 | 0.7 | 0.8 | 1.2 | 0.3 | 0.4 | 0.9 |
| release after a peak (s) | 0.0 | 0.2 | 0.4 | 0.2 | 0.0 | 0.9 | 0.8 | 1.9 | 1.6 | 1.6 | 0.6 | 0.8 | 2.5 |
| hot share | 0% | 1% | 1% | 0% | 0% | 2% | 2% | 4% | 5% | 4% | 1% | 2% | 5% |
| calm share | 99% | 89% | 88% | 94% | 91% | 83% | 80% | 75% | 74% | 80% | 66% | 54% | 51% |
| shape (most runs) | flat 100% | flat 92% | flat 71% | flat 96% | flat 100% | flat 58% | flat 52% | flat 43% | one peak 45% | one peak 72% | flat 67% | flat 67% | one peak 80% |
| taps follow tension (r) | 0.37 | 0.39 | 0.28 | 0.44 | 0.37 | 0.34 | 0.36 | 0.36 | 0.38 | 0.33 | 0.49 | 0.36 | 0.40 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9. 24 runs, 122 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | tesla, flak, shield | 63% | 12.0 | 4.0 | 5.8 | 0.60 (15) / 0.80 (15) / 1.33 (15) | 0.0 0.1 0.1 0.1 0.1 0.3 0.6 0.8 1.9 1.6 |
| off-counter | seeker, shrapnel, fullSteam | 38% | 11.1 | 4.9 | 7.2 | 1.11 (9) / 1.00 (9) / 1.11 (9) | 0.0 0.2 0.2 0.1 0.2 0.3 0.8 1.3 1.4 2.8 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
