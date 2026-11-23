# V3 fun measures: saves and the tension curve

The player, after the 2026-11-18 playtest (Harbor Mouth, wave 8): track "close calls where that nuke or ammo drop really saved us from getting a lot of damage, or destroying a heavy right before it took out our last ship ... scenarios like that is what make the game more fun", and reproduce them with the bots.

This page describes two measures that look for those moments in any play log, the player's or a bot's:
- **Saves.** Did this tap, nuke or pickup actually keep a ship afloat? The game is played forward with it and without it, and the ships lost are compared.
- **The tension curve.** How much danger was on the board, second by second? From it, each wave gets a shape.

Both are **provisional**: they are new, they are checked against three of the player's runs, and their targets are a first guess.

## Where they live

| What | Where |
|---|---|
| The measures (pure, no browser) | `src/v3/sim/funMetrics.ts` |
| Tests | `tests/v3/funMetrics.test.ts` |
| In the bot report | `tools/v3/map-report/report.ts`, `src/v3/sim/mapReport.ts`: a "Fun" section and a provisional check row |
| Player against bot | `tools/v3/bot-fit/fit.ts --fun`, `tools/v3/bot-fit/measure.ts` (`measureFun`, `poolFun`) |
| The player's raw logs | `tools/v3/bot-fit/logs/` (the three v26 playtest runs; `player.json` keeps no inputs, so it can't be forked) |
| Ground truth from the player | the **per-wave ratings** the player gives on the weapon draft (fun, difficulty, intensity 1–5; the log's `waveRatings`, a score's `waves`), since scorecard revision 4. Best moment (revision 3) is retired: see the end of this page |

## Measure 1: saves

### What it does

At each player action that might matter, the game is copied at that very moment and played on in separate copies ("branches"):

1. **As played:** the action happens.
2. **Removed:** the action never happens.
3. **Late:** the same action 0.5 s later (a tap goes to the same threat where it is by then).
4. **Swapped** (only when two threats were due together): the tap goes to the other threat.

**Ships saved** is the number of ships the "removed" branch loses, minus the number the "as played" branch loses. A **save** is an action whose removal costs at least one ship.

### Which actions are tested

Testing every tap would be slow and pointless. An action is tested when it could plausibly have mattered:
- **A kill tap.** The last tap at a threat that the player's own hand then hurt or killed, when that threat was **3 s or less** from impact at the tap.
- **A nuke.** Always tested.
- **A pickup grab** (weapon, ammo, repair, supply…). Tested when some threat aimed at a hull was **4 s or less** from impact at the grab.

Gesture weapons (press and release) are not tested yet.

### Who plays after the fork

The log's later taps can't be replayed in the branches, because they were aimed at a board the "removed" branch no longer has.

Two fixes were possible:
- **Drop them**, so nobody plays on. This would count as "saved" every threat a player would simply have shot a moment later.
- **Let a bot play on.** This was chosen. The **"you" bot plays on in every branch, with the same dice**, so the branches differ only by the action.

The bot starts **warm**:
- it has already seen everything on the board;
- it doesn't look away;
- it doesn't touch the convoy controls.

So a save means that **even a sharp player taking over at that moment couldn't have covered for it**. This is a strict test on purpose.

### Counting the losses

Losses are counted **only for the threats in play**:
- a kill tap: the threat tapped (and the rival, if any);
- a pickup or nuke: every threat that was 4 s or less from impact.

Anything that split off from those threats or was fired by them also counts.

A ship counts as lost when one of those threats hit it and it sank. Once two branches differ, the bot's later taps differ too, and what that changes elsewhere on the board is chance, not the action. `savedAll` keeps the all-cause difference for reference.

The fork plays until those threats are gone in every branch, plus 0.5 s, with a cap of 9 s.

**Dice.** Each fork is rolled 3 times with different bot dice (`--fun-dice`). It is a save when two conditions both hold:
- the mean is at least 0.5 ships;
- at least half of the rolls lose a ship or more.

### Kinds, stakes and clutch

