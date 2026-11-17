# V3 bot report: a map's measured checks (map rebuild phase 3)

The map and wave rules (`docs/design/v3-map-wave-rules.md`) say a map passes when the bots and heat maps are happy before the player plays it. This is the report that says so: one page a map that a session reads to design the map's waves, with the rules the bots can measure judged PASS or FLAG.

- `src/v3/sim/mapReport.ts`: the numbers. Pure (no DOM, no Node).
  - `ThreatWatch` reads each threat's time to impact every step.
  - `digestRun` turns one run's telemetry sidecar into a small per-wave record.
  - `mapReport` adds a map's runs together and judges the rules.
- `src/v3/sim/mapReportPlay.ts`: plays one run of a map's Test Lab card on its production setup, as `tools/v3/map-lab/versions.ts` `playVersion` does.
- `tools/v3/map-report/report.ts`: the command line. It writes three files to `tools/v3/map-report/results/`:
  - `<map>.json`: every number;
  - `<map>.md`: the report;
  - `<map>-heat.html`: the map-lab heat map of the normal runs.
- `tests/v3/mapReport.test.ts`: the metrics on hand-made sidecars, and a two-seed run.

```
npx vite-node tools/v3/map-report/report.ts -- --map=strait                 # baseline, 24 seeds
npx vite-node tools/v3/map-report/report.ts -- --map=harbor --kits=aimed,self
npx vite-node tools/v3/map-report/report.ts -- --map=gauntlet --kits=area:flak+thermo+shrapnel,aimed
npx vite-node tools/v3/map-report/report.ts -- --map=strait --armory=player # writes strait-player.*
npm run v3:map-report -- --map=strait --seeds=48 --no-heat
```

Options:
- `--seeds=N`: seeds 900 to 900+N−1 (24 by default).
- `--persona=you`: the bot.
- `--armory=player`: the player's Armory upgrades (`PLAYER_ARMORY`). The files get a `-player` suffix, so the baseline's are kept.
- `--kits=…`: a name from `KITS` in `versions.ts` (`aimed`, `self`), or `name:id+id+id` with ability ids.
- `--no-heat`: skip the heat map.
- `--out=dir`: where to write.

A map takes about 100 s with two kits.

## What is played

