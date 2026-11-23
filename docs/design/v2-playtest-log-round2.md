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

### Cycle 3 — Three-slot loadout (P3)

**Rules built.** A loadout holds at most three different cards. Each draft
deals three cards; each draw favours a card you already hold (37%), otherwise
any unmaxed card. A new card shows as **SLOTS FULL** (dimmed, not tappable)
once three are held. If nothing dealt can be taken, **Resupply** (repair every
ship and the carrier, refill the racks; takes no slot) is added, so a draft is
never a dead end. Shore Battery and Auto-Retarget gained a second level so no
card is a one-level dead end in a slot. The draft shows the loadout as three
slot chips, each card's badge (NEW / LEVEL UP / SLOTS FULL / NO CARD FITS) and
the rule in one line.

**Checks run.** Draft strategies compared over 48 seeds per arm (random picks,
Hold-first, an ammo build, an area build, a speed/twin/retarget build), for the
casual bot and a new "spammer" bot that taps like an excited person (no waiting
for a loaded round, no check for an already-covered target). New tests: a full
loadout can't take a new card but can level its own; Resupply appears and
repairs/refills; over 300 drafts a full loadout gets an upgrade in 55–80% of
them. Chromium at 874×402 with the iPhone 16 Pro safe-area insets: an empty
loadout draft, a full one (tapping a SLOTS FULL card did nothing), and a
Resupply-only one.

**Problems found.**
1. **Two builds were traps.** First pass (casual bot, Strait / Island): Hold-first
   63% / 38%, speed-twin-retarget 56% / 33%, but ammo 17% / 6% and area
   19% / 2%. Under a three-slot cap a weak card costs a whole slot.
2. **Carrier CIWS barely reached the convoy**: 155–245 units of range from a
   carrier whose nearest lane is ~185–285 away.
3. **A full loadout drew a dead draft too often**: ~2.5 Resupplies per run
   (about 40% of late drafts).
4. **Skipping ahead (`?wave=N`) picked `offer[0]` even when it was SLOTS FULL**,
   so the pick silently failed.
5. Locked cards were drawn at 45% opacity, so the battlefield showed through
   them; "VS DRONE SWARMS" wrapped on narrow cards and threw the titles out of
   line (screenshot).

**Changes.** CIWS range 260 / 340 / 420 with faster fire; Wide Warhead doubles,
triples, quadruples the blast; Chain 55 / 85; Bigger Rack +3 per level; Quick
Reload 25 / 40 / 55% less time. Draft draws favour owned cards. Skip-ahead
takes the first card it may. Locked cards solid with dimmed ink; one-line
labels.

**Retest.** Builds after the changes (Strait / Island):

| Build | Casual bot | Spammer bot |
|---|---|---|
| Random picks | 65% / 31% | 56% / 44% |
| Hold-first | 88% / 52% | 65% / 44% |
| Ammo (rack, reload, battery) | 19% / 6% | 33% / 13% |
| Area (blast, chain, CIWS) | 69% / 46% | 69% / 38% |
| Speed, twin, retarget | 88% / 50% | 77% / 60% |

No single plan dominates and random picks are viable. Resupplies fell to
0.7–1.9 per run. The all-ammo build stays weakest for both styles: ammo mostly
feeds wasted shots, so rack, reload and battery are support cards in a mixed
build rather than a build of their own — a known limit, not forced.
Screenshots: three slot chips, LEVEL UP / SLOTS FULL / NO CARD FITS badges,
locked cards solid, titles aligned; Resupply repaired the carrier to 12.

