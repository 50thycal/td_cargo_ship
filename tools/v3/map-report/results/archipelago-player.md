# Bot report: The Archipelago (`archipelago`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.1; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=archipelago --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/archipelago-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.46; doubles on w6 (0.25→0.58) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.71 a run (83% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.90 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot early 41%, cold late 22% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.3 s → w10 5.7 s (slope -0.18 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.46 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.07 (14), r2 0.33 (12), r3 1.33 (12); tough (every run): 1.63, 1.17, 2.33 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 5.0 lost 1–10, end 11.3; counter 5.6 lost 1–10, end 11.4 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 6 loses 0.58 after 0.25. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (1.42 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 41%, middle 37%, late 22%.

## Ships lost per wave

Normal: won 50%, mean end wave 11.6 (14 = won), 4.3 lost in waves 1–10, 0.46 in waves 1–5. Tough: 5.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.21 | 0.00 | 0.25 | 0.58 | 0.92 | 0.96 | 1.42 | 0.96 | 1.63 | 1.17 | 2.33 |
| normal, runs that reached it | 0.00 | 0.00 | 0.21 | 0.00 | 0.25 | 0.58 | 0.92 | 0.83 | 1.20 | 0.76 | 1.07 | 0.33 | 1.33 |
| normal, mean over all runs | 0.00 | 0.00 | 0.21 | 0.00 | 0.25 | 0.58 | 0.92 | 0.83 | 1.00 | 0.54 | 0.63 | 0.17 | 0.67 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 20 | 17 | 14 | 12 | 12 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.46.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.6 | 1.4 | 1.7 | 2.1 | 4.2 | 3.8 | 4.8 | 5.5 | 4.6 | 5.8 | 5.0 | 6.5 | 9.3 |
| runs with ≥ 1 | 46% | 75% | 83% | 96% | 100% | 96% | 100% | 96% | 100% | 100% | 100% | 100% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 18.0 | 19.4 | 24.3 | 30.8 | 31.3 | 38.0 | 34.5 | 42.8 | 46.1 | 53.4 |
| launches (encounters off) | 18.0 | 21.0 | 24.1 | 30.8 | 28.5 | 34.5 | 38.5 | 43.4 | 50.6 | 57.8 |
| **ratio to encounters off** | 1.00 | 0.92 | 1.01 | 1.00 | 1.10 | 1.10 | 0.90 | 0.99 | 0.91 | 0.92 |
| table × scale | 18 | 23 | 29 | 35 | 36 | 41 | 48 | 52 | 60 | 72 |
| ratio to table × scale | 1.00 | 0.84 | 0.84 | 0.88 | 0.87 | 0.93 | 0.72 | 0.82 | 0.77 | 0.74 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 41% / 51% | 37% / 37% | 22% / 13% | 61.3 | early | late |
| all | 1–9 | 41% / 51% | 37% / 37% | 22% / 13% | 61.3 | early | late |
| 1 | 1–13 | 46% / 56% | 32% / 31% | 22% / 13% | 115.2 | early | late |
| all | 1–13 | 46% / 56% | 32% / 31% | 22% / 13% | 115.2 | early | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.3 | 6.5 | 5.6 | 6.8 | 5.6 | 5.9 | 5.9 | 5.6 | 5.9 | 5.7 | 5.9 | 5.6 | 5.4 |
| launches read | 432 | 462 | 578 | 730 | 748 | 902 | 824 | 1021 | 1101 | 1271 | 1297 | 1620 | 1812 |

Slope over waves 1–10: -0.18 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.07 | 0.33 | 1.33 |
| runs that reached it | 14 | 12 | 12 |
| tough, every run | 1.63 | 1.17 | 2.33 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 20 | 17 | 14 | 12 | 12 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.2** | **0.5** | **0.2** | **0.5** | **0.5** | **0.2** | **0.1** | **0.2** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.2 | 0.2 | 0.4 | 0.1 | 0.4 | 0.4 | 0.1 | 0.1 | 0.1 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.06 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.04 | 0.00 | 0.21 | 0.17 | 0.38 | 0.08 | 0.15 | 0.41 | 0.14 | 0.00 | 0.17 |
| runs with no save | 100% | 100% | 96% | 96% | 83% | 83% | 67% | 88% | 60% | 59% | 93% | 92% | 83% |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.17 | 0.04 | 0.20 | 0.29 | 0.07 | 0.08 | 0.08 |
|   cover choice | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.04 | 0.13 | 0.04 | 0.25 | 0.00 | 0.00 | 0.00 | 0.08 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.04 | 0.00 | 0.12 | 0.14 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.13 | 0.08 | 0.04 | 0.05 | 0.12 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.25 | 0.41 | 0.69 | 0.48 | 1.01 | 0.94 | 1.04 | 0.97 | 1.14 | 0.99 | 1.06 | 0.94 | 1.26 |
| peaks | 0.0 | 0.0 | 0.3 | 0.1 | 1.0 | 0.6 | 1.1 | 0.9 | 1.2 | 1.1 | 0.9 | 0.7 | 0.9 |
| release after a peak (s) | 0.0 | 0.0 | 0.5 | 0.3 | 1.8 | 1.5 | 1.8 | 1.7 | 1.7 | 2.6 | 2.4 | 2.5 | 2.7 |
| hot share | 0% | 0% | 1% | 0% | 4% | 3% | 3% | 5% | 4% | 4% | 9% | 6% | 13% |
| calm share | 95% | 94% | 89% | 85% | 81% | 77% | 75% | 74% | 72% | 71% | 67% | 66% | 55% |
| shape (most runs) | flat 100% | flat 100% | flat 71% | flat 92% | one peak 75% | one peak 50% | one peak 62% | one peak 42% | one peak 50% | one peak 53% | one peak 36% | one peak 50% | one peak 50% |
| taps follow tension (r) | 0.41 | 0.36 | 0.40 | 0.40 | 0.36 | 0.41 | 0.38 | 0.31 | 0.40 | 0.31 | 0.37 | 0.32 | 0.30 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8. 24 runs, 223 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | airstrike, aegis, flak | 46% | 11.4 | 4.4 | 5.6 | 1.15 (13) / 0.36 (11) / 1.45 (11) | 0.0 0.0 0.2 0.0 0.2 0.5 0.9 1.0 1.8 1.0 |
| off-counter | seeker, railgun, droneScreen | 29% | 11.3 | 4.1 | 5.0 | 2.14 (14) / 1.42 (12) / 2.00 (8) | 0.0 0.0 0.1 0.0 0.3 0.5 0.8 0.9 1.3 1.2 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