| Kind | When |
|---|---|
| **nuke save** | The action was a nuke. |
| **pickup save** | A pickup grab (weapon, ammo, repair, supply). |
| **cover choice** | Two threats were due within 0.75 s of each other (both under 2 s), and tapping the other one would also have lost a ship. |
| **last-second kill** | A kill tap on a threat under 1 s from impact. |
| **kill save** | Any other kill tap. |

**Stakes** (a "big" save) means at least one of these held:
- **run**: without the action, the run would have ended;
- **last**: without the action, no ship would have been left afloat;
- **limit**: the player was one loss from the end.

**Clutch** means the 0.5 s late version also loses the ship: the timing itself mattered.

### How a copy is made (for programmers)

The sim had no copy of its state, and its random numbers keep their state hidden in a closure. `forkableGame` therefore does three things:
- it sets the log's game up exactly as `setupGame` does;
- it swaps each random stream for an identical one that can be copied (`CloneRng`), found by counting the draws already made;
- `cloneGame` then deep-copies the whole state.

A copy takes under a millisecond. The tests check two things:
- a copy taken mid-run and played on with the log's inputs ends exactly where the log did;
- **a fork with no change gives exactly zero difference** (mode `noop`).

### The noise floor

`--fun-placebo` measures how often chance alone looks like a save. It forks at the same actions, keeps the action in both branches, and changes only the bot's dice. Any "save" it finds is false.

## Measure 2: the tension curve

### The formula

Every 0.1 s of play (6 sim steps), the reading is:

```
tension = Σ over live threats aimed at a hull of   weight × urgency
          × (1 − 0.3 × readiness)

weight    = min(1, threat damage ÷ hull points left on its target)
            (target: the ship it is aimed at, or the carrier)
urgency   = e^(−time to impact ÷ 2 s)      (1 at impact, 0.37 at 2 s, 0.05 at 6 s)
readiness = rounds in the rack ÷ rack size  (0 while reloading)
```

Notes:
- The time to impact is the sim's own `timeToImpact`, the same number the bots aim by and the warnings use.
- A threat that deals no damage itself (a cluster, a bomber) counts 2. A heavy counts 6.
- Threats more than 12 s out count nothing.
- A second's reading is the mean of its ten samples.

Units: 1.0 means roughly "one ship's whole hull is due within half a second, or several smaller hits within a second or two".

### Per wave

| Number | Meaning |
|---|---|
| **peak** | The highest second. |
| **peaks** | Distinct peaks: stretches at or above **hot (0.75)**, counted as separate when the reading falls below **0.35** between them. |
| **release** | Seconds from a peak's top until the reading falls below 0.35 again. |
| **hot share** | The share of the wave's seconds at or above 0.75. |
| **calm share** | The share of the wave's seconds below 0.2. |
| **shape** | **flat** (never hot), **one peak**, **sawtooth** (several peaks), **sawtooth rising** (the last peak at least 15% over the first), **pinned** (hot 30% of the wave or more). |

### Arousal check

Does the player's own hand follow the curve? Two numbers:
- **taps follow tension (r)**: the correlation, second by second, between tension and taps.
- **grab speed (grabR)**: across waves, the correlation between a wave's mean tension and how long its pickups sat before the grab. A negative value means pickups were grabbed faster when it was tense.

### The constants

All in `FUN` at the top of `src/v3/sim/funMetrics.ts`:

| Constant | Value | Controls |
|---|---|---|
| `tau` | 2 | Urgency decay (s) |
| `ready` | 0.3 | Readiness discount |
| `hot`, `release`, `calm` | 0.75, 0.35, 0.2 | Tension thresholds |
| `pinned`, `rising` | 0.3, 1.15 | Shape thresholds |
| `scanTti` | 3 | Kill taps tested (s) |
| `scanPickupTti` | 4 | Pickups tested (s) |
| `horizon` | 9 | Fork cap (s) |
| `tail` | 0.5 | Play-on after the threats are gone (s) |
| `delay` | 0.5 | The late variant (s) |
| `lastSecond` | 1 | Last-second kill (s) |
| `coverWindow`, `coverTti` | 0.75, 2 | Cover choice (s) |
| `minSaved` | 0.5 | Save rule (ships) |

