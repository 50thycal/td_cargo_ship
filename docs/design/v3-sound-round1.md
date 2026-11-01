# V3 sound — round 1

Straitwatch V3 was silent. Every mechanic now has a sound: every weapon, threat,
pickup, power-up, hull event, alert, UI action and screen, plus music for the
menu, battle (calm and intense) and the result screen. This round followed
`v3-sound-handoff.md`. The player can't listen yet, so every check here is
automated, and the results are rendered to files for listening later.

**Nobody has heard these sounds yet.** Every claim below is a measurement:
loudness, peaks, timing, spectra, mix levels. Where judging by ear would
matter most, it says so under *Limits*.

## Listen and look later

Everything is in **`docs/audio/`** (see `docs/audio/README.md`):

- `sound-board.wav`: every cue in turn at its mix level (4.1 min).
  `sound-board.md` lists what plays at each timestamp.
- `renders/calm.wav`, `busy.wav`, `win.wav`, `loss.wav`: 30 s gameplay mixes
  (stereo), each with a spectrogram PNG.
- `cues/<cue>.png`: the waveform and spectrogram of every file of every cue.
  `sheets/<family>.png` shows a whole family on one page.
- `qa-report.md` (per-file asset checks), `mix-report.md` (mix under load) and
  `fingerprints.md` (how alike any two sounds are).
- In the game, with Developer mode on: **Settings → ♪ Sound board** lists
  every sound with a play button, its files and its licence.

## Where the sounds came from (free, legal, swappable)

The container could not reach any sample library. kenney.nl, opengameart.org,
pixabay.com, freesound.org, sonniss.com and archive.org were all refused by
the environment's network policy. npm and PyPI were reachable. So:

- **UI sounds (12 cues)** are recordings from **uisfx** 0.4.0 (npm; audio
  licensed **CC0-1.0**, `LICENSE-AUDIO` in the package). They come from its
  `mechanical` (console switches), `scifi` and `cinematic` packs.
- **Everything else (90 cues)** is **synthesized** by
  `tools/v3/audio/synth.py`. Explosions, guns, engines and water are layered:
  a transient, a filtered-noise body, a sub thump, debris crackle and a
  synthetic room. Metal is modal synthesis, and horns and brass are detuned
  saws. The music is synthesized beds in D minor at 96 bpm. Synthesis is
  licence-safe by construction; these files are ours, released CC0 with the
  game.
- Every shipped file has an entry in `public/v3/audio/CREDITS.json`: file,
  source, source URL, author, licence and changes. A test fails if any file
  lacks one, or if the licence is not one that allows selling the game.

**To use recorded libraries instead** (for example Kenney's CC0 packs), allow
those hosts under the environment's network access (Settings → Network
access → allowed domains: `kenney.nl`, `opengameart.org`, `freesound.org`,
`pixabay.com`). Steps:
https://code.claude.com/docs/en/cloud-environments#network-access. Then
swap sounds as below.

### Swapping a sound

- **One file:** drop a file named after the shipped one into
  `assets-src/audio/custom/`, for example `kill.big.1.wav`, and add its
  source and licence to `assets-src/audio/custom/credits.json`
  (`{"kill.big.1.wav": {"source": …, "sourceUrl": …, "author": …, "licence": "CC0-1.0"}}`).
  Then run `python3 tools/v3/audio/prep.py kill.big`. Custom files win over
  synthesized and uisfx ones. Prep trims, levels and encodes the file and
  writes its credit.
- **One cue:** edit its entry in `src/v3/audio/manifest.ts` (files, volume,
  pitch spread, cooldown, voice cap, ducking). It is the only place a sound is
  chosen. A cue with no entry does not compile.
- **Rebuild everything:**
  `node tools/v3/audio/fetch-uisfx.mjs && python3 tools/v3/audio/synth.py && python3 tools/v3/audio/prep.py && python3 tools/v3/audio/qa.py`
  (needs `pip install numpy scipy pyloudnorm matplotlib pillow` and ffmpeg).
  Then `npx vite-node tools/v3/audio/render.ts && python3 tools/v3/audio/mixcheck.py`,
  `python3 tools/v3/audio/pictures.py` and `python3 tools/v3/audio/soundboard.py`
  for the listening files.

## How it works

