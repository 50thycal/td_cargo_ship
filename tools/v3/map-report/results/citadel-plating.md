# Bot report: Citadel of Vey (`citadel`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's plating set ({"reload":5,"plating":5,"magazine":4}); threat scale 1.25; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=citadel --seeds=24 --armory=plating --kits=plan`. Heat map: `tools/v3/map-report/results/citadel-plating-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +0.63; doubles on w8 (0.33→0.96) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 0.83 a run (42% of runs have one); under 1 on w4 | ≥ 1 a run on every wave 3–10 | tough | **FLAG** |
| `w-budget` | Wave budgets ±15% | furthest w9 ×0.86 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 46%, cold early 18% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.0 s → w10 6.0 s (slope -0.29 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.25 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.27 (22), r2 0.91 (22), r3 1.82 (22); tough (every run): 0.25, 0.96, 2.00 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | off-counter 3.1 lost 1–10, end 13.5; counter 3.2 lost 1–10, end 13.7 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 8 loses 0.96 after 0.33. Move budget from it to the wave before, or soften its biggest raid.
- Too few close calls on wave 4 (0.83): give those waves a launch from a near site, or one aimed at the danger stretch.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 8 (0.96 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 18%, middle 35%, late 46%.

## Ships lost per wave

Normal: won 83%, mean end wave 13.5 (14 = won), 3.0 lost in waves 1–10, 0.25 in waves 1–5. Tough: 3.2 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.08 | 0.00 | 0.13 | 0.04 | 0.50 | 0.33 | 0.96 | 0.42 | 0.79 | 0.25 | 0.96 | 2.00 |
| normal, runs that reached it | 0.00 | 0.08 | 0.00 | 0.13 | 0.04 | 0.50 | 0.33 | 0.79 | 0.39 | 0.77 | 0.27 | 0.91 | 1.82 |
| normal, mean over all runs | 0.00 | 0.08 | 0.00 | 0.13 | 0.04 | 0.50 | 0.33 | 0.79 | 0.38 | 0.71 | 0.25 | 0.83 | 1.67 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 22 | 22 | 22 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +0.63.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.9 | 1.8 | 1.5 | 1.7 | 1.7 | 2.0 | 2.1 | 2.4 | 2.0 | 2.1 | 0.7 | 1.3 | 1.4 |
| kills a minute | 53 | 45 | 47 | 47 | 47 | 44 | 50 | 50 | 52 | 50 | 16 | 21 | 28 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 1.2 | 1.6 | 0.8 | 3.5 | 1.3 | 2.6 | 3.1 | 2.9 | 5.5 | 1.7 | 2.0 | 2.8 |
| runs with ≥ 1 | 8% | 75% | 88% | 42% | 96% | 83% | 88% | 92% | 92% | 100% | 92% | 88% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 21.3 | 22.0 | 27.6 | 30.3 | 34.8 | 37.8 | 45.7 | 47.3 | 51.4 | 59.3 |
| launches (encounters off) | 20.0 | 24.3 | 31.3 | 35.0 | 37.9 | 44.0 | 49.5 | 53.5 | 60.0 | 68.8 |
| **ratio to encounters off** | 1.06 | 0.90 | 0.88 | 0.86 | 0.92 | 0.86 | 0.92 | 0.88 | 0.86 | 0.86 |
| table × scale | 20 | 27 | 34 | 38 | 40 | 47 | 54 | 59 | 68 | 81 |
| ratio to table × scale | 1.06 | 0.81 | 0.81 | 0.80 | 0.87 | 0.80 | 0.85 | 0.80 | 0.76 | 0.73 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 18% / 10% | 35% / 41% | 46% / 49% | 36.4 | late | early |
| all | 1–9 | 18% / 10% | 35% / 41% | 46% / 49% | 36.4 | late | early |
| 1 | 1–13 | 14% / 5% | 30% / 26% | 56% / 70% | 66.5 | late | early |
| all | 1–13 | 14% / 5% | 30% / 26% | 56% / 70% | 66.5 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.0 | 9.1 | 7.9 | 8.5 | 6.9 | 7.5 | 7.1 | 6.6 | 6.3 | 6.0 | 2.5 | 2.2 | 2.3 |
| launches read | 600 | 617 | 711 | 759 | 867 | 941 | 1065 | 1116 | 1183 | 1389 | 216 | 381 | 402 |

Slope over waves 1–10: -0.29 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.27 | 0.91 | 1.82 |
| runs that reached it | 22 | 22 | 22 |
| tough, every run | 0.25 | 0.96 | 2.00 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 22 | 22 | 22 | 22 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.2** | **0.1** | **0.3** | **0.0** | **0.1** | **0.2** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.2 | 0.1 | 0.2 | 0.0 | 0.1 | 0.2 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.05 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.13 | 0.13 | 0.18 | 0.00 | 0.05 | 0.09 |
| runs with no save | 100% | 96% | 100% | 96% | 96% | 96% | 92% | 83% | 87% | 73% | 95% | 91% | 82% |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.04 | 0.04 | 0.09 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.04 | 0.09 | 0.00 | 0.05 | 0.05 | 0.05 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.05 | 0.00 | 0.05 | 0.00 |
|   kill save | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.00 | 0.18 | 0.00 | 0.00 | 0.14 |
| tension peak | 0.13 | 0.32 | 0.55 | 0.48 | 0.71 | 0.66 | 0.88 | 0.98 | 0.84 | 1.21 | 1.14 | 1.41 | 1.38 |
| peaks | 0.0 | 0.0 | 0.2 | 0.1 | 0.5 | 0.3 | 0.9 | 0.8 | 0.7 | 1.5 | 1.8 | 2.8 | 2.8 |
| release after a peak (s) | 0.0 | 0.0 | 0.3 | 0.2 | 0.9 | 0.8 | 1.1 | 1.4 | 1.1 | 3.6 | 1.3 | 1.2 | 1.9 |
| hot share | 0% | 0% | 0% | 0% | 1% | 1% | 3% | 3% | 2% | 6% | 11% | 19% | 22% |
| calm share | 99% | 93% | 89% | 89% | 84% | 83% | 80% | 75% | 77% | 75% | 78% | 56% | 54% |
| shape (most runs) | flat 100% | flat 100% | flat 83% | flat 87% | flat 58% | flat 75% | flat 50% | one peak 54% | one peak 48% | one peak 55% | sawtooth 68% | sawtooth rising 59% | sawtooth 77% |
| taps follow tension (r) | 0.06 | 0.03 | -0.02 | 0.04 | 0.15 | 0.11 | 0.10 | 0.15 | 0.05 | 0.15 | 0.23 | 0.13 | 0.08 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.2; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 164 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | gunships, aegis, flak | 92% | 13.7 | 3.0 | 3.2 | 0.30 (23) / 0.87 (23) / 1.74 (23) | 0.0 0.1 0.0 0.0 0.0 0.4 0.3 0.7 0.5 1.1 |
| off-counter | thermo, seeker, tesla | 83% | 13.5 | 2.8 | 3.1 | 0.23 (22) / 1.05 (22) / 1.82 (22) | 0.0 0.1 0.0 0.2 0.0 0.4 0.3 0.9 0.5 0.7 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
