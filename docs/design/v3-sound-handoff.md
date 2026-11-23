# V3 sound — handoff for the next session

The game (`/v3.html`, Straitwatch V3) is completely silent: there is no
audio code anywhere in `src/v3`. This hands off adding sound to every
mechanic, so a new session can run its own build–critique–verify
iterations.

## What the player asked for (their words)

- "Sounds should be easy to change in. So if I don't like it we can easily
  use something else."
- "I do want these sounds to be high quality but I do not want to pay for
  them." The game will be **sold on the App Store**, so every file must be
  free for commercial use.
- "I won't be able to hear the sounds for a while until I am back at my
  laptop." **Verification can't rely on the player listening.** It has to
  be automated, and it has to leave rendered audio for them to hear later.
- "I will have a new session run through iterations to make sure all
  mechanics in the game have sound and the sound is good quality and the
  timing is right."

## Success criteria (from the player's side)

1. **Coverage**: every mechanic below makes a sound: every weapon, threat,
   pickup, power-up, hull event, UI action and screen. No gaps, no doubled
   sounds.
2. **Quality**: clean, full, professional samples, not chiptune beeps
   (unless chosen on purpose for UI). Nothing clipped, nothing muddy, no
   clicks at start or end.
3. **Timing**: a sound lands on the frame its visual happens (within one
   frame at 60 fps, ~17 ms). Examples: Carpet Strike's napalm bursts when
   each canister bursts, not when it is dropped; the railgun's crack lands
   with its beam.
4. **Mix**: busy waves don't turn into noise or spike in volume. Alerts
   (supersonic lock, last ship, carrier critical) cut through. Frequent
   sounds don't fatigue: they get variants and slight pitch changes.
5. **Swappable**: a sound can be changed by editing one manifest entry or
   replacing one file.
6. **Free and legal**: every shipped file has a recorded source and a
   licence that allows commercial use.
7. **Phone-safe**: plays on iOS Safari (audio unlocked by the first tap),
   pauses in the background, a mute and volume setting, and a small total
   size (aim under ~4 MB of shipped audio).

## How the code is laid out (what matters for sound)

- `src/v3/sim/game.ts` is the **deterministic** simulation. It must stay
  deterministic: the bots, the balance sweep (`tools/v3/sweep.ts`) and play
  log replays (`src/v3/sim/playlog.ts`) depend on it. Sound must never
  change sim state.
  - `g.events: GameEvent[]` holds a few explicit events: `wave`, `debut`,
    `vector`, `shipLost`, `carrierHit`, `bigKill`, `pickup`, `newPickup`,
    `weapon` (loaded) and `dry` (empty rack click). The UI reads and clears
    them in `app.ts` (`for (const ev of g.events)`, around the `case
    'wave':` switch). Headless bots never clear them.
  - `g.fx: Fx[]` holds visual effects (`boom`, `burst`, `launch`,
    `tracer`, `beam`, `arc`, `emp`, `frag`, `thermo`, `flak`, `splash`,
    `sink`, `spout`, `spray`, `block`, `text`). **These are ambiguous for
    sound**: `launch` is the gun, a frigate, Point Defense and Aegis alike,
    and `boom` is a kill, a napalm burst and a destroyed truck alike. Don't
    key sounds off fx kinds.
- `src/v3/ui/app.ts` holds screens, events, the draft, the Armory, Free
  Play and settings (`showSettings`). `src/v3/ui/render.ts` is the canvas.
- Tests: `npm test` (vitest, V3 suite in `tests/v3/v3.test.ts`).
  `npm run e2e:v3` (Playwright against `npx vite preview --port 4173`;
  Chromium is preinstalled, see the env notes).
- Docs pattern: each round writes `docs/design/v3-playtest-roundN.md` with
  criteria, cycles, findings, fixes, checks and limitations. Follow it
  (e.g. `v3-sound-round1.md`).
- `ffmpeg` and `ffprobe` are installed in the container.

## Recommended architecture

1. **The sim emits sound cues; the UI plays them.** Add
   `g.cues: Cue[]` with `{ id: CueId; x: number; y: number }` (optionally a
   level or a gain), pushed at the exact sim moment a sound belongs to. The
   sim clears the list at the start of each `step()` (bots and sweeps must
   not grow it), and the UI drains it after each step. Cues never read or
   change other state, so determinism holds. Because play logs replay
   exactly, a log can also be **rendered to audio offline**: that's how
   timing and mix get verified without ears.
