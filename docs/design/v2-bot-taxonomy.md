# Straitwatch V2: bot vs player taxonomy and bot personalities (round 12)

The player asked how the watch-mode bot compares with their own logs, knob by knob. Examples they gave:
- time to tap a missile or a drone;
- the rate between taps;
- and a layer deeper than that.

They asked for:
- the full taxonomy of those interactions;
- the bot calibrated against it;
- the noise in their play (distracted, rushing) turned into bot settings, with at least seven personalities.

## Success, from the player's side

| # | Goal | How it's checked |
|---|---|---|
| T1 | **Every interaction is measured.** Each knob I use is in the taxonomy, and one command compares my logs with bot logs. The knobs are taps (when, where, on what, and with what result), pickups, flow, formation, game speed and cards. | `npm run v2:taxonomy` runs on my real logs and prints every knob by family: my value, my run-to-run spread, the bot's value, and pass/fail. |
| T2 | **The "you" bot plays like me, knob by knob.** | A knob passes when the bot's value is inside my own run-to-run spread (widened by 10%) or within ±20% of my pooled value. Target: ≥ 80% of knobs pass, and every **headline** knob passes. Headline knobs: reaction to drones, ballistics and guided missiles; tap gap; burst length; pause; aim; urgent share; dry share; two-thumb share; mean game speed. |
| T3 | **It gets my results.** On my maps and my seeds, the bot reaches the waves I reach. | Bot median wave within ±1 of mine on Strait and Island. Ships lost per wave follow the same shape. |
| T4 | **My noise is in it.** It is sometimes distracted and sometimes rushing, like me. Its spread across runs looks like my spread across runs. | Knobs for lapses (looking away with threats on screen) per minute, per-wave variation of tap rate, and the fatigue drift in reaction. The bot's spread across seeds should match my spread across runs. |
| T5 | **At least seven personalities, each recognisably different, with sensible results.** | Each persona differs from every other on ≥ 3 knobs by more than my own spread. Results come out in a sensible order: try-hard ≥ me ≥ casual ≥ novice. Rusher and distracted lose more often than me. |
| T6 | **I can pick one and watch it.** Settings → Developer → bot personality. The ghost check stays "me". The log says which persona played. | e2e: pick a persona, watch it at 1× and 10×, take over and hand back, then read the log. Screenshots of the picker on an iPhone landscape viewport. |
| T7 | **Nothing breaks.** The normal game is unchanged, the old watch logs still replay, and every test passes. | `npm test`, `npm run build`, `e2e/v2.mjs`, `e2e/v2-watch.mjs`. |
| T8 | **Honest about the limits.** The report says which knobs still miss, and why. | Final section of this doc. |

## The data

| Log | Map | Who | Notes |
|---|---|---|---|
| 20261026144053-51908 | Island | me | wave 9, 560 taps, mean speed 1.12× |
| 20261027144051-41059 | Island | me | wave 7, 321 taps, mean speed 1.36× |
| 20261028154416-30594 | Strait | me | wave 10, 520 taps, mean speed 1.29× |
| 20261028210213-31486 | Strait | me | wave 10, 666 taps, mean speed 1.23× |
| 20261028095500-45817 … 20261029135055-49676 | Harbor, Archipelago, Strait | watch bot (phone) | the bot in the real app, so it's checked to replay like a headless run |

All four human runs are format v6 and replay exactly, so every knob that needs the game state can be measured. Examples of such knobs: which threat a tap went to, aim, reaction and urgency.

Older v4/v5 logs don't replay on this build. They are used only for knobs that need no game state: tap rhythm, rails and cards.

## The taxonomy

`tools/v2/taxonomy.ts` replays a log once and keeps a record of every tap, threat, pickup, rail change and lapse. `METRICS` turns those records into the knobs below. `npm run v2:taxonomy -- logs…` plays the bot on **the same map and seed** as each of the player's runs, so both face the same waves, and prints every knob side by side.

