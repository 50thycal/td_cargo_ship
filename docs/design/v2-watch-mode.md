# Straitwatch V2: watch mode (round 9)

The player asked for a bot that plays like them. They want to watch it at 1–10× to check the game, instead of playing every test run. They asked for it as a Developer setting, with the bot also picking the cards, plus three companion ideas: take over mid-run, flag a moment, and a ghost check against their own runs.

## Success, from the player's side

| # | Goal | How it's checked |
|---|---|---|
| S1 | **It plays like me.** The tapping matches my logs, and so do the results. | Style metrics come from the same analyser on my logs and on bot logs. Each must be within ±25% (aim error ±10 px). Outcomes per map: Island mostly lost in waves 7–9, cleared at most 1 time in 4. Strait mostly cleared. Gauntlet in between. |
| S2 | **Easy to switch on, invisible to players.** Settings → Developer → Watch mode, one tap. | The e2e test turns it on and off. Without dev mode, nothing about it shows. |
| S3 | **Watchable.** At 1× it looks like a person playing: taps are visible and not frantic. At 10× it's smooth and the game really runs 10× faster. | Screenshots at 1× and 10×. Measure the real speed-up in headless Chromium (target ≥ 9× real time at 10×). Time a whole watched Island run. |
| S4 | **Take over at any moment.** One touch gives me control at 1×. One tap hands it back. It's always obvious who is playing. | The e2e test takes over by touching the battlefield, plays, then hands back. The control indicator is checked in screenshots. The log records each change of control and replays exactly. |
| S5 | **Flag a moment in two taps** without losing it. The game pauses while I pick a reason, and Claude can see that exact frame afterwards. | The e2e test adds a flag. A tool replays the log to the flag and screenshots the battlefield. The image is inspected. |
| S6 | **Ghost check.** After a game I play, the result screen shows what bot-me did on the same seed, and the wave where we split, within a few seconds and without freezing the screen. | The e2e test reads the ghost line. The longest main-thread block is measured. The ghost result is saved in the log. |
| S7 | **Claude can read every run.** Watched and mixed runs are logged, uploaded and replayable, with who played each stretch. | Unit test: a mixed bot/human log replays exactly. Log fields are inspected. |
| S8 | **Nothing else breaks.** The normal game is unchanged, every test and the e2e pass, and the layout fits iPhone landscape. | `npm test`, `e2e/v2.mjs`, and screenshots at 874×402 and 844×390. |

## What the player's logs say (the target for S1)

The baseline is 881 taps from the two v6 Island runs, `20261026144053-51908` and `20261027144051-41059`. Times are real seconds, corrected for the game speed in use.

- **Tapping:**
  - Taps come in bursts: median 3 taps, 6 at the 90th percentile, about 0.18 s apart.
  - The gap after a burst is long (90th percentile 1.9 s).
- **Aim:**
  - Median 35 px from the nearest threat (10th–90th percentile: 14–93 px).
  - 92% of taps land within tap range.
- **Tap results:**
  - fire 62%;
  - **dry 26%** (tapping with the rack empty);
  - pickup 6%;
  - empty water 6%.
- **Reaction:** from a threat appearing to the first tap on it, median 1.1 s (10th–90th percentile: 0.4–2.7 s).
- **Targeting:** the most urgent threat is chosen 48% of the time; otherwise it's whatever is near the finger.
- **Speed:** 82% of play at 1×, plus short stretches at 2–3×. Flow was changed 6 times and formation twice in two runs.
- **Cards:** the player stacks one card up its levels, then takes Resupply once the slots are full. Their picks across 8 logs include:
  - blast ×9, twin ×6, rhythm ×5, frigate ×4, smoke ×2, proxfuse ×2;
  - plus a few older cards.
- **Results:** Island lost at waves 7, 8 and 9. Gauntlet cleared once and lost once at wave 7 (older builds). Strait cleared 3 of 3.

For comparison, the old "average" balance bot taps one at a time, dead centre, never with an empty rack, and always at the most urgent threat. It wins the Island 6 times in 12.

## Cycle log

(One entry per build–test–review–improve cycle: focus, what was tested, findings, changes, retest.)

### Cycle 1: does the bot play like me? (S1)

**Built.**
- `src/v2/sim/mimic.ts`: the `Mimic` bot and its `YOU_V1` persona.
- `tools/v2/style.ts` (`npm run v2:style`): measures how a log was played.
- `tools/v2/fit.ts` (`npm run v2:fit`): bot runs side by side with the player's logs, plus results per map.

The bot acts only through the calls a touch makes, so a watched run records an ordinary log.

**Tested.** Six fitting rounds, each measured against the player's 881 taps, 8–16 seeds per map. A diagnosis run listed what sank the bot compared with the player.

