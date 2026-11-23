# Bot report: The Black Strait (`lantern`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.45; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=lantern --seeds=24 --armory=latest --kits=plan`. Heat map: `tools/v3/map-report/results/lantern-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w6 +0.79; doubles on w5 (0.25→0.71), w6 (0.71→1.50) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 1.33 a run (71% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.87 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 37%, cold early 27% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 12.0 s → w10 5.3 s (slope -0.56 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.08 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (6), r2 0.67 (6), r3 1.33 (6); tough (every run): 0.25, 0.88, 1.63 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 6.2 lost 1–10, end 11.1; off-counter 9.5 lost 1–10, end 9.6 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 5 loses 0.71 after 0.25; wave 6 loses 1.50 after 0.71. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest early takes 27%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (2.13 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 27%, middle 36%, late 37%.

## Ships lost per wave

Normal: won 25%, mean end wave 9.6 (14 = won), 5.4 lost in waves 1–10, 1.08 in waves 1–5. Tough: 9.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.13 | 0.00 | 0.25 | 0.71 | 1.50 | 1.04 | 1.63 | 2.13 | 1.92 | 0.25 | 0.88 | 1.63 |
| normal, runs that reached it | 0.00 | 0.13 | 0.00 | 0.25 | 0.71 | 1.38 | 1.10 | 0.95 | 1.08 | 1.50 | 0.00 | 0.67 | 1.33 |
| normal, mean over all runs | 0.00 | 0.13 | 0.00 | 0.25 | 0.71 | 1.38 | 0.96 | 0.75 | 0.58 | 0.63 | 0.00 | 0.17 | 0.33 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 21 | 19 | 13 | 10 | 6 | 6 | 6 |

Biggest one-wave step up (tough, waves 2–10): wave 6, +0.79.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.8 | 1.6 | 1.7 | 1.6 | 1.7 | 1.6 | 1.6 | 1.7 | 1.6 | 1.4 | 2.0 | 2.9 | 2.7 |
| kills a minute | 54 | 43 | 50 | 44 | 45 | 43 | 43 | 44 | 50 | 42 | 51 | 73 | 62 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.2 | 0.6 | 2.0 | 1.3 | 2.8 | 3.2 | 2.5 | 3.8 | 3.9 | 4.9 | 0.2 | 0.5 | 0.6 |
| runs with ≥ 1 | 17% | 42% | 96% | 71% | 83% | 88% | 92% | 96% | 96% | 96% | 17% | 54% | 17% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.3 | 24.7 | 33.2 | 33.1 | 35.5 | 36.2 | 40.6 | 44.0 | 49.3 | 56.6 |
| launches (encounters off) | 23.0 | 26.5 | 35.3 | 37.5 | 40.2 | 40.8 | 45.3 | 48.4 | 54.5 | 65.1 |
| **ratio to encounters off** | 1.05 | 0.93 | 0.94 | 0.88 | 0.88 | 0.89 | 0.90 | 0.91 | 0.90 | 0.87 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.05 | 0.80 | 0.85 | 0.75 | 0.77 | 0.68 | 0.65 | 0.65 | 0.63 | 0.60 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 27% / 11% | 36% / 36% | 37% / 54% | 62.2 | late | early |
| all | 1–9 | 27% / 11% | 36% / 36% | 37% / 54% | 62.2 | late | early |
| 1 | 1–13 | 26% / 13% | 35% / 35% | 39% / 53% | 119.1 | late | early |
| all | 1–13 | 26% / 13% | 35% / 35% | 39% / 53% | 119.1 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 12.0 | 9.1 | 7.8 | 7.5 | 7.3 | 6.0 | 6.2 | 5.8 | 6.8 | 5.3 | 6.1 | 5.6 | 5.5 |
| launches read | 672 | 680 | 845 | 826 | 873 | 905 | 973 | 1053 | 1179 | 1355 | 474 | 528 | 550 |

Slope over waves 1–10: -0.56 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 0.67 | 1.33 |
| runs that reached it | 6 | 6 | 6 |
| tough, every run | 0.25 | 0.88 | 1.63 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 21 | 19 | 13 | 10 | 6 | 6 | 6 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.2** | **0.2** | **0.0** | **0.0** | **0.0** | **0.3** | **0.2** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 | 0.0 | 0.0 | 0.0 | 0.2 | 0.1 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.10 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.08 | 0.05 | 0.16 | 0.00 | 0.00 | 0.00 | 0.33 | 0.17 |
| runs with no save | 100% | 100% | 100% | 96% | 100% | 88% | 81% | 79% | 100% | 100% | 100% | 67% | 83% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.10 | 0.00 | 0.00 | 0.00 | 0.00 | 0.33 | 0.17 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.21 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.18 | 0.30 | 0.80 | 0.49 | 0.85 | 0.85 | 0.82 | 0.88 | 0.83 | 1.16 | 0.25 | 0.47 | 0.63 |
| peaks | 0.0 | 0.0 | 0.5 | 0.3 | 0.7 | 0.6 | 0.7 | 0.8 | 0.5 | 1.1 | 0.0 | 0.0 | 0.2 |
| release after a peak (s) | 0.0 | 0.0 | 1.1 | 0.3 | 1.0 | 0.8 | 1.1 | 0.8 | 0.7 | 2.0 | 0.0 | 0.0 | 0.2 |
| hot share | 0% | 0% | 2% | 1% | 2% | 2% | 2% | 3% | 3% | 4% | 0% | 0% | 1% |
| calm share | 98% | 94% | 85% | 89% | 84% | 80% | 82% | 74% | 79% | 79% | 97% | 81% | 86% |
| shape (most runs) | flat 100% | flat 96% | one peak 54% | flat 79% | one peak 50% | flat 54% | one peak 48% | one peak 47% | flat 54% | one peak 40% | flat 100% | flat 100% | flat 83% |
| taps follow tension (r) | 0.44 | 0.30 | 0.35 | 0.45 | 0.36 | 0.33 | 0.40 | 0.34 | 0.36 | 0.45 | 0.49 | 0.41 | 0.24 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 77 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | scatter, gunships, shield | 50% | 11.1 | 4.8 | 6.2 | 0.08 (12) / 0.58 (12) / 0.75 (12) | 0.0 0.1 0.0 0.1 0.5 1.3 0.8 1.0 1.2 1.3 |
| off-counter | seeker, tesla, fullSteam | 25% | 9.6 | 5.5 | 9.5 | 0.00 (6) / 0.33 (6) / 1.50 (6) | 0.0 0.2 0.0 0.1 0.5 1.5 1.4 2.0 1.9 1.9 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
