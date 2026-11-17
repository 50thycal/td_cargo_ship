# Bot report: The Strait (`strait`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 0.7; built 2026-11-17.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=strait --seeds=24 --kits=aimed,self --armory=player`. Heat map: `tools/v3/map-report/results/strait-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +1.00; doubles on w10 (0.92→1.92) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w3 5.08 a run (100% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w10 ×1.14 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 38%, cold early 27% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 9.6 s → w10 4.1 s (slope -0.58 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.13 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 1.00 (20), r2 1.79 (19), r3 0.72 (18); tough (every run): 0.92, 1.67, 0.88 | about 2 a round on the bot's scale, rising | normal | INFO |
| `m-kits` | Kits | aimed 4.0 lost 1–10, end 12.8; self 4.3 lost 1–10, end 13.2 | the counter kit clearly better; neither trivial | kits | INFO |

## What to look at

- Cliff: wave 10 loses 1.92 after 0.92. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest early takes 27%): aim waves 1–9 away from it.
- Hardest of waves 1–10 for the bot: wave 10 (1.92 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 27%, middle 38%, late 35%.

## Ships lost per wave

Normal: won 63%, mean end wave 13.0 (14 = won), 3.3 lost in waves 1–10, 0.13 in waves 1–5. Tough: 4.2 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.08 | 0.42 | 0.75 | 0.92 | 1.92 | 0.92 | 1.67 | 0.88 |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.08 | 0.42 | 0.75 | 0.79 | 1.22 | 1.00 | 1.79 | 0.72 |
| normal, mean over all runs | 0.00 | 0.00 | 0.00 | 0.04 | 0.08 | 0.08 | 0.42 | 0.75 | 0.79 | 1.17 | 0.83 | 1.42 | 0.54 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 20 | 19 | 18 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +1.00.

## Close calls per wave (tough)

A threat that came within 2.0 s of a hull (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 1.1 | 2.0 | 5.1 | 5.9 | 11.8 | 13.2 | 17.0 | 15.7 | 18.5 | 18.5 | 4.8 | 2.9 | 4.1 |
| runs with ≥ 1 | 92% | 96% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 92% | 96% | 96% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 11.0 | 13.5 | 16.5 | 18.4 | 24.0 | 23.8 | 35.3 | 36.9 | 38.4 | 47.9 |
| launches (encounters off) | 11.0 | 13.7 | 17.2 | 19.4 | 22.2 | 21.5 | 31.7 | 32.7 | 34.0 | 41.9 |
| **ratio to encounters off** | 1.00 | 0.98 | 0.96 | 0.95 | 1.08 | 1.10 | 1.11 | 1.13 | 1.13 | 1.14 |
| table × scale | 11 | 14 | 19 | 23 | 23 | 26 | 31 | 32 | 38 | 45 |
| ratio to table × scale | 1.00 | 0.96 | 0.87 | 0.80 | 1.04 | 0.92 | 1.14 | 1.15 | 1.01 | 1.06 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 27% / 9% | 38% / 33% | 35% / 58% | 47.4 | middle | early |
| all | 1–9 | 27% / 9% | 38% / 33% | 35% / 58% | 47.4 | middle | early |
| 1 | 1–13 | 27% / 10% | 40% / 44% | 33% / 46% | 100.9 | middle | early |
| all | 1–13 | 27% / 10% | 40% / 44% | 33% / 46% | 100.9 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 9.6 | 7.7 | 6.7 | 5.9 | 4.8 | 4.3 | 4.3 | 4.1 | 3.7 | 4.1 | 10.8 | 10.6 | 10.4 |
| launches read | 264 | 323 | 394 | 439 | 575 | 570 | 836 | 882 | 908 | 1144 | 716 | 718 | 717 |

Slope over waves 1–10: -0.58 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 1.00 | 1.79 | 0.72 |
| runs that reached it | 20 | 19 | 18 |
| tough, every run | 0.92 | 1.67 | 0.88 |

## Kits

The bot's taste set to the kit (it takes these first when a draft offers them).

| Kit | Weapons | Won | End wave | Lost 1–10 (normal) | Lost 1–10 (tough) | Boss r1 / r2 / r3 (reached) | Curve 1–10 (tough) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| aimed | overdrive, railgun, focus | 67% | 12.8 | 3.9 | 4.0 | 0.78 (18) / 1.44 (18) / 0.89 (18) | 0.0 0.0 0.0 0.0 0.2 0.2 0.5 1.2 0.5 1.4 |
| self | airstrike, seeker, droneScreen | 75% | 13.2 | 3.6 | 4.3 | 1.05 (20) / 1.65 (20) / 0.60 (20) | 0.0 0.0 0.0 0.0 0.1 0.2 0.4 0.9 0.9 1.7 |

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
