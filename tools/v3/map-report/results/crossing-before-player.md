# Bot report: Dunmar Crossing (`crossing`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.65; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=crossing --seeds=24 --armory=player`. Heat map: `tools/v3/map-report/results/crossing-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.96; doubles on w9 (0.33→1.29) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 3.67 a run (92% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 40%, cold late 29%; lane 2: hot middle 43%, cold late 26% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 10.1 s → w10 4.1 s (slope -0.61 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.29 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (20), r2 0.10 (20), r3 0.00 (20); tough (every run): 0.00, 0.08, 0.00 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 9 loses 1.29 after 0.33. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest late takes 29%), lane 2 (coldest late takes 26%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (1.29 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 31%, middle 41%, late 28%.

## Ships lost per wave

Normal: won 83%, mean end wave 13.3 (14 = won), 3.1 lost in waves 1–10, 0.29 in waves 1–5. Tough: 3.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.00 | 0.21 | 0.08 | 0.08 | 0.29 | 0.33 | 1.29 | 0.96 | 0.00 | 0.08 | 0.00 |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 | 0.21 | 0.08 | 0.08 | 0.29 | 0.33 | 1.21 | 0.96 | 0.00 | 0.10 | 0.00 |
| normal, mean over all runs | 0.00 | 0.00 | 0.00 | 0.21 | 0.08 | 0.08 | 0.29 | 0.33 | 1.21 | 0.92 | 0.00 | 0.08 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 20 | 20 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.96.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.5 | 1.4 | 1.7 | 1.8 | 2.1 | 2.1 | 2.2 | 2.1 | 2.6 | 2.7 | 1.2 | 1.9 | 1.6 |
| kills a minute | 46 | 43 | 52 | 49 | 52 | 50 | 50 | 47 | 49 | 53 | 32 | 37 | 44 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 1.6 | 4.1 | 3.7 | 5.1 | 7.3 | 8.5 | 8.5 | 9.9 | 12.7 | 0.8 | 0.8 | 1.0 |
| runs with ≥ 1 | 21% | 79% | 100% | 92% | 96% | 100% | 100% | 100% | 100% | 100% | 63% | 50% | 67% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 26.0 | 30.4 | 43.2 | 43.7 | 47.0 | 51.3 | 53.8 | 53.5 | 60.6 | 71.5 |
| launches (encounters off) | 26.0 | 30.4 | 43.2 | 43.7 | 47.0 | 51.3 | 53.8 | 53.5 | 60.6 | 71.5 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 26 | 34 | 45 | 51 | 52 | 62 | 71 | 78 | 90 | 107 |
| ratio to table × scale | 1.00 | 0.89 | 0.96 | 0.86 | 0.90 | 0.83 | 0.76 | 0.69 | 0.67 | 0.67 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 31% / 21% | 40% / 48% | 29% / 30% | 54.4 | middle | late |
| 2 | 1–9 | 31% / 36% | 43% / 41% | 26% / 23% | 55.0 | middle | late |
| all | 1–9 | 31% / 27% | 41% / 45% | 28% / 27% | 109.4 | middle | late |
| 1 | 1–13 | 30% / 15% | 40% / 48% | 30% / 38% | 76.1 | middle | early |
| 2 | 1–13 | 31% / 41% | 43% / 41% | 26% / 19% | 77.1 | middle | late |
| all | 1–13 | 31% / 25% | 41% / 45% | 28% / 30% | 153.3 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.1 | 8.1 | 6.9 | 6.5 | 5.9 | 5.0 | 4.8 | 4.3 | 4.3 | 4.1 | 6.0 | 5.6 | 5.9 |
| launches read | 624 | 729 | 1035 | 1049 | 1052 | 1224 | 1265 | 1235 | 1433 | 1673 | 350 | 349 | 346 |

Slope over waves 1–10: -0.61 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 0.10 | 0.00 |
| runs that reached it | 20 | 20 | 20 |
| tough, every run | 0.00 | 0.08 | 0.00 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 20 | 20 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.1** | **0.1** | **0.2** | **0.2** | **0.0** | **0.0** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.2 | 0.1 | 0.1 | 0.2 | 0.1 | 0.0 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.13 | 0.00 | 0.08 | 0.17 | 0.13 | 0.00 | 0.00 | 0.00 |
| runs with no save | 100% | 100% | 100% | 100% | 92% | 92% | 92% | 88% | 88% | 83% | 100% | 100% | 100% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.08 | 0.08 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.04 | 0.17 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.08 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.20 | 0.36 | 0.66 | 0.76 | 0.81 | 0.94 | 1.10 | 1.22 | 1.48 | 1.43 | 0.35 | 0.42 | 0.28 |
| peaks | 0.0 | 0.0 | 0.3 | 0.4 | 0.8 | 1.2 | 1.4 | 1.7 | 2.0 | 2.7 | 0.1 | 0.1 | 0.0 |
| release after a peak (s) | 0.0 | 0.0 | 0.8 | 0.8 | 1.1 | 1.6 | 2.0 | 2.1 | 2.9 | 2.4 | 0.1 | 0.1 | 0.0 |
| hot share | 0% | 0% | 1% | 2% | 3% | 4% | 5% | 7% | 10% | 12% | 0% | 1% | 0% |
| calm share | 98% | 92% | 78% | 78% | 74% | 66% | 62% | 62% | 55% | 51% | 93% | 84% | 91% |
| shape (most runs) | flat 100% | flat 100% | flat 71% | flat 58% | flat 50% | one peak 38% | one peak 42% | sawtooth 50% | sawtooth 54% | sawtooth 52% | flat 90% | flat 90% | flat 100% |
| taps follow tension (r) | 0.36 | 0.32 | 0.36 | 0.38 | 0.38 | 0.35 | 0.35 | 0.34 | 0.35 | 0.37 | 0.47 | 0.36 | 0.37 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 923 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
