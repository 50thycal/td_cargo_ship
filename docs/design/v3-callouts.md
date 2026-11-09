# V3 call-outs: the corner stack, the lab bar at the bottom, and a setting

The player, after a Test Lab session:

> "The bar that says like done, note, and everything, put that on the bottom
> and then move the notifications to the bottom right hand corner. Also take
> a pass on all the notifications. Sometimes the icons and the text overlap
> with one another. And then they should also be disappearing. Or, I don't
> know, I kind of want to rework it just because it doesn't, it's kind of
> annoying after you play the game for a while. It's better for new players,
> so I was thinking, like, you can turn them off, so maybe make that a
> setting. But anything else you think you could do to improve that, too?"

Code: `src/v3/ui/alerts.ts` (the stack, the kinds, the setting),
`showBanner` / `raidAlert` / `calloutRow` in `src/v3/ui/app.ts`, the
`.v2-alerts` / `.v2-alert` and `.v3-lab-bar` rules in `src/v3/ui/style.css`.

## Layout

- **Test Lab bar**: one slim row (36 px) along the bottom, inside the safe
  area and between the two rails, so it never covers a rail button. Same
  contents as before: card name, live count, Bring one (or Drop it), Note,
  Setup, Done.
- **Call-outs**: a stack in the bottom-right corner of the battlefield, left
  of the right rail, anchored to the bottom of the safe area (on a
  letterboxed phone such as 667×375 the newest card sits in the strip below
  the map), and above the lab bar when it shows. Newest at the bottom; at
  most **two** at once, the rest queue (raids and alarms first).
- **Width**: a third of the field (`34% − 8 px`, 160–250 px; 200–320 px on a
  tablet). Every map's carrier but one ends left of 65% of the field, so the
  stack never covers it however tall it grows. The Delta's carrier sits
  mid-field on the right: there `place()` keeps the stack to one card, so it
  stays under the carrier. The stack does sit over the bottom-right
  shore, which on some maps (Harbor Mouth, Behemoth, Sowers, Lantern,
  Coves, Citadel) has a base: the cards are translucent, short-lived and go
  at a tap.
- **Card**: the icon in its own fixed column (14 px), the words in the
  other. The title wraps once and then ends in an ellipsis; the line under
  it wraps in its column (six lines at most). No emoji in titles: the old
  ⚠, 📝, ★ and ▶ are now line icons (Feather, MIT) in the icon column, so
  they cannot run into the text. A 3 px edge in the card's colour instead
  of a full border: cyan for information, grey for teaching, gold for
  answers to the player's own taps, the raid's own colour for a raid, red
  for an alarm.

Screenshots: `img/callouts/`.

## Timings

Every card goes on its own; nothing stays longer than **4 s** (real time;
watching fast shortens all but alarms by the square root of the speed).

| Kind | What | Seconds |
| --- | --- | --- |
| alarm | LAST SHIP, CARRIER CRITICAL | 4 |
| warn | a raid (while its warning lasts, 4 at most), DREADNOUGHT INBOUND, SUPERTANKER UNDER WAY | 4 |
| info | WAVE N, TESTING: card, RADAR LOST / HIT, BATTERY KNOCKED OUT | 3.2 |
| hint | NEW: threat, launcher or pickup, tips, a map's idea, RADAR TOWER, RED SHOTS CAN'T BE STOPPED | 4 |
| ack | NOTE SAVED, VOLLEY RATED, a weapon loaded, control taken, REPLAY | 2.4 (1.6 as one line) |

A tap on a card sends it away at once. The card is over the canvas, so the
tap never reaches the water as a shot. Cards slide out to the right and
fade (0.22 s); the cards above close the gap. A raid card that timed out or
was tapped does not come back while that raid's warning lasts. A raid or an
alarm arriving at a full stack still retires the oldest ordinary card once
it has been up for a second.

## The Call-outs setting

Settings → Game → **Call-outs**: All / Essential / Off. Stored as
`straitwatch.v3.callouts`; a new save is **All**. A progress reset keeps it.
The Test Lab follows it too.

- **All**: everything above (a new player's teaching).
- **Essential**: only what needs an answer now: raids, the dreadnought,
  the supertanker, and the last-ship / carrier alarms. No wave titles, no
  tips, no first-sight hints, no TESTING card, no radar or battery news.
  Answers to the player's own taps (note saved, volley rated, weapon
  loaded) shrink to one short line for 1.6 s.
- **Off**: nothing but the last-ship / carrier-critical alarm.

A first-sight hint hidden by the setting is not used up: switched back to
All, the player still meets it once. (Hints stay once per save: the seen
list lives in `straitwatch.v3.tips`, cleared by Reset progress; Free Play,
developer mode and the Test Lab always show them, at All.) The sound of a
hidden card does not play; the raid siren still does (it is game sound).
The answer to a purchase restore shows whatever the setting.

## Small things done with it

- **Repeated raids**: the same raid again within 8 s says so (BARRAGE
  INBOUND ×2) without its tip, read a moment ago; if the earlier card is
  still up, the one card counts instead of a second card appearing.
- **Teaching reads quieter**: hints have a grey edge, a smaller title and a
  lighter background than warnings and alarms.
- **Smaller and more see-through** cards (12 px title, 11 px text, 70%
  background) cover less of the field than the old 18 px tray.

## Ideas not built

- Per-map nudge for the few maps with a base in the bottom-right corner
  (lift the stack above it, or fade a card while its base fires).
- A "seen it" long-press on a hint card that also marks it read in Free
  Play and the Test Lab (which show every hint, every run).
- A short call-out log in the pause menu, for a card that went before it
  was read.
- Drop a queued WAVE N card that waited behind raids for more than a few
  seconds (it is stale by then).