2. **One manifest, the only place a sound is chosen**:
   `src/v3/audio/manifest.ts`, with
   `SOUNDS: Record<CueId, { files: string[]; bus: 'sfx' | 'ui' | 'alert' | 'music'; volume: number; pitch?: [number, number]; cooldownMs?: number; maxVoices?: number }>`.
   A `Record` over the `CueId` union makes a missing sound a compile error.
   Several files per cue are played round-robin, for variety.
3. **Engine**: `src/v3/audio/engine.ts` on the Web Audio API.
   - Decode lazily, and unlock the `AudioContext` on the first
     `pointerdown` (iOS).
   - Buses with gains: sfx, ui, alert, music.
   - Stereo pan from x across the view.
   - Per-cue cooldowns and voice caps, and a global voice cap.
   - Alerts briefly duck sfx.
   - Music per screen (menu, battle, result), with a crossfade.
   - Suspend on `visibilitychange`; volume and mute in Settings, saved.
   - Optional: pitch sfx down while Time Warp is on.
   - Expose a debug log on `window.__v3.audio` (cue, time, voice count)
     for tests.
4. **Files**: shipped audio in `public/v3/audio/` as AAC `.m4a` (safe on
   iOS; add `.mp3` only if needed), mono for sfx. Unprocessed sources live
   outside the shipped folder (e.g. `assets-src/audio/`, or git-ignored
   with a fetch script if large). Keep a `public/v3/audio/CREDITS.json`:
   file, source URL, author, licence, any changes made.
5. **A dev Sound Board** (behind dev mode): every cue with a play button,
   its file and its licence, so the player can audition everything in one
   place when back at a laptop.

## The cue list (coverage target)

Emit each at the named function in `game.ts` unless noted. Suggested ids;
group them however reads best.

**Gun and ammo**
- `gun.fire`: `fireAt` (plain shot).
- `gun.dry`: the `dry` event.
- `gun.reload`: a round back in the rack (`reload`; a soft click, rate
  limited).
- `gun.burst`: interceptor burst in `updateInterceptors`.
- `rack.full`: Rack Full pickup.

**Weapons** (12; each needs a distinct identity; fire and impact where
they differ):
- Air Strike: `jet.flyby` (`callJet`) and `jet.guns` (hits in
  `updateAllies`).
- Carpet Strike adds `napalm.drop`, `napalm.burst` (`updateBombs`) and a
  quiet `burn.loop` while burn fields exist.
- Shrapnel: `shrapnel.burst` (`burstWeapon`).
- Frigates: `frigate.arrive`, `frigate.fire` (`updateEscorts`) and
  `frigate.leave`.
- Thermobaric: `thermo.burst`, big and deep.
- Scattergun: `scatter.blast` (`fireScatter`).
- Boomerang: `blade.throw`, a `blade.spin` loop, `blade.catch` (back home)
  and `blade.hit`.
- Flak: `flak.burst` and a short `flak.cloud` crackle.
- Seekers: `seeker.launch`, one per volley, not one per seeker.
- Aegis: `aegis.launch`, with `aegis.reload` at MAX (`updateAegis`).
- Gravity Well: `well.open`, a `well.pull` loop and `well.implode`.
- Railgun: `rail.charge` (optional) and `rail.beam`.
- Tesla: `tesla.arc` (zaps).

**Weapon state**
- `weapon.drop`: a weapon pickup appears.
- `weapon.load`: tapped, and the gun is loaded.
- `weapon.expiring`: the last 2 s.
- `weapon.done`: the "… DONE" text in `updateTimers`.

**Threats**
- Launches by kind: `drone.launch`, `missile.launch` (guided and heavy),
  `ballistic.launch` and `ballistic.whistle` (incoming), `cluster.split`,
  `mothership.spawn`. (`launch()`; children in their spawners.)
- Warnings: `supersonic.lock` (a beeping alert while it arms) and
  `aircraft.warn` (plane arrow; `PLANE.warn` in the step loop).
- Kills: `kill.small` (drones and bomblets), `kill.missile`, and
  `kill.big` (the `bigKill` event).
