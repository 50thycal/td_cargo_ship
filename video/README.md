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
| `convoy` | title, pick The Strait, defend the convoy by tapping inbound missiles |
| `railgun` | a weapon drops, tap it, every tap is a beam through the swarm |
| `arsenal` | Air Strike, Thermobaric Shell and Gravity Well back to back |

## How it works

`make-clips.mjs` plays the real game in headless Chromium with real mouse clicks (the
`window.__v3` hooks that `e2e/v3.mjs` uses), records the page with Playwright, then ffmpeg
trims the menu dead air, burns in captions and encodes both sizes.
Frames are captured in real time, so a slow machine can look a little choppier.

## Add a clip

Add an entry to `CLIPS` in `make-clips.mjs`: an async `play(page, t)` that drives the game.
`t.mark()` sets where the clip starts (everything before is cut) and
`t.cue('Headline', 'sub line', seconds)` shows a caption from that moment.
Helpers: `defend`, `grab`, `dropWeapon`, `fireAtThreat`, `swarm`.

Output (`video/out/`) is git-ignored; clips are rebuilt on demand.