The thresholds were set from the player's three v26 runs: a wave's reading averages 0.1–0.5, and its top second is 0.5–3.

## How to run it

```
npm run v3:map-report -- --map=strait --kits=plan --armory=player --fun-placebo   # bot report, fun included
npx vite-node tools/v3/bot-fit/fit.ts -- --fun --json=tools/v3/bot-fit/results/fun-2026-11-18.json
```

Bot report options:
- `--no-fun` skips the fun measures;
- `--fun-dice=N` sets the rolls per fork (3 by default);
- `--fun-placebo` adds the noise floor row.

`fit.ts --fun` options:
- `--raw=<dir>`: the raw logs (default `tools/v3/bot-fit/logs`);
- `--dice=6`: mirrors per run;
- `--fun-dice=3`: rolls per fork;
- `--personas=you`: the bots to compare.

**Cost.** With 3 rolls a fork, one run takes about 4–6 s:
- one scan replay of about 0.7 s;
- 130–190 actions tested;
- 400–600 branches.

On a 24-seed bot report that adds about 2–4 minutes per map, plus about a third more with `--fun-placebo`. Measured times (Strait / Gauntlet / Harbor, 24 runs, 3 rolls, with the placebo): 170 / 244 / 178 s on v26, 180 / 259 / 228 s on v27. The player's three runs, with 6 bot mirrors of each, took 112 s (v26).

## Results

### The player's three v26 runs (measured on the v26 build)

These numbers were computed on the **v26 build**, where the three logs replayed exactly; they are kept in `tools/v3/bot-fit/results/fun-2026-11-18.json`. Since #165 (play log v27: a softer Harbor B3, supersonics that sit on the rail 0.4 s and lift off slowly) these logs no longer replay exactly, so they can't be forked again. `fit.ts --fun` now skips them with a message rather than forking another game. The older player runs in `player.json` can't be forked either: they are v19–24 and have no raw logs. The next v27 playtest logs, dropped into `tools/v3/bot-fit/logs/`, bring the comparison back.

The player's own saves (3 rolls a fork):

| Map | Wave | Time | Kind | What | From impact | Saved | Notes |
|---|---|---|---|---|---|---|---|
| Strait | 5 | 31 s | pickup save | repair | 0.68 s | 0.67 | |
| Strait | 9 | 36 s | kill save | ballistic | 1.64 s | 0.67 | |
| Strait | **10** | 69.5 s | pickup save | **ammo** | 0.35 s | 0.67 | clutch; **stakes: run, limit** (one loss left) |
| Strait | **10** | 70.2 s | last-second kill | drone | 0.90 s | 1.00 | clutch; **stakes: run, limit** |
| Gauntlet | 8 | 20 s | kill save | ballistic | 1.16 s | 1.00 | clutch |
| Gauntlet | 8 | 23 s | last-second kill | rocket truck | 0.40 s | 1.00 | |
| Gauntlet | 9 | 39 s | kill save | drone | 1.79 s | 0.67 | |
| Gauntlet | **10** | 60 s | pickup save | repair | 0.42 s | 1.00 | clutch |
| Gauntlet | B1 | 12.5 s | cover choice | drone | 0.97 s | 0.67 | clutch |
| Gauntlet | B3 | 15 s | pickup save | ammo | 1.26 s | 0.67 | clutch |
| Harbor | B2 | 7 s | kill save | drone | 1.80 s | 0.67 | clutch |
| Harbor | **B3** | 8 s | kill save | sprinter | 1.93 s | 1.00 | clutch |

The Strait's wave 10 is exactly the player's story: one loss from the end, an ammo drop grabbed 0.35 s before a hit, then a drone killed 0.9 s out. Without either, the run ends there.

The bot on the same runs (the "you" bot, 6 mirrors each, same seed, Armory, setup and draft picks):

| Map | Player saves (with stakes) | Bot saves a run (with stakes) | Bot's kinds |
|---|---|---|---|
| Strait | 4 (2) | 2.2 (0.5) | mostly pickup saves (1.7) |
| Gauntlet | 6 (0) | 2.8 (0.7) | cover 1.0, pickup 0.8, kill 0.7, nuke 0.3 |
| Harbor | 2 (0) | 3.3 (0.3) | pickup 2.0, cover 0.7 |

