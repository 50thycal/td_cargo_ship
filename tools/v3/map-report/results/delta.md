# Bot report: The Sharra Delta (`delta`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.5; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=delta --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/delta-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +2.37; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 2.42 a run (83% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w6 ×0.75 of the no-encounter wave; outside on w6 ×0.75 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 44%, cold late 27%; lane 2: hot middle 45%, cold late 24%; lane 3: hot early 43%, cold late 22% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 8.9 s → w10 4.7 s (slope -0.45 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.04 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.96 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 – (0), r2 – (0), r3 – (0); tough (every run): 0.88, 2.42, 4.79 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.5; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 13.9 lost 1–10, end 7.7; off-counter 18.2 lost 1–10, end 7.4 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Budget: wave 6 sends ×0.75 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest late takes 27%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (5.71 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 34%, middle 42%, late 24%.

## Ships lost per wave

Normal: won 0%, mean end wave 7.5 (14 = won), 5.9 lost in waves 1–10, 1.96 in waves 1–5, 0.04 in bonus waves. Tough: 17.5 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.04 | 0.29 | 0.29 | 0.46 | 0.88 | 1.54 | 1.71 | 3.33 | 5.71 | 3.29 | 0.88 | 2.42 | 4.79 |
| normal, runs that reached it | 0.04 | 0.29 | 0.29 | 0.46 | 0.88 | 1.17 | 1.55 | 2.50 | 1.50 | 2.00 | – | – | – |
| normal, mean over all runs | 0.04 | 0.29 | 0.29 | 0.46 | 0.88 | 1.17 | 1.29 | 1.04 | 0.38 | 0.08 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 20 | 10 | 6 | 1 | 0 | 0 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +2.37.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.7 | 1.8 | 1.4 | 1.4 | 1.7 | 1.6 | 1.6 | 2.0 | 2.0 | 1.5 | – | – | – |
| kills a minute | 44 | 44 | 38 | 42 | 42 | 35 | 37 | 42 | 35 | 39 | – | – | – |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.2 | 2.1 | 2.4 | 3.4 | 3.5 | 6.0 | 5.9 | 6.7 | 7.5 | 9.6 | 1.8 | 1.5 | 2.5 |
| runs with ≥ 1 | 63% | 83% | 83% | 100% | 96% | 100% | 100% | 96% | 100% | 100% | 71% | 75% | 88% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.5 | 28.7 | 29.9 | 34.3 | 36.1 | 34.7 | 44.2 | 47.8 | 52.3 | 60.8 |
| launches (encounters off) | 24.0 | 30.5 | 34.9 | 39.4 | 41.8 | 46.1 | 44.9 | 51.6 | 57.5 | 69.8 |
| **ratio to encounters off** | 1.02 | 0.94 | 0.86 | 0.87 | 0.86 | **0.75** | 0.98 | 0.93 | 0.91 | 0.87 |
| table × scale | 24 | 32 | 41 | 48 | 49 | 57 | 66 | 71 | 82 | 99 |
| ratio to table × scale | 1.02 | 0.90 | 0.73 | 0.71 | 0.74 | 0.61 | 0.67 | 0.67 | 0.64 | 0.61 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 29% / 13% | 44% / 41% | 27% / 45% | 43.3 | middle | late |
| 2 | 1–9 | 32% / 23% | 45% / 46% | 24% / 32% | 39.8 | middle | late |
| 3 | 1–9 | 43% / 30% | 35% / 44% | 22% / 26% | 39.8 | early | late |
| all | 1–9 | 34% / 21% | 42% / 44% | 24% / 35% | 122.8 | middle | late |
| 1 | 1–13 | 33% / 24% | 47% / 43% | 20% / 33% | 67.9 | middle | late |
| 2 | 1–13 | 34% / 28% | 49% / 45% | 18% / 26% | 66.0 | middle | late |
| 3 | 1–13 | 44% / 35% | 40% / 47% | 16% / 18% | 65.3 | early | late |
| all | 1–13 | 37% / 29% | 45% / 45% | 18% / 26% | 199.2 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.9 | 8.1 | 6.8 | 6.1 | 5.7 | 5.1 | 5.3 | 5.1 | 4.7 | 4.7 | 5.2 | 4.8 | 4.2 |
| launches read | 624 | 704 | 767 | 855 | 897 | 864 | 1052 | 1142 | 1246 | 1442 | 288 | 336 | 408 |

Slope over waves 1–10: -0.45 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | – | – | – |
| runs that reached it | 0 | 0 | 0 |
| tough, every run | 0.88 | 2.42 | 4.79 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 20 | 10 | 6 | 1 | 0 | 0 | 0 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.2** | **0.4** | **0.2** | **0.2** | **1.0** | – | – | – |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.2 | 0.4 | 0.1 | 0.2 | 0.7 | – | – | – |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.10 | 0.00 | 1.00 | – | – | – |
| clutch | 0.04 | 0.00 | 0.04 | 0.00 | 0.17 | 0.17 | 0.40 | 0.10 | 0.17 | 0.00 | – | – | – |
| runs with no save | 96% | 100% | 96% | 100% | 88% | 83% | 65% | 80% | 83% | 0% | – | – | – |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.15 | 0.10 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.04 | 0.00 | 0.00 | 0.00 | 0.08 | 0.08 | 0.10 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.08 | 0.10 | 0.10 | 0.17 | 1.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.31 | 0.52 | 0.69 | 0.60 | 0.90 | 1.07 | 1.03 | 1.21 | 1.31 | 0.98 | – | – | – |
| peaks | 0.0 | 0.1 | 0.4 | 0.3 | 0.9 | 1.0 | 1.1 | 1.2 | 1.0 | 2.0 | – | – | – |
| release after a peak (s) | 0.0 | 0.3 | 0.7 | 0.4 | 1.3 | 1.8 | 1.6 | 3.6 | 1.0 | 1.0 | – | – | – |
| hot share | 0% | 0% | 1% | 1% | 4% | 6% | 6% | 12% | 9% | 6% | – | – | – |
| calm share | 89% | 82% | 83% | 78% | 71% | 69% | 68% | 65% | 61% | 67% | – | – | – |
| shape (most runs) | flat 100% | flat 87% | flat 62% | flat 79% | flat 46% | one peak 46% | one peak 40% | one peak 60% | one peak 67% | sawtooth 100% | – | – | – |
| taps follow tension (r) | 0.35 | 0.31 | 0.32 | 0.45 | 0.32 | 0.45 | 0.41 | 0.35 | 0.32 | 0.38 | – | – | – |

saves a run: waves 1–7 0.1, 8–10 + boss 0.5; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9. 24 runs, 200 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | seeker, thermo, cadence | 0% | 7.7 | 6.0 | 13.9 | – (0) / – (0) / – (0) | 0.0 0.3 0.1 0.3 1.0 1.6 1.9 2.1 3.9 2.7 |
| off-counter | well, tesla, aegis | 0% | 7.4 | 5.9 | 18.2 | – (0) / – (0) / – (0) | 0.0 0.3 0.2 0.5 1.0 1.6 1.8 3.7 5.7 3.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
