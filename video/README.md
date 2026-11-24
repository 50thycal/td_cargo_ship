# Promo videos (X / social)

One command makes short, captioned, smooth gameplay clips of Straitwatch, ready to post:

```bash
npm run video              # every clip  -> video/out/
npm run video -- convoy    # one clip
npm run video -- --list
```

Needs `ffmpeg` and Playwright's Chromium (including its **headless shell**, `chromium_headless_shell-*`, under
`/opt/pw-browsers` or `PLAYWRIGHT_BROWSERS_PATH`). It builds the game first if `dist/` is missing and serves it on port 4180
(`VIDEO_PORT`). A 40-60 s clip renders in about 3 minutes.

## What comes out

H.264 + AAC (a silent track, because X's uploader wants one), 60 fps, +faststart, well under X's limits (140 s, 512 MB):

| file | size | |
|---|---|---|
| `<clip>-9x16.mp4` | 1080x1920 | vertical: the game over a blurred copy of itself, captions on top |
| `<clip>-16x9.mp4` | 1280x720 | landscape (skipped for clips marked `vertical: true`) |
| `<clip>.captions.json` | | the caption timeline (seconds), what the take did, and `studio: true` when enemies were placed |

| clip | what it is |
|---|---|
| `convoy` | the launch clip (studio, vertical only): what the game is, the first missile, an upgrade, a new weapon |
| `railgun` | a natural wave: the game drops a Railgun pickup, tap it, beams through real threats |
| `arsenal` | a natural wave: Thermobaric Shell, Air Strike and Gravity Well as the game drops them |

## How it stays smooth: frames mode (the standard)

Recording a browser in real time loses frames. Chromium's screen capture drops about a quarter of a second of frames now and
then, and a busy machine makes the game's own frame timing wobble. So **nothing is recorded in real time.** Every clip is
rendered one frame at a time:

- It runs in Playwright's chromium headless shell with begin-frame control: the browser draws a frame **only when asked**,
  with an exact timestamp. Each frame is exactly 1/60 s of game time, so the game takes one physics step per frame and
  nothing is dropped, repeated or late, however slow the machine is. A slow moment just takes longer to render.
- The director's clock is the frame counter (`sleep(ms)` waits for frames, `nowMs()` reads them), so a 0.8 s hold on the
  Charge Lance is always 48 frames.
- The game's playtest notes are switched off (no "Rate wave" scorecard, no Note buttons) and its sound is muted.
- Measured on the launch clip: no freezes in play, no repeated frames, no one-frame holds. With real-time capture the same scene
  had 20+ freezes and about 175 repeated-then-jump frames.

## Making a video for someone with no context

A caption does not work while the action moves: nobody can read and watch at once, least of all someone who has never seen
the game. So the launch clip uses **explain beats**:

- The key moment pauses the game, a ring and a short label are drawn **on the thing itself** (YOUR CARRIER, CARGO SHIPS, ENEMY
  MISSILE, NEW WEAPON, PICK AN UPGRADE), it holds long enough to read, and play carries on.
- Top captions stay short (a headline of five words or fewer, a short second line), sit in their own area above the game, and
  never stay up for less than 2.8 s.
- Open with a paused title beat that names what is on screen, then show, then explain only when something new appears.

`VIDEO_EXPLAIN=0` renders the same footage with captions only, no pauses or rings. Compared side by side, captions-only left
the viewer looking at empty sea while reading, so explain beats are the default.

## Writing a clip

Add an entry to `CLIPS` in `make-clips.mjs`: an async `play(page, t)` that drives the game with real taps.

- `t.start = t.now()` sets where the clip starts; `t.cue(head, sub, secs)` shows a caption from that moment;
  `t.stopAt` ends it; `t.cuts.push([from, to])` takes a stretch out (later captions move up to match).
- Set `vertical: true` for 9:16 only, `viewport` for the render size, `takes` to render several and keep the best `t.score`.
- Natural waves: `startFreePlay` (wave, weapons held, frequent drops), `defend`, `playUntil`, `weaponPickup`, `fireAt`.
- Studio mode (`studio: true`) shoots to a script instead of waiting for the right wave. It empties the wave's own launch list
  (`studioBegin`), then launches what the script asks for when it asks (`studioSpawn`, `studioDrop`, `studioDropWeapon`) and
  holds the wave open until `studioEnd`. `studioDealOnDraft(page, id)` deals a chosen weapon card first in the next upgrade
  draft. Only ammo and repair drops (and the picked weapon) stay on the water (`window.__onlySupplies`, `__allowWeapon`).
  Everything else is the game's own: its enemies, its interceptors, its draft screens. The clip's `.captions.json` says
  `"studio": true`, so use natural-wave clips when a post should say "this was a natural wave".
- Explain beats: `explain(page, [{ what: 'carrier'|'ship'|'threat'|'pickup'|'card', kind?, idx?, head, sub? }], ms)`.
  `waitForThreat` waits for a kind to be out on the water so a beat can point at it; `playFor(page, secs)` plays with the normal gun.

The bot plays calmly: it taps only with rounds in the rack, one tap at a time, and not while three interceptors are in the air.

## Older real-time modes

`capture: 'cdp'` (Chromium's screen capture, with hole-filling) and Playwright's own `recordVideo` still exist in the code for
reference. They stutter and are not used by any clip. Do not use them for new work.
