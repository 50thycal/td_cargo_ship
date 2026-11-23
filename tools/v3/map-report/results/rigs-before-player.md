# Bot report: The Rig Field (`rigs`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.7; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=rigs --seeds=24 --armory=player --out=../beforerep/player`. Heat map: `../beforerep/player/rigs-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +1.29; doubles on w8 (0.04→1.33) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 4.67 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 41%, cold late 26% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 9.9 s → w10 4.1 s (slope -0.60 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.29 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.27 (15), r2 0.07 (15), r3 0.20 (15); tough (every run): 0.17, 0.04, 0.13 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 8 loses 1.33 after 0.04. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest late takes 26%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.54 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 33%, middle 41%, late 26%.

## Ships lost per wave

Normal: won 63%, mean end wave 12.1 (14 = won), 3.2 lost in waves 1–10, 0.29 in waves 1–5. Tough: 4.1 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.08 | 0.00 | 0.21 | 0.08 | 0.04 | 1.33 | 0.79 | 1.54 | 0.17 | 0.04 | 0.13 |
| normal, runs that reached it | 0.00 | 0.00 | 0.08 | 0.00 | 0.21 | 0.08 | 0.04 | 1.04 | 0.85 | 1.26 | 0.27 | 0.07 | 0.20 |
| normal, mean over all runs | 0.00 | 0.00 | 0.08 | 0.00 | 0.21 | 0.08 | 0.04 | 1.04 | 0.71 | 1.00 | 0.17 | 0.04 | 0.13 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 20 | 19 | 15 | 15 | 15 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +1.29.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.8 | 1.6 | 1.7 | 1.5 | 1.8 | 1.8 | 2.1 | 2.2 | 1.8 | 2.4 | 1.4 | 1.8 | 1.8 |
| kills a minute | 45 | 41 | 43 | 42 | 43 | 46 | 49 | 42 | 44 | 45 | 21 | 25 | 24 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.0 | 1.6 | 5.7 | 4.7 | 5.6 | 7.2 | 7.8 | 8.5 | 8.3 | 9.2 | 0.8 | 0.7 | 0.6 |
| runs with ≥ 1 | 58% | 88% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 50% | 50% | 38% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 27.0 | 28.7 | 34.4 | 35.8 | 37.8 | 45.9 | 50.9 | 49.2 | 51.8 | 58.8 |
| launches (encounters off) | 27.0 | 28.7 | 34.4 | 35.8 | 37.8 | 45.9 | 50.9 | 49.2 | 51.8 | 58.8 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 27 | 35 | 46 | 54 | 55 | 63 | 74 | 79 | 92 | 111 |
| ratio to table × scale | 1.00 | 0.82 | 0.75 | 0.66 | 0.69 | 0.73 | 0.69 | 0.62 | 0.56 | 0.53 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 33% / 26% | 41% / 57% | 26% / 16% | 138.5 | middle | late |
| all | 1–9 | 33% / 26% | 41% / 57% | 26% / 16% | 138.5 | middle | late |
| 1 | 1–13 | 33% / 26% | 39% / 56% | 28% / 18% | 206.8 | middle | late |
| all | 1–13 | 33% / 26% | 39% / 56% | 28% / 18% | 206.8 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.9 | 8.4 | 7.2 | 6.4 | 5.7 | 5.1 | 5.1 | 4.6 | 4.3 | 4.1 | 3.5 | 3.5 | 3.5 |
| launches read | 647 | 688 | 822 | 853 | 906 | 1096 | 1220 | 1178 | 1240 | 1409 | 336 | 336 | 336 |

Slope over waves 1–10: -0.60 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.27 | 0.07 | 0.20 |
| runs that reached it | 15 | 15 | 15 |
| tough, every run | 0.17 | 0.04 | 0.13 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 20 | 19 | 15 | 15 | 15 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.1** | **0.5** | **0.2** | **0.3** | **0.0** | **0.0** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.2 | 0.1 | 0.1 | 0.8 | 0.2 | 0.3 | 0.0 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.21 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.08 | 0.08 | 0.46 | 0.05 | 0.21 | 0.00 | 0.00 | 0.00 |
| runs with no save | 100% | 100% | 100% | 100% | 92% | 88% | 92% | 63% | 80% | 89% | 100% | 100% | 100% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.17 | 0.10 | 0.05 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.00 | 0.21 | 0.05 | 0.16 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.08 | 0.04 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.36 | 0.41 | 0.76 | 0.69 | 0.92 | 0.94 | 0.99 | 1.22 | 1.11 | 1.53 | 0.50 | 0.55 | 0.58 |
| peaks | 0.0 | 0.0 | 0.6 | 0.3 | 0.9 | 1.0 | 1.2 | 1.9 | 1.9 | 2.4 | 0.0 | 0.1 | 0.1 |
| release after a peak (s) | 0.1 | 0.0 | 1.1 | 0.5 | 1.7 | 1.7 | 1.7 | 2.0 | 2.1 | 2.4 | 0.0 | 0.1 | 0.3 |
| hot share | 0% | 0% | 2% | 1% | 3% | 3% | 4% | 8% | 6% | 11% | 0% | 1% | 1% |
| calm share | 90% | 88% | 75% | 77% | 71% | 69% | 62% | 59% | 63% | 59% | 79% | 69% | 68% |
| shape (most runs) | flat 96% | flat 100% | one peak 46% | flat 71% | one peak 54% | one peak 42% | one peak 42% | sawtooth 54% | sawtooth 55% | sawtooth 47% | flat 100% | flat 87% | flat 87% |
| taps follow tension (r) | 0.07 | 0.02 | 0.15 | 0.25 | 0.24 | 0.36 | 0.34 | 0.31 | 0.38 | 0.40 | 0.53 | 0.40 | 0.34 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 634 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
