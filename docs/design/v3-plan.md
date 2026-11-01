# Straitwatch V3 — weapon drops and the Armory

V3 takes V2's game (cargo ships, the carrier, drones and missiles you tap to
intercept, 5 maps × 10 waves, formations, flow) and changes **only the
upgrades**, after the player's brief (inspired by Survivor.io):

- The **main gun stays as it is** inside a run: no upgrades for it in the
  draft. It gets better **before** a run, in the **Armory**, with cards
  won at the end of every run, the way gear sets your weapon in Survivor.io.
- The in-run draft deals **weapons**: new attacks that each answer a
  scenario. Three held at once, three levels each; level 3 is **MAX** (shown so since round 7: "evolved"
  read wrong to the player), where a weapon takes a new name.
- **Weapons drop as pickups** (playtest round 2; until then they charged and
  fired from buttons, which was "too much managing"). A weapon you hold drops
  from kills like the power-ups; tapping its pickup loads the main gun with
  it for **15 s**, and every tap fires it, spending a round like any shot.
- **Round 3** replaced the five weakest weapons with five built for the
  15 s swap ([v3-playtest-round3.md](v3-playtest-round3.md)); after the
  player's look, Air Strike costs 2 rounds a jet and an Aegis Dome replaced
  a laser that was too close to the Railgun. Round 4 played the new weapons
  through for UI and visuals ([v3-playtest-round4.md](v3-playtest-round4.md)).
- All of V2's passive cards are gone. **EMP and Strike Package are no longer
  power-ups** (Strike came back as the Air Strike weapon). The other pickups
  are unchanged.

V3 lives at `/v3.html` (`npm run dev:v3`), its code in `src/v3/` (a fork of
`src/v2/`), with its own save, logs (`game: 'v3'`, ids `v3-…`) and tools.
V2 is untouched at `/v2.html`.

## Kept in step with V2

V3 is V2 plus the upgrade change, so V2's later rounds are ported one to
one. V2 rounds 13–14 (merged into `src/v3` with a three-way merge from the
fork point):

- **Round 13**: a cleared wave clears the field and refills the rack (in
  V3 that also ends smoke walls, burning lines and running abilities; the
  ability charge carries over) behind a WAVE N CLEARED stamp; launchers hit
  from the air are destroyed, not chased off (Carpet Strike and Sub Hunter
  in V3); dirt roads routed round the bases, tunnels and caves, the Island
  as a hill, silo bases; the Island eased (threat ×0.95, extras two waves
  later). `LOG_VERSION` 7.
- **Round 14**: one notification tray on each map's bottom shore (at most
  two cards, queued, raids and alarms cut in); power-up timers moved to the
  foot of the left rail. In V3, ability timers (Railgun, Tesla Arc, Ion
  Storm, Ghost Fleet) live in that rail too, and ability feedback (armed,
  charging, fired) is an at-once card, as round 14 treats feedback on the
  player's own action.

`tests/v3` and `e2e/v3.mjs` carry the same checks (fresh start, strike
kills, roads clear of bases, the Island schedule, the tray on all five maps
at two phone sizes) plus one that V3's maps are V2's, byte for byte.

## Twenty maps

V3 has 20 maps in four chapters of five, built from the player-approved plan
([v3-maps-plan.md](v3-maps-plan.md)); [v3-maps-build.md](v3-maps-build.md)
says how they are built and tuned. Each map after the first five brings one
new idea: a bending lane, an allied radar, a supertanker, single file, lock
gates, shore batteries, mines, oil rigs, night, a battleship, fast boats, a
fork you switch, two-way traffic, the tide, and the Citadel. The original
five keep V2's geometry, with their difficulty retuned for their new slots.

## Survivor.io, and what V3 takes from it

Research summary (fan wikis and guides; some contradict each other):

