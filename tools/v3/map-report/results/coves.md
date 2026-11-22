# Bot report: Smugglers' Coves (`coves`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.25; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=coves --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/coves-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +1.13; doubles on w5 (0.38→0.83), w6 (0.83→1.75) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.21 a run (67% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w7 ×0.72 of the no-encounter wave; outside on w6 ×0.81, w7 ×0.72 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 39%, cold early 24% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 7.7 s → w10 6.2 s (slope -0.29 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 2.08 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 – (0), r2 – (0), r3 – (0); tough (every run): 0.75, 1.96, 2.38 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 13.6 lost 1–10, end 7.4; off-counter 16.2 lost 1–10, end 7.1 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 5 loses 0.83 after 0.38; wave 6 loses 1.75 after 0.83. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 6 sends ×0.81 the no-encounter wave; wave 7 sends ×0.72 the no-encounter wave. Encounters should replace launches, not add them.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Fun (provisional): waves 8–10 and the boss rounds have no more saves than waves 1–7. The big moments should come late.
- Hardest of waves 1–10 for the bot: wave 10 (4.54 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 24%, middle 39%, late 37%.

## Ships lost per wave

Normal: won 0%, mean end wave 7.3 (14 = won), 5.5 lost in waves 1–10, 2.08 in waves 1–5, 0.17 in bonus waves. Tough: 16.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.38 | 0.50 | 0.38 | 0.83 | 1.75 | 1.63 | 2.75 | 3.54 | 4.54 | 0.75 | 1.96 | 2.38 |
| normal, runs that reached it | 0.00 | 0.38 | 0.50 | 0.38 | 0.83 | 1.54 | 1.13 | 1.11 | 1.83 | 6.00 | – | – | – |
| normal, mean over all runs | 0.00 | 0.38 | 0.50 | 0.38 | 0.83 | 1.54 | 0.75 | 0.42 | 0.46 | 0.25 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 16 | 9 | 6 | 1 | 0 | 0 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +1.13.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.4 | 2.6 | 2.6 | 1.8 | 2.2 | 2.2 | 1.6 | 2.8 | 3.0 | 2.5 | – | – | – |
| kills a minute | 45 | 39 | 46 | 41 | 40 | 33 | 33 | 47 | 43 | 50 | – | – | – |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.3 | 1.1 | 1.2 | 1.6 | 3.4 | 2.8 | 2.4 | 3.0 | 3.6 | 6.3 | 1.4 | 1.3 | 1.5 |
| runs with ≥ 1 | 25% | 63% | 67% | 75% | 96% | 96% | 96% | 88% | 96% | 96% | 88% | 67% | 63% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 23.3 | 25.7 | 33.3 | 34.0 | 36.3 | 34.7 | 35.9 | 48.3 | 52.9 | 68.4 |
| launches (encounters off) | 22.0 | 26.6 | 36.7 | 34.7 | 37.3 | 42.5 | 49.7 | 52.9 | 60.4 | 69.7 |
| **ratio to encounters off** | 1.06 | 0.97 | 0.91 | 0.98 | 0.97 | **0.81** | **0.72** | 0.91 | 0.88 | 0.98 |
| table × scale | 20 | 27 | 34 | 38 | 40 | 47 | 54 | 59 | 68 | 81 |
| ratio to table × scale | 1.16 | 0.95 | 0.98 | 0.89 | 0.91 | 0.74 | 0.66 | 0.82 | 0.78 | 0.84 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 24% / 18% | 39% / 40% | 37% / 42% | 74.5 | middle | early |
| all | 1–9 | 24% / 18% | 39% / 40% | 37% / 42% | 74.5 | middle | early |
| 1 | 1–13 | 20% / 13% | 47% / 50% | 33% / 37% | 119.2 | middle | early |
| all | 1–13 | 20% / 13% | 47% / 50% | 33% / 37% | 119.2 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.7 | 9.4 | 8.8 | 7.6 | 7.7 | 6.1 | 6.3 | 7.3 | 6.6 | 6.2 | 3.5 | 4.1 | 3.9 |
| launches read | 648 | 706 | 782 | 849 | 905 | 827 | 827 | 1152 | 1214 | 1619 | 168 | 216 | 192 |

Slope over waves 1–10: -0.29 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | – | – | – |
| runs that reached it | 0 | 0 | 0 |
| tough, every run | 0.75 | 1.96 | 2.38 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 16 | 9 | 6 | 1 | 0 | 0 | 0 |
| **saves a run** | **0.0** | **0.0** | **0.2** | **0.0** | **0.1** | **0.2** | **0.1** | **0.1** | **0.2** | **0.0** | – | – | – |
| ships saved a run | 0.0 | 0.0 | 0.2 | 0.0 | 0.1 | 0.1 | 0.1 | 0.1 | 0.2 | 0.0 | – | – | – |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.06 | 0.00 | 0.17 | 0.00 | – | – | – |
| clutch | 0.00 | 0.04 | 0.21 | 0.04 | 0.13 | 0.13 | 0.06 | 0.00 | 0.17 | 0.00 | – | – | – |
| runs with no save | 100% | 96% | 79% | 96% | 88% | 83% | 88% | 89% | 83% | 100% | – | – | – |
|   pickup save | 0.00 | 0.00 | 0.08 | 0.04 | 0.00 | 0.04 | 0.06 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.11 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.08 | 0.00 | 0.13 | 0.04 | 0.06 | 0.00 | 0.17 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.30 | 0.55 | 0.67 | 0.74 | 0.92 | 1.06 | 0.91 | 0.84 | 1.45 | 1.60 | – | – | – |
| peaks | 0.0 | 0.2 | 0.3 | 0.6 | 0.8 | 1.2 | 0.8 | 0.6 | 1.5 | 3.0 | – | – | – |
| release after a peak (s) | 0.1 | 0.3 | 0.8 | 0.9 | 1.7 | 2.1 | 1.3 | 1.3 | 1.8 | 3.3 | – | – | – |
| hot share | 0% | 1% | 2% | 1% | 4% | 5% | 5% | 5% | 9% | 14% | – | – | – |
| calm share | 91% | 83% | 77% | 83% | 73% | 68% | 77% | 74% | 64% | 68% | – | – | – |
| shape (most runs) | flat 96% | flat 87% | flat 71% | flat 50% | one peak 42% | one peak 46% | one peak 69% | flat 56% | one peak 67% | sawtooth rising 100% | – | – | – |
| taps follow tension (r) | 0.42 | 0.26 | 0.29 | 0.32 | 0.33 | 0.24 | 0.37 | 0.24 | 0.32 | 0.25 | – | – | – |

saves a run: waves 1–7 0.1, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 52 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | orbital, frigate, gunships | 0% | 7.4 | 5.2 | 13.6 | – (0) / – (0) / – (0) | 0.0 0.4 0.6 0.3 0.8 1.3 1.3 2.3 3.3 3.5 |
| off-counter | tesla, fullSteam, seeker | 0% | 7.1 | 5.0 | 16.2 | – (0) / – (0) / – (0) | 0.0 0.5 0.7 0.5 1.0 1.6 1.7 2.7 3.2 4.4 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
