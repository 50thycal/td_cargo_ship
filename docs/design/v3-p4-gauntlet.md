# The Gauntlet: map card (map rebuild phase 4)

The Gauntlet (`gauntlet`, chapter 1, the 4th map) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`). Data:

- `src/v3/data/encounters.ts`, `P4`: the rev 4 encounter plan.
- `src/v3/data/mapPlans.ts`, `MAP_PLANS.gauntlet`: the plan the bot report reads.
- `src/v3/data/events.ts`, `EV['rocket-convoy'].rounds`: the boss.

Bot reports:

- `tools/v3/map-report/results/gauntlet.md`: the baseline, with no Armory.
- `tools/v3/map-report/results/gauntlet-player.md`: with the player's Armory, the "good player".

## The problem

**Enemy on both shores and one carrier between them: whichever shore you turn to, the other one fires at the ships coming in.**

There is no map mechanic and no convoy command. The shores are the problem, so the convoy stays simple. Two lines of ships sail west to east, one each side of the carrier. Every ship passes both west silos on the way in.

## The sites and their jobs

| Site | Fires | Job |
|---|---|---|
| North-west silo (300, 100) | drones | The near, fast silo over the north line's way in. Half of every two-shore pincer (waves 1, 3, 6, 7, 9, 10). |
| South-west silo (520, 815) | drones, guided | The other half of the pincer, over the south line's way in. It carries the missiles of waves 5–9: the busiest encounter site. |
| North-east silo (1100, 95) | drones, shells, supersonic | The far shore's shells, which arc over the whole channel (waves 2, 5, 7, 10). Its swarm in wave 8 flies the length of the map: the long warning. |
| South-east silo (1300, 815) | shells, guided, heavy | It sits over the south line's way out. The encounters keep it quiet in waves 3–9, so the way out stays the safe stretch. It fires the climax's missiles at the ships about to deliver. |
| West sub spot (330, 450) | shells, drones | In the water between the two lines at the way in, the one place neither shore covers. It has the shortest warning, a 2 s periscope (waves 4, 6, 9). |
| East-middle sub spot (1300, 450) | shells | Beside the frigate, in the climax only (wave 10). |
| West edge (air) | strafer | A jet down the channel between the lines (wave 7). |

Warning time per wave (tough runs, baseline): 7.1 s on wave 1 and 3.2 s on wave 10, a slope of −0.45 s a wave. The early waves fire from the far shore and with long arcs. The later ones come from the west silos onto the ships passing them, from the sub between the lines, and from the air.

## The stretches

- **Danger: the way in** (the west third of each lane). It lies between the two west silos, before the carrier's guns are close. The carrier sits on the middle third, so the danger stretch is not the one nearest it (rule `m-carrier`).
- **Safe: the way out** (the east third). It lies behind the carrier and the frigate.

Encounters in waves 3–9 aim part of their fire at **the ship furthest back** (`aim: 'rear'`, new in encounter rev 4). Rule `g-timing` asks for the big raid to land on the danger stretch, and this does it: whatever moment the encounter fires, its target is the ship on the way in. The rest of their fire aims at any ship, and none of it aims at the lead.

Slice 5's shells and missile were aimed at the lead ship, so they all landed in the east third. That alone made the south line's way out its hottest stretch. Only the climax (wave 10, outside the check) aims at the ships about to deliver.

## The convoy and the counters

- **Convoy:** the map's own, sailing on its own. There are no commands (rule `m-convoy`: the map has no mechanic that needs one).
- **Counter kit:** Shrapnel Shell, Thermobaric Shell, Flak Cannon. These are area weapons for the swarms that come off both west silos at once onto the way in.
- **Off-counter kit:** Point Defense, Seeker Pod, Drone Screen. These weapons fire themselves. They cover the shore you are not looking at, but they spread their fire where the way in needs it massed.

Both kits were chosen from seven, measured with the player's Armory on 24 seeds (tough runs, ships lost in waves 1–10):

| Kit | Weapons | Lost (tough) | Won |
| --- | --- | --- | --- |
| blast | Shrapnel, Thermobaric, Flak | **5.9** | 38% |
| sr | Scattergun, Railgun, Overdrive | 6.5 | 42% |
| fr | Flak, Railgun, Focus | 6.5 | 29% |
| area | Flak, Scattergun, Railgun | 6.4 | 25% |
| aimed | Overdrive, Railgun, Focus | 6.7 | 38% |
| self | Air Strike, Seeker, Drone Screen | 6.7 | 29% |
| pd | Point Defense, Seeker, Drone Screen | **7.3** | 29% |

## The ten waves

Each wave has one encounter, and none plays twice in a row. "Rear" means aimed at the ship furthest back.

| Wave | Role | Encounter | Sites | Target stretch | Call-out |
|---|---|---|---|---|---|
| 1 | teach (shows the map) | North, then south (rev 3 opener, unchanged) | NW silo, then SW silo 4 s later: 2 drones each | either line, entering | North shore, then south |
| 2 | teach | A shell from each shore | NE shell, SE shell 3 s later, then 4 drones from NW | any | One shell north, one south |
| 3 | first stakes | The way in | NW 4 drones (rear), SW 4 drones a second later | way in | Swarms off both shores at once |
| 4 | first stakes | Periscope in the channel | West sub: 3 shells (rear); SW 4 drones (rear) | way in | A sub between the two lines |
| 5 | combine (two ways) | Overlap | SW 6 drones, NE 2 shells, SW guided (rear) | way in and middle | Shells and a swarm, two shores |
| 6 | combine (two ways) | The crossing | NW 5 drones (rear), SW 2 guided (one rear), west sub 2 shells | way in | Drones north, missiles south |
| 7 | escalate | Strafing run | NW 4 drones, SW 2 guided (one rear), a strafer from the west edge, NE 2 shells | way in, the jet down the middle | A jet down the middle |
| 8 | escalate (no cliff) | The long way round | NE 4 drones, SW 4 drones, SW guided (rear); takes 4 of the wave's shells | any; the missile at the way in | Swarms from opposite corners |
| 9 | escalate | Crossfire | NW and SW 5 drones each, SW 2 guided, west sub 3 drones (rear) | way in | Both shores, and a sub between |
| 10 | climax | Run the gauntlet | NW and SW 4 drones each; at the lead ship: NE 2 shells, SE 2 guided, east-middle sub 2 shells | the way out (the climax may) | Everything, both shores |

Two waves were shaped to avoid cliffs:

- **Wave 8 was the cliff** (0.75 → 3.04 ships for the bot). The shared table jumps there: a second strafer of its own, and shells go from 5 to 7. Slice 5's crossfire added a third strafer. Wave 8 now sends no aircraft, and its encounter takes four of the wave's shells for slow swarms. Wave 7 carries the strafer instead.
- **Wave 9** takes three shells (which land anywhere) for drones from the west, and has no jet of its own (the table already gives it two strafers).

Every wave is within ±15% of the same wave with the encounters off. Each encounter takes out of the wave at least what it sends (`replaces`). An encounter's strafer is booked as a drone swarm but launches once, which is why wave 7 is the leanest at ×0.91–0.94.

## The boss plan

**The Rocket Convoy** builds up round by round: a column of armoured rocket trucks down each shore road, with drone swarms for company.

| Round | Trucks a column | Swarms | Swarm size |
|---|---|---|---|
| 1 | 3 | 1 | 5 |
| 2 | 3 | 2 | 5 |
| 3 | 4 | 2 | 3 |

It used to be four trucks a column and three swarms of five, every round. The player lost 1.56 ships a round to it, and the bot lost 1.84.

- Target on the bot's scale: `botTarget: 1`, rising.
- With the player's Armory (24 seeds), normal runs that reached each round: **0.54 / 0.31 / 1.23**. Tough runs: **0.54 / 0.75 / 1.50**.
- With the counter kit: 0.91 / 1.09 / 1.18.
- Rounds last about 21, 23 and 26 s on average (from 14 to 32 s), measured from the event log.

A single run plays the base numbers (four and three), as before. This covers the Test Lab's Rocket Convoy card and the ending with the three-run experiment off.

**This changes the campaign:**

- **Play log v26** (`LOG_VERSION`, `LOG_REPLAYS` `[26]`). A v25 log that reaches the Gauntlet's boss rounds no longer replays to the same game.
- **The map-lab baseline.** It was rewritten with `--write`. Only the four Gauntlet runs changed play (their boss rounds); the other eight changed only their log version and content hash.
- **Version pins** moved to 26 in the tests (scorecard, events, events round 7, enemies round 8) and in the e2e scripts (`v3.mjs`, `v3-convoy.mjs`, `v3-map-cards.mjs`, `v3-map-lab.mjs`).

## The checks, before and after

All numbers are on seeds 900–923 under the stricter close call (aimed at a ship, within 1 s). "Before" is the rev 3 plan, re-run under the same code.

**Baseline (no Armory):**

| Check | Before | After |
|---|---|---|
| `w-cliff` No cliffs (tough) | **FLAG**: w8 0.75 → 3.04 | PASS: no wave doubles; biggest step w9 +0.75 |
| `w-early` Close calls from wave 3 | PASS: fewest w3 2.38 a run | PASS: fewest w5 2.83 |
| `w-budget` ±15% | PASS: furthest w3 ×1.05 | PASS: furthest w8 ×0.91 |
| `m-stretches` Safe stretch < 25% | **FLAG**: lane 1 cold late 21%, lane 2 cold early 31% | PASS: lane 1 cold late 16%, lane 2 cold late 20% (hot: the way in, 44% and 40%) |
| `g-warning` Falls 1 → 10 | PASS: 7.1 → 3.3 s | PASS: 7.1 → 3.2 s |
| `w-first` Wave 1 | PASS: 0.00 | PASS: 0.00 |
| Lost waves 1–5 (normal) | 0.58 | 1.13 |
| Boss r1/r2/r3 (tough) | 4.04 / 5.71 / 5.33 | 1.42 / 2.75 / 2.88 |
| Curve (tough) | 0 .04 .08 .08 .38 .58 .75 3.04 2.79 3.38 | 0 0 .17 .33 .63 1.13 1.67 2.33 3.08 3.63 |
| Kits, lost 1–10 (tough) | aimed 11.3, self 13.2 | counter 14.4, off-counter 12.9 |

**With the player's Armory:**

| Check | Before | After |
|---|---|---|
| `w-cliff` No cliffs (tough) | **FLAG**: w5 0.00 → 0.54, w8 0.50 → 1.42 | **FLAG**: w6 0.17 → 0.54 (by one sinking in 24 runs); wave 8 passes (0.75 → 0.63) |
| `w-early` Close calls from wave 3 | PASS: fewest w3 2.04 | PASS: fewest w3 3.29 |
| `w-budget` ±15% | PASS | PASS: furthest w8 ×0.90 |
| `m-stretches` | **FLAG**: lane 2 cold late 30% | PASS: lane 1 cold late 21%, lane 2 cold late 16% |
| `g-warning` | PASS: 7.1 → 3.3 s | PASS: 7.1 → 3.4 s |
| `w-first` | PASS: 0.00 | PASS: 0.00 |
| Lost waves 1–5 (normal) | 0.54 | 0.58 (a good player: 0–1) |
| Boss r1/r2/r3 (normal, reached) | 1.33 / 2.08 / 1.64 | 0.54 / 0.31 / 1.23 |
| Boss r1/r2/r3 (tough) | 1.42 / 1.92 / 2.33 | 0.54 / 0.75 / 1.50 |
| Won (normal) | 21% | 54% |
| Kits, lost 1–10 (tough) | aimed 4.9, self 5.5 (normal) | counter 5.9, off-counter 7.3; won 38% and 29% |

## What could not be satisfied, and why

- **The player-Armory curve still flags one doubling** (wave 6: 0.17 → 0.54, one sinking over the limit).
  - The tough curve is noisy. On a second set of 24 seeds (1000–1023), the same plan flagged wave 9 with the player's Armory and nothing on the baseline.
  - Every tweak to an early wave moves every wave after it: tough runs carry their drafts and damage forward.
  - The baseline, the report the check is judged on, passes. Wave 8, the known cliff, passes on both seed sets and with both Armories.
- **The kits differ only with the player's Armory.** Without it, the five kits measured that way (24 seeds) all lose 12.3–14.4 ships in tough runs on waves 1–10, and the counter kit's 14.4 is the worst of them. The bot with a plain gun breaks around wave 8 whatever it carries. With the player's Armory, the counter kit is the best of seven (5.9) and the off-counter the worst (7.3). Neither kit is trivial: 38% and 29% of runs won.
- **Boss rounds rise only from round 2 to 3** on normal runs: 0.54 / 0.31 / 1.23, average 0.69 a round (13 runs reached each). Tough runs and the counter kit do rise every round (0.54 / 0.75 / 1.50 and 0.91 / 1.09 / 1.18). Round 2's dip is within noise: round 2 adds a swarm, but the ships carry less damage into it than into round 3. Rounds sometimes run to 32 s, against the 15–30 s target.
- **The calm before wave 10's climax (`w-calm`)** is not built. The climax fires at 70% of the wave and takes 18 drones out of the wave's own raids, but the shared planner still spreads its raids over the whole wave. A real 5–8 s lull needs a planner change, which would change the campaign. Rule `w-calm` has no automatic check yet.
- **Waves 1–5 for the no-Armory baseline** went from 0.58 to 1.13 ships. That is the cost of real stakes from wave 3: each wave 3–9 has 2.8–8.2 close calls a run. A good player loses 0.58 (rule `w-early`: 0–1).
- **Per-site warning times** are not measured by the report; the table above gives each site's job and the per-wave warning time.