| Survivor.io | V3 |
|---|---|
| 6 weapon + 6 passive slots, 5★ each; a maxed weapon + its paired passive **evolves** | 3 ability slots, 3 levels; level 3 **evolves** (no passives) |
| Pick 1 of 3 at every level-up; chests give extra picks | Pick 1 of 3 after every wave (Resupply when nothing fits) |
| Every attack is automatic; you only move | You don't move, so attacks are **active**: charged, then aimed |
| 15-minute chapters, bosses at 5/10/15 min; ~350 chapters + challenge modes | 10 waves ≈ 8–10 min a map; 20 maps in four chapters + endless |
| Gear (merged, upgraded with gold) sets your starting weapon and stats | The **Armory**: 11 upgrade cards in 3 bays, won at random after a run, a duplicate adding a level (round 7; 5 gun upgrades bought with salvage before) |
| 50+ hours come from the meta (gear, chapters, events), not the in-run skills | The Armory is V3's first meta layer (see "How long the game is") |

## Weapons

Playtest round 2 replaced charging and buttons with drops
([v3-playtest-round2.md](v3-playtest-round2.md)); round 3 replaced five of
the eight ([v3-playtest-round3.md](v3-playtest-round3.md)); round 6 cut Cryo
and added five, for twelve ([v3-playtest-round6.md](v3-playtest-round6.md)).
`src/v3/data/abilities.ts`
holds the roster, `WEAPON` the drop rules and `AB` every effect number.

- **Draft** a weapon to put it in the drop pool (levels to MAX as
  before, three slots, swaps when full).
