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

### Cycle 2 — Map 1 a bit harder; starting ammo (P2)

**Reference point.** The user lost 2 ships on map 1 and found it too easy. In
the sweep, the casual bot (1.0 s reactions, 20% phone-measured misses) lost
2.6 there and the average bot ~0, so the user plays between the two.

**Checks run.** Sweeps over 24 seeds per cell (average and casual bots, all
three maps): starting rack 6 / 5 / 4; then rack × reload × threat volume; then
busier early waves; ship losses tracked overall and by wave 3. A Hold to Fire
ablation over 48 seeds per arm, with the bot taught to use the card.

**Problems found.**
1. **Rack size alone changed nothing** for the bots (identical results at 6, 5
   and 4): they only tap when loaded, and reload — not capacity — limits them.
   People tap faster than the rack refills (cycle 1's browser run had 10
   empty-rack taps in wave 1), so rack matters more for a human than the bots
   show.
2. **Waves 1–3 cost nothing** in every configuration tried (0.0 ships by wave
   3), even with twice the early drones: a drone does 1 damage to a 3-HP ship.
   Making early waves lethal would mean reworking ship HP everywhere and turn a
   warm-up into a wall, so early waves were made busier instead and the
   difficulty raised across the map.
3. **The bots couldn't use Hold to Fire**, so the sweep was blind to the card
   the user called the best. Once modelled (repeats at the card's rate, half
   the aim misses), it was by far the strongest card: Hold L2 took the casual
   bot from 42% to 96% clears on the Strait and 4% to 56% on the Island —
   versus 81% / 33% for the next best (Faster Interceptors L2).
4. Hold to Fire repeated on wall-clock time, so at 3× speed it fired a third as
   often relative to the game. Now on game time (also keeps replays exact).
5. A new wave-4 row made wave 5 easier than wave 4 (caught by the
   wave-table test); wave 5 raised to match.

**Changes.** Starting rack 6 → 5, reload 1.4 s → 1.5 s. Waves 1–4 busier
(14 / 16 / 18 / 20 drones, ballistics from wave 2, one guided in wave 4).
Map threat scales 1.15 / 1.35 / 1.55. Hold to Fire now has two levels:
0.45 s, then 0.33 s.

**Retest (24 seeds; before the loadout cap in cycle 3).**

| Map | Casual clear (before → after) | Casual ships lost |
|---|---|---|
| Strait | 92% → 79% | 2.6 → 3.7 |
| Gauntlet | 75% → 38% | 3.2 → 5.0 |
| Island | 46% → 21% | 4.8 → 5.6 |

Hold to Fire L2 at 0.33 s: 83% Strait / 35% Island, level with Faster
Interceptors L2 (81% / 33%) — still a top card, no longer a must-pick. The
Strait→Gauntlet step is steep; final balancing waits for the loadout cap,
which cuts upgrade power everywhere.
