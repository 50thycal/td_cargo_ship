# Bot report: The Sharra Delta (`delta`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.5; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=delta --seeds=24 --armory=player --kits=plan`. Heat map: `tools/v3/map-report/results/delta-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.50; no wave doubles | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | PASS |
| `w-early` | Close calls from wave 3 | fewest w3 2.25 a run (88% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w6 ×0.77 of the no-encounter wave; outside on w6 ×0.77 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 42%, cold early 28%; lane 2: hot middle 42%, cold late 26%; lane 3: hot early 48%, cold late 21% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 8.9 s → w10 4.6 s (slope -0.44 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.04 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.25 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.74 (19), r2 1.16 (19), r3 1.89 (19); tough (every run): 0.71, 1.17, 1.92 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 3.3 lost 1–10, end 13.5; off-counter 3.8 lost 1–10, end 12.8 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Budget: wave 6 sends ×0.77 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest early takes 28%), lane 2 (coldest late takes 26%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (1.21 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 35%, middle 39%, late 26%.

## Ships lost per wave

Normal: won 79%, mean end wave 13.0 (14 = won), 3.8 lost in waves 1–10, 0.25 in waves 1–5. Tough: 4.1 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.04 | 0.17 | 0.00 | 0.00 | 0.04 | 0.38 | 0.42 | 0.71 | 1.21 | 1.17 | 0.71 | 1.17 | 1.92 |
| normal, runs that reached it | 0.04 | 0.17 | 0.00 | 0.00 | 0.04 | 0.38 | 0.42 | 0.71 | 1.00 | 1.14 | 0.74 | 1.16 | 1.89 |
| normal, mean over all runs | 0.04 | 0.17 | 0.00 | 0.00 | 0.04 | 0.38 | 0.42 | 0.71 | 0.96 | 1.04 | 0.58 | 0.92 | 1.50 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 19 | 19 | 19 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.50.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.5 | 1.6 | 1.3 | 1.3 | 1.4 | 1.5 | 1.5 | 1.8 | 2.1 | 1.7 | 0.8 | 1.1 | 1.0 |
| kills a minute | 48 | 47 | 40 | 43 | 44 | 37 | 41 | 43 | 45 | 40 | 16 | 18 | 18 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.0 | 1.7 | 2.3 | 3.5 | 4.4 | 6.8 | 6.2 | 7.3 | 6.5 | 9.3 | 2.3 | 1.5 | 2.2 |
| runs with ≥ 1 | 58% | 75% | 88% | 96% | 96% | 100% | 100% | 100% | 100% | 100% | 79% | 71% | 83% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.5 | 28.7 | 29.9 | 33.9 | 36.0 | 34.4 | 44.5 | 46.9 | 51.9 | 61.0 |
| launches (encounters off) | 24.0 | 30.5 | 34.2 | 39.2 | 41.1 | 44.7 | 44.3 | 50.5 | 56.5 | 67.8 |
| **ratio to encounters off** | 1.02 | 0.94 | 0.87 | 0.86 | 0.88 | **0.77** | 1.01 | 0.93 | 0.92 | 0.90 |
| table × scale | 24 | 32 | 41 | 48 | 49 | 57 | 66 | 71 | 82 | 99 |
| ratio to table × scale | 1.02 | 0.90 | 0.73 | 0.71 | 0.74 | 0.60 | 0.67 | 0.66 | 0.63 | 0.62 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 28% / 42% | 42% / 38% | 30% / 19% | 35.0 | middle | early |
| 2 | 1–9 | 32% / 41% | 42% / 45% | 26% / 14% | 34.7 | middle | late |
| 3 | 1–9 | 48% / 65% | 31% / 35% | 21% / 0% | 28.3 | early | late |
| all | 1–9 | 35% / 49% | 39% / 39% | 26% / 11% | 97.9 | middle | late |
| 1 | 1–13 | 32% / 66% | 45% / 26% | 23% / 9% | 58.8 | middle | late |
| 2 | 1–13 | 35% / 67% | 46% / 24% | 19% / 9% | 61.7 | middle | late |
| 3 | 1–13 | 46% / 77% | 41% / 23% | 13% / 0% | 57.5 | early | late |
| all | 1–13 | 37% / 71% | 44% / 24% | 18% / 5% | 178.0 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.9 | 8.1 | 6.8 | 6.2 | 5.5 | 5.0 | 5.4 | 4.9 | 5.0 | 4.6 | 5.1 | 4.8 | 4.3 |
| launches read | 624 | 702 | 767 | 844 | 896 | 856 | 1052 | 1119 | 1239 | 1445 | 288 | 336 | 408 |

Slope over waves 1–10: -0.44 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.74 | 1.16 | 1.89 |
| runs that reached it | 19 | 19 | 19 |
| tough, every run | 0.71 | 1.17 | 1.92 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 19 | 19 | 19 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.3** | **0.2** | **0.1** | **0.1** | **0.3** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 | 0.2 | 0.1 | 0.1 | 0.2 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.08 | 0.08 | 0.26 | 0.09 | 0.11 | 0.05 | 0.26 |
| runs with no save | 100% | 100% | 100% | 96% | 100% | 96% | 92% | 88% | 78% | 77% | 89% | 89% | 74% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.04 | 0.04 | 0.14 | 0.00 | 0.00 | 0.05 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.05 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.04 | 0.17 | 0.09 | 0.05 | 0.11 | 0.21 |
| tension peak | 0.26 | 0.40 | 0.48 | 0.44 | 0.64 | 0.86 | 0.77 | 0.96 | 1.08 | 1.38 | 0.73 | 0.83 | 1.11 |
| peaks | 0.0 | 0.0 | 0.1 | 0.0 | 0.3 | 0.9 | 0.6 | 1.1 | 1.3 | 1.2 | 0.3 | 0.8 | 1.1 |
| release after a peak (s) | 0.0 | 0.0 | 0.1 | 0.0 | 0.8 | 1.1 | 1.3 | 1.8 | 2.5 | 2.1 | 0.3 | 1.2 | 2.1 |
| hot share | 0% | 0% | 0% | 0% | 1% | 3% | 1% | 4% | 4% | 4% | 1% | 4% | 7% |
| calm share | 94% | 86% | 88% | 83% | 77% | 76% | 78% | 72% | 69% | 73% | 77% | 67% | 71% |
| shape (most runs) | flat 100% | flat 100% | flat 92% | flat 100% | flat 67% | one peak 42% | one peak 54% | one peak 62% | one peak 57% | one peak 59% | flat 74% | one peak 42% | one peak 89% |
| taps follow tension (r) | 0.35 | 0.35 | 0.33 | 0.40 | 0.38 | 0.46 | 0.39 | 0.34 | 0.38 | 0.40 | 0.43 | 0.34 | 0.38 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 653 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | seeker, thermo, cadence | 92% | 13.5 | 3.2 | 3.3 | 0.95 (22) / 1.14 (22) / 1.68 (22) | 0.0 0.1 0.0 0.0 0.0 0.3 0.2 0.7 0.9 1.0 |
| off-counter | well, tesla, aegis | 67% | 12.8 | 3.5 | 3.8 | 0.72 (18) / 0.94 (18) / 1.78 (18) | 0.0 0.2 0.0 0.0 0.0 0.5 0.3 0.5 1.2 1.2 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