Pooled player against bot (`results/fun-2026-11-18.json`):

| | You | "You" bot |
|---|---|---|
| Saves a wave, waves 1–10 | 0.27 | 0.24 |
| Saves a boss round | 0.67 | 0.42 |
| Big saves a run | 0.67 | 0.50 |
| Tension peak a wave | 1.01 | 0.94 |
| Peaks a wave | 0.90 | 0.77 |
| Hot share | 4% | 4% |
| Calm share | 80% | 81% |
| Taps follow tension (r) | **0.48** | 0.44 |

The bot makes about as many saves as the player, and its hands follow the curve almost as closely. The player relies a bit more on kill saves; the bot more on pickups.

**Arousal.** The player's taps follow the tension curve (r ≈ 0.5 in nearly every wave, up to 0.8). Across waves, the player grabs pickups faster when the wave is tenser:
- grabR −0.32 on the Strait;
- −0.28 on the Gauntlet;
- −0.58 on Harbor.

This matches the bot refit's finding that the player grabs faster as the stakes rise.

### Does it find the moments the player liked?

Before the Best moment row existed, the scorecard already asked for the best and weakest **wave**:

| Run | Player's best wave | Highest tension peak | Saves with stakes / clutch | Player's weakest wave | Flattest wave |
|---|---|---|---|---|---|
| Strait | 10 | **10** (2.69) | **10**: both stakes saves | – | 1 (0.24) |
| Gauntlet | 10 | **10** (2.33) | 10: a clutch repair save | 1 | **1** (0.18) |
| Harbor | B3 | **B3** (2.13, the only "pinned" wave) | **B3**: a clutch kill save | 1 | **1** (0.11) |

On all three runs, **the wave with the highest tension peak is the wave the player liked most**, and the wave they liked least is the flattest. That is three runs, so it is only a hint, not proof. The per-wave ratings (below) test it properly: every wave the player rates gets its own fun and intensity score, given straight after the wave, not recalled at the end.

### The reference maps, bot report (v27 build)

The "you" bot, the player's Armory, 24 seeds, `--kits=plan`, normal loss limit, on the **v27 build** (#165: a softer Harbor B3, supersonics that sit on the rail 0.4 s and lift off slowly). Saves per run on each wave, over the runs that reached it. Boss rounds were reached by 13–14 runs on the Strait, 12 on the Gauntlet and 7–8 on Harbor, so read them loosely. Shapes: the most common shape; f = flat, 1 = one peak, s = sawtooth, sr = sawtooth rising, p = pinned.

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Strait** saves | 0 | 0 | 0 | 0.17 | 0 | 0.04 | 0.12 | 0.08 | 0.26 | 0.23 | 0.14 | **0.71** | 0.08 |
| noise floor | 0 | 0 | 0 | 0.08 | 0.08 | 0 | 0 | 0.04 | 0 | 0.14 | 0 | 0.21 | 0.15 |
| tension peak | 0.24 | 0.21 | 0.58 | 1.13 | 0.68 | 0.91 | 1.07 | 0.97 | 1.32 | 2.01 | 0.99 | 1.04 | 1.43 |
| shape | f | f | f | 1 | f | 1 | 1 | 1 | 1 | 1 | 1 | f | p |
| **Gauntlet** saves | 0 | 0 | 0.08 | 0 | 0.12 | 0.17 | 0.33 | 0.38 | 0.18 | 0.22 | 0.50 | 0.50 | 0.33 |
| noise floor | 0 | 0 | 0 | 0.04 | 0 | 0 | 0.08 | 0.12 | 0.09 | 0.06 | 0.25 | 0.17 | 0.08 |
| tension peak | 0.19 | 0.19 | 0.81 | 0.84 | 0.93 | 1.07 | 1.02 | 1.03 | 1.16 | 1.88 | 0.69 | 0.74 | 0.91 |
| shape | f | f | f | 1 | 1 | 1 | 1 | 1 | 1 | sr | f | f | 1 |
| **Harbor** saves | 0 | 0 | 0 | 0.17 | 0.12 | 0.17 | 0.17 | 0.09 | 0.48 | 0.40 | 0 | 0.62 | 0.29 |
| noise floor | 0 | 0 | 0 | 0.04 | 0 | 0.04 | 0.04 | 0.09 | 0.10 | 0.13 | 0.25 | 0 | 0.29 |
| tension peak | 0.12 | 0.71 | 0.68 | 0.77 | 0.98 | 1.03 | 0.98 | 1.22 | 1.33 | 1.24 | 0.98 | 1.33 | 1.21 |
| shape | f | f | f | f | 1 | 1 | sr | 1 | sr | s | f | s | 1 |

