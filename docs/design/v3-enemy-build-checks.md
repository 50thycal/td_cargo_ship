# Enemy build: how it was checked

What was tested and measured for the enemy build ([v3-enemy-build.md](v3-enemy-build.md)), and what each check changed. Everything here was run; the raw sweep output is in `tools/v3/enemy-ideas/sweeps/`.

## What success looks like (the player's view)

1. **Every Go further is in the game** (20, plus the Volatile Cloud), each debuting in its chapter. The Stealth Strafer and Stealth Bomber are two separate enemies.
2. **Each one does what its card says**, and the player's notes are honoured:
   - Dive Bomber: the circle first, the plane only at the last moment, a bomb that can't be stopped;
   - Stealth Bomber: B-2 shape, more health;
   - Scavenger: a grabbed pickup is gone;
   - Volatile Cloud: hurts the ships only when set off over them.
3. **Fair (en-unstoppable):** anything that can't be intercepted has a tell first, and its source can always be shot.
4. **Readable on a phone:** every tell shows in a real game frame at 667×375.
5. **The campaign's difficulty holds:** the new enemies stand in for part of a wave rather than adding to it.
6. **Nothing else breaks:** every unit test and browser check passes; logs replay exactly.

## Checks

**Rules, by unit test** (`tests/v3/foes.test.ts`, 30 tests):
- the roster (21 enemies, 5/5/5/6 by chapter);
- wave planning: none on wave 1, each chapter 1 map leading with a different new enemy, Free Play's None / All / Only;
- a Free Play log with an enemy chosen replays exactly;
- each enemy's own behaviour. Examples:
  - a Rocket Truck killed while it raises fires nothing;
  - decoys hurt nobody;
  - a Torpedo Sub's periscope is not a target;
  - the Armored Drone's plate takes only frontal shots;
  - the Spotter's strike is cancelled when it is shot down;
  - the Lure takes damage only from taps;
  - a Volatile Cloud popped over open water hurts nothing, while a burst inside one over a ship hurts it.

**Headless runs:** each enemy alone (Free Play "Only") on a map of its chapter, six seeds, the average bot. They found:
- **Hydra darts never appeared.** The gun's own splash from the killing shot destroyed them as they split. Fixed: they split 34 px out, past the plain gun's 22 px splash; a wider blast (Flak, a Wide Warhead) still catches both, as the design says.
- **Loitering drones sometimes dived as soon as they arrived** (a busy lane left them no clear spot). Fixed:
  - they now circle at least 1.6 s whatever comes (the tell);
  - the spot is the one furthest from the convoy's leading ship.
- **The Dive Bomber was almost never shot** (3 planes killed in six runs; it sank 36 ships). A 1.1 s window is shorter than a reaction plus a shot's flight from the carrier (about 0.8 s). The window is now 1.8 s, and the bomb's direct hit 2.
- **The Siege Battery was never shot by the bots** (no "time to impact"), and three salvos of three shells at 2 each hit too hard. Fixed:
  - the bots now rank every new enemy by when it does harm (`foeEta`);
  - the battery fires three salvos of two shells.

**In the browser:** `tools/v3/enemy-ideas/foeshots.mjs` froze a real Free Play wave at each enemy's tell (33 pictures, in `docs/design/img/enemy-build/`), and every picture was looked at. They found:
- the Sprint Drones' flare came almost as they left the shore on The Strait (the lane is about 300 px from the shore). It now comes 160 px out, with a ring that tightens onto the drone;
- Hydra darts too small to see: they are now bigger, with a halo;
- decoys hard to tell apart once revealed: they now get a white ring.

The e2e (`e2e/v3.mjs`) also checks:
- the briefing's New enemies panel;
- Free Play's Enemies line (24 choices);
- all 21 enemies coming into play and drawing in the browser with no page errors.

**Balance:** the campaign sweep (`npm run v3:sweep -- 6 --skills=average`, bare gun), without the new enemies, the first build (four by wave 10, each in place of a drone swarm), and as built (one on waves 2 to 5, two on 6 to 9, three on 10; the heavier ones also replace a missile):

| Map | Clear (none) | Ships lost (none) | Clear (first) | Ships lost (first) | Clear (built) | Ships lost (built) |
|---|---|---|---|---|---|---|
| strait | 100% | 0.8 | 100% | 1.2 | 83% | 2.7 |
| kesh | 100% | 1.0 | 83% | 2.2 | 100% | 2.2 |
| marrow | 100% | 1.7 | 100% | 1.8 | 100% | 1.3 |
| gauntlet | 100% | 2.2 | 67% | 3.7 | 100% | 2.7 |
| harbor | 67% | 3.7 | 17% | 5.5 | 17% | 5.5 |
| island | 67% | 4.5 | 33% | 4.5 | 17% | 5.5 |
| behemoth | 50% | 3.3 | 33% | 4.7 | 50% | 4.8 |
| needle | 17% | 5.3 | 17% | 5.2 | 17% | 5.0 |
| archipelago | 33% | 5.3 | 0% | 6.0 | 17% | 4.2 |
| saltgate | 0% | 6.0 | 0% | 6.0 | 0% | 6.2 |
| battery | 0% | 5.3 | 0% | 5.8 | 0% | 5.8 |
| sowers | 50% | 4.2 | 0% | 6.0 | 0% | 6.0 |
| rigs | 0% | 6.2 | 0% | 5.8 | 33% | 5.0 |
| lantern | 17% | 5.7 | 0% | 6.0 | 0% | 6.0 |
| dreadnought | 33% | 4.2 | 33% | 5.3 | 17% | 5.7 |
| coves | 0% | 6.2 | 0% | 5.2 | 0% | 6.0 |
| delta | 0% | 5.5 | 0% | 5.8 | 0% | 5.7 |
| crossing | 0% | 5.7 | 0% | 5.2 | 17% | 5.2 |
| tide | 17% | 5.8 | 0% | 6.0 | 0% | 6.0 |
| citadel | 17% | 5.5 | 0% | 5.3 | 0% | 5.8 |

**Whole game** (all 20 maps from an empty Armory, as the sweep estimates it):

| | Runs |
|---|---|
| Without the new enemies | 26 |
| First build | 24 |
| As built | 25 |

The whole campaign holds about level. The bare-gun average bot still clears Harbor and Island less often than before, and loses about one more ship a run on the early maps. Six seeds a map is noisy (one run is 17%).

**Left for the playtest and the pacing pass (task 56):** the bot doesn't use formation against circles and torpedo lines, and doesn't hold fire before decoys show, so a person may find some of these easier or harder than it does.

## Sounds

Twelve synthesized tells (`foe.*` in `tools/v3/audio/synth.py`):
- the flare, the Hydra's split, the dive, the rotor, the torpedo, the plate's clank, the claw;
- the dive bomber's siren, the siege gun, the paint lock, the mend, the ignition.

The shipped audio is 4,191,278 bytes, under the 4 MiB budget. The others reuse existing cues.

## Known limits

- The live page inside claude.ai can't be driven from here. The page file passed at 390 px wide, light and dark, with no errors and no sideways scroll, and a mark saved.
- The numbers are first proposals, tuned only against bots.
