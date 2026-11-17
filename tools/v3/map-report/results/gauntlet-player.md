# Bot report: The Gauntlet (`gauntlet`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.75; built 2026-11-17.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=gauntlet --seeds=24 --kits=aimed,self --armory=player`. Heat map: `tools/v3/map-report/results/gauntlet-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +1.00; doubles on w5 (0.00→0.54), w8 (0.50→1.42) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 6.92 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w3 ×1.05 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 46%, cold late 23%; lane 2: hot middle 39%, cold late 30% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 7.1 s → w10 3.3 s (slope -0.48 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.54 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.33 (12), r2 2.08 (12), r3 1.64 (11); tough (every run): 1.42, 1.92, 2.33 | about 1 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | aimed 4.9 lost 1–10, end 12.1; self 5.5 lost 1–10, end 11.8 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 5 loses 0.54 after 0.00; wave 8 loses 1.42 after 0.50. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 2 (coldest late takes 30%): aim waves 1–9 away from it.
- Hardest of waves 1–10 for the bot: wave 10 (2.13 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 31%, middle 42%, late 27%.

## Ships lost per wave

Normal: won 21%, mean end wave 11.3 (14 = won), 4.8 lost in waves 1–10, 0.54 in waves 1–5. Tough: 6.0 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.00 | 0.00 | 0.54 | 0.29 | 0.50 | 1.42 | 1.13 | 2.13 | 1.42 | 1.92 | 2.33 |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 | 0.00 | 0.54 | 0.29 | 0.50 | 1.38 | 1.00 | 1.61 | 1.33 | 2.08 | 1.64 |
| normal, mean over all runs | 0.00 | 0.00 | 0.00 | 0.00 | 0.54 | 0.29 | 0.50 | 1.38 | 0.88 | 1.21 | 0.67 | 1.04 | 0.75 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 21 | 18 | 12 | 12 | 11 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +1.00.

## Close calls per wave (tough)

A threat that came within 2.0 s of a hull (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.9 | 1.8 | 6.9 | 8.3 | 9.3 | 12.0 | 15.5 | 17.8 | 18.0 | 20.8 | 7.8 | 7.6 | 7.4 |
| runs with ≥ 1 | 75% | 96% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 12.0 | 11.5 | 23.4 | 17.9 | 20.3 | 26.1 | 32.4 | 34.2 | 37.7 | 41.8 |
| launches (encounters off) | 12.0 | 11.4 | 22.3 | 17.4 | 20.3 | 26.1 | 32.4 | 33.8 | 39.6 | 43.7 |
| **ratio to encounters off** | 1.00 | 1.01 | 1.05 | 1.03 | 1.00 | 1.00 | 1.00 | 1.01 | 0.95 | 0.96 |
| table × scale | 12 | 16 | 21 | 24 | 25 | 27 | 32 | 36 | 41 | 49 |
| ratio to table × scale | 1.00 | 0.72 | 1.12 | 0.75 | 0.81 | 0.97 | 1.01 | 0.95 | 0.92 | 0.85 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 31% / 29% | 46% / 37% | 23% / 34% | 26.9 | middle | late |
| 2 | 1–9 | 31% / 11% | 39% / 40% | 30% / 49% | 31.4 | middle | late |
| all | 1–9 | 31% / 18% | 42% / 39% | 27% / 43% | 58.3 | middle | late |
| 1 | 1–13 | 32% / 27% | 42% / 43% | 26% / 30% | 63.5 | middle | late |
| 2 | 1–13 | 31% / 19% | 41% / 49% | 28% / 31% | 69.3 | middle | late |
| all | 1–13 | 31% / 23% | 42% / 46% | 27% / 31% | 132.8 | middle | late |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 7.1 | 7.8 | 6.7 | 5.1 | 4.3 | 4.4 | 4.2 | 3.6 | 3.9 | 3.3 | 6.9 | 6.7 | 6.6 |
| launches read | 288 | 276 | 560 | 428 | 482 | 621 | 774 | 819 | 904 | 999 | 549 | 551 | 551 |

Slope over waves 1–10: -0.48 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.33 | 2.08 | 1.64 |
| runs that reached it | 12 | 12 | 11 |
| tough, every run | 1.42 | 1.92 | 2.33 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| aimed | overdrive, railgun, focus | 29% | 12.1 | 4.5 | 4.9 | 1.06 (16) / 1.69 (16) / 2.27 (15) | 0.0 0.0 0.1 0.1 0.4 0.2 0.8 1.2 0.9 1.2 |
| self | airstrike, seeker, droneScreen | 38% | 11.8 | 4.5 | 5.5 | 1.07 (15) / 2.40 (15) / 1.42 (12) | 0.0 0.0 0.0 0.0 0.4 0.3 0.4 1.8 1.0 1.6 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
