# Bot report: Smugglers' Coves (`coves`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.25; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=coves --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/coves-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +1.50; doubles on w5 (0.38→0.83), w6 (0.83→1.75) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.21 a run (67% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w9 ×0.86 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 39%, cold early 25% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 7.7 s → w10 6.3 s (slope -0.26 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 2.08 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (1), r2 1.00 (1), r3 2.00 (1); tough (every run): 1.17, 2.29, 2.25 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.5; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 14.5 lost 1–10, end 7.5; off-counter 15.2 lost 1–10, end 7.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 5 loses 0.83 after 0.38; wave 6 loses 1.75 after 0.83. Move budget from it to the wave before, or soften its biggest raid.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (3.96 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 25%, middle 39%, late 37%.

## Ships lost per wave

Normal: won 4%, mean end wave 7.5 (14 = won), 5.5 lost in waves 1–10, 2.08 in waves 1–5, 0.17 in bonus waves. Tough: 14.8 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.38 | 0.50 | 0.38 | 0.83 | 1.75 | 1.83 | 2.67 | 2.46 | 3.96 | 1.17 | 2.29 | 2.25 |
| normal, runs that reached it | 0.00 | 0.38 | 0.50 | 0.38 | 0.83 | 1.54 | 1.20 | 2.10 | 1.25 | 0.50 | 0.00 | 1.00 | 2.00 |
| normal, mean over all runs | 0.00 | 0.38 | 0.50 | 0.38 | 0.83 | 1.54 | 0.75 | 0.88 | 0.21 | 0.04 | 0.00 | 0.04 | 0.08 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 15 | 10 | 4 | 2 | 1 | 1 | 1 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +1.50.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.4 | 2.6 | 2.6 | 1.8 | 2.2 | 2.4 | 2.6 | 2.9 | 2.4 | 3.4 | 0.5 | 1.2 | 1.0 |
| kills a minute | 45 | 39 | 46 | 41 | 40 | 37 | 45 | 43 | 40 | 57 | 16 | 26 | 11 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 1.1 | 1.2 | 1.6 | 3.4 | 2.8 | 3.7 | 2.8 | 3.3 | 5.0 | 0.8 | 1.6 | 1.9 |
| runs with ≥ 1 | 25% | 63% | 67% | 75% | 96% | 88% | 96% | 96% | 100% | 100% | 58% | 83% | 83% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 23.3 | 25.7 | 33.3 | 34.0 | 36.3 | 38.7 | 45.2 | 48.5 | 52.2 | 67.5 |
| launches (encounters off) | 22.0 | 26.6 | 36.7 | 34.7 | 37.3 | 42.5 | 49.7 | 52.9 | 60.4 | 69.7 |
| **ratio to encounters off** | 1.06 | 0.97 | 0.91 | 0.98 | 0.97 | 0.91 | 0.91 | 0.92 | 0.86 | 0.97 |
| table × scale | 20 | 27 | 34 | 38 | 40 | 47 | 54 | 59 | 68 | 81 |
| ratio to table × scale | 1.16 | 0.95 | 0.98 | 0.89 | 0.91 | 0.82 | 0.84 | 0.82 | 0.77 | 0.83 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 25% / 18% | 39% / 41% | 37% / 42% | 72.1 | middle | early |
| all | 1–9 | 25% / 18% | 39% / 41% | 37% / 42% | 72.1 | middle | early |
| 1 | 1–13 | 21% / 14% | 47% / 51% | 33% / 35% | 117.2 | middle | early |
| all | 1–13 | 21% / 14% | 47% / 51% | 33% / 35% | 117.2 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.7 | 9.4 | 8.8 | 7.6 | 7.7 | 6.7 | 7.0 | 7.3 | 6.6 | 6.3 | 3.6 | 4.2 | 4.0 |
| launches read | 648 | 706 | 782 | 849 | 905 | 924 | 1051 | 1155 | 1194 | 1603 | 168 | 216 | 192 |

Slope over waves 1–10: -0.26 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 1.00 | 2.00 |
| runs that reached it | 1 | 1 | 1 |
| tough, every run | 1.17 | 2.29 | 2.25 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 15 | 10 | 4 | 2 | 1 | 1 | 1 |
| **saves a run** | **0.0** | **0.0** | **0.2** | **0.0** | **0.1** | **0.0** | **0.3** | **0.0** | **0.0** | **1.0** | **0.0** | **1.0** | **1.0** |
| ships saved a run | 0.0 | 0.0 | 0.2 | 0.0 | 0.1 | 0.0 | 0.2 | 0.0 | 0.0 | 0.7 | 0.0 | 1.0 | 0.7 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.27 | 0.00 | 0.00 | 1.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.04 | 0.21 | 0.04 | 0.13 | 0.04 | 0.27 | 0.00 | 0.00 | 1.00 | 0.00 | 1.00 | 1.00 |
| runs with no save | 100% | 96% | 79% | 96% | 88% | 96% | 73% | 100% | 100% | 50% | 100% | 0% | 0% |
|   pickup save | 0.00 | 0.00 | 0.08 | 0.04 | 0.00 | 0.00 | 0.13 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.07 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 1.00 |
|   last-second kill | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.00 | 0.13 | 0.00 | 0.00 | 0.00 | 0.00 | 1.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.08 | 0.00 | 0.13 | 0.04 | 0.00 | 0.00 | 0.00 | 1.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.30 | 0.55 | 0.67 | 0.74 | 0.92 | 1.10 | 0.95 | 1.45 | 1.32 | 1.19 | 0.46 | 0.99 | 1.38 |
| peaks | 0.0 | 0.2 | 0.3 | 0.6 | 0.8 | 1.3 | 0.9 | 1.0 | 0.5 | 0.5 | 0.0 | 1.0 | 2.0 |
| release after a peak (s) | 0.1 | 0.3 | 0.8 | 0.9 | 1.7 | 1.9 | 3.1 | 2.5 | 1.3 | 0.5 | 0.0 | 2.0 | 2.0 |
| hot share | 0% | 1% | 2% | 1% | 4% | 7% | 6% | 11% | 7% | 14% | 0% | 6% | 18% |
| calm share | 91% | 83% | 77% | 83% | 73% | 72% | 73% | 71% | 72% | 66% | 70% | 53% | 64% |
| shape (most runs) | flat 96% | flat 87% | flat 71% | flat 50% | one peak 42% | one peak 46% | one peak 73% | one peak 80% | flat 50% | flat 50% | flat 100% | one peak 100% | sawtooth rising 100% |
| taps follow tension (r) | 0.42 | 0.26 | 0.29 | 0.32 | 0.33 | 0.30 | 0.26 | 0.24 | 0.11 | 0.25 | 0.86 | 0.64 | 0.75 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.5; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9. 24 runs, 53 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | orbital, frigate, gunships | 0% | 7.5 | 5.1 | 14.5 | 2.00 (2) / 2.00 (2) / 2.00 (2) | 0.0 0.4 0.6 0.3 0.8 1.6 1.8 2.4 3.2 3.3 |
| off-counter | tesla, fullSteam, seeker | 4% | 7.5 | 5.1 | 15.2 | 0.50 (2) / 2.50 (2) / 1.50 (2) | 0.0 0.5 0.7 0.5 1.0 1.6 1.3 3.0 2.7 4.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
