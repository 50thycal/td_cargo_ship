# Straitwatch V2: round 8, faster playtesting

Since round 7 the player has played two more Island runs: lost on wave 7 and lost on wave 9. Both logs replay exactly. Their take: "overall, it's pretty challenging, so that's good", so the Island stays as it is.

They asked for two things:

- A developer-only way to playtest faster. They wanted the time cut in half, then in half again, and in half again, while it still feels like the real game and stays slow enough to spot bugs.
- Game speed steps of 1, 1.25, 1.5 and 2. "2 should be the max."

## How long a game takes

Times come from each log's start and end, and from its simulated seconds:

| Log | Map | Wall clock | Waves (sim) | Outside waves (drafts, menus, pauses) | Result |
|---|---|---|---|---|---|
| 20261027144051-41059 | Island | 4:45 | 298 s | 29 s | lost wave 7 |
| 20261026144053-51908 | Island | 8:04 | 433 s | 75 s | lost wave 9 |
| 20261026134609-25368 | Island | ~6:35 | 347 s | — | lost wave 8 |
| 20261026132848-25367 | Gauntlet | ~10:00 | 510 s | — | cleared + endless |

A full clear is about 500 s of waves (35–60 s each), plus about a minute of drafts. That is roughly 9 minutes. The player's speed changes roughly cancel out: 433 sim seconds took 410 real seconds.

Only 7–9% of wave time had an empty screen, measured by replaying both logs step by step. So skipping dead air cannot halve anything. The time has to come from the waves themselves.

## The four run lengths

Each preset adds one lever on top of the previous one:

| Preset | What changes | Loss limit | Average bot: wave time, Strait / Gauntlet / Island | Island clears (average bot, 12 seeds) |
|---|---|---|---|---|
| Full | — | 6 | 508 / 475 / 458 s | 6/12 |
| ½ | Waves are 0.4× as long, with their launches cut to match | 3 | 236 / 231 / 209 s | 6/12 |
| ¼ | Also plays only waves 2, 4, 6, 8, 10 | 2 | 136 / 132 / 118 s | 5/12 |
| ⅛ | The ¼ run at 2× | 2 | ~66 s of real time | — |

How the levers work:

- **Short waves keep the density.** Every count is cut with the duration: drones, missiles, map extras, aircraft, subs and trucks. Each type keeps at least one, so every threat type still shows up. Raids still come every 5 s.
- **0.4×, not 0.5×.** Each wave has about 6 s that doesn't shrink: the 3 s lead-in plus the last threats flying home. A 0.5× wave only got to 55% of the time.
- **The stride still deals every card.** Each wave it skips deals a card, so the build at wave 8 matches a full run's. It always ends on wave 10.
- **The loss limit shrinks too.** A shorter run gives losses less time to pile up. With the normal limit of 6, the Island average bot cleared 8/8 at ½. The cut limit keeps the clear rate where the full game has it.

Drafts are not counted in the wave times. The ¼ and ⅛ runs still have 10 picks, shown two at a time.

## The rest of dev mode

- **Turning it on.** `v2.html?dev=1` turns it on and the device remembers it. `?dev=0` or "Turn dev mode off" on the menu turns it off. Players never see any of it.
- **The menu.** Every map is open. A dashed DEV PLAYTEST strip holds the preset chips and a start-wave picker. Map blurbs are hidden so the strip fits a landscape phone.
- **In a run.** The HUD shows `DEV ½` (or whichever preset). The speed rail adds 3× and 4×. The sunk pips follow the preset's loss limit. A draft for a skipped wave is titled "Wave N skipped" and says how many cards are left to pick.
- **Retry wave N.** This button on the loss screen rebuilds the run as the lost wave began, with the same cards, ships, score and seed. It works by replaying the old log's inputs up to that point. The retry is a new log that carries those inputs and a `retryOf` link, so it replays on its own.
- **Records and logs.** Dev runs never touch best scores or unlocks. Each log has `tempo` and `dev` fields, so it replays exactly and can be left out of balance analysis. Real-game logs are unchanged, and both new Island logs still replay on this build.

## The speed slider

The steps are now 1× / 1.25× / 1.5× / 2×, starting at 1×. 0.5× and 3× are gone. Dev mode adds 3× and 4× on top.

## Checks

- Unit tests:
  - short-wave length, density and threat mix on every map;
  - stride order and the extra drafts;
  - the tempo loss limit;
  - a dev run that is lost, retried from its wave mark, and replayed exactly.
- Browser smoke test:
  - the speed slider tops out at 2×;
  - no dev strip without `?dev=1`;
  - the ⅛ preset starts a 2× wave 2 with one card drafted;
  - the dev strip fits on screen at 844×390;
  - Retry restores wave 2 with no losses;
  - `?dev=0` turns it off.
