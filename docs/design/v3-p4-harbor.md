# Harbor Mouth, phase 4: the map card

**Date:** 2026-11-17. Map rebuild phase 4 (the reference maps brought to `docs/design/v3-map-wave-rules.md`). Encounter rev 4 (`ENCOUNTER_REV`); play log v25, unchanged.

Code: `src/v3/data/encounters.ts` (`HARBOR_R4`, `calm`, `MAP_BOSS`), `src/v3/data/mapPlans.ts` (`MAP_PLANS.harbor`), and two small hooks that only rev 4 data switches on:
- `src/v3/sim/game.ts`: the calm before an encounter that asks for one;
- `src/v3/sim/events.ts`: the Breakout's tuning from `MAP_BOSS`.

Bot reports: `tools/v3/map-report/results/harbor.md` (baseline, no Armory) and `harbor-player.md` (the player's Armory), each with its heat map.

## The problem

> Every ship has to pass the neck, where the lane closes and the convoy bunches up under both headlands, just before delivery.

The neck is Harbor Mouth's problem and why the player likes it. The map has no mechanic beyond it (rule `m-mechanic`: at most one). The neck is the lane narrowing from x 700 (half-width 150 → 66) with enemy headlands on both shores.

## Sites and their jobs

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| North-west silo (base 1) | Far west, north shore (300, 80) | drones, shells, the mothership | The long warning over the open water: Open water (w2), the swarm behind the convoy (w5, w7). |
| North-east headland silo (base 2) | Over the neck, north (1180, 170) | drones, supersonics, clusters | The neck from above: wave 1's first look, the drones after the periscope (w3), the north swarm (w6, w9), the pair at the lead ship (w7). |
| Far north-east silo (base 3) | Over the harbour (1450, 210) | shells, guided, heavies | The last mile: the missile at the ship about to deliver (w10). |
| South headland silo (base 4) | Over the neck, south shore (1300, 790) | drones, guided, supersonics | The friendly side of the neck, the closest silo to the ships: w4's opening, the south swarm and missile (w6), the missile in the crossfire (w9), the climax's swarm (w10). |
| South-east silo (base 5) | The harbour mouth (1500, 740) | shells, heavies, clusters | Shells straight down the funnel: w4, w9, w10. |
| Sub spot off the narrows (spot 2) | North-east of the neck (1450, 345) | sub salvos | The map's signature short warning onto the danger stretch: w3, w5, w8 and every boss round. |
| Sub spot in the open water (spot 1) | North-west (250, 250) | sub salvos | The open-water half of the wolf pack (w8). |
| Shore roads, pop-up roads, air lines | Both shores | trucks, strafers, bombers | The shared waves' own (trucks from w1, strafers from w3, bombers from w4); the Breakout's rocket trucks. |

Bases and spots are counted from 1 here, as the pause screen counts them (the data counts from 0).

## The stretches

The bot report cuts the lane into thirds: early is x 0–533, middle 533–1067, late 1067–1600.

- **Danger: the middle.** The neck opens at x 700, so the funnel's mouth, where the subs aim (`aim: 'narrows'`), sits in the middle third. It takes 45–49% of the hull damage in waves 1–9.
- **Safe: the early stretch,** the open water. It takes 20% (under the 25% the rules allow).

## The convoy

The convoy is set per map (rule `m-shape-convoy`), and Harbor's was built in round 11:
- ships come wide apart on the open water, at 2.2 times their slots;
- they close up into the neck.

The open water forgives and the neck does not. There is no convoy command: the map has no mechanic that needs one.

## The counters

Rule `m-kits`. Most of the neck's fire comes at short warning onto one spot:
- sub salvos off the narrows;
- shells from the mouth;
- swarms from both headlands;
- a missile at the ship about to deliver.

- **Counter kit:** Overdrive, Railgun, Focus. Fast aimed taps meet the salvos, and the Railgun's line down the funnel takes what converges there.
- **Off-counter kit:** Air Strike, Seeker Pod, Drone Screen. These fire by themselves and spread their shots over the whole board.

Chosen from the bots: aimed kits did best on Harbor in every trial. These are 24-seed runs with no Armory, on a draft of the waves from during tuning, losses in waves 1–10 on the tough runs:

| Kit | Weapons | Losses |
| --- | --- | --- |
| aimed | Overdrive, Railgun, Focus | 14.6 |
| | Overdrive, Railgun, Scattergun | 15.1 |
| | Railgun, Lance, Grapnel | 16.5 |
| | Flak, Thermobaric, Point Defense | 17.4 |
| | Flak, Thermobaric, Shrapnel | 20.2 |
| self | Air Strike, Seeker Pod, Drone Screen | 19.9 |

Area weapons did no better than the off-counter kit, despite the funnel. With the player's Armory the same kits came within about 10% of each other (7.9–8.6 lost).

## The ten waves (v1, encounter rev 4)

One encounter a wave, none twice in a row. Each one is built on the neck.

**Rule of the budget.** What an encounter sends comes out of the wave's drones (and its guided missiles where it has some), **never its shells**. A submarine fills its salvo to four whatever it is given. So rev 3's Funnel salvo (`replaces: { ballistic: 4 }`) took the wave's three shells and emptied both of the wave's own subs (8 shells): waves 4–7 came to ×0.67–0.76.

**Callouts.** None says "silo", "base", "lane", "pad", "launch site" or "sub spot".

| Wave | Role | Encounter (`id`) | What it sends | Sites | Target stretch | Two ways? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | teach | Over the neck (`harbor-first-look`) | 2 drones at the ship nearest the narrows | NE headland | the neck (danger) | – |
| 2 | teach | Open water (`harbor-wide-water`) | a swarm of 4 at any ship | NW silo | the open water (safe), long warning | – |
| 3 | first stakes | First periscope (`harbor-periscope`) | a sub's 3 shells, then 2 drones, all at the narrows | sub off the narrows, NE headland | the neck | – |
| 4 | first stakes | South headland (`harbor-south-headland`) | 3 drones at the narrows, 2 guided at the lead ship, 1 shell at the narrows | S headland, SE mouth | the neck and the last mile | (both shores of the neck) |
| 5 | combine | Funnel and tail (`harbor-funnel-tail`) | a sub's 3 shells at the narrows; a swarm of 5 at the back of the convoy | sub off the narrows, NW silo | the neck **and** the open water | front / back |
| 6 | combine | Both headlands (`harbor-both-headlands`) | 3 + 3 drones at the narrows from both shores, then a guided at the lead | NE and S headlands | the neck | north / south |
| 7 | escalate | Front and back (`harbor-front-and-back`) | 2 drones at the lead ship; a swarm of 3 at the back | NE headland, NW silo | the last mile **and** the open water | front / back |
| 8 | escalate | Wolf pack (`harbor-wolf-pack`) | two subs, 2 shells each, 4 s apart: the open water, then the narrows | both sub spots | open water, then the neck | open water / neck |
| 9 | escalate | Crossfire at the neck (`harbor-crossfire`) | 4 drones, a guided, 2 shells, all into the neck from three sides | NE headland, S headland, SE mouth | the neck | north / south / mouth |
| 10 | climax | The last mile (`harbor-final-mile`), with `calm: 5` | a guided at the lead ship, a swarm of 4, 2 shells at the narrows | far NE, S headland, SE mouth | the last mile and the neck | both shores |

The role column uses the rules' arc (rule `w-arc`). The data's `ArcRole` has no "stakes", so waves 3 and 4 carry `teach`. The pause screen's `arc()` labels waves by number and was not touched: it is shared with the other maps.

**Waves 7 and 8 are light on purpose.** The shared table steps up there: the mothership and a second strafer come on wave 7, and a second bomber and more supersonics on wave 8.
- Front and back adds a choice rather than weight.
- The Wolf pack sends fewer launches than it takes out (×0.90 of the shared wave).
- Rev 3's cliff was on wave 8 (1.38 → 3.29 ships).

**The calm before the climax** (rule `w-calm`). Wave 10's encounter carries `calm: 5`. The wave's own raids, and drones trickling in, that would fly in the 5 s before its first beat start early enough to be over by then (`calmBefore` in data/encounters.ts, applied in `startWave`). On 20 seeds, the quiet before the climax is 5.0–6.5 s; rev 3 had 0.3–4.6 s. A test checks it on six seeds.

The planner itself is unchanged and no RNG draw moves: only the raids' start times shift. So only a wave whose encounter asks for a calm plans differently.

The calm costs some difficulty. The raids moved out of the quiet bunch with the ones before it: wave 10 is about 0.35 ships harder for the bot with the Armory, and about 0.6 harder without it. The climax's own launches were cut to match.

**Wave 1** loses no ship across 80 runs (the "you" and "casual" bots, 40 seeds each), and the round 12 test passes. Wave 1 shows the neck with only two drones: three drones sank a ship in 2 of 80 runs.

## The boss rounds: The Breakout at the neck

The Breakout is Harbor's own event. Before, its three runs were identical: swarms, a sprint swarm, three rocket trucks down each shore road, and a fan of 3 Hydras. The player lost 0 ships in 6 rounds.

Under encounter rev 4, the event comes to the neck and gets harder each round (`MAP_BOSS.harbor`). Each salvo is a sub at the spot off the narrows, its periscope first, every shell aimed at the ship nearest the narrows:

| Round | Salvos into the neck | Hydra fan | What it adds |
| --- | --- | --- | --- |
| 1 | 3 shells at 5 s | 3 (as before) | 3 shells |
| 2 | 3 shells at 4 s, 2 at 13 s | 3 | 5 shells |
| 3 | 3 shells at 4 s, 3 at 11 s | 4 | 6 shells and a Hydra |

The target is about 2 ships a round on the bot's scale, rising (`botTarget: 2`; the bots read Harbor's boss about twice as hard as the player does):

