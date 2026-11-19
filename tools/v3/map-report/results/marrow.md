# Bot report: Lee of Marrow (`marrow`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 0.95; built 2026-11-19.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=marrow --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/marrow-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +1.42; doubles on w6 (0.13→0.67), w7 (0.67→1.50), w9 (0.54→1.96) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.50 a run (92% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w5 ×1.07 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 46%, cold early 26% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 11.4 s → w10 3.6 s (slope -0.88 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.25 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.71 (7), r2 2.29 (7), r3 1.83 (6); tough (every run): 1.54, 3.42, 3.21 | about 1 a round on the bot's scale, rising | normal | INFO |
| `g-mechanic` | Radar tower standing | normal: fell by w5 in 8, by w6 14, by w10 24, in the boss rounds 0, stood to the end 0 (of 24); median w6; tough: fell by w5 in 8, by w6 14, by w10 24, in the boss rounds 0, stood to the end 0 (of 24); median w6 | worth defending: standing past wave 6 in most runs | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 6.5 lost 1–10, end 10.4; counter 9.2 lost 1–10, end 9.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 6 loses 0.67 after 0.13; wave 7 loses 1.50 after 0.67; wave 9 loses 1.96 after 0.54. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest early takes 26%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (3.04 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 26%, middle 46%, late 28%.

## Ships lost per wave

Normal: won 8%, mean end wave 10.3 (14 = won), 5.0 lost in waves 1–10, 0.25 in waves 1–5, 0.04 in bonus waves. Tough: 8.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 0.08 | 0.13 | 0.67 | 1.50 | 0.54 | 1.96 | 3.04 | 1.54 | 3.42 | 3.21 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 0.08 | 0.13 | 0.67 | 1.29 | 0.52 | 1.16 | 2.13 | 1.71 | 2.29 | 1.83 |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 0.08 | 0.13 | 0.67 | 1.29 | 0.46 | 0.92 | 1.42 | 0.50 | 0.67 | 0.46 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 21 | 19 | 16 | 7 | 7 | 6 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +1.42.

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 0.7 | 1.5 | 2.5 | 3.4 | 4.8 | 6.3 | 9.5 | 7.7 | 9.9 | 3.3 | 3.6 | 5.3 |
| runs with ≥ 1 | 0% | 54% | 92% | 96% | 92% | 100% | 100% | 100% | 100% | 100% | 92% | 96% | 92% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 15.0 | 16.4 | 24.3 | 31.1 | 25.8 | 31.0 | 28.9 | 37.2 | 39.6 | 47.0 |
| launches (encounters off) | 15.0 | 16.4 | 23.5 | 29.8 | 24.0 | 29.5 | 30.3 | 36.1 | 41.0 | 46.5 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.03 | 1.04 | 1.07 | 1.05 | 0.95 | 1.03 | 0.97 | 1.01 |
| table × scale | 15 | 20 | 26 | 30 | 31 | 36 | 41 | 45 | 52 | 62 |
| ratio to table × scale | 1.00 | 0.82 | 0.93 | 1.04 | 0.83 | 0.86 | 0.71 | 0.83 | 0.76 | 0.76 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 26% / 7% | 46% / 62% | 28% / 31% | 43.3 | middle | early |
| all | 1–9 | 26% / 7% | 46% / 62% | 28% / 31% | 43.3 | middle | early |
| 1 | 1–13 | 25% / 6% | 48% / 60% | 27% / 33% | 100.0 | middle | early |
| all | 1–13 | 25% / 6% | 48% / 60% | 27% / 33% | 100.0 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 11.4 | 9.8 | 8.0 | 6.8 | 5.2 | 4.7 | 3.0 | 3.6 | 3.9 | 3.6 | 6.9 | 6.7 | 6.2 |
| launches read | 360 | 393 | 580 | 743 | 618 | 742 | 694 | 891 | 944 | 1125 | 168 | 288 | 312 |

Slope over waves 1–10: -0.88 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.71 | 2.29 | 1.83 |
| runs that reached it | 7 | 7 | 6 |
| tough, every run | 1.54 | 3.42 | 3.21 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 21 | 19 | 16 | 7 | 7 | 6 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.2** | **0.3** | **0.2** | **0.4** | **0.4** | **0.4** | **0.3** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.2 | 0.2 | 0.3 | 0.4 | 0.3 | 0.2 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.19 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.13 | 0.10 | 0.16 | 0.31 | 0.29 | 0.29 | 0.17 |
| runs with no save | 100% | 100% | 96% | 100% | 100% | 96% | 79% | 76% | 84% | 63% | 57% | 71% | 67% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.11 | 0.25 | 0.00 | 0.29 | 0.17 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.05 | 0.00 | 0.13 | 0.29 | 0.14 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.08 | 0.24 | 0.05 | 0.00 | 0.14 | 0.00 | 0.17 |
| tension peak | 0.05 | 0.27 | 0.53 | 0.73 | 0.65 | 1.00 | 1.20 | 1.06 | 1.31 | 1.43 | 1.41 | 1.69 | 1.98 |
| peaks | 0.0 | 0.0 | 0.2 | 0.3 | 0.3 | 0.9 | 1.3 | 1.3 | 1.8 | 2.1 | 2.0 | 1.3 | 1.0 |
| release after a peak (s) | 0.0 | 0.0 | 0.4 | 1.0 | 0.8 | 2.0 | 2.2 | 1.5 | 2.0 | 2.3 | 1.8 | 3.4 | 2.7 |
| hot share | 0% | 0% | 0% | 2% | 1% | 4% | 7% | 4% | 7% | 8% | 13% | 24% | 35% |
| calm share | 100% | 96% | 89% | 82% | 83% | 78% | 68% | 68% | 68% | 64% | 57% | 43% | 37% |
| shape (most runs) | flat 100% | flat 100% | flat 83% | flat 67% | flat 71% | one peak 54% | one peak 38% | one peak 43% | sawtooth 37% | sawtooth rising 50% | sawtooth rising 43% | one peak 57% | one peak 50% |
| taps follow tension (r) | 0.39 | 0.21 | 0.33 | 0.40 | 0.44 | 0.45 | 0.45 | 0.40 | 0.37 | 0.35 | 0.38 | 0.58 | 0.45 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 154 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | aegis, seeker, droneScreen | 0% | 9.5 | 5.5 | 9.2 | 2.00 (4) / 2.00 (4) / 2.67 (3) | 0.0 0.0 0.1 0.1 0.3 0.8 1.3 0.7 2.7 3.2 |
| off-counter | scatter, railgun, overdrive | 4% | 10.4 | 4.9 | 6.5 | 1.71 (7) / 3.00 (7) / 1.75 (4) | 0.0 0.0 0.0 0.0 0.2 0.5 0.5 1.1 2.2 1.9 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
