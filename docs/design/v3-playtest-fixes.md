# V3: fixes from the 2026-11-20 playtest

Seven notes from your 2026-11-20 playtest (Island v31, Marrow, Behemoth and Kesh v32), and your four logs added to the bot fit. Built on round 9 (log v34) and the Needle of Bosk (log v35), so the game is now **log v36**.

- **Before** = the base with round 9 merged (log v34).
- **After** = this branch: log v35 for the measuring, before the Needle merged; now log v36.
- **The Needle:** checked again after it merged (below).
- Bot numbers come from the "you" bot with your Armory, 12 seeds a row, unless the row says otherwise. A gap under about 1 ship a run is noise.

Screenshots: `docs/design/img/playtest-fixes/` (`before-*` and `after-*`).

## 1. The NEW tag sits on top of the card

> "the label should be on top of the card and not overlapped on the middle of card"

- **What changed:** "NEW · The Narrows" is now a band across the card's top edge, in the card's colour. It was a pill over the middle of the art. The card makes room for the band.
- **Checked at 667×375 and 844×390:** the band starts at the card's top edge and ends above the art, and the cards fit with room to spare. The rating row is gone from the draft (fix 4), so the draft has more room than before.
- **Screenshots:** `before-draft-tag-667x375.jpg`, `after-draft-tag-667x375.jpg` and the same at 844x390.

## 2. Shield breaks after a number of hits

> "Shield is too OP the shield should break after x amount of hits not damage but actual hits"

**What changed**
- The Shield boost now breaks after a set number of hits:
  - **level 1:** 1 hit;
  - **level 2:** 2 hits;
  - **MAX:** 3 hits.
- Each missile, drone, shell, boat or torpedo it stops counts as one hit, whatever its damage.
- A single blast that reaches several hulls in the same step counts as one hit.
- The hit that breaks the shield is still blocked. You see "SHIELD BROKEN" and a burst.
- It still runs out at 15 s (18 s at MAX), whichever comes first.
- Level 2 still refunds a round per block, and MAX still reflects.
- The Shield *power-up* (the timed pickup) is unchanged.
- **On screen:** a row of pips over the carrier shows the hits left, and the last pip turns red. The bubbles crack as the shield wears down. See `after-shield.jpg`, taken at MAX with one hit taken.

**Why 1/2/3:** the combo sweep's singles (`npm run v3:combo-sweep -- --stage=singles --maps=island,behemoth --persona=you`) give each weapon's ships lost per run, with every wave played. Rank is out of 20.

| Shield, levelled to MAX | The Island | The Behemoth Run |
| --- | --- | --- |
| v33 (the base this round started from) | #4, 8.00 | **#1**, 8.75 |
| v34 (round 9 merged), never breaks | #3, 7.25 | #3, 7.08 |
| **v35, 3 hits at MAX** | **#11**, 9.75 | **#9**, 11.33 |

- On a shield that never breaks (the old one), a pickup stops about 2.5 hits on average. The long tail of 8 to 27 hits is where the old Shield got its strength.
- With 5 hits at MAX it stayed #3 on both maps.
- With 2 it fell to #15 on the Island.
- 3 puts it mid-pack on both.
- Files: `tools/v3/combo-sweep/results/v35-ch2-playtest-fixes/singles.json` (after) and `v34-ch2-before-playtest-fixes/` (before). The tables are in `tools/v3/playtest-fixes/results/singles-v3{4,5}.txt`.

## 3. The attack helicopter fires as soon as it can

> "it doesn't need to go to a specific spot it should just start hitting targets"

**What changed**
- The helicopter fires a missile pair whenever it is on screen: on the way in, while settling and on the move. Before, it fired only once it hovered at its spot.
- It still flies to a spot beside the lane, moves on after two volleys there, and leaves after six.
- A Gunship Wall's helicopters still hold fire until the wall opens.
- The bot's sense of when a helicopter will fire follows the new clock, so it doesn't rush the Wall's helicopters before they may fire.

