# Bot report: Lee of Marrow (`marrow`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.95; built 2026-11-19.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=marrow --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/marrow-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +0.54; doubles on w8 (0.21→0.63) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.50 a run (88% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w5 ×1.09 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 45%, cold early 27% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 11.4 s → w10 3.8 s (slope -0.86 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.04 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.52 (21), r2 0.76 (21), r3 1.71 (21); tough (every run): 0.46, 0.75, 1.88 | about 1 a round on the bot's scale, rising | normal | INFO |
| `g-mechanic` | Radar tower standing | normal: fell by w5 in 6, by w6 9, by w10 22, in the boss rounds 1, stood to the end 1 (of 24); median w8; tough: fell by w5 in 6, by w6 9, by w10 22, in the boss rounds 1, stood to the end 1 (of 24); median w8 | worth defending: standing past wave 6 in most runs | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 3.1 lost 1–10, end 13.6; counter 3.5 lost 1–10, end 13.3 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 8 loses 0.63 after 0.21. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest early takes 27%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.46 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 27%, middle 45%, late 28%.

## Ships lost per wave

Normal: won 79%, mean end wave 13.4 (14 = won), 3.1 lost in waves 1–10, 0.04 in waves 1–5. Tough: 3.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.29 | 0.21 | 0.63 | 0.92 | 1.46 | 0.46 | 0.75 | 1.88 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.29 | 0.21 | 0.63 | 0.71 | 1.30 | 0.52 | 0.76 | 1.71 |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.29 | 0.21 | 0.63 | 0.71 | 1.25 | 0.46 | 0.67 | 1.50 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 21 | 21 | 21 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +0.54.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 1.0 | 1.5 | 2.2 | 3.4 | 4.6 | 6.0 | 8.9 | 7.5 | 10.3 | 4.0 | 4.0 | 2.9 |
| runs with ≥ 1 | 0% | 75% | 88% | 88% | 96% | 100% | 100% | 100% | 100% | 100% | 88% | 92% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 16.4 | 24.2 | 31.0 | 25.7 | 31.5 | 28.4 | 37.0 | 40.0 | 47.3 |
| launches (encounters off) | 15.0 | 16.4 | 23.2 | 29.4 | 23.5 | 29.6 | 29.8 | 35.8 | 40.7 | 45.1 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.04 | 1.05 | 1.09 | 1.06 | 0.96 | 1.03 | 0.98 | 1.05 |
| table × scale | 15 | 20 | 26 | 30 | 31 | 36 | 41 | 45 | 52 | 62 |
| ratio to table × scale | 1.00 | 0.82 | 0.93 | 1.03 | 0.83 | 0.87 | 0.69 | 0.82 | 0.77 | 0.76 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 27% / 10% | 45% / 72% | 28% / 18% | 34.9 | middle | early |
| all | 1–9 | 27% / 10% | 45% / 72% | 28% / 18% | 34.9 | middle | early |
| 1 | 1–13 | 24% / 9% | 46% / 60% | 29% / 31% | 90.1 | middle | early |
| all | 1–13 | 24% / 9% | 46% / 60% | 29% / 31% | 90.1 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 11.4 | 9.8 | 8.0 | 6.9 | 5.2 | 4.8 | 3.2 | 3.7 | 3.9 | 3.8 | 7.2 | 6.8 | 6.1 |
| launches read | 360 | 392 | 577 | 737 | 610 | 750 | 678 | 885 | 956 | 1134 | 168 | 288 | 312 |

Slope over waves 1–10: -0.86 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.52 | 0.76 | 1.71 |
| runs that reached it | 21 | 21 | 21 |
| tough, every run | 0.46 | 0.75 | 1.88 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 21 | 21 | 21 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.4** | **0.2** | **0.0** | **0.4** | **0.4** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.3 | 0.1 | 0.0 | 0.3 | 0.3 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.17 | 0.13 | 0.00 | 0.29 | 0.14 |
| runs with no save | 100% | 100% | 100% | 100% | 96% | 100% | 96% | 88% | 75% | 83% | 100% | 76% | 71% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.09 | 0.00 | 0.19 | 0.05 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.00 | 0.00 | 0.05 | 0.14 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.04 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.08 | 0.13 | 0.04 | 0.00 | 0.14 | 0.19 |
| tension peak | 0.05 | 0.27 | 0.50 | 0.56 | 0.65 | 0.73 | 0.73 | 0.98 | 0.98 | 1.23 | 0.99 | 1.19 | 1.45 |
| peaks | 0.0 | 0.0 | 0.2 | 0.3 | 0.3 | 0.4 | 0.7 | 1.1 | 1.1 | 1.7 | 1.0 | 1.5 | 1.7 |
| release after a peak (s) | 0.0 | 0.0 | 0.3 | 0.4 | 0.6 | 0.9 | 1.0 | 1.6 | 1.7 | 2.8 | 1.7 | 3.2 | 3.1 |
| hot share | 0% | 0% | 0% | 1% | 1% | 2% | 2% | 4% | 4% | 6% | 8% | 20% | 25% |
| calm share | 100% | 96% | 90% | 89% | 84% | 81% | 78% | 72% | 72% | 68% | 62% | 43% | 37% |
| shape (most runs) | flat 100% | flat 100% | flat 83% | flat 75% | flat 71% | flat 62% | flat 58% | one peak 38% | one peak 46% | sawtooth rising 39% | one peak 43% | one peak 48% | sawtooth 43% |
| taps follow tension (r) | 0.39 | 0.26 | 0.33 | 0.33 | 0.42 | 0.43 | 0.48 | 0.36 | 0.36 | 0.40 | 0.55 | 0.46 | 0.40 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 257 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, seeker, droneScreen | 79% | 13.3 | 3.0 | 3.5 | 0.52 (21) / 0.57 (21) / 1.67 (21) | 0.0 0.0 0.0 0.0 0.0 0.4 0.4 0.3 0.8 1.5 |
| off-counter | scatter, railgun, overdrive | 92% | 13.6 | 3.0 | 3.1 | 0.23 (22) / 0.86 (22) / 1.05 (22) | 0.0 0.0 0.0 0.0 0.0 0.2 0.3 0.5 0.8 1.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