Real seconds are used for knobs about the person, such as reaction, rhythm and lapses. The player's game seconds are divided by the speed slider. The bot's are divided by its persona's speed.

| Family | Knobs |
|---|---|
| A reaction | Time from a threat appearing to the first tap in reach of it: overall, at p10/p50/p90, and per kind (drone, ballistic, guided, supersonic, strafer, bomber, heavy, minidrone). Plus the share of each kind never tapped. |
| B rhythm | Gap between taps (p10/p50/p90). Gap inside a burst. Taps per burst (mean, p90, share of single taps). Pause between bursts (p50/p90). Taps per active second. Taps with nothing on screen. |
| C hands | Two-thumb taps: two taps < 0.12 s apart and > 350 px apart, which one thumb can't do. Left/right and top/bottom share. Finger travel inside a burst. |
| D aim | Distance to the target (p50/p90). Share in reach. Lead or lag along the threat's heading (drones, guided). Miss across the heading. Distance on ballistics. |
| E targeting | Share of taps on the most urgent threat. Mean urgency rank. Threats on screen at a tap. Whether a threat under 1 s from impact gets the tap. Target changes inside a burst. Shots at a threat whose interceptor is already away. Shots per kill. |
| F results | Fire, dry, pickup and empty-water shares. Dry taps in a row. Gap after a dry tap. Taps while the rack is empty. |
| G pickups | Share collected. Time to collect. |
| H rails | First flow change. Flow step reached. Formation changes per run. Mean game speed. Raid warning → next tap. |
| I cards | Picks that level a card already held. Resupply taken when offered. |
| J noise | Lapses: ≥ 2.5 s with a threat on screen for ≥ 0.5 s and no tap, counted per minute, and their length. Wave-to-wave CV of tap rate and of reaction. Last third ÷ first third of the run, for reaction (fatigue) and for tap rate. |
| K outcomes | Wave reached. Ships lost by wave 5. Carrier hits by wave 7. Kills per wave. |

**Scoring a knob.**
- **Headline knobs** pass when the bot is within ±20% of the player's pooled value. A few knobs use their own tolerance: game speed ±6%, two-thumb share ±35%, and small shares get an absolute slack.
- **The other knobs** also pass when the bot lands inside the player's run-to-run spread, widened by 10%.

**The ceiling.** As a check on the ruler, each of the player's runs was scored against their other three:
- one run of theirs passes **57–93%** of the knobs, 74% on average;
- it passes **8–10 of 11** headline knobs.

A pooled set of 16 bot games is less noisy than one run, so ≥ 80% stays the target.

## Cycle log

### Cycle 1: the taxonomy and the first true 1:1 comparison (T1)

