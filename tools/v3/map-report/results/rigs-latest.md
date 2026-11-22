# Bot report: The Rig Field (`rigs`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.7; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=rigs --seeds=24 --armory=latest --kits=plan`. Heat map: `tools/v3/map-report/results/rigs-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w7 +0.62; doubles on w6 (0.33→0.71) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.33 a run (54% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w9 ×0.84 of the no-encounter wave; outside on w3 ×0.84, w9 ×0.84 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 34%, cold late 31% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 10.8 s → w10 5.8 s (slope -0.46 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.17 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.60 (10), r2 1.70 (10), r3 1.22 (9); tough (every run): 1.46, 1.79, 2.04 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 5.7 lost 1–10, end 12.0; off-counter 5.7 lost 1–10, end 11.4 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 6 loses 0.71 after 0.33. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 3 sends ×0.84 the no-encounter wave; wave 9 sends ×0.84 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest late takes 31%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.42 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 34%, middle 34%, late 31%.

## Ships lost per wave

Normal: won 29%, mean end wave 10.6 (14 = won), 4.9 lost in waves 1–10, 1.17 in waves 1–5. Tough: 6.9 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.21 | 0.25 | 0.38 | 0.33 | 0.71 | 1.33 | 1.04 | 1.25 | 1.42 | 1.46 | 1.79 | 2.04 |
| normal, runs that reached it | 0.00 | 0.21 | 0.25 | 0.39 | 0.35 | 0.57 | 1.09 | 0.86 | 1.00 | 0.93 | 1.60 | 1.70 | 1.22 |
| normal, mean over all runs | 0.00 | 0.21 | 0.25 | 0.38 | 0.33 | 0.54 | 1.00 | 0.75 | 0.83 | 0.58 | 0.67 | 0.71 | 0.46 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 23 | 23 | 23 | 22 | 21 | 20 | 15 | 10 | 10 | 9 |

Biggest one-wave step up (tough, waves 2–10): wave 7, +0.62.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.5 | 1.9 | 1.9 | 1.7 | 1.6 | 1.7 | 2.1 | 1.9 | 1.9 | 1.6 | 0.5 | 0.8 | 1.6 |
| kills a minute | 48 | 46 | 45 | 46 | 48 | 44 | 49 | 48 | 43 | 38 | 13 | 16 | 39 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.5 | 1.2 | 1.3 | 2.4 | 2.5 | 3.3 | 3.9 | 2.8 | 4.5 | 4.4 | 2.0 | 2.9 | 3.7 |
| runs with ≥ 1 | 42% | 79% | 54% | 92% | 75% | 92% | 96% | 88% | 100% | 100% | 96% | 96% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.5 | 28.5 | 34.5 | 37.4 | 36.7 | 41.2 | 45.3 | 44.4 | 45.0 | 51.6 |
| launches (encounters off) | 27.0 | 30.0 | 40.9 | 38.3 | 41.7 | 44.9 | 49.7 | 50.2 | 53.8 | 59.9 |
| **ratio to encounters off** | 0.91 | 0.95 | **0.84** | 0.98 | 0.88 | 0.92 | 0.91 | 0.88 | **0.84** | 0.86 |
| table × scale | 27 | 35 | 46 | 54 | 55 | 63 | 74 | 79 | 92 | 111 |
| ratio to table × scale | 0.91 | 0.81 | 0.75 | 0.69 | 0.67 | 0.65 | 0.61 | 0.56 | 0.49 | 0.47 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 34% / 20% | 34% / 45% | 31% / 34% | 45.8 | middle | late |
| all | 1–9 | 34% / 20% | 34% / 45% | 31% / 34% | 45.8 | middle | late |
| 1 | 1–13 | 28% / 13% | 48% / 63% | 24% / 24% | 78.8 | middle | late |
| all | 1–13 | 28% / 13% | 48% / 63% | 24% / 24% | 78.8 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.8 | 8.7 | 8.4 | 7.3 | 7.5 | 6.4 | 6.9 | 6.7 | 5.9 | 5.8 | 1.9 | 2.1 | 4.4 |
| launches read | 622 | 772 | 825 | 916 | 872 | 961 | 1063 | 1061 | 1040 | 1208 | 187 | 213 | 397 |

Slope over waves 1–10: -0.46 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.60 | 1.70 | 1.22 |
| runs that reached it | 10 | 10 | 9 |
| tough, every run | 1.46 | 1.79 | 2.04 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 23 | 23 | 23 | 22 | 21 | 20 | 15 | 10 | 10 | 9 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.0** | **0.1** | **0.1** | **0.2** | **0.2** | **0.3** | **0.4** | **0.3** | **0.6** | **0.6** |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.0 | 0.1 | 0.1 | 0.2 | 0.1 | 0.2 | 0.4 | 0.3 | 0.4 | 0.4 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.07 | 0.00 | 0.00 | 0.11 |
| clutch | 0.00 | 0.00 | 0.13 | 0.00 | 0.04 | 0.09 | 0.14 | 0.10 | 0.15 | 0.33 | 0.30 | 0.50 | 0.44 |
| runs with no save | 100% | 100% | 92% | 100% | 91% | 87% | 82% | 90% | 80% | 67% | 80% | 60% | 56% |
|   pickup save | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.04 | 0.05 | 0.05 | 0.00 | 0.20 | 0.10 | 0.00 | 0.11 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 | 0.00 | 0.11 |
|   last-second kill | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.05 | 0.13 | 0.10 | 0.30 | 0.11 |
|   kill save | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.09 | 0.14 | 0.05 | 0.20 | 0.07 | 0.10 | 0.30 | 0.22 |
| tension peak | 0.26 | 0.46 | 0.54 | 0.64 | 0.57 | 1.06 | 1.00 | 0.75 | 1.09 | 1.21 | 1.16 | 1.48 | 1.65 |
| peaks | 0.0 | 0.1 | 0.2 | 0.4 | 0.3 | 1.0 | 0.7 | 0.6 | 1.0 | 1.0 | 1.7 | 2.2 | 1.2 |
| release after a peak (s) | 0.0 | 0.3 | 0.2 | 0.8 | 1.0 | 1.9 | 1.3 | 1.0 | 1.8 | 2.0 | 1.5 | 1.7 | 1.7 |
| hot share | 0% | 0% | 1% | 1% | 1% | 4% | 4% | 3% | 7% | 7% | 11% | 20% | 19% |
| calm share | 94% | 87% | 86% | 84% | 85% | 76% | 78% | 82% | 74% | 75% | 75% | 64% | 65% |
| shape (most runs) | flat 100% | flat 92% | flat 87% | flat 65% | flat 74% | one peak 74% | one peak 45% | flat 62% | one peak 50% | one peak 60% | sawtooth 60% | sawtooth 50% | one peak 44% |
| taps follow tension (r) | 0.18 | 0.17 | 0.20 | 0.21 | 0.30 | 0.20 | 0.16 | 0.19 | 0.24 | 0.21 | 0.15 | 0.14 | 0.16 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 81 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | railgun, flak, orbital | 46% | 12.0 | 3.9 | 5.7 | 1.06 (16) / 1.75 (16) / 1.33 (15) | 0.0 0.2 0.0 0.3 0.3 0.5 1.0 0.8 1.1 1.5 |
| off-counter | seeker, shield, tesla | 46% | 11.4 | 4.2 | 5.7 | 0.77 (13) / 1.54 (13) / 1.67 (12) | 0.0 0.2 0.2 0.3 0.3 0.5 0.8 0.8 1.3 1.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