| Bot | Round 1 | Round 2 | Round 3 |
| --- | --- | --- | --- |
| Player's Armory, tough runs (every run) | 1.33 | 1.83 | 2.38 |
| Player's Armory, normal runs that reached the round | 1.63 (8 runs) | 1.63 (8 runs) | 2.43 (7 runs) |
| Rev 3, player's Armory, tough runs | 0.83 | 1.04 | 1.08 |
| Rev 3, player's Armory, normal runs that reached the round | 0.43 (7 runs) | 1.86 (7 runs) | 1.71 (7 runs) |

On 48 seeds with the player's Armory, a round lasts 23–25 s on average (18–35 s), the 3 s breather included. Rev 3's lasted 23–24 s (18–37 s).

**Done from the encounter layer.** The hook in `sim/events.ts` reads `bossTune(map, g.enc.setup.rev)`, which returns nothing below rev 4 or with no encounter layer. So the following play the Breakout as before:
- a campaign run;
- every rev 3 or older log;
- the map-lab baseline, which replays unchanged.

`LOG_VERSION` stays 25. A test checks that a rev 3 run's event log and commands equal a no-layer run's, and that rev 4 sends the salvos and Hydras above, each round 15–30 s.

## Before and after (24 seeds, 900–923)

"Before" is encounter rev 3, measured with today's report: a close call is now 1 s, aimed at a ship. "After" is rev 4. Commands:

