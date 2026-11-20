# Bot report: The Island (`island`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1; built 2026-11-20.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=island --seeds=24 --kits=plan --armory=player`. Heat map: `tools/v3/map-report/results/island-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +0.67; doubles on w7 (0.38→0.83) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 0.92 a run (54% of runs have one); under 1 on w4 | ≥ 1 a run on every wave 3–10 | tough | **FLAG** |
| `w-budget` | Wave budgets ±15% | furthest w6 ×0.87 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 46%, cold early 25%; lane 2: hot middle 50%, cold late 25% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 7.3 s → w10 3.1 s (slope -0.45 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.63 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.08 (13), r2 1.58 (12), r3 1.80 (10); tough (every run): 1.08, 1.42, 1.71 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.5; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 4.9 lost 1–10, end 11.4; off-counter 6.2 lost 1–10, end 11.0 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 7 loses 0.83 after 0.38. Move budget from it to the wave before, or soften its biggest raid.
- Too few close calls on wave 4 (0.92): give those waves a launch from a near site, or one aimed at the danger stretch.
- No safe stretch on lane 1 (coldest early takes 25%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.83 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 25%, middle 47%, late 28%.

## Ships lost per wave

Normal: won 33%, mean end wave 11.4 (14 = won), 4.8 lost in waves 1–10, 0.63 in waves 1–5. Tough: 5.8 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.13 | 0.08 | 0.08 | 0.33 | 0.38 | 0.83 | 1.00 | 1.17 | 1.83 | 1.08 | 1.42 | 1.71 |
| normal, runs that reached it | 0.00 | 0.13 | 0.08 | 0.08 | 0.33 | 0.33 | 0.78 | 1.04 | 1.00 | 1.56 | 1.08 | 1.58 | 1.80 |
| normal, mean over all runs | 0.00 | 0.13 | 0.08 | 0.08 | 0.33 | 0.33 | 0.75 | 1.00 | 0.92 | 1.17 | 0.58 | 0.79 | 0.75 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 22 | 18 | 13 | 12 | 10 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +0.67.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.4 | 0.8 | 1.8 | 0.9 | 1.8 | 5.0 | 6.1 | 5.6 | 6.4 | 9.3 | 3.1 | 3.8 | 2.6 |
| runs with ≥ 1 | 38% | 46% | 71% | 54% | 63% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 16.0 | 14.8 | 24.5 | 22.0 | 21.9 | 26.7 | 29.1 | 31.9 | 37.8 | 43.1 |
| launches (encounters off) | 16.0 | 16.9 | 24.9 | 24.0 | 25.1 | 30.7 | 31.7 | 36.3 | 41.1 | 48.2 |
| **ratio to encounters off** | 1.00 | 0.87 | 0.98 | 0.92 | 0.87 | 0.87 | 0.92 | 0.88 | 0.92 | 0.89 |
| table × scale | 16 | 21 | 27 | 31 | 32 | 37 | 43 | 47 | 54 | 65 |
| ratio to table × scale | 1.00 | 0.70 | 0.91 | 0.71 | 0.68 | 0.72 | 0.68 | 0.68 | 0.70 | 0.66 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 25% / 15% | 46% / 45% | 29% / 40% | 30.2 | middle | early |
| 2 | 1–9 | 26% / 14% | 50% / 50% | 25% / 36% | 16.7 | middle | late |
| all | 1–9 | 25% / 15% | 47% / 47% | 28% / 39% | 46.8 | middle | early |
| 1 | 1–13 | 24% / 13% | 45% / 48% | 31% / 39% | 66.1 | middle | early |
| 2 | 1–13 | 24% / 14% | 50% / 60% | 26% / 26% | 33.8 | middle | early |
| all | 1–13 | 24% / 13% | 47% / 52% | 29% / 34% | 99.9 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.3 | 5.6 | 5.7 | 5.7 | 5.5 | 3.8 | 3.4 | 3.4 | 3.2 | 3.1 | 3.7 | 3.4 | 3.0 |
| launches read | 384 | 355 | 586 | 525 | 522 | 633 | 698 | 764 | 904 | 1030 | 618 | 711 | 620 |

Slope over waves 1–10: -0.45 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.08 | 1.58 | 1.80 |
| runs that reached it | 13 | 12 | 10 |
| tough, every run | 1.08 | 1.42 | 1.71 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 22 | 18 | 13 | 12 | 10 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.1** | **0.0** | **0.0** | **0.1** | **0.1** | **0.3** | **0.3** | **0.4** | **1.2** | **0.7** |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.1 | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 | 0.4 | 0.3 | 1.0 | 0.8 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.08 | 0.30 |
| clutch | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.04 | 0.09 | 0.18 | 0.22 | 0.08 | 1.00 | 0.30 |
| runs with no save | 100% | 100% | 92% | 96% | 100% | 96% | 91% | 91% | 77% | 72% | 69% | 33% | 70% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.05 | 0.11 | 0.08 | 0.67 | 0.10 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.14 | 0.11 | 0.15 | 0.33 | 0.30 |
|   last-second kill | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.17 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.08 | 0.08 | 0.00 | 0.04 | 0.09 | 0.04 | 0.05 | 0.11 | 0.15 | 0.00 | 0.30 |
| tension peak | 0.24 | 0.34 | 0.54 | 0.43 | 0.55 | 0.88 | 1.06 | 1.09 | 1.17 | 1.23 | 1.39 | 1.58 | 1.51 |
| peaks | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 | 0.8 | 1.3 | 1.7 | 1.3 | 1.8 | 1.1 | 1.1 | 1.0 |
| release after a peak (s) | 0.0 | 0.3 | 0.2 | 0.3 | 0.3 | 1.1 | 1.9 | 2.2 | 2.7 | 2.1 | 2.2 | 4.0 | 3.9 |
| hot share | 0% | 1% | 1% | 0% | 1% | 3% | 5% | 5% | 6% | 6% | 14% | 27% | 27% |
| calm share | 95% | 92% | 91% | 93% | 89% | 80% | 73% | 72% | 70% | 74% | 61% | 43% | 45% |
| shape (most runs) | flat 100% | flat 96% | flat 87% | flat 87% | flat 83% | flat 42% | one peak 48% | sawtooth 43% | one peak 64% | one peak 39% | one peak 69% | one peak 75% | one peak 50% |
| taps follow tension (r) | 0.46 | 0.48 | 0.44 | 0.45 | 0.56 | 0.43 | 0.43 | 0.36 | 0.41 | 0.39 | 0.56 | 0.41 | 0.37 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.5; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 290 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, droneScreen, gunships | 38% | 11.4 | 4.2 | 4.9 | 0.62 (13) / 1.92 (13) / 1.90 (10) | 0.0 0.0 0.0 0.2 0.3 0.6 1.0 0.7 1.1 1.0 |
| off-counter | railgun, seeker, lance | 29% | 11.0 | 5.0 | 6.2 | 0.73 (11) / 2.36 (11) / 2.29 (7) | 0.0 0.1 0.1 0.1 0.3 0.7 0.9 1.1 1.2 1.8 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
