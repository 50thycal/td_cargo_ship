# Straitwatch V2 — playtest log

Build → test → review → improve cycles run on V2. Each cycle has one focus,
the checks actually performed, what they showed, and what changed.

## What success looks like (from the player's side)

| # | Goal | How it is checked |
|---|---|---|
| S1 | **Readable and tappable on a phone.** Every threat is visible at landscape-phone size; a tap on what you aimed at hits it; the rails work with a thumb; nothing important is covered. | Chromium at 844×390 with real touch taps; screenshots inspected; tap hit-rate measured with aim error |
| S2 | **Fair, escalating challenge.** Wave 1 is easy, difficulty climbs visibly, each threat type is telegraphed so a loss feels like your mistake, and no wave has long dead air. | Per-wave sim telemetry (warning time per threat, idle gaps, losses by cause); bot runs at human reaction speeds |
| S3 | **The controls do what they say.** Flow visibly changes ship spacing and the multiplier; formations change mid-wave; speed and pause work. | Browser E2E with screenshots before/after each control; overlap checks |
| S4 | **Upgrades matter.** Every card makes a noticeable, correctly described difference. | Per-card ablation in the sim; visual check of the cards that draw something |
| S5 | **Progression has no dead ends.** Clear → unlock → next map; bests persist across reloads; endless, retry and quit all work; resize/rotate is safe. | Browser E2E across the whole flow, including reload |
| S6 | **Smooth.** No frame drops in the busiest late wave at max flow and 3× speed on a phone-sized screen. | Frame-time measurement in Chromium |
| S7 | **You always know what happened.** Ship lost, carrier hit, rack empty, and why the run ended are all obvious. | Screenshots at those moments |

## Cycles

(See below; each cycle is appended as it is run.)

### Cycle 1 — Phone readability and touch (S1, S7)

**Checks run.** Chromium with touch emulation at 667×375 (iPhone SE landscape)
and 844×390 (iPhone 12 landscape), `deviceScaleFactor: 2`. A script tapped the
most urgent uncovered threat with real `touchscreen.tap` calls and Gaussian aim
error, counting whether each tap launched an interceptor. Screenshots were
taken mid-wave and at the moment a "NEW threat" banner appeared, on all three
maps.

**Measured.**

| Viewport | Map / wave | Aim error (σ) | Taps | Hit rate |
|---|---|---|---|---|
| 667×375 | Strait w1 | 10 px | 8 | 100% |
| 667×375 | Island w7 | 10 px | 21 | 100% |
| 844×390 | Island w7 | 10 px | 26 | 92% |
| 844×390 | Island w7 | 18 px (sloppy) | 24 | 79% |

Rail controls measured 64×48 (formation, pause) and a 44 px-wide slider track,
which is thumb-sized. No page errors.

**Problems found.**
1. At 844×390 the battlefield fills the full height, so the HUD pill sat on top
   of the north shore and **hid the centre launch base** — the one drones and
   ballistics come from.
2. The "NEW: …" banner appears at the exact moment a new threat launches, and
   at 22% height it **covered the island bases** and the threat's first second
   of flight.
3. After moving the banner, its hint text wrapped to two lines at 667 px and
   clipped the carrier.

**Changes.** The HUD (wave, score, sunk pips) moved into the right rail above
pause, so nothing sits on the battlefield. Each map now has a `callout` anchor
on friendly shore or open water away from bases and lanes; banners pin to it in
screen space and follow resizes. Hint copy shortened to fit one line.

**Retest.** Re-screenshotted the debut banner on all three maps at 844×390,
667×375 and 1280×720: every base visible, banner on one line, carrier clear.

### Cycle 2 — Pacing, warning time and difficulty curve (S2)

**Checks run.** Instrumented sim runs on every map, recording per wave: wave
length, the longest stretch with nothing in the air ("dead air"), and each
threat's time-to-impact at launch (how much warning the player gets). Losses
per wave over 16 seeds for the average and casual bots. The bot gained a miss
rate taken from cycle 1's phone measurements (8% careful, 20% sloppy) so its
results reflect taps that really miss. A phone-size screenshot of a ballistic
early in flight.

**Problems found.**
1. **Ballistics gave ~0.7 s of real warning.** Median time-to-impact was
   exactly 1.4 s on every map and wave — the code's floor — and the red impact
   circle only appeared at 50% of the flight. A person can't react and get an
   interceptor there in that time; the bots only coped because they react
   0.35 s after launch.
2. **Dead air in the early waves**: 11–13 s with nothing on screen in waves
   1–3 (wave 1 was two swarms over 32 s, and slot jitter could push the first
   launch past 15 s).
3. **Guided missiles from the Gauntlet's south shore** arrived in a median
   1.4 s by wave 10 — brutal for a threat that needs two hits.
4. Making threats readable flattened the curve: the casual bot cleared
   81% / 75% / 63%, so the Island was barely harder than the Strait.
5. **Ballistics flew off the top of the screen** at the top of their arc
   (screenshot; measured y = −16, −56, −7 on the three maps), so for part of
   the flight they could be seen but not tapped.

**Changes.** Ballistic flight has a 2.6 s floor that shrinks with wave speed
(2.3 s → 1.7 s), and the impact circle shows from 25% of the flight. Guided
missiles leave the rail slowly (30% → 100% speed over 1 s) and take only half
of each wave's speed-up. Early waves have more, smaller swarms, and launch
jitter stays in the middle half of each slot. Map threat scales went to
1.0 / 1.2 / 1.4. Ballistic arcs are capped so their highest point stays on
screen (with a new test).

**Retest.**

