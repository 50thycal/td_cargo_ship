# Bot report: The Black Strait (`lantern`)

- Seeds: 24 (900–923); persona "you"; Armory: the player's ({"reload":5,"repair":4,"stockpile":5}); threat scale 1.45; built 2026-11-21.
- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).
- **normal** = the loss limit as in play (24 runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (24 runs). Each number says which.
- Made by `npx vite-node tools/v3/map-report/report.ts -- --map=lantern --seeds=24 --armory=player (on the base build, log v48)`. Heat map: `tools/v3/map-report/results/lantern-before-player-heat.html`.

## Checks

| Rule | Check | Value | Target | Runs | Result |
| --- | --- | --- | --- | --- | --- |
| `w-cliff` | No cliffs | biggest step w10 +1.75; doubles on w8 (0.42→1.25), w10 (0.88→2.63) | no wave 2–10 more than 2× the one before (before floored at 0.25) | tough | **FLAG** |
| `w-early` | Close calls from wave 3 | fewest w4 3.29 a run (96% of runs have one) | ≥ 1 a run on every wave 3–10 | tough | PASS |
| `w-budget` | Wave budgets ±15% | furthest w1 ×1.00 of the no-encounter wave | every wave 1–10 within ×0.85–×1.15 of the table × scale as planned (encounters off) | tough+baseline | PASS |
| `m-stretches` | A danger and a safe stretch | lane 1: hot middle 39%, cold late 30% | each lane's coldest stretch < 25% of its ship hull damage (waves 1–9) | tough | **FLAG** |
| `g-warning` | Warning time falls 1→10 | w1 13.6 s → w10 4.5 s (slope -0.84 s a wave) | falls: slope < 0 and wave 10 below wave 1 | tough | PASS |
| `w-first` | Wave 1: no ship lost | 0.00 a run | 0 (under 0.1 a run) | tough | PASS |
| `w-early` | Ships lost waves 1–5 | 0.13 a run | a good player 0–1 (rule w-early) | normal | INFO |
| `w-boss` | Boss rounds | normal (runs that reached it): r1 0.00 (16), r2 0.13 (16), r3 0.00 (15); tough (every run): 0.00, 0.08, 0.08 | about 1 a round on the bot's scale, rising | normal | INFO |
| `fun` | Fun: saves a wave (provisional) | saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10 | you-bot: about 1–2 real saves a wave 1–10, more in 8–10 and the boss rounds; flat under 0.5, chaotic over 4 mostly small | normal+forks | **FLAG** |

## What to look at

- Cliff: wave 8 loses 1.25 after 0.42; wave 10 loses 2.63 after 0.88. Move budget from it to the wave before, or soften its biggest raid.
- No safe stretch on lane 1 (coldest late takes 30%): aim waves 1–9 away from it.
- Fun (provisional): no real save for the bot on wave 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Give it one moment that needs a quick answer: a heavy or a salvo at the danger stretch, a drop that lands under pressure.
- Hardest of waves 1–10 for the bot: wave 10 (2.63 ships a run, tough runs).
- Hull damage by stretch (waves 1–9, all lanes): early 30%, middle 39%, late 30%.

## Ships lost per wave

Normal: won 63%, mean end wave 12.5 (14 = won), 3.5 lost in waves 1–10, 0.13 in waves 1–5. Tough: 5.3 lost in waves 1–10.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tough, every run | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.04 | 0.42 | 1.25 | 0.88 | 2.63 | 0.00 | 0.08 | 0.08 |
| normal, runs that reached it | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.04 | 0.42 | 0.54 | 0.91 | 1.52 | 0.00 | 0.13 | 0.00 |
| normal, mean over all runs | 0.00 | 0.00 | 0.00 | 0.00 | 0.13 | 0.04 | 0.42 | 0.54 | 0.88 | 1.46 | 0.00 | 0.08 | 0.00 |
| normal, runs that reached it (n) | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 16 | 16 | 15 |

Biggest one-wave step up (tough, waves 2–10): wave 10, +1.75.

## Action per wave (normal)

How busy a wave is (log v47, "Busier early waves"), pooled over the runs that reached it: the threats on the board at a moment (structures left out) and the threats shot down a minute.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| on the board | 1.5 | 1.3 | 1.5 | 1.4 | 1.8 | 1.8 | 2.0 | 1.7 | 2.3 | 2.7 | 1.9 | 2.8 | 2.8 |
| kills a minute | 42 | 40 | 45 | 41 | 41 | 38 | 41 | 42 | 46 | 47 | 46 | 58 | 61 |

## Close calls per wave (tough)

A threat aimed at a ship that came within 1.0 s of impact (the sim's time to impact, read every step) and was then destroyed.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mean a run | 0.2 | 0.9 | 3.3 | 3.3 | 4.6 | 5.9 | 7.0 | 8.3 | 8.3 | 9.3 | 0.0 | 0.0 | 0.0 |
| runs with ≥ 1 | 13% | 71% | 100% | 96% | 100% | 100% | 100% | 100% | 100% | 100% | 0% | 0% | 0% |

## Wave budget (tough)

Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card's encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map's extras make the real count differ from it).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| launches (card) | 23.0 | 26.5 | 35.2 | 36.6 | 39.6 | 40.1 | 45.3 | 48.3 | 55.0 | 64.5 |
| launches (encounters off) | 23.0 | 26.5 | 35.2 | 36.6 | 39.6 | 40.1 | 45.3 | 48.3 | 55.0 | 64.5 |
| **ratio to encounters off** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| table × scale | 23 | 31 | 39 | 44 | 46 | 53 | 62 | 68 | 78 | 94 |
| ratio to table × scale | 1.00 | 0.85 | 0.90 | 0.83 | 0.86 | 0.76 | 0.73 | 0.71 | 0.71 | 0.69 |

## Losses by stretch (tough)

Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.

| Lane | Waves | early hull / sunk | middle hull / sunk | late hull / sunk | Hull pts a run | Hot | Cold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–9 | 30% / 26% | 39% / 49% | 30% / 25% | 141.5 | middle | late |
| all | 1–9 | 30% / 26% | 39% / 49% | 30% / 25% | 141.5 | middle | late |
| 1 | 1–13 | 30% / 20% | 40% / 53% | 30% / 27% | 223.5 | middle | early |
| all | 1–13 | 30% / 20% | 40% / 53% | 30% / 27% | 223.5 | middle | early |

## Warning time per wave (tough)

Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| seconds | 13.6 | 9.4 | 8.4 | 6.9 | 6.0 | 5.3 | 5.1 | 4.5 | 4.8 | 4.5 | 6.4 | 6.0 | 5.9 |
| launches read | 552 | 632 | 839 | 878 | 948 | 962 | 1087 | 1155 | 1317 | 1547 | 456 | 450 | 456 |

Slope over waves 1–10: -0.84 s a wave.

## Boss rounds

|  | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| normal, runs that reached it | 0.00 | 0.13 | 0.00 |
| runs that reached it | 16 | 16 | 15 |
| tough, every run | 0.00 | 0.08 | 0.08 |

## Fun: saves and tension (provisional)

Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under 3 s from impact, each nuke, and each pickup grabbed with a threat under 4 s away, the game is forked and played on by the "you" bot with and without it (3 rolls of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / 2 s)); hot ≥ 0.75, calm < 0.2.

