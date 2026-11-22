# Bot report: Tidewater Flats (`tide`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.4; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=tide --seeds=24 --armory=latest --kits=plan`. Heat map: `tools/v3/map-report/results/tide-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +1.04; doubles on w5 (0.21→0.58), w8 (0.13→0.83) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 2.13 a run (83% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.88 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 37%, cold early 27%; lane 2: hot late 43%, cold early 26% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 10.0 s → w10 5.4 s (slope -0.41 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.00 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.71 (14), r2 2.21 (14), r3 2.58 (12); tough (every run): 0.58, 3.17, 2.29 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 5.3 lost 1–10, end 11.8; off-counter 6.6 lost 1–10, end 10.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 5 loses 0.58 after 0.21; wave 8 loses 0.83 after 0.13. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest early takes 27%), lane 2 (coldest early takes 26%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (2.29 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 27%, middle 35%, late 38%.

## Ships lost per wave

Normal: won 25%, mean end wave 11.4 (14 = won), 3.8 lost in waves 1–10, 1.00 in waves 1–5. Tough: 5.9 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.04 | 0.25 | 0.21 | 0.58 | 0.29 | 0.13 | 0.83 | 1.25 | 2.29 | 0.58 | 3.17 | 2.29 |
| normal, runs that reached it | 0.00 | 0.04 | 0.25 | 0.21 | 0.50 | 0.30 | 0.13 | 0.70 | 0.85 | 1.39 | 0.71 | 2.21 | 2.58 |
| normal, mean over all runs | 0.00 | 0.04 | 0.25 | 0.21 | 0.50 | 0.29 | 0.13 | 0.67 | 0.71 | 1.04 | 0.42 | 1.29 | 1.29 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 20 | 18 | 14 | 14 | 12 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +1.04.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.8 | 1.5 | 2.0 | 1.5 | 1.6 | 1.5 | 1.8 | 2.0 | 2.0 | 2.2 | 0.5 | 1.8 | 1.4 |
| kills a minute | 51 | 43 | 50 | 48 | 44 | 44 | 52 | 50 | 55 | 54 | 13 | 30 | 31 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.1 | 3.1 | 2.5 | 2.1 | 3.1 | 3.1 | 3.2 | 5.4 | 5.0 | 5.2 | 3.6 | 4.8 | 4.8 |
| runs with ≥ 1 | 75% | 100% | 88% | 83% | 96% | 100% | 88% | 100% | 100% | 100% | 100% | 96% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 23.3 | 24.7 | 33.7 | 34.8 | 35.0 | 38.6 | 45.4 | 48.7 | 53.5 | 59.4 |
| launches (encounters off) | 22.0 | 26.4 | 36.5 | 39.4 | 39.2 | 43.7 | 47.2 | 49.8 | 59.1 | 67.4 |
| **ratio to encounters off** | 1.06 | 0.94 | 0.92 | 0.88 | 0.89 | 0.88 | 0.96 | 0.98 | 0.90 | 0.88 |
| table × scale | 22 | 30 | 38 | 43 | 45 | 52 | 60 | 66 | 76 | 91 |
| ratio to table × scale | 1.06 | 0.82 | 0.89 | 0.81 | 0.78 | 0.74 | 0.76 | 0.74 | 0.70 | 0.65 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 27% / 5% | 36% / 28% | 37% / 67% | 37.8 | late | early |
| 2 | 1–9 | 26% / 4% | 31% / 32% | 43% / 64% | 14.6 | late | early |
| all | 1–9 | 27% / 5% | 35% / 29% | 38% / 66% | 52.4 | late | early |
| 1 | 1–13 | 18% / 3% | 38% / 26% | 44% / 70% | 73.6 | late | early |
| 2 | 1–13 | 16% / 3% | 29% / 20% | 55% / 78% | 28.1 | late | early |
| all | 1–13 | 18% / 3% | 35% / 24% | 47% / 72% | 101.7 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.0 | 7.9 | 8.0 | 7.8 | 6.5 | 6.8 | 6.6 | 5.7 | 6.4 | 5.4 | 2.0 | 4.1 | 4.4 |
| launches read | 648 | 681 | 857 | 863 | 873 | 958 | 1087 | 1167 | 1276 | 1419 | 168 | 456 | 503 |

Slope over waves 1–10: -0.41 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.71 | 2.21 | 2.58 |
| runs that reached it | 14 | 14 | 12 |
| tough, every run | 0.58 | 3.17 | 2.29 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 23 | 20 | 18 | 14 | 14 | 12 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.0** | **0.1** | **0.3** | **0.3** | **0.0** | **0.4** | **0.6** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.1 | 0.4 | 0.3 | 0.0 | 0.5 | 0.5 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.07 | 0.17 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.20 | 0.22 | 0.00 | 0.36 | 0.42 |
| runs with no save | 100% | 100% | 100% | 100% | 96% | 91% | 96% | 91% | 80% | 72% | 100% | 64% | 50% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.15 | 0.06 | 0.00 | 0.00 | 0.08 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.11 | 0.00 | 0.29 | 0.08 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.09 | 0.04 | 0.04 | 0.10 | 0.17 | 0.00 | 0.14 | 0.33 |
| tension peak | 0.40 | 0.44 | 0.80 | 0.67 | 0.85 | 0.87 | 0.69 | 1.25 | 1.05 | 1.59 | 1.35 | 1.70 | 1.85 |
| peaks | 0.0 | 0.0 | 0.6 | 0.3 | 0.4 | 0.7 | 0.5 | 0.8 | 0.9 | 1.5 | 1.2 | 2.3 | 1.7 |
| release after a peak (s) | 0.0 | 0.1 | 1.1 | 0.6 | 0.5 | 1.1 | 0.6 | 1.5 | 1.5 | 2.2 | 1.8 | 2.2 | 1.9 |
| hot share | 0% | 0% | 3% | 1% | 2% | 3% | 1% | 5% | 4% | 6% | 8% | 24% | 20% |
| calm share | 93% | 86% | 80% | 85% | 81% | 78% | 80% | 74% | 78% | 73% | 76% | 57% | 66% |
| shape (most runs) | flat 96% | flat 96% | flat 50% | flat 75% | flat 67% | one peak 48% | flat 65% | one peak 57% | one peak 65% | one peak 50% | one peak 64% | sawtooth 43% | sawtooth 42% |
| taps follow tension (r) | 0.39 | 0.32 | 0.33 | 0.32 | 0.35 | 0.34 | 0.34 | 0.36 | 0.30 | 0.30 | 0.69 | 0.58 | 0.61 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 278 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, aegis, bomberWing | 33% | 11.8 | 3.8 | 5.3 | 0.53 (15) / 2.13 (15) / 2.00 (13) | 0.0 0.0 0.3 0.2 0.6 0.5 0.2 0.3 0.9 2.4 |
| off-counter | tesla, grapnel, fullSteam | 8% | 10.5 | 4.5 | 6.6 | 0.90 (10) / 2.30 (10) / 3.00 (8) | 0.0 0.0 0.3 0.5 0.8 0.6 0.2 0.8 1.4 2.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