- **The sim says when.** `game.ts` pushes a cue (`g.cues`) on the exact step
  its visual happens. The napalm burst comes when a canister bursts, the rail
  crack with the beam, a kill on the step the threat dies, and the ballistic
  whistle 0.9 s before it lands. Cues are write-only: the sim never reads
  them, and it clears them at the start of every step, so bots, sweeps and
  replays are unchanged (the existing replay tests pass, and a test checks a
  bot game still replays exactly). The UI drains the cues before each step
  (taps, picks), after each step and after each tap.
- **Continuous sounds come from state** (`audio/state.ts`): the burning
  row, a spinning blade, a gravity well, a supersonic missile arming (a
  beeping lock), the carrier critical (a klaxon), and enemy aircraft
  engines, which pan with the plane and swell in from the edge. The music
  bed is chosen by screen. Battle music turns intense from wave 6, or when
  14+ threats are on screen; an 8 s hold stops it flapping.
- **One mix policy** (`audio/policy.ts`) decides which cue plays, which
  variant (round-robin), its pitch (seeded random spread), pan (from x; jets
  sweep), its gain under crowding, and its ducking. The browser engine
  (`audio/engine.ts`, Web Audio) and the offline renderer use the same code,
  so the renders make the game's own decisions.
- **Engine:** sfx, ui, alert and music buses; alerts duck the effects; a
  safety limiter on the master. It unlocks on the first pointerdown (iOS),
  suspends when the page is hidden, and Time Warp pitches effects down 12 %.
  Cooldowns run in real time, so fast-forward doesn't machine-gun.
  Settings → Sound has on/off, volume and music, saved on the device.
  `window.__v3.audio` exposes a play log for tests.
- **Files:** AAC `.m4a`, 44.1 kHz, mono effects (96 kbps) and stereo music
  (128 kbps). 175 files, 3.57 MB. Loops carry 0.1 s of their own tail and
  head as padding, and the engine loops between the pads (see round 2).

## Coverage (102 cues)

Gun and ammo: fire, dry click, reload tick, airburst, Rack Full.
Air/Carpet Strike: flyby, guns, napalm drop, napalm burst, burn loop.
Shrapnel. Frigates: arrive (horn), fire, leave. Thermobaric. Scattergun.
Boomerang: throw, spin loop, hit, catch. Flak: burst, cloud crackle.
Seekers (one volley sound). Aegis: launch, reload at MAX.
Gravity Well: open, pull loop, implode. Railgun. Tesla.
Weapon state: drop, load, expiring (2 s), done.
Threats: drone, missile and ballistic launches, ballistic whistle, impact
splash, cluster split, mothership, mini-drone, supersonic lock, aircraft
warning, strafer and bomber engines, strafer guns, bomber drop. Subs:
surface, fire, dive, destroyed. Trucks: raise, fire, destroyed. First-sight
sting. Kills: small, missile, big.
Hulls: ship hit, ship sunk, ship delivered, carrier hit, carrier critical,
last ship, glance (Armor Plating), repair (Damage Control), Point Defense.
Power-ups: drop, expire, Overdrive on/off, Time Warp on/off, Shield
on/block/off, Full Steam on/off, Repair.
Flow: wave start (ship's bell), raid warning (siren; later raids a ping),
wave cleared, map cleared, run lost, notices.
UI: tap, back, toggle, draft dealt, card pick, swap, MAX, Armory tab and
equip, card won (staggered with the deal), new card. Music: menu, battle,
battle intense, result.

Tests (`tests/v3/audio.test.ts`):
- Every cue has a manifest entry, and every cue is emitted somewhere.
- Every game event, threat kind, pickup kind and weapon maps to its sound.
- Each of the 12 weapons, loaded from its pickup and fired at drones through
  real taps, makes its signature cues.

## The iterations

Each had one focus, an automated measure, and recorded findings.

### 1. Plumbing

The cue stream, the manifest, the engine, settings, and a first full set of
sounds (102 cues, 176 files) with tests.

- **Network:** every sample host refused (above); npm and PyPI open.
  Chromium decodes AAC `.m4a` and trims the encoder's priming (first sample
  at 0.05 ms), so `.m4a` works and keeps timing.
- **Found:** cues pushed by a tap would be cleared by the next step before
  the UI heard them. So the UI drains before and after every step and after
  every tap.
