# Straitwatch V2: round 11, the moments between waves

The player asked for two things.

> "Slow down the screen when you lose your last ship… a little more dramatic than just the lose screen right away."

> "When I was tapping the screen and I won the round, I accidentally tapped an upgrade. We should have a quick half-second pause before the upgrade screen."

## What changed

Both changes are in the app only (`src/v2/ui/app.ts` and `style.css`). The simulation isn't touched, so playtest logs replay exactly as before.

**A pause between a wave and the draft.**
- When a wave ends, the field holds for 0.6 s with a "WAVE N CLEARED · +bonus" banner before the draft appears.
- After the draft appears, its cards ignore taps for another 0.35 s. The draft panel only gets `data-armed` after that, and until then the cards take no pointer events.
- Watching the bot, the pause shortens with the watch speed.
- The second card of a dev stride draft still follows the first at once.

**The loss finale (about 2.6 s).**
- The final blow lands with a big shake, and any banner on screen is cleared.
- The camera pushes in by 40% on the last ship sunk (or on the carrier, if it went down) and draws that spot toward the centre. It stays clamped so the field always fills the view.
- The field fades to grey and darkens, and red closes in from the edges.
- Explosions and sinkings play on at 0.3× speed: slow motion.
- A tilted **CONVOY LOST** (or **CARRIER DOWN**) stamp slams in.
- The result screen then rises over the frozen, greyed field.
- A tap after 0.9 s skips straight to the result. Watching the bot, the finale shortens with the speed.
- Clearing a map gets a 1.2 s beat before its result screen.
- If the page is closed during a beat, the beat finishes first, so the run's end is still logged.

## Checks

**The accidental pick, A/B.** In each trial a script tapped the middle of an 844×390 screen every 70 ms while the last threat died, and kept tapping for 0.9 s after the wave ended:

| | Accidental picks | When the draft appeared after the wave ended |
|---|---|---|
| Old build (live) | **5 of 5** | 0 ms |
| New build | **0 of 5** | 618–698 ms |

The same check is now part of `e2e/v2.mjs`. Run against the old build it fails ("a tap through the wave's end picked a card"); against the new build it passes, and a deliberate tap after the pause still picks a card.

**The finale, frame by frame** (Strait wave 6, one ship from losing, at 874×402):
- **0.1 s:** shake, greyscale starting at 0.15.
- **0.5 s:** pushing in, greyscale 0.59, the red edge up.
- **1.0 s:** CONVOY LOST stamped, greyscale 0.81.
- **1.6–2.3 s:** held.
- **3.0 s:** the result screen is up (it appeared 3.15 s after the loss, including the rise-in).

A tap at 1.15 s skipped to the result 13 ms later.

**What the review found.**
1. The first zoom kept the final blow where it was on screen, so the push-in barely read.
2. Pulling the final blow toward the centre then exposed the map's edge (empty space at 0.5 s).
3. A leftover "NEW: Missile truck" banner sat over the finale.

All three were fixed and re-shot.

**Regression:**
- `npm test`: 827 passed;
- `e2e:v2` passed, including the new check;
- `e2e:v2:watch` passed, including bot drafts and a watched run to the end.

## Part 2: the player picked two more

From the three ideas pitched, the player chose "a warning when you're one ship from losing" and "a punchy hit when you take down big threats".

**One loss from the end.**
- **When it applies:** one more sunk ship ends the run, or the carrier is at ≤ 25% of its hull.
- **What shows:**
  - The screen's edge beats red like a pulse (a 1.1 s heartbeat).
  - The HUD gets a red outline.
  - The last empty loss pip turns into a hollow red ring that pulses.
  - A banner appears once on the way in: **LAST SHIP** ("One more loss and the convoy is lost.") or **CARRIER CRITICAL**.
- **When it stops:** during the loss finale and between waves.
- **Reduced motion:** the edge and the pip hold still.

**Big kills.**
- **Which threats:** anything with 3+ hits: heavy missile, mothership, strike jet and bomber.
- **What happens:** the game raises a `bigKill` event, and the screen freezes for 80 ms (shorter when watching fast), shakes, and shows a white flash that collapses into an opening gold shock ring, with **HEAVY DOWN** / **MOTHERSHIP DOWN** / **JET DOWN** / **BOMBER DOWN** rising from it.
- **Replay:** the sim takes exactly the same steps, just a moment later in real time, so logs replay unchanged.

**Checked.**
- **A real tap on a strike jet** (left one hit from death) on Strait wave 7, sampling the game's step counter every frame: the longest freeze was **83 ms**. The screenshot at +30 ms shows the ring and "JET DOWN". The page's log then replayed to the logged step exactly (1509 = 1509).
- **Danger states:**
  - with `lost = limit − 1`: the danger class is on, the banner reads LAST SHIP, and one pip is marked as next;
  - with losses reset: off again;
  - with the carrier at 2 HP: on, and the banner reads CARRIER CRITICAL.
- **Found and fixed:** the first version blinked the last pip *solid red*. Caught in that phase, the HUD showed six red pips, which reads as "all ships lost", the opposite of the warning. It's now a hollow ring that pulses. The HUD close-up shows five filled pips and one hollow red ring, and computed styles show the sixth pip's fill is transparent.
- `npm test`: 827 passed. `e2e:v2` and `e2e:v2:watch` passed.
