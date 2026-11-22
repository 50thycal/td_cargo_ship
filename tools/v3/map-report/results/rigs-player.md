# Bot report: The Rig Field (`rigs`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.7; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=rigs --seeds=24 --armory=player --kits=plan`. Heat map: `tools/v3/map-report/results/rigs-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +0.54; doubles on w8 (0.29→0.83) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.42 a run (67% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w9 ×0.83 of the no-encounter wave; outside on w9 ×0.83, w10 ×0.85 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 36%, cold late 30% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 10.8 s → w10 6.0 s (slope -0.44 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.58 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.68 (22), r2 1.09 (22), r3 1.82 (22); tough (every run): 0.71, 1.00, 2.08 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 3.3 lost 1–10, end 13.0; counter 3.8 lost 1–10, end 13.2 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 8 loses 0.83 after 0.29. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 9 sends ×0.83 the no-encounter wave; wave 10 sends ×0.85 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest late takes 30%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (1.13 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 35%, middle 36%, late 30%.

## Ships lost per wave

Normal: won 79%, mean end wave 13.4 (14 = won), 3.3 lost in waves 1–10, 0.58 in waves 1–5. Tough: 4.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.08 | 0.13 | 0.29 | 0.38 | 0.29 | 0.83 | 1.13 | 0.75 | 0.71 | 1.00 | 2.08 |
| normal, runs that reached it | 0.00 | 0.08 | 0.08 | 0.13 | 0.29 | 0.38 | 0.29 | 0.54 | 0.91 | 0.64 | 0.68 | 1.09 | 1.82 |
| normal, mean over all runs | 0.00 | 0.08 | 0.08 | 0.13 | 0.29 | 0.38 | 0.29 | 0.54 | 0.88 | 0.58 | 0.63 | 1.00 | 1.67 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 22 | 22 | 22 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +0.54.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.9 | 1.8 | 1.8 | 1.7 | 1.9 | 1.7 | 2.1 | 2.2 | 2.0 | 1.7 | 0.3 | 0.6 | 1.5 |
| kills a minute | 46 | 46 | 45 | 44 | 48 | 43 | 49 | 46 | 43 | 39 | 12 | 17 | 31 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.6 | 1.1 | 1.4 | 2.5 | 3.1 | 3.1 | 2.8 | 3.1 | 3.4 | 3.2 | 1.7 | 2.0 | 3.3 |
| runs with ≥ 1 | 42% | 63% | 67% | 96% | 92% | 88% | 75% | 96% | 100% | 96% | 79% | 88% | 92% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.5 | 27.4 | 31.6 | 35.9 | 38.4 | 39.6 | 44.8 | 43.1 | 44.4 | 50.0 |
| launches (encounters off) | 27.0 | 27.9 | 35.2 | 34.6 | 37.7 | 42.9 | 48.0 | 47.9 | 53.3 | 58.8 |
| **ratio to encounters off** | 0.91 | 0.98 | 0.90 | 1.04 | 1.02 | 0.92 | 0.93 | 0.90 | **0.83** | **0.85** |
| table × scale | 27 | 35 | 46 | 54 | 55 | 63 | 74 | 79 | 92 | 111 |
| ratio to table × scale | 0.91 | 0.78 | 0.69 | 0.67 | 0.70 | 0.63 | 0.61 | 0.55 | 0.48 | 0.45 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 35% / 30% | 36% / 40% | 30% / 30% | 46.0 | middle | late |
| all | 1–9 | 35% / 30% | 36% / 40% | 30% / 30% | 46.0 | middle | late |
| 1 | 1–13 | 27% / 17% | 48% / 61% | 25% / 23% | 77.1 | middle | late |
| all | 1–13 | 27% / 17% | 48% / 61% | 25% / 23% | 77.1 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.8 | 8.6 | 8.4 | 7.4 | 7.1 | 6.4 | 7.1 | 6.8 | 5.8 | 6.0 | 1.9 | 2.1 | 4.2 |
| launches read | 622 | 733 | 752 | 878 | 898 | 909 | 1047 | 1035 | 1032 | 1173 | 125 | 161 | 380 |

Slope over waves 1–10: -0.44 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.68 | 1.09 | 1.82 |
| runs that reached it | 22 | 22 | 22 |
| tough, every run | 0.71 | 1.00 | 2.08 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 22 | 22 | 22 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.2** | **0.2** | **0.1** | **0.1** | **0.0** | **0.3** | **0.2** | **0.4** | **0.3** | **0.5** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.1 | 0.1 | 0.0 | 0.3 | 0.2 | 0.3 | 0.2 | 0.4 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.08 | 0.08 | 0.00 | 0.08 | 0.04 | 0.22 | 0.14 | 0.27 | 0.23 | 0.36 |
| runs with no save | 100% | 100% | 96% | 83% | 92% | 92% | 88% | 96% | 74% | 86% | 64% | 73% | 55% |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.04 | 0.04 | 0.00 | 0.17 | 0.05 | 0.05 | 0.09 | 0.05 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.04 | 0.04 | 0.00 | 0.05 | 0.14 | 0.05 | 0.23 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.09 | 0.05 | 0.09 | 0.18 |
|   kill save | 0.00 | 0.00 | 0.04 | 0.08 | 0.04 | 0.04 | 0.04 | 0.00 | 0.09 | 0.05 | 0.14 | 0.09 | 0.09 |
| tension peak | 0.28 | 0.36 | 0.41 | 0.51 | 0.62 | 0.68 | 0.62 | 0.80 | 1.08 | 1.28 | 0.97 | 1.22 | 1.36 |
| peaks | 0.0 | 0.0 | 0.2 | 0.2 | 0.3 | 0.5 | 0.3 | 0.5 | 1.1 | 0.9 | 1.1 | 1.4 | 1.6 |
| release after a peak (s) | 0.0 | 0.1 | 0.3 | 0.5 | 0.6 | 0.9 | 0.7 | 0.9 | 1.9 | 3.1 | 1.2 | 1.7 | 2.2 |
| hot share | 0% | 0% | 1% | 1% | 1% | 2% | 1% | 2% | 4% | 3% | 7% | 12% | 18% |
| calm share | 93% | 91% | 91% | 89% | 84% | 82% | 84% | 80% | 77% | 82% | 84% | 72% | 68% |
| shape (most runs) | flat 100% | flat 96% | flat 83% | flat 79% | flat 79% | flat 58% | flat 71% | flat 58% | one peak 48% | one peak 68% | one peak 50% | one peak 45% | sawtooth 36% |
| taps follow tension (r) | 0.08 | 0.07 | 0.14 | 0.17 | 0.18 | 0.19 | 0.20 | 0.22 | 0.32 | 0.23 | 0.24 | 0.23 | 0.31 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 189 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | railgun, flak, orbital | 75% | 13.2 | 3.1 | 3.8 | 0.52 (21) / 1.48 (21) / 1.67 (21) | 0.0 0.1 0.1 0.1 0.3 0.3 0.4 0.8 1.0 0.7 |
| off-counter | seeker, shield, tesla | 71% | 13.0 | 3.1 | 3.3 | 0.62 (21) / 1.24 (21) / 1.67 (21) | 0.0 0.0 0.1 0.2 0.3 0.5 0.2 0.7 1.0 0.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
