# Bot report: Lee of Marrow (`marrow`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.95; built 2026-11-19.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=marrow --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/marrow-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w7 +0.54; doubles on w7 (0.13→0.67) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 2.17 a run (92% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w6 ×1.13 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 42%, cold early 26% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 11.4 s → w10 4.1 s (slope -0.81 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.25 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.33 (21), r2 0.95 (21), r3 1.76 (21); tough (every run): 0.29, 1.00, 1.67 | about 1 a round on the bot's scale, rising | normal | INFO |
| `g-mechanic` | Radar tower standing | normal: fell by w5 in 4, by w6 7, by w10 22, in the boss rounds 2, stood to the end 0 (of 24); median w7; tough: fell by w5 in 4, by w6 7, by w10 22, in the boss rounds 2, stood to the end 0 (of 24); median w7 | worth defending: standing past wave 6 in most runs | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 3.0 lost 1–10, end 13.1; off-counter 3.1 lost 1–10, end 13.1 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 7 loses 0.67 after 0.13. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest early takes 26%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 8 (0.71 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 26%, middle 42%, late 32%.

## Ships lost per wave

Normal: won 83%, mean end wave 13.4 (14 = won), 2.6 lost in waves 1–10, 0.25 in waves 1–5. Tough: 2.8 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.00 | 0.04 | 0.21 | 0.13 | 0.67 | 0.71 | 0.38 | 0.67 | 0.29 | 1.00 | 1.67 |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 | 0.04 | 0.21 | 0.13 | 0.67 | 0.71 | 0.38 | 0.52 | 0.33 | 0.95 | 1.76 |
| normal, mean over all runs | 0.00 | 0.00 | 0.00 | 0.04 | 0.21 | 0.13 | 0.67 | 0.71 | 0.38 | 0.50 | 0.29 | 0.83 | 1.54 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 21 | 21 | 21 |

Biggest one-wave step up (tough, waves 2–10): wave 7, +0.54.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 1.0 | 2.2 | 3.3 | 4.1 | 4.1 | 5.7 | 9.2 | 6.3 | 7.9 | 3.7 | 2.7 | 4.7 |
| runs with ≥ 1 | 0% | 75% | 92% | 92% | 100% | 96% | 100% | 100% | 100% | 100% | 83% | 92% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 16.4 | 25.1 | 31.8 | 23.2 | 33.4 | 28.6 | 36.0 | 39.8 | 43.3 |
| launches (encounters off) | 15.0 | 16.4 | 23.2 | 29.4 | 23.5 | 29.6 | 29.8 | 35.8 | 40.7 | 45.1 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.08 | 1.08 | 0.99 | 1.13 | 0.96 | 1.00 | 0.98 | 0.96 |
| table × scale | 15 | 20 | 26 | 30 | 31 | 36 | 41 | 45 | 52 | 62 |
| ratio to table × scale | 1.00 | 0.82 | 0.97 | 1.06 | 0.75 | 0.93 | 0.70 | 0.80 | 0.77 | 0.70 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 26% / 16% | 42% / 57% | 32% / 27% | 37.3 | middle | early |
| all | 1–9 | 26% / 16% | 42% / 57% | 32% / 27% | 37.3 | middle | early |
| 1 | 1–13 | 25% / 11% | 46% / 60% | 29% / 29% | 89.4 | middle | early |
| all | 1–13 | 25% / 11% | 46% / 60% | 29% / 29% | 89.4 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 11.4 | 9.8 | 7.3 | 6.8 | 4.4 | 5.0 | 3.1 | 3.7 | 4.2 | 4.1 | 7.0 | 6.7 | 6.3 |
| launches read | 360 | 392 | 599 | 757 | 549 | 797 | 686 | 861 | 951 | 1036 | 168 | 288 | 312 |

Slope over waves 1–10: -0.81 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.33 | 0.95 | 1.76 |
| runs that reached it | 21 | 21 | 21 |
| tough, every run | 0.29 | 1.00 | 1.67 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 21 | 21 | 21 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.0** | **0.2** | **0.2** | **0.2** | **0.2** | **0.2** | **0.4** | **0.6** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.2 | 0.2 | 0.1 | 0.2 | 0.1 | 0.3 | 0.4 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.00 | 0.08 | 0.17 | 0.17 | 0.22 | 0.14 | 0.33 | 0.52 |
| runs with no save | 100% | 100% | 100% | 96% | 92% | 96% | 88% | 83% | 88% | 78% | 86% | 62% | 57% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.08 | 0.00 | 0.09 | 0.10 | 0.24 | 0.24 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.08 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.10 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.09 | 0.05 | 0.00 | 0.05 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.13 | 0.08 | 0.04 | 0.05 | 0.19 | 0.19 |
| tension peak | 0.05 | 0.27 | 0.61 | 1.11 | 0.91 | 0.97 | 1.01 | 0.99 | 0.92 | 0.85 | 0.95 | 1.13 | 1.48 |
| peaks | 0.0 | 0.0 | 0.3 | 0.8 | 0.8 | 0.8 | 1.0 | 1.3 | 0.8 | 1.1 | 1.2 | 1.3 | 1.5 |
| release after a peak (s) | 0.0 | 0.0 | 0.5 | 1.3 | 1.2 | 1.9 | 1.8 | 1.6 | 1.5 | 1.4 | 2.1 | 3.0 | 3.9 |
| hot share | 0% | 0% | 1% | 3% | 3% | 4% | 4% | 3% | 3% | 2% | 8% | 17% | 27% |
| calm share | 100% | 96% | 88% | 87% | 81% | 81% | 74% | 72% | 72% | 70% | 66% | 40% | 37% |
| shape (most runs) | flat 100% | flat 100% | flat 75% | one peak 75% | one peak 50% | one peak 62% | one peak 50% | one peak 42% | one peak 50% | one peak 48% | one peak 48% | one peak 57% | one peak 43% |
| taps follow tension (r) | 0.39 | 0.26 | 0.38 | 0.36 | 0.52 | 0.45 | 0.38 | 0.40 | 0.40 | 0.43 | 0.61 | 0.37 | 0.47 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 196 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, seeker, droneScreen | 79% | 13.1 | 2.8 | 3.0 | 0.26 (19) / 0.79 (19) / 1.21 (19) | 0.0 0.0 0.0 0.1 0.2 0.3 0.5 0.6 0.8 0.6 |
| off-counter | scatter, railgun, overdrive | 67% | 13.1 | 3.1 | 3.1 | 0.40 (20) / 0.85 (20) / 1.85 (20) | 0.0 0.0 0.0 0.0 0.2 0.2 0.5 0.6 0.5 1.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
