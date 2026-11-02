# V3 playtest notes and volley ratings

The player wanted to "easily add commentary on the game as I play and have
the notes save in the logs, so we can remember to follow up on that when we
analyze", stamped "at a specific time so the AI will have the context". They
picked two features from a brainstorm, and for the second added: "make sure
it drops it in after a volley of attacks, as they seem to come in groups…
an option in the pause menu to say rate, and it could be rate the
difficulty, fun and intense moments."

## 1. Pause and note

- **📝 NOTE** in the left rail (any player, not just dev mode; it replaces
  dev mode's 🚩). Tapping it pauses on that exact step and opens the note:
  - tags, any number: Bug, Too hard, Too easy, Unfair, Confusing, Fun, Idea;
  - a text box (the phone keyboard's 🎤 key dictates into it).
- **The pause menu** has "📝 Add a note" too; saving goes back to the pause
  menu.
- **What a note stores** (`PlayNote`, in the log's `notes`):
  - the step, so a replay on the same build lands on that exact frame;
  - **a snapshot of the game**:
    - wave and seconds in, score;
    - ships lost, carrier hull, ammo and rack size;
    - flow and formation;
    - the weapons held with their levels, and the one loaded;
    - the threats in play, by kind.

    An old log no longer replays once a later build changes the sim, so
    the snapshot keeps the note readable after that;
  - **a small JPEG of the battlefield**, 320 px wide (about 7 KB as
    measured; up to 12 a log).
- **The run is saved the moment a note is saved**, not only at the end, so
  the note reaches Claude even if the app is closed straight after.
- **📝 Note on the menu**: a thought not about one run. It is sent as a log
  of its own (`notesOnly: true`, no inputs).
- **Settings → Playtest notes** turns all of it off (on by default; flip
  `NOTES_DEFAULT` in `src/v3/ui/notes.ts` for a store build).

## 2. Volley ratings and the run's review

### Volleys

The game already plans each wave as raids, one every ~5 s, each one kind
of threat: swarm, barrage, volley or air strike. A raid alone is too short
to rate, and the player sees runs of the same kind as one attack (the
warning card says BARRAGE INBOUND three times in a row). So a **volley** is
a run of back-to-back raids of one kind (`volleyPlan`):

- it **opens** with its warning;
- each new threat counts towards the newest volley whose launches have
  begun;
- it **ends** once its launches are over and nothing it sent is still in
  the air (at most 8 s after its last launch).

Volleys overlap: the next warning comes up while the last missiles are in
the air. A wave has 5–7 volleys.

Every volley is logged, rated or not (`Volley`, in the log's `volleys`):

- its kind and how many raids;
- its start and end steps;
- the threats it brought, by kind;
- ships sunk, carrier hits, shots fired, and taps on an empty rack.

Losses count against the oldest volley still open.

### Rating a volley

- **When a volley ends, NOTE turns to ★ RATE** with one gold pulse. It
  stays RATE until that volley is rated or the wave ends.
- **Tapping it pauses on a dialog** headed with the volley ("Barrage ×3 ·
  wave 8"), plus what it brought and did ("14 ballistic missiles, 1 heavy
  cruise missile · 2 ships sunk").
- **Three rows of 1–5:**
  - **Difficulty** (easy … brutal);
  - **Fun** (a chore … a blast);
  - **Intensity** (calm … frantic).

  Then the same tags and text box as a note, optional. Save resumes the
  game.
- **The pause menu** has "★ Rate the last volley: Barrage ×3" at any time
  (✓ once rated).

### Marked moments

The game marks the run's hard moments as they happen (`Moment`, in the
log's `moments`, up to 60):

- **a ship sunk**, and by what;
- **the carrier hit**, hull before → after;
- **a burst**: 3 ships lost within 10 s, marked once per burst;
- **out of ammo**: 5 taps on an empty rack within 3 s, at most once every
  10 s;
- **a new threat** debuting.

### The review, after the run

The result screen has **📝 Rate & review** (gold until used). It opens:

- **the run's rating**: the same three rows, stored as the log's `rating`;
- **a timeline** of the whole run:
  - waves as bands;
  - volleys as a coloured line under them (the raid colour; bright with a
    gold edge if rated);
  - every marked moment and every note as a tick in its colour;
- **‹ ›** to step through the ticks. It starts on the first burst, else
  the last ship lost. Each stop shows when and what ("Wave 8, 31 s · 3
  ships lost in 10 s") with:
  - **▶ Watch it**: the run plays back from 6 s before the moment to 2 s
    after, inputs and all, at 1×. The HUD says ▶ REPLAY, and ■ on the
    right stops it. The review comes back afterwards;
  - **📝 Note on this**: a note tied to that moment;
- **📝 Note on the run**, then **Done** back to the results.

The log is re-sent after every rating or note on the review. On a cleared
map (still live for endless), the recorder gets the same note, so the next
save keeps it.

## For the analysis (Claude)

All of this is optional fields on the log. The log version stays 12: none of
it touches replay, and a test checks a log with notes, volleys and moments
replays exactly. To read a run's feedback, in order of use:

- `log.notes`:
  - `where`: pause, volley, review or menu;
  - `tags` and `text`;
  - `ctx`, the state as it stood;
  - `volley` or `moment` index, if tied to one;
  - `thumb`.
- `log.volleys[i].rating`: per-volley difficulty, fun and intensity, beside
  what the volley did.
- `log.rating`: the whole run's.
- `log.moments`: what the game itself flagged.

## Code

- **`src/v3/sim/feedback.ts`** (pure, tested):
  - types and constants;
  - `volleyPlan`;
  - `noteContext`;
  - `Watch`, which follows a run frame by frame.
- **`src/v3/sim/playlog.ts`**:
  - the Recorder owns a `Watch` (`observe()`, `note()`, `rateVolley()`) and
    puts notes, volleys and moments in every save;
  - `Playback` steps a log on from any step for "Watch it".
- **`src/v3/ui/notes.ts`**:
  - the note form, the rating rows, the timeline;
  - volley names and summaries;
  - the thumbnail;
  - the setting.
- **`src/v3/ui/app.ts`**:
  - the rail button, the pause menu, the dialogs;
  - the result → review → replay flow, with the result screen redrawn from
    `review` so it isn't recorded twice.

## Checks

- **`tests/v3/feedback.test.ts`** (9 tests):
  - raids grouping into volleys;
  - volleys recorded in a bot run, every ship lost counted against one;
  - ratings stored;
  - sunk, carrier and burst marks (one burst per burst), and the dry streak;
  - a note's step and snapshot;
  - notes, volleys and moments leaving the replay exact;
  - Playback matching `replayTo` step for step;
  - Playback stopping at the run's end.
- **`e2e/v3.mjs`**:
  - pause → add a note: its step, state and thumbnail in the log, then back
    to the pause menu;
  - a volley ending turns the button to RATE;
  - the rating lands on its volley, and the game resumes.
- **Browser walkthrough at 667×375:**
  - note, rate, pause menu;
  - a real loss, then the review;
  - ▶ Watch it and back;
  - a note on a moment;
  - the stored log carrying the rating, notes, moments and volleys.

## Limitations

- "Watch it" replays only on the build the run was played on, which is
  always the case on the result screen. Older logs rely on the note
  snapshot and thumbnail.
- What sank each ship isn't known per volley: losses go to the oldest open
  volley, which is right when volleys don't overlap and close otherwise.
- The rating dialog pauses the game. Rating is never forced; the button just
  turns to RATE.