```
npx vite-node tools/v3/map-report/report.ts -- --map=harbor --seeds=24 --kits=plan
npx vite-node tools/v3/map-report/report.ts -- --map=harbor --seeds=24 --kits=plan --armory=player
```

### Baseline (no Armory)

| Rule | Check | Before (rev 3) | After (rev 4) |
| --- | --- | --- | --- |
| `w-cliff` | No cliffs | **FLAG**: w5 0.29→0.71, w8 1.38→3.29 | PASS: biggest step w9 +1.50, none doubles |
| `w-early` | Close calls from wave 3 | PASS: fewest w3 2.63 (88% of runs) | PASS: fewest w3 4.13 (96%) |
| `w-budget` | Wave budgets ±15% | **FLAG**: w4 ×0.67, w5 ×0.76, w6 ×0.67, w7 ×0.75 | PASS: furthest w8 ×0.90 |
| `m-stretches` | Danger and safe stretch | PASS: hot middle 46%, cold early 20% | PASS: hot middle 49%, cold early 20% |
| `g-warning` | Warning time falls | PASS: 9.2 → 4.2 s (−0.42 s a wave) | PASS: 10.7 → 4.0 s (−0.51 s a wave) |
| `w-first` | Wave 1 no loss | PASS: 0.00 | PASS: 0.00 |
| `w-early` | Lost waves 1–5 (normal) | 1.08 | 1.71 |
| `w-boss` | Boss (tough) | 1.71 / 3.83 / 3.13 | 3.46 / 4.71 / 4.92 |
| `m-kits` | Kits, lost 1–10 (tough) | counter 17.2, off-counter 19.1 | counter 17.0, off-counter 18.8 |

| Tough curve | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | 0.00 | 0.00 | 0.08 | 0.29 | 0.71 | 0.88 | 1.38 | 3.29 | 4.63 | 5.42 |
| after | 0.00 | 0.04 | 0.42 | 0.50 | 0.75 | 1.46 | 2.25 | 2.50 | 4.00 | 4.79 |
| after, 96 seeds | 0.00 | 0.05 | 0.36 | 0.56 | 0.83 | 1.10 | 1.85 | 2.60 | 4.43 | 4.94 |

### The player's Armory (the "good player")