Hot share rises from 0% on waves 1–2 to 4–8% by wave 10. In the boss rounds it reaches 24% on the Strait's B3 and on Harbor's B2. Full tables are in `tools/v3/map-report/results/<map>-player.md`, section "Fun".

**Against the v26 build** (the first run of this page):
- **Waves 1–6 barely moved.** Supersonics matter little there.
- **Waves 7–10 have a few more saves** (Strait w7–9 0.04–0.13 → 0.08–0.26; Harbor w9 0.27 → 0.48, w10 0 → 0.40 with 0.20 big). Harbor's waves 7 and 9 turned into rising sawtooths, and the Gauntlet's wave 10 became the Gauntlet's only rising sawtooth.
- **Harbor B3, as intended by #165, calmed down.**
  - Saves: 1.00 → 0.29, now at the noise floor.
  - Shape: pinned (27% hot) → one peak (12% hot).
  - The hot round moved to B2: 24% hot, a sawtooth, 0.62 saves.
- **Strait B2** went from 0.27 to 0.71 saves (noise 0.21), the clearest boss-round save on any map. The Strait's B3 is still pinned.
- **The Gauntlet's boss rounds** went from 0 / 0.15 / 0.23 to 0.50 / 0.50 / 0.33 saves, though the B1 noise floor is also 0.25.

v26 values, for the record (saves; shape):
- Strait: 0 0 0 .17 0 .04 .04 .04 .13 .17 | .20 .27 .15; f f f 1 f s 1 1 1 1 | 1 f p.
- Gauntlet: 0 0 .08 0 .12 .17 .33 .29 .22 .40 | 0 .15 .23; f f f 1 1 1 1 1 1 1 | f f 1.
- Harbor: 0 0 0 .17 .17 .08 .13 .48 .27 0 | .25 .62 1.00; f f f f 1 1 1 sr 1 s | 1 1 p.

What it says:
- **Waves 1–3 are flat on every map.** The tension never gets hot, and there is no save. That is right for wave 1 (it shows the map) and too quiet for waves 2–3.
- **Most waves 4–10 are a single peak.** The curve rises once and releases within about 2 s. Sawtooths (several peaks in a wave) are still rare: Harbor's waves 7, 9 and 10 and the Gauntlet's wave 10.
- **Tension does build over the map.** Each map's highest peak in waves 1–10 comes on wave 9 or 10.
- **The boss rounds hold the save-rich moments**, now Strait B2 and Harbor B2. On v26, Harbor's B3, the player's best wave, was the richest. The player has not played B3 on v27 yet.
- **The provisional check flags every map "flat"** (see below). This is a statement about the target, not only about the maps.

## Reading it honestly (what is uncertain)

- **On bot sweeps, the save counts sit near the noise floor.** The placebo (chance alone) finds about as many "saves" a wave as the real test does on the bot: for example, the Strait's wave 10 shows 0.17 real against 0.22 placebo. On the player's three runs it is clearer: 12 saves against 3 false ones (25%). So:
  - read single bot saves as noise;
  - read the **wave-by-wave pattern over many seeds**, and above all the **tension curve**, which has no dice.

  Raising `--fun-dice` lowers the noise at a proportional cost.
