# Bot report: Smugglers' Coves (`coves`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.25; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=coves --seeds=24 --armory=latest --kits=plan`. Heat map: `tools/v3/map-report/results/coves-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +0.96; doubles on w8 (0.29→1.25) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 0.96 a run (67% of runs have one); under 1 on w3 | ≥ 1 a run on every wave 3–10 | tough | **FLAG** |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.74 of the no-encounter wave; outside on w6 ×0.82, w7 ×0.74 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 44%, cold early 25% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 7.7 s → w10 6.4 s (slope -0.26 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.00 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.60 (15), r2 1.87 (15), r3 2.27 (15); tough (every run): 0.71, 1.88, 2.42 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 6.1 lost 1–10, end 11.8; counter 6.8 lost 1–10, end 11.4 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 8 loses 1.25 after 0.29. Move budget from it to the wave before, or soften its biggest raid.
- Too few close calls on wave 3 (0.96): give those waves a launch from a near site, or one aimed at the danger stretch.
- Budget: wave 6 sends ×0.82 the no-encounter wave; wave 7 sends ×0.74 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest early takes 25%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (1.71 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 25%, middle 31%, late 44%.

## Ships lost per wave

Normal: won 46%, mean end wave 11.9 (14 = won), 4.1 lost in waves 1–10, 1.00 in waves 1–5, 0.04 in bonus waves. Tough: 6.1 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.42 | 0.13 | 0.29 | 0.17 | 0.42 | 0.29 | 1.25 | 1.71 | 1.46 | 0.71 | 1.88 | 2.42 |
| normal, runs that reached it | 0.00 | 0.42 | 0.13 | 0.29 | 0.17 | 0.42 | 0.21 | 0.87 | 1.30 | 0.78 | 0.60 | 1.87 | 2.27 |
| normal, mean over all runs | 0.00 | 0.42 | 0.13 | 0.29 | 0.17 | 0.42 | 0.21 | 0.83 | 1.08 | 0.58 | 0.38 | 1.17 | 1.42 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 18 | 15 | 15 | 15 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +0.96.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.6 | 2.3 | 1.7 | 1.3 | 1.2 | 1.7 | 1.4 | 2.2 | 2.1 | 2.3 | 0.7 | 1.4 | 1.1 |
| kills a minute | 53 | 40 | 51 | 44 | 45 | 37 | 41 | 49 | 47 | 57 | 11 | 15 | 10 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 0.9 | 1.0 | 2.1 | 3.4 | 2.5 | 2.5 | 1.7 | 3.5 | 4.5 | 1.0 | 1.3 | 1.8 |
| runs with ≥ 1 | 0% | 71% | 67% | 71% | 96% | 88% | 88% | 83% | 100% | 96% | 71% | 75% | 83% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 23.3 | 25.7 | 33.2 | 34.2 | 36.3 | 34.4 | 36.7 | 48.4 | 51.6 | 67.3 |
| launches (encounters off) | 22.0 | 26.6 | 36.6 | 34.3 | 37.2 | 41.8 | 49.5 | 52.5 | 59.4 | 68.3 |
| **ratio to encounters off** | 1.06 | 0.97 | 0.91 | 1.00 | 0.98 | **0.82** | **0.74** | 0.92 | 0.87 | 0.98 |
| table × scale | 20 | 27 | 34 | 38 | 40 | 47 | 54 | 59 | 68 | 81 |
| ratio to table × scale | 1.16 | 0.95 | 0.98 | 0.90 | 0.91 | 0.73 | 0.68 | 0.82 | 0.76 | 0.83 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 25% / 19% | 31% / 34% | 44% / 47% | 41.1 | late | early |
| all | 1–9 | 25% / 19% | 31% / 34% | 44% / 47% | 41.1 | late | early |
| 1 | 1–13 | 17% / 10% | 45% / 52% | 39% / 38% | 78.2 | middle | early |
| all | 1–13 | 17% / 10% | 45% / 52% | 39% / 38% | 78.2 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.7 | 9.3 | 8.8 | 7.6 | 7.6 | 6.1 | 6.4 | 7.5 | 6.7 | 6.4 | 3.4 | 4.1 | 3.9 |
| launches read | 648 | 703 | 778 | 855 | 899 | 822 | 845 | 1155 | 1180 | 1585 | 168 | 216 | 192 |

Slope over waves 1–10: -0.26 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.60 | 1.87 | 2.27 |
| runs that reached it | 15 | 15 | 15 |
| tough, every run | 0.71 | 1.88 | 2.42 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 18 | 15 | 15 | 15 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.1** | **0.0** | **0.2** | **0.0** | **0.0** | **0.3** | **0.3** | **0.0** | **0.4** | **0.3** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.1 | 0.0 | 0.2 | 0.0 | 0.0 | 0.2 | 0.3 | 0.0 | 0.3 | 0.2 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.11 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.13 | 0.00 | 0.04 | 0.25 | 0.17 | 0.00 | 0.27 | 0.20 |
| runs with no save | 100% | 96% | 96% | 92% | 100% | 79% | 100% | 96% | 80% | 67% | 100% | 67% | 73% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.13 | 0.07 |
|   cover choice | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.00 | 0.06 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.06 | 0.00 | 0.00 | 0.07 |
|   kill save | 0.00 | 0.04 | 0.00 | 0.08 | 0.00 | 0.13 | 0.00 | 0.04 | 0.15 | 0.22 | 0.00 | 0.27 | 0.13 |
| tension peak | 0.15 | 0.55 | 0.38 | 0.61 | 0.64 | 0.76 | 0.61 | 0.81 | 0.90 | 1.05 | 0.79 | 1.15 | 1.09 |
| peaks | 0.0 | 0.2 | 0.0 | 0.3 | 0.3 | 0.5 | 0.2 | 0.5 | 0.9 | 1.3 | 0.6 | 0.9 | 1.6 |
| release after a peak (s) | 0.0 | 0.4 | 0.1 | 0.3 | 0.8 | 1.0 | 0.4 | 1.2 | 1.6 | 2.8 | 1.3 | 2.8 | 2.1 |
| hot share | 0% | 1% | 0% | 0% | 1% | 1% | 1% | 3% | 4% | 5% | 3% | 12% | 16% |
| calm share | 100% | 83% | 89% | 90% | 84% | 82% | 87% | 80% | 76% | 74% | 67% | 51% | 60% |
| shape (most runs) | flat 100% | flat 79% | flat 96% | flat 75% | flat 71% | flat 54% | flat 83% | flat 57% | one peak 50% | one peak 56% | one peak 60% | one peak 80% | sawtooth 47% |
| taps follow tension (r) | 0.50 | 0.30 | 0.35 | 0.37 | 0.33 | 0.29 | 0.36 | 0.32 | 0.30 | 0.30 | 0.63 | 0.59 | 0.65 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 143 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | orbital, frigate, gunships | 38% | 11.4 | 4.4 | 6.8 | 0.62 (13) / 1.77 (13) / 2.54 (13) | 0.0 0.4 0.1 0.3 0.3 0.8 0.4 1.3 1.4 1.8 |
| off-counter | tesla, fullSteam, seeker | 42% | 11.8 | 4.1 | 6.1 | 0.73 (15) / 1.87 (15) / 2.20 (15) | 0.0 0.3 0.3 0.2 0.3 0.6 0.4 1.0 1.4 1.7 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