| Rule | Check | Before (rev 3) | After (rev 4) |
| --- | --- | --- | --- |
| `w-cliff` | No cliffs | **FLAG**: w8 0.75→1.54 | PASS: biggest step w9 +0.96, none doubles |
| `w-early` | Close calls from wave 3 | PASS: fewest w3 2.50 (83% of runs) | PASS: fewest w3 4.29 (100%) |
| `w-budget` | Wave budgets ±15% | **FLAG**: w4 ×0.72, w5 ×0.78, w6 ×0.67, w7 ×0.77 | PASS: furthest w2 ×1.09 |
| `m-stretches` | Danger and safe stretch | PASS: hot middle 47%, cold early 16% | PASS: hot middle 45%, cold early 20% |
| `g-warning` | Warning time falls | PASS: 9.2 → 4.0 s (−0.45) | PASS: 10.7 → 3.8 s (−0.52) |
| `w-first` | Wave 1 no loss | PASS: 0.00 | PASS: 0.00 |
| `w-early` | Lost waves 1–5 (normal) | 0.67 | 1.08 |
| `w-boss` | Boss, normal (reached) | 0.43 / 1.86 / 1.71 (7 runs) | 1.63 / 1.63 / 2.43 (8 / 8 / 7 runs) |
| `w-boss` | Boss, tough | 0.83 / 1.04 / 1.08 | 1.33 / 1.83 / 2.38 |
| `m-kits` | Kits (tough lost 1–10; won; end wave) | counter 9.0, 13%, 9.7; off-counter 9.7, 4%, 9.3 | counter 7.0, 21%, 11.0; off-counter 7.3, 8%, 10.5 |
| – | Won (normal) | 29% | 17% |

| Tough curve | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | 0.00 | 0.00 | 0.00 | 0.21 | 0.46 | 0.50 | 0.75 | 1.54 | 2.21 | 2.67 |
| after | 0.00 | 0.08 | 0.13 | 0.38 | 0.50 | 0.71 | 0.63 | 1.00 | 1.96 | 2.29 |
| after, 96 seeds | 0.00 | 0.05 | 0.17 | 0.33 | 0.50 | 0.65 | 0.80 | 1.16 | 1.68 | 2.32 |

## Tests

- `tests/v3/mapRules.test.ts`: Harbor's expected back-to-back repeats are now none.
- `tests/v3/encounters.test.ts`:
  - the v1 count is 3 at rev 3 and 10 for Harbor at rev 4, with the ten listed;
  - the three rev 3 encounters carry `until: 3` and play only at rev 3;
  - the warning test plays each encounter at its last rev;
  - the funnel salvo and open water checks are pinned to rev 3;
  - the rev 1 log test compares with rev 3;
  - new checks: the wave 5 salvo lands in the neck while the wave's own two subs still fire their 8 shells; the calm before wave 10; the Breakout's rev 4 tuning, rev 3 unchanged and 15–30 s rounds.
- `tests/v3/round11.test.ts`: Harbor's arc in one line, ten names.
- `tests/v3/round12fixes.test.ts`: Harbor v1's wave 1 is its own encounter; rev 3's is still Open water.
- `tests/v3/mapCards.test.ts`: counts only the encounters that play at rev 4 (10 on Harbor).

## What is not satisfied, or uncertain

- **Waves 1–5 for a good player.** The bot with the player's Armory loses 1.08 ships in waves 1–5 (normal runs), just over the rule's 0–1; rev 3 lost 0.67.
  - The rise is the early stakes the rules ask for. Wave 3 is the first wave that can sink a ship, and close calls from wave 3 went from 2.5 to 4.3 a run.
  - The refit bot reads waves 1–5 about 1.4 times the player (0.69 against 0.50, `docs/design/v3-bot-refit.md`), so the player should lose about 0.8.
  - The baseline bot (no Armory) loses 1.71.
- **The kits.** The counter kit does better on every measure, but not by much:
  - with the Armory: won 21% against 8%, end wave 11.0 against 10.5, tough losses 7.0 against 7.3;
  - with no Armory: tough losses 17.0 against 18.8.

  The bot's "kit" is only its draft taste, so a kit's effect is diluted: with the Armory, every kit tried came within about 10% of the others. Neither kit is trivial: both lose 5+ ships in waves 1–10.
- **Cliffs are close to the line.** On the report's 24 seeds no wave doubles in either report. On 96 seeds (900–995) the largest steps are ×1.70 for the baseline (wave 9) and ×1.45 with the Armory. Read wave by wave, the shared table is steep: a smooth curve from wave 3 to 10 needs about ×1.5 a wave. Any change upstream also moves later waves' means by 0.1–0.2, because the bots' drafts change. Another seed set may flag a wave.
- **Not measured:**
  - "pull the player two ways from wave 5" (`g-split`): each of waves 5–10 is built with two directions (table above), but the bot report does not measure it yet;
  - each enemy type in at least two waves (`w-variety`, second half);
  - the calm before boss round 1: the boss starts after its 3 s breather as before.
- **Shared code.** The calm (`calm`, `firstBeatAt`, `calmBefore`, and the hook in `startWave`) is generic, and The Strait and The Gauntlet may want the same thing for their wave 10. If another phase 4 change adds its own calm, merge the two. The Breakout hook in `sim/events.ts` reads only `MAP_BOSS`, which only Harbor has.
- **`LOG_VERSION`** is unchanged at 25. Everything here is encounter rev 4, which is lab only: the campaign is unchanged, and the map-lab baseline replays exactly with telemetry on and off.