- **The target of 1–2 real saves a wave is far above what anyone makes.** By this strict definition, the player made 0.27 a wave on waves 1–10 and the bot 0.24. Either the target should come down (a first suggestion: about **0.3–0.5 a wave on waves 6–10 and about 1 a boss round, at least one with stakes per run**), or the definition should loosen. For example, the bot that plays on could be made "cold" (it must notice the threat first) instead of warm. The check row stays marked provisional until the player's per-wave ratings say which.
- **Kill saves are rare by design.** The warm bot covers for almost any kill that left more than about 1 s. A save therefore really means "nobody could have covered it".
- **The bot's saves are its own.** In the report, the action forked is the bot's, and the play-on is a bot too. The player's runs are forked the same way.
- **No player run replays on the current build.** The three playtest runs are v26; the game is now v27. Their results (above) are the v26 build's. Re-run `fit.ts --fun` on new playtests.
- **Gesture weapons** (press and release) are not forked yet.
- **The thresholds** (hot 0.75 and the rest) were set on three runs.

## What a map or wave designer should aim for (provisional)

- **Wave 1:** flat is fine.
- **Waves 2–5:** at least one peak a wave (peak about 1), released within about 2 s, and calm most of the time (calm share 70–85%). Today waves 2–3 are flat on every map.
- **Waves 6–10:** two or more peaks a wave, rising (shape "sawtooth rising"). Today almost every wave is a single peak.
  - To get there, split a wave's pressure into two or three raids with a breather (release) between them, the last one the biggest.
  - Put a moment that needs a quick answer in each: a heavy aimed at the danger stretch, or a drop landing just as a salvo arrives.
  - Aim for saves to show up: at least one in a third of runs on waves 8–10.
- **Boss rounds:** hot for a quarter of the round or more, with at least one save a round and a chance of a big one (stakes). Harbor's B3 is the model today.
- **Avoid "pinned" before the boss rounds** (hot for 30% of a wave or more): the player gets no release. Avoid many small saves with no stakes in one wave: that is chaos, not drama.
- **Check against the player.** After each playtest, compare the player's per-wave ratings (fun and intensity, from the draft) with each wave's tension peak and saves: the waves rated most fun and most intense should be the tensest, the least fun the flattest. If they keep matching, the tension curve can become a real check.

## Ground truth since revision 4: the per-wave ratings

The player, on the Kesh map card (2026-11-19), about Best moment: "the best part of the wave in the ranking is not a great mechanic it is still hard to recall what happened so not a great stat". So scorecard revision 4 retired it (`retired: 4`) and the ground truth is now the **per-wave ratings** (docs/design/v3-rate-and-review.md):
- on the weapon draft after each wave, an optional row asks for that wave's difficulty, fun and intensity (1–5) and a short note;
- they go into the log as `waveRatings` (`{ wave, step, at, rating, note? }`; no replay change, the log version stays), and a map card's score carries them as `waves`;
- the end screen suggests Best and Weakest wave from them (`bestSuggested`, `weakestSuggested`), so `best` / `weakest` are no longer recalled from memory either.

What to compare: per wave, the player's **fun** and **intensity** against the wave's tension peak, shape and saves. Intensity is the closer match to the tension curve (both say how hot the wave was); fun says whether that heat was enjoyable. A wave rated intense but not fun, with a pinned curve, is the "chaos, not drama" case above. Waves the player did not rate are left out, not counted as average. `tools/v3/test-lab/scores.mjs` (`waveRatingAverages`) averages them per wave over a map card's runs.

Revision 3 scores keep their `moment` and `momentT` and still read on the review page as before; they are simply no longer asked.

## The scorecard's Best moment (revision 3, retired by revision 4)

After a map card's full run, the scorecard has a new row, **Best moment**. It is optional and one tap:
- the player taps the wave strip;
- where the finger lands on the wave's chip says when in the wave (left edge = its start, right edge = its end);
- a tick marks the spot.

It saves the wave (`moment`) and the seconds into it (`momentT`), from the wave's length on the strip. It lives in `labResult.score` next to the other answers, so the play log's format and version are unchanged.

Adding a row bumped `SCORECARD_REV` to 3, so revision 3 scores average apart from revision 2's on the review page. The Test Lab page reads Best moment like Best wave.

