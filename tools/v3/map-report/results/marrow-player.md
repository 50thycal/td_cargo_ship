# Bot report: Lee of Marrow (`marrow`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.95; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=marrow --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/marrow-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +0.25; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 2.17 a run (92% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w8 ×1.15 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 39%, cold early 29% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 11.4 s → w10 4.3 s (slope -0.76 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.29 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.57 (21), r2 0.57 (21), r3 1.38 (21); tough (every run): 0.63, 0.54, 1.42 | about 1 a round on the bot's scale, rising | normal | INFO |
| `g-mechanic` | Radar tower standing | normal: fell by w5 in 1, by w6 3, by w10 21, in the boss rounds 2, stood to the end 1 (of 24); median w8; tough: fell by w5 in 1, by w6 3, by w10 21, in the boss rounds 2, stood to the end 1 (of 24); median w8 | worth defending: standing past wave 6 in most runs | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 3.0 lost 1–10, end 13.5; counter 3.3 lost 1–10, end 13.2 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- No safe stretch on lane 1 (coldest early takes 29%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (0.67 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 29%, middle 39%, late 32%.

## Ships lost per wave

Normal: won 83%, mean end wave 13.3 (14 = won), 2.3 lost in waves 1–10, 0.29 in waves 1–5. Tough: 2.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.00 | 0.04 | 0.25 | 0.17 | 0.25 | 0.50 | 0.67 | 0.46 | 0.63 | 0.54 | 1.42 |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 | 0.04 | 0.25 | 0.17 | 0.25 | 0.50 | 0.65 | 0.45 | 0.57 | 0.57 | 1.38 |
| normal, mean over all runs | 0.00 | 0.00 | 0.00 | 0.04 | 0.25 | 0.17 | 0.25 | 0.50 | 0.63 | 0.42 | 0.50 | 0.50 | 1.21 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 21 | 21 | 21 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +0.25.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 1.0 | 2.2 | 3.3 | 3.9 | 3.8 | 5.7 | 8.5 | 7.3 | 8.3 | 3.6 | 4.5 | 4.3 |
| runs with ≥ 1 | 0% | 75% | 92% | 92% | 100% | 96% | 100% | 100% | 100% | 100% | 100% | 92% | 88% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 16.4 | 25.1 | 31.8 | 23.2 | 33.3 | 31.4 | 40.4 | 43.5 | 47.2 |
| launches (encounters off) | 15.0 | 16.4 | 23.2 | 29.5 | 23.5 | 29.5 | 30.0 | 35.3 | 40.7 | 45.5 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.08 | 1.08 | 0.99 | 1.13 | 1.05 | 1.15 | 1.07 | 1.04 |
| table × scale | 15 | 20 | 26 | 30 | 31 | 36 | 41 | 45 | 52 | 62 |
| ratio to table × scale | 1.00 | 0.82 | 0.97 | 1.06 | 0.75 | 0.93 | 0.77 | 0.90 | 0.84 | 0.76 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 29% / 18% | 39% / 53% | 32% / 29% | 35.0 | middle | early |
| all | 1–9 | 29% / 18% | 39% / 53% | 32% / 29% | 35.0 | middle | early |
| 1 | 1–13 | 27% / 14% | 43% / 58% | 30% / 29% | 84.6 | middle | early |
| all | 1–13 | 27% / 14% | 43% / 58% | 30% / 29% | 84.6 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 11.4 | 9.8 | 7.3 | 6.8 | 4.5 | 5.2 | 3.6 | 4.1 | 4.5 | 4.3 | 7.3 | 6.7 | 6.6 |
| launches read | 360 | 392 | 599 | 757 | 549 | 798 | 750 | 968 | 1044 | 1130 | 168 | 288 | 312 |

Slope over waves 1–10: -0.76 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.57 | 0.57 | 1.38 |
| runs that reached it | 21 | 21 | 21 |
| tough, every run | 0.63 | 0.54 | 1.42 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 21 | 21 | 21 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.2** | **0.1** | **0.1** | **0.2** | **0.3** | **0.3** | **0.4** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.1 | 0.1 | 0.2 | 0.2 | 0.3 | 0.3 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.00 | 0.08 | 0.09 | 0.05 | 0.05 | 0.24 | 0.19 |
| runs with no save | 100% | 100% | 100% | 96% | 96% | 92% | 88% | 92% | 91% | 82% | 76% | 81% | 71% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.00 | 0.09 | 0.05 | 0.05 | 0.10 | 0.05 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.08 | 0.08 | 0.00 | 0.00 | 0.00 | 0.10 | 0.10 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.05 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.00 | 0.14 | 0.24 | 0.10 | 0.19 |
| tension peak | 0.05 | 0.27 | 0.61 | 1.11 | 0.87 | 0.95 | 0.82 | 1.01 | 1.01 | 0.85 | 0.94 | 1.18 | 1.33 |
| peaks | 0.0 | 0.0 | 0.3 | 0.8 | 0.7 | 0.9 | 0.6 | 1.3 | 1.1 | 1.0 | 1.3 | 1.5 | 1.5 |
| release after a peak (s) | 0.0 | 0.0 | 0.5 | 1.3 | 1.1 | 1.9 | 0.8 | 1.6 | 1.6 | 1.3 | 1.5 | 2.3 | 3.2 |
| hot share | 0% | 0% | 1% | 3% | 2% | 3% | 2% | 5% | 5% | 2% | 9% | 16% | 21% |
| calm share | 100% | 96% | 88% | 87% | 82% | 82% | 74% | 72% | 70% | 73% | 61% | 48% | 34% |
| shape (most runs) | flat 100% | flat 100% | flat 75% | one peak 75% | one peak 54% | one peak 62% | one peak 50% | sawtooth 38% | one peak 35% | one peak 41% | sawtooth 38% | one peak 43% | one peak 52% |
| taps follow tension (r) | 0.39 | 0.26 | 0.38 | 0.36 | 0.51 | 0.44 | 0.37 | 0.40 | 0.34 | 0.31 | 0.55 | 0.45 | 0.47 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 293 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, seeker, droneScreen | 83% | 13.2 | 3.1 | 3.3 | 0.55 (20) / 0.95 (20) / 1.05 (20) | 0.0 0.0 0.0 0.0 0.2 0.4 0.5 0.6 0.8 0.8 |
| off-counter | scatter, railgun, overdrive | 88% | 13.5 | 3.0 | 3.0 | 0.33 (21) / 0.52 (21) / 1.38 (21) | 0.0 0.0 0.0 0.0 0.2 0.2 0.3 0.6 0.8 0.9 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