- Aircraft: `strafer.pass`, `bomber.pass` and `bomber.drop`.
- Raiders (`updateRaider`): `sub.surface`, `sub.fire`, `sub.dive`,
  `truck.raise`, `truck.fire`, and `truck.destroyed` / `sub.destroyed`
  (`knockOut`).
- `debut.sting`: a threat seen for the first time (`debut` / `vector`
  event).

**Hulls**
- `ship.hit` (`damageShip`) and `ship.sunk` (`shipLost`).
- `carrier.hit` (`carrierHit`) and `carrier.critical`, an alert loop while
  the danger state is on.
- `last.ship`: the alert for one loss left.
- `glance`: Armor Plating.
- `repair`: Damage Control `+1`.
- `pd.fire`: Point Defense.

**Power-ups**
- `powerup.drop` and `powerup.expire` (unused, gone).
- On collect: `overdrive.on` (+ `overdrive.off`), `timewarp.on` / `off`,
  `shield.on`, `shield.block` (each blocked hit) and `shield.off`,
  `steam.on`, and `repair.pickup`.

**Waves and flow**
- `wave.start`, `wave.cleared` (stamp), `map.cleared` (win fanfare) and
  `run.lost` (`CARRIER DOWN` / `CONVOY LOST`).
- `raid.warning`: the raid warning banner.
- `notice`: tray cards (`alerts.ts`), soft.

**UI** (app.ts)
- `ui.tap` (buttons), `ui.back` and `ui.toggle` (settings, Free Play).
- Draft: `draft.open` (cards dealt), `card.hover` (optional),
  `card.pick`, `card.swap` and `card.max` (the pick takes a weapon to
  MAX).
- Armory: `armory.equip`, `armory.tab`, `card.won` (the result screen's
  card reveal, one per card, staggered with the deal) and `card.new`.
- `menu.music`, `battle.music` (calm, then intense from wave ~6, or by
  threat count) and `result.music`. Music must loop seamlessly.

Write the cue ids as a TypeScript union so the manifest's `Record` catches
any missing one. Keep a test that maps each `GameEvent` kind, weapon id,
threat kind and pickup kind to its cue(s).

## Sourcing: free, high quality, safe to sell

Licences that are fine: **CC0** (best: no attribution), and royalty-free
licences that allow commercial use in games without per-copy fees. Not
fine: CC-BY-NC (non-commercial), "personal use only", unknown licences,
and rips from games, films or YouTube. CC-BY (attribution) is usable if
it's credited in-game, but prefer CC0.

Good sources, in order:

1. **Kenney.nl** audio packs, all CC0: Impact Sounds, Sci-Fi Sounds,
   Interface Sounds, UI Audio, Digital Audio, Music Jingles. Dependable
   and consistent.
2. **Sonniss "GameAudioGDC" bundles**: large, professional, free
   royalty-free libraries allowed in commercial games without attribution.
   Check the licence PDF in the download. They are very big, so pick
   files and don't commit the bundle.
