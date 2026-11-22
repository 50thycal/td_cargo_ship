# Bot report: The Rig Field (`rigs`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.7; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=rigs --seeds=24 --out=../beforerep/none`. Heat map: `../beforerep/none/rigs-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +4.38; doubles on w3 (0.04→1.29), w5 (1.88→4.83), w8 (3.92→8.29) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 4.46 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 42%, cold late 25% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 9.9 s → w10 4.0 s (slope -0.64 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 3.96 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 – (0), r2 – (0), r3 – (0); tough (every run): 0.25, 0.58, 0.54 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.2, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 3 loses 1.29 after 0.04; wave 5 loses 4.83 after 1.88; wave 8 loses 8.29 after 3.92. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (11.33 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 34%, middle 42%, late 25%.

## Ships lost per wave

Normal: won 0%, mean end wave 6.0 (14 = won), 6.1 lost in waves 1–10, 3.96 in waves 1–5. Tough: 42.2 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.04 | 1.29 | 1.88 | 4.83 | 3.29 | 3.92 | 8.29 | 7.33 | 11.33 | 0.25 | 0.58 | 0.54 |
| normal, runs that reached it | 0.00 | 0.04 | 1.29 | 1.25 | 1.65 | 2.00 | 1.43 | 2.40 | 1.00 | 2.00 | – | – | – |
| normal, mean over all runs | 0.00 | 0.04 | 1.29 | 1.25 | 1.38 | 1.00 | 0.42 | 0.50 | 0.13 | 0.08 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 20 | 12 | 7 | 5 | 3 | 1 | 0 | 0 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +4.38.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.2 | 2.0 | 2.8 | 2.4 | 2.4 | 2.6 | 2.2 | 2.2 | 2.1 | 1.9 | – | – | – |
| kills a minute | 42 | 39 | 41 | 42 | 42 | 42 | 42 | 41 | 41 | 48 | – | – | – |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.8 | 2.0 | 5.1 | 4.5 | 5.9 | 7.7 | 6.5 | 7.0 | 8.7 | 8.3 | 0.9 | 0.6 | 0.6 |
| runs with ≥ 1 | 75% | 92% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 50% | 46% | 50% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 27.0 | 30.0 | 41.3 | 41.9 | 42.8 | 47.9 | 49.9 | 46.5 | 53.9 | 59.8 |
| launches (encounters off) | 27.0 | 30.0 | 41.3 | 41.9 | 42.8 | 47.9 | 49.9 | 46.5 | 53.9 | 59.8 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 27 | 35 | 46 | 54 | 55 | 63 | 74 | 79 | 92 | 111 |
| ratio to table × scale | 1.00 | 0.86 | 0.90 | 0.78 | 0.78 | 0.76 | 0.67 | 0.59 | 0.59 | 0.54 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 34% / 11% | 42% / 50% | 25% / 38% | 213.4 | middle | late |
| all | 1–9 | 34% / 11% | 42% / 50% | 25% / 38% | 213.4 | middle | late |
| 1 | 1–13 | 34% / 13% | 41% / 50% | 25% / 37% | 295.3 | middle | late |
| all | 1–13 | 34% / 13% | 41% / 50% | 25% / 37% | 295.3 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.9 | 8.4 | 7.4 | 6.7 | 5.7 | 4.8 | 4.8 | 4.3 | 4.1 | 4.0 | 3.5 | 3.4 | 3.4 |
| launches read | 647 | 717 | 990 | 998 | 1027 | 1145 | 1193 | 1113 | 1292 | 1431 | 335 | 336 | 336 |

Slope over waves 1–10: -0.64 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | – | – | – |
| runs that reached it | 0 | 0 | 0 |
| tough, every run | 0.25 | 0.58 | 0.54 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 20 | 12 | 7 | 5 | 3 | 1 | 0 | 0 | 0 |
| **saves a run** | **0.0** | **0.0** | **0.4** | **0.3** | **0.1** | **0.4** | **0.4** | **0.6** | **0.7** | **0.0** | – | – | – |
| ships saved a run | 0.0 | 0.0 | 0.3 | 0.2 | 0.1 | 0.3 | 0.4 | 0.5 | 0.4 | 0.0 | – | – | – |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.60 | 0.33 | 0.00 | – | – | – |
| clutch | 0.00 | 0.00 | 0.21 | 0.21 | 0.05 | 0.25 | 0.29 | 0.40 | 0.67 | 0.00 | – | – | – |
| runs with no save | 96% | 100% | 71% | 75% | 95% | 75% | 71% | 60% | 33% | 100% | – | – | – |
|   pickup save | 0.00 | 0.00 | 0.21 | 0.08 | 0.05 | 0.17 | 0.00 | 0.20 | 0.33 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.04 | 0.00 | 0.04 | 0.04 | 0.05 | 0.08 | 0.14 | 0.40 | 0.33 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.13 | 0.13 | 0.00 | 0.08 | 0.29 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.40 | 0.54 | 1.24 | 1.16 | 1.15 | 1.61 | 1.13 | 1.97 | 1.14 | 1.25 | – | – | – |
| peaks | 0.0 | 0.2 | 1.6 | 1.2 | 0.9 | 1.3 | 2.3 | 3.2 | 2.0 | 2.0 | – | – | – |
| release after a peak (s) | 0.0 | 0.3 | 2.7 | 1.5 | 1.9 | 2.9 | 2.1 | 2.0 | 2.2 | 2.0 | – | – | – |
| hot share | 0% | 1% | 9% | 8% | 8% | 17% | 15% | 17% | 14% | 13% | – | – | – |
| calm share | 82% | 81% | 57% | 64% | 54% | 52% | 55% | 49% | 50% | 53% | – | – | – |
| shape (most runs) | flat 96% | flat 83% | one peak 42% | flat 38% | flat 40% | flat 25% | sawtooth 29% | sawtooth 40% | sawtooth 67% | sawtooth rising 100% | – | – | – |
| taps follow tension (r) | 0.18 | 0.15 | 0.14 | 0.14 | 0.20 | 0.25 | 0.34 | 0.26 | 0.44 | 0.20 | – | – | – |

saves a run: waves 1–7 0.2, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w10. 24 runs, 314 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
