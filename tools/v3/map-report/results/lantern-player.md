# Bot report: The Black Strait (`lantern`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.45; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=lantern --seeds=24 --armory=player --kits=plan`. Heat map: `tools/v3/map-report/results/lantern-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.54; doubles on w7 (0.33→0.79) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 1.63 a run (75% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w5 ×0.87 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 41%, cold early 22% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 12.0 s → w10 5.4 s (slope -0.55 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.46 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.50 (18), r2 1.06 (18), r3 1.56 (18); tough (every run): 0.67, 1.38, 2.54 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 3.6 lost 1–10, end 12.8; off-counter 5.4 lost 1–10, end 12.2 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 7 loses 0.79 after 0.33. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.33 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 22%, middle 37%, late 41%.

## Ships lost per wave

Normal: won 58%, mean end wave 12.6 (14 = won), 3.5 lost in waves 1–10, 0.46 in waves 1–5, 0.04 in bonus waves. Tough: 4.8 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.13 | 0.00 | 0.21 | 0.13 | 0.33 | 0.79 | 0.67 | 1.21 | 1.33 | 0.67 | 1.38 | 2.54 |
| normal, runs that reached it | 0.00 | 0.13 | 0.00 | 0.21 | 0.13 | 0.33 | 0.79 | 0.63 | 0.82 | 0.62 | 0.50 | 1.06 | 1.56 |
| normal, mean over all runs | 0.00 | 0.13 | 0.00 | 0.21 | 0.13 | 0.33 | 0.79 | 0.63 | 0.75 | 0.54 | 0.38 | 0.79 | 1.17 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 21 | 18 | 18 | 18 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.54.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.2 | 1.8 | 1.8 | 1.9 | 1.8 | 1.7 | 1.8 | 1.8 | 1.9 | 1.8 | 2.0 | 3.4 | 3.2 |
| kills a minute | 52 | 42 | 51 | 44 | 42 | 43 | 40 | 42 | 46 | 40 | 48 | 64 | 60 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 0.8 | 2.0 | 1.6 | 1.8 | 2.6 | 2.1 | 3.2 | 4.0 | 6.2 | 0.5 | 0.3 | 0.5 |
| runs with ≥ 1 | 4% | 46% | 83% | 75% | 83% | 88% | 79% | 96% | 96% | 96% | 46% | 29% | 29% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.3 | 24.7 | 33.0 | 33.3 | 35.1 | 35.9 | 39.9 | 44.3 | 48.7 | 57.4 |
| launches (encounters off) | 23.0 | 26.5 | 35.0 | 36.9 | 40.5 | 41.1 | 45.6 | 49.0 | 54.1 | 65.0 |
| **ratio to encounters off** | 1.05 | 0.93 | 0.94 | 0.90 | 0.87 | 0.87 | 0.87 | 0.90 | 0.90 | 0.88 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.05 | 0.80 | 0.85 | 0.76 | 0.76 | 0.68 | 0.64 | 0.65 | 0.62 | 0.61 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 22% / 13% | 37% / 40% | 41% / 47% | 64.4 | late | early |
| all | 1–9 | 22% / 13% | 37% / 40% | 41% / 47% | 64.4 | late | early |
| 1 | 1–13 | 23% / 16% | 37% / 41% | 40% / 43% | 134.5 | late | early |
| all | 1–13 | 23% / 16% | 37% / 41% | 40% / 43% | 134.5 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 12.0 | 9.1 | 7.9 | 7.6 | 7.4 | 5.9 | 6.2 | 5.9 | 6.9 | 5.4 | 6.0 | 5.8 | 5.6 |
| launches read | 672 | 681 | 842 | 834 | 871 | 897 | 951 | 1062 | 1169 | 1372 | 470 | 526 | 549 |

Slope over waves 1–10: -0.55 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.50 | 1.06 | 1.56 |
| runs that reached it | 18 | 18 | 18 |
| tough, every run | 0.67 | 1.38 | 2.54 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 21 | 18 | 18 | 18 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.1** | **0.3** | **0.1** | **0.3** | **0.2** | **0.2** | **0.4** | **0.1** | **0.3** | **0.2** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.1 | 0.2 | 0.1 | 0.2 | 0.2 | 0.1 | 0.4 | 0.1 | 0.2 | 0.2 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.08 | 0.08 | 0.08 | 0.08 | 0.13 | 0.05 | 0.29 | 0.06 | 0.11 | 0.22 |
| runs with no save | 100% | 96% | 96% | 92% | 83% | 92% | 75% | 88% | 86% | 57% | 94% | 78% | 78% |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.08 | 0.09 | 0.24 | 0.06 | 0.28 | 0.22 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.04 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.10 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.04 | 0.04 | 0.08 | 0.17 | 0.04 | 0.21 | 0.04 | 0.05 | 0.05 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.19 | 0.35 | 0.79 | 0.50 | 0.71 | 0.68 | 0.68 | 0.88 | 0.78 | 1.07 | 0.41 | 0.57 | 0.71 |
| peaks | 0.0 | 0.0 | 0.6 | 0.1 | 0.5 | 0.3 | 0.4 | 0.8 | 0.5 | 1.1 | 0.1 | 0.1 | 0.3 |
| release after a peak (s) | 0.0 | 0.0 | 1.4 | 0.1 | 1.0 | 0.4 | 1.0 | 1.4 | 0.7 | 1.7 | 0.1 | 0.2 | 0.3 |
| hot share | 0% | 0% | 3% | 0% | 2% | 1% | 1% | 3% | 1% | 5% | 0% | 1% | 2% |
| calm share | 98% | 93% | 87% | 86% | 85% | 80% | 83% | 79% | 79% | 76% | 92% | 77% | 84% |
| shape (most runs) | flat 100% | flat 100% | one peak 62% | flat 92% | flat 50% | flat 75% | flat 67% | one peak 50% | flat 55% | one peak 43% | flat 94% | flat 89% | flat 72% |
| taps follow tension (r) | 0.39 | 0.37 | 0.36 | 0.45 | 0.44 | 0.40 | 0.46 | 0.40 | 0.38 | 0.43 | 0.49 | 0.39 | 0.35 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 220 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | scatter, gunships, shield | 58% | 12.8 | 3.5 | 3.6 | 0.47 (19) / 0.95 (19) / 1.44 (18) | 0.0 0.1 0.0 0.2 0.1 0.3 0.8 0.7 0.8 0.8 |
| off-counter | seeker, tesla, fullSteam | 50% | 12.2 | 4.3 | 5.4 | 0.75 (16) / 0.88 (16) / 1.94 (16) | 0.0 0.1 0.0 0.2 0.3 0.5 0.6 1.0 1.4 1.5 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