3. **OpenGameArt.org**, filtered to CC0.
4. **Pixabay sound effects and music** (Pixabay Content License: free for
   commercial use, no attribution; shipping inside a game is fine,
   redistributing the bare files isn't).
5. **Freesound.org**, CC0 only. Full-quality downloads need an account,
   so the session may only reach the low-quality previews. Don't ship
   previews.
6. **Procedural, as a fallback and for UI blips and alerts**: ZzFX (MIT,
   tiny) or synthesis rendered offline with Web Audio and baked to files.
   Always licence-safe. Layering a synthesized transient with a sampled
   body can sound very good.

**Network first**: the container's outbound access depends on the
environment's network policy. Try a download from each host early. If one
is blocked, read the environment docs (`read_documentation`, topic
`environment.network`) and tell the player which hosts to allow; carry on
with the hosts that work, or with procedural sounds, meanwhile.

**Processing** (a script, e.g. `tools/v3/audio-prep.mjs` driving
ffmpeg, so any file can be redone in one command):
- trim the leading silence to under 5–10 ms (timing!), with a short fade
  in and out to avoid clicks;
- convert to mono for sfx, at 44.1 or 48 kHz;
- normalise loudness per bus (ffmpeg `loudnorm`; suggested starting
  targets: sfx −18 LUFS, ui −20, alert −14, music −20 integrated, true
  peak ≤ −1 dBTP), then trim volume in the manifest by ear later;
- encode to AAC (`.m4a`, ~96–128 kbps; music can go lower if it's
  stereo).

## Verifying without ears (the gates for every iteration)

1. **Coverage**: compile-time (the `Record`), plus a test that every
   manifest file exists, decodes (ffprobe), and has a `CREDITS.json` entry
   with an allowed licence.
2. **Asset QA** (ffprobe and ffmpeg `ebur128` / `astats`):
   - leading silence ≤ 10 ms;
   - true peak ≤ −1 dBTP;
   - loudness within ±2 LU of the bus target;
   - duration in bounds for its class (UI ≤ 0.3 s, hits ≤ 1 s, alert
     loops seamless);
   - no DC offset;
   - total size budget.
3. **Timing**:
   - unit tests that the sim pushes each cue on the right step (the napalm
     burst cue on the burst step, the rail cue with the beam fx, the kill
     cue with the threat's death);
   - in the browser (e2e), after a real tap unlocks audio, the engine log
     shows each scripted cue playing within ~20 ms of its step, and the
     `AudioContext` is `running`.
4. **Mix under load**: replay a busy run with the deterministic replay,
   e.g. Harbor Mouth wave 9–10 with Battle Group, Fragstorm and Carpet
   Strike, via the watch bot or a saved log. Render the cue stream
   offline: `OfflineAudioContext` in Playwright, or an ffmpeg `adelay` /
   `amix` graph built from the cue timeline. Then assert:
   - no clipping;
   - voices ≤ cap;
   - each cue's plays per second ≤ its cooldown allows;
   - alerts' short-term loudness ≥ the bed + 3 LU.
5. **Things the player can listen to later** (put them somewhere the app
   can open, and say where):
   - `sound-board.wav`: every cue in turn, a gap between each, announced
     by order in a text list;
   - 3–4 rendered 30 s gameplay mixes: a calm wave 1, a busy late wave,
     a win, a loss;
   - waveform and spectrogram PNGs per cue (`showwavespic`,
     `showspectrumpic`). The critique session reads these: an explosion
     should have low-end body, UI blips should be short and bright, two
     weapons shouldn't look the same, and there should be no hard
     clipping flat-tops.
6. **Critique rubric per cue** (write findings down like the playtest
   rounds):
   - it fits the size and energy of its visual;
   - no two weapons sound alike;
   - frequent cues have variants and pitch changes so they don't fatigue;
   - it lands on its frame;
   - it doesn't bury alerts;
   - its licence is recorded.

## Suggested iterations (each with its own focus and recorded findings)

1. **Plumbing**: the cue stream in the sim, the manifest, the engine and
   settings. Every cue first gets a procedural placeholder, so the
   coverage and timing gates are green before any sourcing.
2. **Core loop**: the gun, bursts, kills, ship and carrier hits and sinks,
   the dry click, and UI clicks, with real sourced assets. Asset QA.
3. **The 12 weapons**: distinct identities, compared on spectrograms;
   napalm, frigates, blades and the well loop.
4. **Threats and alerts**: launches, the ballistic whistle, the
   supersonic lock, aircraft and raiders; alert priority and ducking.
5. **Music, and the mix under load**: the offline renders, voice caps,
   cooldowns and fatigue. iOS: the first-tap unlock, pausing in the
   background, and mute.
6. **More rounds as needed.** Finish with a summary of what improved, what
   was verified, and the limits (e.g. "not yet heard by the player").

## Gotchas

- iOS Safari only starts audio from a user gesture: resume the context on
  the first `pointerdown`. Later, the native wrapper (Capacitor) should set
  an "ambient" audio session so the mute switch is respected.
- Speeds: dev 3× and watch speed run the sim faster. Cooldowns are real
  time, so busy fast-forwards must not machine-gun.
- Keep sound out of the sim's state and out of the RNG streams, or replays
  and the balance sweep will change.
- Don't commit huge source libraries. Commit the processed shipped files
  and the credits; keep sources small or fetchable by script.
- Repo rules: work on a branch off `claude/mobile-game-predator-prey-tu1t5k`,
  open a PR to it, and run `npm test` and `npm run e2e:v3` before pushing.
  Commits and PRs end with the session's attribution lines; no model names
  in commits or PRs.