- **Found:** the first QA run failed 169 of 175 files. That was a bug in the
  QA tool itself: ffmpeg's per-frame loudness log needs `-v verbose`. After
  the fix, 50 files really failed.
- **Found:** DC offset of 0.7–1.3 % from synthesized brown noise. Prep now
  applies a 20 Hz high-pass (circular for loops).

### 2. The core loop and asset QA (50 → 0 failing)

- **Loop seams.** AAC smears a file's edges, and ffmpeg also keeps ~260
  samples of encoder padding that browsers trim. Loops now ship with 0.1 s of
  their own tail and head, and the engine loops between `loopStart` and
  `loopEnd`. The `well.pull` seam went from 13.6× the largest normal sample
  step to under 1×.
- **Metal was clicks.** `ring()` used narrow resonators, which at Q 12–60
  ring for only 4–20 ms. So the dry click, reload, blade catch, ship-hit
  metal and glance were 0.07–0.09 s clicks. Rewritten as modal synthesis
  (decaying partials).
- **The leveller crushed clicks.** Level → limit → make up → repeat drove one
  click to +56 dB of gain and 50 dB of limiting, a square wave. Limiting is
  now capped at 6 dB, and QA flags anything that then misses its level. The
  fix for those is a fuller source: drone launch, napalm drop, bomber drop,
  Aegis reload and flak cloud got more body.
- **AAC overshoot.** Encoding raised some peaks to −0.3 dBTP. Prep now
  measures the encoded file and re-encodes with a lower ceiling until it is
  ≤ −1.2 dBTP.
- **Short sounds read quiet.** BS.1770's 400 ms window under-reads a 100 ms
  click by ~6 dB. Both prep and QA add the ear's temporal-integration term
  `10·log10(0.4 / event duration)`.
- **Small explosions** had 1.45 s tails, which smear a swarm going down.
  Cut to 0.9 s (hits ≤ 1 s).
- **Aircraft** cross the screen in 6–10 s, so a fixed-length pass sample
  can't follow them. Strafer and bomber engines are now loops that pan with
  the plane.

### 3. The 12 weapons: distinct identities

- **The viewer lied.** ffmpeg's log-frequency spectrogram paints a bright
  false band near 450 Hz on any broadband sound; its own brown noise shows
  it. Replaced with our own STFT pictures (labelled axes, fixed dB range).
- **Fingerprints** (`fingerprints.md`, 1/3-octave spectra) found look-alikes.
  Seekers ≈ Aegis (2.5 dB apart), Flak ≈ the missile kill explosion (1.7),
  the player's Air Strike jet ≈ the enemy strafer (1.2), and Scattergun
  looked like the frigate's gun. Thermobaric was a flat 2.5 s roar with no
  punch, and Gravity Well read as a muffled explosion.
- **Redesigned:**
  - Scattergun: crack, pellet whizzes and barrel ring; 93 % of its energy
    above 2.5 kHz.
  - Thermobaric: a big punch, then a falling rumble.
  - Flak: crack-whump, then a splinter crackle.
  - Seekers: a volley of 4–5 rising "fwips".
  - Aegis: a hatch thunk and a lower whoosh.
  - Gravity Well: a falling FM "wub" around a reversed rush.
  - Enemy strafer: a harsh turbine scream. Your jet: a dark, smooth rush.
  - Boomerang: a low swish and a long metal shing.
- **After:** the closest two weapons are 4.8 dB apart (Air Strike /
  Thermobaric), from 1.2–2.5 before.

### 4. Threats and alerts, measured in the mix

