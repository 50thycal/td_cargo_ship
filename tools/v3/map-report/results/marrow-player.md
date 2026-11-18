# Bot report: Lee of Marrow (`marrow`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.95; built 2026-11-18.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=marrow --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/marrow-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.58; doubles on w9 (0.50→1.08) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 2.33 a run (88% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w5 ×1.12 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 50%, cold early 23% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.4 s → w10 3.7 s (slope -0.57 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.42 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.61 (18), r2 0.56 (18), r3 1.44 (18); tough (every run): 0.63, 0.63, 1.46 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 3.9 lost 1–10, end 12.5; counter 4.0 lost 1–10, end 12.9 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 9 loses 1.08 after 0.50. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.58 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 23%, middle 50%, late 27%.

## Ships lost per wave

Normal: won 67%, mean end wave 12.8 (14 = won), 4.0 lost in waves 1–10, 0.42 in waves 1–5. Tough: 4.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.25 | 0.17 | 0.00 | 0.38 | 0.50 | 0.50 | 1.08 | 1.58 | 0.63 | 0.63 | 1.46 |
| normal, runs that reached it | 0.00 | 0.00 | 0.25 | 0.17 | 0.00 | 0.38 | 0.50 | 0.50 | 1.00 | 1.43 | 0.61 | 0.56 | 1.44 |
| normal, mean over all runs | 0.00 | 0.00 | 0.25 | 0.17 | 0.00 | 0.38 | 0.50 | 0.50 | 0.96 | 1.25 | 0.46 | 0.42 | 1.08 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 21 | 18 | 18 | 18 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.58.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 1.1 | 2.3 | 4.1 | 6.1 | 7.0 | 7.7 | 9.3 | 8.1 | 9.3 | 4.0 | 3.3 | 3.1 |
| runs with ≥ 1 | 0% | 75% | 88% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 88% | 83% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 16.4 | 24.2 | 31.0 | 25.7 | 31.2 | 28.4 | 36.3 | 39.5 | 46.7 |
| launches (encounters off) | 15.0 | 16.4 | 23.3 | 30.4 | 22.9 | 29.9 | 30.2 | 35.3 | 41.0 | 45.7 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.04 | 1.02 | 1.12 | 1.04 | 0.94 | 1.03 | 0.96 | 1.02 |
| table × scale | 15 | 20 | 26 | 30 | 31 | 36 | 41 | 45 | 52 | 62 |
| ratio to table × scale | 1.00 | 0.82 | 0.93 | 1.03 | 0.83 | 0.87 | 0.69 | 0.81 | 0.76 | 0.75 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 23% / 12% | 50% / 61% | 27% / 28% | 45.6 | middle | early |
| all | 1–9 | 23% / 12% | 50% / 61% | 27% / 28% | 45.6 | middle | early |
| 1 | 1–13 | 23% / 10% | 48% / 61% | 29% / 28% | 103.7 | middle | early |
| all | 1–13 | 23% / 10% | 48% / 61% | 29% / 28% | 103.7 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.4 | 8.3 | 6.1 | 5.5 | 4.3 | 4.4 | 2.8 | 3.5 | 3.8 | 3.7 | 6.8 | 6.7 | 6.2 |
| launches read | 360 | 392 | 577 | 734 | 615 | 743 | 679 | 868 | 942 | 1117 | 168 | 288 | 312 |

Slope over waves 1–10: -0.57 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.61 | 0.56 | 1.44 |
| runs that reached it | 18 | 18 | 18 |
| tough, every run | 0.63 | 0.63 | 1.46 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 21 | 18 | 18 | 18 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.3** | **0.2** | **0.3** | **0.3** | **0.1** | **0.2** | **0.9** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 | 0.1 | 0.2 | 0.3 | 0.1 | 0.1 | 0.7 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.04 | 0.21 | 0.13 | 0.26 | 0.14 | 0.06 | 0.00 | 0.56 |
| runs with no save | 100% | 100% | 100% | 100% | 96% | 96% | 83% | 83% | 74% | 76% | 89% | 83% | 39% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.08 | 0.04 | 0.10 | 0.06 | 0.00 | 0.44 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.09 | 0.00 | 0.00 | 0.06 | 0.11 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.08 | 0.04 | 0.09 | 0.10 | 0.00 | 0.00 | 0.17 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.08 | 0.04 | 0.09 | 0.14 | 0.06 | 0.11 | 0.17 |
| tension peak | 0.05 | 0.33 | 0.65 | 0.63 | 0.73 | 0.79 | 1.04 | 0.96 | 1.23 | 1.29 | 1.14 | 1.07 | 1.40 |
| peaks | 0.0 | 0.0 | 0.3 | 0.3 | 0.3 | 0.6 | 0.8 | 1.3 | 1.7 | 2.0 | 1.5 | 1.5 | 1.3 |
| release after a peak (s) | 0.0 | 0.0 | 0.7 | 0.6 | 1.0 | 1.3 | 1.9 | 1.5 | 2.3 | 2.5 | 1.8 | 2.4 | 3.5 |
| hot share | 0% | 0% | 2% | 1% | 1% | 2% | 4% | 4% | 6% | 7% | 16% | 16% | 24% |
| calm share | 100% | 95% | 88% | 84% | 81% | 80% | 71% | 71% | 68% | 68% | 48% | 45% | 40% |
| shape (most runs) | flat 100% | flat 100% | flat 71% | flat 71% | flat 67% | one peak 50% | one peak 54% | one peak 42% | one peak 43% | sawtooth rising 52% | sawtooth 39% | sawtooth 44% | one peak 50% |
| taps follow tension (r) | 0.61 | 0.23 | 0.38 | 0.41 | 0.48 | 0.47 | 0.48 | 0.40 | 0.37 | 0.38 | 0.46 | 0.41 | 0.46 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 164 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, seeker, droneScreen | 67% | 12.9 | 3.6 | 4.0 | 0.85 (20) / 1.05 (20) / 1.58 (19) | 0.0 0.0 0.2 0.2 0.1 0.3 0.7 0.7 0.8 1.1 |
| off-counter | scatter, railgun, overdrive | 58% | 12.5 | 3.4 | 3.9 | 0.78 (18) / 0.94 (18) / 1.47 (17) | 0.0 0.0 0.3 0.1 0.0 0.5 0.5 0.7 0.5 1.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
