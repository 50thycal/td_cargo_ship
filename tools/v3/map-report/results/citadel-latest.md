# Bot report: Citadel of Vey (`citadel`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's latest ({"warhead":5,"pointdef":4,"drops":3}); threat scale 1.25; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=citadel --seeds=24 --armory=latest --kits=plan`. Heat map: `tools/v3/map-report/results/citadel-latest-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w6 +0.67; doubles on w6 (0.38→1.04) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 1.25 a run (67% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w4 ×0.85 of the no-encounter wave; outside on w4 ×0.85 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 52%, cold early 20% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.0 s → w10 5.9 s (slope -0.30 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 1.08 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (2), r2 2.50 (2), r3 3.50 (2); tough (every run): 0.67, 2.50, 4.17 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 8.4 lost 1–10, end 9.3; off-counter 8.6 lost 1–10, end 9.5 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 6 loses 1.04 after 0.38. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 4 sends ×0.85 the no-encounter wave. Encounters should replace launches, not add them.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.92 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 20%, middle 28%, late 52%.

## Ships lost per wave

Normal: won 0%, mean end wave 9.2 (14 = won), 5.8 lost in waves 1–10, 1.08 in waves 1–5, 0.04 in bonus waves. Tough: 8.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.38 | 0.25 | 0.08 | 0.38 | 1.04 | 0.96 | 1.50 | 1.75 | 1.92 | 0.67 | 2.50 | 4.17 |
| normal, runs that reached it | 0.00 | 0.38 | 0.25 | 0.08 | 0.38 | 0.83 | 0.86 | 1.57 | 1.35 | 1.90 | 0.00 | 2.50 | 3.50 |
| normal, mean over all runs | 0.00 | 0.38 | 0.25 | 0.08 | 0.38 | 0.83 | 0.79 | 1.38 | 0.96 | 0.79 | 0.00 | 0.21 | 0.29 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 21 | 17 | 10 | 2 | 2 | 2 |

Biggest one-wave step up (tough, waves 2–10): wave 6, +0.67.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.6 | 2.4 | 1.5 | 1.4 | 1.4 | 2.0 | 2.0 | 2.3 | 2.1 | 2.0 | 0.6 | 1.3 | 1.6 |
| kills a minute | 53 | 41 | 46 | 49 | 47 | 44 | 50 | 51 | 51 | 50 | 16 | 24 | 20 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.0 | 1.2 | 1.3 | 1.5 | 2.8 | 2.3 | 3.3 | 4.0 | 4.2 | 5.5 | 1.6 | 1.8 | 2.5 |
| runs with ≥ 1 | 0% | 75% | 67% | 75% | 100% | 83% | 88% | 92% | 96% | 100% | 92% | 92% | 92% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 21.3 | 22.0 | 27.6 | 30.4 | 34.5 | 37.5 | 45.2 | 46.9 | 52.0 | 59.0 |
| launches (encounters off) | 20.0 | 24.3 | 32.4 | 35.8 | 38.3 | 43.7 | 48.6 | 53.4 | 60.5 | 69.4 |
| **ratio to encounters off** | 1.06 | 0.90 | 0.85 | **0.85** | 0.90 | 0.86 | 0.93 | 0.88 | 0.86 | 0.85 |
| table × scale | 20 | 27 | 34 | 38 | 40 | 47 | 54 | 59 | 68 | 81 |
| ratio to table × scale | 1.06 | 0.81 | 0.81 | 0.80 | 0.86 | 0.80 | 0.84 | 0.80 | 0.76 | 0.73 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 20% / 14% | 28% / 28% | 52% / 58% | 57.0 | late | early |
| all | 1–9 | 20% / 14% | 28% / 28% | 52% / 58% | 57.0 | late | early |
| 1 | 1–13 | 15% / 8% | 26% / 23% | 59% / 69% | 102.1 | late | early |
| all | 1–13 | 15% / 8% | 26% / 23% | 59% / 69% | 102.1 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.0 | 9.1 | 7.9 | 8.3 | 6.8 | 7.6 | 7.0 | 6.6 | 6.2 | 5.9 | 2.5 | 2.2 | 2.3 |
| launches read | 600 | 616 | 712 | 761 | 859 | 933 | 1055 | 1112 | 1195 | 1389 | 216 | 381 | 408 |

Slope over waves 1–10: -0.30 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 2.50 | 3.50 |
| runs that reached it | 2 | 2 | 2 |
| tough, every run | 0.67 | 2.50 | 4.17 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 21 | 17 | 10 | 2 | 2 | 2 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.3** | **0.1** | **0.2** | **0.2** | **0.1** | **0.0** | **0.0** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.2 | 0.1 | 0.1 | 0.2 | 0.1 | 0.0 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.06 | 0.10 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.21 | 0.09 | 0.14 | 0.18 | 0.00 | 0.00 | 0.00 | 0.00 |
| runs with no save | 100% | 96% | 100% | 100% | 100% | 79% | 91% | 81% | 76% | 90% | 100% | 100% | 100% |
|   pickup save | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.08 | 0.05 | 0.10 | 0.12 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.05 | 0.06 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.05 | 0.05 | 0.06 | 0.10 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.13 | 0.61 | 0.77 | 0.48 | 0.71 | 0.89 | 1.02 | 0.98 | 1.09 | 1.30 | 1.31 | 1.69 | 1.71 |
| peaks | 0.0 | 0.3 | 0.4 | 0.1 | 0.5 | 0.5 | 1.1 | 1.0 | 1.5 | 1.3 | 1.5 | 3.0 | 2.0 |
| release after a peak (s) | 0.0 | 0.7 | 0.9 | 0.2 | 0.9 | 0.7 | 1.8 | 1.1 | 1.6 | 2.1 | 1.3 | 1.0 | 2.8 |
| hot share | 0% | 1% | 1% | 0% | 1% | 2% | 4% | 4% | 5% | 7% | 10% | 25% | 31% |
| calm share | 99% | 82% | 86% | 90% | 80% | 82% | 78% | 74% | 72% | 78% | 80% | 60% | 53% |
| shape (most runs) | flat 100% | flat 71% | flat 62% | flat 92% | flat 58% | flat 58% | one peak 64% | flat 43% | one peak 47% | one peak 60% | one peak 50% | sawtooth rising 100% | sawtooth rising 50% |
| taps follow tension (r) | 0.20 | 0.06 | 0.11 | 0.12 | 0.08 | 0.11 | 0.14 | 0.13 | 0.05 | 0.14 | 0.13 | -0.16 | 0.34 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 197 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | gunships, aegis, flak | 4% | 9.3 | 5.5 | 8.4 | 0.00 (3) / 2.33 (3) / 3.33 (3) | 0.0 0.4 0.2 0.1 0.4 0.8 1.0 1.5 2.0 2.1 |
| off-counter | thermo, seeker, tesla | 0% | 9.5 | 5.7 | 8.6 | 0.20 (5) / 2.80 (5) / 3.00 (5) | 0.0 0.4 0.3 0.1 0.4 1.2 1.2 1.6 1.5 2.0 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
