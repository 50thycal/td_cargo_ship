# In-game keyboard (palate-keys)

The player's note and feedback boxes (pause menu → note, the wave rating's
note, the Test Lab's note) use an in-app touch keyboard instead of the phone's,
which covers most of a landscape screen. **Playtest build only**: the App Store
build has no text boxes and bundles none of it (`src/v3/ui/keys.store.ts`
stands in for `keys.ts`).

- The keyboard is the shared `palate-keys` package, developed in the Palate
  repo (`packages/palate-keys`, its README has the API). It is copied into
  `vendor/palate-keys` — don't edit that copy.
  - Update: `npm run keys:sync` (reads `../Palatte`, or clones 50thycal/Palatte),
    then commit. `node tools/sync-keys.mjs --check` reports drift.
- `src/v3/ui/keys.ts` is the game's side: colours (`style.css`, "In-game
  keyboard"), the note hotkeys (🎤 dictate, `@ now` stamps the wave and time,
  quick verdicts: tap = one word, swipe up = its opposite), the game's words
  (foes, weapons), and it claims every text box a dialog builds.
- The dialog fits above the keyboard through `fitTyping` (`--vv-h` minus the
  keyboard's `--kb-h`).
- Desktop keeps its real keyboard. `?keys=always` forces the in-app one on a
  desktop; `?keys=off` turns it off.
- Test: `npm run dev -- --port 5173` then `BASE_URL=http://localhost:5173 npm run e2e:v3:keys`.