Full sweep with the cap (24 seeds): casual bot Strait 71% clear, 4.0 ships lost
(the target for a run like the user's); Gauntlet 38%; Island 8%. Spammer
79% / 75% / 38%.

### Cycle 4 — New threat types (P4)

**Built.** Four threats, each with its own telegraph and counter, introduced by
map so the Strait still teaches the basics:

| Threat | Behaviour | Telegraph | Answered by | Where |
|---|---|---|---|---|
| Supersonic missile (user's idea) | ~1 s on the rail, then 430 u/s, 2 damage | its base glows and a flashing red lock line marks the target while it arms | Faster Interceptors; Hold to Fire on the line | Gauntlet w7+, Island w4+ |
| Heavy cruise missile (user's idea) | 55 u/s, 4 hits, 6 damage + 1 splash | large body, HP bar | Twin Launch, Hold to Fire | Gauntlet w5+, Island w5+ |
| Cluster missile | splits into 4 bomblets 200 u from its target | pulsing yellow ring | hit it early; Wide Warhead / Chain for bomblets | Island w7+ |
| Drone mothership | drifts at the carrier, a mini-drone every 2.6 s, 5 hits | large green delta, HP bar | kill the source; CIWS near the carrier | new maps (cycle 5) |

Bomblets and mini-drones are blamed on their parent, so the loss screen's
advice names the cluster or the mothership. Each has a debut hint and a
loss-screen line. Five new tests (arming delay, heavy hits and splash, cluster
split and blame, mothership spawning, map extras on schedule).

**Checks run.** Per-threat telemetry over 24 seeds on the Gauntlet and Island
(launched per run, median warning time, ships sunk, share shot down) for the
casual and spammer bots; full sweeps after each change; Chromium screenshots at
874×402 of a supersonic arming, a heavy, a cluster, a split, and a mothership.

**Problems found.**
1. **The new threats made maps 2–3 unwinnable**: casual 0% / 0%, spammer
   21% / 4%. Heavies sank ~1.7–2.0 ships a run on the Gauntlet (splash 2 wrecked
   neighbours); supersonics sank about one ship per three launched there and 2
   a run on the Island (3 damage one-shot a healthy ship); and the extras
   stacked on the threat scales raised in cycle 2.
2. Heavies were still the Gauntlet's top killer after a first pass: bots (and
   likely people) rank a slow missile as not urgent and then can't land 5 hits
   in time.
3. The Island stayed near-unwinnable even with a lower threat scale — its close
   bases and ~9 supersonics a run were the cause.
4. Screenshots: HP pips were tiny dashes at phone size; bomblets were hard to
   see.

**Changes.** Supersonic damage 3 → 2; heavy splash 2 → 1 and HP 5 → 4; cluster
splits at 200 (was 240); slower growth for every extra; Gauntlet heavies from
wave 5; Island supersonics from wave 4; threat scales Gauntlet 1.2, Island 1.2.
Bigger outlined HP bars, larger heavy body, outlined bomblets.

**Retest (32 seeds).**

| Map | Spammer clear | Casual clear |
|---|---|---|
| Strait | 75% | 59% |
| Gauntlet | 50% (24 seeds, after the heavy change) | 21% |
| Island | 38% | 6% |

Warning times for the new threats: supersonic 2.2–2.7 s (including the lock
line), heavy ~10–12 s, cluster ~2.8 s to its split. No single new threat
dominates losses now; ballistics from close shores remain the main killer on
maps 2–3, which is those maps' character. Screenshots after the fixes: lock
line and base glow unmistakable, heavy HP bar readable, bomblets clear as they
fan out. Full suite: 762 tests pass.

### Cycle 5 — New maps (P5)

**Ideas.** Archipelago (enemy islets with gaps; motherships), Harbor Mouth (the
channel funnels into a harbour under enemy headlands, so pressure peaks right
before delivery), and three not built yet: Open Sea (no land, launch platforms
on every side), Night Crossing (threats visible only inside radar range),
Storm Front (wind drifts interceptors; weather changes per wave).

**Built.** Map 4 Harbor Mouth and map 5 The Archipelago, each with its own
extras schedule. Funnelling channels are new geometry: lanes narrow with x,
never below a floor that keeps Box formation's hulls 22+ apart; lane guides
are drawn converging.

**Checks run.** Overlaps through every formation switch at max flow on both new
maps, and steady-state along the funnel; the ballistic-ceiling test now covers
five maps; five-map sweeps over 32 seeds; per-threat telemetry on the new maps;
Chromium at 874×402 with iPhone safe areas: the menu, both maps mid-wave.

**Problems found.**
1. **Both maps were unwinnable at first**: spammer 0% Archipelago / 3% Harbor,
   casual 0% / 0%. On the Archipelago my "carrier far to the east" idea made the
   west end indefensible — island ballistics were shot down only 55% of the time
   (77–83% elsewhere) because interceptor flights were too long, and
   motherships sank 1.4 ships a run. On Harbor Mouth the heavies, clusters and
   supersonics launched beside the narrows ~800 units from the carrier
   (shot-down rates 65% / 44% / 49%).
2. After moving the carriers the order was inverted (Archipelago harder than
   Harbor Mouth).
3. With five maps the menu overflowed a landscape phone by 27 px, cutting off
   cards 4–5.
4. Two screenshot attempts caught the draft screen instead of play (harness
   timing; a draft has no Quit button, which is fine — pick a card, then pause).

**Changes.** Carriers moved toward the action (Archipelago x 1230 → 950, Harbor
620 → 900); extras start a wave or two later; threat scales 1.1 / 1.05;
the islet nearest the lanes stopped firing ballistics; map order swapped so
Harbor Mouth is map 4 and the Archipelago the finale; compact menu on short
screens.

**Retest.**

| Check | Result |
|---|---|
| Overlaps, all switches + steady funnel | 0 on both maps; Box keeps 23 u side-by-side at the exit |
| Spammer clear rate, maps 1→5 (32 seeds) | 75% → 66% → 38% → 31% → 22% (monotonic) |
| Casual clear rate | 59% → 19% → 6% → 3% → 0% |
| Menu at 874×402 | content height 325 = viewport, no scroll; map 5 locked until map 4 is cleared |
| Screenshots | Archipelago islets and lanes clear; Harbor coastlines and lane guides visibly converge toward the exit |

Casual players will mostly stall from map 3 on; later maps are for players
who have learned the threats, with upgrades, Resupply and endless runs as the
way in. The average bot's rates are not monotonic (Archipelago 94% vs Harbor
78%) — the spammer, which is closer to how the user plays, is the one tuned.

### Cycle 6 — Nothing regresses (P6)

**Checks run.**
- New test: a late Archipelago run (motherships and mini-drones confirmed in
  play) recorded through the recorder replays to identical steps, score, kills,
  losses-by-cause and wave history — children spawned mid-flight don't break
  determinism.
- `npm run e2e:v2` on a fresh build, including the iPhone 16 Pro checks (late
  resize, Dynamic Island inset): passes. V1 browser smoke test: passes.
- Frame times in Chromium at 874×402, DPR 2, Archipelago endless wave 14 with a
  defender firing: unthrottled 60 fps at full 1688×780 (p95 16.7 ms, 0% slow
  frames). At 4× CPU throttle adaptive resolution stepped to 844×390.
- Republished the artifact build (version 2, same URL, old bundle removed,
  `db` declaration carried forward); listed its files and read the `playtests`
  collection (reachable, empty — no runs yet).

**Problem investigated.** The first throttled run showed 11% slow frames
(round 1: 1–3%). Re-running twice each: Archipelago 1% and 0%, Island 6% and
4%. The 11% was run-to-run noise under software rendering and throttling, not
a regression from the new threats or maps. Nothing changed.

## Round 2 summary

| Goal | Status |
|---|---|
| P1 Playtests reach Claude | Built and verified end to end except the first real write from the user's phone (the artifact runtime can't be driven from here) |
| P2 Map 1 harder | Rack 5, 1.5 s reload, busier early waves; casual bot on the Strait 92% → ~60–70% clear, ~4 ships lost |
| P3 Three-slot loadout | Built; no single plan dominates; Resupply keeps drafts live; Hold to Fire no longer a must-pick |
| P4 New threats | Supersonic, heavy, cluster, mothership — each telegraphed and countered; lethality tuned so none dominates |
| P5 New maps | Harbor Mouth and the Archipelago; difficulty falls monotonically across five maps for the spammer bot |
| P6 No regressions | Suite, browser flows, iPhone layout, frame rate and replay determinism all hold |

**Known limits.** All balance numbers come from bots; the spammer profile is a
guess at how a person taps, to be replaced by the user's real logs. The
all-ammo build stays weak. Casual players will mostly stall from map 3. The
artifact viewer's chrome on a phone may take some screen space (untested
here).
