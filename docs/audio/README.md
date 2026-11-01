# Straitwatch V3 sound: files to listen to and look at

Made in sound round 1 (`docs/design/v3-sound-round1.md`). Nobody has heard
these yet; they were checked by measurement only.

| file | what |
|---|---|
| `sound-board.wav` | every cue in turn at its mix level, 4.1 min; `sound-board.md` says what plays when |
| `renders/calm.wav` | wave 1 on the Strait, 30 s |
| `renders/busy.wav` | Harbor Mouth waves 9–10 with Battle Group, Fragstorm and Carpet Strike, the busiest 30 s |
| `renders/win.wav` | the last 30 s of a map cleared, into the result music |
| `renders/loss.wav` | the last 30 s of a lost run, into the result music |
| `renders/*.png` | each render's waveform and spectrogram |
| `cues/<cue>.png` | every file of a cue: waveform over spectrogram (log frequency, 0 to −90 dBFS) |
| `sheets/<family>.png` | a family of cues on one page (gun, weapons, threats, …) |
| `qa-report.md` | per-file checks: leading silence, true peak, loudness, duration, DC, loop seams |
| `mix-report.md` | the renders measured: clipping, voices, rates, alerts over the rest |
| `fingerprints.md` | each cue's spectrum and its most similar other cue |

The renders were mixed offline by the game's own mix rules
(`tools/v3/audio/render.ts`); in the game, Developer mode → Settings →
♪ Sound board plays any single sound.