**Keeping the threat the same**
- Firing on sight gave it far more shots.
- So now it waits **3 s** on screen before its first volley, and has **5 HP** (was 6).

| The Island, the bot drafting for itself | Before | After |
| --- | --- | --- |
| volleys per helicopter | 0.57 | 0.63 |
| seconds from coming in to its first volley | 6.6 | 4.7 |
| missiles per run, waves 1–10 / boss rounds | 10.1 / 14.3 | 14.0 / 11.7 |
| ships sunk by helicopters per run | 2.33 | 1.25 |
| ships lost per run, every wave | 11.2 | 10.4 |

The plain gun: 0.75 volleys per helicopter before, 0.97 after; ships sunk by helicopters 3.67 before, 2.33 after.

**Island bot report** (24 seeds, no Armory: `tools/v3/playtest-fixes/results/report-island-v3{4,5}.md`)

| | Before | After |
| --- | --- | --- |
| tough, lost in waves 1–10 | 11.5 | 13.5 |
| normal, mean end wave | 9.0 | 8.3 |
| boss rounds B1–B3, tough | 2.04 / 4.83 / 3.42 | 1.54 / 4.67 / 4.04 |

Most of the Island's rise comes from the sub (fix 7): wave 3 is its debut, 0.13 lost before and 0.83 after. Wave 10 also rises.

## 4. The wave rating has its own screen

> "move this mid round review to be its own page as I miss it at the bottom of the draft page"

**What changed**
- The optional "Rate wave N" rating (difficulty, fun, intensity 1–5, and a note) is now its own screen. It shows between the wave's end and the weapon draft.
- It has bigger buttons, one row per axis, and **Skip** and **Next**.
- Each tap is saved to the log as you go. Skip and Next both go on to the draft.
- It shows where the row showed before, under the same rule:
  - playtest notes on (pre-release builds);
  - you at the controls, not a replay;
  - every draft after waves 1–10 (boss rounds have no draft).
- That rule covers the campaign and Free Play as well as the Test Lab map cards: the old row showed there too.
- A Test Lab run keeps **Done** on this screen, as on the draft.

**Tests:** `e2e/v3.mjs` and `e2e/v3-map-cards.mjs` now rate on the new screen. The other e2e scripts get past it.