- **The setup.** The map's Test Lab card on its production setup: the full map from wave 1, its convoy policy, encounters v1 on (round 1 settled v1 on every map).
- **The bot.** The refit "you" bot. **Baseline: no Armory upgrades** (`docs/design/v3-bot-refit.md`: map testing plays a new player's gun). `--armory=player` reads the map as the player will meet it.
- **The seeds.** 900 onwards, the same seeds as `versions.ts`.

Four passes, each on every seed:

| Pass | What it is | What is read from it |
|---|---|---|
| **normal** | The loss limit as in play. | Won share, mean end wave (14 = won), ships lost per wave over the runs that reached it, the boss rounds, the heat map. |
| **tough** | No loss limit; the carrier can't sink. Every seed plays all 13 waves. | The per-wave curve and cliffs, close calls, budgets, stretches, warning time. |
| **baseline** | Tough, with the card's encounters off. | The yardstick for the budget. |
| **kits** | Normal and tough again, with the bot's `taste` set to the kit. | End wave, losses in waves 1–10, the boss rounds. |

Why tough for the curve: a normal run that ends on wave 8 says nothing of waves 9–10. Read on normal runs alone, a hard wave hides the wave after it. Each table in the report names its pass.

## The numbers, and the rules they check

| Number | Definition | Rule | PASS when |
|---|---|---|---|
| Ships lost per wave | Sinkings by the wave they fell in. A VIP counts `VIP.loss` (3), as the game counts it. A bonus wave's losses are kept apart. Normal runs: the mean over all runs and over the runs that reached the wave. Tough runs: the mean over every run. | — | — |
| **Cliff** | On the tough curve, waves 2–10: the biggest one-wave step up, and every wave that loses more than twice the wave before. **Small numbers:** the wave before is floored at 0.25 ships. After a wave losing under a quarter of a ship, the next must lose more than 0.5 to count as doubling. 0.04 → 0.1 is noise, not a cliff. | `w-cliff` | No wave doubles. |
| **Close calls** | A threat **aimed at a ship** (not the carrier) that came within **1.0 s** of impact and was then destroyed (a kill, by anything). Phase 4 tightened this from 2.0 s at any hull, which every wave passed many times over. "Within 2.0 s" uses the sim's own `timeToImpact`, read after every step, the same number the bots aim by and the UI warns by. A threat that hit is not a close call; neither is one that left the board. Children count too (a dart, a torpedo): each could sink a ship. The table also gives the share of runs with at least one. | `w-early` | At least 1 a run (mean) on every wave 3–10. |
| **Wave budget** | Launches a wave: what a launcher sent (a base, a truck, a sub's salvo, the air). Not what split off another threat (a Hydra's darts, a bomber's bomblets, a mothership's minidrones), and not a threat back on the board. This is the game's own count (`g.origins`, as the telemetry audit checks). Children are left out because a split doubles a threat's count without being a new decision for the wave's planner. Read on the tough runs, the card against the same card with its encounters off. | `w-budget` | Every wave 1–10 within ×0.85–×1.15. |
| **Stretches** | Each lane cut in three equal parts by distance along it (early, middle, late; the hit event's `d` and `lane`, against the lane's length). For each part: its share of the lane's ship hull damage and of its sinkings. Read over waves 1–9 (outside wave 10 and the boss rounds) and over all waves. Hot is the part with the most hull damage, cold the least. A lane under 1 hull point a run is too thin to judge. The pooled row adds the lanes. | `m-stretches`, `g-safe` | On each lane, the cold part takes under 25% of the hull damage, waves 1–9. |
| **Warning time** | For each launch aimed at a hull: its seconds to impact the first step it was on the board. Mean per wave; the slope over waves 1–10 by least squares. Launches over 30 s (a plane with no hull ahead, a drifting mine) and threats with no target are left out. | `g-warning` | Slope below 0 and wave 10 below wave 1. |
| Wave 1 | Ships lost on wave 1, tough. | `w-first` | Under 0.1 a run. |
| Waves 1–5 | Ships lost, normal. | `w-early` | INFO. A good player loses 0–1. |
| **Boss rounds** | Ships lost in rounds 11, 12 and 13. Normal: over the runs that reached each round. Tough: every run. | `w-boss` | INFO, against the target on the bot's scale (below). |
| **Kits** | Per kit: won, end wave, lost in waves 1–10 (normal and tough), the boss rounds, the tough curve. | `m-kits` | INFO. The counter kit should do clearly better, and neither should be trivial. |

### Definitions chosen, and why

- **Hull damage, not sinkings, judges stretches.** Sinkings are few (often under 10 a run on waves 1–9), so their shares swing from seed to seed. Hull points removed are the same pressure, measured 10–20× more often. The sinkings' shares are printed beside them.
- **The budget's yardstick is the same card with encounters off, not the bare table.** The table gives drones, shells and guided missiles a wave (`waveSpec` × `threatScale`). The planner then changes that count:
  - aircraft replace drone swarms and guided missiles;
  - the map's extras (subs, trucks) add launchers;
  - a sub fills its salvo whatever it is given;
  - new enemies replace drones.

  So the real count is not the table's. The table × scale is printed with its ratio, for reference. The check asks the rule's question: do the encounters (and a map's extra fire, `waveFire`) keep the wave within ±15% of what the shared table gives on this map? Launches also depend a little on the bot: a truck or a sub sunk before it fires sends less. Both sides of the ratio are played by the same bot on the same seeds.
- **The close-call threshold includes the carrier.** The rule says "a hull". A threat with no target (time to impact 99) never counts.
- **Warning time is the launch's own time to impact**, not the raid banner. The raid warning (`warn`) is a fixed 2.5 s before each raid (`RAID.warn`), so it cannot change wave to wave. The launch's flight time is what changes when a wave fires from a nearer site.

## Reading it: the bots' known biases

From `docs/design/v3-bot-refit.md`:
- **The boss rounds on the Strait and Harbor Mouth read harder to the bot than to the player.**
  - The bot loses about 1.2–1.4 ships a round where the player lost none in 15 rounds.
  - For those two maps the boss target is **about 2 ships a round on the bot** for the player's "about one". The report prints that target.
  - On the Gauntlet the bot matches the player: the target is about 1.
- **Waves 6–10** read up to about a ship pessimistic over the five waves.
- **The bot taps a threat sooner than the player** (0.47 s against 0.82 s on waves 1–5). Close calls on the player's side may be a little more frequent than the bot's.
- **The baseline has no Armory upgrades.** The player has Quick Reload 5, Damage Control 4 and Stockpile 5, so on the baseline the bot loses more and reaches the boss rounds less often than the player would. That is why the boss rounds are also given on the tough runs. Run `--armory=player` to read difficulty as the player meets it.
- **Bots set the floor; the player's scorecard sets the target** (rule `w-bots`). Cliffs, budgets, stretches, close calls and warning time are what the bots measure well. Read difficulty (waves 1–5, the boss) as a direction, not a verdict.

## The heat map

`<map>-heat.html` is built with the map lab's own preview (`tools/v3/map-lab/preview.ts`, `buildPreview` and `renderPreview`). It replays the normal runs' play logs with telemetry and draws:
- the damage layer first: where hulls were when hit, sized by hull points, a cross for a sinking;
- the sources, launches and risk layers, behind buttons;
- for the ten waves, or for the boss rounds.

Pickups and exposure are left out to keep the file small.

No raw logs are kept in `results/`, only the digests' sums.

## Results (24 seeds, baseline)

`tools/v3/map-report/results/{strait,gauntlet,harbor}.md`, with `-player` versions for the player's Armory.

| Check | The Strait | The Gauntlet | Harbor Mouth |
|---|---|---|---|
| No cliffs (tough) | **FLAG**: w6 0.29→0.79, w8 0.67→1.58 | **FLAG**: w8 0.75→3.04 | **FLAG**: w5 0.29→0.71, w8 1.38→3.29 |
| Close calls from wave 3 | PASS: fewest 4.8 a run (w3) | PASS: 6.8 (w3) | PASS: 5.4 (w3) |
| Wave budget ±15% | PASS: furthest ×1.12 (w10) | PASS: ×1.05 (w3) | **FLAG**: w4–7 ×0.67–0.76 |
| Safe stretch < 25% | **FLAG**: cold early 26% | **FLAG**: lane 2 cold early 31% (lane 1 21%) | PASS: cold early 20% |
| Warning time falls | PASS: 9.6 → 3.9 s | PASS: 7.1 → 3.3 s | PASS: 9.2 → 4.2 s |
| Wave 1 no loss | PASS: 0.00 | PASS: 0.00 | PASS: 0.00 |
| Lost waves 1–5 (normal) | 0.33 | 0.58 | 1.08 |
| Boss r1/r2/r3 (tough) | 1.75 / 3.42 / 4.58 | 4.04 / 5.71 / 5.33 | 1.71 / 3.83 / 3.13 |

What stood out:
- **Harbor Mouth's budget.** Waves 4–7 send about a third fewer launches than the same waves with the encounters off. Its funnel salvo `replaces: { ballistic: 4 }` and sends one sub's salvo of 4 shells. With the encounters off, the wave has two subs and 8 shells, and the encounter takes out drones too. The encounter takes more than it sends: this is the round 12 lesson "a sub fills its salvo whatever it is given".
- **Wave 8** is the biggest step on the Gauntlet and Harbor Mouth, the known shared-wave cliff.
- **With the player's Armory** (`-player` files) the curves are gentler, but each map still flags a doubling:
  - the Strait on wave 10 (0.92 → 1.92);
  - the Gauntlet on waves 5 and 8;
  - Harbor Mouth on wave 8.

  The boss rounds come to about 1–2 ships a round over the runs that reached them.
- **Close calls** pass by a wide margin on every map: every wave from 3 has several, in every run. The 2 s rule as written is easy to meet. A stricter variant (for example, close calls that the bot only stopped in the last 1 s) could be considered if the player still finds waves 3–5 safe.
