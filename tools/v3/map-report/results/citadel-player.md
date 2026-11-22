# Bot report: Citadel of Vey (`citadel`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.25; built 2026-11-22.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=citadel --seeds=24 --armory=player --kits=plan`. Heat map: `tools/v3/map-report/results/citadel-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w8 +0.67; doubles on w8 (0.33→1.00) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 0.63 a run (50% of runs have one); under 1 on w4 | ≥ 1 a run on every wave 3–10 | tough | **FLAG** |
| `w-budget` | Wave budgets ±15% | furthest w4 ×0.85 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot late 47%, cold early 21% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | PASS |
| `g-warning` | Warning time falls 1→10 | w1 8.0 s → w10 6.1 s (slope -0.28 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.75 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.28 (18), r2 1.33 (18), r3 2.44 (18); tough (every run): 0.38, 1.29, 2.71 | about 2 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.1, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |
| `m-kits` | Kits | counter 4.5 lost 1–10, end 12.8; off-counter 4.7 lost 1–10, end 12.4 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 8 loses 1.00 after 0.33. Move budget from it to the wave before, or soften its biggest raid.
- Too few close calls on wave 4 (0.63): give those waves a launch from a near site, or one aimed at the danger stretch.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 9 (1.25 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 21%, middle 32%, late 47%.

## Ships lost per wave

Normal: won 63%, mean end wave 12.6 (14 = won), 3.8 lost in waves 1–10, 0.75 in waves 1–5. Tough: 4.6 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.21 | 0.17 | 0.04 | 0.33 | 0.29 | 0.33 | 1.00 | 1.25 | 0.96 | 0.38 | 1.29 | 2.71 |
| normal, runs that reached it | 0.00 | 0.21 | 0.17 | 0.04 | 0.33 | 0.29 | 0.33 | 1.00 | 1.00 | 0.68 | 0.28 | 1.33 | 2.44 |
| normal, mean over all runs | 0.00 | 0.21 | 0.17 | 0.04 | 0.33 | 0.29 | 0.33 | 1.00 | 0.92 | 0.54 | 0.21 | 1.00 | 1.83 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 19 | 18 | 18 | 18 |

Biggest one-wave step up (tough, waves 2–10): wave 8, +0.67.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.9 | 2.1 | 1.6 | 1.8 | 1.8 | 2.1 | 2.3 | 2.3 | 2.4 | 2.2 | 0.6 | 1.3 | 1.5 |
| kills a minute | 53 | 45 | 46 | 47 | 46 | 44 | 51 | 51 | 52 | 51 | 18 | 24 | 28 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.1 | 1.3 | 1.2 | 0.6 | 2.7 | 2.3 | 2.7 | 2.8 | 4.3 | 5.7 | 1.5 | 2.1 | 2.5 |
| runs with ≥ 1 | 4% | 75% | 79% | 50% | 96% | 83% | 92% | 83% | 96% | 100% | 92% | 88% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 21.3 | 22.0 | 27.1 | 30.3 | 34.4 | 37.3 | 45.7 | 49.2 | 51.5 | 60.8 |
| launches (encounters off) | 20.0 | 24.3 | 30.9 | 35.5 | 37.5 | 42.8 | 48.6 | 53.3 | 58.7 | 67.6 |
| **ratio to encounters off** | 1.06 | 0.90 | 0.88 | 0.85 | 0.92 | 0.87 | 0.94 | 0.92 | 0.88 | 0.90 |
| table × scale | 20 | 27 | 34 | 38 | 40 | 47 | 54 | 59 | 68 | 81 |
| ratio to table × scale | 1.06 | 0.81 | 0.80 | 0.80 | 0.86 | 0.79 | 0.85 | 0.83 | 0.76 | 0.75 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 21% / 21% | 32% / 32% | 47% / 47% | 59.8 | late | early |
| all | 1–9 | 21% / 21% | 32% / 32% | 47% / 47% | 59.8 | late | early |
| 1 | 1–13 | 16% / 10% | 27% / 20% | 57% / 70% | 108.9 | late | early |
| all | 1–13 | 16% / 10% | 27% / 20% | 57% / 70% | 108.9 | late | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 8.0 | 9.2 | 7.8 | 8.4 | 6.8 | 7.6 | 7.0 | 6.7 | 6.3 | 6.1 | 2.5 | 2.3 | 2.4 |
| launches read | 600 | 615 | 700 | 760 | 859 | 928 | 1066 | 1165 | 1186 | 1432 | 213 | 378 | 408 |

Slope over waves 1–10: -0.28 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.28 | 1.33 | 2.44 |
| runs that reached it | 18 | 18 | 18 |
| tough, every run | 0.38 | 1.29 | 2.71 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 22 | 19 | 18 | 18 | 18 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.2** | **0.3** | **0.3** | **0.3** | **0.2** | **0.0** | **0.1** | **0.1** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.1 | 0.2 | 0.2 | 0.2 | 0.1 | 0.0 | 0.1 | 0.1 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.00 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.04 | 0.13 | 0.17 | 0.09 | 0.21 | 0.00 | 0.11 | 0.06 |
| runs with no save | 100% | 100% | 96% | 96% | 96% | 83% | 83% | 79% | 73% | 79% | 100% | 89% | 94% |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.04 | 0.00 | 0.08 | 0.13 | 0.17 | 0.04 | 0.05 | 0.11 | 0.00 | 0.06 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.05 | 0.00 | 0.00 | 0.00 |
|   last-second kill | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.09 | 0.00 | 0.00 | 0.06 | 0.06 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.08 | 0.08 | 0.14 | 0.05 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.14 | 0.42 | 0.59 | 0.47 | 0.79 | 0.65 | 0.84 | 0.86 | 1.11 | 1.25 | 1.22 | 1.34 | 1.24 |
| peaks | 0.0 | 0.0 | 0.2 | 0.1 | 0.7 | 0.3 | 0.7 | 0.7 | 0.8 | 1.3 | 1.6 | 2.9 | 2.7 |
| release after a peak (s) | 0.0 | 0.1 | 0.4 | 0.3 | 1.4 | 0.6 | 1.4 | 0.9 | 1.8 | 3.6 | 1.2 | 1.2 | 1.8 |
| hot share | 0% | 0% | 1% | 0% | 2% | 1% | 3% | 3% | 5% | 5% | 10% | 21% | 20% |
| calm share | 99% | 89% | 89% | 89% | 79% | 83% | 81% | 77% | 74% | 75% | 80% | 58% | 54% |
| shape (most runs) | flat 100% | flat 96% | flat 79% | flat 87% | flat 46% | flat 75% | flat 46% | flat 46% | one peak 55% | one peak 74% | sawtooth 50% | sawtooth 67% | sawtooth 72% |
| taps follow tension (r) | 0.04 | 0.14 | 0.01 | 0.10 | 0.12 | 0.12 | 0.18 | 0.10 | 0.06 | 0.10 | 0.28 | 0.18 | 0.15 |

saves a run: waves 1–7 0.1, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 402 s of forks and replays.

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| counter | gunships, aegis, flak | 67% | 12.8 | 3.7 | 4.5 | 0.37 (19) / 1.32 (19) / 2.53 (19) | 0.0 0.2 0.1 0.0 0.4 0.3 0.2 1.0 1.4 0.8 |
| off-counter | thermo, seeker, tesla | 58% | 12.4 | 3.9 | 4.7 | 0.24 (17) / 1.41 (17) / 2.53 (17) | 0.0 0.2 0.2 0.0 0.3 0.3 0.4 0.8 1.2 1.1 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
