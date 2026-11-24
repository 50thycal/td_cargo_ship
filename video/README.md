# Promo clips (X / social)

One command makes short, captioned gameplay clips of Straitwatch, ready to post:

```bash
npm run video              # every clip -> video/out/
npm run video -- railgun   # one clip
npm run video -- --list
```

Needs `ffmpeg` and Chromium (Playwright's, at `/opt/pw-browsers`, or set `CHROMIUM_PATH`).
It builds the game first if `dist/` is missing and serves it on port 4180 (`VIDEO_PORT`).

## What it makes

Each clip comes out twice, H.264 + AAC (silent track, because X's uploader likes having one), 30 fps, +faststart:

| file | size | use |
|---|---|---|
| `<clip>-16x9.mp4` | 1280x720 | default X timeline video |
| `<clip>-9x16.mp4` | 1080x1920 | vertical: the game over a blurred copy of itself, caption on top |

Clips are 13-22 s and about 1-2 MB, far under X's limits (140 s, 512 MB).

| clip | what happens |
|---|---|
| `convoy` | studio scene for the launch post (vertical only): wave 1 with drones, ballistic and supersonic missiles, ammo/repair drops, the upgrade pick, then wave 2 and the picked weapon dropping and firing |
| `convoy-real` | the same idea on a natural wave 7 and 8 (no placed enemies) |
| `railgun` | normal gun, then the game drops a Railgun pickup, tap it, beams through real incoming threats, back to the normal gun |
| `arsenal` | Gravity Well, Air Strike and Thermobaric Shell as the game drops them, each aimed at real threats |

Each clip also gets `<clip>.captions.json`: the caption timeline (seconds) and what the take did.

## It is real play

Nothing is spawned or placed by the script. It sets Free Play's own options (wave, weapons
held, frequent drops), then taps only what the game puts on the water: threats with the normal
gun, weapon pickups when they drop, and the loaded weapon aimed where it will hit
(the railgun along the line with the most threats; shells and the Well at the densest cluster).
It never fires into empty water.

Waves are random, so each clip is recorded several times (`VIDEO_TAKES`, default 3-4) and the
take with the most real hits and the least dead time is kept, the way you would pick from raw footage.
The caption start is set after the fact, so the clip opens on a few seconds of ordinary play.

## Studio mode (scripted scenes)

A clip with `studio: true` is shot to a script instead of waiting for the right wave. The scene empties the wave's own
launch list, then launches what the script asks for, when it asks (`runTimeline`: `spawn`, `drop`, `cue`, `end` events),
and holds the wave open until the scene ends it. Everything else is the game: its enemies, its interceptors, its
upgrade draft screens, and the director's real taps. Only ammo and repair drops are placed (`window.__onlySupplies`
also hides nukes and other power-ups).

Studio clips say so: `<clip>.captions.json` has `"studio": true`. Use real-wave clips (`convoy-real`, `railgun`,
`arsenal`) when a post should say "this is a natural wave".

## Why some clips still hitch (and what helps)

Headless Chromium's frame capture drops about a quarter of a second of frames now and then. Measured: the game itself
renders every frame; the stalls are in the capture. What the pipeline does about it, in order of effect:

1. A hidden rehearsal in the same page before the clip starts (studio scenes), so the first draw of each enemy type, drop
   and weapon is paid off camera. This removed most of them.
2. Frames go on an even 1/60 s grid (the capture's own timestamps jitter), and the game gets an even 60 Hz clock, so the
   game takes one physics step per frame like a phone display.
3. Short holes (under 100 ms) are filled by motion interpolation. Long ones are held: interpolation cannot span fast movement
   and a wrong fill looks like an object jumping, which is worse than a short hold.
4. Takes are scored on the stalls that land inside the finished clip, and the smoothest is kept.

A few short freezes can remain in the busiest seconds. For a perfectly smooth result, screen-record the real game on an
iPhone and use this tool's captions and cuts on that footage.

## Cuts and trims

`t.cuts.push([from, to])` takes a stretch out of the video and moves later captions up to match (the convoy scene
cuts the playtest-only "Rate wave" panel). A studio clip starts exactly at `t.start`, so setup screens before it
never show. `studioOffer(page, id)` deals a chosen weapon card first in the upgrade draft.

## Smooth capture

Playwright's built-in video is a fixed 25 fps screen grab, which looks steppy on fast scenes (about 18% exact
repeat frames after conversion to 30 fps). A clip can set `capture: 'cdp'` (or run with `VIDEO_CAPTURE=cdp`) to
record Chromium's own frame stream instead, at about 60 fps with real timestamps, and the clip is encoded at 60 fps
(0% repeats). The game itself holds 60 fps headless; the stutter was only ever in the recorder.
Chromium's capture stream also drops about 16 frames at a time every few seconds while the game is busy (not caused by
the game, the bot, audio, CSS or browser flags; all tested). The kept take is rebuilt with those holes
motion-interpolated, and only those (`VIDEO_FILL=0` to skip), so nothing else is touched. The recording is also
muted and the bot taps calmly (rounds in the rack only, one tap at a time) to keep the machine's load down. `convoy` uses it.

## How it works

`make-clips.mjs` plays the real game in headless Chromium with real mouse clicks (the
`window.__v3` hooks that `e2e/v3.mjs` uses), records the page with Playwright, then ffmpeg
trims, burns in captions and encodes both sizes. Capture is real time, so a slow machine can
look a little choppier.

## Add a clip

Add an entry to `CLIPS` in `make-clips.mjs`: an async `play(page, t)` that drives the game,
sets `t.score` (higher is better, used to pick a take) and `takes`.
`t.start = t.now()` sets where the clip starts (everything before is cut),
`t.cue('Headline', 'sub line', seconds)` shows a caption from that moment, `t.stop()` ends it.
Helpers: `startFreePlay`, `defend`, `weaponPickup`, `fireAt`, `fieldThreats`, `kills`.

Output (`video/out/`) is git-ignored; clips are rebuilt on demand.
