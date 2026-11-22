# Bot report: Tidewater Flats (`tide`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.4; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=tide --seeds=24 --armory=plating --kits=plan`. Heat map: `tools/v3/map-report/results/tide-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w9 +0.50; doubles on w9 (0.25→0.75) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 1.96 a run (75% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×0.86 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 45%, cold early 26%; lane 2: hot late 42%, cold early 26% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 10.0 s → w10 5.5 s (slope -0.40 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.08 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.30 (20), r2 1.40 (20), r3 1.11 (19); tough (every run): 0.29, 1.33, 1.00 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 2.3 lost 1–10, end 13.7; counter 2.7 lost 1–10, end 13.4 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 9 loses 0.75 after 0.25. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest early takes 26%), lane 2 (coldest early takes 26%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (1.17 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 26%, middle 30%, late 44%.

## Ships lost per wave

Normal: won 79%, mean end wave 13.2 (14 = won), 2.1 lost in waves 1–10, 0.08 in waves 1–5. Tough: 2.7 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.21 | 0.25 | 0.25 | 0.75 | 1.17 | 0.29 | 1.33 | 1.00 |
| normal, runs that reached it | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.21 | 0.25 | 0.25 | 0.58 | 0.74 | 0.30 | 1.40 | 1.11 |
| normal, mean over all runs | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.21 | 0.25 | 0.25 | 0.58 | 0.71 | 0.25 | 1.17 | 0.88 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 20 | 19 |

Biggest one-wave step up (tough, waves 2–10): wave 9, +0.50.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.2 | 1.5 | 2.2 | 1.8 | 1.8 | 1.8 | 2.0 | 2.1 | 2.4 | 2.2 | 0.6 | 2.0 | 1.7 |
| kills a minute | 50 | 43 | 49 | 47 | 44 | 44 | 50 | 49 | 54 | 54 | 9 | 30 | 32 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.7 | 3.1 | 3.7 | 2.0 | 3.5 | 3.5 | 3.5 | 3.8 | 4.5 | 4.5 | 2.7 | 4.2 | 3.3 |
| runs with ≥ 1 | 79% | 100% | 96% | 75% | 100% | 96% | 83% | 100% | 100% | 96% | 92% | 100% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 23.3 | 24.7 | 33.7 | 34.8 | 35.1 | 38.4 | 45.2 | 49.1 | 54.1 | 58.5 |
| launches (encounters off) | 22.0 | 26.4 | 36.6 | 39.5 | 39.4 | 44.6 | 47.0 | 49.3 | 58.6 | 68.1 |
| **ratio to encounters off** | 1.06 | 0.94 | 0.92 | 0.88 | 0.89 | 0.86 | 0.96 | 1.00 | 0.92 | 0.86 |
| table × scale | 22 | 30 | 38 | 43 | 45 | 52 | 60 | 66 | 76 | 91 |
| ratio to table × scale | 1.06 | 0.82 | 0.89 | 0.81 | 0.78 | 0.74 | 0.75 | 0.74 | 0.71 | 0.64 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 26% / 0% | 30% / 33% | 45% / 67% | 28.1 | late | early |
| 2 | 1–9 | 26% / 10% | 32% / 40% | 42% / 50% | 9.3 | late | early |
| all | 1–9 | 26% / 3% | 30% / 35% | 44% / 62% | 37.3 | late | early |
| 1 | 1–13 | 16% / 1% | 29% / 16% | 54% / 83% | 49.0 | late | early |
| 2 | 1–13 | 16% / 3% | 26% / 15% | 58% / 82% | 18.7 | late | early |
| all | 1–13 | 16% / 2% | 28% / 16% | 55% / 83% | 67.8 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 10.0 | 7.9 | 7.9 | 7.8 | 6.5 | 6.7 | 6.6 | 5.6 | 6.4 | 5.5 | 2.0 | 4.5 | 4.6 |
| launches read | 648 | 681 | 861 | 870 | 877 | 954 | 1080 | 1171 | 1289 | 1391 | 168 | 456 | 502 |

Slope over waves 1–10: -0.40 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.30 | 1.40 | 1.11 |
| runs that reached it | 20 | 20 | 19 |
| tough, every run | 0.29 | 1.33 | 1.00 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 20 | 19 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.1** | **0.0** | **0.3** | **0.1** | **0.3** | **0.1** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.0 | 0.2 | 0.1 | 0.2 | 0.1 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.13 | 0.15 | 0.05 | 0.05 |
| runs with no save | 100% | 100% | 96% | 100% | 100% | 96% | 92% | 92% | 96% | 78% | 90% | 75% | 95% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.05 | 0.05 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.05 | 0.00 | 0.05 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.08 | 0.08 | 0.04 | 0.26 | 0.05 | 0.20 | 0.00 |
| tension peak | 0.43 | 0.36 | 0.75 | 0.65 | 0.68 | 0.84 | 0.78 | 0.82 | 1.01 | 1.60 | 1.17 | 1.55 | 1.55 |
| peaks | 0.1 | 0.0 | 0.5 | 0.3 | 0.3 | 0.6 | 0.5 | 0.7 | 0.9 | 1.0 | 1.1 | 2.3 | 1.6 |
| release after a peak (s) | 0.1 | 0.0 | 0.8 | 0.3 | 0.4 | 1.0 | 0.9 | 1.1 | 1.8 | 3.5 | 1.9 | 2.7 | 2.2 |
| hot share | 0% | 0% | 2% | 1% | 1% | 2% | 2% | 3% | 4% | 7% | 8% | 22% | 15% |
| calm share | 90% | 88% | 78% | 84% | 80% | 78% | 79% | 75% | 74% | 76% | 73% | 53% | 66% |
| shape (most runs) | flat 92% | flat 96% | flat 62% | flat 75% | flat 71% | flat 50% | flat 54% | flat 54% | one peak 42% | one peak 78% | one peak 65% | sawtooth 60% | sawtooth 58% |
| taps follow tension (r) | 0.34 | 0.36 | 0.43 | 0.30 | 0.35 | 0.36 | 0.34 | 0.38 | 0.33 | 0.35 | 0.68 | 0.48 | 0.47 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 257 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | well, aegis, bomberWing | 83% | 13.4 | 2.1 | 2.7 | 0.19 (21) / 1.52 (21) / 1.05 (20) | 0.0 0.0 0.0 0.0 0.0 0.3 0.2 0.3 0.8 1.2 |
| off-counter | tesla, grapnel, fullSteam | 88% | 13.7 | 2.2 | 2.3 | 0.35 (23) / 1.22 (23) / 1.05 (22) | 0.0 0.0 0.2 0.0 0.1 0.4 0.2 0.4 0.3 0.8 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