**Built.**
- The trace and metrics: 70 knobs in 11 families.
- The CLI, which matches each human run with 4 bot games on the same seed (the bot's `dice` option).

**Verified.**
- All 9 new logs replay exactly.
- The five watch-mode runs from the player's phone match a headless bot game command for command up to the first draft. So the bot in the app *is* the bot in the tools; the draft's on-screen timing makes the runs part ways after that.

**Findings: `you-v1` against the player's 4 runs, 16 games.**
- **44/69 knobs pass (64%). Headline: 3/11.**
- **Reaction.** The median is right (1.18 s vs 1.08 s), but the spread is too wide: p10 0.30 vs 0.51, p90 4.0 vs 2.5.
  - The player is quicker on **ballistic launches** (0.88 s vs the bot's 1.15 s).
  - The player is slower on **supersonics** (1.73 s vs 0.85 s) and on bombers.
- **Rhythm.** Bursts are too short (2.3 taps vs 2.9) and pauses too short (0.77 s vs 1.07 s).
- **Speed (new finding).** The player plays at a mean **1.18× game speed** (1.12–1.36× per run). The bot plays at 1×. So in game time the player's reactions are ~20% slower than their real ones.
- **Hands (new finding).** **3% of the player's taps are two-thumb taps**, 4–5% on Strait. These are alternating left/right taps on two threats at once. The bot has one finger.
- **Aim.** The bot lags 0.12 s behind its target: −5 px on drones, −17 px on guided. The player leads slightly (+3 px). The player's far tail is longer (p90 110 px vs 78).
- **Targeting.**
  - The bot goes for the most urgent threat too often: 62% vs 48%, and 79% vs 53% when a threat is under 1 s out.
  - It switches targets inside a burst too rarely: 25% vs 41%.
  - It fires at threats that are already covered: 31% of its shots vs 20%. That means 1.70 shots per kill vs 1.34.
- **Results.** Too many dry taps (30% vs 19%). After a dry tap the bot waits 0.55 s; the player keeps going (0.20 s).
- **Noise.**
  - The player's lapses last longer (5.1 s vs 2.9 s).
  - The player's tap rate varies more from wave to wave (CV 0.21 vs 0.09). The player has moods; the bot doesn't.
- **What already matched.** Gap and in-burst gap, taps per active second, aim median, pickups, rails, cards, and the per-run outcomes: bot mean wave 8.0 vs the player's 9.0, within the spread.

**Changes going into cycle 2.** These are new persona knobs. All of them are off for `you-v1`, and they draw no dice when off, so `you-v1` games stay bit-identical; this was re-checked against the five phone logs.
- `speed`
- `reactBy` and `reactFloor`
- `aimBy`
- `panicShare`
- `hop` and `hopReach`
- `dryStop`
- `coverSense`
- `interrupt`
- `twoThumb`
- `mood`
- `lapse`
- `fatigue`
- `cards: 'random'`

### Cycle 2: calibrating "you" (T2, T3, T4)

**Built.** A new `you` persona. `you-v1` stays for old watch logs and is pinned by a unit test to the phone log's first wave.
- **Ruler fix.** A trace of 30k steps took seconds, because it walked every threat ever seen on every step. It now tracks only threats still alive.
- **One new knob in the ruler.** "Shots at a threat already covered" (`target.overkill`). It explained the bot's 1.70 shots per kill.

**Tested.**
- **Random local search: dropped.** It ran over 32 parameters, scored by a weighted loss over every knob (4 workers, 8 games per step). It was too slow, about 2 min per step, and plateaued at a loss of ~84.
- **Targeted probes instead.** 3 variants per round, 16 games each. The leading candidates were then re-run on 24 games, using dice 4–5, which the fit never saw.

| Round | Result | What I saw | What I changed |
|---|---|---|---|
| 1 | 56/70, headline 9/11 | Lapses 1.28/min vs the player's 0.19. Reaction p90 4.0 s. | — (first guess) |
| 2 | 58/70 | Overkill didn't move, so it wasn't coming from picking burst targets. It comes from repeat taps on a covered threat **inside** a burst. | `coverSense` mid-burst: move to an open neighbour, or end the burst. |
| 3 | 59/70 | The player's long pauses come when the sky is empty. The bot's came while a threat it had seen was still up. | `interrupt`: a fresh threat cuts a rest short. `restCap`: with a seen threat up, a rest lasts at most 1.2 s. |
| 4 | 66/70 | Finger travel was 69 px vs 42 px. The player's aim error is large (p90 110 px) but their thumb barely moves inside a burst, so the error is a **persistent offset per burst**. | Tried `aim.jitter` (an offset per burst plus a wobble per tap). Travel was fixed, but target switching fell from 0.41 to 0.27. Then tried `aim.track` (a thumb that taps a patch of water): no gain, so removed. The jitter knob is kept for personas; `you` doesn't use it. |
| 5 | **66/70, headline 11/11** on 24 games | Dry share was just under tolerance (0.15 vs 0.19). | `dryStop` 0.05 (keeps tapping through an empty rack). `coverSense` 0.3. |

**Result: `you` vs the player's 4 runs, 24 games, same seeds.**
- **66/70 knobs (94%). Headline 11/11.** Baseline: 44/69 and 3/11.
- **KS distances.**
  - Reaction: 0.11 overall, 0.10 drones, 0.09 guided.
  - Tap gap: 0.15.
  - Burst length: 0.04.
  - Pause: 0.11.
  - Aim: 0.05.
- **Outcomes.**
  - Mean wave 8.1 vs 9.0.
  - Strait: mostly 10 (one 5, one 8, one 9) vs 10 and 10.
  - Island: 6–8 vs 7 and 9.
  - Ships lost by wave 5: 1.13 vs 1.25.
- **Still missing (4 knobs).**
  - Guided never tapped: 0.30 vs 0.13.
  - Supersonics never tapped: 0.40 vs 0.24.
  - Pause p90: 2.5 s vs 3.2 s.
  - Finger travel inside a burst: 68 px vs 42 px.
  - On the first two: the bot sees missiles about as late as the player does (the reaction medians match), but the player still gets to more of them. The player breaks off a burst for a missile in a way the bot doesn't fully capture.
- **By map** (only 2 runs each, so the spreads are narrow).
  - Strait: 55/69, headline 10/11.
  - Island: 53/70, headline 7/11.
  - The player plays the maps differently: on Island, 26% dry taps and no two-thumb taps; on Strait, 5% two-thumb taps. One persona averages the two. Fitting each map on two runs would be overfitting.

### Cycle 3: the personalities (T4, T5)

**Built.**
- **Eight personalities next to "you".** Each is the fitted "you" with a few knobs moved, so they share your hands and differ where that kind of player would:
  - try-hard
  - sniper
  - casual
  - tired
  - distracted
  - rusher
  - masher
  - novice
- **`npm run v2:personas`.** For every persona it prints:
  - its fingerprint on 22 knobs;
  - its results on the player's own seeds;
  - how many knobs tell each pair apart. A knob counts when the pair differs by more than the player's own run-to-run spread on it, or the knob's slack;
  - which persona each of the player's runs sits nearest. This is a distance over the person-side knobs, scaled by those widths.

**First run (8 games each).**
- Two pairs were too close:
  - **tired vs you: 1 knob.** The fatigue ratio barely moved (1.24 vs 1.07), and the player's own fatigue ratio already varies from 1.02 to 1.65 between runs.
  - **distracted vs you: 2 knobs.**
- **Results came out in a sensible order:**
  - try-hard 9.0
  - sniper 8.5
  - you 8.1
  - casual 7.9
  - novice 5.8
  - rusher 7.4 and distracted 7.9 both below you.

**Changes.**
- **Tired.** Fatigue 0.6 → 1.5 per 5 minutes, pauses ×1.15, and a new `lapse.grow`: look-aways come more often as the run goes on.
- **Distracted.** 1.6 look-aways a minute (was 1.1), 7 s each (was 6), reactions ×1.3, mood 0.45.

**Retest.**
- **Every pair now differs on ≥ 3 knobs.** The closest pairs are you vs distracted, through reaction, lapses and tap-rate CV, and try-hard vs sniper, through reaction, gap and aim.

| Persona | Speed | Reaction | Burst | Taps/s | Aim p50 | Dry | Lapses/min | Mean wave (Island/Strait seeds) |
|---|---|---|---|---|---|---|---|---|
| your logs | 1.18× | 1.08 s | 2.9 | 2.2 | 38 px | 19% | 0.19 | 9.0 |
| you | 1.2× | 1.04 | 2.6 | 2.2 | 35 | 16% | 0.38 | 8.1 |
| try-hard | 1× | 0.82 | 1.7 | 1.6 | 25 | 10% | 0 | 9.0 |
| sniper | 1× | 1.07 | 1.2 | 1.3 | 16 | 2% | 0.26 | 8.5 |
| casual | 1× | 1.42 | 1.7 | 1.5 | 41 | 10% | 0.34 | 7.9 |
| tired | 1.2× | 1.32 (last third ÷ first: **1.88**) | 2.6 | 1.7 | 34 | 11% | 1.78 (rising) | 6.1 |
| distracted | 1.2× | 1.28 | 2.6 | 1.8 | 33 | 17% | **1.97**, 5.2 s each; tap-rate CV 0.41 | 6.0 |
| rusher | 2× | 0.90 | 3.5 | 3.4 | 47 | 10% | 0 | 7.4 |
| masher | 1.2× | 1.01 | 5.7 | 4.8 | 58 | 35% | 0.28 | 8.1 |
| novice | 1× | 1.30 | 3.5 | 2.5 | 54 | 27% | 0.30 | 5.8 |

- **Nearest persona to each of the player's runs: "you" for all four** (distance 0.51–0.62, next best ≥ 0.95). None of their four runs reads as a different personality. Their noise lives *inside* a run, and "you" now carries it: about 0.2 look-aways a minute, a mood that changes wave to wave (tap-rate CV 0.21), and the speed slider.

### Cycle 4: picking a personality and watching it (T6, T7)

**Built.**
- **Settings → Developer → Bot personality.** Shown while watch mode is on: one chip per persona plus the chosen one's description. It's remembered in the dev settings (`bot`).
- **What the run carries.** A watched run uses that persona. The log stamps `dev.bot`; a retry keeps the run's own persona, and an old watch log without `bot` retries as `you-v1`. The HUD names any persona other than you (`DEV ½ · WATCH · RUSHER`), and so does the menu strip.
- **The ghost check plays `you`** (its id in logs is now `you`).

**Tested in the browser** (Chromium, iPhone landscape 874×402 and 844×390).
- `e2e/v2-watch.mjs` now checks:
  - ≥ 7 chips, with "You" chosen by default;
  - tapping Rusher lights it up and shows its description;
  - a watched run's HUD says RUSHER;
  - the live log carries `{watch: true, bot: 'rusher'}`;
  - the ghost result is saved as `you`.
- The full watch e2e and the V2 smoke e2e both pass.
- **Screenshots.**
  - The picker wraps onto two rows inside the settings card, with no horizontal scroll at either size.
  - The longest HUD tag (DISTRACTED) fits the rail and clears the BOT button (bounding boxes checked).

**Finding: watching a fast player looked slow.** A persona's `speed` makes it take more game seconds per action, which is right for the numbers. But at watch 1× the rusher looked *slower* than you, not frantic.
- **Fix.** While the bot has the controls, the game runs at the slider × the persona's speed. 1× on the slider is then that player's real time.
- **Measured** (game seconds per real second):

| Bot and watch speed | Game speed |
|---|---|
| you, 1× | 1.20× |
| rusher, 1× | 2.00× |
| rusher, after taking over | 1.00× |
| casual, 1× | 0.99× |
| rusher, 10× (aiming for 20×) | 14.8× in headless Chromium: the frame budget caps it |

### Cycle 5: noise wave by wave, and rushing (T4)

**Focus.** The player said they're sometimes distracted and sometimes rushing. Run-level knobs can't show that, so five wave-level knobs went into family J. Each one looks at a wave against the rest of the same run:
- waves with a look-away in them;
- waves tapped ≥ 1.3× the run's usual rate (hot);
- waves tapped ≤ 0.75× (cold);
- waves reacting ≥ 1.4× slower than usual;
- waves played mostly above 1.25× game speed.

**Finding.** The player's noise is one-sided.
- 25% of their waves run hot, and only 6% run cold.
- 17% of their waves are played with the speed slider turned up.
- The bot had 2% hot waves and 0% sped-up waves. Its mood was symmetric and its speed constant.

**Built.**
- **`rush` persona knob.** On a share of waves, it turns its game speed up by `speed`×. With `tempo`, it also rests and reacts faster in real time on those waves.
- **The bot logs its own game speed.** It's a new UI-only `p` command; replay ignores it, as it ignores `s`, `c` and `g`. Both the ruler and watch mode follow it, so a rushed wave also plays faster on screen.
- **`you` settings.** Base speed 1.1×. One wave in five rushed at 1.4×.

**Tested.** 6 variants of rush share, speed and tempo, 24 games each.

**Results.**
- **Sped-up waves: pass.**
- **Hot waves: still miss.** They reached only 2–14%. The bot's tap rate is driven by threats arriving; the player taps more per threat when they rush.
- **First call: plain rush, no `tempo`.** It kept the most knobs passing (70/75).

### Cycle 6: regression after the rush change (T5)

**Found by the re-test.** The persona matrix was re-run after `you` started rushing, because every persona inherits from `you`. Distinctness had regressed:
- distracted vs you: 2 knobs;
- tired vs distracted: 2 knobs;
- after the next fix, try-hard vs sniper also fell to 2.

**Fixed.**
- **Distracted.** 2 look-aways a minute of ~8 s, eyes ×1.45.
- **Tired.** Shorter look-aways (3.5 s), so lapse length separates it from distracted.
- **Sniper.** Takes its time: eyes ×1.2, rests ×1.1.
- **No rushing** for try-hard, sniper, casual, rusher and novice. Each has its own fixed speed.

**Retest.** Every pair differs on ≥ 4 knobs.

### Cycle 7: did rushing cost the results? (T3)

**Found.** The final full comparison showed that the plain rush had cost results.
- Mean wave fell to 7.75, against the player's 9.0.
- Strait no longer mostly reached 10.
- 54% of supersonics went untapped.

A plain rush makes the game faster without the player's matching effort. That is the same gap the hot-wave knob shows.

**Re-tested** `rush.tempo` 0.75 and 0.6, and speed 1.3, on 24 games each, looking at knobs **and** results together.

**Chosen: `tempo` 0.6.** On rushed waves, rests and reactions are 0.6× in real time.
- 69/75 knobs, headline 11/11.
- Mean wave **8.2**.
- Supersonics untapped back to 40%.
- Hot waves 10%.
- Cost: reaction p10 now misses (0.31 s vs 0.51 s).

**Persona matrix re-run.**
- Every pair differs on **≥ 3 knobs**. Closest are casual vs tired and tired vs distracted.
- Results stay in order.

**Final checks.**
- `npm test`: 833/833.
- `npm run build`.
- `e2e/v2-watch.mjs` and `e2e/v2.mjs` both pass.
- Watch-mode pace in Chromium: you 1.10×, rusher 2.00× (1.00× after taking over), casual 1.00×.
- The phone's `you-v1` first wave still matches command for command.

## Where it stands against the goals

| # | Goal | Result |
|---|---|---|
| T1 | Every interaction measured | ✅ 76 knobs in 11 families. One command: `npm run v2:taxonomy`. `--json` exports them. |
| T2 | "You" plays like me | ✅ **69/75 knobs (92%), headline 11/11**, 24 games on the player's own seeds. `you-v1` scored 47/75 and 3/11. |
| T3 | Same results | ✅ by median. Strait: bot median 10 (11 of 12 games reached 9–10), player 10 and 10. Island: bot median 7 (games 5–9), player 9 and 7. ⚠️ The bot's mean wave is 0.8 lower (8.2 vs 9.0), mostly on Island. |
| T4 | My noise is in it | ✅ These pass: look-aways per minute and their length, wave-to-wave CV of rate and reaction, fatigue, waves with a look-away, slow-eyed waves, cold waves and sped-up waves. ❌ Hot waves: 25% vs 10%. |
| T5 | ≥ 7 personalities, distinct and sensible | ✅ 8 besides "you", and every pair differs on ≥ 3 knobs. Results order (mean wave, 12 games): try-hard 9.3, sniper 9.1, you 8.6, masher 8.5, casual 7.6, rusher 7.0, tired 6.8, novice 5.9, distracted 5.8. |
| T6 | Pick one and watch it | ✅ Settings picker, HUD tag, `dev.bot` in the log, the persona's own pace on screen, and the ghost check stays "you". Checked by e2e and screenshots. |
| T7 | Nothing breaks | ✅ Tests, build, both e2e suites, and old watch logs still retry as `you-v1`. |
| T8 | Honest about the limits | See below. |

**Final persona fingerprints** (12 games each, the player's 4 seeds):

| Persona | Speed | Reaction | Taps/burst | Taps/s | Aim p50 | Dry | Look-aways/min | Mean wave |
|---|---|---|---|---|---|---|---|---|
| your logs | 1.18× | 1.08 s | 2.9 | 2.2 | 38 px | 19% | 0.19 | 9.0 |
| you | 1.1× (+ rushes) | 0.98 | 2.7 | 2.4 | 35 | 18% | 0.13 | 8.6 |
| try-hard | 1× | 0.83 | 1.7 | 1.6 | 25 | 9% | 0 | 9.3 |
| sniper | 1× | 1.20 | 1.2 | 1.2 | 16 | 2% | 0.15 | 9.1 |
| casual | 1× | 1.43 | 1.7 | 1.5 | 40 | 11% | 0.30 | 7.6 |
| tired | 1.1× (+ rushes) | 1.38 (late ÷ early ×1.72) | 2.6 | 1.6 | 34 | 13% | 1.9, rising | 6.8 |
| distracted | 1.1× (+ rushes) | 1.32 | 2.6 | 1.7 | 33 | 21% | 2.1, ~6 s each | 5.8 |
| rusher | 2× | 0.90 | 3.5 | 3.4 | 46 | 11% | 0 | 7.0 |
| masher | 1.1× (+ rushes) | 0.94 | 6.0 | 5.0 | 58 | 35% | 0.18 | 8.5 |
| novice | 1× | 1.32 | 3.5 | 2.5 | 54 | 27% | 0.29 | 5.9 |

**Which persona each of the player's runs is nearest: "you", all four** (0.47–0.68, next best ≥ 0.93). No run of theirs reads as a different personality. The distraction and rushing they described happen *inside* runs, wave by wave, and that's where "you" now carries them.

## Limits

- **Four runs on two maps.** Island and Strait only. Knob spreads come from four points, and per map from two. Nothing was fitted on Gauntlet, Harbor or Archipelago. Each new log should go through `npm run v2:taxonomy` to see whether "you" still holds.
- **Map habits are averaged.** The player plays Island and Strait differently: on Island, 26% dry taps and no two-thumb taps; on Strait, 5% two-thumb taps. In cycle 2, "you" passed 53/70 (headline 7/11) on Island alone and 55/69 (10/11) on Strait alone. One persona averages the two.
- **Six knobs still miss.**
  - Missiles never tapped: the bot misses 32% of guided against the player's 13%, and 40% of supersonics against 24%.
  - The longest pauses: p90 2.5 s vs 3.2 s.
  - Finger travel inside a burst: ~67 px vs 42 px.
  - Hot waves: 10% vs 25%.
  - Fastest reactions: p10 0.31 s vs 0.51 s, the price of the rush tempo.
- **Bot results run a little low.** "You" ends about one wave earlier on Island than the player's mean.
- **Not measurable from logs.** How long a draft took, because the sim doesn't run during drafts. Hold-to-fire as a separate gesture, because it's logged as taps. Where the thumbs rest between bursts.
- **Fast watching tops out.** At watch 10× a 2× persona asks for 20×. Headless Chromium reached 14.7×, because each frame's step budget caps it. A phone may land elsewhere.
