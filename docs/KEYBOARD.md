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
  keyboard"), the hotkeys, the words and the Fix key (below), and it claims
  every text box a dialog builds (Test Lab verdict boxes get the `verdict`
  strip, every other box the `note` strip).
- The dialog fits above the keyboard through `fitTyping` (`--vv-h` minus the
  keyboard's `--kb-h`).
- Desktop keeps its real keyboard. `?keys=always` forces the in-app one on a
  desktop; `?keys=off` turns it off.
- Test: `npm run dev -- --port 5173` then `BASE_URL=http://localhost:5173 npm run e2e:v3:keys`.

## Built from the player's own notes

The hotkeys, suggestions and fixes come from 201 playtest notes (Oct–Nov
2026), mostly dictated and with rough spelling, so they are tuned to that:

- **Hotkeys** (`keys.ts`): tap = the phrase they write most, swipe up = its
  opposite, hold = a third. Verdict strip: 🎤 · ✓ Fix · Good (overall / works
  as expected / much better) · Hard (doable / too hard / too easy) · Faster
  (slower / bigger) · Make (sure / it a little / more obvious) · Rework
  (remove / keep as is) · Later (tweak / try again). Note strip: 🎤 · ✓ Fix ·
  Note (for all maps / hold: stamps the wave and time) · Make · Fun (clutch /
  tough) · Overlap (jitter / smooth) · Audit (this map / all of these) · Hard.
- **✓ Fix** corrects the whole note (or the selected part) in one tap and is a
  single undo: known typos → voice-dictation mishears of the game's names
  ("Dual weld" → Dual Wield, "Tesla lab" → Test Lab, "Stargate Matt" →
  Saltgate map, "10 warthog" → an A-10 Warthog) → the keyboard's spell
  corrector on what's left. Contractions are left alone. (`noteWords.ts`)
- **Suggestions** (`noteModel.json`): after a word, what they usually write
  next ("good" → overall), their own sentence openers, and their habitual words
  weighted up. Only phrases that came up at least twice are kept, as counts.
- **The game's words** come from its data (`noteVocab.ts`: names and ids of
  weapons, foes, maps, events…), so autocorrect never "fixes" them. A word
  they un-correct is remembered (localStorage).
- **Spelling is tested** (`tests/noteKeys.test.ts`): every word on a hotkey,
  every fix's output and every word the model suggests must be a dictionary,
  game or vetted word (`EXTRA_WORDS`); no game word may be changed by the
  corrector. Adding a hotkey with a typo fails the test.
- **Rebuild the model** from fresh notes: pull them from the playtest log
  store (`api/playlog.ts`: pause-menu notes, wave-rating notes, Test Lab
  `labResult.note`) into a JSON array of strings, then
  `npx vite-node tools/keys/note-model.ts -- notes.json`. Review the diff, and
  add new typos to `TYPO_FIXES` / dictation mishears to `DICTATION_FIXES`.
