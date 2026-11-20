# V3 UI overhaul: front door, command-room look, Settings, Test Lab

**Date:** 2026-11-20. Presentation only: no simulation, rule or balance change; `LOG_VERSION` stays 31 and the map-lab baseline replays exactly.

The player's ask: open straight into V3 with the older stuff hidden; clean up Settings; upgrade the look toward "a modern tactical, high-tech command room on an aircraft carrier"; and clean up the Test Lab so that what's new to test is front and centre.

Screenshots (phone held sideways, 844×390): `docs/design/img/ui-overhaul/before-*.png` and `after-*.png` (root, menu, settings, lab, lab-tools, lab-played, hud). Regenerate them with `node e2e/v3-ui-shots.mjs` (`BASE_URL`, `SHOT_DIR`, `PREFIX`).

## The front door

- `index.html` (the site root) forwards to `v3.html` before anything loads, keeping the query and hash (`/?dev=1` lands on `v3.html?dev=1`).
- **The hidden legacy route:** `/?legacy=1` (or `index.html?legacy=1`) still opens the classic game and its version picker. `v2.html` is untouched and still reachable by its own address.
- The V3 menu no longer shows the "Play V2" link. On the developer route (`?dev=1`, or with developer mode on), Settings' Developer card links Classic and V2.
- The App Store / Capacitor build is unchanged: it has always shipped V3 alone as its `index.html` (`vite build --mode store`), and the redirect is in the playtest build's classic page only.
- `e2e/smoke.mjs` and `e2e/workshop.mjs` (the classic game) now open `/?legacy=1`; V2's "classic version" link points there too.

## The look: a carrier's combat information centre

All in `src/v3/ui/style.css`: tokens at the top (`--steel`, `--steel-hi`, `--amber`, `--ok`, `--mono`, `--brackets`, `--cic-fill`, `--cic-line`), small in-place changes to the shared components, and a "The command room" section at the end of the file for the new pieces.

- Behind every menu screen: a faint plotting grid and scanlines (`::before` on the overlay, under the panels). Behind the main menu: range rings and a slow radar sweep.
- Bracket-cornered panels (Settings cards, Test Lab panels, the HUD readout; map cards light their brackets on hover and on the next map), status lights (`.v3-led`: live cyan, ok green, warn amber).
- Monospace caps for readouts: the top keys, screen titles, eyebrows, group names, chapter numbers, the HUD's WAVE / SCORE / SUNK.
- Steel buttons with a cyan primary; switches, sliders and choice chips in cyan (they were gold).
- The menu gains a status line ("CIC · SECTOR 1 · HOME WATERS · 0/20 SECURED") and a subtitle under the title.
- Reduced motion: the sweep and the blinking lights stop. The battlefield (ships, enemies, the map render) is untouched; in play only the HUD box and rail buttons change.

## Settings

Grouped and relabelled: **Audio** (sound, volume, music) and **Playtest** (playtest notes, with a build / log version line) on the left; **Gameplay** (call-outs, show tips again) on the right. The **Developer** card (developer mode, watch mode and its personas, the sound board, links to the Classic and V2 builds) shows only on the developer route `?dev=1` or while developer mode is on. The App Store build's Settings keep their rows, with the same group names (Audio, Gameplay, About).

## The Test Lab

Top to bottom, so the player rarely scrolls:

1. **Ready to test**: the newest builds, each with a tag on its corner (New or Polished, and its log version), one line on what changed and what to look for, and a big Play (it opens the map's full production card). Played builds tick off ("✓ Played · again") and drop to the end.
2. **All maps**: the 26 map cards in a compact grid, a row per chapter. A lit left edge marks tested (green) or changed since your test (amber); The Strait, The Gauntlet and Harbor Mouth have small v2 / v3 keys for their other encounter versions.
3. **Tools** (folded; the screen head's Tools key opens it): events, new enemies, weapons, combos, Next up, Play 5, Quick / Full, the session report, Map Analytics and the feedback page, as before.

### Updating Ready to test

Edit `READY_TO_TEST` in `src/v3/data/lab.ts`, newest first:

```ts
{ map: 'island', log: 31, tag: 'New', note: 'Island silos fire point-blank at both lanes. Can you cover the far north lane?' },
```

- `map`: the map id; Play opens its map card (`map-<id>`).
- `log`: the `LOG_VERSION` the build shipped in.
- `tag`: `'New'` (the map's first rebuilt build) or `'Polished'` (a pass after the player's notes).
- `note`: one line, 90 characters at most (a test checks), saying what changed and what to look for.

An entry ticks itself off when a finished run (won, lost or quit, or with a Test Lab verdict) of that map at that log version or later is on the device (`readyPlayed` in `src/v3/ui/lab.ts`); the tick is remembered under `straitwatch.v3.lab.ready` once the device has dropped the log. Bump `log` on an entry to ask for it again; remove entries that no longer need playing.

## Checks

`npx tsc --noEmit`; `npx vitest run --exclude '.claude/**'` (new: `tests/v3/readyToTest.test.ts`); `npm run v3:map-lab -- baseline` (every run the same); the e2e scripts that open the menus and the lab, with their selectors moved where the cards went into Tools (`e2e/v3.mjs`, `v3-map-cards.mjs`, `v3-map-analytics.mjs`, `v3-convoy.mjs`).