Built `render.ts` (bot games mixed offline with the game's own policy) and
`mixcheck.py` (alert stem vs everything else, K-weighted).

- **Alerts were buried.** In the busy render, 16 of 19 alerts failed; the
  raid siren sat up to 9 LU *under* the rest, and the first-sight sting up to
  10 LU under. Alert volumes went up (0.7–1.0) and the ducking deepened
  (×0.35–0.5 for 0.65–1.3 s; it was ×0.75 for 0.45 s). Alert loops (the
  supersonic lock, carrier critical) now duck the effects while they sound.
  The first-sight sting got a bright top (high brass and a struck plate): its
  low brass stab sank under explosions, and would more on a phone speaker.
- **Busy got louder.** Added a density gain: past 4 effects at once, each new
  one plays at √(4/n). The loudest 3 s of a busy wave (alerts aside) is now
  +3.9 LU over a calm wave's; it was +4.4 before the density gain.
- **A measuring mistake, corrected:** a within-render "no spikes" gate is
  wrong for a game. A calm wave swings 8 LU between silence and an explosion,
  and alerts are meant to stand out. The gate now compares busy against calm.
- **Now:** every alert in all four renders is ≥ +3 LU over the rest, mostly
  +4 to +16; 40 alerts measured. No clipping (worst peak −2.9 dBFS). At most 23 voices (cap 24).
  No cue plays faster than its cooldown allows.

### 5. Music, the phone path, timing in the browser

- **Music dipped.** The battle beds dipped at every chord change, because
  each 2-bar pad faded in over 1.25 s from silence. Chords now crossfade, and
  the level at a change is +0.7 to +3.8 dB (the downbeat), not a hole.
- **Menu seam.** The menu's sea drone was wrapped onto its own start at the
  loop point, doubling it there; it now has its own crossfaded loop. Calm ↔
  intense battle music share tempo, key and length, and the new bed enters at
  the same point in the bar.
- **`e2e/v3-audio.mjs`** (now part of `npm run e2e:v3`) runs Chromium with
  the gesture-required autoplay policy, like iOS:
  - no AudioContext before the first tap; running after it;
  - all 175 files load and decode;
  - menu music, then battle music;
  - a tap's gun sound plays 1.1 ms after the pointerdown (≤ 20);
  - every sim cue plays in the frame its step ran (worst −0.7 ms, ≤ 20);
  - a hidden page suspends and resumes when visible;
  - Sound off suspends and greys out the volume slider; the setting is
    saved.
- **Timing check fixed.** Cues from taps had been logged against the step
  before them, so they looked 20.6 ms late. They're now tagged as taps;
  their latency is the tap check above.

### 6. Fatigue, and finishing

- **The siren every 5 s.** The busy mix's spectrogram showed the siren's
  arches every ~5 s. Raids come that often from wave 1, so a player heard
  ~12 sirens a minute. Now the siren is for a wave's first raid only, and
  the later raids get a short two-note sonar ping (`raid.next`). The calm
  render's overall loudness fell ~2 LU.
- **Dev Sound Board** in Settings; the sound-board WAV; final renders,
  pictures and reports.

## Checks run

- `npm test`: 927 tests, including 31 in `tests/v3/audio.test.ts`
  (coverage, files and licences, the size budget, AAC/mono/stereo, every
  weapon, timing, determinism, the mix rules).
- `npm run build`.
- `npm run e2e:v3`: 72 checks, the existing V3 smoke plus the audio checks.
- `python3 tools/v3/audio/qa.py`: 175 files, 0 failing. Leading silence
  ≤ 10 ms, true peak ≤ −1 dBTP after encoding, loudness ±2 LU of its bus
  target, duration within its class, no DC, seamless loops, ≤ 4 MB.
- `python3 tools/v3/audio/mixcheck.py`: all four renders pass.

## Limits

- **Not heard by anyone yet.** Everything above is measured. First things to
  judge by ear:
  - Whether the synthesized music is good enough to ship. It is the weakest
    part: pads, bass, drums and a horn line, no real melody.
  - Whether the explosions and guns feel weighty on a phone speaker.
  - Whether alerts are *too* prominent in a calm wave (+7 to +12 LU over the
    bed there).
  - The relative volumes, which were set by measurement. Trim them in the
    manifest.
- **Synthesized, not recorded,** because no sample host was reachable. If
  recorded sounds are wanted, allow the hosts above and swap files in (each
  is one file plus one credit).
- **Real iOS hardware isn't tested.** The iOS-like autoplay rule was tested
  in Chromium. Safari's `.m4a` gapless trimming, its behaviour on
  `loopStart`/`loopEnd`, and the ring/silent switch (the native wrapper
  should use an "ambient" audio session) still need checking on a phone.
- **The offline renderer** reproduces the engine's buses, pan, ducking,
  loops and music, but not the master safety limiter. The renders peak at
  −2.9 dBFS or lower, so it shouldn't engage.
- **The busy render starts from wave 9 in Free Play,** so it hears seven
  first-sight stings in 30 s. In a real run those are spread over the waves.
- The spectral fingerprint ignores rhythm. Seekers' volley and Boomerang's
  single swish differ in time as well as spectrum.
