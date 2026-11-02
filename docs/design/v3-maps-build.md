# V3 maps: building the 20 approved maps

Follows the plan ([v3-maps-plan.md](v3-maps-plan.md)) and the player's review
of it (saved on the plan's review page): 17 maps approved as drawn, three
changed, every open question answered with the recommended option.

## What the review changed

- **Order**: the Gauntlet moves to slot 4 and the Island to slot 6, so the
  two island maps (Lee of Marrow and the Island) are not back to back.
- **Lee of Marrow**: "make it like a radar tower on the island and the enemy
  can attack that too. If it is lost it is lost and it should look like a
  sweep or something in that lane for the protection of the friend ships."
  The island now carries a radar tower (4 hits). While it stands, its sweep
  turns over the lane and every threat inside is tracked: a lock box, and
  interceptors fly 1.5× faster at it. Some enemy missiles aim at the tower.
  Once destroyed it is gone for the rest of the run.
- **The Sharra Delta**: "the paths look a little off and the aircraft carrier
  shouldn't just be sitting in a pond." The carrier anchors in a broad middle
  channel beside the lane, and the branches run smoother up a wide estuary.
- **Answers**: free trial = the Strait + the Kesh Hook; a 6 s lock wait;
  set-piece chapter enders (only the Dreadnought and the Citadel are bosses
  with health bars); the Delta's fork is yours to switch; at night threats
  keep a faint glow; a destroyed rig stays down; the tanker counts as three
  ships; Column formation skips the Needle's queue; the made-up names stand.

## The order

| Chapter | Maps |
|---|---|
| 1 · Home Waters | 1 The Strait (free) · 2 The Kesh Hook (free) · 3 Lee of Marrow · 4 The Gauntlet · 5 Harbor Mouth |
| 2 · The Narrows | 6 The Island · 7 The Behemoth Run · 8 The Needle of Bosk · 9 The Archipelago · 10 Saltgate Canal |
| 3 · Dark Water | 11 Battery Point · 12 Sowers' Reach · 13 The Rig Field · 14 The Black Strait · 15 Dreadnought Pass |
| 4 · Open War | 16 Smugglers' Coves · 17 The Sharra Delta · 18 Dunmar Crossing · 19 Tidewater Flats · 20 Citadel of Vey |

The menu shows one chapter at a time (a tab per chapter, five map cards),
so it still fits a 667×375 phone. A save from before the new order keeps
every map it had unlocked (`open`), and its count of unlocked maps runs up the
new order as far as the maps it has already cleared go (`save.ts`,
`MAPS_VERSION` 2).

## How it is built

### Map data

- `src/v3/data/mapTypes.ts`: the map's shape. Everything the plan added is
  optional, so the original five set none of it: path lanes, lock gates, posts,
  the boss, the fork, the tide, night, the shield, mine drift, escort stations
  and words on the map.
- `src/v3/data/geo.ts`: geometry helpers. The original five maps' helpers
  moved here unchanged, so their geometry is byte for byte V2's (a test checks
  it). The new ones are smooth curves, arcs, offsets along a path and
  resampling.
- `src/v3/data/maps.ts`: the original five, `MAP_ORDER` (20), `CHAPTERS`,
  `OLD_ORDER`. `src/v3/data/maps20.ts`: the fifteen new maps, laid out as in
  the plan's diagrams.

### Path lanes (`src/v3/sim/lanes.ts`)