| | Before | After |
|---|---|---|
| Ballistic warning (median) | 1.4 s, all waves | 2.3 s (w3) → 1.7 s (w10) |
| Guided warning (median, w5–10) | 1.4–4.5 s | 2.7–5.6 s |
| Dead air, waves 1–3 | 9.9–13.4 s | 5.4–8.2 s |
| Casual clear rate (Strait / Gauntlet / Island) | 42% / 33% / 0% (old bot, no misses) | 81% / 63% / 38% (with misses) |
| Highest ballistic point | off screen | y = 26 on every map |

Casual losses are near zero for waves 1–3 and climb from wave 5 onward on every
map, which is the escalation we want. The average bot (0.6 s reactions, 8%
misses) still clears every map — it never gets distracted, so real players
will do worse; their playtests should set the final numbers.

### Cycle 3 — Do the controls do what they say? (S3)

**Checks run.** A sim script switched between every pair of formations (12
switches) at maximum flow on the Strait and the Gauntlet, counting overlapping
hulls before, during and 8 s after the switch. Throughput (ships per minute)
measured at every flow step in every formation. In Chromium at 844×390 with
touch: each speed step timed against the wall clock, pause via button and
Space, Resume, the flow slider to max, the formation popup, and screenshots
through a Pairs → Column switch.

**Problems found.**
1. **Formation changes stacked ships on top of each other — permanently.**
   Box → Column left 18 overlapping hull pairs; Pairs → Column 8; Box → Pairs 6.
   Ships launched abreast were re-slotted into one lane at the same x, and
   nothing on the rails could separate them.
2. **Lane changes crossed hulls.** Re-slotting by x alone sent the bottom ship
   of a pair (7 px ahead from spawn jitter) to the top lane, straight across its
   neighbour.
3. **Spawn backlog.** At max flow in Column the follower only reached full speed
   at a 96 px gap while ships spawned every 76 px, so a queue built off-screen
   and new spawns appeared on top of waiting ships (caught by the new
   regression test, not by the on-screen-only script).

**Changes.** Ships now keep station on the rails: a hull eases off when the
ship ahead in its lane is inside 66–74 px, and only moves across into a new
lane once that stretch of lane is empty. Re-slotting treats ships abreast as a
row and keeps their top-to-bottom order. A spawn waits until the entry is
clear. New test: zero overlaps through all 12 switches at max flow on two maps.

**Retest.**

| Check | Result |
|---|---|
| Overlaps during/after every switch (both maps) | 0 / 0 (was up to 18 / 18) |
| Throughput vs target, all flows × formations | on target; max flow Column/Spread 30.0 vs 31.6 per min (entry hold) |
| Speed slider 0.5× / 1× / 2× / 3× | measured 0.49 / 1.00 / 2.01 / 3.01 game-s per real-s |
| Pause button, Space, Resume | game time frozen; resumes |
| Formation popup | opens, applies, closes on pick |

Screenshots of Pairs → Column show ships holding their lane for a moment, then
falling into a clean single file; at max flow the merged file bunches briefly
near the entry and spreads out again, which reads as traffic rather than a bug.

### Cycle 4 — Do upgrades matter? (S4)

**Checks run.** Per-card ablation on the Island (the hardest map) with the
casual bot: each card granted at max level from wave 1, normal drafting
otherwise, clear rate over 24 seeds, then 72 seeds for the cards near the
noise floor. Hold to Fire, which only exists in the UI, was tested in Chromium:
one press held for 2 s while following a swarm, then a release, then the same
hold without the card. A screenshot with Shore Battery, CIWS, Chain and Twin
active. Every card's text was checked against the code.

**Noise floor.** Hold to Fire does nothing in the sim, yet its arm read 25% vs
a 38% baseline at 24 seeds (only the later card offers changed). At 72 seeds the
same control read 29% vs 35%, so differences under ~6 points are noise.

**Measured (casual bot, Island; baseline 35–38%).**

| Card | Clear rate with it | Gain |
|---|---|---|
| Faster Interceptors | 71–79% | large |
| Twin Launch | 79% | large |
| Wide Warhead | 75% | large |
| Chain Detonation | 58% | medium |
| Carrier CIWS | 54% | medium |
| Bigger Rack / Quick Reload | 50% | medium |
| Early-Warning Radar | 49% | medium (from L2 jamming) |
| Auto-Retarget | 43% → **53%** after fix | small → medium |
| Shore Battery | 44% → 43% after fix | small (see below) |

**Problems found.**
1. **Auto-Retarget barely did anything** (+8, near noise): it only acted once a
   target was already dead and looked 260 px around, often picking a threat
   already covered.
2. **Shore Battery was a re-route, not an upgrade** (+9): it shared the
   carrier's ammo and only changed where the shot left from.
3. **Quick Reload's text was wrong**: "18% faster" really meant 18% less time
   per round (a 22% faster rate).

**Changes.** Auto-Retarget now looks 450 px and prefers threats nobody is
covering. Shore Battery has its own 4-round rack that reloads alongside the
carrier's, is drawn above the battery, and a tap fires from the nearest launcher
that is loaded (ammo pickups and overdrive fill both). Card text corrected for
Quick Reload, Auto-Retarget and Shore Battery.

**Retest.** Auto-Retarget: 53% vs 35% baseline at 72 seeds (+18, was +8). Shore
Battery still measures ~+8 for the bot — like Rack and Reload, extra ammo helps
a slow reactor only a little, because reaction time rather than ammo is what
limits it. Its real value for a person is shorter interceptor flights on its
side of the map, which the bot doesn't capture; left as a known modest card.
Browser: Hold to Fire fired 8 shots from one 2 s press and 0 after release;
without the card the same hold fired once. The battery and its rack render
(screenshot). That the battery fires from its own rack when nearer, and answers
a tap over an empty carrier, is covered by a new unit test (an earlier draft of
this entry claimed the screenshot showed it; it didn't — the battery's rack was
still full in that frame).