## The chapter 1 playtest (2026-11-19, log v28)

Measured on the v28 build the runs were played on (`tools/v3/bot-fit/results/ch1-playtest-2026-11-19.json`, `tools/v3/bot-fit/playtest.ts`; per-run tables in `docs/design/v3-ch1-kesh.md` and `v3-ch1-marrow.md`, "After the playtest").

- **Saves:** Kesh 2 (clutch last-second kills, w10 and B2), Marrow 2 (clutch cover choices on the tower missiles, B1 and B3), Battery 1 (a kill save, w6). None with stakes. Pooled over the three runs: 0.07 saves a wave in waves 1–10 and 0.50 a boss round (the bot's mirrors: 0.13 and 0.33); taps follow tension r 0.49 (bot 0.43).
- **Best moment against the curve:** Kesh (wave 10, 35.7 s) is the run's highest-peak wave but falls in a lull 7 s before the wave's top and 9 s before its save; Marrow (wave 10, 44 s) is 2 s before wave 10's top, though B3 is that run's highest. Both match by wave, not by second. The player called the strip hard to recall; the per-wave rating at the draft (another change) should answer better.
- **The Battery run's "clutch nuke"** (pause note at step 6546): the nuke at wave 3, 24.7 s (step 6315), with the rack empty, a guided missile 0.6 s from a ship, a stealth bomber 1.8 s, drones 2.3 and 3.3 s. **The saves detector does not catch it**: in the branch without the grab the nuke is still on the water, and the warm bot grabs it itself on its first step (0 ships saved on 6 of 6 rolls). With the pickup gone from that branch (the new opt-in `gone`, `FunOpts.gone`) it is a nuke save: 1 ship on 6 of 6 rolls. The same option also finds Marrow's wave 10 nuke (1.17 ships), a Battery repair and a Kesh B2 weapon pickup. It stays off by default so earlier results compare; switching it on is the likely right reading of "removed", and would raise pickup and nuke saves on every report.

## The flat start, checked on every rebuilt map (log v30, 2026-11-19)

The player's v29 replays of Kesh and Marrow rated waves 1–4 fun 1, intensity 1, and lost nothing for 6–9 waves before a cliff. The tension curve showed the same: no wave hot (0.75) before wave 4–5 on the bot replaying the player's setup, and on the player's own runs before wave 4 (Kesh) and wave 8 (Marrow). Log v30 reshapes both (`docs/design/v3-ch1-kesh.md`, `v3-ch1-marrow.md`, "After the v29 replay"); the first hot wave on the player's setup is now 3.4–4.0.

The three reference maps on the same measure (their `-player` bot reports, v29 build, 24 seeds; unchanged by v30 apart from the boss calm). Tension peak a wave 1–5, and the first wave whose most common shape is a peak:

| Map | Peak w1 | w2 | w3 | w4 | w5 | First peaked wave | Lost w1–5 | Player's score |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The Strait | 0.24 | 0.21 | 0.58 | 1.13 | 0.68 | 4 (w5 flat again) | 0.38 | 4–5 |
| The Gauntlet | 0.19 | 0.19 | 0.81 | 0.85 | 0.93 | 4 (w3 hot in 46%) | 0.58 | 4–5 |
| Harbor Mouth | 0.12 | 0.72 | 0.68 | 0.76 | 0.98 | 5 | 0.92 | 4–5 |
| Kesh, v29 → v30 | 0.04 | 0.36 → 0.41 | 0.54 → 1.22 | 1.02 → 1.34 | 0.79 → 1.03 | 4 → 3 | 0.50 → 0.38 | 3 |
| Marrow, v29 → v30 | 0.05 | 0.27 | 0.50 → 0.61 | 0.56 → 1.11 | 0.65 → 0.91 | 8 → 4 | 0.04 → 0.25 | 3 |

So the reference maps have a milder version of the same flat start (waves 1–2 flat everywhere, the first peak on wave 3–5), but they lose ships steadily from wave 3 and climb without Kesh's and Marrow's late cliff. They were not changed (the player rated them 4–5).
