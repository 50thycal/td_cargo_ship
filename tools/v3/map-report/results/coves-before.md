# Bot report: Smugglers' Coves (`coves`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.25; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=coves --seeds=24`. Heat map: `tools/v3/map-report/results/coves-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +4.08; doubles on w6 (0.29→3.33), w8 (3.04→7.13) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 3.54 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 43%, cold early 28% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 6.4 s → w10 4.5 s (slope -0.41 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.13 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 – (0), r2 – (0), r3 – (0); tough (every run): 0.21, 0.54, 0.54 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 6 loses 3.33 after 0.29; wave 8 loses 7.13 after 3.04. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest early takes 28%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (9.54 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 28%, middle 43%, late 29%.

## Ships lost per wave

Normal: won 0%, mean end wave 6.9 (14 = won), 4.9 lost in waves 1–10, 1.13 in waves 1–5. Tough: 31.9 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.38 | 0.21 | 0.25 | 0.29 | 3.33 | 3.04 | 7.13 | 9.54 | 7.71 | 0.21 | 0.54 | 0.54 |
| normal, runs that reached it | 0.00 | 0.38 | 0.21 | 0.25 | 0.29 | 2.35 | 1.77 | 1.86 | 0.00 | – | – | – | – |
| normal, mean over all runs | 0.00 | 0.38 | 0.21 | 0.25 | 0.29 | 2.25 | 0.96 | 0.54 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 13 | 7 | 2 | 0 | 0 | 0 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +4.08.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.5 | 2.0 | 2.1 | 1.5 | 1.7 | 2.7 | 2.5 | 2.8 | 3.3 | – | – | – | – |
| kills a minute | 38 | 34 | 45 | 38 | 38 | 33 | 41 | 43 | 36 | – | – | – | – |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.5 | 1.6 | 4.2 | 3.5 | 5.8 | 5.8 | 6.9 | 7.0 | 6.8 | 9.7 | 1.7 | 0.9 | 1.4 |
| runs with ≥ 1 | 33% | 83% | 100% | 100% | 100% | 96% | 100% | 100% | 100% | 100% | 92% | 50% | 71% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 22.0 | 26.6 | 36.7 | 34.3 | 37.3 | 42.8 | 49.5 | 52.2 | 60.8 | 70.0 |
| launches (encounters off) | 22.0 | 26.6 | 36.7 | 34.3 | 37.3 | 42.8 | 49.5 | 52.2 | 60.8 | 70.0 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 20 | 27 | 34 | 38 | 40 | 47 | 54 | 59 | 68 | 81 |
| ratio to table × scale | 1.10 | 0.98 | 1.08 | 0.90 | 0.93 | 0.91 | 0.92 | 0.88 | 0.89 | 0.86 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 28% / 11% | 43% / 46% | 29% / 44% | 182.8 | middle | early |
| all | 1–9 | 28% / 11% | 43% / 46% | 29% / 44% | 182.8 | middle | early |
| 1 | 1–13 | 29% / 12% | 42% / 45% | 29% / 43% | 255.0 | middle | late |
| all | 1–13 | 29% / 12% | 42% / 45% | 29% / 43% | 255.0 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 6.4 | 8.9 | 8.5 | 6.7 | 5.8 | 5.6 | 5.1 | 4.7 | 5.1 | 4.5 | 7.5 | 7.3 | 7.2 |
| launches read | 528 | 638 | 809 | 823 | 893 | 985 | 1151 | 1246 | 1408 | 1659 | 336 | 336 | 336 |

Slope over waves 1–10: -0.41 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | – | – | – |
| runs that reached it | 0 | 0 | 0 |
| tough, every run | 0.21 | 0.54 | 0.54 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 23 | 13 | 7 | 2 | 0 | 0 | 0 | 0 |
| **saves a run** | **0.0** | **0.1** | **0.1** | **0.0** | **0.0** | **0.1** | **0.1** | **0.1** | **0.5** | – | – | – | – |
| ships saved a run | 0.0 | 0.1 | 0.1 | 0.1 | 0.0 | 0.2 | 0.1 | 0.1 | 0.3 | – | – | – | – |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | – | – | – | – |
| clutch | 0.00 | 0.04 | 0.04 | 0.04 | 0.00 | 0.13 | 0.08 | 0.00 | 0.50 | – | – | – | – |
| runs with no save | 100% | 96% | 92% | 96% | 96% | 87% | 92% | 86% | 50% | – | – | – | – |
|   pickup save | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.14 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.04 | 0.08 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.50 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.27 | 0.59 | 0.80 | 0.78 | 1.00 | 1.69 | 1.63 | 1.59 | 1.78 | – | – | – | – |
| peaks | 0.0 | 0.3 | 0.8 | 0.6 | 1.1 | 2.3 | 2.0 | 2.4 | 2.5 | – | – | – | – |
| release after a peak (s) | 0.0 | 1.1 | 1.3 | 1.0 | 1.8 | 2.4 | 3.2 | 2.2 | 1.6 | – | – | – | – |
| hot share | 0% | 2% | 2% | 2% | 4% | 13% | 15% | 18% | 21% | – | – | – | – |
| calm share | 94% | 81% | 74% | 76% | 65% | 55% | 55% | 44% | 33% | – | – | – | – |
| shape (most runs) | flat 100% | flat 75% | one peak 50% | flat 50% | one peak 46% | one peak 39% | sawtooth rising 46% | sawtooth rising 43% | sawtooth rising 50% | – | – | – | – |
| taps follow tension (r) | 0.53 | 0.30 | 0.22 | 0.34 | 0.40 | 0.30 | 0.32 | 0.32 | 0.47 | – | – | – | – |

saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8. 24 runs, 249 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
