# Straitwatch V2 — playtest log, round 2

Follows the user's first device playtest ("a lot better"; map 1 too easy at two
ships lost; Hold to Fire the standout card) and their asks: playtest logs that
reach Claude without copy-paste, less starting ammo, a three-upgrade loadout,
more threat types and more maps.

## What success looks like (from the player's side)

| # | Goal | How it is checked |
|---|---|---|
| P1 | **Playtests reach Claude automatically.** Finish or quit a run and its log is saved and uploaded; Claude can list it, read it and replay it exactly. | Browser run → log stored → read back from the artifact database → replay matches |
| P2 | **Map 1 is a bit harder.** A run like the reported one (two ships lost) should cost more; maps still get harder in order. | Bot sweep with phone-measured miss rates; per-wave losses |
| P3 | **Three-slot loadout.** Clear on screen, real choices, never a dead-end draft, no single card an automatic pick. | Draft simulation over many runs; browser screenshots of the draft |
| P4 | **New threats** are distinct, telegraphed, fair, and each has a counter. | Per-threat warning time and loss share; screenshots |
| P5 | **New maps** are distinct, playable on a phone and sit sensibly in the difficulty order. | Sweep per map; phone screenshots |
| P6 | **Nothing regresses**: iPhone layout, 60 fps, tests, browser flows. | Full suite + browser smoke incl. iPhone checks |

## Cycles

### Cycle 1 — Playtest logs that reach Claude (P1)

**Constraint found.** The Vercel connector in this session cannot create
storage or read environment variables (403 on both), and this sandbox cannot
reach Vercel hosts directly. So a server endpoint on the Vercel project was not
possible without the user setting up storage themselves.

**Built.** Every input goes through a `Recorder` (`src/v2/sim/playlog.ts`),
stamped with the sim step it happened before; the sim gained a step counter,
per-wave history snapshots and tap-outcome counts. Because the sim is
deterministic, a log (seed + inputs) replays the exact game. Logs are kept on
the device (last 10) and, when the game runs as a Claude artifact with the
`db` capability, written to the artifact's `playtests` collection, which Claude
reads directly. The Vercel build shows "Download log" instead. A run that is
quit, closed (`pagehide`) or ended all leave a log; unsent logs retry on next
launch. `npm run v2:replay -- log.json` replays a log, confirms it lands on the
same score and losses, and prints a per-wave breakdown.

**Checks run.**
- Unit test: a scripted multi-wave game through the recorder replays to the
  identical step count, score, losses, kills, tap counts and wave history.
- Chromium at 874×402 with touch, both builds: real taps for ~25 s at 3×,
  flow and formation changed, quit via pause; then a run lost from wave 9.
  Vercel build: log kept locally, result line "Log saved on this device.",
  download offered. Artifact build (runtime stood in by an injected
  `claude.use('db')`): the log written to `playtests`, result line "Playtest
  log sent to Claude ✓". No page errors. Both logs replay: **MATCHES**.
- Published the artifact build; wrote a real log into its database, listed it
  back, replayed the read-back copy (**MATCHES**), deleted the probe.

**Problems found and fixed along the way.**
1. The replay loop could spin on an inconsistent log stuck in a draft; it now
   stops.
2. Inside the artifact viewer downloads are blocked, so a failed send no longer
   offers a dead "Download log" button; it says the log is resent next launch.
3. The "classic version" link has no target in the artifact build; hidden there.

**Not verifiable from here.** The real artifact runtime writing from the
user's phone: the stand-in proves the page's code path, and the read side was
proven with a real document, but the first genuine write happens when the user
plays.