|  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| runs | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 24 | 23 | 23 | 16 | 16 | 15 |
| **saves a run** | **0.0** | **0.0** | **0.0** | **0.0** | **0.1** | **0.2** | **0.0** | **0.0** | **0.0** | **0.4** | **0.0** | **0.0** | **0.0** |
| ships saved a run | 0.0 | 0.0 | 0.0 | 0.0 | 0.1 | 0.2 | 0.0 | 0.0 | 0.1 | 0.4 | 0.0 | 0.0 | 0.0 |
| big (stakes) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 |
| clutch | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.08 | 0.00 | 0.00 | 0.00 | 0.30 | 0.00 | 0.00 | 0.00 |
| runs with no save | 100% | 100% | 100% | 100% | 92% | 92% | 100% | 100% | 96% | 74% | 100% | 100% | 100% |
|   nuke save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 |
|   pickup save | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.00 | 0.13 | 0.00 | 0.00 | 0.00 |
|   cover choice | 0.00 | 0.00 | 0.00 | 0.00 | 0.04 | 0.04 | 0.00 | 0.00 | 0.00 | 0.04 | 0.00 | 0.00 | 0.00 |
|   kill save | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.08 | 0.00 | 0.00 | 0.04 | 0.22 | 0.00 | 0.00 | 0.00 |
| tension peak | 0.13 | 0.32 | 0.55 | 0.67 | 0.92 | 1.02 | 1.06 | 1.04 | 1.26 | 1.40 | 0.16 | 0.29 | 0.17 |
| peaks | 0.0 | 0.0 | 0.1 | 0.4 | 0.9 | 1.1 | 1.5 | 1.8 | 1.9 | 2.6 | 0.0 | 0.1 | 0.0 |
| release after a peak (s) | 0.0 | 0.0 | 0.1 | 0.5 | 1.2 | 2.0 | 3.0 | 1.8 | 2.5 | 2.9 | 0.0 | 0.1 | 0.0 |
| hot share | 0% | 0% | 0% | 1% | 3% | 5% | 6% | 6% | 8% | 15% | 0% | 1% | 0% |
| calm share | 99% | 95% | 83% | 82% | 72% | 68% | 64% | 66% | 60% | 55% | 99% | 95% | 98% |
| shape (most runs) | flat 100% | flat 100% | flat 92% | flat 67% | one peak 46% | sawtooth 38% | one peak 46% | sawtooth 46% | sawtooth 39% | sawtooth 52% | flat 100% | flat 94% | flat 100% |
| taps follow tension (r) | 0.27 | 0.33 | 0.25 | 0.30 | 0.39 | 0.36 | 0.33 | 0.36 | 0.37 | 0.44 | 0.60 | 0.47 | 0.47 |

saves a run: waves 1–7 0.0, 8–10 + boss 0.1; flat (under 0.5) w1, w2, w3, w4, w5, w6, w7, w8, w9, w10. 24 runs, 578 s of forks and replays.

Read with docs/design/v3-map-report.md (what each number means and the bots' known biases).
