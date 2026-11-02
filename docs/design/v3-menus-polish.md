# V3 menus: the screens before a run, cleaned up

The player asked for the Armory, the map screen and every menu before a run
to "look more professional and clean": remove repeated text and redundant
information, lay out properly in landscape (the only orientation the game
supports), keep the information simple to read, and add new images and
animations where they help.

## What success looks like (the player's view)

1. **Each fact is said once per screen.** A lock, a bay name, "not found",
   or a map's name never appears twice on one screen.
2. **It fits every landscape screen the game is played on**:
   - 667×375 (the smallest phone), 844×390, 874×402 (the player's iPhone);
   - and 1280×720 (desktop).

   Nothing is clipped or runs off the side. The main action is on screen
   without scrolling.
3. **One glance tells you what to tap next.** The map to play next stands
   out, and each screen has one primary button in the same place.
4. **It looks like a finished game:**
   - one header style (Back and title) on every screen;
   - one button style;
   - consistent spacing and type;
   - no web-style underlined links;
   - real pictures of the maps, not just names.
5. **Motion with a purpose:**
   - screens and cards ease in;
   - the menu has life behind it;
   - tapping a locked map tells you why;
   - nothing animates for a player who asked for reduced motion.
6. **Portrait asks to turn the phone** on every screen, not just in a run.
7. **Nothing regresses:**
   - equip, loadout, Free Play and settings all still work;
   - tests and browser checks pass;
   - the menu doesn't cost frame time a phone needs.

## Baseline (before)

Captured from a fresh save and from a save with progress (8 maps open, 9
cards), at all four sizes and in portrait.

| # | Screen | Problem |
|---|---|---|
| B1 | Menu | A two-line tagline teaches the controls, which the first wave's own hints already teach. |
| B2 | Menu | The Armory strip packs four facts into one bar ("⚓ ARMORY · 9 cards found · Wide Warhead 2 · Point Defense 2 · Your cards →"). The loadout is chosen again before each run anyway. |
| B3 | Menu | A locked map says it three times: "Clear X to unlock.", a 🔒 at its foot, and greyed out. |
| B4 | Menu | Every open map that hasn't been played says "Not played yet" in gold, so nothing marks *the* next map. |
| B5 | Menu | The cards are text only, with 3–4 line blurbs at 667 wide. Cards differ in height; five cards in a 3-column grid leave a hole. |
| B6 | Menu | The footer mixes three styles: a bordered button (Free Play), a plain link (Settings) and an underlined gold link (📝 Note). |
| B7 | Loadout | The map's name twice ("THE STRAIT" eyebrow and "Sail: The Strait →"). The subtitle repeats the title. Tiles say "None / leave it empty" and "Base gun / no upgrade". |
| B8 | Loadout | Three equal buttons (Armory, Menu, Sail). No picture of the map, nor what it is about. |
| B9 | Armory | A three-sentence paragraph under the title. |
| B10 | Armory | Every card repeats its bay ("GUN") under the GUN tab. A card not won says so three times: a NOT FOUND badge, "LV 0/5", and "Not found yet · first card: …". |
| B11 | Armory | At 667×375 the five cards are cramped (4-line stats) and Back sits under them. |
| B12 | Settings | At 874×402 three rows fill the screen, and the fourth is under the Back strip: one narrow column on a wide screen. |
| B13 | Free Play | The title and a two-line subtitle push the form down. "Menu" sits beside Start in the same weight. |
| B14 | Portrait | The menus lay out in portrait (tabs cut to "2 The N…"). The "turn your phone" notice only shows during a run. |
| B15 | All | Screens snap in with no transition. The menu is a flat dark page. |

## What changed

**Main menu.**
- **Title.** The title is centred with a new mark: a radar ring with a turning sweep over a hull.
- **Top bar.** One style for every button: Armory (with a gold count of cards found), Free Play, Note (while playtest notes are on) and a gear for Settings.
- **Removed:** the tagline (B1) and the Armory strip (B2). The loadout is chosen in the briefing now.
- **Map cards.** Each chapter's five maps sit in one row of picture cards.
  - **Pictures.** These are new images: each card shows its real map, drawn by the game's own renderer (`src/v3/ui/thumbs.ts`). It shows land, lanes, bases, the carrier and the convoy under way, with no threats. Each picture is drawn once on an idle frame and fades in.
  - **Under each card:** its number and name, then ✓ and the score for a cleared map, or the best wave for one tried and not cleared.
  - **The next map.** It carries NEW and a slow glow (B4).
  - **A locked map** is a blurred picture with a lock, and its name. Tapped, it shakes and one line says why ("Clear Lee of Marrow to open The Gauntlet") (B3).
- **Chapter tabs** show how many maps are cleared ("2/5"), or a lock.

**Briefing (new; replaces "Choose your loadout").** Tapping a map opens its briefing (B7, B8).
- **Left column:** the map's picture, what it is about (the blurb moved here from the menu), the best result, and Sail.
- **Right column:** the loadout. A tile is a card's name and level pips.
- **Each bay's heading** says once what its chosen card does ("GUN 180% blast"). Before, every tile said it, cut off.
- **A new player** sees the base gun, and one line on how Armory cards are won.
- **"Try again"** with no cards still goes straight back into the run.

**Armory** (B9–B11).
- The header shows Back, the title and "9 cards found".
- One line of help replaces the paragraph.
- The bay's name is on its tab only, not on every card.
- A card not found yet:
  - shows a lock on its greyed art;
  - and its first level ("First card: 140% blast").

  It no longer shows a NOT FOUND badge, LV 0/5 and "Not found yet".
- EQUIPPED sits on the art's corner.
- The art is larger on a phone.

**Settings** (B12).
- Two cards side by side, Sound and Playtest, with one sentence a row and hairlines between rows.
- The developer card appears only in developer mode.
- It fits a 667×375 phone; before, it was 630 px tall in a 351 px panel.

**Free Play** (B13).
- The header, then two titled cards ("Map and weapons", "Armory").
- Frequent drops is a real switch.
- Start sits at the bottom right, with the "nothing counts" note beside it.

**Every screen.**
- **The same header:** Back on the left, the title in the middle. It stays in view if a screen ever scrolls.
- **The same entrance:** a short rise and fade, not replayed on a redraw of the same screen (a tab, an equip).
- **Line icons** in place of mixed emoji.

**Live backdrop** (B15, new animation).
- The menu has the chapter's next map behind it, its convoy sailing at 0.7×, softened and darkened at the edges.
- The briefing has the briefed map behind it.
- It steps at most 30 times a second and stops for reduced motion.

**Portrait** (B14). Every screen, not only a run, shows "Turn your phone sideways" with a turning phone.

**Found along the way:**
- **Next after a win.** "Next: <map>" after a won run used to close that run's log as "quit" when Sail was pressed. It now closes as "won", as the menu always did.
- **Two regressions from this round,** fixed before the end:
  - the result screen's gold Armory button lost its style when the old strip's CSS went;
  - Back was silent: an attribute told the shared sound handler to skip it.

## Cycles

| # | Focus | Found → fixed | Verified |
|---|---|---|---|
| 1 | Main menu and map select | B1–B6 rebuilt. A re-check found three problems: long names cut ("The Needle of B…"); the gear icon read as a sun; an icon-only note button. Developer mode also clipped the cards at 667×375 and marked every map NEW, and at 1280×720 the maps were pinned to the bottom edge. Fixed: two-line names, a real gear, a labelled Note, a smaller title in developer mode, NEW only for maps the save opened, a capped height. | Screenshots at 874×402, 667×375 and 1280×720: fresh save, progress save, developer mode. |
| 2 | Briefing and the shared header | B7–B8. Then: tile names cut to "Qui…" by the pips. Then each tile's stat cut ("1.27 s a ro…"), and the Supply row scrolled out of view (874×402). Fixed: name and pips only, one stat per bay heading. Then: two tiles a row at 667 still scrolled, and Sail floated far below at 1280×720. Fixed: phone column split, Sail under the description, the screen sized to its content. | Panel overflow measured at four sizes. The screenshot measure itself was wrong at first (it read the overlay, not the panel) and was fixed before trusting it. A normal save fits everywhere. A save holding all 11 cards scrolls, with Back and Sail in view. |
| 3 | Armory | B9–B11. Then: small art on a phone with height to spare (larger now), a long hint (shortened), "next" lowercase. | Screenshots of all three bays, fresh and with cards, at four sizes. No overflow. |
| 4 | Settings and Free Play | B12–B13. Then: group titles lost their small caps; the Settings cards had uneven heights; "Thermobaric Sh…" was cut at 667. Developer Settings with watch mode on still scrolls, so the header stays in view (developer only). | Settings fits at all sizes (it scrolled before). Free Play fits. |
| 5 | Motion, backdrop, portrait | A map label ("SINGLE FILE") read through the title (now softened). The header's backing showed on screens that don't scroll (now only when they do). Portrait showed the squashed menu through the prompt (now opaque). The locked-map line covered names (moved above the tabs). Reduced motion still played the screen entrance (a specificity bug, fixed). | Scripted at 874×402: the backdrop moves (62 steps in 1.5 s, canvas changes); a chapter or briefing changes the map behind; Sail turns it off. With a 4× slower CPU, frames on the menu matched the field (median 16.7 ms, p95 33.4 ms on both). With reduced motion: nothing animates and the canvas is still. A locked tap shakes and explains. |
| 6 | Regression, by touch | The two regressions above. | `npm test` (967 pass). `e2e:v3` with a new phone section: every screen fits at 667×375, 844×390 and 874×402; the maps have pictures; no repeated "to unlock" or "not found"; one next map; a locked map explains itself; the briefing and Sail; portrait. `e2e/v3-audio.mjs` passes, Settings mute included. Real flows: win the Strait, Next, Kesh briefing, Back (Strait ✓, Kesh NEW); lose and Try again with no cards, straight in. Every menu control makes its sound. 60 screen captures, overflow measured. |

## Limitations

- **Untested on a real phone.** Checked in Chromium at phone sizes, with touch and a slowed CPU, not on an iPhone. Safari's blur on a moving canvas has not been measured on a device.
- **One rare case scrolls.** The briefing scrolls when every Armory card is held at 667–874 px tall. Back and Sail stay in view.
- **Dated pictures.** Map pictures are drawn in the browser on each visit, about 10–20 ms a map on a desktop, on idle frames; they are not cached across visits.
- **One extra tap.** A new player now has a briefing before the first run.