| Round | What I saw | What I changed |
|---|---|---|
| 1 | The rhythm matched (0.18 s gaps). Aim p90 was 123 px against the player's 93, and empty-water taps 13% against 6%. It cleared Strait only 1/8. The diagnosis showed the bot losing its **carrier to ballistics**: half its bursts went to whatever was nearest its finger, ignoring missiles about to land. | Added a **panic rule**: a threat under ~1 s from impact always gets the next burst. Tightened the aim. A burst now often stops when its target dies. |
| 2 | Style closer, but first taps on drones came 1.58 s after they appeared (player 1.10 s). The player's "pause" figure turned out to include idle time with nothing on screen, so the bot's real decision gap was too long. | Shortened the gap between bursts when threats are waiting. Reaction median 0.75 → 0.6 s. |
| 3 | Reaction per threat type matched: drones 1.13 vs 1.10 s, ballistics 1.08 vs 0.98 s. But the bot tapped 60% more often, so **42% of its taps were dry** (player 26%). | The bot now notices an empty rack: it often waits for the reload before a burst, or stops a burst when a tap comes up dry. |
| 4–6 | Dry 23–28%, fire 63–68%, pickups 5–6%. "Most urgent" share stayed at 64–65% (player 48%) whatever I tried: lower base odds, a shorter panic window, targets picked by what catches the eye rather than the nearest. | Kept the eye-catch targeting, because it looks human. Set the gap between bursts to 0.5 s. |

**Result (16 seeds a map, `npm run v2:fit -- --seeds=16`):**

| Measure | Player | Bot | Within ±25%? |
|---|---|---|---|
| gap inside a burst | 0.18 s | 0.20 s | ✓ |
| taps per burst (median) | 2 | 2 | ✓ (90th percentile 6 vs 4) |
| reaction 10th / median / 90th percentile | 0.43 / 1.10 / 2.73 s | 0.28 / 1.07 / 3.63 s | median ✓ |
| aim, median / 90th percentile | 35 / 93 px | 35 / 80 px | ✓ |
| taps within reach | 92% | 95% | ✓ |
| fire / dry / pickup / empty water | 62 / 26 / 6 / 6% | 67 / 24 / 6 / 3% | ✓ (empty water 3 vs 6) |
| taps on the most urgent threat | 48% | 64% | ✗ (+33%) |
| gap after a burst (median) | 1.13 s | 0.80 s | ✗ (−29%) |

Results:
- **Island:** cleared 1/16, lost at waves 5–10 (median 7). The player lost at waves 7, 8 and 9.
- **Strait:** cleared 5/16. **Gauntlet:** cleared 3/16.

The player's Strait and Gauntlet clears were on older, easier builds. Two of these measures are outside the target. Both rest on 881 taps from two Island runs, so each new log the player sends will refine the fit.

**Unit tests added:** a bot game is identical for a seed and its log replays exactly; the bot taps in bursts, with some dry taps, one ship-flow change and at most one formation change; and it stacks cards, taking Resupply when its slots are full.

### Cycle 2: watch mode in the app (S2, S3, S7)

**Built.**
- Settings has a **DEVELOPER** section, shown only when Developer mode is on, with a **Watch mode** switch.
- In a watched run the bot drives the game through the same calls a touch makes.
- Its taps are drawn as gold fingertips.
- On a draft, its pick lights up with "Bot picks …" before it takes it. The pause is 1.4 s at 1× and 0.44 s at 10×.
- The speed rail runs 1 / 2 / 3 / 4 / 6 / 10×, and the last watch speed is remembered.
- The HUD reads `DEV ¼ · WATCH`.
- Logs carry `dev.watch`.
- New test: `e2e/v2-watch.mjs` (`npm run e2e:v2:watch`).

**Tested.**
- **Watched a ⅛ Island run at 10× in Chromium at iPhone landscape size (874×402).** I took screenshots of Settings, the menu, 1× and 10× play, a bot draft and the result. The whole run took 15 s of wall time with no page errors.
- **Measured the real speed-up**, sampling inside a wave without polling:

  | Speed setting | Measured | Notes |
  |---|---|---|
  | 1× | 1.00× | 60 fps |
  | 3× | 3.03× | 60 fps |
  | 6× | 6.05× | 60 fps |
  | 10× | 10.03× | 60 fps |
  | 10×, CPU throttled 4× (a stand-in for a phone) | 10.1× | 38 fps |

- **Checked logging and replay.** A watched ¼ Gauntlet run's log was pulled from the browser's storage and replayed with `npm run v2:replay`: **MATCHES** (score 13240, 1 sunk, 8108 steps).

