# V3: fixes from the 11-02 and 11-03 playtest logs

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
