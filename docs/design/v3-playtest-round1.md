# V3 playtest round 1 — a full playthrough, the buttons, one gun per run

The player's notes after playing V3:

> "The action buttons are not clear: some start like half filled and when I
> started a new round the empty ones were blinking. For the Armory, the player
> should only be allowed to select one for their wave, they don't get all of
> them. Fix that and do the play through to find bugs and UI fixes."

## What success looks like (from the player's side)

1. **Ability buttons read at a glance.** Empty slots look empty and never
   animate. Charge reads the same way for every ability, "ready" is
   unmistakable, "armed" is different from "ready", and nothing keeps
   blinking after its moment.
2. **The Armory works as described.** Levels are bought as before, but each
   run takes exactly one equipped upgrade, the run uses only that one, and
   the screens say which it is.
3. **A full playthrough works end to end.** Menu → Armory → gun → map → 10
   waves with drafts → abilities → win or loss → result → salvage → Armory →
   next map, plus endless. No softlocks, no console errors.
4. **Nothing overlaps, clips or hides** on a landscape phone (844×390,
   874×402, 667×375) or on desktop.
5. **The words are true.** Card text, labels and numbers match the game.
6. **Build, unit tests and browser tests pass.**

Every cycle was run against the built game in Chromium (Playwright): real
clicks, drags, holds and, in cycle 6, real touch events. The probe scripts
take screenshots and read the DOM and the game state.

## Cycle 1 — the ability buttons

Reproduced the player's report: a probe let an ability fill, used it, quit,
and started a new run, reading each button's classes and computed animation.

| # | Finding | Fix |
|---|---|---|
| 1.1 | The "just filled" `flash` class was never removed and carried an infinite glow: a used button kept pulsing as if ready, and on a new run the empty slot that had held it **blinked** (the player's report) | A one-shot pop that removes itself; the glow belongs to the ready state only; a slot's classes reset when its ability changes |
| 1.2 | Empty slots differed: one read "empty", the others were blank | One empty look: a dashed circle, nothing in it |
| 1.3 | A new ability started **half full** (by design), which read as a random state | Every ability starts empty (`START_CHARGE = 0`) |
| 1.4 | Charge was hard to read: thin ring, dimmed icon, truncated name ("Hellfire Sa…"), no words | Short names that fit, the ability's colour rising inside the button, and a tag under it: `42%` → `READY` → `AIM` → `×2` / `5s`; a one-time "READY: press its button" notice per ability per run |
| 1.5 | (Found while retesting) the armed button's 8% grow made it overlap the next button on a phone | No grow; the gold rim says armed |
| 1.6 | A `/favicon.ico` 404 on every load cluttered the error checks | An empty icon in `v3.html` |

Retest: lifecycle probe (fill → use → new run: `charging`, then `empty`,
no animation); a gallery of every state on desktop and phone.

## Cycle 2 — one Armory upgrade per run

| # | Finding | Fix |
|---|---|---|
| 2.0 | Every run took **all** five upgrades | `equipped` in the save; the run's gun is the equipped upgrade alone (`runGun`); the first one bought is equipped; **Choose your gun** comes up when a map starts; Equip in the Armory; the menu shows the gun |
| 2.a | On a phone the Armory ran off the screen: Proximity Fuse cut off, **Back unreachable** | Short screens get one line per upgrade (name, pips, current value, Equip, Upgrade); fits 667×375 to desktop without scrolling (measured) |
| 2.b | "Not bought" looked like a live button | Disabled buttons look disabled |
| 2.d | Alone, **Wide Warhead did nothing** (43% clears with or without it, average bot, 60 runs) and Fast Motors little (53%) | Warhead +40% a level (3× at L5: 68%), Motors +20% (2×: 67%); Reload 80%, Magazine 83%, Fuse 82% |
| 2.e | No single upgrade lifts the casual bot (2–8% clears at L5) | **Not fixed** (see Limitations) |

Retest: a probe owned three upgrades, equipped one in the Armory, switched
it in the picker, and read the run's gun (`{magazine: 1}`: rack 7, blast and
fuse at base).

## Cycle 3 — a full playthrough in the browser

A driver played as a person would at 2×: tapping threats and pickups, firing
abilities from their buttons with the gesture each needs, picking cards. It
checked a loss, a win from wave 10, the post-win walk (result → Armory →
menu → map 2 → picker) and endless.

