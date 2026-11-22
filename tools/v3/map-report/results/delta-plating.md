# Bot report: The Sharra Delta (`delta`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.5; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=delta --seeds=24 --armory=plating --kits=plan`. Heat map: `tools/v3/map-report/results/delta-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.63; doubles on w6 (0.33→0.71), w9 (0.50→1.13) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.58 a run (63% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w6 ×0.75 of the no-encounter wave; outside on w6 ×0.75 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 44%, cold early 28%; lane 2: hot middle 42%, cold late 26%; lane 3: hot early 45%, cold late 22% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 8.9 s → w10 4.7 s (slope -0.45 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.04 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.58 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.20 (15), r2 1.00 (15), r3 2.07 (15); tough (every run): 0.21, 0.96, 2.08 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 4.0 lost 1–10, end 13.1; off-counter 5.0 lost 1–10, end 12.3 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 6 loses 0.71 after 0.33; wave 9 loses 1.13 after 0.50. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 6 sends ×0.75 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest early takes 28%), lane 2 (coldest late takes 26%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.21 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 35%, middle 39%, late 26%.

## Ships lost per wave

Normal: won 63%, mean end wave 12.3 (14 = won), 3.6 lost in waves 1–10, 0.58 in waves 1–5. Tough: 4.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.04 | 0.13 | 0.04 | 0.04 | 0.33 | 0.71 | 0.38 | 0.50 | 1.13 | 1.21 | 0.21 | 0.96 | 2.08 |
| normal, runs that reached it | 0.04 | 0.13 | 0.04 | 0.04 | 0.33 | 0.71 | 0.38 | 0.50 | 0.92 | 0.63 | 0.20 | 1.00 | 2.07 |
| normal, mean over all runs | 0.04 | 0.13 | 0.04 | 0.04 | 0.33 | 0.71 | 0.38 | 0.50 | 0.92 | 0.50 | 0.13 | 0.63 | 1.29 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 19 | 15 | 15 | 15 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.63.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.5 | 1.3 | 1.2 | 1.2 | 1.5 | 1.5 | 1.5 | 1.7 | 1.9 | 1.6 | 0.8 | 1.0 | 1.0 |
| kills a minute | 48 | 48 | 39 | 44 | 44 | 36 | 41 | 43 | 45 | 42 | 15 | 21 | 19 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.2 | 1.5 | 1.6 | 2.7 | 3.9 | 5.8 | 6.3 | 7.2 | 6.4 | 8.5 | 1.8 | 1.7 | 1.9 |
| runs with ≥ 1 | 58% | 88% | 63% | 92% | 96% | 100% | 100% | 100% | 100% | 100% | 83% | 71% | 71% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.5 | 28.7 | 29.9 | 34.4 | 36.3 | 34.7 | 44.5 | 47.6 | 51.9 | 60.9 |
| launches (encounters off) | 24.0 | 30.5 | 35.0 | 39.5 | 41.3 | 46.1 | 44.1 | 51.3 | 57.0 | 68.0 |
| **ratio to encounters off** | 1.02 | 0.94 | 0.85 | 0.87 | 0.88 | **0.75** | 1.01 | 0.93 | 0.91 | 0.90 |
| table × scale | 24 | 32 | 41 | 48 | 49 | 57 | 66 | 71 | 82 | 99 |
| ratio to table × scale | 1.02 | 0.90 | 0.73 | 0.72 | 0.74 | 0.61 | 0.67 | 0.67 | 0.63 | 0.62 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 28% / 20% | 44% / 28% | 29% / 52% | 18.7 | middle | early |
| 2 | 1–9 | 32% / 32% | 42% / 30% | 26% / 38% | 22.8 | middle | late |
| 3 | 1–9 | 45% / 35% | 32% / 35% | 22% / 29% | 17.4 | early | late |
| all | 1–9 | 35% / 29% | 39% / 30% | 26% / 41% | 58.8 | middle | late |
| 1 | 1–13 | 34% / 35% | 47% / 38% | 20% / 27% | 32.2 | middle | late |
| 2 | 1–13 | 34% / 37% | 47% / 37% | 19% / 26% | 40.1 | middle | late |
| 3 | 1–13 | 43% / 38% | 41% / 42% | 16% / 20% | 34.0 | early | late |
| all | 1–13 | 37% / 37% | 45% / 39% | 18% / 25% | 106.3 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.9 | 8.0 | 6.9 | 6.2 | 5.7 | 5.1 | 5.2 | 4.9 | 4.9 | 4.7 | 5.1 | 4.8 | 4.3 |
| launches read | 624 | 704 | 762 | 858 | 896 | 859 | 1054 | 1136 | 1231 | 1440 | 288 | 336 | 407 |

Slope over waves 1–10: -0.45 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.20 | 1.00 | 2.07 |
| runs that reached it | 15 | 15 | 15 |
| tough, every run | 0.21 | 0.96 | 2.08 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 19 | 15 | 15 | 15 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.2** | **0.1** | **0.2** | **0.1** | **0.1** | **0.1** | **0.1** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.1 | 0.2 | 0.1 | 0.0 | 0.1 | 0.1 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.17 | 0.00 | 0.17 | 0.05 | 0.00 | 0.07 | 0.07 |
| runs with no save | 100% | 100% | 100% | 100% | 100% | 96% | 88% | 92% | 88% | 95% | 93% | 93% | 87% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.08 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.05 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.08 | 0.04 | 0.00 | 0.07 | 0.07 | 0.13 |
| tension peak | 0.25 | 0.37 | 0.48 | 0.43 | 0.60 | 0.90 | 0.76 | 0.86 | 1.19 | 1.14 | 0.61 | 0.67 | 1.03 |
| peaks | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 | 0.8 | 0.6 | 0.9 | 1.2 | 0.9 | 0.0 | 0.2 | 0.9 |
| release after a peak (s) | 0.0 | 0.0 | 0.1 | 0.1 | 0.3 | 1.7 | 0.8 | 1.5 | 1.6 | 1.6 | 0.0 | 0.6 | 1.6 |
| hot share | 0% | 0% | 0% | 0% | 0% | 3% | 2% | 3% | 5% | 5% | 0% | 1% | 5% |
| calm share | 94% | 90% | 91% | 86% | 79% | 77% | 77% | 70% | 72% | 72% | 80% | 70% | 71% |
| shape (most runs) | flat 100% | flat 100% | flat 92% | flat 92% | flat 87% | one peak 46% | flat 58% | one peak 46% | one peak 50% | one peak 58% | flat 100% | flat 80% | one peak 67% |
| taps follow tension (r) | 0.38 | 0.25 | 0.30 | 0.40 | 0.40 | 0.46 | 0.45 | 0.34 | 0.35 | 0.44 | 0.38 | 0.42 | 0.44 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 433 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | seeker, thermo, cadence | 79% | 13.1 | 3.7 | 4.0 | 0.16 (19) / 1.11 (19) / 1.84 (19) | 0.0 0.2 0.0 0.1 0.4 0.6 0.4 0.5 0.5 1.1 |
| off-counter | well, tesla, aegis | 63% | 12.3 | 4.2 | 5.0 | 0.13 (15) / 0.87 (15) / 2.00 (15) | 0.0 0.1 0.0 0.0 0.3 0.6 0.4 0.7 1.5 1.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