A ship sits at a distance `d` along its lane and an offset `lat` across it.
Positive is to the right of the way it sails, so heading east it is south.
Its x, y and heading are worked out from those every step. A lane without a
`path` runs straight along its y from x = −40 to 1640, so d = x + 40 and
lat = y − lane y: the old channels exactly. Spacing ("a hull eases off when
the one ahead in its lane is too close"), formation changes, spawning, what
the enemy may aim at, ballistic lead and supersonic lead are all measured
along and across each hull's own heading. That one rule set covers the Hook's
90° turn, the Crossing's westbound lane and the Delta's fork.

Half-widths can follow `[x, halfWidth]` stops, and may drop below LANE_FLOOR.
Where the lane ahead is narrower than that, every hull steers for the centre
line and the spacing rule makes them queue in single file (the Needle).

### The systems

| System | Where | How it works |
|---|---|---|
| Enemy structures | `game.ts` (`raiseStructures`, `structureDown`) | Rigs, shield generators and the Citadel are threats of their own kinds with hit points, standing on their bases from the start. They never strike, never block the end of a wave and survive between waves. A downed rig or Citadel launches no more: half of its launches move to a standing launcher, half are lost. The Citadel takes no damage while any generator stands. |
| The Dreadnought | `launchBoss`, `updateBoss` | On waves 3, 6, 9 and 10 it steams right to left along its path, firing a broadside (two ballistics and a guided) every 9 s. It has 50 hits. The wave waits for it to sink or leave. |
| Allied posts | `PostState`, `damagePost`, `updatePosts`, `tracked` | The radar (Lee of Marrow) and two shore batteries (Battery Point). 22% of guided, heavy, ballistic and supersonic launches aim at a standing post. The radar at 0 hits is lost for good. A battery is knocked out for 12 s, then comes back at full strength, firing on its own every 1.3 s in reach. |
| Mines | `updateMine`, `mineEta` | Launched from mine chutes, a mine drifts with the map's current and a wobble. It does 3 damage to the first hull it touches. One shot clears it. |
| Fast boats | `STEER.fastboat` | Out of the coves: steers at a ship like a fast drone, takes two hits and rams for 2. Drawn with a white wake. |
| Locks | `updateLocks`, `stopAt`, `lockCountdown` | The entry gate stays open 8 s, and closes only once no hull straddles it. The chamber fills for the lock's wait (6 s). The exit then opens 6 s and stays open until the chamber is empty. Hulls stop short of a shut gate. |
| The supertanker | `spawnTanker`, `tankerHome` | One a wave in the tanker lane at 0.6× speed, with 8 hits. 30% of heavies and guided launches go for it. Lost, it counts as three ships. Home, every hull gets a point back and a weapon you hold drops. |
| The fork | `throwSwitch` | A tap on the buoy (with no threat nearer) sends the next ships down the next branch. |
| The tide | `highTide` | The flats lane takes ships only at high tide (25 s high, 20 s low); hulls already on it finish. |
| Night | `ui/features.ts` (`drawNight`, `lit`) | Rendering only. Darkness, cut by the lighthouse beam, the carrier's lamp, launch flashes and a Star Shell (a new pickup, night maps only, 6 s of light). Threats in the dark keep a faint glow and ballistic landing circles always show. |

### On screen (`src/v3/ui/features.ts`, `render.ts`)

- Lanes are drawn along their paths, and ships turn with them.
- Rigs, generators, the Citadel and its shield, and the Dreadnought each have
  a health bar.
- The radar's turning sweep and lock boxes; batteries with their reach rings,
  wrecks and "BACK IN n" countdowns.
- Mines blink; boats leave a wake. Coves and mine chutes are drawn on the
  shore.
- Lock gates show red and green lights, the chamber's water rising, and a
  countdown.
- The Delta's buoy, with an arrow down the branch it is set to.
- The tide gauge, and the flats drying at low water.
- Each map's one idea is announced as it starts (`MAP_HINT` in `app.ts`),
  along with tray cards for the tanker, the radar, the batteries and the
  Dreadnought.

### Bots

`worthShooting` (game.ts) is what a sensible player bothers with: anything
that strikes; a structure only when nothing else is up and the rack is all
but full, or a Railgun is loaded. Never the Citadel while it is shielded.
Both the sweep bot and the player-fitted persona use it. Missiles at the
tanker come first for the sweep bot. Both throw the Delta's switch toward a
branch with clearly fewer threats on it (`quieterBranch`).

The bots see in the dark, so the Black Strait measures easier for them than
it will play.

## Tuning

Each map has its own threat scale (`threatScale`), set for its slot so that
tries rise through the game as the plan asks. The targets are about 1 try on
maps 1–2, 1.6 on 3–5, 2.1 on 6–10, 2.7 on 11–15 and 3.4 on 16–20, never more
than about 5 (`tools/v3/maps-plan/targets.ts`).

**Who measures.** The sweep's reaction-time bots are far stronger than a
person: the average bot cleared the Island 90% of the time against the
player's 0 of 7. The tuning instead uses the persona fitted to the player's
own playtests (`sim/mimic.ts`, "you"), which is much closer to a real player.

**How.** It ran in passes:

1. Clear rate by threat scale for each map (`calibrate.ts`, 12–24 seeds a
   point), at the Armory a player has when they reach that map, alternating
   two loadouts real campaigns brought.
2. The whole 20-map campaign (`campaign.ts --you`), eight campaigns in
   parallel, to check tries per map and the total hours.
3. Then adjust and repeat.

Campaign tries per map are noisy: a map's tries can swing by a whole try or
more between runs of eight campaigns. Where the two measures disagreed, the
clear-rate scans won.

**Fixes the tuning found** (not scale changes):

- **The Behemoth Run was unwinnable.** A heavy's direct hit sank the tanker
  outright, costing three ships at once. It now takes 4 from a heavy (8 hits
  in all). 30% of heavies and guided go for it, down from 50%, and the map's
  extra heavies start two waves later.
- **The Rig Field was trivial.** The persona shot every rig down early, and
  every launch those rigs carried vanished. Rigs now take 40 hits, and 75% of
  a downed rig's launches move to the shore silos.
- **Dreadnought Pass stayed hard at any scale** (heavies and broadsides).
  The battleship now has 50 hits, broadsides every 9 s, and the map's extra
  heavies start at wave 6.

**The result.** The persona's campaign, from an empty Armory, eight
campaigns, before the last small adjustment:

| Chapter | Tries per map (target) | Notes |
|---|---|---|
| 1 | 1.4, 1.2, 2.0, 2.1, 2.1 (1.1 → 1.6) | on target |
| 2 | 2.8, 3.8, 5.8, 5.0, 5.1 (2.1) | the last adjustment eases maps 7–10 |
| 3 | 4.8, 4.1, 3.9, 3.0, 2.6 (2.7) | maps 11–13 eased a little |
| 4 | 2.8, 3.0, 1.5, 3.4, 2.2 (3.4) | the Crossing and the Citadel raised |

The whole campaign took **8.7 hours on average** (8.1–9.5 h), inside the
plan's 7–9 h. A strong player will be quicker.

**Final threat scales**

| Map | Scale | Map | Scale |
|---|---|---|---|
| The Strait | 0.7 (V2: 1.15) | Battery Point | 1.8 |
| The Kesh Hook | 0.8 | Sowers' Reach | 1.45 |
| Lee of Marrow | 0.95 | The Rig Field | 1.7 |
| The Gauntlet | 0.75 (V2: 1.2) | The Black Strait | 1.45 |
| Harbor Mouth | 0.6 (V2: 1.0) | Dreadnought Pass | 0.85 |
| The Island | 1.0 (V2: 0.95) | Smugglers' Coves | 1.25 |
| The Behemoth Run | 1.15 | The Sharra Delta | 1.5 |
| The Needle of Bosk | 0.95 | Dunmar Crossing | 1.65 |
| The Archipelago | 1.1 (V2: 1.05) | Tidewater Flats | 1.4 |
| Saltgate Canal | 0.9 | Citadel of Vey | 1.25 |

**Things to know.**

- **The Armory fills up by about map 10.** Cards come one to three a run,
  and 55 levels max every card, so a player reaches the second half of the
  game with a full Armory. That is why chapters 3 and 4 run at threat scales
  up to 1.8: they are tuned against a maxed Armory. Slowing the card economy,
  for example no extra card for a first clear, would let the Armory carry
  further into the game and let late maps use lower scales. That is a
  decision for the player; it is not changed here.
- **The persona is pessimistic about map 1.** At an empty Armory it cleared
  the Strait under half the time even at 0.6, while the real player cleared
  it at V2's 1.15. The Strait is eased (0.7) but not as far as the persona
  wanted. The first real playtests should check it.
- **The Black Strait plays harder than measured.** Bots see in the dark.
- **Harbor Mouth barely responds to its scale for the persona**: it is the
  funnel and its heavies. It sits at 0.6.

## Tools (`tools/v3/maps-plan/`)

- `campaign.ts`: the 20-map campaign the plan's playtime model assumes. Maps
  in order, retries until cleared, Armory cards won after every run. It
  prints tries per map against the targets and the hours taken
  (`--you` uses the persona; `--calibrate` adds a scale scan).
- `calibrate.ts`: clear rate by threat scale for one or more maps at a given
  Armory loadout (persona or bot), and the scale nearest the slot's target.
- `smoke.ts` and `probe.ts`: one bot run per map; launches, kills and losses
  by kind on one map.
- `shots.mjs` and `contact.mjs`: in-game screenshots of every map, tiled.
- `render.ts` (with `proposed.ts`, `svg.ts`, `page.ts`, `content.ts`): the
  plan's diagrams, review page and doc.

## Tests

- `tests/v3/maps20.test.ts`: the order, the save migration, every map clear
  of its lanes and playable by a bot, path lanes (the Hook, two-way traffic,
  single file), and each system (locks, the tanker, the radar, the
  batteries, mines, boats, rigs, the shield, the Dreadnought, the fork, the
  tide, Star Shells).
- `tests/v3/v3.test.ts`: as before. The V2-maps check now covers the first
  five maps' geometry, since their difficulty is retuned for the new slots.
- `e2e/v3.mjs`: chapter tabs, and the notice tray on all 20 maps.
