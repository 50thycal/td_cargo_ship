# Bot report: The Island (`island`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=island --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/island-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +1.08; doubles on w7 (0.33→0.96), w10 (0.88→1.96) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 0.92 a run (54% of runs have one); under 1 on w4 | ≥ 1 a run on every wave 3–10 | tough | **FLAG** |
| `w-budget` | Wave budgets ±15% | furthest w5 ×0.87 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 48%, cold early 23%; lane 2: hot middle 49%, cold late 18% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 7.3 s → w10 2.8 s (slope -0.49 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.63 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.63 (16), r2 1.88 (16), r3 1.20 (15); tough (every run): 0.83, 1.92, 1.54 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.5; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 5.0 lost 1–10, end 11.8; off-counter 6.4 lost 1–10, end 11.0 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 7 loses 0.96 after 0.33; wave 10 loses 1.96 after 0.88. Move budget from it to the wave before, or soften its biggest raid.
- Too few close calls on wave 4 (0.92): give those waves a launch from a near site, or one aimed at the danger stretch.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.96 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 27%, middle 48%, late 25%.

## Ships lost per wave

Normal: won 58%, mean end wave 12.3 (14 = won), 4.7 lost in waves 1–10, 0.63 in waves 1–5. Tough: 5.8 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.13 | 0.08 | 0.08 | 0.33 | 0.33 | 0.96 | 1.08 | 0.88 | 1.96 | 0.83 | 1.92 | 1.54 |
| normal, runs that reached it | 0.00 | 0.13 | 0.08 | 0.08 | 0.33 | 0.33 | 0.83 | 1.04 | 0.61 | 1.63 | 0.63 | 1.88 | 1.20 |
| normal, mean over all runs | 0.00 | 0.13 | 0.08 | 0.08 | 0.33 | 0.33 | 0.83 | 1.00 | 0.58 | 1.29 | 0.42 | 1.25 | 0.75 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 19 | 16 | 16 | 15 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +1.08.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.4 | 0.8 | 1.8 | 0.9 | 1.8 | 5.2 | 6.1 | 6.2 | 6.9 | 8.4 | 2.7 | 2.8 | 3.1 |
| runs with ≥ 1 | 38% | 46% | 71% | 54% | 63% | 100% | 100% | 100% | 100% | 100% | 100% | 92% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 16.0 | 14.8 | 24.5 | 22.0 | 21.9 | 27.0 | 31.7 | 32.8 | 37.2 | 45.0 |
| launches (encounters off) | 16.0 | 16.9 | 24.9 | 24.0 | 25.1 | 30.7 | 31.7 | 36.3 | 41.1 | 48.2 |
| **ratio to encounters off** | 1.00 | 0.87 | 0.98 | 0.92 | 0.87 | 0.88 | 1.00 | 0.90 | 0.90 | 0.94 |
| table × scale | 16 | 21 | 27 | 31 | 32 | 37 | 43 | 47 | 54 | 65 |
| ratio to table × scale | 1.00 | 0.70 | 0.91 | 0.71 | 0.68 | 0.73 | 0.74 | 0.70 | 0.69 | 0.69 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 23% / 13% | 48% / 66% | 29% / 21% | 28.5 | middle | early |
| 2 | 1–9 | 34% / 32% | 49% / 54% | 18% / 14% | 15.6 | middle | late |
| all | 1–9 | 27% / 20% | 48% / 61% | 25% / 18% | 44.1 | middle | late |
| 1 | 1–13 | 25% / 15% | 45% / 55% | 30% / 30% | 68.8 | middle | early |
| 2 | 1–13 | 28% / 17% | 49% / 60% | 24% / 24% | 33.3 | middle | late |
| all | 1–13 | 26% / 16% | 46% / 56% | 28% / 28% | 102.1 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.3 | 5.6 | 5.7 | 5.7 | 5.5 | 3.5 | 2.9 | 3.0 | 3.1 | 2.8 | 3.9 | 3.5 | 3.1 |
| launches read | 384 | 355 | 586 | 525 | 522 | 646 | 760 | 784 | 890 | 1078 | 596 | 727 | 620 |

Slope over waves 1–10: -0.49 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.63 | 1.88 | 1.20 |
| runs that reached it | 16 | 16 | 15 |
| tough, every run | 0.83 | 1.92 | 1.54 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 19 | 16 | 16 | 15 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.1** | **0.0** | **0.1** | **0.2** | **0.2** | **0.2** | **0.3** | **0.3** | **0.9** | **0.9** |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.1 | 0.0 | 0.1 | 0.1 | 0.1 | 0.2 | 0.2 | 0.3 | 0.8 | 0.8 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.07 |
| clutch | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.13 | 0.09 | 0.17 | 0.21 | 0.25 | 0.63 | 0.47 |
| runs with no save | 100% | 100% | 92% | 96% | 100% | 96% | 88% | 87% | 83% | 68% | 75% | 31% | 47% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.11 | 0.31 | 0.38 | 0.40 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.09 | 0.11 | 0.00 | 0.13 | 0.07 |
|   last-second kill | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.09 | 0.00 | 0.00 | 0.06 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.08 | 0.08 | 0.00 | 0.04 | 0.08 | 0.09 | 0.04 | 0.11 | 0.00 | 0.31 | 0.40 |
| tension peak | 0.24 | 0.34 | 0.54 | 0.43 | 0.55 | 0.95 | 1.06 | 1.15 | 1.05 | 1.32 | 1.18 | 1.77 | 1.54 |
| peaks | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 | 0.5 | 1.4 | 1.6 | 1.1 | 2.2 | 1.1 | 1.3 | 1.2 |
| release after a peak (s) | 0.0 | 0.3 | 0.2 | 0.3 | 0.3 | 1.2 | 2.0 | 1.8 | 1.7 | 2.3 | 2.6 | 4.3 | 4.0 |
| hot share | 0% | 1% | 1% | 0% | 1% | 2% | 5% | 6% | 5% | 6% | 9% | 32% | 25% |
| calm share | 95% | 92% | 91% | 93% | 89% | 82% | 70% | 72% | 72% | 74% | 61% | 41% | 40% |
| shape (most runs) | flat 100% | flat 96% | flat 87% | flat 87% | flat 83% | flat 54% | one peak 46% | one peak 39% | one peak 43% | sawtooth 63% | one peak 63% | pinned 63% | one peak 47% |
| taps follow tension (r) | 0.46 | 0.48 | 0.44 | 0.45 | 0.56 | 0.43 | 0.39 | 0.38 | 0.39 | 0.33 | 0.47 | 0.39 | 0.37 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.5; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 205 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, droneScreen, gunships | 38% | 11.8 | 4.4 | 5.0 | 0.50 (14) / 2.79 (14) / 1.36 (11) | 0.0 0.0 0.0 0.2 0.3 0.3 0.8 1.2 0.8 1.4 |
| off-counter | railgun, seeker, lance | 33% | 11.0 | 5.0 | 6.4 | 0.70 (10) / 2.00 (10) / 0.75 (8) | 0.0 0.1 0.1 0.1 0.3 0.3 1.2 1.1 1.0 2.1 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
