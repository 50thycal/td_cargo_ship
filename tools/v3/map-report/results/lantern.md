# Bot report: The Black Strait (`lantern`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.45; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=lantern --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/lantern-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +1.79; doubles on w4 (0.25→0.71) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 1.29 a run (67% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w6 ×0.84 of the no-encounter wave; outside on w6 ×0.84, w7 ×0.84 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 41%, cold early 23% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 12.0 s → w10 5.3 s (slope -0.54 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.08 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 2.63 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 – (0), r2 – (0), r3 – (0); tough (every run): 1.04, 1.58, 2.75 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.2, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w8, w9 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 18.4 lost 1–10, end 7.0; off-counter 19.6 lost 1–10, end 7.6 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 4 loses 0.71 after 0.25. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 6 sends ×0.84 the no-encounter wave; wave 7 sends ×0.84 the no-encounter wave. Encounters should replace launches, not add them.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 8, 9. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (4.83 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 23%, middle 41%, late 36%.

## Ships lost per wave

Normal: won 0%, mean end wave 7.1 (14 = won), 6.0 lost in waves 1–10, 2.63 in waves 1–5. Tough: 19.9 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.08 | 0.25 | 0.25 | 0.71 | 1.33 | 2.38 | 2.63 | 4.42 | 4.83 | 3.04 | 1.04 | 1.58 | 2.75 |
| normal, runs that reached it | 0.08 | 0.25 | 0.25 | 0.71 | 1.33 | 1.95 | 1.53 | 1.00 | 1.33 | 4.00 | – | – | – |
| normal, mean over all runs | 0.08 | 0.25 | 0.25 | 0.71 | 1.33 | 1.71 | 0.96 | 0.42 | 0.17 | 0.17 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 21 | 15 | 10 | 3 | 1 | 0 | 0 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +1.79.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.9 | 1.9 | 2.2 | 1.9 | 2.2 | 2.1 | 1.9 | 2.2 | 1.6 | 2.3 | – | – | – |
| kills a minute | 46 | 38 | 44 | 41 | 39 | 35 | 37 | 39 | 41 | 37 | – | – | – |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.8 | 0.6 | 2.1 | 1.3 | 2.2 | 3.3 | 2.3 | 3.6 | 3.4 | 5.0 | 0.3 | 0.5 | 0.4 |
| runs with ≥ 1 | 46% | 46% | 92% | 67% | 83% | 100% | 92% | 100% | 96% | 96% | 29% | 46% | 17% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 24.3 | 24.7 | 33.0 | 33.3 | 35.3 | 35.1 | 39.8 | 44.9 | 48.8 | 55.9 |
| launches (encounters off) | 23.0 | 26.5 | 35.3 | 37.7 | 40.8 | 42.0 | 47.2 | 50.6 | 55.2 | 65.6 |
| **ratio to encounters off** | 1.05 | 0.93 | 0.94 | 0.88 | 0.87 | **0.84** | **0.84** | 0.89 | 0.88 | 0.85 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.05 | 0.80 | 0.85 | 0.76 | 0.77 | 0.66 | 0.64 | 0.66 | 0.63 | 0.59 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 23% / 9% | 41% / 45% | 36% / 46% | 105.5 | middle | early |
| all | 1–9 | 23% / 9% | 41% / 45% | 36% / 46% | 105.5 | middle | early |
| 1 | 1–13 | 26% / 15% | 38% / 43% | 36% / 42% | 176.8 | middle | early |
| all | 1–13 | 26% / 15% | 38% / 43% | 36% / 42% | 176.8 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 12.0 | 9.1 | 7.9 | 7.6 | 7.4 | 5.8 | 6.0 | 6.1 | 7.1 | 5.3 | 6.1 | 5.8 | 5.4 |
| launches read | 672 | 681 | 845 | 831 | 882 | 879 | 952 | 1078 | 1172 | 1335 | 478 | 521 | 551 |

Slope over waves 1–10: -0.54 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | – | – | – |
| runs that reached it | 0 | 0 | 0 |
| tough, every run | 1.04 | 1.58 | 2.75 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 21 | 15 | 10 | 3 | 1 | 0 | 0 | 0 |
| **saves a run** | **0.0** | **0.1** | **0.0** | **0.0** | **0.3** | **0.4** | **0.5** | **0.3** | **0.0** | **1.0** | – | – | – |
| ships saved a run | 0.0 | 0.1 | 0.0 | 0.0 | 0.2 | 0.3 | 0.5 | 0.2 | 0.0 | 0.7 | – | – | – |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.07 | 0.20 | 0.00 | 1.00 | – | – | – |
| clutch | 0.04 | 0.08 | 0.00 | 0.00 | 0.13 | 0.29 | 0.13 | 0.20 | 0.00 | 1.00 | – | – | – |
| runs with no save | 96% | 92% | 100% | 100% | 75% | 67% | 73% | 70% | 100% | 0% | – | – | – |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.05 | 0.07 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.07 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.10 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.13 | 0.00 | 0.00 | 0.13 | 0.29 | 0.40 | 0.20 | 0.00 | 1.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.32 | 0.44 | 1.06 | 0.65 | 1.23 | 1.24 | 1.15 | 0.92 | 0.55 | 2.01 | – | – | – |
| peaks | 0.1 | 0.0 | 1.0 | 0.3 | 1.3 | 1.6 | 1.0 | 1.3 | 1.0 | 3.0 | – | – | – |
| release after a peak (s) | 0.3 | 0.1 | 2.2 | 0.8 | 1.8 | 2.5 | 1.5 | 1.7 | 0.7 | 3.3 | – | – | – |
| hot share | 0% | 0% | 5% | 2% | 6% | 7% | 5% | 5% | 4% | 11% | – | – | – |
| calm share | 87% | 88% | 77% | 83% | 75% | 67% | 73% | 72% | 83% | 60% | – | – | – |
| shape (most runs) | flat 87% | flat 96% | one peak 62% | flat 75% | one peak 42% | one peak 43% | one peak 47% | one peak 40% | flat 67% | sawtooth rising 100% | – | – | – |
| taps follow tension (r) | 0.30 | 0.36 | 0.31 | 0.43 | 0.40 | 0.32 | 0.38 | 0.47 | 0.65 | 0.33 | – | – | – |

saves a run: waves 1–7 0.2, 8–10 + boss 0.4; flat (under 0.5) w1, w2, w3, w4, w5, w6, w8, w9. 24 runs, 60 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | scatter, gunships, shield | 0% | 7.0 | 6.1 | 18.4 | – (0) / – (0) / – (0) | 0.1 0.3 0.3 0.6 1.3 2.4 2.2 4.5 3.2 3.7 |
| off-counter | seeker, tesla, fullSteam | 0% | 7.6 | 6.0 | 19.6 | – (0) / – (0) / – (0) | 0.1 0.3 0.3 0.5 1.1 2.3 2.0 3.5 5.3 4.3 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