Verified: salvage paid exactly to the formula (a loss: 54 ships + 7 waves ×
6 = 96; a first clear: 4 + 6 + 40 + 80 = 130); map 2 unlocked; the strip and
the picker kept the equipped gun; endless counted on past 10 with no "/10";
no page errors.

| # | Finding | Fix |
|---|---|---|
| 3.9 | A run started at a later wave (dev, `?wave=N`) handed over its abilities at 0% | They start full (they would have charged all along) |
| 3.13 | With all three evolved, the draft still said "level up an ability you hold" | It says what the hand allows: swap one, or Resupply |
| 3.16 | The swap prompt's "above" (correct, but easy to misread) | "tap the one it replaces, above (its levels are lost)" |
| 3.17 | Buttons were ordered by roster, so a new ability could take slot 1 and **shift the others under the thumb** | Stable slots: a new ability takes the next slot, a swap the replaced one's |

## Cycle 4 — every screen on phones

An audit opened every screen at 844×390, 874×402 and 667×375 and flagged
hidden scrolling, anything off screen and small tap targets.

| # | Finding | Fix |
|---|---|---|
| 4.1 | The menu (taller with the Armory strip) scrolled: **Settings off screen** | Compact title, pitch and strip on short screens (the pitch goes below 400 px) |
| 4.2 | The swap step's targets: 26 px chips, a 17 px "Cancel" link | 40 px chips, a real Cancel button |
| 4.3 / 4.8 | The draft and the swap step scrolled at 667×375 | Smaller art at the smallest size; the swap prompt and Cancel share one line |
| 4.7 | Tesla Arc's card said "Your gun is charged: keep tapping" before you had it | "Press it, then keep tapping threats" |
| 4.9 | The rail's "×1.4" showed through beside "ABILITIES" | A darker draft backdrop |

Left as is: the result screen's "Download log" link is small (14 px); it is a
secondary, developer-facing link.

## Cycle 5 — abilities against their words, and edge flows

| # | Finding | Fix |
|---|---|---|
| 5.1 | Hold Hellfire Salvo, slide onto the rail, lift: **nothing fired** and it stayed armed (the release went to the rail) | The battlefield keeps the finger for the whole gesture (pointer capture) |
| 5.2 | The same for an Air Strike swipe that ended over the rail | Same fix |
| 5.3 | Salvo's ring followed the finger but the rockets went to the **press** point | They go where the ring is when the finger lifts |
| — | Card text vs the game: no mismatch found | A test now pins every number the cards and the Armory blurbs quote to the values the game uses |

Also verified: pausing while armed (a tap does nothing, resume keeps it
armed), keys 1–3, an armed ability at the wave's end (the draft starts
clean), quitting during a Railgun takeover (a clean new run).

## Cycle 6 — real touch on a phone

Real touch events (Chrome DevTools Protocol) at 844×390: a button tap (EMP), an
Air Strike swipe, a one-second Salvo hold (10 rockets at level 2, the full
hold), hold-to-fire on the battlefield (4 shots in 2.2 s, the 0.6 s repeat),
and a two-finger tap (two interceptors). **No defects found.**

## Final checks

- `npm run build`; `npm test`: 876 tests (V1, V2, V3).
- `npm run e2e:v3`: 33 checks, passed three runs in a row. New in this
  round: the gun picker, a new ability starting at 0%, empty slots never
  animating.
- `npm run e2e:v2` and the classic smoke test pass.

## Limitations

- **The casual player's wall (2.e).** One upgrade per run can't lift a
  player who reacts slowly and misses often. In the bot measurements the
  casual bot is still on map 2–3 after 60 runs (with all five upgrades it
  had cleared through map 4 in the same 60 runs). Options if real play shows the same: let the equipped
  upgrade's top levels go further, add a second, cheaper "support" slot, or
  ease maps 2–5 a little. That is a design call for the player to make.
- These are **bot and scripted-input** checks. The probes play competently but
  not like a person: they can't judge feel, pacing or whether a gesture is
  comfortable. The next real playtest log will say more.
- The win flow was tested from a wave-10 start, the endless flow with the
  Shield power-up held on. Both are real game states reached by shortcut; a
  full ten-wave win was not played end to end by the driver (it lost on
  waves 8 and 9).
