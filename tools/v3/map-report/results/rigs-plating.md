# Bot report: The Rig Field (`rigs`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.7; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=rigs --seeds=24 --armory=plating --kits=plan`. Heat map: `tools/v3/map-report/results/rigs-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w5 +0.42; doubles on w5 (0.13→0.54) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 0.88 a run (46% of runs have one); under 1 on w3 | ≥ 1 a run on every wave 3–10 | tough | **FLAG** |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.81 of the no-encounter wave; outside on w9 ×0.82, w10 ×0.81 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 41%, cold early 26% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 10.8 s → w10 6.0 s (slope -0.44 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.88 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.41 (22), r2 0.77 (22), r3 1.18 (22); tough (every run): 0.42, 0.71, 1.29 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 2.8 lost 1–10, end 13.3; off-counter 2.9 lost 1–10, end 13.0 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 5 loses 0.54 after 0.13. Move budget from it to the wave before, or soften its biggest raid.
- Too few close calls on wave 3 (0.88): give those waves a launch from a near site, or one aimed at the danger stretch.
- Budget: wave 9 sends ×0.82 the no-encounter wave; wave 10 sends ×0.81 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest early takes 26%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 5 (0.54 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 26%, middle 41%, late 32%.

## Ships lost per wave

Normal: won 92%, mean end wave 13.3 (14 = won), 2.3 lost in waves 1–10, 0.88 in waves 1–5. Tough: 3.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.21 | 0.13 | 0.54 | 0.38 | 0.42 | 0.46 | 0.33 | 0.54 | 0.42 | 0.71 | 1.29 |
| normal, runs that reached it | 0.00 | 0.00 | 0.21 | 0.13 | 0.54 | 0.25 | 0.14 | 0.32 | 0.36 | 0.45 | 0.41 | 0.77 | 1.18 |
| normal, mean over all runs | 0.00 | 0.00 | 0.21 | 0.13 | 0.54 | 0.25 | 0.13 | 0.29 | 0.33 | 0.42 | 0.38 | 0.71 | 1.08 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 22 | 22 | 22 | 22 | 22 | 22 |

Biggest one-wave step up (tough, waves 2–10): wave 5, +0.42.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.8 | 1.7 | 1.7 | 1.7 | 2.0 | 1.6 | 1.8 | 1.9 | 1.6 | 1.6 | 0.3 | 0.6 | 1.5 |
| kills a minute | 47 | 47 | 42 | 46 | 44 | 42 | 50 | 48 | 41 | 39 | 12 | 16 | 31 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.4 | 0.9 | 0.9 | 1.8 | 2.8 | 2.9 | 2.0 | 2.2 | 3.4 | 2.9 | 1.5 | 1.5 | 2.4 |
| runs with ≥ 1 | 33% | 67% | 46% | 88% | 96% | 100% | 88% | 88% | 100% | 92% | 79% | 75% | 92% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.5 | 28.3 | 31.5 | 37.1 | 36.8 | 39.3 | 44.5 | 44.6 | 43.0 | 50.5 |
| launches (encounters off) | 27.0 | 29.1 | 36.5 | 36.0 | 42.0 | 44.5 | 48.0 | 48.5 | 52.1 | 62.3 |
| **ratio to encounters off** | 0.91 | 0.97 | 0.87 | 1.03 | 0.88 | 0.88 | 0.93 | 0.92 | **0.82** | **0.81** |
| table × scale | 27 | 35 | 46 | 54 | 55 | 63 | 74 | 79 | 92 | 111 |
| ratio to table × scale | 0.91 | 0.81 | 0.69 | 0.69 | 0.67 | 0.62 | 0.60 | 0.56 | 0.47 | 0.45 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 26% / 10% | 41% / 51% | 32% / 39% | 28.3 | middle | early |
| all | 1–9 | 26% / 10% | 41% / 51% | 32% / 39% | 28.3 | middle | early |
| 1 | 1–13 | 21% / 8% | 52% / 61% | 27% / 31% | 46.9 | middle | early |
| all | 1–13 | 21% / 8% | 52% / 61% | 27% / 31% | 46.9 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.8 | 8.5 | 8.3 | 7.7 | 7.3 | 6.4 | 7.3 | 6.8 | 5.9 | 6.0 | 1.9 | 2.0 | 4.2 |
| launches read | 621 | 760 | 755 | 906 | 869 | 918 | 1039 | 1066 | 991 | 1184 | 110 | 159 | 356 |

Slope over waves 1–10: -0.44 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.41 | 0.77 | 1.18 |
| runs that reached it | 22 | 22 | 22 |
| tough, every run | 0.42 | 0.71 | 1.29 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 22 | 22 | 22 | 22 | 22 | 22 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.2** | **0.0** | **0.0** | **0.4** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.2 | 0.2 | 0.0 | 0.0 | 0.3 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.23 | 0.05 | 0.00 | 0.00 | 0.14 |
| runs with no save | 100% | 100% | 100% | 100% | 100% | 96% | 100% | 100% | 77% | 91% | 100% | 95% | 73% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.05 | 0.00 | 0.00 | 0.05 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.09 | 0.18 | 0.00 | 0.05 | 0.23 |
| tension peak | 0.23 | 0.40 | 0.45 | 0.46 | 0.74 | 0.70 | 0.53 | 0.67 | 0.88 | 0.96 | 0.84 | 1.08 | 1.34 |
| peaks | 0.0 | 0.0 | 0.1 | 0.1 | 0.4 | 0.5 | 0.1 | 0.3 | 0.6 | 0.8 | 0.7 | 1.4 | 1.4 |
| release after a peak (s) | 0.0 | 0.0 | 0.2 | 0.2 | 0.9 | 1.0 | 0.2 | 0.7 | 1.0 | 1.5 | 0.9 | 1.3 | 2.2 |
| hot share | 0% | 0% | 0% | 0% | 3% | 2% | 0% | 1% | 3% | 2% | 4% | 12% | 16% |
| calm share | 95% | 92% | 90% | 90% | 82% | 82% | 86% | 84% | 82% | 83% | 85% | 71% | 66% |
| shape (most runs) | flat 100% | flat 96% | flat 92% | flat 87% | flat 67% | flat 58% | flat 86% | flat 73% | flat 50% | one peak 45% | flat 45% | sawtooth 36% | one peak 45% |
| taps follow tension (r) | 0.10 | 0.13 | 0.17 | 0.16 | 0.15 | 0.20 | 0.15 | 0.25 | 0.29 | 0.24 | 0.23 | 0.31 | 0.29 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 101 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | shrapnel, well, flak | 92% | 13.3 | 2.0 | 2.8 | 0.27 (22) / 0.68 (22) / 0.68 (22) | 0.0 0.0 0.2 0.1 0.5 0.4 0.4 0.5 0.2 0.4 |
| off-counter | tesla, fullSteam, aegis | 83% | 13.0 | 2.2 | 2.9 | 0.40 (20) / 0.75 (20) / 0.75 (20) | 0.0 0.0 0.3 0.1 0.5 0.4 0.4 0.4 0.2 0.7 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
