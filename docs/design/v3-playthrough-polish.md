# V3 playthrough: what a new player meets, and what changed

The player asked for a playthrough "looking for more than what I already
told you": play once, note what needs changing, change it, and check it.

## How it was played

A scripted player played the real game in the browser, from a **fresh
save**, at the player's phone size (874×402):

- it taps the threat nearest a hull, with human-like gaps (0.26–0.44 s) and
  aim jitter;
- it grabs pickups and takes a card at each draft;
- it screenshots the field every 3 s and every screen in between.

The runs:

| Run | Played | Result | Captured |
|---|---|---|---|
| 1 | The Strait, all ten waves at 1× | won 22,480, 2 ships lost | 173 frames |
| 2 | The Strait again at 2× | cleared | |
| | then **Next: The Kesh Hook**, waves 1–4 | | the first loadout picker, map 2's waves |
| 3 | The Strait again on the fixed build (2×) | lost on wave 10 | the loss screen |
| | then **Try again** (a second Strait run) | | first-meeting explanations not repeated |
| 4 | The Strait at **667×375**, the smallest phone, 2× | | the final check |

Separately, every screen off the field was opened from a fresh save:

- menu, Armory, Settings, Free Play;
- pause, note, loadout, result (won and lost, with and without cards) at
  three phone sizes.

## What success looks like (the player's view)

1. **First launch is clear:** nothing on the menu for a developer only, and
   nothing cut off at phone size.
2. **The first wave starts promptly.** Every warning is followed by the
   attack it warns of.
3. **On the field:**
   - the rails, timers and words never cover each other;
   - every control is explained once.
4. **Between runs:** the draft, the result, the loadout and the Armory are
   readable, fit the screen, and show the next step.
5. **The words are a player's:** no developer units, and explanations
   aren't repeated on every map.
6. **Nothing regresses:**
   - tests and browser checks pass;
   - difficulty moves only for a reason.

## What the playthrough found, and what changed

| # | Found (where) | Change |
|---|---|---|
| 1 | **Empty raids.** Wave 1 planned six swarm raids for three swarms, so half its "SWARM INBOUND" warnings lit bases that never fired. The first drone came 6–18 s in (13 s on seed 1); waves 2–3 had dead stretches too. | A wave never plans more raids of a kind than it has units of it. The first threat now comes in 5–8 s, and every warning is followed by its raid (tested on all 20 maps at waves 1–10). |
| 2 | **The left rail.** Power-up timers stacked up over the RATE/NOTE button (two covered its foot, three would cover it). The loaded weapon's countdown was shown twice, here and on its own chip. | The weapon's seconds stay on its chip. On a phone the timers are one line each, and the ship slider is a little shorter. Three timers now clear the button at 874×402, 844×390 and 667×375 (measured). |
| 3 | **"JET DOWN" and "REPAIRED"** printed on one spot. | A word steps up above any still fresh nearby (tested). |
| 4 | **Developer units on cards:** "19 px fuse"; "reach 280". | "136% fuse reach" (like its neighbours' "140% blast"); "280 m reach" (tested: no card says px or a bare reach). |
| 5 | **Settings:** Back below the fold on a phone (the panel is 616 tall in a 378 window). | Back sits in a strip at the foot of the panel that the rows scroll under. |
| 6 | **"Play V2 →"** on the main menu, a link to the old prototype. | Developer mode only. |
| 7 | **The SHIPS slider** ("×1.4") and the formation button are never explained on a phone (the slider's hint is hidden for room). | One-time tips on the first map: wave 2 "MORE SHIPS, MORE POINTS", wave 3 "FORMATIONS". They show once per device and stay up 5 s. |
| 8 | **The loadout picker** (first seen going to map 2) was see-through. The finished run showed behind it (its HUD "10/10 · 21,920", its ships), and the bay labels sat over the rail. | A dark backdrop, as the result has. |
| 9 | **Map 2 re-taught map 1:** "NEW: Attack drone", "NEW: Ballistic missile", "WEAPON DROP", every pickup and launcher, again. | Each is explained the first time a player meets it, per device. Free Play and developer mode still show them. A second run shows none (seen in run 3). |
| 10 | **The result on a small phone:** at 667×375 a cleared run's buttons wrapped, and Menu and Review fell below the screen. At 874×402 a loss with a card and its advice clipped the log line. | On a phone the title, stats and buttons are tighter, the labels shorter ("Endless mode", "📝 Review"), and the buttons in one row. Won and lost both fit at all three sizes (measured). |

Seen and fine:

- the menu and its locked maps;
- the first wave's "tap / hold" hint;
- the drafts (NEW / LEVEL UP / SWAP IN / MAX badges, "Slots full");
- the result (cards won with their next level, "Next: …");
- the Armory, Free Play, pause and the note dialog;
- the Kesh Hook's waves and its hint.

## Cycles

| # | Focus | Found → fixed | Verified |
|---|---|---|---|
| 1 | The first minute (menu, first wave) | 1, 6, 7 | Raid tests fail on the old code and pass now. Tip screenshots at waves 2 and 3. The V2 link is hidden. |
| 2 | The field's overlays (rails, words) | 2, 3; then a re-check found "FULL STEAM" cut to "FULL STEA" (tightened) | Rail measurements at three sizes, with 1–3 timers. A zoomed screenshot. The word-spacing test. |
| 3 | The words and screens off the field | 4, 5; then a re-check found Back floating over a card (now a footer strip) | Settings screenshots, Back measured in view. The unit test. |
| 4 | Progression (result → map 2 → loadout → second run) | 8, 9 | Run 3's frames: dark loadout, no repeated explanations. |
| 5 | The result screen at every size | 10 | Six measured cases (won and lost × three sizes) and screenshots. |
| 6 | The smallest phone end to end, and regression | (below) | Run 4. `npm test`, `e2e:v3`, the bot comparison. |

**Difficulty.** The raid change is the only gameplay change. Average bot,
48 seeds a map, before → after:

| Map | Wins | Ships lost a run |
|---|---|---|
| The Strait | 98% → 100% | 1.08 → 1.54 |
| The Kesh Hook | 100% → 94% | 1.08 → 1.58 |
| Lee of Marrow | 98% → 88% | 1.08 → 1.96 |
| The Gauntlet | 81% → 83% | 2.65 → 2.27 |
| Harbor Mouth | 58% → 58% | 3.96 → 3.69 |
| The Island | 52% → 63% | 4.33 → 4.31 |

The first three maps lose about half a ship more a run: the attacks come
steadily now, not after empty warnings. That fits the player's own rating of
the Kesh Hook last session: difficulty 2 of 5, intensity 1 of 5. The rest
are within noise.

## Limitations

- The scripted player taps well, so the playthrough judges what a run looks
  and reads like, not how hard it feels to a person.
- Sound was on in the build but not heard (the container has no audio
  out).
- Tips and first-meeting explanations are kept per device, not per player
  profile; clearing site data shows them again.
