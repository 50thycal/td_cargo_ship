# Bot report: Citadel of Vey (`citadel`)

- Seeds: 24 (900–923); persona "you"; Armory: none (baseline); threat scale 1.25; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=citadel --seeds=24 --kits=plan`. Heat map: `tools/v3/map-report/results/citadel-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +1.83; doubles on w5 (0.33→1.04) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 1.17 a run (63% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w3 ×0.85 of the no-encounter wave; outside on w3 ×0.85 | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | **FLAG** |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 39%, cold early 27% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 8.0 s → w10 5.9 s (slope -0.32 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 2.25 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 – (0), r2 – (0), r3 – (0); tough (every run): 1.04, 2.38, 4.29 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 17.8 lost 1–10, end 7.3; off-counter 18.6 lost 1–10, end 7.3 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 5 loses 1.04 after 0.33. Move budget from it to the wave before, or soften its biggest raid.
- Budget: wave 3 sends ×0.85 the no-encounter wave. Encounters should replace launches, not add them.
- No safe stretch on lane 1 (coldest early takes 27%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (4.25 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 27%, middle 34%, late 39%.

## Ships lost per wave

Normal: won 0%, mean end wave 7.5 (14 = won), 5.7 lost in waves 1–10, 2.25 in waves 1–5, 0.04 in bonus waves. Tough: 17.1 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.50 | 0.38 | 0.33 | 1.04 | 1.13 | 2.21 | 4.04 | 3.25 | 4.25 | 1.04 | 2.38 | 4.29 |
| normal, runs that reached it | 0.00 | 0.50 | 0.38 | 0.33 | 1.04 | 0.96 | 1.30 | 1.93 | 2.33 | – | – | – | – |
| normal, mean over all runs | 0.00 | 0.50 | 0.38 | 0.33 | 1.04 | 0.92 | 1.08 | 1.13 | 0.29 | 0.00 | 0.00 | 0.00 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 14 | 3 | 0 | 0 | 0 | 0 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +1.83.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 2.3 | 2.7 | 2.0 | 1.9 | 2.1 | 2.2 | 2.4 | 2.6 | 3.7 | – | – | – | – |
| kills a minute | 48 | 39 | 43 | 46 | 45 | 41 | 46 | 42 | 47 | – | – | – | – |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.5 | 2.0 | 1.8 | 1.2 | 3.1 | 2.0 | 3.3 | 4.4 | 4.2 | 6.4 | 1.2 | 2.0 | 2.8 |
| runs with ≥ 1 | 29% | 92% | 83% | 63% | 96% | 88% | 100% | 96% | 100% | 100% | 83% | 96% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 21.3 | 22.0 | 27.4 | 30.3 | 34.9 | 38.3 | 46.3 | 49.0 | 53.4 | 61.6 |
| launches (encounters off) | 20.0 | 24.3 | 32.4 | 35.5 | 38.8 | 44.8 | 48.8 | 54.1 | 61.3 | 69.7 |
| **ratio to encounters off** | 1.06 | 0.90 | **0.85** | 0.85 | 0.90 | 0.85 | 0.95 | 0.91 | 0.87 | 0.88 |
| table × scale | 20 | 27 | 34 | 38 | 40 | 47 | 54 | 59 | 68 | 81 |
| ratio to table × scale | 1.06 | 0.81 | 0.81 | 0.80 | 0.87 | 0.81 | 0.86 | 0.83 | 0.78 | 0.76 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 27% / 24% | 34% / 37% | 39% / 39% | 82.5 | late | early |
| all | 1–9 | 27% / 24% | 34% / 37% | 39% / 39% | 82.5 | late | early |
| 1 | 1–13 | 21% / 16% | 32% / 31% | 47% / 53% | 136.8 | late | early |
| all | 1–13 | 21% / 16% | 32% / 31% | 47% / 53% | 136.8 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.0 | 9.2 | 8.0 | 8.5 | 6.7 | 7.5 | 6.7 | 6.4 | 6.1 | 5.9 | 2.5 | 2.2 | 2.3 |
| launches read | 600 | 617 | 710 | 760 | 871 | 952 | 1085 | 1161 | 1235 | 1443 | 207 | 378 | 405 |

Slope over waves 1–10: -0.32 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | – | – | – |
| runs that reached it | 0 | 0 | 0 |
| tough, every run | 1.04 | 2.38 | 4.29 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 14 | 3 | 0 | 0 | 0 | 0 |
| **saves a run** | **0.0** | **0.0** | **0.1** | **0.1** | **0.3** | **0.2** | **0.2** | **0.2** | **0.3** | – | – | – | – |
| ships saved a run | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 | 0.2 | 0.2 | 0.1 | 0.3 | – | – | – | – |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.00 | 0.07 | 0.00 | – | – | – | – |
| clutch | 0.00 | 0.00 | 0.08 | 0.08 | 0.13 | 0.13 | 0.20 | 0.21 | 0.33 | – | – | – | – |
| runs with no save | 100% | 100% | 92% | 92% | 79% | 78% | 85% | 79% | 67% | – | – | – | – |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.04 | 0.21 | 0.09 | 0.10 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.04 | 0.00 | 0.04 | 0.04 | 0.00 | 0.07 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.14 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.09 | 0.10 | 0.00 | 0.33 | 0.00 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.29 | 0.68 | 0.75 | 0.61 | 1.00 | 0.92 | 1.17 | 1.45 | 1.49 | – | – | – | – |
| peaks | 0.0 | 0.4 | 0.4 | 0.2 | 0.9 | 0.7 | 1.3 | 1.4 | 1.7 | – | – | – | – |
| release after a peak (s) | 0.1 | 1.1 | 1.0 | 0.6 | 2.1 | 1.5 | 1.8 | 1.8 | 2.5 | – | – | – | – |
| hot share | 0% | 2% | 1% | 1% | 5% | 4% | 7% | 9% | 22% | – | – | – | – |
| calm share | 92% | 78% | 81% | 84% | 72% | 78% | 71% | 64% | 50% | – | – | – | – |
| shape (most runs) | flat 96% | flat 62% | flat 62% | flat 79% | flat 38% | flat 43% | one peak 40% | one peak 64% | sawtooth rising 67% | – | – | – | – |
| taps follow tension (r) | 0.14 | 0.07 | -0.01 | 0.12 | 0.11 | 0.11 | 0.11 | 0.12 | 0.07 | – | – | – | – |

saves a run: waves 1–7 0.1, 8–10 + boss 0.3; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9. 24 runs, 84 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | gunships, aegis, flak | 0% | 7.3 | 5.6 | 17.8 | – (0) / – (0) / – (0) | 0.0 0.5 0.4 0.3 1.0 1.5 2.9 4.0 3.1 4.2 |
| off-counter | thermo, seeker, tesla | 0% | 7.3 | 5.8 | 18.6 | – (0) / – (0) / – (0) | 0.0 0.5 0.3 0.5 1.2 1.1 2.3 4.4 3.7 4.5 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