**Found and fixed.**
1. **The second card of a stride draft never showed (a round-8 bug that also hit human ¼ and ⅛ runs).** The game deals the next draft without leaving the draft phase, and the screen only redrew when the phase changed. The old cards stayed up and tapping them did nothing. A/B check: without the fix the screen stays on "Wave 2 cleared" with stale cards; with it, "Wave 3 skipped" and the new cards appear. The fix redraws when the draft's wave changes. The e2e test now covers it.
2. **The bot never turned up ship flow in short runs.** Its timer (2–25 s) ran per wave, and ⅛ waves end sooner (screenshot: still ×1.4 at wave 4). It now times from the start of the run. Re-checked: a watched ¼ run reached flow 3 and changed formation to Box.
3. **At 10× every banner stayed up for 26 game-seconds.** That held the raid warning in its moved-up spot over the carrier (screenshot). Banner time now shrinks with the square root of speed: 2.6 s at 1×, 0.8 s at 10×.
4. **The frame loop allowed at most 12 steps a frame.** At 10× on a 30 fps phone that would cap the game at 6×. The cap now scales with speed, and any backlog is dropped rather than letting the game fall further and further behind.

### Cycle 3: take over and hand back (S4, S7)

**Built.**
- A control button on the right rail, shown only in watched runs. It reads **BOT** (gold) or **YOU** (cyan).
- **Taking over:** touching the battlefield while the bot plays takes over. That touch also counts as your first tap. Speed drops to 1× and a "YOU HAVE CONTROL" banner shows.
- **Handing back:** tapping the button hands back to the bot at the remembered watch speed. If you hand back during a draft, the bot makes the pick.
- **What changes hands:** while you have control, the bot doesn't act and your speed changes don't overwrite the watch speed.
- **Logging:** each change of control is logged as `[step, 'c', 'you'|'bot']`. Replay ignores it; `v2:style --who=you|bot` uses it to split the run.

**Tested.** A new e2e section runs a watched ½ Island run from wave 3 at 4×:
- **Speed:** the watch speed is remembered (the rail shows 4×).
- **Take over:** touching open water gives you control at 1× (screenshots before and after).
- **Bot stays off:** in 1.5 s of you having control, the bot made 0 taps.
- **Hand back:** your own tap on a threat, then BOT, returns control at 4×, and the bot taps again.
- **Log and replay:** the log shows `you→bot`. Replaying it in the page lands on the logged step exactly (865 = 865).
- **Unit test:** a bot → you → bot run with a flag replays exactly (score, losses, wave, steps).

**Found and fixed.**
- **The control button's hint was unreadable.** It was 8 px and wrapped to two lines ("playing · tap to take over"), too small on a phone. It's now a one-line 10 px label ("take over" / "hand back") under BOT / YOU. The banner on each change explains the rest.
- **A test-helper bug** in the new e2e (the page call dropped its argument) made the first run crash on the replay check. Fixed. This was a fault in the test, not the game.

### Cycle 4: flag a moment (S5)

**Built.**
- **The 🚩 button.** It sits at the foot of the left rail in every dev run, watched or played. Tapping it freezes the game on that step and asks what it is: **Bug · Looks wrong · Too hard · Too easy**, or Cancel.
- **What a pick does.** It writes `[step, 'g', kind]` into the log, saves the run at once (so the flag reaches Claude even if the app is closed straight after) and resumes. A "🚩 FLAGGED: TOO HARD — wave 6, 11 s in" banner confirms it.
- **The moment tool:** `npm run v2:moment -- log.json`, in `tools/v2/moment.mjs`. It loads the built game, replays the log to each flag through a new `showMoment` hook, and saves PNGs at iPhone landscape size: at the flag, and 1 s and 2 s before.

**Tested.**
- **Flagging in a watched run.** A watched ½ Island run, wave 6, at 2×: flagged with four threats in the air.
- **Pausing.** The game paused on step 639 and stayed there for 0.8 s with the dialog up. The flag was logged as `[639, 'hard']`, and the game resumed afterwards.
- **The tool's frames.** I ran the tool on that log and put the rebuilt frame next to the live screen behind the dialog. They match:
  - two missiles in flight over the top lane, plus one off the left base;
  - the heavy missile with its 8-pip bar south of the island;
  - the surfaced sub on the right, firing;
  - the Box formation, flow ×2.4, and 1 round left in the rack.
- **Automated check.** A new e2e section repeats this: the flag lands on the paused step, the game doesn't advance behind the dialog, and play resumes after.

**Found and fixed.**
- **The look-back missed what you flagged at high speed.** At 10× there is about 1 s of real reaction time between seeing something and tapping 🚩, which is about 10 game-seconds. Fixed "−1 s / −2 s game time" frames would show the aftermath, not the cause. The tool now reads the speed the log says was on at the flag and looks back in the player's real seconds. Re-run at 2×: the "−2 s" frame is 4 game-seconds earlier and shows the strafing-run and barrage warnings that led up to it.