**Screenshots:** `before-rate-wave.jpg` (the row cut off at the draft's foot) and `after-rate-wave.jpg`.

## 5. "Wave 3 of 10" on every map

> "It should say wave one of ten for all maps not n of thirteen"

**What changed**
- One helper (`waveCount` in `src/v3/data/events.ts`) now writes every counter:
  - **"Wave 3 of 10"** for waves 1–10;
  - **"Boss · Round 1 of 3"** for the boss rounds;
  - "Wave 14" in endless; a Test Lab event card keeps "Wave 11".
- Where it shows:
  - **HUD:** `WAVE 3 of 10` / `BOSS Round 1 of 3`;
  - **Test Lab pause bar:** "full map · wave 3 of 10" and "full map · boss round 1 of 3";
  - **Pause after a restore:** "Run restored · Wave 3 of 10";
  - **Continue card and saved line:** "Wave 3 of 10", or "boss round 2";
  - **Restoring… screen:** the counter is the wave being replayed, "Wave 5 of 10"; it used to read "Wave 1 of 11";
  - **Results:** "Convoy lost on boss round 2" and "Lost on wave 7";
  - **Won stamp:** "Every wave and boss round survived" (was "Wave 13 survived");
  - **Test Lab verdict:** "Full map: 10 of 10 waves and 2 of 3 boss rounds cleared" (was "12 of 13 waves").

## 6. The Scavenger drone takes 3 hits

> "the weapon drop stealing drone should have more health"

**What changed:** 3 HP (was 1), with HP pips over it.

| The Island, the bot drafting for itself | Before | After |
| --- | --- | --- |
| Scavengers shot down | 83% | 92% |
| seconds alive | 2.1 | 2.4 |

- Over all its runs the bot still downs about 9 in 10 Scavengers. Each one now costs it three taps and lives about 0.3 s longer, so its lock holds a little longer.
- On the Behemoth Run (36 per 12 runs): 97% shot down before, 83% after; 2.5 s alive before, 2.6 s after.

## 7. The torpedo sub stays under water, out of reach

> "should not be able to be attacked only their torpedoes can ... just stay under water with the periscope showing and a rough shadow of the sub"

**What changed**
- The Torpedo Sub can't be hit or targeted:
  - taps, splash, chains, beams, helpers, Bomber Wing and the War Drum all pass over it;
  - the bot never picks it, because it leaves the "worth shooting" list.
- The Nuke doesn't sink it either. The Nuke also leaves a sub's periscope warning in place, because the sub is under water.
- Its torpedoes are shot down as before.
- It is drawn as a dark hull shadow with a periscope (red glint) and a wake. It fades in, then fades out as it dives away. See `before-sub.jpg` and `after-sub.jpg`.

**Nothing waits on killing it**
- A sub always dives on its own after its last torpedo (`after` s), and the wave ends once it has gone.
- Unit tests check that the sub can't be damaged, fires, then dives.
- The map-lab baseline (Wolf Pack runs included) plays every run to its end.

**Keeping the threat close**
- Before, the bot sank most subs before they fired: 0.36 torpedoes per sub on the Behemoth Run.
- Now every sub fires, so each fires **2** torpedoes (was 3–5), and the Wolf Pack's subs fire **1–2** each (was 2–3).

| Ships sunk by torpedoes per run, the bot drafting for itself | Before | After |
| --- | --- | --- |
| The Island (12 subs a run) | 0 | 0.5 |
| The Behemoth Run, all waves | 1.58 | 2.25 |
| The Behemoth Run, waves 1–10 | 0.25 | 1.58 |

**Behemoth bot report** (24 seeds, no Armory)

| | Before | After |
| --- | --- | --- |
| tough, lost in waves 1–10 | 11.9 | 12.6 |
| normal, mean end wave | 9.1 | 8.9 |
| boss rounds B1–B3, tough | 2.54 / 3.42 / 4.50 | 3.08 / 3.33 / 6.21 |

## Follow-up: the sub's torpedoes, brought back down

After fix 7, The Behemoth Run became too punishing early:
- Torpedo sinks in waves 1–10 went from 0.25 to 1.58 a run.
- The plain gun went from 18.9 to 23.1 ships lost.
- Your Behemoth run lost its first ship to a sub on wave 2.

The sub stays out of reach, as you asked. Three changes bring its threat back, still at log v36:
1. **Slower torpedoes:** they move at 40 px/s (was 75), so there is more time to shoot each one. A fast one is still 2.2× that.
2. **A clearer torpedo:** each torpedo now has a white bow wave off its nose and a pulsing red ring.
3. **No early subs on the Behemoth Run:** no Torpedo Sub before wave 6. One the planner draws earlier stays the drone swarm it would have replaced, so the wave sends the same amount. This applies in the campaign and the lab alike (`SUB_FROM` in `src/v3/data/foes.ts`).

All numbers are with your Armory, the bot drafting for itself, 24 seeds. "Won" means under the normal loss limit. Torpedo sinks are for waves 1–10.

| | Before this follow-up | After | Target |
| --- | --- | --- | --- |
| Behemoth, lost in waves 1–5 | 0.83 | **0.54** | 0.4–0.8 |
| Behemoth, torpedo sinks | 1.50 | **0.33** | about 0.5 or less |
| Behemoth, won | 54% | **50%** | 50–70% |
| Island, lost on wave 3 (the sub's debut) | 0.71 | **0.17** | about 0.3 or less |
| Island, torpedo sinks | 0.63 | 0.08 | |

- The other speeds tried are in `tools/v3/playtest-fixes/results/torpedo-followup.txt`.
  - At 45–55 px/s, torpedo sinks stayed at 0.7–1.1 on the Behemoth Run.
  - At 45 px/s without the wave-6 rule, the Behemoth's waves 1–5 stayed at 0.88.
- The Behemoth's win rate of 50% sits at the bottom of the target range. What holds it down is mostly wave 10's heavies and shells, not torpedoes.
- With 24 seeds, a win rate moves by about ±10%.
- **Wave budgets** still pass (±15%): the furthest wave is the Island's wave 5 at ×0.87 and the Behemoth's wave 7 at ×0.90.
- **Bot reports** (24 seeds, no Armory):

  | | Lost in waves 1–5 (normal) | Mean end wave |
  | --- | --- | --- |
  | Island | 0.83 | 8.3 |
  | Behemoth | 0.79 | 9.0 |

- The map-lab baseline is rewritten (still v36).

## The Needle of Bosk, after it merged

The Needle has armored-drone walls and a Shield Wall boss. It has no helicopters or subs, so only the Shield and the Scavenger apply.

| | The Needle v35 (before) | v36 (after) |
| --- | --- | --- |
| Shield alone at MAX | **#1**, 5.25 | **#5**, 7.50 |
| the bot drafting for itself, lost per run | 8.0 | 8.7 |
| Scavengers shot down / seconds alive | 100% / 2.1 | 100% / 2.7 |

- The Shield also drops to the pack on the Needle. #2 to #8 sit within 7.2–7.7, so it is a tie.
- Files: `tools/v3/playtest-fixes/results/singles-needle-v3{5,6}.txt` and `foes-self-needle-v3{5,6}.txt`.

## Overall, the bot on chapter 2 (ships lost per run, every wave played)

| | Before | After |
| --- | --- | --- |
| Island, the bot drafting for itself | 11.2 | 10.4 |
| Island, plain gun | 15.3 | 12.7 |
| Behemoth, the bot drafting for itself | 10.3 | 8.8 |
| Behemoth, plain gun | 18.9 | 23.1 |

- With a full draft the two maps got a little easier: the Shield and the helicopter got weaker.
- With the plain gun the Behemoth Run got harder: nothing can stop its subs firing now.
- Under the normal loss limit (the bot reports), both maps end about a wave earlier on the Island and a little earlier on the Behemoth Run. That is mostly waves 3 and 8–10.

## Your four runs against the bot's mirror

- **Added to the bot fit:** your four logs, added to `tools/v3/bot-fit/player.json` with `fit.ts --logs`: Island v31; Marrow, Behemoth and Kesh v32.
- **No exact replays:** none of them replays exactly on this build, or on round 9's, because only v36 replays here.
- **The mirrors:** `curve.ts` replays each one as a "mirror": the "you" bot plays your setup, Armory and picks on your seed, 16 times, on three builds. The table shows the v35 build. The v33 and v34 builds are in `tools/v3/bot-fit/results/playtest-2026-11-20-curve-v3{3,4,5}.txt`.

Ships lost each wave, your run against the mirror's mean (v35):

| Map | Who | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 | End |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Island | you | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 | 2 | 1 | 1 | 3 | won |
| | mirror | 0 | .06 | .31 | .13 | 0 | .13 | .81 | .88 | .60 | 1.85 | 1.09 | 1.82 | 1.11 | won 56% |
| Marrow | you | 0 | 0 | 0 | 1 | 1 | 0 | 1 | 3 | | | | | | lost w8 |
| | mirror | 0 | 0 | 0 | .06 | .31 | .06 | .38 | .19 | .44 | .13 | 0 | 0 | .27 | won 94% |
| Behemoth | you | 0 | 1 | 0 | 1 | 3 | 1 | | | | | | | | lost w6 |
| | mirror | 0 | .06 | 0 | .06 | 1.69 | 0 | .19 | .67 | 1.29 | 1.64 | 4.00 | 3.67 | 1.00 | won 0% |
| Kesh | you | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 3 | 0 | 1 | 5 | lost B3 |
| | mirror | 0 | 0 | 0 | 0 | .06 | .06 | .06 | .31 | .25 | 1.13 | .94 | .69 | 1.25 | won 81% |

- **Island:** you matched the mirror in waves 1–10 (4 lost; the mirror lost 4.4) and won.
- **Marrow:** you lost 6 by wave 8. The mirror loses 1.0 in the same waves and almost always wins. Your wave 8 (3 lost) is far above the mirror's 0.19.
- **Behemoth:**
  - Wave 5 is the hard wave for both of you: 3 lost for you, 1.7 for the mirror.
  - You lost by wave 6. The mirror reaches wave 10 about 7 times in 10 and never wins.
- **Kesh:** you held waves 1–9 better than the mirror's mean, then lost 3 at wave 10 and 5 at the last boss round. The mirror loses 1.25 there.
- **Marrow and Kesh in particular:** the bot reads these two maps as much easier than you found them.

## Checks

- `npx tsc --noEmit`: clean.
- `npx vitest run --exclude '.claude/**'`: all pass. New in `tests/v3/playtestFixes.test.ts`: Shield hits, the helicopter, the sub, the Scavenger and the counter. Older tests now follow the new sub, helicopter, Scavenger and counter.
- The map-lab baseline is rewritten at v36 and replays exactly.
- **e2e:**
  - `e2e/v3.mjs`, `v3-map-cards.mjs` and `v3-encounters.mjs` were run on `vite preview`.
  - Two earlier runs of `e2e/v3.mjs` failed one check each: "coves 667×375" and then "sowers 667×375", "a notice is outside the bottom-right corner". The base passes it. The base passes it.
  - First fix: the longer helicopter, sub and Scavenger tips made the first-sight notices taller, so all three are now no longer than before.
  - It still failed on The Coves: the new timing put the Strike Jet's and the Spotter's first-sight notices up together, and two 6-line notices rose above the bottom two thirds.
  - Second fix: on the smallest phones (height 380 px or less), a notice's text is clamped to 4 lines.
  - Now `e2e/v3.mjs` passes all 233 checks, and `v3-map-cards.mjs` and `v3-encounters.mjs` pass.
  - The screenshots e2e overwrote in `docs/design/img` were restored.
- **Tools:**
  - `tools/v3/playtest-fixes/measure.ts`: Shield hits per pickup, plus helicopter, sub and Scavenger numbers.
  - `tools/v3/playtest-fixes/shots.mjs`: the screenshots.
  - `tools/v3/playtest-fixes/pins.py`: moves the log-version pins.

## Questions for you

1. **Shield at 1/2/3 hits:** is a level-1 Shield that breaks on its first hit too fragile? *Recommended: keep 1/2/3.* It is mid-pack now, and 2/3/4 would put it back near the top.
2. **The sub now always fires:** that makes the Behemoth Run's early waves and the Island's wave 3 a little harder, even at 2 torpedoes a sub. *Recommended: keep 2 torpedoes and watch your next Behemoth run.* If it feels harsh, slower torpedoes are the next lever.
3. **The rating screen:** it shows after every wave 1–10 in the campaign and Free Play too, not just map cards. *Recommended: keep it everywhere playtest notes are on.*

---

## Earlier: fixes from the 11-02 and 11-03 playtest logs

Logs reviewed: 8 runs on the player's iPhone (874×402), 11-02 and 11-03. The
player asked for every bug fixed, "especially quit log. I actually beat that
island map after wave 9 and it didn't save and then I play the next map
briefly and that doesn't save either."

## 1. A won run that never arrived, and a run left with no ending

**What the logs showed.**
- **Island (11-03 21:46).** The last upload is the wave 9 snapshot (21:52:44). The win around 21:53 never arrived.
- **Behemoth (started 21:54:00).** It arrived, but several logs that day stopped at a wave clear with no `end`.

**Reproduced in the browser.** The test build serves the game from a `*.vercel.app` host, so uploads run, and `/api/playlog` is intercepted.
- **The win itself.** On the unchanged build, a won Island run uploads fine; tapping Next even sends it a second time.
- **When both sends fail** (a phone between networks), on the unchanged build:
  - the win never arrives: failed logs were only resent at the next app launch;
  - the next run, left mid-wave, arrives as a snapshot with no ending. iOS fires `visibilitychange: hidden` when an app is swiped away, rarely `pagehide`, and only `pagehide` sealed a quit.

That is exactly what the player saw.

**Fixed:**
- **Every successful send** now also resends any log that didn't get through. So does coming back to the app.
- **Leaving the app mid-run** (`hidden`) saves the run sealed as `end: 'quit'`, `left: true`. If the player comes back and plays on, the next save of that id replaces it.

**Verified:**
- **The fixed build.** Same test, with both win sends failing: the win arrives 0.4 s after the next run's save, and that run arrives as `quit`.
- **In the browser suite.** `e2e/v3.mjs` now checks both.

## 2. The bomber's turn ("Plane turned for the bomber was not smooth")

A bomber flies beside a bending lane, 70 px off its edge. Its position was
stepped along the lane's centre at a fixed rate, but an offset path round a
bend is longer or shorter than the lane, and it doubles back on the inside of
a sharp corner. Measured over 6 seeds per map:

| Map | Plane | Before | After |
|---|---|---|---|
| Kesh Hook | bomber | 193–1,042 px/s, turning up to 7.05 rad/s | 193 px/s, ≤0.77 rad/s, within 9 px of its route |
| Sharra Delta | bomber | jumps of 4,765 px/s, up to 13.7 rad/s | 193 px/s, ≤0.59 rad/s, within 20 px |
| Sharra Delta | strafer | up to 6.56 rad/s | ≤1.24 rad/s |

**Fixed:**
- **Flight path.** An aircraft flies a flight path (`flightAt` in `sim/lanes.ts`): the offset path with the doubled-back stretch dropped and its corners rounded. It is cached per lane and offset, and kept in the lane's own distance, so the warning line and the strafer's gun line read the same path.
- **Speed and turning.** The plane flies at its own speed toward a point 120 px ahead on that path, turning at most 2.4 rad/s (`PLANE.look`, `PLANE.turnRate`).

**Verified:** a new test in `tests/v3/routes.test.ts` covers every map. Planes keep their speed (±5%), turn ≤2.4 rad/s and stay within 40 px of their route.

## 3. The radar tower ("Not really sure what that radar tower is even doing")

It was explained in a wave 1 notice on Lee of Marrow, up for 2.6 s among
"WAVE 1", the controls tip and the first threat's notice. The player asked on
wave 5.

**Fixed:** it is explained the first time the tower locks on to a threat, when its lock boxes show what it does, and for 6 s. The text: "Threats in its sweep get a lock box: your shots at them fly faster. Missiles will go for it." Once per device, as other first-time explanations are.

**Verified:** in the browser on Lee of Marrow, it showed 7.1 s into wave 2, when the tower first locked on.

## 4. Sinkings filed under the wrong volley

**What the logs showed.** A run lost to strafers filed its last two sinkings under an empty missile volley.

**Cause.** The loss that ends a run closes every open volley on the same frame, before the loss is filed.

**Fixed:** a sinking goes to the volley open at the start of that frame that sent its killer. A child counts with its parent: a bomblet with its cluster, a mini-drone with its mothership, a missile with its bomber.

**Verified:** 40 lossy runs on 10 maps. Volleys with losses but no threats went from 48 to 0. The volleys still empty are raids announced on the frame the run was lost, which genuinely sent nothing. A new test checks this.

## 5. Checked and not a bug: no taps after a note (Kesh, 11-02)

The log has no taps from wave 7 to the end. The last tap was at 30.8 s into
wave 7, 8 s before the note (39.2 s), so tapping had stopped before the note.

In the browser, a note from the pause menu, then Resume, at 2× speed: 3 of 3
taps fired.