- **Drops**: a kill that drops no power-up drops a weapon you hold at 0.45×
  its power-up chance; after 28 s without one, the next kill drops one. One
  weapon pickup on the water at a time; it floats 7 s (power-ups: 5).
  Power-ups drop exactly as before (sharing one roll, weapons crowded out
  repairs and Overdrives and the bot's clears halved).
- **Loaded**: the pickup loads the gun for 15 s (the same weapon again
  restarts the clock; another one takes over). Every tap fires it and spends
  a round; a dry rack is a dry click; Overdrive makes it free. A shell fired
  before the clock ran out still bursts as that weapon. The wave's end
  unloads it.

| Weapon → MAX name | Answers | A tap while loaded | L1 → L2 → **L3 (MAX)** |
|---|---|---|---|
| Flak Cannon → **Flak Curtain** | Swarms | a flak shell (at a threat, or onto open water) | a cloud of radius 95 for 1.5 s, hitting everything inside for 1 every 0.35 s → 115, 2 s → **135, 4 s** |
| Seeker Pod → **Swarm Pod** | Raids | seekers at the threats nearest the tap (within 360; none near: nothing fires), each **a third of a shot** (round 8), so they go in threes: each threat, nearest first, gets as many as bring it down | 3 seekers → 4 → **5, and a seeker whose target is gone finds another** |
| Aegis Launchers → **Bastion** | Missiles | a plain shot; while loaded, **every ship carries its own interceptors** (ships sailing in too) and fires one at a threat closing on it within reach; gone with the weapon (round 8; it was a dome) | 1 a ship, reach 240 → 2 a ship, reach 320 → **2 a ship that reload every 3 s, and the carrier fires 3 of its own** |
| Gravity Well → **Singularity** | Spread raids | a vortex shell | drones, missiles and jets within 200 dragged in at 320/s for 1.5 s, then 2 dmg to those within 100 (ballistics fly on) → 240, 3 dmg → **260, holds 2 s, 4 dmg** |
| Air Strike → **Carpet Strike** | Aircraft | a jet down the tapped row, in from the nearer edge, for **2 rounds** | 2 dmg, band 80 → 3 dmg, 95 → **4 dmg, 110; napalm canisters tumble down behind the jet and burst, each setting its stretch of the row burning 2 s (round 8) and subs and trucks under the jet are destroyed** |
| Railgun → **Mass Driver** | Heavies | a beam from the carrier through the tap | 1 dmg → 2 dmg, wider → **4 dmg, wide: two bring down a heavy** |
| Tesla Arc → **Storm Coil** | Crowds | a plain shot whose hit arcs | 3 arcs → 4 arcs, every arc arcs again → **a free second shot at the nearest uncovered threat** |
| Shrapnel Shell → **Fragstorm** | Swarms | a shell (at a threat, or onto open water) that bursts into fragments flying out in every direction | 10 fragments to 220, 1 dmg each to the first threat on their line → 14 to 270 → **18 to 300, each tearing through everything on its line** |
| Frigate Escort → **Battle Group** | Everything | a plain shot; picking it up sails two frigates in to the lane's edges, firing on their own at the nearest threat within 560 until the 15 s run out, then they sail off | 2 frigates, a shot every 0.9 s each → every 0.6 s → **3 frigates, every 0.45 s** |
| Thermobaric Shell → **Daisy Cutter** | Packs | a shell that bursts in one huge blast | 1 dmg to everything within 150 → 2 dmg, 190 → **3 dmg, 240** |
| Scattergun → **Dragon's Breath** | Rushers | a cone of pellets from the carrier toward the tap (spread 0.32 rad), 1 dmg to the first threat each | 8 pellets to 650 → 11 to 760 → **15 to 860, each tearing through everything on its line** |
| Boomerang → **Twin Blades** | Lines | a spinning blade out to the tapped threat (homing on it) or point, and back to the carrier, cutting each threat once a pass | 1 dmg, 34 wide → 2 dmg, 44 wide → **two blades a throw** |

Cut in round 3 (round 2's five weakest): EMP Rounds, Hellfire Salvo, Smoke
Shells, Decoy Flares, Sub Hunter. Cut in round 6: Cryo Rounds (the freeze
rarely mattered: the shell usually killed what it froze). Round 8 reworked
Aegis (domes → every ship's own interceptors), cut Seekers to a third of a
shot each, and gave Carpet Strike its napalm run
([v3-playtest-round8.md](v3-playtest-round8.md)).

## Screen

- **Right rail**: the HUD, pause, a one-button **speed** control, and at the
  bottom the **loadout**: one chip per weapon held (dim: it can drop), lit
  with its rim draining and the seconds under it while it is loaded. Nothing
  to press.
- **On the water**: a weapon pickup is a hexagon in the weapon's colour with
  its icon and name (bigger than a power-up); a loaded weapon rings the
  carrier in its colour, draining, blinking in the last 2 s; shells trail
  the weapon's colour; smoke, ion clouds and hanging flares are drawn where
  they burst.
- The left rail times the loaded weapon like a power-up. Loading one shows
  a one-line notice: its name, its seconds and how to fire it (what a shot
  does is on the card). Running out says so over the gun ("RAILGUN DONE").
  The first weapon drop of a run explains itself. Round 4's UI pass:
  [v3-playtest-round4.md](v3-playtest-round4.md).
- Draft cards show only what is particular to the card: what the weapon
  answers, its art, its name at the level it brings, its level pips and
  what that level does. How weapons work (they drop as pickups and load the
  gun for 15 s) is the game's rule, not repeated on every card (round 5);
  the MAX badge and the new name mark the last level. The line under the cards
  shows only when the slots are full.

## The Armory

`src/v3/data/armory.ts`. Since round 7 ("let's overhaul that armory";
[v3-playtest-round7.md](v3-playtest-round7.md)) every upgrade is a **card**,
drawn like a weapon card (bay, art, name, level pips, what it does, its
number now and next), and cards are **won at the end of a run, never
bought**: "they need to get that card at the end of the game. They don't
get to pick which ones… to get the next reload, you need to win another
reload" (Survivor.io's gear). A card won again adds a level. Salvage is gone.

- **Cards a run wins**: 1 for a run that cleared at least 3 waves (quitting
  at once wins nothing), +1 for clearing the map, +1 more the first time.
  Each is drawn at random from the upgrades not yet maxed. The result screen
  deals them in (NEW, or the level it brought).
- **Three bays, one card from each per run** (playtest round 1: "the player
  should only be allowed to select one… they don't get all of them", now
  per bay). The first card won in a bay is equipped; the Armory shows a bay
  at a time as a row of cards (tap one you hold to equip it; ones not found
  yet are greyed); **Choose your loadout** comes up when a map starts; the
  menu strip shows the cards found and the loadout.

| Bay | Upgrades (5 levels each) |
|---|---|
| **Gun** | Quick Reload, Wide Warhead, Fast Motors, Deep Magazine, Proximity Fuse |
| **Hull** | Armor Plating, Point Defense, Damage Control |
| **Supply** | Long Loads, Supply Lines, Stockpile |

| Upgrade | Per level | At level 5 |
|---|---|---|
| Quick Reload | a round loads 6% faster | 0.95 s a round (−30%) |
| Wide Warhead | blast +40% | 3× blast |
| Fast Motors | interceptors +20% faster | 2× speed |
| Deep Magazine | +1 round (levels 1, 2, 4, 5) | 10 rounds |
| Proximity Fuse | bursts closer to a fast target | 34 px fuse, hits for 2 |
| Armor Plating | 8% of hits on a ship or the carrier glance off | 40% |
| Point Defense | the carrier fires a free interceptor at the nearest threat in reach | a shot every 3.5 s, reach 280 → every 2 s, reach 360 |
| Damage Control | every damaged hull (ships and carrier) gets a point back | every 10 s → every 4 s |
| Long Loads | a weapon pickup stays in the gun 4 s longer | 35 s |
| Supply Lines | weapons drop more often | 1.4× chance, one at least every 20 s (28) |
| Stockpile | power-ups drop more often and last longer | 1.75× chance, 1.5× time |

**What each is worth alone** (round 7; average bot, fresh Armory, weapons
drafted in a random order, 60 runs across the maps, ±12 points; the base
gun clears 57% this way):

| Bay | Upgrade | Level 1 | Level 5 |
|---|---|---|---|
| Gun | Wide Warhead | — | 67% |
| Hull | Armor Plating | 57% (70% at L3) | 85% |
| Hull | Point Defense | 63% | 82% |
| Hull | Damage Control | 62% | 75% |
| Supply | Long Loads | 60% | 67% |
| Supply | Supply Lines | ~50% | 83% |
| Supply | Stockpile | 62% | 73% |

Stacked: level 2 in all three bays clears 85%, everything at level 5 98–100%.
(Round 1's gun-only table, base gun alone and all five maps, put the gun
upgrades at 67–83% at level 5.)

Each gun upgrade stops short of the line V2's round 6 audit found (an
11-round rack reloading 55% faster let mashing win). Every level of every
card is 55 cards.

**Free Play** (round 7, on the menu): any map, any start wave (wave 7 on
The Strait by default), three weapons at any level, one Armory card from
each bay at any level, and optionally frequent weapon drops (one at least
every 8 s, at twice the chance). Nothing in it counts: no records, unlocks
or cards. Its play log records the setup, so it replays exactly.

Dev mode adds a **Gun** chip on the menu: the equipped loadout, the base
gun, or the equipped loadout at its top levels; dev runs never win cards.

## Measurements

Bots (`npm run v3:sweep`), ship flow on step 3 of 5. Minutes are game time
at 1× plus ~8 s a draft and ~15 s a run for menus. These are bot numbers: a
person aims abilities worse and taps less precisely, so treat them as the
shape of the curve, not the final word — the next step is real playtests.

**How long a run is.** One map, start to clear: **~10 minutes**. A lost
run lasts 6–9. A run that clears 3 waves wins **1 Armory card**, a clear 2,
a first clear 3.

**Clear rate by Armory level** (sharp / average / casual bot; measured
after porting V2 rounds 13–14, which eased the Island):

| Map | Armory 0 (fresh) | Armory 2 (~6 runs in) | Armory 5 (maxed) |
|---|---|---|---|
| The Strait | 90 / 90 / 0 % | 100 / 100 / 38 % | 100 / 100 / 100 % |
| The Gauntlet | 50 / 20 / 0 % | 75 / 88 / 13 % | 100 / 100 / 63 % |
| The Island | 90 / 90 / 0 % | 100 / 100 / 0 % | 100 / 100 / 75 % |
| Harbor Mouth | 10 / 30 / 0 % | 88 / 75 / 0 % | 100 / 100 / 63 % |
| The Archipelago | 40 / 50 / 0 % | 75 / 75 / 0 % | 100 / 100 / 50 % |

The main gun alone (no abilities, fresh Armory) clears **0–13%**, the same
as V2 with no cards: the base gun really is unchanged, and the abilities
carry a run from the first wave while the Armory carries the progression
between runs.

**The whole game** (all five maps cleared in order, from an empty Armory,
spending salvage after every run). Measured before round 1's one-gun rule;
with one gun (investing in Deep Magazine / Wide Warhead): sharp bot 1.1 /
1.6 h, average 0.8 / 1.4 h, casual 7+ h and still stuck on map 2–3 after 60
runs (see v3-playtest-round1.md). Before:

| Player | Time | Runs | Notes |
|---|---|---|---|
| Sharp / average bot | **~1 h** | 5–6 | Armory ~2/5 by the end |
| Casual bot | **8 h+** | 60 (cap) | Armory nearly maxed; Archipelago still not cleared |
| Average bot, main gun only | 3.4 h | 25 | the Armory alone can carry a player |

For comparison, V2 took a decent player **~70 minutes** to clear all five
maps once. The Armory doesn't make the game longer for a strong player; it
makes the game finishable for a weaker one, and gives every run (won or
lost) a purpose. To make the whole game longer, the knobs are the cards a
run wins (`CARD_DROPS`) and how hard the later maps
are without Armory levels.

**Weapon tier** (round 6; average bot, fresh Armory, each weapon **alone**:
drafted first, every other weapon stripped from the build, 40 runs across
all maps, ±10 points). Round 2 measured "first pick, then anything", which
hid how strong Air Strike and Railgun were behind weak partners.

| Frigates | Seekers | Scattergun | Shrapnel | Gravity Well | Railgun | Boomerang | Thermobaric | Flak | Aegis | Air Strike | Tesla |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 75% | 65% | 50% | 45% | 43% | 40% | 38% | 35% | 35% | 28% | 20% | 20% |

With no weapons the same bot clears 0%. The bot is poor with Air Strike (it
taps threats, not rows), so its 20% undersells it; players rate it the
strongest. Drafting in a random order, the average bot clears 49% (32 seeds
a map). The clear-rate table above is the round-1 (button) measurement;
rounds 3 and 6 are in v3-playtest-round3.md and v3-playtest-round6.md.

## Where to tune

| What | File |
|---|---|
| Weapons: drop rules (`WEAPON`), effect numbers (`AB`), level text | `src/v3/data/abilities.ts` |
| Armory: per-level effects, the cards a run wins | `src/v3/data/armory.ts` |
| How bots use weapons (grab pickups; Sub Hunter goes for launchers) | `src/v3/sim/bot.ts`, `src/v3/sim/mimic.ts` |
| Everything else (threats, waves, maps, formations) | as in V2, under `src/v3/data/` |

## Testing

- `npm test` includes `tests/v3/` (the Armory and save, the draft, weapon
  drops and the 15 s clock, ammo per shot, every weapon's levels, replay,
  the curve).
- `npm run v3:sweep -- [seeds] [--armory=N] [--no-weapons] [--focus=id]`
  prints clear rates, minutes a run, cards a run, the share of wave time
  a weapon was loaded, weapon pickups taken, and the whole game from an
  empty Armory.
- `npm run e2e:v3` (with `npm run preview -- --port 4173` running): equips
  Armory cards from two bays, loads every weapon from its pickup and fires
  it through real clicks, drafts, checks the loadout and the phone layout,
  wins an Armory card at the end of a run, plays a Free Play run (which wins
  nothing), and checks the notice tray on every map. Screenshots in
  `e2e/shots/v3/`.

## Next candidates (not built)

- **Fusion**: two maxed weapons fuse into one, freeing a slot (Survivor.io
  has a few two-weapon evolutions). It gives endless mode something to draft
  for after the build is complete.
- **A boss-chest draft** after wave 5 that levels two weapons at once.
- **Weapon unlocks**: start with four weapons, unlock the rest by clearing
  maps or with salvage, so the draft only deals unlocked ones.
- **Longer clocks** as a weapon levels (15 s is the default today).
- Fit the watch-mode personas' pickup habits to real V3 logs (the
  `playtest-fidelity` skill) once there are some.
